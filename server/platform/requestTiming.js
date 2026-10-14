// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · where one /v1 request spends its time
//
// A request's wall time is the sum of things nobody could see from the access
// log: how many times it went to the database and how long each trip took, how
// long it waited for a pooled connection, how long the paid reader took, how
// long the marker queue and the marker took, and how long the commit took. On a
// deployment whose database is a continent away from the app, the first of
// those is nearly all of it — and it is invisible in a line that says only
// `ms: 5400`.
//
// This module is the meter. It records NUMBERS ONLY:
//
//   · per phase, milliseconds (auth, eligibility, limit, provider, marker,
//     commit, serialize);
//   · for the database, counts (statements, wire round trips, transactions)
//     and milliseconds (in statements, waiting for a connection or a lock).
//
// No SQL text, no parameter, no identifier, no route parameter and no content
// can reach it: the only inputs are a phase NAME from the closed list below and
// a duration. The numbers go to the structured `http_request` log line
// (observability.js allowlists each field as a bounded number) and — only when
// PRI_SERVER_TIMING=1, and only for a request that carried a valid session — to
// a `Server-Timing` response header. The header is off by default and never
// sent to an anonymous caller: a statement count is a precise side channel
// (whether an email has an account is the difference between two counts), and
// the routes that must answer identically for a known and an unknown address
// are all anonymous.
//
// The context is an AsyncLocalStorage store entered by requestTiming() AFTER
// the body has been parsed (a body parser resumes on a stream event and would
// drop a context entered before it).
// ─────────────────────────────────────────────────────────────────────────────
import { AsyncLocalStorage } from 'node:async_hooks';

const context = new AsyncLocalStorage();

/** The only phase names a request may record. */
export const TIMING_PHASES = Object.freeze(['auth', 'eligibility', 'limit', 'provider', 'marker', 'commit', 'serialize']);
const PHASE = new Set(TIMING_PHASES);

export function newTiming() {
  return {
    phases: Object.fromEntries(TIMING_PHASES.map(name => [name, 0])),
    db: { statements: 0, roundTrips: 0, transactions: 0, ms: 0, acquireMs: 0 }
  };
}

/** The meter of the request this code is running for, or null outside one. */
export function currentTiming() {
  return context.getStore() || null;
}

export function runWithTiming(timing, fn) {
  return context.run(timing, fn);
}

const nowMs = () => Number(process.hrtime.bigint()) / 1e6;

/** Add `ms` to a named phase of the current request. Unknown names are ignored. */
export function addPhase(name, ms) {
  const timing = context.getStore();
  if (!timing || !PHASE.has(name) || !(ms >= 0)) return;
  timing.phases[name] += ms;
}

/** Run `fn`, charging its wall time to `name`. Phases that overlap both count. */
export async function timePhase(name, fn) {
  const started = nowMs();
  try { return await fn(); } finally { addPhase(name, nowMs() - started); }
}

/** Middleware form: the time until this middleware calls next() or answers. */
export function timedMiddleware(name, middleware) {
  const wrapped = (req, res, next) => {
    const started = nowMs();
    let done = false;
    const stop = () => { if (!done) { done = true; addPhase(name, nowMs() - started); } };
    res.once('finish', stop);
    return middleware(req, res, (...args) => { stop(); res.off('finish', stop); next(...args); });
  };
  return wrapped;
}

// ── The database side, called only by store.js ──────────────────────────────

/** One wire round trip (Postgres) or one driver call (SQLite) that took `ms`. */
export function noteRoundTrip(ms, { statement = false } = {}) {
  const timing = context.getStore();
  if (!timing) return;
  timing.db.roundTrips += 1;
  if (statement) timing.db.statements += 1;
  if (ms >= 0) timing.db.ms += ms;
}

/** Time spent waiting for a pooled connection or for a named lock's queue. */
export function noteAcquire(ms) {
  const timing = context.getStore();
  if (timing && ms >= 0) timing.db.acquireMs += ms;
}

/** One outermost transaction attempt begun. */
export function noteTransaction() {
  const timing = context.getStore();
  if (timing) timing.db.transactions += 1;
}

export { nowMs as timingNow };

const round = value => Math.round(value * 10) / 10;

/** The numbers of one request, as the flat fields the access log accepts. */
export function timingLogFields(timing) {
  if (!timing) return {};
  const out = {
    dbStatements: timing.db.statements,
    dbRoundTrips: timing.db.roundTrips,
    dbTransactions: timing.db.transactions,
    dbMs: round(timing.db.ms),
    dbAcquireMs: round(timing.db.acquireMs)
  };
  for (const name of TIMING_PHASES) if (timing.phases[name] > 0) out[`${name}Ms`] = round(timing.phases[name]);
  return out;
}

/** A `Server-Timing` value: metric names from the closed list and numbers only. */
export function serverTimingHeader(timing, totalMs = null) {
  if (!timing) return '';
  const parts = [];
  if (totalMs !== null && totalMs >= 0) parts.push(`total;dur=${round(totalMs)}`);
  parts.push(`db;dur=${round(timing.db.ms)};desc="${timing.db.statements} statements, ${timing.db.roundTrips} round trips, ${timing.db.transactions} transactions"`);
  parts.push(`dbacquire;dur=${round(timing.db.acquireMs)}`);
  for (const name of TIMING_PHASES) if (timing.phases[name] > 0) parts.push(`${name};dur=${round(timing.phases[name])}`);
  return parts.join(', ');
}

/** Whether this deployment sends the header at all (off unless asked for). */
export function serverTimingEnabled(env = process.env) {
  return String(env.PRI_SERVER_TIMING || '').trim() === '1';
}

/**
 * Enter the request's timing context. Mount after the body parsers. The meter
 * is also kept on `req.priTiming` so the access logger, which is mounted
 * earlier and reports on `finish`, can read it.
 */
export function requestTiming({ env = process.env } = {}) {
  const header = serverTimingEnabled(env);
  return (req, res, next) => {
    const timing = newTiming();
    const started = nowMs();
    req.priTiming = timing;
    const json = res.json.bind(res);
    res.json = body => {
      const serializeStarted = nowMs();
      // Only a caller this server has authenticated is shown the breakdown.
      if (header && req.platformSession && !res.headersSent) {
        res.set('Server-Timing', serverTimingHeader(timing, nowMs() - started));
      }
      try { return json(body); } finally { timing.phases.serialize += nowMs() - serializeStarted; }
    };
    context.run(timing, next);
  };
}
