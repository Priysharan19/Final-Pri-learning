// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · AI line check · what it may spend
//
// Three limits, all of which must allow the call before anything is sent:
//   1. the deployment's paid-call ceiling (spendCeiling.js: hour and day, shared by every paid route);
//   2. a per-account daily ceiling for this layer;
//   3. a deployment-wide daily ceiling for this layer.
// (2) and (3) have NO default: unset or invalid, the layer does not run (fail closed), like the paid-call ceiling.
// A call that was never sent gives its units back; a call that may have been billed does not.
// ─────────────────────────────────────────────────────────────────────────────
import { consumeRateLimit, sha256 } from '../security.js';
import { asStore } from '../store.js';
import { reservePaidCall, refundPaidCall } from '../spendCeiling.js';

const DAY = 24 * 60 * 60 * 1000;
const positiveInt = v => { const n = Number(v); return Number.isInteger(n) && n > 0 && n <= 1_000_000 ? n : null; };

export function lineCheckLimits(env = process.env) {
  return { perUserDaily: positiveInt(env.PRI_AI_LINE_CHECK_PER_USER_DAILY), globalDaily: positiveInt(env.PRI_AI_LINE_CHECK_GLOBAL_DAILY) };
}

/** Reserve the three limits for one call. { ok:true, release() } or { ok:false, code }. */
export async function reserveLineCheck(db, { accountId, env = process.env, now = Date.now() }) {
  const { perUserDaily, globalDaily } = lineCheckLimits(env);
  if (!perUserDaily || !globalDaily) return { ok: false, code: 'not-configured' };
  const store = asStore(db);
  const userBucket = `ai-line-check:user:${sha256(String(accountId)).slice(0, 24)}`;
  const globalBucket = 'ai-line-check:global';
  const user = await consumeRateLimit(store, userBucket, { limit: perUserDaily, windowMs: DAY }, now);
  if (!user.allowed) return { ok: false, code: 'user-daily' };
  const global = await consumeRateLimit(store, globalBucket, { limit: globalDaily, windowMs: DAY }, now);
  const back = (bucket, v) => store.run('UPDATE rate_limits SET count = count - 1 WHERE bucket = ? AND window_start = ? AND count > 0', [bucket, v.resetAt - DAY]);
  if (!global.allowed) { await back(userBucket, user); return { ok: false, code: 'global-daily' }; }
  const paid = await reservePaidCall(store, { env, now });
  if (paid.verdict) { await back(userBucket, user); await back(globalBucket, global); return { ok: false, code: 'paid-ceiling' }; }
  return {
    ok: true,
    // Only for a call that was never sent.
    release: async () => { await back(userBucket, user); await back(globalBucket, global); await refundPaidCall(store, paid); }
  };
}
