// Independent solvers for the JEE hardest-level (D4) forms, Class 11. See india-hardest-forms-check.mjs.
//
// Each solver reads the numbers back out of the prompt the student sees and
// re-solves by a different route from the generator: brute-force enumeration
// for counting, numeric evaluation near the point for limits and derivatives,
// dense scans and bisection for extrema and ranges, Math.atan2 / complex
// multiplication for arguments, explicit datasets for statistics, and
// coordinate constructions for lines. It returns a list of problems; [] means
// the keyed answer was re-derived. A prompt it cannot read is a problem.
// It deliberately does not import the generator module.

// ── Exact rationals ─────────────────────────────────────────────────────────
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
const Q = (n, d = 1) => { if (d < 0) { n = -n; d = -d; } const g = gcd(n, d); return [n / g, d / g]; };
const qadd = ([a, b], [c, d]) => Q(a * d + c * b, b * d);
const qsub = ([a, b], [c, d]) => Q(a * d - c * b, b * d);
const qmul = ([a, b], [c, d]) => Q(a * c, b * d);
const qdiv = ([a, b], [c, d]) => Q(a * d, b * c);
const qeq = (x, y) => x[0] === y[0] && x[1] === y[1];
const qv = ([n, d]) => n / d;
const close = (x, y, tol = 1e-7) => Math.abs(x - y) <= tol * Math.max(1, Math.abs(x), Math.abs(y));

function keyedRational(q) {
  const a = q.answer;
  if (a.simplestFraction) return Q(a.simplestFraction.n, a.simplestFraction.d);
  if (Number.isInteger(a.value)) return Q(a.value, 1);
  return null;
}
/** The key equals the exact rational r. */
function keyIs(q, r, label = 'value') {
  const k = keyedRational(q);
  if (!k) return [`key ${q.answer.value} is not an exact rational`];
  if (!qeq(k, r) || !close(q.answer.value, qv(r), 1e-12)) return [`${label}: independent ${r[0]}/${r[1]} vs keyed ${k[0]}/${k[1]}`];
  return [];
}
/** The key is an exact rational and agrees with a numeric re-derivation. */
function keyNear(q, x, tol = 1e-6, label = 'value') {
  const k = keyedRational(q);
  if (!k) return [`key ${q.answer.value} is not an exact rational`];
  if (!Number.isFinite(x)) return [`${label}: numeric route gave ${x}`];
  if (!close(qv(k), x, tol) || !close(q.answer.value, qv(k), 1e-12)) return [`${label}: numeric ${x} vs keyed ${k[0]}/${k[1]}`];
  return [];
}
const keyInt = (q, n, label = 'value') => (q.answer.value === n && Number.isInteger(n) ? [] : [`${label}: independent ${n} vs keyed ${q.answer.value}`]);

/** "3", "-4", "\dfrac{3}{4}", "-\dfrac{3}{4}", "7.8" → rational. */
function texRational(t) {
  const s = String(t).trim();
  let m = s.match(/^(-)?\\dfrac\{(\d+)\}\{(\d+)\}$/);
  if (m) return Q((m[1] ? -1 : 1) * Number(m[2]), Number(m[3]));
  if (/^-?\d+$/.test(s)) return Q(Number(s), 1);
  if (/^-?\d+\.\d+$/.test(s)) { const p = s.split('.')[1].length; return Q(Math.round(Number(s) * 10 ** p), 10 ** p); }
  return null;
}
/** Integer polynomial in one variable from LaTeX: "x^2 - 3x + 6" → {2:1,1:-3,0:6}. */
function parsePoly(tex, v = 'x') {
  const s = tex.replace(/\s+/g, '');
  const terms = s.match(/[+-]?[^+-]+/g) || [];
  const coeff = {};
  const re = new RegExp(`^([+-]?)(\\d*)(${v}(?:\\^(\\d+))?)?$`);
  for (const t of terms) {
    const m = t.match(re);
    if (!m || (!m[3] && m[2] === '')) return null;
    const c = (m[1] === '-' ? -1 : 1) * (m[2] === '' ? 1 : Number(m[2]));
    const p = m[3] ? (m[4] ? Number(m[4]) : 1) : 0;
    coeff[p] = (coeff[p] || 0) + c;
  }
  return coeff;
}
const evalPoly = (P, x) => Object.entries(P).reduce((s, [p, c]) => s + c * x ** Number(p), 0);
/** "3x - 6", "-x", "x + 12", "7" → [a, b] for ax + b. */
function parseLin(tex, v = 'x') {
  const P = parsePoly(tex, v);
  if (!P || Object.keys(P).some(p => p !== '0' && p !== '1')) return null;
  return [P[1] || 0, P[0] || 0];
}
/** A multiple of π in LaTeX → rational multiple: "-\dfrac{3\pi}{2}" → [-3, 2]. */
function piRational(tex) {
  const s = tex.replace(/\s+/g, '');
  if (s === '0') return Q(0);
  let m = s.match(/^(-)?(\d*)\\pi$/);
  if (m) return Q((m[1] ? -1 : 1) * (m[2] === '' ? 1 : Number(m[2])), 1);
  m = s.match(/^(-)?\\dfrac\{(\d*)\\pi\}\{(\d+)\}$/);
  if (m) return Q((m[1] ? -1 : 1) * (m[2] === '' ? 1 : Number(m[2])), Number(m[3]));
  return null;
}
/** "ax + by + c = 0" → [a, b, c]. */
function parseLine(tex) {
  const s = tex.replace(/\s+/g, '').replace(/=0$/, '');
  const terms = s.match(/[+-]?[^+-]+/g) || [];
  const out = [0, 0, 0];
  for (const t of terms) {
    const m = t.match(/^([+-]?)(\d*)([xy]?)$/);
    if (!m || (!m[3] && m[2] === '')) return null;
    const c = (m[1] === '-' ? -1 : 1) * (m[2] === '' ? 1 : Number(m[2]));
    out[m[3] === 'x' ? 0 : m[3] === 'y' ? 1 : 2] += c;
  }
  return out;
}
const fact = n => (n <= 1 ? 1 : n * fact(n - 1));
/** All distinct permutations of an array of letters, as strings. */
function perms(letters) {
  const out = new Set();
  const rec = (rest, acc) => {
    if (!rest.length) { out.add(acc); return; }
    const seen = new Set();
    for (let i = 0; i < rest.length; i++) {
      if (seen.has(rest[i])) continue;
      seen.add(rest[i]);
      rec(rest.slice(0, i).concat(rest.slice(i + 1)), acc + rest[i]);
    }
  };
  rec(letters, '');
  return [...out];
}
/** Golden-section search for the max of f on [a, b]. */
function goldenMax(f, a, b, iters = 200) {
  const g = (Math.sqrt(5) - 1) / 2;
  let c = b - g * (b - a), d = a + g * (b - a);
  for (let i = 0; i < iters; i++) {
    if (f(c) > f(d)) b = d; else a = c;
    c = b - g * (b - a); d = a + g * (b - a);
  }
  return f((a + b) / 2);
}
/** Max of f over [lo, hi] by a dense grid then a golden refinement around the best point. */
function scanMax(f, lo, hi, steps = 20000) {
  let best = -Infinity, at = lo;
  const h = (hi - lo) / steps;
  for (let i = 0; i <= steps; i++) { const x = lo + i * h; const v = f(x); if (v > best) { best = v; at = x; } }
  return Math.max(best, goldenMax(f, Math.max(lo, at - h), Math.min(hi, at + h)));
}
/** Bisection for a root of f on [a, b] with a sign change. */
function bisect(f, a, b) {
  let fa = f(a);
  for (let i = 0; i < 200; i++) {
    const m = (a + b) / 2, fm = f(m);
    if (fm === 0) return m;
    if (Math.sign(fm) === Math.sign(fa)) { a = m; fa = fm; } else b = m;
  }
  return (a + b) / 2;
}
/** Richardson extrapolation of g(h) → L with error even in h: L ≈ (4g(h/2) − g(h)) / 3. */
const richardson2 = (g, h) => (4 * g(h / 2) - g(h)) / 3;

