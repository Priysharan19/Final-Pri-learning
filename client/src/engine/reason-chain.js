// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Pri Reason — equality chains, givens and substitution evidence
//
// What a Class 10 student writes for "first term 9, common difference 3, find
// the 9th term" is not an equation to solve. It is a chain of equalities:
//
//     a = 9, d = 3                 the givens, copied from the question
//     T_n = a + (n - 1)d           the formula, under its own label
//     T_9 = 9 + 8 × 3              the substitution
//         = 9 + 24                 a continuation of the line above
//         = 35                     false: 9 + 24 is 33
//
// The primitives here let a proof plan (checker.js stepCheckPlan) read such a
// page line by line and say, for each line, whether it is TRUE — of the
// question, or of the student's own earlier slip (error carried forward) —
// without ever deciding a mark. They are deterministic and pure: no model, no
// clock, no answer key beyond the authored plan.
//
//   · labelKey      — `T_9`, `T₉`, `t_{9}` and `t9` are one label.
//   · readChain     — a line as (label, segments): `T_9 = 9 + 8 × 3 = 33` is
//                     the label T_9 and two segments; `= 9 + 24` continues the
//                     line above it.
//   · evaluateChain — every segment that can be evaluated under the givens,
//                     and the first one that disagrees with the rest.
//   · substitutionShapes / matchesShape — is this segment the authored
//                     expression with the numbers put in (`9 + (9-1)×3`,
//                     `9 + 8 × 3`, `9 + 24`), or merely a computation that
//                     happens to give the same value (`9 × 3 + 6`)? Credit
//                     for a substitution step wants the former.
//   · assessFormulaLine — a labelled line that states a formula in letters
//                     (`T_n = a + (n-1)d`) is proved or disproved against the
//                     authored forms, with the givens fixed for letters the
//                     student has already substituted; numbers written on the
//                     same line (`= 9 + 8 × 3 = 35`) are its arithmetic, and a
//                     false one breaks the line.
//   · givensLine    — `a = 9, d = 3` (or `a = 9 and d = 3`, `Given a = 9 d = 3`)
//                     read as copied givens, each right or wrong.
//   · listsValues   — `9, 12, 15` lists values; it is not one number.
//
// Words are never read as letters multiplied together: `9 and d` is not
// 9·a·n·d. A line Pri cannot read as one chain is not judged, never blamed.
// ─────────────────────────────────────────────────────────────────────────────
import { normalize, parse, evaluate, variablesOf } from './expr.js';

const SUBSCRIPT = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9', 'ₙ': 'n', 'ₐ': 'a', 'ₖ': 'k', 'ₘ': 'm', 'ᵢ': 'i', 'ⱼ': 'j' };
const RELATION = /[<>≤≥≠]|<=|>=|!=/;
const ARROW = /(?:=>|⇒|⟹|→|⟶)/;

/** One spelling for a label: lower case, no spaces, subscripts flattened (`T_{9}` → `t9`). */
export function labelKey(text) {
  return String(text ?? '')
    .replace(/[₀-₉ₙₐₖₘᵢⱼ]/g, ch => SUBSCRIPT[ch] || ch)
    .toLowerCase()
    .replace(/[\s_{}]/g, '')
    .replace(/[.:]+$/, '');
}

