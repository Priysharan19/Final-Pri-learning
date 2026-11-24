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

export const near = (a, b, rel = 2e-3) => Math.abs(a - b) <= Math.max(1e-6, Math.abs(b) * rel);
const trivial = v => [0, 1, -1].some(t => Math.abs(v - t) < 1e-9);

// ── reading the TikZ ─────────────────────────────────────────────────────────
function balanced(s, i, open, close) { let d = 0; for (let j = i; j < s.length; j++) { if (s[j] === '\\') { j++; continue; } if (s[j] === open) d++; else if (s[j] === close && --d === 0) return j; } return -1; }
const hasMacro = s => /\\[A-Za-z]/.test(s);

/**
 * The geometry of a figure: points [{x,y,at}], plotted functions [{expr, deg}], segments [{p,q}], and `unreadable` (coordinates or plots whose
 * numbers could not be read, with the reason).
 */
/** Numeric \pgfmathsetmacro definitions substituted, and simple numeric \foreach loops unrolled. `hard` lists what could not be: computed coordinates. */
export function expandTikz(tikz) {
  let s = String(tikz);
  const hard = [];
  // \pgfmathsetmacro{\name}{expr}
  const defs = {};
  s = s.replace(/\\pgfmathsetmacro\s*\{\\([A-Za-z]+)\}\s*\{([^{}]*)\}\s*;?/g, (_, name, expr) => {
    let e = expr; for (const [k, v] of Object.entries(defs)) e = e.replace(new RegExp(`\\\\${k}\\b`, 'g'), `(${v})`);
    const v = evalMath(e, {}, { deg: true });
    if (v === null) { hard.push(`macro ${name}`); return ' '; }
    defs[name] = String(v); return ' ';
  });
  for (const [k, v] of Object.entries(defs)) s = s.replace(new RegExp(`\\\\${k}\\b`, 'g'), `(${v})`);
  // \foreach \i in {a,b,c} or {a,...,b}, body a {group} or a statement up to ';'
  for (let pass = 0; pass < 4; pass++) {
    const re = /\\foreach\s*\\([A-Za-z]+)\s+in\s*\{([^{}]*)\}\s*/;
    const m = re.exec(s);
    if (!m) break;
    const v = m[1];
    const items = m[2].split(',').map(x => x.trim()).filter(Boolean);
    let list = [];
    const dots = items.indexOf('...');
    if (dots > 0 && items.length === dots + 2) {
      const a = evalMath(items[dots - 1]), b = evalMath(items[dots + 1]), prev = dots >= 2 ? evalMath(items[dots - 2]) : null;
      if (a === null || b === null) { hard.push('foreach range'); s = s.slice(0, m.index) + s.slice(m.index + m[0].length); continue; }
      const step = prev === null ? (b >= a ? 1 : -1) : a - prev;
      if (!step || (b - a) / step < 0 || Math.abs((b - a) / step) > 400) { hard.push('foreach range'); s = s.slice(0, m.index) + s.slice(m.index + m[0].length); continue; }
      list = items.slice(0, dots - 1).map(x => evalMath(x));
      for (let x = a; step > 0 ? x <= b + 1e-9 : x >= b - 1e-9; x += step) list.push(x);
    } else list = items.map(x => (/[/]/.test(x) ? null : evalMath(x)));
    if (list.some(x => x === null)) { hard.push('foreach list'); s = s.slice(0, m.index) + s.slice(m.index + m[0].length); continue; }
    let bodyStart = m.index + m[0].length, body, end;
    if (s[bodyStart] === '{') { const j = balanced(s, bodyStart, '{', '}'); if (j < 0) { hard.push('foreach body'); break; } body = s.slice(bodyStart + 1, j); end = j + 1; }
    else { let j = bodyStart, depth = 0; for (; j < s.length; j++) { if (s[j] === '{' || s[j] === '[') depth++; else if (s[j] === '}' || s[j] === ']') depth--; else if (s[j] === ';' && depth <= 0) break; } body = s.slice(bodyStart, j + 1); end = j + 1; }
    const unrolled = list.map(x => body.replace(new RegExp(`\\\\${v}\\b`, 'g'), `(${x})`)).join(' ');
    s = s.slice(0, m.index) + unrolled + s.slice(end);
  }
  if (/\\foreach/.test(s)) hard.push('foreach');
  if (/\\edef|\\def\b|\\pgfmathparse|\\pgfmathsetmacro/.test(s)) hard.push('macro');
  if (/\$\(|\bintersection|\bcalc\b/.test(s) && /\$\(|intersection-|name intersections/.test(s)) hard.push('calc or intersection coordinates');
  if (/\\coordinate\s*\[[^\]]*\bpos\s*=/.test(s)) hard.push('coordinate at a position on a path');
  for (let k = 0; k < 3; k++) s = s.replace(/\(\s*(-?\d+(?:\.\d+)?)\s*\)/g, '$1');
  s = s.replace(/\brel axis cs\s*:/g, 'relcs:').replace(/\baxis cs\s*:/g, '').replace(/\baxis direction cs\s*:/g, '');
  return { text: s, hard: [...new Set(hard)] };
}

export function geometryOf(tikz) {
  const ex = expandTikz(tikz);
  const s = ex.text;
  const points = [], functions = [], segments = [], unreadable = [...ex.hard];
  const dynamic = ex.hard.length > 0;
  // plotted expressions
  for (const m of s.matchAll(/\\addplot3?\b/g)) {
    let i = m.index + m[0].length;
    while (/\s/.test(s[i] ?? '')) i++;
    let opts = '';
    if (s[i] === '[') { const j = balanced(s, i, '[', ']'); if (j > 0) { opts = s.slice(i + 1, j); i = j + 1; } }
    while (/\s/.test(s[i] ?? '')) i++;
    if (s.startsWith('coordinates', i)) {
      i += 'coordinates'.length; while (/\s/.test(s[i] ?? '')) i++;
      if (s[i] === '{') { const j = balanced(s, i, '{', '}'); if (j > 0) { const body = s.slice(i + 1, j); const isDot = /only marks|\bmark\s*=|\bmark size/.test(opts); for (const c of body.matchAll(/\(\s*([^(),]+?)\s*,\s*([^(),]+?)\s*\)/g)) { const x = evalMath(c[1], {}, { deg: true }), y = evalMath(c[2], {}, { deg: true }); if (x === null || y === null) unreadable.push(`coordinate (${c[1]},${c[2]})`); else points.push({ x, y, at: 'coordinates', dot: isDot }); } const pts = [...body.matchAll(/\(\s*([^(),]+?)\s*,\s*([^(),]+?)\s*\)/g)].map(c => ({ x: evalMath(c[1], {}, { deg: true }), y: evalMath(c[2], {}, { deg: true }) })).filter(p => p.x !== null && p.y !== null); for (let k = 0; k + 1 < pts.length; k++) segments.push({ p: pts[k], q: pts[k + 1] }); } }
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
  // marked dots: \fill / \filldraw ... (x,y) circle, and \node[pt ...] at (x,y)
  for (const m of stripped.matchAll(/\\fill(?:draw)?\b[^;]*?\(\s*([^(),;:]+?)\s*,\s*([^(),;:]+?)\s*\)\s*circle/g)) { const x = evalMath(m[1], {}, { deg: true }), y = evalMath(m[2], {}, { deg: true }); if (x !== null && y !== null) points.push({ x, y, at: 'fill', dot: true }); }
  for (const m of stripped.matchAll(/\\node\s*\[[^\]]*\b(?:pt|opt)\b[^\]]*\]\s*at\s*\(\s*([^(),;:]+?)\s*,\s*([^(),;:]+?)\s*\)/g)) { const x = evalMath(m[1], {}, { deg: true }), y = evalMath(m[2], {}, { deg: true }); if (x !== null && y !== null) points.push({ x, y, at: 'node', dot: true }); }
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
    if (Math.abs(a - b) > 1e-4 * Math.max(1, Math.abs(a), Math.abs(b))) return false;      // a plot may use a rounded constant (2.71828 for e)
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
  if (part?.answerType === 'interval' && typeof a.region === 'string') {
    const out = [];
    for (const piece of a.region.split(/<=|>=|<|>|≤|≥|\bor\b|\band\b/)) { const t = piece.trim(); if (!t || /^[A-Za-z]$/.test(t)) continue; const v = evalMath(t); if (v !== null) out.push(v); }
    return out;
  }
  return [];
};
/** Numbers the prompt states on their own (not a coefficient or exponent inside an expression: the 4 of 4x is not "4"), and the numbers of its tuples. */
const standaloneNumbers = text => {
  const raw = String(text ?? '').replace(/\\\(|\\\)/g, ' ');
  const out = [];
  // numbers in prose, in maths with no variable ($7$), after an equals sign (x=1, r=3), and the numbers of a tuple or vector; NOT the
  // coefficients and constants inside an expression with a variable (the 2 of x+2, the 4 of 4x)
  let prose = raw.replace(/\$([^$]+)\$/g, (_, m) => {
    const plain = texToPlain(m);
    const hasVar = /[A-Za-z]/.test(plain.replace(/\b(?:sin|cos|tan|exp|ln|log|sqrt|pi|e|text|mathrm|circ)\b/g, '').replace(/\\[A-Za-z]+/g, ''));
    for (const q of plain.matchAll(/=\s*(-?\d+(?:\.\d+)?)(?![\w.^(_])/g)) out.push(Number(q[1]));
    return hasVar ? ' ' : ` ${m} `;
  });
  const t = texToPlain(prose);
  for (const m of t.matchAll(/(?<![\w.^_])(-?\d+(?:\.\d+)?)(?![\w.^(_])/g)) out.push(Number(m[1]));
  for (const [x, y] of tuplesIn(text)) out.push(x, y);
  for (const m of t.matchAll(/(-?\d+)\s*\/\s*(\d+)/g)) out.push(Number(m[1]) / Number(m[2]));
  return out;
};
export const promptStates = (part, v) => standaloneNumbers(part.prompt).some(n => near(n, v));

const NUMBER_WORDS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
const STOP = new Set(['the', 'and', 'are', 'for', 'with', 'from', 'that', 'this', 'each', 'its', 'has', 'have', 'was', 'were', 'make', 'makes']);
const wordSet = t => new Set(String(t ?? '').toLowerCase().replace(/\\[a-zA-Z]+/g, ' ').replace(/[^a-z0-9.\s]/g, ' ').split(/\s+/).filter(Boolean).map(w => (w in NUMBER_WORDS ? String(NUMBER_WORDS[w]) : w)).filter(w => w.length >= 3 || /^\d+$/.test(w)).filter(w => !STOP.has(w)));
/**
 * Is this printed text (a label, an annotation, an alt text) the author's own marking text, a step heading or a step: most of its words are the words
 * of one criterion point, step heading or step? Short labels of one word are not tested here (the number rules cover them).
 */
export function matchesMarking(text, part) {
  const mine = wordSet(text);
  if (mine.size < 2) return false;
  const sources = [...(part.criteria || []).map(c => c?.point), ...(part.steps || []).flatMap(st => [st?.h, st?.d])].filter(Boolean);
  for (const src of sources) {
    const theirs = wordSet(src);
    let hit = 0; for (const w of mine) if (theirs.has(w)) hit++;
    if (hit >= 2 && hit / mine.size >= 0.7) return true;
  }
  return false;
}

/** The values that are, or are one step from, the answer and the results of every worked step: [{ v, kind: 'answer' | 'step', why }]. */
export function decisiveValues(part) {
  const out = [];
  for (const v of keyValues(part)) out.push({ v, kind: 'answer', why: part.answerType === 'numeric' ? 'the answer' : `${part.answerType === 'interval' ? 'a boundary of' : 'a component of'} the answer` });
  const tuple = answerTuples(part);
  for (const [x, y] of tuple) out.push({ v: x, kind: 'answer', why: 'a component of the answer' }, { v: y, kind: 'answer', why: 'a component of the answer' });
  // the author's own marking points ("Limits 0 and 4", "roots 1 and 3") and the limits of integrals and the values assigned in the working
  for (const c of part.criteria || []) {
    const t = String(c?.point ?? '').replace(/\\(?:text|mathrm)\{[^{}]*\}/g, ' ');
    for (const n of numbersIn(t)) out.push({ v: n, kind: 'step', why: `a number in the marking ("${t.trim().slice(0, 28)}")` });
  }
  for (const st of part.steps || []) {
    const d = String(st?.d ?? '');
    for (const m of d.matchAll(/\\int_\{?([^\s^{}]+)\}?\^\{?([^\s{}(\\]+)\}?/g)) for (const lim of [m[1], m[2]]) { const v = evalMath(lim); if (v !== null) out.push({ v, kind: 'step', why: `a limit of integration (${lim})` }); }
    for (const m of d.matchAll(/(?:^|[\s$,;])[a-zA-Z]\s*=\s*(-?\\?[dt]?frac\{[^{}]+\}\{[^{}]+\}|-?[\d.]+(?:\\pi)?)/g)) for (const n of numbersIn(m[1])) out.push({ v: n, kind: 'step', why: `a value found in the working (${+n.toFixed(4)})` });
  }
  let w = 0;
  for (const st of part.steps || []) {
    w++;
    const whole = texToPlain(String(st?.d ?? '').replace(/\$/g, ''));
    for (const [x, y] of tuplesIn(String(st?.d ?? ''))) out.push({ v: x, kind: 'step', why: `a component of a point in step ${w}` }, { v: y, kind: 'step', why: `a component of a point in step ${w}` });
    for (const m of whole.matchAll(/(?<![\w.^_])(-?\d+(?:\.\d+)?)(?![\w.^(_])/g)) out.push({ v: Number(m[1]), kind: 'step', why: `a number of step ${w} (${m[1]})` });
  }
  let i = 0;
  for (const st of part.steps || []) {
    i++;
    const d = String(st?.d ?? '').replace(/\$/g, '');
    const segs = d.split(/\\approx|=|≈/).map(x => x.trim()).filter(Boolean);
    const rhs = segs.length > 1 ? segs.slice(1) : segs;
    for (const seg of rhs) {
      const t = seg.replace(/\\(?:text|mathrm|quad|qquad)\{?[^{}]*\}?/g, ' ').replace(/\b(?:or|and)\b/g, ',');
      const plain = texToPlain(t);
      if (/[A-Za-z]/.test(plain.replace(/\b(?:sin|cos|tan|exp|ln|log|sqrt|pi|e)\b/g, ''))) continue;
      for (const [x, y] of tuplesIn(t)) { out.push({ v: x, kind: 'step', why: `a component of the result of step ${i}` }, { v: y, kind: 'step', why: `a component of the result of step ${i}` }); }
      for (const n of numbersIn(t)) out.push({ v: n, kind: 'step', why: `a result of step ${i} (${+n.toFixed(4)})` });
      for (const m of plain.matchAll(/\d+(?:\.\d+)?/g)) out.push({ v: Number(m[0]), kind: 'step', why: `a number of step ${i} (${m[0]})` });
      const whole = evalMath(t.replace(/,/g, ' '));
      if (whole !== null) out.push({ v: whole, kind: 'step', why: `the result of step ${i} (${+whole.toFixed(4)})` });
    }
  }
  return out;
}

/** The numbers each printed label (and each tick) states. */
function printedNumbers(tikz, { texts, ticks }) {
  const labels = texts.map(t => ({ text: t, nums: numbersIn(t), inequality: /≤|\\le|\\leq|<|\\ge|>|≥/.test(t) }));
  const tickNums = ticks.flatMap(tk => tk.values.map(v => ({ axis: tk.axis, v })));
  return { labels, tickNums };
}

/**
 * Figures held after a person looked at the rasterised drawing beside the question and its answer (the rules above did not catch them).
 * Each states what the picture shows. A held figure is not packed; the question goes on the owner's list.
 */
export const HELD_BY_EYE = Object.freeze({
  'A11-C1-100': 'both intercepts the working needs (3/4 and -3) are labelled on the axes',
  'A11-C1-023': 'the corners of the graph, which are the answer set, sit at the labelled ticks -1 and 3',
  'A11-E1-051': 'the two intersections, whose x-values are the answer, are drawn as marked points',
  'A11-F1-011': 'the dashed asymptote y = 1 is labelled, and the answer is that level',
  'A11-F1-023': 'the two tangent lines y = x + c are drawn dashed, and their c values are the answer',
  'A11-F1-062': 'the intersection is marked and its x-value is labelled, and that is the answer',
  'A11-F1-123': 'the dashed asymptote y = 1 is labelled, and the range boundary is that level',
  'A11-T2-008': 'the intersections whose x-values are the answer are drawn as marked points',
  'A11-T2-015': 'the points whose x-values are the answer are drawn as marked points',
  'A12-C2-010': 'the stationary point asked for is marked on the curve',
  'A12-C3-018': 'the turning point and the point of inflection that bound the answer are marked',
  'A12-C3-043': 'the maximising rectangle, with its corner (2, 8), is drawn and labelled',
  'A12-C3-117': 'the maximising rectangle, with its corners at x = -2 and 2 and height 8, is drawn and labelled',
  'A12-F2-011': 'the intersections that bound the answer are drawn as marked points',
  'A11-F1-020': 'the lines of the family drawn include the tangents to the parabola, whose slopes bound the answer',
  'A11-F1-038': 'the two tangent lines through (0, -1), whose slopes are the answer, are drawn dashed',
  'A12-C3-011': 'the maximising rectangle, with its corners at x = plus and minus root 3 and height 6, is drawn',
  'A12-C3-020': 'the maximising rectangle in the semicircle is drawn',
  'A12-C3-059': 'the maximising rectangle in the semicircle is drawn',
  'A12-C4-018': 'the x-axis tick e is the upper limit of x found in the working (x = e at y = 1)',
  'A12-C4-045': 'the x-axis tick 4 is where the line meets the curve, the value the working finds',
  'A12-C4-068': 'the x-axis tick 4 is where the line meets the curve, the value the working finds',
  'A12-C4-090': 'the x-axis tick e is the upper limit of x found in the working (x = e at y = 1)',
  'A12-T3-003': 'the two points where the depth equals 3, whose times the working finds, are marked',
  'A12-T3-004': 'the three intersections, whose number is the answer, are marked with dots',
  'X11-F1-041': 'the x-axis tick 1 is one of the solutions, which are the answer',
  'X12-C3-017': 'the x-axis tick e is the upper limit of x found in the working (x = e at y = 1)',
  'X12-C3-028': 'the x-axis tick 2 is where the curve meets the line y = 8, a value the working finds',
  'X12-T3-031': 'the y-axis ticks 5 and -5 are the amplitude R that step 1 finds',
  'X12-T3-048': 'the y-axis tick root 5 is the amplitude R that step 1 finds',
  'X12-C3-013': 'the plotted curve is the accepted answer function, with a dot at (0, 1)',
  'X11-A1-017': 'the figure prints "six unchosen numbers, seven gaps", which is step 1 (and so does its alt text)',
  'A11-S1-024': 'the labels 10 and 7 give step 1 of the working',
  'X11-F1-097': 'the x-axis tick -2 is the marking criterion "domain x >= -2"',
  'X12-C3-100': 'the label y = 1 is the marking criterion "the solution approaches 1"',
  'X11-F2-017': 'the cubic is plotted with its roots, which gives the sign pattern the answer states',
  'A12-T3-146': 'the figure is the sketch the question asks for, with the line dashed, so the count is visible',
  'A11-T2-144': 'the figure is the sketch the question asks for, with the line dashed, so the count is visible',
  'X11-F1-148': 'the figure is the sketch the question asks for, with the line dashed, so the count is visible',
  'A12-T3-101': 'the figure draws the curve and the dashed line, so the count of crossings is visible',
  'A12-S3-004': 'the x-axis ticks are at every standard deviation, which is step 1 of the empirical rule',
  'X11-F2-099': 'seen by the reviewer: the figure shows a step of the working',
  'X12-V1-105': 'seen by the reviewer: the figure shows the landing point the question asks for',
  'X12-V1-016': 'seen by the reviewer: the figure shows both possible paths and so the two angles',
  'A12-M1-068': 'legibility: the axis label 5 is overprinted, and the alt text says 50000 where the figure shows 5',
  'A12-S2-072': 'legibility: a bar and its labels are clipped',
  'X12-S1-138': 'legibility: the labels overlap',
  'X12-S1-062': 'mismatch: the alt text claims an x-label 0 that is not drawn',
  'X11-A1-003': 'mismatch: A and B are drawn next to each other, and the question asks for arrangements where they are not',
  'X12-C3-099': 'the x-axis tick e squared is the upper limit of the working (the value of x at y = 2)',
  'X11-F1-015': 'the point asked for is marked on the curve',
  'X11-F1-017': 'the turning points asked for are marked on the curve',
  'X12-C2-020': 'the tangent whose equation is asked for is drawn dashed'
});

/**
 * Why the DRAWING of this figure gives away the answer of `part` (an archive part: prompt, answerType, answer, criteria, steps), or [].
 * `parsed` is { texts, ticks } from qbank-diagrams.mjs (figureTexts, figureTicks).
 */
export function structuralLeaks(tikz, part, parsed) {
  const out = [];
  if (HELD_BY_EYE[part?.question]) out.push(`seen by eye: ${HELD_BY_EYE[part.question]}`);
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
  // the figure is the very sketch a "sketch" or "draw the graph" question asks for
  if (/\b(?:sketch|draw the graph|draw a graph)\b/i.test(String(part.prompt)) && geo.functions.length) out.push('answer: the figure is the very sketch the question asks for');
  // a question that counts crossings ("how many solutions") whose figure draws the graphs and the line: the count is visible
  if (/\bhow many (?:solutions|roots|intersections|crossings|points|zeros)\b/i.test(String(part.prompt)) && geo.functions.length >= 1 && (geo.functions.length >= 2 || /dashed|dotted/.test(String(tikz)))) out.push('answer: the figure draws the graphs whose crossings are counted, so the count is visible');
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
  // (c) and (d): NO value that is the accepted answer (or a component, reciprocal or negative of it) or the result of ANY worked step may appear
  // as an axis tick, tick label, label, annotation, marked point or coordinate. The main curve the question gives is allowed; a plotted
  // auxiliary line that is a step's result is not. A value the question itself states is not a finding.
  const { labels, tickNums } = printedNumbers(tikz, parsed);
  // (b) text printed on the figure that is the author's own marking text or a step, put into words
  for (const l of labels) if (matchesMarking(l.text, part)) out.push(`step result: the text "${l.text.replace(/\s+/g, ' ').slice(0, 40)}" printed on the figure is the marking text or a step`);
  const decisive = decisiveValues(part);
  const keys = keyValues(part);
  const shown = [
    ...tickNums.map(t => ({ v: t.v, where: `the ${t.axis} axis tick ${+t.v.toFixed(4)}` })),
    ...labels.flatMap(l => l.nums.map(n => ({ v: n, where: `the label "${l.text.replace(/\s+/g, ' ').slice(0, 28)}"` }))),
    ...geo.points.flatMap(pt => [{ v: pt.x, where: `${pt.dot ? 'a marked point' : 'a coordinate'} (${+pt.x.toFixed(3)}, ${+pt.y.toFixed(3)})` }, { v: pt.y, where: `${pt.dot ? 'a marked point' : 'a coordinate'} (${+pt.x.toFixed(3)}, ${+pt.y.toFixed(3)})` }])
  ];
  const seen = new Set();
  for (const d of decisive) {
    if (Math.abs(d.v) < 1e-12 || promptStates(part, d.v)) continue;
    const variants = d.kind === 'answer' ? [d.v, d.v !== 0 ? 1 / d.v : null, -d.v] : [d.v];
    for (const sh of shown) {
      if (!variants.some(w => w !== null && Number.isFinite(w) && near(sh.v, w, 3e-3))) continue;
      const key = `${d.kind}|${sh.where}|${d.why}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(d.kind === 'answer' ? `answer: ${sh.where} is ${d.why}` : `step result: ${sh.where} is ${d.why}`);
    }
  }
  // a set answer whose values are all the boundaries of inequality labels
  if (part.answerType === 'set' && keys.length >= 1) {
    const all = labels.filter(l => l.inequality).flatMap(l => l.nums);
    const unstated = keys.filter(v => !promptStates(part, v));
    if (unstated.length && unstated.every(v => all.some(n => near(n, v)))) out.push('answer: the labels print the boundaries that are the answer set');
  }
  // worked results that are points
  for (const st of part.steps || []) {
    const d = String(st?.d ?? '');
    const results = d.split(/\\approx|=|≈/).slice(1).map(x => x.trim()).filter(Boolean);
    const last = results.length ? results[results.length - 1] : d;
    for (const t of tuplesIn(last)) {
      if (tupleStated(part, t) || (t[0] === 0 && t[1] === 0)) continue;
      if (geo.points.some(pt => near(pt.x, t[0], 5e-3) && near(pt.y, t[1], 5e-3))) out.push(`step result: a coordinate (${t[0]}, ${t[1]}) is drawn`);
    }
  }
  // a plotted auxiliary line or curve that is a step's result (a tangent, a normal, an inverse), unless the question states that curve
  {
    const stepFns = [];
    for (const st of part.steps || []) {
      const segs = String(st?.d ?? '').replace(/\$/g, '').split(/\\approx|=|≈/).map(x => x.trim()).filter(Boolean);
      for (const seg of segs) { const t = texToPlain(seg.replace(/\\(?:text|mathrm)\{[^{}]*\}/g, '')); if (/\bx\b/.test(t) && !/[A-Za-wyz]\b/.test(t.replace(/\b(?:sin|cos|tan|exp|ln|log|sqrt|pi|abs)\b/g, ''))) stepFns.push(seg); }
    }
    const promptFns = [...String(part.prompt).matchAll(/(?:y|f\(x\)|g\(x\))\s*=\s*([^,;$]+)/g)].map(m => m[1]);
    for (const fn of geo.functions) {
      const f = x => evalMath(fn.expr, { x }, { deg: true });
      const same = expr => { let hits = 0; for (const x of [-2.3, -1.1, 0.4, 0.9, 1.7, 2.6, 3.3]) { const a = f(x), b = evalMath(expr, { x }); if (a === null || b === null) continue; if (Math.abs(a - b) > 1e-4 * Math.max(1, Math.abs(a), Math.abs(b))) return false; hits++; } return hits >= 3; };
      if (promptFns.some(same)) continue;
      const hit = stepFns.find(same);
      if (hit) out.push(`step result: a plotted line or curve (${fn.expr.slice(0, 30)}) is the result of a worked step`);
    }
  }
  return [...new Set(out)];
}
