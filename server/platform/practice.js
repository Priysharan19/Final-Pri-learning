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
import { requireSession, requireVerifiedEmail, requireRole, rateLimit, consumeRateLimit, sessionFromRequest } from './security.js';
import { encryptDeliveryToken, decryptDeliveryToken } from './deliveryCrypto.js';
import { misconceptionIdForTrap } from '../../client/src/engine/misconceptions.js';
import { PUBLIC_QUESTION_FIELDS } from '../../client/src/engine/publicQuestion.js';
import { consentState, consentBlockerCode } from './guardianConsent.js';
import { loadAllBanks, generateQuestion } from '../../client/src/engine/generators/index.js';
import { checkAnswer, stepCheck, methodMarks } from '../../client/src/engine/checker.js';
import { authoredRegion, formatRegion, formatMatrix, formatVector } from '../../client/src/engine/answer-forms.js';
import { transcribeHandwriting, validateImage, HandwritingProviderError } from './handwritingProvider.js';
import { consumeAiAllowance, refundAiAllowance, refuseAiAllowance } from './aiAllowance.js';
import { consumePaidCall, refusePaidCall } from './spendCeiling.js';

const MAX_AGE = 90 * 24 * 60 * 60 * 1000;
const ID = /^[a-zA-Z0-9_-]{8,100}$/;
const UUID = /^[0-9a-f-]{36}$/i;
const INDIA_BANK = /^c(?:[7-9]|1[0-2])-[a-z0-9][a-z0-9-]{2,95}$/;
// Every authored generator the client can serve is issuable: with online-only
// grading a question the server refuses to issue could never be checked. The
// name is only a lookup key; an unknown one fails generation with 422.
const AUTHORED_BANK = /^[a-z][a-z0-9]{0,11}-[a-z0-9][a-z0-9-]{1,95}$/;
const ISSUE_FIELDS = new Set(['generator', 'difficulty', 'seed', 'curriculum', 'mode', 'prepared', 'avoid', 'trap', 'dotpoint']);
const PREPARE_FIELDS = new Set(['generator', 'difficulty', 'curriculum', 'mode', 'avoid', 'dotpoint']);
const PRACTICE_MODES = ['practice', 'review', 'task', 'rush', 'match'];
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

// Mirrors the shared deterministic checker input used by local practice;
// questions, answer keys and stage meta remain server-private.
function stepMetaFor(q) {
  if (q.stepcheck) return q.stepcheck;
  const a = q.answer;
  if (!a) return null;
  if (q.answerType === 'expression' && a.expr) return { kind: 'expression', canonical: a.expr };
  if (q.answerType === 'numeric' && a.value !== undefined) {
    const m = (q.answerPrefix || '').match(/^([a-z])\s*=$/i);
    if (m) return { kind: 'equation', variable: m[1].toLowerCase(), solutions: [a.value] };
    // Some authored Class 8 algebra forms print only `$6m+15=7m+29$`
    // and omit answerPrefix. Derive the variable ONLY from that entire,
    // single-variable, plain algebraic equation. Other numeric prompts
    // (evaluation, geometry, scientific units, multi-equation systems) must
    // not acquire method-credit authority from a guessed letter.
    const source = String(q.prompt || '').match(/^\s*\$([^$]+)\$\s*$/);
    const equation = source?.[1]?.trim();
    if (equation && /^[0-9a-z\s+*/().=\-]+$/i.test(equation) &&
        equation.split('=').length === 2 && Number.isFinite(Number(a.value))) {
      const symbols = [...new Set((equation.match(/[a-z]/gi) || []).map(v => v.toLowerCase()))];
      if (symbols.length === 1) return {
        kind: 'equation', variable: symbols[0], solutions: [a.value], source: equation
      };
    }
  }
  if (q.answerType === 'set' && Array.isArray(a.values) && a.values.length) {
    return { kind: 'equation', variable: 'x', solutions: a.values };
  }
  return null;
}

