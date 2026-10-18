// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the owner's AP photo, as the server marks it (issue #430)
//
// The owner photographed this Class 10 working for "first term 9, common
// difference 3, find the 9th term":
//
//     a = 9, d = 3
//     T_n = a + (n - 1)d
//     T_9 = 9 + 8 × 3
//         = 9 + 24
//         = 35
//
// The formula, the substitution and the multiplication are right; the LAST
// line is false (9 + 24 = 33). Ported from draft PR #482, where it was pinned
// RED: the D1 generator issued the question with no step-check plan, so the
// resolving reply carried `stepReport: null` and no line was ever judged.
//
// This suite boots the shipped /v1 app (SQLite, or Postgres with
// --engine=postgres), has the server issue exactly that question (seed 10931)
// and submits the transcript as typed working:
//
//   · the first wrong try is told nothing about the working (no oracle);
//   · the resolving reply marks the one-mark question 0 of 1 — a one-mark
//     rubric has no method marks to pay, and a wrong final answer never earns
//     the answer mark — and its step report names line 5 as the first break,
//     with the formula, substitution and multiplication above it verified;
//   · the same page ending `= 33` is correct, 1 of 1, and nothing breaks.
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const keys = ['NODE_ENV', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_PUBLIC_ORIGIN'];
const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const scratch = mkdtempSync(join(tmpdir(), 'pri-owner-ap-first-break-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = 'fa'.repeat(32);
delete process.env.PRI_PUBLIC_ORIGIN;
const { startApp, checks, registerAccount, verifyEmail } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');

const SAMPLE = Object.freeze({ generator: 'c10-arithmetic-progressions', difficulty: 1, seed: 10931, curriculum: 'in' });
const PROMPT = 'An arithmetic progression has first term $9$ and common difference $3$. Find its $9$th term.';
const GIVEN = ['a = 9, d = 3', 'T_n = a + (n - 1)d', 'T_9 = 9 + 8 × 3', '= 9 + 24', '= 35'];
const FIXED = [...GIVEN.slice(0, -1), '= 33'];

const c = checks();
const h = await startApp({ engine: requestedEngine() });
let serial = 0;
try {
  const a = await registerAccount(h, { email: 'owner-ap-first-break@example.test', deviceId: 'ap-first-break-test' });
  c.eq(a.status, 201, 'a student account exists');
  c.eq((await verifyEmail(h, a.account.id)).status, 200, 'and is verified');

  const issue = async () => {
    const r = await h.request('/v1/practice/issue', { method: 'POST', jar: a.jar, body: SAMPLE });
    assert.equal(r.status, 201, 'the server issues the question');
    assert.equal(r.data.question.prompt, PROMPT, 'the issued question is the owner\'s');
    return r.data.question;
  };
  const submit = (qid, answer, lines) => {
    const id = `owner-ap-${++serial}`;
    return h.request(`/v1/practice/${qid}/submit`, {
      method: 'POST', jar: a.jar, headers: { 'Idempotency-Key': id },
      body: { submissionId: id, answer, mode: 'typed', steps: lines.join('\n') }
    });
  };

  const probe = await issue();
  c.eq(probe.answerType, 'numeric', 'a numeric answer');
  c.deq([probe.supportsSteps, probe.criteriaCount], [true, 1], 'the server will check the working of this one-mark question');
  for (const key of ['answer', 'solution', 'steps', 'stepcheck', 'traps']) c.ok(!(key in probe), `the public question has no ${key}`);

  // The owner's page, as photographed: wrong on the last line.
  const wrong = await issue();
  const first = await submit(wrong.id, '35', GIVEN);
  c.eq(first.status, 200, 'the first answer is graded by the server');
  c.deq([first.data.correct, first.data.resolved], [false, false], 'a first wrong try leaves the question open');
  c.deq([first.data.stepReport, first.data.partial, first.data.marksEarned], [null, null, 0], 'and is told nothing about the working');
  c.ok(!('solution' in first.data), 'nor shown a solution');
  const second = await submit(wrong.id, '35', GIVEN);
  c.deq([second.status, second.data.resolved, second.data.authoritative], [200, true, true], 'the second wrong try resolves it authoritatively');
  const actual = {
    marksEarned: second.data.marksEarned,
    marksPossible: second.data.marksPossible,
    statuses: second.data.stepReport?.lines?.map(line => line.status) || null,
    firstBreak: second.data.stepReport?.firstBreak ?? null,
    partial: second.data.partial?.awarded ?? null
  };
  console.log('ACTUAL AUTHORITY:', JSON.stringify(actual));
  // The issued D1 question is worth ONE mark. The wrong answer receives zero:
  // a one-mark rubric has no method marks, and first-error diagnosis is an
  // educational requirement, never authority to pay imaginary method marks.
  c.eq(actual.marksPossible, 1, 'the issued question carries one mark');
  c.eq(actual.marksEarned, 0, 'a wrong final answer earns no one-mark credit');
  c.eq(actual.partial, 0, 'and the method evidence agrees: nothing to pay');
  c.eq(actual.firstBreak, 4, 'the first mathematical mistake is the fifth line (= 35)');
  c.eq(actual.statuses?.[4], 'break', 'the last arithmetic equality is false');
  c.ok((actual.statuses || []).slice(1, 4).filter(s => s === 'ok').length >= 2,
    `formula, substitution and multiplication carry verified step evidence (${JSON.stringify(actual.statuses)})`);
  c.deq(actual.statuses, ['ok', 'ok', 'ok', 'ok', 'break'], 'every line above the slip is verified, and nothing after it is blamed');
  const broken = second.data.stepReport?.lines?.[4];
  c.eq(broken?.diagnosis?.code, 'arithmetic-slip', 'the slip is named as arithmetic');
  c.ok(/9 \+ 24 equals 33, not 35/.test(String(broken?.note || broken?.diagnosis?.message || '')),
    `and the note says what the addition should give (${broken?.note})`);
  c.ok(JSON.stringify(second.data.solution ?? {}).includes('33'), 'the worked solution shows 33');
  const stored = await h.db.all("SELECT payload_json FROM learning_events WHERE account_id=? AND entity_id=? AND kind='graded-attempt'", [a.account.id, wrong.id]);
  c.eq(stored.length, 1, 'exactly one graded attempt is persisted');
  c.deq([JSON.parse(stored[0]?.payload_json || '{}').marksEarned, JSON.parse(stored[0]?.payload_json || '{}').correct], [0, false], 'carrying the receipt\'s marks');

  // The same page, corrected on its last line.
  const right = await issue();
  const correct = await submit(right.id, '33', FIXED);
  c.deq([correct.status, correct.data.correct, correct.data.resolved, correct.data.marksEarned, correct.data.marksPossible], [200, true, true, 1, 1], '= 33 is correct: 1 of 1');
  c.eq(correct.data.stepReport?.firstBreak, -1, 'and the corrected page has no break');
  c.deq(correct.data.stepReport?.lines?.map(line => line.status), ['ok', 'ok', 'ok', 'ok', 'ok'], 'every line of it is verified');

} finally {
  await h.close();
  rmSync(scratch, { recursive: true, force: true });
  for (const key of keys) {
    if (before[key] === undefined) delete process.env[key];
    else process.env[key] = before[key];
  }
}

console.log(`engine: ${h.engine}`);
console.log(`OWNER AP FIRST-MISTAKE CONTRACT: PASS — ${c.count()}/${c.count()} checks — the server marks the owner's page 0 of 1, names "= 35" as the first break with the formula, substitution and multiplication verified above it, and marks the corrected page 1 of 1 with nothing broken.`);