/** The line as the expression engine reads it: prose lead-ins and arrows off, unicode minus plain. */
export function cleanLine(text, { letters = [] } = {}) {
  let s = String(text ?? '').trim()
    .replace(/[−–—]/g, '-')
    .replace(/^∴\s*/, '')
    .replace(/^(so|hence|then|therefore|thus)\s+/i, '');
  if (ARROW.test(s)) s = s.split(ARROW).pop().trim();
  // `8 x 3` between two numbers is a times sign, not an unknown — on a plan
  // whose letters do not include x.
  if (!letters.includes('x')) s = s.replace(/(\d)\s*x\s*(?=[\d(])/g, '$1*');
  return s;
}

/** Is this text a number and nothing else (`33`, `-4.5`, `5,941`)? */
export const isNumberText = s => {
  const t = String(s ?? '').trim();
  return /^[-+]?\d+(?:\.\d+)?$/.test(listsValues(t) ? t : t.replace(/,/g, ''));
};
const IDENTIFIER = /^[A-Za-z][A-Za-z0-9_{}₀-₉ₙₐₖₘᵢⱼ]*(?:\s+[A-Za-z]+)*$/;

function astOf(text) {
  try { return parse(normalize(text)); } catch { return null; }
}

// ── Lists and words ──────────────────────────────────────────────────────────
// The expression engine drops every comma (a thousands separator) and reads a
// run of letters as letters multiplied together. On a page of working neither
// is safe: `9, 12, 15` is three terms, not 91215, and `a = 9 and d = 3` is
// prose, not a = 9·a·n·d.

/** A comma inside a number written in groups: `5,941`, `12,345`, `1,00,000` (not `9,12`, not `9, 12`). */
function groupingComma(s, i) {
  const digit = k => k >= 0 && k < s.length && /\d/.test(s[k]);
  if (!digit(i - 1) || !digit(i + 1)) return false;
  // The number around it: digits, and commas with a digit on both sides.
  let lo = i, hi = i;
  while (digit(lo - 1) || (s[lo - 1] === ',' && digit(lo - 2))) lo--;
  while (digit(hi + 1) || (s[hi + 1] === ',' && digit(hi + 2))) hi++;
  const run = s.slice(lo, hi + 1);
  return /^\d{1,3}(?:,\d{3})+$/.test(run) || /^\d{1,2}(?:,\d{2})*,\d{3}$/.test(run);
}

/**
 * Does the text list several things (`9, 12, 15`, `a = 9; d = 3`) rather than
 * write one? A comma that groups the digits of one number, or that sits inside
 * brackets (`C(5, 2)`), does not list.
 */
export function listsValues(text) {
  const s = String(text ?? '');
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth = Math.max(0, depth - 1);
    else if (depth === 0 && c === ';') return true;
    else if (depth === 0 && c === ',' && !groupingComma(s, i)) return true;
  }
  return false;
}

/** The text with every listing comma (not a digit-grouping one, not one in brackets) replaced by `mark`. */
function markListCommas(text, mark) {
  const s = String(text ?? '');
  let depth = 0, out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth = Math.max(0, depth - 1);
    out += depth === 0 && (c === ';' || (c === ',' && !groupingComma(s, i))) ? mark : c;
  }
  return out;
}

// Names the expression engine reads as one thing (expr.js FUNCTIONS and
// constants). A run of three or more letters is a word unless it is one of
// them, or one of them applied to a single letter (`sinx`): `expand` is not
// exp·a·n·d, `secand` not sec·a·n·d.
const MATH_NAMES = ['arcsin', 'arccos', 'arctan', 'cosec', 'alpha', 'theta', 'asin', 'acos', 'atan', 'sqrt', 'cbrt', 'floor', 'ceil', 'beta',
  'sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'log', 'exp', 'abs', 'ncr', 'npr', 'ln', 'pi'];
function hasWord(text) {
  const runs = String(text ?? '').match(/[A-Za-z]{3,}/g) || [];
  return runs.some(run => {
    const r = run.toLowerCase();
    return !MATH_NAMES.some(name => r === name || (r.length === name.length + 1 && r.startsWith(name)));
  });
}

/** A comma that neither groups digits (`5,941`) nor sits outside every bracket: `(20, 71)` is not 2071. */
function strayComma(text) {
  const s = String(text ?? '');
  for (let i = 0; i < s.length; i++) if (s[i] === ',' && !groupingComma(s, i)) return true;
  return false;
}

/** `9 d`, `9. d`: a number and a letter side by side with a space or a full stop between — prose, or a lost comma, as likely as a product. */
const AMBIGUOUS_JUXTAPOSITION = /\d\.?\s+[A-Za-z]|\d\.[A-Za-z]|\)\.?\s+[A-Za-z]{2,}/;
/**
 * A second `letter =` clause after the first `=`, set apart from what stands
 * before it (`a + (n-1)d  n = 9`, `… = 33 d = 3`, `(n-1)d. a = 9`): two
 * statements run together, a lost comma — not one chain.
 */
const SECOND_CLAUSE = /[\w)]\.?\s+[A-Za-z][A-Za-z0-9_{}₀-₉ₙₐₖₘᵢⱼ]*\s*=/;

