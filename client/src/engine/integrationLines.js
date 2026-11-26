// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · integration working, checked line by line and claim by claim (feedback only, 26 November 2026)
//
// A page of integration (a direct integral, the reverse chain rule, integration by substitution) is a list of STATEMENTS about one integral:
// a substitution `Let u = x² + 8`, its derivative `du/dx = 2x`, its differential `du = 2x dx`, a change of variable
// `∫ 12x (x² + 8)⁵ dx = ∫ 6u⁵ du`, an antiderivative `∫ 6u⁵ du = u⁶ + C`, a back-substitution. A student writes several on one line.
// This pass reads each line as its CLAIMS, proves each one on its own, and decides the line from all of them:
//
//   · TICKED   only when EVERY maths claim on the line is proved (a definition counts as stated, not as proved);
//   · CROSSED  when one claim is PROVABLY FALSE, and the sentence names that claim;
//   · NEUTRAL  a line that only defines the substitution (`Let u = x² + 8`) when later lines go on to use it;
//   · UNCHANGED (a note) for anything else: a claim it cannot read, a missing dx or du, words that are not on the connective list,
//     an integral with no + C, a logarithm whose argument changes sign and has no modulus, a function the engine cannot differentiate.
//
// Words between claims are ignored only if they are on the fixed list CONNECTIVES below. Any other word makes the line unread.
//
// THE PROOF STANDARD (the engine's own, nothing weaker):
//   · every derivative is EXACT and symbolic (reason-v2.js differentiateAst; sec, cosec, cot and the modulus are first rewritten to cos, sin, sqrt(u²));
//     a function it cannot differentiate gives no verdict, never a numeric stencil;
//   · two functions are the same when they agree at every one of at least EIGHT sample points inside their common domain to a relative 1e-9
//     (the sampled-identity standard of expr.js exprEquivalent and calculusSteps.js sameFunction); they are DIFFERENT only when they disagree
//     by more than a relative 1e-6 at a point where both are defined, with at least three comparable points; otherwise there is no verdict;
//   · an integral is compared through its integrand per dx: ∫ g(u) du is g(u(x))·u'(x) per dx, so a change of variable is the identity
//     f(x) = g(u(x))·u'(x); an antiderivative F + C is the integrand F'(x);
//   · a definite integral is worked out numerically (Simpson, n = 2000) exactly as arithmeticLines.js does, and only for a TICK, never a cross,
//     except that limits left unchanged after a change of variable are crossed when the two integrals provably differ.
//
// It never touches a mark: it returns a copy of the DISPLAYED report only (server/platform/markerOps.js `shownReport`). Pure, deterministic,
// no model, no network, no clock. Australian edition (NSW Years 11-12) questions only; the caller gates that.
// ─────────────────────────────────────────────────────────────────────────────
import { normalize, parse, evaluate, variablesOf, ambiguousForms } from './expr.js';
import { differentiateAst } from './reason-v2.js';
import { texToPlain } from './texToPlain.js';

export const INTEGRATION_CLASSES = Object.freeze([
  'substitution-defined', 'substitution-consistent', 'derivative-of-substitution', 'differential-form', 'change-of-variable', 'integral-rewritten',
  'antiderivative-checked', 'back-substitution', 'equivalent-expressions', 'definite-integral-evaluated', 'several-claims'
]);

/** The words allowed between claims, and nowhere else. */
export const CONNECTIVES = Object.freeze([
  'so', 'then', 'hence', 'also', 'and', 'thus', 'therefore', 'now', 'here', 'where', 'with', 'since', 'because', 'as', 'giving', 'gives', 'we have', 'we get',
  'this gives', 'which gives', 'using', 'similarly', 'finally', 'next', 'note that', 'recall', 'solution',
  'let', 'put', 'set', 'use', 'take', 'choose', 'substituting back', 'substitute back', 'back substituting', 'back-substituting', 'substituting', 'substitute', 'sub',
  'integrating', 'integrate', 'differentiating', 'differentiate', 'we integrate', 'we substitute'
]);
const DEFINING = new Set(['let', 'put', 'set', 'use', 'take', 'choose', 'substituting', 'substitute', 'sub', 'we substitute']);
const BACK = new Set(['substituting back', 'substitute back', 'back substituting', 'back-substituting']);
const CONN_RE = new RegExp(`^(?:\\(?(?:[a-h]|i{1,3}|iv)\\)\\s*|step\\s*\\d+\\s*[:.)]?\\s*|(?:${[...CONNECTIVES].sort((a, b) => b.length - a.length).map(w => w.replace(/[-\s]/g, '[-\\s]')).join('|')})(?![A-Za-z])\\s*[:,]?\\s*|∴\\s*)`, 'i');
const TRAIL_RE = /(?:^|\s)(?:so|then|hence|also|and|thus|therefore|where|with|gives|giving)\s*[:,]?\s*$/i;
const SPLIT_WORD = /\s(?:so|then|hence|also|and|thus|therefore|giving|gives)\s/i;

const SAMPLES = Object.freeze([-3.71, -2.93, -2.27, -1.73, -1.19, -0.67, -0.31, 0.23, 0.47, 0.83, 1.17, 1.61, 2.07, 2.53, 3.11, 3.61, 4.19, 5.31, 6.07, 7.43]);
const FN_WORDS = /(?:arcsin|arccos|arctan|asin|acos|atan|sqrt|cbrt|cosec|csc|sec|sin|cos|tan|cot|ln|log|exp|abs|pi|theta)/g;
const CONSTANT_TERM = /^(?:[CcKk])(?:[0-9₀-₉]|_\d|_\{\d\})?$/;
const SUBLETTERS = 'uvwtzs';

const tidy = t => String(t ?? '').replace(/[−–—]/g, '-').replace(/[×·⋅]/g, '*').replace(/[⁄∕]/g, '/').replace(/\\boxed\{([^}]*)\}/g, '$1').replace(/\s*[(\[]\s*boxed(?:\s+answer)?\s*[)\]]/gi, '').replace(/^\s*\[\s*([^\[\]]*\S)\s*\]\s*[.]?\s*$/, '$1').replace(/=\s*\[\s*([^\[\]]*\S)\s*\]\s*[.]?\s*$/, '= $1').replace(/\s+/g, ' ').trim();
const close = (a, b, rel = 1e-9) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= rel * Math.max(1, Math.abs(a), Math.abs(b));
const lettersOf = ast => { const s = variablesOf(ast); s.delete('e'); return s; };
const wordsLeft = s => /[A-Za-z]{3,}/.test(s.replace(FN_WORDS, ''));

