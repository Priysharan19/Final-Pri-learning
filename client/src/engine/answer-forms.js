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
import { evalNumeric, numsClose } from './expr.js';

const INF = Infinity;

function num(text) {
  const s = String(text).trim();
  if (!s) throw new Error('Empty number');
  const t = s.replace(/[−–—]/g, '-').replace(/\s+/g, '');
  if (/^[+-]?(inf|infinity|∞|oo)$/i.test(t)) return t.startsWith('-') ? -INF : INF;
  return evalNumeric(s);
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
  const n = s.match(/^([a-zA-Z])\s*in\s*(.+)$/);
  if (n) return { text: n[2].trim(), variable: n[1] };
  return { text: s, variable };
}

function halfLine(variable, op, boundText, variableOnLeft) {
  const b = num(boundText);
  if (!Number.isFinite(b)) throw new Error('A bound must be a finite number');
  // put the variable on the left: "3 < x" is "x > 3"
  const flipped = variableOnLeft ? op : ({ '<': '>', '<=': '>=', '>': '<', '>=': '<=' })[op];
  if (flipped === '<') return { lo: -INF, hi: b, loOpen: true, hiOpen: true };
  if (flipped === '<=') return { lo: -INF, hi: b, loOpen: true, hiOpen: false };
  if (flipped === '>') return { lo: b, hi: INF, loOpen: true, hiOpen: true };
  return { lo: b, hi: INF, loOpen: false, hiOpen: true };
}

function intersect(a, b) {
  const lo = Math.max(a.lo, b.lo);
  const hi = Math.min(a.hi, b.hi);
  const loOpen = a.lo === b.lo ? (a.loOpen || b.loOpen) : (a.lo > b.lo ? a.loOpen : b.loOpen);
  const hiOpen = a.hi === b.hi ? (a.hiOpen || b.hiOpen) : (a.hi < b.hi ? a.hiOpen : b.hiOpen);
  return { lo, hi, loOpen, hiOpen };
}

function isEmptyInterval(iv) {
  if (iv.lo > iv.hi) return true;
  if (numsClose(iv.lo, iv.hi, 1e-12) && Number.isFinite(iv.lo)) return iv.loOpen || iv.hiOpen;
  return false;
}

