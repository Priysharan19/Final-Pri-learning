// Pri Learning · diagram pack "stats": kind names, pure spec validators and the pure
// models the components draw (no React). See docs/design/notes-e3-contract.md §2.
//
// validate(params) returns a list of problems (empty when the spec is good);
// model(params) is the pure geometry and every computed number the component shows,
// so tests can check the numbers without a browser. Everything a label says (an
// angle, a probability, a mean) is computed here from the spec, never typed:
//   · probabilities are exact (whole-number combinatorics; fractions in lowest terms
//     when the weights are whole numbers);
//   · pie-chart angles are rounded by the largest-remainder rule, so they add to 360
//     exactly;
//   · the simulator is a seeded generator (mulberry32): the same seed gives the same
//     trials on every device, and its state is a plain number, so a React component
//     can keep it in state and every step is a pure function;
//   · value axes of bar charts start at 0 (never a truncated axis).
import { r3, niceStep, niceTicks, makeFrame, fraction, fadd, ftex, ftext, fiveNumber } from '../geometry.js';

const isNum = v => typeof v === 'number' && Number.isFinite(v);
const isInt = v => Number.isInteger(v);
const sum = a => a.reduce((s, v) => s + v, 0);
/** An estimate of a label's width in SVG units (14 px Computer Modern, generous). */
export const estWidth = s => String(s).replace(/\$|\\[a-z]+|[{}^_]/gi, '').length * 7.4 + 8;
/** Plain words for a text alternative from a label that may hold $…$ TeX. */
export const plain = s => String(s).replace(/\\tfrac\{(\d+)\}\{(\d+)\}/g, '$1/$2').replace(/\\[a-z]+/gi, ' ').replace(/[\\${}^_]/g, '').replace(/\s+/g, ' ').trim();
/** A category label for MathText: numbers are typeset as maths, words stay words. */
export const catText = s => (/^-?\d+(\.\d+)?$/.test(String(s)) ? `$${s}$` : String(s));
const fmt = (v, d = 4) => String(r3(v, d));

/** The top of a value axis from 0: the first nice step at or above `max`. */
function niceRange(lo, hi, target = 5) {
  const span = hi - lo || Math.max(1, Math.abs(hi));
  const step = niceStep(span, target);
  const vmin = lo < 0 ? r3(Math.floor(lo / step - 1e-9) * step, 6) : 0;
  let vmax = hi > 0 ? r3(Math.ceil(hi / step - 1e-9) * step, 6) : 0;
  if (vmax === vmin) vmax = r3(vmin + step, 6);
  return { vmin, vmax, step };
}

/**
 * Category labels under (or beside) equal slots: one row when they fit, two staggered
 * rows when a label is wider than a slot but narrower than two, otherwise every k-th
 * label (the text alternative still names every category). Never two on one spot.
 */
export function categoryAxis(texts, slot, { allowStagger = true } = {}) {
  const widest = Math.max(...texts.map(estWidth));
  if (widest <= slot - 4) return { mode: 'row', rows: 1, every: 1, shown: texts.map(() => true), row: texts.map(() => 0) };
  if (allowStagger && widest <= 2 * slot - 6) return { mode: 'stagger', rows: 2, every: 1, shown: texts.map(() => true), row: texts.map((_, i) => i % 2) };
  const every = Math.ceil((widest + 6) / slot);
  return { mode: 'thin', rows: 1, every, shown: texts.map((_, i) => i % every === 0), row: texts.map(() => 0) };
}

// ── Bar charts ───────────────────────────────────────────────────────────────
export const EXPERIMENTS = Object.freeze(['coin', 'die', 'twoDiceSum', 'spinner', 'bag']);

function validateBars(p) {
  const e = [];
  if (!Array.isArray(p.categories) || !p.categories.length) e.push('categories must be a non-empty list');
  if (!Array.isArray(p.values) || !p.values.length) e.push('values must be a non-empty list');
  if (e.length) return e;
  if (p.categories.length !== p.values.length) e.push(`there are ${p.categories.length} categories but ${p.values.length} values`);
  if (p.categories.length > 24) e.push('at most 24 categories fit a bar chart');
  if (p.categories.some(c => !(typeof c === 'string' && c.trim()) && !isNum(c))) e.push('every category needs a name');
  if (new Set(p.categories.map(String)).size !== p.categories.length) e.push('categories must be different from one another');
  if (p.values.some(v => !isNum(v))) e.push('every value must be a finite number');
  if (p.dual !== undefined) {
    if (!p.dual || !Array.isArray(p.dual.values)) e.push('dual needs { values, label }');
    else {
      if (p.dual.values.length !== p.categories.length) e.push(`dual has ${p.dual.values.length} values for ${p.categories.length} categories`);
      if (p.dual.values.some(v => !isNum(v))) e.push('every dual value must be a finite number');
      if (p.dual.label !== undefined && typeof p.dual.label !== 'string') e.push('dual.label must be text');
    }
  }
  if (p.horizontal !== undefined && typeof p.horizontal !== 'boolean') e.push('horizontal must be true or false');
  return e;
}

/**
 * A bar chart (vertical or horizontal; one series or two side by side). The value axis
 * always includes 0. Given an `experiment` (a probabilitySim spec shown in a question),
 * it draws the theoretical probabilities.
 */
