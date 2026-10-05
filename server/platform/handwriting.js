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
import { asyncRouter } from './asyncRouter.js';
import { asStore } from './store.js';
import { rateLimit, requireSession, requireVerifiedEmail } from './security.js';
import { consumeAiAllowance, refundAiAllowance, refuseAiAllowance } from './aiAllowance.js';
import { consumePaidCall, refusePaidCall, spendCeilingMissing } from './spendCeiling.js';
import { ensureAiUsageTable, recordAiUsage, usageCollector } from './aiUsage.js';
import { cachedServerReleaseIdentity } from './releaseIdentity.js';
import { recordProviderCall } from './metrics.js';
import { logEvent } from './observability.js';
import {
  HandwritingProviderError, handwritingProviderDiagnostics, probeHandwritingProvider,
  providerStaticStatus, transcribeHandwriting, validateImage
} from './handwritingProvider.js';

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
  probe = probeHandwritingProvider,
  releaseIdentity = cachedServerReleaseIdentity,
  env = process.env
} = {}) {
  db = asStore(db);
  ensureAiUsageTable(db);
  const router = asyncRouter();

  // One provider probe at a time per router. Concurrent /status requests share
  // the in-flight promise rather than each spending a probe against the
  // provider with the server's key.
  let inFlightProbe = null;
  const sharedProbe = () => {
    if (!inFlightProbe) {
      inFlightProbe = Promise.resolve()
        .then(() => probe({ env }))
        .finally(() => { inFlightProbe = null; });
    }
    return inFlightProbe;
  };

  // This is an operational readiness endpoint, not a credential-presence check.
  // A student must never be offered cloud handwriting when the key exists but
  // the model, endpoint, budget guard or provider is unusable.
  router.get('/status',
    requireSession(db),
    rateLimit(db, 'handwriting-status', { limit: 120, windowMs: 10 * 60 * 1000 }),
    async (req, res) => {
    const staticStatus = providerStaticStatus(env);
    const missingBudget = spendCeilingMissing(env);
    let providerStatus = {
      ...staticStatus,
      usable: false,
      degraded: false,
      failureCode: !staticStatus.configured
        ? 'HANDWRITING_NOT_CONFIGURED'
        : !staticStatus.configValid
          ? 'HANDWRITING_PROVIDER_CONFIG_INVALID'
          : null,
      latencyMs: null,
      fallbackUsable: false
    };

    if (staticStatus.configured && staticStatus.configValid && missingBudget.length === 0) {
      try {
        providerStatus = await sharedProbe();
      } catch {
        providerStatus = {
          ...providerStatus,
          degraded: true,
          failureCode: 'HANDWRITING_PROVIDER_PROBE_FAILED'
        };
      }
    }

    const budgetConfigured = missingBudget.length === 0;
    const usable = budgetConfigured && providerStatus.usable === true;
    const degraded = budgetConfigured && providerStatus.degraded === true;
    const failureCode = !budgetConfigured
      ? 'PAID_CAPACITY_NOT_CONFIGURED'
      : providerStatus.failureCode || handwritingProviderDiagnostics().lastFailureCode || null;
    const state = !staticStatus.configured || !staticStatus.configValid || !budgetConfigured
      ? 'unavailable'
      : usable
        ? (degraded ? 'degraded' : 'ready')
        : (degraded ? 'degraded' : 'unavailable');

    // The same resolver /v1/health uses, so the two can never disagree (a raw
    // PRI_RELEASE_SHA may be a stale manual-candidate value that the resolver
    // correctly outranks with Railway's own Git SHA).
    let releaseSha = null;
    try {
      const candidate = releaseIdentity()?.releaseSha;
      if (/^[0-9a-f]{40}$/.test(String(candidate || ''))) releaseSha = candidate;
    } catch { /* diagnostics must never make readiness itself fail */ }

    res.set('Cache-Control', 'no-store');
    res.json({
      available: usable,
      configured: staticStatus.configured,
      usable,
      degraded,
      state,
      model: staticStatus.configured ? staticStatus.primaryModel : null,
      fallbackModel: staticStatus.configured ? staticStatus.fallbackModel : null,
      confidenceFloor: staticStatus.confidenceFloor,
      timeoutMs: staticStatus.timeoutMs,
      fallbackUsable: providerStatus.fallbackUsable === true,
      lastFailureCode: failureCode,
      lastLatencyMs: providerStatus.latencyMs ?? handwritingProviderDiagnostics().lastLatencyMs ?? null,
      releaseSha
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

      // This account's daily allowance, from the SERVER's entitlement record
      // only (SEC-COMM-01): Premium's additional-ai-usage raises it; nothing
      // the device claims does.
      const allowance = await consumeAiAllowance(db, { accountId: req.platformSession.account_id, kind: 'handwriting', env });
      if (!allowance.allowed) return refuseAiAllowance(res, allowance);

      // Counted here, after the request has been shown to be a real one and
      // before anything is sent, so a malformed request cannot spend from a
      // budget shared by every student on this deployment.
      const overBudget = await consumePaidCall(db, { env });
      if (overBudget) { await refundAiAllowance(db, allowance); return refusePaidCall(res, overBudget); }

      const started = Date.now();
      // Cost telemetry (aiUsage.js): every model call that answered, with the
      // provider's token counts, recorded per account and day after the reply.
      const usage = usageCollector();
      const accountId = req.platformSession.account_id;
      const recordUsage = () => recordAiUsage(db, { accountId, kind: 'handwriting', env, calls: Math.max(1, usage.calls()), ...usage.total() });
      try {
        // The fallback model is a second paid call and is counted as one, before
        // it is sent, so a request can never spend past the ceiling.
        const result = await transcribe(req.body.image, {
          env,
          authorizeFallback: () => consumePaidCall(db, { env }),
          onUsage: usage
        });
        recordProviderCall('handwriting', { ok: true, ms: Date.now() - started });
        await recordUsage();
        res.json({
          transcription: {
            engine: result.engine,
            lines: result.lines,
            text: result.text,
            confidence: result.confidence,
            needsConfirmation: result.needsConfirmation,
            escalated: !!result.escalated,
            fallbackAttempted: !!result.fallbackAttempted,
            fallbackFailureCode: result.fallbackFailureCode || null,
            latencyMs: Number.isFinite(result.latencyMs) ? result.latencyMs : null
          }
        });
      } catch (error) {
        if (error?.paidCallVerdict) return refusePaidCall(res, error.paidCallVerdict);
        if (/NOT_CONFIGURED|CONFIG_INVALID/.test(String(error?.code || ''))) await refundAiAllowance(db, allowance);
        const code = error instanceof HandwritingProviderError ? error.code : 'HANDWRITING_FAILED';
        // A call the provider answered (even badly) was paid for.
        if (usage.calls() > 0 || !/NOT_CONFIGURED|CONFIG_INVALID|CANCELLED/.test(code)) await recordUsage();
        // A cancelled request is the student's choice, not a provider failure.
        if (code !== 'HANDWRITING_CANCELLED') {
          recordProviderCall('handwriting', { ok: false, code, ms: Date.now() - started });
          logEvent('warn', 'provider_call_failed', { requestId: req.requestId, provider: 'handwriting', code, latencyMs: Date.now() - started, retryable: !!error?.retryable });
        }
        if (error instanceof HandwritingProviderError) {
          return res.status(error.status).json({ error: { code: error.code, message: error.message, retryable: !!error.retryable } });
        }
        // Never leak a provider's internals to the browser.
        res.status(502).json({ error: { code: 'HANDWRITING_FAILED', message: 'The handwriting could not be read this time.' } });
      }
    });

  return router;
}