/** Rewrite whole-word aliases (`a_n`, `an`, `T_n` → `l`) so an expression engine can read them. */
export function rewriteAliases(text, aliases = null) {
  if (!aliases || typeof aliases !== 'object') return text;
  let s = String(text);
  for (const [letter, spellings] of Object.entries(aliases)) {
    for (const spelling of spellings || []) {
      const key = labelKey(spelling);
      if (!key) continue;
      // The alias as a whole token: not inside a longer run of letters/digits.
      const pattern = new RegExp(`(^|[^A-Za-z0-9_])${spelling.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9_])`, 'g');
      s = s.replace(pattern, `$1${letter}`);
    }
  }
  return s;
}

/**
 * Read a line as a chain of equalities.
 * Returns null for a line that is not one (a relation, prose with no `=` and
 * no readable expression, or a list such as `a = 9, d = 3` or `9, 12, 15`).
 *
 *   { continuation, label, labelKey, segments: [{ text, ast, letters, ambiguous }] }
 *
 * `label` is the first part when it names a result rather than computing one:
 * a known label of the plan (`T_9`), or an identifier the engine cannot
 * evaluate under the plan's letters (`S`, `tn`). `letters` are the free
 * letters of each segment. A segment with a word in it (`9 and d`) is not
 * read (`ast: null`); one with a number and a letter side by side across a
 * space or a full stop (`9 d`, `9. d`) is read but flagged `ambiguous`.
 */
export function readChain(text, { labels = new Set(), letters = [], aliases = null } = {}) {
  const raw = cleanLine(text, { letters });
  if (!raw || RELATION.test(raw.replace(/<=>/g, ''))) return null;
  if (listsValues(raw)) return null;
  const continuation = raw.startsWith('=');
  const parts = raw.split('=').map(p => p.trim());
  if (continuation) parts.shift();
  while (parts.length && parts[parts.length - 1] === '') parts.pop();
  if (!parts.length || parts.some(p => p === '')) return null;
  let label = null, reversed = false;
  if (!continuation && parts.length >= 2) {
    const head = parts[0];
    const key = labelKey(head);
    const known = labels.has(key);
    if (known) label = head;
    else if (IDENTIFIER.test(head) && !isNumberText(head)) {
      const ast = astOf(rewriteAliases(head, aliases));
      const free = ast ? [...variablesOf(ast)] : null;
      // An identifier the plan's letters cannot evaluate names a result.
      if (!ast || free.some(v => !letters.includes(v))) label = head;
    }
    // `9 + 8 × 3 = T_9`, `35 = T_9`: the label written last. Only a label the
    // plan knows, and only when nothing at the head names a result.
    if (label === null) {
      const tail = parts[parts.length - 1];
      if (labels.has(labelKey(tail)) && !isNumberText(tail)) { label = tail; reversed = true; }
    }
  }
  const bodies = label === null ? parts : reversed ? parts.slice(0, -1) : parts.slice(1);
  if (!bodies.length) return null;
  const runTogether = SECOND_CLAUSE.test(raw.slice(raw.indexOf('=') + 1));
  const segments = bodies.map(part => {
    const rewritten = rewriteAliases(part, aliases);
    const ast = hasWord(rewritten) || strayComma(rewritten) ? null : astOf(rewritten);
    return { text: part, ast, letters: ast ? [...variablesOf(ast)] : null, ambiguous: runTogether || AMBIGUOUS_JUXTAPOSITION.test(part) };
  });
  // `clause` is the line with its label first, as every assessor reads one.
  const clause = label === null ? raw : `${label} = ${segments.map(seg => seg.text).join(' = ')}`;
  return { continuation, reversed, label, labelKey: label === null ? null : labelKey(label), segments, clause };
}

/** The finite value of an AST under `env`, or null (unreadable, a free letter, not finite). */
export function valueUnder(ast, env = {}) {
  if (!ast || ast.t === 'equation') return null;
  for (const name of variablesOf(ast)) if (!Object.hasOwn(env, name)) return null;
  try {
    const value = evaluate(ast, env);
    return Number.isFinite(value) ? value : null;
  } catch { return null; }
}

/** Two values of one chain agree when they are close in the engine's sense. */
export const sameValue = (a, b) => Number.isFinite(a) && Number.isFinite(b)
  && Math.abs(a - b) <= Math.max(1e-6, Math.abs(a), Math.abs(b)) * 1e-6;

