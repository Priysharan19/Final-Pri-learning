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
import { derivedMetaOff } from '../../client/src/engine/derivedMetaOff.js';
import { checkAnswer, stepCheck, methodMarks } from '../../client/src/engine/checker.js';
import { markObjective, markMultiCorrect } from '../../client/src/engine/indiaExams.js';
import { markMatrixMatch } from '../../client/src/engine/matrixMatch.js';
import { markGraphSketch, readFeatureSet, sketchMethodCredit, sketchVerdicts } from '../../client/src/engine/graphFeatures.js';
import { markGeometry } from '../../client/src/engine/geometryFacts.js';
import { checkProof } from '../../client/src/engine/proofSteps.js';
// The policy is plain data the pool puts into every operation (D12). This
// module reads no environment itself: markingPolicy.js imports nothing.
import { policyOf } from './markingPolicy.js';
import { stepCheckArithmetic } from '../../client/src/engine/arithmeticLines.js';
import { questionFacts } from '../../client/src/engine/questionFacts.js';
import { missingSteps } from '../../client/src/engine/missingSteps.js';
import { infoOf as arithmeticInfo, cleanStatement } from '../../client/src/engine/arithmeticLines.js';
import { annotateMilestones } from '../../client/src/engine/milestones.js';
import { awardBoardScheme, matchBoardPoints } from '../../client/src/engine/boardScheme.js';
import { answerForm, effectiveSymbols, firstFinalAttempt, planGivens, readClaimForm } from './finalAttempt.js';

// Mirrors the shared deterministic checker input used by local practice;
// questions, answer keys and stage meta remain server-private.
export function stepMetaFor(q) {
  if (q.stepcheck) return q.stepcheck;
  if (derivedMetaOff(q)) return null;   // answer only until the family has a structured meta
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
    // The letter the question asks for ("Find all values of $k$ ..."), not a guessed x: working in another letter is a side
    // calculation, never a claim about this answer.
    const asked = String(q.prompt || '').match(/\b(?:values?|solutions?|roots?)\s+of\s+\$([A-Za-z])\$/i);
    return { kind: 'equation', variable: asked ? asked[1] : 'x', solutions: a.values };
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
  // A past-paper question carrying the Board's transcribed scheme is worth the
  // marks the Board printed (boardScheme.js), not a number guessed from steps.
  if (Array.isArray(q.boardScheme) && Number.isInteger(q.marks)) return q.marks;
  const keySteps = (q.steps || []).filter(isSchemeStep);
  const maxMarks = Math.min(4, Math.max(1, Number(q.difficulty) || 1));
  return Math.max(1, Math.min(maxMarks, keySteps.length || 1));
}

/** The true-as-written report for a working (engine/arithmeticLines.js), or null when it cannot be made. */
function trueAsWritten(q, steps, opts) {
  try {
    const facts = opts && Object.hasOwn(opts, 'facts') ? opts.facts : questionFacts(q);
    return stepCheckArithmetic(steps, { latex: opts && Array.isArray(opts.latex) ? opts.latex : null, facts });
  } catch { return null; }
}

/**
 * FEEDBACK ONLY, run after every mark is computed (nothing reads its result but the result card). A question with a
 * Step Check leaves the lines it does not cover unjudged, though some of them are true as written (live, 20 November
 * 2026: four true lines of an integral came back "not checked"). For each such line the true-as-written report's TICK
 * is copied over; it says the line is true as written, never that it is the right step, and it is never a mark.
 *   · only a line the topic report left a note (never one it ticked, crossed or marked as following a slip);
 *   · nothing at or after the topic report's first break; a cross is never copied;
 *   · lines are matched by index AND identical text, or the fold is skipped entirely.
 * Returns the report itself when nothing is folded.
 */
