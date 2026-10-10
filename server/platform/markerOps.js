// Pri Learning — the deterministic marking operations the server runs.
//
// These are the ONLY places the server calls the marker (checkAnswer,
// stepCheck, methodMarks). They are pure: plain data in, plain data out, no
// database, no clock, no randomness, no secret. That is what lets them run in
// a worker thread (markerWorker.js, driven by markerPool.js) where a hard
// deadline can stop them, instead of on the thread that answers every other
// account's request.
//
// Nothing here decides more or less than the request handlers used to decide
// inline: the functions were moved, not changed. The deterministic engine
// still decides every mark; no model output is involved.
//
// This file imports the engine only (client/src/engine, which the production
// image ships — see Dockerfile and production-runtime-image-check.mjs). It
// must never import a server module: the worker has no store and no secrets.
import { checkAnswer, stepCheck, methodMarks } from '../../client/src/engine/checker.js';
import { markObjective, markMultiCorrect } from '../../client/src/engine/indiaExams.js';

// Mirrors the shared deterministic checker input used by local practice;
// questions, answer keys and stage meta remain server-private.
export function stepMetaFor(q) {
  if (q.stepcheck) return q.stepcheck;
  const a = q.answer;
  if (!a) return null;
  if (q.answerType === 'expression' && a.expr) return { kind: 'expression', canonical: a.expr };
  if (q.answerType === 'numeric' && a.value !== undefined) {
    const m = (q.answerPrefix || '').match(/^([a-z])\s*=$/i);
    // The letter as the question writes it: an angle $A$ is not the side $a$.
    if (m) return { kind: 'equation', variable: m[1], solutions: [a.value] };
    // Some authored Class 8 algebra forms print only `$6m+15=7m+29$`
    // and omit answerPrefix. Derive the variable ONLY from that entire,
    // single-variable, plain algebraic equation. Other numeric prompts
    // (evaluation, geometry, scientific units, multi-equation systems) must
    // not acquire method-credit authority from a guessed letter.
    const source = String(q.prompt || '').match(/^\s*\$([^$]+)\$\s*$/);
    const equation = source?.[1]?.trim();
    if (equation && /^[0-9a-z\s+*/().=\-]+$/i.test(equation) &&
        equation.split('=').length === 2 && Number.isFinite(Number(a.value))) {
      const symbols = [...new Set((equation.match(/[a-z]/gi) || []).map(v => v.toLowerCase()))];
      if (symbols.length === 1) return {
        kind: 'equation', variable: symbols[0], solutions: [a.value], source: equation
      };
    }
  }
  if (q.answerType === 'set' && Array.isArray(a.values) && a.values.length) {
    return { kind: 'equation', variable: 'x', solutions: a.values };
  }
  return null;
}

// An issued question and every committed grade must use the SAME server-owned
// rubric. Difficulty alone is not marks; the authored non-auxiliary criteria
// define the total, bounded by the question's four-mark practice contract.
export function marksPossibleFor(q) {
  const keySteps = (q.steps || []).filter(step => !/^(check|note|bonus)/i.test(step.h));
  const maxMarks = Math.min(4, Math.max(1, Number(q.difficulty) || 1));
  return Math.max(1, Math.min(maxMarks, keySteps.length || 1));
}

// ── A check the engine's clock stopped has no result ────────────────────────
// The engine reads a page of working under a 750 ms wall-clock backstop
// (checker.js WORKING_LIMITS.backstopMs). How long a line takes depends on
// what else the machine is doing, so a check the clock stopped says nothing
// about the working: the engine returns `unverified: true` and no mark. Every
// operation below passes that on as `{ unverified: true }` for the WHOLE
// submission — never as a verdict, a mark, or a report with lines missing —
// and the request handlers answer it exactly as they answer a worker stopped
// at its deadline: not an attempt, nothing spent, nothing written, send again.
export const UNVERIFIED = Object.freeze({ unverified: true });