/**
 * Evaluate every segment of a chain under `env`.
 *   { values, evaluable, consistent, breakAt, usedLetters }
 * `breakAt` is the index of the first segment whose value differs from the
 * one before it (−1 when the chain is consistent, or not fully evaluable).
 */
export function evaluateChain(chain, env = {}) {
  const values = chain.segments.map(seg => valueUnder(seg.ast, env));
  const evaluable = values.every(v => v !== null);
  const usedLetters = [...new Set(chain.segments.flatMap(seg => seg.letters || []))];
  if (!evaluable) return { values, evaluable: false, consistent: false, breakAt: -1, usedLetters };
  let breakAt = -1;
  for (let i = 1; i < values.length; i++) {
    if (!sameValue(values[i - 1], values[i])) { breakAt = i; break; }
  }
  return { values, evaluable: true, consistent: breakAt === -1, breakAt, usedLetters };
}

/** Does the line only state numbers (`33`, `9 = 9`), computing nothing? */
export function bareNumbers(chain) {
  return chain.segments.every(seg => isNumberText(seg.text));
}

// ── Shapes ───────────────────────────────────────────────────────────────────
// A canonical rendering of what was written, not of what it means: the order
// of a sum or a product is free, brackets that only group are dropped, a
// negative number is one number. Two segments with one shape are the same
// expression written again.

function unwrap(node) {
  let n = node;
  while (n && n.t === 'group') n = n.v;
  return n;
}
function commutative(node, op, acc = []) {
  const n = unwrap(node);
  if (n && n.t === 'bin' && (n.op === op || (op === '+' && n.op === '-'))) {
    commutative(n.l, op, acc);
    if (n.op === '-') acc.push({ t: 'neg', v: n.r });
    else commutative(n.r, op, acc);
    return acc;
  }
  acc.push(n);
  return acc;
}
/**
 * A product with its divisions, as two multisets of factors: `n/2 × (…)`,
 * `n × (…) / 2` and `(…) × n/2` are one product, n and (…) over 2. Dividing by
 * a quotient multiplies by its reciprocal, so its factors change sides.
 */
function productFactors(node, num, den) {
  const n = unwrap(node);
  if (n && n.t === 'bin' && n.op === '*') { productFactors(n.l, num, den); productFactors(n.r, num, den); return; }
  if (n && n.t === 'bin' && n.op === '/') { productFactors(n.l, num, den); productFactors(n.r, den, num); return; }
  num.push(n);
}
const fmt = v => String(Number(Number(v).toPrecision(12)));

/**
 * The shape of an expression as written. The order of a sum is free; so is
 * the order of a product, and where in it a division is written — the
 * textbook's `n/2 (2a + (n − 1)d)` and `n(2a + (n − 1)d)/2` are one shape.
 */
export function shapeKey(node) {
  const n = unwrap(node);
  if (!n || typeof n !== 'object') return '?';
  switch (n.t) {
    case 'num': return `#${fmt(n.v)}`;
    case 'var': return `v${n.v}`;
    case 'const': return `k${n.v}`;
    case 'neg': {
      const inner = unwrap(n.v);
      if (inner && inner.t === 'num') return `#${fmt(-Number(inner.v))}`;
      return `-(${shapeKey(n.v)})`;
    }
    case 'fact': return `!(${shapeKey(n.v)})`;
    case 'call': return `${n.fn}(${(Array.isArray(n.args) ? n.args : [n.arg]).map(shapeKey).join(',')})`;
    case 'bin': {
      if (n.op === '+' || n.op === '-') return `+(${commutative(n, '+').map(shapeKey).sort().join(',')})`;
      if (n.op === '*' || n.op === '/') {
        const num = [], den = [];
        productFactors(n, num, den);
        const top = `*(${num.map(shapeKey).sort().join(',')})`;
        return den.length ? `${top}/(${den.map(shapeKey).sort().join(',')})` : top;
      }
      return `${n.op}(${shapeKey(n.l)},${shapeKey(n.r)})`;
    }
    default: return '?';
  }
}

const SHAPE_CAP = 512;

