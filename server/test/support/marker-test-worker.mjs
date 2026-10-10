// TEST-ONLY marker worker entry (marker-isolation-check.mjs).
//
// The real marking operations, plus a way to make one slow, heavy or fatal on
// demand, so preemption, respawn, queue bounds, the cooldown and shutdown can
// be proved without depending on any particular slow input of the engine
// (those get fixed; the guarantee must hold regardless).
//
// This file is not reachable in production: server/test is not in the runtime
// image (Dockerfile; production-runtime-image-check.mjs), and createMarkerPool
// refuses any worker entry but its own when NODE_ENV=production.
//
// A marker inside the student's text switches a behaviour on:
//   @@marker-test:spin@@        in the ANSWER  → never returns (answer stage)
//   @@marker-test:spin:800@@    in the ANSWER  → 800 ms of work, then the real marking
//   @@marker-test:spin@@        in the WORKING → the answer is marked, then it never returns
//   @@marker-test:spin:800@@    in the WORKING → the answer is marked, 800 ms of work, then the real working stage
//   @@marker-test:oom@@         in the ANSWER  → allocates until the worker's heap limit
//   @@marker-test:exit@@        in the ANSWER  → the worker thread exits
//   @@marker-test:throw@@       in the ANSWER  → the operation throws
import { parentPort } from 'node:worker_threads';
import { MARKER_OPS, serveMarker } from '../../platform/markerOps.js';

const MAGIC = /@@marker-test:(spin|oom|exit|throw)(?::(\d+))?@@/;
export const magic = (kind, ms) => `@@marker-test:${kind}${ms === undefined ? '' : ':' + ms}@@`;

function spin(ms) {
  const until = ms === undefined ? Infinity : performance.now() + Number(ms);
  // Synchronous on purpose: the event loop of this thread never runs, exactly
  // like a regular expression that is backtracking.
  while (performance.now() < until) { /* busy */ }
}

function misbehave(text) {
  const m = MAGIC.exec(String(text ?? ''));
  if (!m) return String(text ?? '');
  if (m[1] === 'spin') spin(m[2]);
  else if (m[1] === 'oom') { const hoard = []; for (;;) hoard.push(new Array(1e6).fill(hoard.length)); }
  else if (m[1] === 'exit') process.exit(3);
  else if (m[1] === 'throw') throw new Error('marker-test: thrown on request');
  return String(text).replace(MAGIC, '');
}

/**
 * Wrap an operation: act on the answer before it, and on the working after
 * its first stage — but only when the real operation goes on to a working
 * stage (`continues`), so a marker in working that is never checked costs
 * nothing, as it would not in the real worker.
 */
const wrap = (run, answerField, workingField, continues) => (args, emit) => {
  const answer = misbehave(args[answerField]);
  let working = args[workingField];
  const joined = Array.isArray(working) ? working.join('\n') : working;
  const late = MAGIC.test(String(joined ?? ''));
  if (late) working = String(joined).replace(MAGIC, '');
  return run({ ...args, [answerField]: answer, [workingField]: working }, partial => {
    emit(partial);
    if (late && continues(partial, args)) misbehave(joined);
  });
};

export const TEST_MARKER_OPS = Object.freeze({
  practice: wrap(MARKER_OPS.practice, 'answer', 'working', (partial, args) => partial.result.correct === true || args.evidenceIfWrong === true),
  exam: wrap(MARKER_OPS.exam, 'given', 'working', partial => partial.final !== true),
  tutor: (args, emit) => { misbehave((args.lines || []).join('\n')); return MARKER_OPS.tutor(args, emit); }
});

if (parentPort) serveMarker(parentPort, TEST_MARKER_OPS);
