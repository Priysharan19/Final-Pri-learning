// ─────────────────────────────────────────────────────────────────────────────
// Independent solvers for the JEE D4 Introduction to Three-dimensional Geometry
// forms (client/src/engine/generators/india-class11-jee-d4-3d.js).
//
// Nothing here imports the generator. Each solver reads the numbers back out of
// the rendered prompt and re-solves by a different route from the generator:
//   · the parallelogram — a search of the integer lattice for every fourth
//     vertex that pairs the four points into diagonals with a common midpoint,
//     keeping those strictly inside the named octant (exactly one must remain);
//   · octant lattice counts — enumeration of every lattice point in a box;
//   · reflection triangles — images built from the mirror's geometry, then
//     Heron's formula on the three side lengths in floating point;
//   · the two-condition point — a walk round the circle about O on the plane,
//     finding every sign change of PA² − PB² by bisection (exactly two);
//   · the right angle at C(k) — a numeric scan of CA² + CB² − AB² over k with
//     bisection, rejecting roots where C meets A or B;
//   · section-formula forms — the parametric line A + t(B − A) in exact
//     rationals (for the equidistant point, PC² − PD² is linear in t).
// A prompt it cannot read is a problem. NEAR_MISS lists answers a student could
// plausibly write that must be marked WRONG.
// ─────────────────────────────────────────────────────────────────────────────

// ── Exact rationals ([n, d], d > 0) ─────────────────────────────────────────
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
const Q = (n, d = 1) => { if (d === 0) throw new Error('zero denominator'); if (d < 0) { n = -n; d = -d; } const g = gcd(n, d); return [n / g, d / g]; };
const qadd = ([a, b], [c, d]) => Q(a * d + c * b, b * d);
const qsub = ([a, b], [c, d]) => Q(a * d - c * b, b * d);
const qmul = ([a, b], [c, d]) => Q(a * c, b * d);
const qdiv = ([a, b], [c, d]) => Q(a * d, b * c);
const qv = ([n, d]) => n / d;
const close = (x, y, tol = 1e-9) => Math.abs(x - y) <= tol * Math.max(1, Math.abs(x), Math.abs(y));

function keyedRational(q) {
  const a = q.answer;
  if (a.simplestFraction) return Q(a.simplestFraction.n, a.simplestFraction.d);
  if (Number.isInteger(a.value)) return Q(a.value, 1);
  return null;
}
function keyIs(q, r, label) {
  const k = keyedRational(q);
  if (!k) return [`${label}: key ${q.answer.value} is not an exact rational`];
  if (k[0] !== r[0] || k[1] !== r[1] || !close(q.answer.value, qv(r), 1e-12)) return [`${label}: independent ${r[0]}/${r[1]} vs keyed ${k[0]}/${k[1]}`];
  return [];
}
const keyInt = (q, n, label) => (Number.isInteger(n) && q.answer.value === n && !q.answer.simplestFraction ? [] : [`${label}: independent ${n} vs keyed ${q.answer.value}`]);
const keyNear = (q, x, label) => (Number.isFinite(x) && close(q.answer.value, x, 1e-9) ? [] : [`${label}: numeric ${x} vs keyed ${q.answer.value}`]);