export function stepEvidence(q, answer, steps, result) {
  const meta = stepMetaFor(q);
  let report = result.stepReport || null;
  if (meta && steps && !report) {
    // The prompt lets a true line about another unknown of the question be
    // verified against the system it gives, instead of being left unjudged.
    try { report = stepCheck(meta, steps, { prompt: q.prompt }); } catch { report = null; }
  }
  if (report?.unverified === true) return { stepReport: null, partial: null, unverified: true };
  let partial = null;
  // A blank final-answer box may still carry verified mathematical method
  // evidence. Invalid nonblank expressions do not become creditable merely
  // because working was attached; only an actually empty final-answer field
  // can be graded by method alone.
  const blankFinal = typeof answer === 'string' && answer.trim() === '';
  if (meta && steps && !result.correct && (!result.invalid || blankFinal)) {
    try {
      const method = methodMarks({
        meta, working: steps, marks: marksPossibleFor(q), prompt: q.prompt, report
      });
      if (method?.unverified === true) return { stepReport: null, partial: null, unverified: true };
      if (method) partial = { okLines: method.okLines, awarded: method.awarded, note: method.note, lines: method.lines };
    } catch { partial = null; }
  }
  return { stepReport: report, partial };
}

// ── Examination marking, in the two stages the pool can tell apart ──────────
const OBJECTIVE = new Set(['mcq', 'multi-mcq']);
const blank = v => v === undefined || v === null || String(v).trim() === '';

/**
 * Stage one of an examination response: the answer alone. Returns the response
 * exactly as markResponse would return it for the same answer with NO working.
 * `final: true` says working could not change it (blank, objective, correct,
 * negatively marked, one mark, no working, nothing to check it against).
 */
export function examAnswerStage(q, given, working, grid) {
  const marks = Number(grid.correct);
  const objective = OBJECTIVE.has(q.answerType);
  if (blank(given)) {
    return { final: true, response: { unanswered: true, correct: false, awarded: markObjective(grid, { unanswered: true }), feedback: 'Not attempted.', partial: null,
      markingScheme: objective ? 'objective' : 'final-answer', outcome: 'unanswered' } };
  }
  if (q.answerType === 'multi-mcq') {
    const chosen = String(given).split(/[,\s]+/).map(s => s.trim()).filter(Boolean).map(Number).filter(Number.isInteger);
    const r = markMultiCorrect(grid, chosen, q.answer?.correctIndices || []);
    const note = r.outcome === 'partial'
      ? `+${r.awarded}: every option you chose is correct, but not all correct options were chosen.`
      : r.outcome === 'wrong' ? `${r.awarded}: at least one chosen option is wrong.` : '';
    return { final: true, response: { unanswered: false, correct: r.outcome === 'full', awarded: r.awarded, feedback: note,
      partial: r.outcome === 'partial' ? { awarded: r.awarded, note } : null, markingScheme: 'objective-partial',
      outcome: r.outcome === 'full' ? 'correct' : r.outcome } };
  }
  let result;
  try { result = checkAnswer(q, given); } catch { result = { correct: false }; }
  if (result.unverified === true) return { final: true, unverified: true, response: null };
  const correct = result.correct === true;
  const awarded = markObjective(grid, { unanswered: false, correct });
  let feedback = String(result.feedback || '');
  if (!correct && q.answerType === 'mcq' && q.answer?.optionTraps?.[Number(given)]) feedback = String(q.answer.optionTraps[Number(given)]);
  const markingScheme = objective || (grid.incorrect || 0) < 0 || marks <= 1 ? 'objective' : 'final-answer';
  const response = { unanswered: false, correct, awarded, feedback: feedback.slice(0, 3000), partial: null, markingScheme,
    outcome: correct ? 'correct' : 'wrong' };
  const meta = !correct && markingScheme === 'final-answer' && !blank(working) ? stepMetaFor(q) : null;
  return { final: !meta, response, meta };
}

/** Stage two: the working of a wrong written answer, by the rule practice uses. */
export function examWorkingStage(q, working, grid, stage) {
  if (stage.final) return stage.response;
  const marks = Number(grid.correct);
  const response = { ...stage.response };
  try {
    const method = methodMarks({ meta: stage.meta, working: String(working), marks, prompt: q.prompt });
    // The clock stopped the check of the working: there is no method mark to
    // report, and "none" would be a mark. The caller is told so instead.
    if (method?.unverified === true) return null;
    if (method && method.awarded > 0) {
      response.awarded = Math.max(0, Math.min(marks - 1, method.awarded));
      response.partial = { okLines: method.okLines, awarded: response.awarded, note: method.note };
    }
    response.markingScheme = 'step-marked';
  } catch { /* the final-answer mark stands */ }
  return response;
}

