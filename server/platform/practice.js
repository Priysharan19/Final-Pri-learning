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
import { asyncRouter } from './asyncRouter.js';
import { asStore } from './store.js';
import { nextSyncCursor, syncLockKey } from './db.js';
import { requireSession, requireVerifiedEmail, requireRole, rateLimit } from './security.js';
import { loadAllBanks, generateQuestion } from '../../client/src/engine/generators/index.js';
import { checkAnswer, stepCheck, methodMarks } from '../../client/src/engine/checker.js';
import { authoredRegion, formatRegion, formatMatrix, formatVector } from '../../client/src/engine/answer-forms.js';
import { transcribeHandwriting, validateImage, HandwritingProviderError } from './handwritingProvider.js';
import { consumeAiAllowance, refundAiAllowance, refuseAiAllowance } from './aiAllowance.js';
import { consumePaidCall, refusePaidCall } from './spendCeiling.js';

const MAX_AGE = 90 * 24 * 60 * 60 * 1000;
const ID = /^[a-zA-Z0-9_-]{8,100}$/;
const UUID = /^[0-9a-f-]{36}$/i;
const INDIA_BANK = /^c(?:[7-9]|1[0-2])-[a-z][a-z0-9-]{2,95}$/;
const ISSUE_FIELDS = new Set(['generator', 'difficulty', 'seed', 'curriculum', 'mode']);
const GRADE_FIELDS = new Set(['submissionId', 'answer', 'mode', 'steps', 'transcriptionReceipt', 'ms']);
const RECOGNITION_FIELDS = new Set(['image', 'mode']);
const CORRECTION_FIELDS = new Set(['text']);
const PUBLIC_Q = ['prompt', 'answerType', 'options', 'mcqOptions', 'inputHint', 'answerPrefix', 'answerSuffix',
  'hints', 'pyq', 'pyqSource', 'pyqYear', 'pyqExam', 'archive',
  'subtopic', 'difficulty', 'dotpoint', 'dotpoints', 'contentId', 'contentVersion', 'contentHash', 'figure'];

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
  }
  if (q.answerType === 'set' && Array.isArray(a.values) && a.values.length) {
    return { kind: 'equation', variable: 'x', solutions: a.values };
  }
  return null;
}

function stepEvidence(q, answer, steps, result) {
  const meta = stepMetaFor(q);
  let report = result.stepReport || null;
  if (meta && steps && !report) {
    try { report = stepCheck(meta, steps); } catch { report = null; }
  }
  let partial = null;
  if (meta && steps && !result.correct && !result.invalid) {
    try {
      const keySteps = (q.steps || []).filter(s => !/^(check|note|bonus)/i.test(s.h));
      const marks = Math.max(1, Math.min(q.difficulty || 1, keySteps.length || 1));
      const method = methodMarks({ meta, working: steps, marks, prompt: q.prompt, report });
      if (method) partial = { okLines: method.okLines, awarded: method.awarded, note: method.note, lines: method.lines };
    } catch { partial = null; }
  }
  return { stepReport: report, partial };
}

function safeQuestion(id, q) {
  const publicQ = { id, supportsSteps: !!stepMetaFor(q),
    criteriaCount: Math.max(1, Math.min(4, (q.steps || []).filter(s => !/^(check|note|bonus)/i.test(s.h)).length || 1)) };
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
  const marks = Math.min(4, Math.max(1, q.difficulty || 1));
  const keySteps = steps.filter(s => !/^(check|note|bonus)/i.test(s.h)).slice(0, marks);
  const criteria = keySteps.length
    ? keySteps.map((step, i) => ({ mark: 1, text: i === keySteps.length - 1
      ? step.h + ' — leading to the correct answer' : step.h }))
    : [{ mark: 1, text: 'Correct final answer' }];
  return { steps, answerText: answerTextFor(q), criteria, solutionText: q.solutionText };
}

