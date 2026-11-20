// Pri Learning · what a hint costs, over HTTP, in each edition (owner decision, 19 Nov 2026)
//
// Run once per edition (tools/edition-suites.mjs runs it under both):
//   Prithagoras  hints are free: the nudge, method and worked-step rungs take nothing, the mark credited equals
//                the mark earned, and the full solution still ends the attempt with no credit;
//   Priyabhata   the paid ladder is unchanged: 100 % -> 90 -> 70 -> 40 %, credited at the weight left.
// SYNTHETIC: generated questions and a scripted client.
import './support/hermetic.mjs';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const AU = process.env.PRI_EDITION === 'prithagoras';
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = join(mkdtempSync(join(tmpdir(), 'pri-hint-charge-')), 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = 'c9'.repeat(32);
process.env.PRI_FREE_PRACTICE_PER_DAY = '100000';
delete process.env.PRI_PUBLIC_ORIGIN;
const { startApp, registerAccount, verifyEmail } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
let count = 0;
const eq = (a, b, name) => { assert.deepEqual(a, b, name); count++; };
const h = await startApp({ engine: requestedEngine() });
let n = 0;
try {
  eq((await h.request('/v1/health')).data?.edition, AU ? 'prithagoras' : 'priyabhata', 'the server is the edition under test');
  const a = await registerAccount(h, { email: `hint.charge.${AU ? 'au' : 'in'}@example.test`, deviceId: 'ipad-hint-charge' });
  eq((await verifyEmail(h, a.account.id)).status, 200, 'a verified student');
  const post = (path, body, headers = {}) => h.request(path, { method: 'POST', jar: a.jar, body, headers });
  const issue = async seed => post('/v1/practice/issue', { generator: AU ? 'y11-functions' : 'c8-linear-equations-both-sides', difficulty: 2, seed, curriculum: AU ? 'nsw' : 'in' });
  const sealed = async id => JSON.parse((await h.db.get("SELECT response_json FROM idempotency_keys WHERE scope='practice-question' AND key=?", [id])).response_json);
  const keyOf = q => { const k = q.answer || {}; return q.answerType === 'mcq' ? String(k.correctIndex) : q.answerType === 'numeric' ? (k.canonicalInput || String(k.value)) : q.answerType === 'expression' ? k.expr : q.answerType === 'point' ? `(${k.x}, ${k.y})` : q.answerType === 'set' ? k.values.join(', ') : `${k.a}:${k.b}`; };
  const grade = (id, answer) => { const sid = `hint-charge-${++n}`; return post(`/v1/practice/${id}/submit`, { submissionId: sid, answer, mode: 'typed' }, { 'Idempotency-Key': sid }); };
  const WEIGHT = AU ? [1, 1, 1] : [0.9, 0.7, 0.4];

  let seed = 4242, got = null;
  for (; seed < 4262; seed++) {   // a question whose key can be typed back
    const r = await issue(seed);
    if (r.status !== 201) continue;
    const q = await sealed(r.data.question.id);
    if (['mcq', 'numeric', 'expression'].includes(q.answerType)) { got = { id: r.data.question.id, key: keyOf(q) }; break; }
  }
  assert.ok(got, 'a question with a typeable key was issued'); count++;

  const weights = [];
  for (const rung of ['nudge', 'method', 'worked']) {
    const r = await post(`/v1/practice/${got.id}/hint`, { rung });
    eq(r.status, 200, `the ${rung} rung is served`);
    weights.push(r.data.markWeight);
  }
  eq(weights, WEIGHT, AU ? 'Prithagoras: three rungs opened, nothing taken (weight stays 1)' : 'Priyabhata: the paid ladder, 90 then 70 then 40 percent');
  const right = await grade(got.id, got.key);
  eq([right.status, right.data.correct, right.data.hintLevel], [200, true, 3], 'the right answer is marked correct with three rungs open');
  eq(right.data.markWeight, WEIGHT[2], 'the weight charged at the commit is the table\'s');
  eq(right.data.creditedMarks, Math.round(right.data.marksEarned * WEIGHT[2] * 100) / 100, 'credited marks = earned marks x that weight');
  if (AU) eq([right.data.creditedMarks === right.data.marksEarned, right.data.markRows?.totals?.creditedAfterHints], [true, undefined], 'Prithagoras: the mark shown equals the mark earned, and no "credit after hints" line is sent');

  // The full solution ends the attempt in both editions.
  const r2 = await issue(seed + 100);
  for (const rung of ['nudge', 'method', 'worked']) await post(`/v1/practice/${r2.data.question.id}/hint`, { rung });
  const sol = await post(`/v1/practice/${r2.data.question.id}/hint`, { rung: 'solution' });
  eq([sol.status, sol.data.revealed, sol.data.resolved, sol.data.correct, sol.data.endsQuestion], [200, true, true, false, true], 'the full solution ends the attempt, never correct');
} finally { await h.close(); }
console.log(`engine: ${h.engine}`);
console.log(`HINT CHARGE (${AU ? 'Prithagoras' : 'Priyabhata'}): PASS — ${count}/${count} checks — ${AU ? 'hints are free over HTTP: nothing deducted, credited = earned' : 'the paid ladder over HTTP is unchanged: 90, 70, 40 percent'}; the full solution still ends the attempt. [SYNTHETIC]`);
