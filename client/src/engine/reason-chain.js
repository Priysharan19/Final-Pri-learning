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
//                     student has already substituted.
//   · givensLine    — `a = 9, d = 3` read as copied givens, each right or wrong.
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

const isNumberText = s => /^[-+]?\d+(?:\.\d+)?$/.test(String(s).trim());
const IDENTIFIER = /^[A-Za-z][A-Za-z0-9_{}₀-₉ₙₐₖₘᵢⱼ]*(?:\s+[A-Za-z]+)*$/;

function astOf(text) {
  try { return parse(normalize(text)); } catch { return null; }
}

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
 * no readable expression, or more than one `=`-chain such as `a = 9, d = 3`).
 *
 *   { continuation, label, labelKey, segments: [{ text, ast, letters }] }
 *
 * `label` is the first part when it names a result rather than computing one:
 * a known label of the plan (`T_9`), or an identifier the engine cannot
 * evaluate under the plan's letters (`S`, `tn`). `letters` are the free
 * letters of each segment.
 */
export function readChain(text, { labels = new Set(), letters = [], aliases = null } = {}) {
  const raw = cleanLine(text, { letters });
  if (!raw || RELATION.test(raw.replace(/<=>/g, ''))) return null;
  if (raw.includes(',') || raw.includes(';')) return null;
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
  const segments = bodies.map(part => {
    const ast = astOf(rewriteAliases(part, aliases));
    return { text: part, ast, letters: ast ? [...variablesOf(ast)] : null };
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
const fmt = v => String(Number(Number(v).toPrecision(12)));

/** The shape of an expression as written. */
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
      if (n.op === '+' || n.op === '-' || n.op === '*') {
        const op = n.op === '-' ? '+' : n.op;
        return `${op}(${commutative(n, op).map(shapeKey).sort().join(',')})`;
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
  const message = toIsNumber
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

/**
 * A labelled formula line against the authored forms.
 *   meta: { kind: 'formula', labels: ['T_n', 'a_n'], forms: [{ expr: 'a + (n-1)*d', letters: ['a','n','d'] }],
 *           givens: { a: 9, d: 3 }, why: 'The nth term is a + (n − 1)d …' }
 * ok     — the right-hand side is one of the forms (or one with givens put in);
 * break  — it is written in the forms' letters and is a different function;
 *          `written` is that right-hand side, so a plan can carry it forward
 *          and read the substitution below it as true of the student's own
 *          formula (error carried forward);
 * note   — anything else (no label, letters the forms do not have, no letters).
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
  let sawLetters = false, broke = false, written = null;
  for (const seg of read.segments) {
    if (!seg.ast || seg.ast.t === 'equation') return { status: 'note', trusted: false, note: 'Skipped — I couldn’t read this formula safely.' };
    const free = seg.letters || [];
    if (!free.length) continue;                              // numbers only: a substitution, not the formula
    sawLetters = true;
    const matched = forms.some(form => {
      const formLetters = form.letters || [];
      if (!free.every(v => formLetters.includes(v))) return false;
      // Letters of the form the student has not kept must be fixed by the givens.
      const fixed = {};
      for (const name of formLetters) {
        if (free.includes(name)) continue;
        if (!Object.hasOwn(givens, name)) return false;
        fixed[name] = givens[name];
      }
      const formAst = astOf(form.expr);
      return !!formAst && sameFunction(seg.ast, formAst, free, fixed);
    });
    if (!matched) {
      // In the forms' own letters (`n/2 (a + l) d` mixes the two sums') and
      // not the same function as any: a wrong formula.
      const inLetters = free.every(v => letters.includes(v));
      if (inLetters) { broke = true; written = rewriteAliases(seg.text, meta.aliases || null); break; }
      return { status: 'note', trusted: false, note: 'This uses a letter the formula does not, so Pri has not judged it.' };
    }
  }
  if (!sawLetters) return { status: 'note', trusted: false, note: 'Numbers only here — judged as a substitution, not as the formula.' };
  if (broke) {
    const diagnosis = {
      code: 'formula-error',
      title: 'The formula is not right',
      message: typeof meta.why === 'string' && meta.why ? meta.why : 'This is not the formula the question needs.',
      fix: 'Write the formula from the chapter, then substitute.',
      confidence: 'high'
    };
    return { status: 'break', trusted: false, note: diagnosis.message, diagnosis, written };
  }
  return { status: 'ok', trusted: true };
}

// ── Givens ───────────────────────────────────────────────────────────────────
/**
 * Read `a = 9, d = 3` (or `a = 9` alone) as copied givens.
 * Returns null when the line is not of that shape; otherwise
 *   { clauses: [{ letter, text, value, right }] }
 * `value` is the number written (null when unreadable); `right` whether it is
 * the given.
 */
export function givensLine(text, givens = {}, { letters = [], aliases = null } = {}) {
  const raw = cleanLine(text, { letters });
  if (!raw || RELATION.test(raw.replace(/<=>/g, ''))) return null;
  const clauses = raw.split(/[,;]/).map(c => c.trim()).filter(Boolean);
  if (!clauses.length) return null;
  const out = [];
  for (const clause of clauses) {
    const m = clause.match(/^([A-Za-z][A-Za-z0-9_{}₀-₉ₙₐₖₘᵢⱼ]*)\s*=\s*([^=]+)$/);
    if (!m) return null;
    const letter = Object.keys(givens).find(name => labelKey(name) === labelKey(m[1]))
      ?? Object.entries(aliases || {}).find(([, spellings]) => (spellings || []).some(s => labelKey(s) === labelKey(m[1])))?.[0];
    if (!letter || !Object.hasOwn(givens, letter)) return null;
    // `₹150`, `12 months`: the number, without its currency sign or unit word.
    const written = m[2].trim().replace(/^(?:[₹$]|Rs\.?|INR)\s*/i, '').replace(/^([-+]?\d+(?:\.\d+)?)\s+[A-Za-z%°]+.*$/, '$1');
    const value = valueUnder(astOf(written), {});
    if (value === null) return null;                       // not a number: not a copied given
    out.push({ letter, text: m[2].trim(), value, right: sameValue(value, Number(givens[letter])) });
  }
  return { clauses: out };
}