export function createPracticeRouter(db, { transcribe = transcribeHandwriting, env = process.env } = {}) {
  db = asStore(db);
  const router = asyncRouter();
  router.use(requireSession(db), requireVerifiedEmail, requireRole('student'));

  router.post('/issue', rateLimit(db, 'practice-issue', { limit: 200, windowMs: 60 * 60 * 1000 }), async (req, res) => {
    const body = req.body;
    if (!plain(body) || unknown(body, ISSUE_FIELDS).length) {
      return reject(res, 400, 'PRACTICE_ISSUE_INVALID', 'Only a canonical generator, difficulty and optional seed may be requested.');
    }
    const generator = String(body.generator || '');
    const difficulty = Number(body.difficulty);
    if (body.curriculum !== 'in' || !INDIA_BANK.test(generator) || !Number.isInteger(difficulty) || difficulty < 1 || difficulty > 4) {
      return reject(res, 400, 'PRACTICE_GENERATOR_INVALID', 'Choose an authored India curriculum question and difficulty 1–4.');
    }
    const seed = body.seed === undefined ? randomInt(0x80000000) : Number(body.seed);
    if (!Number.isSafeInteger(seed) || seed < 0 || seed >= 0x80000000) {
      return reject(res, 400, 'PRACTICE_SEED_INVALID', 'Invalid question seed.');
    }
    const practiceMode = body.mode ?? 'practice';
    if (!['practice', 'review', 'task', 'rush', 'match'].includes(practiceMode)) {
      return reject(res, 400, 'PRACTICE_MODE_INVALID', 'Invalid practice mode.');
    }
    const accountId = req.platformSession.account_id;
    // Optional issue idempotency: normal practice may request a fresh question;
    // network retries can opt into the same server question with a stable key.
    const idem = String(req.get('idempotency-key') || '');
    if (idem && !ID.test(idem)) return reject(res, 400, 'IDEMPOTENCY_INVALID', 'Invalid issuance idempotency key.');
    const requestDigest = digest({ generator, difficulty, seed: body.seed === undefined ? null : seed, curriculum: body.curriculum, mode: practiceMode });
    await ensureBanks();
    let q;
    try { q = generateQuestion(generator, difficulty, seed); }
    catch { return reject(res, 422, 'PRACTICE_CONTENT_UNSUPPORTED', 'The requested question form is unavailable.'); }
    // The issuance mode is escrowed with the answer. A later submission cannot
    // falsely claim or downgrade the one-try Rush/Match policy.
    q._practiceMode = practiceMode;
    // Serialize once: nothing client-provided can replace the stored answer.
    const payload = JSON.stringify(q);
    const id = randomUUID();
    const publicResponse = { question: safeQuestion(id, q) };
    const now = Date.now();
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
      return publicResponse;
    }, { accountScope: accountId, lock: 'practice-issue:' + accountId });
    if (response.conflict) return reject(res, 409, 'IDEMPOTENCY_KEY_REUSED', 'This key already issued a different question.');
    return res.status(201).json(response);
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
      const stillOpen = await db.get("SELECT key FROM idempotency_keys WHERE account_id=? AND scope='practice-completion' AND key=?", [accountId, qid]);
      if (stillOpen) return false;
      await db.run("INSERT INTO idempotency_keys(account_id,scope,key,response_json,request_digest,created_at,expires_at) VALUES (?,'practice-recognition',?,?,?,?,?)",
        [accountId, receipt, JSON.stringify(evidence), digest(evidence), acknowledgedAt, acknowledgedAt + MAX_AGE]);
      return true;
    }, { accountScope: accountId, lock: syncLockKey(accountId) });
    if (!committed) return reject(res, 409, 'QUESTION_ALREADY_GRADED', 'This question has been completed.');
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
    const prior = await db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-recognition' AND key=? AND expires_at>?", [accountId, sourceId, now]);
    if (!prior) return reject(res, 404, 'RECOGNITION_RECEIPT_INVALID', 'The recognition receipt is not available.');
    const original = JSON.parse(prior.response_json);
    if (original.questionId !== qid || !['ink', 'photo'].includes(original.mode)) {
      return reject(res, 404, 'RECOGNITION_RECEIPT_INVALID', 'This receipt belongs to another question.');
    }
    const receipt = randomUUID();
    const proof = { questionId: qid, mode: original.mode, text: body.text,
      parentReceipt: sourceId, correctedByStudent: true, recognizedAt: now };
    await db.transaction(async () => {
      await db.run("INSERT INTO idempotency_keys(account_id,scope,key,response_json,request_digest,created_at,expires_at) VALUES (?,'practice-recognition',?,?,?,?,?)",
        [accountId, receipt, JSON.stringify(proof), digest(proof), now, now + MAX_AGE]);
    }, { accountScope: accountId, lock: syncLockKey(accountId) });
    return res.status(201).json({ receipt, questionId: qid, mode: original.mode, corrected: true });
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
        questionId: qid, attemptId, serverAcknowledgedAt: now, solution: solutionFor(q) };
      const hash = digest({ qid, operation: 'reveal' });
      for (const [scope, value] of [['practice-reveal', response], ['practice-completion', { attemptId, revealed: true }]]) {
        await db.run("INSERT INTO idempotency_keys(account_id,scope,key,response_json,request_digest,created_at,expires_at) VALUES (?,?,?,?,?,?,?)",
          [accountId, scope, qid, JSON.stringify(value), hash, now, now + MAX_AGE]);
      }
      const last = await db.get("SELECT MAX(device_seq) AS n FROM learning_events WHERE account_id=? AND device_id='server-grader'", [accountId]);
      const cursor = await nextSyncCursor(db, accountId);
      await db.run("INSERT INTO learning_events(server_cursor,id,account_id,device_id,device_seq,kind,entity_id,occurred_at,payload_json,created_at) VALUES (?,?,?, 'server-grader',?,'graded-attempt',?,?,?,?)",
        [cursor, attemptId, accountId, Number(last?.n || 0) + 1, qid, now, JSON.stringify({ attemptId, questionId: qid, correct: false,
          revealed: true, contentId: q.contentId || null, serverAcknowledgedAt: now }), now]);
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
    const submissionId = String(body.submissionId || '');
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
        const token = String(body.transcriptionReceipt || '');
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
      const priorTry = await db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-tries' AND key=?",
        [accountId, qid]);
      const tries = priorTry ? Number(JSON.parse(priorTry.response_json).tries) || 0 : 0;
      // Invalid input is not a failed mathematical attempt: do not consume a try or close the question.
      const resolved = !result.invalid && Boolean(result.correct || tries >= 1 || ['rush', 'match'].includes(q._practiceMode));
      const attemptId = randomUUID();
      const response = { authoritative: true, questionId: qid, submissionId, attemptId,
        correct: result.correct === true, invalid: Boolean(result.invalid), resolved,
        triesLeft: resolved ? 0 : 1, feedback, trapWhy,
        contentId: q.contentId || null, serverAcknowledgedAt: now,
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
            attemptId, submissionId, questionId: qid, correct: response.correct, contentId: response.contentId,
            mode, serverAcknowledgedAt: now
          }), now]);
      } else if (!result.invalid) {
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
