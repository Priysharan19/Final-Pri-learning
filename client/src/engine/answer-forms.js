// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · NCERT answer forms
//
// The forms an Indian student writes on the answer line that a numeric box
// cannot hold: the solution of an inequality ("x > 3", "2 < x ≤ 5", "(2, 5]",
// "x ∈ (−∞, 3)"), a matrix ("[[1, 2], [3, 4]]", "1 2; 3 4", a pmatrix) and a
// vector ("(1, 2, 3)", "i − 2j + 3k", "î + k̂"). Each parser turns the many ways
// of writing the same object into one canonical shape, and each comparator
// decides equivalence on that shape — so inequality and interval notation are
// interchangeable, rows can be separated by ';' or a newline, and "1i−2j+3k"
// is the same vector as "(1, −2, 3)". Everything here is deterministic.
// ─────────────────────────────────────────────────────────────────────────────
import { evalNumeric, numsClose, parse, evaluate, variablesOf } from './expr.js';
import { exactValue, literalFraction, fraction, sameFraction, exactRadical, sameRadical, rationalAsRadical } from './exact.js';

const INF = Infinity;

function num(text) {
  const s = String(text).trim();
  if (!s) throw new Error('Empty number');
  const t = s.replace(/[−–—]/g, '-').replace(/\s+/g, '');
  if (/^[+-]?(inf|infinity|∞|oo)$/i.test(t)) return t.startsWith('-') ? -INF : INF;
  return evalNumeric(s);
}

// ── Exact endpoints ──────────────────────────────────────────────────────────
// An inequality's solution set has no rounding band: x > 999999999.9375 is
// not x > 1000000000, and x > 2000000000000001 is not x > 2000000000000000
// although the two differ by less than four units of the last binary place
// (#680; Q1 round 2 found that a relative-ULP band credited 17 such bounds).
// So each finite endpoint carries, beside its binary64 value, its exact
// rational value when it is written only in numbers (exact.js), and two
// endpoints are the same only when:
//   · both are exact and equal as fractions;
//   · one is exact and it IS the other's binary64 value (sqrt(1/4) is 1/2,
//     but the decimal 1.4142135623730951 is not √2);
//   · neither is exact (√8 and 2√2, each evaluated in binary64) and they agree
//     to four units of the last place — the noise of the evaluation;
//   · or the question authors a tolerance, the only approximate bound.

/** The exact rational value of a finite binary64. */
function floatFraction(v) {
  if (!Number.isFinite(v)) return null;
  if (Number.isInteger(v)) return fraction(BigInt(v));
  let m = v, e = 0n;
  while (!Number.isInteger(m)) { m *= 2; e += 1n; }
  return fraction(BigInt(m), 2n ** e);
}

/** A written bound: its value and, when it has one, its exact value. */
function bound(text) {
  const v = num(text);
  if (!Number.isFinite(v)) return { v, q: null, alg: null };
  const q = exactValue(String(text).replace(/[−–—]/g, '-'));
  return { v, q, alg: q ? null : exactRadical(String(text).replace(/[−–—]/g, '-')) };
}

/** An authored numeric endpoint means the decimal it is written as: 0.1 is 1/10. */
function authoredFraction(v) {
  if (!Number.isFinite(v)) return null;
  const q = literalFraction(String(Math.abs(v)));
  return q && (v < 0 ? fraction(-q.n, q.d) : q);
}

/** −1, 0 or 1 as the endpoint (x, xq) is below, at or above (y, yq). */
function cmpEnd(x, xq, y, yq) {
  if (xq && yq) {
    const d = xq.n * yq.d - yq.n * xq.d;
    return d < 0n ? -1 : d > 0n ? 1 : 0;
  }
  return x < y ? -1 : x > y ? 1 : 0;
}

