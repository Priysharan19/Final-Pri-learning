// Pri Learning · every India bank the client serves is issued by the server.
//
// The issue route's generator pattern required a letter after the class prefix,
// so `c11-3d-introduction` and `c12-3d-geometry` were refused (400) and a
// signed-in student's 3D-geometry questions silently stayed device-marked.
// Over real HTTP: every India class generator the client ships is issued (201)
// with the same prompt the device generated.
import assert from 'node:assert/strict';

process.env.PRI_AUTH_DELIVERY_KEY = process.env.PRI_AUTH_DELIVERY_KEY || '55'.repeat(32);
process.env.PRI_AUTH_EMAIL_PROVIDER = 'test';
delete process.env.PRI_PUBLIC_ORIGIN;

const { startApp, registerAccount, verifyEmail } = await import('./support/app-harness.mjs');
const { loadAllBanks, GENERATORS, generateQuestion } = await import('../../client/src/engine/generators/index.js');
await loadAllBanks();

const h = await startApp();
const refused = [];
let issued = 0;
try {
  const student = await registerAccount(h, { email: 'known.red.3d@example.test', deviceId: 'known-red-3d' });
  assert.equal(student.status, 201, 'the harness account registers');
  assert.equal((await verifyEmail(h, student.account.id)).status, 200, 'and verifies its email');
  // Every India class bank the client ships, at a difficulty it authors.
  const banks = Object.keys(GENERATORS).filter(id => /^c(?:[7-9]|1[0-2])-/.test(id));
  for (const generator of banks) {
    let local = null;
    try { local = generateQuestion(generator, 1, 104729); } catch { continue; }
    const res = await h.request('/v1/practice/issue', { method: 'POST', jar: student.jar, body: { generator, difficulty: 1, seed: 104729, curriculum: 'in', mode: 'practice' } });
    if (res.status === 201 && res.data?.question?.prompt === local.prompt) issued++;
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
