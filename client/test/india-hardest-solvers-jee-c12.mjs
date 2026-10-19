// Independent solvers for the JEE hardest-level (D4) forms, Class 12. See india-hardest-forms-check.mjs.
//
// Each solver reads its numbers back out of the rendered prompt — never from the
// generator — and re-solves by a different, numeric route (root scans,
// numeric differentiation, Math.asin/acos/atan, simulation), then compares with
// the key. A returned empty list means the key is verified.

const close = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

/** "3", "-4", "\dfrac{3}{5}", "-\dfrac{3}{5}". */
function fr(tex) {
  const t = tex.trim();
  let m = t.match(/^(-?)\\dfrac\{(\d+)\}\{(\d+)\}$/);
  if (m) return (m[1] ? -1 : 1) * Number(m[2]) / Number(m[3]);
  m = t.match(/^-?\d+$/);
  return m ? Number(t) : NaN;
}
/** "3x - 2", "-x", "x + 4" → [a, b]. */
function lin(tex) {
  const m = tex.trim().match(/^(-?)(\d*)x(?: ([+-]) (\d+))?$/);
  if (!m) return null;
  const a = (m[1] ? -1 : 1) * (m[2] === '' ? 1 : Number(m[2]));
  const b = m[3] ? (m[3] === '-' ? -1 : 1) * Number(m[4]) : 0;
  return [a, b];
}
/** A polynomial in x as {power: coefficient}. */
function poly(tex) {
  const P = {};
  const s = tex.replace(/\s+/g, '').replace(/^(?=[^-])/, '+');
  for (const t of s.matchAll(/([+-])(\d*)(x(?:\^(\d+))?)?/g)) {
    if (!t[0] || t[0] === '+' || t[0] === '-') continue;
    const c = (t[1] === '-' ? -1 : 1) * (t[2] === '' ? 1 : Number(t[2]));
    const p = t[3] ? (t[4] ? Number(t[4]) : 1) : 0;
    P[p] = (P[p] || 0) + c;
  }
  return P;
}
const evalP = (P, x) => Object.entries(P).reduce((s, [p, c]) => s + c * x ** Number(p), 0);
function vec(tex) {
  const v = [0, 0, 0];
  const s = tex.replace(/\s+/g, '');
  let used = 0;
  for (const t of s.matchAll(/([+-]?)(\d*)\\hat\{([ijk])\}/g)) {
    v['ijk'.indexOf(t[3])] = (t[1] === '-' ? -1 : 1) * (t[2] === '' ? 1 : Number(t[2]));
    used += t[0].length;
  }
  return used === s.length ? v : null;
}
/** Real roots of g on [a, b] by a sign scan with bisection; skips poles. */
function roots(g, a, b, step, pole = () => false) {
  const out = [];
  let x0 = a + 0.000123457, g0 = g(x0);
  for (let x1 = x0 + step; x1 <= b; x1 += step) {
    const g1 = g(x1);
    if (Number.isFinite(g0) && Number.isFinite(g1) && g0 * g1 <= 0 && !pole(x0, x1)) {
      let lo = x0, hi = x1;
      for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (g(lo) * g(mid) <= 0) hi = mid; else lo = mid; }
      out.push((lo + hi) / 2);
    }
    x0 = x1; g0 = g1;
  }
  return out;
}

