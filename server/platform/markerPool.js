// Pri Learning — preemptive isolation of the deterministic marker.
//
// THE PROBLEM. The marker is deterministic code over student-written text. It
// used to run inside the request, on the one thread that serves every account.
// An answer or a page of working within the accepted size limits could hold
// that thread for seconds (a regular expression that backtracks, a domain
// probe over twenty variables), and for that long nobody else's request was
// answered. Fixing each slow input as it is found is necessary and is not a
// guarantee.
//
// THE GUARANTEE. Marking runs in worker threads. Every operation has a hard
// deadline. When it passes, the worker is TERMINATED — real preemption, which
// a cooperative timer inside the engine cannot give, because nothing
// interrupts a regular expression — a replacement is started, and the
// operation resolves as the typed outcome MARKING_TOO_COMPLEX. The request
// thread never executes marker code, so no input can stop it answering others.
//
// WHAT A CUT-OFF MAY MEAN. Only "this could not be checked this time". Every
// limit here is a wall clock, and how long marking takes depends on what else
// the machine is doing — so a cut-off says nothing about what the student
// wrote. A terminated operation never yields a verdict, a mark or anything
// derived from the answer key, and it never LOWERS one either: a practice
// submission that was stopped at any stage is not an attempt at all (nothing
// spent, nothing written, the same key marks it again — practice.js), and a
// paper with a stopped part is not finalised by that marking (exams.js). The
// stages a stopped operation had already reported (markerOps.js `emit`) are
// complete results of the same deterministic code; they are used only where
// exams.js documents its ceiling, each flagged on the result. So the same
// input gets the same marks whenever it gets marks at all.
//
// FAIRNESS. One account has at most one operation running at a time (the rest
// of its operations wait behind it), so with two or more workers a single
// account can never hold the whole pool. The queue is bounded in length, per
// account and in waiting time; past a bound the operation is refused as
// MARKING_BUSY (retryable) instead of piling up. Deadline kills are counted
// per account and a few of them start a short cooldown (below).
//
// The numbers, and why:
//   • DEADLINE_MS 1500 — one answer plus its working. Ordinary marking takes
//     single-digit milliseconds; the engine's own cooperative backstop for a
//     page of working is 750 ms (checker.js WORKING_LIMITS.backstopMs), so
//     honest work the engine itself accepts finishes with room to spare, and
//     1.5 s is the longest any one operation can hold one worker.
//   • EXAM_PAPER_BUDGET_MS 8000 — a whole paper's marking time, summed across
//     its parts (each part is still stopped at DEADLINE_MS). A paper is not
//     "parts × 1.5 s": once the budget is spent the remaining parts are not
//     marked at all. An honest paper of forty parts uses well under a second.
//   • size 2 (PRI_MARKER_POOL_SIZE, 1–8) — one account can occupy one worker,
//     so two is the smallest pool in which an attacker cannot stop marking.
//   • queue 64 in all, 8 per account, 2000 ms waiting — a waiting time longer
//     than DEADLINE_MS plus a respawn, so a bystander behind one stopped
//     operation is still served rather than refused.
//   • heap 128 MB per worker — the engine needs about 5 MB; a memory bomb
//     ends its own worker (handled exactly like a deadline), not the server.
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { asStore, assertNoOpenTransaction } from './store.js';
import { consumeRateLimit, sha256 } from './security.js';
import { logEvent } from './observability.js';
import { metrics } from './metrics.js';

export const MARKING_TOO_COMPLEX = 'MARKING_TOO_COMPLEX';
export const MARKING_BUSY = 'MARKING_BUSY';
export const MARKING_COOLDOWN = 'MARKING_COOLDOWN';

export const MARKER_LIMITS = Object.freeze({
  deadlineMs: 1500,
  examPaperBudgetMs: 8000,
  poolSize: 2,
  maxQueue: 64,
  maxQueuePerKey: 8,
  maxQueueWaitMs: 2000,
  heapMb: 128
});

