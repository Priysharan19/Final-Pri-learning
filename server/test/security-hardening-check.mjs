// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the server-side hardening set, each with a deterministic regression
//
//   H2  the guardian's withdrawal link outlives the one-hour confirmation token,
//       survives housekeeping, works once, and the email says exactly that;
//   M1  sessions have an absolute lifetime (PRI_SESSION_MAX_AGE_DAYS, default 90)
//       on top of the sliding 30 days; staff sessions idle out in 12 hours;
//   M2  an assignment PATCH is validated like a POST; teacher feedback is a
//       closed, bounded schema;
//   M3  a guardian's email must differ from the student's own;
//   M4  a per-account sync quota (rows and bytes) answers 413 SYNC_QUOTA_EXCEEDED
//       with the figures, stores nothing from the refused batch, and /v1/health
//       publishes the two limits and nothing per account;
//   M5  the audit log is append-only in code and, on Postgres, by privilege; the
//       sync tables carry a per-account restrictive RLS policy the store engages
//       for sync transactions;
//   M6  passwords over 72 bytes (bcrypt truncation) and the bundled top-1000
//       list are refused at registration, reset and change;
//   L1  class join codes are stored encrypted, never in clear beside the hash;
//       legacy clear codes are encrypted by housekeeping and on reveal;
//   L2  PRI_CSRF_SECRET must be at least 32 characters in production;
//   L3  the anonymous /v1/health carries no provider configuration or backlog
//       counts; the operator token and the admin health do.
// SQLite by default; `--engine=postgres` runs it on a migrated Postgres, where
// the M5 policies are proven against the real catalogue.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
// The quota is read per push from the environment, so a tiny byte cap makes the
// refusal reachable with a handful of events (the floor is 1 MiB).
process.env.PRI_SYNC_MAX_BYTES_PER_ACCOUNT = String(1024 * 1024);
process.env.PRI_METRICS_TOKEN = 'hardening-operator-token-of-32-characters-x';

const { startApp, verifyEmail, checks, enrolMfa } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const { decryptDeliveryToken } = await import('../platform/deliveryCrypto.js');
const { runHousekeeping } = await import('../platform/housekeeping.js');
const { drainAuthDeliveryOutbox, authEmailMessage, buildAuthActionUrl } = await import('../platform/authDelivery.js');
const { MAX_PASSWORD_BYTES, WITHDRAW_CREDENTIAL_MS, passwordProblem } = await import('../platform/accounts.js');
const { isCommonPassword, COMMON_PASSWORDS } = await import('../platform/commonPasswords.js');
const { validateGuardian } = await import('../platform/guardianConsent.js');
const { validateTeacherFeedback, decryptJoinCode, encryptJoinCode, isLegacyPlainJoinCode } = await import('../platform/classes.js');
const { PRIVILEGED_IDLE_MS, sessionMaxAgeMs, sha256 } = await import('../platform/security.js');
const { MIN_CSRF_SECRET_LENGTH, platformConfigStatus, syncQuota } = await import('../platform/config.js');
const { syncUsage } = await import('../platform/sync.js');

const c = checks();
const h = await startApp({ engine: requestedEngine() });
const db = h.db;
const code = r => r.data?.error?.code;
const resetLimits = () => db.run('DELETE FROM rate_limits');
let serial = 0;
async function account({ role = 'student', body = {} } = {}) {
  serial += 1;
  await resetLimits();
  const email = `hardening.${serial}@example.test`;
  const password = `hardening-pw-${serial}-horse`;
  const jar = {};
  const r = await h.request('/v1/account/register', { method: 'POST', jar, body: { name: 'Hardening User', email, password, deviceId: `ipad-h-${serial}`, isAdult: true, ...body } });
  if (r.status !== 201) throw new Error(`register: ${r.status} ${r.text}`);
  await verifyEmail(h, r.data.account.id);
  if (role !== 'student') await db.run('UPDATE accounts SET role=? WHERE id=?', [role, r.data.account.id]);
  const mfa = role === 'admin' || role === 'support' ? await enrolMfa(h, jar) : null;
  return { id: r.data.account.id, jar, email, password, deviceId: `ipad-h-${serial}`, mfa };
}
const outboxToken = async (accountId, kind) => {
  const row = await db.get('SELECT token_id,token_ciphertext FROM auth_delivery_outbox WHERE account_id=? AND kind=? ORDER BY created_at DESC LIMIT 1', [accountId, kind]);
  return row ? decryptDeliveryToken(row.token_ciphertext, `${accountId}:${kind}:${row.token_id}`) : null;
};

