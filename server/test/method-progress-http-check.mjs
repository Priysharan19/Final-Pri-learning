// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · method marks need progress, proved through the real server
//
// client/test/marker-method-progress-check.mjs proves the rule inside the
// engine. This suite proves the mark a student actually receives: it boots the
// shipped /v1 app (SQLite, or Postgres with --engine=postgres), has the server
// issue real `c8-linear-equations-both-sides` questions, reads the PUBLIC
// prompt, solves it here, and submits over HTTP.
//
//   · A deliberately wrong final answer whose working is only neutral lines —
//     `+1-1`, `2(…)/2`, the same number added to both sides, both sides doubled
//     — earns 0 marks, line by line and all together.
//   · The same wrong final answer with ONE genuine collecting step earns
//     partial marks: more than 0, fewer than the question carries. Padding that
//     step with the neutral lines earns exactly the same, never more.
//   · An identical idempotent replay returns the identical receipt.
//   · The persisted `graded-attempt` learning event carries the same marks as
//     the receipt that resolved the question, exactly once.
//
// "Both sides +k" is neutral only when k cancels nothing: on `6t - 1=-t - 22`
// adding 1 removes the constant and is a real step, so k is chosen to avoid it.
// ─────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const keys = ['NODE_ENV', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_PUBLIC_ORIGIN'];
const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const scratch = mkdtempSync(join(tmpdir(), 'pri-method-progress-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = 'e4'.repeat(32);
delete process.env.PRI_PUBLIC_ORIGIN;
const { startApp, checks, registerAccount, verifyEmail } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const { solveLinearPrompt } = await import('./support/linear-equation.mjs');

const GENERATOR = 'c8-linear-equations-both-sides';
// Fixed seeds, so the issued equations are the same on every run and engine.
// Between them: a negative net coefficient, a lone unit-coefficient term on one
// side (`3m + 12=m + 8`), and a constant of -1 that "+1 to both sides" would cancel.
const CASES = [
  { difficulty: 3, seed: 1, prompt: '$6m + 15=7m + 29$' },
  { difficulty: 2, seed: 2, prompt: '$3m + 12=m + 8$' },
  { difficulty: 2, seed: 3, prompt: '$4m + 8=-3m - 48$' },
  { difficulty: 2, seed: 104729, prompt: '$3x - 14=2x - 5$' },
  { difficulty: 2, seed: 654321, prompt: '$6t - 1=-t - 22$' },
  { difficulty: 3, seed: 42, prompt: '$8m - 10=4m - 10$' },
  { difficulty: 4, seed: 7, prompt: '$9x + 1=4x - 59$' }
];

const c = checks();
const h = await startApp({ engine: requestedEngine() });
let serial = 0;

const signed = n => (n >= 0 ? '+' : '') + n;
const term = (coefficient, variable) => `${coefficient === 1 ? '' : coefficient === -1 ? '-' : coefficient}${variable}`;

try {
  const a = await registerAccount(h, { email: 'method.progress@example.test', deviceId: 'ipad-method-progress' });
  c.eq(a.status, 201, 'a student account exists');
  c.eq((await verifyEmail(h, a.account.id)).status, 200, 'and is verified');

  const issue = async ({ difficulty, seed }) => {
    const r = await h.request('/v1/practice/issue', { method: 'POST', jar: a.jar, body: { generator: GENERATOR, difficulty, seed, curriculum: 'in' } });
    assert.equal(r.status, 201, `seed ${seed}: the server issues the question`);
    return r.data.question;
  };
  const submit = (qid, submissionId, answer, steps) => h.request(`/v1/practice/${qid}/submit`, {
    method: 'POST', jar: a.jar, headers: { 'Idempotency-Key': submissionId }, body: { submissionId, answer, mode: 'typed', steps }
  });
  const events = qid => h.db.all("SELECT id, payload_json FROM learning_events WHERE account_id=? AND entity_id=? AND kind='graded-attempt'", [a.account.id, qid]);

  /**
   * Issue the case afresh, submit `steps` with the wrong final answer, replay
   * it, then spend the second try on the same submission so the question
   * resolves. Returns the first receipt after checking everything every
   * receipt must satisfy; `expect(marksEarned, marksPossible)` judges the mark.
   */
  async function graded(sample, label, steps, wrong, expect) {
    const q = await issue(sample);
    const id = `mp-${serial++}-${label}`.replace(/[^a-zA-Z0-9_-]/g, '-');
    const first = await submit(q.id, id, wrong, steps);
    c.eq(first.status, 200, `${label}: the server grades it`);
    c.eq(first.data.authoritative, true, `${label}: and attests the grade`);
    c.eq(first.data.correct, false, `${label}: the wrong final answer is not correct`);
    c.eq(first.data.invalid, false, `${label}: it is a readable wrong answer, not an unreadable one`);
    c.eq(first.data.marksPossible, q.criteriaCount, `${label}: out of the marks the issued question carries`);
    c.ok(expect(first.data.marksEarned, first.data.marksPossible), `${label}: ${first.data.marksEarned}/${first.data.marksPossible} on "${sample.prompt}" with working ${JSON.stringify(steps)}`);
    c.eq(first.data.resolved, false, `${label}: a first wrong try leaves the question open`);
    c.ok(!('solution' in first.data), `${label}: and discloses no solution`);
    c.eq((await events(q.id)).length, 0, `${label}: nor records progress yet`);

    const replay = await submit(q.id, id, wrong, steps);
    c.eq(replay.status, 200, `${label}: the identical submission replays`);
    c.deq(replay.data, first.data, `${label}: as the identical receipt`);
    c.eq((await submit(q.id, id, String(Number(wrong) + 1), steps)).status, 409, `${label}: the same key with a different answer is refused`);

    const second = await submit(q.id, `${id}-second`, wrong, steps);
    c.eq(second.status, 200, `${label}: the second try is graded`);
    c.eq(second.data.resolved, true, `${label}: and resolves the question`);
    c.eq(second.data.marksEarned, first.data.marksEarned, `${label}: for the same marks as the first try`);
    c.eq(second.data.marksPossible, first.data.marksPossible, `${label}: out of the same total`);
    c.deq((await submit(q.id, `${id}-second`, wrong, steps)).data, second.data, `${label}: and its replay is the identical receipt too`);

    const stored = await events(q.id);
    c.eq(stored.length, 1, `${label}: exactly one graded-attempt event is persisted`);
    const payload = JSON.parse(stored[0]?.payload_json || '{}');
    c.eq(stored[0]?.id, second.data.attemptId, `${label}: it is the resolving attempt`);
    c.eq(payload.marksEarned, second.data.marksEarned, `${label}: carrying the receipt's marks earned`);
    c.eq(payload.marksPossible, second.data.marksPossible, `${label}: and marks possible`);
    c.eq(payload.correct, false, `${label}: and not correct`);
    return first.data;
  }

  for (const sample of CASES) {
    const tag = `d${sample.difficulty}s${sample.seed}`;
    const probe = await issue(sample);
    c.eq(probe.prompt, sample.prompt, `${tag}: the issued equation is the expected one`);
    for (const key of ['answer', 'solution', 'steps', 'stepcheck']) c.ok(!(key in probe), `${tag}: the public question has no ${key}`);
    c.eq(probe.supportsSteps, true, `${tag}: the server will check working for it`);
    c.ok(probe.criteriaCount >= 2, `${tag}: it carries at least two marks, so a method mark is possible`);

    const { variable, lhs, rhs, root, left, right, bare } = solveLinearPrompt(probe.prompt);
    assert.ok(bare && left.coefficient && right.coefficient, `${tag}: an equation with the unknown on both sides`);
    const wrong = String(root + 1);
    // A k that cancels neither side's constant: adding it is a neutral rewrite.
    let k = 1;
    while (k === -left.constant || k === -right.constant) k += 1;
    const neutral = [
      ['plus-minus-one', `${lhs}+1-1=${rhs}`],
      ['double-halve', `2(${lhs})/2=${rhs}`],
      ['both-sides-plus', `${lhs}+${k}=${rhs}+${k}`],
      ['both-sides-doubled', `2(${lhs})=2(${rhs})`]
    ];
    // One genuine step: the unknown collected on the left, nothing else done.
    const collecting = `${term(left.coefficient - right.coefficient, variable)}${left.constant ? signed(left.constant) : ''}=${right.constant}`;

    await graded(sample, `${tag}-neutral-all`, neutral.map(([, line]) => line), wrong, earned => earned === 0);
    for (const [name, line] of neutral) {
      await graded(sample, `${tag}-${name}`, [line], wrong, earned => earned === 0);
    }
    const one = await graded(sample, `${tag}-collecting`, [collecting], wrong, (earned, possible) => earned > 0 && earned < possible);
    c.ok(one.partial?.awarded === one.marksEarned, `${tag}: the receipt's method evidence agrees with the marks earned`);
    const padded = await graded(sample, `${tag}-collecting-padded`, [...neutral.map(([, line]) => line), collecting], wrong, (earned, possible) => earned > 0 && earned < possible);
    c.eq(padded.marksEarned, one.marksEarned, `${tag}: padding a genuine step with neutral lines earns no more`);
  }
} finally {
  await h.close();
  rmSync(scratch, { recursive: true, force: true });
  for (const key of keys) {
    if (before[key] === undefined) delete process.env[key];
    else process.env[key] = before[key];
  }
}

console.log(`engine: ${h.engine}`);
console.log(`METHOD PROGRESS OVER HTTP: PASS — ${c.count()}/${c.count()} checks — on ${CASES.length} server-issued equations a wrong answer with only neutral working earns 0, one genuine collecting step earns partial marks, replays return the identical receipt and the persisted graded attempt carries the same marks.`);
