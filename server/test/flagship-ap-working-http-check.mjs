// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · "which term of the progression" — working is marked by the server
//
// The owner's own question: first term 16, common difference −6, which term is
// −122? (n = 24, three marks.) The question was issued with no step checking,
// so correct working under a wrong final answer earned nothing and no line was
// ever reported on. This suite boots the shipped /v1 app (SQLite, or Postgres
// with --engine=postgres), has the server issue that question, and submits
// over HTTP:
//
//   · `5`, and `23` with no working, earn 0 of 3 and the solution shows n = 24;
//   · `24` earns 3 of 3 with or without working, exactly once;
//   · the full working with a wrong last line earns method marks — more than
//     0, fewer than 3 — and the report names the line that broke;
//   · a root written another way (`n - 24 = 0`, `2n = 48`), a sweep of guesses
//     and a false set-up cannot reach full marks under a wrong answer, and a
//     sweep or a false set-up earns nothing;
//   · while the question is open the reply says nothing about the working;
//   · a twelve-thousand-character sum is marked in well under a second, and a
//     sweep of middle-term splits on a quadratic earns nothing.
// ─────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const keys = ['NODE_ENV', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_PUBLIC_ORIGIN'];
const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const scratch = mkdtempSync(join(tmpdir(), 'pri-flagship-ap-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = 'e4'.repeat(32);
delete process.env.PRI_PUBLIC_ORIGIN;
const { startApp, checks, registerAccount, verifyEmail } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');

const SAMPLE = { generator: 'c10-arithmetic-progressions', difficulty: 3, seed: 5401, curriculum: 'in' };
const PROMPT = 'In the arithmetic progression with first term $16$ and common difference $-6$, which term is equal to $-122$? Give the term number.';
const WORKING = ['-122 = 16 - 6(n-1)', '-138 = -6(n-1)', '23 = n-1'];

const c = checks();
const h = await startApp({ engine: requestedEngine() });
let serial = 0;

try {
  const a = await registerAccount(h, { email: 'flagship.ap@example.test', deviceId: 'ipad-flagship-ap' });
  c.eq(a.status, 201, 'a student account exists');
  c.eq((await verifyEmail(h, a.account.id)).status, 200, 'and is verified');

  const issue = async () => {
    const r = await h.request('/v1/practice/issue', { method: 'POST', jar: a.jar, body: SAMPLE });
    assert.equal(r.status, 201, 'the server issues the question');
    return r.data.question;
  };
  const submit = (qid, submissionId, answer, steps) => h.request(`/v1/practice/${qid}/submit`, {
    method: 'POST', jar: a.jar, headers: { 'Idempotency-Key': submissionId }, body: { submissionId, answer, mode: 'typed', steps }
  });
  const events = qid => h.db.all("SELECT id, payload_json FROM learning_events WHERE account_id=? AND entity_id=? AND kind='graded-attempt'", [a.account.id, qid]);

  const probe = await issue();
  c.eq(probe.prompt, PROMPT, 'the issued question is the owner\'s');
  for (const key of ['answer', 'solution', 'steps', 'stepcheck']) c.ok(!(key in probe), `the public question has no ${key}`);
  c.eq(probe.supportsSteps, true, 'the server will check working for it');
  c.eq(probe.criteriaCount, 3, 'it carries three marks');

  /** A wrong final answer, twice, so the question resolves; returns the resolving receipt. */
  async function wrong(label, answer, steps) {
    const q = await issue();
    const id = `ap-${serial++}-${label}`;
    const first = await submit(q.id, id, answer, steps);
    c.eq(first.status, 200, `${label}: the server grades it`);
    c.deq([first.data.correct, first.data.resolved], [false, false], `${label}: a first wrong try leaves the question open`);
    c.deq([first.data.marksEarned, first.data.stepReport, first.data.partial, first.data.trapWhy], [0, null, null, null], `${label}: and is told nothing about the working or the answer`);
    c.ok(!('solution' in first.data), `${label}: nor shown a solution`);
    c.eq((await events(q.id)).length, 0, `${label}: nor is progress recorded yet`);
    const second = await submit(q.id, `${id}-second`, answer, steps);
    c.deq([second.status, second.data.correct, second.data.resolved], [200, false, true], `${label}: the second wrong try resolves it as incorrect`);
    c.eq(second.data.marksPossible, 3, `${label}: out of three marks`);
    const stored = await events(q.id);
    c.eq(stored.length, 1, `${label}: exactly one graded attempt is persisted`);
    c.eq(JSON.parse(stored[0]?.payload_json || '{}').marksEarned, second.data.marksEarned, `${label}: carrying the receipt's marks`);
    c.ok(JSON.stringify(second.data.solution ?? second.data).includes('n = 24'), `${label}: and the worked solution shows n = 24`);
    return second.data;
  }

  // The owner's test 1: `5`.
  c.eq((await wrong('five', '5', [])).marksEarned, 0, 'five: 0 of 3');
  c.eq((await wrong('bare-23', '23', [])).marksEarned, 0, 'a wrong answer with no working: 0 of 3');

  // The owner's test 2: `24`, once.
  {
    const q = await issue();
    const right = await submit(q.id, 'ap-right', '24', []);
    c.deq([right.status, right.data.correct, right.data.resolved, right.data.marksEarned, right.data.marksPossible], [200, true, true, 3, 3], '24 is correct: 3 of 3');
    c.deq((await submit(q.id, 'ap-right', '24', [])).data, right.data, 'its replay is the identical receipt');
    c.eq((await events(q.id)).length, 1, 'and progress is saved once');
  }

  // The owner's test 3: the full working.
  {
    const q = await issue();
    const full = await submit(q.id, 'ap-full-working', '24', [...WORKING, 'n = 24']);
    c.deq([full.data.correct, full.data.marksEarned, full.data.marksPossible], [true, 3, 3], 'the full working with n = 24: 3 of 3');
    c.deq(full.data.stepReport?.lines?.map(line => line.status), ['ok', 'ok', 'ok', 'ok'], 'every line of it is reported correct');
    c.eq(full.data.stepReport?.firstBreak, -1, 'and nothing breaks');
  }

  // The same working with a slip on the last line.
  const slipped = await wrong('working-wrong-last-line', '23', [...WORKING, 'n = 23']);
  c.ok(slipped.marksEarned > 0 && slipped.marksEarned < 3, `correct working under a wrong answer earns method marks, not full marks (${slipped.marksEarned}/3)`);
  c.eq(slipped.partial?.awarded, slipped.marksEarned, 'the method evidence agrees with the marks');
  c.deq(slipped.stepReport?.lines?.map(line => line.status), ['ok', 'ok', 'ok', 'break'], 'and the report names the last line as the one that broke');

  // What must not buy the marks.
  const setUpOnly = await wrong('set-up-only', '23', [WORKING[0]]);
  c.ok(setUpOnly.marksEarned <= 1, `setting the equation up is worth at most the set-up mark (${setUpOnly.marksEarned}/3)`);
  for (const [label, steps] of [['root-as-difference', ['n - 24 = 0']], ['root-doubled', ['2n = 48']], ['root-twice', ['n - 24 = 0', '2n = 48', '3n = 72']]]) {
    const r = await wrong(label, '23', steps);
    c.ok(r.marksEarned <= 1, `${label}: the root written another way never earns more than one mark, however often (${r.marksEarned}/3)`);
  }
  c.eq((await wrong('sweep', '23', ['n = 22', 'n = 23', 'n = 24'])).marksEarned, 0, 'a sweep of guesses earns nothing');
  c.eq((await wrong('false-set-up', '23', ['16 - 6n = -122', 'n = 23'])).marksEarned, 0, 'a false set-up earns nothing');
  c.eq((await wrong('padding', '23', ['16 = 16', '-122 = -122', '24 - 1 = 23'])).marksEarned, 0, 'arithmetic with no unknown earns nothing');

  // What an answer costs to mark does not depend on what is written in it: a
  // sum of ten thousand terms, each twelve thousand characters long, took
  // three to four seconds here and, being unreadable, spent no try.
  {
    const q = await issue();
    let term = '170!';
    while (term.length < 11800) term += '+170!';
    const at = Date.now();
    const long = await submit(q.id, 'ap-long-sum-answer', `sum(${term};k;1;10000)`, []);
    const ms = Date.now() - at;
    c.eq(long.status, 200, 'a twelve-thousand-character sum is answered');
    c.eq(long.data.correct, false, 'and is not correct');
    c.ok(ms < 1500, `in well under the seconds it used to take (${ms} ms)`);
  }

  // The middle term of a quadratic split every way the coefficients allow:
  // from the printed question alone this used to collect a method mark.
  for (const seed of [7000, 7001, 7002]) {
    const r = await h.request('/v1/practice/issue', { method: 'POST', jar: a.jar, body: { generator: 'c10-quadratic-roots', difficulty: 3, seed, curriculum: 'in' } });
    assert.equal(r.status, 201, `seed ${seed}: the server issues a quadratic`);
    const q = r.data.question;
    const m = String(q.prompt).replace(/[−–]/g, '-').replace(/\s+/g, '').match(/(\d*)x\^2([+-]\d*)x([+-]\d+)=0/);
    assert.ok(m, `seed ${seed}: the printed equation is a quadratic in x (${q.prompt})`);
    const lead = m[1] === '' ? 1 : Number(m[1]);
    const b = m[2] === '+' ? 1 : m[2] === '-' ? -1 : Number(m[2]);
    const cst = Number(m[3]);
    const signed = n => (n < 0 ? '-' : '+') + (Math.abs(n) === 1 ? '' : Math.abs(n));
    const sweep = [];
    for (let k = -20; k <= 20; k++) {
      if (k === 0 || k === b) continue;
      const square = `${lead === 1 ? '' : lead}x^2`, one = `${signed(b - k)}x`, two = `${signed(k)}x`, tail = `${signed(cst).replace(/^([+-])$/, '$11')}=0`;
      sweep.push(k % 2 ? `${square}${one}${two}${tail}` : `${two.replace(/^\+/, '')}+${square}${one}${tail}`);
    }
    const first = await submit(q.id, `split-sweep-${seed}-one`, '97, 98', sweep);
    c.deq([first.status, first.data.correct, first.data.resolved], [200, false, false], `seed ${seed}: a sweep of ${sweep.length} splits under a wrong answer leaves the question open`);
    const second = await submit(q.id, `split-sweep-${seed}-two`, '97, 98', sweep);
    c.deq([second.status, second.data.resolved, second.data.marksEarned], [200, true, 0], `seed ${seed}: and resolves at 0 of ${second.data.marksPossible} on "${q.prompt}"`);
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
console.log(`FLAGSHIP AP WORKING OVER HTTP: PASS — ${c.count()}/${c.count()} checks — the server issues the term-number question, marks 5 and a bare 23 at 0 of 3, 24 at 3 of 3 once, pays method marks for correct working under a wrong last line, and pays nothing for a sweep, a false set-up or padding; a huge sum is marked quickly and a sweep of middle-term splits earns nothing.`);
