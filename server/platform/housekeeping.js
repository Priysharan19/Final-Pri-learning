// Housekeeping: purge rows that can no longer authorise anything, and close
// examination papers nobody finished. Runs at startup, every six hours, and on
// demand via server/tools/housekeeping.mjs. The last run is recorded in
// platform_meta so /v1/health can report it.

import { purgeStaleLoginAttempts } from './loginLockout.js';
import { purgeOidcNonces } from './oidcNonce.js';
import { asStore } from './store.js';
import { logEvent, safeCode } from './observability.js';
import { encryptJoinCode, isLegacyPlainJoinCode } from './classes.js';
import { sweepExpiredExams } from './exams.js';

export const HOUSEKEEPING_INTERVAL_MS = 6 * 60 * 60 * 1000;
const REVOKED_SESSION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const CONSUMED_TOKEN_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const RATE_BUCKET_MAX_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function runHousekeeping(db, now = Date.now()) {
  db = asStore(db);
  const startedAt = Date.now();
  // A paper abandoned past its deadline and grace is finalised on the answers
  // the server holds, for an account that never came back to it (an account
  // that does come back has it done on its next start or read). Each paper is
  // its own account-scoped transaction, so this runs outside the purge below,
  // and a failure here never stops the purge. One paper that cannot be
  // finalised does not stop the others either: it is counted in
  // `examsFailed`, so a pass that left work behind says so. Both stay null
  // only when the sweep itself could not run.
  let examsFinalised = null, examsFailed = null;
  try { ({ finalised: examsFinalised, failed: examsFailed } = await sweepExpiredExams(db, { now })); }
  catch (error) { logEvent('error', 'housekeeping_error', { code: safeCode(error?.code, 'EXAM_FINALISE_ERROR') }); }
  const summary = await db.transaction(async () => ({
    sessions: (await db.run('DELETE FROM account_sessions WHERE expires_at < ? OR (revoked_at IS NOT NULL AND revoked_at < ?)', [now, now - REVOKED_SESSION_RETENTION_MS])).changes,
    // A guardian's withdrawal credential ('guardian-withdraw') is long-lived
    // by design and must survive every pass while it is unspent: a parent who
    // kept the email for a year must still be able to use it. Once spent it
    // ages out with every other consumed token.
    tokens: (await db.run(`DELETE FROM account_tokens
      WHERE (expires_at < ? AND purpose != 'guardian-withdraw') OR (consumed_at IS NOT NULL AND consumed_at < ?)`, [now, now - CONSUMED_TOKEN_RETENTION_MS])).changes,
    idempotencyKeys: (await db.run('DELETE FROM idempotency_keys WHERE expires_at < ?', [now])).changes,
    rateBuckets: (await db.run('DELETE FROM rate_limits WHERE window_start < ?', [now - RATE_BUCKET_MAX_WINDOW_MS])).changes,
    oidcNonces: await purgeOidcNonces(db, now),
    loginAttempts: await purgeStaleLoginAttempts(db, now),
    joinCodesEncrypted: await encryptLegacyJoinCodes(db)
  }));
  const record = { ranAt: now, durationMs: Date.now() - startedAt, ...summary, examsFinalised, examsFailed };
  await db.run(`INSERT INTO platform_meta(key, value) VALUES ('housekeeping_last_run', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value`, [JSON.stringify(record)]);
  return record;
}

/**
 * Class join codes written before schema v9 were stored in clear beside their
 * hash. They are now kept encrypted at rest (classes.js); any legacy clear
 * value found here is encrypted in place so the teacher's reveal keeps
 * working and no plain code remains in the database.
 */
async function encryptLegacyJoinCodes(db) {
  const rows = await db.all('SELECT id, join_code FROM classes WHERE join_code IS NOT NULL');
  let changed = 0;
  for (const row of rows) {
    if (!isLegacyPlainJoinCode(row.join_code)) continue;
    const info = await db.run('UPDATE classes SET join_code = ? WHERE id = ? AND join_code = ?', [encryptJoinCode(row.join_code, row.id), row.id, row.join_code]);
    changed += info.changes;
  }
  return changed;
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
      logEvent('error', 'housekeeping_error', { code: safeCode(error?.code, 'HOUSEKEEPING_ERROR') });
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