/** What a student is told when an entry could not be checked in time. */
export const TOO_COMPLEX_MESSAGE = 'This could not be checked. Write the final answer simply, and keep each line of working short.';
/** Appended when the answer was marked and only the working ran out of time. */
export const WORKING_NOT_READ_NOTE = 'Your working was not read: keep each line of working short.';
export const BUSY_MESSAGE = 'Marking is busy. Try again in a moment.';
export const COOLDOWN_MESSAGE = 'Several entries could not be checked. Wait a few minutes, then write the answer simply.';

const DEFAULT_ENTRY = fileURLToPath(new URL('./markerWorker.js', import.meta.url));
const RESPAWN_BACKOFF_MS = [0, 100, 250, 500, 1000, 2000, 5000];

function poolSizeFrom(env) {
  const raw = env.PRI_MARKER_POOL_SIZE;
  if (raw === undefined || raw === '') return MARKER_LIMITS.poolSize;
  const n = Number(raw);
  return Number.isInteger(n) ? Math.max(1, Math.min(8, n)) : MARKER_LIMITS.poolSize;
}

// Counts and durations only: never an answer, a line of working, a question
// or an account. `platform_error` with a MARKER_* code is this server's
// existing structured event vocabulary (observability.js LOG_EVENTS).
function report(kind, op, fields = {}) {
  metrics.inc('marker_events_total', { kind, op: op || 'none' });
  logEvent(kind === 'worker_restart' ? 'info' : 'warn', 'platform_error', { code: `MARKER_${kind.toUpperCase()}`, ...fields });
}

/**
 * A pool of marker workers.
 *
 * run(op, args, { key, deadlineMs }) resolves to
 *   { ok: true,  value, partials, ms }                       the operation's result
 *   { ok: false, code: MARKING_TOO_COMPLEX, reason, partials, ms }   stopped at its deadline, or its worker died
 *   { ok: false, code: MARKING_BUSY, partials: [], ms: 0 }   refused before it started
 * and rejects only when the operation itself threw (the engine's own
 * exception, as the handler would have seen it inline).
 *
 * `inline` runs operations synchronously on the calling thread with no
 * deadline — the behaviour before this module existed. It exists so a test can
 * demonstrate what the pool prevents, and is refused in production, as is a
 * worker `entry` other than the shipped one.
 */
