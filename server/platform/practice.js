// Pri Learning — V1 authoritative online practice grading.
//
// No caller-supplied answer key, mark or question body is ever authoritative.
// The server regenerates and escrows its own canonical question, then commits
// a deterministic grade and its progress effect in one account-scoped
// transaction. A timeout after COMMIT is recovered with the same submission
// idempotency key, not a second attempt. No AI model decides correctness.
//
// Storage uses existing idempotency_keys and learning_events, requiring no
// unapproved production Postgres DDL. Old clients are not authorised to treat
// their offline grades as server grades. The client transport integration is
// a separate mandatory release gate.
import { createHash, randomInt, randomUUID } from 'node:crypto';
import { asyncRouter, asyncHandler } from './asyncRouter.js';
import { asStore } from './store.js';
import { nextSyncCursor, syncLockKey } from './db.js';
import { requireSession, requireVerifiedEmail, requireRole, rateLimit, sessionFromRequest } from './security.js';
import { encryptDeliveryToken, decryptDeliveryToken } from './deliveryCrypto.js';
import { opaqueContentId, opaqueContentHash, contentSeen, markContentSeen, contentTried, markContentTried } from './contentSeen.js';
import { misconceptionIdForTrap } from '../../client/src/engine/misconceptions.js';
import { PUBLIC_QUESTION_FIELDS } from '../../client/src/engine/publicQuestion.js';
import { consentState, consentBlockerCode } from './guardianConsent.js';
import { loadAllBanks, generateQuestion } from '../../client/src/engine/generators/index.js';
// The marker itself (checkAnswer, stepCheck, methodMarks) is never called on
// this thread: markerOps.js holds the operations and markerPool.js runs them in
// worker threads under a hard deadline. Only the two pure rubric helpers
// below, which read the server's own question and run no student text through
// the engine, are used directly here.
import { stepMetaFor, marksPossibleFor } from './markerOps.js';
import {
  markerPool, markerCooldownUntil, recordMarkerKills, sendMarkerCooldown, sendMarkerBusy,
  MARKING_TOO_COMPLEX, MARKING_BUSY, TOO_COMPLEX_MESSAGE, WORKING_NOT_READ_NOTE
} from './markerPool.js';
import { authoredRegion, formatRegion, formatMatrix, formatVector } from '../../client/src/engine/answer-forms.js';
import { transcribeHandwriting, validateImage, HandwritingProviderError } from './handwritingProvider.js';
import { recognitionOpsFor, sendRecognitionRefusal } from './recognitionOps.js';
import { timePhase } from './requestTiming.js';

const MAX_AGE = 90 * 24 * 60 * 60 * 1000;
const ID = /^[a-zA-Z0-9_-]{8,100}$/;
const UUID = /^[0-9a-f-]{36}$/i;
// Every authored generator the client can serve is issuable: with online-only
// grading a question the server refuses to issue could never be checked. The
// name is only a lookup key; an unknown one fails generation with 422.
const AUTHORED_BANK = /^[a-z][a-z0-9]{0,11}-[a-z0-9][a-z0-9-]{1,95}$/;
const ISSUE_FIELDS = new Set(['generator', 'difficulty', 'seed', 'curriculum', 'mode', 'prepared', 'avoid', 'trap', 'dotpoint', 'written', 'account']);
const PREPARE_FIELDS = new Set(['generator', 'difficulty', 'curriculum', 'mode', 'avoid', 'dotpoint']);
const PRACTICE_MODES = ['practice', 'review', 'task', 'rush', 'match', 'placement'];
// One answer settles the question in these modes.
const ONE_TRY_MODES = ['rush', 'match', 'placement'];
// The placement check is diagnostic evidence, not practice: its verdicts are
// the server's, but it writes no attempt, so it can never count as progress.
const recordsProgress = q => q._practiceMode !== 'placement';
// A prepared question is shown to a student who has not signed in yet. Its
// seed travels only inside an encrypted, expiring token that one account can
// bind once; the device never learns the seed and so cannot compute the answer
// from the bundled generators any faster than by solving the question.
const PREPARED_TTL = 12 * 60 * 60 * 1000;
const PREPARED_CONTEXT = 'practice-prepared-v1';
const SEEK_TRIES = 12;
const CONTENT_HASH = /^[a-zA-Z0-9:_-]{6,96}$/;
const DOTPOINT = /^[a-zA-Z0-9._:-]{1,80}$/;
// A caller-chosen seed makes a question predictable, so the product never
// sends one: the server picks it. Fixed seeds exist only for the test suites,
// which need the same question twice; they are honoured in NODE_ENV=test and
// nowhere else, and a suite can switch them off to exercise the real contract.
const fixedSeedsAllowed = env => env.NODE_ENV === 'test' && env.PRI_PRACTICE_SERVER_SEEDS_ONLY !== '1';
const GRADE_FIELDS = new Set(['submissionId', 'answer', 'mode', 'steps', 'transcriptionReceipt', 'ms']);
const RECOGNITION_FIELDS = new Set(['image', 'mode']);
const CORRECTION_FIELDS = new Set(['text']);
const PUBLIC_Q = PUBLIC_QUESTION_FIELDS;

const digest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const reject = (res, status, code, message) => res.status(status).json({ error: { code, message } });
const plain = value => !!value && typeof value === 'object' && !Array.isArray(value);
const unknown = (value, allowed) => Object.keys(value).filter(key => !allowed.has(key));
const limitedText = (s, n) => typeof s === 'string' && s.length <= n && !/[\u0000-\u0008\u000b\u000e-\u001f]/.test(s);
let banksReady;
const ensureBanks = () => { if (!banksReady) banksReady = loadAllBanks().catch(e => { banksReady = null; throw e; }); return banksReady; };

// ── What an open question may be told about its working ─────────────────────
// A practice question allows two tries. Until it resolves, the reply to a
// wrong try carries NOTHING derived from the answer key about the working:
// no step report, no first mistake, no diagnosis, no per-line marks, no method
// marks, and no feedback that depends on the lines. Any verdict on any line is
// a test of a candidate answer — `2t = 6` is right exactly when t is 3, and a
// ladder of `abs(t - c) = t - c` lines breaks one line after the answer — so
// no choice of which lines to judge is safe, and none is judged. The working
// is not even checked: it is checked, and its method marks are paid, by the
// reply that resolves the question (a correct answer or the second try).
// Nothing is lost by waiting; an unresolved try commits no mark.
const OPEN_WORKING = 'Your working is checked when this question is finished.';
const OPEN_FEEDBACK = {
  workingOnly: `There is no final answer here. ${OPEN_WORKING}`,
  working: OPEN_WORKING
};

// Working arrives as one text or as lines. Either way it is at most this many
// characters in all: the lines are checked inside the account's transaction,
// and an array of 100 lines of 1000 characters was 92 KB of polynomial to
// expand while every other request waited.
const MAX_WORKING_CHARS = 8000;
const MAX_WORKING_LINES = 100;
const MAX_WORKING_LINE_CHARS = 1000;
function acceptableWorking(steps) {
  if (steps === undefined || steps === null) return true;
  if (typeof steps === 'string') return limitedText(steps, MAX_WORKING_CHARS);
  if (!Array.isArray(steps) || steps.length > MAX_WORKING_LINES) return false;
  let total = Math.max(0, steps.length - 1);          // the line breaks that join them
  for (const line of steps) {
    if (!limitedText(line, MAX_WORKING_LINE_CHARS)) return false;
    total += line.length;
    if (total > MAX_WORKING_CHARS) return false;
  }
  return true;
}

