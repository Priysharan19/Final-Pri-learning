// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · marker isolation (R4: mathematical marking authority)
//
//   node server/test/marker-isolation-check.mjs                    (SQLite)
//   node server/test/marker-isolation-check.mjs --engine=postgres  (Postgres)
//
// The deterministic marker used to run inside the request, on the one thread
// that serves every account. An answer or a page of working inside the size
// limits could hold that thread for seconds, and for that long nobody else was
// answered. It now runs in worker threads under a hard deadline
// (server/platform/markerPool.js). This suite proves, over the shipped /v1
// routes on a real loopback socket:
//
//   • an entry that cannot be marked in time comes back, in time, as an
//     UNREADABLE entry: no try spent, no marks, nothing recorded;
//   • while it is being marked, another account's requests are answered
//     promptly — and that the same test FAILS with the pool bypassed (the
//     behaviour before), so the measurement means something;
//   • the cut-off rules for working and for an examination part;
//   • the transaction restructure keeps every invariant under concurrency:
//     parallel submissions, a replay during marking, a double finish, a
//     sign-out during marking;
//   • the pool's bounds: queue, per-account serialisation, cooldown, crash and
//     out-of-memory recovery, clean shutdown; and what it logs.
//
// The three slow inputs an audit measured are submitted exactly, but nothing
// here depends on their staying slow (they are being fixed in the engine):
// preemption is proved with a TEST-ONLY worker (support/marker-test-worker.mjs)
// that can be told to spin, which production can neither load nor reach.
//
// This is synthetic evidence from an in-process server. It says nothing about
// production hardware, real students or real load.
// ─────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const keys = ['NODE_ENV', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_PUBLIC_ORIGIN'];
const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const scratch = mkdtempSync(join(tmpdir(), 'pri-marker-isolation-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = 'a7'.repeat(32);
delete process.env.PRI_PUBLIC_ORIGIN;

const { startApp, checks, registerAccount, verifyEmail, cookieHeader } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const { solveLinearPrompt } = await import('./support/linear-equation.mjs');
const { magic, TEST_MARKER_OPS } = await import('./support/marker-test-worker.mjs');
const {
  createMarkerPool, useMarkerPoolForTests, closeMarkerPool, markerPool,
  MARKER_LIMITS, MARKER_COOLDOWN, MARKING_TOO_COMPLEX, MARKING_BUSY, MARKING_COOLDOWN,
  TOO_COMPLEX_MESSAGE, WORKING_NOT_READ_NOTE
} = await import('../platform/markerPool.js');
const { MARKER_OPS, stepMetaFor, tutorEvidence } = await import('../platform/markerOps.js');
const { issuedQuestionForTutor } = await import('../platform/practice.js');
const { setLogSink } = await import('../platform/observability.js');
const { metrics } = await import('../platform/metrics.js');
const { checkAnswer } = await import('../../client/src/engine/checker.js');
const { subtopicsForYear } = await import('../../client/src/engine/curriculum.js');
const { multipartForYear } = await import('../../client/src/engine/generators/multipart.js');

const TEST_ENTRY = fileURLToPath(new URL('./support/marker-test-worker.mjs', import.meta.url));
const c = checks();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const timed = async promise => { const started = performance.now(); const value = await promise; return { value, ms: performance.now() - started }; };
const median = list => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];
const report = {};

// Every structured line the server logs while this suite runs.
const logged = [];
const previousSink = setLogSink((level, text, line) => { logged.push({ text, line }); });

// The three inputs the audit measured, as it wrote them.
const AUDIT_REGEX = 'C(' + ' '.repeat(197) + ',' + ' '.repeat(198) + 'x';
const LETTERS = 'abcdfghjklmnopqrstuv'.split('');
const padProbe = expr => { let out = expr; for (let k = 1; ; k++) { const next = `${out}+0*sin(${k}*(x+${LETTERS.join('+')}))^2`; if (next.length > 385) return out; out = next; } };
const padPole = expr => { let out = expr; for (let k = 0; ; k++) { const next = `${out}+0*sin(1/(x-${(k % 9) + 1}))*tan(x)`; if (next.length > 390) return out; out = next; } };

const LINEAR = 'c8-linear-equations-both-sides';
const EXPRESSION = { generator: 'y7-algebra', difficulty: 4, seed: 1 };    // "Expand and simplify 4(x - 6) + 3(x + 6)" → 7x - 6

// ═════════════════════════════════════════════════════════════════════════════
// A. The pool by itself
// ═════════════════════════════════════════════════════════════════════════════
const Q = { answerType: 'expression', answer: { expr: 'x^2+2*x+1' }, prompt: 'Expand $(x+1)^2$', difficulty: 2, steps: [{ h: 'Expand' }, { h: 'Collect' }] };
const practiceArgs = (answer, working = '', evidenceIfWrong = true) => ({ q: Q, answer, working, evidenceIfWrong });
{
  const pool = createMarkerPool({ entry: TEST_ENTRY, deadlineMs: 200, size: 2 });
  await pool.ready();
  c.eq(pool.stats().ready, 2, 'pool: both workers import the engine and report ready');

  // The same input, the same verdict — through a worker or not.
  for (const [answer, working] of [['x^2+2x+1', ''], ['(x+1)^2', ''], ['x^2+1', '(x+1)(x+1)\nx^2+x+x+1'], ['', 'x^2+2x+1'], ['??', ''], ['x^2+2x+2', '']]) {
    const viaPool = await pool.run('practice', practiceArgs(answer, working), { key: 'determinism' });
    const inline = MARKER_OPS.practice(practiceArgs(answer, working), () => {});
    c.ok(viaPool.ok, `pool: ${JSON.stringify(answer)} is marked`);
    c.deq(viaPool.value, inline, `pool: ${JSON.stringify(answer)} gets exactly the verdict the engine gives in-process`);
  }

  // Preemption: an operation that never returns is stopped at the deadline.
  const killsBefore = metrics.sum('marker_events_total', { where: { kind: 'deadline_kill' } });
  const stuck = await timed(pool.run('practice', practiceArgs(magic('spin')), { key: 'attacker' }));
  c.deq([stuck.value.ok, stuck.value.code, stuck.value.reason], [false, MARKING_TOO_COMPLEX, 'deadline'], 'pool: an operation that never returns resolves as MARKING_TOO_COMPLEX');
  c.ok(stuck.ms >= 190 && stuck.ms < 200 + 400, `pool: at its deadline, not later (${Math.round(stuck.ms)} ms for a 200 ms deadline)`);
  c.deq(stuck.value.partials, [], 'pool: and carries no verdict at all');
  c.eq(metrics.sum('marker_events_total', { where: { kind: 'deadline_kill' } }), killsBefore + 1, 'pool: the kill is counted in the metrics');
  const after = await timed(pool.run('practice', practiceArgs('x^2+2x+1'), { key: 'attacker' }));
  c.ok(after.value.ok && after.value.value.result.correct === true, 'pool: the next operation is marked normally');
  await pool.ready();
  c.deq([pool.stats().ready, pool.stats().deadlineKills, pool.stats().restarts], [2, 1, 1], 'pool: the stopped worker was replaced — two ready again, one kill, one restart');

  // A stage that finished before the deadline is kept.
  const half = await pool.run('practice', practiceArgs('x^2+1', `x^2+2x+1 ${magic('spin')}`), { key: 'attacker' });
  c.deq([half.ok, half.code], [false, MARKING_TOO_COMPLEX], 'pool: working that never finishes is stopped too');
  c.deq(half.partials, [{ result: MARKER_OPS.practice(practiceArgs('x^2+1', '', false), () => {}).result }], 'pool: and the answer verdict it had already reached is kept, exactly');

  // A worker that dies is a deadline by another name.
  const died = await pool.run('practice', practiceArgs(magic('exit')), { key: 'attacker' });
  c.deq([died.ok, died.code, died.reason], [false, MARKING_TOO_COMPLEX, 'crash'], 'pool: a worker that exits mid-operation resolves as MARKING_TOO_COMPLEX');
  await pool.ready();
  c.eq(pool.stats().ready, 2, 'pool: and is replaced');

  // An operation that throws is the engine's own exception, and the worker stays.
  const spawned = pool.stats().spawned;
  await c.rejects(() => pool.run('practice', practiceArgs(magic('throw')), { key: 'attacker' }), { code: 'MARKER_OP_FAILED' }, 'pool: an operation that throws rejects, as it would have thrown inline');
  c.eq(pool.stats().spawned, spawned, 'pool: without costing a worker');
  await c.rejects(() => pool.run('no-such-op', {}), { code: 'MARKER_OP_FAILED' }, 'pool: an unknown operation is refused by the worker');
  await c.rejects(() => pool.run('practice', { q: Q, answer: () => 1 }), { code: 'MARKER_ARGS_INVALID' }, 'pool: arguments that are not plain data are refused');

  // One account never runs two operations at once, so it never holds the pool.
  const order = [];
  const a1 = pool.run('practice', practiceArgs(magic('spin', 150) + 'x^2+2x+1'), { key: 'attacker' }).then(r => { order.push('a1'); return r; });
  const a2 = pool.run('practice', practiceArgs(magic('spin', 150) + 'x^2+2x+1'), { key: 'attacker' }).then(r => { order.push('a2'); return r; });
  await sleep(20);
  const by = await timed(pool.run('practice', practiceArgs('x^2+2x+1'), { key: 'bystander' }));
  order.push('bystander');
  const both = await timed(Promise.all([a1, a2]));
  c.ok(by.value.ok && by.ms < 100, `pool: a bystander is marked at once while one account has two slow operations queued (${by.ms.toFixed(1)} ms)`);
  c.eq(order[0], 'bystander', 'pool: ahead of both of them');
  c.ok(both.value.every(r => r.ok && r.value.result.correct), 'pool: and both slow operations still get their true verdict');
  c.ok(both.value[1].ms >= 140 && by.ms + both.ms >= 250, 'pool: having run one after the other, not side by side');
  await pool.close();
}
{
  // Queue bounds: per account, in all, and in waiting time.
  const pool = createMarkerPool({ entry: TEST_ENTRY, deadlineMs: 400, size: 1, maxQueue: 3, maxQueuePerKey: 2, maxQueueWaitMs: 150 });
  await pool.ready();
  const running = pool.run('practice', practiceArgs(magic('spin', 300) + 'x^2+2x+1'), { key: 'k' });
  await sleep(20);
  const q1 = pool.run('practice', practiceArgs('x^2+2x+1'), { key: 'k' });
  const q2 = pool.run('practice', practiceArgs('x^2+2x+1'), { key: 'k' });
  const overKey = await timed(pool.run('practice', practiceArgs('x^2+2x+1'), { key: 'k' }));
  c.deq([overKey.value.ok, overKey.value.code, overKey.value.reason], [false, MARKING_BUSY, 'account-queue-full'], 'queue: an account with its share of the queue already waiting is refused, typed');
  c.ok(overKey.ms < 20, 'queue: immediately, not after waiting');
  const other = pool.run('practice', practiceArgs('x^2+2x+1'), { key: 'other' });
  const overAll = await pool.run('practice', practiceArgs('x^2+2x+1'), { key: 'third' });
  c.deq([overAll.ok, overAll.code, overAll.reason], [false, MARKING_BUSY, 'queue-full'], 'queue: a full queue refuses the next operation, typed');
  const waited = await Promise.all([q1, q2, other].map(timed));
  c.ok(waited.every(w => w.value.ok === false && w.value.code === MARKING_BUSY && w.value.reason === 'queue-wait'), 'queue: an operation that waits longer than the bound is refused rather than left to pile up');
  c.ok(waited.every(w => w.ms >= 140 && w.ms < 300), 'queue: at the bound');
  c.ok((await running).ok, 'queue: and the operation that was running finishes untouched');
  c.eq(pool.stats().queueRefusals, 5, 'queue: every refusal is counted');
  await pool.close();
  const closed = await pool.run('practice', practiceArgs('x^2+2x+1'));
  c.deq([closed.ok, closed.code, closed.reason], [false, MARKING_BUSY, 'closed'], 'shutdown: a closed pool refuses work');
  await pool.close();
  c.ok(true, 'shutdown: closing twice is harmless');
}
{
  // A memory bomb ends its own worker, not the process.
  const pool = createMarkerPool({ entry: TEST_ENTRY, deadlineMs: 20_000, size: 1, heapMb: 32 });
  await pool.ready();
  const bomb = await timed(pool.run('practice', practiceArgs(magic('oom'))));
  c.deq([bomb.value.ok, bomb.value.code, bomb.value.reason], [false, MARKING_TOO_COMPLEX, 'crash'], 'heap: an operation that exhausts the worker heap resolves as MARKING_TOO_COMPLEX');
  c.ok(bomb.ms < 15_000, `heap: by the heap limit, long before the deadline (${Math.round(bomb.ms)} ms)`);
  const next = await pool.run('practice', practiceArgs('x^2+2x+1'));
  c.ok(next.ok && next.value.result.correct, 'heap: and the replacement worker marks normally');
  await pool.close();
}
{
  // A pool whose worker cannot start does not spin: it backs off and refuses.
  const pool = createMarkerPool({ entry: join(scratch, 'no-such-worker.mjs'), size: 1, maxQueueWaitMs: 150 });
  const refused = await pool.run('practice', practiceArgs('x^2+2x+1'));
  c.deq([refused.ok, refused.code], [false, MARKING_BUSY], 'startup: with no worker able to start, marking is refused as busy, never hung');
  c.ok(pool.stats().spawned <= 4, `startup: and restarts back off (${pool.stats().spawned} attempts in 150 ms)`);
  await pool.close();
  // Production runs only the shipped worker.
  assert.throws(() => createMarkerPool({ entry: TEST_ENTRY, env: { NODE_ENV: 'production' } }), { code: 'MARKER_POOL_CONFIG_INVALID' });
  assert.throws(() => createMarkerPool({ inline: true, env: { NODE_ENV: 'production' } }), { code: 'MARKER_POOL_CONFIG_INVALID' });
  process.env.NODE_ENV = 'production';
  await c.rejects(() => useMarkerPoolForTests({ entry: TEST_ENTRY }), { code: 'MARKER_POOL_CONFIG_INVALID' }, 'production: the pool cannot be replaced, and takes no injected worker and no inline mode');
  process.env.NODE_ENV = 'test';
  c.deq([MARKER_LIMITS.deadlineMs, MARKER_LIMITS.examPaperBudgetMs, MARKER_LIMITS.poolSize, MARKER_LIMITS.maxQueue, MARKER_LIMITS.maxQueuePerKey, MARKER_LIMITS.maxQueueWaitMs, MARKER_LIMITS.heapMb],
    [1500, 8000, 2, 64, 8, 2000, 128], 'limits: the shipped numbers are the documented ones');
  c.deq([MARKER_COOLDOWN.limit, MARKER_COOLDOWN.windowMs], [5, 600_000], 'limits: and so is the cooldown');
}

// ═════════════════════════════════════════════════════════════════════════════
// B. Over HTTP
// ═════════════════════════════════════════════════════════════════════════════
// The process's pool is the test worker with the SHIPPED limits unless a
// section says otherwise.
await useMarkerPoolForTests({ entry: TEST_ENTRY });
const h = await startApp({ engine: requestedEngine() });
let serial = 0;
try {
  await markerPool().ready();
  const student = async label => {
    const account = await registerAccount(h, { email: `marker.${label}.${serial++}@example.test`, deviceId: `ipad-marker-${label}` });
    assert.equal(account.status, 201, `${label}: account`);
    assert.equal((await verifyEmail(h, account.account.id)).status, 200, `${label}: verified`);
    return account;
  };
  const clearLimits = () => h.db.run("DELETE FROM rate_limits WHERE bucket NOT LIKE 'marker-complex:%'");
  const issue = async (who, { generator = LINEAR, difficulty = 2, seed, mode } = {}) => {
    const r = await h.request('/v1/practice/issue', { method: 'POST', jar: who.jar, body: { generator, difficulty, seed, curriculum: 'in', ...(mode ? { mode } : {}) } });
    assert.equal(r.status, 201, `issue ${generator}/${seed}: ${r.status} ${r.text}`);
    return r.data.question;
  };
  let seedSerial = 100;
  /** A fresh linear equation whose root the suite can work out from the public prompt. */
  const linear = async who => {
    for (;;) {
      const q = await issue(who, { seed: seedSerial++ });
      try { return { q, root: solveLinearPrompt(q.prompt).root }; } catch { /* a worded form: draw again */ }
    }
  };
  const submit = (who, qid, name, answer, steps) => h.request(`/v1/practice/${qid}/submit`, {
    method: 'POST', jar: who.jar, headers: { 'Idempotency-Key': `marker-${name}` }, body: { submissionId: `marker-${name}`, answer, mode: 'typed', ...(steps === undefined ? {} : { steps }) }
  });
  const me = who => h.request('/v1/account/me', { jar: who.jar });
  const count = async (who, scope, key) => Number((await h.db.get('SELECT COUNT(*) AS n FROM idempotency_keys WHERE account_id=? AND scope=? AND key LIKE ?', [who.account.id, scope, key]))?.n || 0);
  const attempts = async (who, qid) => h.db.all("SELECT id, payload_json FROM learning_events WHERE account_id=? AND entity_id=? AND kind='graded-attempt'", [who.account.id, qid]);
  /** Nothing at all was recorded for this question: no receipt, no try, no completion, no progress. */
  // `t` is the counted checker, or `uncounted` where which branch runs depends
  // on the engine's speed (B1): the printed total must not.
  const uncounted = { ok: (v, m) => assert.ok(v, m), eq: (a, b, m) => assert.equal(a, b, m), deq: (a, b, m) => assert.deepEqual(a, b, m) };
  const untouched = async (who, qid, label, t = c) => {
    t.deq([await count(who, 'practice-grade', `${qid}:%`), await count(who, 'practice-tries', qid), await count(who, 'practice-completion', qid), (await attempts(who, qid)).length],
      [0, 0, 0, 0], `${label}: no receipt, no try, no completion and no attempt were recorded`);
  };
  const unreadable = (r, q, label, t = c) => {
    t.eq(r.status, 200, `${label}: answered 200, as an unreadable entry is`);
    t.deq([r.data.invalid, r.data.correct, r.data.resolved, r.data.marksEarned, r.data.stepReport, r.data.partial, r.data.trapWhy],
      [true, false, false, 0, null, null, null], `${label}: invalid, not correct, not resolved, no marks, no step report, no method evidence`);
    t.eq(r.data.feedback, TOO_COMPLEX_MESSAGE, `${label}: with the fixed plain sentence`);
    t.deq([r.data.code, r.data.tooComplex, r.data.authoritative, r.data.marksPossible, r.data.triesLeft], [MARKING_TOO_COMPLEX, true, true, q.criteriaCount, 1], `${label}: typed, attested, out of the question's own marks, the try not spent`);
    t.ok(!('solution' in r.data) && !('repairOpportunities' in r.data) && !('firstTryTrapWhy' in r.data), `${label}: no solution, nothing from the key`);
    // The shipped client only accepts a grade reply that has this shape
    // (client/src/local/backend.js gradeOnServer); the id names nothing recorded.
    t.ok(typeof r.data.attemptId === 'string' && r.data.questionId === q.id && Number.isFinite(r.data.serverAcknowledgedAt), `${label}: in the shape the shipped client accepts as an unreadable entry`);
  };

  const bystander = await student('bystander');
  c.eq((await me(bystander)).status, 200, 'the bystander is signed in');

  /**
   * Submit `answer` as `attacker` and, while it is being marked, time the
   * bystander's GET /v1/account/me and an ordinary correct submission.
   */
  async function underAttack(attacker, qid, key, answer, steps) {
    const own = await linear(bystander);
    let attackDoneAt = Infinity;
    const attack = timed(submit(attacker, qid, key, answer, steps)).then(r => { attackDoneAt = performance.now(); return r; });
    await sleep(120);
    const whoami = await timed(me(bystander));
    const marked = await timed(submit(bystander, own.q.id, `by-${serial++}-ok`, String(own.root)));
    const bystanderDoneAt = performance.now();
    const done = await attack;
    assert.equal(whoami.value.status, 200);
    assert.equal(marked.value.status, 200, marked.value.text);
    assert.equal(marked.value.data.correct, true, 'the bystander\'s own correct answer is marked correct during the attack');
    return { attack: done, meMs: whoami.ms, submitMs: marked.ms, finishedFirst: bystanderDoneAt < attackDoneAt };
  }

  // ── B1. The three measured inputs, with the shipped limits ────────────────
  // Whether each is still slow is the engine's business. Either it is marked
  // in time (and then it is an ordinary entry), or it is cut off (and then it
  // is an unreadable one). Both ways it returns inside deadline + margin and
  // nobody else waits.
  const MARGIN = 1200;
  {
    const attacker = await student('audit');
    const cases = [
      ['catastrophic backtracking in the normaliser (399 characters)', AUDIT_REGEX, EXPRESSION],
      ['a correct answer padded with a twenty-variable domain probe', padProbe('7x-6'), EXPRESSION],
      ['a trig/pole padded answer', padPole('7x-6'), EXPRESSION]
    ];
    report.audit = [];
    for (const [label, answer, source] of cases) {
      const q = await issue(attacker, source);
      c.ok(answer.length <= 400, `${label}: is inside the 400-character answer limit (${answer.length})`);
      const run = await underAttack(attacker, q.id, `audit-${serial++}`, answer);
      const cut = run.attack.value.data?.tooComplex === true;
      report.audit.push({ label, ms: Math.round(run.attack.ms), cut, bystanderMeMs: Math.round(run.meMs), bystanderSubmitMs: Math.round(run.submitMs) });
      c.eq(run.attack.value.status, 200, `${label}: is answered`);
      c.ok(run.attack.ms < MARKER_LIMITS.deadlineMs + MARGIN, `${label}: within the deadline plus margin (${Math.round(run.attack.ms)} ms)`);
      c.ok(run.meMs < 500 && run.submitMs < 500, `${label}: meanwhile another account's GET /me took ${Math.round(run.meMs)} ms and its own submission ${Math.round(run.submitMs)} ms`);
      if (cut) { unreadable(run.attack.value, q, label, uncounted); await untouched(attacker, q.id, label, uncounted); }
      else assert.ok(run.attack.value.data.authoritative === true && !('tooComplex' in run.attack.value.data), `${label}: was marked in time, as an ordinary entry`);
      c.ok(true, `${label}: ${cut ? 'was cut off — unreadable, no try spent, nothing recorded' : 'was marked in time, as an ordinary entry'}`);
    }
  }

  // ── B2. Preemption that does not depend on the engine being slow ─────────
  {
    const attacker = await student('spin');
    const { q, root } = await linear(attacker);
    const run = await underAttack(attacker, q.id, 'spin-forever', `${root} ${magic('spin')}`);
    report.spin = { ms: Math.round(run.attack.ms), bystanderMeMs: Math.round(run.meMs), bystanderSubmitMs: Math.round(run.submitMs) };
    unreadable(run.attack.value, q, 'an answer that never finishes');
    c.ok(run.attack.ms >= MARKER_LIMITS.deadlineMs - 50 && run.attack.ms < MARKER_LIMITS.deadlineMs + MARGIN, `an answer that never finishes: is stopped at the 1500 ms deadline (${Math.round(run.attack.ms)} ms)`);
    c.ok(run.meMs < 500 && run.submitMs < 500 && run.finishedFirst, `an answer that never finishes: another account's GET /me (${Math.round(run.meMs)} ms) and submission (${Math.round(run.submitMs)} ms) were answered while it was still being marked`);
    await untouched(attacker, q.id, 'an answer that never finishes');
    // Nothing was derived from the key, and nothing was spent: the question is
    // exactly as it was. The same key may be used again (nothing committed),
    // and both tries are still there.
    const wrong = await submit(attacker, q.id, 'spin-forever', String(root + 1));
    c.deq([wrong.status, wrong.data.invalid, wrong.data.resolved, wrong.data.triesLeft], [200, false, false, 1], 'afterwards: the same submission key marks a real first try');
    const right = await submit(attacker, q.id, 'spin-then-right', String(root));
    c.deq([right.status, right.data.correct, right.data.resolved, right.data.marksEarned], [200, true, true, q.criteriaCount], 'afterwards: and the second try, answered correctly, earns full marks');
    c.eq((await attempts(attacker, q.id)).length, 1, 'afterwards: one graded attempt in all');
  }

  // ── B3. Before and after: the same request with the pool bypassed ────────
  // `inline` is the behaviour before isolation: the marker on the request
  // thread. A bounded 1200 ms of marker work (below the deadline, so nothing
  // is cut off either way) blocks every other account for its whole length
  // when inline, and nobody when pooled. The other account is a SEPARATE
  // PROCESS here, polling GET /v1/account/me: with the marker inline this
  // process cannot run at all, so only an outside client measures the wait a
  // real second student would see.
  {
    const PROBE = `
      const [origin, cookie, ms] = process.argv.slice(1);
      const one = async () => { const s = performance.now(); const r = await fetch(origin + '/v1/account/me', { headers: { Cookie: cookie, Accept: 'application/json' } }); await r.text(); if (r.status !== 200) throw new Error('status ' + r.status); return performance.now() - s; };
      await one(); console.log('ready');
      const lat = []; const until = Date.now() + Number(ms);
      while (Date.now() < until) { lat.push(await one()); await new Promise(r => setTimeout(r, 25)); }
      console.log(JSON.stringify({ maxMs: Math.max(...lat), requests: lat.length }));`;
    /** Start the outside client; resolves `started` when it is polling and `result` with what it measured. */
    const outsideBystander = ms => {
      const child = spawn(process.execPath, ['--input-type=module', '-e', PROBE, h.origin, cookieHeader(bystander.jar), String(ms)], { stdio: ['ignore', 'pipe', 'inherit'] });
      let text = '', ready;
      const started = new Promise(resolve => { ready = resolve; });
      const result = new Promise((resolve, reject) => {
        child.stdout.on('data', chunk => { text += chunk; if (text.includes('ready')) ready(); });
        child.on('close', code => { try { resolve(JSON.parse(text.trim().split('\n').pop())); } catch { reject(new Error(`outside client failed (${code}): ${text}`)); } });
      });
      return { started, result };
    };
    const attacker = await student('before-after');
    const slow = async key => {
      await clearLimits();
      const { q, root } = await linear(attacker);
      const outside = outsideBystander(1700);
      await outside.started;
      const run = await timed(submit(attacker, q.id, key, `${root} ${magic('spin', 1200)}`));
      c.deq([run.value.status, run.value.data.correct, run.value.data.tooComplex], [200, true, undefined], `${key}: 1200 ms of marking is under the deadline and gets its true verdict`);
      return outside.result;
    };
    await useMarkerPoolForTests({ inline: TEST_MARKER_OPS });
    const bypassed = await slow('bypassed');
    await useMarkerPoolForTests({ entry: TEST_ENTRY });
    await markerPool().ready();
    const pooled = await slow('pooled-run');
    report.beforeAfter = { bypassedMaxMeMs: Math.round(bypassed.maxMs), pooledMaxMeMs: Math.round(pooled.maxMs), pooledRequests: pooled.requests, bypassedRequests: bypassed.requests };
    c.ok(bypassed.maxMs > 700, `BEFORE (pool bypassed): another account's GET /me waited ${Math.round(bypassed.maxMs)} ms behind the attacker's marking — the fault this module removes`);
    c.ok(pooled.maxMs < 400, `AFTER (pool): the slowest of ${pooled.requests} GET /me during the same marking took ${Math.round(pooled.maxMs)} ms`);
    c.ok(bypassed.maxMs > 3 * pooled.maxMs, 'the assertion that passes with the pool fails without it');
  }

  // ── B4. Added latency of a normal submission ─────────────────────────────
  {
    const who = await student('latency');
    const sample = async n => {
      const out = [];
      for (let i = 0; i < n; i++) {
        if (i % 40 === 0) await clearLimits();
        const { q, root } = await linear(who);
        const r = await timed(submit(who, q.id, `lat-${serial++}`, String(root), [`x = ${root}`]));
        assert.equal(r.value.data.correct, true);
        out.push(r.ms);
      }
      return out;
    };
    await sample(10);                                           // warm both paths
    const pooled = await sample(60);
    await useMarkerPoolForTests({ inline: true });               // the real operations, on the request thread
    await sample(10);
    const inline = await sample(60);
    await useMarkerPoolForTests({ entry: TEST_ENTRY });
    await markerPool().ready();
    report.latency = { engine: h.engine, pooledMedianMs: +median(pooled).toFixed(2), inlineMedianMs: +median(inline).toFixed(2), addedMedianMs: +(median(pooled) - median(inline)).toFixed(2) };
    c.ok(median(pooled) - median(inline) < 10, `a normal submission costs ${report.latency.addedMedianMs} ms more through the pool (median ${report.latency.pooledMedianMs} vs ${report.latency.inlineMedianMs} ms with the same re-checks and the marker inline)`);
    await clearLimits();
  }

  // ── B5. Working that cannot be read in time ──────────────────────────────
  // A short deadline keeps the suite quick; the rules do not depend on it.
  await useMarkerPoolForTests({ entry: TEST_ENTRY, deadlineMs: 250 });
  await markerPool().ready();
  {
    const who = await student('working');
    // (a) A wrong answer on the try that resolves, with working that never
    // finishes: the answer's verdict stands, the working is not read.
    const one = await linear(who);
    const first = await submit(who, one.q.id, 'w-first', String(one.root + 1), [`x = ${one.root} ${magic('spin')}`]);
    c.deq([first.status, first.data.resolved, first.data.triesLeft, first.data.stepReport, 'workingNotRead' in first.data], [200, false, 1, null, false],
      'working: on an open try the working is not checked at all, so nothing about it can run out of time');
    const second = await timed(submit(who, one.q.id, 'w-second', String(one.root + 2), [`x = ${one.root} ${magic('spin')}`]));
    c.ok(second.ms < 250 + MARGIN, `working: the resolving try returns at the deadline (${Math.round(second.ms)} ms)`);
    c.deq([second.value.status, second.value.data.correct, second.value.data.invalid, second.value.data.resolved, second.value.data.marksEarned, second.value.data.stepReport, second.value.data.partial, second.value.data.workingNotRead],
      [200, false, false, true, 0, null, null, true], 'working: the wrong answer stands as wrong and resolved; the unread working earns no method marks and is flagged not read');
    c.ok(String(second.value.data.feedback).endsWith(WORKING_NOT_READ_NOTE), 'working: and the reply says it was not read');
    c.eq((await attempts(who, one.q.id)).length, 1, 'working: exactly one graded attempt');
    c.deq((await submit(who, one.q.id, 'w-second', String(one.root + 2), [`x = ${one.root} ${magic('spin')}`])).data, second.value.data, 'working: and the replay is the identical receipt, without marking again');

    // (b) A right answer with working that never finishes keeps its full marks.
    const two = await linear(who);
    const right = await submit(who, two.q.id, 'w-right', String(two.root), [`x = ${two.root} ${magic('spin')}`]);
    c.deq([right.status, right.data.correct, right.data.resolved, right.data.marksEarned, right.data.workingNotRead], [200, true, true, two.q.criteriaCount, true],
      'working: a right answer keeps its verdict and its full marks; its working is flagged not read');

    // (c) No answer at all, and working that never finishes: there is no
    // verdict to stand on. Unreadable — never a working-only attempt worth 0.
    const three = await linear(who);
    await submit(who, three.q.id, 'w-open', String(three.root + 1));           // spend the first try, so the working would be checked
    const blank = await submit(who, three.q.id, 'w-blank', '', [`x = ${three.root} ${magic('spin')}`]);
    unreadable(blank, three.q, 'working-only entry that cannot be read');
    c.deq([await count(who, 'practice-completion', three.q.id), await count(who, 'practice-grade', `${three.q.id}:marker-w-blank`), (await attempts(who, three.q.id)).length], [0, 0, 0],
      'working-only entry that cannot be read: the question stays open and nothing is recorded for it');

    // (d) The working is honoured normally when it is read in time.
    const four = await linear(who);
    await submit(who, four.q.id, 'w4-open', String(four.root + 1));
    const read = await submit(who, four.q.id, 'w4-read', String(four.root + 1), [`x = ${four.root}`]);
    c.ok(read.data.resolved === true && !('workingNotRead' in read.data) && Array.isArray(read.data.stepReport?.lines), 'working: ordinary working is read and reported as before');
  }

  // ── B6. Concurrency: the restructured transaction ────────────────────────
  {
    const who = await student('race');
    // N different submissions of one question at once. Two tries exist.
    const a = await linear(who);
    const N = 6;
    const wrongs = await Promise.all(Array.from({ length: N }, (_, i) => submit(who, a.q.id, `race-wrong-${i}`, String(a.root + 1 + i), [`x = ${a.root + 1 + i}`])));
    const ok = wrongs.filter(r => r.status === 200);
    c.deq(wrongs.map(r => r.status).sort(), [200, 200, 409, 409, 409, 409], `race: of ${N} simultaneous wrong submissions exactly two are accepted — the two tries — and the rest are refused`);
    c.ok(wrongs.filter(r => r.status === 409).every(r => r.data.error.code === 'QUESTION_ALREADY_GRADED'), 'race: the rest because the question had been resolved');
    c.deq(ok.map(r => r.data.resolved).sort(), [false, true], 'race: one of the two is the first try (open), the other resolves it — never two first tries');
    const open = ok.find(r => !r.data.resolved), closing = ok.find(r => r.data.resolved);
    c.deq([open.data.stepReport, open.data.partial, 'solution' in open.data], [null, null, false], 'race: the open try was told nothing');
    c.ok(Array.isArray(closing.data.stepReport?.lines) && 'solution' in closing.data, 'race: the resolving try carries the step report on its working — computed, not skipped, though it was not forecast');
    c.deq([await count(who, 'practice-grade', `${a.q.id}:%`), await count(who, 'practice-completion', a.q.id), (await attempts(who, a.q.id)).length], [2, 1, 1],
      'race: two receipts, one completion, exactly one graded attempt');

    // N correct submissions at once: one credit.
    const b = await linear(who);
    const rights = await Promise.all(Array.from({ length: N }, (_, i) => submit(who, b.q.id, `race-right-${i}`, String(b.root))));
    c.deq(rights.map(r => r.status).sort(), [200, 409, 409, 409, 409, 409], 'race: of six simultaneous correct submissions exactly one is credited');
    c.deq([(await attempts(who, b.q.id)).length, await count(who, 'practice-completion', b.q.id)], [1, 1], 'race: one graded attempt, one completion — no double credit');

    // The same submission again WHILE the first is still being marked.
    const d = await linear(who);
    const slowAnswer = `${d.root + 3} ${magic('spin', 150)}`;
    const twins = await Promise.all([submit(who, d.q.id, 'replay-inflight', slowAnswer), sleep(40).then(() => submit(who, d.q.id, 'replay-inflight', slowAnswer)), sleep(60).then(() => submit(who, d.q.id, 'replay-inflight', slowAnswer))]);
    c.deq(twins.map(r => r.status), [200, 200, 200], 'replay: a retry sent while the first copy is still being marked is answered');
    c.deq([twins[1].data, twins[2].data], [twins[0].data, twins[0].data], 'replay: with the identical receipt');
    c.deq([await count(who, 'practice-grade', `${d.q.id}:%`), await count(who, 'practice-tries', d.q.id)], [1, 1], 'replay: one receipt and one try, not three');
    const reused = await submit(who, d.q.id, 'replay-inflight', String(d.root));
    c.deq([reused.status, reused.data.error.code], [409, 'IDEMPOTENCY_KEY_REUSED'], 'replay: the same key with a different answer is still refused');

    // Signing out while the answer is being marked: nothing is committed.
    const leaver = await student('leaver');
    const e = await linear(leaver);
    const jar = { ...leaver.jar };
    const pending = submit({ jar }, e.q.id, 'left', `${e.root} ${magic('spin', 200)}`);
    await sleep(60);
    c.eq((await h.request('/v1/account/logout', { method: 'POST', jar: leaver.jar, body: {} })).status, 200, 'authority: the student signs out while the answer is being marked');
    const refused = await pending;
    c.deq([refused.status, refused.data.error.code], [401, 'AUTH_REQUIRED'], 'authority: the mark is not committed for a session that ended meanwhile');
    await untouched(leaver, e.q.id, 'authority');

    // Marking is never awaited inside a store transaction.
    await c.rejects(() => h.db.transaction(async () => markerPool().run('practice', practiceArgs('x^2+2x+1'))), { code: 'STORE_EXTERNAL_IO_IN_TRANSACTION' },
      'transactions: the pool refuses to be awaited inside an open store transaction');
  }

  // ── B7. The tutor's Step Check ───────────────────────────────────────────
  {
    const who = await student('tutor');
    const t = await linear(who);
    const lines = [`x = ${t.root}`];
    const before = await issuedQuestionForTutor(h.db, who.account.id, t.q.id);
    c.eq(before.resolved, false, 'tutor: an unresolved question');
    await submit(who, t.q.id, 't-right', String(t.root));
    const issued = await issuedQuestionForTutor(h.db, who.account.id, t.q.id);
    const sealed = JSON.parse((await h.db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-question' AND key=?", [who.account.id, t.q.id])).response_json);
    c.deq(await issued.workEvidence(lines), tutorEvidence(sealed, lines), 'tutor: the Step Check through the pool is exactly the in-process one');
    const stuck = await timed(issued.workEvidence([`x = ${t.root} ${magic('spin')}`]));
    c.deq(stuck.value, { firstBreak: -1, verifiedLines: 0, misconception: null }, 'tutor: a Step Check that is cut off is silence — no line verified, no first mistake');
    c.ok(stuck.ms < 250 + MARGIN, 'tutor: at the deadline');
  }

  // ── B8. Cooldown ─────────────────────────────────────────────────────────
  {
    const who = await student('cooldown');
    const kept = await linear(who);
    const receipt = await submit(who, kept.q.id, 'kept', String(kept.root + 1));
    c.eq(receipt.status, 200, 'cooldown: a first try is committed beforehand');
    const target = await linear(who);
    const kills = [];
    for (let i = 0; i < MARKER_COOLDOWN.limit; i++) kills.push(await submit(who, target.q.id, `cool-${i}`, magic('spin')));
    c.ok(kills.every(r => r.status === 200 && r.data.tooComplex === true), `cooldown: ${MARKER_COOLDOWN.limit} entries in a row are each cut off and answered as unreadable`);
    const cooled = await timed(submit(who, target.q.id, 'cool-more', magic('spin')));
    c.deq([cooled.value.status, cooled.value.data.error.code, cooled.value.data.error.retryable], [429, MARKING_COOLDOWN, true], 'cooldown: the next entry is refused 429 with a plain typed message');
    c.ok(Number(cooled.value.headers.get('retry-after')) > 0 && Number(cooled.value.headers.get('retry-after')) <= 600, 'cooldown: saying when to come back');
    c.ok(cooled.ms < 150, `cooldown: without reaching a worker (${Math.round(cooled.ms)} ms)`);
    c.eq((await submit(who, target.q.id, 'cool-honest', String(target.root))).status, 429, 'cooldown: for any entry of that account, while it lasts');
    c.deq((await submit(who, kept.q.id, 'kept', String(kept.root + 1))).data, receipt.data, 'cooldown: a committed receipt is still replayed — recovering a reply costs no marking');
    await untouched(who, target.q.id, 'cooldown');
    const other = await linear(bystander);
    c.deq([(await submit(bystander, other.q.id, 'cool-bystander', String(other.root))).data?.correct], [true], 'cooldown: other accounts are not affected');
    await h.db.run("UPDATE rate_limits SET window_start = window_start - ? WHERE bucket LIKE 'marker-complex:%'", [MARKER_COOLDOWN.windowMs + 1000]);
    const back = await submit(who, target.q.id, 'cool-after', String(target.root));
    c.deq([back.status, back.data.correct, back.data.marksEarned], [200, true, target.q.criteriaCount], 'cooldown: when the window has passed the account is marked again, both tries intact');
  }

  // ── B9. Examination papers ───────────────────────────────────────────────
  {
    const Y7 = subtopicsForYear(7).map(sub => sub.id);
    const other = Y7.find(id => id !== 'y7-equations');
    const structured = multipartForYear(7, 'advanced');
    const ladder = (i, n) => { const t = i / n; return t < 0.2 ? 1 : t < 0.6 ? 2 : t < 0.9 ? 3 : 4; };
    const spec = () => ({ kind: 'practice-paper', paper: { year: 7, minutes: 30 },
      slots: [...Array.from({ length: 10 }, (_, i) => ({ generator: i % 2 ? 'y7-equations' : other, difficulty: ladder(i, 10) })), { multipart: structured[0] }] });
    const create = async who => {
      const r = await h.request('/v1/exams', { method: 'POST', jar: who.jar, body: spec(), headers: { 'Idempotency-Key': `marker-exam-${serial++}-${Date.now().toString(36)}` } });
      assert.equal(r.status, 201, `exam create: ${r.status} ${r.text}`);
      return JSON.parse((await h.db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='exam-paper' AND key=?", [who.account.id, r.data.exam.id])).response_json);
    };
    const finish = (who, id, body) => h.request(`/v1/exams/${id}/finish`, { method: 'POST', jar: who.jar, body });
    const right = q => {
      const a = q.answer || {};
      const candidates = q.answerType === 'mcq' ? [String(a.correctIndex)] : q.answerType === 'numeric' ? [a.canonicalInput, a.simplestFraction && `${a.simplestFraction.n}/${a.simplestFraction.d}`, a.value] : q.answerType === 'expression' ? [a.expr] : [];
      return candidates.filter(v => v !== undefined && v !== null && v !== false).map(String).find(text => { try { return checkAnswer(q, text).correct === true; } catch { return false; } }) ?? null;
    };
    const singles = paper => paper.questions.filter(sq => !sq.payload.multipart);
    const examEvents = async who => h.db.all("SELECT entity_id, payload_json FROM learning_events WHERE account_id=? AND kind='graded-attempt'", [who.account.id]);

    // (a) One answer and one page of working are cut off; the rest is marked.
    const who = await student('exam');
    const paper = await create(who);
    const answerable = singles(paper).filter(sq => right(sq.payload) !== null);
    const stepped = answerable.find(sq => Number(sq.marking.correct) >= 2 && stepMetaFor(sq.payload) && sq.payload.answerType === 'numeric');
    const cutAnswer = answerable.find(sq => sq !== stepped);
    const honest = answerable.filter(sq => sq !== stepped && sq !== cutAnswer);
    assert.ok(stepped && cutAnswer && honest.length >= 2, 'the paper holds a multi-mark stepped question and others to answer');
    const answers = Object.fromEntries(honest.map(sq => [sq.id, right(sq.payload)]));
    answers[cutAnswer.id] = `${right(cutAnswer.payload)} ${magic('spin')}`;
    answers[stepped.id] = String(Number(stepped.payload.answer.value) + 7);
    const workings = { [stepped.id]: `x = 1 ${magic('spin')}` };
    const body = { answers, workings, submissionKey: 'marker-exam-finish' };
    const [f1, f2] = await Promise.all([timed(finish(who, paper.id, body)), timed(finish(who, paper.id, body))]);
    c.deq([f1.value.status, f2.value.status], [200, 200], 'exam: two simultaneous finishes of one paper are both answered');
    c.deq(f2.value.data, f1.value.data, 'exam: with the identical result — the paper was marked into the record once');
    c.eq(Number((await h.db.get("SELECT COUNT(*) AS n FROM idempotency_keys WHERE account_id=? AND scope='exam-result'", [who.account.id])).n), 1, 'exam: one stored result');
    const result = f1.value.data;
    const line = id => result.detail.find(d => d.id === id);
    const cut = line(cutAnswer.id);
    c.deq([cut.unreadable, cut.correct, cut.awarded, cut.outcome, cut.feedback, cut.attemptId, cut.partial],
      [true, false, 0, 'unreadable', TOO_COMPLEX_MESSAGE, null, null], 'exam: the part whose answer could not be marked in time is unreadable — no mark, not wrong, no attempt');
    const unread = line(stepped.id);
    c.deq([unread.workingNotRead, unread.correct, unread.awarded, unread.partial, unread.markingScheme, unread.outcome],
      [true, false, 0, null, 'final-answer', 'wrong'], 'exam: the part whose working could not be read keeps its answer verdict (wrong) and earns no method marks');
    c.ok(String(unread.feedback).endsWith(WORKING_NOT_READ_NOTE) && typeof unread.attemptId === 'string', 'exam: flagged as not read; the wrong answer itself is an attempt');
    c.ok(honest.every(sq => line(sq.id).correct === true && line(sq.id).awarded === Number(sq.marking.correct) && !('unreadable' in line(sq.id)) && !('workingNotRead' in line(sq.id))),
      `exam: the other ${honest.length} answered parts are marked normally, full marks each — one part does not block the paper`);
    c.eq(result.score, result.detail.reduce((n, d) => n + d.awarded, 0), 'exam: the score is the sum of what was actually marked');
    const recorded = await examEvents(who);
    const attemptIds = result.detail.flatMap(d => [d.attemptId, ...(d.parts || []).map(p => p.attemptId)]).filter(Boolean);
    c.deq(recorded.map(e => JSON.parse(e.payload_json).attemptId).sort(), [...attemptIds].sort(), 'exam: exactly the result\'s attempts are recorded, once each, though two finishes marked it');
    c.ok(!recorded.some(e => e.entity_id === cutAnswer.id), 'exam: and none for the unreadable part');
    c.deq((await finish(who, paper.id, {})).data, result, 'exam: a later finish replays the stored result');

    // (b) The whole paper has a budget: it is not parts × deadline.
    await useMarkerPoolForTests({ entry: TEST_ENTRY, deadlineMs: 200, examPaperBudgetMs: 500 });
    await markerPool().ready();
    const spender = await student('exam-budget');
    const paper2 = await create(spender);
    const all = singles(paper2);
    const stuck = Object.fromEntries(all.map(sq => [sq.id, `1 ${magic('spin')}`]));
    const killsBefore = markerPool().stats().deadlineKills;
    const spent = await timed(finish(spender, paper2.id, { answers: stuck }));
    c.eq(spent.value.status, 200, 'exam budget: a paper whose every answer never finishes is still finalised');
    c.ok(spent.ms < 500 + MARGIN, `exam budget: inside the paper's budget, not ${all.length} × the deadline (${Math.round(spent.ms)} ms for a 500 ms budget, ${all.length} stuck parts)`);
    c.eq(markerPool().stats().deadlineKills - killsBefore, 3, 'exam budget: three parts used the budget (200 + 200 + 100 ms); the rest were not run at all');
    c.ok(all.every(sq => { const d = spent.value.data.detail.find(x => x.id === sq.id); return d.unreadable === true && d.awarded === 0 && d.attemptId === null; }), 'exam budget: every such part is unreadable, with no mark and no attempt');
    c.deq([spent.value.data.score, (await examEvents(spender)).length], [0, 0], 'exam budget: nothing was scored and no attempt recorded');
  }

  // ── B10. What was logged ─────────────────────────────────────────────────
  {
    const marker = logged.filter(entry => /"code":"MARKER_/.test(entry.text));
    c.ok(marker.some(e => e.line.code === 'MARKER_DEADLINE_KILL') && marker.some(e => e.line.code === 'MARKER_WORKER_RESTART') &&
      marker.some(e => e.line.code === 'MARKER_QUEUE_REFUSED') && marker.some(e => e.line.code === 'MARKER_WORKER_CRASH'), 'observability: deadline kills, restarts, queue refusals and crashes are each logged as a structured event');
    const allowed = new Set(['ts', 'level', 'event', 'code', 'ms', 'count']);
    c.ok(marker.every(e => Object.keys(e.line).every(k => allowed.has(k))), 'observability: carrying a code, a duration or a count — nothing else');
    c.ok(!logged.some(e => /marker-test|sin\(|C\(|x = /.test(e.text)), 'observability: no line carries any of the student\'s text');
    for (const kind of ['deadline_kill', 'worker_crash', 'queue_refused', 'worker_restart']) {
      c.ok(metrics.sum('marker_events_total', { where: { kind } }) > 0, `observability: marker_events_total{kind=${kind}} is counted`);
    }
    c.ok(metrics.snapshot().latency['marker_op_ms{op=practice}']?.count > 0 && metrics.snapshot().latency.marker_queue_wait_ms?.count > 0, 'observability: operation and queue-wait durations are measured');
  }
} finally {
  await h.close();
  // Clean shutdown: every worker stops and nothing is left holding the process
  // (this suite does not call process.exit — it ends because nothing remains).
  await closeMarkerPool();
  setLogSink(previousSink);
  rmSync(scratch, { recursive: true, force: true });
  for (const key of keys) { if (before[key] === undefined) delete process.env[key]; else process.env[key] = before[key]; }
}
c.eq(process._getActiveHandles().filter(handle => handle?.constructor?.name === 'MessagePort').length, 0, 'shutdown: no worker port is left open');

console.log(`engine: ${h.engine}`);
console.log(`measured: ${JSON.stringify(report)}`);
console.log(`MARKER ISOLATION: PASS — ${c.count()}/${c.count()} checks — the marker runs off the request thread under a hard deadline; an entry cut off is unreadable, never a mark; other accounts are answered while it is marked; tries, replays and papers stay exactly-once under concurrency.`);