export function barChartModel(params) {
  const src = params.experiment ? theoryAsBars(params) : params;
  const categories = src.categories.map(String);
  const values = src.values.map(Number);
  const dual = src.dual ? src.dual.values.map(Number) : null;
  const valueTex = src.valueTex || values.map(v => fmt(v));
  const dualTex = dual ? dual.map(v => fmt(v)) : null;
  const horizontal = !!src.horizontal;
  const n = categories.length;
  const all = [...values, ...(dual || [])];
  const { vmin, vmax, step } = niceRange(Math.min(0, ...all), Math.max(0, ...all));
  const ticks = niceTicks(vmin, vmax, Math.round((vmax - vmin) / step));
  const tickW = Math.max(...ticks.map(t => estWidth(String(t))));
  const hasTop = !!(dual || src.yLabel);
  const texts = categories.map(catText);
  if (!horizontal) {
    const width = 480; const height = 300;
    const left = Math.max(40, tickW + 14);
    const slot0 = (width - left - 14) / n;
    const axis = categoryAxis(texts, slot0);
    const pad = { l: left, r: 14, t: 20 + (hasTop ? 24 : 0), b: 22 + axis.rows * 18 + (src.xLabel ? 18 : 0) };
    const frame = makeFrame({ xmin: 0, xmax: n, ymin: vmin, ymax: vmax, width, height, pad });
    const slot = (frame.right - frame.left) / n;
    const base = frame.sy(0);
    const groupW = slot * (dual ? 0.78 : 0.62);
    const barW = dual ? groupW / 2 : groupW;
    const bars = [];
    categories.forEach((c, i) => {
      const x0 = frame.left + slot * i + (slot - groupW) / 2;
      const series = dual ? [[values[i], valueTex[i], 0], [dual[i], dualTex[i], 1]] : [[values[i], valueTex[i], 0]];
      for (const [v, tex, s] of series) {
        const top = frame.sy(Math.max(v, 0)); const bottom = frame.sy(Math.min(v, 0));
        const x = r3(x0 + s * barW);
        bars.push({ i, series: s, value: v, tex, x, y: top, w: r3(barW - (dual ? 2 : 0)), h: r3(bottom - top), label: { x: r3(x + barW / 2 - (dual ? 1 : 0)), y: v >= 0 ? r3(top - 9) : r3(bottom + 9) } });
      }
    });
    const showValues = bars.every(b => estWidth(b.tex) - 8 <= (dual ? barW + 6 : slot - 4));
    const cats = categories.map((c, i) => ({ i, text: texts[i], x: r3(frame.left + slot * (i + 0.5)), y: r3(frame.bottom + 13 + axis.row[i] * 18), shown: axis.shown[i] }));
    return { kind: 'barChart', horizontal, frame, n, categories, values, dual, vmin, vmax, ticks: ticks.map(v => ({ value: v, px: frame.sy(v) })), base, bars, showValues, cats, axis, slot: r3(slot), theory: !!params.experiment, yLabel: src.yLabel || null, xLabel: src.xLabel || null, dualLabel: src.dual?.label || null, label: src.label || null };
  }
  // Horizontal: categories down the left, values across.
  const catW = Math.min(170, Math.max(...texts.map(estWidth)) + 8);
  const valW = Math.max(...[...valueTex, ...(dualTex || [])].map(estWidth));
  const rowH = dual ? 44 : 32;
  const pad = { l: catW + 12, r: Math.max(18, valW + 4), t: 14 + (hasTop ? 24 : 0), b: 34 + (src.xLabel ? 18 : 0) };
  const height = Math.max(150, n * rowH + pad.t + pad.b);
  const frame = makeFrame({ xmin: vmin, xmax: vmax, ymin: 0, ymax: n, width: 480, height, pad });
  const slot = (frame.bottom - frame.top) / n;
  const base = frame.sx(0);
  const groupH = slot * (dual ? 0.78 : 0.62); const barH = dual ? groupH / 2 : groupH;
  const bars = [];
  categories.forEach((c, i) => {
    const y0 = frame.top + slot * i + (slot - groupH) / 2;
    const series = dual ? [[values[i], valueTex[i], 0], [dual[i], dualTex[i], 1]] : [[values[i], valueTex[i], 0]];
    for (const [v, tex, s] of series) {
      const a = frame.sx(Math.min(v, 0)); const b = frame.sx(Math.max(v, 0));
      const y = r3(y0 + s * barH);
      bars.push({ i, series: s, value: v, tex, x: a, y, w: r3(b - a), h: r3(barH - (dual ? 2 : 0)), label: { x: v >= 0 ? r3(b + 4) : r3(a - 4), y: r3(y + barH / 2 - (dual ? 1 : 0)), anchor: v >= 0 ? 'start' : 'end' } });
    }
  });
  const showValues = vmin === 0 && barH >= 12;
  const cats = categories.map((c, i) => ({ i, text: texts[i], x: r3(frame.left - 8), y: r3(frame.top + slot * (i + 0.5)), shown: true }));
  return { kind: 'barChart', horizontal, frame, n, categories, values, dual, vmin, vmax, ticks: ticks.map(v => ({ value: v, px: frame.sx(v) })), base, bars, showValues, cats, axis: { mode: 'row', rows: 1 }, slot: r3(slot), catW, valW: r3(valW), theory: !!params.experiment, yLabel: src.yLabel || null, xLabel: src.xLabel || null, dualLabel: src.dual?.label || null, label: src.label || null };
}