export function createMarkerPool({
  size = MARKER_LIMITS.poolSize,
  entry = DEFAULT_ENTRY,
  deadlineMs = MARKER_LIMITS.deadlineMs,
  examPaperBudgetMs = MARKER_LIMITS.examPaperBudgetMs,
  maxQueue = MARKER_LIMITS.maxQueue,
  maxQueuePerKey = MARKER_LIMITS.maxQueuePerKey,
  maxQueueWaitMs = MARKER_LIMITS.maxQueueWaitMs,
  heapMb = MARKER_LIMITS.heapMb,
  inline = null,
  env = process.env
} = {}) {
  if (env.NODE_ENV === 'production' && (inline || entry !== DEFAULT_ENTRY)) {
    throw Object.assign(new Error('The marker pool runs only its shipped worker in production.'), { code: 'MARKER_POOL_CONFIG_INVALID' });
  }
  const slots = [];
  const queue = [];
  const activeKeys = new Set();
  const counts = { completed: 0, deadlineKills: 0, crashes: 0, queueRefusals: 0, restarts: 0, spawned: 0 };
  let nextId = 1;
  let closed = false;

  const queuedFor = key => queue.reduce((n, job) => n + (job.key === key ? 1 : 0), 0);

  function spawn(slot) {
    if (closed) return;
    const worker = new Worker(entry, {
      resourceLimits: { maxOldGenerationSizeMb: heapMb, maxYoungGenerationSizeMb: 16 },
      // The worker needs nothing from the environment; give it none of it.
      env: { NODE_ENV: String(env.NODE_ENV || '') },
      stdout: false, stderr: false
    });
    counts.spawned++;
    slot.worker = worker;
    slot.ready = false;
    slot.job = null;
    worker.on('message', message => {
      if (slot.worker !== worker) return;
      if (message?.ready) { slot.ready = true; slot.failures = 0; pump(); return; }
      const job = slot.job;
      if (!job || message?.id !== job.id) return;
      if ('partial' in message) { job.partials.push(message.partial); return; }
      settle(slot, job);
      if ('error' in message) job.reject(Object.assign(new Error(String(message.error)), { code: 'MARKER_OP_FAILED' }));
      else {
        const ms = performance.now() - job.startedAt;
        counts.completed++;
        metrics.observe('marker_op_ms', { op: job.op }, ms);
        job.resolve({ ok: true, value: message.value, partials: job.partials, ms });
      }
      pump();
    });
    // An uncaught exception or the heap limit ends the worker; so does an
    // exit nobody asked for. Either is handled exactly like a deadline.
    worker.on('error', () => retire(slot, worker, 'crash'));
    worker.on('exit', () => retire(slot, worker, 'crash'));
    // An idle worker never keeps the process alive: a suite or a tool that
    // imported the server exits when its own work is done. A running
    // operation is held by its (referenced) deadline timer. (After the
    // listeners: attaching 'message' references the port again.)
    worker.unref();
  }

  /** Detach a finished or stopped job from its slot. */
  function settle(slot, job) {
    clearTimeout(job.deadlineTimer);
    slot.job = null;
    if (job.key !== null) activeKeys.delete(job.key);
  }

  /** Stop a slot's worker (deadline or crash), answer its job, start a replacement. */
  function retire(slot, worker, reason) {
    if (slot.worker !== worker) return;        // already replaced: a late exit/error event
    const job = slot.job;
    const wasReady = slot.ready;
    slot.worker = null;
    slot.ready = false;
    worker.removeAllListeners();
    // Never an unhandled 'error' after the listeners are gone.
    worker.on('error', () => {});
    worker.terminate().catch(() => {});
    if (job) {
      settle(slot, job);
      const ms = performance.now() - job.startedAt;
      if (reason === 'deadline') counts.deadlineKills++; else counts.crashes++;
      report(reason === 'deadline' ? 'deadline_kill' : 'worker_crash', job.op, { ms: Math.round(ms) });
      job.resolve({ ok: false, code: MARKING_TOO_COMPLEX, reason, partials: job.partials, ms });
    } else if (!closed && reason === 'crash') {
      counts.crashes++;
      report('worker_crash', null);
    }
    if (closed) return;
    // A worker that dies before it is ready (a broken entry file) is retried
    // with a growing delay, never in a tight loop.
    slot.failures = wasReady ? 0 : (slot.failures || 0) + 1;
    const delay = RESPAWN_BACKOFF_MS[Math.min(slot.failures, RESPAWN_BACKOFF_MS.length - 1)];
    counts.restarts++;
    report('worker_restart', null);
    if (delay === 0) spawn(slot);
    else { slot.respawnTimer = setTimeout(() => { slot.respawnTimer = null; spawn(slot); }, delay); slot.respawnTimer.unref(); }
    pump();
  }

  function pump() {
    if (closed) return;
    for (const slot of slots) {
      if (!slot.ready || slot.job) continue;
      const at = queue.findIndex(job => job.key === null || !activeKeys.has(job.key));
      if (at < 0) return;
      const [job] = queue.splice(at, 1);
      clearTimeout(job.queueTimer);
      if (job.key !== null) activeKeys.add(job.key);
      slot.job = job;
      job.startedAt = performance.now();
      metrics.observe('marker_queue_wait_ms', null, job.startedAt - job.enqueuedAt);
      const worker = slot.worker;
      job.deadlineTimer = setTimeout(() => retire(slot, worker, 'deadline'), job.deadlineMs);
      try { worker.postMessage({ id: job.id, op: job.op, args: job.args }); }
      catch (error) {
        // Arguments that cannot be cloned are a programming error in a call
        // site, not a slow input: the worker is fine and stays.
        settle(slot, job);
        job.reject(Object.assign(new Error('Marker arguments must be plain data.'), { code: 'MARKER_ARGS_INVALID', cause: error }));
      }
    }
  }

  function refuse(job, why) {
    counts.queueRefusals++;
    report('queue_refused', job.op, { count: queue.length });
    job.resolve({ ok: false, code: MARKING_BUSY, reason: why, partials: [], ms: 0 });
  }

  async function runInline(op, args) {
    const ops = typeof inline === 'object' ? inline : (await import('./markerOps.js')).MARKER_OPS;
    const partials = [];
    const started = performance.now();
    const value = ops[op](args, partial => partials.push(partial));
    return { ok: true, value, partials, ms: performance.now() - started };
  }

  function run(op, args, { key = null, deadlineMs: limit = deadlineMs } = {}) {
    // Marking is awaited work on another thread. Awaiting it inside a store
    // transaction would hold the transaction open across it (on SQLite, let
    // other requests' statements into it): every call site marks first and
    // opens its transaction afterwards.
    assertNoOpenTransaction('Marking');
    if (closed) return Promise.resolve({ ok: false, code: MARKING_BUSY, reason: 'closed', partials: [], ms: 0 });
    if (inline) return runInline(op, args);
    return new Promise((resolve, reject) => {
      const job = { id: nextId++, op, args, key: key === null ? null : String(key), deadlineMs: Math.max(1, Math.round(limit)),
        partials: [], resolve, reject, enqueuedAt: performance.now(), startedAt: 0, queueTimer: null, deadlineTimer: null };
      if (queue.length >= maxQueue) return refuse(job, 'queue-full');
      if (job.key !== null && queuedFor(job.key) >= maxQueuePerKey) return refuse(job, 'account-queue-full');
      job.queueTimer = setTimeout(() => {
        const at = queue.indexOf(job);
        if (at < 0) return;
        queue.splice(at, 1);
        refuse(job, 'queue-wait');
      }, maxQueueWaitMs);
      queue.push(job);
      pump();
    });
  }

  /** Stop every worker and refuse whatever was waiting. Idempotent. */
  async function close() {
    if (closed) return;
    closed = true;
    for (const job of queue.splice(0)) {
      clearTimeout(job.queueTimer);
      job.resolve({ ok: false, code: MARKING_BUSY, reason: 'closed', partials: [], ms: 0 });
    }
    await Promise.all(slots.map(async slot => {
      clearTimeout(slot.respawnTimer);
      const { worker, job } = slot;
      slot.worker = null;
      slot.ready = false;
      if (job) {
        settle(slot, job);
        job.resolve({ ok: false, code: MARKING_BUSY, reason: 'closed', partials: job.partials, ms: performance.now() - job.startedAt });
      }
      if (!worker) return;
      worker.removeAllListeners();
      worker.on('error', () => {});
      await worker.terminate().catch(() => {});
    }));
  }

  /** Resolves once every worker has imported the engine (tests, warm-up). */
  async function ready(timeoutMs = 10_000) {
    const until = performance.now() + timeoutMs;
    while (!inline && !closed && !slots.every(slot => slot.ready)) {
      if (performance.now() > until) throw Object.assign(new Error('The marker pool did not start.'), { code: 'MARKER_POOL_NOT_READY' });
      await new Promise(resolve => setTimeout(resolve, 5));
    }
  }

  const stats = () => ({ ...counts, size: slots.length, ready: slots.filter(slot => slot.ready).length,
    running: slots.filter(slot => slot.job).length, queued: queue.length, closed });

  if (!inline) for (let i = 0; i < Math.max(1, Math.min(8, size)); i++) { const slot = { failures: 0 }; slots.push(slot); spawn(slot); }
  return { run, close, ready, stats, deadlineMs, examPaperBudgetMs, inline: !!inline };
}