// ── reading text ─────────────────────────────────────────────────────────────
const tryParse = txt => {
  try {
    let t = String(txt).replace(/\|([^|]+)\|/g, 'abs($1)');
    const ast = parse(normalize(t));
    return ast && ast.t !== 'equation' ? ast : null;
  } catch { return null; }
};
// `a/bc` is a/b·c to the engine and a/(bc) to many students; `log` is base 10 to the engine and the natural log to many students. Neither is read: no tick, no cross.
const SLASH_AMBIGUOUS = /\/\s*[A-Za-z0-9.]+\s*[A-Za-z(]/;
// `cos3x(x + 1)` and `sin2x y`: a function with a bare argument followed by another factor has no one reading (expr.js FUNCTION_ARGUMENT_RULE 6). Not read.
const BARE_FN = /(?<![A-Za-z])(?:arcsin|arccos|arctan|sin|cos|tan|sec|cosec|csc|cot|ln|exp)(?:\s*\^\s*\(?-?\d+\)?)?\s*(?!\()(?:(\d+(?:\.\d+)?)\s*([a-zπθ])?|([a-zπθ]))/g;
const FN_START = /^(?:arcsin|arccos|arctan|sin|cos|tan|sec|cosec|csc|cot|ln|exp|sqrt|pi)/;
function bareArgumentAmbiguous(t) {
  for (const m of String(t).matchAll(BARE_FN)) {
    const rest = String(t).slice(m.index + m[0].length).trimStart();
    if (/^[A-Za-z(0-9πθ^!]/.test(rest) && !FN_START.test(rest)) return true;
  }
  return false;
}
const readable = txt => { try { const t = String(txt).replace(/\s*(?<![A-Za-z])d[a-z]\s*$/, ''); return ambiguousForms(txt).length === 0 && !bareArgumentAmbiguous(t) && !SLASH_AMBIGUOUS.test(t) && !/(?<![A-Za-z])log(?![A-Za-z])/i.test(String(txt)); } catch { return false; } };

/** Top-level split of `text` at the single characters in `seps` (depth 0 of ()[]{}), plus `.` before a space or the end. */
function splitTop(text, seps, { dots = false } = {}) {
  const out = []; let depth = 0, start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) depth = Math.max(0, depth - 1);
    else if (depth === 0 && (seps.includes(ch) || (dots && ch === '.' && (i === text.length - 1 || /\s/.test(text[i + 1]))))) { out.push(text.slice(start, i)); start = i + 1; }
  }
  out.push(text.slice(start));
  return out.map(s => s.trim()).filter(s => s !== '');
}
/** Splits at top-level `=` (not <=, >=, !=). */
function sidesOf(text) {
  const out = []; let depth = 0, start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) depth = Math.max(0, depth - 1);
    else if (ch === '=' && depth === 0 && (i === 0 || !'<>≤≥≠!'.includes(text[i - 1]))) { out.push(text.slice(start, i).trim()); start = i + 1; }
  }
  out.push(text.slice(start).trim());
  return out;
}

/**
 * A line as its pieces: [{ text, defining, back, words }] in order. Arrows, full stops, commas, semicolons and the connective words split it;
 * the connective words themselves are dropped, and a piece that still holds another word is marked `words`.
 */
export function claimTexts(line) {
  let s = tidy(line).replace(/\(boxed\)\s*$/i, '').trim();
  if (!s) return [];
  let pieces = [];
  // arrows first (⇒ ⟹ => → written between claims)
  const parts = s.split(/\s*(?:⇒|⟹|=>|⟶)\s*/);
  for (const part of parts) for (const p of splitTop(part, ';,', { dots: true })) {
    // the connective words between two claims on one piece: "du = 2x dx and dv = 3 dx"
    let rest = p;
    for (let guard = 0; guard < 6; guard++) {
      const m = SPLIT_WORD.exec(rest);
      if (!m) break;
      pieces.push(rest.slice(0, m.index)); rest = rest.slice(m.index + m[0].length - 1);
    }
    pieces.push(rest);
  }
  const out = [];
  for (let piece of pieces) {
    let defining = false, back = false;
    piece = piece.trim();
    for (let guard = 0; guard < 8; guard++) {
      const m = CONN_RE.exec(piece);
      if (!m || !m[0].trim()) break;
      const w = m[0].trim().toLowerCase().replace(/[:,]$/, '').replace(/\s+/g, ' ').trim();
      if (DEFINING.has(w)) defining = true;
      if (BACK.has(w) || BACK.has(w.replace('-', ' '))) back = true;
      piece = piece.slice(m[0].length).trim();
    }
    for (let guard = 0; guard < 4 && TRAIL_RE.test(piece); guard++) piece = piece.replace(TRAIL_RE, '').trim();
    piece = piece.replace(/^[:,;.\s]+|[.:;,\s]+$/g, '').trim();
    if (!piece) continue;
    out.push({ text: piece, defining, back, words: wordsLeft(piece) });
  }
  return out;
}

// ── symbolic helpers ─────────────────────────────────────────────────────────
const N = v => ({ t: 'num', v });
const B = (op, l, r) => ({ t: 'bin', op, l, r });
function lower(ast) {
  if (!ast || typeof ast !== 'object') return ast;
  const rec = a => lower(a);
  switch (ast.t) {
    case 'group': return lower(ast.v);
    case 'neg': return { t: 'neg', v: rec(ast.v) };
    case 'bin': return { ...ast, l: rec(ast.l), r: rec(ast.r) };
    case 'call': {
      if (Array.isArray(ast.args)) return ast;
      const a = rec(ast.arg);
      if (ast.fn === 'sec') return B('/', N(1), { t: 'call', fn: 'cos', arg: a });
      if (ast.fn === 'cosec' || ast.fn === 'csc') return B('/', N(1), { t: 'call', fn: 'sin', arg: a });
      if (ast.fn === 'cot') return B('/', { t: 'call', fn: 'cos', arg: a }, { t: 'call', fn: 'sin', arg: a });
      if (ast.fn === 'abs') return { t: 'call', fn: 'sqrt', arg: B('^', a, N(2)) };
      return { ...ast, arg: a };
    }
    default: return ast;
  }
}
const diff = (ast, L) => { try { return differentiateAst(lower(ast), L) || null; } catch { return null; } };
const ev = (ast, env) => { try { const r = evaluate(ast, env); return typeof r === 'number' && Number.isFinite(r) ? r : NaN; } catch { return NaN; } };
const hasFn = (ast, names) => {
  if (!ast || typeof ast !== 'object') return false;
  if (ast.t === 'call' && names.includes(ast.fn)) return true;
  return ['v', 'l', 'r', 'arg'].some(k => ast[k] && typeof ast[k] === 'object' && hasFn(ast[k], names));
};
/** Every `ln`/`log` call of the expression, as its argument. */
function logArgs(ast, acc = []) {
  if (!ast || typeof ast !== 'object') return acc;
  if (ast.t === 'call' && (ast.fn === 'ln' || ast.fn === 'log' || ast.fn === 'log10' || ast.fn === 'log2') && ast.arg) acc.push(ast.arg);
  for (const k of ['v', 'l', 'r', 'arg']) if (ast[k] && typeof ast[k] === 'object') logArgs(ast[k], acc);
  return acc;
}
const isNumLike = ast => ast && lettersOf(ast).size === 0;

