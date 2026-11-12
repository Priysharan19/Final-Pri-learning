// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the Exam Desk — unmarked practice (ADR-0002 §8, plan F4a)
//
// One examination system, two modes. /v1/exams is the authenticated,
// server-marked mode. This router is the other: a student sits a library paper
// (plan F1, /v1/resources) at the desk under reading and working time, keeps
// notes and flags per question, and closes the paper. NOTHING HERE IS EVER A
// MARK. There is no answer, score, total, award or result anywhere in this
// router, its table (desk_attempts, schema 16) or its replies; `mode` is
// 'unmarked' on every reply and the table cannot hold anything else.
//
//   POST   /v1/desk/attempts               { resourceId }    start (Idempotency-Key)
//   GET    /v1/desk/attempts[?resourceId=]                   this account's attempts
//   GET    /v1/desk/attempts/:id                             one attempt
//   POST   /v1/desk/attempts/:id/clock     { intent, rev, early? }
//   PATCH  /v1/desk/attempts/:id/questions { changes }       flags, done, notes
//   DELETE /v1/desk/attempts/:id           { confirm: id }   the student's own delete
//   POST   /v1/desk/import/preview         { export }        read a prithagoras-web file; writes nothing
//   POST   /v1/desk/import                 { export }        bring it in (Idempotency-Key)
//
// SAFE BY CONSTRUCTION. This module imports nothing from the marking path —
// not exams.js, practice.js, the marker, contentSeen, recognition or
// handwriting, the learning-event writers or the entitlement allowance — and
// server/test/desk-isolation-check.mjs proves it over the whole import graph.
// So a desk attempt cannot be marked, counted against the exam allowance
// (owner decision F4 Q3: free on every plan, outside the allowance), recorded
// as content seen, swept by finaliseExpiredExams, or turned into a learning
// event: none of that code is reachable from here.
//
// THE SERVER STAMPS EVERY TIME. A clock request carries an intent and the
// attempt's revision, nothing else: a body with a time, deadline, remaining
// time or any other field is 400 DESK_CLOCK_INVALID and changes nothing. The
// clock is client/src/engine/deskClock.js over the server's own Date.now().
// When working time runs out the attempt does not close itself; overtime is
// counted and the student closes the paper (owner decision F4 Q5).
//
// WHO. Signed in, verified email, student role, and guardian consent for a
// child (the router-level gate) — the same eligibility as the marked papers
// (owner decision F4 Q7: signed-in only). Every read and write is keyed on
// (account, id, this server's edition), inside a transaction declared for the
// account (RLS: pri_account_scope). Another account's attempt, another
// edition's attempt, an unknown id and a malformed id are the same 404.
//
// EDITION. The server serves one edition (PRI_EDITION). It offers the papers
// its library offers to that edition, and records the edition on each
// attempt. Owner decision F4 Q1: the Prithagoras desk stays dark until its own
// region exists (ADR-0002 §9); that is a deployment gate, not a code path —
// this router works for whichever edition it runs as.
//
// IMPORT. A prithagoras-web desk export (client/src/engine/deskImport.js) is
// read, previewed (nothing written), and committed only by a second request.
// The timer is never imported. The same content twice is one record.
// ─────────────────────────────────────────────────────────────────────────────
import { createHash, randomUUID } from 'node:crypto';
import { asyncRouter } from './asyncRouter.js';
import { asStore } from './store.js';
import { rateLimit, requireRole, requireSession, requireVerifiedEmail } from './security.js';
import { serverEdition } from './edition.js';
import { resourcePublic } from './resourceCatalog.js';
import { VISIBLE } from './resources.js';
import { EDITION_IDS } from '../../client/edition.config.mjs';
import {
  CLOCK_VERSION, INTENTS, MAX_QUESTIONS, MS_MAX, applyIntent, deriveClock, paperConfigOf,
  questionTallies, readEvents, readQuestions, validNote
} from '../../client/src/engine/deskClock.js';
import { canonicalImport, exportResourceId, readDeskExport } from '../../client/src/engine/deskImport.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const IDEMPOTENCY = /^[a-zA-Z0-9_-]{8,100}$/;
const RESOURCE_ID = /^[a-z0-9][a-z0-9-]{2,119}$/;
const QUESTION_KEY = /^[1-9]\d{0,2}$/;
const LIST_MAX = 50;
const HOUR = 60 * 60 * 1000;

