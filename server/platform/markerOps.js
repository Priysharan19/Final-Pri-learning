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
// The policy is plain data the pool puts into every operation (D12). This
// module reads no environment itself: markingPolicy.js imports nothing.
import { policyOf } from './markingPolicy.js';
import { annotateMilestones } from '../../client/src/engine/milestones.js';
import { answerForm, firstFinalAttempt } from './finalAttempt.js';

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
/** A step that carries a mark (not an auxiliary Check / Note / Bonus line). */
export function isSchemeStep(step) {
  return !/^(check|note|bonus)/i.test(step?.h);
}

export function marksPossibleFor(q) {
  const keySteps = (q.steps || []).filter(isSchemeStep);
  const maxMarks = Math.min(4, Math.max(1, Number(q.difficulty) || 1));
  return Math.max(1, Math.min(maxMarks, keySteps.length || 1));
}

export function stepEvidence(q, answer, steps, result) {
  const meta = stepMetaFor(q);
  let report = result.stepReport || null;
  if (meta && steps && !report) {
    // The prompt lets a true line about another unknown of the question be
    // verified against the system it gives, instead of being left unjudged.
    try { report = stepCheck(meta, steps, { prompt: q.prompt }); } catch { report = null; }
  }
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
      if (method) partial = { okLines: method.okLines, awarded: method.awarded, note: method.note, lines: method.lines, lost: method.lost };
    } catch { partial = null; }
  }
  // Feedback only, after the mark is computed: a correct intermediate line
  // that matches a step of the worked solution is ticked (milestones.js).
  // A question whose working is not checked (no Step Check: supportsSteps
  // false) gets no report at all, milestones or not.
  try { if (report) report = annotateMilestones(q, report); } catch { /* the report stands */ }
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
    if (method && method.awarded > 0) {
      response.awarded = Math.max(0, Math.min(marks - 1, method.awarded));
      response.partial = { okLines: method.okLines, awarded: response.awarded, note: method.note, lost: method.lost };
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
  return examWorkingStage(q, working, grid, examAnswerStage(q, given, working, grid));
}

/** The tutor's Step Check on a student's own lines (practice.js issuedQuestionForTutor). */
export function tutorEvidence(q, lines) {
  const evidence = { firstBreak: -1, verifiedLines: 0, misconception: null };
  const meta = stepMetaFor(q);
  if (!meta || !Array.isArray(lines) || !lines.length) return evidence;
  try {
    const report = stepCheck(meta, lines.join('\n'), { prompt: q.prompt });
    const judged = report?.lines || [];
    // The engine's own misconception id for the break (audit D1), as a stable
    // id only — never free text — exactly as the device reads it (tutorWork).
    const code = report?.diagnosis?.code;
    if (typeof code === 'string' && /^[a-z0-9._:-]{1,80}$/i.test(code)) evidence.misconception = code;
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
// then stops the worker, the stages already reported are still known: an
// answer that was marked in time keeps its verdict when only the working ran
// out of time.
//
// MARKING POLICY (D12). Each operation's `policy` (markingPolicy.js, put there
// by markerPool.js) decides whether working can earn a mark. Without
// `policy.methodMarks === true` a mark is for the final answer only: the
// working is still read and its step report returned, because that is
// feedback, but no method mark is computed into the reply. stepEvidence and
// examWorkingStage above stay the method rubric as written, so the rubric the
// examiner is asked to sign (#499, tools/examiner-dossier.mjs) and its suites
// are unchanged; only the operations the server runs apply the switch.
export const MARKER_OPS = Object.freeze({
  /**
   * A practice submission: the answer, then (only when the reply could need
   * it) the working. `evidenceIfWrong` is the request thread's reading of
   * whether a wrong answer resolves the question; the handler re-decides that
   * under its transaction and asks again if it turns out to need evidence that
   * was not computed. Blank working costs nothing, so it is always "computed".
   */
  practice({ q, answer, working, evidenceIfWrong, policy }, emit) {
    const result = checkAnswer(q, answer);
    emit({ result });
    const wanted = result.correct || evidenceIfWrong || !String(working || '').trim();
    if (!wanted) return { result, evidence: null };
    const evidence = stepEvidence(q, answer, working, result);
    // Final answer only: the step report stays, the method mark does not.
    return { result, evidence: policyOf({ policy }).methodMarks ? evidence : { stepReport: evidence.stepReport, partial: null } };
  },
  /** One examination response: the answer stage, then (method marks on) the working stage. */
  exam({ q, given, working, grid, policy }, emit) {
    const stage = examAnswerStage(q, given, working, grid);
    // Final answer only: the answer stage's response is the whole mark, so it
    // is reported as final and no working stage runs.
    const final = stage.final || !policyOf({ policy }).methodMarks;
    emit({ response: stage.response, final });
    return { response: final ? stage.response : examWorkingStage(q, working, grid, stage) };
  },
  tutor({ q, lines }) {
    return { evidence: tutorEvidence(q, lines) };
  },
  /**
   * "Check this line so far": where the first final-answer attempt is (by
   * form, never by value — finalAttempt.js), and the Step Check of the lines
   * only when there is none. `answerText` is the escrow's display answer.
   */
  lineCheck({ q, lines, answerText }) {
    return lineCheckEvidence(q, lines, answerText);
  }
});

/** The line check's evidence: { attemptAt, firstBreak, verifiedLines, misconception }. */
export function lineCheckEvidence(q, lines, answerText) {
  const silent = { firstBreak: -1, verifiedLines: 0, misconception: null };
  const meta = stepMetaFor(q);
  const form = answerForm({ answerText, variable: meta?.kind === 'equation' ? meta.variable : null, prefix: q.answerPrefix });
  let stages = [];
  let finalStage = -1;
  if (meta?.kind === 'plan' && Array.isArray(meta.stages) && meta.stages.length && Array.isArray(lines) && lines.length) {
    finalStage = meta.stages.filter(Boolean).length - 1;
    try {
      const rows = stepCheck(meta, lines.join('\n'), { prompt: q.prompt })?.lines || [];
      stages = lines.map((_, i) => (Number.isInteger(rows[i]?.stage) ? rows[i].stage : -1));
    } catch { return { ...silent, attemptAt: 0 }; }   // unreadable: fail closed
  }
  const attemptAt = firstFinalAttempt(lines, form, { stages, finalStage });
  if (attemptAt >= 0) return { ...silent, attemptAt };
  return { ...tutorEvidence(q, lines), attemptAt: -1 };
}

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
