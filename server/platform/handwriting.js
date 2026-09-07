// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · /v1/handwriting
//
// The route a student's iPad calls when they have turned server-side reading
// on. It exists on the control plane rather than as its own service so it
// inherits everything already built there: hashed sessions, the origin guard,
// double-submit CSRF, per-account rate limits and the audit log.
//
// What crosses the wire is one image of the student's own ink and nothing else.
// The route refuses any request carrying question text, an expected answer or a
// profile, because a transcriber that can see the answer will drift toward it,
// and because none of that is needed to read handwriting.
//
// Reading is billed per request, so it is rate limited per account and requires
// a verified email. It is never anonymous.
// ─────────────────────────────────────────────────────────────────────────────
import { Router } from 'express';
import { rateLimit, requireSession, requireVerifiedEmail } from './security.js';
import { consumePaidCall, refusePaidCall } from './spendCeiling.js';
import { HandwritingProviderError, providerConfig, transcribeHandwriting, validateImage } from './handwritingProvider.js';

/** Fields that must never be sent to a transcriber. */
export const FORBIDDEN_FIELDS = Object.freeze([
  'prompt', 'question', 'questionText', 'expected', 'expectedAnswer', 'answer',
  'answerText', 'solution', 'steps', 'marks', 'criteria', 'subtopic', 'chapterId',
  'profile', 'pid', 'name', 'email', 'screenshot', 'page'
]);

/**
 * The body a client may send. Anything beyond this is refused rather than
 * ignored, so a future caller cannot quietly start leaking the answer.
 */
export function validateRequestBody(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, code: 'HANDWRITING_BODY_INVALID', message: 'Send a JSON body with an image.' };
  }
  const offending = Object.keys(body).filter(key => FORBIDDEN_FIELDS.includes(key));
  if (offending.length) {
    return {
      ok: false,
      code: 'HANDWRITING_NOT_ANSWER_BLIND',
      message: `Handwriting transcription is answer-blind; it never receives ${offending.join(', ')}.`
    };
  }
  const allowed = new Set(['image', 'requestId']);
  const unknown = Object.keys(body).filter(key => !allowed.has(key));
  if (unknown.length) {
    return { ok: false, code: 'HANDWRITING_BODY_INVALID', message: `Unexpected field: ${unknown.join(', ')}.` };
  }
  if (typeof body.image !== 'string' || !body.image) {
    return { ok: false, code: 'HANDWRITING_BODY_INVALID', message: 'Send the ink as an `image` data URL.' };
  }
  return { ok: true };
}

export function createHandwritingRouter(db, {
  transcribe = transcribeHandwriting,
  env = process.env
} = {}) {
  const router = Router();

  // Whether this deployment can read handwriting at all, so the app can hide
  // the setting rather than offer something that will fail.
  router.get('/status', requireSession(db), (req, res) => {
    const config = providerConfig(env);
    res.json({
      available: config.configured,
      model: config.configured ? config.primaryModel : null,
      confidenceFloor: config.confidenceFloor
    });
  });

  router.post('/transcribe',
    requireSession(db),
    requireVerifiedEmail,
    rateLimit(db, 'handwriting-transcribe', { limit: 240, windowMs: 60 * 60 * 1000 }),
    async (req, res) => {
      const check = validateRequestBody(req.body);
      if (!check.ok) return res.status(400).json({ error: { code: check.code, message: check.message } });

      try {
        validateImage(req.body.image);
      } catch (error) {
        return res.status(error.status || 400).json({ error: { code: error.code, message: error.message } });
      }

      // Counted here, after the request has been shown to be a real one and
      // before anything is sent, so a malformed request cannot spend from a
      // budget shared by every student on this deployment.
      const overBudget = consumePaidCall(db, { env });
      if (overBudget) return refusePaidCall(res, overBudget);

      try {
        const result = await transcribe(req.body.image, { env });
        res.json({
          transcription: {
            engine: result.engine,
            lines: result.lines,
            text: result.text,
            confidence: result.confidence,
            needsConfirmation: result.needsConfirmation,
            escalated: !!result.escalated
          }
        });
      } catch (error) {
        if (error instanceof HandwritingProviderError) {
          return res.status(error.status).json({ error: { code: error.code, message: error.message, retryable: !!error.retryable } });
        }
        // Never leak a provider's internals to the browser.
        res.status(502).json({ error: { code: 'HANDWRITING_FAILED', message: 'The handwriting could not be read this time.' } });
      }
    });

  return router;
}
