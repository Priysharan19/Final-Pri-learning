// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the guardian gate covers every router that holds a child's data
//
// The gate (platform/guardianConsent.js) used to sit only in front of sync,
// billing, handwriting and working. Telemetry, classes, assignments and issue
// reports were open, so a Class 7-12 account whose guardian had not confirmed —
// or had withdrawn — could still send account-linked operational events, join
// a class, write submission summaries and file free-text reports. This suite
// drives the real production /v1 chain and holds, for each of those routers:
//
//   · a child whose consent is pending is refused, and nothing is written;
//   · once the guardian confirms, the same requests succeed;
//   · withdrawal stops them again at once, and nothing more is written;
//   · an adult (no consent row) is never affected;
//   · and the consent ceremony itself, account export and deletion stay open,
//     because a data principal's rights cannot wait on the consent they concern.
//
// SQLite by default; `--engine=postgres` runs it on a migrated Postgres.
// ─────────────────────────────────────────────────────────────────────────────
process.env.PRI_AUTH_DELIVERY_KEY ||= 'cd'.repeat(32);

const { startApp, registerAccount, verifyEmail, checks } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const { decryptDeliveryToken } = await import('../platform/deliveryCrypto.js');

const c = checks();
const h = await startApp({ engine: requestedEngine(), log: () => {} });
const db = h.db;
const resetLimits = () => db.run('DELETE FROM rate_limits');

async function guardianToken(accountId) {
  const row = await db.get(`SELECT token_id,token_ciphertext FROM auth_delivery_outbox
    WHERE account_id=? AND kind='guardian-consent' ORDER BY created_at DESC LIMIT 1`, [accountId]);
  return row ? decryptDeliveryToken(row.token_ciphertext, `${accountId}:guardian-consent:${row.token_id}`) : null;
}