// ── Pie charts ───────────────────────────────────────────────────────────────
/** Whole-degree angles proportional to `values` that add to exactly 360 (largest remainder; ties to the earlier sector). */
export function pieAngles(values) {
  const total = sum(values);
  const exact = values.map(v => r3((v * 360) / total, 9));
  const floor = exact.map(Math.floor);
  let left = 360 - sum(floor);
  const order = exact.map((e, i) => [e - floor[i], i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  const out = [...floor];
  for (let j = 0; left > 0; j = (j + 1) % order.length, left--) out[order[j][1]] += 1;
  return { exact, angles: out };
}

export function pieChartModel({ categories, values, width = 480, height = 300 }) {
  const { exact, angles } = pieAngles(values);
  const total = sum(values);
  const cx = width / 2; const cy = height / 2; const r = 100;
  const at = (deg, rad) => [r3(cx + rad * Math.sin((deg * Math.PI) / 180)), r3(cy - rad * Math.cos((deg * Math.PI) / 180))];
  let start = 0;
  const sectors = categories.map((c, i) => {
    const a = angles[i]; const from = start; const to = start + a; start = to;
    const mid = from + a / 2;
    const p1 = at(from, r); const p2 = at(to, r);
    const path = a >= 360 ? null : `M${r3(cx)} ${r3(cy)} L${p1[0]} ${p1[1]} A${r} ${r} 0 ${a > 180 ? 1 : 0} 1 ${p2[0]} ${p2[1]} Z`;
    return { i, category: String(c), text: catText(c), value: values[i], angle: a, exact: exact[i], percent: r3((100 * values[i]) / total, 1), from, to, mid, path, rim: at(mid, r + 2), side: Math.sin((mid * Math.PI) / 180) >= -1e-9 ? 'right' : 'left', ideal: r3(cy - (r + 18) * Math.cos((mid * Math.PI) / 180)) };
  });
  // Labels in two columns, pushed apart so no two sit on one spot.
  const gap = 22; const topY = 12; const botY = height - 12;
  for (const side of ['left', 'right']) {
    const list = sectors.filter(s => s.side === side).sort((a, b) => a.ideal - b.ideal);
    let y = -Infinity;
    for (const s of list) { s.ly = Math.max(s.ideal, y + gap, topY); y = s.ly; }
    let limit = botY;
    for (let k = list.length - 1; k >= 0; k--) { list[k].ly = r3(Math.min(list[k].ly, limit)); limit = list[k].ly - gap; }
    for (const s of list) {
      s.lx = r3(side === 'right' ? cx + r + 30 : cx - r - 30);
      s.elbow = [r3(side === 'right' ? cx + r + 14 : cx - r - 14), s.ly];
      s.anchor = side === 'right' ? 'start' : 'end';
    }
  }
  return { kind: 'pieChart', width, height, cx, cy, r, total, sectors, angleSum: sum(angles) };
}

function validatePie(p) {
  const e = [];
  if (!Array.isArray(p.categories) || !Array.isArray(p.values) || !p.categories.length) return ['categories and values must be non-empty lists'];
  if (p.categories.length !== p.values.length) e.push(`there are ${p.categories.length} categories but ${p.values.length} values`);
  if (p.categories.length > 12) e.push('at most 12 sectors can be labelled clearly');
  if (p.values.some(v => !isNum(v) || v <= 0)) e.push('every value must be a positive number (a sector of 0 cannot be drawn)');
  if (p.categories.some(c => !(typeof c === 'string' && c.trim()) && !isNum(c))) e.push('every category needs a name');
  if (new Set(p.categories.map(String)).size !== p.categories.length) e.push('categories must be different from one another');
  return e;
}

// ── Pascal's triangle ────────────────────────────────────────────────────────
/** C(n, k) exactly (whole numbers; exact for n ≤ 60 in a double). */
export function choose(n, k) {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let c = 1;
  for (let j = 0; j < k; j++) c = (c * (n - j)) / (j + 1);
  return Math.round(c);
}

export function pascalModel({ rows = 5, highlight = [], show = 'values', sums = true }) {
  const binom = show === 'binomial';
  const maxDigits = String(choose(rows, Math.floor(rows / 2))).length;
  const cell = binom ? 38 : Math.max(28, maxDigits * 8.5 + 10);
  const rowH = binom ? 42 : 30;
  const triW = (rows + 1) * cell;
  const sumW = sums ? Math.max(70, estWidth(`2^{${rows}}=${2 ** rows}`) + 10) : 0;
  const width = r3(Math.max(320, triW + 32 + sumW));
  const top = sums ? 34 : 16;
  const height = r3(top + (rows + 1) * rowH + 6);
  const cx = 16 + (Math.max(320 - sumW - 32, triW)) / 2;
  const hl = new Set(highlight.map(([n, k]) => `${n},${k}`));
  const entries = [];
  for (let n = 0; n <= rows; n++) for (let k = 0; k <= n; k++) {
    const value = choose(n, k);
    entries.push({ n, k, value, tex: binom ? `\\tbinom{${n}}{${k}}` : String(value), x: r3(cx + (k - n / 2) * cell), y: r3(top + n * rowH + rowH / 2), highlight: hl.has(`${n},${k}`) });
  }
  const rowSums = Array.from({ length: rows + 1 }, (_, n) => ({ n, value: 2 ** n, check: sum(entries.filter(e => e.n === n).map(e => e.value)), x: r3(width - 10), y: r3(top + n * rowH + rowH / 2) }));
  return { kind: 'pascal', width, height, rows, cell: r3(cell), rowH, entries, rowSums, sums, show: binom ? 'binomial' : 'values', highlighted: entries.filter(e => e.highlight), boxW: r3(Math.min(cell - 4, binom ? 34 : maxDigits * 8.5 + 8)), boxH: binom ? 36 : 22 };
}

function validatePascal(p) {
  const e = [];
  if (!isInt(p.rows) || p.rows < 0 || p.rows > 12) e.push('rows must be a whole number from 0 to 12');
  if (p.show !== undefined && !['values', 'binomial'].includes(p.show)) e.push("show must be 'values' or 'binomial'");
  if (p.highlight !== undefined) {
    if (!Array.isArray(p.highlight)) e.push('highlight must be a list of [n, k] pairs');
    else for (const h of p.highlight) {
      if (!Array.isArray(h) || h.length !== 2 || !isInt(h[0]) || !isInt(h[1])) { e.push(`highlight ${JSON.stringify(h)} is not an [n, k] pair of whole numbers`); continue; }
      if (h[1] < 0 || h[1] > h[0] || h[0] < 0 || (isInt(p.rows) && h[0] > p.rows)) e.push(`highlight [${h}] is not in the triangle (need 0 ≤ k ≤ n ≤ rows)`);
    }
  }
  if (p.sums !== undefined && typeof p.sums !== 'boolean') e.push('sums must be true or false');
  return e;
}

// ── The binomial distribution ────────────────────────────────────────────────
/** The k values a highlight names: a list, or { atLeast } / { atMost } / { between: [a, b] }. */
export function highlightSet(highlight, n) {
  if (highlight == null) return [];
  if (Array.isArray(highlight)) return [...new Set(highlight)].filter(k => k >= 0 && k <= n).sort((a, b) => a - b);
  const range = (a, b) => Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);
  if (isInt(highlight.atLeast)) return range(Math.max(0, highlight.atLeast), n);
  if (isInt(highlight.atMost)) return range(0, Math.min(n, highlight.atMost));
  if (Array.isArray(highlight.between)) return range(Math.max(0, highlight.between[0]), Math.min(n, highlight.between[1]));
  return [];
}
/** The event in TeX: P(X = 2), P(X ≥ 3), P(X ≤ 1), P(2 ≤ X ≤ 4), P(X ∈ {1, 3}). */
export function eventTex(highlight, set) {
  if (highlight == null || !set.length) return null;
  if (Array.isArray(highlight)) return set.length === 1 ? `X=${set[0]}` : `X\\in\\{${set.join(',')}\\}`;
  if (isInt(highlight.atLeast)) return `X\\ge ${highlight.atLeast}`;
  if (isInt(highlight.atMost)) return `X\\le ${highlight.atMost}`;
  return `${highlight.between[0]}\\le X\\le ${highlight.between[1]}`;
}

/** The same event in words for a text alternative: X = 2, X ≥ 3, X ≤ 1, 2 ≤ X ≤ 4, X in {1, 3}. */
export function eventText(highlight, set) {
  if (highlight == null || !set.length) return null;
  if (Array.isArray(highlight)) return set.length === 1 ? `X = ${set[0]}` : `X in {${set.join(', ')}}`;
  if (isInt(highlight.atLeast)) return `X ≥ ${highlight.atLeast}`;
  if (isInt(highlight.atMost)) return `X ≤ ${highlight.atMost}`;
  return `${highlight.between[0]} ≤ X ≤ ${highlight.between[1]}`;
}

export function binomialDist(n, p) {
  const q = 1 - p;
  return Array.from({ length: n + 1 }, (_, k) => choose(n, k) * p ** k * q ** (n - k));
}

export function binomialModel({ n = 10, p = 0.5, highlight = null, width = 480, height = 300 }) {
  const probs = binomialDist(n, p);
  const set = highlightSet(highlight, n);
  const inSet = new Set(set);
  const pSet = sum(set.map(k => probs[k]));
  const mean = n * p; const variance = n * p * (1 - p);
  const { vmax } = niceRange(0, Math.max(...probs));
  const yt = niceTicks(0, vmax, 5);
  const frame = makeFrame({ xmin: -0.5, xmax: n + 0.5, ymin: 0, ymax: vmax, width, height, pad: { l: 52, r: 16, t: 46, b: 54 } });
  const slot = (frame.right - frame.left) / (n + 1);
  const labelEvery = n <= 12 ? 1 : n <= 24 ? 2 : 5;
  const showValues = n <= 8;
  const bars = probs.map((pk, k) => ({ k, p: pk, p4: r3(pk, 4), x: r3(frame.sx(k) - slot * 0.35), w: r3(slot * 0.7), y: frame.sy(pk), h: r3(frame.sy(0) - frame.sy(pk)), cx: frame.sx(k), highlight: inSet.has(k), labelShown: k % labelEvery === 0 }));
  const meanX = frame.sx(mean);
  return {
    kind: 'binomial', frame, n, p, q: r3(1 - p, 12), probs, bars, set, event: eventTex(highlight, set), pSet, pSet4: r3(pSet, 4), mean: r3(mean, 6), variance: r3(variance, 6), sd: r3(Math.sqrt(variance), 4),
    mode: probs.indexOf(Math.max(...probs)), showValues, yTicks: yt.map(v => ({ value: v, px: frame.sy(v) })), vmax,
    meanLine: { x: meanX, y1: frame.sy(0), y2: frame.top - 4, labelX: r3(Math.min(frame.right - 46, Math.max(frame.left + 46, meanX))) }
  };
}

function validateBinomial(p, { explorer = false } = {}) {
  const e = [];
  if (!isInt(p.n) || p.n < 1 || p.n > 50) e.push('n must be a whole number from 1 to 50');
  if (!isNum(p.p) || p.p < 0 || p.p > 1) e.push('p must be a number from 0 to 1');
  const h = p.highlight;
  if (h !== undefined && h !== null) {
    const kOk = k => isInt(k) && k >= 0 && (!isInt(p.n) || k <= p.n);
    if (Array.isArray(h)) { if (!h.length || !h.every(kOk)) e.push('highlight must list whole numbers k with 0 ≤ k ≤ n'); }
    else if (typeof h === 'object') {
      const keys = Object.keys(h);
      if (keys.length !== 1 || !['atLeast', 'atMost', 'between'].includes(keys[0])) e.push('highlight must be a list of k, or one of { atLeast: k }, { atMost: k }, { between: [a, b] }');
      else if (keys[0] === 'between') { if (!Array.isArray(h.between) || h.between.length !== 2 || !h.between.every(kOk) || h.between[0] > h.between[1]) e.push('between must be [a, b] with 0 ≤ a ≤ b ≤ n'); }
      else if (!kOk(h[keys[0]])) e.push(`${keys[0]} must be a whole number from 0 to n`);
    } else e.push('highlight must be a list or an object');
  }
  if (explorer && p.nMax !== undefined && (!isInt(p.nMax) || p.nMax < p.n || p.nMax > 50)) e.push('nMax must be a whole number from n to 50');
  return e;
}

// ── Probability experiments and the seeded simulator ─────────────────────────
/** The outcomes of an experiment with their theoretical probabilities (exact fractions when the weights are whole). */
export function experimentOutcomes({ experiment, sectors, bag }) {
  if (experiment === 'coin') return [{ id: 'H', key: 'heads', weight: 1 }, { id: 'T', key: 'tails', weight: 1 }].map(o => ({ ...o, frac: fraction(1, 2), p: 0.5 }));
  if (experiment === 'die') return Array.from({ length: 6 }, (_, i) => ({ id: i + 1, label: String(i + 1), weight: 1, frac: fraction(1, 6), p: 1 / 6 }));
  if (experiment === 'twoDiceSum') return Array.from({ length: 11 }, (_, i) => { const s = i + 2; const w = 6 - Math.abs(s - 7); return { id: s, label: String(s), weight: w, frac: { n: w, d: 36 }, p: w / 36 }; }); // over 36 (not reduced), so the 36 equally likely pairs show
  const list = experiment === 'spinner' ? sectors : bag;
  const total = sum(list.map(o => o.weight));
  const whole = list.every(o => isInt(o.weight));
  return list.map(o => ({ id: String(o.label), label: String(o.label), weight: o.weight, frac: whole ? fraction(o.weight, total) : null, p: o.weight / total }));
}
export const probTex = o => (o.frac ? ftex(o.frac) : fmt(o.p));
export const probText = o => (o.frac ? ftext(o.frac) : fmt(o.p));
const sameOutcome = (a, b) => String(a).toLowerCase() === String(b).toLowerCase() || (String(a) === 'H' && /^heads?$/i.test(b)) || (String(a) === 'T' && /^tails?$/i.test(b));

/** The tracked event: which outcomes it holds and its theoretical probability. */
export function eventOf(outcomes, event) {
  if (!Array.isArray(event) || !event.length) return null;
  const idx = outcomes.map((o, i) => (event.some(e => sameOutcome(o.id, e)) ? i : -1)).filter(i => i >= 0);
  const exact = idx.every(i => outcomes[i].frac);
  const frac = exact ? idx.reduce((s, i) => fadd(s, outcomes[i].frac), fraction(0, 1)) : null;
  return { idx, frac, p: sum(idx.map(i => outcomes[i].p)) };
}

/** One step of mulberry32: [next state, a uniform number in [0, 1)]. Pure. */
export function mulberry32(state) {
  const a = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return [a >>> 0, ((t ^ (t >>> 14)) >>> 0) / 4294967296];
}
export const SIM_MAX_TRIALS = 100000;
/** A fresh simulation: no trials yet, the generator at the seed. */
export function simStart(params) {
  const outcomes = experimentOutcomes(params);
  return { state: (params.seed ?? 1) >>> 0, trials: 0, counts: outcomes.map(() => 0) };
}
/** `sim` after `k` more trials (capped at SIM_MAX_TRIALS). Pure: the same sim and k give the same result. */
export function simAdd(params, sim, k) {
  const outcomes = experimentOutcomes(params);
  const counts = [...sim.counts];
  let state = sim.state; let u;
  const total = sum(outcomes.map(o => o.weight));
  const steps = Math.max(0, Math.min(k, SIM_MAX_TRIALS - sim.trials));
  for (let t = 0; t < steps; t++) {
    if (params.experiment === 'twoDiceSum') {
      [state, u] = mulberry32(state); const a = Math.floor(u * 6);
      [state, u] = mulberry32(state); const b = Math.floor(u * 6);
      counts[a + b] += 1; // sum a+b+2 is outcome index a+b
    } else if (params.experiment === 'die') {
      [state, u] = mulberry32(state); counts[Math.floor(u * 6)] += 1;
    } else {
      [state, u] = mulberry32(state);
      let x = u * total; let i = 0;
      while (i < outcomes.length - 1 && x >= outcomes[i].weight) { x -= outcomes[i].weight; i++; }
      counts[i] += 1;
    }
  }
  return { state, trials: sim.trials + steps, counts };
}
/** The sequence of the first `k` outcome ids from a seed (for tests and for the record). */
export function simSequence(params, k) {
  const outcomes = experimentOutcomes(params);
  const out = []; let sim = simStart(params);
  for (let t = 0; t < k; t++) { const next = simAdd(params, sim, 1); out.push(outcomes[next.counts.findIndex((c, i) => c !== sim.counts[i])].id); sim = next; }
  return out;
}

/** The chart of a simulation: relative-frequency bars beside the theoretical probability of every outcome. */
export function probabilitySimModel(params, sim = null) {
  const outcomes = experimentOutcomes(params);
  const s = sim || simStart(params);
  const freq = s.counts.map(c => (s.trials ? c / s.trials : 0));
  const ev = eventOf(outcomes, params.event);
  const inEvent = new Set(ev ? ev.idx : []);
  const n = outcomes.length;
  const top = Math.min(1, Math.max(...outcomes.map(o => o.p), ...freq));
  const { vmax } = niceRange(0, top);
  const ymax = Math.min(1, vmax);
  const texts = outcomes.map(o => (o.label !== undefined ? catText(o.label) : o.key));
  const left = 52; const width = 480; const height = 300;
  const slot0 = (width - left - 14) / n;
  const axis = categoryAxis(texts.map(t => (t === 'heads' || t === 'tails' ? 'Heads' : t)), slot0);
  const frame = makeFrame({ xmin: 0, xmax: n, ymin: 0, ymax, width, height, pad: { l: left, r: 14, t: 16, b: 22 + axis.rows * 18 + 36 } });
  const slot = (frame.right - frame.left) / n;
  const bars = outcomes.map((o, i) => {
    const cx = frame.left + slot * (i + 0.5);
    return {
      i, id: o.id, key: o.key || null, text: texts[i], count: s.counts[i], freq: freq[i], freq3: r3(freq[i], 3), p: o.p, tex: probTex(o), ptext: probText(o), inEvent: inEvent.has(i),
      x: r3(cx - slot * 0.28), w: r3(slot * 0.56), y: frame.sy(freq[i]), h: r3(frame.sy(0) - frame.sy(freq[i])),
      theory: { x1: r3(cx - slot * 0.42), x2: r3(cx + slot * 0.42), y: frame.sy(o.p) }, cx: r3(cx),
      catY: r3(frame.bottom + 13 + axis.row[i] * 18), probY: r3(frame.bottom + 13 + axis.rows * 18 + 14), shown: axis.shown[i]
    };
  });
  const event = ev ? { ...ev, tex: ev.frac ? ftex(ev.frac) : fmt(ev.p), text: ev.frac ? ftext(ev.frac) : fmt(ev.p), count: sum(ev.idx.map(i => s.counts[i])), freq: s.trials ? sum(ev.idx.map(i => s.counts[i])) / s.trials : 0 } : null;
  if (event) event.freq3 = r3(event.freq, 3);
  // The outcome furthest from its theoretical probability (for the readout when no event is tracked).
  const gaps = bars.map(b => Math.abs(b.freq - b.p));
  const worst = s.trials ? gaps.indexOf(Math.max(...gaps)) : null;
  return { kind: 'probabilitySim', frame, outcomes, bars, trials: s.trials, event, ymax, yTicks: niceTicks(0, ymax, 5).map(v => ({ value: v, px: frame.sy(v) })), axis, worst, slot: r3(slot) };
}

/** A probabilitySim spec as a static bar chart of its theoretical probabilities (its counterpart in a question). */
function theoryAsBars(params) {
  const outcomes = experimentOutcomes(params);
  return { categories: outcomes.map(o => o.label ?? o.id), values: outcomes.map(o => o.p), valueTex: outcomes.map(probTex), keys: outcomes.map(o => o.key || null), yLabel: 'P' };
}

function validateSim(p) {
  const e = [];
  if (!EXPERIMENTS.includes(p.experiment)) return [`experiment must be one of ${EXPERIMENTS.join(', ')}`];
  if (p.seed !== undefined && (!isInt(p.seed) || p.seed < 0 || p.seed > 4294967295)) e.push('seed must be a whole number from 0 to 4294967295');
  if (p.experiment === 'spinner' || p.experiment === 'bag') {
    const field = p.experiment === 'spinner' ? 'sectors' : 'bag';
    const list = p[field];
    if (!Array.isArray(list) || list.length < 2) e.push(`a ${p.experiment} needs ${field}: a list of at least 2 { label, weight }`);
    else {
      if (list.length > 12) e.push(`at most 12 ${field}`);
      for (const o of list) {
        if (!o || typeof o.label !== 'string' || !o.label.trim()) e.push(`every one of ${field} needs a label`);
        else if (!isNum(o.weight) || o.weight <= 0) e.push(`${field} "${o.label}" has weight ${o.weight}; every weight must be a positive number`);
      }
      const labels = list.map(o => String(o?.label).toLowerCase());
      if (new Set(labels).size !== labels.length) e.push(`the labels of ${field} must be different from one another`);
    }
  } else if (p.sectors !== undefined || p.bag !== undefined) e.push(`sectors and bag belong only to a spinner or a bag, not a ${p.experiment}`);
  if (p.event !== undefined) {
    if (!Array.isArray(p.event) || !p.event.length) e.push('event must be a non-empty list of outcomes');
    else if (!e.length) {
      const outcomes = experimentOutcomes(p);
      const bad = p.event.filter(x => !outcomes.some(o => sameOutcome(o.id, x)));
      if (bad.length) e.push(`event names outcomes this experiment does not have: ${bad.join(', ')} (it has ${outcomes.map(o => o.id).join(', ')})`);
      if (new Set(p.event.map(x => String(x).toLowerCase())).size !== p.event.length) e.push('event lists an outcome twice');
    }
  }
  return e;
}

// ── Data: summary measures and the dot-plot explorer ─────────────────────────
export const MEASURES = Object.freeze(['mean', 'median', 'mode', 'range', 'iqr', 'sd']);
/** Every summary measure of a data set. sd is the POPULATION standard deviation (divide by n). */
export function dataStats(data) {
  const n = data.length;
  const mean = sum(data) / n;
  const f = fiveNumber(data);
  const counts = new Map();
  for (const v of data) counts.set(r3(v, 9), (counts.get(r3(v, 9)) || 0) + 1);
  const top = Math.max(...counts.values());
  const modes = top > 1 ? [...counts.entries()].filter(([, c]) => c === top).map(([v]) => v).sort((a, b) => a - b) : [];
  const sd = Math.sqrt(sum(data.map(v => (v - mean) ** 2)) / n);
  return { n, mean: r3(mean, 4), median: r3(f.median, 4), modes, modeCount: top, range: r3(f.range, 4), q1: r3(f.q1, 4), q3: r3(f.q3, 4), iqr: r3(f.iqr, 4), sd: r3(sd, 4), min: f.min, max: f.max };
}
/** The measures that differ between two dataStats results. */
export function changedMeasures(a, b) {
  const same = { mean: a.mean === b.mean, median: a.median === b.median, mode: a.modes.join(',') === b.modes.join(','), range: a.range === b.range, iqr: a.iqr === b.iqr, sd: a.sd === b.sd };
  return MEASURES.filter(k => !same[k]);
}
const decimalsOf = v => { const s = String(v); const i = s.indexOf('.'); return i < 0 ? 0 : s.length - i - 1; };
/** Slider bounds and step for a data set: room for an outlier on either side, never below 0 for non-negative data. */
export function dataBounds(data, { min, max, step } = {}) {
  const lo0 = Math.min(...data); const hi0 = Math.max(...data);
  const span = hi0 - lo0 || Math.max(1, Math.abs(hi0));
  const st = step ?? (data.every(isInt) ? 1 : 10 ** -Math.min(2, Math.max(1, ...data.map(decimalsOf))));
  const nice = niceStep(span, 4);
  let lo = min ?? r3(Math.floor((lo0 - span * 0.5) / nice) * nice, 6);
  if (min === undefined && lo0 >= 0) lo = Math.max(0, lo);
  const hi = max ?? r3(Math.ceil((hi0 + span) / nice) * nice, 6);
  return { lo, hi, step: st };
}

export function dataExplorerModel({ data, show = MEASURES, editable = [], min, max, step, stackCap = null, width = 480 }) {
  const b = dataBounds(data, { min, max, step });
  const st = dataStats(data);
  const cap = Math.max(4, stackCap ?? st.modeCount);
  const dotR = 5; const dotGap = 12;
  const labelRows = 3; const rowH = 20;
  const lanes = ['range', 'iqr', 'sd'].filter(k => show.includes(k));
  const top = 8 + labelRows * rowH;
  const dotsH = cap * dotGap + 10;
  const axisY = top + dotsH;
  const height = r3(axisY + 30 + lanes.length * 32 + 6);
  const frame = makeFrame({ xmin: b.lo, xmax: b.hi, ymin: 0, ymax: 1, width, height, pad: { l: 22, r: 22, t: top, b: height - axisY } });
  const editSet = new Set(editable);
  const seen = new Map();
  const dots = data.map((v, i) => {
    const key = r3(v, 9); const level = seen.get(key) || 0; seen.set(key, level + 1);
    return { i, value: v, editable: editSet.has(i), cx: frame.sx(Math.min(b.hi, Math.max(b.lo, v))), cy: r3(axisY - dotR - 3 - Math.min(level, cap - 1) * dotGap), level };
  });
  const clampX = x => Math.min(frame.right, Math.max(frame.left, x));
  const marks = [];
  if (show.includes('mean')) marks.push({ key: 'mean', x: frame.sx(st.mean), value: st.mean, tex: `\\bar{x}=${st.mean}` });
  if (show.includes('median')) marks.push({ key: 'median', x: frame.sx(st.median), value: st.median, tex: `${st.median}` });
  if (show.includes('mode') && st.modes.length) {
    // A small marker above each modal stack; the label's leader goes to the first.
    const tri = st.modes.map(v => { const x = frame.sx(v); return { x, y: r3(axisY - 2 * dotR - 3 - (st.modeCount - 1) * dotGap - 4) }; });
    marks.push({ key: 'mode', x: tri[0].x, value: st.modes, tex: st.modes.join(',\\ '), tri, ay: r3(tri[0].y - 8) });
  }
  for (const m of marks) if (m.ay === undefined) m.ay = frame.top;
  // Point labels in up to three rows above the plot, each joined to its mark by a
  // leader. A label goes in the lowest row where it overlaps no other label, its
  // leader crosses no label below it, and it covers no leader from a label above.
  const placed = [];
  const hits = (a, b) => a[0] < b[1] && b[0] < a[1];
  // Each label hangs beside the top of its own vertical leader (to its right, or to
  // its left near the right edge). Marks are placed right to left, lowest row first.
  for (const m of [...marks].sort((a, b) => b.x - a.x)) {
    m.w = m.key === 'mean' ? estWidth(m.tex) + 4 : estWidth(m.tex) + 64;
    const x = clampX(m.x);
    const options = [];
    // Rightward first (towards the marks already placed); leftward only near the right edge.
    for (const anchor of ['start', 'end']) for (let r = labelRows - 1; r >= 0; r--) {
      const box = anchor === 'start' ? [x, x + 4 + m.w] : [x - 4 - m.w, x];
      if (box[0] < frame.left - 20 || box[1] > frame.right + 20) continue;
      const lead = [x, x]; // a leader may run along a box's edge (two marks at one value share it), never through it
      const clash = placed.filter(p => (p.row === r && hits(p.box, box)) || (p.row > r && hits(p.box, lead)) || (p.row < r && hits(p.lead, box))).length;
      options.push({ r, anchor, box, lead, clash });
    }
    const best = options.find(o => !o.clash) || options.sort((a, b) => a.clash - b.clash || b.r - a.r)[0];
    m.row = best.r; m.anchor = best.anchor; m.lx = r3(best.anchor === 'start' ? x + 4 : x - 4); m.ly = r3(8 + best.r * rowH + rowH / 2);
    m.boxX = [r3(best.box[0]), r3(best.box[1])];
    placed.push({ row: best.r, box: best.box, lead: best.lead });
  }
  const laneOf = (key, from, to, value, tex) => ({ key, from: r3(clampX(frame.sx(from))), to: r3(clampX(frame.sx(to))), value, tex, clippedLeft: frame.sx(from) < frame.left, clippedRight: frame.sx(to) > frame.right });
  const laneDefs = { range: () => laneOf('range', st.min, st.max, st.range, `${st.range}`), iqr: () => laneOf('iqr', st.q1, st.q3, st.iqr, `${st.iqr}`), sd: () => laneOf('sd', st.mean - st.sd, st.mean + st.sd, st.sd, `\\sigma=${st.sd}`) };
  const laneList = lanes.map((k, j) => ({ ...laneDefs[k](), y: r3(axisY + 30 + j * 32 + 20), labelY: r3(axisY + 30 + j * 32 + 7) }));
  laneList.forEach(l => { l.mid = r3((l.from + l.to) / 2); });
  return { kind: 'dataExplorer', frame, width, height, axisY, bounds: b, stats: st, dots, marks, lanes: laneList, ticks: niceTicks(b.lo, b.hi, 8).map(v => ({ value: v, px: frame.sx(v) })), show, editable, dotR };
}

function validateData(p) {
  const e = [];
  if (!Array.isArray(p.data) || p.data.length < 2) return ['data must be a list of at least 2 numbers'];
  if (p.data.length > 60) e.push('at most 60 values fit a dot plot');
  if (p.data.some(v => !isNum(v))) e.push('every data value must be a finite number');
  if (p.editable !== undefined) {
    if (!Array.isArray(p.editable)) e.push('editable must be a list of positions in data');
    else {
      if (p.editable.some(i => !isInt(i) || i < 0 || i >= p.data.length)) e.push(`editable positions must be whole numbers from 0 to ${p.data.length - 1}`);
      if (new Set(p.editable).size !== p.editable.length) e.push('editable lists a position twice');
      if (p.editable.length > 4) e.push('at most 4 values can be movable (one slider each)');
    }
  }
  if (p.show !== undefined && (!Array.isArray(p.show) || !p.show.length || p.show.some(k => !MEASURES.includes(k)))) e.push(`show must list measures from ${MEASURES.join(', ')}`);
  for (const k of ['min', 'max', 'step']) if (p[k] !== undefined && !isNum(p[k])) e.push(`${k} must be a number`);
  if (isNum(p.min) && isNum(p.max) && p.min >= p.max) e.push('min must be less than max');
  if (isNum(p.step) && p.step <= 0) e.push('step must be positive');
  if (!e.length && (isNum(p.min) || isNum(p.max))) {
    const b = dataBounds(p.data, p);
    if (p.data.some(v => v < b.lo || v > b.hi)) e.push(`every data value must lie between min (${b.lo}) and max (${b.hi})`);
  }
  return e;
}

// ── The pack ─────────────────────────────────────────────────────────────────
export const STATIC = Object.freeze({
  barChart: { validate: p => (p.experiment !== undefined ? validateSim(p) : validateBars(p)), model: barChartModel },
  pieChart: { validate: validatePie, model: pieChartModel },
  pascal: { validate: validatePascal, model: pascalModel },
  binomial: { validate: p => validateBinomial(p), model: binomialModel }
});
export const INTERACTIVE = Object.freeze({
  binomialExplorer: { validate: p => validateBinomial(p, { explorer: true }), model: binomialModel },
  probabilitySim: { validate: validateSim, model: p => probabilitySimModel(p) },
  dataExplorer: { validate: validateData, model: dataExplorerModel }
});
// interactive kind -> static kind a question (or a print) shows instead
export const COUNTERPART = Object.freeze({ binomialExplorer: 'binomial', probabilitySim: 'barChart', dataExplorer: 'boxPlot' });

// ── The pack's words, English (en-AU) and Hindi ──────────────────────────────
// Mathematics stays KaTeX in every language. {name} slots are filled by kitText.
export const STATS_TEXT = Object.freeze({
  en: Object.freeze({
    barTitle: 'A bar chart',
    barDesc: 'A bar chart of {n} categories, with the value axis starting at 0: {list}.',
    barDescDual: 'A bar chart of {n} categories, two bars each ({a}, then {b}), with the value axis starting at 0: {list}.',
    seriesFirst: 'First',
    seriesSecond: 'Second',
    theoryTitle: 'The theoretical probabilities',
    theoryDesc: 'The theoretical probability of each outcome: {list}. They add to 1.',
    pieTitle: 'A pie chart',
    pieDesc: 'A pie chart of {n} categories, total {total}. Each sector angle is its share of 360°: {list}. The angles add to {sum}°.',
    pascalTitle: "Pascal's triangle",
    pascalDesc: "Pascal's triangle, rows 0 to {rows}. Each entry is the sum of the two above it; entry k of row n is C(n, k). Row {rows}: {last}.",
    pascalDescSums: 'The entries of row n add to 2 to the power n: {sums}.',
    pascalDescHl: 'Highlighted: {list}.',
    rowSum: 'Row sum',
    binomialTitle: 'A binomial distribution',
    binomialDesc: 'The binomial distribution with n = {n} and p = {p}: P(X = k) for k = 0 to {n} is {list} (to 4 decimal places). The mean is E(X) = np = {mean} and the variance is Var(X) = np(1 − p) = {var}.',
    binomialDescSet: 'The highlighted bars, {event}, have total probability {pset}.',
    heads: 'Heads',
    tails: 'Tails',
    simTitle: 'Run the experiment many times',
    simTitleCoin: 'Toss a coin many times',
    simTitleDie: 'Roll a die many times',
    simTitleTwoDice: 'Roll two dice and add them',
    simTitleSpinner: 'Spin the spinner many times',
    simTitleBag: 'Draw from the bag many times (with replacement)',
    simFigure: 'Relative frequency and theoretical probability',
    simDesc: 'After {trials} trials, the relative frequency (and theoretical probability) of each outcome: {list}.',
    simDescNone: 'No trials yet. The theoretical probability of each outcome: {list}.',
    add: 'Add {k}',
    addName: 'Add {k} trials',
    addName1: 'Add 1 trial',
    reset: 'Reset',
    trialButtons: 'Add trials',
    legendFreq: 'relative frequency',
    legendTheory: 'theoretical probability',
    legendEvent: 'outcomes in the event',
    simNone: 'No trials yet. Each bar will show how often an outcome comes up, beside the dashed line at its theoretical probability.',
    simEvent: 'After {trials} trials the event happened {count} times: relative frequency ${freq}$ against theoretical probability ${theory}$.',
    simWorst: 'After {trials} trials, the outcome furthest from its theoretical probability is {outcome}: relative frequency ${freq}$ against ${theory}$.',
    simMore: 'With more trials the relative frequencies settle near the theoretical probabilities.',
    simCap: 'The simulation stops at {max} trials.',
    explorerTitle: 'Change n and p',
    nLabel: 'n (number of trials)',
    pLabel: 'p (probability of success)',
    kLabel: 'k',
    eventButtons: 'Which probability',
    eqK: 'P(X = k)',
    leK: 'P(X ≤ k)',
    geK: 'P(X ≥ k)',
    explorerReadout: '$X\\sim B({n},\\,{p})$: ${event}$. $E(X)=np={mean}$, $\\operatorname{Var}(X)=np(1-p)={var}$.',
    dataTitle: 'Move a value and watch the measures',
    dataFigure: 'A dot plot with its summary measures',
    dataDesc: 'A dot plot of {n} values: {values}. {measures}',
    valueLabel: 'Value {k}',
    measureMean: 'mean {v}',
    measureMedian: 'median {v}',
    measureMode: 'mode {v}',
    measureNoMode: 'no mode (every value appears once)',
    measureRange: 'range {v}',
    measureIqr: 'interquartile range {v} (Q1 {q1}, Q3 {q3})',
    measureSd: 'population standard deviation {v}',
    median: 'median',
    mode: 'mode',
    range: 'range',
    iqr: 'IQR',
    sdNote: 'σ is the population standard deviation (divide by n).',
    dataStart: 'Move an open dot. The readout names the measures that change from the starting data.',
    dataMoved: 'Compared with the starting data: {changed}.',
    dataSame: 'Unchanged: {same}.',
    dataNoChange: 'Every measure is back to its starting value.',
    nameMean: 'mean',
    nameMedian: 'median',
    nameMode: 'mode',
    nameRange: 'range',
    nameIqr: 'interquartile range',
    nameSd: 'standard deviation',
    changedItem: '{name} {from} → {to}',
    none: 'none',
    noneMode: 'none'
  }),
  hi: Object.freeze({
    barTitle: 'एक दंड आलेख',
    barDesc: '{n} श्रेणियों का दंड आलेख, मान-अक्ष 0 से शुरू: {list}।',
    barDescDual: '{n} श्रेणियों का दंड आलेख, हर श्रेणी के दो दंड (पहले {a}, फिर {b}), मान-अक्ष 0 से शुरू: {list}।',
    seriesFirst: 'पहला',
    seriesSecond: 'दूसरा',
    theoryTitle: 'सैद्धांतिक प्रायिकताएँ',
    theoryDesc: 'हर परिणाम की सैद्धांतिक प्रायिकता: {list}। इनका योग 1 है।',
    pieTitle: 'एक पाई चार्ट',
    pieDesc: '{n} श्रेणियों का पाई चार्ट, कुल {total}। हर त्रिज्यखंड का कोण 360° में उसका हिस्सा है: {list}। कोणों का योग {sum}° है।',
    pascalTitle: 'पास्कल त्रिभुज',
    pascalDesc: 'पास्कल त्रिभुज, पंक्ति 0 से {rows} तक। हर संख्या अपने ऊपर की दो संख्याओं का योग है; पंक्ति n की k-वीं संख्या C(n, k) है। पंक्ति {rows}: {last}।',
    pascalDescSums: 'पंक्ति n की संख्याओं का योग 2 की घात n है: {sums}।',
    pascalDescHl: 'चिह्नित: {list}।',
    rowSum: 'पंक्ति योग',
    binomialTitle: 'एक द्विपद बंटन',
    binomialDesc: 'n = {n} और p = {p} वाला द्विपद बंटन: k = 0 से {n} तक P(X = k) क्रमशः {list} है (4 दशमलव स्थान तक)। माध्य E(X) = np = {mean} और प्रसरण Var(X) = np(1 − p) = {var} है।',
    binomialDescSet: 'चिह्नित दंड, {event}, की कुल प्रायिकता {pset} है।',
    heads: 'चित',
    tails: 'पट',
    simTitle: 'प्रयोग को कई बार दोहराइए',
    simTitleCoin: 'सिक्के को कई बार उछालिए',
    simTitleDie: 'पासे को कई बार फेंकिए',
    simTitleTwoDice: 'दो पासे फेंककर उनका योग लीजिए',
    simTitleSpinner: 'चक्री को कई बार घुमाइए',
    simTitleBag: 'थैले से कई बार निकालिए (वापस रखकर)',
    simFigure: 'सापेक्ष बारंबारता और सैद्धांतिक प्रायिकता',
    simDesc: '{trials} प्रयोगों के बाद हर परिणाम की सापेक्ष बारंबारता (और सैद्धांतिक प्रायिकता): {list}।',
    simDescNone: 'अभी कोई प्रयोग नहीं हुआ। हर परिणाम की सैद्धांतिक प्रायिकता: {list}।',
    add: '{k} जोड़ें',
    addName: '{k} प्रयोग जोड़ें',
    addName1: '1 प्रयोग जोड़ें',
    reset: 'फिर से शुरू करें',
    trialButtons: 'प्रयोग जोड़ें',
    legendFreq: 'सापेक्ष बारंबारता',
    legendTheory: 'सैद्धांतिक प्रायिकता',
    legendEvent: 'घटना के परिणाम',
    simNone: 'अभी कोई प्रयोग नहीं हुआ। हर दंड दिखाएगा कि कोई परिणाम कितनी बार आया, और उसके पास की धराशायी रेखा उसकी सैद्धांतिक प्रायिकता है।',
    simEvent: '{trials} प्रयोगों में घटना {count} बार हुई: सापेक्ष बारंबारता ${freq}$, सैद्धांतिक प्रायिकता ${theory}$।',
    simWorst: '{trials} प्रयोगों के बाद अपनी सैद्धांतिक प्रायिकता से सबसे दूर परिणाम {outcome} है: सापेक्ष बारंबारता ${freq}$, सैद्धांतिक ${theory}$।',
    simMore: 'प्रयोग बढ़ने पर सापेक्ष बारंबारताएँ सैद्धांतिक प्रायिकताओं के पास आ जाती हैं।',
    simCap: 'अनुकरण {max} प्रयोगों पर रुक जाता है।',
    explorerTitle: 'n और p बदलिए',
    nLabel: 'n (प्रयोगों की संख्या)',
    pLabel: 'p (सफलता की प्रायिकता)',
    kLabel: 'k',
    eventButtons: 'कौन-सी प्रायिकता',
    eqK: 'P(X = k)',
    leK: 'P(X ≤ k)',
    geK: 'P(X ≥ k)',
    explorerReadout: '$X\\sim B({n},\\,{p})$: ${event}$। $E(X)=np={mean}$, $\\operatorname{Var}(X)=np(1-p)={var}$।',
    dataTitle: 'एक मान खिसकाइए और मापों को देखिए',
    dataFigure: 'सारांश मापों के साथ एक बिंदु आलेख',
    dataDesc: '{n} मानों का बिंदु आलेख: {values}। {measures}',
    valueLabel: 'मान {k}',
    measureMean: 'माध्य {v}',
    measureMedian: 'माध्यिका {v}',
    measureMode: 'बहुलक {v}',
    measureNoMode: 'कोई बहुलक नहीं (हर मान एक बार आता है)',
    measureRange: 'परिसर {v}',
    measureIqr: 'अंतर-चतुर्थक परिसर {v} (Q1 {q1}, Q3 {q3})',
    measureSd: 'समष्टि मानक विचलन {v}',
    median: 'माध्यिका',
    mode: 'बहुलक',
    range: 'परिसर',
    iqr: 'IQR',
    sdNote: 'σ समष्टि मानक विचलन है (n से भाग)।',
    dataStart: 'किसी खुले बिंदु को खिसकाइए। नीचे लिखा आएगा कि शुरुआती आँकड़ों से कौन-से माप बदले।',
    dataMoved: 'शुरुआती आँकड़ों की तुलना में: {changed}।',
    dataSame: 'नहीं बदले: {same}।',
    dataNoChange: 'हर माप अपने शुरुआती मान पर लौट आया है।',
    nameMean: 'माध्य',
    nameMedian: 'माध्यिका',
    nameMode: 'बहुलक',
    nameRange: 'परिसर',
    nameIqr: 'अंतर-चतुर्थक परिसर',
    nameSd: 'मानक विचलन',
    changedItem: '{name} {from} → {to}',
    none: 'कोई नहीं',
    noneMode: 'कोई नहीं'
  })
});
