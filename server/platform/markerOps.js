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
import { checkAnswer, stepCheck, methodMarks, claimFreeReport, tickRejections, AMBIGUOUS_FORM_NOTE } from '../../client/src/engine/checker.js';
import { ambiguousReadings, ambiguousForms } from '../../client/src/engine/expr.js';
import en from '../../client/src/i18n/strings.en.js';
import { checkBankAnswer } from './qbankMarking.js';
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
import { solutionMatch, _internals as SOLUTION_INTERNALS } from '../../client/src/engine/solutionMatch.js';
import { lineChains } from '../../client/src/engine/lineChains.js';
import { provedLines, provedLinesBank, openNote, withLines } from '../../client/src/engine/provedLines.js';
import { integrationLines } from '../../client/src/engine/integrationLines.js';
import { witnessOf } from '../../client/src/engine/pageProofs2.js';
import { unboxed } from '../../client/src/engine/boxes.js';
import { displayFields, bankDisplayFields } from '../../client/src/engine/displayFields.js';
import { awardBoardScheme, matchBoardPoints } from '../../client/src/engine/boardScheme.js';
import { constrainToShown, unsupportedCredit } from '../../client/src/engine/markExplanation.js';
import { holdFaultCrosses } from './bankFaults.js';
import { answerForm, effectiveSymbols, firstFinalAttempt, planGivens, readClaimForm } from './finalAttempt.js';

// Mirrors the shared deterministic checker input used by local practice;
// questions, answer keys and stage meta remain server-private.
/**
 * What the marker is shown of an author-bank question (qbankPack.js): its subtopic is its bank family's, not the product subtopic it is
 * practised in. The bank was audited against the engine under its family id (tools/qbank-import.mjs), and every rule the engine keys on a
 * subtopic (derived step checks that are switched off, a calculus line rule) was written for that subtopic's generators, never for these
 * questions. Marking, the step report and `supportsSteps` therefore see the family; progress, identity and the device see the subtopic.
 */
export const markerView = q => (q && typeof q._bank === 'string' && typeof q._family === 'string' && q.subtopic !== q._family ? { ...q, subtopic: q._family } : q);

/**
 * The Australian edition's questions (every one is sealed at issue: editionBanks.js stamps `_marking`, an approved step-mark type stamps
 * `_methodScheme`, an author-bank question carries `_bank`). Only they read a candidate root as a candidate (checker.js withCandidates);
 * India's questions carry none of the three and are read exactly as before.
 */
/** The extended TeX reading (engine/texToPlain.js) is the author bank's alone: a generator or paper question, however it is sealed, uses the default reader. */
export const usesExtendedTex = q => !!q && typeof q._bank === 'string';
// The equation-rewrite cross (engine/arithmeticLines.js, equationRewrite) is for an Australian Years 11-12 question (a bank question, or a generator of
// y11, y12, me11, me12) that has ONE part: with several parts the equations of different parts follow one another on the page and are not rewritings.
const NSW_SUBTOPIC = /^(?:y11|y12|me11|me12)-/;
const PART_MARK = /(?<![A-Za-z0-9])\(\s*(?:[a-h]|i{1,3}|iv)\s*\)/g;
/** An Australian Years 11-12 question: a bank question, or a generator of y11, y12, me11, me12. */
export const australianQuestion = q => !!q && (typeof q._bank === 'string' || NSW_SUBTOPIC.test(String(q.subtopic ?? '')));
export function oneAustralianPart(q) {
  if (!australianQuestion(q)) return false;
  const prompt = String(q.prompt ?? '');
  if (new Set((prompt.match(PART_MARK) || []).map(x => x.replace(/\s+/g, ''))).size >= 2) return false;
  const steps = Array.isArray(q.steps) ? q.steps : [];
  return steps.filter(st => /^\(?[a-h]\)?\.?$/i.test(String(st?.h ?? '').trim())).length < 2;
}
export const candidateRoots = q => !!q && (q._marking === 'final-answer-only' || typeof q._methodScheme === 'string' || typeof q._bank === 'string');
/** The equations the question's own worked solution writes (plain text): what a derived line of the page may be a multiple of. */
function authoredEquations(q) {
  const out = [];
  try {
    for (const st of Array.isArray(q?.steps) ? q.steps.slice(0, 20) : []) {
      for (const m of String(st?.d ?? '').replace(/\\\$/g, '\u0001').matchAll(/\$([^$]+)\$/g)) {
        for (const part of m[1].split(/\\(?:Rightarrow|Longrightarrow|therefore|implies)/)) {
          let plain = null; try { plain = SOLUTION_INTERNALS.spanToPlain(part); } catch { plain = null; }
          if (plain && plain.includes('=') && plain.length < 140) out.push(plain.trim());
        }
      }
    }
  } catch { /* none */ }
  return out;
}
const stepOptions = q => (candidateRoots(q) ? { prompt: q.prompt, candidates: true, authored: authoredEquations(q) } : { prompt: q.prompt });

