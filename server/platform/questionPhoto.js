// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · /v1/question-photo
//
// "Practise this": a photo of a textbook or worksheet question goes to a
// vision model that transcribes it and proposes a chapter and skill. It never
// marks anything and never receives an answer; the device generates and marks
// the practice that follows with its deterministic engine.
//
// Mounted on the control plane so it inherits hashed sessions, the origin
// guard, double-submit CSRF and the audit log. Every call is paid, so it needs
// a verified email, counts against this account's daily AI allowance and the
// deployment-wide paid-call ceilings (PRI_PAID_CALLS_PER_HOUR/DAY), and is
// rate limited per account.
// ─────────────────────────────────────────────────────────────────────────────
import { asyncRouter } from './asyncRouter.js';
import { asStore } from './store.js';
import { rateLimit, requireSession, requireVerifiedEmail } from './security.js';
import { consumeAiAllowance, refundAiAllowance, refuseAiAllowance } from './aiAllowance.js';
import { consumePaidCall, refusePaidCall } from './spendCeiling.js';
import { recordProviderCall } from './metrics.js';
import { logEvent } from './observability.js';
import { QuestionPhotoError, identifyQuestionPhoto, validateQuestionImage } from './questionPhotoProvider.js';

/** Fields that must never reach the classifier: it is answer-blind. */
export const FORBIDDEN_FIELDS = Object.freeze([
  'expected', 'expectedAnswer', 'answer', 'answerText', 'solution', 'steps',
  'marks', 'criteria', 'profile', 'pid', 'name', 'email'
]);

export function validateRequestBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, code: 'QUESTION_PHOTO_BODY_INVALID', message: 'Send a JSON body with an image.' };
  }
  const offending = Object.keys(body).filter(key => FORBIDDEN_FIELDS.includes(key));
  if (offending.length) {
    return { ok: false, code: 'QUESTION_PHOTO_NOT_ANSWER_BLIND', message: `Question reading never receives ${offending.join(', ')}.` };
  }
  const allowed = new Set(['image', 'requestId']);
  const unknown = Object.keys(body).filter(key => !allowed.has(key));
  if (unknown.length) return { ok: false, code: 'QUESTION_PHOTO_BODY_INVALID', message: `Unexpected field: ${unknown.join(', ')}.` };
  if (typeof body.image !== 'string' || !body.image) {
    return { ok: false, code: 'QUESTION_PHOTO_BODY_INVALID', message: 'Send the photo as an `image` data URL.' };
  }
  return { ok: true };
}

export function createQuestionPhotoRouter(db, { identify = identifyQuestionPhoto, env = process.env } = {}) {
  db = asStore(db);
  const router = asyncRouter();

  router.post('/identify',
    requireSession(db),
    requireVerifiedEmail,
    rateLimit(db, 'question-photo-identify', { limit: 60, windowMs: 60 * 60 * 1000 }),
    async (req, res) => {
      const check = validateRequestBody(req.body);
      if (!check.ok) return res.status(400).json({ error: { code: check.code, message: check.message } });
      try { validateQuestionImage(req.body.image); }
      catch (error) { return res.status(error.status || 400).json({ error: { code: error.code, message: error.message } }); }

      // This account's daily allowance (server entitlement only), then the
      // deployment-wide paid-call ceiling — both before anything is sent.
      const allowance = await consumeAiAllowance(db, { accountId: req.platformSession.account_id, kind: 'question-photo', env });
      if (!allowance.allowed) return refuseAiAllowance(res, allowance);
      const overBudget = await consumePaidCall(db, { env });
      if (overBudget) { await refundAiAllowance(db, allowance); return refusePaidCall(res, overBudget); }

      const started = Date.now();
      try {
        const result = await identify(req.body.image, { env });
        recordProviderCall('question-photo', { ok: true, ms: Date.now() - started });
        res.set('Cache-Control', 'no-store');
        res.json({
          identification: {
            isMathsQuestion: !!result.isMathsQuestion,
            readable: !!result.readable,
            questionText: String(result.questionText || ''),
            candidates: Array.isArray(result.candidates) ? result.candidates : [],
            // Always a proposal: the student confirms or changes the chapter.
            needsConfirmation: true
          }
        });
      } catch (error) {
        if (/NOT_CONFIGURED|CONFIG_INVALID/.test(String(error?.code || ''))) await refundAiAllowance(db, allowance);
        const code = error instanceof QuestionPhotoError ? error.code : 'QUESTION_PHOTO_FAILED';
        if (code !== 'QUESTION_PHOTO_CANCELLED') {
          recordProviderCall('question-photo', { ok: false, code, ms: Date.now() - started });
          logEvent('warn', 'provider_call_failed', { requestId: req.requestId, provider: 'question-photo', code, latencyMs: Date.now() - started, retryable: !!error?.retryable });
        }
        if (error instanceof QuestionPhotoError) {
          return res.status(error.status).json({ error: { code: error.code, message: error.message, retryable: !!error.retryable } });
        }
        // Never leak a provider's internals to the browser.
        res.status(502).json({ error: { code: 'QUESTION_PHOTO_FAILED', message: 'The photo could not be read this time.' } });
      }
    });

  return router;
}