/** Substitute numbers for letters in an AST (letters without a value stay). */
function substituted(node, env) {
  const n = unwrap(node);
  if (!n || typeof n !== 'object') return n;
  switch (n.t) {
    case 'var': return Object.hasOwn(env, n.v) ? { t: 'num', v: env[n.v] } : n;
    case 'neg': return { t: 'neg', v: substituted(n.v, env) };
    case 'fact': return { t: 'fact', v: substituted(n.v, env) };
    case 'call': return Array.isArray(n.args)
      ? { ...n, args: n.args.map(a => substituted(a, env)) }
      : { ...n, arg: substituted(n.arg, env) };
    case 'bin': return { t: 'bin', op: n.op, l: substituted(n.l, env), r: substituted(n.r, env) };
    default: return n;
  }
}

/** Every way of partly evaluating a constant expression, as shape keys. */
function partialShapes(node, acc) {
  const n = unwrap(node);
  if (!n || typeof n !== 'object') return [n];
  const constant = variablesOf(n).size === 0;
  let variants;
  switch (n.t) {
    case 'num': case 'var': case 'const': variants = [n]; break;
    case 'neg': variants = partialShapes(n.v, acc).map(v => ({ t: 'neg', v })); break;
    case 'fact': variants = partialShapes(n.v, acc).map(v => ({ t: 'fact', v })); break;
    case 'call': {
      const args = Array.isArray(n.args) ? n.args : [n.arg];
      let combos = [[]];
      for (const arg of args) {
        const options = partialShapes(arg, acc);
        const next = [];
        for (const c of combos) { for (const o of options) { if (next.length >= SHAPE_CAP) break; next.push([...c, o]); } if (next.length >= SHAPE_CAP) break; }
        combos = next;
      }
      variants = combos.map(c => (Array.isArray(n.args) ? { ...n, args: c } : { ...n, arg: c[0] }));
      break;
    }
    case 'bin': {
      const ls = partialShapes(n.l, acc), rs = partialShapes(n.r, acc);
      variants = [];
      for (const l of ls) { for (const r of rs) { if (variants.length >= SHAPE_CAP) break; variants.push({ t: 'bin', op: n.op, l, r }); } if (variants.length >= SHAPE_CAP) break; }
      break;
    }
    default: variants = [n];
  }
  if (constant && n.t !== 'num') {
    const value = valueUnder(n, {});
    if (value !== null) variants = [...variants, { t: 'num', v: value }].slice(0, SHAPE_CAP);
  }
  if (acc) for (const v of variants) acc.add(shapeKey(v));
  return variants;
}

const SHAPES = new Map();

/**
 * The shapes a substitution step may take: the authored expression with the
 * given numbers in it, evaluated as far as the student liked at each node,
 * except the whole (the bare value is not a substitution shown).
 */
export function substitutionShapes(source, substitutions = {}) {
  const key = JSON.stringify([source, substitutions]);
  if (SHAPES.has(key)) return SHAPES.get(key);
  if (SHAPES.size > 500) SHAPES.clear();
  const shapes = new Set();
  const ast = astOf(source);
  if (ast && ast.t !== 'equation') {
    const filled = substituted(ast, substitutions);
    partialShapes(filled, shapes);
    const whole = valueUnder(filled, {});
    if (whole !== null) shapes.delete(`#${fmt(whole)}`);
  }
  SHAPES.set(key, shapes);
  return shapes;
}

/** Is this segment one of the shapes? (Never a bare number.) */
export function matchesShape(ast, shapes) {
  if (!ast || ast.t === 'equation' || !shapes?.size) return false;
  const n = unwrap(ast);
  if (!n || n.t === 'num' || (n.t === 'neg' && unwrap(n.v)?.t === 'num')) return false;
  return shapes.has(shapeKey(ast));
}

// ── The diagnosis of a false segment ─────────────────────────────────────────
const OPERATION = { '+': 'addition', '-': 'subtraction', '*': 'multiplication', '/': 'division', '^': 'power' };

