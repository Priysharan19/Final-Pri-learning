// Sessions and housekeeping contract (quality-13, cloud-21, cloud-18 partial).
//
// Sessions are a 30-day idle timeout that slides on use (at most one write a
// minute), last_seen_at is updated, expired bearers are refused. Housekeeping
// purges expired sessions/tokens/idempotency keys/rate buckets/nonces/login
// attempts, records its run for /v1/health, runs at startup, and is exposed
// as server/tools/housekeeping.mjs.

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..', '..');

const { startApp, registerAccount, checks } = await import('./support/app-harness.mjs');
const { createPlatformDb } = await import('../platform/db.js');
const { HOUSEKEEPING_INTERVAL_MS, housekeepingStatus, runHousekeeping, startHousekeeping } = await import('../platform/housekeeping.js');
const { issueOidcNonce, consumeOidcNonce } = await import('../platform/oidcNonce.js');
const { recordLoginFailure } = await import('../platform/loginLockout.js');

const c = checks();
const DAY = 24 * 60 * 60 * 1000;
const SESSION_MS = 30 * DAY;
const h = await startApp();
const db = h.db;

try {
  c.eq(HOUSEKEEPING_INTERVAL_MS, 6 * 60 * 60 * 1000, 'housekeeping interval is six hours');
  c.deq(housekeepingStatus(db), { lastRunAt: null, lastRun: null }, 'health reports no run before the first pass');

  // ── Session idle timeout that slides ──────────────────────────────────
  const reg = await registerAccount(h, { email: 'sliding.student@example.test', deviceId: 'ipad-slide' });
  const sessionRow = () => db.prepare('SELECT id, last_seen_at, expires_at FROM account_sessions WHERE account_id=? AND revoked_at IS NULL').get(reg.account.id);
  const fresh = sessionRow();
  c.ok(Math.abs(fresh.expires_at - fresh.last_seen_at - SESSION_MS) < 1000, 'a new session expires 30 days after it was last seen');

  const recent = Date.now() - 10_000;
  db.prepare('UPDATE account_sessions SET last_seen_at=?, expires_at=? WHERE id=?').run(recent, recent + SESSION_MS, fresh.id);
  c.eq((await h.request('/v1/account/me', { jar: reg.jar })).status, 200, 'request within the minute succeeds');
  c.eq(sessionRow().last_seen_at, recent, 'a request within a minute does not rewrite the row');

  const stale = Date.now() - 2 * 60_000;
  db.prepare('UPDATE account_sessions SET last_seen_at=?, expires_at=? WHERE id=?').run(stale, stale + SESSION_MS, fresh.id);
  const before = Date.now();
  const slid = await h.request('/v1/account/me', { jar: reg.jar });
  c.eq(slid.status, 200, 'request after a minute succeeds');
  const after = sessionRow();
  c.ok(after.last_seen_at >= before && after.last_seen_at <= Date.now(), 'last_seen_at is updated on use');
  c.ok(after.expires_at >= before + SESSION_MS - 1000, 'expiry slides to 30 days from now');
  const cookies = slid.headers.getSetCookie().filter(x => x.startsWith('pri_cloud_session='));
  c.ok(cookies.some(x => /Max-Age=259\d{4}/.test(x)), 'the cookie lifetime is re-issued in step with the slid row');

  const devices = await h.request('/v1/account/devices', { jar: reg.jar });
  c.eq(devices.data.devices[0].lastSeenAt, after.last_seen_at, 'device list reports the live last-seen time');

  db.prepare('UPDATE account_sessions SET expires_at=? WHERE id=?').run(Date.now() - 1, fresh.id);
  c.eq((await h.request('/v1/account/me', { jar: reg.jar })).status, 401, 'an idle-expired bearer is refused');

  // ── Housekeeping purge ────────────────────────────────────────────────
  const now = Date.now();
  const acct = reg.account.id;
  const session = (id, { expiresAt = now + DAY, revokedAt = null } = {}) => db.prepare(`INSERT INTO account_sessions(id,account_id,token_hash,device_id,created_at,last_seen_at,expires_at,revoked_at)
    VALUES (?,?,?,?,?,?,?,?)`).run(id, acct, `hash-${id}`, 'ipad', now - DAY, now - DAY, expiresAt, revokedAt);
  session('ses-revoked-old', { revokedAt: now - 40 * DAY });
  session('ses-revoked-new', { revokedAt: now - DAY });
  session('ses-live');
  // plus 'fresh' from registration, whose expiry was pushed into the past above

  const token = (id, { expiresAt = now + DAY, consumedAt = null } = {}) => db.prepare(`INSERT INTO account_tokens(id,account_id,purpose,token_hash,created_at,expires_at,consumed_at)
    VALUES (?,?,'verify-email',?,?,?,?)`).run(id, acct, `hash-${id}`, now - DAY, expiresAt, consumedAt);
  token('tok-expired', { expiresAt: now - 1 });
  token('tok-consumed-old', { consumedAt: now - 8 * DAY });
  token('tok-consumed-new', { consumedAt: now - DAY });
  token('tok-live');
  db.prepare(`INSERT INTO auth_delivery_outbox(id,account_id,kind,destination,token_id,token_ciphertext,created_at)
    VALUES ('mail-expired',?,'verify-email','x@example.test','tok-expired','cipher',?)`).run(acct, now - DAY);
  // plus the live verify token queued by registration

  db.prepare("INSERT INTO idempotency_keys(account_id,scope,key,response_json,created_at,expires_at) VALUES (?,'sync-push','k-expired','{}',?,?)").run(acct, now - 2 * DAY, now - 1);
  db.prepare("INSERT INTO idempotency_keys(account_id,scope,key,response_json,created_at,expires_at) VALUES (?,'sync-push','k-live','{}',?,?)").run(acct, now, now + DAY);

  db.prepare('INSERT INTO rate_limits(bucket,window_start,count) VALUES (?,?,1)').run('old:bucket', now - 25 * 60 * 60 * 1000);
  db.prepare('INSERT INTO rate_limits(bucket,window_start,count) VALUES (?,?,1)').run('recent:bucket', now - 60 * 60 * 1000);

  const liveNonce = issueOidcNonce(db, now);
  const expiredNonce = issueOidcNonce(db, now - 11 * 60 * 1000);
  const consumedNonce = issueOidcNonce(db, now);
  consumeOidcNonce(db, consumedNonce.nonce, now);
  recordLoginFailure(db, 'stale.guesser@example.test', now - 2 * DAY);
  recordLoginFailure(db, 'fresh.guesser@example.test', now - 60_000);

  const rowsBefore = {
    sessions: db.prepare('SELECT COUNT(*) AS n FROM account_sessions').get().n,
    tokens: db.prepare('SELECT COUNT(*) AS n FROM account_tokens').get().n
  };
  const record = runHousekeeping(db, now);
  c.deq({
    sessions: record.sessions, tokens: record.tokens, idempotencyKeys: record.idempotencyKeys,
    rateBuckets: record.rateBuckets, oidcNonces: record.oidcNonces, loginAttempts: record.loginAttempts
  }, { sessions: 2, tokens: 2, idempotencyKeys: 1, rateBuckets: 1, oidcNonces: 2, loginAttempts: 1 }, 'purge counts: expired + long-revoked sessions, expired + long-consumed tokens, expired keys, day-old buckets, expired/consumed nonces, stale login attempts');
  c.eq(record.ranAt, now, 'run time recorded');
  c.ok(Number.isFinite(record.durationMs) && record.durationMs >= 0, 'duration recorded');

  c.deq(db.prepare('SELECT id FROM account_sessions ORDER BY id').all().map(r => r.id).filter(id => !id.startsWith('ses_')), ['ses-live', 'ses-revoked-new'], 'live and recently revoked sessions survive');
  c.eq(db.prepare('SELECT COUNT(*) AS n FROM account_sessions WHERE id=?').get(fresh.id).n, 0, 'the idle-expired session was purged');
  c.eq(rowsBefore.sessions - record.sessions, db.prepare('SELECT COUNT(*) AS n FROM account_sessions').get().n, 'session count reconciles');
  c.deq(db.prepare('SELECT id FROM account_tokens WHERE id LIKE ? ORDER BY id').all('tok-%').map(r => r.id), ['tok-consumed-new', 'tok-live'], 'live and recently consumed tokens survive');
  c.eq(rowsBefore.tokens - record.tokens, db.prepare('SELECT COUNT(*) AS n FROM account_tokens').get().n, 'token count reconciles');
  c.eq(db.prepare("SELECT COUNT(*) AS n FROM auth_delivery_outbox WHERE id='mail-expired'").get().n, 0, 'the delivery envelope of a purged token cascades away');
  c.deq(db.prepare('SELECT key FROM idempotency_keys ORDER BY key').all().map(r => r.key), ['k-live'], 'only the live idempotency key remains');
  c.ok(db.prepare("SELECT 1 FROM rate_limits WHERE bucket='recent:bucket'").get() && !db.prepare("SELECT 1 FROM rate_limits WHERE bucket='old:bucket'").get(), 'day-old rate bucket purged, recent kept');
  c.eq(db.prepare('SELECT COUNT(*) AS n FROM oidc_nonces').get().n, 1, 'only the live nonce remains');
  c.eq(consumeOidcNonce(db, liveNonce.nonce, now), true, 'the surviving nonce is still usable');
  c.eq(consumeOidcNonce(db, expiredNonce.nonce, now), false, 'the expired nonce is gone');
  c.eq(db.prepare('SELECT COUNT(*) AS n FROM login_attempts').get().n, 1, 'only the fresh login-attempt record remains');

  const status = housekeepingStatus(db);
  c.eq(status.lastRunAt, now, 'status exposes the last run time');
  const health = await h.request('/v1/health');
  c.eq(health.status, 200, 'health responds');
  c.eq(health.data.housekeeping.lastRunAt, now, '/v1/health reports the last housekeeping run');
  c.eq(health.data.housekeeping.lastRun.sessions, 2, '/v1/health includes the purge summary');

  const started = startHousekeeping(db, { intervalMs: 60_000, log: () => {} });
  c.ok(started.first && started.first.ranAt >= now, 'startHousekeeping runs a pass immediately');
  c.eq(typeof started.stop, 'function', 'and can be stopped');
  started.stop();
} finally {
  await h.close();
  db.close();
}