// ── the page state ───────────────────────────────────────────────────────────
function makeState(q) {
  const prompt = String(q?.prompt ?? '');
  const m = /\\int(?:\s*_\s*\{?[^$]*?\}?\s*\^\s*\{?[^$]*?\}?)?[^$]*?\\?,?\s*\\?(?:mathrm\{)?d\s*([a-z])\b/.exec(prompt) || /∫[^$]*?\bd\s*([a-z])\b/.exec(prompt);
  const v = m && /^[a-z]$/.test(m[1]) && m[1] !== 'e' ? m[1] : 'x';
  return { v, prompt, subs: new Map(), ambiguous: new Set(), usedAfter: new Set(), antiderivInSub: false };
}
function envAt(st, x) {
  const env = { [st.v]: x };
  for (const s of st.subs.values()) env[s.L] = s.fn(x);
  return env;
}
const subDeriv = (st, L, x) => { const s = st.subs.get(L); return s && s.dAst ? ev(s.dAst, { [st.v]: x }) : NaN; };

/** Letters allowed in an expression of this page: the integration variable, the defined substitution letters, the constant e. */
function lettersOk(ast, st, extra = []) {
  for (const L of lettersOf(ast)) if (L !== st.v && !st.subs.has(L) && !extra.includes(L)) return false;
  return true;
}
function valueFn(ast, st) { return x => ev(ast, envAt(st, x)); }
/** d/dv of an expression, v the integration variable: ∂/∂x + Σ ∂/∂u · u'(x), exact; null when a part cannot be differentiated. */
function derivFn(ast, st) {
  const parts = [];
  for (const L of lettersOf(ast)) {
    const d = diff(ast, L);
    if (!d) return null;
    if (L === st.v) parts.push({ d, dl: () => 1 });
    else if (st.subs.has(L)) { if (!st.subs.get(L).dAst) return null; parts.push({ d, dl: x => subDeriv(st, L, x) }); }
    else return null;
  }
  if (!parts.length) return () => 0;
  return x => { const env = envAt(st, x); let s = 0; for (const p of parts) s += ev(p.d, env) * p.dl(x); return s; };
}
/** 'same' | 'differ' | 'unsure', and where it differed. */
function compare(f, g) {
  let comparable = 0, differ = null, unequalDomain = false;
  for (const x of SAMPLES) {
    const a = f(x), b = g(x);
    if (!Number.isFinite(a) || !Number.isFinite(b)) { if (Number.isFinite(a) !== Number.isFinite(b)) unequalDomain = true; continue; }
    comparable++;
    if (!close(a, b, 1e-9)) { if (!close(a, b, 1e-6) && !differ) differ = { x, a, b }; else if (!differ) differ = null, comparable--; }
  }
  // an identity that holds only where one side is defined (ln(x²) = 2 ln x holds for x > 0 only) is neither ticked nor crossed
  if (unequalDomain) return { verdict: 'unsure' };
  if (differ && comparable >= 3) return { verdict: 'differ', ...differ };
  if (!differ && comparable >= 8) return { verdict: 'same' };
  return { verdict: 'unsure' };
}
/** The signs a logarithm's argument takes at the sample points: true when it changes sign. */
function argChangesSign(argAst, st) {
  const f = valueFn(argAst, st); let pos = false, neg = false;
  for (const x of SAMPLES) { const v = f(x); if (Number.isFinite(v)) { if (v > 0) pos = true; if (v < 0) neg = true; } }
  return pos && neg;
}
const showNum = v => (Number.isInteger(v) ? String(v) : String(Number(v.toPrecision(6))));
const plain = t => String(t).replace(/\s+/g, ' ').replace(/\*/g, '·').trim();

// ── reading one side of a chain ──────────────────────────────────────────────
const LIM = String.raw`(\{[^{}]*\}|\([^()]*\)|-?\d+(?:\.\d+)?|-?(?:pi|π|e)\b|-?[a-z]\b)`;
const INT_RE = new RegExp(String.raw`^(.*?)∫\s*(?:_\s*${LIM}\s*\^\s*${LIM})?\s*(.+?)\s*d([a-z])$`);
const BR_RE = new RegExp(String.raw`^(.*?)\[\s*(.+)\s*\]\s*_\s*${LIM}\s*\^\s*${LIM}$`);

function constantOf(txt) {
  const t = String(txt).replace(/^\{|\}$/g, '').trim();
  if (!t) return null;
  const ast = tryParse(t.replace(/π/g, 'pi'));
  if (!ast || !isNumLike(ast)) return null;
  const v = ev(ast, {});
  return Number.isFinite(v) ? v : null;
}
function coefOf(prefix) {
  let p = prefix.trim().replace(/\*$/, '').trim();
  if (!p) return 1;
  if (p === '-') return -1; if (p === '+') return 1;
  return constantOf(p);
}
/** Strips the constant of integration: { ast, hasC, text } or null. */
function stripConstant(text) {
  const terms = []; let depth = 0, start = 0, sign = '+';
  const pushTerm = end => { const t = text.slice(start, end).trim(); if (t) terms.push({ sign, t }); };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if ('([{'.includes(ch)) depth++; else if (')]}'.includes(ch)) depth = Math.max(0, depth - 1);
    else if ((ch === '+' || ch === '-') && depth === 0 && i > start && !/[\^*/(]\s*$/.test(text.slice(start, i)) && !/[eE]$/.test(text.slice(start, i).trim().replace(/\d+(?:\.\d+)?$/, ''))) { pushTerm(i); sign = ch; start = i + 1; }
  }
  pushTerm(text.length);
  const consts = terms.filter(x => CONSTANT_TERM.test(x.t));
  if (consts.length > 1) return null;
  const rest = terms.filter(x => !CONSTANT_TERM.test(x.t));
  if (!rest.length) return null;
  const body = rest.map((x, i) => (i === 0 ? (x.sign === '-' ? '-' : '') : x.sign) + (i === 0 ? '' : ' ') + x.t).join(' ').replace(/\+\s*-/g, '- ');
  return { text: body, hasC: consts.length === 1 };
}


/** A substitution the QUESTION gives (`Use the substitution $u = \\sin x$ to find ...`) is defined from the start of the page. */
function seedFromPrompt(st) {
  const text = String(st.prompt ?? '').replace(/\\\$/g, '\u0001');
  const m = /(?:substitution|substituting|\buse\b|\blet\b|\bput\b|\busing\b)[^$]{0,40}\$\s*([a-z])\s*=\s*([^$]+?)\s*\$/i.exec(text);
  if (!m || m[1] === st.v || m[1] === 'e') return;
  let rhs = null;
  try { rhs = texToPlain(m[2]); } catch { rhs = null; }
  if (!rhs) return;
  try { defClaim({ text: `${m[1]} = ${rhs}`, defining: true, back: false }, st, 0, false); } catch { /* the page defines it itself */ }
  const d = st.subs.get(m[1]);
  if (d) { d.keyword = true; d.fromPrompt = true; st.usedAfter.add(m[1]); }
}

/** One side as { kind: 'int' | 'br' | 'expr' | 'num', ... } or null (unread). */
function readSide(raw, st) {
  const t0 = tidy(raw).replace(/^[=\s]+/, '').replace(/[.\s]+$/, '');
  if (!t0) return null;
  if (!readable(t0)) return null;
  const im = INT_RE.exec(t0.replace(/\bint\b/, '∫'));
  if (im) {
    const [, pre, lo, hi, body, v] = im;
    if (/∫/.test(body)) return null;
    const coef = coefOf(pre);
    if (coef === null || (v !== st.v && !st.subs.has(v))) return null;
    const ast = tryParse(body.replace(/\bd[a-z]\b/g, ''));
    if (!ast || !lettersOk(ast, st)) return null;
    let lim = null;
    if (lo !== undefined && hi !== undefined) { const a = constantOf(lo), b = constantOf(hi); if (a === null || b === null) return null; lim = [a, b]; }
    return { kind: 'int', coef, ast, v, lim, text: t0 };
  }
  const bm = BR_RE.exec(t0);
  if (bm) {
    const [, pre, body, lo, hi] = bm;
    const coef = coefOf(pre), a = constantOf(lo), b = constantOf(hi), ast = tryParse(body);
    if (coef === null || a === null || b === null || !ast || !lettersOk(ast, st)) return null;
    return { kind: 'br', coef, ast, lim: [a, b], text: t0 };
  }
  if (/[∫\[\]]/.test(t0)) return null;
  const sc = stripConstant(t0);
  const ast = tryParse(sc ? sc.text : t0);
  if (!ast) return null;
  if (!lettersOk(ast, st, sc ? ['C'] : [])) return null;
  if (isNumLike(ast)) { const v = ev(ast, {}); return Number.isFinite(v) && !(sc && sc.hasC) ? { kind: 'num', value: v, ast, text: t0 } : null; }
  return { kind: 'expr', ast, hasC: !!(sc && sc.hasC), text: t0, letters: lettersOf(ast) };
}

// ── what each claim says, and whether it is true ─────────────────────────────
const proved = (cls, note, extra = {}) => ({ verdict: 'proved', cls, note, ...extra });
const unknown = why => ({ verdict: 'unknown', why });
const falseClaim = (text, why, detail = {}) => ({ verdict: 'false', text, why, detail });

function simpson(f, a, b) {
  const n = 2000, h = (b - a) / n; let sum = 0;
  for (let k = 0; k <= n; k++) { const y = f(a + k * h); if (!Number.isFinite(y)) return NaN; sum += y * (k === 0 || k === n ? 1 : k % 2 ? 4 : 2); }
  return sum * h / 3;
}
/** How a written number compares with an exact value: 'same', 'differ' (no rounding of the exact value gives what was written) or 'rounded' (it may be a rounding of it). */
function numberVerdict(value, w, text) {
  if (close(value, w, 1e-9)) return 'same';
  const m = /^-?\d+(?:\.(\d+))?$/.exec(String(text).trim());
  if (m) { const d = m[1] ? m[1].length : 0; return Math.abs(value - w) > 0.5 * 10 ** -d * (1 + 1e-9) + 1e-12 ? 'differ' : 'rounded'; }
  return close(value, w, 1e-6) ? 'rounded' : 'differ';
}
const showSub = s => `${s.L} = ${plain(s.text)}`;

/** `Let u = x² + 8`: a new substitution, or the same one again. */
function defClaim(c, st, lineNo, back) {
  const eqs = sidesOf(c.text);
  if (eqs.length !== 2) return null;
  let L = null, rhs = null;
  const a = eqs[0].trim(), b = eqs[1].trim();
  if (/^[a-z]$/.test(a) && a !== st.v && a !== 'e') { L = a; rhs = b; }
  else if (/^[a-z]$/.test(b) && b !== st.v && b !== 'e' && !/^[a-z]$/.test(a)) { L = b; rhs = a; }
  if (!L) return null;
  if (!c.defining && !back && !SUBLETTERS.includes(L) && !st.subs.has(L)) return null;
  if (!readable(rhs)) return unknown('unreadable');
  const ast = tryParse(rhs);
  if (!ast || [...lettersOf(ast)].some(x => x !== st.v) || !lettersOf(ast).has(st.v)) return null;
  const dAst = diff(ast, st.v);
  const val = x => ev(ast, { [st.v]: x });
  const have = st.subs.get(L);
  if (have) {
    const cmp = compare(have.fn, val);
    if (cmp.verdict === 'same') return { verdict: 'consistent', cls: 'substitution-consistent', note: `${L} = ${plain(rhs)} is the substitution defined above`, L };
    // a definition cannot be false: another expression for the same letter (a second part, a new try) REPLACES the old one, and later lines are checked against the latest
    if (cmp.verdict !== 'differ') return unknown('substitution not comparable');
  }
  st.subs.set(L, { L, ast, text: rhs, fn: val, dAst, line: lineNo, keyword: !!(c.defining || back) });
  return { verdict: 'defined', cls: 'substitution-defined', note: `${L} = ${plain(rhs)} defines the substitution`, L };
}

/** `du/dx = 2x`, `dx/du = 1/(2x)`, `u' = 2x`. */
function derivClaim(c, st) {
  const sides = sidesOf(c.text);
  const m = /^d([a-z])\s*\/\s*d([a-z])$/.exec(sides[0].replace(/\s+/g, '')) || /^([a-z])\s*['′]$/.exec(sides[0].replace(/\s+/g, ''));
  if (!m || sides.length < 2) return null;
  const top = m[1], bot = m[2] === undefined || m.length === 2 ? st.v : m[2];
  const rate = L => (L === st.v ? () => 1 : (st.subs.has(L) && st.subs.get(L).dAst ? x => subDeriv(st, L, x) : null));
  if (!st.subs.has(top) && top !== st.v) return null;
  if (!st.subs.has(bot) && bot !== st.v) return null;
  if (top === bot) return null;
  const rt = rate(top), rb = rate(bot);
  if (!rt || !rb) return unknown('no derivative');
  const want = x => rt(x) / rb(x);
  for (const rhs of sides.slice(1)) {
    if (!readable(rhs)) return unknown('unreadable');
    const ast = tryParse(rhs);
    if (!ast || !lettersOk(ast, st)) return unknown('unread side');
    const cmp = compare(valueFn(ast, st), want);
    if (cmp.verdict === 'differ') return falseClaim(c.text, `with ${showSub(st.subs.get(top) || st.subs.get(bot))}, d${top}/d${bot} is not ${plain(rhs)}`, { x: cmp.x });
    if (cmp.verdict !== 'same') return unknown('not comparable');
  }
  markUsed(st, top, bot);
  return proved('derivative-of-substitution', `${plain(c.text)} is the derivative of the substitution`);
}
function markUsed(st, ...letters) { for (const L of letters) if (st.subs.has(L)) st.usedAfter.add(L); }

/** `du = 2x dx`, `12x dx = 6 du`, `dx = du/(2x)`: each side is worth one multiple of dx, once du is u'(x) dx. */
const PLACE = 'PQRSTWYZ';
function diffClaim(c, st) {
  const sides = sidesOf(c.text);
  if (sides.length < 2) return null;
  const letters = new Set(); const tokenRe = /(?<![A-Za-z])d([a-z])(?![A-Za-z0-9(])/g;
  for (const s of sides) for (const m of s.matchAll(tokenRe)) letters.add(m[1]);
  if (!letters.size) return null;
  if ([...letters].some(L => L !== st.v && !st.subs.has(L))) return unknown('another differential');
  const place = new Map(); let k = 0;
  for (const L of letters) place.set(L, PLACE[k++]);
  const asts = [];
  for (const s of sides) {
    if (!readable(s)) return unknown('unreadable');
    const txt = s.replace(tokenRe, (m, L, at, whole) => `${/\S\s*$/.test(whole.slice(0, at)) ? '*' : ''}${place.get(L)}${/^\s*[A-Za-z0-9(]/.test(whole.slice(at + m.length)) ? '*' : ''}`);
    const ast = tryParse(txt);
    if (!ast) return unknown('unread side');
    for (const L of lettersOf(ast)) if (L !== st.v && !st.subs.has(L) && ![...place.values()].includes(L)) return unknown('unknown letter');
    asts.push(ast);
  }
  const rateOf = L => (L === st.v ? () => 1 : (st.subs.get(L).dAst ? x => subDeriv(st, L, x) : null));
  for (const L of letters) if (!rateOf(L)) return unknown('no derivative');
  const fns = t => asts.map(ast => x => { const env = envAt(st, x); for (const [L, P] of place) env[P] = t * rateOf(L)(x); return ev(ast, env); });
  const f1 = fns(1), f2 = fns(2);
  // every side must be worth exactly one differential (degree one): a missing dx or du is a note, never a cross
  for (let i = 0; i < asts.length; i++) {
    let seen = 0;
    for (const x of SAMPLES) { const a = f1[i](x), b = f2[i](x); if (!Number.isFinite(a) || !Number.isFinite(b)) continue; if (Math.abs(a) < 1e-12) { if (Math.abs(b) > 1e-12) return unknown('degree'); continue; } if (!close(b, 2 * a, 1e-9)) return unknown('degree'); seen++; }
    if (seen < 4) return unknown('degree');
  }
  for (let i = 1; i < asts.length; i++) {
    const cmp = compare(f1[i - 1], f1[i]);
    if (cmp.verdict === 'differ') {
      const sub = [...letters].map(L => st.subs.get(L)).find(Boolean);
      return falseClaim(c.text, `${sub ? `with ${showSub(sub)}, ` : ''}the two sides of ${plain(c.text)} are not equal (at ${st.v} = ${showNum(cmp.x)} they are ${showNum(cmp.a)} and ${showNum(cmp.b)} for each dx)`, { x: cmp.x });
    }
    if (cmp.verdict !== 'same') return unknown('not comparable');
  }
  markUsed(st, ...letters);
  return proved('differential-form', `${plain(c.text)} follows from the derivative of the substitution`);
}

/** A chain of integrals and expressions: each neighbouring pair is one claim. */
function chainClaim(c, st, lineNo, prevTail) {
  let texts = sidesOf(c.text);
  if (/^\s*=/.test(c.text) || texts[0] === '') {
    if (!prevTail) return null;
    texts = [prevTail, ...texts.slice(1)];
  }
  if (texts.length < 2 || texts.some(s => s === '')) return null;
  if (!texts.some(s => /[∫\[]|\bint\b/.test(s)) && !texts.every(s => !/d[a-z]\b/.test(s))) return null;
  const sides = [];
  for (const s of texts) { const r = readSide(s, st); if (!r) return unknown('unread side'); sides.push(r); }
  let cls = null; const notes = [];
  const classes = new Set();
  for (let i = 1; i < sides.length; i++) {
    const r = pairClaim(sides[i - 1], sides[i], st, c, lineNo);
    if (r.verdict !== 'proved') return r;
    classes.add(r.cls); notes.push(r.note);
  }
  cls = classes.size === 1 ? [...classes][0] : 'several-claims';
  const last = texts[texts.length - 1];
  return { ...proved(cls, notes.join('; '), { classes: [...classes] }), tail: last };
}

const hxOfInt = (s, st) => {
  const g = derivFnOfInt(s, st);
  return g;
};
function derivFnOfInt(s, st) {
  // ∫ g dv per dx: coef · g(env) · v'(x)
  const rate = s.v === st.v ? () => 1 : (st.subs.get(s.v) && st.subs.get(s.v).dAst ? x => subDeriv(st, s.v, x) : null);
  if (!rate) return null;
  return x => s.coef * ev(s.ast, envAt(st, x)) * rate(x);
}

function pairClaim(a, b, st, c, lineNo) {
  const shown = plain(`${a.text} = ${b.text}`);
  void c;
  // ── two indefinite integrals, or an integral and an expression: through the integrand per dx ──
  const fam = s => s.kind === 'int' && !s.lim;
  const defint = s => s.kind === 'int' && !!s.lim;
  if ((fam(a) || fam(b)) && !defint(a) && !defint(b)) {
    const fa = fam(a) ? derivFnOfInt(a, st) : (a.kind === 'expr' ? derivFn(a.ast, st) : null);
    const fb = fam(b) ? derivFnOfInt(b, st) : (b.kind === 'expr' ? derivFn(b.ast, st) : null);
    if (!fa || !fb) return unknown('no derivative');
    // policy: a logarithm whose argument changes sign needs its modulus; without it the line is not ticked
    for (const s of [a, b]) if (s.kind === 'expr' && logArgs(s.ast).some(arg => argChangesSign(arg, st))) return unknown('ln needs a modulus');
    const exprs = [a, b].filter(s => s.kind === 'expr');
    // an indefinite integral is a family: the expression it is set equal to must carry + C
    if (exprs.some(s => !s.hasC)) return unknown('no constant of integration');
    const cmp = compare(fa, fb);
    if (cmp.verdict === 'differ') {
      if (fam(a) && fam(b)) {
        return falseClaim(shown, `the two integrals are not the same: the first integrand is ${showNum(cmp.a)} at ${st.v} = ${showNum(cmp.x)} (per dx) and the second ${showNum(cmp.b)}`, { x: cmp.x });
      }
      const [integral, expr] = fam(a) ? [a, b] : [b, a];
      const got = fam(a) ? cmp.b : cmp.a, want = fam(a) ? cmp.a : cmp.b;
      return falseClaim(shown, `differentiating ${plain(expr.text)} with respect to ${st.v} gives ${showNum(got)} at ${st.v} = ${showNum(cmp.x)}, but the integrand ${integral.v === st.v ? '' : '(per dx) '}is ${showNum(want)} there`, { x: cmp.x });
    }
    if (cmp.verdict !== 'same') return unknown('not comparable');
    if (fam(a) && fam(b)) {
      markUsed(st, a.v, b.v);
      return a.v !== b.v ? proved('change-of-variable', `${shown} is a correct change of variable: the integrand times the derivative of the substitution agrees`) : proved('integral-rewritten', `${shown} rewrites the integral correctly`);
    }
    const [integral, expr] = fam(a) ? [a, b] : [b, a];
    markUsed(st, integral.v, ...[...expr.letters]);
    const inSub = st.subs.has(integral.v);
    if (inSub) st.antiderivInSub = true;
    const backwards = !inSub && st.antiderivInSub && [...expr.letters].every(L => L === st.v);
    return backwards ? proved('back-substitution', `${shown} is correct: differentiating the right side gives the integrand`) : proved('antiderivative-checked', `${shown} is correct: differentiating the right side gives the integrand`);
  }
  // ── two expressions ──
  if (a.kind === 'expr' && b.kind === 'expr') {
    if (a.hasC !== b.hasC) return unknown('constant on one side');
    const f = a.hasC ? derivFn(a.ast, st) : valueFn(a.ast, st), g = b.hasC ? derivFn(b.ast, st) : valueFn(b.ast, st);
    if (!f || !g) return unknown('no derivative');
    for (const s of [a, b]) if (s.hasC && logArgs(s.ast).some(arg => argChangesSign(arg, st))) return unknown('ln needs a modulus');
    const cmp = compare(f, g);
    if (cmp.verdict === 'differ') return falseClaim(shown, `the two sides are not equal: at ${st.v} = ${showNum(cmp.x)}${a.hasC ? ' (their derivatives)' : ''} they are ${showNum(cmp.a)} and ${showNum(cmp.b)}`, { x: cmp.x });
    if (cmp.verdict !== 'same') return unknown('not comparable');
    const la = [...a.letters].sort().join(), lb = [...b.letters].sort().join();
    markUsed(st, ...a.letters, ...b.letters);
    return la !== lb && [...a.letters, ...b.letters].some(L => st.subs.has(L)) ? proved('back-substitution', `${shown} is correct once the substitution is put back`) : proved('equivalent-expressions', `${shown} is true: both sides are the same expression`);
  }
  // ── definite integrals: a change of variable with its limits, or the evaluation ──
  if (defint(a) && defint(b)) {
    const fa = derivFnOfInt({ ...a, lim: null }, st), fb = derivFnOfInt({ ...b, lim: null }, st);
    if (!fa || !fb) return unknown('no derivative');
    const cmp = compare(fa, fb);
    if (cmp.verdict === 'differ') return falseClaim(shown, `the two integrands do not agree (per dx they are ${showNum(cmp.a)} and ${showNum(cmp.b)} at ${st.v} = ${showNum(cmp.x)})`, { x: cmp.x });
    if (cmp.verdict !== 'same') return unknown('not comparable');
    // the limits of a change of variable are the old limits put through the substitution
    const sub = a.v !== b.v ? st.subs.get(a.v === st.v ? b.v : a.v) : null;
    if (a.v === b.v) { if (close(a.lim[0], b.lim[0]) && close(a.lim[1], b.lim[1])) return proved('integral-rewritten', `${shown} rewrites the integral correctly`); return unknown('limits'); }
    if (!sub) return unknown('no substitution');
    const [from, to] = a.v === st.v ? [a, b] : [b, a];
    const mapped = from.lim.map(sub.fn);
    if (to.lim.every((v, i) => close(v, mapped[i], 1e-9))) { markUsed(st, sub.L); return proved('change-of-variable', `${shown} is a correct change of variable, and the limits are changed to match ${showSub(sub)}`); }
    // limits left as they were (or changed wrongly): the two integrals provably differ
    const v1 = simpson(x => derivFnOfInt({ ...to, lim: null }, st)(x), to.lim[0], to.lim[1]);
    const gOf = (u) => from.coef * 0 + 0 * u;
    void gOf;
    const exact = simpson(x => derivFnOfInt({ ...from, lim: null }, st)(x), from.lim[0], from.lim[1]);
    const gU = u => to.coef * ev(to.ast, { [to.v]: u });
    const direct = simpson(gU, to.lim[0], to.lim[1]), expected = simpson(gU, mapped[0], mapped[1]);
    void v1; void exact;
    if (Number.isFinite(direct) && Number.isFinite(expected) && !close(direct, expected, 1e-6) && Math.abs(direct - expected) > 1e-6) {
      return falseClaim(shown, `the limits were not changed to match ${showSub(sub)}: ${st.v} = ${showNum(from.lim[0])} and ${showNum(from.lim[1])} become ${sub.L} = ${showNum(mapped[0])} and ${showNum(mapped[1])}`, {});
    }
    return unknown('limits');
  }
  if (defint(a) && b.kind === 'br') {
    // ∫_a^b g dv = [G]_a^b : G must be an antiderivative of g, over the same limits
    if (!b.ast || a.v === undefined) return unknown('no antiderivative');
    const vars = [...lettersOf(b.ast)];
    if (vars.length !== 1 || vars[0] !== a.v) return unknown('letters');
    const fg = x => ev(b.ast, { [a.v]: x });
    const dG = diff(b.ast, a.v);
    if (!dG) return unknown('no derivative');
    const cmp = compare(u => b.coef * ev(dG, { [a.v]: u }), u => a.coef * ev(a.ast, { [a.v]: u }));
    void fg;
    if (cmp.verdict === 'differ') return falseClaim(shown, `differentiating the bracket gives ${showNum(cmp.a)} at ${a.v} = ${showNum(cmp.x)}, but the integrand is ${showNum(cmp.b)} there`, { x: cmp.x });
    if (cmp.verdict !== 'same') return unknown('not comparable');
    if (!close(a.lim[0], b.lim[0]) || !close(a.lim[1], b.lim[1])) return unknown('limits');
    return proved('antiderivative-checked', `${shown} is correct: differentiating the bracket gives the integrand, over the same limits`);
  }
  if (a.kind === 'br' && (b.kind === 'num' || b.kind === 'expr')) {
    const vars = [...lettersOf(a.ast)];
    if (vars.length > 1) return unknown('letters');
    const L = vars[0] ?? 'x';
    const top = ev(a.ast, { [L]: a.lim[1] }), bot = ev(a.ast, { [L]: a.lim[0] });
    if (!Number.isFinite(top) || !Number.isFinite(bot)) return unknown('undefined at a limit');
    const value = a.coef * (top - bot);
    if (b.kind !== 'num') {
      if (lettersOf(b.ast).size) return unknown('letters');
    }
    const w = b.kind === 'num' ? b.value : ev(b.ast, {});
    const nv = numberVerdict(value, w, b.text);
    if (nv === 'same') return proved('definite-integral-evaluated', `${shown} is correct: the limits are put in and the bottom value taken from the top`);
    if (nv === 'differ') return falseClaim(shown, `putting the limits into the bracket gives ${showNum(value)}, not ${showNum(w)}`, {});
    return unknown('rounded');
  }
  if (a.kind === 'num' && b.kind === 'num') {
    const nv = numberVerdict(a.value, b.value, b.text);
    if (nv === 'same') return proved('definite-integral-evaluated', `${shown} is true: each side comes to ${showNum(a.value)}`);
    if (nv === 'differ') return falseClaim(shown, `the two sides are ${showNum(a.value)} and ${showNum(b.value)}`, {});
    return unknown('rounded');
  }
  if (defint(a) && b.kind === 'num') {
    const f = derivFnOfInt({ ...a, lim: null }, st);
    const rate = a.v === st.v ? 1 : 0;
    void rate;
    if (!f || a.v !== st.v && !st.subs.has(a.v)) return unknown('no derivative');
    const g = u => a.coef * ev(a.ast, { [a.v]: u });
    const v = simpson(g, a.lim[0], a.lim[1]);
    if (Number.isFinite(v) && close(v, b.value, 1e-7)) return proved('definite-integral-evaluated', `${shown} is true: the integral works out to ${showNum(b.value)}`);
    return unknown('definite integral not confirmed');
  }
  return unknown('this pair is not read');
}


/** The one integral the question states (`\\int_0^2 4x^3\\,dx`), read as a side, or null. */
function promptIntegral(st) {
  if (st.promptInt !== undefined) return st.promptInt;
  st.promptInt = null;
  try {
    const text = String(st.prompt ?? '').replace(/\\\$/g, '\u0001');
    const spans = [...text.matchAll(/\$\$?([^$]+)\$\$?/g)].map(m => m[1]).filter(x => /\\int(?![a-z])/.test(x) && !/\\oint|\\iint/.test(x));
    if (spans.length !== 1) return null;
    const tex = spans[0].trim();
    let plain = null;
    try { plain = texToPlain(tex); } catch { plain = null; }
    if (!plain) {
      const m = /\\int\s*([\s\S]*?)(?:\\,|\\;|\s)*d\s*([a-z])\s*$/.exec(tex);
      const b = m && (() => { try { return texToPlain(m[1]); } catch { return null; } })();
      if (b) plain = `∫${b}d${m[2]}`;
    }
    if (!plain || /=/.test(plain)) return null;
    const side = readSide(plain, st);
    st.promptInt = side && side.kind === 'int' && side.v === st.v ? side : null;
  } catch { st.promptInt = null; }
  return st.promptInt;
}
/** Do the limits of a line's integral or bracket agree with the question's (through the substitution, when the line works in u)? true / false / null (not known). */
function sameLimits(side, P, st) {
  if (!P.lim && !side.lim) return true;
  if (!P.lim || !side.lim) return null;
  const letters = side.kind === 'br' ? [...lettersOf(side.ast)] : [side.v];
  if (letters.length === 1 && letters[0] === st.v) return close(side.lim[0], P.lim[0]) && close(side.lim[1], P.lim[1]) ? true : null;
  const sub = letters.length === 1 ? st.subs.get(letters[0]) : null;
  if (!sub) return null;
  const mapped = P.lim.map(sub.fn);
  return close(side.lim[0], mapped[0], 1e-9) && close(side.lim[1], mapped[1], 1e-9) ? true : null;
}

/** The signed additive terms of an integrand, each as a function of x. */
function termFns(ast, st, sign = 1, out = []) {
  let a = ast; while (a && a.t === 'group') a = a.v;
  if (a && a.t === 'bin' && (a.op === '+' || a.op === '-')) { termFns(a.l, st, sign, out); termFns(a.r, st, a.op === '-' ? -sign : sign, out); return out; }
  if (a && a.t === 'neg') { termFns(a.v, st, -sign, out); return out; }
  out.push(valueFn(a, st)); out.push(sign);
  return out;
}
/** Is fS (a bracket's derivative per dx) one term, or a sum of some terms, of the question's integrand? */
function partOfIntegrand(P, fS, st) {
  const flat = termFns(P.ast, st); const fns = [], signs = [];
  for (let i = 0; i < flat.length; i += 2) { fns.push(flat[i]); signs.push(flat[i + 1]); }
  if (fns.length < 2 || fns.length > 8) return false;
  for (let mask = 1; mask < (1 << fns.length); mask++) {
    const sum = x => { let t = 0; for (let i = 0; i < fns.length; i++) if (mask & (1 << i)) t += signs[i] * fns[i](x); return P.coef * t; };
    if (compare(fS, sum).verdict === 'same') return true;
  }
  return false;
}
/** A line with no equality that states an integral or a bracket: the question's own integral rewritten, or its antiderivative over the same limits. */
function loneClaim(c, st) {
  const P = promptIntegral(st);
  if (!P) return unknown('no integral in the question');
  const side = readSide(c.text, st);
  // the integrand of the question written another way: `(1 - sin²x)cos x` for `cos³x`
  if (side && side.kind === 'expr' && !side.hasC && [...side.letters].every(L => L === st.v) && P.v === st.v) {
    const cmp = compare(valueFn(side.ast, st), x => P.coef * ev(P.ast, envAt(st, x)));
    if (cmp.verdict === 'same') return proved('equivalent-expressions', `${plain(c.text)} is the integrand of the question, rewritten correctly`);
    // the antiderivative of the question's integrand, written with no equals sign (the primitive of a definite integral)
    if (P.lim) {
      const d = derivFn(side.ast, st);
      if (d && !logArgs(side.ast).some(arg => argChangesSign(arg, st)) && compare(d, x => P.coef * ev(P.ast, envAt(st, x))).verdict === 'same') return proved('antiderivative-checked', `${plain(c.text)} is correct: differentiating it gives the integrand of the question`);
    }
    return unknown('not the integrand');
  }
  if (!side || (side.kind !== 'int' && side.kind !== 'br')) return unknown('not an integral line');
  const fP = derivFnOfInt({ ...P, lim: null }, st);
  const fS = side.kind === 'int' ? derivFnOfInt({ ...side, lim: null }, st) : (() => { const d = derivFn(side.ast, st); return d ? (x => side.coef * d(x)) : null; })();
  if (!fP || !fS) return unknown('no derivative');
  const lim = sameLimits(side, P, st);
  if (lim !== true) return unknown('limits');
  const cmp = compare(fS, fP);
  const shown = plain(c.text);
  if (cmp.verdict === 'differ') {
    // a bracket for one part of the integrand (a term, or some of the terms) is a legitimate line on its own: no verdict
    if (side.kind === 'br' && partOfIntegrand(P, fS, st)) return unknown('part of the integrand');
    if (side.kind === 'br') return falseClaim(shown, `differentiating the bracket gives ${showNum(cmp.a)} at ${st.v} = ${showNum(cmp.x)}, but the integrand of the question is ${showNum(cmp.b)} there`, { x: cmp.x });
    return unknown('a different integral');
  }
  if (cmp.verdict !== 'same') return unknown('not comparable');
  if (side.kind === 'int') { markUsed(st, side.v); return proved('integral-rewritten', `${shown} is the integral in the question, rewritten correctly`); }
  markUsed(st, ...lettersOf(side.ast));
  return proved('antiderivative-checked', `${shown} is correct: differentiating the bracket gives the integrand of the question, over its limits`);
}

// ── a line: its claims, and what the line is ─────────────────────────────────
function readClaim(c, st, lineNo, prevTail) {
  if (c.words) return unknown('words');
  const text = c.text;
  if (!/[=]/.test(text)) return loneClaim(c, st);
  const sides = sidesOf(text);
  if (/^d[a-z]\s*\/\s*d[a-z]$/.test(sides[0].replace(/\s+/g, '')) || /^[a-z]\s*['′]$/.test(sides[0].replace(/\s+/g, ''))) {
    const r = derivClaim(c, st); if (r) return r;
  }
  if (/∫|\bint\b|\]\s*_/.test(text) || /^\s*=/.test(text)) {
    const r = chainClaim(c, st, lineNo, prevTail); if (r) return r;
    return unknown('integral not read');
  }
  if (/(?<![A-Za-z])d[a-z](?![A-Za-z0-9(])/.test(text)) { const r = diffClaim(c, st); if (r) return r; }
  const d = defClaim(c, st, lineNo, c.back); if (d) return d;
  // two or more expressions set equal, with no integral: a plain identity of the page's own letters
  const parts = sides.map(s => readSide(s, st));
  if (parts.length >= 2 && parts.every(p => p && (p.kind === 'expr' || p.kind === 'num'))) {
    if (parts.every(p => p.kind === 'num')) return unknown('plain arithmetic');
    let cls = new Set(); const notes = [];
    for (let i = 1; i < parts.length; i++) {
      const r = pairClaim(parts[i - 1], parts[i], st, c, lineNo);
      // two expressions with no integral are, as often as not, an EQUATION to solve (3x + 2 = 11): never crossed as an identity, only ticked when they are one
      if (r.verdict === 'false') return unknown('an equation, not an identity');
      if (r.verdict !== 'proved') return r;
      cls.add(r.cls); notes.push(r.note);
    }
    return proved(cls.size === 1 ? [...cls][0] : 'several-claims', notes.join('; '), { classes: [...cls] });
  }
  return unknown('not read');
}

/**
 * The lines of a page as integration claims. Returns one entry per line: { claims, verdict, cls, note, text } where verdict is
 * 'tick' | 'cross' | 'neutral' | 'none'. `limit` is the first line the caller will not touch.
 */
export function readPage(q, lines, limit = Infinity) {
  const st = makeState(q);
  seedFromPrompt(st);
  const out = []; let tail = null;
  for (let i = 0; i < lines.length; i++) {
    const text = String(lines[i] ?? '');
    if (i >= limit) { out.push({ verdict: 'none', claims: [] }); continue; }
    if (/^\s*(?:\(?[a-h]\)|\(?(?:i{1,3}|iv)\))\s/.test(text) || /^\s*part\b/i.test(text)) { for (const [k, d] of [...st.subs]) if (!d.fromPrompt) st.subs.delete(k); st.antiderivInSub = false; tail = null; }
    const cs = claimTexts(text);
    const claims = [];
    let newTail = null;
    for (const c of cs) {
      let r;
      try { r = readClaim(c, st, i + 1, tail); } catch { r = unknown('error'); }
      claims.push({ ...r, text: c.text });
      if (r.tail) newTail = r.tail;
      else if (r.verdict === 'proved' && /=/.test(c.text)) newTail = sidesOf(c.text).pop();
      else if (!/=/.test(c.text) && /∫/.test(c.text)) newTail = c.text;
      else if (r.verdict !== 'proved') newTail = null;
      if (r.verdict === 'false') break;
    }
    tail = newTail;
    if (!claims.length) { out.push({ verdict: 'none', claims, text }); continue; }
    const bad = claims.find(c => c.verdict === 'false');
    if (bad) { out.push({ verdict: 'cross', claims, bad, text }); break; }
    if (claims.some(c => c.verdict === 'unknown')) { out.push({ verdict: 'none', claims, text }); continue; }
    const real = claims.filter(c => c.verdict === 'proved' || c.verdict === 'consistent');
    if (!real.length) { out.push({ verdict: 'neutral', claims, text, defs: claims.map(c => c.L).filter(Boolean) }); continue; }
    out.push({ verdict: 'tick', claims, text, cls: lineClass(real), note: `Correct: ${claims.map(c => c.note).join('; ')}.` });
  }
  while (out.length < lines.length) out.push({ verdict: 'none', claims: [] });
  // a line that only defines a substitution is neutral when a later line used it, and left alone otherwise
  for (const o of out) if (o.verdict === 'neutral' && !(o.defs || []).some(L => st.usedAfter.has(L))) o.verdict = 'none';
  return out;
}
/** The one class a ticked line carries: the claims' own class when they agree, the weaker ones (a restated substitution, a plain rewrite) giving way, else 'several-claims'. */
function lineClass(real) {
  const all = real.flatMap(c => (c.classes && c.classes.length ? c.classes : [c.cls]));
  const WEAK = new Set(['substitution-defined', 'substitution-consistent', 'equivalent-expressions']);
  const strong = [...new Set(all.filter(x => !WEAK.has(x)))];
  if (strong.length === 1) return strong[0];
  if (!strong.length) return [...new Set(all)].length === 1 ? all[0] : 'several-claims';
  return 'several-claims';
}
const SAFE_NOTE = s => !/[$—–]/.test(s);

/**
 * @param q       the question (only `prompt` is read)
 * @param report  the report the page shows, lines in order
 * @param openAt  (line, index) => may this line take a new tick, cross or neutral mark? (notes only)
 * @returns the same report with each provable open note ticked, crossed or made neutral; `report` itself when none is
 */
export function integrationLines(q, report, openAt) {
  if (!report || !Array.isArray(report.lines)) return report;
  const brk = report.lines.findIndex(l => l?.status === 'break');
  const limit = brk >= 0 ? brk : report.lines.length;
  const texts = report.lines.map(l => String(l?.text ?? ''));
  if (!texts.some(t => /[∫=]/.test(t))) return report;
  let page;
  try { page = readPage(q, texts, limit); } catch { return report; }
  let n = 0;
  const lines = report.lines.map((l, i) => {
    const r = page[i];
    if (!r || r.verdict === 'none' || i >= limit || !openAt(l, i)) return l;
    if (r.verdict === 'tick') {
      if (!SAFE_NOTE(r.note)) return l;
      n++;
      return { text: l.text, status: 'ok', state: 'arithmetic', note: r.note, valueChain: { rule: 'proved' }, fact: { kind: 'proved', proof: 'integration' }, tickClass: r.cls };
    }
    if (r.verdict === 'neutral') {
      n++;
      return { text: l.text, status: 'note', state: 'unverified', unverified: true, context: true, note: `Correct: ${r.claims.map(c => c.note).join('; ')}. It defines the method and is not checked against the answer.`, tickClass: 'substitution-defined' };
    }
    if (r.verdict === 'cross') {
      const b = r.bad;
      const message = `This line says "${b.text}", and that is not right: ${b.why}.`;
      if (!SAFE_NOTE(message)) return l;
      n++;
      const diagnosis = { code: 'integration-claim', title: 'One statement on this line does not check out', message, fix: 'Check this statement on its own: differentiate, or put the substitution back, and compare.', confidence: 'high', detail: b.detail || {} };
      return { text: l.text, status: 'break', state: 'wrong', note: message, diagnosis, fact: { kind: 'proved', proof: 'integration-false' } };
    }
    return l;
  });
  if (!n) return report;
  return { ...report, lines };
}
