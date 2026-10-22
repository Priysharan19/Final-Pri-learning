// ─────────────────────────────────────────────────────────────────────────────
// Independent solvers for the JEE D4 Linear Inequalities forms
// (client/src/engine/generators/india-class11-jee-d4-inequalities.js).
//
// Nothing here imports the generator. Each solver reads the numbers back out of
// the rendered prompt and decides the question by brute substitution into the
// inequalities exactly as printed — no solving for x, no reversal rule, no
// end-point algebra:
//   · a parameter k or a is scanned over a wide range of integers, and for
//     each value the inequality is tested at every point of a fine grid of x
//     (containment), at every natural number (exact count), or at every integer
//     x (systems);
//   · the canteen price is found by trying every whole rupee against every day;
//   · lattice points are enumerated over a box;
//   · an area is found by clipping a large square by each half-plane in exact
//     BigInt rationals and applying the shoelace formula.
// Where an extreme value is asked for, the scan also checks that the set of
// good values really is bounded on that side inside the scanned range.
// NEAR_MISS lists answers a student could plausibly write that must be marked WRONG.
// ─────────────────────────────────────────────────────────────────────────────

const keyed = q => q.answer.value;
const keyInt = (q, n, label) => (Number.isInteger(n) && keyed(q) === n ? [] : [`${label}: independent ${n} vs keyed ${keyed(q)}`]);

// ── Reading the printed mathematics ─────────────────────────────────────────

/** "3x - 2y + 5", "-k + 3", "a" → { x, y, k, a, c } with integer coefficients, or null. */
function parseLin(src) {
  const s = String(src).replace(/\s+/g, '');
  if (!s) return null;
  const out = { x: 0, y: 0, k: 0, a: 0, c: 0 };
  const terms = s.match(/[+-]?[^+-]+/g);
  if (!terms || terms.join('') !== s) return null;
  for (const t of terms) {
    const m = t.match(/^([+-]?)(\d*)([xyka]?)$/);
    if (!m || (m[2] === '' && m[3] === '')) return null;
    const sign = m[1] === '-' ? -1 : 1;
    const n = m[2] === '' ? 1 : Number(m[2]);
    out[m[3] || 'c'] += sign * n;
  }
  return out;
}

/** "\dfrac{3x + 2}{5}" or "3x + 2" → { num, den }. */
function parseSide(src) {
  const s = String(src).trim();
  const f = s.match(/^\\dfrac\{([^{}]+)\}\{(\d+)\}$/);
  if (f) { const num = parseLin(f[1]); return num && Number(f[2]) > 0 ? { num, den: Number(f[2]) } : null; }
  const num = parseLin(s);
  return num ? { num, den: 1 } : null;
}

const OPMAP = { '<': '<', '\\le': '<=', '>': '>', '\\ge': '>=' };
/** "L op R" → { L, R, op }. */
function parseIneq(src) {
  const m = String(src).trim().match(/^(.+?) (<|\\le|>|\\ge) (.+)$/);
  if (!m) return null;
  const L = parseSide(m[1]), R = parseSide(m[3]);
  return L && R ? { L, R, op: OPMAP[m[2]] } : null;
}

/**
 * Does the inequality hold? Variables are integers except x, which is X / xs
 * (xs > 0): every term is scaled by xs so the test stays in exact integers.
 */
function holds(I, v, xs = 1) {
  const val = side => side.num.x * (v.x ?? 0) + xs * (side.num.y * (v.y ?? 0) + side.num.k * (v.k ?? 0) + side.num.a * (v.a ?? 0) + side.num.c);
  const l = val(I.L) * I.R.den, r = val(I.R) * I.L.den;    // both denominators positive
  return I.op === '<' ? l < r : I.op === '<=' ? l <= r : I.op === '>' ? l > r : l >= r;
}

/** The extreme of a scanned set that must be bounded on the asked side and reach the other edge. */
function extremeOf(good, lo, hi, ask) {
  if (!good.length) return { problem: 'no value works' };
  const min = Math.min(...good), max = Math.max(...good);
  if (max - min + 1 !== good.length) return { problem: 'the good values are not a run of consecutive integers' };
  if (ask === 'least') return min === lo ? { problem: 'no least value inside the scan' } : max !== hi ? { problem: 'the good values are not a ray' } : { value: min };
  return max === hi ? { problem: 'no greatest value inside the scan' } : min !== lo ? { problem: 'the good values are not a ray' } : { value: max };
}