/** "Check the addition: 9 + 24 equals 33, not 35." */
export function chainDiagnosis(fromText, fromAst, fromValue, toText, toValue) {
  // The computed side names the operation; the bare number is what it was called.
  if (isNumberText(fromText) && !isNumberText(toText)) {
    [fromText, fromAst, fromValue, toText, toValue] = [toText, null, toValue, fromText, fromValue];
    fromAst = astOf(fromText);
  }
  const op = OPERATION[unwrap(fromAst)?.op] || 'arithmetic';
  const toIsNumber = isNumberText(toText);
  // Two bare values (`T_9 = 33` then `= 35`): nothing was computed between them.
  if (toIsNumber && isNumberText(fromText)) {
    return {
      code: 'arithmetic-slip',
      title: 'A value changed between lines',
      message: `${fmt(toValue)} does not follow: the working above reached ${fmt(fromValue)}.`,
      fix: 'Carry the value the working reached, or redo the step that changed it.',
      confidence: 'high'
    };
  }
  // A formula in letters (`a + (n - 1)d = 35`) is wrong once its values are put in.
  const lettered = !!fromAst && fromAst.t !== 'equation' && variablesOf(fromAst).size > 0;
  const message = lettered
    ? (toIsNumber
      ? `Put the values into ${fromText}: it equals ${fmt(fromValue)}, not ${fmt(toValue)}.`
      : `Put the values into ${fromText}: it equals ${fmt(fromValue)}, but ${toText} equals ${fmt(toValue)}.`)
    : toIsNumber
      ? `Check the ${op}: ${fromText} equals ${fmt(fromValue)}, not ${fmt(toValue)}.`
      : `Check the ${op}: ${fromText} equals ${fmt(fromValue)}, but ${toText} equals ${fmt(toValue)}.`;
  return {
    code: 'arithmetic-slip',
    title: 'Arithmetic slip',
    message,
    fix: 'Redo this one calculation, then carry the rest of the working forward.',
    confidence: 'high'
  };
}

// ── Formula lines ────────────────────────────────────────────────────────────
// Sampled equivalence over the letters the student kept, with the givens fixed
// for the letters already substituted (`T_n = 9 + (n-1)3`). The sample points
// are fixed, so the verdict is the same every time.
const SAMPLES = [1.5, -2.25, 3.75, -0.5, 2.125, -3.375, 0.875, 4.5, -1.125, 2.75];

function sameFunction(a, b, free, fixed) {
  let checked = 0;
  for (let s = 0; s < SAMPLES.length; s++) {
    const env = { ...fixed };
    free.forEach((name, idx) => { env[name] = SAMPLES[(s + idx * 3) % SAMPLES.length]; });
    const va = valueUnder(a, env), vb = valueUnder(b, env);
    if (va === null || vb === null) continue;
    if (!sameValue(va, vb)) return false;
    checked++;
  }
  return checked >= 3;
}

/** Is this segment one of the forms, the letters the student has put numbers in for fixed by `env`? */
function statesForm(seg, forms, env) {
  const free = seg.letters || [];
  return forms.some(({ letters: formLetters = [], ast }) => {
    if (!ast || !free.every(v => formLetters.includes(v))) return false;
    // Letters of the form the student has not kept must be fixed by `env`.
    const fixed = {};
    for (const name of formLetters) {
      if (free.includes(name)) continue;
      if (!Object.hasOwn(env, name)) return false;
      fixed[name] = env[name];
    }
    return sameFunction(seg.ast, ast, free, fixed);
  });
}

/**
 * The values of a chain's segments under `env`, and the first segment that
 * disagrees with the last evaluable one before it (`at`, −1 when none does).
 * A segment with a letter `env` has no value for is passed over.
 */
function walkChain(segments, env) {
  const values = segments.map(seg => valueUnder(seg.ast, env));
  let last = -1;
  for (let k = 0; k < values.length; k++) {
    if (values[k] === null) continue;
    if (last !== -1 && !sameValue(values[last], values[k])) return { values, at: k, from: last, last: k };
    last = k;
  }
  return { values, at: -1, from: -1, last };
}

/**
 * A labelled formula line against the authored forms.
 *   meta: { kind: 'formula', labels: ['T_n', 'a_n'], forms: [{ expr: 'a + (n-1)*d', letters: ['a','n','d'] }],
 *           givens: { a: 9, d: 3, n: 9 }, carried: { a: 10 }, why: 'The nth term is a + (n − 1)d.',
 *           traps: [{ expr: 'a + n*d', why: '…n − 1 steps along, not n.' }] }
 * ok     — the right-hand side is one of the forms (or one with givens put in),
 *          and every number written after it on the line agrees with it: with
 *          the question's values, or (`ecf: true`) with the values the student
 *          carried from an earlier slip (`meta.carried`);
 * break  — it is written in the forms' letters and is a different function
 *          (`written` is that right-hand side, so a plan can carry it forward
 *          and read the substitution below it as true of the student's own
 *          formula — error carried forward), or the formula is right and a
 *          number written after it on the same line is not (`= 9 + 8 × 3 = 35`);
 * note   — anything else (no label, letters the forms do not have, no letters).
 * `value` is what the line reaches with the student's values; `trueValue` what
 * the right formula is worth on the question, when the givens fix every letter.
 */