const CREATE_FIELDS = new Set(['resourceId']);
const CLOCK_FIELDS = new Set(['intent', 'rev', 'early']);
const QUESTIONS_FIELDS = new Set(['changes']);
const CHANGE_FIELDS = new Set(['done', 'flagged', 'note', 'noteRev', 'ms']);
const IMPORT_FIELDS = new Set(['export']);
const DELETE_FIELDS = new Set(['confirm']);

const plain = v => !!v && typeof v === 'object' && !Array.isArray(v);
const unknownKeys = (v, allowed) => Object.keys(v).filter(k => !allowed.has(k));
const sha256 = text => createHash('sha256').update(text).digest('hex');
const parse = (json, fallback) => { try { return JSON.parse(json); } catch { return fallback; } };
const fail = (res, status, code, message, extra = {}) => res.status(status).json({ error: { code, message }, ...extra });
const NOT_FOUND = ['DESK_ATTEMPT_NOT_FOUND', 'This practice attempt does not belong to this account.'];
const notFound = res => fail(res, 404, ...NOT_FOUND);

/** The library paper a desk attempt may be sat against, as this edition's library serves it, or null. */
async function deskPaper(db, resourceId, edition) {
  if (typeof resourceId !== 'string' || !RESOURCE_ID.test(resourceId)) return null;
  const row = await db.get(`SELECT r.* FROM resources r WHERE r.id=? AND r.type='paper' AND ${VISIBLE}`, [resourceId, edition]);
  if (!row) return null;
  const resource = resourcePublic(row);
  const count = resource.questionCount;
  return Number.isInteger(count) && count >= 1 && count <= MAX_QUESTIONS ? resource : null;
}

/**
 * An attempt as the student is sent it: an allow-list. Every field is the
 * student's own practice record or the paper's published facts; none is a
 * mark. `clock` is derived at the server's `now`.
 */
function attemptView(row, listed, now) {
  const paper = parse(row.paper_json, null);
  const events = readEvents(parse(row.clock_json, null));
  const questions = readQuestions(parse(row.questions_json, null), paper.questionCount);
  let clock = deriveClock(paper, events, now);
  // An imported attempt arrives closed and carries no timer at all.
  if (row.state === 'finished' && clock.phase !== 'finished') {
    clock = { phase: 'finished', running: false, remainingMs: 0, phaseEndsAt: null, overtimeMs: 0, elapsedReadingMs: 0, elapsedWorkingMs: 0,
      pausedMs: 0, readingEndedAt: null, finishedAt: Number(row.finished_at), finishReason: row.origin === 'prithagoras-import' ? 'imported' : 'student' };
  }
  const imported = row.origin === 'prithagoras-import' ? parse(row.imported_from_json, {}) : null;
  return {
    id: row.id,
    kind: 'desk-attempt',
    mode: 'unmarked',
    origin: row.origin,
    edition: row.edition,
    resource: listed
      ? { id: listed.id, title: listed.title, source: listed.source, attribution: listed.attribution, disclaimer: listed.disclaimer,
        url: listed.url, certificationState: listed.certificationState, listed: true }
      : { id: row.resource_id, title: paper.title, listed: false },
    paper,
    state: clock.phase,
    clock,
    events,
    questions,
    tallies: questionTallies(questions, paper.questionCount),
    rev: Number(row.rev),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    finishedAt: row.finished_at === null || row.finished_at === undefined ? null : Number(row.finished_at),
    ...(imported ? { imported: { exportVersion: 1, exportedAt: imported.exportedAt ?? null, phase: imported.phase ?? null } } : {})
  };
}

/** One line of the attempt list. */
function attemptSummary(row, now) {
  const view = attemptView(row, null, now);
  return {
    id: view.id, kind: view.kind, mode: view.mode, origin: view.origin, resourceId: row.resource_id, title: view.paper.title,
    state: view.state, tallies: view.tallies,
    time: { elapsedReadingMs: view.clock.elapsedReadingMs, elapsedWorkingMs: view.clock.elapsedWorkingMs, overtimeMs: view.clock.overtimeMs, pausedMs: view.clock.pausedMs },
    createdAt: view.createdAt, updatedAt: view.updatedAt, finishedAt: view.finishedAt
  };
}

/**
 * The desk router. `edition` defaults to the server's own (PRI_EDITION); tests
 * pass one to prove the other edition's papers and attempts stay out.
 */