/** A bounded set of good integers: its size, least or greatest member. */
function pickBounded(good, lo, hi, ask) {
  if (good.includes(lo) || good.includes(hi)) return { problem: 'the good values reach the edge of the scan' };
  if (ask === 'count') return { value: good.length };
  if (!good.length) return { problem: 'no value works' };
  return { value: ask === 'least' ? Math.min(...good) : Math.max(...good) };
}
const askOf = p => (/^For how many/.test(p) ? 'count' : /^Find the least/.test(p) ? 'least' : /^Find the greatest/.test(p) ? 'greatest' : null);

// ── Exact rationals for the area (BigInt) ───────────────────────────────────
const bgcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a || 1n; };
const Q = (n, d = 1n) => { n = BigInt(n); d = BigInt(d); if (d < 0n) { n = -n; d = -d; } const g = bgcd(n, d); return [n / g, d / g]; };
const qa = (x, y) => Q(x[0] * y[1] + y[0] * x[1], x[1] * y[1]);
const qs = (x, y) => Q(x[0] * y[1] - y[0] * x[1], x[1] * y[1]);
const qm = (x, y) => Q(x[0] * y[0], x[1] * y[1]);
const qd = (x, y) => Q(x[0] * y[1], x[1] * y[0]);
const sgn = x => (x[0] > 0n ? 1 : x[0] < 0n ? -1 : 0);

/** Keep the part of a polygon where A·x + B·y ≤ C (Sutherland–Hodgman). */
function clip(poly, A, B, C) {
  const f = P => qs(qa(qm(Q(A), P[0]), qm(Q(B), P[1])), Q(C));
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const P = poly[i], R = poly[(i + 1) % poly.length];
    const fp = f(P), fr = f(R);
    if (sgn(fp) <= 0) out.push(P);
    if ((sgn(fp) < 0 && sgn(fr) > 0) || (sgn(fp) > 0 && sgn(fr) < 0)) {
      const t = qd(fp, qs(fp, fr));
      out.push([qa(P[0], qm(t, qs(R[0], P[0]))), qa(P[1], qm(t, qs(R[1], P[1])))]);
    }
  }
  return out;
}

/** The $…$ items of a list such as "$a$, $b$ and $c$". */
const items = s => [...String(s).matchAll(/\$([^$]+)\$/g)].map(m => m[1]);

// ═════════════════════════════════════════════════════════════════════════════