function sameEndpoint(x, xq, xAlg, y, yq, yAlg, tol) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return x === y;
  if (tol != null) return Math.abs(x - y) <= tol;
  if (xq && yq) return sameFraction(xq, yq);
  // Radical forms that this small exact grammar can prove have identical
  // coefficients. A perturbation of 10^-15 is a different exact boundary,
  // even where binary64 evaluates the two expressions to the same float.
  if ((xAlg || xq) && (yAlg || yq)) return sameRadical(xAlg || rationalAsRadical(xq), yAlg || rationalAsRadical(yq));
  if (xq || yq) return sameFraction(xq || floatFraction(x), yq || floatFraction(y));
  return x === y || Math.abs(x - y) <= 4 * Number.EPSILON * Math.max(Math.abs(x), Math.abs(y));
}

// ── Intervals / inequality solutions ─────────────────────────────────────────

const ALL = Object.freeze([{ lo: -INF, hi: INF, loOpen: true, hiOpen: true }]);

function tidyRegionText(raw) {
  return String(raw ?? '')
    .trim()
    .replace(/[−–—]/g, '-')
    .replace(/≤/g, '<=').replace(/≥/g, '>=')
    .replace(/⩽/g, '<=').replace(/⩾/g, '>=')
    .replace(/\\le\b/g, '<=').replace(/\\ge\b/g, '>=')
    .replace(/\\infty/g, '∞')
    .replace(/[∞]/g, 'inf')
    .replace(/\binfinity\b/gi, 'inf')
    .replace(/\\cup|∪|\bU\b/g, '|')
    .replace(/\\cap|∩/g, '&')
    .replace(/\bor\b/gi, '|')
    .replace(/\band\b/gi, '&')
    .replace(/\\in\b|∈/g, ' in ')
    .replace(/ℝ|\\mathbb\{R\}|\\R\b/g, 'R')
    .replace(/\$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripSetBuilder(s, variable) {
  // {x : 2 < x <= 5}, {x | x > 3}, {x in R : x > 3}
  const m = s.match(/^\{\s*([a-zA-Z])\s*(?:in\s*R)?\s*[:|]\s*(.+)\}$/);
  if (m) return { text: m[2].trim(), variable: m[1] };
  // x in (2, 5]  /  x in R
  // x in (2, 5]: membership names the variable itself, so it must be the asked one
  const n = s.match(/^([a-zA-Z])\s*in\s*(.+)$/);
  if (n) {
    if (variable && n[1] !== variable) throw new Error('Wrong variable');
    return { text: n[2].trim(), variable: n[1] };
  }
  return { text: s, variable };
}

function halfLine(variable, op, boundText, variableOnLeft) {
  const { v: b, q, alg } = bound(boundText);
  if (!Number.isFinite(b)) throw new Error('A bound must be a finite number');
  // put the variable on the left: "3 < x" is "x > 3"
  const flipped = variableOnLeft ? op : ({ '<': '>', '<=': '>=', '>': '<', '>=': '<=' })[op];
  if (flipped === '<') return { lo: -INF, hi: b, loOpen: true, hiOpen: true, hiQ: q, hiAlg: alg };
  if (flipped === '<=') return { lo: -INF, hi: b, loOpen: true, hiOpen: false, hiQ: q, hiAlg: alg };
  if (flipped === '>') return { lo: b, hi: INF, loOpen: true, hiOpen: true, loQ: q, loAlg: alg };
  return { lo: b, hi: INF, loOpen: false, hiOpen: true, loQ: q, loAlg: alg };
}

function intersect(a, b) {
  const cl = cmpEnd(a.lo, a.loQ, b.lo, b.loQ), ch = cmpEnd(a.hi, a.hiQ, b.hi, b.hiQ);
  const L = cl >= 0 ? a : b, H = ch <= 0 ? a : b;
  return {
    lo: L.lo, loQ: L.loQ ?? null, loAlg: L.loAlg ?? null, hi: H.hi, hiQ: H.hiQ ?? null, hiAlg: H.hiAlg ?? null,
    loOpen: cl === 0 ? (a.loOpen || b.loOpen) : L.loOpen,
    hiOpen: ch === 0 ? (a.hiOpen || b.hiOpen) : H.hiOpen
  };
}

function isEmptyInterval(iv) {
  const c = cmpEnd(iv.lo, iv.loQ, iv.hi, iv.hiQ);
  if (c > 0) return true;
  // Only equal endpoints make a degenerate interval: (0, 1e-13) holds 5e-14
  // and is not empty, so nearly equal endpoints never erase it (#680, Q1).
  if (c === 0 && Number.isFinite(iv.lo)) return iv.loOpen || iv.hiOpen;
  return false;
}

/** Sort, drop empties and merge overlapping or touching pieces. */
export function normalizeRegion(intervals) {
  const list = (intervals || [])
    .map(iv => {
      const lo = iv.lo == null ? -INF : Number(iv.lo), hi = iv.hi == null ? INF : Number(iv.hi);
      return {
        lo, hi,
        // An endpoint parsed from text carries its exact value; an authored
        // number means the decimal it is written as.
        loQ: iv.loQ !== undefined ? iv.loQ : authoredFraction(lo),
        hiQ: iv.hiQ !== undefined ? iv.hiQ : authoredFraction(hi),
        loAlg: iv.loAlg ?? null, hiAlg: iv.hiAlg ?? null,
        loOpen: iv.lo == null ? true : !!iv.loOpen,
        hiOpen: iv.hi == null ? true : !!iv.hiOpen
      };
    })
    .filter(iv => !isEmptyInterval(iv))
    .sort((a, b) => cmpEnd(a.lo, a.loQ, b.lo, b.loQ) || (a.loOpen === b.loOpen ? 0 : a.loOpen ? 1 : -1));
  const out = [];
  for (const iv of list) {
    const last = out[out.length - 1];
    if (!last) { out.push({ ...iv }); continue; }
    const at = cmpEnd(iv.lo, iv.loQ, last.hi, last.hiQ);
    const touches = at < 0 || (at === 0 && !(iv.loOpen && last.hiOpen));
    if (!touches) { out.push({ ...iv }); continue; }
    const beyond = cmpEnd(iv.hi, iv.hiQ, last.hi, last.hiQ);
    if (beyond > 0) { last.hi = iv.hi; last.hiQ = iv.hiQ; last.hiAlg = iv.hiAlg; last.hiOpen = iv.hiOpen; }
    else if (beyond === 0) last.hiOpen = last.hiOpen && iv.hiOpen;
  }
  return out;
}

function parseAtom(text, variable) {
  const s = text.trim();
  if (!s) throw new Error('Empty region');
  if (/^(R|all real numbers|all reals|real numbers|\(-inf, ?inf\))$/i.test(s)) return [...ALL];
  if (/^(∅|\{\s*\}|phi|φ|empty set|empty|no solution|none)$/i.test(s)) return [];
  // interval notation: (a, b], [a, b), ]a, b] (French open bracket)
  const iv = s.match(/^([\[\(\]])\s*([^,]+?)\s*,\s*([^\]\)\[]+?)\s*([\]\)\[])$/);
  if (iv) {
    const L = bound(iv[2]), H = bound(iv[3]);
    const lo = L.v, hi = H.v;
    const loOpen = iv[1] !== '[';
    const hiOpen = iv[4] !== ']';
    if (Number.isNaN(lo) || Number.isNaN(hi)) throw new Error('Bad interval bound');
    return [{ lo, hi, loQ: L.q, hiQ: H.q, loAlg: L.alg, hiAlg: H.alg, loOpen: loOpen || lo === -INF, hiOpen: hiOpen || hi === INF }];
  }
  // relation chain: a < x <= b, x > 3, 3 < x
  const ops = [...s.matchAll(/<=|>=|<|>/g)];
  if (!ops.length) throw new Error('Not an inequality');
  const parts = [];
  let cursor = 0;
  for (const m of ops) { parts.push(s.slice(cursor, m.index).trim()); cursor = m.index + m[0].length; }
  parts.push(s.slice(cursor).trim());
  if (parts.some(p => !p)) throw new Error('Malformed inequality');
  // The one letter a comparison may name is the bound variable: "y > 3" is
  // not a solution set in x, and "2 < x <= y" is not an interval (#680).
  // With no variable bound yet, every comparison must name the same letter.
  const letters = new Set(parts.filter(p => /^[a-zA-Z]$/.test(p)));
  if (variable ? [...letters].some(l => l !== variable) : letters.size > 1) throw new Error('Wrong variable');
  const isVar = p => /^[a-zA-Z]$/.test(p);
  let region = [...ALL];
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i][0];
    const L = parts[i], R = parts[i + 1];
    let half;
    if (isVar(L) && !isVar(R)) half = halfLine(L, op, R, true);
    else if (isVar(R) && !isVar(L)) half = halfLine(R, op, L, false);
    else throw new Error('One side of each comparison must be the variable');
    region = region.map(iv => intersect(iv, half));
  }
  return normalizeRegion(region);
}