// ── Reading the prompt ──────────────────────────────────────────────────────
const AXES = { x: 0, y: 1, z: 2 };
/** "1, -2, 3" → [1, -2, 3]. */
function triple(s) {
  const parts = String(s).split(',').map(t => t.trim());
  if (parts.length !== 3 || parts.some(t => !/^-?\d+$/.test(t))) return null;
  return parts.map(Number);
}
/** "7", "\sqrt{41}", "3\sqrt{10}" → the square of the distance. */
function surdSq(s) {
  let m = String(s).match(/^(\d+)$/);
  if (m) return Number(m[1]) ** 2;
  m = String(s).match(/^(\d*)\\sqrt\{(\d+)\}$/);
  if (!m) return null;
  const k = m[1] ? Number(m[1]) : 1;
  return k * k * Number(m[2]);
}
/** NCERT octant name X'OY'Z → signs of x, y, z. */
function octantSigns(name) {
  const m = String(name).match(/^X('?)OY('?)Z('?)$/);
  return m ? [m[1], m[2], m[3]].map(p => (p ? -1 : 1)) : null;
}
/** "2k - 4", "-k", "3", "-3k + 1" → [u, v] with u·k + v. */
function linK(s) {
  const t = String(s).replace(/\s+/g, '');
  let m = t.match(/^(-?\d*)k([+-]\d+)?$/);
  if (m) {
    const u = m[1] === '' ? 1 : m[1] === '-' ? -1 : Number(m[1]);
    return [u, m[2] ? Number(m[2]) : 0];
  }
  if (/^-?\d+$/.test(t)) return [0, Number(t)];
  return null;
}
/** The plane named by its two letters → the index of the coordinate that is 0 on it. */
const planeZero = name => ({ xy: 2, yz: 0, zx: 1 })[name];
const dist2 = (P, R) => P.reduce((s, v, i) => s + (v - R[i]) ** 2, 0);
const fmtQ = r => (r[1] === 1 ? String(r[0]) : `${r[0]}/${r[1]}`);
const fmtN = x => (Number.isInteger(x) ? String(x) : String(Number(x.toFixed(6))));

// ── Dot point 0 ──────────────────────────────────────────────────────────────

const MIRROR = {
  'the $xy$-plane': p => [p[0], p[1], -p[2]],
  'the $yz$-plane': p => [-p[0], p[1], p[2]],
  'the $zx$-plane': p => [p[0], -p[1], p[2]],
  'the $x$-axis': p => [p[0], -p[1], -p[2]],
  'the $y$-axis': p => [-p[0], p[1], -p[2]],
  'the $z$-axis': p => [-p[0], -p[1], p[2]],
  'the origin': p => [-p[0], -p[1], -p[2]]
};
const MIRROR_RE = '(the \\$xy\\$-plane|the \\$yz\\$-plane|the \\$zx\\$-plane|the \\$[xyz]\\$-axis|the origin)';

function analysePoint(q) {
  const p = q.prompt;
  let m = p.match(/^Three of the vertices of a parallelogram are \$A\(([^)]*)\)\$, \$B\(([^)]*)\)\$ and \$C\(([^)]*)\)\$, and its fourth vertex lies in the octant \$([^$]+)\$\. Find (the sum of the coordinates of the fourth vertex|the square of the distance of the fourth vertex from the \$([xyz])\$-axis)\.$/);
  if (m) {
    const [A, B, C] = [m[1], m[2], m[3]].map(triple);
    const s = octantSigns(m[4]);
    if (!A || !B || !C || !s) return { problems: ['could not read the vertices or the octant'] };
    const u = B.map((b, i) => b - A[i]), v = C.map((c, i) => c - A[i]);
    if (u[1] * v[2] - u[2] * v[1] === 0 && u[2] * v[0] - u[0] * v[2] === 0 && u[0] * v[1] - u[1] * v[0] === 0) return { problems: ['A, B and C are collinear'] };
    // Every lattice D that makes {A, B, C, D} a parallelogram: some pairing of
    // the four points into two diagonals with a common midpoint.
    const same = (X, Y, Z, W) => X.every((x, i) => x + Y[i] === Z[i] + W[i]);
    const all = [], inOct = [];
    for (let x = -25; x <= 25; x++) for (let y = -25; y <= 25; y++) for (let z = -25; z <= 25; z++) {
      const D = [x, y, z];
      if (!(same(A, B, C, D) || same(A, C, B, D) || same(A, D, B, C))) continue;
      all.push(D);
      if (D.every((t, i) => Math.sign(t) === s[i])) inOct.push(D);
    }
    if (inOct.length !== 1) return { problems: [`${inOct.length} possible fourth vertices lie in the octant`] };
    const skip = m[6] === undefined ? -1 : AXES[m[6]];
    const meas = D => (skip < 0 ? D[0] + D[1] + D[2] : D.reduce((acc, t, i) => (i === skip ? acc : acc + t * t), 0));
    const D = inOct[0];
    return { problems: keyInt(q, meas(D), 'lattice search for the fourth vertex'), misses: [...all.map(meas), D.reduce((acc, t) => acc + t * t, 0), -meas(D)] };
  }
  m = p.match(/^How many points with integer coordinates lie in the octant \$([^$]+)\$, are at a distance (less than|of at most) \$(\d+)\$ from the \$([xyz])\$-axis, and are at a distance of at most \$(\d+)\$ from the \$(xy|yz|zx)\$-plane\?$/);
  if (m) {
    const s = octantSigns(m[1]);
    const strict = m[2] === 'less than', r = Number(m[3]), ax = AXES[m[4]], h = Number(m[5]), pz = planeZero(m[6]);
    if (!s || pz === undefined) return { problems: ['could not read the octant or the plane'] };
    const B = r + h + 2;
    let count = 0, withZeros = 0, other = 0;
    for (let x = -B; x <= B; x++) for (let y = -B; y <= B; y++) for (let z = -B; z <= B; z++) {
      const P = [x, y, z];
      const axis2 = P.reduce((acc, v, i) => acc + (i === ax ? 0 : v * v), 0);
      const nearPlane = Math.abs(P[pz]) <= h;
      const inAxis = strict ? axis2 < r * r : axis2 <= r * r;
      const inAxisOther = strict ? axis2 <= r * r : axis2 < r * r;
      const inOct = P.every((v, i) => Math.sign(v) === s[i]);
      const closedOct = P.every((v, i) => v === 0 || Math.sign(v) === s[i]);
      if (inOct && inAxis && nearPlane) count++;
      if (closedOct && inAxis && nearPlane) withZeros++;
      if (inOct && inAxisOther && nearPlane) other++;
    }
    return { problems: keyInt(q, count, 'lattice enumeration'), misses: [withZeros, 8 * count, other] };
  }
  m = p.match(new RegExp(`^The point \\$P\\(([^)]*)\\)\\$ is reflected in ${MIRROR_RE} to give \\$Q\\$, and \\$Q\\$ is then reflected in ${MIRROR_RE} to give \\$R\\$\\. Find the area of triangle \\$PQR\\$\\.$`));
  let P, Qp, Rp;
  if (m) {
    P = triple(m[1]);
    if (!P || !MIRROR[m[2]] || !MIRROR[m[3]]) return { problems: ['could not read the point or the mirrors'] };
    Qp = MIRROR[m[2]](P); Rp = MIRROR[m[3]](Qp);
  } else {
    m = p.match(new RegExp(`^\\$Q\\$ is the image of the point \\$P\\(([^)]*)\\)\\$ in ${MIRROR_RE}, and \\$R\\$ is the image of \\$P\\$ in ${MIRROR_RE}\\. Find the area of triangle \\$PQR\\$\\.$`));
    if (!m) return { problems: ['could not read the prompt'] };
    P = triple(m[1]);
    if (!P || !MIRROR[m[2]] || !MIRROR[m[3]]) return { problems: ['could not read the point or the mirrors'] };
    Qp = MIRROR[m[2]](P); Rp = MIRROR[m[3]](P);
  }
  const a = Math.sqrt(dist2(Qp, Rp)), b = Math.sqrt(dist2(P, Rp)), c = Math.sqrt(dist2(P, Qp));
  const sp = (a + b + c) / 2;
  const area = Math.sqrt(Math.max(0, sp * (sp - a) * (sp - b) * (sp - c)));
  if (!(area > 1e-6)) return { problems: ['P, Q and R do not form a triangle'] };
  return { problems: keyNear(q, area, "Heron's formula"), misses: [2 * area, area / 2, 4 * area] };
}

