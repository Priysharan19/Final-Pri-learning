// Pri Learning · every India bank the client serves is issued by the server.
//
// The issue route's generator pattern required a letter after the class prefix,
// so `c11-3d-introduction` and `c12-3d-geometry` were refused (400) and a
// signed-in student's 3D-geometry questions silently stayed device-marked.
// Over real HTTP: every India class generator the client ships is issued (201)
// from that bank, under the caller's account, with no seed disclosed.
import './support/hermetic.mjs';
import assert from 'node:assert/strict';

process.env.PRI_AUTH_DELIVERY_KEY = process.env.PRI_AUTH_DELIVERY_KEY || '55'.repeat(32);
process.env.PRI_AUTH_EMAIL_PROVIDER = 'test';
// This suite is about bank coverage, not the free plan: its accounts are issued far
// more than twenty questions a day. The cap itself is proved by
// practice-daily-cap-check.mjs; here it is raised by configuration.
process.env.PRI_FREE_PRACTICE_PER_DAY = '100000';
// The free plan's 5 marked scripts a day is proven in practice-daily-cap-check.mjs;
// suites that mark many answers on one free account raise it by configuration.
process.env.PRI_FREE_MARKED_PER_DAY = '100000';
delete process.env.PRI_PUBLIC_ORIGIN;

const { startApp, registerAccount, verifyEmail } = await import('./support/app-harness.mjs');
const { loadAllBanks, GENERATORS, generateQuestion } = await import('../../client/src/engine/generators/index.js');
await loadAllBanks();

const h = await startApp();
const refused = [];
let issued = 0;
try {
  // The issue route is bounded per account (200 an hour, practice.js); the
  // banks outnumber that, so each account here is issued at most PER_ACCOUNT.
  const PER_ACCOUNT = 150;
  let student = null;
  let served = 0;
  const nextStudent = async () => {
    const n = Math.floor(served / PER_ACCOUNT);
    const made = await registerAccount(h, { email: `known.red.3d.${n}@example.test`, deviceId: `known-red-3d-${n}` });
    assert.equal(made.status, 201, 'the harness account registers');
    assert.equal((await verifyEmail(h, made.account.id)).status, 200, 'and verifies its email');
    return made;
  };
  // Every India class bank the client ships, at a difficulty it authors.
  const banks = Object.keys(GENERATORS).filter(id => /^c(?:[7-9]|1[0-2])-/.test(id));
  for (const generator of banks) {
    try { generateQuestion(generator, 1, 104729); } catch { continue; }
    if (served % PER_ACCOUNT === 0) student = await nextStudent();
    served++;
    // The product never sends a seed: the server chooses the question.
    const res = await h.request('/v1/practice/issue', { method: 'POST', jar: student.jar, body: { generator, difficulty: 1, curriculum: 'in', mode: 'practice' } });
    // Each issue names the account it was issued under, so a shared device can
    // refuse a question issued under another profile's session.
    if (res.status === 201 && res.data?.question?.subtopic === generator && typeof res.data.question.prompt === 'string' &&
        res.data.question.prompt.length > 0 && !('seed' in res.data.question) && !('seed' in res.data) &&
        res.data.accountId === String(student.account.id)) issued++;
    else refused.push(`${generator} → ${res.status} ${res.data?.error?.code || ''}`.trim());
    if (res.status === 429) break;
  }
} finally {
  await h.close();
}
console.log(`server issued ${issued} India class banks; refused ${refused.length}: ${JSON.stringify(refused)}`);
if (refused.length) {
  console.log('INDIA BANK ISSUE COVERAGE: FAIL — the server refuses to issue banks the client serves.');
  process.exit(1);
}
if (issued < 100) { console.log(`INDIA BANK ISSUE COVERAGE: FAIL — only ${issued} banks reached`); process.exit(1); }
console.log(`INDIA BANK ISSUE COVERAGE: PASS — the server issues all ${issued} India class banks the client ships.`);