/**
 * Read an inequality or interval answer into a normalised list of intervals.
 * Accepts inequality chains, interval notation, unions ("x < 2 or x > 5",
 * "(−∞, 2) ∪ (5, ∞)"), set-builder braces, "x ∈ R" and "no solution".
 * Returns { intervals, variable }.
 */
export function parseIntervalInput(raw, variable = null) {
  let s = tidyRegionText(raw);
  if (!s) throw new Error('Empty answer');
  s = s.replace(/^[a-zA-Z]\s*=\s*(?=[\[\(\{])/, '');       // "S = (2, 5]"
  const sb = stripSetBuilder(s, variable);
  s = sb.text;
  const usedVariable = sb.variable || variable;
  const unions = s.split('|').map(p => p.trim());
  // Dropping an empty segment converts malformed syntax into an apparently
  // valid set: 'x>3 or' must never receive credit for 'x>3'.
  if (unions.some(p => !p)) throw new Error('Empty union term');
  let intervals = [];
  for (const u of unions) {
    const ands = u.split('&').map(p => p.trim());
    if (ands.some(p => !p)) throw new Error('Empty intersection term');
    let region = [...ALL];
    for (const atom of ands) {
      const piece = parseAtom(atom, usedVariable);
      const next = [];
      for (const a of region) for (const b of piece) next.push(intersect(a, b));
      region = normalizeRegion(next);
    }
    intervals = intervals.concat(region);
  }
  return { intervals: normalizeRegion(intervals), variable: usedVariable || 'x' };
}

/** The authored region of an answer: { intervals } with null for ±∞, or a `region` string. */
export function authoredRegion(ans) {
  if (!ans) return null;
  if (typeof ans.region === 'string') return parseIntervalInput(ans.region, ans.variable || 'x').intervals;
  if (Array.isArray(ans.intervals)) return normalizeRegion(ans.intervals);
  return null;
}

export function sameRegion(a, b, tol) {
  const A = normalizeRegion(a), B = normalizeRegion(b);
  if (A.length !== B.length) return false;
  return A.every((iv, i) => sameEndpoint(iv.lo, iv.loQ, iv.loAlg, B[i].lo, B[i].loQ, B[i].loAlg, tol) && sameEndpoint(iv.hi, iv.hiQ, iv.hiAlg, B[i].hi, B[i].hiQ, B[i].hiAlg, tol)
    && iv.loOpen === B[i].loOpen && iv.hiOpen === B[i].hiOpen);
}

/** Same endpoints, different inclusion — the commonest near miss. */
export function sameRegionIgnoringEndpoints(a, b, tol) {
  const A = normalizeRegion(a), B = normalizeRegion(b);
  if (A.length !== B.length) return false;
  return A.every((iv, i) => sameEndpoint(iv.lo, iv.loQ, iv.loAlg, B[i].lo, B[i].loQ, B[i].loAlg, tol) && sameEndpoint(iv.hi, iv.hiQ, iv.hiAlg, B[i].hi, B[i].hiQ, B[i].hiAlg, tol));
}

const fmtNum = v => (Number.isInteger(v) ? String(v) : String(Number(v.toPrecision(10))));

/** "x > 3", "2 < x ≤ 5", "x < 2 or x > 5", "all real numbers", "no solution". */
export function formatRegion(intervals, variable = 'x', style = 'inequality') {
  const list = normalizeRegion(intervals);
  if (!list.length) return 'no solution';
  if (list.length === 1 && list[0].lo === -INF && list[0].hi === INF) return style === 'interval' ? '(−∞, ∞)' : `${variable} ∈ ℝ`;
  const piece = iv => {
    if (style === 'interval') {
      const lo = iv.lo === -INF ? '−∞' : fmtNum(iv.lo);
      const hi = iv.hi === INF ? '∞' : fmtNum(iv.hi);
      return `${iv.loOpen ? '(' : '['}${lo}, ${hi}${iv.hiOpen ? ')' : ']'}`;
    }
    if (iv.lo === -INF) return `${variable} ${iv.hiOpen ? '<' : '≤'} ${fmtNum(iv.hi)}`;
    if (iv.hi === INF) return `${variable} ${iv.loOpen ? '>' : '≥'} ${fmtNum(iv.lo)}`;
    return `${fmtNum(iv.lo)} ${iv.loOpen ? '<' : '≤'} ${variable} ${iv.hiOpen ? '<' : '≤'} ${fmtNum(iv.hi)}`;
  };
  return list.map(piece).join(style === 'interval' ? ' ∪ ' : ' or ');
}

// ── Matrices ─────────────────────────────────────────────────────────────────

// A written separator stands between two entries: "1,,2" or "1, 2," leaves an
// entry blank, and a blank entry is refused, never dropped — dropping it read
// [[1,,2],[3,4]] as [[1,2],[3,4]] (#680, Q1).
function separated(s, sep) {
  const parts = s.split(sep).map(p => p.trim());
  if (parts.some(p => !p)) throw new Error('Blank entry');
  return parts;
}

function splitEntries(text) {
  const s = text.trim().replace(/[−–—]/g, '-');
  if (!s) return [];
  if (s.includes(',')) return separated(s, ',');
  if (s.includes('&')) return separated(s, '&');
  // whitespace separated, keeping "1/2" and "-3" whole
  return s.split(/\s+/).map(p => p.trim()).filter(Boolean);
}

/**
 * Read a matrix: "[[1, 2], [3, 4]]", "((1,2),(3,4))", "{{1,2},{3,4}}",
 * "[1 2; 3 4]", "1, 2; 3, 4", rows on separate lines, a KaTeX pmatrix, and an
 * optional scalar in front ("1/3 [[2, -1], [-1, 2]]" — how an inverse is written).
 * Returns { rows } with numeric entries.
 */
export function parseMatrixInput(raw) {
  let s = String(raw ?? '').trim();
  if (!s) throw new Error('Empty matrix');
  s = s.replace(/\$/g, '')
    .replace(/^[A-Za-z]{1,4}(?:\^\{?-1\}?|⁻¹|\^T|')?\s*=\s*/, '')
    .replace(/\\begin\{[pbvB]?matrix\}/g, '[[').replace(/\\end\{[pbvB]?matrix\}/g, ']]')
    .replace(/\\\\/g, '],[')
    .replace(/\\left|\\right/g, '')
    .replace(/[−–—]/g, '-');
  // leading scalar: "1/3[[...]]", "(1/3)((...))", "2 × [1 2; 3 4]"
  let scalar = 1;
  const lead = s.match(/^(.*?)\s*[*×·]?\s*((?:\[\[|\(\(|\{\{|\[|\().*)$/s);
  if (lead && lead[1].trim()) {
    const prefix = lead[1].trim().replace(/[*×·]\s*$/, '').trim();
    if (prefix) {
      scalar = num(prefix);
      if (!Number.isFinite(scalar)) throw new Error('Bad scalar');
    }
    s = lead[2];
  }
  let rows;
  const nested = s.match(/^\s*[\[\(\{]\s*([\[\(\{][\s\S]*[\]\)\}])\s*[\]\)\}]\s*$/);
  if (nested && /[\]\)\}]\s*,?\s*[\[\(\{]/.test(nested[1])) {
    const groups = [...nested[1].matchAll(/[\[\(\{]([^\[\]\(\)\{\}]*)[\]\)\}]/g)].map(m => m[1]);
    if (!groups.length) throw new Error('No rows');
    rows = groups.map(splitEntries);
  } else {
    let inner = s.replace(/^\s*[\[\(\{\|]\s*/, '').replace(/\s*[\]\)\}\|]\s*$/, '');
    // Rows on separate lines may have blank lines between them; a written ";" may not be doubled.
    const rowTexts = inner.includes(';') ? separated(inner, ';') : inner.split(/\n/).map(r => r.trim()).filter(Boolean);
    rows = rowTexts.map(splitEntries);
  }
  if (!rows.length || rows.some(r => !r.length)) throw new Error('Empty row');
  const width = rows[0].length;
  if (rows.some(r => r.length !== width)) throw new Error('Rows have different lengths');
  const values = rows.map(r => r.map(e => {
    const v = num(e) * scalar;
    if (!Number.isFinite(v)) throw new Error('Bad entry');
    return v;
  }));
  return { rows: values };
}

export function sameMatrix(a, b, tol) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  return a.every((row, i) => Array.isArray(b[i]) && row.length === b[i].length && row.every((v, j) => numsClose(v, b[i][j], tol)));
}

export function transposeMatrix(rows) {
  if (!rows.length) return [];
  return rows[0].map((_, j) => rows.map(r => r[j]));
}

export function formatMatrix(rows) {
  return `[${rows.map(r => `[${r.map(fmtNum).join(', ')}]`).join(', ')}]`;
}

// ── Vectors ──────────────────────────────────────────────────────────────────

const HATS = /[̂̃̄⃗⃖]/g;

/**
 * Read a vector: "(1, 2, 3)", "<1, 2, 3>", "⟨1, 2, 3⟩", "[1, 2, 3]", "1i − 2j + 3k",
 * "i − 2j + 3k", "î + k̂", "\hat{i} + 2\hat{j}", one component per line.
 * Returns { components } — three entries; a two-dimensional answer is padded with 0.
 */
const VECTOR_AXES = ['i', 'j', 'k'];

// "\hat{i}" → "i", then a leading "\vec{a} =" or "a⃗ =" label is dropped. Each
// optional brace or arrow owns the whitespace that follows it, so a run of
// spaces can be read one way only and the match stays linear in the input —
// two adjacent `\s*` around an optional token is what made these quadratic.
// The strings matched, and what replaces them, are unchanged.
const HAT_AXIS = /\\hat\s*(?:\{\s*)?([ijk])\s*\}?/g;
const VEC_LABEL = /\\vec\s*(?:\{\s*)?[a-zA-Z]\s*(?:\}\s*)?=\s*/g;
const NAME_LABEL = /^[a-zA-Z]{1,3}\s*(?:(?:→|⃗)\s*)?=\s*/;
export function stripVectorNotation(text) {
  return String(text).replace(HAT_AXIS, '$1').replace(VEC_LABEL, '').replace(NAME_LABEL, '');
}
export function parseVectorInput(raw) {
  let s = String(raw ?? '').trim();
  if (!s) throw new Error('Empty vector');
  s = stripVectorNotation(s.replace(/\$/g, '').replace(HATS, ''))
    .replace(/[îí]/g, 'i').replace(/[ĵ]/g, 'j').replace(/[ǩ]/g, 'k')
    .replace(/[−–—]/g, '-')
    .trim();
  const listLike = /^[\(\[<⟨\{]/.test(s) || s.includes(',') || /\n/.test(s);
  const ijk = /[ijk]/.test(s) && !listLike;
  let comps;
  if (ijk) {
    const compact = s.replace(/\s+/g, '').replace(/\*/g, '');
    // Every character belongs to a term, and a run of signs is read by its
    // parity: i − −2j is i + 2j. Before, the regex skipped the first sign of a
    // run, so i − −2j read as i − 2j (#680).
    const terms = compact.match(/[+-]*[^+-]+/g) || [];
    if (terms.join('') !== compact) throw new Error('Not a component');
    // Components are indexed by position (i=0, j=1, k=2), never by a name
    // taken from the input, so no student text ever becomes a property key.
    const out = [0, 0, 0];
    const seen = [false, false, false];
    for (const term of terms) {
      const m = term.match(/^([+-]*)(.*?)([ijk])$/);
      if (!m) throw new Error('Not a component');
      const [, signs, coef, axis] = m;
      const sign = (signs.match(/-/g) || []).length % 2 ? '-' : '+';
      const slot = VECTOR_AXES.indexOf(axis);
      if (slot < 0) throw new Error('Not a component');
      if (seen[slot]) throw new Error('Repeated component');
      seen[slot] = true;
      const magnitude = coef === '' ? 1 : num(coef);
      if (!Number.isFinite(magnitude)) throw new Error('Bad component');
      out[slot] = (sign === '-' ? -1 : 1) * magnitude;
    }
    comps = out;
  } else {
    const inner = s.replace(/^[\(\[<⟨\{]\s*/, '').replace(/\s*[\)\]>⟩\}]$/, '');
    // A comma stands between two components: "(1,,2,3)" and "(1,2,3,)" leave one blank and are refused.
    const parts = inner.includes(',') ? separated(inner, ',') : inner.split(/\n|\s{2,}|\s+/).map(p => p.trim()).filter(Boolean);
    comps = parts.map(p => {
      const v = num(p);
      if (!Number.isFinite(v)) throw new Error('Bad component');
      return v;
    });
    if (comps.length < 2 || comps.length > 3) throw new Error('A vector needs two or three components');
    if (comps.length === 2) comps.push(0);
  }
  return { components: comps };
}

export function sameVector(a, b, tol) {
  const A = [...a], B = [...b];
  while (A.length < 3) A.push(0);
  while (B.length < 3) B.push(0);
  return A.length === B.length && A.every((v, i) => numsClose(v, B[i], tol));
}

export function formatVector(components, style = 'ijk') {
  const c = [...components];
  while (c.length < 3) c.push(0);
  if (style === 'tuple') return `(${c.map(fmtNum).join(', ')})`;
  const axes = ['i', 'j', 'k'];
  let out = '';
  c.forEach((v, idx) => {
    if (v === 0) return;
    const mag = Math.abs(v);
    const coef = mag === 1 ? '' : fmtNum(mag);
    if (!out) out = `${v < 0 ? '−' : ''}${coef}${axes[idx]}`;
    else out += ` ${v < 0 ? '−' : '+'} ${coef}${axes[idx]}`;
  });
  return out || '0';
}

// ── Complex numbers ──────────────────────────────────────────────────────────
// Class 11 writes a complex number as a + bi and, from the Argand plane
// onward, in polar form: r(cos θ + i sin θ), r cis θ, r∠θ, r e^{iθ}. Both are
// the same number and both are read into one shape, { re, im }. Rectangular
// input is read by evaluating the written expression as a function of i and
// insisting it be linear in i: a + bi, bi + a, (a + bi), (2 + 4i)/2 are all
// linear; anything that still has an i² in it has not been simplified and is
// not read as a final answer. Polar input reads its modulus and argument and
// records `polar: true`, because an argument written to two decimal places of
// a degree is an approximation the comparator has to allow for.

const DEG_WRITTEN = /(?:°|º|˚|\bdeg(?:ree)?s?)\s*$/i;

function angleValue(text) {
  let s = String(text ?? '').trim().replace(/^\(\s*/, '').replace(/\s*\)$/, '').trim();
  if (!s) throw new Error('Empty angle');
  const deg = DEG_WRITTEN.test(s);
  s = s.replace(DEG_WRITTEN, '').replace(/\brad(?:ian)?s?\s*$/i, '').trim();
  const v = evalNumeric(s);
  if (!Number.isFinite(v)) throw new Error('Bad angle');
  return deg ? v * Math.PI / 180 : v;
}

function modulusValue(text) {
  const s = String(text ?? '').trim().replace(/[*×·]\s*$/, '').trim();
  if (!s) return 1;
  const v = evalNumeric(s);
  if (!Number.isFinite(v)) throw new Error('Bad modulus');
  return v;
}

function fromPolar(r, theta) {
  return { re: r * Math.cos(theta), im: r * Math.sin(theta), polar: true };
}

/** The polar forms, or null when the text is not one of them. */
function parsePolar(s) {
  // r cis θ  /  r ∠ θ  /  cis θ
  let m = s.match(/^(.*?)\s*(?:cis|∠)\s*(.+)$/i);
  if (m) return fromPolar(modulusValue(m[1]), angleValue(m[2]));
  // r(cos θ ± i sin θ)  /  cos θ + i sin θ
  m = s.match(/^(.*?)\s*\(?\s*cos\s*\(?\s*([^()]+?)\s*\)?\s*([+-])\s*i\s*\*?\s*sin\s*\(?\s*([^()]+?)\s*\)?\s*\)?$/i);
  if (m) {
    const [, rText, a, sign, b] = m;
    const theta = angleValue(a);
    if (Math.abs(theta - angleValue(b)) > 1e-9) throw new Error('cos and sin take the same angle in polar form');
    return fromPolar(modulusValue(rText.replace(/\($/, '')), sign === '-' ? -theta : theta);
  }
  // r e^{iθ}  /  r e^(θi)  /  e^(iπ/2)
  m = s.match(/^(.*?)\s*e\s*\^\s*(?:\{|\()?\s*(.+?)\s*(?:\}|\))?$/i);
  if (m && /i/.test(m[2])) {
    const expo = m[2].trim();
    let thetaText = null;
    if (/^i\s*\*?\s*/.test(expo)) thetaText = expo.replace(/^i\s*\*?\s*/, '');
    else if (/\*?\s*i$/.test(expo)) thetaText = expo.replace(/\s*\*?\s*i$/, '');
    if (thetaText != null) return fromPolar(modulusValue(m[1]), angleValue(thetaText || '1'));
  }
  return null;
}

/**
 * Read a complex number in any of the forms above into { re, im, polar }.
 * Throws when the text is not a single complex number.
 */
export function parseComplexInput(raw) {
  let s = String(raw ?? '').trim();
  if (!s) throw new Error('Empty complex number');
  s = s.replace(/\$/g, '')
    .replace(/^[a-zA-Z]\s*=\s*/, '')          // "z = …"
    .replace(/[−–—]/g, '-')
    .replace(/[×·⋅]/g, '*')
    .replace(/\\(?:left|right)/g, '')
    .replace(/\\(?:cos|sin)/g, m => m.slice(1))
    .replace(/\biota\b/gi, 'i')
    .replace(/\s+/g, ' ')
    .trim();
  const polar = parsePolar(s);
  if (polar) return polar;

  // Rectangular: the expression as a function of i must be linear in i.
  let ast;
  try { ast = parse(s); } catch { throw new Error('Not a complex number'); }
  if (ast.t === 'equation') throw new Error('Not a complex number');
  const vars = variablesOf(ast);
  vars.delete('i');
  if (vars.size) throw new Error('A complex number has no other variables');
  const at = t => evaluate(ast, { i: t });
  const f0 = at(0), f1 = at(1);
  if (![f0, f1].every(Number.isFinite)) throw new Error('Not a complex number');
  const im = f1 - f0;
  const scale = Math.max(1, Math.abs(f0), Math.abs(im));
  // Linear at whole and at irregular points: an expression that only happens
  // to agree with a line at a few whole numbers (a product of (i − k) factors
  // added on) is not read as a + bi.
  for (const t of [2, -1, 3, -2, 0.37, -2.43, 3.71]) {
    const f = at(t);
    if (!Number.isFinite(f) || Math.abs((f - f0) - t * im) > 1e-9 * scale * Math.max(1, Math.abs(t))) throw new Error('Simplify to a + bi');
  }
  return { re: f0, im, polar: false };
}

/** Same complex number, to a tolerance; `tol` applies to each part. */
export function sameComplex(a, b, tol) {
  return numsClose(a.re, b.re, tol) && numsClose(a.im, b.im, tol);
}

export function formatComplex({ re, im }) {
  const r = fmtNum(re), m = fmtNum(Math.abs(im));
  if (Math.abs(im) < 1e-12) return r;
  const imag = `${Math.abs(Math.abs(im) - 1) < 1e-12 ? '' : m}i`;
  if (Math.abs(re) < 1e-12) return `${im < 0 ? '−' : ''}${imag}`;
  return `${r} ${im < 0 ? '−' : '+'} ${imag}`;
}
