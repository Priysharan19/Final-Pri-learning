// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · AI line check · the engine veto
//
// Before any AI opinion about a line is shown, the engine runs every check it
// can run on that line, with its own expression evaluator:
//
//   · each "=" in the line: the two sides are compared (a closed value to 1e-9; an
//     algebraic one at many points and by exprEquivalent). A leading "=" continues
//     the nearest line above that has a last side;
//   · a side with a letter against a side with none: the letter's value is read
//     from the question or from an earlier line ("x = -1"), then compared;
//   · the engine's verdict on the final answer: a line stating the submitted
//     answer is never AI-ticked when the engine judged that answer wrong.
//
// The result is one of
//   { proved: { kind, sentence, short } }   the engine can show the line true: it becomes an engine tick with the engine's own reason
//   { refuted: { why } }                    the engine can show a side differs: an AI "correct" is dropped
//   { unknown: true }                       the engine cannot say (a rounding, a unit, an inequality, an ambiguous reading, a label)
//
// Nothing here reads a model's words. Nothing here sets a mark or crosses a line.
// ─────────────────────────────────────────────────────────────────────────────
import { normalize, parse, evaluate, variablesOf, exprEquivalent, withEvaluationBudget } from '../../../client/src/engine/expr.js';
import { readingIsAmbiguous } from '../../../client/src/engine/falseStep.js';

const BUDGET = 60000;
const FN = new Set(['sin', 'cos', 'tan', 'sec', 'csc', 'cosec', 'cot', 'ln', 'log', 'sqrt', 'exp', 'abs', 'arcsin', 'arccos', 'arctan', 'pi', 'theta', 'e']);
const UNKNOWN = Object.freeze({ unknown: true });

const tidy = text => String(text ?? '')
  .replace(/\\boxed\{([^}]*)\}/g, '$1').replace(/[−‒–—]/g, '-').replace(/[×·]/g, '*').replace(/÷/g, '/')
  .replace(/²/g, '^2').replace(/³/g, '^3').replace(/\s+/g, ' ').trim()
  .replace(/^(?:∴|so|hence|then|therefore|thus)\s*:?\s*/i, '').replace(/[.]+$/, '').trim();

const numberText = v => (Number.isInteger(v) ? String(v) : String(Math.round(v * 1e6) / 1e6)).replace('-', '−');
const close = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

