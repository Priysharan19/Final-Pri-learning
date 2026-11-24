// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the author question bank's MANUAL parts (Prithagoras, NSW Years 11-12)
//
// About 3,000 of the owner's parts are `answerType: "manual"`: show / prove / explain / sketch / justify, and "find" questions whose answer
// was never given a structured key. This module does two things with them, from the data alone, and never invents a mark:
//
//   1. classifyManual  which of four kinds a part is, from its prompt's words (outside the maths).
//   2. deriveKey       for a "find" part only: a structured key (numeric, expression, equation, set or point) when, and only when, his own
//                      printed answer `ans` reads fully as ONE value of one of those forms AND that value is a result of his LAST worked step.
//                      Anything else is not guessed: the part stays a worked-solution question (no mark, ever).
//
// The caller (tools/qbank-import.mjs) then runs a derived part through exactly the checks an authored auto-markable part passes (the engine
// accepts the key, the hint leak rule, the figure rule, the layout rules) plus one more here: at least two plausible WRONG values are refused.
//
// For a part that stays manual, `manualHintLeaks` is the leak rule: the "answer" of a show-that question is in its prompt, so a hint is held
// against the RESULTS of his worked steps instead: a hint may not state one.
//
// Pure and deterministic: no clock, no network, no model, no randomness.
// ─────────────────────────────────────────────────────────────────────────────
import { exprEquivalent, parse, normalize, evaluate } from '../client/src/engine/expr.js';
import { texToPlain } from './qbank-leak.mjs';

const MATH = /(?<!\\)\$((?:\\\$|[^$])+?)(?<!\\)\$/g;
const spansOf = t => [...String(t ?? '').matchAll(MATH)].map(m => m[1]);
const proseOf = t => String(t ?? '').replace(MATH, ' ');
const safe = (fn, fallback = null) => { try { return fn(); } catch { return fallback; } };

// ── 1. classification ────────────────────────────────────────────────────────
/** The kinds a manual part is, in the order they are tested. `find` is what is left. */
export const MANUAL_KINDS = Object.freeze(['prove', 'explain', 'sketch', 'find']);

/**
 * The kind of a manual part from its prompt's words, outside the maths:
 *   prove    show that, prove, verify, justify, demonstrate      (the result is in the prompt; the answer is an argument)
 *   explain  explain, describe, interpret, comment, why           (a sentence is the answer)
 *   sketch   sketch, graph, draw, plot, shade                     (a picture is the answer)
 *   find     everything else (find, solve, evaluate, state, ...)  (a value is the answer, but his key was not structured)
 */
export function classifyManual(prompt) {
  const t = proseOf(prompt).toLowerCase();
  if (/\b(show|prove|verify|justify|demonstrate|deduce|derive)\b/.test(t)) return 'prove';
  if (/\b(explain|describe|interpret|comment|why|discuss)\b/.test(t)) return 'explain';
  if (/\b(sketch|graph|draw|plot|shade|construct)\b/.test(t)) return 'sketch';
  return 'find';
}

// ── 2. reading his printed answer ────────────────────────────────────────────
const FUNCS_AND_CONSTANTS = /(?<![A-Za-z])(?:sin|cos|tan|sec|cosec|cot|ln|log|exp|sqrt|ncr|npr|arcsin|arccos|arctan|asin|acos|atan|pi|inf)(?![A-Za-z])/g;
/** The single letters a plain reading uses as unknowns (e is the constant). */
const lettersOf = plain => new Set((plain.replace(FUNCS_AND_CONSTANTS, '').match(/[A-Za-zα-ωΑ-Ω]/g) || []).filter(c => c !== 'e'));
const numberOf = plain => {
  const t = String(plain).replace(/π/g, 'pi').replace(/[−–]/g, '-').trim();
  if (!t || !/\d|pi|\be\b/.test(t) || lettersOf(t).size || /[,;]/.test(t)) return null;
  return safe(() => { const v = evaluate(parse(normalize(t)), {}); return Number.isFinite(v) ? v : null; }, null);
};
const near = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

