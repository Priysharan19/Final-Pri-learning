// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · does a figure's DRAWING give the answer? (the author question bank)
//
// A structural test on the TikZ source and the accepted answer of each part, beside the text test in qbank-diagrams.mjs (which compares
// printed labels and ticks). A figure is held (never packed) when any of these holds, unless the question itself states the thing:
//   (a) a coordinate, plotted point, vector endpoint or marked intersection equals the accepted answer point or vector (either component order);
//   (b) a plotted function or a line (`\addplot {f}`, `plot (\x,{f})`, `(p)--(q)`) is the accepted answer function, line, tangent or normal,
//       compared by sampling, unless the question only asks for the equation of the curve it shows;
//   (c) a label or tick, read as numbers, equals the accepted answer, its reciprocal or its negative (1/440 for 440), or a set answer's values
//       all appear among the numbers of the labels (the boundaries of 0 <= t <= 1, 1 <= t <= 3);
//   (d) a worked step's RESULT (a point, or a value that is not trivial) is a coordinate, label or tick of the figure.
// FAIL CLOSED: where the test needs the geometry and a coordinate or plotted expression cannot be read, the figure is held.
// Deterministic. No clock, no network, no model, no randomness.
// ─────────────────────────────────────────────────────────────────────────────

// ── a small safe evaluator for the numbers and functions TikZ and the answer keys write ──────────────────────
const FN = {
  sin: (x, o) => Math.sin(o.deg ? x * Math.PI / 180 : x), cos: (x, o) => Math.cos(o.deg ? x * Math.PI / 180 : x), tan: (x, o) => Math.tan(o.deg ? x * Math.PI / 180 : x),
  asin: (x, o) => (o.deg ? Math.asin(x) * 180 / Math.PI : Math.asin(x)), acos: (x, o) => (o.deg ? Math.acos(x) * 180 / Math.PI : Math.acos(x)), atan: (x, o) => (o.deg ? Math.atan(x) * 180 / Math.PI : Math.atan(x)),
  exp: x => Math.exp(x), ln: x => Math.log(x), log: x => Math.log10(x), sqrt: x => Math.sqrt(x), abs: x => Math.abs(x), deg: x => x * 180 / Math.PI, rad: x => x * Math.PI / 180, floor: Math.floor, ceil: Math.ceil
};
/** TeX written inside an expression, as plain arithmetic. */
export function texToPlain(s) {
  let t = String(s ?? '');
  for (let i = 0; i < 6; i++) t = t.replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '(($1)/($2))').replace(/\\[dt]?frac\s*(\d)\s*(\d)/g, '(($1)/($2))').replace(/\\sqrt\s*\{([^{}]*)\}/g, 'sqrt($1)').replace(/\^\s*\{([^{}]*)\}/g, '^($1)');
  return t.replace(/\\left|\\right|\\displaystyle|\\,|\\;|\\!|\\quad/g, '').replace(/\\cdot|\\times/g, '*').replace(/\\pi|π/g, 'pi').replace(/\\ln\b/g, 'ln').replace(/\\(sin|cos|tan|exp|log)\b/g, '$1')
    .replace(/\\circ|°/g, '').replace(/[−–]/g, '-').replace(/×/g, '*').replace(/÷/g, '/').replace(/√\s*\(/g, 'sqrt(').replace(/\\(?:mathrm|text)\s*\{([^{}]*)\}/g, '$1').replace(/[{}$]/g, c => (c === '{' ? '(' : c === '}' ? ')' : '')).replace(/\s+/g, ' ').trim();
}
/** Evaluate `src` (TikZ or answer-key arithmetic) with variables `vars`; null when it cannot be read. `deg`: sin(30) is a half (TikZ), else radians. */
export function evalMath(src, vars = {}, { deg = false } = {}) {
  const s = texToPlain(src).replace(/\\([a-zA-Z])\b/g, '$1');
  const tok = []; const re = /\s*(\d+(?:\.\d*)?|\.\d+|[A-Za-z_][A-Za-z_0-9]*|\*\*|[-+*/^(),!])/gy; let m, last = 0;
  while ((m = re.exec(s)) && m.index === last) { tok.push(m[1]); last = re.lastIndex; }
  if (last !== s.replace(/\s+$/, '').length && !(s.trim() === '' && tok.length === 0)) return null;
  let i = 0;
  const o = { deg };
  const peek = () => tok[i], next = () => tok[i++];
  const bad = () => { throw new Error('unreadable'); };
  const primary = () => {
    const t = next();
    if (t === undefined) bad();
    if (t === '(') { const v = expr(); if (next() !== ')') bad(); return v; }
    if (t === '-') return -power();
    if (t === '+') return power();
    if (/^[\d.]/.test(t)) return Number(t);
    if (t === 'pi') return Math.PI;
    if (t === 'e' && peek() !== '(') return Math.E;
    if (FN[t] && peek() === '(') { next(); const a = expr(); if (next() !== ')') bad(); return FN[t](a, o); }
    if (Object.hasOwn(vars, t)) return vars[t];
    return bad();
  };
  const postfix = () => { let v = primary(); while (peek() === '!') { next(); let f = 1; for (let k = 2; k <= Math.round(v); k++) f *= k; v = f; } return v; };
  const power = () => { const b = postfix(); if (peek() === '^' || peek() === '**') { next(); const e = power(); return b ** e; } return b; };
  const term = () => {
    let v = power();
    for (;;) {
      const t = peek();
      if (t === '*') { next(); v *= power(); } else if (t === '/') { next(); v /= power(); }
      else if (t !== undefined && t !== ')' && t !== ',' && t !== '+' && t !== '-' && t !== '^' && t !== '**') v *= power();   // implicit product: 2x, 3(x+1)
      else break;
    }
    return v;
  };
  const expr = () => { let v = term(); for (;;) { const t = peek(); if (t === '+') { next(); v += term(); } else if (t === '-') { next(); v -= term(); } else break; } return v; };
  try { const v = expr(); return i === tok.length && Number.isFinite(v) ? v : null; } catch { return null; }
}

