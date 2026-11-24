// Pri Learning · ONE generic rule for step marks, drawn from the question's own authored worked solution (DRAFT: pays nothing until approved)
//
// R4 (marking authority). Per-type schemes (schemeAward.js SCHEMES) cover a few question shapes. This module is the generic rule the author may
// approve ONCE, under its own approval id (`generic-solution-steps`), with its own digest over THIS FILE (the rule's code and wording).
// Nothing here pays until: the author's record at the current digest exists, PRI_METHOD_MARKS=on, Prithagoras, and the question was stamped
// at issue (editionBanks.sealForEdition). A question whose type has an approved per-type scheme (at its marks) keeps that scheme.
//
// THE RULE, for a question worth N >= 2 marks:
//   · a correct final answer earns N, as it always did. Working never earns the final-answer mark.
//   · a wrong or missing final answer earns at most N - 1: one mark per KEY STEP of the authored solution that a line of the working reaches.
//   · KEY STEPS. The authored solution's steps (headed Check, Note or Bonus excluded) are `steps`. The LAST step is the one that states the answer
//     and is never a key step. Of the steps before it a step is a CANDIDATE when it is real progress (below) and the engine can read it
//     (self-test below). Key steps are the LAST N - 1 DISTINCT candidates, in solution order. Why the last: the earlier steps of a worked
//     solution are mostly set-up (restating the function, naming a rule), the later ones are the results a student must actually derive, and
//     the typical slip is near the end, so the steps a student with a slip still reaches are exactly the ones the marks sit on. Why a fixed
//     list: every mark has a named step the author can read and the student can see in the criteria table. Fewer than N - 1 candidates: the
//     question pays one mark per candidate (u of them) and the answer criterion carries the other N - u marks; none: it pays nothing.
//   · REAL PROGRESS (a step is a candidate only if it has at least one such result): a result that is not the question's own statement or
//     expression, not a number the question gives, not the same as the answer step's result, and (for a step written as a result) not empty.
//   · SELF-TEST (the engine must be able to read the step): the authored step's own lines, fed to the same step check as a student's working,
//     must be ticked and recognised as that step. A step the engine cannot tick when written by the author cannot be paid.
//   · A LINE REACHES a key step when ALL hold: the DETERMINISTIC step report ticks it (status ok; never the model-assisted displayed report;
//     not a copied given, not carried forward after a slip); it comes BEFORE the first crossed line; it is the statement or value of one of
//     the step's results, by the existing solutionMatch logic (the report's own `solution-step` tick, or matchEquation) ; and it is not a
//     restatement of the question or of a given number. One line pays one step; one step is paid once.
//   · BARE VALUES. A correct intermediate value with nothing written before it IS evidence of the step that produces it, in an examination.
//     PARAMETERS.BARE_VALUE_EVIDENCE = true says so: a value the report ticks as the value at a step (a bare number, or `= value` under a line)
//     counts for that step only when the step has a numeric result, in order as solutionMatch already requires, and the value is not a given.
//     A step whose results are expressions (an equation, a derivative, an antiderivative) is never reached by a number.
//
// Pure and deterministic: no model, no network, no clock.
import crypto from 'node:crypto';
import fs from 'node:fs';
import { _internals, _forChains } from '../../client/src/engine/solutionMatch.js';
import { withEvaluationBudget, evaluate } from '../../client/src/engine/expr.js';
import { stepEvidence, marksPossibleFor, isSchemeStep } from './markerOps.js';

export const GENERIC_ID = 'generic-solution-steps';
export const GENERIC_TITLE = 'Step marks drawn from the authored worked solution (generic rule)';
/** The choices the author can see, in the packet. Changing one changes the digest and so revokes an approval. */
export const PARAMETERS = Object.freeze({
  /** A correct intermediate value with no line before it is evidence of the step that produces it (see the header). */
  BARE_VALUE_EVIDENCE: true,
  /** A wrong or missing final answer earns at most this many marks fewer than the question's marks. */
  WRONG_ANSWER_CAP_BELOW_FULL: 1,
  /** Key steps are the last N - 1 distinct candidates before the answer step. */
  KEY_STEP_CHOICE: 'last N-1 distinct non-trivial results before the answer step',
  /** The least marks a question must be worth for the rule to apply. */
  MIN_MARKS: 2
});
export const GENERIC_WORDING = Object.freeze({
  answer: 'Gives the final answer correctly, in the form the question asks.',
  earned: 'Line {n} is ticked and gives this result.',
  noLine: 'No ticked line before the first crossed line (line {n}) reached it.',
  unverified: 'Pri could not verify a line for this criterion.',
  answerRight: 'The final answer is correct, so this criterion is met.',
  answerWrong: 'The final answer was not correct.',
  note: '{n} of {N} marks for the steps of the worked solution your ticked lines reached: the final answer was not right.',
  none: 'No method marks: no step of the worked solution was reached by a ticked line.'
});

