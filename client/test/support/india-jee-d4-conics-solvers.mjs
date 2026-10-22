// ─────────────────────────────────────────────────────────────────────────────
// Independent solvers for the JEE D4 Conic Sections forms
// (client/src/engine/generators/india-class11-jee-d4-conics.js).
//
// Nothing here imports the generator. Each solver reads the numbers back out
// of the rendered prompt and re-solves by a different route from the one the
// generator and its worked steps use:
//
//   · circle through three points — the circumcentre by Cramer's rule on the
//     perpendicular-bisector equations, checked against all three points,
//     then the chord by substituting the line into the circle;
//   · chords and tangents — the line substituted into the circle, the chord
//     from the discriminant of the resulting quadratic; the unknown constant
//     found by an integer scan (which also shows it is unique); the tangent
//     values of k as the roots of the discriminant, itself a quadratic in k
//     recovered by interpolation, then the side test on each;
//   · parabolas — a from the curvature (how far the curve moves one unit
//     either side of the vertex); every point at the given focal distance
//     found by a scan along the curve, with the area (shoelace) or the
//     distance from the vertex required to agree across them; the focal
//     chord's other end by substituting the line through P and the focus into
//     the general equation; the unknown coefficient by a numeric scan with
//     bisection over t;
//   · ellipses and hyperbolas — a² as the root of the standard-form equation
//     through the given point (bisection, not the focal-distance definition);
//     for the latus-rectum ratio, a scan over a² with b² fixed by the point
//     and the latus rectum measured as the chord through a focus; confocal
//     curves by bisection on p or by floating-point eccentricities.
//
// Each solver checks that the answer is unique where uniqueness is at stake.
// NEAR_MISS lists answers a student could plausibly write that must be marked
// WRONG (fed to the real marker by the forms check).
// ─────────────────────────────────────────────────────────────────────────────

const close = (x, y, tol = 1e-9) => Math.abs(x - y) <= tol * Math.max(1, Math.abs(x), Math.abs(y));
/** Integer key: the solved value must round to it and be that integer. */
function keyInt(q, v, label) {
  const k = q.answer.value;
  if (!Number.isFinite(v)) return [`${label}: solved ${v}`];
  if (!Number.isInteger(k)) return [`${label}: key ${k} is not whole`];
  return Math.abs(v - k) < 1e-7 ? [] : [`${label}: solved ${v} vs keyed ${k}`];
}
/** Any numeric key: whole, or an exact simplest fraction, equal to the solved value. */
function keyExact(q, v, label) {
  const a = q.answer;
  if (!Number.isFinite(v)) return [`${label}: solved ${v}`];
  const f = a.simplestFraction;
  if (!Number.isInteger(a.value) && !(f && Number.isInteger(f.n) && Number.isInteger(f.d) && f.d > 1 && close(f.n / f.d, a.value, 1e-15))) return [`${label}: key ${a.value} is neither whole nor an exact fraction`];
  return close(v, a.value, 1e-9) ? [] : [`${label}: solved ${v} vs keyed ${a.value}`];
}

/** "x^2 + y^2 - 6x + 4y + p", "y^2 + 4y + tx + 1" (spaces allowed) → coefficient map; t is the unknown coefficient. */
function parseTerms(tex) {
  const s = String(tex).replace(/\s+/g, '');
  const out = { xx: 0, yy: 0, x: 0, y: 0, c: 0, p: 0, tx: 0, ty: 0 };
  const terms = s.match(/[+-]?[^+-]+/g);
  if (!terms) return null;
  for (const t of terms) {
    const m = t.match(/^([+-]?)(\d*)(x\^2|y\^2|tx|ty|x|y|p)?$/);
    if (!m || (m[2] === '' && !m[3])) return null;
    const v = (m[1] === '-' ? -1 : 1) * (m[2] === '' ? 1 : Number(m[2]));
    const key = { 'x^2': 'xx', 'y^2': 'yy', tx: 'tx', ty: 'ty', x: 'x', y: 'y', p: 'p' }[m[3]] || 'c';
    out[key] += v;
  }
  return out;
}