export function foldTrueAsWritten(report, arithmetic) {
  if (!report || !arithmetic || !Array.isArray(report.lines) || !Array.isArray(arithmetic.lines) || report.lines.length !== arithmetic.lines.length) return report;
  if (report.lines.some((l, i) => String(l?.text ?? '').trim() !== String(arithmetic.lines[i]?.text ?? '').trim())) return report;
  const brk = report.lines.findIndex(l => l?.status === 'break');
  const limit = brk >= 0 ? brk : report.lines.length;
  let folded = 0;
  const lines = report.lines.map((l, i) => {
    const a = arithmetic.lines[i];
    const unjudged = l?.status === 'note' && (l.state === undefined || l.state === 'unverified' || l.state === 'unread') && l.note !== 'Follows from the earlier slip.';
    if (i >= limit || !unjudged || a?.status !== 'ok' || a.state !== 'arithmetic') return l;
    folded++;
    return { text: l.text, status: 'ok', state: 'arithmetic', note: a.note, valueChain: a.valueChain };
  });
  if (!folded) return report;
  // The report is now one that judges each line on its own (a state on every line), so the card says WHICH lines were checked.
  const stated = lines.map(l => ({ ...l, state: l.state || (l.status === 'ok' ? 'verified' : l.status === 'break' ? 'wrong' : l.unreadable ? 'unread' : 'unverified') }));
  const at = st => stated.flatMap((l, k) => (l.state === st ? [k + 1] : []));
  const unverified = at('unverified'), unread = at('unread');
  return {
    ...report, lines: stated, source: 'value-chain', folded: true,
    summary: {
      ...(report.summary || {}), total: stated.length, checked: stated.filter(l => l.status === 'ok').length,
      given: at('given'), verified: at('verified'), arithmetic: at('arithmetic'), conditions: at('condition'), wrong: at('wrong'), unverified, unread,
      reason: unverified.length ? (report.summary?.reason || 'Pri could not tie these lines to anything it can prove about this question, so it did not mark them.') : null
    }
  };
}