// What a device may know a question by (`opaqueContentId`, `opaqueContentHash`)
// and what an account has already been shown the solution of or spent a try on
// (`contentSeen`, `contentTried`) have ONE definition, in contentSeen.js, shared
// with the examination router. A later copy of the same content — however it
// comes to be issued, and whatever order its options are dealt in — is a
// repeat once its solution has been shown: it is marked like any question, and
// its receipt and attempt say it is not new work.
//
// Tries follow the content too. A question allows two tries; were they counted
// per issued copy alone, each fresh copy of one question would be a free,
// unrecorded guess with feedback. So a try spent on any copy is spent on every
// copy of that content the account holds or is later issued, until the content
// resolves. `triesLeft: 1` on an issue response says so, so the card is honest
// about the copy it shows; a copy with both tries in hand says nothing.

function safeQuestion(id, q) {
  const publicQ = { id, supportsSteps: !!stepMetaFor(q),
    criteriaCount: marksPossibleFor(q) };
  for (const k of PUBLIC_Q) if (Object.hasOwn(q, k)) publicQ[k] = q[k];
  if ('contentId' in publicQ) publicQ.contentId = opaqueContentId(q.contentId);
  if ('contentHash' in publicQ) publicQ.contentHash = opaqueContentHash(q.contentHash);
  return publicQ;
}

// Release only after the server has committed a final resolution. This must
// never be present on an unresolved or newly issued public question.
function answerTextFor(q) {
  const a = q.answer || {};
  switch (q.answerType) {
    case 'mcq': return q.mcqOptions?.[a.correctIndex] ?? '';
    case 'numeric':
      if (a.canonicalInput) return a.canonicalInput;
      if (a.simplestFraction) return a.simplestFraction.n + '/' + a.simplestFraction.d;
      if (a.surdForm) return (a.surdForm.k === 1 ? '' : a.surdForm.k) + '√' + a.surdForm.r;
      return (q.answerPrefix ? q.answerPrefix + ' ' : '') + a.value + (q.answerSuffix ? ' ' + q.answerSuffix : '');
    case 'expression': return a.expr || '';
    case 'set': return Array.isArray(a.values) ? a.values.join(', ') : '';
    case 'point': return '(' + a.x + ', ' + a.y + ')';
    case 'ratio': return a.a + ' : ' + a.b;
    case 'working': return a.canonicalWorking || '';
    case 'interval': {
      const region = authoredRegion(a);
      return region ? formatRegion(region, a.variable || 'x') : (a.region || '');
    }
    case 'matrix': return Array.isArray(a.rows) ? formatMatrix(a.rows) : '';
    case 'vector': return Array.isArray(a.components) ? formatVector(a.components) : '';
    default: return '';
  }
}

function solutionFor(q) {
  const steps = q.steps || [];
  const marks = marksPossibleFor(q);
  const keySteps = steps.filter(s => !/^(check|note|bonus)/i.test(s.h)).slice(0, marks);
  const criteria = keySteps.length
    ? keySteps.map((step, i) => ({ mark: 1, text: i === keySteps.length - 1
      ? step.h + ' — leading to the correct answer' : step.h }))
    : [{ mark: 1, text: 'Correct final answer' }];
  return { steps, answerText: answerTextFor(q), criteria, solutionText: q.solutionText };
}

/**
 * Server-side tutor grounding for one issued question (server/platform/tutor.js).
 *
 * The escrowed question is read for THIS account only: another account's
 * question id is indistinguishable from an id that never existed (null). What
 * comes back never leaves the server — it is the material the tutor guard
 * checks a model's reply against, not a response body. `workEvidence` runs the
 * deterministic Step Check on the student's own lines, so the device's word
 * about which lines are verified is never trusted for an issued question.
 */
export async function issuedQuestionForTutor(db, accountId, questionId, now = Date.now()) {
  db = asStore(db);
  if (typeof questionId !== 'string' || !UUID.test(questionId)) return null;
  const sealed = await db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-question' AND key=? AND expires_at>?",
    [accountId, questionId, now]);
  if (!sealed) return null;
  let q;
  try { q = JSON.parse(sealed.response_json); } catch { return null; }
  const completed = await db.get("SELECT key FROM idempotency_keys WHERE account_id=? AND scope='practice-completion' AND key=?",
    [accountId, questionId]);
  return {
    resolved: !!completed,
    mode: q._practiceMode || 'practice',
    version: String(q.contentVersion || q.version || 1),
    prompt: String(q.prompt || ''),
    steps: (q.steps || []).map(step => ({ h: String(step?.h ?? ''), d: String(step?.d ?? '') })),
    answerText: String(answerTextFor(q) ?? ''),
    hints: Array.isArray(q.hints) ? q.hints.filter(h => typeof h === 'string') : [],
    // Runs in the marker pool, never on this thread. A Step Check that is cut
    // off at its deadline, refused because the pool is busy, or skipped
    // because the account is cooling down says nothing: no line is verified
    // and no line is the first mistake — "the checker's silence is not
    // evidence", exactly as when the engine threw.
    async workEvidence(lines) {
      const silent = { firstBreak: -1, verifiedLines: 0, misconception: null };
      if (!stepMetaFor(q) || !Array.isArray(lines) || !lines.length) return silent;
      if (await markerCooldownUntil(db, accountId)) return silent;
      let outcome;
      try { outcome = await markerPool().run('tutor', { q, lines }, { key: accountId }); } catch { return silent; }
      if (outcome.ok) return outcome.value.evidence;
      if (outcome.code === MARKING_TOO_COMPLEX) await recordMarkerKills(db, accountId);
      return silent;
    }
  };
}

// ── Authority where a mark commits ──────────────────────────────────────────
// Marking is awaited on another thread, between the request's own session
// check and the transaction that commits the mark. During that wait a student
// may sign out, a session may expire or be revoked, or a guardian may withdraw
// consent. The practice submission and the examination finish both read the
// consent state before marking (`consentBlockedNow`) and call
// `authorityAtCommit` first thing INSIDE the committing transaction: no live
// session of this account → 401; consent that was in place and is now blocked
// → 403. Either way nothing is written. (Consent that was already blocked
// before marking is not newly enforced here: these routes did not refuse on
// it before marking moved off the request thread, and still do not.)
export async function consentBlockedNow(db, accountId) {
  return consentBlockerCode(await consentState(asStore(db), accountId));
}
export async function authorityAtCommit(db, req, accountId, consentBlockedBefore) {
  db = asStore(db);
  const liveSession = await sessionFromRequest(db, req);
  if (!liveSession || liveSession.account_id !== accountId) {
    return { status: 401, code: 'AUTH_REQUIRED', message: 'Sign in again before retrying.' };
  }
  if (consentBlockedBefore) return null;
  // A concurrent PostgreSQL guardian withdrawal updates this exact row. Lock
  // it before the final consent check so it cannot commit between validation
  // and the mark. SQLite transactions already serialize writers.
  if (db.dialect === 'postgres') {
    await db.get('SELECT account_id FROM guardian_consents WHERE account_id=? FOR UPDATE', [accountId]);
  }
  const blocker = consentBlockerCode(await consentState(db, accountId));
  return blocker ? { status: 403, code: blocker, message: 'Guardian consent changed while this was being checked.' } : null;
}

const carriesTrap = (owner, q, key) => (Array.isArray(q?.traps) ? q.traps : [])
  .concat(Object.values(q?.answer?.optionTraps || {}).map(why => ({ why })))
  .some(t => t && misconceptionIdForTrap(owner, t.why) === key);