export function createDeskRouter(db, { edition = serverEdition(process.env), now: clockNow = () => Date.now() } = {}) {
  db = asStore(db);
  if (!EDITION_IDS.includes(edition)) throw new Error(`exam desk: unknown edition ${JSON.stringify(edition)}`);
  const router = asyncRouter();
  router.use(requireSession(db), requireVerifiedEmail, requireRole('student'));
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

  const ownRow = (accountId, id) => db.get('SELECT * FROM desk_attempts WHERE id=? AND account_id=? AND edition=?', [id, accountId, edition]);
  const view = async (row, now) => attemptView(row, await deskPaper(db, row.resource_id, edition), now);
  const inAccount = (accountId, fn, { readOnly = false } = {}) =>
    db.transaction(fn, readOnly ? { readOnly: true, accountScope: accountId } : { accountScope: accountId, lock: `desk:${accountId}` });

  // ── Start an attempt ───────────────────────────────────────────────────────
  router.post('/attempts', rateLimit(db, 'desk-create', { limit: 60, windowMs: HOUR }), async (req, res) => {
    const key = String(req.get('idempotency-key') || '');
    if (!IDEMPOTENCY.test(key)) return fail(res, 400, 'IDEMPOTENCY_KEY_REQUIRED', 'Starting a practice paper needs a stable idempotency key.');
    const body = req.body;
    if (!plain(body) || unknownKeys(body, CREATE_FIELDS).length || typeof body.resourceId !== 'string') {
      return fail(res, 400, 'DESK_START_INVALID', 'Name the library paper to practise.');
    }
    const accountId = req.platformSession.account_id;
    const requestDigest = sha256(JSON.stringify({ resourceId: body.resourceId }));
    const outcome = await inAccount(accountId, async () => {
      const now = clockNow();
      const replay = await db.get('SELECT * FROM desk_attempts WHERE account_id=? AND create_key=? AND edition=?', [accountId, key, edition]);
      if (replay) return replay.create_digest === requestDigest ? { status: 201, row: replay, replayed: true } : { reused: true };
      const resource = await deskPaper(db, body.resourceId, edition);
      if (!resource) return { missing: true };
      // One open attempt per paper: the student is taken back to it.
      const open = await db.get("SELECT * FROM desk_attempts WHERE account_id=? AND resource_id=? AND edition=? AND state<>'finished'", [accountId, resource.id, edition]);
      if (open) return { status: 200, row: open, existing: true };
      const paper = paperConfigOf(resource);
      const id = randomUUID();
      await db.run(`INSERT INTO desk_attempts(id,account_id,edition,mode,origin,resource_id,paper_json,clock_json,questions_json,state,rev,create_key,create_digest,created_at,updated_at)
        VALUES (?,?,?,'unmarked','desk',?,?,?,?,'idle',0,?,?,?,?)`,
      [id, accountId, edition, resource.id, JSON.stringify(paper), JSON.stringify({ v: CLOCK_VERSION, events: [] }), '{}', key, requestDigest, now, now]);
      return { status: 201, row: await ownRow(accountId, id) };
    });
    if (outcome.reused) return fail(res, 409, 'IDEMPOTENCY_KEY_REUSED', 'This key already started a different practice paper.');
    if (outcome.missing) return fail(res, 404, 'DESK_PAPER_NOT_FOUND', 'This paper is not in your library.');
    const now = clockNow();
    return res.status(outcome.status).json({
      mode: 'unmarked', attempt: await view(outcome.row, now), now,
      ...(outcome.existing ? { existing: true } : {}), ...(outcome.replayed ? { replayed: true } : {})
    });
  });

  // ── Read ───────────────────────────────────────────────────────────────────
  router.get('/attempts', rateLimit(db, 'desk-list', { limit: 600, windowMs: HOUR }), async (req, res) => {
    const q = req.query || {};
    if (unknownKeys(q, new Set(['resourceId'])).length || (q.resourceId !== undefined && (typeof q.resourceId !== 'string' || !RESOURCE_ID.test(q.resourceId)))) {
      return fail(res, 400, 'DESK_FILTER_INVALID', 'Filter by one library paper id, or none.');
    }
    const accountId = req.platformSession.account_id;
    const rows = await inAccount(accountId, () => (q.resourceId === undefined
      ? db.all('SELECT * FROM desk_attempts WHERE account_id=? AND edition=? ORDER BY created_at DESC, id LIMIT ?', [accountId, edition, LIST_MAX])
      : db.all('SELECT * FROM desk_attempts WHERE account_id=? AND edition=? AND resource_id=? ORDER BY created_at DESC, id LIMIT ?', [accountId, edition, q.resourceId, LIST_MAX])), { readOnly: true });
    const now = clockNow();
    return res.json({ mode: 'unmarked', attempts: rows.map(row => attemptSummary(row, now)), now });
  });

  router.get('/attempts/:id', rateLimit(db, 'desk-read', { limit: 1200, windowMs: HOUR }), async (req, res) => {
    const id = String(req.params.id || '');
    if (!UUID.test(id)) return notFound(res);
    const accountId = req.platformSession.account_id;
    const row = await inAccount(accountId, () => ownRow(accountId, id), { readOnly: true });
    if (!row) return notFound(res);
    const now = clockNow();
    return res.json({ mode: 'unmarked', attempt: await view(row, now), now });
  });

  // ── The clock: intents only, stamped here ──────────────────────────────────
  router.post('/attempts/:id/clock', rateLimit(db, 'desk-clock', { limit: 600, windowMs: HOUR }), async (req, res) => {
    const id = String(req.params.id || '');
    const body = req.body;
    // A device never sends a time: anything but the intent, the revision and
    // the early-close flag is refused before anything is read.
    if (!plain(body) || unknownKeys(body, CLOCK_FIELDS).length || !INTENTS.includes(body.intent)
        || !Number.isSafeInteger(body.rev) || body.rev < 0 || (body.early !== undefined && typeof body.early !== 'boolean')) {
      return fail(res, 400, 'DESK_CLOCK_INVALID', 'Send only what to do with the clock and the attempt\'s revision. The server keeps the time.');
    }
    if (!UUID.test(id)) return notFound(res);
    const accountId = req.platformSession.account_id;
    const outcome = await inAccount(accountId, async () => {
      const now = clockNow();
      const row = await ownRow(accountId, id);
      if (!row) return { status: 404 };
      if (row.state === 'finished') return { status: 409, code: 'DESK_FINISHED', message: 'This paper is closed. Start a new attempt to sit it again.', row };
      if (Number(row.rev) !== body.rev) return { status: 409, code: 'DESK_REV_STALE', message: 'This attempt changed on another device. Here is where it stands now.', row };
      const paper = parse(row.paper_json, null);
      const applied = applyIntent(paper, parse(row.clock_json, null), body.intent, now, { early: body.early === true });
      if (applied.refused === 'DESK_FINISHED') return { status: 409, code: 'DESK_FINISHED', message: 'This paper is closed. Start a new attempt to sit it again.', row };
      if (applied.refused) return { status: 409, code: 'DESK_INTENT_NOT_ALLOWED', message: 'The clock cannot do that from where it stands.', row };
      const last = applied.events[applied.events.length - 1].at;
      const clock = deriveClock(paper, applied.events, last);
      const finishedAt = clock.phase === 'finished' ? clock.finishedAt : null;
      const changed = await db.run(`UPDATE desk_attempts SET clock_json=?, state=?, rev=rev+1, updated_at=?, finished_at=?
        WHERE id=? AND account_id=? AND rev=? AND state<>'finished'`,
      [JSON.stringify({ v: CLOCK_VERSION, events: applied.events }), clock.phase, now, finishedAt, id, accountId, Number(row.rev)]);
      if (!changed?.changes) return { status: 409, code: 'DESK_REV_STALE', message: 'This attempt changed on another device. Here is where it stands now.', row: await ownRow(accountId, id) };
      return { row: await ownRow(accountId, id) };
    });
    if (outcome.status === 404) return notFound(res);
    const now = clockNow();
    const attempt = outcome.row ? await view(outcome.row, now) : null;
    if (outcome.status) return fail(res, outcome.status, outcome.code, outcome.message, { mode: 'unmarked', attempt, now });
    return res.json({ mode: 'unmarked', attempt, now });
  });

  // ── Questions: done, flagged, notes ────────────────────────────────────────
  // Each changed question merges on its own: a note is kept only when its
  // noteRev is newer than the stored one (a stale write is reported back in
  // `stale`, never applied); done and flagged are independent booleans; `ms`
  // (time on the question, advisory) only grows. Editable after the paper is
  // closed: going back over flags and notes is the point of the desk.
  router.patch('/attempts/:id/questions', rateLimit(db, 'desk-questions', { limit: 1800, windowMs: HOUR }), async (req, res) => {
    const id = String(req.params.id || '');
    if (!UUID.test(id)) return notFound(res);
    const body = req.body;
    const invalid = () => fail(res, 400, 'DESK_QUESTIONS_INVALID', 'Send the changed questions: done, flagged, a note with its revision, or time.');
    if (!plain(body) || unknownKeys(body, QUESTIONS_FIELDS).length || !plain(body.changes)) return invalid();
    const entries = Object.entries(body.changes);
    if (!entries.length || entries.length > MAX_QUESTIONS) return invalid();
    for (const [key, change] of entries) {
      if (!QUESTION_KEY.test(key) || !plain(change) || unknownKeys(change, CHANGE_FIELDS).length || !Object.keys(change).length) return invalid();
      if (change.done !== undefined && typeof change.done !== 'boolean') return invalid();
      if (change.flagged !== undefined && typeof change.flagged !== 'boolean') return invalid();
      if ((change.note === undefined) !== (change.noteRev === undefined)) return invalid();
      if (change.note !== undefined && (!validNote(change.note) || !Number.isSafeInteger(change.noteRev) || change.noteRev < 1)) return invalid();
      if (change.ms !== undefined && (!Number.isSafeInteger(change.ms) || change.ms < 0 || change.ms > MS_MAX)) return invalid();
    }
    const accountId = req.platformSession.account_id;
    const outcome = await inAccount(accountId, async () => {
      const now = clockNow();
      const row = await ownRow(accountId, id);
      if (!row) return { status: 404 };
      const paper = parse(row.paper_json, null);
      if (entries.some(([key]) => Number(key) > paper.questionCount)) return { status: 400 };
      const questions = readQuestions(parse(row.questions_json, null), paper.questionCount);
      const stale = [];
      for (const [key, change] of entries) {
        const entry = { done: false, flagged: false, note: '', noteRev: 0, ms: 0, ...(questions[key] || {}) };
        if (change.done !== undefined) entry.done = change.done;
        if (change.flagged !== undefined) entry.flagged = change.flagged;
        if (change.note !== undefined) {
          if (change.noteRev > entry.noteRev) { entry.note = change.note; entry.noteRev = change.noteRev; } else stale.push(Number(key));
        }
        if (change.ms !== undefined) entry.ms = Math.max(entry.ms, change.ms);
        questions[key] = entry;
      }
      const kept = readQuestions(questions, paper.questionCount);
      await db.run('UPDATE desk_attempts SET questions_json=?, rev=rev+1, updated_at=? WHERE id=? AND account_id=?', [JSON.stringify(kept), now, id, accountId]);
      return { rev: Number(row.rev) + 1, stale: stale.sort((a, b) => a - b), questions: Object.fromEntries(entries.map(([key]) => [key, kept[key] || null])) };
    });
    if (outcome.status === 404) return notFound(res);
    if (outcome.status === 400) return invalid();
    return res.json({ mode: 'unmarked', rev: outcome.rev, stale: outcome.stale, questions: outcome.questions, now: clockNow() });
  });

  // ── Delete: the student's explicit choice ─────────────────────────────────
  router.delete('/attempts/:id', rateLimit(db, 'desk-delete', { limit: 60, windowMs: HOUR }), async (req, res) => {
    const id = String(req.params.id || '');
    if (!UUID.test(id)) return notFound(res);
    const body = req.body;
    if (!plain(body) || unknownKeys(body, DELETE_FIELDS).length || body.confirm !== id) {
      return fail(res, 400, 'DESK_DELETE_UNCONFIRMED', 'Confirm the delete by sending this attempt\'s id.');
    }
    const accountId = req.platformSession.account_id;
    const gone = await inAccount(accountId, async () => (await db.run('DELETE FROM desk_attempts WHERE id=? AND account_id=? AND edition=?', [id, accountId, edition]))?.changes);
    if (!gone) return notFound(res);
    return res.status(204).end();
  });

  // ── Import a prithagoras-web desk export ──────────────────────────────────
  const readImport = async (body, accountId) => {
    if (!plain(body) || unknownKeys(body, IMPORT_FIELDS).length) return { refused: 'DESK_IMPORT_NOT_A_DESK_FILE', detail: 'This isn\'t an Exam Desk export.' };
    const resource = await deskPaper(db, exportResourceId(body.export), edition);
    const read = readDeskExport(body.export, resource);
    if (!read.ok) return read;
    const importDigest = sha256(canonicalImport(read.plan));
    const earlier = await inAccount(accountId, () => db.all(
      "SELECT id,import_digest,created_at FROM desk_attempts WHERE account_id=? AND edition=? AND resource_id=? AND origin='prithagoras-import' ORDER BY created_at",
      [accountId, edition, read.plan.resourceId]), { readOnly: true });
    return { plan: read.plan, importDigest, earlier };
  };
  const importRefused = (res, read) => fail(res, read.refused === 'DESK_IMPORT_UNKNOWN_PAPER' ? 404 : 422, read.refused, read.detail);

  router.post('/import/preview', rateLimit(db, 'desk-import-preview', { limit: 60, windowMs: HOUR }), async (req, res) => {
    const accountId = req.platformSession.account_id;
    const read = await readImport(req.body, accountId);
    if (read.refused) return importRefused(res, read);
    const same = read.earlier.find(e => e.import_digest === read.importDigest);
    return res.json({
      mode: 'unmarked',
      preview: {
        resourceId: read.plan.resourceId, title: read.plan.title, questionCount: read.plan.questionCount,
        exportedAt: read.plan.exportedAt, tallies: read.plan.tallies, timerImported: false
      },
      alreadyImported: same ? { attemptId: same.id, at: Number(same.created_at) } : null,
      earlierImports: read.earlier.length
    });
  });

  router.post('/import', rateLimit(db, 'desk-import', { limit: 20, windowMs: HOUR }), async (req, res) => {
    const key = String(req.get('idempotency-key') || '');
    if (!IDEMPOTENCY.test(key)) return fail(res, 400, 'IDEMPOTENCY_KEY_REQUIRED', 'Adding practice to your account needs a stable idempotency key.');
    const accountId = req.platformSession.account_id;
    const read = await readImport(req.body, accountId);
    if (read.refused) return importRefused(res, read);
    const { plan, importDigest } = read;
    const requestDigest = sha256(canonicalImport(plan));
    const outcome = await inAccount(accountId, async () => {
      const now = clockNow();
      const replay = await db.get('SELECT * FROM desk_attempts WHERE account_id=? AND create_key=? AND edition=?', [accountId, key, edition]);
      if (replay) return replay.create_digest === requestDigest ? { status: 200, row: replay, replayed: true } : { reused: true };
      // The same content again (a second press, another device) is the record already made.
      const same = await db.get('SELECT * FROM desk_attempts WHERE account_id=? AND import_digest=? AND edition=?', [accountId, importDigest, edition]);
      if (same) return { status: 200, row: same, replayed: true };
      const resource = await deskPaper(db, plan.resourceId, edition);
      if (!resource) return { missing: true };
      const paper = paperConfigOf(resource);
      const questions = {};
      for (const [k, q] of Object.entries(plan.questions)) questions[k] = { done: q.done, flagged: q.flagged, note: q.note, noteRev: q.note ? 1 : 0, ms: 0 };
      const id = randomUUID();
      // Kept for the student's reference only: when the file was made and the
      // phase it named. Never the timer.
      const importedFrom = { exportVersion: 1, exportedAt: plan.exportedAt, phase: plan.phase };
      await db.run(`INSERT INTO desk_attempts(id,account_id,edition,mode,origin,resource_id,paper_json,clock_json,questions_json,state,rev,create_key,create_digest,import_digest,imported_from_json,created_at,updated_at,finished_at)
        VALUES (?,?,?,'unmarked','prithagoras-import',?,?,?,?,'finished',0,?,?,?,?,?,?,?)`,
      [id, accountId, edition, resource.id, JSON.stringify(paper), JSON.stringify({ v: CLOCK_VERSION, events: [] }), JSON.stringify(readQuestions(questions, paper.questionCount)),
        key, requestDigest, importDigest, JSON.stringify(importedFrom), now, now, now]);
      return { status: 201, row: await ownRow(accountId, id) };
    });
    if (outcome.reused) return fail(res, 409, 'IDEMPOTENCY_KEY_REUSED', 'This key already brought in a different export.');
    if (outcome.missing) return fail(res, 404, 'DESK_IMPORT_UNKNOWN_PAPER', 'This paper isn\'t in your library.');
    const now = clockNow();
    return res.status(outcome.status).json({ mode: 'unmarked', attempt: await view(outcome.row, now), now, ...(outcome.replayed ? { replayed: true } : {}) });
  });

  return router;
}