export const SOLVE_JEE_C12 = {
  'c12-composite-inverse-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/f\(x\) = ([^$]+)\$ and \$g\(x\) = x\^3 ([+-]) (\d+)\$\. Find the value of \$\(f \\circ g\)\^\{-1\}\((-?\d+)\)\$/);
    if (m) {
      const [a, b] = lin(m[1]) || [];
      if (a === undefined) return ['could not read f'];
      const c = (m[2] === '-' ? -1 : 1) * Number(m[3]), V = Number(m[4]);
      const rs = roots(x => a * (x ** 3 + c) + b - V, -60, 60, 0.01);
      return rs.length === 1 && close(rs[0], q.answer.value, 1e-7) ? [] : [`roots ${rs} vs ${q.answer.value}`];
    }
    m = p.match(/f\(x\) = \\dfrac\{([^}]+)\}\{([^}]+)\}\$ for .*g\(x\) = ([^$]+)\$\. Find the value of \$\(g \\circ f\)\^\{-1\}\\left\((.+)\\right\)\$\.$/);
    if (!m) return ['could not read the functions'];
    const N = lin(m[1]), D = lin(m[2]), G = lin(m[3]), V = fr(m[4]);
    if (!N || !D || !G || !Number.isFinite(V)) return ['could not parse'];
    const f = x => (N[0] * x + N[1]) / (D[0] * x + D[1]);
    const pole = (x0, x1) => Math.sign(D[0] * x0 + D[1]) !== Math.sign(D[0] * x1 + D[1]);
    const rs = roots(x => G[0] * f(x) + G[1] - V, -60, 60, 0.01, pole);
    return rs.length === 1 && close(rs[0], q.answer.value, 1e-7) ? [] : [`roots ${rs} vs ${q.answer.value}`];
  },
  'c12-inverse-trig-branch-reasoning'(q) {
    const m = q.prompt.match(/^The value of \$(.+)\$ can be written as \$k\\pi\$\. Find \$k\$\.$/);
    if (!m) return ['could not read the expression'];
    const INV = { sin: x => Math.asin(Math.sin(x)), cos: x => Math.acos(Math.cos(x)), tan: x => Math.atan(Math.tan(x)) };
    let total = 0, n = 0;
    for (const t of m[1].matchAll(/\\(sin|cos|tan)\^\{-1\}\\left\(\\(sin|cos|tan) (?:\\left\()?(-?)\\dfrac\{(\d*)\\pi\}\{(\d+)\}/g)) {
      if (t[1] !== t[2]) return ['mismatched ratio'];
      const th = (t[3] ? -1 : 1) * (t[4] === '' ? 1 : Number(t[4])) * Math.PI / Number(t[5]);
      total += INV[t[1]](th) / Math.PI;
      n++;
    }
    if (n < 1) return ['no terms read'];
    return close(total, q.answer.value, 1e-9) ? [] : [`Math gives ${total} vs ${q.answer.value}`];
  },
  'c12-inverse-trig-evaluate-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/\\tan\\left\(2\\tan\^\{-1\}\\left\((.+?)\\right\) ([+-]) \\tan\^\{-1\}\\left\((.+?)\\right\)\\right\)\$\.$/);
    if (m) {
      const a = fr(m[1]), b = fr(m[3]), s = m[2] === '-' ? -1 : 1;
      const v = Math.tan(2 * Math.atan(a) + s * Math.atan(b));
      return close(v, q.answer.value, 1e-8) ? [] : [`Math gives ${v} vs ${q.answer.value}`];
    }
    m = p.match(/\\(sin|cos)\\left\(\\cos\^\{-1\}\\left\((.+?)\\right\) ([+-]) \\tan\^\{-1\}\\left\((.+?)\\right\)\\right\)\$\.$/);
    if (!m) return ['could not read the expression'];
    const ang = Math.acos(fr(m[2])) + (m[3] === '-' ? -1 : 1) * Math.atan(fr(m[4]));
    const v = m[1] === 'sin' ? Math.sin(ang) : Math.cos(ang);
    return close(v, q.answer.value, 1e-9) ? [] : [`Math gives ${v} vs ${q.answer.value}`];
  },
  'c12-continuity-test-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/f\(x\) = \\left\|([^|]+)\\right\| \+ (\d*)\\left\|([^|]+)\\right\|\$\. How many points of the open interval \$\((-?\d+), (-?\d+)\)\$/);
    if (m) {
      const P = poly(m[1]), c = m[2] === '' ? 1 : Number(m[2]), Lp = poly(m[3]);
      const L = Number(m[4]), R = Number(m[5]);
      const f = x => Math.abs(evalP(P, x)) + c * Math.abs(evalP(Lp, x));
      // A kink test at every point of a fine grid that passes through every
      // integer and every thousandth exactly.
      const h = 1e-6;
      let count = 0;
      const n = (R - L) * 1000;
      for (let i = 1; i < n; i++) {
        const x = L + i / 1000;
        const jump = (f(x + h) - f(x)) / h - (f(x) - f(x - h)) / h;
        if (Math.abs(jump) > 1e-2) count++;
      }
      return count === q.answer.value ? [] : [`grid finds ${count} corners vs ${q.answer.value}`];
    }
    m = p.match(/\\dfrac\{1 - \\cos (\d+)x\}\{x\^2\}\$ for \$x < 0\$, \$f\(0\) = a\$, and \$f\(x\) = \\dfrac\{\\tan \(?(-?\d*)x\)?\}\{x\} \+ b\$ for \$x > 0\$ is continuous at \$x = 0\$\. Find the value of \$(a \+ b|b)\$/);
    if (!m) return ['could not read f'];
    const pk = Number(m[1]), qk = m[2] === '' ? 1 : m[2] === '-' ? -1 : Number(m[2]);
    const left = x => (1 - Math.cos(pk * x)) / (x * x), right = x => Math.tan(qk * x) / x;
    const rich = (g, h) => (4 * g(h / 2) - g(h)) / 3;
    const a = rich(left, -1e-3), b = a - rich(right, 1e-3);
    const v = m[3] === 'b' ? b : a + b;
    return close(v, q.answer.value, 1e-6) ? [] : [`limits give ${v} vs ${q.answer.value}`];
  },
  'c12-rate-approximation-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/with \$y = (\\sqrt\[3\]\{x\}|\\sqrt\{x\})\$, \$x = (\d+)\$ and \$\\Delta x = (-?[0-9.]+)\$, find the approximate value of \$(?:\\sqrt\[3\]|\\sqrt)\{([0-9.]+)\}\$/);
    if (m) {
      const f = m[1].includes('[3]') ? Math.cbrt : Math.sqrt;
      const x = Number(m[2]), dx = Number(m[3]);
      if (!close(x + dx, Number(m[4]), 1e-12)) return ['x + Δx does not match the radicand'];
      const h = 1e-5;
      const v = f(x) + ((f(x + h) - f(x - h)) / (2 * h)) * dx;
      return close(v, q.answer.value, 1e-8) ? [] : [`numeric differential ${v} vs ${q.answer.value}`];
    }
    m = p.match(/volume increases at \$(\d+)\$ cm³\/s\. How fast, in cm²\/s, is its surface area increasing at the instant its radius is \$(\d+)\$ cm/);
    if (!m) return ['could not read the situation'];
    const Vp = Number(m[1]), r = Number(m[2]);
    const S = t => 4 * Math.PI * Math.cbrt(r ** 3 + (3 * Vp * t) / (4 * Math.PI)) ** 2;
    const dt = 1e-5;
    const v = (S(dt) - S(-dt)) / (2 * dt);
    return close(v, q.answer.value, 1e-6) ? [] : [`simulation ${v} vs ${q.answer.value}`];
  },
  'c12-monotonic-tangent-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/^Find the (least|greatest) value of \$k\$ for which \$f\(x\) = (.+?) \+ kx(?: ([+-]) (\d+))?\$ is (increasing|decreasing) on/);
    if (m) {
      const P = poly(m[2]);
      const sign = m[5] === 'increasing' ? 1 : -1;
      // sign·f'(x) ≥ 0 for all x; find the boundary k by bisection, the
      // minimum of sign·f' taken by a ternary search on numeric derivatives.
      const minDeriv = k => {
        const g = x => sign * ((evalP(P, x + 1e-5) - evalP(P, x - 1e-5)) / 2e-5 + k);
        let lo = -100, hi = 100;
        for (let i = 0; i < 200; i++) { const a = lo + (hi - lo) / 3, b = hi - (hi - lo) / 3; if (g(a) < g(b)) hi = b; else lo = a; }
        return g((lo + hi) / 2);
      };
      let lo = -200, hi = 200; // ok(k) is monotone in k: true on one side.
      const ok = k => minDeriv(k) >= 0;
      if (sign > 0) { for (let i = 0; i < 100; i++) { const mid = (lo + hi) / 2; if (ok(mid)) hi = mid; else lo = mid; } }
      else { for (let i = 0; i < 100; i++) { const mid = (lo + hi) / 2; if (ok(mid)) lo = mid; else hi = mid; } }
      const v = (lo + hi) / 2;
      return close(v, q.answer.value, 1e-5) ? [] : [`bisection ${v} vs ${q.answer.value}`];
    }
    m = p.match(/^Find the \$(x|y)\$-intercept of the (normal|tangent) to the curve \$y = ([^$]+)\$ at the point where \$x = (-?\d+)\$\.$/);
    if (!m) return ['could not read the curve'];
    const P = poly(m[3]), x0 = Number(m[4]), y0 = evalP(P, x0);
    const slope = (evalP(P, x0 + 1e-6) - evalP(P, x0 - 1e-6)) / 2e-6;
    const s = m[2] === 'tangent' ? slope : -1 / slope;
    const v = m[1] === 'y' ? y0 - s * x0 : x0 - y0 / s;
    return close(v, q.answer.value, 1e-6) ? [] : [`numeric line ${v} vs ${q.answer.value}`];
  },
  'c12-vector-direction-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/\\vec\{a\} = ([^$]+)\$ and \$\\vec\{b\} = ([^$]+)\$, and let \$\\vec\{c\} = \\hat\{a\} \+ \\hat\{b\}\$.*?(Find \$\|\\vec\{c\}\|\^2\$|Find the \$\\hat\{([ijk])\}\$ component)/);
    if (m) {
      const a = vec(m[1]), b = vec(m[2]);
      if (!a || !b) return ['could not read the vectors'];
      const la = Math.hypot(...a), lb = Math.hypot(...b);
      const c = a.map((x, i) => x / la + b[i] / lb);
      const v = m[4] ? c['ijk'.indexOf(m[4])] : c.reduce((s, x) => s + x * x, 0);
      return close(v, q.answer.value, 1e-9) ? [] : [`float route ${v} vs ${q.answer.value}`];
    }
    m = p.match(/magnitude \$(\d+)\$\. The cosines of the angles it makes with the \$x\$-axis and the \$y\$-axis are \$([^$]+)\$ and \$([^$]+)\$, and it makes an acute angle with the \$z\$-axis/);
    if (!m) return ['could not read the vector'];
    const M = Number(m[1]), l = fr(m[2]), mm = fr(m[3]);
    const n2 = 1 - l * l - mm * mm;
    if (!(n2 > 0)) return ['no acute angle possible'];
    const v = M * Math.sqrt(n2);
    return close(v, q.answer.value, 1e-9) ? [] : [`float route ${v} vs ${q.answer.value}`];
  }
};