/** Sort, drop empties and merge overlapping or touching pieces. */
export function normalizeRegion(intervals) {
  const list = (intervals || [])
    .map(iv => ({
      lo: iv.lo == null ? -INF : Number(iv.lo),
      hi: iv.hi == null ? INF : Number(iv.hi),
      loOpen: iv.lo == null ? true : !!iv.loOpen,
      hiOpen: iv.hi == null ? true : !!iv.hiOpen
    }))
    .filter(iv => !isEmptyInterval(iv))
    .sort((a, b) => a.lo - b.lo || (a.loOpen === b.loOpen ? 0 : a.loOpen ? 1 : -1));
  const out = [];
  for (const iv of list) {
    const last = out[out.length - 1];
    if (!last) { out.push({ ...iv }); continue; }
    const touches = iv.lo < last.hi || (numsClose(iv.lo, last.hi, 1e-12) && !(iv.loOpen && last.hiOpen));
    if (!touches) { out.push({ ...iv }); continue; }
    if (iv.hi > last.hi || (numsClose(iv.hi, last.hi, 1e-12) && !iv.hiOpen)) {
      last.hi = Math.max(last.hi, iv.hi);
      last.hiOpen = numsClose(iv.hi, last.hi, 1e-12) ? (iv.hi > last.hi ? iv.hiOpen : (last.hiOpen && iv.hiOpen)) : last.hiOpen;
      if (iv.hi >= last.hi) last.hiOpen = iv.hiOpen;
    }
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
    const lo = num(iv[2]), hi = num(iv[3]);
    const loOpen = iv[1] !== '[';
    const hiOpen = iv[4] !== ']';
    if (Number.isNaN(lo) || Number.isNaN(hi)) throw new Error('Bad interval bound');
    return [{ lo, hi, loOpen: loOpen || lo === -INF, hiOpen: hiOpen || hi === INF }];
  }
  // relation chain: a < x <= b, x > 3, 3 < x
  const ops = [...s.matchAll(/<=|>=|<|>/g)];
  if (!ops.length) throw new Error('Not an inequality');
  const parts = [];
  let cursor = 0;
  for (const m of ops) { parts.push(s.slice(cursor, m.index).trim()); cursor = m.index + m[0].length; }
  parts.push(s.slice(cursor).trim());
  if (parts.some(p => !p)) throw new Error('Malformed inequality');
  const isVar = p => /^[a-zA-Z]$/.test(p) && (!variable || p === variable || !/^[0-9]/.test(p));
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
  const unions = s.split('|').map(p => p.trim()).filter(Boolean);
  if (!unions.length) throw new Error('Empty answer');
  let intervals = [];
  for (const u of unions) {
    const ands = u.split('&').map(p => p.trim()).filter(Boolean);
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
  const close = (x, y) => (Number.isFinite(x) || Number.isFinite(y)) ? numsClose(x, y, tol) : x === y;
  return A.every((iv, i) => close(iv.lo, B[i].lo) && close(iv.hi, B[i].hi) && iv.loOpen === B[i].loOpen && iv.hiOpen === B[i].hiOpen);
}

/** Same endpoints, different inclusion — the commonest near miss. */
export function sameRegionIgnoringEndpoints(a, b, tol) {
  const A = normalizeRegion(a), B = normalizeRegion(b);
  if (A.length !== B.length) return false;
  const close = (x, y) => (Number.isFinite(x) || Number.isFinite(y)) ? numsClose(x, y, tol) : x === y;
  return A.every((iv, i) => close(iv.lo, B[i].lo) && close(iv.hi, B[i].hi));
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

function splitEntries(text) {
  const s = text.trim().replace(/[−–—]/g, '-');
  if (!s) return [];
  if (s.includes(',')) return s.split(',').map(p => p.trim()).filter(Boolean);
  if (s.includes('&')) return s.split('&').map(p => p.trim()).filter(Boolean);
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
    const rowTexts = inner.includes(';') ? inner.split(';') : inner.split(/\n/);
    rows = rowTexts.map(r => r.trim()).filter(Boolean).map(splitEntries);
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
export function parseVectorInput(raw) {
  let s = String(raw ?? '').trim();
  if (!s) throw new Error('Empty vector');
  s = s.replace(/\$/g, '')
    .replace(HATS, '')
    .replace(/\\hat\s*\{?\s*([ijk])\s*\}?/g, '$1')
    .replace(/\\vec\s*\{?\s*[a-zA-Z]\s*\}?\s*=\s*/g, '')
    .replace(/^[a-zA-Z]{1,3}\s*(?:→|⃗)?\s*=\s*/, '')
    .replace(/[îí]/g, 'i').replace(/[ĵ]/g, 'j').replace(/[ǩ]/g, 'k')
    .replace(/[−–—]/g, '-')
    .trim();
  const listLike = /^[\(\[<⟨\{]/.test(s) || s.includes(',') || /\n/.test(s);
  const ijk = /[ijk]/.test(s) && !listLike;
  let comps;
  if (ijk) {
    const compact = s.replace(/\s+/g, '').replace(/\*/g, '');
    const terms = compact.match(/[+-]?[^+-]+/g) || [];
    const out = { i: 0, j: 0, k: 0 };
    const seen = { i: false, j: false, k: false };
    for (const term of terms) {
      const m = term.match(/^([+-]?)(.*?)([ijk])$/);
      if (!m) throw new Error('Not a component');
      const [, sign, coef, axis] = m;
      if (seen[axis]) throw new Error('Repeated component');
      seen[axis] = true;
      const magnitude = coef === '' ? 1 : num(coef);
      if (!Number.isFinite(magnitude)) throw new Error('Bad component');
      out[axis] = (sign === '-' ? -1 : 1) * magnitude;
    }
    comps = [out.i, out.j, out.k];
  } else {
    const inner = s.replace(/^[\(\[<⟨\{]\s*/, '').replace(/\s*[\)\]>⟩\}]$/, '');
    const parts = inner.includes(',') ? inner.split(',') : inner.split(/\n|\s{2,}|\s+/);
    comps = parts.map(p => p.trim()).filter(Boolean).map(p => {
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
