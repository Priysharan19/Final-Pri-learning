// Pri Learning — naming the kind of slip, deterministically.
//
// Two things a tutor says that the engine can work out from data it holds:
//   1. How a wrong number relates to the answer: the right size with the
//      wrong sign, upside down, out by a power of ten, the complement of a
//      probability, squared or square-rooted, or the value of an earlier step
//      of the method ("stopped one step early").
//   2. Which term changed between the last good line and the broken one.
//
// While the attempt is open the feedback names the KIND of slip only, never
// a value of the answer. `slipReason` (for after the attempt is resolved)
// may name the answer, because by then it is shown anyway.
import { parse, normalize, evaluate, exprEquivalent } from './expr.js';
import { milestonesOf } from './milestones.js';

const close = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

/** The numeric results of the worked solution's earlier steps (not the answer). */
function stepValues(q, answer) {
  const out = [];
  for (const m of milestonesOf(q)) {
    const v = m.values[m.values.length - 1];
    try { const n = evaluate(parse(normalize(v)), {}); if (Number.isFinite(n) && !close(n, answer)) out.push(n); } catch { /* not a number */ }
  }
  return out;
}

/** A probability question: said so by its key, its topic or its prompt. */
export function isProbability(q) {
  if (!q) return false;
  if (q.answer?.probability === true) return true;
  const where = `${q.subtopic || ''} ${q.generator || ''} ${q.topic || ''}`;
  if (/probab/i.test(where)) return true;
  return /\b(probability|chance that|likelihood)\b/i.test(String(q.prompt || ''));
}

/**
 * The kind of slip that turns `answer` into `value`, or null. Kinds:
 * 'early-step', 'sign', 'reciprocal', 'power-of-ten', 'complement',
 * 'square', 'root'. A value that fits two kinds equally gets the first.
 */
export function classifySlip(value, answer, q = null) {
  const v = Number(value), a = Number(answer);
  if (!Number.isFinite(v) || !Number.isFinite(a) || close(v, a)) return null;
  // A number the question prints is most simply a copied number, and a value
  // that is the answer times a printed number is most simply "×k": neither is
  // a sign, reciprocal, power or root slip. Say nothing then.
  const printed = printedNumbers(q);
  if (printed.some(n => close(n, v))) return null;
  const timesPrinted = a !== 0 && printed.some(k => Math.abs(k) !== 1 && (close(v, a * k) || close(v, a / k)));
  const kinds = [];
  if (q && stepValues(q, a).some(s => close(s, v))) kinds.push('early-step');
  if (a !== 0 && close(v, -a)) kinds.push('sign');
  if (!timesPrinted && a !== 0 && Math.abs(a) !== 1 && close(v, 1 / a)) kinds.push('reciprocal');
  if (!timesPrinted && a !== 0 && [1, 2, 3].some(n => close(v, a * 10 ** n) || close(v, a / 10 ** n))) kinds.push('power-of-ten');
  // Only a probability has a complement.
  if (a > 0 && a < 1 && a !== 0.5 && close(v, 1 - a) && isProbability(q)) kinds.push('complement');
  // Squared or rooted only on a question about powers, roots or area, and
  // only where doubling, halving or off-by-one do not give the same number.
  const simpler = close(v, 2 * a) || close(v, a / 2) || close(v, a + 1) || close(v, a - 1) || timesPrinted;
  if (!simpler && involvesPowers(q) && Math.abs(a) > 1e-9 && Math.abs(a) !== 1 && close(v, a * a)) kinds.push('square');
  if (!simpler && involvesPowers(q) && a > 0 && a !== 1 && close(v, Math.sqrt(a))) kinds.push('root');
  // Two explanations fit: claim neither.
  return kinds.length === 1 ? kinds[0] : null;
}

/** The numbers a question prints (its prompt), TeX fractions included. */
export function printedNumbers(q) {
  const text = String(q?.prompt ?? '');
  const out = [];
  for (const m of text.matchAll(/\\d?frac\{(-?\d+(?:\.\d+)?)\}\{(-?\d+(?:\.\d+)?)\}/g)) out.push(Number(m[1]) / Number(m[2]));
  for (const m of text.replace(/,(?=\d{3}\b)/g, '').matchAll(/-?\d+(?:\.\d+)?/g)) out.push(Number(m[0]));
  return out.filter(Number.isFinite);
}

/** A question about powers, roots or area: said so by its prompt, steps or topic. */
export function involvesPowers(q) {
  if (!q) return false;
  const text = [q.prompt, q.subtopic, q.generator, ...(Array.isArray(q.steps) ? q.steps.map(s => `${s?.h ?? ''} ${s?.d ?? ''}`) : [])].join(' ');
  return /\^|\\sqrt|√|²|³|squar|root|area|pythag|hypotenuse|surd|power|exponent|indices/i.test(text);
}

