// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the first provably wrong line, beyond ordinary polynomials
//
// FEEDBACK ONLY (no mark, no `correct`, no method mark reads it). engine/falseStep.js decides WHEN a false continuation may be crossed (the
// question asks for a rewrite, the page is a plain chain). This file decides whether two sides are provably NOT equal when they are not both
// polynomials, and says exactly what is wrong. Everything is computed by the deterministic engine; nothing is guessed, no model is involved.
//
//   · wideReadable(text): the allow-list. A side is "fully understood" only when it is numbers, ONE real letter, + - * / ^, brackets, and the
//     functions sin cos tan ln log sqrt exp with their argument in brackets, and e only as a base. Anything else (a word, a second letter,
//     a modulus bar, a factorial, a degree sign, a function without brackets) is not read, and is never crossed.
//   · strictlyDiffer(above, written): at 24 fixed points (12 positive, 12 signed) at every point where BOTH sides are defined (8 or more of them) they differ. A rewrite that is true for some values (√(x²) = x for x > 0) is never crossed.
//   · closedNumbersDiffer(above, written): two closed numbers (no letter) that differ by more than rounding could explain.
//   · isPartialWide: the written line is the value of a proper part of the line above, or of an earlier side of the page: not a false rewrite.
//   · explainWide: what changed, why it is wrong, the corrected line and a check. A corrected line is told only when ONE single edit of the
//     written line (one number, one sign or one sin/cos) makes it equal to the line above at every point; otherwise it is left out.
//
// Pure, deterministic, no I/O.
// ─────────────────────────────────────────────────────────────────────────────
import { parse, normalize, evaluate } from './expr.js';
import { cleanStatement, exactForm } from './arithmeticLines.js';