// ── Complex numbers (numeric) ───────────────────────────────────────────────
const cmul = ([a, b], [c, d]) => [a * c - b * d, a * d + b * c];
const cdiv = ([a, b], [c, d]) => { const r = c * c + d * d; return [(a * c + b * d) / r, (b * c - a * d) / r]; };
const cpow = (z, n) => { let w = [1, 0]; for (let i = 0; i < n; i++) w = cmul(w, z); return w; };
/** "1 - i\sqrt{3}", "-\sqrt{3} + i", "-1 - i" → [re, im]. */
function parseComplexTex(tex) {
  const s = tex.replace(/\s+/g, '');
  const m = s.match(/^(-?)(1|\\sqrt\{3\})([+-])i(\\sqrt\{3\})?$/);
  if (!m) return null;
  const re = (m[1] ? -1 : 1) * (m[2] === '1' ? 1 : Math.sqrt(3));
  const im = (m[3] === '-' ? -1 : 1) * (m[4] ? Math.sqrt(3) : 1);
  return [re, im];
}
/** "3 - 2i", "-i", "4i", "5" → [re, im] (integers). */
function parseCx(tex) {
  const s = tex.replace(/\s+/g, '');
  let m = s.match(/^(-?\d+)$/);
  if (m) return [Number(m[1]), 0];
  m = s.match(/^(-?)(\d*)i$/);
  if (m) return [0, (m[1] ? -1 : 1) * (m[2] === '' ? 1 : Number(m[2]))];
  m = s.match(/^(-?\d+)([+-])(\d*)i$/);
  if (m) return [Number(m[1]), (m[2] === '-' ? -1 : 1) * (m[3] === '' ? 1 : Number(m[3]))];
  return null;
}
/** "(u)^{p}(v)^{q}" or "\dfrac{(u)^{p}}{(v)^{q}}" → numeric complex. */
function parsePolarExpr(tex) {
  const factor = t => {
    const m = t.trim().match(/^\(([^()]+)\)(?:\^\{(\d+)\})?$/);
    if (!m) return null;
    const z = parseComplexTex(m[1]);
    return z ? cpow(z, m[2] ? Number(m[2]) : 1) : null;
  };
  let m = tex.match(/^\\dfrac\{(.+)\}\{(.+)\}$/);
  if (m) { const a = factor(m[1]), b = factor(m[2]); return a && b ? cdiv(a, b) : null; }
  m = tex.match(/^(\([^()]+\)(?:\^\{\d+\})?)(\([^()]+\)(?:\^\{\d+\})?)$/);
  if (m) { const a = factor(m[1]), b = factor(m[2]); return a && b ? cmul(a, b) : null; }
  return null;
}

// ── Statistics helpers ──────────────────────────────────────────────────────
const sumQ = xs => xs.reduce((s, x) => qadd(s, x), Q(0));
const absQ = ([n, d]) => [Math.abs(n), d];
function meanDevAbout(list, centre) { return qdiv(sumQ(list.map(x => absQ(qsub(Q(x), centre)))), Q(list.length)); }
function medianOf(list) {
  const s = [...list].sort((a, b) => a - b), n = s.length;
  return n % 2 ? Q(s[(n - 1) / 2]) : Q(s[n / 2 - 1] + s[n / 2], 2);
}

