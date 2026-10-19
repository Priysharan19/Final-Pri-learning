// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · admin access to class and assignment routes needs the same
// verified second factor as every other admin route (security P2, train 9)
//
//   · classes.js and assignments.js grant an admin access to ANY class by
//     virtue of the role. An admin session that has enrolled a factor but not
//     presented a code on this session answers 403 MFA_REQUIRED on every one of
//     those routes — enumerated from listRoutes(), so a route added later is
//     covered without editing this file. The one exemption is GET /v1/classes/,
//     which lists only the classes the account itself teaches (mfa-check.mjs
//     relies on it answering an enrolled admin); it is pinned to that below.
//   · The same admin, once a code is verified, is let through.
//   · Teachers (owners) and students are unaffected: they have no factor and
//     never see an MFA refusal on these routes.
// SQLite by default; `--engine=postgres` runs it on a migrated Postgres.
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';

const { startApp, registerAccount, verifyEmail, checks, enrolMfa } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const { listRoutes } = await import('../platform/routePolicy.js');
const { createClassRouter } = await import('../platform/classes.js');
const { createAssignmentExecutionRouter } = await import('../platform/assignments.js');

const c = checks();
const h = await startApp({ engine: requestedEngine() });
const db = h.db;
const code = r => r.data?.error?.code;

let serial = 0;
async function account(role) {
  serial += 1;
  await db.run('DELETE FROM rate_limits');
  const made = await registerAccount(h, { email: `amfa.${role}.${serial}@example.test`, deviceId: `amfa-${serial}`, password: `amfa-pw-${serial}-horse-battery` });
  if (made.status !== 201) throw new Error(`register: ${made.status} ${made.text}`);
  await verifyEmail(h, made.account.id);
  if (role !== 'student') await db.run('UPDATE accounts SET role=? WHERE id=?', [role, made.account.id]);
  return { id: made.account.id, jar: made.jar };
}

const teacher = await account('teacher');
const student = await account('student');
const admin = await account('admin');
await enrolMfa(h, admin.jar);
// A fresh sign-in on an enrolled account: factor enrolled, no code presented.
const clearVerification = () => db.run('UPDATE account_sessions SET mfa_verified_at = NULL WHERE account_id = ?', [admin.id]);
const markVerified = () => db.run('UPDATE account_sessions SET mfa_verified_at = ? WHERE account_id = ?', [Date.now(), admin.id]);

// The teacher's class with the student on the roster and one assignment.
const now = Date.now();
const created = await h.request('/v1/classes', { method: 'POST', jar: teacher.jar, body: { name: 'Admin MFA class' } });
if (created.status !== 201) throw new Error(`class create: ${created.status} ${created.text}`);
const classId = created.data.class.id;
await db.run('INSERT INTO class_members(class_id, student_account_id, joined_at) VALUES (?,?,?)', [classId, student.id, now]);
const assignmentId = 'asn_admin_mfa';
await db.run('INSERT INTO assignments(id,class_id,teacher_account_id,title,specification_json,due_at,created_at) VALUES (?,?,?,?,?,?,?)',
  [assignmentId, classId, teacher.id, 'Admin MFA assignment', '{}', null, now]);

// Every class and assignment route, from the routers themselves.
const routes = [
  ...listRoutes(createClassRouter(db), '/v1/classes'),
  ...listRoutes(createAssignmentExecutionRouter(db), '/v1/assignments')
];
c.ok(routes.length >= 15, `listRoutes enumerates the class and assignment routes (${routes.length})`);
const fill = path => path
  .replace(':classId', classId)
  .replace(':assignmentId', assignmentId)
  .replace(':studentId', student.id);
const call = (route, jar) => h.request(fill(route.path), { method: route.method, jar, ...(route.method === 'GET' ? {} : { body: {} }) });

// 1 · An admin without a verified factor is refused on every route but the
// own-classes list, which must then expose none of the teacher's classes.
const isOwnList = route => route.method === 'GET' && route.path === '/v1/classes/';
c.eq(routes.filter(isOwnList).length, 1, 'the own-classes list is enumerated exactly once');
await clearVerification();
const ownList = await h.request('/v1/classes/', { jar: admin.jar });
c.deq([ownList.status, ownList.data?.classes], [200, []], 'admin without MFA: GET /v1/classes/ lists only the admin\'s own (no) classes');
for (const route of routes.filter(r => !isOwnList(r))) {
  await db.run('DELETE FROM rate_limits');
  const r = await call(route, admin.jar);
  c.deq([r.status, code(r)], [403, 'MFA_REQUIRED'], `admin without MFA: ${route.method} ${route.path} is refused`);
}
c.eq((await db.get('SELECT COUNT(*) AS n FROM class_members WHERE class_id=? AND removed_at IS NULL', [classId])).n, 1, 'and the refused admin changed no roster');

// 2 · Teachers (the owner) and students never meet an MFA refusal here.
for (const route of routes) {
  for (const [who, jar] of [['teacher', teacher.jar], ['student', student.jar]]) {
    if (route.method === 'DELETE') continue; // keep the roster for the admin pass below
    await db.run('DELETE FROM rate_limits');
    const r = await call(route, jar);
    c.ok(!/^MFA_/.test(code(r) || ''), `${who}: ${route.method} ${route.path} is not gated on MFA (${r.status} ${code(r) || ''})`);
  }
}

// 3 · The same admin with a verified factor is let through.
for (const route of routes) {
  await markVerified();
  await db.run('DELETE FROM rate_limits');
  const r = await call(route, admin.jar);
  c.ok(!/^MFA_/.test(code(r) || ''), `admin with MFA: ${route.method} ${route.path} passes the MFA gate (${r.status} ${code(r) || ''})`);
}
for (const path of [`/v1/classes/${classId}`, `/v1/classes/${classId}/students`, `/v1/classes/${classId}/analytics`, '/v1/assignments']) {
  await markVerified();
  c.eq((await h.request(path, { jar: admin.jar })).status, 200, `admin with MFA reads ${path}`);
}

await h.close();
console.log(`engine: ${h.engine}`);
console.log(`admin-mfa-class-routes-check: ${c.count()}/${c.count()} checks passed (${h.engine})`);
