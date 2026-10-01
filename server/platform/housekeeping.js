// Housekeeping: purge rows that can no longer authorise anything. Runs at
// startup, every six hours, and on demand via server/tools/housekeeping.mjs.
// The last run is recorded in platform_meta so /v1/health can report it.

import { purgeStaleLoginAttempts } from './loginLockout.js';
import { purgeOidcNonces } from './oidcNonce.js';
import { asStore } from './store.js';

export const HOUSEKEEPING_INTERVAL_MS = 6 * 60 * 60 * 1000;
const REVOKED_SESSION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const CONSUMED_TOKEN_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const RATE_BUCKET_MAX_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function runHousekeeping(db, now = Date.now()) {
  db = asStore(db);
  const startedAt = Date.now();
  const summary = await db.transaction(async () => ({
    sessions: (await db.run('DELETE FROM account_sessions WHERE expires_at < ? OR (revoked_at IS NOT NULL AND revoked_at < ?)', [now, now - REVOKED_SESSION_RETENTION_MS])).changes,
    tokens: (await db.run('DELETE FROM account_tokens WHERE expires_at < ? OR (consumed_at IS NOT NULL AND consumed_at < ?)', [now, now - CONSUMED_TOKEN_RETENTION_MS])).changes,
    idempotencyKeys: (await db.run('DELETE FROM idempotency_keys WHERE expires_at < ?', [now])).changes,
    rateBuckets: (await db.run('DELETE FROM rate_limits WHERE window_start < ?', [now - RATE_BUCKET_MAX_WINDOW_MS])).changes,
    oidcNonces: await purgeOidcNonces(db, now),
    loginAttempts: await purgeStaleLoginAttempts(db, now)
  }));
  const record = { ranAt: now, durationMs: Date.now() - startedAt, ...summary };
  await db.run(`INSERT INTO platform_meta(key, value) VALUES ('housekeeping_last_run', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value`, [JSON.stringify(record)]);
  return record;
}

export async function housekeepingStatus(db) {
  db = asStore(db);
  const raw = (await db.get("SELECT value FROM platform_meta WHERE key = 'housekeeping_last_run'"))?.value;
  if (!raw) return { lastRunAt: null, lastRun: null };
  try {
    const record = JSON.parse(raw);
    return { lastRunAt: Number(record.ranAt) || null, lastRun: record };
  } catch {
    return { lastRunAt: null, lastRun: null };
  }
}

export function startHousekeeping(db, { intervalMs = HOUSEKEEPING_INTERVAL_MS, log = console.log } = {}) {
  let stopped = false;
  const run = async () => {
    if (stopped) return null;
    try {
      const record = await runHousekeeping(db);
      log('housekeeping', record);
      return record;
    } catch (error) {
      console.error('housekeeping_error', { code: error?.code || 'HOUSEKEEPING_ERROR' });
      return null;
    }
  };
  const first = run();
  const timer = setInterval(run, Math.max(60_000, Number(intervalMs) || HOUSEKEEPING_INTERVAL_MS));
  timer.unref?.();
  return {
    first,
    stop() {
      stopped = true;
      clearInterval(timer);
    }
  };
}