/** Validate what a client may ask for. Returns { error } or the cleaned request. */
function readQuestionRequest(body, fields) {
  if (!plain(body) || unknown(body, fields).length) {
    return { error: [400, 'PRACTICE_ISSUE_INVALID', 'Only an authored generator, difficulty and practice mode may be requested.'] };
  }
  const generator = typeof body.generator === 'string' ? body.generator : '';
  const difficulty = typeof body.difficulty === 'number' || typeof body.difficulty === 'string' ? Number(body.difficulty) : NaN;
  if (body.curriculum !== 'in' || !AUTHORED_BANK.test(generator) || !Number.isInteger(difficulty) || difficulty < 1 || difficulty > 4) {
    return { error: [400, 'PRACTICE_GENERATOR_INVALID', 'Choose an authored question and difficulty 1–4.'] };
  }
  const mode = body.mode ?? 'practice';
  if (!PRACTICE_MODES.includes(mode)) return { error: [400, 'PRACTICE_MODE_INVALID', 'Invalid practice mode.'] };
  const avoid = body.avoid === undefined ? [] : body.avoid;
  if (!Array.isArray(avoid) || avoid.length > 60 || !avoid.every(h => typeof h === 'string' && CONTENT_HASH.test(h))) {
    return { error: [400, 'PRACTICE_ISSUE_INVALID', 'Invalid recently-seen list.'] };
  }
  if (body.dotpoint !== undefined && (typeof body.dotpoint !== 'string' || !DOTPOINT.test(body.dotpoint))) {
    return { error: [400, 'PRACTICE_ISSUE_INVALID', 'Invalid dot point.'] };
  }
  let trap = null;
  if (body.trap !== undefined) {
    const t = body.trap;
    if (!plain(t) || unknown(t, new Set(['owner', 'key'])).length || !limitedText(t.owner, 120) || !limitedText(t.key, 200) || !t.owner || !t.key) {
      return { error: [400, 'PRACTICE_ISSUE_INVALID', 'Invalid misconception target.'] };
    }
    trap = { owner: t.owner, key: t.key };
  }
  if (body.written !== undefined && typeof body.written !== 'boolean') {
    return { error: [400, 'PRACTICE_ISSUE_INVALID', 'Invalid answer-form preference.'] };
  }
  return { generator, difficulty, mode, avoid: new Set(avoid), dotpoint: body.dotpoint, trap, written: body.written === true };
}

/**
 * The server picks the question: a fresh random seed, re-drawn a few times to
 * avoid content the student has just seen and, when a misconception is being
 * worked on, to find a form that can spring it. `seed` is given only by the
 * test suites. Throws when the generator has no such form.
 */
function chooseQuestion({ generator, difficulty, dotpoint, avoid, trap, written = false }, seed = null) {
  if (seed !== null) {
    const q = generateQuestion(generator, difficulty, seed, dotpoint);
    return { q, repeat: false, trapDelivered: !!(trap && carriesTrap(trap.owner, q, trap.key)) };
  }
  let fallback = null;
  for (let i = 0; i < SEEK_TRIES; i++) {
    const q = generateQuestion(generator, difficulty, randomInt(0x80000000), dotpoint);
    const fresh = !avoid.has(opaqueContentHash(q.contentHash));
    // `written` asks for a form the student writes out; a multiple-choice
    // item can be guessed, which a diagnostic must avoid where it can.
    const springs = (!trap || carriesTrap(trap.owner, q, trap.key)) && (!written || (q.answerType !== 'mcq' && !q.multipart));
    if (fresh && springs) return { q, repeat: false, trapDelivered: !!trap };
    if (!fallback || (fresh && !fallback.fresh)) fallback = { q, fresh };
  }
  return { q: fallback.q, repeat: !fallback.fresh, trapDelivered: !!(trap && carriesTrap(trap.owner, fallback.q, trap.key)) };
}

/**
 * Signed-out preparation. No account, no escrow row: the question a student
 * may start working on before signing in, and the sealed token that lets one
 * account turn it into an issued question later.
 */
export function createPracticePrepareRoute(db) {
  db = asStore(db);
  return [rateLimit(db, 'practice-prepare', { limit: 90, windowMs: 60 * 60 * 1000 }), asyncHandler(async (req, res) => {
    const request = readQuestionRequest(req.body, PREPARE_FIELDS);
    if (request.error) return reject(res, ...request.error);
    await ensureBanks();
    let chosen;
    try { chosen = chooseQuestion(request); }
    catch { return reject(res, 422, 'PRACTICE_CONTENT_UNSUPPORTED', 'The requested question form is unavailable.'); }
    const now = Date.now();
    let prepared;
    try {
      prepared = encryptDeliveryToken(JSON.stringify({
        g: request.generator, d: request.difficulty, s: chosen.q.seed, m: request.mode,
        ...(request.dotpoint ? { p: request.dotpoint } : {}), x: now + PREPARED_TTL, n: randomUUID()
      }), PREPARED_CONTEXT);
    } catch { return reject(res, 503, 'PRACTICE_PREPARE_UNAVAILABLE', 'Questions cannot be prepared right now.'); }
    const question = safeQuestion(null, chosen.q);
    delete question.id;
    res.set('Cache-Control', 'no-store');
    return res.status(200).json({ question, prepared, expiresAt: now + PREPARED_TTL, repeat: chosen.repeat });
  })];
}

function readPrepared(token) {
  if (typeof token !== 'string' || token.length > 2000) return null;
  try {
    const v = JSON.parse(decryptDeliveryToken(token, PREPARED_CONTEXT));
    if (!plain(v) || !AUTHORED_BANK.test(String(v.g)) || !Number.isInteger(v.d) || !Number.isSafeInteger(v.s) ||
        !PRACTICE_MODES.includes(v.m) || !Number.isFinite(v.x) || typeof v.n !== 'string' || !UUID.test(v.n)) return null;
    return v;
  } catch { return null; }
}