const canonText = v => (Array.isArray(v) ? `[${v.map(canonText).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonText(v[k])}`).join(',')}}` : JSON.stringify(v ?? null));
let digestMemo = null;
/** The digest the author signs: the rule's id, title, wording, parameters and THE SOURCE OF THIS FILE (LF-normalised). Any edit revokes an approval. */
export function genericDigest() {
  if (digestMemo) return digestMemo;
  const source = fs.readFileSync(new URL(import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  digestMemo = crypto.createHash('sha256').update(canonText({ id: GENERIC_ID, title: GENERIC_TITLE, wording: GENERIC_WORDING, parameters: PARAMETERS, source })).digest('hex');
  return digestMemo;
}

const OBJECTIVE = new Set(['mcq', 'multi-mcq', 'matrix-match']);
/** Structural eligibility, decided at issue and cheap: a written question worth at least MIN_MARKS with at least two authored steps. */
export function genericEligible(q) {
  try {
    if (!q || OBJECTIVE.has(q.answerType) || q.answerType === 'graph-sketch' || Array.isArray(q.boardScheme)) return false;
    return marksPossibleFor(q) >= PARAMETERS.MIN_MARKS && (q.steps || []).filter(isSchemeStep).length >= 2;
  } catch { return false; }
}

// ── reading the authored solution ───────────────────────────────────────────────────────────────────────────────────────────
const { readSolution, readStudent, matchEquation, spanToPlain, conditionOf } = _internals;
const { canon, statementsOfSpans, numericOf, labelOf } = _forChains;
const close = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
const BUDGET = 150000;

/** The lines of the authored solution as a student would write them: [{ text, step }] (step = index in q.steps). */
export function authoredLines(q) {
  const out = [];
  (q.steps || []).forEach((st, i) => {
    if (!isSchemeStep(st)) return;
    for (const m of String(st?.d ?? '').replace(/\\\$/g, '\u0001').matchAll(/\$([^$]+)\$/g)) {
      const tex = m[1].replace(/\\(?:approx|simeq)/g, '=');
      for (const piece of tex.split(/\\Rightarrow|\\implies|\\therefore|\\text\{\s*(?:or|and)\s*\}/)) {
        let p = null;
        try { p = spanToPlain(piece); } catch { p = null; }
        p = p && p.replace(/\s+/g, ' ').trim();
        if (p) out.push({ text: p, step: i });
      }
    }
  });
  return out;
}

const plainOf = s => String(s ?? '').replace(/\$/g, '').replace(/\\(?:Rightarrow|implies|therefore)/g, ' so ').replace(/\\[a-z]+/g, '').replace(/[{}]/g, '').replace(/\s+/g, ' ').trim();
// 5,000 is five thousand: thousands separators are removed before numbers are read
const numbersIn = text => (String(text ?? '').replace(/(\d),(?=\d{3}(?!\d))/g, '$1').match(/\d+(?:\.\d+)?/g) || []).map(Number);
/** Every number the question or its authored solution contains: the only numbers a value may be computed from. */
const sourceNumbersOf = q => new Set([...numbersIn(q?.prompt), ...(q?.steps || []).flatMap(st => numbersIn(`${st?.d ?? ''}`.replace(/\\[a-zA-Z]+/g, ' ')))]);
const promptNumbersOf = q => new Set(numbersIn(q?.prompt));
const givenNumber = (v, nums) => Number.isFinite(v) && [...nums].some(n => close(n, Math.abs(v)));
function promptCanons(q) {
  const out = new Set();
  for (const s of statementsOfSpans(q?.prompt)) { for (const p of s.parts) out.add(canon(p)); out.add(canon(s.plain)); }
  return out;
}


/**
 * An equation counts as a RESULT (an authored step) or as a statement of one (a student's line) only when the engine's equivalence test is
 * decisive on it. The test compares f = left - right at sample points to a tolerance scaled to the terms; where one side dwarfs the other (9^(3x-6) =
 * 27^(3x+5): 3^(6x-12) is 1e-13 of 3^(9x+15)) a different equation passes it, and where the sides cancel to zero everywhere (an identity) every
 * equation passes it. So an equation is decisive here only if, at five of nine sample points, neither side is below a millionth of the other
 * (a side exactly zero is fine), and it is not an identity (f is not zero at all of them).
 */
const SAMPLE = [0.61, -1.07, 0.37, 1.9, -0.43, 2.3, -1.6, 0.83, -2.1];
function decisive(cond) {
  if (!cond || !cond.vars || !cond.vars.length) return false;
  let good = 0, nonzero = 0;
  for (let j = 0; j < SAMPLE.length; j++) {
    const env = Object.fromEntries(cond.vars.map((v, k) => [v, SAMPLE[(j + 3 * k) % SAMPLE.length]]));
    let a, b;
    try {
      a = cond.l.value !== undefined ? cond.l.value : evaluate(cond.l.ast, env);
      b = cond.r.value !== undefined ? cond.r.value : evaluate(cond.r.ast, env);
    } catch { continue; }
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    const hi = Math.max(Math.abs(a), Math.abs(b)), lo = Math.min(Math.abs(a), Math.abs(b));
    if (hi === 0 || lo === 0 || lo >= 1e-6 * hi) good++;
    if (Math.abs(a - b) > 1e-9 * Math.max(1, hi)) nonzero++;
  }
  return good >= 5 && nonzero >= 1;
}

/**
 * The context of one question: what the authored solution says (per step), what the prompt gives, and which entries are real progress.
 * entry = { step, kind: 'label' | 'cond' | 'num', st (the solutionMatch record), valueNumeric, progress }
 */
function contextOf(q) {
  _forChains.setFunctions(q);
  const sol = readSolution(q);
  const nums = promptNumbersOf(q);
  const pc = promptCanons(q);
  const keys = (q.steps || []).map((s, i) => (isSchemeStep(s) ? i : -1)).filter(i => i >= 0);
  const answerStep = keys.length ? keys[keys.length - 1] : -1;
  // what the answer step states: an entry of an earlier step that says the same is the answer, not progress
  const ansLasts = new Set(), ansVals = [];
  for (const l of sol.labelled) if (l.step === answerStep) { ansLasts.add(canon(l.last)); if (l.info && (l.info.vars || []).length === 0 && Number.isFinite(l.info.value)) ansVals.push(l.info.value); }
  for (const v of sol.values) if (v.step === answerStep) ansVals.push(v.v);
  const isAnswerValue = v => ansVals.some(a => close(a, v));
  const entries = [];
  for (const l of sol.labelled) {
    const numeric = !!l.info && (l.info.vars || []).length === 0 && Number.isFinite(l.info.value);
    const given = numeric ? givenNumber(l.info.value, nums) : pc.has(canon(l.last));
    const isAns = l.step !== answerStep && (numeric ? isAnswerValue(l.info.value) : ansLasts.has(canon(l.last)));
    entries.push({ step: l.step, kind: 'label', st: l, numeric, progress: !given && !isAns });
  }
  for (const c of sol.conditions) {
    const given = pc.has(canon(c.cond.rawL)) && pc.has(canon(c.cond.rawR));
    entries.push({ step: c.step, kind: 'cond', st: c, numeric: false, progress: !given && decisive(c.cond) });
  }
  for (const n of sol.numeric) {
    const vals = n.parts.map(numericOf);
    const given = vals.every(v => givenNumber(v, nums));
    const isAns = n.step !== answerStep && vals.some(v => v !== null && isAnswerValue(v));
    entries.push({ step: n.step, kind: 'num', st: n, numeric: true, progress: !given && !isAns });
  }
  // the numeric value entries at a step (a bare value the solution reaches), for a value tick of the report
  const values = sol.values.map(v => ({ step: v.step, v: v.v, progress: !givenNumber(v.v, nums) && (v.step === answerStep || !isAnswerValue(v.v)) }));
  const opsByStep = new Map();
  for (const n of sol.numeric) opsByStep.set(n.step, [...(opsByStep.get(n.step) || []), `${opsKey(n.parts[0])}|${numbersIn(n.parts[0]).sort((a, b) => a - b).join(',')}`]);
  return { sol, nums, pc, keys, answerStep, entries, values, opsByStep, source: sourceNumbersOf(q) };
}

/** The steps a ticked line reaches, as a Set of step indices of q.steps. Entry-level real-progress rules apply here. */
function stepsReached(line, ctx) {
  const reached = new Set();
  const text = String(line?.text ?? '');
  const fact = line?.fact;
  const s = readStudent(text);
  // a copy of the question: every side the question's own, or a labelled line (y = ..., f(x) = ...) whose right-hand side is the question's own expression
  if (s && !s.multi && s.parts.length >= 1 && (s.parts.every(p => ctx.pc.has(canon(p))) || (s.parts.length >= 2 && labelOf(s.parts[0]) && ctx.pc.has(canon(s.parts[s.parts.length - 1]))))) return reached;
  const stepOk = i => ctx.keys.includes(i) && i !== ctx.answerStep;
  // A line written as a statement (an equation or a chain) is decided by the statement itself: the solutionMatch matcher names the authored result
  // it says, and that result must be real progress (a line that says what the question gives, or what the answer step says, reaches nothing).
  const groups = s && !s.ctx ? (s.multi ? s.multi : (s.parts.length >= 2 && !s.continuation ? [s.parts] : [])) : [];
  let statement = false;
  for (const parts of groups) {
    if (parts.length < 2) continue;
    statement = true;
    let hit = null;
    try { hit = matchEquation(parts, ctx.sol, null); } catch { hit = null; }
    if (!hit || !stepOk(hit.step)) continue;
    const entry = ctx.entries.find(e => e.st === hit);
    if (!entry || !entry.progress) continue;
    if (entry.kind === 'cond') { let own = null; try { own = conditionOf(parts); } catch { own = null; } if (!decisive(own)) continue; }
    if (!entry.numeric || (computedFromSource(parts, ctx) && sameComputation(parts, hit.step, ctx))) reached.add(hit.step);
  }
  // A line that is not such a statement (a bare value, `= value` under the line above, a chain continuation) is the report's own tick of a step.
  if (!statement && fact && fact.kind === 'solution-step' && Number.isInteger(fact.step)) {
    const i = fact.step - 1;
    if (stepOk(i)) {
      if (!fact.valueOnly) {
        if (ctx.entries.some(e => e.step === i && e.progress)) reached.add(i);
      } else if (PARAMETERS.BARE_VALUE_EVIDENCE && s && !s.multi && !s.ctx) {
        const vals = s.parts.map(numericOf);
        const v = vals.every(x => x !== null) && vals.every(x => close(x, vals[0])) ? vals[0] : null;
        if (v !== null && computedFromSource(s.parts, ctx) && sameComputation(s.parts, i, ctx) && ctx.values.some(e => e.step === i && e.progress && close(e.v, v))) reached.add(i);
      }
    }
  }
  return reached;
}

/**
 * PROVENANCE of a value. A line that only comes to a value (an arithmetic line, a bare value, `expr = value`) counts for a numeric result only when
 * every number it computes from, the numbers before its last `=`, is a number of the question or of its authored solution. `2 + 2 = 4` reaches
 * a step whose value is 4 only if the question or the solution has a 2 in it. A label on the left (k = ...) is not a number it computes from.
 */
const FUNCTION_WORDS = /\b(?:sqrt|ln|log|sin|cos|tan|exp)\b/g;
/** The operations a computation uses, as one sorted string: '+', '-' (binary), '*', '/', '^' and function names. A bare number or a label uses none. */
function opsKey(expr) {
  const t = String(expr ?? '').replace(/[−–—]/g, '-').replace(/[×·]/g, '*').replace(/÷/g, '/');
  const ops = new Set();
  if (/[\d)a-z]\s*\+/i.test(t)) ops.add('+');
  if (/[\d)a-z]\s*-/i.test(t)) ops.add('-');
  if (/\*/.test(t)) ops.add('*');
  if (/\//.test(t)) ops.add('/');
  if (/\^/.test(t)) ops.add('^');
  for (const f of t.match(FUNCTION_WORDS) || []) ops.add(f);
  return [...ops].sort().join('');
}
/**
 * SAME COMPUTATION. Where the authored step states a computation (10/2 = 5, 2^2 = 4), a line that only comes to the same value counts for it only if
 * it uses the same operations on the same numbers: `2 + 2 = 4` is not the step `2^2 = 4`, and `9 / 3 = 3` is not `27 / 9 = 3`. A step that states only a value (k = 7) accepts any computation from source numbers.
 */
function sameComputation(parts, step, ctx) {
  const have = ctx.opsByStep.get(step);
  if (!have || !have.length) return true;
  const body = parts.slice(0, -1).filter((p, i) => !(i === 0 && labelOf(p)));
  const key = body.map(opsKey).join('');
  if (key === '') return true;
  // the same operations on the same numbers, in any order (5000 x 7 and 7 x 5000), as some computation the authored step states
  const sig = `${key}|${body.flatMap(numbersIn).sort((a, b) => a - b).join(',')}`;
  return have.includes(sig);
}

function computedFromSource(parts, ctx) {
  const body = parts.slice(0, -1).filter((p, i) => !(i === 0 && labelOf(p)));
  const nums = body.flatMap(numbersIn);
  return nums.every(n => [...ctx.source].some(a => close(a, n)));
}

const ticked = l => l?.status === 'ok' && l.ecf !== true && l.given !== true && l.state !== 'given' && l.restates !== true;

/** For each ticked line before the limit, the steps it reaches. Lines that reach nothing are absent. */
function reachMap(lines, limit, ctx) {
  const map = new Map();
  for (let j = 0; j < limit; j++) {
    const l = lines[j];
    if (!ticked(l)) continue;
    const r = stepsReached(l, ctx);
    if (r.size) map.set(j, r);
  }
  return map;
}

/** One distinct line per key step, earliest lines first (augmenting paths): returns Map(step -> line index). */
function assign(keySteps, map) {
  const lineOf = new Map(); const stepOfLine = new Map();
  const tryStep = (step, seen) => {
    for (const [j, r] of map) {
      if (!r.has(step) || seen.has(j)) continue;
      seen.add(j);
      const holder = stepOfLine.get(j);
      if (holder === undefined || tryStep(holder, seen)) { stepOfLine.set(j, step); lineOf.set(step, j); return true; }
    }
    return false;
  };
  for (const step of keySteps) tryStep(step, new Set());
  return lineOf;
}

// ── the plan: which steps are key steps for this question ──────────────────────────────────────────────────────────────────
const planMemo = new Map();
const keyOf = q => JSON.stringify([q?.prompt, (q?.steps || []).map(s => [s?.h, s?.d]), q?.difficulty, q?.answerType]);

/**
 * { marks N, keySteps: [{ step, number, heading, text }], usable } for a question the rule can pay, or { ..., keySteps: [] , why } when it cannot.
 * Pure of the student's work: it depends on the question and its authored solution alone.
 */
export function genericPlan(q) {
  if (!genericEligible(q)) return { marks: 0, keySteps: [], why: 'not-eligible' };
  const k = keyOf(q);
  if (planMemo.has(k)) return planMemo.get(k);
  const plan = buildPlan(q);
  if (planMemo.size > 400) planMemo.clear();
  planMemo.set(k, plan);
  return plan;
}

function buildPlan(q) {
  const N = marksPossibleFor(q);
  const result = why => ({ marks: N, keySteps: [], why });
  let out;
  try {
    out = withEvaluationBudget(BUDGET, () => {
      const ctx = contextOf(q);
      const lines = authoredLines(q).slice(0, 20);
      if (!lines.length) return result('no-lines');
      // SELF-TEST: the authored lines, as a student's working with no final answer, through the same evidence path the server runs
      const ev = stepEvidence(q, '', lines.map(l => l.text).join('\n'), { correct: false }, { slipWarnings: true });
      const rep = ev.stepReport;
      if (!rep || !Array.isArray(rep.lines) || rep.lines.length !== lines.length) return result('authored-working-not-read');
      const cross = rep.lines.findIndex(l => l?.status === 'break');
      const limit = cross < 0 ? rep.lines.length : cross;
      const map = reachMap(rep.lines, limit, ctx);
      // candidates: steps before the answer step with a progress entry, that an authored line of THAT step was ticked as
      const candidates = [];
      const seenSig = new Set();
      for (const i of ctx.keys) {
        if (i === ctx.answerStep) continue;
        const own = [...map].filter(([j, r]) => lines[j].step === i && r.has(i));
        if (!own.length) continue;
        const sig = ctx.entries.filter(e => e.step === i && e.progress).map(e => (e.numeric && e.st.info ? `n${e.st.info.value}` : e.kind === 'cond' ? `c${canon(e.st.cond.rawL)}|${canon(e.st.cond.rawR)}` : `l${canon(e.st.last ?? e.st.parts?.join('=') ?? '')}`)).sort().join(';');
        if (seenSig.has(sig)) continue;                         // distinct results only
        seenSig.add(sig);
        candidates.push(i);
      }
      const chosen = candidates.slice(-(N - Math.max(1, PARAMETERS.WRONG_ANSWER_CAP_BELOW_FULL)));
      if (!chosen.length) return result('no-usable-step');
      const keySteps = chosen.map((i, n) => {
        const st = q.steps[i];
        const maths = authoredLines(q).filter(l => l.step === i).map(l => l.text).join('; ').slice(0, 160);
        const heading = plainOf(st?.h);
        // the step's own words; its expression too when it is short enough to read in a table
        return { step: i, number: i + 1, heading, text: `Step ${i + 1} of the worked solution${heading ? ` (${heading})` : ''}${maths && maths.length <= 70 ? `: ${maths}` : ''}`.slice(0, 230) };
      });
      return { marks: N, keySteps, usable: candidates.length };
    });
  } catch { out = result('error'); }
  return out;
}

// ── the award ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * Award the generic rule from the deterministic step report. Returns { items, total, possible, cross, plan } like awardScheme, or null when the
 * rule cannot pay this question. items: the key steps (1 mark each, by line) then the answer criterion (the rest of the marks, by the answer).
 */
export function awardGeneric(q, report, correct) {
  const plan = genericPlan(q);
  if (!plan.keySteps.length) return null;
  const N = plan.marks;
  const lines = Array.isArray(report?.lines) ? report.lines : [];
  const cross = lines.findIndex(l => l?.status === 'break');
  const limit = cross < 0 ? lines.length : cross;
  let lineOf = new Map();
  try {
    withEvaluationBudget(BUDGET, () => {
      const ctx = contextOf(q);
      lineOf = assign(plan.keySteps.map(k => k.step), reachMap(lines, Math.min(limit, 40), ctx));
    });
  } catch { lineOf = new Map(); }
  const fmt = (t, o) => t.replace(/\{(\w+)\}/g, (_, k) => String(o[k]));
  const items = plan.keySteps.map(k => {
    const base = { key: `step-${k.number}`, text: k.text, marks: 1 };
    const at = lineOf.has(k.step) ? lineOf.get(k.step) : -1;
    if (correct === true) return { ...base, awarded: true, verified: true, lines: at >= 0 ? [at + 1] : [], basis: at >= 0 ? 'lines' : 'answer', reason: at >= 0 ? fmt(GENERIC_WORDING.earned, { n: at + 1 }) : GENERIC_WORDING.answerRight };
    if (at >= 0) return { ...base, awarded: true, verified: true, lines: [at + 1], basis: 'lines', reason: fmt(GENERIC_WORDING.earned, { n: at + 1 }) };
    return cross >= 0
      ? { ...base, awarded: false, verified: true, lines: [], basis: 'lines', reason: fmt(GENERIC_WORDING.noLine, { n: cross + 1 }) }
      : { ...base, awarded: false, verified: false, lines: [], basis: 'lines', reason: GENERIC_WORDING.unverified };
  });
  const answerMarks = N - plan.keySteps.length;
  items.push({ key: 'answer', text: GENERIC_WORDING.answer, marks: answerMarks, awarded: correct === true, verified: true, lines: [], basis: 'answer', reason: correct === true ? GENERIC_WORDING.answerRight : GENERIC_WORDING.answerWrong });
  const total = items.reduce((n, i) => n + (i.awarded ? i.marks : 0), 0);
  return { items, total, possible: N, cross, plan };
}