export function stepMetaFor(q) {
  q = markerView(q);
  if (q.stepcheck) return q.stepcheck;
  if (derivedMetaOff(q)) return null;   // answer only until the family has a structured meta
  const a = q.answer;
  if (!a) return null;
  if (q.answerType === 'expression' && a.expr) return { kind: 'expression', canonical: a.expr };
  if (q.answerType === 'numeric' && a.value !== undefined) {
    const m = (q.answerPrefix || '').match(/^([a-z])\s*=$/i);
    // The letter as the question writes it: an angle $A$ is not the side $a$.
    if (m) return { kind: 'equation', variable: m[1], solutions: [a.value], ...(a.tol > 0 ? { tol: a.tol } : {}) };
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
        kind: 'equation', variable: symbols[0], solutions: [a.value], ...(a.tol > 0 ? { tol: a.tol } : {}), source: equation
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
  // An author-bank question is worth the marks its author set (server/platform/qbankPack.js seals it; no generator sets this field).
  if (Number.isInteger(q.authoredMarks) && q.authoredMarks >= 1 && q.authoredMarks <= 6) return q.authoredMarks;
  // A past-paper question carrying the Board's transcribed scheme is worth the
  // marks the Board printed (boardScheme.js), not a number guessed from steps.
  if (Array.isArray(q.boardScheme) && Number.isInteger(q.marks)) return q.marks;
  const keySteps = (q.steps || []).filter(isSchemeStep);
  const maxMarks = Math.min(4, Math.max(1, Number(q.difficulty) || 1));
  return Math.max(1, Math.min(maxMarks, keySteps.length || 1));
}

/** The true-as-written report for a working (engine/arithmeticLines.js), or null when it cannot be made. */
/** Every number the question's authored worked solution writes (a value with a unit, a fraction, a decimal), for engine/arithmeticLines.js: a line that reaches one is the next authored step, not a false equality. */
function solutionNumbers(q) {
  const out = new Set();
  try { for (const x of SOLUTION_INTERNALS.readSolution(q).values) if (Number.isFinite(x.v)) out.add(x.v); } catch { /* the numbers below stand */ }
  for (const st of Array.isArray(q?.steps) ? q.steps.slice(0, 40) : []) {
    const d = String(st?.d ?? '').slice(0, 2000);
    for (const m of d.matchAll(/(-?)\s*\\[dt]?frac\{(-?\d+(?:\.\d+)?)\}\{(-?\d+(?:\.\d+)?)\}/g)) { const v = (m[1] ? -1 : 1) * Number(m[2]) / Number(m[3]); if (Number.isFinite(v)) out.add(v); }
    for (const m of d.matchAll(/(?<![\w.])-?\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)?/g)) { const parts = m[0].split('/').map(x => Number(x.trim())); const v = parts.length === 2 ? parts[0] / parts[1] : parts[0]; if (Number.isFinite(v)) out.add(v); }
  }
  return [...out].slice(0, 400);
}

/**
 * Every `f(3) = … = v` the question or its authored worked solution states, as `f|3|v` (v the value the statement reaches, `*` when it is not a
 * number): what a line of working that names f(3) may reach. A function value the solution never states is not one a line can be said to be.
 */
function functionLabels(q) {
  const out = new Set();
  const spans = [];
  for (const t of [String(q?.prompt ?? ''), ...(Array.isArray(q?.steps) ? q.steps.slice(0, 40).map(st => String(st?.d ?? '').slice(0, 2000)) : [])]) {
    for (const m of t.replace(/\\\$/g, '\u0001').matchAll(/\$([^$]+)\$/g)) spans.push(m[1]);
  }
  for (const tex of spans) {
    for (const part of tex.split(/\\(?:Rightarrow|Longrightarrow|therefore|quad|qquad|text\{[^}]*\})|[,;]/)) {
      let plain = null;
      try { plain = SOLUTION_INTERNALS.spanToPlain(part); } catch { plain = null; }
      if (!plain) continue;
      const sides = plain.split(/(?<![<>!])=(?!=)/).map(x => x.trim());
      const head = /^([A-Za-z])\(\s*(-?\d+(?:\.\d+)?)\s*\)$/.exec(sides[0] || '');
      if (!head || sides.length < 2) continue;
      let v = null;
      try { const i = arithmeticInfo(cleanStatement(sides[sides.length - 1])); v = i && i.value !== undefined ? i.value : null; } catch { v = null; }
      out.add(`${head[1]}|${Number(head[2])}|${v === null ? '*' : Number(v.toPrecision(9))}`);
    }
  }
  return [...out];
}