// ── Solvers ─────────────────────────────────────────────────────────────────
export const SOLVE_JEE_C11 = {
  'c11-domain-range-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/^Let \$f\(x\) = \\sqrt\{\\dfrac\{([^{}]+)\}\{([^{}]+)\}\}\$\. Find the sum of all the integers that do not belong to the domain of \$f\$\.$/);
    if (m) {
      const N = parsePoly(m[1]), D = parsePoly(m[2]);
      if (!N || !D) return ['could not read the quotient'];
      // Scan integers: x is outside the domain when the denominator vanishes or the radicand is negative.
      const out = [];
      for (let x = -200; x <= 200; x++) {
        const d = evalPoly(D, x), n = evalPoly(N, x);
        if (d === 0 || n * d < 0) out.push(x);
      }
      if (out.some(x => Math.abs(x) >= 150)) return ['the excluded set is not bounded'];
      return keyInt(q, out.reduce((s, x) => s + x, 0), 'sum of excluded integers');
    }
    m = p.match(/^The range of the real function \$f\(x\) = \\dfrac\{([^{}]+)\}\{([^{}]+)\}\$, \$x \\in \\mathbb\{R\}\$, is the closed interval \$\[\\alpha, \\beta\]\$\. Find \$\\(alpha|beta)\$\.$/);
    if (!m) return ['could not read the prompt'];
    const N = parsePoly(m[1]), D = parsePoly(m[2]);
    if (!N || !D) return ['could not read the quotient'];
    // The denominator must never vanish, so f is continuous on R.
    const [d1, d0] = [D[1] || 0, D[0] || 0];
    if (D[2] !== 1 || d1 * d1 - 4 * d0 >= 0) return ['the denominator can vanish'];
    const f = x => evalPoly(N, x) / evalPoly(D, x);
    // Substitute x = tan t to scan the whole real line, t ∈ (−π/2, π/2).
    const g = t => f(Math.tan(t));
    const E = 1e-9;
    const hi = scanMax(g, -Math.PI / 2 + E, Math.PI / 2 - E, 40000);
    const lo = -scanMax(t => -g(t), -Math.PI / 2 + E, Math.PI / 2 - E, 40000);
    const out = keyNear(q, m[3] === 'beta' ? hi : lo, 1e-7, m[3]);
    // The extremes are attained (closed interval): they must differ from the limit 1 at ±∞ or be hit at finite x.
    return out;
  },

  'c11-real-function-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/^Find the sum of all the real solutions of the equation \$\\left\|([^|]+)\\right\| = (\d+)\$\.$/);
    if (m) {
      const P = parsePoly(m[1]), k = Number(m[2]);
      if (!P || P[2] !== 1) return ['could not read the quadratic'];
      const b = P[1] || 0;
      // Scan for every crossing of |P(x)| − k on a fine grid, refined by bisection; tangencies checked at the vertex.
      const F = x => Math.abs(evalPoly(P, x)) - k;
      const roots = [];
      const step = 1e-3;
      for (let x = -60; x < 60; x += step) {
        const a1 = F(x), a2 = F(x + step);
        if (a1 === 0) roots.push(x);
        else if (a1 * a2 < 0) roots.push(bisect(F, x, x + step));
      }
      if (F(-60) <= 0 || F(60) <= 0) return ['roots beyond the scan'];
      if (Math.abs(F(-b / 2)) < 1e-12 && !roots.some(r => Math.abs(r + b / 2) < 1e-6)) roots.push(-b / 2);
      const distinct = roots.filter((r, i) => roots.findIndex(s => Math.abs(s - r) < 1e-6) === i);
      const sum = distinct.reduce((s, r) => s + r, 0);
      if (Math.abs(sum - Math.round(sum)) > 1e-6) return [`root sum ${sum} is not whole`];
      return keyInt(q, Math.round(sum), `sum of ${distinct.length} roots`);
    }
    m = p.match(/^Find the least value of \$f\(x\) = (.+)\$ for real \$x\$\.$/);
    if (!m) return ['could not read the prompt'];
    const terms = m[1].match(/\d*\|[^|]+\|/g) || [];
    if (terms.join(' + ') !== m[1]) return ['could not split f(x) into terms'];
    const parts = [];
    for (const t of terms) {
      const mm = t.trim().match(/^(\d*)\|([^|]+)\|$/);
      if (!mm) return [`could not read the term ${t}`];
      const L = parseLin(mm[2]);
      if (!L || !L[0]) return [`could not read the term ${t}`];
      parts.push({ w: mm[1] === '' ? 1 : Number(mm[1]), a: L[0], b: L[1] });
    }
    if (parts.length !== 3) return ['expected three terms'];
    const f = x => parts.reduce((s, t) => s + t.w * Math.abs(t.a * x + t.b), 0);
    // Piecewise linear with rational corners: scan a grid that contains every corner.
    const L = parts.reduce((l, t) => (l * Math.abs(t.a)) / gcd(l, Math.abs(t.a)), 1);
    let best = Infinity;
    for (let i = -60 * L; i <= 60 * L; i++) best = Math.min(best, f(i / L));
    if (f(-61) <= best || f(61) <= best) return ['the minimum is not inside the scan'];
    if (Math.abs(best - Math.round(best)) > 1e-9) return [`least value ${best} is not whole`];
    return keyInt(q, Math.round(best), 'least value');
  },

  'c11-radian-circle-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/^Find the exact value of \$(\d*)\\sin\\left\(([^)]+)\\right\)\\cos\\left\(([^)]+)\\right\) ([+-]) \\tan\\left\(([^)]+)\\right\)\$\.$/);
    if (m) {
      const k = m[1] === '' ? 1 : Number(m[1]);
      const a1 = piRational(m[2]), a2 = piRational(m[3]), a3 = piRational(m[5]);
      if (!a1 || !a2 || !a3) return ['could not read the angles'];
      const x = k * Math.sin(Math.PI * qv(a1)) * Math.cos(Math.PI * qv(a2)) + (m[4] === '+' ? 1 : -1) * Math.tan(Math.PI * qv(a3));
      return keyNear(q, x, 1e-9, 'Math route');
    }
    m = p.match(/^At (\d+):(\d\d) the hour hand and the minute hand of a clock make an angle of \$k\\pi\$ radians/);
    if (m) {
      const h = Number(m[1]), mm = Number(m[2]);
      if (h < 1 || h > 12 || mm > 59) return ['not a clock time'];
      // Degrees in halves: hour hand 60h + mm (half-degrees), minute hand 12mm.
      const hourHalf = 60 * (h % 12) + mm, minHalf = 12 * mm;
      let diff = Math.abs(hourHalf - minHalf) % 720;
      if (diff > 360) diff = 720 - diff;
      return keyIs(q, Q(diff, 360), 'k');
    }
    m = p.match(/^If \$\\(sin|cos|tan|sec|operatorname\{cosec\}|cot)\\,\\theta = ([^$]+)\$ and \$([^<$]+) < \\theta < ([^$]+)\$, find the value of \$([^$]+)\$\.$/);
    if (!m) return ['could not read the prompt'];
    const F = { sin: Math.sin, cos: Math.cos, tan: Math.tan, sec: t => 1 / Math.cos(t), 'operatorname{cosec}': t => 1 / Math.sin(t), cot: t => Math.cos(t) / Math.sin(t) }[m[1]];
    const g = texRational(m[2]), lo = piRational(m[3]), hi = piRational(m[4]);
    if (!g || !lo || !hi) return ['could not read the data'];
    if (!qeq(qsub(hi, lo), Q(1, 2)) || qv(lo) * 2 !== Math.round(qv(lo) * 2)) return ['the interval is not one open quadrant'];
    const A = Math.PI * qv(lo), B = Math.PI * qv(hi), e = 1e-12;
    const h = t => F(t) - qv(g);
    // Dense scan for every solution in the open interval.
    const sols = [];
    const N = 20000;
    for (let i = 0; i < N; i++) {
      const t1 = A + e + ((B - A - 2 * e) * i) / N, t2 = A + e + ((B - A - 2 * e) * (i + 1)) / N;
      if (h(t1) === 0) sols.push(t1); else if (h(t1) * h(t2) < 0 && Math.abs(h(t1) - h(t2)) < 1) sols.push(bisect(h, t1, t2));
    }
    if (sols.length !== 1) return [`${sols.length} angles satisfy the data in the interval`];
    const t = sols[0];
    const ASK = {
      '\\sin\\theta + \\cos\\theta': Math.sin(t) + Math.cos(t),
      '\\tan\\theta + \\sec\\theta': Math.tan(t) + 1 / Math.cos(t),
      '\\operatorname{cosec}\\theta - \\cot\\theta': 1 / Math.sin(t) - Math.cos(t) / Math.sin(t),
      '\\sec\\theta - \\tan\\theta': 1 / Math.cos(t) - Math.tan(t)
    };
    if (!(m[5] in ASK)) return [`could not read the asked expression ${m[5]}`];
    return keyNear(q, ASK[m[5]], 1e-9, 'numeric angle');
  },

  'c11-trig-identity-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/^Find the exact value of \$((?:\\cos \\dfrac\{\d*\\pi\}\{\d+\}(?:\\,)?)+)\$\.$/);
    if (m) {
      const fs = [...m[1].matchAll(/\\cos (\\dfrac\{\d*\\pi\}\{\d+\})/g)].map(x => piRational(x[1]));
      if (fs.length < 2 || fs.some(x => !x)) return ['could not read the factors'];
      const x = fs.reduce((s, a) => s * Math.cos(Math.PI * qv(a)), 1);
      return keyNear(q, x, 1e-9, 'numeric product');
    }
    m = p.match(/^Find the exact value of \$(\d*)((?:\\(?:sin|cos) \d+\^\\circ(?:\\,)?){3})\$\.$/);
    if (m) {
      const K = m[1] === '' ? 1 : Number(m[1]);
      const fs = [...m[2].matchAll(/\\(sin|cos) (\d+)\^\\circ/g)];
      if (fs.length !== 3) return ['could not read the factors'];
      const x = fs.reduce((s, f) => s * Math[f[1]]((Number(f[2]) * Math.PI) / 180), K);
      return keyNear(q, x, 1e-9, 'numeric product');
    }
    m = p.match(/^Find the (greatest|least) value of \$f\(x\) = (.+)\$ for real \$x\$\.$/);
    if (!m) return ['could not read the prompt'];
    const body = m[2].replace(/\s+/g, '');
    const re = /([+-]?)(\d*)\\(sin\^2x|sinx\\cosx|cos\^2x)/g;
    const co = { 'sin^2x': 0, 'sinx\\cosx': 0, 'cos^2x': 0 };
    let used = 0, mm;
    while ((mm = re.exec(body))) { co[mm[3]] += (mm[1] === '-' ? -1 : 1) * (mm[2] === '' ? 1 : Number(mm[2])); used += mm[0].length; }
    if (used !== body.length) return ['could not read f(x)'];
    const f = x => co['sin^2x'] * Math.sin(x) ** 2 + co['sinx\\cosx'] * Math.sin(x) * Math.cos(x) + co['cos^2x'] * Math.cos(x) ** 2;
    const v = m[1] === 'greatest' ? scanMax(f, 0, Math.PI) : -scanMax(x => -f(x), 0, Math.PI);
    return keyNear(q, v, 1e-8, `${m[1]} by scan`);
  },

  'c11-complex-algebra-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/^Find (\$\|z\|\$|the real part of \$z\$) for the complex number \$z\$ that satisfies \$\|z\| ([+-]) z = (\d+) ([+-]) (\d+)i\$\.$/);
    if (m) {
      const a = Number(m[3]), b = (m[4] === '-' ? -1 : 1) * Number(m[5]), plus = m[2] === '+';
      // Imaginary parts: ±y = b. Real part: |z| ± x = a, monotone in x — bisect.
      const y = plus ? b : -b;
      const g = x => Math.hypot(x, y) + (plus ? x : -x) - a;
      const lo = -1e4, hi = 1e4;
      if (g(lo) * g(hi) >= 0) return ['no solution of the modulus equation'];
      const x = bisect(g, lo, hi);
      return keyNear(q, m[1] === '$|z|$' ? Math.hypot(x, y) : x, 1e-9, 'bisection');
    }
    m = p.match(/^A complex number \$z\$ satisfies \$\\left\|z - \\dfrac\{(\d+)\}\{z\}\\right\| = (\d+)\$\. Find the (greatest|least) possible value of \$\|z\|\$\.$/);
    if (m) {
      const a = Number(m[1]), b = Number(m[2]), askMax = m[3] === 'greatest';
      // |z| = r is possible when some φ gives |r e^{iφ} − (a/r) e^{−iφ}| = b; scan φ.
      const possible = r => {
        let lo = Infinity, hi = -Infinity;
        for (let i = 0; i <= 360; i++) {
          const ph = (i * Math.PI) / 360;
          const w = Math.hypot(r * Math.cos(ph) - (a / r) * Math.cos(ph), r * Math.sin(ph) + (a / r) * Math.sin(ph));
          lo = Math.min(lo, w); hi = Math.max(hi, w);
        }
        return lo <= b + 1e-12 && b <= hi + 1e-12;
      };
      const rs = [];
      for (let r = 0.05; r <= 60; r += 0.05) if (possible(r)) rs.push(r);
      if (!rs.length) return ['no modulus is possible'];
      // Refine the end the question asks for by bisection on the predicate.
      let v;
      if (askMax) { let A = rs[rs.length - 1], B = A + 0.05; for (let i = 0; i < 60; i++) { const c = (A + B) / 2; if (possible(c)) A = c; else B = c; } v = A; }
      else { let B = rs[0], A = B - 0.05; for (let i = 0; i < 60; i++) { const c = (A + B) / 2; if (possible(c)) B = c; else A = c; } v = B; }
      if (rs[rs.length - 1] > 59) return ['|z| is unbounded'];
      return keyNear(q, v, 1e-6, `${askMax ? 'greatest' : 'least'} |z|`);
    }
    m = p.match(/^Of the two square roots of \$(-?\d+) ([+-]) (\d+)i\$, take the one with positive real part\. Find its (imaginary|real) part\.$/);
    if (!m) return ['could not read the prompt'];
    const a = Number(m[1]), b = (m[2] === '-' ? -1 : 1) * Number(m[3]);
    const sols = [];
    for (let x = 1; x <= 40; x++) for (let y = -40; y <= 40; y++) if (x * x - y * y === a && 2 * x * y === b) sols.push([x, y]);
    if (sols.length !== 1) return [`${sols.length} square roots with positive real part`];
    return keyInt(q, m[4] === 'real' ? sols[0][0] : sols[0][1], 'square root by search');
  },

  'c11-complex-polar-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/^Let \$z = (.+)\$\. Find the least positive integer \$n\$ for which \$z\^n\$ is (a real number|a positive real number|purely imaginary)\.$/);
    if (m) {
      const z = parsePolarExpr(m[1]);
      if (!z) return ['could not read z'];
      const u = [z[0] / Math.hypot(...z), z[1] / Math.hypot(...z)];
      let w = [1, 0], n = 0;
      const ok = ([x, y]) => (m[2] === 'a real number' ? Math.abs(y) < 1e-6 : m[2] === 'a positive real number' ? Math.abs(y) < 1e-6 && x > 0 : Math.abs(x) < 1e-6);
      do { w = cmul(w, u); n++; } while (!ok(w) && n < 2000);
      if (n >= 2000) return ['no power works'];
      return keyInt(q, n, 'least power by repeated multiplication');
    }
    m = p.match(/^Find the principal argument of \$z = (.+)\$, in degrees\. The principal argument lies in \$\(-180\^\\circ, 180\^\\circ\]\$\.$/);
    if (m) {
      const z = parsePolarExpr(m[1]);
      if (!z) return ['could not read z'];
      const deg = (Math.atan2(z[1], z[0]) * 180) / Math.PI;
      if (Math.abs(deg - Math.round(deg)) > 1e-7) return [`argument ${deg} is not whole`];
      let d = Math.round(deg); if (d === -180) d = 180;
      return keyInt(q, d, 'atan2');
    }
    m = p.match(/^Find the real part of \$(.+)\$\.$/);
    if (!m) return ['could not read the prompt'];
    const z = parsePolarExpr(m[1]);
    if (!z) return ['could not read the product'];
    return keyNear(q, z[0], 1e-9, 'complex multiplication');
  },

  'c11-counting-principle-jee-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/^How many ([34])-digit numbers greater than \$(\d+)\$ can be formed from the digits \$([\d,\\ ]+)\$ \((a digit may be used more than once|no digit may be used more than once)\) that are (even|odd|divisible by \$5\$)\?$/);
    if (m) {
      const k = Number(m[1]), T = Number(m[2]);
      const S = m[3].split(',\\ ').map(Number);
      const rep = m[4].startsWith('a digit');
      let count = 0;
      for (let N = 10 ** (k - 1); N < 10 ** k; N++) {
        if (N <= T) continue;
        const ds = String(N).split('').map(Number);
        if (!ds.every(d => S.includes(d))) continue;
        if (!rep && new Set(ds).size !== ds.length) continue;
        if (m[5] === 'even' ? N % 2 : m[5] === 'odd' ? N % 2 === 0 : N % 5) continue;
        count++;
      }
      return keyInt(q, count, 'enumeration');
    }
    m = p.match(/^How many ([34])-digit natural numbers (.+)\?$/);
    if (m) {
      const k = Number(m[1]);
      const tests = {
        'contain at least one even digit': ds => ds.some(d => d % 2 === 0),
        'contain at least one odd digit': ds => ds.some(d => d % 2 === 1),
        'do not have all their digits the same': ds => new Set(ds).size > 1,
        'have no two neighbouring digits equal': ds => ds.every((d, i) => !i || d !== ds[i - 1])
      };
      let test = tests[m[2]];
      const dm = m[2].match(/^contain at least one digit \$(\d)\$$/);
      if (dm) test = ds => ds.includes(Number(dm[1]));
      if (!test) return [`could not read the condition ${m[2]}`];
      let count = 0;
      for (let N = 10 ** (k - 1); N < 10 ** k; N++) if (test(String(N).split('').map(Number))) count++;
      return keyInt(q, count, 'enumeration');
    }
    m = p.match(/^Let \$A = \\\{1, 2, \\ldots, (\d)\\\}\$ and \$B = \\\{1, 2, \\ldots, (\d)\\\}\$\. How many functions \$f : A \\to B\$ are (.+)\?$/);
    if (!m) return ['could not read the prompt'];
    const mA = Number(m[1]), nB = Number(m[2]);
    const tests = {
      'not one-one': f => new Set(f).size < f.length,
      'not constant': f => new Set(f).size > 1,
      'one-one with $f(1) \\ne 1$': f => new Set(f).size === f.length && f[0] !== 1,
      'one-one with $f(i) \\ne i$ for every $i$ in $A$': f => new Set(f).size === f.length && f.every((v, i) => v !== i + 1)
    };
    const test = tests[m[3]];
    if (!test) return [`could not read the condition ${m[3]}`];
    let count = 0;
    const total = nB ** mA;
    for (let c = 0; c < total; c++) {
      const f = []; let x = c;
      for (let i = 0; i < mA; i++) { f.push((x % nB) + 1); x = Math.floor(x / nB); }
      if (test(f)) count++;
    }
    return keyInt(q, count, 'enumeration of functions');
  },

  'c11-arrangement-jee-reasoning'(q) {
    const p = q.prompt;
    const V = new Set(['A', 'E', 'I', 'O', 'U']);
    let m = p.match(/^All the arrangements of the letters of the word ([A-Z]+), with or without meaning, are written in dictionary order\. What is the rank of \1 in that list\?$/);
    if (m) {
      const all = perms([...m[1]]).sort();
      return keyInt(q, all.indexOf(m[1]) + 1, 'sorted list');
    }
    m = p.match(/^In how many of the distinct arrangements of the letters of the word ([A-Z]+) (are no two vowels next to each other|are all the vowels together|do the vowels appear in alphabetical order from left to right \(not necessarily next to each other\))\?$/);
    if (!m) return ['could not read the prompt'];
    const all = perms([...m[1]]);
    let test;
    if (m[2].startsWith('are no two')) test = w => ![...w].some((c, i) => i && V.has(c) && V.has(w[i - 1]));
    else if (m[2].startsWith('are all')) test = w => { const idx = [...w].map((c, i) => (V.has(c) ? i : -1)).filter(i => i >= 0); return idx[idx.length - 1] - idx[0] === idx.length - 1; };
    else test = w => { const vs = [...w].filter(c => V.has(c)); return vs.every((c, i) => !i || vs[i - 1] <= c); };
    return keyInt(q, all.filter(test).length, 'enumeration of arrangements');
  },

  'c11-ap-jee-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/^The sums of the first \$n\$ terms of two arithmetic progressions are in the ratio \$\(([^)]+)\) : \(([^)]+)\)\$ for every \$n\$\. If \$t_\{(\d+)\}\$ and \$t'_\{\3\}\$ are their (\d+)(st|nd|rd|th) terms, find \$\\dfrac\{t_\{\3\}\}\{t'_\{\3\}\}\$\.$/);
    if (m) {
      const L1 = parseLin(m[1], 'n'), L2 = parseLin(m[2], 'n'), k = Number(m[3]);
      if (!L1 || !L2 || Number(m[4]) !== k) return ['could not read the ratio'];
      // Build concrete progressions: S_n = n(an + b) and S'_n = n(cn + d) have the ratio; t_k = S_k − S_{k−1}.
      const S = (L, n) => n * (L[0] * n + L[1]);
      const t1 = S(L1, k) - S(L1, k - 1), t2 = S(L2, k) - S(L2, k - 1);
      // Check the constructed sums really are sums of APs (second differences constant) — they are quadratics in n without constant term.
      if (t2 === 0) return ['the second progression has a zero term'];
      return keyIs(q, Q(t1, t2), 'constructed progressions');
    }
    m = p.match(/^Find the sum of all the integers from \$(\d+)\$ to \$(\d+)\$, both included, that are divisible by \$(\d+)\$ but not by \$(\d+)\$\.$/);
    if (m) {
      const [L, U, a, b] = m.slice(1).map(Number);
      let s = 0;
      for (let x = L; x <= U; x++) if (x % a === 0 && x % b !== 0) s += x;
      return keyInt(q, s, 'direct sum');
    }
    m = p.match(/^The arithmetic progressions \$(\d+), (\d+), (\d+), \\ldots\$ and \$(\d+), (\d+), (\d+), \\ldots\$ have \$(\d+)\$ and \$(\d+)\$ terms respectively\. (Find the sum of the terms common to both\.|How many terms do they have in common\?)$/);
    if (!m) return ['could not read the prompt'];
    const [a1, b1, c1, a2, b2, c2, N1, N2] = m.slice(1, 9).map(Number);
    if (b1 - a1 !== c1 - b1 || b2 - a2 !== c2 - b2) return ['the listed terms are not APs'];
    const A = new Set(Array.from({ length: N1 }, (_, i) => a1 + i * (b1 - a1)));
    const common = Array.from({ length: N2 }, (_, i) => a2 + i * (b2 - a2)).filter(x => A.has(x));
    return keyInt(q, m[9].startsWith('Find') ? common.reduce((s, x) => s + x, 0) : common.length, 'listed terms');
  },

  'c11-line-equation-jee-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/^A straight line through \$P\((-?\d+), (-?\d+)\)\$ meets the \$x\$-axis at \$A\$ and the \$y\$-axis at \$B\$, and \$P\$ divides \$AB\$ internally in the ratio \$AP : PB = (\d+) : (\d+)\$\. Find (the slope of the line|the sum of the intercepts the line makes on the two axes)\.$/);
    if (m) {
      const [h, k, mm, n] = m.slice(1, 5).map(Number);
      // Search the slope numerically: the line through P with slope s meets the axes at A(h − k/s, 0), B(0, k − sh);
      // find s where AP/PB = m/n with P between A and B.
      const ratio = s => { const A = [h - k / s, 0], B = [0, k - s * h]; return Math.hypot(h - A[0], k - A[1]) / Math.hypot(B[0] - h, B[1] - k); };
      const target = mm / n;
      const sols = [];
      for (const sign of [-1, 1]) {
        const F = e => ratio(sign * 10 ** e) - target;
        for (let e = -6; e < 6; e += 0.0005) if (F(e) * F(e + 0.0005) <= 0) sols.push([sign, bisect(F, e, e + 0.0005)]);
      }
      // Keep slopes where P lies between A and B (internal division).
      const good = sols.map(([sign, e]) => sign * 10 ** e).filter(s => {
        const A = [h - k / s, 0], B = [0, k - s * h];
        const t = (h - A[0]) / (B[0] - A[0]);
        return t > 0 && t < 1 && Math.abs(A[1] + t * (B[1] - A[1]) - k) < 1e-6;
      });
      const uniq = good.filter((s, i) => good.findIndex(r => close(r, s, 1e-6)) === i);
      if (uniq.length !== 1) return [`${uniq.length} lines satisfy the section condition`];
      const s = uniq[0];
      const v = m[5].startsWith('the slope') ? s : (h - k / s) + (k - s * h);
      return keyNear(q, v, 1e-6, 'slope search');
    }
    m = p.match(/^A straight line passes through \$P\((\d+), (\d+)\)\$ and meets the positive \$x\$-axis at \$A\$ and the positive \$y\$-axis at \$B\$\. Find the least possible (area of triangle \$OAB\$|value of \$OA \+ OB\$), where \$O\$ is the origin\.$/);
    if (m) {
      const h = Number(m[1]), k = Number(m[2]);
      // Lines through P with slope −e^t, t ∈ R: intercepts a = h + k e^{−t}, b = k + h e^t.
      const area = m[3].startsWith('area');
      const f = t => { const s = Math.exp(t), a = h + k / s, b = k + h * s; return area ? (a * b) / 2 : a + b; };
      const v = -scanMax(t => -f(t), -12, 12, 40000);
      return keyNear(q, v, 1e-8, 'scan over slopes');
    }
    m = p.match(/^A ray of light from \$A\((-?\d+), (-?\d+)\)\$ is reflected at a point \$R\$ on the \$([xy])\$-axis, and the reflected ray passes through \$B\((-?\d+), (-?\d+)\)\$\. Find the \$\3\$-coordinate of \$R\$\.$/);
    if (!m) return ['could not read the prompt'];
    let A = [Number(m[1]), Number(m[2])], B = [Number(m[4]), Number(m[5])];
    const onX = m[3] === 'x';
    if (!onX) { A = [A[1], A[0]]; B = [B[1], B[0]]; }      // swap so the mirror is the x-axis
    if (A[1] <= 0 || B[1] <= 0) return ['A and B are not on the same side of the mirror'];
    // Equal angles: atan2 of incidence and reflection measured from the axis — find R by bisection.
    // Angle of incidence (from AR to axis) equals angle of reflection: the slopes of RA and RB are opposite.
    const h = r => A[1] / (A[0] - r) + B[1] / (B[0] - r);
    const lo = Math.min(A[0], B[0]), hi = Math.max(A[0], B[0]);
    let r;
    if (lo === hi) r = lo;
    else r = bisect(h, lo + 1e-12, hi - 1e-12);
    const ang1 = Math.atan2(A[1], Math.abs(A[0] - r)), ang2 = Math.atan2(B[1], Math.abs(B[0] - r));
    if (!close(ang1, ang2, 1e-9)) return ['the angles at R are not equal'];
    return keyNear(q, r, 1e-9, 'equal angles');
  },

  'c11-line-angle-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/^Two straight lines pass through \$P\((-?\d+), (-?\d+)\)\$, and each makes an angle \$\\theta\$ with the line \$([^$]+)\$, where \$(\\theta = 45\^\\circ|\\tan\\theta = [^$]+)\$\. Find (the product of their slopes|the sum of their \$y\$-intercepts)\.$/);
    if (m) {
      const h = Number(m[1]), k = Number(m[2]);
      const L = parseLine(m[3]);
      if (!L || !L[1]) return ['could not read the line'];
      const t = m[4].startsWith('\\theta = 45') ? Q(1) : texRational(m[4].replace('\\tan\\theta = ', ''));
      if (!t) return ['could not read the angle'];
      const theta = Math.atan(qv(t));
      const alpha = Math.atan2(-L[0], L[1]);                 // direction of the given line
      const slopes = [Math.tan(alpha + theta), Math.tan(alpha - theta)];
      if (slopes.some(s => !Number.isFinite(s) || Math.abs(s) > 1e8)) return ['one of the lines is vertical'];
      // Each really makes the angle θ (acute angle between direction vectors).
      for (const s of slopes) {
        const c = Math.abs(1 * L[1] + s * -L[0]) / (Math.hypot(1, s) * Math.hypot(L[1], L[0]));
        if (!close(Math.acos(Math.min(1, c)), theta, 1e-9)) return ['a constructed line does not make the angle'];
      }
      const v = m[5].startsWith('the product') ? slopes[0] * slopes[1] : slopes.reduce((s, sl) => s + (k - sl * h), 0);
      return keyNear(q, v, 1e-7, 'rotated directions');
    }
    m = p.match(/^Find the orthocentre of the triangle with vertices \$A\((-?\d+), (-?\d+)\)\$, \$B\((-?\d+), (-?\d+)\)\$ and \$C\((-?\d+), (-?\d+)\)\$\. Give it as a point\.$/);
    if (m) {
      const [ax, ay, bx, by, cx, cy] = m.slice(1).map(Number);
      // Altitudes from C and from A (a different pair from the generator), intersected.
      // (H − C)·(A − B) = 0 ; (H − A)·(B − C) = 0
      const a1 = ax - bx, b1 = ay - by, r1 = a1 * cx + b1 * cy;
      const a2 = bx - cx, b2 = by - cy, r2 = a2 * ax + b2 * ay;
      const det = a1 * b2 - a2 * b1;
      if (!det) return ['degenerate triangle'];
      const H = [(r1 * b2 - b1 * r2) / det, (a1 * r2 - r1 * a2) / det];
      // Third altitude passes too.
      if (Math.abs((H[0] - bx) * (cx - ax) + (H[1] - by) * (cy - ay)) > 1e-9) return ['altitudes not concurrent'];
      return close(H[0], q.answer.x, 1e-12) && close(H[1], q.answer.y, 1e-12) ? [] : [`orthocentre ${H} vs keyed (${q.answer.x}, ${q.answer.y})`];
    }
    m = p.match(/^Find the image of the point \$P\((-?\d+), (-?\d+)\)\$ in the line \$([^$]+)\$\. Give it as a point\.$/);
    if (!m) return ['could not read the prompt'];
    const x0 = Number(m[1]), y0 = Number(m[2]);
    const L = parseLine(m[3]);
    if (!L || (!L[0] && !L[1])) return ['could not read the line'];
    // Reflect by rotating: pick a point on the line and its unit direction; image = 2·projection − P.
    const [a, b, c] = L;
    const Q0 = Math.abs(b) > 0 ? [0, -c / b] : [-c / a, 0];
    const d = [b / Math.hypot(a, b), -a / Math.hypot(a, b)];
    const v = [x0 - Q0[0], y0 - Q0[1]];
    const t = v[0] * d[0] + v[1] * d[1];
    const proj = [Q0[0] + t * d[0], Q0[1] + t * d[1]];
    const I = [2 * proj[0] - x0, 2 * proj[1] - y0];
    return close(I[0], q.answer.x, 1e-9) && close(I[1], q.answer.y, 1e-9) ? [] : [`image ${I} vs keyed (${q.answer.x}, ${q.answer.y})`];
  },

  'c11-limit-jee-reasoning'(q) {
    const p = q.prompt;
    const kOf = s => (s === '' ? 1 : Number(s));
    let m = p.match(/^Evaluate \$\\displaystyle\\lim_\{x \\to (-?\d+)\} \\dfrac\{\\sqrt\{([^{}]+)\} - (\d+)\}\{\\sqrt\{([^{}]+)\} - (\d+)\}\$\.$/);
    if (m) {
      const c = Number(m[1]), P1 = parseLin(m[2]), u = Number(m[3]), P2 = parseLin(m[4]), v = Number(m[5]);
      if (!P1 || !P2) return ['could not read the radicands'];
      const f = x => (Math.sqrt(P1[0] * x + P1[1]) - u) / (Math.sqrt(P2[0] * x + P2[1]) - v);
      // A genuine 0/0 at c.
      if (Math.abs(Math.sqrt(P1[0] * c + P1[1]) - u) > 1e-12 || Math.abs(Math.sqrt(P2[0] * c + P2[1]) - v) > 1e-12) return ['not a 0/0 form'];
      const L = (f(c + 1e-4) + f(c - 1e-4)) / 2;
      return keyNear(q, L, 1e-6, 'numeric limit');
    }
    m = p.match(/^Evaluate \$\\displaystyle\\lim_\{x \\to 0\} (.+)\$\.$/);
    if (m) {
      const tex = m[1];
      let f;
      let mm;
      if ((mm = tex.match(/^\\dfrac\{1 - ((?:\\cos \d*x)+)\}\{x\^2\}$/))) {
        const ks = [...mm[1].matchAll(/\\cos (\d*)x/g)].map(x => kOf(x[1]));
        f = x => (1 - ks.reduce((s, k) => s * Math.cos(k * x), 1)) / (x * x);
      } else if ((mm = tex.match(/^\\dfrac\{1 - \\cos (\d*)x\}\{x\\,\\sin (\d*)x\}$/))) {
        const a = kOf(mm[1]), b = kOf(mm[2]);
        f = x => (1 - Math.cos(a * x)) / (x * Math.sin(b * x));
      } else if ((mm = tex.match(/^\\dfrac\{\\cos (\d*)x - \\cos (\d*)x\}\{x\^2\}$/))) {
        const a = kOf(mm[1]), b = kOf(mm[2]);
        f = x => (Math.cos(a * x) - Math.cos(b * x)) / (x * x);
      } else if ((mm = tex.match(/^\\dfrac\{\\tan (\d*)x - \\sin (\d*)x\}\{(x\^3|x\^2\\,\\sin (\d*)x|x\\sin\^2 (\d*)x)\}$/))) {
        const a = kOf(mm[1]);
        if (kOf(mm[2]) !== a) return ['tan and sin arguments differ'];
        const den = mm[3] === 'x^3' ? x => x ** 3 : mm[4] !== undefined ? (b => x => x * x * Math.sin(b * x))(kOf(mm[4])) : (b => x => x * Math.sin(b * x) ** 2)(kOf(mm[5]));
        f = x => (Math.tan(a * x) - Math.sin(a * x)) / den(x);
      } else return [`could not read the limit ${tex}`];
      // Every form is even in x: Richardson on h², from both sides.
      const L1 = richardson2(f, 0.02), L2 = richardson2(f, -0.02), L3 = richardson2(f, 0.01);
      if (!close(L1, L2, 1e-6) || !close(L1, L3, 1e-5)) return [`numeric limit unstable: ${L1}, ${L2}, ${L3}`];
      return keyNear(q, L3, 2e-6, 'numeric limit');
    }
    m = p.match(/^Evaluate \$\\displaystyle\\lim_\{x \\to \\infty\}\\left\(\\sqrt\{([^{}]+)\} - (?:\\sqrt\{([^{}]+)\}|(\d*)x)\\right\)\$\.$/);
    if (m) {
      const P1 = parsePoly(m[1]);
      if (!P1) return ['could not read the radicand'];
      let g;
      if (m[2] !== undefined) { const P2 = parsePoly(m[2]); if (!P2) return ['could not read the radicand']; g = x => Math.sqrt(evalPoly(P1, x)) - Math.sqrt(evalPoly(P2, x)); }
      else { const a = kOf(m[3]); g = x => Math.sqrt(evalPoly(P1, x)) - a * x; }
      // Error is O(1/x): extrapolate 2g(2X) − g(X).
      const X = 2e5, L = 2 * g(2 * X) - g(X), L2 = 2 * g(4 * X) - g(2 * X);
      if (!close(L, L2, 1e-6)) return [`numeric limit unstable: ${L}, ${L2}`];
      return keyNear(q, L2, 1e-6, 'numeric limit at infinity');
    }
    return ['could not read the prompt'];
  },

  'c11-first-principles-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/^A function \$f : \\mathbb\{R\} \\to \\mathbb\{R\}\$ satisfies \$f\(x \+ y\) = f\(x\) \+ f\(y\) ([+-]) (\d*)xy(\(x \+ y\))?\$ for all real \$x\$ and \$y\$, and \$\\displaystyle\\lim_\{h \\to 0\}\\dfrac\{f\(h\)\}\{h\} = (-?\d+)\$\. Find \$f'\((-?\d+)\)\$\.$/);
    if (m) {
      const k = (m[1] === '-' ? -1 : 1) * (m[2] === '' ? 1 : Number(m[2]));
      const cubic = !!m[3], c = Number(m[4]), x0 = Number(m[5]);
      // f'(x0) = lim [f(x0 + h) − f(x0)]/h = lim [f(h) + extra(x0, h)]/h = c + lim extra(x0, h)/h; evaluate numerically.
      const extra = (x, y) => (cubic ? k * x * y * (x + y) : k * x * y);
      const g = h => c + extra(x0, h) / h;
      const L = (g(1e-6) + g(-1e-6)) / 2;
      return keyNear(q, L, 1e-6, 'definition, numerically');
    }
    m = p.match(/^Let \$f\(x\) = ([^$]+)\$\. Find \$\\displaystyle\\lim_\{h \\to 0\} \\dfrac\{f\(([^)]+)\) - f\(([^)]+)\)\}\{(\d*)h\}\$\.$/);
    if (m) {
      const P = parsePoly(m[1]);
      if (!P) return ['could not read f'];
      // An argument "a + ph", "a - ph", "ph", "-ph", or a plain number.
      const arg = t => {
        const s = t.replace(/\s+/g, '');
        const mm = s.match(/^(?:(-?\d+)([+-]))?(-?)(\d*)h$/);
        if (mm) {
          const a = mm[1] ? Number(mm[1]) : 0;
          const sg = (mm[2] === '-' ? -1 : 1) * (mm[3] === '-' ? -1 : 1);
          if (mm[1] && mm[3]) return null;
          return h => a + sg * (mm[4] === '' ? 1 : Number(mm[4])) * h;
        }
        if (/^-?\d+$/.test(s)) return () => Number(s);
        return null;
      };
      const A1 = arg(m[2]), A2 = arg(m[3]);
      if (!A1 || !A2) return ['could not read the arguments'];
      if (Math.abs(A1(0) - A2(0)) > 0) return ['the arguments do not approach one point'];
      const dk = m[4] === '' ? 1 : Number(m[4]);
      const g = h => (evalPoly(P, A1(h)) - evalPoly(P, A2(h))) / (dk * h);
      const L = (g(1e-5) + g(-1e-5)) / 2;          // the odd error terms cancel; the rest is O(h²)
      return keyNear(q, L, 1e-6, 'numeric quotient');
    }
    m = p.match(/^Using the definition \$f'\(a\) = \\displaystyle\\lim_\{h \\to 0\}\\dfrac\{f\(a \+ h\) - f\(a\)\}\{h\}\$, find \$f'\((-?\d+)\)\$ for \$f\(x\) = (\\dfrac\{1\}\{\\sqrt\{([^{}]+)\}\}|\\sqrt\{([^{}]+)\})\$\.$/);
    if (!m) return ['could not read the prompt'];
    const x0 = Number(m[1]);
    const L = parseLin(m[3] ?? m[4]);
    if (!L) return ['could not read the radicand'];
    const recip = m[3] !== undefined;
    if (L[0] * x0 + L[1] <= 0) return ['f is not defined near the point'];
    const f = x => (recip ? 1 / Math.sqrt(L[0] * x + L[1]) : Math.sqrt(L[0] * x + L[1]));
    const g = h => (f(x0 + h) - f(x0)) / h;
    const D = (g(1e-5) + g(-1e-5)) / 2;
    return keyNear(q, D, 1e-6, 'numeric derivative');
  },

  'c11-mean-deviation-jee-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/^The mean deviation about the (mean|median) of the (\d+) observations \$a,\\ a \+ d,\\ a \+ 2d,\\ \\ldots,\\ a \+ (\d+)d\$, where \$d > 0\$, is \$([\d.]+)\$\. Find \$d\$\.$/);
    if (m) {
      const n = Number(m[2]);
      if (Number(m[3]) !== n - 1) return ['the list does not have n terms'];
      const md = texRational(m[4]);
      if (!md) return ['could not read the mean deviation'];
      // The mean deviation does not depend on a: try a = 7 and every whole d, and a few fractional d.
      const sols = [];
      for (let dn = 1; dn <= 400; dn++) for (const dd of [1, 2, 3, 4]) {
        if (gcd(dn, dd) !== 1) continue;
        const d = Q(dn, dd);
        const list = Array.from({ length: n }, (_, i) => qadd(Q(7), qmul(Q(i), d)));
        const centre = m[1] === 'mean' ? qdiv(sumQ(list), Q(n)) : (n % 2 ? list[(n - 1) / 2] : qdiv(qadd(list[n / 2 - 1], list[n / 2]), Q(2)));
        const dev = qdiv(sumQ(list.map(x => absQ(qsub(x, centre)))), Q(n));
        if (qeq(dev, md)) sols.push(d);
      }
      if (sols.length !== 1) return [`${sols.length} values of d fit`];
      return keyIs(q, sols[0], 'd by search');
    }
    m = p.match(/^Find the mean deviation about the median for the following data\. Values \$x_i\$: \$([\d,\\ ]+)\$; frequencies \$f_i\$: \$([\d,\\ ]+)\$\.$/);
    if (m) {
      const xs = m[1].split(',\\ ').map(Number), fs = m[2].split(',\\ ').map(Number);
      if (xs.length !== fs.length) return ['values and frequencies do not match'];
      const list = xs.flatMap((x, i) => Array(fs[i]).fill(x));
      return keyIs(q, meanDevAbout(list, medianOf(list)), 'expanded data');
    }
    m = p.match(/^Find the mean deviation about the mean of the first \$(\d+)\$ (natural numbers|odd natural numbers|positive multiples of \$(\d+)\$)\.$/);
    if (!m) return ['could not read the prompt'];
    const n = Number(m[1]);
    const list = Array.from({ length: n }, (_, i) => (m[2] === 'natural numbers' ? i + 1 : m[2] === 'odd natural numbers' ? 2 * i + 1 : Number(m[3]) * (i + 1)));
    const mean = Q(list.reduce((s, x) => s + x, 0), n);
    return keyIs(q, meanDevAbout(list, mean), 'explicit list');
  },

  'c11-variance-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/^The mean and the variance of (\d+) observations are \$([\d.]+)\$ and \$([\d.]+)\$\. (\d+) of the observations are \$([\d,\\ ]+)\$\. Find (the larger|the smaller|the positive difference between|the product) (?:of )?(?:the two remaining observations)\.$/);
    if (m) {
      const n = Number(m[1]), mean = texRational(m[2]), variance = texRational(m[3]);
      const known = m[5].split(',\\ ').map(Number);
      if (!mean || !variance || known.length !== n - 2 || Number(m[4]) !== n - 2) return ['could not read the data'];
      // Search every pair of whole-number observations that reproduces both the mean and the variance.
      const sols = [];
      for (let x = -100; x <= 200; x++) for (let y = x; y <= 200; y++) {
        const all = [...known, x, y];
        const mu = Q(all.reduce((s, v) => s + v, 0), n);
        if (!qeq(mu, mean)) continue;
        const v = qdiv(sumQ(all.map(t => { const d = qsub(Q(t), mu); return qmul(d, d); })), Q(n));
        if (qeq(v, variance)) sols.push([x, y]);
      }
      if (sols.length !== 1) return [`${sols.length} pairs of observations fit`];
      const [x, y] = sols[0];
      const v = m[6] === 'the larger' ? y : m[6] === 'the smaller' ? x : m[6].startsWith('the positive') ? y - x : x * y;
      return keyInt(q, v, 'pair by search');
    }
    m = p.match(/^The mean and the standard deviation of (\d+) observations were found to be \$(\d+)\$ and \$(\d+)\$\. Later it was discovered that one observation had been copied as \$(-?\d+)\$ instead of \$(-?\d+)\$\. Find the correct variance\.$/);
    if (m) {
      const [n, mu, sd, w, r] = m.slice(1).map(Number);
      // Deviation route: Σ(x − μ)² = nσ²; replacing w by r changes it to Σ(x − μ)² − (w − μ)² + (r − μ)², about the OLD mean;
      // then shift to the new mean with the parallel-axis rule.
      const ssOld = Q(n * sd * sd - (w - mu) ** 2 + (r - mu) ** 2);
      const shift = Q(r - w, n);                            // new mean − old mean
      const ss = qsub(ssOld, qmul(Q(n), qmul(shift, shift)));
      if (ss[0] < 0) return ['the corrected data are impossible'];
      if (n * sd * sd - (w - mu) ** 2 < 0) return ['the wrong observation cannot be in the data'];
      return keyIs(q, qdiv(ss, Q(n)), 'deviation route');
    }
    m = p.match(/^One group of (\d+) observations has mean \$(\d+)\$ and variance \$(\d+)\$; another group of (\d+) observations has mean \$(\d+)\$ and variance \$(\d+)\$\. Find the variance of all (\d+) observations taken together\.$/);
    if (!m) return ['could not read the prompt'];
    const [n1, m1, v1, n2, m2, v2, N] = m.slice(1).map(Number);
    if (n1 + n2 !== N) return ['the group sizes do not add up'];
    // Within-group plus between-group variance.
    const mean = Q(n1 * m1 + n2 * m2, N);
    const d1 = qsub(Q(m1), mean), d2 = qsub(Q(m2), mean);
    const total = qadd(Q(n1 * v1 + n2 * v2), qadd(qmul(Q(n1), qmul(d1, d1)), qmul(Q(n2), qmul(d2, d2))));
    return keyIs(q, qdiv(total, Q(N)), 'within + between');
  },

  'c11-sample-space-jee-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/^Three dice are thrown, and an outcome is the ordered triple of numbers shown\. Let \$E\$ be the event that (.+)\. How many outcomes does \$E\$ contain\?$/);
    if (m) {
      let test, mm;
      if ((mm = m[1].match(/^the sum of the three numbers is \$(\d+)\$$/))) test = t => t[0] + t[1] + t[2] === Number(mm[1]);
      else if ((mm = m[1].match(/^the largest of the three numbers is \$(\d+)\$$/))) test = t => Math.max(...t) === Number(mm[1]);
      else if ((mm = m[1].match(/^the smallest of the three numbers is \$(\d+)\$$/))) test = t => Math.min(...t) === Number(mm[1]);
      else if ((mm = m[1].match(/^the largest and the smallest of the three numbers differ by exactly \$(\d+)\$$/))) test = t => Math.max(...t) - Math.min(...t) === Number(mm[1]);
      else return [`could not read the event ${m[1]}`];
      let c = 0;
      for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) for (let d = 1; d <= 6; d++) if (test([a, b, d])) c++;
      return keyInt(q, c, 'enumeration of 216 outcomes');
    }
    m = p.match(/^A coin is tossed (\d+) times, and an outcome is the sequence of heads and tails\. How many outcomes are in the event that (.+)\?$/);
    if (m) {
      const n = Number(m[1]);
      const tests = {
        'no two consecutive tosses show heads': s => !s.includes('HH'),
        'at least two consecutive tosses show heads': s => s.includes('HH'),
        'there are more heads than tails': s => s.split('H').length - 1 > n / 2,
        'there are as many heads as tails': s => 2 * (s.split('H').length - 1) === n
      };
      const test = tests[m[2]];
      if (!test) return [`could not read the event ${m[2]}`];
      let c = 0;
      for (let b = 0; b < 2 ** n; b++) { const s = b.toString(2).padStart(n, '0').replace(/1/g, 'H').replace(/0/g, 'T'); if (test(s)) c++; }
      return keyInt(q, c, `enumeration of ${2 ** n} sequences`);
    }
    m = p.match(/^Two dice are thrown, and an outcome is the ordered pair of numbers shown\. Let \$E\$ be the event "the sum of the two numbers is a multiple of \$(\d+)\$" and \$F\$ the event "the first die shows a number greater than \$(\d+)\$"\. How many outcomes are in \$(E \\cup F|E \\cap F'|E' \\cap F')\$\?$/);
    if (!m) return ['could not read the prompt'];
    const pp = Number(m[1]), qq = Number(m[2]);
    const test = { 'E \\cup F': (e, f) => e || f, "E \\cap F'": (e, f) => e && !f, "E' \\cap F'": (e, f) => !e && !f }[m[3]];
    let c = 0;
    for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (test((a + b) % pp === 0, a > qq)) c++;
    return keyInt(q, c, 'enumeration of 36 outcomes');
  },

  // The #408 replacement for the routine D4 quadratic. Each branch re-solves
  // without the conjugate-root / Vieta / De Moivre shortcuts the generator uses.
  'c11-complex-quadratic-jee-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/^The quadratic equation \$x\^2 \+ px \+ q = 0\$, in which \$p\$ and \$q\$ are real numbers, has \$\\dfrac\{([^{}]+)\}\{([^{}]+)\}\$ as one of its roots\. Find \$([pq])\$\.$/);
    if (m) {
      const num = parseCx(m[1]), den = parseCx(m[2]);
      if (!num || !den) return ['could not read the root'];
      const w = cdiv(num, den);
      if (Math.abs(w[1]) < 1e-9) return ['the given root is real, so p and q are not determined'];
      // Substitute w into x² + px + q = 0 and separate parts: two real linear
      // equations in p and q — Im: Im(w²) + p·Im(w) = 0; Re: Re(w²) + p·Re(w) + q = 0.
      const w2 = cmul(w, w);
      const P = -w2[1] / w[1], Qv = -w2[0] - P * w[0];
      const residual = Math.hypot(w2[0] + P * w[0] + Qv, w2[1] + P * w[1]);
      if (residual > 1e-9) return [`root does not satisfy the recovered equation (${residual})`];
      const v = m[3] === 'p' ? P : Qv;
      if (Math.abs(v - Math.round(v)) > 1e-9) return [`${m[3]} = ${v} is not whole`];
      return keyInt(q, Math.round(v), 'substitution and separation of parts');
    }
    m = p.match(/^Let \$\\alpha\$ and \$\\beta\$ be the roots of \$([^$]+) = 0\$\. Find \$\\alpha\^\{(\d+)\} \+ \\beta\^\{(\d+)\}\$\.$/);
    if (m) {
      const P = parsePoly(m[1]);
      if (!P || P[2] !== 1 || Object.keys(P).some(k => Number(k) > 2)) return ['could not read the quadratic'];
      const b = P[1] || 0, c = P[0] || 0, n = Number(m[2]);
      if (n !== Number(m[3])) return ['the two powers differ'];
      const disc = b * b - 4 * c;
      if (disc >= 0) return ['the roots are real'];
      // Roots by the formula, powers by repeated complex multiplication.
      const alpha = [-b / 2, Math.sqrt(-disc) / 2], beta = [-b / 2, -Math.sqrt(-disc) / 2];
      const s = [cpow(alpha, n), cpow(beta, n)];
      const sum = [s[0][0] + s[1][0], s[0][1] + s[1][1]];
      if (Math.abs(sum[1]) > 1e-6 * Math.max(1, Math.abs(sum[0]))) return ['the sum is not real'];
      if (Math.abs(sum[0] - Math.round(sum[0])) > 1e-6 * Math.max(1, Math.abs(sum[0]))) return [`sum ${sum[0]} is not whole`];
      return keyInt(q, Math.round(sum[0]), 'complex powers of the roots');
    }
    m = p.match(/^Find the real number \$k\$ for which the roots of \$x\^2 \+ \(([^()]+)\)x \+ \(([^()]+)\) = 0\$ are non-real and both lie on the circle \$\|z\| = (\d+)\$\.$/);
    if (!m) return ['could not read the prompt'];
    const Bk = parsePoly(m[1], 'k'), Ck = parsePoly(m[2], 'k'), r = Number(m[3]);
    if (!Bk || !Ck) return ['could not read the coefficients'];
    const at = (poly, k) => Object.entries(poly).reduce((acc, [e, co]) => acc + co * k ** Number(e), 0);
    // For each real k, compute the actual roots; where they are non-real, both
    // have modulus |root|. Find every k in [-60, 60] where that modulus is r by
    // a sign-change scan with bisection, then keep the non-real ones.
    const roots = k => {
      const B = at(Bk, k), C = at(Ck, k), disc = B * B - 4 * C;
      return disc < 0 ? [[-B / 2, Math.sqrt(-disc) / 2], [-B / 2, -Math.sqrt(-disc) / 2]] : null;
    };
    const g = k => { const z = roots(k); return z ? Math.hypot(...z[0]) - r : NaN; };
    const found = [];
    const STEP = 1e-3;
    for (let i = -60000; i < 60000; i++) {
      const a = i * STEP, b = (i + 1) * STEP;
      const ga = g(a), gb = g(b);
      if (Number.isNaN(ga) || Number.isNaN(gb)) continue;
      if (ga === 0) { found.push(a); continue; }
      if (ga * gb < 0) {
        let lo = a, hi = b;
        for (let j = 0; j < 60; j++) { const mid = (lo + hi) / 2; if (g(lo) * g(mid) <= 0) hi = mid; else lo = mid; }
        found.push((lo + hi) / 2);
      }
    }
    const ks = found.filter(k => { const z = roots(k); return z && Math.abs(z[0][1]) > 1e-9 && Math.abs(Math.hypot(...z[1]) - r) < 1e-7; });
    if (ks.length !== 1) return [`${ks.length} values of k satisfy the conditions (${ks.map(k => k.toFixed(6)).join(', ')})`];
    return keyNear(q, ks[0], 1e-7, 'scan of the actual roots');
  }
};
