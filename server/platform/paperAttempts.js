// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · sitting an exam paper (or one multi-part question) in the app
//
//   POST /v1/papers/:id/attempts                 issue a sitting (resume the open one)
//   GET  /v1/papers/attempts                     this account's sittings
//   GET  /v1/papers/exam-style/:subtopic         exam-style questions for a practice subtopic (Paper, Question, marks)
//   GET  /v1/papers/attempts/:attemptId          the sitting: paper as issued + saved answers (+ result once submitted)
//   POST /v1/papers/attempts/:attemptId/answers  autosave typed answers / timer choice (POST: the client transport has no PUT)
//   POST /v1/papers/attempts/:attemptId/parts/:partId/original
//                                                keep one handwritten or photographed part (original + reading)
//   POST /v1/papers/attempts/:attemptId/submit   "Submit all": mark every part the engine can, once
//   GET  /v1/papers/attempts/:attemptId/parts/:partId/solution   sample answer, after submitting
//   GET  /v1/papers/attempts/:attemptId/figures/:name            one diagram of the paper, as an SVG
//
// WHO. A signed-in verified student (guardian consent for a child), as every
// student route. The paper's entitlement is the SERVER'S decision from its own
// entitlement row: a manifest entry flagged `sample` is free; every other paper
// needs `premium-exams`. Prithagoras only: any other edition answers 404
// PAPERS_NOT_AVAILABLE. Nothing the device sends names a plan.
//
// WHAT IS KEPT, AND WHERE (no schema change). The account's own rows of
// idempotency_keys, under three scopes:
//   paper-sitting  attemptId → { paperId, scope, issuedAt, timer }       written once
//   paper-answers  attemptId → { answers, savedAt, ms }                  replaced by each save
//   paper-result   attemptId → the result                                written once
// and attempt_originals (originalWork.js, standard #08) for the student's own
// strokes or photographed page, bound to the mark by SHA-256 exactly as for a
// single question (question_id = "<attemptId>:<partId>").
//
// WHAT THE STUDENT SEES BEFORE SUBMITTING: publicPaper() only. No key, no
// guideline criterion, no sample answer. Those come after Submit.
//
// MARKING. The deterministic engine decides every mark; a model never does.
//   · multiple choice: the engine's mcq check, 1 mark;
//   · a part with a key (a final number or expression): checkAnswer by the
//     engine; a right FINAL ANSWER earns the part's `autoMarks` (1 for a
//     multi-mark part: the author's own guideline gives a bare answer at most
//     one mark; the rest is checked against the guideline by the student);
//   · every other part (proofs, explanations, sketches, find-parts with no key)
//     is "self-check against the sample answer": NO mark is claimed.
//   Criterion (method) marks are NOT awarded here. The guideline's criteria are
//   listed as "How this is marked"; their marks appear only for a scheme the
//   owner has approved (paperContent.js schemeApproved). The totals line is
//   honest: x of y marks available to automatic marking; z self-checked.
//
// HANDWRITING. A handwritten or photographed part is read by the answer-blind
// reader before this route (the same kept read single questions use); this
// route only binds the reading the student saw and confirmed, never starts a
// paid read, and the engine marks the CONFIRMED TEXT. Reading never sets a mark.
// ─────────────────────────────────────────────────────────────────────────────
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { rateLimit } from './security.js';
import { serverEntitlementCapabilities } from './entitlements.js';
import { consentBlockerCode, consentState } from './guardianConsent.js';
import { sessionFromRequest } from './security.js';
import { markerPool, markerCooldownUntil, recordMarkerKills, MARKING_BUSY, BUSY_MESSAGE, TOO_COMPLEX_MESSAGE } from './markerPool.js';
import { parseOriginal, keepOriginal, OriginalRefused, originalProof } from './originalWork.js';
import { recognitionOpsFor, sendRecognitionRefusal } from './recognitionOps.js';
import { transcribeHandwriting, validateImage, HandwritingProviderError } from './handwritingProvider.js';
import { engineQuestion, howMarked, publicPaper, schemeApproved, scopedLeaves, statedTime } from './paperContent.js';