// An issued question and every committed grade must use the SAME server-owned
// rubric. Difficulty alone is not marks; the authored non-auxiliary criteria
// define the total, bounded by the question's four-mark practice contract.
function marksPossibleFor(q) {
  const keySteps = (q.steps || []).filter(step => !/^(check|note|bonus)/i.test(step.h));
  const maxMarks = Math.min(4, Math.max(1, Number(q.difficulty) || 1));
  return Math.max(1, Math.min(maxMarks, keySteps.length || 1));
}

function stepEvidence(q, answer, steps, result) {
  const meta = stepMetaFor(q);
  let report = result.stepReport || null;
  if (meta && steps && !report) {
    try { report = stepCheck(meta, steps); } catch { report = null; }
  }
  let partial = null;
  // A blank final-answer box may still carry verified mathematical method
  // evidence. Invalid nonblank expressions do not become creditable merely
  // because working was attached; only an actually empty final-answer field
  // can be graded by method alone.
  const blankFinal = typeof answer === 'string' && answer.trim() === '';
  if (meta && steps && !result.correct && (!result.invalid || blankFinal)) {
    try {
      const method = methodMarks({
        meta, working: steps, marks: marksPossibleFor(q), prompt: q.prompt, report
      });
      if (method) partial = { okLines: method.okLines, awarded: method.awarded, note: method.note, lines: method.lines };
    } catch { partial = null; }
  }
  return { stepReport: report, partial };
}

function safeQuestion(id, q) {
  const publicQ = { id, supportsSteps: !!stepMetaFor(q),
    criteriaCount: marksPossibleFor(q) };
  for (const k of PUBLIC_Q) if (Object.hasOwn(q, k)) publicQ[k] = q[k];
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
    workEvidence(lines) {
      const evidence = { firstBreak: -1, verifiedLines: 0, misconception: null };
      const meta = stepMetaFor(q);
      if (!meta || !Array.isArray(lines) || !lines.length) return evidence;
      try {
        const judged = stepCheck(meta, lines.join('\n'))?.lines || [];
        const at = judged.findIndex(line => line?.status === 'break');
        if (at >= 0 && at < lines.length) evidence.firstBreak = at;
        while (evidence.verifiedLines < judged.length && evidence.verifiedLines < lines.length &&
          judged[evidence.verifiedLines]?.status === 'ok') evidence.verifiedLines += 1;
      } catch { /* the checker's silence is not evidence */ }
      return evidence;
    }
  };
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
  return { generator, difficulty, mode, avoid: new Set(avoid), dotpoint: body.dotpoint, trap };
}

/**
 * The server picks the question: a fresh random seed, re-drawn a few times to
 * avoid content the student has just seen and, when a misconception is being
 * worked on, to find a form that can spring it. `seed` is given only by the
 * test suites. Throws when the generator has no such form.
 */