/** Chord² cut from x² + y² + Dx + Ey + F = 0 by ax + by + c = 0, by substitution; NaN if it misses. */
function chordSquared(D, E, F, a, b, c) {
  if (b !== 0) {
    // y = −(ax + c)/b.
    const A = 1 + (a * a) / (b * b), B = (2 * a * c) / (b * b) + D - (E * a) / b, C = (c * c) / (b * b) - (E * c) / b + F;
    const disc = B * B - 4 * A * C;
    if (disc < 0) return NaN;
    return (disc / (A * A)) * A;            // (x₁ − x₂)²(1 + a²/b²)
  }
  const x = -c / a, disc = E * E - 4 * (x * x + D * x + F);
  return disc < 0 ? NaN : disc;
}

/** Bisection for a sign change of f on [lo, hi]. */
function bisect(f, lo, hi, n = 200) {
  let flo = f(lo);
  for (let i = 0; i < n; i++) {
    const mid = (lo + hi) / 2, fm = f(mid);
    if (fm === 0) return mid;
    if ((fm < 0) === (flo < 0)) { lo = mid; flo = fm; } else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Every root of f in [lo, hi] found by a fine scan plus bisection. */
function scanRoots(f, lo, hi, steps) {
  const out = [];
  let x0 = lo, f0 = f(lo);
  for (let i = 1; i <= steps; i++) {
    const x1 = lo + ((hi - lo) * i) / steps, f1 = f(x1);
    if (Number.isFinite(f0) && Number.isFinite(f1)) {
      if (f0 === 0) out.push(x0);
      else if (f0 * f1 < 0) out.push(bisect(f, x0, x1));
    }
    x0 = x1; f0 = f1;
  }
  return out;
}

/**
 * A parabola w² + Ew + Du + F = 0 (orient 'y2': w = y, u = x) read numerically:
 * u(w) = −(w² + Ew + F)/D. The vertex is where u(w) is extreme (w = −E/2,
 * found by symmetry of u), and a comes from the curvature: u(w_v ± 1) − u_v = 1/(4a).
 */
function parabolaOf(P, orient) {
  const W2 = orient === 'y2' ? P.yy : P.xx, U2 = orient === 'y2' ? P.xx : P.yy;
  const E = orient === 'y2' ? P.y : P.x, D = orient === 'y2' ? P.x : P.y;
  if (W2 !== 1 || U2 !== 0 || D === 0) return null;
  const u = w => -(w * w + E * w + P.c) / D;
  // Symmetry: u(w_v + t) = u(w_v − t); w_v is the midpoint of the two w with u(w) = u(0).
  const wv = -E / 2;
  if (!close(u(wv + 3), u(wv - 3), 1e-12)) return null;
  const uv = u(wv), a = 1 / (4 * (u(wv + 1) - uv));
  const toXY = (uu, ww) => (orient === 'y2' ? [uu, ww] : [ww, uu]);
  return { u, wv, uv, a, focus: [uv + a, wv], toXY, D, E, F: P.c };
}

// ═════════════════════════════════════════════════════════════════════════════

function analyseCircle(q) {
  const p = q.prompt;
  let m = p.match(/^A circle passes through the points \$A\((-?\d+), (-?\d+)\)\$, \$B\((-?\d+), (-?\d+)\)\$ and \$C\((-?\d+), (-?\d+)\)\$\. Find the square of the length of the chord that the line \$(.+?) = 0\$ cuts off from this circle\.$/);
  if (m) {
    const [xa, ya, xb, yb, xc, yc] = m.slice(1, 7).map(Number);
    const L = parseTerms(m[7]);
    if (!L || L.xx || L.yy) return { problems: ['could not read the line'] };
    // Perpendicular bisectors of AB and AC, by Cramer's rule.
    const a1 = 2 * (xb - xa), b1 = 2 * (yb - ya), c1 = xb * xb + yb * yb - xa * xa - ya * ya;
    const a2 = 2 * (xc - xa), b2 = 2 * (yc - ya), c2 = xc * xc + yc * yc - xa * xa - ya * ya;
    const det = a1 * b2 - a2 * b1;
    if (det === 0) return { problems: ['the three points are collinear'] };
    const X = (c1 * b2 - c2 * b1) / det, Y = (a1 * c2 - a2 * c1) / det;
    const r2 = (xa - X) ** 2 + (ya - Y) ** 2;
    if (!close((xb - X) ** 2 + (yb - Y) ** 2, r2) || !close((xc - X) ** 2 + (yc - Y) ** 2, r2)) return { problems: ['circumcentre check failed'] };
    // The chord by substituting the line into x² + y² − 2Xx − 2Yy + (X² + Y² − r²) = 0.
    const ch = chordSquared(-2 * X, -2 * Y, X * X + Y * Y - r2, L.x, L.y, L.c);
    if (!Number.isFinite(ch) || ch <= 0) return { problems: ['the line misses the circle'] };
    return { value: ch, int: true, alts: [ch / 4, 4 * r2, Math.sqrt(ch)] };
  }
  m = p.match(/^The line \$(.+?) = 0\$ cuts off a chord of length \$(\d+)\$ from the circle \$(.+?) = 0\$\. Find \$p\$\.$/);
  if (m) {
    const L = parseTerms(m[1]), C = parseTerms(m[3]), len = Number(m[2]);
    if (!L || !C || C.xx !== 1 || C.yy !== 1 || C.p !== 1 || C.c !== 0) return { problems: ['could not read the line or circle'] };
    const hits = [];
    for (let pc = -600; pc <= 600; pc++) {
      const ch = chordSquared(C.x, C.y, pc, L.x, L.y, L.c);
      if (Number.isFinite(ch) && Math.abs(ch - len * len) < 1e-7) hits.push(pc);
    }
    if (hits.length !== 1) return { problems: [`${hits.length} integer values of p give that chord`] };
    // The chord shrinks as p grows, so no non-integer p can also fit: check monotonicity around the hit.
    const before = chordSquared(C.x, C.y, hits[0] - 0.5, L.x, L.y, L.c), after = chordSquared(C.x, C.y, hits[0] + 0.5, L.x, L.y, L.c);
    if (!(before > len * len && (after < len * len || Number.isNaN(after)))) return { problems: ['the chord is not monotone in p near the root'] };
    const g2f2 = (C.x * C.x + C.y * C.y) / 4;
    return { value: hits[0], int: true, alts: [2 * g2f2 - hits[0]] };
  }
  m = p.match(/^The line \$(.+?) \+ k = 0\$ touches the circle \$(.+?) = 0\$, and the origin and the centre of the circle lie (on the same side|on opposite sides) of the line\. Find \$k\$\.$/);
  if (m) {
    const L = parseTerms(m[1]), C = parseTerms(m[2]);
    if (!L || !C || C.xx !== 1 || C.yy !== 1 || L.c !== 0 || L.y === 0) return { problems: ['could not read the line or circle'] };
    const a = L.x, b = L.y, D = C.x, E = C.y, F = C.c;
    // Substitute y = −(ax + k)/b, times b²: the discriminant in x is a quadratic in k.
    const disc = lam => {
      const A2 = a * a + b * b, B1 = 2 * a * lam + D * b * b - E * a * b, C0 = lam * lam - E * b * lam + F * b * b;
      return B1 * B1 - 4 * A2 * C0;
    };
    const d0 = disc(0), d1 = disc(1), dm = disc(-1);
    const qa = (d1 + dm) / 2 - d0, qb = (d1 - dm) / 2, qc = d0;
    const dd = qb * qb - 4 * qa * qc;
    if (qa === 0 || dd <= 0) return { problems: ['no pair of tangent values'] };
    const lams = [(-qb + Math.sqrt(dd)) / (2 * qa), (-qb - Math.sqrt(dd)) / (2 * qa)];
    const cx = -D / 2, cy = -E / 2;
    const same = m[3] === 'on the same side';
    const keep = lams.filter(l => {
      const atO = l, atC = a * cx + b * cy + l;
      if (atO === 0 || atC === 0) return false;
      return (Math.sign(atO) === Math.sign(atC)) === same;
    });
    if (keep.length !== 1) return { problems: [`${keep.length} tangent values satisfy the side condition`] };
    return { value: keep[0], int: true, alts: [lams.find(l => l !== keep[0]), -(a * cx + b * cy)] };
  }
  return { problems: ['could not read the prompt'] };
}

function analyseParabola(q) {
  const p = q.prompt;
  let m = p.match(/^A point \$P\$ on the parabola \$(.+?) = 0\$ is at a distance \$(\d+)\$ from its focus\. (Find the area of the triangle whose vertices are \$P\$, the focus and the vertex of the parabola\.|Find the square of the distance of \$P\$ from the vertex of the parabola\.)$/);
  if (m) {
    const T = parseTerms(m[1]);
    if (!T) return { problems: ['could not read the parabola'] };
    const orient = T.yy === 1 ? 'y2' : 'x2';
    const par = parabolaOf(T, orient);
    if (!par) return { problems: ['not a parabola of the expected shape'] };
    const ell = Number(m[2]);
    const [fx, fy] = par.toXY(...par.focus), [vx, vy] = par.toXY(par.uv, par.wv);
    // Every point of the curve at distance ℓ from the focus, by a scan along the curve.
    const at = w => par.toXY(par.u(w), w);
    const f = w => { const [x, y] = at(w); return Math.hypot(x - fx, y - fy) - ell; };
    const ws = scanRoots(f, par.wv - 150.0001, par.wv + 150.0003, 300000);
    if (!ws.length) return { problems: ['no point of the parabola is at that distance from the focus'] };
    const area = w => { const [x, y] = at(w); return Math.abs((fx - vx) * (y - vy) - (x - vx) * (fy - vy)) / 2; };
    const vp2 = w => { const [x, y] = at(w); return (x - vx) ** 2 + (y - vy) ** 2; };
    const measure = m[3].startsWith('Find the area') ? area : vp2;
    const vals = ws.map(measure);
    if (vals.some(v => !close(v, vals[0], 1e-7))) return { problems: [`the points give different answers: ${vals.join(', ')}`] };
    return { value: vals[0], int: false, alts: measure === area ? [2 * vals[0], ell * ell] : [ell * ell, Math.sqrt(vals[0])] };
  }
  m = p.match(/^For a non-zero real number \$t\$, the parabola \$(.+?) = 0\$ (opens to the right|opens to the left|opens upwards|opens downwards) and its focus lies on (?:the \$([xy])\$-axis|the line \$([xy]) = (-?\d+)\$)\. Find \$t\$\.$/);
  if (m) {
    const T = parseTerms(m[1]);
    if (!T) return { problems: ['could not read the parabola'] };
    const orient = T.yy === 1 ? 'y2' : 'x2';
    if ((orient === 'y2' ? T.tx : T.ty) !== 1 || T.x * (orient === 'y2' ? 1 : 0) || T.y * (orient === 'x2' ? 1 : 0)) return { problems: ['the t term is not the linear term in the axis variable'] };
    const along = orient === 'y2' ? 'x' : 'y';
    let c0;
    if (m[3]) { if (m[3] === along) return { problems: ['focus line is parallel to the axis'] }; c0 = 0; }
    else { if (m[4] !== along) return { problems: ['focus line is parallel to the axis'] }; c0 = Number(m[5]); }
    const dirWord = m[2];
    if ((orient === 'y2') !== /right|left/.test(dirWord)) return { problems: ['opening direction does not match the axis'] };
    const wantPositive = /right|upwards/.test(dirWord);
    const T0 = { ...T, tx: 0, ty: 0 };
    const focusAt = lam => {
      const P2 = { ...T0, [orient === 'y2' ? 'x' : 'y']: lam };
      const par = parabolaOf(P2, orient);
      return par ? par : null;
    };
    const g = lam => { const par = focusAt(lam); return par ? par.focus[0] - c0 : NaN; };
    // On each side of t = 0 a fine scan finds every sign change of the focus position.
    const roots = [...scanRoots(g, -200, -1e-3, 40000), ...scanRoots(g, 1e-3, 200, 40000)];
    // Opening direction: u grows away from the vertex when a > 0.
    const kept = roots.filter(l => { const par = focusAt(l); return par && ((par.u(par.wv + 1) > par.uv) === wantPositive); });
    if (roots.length !== 2) return { problems: [`${roots.length} values of t put the focus on the line`] };
    if (kept.length !== 1) return { problems: [`${kept.length} values of t also open the right way`] };
    const value = Math.round(kept[0]);
    if (Math.abs(kept[0] - value) > 1e-6) return { problems: [`t = ${kept[0]} is not whole`] };
    return { value, int: true, alts: [Math.round(roots.find(r => r !== kept[0])), -value] };
  }
  m = p.match(/^For the parabola \$(.+?) = 0\$, the chord \$PQ\$ passes through the focus, and \$P = \((-?\d+), (-?\d+)\)\$\. (Find the length of \$PQ\$\.|Find the \$([xy])\$-coordinate of \$Q\$\.)$/);
  if (m) {
    const T = parseTerms(m[1]);
    if (!T) return { problems: ['could not read the parabola'] };
    const orient = T.yy === 1 ? 'y2' : 'x2';
    const par = parabolaOf(T, orient);
    if (!par) return { problems: ['not a parabola of the expected shape'] };
    const P = [Number(m[2]), Number(m[3])];
    const G = (x, y) => T.xx * x * x + T.yy * y * y + T.x * x + T.y * y + T.c;
    if (G(...P) !== 0) return { problems: ['P is not on the parabola'] };
    const F = par.toXY(...par.focus);
    // Substitute P + s(F − P): a quadratic in s with s = 0 at P; the other root is Q.
    const at = s => G(P[0] + s * (F[0] - P[0]), P[1] + s * (F[1] - P[1]));
    const g0 = at(0), g1 = at(1), gm = at(-1);
    const A = (g1 + gm) / 2 - g0, B = (g1 - gm) / 2;
    if (Math.abs(g0) > 1e-9 || A === 0) return { problems: ['the line through P and the focus meets the parabola only once'] };
    const s2 = -B / A;
    const Q = [P[0] + s2 * (F[0] - P[0]), P[1] + s2 * (F[1] - P[1])];
    if (Math.abs(G(...Q)) > 1e-6 * Math.max(1, Math.abs(Q[0]) ** 2, Math.abs(Q[1]) ** 2)) return { problems: ['Q is not on the parabola'] };
    if (m[4].startsWith('Find the length')) {
      const len = Math.hypot(Q[0] - P[0], Q[1] - P[1]);
      return { value: len, int: false, alts: [2 * Math.hypot(F[0] - P[0], F[1] - P[1]), 4 * Math.abs(par.a)] };
    }
    const asked = m[5] === 'x' ? 0 : 1;
    const along = orient === 'y2' ? 0 : 1;
    if (asked !== along) return { problems: ['asks for the coordinate across the axis'] };
    return { value: Q[asked], int: false, alts: [F[asked], P[asked], Q[1 - asked]] };
  }
  return { problems: ['could not read the prompt'] };
}

function analyseEllipseHyperbola(q) {
  const p = q.prompt;
  let m = p.match(/^An? (ellipse|hyperbola) has its foci at \$F_1\((-?\d+), (-?\d+)\)\$ and \$F_2\((-?\d+), (-?\d+)\)\$ and passes through the point \$P\((-?\d+), (-?\d+)\)\$\. Find (the square of the length of its (minor|conjugate) axis|its eccentricity|the length of its latus rectum)\.$/);
  if (m) {
    const hyper = m[1] === 'hyperbola';
    if (m[9] && (m[9] === 'conjugate') !== hyper) return { problems: ['axis name does not match the conic'] };
    const [x1, y1, x2, y2, px, py] = m.slice(2, 8).map(Number);
    const cxm = (x1 + x2) / 2, cym = (y1 + y2) / 2, c = Math.hypot(x2 - x1, y2 - y1) / 2;
    if (c === 0) return { problems: ['the foci coincide'] };
    const ux = (x2 - x1) / (2 * c), uy = (y2 - y1) / (2 * c);
    const U = (px - cxm) * ux + (py - cym) * uy, V = -(px - cxm) * uy + (py - cym) * ux;
    const c2 = c * c;
    // a² from the standard-form equation through P (not from the focal distances).
    const f = hyper ? A => U * U / A - V * V / (c2 - A) - 1 : A => U * U / A + V * V / (A - c2) - 1;
    const lo = hyper ? 1e-12 : c2 * (1 + 1e-15) + 1e-12, hi = hyper ? c2 * (1 - 1e-15) : 1e6;
    if (hyper && U === 0) return { problems: ['P is equidistant from the foci: no hyperbola'] };
    if (!(f(lo) > 0 && f(hi) < 0)) return { problems: ['no a² in range'] };
    const roots = scanRoots(f, lo, hi, 20000);
    if (roots.length !== 1) return { problems: [`${roots.length} values of a²`] };
    const A = roots[0], b2 = Math.abs(A - c2), a = Math.sqrt(A);
    const what = m[8];
    if (what.startsWith('the square')) return { value: 4 * b2, int: false, alts: [b2, 2 * Math.sqrt(b2), 4 * (A + (hyper ? -c2 : c2))] };
    if (what === 'its eccentricity') return { value: c / a, int: false, alts: [c / (2 * a), a / c, c2 / A] };
    return { value: (2 * b2) / a, int: false, alts: [b2 / a, b2, (2 * b2) / (2 * a)] };
  }
  m = p.match(/^The (ellipse|hyperbola) \$(.+?)\$ \$\((.+?)\)\$ passes through the point \$\((-?\d+), (-?\d+)\)\$, and the length of its latus rectum is (\$(\d+)\$ times|\$\\dfrac\{(\d+)\}\{(\d+)\}\$ of) the length of its (minor|major|conjugate|transverse) axis\. Find (the square of the distance between its foci|\$b\^2\$)\.$/);
  if (m) {
    const hyper = m[1] === 'hyperbola';
    const eq = m[2].replace(/\s+/g, '');
    if (eq !== (hyper ? '\\dfrac{x^2}{a^2}-\\dfrac{y^2}{b^2}=1' : '\\dfrac{x^2}{a^2}+\\dfrac{y^2}{b^2}=1')) return { problems: ['could not read the equation'] };
    if (['minor', 'major'].includes(m[10]) === hyper) return { problems: ['axis name does not match the conic'] };
    const x0 = Number(m[4]), y0 = Number(m[5]);
    if (x0 === 0 || y0 === 0) return { problems: ['the point is on an axis'] };
    const rho = m[7] ? Number(m[7]) : Number(m[8]) / Number(m[9]);
    const vsB = m[10] === 'minor' || m[10] === 'conjugate';
    // For a candidate a² = A, the point fixes b² = B; the latus rectum is the chord
    // through a focus perpendicular to the axis, found from the curve at x = c.
    const Bof = A => (hyper ? y0 * y0 / (x0 * x0 / A - 1) : y0 * y0 / (1 - x0 * x0 / A));
    const shape = A => {
      const B = Bof(A);
      if (!(B > 0)) return null;
      const c2 = hyper ? A + B : A - B;
      if (!(c2 > 0)) return null;
      const y2 = hyper ? B * (c2 / A - 1) : B * (1 - c2 / A);
      return { A, B, c2, lr: 2 * Math.sqrt(y2) };
    };
    const g = A => { const sh = shape(A); return sh ? sh.lr / (vsB ? 2 * Math.sqrt(sh.B) : 2 * Math.sqrt(sh.A)) - rho : NaN; };
    const X2 = x0 * x0, roots = [];
    const N = 60000;
    let prevA = null, prevG = NaN;
    for (let i = 0; i <= N; i++) {
      // Hyperbola: a² in (0, x₀²). Ellipse: a² − x₀² log-spaced in (1e-9, 1e5).
      const A = hyper ? X2 * (i + 0.5) / (N + 1) : X2 + 1e-9 * (1e14) ** (i / N);
      const gA = g(A);
      if (prevA !== null && Number.isFinite(prevG) && Number.isFinite(gA) && prevG * gA < 0) roots.push(bisect(g, prevA, A));
      prevA = A; prevG = gA;
    }
    if (roots.length !== 1) return { problems: [`${roots.length} values of a² fit`] };
    const sh = shape(roots[0]);
    const foci = m[11].startsWith('the square');
    return { value: foci ? 4 * sh.c2 : sh.B, int: false, alts: foci ? [sh.c2, 2 * Math.sqrt(sh.c2), 4 * sh.A] : [sh.A, sh.c2, Math.sqrt(sh.B)] };
  }
  m = p.match(/^The hyperbola \$\\dfrac\{x\^2\}\{p\} - \\dfrac\{y\^2\}\{q\} = 1\$, where \$p > 0\$ and \$q > 0\$, has the same foci as the ellipse \$\\dfrac\{x\^2\}\{(\d+)\} \+ \\dfrac\{y\^2\}\{(\d+)\} = 1\$(?: and passes through the point \$\((-?\d+), (-?\d+)\)\$|, and the product of the eccentricities of the two curves is \$(\d+)\$)\. Find \$([pq])\$\.$/);
  if (m) {
    const A = Number(m[1]), B = Number(m[2]);
    if (!(A > B)) return { problems: ['the ellipse is not wider than tall'] };
    const c2 = A - B;
    let alpha;
    if (m[3] !== undefined) {
      const x0 = Number(m[3]), y0 = Number(m[4]);
      const f = al => x0 * x0 / al - y0 * y0 / (c2 - al) - 1;
      const roots = scanRoots(f, 1e-12, c2 - 1e-12, 20000);
      if (roots.length !== 1) return { problems: [`${roots.length} admissible values of p`] };
      alpha = roots[0];
    } else {
      const mm = Number(m[5]);
      const e1 = Math.sqrt(1 - B / A), e2 = mm / e1;
      if (!(e2 > 1)) return { problems: ['the hyperbola eccentricity is not above 1'] };
      alpha = c2 / (e2 * e2);
      // The hyperbola's foci really are the ellipse's: p + q = c².
      if (!close(Math.sqrt(alpha * e2 * e2), Math.sqrt(c2), 1e-12)) return { problems: ['foci mismatch'] };
    }
    const beta = c2 - alpha;
    if (!(alpha > 0 && beta > 0)) return { problems: ['p or q not positive'] };
    const askBeta = m[6] === 'q';
    return { value: askBeta ? beta : alpha, int: false, alts: [askBeta ? alpha : beta, c2, A + B] };
  }
  return { problems: ['could not read the prompt'] };
}

const ANALYSE = {
  'c11-circle-jee-reasoning': analyseCircle,
  'c11-parabola-jee-reasoning': analyseParabola,
  'c11-ellipse-hyperbola-jee-reasoning': analyseEllipseHyperbola
};

function solveWith(id) {
  return q => {
    const r = ANALYSE[id](q);
    if (r.problems) return r.problems;
    return r.int ? keyInt(q, r.value, id) : keyExact(q, r.value, id);
  };
}

export const SOLVE = Object.fromEntries(Object.keys(ANALYSE).map(id => [id, solveWith(id)]));

/** Wrong answers a student could write: the slips each solver also computes, and a 2-place rounding of a recurring key. */
function nearMisses(id) {
  return q => {
    const r = ANALYSE[id](q);
    if (r.problems) return [];
    const v = q.answer.value;
    const out = [];
    for (const alt of r.alts || []) if (Number.isFinite(alt) && !close(alt, v, 1e-9)) out.push(String(Number(alt.toFixed(6))));
    const f = q.answer.simplestFraction;
    if (f) {
      let d = f.d; while (d % 2 === 0) d /= 2; while (d % 5 === 0) d /= 5;
      if (d !== 1) out.push(v.toFixed(2));                 // a recurring decimal cut short is not the exact value
      out.push(f.n < 0 ? `-${f.d}/${-f.n}` : `${f.d}/${f.n}`);   // the reciprocal
    }
    if (v !== 0) out.push(String(-v));
    return [...new Set(out)].slice(0, 6);
  };
}

export const NEAR_MISS = Object.fromEntries(Object.keys(ANALYSE).map(id => [id, nearMisses(id)]));
