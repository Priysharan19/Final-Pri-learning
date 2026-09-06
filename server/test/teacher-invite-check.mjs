// Teacher invite contract (cloud-01, teacher-11 server half).
//
//   POST /v1/admin/teacher-invites {ttlDays?} -> 201 {code, expiresAt}   (admin)
//   GET  /v1/admin/teacher-invites -> {invites:[{code_prefix, expiresAt, usedBy?}]}
//   POST /v1/auth/register {..., teacherInviteCode?} -> role 'teacher' when the
//        code is live; otherwise 400 TEACHER_INVITE_INVALID
//
// Codes are stored only as a SHA-256 hash plus a display prefix, are single
// use, and expire.

const { startApp, registerAccount, verifyEmail, checks } = await import('./support/app-harness.mjs');
const { sha256 } = await import('../platform/security.js');
const { INVITE_DEFAULT_TTL_DAYS } = await import('../platform/teacherInvites.js');

const c = checks();
const h = await startApp();
const db = h.db;
const DAY = 24 * 60 * 60 * 1000;
const CODE = /^PRI-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/;
const mint = (jar, body = {}) => h.request('/v1/admin/teacher-invites', { method: 'POST', jar, body });
const list = jar => h.request('/v1/admin/teacher-invites', { jar });

try {
  const admin = await registerAccount(h, { email: 'admin@example.test', name: 'Pri Admin' });
  db.prepare("UPDATE accounts SET role='admin' WHERE id=?").run(admin.account.id);
  const student = await registerAccount(h, { email: 'student@example.test' });

  c.eq((await h.request('/v1/admin/teacher-invites', { method: 'POST', body: {} })).status, 401, 'minting needs a session');
  c.eq((await mint(student.jar)).status, 403, 'students cannot mint');
  c.eq((await list(student.jar)).status, 403, 'students cannot list');

  const before = Date.now();
  const first = await mint(admin.jar);
  c.eq(first.status, 201, 'admin mints an invite');
  c.match(first.data.code, CODE, 'code has the PRI-XXXX-XXXX-XXXX-XXXX shape');
  c.ok(Math.abs(first.data.expiresAt - (before + INVITE_DEFAULT_TTL_DAYS * DAY)) < 10_000, `default TTL is ${INVITE_DEFAULT_TTL_DAYS} days`);
  c.deq(Object.keys(first.data).sort(), ['code', 'expiresAt'], 'response is exactly {code, expiresAt}');

  const short = await mint(admin.jar, { ttlDays: 3 });
  c.eq(short.status, 201, 'custom TTL accepted');
  c.ok(Math.abs(short.data.expiresAt - (Date.now() + 3 * DAY)) < 10_000, 'custom TTL applied');
  c.ok((await Promise.all([0, 91, 'abc', 1.5, -2].map(ttlDays => mint(admin.jar, { ttlDays })))).every(r => r.status === 400 && r.data?.error?.code === 'INVITE_TTL_INVALID'),
    'ttlDays outside 1..90 or non-integer is rejected');

  const stored = db.prepare('SELECT * FROM teacher_invites ORDER BY created_at').all();
  c.eq(stored.length, 2, 'two invites stored');
  const firstRow = stored.find(row => row.code_hash === sha256(first.data.code));
  c.ok(firstRow, 'invite is stored as its SHA-256 hash');
  c.ok(stored.every(row => !Object.values(row).includes(first.data.code) && !Object.values(row).includes(short.data.code)), 'no row contains a raw code');
  c.eq(firstRow.code_prefix, first.data.code.slice(0, 8), 'only a display prefix is kept');
  c.eq(firstRow.created_by, admin.account.id, 'minting admin recorded');

  const listed = await list(admin.jar);
  c.eq(listed.status, 200, 'admin lists invites');
  c.eq(listed.data.invites.length, 2, 'both invites listed');
  c.ok(listed.data.invites.every(item => item.code_prefix && Number.isInteger(item.expiresAt) && !('code' in item) && !('usedBy' in item)), 'listing shows prefix + expiry, never the code, and no usedBy while unused');

  // Redeem: normalisation accepts lowercase and missing dashes.
  const messy = first.data.code.toLowerCase().replace(/-/g, '');
  const teacher = await registerAccount(h, { email: 'new.teacher@example.test', name: 'Invited Teacher', teacherInviteCode: messy });
  c.eq(teacher.status, 201, 'registration with a live invite succeeds');
  c.eq(teacher.account.role, 'teacher', 'the account is a teacher');
  c.eq((await h.request('/v1/account/me', { jar: teacher.jar })).data.account.role, 'teacher', '/me confirms the role');
  const used = (await list(admin.jar)).data.invites.find(item => item.code_prefix === first.data.code.slice(0, 8));
  c.eq(used.usedBy, teacher.account.id, 'listing shows who used it');
  c.ok(Number.isInteger(used.usedAt), 'and when');

  const reuse = await registerAccount(h, { email: 'second.teacher@example.test', teacherInviteCode: first.data.code });
  c.eq(reuse.status, 400, 'a used code is refused');
  c.eq(reuse.data.error.code, 'TEACHER_INVITE_INVALID', 'with the contract code');
  c.eq(db.prepare('SELECT 1 FROM accounts WHERE email=?').get('second.teacher@example.test'), undefined, 'no account is created on a refused invite');

  const unknown = await registerAccount(h, { email: 'third.teacher@example.test', teacherInviteCode: 'PRI-AAAA-BBBB-CCCC-DDDD' });
  c.eq(unknown.data?.error?.code, 'TEACHER_INVITE_INVALID', 'an unknown well-formed code is refused');
  const garbage = await registerAccount(h, { email: 'fourth.teacher@example.test', teacherInviteCode: 'hello there' });
  c.eq(garbage.status, 400, 'garbage is refused');
  c.eq(db.prepare("SELECT COUNT(*) AS n FROM accounts WHERE email IN ('third.teacher@example.test','fourth.teacher@example.test')").get().n, 0, 'no accounts from refused codes');

  const blank = await registerAccount(h, { email: 'plain.student@example.test', teacherInviteCode: '' });
  c.eq(blank.status, 201, 'an empty invite field is an ordinary registration');
  c.eq(blank.account.role, 'student', 'and yields a student');

  db.prepare('UPDATE teacher_invites SET expires_at=? WHERE code_hash=?').run(Date.now() - 1, sha256(short.data.code));
  const expired = await registerAccount(h, { email: 'fifth.teacher@example.test', teacherInviteCode: short.data.code });
  c.eq(expired.data?.error?.code, 'TEACHER_INVITE_INVALID', 'an expired code is refused');

  const audit = db.prepare('SELECT action, actor_account_id, target_id, metadata_json FROM audit_log ORDER BY id').all();
  const mints = audit.filter(row => row.action === 'teacher-invite.mint');
  c.eq(mints.length, 2, 'each mint is audited');
  c.ok(mints.every(row => row.actor_account_id === admin.account.id && !row.metadata_json.includes(first.data.code) && !row.metadata_json.includes(short.data.code)), 'mint audit names the admin and never the full code');
  const redeems = audit.filter(row => row.action === 'teacher-invite.redeem');
  c.eq(redeems.length, 1, 'the redemption is audited');
  c.eq(redeems[0].target_id, teacher.account.id, 'redeem audit targets the teacher account');

  // The role is real: after verifying the mailbox the teacher can create a class.
  c.eq((await h.request('/v1/classes', { method: 'POST', jar: teacher.jar, body: { name: 'Class 9 A' } })).data?.error?.code, 'EMAIL_UNVERIFIED', 'unverified teacher cannot create a class yet');
  c.eq((await verifyEmail(h, teacher.account.id)).status, 200, 'teacher verifies');
  const created = await h.request('/v1/classes', { method: 'POST', jar: teacher.jar, body: { name: 'Class 9 A' } });
  c.eq(created.status, 201, 'verified invited teacher creates a class');
  c.match(created.data.joinCode, /^[A-Z0-9]{4,12}$/, 'with a join code');
} finally {
  await h.close();
  db.close();
}

console.log(`TEACHER INVITES — PASS — ${c.count()}/${c.count()} checks`);