try {
  // ══ H2 · the guardian's withdrawal link ═══════════════════════════════════
  {
    const child = await account({ body: { isAdult: false, year: '8', guardianName: 'Guardian H2', guardianEmail: 'guardian.h2@example.test' } });
    const confirmToken = await outboxToken(child.id, 'guardian-consent');
    c.ok(confirmToken, 'a confirmation link is queued');
    c.eq(await outboxToken(child.id, 'guardian-withdraw'), null, 'no withdrawal link exists before confirmation');
    const consentMail = authEmailMessage('guardian-consent', buildAuthActionUrl('https://learn.pri.example', 'guardian-consent', 'tok'));
    c.ok(/1 hour/.test(consentMail.text) && /separate link/.test(consentMail.text) && /withdraw consent at any time/.test(consentMail.text), 'the consent email says this link lasts an hour and a separate withdrawal link follows');
    c.ok(!/this same link to withdraw/.test(consentMail.text), 'and no longer promises the one-hour link withdraws at any time');
    c.eq((await h.request('/v1/account/guardian/confirm', { method: 'POST', body: { token: confirmToken } })).data.confirmed, true, 'the guardian confirms');
    const withdrawToken = await outboxToken(child.id, 'guardian-withdraw');
    c.ok(withdrawToken && withdrawToken !== confirmToken, 'confirmation issues a separate withdrawal credential');
    const withdrawRow = await db.get("SELECT * FROM account_tokens WHERE account_id=? AND purpose='guardian-withdraw'", [child.id]);
    c.deq([withdrawRow.token_hash, withdrawRow.expires_at - withdrawRow.created_at, withdrawRow.consumed_at], [sha256(withdrawToken), WITHDRAW_CREDENTIAL_MS, null], 'stored as a hash, unspent, ten years long');
    c.eq((await db.get("SELECT destination FROM auth_delivery_outbox WHERE account_id=? AND kind='guardian-withdraw'", [child.id])).destination, 'guardian.h2@example.test', 'queued to the guardian\'s address');
    const withdrawMail = authEmailMessage('guardian-withdraw', buildAuthActionUrl('https://learn.pri.example', 'guardian-withdraw', 'tok'));
    c.ok(/does not expire/.test(withdrawMail.text) && /only withdraw/.test(withdrawMail.text) && /keep this email/i.test(withdrawMail.text), 'the withdrawal email says the link does not expire and can only withdraw');

    // Delivery, then seven hours of housekeeping: the confirmation token and
    // the delivered envelope are gone; the credential is not.
    const sent = [];
    await drainAuthDeliveryOutbox(db, { send: async m => { sent.push(m.kind); return { providerMessageId: `m-${sent.length}` }; }, publicOrigin: 'https://learn.pri.example' });
    c.ok(sent.includes('guardian-withdraw'), 'the worker delivers the withdrawal email through the same pipeline');
    await drainAuthDeliveryOutbox(db, { send: async () => ({ providerMessageId: 'x' }), publicOrigin: 'https://learn.pri.example' });
    c.eq((await db.get("SELECT COUNT(*) AS n FROM auth_delivery_outbox WHERE account_id=? AND kind='guardian-withdraw'", [child.id])).n, 0, 'the delivered withdrawal envelope is purged at once (the address is already in guardian_consents)');
    const later = Date.now() + 7 * 60 * 60 * 1000;
    const pass = await runHousekeeping(db, later);
    c.ok(pass.tokens >= 1, 'housekeeping seven hours on purges the spent confirmation token');
    c.eq(await db.get("SELECT 1 FROM account_tokens WHERE account_id=? AND purpose='guardian-consent'", [child.id]), undefined, 'the confirmation token is gone');
    c.ok(await db.get("SELECT 1 FROM account_tokens WHERE account_id=? AND purpose='guardian-withdraw' AND consumed_at IS NULL", [child.id]), 'the withdrawal credential survives housekeeping');
    c.eq((await h.request('/v1/account/guardian/confirm', { method: 'POST', body: { token: confirmToken } })).data.error.code, 'TOKEN_INVALID', 'the confirmation link is dead (still one hour, single use)');
    c.eq((await h.request('/v1/account/guardian/confirm', { method: 'POST', body: { token: withdrawToken } })).data.error.code, 'TOKEN_INVALID', 'the withdrawal credential can never confirm');
    c.eq((await h.request('/v1/account/password/reset', { method: 'POST', body: { token: withdrawToken, password: 'guardian-takeover-pw-1' } })).data.error.code, 'TOKEN_INVALID', 'nor reset the child\'s password');
    c.eq((await h.request('/v1/sync/pull/0', { jar: child.jar })).status, 200, 'the child syncs while consent stands');
    const withdrawn = await h.request('/v1/account/guardian/withdraw', { method: 'POST', body: { token: withdrawToken } });
    c.deq([withdrawn.status, withdrawn.data], [200, { ok: true, withdrawn: true }], 'the withdrawal credential withdraws, long after the confirmation token died');
    c.eq(code(await h.request('/v1/sync/pull/0', { jar: child.jar })), 'GUARDIAN_CONSENT_WITHDRAWN', 'and sync stops at once');
    c.eq((await h.request('/v1/account/guardian/withdraw', { method: 'POST', body: { token: withdrawToken } })).status, 400, 'the credential is revoked by the withdrawal it performed');
    c.ok((await db.get("SELECT 1 FROM audit_log WHERE action='guardian.withdraw' AND target_id=?", [child.id])), 'withdrawal is audited');
    const afterWithdraw = await runHousekeeping(db, Date.now() + 8 * 24 * 60 * 60 * 1000);
    c.ok(afterWithdraw.tokens >= 1 && !(await db.get("SELECT 1 FROM account_tokens WHERE account_id=?", [child.id])), 'a spent credential ages out like every consumed token');
  }

  // ══ M3 · the guardian is somebody else ════════════════════════════════════
  {
    c.eq(validateGuardian({ guardianName: 'P', guardianEmail: 'Kid@Example.test', studentEmail: 'kid@example.test' }).code, 'GUARDIAN_EMAIL_SAME_AS_STUDENT', 'validateGuardian refuses the student\'s own address, case-insensitively');
    c.eq(validateGuardian({ guardianName: 'P', guardianEmail: 'parent@example.test', studentEmail: 'kid@example.test' }).ok, true, 'and accepts a different one');
    await resetLimits();
    const same = await h.request('/v1/account/register', { method: 'POST', body: { name: 'Self Guardian', email: 'self.guardian@example.test', password: 'self-guardian-pw-1', deviceId: 'ipad-sg', year: '10', guardianName: 'Me', guardianEmail: 'SELF.GUARDIAN@example.test' } });
    c.deq([same.status, code(same)], [400, 'GUARDIAN_EMAIL_SAME_AS_STUDENT'], 'registration refuses a child who names their own mailbox');
    c.eq((await db.get("SELECT COUNT(*) AS n FROM accounts WHERE email='self.guardian@example.test'")).n, 0, 'and creates nothing');
  }

  // ══ M6 · password policy ═══════════════════════════════════════════════════
  {
    c.eq(COMMON_PASSWORDS.length, 1000, 'exactly one thousand bundled common passwords');
    c.eq(new Set(COMMON_PASSWORDS).size, 1000, 'all distinct');
    c.ok(isCommonPassword('password123') && isCommonPassword('Password123!') && isCommonPassword('sunshine2026') && isCommonPassword('iloveyou12'), 'common passwords and their digit/punctuation variants are recognised');
    c.ok(!isCommonPassword('correct-horse-battery') && !isCommonPassword('hardening-pw-9-horse'), 'ordinary passphrases are not');
    c.ok(isCommonPassword('qwerty' + '!'.repeat(60)) && !isCommonPassword('!'.repeat(60)) && !isCommonPassword('abc' + '1'.repeat(40)), 'the trailing digit/punctuation run is stripped in one linear pass: a long run is no slower, and a stem under four characters is not consulted');
    c.deq(passwordProblem('short'), { code: 'WEAK_PASSWORD', message: 'Password must be at least 10 characters.' }, 'too short is WEAK_PASSWORD');
    c.eq(passwordProblem('a'.repeat(72)), null, '72 bytes is accepted');
    c.eq(passwordProblem('a'.repeat(73))?.code, 'PASSWORD_TOO_LONG', '73 bytes is refused (bcrypt reads 72)');
    c.eq(passwordProblem(`${'é'.repeat(36)}x`)?.code, 'PASSWORD_TOO_LONG', 'bytes, not characters: 36 two-byte characters plus one is 73 bytes');
    c.eq(passwordProblem('Password2026!')?.code, 'PASSWORD_TOO_COMMON', 'a common password is refused however long');
    c.eq(MAX_PASSWORD_BYTES, 72, 'the limit is bcrypt\'s');
    await resetLimits();
    const long = await h.request('/v1/account/register', { method: 'POST', body: { name: 'Long', email: 'long.pw@example.test', password: 'b'.repeat(80), deviceId: 'x', isAdult: true } });
    c.deq([long.status, code(long)], [400, 'PASSWORD_TOO_LONG'], 'registration refuses an over-long password');
    const common = await h.request('/v1/account/register', { method: 'POST', body: { name: 'Common', email: 'common.pw@example.test', password: 'qwertyuiop123', deviceId: 'x', isAdult: true } });
    c.deq([common.status, code(common)], [400, 'PASSWORD_TOO_COMMON'], 'registration refuses a common password');
    const user = await account();
    const change = await h.request('/v1/account/password', { method: 'PATCH', jar: user.jar, body: { currentPassword: user.password, newPassword: 'iloveyou2026' } });
    c.deq([change.status, code(change)], [400, 'PASSWORD_TOO_COMMON'], 'password change refuses a common password');
    c.eq(code(await h.request('/v1/account/password', { method: 'PATCH', jar: user.jar, body: { currentPassword: user.password, newPassword: 'c'.repeat(73) } })), 'PASSWORD_TOO_LONG', 'and an over-long one');
    await resetLimits();
    await h.request('/v1/account/password/reset-request', { method: 'POST', body: { email: user.email } });
    const resetToken = await outboxToken(user.id, 'reset-password');
    c.eq(code(await h.request('/v1/account/password/reset', { method: 'POST', body: { token: resetToken, password: 'football2026' } })), 'PASSWORD_TOO_COMMON', 'password reset refuses a common password');
    c.eq((await h.request('/v1/account/password/reset', { method: 'POST', body: { token: resetToken, password: 'a-perfectly-fine-passphrase' } })).status, 200, 'the token is still live and a good password resets');
  }

  // ══ M1 · session lifetime ═════════════════════════════════════════════════
  {
    c.eq(sessionMaxAgeMs(), 90 * 24 * 60 * 60 * 1000, 'the default absolute lifetime is 90 days');
    c.eq(sessionMaxAgeMs({ PRI_SESSION_MAX_AGE_DAYS: '30' }), 30 * 24 * 60 * 60 * 1000, 'PRI_SESSION_MAX_AGE_DAYS sets it');
    for (const bad of ['0', '-1', 'abc', '3651', '1.5']) c.ok((() => { try { sessionMaxAgeMs({ PRI_SESSION_MAX_AGE_DAYS: bad }); return false; } catch (e) { return e.code === 'SESSION_MAX_AGE_INVALID'; } })(), `PRI_SESSION_MAX_AGE_DAYS=${bad} is refused`);
    c.ok(platformConfigStatus.call(null) && (() => { const saved = process.env.PRI_SESSION_MAX_AGE_DAYS; process.env.PRI_SESSION_MAX_AGE_DAYS = 'x'; const missing = platformConfigStatus().missing; if (saved === undefined) delete process.env.PRI_SESSION_MAX_AGE_DAYS; else process.env.PRI_SESSION_MAX_AGE_DAYS = saved; return missing.some(m => m.startsWith('PRI_SESSION_MAX_AGE_DAYS')); })(), 'a malformed value is a configuration problem, not a silent default');
    const student = await account();
    const row = () => db.get('SELECT * FROM account_sessions WHERE account_id=? AND revoked_at IS NULL', [student.id]);
    const fresh = await row();
    c.ok(fresh.expires_at - fresh.created_at === 30 * 24 * 60 * 60 * 1000, 'a new student session expires in 30 days');
    // 89 days old and used today: still inside the cap, and the slide may not pass the cap.
    const day = 24 * 60 * 60 * 1000;
    await db.run('UPDATE account_sessions SET created_at=?, last_seen_at=?, expires_at=? WHERE id=?', [Date.now() - 89 * day, Date.now() - 2 * 60_000, Date.now() + 30 * day, fresh.id]);
    const slid = await h.request('/v1/account/me', { jar: student.jar });
    c.eq(slid.status, 200, 'an 89-day-old session still works');
    const capped = await row();
    c.ok(capped.expires_at <= capped.created_at + sessionMaxAgeMs() && capped.expires_at < Date.now() + 2 * day, 'but its slide is capped at the absolute lifetime (about one day left, not 30)');
    c.ok(slid.headers.getSetCookie().some(x => /^pri_cloud_session=.+Max-Age=(8\d{4})\b/.test(x)), 'and the re-issued cookie carries the capped lifetime');
    await db.run('UPDATE account_sessions SET created_at=?, last_seen_at=?, expires_at=? WHERE id=?', [Date.now() - 91 * day, Date.now() - 60_000, Date.now() + 30 * day, fresh.id]);
    c.eq((await h.request('/v1/account/me', { jar: student.jar })).status, 401, 'a 91-day-old session is refused even though expires_at is in the future');
    c.ok((await db.get('SELECT revoked_at FROM account_sessions WHERE id=?', [fresh.id])).revoked_at > 0, 'and revoked, so housekeeping removes it');
    const admin = await account({ role: 'admin' });
    const adminRow = await db.get('SELECT * FROM account_sessions WHERE account_id=? AND revoked_at IS NULL', [admin.id]);
    c.ok(adminRow.expires_at - adminRow.created_at <= 30 * day, 'an admin\'s session row was issued before promotion (30 days)');
    await db.run('UPDATE account_sessions SET last_seen_at=? WHERE id=?', [Date.now() - 11 * 60 * 60 * 1000, adminRow.id]);
    const adminSlid = await h.request('/v1/account/me', { jar: admin.jar });
    c.eq(adminSlid.status, 200, 'an admin idle for 11 hours is still signed in');
    c.ok((await db.get('SELECT expires_at FROM account_sessions WHERE id=?', [adminRow.id])).expires_at <= Date.now() + PRIVILEGED_IDLE_MS + 1000, 'and the slide gives a staff session 12 hours, not 30 days');
    await db.run('UPDATE account_sessions SET last_seen_at=? WHERE id=?', [Date.now() - PRIVILEGED_IDLE_MS - 1000, adminRow.id]);
    c.eq((await h.request('/v1/account/me', { jar: admin.jar })).status, 401, 'an admin idle for 12 hours is signed out');
    await resetLimits();
    const relogin = {};
    c.eq((await h.request('/v1/account/login', { method: 'POST', jar: relogin, body: { email: admin.email, password: admin.password, deviceId: 'mac-2' } })).status, 200, 'the admin signs in again');
    const issued = await db.get('SELECT * FROM account_sessions WHERE account_id=? AND device_id=?', [admin.id, 'mac-2']);
    c.eq(issued.expires_at - issued.created_at, PRIVILEGED_IDLE_MS, 'a session issued to an admin is 12 hours from the start');
  }

  // ══ M2 · assignment PATCH and teacher feedback schemas ═══════════════════
  {
    c.eq(validateTeacherFeedback({ note: 'Good', score: 7, grade: 'B+', nextSteps: 'Q4', rubric: [{ criterion: 'Method', comment: 'ok', score: 3 }] }).ok, true, 'a well-formed feedback object is accepted');
    c.deq(validateTeacherFeedback({ note: ' Trim me  ', ignored: null }).feedback, { note: 'Trim me' }, 'text is trimmed and null values are dropped');
    for (const [label, input] of [['unknown key', { answerKey: 'x' }], ['over-long note', { note: 'x'.repeat(4001) }], ['non-text grade', { grade: 5 }], ['negative score', { score: -1 }], ['rubric not a list', { rubric: {} }], ['rubric item without criterion', { rubric: [{ comment: 'x' }] }], ['rubric item unknown key', { rubric: [{ criterion: 'c', ink: 'x' }] }], ['too many rubric items', { rubric: Array.from({ length: 21 }, () => ({ criterion: 'c' })) }]]) {
      c.eq(validateTeacherFeedback(input).code, 'FEEDBACK_INVALID', `feedback with ${label} is refused`);
    }
    const teacher = await account({ role: 'teacher' });
    const student = await account();
    const created = await h.request('/v1/classes/', { method: 'POST', jar: teacher.jar, body: { name: 'Hardening 9A' } });
    c.eq(created.status, 201, 'teacher creates a class');
    const classId = created.data.class.id;
    c.eq((await h.request('/v1/classes/join', { method: 'POST', jar: student.jar, body: { code: created.data.joinCode } })).status, 200, 'student joins');
    const assignment = await h.request(`/v1/classes/${classId}/assignments`, { method: 'POST', jar: teacher.jar, body: { title: 'Drill', specification: { questionCount: 5 } } });
    c.eq(assignment.status, 201, 'teacher creates an assignment');
    const assignmentId = assignment.data.assignment.id;
    const before = (await db.get('SELECT specification_json FROM assignments WHERE id=?', [assignmentId])).specification_json;
    const bad = await h.request(`/v1/classes/${classId}/assignments/${assignmentId}`, { method: 'PATCH', jar: teacher.jar, body: { specification: { questionCount: 0 } } });
    c.deq([bad.status, code(bad)], [400, 'ASSIGNMENT_SPEC_INVALID'], 'a PATCH with an invalid specification is refused');
    const smuggled = await h.request(`/v1/classes/${classId}/assignments/${assignmentId}`, { method: 'PATCH', jar: teacher.jar, body: { specification: { questionCount: 6, answers: ['42'], expected: 'x' } } });
    c.eq(smuggled.status, 200, 'a PATCH with unknown keys is accepted');
    const after = JSON.parse((await db.get('SELECT specification_json FROM assignments WHERE id=?', [assignmentId])).specification_json);
    c.deq(after, { kind: 'practice', questionCount: 6 }, 'but only the validated specification is stored');
    c.ok(before !== JSON.stringify(after) && !JSON.stringify(after).includes('42'), 'nothing smuggled reached storage');
    c.eq((await h.request(`/v1/classes/${classId}/assignments/${assignmentId}/submission`, { method: 'PATCH', jar: student.jar, body: { state: 'submitted', summary: {} } })).status, 200, 'student submits');
    const badFeedback = await h.request(`/v1/classes/${classId}/assignments/${assignmentId}/submissions/${student.id}/return`, { method: 'POST', jar: teacher.jar, body: { feedback: { note: 'ok', answerKey: 'x' } } });
    c.deq([badFeedback.status, code(badFeedback)], [400, 'FEEDBACK_INVALID'], 'feedback with an unknown key is refused');
    c.eq((await db.get('SELECT state FROM assignment_submissions WHERE assignment_id=? AND student_account_id=?', [assignmentId, student.id])).state, 'submitted', 'and the submission is not returned');
    const returned = await h.request(`/v1/classes/${classId}/assignments/${assignmentId}/submissions/${student.id}/return`, { method: 'POST', jar: teacher.jar, body: { feedback: { note: ' Rework Q2 ', score: 4, rubric: [{ criterion: 'Working', comment: 'Show steps' }] } } });
    c.eq(returned.status, 200, 'well-formed feedback returns the work');
    c.deq(JSON.parse((await db.get('SELECT feedback_json FROM assignment_feedback WHERE assignment_id=? AND student_account_id=?', [assignmentId, student.id])).feedback_json), { note: 'Rework Q2', score: 4, rubric: [{ criterion: 'Working', comment: 'Show steps' }] }, 'the stored feedback is the validated, trimmed object');

    // L1 lives here too: the class exists.
    const stored = await db.get('SELECT join_code, join_code_hash FROM classes WHERE id=?', [classId]);
    c.ok(stored.join_code !== created.data.joinCode && !isLegacyPlainJoinCode(stored.join_code), 'the join code is not stored in clear');
    c.eq(decryptJoinCode(stored.join_code, classId), created.data.joinCode, 'it decrypts for its own class');
    c.eq(decryptJoinCode(stored.join_code, 'cls_other'), null, 'and not for another (bound to the class id)');
    c.eq(stored.join_code_hash, sha256(created.data.joinCode), 'the hash remains the join lookup key');
    c.eq((await h.request(`/v1/classes/${classId}/join-code`, { jar: teacher.jar })).data.joinCode, created.data.joinCode, 'the teacher can still reveal it');
    const rotated = await h.request(`/v1/classes/${classId}/join-code/rotate`, { method: 'POST', jar: teacher.jar, body: {} });
    c.ok(rotated.status === 200 && decryptJoinCode((await db.get('SELECT join_code FROM classes WHERE id=?', [classId])).join_code, classId) === rotated.data.joinCode, 'rotation stores the new code encrypted');
    // A legacy clear code (pre-v9 row) is encrypted by housekeeping, and the reveal still works meanwhile.
    await db.run('UPDATE classes SET join_code=? WHERE id=?', ['LEGACY77', classId]);
    c.eq((await h.request(`/v1/classes/${classId}/join-code`, { jar: teacher.jar })).data.joinCode, 'LEGACY77', 'a legacy clear code reveals');
    c.ok(!isLegacyPlainJoinCode((await db.get('SELECT join_code FROM classes WHERE id=?', [classId])).join_code), 'and is re-stored encrypted on sight');
    await db.run('UPDATE classes SET join_code=? WHERE id=?', ['LEGACY88', classId]);
    const sweep = await runHousekeeping(db);
    c.ok(sweep.joinCodesEncrypted >= 1 && decryptJoinCode((await db.get('SELECT join_code FROM classes WHERE id=?', [classId])).join_code, classId) === 'LEGACY88', 'housekeeping encrypts legacy clear codes in place');
    c.eq(encryptJoinCode('ABCD1234', 'cls_x').split('.')[0], 'v1', 'the envelope is the delivery-crypto format');
  }

  // ══ M4 · per-account sync quota ═══════════════════════════════════════════
  {
    const quota = syncQuota();
    c.deq([quota.maxBytesPerAccount, quota.maxEventsPerAccount], [1024 * 1024, 200_000], 'the quota reads PRI_SYNC_MAX_BYTES_PER_ACCOUNT (set to 1 MiB here) and the default 200k rows');
    c.eq(syncQuota({}).maxBytesPerAccount, 64 * 1024 * 1024, 'the default byte cap is 64 MiB');
    c.ok((() => { try { syncQuota({ PRI_SYNC_MAX_EVENTS: '10' }); return false; } catch (e) { return e.code === 'PLATFORM_DB_CONFIG_INVALID'; } })(), 'a quota below its floor is a configuration error');
    const user = await account();
    const big = 'x'.repeat(250 * 1024);
    const push = (seq, payload, key) => h.request('/v1/sync/push', { method: 'POST', jar: user.jar, headers: { 'Idempotency-Key': key }, body: { schemaVersion: 1, deviceId: user.deviceId, events: [{ id: `evt-${seq}`, deviceId: user.deviceId, deviceSeq: seq, kind: 'practice-attempt', payload }], entities: [] } });
    for (let seq = 1; seq <= 4; seq++) {
      await resetLimits();
      c.eq((await push(seq, { blob: big }, `q-${seq}`)).status, 200, `push ${seq} of ~250 KiB is stored`);
    }
    const usage = await syncUsage(db, user.id);
    c.ok(usage.rows === 4 && usage.bytes > 4 * 250 * 1024 && usage.bytes < 1024 * 1024, `usage is counted in rows and bytes (${usage.rows} rows, ${usage.bytes} bytes)`);
    const over = await push(5, { blob: big }, 'q-5');
    c.deq([over.status, code(over)], [413, 'SYNC_QUOTA_EXCEEDED'], 'the push that would cross the cap is refused');
    c.deq([over.data.error.quota.maxBytesPerAccount, over.data.error.quota.maxEventsPerAccount, over.data.error.quota.usedRows], [1024 * 1024, 200_000, 4], 'with the quota figures and this account\'s usage');
    c.eq((await db.get('SELECT COUNT(*) AS n FROM learning_events WHERE account_id=?', [user.id])).n, 4, 'nothing from the refused batch was stored');
    c.eq(await db.get("SELECT 1 FROM idempotency_keys WHERE account_id=? AND key='q-5'", [user.id]), undefined, 'and no idempotency key was recorded for it');
    const small = await push(5, { ok: true }, 'q-5-small');
    c.eq(small.status, 200, 'a small push still fits under the cap');
    const other = await account();
    c.eq((await h.request('/v1/sync/push', { method: 'POST', jar: other.jar, headers: { 'Idempotency-Key': 'o-1' }, body: { schemaVersion: 1, deviceId: other.deviceId, events: [{ id: 'evt-o', deviceId: other.deviceId, deviceSeq: 1, kind: 'practice-attempt', payload: { blob: big } }], entities: [] } })).status, 200, 'another account\'s quota is its own');
    const health = await h.request('/v1/health');
    c.deq(health.data.syncQuota, { maxBytesPerAccount: 1024 * 1024, maxEventsPerAccount: 200_000 }, '/v1/health publishes the two limits');
    c.ok(!JSON.stringify(health.data).includes(user.id) && !JSON.stringify(health.data).includes('usedBytes'), 'and nothing per account');
  }

  // ══ M5 · append-only audit log, per-account scope ═════════════════════════
  {
    const sources = readdirSync(join(ROOT, 'server', 'platform')).filter(f => f.endsWith('.js')).map(f => readFileSync(join(ROOT, 'server', 'platform', f), 'utf8')).join('\n')
      + readdirSync(join(ROOT, 'server', 'tools')).filter(f => f.endsWith('.mjs')).map(f => readFileSync(join(ROOT, 'server', 'tools', f), 'utf8')).join('\n');
    c.ok(!/\b(UPDATE|DELETE\s+FROM)\s+audit_log\b/i.test(sources), 'no server code updates or deletes audit_log rows (append-only in code on both engines)');
    const migration = readFileSync(join(ROOT, 'supabase', 'migrations', '20261007000000_security_hardening.sql'), 'utf8');
    c.ok(/revoke update, delete on pri\.audit_log from pri_server;/.test(migration), 'the migration revokes UPDATE and DELETE on pri.audit_log from pri_server');
    for (const table of ['learning_events', 'sync_entities', 'idempotency_keys']) {
      c.ok(new RegExp(`create policy pri_account_scope on pri\\.${table} as restrictive for all to pri_server`).test(migration), `a restrictive per-account policy on pri.${table}`);
    }
    c.ok(/update pri\.platform_meta set value = '11' where key = 'schema_version';/.test(migration), 'and moves schema_version to 11');
    const a = await account();
    const b = await account();
    await resetLimits();
    for (const who of [a, b]) {
      c.eq((await h.request('/v1/sync/push', { method: 'POST', jar: who.jar, headers: { 'Idempotency-Key': 'scope-1' }, body: { schemaVersion: 1, deviceId: who.deviceId, events: [{ id: 'evt-scope', deviceId: who.deviceId, deviceSeq: 1, kind: 'practice-attempt', payload: { who: who.id } }], entities: [] } })).status, 200, 'each account pushes one event');
    }
    // The store engages the scope for sync transactions; on Postgres the policy enforces it.
    const seen = await db.transaction(async () => ({
      own: (await db.get('SELECT COUNT(*) AS n FROM learning_events WHERE account_id=?', [a.id])).n,
      other: (await db.get('SELECT COUNT(*) AS n FROM learning_events WHERE account_id=?', [b.id])).n,
      scope: db.accountScope()
    }), { accountScope: a.id });
    c.eq(seen.scope, a.id, 'a transaction records its account scope');
    c.eq(Number(seen.own), 1, 'the scoped account\'s own rows are visible');
    if (h.engine === 'postgres') {
      c.eq(Number(seen.other), 0, 'Postgres: another account\'s rows are invisible inside a scoped transaction, even to a query that asks for them');
      let refused = null;
      try {
        await db.transaction(async () => {
          await db.run('INSERT INTO learning_events(server_cursor,id,account_id,device_id,device_seq,kind,entity_id,occurred_at,payload_json,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)', [9_999_999, 'evt-smuggle', b.id, 'dev', 99, 'practice-attempt', null, null, '{}', Date.now()]);
        }, { accountScope: a.id });
      } catch (error) { refused = error; }
      c.eq(String(refused?.dbCode || refused?.code || ''), '42501', 'Postgres: writing another account\'s row inside a scoped transaction is refused by the policy');
      c.eq((await db.get('SELECT COUNT(*) AS n FROM learning_events WHERE account_id=?', [b.id])).n, 1, 'and nothing was written');
      c.eq(Number((await db.get('SELECT COUNT(*) AS n FROM learning_events WHERE account_id=?', [b.id])).n), 1, 'outside a scoped transaction (the GUC unset) every row is reachable as before');
    } else {
      c.eq(Number(seen.other), 1, 'SQLite: the scope is recorded only; the handlers\' own account filters are the control');
    }
    let nested = null;
    try { await db.transaction(() => db.transaction(() => null, { accountScope: b.id }), { accountScope: a.id }); } catch (error) { nested = error; }
    c.eq(nested?.code, 'STORE_ACCOUNT_SCOPE_NESTED', 'a nested transaction cannot widen or change the scope');
    let invalid = null;
    try { await db.transaction(() => null, { accountScope: '' }); } catch (error) { invalid = error; }
    c.eq(invalid?.code, 'STORE_ACCOUNT_SCOPE_INVALID', 'an empty scope is refused');
    c.eq(code(await h.request('/v1/sync/pull/0', { jar: a.jar })), undefined, 'pull (which runs scoped) still answers');
    c.eq((await h.request('/v1/sync/pull/0', { jar: a.jar })).data.events.length, 1, 'with exactly the caller\'s rows');
  }

  // ══ L2 · CSRF secret length in production ════════════════════════════════
  {
    const saved = { NODE_ENV: process.env.NODE_ENV, PRI_CSRF_SECRET: process.env.PRI_CSRF_SECRET };
    process.env.NODE_ENV = 'production';
    process.env.PRI_CSRF_SECRET = 'x'.repeat(MIN_CSRF_SECRET_LENGTH - 1);
    c.ok(platformConfigStatus().missing.some(m => m.startsWith('PRI_CSRF_SECRET (at least 32')), `a ${MIN_CSRF_SECRET_LENGTH - 1}-character PRI_CSRF_SECRET is a production configuration problem`);
    process.env.PRI_CSRF_SECRET = 'x'.repeat(MIN_CSRF_SECRET_LENGTH);
    c.ok(!platformConfigStatus().missing.some(m => m.startsWith('PRI_CSRF_SECRET')), `a ${MIN_CSRF_SECRET_LENGTH}-character one is not`);
    delete process.env.PRI_CSRF_SECRET;
    c.ok(platformConfigStatus().missing.includes('PRI_CSRF_SECRET'), 'and a missing one is still reported as missing');
    for (const [name, value] of Object.entries(saved)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
  }

  // ══ L3 · /v1/health exposure ═════════════════════════════════════════════
  {
    const anonymous = await h.request('/v1/health');
    c.eq(anonymous.status, 200, 'health answers anonymously');
    c.deq(Object.keys(anonymous.data).sort(), ['billingSchemaVersion', 'checkedAt', 'database', 'ok', 'releaseIdentity', 'schemaVersion', 'service', 'syncQuota'], 'the anonymous body carries ok, release identity, schema versions, engine, reachability and the quota limits — nothing else');
    c.ok(anonymous.data.ok === true && typeof anonymous.data.releaseIdentity === 'object' && anonymous.data.database.reachable === true, 'ok, release identity and reachability are kept');
    const operator = await h.request('/v1/health', { headers: { Authorization: `Bearer ${process.env.PRI_METRICS_TOKEN}` } });
    for (const field of ['identityProviders', 'authDelivery', 'billingProviders', 'housekeeping', 'storage', 'clientCompatibility', 'staffMfa']) {
      c.ok(field in operator.data && !(field in anonymous.data), `${field} is answered to the operator token only`);
    }
    c.eq((await h.request('/v1/health', { headers: { Authorization: 'Bearer wrong-token' } })).data.identityProviders, undefined, 'a wrong token gets the anonymous body');
    const admin = await account({ role: 'admin' });
    const adminHealth = await h.request('/v1/admin/health', { jar: admin.jar });
    c.ok(adminHealth.status === 200 && 'identityProviders' in adminHealth.data && 'housekeeping' in adminHealth.data && 'billingProviders' in adminHealth.data, 'an admin session reads the same detail on /v1/admin/health');
  }
} finally {
  await h.close();
}

console.log(`engine: ${h.engine}`);
console.log(`SECURITY HARDENING — PASS — ${c.count()}/${c.count()} checks`);
