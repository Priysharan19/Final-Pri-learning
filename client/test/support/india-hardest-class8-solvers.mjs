// ─────────────────────────────────────────────────────────────────────────────
// Independent solvers for the CBSE Class VIII hardest-level (D3) forms
// (client/src/engine/generators/india-class8-hardest.js).
//
// Nothing here imports the generator. Each solver reads the numbers back out
// of the prompt the student sees and solves the problem again by a different
// route — brute-force search over the unknown, step-by-step simulation,
// BigInt place-value arithmetic, coordinate search — checking that exactly one
// value fits, and compares the result with the keyed answer. NEAR_MISS lists,
// per form, answers a student could plausibly write that must be marked wrong.
// ─────────────────────────────────────────────────────────────────────────────

const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
const close = (x, y, tol = 1e-9) => Math.abs(x - y) <= tol * Math.max(1, Math.abs(x), Math.abs(y));
/** "12{,}34{,}567" or "1,234" → 1234567. */
const num = s => Number(String(s).replace(/\{,\}|,/g, ''));
const nums = (s, re) => [...s.matchAll(re)].map(m => num(m[1]));
const keyIs = (q, v) => (close(q.answer.value, v) ? [] : [`solver ${v} vs keyed ${q.answer.value}`]);
const unique = (sols, q, what = 'solutions') => (sols.length !== 1 ? [`${sols.length} ${what}: ${sols.slice(0, 5)}`] : keyIs(q, sols[0]));
const isCube = n => { const r = Math.round(Math.cbrt(n)); return r ** 3 === n; };
const isSq = n => { const r = Math.round(Math.sqrt(n)); return r * r === n; };

/** Polynomial in letters from LaTeX: "3x^2 - xy + 4" → Map("x2" → 3, "x1y1" → -1, "" → 4). */
function parsePoly(tex) {
  const s = tex.replace(/\s+/g, '');
  const out = new Map();
  const terms = s.match(/[+-]?[^+-]+/g) || [];
  for (const t of terms) {
    const m = t.match(/^([+-]?)(\d*)((?:[a-z](?:\^\d+)?)*)$/);
    if (!m) return null;
    const c = (m[1] === '-' ? -1 : 1) * (m[2] === '' ? 1 : Number(m[2]));
    if (m[2] === '' && m[3] === '') return null;
    const pw = {};
    for (const v of m[3].matchAll(/([a-z])(?:\^(\d+))?/g)) pw[v[1]] = (pw[v[1]] || 0) + (v[2] ? Number(v[2]) : 1);
    const key = Object.keys(pw).sort().map(k => `${k}${pw[k]}`).join('');
    out.set(key, (out.get(key) || 0) + c);
  }
  return out;
}
const keyOf = mono => { // "x^2y" → "x2y1"
  const pw = {};
  for (const v of mono.matchAll(/([a-z])(?:\^(\d+))?/g)) pw[v[1]] = (pw[v[1]] || 0) + (v[2] ? Number(v[2]) : 1);
  return Object.keys(pw).sort().map(k => `${k}${pw[k]}`).join('');
};
const evalKey = (key, env) => [...key.matchAll(/([a-z])(\d+)/g)].reduce((p, m) => p * env[m[1]] ** Number(m[2]), 1);
const evalPoly = (P, env) => [...P.entries()].reduce((s, [k, c]) => s + c * evalKey(k, env), 0);
const mulPoly = (A, B) => {
  const out = new Map();
  for (const [ka, ca] of A) for (const [kb, cb] of B) {
    const pw = {};
    for (const k of [ka, kb]) for (const m of k.matchAll(/([a-z])(\d+)/g)) pw[m[1]] = (pw[m[1]] || 0) + Number(m[2]);
    const key = Object.keys(pw).sort().map(v => `${v}${pw[v]}`).join('');
    out.set(key, (out.get(key) || 0) + ca * cb);
  }
  return out;
};