// ── The process's pool ──────────────────────────────────────────────────────
let shared = null;

/** The pool every request handler marks through; started on first use. */
export function markerPool() {
  if (!shared) shared = createMarkerPool({ size: poolSizeFrom(process.env) });
  return shared;
}

/** Stop the process's pool (server shutdown, the end of a suite). */
export async function closeMarkerPool() {
  const pool = shared;
  shared = null;
  if (pool) await pool.close();
}

/**
 * Replace the process's pool with one built from `options` (an injected worker
 * entry, a short deadline, `inline`). Tests only: refused in production, where
 * the pool is always the shipped worker with the limits above.
 */
export async function useMarkerPoolForTests(options) {
  if (process.env.NODE_ENV === 'production') {
    throw Object.assign(new Error('The marker pool cannot be replaced in production.'), { code: 'MARKER_POOL_CONFIG_INVALID' });
  }
  await closeMarkerPool();
  shared = createMarkerPool(options);
  return shared;
}

// ── Per-account cooldown ────────────────────────────────────────────────────
// A deadline kill costs a worker up to DEADLINE_MS and a respawn. An account
// that causes MARKER_COOLDOWN.limit of them inside the window is refused
// further marking (429) until the window ends. Honest work does not meet
// this: an entry is only stopped when the deterministic engine needs more
// than 1.5 s for it, hundreds of times longer than ordinary marking, and each
// time the student is told to write it simply — five in ten minutes means
// sending such an entry again and again. The refusal lasts at most the ten
// minutes from the first of them.
//
// Worst case for everyone else, in numbers: one account holds ONE worker (it
// never runs two operations at once) for at most 5 × 1.5 s = 7.5 s in any ten
// minutes — 1.25 % of one worker — before it is refused; its examination
// papers add at most 8 s each. Keeping both workers of the default pool busy
// continuously would need about 160 accounts doing this at once.
export const MARKER_COOLDOWN = Object.freeze({ limit: 5, windowMs: 10 * 60 * 1000 });
const cooldownBucket = accountId => `marker-complex:${sha256(String(accountId)).slice(0, 24)}`;

