// Pri Learning · markingReport over HTTP: stored with the reply, never sent to the client (a boolean says it differs)
import './support/hermetic.mjs';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const keys = ['NODE_ENV', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_PUBLIC_ORIGIN'];
const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const scratch = mkdtempSync(join(tmpdir(), 'pri-marking-report-'));
process.env.NODE_ENV = 'test';
// D15: a production server never issues a bank outside the India covers
// (server/platform/indiaBanks.js). This suite says so explicitly because its long-expression cases use an NSW bank (y7-algebra) for an expression answer;
// india-banks-check.mjs pins the refusal itself. Refused under NODE_ENV=production.
(await import('../platform/indiaBanks.js')).allowBanksOutsideIndiaForTests();
// D12: method marks are off by default — production marks the final answer only
// until an examiner signs (#499). This suite pins the method rubric itself, so it
// turns the server switch on; marking-policy-check.mjs pins the default.
process.env.PRI_METHOD_MARKS = 'on';
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = 'e4'.repeat(32);
// This suite is about marking, not the free plan: its accounts are issued far
// more than twenty questions a day. The cap itself is proved by
// practice-daily-cap-check.mjs; here it is raised by configuration.
process.env.PRI_FREE_PRACTICE_PER_DAY = '100000';
delete process.env.PRI_PUBLIC_ORIGIN;
const { startApp, checks, registerAccount, verifyEmail } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
// Named by (skill, difficulty, seed): the skill's direct form (client/test/support/direct-forms.mjs). Other forms are
// marked by the sweeps over every issued question.
(await import('../../client/src/engine/generators/index.js')).directFormsOnly(true);

const SAMPLE = { generator: 'c10-arithmetic-progressions', difficulty: 3, seed: 5401, curriculum: 'in' };
// A true page with two stray lines: the displayed report no longer reproduces the method marks, so a markingReport is kept.
const WORKING = ['-122 = 16 - 6(n-1)', '-138 = -6(n-1)', '23 = n-1', 'Let n be the term', '7'];

const c = checks();
const h = await startApp({ engine: requestedEngine() });
try {
  const a = await registerAccount(h, { email: 'marking.report@example.test', deviceId: 'ipad-marking-report' });
  c.eq(a.status, 201, 'a student account exists');
  c.eq((await verifyEmail(h, a.account.id)).status, 200, 'and is verified');
  const q = (await h.request('/v1/practice/issue', { method: 'POST', jar: a.jar, body: SAMPLE })).data.question;
  const submit = (id, answer) => h.request(`/v1/practice/${q.id}/submit`, {
    method: 'POST', jar: a.jar, headers: { 'Idempotency-Key': id }, body: { submissionId: id, answer, mode: 'typed', steps: WORKING }
  });
  const first = await submit('mr-first-try', '5');
  c.deq([first.status, first.data.resolved], [200, false], 'a wrong first try leaves the question open');
  c.ok(!('markingReport' in first.data) && !('markingReportDiffers' in first.data), 'and carries neither the field nor the boolean');
  const second = await submit('mr-second-try', '6');
  c.deq([second.status, second.data.resolved], [200, true], 'the second wrong try resolves it');
  c.ok(!('markingReport' in second.data), 'the resolved reply never carries the field');
  c.eq(second.data.markingReportDiffers, true, 'it says only that the displayed report differs from the one that decided the marks');
  const rows = await h.db.all("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-grade'", [a.account.id]);
  const stored = rows.map(r => JSON.parse(r.response_json)).find(r => r.attemptId === second.data.attemptId);
  c.ok(stored, 'the resolved reply is stored');
  c.ok(stored.markingReport && Array.isArray(stored.markingReport.lines) && !('markingReportDiffers' in stored), 'the stored record carries the field, not the boolean');
  c.ok(stored.markingReport.lines.every(l => typeof l.text === 'string' && typeof l.status === 'string'), 'a line each, with its text and status');
  const replay = await submit('mr-second-try', '6');
  c.eq(replay.status, 200, 'the same request is answered again');
  c.eq(JSON.stringify(replay.data), JSON.stringify(second.data), 'the replay is byte-identical to the first reply');
} finally {
  await h.close();
  rmSync(scratch, { recursive: true, force: true });
  for (const key of keys) {
    if (before[key] === undefined) delete process.env[key];
    else process.env[key] = before[key];
  }
}
console.log(`engine: ${h.engine}`);
console.log(`MARKING REPORT OVER HTTP: PASS — ${c.count()}/${c.count()} checks — the field is stored and never sent; the client gets a boolean; replay is byte-identical`);