export const SOLVE = {
  'c8-exterior-angle-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/^A polygon has \$(\d+)\$ sides\. Its exterior angles, one at each vertex, are (.*), \$x\^\\circ\$ and \$2x\^\\circ\$/);
    if (m) {
      const n = Number(m[1]);
      const known = nums(m[2], /\$(\d+)\^\\circ\$/g);
      if (known.length + 2 !== n) return ['angle count does not match the sides'];
      const xs = [];
      for (let x = 1; x < 180; x++) if (known.reduce((s, a) => s + a, 0) + 3 * x === 360) xs.push(x);
      if (xs.length !== 1) return [`${xs.length} values of x`];
      const all = [...known, xs[0], 2 * xs[0]];
      if (all.some(e => e <= 0 || e >= 180)) return ['an exterior angle is not between 0 and 180'];
      const interior = all.map(e => 180 - e);
      return keyIs(q, Math.max(...interior));
    }
    m = p.match(/interior angle of a regular polygon is \$(\d+)\^\\circ\$ more than/);
    if (m) {
      const D = Number(m[1]), sols = [];
      for (let n = 3; n <= 1000; n++) if (close((180 * (n - 2)) / n - 360 / n, D, 1e-12)) sols.push(n);
      return unique(sols, q);
    }
    m = p.match(/interior angle of a regular polygon is \$(\d+)\$ times/);
    if (!m) return ['could not read the polygon'];
    const k = Number(m[1]), sols = [];
    for (let n = 3; n <= 1000; n++) if (close((180 * (n - 2)) / n, (k * 360) / n, 1e-12)) sols.push(n);
    return unique(sols, q);
  },
  'c8-quadrilateral-property-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/\\angle A = \((-?\d*)x ([+-]) (\d+)\)\^\\circ\$ and \$\\angle B = \((-?\d*)x ([+-]) (\d+)\)\^\\circ\$\. Find \$\\angle (C|D)\$/);
    if (m) {
      const a = Number(m[1] || 1), b = (m[2] === '-' ? -1 : 1) * Number(m[3]), c = Number(m[4] || 1), d = (m[5] === '-' ? -1 : 1) * Number(m[6]);
      const xs = [];
      for (let x = -500; x <= 500; x++) if (a * x + b + c * x + d === 180) xs.push(x);
      if (xs.length !== 1) return [`${xs.length} values of x`];
      const A = a * xs[0] + b, B = c * xs[0] + d;
      if (A <= 0 || B <= 0) return ['an angle is not positive'];
      return keyIs(q, m[7] === 'C' ? A : B);
    }
    m = p.match(/\\angle BAD = (\d+)\^\\circ\$ and \$\\angle BCD = (\d+)\^\\circ\$/);
    if (m) {
      const [P, Qa] = [Number(m[1]), Number(m[2])], sols = [];
      for (let B = 1; B < 180; B++) if (P + Qa + 2 * B === 360) sols.push(B);
      return unique(sols, q);
    }
    m = p.match(/perimeter of a rhombus is \$(\d+)\$ cm and one of its diagonals is \$(\d+)\$ cm/);
    if (m) {
      const s = Number(m[1]) / 4, d = Number(m[2]), sols = [];
      for (let e = 1; e < 2 * s; e++) if ((d / 2) ** 2 + (e / 2) ** 2 === s * s) sols.push(e);
      return unique(sols, q);
    }
    m = p.match(/\\angle AOB = (\d+)\^\\circ\$, find \$\\angle (OBC|OAB)\$/);
    if (!m) return ['could not read the figure'];
    // Coordinates: O at the origin, A and C opposite, B and D opposite, unit half-diagonals.
    const t = (Number(m[1]) * Math.PI) / 180;
    const A = [1, 0], B = [Math.cos(t), Math.sin(t)], C = [-1, 0];
    const ang = (P, V, R) => {
      const u = [P[0] - V[0], P[1] - V[1]], w = [R[0] - V[0], R[1] - V[1]];
      return (Math.acos((u[0] * w[0] + u[1] * w[1]) / Math.hypot(...u) / Math.hypot(...w)) * 180) / Math.PI;
    };
    const v = m[2] === 'OBC' ? ang([0, 0], B, C) : ang([0, 0], A, B);
    return close(v, q.answer.value, 1e-9) ? [] : [`coordinates give ${v} vs ${q.answer.value}`];
  },
  'c8-bar-graph-reasoning'(q) {
    const p = q.prompt;
    let rows = [...p.matchAll(/Class (\w+): boys \$(\d+)\$, girls \$(\d+)\$/g)].map(m => [Number(m[2]), Number(m[3])]);
    if (rows.length) {
      if (rows.length !== 5) return ['expected five classes'];
      let best = -1, at = [];
      rows.forEach(([b, g], i) => { const d = Math.abs(b - g); if (d > best) { best = d; at = [i]; } else if (d === best) at.push(i); });
      if (at.length !== 1) return ['greatest gap is not unique'];
      return keyIs(q, rows[at[0]][0] + rows[at[0]][1]);
    }
    rows = [...p.matchAll(/(\d{4}): scooters \$(\d+)\$, cars \$(\d+)\$/g)].map(m => Number(m[2]) + Number(m[3]));
    if (rows.length !== 6) return ['could not read six years'];
    const rises = rows.slice(1).map((t, i) => t - rows[i]);
    const top = Math.max(...rises);
    if (rises.filter(r => r === top).length !== 1 || top <= 0) return ['largest rise is not unique and positive'];
    return keyIs(q, top);
  },
  'c8-pie-chart-reasoning'(q) {
    const p = q.prompt;
    const angles = nums(p, /[A-Z][a-z]+ \$(\d+)\^\\circ\$/g);
    if (angles.length !== 4) return ['could not read four angles'];
    const save = 360 - angles.reduce((s, a) => s + a, 0);
    if (save <= 0) return ['no angle left for Savings'];
    let m = p.match(/monthly income of ₹\$([\d{},]+)\$/);
    if (m) {
      const T = num(m[1]);
      // Share the income degree by degree.
      let total = 0;
      for (let d = 0; d < save; d++) total += T / 360;
      return close(total, q.answer.value, 1e-9) ? [] : [`${total} vs ${q.answer.value}`];
    }
    m = p.match(/spends ₹\$([\d{},]+)\$ on ([A-Z][a-z]+)/);
    if (!m) return ['could not read the known sector'];
    const amt = num(m[1]);
    const ang = Number(p.match(new RegExp(`${m[2]} \\$(\\d+)\\^\\\\circ\\$`))[1]);
    const sols = [];
    for (let v = 1; v <= 200000; v++) if (v * ang === amt * save) sols.push(v);
    return unique(sols, q);
  },
  'c8-square-pattern-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/sum \$(\d+) \+ (\d+) \+ (\d+) \+ \\cdots \+ (\d+)\$/);
    if (m) {
      const [a, , , b] = m.slice(1).map(Number);
      let s = 0;
      for (let t = a; t <= b; t += 2) s += t;
      return keyIs(q, s);
    }
    m = p.match(/strictly between \$(\d+)\$ and \$(\d+)\$ are NOT/);
    if (m) {
      const [lo, hi] = [Number(m[1]), Number(m[2])];
      let c = 0;
      for (let t = lo + 1; t < hi; t++) if (!isSq(t)) c++;
      return keyIs(q, c);
    }
    m = p.match(/largest number is \$(\d+)\$/);
    if (!m) return ['could not read the pattern'];
    const L = Number(m[1]), ms = [];
    for (let k = 2; k <= 1000; k++) if (k * k + 1 === L) ms.push(k);
    if (ms.length !== 1) return ['no unique m'];
    const a = 2 * ms[0], b = ms[0] ** 2 - 1;
    if (a * a + b * b !== L * L) return ['not a Pythagorean triplet'];
    return keyIs(q, /sum of the other two/.test(p) ? a + b : a);
  },
  'c8-square-root-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/The number \$([\d{},]+)\$ is (multiplied|divided) by the smallest whole number/);
    if (m) {
      const n = num(m[1]);
      for (let k = 1; k <= n; k++) {
        if (m[2] === 'multiplied' && isSq(n * k)) return keyIs(q, Math.round(Math.sqrt(n * k)));
        if (m[2] === 'divided' && n % k === 0 && isSq(n / k)) return keyIs(q, Math.round(Math.sqrt(n / k)));
      }
      return ['no factor found'];
    }
    m = p.match(/has \$([\d{},]+)\$ saplings/);
    if (!m) return ['could not read the saplings'];
    const P = num(m[1]);
    let r = 0;
    while ((r + 1) * (r + 1) <= P) r++;
    if (/buy/.test(p)) { let e = 0; while (!isSq(P + e)) e++; return keyIs(q, e); }
    return keyIs(q, P - r * r);
  },
  'c8-cube-pattern-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/^\$(\d+)\^3\$ can be written as the sum of \$(\d+)\$ consecutive odd numbers\. What is the (largest|smallest)/);
    if (m) {
      const n = Number(m[1]), sols = [];
      for (let start = 1; start <= 4 * n * n; start += 2) {
        let s = 0;
        for (let i = 0; i < n; i++) s += start + 2 * i;
        if (s === n ** 3) sols.push(m[3] === 'largest' ? start + 2 * (n - 1) : start);
      }
      return unique(sols, q);
    }
    m = p.match(/^\$([\d{},]+)\$ is the cube of a whole number/);
    if (!m) return ['could not read the cube'];
    const C = num(m[1]), sols = [];
    for (let k = 1; k <= 500; k++) if (k ** 3 === C) sols.push(k);
    return unique(sols, q);
  },
  'c8-cube-multiplier-reasoning'(q) {
    const m = q.prompt.match(/The number \$([\d{},]+)\$ is (multiplied|divided) by the smallest whole number/);
    if (!m) return ['could not read the number'];
    const n = num(m[1]);
    for (let k = 1; k <= 100000; k++) {
      if (m[2] === 'multiplied' && isCube(n * k)) return keyIs(q, Math.round(Math.cbrt(n * k)));
      if (m[2] === 'divided' && n % k === 0 && isCube(n / k)) return keyIs(q, Math.round(Math.cbrt(n / k)));
    }
    return ['no factor found'];
  },
  'c8-percentage-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/marks a bicycle \$(\d+)\\%\$ above.*discount of \$(\d+)\\%\$.*profit of ₹\$([\d{},]+)\$/);
    if (m) {
      const [a, d, G] = [Number(m[1]), Number(m[2]), num(m[3])], sols = [];
      // Follow every whole-rupee cost price through the shop, in paise × 100.
      for (let CP = 1; CP <= 100000; CP++) if (CP * (100 + a) * (100 - d) - CP * 10000 === G * 10000) sols.push(CP);
      return unique(sols, q);
    }
    m = p.match(/rose by \$(\d+)\\%\$.*fell by \$(\d+)\\%\$.*now has \$([\d{},]+)\$ members/);
    if (m) {
      const [a, b, F] = [Number(m[1]), Number(m[2]), num(m[3])], sols = [];
      for (let O = 1; O <= 200000; O++) { const mid = (O * (100 + a)) / 100; if ((mid * (100 - b)) / 100 === F) sols.push(O); }
      return unique(sols, q);
    }
    m = p.match(/ratio of boys to girls who sat an examination was \$(\d+) : (\d+)\$\. Of the boys, \$(\d+)\\%\$ passed, and of the girls, \$(\d+)\\%\$ passed\. Altogether \$(\d+)\$/);
    if (!m) return ['could not read the situation'];
    const [a, b, x, y, P] = m.slice(1).map(Number), sols = [];
    for (let boys = 1; boys <= 5000; boys++) {
      if ((boys * b) % a) continue;
      const girls = (boys * b) / a;
      if ((boys * x + girls * y) === 100 * P) sols.push(boys + girls);
    }
    return unique(sols, q);
  },
  'c8-gst-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/is marked ₹\$([\d{},]+)\$\. The shop gives a \$(\d+)\\%\$ discount, and then GST at \$(\d+)\\%\$/);
    if (m) {
      const [M, d, g] = [num(m[1]), Number(m[2]), Number(m[3])];
      // Work in hundredths of a paisa (BigInt) so nothing is rounded.
      const disc = BigInt(M) * 10000n * BigInt(100 - d) / 100n;
      const bill = disc + disc * BigInt(g) / 100n;
      return keyIs(q, Number(bill) / 10000);
    }
    m = p.match(/is ₹\$([\d.]+)\$, which includes GST at \$(\d+)\\%\$/);
    if (m) {
      const billPaise = Math.round(Number(m[1]) * 100), g = Number(m[2]), sols = [];
      for (let base = 1; base <= 100000; base++) if (base * (100 + g) === billPaise) sols.push(base);
      return unique(sols, q);
    }
    m = p.match(/went up from ₹\$([\d{},]+)\$ to ₹\$([\d{},]+)\$/);
    if (!m) return ['could not read the prices'];
    const [A, B] = [num(m[1]), num(m[2])];
    const v = ((B - A) / B) * 100;
    return close(v, q.answer.value, 1e-12) ? [] : [`fall ${v} vs ${q.answer.value}`];
  },
  'c8-like-terms-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/^What must be subtracted from \$([^$]+)\$ to get \$([^$]+)\$\? Give (?:the coefficient of \$([^$]+)\$|the constant term)/);
    if (m) {
      const P = parsePoly(m[1]), Qp = parsePoly(m[2]);
      if (!P || !Qp) return ['could not read the expressions'];
      const key = m[3] ? keyOf(m[3]) : '';
      // E is what makes P − E = Q: search the coefficient.
      const sols = [];
      for (let e = -100; e <= 100; e++) if ((P.get(key) || 0) - e === (Qp.get(key) || 0)) sols.push(e);
      return unique(sols, q);
    }
    m = p.match(/^From the sum of \$([^$]+)\$ and \$([^$]+)\$, subtract \$([^$]+)\$\..*when \$x = (-?\d+)\$ and \$y = (-?\d+)\$/);
    if (!m) return ['could not read the expressions'];
    const [A, B, C] = [m[1], m[2], m[3]].map(parsePoly);
    if (!A || !B || !C) return ['could not parse'];
    const env = { x: Number(m[4]), y: Number(m[5]) };
    return keyIs(q, evalPoly(A, env) + evalPoly(B, env) - evalPoly(C, env));
  },
  'c8-monomial-product-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/^Simplify \$(-?\d*)([a-z^\d]+)\(([^)]+)\) ([+-]) (\d*)([a-z^\d]+)\(([^)]+)\)\$\. What is the coefficient of \$([^$]+)\$/);
    if (m) {
      const c1 = m[1] === '' ? 1 : m[1] === '-' ? -1 : Number(m[1]);
      const c2 = (m[4] === '-' ? -1 : 1) * (m[5] === '' ? 1 : Number(m[5]));
      const M1 = new Map([[keyOf(m[2]), c1]]), M2 = new Map([[keyOf(m[6]), c2]]);
      const P1 = parsePoly(m[3]), P2 = parsePoly(m[7]);
      if (!P1 || !P2) return ['could not parse the brackets'];
      const prod = mulPoly(M1, P1);
      for (const [k, c] of mulPoly(M2, P2)) prod.set(k, (prod.get(k) || 0) + c);
      // Cross-check numerically at a point.
      const env = { x: 1.7, y: -0.6 };
      const direct = c1 * evalKey(keyOf(m[2]), env) * evalPoly(P1, env) + c2 * evalKey(keyOf(m[6]), env) * evalPoly(P2, env);
      if (!close(direct, evalPoly(prod, env), 1e-9)) return ['expansion does not match at a test point'];
      return keyIs(q, prod.get(keyOf(m[8])) || 0);
    }
    m = p.match(/length \$(\d+)ab\^2\$, breadth \$(\d+)a\^2c\$ and height \$(\d+)bc\$.*\$a = (\d+)\$, \$b = (\d+)\$ and \$c = (\d+)\$/);
    if (!m) return ['could not read the cuboid'];
    const [L, B, H, a, b, c] = m.slice(1).map(Number);
    return keyIs(q, L * a * b * b * (B * a * a * c) * (H * b * c));
  },
  'c8-area-decomposition-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/area of a quadrilateral field \$ABCD\$ is \$([\d{},]+)\$ m².*diagonal \$AC\$ is \$(\d+)\$ m.*from \$B\$ to \$AC\$ is \$(\d+)\$ m/);
    if (m) {
      const [S, d, h1] = [num(m[1]), Number(m[2]), Number(m[3])], sols = [];
      for (let h = 1; h <= 2000; h++) if (d * h1 + d * h === 2 * S) sols.push(h);   // two triangles, doubled
      return unique(sols, q);
    }
    m = p.match(/area of \$([\d.]+)\$ m² and its parallel sides are \$(\d+)\$ m apart\. One parallel side is \$(\d+)\$ m longer/);
    if (m) {
      const S2 = Math.round(Number(m[1]) * 2), h = Number(m[2]), e = Number(m[3]), sols = [];
      for (let a = 1; a <= 500; a++) if ((a + a + e) * h === S2) sols.push(a + e);
      return unique(sols, q);
    }
    m = p.match(/Each side of a rhombus is \$(\d+)\$ cm and one of its diagonals is \$(\d+)\$ cm/);
    if (!m) return ['could not read the figure'];
    const s = Number(m[1]), d = Number(m[2]);
    // Coordinates: diagonals on the axes; height = distance between opposite sides.
    const half = Math.sqrt(s * s - (d / 2) ** 2);
    const A = [d / 2, 0], B = [0, half], C = [-d / 2, 0];
    // Distance from C to the line AB.
    const h = Math.abs((B[0] - A[0]) * (A[1] - C[1]) - (A[0] - C[0]) * (B[1] - A[1])) / Math.hypot(B[0] - A[0], B[1] - A[1]);
    return close(h, q.answer.value, 1e-9) ? [] : [`height ${h} vs ${q.answer.value}`];
  },
  'c8-surface-area-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/is \$(\d+)\$ m long, \$(\d+)\$ m wide and \$(\d+)\$ m high.*door \$(\d+)\$ m × \$(\d+)\$ m and a window \$(\d+)\$ m × \$(\d+)\$ m\. Painting costs ₹\$(\d+)\$/);
    if (m) {
      const [L, B, H, d1, d2, w1, w2, r] = m.slice(1).map(Number);
      const faces = [L * H, L * H, B * H, B * H, L * B];          // four walls and the ceiling, face by face
      return keyIs(q, (faces.reduce((s, f) => s + f, 0) - d1 * d2 - w1 * w2) * r);
    }
    m = p.match(/closed cylindrical tank is \$([\d{},]+)\$ m² and the radius of its base is \$(\d+)\$ m/);
    if (m) {
      const [T, r] = [num(m[1]), Number(m[2])], sols = [];
      for (let h = 1; h <= 1000; h++) if (2 * 22 * r * r + 2 * 22 * r * h === 7 * T) sols.push(h);   // two ends + curved, ×7
      return unique(sols, q);
    }
    m = p.match(/total surface area \$([\d{},]+)\$ cm²\. Its length is \$(\d+)\$ cm and its breadth is \$(\d+)\$ cm/);
    if (!m) return ['could not read the solid'];
    const [T, l, b] = [num(m[1]), Number(m[2]), Number(m[3])], sols = [];
    for (let h = 1; h <= 1000; h++) if (2 * l * b + 2 * b * h + 2 * l * h === T) sols.push(h);
    return unique(sols, q);
  },
  'c8-exponent-laws-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/\\dfrac\{(\d+)\}\{(\d+)\}\\right\)\^\{(-?\d+)\} \\times \\left\(\\dfrac\{\d+\}\{\d+\}\\right\)\^\{(-?\d+)\} = \\left\(\\dfrac\{\d+\}\{\d+\}\\right\)\^\{2m(?: ([+-]) (\d+))?\}/);
    if (m) {
      const base = Number(m[1]) / Number(m[2]);
      const a = Number(m[3]), b = Number(m[4]), c = m[5] ? (m[5] === '-' ? 1 : -1) * Number(m[6]) : 0;
      const lhs = base ** a * base ** b, sols = [];
      for (let k = -60; k <= 60; k++) if (close(lhs, base ** (2 * k - c), 1e-9)) sols.push(k);
      return unique(sols, q);
    }
    m = p.match(/\\left\((\d+)\^\{-1\} ([+-]) (\d+)\^\{-1\}\\right\)\^\{-1\}/);
    if (!m) return ['could not read the expression'];
    const a = Number(m[1]), b = Number(m[3]);
    const v = 1 / (m[2] === '+' ? 1 / a + 1 / b : 1 / a - 1 / b);
    return close(v, q.answer.value, 1e-9) ? [] : [`${v} vs ${q.answer.value}`];
  },
  'c8-standard-form-reasoning'(q) {
    const p = q.prompt;
    // BigInt place value: a decimal × 10^e as an integer count of 10^-12.
    const big = (d, e) => {
      const [w, f = ''] = d.split('.');
      const digits = BigInt(w + f);
      const shift = e - f.length + 12;
      return shift >= 0 ? digits * 10n ** BigInt(shift) : null;
    };
    let m = p.match(/is \$([\d.]+) \\times 10\^\{(-?\d+)\}\$ cm thick\. A stack is made of \$([\d.]+) \\times 10\^\{(-?\d+)\}\$/);
    if (m) {
      const t = big(m[1], Number(m[2])), n = big(m[3], Number(m[4]));
      if (t === null || n === null) return ['out of range'];
      const prod = (t * n) / 10n ** 12n;                 // still in units of 10^-12
      const v = Number(prod) / 1e12;
      return close(v, q.answer.value, 1e-12) ? [] : [`stack ${v} vs ${q.answer.value}`];
    }
    m = p.match(/\$([\d.]+) \\times 10\^\{(\d+)\}\$ [^$]+\$([\d.]+) \\times 10\^\{(\d+)\}\$.*c \\times 10\^\{(\d+)\}/);
    if (!m) return ['could not read the quantities'];
    const sum = big(m[1], Number(m[2])) + big(m[3], Number(m[4]));
    const n = Number(m[5]);
    const scale = 10n ** BigInt(n + 12);
    // c = sum / 10^n, read digit by digit.
    const whole = sum / scale, rest = sum % scale;
    if (whole < 1n || whole > 9n) return ['the total is not c × 10^n with 1 ≤ c < 10'];
    const c = Number(whole) + Number(rest) / Number(scale);
    return close(c, q.answer.value, 1e-12) ? [] : [`c = ${c} vs ${q.answer.value}`];
  },
  'c8-direct-proportion-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/travels \$(\d+)\$ km on \$(\d+)\$ litres.*costs ₹\$([\d.]+)\$ per litre.*journey of \$(\d+)\$ km/);
    if (m) {
      const [D1, L1, price, D2] = [Number(m[1]), Number(m[2]), Math.round(Number(m[3]) * 100), Number(m[4])];
      // Cross-multiplication: litres = D2 × L1 / D1.
      if ((D2 * L1) % D1) return ['petrol is not a whole number of litres'];
      return keyIs(q, ((D2 * L1) / D1) * price / 100);
    }
    m = p.match(/packs \$(\d+)\$ packets of biscuits in \$(\d+)\$ minutes.*in \$(\d+)\$ hours/);
    if (m) {
      const [N1, t1, H] = m.slice(1).map(Number);
      // Packets per hour first, then hours: N1 × (60 / t1) × H, searched as a whole number.
      const sols = [];
      for (let k = 1; k <= 100000; k++) if (k * t1 === N1 * 60 * H) sols.push(k);
      return unique(sols, q);
    }
    m = p.match(/pole \$([\d.]+)\$ m high casts a shadow \$([\d.]+)\$ m long.*tree casts a shadow \$([\d.]+)\$ m/);
    if (!m) return ['could not read the situation'];
    const [h1, s1, s2] = m.slice(1).map(Number);
    return close((s2 / s1) * h1, q.answer.value, 1e-9) ? [] : [`tree ${(s2 / s1) * h1} vs ${q.answer.value}`];
  },
  'c8-inverse-proportion-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/^\$(\d+)\$ workers can build .* in \$(\d+)\$ days\. After \$(\d+)\$ days of work, \$(\d+)\$ more workers/);
    if (m) {
      const [W, D, k, extra] = m.slice(1).map(Number);
      // Simulate: the job is W·D units; W units a day for k days, then W + extra a day.
      let left = W * D - W * k, days = 0;
      while (left > 0) { left -= W + extra; days++; }
      return left === 0 ? keyIs(q, days) : ['the remaining work does not end on a whole day'];
    }
    m = p.match(/enough food for \$(\d+)\$ people for \$(\d+)\$ days\. After \$(\d+)\$ days, \$(\d+)\$ people (leave|arrive)/);
    if (m) {
      const [Np, D, k, M] = m.slice(1, 5).map(Number);
      const people = m[5] === 'leave' ? Np - M : Np + M;
      let food = Np * D - Np * k, days = 0;
      while (food > 0) { food -= people; days++; }
      return food === 0 ? keyIs(q, days) : ['the food does not end on a whole day'];
    }
    m = p.match(/takes \$(\d+)\$ hours to reach a town when it travels at \$(\d+)\$ km\/h.*\$(\d+)\$ hours? sooner/);
    if (!m) return ['could not read the situation'];
    const [T, v, h] = m.slice(1).map(Number), sols = [];
    for (let inc = 1; inc <= 1000; inc++) if ((v + inc) * (T - h) === v * T) sols.push(inc);
    return unique(sols, q);
  },
  'c8-common-factor-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/^By regrouping, factorise \$([^$]+)\$ in the form/);
    if (m) {
      const P = parsePoly(m[1]);
      if (!P) return ['could not read the expression'];
      const sols = [];
      for (let a = 1; a <= 30; a++) for (let b = 1; b <= 30; b++) for (let c = 1; c <= 30; c++) for (let d = 1; d <= 30; d++) {
        if ((P.get('x1y1') || 0) === a * c && (P.get('x1') || 0) === a * d && (P.get('y1') || 0) === b * c && (P.get('') || 0) === b * d && P.size === 4) sols.push(a + b + c + d);
      }
      const set = [...new Set(sols)];
      return sols.length === 1 ? keyIs(q, sols[0]) : [`${sols.length} factorisations (${set})`];
    }
    m = p.match(/^Factorise \$([^$]+)\$ by taking out the highest common factor.*\$x = (-?\d+)\$ and \$y = (-?\d+)\$/);
    if (!m) return ['could not read the expression'];
    const P = parsePoly(m[1]);
    if (!P) return ['could not parse'];
    const env = { x: Number(m[2]), y: Number(m[3]) };
    const keys = [...P.keys()];
    const g = [...P.values()].reduce((s, c) => gcd(s, c), 0);
    const pw = v => Math.min(...keys.map(k => Number(k.match(new RegExp(`${v}(\\d+)`))?.[1] || 0)));
    const hcfValue = g * env.x ** pw('x') * env.y ** pw('y');
    if (!hcfValue) return ['the HCF vanishes at the point'];
    return keyIs(q, evalPoly(P, env) / hcfValue);
  },
  'c8-identity-factorisation-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/^\$x\^2 \+ kx \+ (\d+)\$ factorises as \$\(x \+ a\)\(x \+ b\)\$.*\$b - a = (\d+)\$/);
    if (m) {
      const [c, D] = [Number(m[1]), Number(m[2])], sols = [];
      for (let a = 1; a <= c; a++) for (let b = 1; b <= c; b++) if (a * b === c && b - a === D) sols.push(a + b);
      return unique(sols, q);
    }
    m = p.match(/^\$Kx\^2 \+ (\d+)x \+ (\d+)\$ is a perfect square of the form \$\(px \+ (\d+)\)\^2\$/);
    if (m) {
      const [B, C, r] = m.slice(1).map(Number), sols = [];
      if (r * r !== C) return ['constant is not r squared'];
      for (let pp = 1; pp <= 100; pp++) if (2 * pp * r === B) sols.push(pp * pp);
      return unique(sols, q);
    }
    m = p.match(/^\$(\d+)x\^2 - kxy \+ (\d+)y\^2\$ is a perfect square/);
    if (!m) return ['could not read the expression'];
    const [A, C] = [Number(m[1]), Number(m[2])], sols = [];
    // (ux − vy)² for every u, v > 0.
    for (let u = 1; u <= 50; u++) for (let v = 1; v <= 50; v++) if (u * u === A && v * v === C) sols.push(2 * u * v);
    return unique(sols, q);
  },
  'c8-line-graph-reasoning'(q) {
    const p = q.prompt;
    let rows = [...p.matchAll(/(\d+ [ap]\.m\.|12 noon): [A-Z][a-z]+ \$(\d+)\$, [A-Z][a-z]+ \$(-?\d+)\$/g)].map(m => [Number(m[2]), Number(m[3])]);
    if (rows.length) {
      const startLabel = p.match(/how many minutes after (\d+ [ap]\.m\.|12 noon) do they cross/)?.[1];
      const labels = [...p.matchAll(/(\d+ [ap]\.m\.|12 noon): /g)].map(m => m[1]);
      const i0 = labels.indexOf(startLabel);
      // Scan every minute of the day.
      const crossings = [];
      for (let t = 0; t < (rows.length - 1) * 60; t++) {
        const i = Math.floor(t / 60), f = (t % 60) / 60;
        const g = (rows[i][0] + f * (rows[i + 1][0] - rows[i][0])) - (rows[i][1] + f * (rows[i + 1][1] - rows[i][1]));
        if (Math.abs(g) < 1e-9) crossings.push(t);
      }
      const signs = rows.map(([a, b]) => Math.sign(a - b));
      const changes = signs.slice(1).filter((s, i) => s !== signs[i]).length;
      if (changes !== 1 || signs.includes(0)) return ['the graphs do not cross exactly once between readings'];
      if (crossings.length !== 1) return [`${crossings.length} whole-minute crossings`];
      return keyIs(q, crossings[0] - 60 * i0);
    }
    const vals = [...p.matchAll(/(?:\d+ [ap]\.m\.|12 noon) \$(\d+)\$/g)].map(m => Number(m[1]));
    const at = p.match(/what was the level at (\d+)(?::(\d+))? ([ap])\.m\./);
    if (vals.length !== 5 || !at) return ['could not read the readings'];
    let hour = Number(at[1]) % 12 + (at[3] === 'p' ? 12 : 0);
    const minutes = hour * 60 + Number(at[2] || 0) - 6 * 60;      // after 6 a.m.
    const i = Math.floor(minutes / 120), f = (minutes % 120) / 120;
    return keyIs(q, vals[i] + f * (vals[i + 1] - vals[i]));
  },
  'c8-plotting-reasoning'(q) {
    const p = q.prompt;
    const pt = name => { const m = p.match(new RegExp(`${name}\\((-?\\d+), (-?\\d+)\\)`)); return m ? [Number(m[1]), Number(m[2])] : null; };
    const A = pt('A'), B = pt('B'), C = pt('C');
    if (A && B && C) {
      const sols = [];
      for (let x = -40; x <= 40; x++) for (let y = -40; y <= 40; y++) {
        // Diagonals AC and BD bisect each other.
        if (A[0] + C[0] === B[0] + x && A[1] + C[1] === B[1] + y) sols.push([x, y]);
      }
      if (sols.length !== 1) return [`${sols.length} positions for D`];
      return q.answer.x === sols[0][0] && q.answer.y === sols[0][1] ? [] : [`D = ${sols[0]} vs ${JSON.stringify(q.answer)}`];
    }
    const pts = [...p.matchAll(/\$(\d+)\$ km — ₹\$(\d+)\$/g)].map(m => [Number(m[1]), Number(m[2])]);
    const Y = num(p.match(/the fare ₹\$([\d{},]+)\$\?/)?.[1] ?? NaN);
    if (pts.length !== 3) return ['could not read the table'];
    const [[x0, y0], [x1, y1], [x2, y2]] = pts;
    if ((y1 - y0) * (x2 - x0) !== (y2 - y0) * (x1 - x0)) return ['the table is not a straight line'];
    const sols = [];
    for (let d = 0; d <= 1000; d++) if (y0 * (x1 - x0) + (d - x0) * (y1 - y0) === Y * (x1 - x0)) sols.push(d);
    return unique(sols, q);
  }
};