/** Null, or when this account's cooldown ends (ms). Reads only. */
export async function markerCooldownUntil(db, accountId, now = Date.now()) {
  const row = await asStore(db).get('SELECT window_start, count FROM rate_limits WHERE bucket = ?', [cooldownBucket(accountId)]);
  if (!row || now - Number(row.window_start) >= MARKER_COOLDOWN.windowMs || Number(row.count) < MARKER_COOLDOWN.limit) return null;
  return Number(row.window_start) + MARKER_COOLDOWN.windowMs;
}

/** Count `kills` MARKING_TOO_COMPLEX outcomes against an account. */
export async function recordMarkerKills(db, accountId, kills = 1, now = Date.now()) {
  for (let i = 0; i < kills; i++) {
    const verdict = await consumeRateLimit(db, cooldownBucket(accountId), MARKER_COOLDOWN, now);
    if (!verdict.allowed) break;
  }
}

/** Send the cooldown refusal. */
export function sendMarkerCooldown(res, until) {
  res.set('Retry-After', String(Math.max(1, Math.ceil((until - Date.now()) / 1000))));
  return res.status(429).json({ error: { code: MARKING_COOLDOWN, message: COOLDOWN_MESSAGE, retryable: true } });
}

/** Send the busy refusal: nothing was marked, nothing was spent, retry with the same key. */
export function sendMarkerBusy(res) {
  res.set('Retry-After', '2');
  return res.status(503).json({ error: { code: MARKING_BUSY, message: BUSY_MESSAGE, retryable: true } });
}