/** An expression the engine can parse, or null. Words (other than function names) make a side a label, not an expression. */
function exprOf(side) {
  const s = tidy(side);
  if (!s || s.length > 120) return null;
  const words = s.match(/[A-Za-z]{2,}/g) || [];
  if (words.some(w => !FN.has(w.toLowerCase()) && !/^[a-z]{2,3}$/.test(w) )) return null;
  // implicit products of two or more letters (uv, dy) are not read as expressions here: u'v + uv' is notation, not arithmetic
  if (words.some(w => !FN.has(w.toLowerCase()))) return null;
  if (/['′’]/.test(s)) return null;
  try { const text = normalize(s); const ast = parse(text); const vars = [...variablesOf(ast)].filter(v => !FN.has(v)); return { text, ast, vars, decimal: /\d\.\d/.test(s) }; } catch { return null; }
}

const valueAt = (e, env) => { try { const v = evaluate(e.ast, env); return typeof v === 'number' && Number.isFinite(v) ? v : null; } catch { return null; } };

/** The value a letter is bound to by "x = -1" on a line of its own (or at the start of one: "At x = -1:"), or null. */
export function bindingOf(text) {
  const t = tidy(text).replace(/^(?:at|when|for|put|let|sub(?:stitute|stituting)?|with|if)\s*,?\s*/i, '').replace(/[:;,.]\s*$/, '').trim();
  const m = /^([A-Za-z])\s*=\s*(-?\d+(?:\.\d+)?)$/.exec(t);
  return m ? { name: m[1], value: Number(m[2]) } : null;
}

/** A closed binding stated in the question ("... where x = -1"). Only when the prompt binds one letter once. */
export function promptBindings(prompt) {
  const plain = tidy(String(prompt ?? '').replace(/\\\(|\\\)|\$/g, ' ').replace(/\\minus/g, '-'));
  const found = new Map();
  for (const m of plain.matchAll(/(?<![A-Za-z])([a-z])\s*=\s*(-?\d+(?:\.\d+)?)(?![\d.]*\s*[a-z(])/g)) {
    if (found.has(m[1]) && found.get(m[1]) !== Number(m[2])) found.set(m[1], null); else found.set(m[1], Number(m[2]));
  }
  const env = {};
  for (const [k, v] of found) if (v !== null) env[k] = v;
  return env;
}

const POINTS = [-2.7, -1.3, -0.4, 0.6, 1.9, 3.1, 4.3];

/** equal | unequal | unknown for two parsed sides, under the page's known letter values. */
function comparePair(p, q, env, decisive = true) {
  const letters = new Set([...p.vars, ...q.vars]);
  const same = p.vars.length === q.vars.length && p.vars.every(v => q.vars.includes(v));
  const rounding = p.decimal || q.decimal;
  if (letters.size === 0) {
    const a = valueAt(p, {}), b = valueAt(q, {});
    if (a === null || b === null) return { r: 'unknown' };
    if (close(a, b)) return { r: 'equal', value: a };
    if (rounding && Math.abs(a - b) <= 0.006 * Math.max(1, Math.abs(a), Math.abs(b))) return { r: 'unknown' };
    return { r: 'unequal', a, b };
  }
  if (same) {
    let agreed = 0, firstDiff = null;
    for (const x of POINTS) {
      const e = Object.fromEntries([...letters].map((v, k) => [v, x + 0.37 * k]));
      const a = valueAt(p, e), b = valueAt(q, e);
      if (a === null || b === null) continue;
      if (close(a, b)) agreed++; else if (!firstDiff) firstDiff = { a, b, e };
    }
    // Two sides with the same letters that differ, both written on THIS line, are an equation to solve (2x + 3 = x + 7), not a false
    // identity: it is neither proved nor refuted. Against the line above (an expression carried forward) a difference is decisive.
    if (firstDiff && !decisive) return { r: 'unknown', equation: true };
    if (firstDiff && !(rounding && Math.abs(firstDiff.a - firstDiff.b) <= 0.006 * Math.max(1, Math.abs(firstDiff.a)))) return { r: 'unequal', ...firstDiff };
    if (!firstDiff && agreed >= 3) { let eq = false; try { eq = exprEquivalent(p.text, q.text) === true; } catch { eq = false; } return eq ? { r: 'equal' } : { r: 'unknown' }; }
    return { r: 'unknown' };
  }
  // letters differ: substitute the letters the page or the question gives a value for
  const needed = [...letters];
  if (!needed.every(v => Object.hasOwn(env, v))) return { r: 'unknown' };
  const a = valueAt(p, env), b = valueAt(q, env);
  if (a === null || b === null) return { r: 'unknown' };
  const bound = needed.map(v => `${v} = ${numberText(env[v])}`).join(', ');
  if (close(a, b)) return { r: 'equal', value: a, substituted: bound };
  if (rounding && Math.abs(a - b) <= 0.006 * Math.max(1, Math.abs(a), Math.abs(b))) return { r: 'unknown' };
  return { r: 'unequal', a, b, substituted: bound };
}

/** The sides of a line of "=" joined expressions, or null when the line is anything else (a relation, a list, words). */
function sidesOf(text) {
  const t = tidy(text);
  if (!t || /[<>≤≥≠≈]|!=|=>|⇒|->|→/.test(t) || /[,;:]/.test(t) || /\b(?:or|and)\b/i.test(t)) return null;
  const parts = t.split('=').map(s => s.trim());
  if (parts.length < 2) return null;
  const leading = parts[0] === '';
  const sides = leading ? parts.slice(1) : parts;
  if (sides.some(s => !s)) return null;
  return { leading, sides };
}

const LABEL = /^(?:d[a-z]?\/d[a-z]|d\^?2?[a-z]\/d[a-z]\^?2?|[a-z]['′]{1,2}(?:\(\s*[a-z]\s*\))?|[a-z]\(\s*[a-z]\s*\)|gradient|slope|ans(?:wer)?|area|volume|length|value|total|sum|distance|speed|velocity|rate)$/i;

const isLabelSide = side => LABEL.test(tidy(side)) || (!exprOf(side) && /^[A-Za-z]{3,}$/.test(tidy(side)) && !FN.has(tidy(side).toLowerCase()));

const labelKey = side => tidy(side).toLowerCase().replace(/\s+/g, '');

/**
 * The last side of the nearest line above that is a plain chain of expressions, or null.
 * A line that opens with a LABEL (dy/dx, y', Gradient) continues only a chain that opened with the same label: dy/dx is the derivative of y, so
 * "dy/dx = 12x^2" under "y = 4x^3" is not a continuation of it (this was a wrong refutation of a true line, found by the evaluation).
 * A line that begins with "=" continues whatever chain is nearest above.
 */
function lastSideAbove(above, label = null) {
  let nearest = null;
  for (let i = above.length - 1; i >= 0; i--) {
    const s = sidesOf(above[i]);
    if (!s) continue;
    let sides = s.sides;
    let head = null;
    if (!s.leading && sides.length >= 2 && isLabelSide(sides[0])) { head = labelKey(sides[0]); sides = sides.slice(1); }
    const parsed = sides.map(exprOf);
    if (parsed.some(e => !e)) {
      if (!nearest) return null;                            // the nearest chain line cannot be read: say nothing rather than reach past it
      if (s.leading) continue;                              // an unreadable continuation inside a chain whose last side is already known
      return label === null || head === label ? nearest : null;   // an unreadable head: the chain it opened is the one already found
    }
    if (!nearest) nearest = { expr: parsed[parsed.length - 1], text: tidy(sides[sides.length - 1]) };
    if (s.leading) continue;                                // a continuation: its chain opened higher up
    if (label === null) return nearest;                     // an unlabelled "=" line continues the nearest chain
    return head === label ? nearest : null;                 // a labelled line continues only a chain with the same label
  }
  return label === null ? nearest : null;
}

/**
 * What the engine can establish about one line.
 * @param {string} text      the line
 * @param {{ above?: string[], prompt?: string }} ctx   the lines above it (in order) and the question's text
 */
export function engineCheckLine(text, { above = [], prompt = '' } = {}) {
  return withEvaluationBudget(BUDGET, () => {
    try { return engineCheckInner(text, { above, prompt }); } catch { return UNKNOWN; }
  });
}

function engineCheckInner(text, { above, prompt }) {
  const s = sidesOf(text);
  if (!s) return UNKNOWN;
  const env = { ...promptBindings(prompt) };
  for (const line of above) { const b = bindingOf(line); if (b) env[b.name] = b.value; }
  // the chain: [the line above's last side when this line continues it] + this line's sides; a label before the first "=" is notation, not a side
  let sides = s.sides.slice();
  let chain = [];
  const labelled = !s.leading && sides.length >= 2 && isLabelSide(sides[0]);
  if (labelled) sides = sides.slice(1);
  // a reading that could be taken two ways (sin 2x, e^2x, 1/2x) is not judged either way; the label itself is notation and is not read
  if (readingIsAmbiguous(sides.join(' = '))) return UNKNOWN;
  const prev = lastSideAbove(above, labelled ? labelKey(s.sides[0]) : null);
  const needsAbove = s.leading || labelled;
  if (needsAbove) { if (!prev) return UNKNOWN; chain.push({ expr: prev.expr, text: prev.text, fromAbove: true }); }
  for (const side of sides) {
    const e = exprOf(side);
    if (!e) return UNKNOWN;
    chain.push({ expr: e, text: tidy(side), fromAbove: false });
  }
  if (chain.length < 2) return UNKNOWN;
  // an assignment ("x = -1") is a definition, not a claim
  if (chain.length === 2 && !needsAbove && chain[0].expr.vars.length === 1 && /^[A-Za-z]$/.test(chain[0].text) && chain[1].expr.vars.length === 0) return UNKNOWN;
  let substituted = null, value, unknown = false, usedAbove = needsAbove;
  for (let i = 0; i + 1 < chain.length; i++) {
    const c = comparePair(chain[i].expr, chain[i + 1].expr, env, chain[i].fromAbove === true);
    if (c.r === 'unequal') return { refuted: { why: `${chain[i].text} and ${chain[i + 1].text} are not equal` } };
    if (c.r === 'unknown') { unknown = true; continue; }
    if (c.substituted) substituted = c.substituted;
    if (c.value !== undefined) value = c.value;
  }
  if (unknown) return UNKNOWN;
  const kind = substituted ? 'substitution' : usedAbove ? 'equal-to-line-above' : 'both-sides';
  const shown = value !== undefined ? numberText(value) : null;
  const sentence = substituted
    ? `Putting ${substituted} into the line above gives ${shown ?? 'this value'}, as written here.`
    : usedAbove ? 'This line is equal to the line above.' : (shown ? `Both sides come to ${shown}.` : 'Both sides are equal.');
  return { proved: { kind, short: substituted ? 'Correct substitution' : usedAbove ? 'Equal to the line above' : 'Both sides equal', sentence } };
}

/** The numeric value a line ends on ("= -18", "Gradient = -18"), or null. */
export function endValueOf(text) {
  const s = sidesOf(text);
  if (!s) return null;
  const e = exprOf(s.sides[s.sides.length - 1]);
  if (!e || e.vars.length) return null;
  return valueAt(e, {});
}

/**
 * A model's "corrected right-hand side" is shown only when the engine can confirm it: the line's own left side (or the line above's last
 * side, for a line that continues it) equals the corrected expression. Returns the corrected text, or null.
 */
export function correctionHolds(text, corrected, { above = [], prompt = '' } = {}) {
  return withEvaluationBudget(BUDGET, () => {
    try {
      const s = sidesOf(text);
      const fixed = exprOf(corrected);
      if (!s || !fixed || readingIsAmbiguous(corrected)) return null;
      const env = { ...promptBindings(prompt) };
      for (const line of above) { const b = bindingOf(line); if (b) env[b.name] = b.value; }
      let sides = s.sides;
      const label = !s.leading && sides.length >= 2 && isLabelSide(sides[0]) ? labelKey(sides[0]) : null;
      if (label) sides = sides.slice(1);
      let left;
      if (s.leading || sides.length < 2) { const prev = lastSideAbove(above, label); left = prev?.expr; } else left = exprOf(sides[sides.length - 2]);
      if (!left) return null;
      return comparePair(left, fixed, env).r === 'equal' ? tidy(corrected) : null;
    } catch { return null; }
  });
}