/** Splits at top-level commas (not inside brackets). */
function commaItems(s) {
  const out = []; let depth = 0, cur = '';
  for (const ch of s) {
    if ('([{'.includes(ch)) depth++; else if (')]}'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out.map(x => x.trim()).filter(Boolean);
}
const RELATION = /(?<![<>!])=(?!=)|<=|>=|<|>|⇒/;
const unwrapOnce = s => { const t = s.trim(); if (!/^\(.*\)$/.test(t)) return t; let d = 0; for (let i = 0; i < t.length; i++) { if (t[i] === '(') d++; else if (t[i] === ')' && --d === 0 && i < t.length - 1) return t; } return t.slice(1, -1).trim(); };

/** `\text{ or }` and `\text{ and }` inside a span are separators; any other \text, units or words make the answer not a bare value. */
function spanPlain(span) {
  const joined = span.replace(/\\(?:quad|qquad|,|;|!)/g, ' ').replace(/\\text\{\s*(?:or|and)\s*\}/g, ' ; ').replace(/\\mathrm\{\s*(?:or|and)\s*\}/g, ' ; ');
  if (/\\(?:text|mathrm|mbox|textbf|operatorname|begin|left\\\{)/.test(joined) && !/\\mathrm\{\s*e\s*\}/.test(joined)) return null;
  const { plain, unread } = texToPlain(joined.replace(/\\mathrm\{\s*e\s*\}/g, 'e'));
  return unread.length ? null : plain.replace(/\^\(\s*\)/g, '');
}

/**
 * What his printed answer is, as ONE value, or why it is not:
 *   { kind: 'numeric' | 'expression' | 'equation' | 'set' | 'point', ... } or { no: <code> }.
 * The text must be maths and nothing else (no unit, no word but "or"/"and" between values), must not be approximate, and must be one
 * quantity (a semicolon outside the maths is his sign for two quantities: refused).
 */
export function readPrintedAnswer(ans, prompt) {
  if (typeof ans !== 'string' || !ans.trim()) return { no: 'no-printed-answer' };
  if (/\\approx|\\pm|\\mp|\\ldots|\\dots|[≈±∓]/.test(ans)) return { no: 'approximate-or-plus-minus' };
  const outside = ans.replace(MATH, '\u0001');
  if (/;/.test(outside)) return { no: 'several-quantities' };
  const between = outside.split('\u0001').join(' ').replace(/\b(?:or|and)\b/gi, ' ').replace(/[\s.,]+/g, '');
  if (between) return { no: 'words-with-the-answer' };
  const spans = spansOf(ans);
  if (!spans.length) return { no: 'no-maths' };
  const proseP = proseOf(prompt).toLowerCase();
  const items = [];
  for (const sp of spans) {
    const plain = spanPlain(sp);
    if (plain === null) return { no: 'unreadable-or-has-words' };
    for (const piece of plain.split(';')) if (piece.trim()) items.push(piece.trim());
  }
  const listed = items.length > 1 || (items.length === 1 && commaItems(items[0]).length > 1 && !/^\(.*\)$/.test(items[0].trim()));
  if (!listed) {
    const item = items[0];
    if (/[<>]|<=|>=|!=|\.\.\./.test(item)) return { no: 'inequality-or-range' };
    if (/°|%/.test(item)) return { no: 'unit-in-answer' };
    // A point, only where the question asks for one.
    const pt = /^\(\s*([^,()]+(?:\([^)]*\))?)\s*,\s*([^,()]+(?:\([^)]*\))?)\s*\)$/.exec(item.replace(/^[A-Z]\s*=\s*/, ''));
    if (pt) {
      const x = numberOf(pt[1]), y = numberOf(pt[2]);
      if (x === null || y === null) return { no: 'point-not-closed' };
      if (!/\b(?:point|coordinates|vertex|centre|center|midpoint|intersect\w*|turning|stationary|foot|image|reflection|location|position)\b/.test(proseP)) return { no: 'point-not-asked' };
      return { kind: 'point', x, y, plain: item };
    }
    const rel = item.split(/(?<![<>!])=(?!=)/).map(x => x.trim());
    if (rel.length > 2) return { no: 'chain-of-equalities' };
    if (rel.length === 2) {
      const [lhs, rhs] = rel;
      if (/^[A-Za-z](?:_\w+)?$/.test(lhs)) {
        const v = numberOf(rhs);
        if (v !== null) return { kind: 'numeric', value: v, plain: rhs };
        if (lhs === 'y' && /\bequation\b/.test(proseP) && lettersOf(rhs).size >= 1 && lettersOf(rhs).size <= 2) return { kind: 'equation', lhs: 'y', rhs, plain: item };
        return { no: 'left-side-not-a-bare-value' };
      }
      const prefix = /^(dy\/dx|y'|f'\(x\)|f\(x\)|g\(x\)|y'')$/.exec(lhs.replace(/\s+/g, '').replace(/^\(\(dy\)\/\(dx\)\)$/, 'dy/dx'));
      if (prefix && lettersOf(rhs).size >= 1 && lettersOf(rhs).size <= 2) return { kind: 'expression', expr: rhs, prefix: `${prefix[1]} =`, plain: rhs };
      return { no: 'left-side-not-a-bare-value' };
    }
    const v = numberOf(item);
    if (v !== null) return { kind: 'numeric', value: v, plain: item };
    const letters = lettersOf(item);
    if (letters.size >= 1 && letters.size <= 3 && !RELATION.test(item)) return { kind: 'expression', expr: item, plain: item };
    return { no: 'not-one-value' };
  }
  // A list: a set of values, only where the question asks for several (solve, roots, ...), every item one number (of one unknown).
  if (!/\b(?:solve|solutions?|roots?|zeros?|values|intercepts?|stationary|turning|intersect\w*|find all|which)\b/.test(proseP)) return { no: 'list-not-asked' };
  const flat = items.flatMap(it => commaItems(it));
  const values = []; let unknown = null;
  for (const f of flat) {
    const m = /^([A-Za-z])\s*=\s*(.+)$/.exec(f);
    if (m) { if (unknown && unknown !== m[1]) return { no: 'several-unknowns' }; unknown = m[1]; }
    const v = numberOf(m ? m[2] : f);
    if (v === null) return { no: 'list-item-not-a-number' };
    if (!values.some(u => near(u, v))) values.push(v);
  }
  if (values.length < 2) return { no: 'list-too-short' };
  return { kind: 'set', values, plain: flat.join(', ') };
}

/** The candidate values a worked step states: every maths span's whole, each side of each relation, each list item, parentheses peeled. */
function stepCandidates(stepText) {
  const out = new Set();
  for (const sp of spansOf(stepText)) {
    const { plain, unread } = texToPlain(sp.replace(/\\(?:quad|qquad|,|;|!)/g, ' '));
    if (unread.length || !plain) continue;
    for (const part of plain.split(/⇒/)) {
      out.add(part.trim());
      for (const side of part.split(RELATION)) { const s = side.trim(); if (s) { out.add(s); out.add(unwrapOnce(s)); for (const it of commaItems(unwrapOnce(s))) out.add(unwrapOnce(it)); } }
    }
  }
  return [...out].filter(Boolean);
}

/** Is `read` (readPrintedAnswer's value) a result of this step? */
function stepStates(read, stepText) {
  const cands = stepCandidates(stepText);
  switch (read.kind) {
    case 'numeric': return cands.some(c => { const v = numberOf(c); return v !== null && near(v, read.value); });
    case 'expression': return cands.some(c => lettersOf(c).size && safe(() => exprEquivalent(c, read.expr), false) === true);
    case 'equation': {
      for (const sp of spansOf(stepText)) {
        const { plain } = texToPlain(sp);
        const sides = plain.split(/(?<![<>!])=(?!=)/).map(x => x.trim());
        for (let i = 0; i + 1 < sides.length; i++) if (sides[i] === 'y' && safe(() => exprEquivalent(sides[i + 1], read.rhs), false) === true) return true;
      }
      return false;
    }
    case 'set': return read.values.every(v => cands.some(c => { const n = numberOf(c); return n !== null && near(n, v); }));
    case 'point': return cands.some(c => { const m = /^\(?\s*([^,()]+)\s*,\s*([^,()]+)\s*\)?$/.exec(c); if (!m) return false; const x = numberOf(m[1]), y = numberOf(m[2]); return x !== null && y !== null && near(x, read.x) && near(y, read.y); });
    default: return false;
  }
}

// The prompt asks for a particular FORM, which an expression key (any equivalent expression is accepted) cannot police.
const ASKS_A_FORM = /\b(?:factori[sz]e\w*|expand\w*|simplif\w*|in the form|complete the square|completing the square|partial fractions?|rationali[sz]e\w*|rational denominator|single (?:fraction|logarithm|power)|fully|as a (?:single|product|sum|fraction)|lowest terms|simplest)\b/i;
// A numeric key is any equal value, so only a form a number can be written in more than one way matters.
const ASKS_A_NUMBER_FORM = /\b(?:simplif\w*|expand\w*|factori[sz]e\w*|rational denominator|rationali[sz]e\w*|simplest|lowest terms|mixed number|as a (?:single|fraction|product)|in the form|surd form)\b/i;
// The prompt mandates a METHOD, which a final-answer key cannot police.
const ASKS_A_METHOD = /\b(?:hence|use|by \w+ing|first principles|use (?:the |a |an )?(?:substitution|identity|product|sum|method|compound|factor|remainder|binomial|formula|integration|induction)|using|by (?:using|completing|substitution|induction|first principles|parts|the)|with \$[a-z]\s*=|let \$[a-z]\s*=|apply)\b/i;
// The prompt names a precision: a decimal key would need a tolerance the author did not give.
const NAMES_A_PRECISION = /\b(?:decimal places?|d\.p\.|significant fig\w*|s\.f\.|nearest|correct to|to \d+ (?:dp|sf)|round\w*)\b/i;
// The prompt asks for more than one thing.
const ASKS_SEVERAL = /\b(?:and (?:hence |then )?(?:find|state|write|determine|calculate|show|sketch|explain|justify)|both|respectively)\b/i;

/**
 * A structured key for a "find" part, or { no: <code> }. `ans` is his printed answer for THIS part (the question's `ans`, or the part's).
 * The key is returned only when: the prompt is a find (not show/prove/explain/sketch), it asks for one thing and no particular form or
 * precision, the printed answer reads fully as one value, and that value is a result of his LAST worked step. The caller still runs the
 * pack checks on it.
 */
export function deriveKey(part, ans) {
  const prose = proseOf(part.prompt);
  if (classifyManual(part.prompt) !== 'find') return { no: 'not-a-find' };
  if (ASKS_SEVERAL.test(prose)) return { no: 'asks-several-things' };
  if (ASKS_A_METHOD.test(prose) || /(?:with|let|using) \$[a-zA-Z]\s*=/.test(part.prompt)) return { no: 'asks-a-method' };
  if (NAMES_A_PRECISION.test(prose)) return { no: 'names-a-precision' };
  const read = readPrintedAnswer(ans, part.prompt);
  if (read.no) return { no: read.no };
  if ((read.kind === 'expression' || read.kind === 'equation') && ASKS_A_FORM.test(prose)) return { no: 'asks-a-form' };
  if ((read.kind === 'numeric' || read.kind === 'set' || read.kind === 'point') && ASKS_A_NUMBER_FORM.test(prose)) return { no: 'asks-a-form' };
  const steps = Array.isArray(part.steps) ? part.steps : [];
  if (!steps.length) return { no: 'no-steps' };
  if (!stepStates(read, String(steps[steps.length - 1].d ?? ''))) return { no: 'not-the-last-step-result' };
  switch (read.kind) {
    case 'numeric': return { answerType: 'numeric', answer: { value: read.value }, shown: read.plain };
    case 'expression': return { answerType: 'expression', answer: { expr: read.expr }, ...(read.prefix ? { answerPrefix: read.prefix } : {}), shown: read.plain };
    case 'equation': return { answerType: 'equation', answer: { lhs: read.lhs, rhs: read.rhs }, shown: read.plain };
    case 'set': return { answerType: 'set', answer: { values: read.values }, shown: read.plain };
    case 'point': return { answerType: 'point', answer: { x: read.x, y: read.y }, shown: read.plain };
    default: return { no: 'unknown-kind' };
  }
}

/** The part as an auto-markable one, with the derived key: the last criterion becomes the answer criterion (its position, not its words). */
export function asDerivedPart(part, key) {
  const criteria = part.criteria.map((c, i, all) => (i === all.length - 1 ? { ...c, answer: true } : { ...c }));
  for (const c of criteria) if (c.answer !== true) delete c.answer;
  return { ...part, answerType: key.answerType, answer: key.answer, criteria, traps: [], ...(key.answerPrefix ? { answerPrefix: key.answerPrefix } : {}), derivedKey: true };
}

/**
 * Plausible WRONG answers to a derived key, as a student would type them: the key's negative, its double, one more, a swap, a dropped
 * or added element. The caller asks the engine to refuse every one; at least two must exist and all must be refused.
 */
export function plausibleWrongs(key) {
  const a = key.answer;
  switch (key.answerType) {
    case 'numeric': return [...new Set([-a.value, a.value * 2, a.value + 1, a.value / 2, a.value - 1].filter(v => Number.isFinite(v) && !near(v, a.value)).map(v => String(+v.toPrecision(12))))];
    case 'expression': return [`-(${a.expr})`, `2*(${a.expr})`, `(${a.expr})+1`, `(${a.expr})*x`];
    case 'equation': return [`${a.lhs} = -(${a.rhs})`, `${a.lhs} = 2*(${a.rhs})`, `${a.lhs} = (${a.rhs})+1`];
    case 'set': return [a.values.slice(1).map(String).join(', '), [...a.values, Math.max(...a.values) + 1].join(', '), a.values.map(v => -v).join(', ')].filter(s => s);
    case 'point': return [`(${a.y}, ${a.x})`, `(${-a.x}, ${a.y})`, `(${a.x}, ${-a.y})`, `(${a.x + 1}, ${a.y})`];
    default: return [];
  }
}

// ── 3. the leak rule for a question that stays a worked solution ─────────────
const fold = t => String(t ?? '').toLowerCase().replace(/\s+/g, '').replace(/\\(?:left|right|displaystyle|quad|qquad|,|;|!)/g, '');
const smallWhole = v => Number.isInteger(v) && Math.abs(v) <= 10;

/**
 * The results of his worked steps: every non-first side of every relation and every closed value in them, minus what the prompt itself says.
 * The LAST step's results are all kept; an earlier step's keep only what is not a bare symbol or a small whole number (a hint may say "set it
 * to 0"), which is what a hint is allowed to name.
 */
export function stepResults(part) {
  const promptFolded = new Set([...spansOf(part.prompt).map(s => fold(texToPlain(s).plain)), ...stepCandidates(part.prompt)].map(fold));
  const steps = Array.isArray(part.steps) ? part.steps : [];
  const out = [];
  steps.forEach((s, i) => {
    const last = i === steps.length - 1;
    for (const sp of spansOf(s.d)) {
      const { plain, unread } = texToPlain(sp.replace(/\\(?:quad|qquad|,|;|!)/g, ' '));
      if (unread.length || !plain) continue;
      const sides = plain.split(/(?<![<>!])=(?!=)/).map(x => x.trim()).filter(Boolean);
      const results = sides.length > 1 ? sides.slice(1) : (last ? sides : []);
      for (const r0 of results) for (const r of [r0, ...commaItems(unwrapOnce(r0)).map(unwrapOnce)]) {
        const f = fold(r);
        if (!f || promptFolded.has(f)) continue;
        const n = numberOf(r);
        if (!last && ((n !== null && smallWhole(n)) || /^[A-Za-zα-ωΑ-Ω]$/.test(r) || r.length < 3)) continue;
        if (last && /^[A-Za-zα-ωΑ-Ω]$/.test(r)) continue;
        out.push({ plain: r, value: n, last });
      }
    }
  });
  return out;
}

/** Why this hint states a result of the worked steps, or null. */
export function stepResultLeak(part, hint, results = stepResults(part)) {
  const t = String(hint ?? '');
  const sides = [];
  for (const sp of spansOf(t)) {
    const { plain, unread } = texToPlain(sp);
    if (unread.length) { if (/\d/.test(plain)) return 'unread TeX in a hint span (fail closed)'; continue; }
    for (const side of plain.split(RELATION)) { const s = side.trim(); if (s) { sides.push(s); sides.push(unwrapOnce(s)); for (const it of commaItems(unwrapOnce(s))) sides.push(unwrapOnce(it)); } }
  }
  // Prose maths ("56/8", "x = 3") is read as well: the words around it are dropped.
  for (const m of proseOf(t).matchAll(/[A-Za-z0-9().^*/+\-\s]*[0-9][A-Za-z0-9().^*/+\-\s]*(?:=[A-Za-z0-9().^*/+\-\s]+)?/g)) for (const side of m[0].split('=')) { const s = side.trim(); if (/\d/.test(s) && s.length >= 2) sides.push(s); }
  // What the question itself says is not a result, even when it equals one (the target of a show-that is in the prompt).
  const stated = new Set(stepCandidates(part.prompt).map(fold));
  for (const s of sides) {
    if (stated.has(fold(s))) continue;
    const sv = numberOf(s);
    for (const r of results) {
      if (fold(s) === fold(r.plain) && fold(s).length >= 2) return `it states "${r.plain.slice(0, 30)}", a result of the worked steps`;
      if (sv !== null && r.value !== null && near(sv, r.value) && (r.last || !smallWhole(r.value))) return `it states ${+sv.toFixed(6)}, a result of the worked steps`;
      if (sv === null && r.value === null && lettersOf(s).size && lettersOf(r.plain).size && s.length >= 3 && safe(() => exprEquivalent(s, r.plain), false) === true) return `it states "${s.slice(0, 30)}", a result of the worked steps`;
    }
  }
  return null;
}