const n = q => q.answer.value;
const without = (q, list) => [...new Set(list.filter(v => Number.isFinite(v) && !close(v, n(q))).map(v => String(Number(v.toFixed(6)))))];

export const NEAR_MISS = {
  'c8-exterior-angle-reasoning': q => without(q, [180 - n(q), 360 - n(q), n(q) - 2]),
  'c8-quadrilateral-property-reasoning': q => without(q, [180 - n(q), 2 * n(q), 90 - n(q)]),
  'c8-bar-graph-reasoning': q => without(q, [n(q) + 2, n(q) - 2, 2 * n(q)]),
  'c8-pie-chart-reasoning': q => without(q, [n(q) / 2, n(q) * 2, n(q) + 100]),
  'c8-square-pattern-reasoning': q => without(q, [n(q) + 2, n(q) - 2, n(q) * n(q)]),
  'c8-square-root-reasoning': q => without(q, [n(q) * n(q), n(q) + 2, n(q) - 2]),
  'c8-cube-pattern-reasoning': q => without(q, [n(q) + 2, n(q) - 2, n(q) ** 3]),
  'c8-cube-multiplier-reasoning': q => without(q, [n(q) ** 3, n(q) * n(q), n(q) + 2]),
  'c8-percentage-reasoning': q => without(q, [n(q) + 100, n(q) - 100, n(q) * 1.1]),
  'c8-gst-reasoning': q => without(q, [n(q) + 0.01, n(q) - 0.01, n(q) * 1.18, Math.round(n(q))]),
  'c8-like-terms-reasoning': q => without(q, [-n(q), n(q) + 2, n(q) - 2]),
  'c8-monomial-product-reasoning': q => without(q, [-n(q), n(q) + 2, n(q) - 2]),
  'c8-area-decomposition-reasoning': q => without(q, [n(q) * 2, n(q) / 2, n(q) + 0.1]),
  'c8-surface-area-reasoning': q => without(q, [n(q) * 2, n(q) + 7, n(q) - 2]),
  'c8-exponent-laws-reasoning': q => without(q, [-n(q), n(q) + 2, 1 / n(q)]),
  'c8-standard-form-reasoning': q => without(q, [n(q) * 100, n(q) / 100, n(q) + 0.001]),
  'c8-direct-proportion-reasoning': q => without(q, [n(q) * 2, n(q) / 2, n(q) + 0.5]),
  'c8-inverse-proportion-reasoning': q => without(q, [n(q) * 2, n(q) + 2, n(q) - 2]),
  'c8-common-factor-reasoning': q => without(q, [-n(q), n(q) + 2, n(q) - 2]),
  'c8-identity-factorisation-reasoning': q => without(q, [n(q) / 2, n(q) * 2, n(q) + 2]),
  'c8-line-graph-reasoning': q => without(q, [60 - n(q), n(q) + 0.5, n(q) * 2]),
  'c8-plotting-reasoning': q => (q.answerType === 'point'
    ? [`(${q.answer.y}, ${q.answer.x})`, `(${-q.answer.x}, ${q.answer.y})`, `(${q.answer.x}, ${-q.answer.y})`].filter(s => s !== `(${q.answer.x}, ${q.answer.y})`)
    : without(q, [n(q) + 2, n(q) - 2, n(q) * 2]))
};