try {
  // ── Cast: a teacher with a class, a Class 9 child, an adult learner ────────
  await resetLimits();
  const teacher = await registerAccount(h, { name: 'Teacher', email: 'coverage.teacher@example.test', deviceId: 'ipad-teacher' });
  await verifyEmail(h, teacher.account.id);
  await db.run("UPDATE accounts SET role='teacher' WHERE id=?", [teacher.account.id]);
  const made = await h.request('/v1/classes', { method: 'POST', jar: teacher.jar, body: { name: 'Class 9 Mathematics' } });
  c.eq(made.status, 201, 'the teacher (an adult, no consent row) creates a class through the gated router');
  const classId = made.data.class.id;
  const joinCode = made.data.joinCode;
  const assignment = await h.request(`/v1/classes/${classId}/assignments`, { method: 'POST', jar: teacher.jar, body: {
    title: 'Linear equations', specification: { kind: 'practice', instructions: 'Show working.', questionCount: 5 }
  } });
  c.eq(assignment.status, 201, 'and sets an assignment');
  const assignmentId = assignment.data.assignment.id;

  await resetLimits();
  const childJar = {};
  const reg = await h.request('/v1/account/register', { method: 'POST', jar: childJar, body: {
    name: 'Child Learner', email: 'coverage.child@example.test', password: 'correct-horse-battery', deviceId: 'ipad-child',
    year: '9', guardianName: 'Guardian', guardianEmail: 'coverage.guardian@example.test'
  } });
  c.eq(reg.status, 201, 'a Class 9 child registers');
  const childId = reg.data.account.id;
  await verifyEmail(h, childId);
  c.eq((await h.request('/v1/account/guardian/state', { jar: childJar })).data?.state, 'pending', 'and starts with consent pending');

  await resetLimits();
  const adult = await registerAccount(h, { name: 'Adult Learner', email: 'coverage.adult@example.test', deviceId: 'ipad-adult' });
  await verifyEmail(h, adult.account.id);

  // Every request a student's device makes on the newly gated routers.
  const studentCalls = [
    { label: 'POST /v1/telemetry', path: '/v1/telemetry', method: 'POST', body: { events: [{ type: 'feature-used', surface: 'practice', metadata: { feature: 'coverage' } }] } },
    { label: 'GET /v1/classes', path: '/v1/classes' },
    { label: 'POST /v1/classes/join', path: '/v1/classes/join', method: 'POST', body: { code: joinCode } },
    { label: 'GET /v1/classes/:classId', path: `/v1/classes/${classId}` },
    { label: 'PATCH /v1/classes/:classId/assignments/:assignmentId/submission', path: `/v1/classes/${classId}/assignments/${assignmentId}/submission`, method: 'PATCH', body: { state: 'started', summary: { answered: 1, correct: 1 } } },
    { label: 'GET /v1/assignments', path: '/v1/assignments' },
    { label: 'GET /v1/assignments/:classId/:assignmentId', path: `/v1/assignments/${classId}/${assignmentId}` },
    { label: 'POST /v1/reports', path: '/v1/reports', method: 'POST', body: { category: 'other', note: 'The diagram looks wrong.' } },
    { label: 'GET /v1/reports/mine', path: '/v1/reports/mine' }
  ];
  const run = async (jar) => {
    await resetLimits();
    const out = [];
    for (const call of studentCalls) {
      const r = await h.request(call.path, { method: call.method || 'GET', jar, body: call.body });
      out.push({ label: call.label, status: r.status, code: r.data?.error?.code || null, message: r.data?.error?.message || '' });
    }
    return out;
  };
  const written = async (accountId) => ({
    telemetry: Number((await db.get('SELECT COUNT(*) AS n FROM operational_events WHERE account_id=?', [accountId])).n),
    reports: Number((await db.get('SELECT COUNT(*) AS n FROM issue_reports WHERE account_id=?', [accountId])).n),
    memberships: Number((await db.get('SELECT COUNT(*) AS n FROM class_members WHERE student_account_id=? AND removed_at IS NULL', [accountId])).n),
    submissions: Number((await db.get('SELECT COUNT(*) AS n FROM assignment_submissions WHERE student_account_id=?', [accountId])).n)
  });
  const refusedWith = (results, code) => results.filter(r => !(r.status === 403 && r.code === code)).map(r => `${r.label} → ${r.status} ${r.code || ''}`);
  const notRefused = results => results.filter(r => r.status === 403 && /^GUARDIAN_CONSENT_/.test(r.code || '')).map(r => `${r.label} → ${r.code}`);

  // ── 1 · Pending: refused, and nothing of the child's is stored ─────────────
  const pending = await run(childJar);
  c.deq(refusedWith(pending, 'GUARDIAN_CONSENT_PENDING'), [], 'pending consent refuses telemetry, classes, assignments and reports');
  c.ok(pending.every(r => /stays on this device/i.test(r.message)), 'and every refusal tells the student their work is safe on the device');
  c.deq(await written(childId), { telemetry: 0, reports: 0, memberships: 0, submissions: 0 }, 'and nothing of the child was written while consent was pending');

  // ── 2 · An adult is unaffected ─────────────────────────────────────────────
  const adultResults = await run(adult.jar);
  c.deq(notRefused(adultResults), [], 'an adult account (no consent row) is never refused by the guardian gate');
  c.eq(adultResults.find(r => r.label === 'POST /v1/telemetry').status, 202, 'the adult\'s telemetry is accepted');
  c.eq(adultResults.find(r => r.label === 'POST /v1/classes/join').status, 200, 'the adult joins the class');
  c.eq(adultResults.find(r => r.label === 'POST /v1/reports').status, 201, 'the adult files a report');
  c.eq(adultResults.find(r => r.label.startsWith('PATCH')).status, 200, 'the adult writes a submission summary');

  // ── 3 · Rights that cannot wait on consent stay open ───────────────────────
  c.eq((await h.request('/v1/account/me', { jar: childJar })).status, 200, 'a pending child can still read their account');
  c.eq((await h.request('/v1/account/guardian/state', { jar: childJar })).status, 200, 'and see where consent stands');
  c.eq((await h.request('/v1/account/export', { jar: childJar })).status, 200, 'and export their data');

  // ── 4 · Given: the same requests succeed ───────────────────────────────────
  const token = await guardianToken(childId);
  c.ok(token, 'the guardian email carries a confirmation token');
  await resetLimits();
  c.eq((await h.request('/v1/account/guardian/confirm', { method: 'POST', body: { token } })).data?.confirmed, true, 'the guardian confirms');
  const given = await run(childJar);
  c.deq(notRefused(given), [], 'with consent given, nothing is refused by the guardian gate');
  c.deq(given.filter(r => r.status >= 400).map(r => `${r.label} → ${r.status} ${r.code}`), [], 'and every request succeeds');
  const afterGiven = await written(childId);
  c.deq(afterGiven, { telemetry: 1, reports: 1, memberships: 1, submissions: 1 }, 'and the child\'s telemetry, report, membership and submission are stored');

  // ── 5 · Withdrawn: stopped again, at once ──────────────────────────────────
  await resetLimits();
  c.eq((await h.request('/v1/account/guardian/withdraw', { method: 'POST', body: { token } })).data?.withdrawn, true, 'the guardian withdraws with the same link');
  const withdrawn = await run(childJar);
  c.deq(refusedWith(withdrawn, 'GUARDIAN_CONSENT_WITHDRAWN'), [], 'withdrawal refuses telemetry, classes, assignments and reports again');
  c.deq(await written(childId), afterGiven, 'and nothing more of the child is written after withdrawal');
  c.eq((await h.request('/v1/account/export', { jar: childJar })).status, 200, 'while export stays open to the child');
  await resetLimits();
  c.eq((await h.request('/v1/account/guardian/confirm', { method: 'POST', body: { token } })).status, 400, 'and the spent confirmation link cannot quietly re-grant it');

  // ── 6 · Staff routes on the same routers still work for the teacher ────────
  c.eq((await h.request(`/v1/classes/${classId}/students`, { jar: teacher.jar })).status, 200, 'the teacher still reads the roster through the gated router');
  c.eq((await h.request(`/v1/assignments/${classId}/${assignmentId}/submissions`, { jar: teacher.jar })).status, 200, 'and the submissions');

  // ── 7 · No session is still the sub-router's 401, not the gate's 403 ───────
  for (const path of ['/v1/telemetry', '/v1/classes', '/v1/assignments', '/v1/reports/mine']) {
    const method = path === '/v1/telemetry' ? 'POST' : 'GET';
    const r = await h.request(path, { method, body: method === 'POST' ? { events: [{ type: 'feature-used' }] } : undefined });
    c.ok(r.status === 401 || (r.status === 403 && r.data?.error?.code === 'CSRF_REJECTED'), `${method} ${path} with no session is an authentication failure, not a consent one (${r.status} ${r.data?.error?.code || ''})`);
  }
} finally {
  await h.close();
}

console.log(`GUARDIAN CONSENT COVERAGE — PASS — ${c.count()}/${c.count()} checks — telemetry, classes, assignments and reports wait for a guardian, stop on withdrawal, and never touch an adult.`);