/**
 * Mark one response under a marking grid, with the deterministic engine only.
 * Blank earns the grid's unanswered mark. A wrong written answer that comes
 * with working earns method marks by the same rule practice uses
 * (methodMarks: a restated question earns nothing; capped one below full
 * marks). Objective and negatively marked items never earn method marks.
 */
export function markResponse(q, given, working, grid) {
  const stage = examAnswerStage(q, given, working, grid);
  if (stage.unverified) return { unverified: true };
  return examWorkingStage(q, working, grid, stage) || { unverified: true };
}

/** The tutor's Step Check on a student's own lines (practice.js issuedQuestionForTutor). */
export function tutorEvidence(q, lines) {
  const evidence = { firstBreak: -1, verifiedLines: 0, misconception: null };
  const meta = stepMetaFor(q);
  if (!meta || !Array.isArray(lines) || !lines.length) return evidence;
  try {
    const report = stepCheck(meta, lines.join('\n'), { prompt: q.prompt });
    // A check the clock stopped is silence, not "no line verified".
    if (report?.unverified === true) return evidence;
    const judged = report?.lines || [];
    const at = judged.findIndex(line => line?.status === 'break');
    if (at >= 0 && at < lines.length) evidence.firstBreak = at;
    while (evidence.verifiedLines < judged.length && evidence.verifiedLines < lines.length &&
      judged[evidence.verifiedLines]?.status === 'ok') evidence.verifiedLines += 1;
  } catch { /* the checker's silence is not evidence */ }
  return evidence;
}

// ── The operations a worker serves ──────────────────────────────────────────
// Each takes its plain-data arguments and `emit`, which reports a completed
// stage to the request thread BEFORE the next stage starts. If the deadline
// then stops the worker, the stages already reported are still known. What a
// handler may do with them is narrow: a practice submission that was stopped
// is not an attempt whatever had been reported, and a paper uses them only at
// its documented ceiling (exams.js). When the ENGINE's clock stopped a check,
// the operation returns UNVERIFIED and nothing else.
export const MARKER_OPS = Object.freeze({
  /**
   * A practice submission: the answer, then (only when the reply could need
   * it) the working. `evidenceIfWrong` is the request thread's reading of
   * whether a wrong answer resolves the question; the handler re-decides that
   * under its transaction and asks again if it turns out to need evidence that
   * was not computed. Blank working costs nothing, so it is always "computed".
   */
  practice({ q, answer, working, evidenceIfWrong }, emit) {
    const result = checkAnswer(q, answer);
    if (result.unverified === true) return UNVERIFIED;
    emit({ result });
    const wanted = result.correct || evidenceIfWrong || !String(working || '').trim();
    const evidence = wanted ? stepEvidence(q, answer, working, result) : null;
    if (evidence?.unverified === true) return UNVERIFIED;
    return { result, evidence };
  },
  /** One examination response: the answer stage, then the working stage. */
  exam({ q, given, working, grid }, emit) {
    const stage = examAnswerStage(q, given, working, grid);
    if (stage.unverified) return UNVERIFIED;
    emit({ response: stage.response, final: stage.final });
    const response = examWorkingStage(q, working, grid, stage);
    return response ? { response } : UNVERIFIED;
  },
  tutor({ q, lines }) {
    return { evidence: tutorEvidence(q, lines) };
  }
});

/**
 * Serve operations on a worker's message port. One request at a time: the
 * pool never sends a second before the first has answered or been stopped.
 * An operation that throws answers `{ error }` — the worker stays up, and the
 * handler sees the same exception it would have seen inline.
 */
export function serveMarker(port, ops = MARKER_OPS) {
  port.on('message', message => {
    const { id, op, args } = message || {};
    const run = Object.hasOwn(ops, op) ? ops[op] : null;
    if (!run) { port.postMessage({ id, error: 'MARKER_OP_UNKNOWN' }); return; }
    try {
      const value = run(args, partial => port.postMessage({ id, partial }));
      port.postMessage({ id, value });
    } catch (error) {
      port.postMessage({ id, error: String(error?.message || 'MARKER_OP_FAILED').slice(0, 300) });
    }
  });
  port.postMessage({ ready: true });
}