const DAY = 24 * 60 * 60 * 1000;
// Practice subtopic (client/src/engine/curriculum.js, Extension 1) → the syllabus outcomes the guideline's mapping grid names.
export const SUBTOPIC_OUTCOMES = Object.freeze({
  'me11-functions': ['ME1-11-01'], 'me11-poly': ['ME1-11-02'], 'me11-trigid': ['ME1-11-03'], 'me12-trigeq': ['ME1-11-03'],
  'me11-comb': ['ME1-11-04'], 'me11-binomial': ['ME1-11-05'], 'me12-induction': ['ME1-12-01'], 'me12-vectors': ['ME1-12-02'],
  'me11-inversetrig': ['ME1-12-03'], 'me12-calc': ['ME1-12-04'], 'me11-rates': ['ME1-12-05'], 'me12-binomial': ['ME1-12-06']
});
const leafPartsOf = question => { const out = []; const walk = ps => ps.forEach(p => (p.parts ? walk(p.parts) : out.push(p))); walk(question.parts); return out; };
const KEEP = 400 * DAY;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const KEY = /^[A-Za-z0-9_-]{8,80}$/;
const PART_ID = /^q\d{1,2}[a-z]?(-[ivx]+)?$/;
const FIG = /^fig[A-Za-z0-9]{1,100}$/;
const MODES = ['typed', 'ink', 'photo'];
const MAX_TEXT = 12000;
const MAX_OPEN = 24;
const plain = v => !!v && typeof v === 'object' && !Array.isArray(v);
const unknownKeys = (o, ok) => Object.keys(o).filter(k => !ok.includes(k));
const digest = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');

const refuse = (res, status, code, message, extra = {}) => res.status(status).json({ error: { code, message, ...extra } });
const premiumRefusal = (res, capability) => res.status(402).json({ error: {
  code: 'PREMIUM_REQUIRED', capability, plan: 'free', retryable: false,
  message: 'The Extension 1 practice papers are part of Pri Learning Premium. Practice Paper 1 is free.' } });

const SELECT = 'SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope=? AND key=? AND expires_at>?';
const UPSERT = `INSERT INTO idempotency_keys(account_id,scope,key,response_json,request_digest,created_at,expires_at) VALUES (?,?,?,?,?,?,?)
  ON CONFLICT(account_id,scope,key) DO UPDATE SET response_json=excluded.response_json, request_digest=excluded.request_digest, expires_at=excluded.expires_at`;

async function readRow(db, accountId, scope, key, now) {
  const row = await db.get(SELECT, [accountId, scope, key, now]);
  return row ? JSON.parse(row.response_json) : null;
}

/**
 * Mount the sitting routes on the papers router. `ctx`:
 *   offered, byId (manifest), docs (structured papers), approvals, dir, isPremium(accountId), capability,
 *   now(), env, transcribe.
 */