/** Open attempt: the kind, never a value. */
export const SLIP_FEEDBACK = Object.freeze({
  'early-step': 'That is the value of an earlier step of the method — you may have stopped one step early.',
  sign: 'Right size, wrong sign — check the step where a minus sign was handled.',
  reciprocal: 'Your answer is upside down — check which quantity goes on top.',
  'power-of-ten': 'Right digits, but out by a power of 10 — check the units or the decimal point.',
  complement: 'That is the chance it does not happen — check which event the question asks about.',
  square: 'That looks like the square of the answer — check whether a square root was missed.',
  root: 'That looks like the square root of the answer — check whether something should have been squared.'
});

export function slipFeedback(value, answer, q = null) {
  const kind = classifySlip(value, answer, q);
  return kind ? { kind, feedback: SLIP_FEEDBACK[kind] } : null;
}

/** After resolution: why the student's value is not the answer, naming both. */
export function slipReason(value, answer, answerText, q = null) {
  const kind = classifySlip(value, answer, q);
  if (!kind) return null;
  const A = String(answerText ?? answer);
  const said = {
    'early-step': `your value is the result of an earlier step; one more step gives ${A}`,
    sign: `your value has the opposite sign to ${A}`,
    reciprocal: `your value is the reciprocal of ${A}`,
    'power-of-ten': `your value is ${A} out by a power of 10`,
    complement: `your value is 1 − ${A}, the chance of the other outcome`,
    square: `your value is the square of ${A}`,
    root: `your value is the square root of ${A}`
  }[kind];
  return { kind, reason: said };
}

// ── What changed between two lines ─────────────────────────────────────────
/** Split one side into signed top-level terms, by its text. */
function termsOf(side) {
  const s = String(side).replace(/\s+/g, '').replace(/[−–]/g, '-');
  const out = [];
  let depth = 0, start = 0, sign = 1;
  if (s.startsWith('+')) start = 1;
  else if (s.startsWith('-')) { sign = -1; start = 1; }
  for (let i = start; i < s.length; i += 1) {
    const c = s[i];
    if (c === '(' || c === '[' || c === '{') depth += 1;
    else if (c === ')' || c === ']' || c === '}') depth -= 1;
    else if (depth === 0 && (c === '+' || c === '-') && i > start && !/[*/^(]/.test(s[i - 1]) && !(/[eE]/.test(s[i - 1]) && /\d/.test(s[i - 2] || ''))) {
      out.push({ sign, text: s.slice(start, i) });
      sign = c === '-' ? -1 : 1; start = i + 1;
    }
  }
  out.push({ sign, text: s.slice(start) });
  return out.filter(t => t.text);
}
const shown = t => `${t.sign < 0 ? '−' : '+'}${t.text}`;
const sameTerm = (x, y) => { try { return exprEquivalent(x.text, y.text, {}); } catch { return false; } };

/** Unmatched terms of `a` against `b` (each term of b matched at most once, same sign). */
function unmatched(a, b) {
  const left = [...b];
  const out = [];
  for (const t of a) {
    const i = left.findIndex(u => u.sign === t.sign && sameTerm(t, u));
    if (i >= 0) left.splice(i, 1); else out.push(t);
  }
  return out;
}

/**
 * The single term that changed between a good line and a broken one, as a
 * sentence about the student's own lines, or null when it is not exactly one
 * term (then nothing new is said). Lines are equations or expressions.
 */
export function changedTerm(goodLine, brokenLine) {
  const split = s => String(s ?? '').split(/(?<![<>!])=(?!=)/);
  const g = split(goodLine), b = split(brokenLine);
  if (g.length !== b.length || g.length > 2 || String(goodLine).length > 160 || String(brokenLine).length > 160) return null;
  const sides = g.length === 2 ? ['left', 'right'] : [null];
  const changes = [];
  for (let k = 0; k < g.length; k += 1) {
    let tg, tb;
    try { tg = termsOf(g[k]); tb = termsOf(b[k]); for (const t of [...tg, ...tb]) parse(normalize(t.text)); } catch { return null; }
    const gone = unmatched(tg, tb), came = unmatched(tb, tg);
    if (gone.length || came.length) changes.push({ side: sides[k], gone, came });
  }
  // Moving a term across the = shows as one term leaving one side and arriving
  // on the other: that is a move, not the slip. Only one term on one side counts.
  if (changes.length !== 1) return null;
  const { side, gone, came } = changes[0];
  const where = side ? ` on the ${side}` : '';
  if (gone.length === 1 && came.length === 1) {
    const [x] = gone, [y] = came;
    if (x.sign !== y.sign && sameTerm(x, y)) return `The ${shown(x)}${where} became ${shown(y)}: its sign changed between these lines.`;
    return `The term ${shown(x)}${where} became ${shown(y)} between these lines.`;
  }
  if (gone.length === 1 && !came.length) return `The term ${shown(gone[0])}${where} disappeared between these lines.`;
  if (came.length === 1 && !gone.length) return `A new term ${shown(came[0])} appeared${where} between these lines.`;
  return null;
}