const near = (a, b, rel = 2e-3) => Math.abs(a - b) <= Math.max(1e-6, Math.abs(b) * rel);
const trivial = v => [0, 1, -1].some(t => Math.abs(v - t) < 1e-9);

// ── reading the TikZ ─────────────────────────────────────────────────────────
function balanced(s, i, open, close) { let d = 0; for (let j = i; j < s.length; j++) { if (s[j] === '\\') { j++; continue; } if (s[j] === open) d++; else if (s[j] === close && --d === 0) return j; } return -1; }
const hasMacro = s => /\\[A-Za-z]/.test(s);

/**
 * The geometry of a figure: points [{x,y,at}], plotted functions [{expr, deg}], segments [{p,q}], and `unreadable` (coordinates or plots whose
 * numbers could not be read, with the reason).
 */
export function geometryOf(tikz) {
  const s = String(tikz);
  const points = [], functions = [], segments = [], unreadable = [];
  // a foreach loop or a pgfmath macro makes the coordinates after it depend on a variable
  const dynamic = /\\foreach|\\pgfmathsetmacro|\\edef|\\def\b/.test(s);
  // plotted expressions
  for (const m of s.matchAll(/\\addplot3?\b/g)) {
    let i = m.index + m[0].length;
    while (/\s/.test(s[i] ?? '')) i++;
    let opts = '';
    if (s[i] === '[') { const j = balanced(s, i, '[', ']'); if (j > 0) { opts = s.slice(i + 1, j); i = j + 1; } }
    while (/\s/.test(s[i] ?? '')) i++;
    if (s.startsWith('coordinates', i)) {
      i += 'coordinates'.length; while (/\s/.test(s[i] ?? '')) i++;
      if (s[i] === '{') { const j = balanced(s, i, '{', '}'); if (j > 0) { const body = s.slice(i + 1, j); for (const c of body.matchAll(/\(\s*([^(),]+?)\s*,\s*([^(),]+?)\s*\)/g)) { const x = evalMath(c[1], {}, { deg: true }), y = evalMath(c[2], {}, { deg: true }); if (x === null || y === null) unreadable.push(`coordinate (${c[1]},${c[2]})`); else points.push({ x, y, at: 'coordinates' }); } const pts = [...body.matchAll(/\(\s*([^(),]+?)\s*,\s*([^(),]+?)\s*\)/g)].map(c => ({ x: evalMath(c[1], {}, { deg: true }), y: evalMath(c[2], {}, { deg: true }) })).filter(p => p.x !== null && p.y !== null); for (let k = 0; k + 1 < pts.length; k++) segments.push({ p: pts[k], q: pts[k + 1] }); } }
      continue;
    }
    if (s.startsWith('table', i) || s.startsWith('gnuplot', i)) { unreadable.push('addplot table'); continue; }
    if (s.startsWith('expression', i) || /^\s*\[?/.test('')) { /* falls to the brace */ }
    const br = s.indexOf('{', i);
    if (br < 0 || br > i + 14) { unreadable.push('addplot without an expression'); continue; }
    const j = balanced(s, br, '{', '}');
    if (j < 0) { unreadable.push('addplot expression not closed'); continue; }
    const body = s.slice(br + 1, j).trim();
    const dom = /domain\s*=\s*([^,\]\s]+)\s*:\s*([^,\]\s]+)/.exec(opts);
    const hasXOnly = !/\\/.test(body.replace(/\\x\b/g, '')) || /^[^\\]*$/.test(body);
    if (/\bt\b/.test(body) && /,/.test(body.replace(/\([^()]*\)/g, ''))) { unreadable.push(`parametric ${body.slice(0, 30)}`); continue; }
    functions.push({ expr: body, domain: dom ? [evalMath(dom[1], {}, { deg: true }), evalMath(dom[2], {}, { deg: true })] : null, readable: hasXOnly || !/\\/.test(body) });
  }
  // \draw ... plot (\x,{f(\x)})
  for (const m of s.matchAll(/plot\s*(?:\[[^\]]*\])?\s*\(\s*\\([a-z])\s*,\s*\{?([^;]*?)\}?\s*\)\s*(?:;|node|--)/g)) functions.push({ expr: m[2].replace(new RegExp(`\\\\${m[1]}\\b`, 'g'), 'x'), domain: null, readable: true });
  // coordinates in paths: (x,y) with numeric or simple-expression components, polar (angle:radius)
  const stripped = s.replace(/\\addplot3?[\s\S]*?;/g, ' ');
  for (const m of stripped.matchAll(/\(\s*([^(),;:]+?)\s*,\s*([^(),;:]+?)\s*\)/g)) {
    const before = stripped.slice(Math.max(0, m.index - 12), m.index);
    if (/\b(?:node|label|pin)\s*=?\s*$|\\(?:text|mathrm|frac|dfrac|tfrac|binom)\s*\{?$|^\s*$/.test(before) && /\\(?:text|mathrm|frac|dfrac|tfrac|binom)\s*\{?$/.test(before)) continue;
    const a = m[1], b = m[2];
    if (/[A-Za-z]{2,}\s*=/.test(a) || /^[a-z]+$/i.test(a) && /^[a-z]+$/i.test(b) && !/^[xyte]$/i.test(a)) continue;   // a node name pair, an option
    const x = evalMath(a, {}, { deg: true }), y = evalMath(b, {}, { deg: true });
    if (x === null || y === null) { if (!/\$|\\(?:text|frac|mathbf)/.test(`${a}${b}`)) unreadable.push(`coordinate (${a},${b})`); continue; }
    points.push({ x, y, at: 'path' });
  }
  for (const m of stripped.matchAll(/\(\s*([^(),;:]+?)\s*:\s*([^(),;:]+?)\s*\)/g)) {
    const a = evalMath(m[1], {}, { deg: true }), r = evalMath(m[2], {}, { deg: true });
    if (a !== null && r !== null) points.push({ x: r * Math.cos(a * Math.PI / 180), y: r * Math.sin(a * Math.PI / 180), at: 'polar' });
  }
  // straight segments between two readable points: (p) -- (q)
  for (const m of stripped.matchAll(/\(\s*([^(),;:]+?)\s*,\s*([^(),;:]+?)\s*\)\s*--\s*\(\s*([^(),;:]+?)\s*,\s*([^(),;:]+?)\s*\)/g)) {
    const v = [m[1], m[2], m[3], m[4]].map(t => evalMath(t, {}, { deg: true }));
    if (v.every(n => n !== null)) segments.push({ p: { x: v[0], y: v[1] }, q: { x: v[2], y: v[3] } });
  }
  return { points, functions, segments, unreadable: [...new Set(unreadable)], dynamic };
}

// ── what the answer is ───────────────────────────────────────────────────────
const TUPLE = /\(\s*(-?[^(),;]+?)\s*,\s*(-?[^(),;]+?)\s*\)/g;
const tuplesIn = text => {
  const out = [];
  const t = texToPlain(String(text ?? '')).replace(/pmatrix[\s\S]*?\\end/g, m => m);
  for (const m of t.matchAll(TUPLE)) { const x = evalMath(m[1]), y = evalMath(m[2]); if (x !== null && y !== null) out.push([x, y]); }
  for (const m of String(text ?? '').matchAll(/\\begin\{[pb]matrix\}\s*([^\\]+?)\s*\\\\\s*([^\\]+?)\s*\\end\{[pb]matrix\}/g)) { const x = evalMath(m[1]), y = evalMath(m[2]); if (x !== null && y !== null) out.push([x, y]); }
  for (const m of String(text ?? '').matchAll(/\\binom\{([^{}]+)\}\{([^{}]+)\}/g)) { const x = evalMath(m[1]), y = evalMath(m[2]); if (x !== null && y !== null) out.push([x, y]); }
  return out;
};
/** The answer tuples of a part: its point, and any tuple its answer-bearing criterion or expression writes. */
export function answerTuples(part) {
  const out = [];
  const a = part?.answer || {};
  if (part?.answerType === 'point' && Number.isFinite(a.x) && Number.isFinite(a.y)) out.push([a.x, a.y]);
  for (const c of part?.criteria || []) if (c?.answer) out.push(...tuplesIn(c.point));
  if (typeof a.expr === 'string') out.push(...tuplesIn(a.expr));
  return out.filter(([x, y]) => !(x === 0 && y === 0));
}
const tupleStated = (part, [x, y]) => tuplesIn(part.prompt).some(([a, b]) => near(a, x) && near(b, y));

/** The answer as a function of x (y = f(x)) or an implicit relation g(x,y) = 0, or null when the answer is not a curve or line. */
export function answerCurve(part) {
  const a = part?.answer || {};
  if (part?.answerType === 'expression' && typeof a.expr === 'string') {
    if (!/\bx\b/.test(a.expr) && !/\bx\b/.test(texToPlain(a.expr))) return null;
    return { f: x => evalMath(a.expr, { x }), g: null };
  }
  if (part?.answerType === 'equation' && a.lhs !== undefined && a.rhs !== undefined) {
    const L = String(a.lhs), R = String(a.rhs);
    if (L.trim() === 'y') return { f: x => evalMath(R, { x }), g: null };
    return { f: null, g: (x, y) => { const l = evalMath(L, { x, y }), r = evalMath(R, { x, y }); return l === null || r === null ? null : l - r; } };
  }
  return null;
}
const ASKS_ONLY_THE_SHOWN_CURVE = /equation of (?:the )?(?:graph|curve|parabola|line|function)|(?:graph|curve) (?:shown|drawn|in the diagram)|find (?:the )?(?:rule|equation) (?:of|for) (?:the )?(?:graph|curve)/i;
const DERIVED = /tangent|normal|inverse|derivative|gradient function|asymptote|reflect|translat|transform|shift|stretch|integral|primitive|antiderivative|f'|perpendicular|parallel|axis of symmetry|directrix/i;
const READS_THE_GRAPH = /from the (?:graph|diagram|figure)|use the (?:graph|diagram|figure)|\bshown\b|in the (?:diagram|figure)|the (?:graph|diagram|figure) (?:of|shows)/i;

const sameCurve = (f, g) => {
  let hits = 0;
  for (const x of [-3.1, -2, -1.3, -0.4, 0.3, 0.7, 1.5, 2.2, 3.4, 4.6]) {
    const a = f.f(x), b = g(x);
    if (a === null || b === null || !Number.isFinite(a) || !Number.isFinite(b)) continue;
    if (Math.abs(a - b) > 1e-6 * Math.max(1, Math.abs(a), Math.abs(b))) return false;
    hits++;
  }
  return hits >= 3;
};

/** Numbers a printed text states: its literals, simple fractions (\frac{1}{440}, 3/4) and multiples of pi. */
export function numbersIn(text) {
  let t = String(text ?? '');
  const out = [];
  const take = v => { if (v !== null && Number.isFinite(v)) out.push(v); };
  t = t.replace(/(-?)\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, (_, sg, a, b) => { const x = evalMath(a), y = evalMath(b); if (x !== null && y !== null && y !== 0) take((sg ? -1 : 1) * x / y); return ' '; });
  t = t.replace(/\\[dt]?frac\s*(\d)\s*(\d)/g, (_, a, b) => { take(Number(a) / Number(b)); return ' '; });
  t = texToPlain(t);
  t = t.replace(/(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/g, (_, a, b) => { take(Number(a) / Number(b)); return ' '; });
  for (const m of t.matchAll(/(-?\d*\.?\d*)\s*\*?\s*pi(?:\s*\/\s*(\d+))?/g)) { const k = m[1] === '' || m[1] === '-' ? (m[1] === '-' ? -1 : 1) : Number(m[1]); take(k * Math.PI / (m[2] ? Number(m[2]) : 1)); }
  t = t.replace(/(-?\d*\.?\d*)\s*\*?\s*pi(?:\s*\/\s*\d+)?/g, ' ');
  for (const m of t.matchAll(/-?\d+(?:\.\d+)?|-?\.\d+/g)) take(Number(m[0]));
  return out;
}
const keyValues = part => {
  const a = part?.answer || {};
  if (part?.answerType === 'numeric' && Number.isFinite(a.value)) return [a.value];
  if (part?.answerType === 'set' && Array.isArray(a.values)) return a.values.filter(Number.isFinite);
  if (part?.answerType === 'point') return [a.x, a.y].filter(Number.isFinite);
  return [];
};
const promptStates = (part, v) => numbersIn(part.prompt).some(n => near(n, v)) || numbersIn(String(part.prompt).replace(/\\\(|\\\)/g, '')).some(n => near(n, v));

/** The numbers each printed label (and each tick) states. */
function printedNumbers(tikz, { texts, ticks }) {
  const labels = texts.map(t => ({ text: t, nums: numbersIn(t), inequality: /≤|\\le|\\leq|<|\\ge|>|≥/.test(t) }));
  const tickNums = ticks.flatMap(tk => tk.values.map(v => ({ axis: tk.axis, v })));
  return { labels, tickNums };
}

/**
 * Why the DRAWING of this figure gives away the answer of `part` (an archive part: prompt, answerType, answer, criteria, steps), or [].
 * `parsed` is { texts, ticks } from qbank-diagrams.mjs (figureTexts, figureTicks).
 */
export function structuralLeaks(tikz, part, parsed) {
  const out = [];
  const geo = geometryOf(tikz);
  const tuples = answerTuples(part);
  // (a) the answer point or vector is drawn
  if (tuples.length || part.answerType === 'point') {
    if (!tuples.length) out.push('the answer point cannot be read');
    for (const t of tuples) {
      if (tupleStated(part, t)) continue;
      const hit = geo.points.find(p => (near(p.x, t[0], 5e-3) && near(p.y, t[1], 5e-3)) || (near(p.x, t[1], 5e-3) && near(p.y, t[0], 5e-3)));
      if (hit) out.push(`the answer (${t[0]}, ${t[1]}) is drawn as a coordinate (${+hit.x.toFixed(3)}, ${+hit.y.toFixed(3)})`);
    }
    if (geo.unreadable.length && !out.length) out.push(`a coordinate could not be read (${geo.unreadable[0]}): held`);
  }
  // (b) a plotted function or a line is the answer
  const curve = answerCurve(part);
  if (curve) {
    const prompt = String(part.prompt);
    const onlyShown = READS_THE_GRAPH.test(prompt) && ASKS_ONLY_THE_SHOWN_CURVE.test(prompt) && !DERIVED.test(prompt);
    if (!onlyShown) {
      let found = false;
      for (const fn of geo.functions) {
        const f = x => evalMath(fn.expr, { x }, { deg: true }), fr = x => evalMath(fn.expr, { x }, { deg: false });
        if (curve.f && (sameCurve(curve, f) || sameCurve(curve, fr))) { out.push(`a plotted curve is the answer (${fn.expr.slice(0, 40)})`); found = true; break; }
        if (curve.g) { const ok = [-2, -0.7, 0.4, 1.3, 2.6].every(x => { const y = f(x); const v = y === null ? null : curve.g(x, y); return v !== null && Math.abs(v) < 1e-6 * Math.max(1, Math.abs(y)); }); if (ok) { out.push(`a plotted curve satisfies the answer (${fn.expr.slice(0, 40)})`); found = true; break; } }
        if (!fn.readable && evalMath(fn.expr, { x: 0.5 }, { deg: true }) === null) { out.push(`a plotted expression could not be read (${fn.expr.slice(0, 30)}): held`); found = true; break; }
      }
      if (!found) for (const sg of geo.segments) {
        if (Math.hypot(sg.p.x - sg.q.x, sg.p.y - sg.q.y) < 1e-9) continue;
        const pts = [sg.p, sg.q, { x: (sg.p.x + sg.q.x) / 2, y: (sg.p.y + sg.q.y) / 2 }];
        const onAnswer = curve.f ? pts.every(p => { const v = curve.f(p.x); return v !== null && Math.abs(v - p.y) < 1e-6 * Math.max(1, Math.abs(p.y)); }) : pts.every(p => { const v = curve.g(p.x, p.y); return v !== null && Math.abs(v) < 1e-6 * Math.max(1, Math.abs(p.x), Math.abs(p.y)); });
        if (onAnswer && !(Math.abs(sg.p.x - sg.q.x) < 1e-9)) { out.push('a drawn line is the answer'); break; }
      }
      if (!found && geo.unreadable.some(u => /^(addplot|parametric)/.test(u)) && !out.length) out.push(`a plotted curve could not be read (${geo.unreadable.find(u => /^(addplot|parametric)/.test(u))}): held`);
    }
  }
  // (c) a label or tick states the answer, its reciprocal or negative, or the boundaries of a set answer
  const { labels, tickNums } = printedNumbers(tikz, parsed);
  const keys = keyValues(part);
  for (const v of keys) {
    if (promptStates(part, v)) continue;
    const variants = [v, v !== 0 ? 1 / v : null, -v].filter(w => w !== null && Number.isFinite(w));
    for (const lb of labels) for (const n of lb.nums) if (variants.some(w => near(n, w))) { out.push(`the label "${lb.text.slice(0, 30)}" prints ${n}, the answer or a one step form of it (${v})`); }
  }
  if (part.answerType === 'set' && keys.length >= 1) {
    const all = labels.filter(l => l.inequality).flatMap(l => l.nums);
    const unstated = keys.filter(v => !promptStates(part, v));
    if (unstated.length && unstated.every(v => all.some(n => near(n, v)))) out.push('the labels print the boundaries that are the answer set');
  }
  // (d) a worked step's result is a coordinate, a label or a tick
  for (const st of part.steps || []) {
    const d = String(st?.d ?? '');
    const results = d.split(/\\approx|=|≈/).slice(1).map(x => x.trim()).filter(Boolean);
    const last = results.length ? results[results.length - 1] : d;
    for (const t of tuplesIn(last)) {
      if (tupleStated(part, t) || (t[0] === 0 && t[1] === 0)) continue;
      if (geo.points.some(p => near(p.x, t[0], 5e-3) && near(p.y, t[1], 5e-3))) out.push(`a worked result (${t[0]}, ${t[1]}) is drawn as a coordinate`);
    }
    const nums = numbersIn(last);
    if (nums.length === 1 && !trivial(nums[0]) && !promptStates(part, nums[0])) {
      const v = nums[0];
      if (labels.some(l => l.nums.some(n => near(n, v))) ) out.push(`a worked result (${+v.toFixed(4)}) is a label`);
      if (tickNums.some(tk => near(tk.v, v))) out.push(`a worked result (${+v.toFixed(4)}) is a tick`);
    }
  }
  return [...new Set(out)];
}
