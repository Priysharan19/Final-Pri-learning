// The slip kinds that pin the answer's value (sign, reciprocal, complement,
// square, root: each fixes the answer exactly from the student's number)
// must never reach a reply while the question is still open. Real router,
// real store, loopback socket. [SYNTHETIC: generated question, test account]
import './support/hermetic.mjs';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const keys = ['NODE_ENV', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_PUBLIC_ORIGIN'];
const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const scratch = mkdtempSync(join(tmpdir(), 'pri-slip-open-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = 'd5'.repeat(32);
delete process.env.PRI_PUBLIC_ORIGIN;
const { startApp, registerAccount, verifyEmail } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const { generateQuestion, loadAllBanks } = await import('../../client/src/engine/generators/index.js');
const { checkAnswer } = await import('../../client/src/engine/checker.js');
const { SLIP_FEEDBACK } = await import('../../client/src/engine/slips.js');
await loadAllBanks();
const h = await startApp({ engine: requestedEngine() });
let count = 0;
const ok = (c, name) => { assert.ok(c, name); count += 1; };
const CELLS = [['c8-linear-equations-both-sides', 2], ['c7-large-numbers-current', 1]];
const PINNING = ['sign', 'reciprocal', 'complement', 'square', 'root'];
try {
  const a = await registerAccount(h, { email: 'slip.open@example.test', deviceId: 'ipad-slip-open' });
  ok(a.status === 201 && (await verifyEmail(h, a.account.id)).status === 200, 'account');
  const seenKinds = new Set();
  for (const [GEN, D] of CELLS) {
  let tried = 0, seed = 1000;
  while (tried < 8 && seed < 1400) {
    seed += 1;
    const q = generateQuestion(GEN, D, seed);
    const v = Number(q?.answer?.value);
    if (!Number.isFinite(v) || v === 0) continue;
    for (const [kind, wrong] of [['sign', -v], ['reciprocal', 1 / v], ['square', v * v], ['root', Math.sqrt(Math.abs(v))]]) {
      if (!Number.isFinite(wrong) || Math.abs(wrong - v) < 1e-9) continue;
      const local = checkAnswer(q, String(wrong));
      if (local.slip !== kind) continue;      // only cases the engine does classify
      const issued = await h.request('/v1/practice/issue', { method: 'POST', jar: a.jar, body: { generator: GEN, difficulty: D, seed, curriculum: 'in' } });
      if (issued.status !== 201) continue;
      const qid = issued.data.question.id;
      const sid = `slip-${seed}-${kind}`;
      const r = await h.request(`/v1/practice/${encodeURIComponent(qid)}/submit`, { method: 'POST', jar: a.jar, headers: { 'Idempotency-Key': sid }, body: { submissionId: sid, answer: String(wrong), mode: 'typed' } });
      ok(r.status === 200 && r.data?.correct === false, `${kind}: marked wrong`);
      if (r.data?.resolved) continue;          // only open replies are in scope
      const body = JSON.stringify(r.data);
      ok(!PINNING.some(k => body.includes(SLIP_FEEDBACK[k])), `${kind}: no slip text on the open reply`);
      ok(!('slip' in (r.data || {})) && !/"slip"\s*:/.test(body), `${kind}: no slip field on the open reply`);
      seenKinds.add(kind);
      tried += 1;
    }
  }
  }
  ok(seenKinds.has('sign') && seenKinds.has('reciprocal'), `exercised open replies for: ${[...seenKinds].join(', ')}`);
} finally {
  await h.close();
  rmSync(scratch, { recursive: true, force: true });
  for (const key of keys) { if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key]; }
}
console.log(`SLIP OPEN REPLY: PASS — ${count} checks — value-pinning slip kinds never reach an open-try reply, on a real Pri ${h.engine} server.`);