// ── Operator CLI ──────────────────────────────────────────────────────────
{
  const dir = mkdtempSync(join(tmpdir(), 'pri-housekeeping-'));
  const file = join(dir, 'platform.db');
  const fileDb = createPlatformDb(file);
  try {
    const t = Date.now();
    fileDb.prepare("INSERT INTO accounts(id,email,name,role,created_at,updated_at) VALUES ('acct-cli','cli@example.test','CLI','student',?,?)").run(t, t);
    fileDb.prepare(`INSERT INTO account_sessions(id,account_id,token_hash,device_id,created_at,last_seen_at,expires_at)
      VALUES ('ses-cli-expired','acct-cli','h1','ipad',?,?,?)`).run(t - DAY, t - DAY, t - 1);
    fileDb.prepare(`INSERT INTO account_sessions(id,account_id,token_hash,device_id,created_at,last_seen_at,expires_at)
      VALUES ('ses-cli-live','acct-cli','h2','ipad',?,?,?)`).run(t, t, t + DAY);
    const env = { ...process.env, PRI_PLATFORM_DB: file };
    delete env.NODE_ENV;
    const run = spawnSync(process.execPath, [join(ROOT, 'server', 'tools', 'housekeeping.mjs')], { env, encoding: 'utf8' });
    c.eq(run.status, 0, `housekeeping CLI exits 0 (${run.stderr.trim()})`);
    const summary = JSON.parse(run.stdout.trim());
    c.eq(summary.sessions, 1, 'CLI purged the expired session');
    c.eq(fileDb.prepare('SELECT COUNT(*) AS n FROM account_sessions').get().n, 1, 'live session kept on disk');
    c.eq(housekeepingStatus(fileDb).lastRunAt, summary.ranAt, 'CLI run is recorded for health');
  } finally {
    fileDb.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

console.log(`HOUSEKEEPING — PASS — ${c.count()}/${c.count()} checks`);
