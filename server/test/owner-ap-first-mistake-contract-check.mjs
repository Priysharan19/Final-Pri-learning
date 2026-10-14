/**
 * Owner's exact AP first-error acceptance (issue #430).
 * Intentionally RED until Agent 1 supplies genuine server-owned mathematical
 * step evidence and rubric support. It does not implement marking authority.
 * Real local /v1 HTTP + isolated SQLite; no OCR and no student credentials.
 *
 * Run: node server/test/owner-ap-first-mistake-contract-check.mjs
 */
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const expectedPrompt = 'An arithmetic progression has first term $9$ and common difference $3$. Find its $9$th term.';
const given = ['a = 9, d = 3', 'T_n = a + (n - 1)d', 'T_9 = 9 + 8 × 3', '= 9 + 24', '= 35'];
const fixed = [...given.slice(0, -1), '= 33'];
const SAMPLE = Object.freeze({ generator: 'c10-arithmetic-progressions', difficulty: 1, seed: 10931, curriculum: 'in' });

const before = Object.fromEntries(['NODE_ENV', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_PUBLIC_ORIGIN'].map(k => [k, process.env[k]]));
const dir = mkdtempSync(join(tmpdir(), 'pri-owner-ap-first-break-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = join(dir, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = 'fa'.repeat(32);
delete process.env.PRI_PUBLIC_ORIGIN;
let h;
try {
  const { startApp, registerAccount, verifyEmail } = await import('./support/app-harness.mjs');
  h = await startApp({ engine: 'sqlite' });
  const account = await registerAccount(h, { email: 'owner-ap-first-break@example.test', deviceId: 'ap-first-break-test' });
  assert.equal(account.status, 201);
  assert.equal((await verifyEmail(h, account.account.id)).status, 200);
  const issue = async () => {
    const res = await h.request('/v1/practice/issue', { method: 'POST', jar: account.jar, body: SAMPLE });
    assert.equal(res.status, 201);
    assert.equal(res.data.question.prompt, expectedPrompt);
    assert.equal(res.data.question.answerType, 'numeric');
    return res.data.question;
  };
  let serial = 0;
  const submit = (id, answer, lines) => h.request(`/v1/practice/${id}/submit`, {
    method: 'POST', jar: account.jar,
    headers: { 'Idempotency-Key': `owner-ap-${++serial}` },
    body: { submissionId: `owner-ap-${serial}`, answer, mode: 'typed', steps: lines.join('\n') }
  });
  const wrong = await issue();
  const first = await submit(wrong.id, '35', given);
  assert.equal(first.status, 200, 'first answer must be graded by the server');
  assert.equal(first.data.correct, false);
  assert.equal(first.data.resolved, false, 'first try stays open, no worked answer leaked');
  assert.equal(first.data.stepReport, null, 'first unresolved response is not permitted to reveal error');
  const second = await submit(wrong.id, '35', given);
  assert.equal(second.status, 200);
  assert.equal(second.data.resolved, true);
  assert.equal(second.data.authoritative, true);
  const actual = {
    marksEarned: second.data.marksEarned,
    marksPossible: second.data.marksPossible,
    statuses: second.data.stepReport?.lines?.map(line => line.status) || null,
    firstBreak: second.data.stepReport?.firstBreak ?? null,
    partial: second.data.partial?.awarded ?? null
  };
  console.log('ISSUED QUESTION MATCHES: true');
  console.log('ACTUAL AUTHORITY:', JSON.stringify(actual));
  // The exact issued D1 question is worth ONE mark. The wrong answer must
  // receive zero; no method marks exist on a one-mark rubric. First-error
  // diagnosis is a separate educational requirement, not authority to pay
  // the student two imaginary method marks.
  assert.equal(actual.marksPossible, 1, 'use the issued question rubric');
  assert.equal(actual.marksEarned, 0, 'wrong final answer earns no one-mark credit');
  assert.equal(actual.firstBreak, 4, 'first mathematical mistake must point to original line 5 (=35)');
  assert.equal(actual.statuses?.[4], 'break', 'the last arithmetic equality is mathematically false');
  assert.ok(actual.statuses.slice(1, 4).filter(s => s === 'ok').length >= 2,
    'formula/substitution/multiplication need verified mathematical step evidence');
  const right = await issue();
  const correct = await submit(right.id, '33', fixed);
  assert.equal(correct.status, 200);
  assert.equal(correct.data.correct, true);
  assert.equal(correct.data.marksEarned, 1);
  assert.equal(correct.data.stepReport?.firstBreak, -1, 'the corrected final line must have no error');
  console.log('OWNER AP FIRST-MISTAKE CONTRACT: PASS');
} finally {
  await h?.close();
  for (const [k, v] of Object.entries(before)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  rmSync(dir, { recursive: true, force: true });
}