export function mountPaperAttempts(router, db, ctx) {
  const { offered, byId, docs, dir, capability } = ctx;
  const clock = ctx.now || (() => Date.now());
  const transcribe = ctx.transcribe || transcribeHandwriting;
  const env = ctx.env || process.env;
  const approvalsNow = () => (typeof ctx.approvals === 'function' ? ctx.approvals() : ctx.approvals || []);
  const noStore = res => res.set('Cache-Control', 'private, no-store');

  /** Everything one request needs about a sitting, or a sent refusal. */
  async function sitting(req, res, { allowSubmitted = true } = {}) {
    noStore(res);
    if (!offered) { refuse(res, 404, 'PAPERS_NOT_AVAILABLE', 'No practice papers are offered here.'); return null; }
    const id = String(req.params.attemptId || '');
    if (!UUID.test(id)) { refuse(res, 404, 'PAPER_ATTEMPT_NOT_FOUND', 'No such sitting.'); return null; }
    const accountId = req.platformSession.account_id;
    const now = clock();
    const sit = await readRow(db, accountId, 'paper-sitting', id, now);
    const doc = sit && docs.get(sit.paperId);
    if (!sit || !doc) { refuse(res, 404, 'PAPER_ATTEMPT_NOT_FOUND', 'No such sitting.'); return null; }
    const result = await readRow(db, accountId, 'paper-result', id, now);
    if (result && !allowSubmitted) { refuse(res, 409, 'PAPER_ATTEMPT_SUBMITTED', 'This sitting has been submitted.'); return null; }
    const saved = (await readRow(db, accountId, 'paper-answers', id, now)) || { answers: {}, savedAt: null, ms: 0 };
    return { id, accountId, now, sit, doc, result, saved };
  }

  const view = ({ id, sit, doc, result, saved }) => ({
    id, paperId: sit.paperId, title: doc.title, scope: sit.scope || null, state: result ? 'submitted' : 'open',
    issuedAt: sit.issuedAt, timer: { mode: saved.timer || sit.timer, readingMs: statedTime(doc.readingTime), workingMs: statedTime(doc.workingTime) },
    answers: Object.fromEntries(Object.entries(saved.answers).map(([k, a]) => [k, { mode: a.mode, text: a.text, ...(a.working ? { working: a.working } : {}), kept: !!a.originalId }])),
    savedAt: saved.savedAt, ms: saved.ms || 0,
    paper: publicPaper(doc, sit.scope || null),
    ...(result ? { result } : {})
  });

  // ── Issue ──────────────────────────────────────────────────────────────────
  router.post('/:id/attempts', rateLimit(db, 'paper-attempt-issue', { limit: 60, windowMs: 3600000 }), async (req, res) => {
    noStore(res);
    if (!offered) return refuse(res, 404, 'PAPERS_NOT_AVAILABLE', 'No practice papers are offered here.');
    const body = req.body === undefined ? {} : req.body;
    if (!plain(body) || unknownKeys(body, ['timer', 'fresh', 'question']).length ||
        (body.timer !== undefined && !['paper', 'off'].includes(body.timer)) || (body.fresh !== undefined && typeof body.fresh !== 'boolean') ||
        (body.question !== undefined && !(Number.isInteger(body.question) && body.question >= 1 && body.question <= 14))) {
      return refuse(res, 400, 'PAPER_ATTEMPT_INVALID', 'Send only timer ("paper" or "off"), fresh and question.');
    }
    const entry = byId.get(String(req.params.id || ''));
    const doc = entry && docs.get(entry.id);
    if (!entry || !doc) return refuse(res, 404, 'PAPER_NOT_FOUND', 'No such practice paper.');
    const accountId = req.platformSession.account_id;
    if (entry.sample !== true && !(await ctx.isPremium(accountId))) return premiumRefusal(res, capability);
    const scope = body.question ? { question: body.question, section: body.question <= 10 ? 'I' : 'II' } : null;
    if (scope && !scopedLeaves(doc, scope).length) return refuse(res, 404, 'PAPER_NOT_FOUND', 'No such question in this paper.');
    const now = clock();
    const out = await db.transaction(async () => {
      const rows = await db.all("SELECT key,response_json FROM idempotency_keys WHERE account_id=? AND scope='paper-sitting' AND expires_at>?", [accountId, now]);
      const done = new Set((await db.all("SELECT key FROM idempotency_keys WHERE account_id=? AND scope='paper-result' AND expires_at>?", [accountId, now])).map(r => r.key));
      const open = rows.map(r => ({ id: r.key, ...JSON.parse(r.response_json) })).filter(s => !done.has(s.id));
      const same = open.filter(s => s.paperId === doc.id && JSON.stringify(s.scope || null) === JSON.stringify(scope)).sort((a, b) => b.issuedAt - a.issuedAt)[0];
      if (same && body.fresh !== true) return { id: same.id, resumed: true };
      if (open.length >= MAX_OPEN) return { full: true };
      const id = randomUUID();
      const sit = { paperId: doc.id, scope, issuedAt: now, timer: body.timer || 'paper' };
      await db.run(UPSERT, [accountId, 'paper-sitting', id, JSON.stringify(sit), digest(sit), now, now + KEEP]);
      return { id, resumed: false };
    }, { accountScope: accountId, lock: `paper-attempt:${accountId}` });
    if (out.full) return refuse(res, 409, 'PAPER_ATTEMPTS_OPEN_LIMIT', `Finish or leave one of your ${MAX_OPEN} open sittings first.`);
    req.params.attemptId = out.id;
    const s = await sitting(req, res);
    if (!s) return undefined;
    return res.status(out.resumed ? 200 : 201).json({ attempt: view(s), resumed: out.resumed });
  });

  // ── Exam-style questions for a practice subtopic ───────────────────────────
  // The guideline's mapping grid names each part's syllabus outcome; a subtopic
  // of the Extension 1 pathway is offered the multi-part Section II questions
  // whose parts carry one of its outcomes. Which are open to this account is
  // the server's decision (a sample is free, the rest Premium).
  router.get('/exam-style/:subtopic', rateLimit(db, 'paper-exam-style', { limit: 600, windowMs: 3600000 }), async (req, res) => {
    noStore(res);
    if (!offered) return refuse(res, 404, 'PAPERS_NOT_AVAILABLE', 'No practice papers are offered here.');
    const subtopic = String(req.params.subtopic || '');
    const outcomes = SUBTOPIC_OUTCOMES[subtopic];
    if (!outcomes) return res.json({ subtopic, questions: [] });
    const premium = await ctx.isPremium(req.platformSession.account_id);
    const out = [];
    for (const doc of docs.values()) {
      const entry = byId.get(doc.id);
      for (const q of doc.sections.find(sec => sec.id === 'II')?.questions || []) {
        const hit = leafPartsOf(q).filter(p => (p.classification?.outcomes || []).some(o => outcomes.includes(o)));
        if (!hit.length) continue;
        out.push({ paperId: doc.id, paperNumber: doc.paperNumber, title: doc.title, question: q.number, marks: q.marks, matchingParts: hit.map(p => p.id),
          locked: !(premium || entry?.sample === true) });
      }
    }
    out.sort((a, b) => Number(a.locked) - Number(b.locked) || a.paperNumber - b.paperNumber || a.question - b.question);
    return res.json({ subtopic, questions: out.slice(0, 12) });
  });

  // ── List ───────────────────────────────────────────────────────────────────
  router.get('/attempts', rateLimit(db, 'paper-attempt-list', { limit: 600, windowMs: 3600000 }), async (req, res) => {
    noStore(res);
    if (!offered) return refuse(res, 404, 'PAPERS_NOT_AVAILABLE', 'No practice papers are offered here.');
    const accountId = req.platformSession.account_id;
    const now = clock();
    const rows = await db.all("SELECT key,response_json FROM idempotency_keys WHERE account_id=? AND scope='paper-sitting' AND expires_at>? ORDER BY created_at DESC", [accountId, now]);
    const results = new Map((await db.all("SELECT key,response_json FROM idempotency_keys WHERE account_id=? AND scope='paper-result' AND expires_at>?", [accountId, now])).map(r => [r.key, JSON.parse(r.response_json)]));
    res.json({ attempts: rows.slice(0, 50).map(r => {
      const sit = JSON.parse(r.response_json);
      const result = results.get(r.key);
      return { id: r.key, paperId: sit.paperId, scope: sit.scope || null, issuedAt: sit.issuedAt, state: result ? 'submitted' : 'open', ...(result ? { submittedAt: result.submittedAt, totals: result.totals } : {}) };
    }) });
  });

  // ── Read one ───────────────────────────────────────────────────────────────
  router.get('/attempts/:attemptId', rateLimit(db, 'paper-attempt-read', { limit: 1200, windowMs: 3600000 }), async (req, res) => {
    const s = await sitting(req, res);
    if (s) res.json({ attempt: view(s) });
  });

  // ── Autosave ───────────────────────────────────────────────────────────────
  router.post('/attempts/:attemptId/answers', rateLimit(db, 'paper-autosave', { limit: 3000, windowMs: 3600000 }), async (req, res) => {
    const s = await sitting(req, res, { allowSubmitted: false });
    if (!s) return undefined;
    const body = req.body;
    if (!plain(body) || unknownKeys(body, ['answers', 'timer', 'ms']).length ||
        (body.answers !== undefined && !plain(body.answers)) || (body.timer !== undefined && !['paper', 'off'].includes(body.timer)) ||
        (body.ms !== undefined && !(Number.isSafeInteger(body.ms) && body.ms >= 0 && body.ms <= 86400000 * 3))) {
      return refuse(res, 400, 'PAPER_ANSWERS_INVALID', 'Send answers (by part id), timer and ms.');
    }
    const leafIds = new Set(scopedLeaves(s.doc, s.sit.scope).map(l => l.part.id));
    const incoming = body.answers || {};
    if (Object.keys(incoming).length > 80) return refuse(res, 400, 'PAPER_ANSWERS_INVALID', 'Too many parts in one save.');
    const next = { ...s.saved.answers };
    for (const [partId, a] of Object.entries(incoming)) {
      if (!leafIds.has(partId)) return refuse(res, 400, 'PAPER_ANSWERS_INVALID', `${partId} is not a part of this sitting.`);
      if (!plain(a) || unknownKeys(a, ['mode', 'text', 'working']).length || !MODES.includes(a.mode) || typeof a.text !== 'string' || a.text.length > MAX_TEXT ||
          (a.working !== undefined && (typeof a.working !== 'string' || a.working.length > MAX_TEXT))) {
        return refuse(res, 400, 'PAPER_ANSWERS_INVALID', `${partId}: an answer is { mode, text, working? } of at most ${MAX_TEXT} characters each.`);
      }
      const before = next[partId];
      const working = typeof a.working === 'string' && a.working.trim() ? a.working : undefined;
      if (!a.text.trim() && !working) { delete next[partId]; continue; }
      // A kept original belongs to the reading it was kept with: edit the text and it must be kept again.
      const keep = before?.originalId && before.mode === a.mode && before.text === a.text;
      next[partId] = keep ? { ...before, ...(working ? { working } : {}) } : { mode: a.mode, text: a.text, ...(working ? { working } : {}) };
    }
    const snapshot = { answers: next, savedAt: s.now, ms: body.ms ?? s.saved.ms ?? 0, ...(body.timer ? { timer: body.timer } : s.saved.timer ? { timer: s.saved.timer } : {}) };
    await db.transaction(async () => {
      if (await db.get("SELECT key FROM idempotency_keys WHERE account_id=? AND scope='paper-result' AND key=?", [s.accountId, s.id])) return;
      await db.run(UPSERT, [s.accountId, 'paper-answers', s.id, JSON.stringify(snapshot), digest(snapshot), s.now, s.now + KEEP]);
    }, { accountScope: s.accountId, lock: `paper-attempt:${s.accountId}` });
    return res.json({ saved: true, savedAt: s.now });
  });

  // ── Keep one handwritten / photographed part ───────────────────────────────
  router.post('/attempts/:attemptId/parts/:partId/original', rateLimit(db, 'paper-original', { limit: 600, windowMs: 3600000 }), async (req, res) => {
    const s = await sitting(req, res, { allowSubmitted: false });
    if (!s) return undefined;
    const partId = String(req.params.partId || '');
    const leaf = scopedLeaves(s.doc, s.sit.scope).find(l => l.part.id === partId);
    const body = req.body;
    if (!leaf || !PART_ID.test(partId)) return refuse(res, 404, 'PAPER_PART_NOT_FOUND', 'No such part in this sitting.');
    if (!plain(body) || unknownKeys(body, ['mode', 'text', 'working', 'image', 'original']).length || !['ink', 'photo'].includes(body.mode) ||
        typeof body.text !== 'string' || !body.text.trim() || body.text.length > MAX_TEXT || typeof body.image !== 'string' ||
        (body.working !== undefined && (typeof body.working !== 'string' || body.working.length > MAX_TEXT))) {
      return refuse(res, 400, 'PAPER_ORIGINAL_INVALID', 'Send mode (ink or photo), the confirmed reading text, the picture that was read and its original.');
    }
    try { validateImage(body.image); } catch (error) { return refuse(res, error.status || 400, error.code || 'RECOGNITION_IMAGE_INVALID', error.message || 'Invalid image.'); }
    let parsed;
    try { parsed = parseOriginal(body.original, { mode: body.mode, picture: body.image }); }
    catch (error) { if (error instanceof OriginalRefused) return refuse(res, error.status, error.code, error.message); throw error; }
    // Bind the reading the student was shown. Never start a paid read here.
    let read;
    try {
      read = await recognitionOpsFor(db).read({ db, accountId: s.accountId, image: body.image, env, transcribe, requestId: req.requestId, paid: false });
      if (read.missing) return refuse(res, 409, 'RECOGNITION_READ_EXPIRED', 'This page needs to be read again before it can be kept. Press Read again.');
      if (read.refusal) return sendRecognitionRefusal(res, read.refusal);
    } catch (error) {
      if (error instanceof HandwritingProviderError) return refuse(res, error.status, error.code, error.message);
      return refuse(res, 502, 'RECOGNITION_FAILED', 'The answer could not be read this time.');
    }
    const readText = String(read.result?.text || '');
    const corrected = readText !== body.text || read.result?.needsConfirmation === true;
    const now = clock();
    const out = await db.transaction(async () => {
      const live = await sessionFromRequest(db, req);
      if (!live || live.account_id !== s.accountId) return { status: 401, code: 'AUTH_REQUIRED' };
      const blocker = consentBlockerCode(await consentState(db, s.accountId, { lock: true }));
      if (blocker) return { status: 403, code: blocker };
      if (await db.get("SELECT key FROM idempotency_keys WHERE account_id=? AND scope='paper-result' AND key=?", [s.accountId, s.id])) return { status: 409, code: 'PAPER_ATTEMPT_SUBMITTED' };
      const kept = await keepOriginal(db, {
        accountId: s.accountId, edition: 'prithagoras', questionId: `${s.id}:${partId}`, submissionId: parsed.sha256.slice(0, 40), attemptId: s.id,
        parsed, reading: { read: readText || null, confirmed: body.text, corrected, receipt: null }, now });
      if (!kept.saved) return { status: kept.reason === 'quota' ? 413 : 409, code: kept.reason === 'quota' ? 'ORIGINAL_QUOTA' : 'ORIGINAL_CONFLICT' };
      const saved = (await readRow(db, s.accountId, 'paper-answers', s.id, now)) || { answers: {} };
      saved.answers[partId] = { mode: body.mode, text: body.text, ...(body.working?.trim() ? { working: body.working } : {}), originalId: kept.row.id, sha256: parsed.sha256, readText: readText || null };
      saved.savedAt = now;
      await db.run(UPSERT, [s.accountId, 'paper-answers', s.id, JSON.stringify(saved), digest(saved), now, now + KEEP]);
      return { status: 200, proof: originalProof(kept.row) };
    }, { accountScope: s.accountId, lock: `paper-attempt:${s.accountId}` });
    if (out.status !== 200) return refuse(res, out.status, out.code, out.status === 401 ? 'Sign in again.' : out.status === 403 ? 'Guardian consent changed.' : 'This part cannot be kept.');
    return res.json({ kept: true, original: out.proof, readingCorrected: corrected });
  });

  // ── Submit all ─────────────────────────────────────────────────────────────
  router.post('/attempts/:attemptId/submit', rateLimit(db, 'paper-submit', { limit: 60, windowMs: 3600000 }), async (req, res) => {
    const s = await sitting(req, res);
    if (!s) return undefined;
    const body = req.body === undefined ? {} : req.body;
    if (!plain(body) || unknownKeys(body, ['submissionId', 'ms']).length || (body.submissionId !== undefined && !KEY.test(body.submissionId)) ||
        (body.ms !== undefined && !(Number.isSafeInteger(body.ms) && body.ms >= 0 && body.ms <= 86400000 * 3))) {
      return refuse(res, 400, 'PAPER_SUBMISSION_INVALID', 'Send submissionId and ms only.');
    }
    // A repeated Submit (a lost reply, a double tap) is given the stored result: nothing is marked twice.
    if (s.result) return res.json({ attempt: view(s), replay: true });
    const cooling = await markerCooldownUntil(db, s.accountId);
    if (cooling) return refuse(res, 429, 'MARKING_COOLDOWN', 'Several entries could not be checked. Wait a few minutes, then write the answers simply.', { retryAfterMs: Math.max(0, cooling - Date.now()) });
    const leaves = scopedLeaves(s.doc, s.sit.scope);
    // Handwritten parts must have been kept (the original is the evidence): never marked from a bare text.
    const unkept = leaves.filter(l => { const a = s.saved.answers[l.part.id]; return a && a.mode !== 'typed' && !a.originalId; }).map(l => l.part.id);
    if (unkept.length) return refuse(res, 409, 'PAPER_ORIGINALS_MISSING', 'Keep each handwritten or photographed part before submitting.', { parts: unkept });

    // ── Mark, with no transaction open ───────────────────────────────────────
    const pool = markerPool();
    const parts = {};
    let kills = 0;
    for (const { part, question, section } of leaves) {
      const a = s.saved.answers[part.id];
      const base = { id: part.id, marks: part.marks, autoMarks: part.autoMarks, mode: a?.mode || null, answered: !!a, ...(a?.originalId ? { originalId: a.originalId } : {}) };
      if (!part.key) { parts[part.id] = { ...base, checks: 'self', verdict: 'self-check', awarded: 0 }; continue; }
      if (!a) { parts[part.id] = { ...base, checks: 'pri', verdict: 'unanswered', awarded: 0 }; continue; }
      const q = engineQuestion(s.doc, { part, question, section });
      const given = part.key.type === 'mcq' ? String('ABCD'.indexOf(String(a.text).trim().toUpperCase().slice(0, 1))) : a.text;
      const grid = { correct: part.autoMarks, incorrect: 0, unanswered: 0 };
      const out = await pool.run('exam', { q, given, working: '', grid }, { key: s.accountId });
      if (!out.ok && out.code === MARKING_BUSY) return refuse(res, 503, MARKING_BUSY, BUSY_MESSAGE);
      if (!out.ok) {
        kills += 1;
        parts[part.id] = { ...base, checks: 'pri', verdict: 'unreadable', awarded: 0, feedback: TOO_COMPLEX_MESSAGE };
        continue;
      }
      const r = out.value.response;
      parts[part.id] = { ...base, checks: 'pri', verdict: r.unanswered ? 'unanswered' : r.correct ? 'correct' : 'incorrect', awarded: r.correct ? part.autoMarks : 0,
        ...(!r.correct && r.feedback ? { feedback: String(r.feedback).slice(0, 400) } : {}) };
    }
    if (kills) await recordMarkerKills(db, s.accountId, kills);

    const totals = totalsOf(s.doc, leaves, parts);
    const submittedAt = clock();
    const approved = schemeApproved(s.doc, approvalsNow());
    const result = { submittedAt, ms: body.ms ?? s.saved.ms ?? 0, parts, totals, criteriaMarksShown: approved };
    const committed = await db.transaction(async () => {
      const live = await sessionFromRequest(db, req);
      if (!live || live.account_id !== s.accountId) return { status: 401, code: 'AUTH_REQUIRED' };
      const blocker = consentBlockerCode(await consentState(db, s.accountId, { lock: true }));
      if (blocker) return { status: 403, code: blocker };
      const prior = await readRow(db, s.accountId, 'paper-result', s.id, submittedAt);
      if (prior) return { status: 200, result: prior, replay: true };
      // What was marked must still be what the sitting holds.
      const now2 = (await readRow(db, s.accountId, 'paper-answers', s.id, submittedAt)) || { answers: {} };
      if (digest(now2.answers) !== digest(s.saved.answers)) return { status: 409, code: 'PAPER_ANSWERS_CHANGED' };
      await db.run(UPSERT, [s.accountId, 'paper-result', s.id, JSON.stringify(result), digest(result), submittedAt, submittedAt + KEEP]);
      return { status: 200, result };
    }, { accountScope: s.accountId, lock: `paper-attempt:${s.accountId}` });
    if (committed.status !== 200) {
      return refuse(res, committed.status, committed.code, committed.code === 'PAPER_ANSWERS_CHANGED' ? 'Your answers changed while they were being checked. Submit again.' : 'Sign in again.');
    }
    s.result = committed.result;
    return res.json({ attempt: view(s), replay: !!committed.replay });
  });

  // ── After submitting: how it is marked, the sample answer ──────────────────
  router.get('/attempts/:attemptId/parts/:partId/solution', rateLimit(db, 'paper-solution', { limit: 1200, windowMs: 3600000 }), async (req, res) => {
    const s = await sitting(req, res);
    if (!s) return undefined;
    if (!s.result) return refuse(res, 409, 'PAPER_NOT_SUBMITTED', 'The sample answer is shown after you submit.');
    const entry = byId.get(s.sit.paperId);
    // The same entitlement as the PDFs: a sample is free, every other paper's guideline is Premium.
    if (entry?.sample !== true && !(await ctx.isPremium(s.accountId))) return premiumRefusal(res, capability);
    const leaf = scopedLeaves(s.doc, s.sit.scope).find(l => l.part.id === String(req.params.partId || ''));
    if (!leaf) return refuse(res, 404, 'PAPER_PART_NOT_FOUND', 'No such part in this sitting.');
    const { part } = leaf;
    const approved = schemeApproved(s.doc, approvalsNow());
    res.json({
      id: part.id, marks: part.marks,
      howMarked: howMarked(part, approved), criteriaMarksShown: approved,
      sampleAnswer: part.sampleAnswer || [],
      ...(part.markerNote ? { note: part.markerNote } : {}),
      ...(part.commonErrors ? { commonErrors: part.commonErrors } : {}),
      ...(part.key ? { finalAnswer: part.key.type === 'mcq' ? { letter: part.key.answer } : { tex: part.key.display || null } } : {})
    });
  });

  // ── Figures ────────────────────────────────────────────────────────────────
  router.get('/attempts/:attemptId/figures/:name', rateLimit(db, 'paper-figure', { limit: 3000, windowMs: 3600000 }), async (req, res) => {
    const s = await sitting(req, res);
    if (!s) return undefined;
    const name = String(req.params.name || '').replace(/\.svg$/, '');
    // Only a diagram this paper's own list names: the file name comes from the content, never the request.
    if (!FIG.test(name) || !s.doc.figures.includes(name)) return refuse(res, 404, 'PAPER_FIGURE_NOT_FOUND', 'No such diagram.');
    const file = join(dir, 'figures', s.doc.id, `${name}.svg`);
    if (!existsSync(file)) return refuse(res, 404, 'PAPER_FIGURE_NOT_FOUND', 'No such diagram.');
    res.set({ 'Content-Type': 'image/svg+xml; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox" });
    return res.send(readFileSync(file));
  });
}

/** Honest totals: what automatic marking could decide, what it did, and what is the student's to check. */
export function totalsOf(doc, leaves, parts) {
  const total = leaves.reduce((a, l) => a + l.part.marks, 0);
  let available = 0;
  let awarded = 0;
  let answered = 0;
  for (const { part } of leaves) {
    available += part.autoMarks || 0;
    awarded += parts[part.id]?.awarded || 0;
    if (parts[part.id]?.answered) answered += 1;
  }
  return { total, autoAvailable: available, autoAwarded: awarded, selfChecked: total - available, parts: leaves.length, answeredParts: answered, emptyParts: leaves.length - answered };
}