export function assessFormulaLine({ text, meta = null, chain = null } = {}) {
  const forms = Array.isArray(meta?.forms) ? meta.forms.filter(f => f && typeof f.expr === 'string') : [];
  if (!forms.length) return { status: 'note', trusted: false, note: 'This formula stage is not configured safely.' };
  const labels = new Set((meta.labels || []).map(labelKey));
  const letters = [...new Set(forms.flatMap(f => f.letters || []))];
  const read = chain || readChain(text, { labels, letters, aliases: meta.aliases || null });
  if (!read || read.continuation || read.label === null || !labels.has(read.labelKey)) {
    return { status: 'note', trusted: false, note: 'Pri reads a formula only under its own label (for example T_n = …).' };
  }
  const givens = meta.givens && typeof meta.givens === 'object' ? meta.givens : {};
  const carried = meta.carried && typeof meta.carried === 'object' ? meta.carried : {};
  const carrying = Object.keys(carried).length > 0;
  const working = { ...givens, ...carried };
  const authored = forms.map(form => ({ letters: form.letters || [], ast: astOf(form.expr) }));
  let sawLetters = false, ecf = false, wrong = null;
  for (const seg of read.segments) {
    if (!seg.ast || seg.ast.t === 'equation' || seg.ambiguous) return { status: 'note', trusted: false, note: 'Skipped — I couldn’t read this formula safely.' };
    // `35/0`, `sqrt(-4)`: a value that does not exist is not judged, never ticked.
    if ((seg.letters || []).every(v => Object.hasOwn(givens, v) || Object.hasOwn(carried, v)) && valueUnder(seg.ast, { ...givens, ...carried }) === null) {
      return { status: 'note', trusted: false, note: 'Part of this line has no value, so Pri has not judged it.' };
    }
    const free = seg.letters || [];
    if (!free.length) continue;                              // numbers only: the line's arithmetic, judged below
    sawLetters = true;
    if (statesForm(seg, authored, givens)) continue;
    // The formula with a value the student carried from an earlier slip put in (`T_n = 10 + (n-1)3` after `a = 10`).
    if (carrying && statesForm(seg, authored, working)) { ecf = true; continue; }
    // In the forms' own letters (`n/2 (a + l) d` mixes the two sums') and
    // not the same function as any: a wrong formula.
    if (free.every(v => letters.includes(v))) { wrong = seg; break; }
    return { status: 'note', trusted: false, note: 'This uses a letter the formula does not, so Pri has not judged it.' };
  }
  if (!sawLetters) return { status: 'note', trusted: false, note: 'Numbers only here — judged as a substitution, not as the formula.' };
  // What the right formula is worth on this question (null when a letter has no given).
  const trueValue = authored.map(form => valueUnder(form.ast, givens)).find(v => v !== null) ?? null;
  const inWorking = walkChain(read.segments, working);
  const reached = inWorking.last === -1 ? null : inWorking.values[inWorking.last];
  if (wrong) {
    // A recognisable wrong formula (`a + nd`) is named; any other is told the right one.
    const traps = (Array.isArray(meta.traps) ? meta.traps : [])
      .filter(trap => trap && typeof trap.expr === 'string')
      .map(trap => ({ letters, ast: astOf(trap.expr), why: trap.why }));
    const trap = traps.find(t => statesForm(wrong, [t], givens));
    const message = trap && typeof trap.why === 'string' && trap.why ? trap.why
      : typeof meta.why === 'string' && meta.why ? meta.why : 'This is not the formula the question needs.';
    const diagnosis = {
      code: 'formula-error',
      title: 'The formula is not right',
      message,
      fix: 'Write the formula from the chapter, then substitute.',
      confidence: 'high'
    };
    return { status: 'break', trusted: false, note: diagnosis.message, diagnosis, written: rewriteAliases(wrong.text, meta.aliases || null), value: reached, trueValue };
  }
  // The formula is right. The numbers written after it on the same line are
  // its substitution and arithmetic, and each must agree with what stands
  // before it — with the question's values, or with the student's carried ones.
  if (!ecf) {
    const inQuestion = walkChain(read.segments, givens);
    if (inQuestion.at === -1) {
      const value = inQuestion.last === -1 ? null : inQuestion.values[inQuestion.last];
      return { status: 'ok', trusted: true, value, trueValue: trueValue ?? value };
    }
  }
  if (carrying && inWorking.at === -1) {
    return { status: 'ok', trusted: false, ecf: true, value: reached, trueValue, note: 'Correct, carrying the earlier slip forward.' };
  }
  const ev = carrying ? inWorking : walkChain(read.segments, givens);
  const from = read.segments[ev.from], to = read.segments[ev.at];
  const diagnosis = chainDiagnosis(from.text, from.ast, ev.values[ev.from], to.text, ev.values[ev.at]);
  return { status: 'break', trusted: false, note: diagnosis.message, diagnosis, value: ev.values[ev.last], trueValue };
}