const tidy = s => String(s ?? '').replace(/[−–—]/g, '-').replace(/[′’`]/g, "'").replace(/[×·]/g, '*').replace(/÷/g, '/').replace(/√\s*\(/g, 'sqrt(').replace(/π/g, 'pi').trim();
const FUNCS = new Set(['sin', 'cos', 'tan', 'ln', 'log', 'sqrt', 'exp']);

/** The closed list of error types a wide diagnosis may name (the poly types of falseStep.js are listed there). */
export const WIDE_ERROR_TYPES = Object.freeze(['sign-error', 'coefficient-wrong', 'constant-wrong', 'exponent-wrong', 'function-wrong', 'arithmetic-slip', 'term-not-equal']);

/**
 * { letter } when the side is fully understood: `letter` is the one real letter ('' for a closed number). null otherwise.
 */
export function wideReadable(text) {
  const t = tidy(text);
  if (!t || t.length > 120 || /[^0-9a-z+\-*/^().\s]/i.test(t)) return null;
  if (/[|!%°]/.test(t) || /\d\s+\d/.test(t) || /\.\s*\./.test(t)) return null;
  let letter = '';
  const words = t.match(/[a-z]+/gi) || [];
  for (const w of words) {
    const lw = w.toLowerCase();
    if (FUNCS.has(lw) || lw === 'pi') continue;
    if (lw === 'e') continue;
    if (w.length === 1) { if (letter && letter !== lw) return null; letter = lw; continue; }
    return null;   // a word, a glued pair of letters, a function not in the list
  }
  if (/[ij]/.test(letter)) return null;
  // a function is followed by its bracket, or by a power and its bracket: sin(x), sin^2(x)
  for (const m of t.matchAll(/(sin|cos|tan|ln|log|sqrt|exp)(?![a-z])/gi)) {
    const rest = t.slice(m.index + m[0].length);
    if (!/^\s*(?:\^\s*\d+\s*)?\(/.test(rest)) return null;
  }
  // e is a base only: e^(...), never a letter on its own
  for (const m of t.matchAll(/(?<![a-z])e(?![a-z])/gi)) { if (!/^\s*\^/.test(t.slice(m.index + 1))) return null; }
  return { letter };
}

const astOf = text => { try { const ast = parse(normalize(cleanStatement(tidy(text)))); return ast && ast.t !== 'equation' ? ast : null; } catch { return null; } };
const valueOfAst = (ast, v, x) => { try { const y = evaluate(ast, v ? { [v]: x } : {}); return typeof y === 'number' && Number.isFinite(y) ? y : null; } catch { return null; } };
const POS = [0.31, 0.57, 0.83, 1.12, 1.47, 1.9, 2.35, 2.8, 3.3, 4.1, 5.2, 6.7];
const SIGNED = [-2.7, -1.9, -1.3, -0.62, -0.28, 0.19, 0.44, 0.9, 1.6, 2.4, -3.6, -4.4];
// A point whose values are tiny or enormous cannot decide (rounding noise rules): it is skipped, never counted as a difference.
const decidable = (a, b) => { const m = Math.max(Math.abs(a), Math.abs(b)); return m >= 1e-3 && m <= 1e8; };
const far = (a, b) => decidable(a, b) && Math.abs(a - b) > 1e-6 * Math.max(Math.abs(a), Math.abs(b));
const fmt = x => exactForm(x).plain;

/** { example } when both sides are defined at the same points (8 or more) and differ at every one of them; null otherwise. */
export function strictlyDiffer(aboveText, writtenText, v) {
  const A = astOf(aboveText), B = astOf(writtenText);
  if (!A || !B) return null;
  let defined = 0;
  for (const x of [...POS, ...SIGNED]) {
    const a = valueOfAst(A, v, x), b = valueOfAst(B, v, x);
    if (a === null || b === null || !decidable(a, b)) continue;   // a point where one side is undefined decides nothing (ln(5x·3x) against ln(15x^3) for x < 0)
    defined++;
    if (!far(a, b)) return null;
  }
  if (defined < 8) return null;
  for (const x of [2, 1, 3, -1, 0.5, 1.5, 4]) {
    const a = valueOfAst(A, v, x), b = valueOfAst(B, v, x);
    if (a !== null && b !== null && far(a, b)) return { example: { at: [{ v, value: x }], above: Number(a.toPrecision(4)), written: Number(b.toPrecision(4)) } };
  }
  const x = POS[2], a = valueOfAst(A, v, x), b = valueOfAst(B, v, x);
  return { example: { at: [{ v, value: x }], above: Number(a.toPrecision(4)), written: Number(b.toPrecision(4)) } };
}

/** Two closed numbers that differ by more than rounding could explain (no decimals, or a difference over 1%). */
export function closedNumbersDiffer(aboveText, writtenText) {
  const ra = wideReadable(aboveText), rb = wideReadable(writtenText);
  if (!ra || !rb || ra.letter || rb.letter) return null;
  if (/\./.test(aboveText + writtenText)) return null;   // a decimal is an approximation: left as a note
  if (/(?<![a-z])(?:sin|cos|tan)/i.test(aboveText + writtenText) && !/pi/i.test(tidy(aboveText + writtenText))) return null;   // sin(30): degrees or radians is not said here
  const A = astOf(aboveText), B = astOf(writtenText);
  if (!A || !B) return null;
  const a = valueOfAst(A, null, 0), b = valueOfAst(B, null, 0);
  if (a === null || b === null || !far(a, b)) return null;
  // an irrational value written with a rounded integer or fraction is a different number, but only a clear gap is crossed
  if (Math.abs(a - b) <= 0.005 * Math.max(1, Math.abs(a), Math.abs(b))) return null;
  return { above: a, written: b };
}

// ── a proper part of the line above, or an earlier side of the page ─────────────────────────────────────────────────────
function flatTerms(ast) {
  let node = ast; while (node && node.t === 'group') node = node.v;
  const out = [];
  const walk = (n, s) => {
    if (n && n.t === 'bin' && (n.op === '+' || n.op === '-')) { walk(n.l, s); walk(n.r, n.op === '-' ? -s : s); }
    else if (n && n.t === 'neg') walk(n.v, -s);
    else out.push({ s, n });
  };
  walk(node, 1);
  return out;
}
function flatFactors(ast) {
  let node = ast; while (node && node.t === 'group') node = node.v;
  const out = [];
  const walk = n => { if (n && n.t === 'bin' && n.op === '*') { walk(n.l); walk(n.r); } else out.push(n); };
  walk(node);
  return out;
}
/** The written side equals (at every sample point) a proper sub-sum or sub-product of the line above, or an earlier side. */
export function isPartialWide(aboveText, writtenText, v, earlierSides = []) {
  const W = astOf(writtenText);
  if (!W) return true;   // unreadable: never crossed
  const xs = v ? [...POS.slice(0, 6), ...SIGNED.slice(0, 6)] : [0];
  const wv = xs.map(x => valueOfAst(W, v, x));
  const same = vals => vals.every((y, i) => (y === null) === (wv[i] === null) && (y === null || !far(y, wv[i]))) && vals.some(y => y !== null);
  // the written side equals a proper sub-sum or sub-product of this side
  const partOf = text => {
    const A = astOf(text); if (!A) return false;
    const terms = flatTerms(A);
    if (terms.length >= 2 && terms.length <= 8) {
      const tv = terms.map(t => xs.map(x => { const y = valueOfAst(t.n, v, x); return y === null ? null : t.s * y; }));
      for (let mask = 1; mask < (1 << terms.length) - 1; mask++) {
        const vals = xs.map((_, i) => { let sum = 0; for (let k = 0; k < terms.length; k++) if (mask & (1 << k)) { if (tv[k][i] === null) return null; sum += tv[k][i]; } return sum; });
        if (same(vals)) return true;
      }
    }
    const facs = flatFactors(A);
    if (facs.length >= 2 && facs.length <= 6) {
      const fv = facs.map(f => xs.map(x => valueOfAst(f, v, x)));
      for (let mask = 1; mask < (1 << facs.length) - 1; mask++) {
        const vals = xs.map((_, i) => { let p = 1; for (let k = 0; k < facs.length; k++) if (mask & (1 << k)) { if (fv[k][i] === null) return null; p *= fv[k][i]; } return p; });
        if (same(vals)) return true;
      }
    }
    return false;
  };
  if (partOf(aboveText)) return true;
  for (const e of earlierSides) {
    const E = astOf(e); if (!E) continue;
    if (same(xs.map(x => valueOfAst(E, v, x)))) return true;   // a restart from an earlier side
    if (partOf(e)) return true;                                 // or from a piece of one
  }
  return false;
}

// ── what is wrong: a single-edit repair of the written line ─────────────────────────────────────────────────────────────
const equalEverywhere = (aboveAst, text, v) => {
  const B = astOf(text); if (!B) return false;
  let defined = 0;
  for (const x of v ? [...POS, ...SIGNED] : [0]) {
    const a = valueOfAst(aboveAst, v, x), b = valueOfAst(B, v, x);
    if ((a === null) !== (b === null)) return false;
    if (a === null || !decidable(a, b)) continue;
    defined++;
    if (far(a, b)) return false;
  }
  return defined >= (v ? 8 : 1);
};
/** The top-level terms of a side with their offsets: [{ text, from, to }]. */
function termSpans(side) {
  const t = side; const out = []; let depth = 0, start = 0;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (ch === '(') depth++; if (ch === ')') depth--;
    const prev = t.slice(0, i).trimEnd().slice(-1);
    if (depth === 0 && (ch === '+' || ch === '-') && t.slice(start, i).trim() !== '' && prev !== '^' && prev !== '(' && prev !== '*' && prev !== '/') { out.push({ from: start, to: i }); start = i; }
  }
  out.push({ from: start, to: t.length });
  return out.map(o => ({ ...o, text: t.slice(o.from, o.to).trim() }));
}
const termAt = (side, pos) => (termSpans(side).find(s => pos >= s.from && pos < s.to) || { text: side.trim() }).text.replace(/^\+\s*/, '');

/**
 * Every single edit of the written side that makes it equal to the line above at every point: [{ type, from, to, term, text }] where `text`
 * is the corrected side.
 */
export function repairOf(aboveSide, writtenSide, v) {
  const Aast = astOf(aboveSide); if (!Aast) return null;
  const w = String(writtenSide).trim();
  const nums = [...new Set((String(aboveSide).match(/\d+(?:\.\d+)?/g) || []).map(Number))];
  const cand = new Set([...nums, ...Array.from({ length: 61 }, (_, i) => i)]);
  for (const a of nums) for (const b of nums) { cand.add(a + b); cand.add(Math.abs(a - b)); cand.add(a * b); for (const c of nums) cand.add(a * b * c); }
  const found = [];
  const add = (type, from, to, term, text) => { if (!found.some(f => f.text.replace(/\s+/g, '') === text.replace(/\s+/g, ''))) found.push({ type, from, to, term, text }); };
  // one number
  for (const m of w.matchAll(/\d+(?:\.\d+)?/g)) {
    const old = m[0];
    const before = w.slice(0, m.index).trimEnd().slice(-1), after = w.slice(m.index + old.length).trimStart().charAt(0);
    const type = before === '^' ? 'exponent-wrong' : /[a-z(]/i.test(after) && !/^\s*\^/.test(w.slice(m.index + old.length)) ? 'coefficient-wrong' : 'constant-wrong';
    for (const c of cand) {
      const cs = String(c);
      if (cs === String(Number(old))) continue;
      const text = `${w.slice(0, m.index)}${cs}${w.slice(m.index + old.length)}`;
      if (equalEverywhere(Aast, text, v)) add(type, old, cs, termAt(w, m.index), text);
    }
  }
  // one sign
  for (let i = 0; i < w.length; i++) {
    const ch = w[i];
    if (ch !== '+' && ch !== '-') continue;
    const prev = w.slice(0, i).trimEnd().slice(-1);
    if (prev === '^' || prev === '(' || prev === '*' || prev === '/') continue;
    const flipped = ch === '+' ? '-' : '+';
    let text = `${w.slice(0, i)}${flipped}${w.slice(i + 1)}`;
    if (i === 0 && ch === '-') text = w.slice(1).trimStart();
    if (equalEverywhere(Aast, text, v)) add('sign-error', ch, flipped, termAt(w, i + 1).replace(/^[+-]\s*/, ''), text);
  }
  // one sin/cos swapped
  for (const m of w.matchAll(/(?<![a-z])(sin|cos)(?![a-z])/g)) {
    const other = m[1] === 'sin' ? 'cos' : 'sin';
    const text = `${w.slice(0, m.index)}${other}${w.slice(m.index + 3)}`;
    if (equalEverywhere(Aast, text, v)) add('function-wrong', m[1], other, termAt(w, m.index), text);
  }
  return found;
}

const WHY = Object.freeze({
  // each sentence states only what the engine verified for THESE two lines: the one change that makes the written line equal the line above
  'sign-error': 'Changing only the sign in front of {term} makes this line equal to the line above, so that sign is the slip.',
  'coefficient-wrong': 'Putting {to} in place of {from} makes this line equal to the line above, so the coefficient {from} is the slip.',
  'constant-wrong': 'Putting {to} in place of {from} makes this line equal to the line above, so the number {from} is the slip.',
  'exponent-wrong': 'Putting {to} in place of {from} makes this line equal to the line above, so the power {from} is the slip.',
  'function-wrong': 'Putting {to} in place of {from} makes this line equal to the line above, so {from} is the wrong function here.',
  'term-not-equal': 'More than one single change would fix the term {term}, so no one number or sign is to blame: work that term again from the line above.',
  'arithmetic-slip': 'Working out {above} gives {value}, not {written}.'
});
const fillw = (t, slots) => t.replace(/\{(\w+)\}/g, (_, k) => slots[k]);
const sentence = s => `${s.charAt(0).toUpperCase()}${s.slice(1)}`;
const squash = t => String(t).replace(/\s+/g, ' ').trim();

// ── an exact value, where the working is exact ──────────────────────────────────────────────────────────────────────────
const gcdB = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a || 1n; };
const fr = (n, d = 1n) => { if (d < 0n) { n = -n; d = -d; } const g = gcdB(n, d); return { n: n / g, d: d / g }; };
function decimalFraction(str) { const m = /^(\d+)(?:\.(\d+))?$/.exec(String(str)); if (!m) return null; const f = m[2] || ''; return fr(BigInt(m[1] + f), 10n ** BigInt(f.length)); }
/** The value of an arithmetic tree as an exact fraction ({ n, d } BigInt), or null when it holds anything but + - × ÷ and whole powers. */
function exactTree(node) {
  if (!node || typeof node !== 'object') return null;
  switch (node.t) {
    case 'num': return decimalFraction(String(node.s ?? node.v));
    case 'group': return exactTree(node.v);
    case 'neg': { const a = exactTree(node.v); return a ? fr(-a.n, a.d) : null; }
    case 'bin': {
      const a = exactTree(node.l); if (!a) return null;
      if (node.op === '^') { let ex = node.r; while (ex && ex.t === 'group') ex = ex.v; const e = ex && ex.t === 'num' ? Number(ex.v) : NaN; if (!Number.isInteger(e) || Math.abs(e) > 12) return null; let r = fr(1n); for (let k = 0; k < Math.abs(e); k++) r = fr(r.n * a.n, r.d * a.d); return e < 0 ? (r.n === 0n ? null : fr(r.d, r.n)) : r; }
      const b = exactTree(node.r); if (!b) return null;
      if (node.op === '+') return fr(a.n * b.d + b.n * a.d, a.d * b.d);
      if (node.op === '-') return fr(a.n * b.d - b.n * a.d, a.d * b.d);
      if (node.op === '*') return fr(a.n * b.n, a.d * b.d);
      if (node.op === '/') return b.n === 0n ? null : fr(a.n * b.d, a.d * b.n);
      return null;
    }
    default: return null;
  }
}
/** { text, exact } : the value of a closed side in the form a student writes it (8/15, 6√6), or a 4 decimal place value marked as rounded. */
function valueText(side, value) {
  const ast = astOf(side); const f = ast ? exactTree(ast) : null;
  if (f) return { text: f.d === 1n ? String(f.n) : `${f.n}/${f.d}`, exact: true };
  const plain = exactForm(value).plain;
  if (!/\./.test(plain)) return { text: plain, exact: true };
  return { text: String(Number(value.toPrecision(4))), fixed: String(Number(value.toFixed(4))), exact: false };
}
/** The step √N = k√m for a lone square root, or null. */
function surdStep(aboveSide) {
  const m = /^\s*(?:sqrt|√)\s*\(?\s*(\d+)\s*\)?\s*$/.exec(tidy(aboveSide).replace(/sqrt/, 'sqrt'));
  if (!m) return null;
  const N = Number(m[1]);
  let k = 1; for (let c = 2; c * c <= N; c++) if (N % (c * c) === 0) k = c;
  const r = N / (k * k);
  return k > 1 && r > 1 ? `${N} = ${k * k} × ${r}, so √${N} = ${k}√${r}` : null;
}

/** The terms and tokens of the written line the diagnosis quotes: each must be a substring of what the student wrote (spaces aside). */
const quoteOf = (writtenSide, bits) => bits.filter(Boolean).map(b => String(b));

/**
 * Everything computed about a false continuation of two sides that are not both polynomials: { type?, whatChanged?, whyWrong?, corrected?,
 * check?, checkAt?, quoted?, exact: false }. null when a side is not readable. Each field only when it was computed.
 */
export function explainWide(aboveSide, writtenSide, strict = null) {
  const ra = wideReadable(aboveSide), rb = wideReadable(writtenSide);
  if (!ra || !rb) return null;
  const out = { exact: false };
  const writtenAsWritten = squash(writtenSide), aboveAsWritten = squash(aboveSide);
  if (!ra.letter && !rb.letter) {
    const d = closedNumbersDiffer(aboveSide, writtenSide);
    if (!d) return null;
    const computed = /[-+*/^(]|sqrt|√/.test(aboveAsWritten.replace(/^\s*-/, ''));   // a bare number above is a value, not a calculation to work out again
    const A = valueText(aboveSide, d.above), B = valueText(writtenSide, d.written);
    const isBare = /^-?\d+(?:\.\d+)?$/.test(writtenAsWritten);
    out.whatChanged = `The line above works out to ${A.exact ? '' : 'about '}${A.text}. This line says ${writtenAsWritten}${isBare ? '' : `, which is ${B.exact ? '' : 'about '}${B.text}`}.`;
    out.quoted = quoteOf(writtenSide, [writtenAsWritten]);
    const step = surdStep(aboveSide);
    if (step) { out.type = 'arithmetic-slip'; out.whyWrong = sentence(`${step}.`); }
    else if (computed && A.text.replace(/\s+/g, '') !== aboveAsWritten.replace(/\s+/g, '')) { out.type = 'arithmetic-slip'; out.whyWrong = sentence(fillw(WHY['arithmetic-slip'], { above: aboveAsWritten, value: `${A.exact ? '' : 'about '}${A.text}`, written: `${B.exact ? '' : 'about '}${B.text}` })); }
    if (computed || step) out.check = A.exact ? `Check: ${aboveAsWritten} = ${A.text}.` : `Check: ${aboveAsWritten} is about ${A.fixed}, to 4 decimal places.`;
    out.corrected = A.exact ? `= ${A.text}` : `≈ ${A.fixed} (4 decimal places)`;
    out.correctedValue = d.above;
    return out;
  }
  const v = ra.letter || rb.letter;
  const st = strict || strictlyDiffer(aboveSide, writtenSide, v);
  if (!st) return null;
  const e = st.example;
  out.check = `At ${v} = ${e.at[0].value} the line above gives ${e.above} but this line gives ${e.written}.`;
  out.checkAt = { v, x: e.at[0].value, above: String(e.above), written: String(e.written) };
  const fixes = repairOf(aboveSide, writtenSide, v);
  const fix = fixes.length === 1 ? fixes[0] : null;
  const swaps = fixes.length > 1 && fixes.every(f => f.type === 'function-wrong' && f.from === fixes[0].from && f.to === fixes[0].to && f.term === fixes[0].term) ? fixes[0] : null;
  if (swaps) {
    // one factor is the wrong function: either of the repeated factors may be the one meant, so the engine says that, and no more
    out.type = 'function-wrong';
    out.corrected = `= ${swaps.text.trim()}`;
    out.whatChanged = `One of the ${swaps.from} factors in the term ${swaps.term} should be ${swaps.to}.`;
    out.whyWrong = `Changing one ${swaps.from} to ${swaps.to} makes this line equal to the line above, so that factor is the slip.`;
    out.quoted = quoteOf(writtenSide, [swaps.term]);
  } else if (!fix && fixes.length > 1 && fixes.every(f => f.term === fixes[0].term)) {
    out.type = 'term-not-equal';
    out.corrected = `= ${fixes[0].text.trim()}`;
    out.whatChanged = `The term ${fixes[0].term} is not equal to what the line above gives.`;
    out.whyWrong = sentence(fillw(WHY['term-not-equal'], { term: fixes[0].term }));
    out.quoted = quoteOf(writtenSide, [fixes[0].term]);
  }
  if (fix) {
    out.type = fix.type;
    out.corrected = `= ${fix.text.trim()}`;
    const term = fix.term;
    out.whatChanged = fix.type === 'sign-error' ? `The sign in front of ${term} is ${fix.from === '-' ? 'minus' : 'plus'} here, but the line above has ${fix.to === '-' ? 'minus' : 'plus'}.`
      : fix.type === 'function-wrong' ? `The term ${term} uses ${fix.from}, but the line above needs ${fix.to}.`
        : `The ${fix.type === 'coefficient-wrong' ? 'coefficient' : fix.type === 'exponent-wrong' ? 'power' : 'number'} ${fix.from} in the term ${term} should be ${fix.to}.`;
    out.whyWrong = sentence(fillw(WHY[fix.type], { from: fix.from, to: fix.to, term }));
    out.quoted = quoteOf(writtenSide, [term]);
  }
  return out;
}

/** The value of a closed number side (no letter) read from the allow-list, or null. */
export function closedValue(text) {
  const r = wideReadable(text);
  if (!r || r.letter) return null;
  const ast = astOf(text);
  return ast ? valueOfAst(ast, null, 0) : null;
}

/** Two sides (text) are the same function at every sample point (or the same closed number): the engine's own test of a corrected line. */
export function sameEverywhere(aText, bText) {
  const ra = wideReadable(aText), rb = wideReadable(bText);
  if (!ra || !rb || ra.letter !== rb.letter) return false;
  const A = astOf(aText);
  return !!A && equalEverywhere(A, bText, ra.letter);
}
/** The value of a side at x (a plain number), or null: used to re-check the numbers a diagnosis quotes. */
export function valueAtText(text, v, x) {
  const A = astOf(text);
  return A ? valueOfAst(A, v, x) : null;
}
