// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the Exam Desk over real HTTP (ADR-0002 §8, plan F4a)
//
// What this suite holds (deterministic: the desk's clock is injected, nothing
// leaves the process; SQLite by default, Postgres with --engine=postgres):
//
//   1 · start: Idempotency-Key required, replay, a different body under the
//       same key is 409, one open attempt per paper (a second start returns
//       it), only this edition's published papers with a question count;
//   2 · the clock: every transition stamped with the SERVER's time; a body
//       carrying a time, deadline or remaining time (or any other field) is
//       400 and changes nothing; stale revision, an intent from the wrong
//       phase and a closed paper are 409; reading ends by itself at its
//       deadline; working time runs into overtime and the paper stays open;
//       closing twice writes one finish;
//   3 · questions: per-question note revisions (a stale one is reported, not
//       applied), independent done/flagged, time only grows, the limits, and
//       editing after the paper is closed;
//   4 · authorization: another account's attempt, another edition's attempt,
//       an unknown id and a malformed id are the same 404; signed out 401;
//       unverified, teacher and an unconsented child are refused; the other
//       edition's server does not offer this edition's paper;
//   5 · the import: preview writes nothing; commit is idempotent (same key,
//       same content on another key); the timer is never stored; every
//       refusal; the other edition's paper is refused like an unknown one;
//   6 · invariants: no score-shaped column, no score-shaped key in any reply,
//       no learning event, no exam or practice receipt; /v1/exams does not
//       know a desk id and the desk does not know an exam id;
//   7 · delete needs confirmation; account deletion cascades; on Postgres,
//       RLS confines each account to its own rows, and the schema-15 → 16
//       migration, its rollback and a re-apply.
//
//   node server/test/desk-check.mjs [--engine=postgres]
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import { readFileSync } from 'node:fs';

process.env.NODE_ENV = 'test';
process.env.PRI_AUTH_DELIVERY_KEY = process.env.PRI_AUTH_DELIVERY_KEY || '4e'.repeat(32);
delete process.env.PRI_PUBLIC_ORIGIN;

const { checks, registerAccount, startApp, verifyEmail, promoteRole } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const { asStore } = await import('../platform/store.js');
const { RESOURCE_SEED, resourceRowValues } = await import('../platform/resourceCatalog.js');
const { SCHEMA_VERSION } = await import('../platform/schemaVersions.js');
const { createPlatformDb } = await import('../platform/db.js');

const c = checks();
const SEED = RESOURCE_SEED[0];
const MIGRATION_NAME = '20261113010000_desk_attempts.sql';
const MIGRATION = readFileSync(new URL(`../../supabase/migrations/${MIGRATION_NAME}`, import.meta.url), 'utf8');
const ROLLBACK = readFileSync(new URL('../../docs/release/rollback/20261113010000_desk_attempts.rollback.sql', import.meta.url), 'utf8');
const EXPORT = JSON.parse(readFileSync(new URL('../../client/test/fixtures/prithagoras-desk-export-v1.synthetic.json', import.meta.url), 'utf8'));
const MIN = 60000;

// The desk's clock: the server's "now", moved by the suite.
const T0 = Date.UTC(2026, 10, 14, 9, 0, 0);
let T = T0;
const engine = requestedEngine();
const au = await startApp({ engine, log: () => {}, resources: { edition: 'prithagoras' }, desk: { now: () => T } });
const india = await startApp({ engine, log: () => {}, resources: { edition: 'priyabhata' }, desk: { now: () => T } });

// Every desk reply the suite sees, for the score-shaped key scan.
const replies = [];
const call = async (h, path, opts = {}) => {
  const r = await h.request(path, opts);
  if (path.startsWith('/v1/desk') && r.data) replies.push(r.data);
  return r;
};
let keySeq = 0;
const key = () => `desk-suite-${String(++keySeq).padStart(4, '0')}`;

