// Login hardening contract (quality-04).
//
// Per-account lockout with a sliding failure window, keyed on the submitted
// email whether or not it exists, so a registered and an unknown address get
// byte-identical responses and comparable timing (one bcrypt comparison always
// runs). The per-IP rate limit is unchanged and still fires.

import { performance } from 'node:perf_hooks';

const { startApp, registerAccount, checks } = await import('./support/app-harness.mjs');
const {
  LOCKOUT_LOCK_MS, LOCKOUT_MAX_FAILURES, LOCKOUT_WINDOW_MS,
  loginAttemptKey, loginLockStatus, recordLoginFailure
} = await import('../platform/loginLockout.js');

const c = checks();
const h = await startApp();
const db = h.db;
const clearLoginRate = () => db.prepare("DELETE FROM rate_limits WHERE bucket LIKE 'login:%'").run();
const login = (email, password) => h.request('/v1/account/login', { method: 'POST', body: { email, password, deviceId: 'ipad-lock' } });
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

async function failureSequence(email) {
  const out = [];
  for (let i = 1; i <= LOCKOUT_MAX_FAILURES + 1; i++) {
    const r = await login(email, `wrong-password-${i}`);
    out.push({ status: r.status, data: r.data, retryAfter: r.headers.get('retry-after') });
  }
  return out;
}