// ── Dot point 1 ──────────────────────────────────────────────────────────────

function analyseDistance(q) {
  const p = q.prompt;
  let m = p.match(/^Find every point \$P\$ of the \$(xy|yz|zx)\$-plane that is equidistant from \$A\(([^)]*)\)\$ and \$B\(([^)]*)\)\$ and is at a distance \$([^$]+)\$ from the origin\. Give (the sum of the values of \$PA\^2\$ over all such points \$P\$|the sum of the \$([xyz])\$-coordinates of all such points \$P\$)\.$/);
  if (m) {
    const z = planeZero(m[1]);
    const A = triple(m[2]), B = triple(m[3]), N = surdSq(m[4]);
    if (!A || !B || N === null) return { problems: ['could not read the points or the distance'] };
    const [i, j] = [0, 1, 2].filter(t => t !== z);
    // Walk round the circle of radius √N on the plane and find every point
    // where PA² − PB² changes sign, by bisection.
    const r = Math.sqrt(N);
    const at = th => { const P = [0, 0, 0]; P[i] = r * Math.cos(th); P[j] = r * Math.sin(th); return P; };
    const g = th => { const P = at(th); return dist2(P, A) - dist2(P, B); };
    const sols = [];
    const STEPS = 200000, h = (2 * Math.PI) / STEPS;
    for (let k = 0; k < STEPS; k++) {
      const a = k * h, b = (k + 1) * h, ga = g(a), gb = g(b);
      if (ga === 0) { sols.push(a); continue; }
      if (ga * gb < 0) {
        let lo = a, hi = b;
        for (let t = 0; t < 100; t++) { const mid = (lo + hi) / 2; if (g(lo) * g(mid) <= 0) hi = mid; else lo = mid; }
        sols.push((lo + hi) / 2);
      }
    }
    if (sols.length !== 2) return { problems: [`${sols.length} points satisfy both conditions`] };
    const pts = sols.map(at);
    const c = m[6] === undefined ? -1 : AXES[m[6]];
    const each = pts.map(P => (c < 0 ? dist2(P, A) : P[c]));
    const value = each[0] + each[1];
    if (c >= 0 && (c === z)) return { problems: ['asked for the coordinate that is zero on the plane'] };
    return { problems: keyNear(q, value, 'scan round the circle'), misses: [...each.map(v => Number(v.toFixed(9))), c < 0 ? 2 * N : -value] };
  }
  m = p.match(/^Let \$A\(([^)]*)\)\$ and \$B\(([^)]*)\)\$ be fixed points, and let \$C\(([^$]*)\)\$, where \$k\$ is real\. Find the sum of all values of \$k\$ for which \$A\$, \$B\$ and \$C\$ are the vertices of a triangle with a right angle at \$C\$\.$/);
  if (!m) return { problems: ['could not read the prompt'] };
  const A = triple(m[1]), B = triple(m[2]);
  const comps = m[3].split(',').map(linK);
  if (!A || !B || comps.length !== 3 || comps.some(c => !c)) return { problems: ['could not read the points'] };
  const C = k => comps.map(([u, v]) => u * k + v);
  const AB2 = dist2(A, B);
  const f = k => { const c = C(k); return dist2(c, A) + dist2(c, B) - AB2; };
  const roots = [];
  const STEP = 1e-2;
  for (let i = -10000; i < 10000; i++) {
    const a = i * STEP, b = (i + 1) * STEP;
    const fa = f(a), fb = f(b);
    if (fa === 0) { roots.push(a); continue; }
    if (fa * fb < 0) {
      let lo = a, hi = b;
      for (let t = 0; t < 80; t++) { const mid = (lo + hi) / 2; if (f(lo) * f(mid) <= 0) hi = mid; else lo = mid; }
      roots.push((lo + hi) / 2);
    }
  }
  if (!roots.length) return { problems: ['no k gives a right angle at C'] };
  const valid = roots.filter(k => dist2(C(k), A) > 1e-9 && dist2(C(k), B) > 1e-9);
  if (!valid.length) return { problems: ['every root puts C on A or B'] };
  const sum = valid.reduce((s, k) => s + k, 0);
  return { problems: keyNear(q, sum, 'numeric scan with bisection'), misses: [roots.reduce((s, k) => s + k, 0), ...valid.map(Math.round), ...roots.map(Math.round)] };
}