try {
  const store = asStore(au.db);
  const insertResource = async (patch, editions, h = au) => {
    const r = { ...SEED, editions, description: `Test row ${patch.id}.`, subtitle: null, tags: ['Test'], sections: [], ...patch };
    await asStore(h.db).run(`INSERT INTO resources(id,title,subtitle,description,type,subject,year,grade,marks,duration_minutes,reading_minutes,question_count,sections_json,tags_json,course,syllabus_version,certification_state,availability,url,source,attribution,rights_note,disclaimer,review_state,created_at,updated_at,published_at)
      VALUES (${Array(27).fill('?').join(',')})`, resourceRowValues(r));
    for (const e of editions) await asStore(h.db).run('INSERT INTO resource_editions(resource_id,edition) VALUES (?,?)', [r.id, e]);
  };
  await insertResource({ id: 'short-paper', title: 'Short paper', questionCount: 5, readingMinutes: 0, durationMinutes: 30, marks: 20 }, ['prithagoras']);
  await insertResource({ id: 'india-only-paper', title: 'India paper', course: 'in', questionCount: 10 }, ['priyabhata']);
  await insertResource({ id: 'shared-notes', title: 'Notes', type: 'notes', questionCount: null }, ['prithagoras']);
  await insertResource({ id: 'uncounted-paper', title: 'Paper with no count', questionCount: null }, ['prithagoras']);
  await insertResource({ id: 'draft-paper', title: 'Draft paper', reviewState: 'draft', publishedAt: null }, ['prithagoras']);
  await insertResource({ id: 'withdrawn-paper', title: 'Withdrawn paper', questionCount: 6, reviewState: 'withdrawn' }, ['prithagoras']);

  const student = async (h, email) => {
    const a = await registerAccount(h, { email });
    c.eq((await verifyEmail(h, a.account.id)).status, 200, `${email} verifies`);
    return a;
  };
  const A = await student(au, 'desk-a@example.test');
  const B = await student(au, 'desk-b@example.test');
  const start = (who, body, k = key(), h = au) => call(h, '/v1/desk/attempts', { method: 'POST', jar: who.jar, body, headers: k ? { 'Idempotency-Key': k } : {} });
  const get = (who, id, h = au) => call(h, `/v1/desk/attempts/${id}`, { jar: who.jar });
  const clock = (who, id, body, headers = {}) => call(au, `/v1/desk/attempts/${id}/clock`, { method: 'POST', jar: who.jar, body, headers });
  const patch = (who, id, changes) => call(au, `/v1/desk/attempts/${id}/questions`, { method: 'PATCH', jar: who.jar, body: { changes } });

  // ── 1 · Start ──────────────────────────────────────────────────────────────
  c.deq([(await start(A, { resourceId: SEED.id }, null)).data?.error?.code], ['IDEMPOTENCY_KEY_REQUIRED'], 'a start without an Idempotency-Key is refused');
  for (const body of [{}, { resourceId: SEED.id, mode: 'marked' }, { resourceId: 7 }, [SEED.id]]) {
    const r = await start(A, body);
    c.deq([r.status, r.data?.error?.code], [400, 'DESK_START_INVALID'], `a start body ${JSON.stringify(body)} is refused`);
  }
  for (const id of ['no-such-paper', 'india-only-paper', 'shared-notes', 'uncounted-paper', 'draft-paper', 'withdrawn-paper', '../etc']) {
    const r = await start(A, { resourceId: id });
    c.deq([r.status, r.data?.error?.code], [404, 'DESK_PAPER_NOT_FOUND'], `${id}: not a paper this edition's library offers for the desk`);
  }
  const k1 = key();
  const s1 = await start(A, { resourceId: SEED.id }, k1);
  c.eq(s1.status, 201, 'a student starts the seeded paper at the desk');
  const a1 = s1.data.attempt;
  c.deq([a1.kind, a1.mode, s1.data.mode, a1.origin, a1.edition, a1.state, a1.rev, a1.events], ['desk-attempt', 'unmarked', 'unmarked', 'desk', 'prithagoras', 'idle', 0, []],
    'an unmarked, idle attempt with an empty log');
  c.deq([a1.paper.questionCount, a1.paper.readingMinutes, a1.paper.workingMinutes, a1.paper.marks, a1.paper.sections.map(s => [s.label, s.firstQuestion, s.lastQuestion])],
    [27, 10, 180, 100, [['Section I', 1, 10], ['Section II', 11, 27]]], 'the paper is frozen with its times and the library\'s two sections');
  c.deq([a1.resource.listed, a1.resource.disclaimer, a1.resource.certificationState], [true, SEED.disclaimer, 'uploaded'], 'the attempt carries the paper\'s disclaimer and certification state');
  c.deq([a1.clock.remainingMs, a1.createdAt, s1.data.now], [180 * MIN, T0, T0], 'the server\'s clock, not the device\'s');
  c.eq(s1.headers.get('cache-control'), 'no-store', 'desk replies are not cached');
  const replay = await start(A, { resourceId: SEED.id }, k1);
  c.deq([replay.status, replay.data.replayed, replay.data.attempt.id], [201, true, a1.id], 'the same key replays the same start');
  const reused = await start(A, { resourceId: 'short-paper' }, k1);
  c.deq([reused.status, reused.data?.error?.code], [409, 'IDEMPOTENCY_KEY_REUSED'], 'the same key with another paper is 409');
  const again = await start(A, { resourceId: SEED.id });
  c.deq([again.status, again.data.existing, again.data.attempt.id], [200, true, a1.id], 'a second start (another key) returns the open attempt: one open attempt per paper');
  c.eq(Number((await store.get('SELECT count(*) AS n FROM desk_attempts WHERE account_id=?', [A.account.id])).n), 1, 'and no second row is written');

  // ── 4 · Authorization (part) ──────────────────────────────────────────────
  const unknown = '00000000-0000-4000-8000-000000000000';
  const notFound = [];
  for (const [who, id] of [[B, a1.id], [A, unknown], [A, 'not-a-uuid'], [A, a1.id.toUpperCase()]]) {
    const r = await get(who, id);
    notFound.push([r.status, r.data?.error?.code, r.data?.error?.message]);
  }
  c.ok(notFound.every(x => JSON.stringify(x) === JSON.stringify(notFound[0])) && notFound[0][0] === 404 && notFound[0][1] === 'DESK_ATTEMPT_NOT_FOUND',
    'another account\'s attempt, an unknown id, a malformed id and a case-changed id are the same 404');
  for (const [label, run] of [
    ['clock', () => clock(B, a1.id, { intent: 'begin-reading', rev: 0 })],
    ['questions', () => patch(B, a1.id, { 1: { done: true } })],
    ['delete', () => call(au, `/v1/desk/attempts/${a1.id}`, { method: 'DELETE', jar: B.jar, body: { confirm: a1.id } })]
  ]) {
    const r = await run();
    c.deq([r.status, r.data?.error?.code], [404, 'DESK_ATTEMPT_NOT_FOUND'], `another account cannot ${label} the attempt`);
  }
  c.deq((await get(A, a1.id)).data.attempt.rev, 0, 'and nothing they sent changed it');

  // ── 2 · The clock ─────────────────────────────────────────────────────────
  const before = JSON.stringify((await store.get('SELECT clock_json,rev,state FROM desk_attempts WHERE id=?', [a1.id])));
  for (const extra of [{ at: T0 + 7200000 }, { deadline: T0 }, { remainingMs: 1 }, { phaseEndsAt: T0 }, { startedAt: T0 }, { now: T0 }, { remainingTimeSeconds: 600 }, { score: 1 }]) {
    const r = await clock(A, a1.id, { intent: 'begin-reading', rev: 0, ...extra });
    c.deq([r.status, r.data?.error?.code], [400, 'DESK_CLOCK_INVALID'], `a clock request carrying ${Object.keys(extra)[0]} is refused`);
  }
  for (const body of [{ intent: 'launch', rev: 0 }, { intent: 'pause' }, { intent: 'pause', rev: -1 }, { intent: 'pause', rev: '0' }, { intent: 'finish', rev: 0, early: 'yes' }, [0]]) {
    c.eq((await clock(A, a1.id, body)).data?.error?.code, 'DESK_CLOCK_INVALID', `a malformed clock body ${JSON.stringify(body)} is refused`);
  }
  c.eq(JSON.stringify(await store.get('SELECT clock_json,rev,state FROM desk_attempts WHERE id=?', [a1.id])), before, 'the stored clock is byte-identical after every refused request');

  // The device's clock is two hours ahead; the server's is T0 + 5 s.
  T = T0 + 5000;
  const r1 = await clock(A, a1.id, { intent: 'begin-reading', rev: 0 }, { Date: new Date(T0 + 7200000).toUTCString() });
  c.deq([r1.status, r1.data.attempt.events, r1.data.attempt.state, r1.data.attempt.rev, r1.data.attempt.clock.phaseEndsAt],
    [200, [{ t: 'begin-reading', at: T0 + 5000 }], 'reading', 1, T0 + 5000 + 10 * MIN], 'begin reading: stamped with the server\'s time, not the device\'s');
  const stale = await clock(A, a1.id, { intent: 'pause', rev: 0 });
  c.deq([stale.status, stale.data?.error?.code, stale.data?.attempt?.rev], [409, 'DESK_REV_STALE', 1], 'a stale revision is 409 with the attempt as it stands');
  c.deq([(await clock(A, a1.id, { intent: 'resume', rev: 1 })).data?.error?.code], ['DESK_INTENT_NOT_ALLOWED'], 'resume while running is not allowed');
  T = T0 + 5000 + 2 * MIN;
  c.eq((await clock(A, a1.id, { intent: 'pause', rev: 1 })).data.attempt.clock.remainingMs, 8 * MIN, 'pause freezes the reading time left');
  T += 3 * MIN;
  const g1 = await get(A, a1.id);
  c.deq([g1.data.attempt.clock.remainingMs, g1.data.attempt.clock.pausedMs, g1.data.attempt.clock.running], [8 * MIN, 3 * MIN, false], 'paused: the time left does not move, the pause is counted');
  c.eq((await clock(A, a1.id, { intent: 'resume', rev: 2 })).data.attempt.clock.phaseEndsAt, T + 8 * MIN, 'resume restarts it with the same time left');
  const readingEnds = T + 8 * MIN;
  T = readingEnds + 4 * MIN;
  const g2 = await get(A, a1.id);
  c.deq([g2.data.attempt.state, g2.data.attempt.clock.readingEndedAt, g2.data.attempt.clock.remainingMs, g2.data.attempt.clock.running],
    ['ready', readingEnds, 180 * MIN, false], 'reading ends by itself at its deadline; working time does not start by itself');
  c.eq((await clock(A, a1.id, { intent: 'pause', rev: 3 })).data?.error?.code, 'DESK_INTENT_NOT_ALLOWED', 'nothing to pause once reading has ended');
  c.eq((await clock(A, a1.id, { intent: 'finish', rev: 3 })).data?.error?.code, 'DESK_INTENT_NOT_ALLOWED', 'closing before working time needs early: true');
  const w = await clock(A, a1.id, { intent: 'begin-working', rev: 3 });
  c.deq(w.data.attempt.events.slice(-2), [{ t: 'reading-ended', at: readingEnds }, { t: 'begin-working', at: T }], 'the end of reading is recorded at the moment it was due, then working begins');
  const workEnds = T + 180 * MIN;
  T = workEnds + 252000;
  const g3 = await get(A, a1.id);
  c.deq([g3.data.attempt.state, g3.data.attempt.clock.remainingMs, g3.data.attempt.clock.overtimeMs, g3.data.attempt.clock.running], ['working', 0, 252000, true],
    'working time ran out: overtime is counted and the paper stays open (Q5)');

  // ── 3 · Questions ─────────────────────────────────────────────────────────
  const q1 = await patch(A, a1.id, { 3: { note: 'check the domain', noteRev: 1, flagged: true }, 4: { done: true, ms: 60000 } });
  c.deq([q1.status, q1.data.stale, q1.data.rev, q1.data.questions['3'].note, q1.data.questions['4'].done], [200, [], 5, 'check the domain', true], 'notes and done saved; rev advances');
  const q2 = await patch(A, a1.id, { 3: { note: 'an older edit', noteRev: 1, done: true }, 4: { ms: 1000 } });
  c.deq([q2.data.stale, q2.data.questions['3'].note, q2.data.questions['3'].done, q2.data.questions['3'].flagged, q2.data.questions['4'].ms],
    [[3], 'check the domain', true, true, 60000], 'a stale note is reported and not applied; done and flagged are independent; time only grows');
  c.eq((await patch(A, a1.id, { 3: { note: 'newer', noteRev: 2 } })).data.questions['3'].note, 'newer', 'a newer note revision wins');
  for (const [label, changes] of [
    ['a question beyond the paper', { 28: { done: true } }], ['question 0', { 0: { done: true } }], ['a padded key', { '03': { done: true } }],
    ['a note over 5,000 characters', { 1: { note: 'x'.repeat(5001), noteRev: 9 } }], ['a control character', { 1: { note: 'bell\u0007', noteRev: 9 } }],
    ['a note without its revision', { 1: { note: 'x' } }], ['time over 24 h', { 1: { ms: 24 * 3600000 + 1 } }], ['a score', { 1: { score: 3 } }],
    ['a mark', { 1: { mark: 'correct' } }], ['ink (not in F4a)', { 1: { ink: { v: 1, strokes: '' } } }], ['done as text', { 1: { done: 'yes' } }], ['nothing', {}]
  ]) {
    const r = await patch(A, a1.id, changes);
    c.deq([r.status, r.data?.error?.code], [400, 'DESK_QUESTIONS_INVALID'], `refused: ${label}`);
  }

  // Closing.
  const rev = (await get(A, a1.id)).data.attempt.rev;
  const f1 = await clock(A, a1.id, { intent: 'finish', rev });
  c.deq([f1.status, f1.data.attempt.state, f1.data.attempt.finishedAt, f1.data.attempt.clock.overtimeMs, f1.data.attempt.clock.finishReason], [200, 'finished', T, 252000, 'student'],
    'the student closes the paper; the overtime is recorded');
  const f2 = await clock(A, a1.id, { intent: 'finish', rev: rev + 1 });
  const f3 = await clock(A, a1.id, { intent: 'finish', rev });
  c.deq([f2.status, f2.data?.error?.code, f2.data?.attempt?.state, f3.data?.error?.code], [409, 'DESK_FINISHED', 'finished', 'DESK_FINISHED'],
    'closing again (current or stale revision) is 409 DESK_FINISHED with the closed attempt');
  c.eq((await clock(A, a1.id, { intent: 'begin-working', rev: rev + 1 })).data?.error?.code, 'DESK_FINISHED', 'a closed paper never restarts');
  const stored = JSON.parse((await store.get('SELECT clock_json FROM desk_attempts WHERE id=?', [a1.id])).clock_json);
  c.eq(stored.events.filter(e => e.t === 'finish').length, 1, 'closing twice wrote exactly one finish');
  c.eq((await patch(A, a1.id, { 5: { flagged: true } })).status, 200, 'flags and notes stay editable after closing');

  // A new attempt once the first is closed; the first stays in history.
  T += 1000;
  const s2 = await start(A, { resourceId: SEED.id });
  c.deq([s2.status, s2.data.attempt.id !== a1.id, s2.data.attempt.questions], [201, true, {}], 'practising again starts a fresh attempt (nothing carried)');
  T += 1000;
  const s3 = await start(A, { resourceId: 'short-paper' });
  T += 1000;
  const z = await clock(A, s3.data.attempt.id, { intent: 'begin-reading', rev: 0 });
  c.deq([z.data.attempt.state, z.data.attempt.events.map(e => e.t)], ['working', ['begin-working']], 'a zero-reading paper: begin reading begins working time');

  // Listing.
  const list = await call(au, '/v1/desk/attempts', { jar: A.jar });
  c.deq(list.data.attempts.map(x => x.id), [s3.data.attempt.id, s2.data.attempt.id, a1.id], 'the list: this account\'s attempts, newest first');
  c.ok(list.data.attempts.every(x => x.mode === 'unmarked' && x.kind === 'desk-attempt'), 'each one unmarked');
  c.deq(list.data.attempts.find(x => x.id === a1.id).tallies, { done: 2, flagged: 2, notes: 1 }, 'the list carries done, flagged and note tallies — no score');
  c.deq((await call(au, `/v1/desk/attempts?resourceId=short-paper`, { jar: A.jar })).data.attempts.map(x => x.id), [s3.data.attempt.id], 'filter by paper');
  c.eq((await call(au, '/v1/desk/attempts?resourceId=BAD', { jar: A.jar })).data?.error?.code, 'DESK_FILTER_INVALID', 'a bad filter is refused');
  c.deq((await call(au, '/v1/desk/attempts', { jar: B.jar })).data.attempts, [], 'another account lists none of them');

  // Another edition's attempt in this database is invisible here.
  const foreign = '11111111-1111-4111-8111-111111111111';
  await store.run(`INSERT INTO desk_attempts(id,account_id,edition,mode,origin,resource_id,paper_json,clock_json,questions_json,state,rev,created_at,updated_at)
    VALUES (?,?,'priyabhata','unmarked','desk','india-only-paper',?,?,'{}','idle',0,?,?)`, [foreign, A.account.id, JSON.stringify({ title: 'India', questionCount: 10, readingMinutes: 0, workingMinutes: 60 }), JSON.stringify({ v: 1, events: [] }), T, T]);
  c.eq((await get(A, foreign)).status, 404, 'an attempt recorded in the other edition is a 404 here');
  c.ok(!(await call(au, '/v1/desk/attempts', { jar: A.jar })).data.attempts.some(x => x.id === foreign), 'and is not listed');

  // ── 5 · Import ────────────────────────────────────────────────────────────
  const rowsBefore = Number((await store.get('SELECT count(*) AS n FROM desk_attempts')).n);
  const preview = await call(au, '/v1/desk/import/preview', { method: 'POST', jar: A.jar, body: { export: EXPORT } });
  c.deq([preview.status, preview.data.preview.tallies, preview.data.preview.timerImported, preview.data.alreadyImported, preview.data.earlierImports],
    [200, { done: 4, flagged: 2, notes: 3 }, false, null, 0], 'preview: what would come across, and that the timer does not');
  c.eq(Number((await store.get('SELECT count(*) AS n FROM desk_attempts')).n), rowsBefore, 'preview writes nothing');
  const imp = (body, k = key(), who = A, h = au) => call(h, '/v1/desk/import', { method: 'POST', jar: who.jar, body, headers: k ? { 'Idempotency-Key': k } : {} });
  c.eq((await imp({ export: EXPORT }, null)).data?.error?.code, 'IDEMPOTENCY_KEY_REQUIRED', 'committing needs an Idempotency-Key');
  const ik = key();
  const i1 = await imp({ export: EXPORT }, ik);
  const ia = i1.data.attempt;
  c.deq([i1.status, ia.origin, ia.state, ia.mode, ia.events, ia.clock.phase, ia.clock.finishReason, ia.finishedAt, ia.imported],
    [201, 'prithagoras-import', 'finished', 'unmarked', [], 'finished', 'imported', T, { exportVersion: 1, exportedAt: Date.parse(EXPORT.createdAt), phase: 'working' }],
    'the import creates a closed, unmarked attempt with no timer events');
  c.deq([ia.questions['3'].note, ia.questions['3'].flagged, ia.questions['1'].done, '12' in ia.questions, ia.tallies], ['check the domain before squaring', true, true, false, { done: 4, flagged: 2, notes: 3 }],
    'statuses and notes come across; the empty note does not');
  const row = await store.get('SELECT * FROM desk_attempts WHERE id=?', [ia.id]);
  c.ok(!/remainingTimeSeconds|4360|running|deadline|remainingMs/.test(JSON.stringify(row)), 'the stored row holds nothing of the old timer');
  c.deq([(await imp({ export: EXPORT }, ik)).data.attempt.id, (await imp({ export: EXPORT })).data.replayed, (await imp({ export: EXPORT })).data.attempt.id], [ia.id, true, ia.id],
    'the same key, or the same content under another key, is the same record');
  c.eq((await imp({ export: { ...EXPORT, statuses: { 7: 'done' } } }, ik)).data?.error?.code, 'IDEMPOTENCY_KEY_REUSED', 'the same key with different content is 409');
  const i2 = await imp({ export: { ...EXPORT, statuses: { ...EXPORT.statuses, 20: 'done' } } });
  c.deq([i2.status, i2.data.attempt.id !== ia.id], [201, true], 'a later, different export of the same paper is a second record; the first is unchanged');
  const p2 = await call(au, '/v1/desk/import/preview', { method: 'POST', jar: A.jar, body: { export: EXPORT } });
  c.deq([p2.data.alreadyImported?.attemptId, p2.data.earlierImports], [ia.id, 2], 'the preview says when this exact export is already in the account');
  c.eq((await clock(A, ia.id, { intent: 'begin-working', rev: 0 })).data?.error?.code, 'DESK_FINISHED', 'an imported attempt cannot be started: practising again is a new attempt');
  c.eq((await patch(A, ia.id, { 2: { note: 'added after import', noteRev: 1 } })).status, 200, 'imported notes are editable');
  for (const [label, body, status, code] of [
    ['another version', { export: { ...EXPORT, exportVersion: 2 } }, 422, 'DESK_IMPORT_VERSION'],
    ['not a desk file', { export: 'hello' }, 422, 'DESK_IMPORT_NOT_A_DESK_FILE'],
    ['an extra request field', { export: EXPORT, attemptId: ia.id }, 422, 'DESK_IMPORT_NOT_A_DESK_FILE'],
    ['an unknown paper', { export: { ...EXPORT, resource: { id: 'no-such-paper' } } }, 404, 'DESK_IMPORT_UNKNOWN_PAPER'],
    ['the other edition\'s paper', { export: { ...EXPORT, resource: { id: 'india-only-paper' }, exam: { questions: 10 } } }, 404, 'DESK_IMPORT_UNKNOWN_PAPER'],
    ['a changed paper', { export: { ...EXPORT, exam: { ...EXPORT.exam, questions: 30 } } }, 422, 'DESK_IMPORT_PAPER_CHANGED'],
    ['a status off the paper', { export: { ...EXPORT, statuses: { 40: 'done' } } }, 422, 'DESK_IMPORT_MALFORMED'],
    ['an empty export', { export: { ...EXPORT, statuses: {}, notes: { 1: '' } } }, 422, 'DESK_IMPORT_EMPTY']
  ]) {
    for (const path of ['/v1/desk/import/preview', '/v1/desk/import']) {
      const r = await call(au, path, { method: 'POST', jar: A.jar, body, headers: { 'Idempotency-Key': key() } });
      c.deq([r.status, r.data?.error?.code], [status, code], `${path}: ${label} is refused`);
    }
  }
  // The Priyabhata server does not offer the Prithagoras paper: same answer as an unknown one.
  const I = await student(india, 'desk-in@example.test');
  const leak = await imp({ export: EXPORT }, key(), I, india);
  c.deq([leak.status, leak.data?.error?.code], [404, 'DESK_IMPORT_UNKNOWN_PAPER'], 'Priyabhata: importing the Prithagoras paper is refused like an unknown paper');
  const leakStart = await start(I, { resourceId: SEED.id }, key(), india);
  c.deq([leakStart.status, leakStart.data?.error?.code], [404, 'DESK_PAPER_NOT_FOUND'], 'Priyabhata: the Prithagoras paper cannot be started either');

  // ── 4 · Who may use the desk ──────────────────────────────────────────────
  for (const path of ['/v1/desk/attempts', `/v1/desk/attempts/${a1.id}`]) {
    c.deq([(await call(au, path)).status], [401], `signed out: ${path} is 401`);
  }
  const U = await registerAccount(au, { email: 'desk-unverified@example.test' });
  c.eq((await start(U, { resourceId: SEED.id })).data?.error?.code, 'EMAIL_UNVERIFIED', 'an unverified account is refused');
  const teacher = await student(au, 'desk-teacher@example.test');
  await promoteRole(au, teacher.jar, teacher.account.id, 'teacher');
  c.eq((await start(teacher, { resourceId: SEED.id })).data?.error?.code, 'FORBIDDEN', 'a teacher account is refused (student role only)');
  const child = await student(au, 'desk-child@example.test');
  await store.run("UPDATE accounts SET age_basis='child' WHERE id=?", [child.account.id]);
  const kid = await start(child, { resourceId: SEED.id });
  c.ok(kid.status === 403 && /^GUARDIAN_CONSENT_|^AGE_DECLARATION_/.test(kid.data?.error?.code || ''), `a child without guardian consent is refused (${kid.data?.error?.code})`);

  // ── 6 · Invariants: never a mark ──────────────────────────────────────────
  const learning = Number((await store.get('SELECT count(*) AS n FROM learning_events WHERE account_id=?', [A.account.id])).n);
  const receipts = Number((await store.get('SELECT count(*) AS n FROM idempotency_keys WHERE account_id=?', [A.account.id])).n);
  c.deq([learning, receipts], [0, 0], 'after attempts, a closed paper and imports: no learning event, no exam or practice receipt, nothing counted against the exam allowance');
  const examView = await call(au, `/v1/exams/${a1.id}`, { jar: A.jar });
  c.deq([examView.status, examView.data?.error?.code], [404, 'EXAM_NOT_FOUND'], '/v1/exams does not know a desk attempt');
  const examId = '22222222-2222-4222-8222-222222222222';
  await store.run("INSERT INTO idempotency_keys(account_id,scope,key,response_json,request_digest,created_at,expires_at) VALUES (?,'exam-paper',?,?,?,?,?)",
    [A.account.id, examId, JSON.stringify({ id: examId }), 'x', T, T + 1e9]);
  c.eq((await get(A, examId)).status, 404, 'the desk does not know a sealed exam paper');
  const columns = au.engine === 'postgres'
    ? (await store.all("SELECT column_name AS name FROM information_schema.columns WHERE table_schema='pri' AND table_name='desk_attempts'")).map(r => r.name)
    : (await store.all("SELECT name FROM pragma_table_info('desk_attempts')")).map(r => r.name);
  c.ok(columns.length === 18 && !columns.some(name => /score|mark|award|pct|grade|result|correct|total/i.test(name)), `desk_attempts has no score-shaped column (${columns.join(', ')})`);
  const FORBIDDEN = /^(score|scores|awarded|pct|percent|correct|result|results|grade|marksEarned|marksAwarded|outcome|total|mark)$/;
  const walk = (v, path, hits) => {
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`, hits));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (FORBIDDEN.test(k)) hits.push(`${path}.${k}`); walk(x, `${path}.${k}`, hits); }
    return hits;
  };
  const hits = walk(replies, '', []);
  c.ok(replies.length > 80 && !hits.length, `no desk reply (${replies.length} seen) carries a score-shaped key ${hits.slice(0, 3).join(', ')}`);
  c.ok(replies.filter(r => !r.error).every(r => r.mode === 'unmarked'), 'every successful desk reply says mode: unmarked');

  // ── 7 · Delete, cascade ───────────────────────────────────────────────────
  const del = body => call(au, `/v1/desk/attempts/${s3.data.attempt.id}`, { method: 'DELETE', jar: A.jar, body });
  c.eq((await del({})).data?.error?.code, 'DESK_DELETE_UNCONFIRMED', 'delete needs the id as confirmation');
  c.eq((await del({ confirm: a1.id })).data?.error?.code, 'DESK_DELETE_UNCONFIRMED', 'and the right id');
  c.eq((await del({ confirm: s3.data.attempt.id })).status, 204, 'the student deletes their attempt');
  c.eq((await del({ confirm: s3.data.attempt.id })).status, 404, 'a second delete is 404');
  const Bs = await start(B, { resourceId: SEED.id });
  c.eq(Bs.status, 201, 'B has an attempt');
  await store.run('DELETE FROM accounts WHERE id=?', [B.account.id]);
  c.eq(Number((await store.get('SELECT count(*) AS n FROM desk_attempts WHERE account_id=?', [B.account.id])).n), 0, 'deleting the account deletes its desk attempts (cascade)');

  // ── 7 · Postgres: RLS, migration ──────────────────────────────────────────
  c.ok(/^begin;$/m.test(ROLLBACK) && /^commit;$/m.test(ROLLBACK) && /update pri\.platform_meta set value = '15' where key = 'schema_version';/.test(ROLLBACK)
    && (ROLLBACK.match(/^drop table /gm) || []).length === 1, 'the documented rollback is one transaction: one table dropped, schema_version back to 15');
  c.ok(/update pri\.platform_meta set value = '16' where key = 'schema_version';/.test(MIGRATION) && SCHEMA_VERSION === 16, 'the migration and the build agree on schema 16');
  if (au.engine === 'postgres') {
    const C = await student(au, 'desk-c@example.test');
    const cs = (await start(C, { resourceId: SEED.id })).data.attempt.id;
    const seen = await store.transaction(() => store.all('SELECT id, account_id FROM desk_attempts'), { readOnly: true, accountScope: C.account.id });
    c.deq(seen.map(r => r.id), [cs], 'RLS: in C\'s account scope only C\'s attempt is visible');
    const touched = await store.transaction(() => store.run("UPDATE desk_attempts SET questions_json='{}' WHERE account_id=?", [A.account.id]), { accountScope: C.account.id });
    c.eq(touched.changes, 0, 'RLS: C\'s scope cannot change A\'s attempts');

    const { scratchDatabase, migrationFiles } = await import('./support/postgres.mjs');
    const scratch = await scratchDatabase('desk_upgrade', { migrations: migrationFiles().filter(m => m.name < MIGRATION_NAME) });
    const su = scratch.client;
    const version = async () => (await su.query("SELECT value FROM pri.platform_meta WHERE key='schema_version'")).rows[0].value;
    const tables = async () => (await su.query("SELECT tablename FROM pg_tables WHERE schemaname='pri' ORDER BY tablename")).rows.map(r => r.tablename);
    const counts = async names => { const out = {}; for (const t of names) out[t] = Number((await su.query(`SELECT count(*) AS n FROM pri.${t}`)).rows[0].n); return out; };
    try {
      c.eq(await version(), '15', 'the upgrade starts from a schema-15 database');
      await su.query("INSERT INTO pri.accounts(id,email,name,role,created_at,updated_at) VALUES ('mig-a','mig-a@example.test','A','student',1,1)");
      const before15 = await tables();
      const rows15 = await counts(before15.filter(t => t !== 'platform_meta'));
      await su.query(MIGRATION);
      c.eq(await version(), '16', 'forward: schema_version is 16');
      c.deq((await tables()).filter(t => !before15.includes(t)), ['desk_attempts'], 'forward: exactly desk_attempts is added');
      c.deq(await counts(before15.filter(t => t !== 'platform_meta')), rows15, 'forward: no other row changed');
      const policies = (await su.query("SELECT policyname, permissive FROM pg_policies WHERE schemaname='pri' AND tablename='desk_attempts' ORDER BY policyname")).rows;
      c.deq(policies.map(p => `${p.policyname}:${p.permissive}`), ['pri_account_scope:RESTRICTIVE', 'pri_scope_required:RESTRICTIVE', 'pri_server_all:PERMISSIVE'], 'forward: RLS fails closed and confines rows to their account');
      c.eq((await su.query("SELECT relrowsecurity FROM pg_class WHERE oid='pri.desk_attempts'::regclass")).rows[0].relrowsecurity, true, 'forward: RLS is on');
      const bad = async sql => { try { await su.query(sql); return 'accepted'; } catch (e) { return e.code; } };
      const ins = (mode, state, finished) => `INSERT INTO pri.desk_attempts(id,account_id,edition,mode,origin,resource_id,paper_json,clock_json,questions_json,state,created_at,updated_at,finished_at)
        VALUES ('x-${mode}-${state}','mig-a','prithagoras','${mode}','desk','${SEED.id}','{}','{}','{}','${state}',1,1,${finished})`;
      c.deq([await bad(ins('marked', 'idle', 'null')), await bad(ins('unmarked', 'finished', 'null')), await bad(ins('unmarked', 'idle', '5'))], ['23514', '23514', '23514'],
        'the table refuses a marked mode and a finished state without its time (and the reverse)');
      await su.query(ins('unmarked', 'idle', 'null'));
      c.eq(await bad(ins('unmarked', 'idle', 'null').replace("'x-unmarked-idle'", "'x-second'")), '23505', 'a second open attempt at the same paper is refused by the index');
      await su.query(ROLLBACK);
      c.eq(await version(), '15', 'rollback: schema_version is 15');
      c.deq(await tables(), before15, 'rollback: exactly desk_attempts is gone');
      c.deq(await counts(before15.filter(t => t !== 'platform_meta')), rows15, 'rollback: no other row changed');
      await su.query(MIGRATION);
      c.deq([await version(), Number((await su.query('SELECT count(*) AS n FROM pri.desk_attempts')).rows[0].n)], ['16', 0], 're-apply after rollback: schema 16, empty');
    } finally { await scratch.drop(); }
  } else {
    const db = createPlatformDb(':memory:');
    c.eq(db.prepare("SELECT value FROM platform_meta WHERE key='schema_version'").get().value, '16', 'SQLite: the build is at schema 16');
    db.prepare("INSERT INTO accounts(id,email,name,role,created_at,updated_at) VALUES ('mig-a','mig-a@example.test','A','student',1,1)").run();
    const ins = (id, mode, state, finished) => () => db.prepare(`INSERT INTO desk_attempts(id,account_id,edition,mode,origin,resource_id,paper_json,clock_json,questions_json,state,created_at,updated_at,finished_at)
      VALUES (?,'mig-a','prithagoras',?,'desk',?,'{}','{}','{}',?,1,1,?)`).run(id, mode, SEED.id, state, finished);
    const code = fn => { try { fn(); return 'accepted'; } catch (e) { return e.code; } };
    c.deq([code(ins('m1', 'marked', 'idle', null)), code(ins('m2', 'unmarked', 'finished', null)), code(ins('m3', 'unmarked', 'idle', 5))],
      ['SQLITE_CONSTRAINT_CHECK', 'SQLITE_CONSTRAINT_CHECK', 'SQLITE_CONSTRAINT_CHECK'], 'SQLite: a marked mode and an inconsistent finish are refused by the table');
    ins('ok', 'unmarked', 'idle', null)();
    c.eq(code(ins('second', 'unmarked', 'reading', null)), 'SQLITE_CONSTRAINT_UNIQUE', 'SQLite: a second open attempt at the same paper is refused by the index');
    db.close();
  }

  console.log(`engine: ${au.engine}`);
  console.log(`desk-check (${au.engine}): ${c.count()} checks passed`);
} finally {
  await au.close();
  await india.close();
}