// ── Givens ───────────────────────────────────────────────────────────────────
// `Given:`, `Here,`, `Let`, `We have`, `first term`: words that lead into a
// given, not part of it.
const LEAD_IN = /^(?:(?:given|that|here|let|we|have|where|with|the|first|last|common|number|of|terms?|difference)\b[\s:,.-]*)+/i;
const CLAUSE_BREAK = /\u0000|\s+(?:and|&)\s+|\s*&\s*|(?<=[\w.%°])\s+(?=[A-Za-z][A-Za-z0-9_{}₀-₉ₙₐₖₘᵢⱼ]*\s*=)/i;

/**
 * Read `a = 9, d = 3` (or `a = 9` alone, `a = 9 and d = 3`, `a = 9 d = 3`,
 * `Given: a = 9; d = 3.`) as copied givens.
 * Returns null when the line is not of that shape; otherwise
 *   { clauses: [{ letter, text, value, right, derived }] }
 * `value` is the number written; `right` whether it is the given. A clause for
 * a letter in `derived` (the last term, beside the givens) is read the same
 * way, `derived: true`; a line of derived letters alone is not a givens line.
 */
export function givensLine(text, givens = {}, { letters = [], aliases = null, derived = {} } = {}) {
  const raw = cleanLine(text, { letters });
  if (!raw || RELATION.test(raw.replace(/<=>/g, ''))) return null;
  const known = { ...(derived && typeof derived === 'object' ? derived : {}), ...givens };
  const clauses = markListCommas(raw.replace(LEAD_IN, ''), '\u0000')
    .split(CLAUSE_BREAK)
    .map(c => String(c ?? '').trim().replace(LEAD_IN, '').replace(/[.:]+$/, '').trim())
    .filter(Boolean);
  if (!clauses.length) return null;
  const out = [];
  for (const clause of clauses) {
    const m = clause.match(/^([A-Za-z][A-Za-z0-9_{}₀-₉ₙₐₖₘᵢⱼ]*)\s*=\s*([^=]+)$/);
    if (!m) return null;
    const letter = Object.keys(known).find(name => labelKey(name) === labelKey(m[1]))
      ?? Object.entries(aliases || {}).find(([, spellings]) => (spellings || []).some(s => labelKey(s) === labelKey(m[1])))?.[0];
    if (!letter || !Object.hasOwn(known, letter)) return null;
    // `₹150`, `12 months`: the number, without its currency sign or unit word.
    // Only a unit word, and nothing after it: `289 or 300`, `289 to 300` are not a given.
    const amount = m[2].trim().replace(/^(?:[₹$]|Rs\.?|INR)\s*/i, '');
    const unit = amount.match(/^([-+]?\d[\d,]*(?:\.\d+)?)\s*(?:rupees?|rs\.?|paise|months?|years?|days?|weeks?|terms?|cm|mm|km|m|kg|g|litres?|liters?|%|°)?\s*\.?$/i);
    const written = unit ? unit[1] : amount;
    if (listsValues(written) || hasWord(written)) return null;
    const value = valueUnder(astOf(written), {});
    if (value === null) return null;                       // not a number: not a copied given
    const isDerived = !Object.hasOwn(givens, letter);
    out.push({ letter, text: m[2].trim(), value, right: sameValue(value, Number(known[letter])), derived: isDerived });
  }
  if (!out.some(c => !c.derived)) return null;
  return { clauses: out };
}