export function createPracticeRouter(db, { transcribe = transcribeHandwriting, env = process.env } = {}) {
  db = asStore(db);
  // Start the marker workers now, so the first submission does not wait for
  // them to import the engine.
  markerPool();
  const router = asyncRouter();
  router.use(requireSession(db), requireVerifiedEmail, requireRole('student'));

  router.post('/issue', rateLimit(db, 'practice-issue', { limit: 200, windowMs: 60 * 60 * 1000 }), async (req, res) => {
    const body = req.body;
    const accountId = req.platformSession.account_id;
    const now = Date.now();
    // A device holding several profiles names the account it means. A session
    // that belongs to another one is refused before anything is issued,
    // bound or escrowed, so one student's question can never land in, or use
    // up a prepared question for, another's account.
    // The account is named by its id as a string, exactly as the server gave
    // it; anything else (an array or number that merely prints the same) is
    // not that name.
    if (plain(body) && body.account !== undefined && (typeof body.account !== 'string' || body.account !== String(accountId))) {
      return reject(res, 409, 'PRACTICE_ACCOUNT_MISMATCH', 'This device is signed in to a different account.');
    }
    // A prepared question is bound once. The request that binds it must say
    // whose it is, so a shared device cannot spend it under the wrong account.
    if (plain(body) && body.prepared !== undefined && body.account === undefined) {
      return reject(res, 400, 'PRACTICE_ISSUE_INVALID', 'A prepared question names the account it is for.');
    }
    await ensureBanks();
    let q, practiceMode, repeat = false, trapDelivered = false, preparedNonce = null, preparedExpiry = 0, seedGiven = false;
    if (plain(body) && body.prepared !== undefined) {
      // Binding a question the student started signed out. Nothing else in the
      // body is honoured: the sealed token is the whole request.
      if (unknown(body, new Set(['prepared', 'account'])).length) {
        return reject(res, 400, 'PRACTICE_ISSUE_INVALID', 'A prepared question is bound on its own.');
      }
      const sealed = readPrepared(body.prepared);
      if (!sealed) return reject(res, 400, 'PRACTICE_PREPARED_INVALID', 'This prepared question is not valid.');
      if (sealed.x < now) return reject(res, 410, 'PRACTICE_PREPARED_EXPIRED', 'This prepared question has expired.');
      try { q = generateQuestion(sealed.g, sealed.d, sealed.s, sealed.p); }
      catch { return reject(res, 422, 'PRACTICE_CONTENT_UNSUPPORTED', 'The requested question form is unavailable.'); }
      practiceMode = sealed.m;
      preparedNonce = sealed.n;
      preparedExpiry = sealed.x;
    } else {
      const request = readQuestionRequest(body, ISSUE_FIELDS);
      if (request.error) return reject(res, ...request.error);
      let seed = null;
      if (body.seed !== undefined) {
        if (!fixedSeedsAllowed(env)) return reject(res, 400, 'PRACTICE_SEED_NOT_ALLOWED', 'The server chooses the question.');
        seed = typeof body.seed === 'number' || typeof body.seed === 'string' ? Number(body.seed) : NaN;
        if (!Number.isSafeInteger(seed) || seed < 0 || seed >= 0x80000000) {
          return reject(res, 400, 'PRACTICE_SEED_INVALID', 'Invalid question seed.');
        }
        seedGiven = true;
      }
      try { ({ q, repeat, trapDelivered } = chooseQuestion(request, seed)); }
      catch { return reject(res, 422, 'PRACTICE_CONTENT_UNSUPPORTED', 'The requested question form is unavailable.'); }
      practiceMode = request.mode;
    }
    // Optional issue idempotency: normal practice may request a fresh question;
    // network retries can opt into the same server question with a stable key.
    const idem = String(req.get('idempotency-key') || '');
    if (idem && !ID.test(idem)) return reject(res, 400, 'IDEMPOTENCY_INVALID', 'Invalid issuance idempotency key.');
    const requestDigest = digest({ generator: q.subtopic, difficulty: q.difficulty, seed: seedGiven ? q.seed : null, prepared: preparedNonce, curriculum: 'in', mode: practiceMode });
    // The issuance mode is escrowed with the answer. A later submission cannot
    // falsely claim or downgrade the one-try Rush/Match policy.
    q._practiceMode = practiceMode;
    // Sealed with the question, so the receipt and the attempt carry it
    // whatever the device does or does not send.
    if (await contentSeen(db, accountId, q, now)) { q._repeat = true; repeat = true; }
    // A try already spent on another copy of this content is spent on this one
    // (decided again, authoritatively, when it is marked). Content that has
    // resolved is a repeat and starts over with both tries: it earns nothing.
    const trySpent = !repeat && !ONE_TRY_MODES.includes(practiceMode) && await contentTried(db, accountId, q, now);
    // Serialize once: nothing client-provided can replace the stored answer.
    const payload = JSON.stringify(q);
    const id = randomUUID();
    const publicResponse = { question: safeQuestion(id, q), ...(repeat ? { repeat: true } : {}), ...(trySpent ? { triesLeft: 1 } : {}), ...(trapDelivered ? { trapDelivered: true } : {}) };
    const response = await db.transaction(async () => {
      if (preparedNonce) {
        // One account, once — decided in the same transaction as the issue it
        // allows, so a failed issue never burns the token and a retry by the
        // same account (a lost reply, a double tap) gets the same issue back.
        const mine = await db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-prepared' AND key=? AND expires_at>?",
          [accountId, preparedNonce, now]);
        if (mine) return JSON.parse(mine.response_json);
        const claim = await db.run("INSERT INTO rate_limits(bucket, window_start, count) VALUES (?, ?, 1) ON CONFLICT(bucket) DO NOTHING",
          ['practice-prepared-claim:' + preparedNonce, now]);
        if (!claim?.changes) return { preparedUsed: true };
      }
      if (idem) {
        const before = await db.get("SELECT response_json,request_digest FROM idempotency_keys WHERE account_id=? AND scope='practice-issue' AND key=? AND expires_at>?", [accountId, idem, now]);
        if (before) {
          if (before.request_digest !== requestDigest) return { conflict: true };
          return JSON.parse(before.response_json);
        }
      }
      await db.run("INSERT INTO idempotency_keys(account_id,scope,key,response_json,request_digest,created_at,expires_at) VALUES (?,'practice-question',?,?,?,?,?)",
        [accountId, id, payload, digest(payload), now, now + MAX_AGE]);
      if (idem) await db.run("INSERT INTO idempotency_keys(account_id,scope,key,response_json,request_digest,created_at,expires_at) VALUES (?,'practice-issue',?,?,?,?,?)",
        [accountId, idem, JSON.stringify(publicResponse), requestDigest, now, now + MAX_AGE]);
      if (preparedNonce) await db.run("INSERT INTO idempotency_keys(account_id,scope,key,response_json,request_digest,created_at,expires_at) VALUES (?,'practice-prepared',?,?,?,?,?)",
        [accountId, preparedNonce, JSON.stringify(publicResponse), requestDigest, now, Math.max(preparedExpiry, now) + PREPARED_TTL]);
      return publicResponse;
    }, { accountScope: accountId, lock: 'practice-issue:' + accountId });
    if (response.conflict) return reject(res, 409, 'IDEMPOTENCY_KEY_REUSED', 'This key already issued a different question.');
    if (response.preparedUsed) return reject(res, 409, 'PRACTICE_PREPARED_USED', 'This prepared question has already been taken up.');
    // The account that owns this issue, so a device holding several profiles
    // can refuse a question issued under another profile's session.
    return res.status(201).json({ ...response, accountId: String(accountId) });
  });

  // "The same question again" from History. The account has already been shown
  // this question's solution, so the copy is marked as a repeat: it is checked
  // by the server like any other, and its attempt is recorded as a repeat so
  // it can never be counted as new credit.
  router.post('/:id/repeat', rateLimit(db, 'practice-repeat', { limit: 120, windowMs: 60 * 60 * 1000 }), async (req, res) => {
    const qid = req.params.id;
    if (!UUID.test(qid)) return reject(res, 404, 'QUESTION_NOT_FOUND', 'This question does not belong to this account.');
    if (req.body !== undefined && (!plain(req.body) || Object.keys(req.body).length)) {
      return reject(res, 400, 'PRACTICE_ISSUE_INVALID', 'A repeat takes no parameters.');
    }
    const accountId = req.platformSession.account_id;
    const now = Date.now();
    const sealed = await db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-question' AND key=? AND expires_at>?", [accountId, qid, now]);
    if (!sealed) return reject(res, 404, 'QUESTION_NOT_FOUND', 'This question does not belong to this account.');
    const done = await db.get("SELECT key FROM idempotency_keys WHERE account_id=? AND scope='practice-completion' AND key=?", [accountId, qid]);
    if (!done) return reject(res, 409, 'QUESTION_NOT_RESOLVED', 'Finish this question before repeating it.');
    const q = JSON.parse(sealed.response_json);
    q._practiceMode = 'practice';
    q._repeat = true;
    const payload = JSON.stringify(q);
    const id = randomUUID();
    await db.run("INSERT INTO idempotency_keys(account_id,scope,key,response_json,request_digest,created_at,expires_at) VALUES (?,'practice-question',?,?,?,?,?)",
      [accountId, id, payload, digest(payload), now, now + MAX_AGE]);
    return res.status(201).json({ question: safeQuestion(id, q), repeat: true, accountId: String(accountId) });
  });

  // Recognition is issued by this server only after a live provider response.
  // We send image data alone to the reader: no question, solution or answer key.
  // The token is an opaque reference to a per-account, per-question DB record.
  router.post('/:id/recognize', rateLimit(db, 'practice-recognize', { limit: 120, windowMs: 60 * 60 * 1000 }), async (req, res) => {
    const qid = String(req.params.id || '');
    const body = req.body;
    if (!UUID.test(qid) || !plain(body) || unknown(body, RECOGNITION_FIELDS).length ||
        !['ink', 'photo'].includes(body.mode) || typeof body.image !== 'string') {
      return reject(res, 400, 'RECOGNITION_INVALID', 'Send only an ink/photo image and its input mode.');
    }
    const accountId = req.platformSession.account_id;
    const now = Date.now();
    const sealed = await db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-question' AND key=? AND expires_at>?", [accountId, qid, now]);
    if (!sealed) return reject(res, 404, 'QUESTION_NOT_FOUND', 'This question does not belong to this account.');
    const complete = await db.get("SELECT key FROM idempotency_keys WHERE account_id=? AND scope='practice-completion' AND key=?", [accountId, qid]);
    if (complete) return reject(res, 409, 'QUESTION_ALREADY_GRADED', 'This question has been completed.');
    try { validateImage(body.image); }
    catch (error) { return reject(res, error.status || 400, error.code || 'RECOGNITION_IMAGE_INVALID', error.message || 'Invalid image.'); }

    // One paid read per picture (recognitionOps.js). A transcript this account
    // already paid for through /handwriting/transcribe — or a read of the same
    // picture still in flight — is reused, so showing the transcript and
    // minting this receipt cost one provider call. Only the read is shared:
    // every authority check above and at commitment below still runs here.
    let result;
    let reused = false;
    try {
      const read = await recognitionOpsFor(db).read({ db, accountId, image: body.image, env, transcribe, requestId: req.requestId });
      if (read.refusal) return sendRecognitionRefusal(res, read.refusal);
      ({ result, reused } = read);
    } catch (error) {
      if (error instanceof HandwritingProviderError) return reject(res, error.status, error.code, error.message);
      return reject(res, 502, 'RECOGNITION_FAILED', 'The answer could not be read this time.');
    }
    const text = String(result?.text || '');
    if (!text || !limitedText(text, 12000)) {
      return reject(res, 422, 'RECOGNITION_EMPTY', 'No reliable answer transcription was returned.');
    }
    const receipt = randomUUID();
    const acknowledgedAt = Date.now();
    const evidence = { questionId: qid, mode: body.mode, text, recognizedAt: acknowledgedAt,
      providerNeedsConfirmation: result.needsConfirmation === true };
    const committed = await timePhase('commit', () => db.transaction(async () => {
      // The provider runs outside the transaction. During that wait a student
      // may sign out, a session may expire, or a guardian may withdraw consent.
      // The initial middleware gate is no longer sufficient authority to
      // persist new student evidence: recheck at the point of commitment.
      const liveSession = await sessionFromRequest(db, req);
      if (!liveSession || liveSession.account_id !== accountId) {
        return { status: 401, code: 'AUTH_REQUIRED' };
      }
      // A concurrent PostgreSQL guardian withdrawal updates this exact row.
      // Lock it before the final consent check so it cannot commit between
      // validation and the recognition receipt. SQLite transactions already
      // serialize writers for this commit.
      if (db.dialect === 'postgres') {
        await db.get('SELECT account_id FROM guardian_consents WHERE account_id=? FOR UPDATE', [accountId]);
      }
      const blocker = consentBlockerCode(await consentState(db, accountId));
      if (blocker) return { status: 403, code: blocker };
      const stillOpen = await db.get("SELECT key FROM idempotency_keys WHERE account_id=? AND scope='practice-completion' AND key=?", [accountId, qid]);
      if (stillOpen) return { status: 409, code: 'QUESTION_ALREADY_GRADED' };
      await db.run("INSERT INTO idempotency_keys(account_id,scope,key,response_json,request_digest,created_at,expires_at) VALUES (?,'practice-recognition',?,?,?,?,?)",
        [accountId, receipt, JSON.stringify(evidence), digest(evidence), acknowledgedAt, acknowledgedAt + MAX_AGE]);
      return { status: 201 };
    }, { accountScope: accountId, lock: syncLockKey(accountId) }));
    if (committed.status !== 201) return reject(res, committed.status, committed.code,
      committed.status === 403 ? 'Guardian consent changed while this answer was being read.' :
      committed.status === 401 ? 'Sign in again before retrying recognition.' : 'This question has been completed.');
    return res.status(201).json({ receipt, questionId: qid, mode: body.mode, reused,
      transcription: { text, lines: result.lines || [], confidence: result.confidence ?? null,
        needsConfirmation: result.needsConfirmation === true } });
  });

  // A learner may correct a recognition error explicitly. A new server receipt
  // preserves the original provider evidence and records the human correction.
  router.post('/:id/recognition/:receipt/confirm', rateLimit(db, 'practice-correction', { limit: 200, windowMs: 60 * 60 * 1000 }), async (req, res) => {
    const qid = String(req.params.id || '');
    const sourceId = String(req.params.receipt || '');
    const body = req.body;
    if (!UUID.test(qid) || !UUID.test(sourceId) || !plain(body) ||
        unknown(body, CORRECTION_FIELDS).length || !limitedText(body.text, 12000) || !body.text.trim()) {
      return reject(res, 400, 'RECOGNITION_CORRECTION_INVALID', 'Provide corrected text for a valid server receipt.');
    }
    const accountId = req.platformSession.account_id;
    const now = Date.now();
    // A correction and a final mark must serialize under the same account
    // lock. Checking completion before the transaction leaves a race where a
    // correction can be written after the last grade commits.
    const outcome = await timePhase('commit', () => db.transaction(async () => {
      const prior = await db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-recognition' AND key=? AND expires_at>?", [accountId, sourceId, now]);
      if (!prior) return { status: 404, code: 'RECOGNITION_RECEIPT_INVALID' };
      const original = JSON.parse(prior.response_json);
      if (original.questionId !== qid || !['ink', 'photo'].includes(original.mode)) {
        return { status: 404, code: 'RECOGNITION_RECEIPT_INVALID' };
      }
      const completed = await db.get("SELECT key FROM idempotency_keys WHERE account_id=? AND scope='practice-completion' AND key=?", [accountId, qid]);
      if (completed) return { status: 409, code: 'QUESTION_ALREADY_GRADED' };
      const receipt = randomUUID();
      const proof = { questionId: qid, mode: original.mode, text: body.text,
        parentReceipt: sourceId, correctedByStudent: true, recognizedAt: now };
      await db.run("INSERT INTO idempotency_keys(account_id,scope,key,response_json,request_digest,created_at,expires_at) VALUES (?,'practice-recognition',?,?,?,?,?)",
        [accountId, receipt, JSON.stringify(proof), digest(proof), now, now + MAX_AGE]);
      return { receipt, mode: original.mode };
    }, { accountScope: accountId, lock: syncLockKey(accountId) }));
    if (outcome.status) return reject(res, outcome.status, outcome.code,
      outcome.status === 409 ? 'This question has been completed.' : 'The recognition receipt is not available for this question.');
    return res.status(201).json({ receipt: outcome.receipt, questionId: qid, mode: outcome.mode, corrected: true });
  });

  router.post('/:id/reveal', rateLimit(db, 'practice-reveal', { limit: 120, windowMs: 3600000 }), async (req, res) => {
    const qid = String(req.params.id || '');
    if (!UUID.test(qid) || !plain(req.body ?? {}) || Object.keys(req.body ?? {}).length)
      return reject(res, 400, 'PRACTICE_REVEAL_INVALID', 'Invalid question reveal request.');
    const accountId = req.platformSession.account_id;
    const now = Date.now();
    const result = await db.transaction(async () => {
      const prior = await db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-reveal' AND key=? AND expires_at>?", [accountId, qid, now]);
      if (prior) return { response: JSON.parse(prior.response_json) };
      const escrow = await db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-question' AND key=? AND expires_at>?", [accountId, qid, now]);
      if (!escrow) return { status: 404, code: 'QUESTION_NOT_FOUND' };
      const completed = await db.get("SELECT key FROM idempotency_keys WHERE account_id=? AND scope='practice-completion' AND key=?", [accountId, qid]);
      if (completed) return { status: 409, code: 'QUESTION_ALREADY_GRADED' };
      const q = JSON.parse(escrow.response_json);
      // Decided now, not only at issue: copies issued before the first of them
      // was resolved are repeats the moment its solution has been shown.
      if (await contentSeen(db, accountId, q, now)) q._repeat = true;
      await markContentSeen(db, accountId, q, now);
      const attemptId = randomUUID();
      const response = { authoritative: true, revealed: true, resolved: true, correct: false,
        marksEarned: 0, marksPossible: marksPossibleFor(q),
        questionId: qid, attemptId, serverAcknowledgedAt: now, solution: solutionFor(q),
        ...(q._repeat === true ? { repeat: true } : {}) };
      const hash = digest({ qid, operation: 'reveal' });
      for (const [scope, value] of [['practice-reveal', response], ['practice-completion', { attemptId, revealed: true }]]) {
        await db.run("INSERT INTO idempotency_keys(account_id,scope,key,response_json,request_digest,created_at,expires_at) VALUES (?,?,?,?,?,?,?)",
          [accountId, scope, qid, JSON.stringify(value), hash, now, now + MAX_AGE]);
      }
      if (!recordsProgress(q)) return { response };
      const last = await db.get("SELECT MAX(device_seq) AS n FROM learning_events WHERE account_id=? AND device_id='server-grader'", [accountId]);
      const cursor = await nextSyncCursor(db, accountId);
      await db.run("INSERT INTO learning_events(server_cursor,id,account_id,device_id,device_seq,kind,entity_id,occurred_at,payload_json,created_at) VALUES (?,?,?, 'server-grader',?,'graded-attempt',?,?,?,?)",
        [cursor, attemptId, accountId, Number(last?.n || 0) + 1, qid, now, JSON.stringify({ attemptId, questionId: qid, correct: false,
          revealed: true, marksEarned: 0, marksPossible: response.marksPossible,
          ...(q._repeat === true ? { repeat: true } : {}),
          contentId: opaqueContentId(q.contentId),
          subtopic: q.subtopic || null, difficulty: Number(q.difficulty) || 2,
          mode: q._practiceMode || 'practice', hintsUsed: 1, support: 'supported',
          createdAt: now, serverAcknowledgedAt: now }), now]);
      return { response };
    }, { accountScope: accountId, lock: syncLockKey(accountId) });
    if (result.status) return reject(res, result.status, result.code, 'The question is unavailable or already resolved.');
    return res.status(200).json(result.response);
  });

  router.post('/:id/submit', rateLimit(db, 'practice-grade', { limit: 300, windowMs: 60 * 60 * 1000 }), async (req, res) => {
    const body = req.body;
    const qid = String(req.params.id || '');
    if (!UUID.test(qid) || !plain(body) || unknown(body, GRADE_FIELDS).length) {
      return reject(res, 400, 'PRACTICE_SUBMISSION_INVALID', 'A server-issued question and allowed answer fields are required.');
    }
    const submissionId = typeof body.submissionId === 'string' ? body.submissionId : '';
    const mode = body.mode ?? 'typed';
    if (!ID.test(submissionId) || !['typed', 'ink', 'photo'].includes(mode) ||
        !limitedText(body.answer, 12000) ||
        !acceptableWorking(body.steps)) {
      return reject(res, 400, 'PRACTICE_SUBMISSION_INVALID', 'Supply a valid stable submission key and limited mathematical working.');
    }
    if (req.get('idempotency-key') && req.get('idempotency-key') !== submissionId) {
      return reject(res, 400, 'IDEMPOTENCY_KEY_MISMATCH', 'The header and submission key must agree.');
    }
    if (body.ms !== undefined && (!Number.isSafeInteger(body.ms) || body.ms < 0 || body.ms > 86_400_000)) {
      return reject(res, 400, 'PRACTICE_SUBMISSION_INVALID', 'Invalid answer duration.');
    }
    const accountId = req.platformSession.account_id;
    const hash = digest({ qid, submissionId, answer: body.answer, mode, steps: body.steps ?? [], transcriptionReceipt: body.transcriptionReceipt || null, ms: body.ms ?? null });
    const now = Date.now();
    const idKey = qid + ':' + submissionId;
    const working = Array.isArray(body.steps) ? body.steps.join('\n') : String(body.steps || '');

    // ── Mark first, with no transaction open; then commit under the lock ────
    // The marker runs in a worker thread (markerPool.js) and is awaited, so it
    // cannot run inside the account's transaction: on SQLite one connection
    // serves every request, and an open transaction held across an await lets
    // other requests' statements into it. So a submission is three steps:
    //
    //   1. READ, outside any transaction, everything that says whether this
    //      submission may be marked at all and what it would need (`gate`).
    //   2. MARK in the pool: a pure function of the sealed question, the answer
    //      and the working. Nothing is written.
    //   3. COMMIT in the account's transaction under its lock — and there
    //      `gate` is read AGAIN from scratch. Every decision the transaction
    //      makes (replay, 409, 404, receipt, closed question, repeat, tries,
    //      resolution) is made from that second, locked read, exactly as it
    //      was before marking moved out; step 1 is only a forecast. If the
    //      state moved in between so that the commit needs something step 2
    //      did not compute, nothing is written and the steps run again.
    //
    // So two submissions racing on one question are still ordered by the
    // lock: the second sees the first's try (or its completion) in its own
    // locked read and can never also be accepted as the first try.
    const gate = async () => {
      // Replay comes before the closed-question check: the reply to a request
      // that committed before a timeout remains available for safe recovery.
      const prior = await db.get("SELECT response_json,request_digest FROM idempotency_keys WHERE account_id=? AND scope='practice-grade' AND key=? AND expires_at>?",
        [accountId, idKey, now]);
      if (prior) return prior.request_digest === hash ? { response: JSON.parse(prior.response_json) } : { status: 409, code: 'IDEMPOTENCY_KEY_REUSED' };

      const sealed = await db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-question' AND key=? AND expires_at>?",
        [accountId, qid, now]);
      if (!sealed) return { status: 404, code: 'QUESTION_NOT_FOUND' };

      if (mode !== 'typed') {
        const token = typeof body.transcriptionReceipt === 'string' ? body.transcriptionReceipt : '';
        if (!ID.test(token)) return { status: 422, code: 'RECOGNITION_RECEIPT_REQUIRED' };
        const evidence = await db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-recognition' AND key=? AND expires_at>?",
          [accountId, token, now]);
        if (!evidence) return { status: 422, code: 'RECOGNITION_RECEIPT_INVALID' };
        const proof = JSON.parse(evidence.response_json);
        if (proof.mode !== mode || proof.text !== body.answer || proof.questionId !== qid) {
          return { status: 422, code: 'RECOGNITION_RECEIPT_MISMATCH' };
        }
        if (proof.providerNeedsConfirmation === true) return { status: 422, code: 'RECOGNITION_CONFIRMATION_REQUIRED' };
      }
      const complete = await db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-completion' AND key=?",
        [accountId, qid]);
      if (complete) return { status: 409, code: 'QUESTION_ALREADY_GRADED' };

      const q = JSON.parse(sealed.response_json);
      // Decided now, not only at issue: several copies of one question can be
      // issued before any is resolved, and once one of them has shown its
      // solution the others are no longer new work.
      if (await contentSeen(db, accountId, q, now)) q._repeat = true;
      const priorTry = await db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-tries' AND key=?",
        [accountId, qid]);
      const tries = priorTry ? Number(JSON.parse(priorTry.response_json).tries) || 0 : 0;
      // A try spent on ANY copy of this content is spent on this one: the
      // first try is not renewed by asking for the question again. Content
      // already resolved is a repeat, which earns nothing and keeps its own
      // two tries.
      const spent = tries >= 1 || (q._repeat !== true && await contentTried(db, accountId, q, now));
      return { sealedJson: sealed.response_json, q, priorTry, tries, spent };
    };
    const refuse = outcome => reject(res, outcome.status, outcome.code,
      outcome.code === 'QUESTION_NOT_FOUND' ? 'This question does not belong to this account.'
        : outcome.code === 'AUTH_REQUIRED' ? 'Sign in again before retrying this answer.'
          : outcome.status === 403 ? 'Guardian consent changed while this answer was being checked.'
            : 'The submission cannot be accepted.');

    // Evidence the commit turned out to need although step 1 forecast it would
    // not (another submission spent the first try meanwhile).
    let evidenceForced = false;
    for (let round = 0; round < 3; round++) {
      // ── 1. Read ──────────────────────────────────────────────────────────
      const forecast = await gate();
      if (forecast.status) return refuse(forecast);
      if (forecast.response) return res.status(200).json(forecast.response);
      // An account that has just had several entries stopped at the deadline
      // waits (markerPool.js MARKER_COOLDOWN). A committed receipt is replayed
      // above regardless: recovering a reply costs no marking.
      const [cooling, consentBlockedBefore] = await Promise.all([markerCooldownUntil(db, accountId), consentBlockedNow(db, accountId)]);
      if (cooling) return sendMarkerCooldown(res, cooling);

      // ── 2. Mark ──────────────────────────────────────────────────────────
      // One round trip: the answer, and the working only when the reply could
      // use it (the answer is right, or a wrong answer resolves the question).
      const marked = await timePhase('marker', () => markerPool().run('practice', {
        q: forecast.q, answer: body.answer, working,
        evidenceIfWrong: evidenceForced || forecast.spent || ONE_TRY_MODES.includes(forecast.q._practiceMode)
      }, { key: accountId }));
      // Refused before it ran: nothing marked, nothing spent, same key retries.
      if (!marked.ok && marked.code === MARKING_BUSY) return sendMarkerBusy(res);
      let result, evidence, workingNotRead = false;
      if (marked.ok) ({ result, evidence } = marked.value);
      else {
        // MARKING_TOO_COMPLEX: the worker was stopped at its deadline (or
        // died). What it had finished before that is a complete result of the
        // same deterministic code; what it had not finished is unknown, and
        // unknown is never turned into a verdict.
        await recordMarkerKills(db, accountId);
        const answered = marked.partials.find(part => part?.result)?.result;
        // RULE (answer not marked in time) — the entry is UNREADABLE. Exactly
        // like an entry the marker cannot parse: 200, invalid, no try spent,
        // no marks, no step report, nothing about the key — and nothing is
        // written, not even a receipt, so it is no attempt of any kind. (The
        // reply has the shape of every grade reply, `attemptId` included,
        // because the shipped client refuses a reply without one; as for any
        // unreadable entry, that id names no recorded attempt.)
        // RULE (blank answer, working not read in time) — the working WAS the
        // whole entry, so there is no verdict to stand on: unreadable too. It
        // is never recorded as a working-only attempt that earned nothing.
        if (!answered || (answered.invalid === true && body.answer.trim() === '')) {
          return res.status(200).json({ authoritative: true, questionId: qid, submissionId, attemptId: randomUUID(),
            correct: false, invalid: true, resolved: false, tooComplex: true, code: MARKING_TOO_COMPLEX,
            marksEarned: 0, marksPossible: marksPossibleFor(forecast.q),
            triesLeft: 1, feedback: TOO_COMPLEX_MESSAGE, trapWhy: null,
            contentId: opaqueContentId(forecast.q.contentId), serverAcknowledgedAt: now,
            stepReport: null, partial: null });
        }
        // RULE (answer marked in time, working not) — the answer's verdict
        // stands; the working is reported as NOT READ and earns nothing. A
        // right answer has its full marks whatever the working says, so it
        // loses nothing; a wrong answer gets no method marks from lines nobody
        // read. This mirrors what the engine itself does with a line too long
        // to check, and it cannot be used to test an answer for free: the
        // reply depends on the working's cost, never on whether the answer is
        // right, and the try is spent exactly as it would have been.
        result = answered;
        evidence = { stepReport: result.stepReport || null, partial: null };
        workingNotRead = true;
      }

      // ── 3. Commit ────────────────────────────────────────────────────────
      const outcome = await timePhase('commit', () => db.transaction(async () => {
        // Marking took time on another thread. A student may have signed out,
        // the session may have expired, or a guardian may have withdrawn
        // consent meanwhile: authority is rechecked where the grade commits.
        const refused = await authorityAtCommit(db, req, accountId, consentBlockedBefore);
        if (refused) return refused;
        // The authoritative read. Whatever it finds decides; the forecast is
        // not consulted except to notice that the marked question changed.
        const state = await gate();
        if (state.status || state.response) return state;
        if (state.sealedJson !== forecast.sealedJson) return { again: true };
        const { q, priorTry, tries, spent } = state;
      // Only after submission may authored misconception feedback be revealed.
      // Never trust a caller-supplied explanation or make the device infer
      // correctness from a withheld canonical answer.
      const trapProbes = [
        ...(Array.isArray(q.traps) ? q.traps : []),
        ...Object.values(q.answer?.optionTraps || {}).map(why => ({ why }))
      ];
      const optionWhy = !result.correct && q.answerType === 'mcq'
        ? q.answer?.optionTraps?.[Number(body.answer)] : null;
      const marksPossible = marksPossibleFor(q);
      // Working sent without a final answer is an attempt whether or not its
      // lines are right, and spends a try either way. Were only true working
      // an attempt, a false line would be refused for free and each refusal
      // would say "this step is wrong" — an unlimited check of every guess.
      const workingOnly = result.invalid === true && body.answer.trim() === '' && working.trim() !== '';
      const invalid = Boolean(result.invalid && !workingOnly);
      // Invalid input is not a failed mathematical attempt: do not consume a try or close the question.
      const resolved = !invalid && Boolean(result.correct || spent || ONE_TRY_MODES.includes(q._practiceMode));
      // The working is checked once, and only by the reply that resolves the
      // question — see "What an open question may be told about its working".
      // It was computed in step 2; if this locked read resolves a question the
      // forecast did not expect to resolve, it is computed now and the commit
      // is retried — never guessed, and never skipped.
      if (resolved && !evidence) return { again: true, needEvidence: true };
      const { stepReport, partial } = resolved ? evidence : { stepReport: null, partial: null };
      const notRead = resolved && workingNotRead && working.trim() !== '';
      // A question answered BY its working (the answer is the lines) has a
      // marker's verdict that is itself a verdict on the lines.
      const answeredByWorking = q.answerType === 'working' || Boolean(result.stepReport);
      const answerFeedback = String(optionWhy || result.feedback || '').slice(0, 3000);
      const ownTrap = !result.correct
        ? trapProbes.find(t => t?.why && String(t.why) === answerFeedback)?.why || null : null;
      // What the marker says about a wrong answer is information about the
      // right one. An authored trap for a typed value can state the answer
      // outright ("… so the least value is 16"); so can "there are 7 solutions
      // — you've given 1" or "that is the transpose"; and the explanation of a
      // wrong multiple-choice option can name the keyed one ("… a polynomial
      // of degree 1 is called linear") or pick it out without naming it ("the
      // direction is right but the sign of the boundary is not"). No filter
      // on the wording can be trusted with that. So while the question is
      // open, for every answer type, the reply says only that the try was
      // wrong: nothing the marker derived from the key, and no misconception.
      // The explanation is kept with the try and comes back with the reply
      // that resolves the question.
      const feedback = resolved || invalid
        ? answerFeedback
        : workingOnly ? OPEN_FEEDBACK.workingOnly
          : working.trim() || answeredByWorking ? OPEN_FEEDBACK.working : '';
      const deferredTrap = priorTry ? JSON.parse(priorTry.response_json).trapWhy || null : null;
      // On resolution: this answer's own trap, or — when this answer is wrong
      // and names none — the first try's. `firstTryTrapWhy` carries the first
      // try's trap whatever this answer was, so a misconception shown on the
      // first try is not lost when the second try is right.
      const trapWhy = !resolved || result.correct ? null : ownTrap || deferredTrap;
      // Blank final answers are not automatically attempts: verified positive
      // method evidence alone makes an otherwise blank response gradable.
      // Unreadable working or an invalid NONBLANK answer still cannot earn
      // marks. This prevents rewarding a mere copy of the question.
      const workingOnlyCredit = workingOnly && Number.isInteger(partial?.awarded) && partial.awarded > 0;
      const marksEarned = invalid ? 0 : result.correct
        ? marksPossible
        : Math.max(0, Math.min(marksPossible - 1, partial?.awarded ?? 0));
      const said = !resolved ? feedback : workingOnlyCredit ? partial.note : workingOnly ? (partial?.note || 'There is no final answer here, and this working does not earn a mark.') : feedback;
      const attemptId = randomUUID();
      const response = { authoritative: true, questionId: qid, submissionId, attemptId,
        correct: result.correct === true, invalid, resolved,
        marksEarned, marksPossible,
        triesLeft: resolved ? 0 : 1,
        feedback: said + (notRead ? (said ? ' ' : '') + WORKING_NOT_READ_NOTE : ''), trapWhy,
        ...(notRead ? { workingNotRead: true } : {}),
        ...(resolved && deferredTrap ? { firstTryTrapWhy: deferredTrap } : {}),
        contentId: opaqueContentId(q.contentId), serverAcknowledgedAt: now,
        ...(q._repeat === true ? { repeat: true } : {}),
        // An entry that is not an attempt costs nothing, so it may not return
        // line-by-line verdicts either: they would be a free answer oracle.
        stepReport: invalid ? null : stepReport, partial: invalid ? null : partial, ...(resolved ? {
          solution: solutionFor(q),
          // Only a committed resolution may disclose opportunity explanations.
          // Their ontology identity is derived by the client from these
          // server-attested authored distractor explanations, not from an answer key.
          repairOpportunities: [...new Set(trapProbes.map(t => t?.why).filter(Boolean))].slice(0, 40)
        } : {}) };
      await db.run("INSERT INTO idempotency_keys(account_id,scope,key,response_json,request_digest,created_at,expires_at) VALUES (?,'practice-grade',?,?,?,?,?)",
        [accountId, idKey, JSON.stringify(response), hash, now, now + MAX_AGE]);
      if (resolved) {
        await markContentSeen(db, accountId, q, now);
        await db.run("INSERT INTO idempotency_keys(account_id,scope,key,response_json,request_digest,created_at,expires_at) VALUES (?,'practice-completion',?,?,?,?,?)",
          [accountId, qid, JSON.stringify({ attemptId, submissionId }), hash, now, now + MAX_AGE]);
        if (!recordsProgress(q)) return { response };
        // For a resolved attempt progress is committed in the very same DB
        // transaction as its immutable response, with a server-issued ID.
        const last = await db.get("SELECT MAX(device_seq) AS n FROM learning_events WHERE account_id=? AND device_id='server-grader'", [accountId]);
        const seq = Number(last?.n || 0) + 1;
        const cursor = await nextSyncCursor(db, accountId);
      await db.run("INSERT INTO learning_events(server_cursor,id,account_id,device_id,device_seq,kind,entity_id,occurred_at,payload_json,created_at) VALUES (?,?,?, 'server-grader',?,'graded-attempt',?,?,?,?)",
          [cursor, attemptId, accountId, seq, qid, now, JSON.stringify({
            attemptId, submissionId, questionId: qid, correct: response.correct,
            marksEarned: response.marksEarned, marksPossible: response.marksPossible,
            ...(q._repeat === true ? { repeat: true } : {}),
            contentId: response.contentId,
            subtopic: q.subtopic || null, difficulty: Number(q.difficulty) || 2,
            mode: q._practiceMode || 'practice', inputMode: mode,
            // Assistance is currently client-observed, not server-certified. Until
            // hints/tutor levels are server-committed, restored progress must not
            // claim independent mastery for a result whose help is unknown.
            hintsUsed: 1, support: 'supported', createdAt: now,
            serverAcknowledgedAt: now
          }), now]);
      } else if (!invalid) {
        await db.run("INSERT INTO idempotency_keys(account_id,scope,key,response_json,request_digest,created_at,expires_at) VALUES (?,'practice-tries',?,?,?,?,?) ON CONFLICT(account_id,scope,key) DO UPDATE SET response_json=excluded.response_json",
          [accountId, qid, JSON.stringify({ tries: tries + 1, ...(ownTrap ? { trapWhy: ownTrap } : {}) }), hash, now, now + MAX_AGE]);
        if (q._repeat !== true) await markContentTried(db, accountId, q, now);
      }
      return { response };
      }, { accountScope: accountId, lock: syncLockKey(accountId) }));
      if (outcome.again) { evidenceForced = evidenceForced || outcome.needEvidence === true; continue; }
      if (outcome.status) return refuse(outcome);
      return res.status(200).json(outcome.response);
    }
    // The question kept changing under three attempts to commit one mark.
    // Nothing was written; the same submission key retries safely.
    return sendMarkerBusy(res);
  });

  return router;
}

// The same server-owned question choice, public projection and rubric, for the
// examination router (server/platform/exams.js). One implementation, so a
// paper and a practice question can never be chosen or marked by two rules.
export { ensureBanks, chooseQuestion, stepMetaFor, answerTextFor, opaqueContentId, opaqueContentHash };
