// ─────────────────────────────────────────────────────────────────────────────
// KNOWN RED — NOT WIRED INTO CI. A precise repro of a server defect found while
// building client/test/tour-write-sign-in.js, kept as an executable assertion
// until server/platform/practice.js is fixed by its owner. When it goes green,
// move the assertion into the server's practice contract suite and delete this.
//
// DEFECT. server/platform/practice.js:29
//     const INDIA_BANK = /^c(?:[7-9]|1[0-2])-[a-z][a-z0-9-]{2,95}$/;
// requires a letter straight after the class prefix. Two authored India banks
// start with a digit there — `c11-3d-introduction` and `c12-3d-geometry` — so
// POST /v1/practice/issue answers 400 PRACTICE_GENERATOR_INVALID for them.
//
// WHAT HAPPENS. For a signed-in, verified student, every Class 11 "Introduction
// to Three Dimensional Geometry" and Class 12 "Three Dimensional Geometry"
// question is refused by the server, the client falls back to the bundled
// device engine without saying so, and the result is `authoritative: false`
// with no certified marks — the one thing server-issued grading exists to
// prevent for an account that is online.
//
// WHAT SHOULD HAPPEN. Every generator the client can serve to an India profile
// is accepted by the issue route (201, same prompt), e.g. `[a-z0-9]` after the
// class prefix, or an allow-list built from the loaded banks.
//
// Run:  node client/test/known-red-server-issue-3d-generators.mjs
// ─────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';

process.env.PRI_AUTH_DELIVERY_KEY = process.env.PRI_AUTH_DELIVERY_KEY || '55'.repeat(32);
process.env.PRI_AUTH_EMAIL_PROVIDER = 'test';
delete process.env.PRI_PUBLIC_ORIGIN;

const { startApp, registerAccount, verifyEmail } = await import('../../server/test/support/app-harness.mjs');
const { loadAllBanks, GENERATORS, generateQuestion } = await import('../src/engine/generators/index.js');
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
  console.log('✖ KNOWN RED (not in CI): the server refuses to issue banks the client serves — see the header of this file.');
  process.exit(1);
}
console.log('✔ every India class bank the client ships is issued by the server — move this into the server practice contract suite.');
