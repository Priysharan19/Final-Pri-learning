// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · /v1/working
//
// The route behind "check my working". It sits on the control plane for the
// same reasons the handwriting route does: hashed sessions, the origin guard,
// CSRF, per-account rate limits and the audit log already live there.
//
// Note the difference from /v1/handwriting, which is deliberate and matters.
// Transcription is answer-blind and refuses a `prompt`: a reader that can see
// the question drifts toward what the question expects. Step checking cannot
// be question-blind — "does this line follow" is unanswerable without knowing
// what was asked — so the question IS sent. What is still refused here is the
// expected answer and the mark scheme, because a checker that knows where the
// working should end approves anything ending there and punishes the student
// who took another road.
//
// Reasoning costs more than transcription, so the hourly allowance is lower.
// ─────────────────────────────────────────────────────────────────────────────
import { asyncRouter } from './asyncRouter.js';
import { asStore } from './store.js';
import { rateLimit, requireSession, requireVerifiedEmail } from './security.js';
import { consumeAiAllowance, refundAiAllowance, refuseAiAllowance } from './aiAllowance.js';
import { consumePaidCall, refusePaidCall } from './spendCeiling.js';
import {
  MAX_LINES,
  WorkingProviderError,
  checkWorkingWithModel,
  providerConfig,
  validateWorking
} from './workingProvider.js';

/**
 * Fields that must never reach the step checker.
 *
 * `prompt` is absent from this list on purpose — unlike the transcription route,
 * this one needs the question. Everything that would tell the checker the
 * destination is refused.
 */
export const FORBIDDEN_FIELDS = Object.freeze([
  'expected', 'expectedAnswer', 'answer', 'answerText', 'solution', 'markScheme',
  'marks', 'criteria', 'correct', 'isCorrect', 'sources',
  'profile', 'pid', 'name', 'email'
]);

export function validateRequestBody(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, code: 'WORKING_BODY_INVALID', message: 'Send a JSON body with the question and the working.' };
  }
  const offending = Object.keys(body).filter(key => FORBIDDEN_FIELDS.includes(key));
  if (offending.length) {
    return {
      ok: false,
      code: 'WORKING_NOT_ANSWER_BLIND',
      message: `Step checking never receives the expected answer; it judges each line against the line before it. Refused: ${offending.join(', ')}.`
    };
  }
  const allowed = new Set(['prompt', 'lines', 'requestId']);
  const unknown = Object.keys(body).filter(key => !allowed.has(key));
  if (unknown.length) {
    return { ok: false, code: 'WORKING_BODY_INVALID', message: `Unexpected field: ${unknown.join(', ')}.` };
  }
  if (!Array.isArray(body.lines)) {
    return { ok: false, code: 'WORKING_BODY_INVALID', message: 'Send the working as `lines`, an array of strings.' };
  }
  if (body.prompt !== undefined && typeof body.prompt !== 'string') {
    return { ok: false, code: 'WORKING_BODY_INVALID', message: '`prompt` must be the question text.' };
  }
  return { ok: true };
}

export function createWorkingRouter(db, {
  check = checkWorkingWithModel,
  env = process.env
} = {}) {
  db = asStore(db);
  const router = asyncRouter();

  router.get('/status', requireSession(db), async (req, res) => {
    const config = providerConfig(env);
    res.json({
      available: config.configured,
      model: config.configured ? config.model : null,
      maxLines: MAX_LINES,
      confidenceFloor: config.confidenceFloor
    });
  });

  router.post('/check',
    requireSession(db),
    requireVerifiedEmail,
    rateLimit(db, 'working-check', { limit: 120, windowMs: 60 * 60 * 1000 }),
    async (req, res) => {
      const body = validateRequestBody(req.body);
      if (!body.ok) return res.status(400).json({ error: { code: body.code, message: body.message } });

      let lines;
      try {
        lines = validateWorking(req.body.lines);
      } catch (error) {
        return res.status(error.status || 400).json({ error: { code: error.code, message: error.message } });
      }

      // This account's daily allowance, from the SERVER's entitlement record
      // only (SEC-COMM-01): Premium's additional-ai-usage raises it; nothing
      // the device claims does.
      const allowance = await consumeAiAllowance(db, { accountId: req.platformSession.account_id, kind: 'working', env });
      if (!allowance.allowed) return refuseAiAllowance(res, allowance);

      // Counted here, after the request has been shown to be a real one and
      // before anything is sent, so a malformed request cannot spend from a
      // budget shared by every student on this deployment.
      const overBudget = await consumePaidCall(db, { env });
      if (overBudget) { await refundAiAllowance(db, allowance); return refusePaidCall(res, overBudget); }

      try {
        const result = await check(req.body.prompt || '', lines, { env });
        res.json({
          check: {
            engine: result.engine,
            lines: result.lines,
            firstBreak: result.firstBreak,
            hint: result.hint,
            misconceptionId: result.misconceptionId ?? null,
            confidence: result.confidence,
            needsConfirmation: result.needsConfirmation
          }
        });
      } catch (error) {
        if (/NOT_CONFIGURED|CONFIG_INVALID/.test(String(error?.code || ''))) await refundAiAllowance(db, allowance);
        if (error instanceof WorkingProviderError) {
          return res.status(error.status).json({ error: { code: error.code, message: error.message, retryable: !!error.retryable } });
        }
        res.status(502).json({ error: { code: 'WORKING_FAILED', message: 'The working could not be checked this time.' } });
      }
    });

  return router;
}