export const SOLVE = {
  'c11-linear-inequality-jee-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/^Find the (least|greatest) integer \$k\$ such that every real number \$x\$ with \$(-?\d+) \\le x \\le (-?\d+)\$ satisfies \$(.+)\$\.$/);
    if (m) {
      const I = parseIneq(m[4]), lo = Number(m[2]), hi = Number(m[3]);
      if (!I || !(lo < hi)) return ['could not read the inequality or the interval'];
      // Every k from −300 to 300 against every x = X/120 on [lo, hi].
      const good = [];
      for (let k = -300; k <= 300; k++) {
        let all = true;
        for (let X = lo * 120; X <= hi * 120 && all; X++) all = holds(I, { x: X, k }, 120);
        if (all) good.push(k);
      }
      const r = extremeOf(good, -300, 300, m[1]);
      return r.problem ? [r.problem] : keyInt(q, r.value, 'grid scan over x and k');
    }
    m = p.match(/^(?:For how many integers \$k\$ does the inequality|Find the (?:least|greatest) integer \$k\$ for which the inequality) \$(.+)\$ ha(?:ve|s) exactly \$(\d+)\$ solutions in natural numbers \$x\$[?.]$/);
    if (m) {
      const I = parseIneq(m[1]), N = Number(m[2]), ask = askOf(p);
      if (!I || !ask) return ['could not read the inequality'];
      const good = [];
      for (let k = -400; k <= 400; k++) {
        // A solution as large as 300 means far more than N of them (N is small).
        if (holds(I, { x: 300, k })) continue;
        let count = 0;
        for (let x = 1; x < 300; x++) if (holds(I, { x, k })) count++;
        if (count === N) good.push(k);
      }
      const r = pickBounded(good, -400, 400, ask);
      return r.problem ? [r.problem] : keyInt(q, r.value, 'count of natural solutions for each k');
    }
    m = p.match(/costs ₹\$(\d+(?:\.\d{1,2})?)\$ to make, the canteen has a fixed cost of ₹\$(\d+)\$ a day, and every day \$(\d+)\$ samosas are given free to the staff\. On any day the canteen sells some whole number of samosas from \$(\d+)\$ to \$(\d+)\$\. Find the least whole-rupee selling price per samosa for which the canteen (makes a profit|makes no loss)/);
    if (!m) return ['could not read the prompt'];
    const costPaise = Math.round(Number(m[1]) * 100), F = Number(m[2]), g = Number(m[3]), n1 = Number(m[4]), n2 = Number(m[5]);
    const strictProfit = m[6] === 'makes a profit';
    // Try every whole-rupee price against every possible day, in paise.
    for (let price = 1; price <= 2000; price++) {
      let everyDay = true;
      for (let n = n1; n <= n2 && everyDay; n++) {
        const income = 100 * price * n, cost = costPaise * (n + g) + 100 * F;
        everyDay = strictProfit ? income > cost : income >= cost;
      }
      if (everyDay) return keyInt(q, price, 'least price that works on every day');
    }
    return ['no price up to ₹2000 works'];
  },

  'c11-inequality-system-jee-reasoning'(q) {
    const p = q.prompt, ask = askOf(p);
    let m = p.match(/^(?:For how many integers \$a\$ does|Find the (?:least|greatest) integer \$a\$ for which) the system of inequalities \$(.+)\$ and \$(.+)\$ ha(?:ve|s) exactly \$(\d+)\$ integer solutions \$x\$[?.]$/);
    if (m) {
      const I1 = parseIneq(m[1]), I2 = parseIneq(m[2]), N = Number(m[3]);
      if (!I1 || !I2 || !ask) return ['could not read the system'];
      const good = [];
      for (let a = -300; a <= 300; a++) {
        let count = 0, edge = false;
        for (let x = -200; x <= 200; x++) {
          if (holds(I1, { x, a }) && holds(I2, { x, a })) { count++; edge = edge || x === -200 || x === 200; }
        }
        // Solutions reaching the edge of the scan are far more than N (N is small).
        if (count === N && !edge) good.push(a);
      }
      const r = pickBounded(good, -300, 300, ask);
      return r.problem ? [r.problem] : keyInt(q, r.value, 'integer solutions counted for each a');
    }
    m = p.match(/^Find the (least|greatest) integer \$k\$ for which the system \$(.+)\$, \$(.+)\$, \$(.+)\$ has at least one integer solution \$x\$\.$/);
    if (!m) return ['could not read the prompt'];
    const I = [m[2], m[3], m[4]].map(parseIneq);
    if (I.some(x => !x)) return ['could not read the system'];
    const good = [];
    for (let k = -300; k <= 300; k++) {
      for (let x = -300; x <= 300; x++) {
        if (I.every(J => holds(J, { x, k }))) {
          if (x === -300 || x === 300) return [`k = ${k}: the solutions reach the edge of the x scan`];
          good.push(k);
          break;
        }
      }
    }
    const r = extremeOf(good, -300, 300, m[1]);
    return r.problem ? [r.problem] : keyInt(q, r.value, 'integer solutions searched for each k');
  },

  'c11-inequality-region-jee-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/^How many points \$\(x, y\)\$ with integer coordinates satisfy all of (.+)\?$/);
    if (m) {
      const I = items(m[1]).map(parseIneq);
      if (I.length !== 4 || I.some(x => !x)) return ['could not read the region'];
      let count = 0;
      for (let x = -100; x <= 100; x++) for (let y = -100; y <= 100; y++) {
        if (I.every(J => holds(J, { x, y }))) {
          if (Math.abs(x) === 100 || Math.abs(y) === 100) return ['the region reaches the edge of the box'];
          count++;
        }
      }
      return keyInt(q, count, 'lattice points enumerated');
    }
    m = p.match(/^Find the area of the region of the plane in which (.+) all hold\.$/);
    if (m) {
      const I = items(m[1]).map(parseIneq);
      if (I.length < 3 || I.some(x => !x)) return ['could not read the region'];
      let poly = [[-1000, -1000], [1000, -1000], [1000, 1000], [-1000, 1000]].map(([x, y]) => [Q(x), Q(y)]);
      for (const J of I) {
        // L op R with L = (lin)/dL and R = (lin)/dR: bring to A·x + B·y (≤) C.
        const lhs = ['x', 'y', 'c'].map(v => J.L.num[v] * J.R.den - J.R.num[v] * J.L.den);
        let [A, B, C] = [lhs[0], lhs[1], -lhs[2]];
        if (J.op === '>' || J.op === '>=') [A, B, C] = [-A, -B, -C];
        poly = clip(poly, A, B, C);
        if (!poly.length) return ['the region is empty'];
      }
      if (poly.some(P => P.some(c => c[0] === 1000n * c[1] || c[0] === -1000n * c[1]))) return ['the region is not bounded'];
      let twice = Q(0);
      for (let i = 0; i < poly.length; i++) {
        const P = poly[i], R = poly[(i + 1) % poly.length];
        twice = qa(twice, qs(qm(P[0], R[1]), qm(R[0], P[1])));
      }
      const area = Q(twice[0] < 0n ? -twice[0] : twice[0], twice[1] * 2n);
      const sf = q.answer.simplestFraction;
      const key = sf ? [BigInt(sf.n), BigInt(sf.d)] : Number.isInteger(keyed(q)) ? [BigInt(keyed(q)), 1n] : null;
      if (!key) return [`key ${keyed(q)} is not exact`];
      if (area[0] !== key[0] || area[1] !== key[1]) return [`clipped area ${area[0]}/${area[1]} vs keyed ${key[0]}/${key[1]}`];
      if (Math.abs(Number(area[0]) / Number(area[1]) - keyed(q)) > 1e-9 * Math.max(1, keyed(q))) return ['the keyed decimal does not match the fraction'];
      return [];
    }
    m = p.match(/^(?:For how many integers \$k\$ does the point|Find the (?:least|greatest) integer \$k\$ for which the point) \$\(([^,]+), ([^)]+)\)\$ lies? in the region given by (.+)[?.]$/);
    if (!m) return ['could not read the prompt'];
    const X = parseLin(m[1]), Y = parseLin(m[2]), I = items(m[3]).map(parseIneq), ask = askOf(p);
    if (!X || !Y || I.length !== 3 || I.some(x => !x) || !ask) return ['could not read the point or the region'];
    const good = [];
    for (let k = -400; k <= 400; k++) {
      const v = { x: X.k * k + X.c, y: Y.k * k + Y.c };
      if (I.every(J => holds(J, v))) good.push(k);
    }
    const r = pickBounded(good, -400, 400, ask);
    return r.problem ? [r.problem] : keyInt(q, r.value, 'point tested for each k');
  }
};

// ── Near misses: answers a student could plausibly write, all wrong ─────────
const around = v => [String(v + 1), String(v - 1), `k = ${v + 1}`, `${v}.5`];

export const NEAR_MISS = {
  'c11-linear-inequality-jee-reasoning'(q) {
    const v = keyed(q);
    return [...around(v), String(-v || v + 2)];
  },
  'c11-inequality-system-jee-reasoning'(q) {
    const v = keyed(q);
    return [String(v + 1), String(v - 1), `a = ${v - 1}`, `${v}.5`, String(-v || v + 2)];
  },
  'c11-inequality-region-jee-reasoning'(q) {
    const v = keyed(q), sf = q.answer.simplestFraction;
    if (sf) return [`${sf.n + 1}/${sf.d}`, `${sf.n - 1}/${sf.d}`, `${2 * sf.n}/${sf.d}`, String(Math.floor(v)), String(Math.ceil(v))];
    return [String(v + 1), String(v - 1), String(2 * v || v + 2), `${v}.5`];
  }
};