function chooseQuestion({ generator, difficulty, dotpoint, avoid, trap }, seed = null) {
  if (seed !== null) {
    const q = generateQuestion(generator, difficulty, seed, dotpoint);
    return { q, repeat: false, trapDelivered: !!(trap && carriesTrap(trap.owner, q, trap.key)) };
  }
  let fallback = null;
  for (let i = 0; i < SEEK_TRIES; i++) {
    const q = generateQuestion(generator, difficulty, randomInt(0x80000000), dotpoint);
    const fresh = !avoid.has(q.contentHash);
    const springs = !trap || carriesTrap(trap.owner, q, trap.key);
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
  const router = asyncRouter();
  router.use(requireSession(db), requireVerifiedEmail, requireRole('student'));

  router.post('/issue', rateLimit(db, 'practice-issue', { limit: 200, windowMs: 60 * 60 * 1000 }), async (req, res) => {
    const body = req.body;
    const accountId = req.platformSession.account_id;
    const now = Date.now();
    await ensureBanks();
    let q, practiceMode, repeat = false, trapDelivered = false, preparedNonce = null, seedGiven = false;
    if (plain(body) && body.prepared !== undefined) {
      // Binding a question the student started signed out. Nothing else in the
      // body is honoured: the sealed token is the whole request.
      if (unknown(body, new Set(['prepared'])).length) {
        return reject(res, 400, 'PRACTICE_ISSUE_INVALID', 'A prepared question is bound on its own.');
      }
      const sealed = readPrepared(body.prepared);
      if (!sealed) return reject(res, 400, 'PRACTICE_PREPARED_INVALID', 'This prepared question is not valid.');
      if (sealed.x < now) return reject(res, 410, 'PRACTICE_PREPARED_EXPIRED', 'This prepared question has expired.');
      // The same account retrying after a lost reply gets the same issue back.
      const mine = await db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-prepared' AND key=? AND expires_at>?",
        [accountId, sealed.n, now]);
      if (mine) return res.status(201).json({ ...JSON.parse(mine.response_json), accountId: String(accountId) });
      // One account, once: a token passed to a second account is refused.
      const claim = await consumeRateLimit(db, 'practice-prepared-claim:' + sealed.n, { limit: 1, windowMs: PREPARED_TTL * 2 }, now);
      if (!claim.allowed) return reject(res, 409, 'PRACTICE_PREPARED_USED', 'This prepared question has already been taken up.');
      try { q = generateQuestion(sealed.g, sealed.d, sealed.s, sealed.p); }
      catch { return reject(res, 422, 'PRACTICE_CONTENT_UNSUPPORTED', 'The requested question form is unavailable.'); }
      practiceMode = sealed.m;
      preparedNonce = sealed.n;
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
    // Serialize once: nothing client-provided can replace the stored answer.
    const payload = JSON.stringify(q);
    const id = randomUUID();
    const publicResponse = { question: safeQuestion(id, q), ...(repeat ? { repeat: true } : {}), ...(trapDelivered ? { trapDelivered: true } : {}) };
    const response = await db.transaction(async () => {
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
        [accountId, preparedNonce, JSON.stringify(publicResponse), requestDigest, now, now + PREPARED_TTL * 2]);
      return publicResponse;
    }, { accountScope: accountId, lock: 'practice-issue:' + accountId });
    if (response.conflict) return reject(res, 409, 'IDEMPOTENCY_KEY_REUSED', 'This key already issued a different question.');
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

    const allowance = await consumeAiAllowance(db, { accountId, kind: 'handwriting', env });
    if (!allowance.allowed) return refuseAiAllowance(res, allowance);
    const budget = await consumePaidCall(db, { env });
    if (budget) { await refundAiAllowance(db, allowance); return refusePaidCall(res, budget); }

    let result;
    try {
      result = await transcribe(body.image, { env, authorizeFallback: () => consumePaidCall(db, { env }) });
    } catch (error) {
      if (/NOT_CONFIGURED|CONFIG_INVALID/.test(String(error?.code || ''))) await refundAiAllowance(db, allowance);
      if (error?.paidCallVerdict) return refusePaidCall(res, error.paidCallVerdict);
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
    const committed = await db.transaction(async () => {
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
    }, { accountScope: accountId, lock: syncLockKey(accountId) });
    if (committed.status !== 201) return reject(res, committed.status, committed.code,
      committed.status === 403 ? 'Guardian consent changed while this answer was being read.' :
      committed.status === 401 ? 'Sign in again before retrying recognition.' : 'This question has been completed.');
    return res.status(201).json({ receipt, questionId: qid, mode: body.mode,
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
    const outcome = await db.transaction(async () => {
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
    }, { accountScope: accountId, lock: syncLockKey(accountId) });
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
      const last = await db.get("SELECT MAX(device_seq) AS n FROM learning_events WHERE account_id=? AND device_id='server-grader'", [accountId]);
      const cursor = await nextSyncCursor(db, accountId);
      await db.run("INSERT INTO learning_events(server_cursor,id,account_id,device_id,device_seq,kind,entity_id,occurred_at,payload_json,created_at) VALUES (?,?,?, 'server-grader',?,'graded-attempt',?,?,?,?)",
        [cursor, attemptId, accountId, Number(last?.n || 0) + 1, qid, now, JSON.stringify({ attemptId, questionId: qid, correct: false,
          revealed: true, marksEarned: 0, marksPossible: response.marksPossible,
          ...(q._repeat === true ? { repeat: true } : {}),
          contentId: q.contentId || null,
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
        !(body.steps === undefined || body.steps === null ||
          limitedText(body.steps, 8000) ||
          (Array.isArray(body.steps) && body.steps.length <= 100 && body.steps.every(s => limitedText(s, 1000))))) {
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
    const outcome = await db.transaction(async () => {
      const idKey = qid + ':' + submissionId;
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
      const result = checkAnswer(q, body.answer);
      // Only after submission may authored misconception feedback be revealed.
      // Never trust a caller-supplied explanation or make the device infer
      // correctness from a withheld canonical answer.
      const trapProbes = [
        ...(Array.isArray(q.traps) ? q.traps : []),
        ...Object.values(q.answer?.optionTraps || {}).map(why => ({ why }))
      ];
      const optionWhy = !result.correct && q.answerType === 'mcq'
        ? q.answer?.optionTraps?.[Number(body.answer)] : null;
      const feedback = String(optionWhy || result.feedback || '').slice(0, 3000);
      const trapWhy = !result.correct
        ? trapProbes.find(t => t?.why && String(t.why) === feedback)?.why || null : null;
      const working = Array.isArray(body.steps) ? body.steps.join('\n') : String(body.steps || '');
      const { stepReport, partial } = stepEvidence(q, body.answer, working, result);
      const marksPossible = marksPossibleFor(q);
      // Blank final answers are not automatically attempts: verified positive
      // method evidence alone makes an otherwise blank response gradable.
      // Unreadable working or an invalid NONBLANK answer still cannot earn
      // marks. This prevents rewarding a mere copy of the question.
      const workingOnlyCredit = result.invalid === true && body.answer.trim() === '' &&
        Number.isInteger(partial?.awarded) && partial.awarded > 0;
      const invalid = Boolean(result.invalid && !workingOnlyCredit);
      const marksEarned = invalid ? 0 : result.correct
        ? marksPossible
        : Math.max(0, Math.min(marksPossible - 1, partial?.awarded ?? 0));
      const priorTry = await db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-tries' AND key=?",
        [accountId, qid]);
      const tries = priorTry ? Number(JSON.parse(priorTry.response_json).tries) || 0 : 0;
      // Invalid input is not a failed mathematical attempt: do not consume a try or close the question.
      const resolved = !invalid && Boolean(result.correct || tries >= 1 || ['rush', 'match'].includes(q._practiceMode));
      const attemptId = randomUUID();
      const response = { authoritative: true, questionId: qid, submissionId, attemptId,
        correct: result.correct === true, invalid, resolved,
        marksEarned, marksPossible,
        triesLeft: resolved ? 0 : 1,
        feedback: workingOnlyCredit ? partial.note : feedback, trapWhy,
        contentId: q.contentId || null, serverAcknowledgedAt: now,
        ...(q._repeat === true ? { repeat: true } : {}),
        stepReport, partial, ...(resolved ? {
          solution: solutionFor(q),
          // Only a committed resolution may disclose opportunity explanations.
          // Their ontology identity is derived by the client from these
          // server-attested authored distractor explanations, not from an answer key.
          repairOpportunities: [...new Set(trapProbes.map(t => t?.why).filter(Boolean))].slice(0, 40)
        } : {}) };
      await db.run("INSERT INTO idempotency_keys(account_id,scope,key,response_json,request_digest,created_at,expires_at) VALUES (?,'practice-grade',?,?,?,?,?)",
        [accountId, idKey, JSON.stringify(response), hash, now, now + MAX_AGE]);
      if (resolved) {
        await db.run("INSERT INTO idempotency_keys(account_id,scope,key,response_json,request_digest,created_at,expires_at) VALUES (?,'practice-completion',?,?,?,?,?)",
          [accountId, qid, JSON.stringify({ attemptId, submissionId }), hash, now, now + MAX_AGE]);
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
          [accountId, qid, JSON.stringify({ tries: tries + 1 }), hash, now, now + MAX_AGE]);
      }
      return { response };
    }, { accountScope: accountId, lock: syncLockKey(accountId) });
    if (outcome.status) return reject(res, outcome.status, outcome.code,
      outcome.code === 'QUESTION_NOT_FOUND' ? 'This question does not belong to this account.' : 'The submission cannot be accepted.');
    return res.status(200).json(outcome.response);
  });

  return router;
}