try {
  const KNOWN = 'locked.student@example.test';
  const reg = await registerAccount(h, { email: KNOWN, password: 'right-password-123' });
  c.eq(reg.status, 201, 'account registered');

  // 1. Ten failures lock the account; the eleventh is refused before bcrypt.
  const known = await failureSequence(KNOWN);
  c.ok(known.slice(0, LOCKOUT_MAX_FAILURES).every(r => r.status === 401 && r.data?.error?.code === 'BAD_CREDENTIALS' && r.data.error.message === 'Incorrect email or password.'),
    `first ${LOCKOUT_MAX_FAILURES} failures answer 401 BAD_CREDENTIALS with one body`);
  c.eq(known[LOCKOUT_MAX_FAILURES].status, 429, 'attempt after the lock threshold is refused');
  c.eq(known[LOCKOUT_MAX_FAILURES].data?.error?.code, 'ACCOUNT_LOCKED', 'lock is named');
  const retryAfter = Number(known[LOCKOUT_MAX_FAILURES].retryAfter);
  c.ok(retryAfter >= 1 && retryAfter <= LOCKOUT_LOCK_MS / 1000, `Retry-After is within the lock window (${retryAfter}s)`);
  const row = db.prepare('SELECT * FROM login_attempts WHERE email_hash = ?').get(loginAttemptKey(KNOWN));
  c.ok(row && row.failures === LOCKOUT_MAX_FAILURES && row.locked_until > Date.now(), 'lock persisted per account');
  c.ok(!Object.values(row).includes(KNOWN), 'the lockout table stores only an email hash');

  clearLoginRate();
  const lockedCorrect = await login(KNOWN, 'right-password-123');
  c.eq(lockedCorrect.status, 429, 'the correct password does not bypass an active lock');
  c.eq(lockedCorrect.data?.error?.code, 'ACCOUNT_LOCKED', 'locked response is the same for the right password');

  // 2. An unknown email gets exactly the same sequence.
  clearLoginRate();
  const unknown = await failureSequence('nobody.here@example.test');
  c.deq(unknown.map(r => [r.status, r.data]), known.map(r => [r.status, r.data]), 'unknown email is indistinguishable from a registered one (status + body)');

  // 3. Timing: one bcrypt comparison runs on every path.
  clearLoginRate();
  const KNOWN2 = 'timing.student@example.test';
  await registerAccount(h, { email: KNOWN2, password: 'another-right-password' });
  const knownMs = [];
  const unknownMs = [];
  for (let i = 0; i < 3; i++) {
    let t = performance.now();
    await login(KNOWN2, 'wrong-password-x');
    knownMs.push(performance.now() - t);
    t = performance.now();
    await login(`ghost-${i}@example.test`, 'wrong-password-x');
    unknownMs.push(performance.now() - t);
  }
  const k = median(knownMs);
  const u = median(unknownMs);
  c.ok(k >= 40 && u >= 40, `both failure paths pay for a bcrypt comparison (known ${k.toFixed(0)}ms, unknown ${u.toFixed(0)}ms)`);
  c.ok(u >= k * 0.5 && u <= k * 2, `unknown-email failure timing is within 2x of a registered account (known ${k.toFixed(0)}ms, unknown ${u.toFixed(0)}ms)`);

  // 4. When the lock expires, the correct password signs in and clears the record.
  db.prepare('UPDATE login_attempts SET locked_until = ?, last_failed_at = ? WHERE email_hash = ?').run(Date.now() - 1, Date.now() - LOCKOUT_WINDOW_MS - 1, loginAttemptKey(KNOWN));
  clearLoginRate();
  const afterLock = await login(KNOWN, 'right-password-123');
  c.eq(afterLock.status, 200, 'sign-in succeeds once the lock has expired');
  c.eq(db.prepare('SELECT 1 FROM login_attempts WHERE email_hash = ?').get(loginAttemptKey(KNOWN)), undefined, 'success clears the failure record');

  // 5. A few failures followed by success also clear the counter.
  // Step 3's timing probe left failures on KNOWN2 inside the same sliding
  // window, so start from a clean record to count exactly three.
  clearLoginRate();
  db.prepare('DELETE FROM login_attempts WHERE email_hash = ?').run(loginAttemptKey(KNOWN2));
  for (let i = 0; i < 3; i++) await login(KNOWN2, 'wrong-password-y');
  c.eq(db.prepare('SELECT failures FROM login_attempts WHERE email_hash = ?').get(loginAttemptKey(KNOWN2))?.failures, 3, 'failures accumulate');
  c.eq((await login(KNOWN2, 'another-right-password')).status, 200, 'correct password after three failures signs in');
  c.eq(db.prepare('SELECT 1 FROM login_attempts WHERE email_hash = ?').get(loginAttemptKey(KNOWN2)), undefined, 'counter cleared by success');

  // 6. Sliding window semantics with a controlled clock: the window follows
  // the most recent failure, so slow guessing that stays inside 15-minute
  // gaps still locks, while a 15-minute pause resets the count.
  const t0 = 1_800_000_000_000;
  const SLOW = 'slow.guesser@example.test';
  for (let i = 0; i < LOCKOUT_MAX_FAILURES - 1; i++) recordLoginFailure(db, SLOW, t0 + i * 60_000);
  const lastSlow = t0 + (LOCKOUT_MAX_FAILURES - 2) * 60_000;
  c.eq(loginLockStatus(db, SLOW, lastSlow + 1).locked, false, 'nine failures do not lock');
  const tenth = recordLoginFailure(db, SLOW, lastSlow + LOCKOUT_WINDOW_MS - 60_000);
  c.eq(tenth.locked, true, 'a tenth failure 14 minutes after the ninth (22 minutes after the first) locks — the window slides');
  c.eq(loginLockStatus(db, SLOW, lastSlow + LOCKOUT_WINDOW_MS).retryAfterMs > 0, true, 'lock reports a retry delay');
  c.eq(loginLockStatus(db, SLOW, lastSlow + LOCKOUT_WINDOW_MS - 60_000 + LOCKOUT_LOCK_MS + 1).locked, false, 'lock lifts after LOCKOUT_LOCK_MS');

  const PAUSED = 'paused.guesser@example.test';
  for (let i = 0; i < LOCKOUT_MAX_FAILURES - 1; i++) recordLoginFailure(db, PAUSED, t0 + i * 1000);
  const reset = recordLoginFailure(db, PAUSED, t0 + (LOCKOUT_MAX_FAILURES - 2) * 1000 + LOCKOUT_WINDOW_MS + 1);
  c.eq(reset.failures, 1, 'a failure more than 15 minutes after the last one starts a fresh window');
  c.eq(reset.locked, false, 'and does not lock');

  // 7. The per-IP login rate limit is unchanged (12 per 15 minutes).
  clearLoginRate();
  const RATE = 'rate.student@example.test';
  await registerAccount(h, { email: RATE, password: 'rate-limit-password' });
  clearLoginRate();
  const statuses = [];
  for (let i = 0; i < 13; i++) statuses.push(await login(RATE, 'rate-limit-password'));
  c.ok(statuses.slice(0, 12).every(r => r.status === 200), 'twelve sign-ins in the window succeed');
  c.eq(statuses[12].status, 429, 'the thirteenth is rate limited');
  c.eq(statuses[12].data?.error?.code, 'RATE_LIMITED', 'rate limit keeps its own code, distinct from lockout');
} finally {
  await h.close();
  db.close();
}

console.log(`LOGIN LOCKOUT — PASS — ${c.count()}/${c.count()} checks`);