function trueAsWritten(q, steps, opts) {
  try {
    const facts = opts && Object.hasOwn(opts, 'facts') ? opts.facts : questionFacts(q);
    const solutionValues = solutionNumbers(q);
    // the reader's TeX is read with the extended reading (engine/texToPlain.js) on an author-bank question only (usesExtendedTex); every other question, India's included, is read as before
    return stepCheckArithmetic(steps, { latex: opts && Array.isArray(opts.latex) ? opts.latex : null, ...(usesExtendedTex(q) ? { extendedTex: true } : {}), facts, solutionValues, knownLabels: functionLabels(q), answerValue: typeof q?.answer?.value === 'number' ? q.answer.value : null, equationRewrite: oneAustralianPart(q), ...(oneAustralianPart(q) ? { pageWitness: (texts, skip) => witnessOf(q, texts, skip) } : {}) });
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
  const crossed = [];
  const lines = report.lines.map((l, i) => {
    const a = arithmetic.lines[i];
    const unjudged = l?.status === 'note' && (l.state === undefined || l.state === 'unverified' || l.state === 'unread') && l.note !== 'Follows from the earlier slip.';
    // The ONE cross that is copied: a value of the student's own function that contradicts the definition the student wrote (QA 26 Nov 2026, item 12).
    if (i < limit && unjudged && a?.status === 'break' && a.valueChain?.rule === 'function-value') {
      crossed.push(i);
      return { text: l.text, status: 'break', state: 'wrong', note: a.note, diagnosis: a.diagnosis, valueChain: a.valueChain };
    }
    if (i >= limit || !unjudged || a?.status !== 'ok' || a.state !== 'arithmetic') return l;
    folded++;
    return { text: l.text, status: 'ok', state: 'arithmetic', note: a.note, valueChain: a.valueChain, ...(a.fact ? { fact: a.fact } : {}) };
  });
  if (!folded && !crossed.length) return report;
  // The report is now one that judges each line on its own (a state on every line), so the card says WHICH lines were checked.
  const stated = lines.map(l => ({ ...l, state: l.state || (l.status === 'ok' ? 'verified' : l.status === 'break' ? 'wrong' : l.unreadable ? 'unread' : 'unverified') }));
  const at = st => stated.flatMap((l, k) => (l.state === st ? [k + 1] : []));
  const unverified = at('unverified'), unread = at('unread');
  return {
    ...report, lines: stated, source: 'value-chain', folded: true,
    ...(crossed.length && !(report.firstBreak >= 0) ? { firstBreak: crossed[0], diagnosis: report.diagnosis ?? lines[crossed[0]].diagnosis } : {}),
    summary: {
      ...(report.summary || {}), total: stated.length, checked: stated.filter(l => l.status === 'ok').length,
      given: at('given'), verified: at('verified'), arithmetic: at('arithmetic'), conditions: at('condition'), wrong: at('wrong'), unverified, unread,
      reason: unverified.length ? (report.summary?.reason || 'Pri could not tie these lines to anything it can prove about this question, so it did not mark them.') : null
    }
  };
}

// The report that DECIDED the marks, reduced to what reproduces the decision (checker.methodMarks reads a line's text, status,
// stage, ecf, given, coversAll and otherUnknown; the card reads state, note and diagnosis). Absent when the displayed report
// carries the same: ordinary pages store nothing extra.
const MARKING_LINE_KEYS = ['text', 'status', 'state', 'note', 'diagnosis', 'stage', 'ecf', 'given', 'coversAll', 'otherUnknown'];
function markingReportOf(report) {
  if (!report || !Array.isArray(report.lines)) return null;
  const out = { lines: report.lines.map(l => { const o = {}; for (const k of MARKING_LINE_KEYS) if (l && l[k] !== undefined) o[k] = l[k]; return o; }) };
  if (report.firstBreak !== undefined) out.firstBreak = report.firstBreak;
  if (report.diagnosis !== undefined) out.diagnosis = report.diagnosis;
  if (report.summary !== undefined) out.summary = report.summary;
  return out;
}

/** Positions (in the non-blank lines) that follow a blank line: the student left a gap, so the line after it is not a continuation of the one before it. */
function blankGaps(steps) {
  if (typeof steps !== 'string') return [];
  const out = []; let kept = 0, blank = false;
  for (const raw of steps.split('\n')) { if (!raw.trim()) { blank = kept > 0; continue; } if (blank) out.push(kept); blank = false; kept++; }
  return out;
}

/** A line whose sides are the same text, or are all bare numbers of one value (`1=1`, `2.0=2`, `x=x`): it says nothing about the question. */
export function isIdentityLine(text) {
  if (typeof text !== 'string') return false;
  const sides = text.replace(/\$/g, '').split('=').map(x => x.replace(/\s+/g, '').replace(/^\((.*)\)$/, '$1').replace(/·/g, '*'));
  if (sides.length < 2 || sides.some(x => x === '')) return false;
  if (sides.every(x => x === sides[0])) return true;
  return sides.every(x => /^[-+]?\d+(?:\.\d+)?$/.test(x)) && sides.every(x => Number(x) === Number(sides[0]));
}
/** The report with each identity line kept true but neutral: marked as restating what is given (`restates`), which the step-mark rules neither credit nor treat as a stop. */
export function holdIdentityLines(report) {
  if (!report || !Array.isArray(report.lines) || !report.lines.some(l => l?.status === 'ok' && isIdentityLine(l.text))) return report;
  return { ...report, lines: report.lines.map(l => (l?.status === 'ok' && isIdentityLine(l.text) ? { text: l.text, status: 'ok', restates: true, note: 'This line says a thing equals itself. It is true, and it shows no working, so it is not counted towards a step.' } : l)) };
}

export function stepEvidence(q, answer, steps, result, opts = null) {
  const meta = stepMetaFor(q);
  let report = result.stepReport || null;
  if (meta && steps && !report) {
    // The prompt lets a true line about another unknown of the question be
    // verified against the system it gives, instead of being left unjudged.
    try { report = stepCheck(meta, steps, stepOptions(q)); } catch { report = null; }
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
  // A line with two readings (`e^-3x`: e^(-3x) or e^-3 times x, FUNCTION_ARGUMENT_RULE 7, client/src/engine/expr.js) that the deciding report did not
  // tick is ticked by a feedback overlay below only when the page with that line written as its conventional reading (e^(-3x)) ticks it: the match
  // to the worked solution is then true of the reading a student means. A line true as written only, or not true as e^(-3x), stays a note.
  const decidedLines = new Map();
  for (const l of report?.lines || []) if (typeof l?.text === 'string') decidedLines.set(l.text, l);
  let conventionalPage;
  const conventionalLines = () => {
    if (conventionalPage !== undefined) return conventionalPage;
    conventionalPage = null;
    if (opts && opts.conventionalProbe === true || typeof steps !== 'string') return conventionalPage;
    try {
      const own = steps.split('\n').map(l => l.trim()).filter(Boolean);
      const text = own.map(l => { const r = ambiguousReadings(l); return r.length ? r[0] : l; }).join('\n');
      conventionalPage = stepEvidence(q, answer, text, result, { ...(opts || {}), conventionalProbe: true }).stepReport?.lines ?? null;
    } catch { conventionalPage = null; }
    return conventionalPage;
  };
  const holdAmbiguous = rep => {
    if (!rep || !Array.isArray(rep.lines)) return rep;
    const held = l => l?.status === 'ok' && typeof l.text === 'string' && l.read !== 'conventional' && decidedLines.get(l.text)?.status !== 'ok' && ambiguousReadings(l.text).length > 0;
    if (!rep.lines.some(held)) return rep;
    return { ...rep, lines: rep.lines.map((l, i) => {
      if (!held(l)) return l;
      if (conventionalLines()?.[i]?.status === 'ok' && conventionalLines()[i].text !== l.text) {
        const f = ambiguousForms(l.text)[0];
        const why = f ? en['mark.readAsBrackets'].replace('{reading}', f.reading).replace('{literal}', f.literal) : '';
        return { ...l, read: 'conventional', note: [l.note, why].filter(Boolean).join(' ') };
      }
      return decidedLines.get(l.text)?.status === 'note' ? decidedLines.get(l.text) : { text: l.text, status: 'note', note: AMBIGUOUS_FORM_NOTE, unread: true, ambiguous: true };
    }) };
  };
  const blankFinal = typeof answer === 'string' && answer.trim() === '';
  // The method marks of a topic report (also run again on the displayed report to see whether it reproduces them).
  const partialOf = rep => {
    let out = null;
    // A blank final-answer box may still carry verified mathematical method
    // evidence. Invalid nonblank expressions do not become creditable merely
    // because working was attached; only an actually empty final-answer field
    // can be graded by method alone.
    if (meta && steps && !result.correct && (!result.invalid || blankFinal) && Array.isArray(q.boardScheme)) {
      // The Board's own scheme: each value point earned by its own line, one line
      // per point, in order, verified by the deterministic step check
      // (matchBoardPoints). methodMarks' generic rubric is not used — the record
      // says how the Board marked this question.
      const okLines = (rep?.lines || []).filter(l => l?.status === 'ok').length;
      const ticked = matchBoardPoints({ scheme: q.boardScheme, lines: rep?.lines || [], meta });
      const award = awardBoardScheme({ scheme: q.boardScheme, ticked, correct: false });
      if (okLines > 0) out = { okLines, awarded: award.method, note: award.method > 0 ? `${award.method} of ${award.total} marks for the method the Board's marking scheme credits.` : 'Your working does not yet reach a whole mark of the Board\'s marking scheme.', lines: (rep?.lines || []).map(l => ({ status: l?.status, text: l?.text })), lost: award.total - award.method, boardScheme: true };
    } else if (meta && steps && !result.correct && (!result.invalid || blankFinal)) {
      try {
        const method = methodMarks({
          meta, working: steps, marks: marksPossibleFor(q), prompt: q.prompt, report: rep
        });
        if (method) out = { okLines: method.okLines, awarded: method.awarded, note: method.note, lines: method.lines, lost: method.lost };
      } catch { out = null; }
    }
    return out;
  };
  let partial = partialOf(report);
  // Feedback only, after the mark is computed: a correct intermediate line
  // that matches a step of the worked solution is ticked (milestones.js).
  // A question whose working is not checked (no Step Check: supportsSteps
  // false) gets no report at all, milestones or not.
  // The Board's scheme decides the mark of a right answer too: the answer
  // point is earned by checkAnswer, every working point only by its own line
  // (matchBoardPoints). A right answer with junk, repeated or no working is
  // worth the answer point alone, never the printed marks (D25 delta review).
  const board = Array.isArray(q.boardScheme) ? boardAward(q, meta, report, result.correct === true) : null;
  // What decided the marks above; the display passes below may change `report`.
  let decided = meta && steps ? report : null;
  // Feedback only, after every mark: the topic check's CROSS on a definition, a label or a bare margin number is shown as a note,
  // and the lines after it are judged as if it were absent (checker.claimFreeReport). Every mark, `correct`, method mark and
  // board tick above was computed from the report the topic check made, unchanged. `opts.claims === false` is the test switch.
  if (meta && steps && typeof steps === 'string' && report && report.arithmetic !== true && !(opts && opts.claims === false)) {
    try {
      const shown = claimFreeReport(meta, steps, stepOptions(q), report);
      if (shown !== report) { report = shown; }
    } catch { /* the report stands */ }
  }
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
  // Feedback only, after foldTrueAsWritten (no mark, partial, board or milestone reads it): a line still unjudged that the
  // question's own worked solution recognises is ticked (engine/solutionMatch.js). Never a cross, never a changed verdict.
  if (typeof steps === 'string' && steps.trim() && !OBJECTIVE.has(q.answerType) && q.answerType !== 'graph-sketch' && !Array.isArray(q.boardScheme) && !(opts && opts.solutionMatch === false)) {
    try {
      const base = report || trueAsWritten(q, steps, opts);
      const matched = base ? solutionMatch(q, base, { inequalities: australianQuestion(q) }) : null;
      if (matched && matched.matched > 0) report = matched.report;
    } catch { /* the report stands */ }
    // Feedback only, after solutionMatch: chains, integrals, vectors and a slip warning (engine/lineChains.js). Never a mark, never a cross.
    try {
      const base2 = report || trueAsWritten(q, steps, opts);
      const more = base2 && !(opts && opts.fold === false) ? lineChains(q, base2, { warn: !!(opts && opts.slipWarnings === true), gaps: [...(opts && Array.isArray(opts.gaps) ? opts.gaps : []), ...blankGaps(steps)] }) : null;
      if (more && (more.matched > 0 || more.warned > 0)) report = more.report;
    } catch { /* the report stands */ }
  }
  // Feedback only, after every mark (topicTicks and `partial` above read `decided`, never this): a question that carries a DERIVED step plan
  // (engine/schemePlans.js) had, before the plan, the whole page judged against the answer (an expression question: equivalence to the keyed
  // answer). The plan replaced that check as the page's topic check, so a LAST line restating the final answer (`2x + -5`, `ans = 12`) was left
  // "not checked". The tick the question had without the plan is carried over for that one line, exactly as it was (never a cross, never a new
  // tick on a line that was not ticked there, never a mark: it is not in `decided`).
  try {
    if (q.stepcheck && q.stepcheck.kind === 'plan' && typeof q.stepcheck.scheme === 'string' && typeof steps === 'string' && steps.trim() && report && Array.isArray(report.lines) && report.lines.length && !(opts && opts.planFinal === false)) {
      const k = report.lines.length - 1, mine = report.lines[k];
      const unjudged = mine?.status === 'note' && (mine.state === undefined || mine.state === 'unverified') && mine.note !== 'Follows from the earlier slip.' && mine.unreadable !== true;
      if (unjudged && !report.lines.some(l => l?.status === 'break')) {
        const { stepcheck: _plan, ...bare } = q;
        const before = stepEvidence(bare, answer, steps, result, { ...(opts || {}), planFinal: false }).stepReport;
        const theirs = before?.lines?.[k];
        if (theirs && theirs.status === 'ok' && before.lines.length === report.lines.length && String(theirs.text).trim() === String(mine.text).trim()) {
          const { stage: _s, credit: _c, ...tick } = theirs;
          const lines = report.lines.map((l, i) => (i === k ? { ...tick, state: tick.state || 'verified' } : l));
          report = { ...report, lines };
        }
      }
    }
  } catch { /* the report stands */ }
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
  report = holdAmbiguous(report);
  // Feedback only, for an answer that is not right: the steps of the worked solution whose values are nowhere on the
  // page (engine/missingSteps.js). Computed after every mark above; nothing reads it but the result card.
  try { if (report && result.correct !== true && typeof steps === 'string') { const gap = missingSteps(q, steps); if (gap) report = { ...report, missing: gap.missing, stepsFound: gap.found, stepsReadable: gap.total }; } } catch { /* the report stands */ }
  // The displayed report is kept as it was. Where running the marks again on it would NOT give the stored `partial` (or the
  // Board's ticks), the report that decided them is kept beside it, reduced to what reproduces the decision.
  // BEHAVIOUR CHANGE of the generic method-marks path (not of final-answer marking). The marks rest only on lines the page shows as ticks,
  // and not after a cross that only the page makes (the first wrong step): a mark that main paid on a true line AFTER the page's own cross
  // (owner's product-rule page, line 9 true again after a crossed line 8: 3 marks, now 2) is no longer paid. A cross the deciding report
  // also made stays the rubric's own (an authored plan lets an independent stage earn). It can lower a method mark wherever method marks
  // are computed, whatever the allow-list says. Where method marks are off (production today, and every Prithagoras request) `partial` is
  // dropped by MARKER_OPS.practice, so this is a no-op for every reply: server/test/method-marks-ready-check.mjs proves the stripped
  // evidence identical with and without it. `opts.reconcile === false` is the measurement's "before" switch.
  if (decided && partial && !Array.isArray(q.boardScheme) && !(opts && opts.reconcile === false)) {
    const unsupported = unsupportedCredit(partial.lines, report?.lines, decided.lines);
    const { report: bounded, clipped } = unsupported.length ? constrainToShown(decided, report?.lines, unsupported) : { report: decided, clipped: 0 };
    if (clipped) { try { partial = partialOf(bounded); decided = bounded; } catch { /* the marks stand */ } }
  }
  // Feedback only, and DISPLAY ONLY: a note line that Pri can prove true (a solution list, a rounded value, a labelled substitution, a restated
  // equation: engine/provedLines.js) is ticked, with the proof in its sentence, in `shownReport`. `stepReport` is NOT changed: it stays the
  // deterministic report the marks, the scheme pay (schemeAward.schemePay), the generic solution-step rule and the stored record all read, so no
  // proved tick can open a step mark. Never a cross, never a changed verdict, never a mark. `opts.proved === false` is the measurement's "before"
  // switch, and `solutionMatch: false` (the switch that turns the display ticks off) turns it off too. Prithagoras (NSW Years 11-12) content only.
  let shownReport = null;
  if (typeof steps === 'string' && steps.trim() && !OBJECTIVE.has(q.answerType) && q.answerType !== 'graph-sketch' && !Array.isArray(q.boardScheme) && !(opts && (opts.proved === false || opts.solutionMatch === false)) && /^gen:(?:y11|y12|me11|me12)-/.test(String(q.contentId ?? ''))) {
    try {
      const base = report || trueAsWritten(q, steps, opts);
      const more = base ? provedLines(q, meta, base) : null;
      if (more && more !== base) shownReport = holdAmbiguous(more);
    } catch { /* the report stands */ }
  }
  // Feedback only (engine/integrationLines.js): a page of integration is read claim by claim (a substitution, its derivative and differential, a change of
  // variable, an antiderivative, a back-substitution). A line is ticked only when every claim on it is proved, crossed when one is provably false, and
  // left alone otherwise. DISPLAY ONLY, like the proved lines above: `stepReport` and every mark are untouched. Australian edition (NSW Years 11-12) questions only.
  try {
    if (typeof steps === 'string' && steps.trim() && !OBJECTIVE.has(q.answerType) && q.answerType !== 'graph-sketch' && !Array.isArray(q.boardScheme) && !(opts && (opts.proved === false || opts.solutionMatch === false || opts.integrationLines === false)) && (/^gen:(?:y11|y12|me11|me12)-/.test(String(q.contentId ?? '')) || typeof q._bank === 'string')) {
      const base = shownReport || report || trueAsWritten(q, steps, opts);
      const more = base ? integrationLines(q, base, l => openNote(l)) : null;
      if (more && more !== base) shownReport = holdAmbiguous(more);
    }
  } catch { /* the report stands */ }
  let markingReport = null;
  if (decided && decided !== report) {
    let reproduces = false;
    try { reproduces = JSON.stringify(partialOf(report)) === JSON.stringify(partial) && (!Array.isArray(q.boardScheme) || JSON.stringify(boardAward(q, meta, report, result.correct === true)) === JSON.stringify(board)); } catch { reproduces = false; }
    if (!reproduces) markingReport = markingReportOf(decided);
  }
  // A candidate root (checker.js withCandidates: a value of the derived equation that is no root of the original) stays a note on the
  // displayed page whatever the feedback layers above add: they tick a line that matches a step of the worked solution or that satisfies the line
  // before it, and a candidate must be checked in the original equation before any line of the page can claim it. The topic check's own rows.
  try {
    if (decided && report && Array.isArray(decided.lines) && Array.isArray(report.lines) && decided.lines.length === report.lines.length && decided.lines.some(l => l?.candidate === true)) {
      const keepCandidates = rep => ({ ...rep, lines: rep.lines.map((l, i) => (decided.lines[i]?.candidate === true && String(decided.lines[i].text).trim() === String(l?.text ?? '').trim() ? decided.lines[i] : l)) });
      report = keepCandidates(report);
      // the displayed report (the proved-line ticks) keeps a candidate a note too
      if (shownReport && Array.isArray(shownReport.lines) && shownReport.lines.length === decided.lines.length) shownReport = keepCandidates(shownReport);
    }
  } catch { /* the report stands */ }
  // Feedback only, last: the line that rejects a candidate root is ticked (checker.js tickRejections). Nothing above reads it.
  try {
    if (report && typeof steps === 'string' && candidateRoots(q)) {
      const lead = stepMetaFor(q);
      const letter = /^([a-z])\s*=$/i.exec(String(q.answerPrefix || '').trim());
      const keyed = q.answerType === 'numeric' && Number.isFinite(q.answer?.value) ? [q.answer.value] : q.answerType === 'set' && Array.isArray(q.answer?.values) && q.answer.values.every(Number.isFinite) ? q.answer.values : null;
      const candMeta = lead?.kind === 'equation' ? lead : (keyed ? { kind: 'equation', ...(letter ? { variable: letter[1] } : {}), solutions: keyed, ...(q.answer?.tol > 0 ? { tol: q.answer.tol } : {}) } : null);
      // DISPLAY ONLY: the rejection tick goes on the displayed report (`shownReport`), never on `report`, which the marks and the scheme pay read.
      if (candMeta) {
        const base = shownReport || report;
        const rejected = tickRejections(candMeta, base, { authored: authoredEquations(q), prompt: q.prompt });
        if (rejected !== base) shownReport = rejected;
      }
    }
  } catch { /* the report stands */ }
  // Feedback only, last of all: the display fields the marked page reads (engine/displayFields.js): a stable class id on every tick, `notRequired` on proved
  // lines after the answer-bearing line, the first wrong line's reason id and corrected right-hand side, `followsFromError` on later lines that are correct
  // consequences, and `answerLine`. Added to the DISPLAYED report only (`stepReport` is untouched, so no mark, scheme pay or stored record reads them).
  // `answerLine` is named only when the answer was marked correct, and by the same answer check that marked it (`accepts`).
  const displayCtx = { correct: result.correct === true, accepts: text => (checkBankAnswer(q, text) || {}).correct === true };
  // A box drawn round a line (`\\boxed{...}`, "(boxed)", "[boxed]", a bracket round the value) is layout, not mathematics (engine/boxes.js, the card's own reading), and it does not
  // make a line true. The marker's line check does not read the box, so such a line stays a note on the displayed page. Display only, never a mark. Two things are done to an OPEN
  // NOTE that carries a box, from its text without the box:
  //   (1) a line that is only the boxed value, or `<the asked symbol> = value` (the question's own answer label), is ticked as stating the answer, and so may be the answer line,
  //       when the answer was marked correct and the server's own answer check accepts that value;
  //   (2) any other line (a function value, an arithmetic sum, a derivative, another variable: `v(1) = [12]`, `3 + 4 = [12]`, `t = [12]`) is judged by the same proofs a plain line
  //       gets (the arithmetic check, the page passes): proved lines are ticked, a provably false line is crossed (never when an earlier line is crossed), anything undecidable stays a note.
  try {
    if (typeof steps === 'string' && /\\(?:boxed|fbox|mbox)\b|[(\[]\s*boxed\b|[⌈⎡▭□]/i.test(steps) && !OBJECTIVE.has(q.answerType) && q.answerType !== 'graph-sketch' && !Array.isArray(q.boardScheme) && !(opts && (opts.proved === false || opts.solutionMatch === false)) && (typeof q._bank === 'string' || /^gen:(?:y11|y12|me11|me12)-/.test(String(q.contentId ?? '')))) {
      const base = shownReport || report;
      if (base && Array.isArray(base.lines)) {
        const brk = base.lines.findIndex(l => l?.status === 'break');
        const asked = (/^([A-Za-z][A-Za-z0-9_']*(?:\([^()]*\))?)\s*=$/.exec(String(q.answerPrefix ?? '').trim()) || [])[1] || null;
        const squash = t => String(t ?? '').replace(/[.\s]+$/, '').replace(/\s+/g, ' ').trim();
        const bareOf = t => unboxed(t, q.answerType).replace(/^\s*(?:final\s+answer|answer|ans)\s*[:=\-–]\s*/i, '').replace(/[.\s]+$/, '');
        const boxed = base.lines.map((l, i) => !!l && (brk < 0 || i < brk) && openNote(l) && typeof l.text === 'string' && !!bareOf(l.text) && bareOf(l.text) !== squash(l.text) && !/[<>≤≥≠]/.test(bareOf(l.text)));
        const lines = base.lines.slice();
        const rest = [];
        let n = 0;
        base.lines.forEach((l, i) => {
          if (!boxed[i]) return;
          const bare = bareOf(l.text), sides = bare.replace(/^=\s*/, '').split('=').map(x => x.trim());
          if (!sides.every(Boolean)) return;
          const bareValue = sides.length === 1 && !/[A-Za-z]{4,}/.test(bare);
          const labelled = sides.length === 2 && asked !== null && sides[0].replace(/\s+/g, '') === asked;
          if ((bareValue || labelled) && result.correct === true && displayCtx.accepts(sides[sides.length - 1])) {
            n++; lines[i] = { text: l.text, status: 'ok', state: 'arithmetic', note: 'This line states the answer the check accepts.', valueChain: { rule: 'proved' }, fact: { kind: 'proved', proof: 'conclusion-matches' }, tickClass: 'conclusion-matches' };
          } else if (!bareValue && !labelled) rest.push(i);
        });
        if (rest.length) {
          // the same page with the boxes taken off those lines, read by the proofs a plain line gets; only those lines may change, and each keeps its own text
          const rawLines = steps.split('\n');
          const bareSteps = rawLines.map((t, k) => (rest.length && boxed[k] && rest.includes(k) ? bareOf(t) : t));
          const shadow = { ...base, lines: base.lines.map((l, k) => (rest.includes(k) ? { ...l, text: bareOf(l.text) } : l)) };
          let proved;
          try { proved = typeof q._bank === 'string' ? provedLinesBank(q, shadow) : provedLines(q, meta, shadow); } catch { proved = shadow; }
          let alt = null;
          try { alt = rawLines.length === base.lines.length ? trueAsWritten(q, bareSteps.join('\n'), opts) : null; } catch { alt = null; }
          let crossed = brk >= 0;
          for (const i of rest) {
            const a = proved.lines[i], b = alt && alt.lines && alt.lines.length === base.lines.length ? alt.lines[i] : null;
            const pick = a && a !== shadow.lines[i] && (a.status === 'ok' || a.status === 'break') ? a : b && (b.status === 'ok' || b.status === 'break') ? b : null;
            if (!pick) continue;
            if (pick.status === 'break') { if (crossed) continue; crossed = true; }
            else if (crossed && lines.slice(0, i).some(x => x?.status === 'break')) continue;
            n++; lines[i] = { ...pick, text: base.lines[i].text };
          }
        }
        if (n) shownReport = holdAmbiguous(withLines(base, lines));
      }
    }
  } catch { /* the report stands */ }
  try {
    if (typeof steps === 'string' && steps.trim() && !OBJECTIVE.has(q.answerType) && q.answerType !== 'graph-sketch' && !Array.isArray(q.boardScheme) && !(opts && (opts.proved === false || opts.solutionMatch === false)) && /^gen:(?:y11|y12|me11|me12)-/.test(String(q.contentId ?? ''))) {
      const base = shownReport || report;
      const more = base ? displayFields(q, base, displayCtx) : null;
      if (more && more !== base) shownReport = more;
    }
  } catch { /* the report stands */ }
  // The author's bank gets the second page pass (engine/pageProofs2.js) only: function values, implications, conditions, derivatives, the closed-interval extreme, check
  // lists and the labels of a sketch, each proved from the question's prompt. Display only, like the pass above: `stepReport` is not touched by it.
  try {
    if (typeof steps === 'string' && steps.trim() && !OBJECTIVE.has(q.answerType) && q.answerType !== 'graph-sketch' && !Array.isArray(q.boardScheme) && !(opts && (opts.proved === false || opts.solutionMatch === false)) && typeof q._bank === 'string') {
      const base = shownReport || report || trueAsWritten(q, steps, opts);
      const more = base ? provedLinesBank(q, base) : null;
      if (more && more !== base) shownReport = holdAmbiguous(more);
    }
  } catch { /* the report stands */ }
  // The author's bank gets the same fields (bankDisplayFields): a class id on every tick read from the proof that ticked it, and `answerLine`. Display only.
  try {
    if (typeof steps === 'string' && steps.trim() && !OBJECTIVE.has(q.answerType) && q.answerType !== 'graph-sketch' && !Array.isArray(q.boardScheme) && !(opts && (opts.proved === false || opts.solutionMatch === false)) && typeof q._bank === 'string') {
      const base = shownReport || report;
      const more = base ? bankDisplayFields(q, base, displayCtx) : null;
      if (more && more !== base) shownReport = more;
    }
  } catch { /* the report stands */ }
  // A question whose working the marker judged line by line to nothing (no line was arithmetic, none matched a step, none was crossed) used to come back
  // with no report at all. Where there are lines, the report is the one the arithmetic reading already made: every line a note, none ticked, none crossed. Display only.
  let noLineReport = null;
  try {
    const hasWorking = typeof steps === 'string' && steps.trim();
    if (!report && !shownReport) {
      if (!hasWorking) noLineReport = { reason: 'no-working' };
      else if (OBJECTIVE.has(q.answerType)) noLineReport = { reason: 'multiple-choice' };
      else if (q.answerType === 'graph-sketch') noLineReport = { reason: 'graph-sketch' };
      else if (Array.isArray(q.boardScheme)) noLineReport = { reason: 'board-scheme' };
      else if (opts && (opts.proved === false || opts.solutionMatch === false)) noLineReport = null;
      else {
        const unjudged = trueAsWritten(q, steps, opts);
        if (unjudged && Array.isArray(unjudged.lines) && unjudged.lines.length && !unjudged.lines.some(l => l?.status === 'ok' || l?.status === 'break')) shownReport = unjudged;
        else noLineReport = { reason: 'lines-not-readable' };
      }
    }
  } catch { /* the report stands */ }
  // A scheme question (schemeAward.js) also learns which lines the topic check ITSELF verified: the page ticks more than that (a copied
  // given, a rule statement, a true-as-written sum), and "writes a correct derivative" is earned only by a line the check found equal to it.
  // A step-mark question (stamped at issue) never credits a line that only says a thing equals itself (`1=1`, `x=x`): it reaches no key step, whatever the
  // step's value is. Applied here, to the report every pay reads; the lines the topic check verified are filtered the same way.
  if (q._methodScheme && report) report = holdIdentityLines(report);
  const topicTicks = q._methodScheme ? (decided ? decided.lines.flatMap((l, i) => (l?.status === 'ok' && !isIdentityLine(l.text) ? [i] : [])) : null) : undefined;
  // A question of the author's bank whose own worked step disagrees with its own answer (bankFaults.js) is never crossed on the page: a cross is shown as a note. After every mark.
  return { stepReport: holdFaultCrosses(q, report), ...(shownReport ? { shownReport: holdFaultCrosses(q, shownReport) } : {}), ...(noLineReport ? { noLineReport } : {}), partial, ...(board ? { board } : {}), ...(markingReport ? { markingReport } : {}), ...(topicTicks !== undefined ? { topicTicks } : {}) };
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
    if (meta && !blank(working)) { try { report = stepCheck(meta, String(working), stepOptions(q)); } catch { report = null; } }
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
    const report = stepCheck(meta, lines.join('\n'), stepOptions(q));
    const judged = report?.lines || [];
    // The engine's own misconception id for the break (audit D1), as a stable
    // id only — never free text — exactly as the device reads it (tutorWork).
    const code = report?.diagnosis?.code;
    if (typeof code === 'string' && /^[a-z0-9._:-]{1,80}$/i.test(code)) evidence.misconception = code;
    const at = judged.findIndex(line => line?.status === 'break');
    if (at >= 0 && at < lines.length) evidence.firstBreak = at;
    // The topic check places no break on a page of rewrites it cannot tie to the answer. The displayed report may still cross a line that
    // is provably not equal to the line above (engine/falseStep.js); that cross is the first break the diagnosis names. Never a mark.
    else if (at < 0) {
      try {
        const shown = stepEvidence(q, '', lines.join('\n'), { correct: false }, { slipWarnings: true }).stepReport;
        const cross = Array.isArray(shown?.lines) ? shown.lines.findIndex(line => line?.status === 'break' && line?.diagnosis?.code === 'false-continuation') : -1;
        if (cross >= 0 && cross < lines.length) evidence.firstBreak = cross;
      } catch { /* the checker's silence is not evidence */ }
    }
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
    const report = stepCheck(meta, list.join('\n'), stepOptions(q));
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
const RAW_MARKER_OPS = Object.freeze({
  /**
   * A practice submission: the answer, then (only when the reply could need
   * it) the working. `evidenceIfWrong` is the request thread's reading of
   * whether a wrong answer resolves the question; the handler re-decides that
   * under its transaction and asks again if it turns out to need evidence that
   * was not computed. Blank working costs nothing, so it is always "computed".
   */
  practice({ q, answer, working, workingLatex, workingGaps, evidenceIfWrong, policy }, emit) {
    const result = sketchReport(q, answer, checkBankAnswer(q, answer));   // an author-bank question is read as qbankMarking.js says; every other question is checkAnswer
    emit({ result });
    const wanted = result.correct || evidenceIfWrong || !String(working || '').trim();
    if (!wanted) return { result, evidence: null };
    const evidence = stepEvidence(q, answer, working, result, { slipWarnings: true, ...(Array.isArray(workingGaps) ? { gaps: workingGaps } : {}), ...(Array.isArray(workingLatex) ? { latex: workingLatex } : {}) });
    // Final answer only: the step report stays, the method mark does not.
    return { result, evidence: policyOf({ policy }).methodMarks ? evidence : { stepReport: evidence.stepReport, ...(evidence.shownReport ? { shownReport: evidence.shownReport } : {}), ...(evidence.noLineReport ? { noLineReport: evidence.noLineReport } : {}), partial: null, ...(evidence.board ? { board: evidence.board } : {}), ...(evidence.topicTicks !== undefined ? { topicTicks: evidence.topicTicks } : {}) } };
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
  },
  /** A worked-solution question's note on the student's own lines (feedback only: the question has no key, so there is no mark to give). */
  worked({ q, lines }) {
    return workedEvidence(q, lines);
  }
});

/** The operations the marker pool runs: each is handed the marker's view of the question (markerView). */
export const MARKER_OPS = Object.freeze(Object.fromEntries(Object.entries(RAW_MARKER_OPS).map(([name, run]) => [name, (args, emit) => run(args && args.q ? { ...args, q: markerView(args.q) } : args, emit)])));

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
    try { judged = stepCheck(meta, open.join('\n'), stepOptions(q))?.lines || []; } catch { return allFinal(); }
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

/**
 * The deterministic step report on the lines a student wrote for a WORKED-SOLUTION question (answerType 'manual': no key, so nothing is marked and
 * no final answer is looked for). Feedback only: how many of the first lines hold, and the first line that does not follow, if one. A report that
 * did not run, or judged nothing, says nothing (`judged: false`): the checker's silence is not evidence.
 */
export function workedEvidence(q, lines) {
  const silent = { judged: false, verified: 0, firstBreak: -1 };
  const list = (Array.isArray(lines) ? lines : []).map(line => String(line ?? '').trim()).filter(Boolean).slice(0, 40);
  if (!q || typeof q !== 'object' || q.answerType !== 'manual' || !list.length) return silent;
  try {
    const report = stepEvidence(q, '', list.join('\n'), { correct: false })?.stepReport;
    const judged = Array.isArray(report?.lines) ? report.lines : [];
    if (!judged.length || judged.length > list.length + 2) return silent;
    let verified = 0;
    while (verified < list.length && judged[verified]?.status === 'ok') verified += 1;
    const at = judged.findIndex(line => line?.status === 'break');
    return { judged: judged.some(line => line?.status === 'ok' || line?.status === 'break'), verified, firstBreak: at >= 0 && at < list.length ? at : -1 };
  } catch { return silent; }
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

/**
 * The sentence a resolved wrong answer carries INSTEAD of an authored trap for the typed value, or null. An authored trap says why a student
 * would write that value ("the sine is 1"); when the page has verified lines and then a crossed line, the crossed line's own message is what
 * is said, because the trap would otherwise contradict correct working the student wrote (sin(5π/6) = 1/2, then a wrong sum). A multiple-choice
 * explanation, an answer that is right, an invalid entry and a page with no verified line before its first cross keep the marker's own text.
 */
export function lineLevelFeedback(stepReport, { resolved, invalid, correct, optionWhy } = {}) {
  if (!resolved || invalid || correct || optionWhy || !Array.isArray(stepReport?.lines)) return null;
  const at = stepReport.lines.findIndex(l => l?.status === 'break' && typeof l.note === 'string' && l.note.trim());
  if (at < 1 || !stepReport.lines.slice(0, at).some(l => l?.status === 'ok')) return null;
  return stepReport.lines[at].note.trim().slice(0, 3000);
}