export function stepEvidence(q, answer, steps, result, opts = null) {
  const meta = stepMetaFor(q);
  let report = result.stepReport || null;
  if (meta && steps && !report) {
    // The prompt lets a true line about another unknown of the question be
    // verified against the system it gives, instead of being left unjudged.
    try { report = stepCheck(meta, steps, { prompt: q.prompt }); } catch { report = null; }
  }
  // No Step Check for this question: the arithmetic on each line is still checked (engine/arithmeticLines.js).
  // That report proves only that stated numbers are equal; it reaches no mark below (meta is null there).
  if (!meta && steps && !report && typeof steps === 'string' && !OBJECTIVE.has(q.answerType) && !Array.isArray(q.boardScheme)) {
    // What the question's own prompt gives (engine/questionFacts.js: read from `prompt` alone, never the answer or the
    // solution) lets a line that copies it, or sets up what it asks for, be ticked. `opts.facts` overrides it (the audit
    // measures with and without); it is never the typed final answer, which is not parsed here.
    report = trueAsWritten(q, steps, opts);
    // Nothing judged (no line was arithmetic): the reply says nothing about the lines, as before.
    if (report && !report.lines.some(l => l.status === 'ok' || l.status === 'break')) report = null;
  }
  let partial = null;
  // A blank final-answer box may still carry verified mathematical method
  // evidence. Invalid nonblank expressions do not become creditable merely
  // because working was attached; only an actually empty final-answer field
  // can be graded by method alone.
  const blankFinal = typeof answer === 'string' && answer.trim() === '';
  if (meta && steps && !result.correct && (!result.invalid || blankFinal) && Array.isArray(q.boardScheme)) {
    // The Board's own scheme: each value point earned by its own line, one line
    // per point, in order, verified by the deterministic step check
    // (matchBoardPoints). methodMarks' generic rubric is not used — the record
    // says how the Board marked this question.
    const okLines = (report?.lines || []).filter(l => l?.status === 'ok').length;
    const ticked = matchBoardPoints({ scheme: q.boardScheme, lines: report?.lines || [], meta });
    const award = awardBoardScheme({ scheme: q.boardScheme, ticked, correct: false });
    if (okLines > 0) partial = { okLines, awarded: award.method, note: award.method > 0 ? `${award.method} of ${award.total} marks for the method the Board's marking scheme credits.` : 'Your working does not yet reach a whole mark of the Board\'s marking scheme.', lines: (report?.lines || []).map(l => ({ status: l?.status, text: l?.text })), lost: award.total - award.method, boardScheme: true };
  } else if (meta && steps && !result.correct && (!result.invalid || blankFinal)) {
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
  // The Board's scheme decides the mark of a right answer too: the answer
  // point is earned by checkAnswer, every working point only by its own line
  // (matchBoardPoints). A right answer with junk, repeated or no working is
  // worth the answer point alone, never the printed marks (D25 delta review).
  const board = Array.isArray(q.boardScheme) ? boardAward(q, meta, report, result.correct === true) : null;
  // An arithmetic report keeps to arithmetic: no milestone tick is added to it, so its wording stays true of every tick.
  try { if (report && report.arithmetic !== true) report = annotateMilestones(q, report); } catch { /* the report stands */ }
  // Feedback only (see foldTrueAsWritten): after every mark above, so no mark, partial or milestone reads it.
  if (meta && steps && typeof steps === 'string' && !OBJECTIVE.has(q.answerType) && !Array.isArray(q.boardScheme) && !(opts && opts.fold === false)) {
    try {
      const needs = !report || (Array.isArray(report.lines) && report.lines.some(l => l?.status === 'note'));
      if (needs) {
        const arithmetic = trueAsWritten(q, steps, opts);
        if (!report) { if (arithmetic && arithmetic.lines.some(l => l.status === 'ok' || l.status === 'break')) report = arithmetic; }
        else report = foldTrueAsWritten(report, arithmetic);
      }
    } catch { /* the report stands */ }
  }
  // A true-as-written tick on a line that ends at the student's own WRONG answer (`so 10^1 = 10` when the answer is 30)
  // reads as "this is right". The arithmetic is; the value was not accepted (it may be wrong, or right in a form or unit
  // the question did not accept: the note claims only what is true in both cases). Such a tick becomes that note.
  try {
    // The submitted answer is read only when it is a plain number: nothing a student types into the answer box is
    // parsed or evaluated here (what an answer costs to mark must not depend on what is written in it).
    const typed = typeof answer === 'string' ? answer.trim() : '';
    const given = /^-?\d{1,15}(?:\.\d{1,10})?$/.test(typed) ? { value: Number(typed) } : null;
    if (report && result.correct === false && given && Array.isArray(report.lines)) {
      let changed = false;
      const lines = report.lines.map(l => {
        if (l?.status !== 'ok' || l.state !== 'arithmetic') return l;
        const sides = String(l.text).replace(/[≈≃]/g, '=').split('=').map(x => x.trim()).filter(Boolean);
        let last = null;
        try { last = arithmeticInfo(cleanStatement(sides[sides.length - 1] || '')); } catch { last = null; }
        if (!last || last.value === undefined || Math.abs(last.value - given.value) > 1e-9 * Math.max(1, Math.abs(given.value))) return l;
        changed = true;
        return { text: l.text, status: 'note', state: 'unverified', unverified: true, note: 'The arithmetic on this line is right, but this value was not accepted as the answer.' };
      });
      if (changed) report = { ...report, lines };
    }
  } catch { /* the report stands */ }
  // Feedback only, for an answer that is not right: the steps of the worked solution whose values are nowhere on the
  // page (engine/missingSteps.js). Computed after every mark above; nothing reads it but the result card.
  try { if (report && result.correct !== true && typeof steps === 'string') { const gap = missingSteps(q, steps); if (gap) report = { ...report, missing: gap.missing, stepsFound: gap.found, stepsReadable: gap.total }; } } catch { /* the report stands */ }
  return board ? { stepReport: report, partial, board } : { stepReport: report, partial };
}

/** The Board-scheme award for a question carrying one, from the deterministic report. */
function boardAward(q, meta, report, correct) {
  const ticked = matchBoardPoints({ scheme: q.boardScheme, lines: report?.lines || [], meta });
  const award = awardBoardScheme({ scheme: q.boardScheme, ticked, correct });
  return { awarded: award.awarded, total: award.total, method: award.method };
}

/** The marks a resolved practice answer earns: the Board's scheme when the question carries one. */
export function practiceMarksEarned(q, result, evidence, marksPossible) {
  if (Array.isArray(q.boardScheme)) {
    const board = evidence?.board;
    if (!board) return 0;   // no deterministic award, no mark
    return result.correct ? Math.min(marksPossible, board.awarded) : Math.max(0, Math.min(marksPossible - 1, evidence?.partial?.awarded ?? 0));
  }
  return result.correct ? marksPossible : Math.max(0, Math.min(marksPossible - 1, evidence?.partial?.awarded ?? 0));
}

// ── Examination marking, in the two stages the pool can tell apart ──────────
const OBJECTIVE = new Set(['mcq', 'multi-mcq', 'matrix-match']);
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
  if (q.answerType === 'matrix-match') {
    let r;
    try { r = markMatrixMatch(grid, given, q.answer?.matrix); } catch { r = { awarded: 0, outcome: 'invalid', feedback: 'This grid cannot be checked.' }; }
    return { final: true, response: { unanswered: r.outcome === 'unanswered', correct: r.outcome === 'full', awarded: r.awarded,
      feedback: String(r.feedback || '').slice(0, 3000), partial: r.outcome === 'partial' ? { awarded: r.awarded, note: r.feedback } : null,
      markingScheme: 'objective-per-row', outcome: r.outcome === 'full' ? 'correct' : r.outcome } };
  }
  if (q.answerType === 'graph-sketch') {
    // Each assessed feature earns its scheme marks; review features earn nothing until a person marks them.
    const g = q.answer?.graph, set = readFeatureSet(given);
    let r = null;
    if (set && g?.spec && g?.scheme) { try { r = markGraphSketch(g.spec, set, g.scheme, g.tol); } catch { r = null; } }
    const awarded = Math.max(0, Math.min(marks, r ? r.awarded : 0));
    const correct = !!r && !r.needsReview && r.possible > 0 && r.awarded === r.possible;
    const note = !r ? 'This sketch could not be read.' : r.needsReview ? 'Part of this sketch needs a teacher to check it.' : '';
    return { final: true, response: { unanswered: false, correct, awarded: correct ? marks : awarded, feedback: note,
      partial: !correct && awarded > 0 ? { awarded, note: 'Marks for the features that match.' } : null, features: r?.features || null,
      needsReview: !!r?.needsReview, markingScheme: 'graph-features', outcome: correct ? 'correct' : awarded > 0 ? 'partial' : 'wrong' } };
  }
  if (q.answerType === 'geometry') {
    // Measurable facts earn their part marks; a construction step waits for a person.
    let response = given, r = null;
    if (typeof given === 'string') { try { response = given.length <= 4096 ? JSON.parse(given) : null; } catch { response = null; } }
    if (response && typeof response === 'object') { try { r = markGeometry(q.answer?.geometry, response); } catch { r = null; } }
    const awarded = Math.max(0, Math.min(marks, r ? r.awarded : 0));
    const correct = !!r && !r.needsReview && r.possible > 0 && r.awarded === r.possible;
    const note = !r ? 'This answer could not be read.' : r.needsReview ? 'A construction step needs a teacher to check it.' : '';
    return { final: true, response: { unanswered: false, correct, awarded: correct ? marks : awarded, feedback: note,
      partial: !correct && awarded > 0 ? { awarded, note: 'Marks for the parts that are right.' } : null, parts: r?.parts || null,
      needsReview: !!r?.needsReview, markingScheme: 'geometry-parts', outcome: correct ? 'correct' : awarded > 0 ? 'partial' : 'wrong' } };
  }
  if (q.answerType === 'proof') {
    // A proof earns marks from a person only. The algebra report goes with it as evidence.
    let r;
    try { r = checkProof(q, given); } catch { r = { feedback: 'This proof could not be read.' }; }
    return { final: true, response: { unanswered: false, correct: false, awarded: 0, feedback: String(r.feedback || '').slice(0, 3000), partial: null,
      proofReport: r.proofReport || null, needsReview: true, markingScheme: 'teacher-review', outcome: 'needs-review' } };
  }
  let result;
  try { result = checkAnswer(q, given); } catch { result = { correct: false }; }
  const correct = result.correct === true;
  const awarded = markObjective(grid, { unanswered: false, correct });
  let feedback = String(result.feedback || '');
  if (!correct && q.answerType === 'mcq' && q.answer?.optionTraps?.[Number(given)]) feedback = String(q.answer.optionTraps[Number(given)]);
  if (Array.isArray(q.boardScheme) && !objective) {
    // A Board-scheme question is marked by its scheme in an exam too: the
    // answer point by checkAnswer, each working point only by its own line.
    const meta = stepMetaFor(q);
    let report = null;
    if (meta && !blank(working)) { try { report = stepCheck(meta, String(working), { prompt: q.prompt }); } catch { report = null; } }
    const b = boardAward(q, meta, report, correct);
    const earned = Math.max(0, Math.min(marks, correct ? b.awarded : Math.min(marks - 1, b.method)));
    return { final: true, response: { unanswered: false, correct, awarded: earned, feedback: feedback.slice(0, 3000),
      partial: !correct && earned > 0 ? { awarded: earned, note: `${earned} of ${b.total} marks for the method the Board's marking scheme credits.`, lost: b.total - earned } : null,
      markingScheme: 'step-marked', outcome: correct ? 'correct' : 'wrong' } };
  }
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
 * A sketch inside the working (q.answer.sketchMethod = { spec, features, marks,
 * label }). Method credit only: off unless the marking policy turns method
 * marks on (D12), never for a right answer (it already has full marks), and
 * capped one below full marks like every method mark.
 */
export function sketchWorkingStage(q, sketch, grid, response, policy) {
  const rule = q.answer?.sketchMethod;
  if (!rule || !policyOf({ policy }).methodMarks || response.correct || response.unanswered) return response;
  const set = readFeatureSet(sketch);
  if (!set) return response;
  let credit;
  try { credit = sketchMethodCredit(rule.spec, set, rule); } catch { return response; }
  const marks = Number(grid.correct);
  const awarded = Math.max(0, Math.min(marks - 1, credit.awarded));
  if (awarded <= (response.awarded || 0)) return response;
  return { ...response, awarded, partial: { awarded, note: credit.label ? `Method: ${credit.label}.` : 'Method: the sketch in your working.' }, markingScheme: 'step-marked' };
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

/**
 * The teacher's view of one handed-in written answer (classroom.js): the
 * deterministic Step Check's verdict on each line, the first break and the
 * engine's own diagnosis code. FEEDBACK ONLY: it awards nothing, reads no
 * answer key and never runs methodMarks — a teacher decides any mark the
 * engine could not, and the engine's mark is left exactly as it was.
 * Statuses are a closed set: 'ok' (verified), 'break' (the first line that
 * does not follow), 'unsure' (anything else). A checker fault fails closed:
 * every line 'unsure', no break, no diagnosis.
 */
export const REVIEW_LINE_STATUSES = Object.freeze(['ok', 'break', 'unsure']);
export function reviewEvidence(q, lines) {
  const list = (Array.isArray(lines) ? lines : []).map(line => String(line ?? '')).slice(0, 40);
  const silent = { lines: list.map(() => 'unsure'), firstBreak: -1, verifiedLines: 0, diagnosis: null };
  if (!q || typeof q !== 'object' || !list.length) return silent;
  try {
    const meta = stepMetaFor(q);
    if (!meta) return silent;
    const report = stepCheck(meta, list.join('\n'), { prompt: q.prompt });
    const judged = Array.isArray(report?.lines) ? report.lines : [];
    let firstBreak = -1;
    const statuses = list.map((_, i) => {
      const s = judged[i]?.status;
      if (s === 'break' && firstBreak < 0) { firstBreak = i; return 'break'; }
      return s === 'ok' ? 'ok' : 'unsure';
    });
    const code = report?.diagnosis?.code;
    return {
      lines: statuses, firstBreak,
      verifiedLines: statuses.filter(s => s === 'ok').length,
      diagnosis: typeof code === 'string' && /^[a-z0-9._:-]{1,80}$/i.test(code) && report?.diagnosis?.confidence === 'high' ? code : null
    };
  } catch { return silent; }
}

/**
 * A sketch answer's per-feature verdicts for the reply that RESOLVES the question (graphFeatures.sketchVerdicts), carried on
 * the result as `sketch`. Display only: the mark is `result.correct` from the marker. The reply for an open try never reads it.
 */
function sketchReport(q, answer, result) {
  const g = q?.answerType === 'graph-sketch' ? q.answer?.graph : null;
  const set = g?.spec && g?.scheme ? readFeatureSet(answer) : null;
  if (!set) return result;
  try {
    const r = sketchVerdicts(g.spec, set, g.scheme, { resolved: true, tol: g.tol });
    return { ...result, sketch: { awarded: r.awarded, possible: r.possible, verdicts: r.verdicts.map(({ feature, verdict, detail, wentWrong, correct }) => ({ feature, verdict, ...(detail ? { detail } : {}), ...(wentWrong ? { wentWrong } : {}), ...(correct ? { correct } : {}) })) } };
  } catch { return result; }
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
  practice({ q, answer, working, workingLatex, evidenceIfWrong, policy }, emit) {
    const result = sketchReport(q, answer, checkAnswer(q, answer));
    emit({ result });
    const wanted = result.correct || evidenceIfWrong || !String(working || '').trim();
    if (!wanted) return { result, evidence: null };
    const evidence = stepEvidence(q, answer, working, result, Array.isArray(workingLatex) ? { latex: workingLatex } : null);
    // Final answer only: the step report stays, the method mark does not.
    return { result, evidence: policyOf({ policy }).methodMarks ? evidence : { stepReport: evidence.stepReport, partial: null, ...(evidence.board ? { board: evidence.board } : {}) } };
  },
  /** One examination response: the answer stage, then (method marks on) the working stage. */
  exam({ q, given, working, grid, policy }, emit) {
    const stage = examAnswerStage(q, given, working, grid);
    // Final answer only: the answer stage's response is the whole mark, so it
    // is reported as final and no working stage runs.
    // A question sealed final-answer-only (editionBanks.js: every Prithagoras
    // question) is marked on its answer whatever the policy says, as practice
    // honours the same seal at commit (practice.js). India questions carry no seal.
    const final = stage.final || q?._marking === 'final-answer-only' || !policyOf({ policy }).methodMarks;
    emit({ response: stage.response, final });
    return { response: final ? stage.response : examWorkingStage(q, working, grid, stage) };
  },
  tutor({ q, lines }) {
    return { evidence: tutorEvidence(q, lines) };
  },
  /** A handed-in answer's line verdicts for the teacher's review (feedback only, never a mark). */
  review({ q, lines }) {
    return { evidence: reviewEvidence(q, lines) };
  },
  /**
   * "Check this line so far": where the first final-answer attempt is (by
   * form, never by value — finalAttempt.js), and the Step Check of the lines
   * only when there is none. `answerText` is the escrow's display answer.
   */
  lineCheck({ q, lines, answerText }) {
    return lineCheckEvidence(q, lines, answerText);
  },
  /** The live step coach (F1): one verdict per working line, never a value. */
  stepCoach({ q, lines, answerText }) {
    return stepCoachEvidence(q, lines, answerText);
  }
});

/**
 * The live step coach's evidence (F1): one row per line, in order.
 *
 *   { status: 'ok', step }  the engine verified this line; `step` is the
 *                           1-based stage of an authored plan, else null
 *   { status: 'break' }     the FIRST line that does not follow from the
 *                           lines above it (a location only, never the fix)
 *   { status: 'unsure' }    the engine could not place it — say nothing
 *   { status: 'final' }     a final-answer attempt (finalAttempt.js, by FORM,
 *                           never value): only "Press Check"
 *
 * Lines from the first final-answer attempt on are 'final', and the Step
 * Check is run on the lines BEFORE it only, so a final line's value never
 * reaches the checker here: a right and a wrong final line get identical rows.
 * Lines after the first break or the first unplaced line are 'unsure' (a
 * chain broken above them cannot vouch for them). Unreadable answer form or a checker fault fails closed:
 * every line is 'final'.
 */
export function stepCoachEvidence(q, lines, answerText) {
  const list = Array.isArray(lines) ? lines : [];
  const allFinal = () => list.map(() => ({ status: 'final' }));
  if (!list.length) return [];
  const meta = stepMetaFor(q);
  const form = answerForm({ answerText, variable: meta?.kind === 'equation' ? meta.variable : null, prefix: q.answerPrefix });
  // Decided by each line's form alone (finalAttempt.js, 9699d375c): no
  // Step Check stage tag takes part, so a wrong final value is never told
  // apart from a right one.
  let attemptAt = firstFinalAttempt(list, form);
  // Live, every finished line is checked, so the guard is stricter than the
  // one-off line check: where the answer is a constant (it names no letter
  // beyond the asked unknowns), a line with any constant side ("n = 6",
  // "4 - (-1) + 1", "2·3 = 6") could carry that constant, so it is an attempt.
  if (form && answerIsConstant(answerText, form)) {
    const at = list.findIndex(constantSided);
    if (at >= 0 && (attemptAt < 0 || at < attemptAt)) attemptAt = at;
  }
  const open = attemptAt >= 0 ? list.slice(0, attemptAt) : list;
  let judged = [];
  if (meta && open.length) {
    try { judged = stepCheck(meta, open.join('\n'), { prompt: q.prompt })?.lines || []; } catch { return allFinal(); }
  }
  // "Doesn't follow from the line above" is said only where there IS a line
  // above that the engine verified: a first line, or one under a line the
  // engine could not place, is never flagged (a false break is the costly
  // error while the student is still writing).
  let stopped = false;
  let prevOk = false;
  return list.map((_, i) => {
    if (attemptAt >= 0 && i >= attemptAt) return { status: 'final' };
    const row = judged[i];
    if (stopped || !row) { stopped = true; return { status: 'unsure' }; }
    if (row.status === 'break') { stopped = true; return prevOk ? { status: 'break' } : { status: 'unsure' }; }
    if (row.status === 'ok') { prevOk = true; return { status: 'ok', step: meta?.kind === 'plan' && Number.isInteger(row.stage) && row.stage >= 0 ? row.stage + 1 : null }; }
    prevOk = false;
    return { status: 'unsure' };
  });
}

/** Does the escrowed answer name no letter beyond the asked unknowns? Unreadable → yes. */
function answerIsConstant(answerText, form) {
  const c = readClaimForm(answerText);
  if (!c) return true;
  return [...c.symbols].every(v => form.unknowns.has(v));
}
/** Has this line a side (or is it an expression) free of every letter? Unreadable → yes. */
function constantSided(line) {
  const c = readClaimForm(line);
  if (!c) return true;
  if (!c.sides) return c.symbols.size === 0;
  return c.sides.some(side => { const eff = effectiveSymbols(side); return !eff || eff.size === 0; });
}

/** The line check's evidence: { attemptAt, firstBreak, verifiedLines, misconception }. */
export function lineCheckEvidence(q, lines, answerText) {
  const silent = { firstBreak: -1, verifiedLines: 0, misconception: null };
  const meta = stepMetaFor(q);
  // Letters the question or plan fixes are constants in the form analysis
  // (#831 round 5). A plan that states none fails closed: every line is an attempt.
  const fixed = planGivens(meta);
  const form = fixed === null ? null
    : answerForm({ answerText, variable: meta?.kind === 'equation' ? meta.variable : null, prefix: q.answerPrefix, fixed });
  // The final-attempt decision is made FIRST, from each line's shape and
  // symbols alone, before and independently of any Step Check verdict. The
  // Step Check's stage tag is NOT used: it placed a wrong final value at the
  // plan's last stage and left a right one unplaced (c10-areas-circles D1
  // seed 11: "A = 462" judged, "A = 461" final), so it was an oracle.
  const attemptAt = firstFinalAttempt(lines, form);
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