// ── Dot point 2 ──────────────────────────────────────────────────────────────

/** t with (A + t(B − A))_c = 0. */
const tZero = (A, B, c) => Q(A[c], A[c] - B[c]);
const onLine = (A, B, t) => A.map((a, i) => qadd(Q(a), qmul(t, Q(B[i] - a))));

function analyseSection(q) {
  const p = q.prompt;
  let m = p.match(/^The line through \$A\(([^)]*)\)\$ and \$B\(([^)]*)\)\$ meets the \$(xy|yz|zx)\$-plane at \$P\$ and the \$(xy|yz|zx)\$-plane at \$Q\$\. Find \$PQ\^2\$\.$/);
  if (m) {
    const A = triple(m[1]), B = triple(m[2]);
    const i = planeZero(m[3]), j = planeZero(m[4]);
    if (!A || !B || i === j) return { problems: ['could not read the points or the planes'] };
    if (A[i] === B[i] || A[j] === B[j]) return { problems: ['the line is parallel to a plane'] };
    const tP = tZero(A, B, i), tQ = tZero(A, B, j);
    const P = onLine(A, B, tP), Qp = onLine(A, B, tQ);
    if (qv(P[i]) !== 0 || qv(Qp[j]) !== 0) return { problems: ['parametric points are not on the planes'] };
    const dt = qsub(tP, tQ);
    const value = qmul(qmul(dt, dt), Q(dist2(A, B)));
    return { problems: keyIs(q, value, 'parametric line'), misses: [dist2(A, B), Math.sqrt(qv(value)), qv(qmul(dt, Q(dist2(A, B))))] };
  }
  m = p.match(/^The point \$C\$ lies on the line through \$A\(([^)]*)\)\$ and \$B\(([^)]*)\)\$, and \$AC : CB = (\d+) : (\d+)\$\. (?:Find the sum of the values of \$AC\^2\$ over all such points \$C\$\.|Find the sum of the \$([xyz])\$-coordinates of all such points \$C\$\.)$/);
  if (m) {
    const A = triple(m[1]), B = triple(m[2]);
    const mm = Number(m[3]), nn = Number(m[4]);
    if (!A || !B || mm === nn) return { problems: ['could not read the points or the ratio'] };
    // C = A + t(B − A): AC = |t|·AB and CB = |1 − t|·AB, so n|t| = m|1 − t|.
    const ts = [Q(mm, mm + nn), Q(mm, mm - nn)];
    for (const t of ts) {
      const lhs = nn * Math.abs(qv(t)), rhs = mm * Math.abs(1 - qv(t));
      if (!close(lhs, rhs, 1e-12)) return { problems: ['parametric ratio check failed'] };
    }
    const [C1, C2] = ts.map(t => onLine(A, B, t));
    if (m[5] === undefined) {
      // AC = |t|·AB on the parametric line.
      const ac2 = ts.map(tt => qmul(qmul(tt, tt), Q(dist2(A, B))));
      const value = qadd(ac2[0], ac2[1]);
      return { problems: keyIs(q, value, 'parametric line'), misses: [qv(ac2[0]), qv(ac2[1]), dist2(A, B), Math.sqrt(qv(value))] };
    }
    const c = AXES[m[5]];
    const value = qadd(C1[c], C2[c]);
    return { problems: keyIs(q, value, 'parametric line'), misses: [qv(C1[c]), qv(C2[c]), qv(value) / 2] };
  }
  m = p.match(/^The point \$P\$ lies on the line through \$A\(([^)]*)\)\$ and \$B\(([^)]*)\)\$, and \$P\$ is equidistant from \$C\(([^)]*)\)\$ and \$D\(([^)]*)\)\$\. Find \$\\dfrac\{AP\}\{PB\}\$\.$/);
  if (!m) return { problems: ['could not read the prompt'] };
  const [A, B, C, D] = [m[1], m[2], m[3], m[4]].map(triple);
  if (!A || !B || !C || !D) return { problems: ['could not read the points'] };
  // On A + t(B − A), f(t) = PC² − PD² is linear in t (the t² terms cancel).
  const f = t => { const P = A.map((a, i) => a + t * (B[i] - a)); return dist2(P, C) - dist2(P, D); };
  const f0 = f(0), f1 = f(1);
  if (f0 === f1) return { problems: ['no unique point on the line'] };
  if (f(2) - 2 * f1 + f0 !== 0) return { problems: ['PC² − PD² is not linear along the line'] };
  const t = Q(f0, f0 - f1);
  if (t[0] === t[1]) return { problems: ['P coincides with B'] };
  const value = Q(Math.abs(t[0]), Math.abs(t[1] - t[0]));
  return { problems: keyIs(q, value, 'parametric line'), misses: [qv(value) ? 1 / qv(value) : null, Math.abs(qv(t)), -qv(value)].filter(v => v !== null) };
}

// ─────────────────────────────────────────────────────────────────────────────

const ANALYSE = {
  'c11-3d-point-jee-reasoning': analysePoint,
  'c11-3d-distance-jee-reasoning': analyseDistance,
  'c11-3d-section-jee-reasoning': analyseSection
};

export const SOLVE = Object.fromEntries(Object.entries(ANALYSE).map(([id, fn]) => [id, q => fn(q).problems]));

/** Plausible wrong answers, never the key (compared on value). */
export const NEAR_MISS = Object.fromEntries(Object.entries(ANALYSE).map(([id, fn]) => [id, q => {
  const out = fn(q).misses || [];
  const key = q.answer.value;
  return [...new Set(out.filter(v => typeof v === 'number' && Number.isFinite(v) && !close(v, key, 1e-6)).map(fmtN))];
}]));
