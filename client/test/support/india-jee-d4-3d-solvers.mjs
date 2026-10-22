// ─────────────────────────────────────────────────────────────────────────────
// Independent solvers for the JEE D4 Introduction to Three-dimensional Geometry
// forms (client/src/engine/generators/india-class11-jee-d4-3d.js).
//
// Nothing here imports the generator. Each solver reads the numbers back out of
// the rendered prompt and re-solves by a different route from the generator:
//   · axis distances — a brute-force search of the integer lattice for every
//     point with those three distances in that octant (uniqueness checked);
//   · octant lattice counts — enumeration of every lattice point in a box;
//   · reflection triangles — images built from the mirror's geometry, then
//     Heron's formula on the three side lengths in floating point;
//   · the equidistant point — the 2 × 2 linear system solved by Cramer's rule
//     in exact rationals (unique when the determinant is non-zero);
//   · the right angle at C(k) — a numeric scan of CA² + CB² − AB² over k with
//     bisection, rejecting roots where C meets A or B;
//   · section-formula forms — the parametric line A + t(B − A) in exact
//     rationals, and for the tetrahedron an explicit face with the given
//     centroid.
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
  let m = p.match(/^A point \$P\$ lies in the octant \$([^$]+)\$\. Its distances from the \$x\$-axis, the \$y\$-axis and the \$z\$-axis are \$([^$]+)\$, \$([^$]+)\$ and \$([^$]+)\$ respectively\. Find (the sum of the coordinates of \$P\$|the \$([xyz])\$-coordinate of \$P\$)\.$/);
  if (m) {
    const s = octantSigns(m[1]);
    const [dx, dy, dz] = [m[2], m[3], m[4]].map(surdSq);
    if (!s || [dx, dy, dz].some(v => v === null)) return { problems: ['could not read the octant or the distances'] };
    const found = [];
    for (let x = -30; x <= 30; x++) for (let y = -30; y <= 30; y++) for (let z = -30; z <= 30; z++) {
      if (Math.sign(x) !== s[0] || Math.sign(y) !== s[1] || Math.sign(z) !== s[2]) continue;
      if (y * y + z * z === dx && z * z + x * x === dy && x * x + y * y === dz) found.push([x, y, z]);
    }
    if (found.length !== 1) return { problems: [`${found.length} lattice points fit the distances and the octant`] };
    const [x, y, z] = found[0];
    const c = m[6] === undefined ? -1 : AXES[m[6]];
    const value = c < 0 ? x + y + z : found[0][c];
    const abs = c < 0 ? Math.abs(x) + Math.abs(y) + Math.abs(z) : Math.abs(value);
    return { problems: keyInt(q, value, 'lattice search'), misses: [abs, -value, x * x + y * y + z * z, dx + dy + dz] };
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
  let m = p.match(/^Find the point in the \$(xy|yz|zx)\$-plane that is equidistant from \$A\(([^)]*)\)\$, \$B\(([^)]*)\)\$ and \$C\(([^)]*)\)\$\. Give (the square of its distance from \$A\$|the sum of its coordinates)\.$/);
  if (m) {
    const z = planeZero(m[1]);
    const [A, B, C] = [m[2], m[3], m[4]].map(triple);
    if (!A || !B || !C) return { problems: ['could not read the points'] };
    const [i, j] = [0, 1, 2].filter(t => t !== z);
    // |X − U|² = |X − V|² with X on the plane: 2(V − U)·X = |V|² − |U|².
    const row = (U, V) => [2 * (V[i] - U[i]), 2 * (V[j] - U[j]), V.reduce((s, v) => s + v * v, 0) - U.reduce((s, v) => s + v * v, 0)];
    const [a1, b1, c1] = row(A, B), [a2, b2, c2] = row(B, C);
    const det = a1 * b2 - a2 * b1;
    if (det === 0) return { problems: ['the point is not unique (zero determinant)'] };
    const X = [0, 0, 0].map(() => Q(0));
    X[i] = Q(c1 * b2 - c2 * b1, det); X[j] = Q(a1 * c2 - a2 * c1, det);
    const d2q = U => U.reduce((s, u, t) => qadd(s, qmul(qsub(X[t], Q(u)), qsub(X[t], Q(u)))), Q(0));
    const dA = d2q(A), dB = d2q(B), dC = d2q(C);
    if (fmtQ(dA) !== fmtQ(dB) || fmtQ(dA) !== fmtQ(dC)) return { problems: ['Cramer solution is not equidistant'] };
    const sum = qadd(X[i], X[j]);
    const askDist = /square of its distance/.test(m[5]);
    const value = askDist ? dA : sum;
    const origin2 = X.reduce((s, x) => qadd(s, qmul(x, x)), Q(0));
    return { problems: keyIs(q, value, "Cramer's rule"), misses: [askDist ? qv(origin2) : qv(dA), askDist ? qv(sum) : -qv(sum), askDist ? Math.sqrt(qv(dA)) : qv(origin2)] };
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
  m = p.match(/^In the tetrahedron \$ABCD\$, \$A\(([^)]*)\)\$, \$B\(([^)]*)\)\$, \$C\(([^)]*)\)\$, and the centroid of the tetrahedron is \$G\(([^)]*)\)\$\. Find the square of the distance of \$D\$ from (the origin|the \$([xyz])\$-axis)\.$/);
  if (m) {
    const [A, B, C, G] = [m[1], m[2], m[3], m[4]].map(triple);
    if (!A || !B || !C || !G) return { problems: ['could not read the points'] };
    // G divides D G1 in 3 : 1, so D = G + 3(G − G1), with G1 the centroid of face ABC.
    const G1 = A.map((a, i) => Q(a + B[i] + C[i], 3));
    const D = G.map((g, i) => qadd(Q(g), qmul(Q(3), qsub(Q(g), G1[i]))));
    const skip = m[6] === undefined ? -1 : AXES[m[6]];
    const meas = X => X.reduce((s, x, i) => (i === skip ? s : qadd(s, qmul(x, x))), Q(0));
    const D3 = G.map((g, i) => Q(3 * g - A[i] - B[i] - C[i]));
    const all = D.reduce((s, x) => qadd(s, qmul(x, x)), Q(0));
    return { problems: keyIs(q, meas(D), 'median from D'), misses: [qv(meas(D3)), qv(all), Math.sqrt(qv(meas(D)))] };
  }
  m = p.match(/^In the tetrahedron \$ABCD\$, the vertex \$D\$ is \$D\(([^)]*)\)\$ and the centroid of the face \$ABC\$ is \$G_1\(([^)]*)\)\$\. If \$G\$ is the centroid of the tetrahedron, find \$DG\^2\$\.$/);
  if (!m) return { problems: ['could not read the prompt'] };
  const D = triple(m[1]), G1 = triple(m[2]);
  if (!D || !G1) return { problems: ['could not read the points'] };
  // An explicit face with centroid G1, then the average of the four vertices.
  const A = G1.map((g, i) => g + [1, 0, 0][i]), B = G1.map((g, i) => g + [0, 1, 0][i]), C = G1.map((g, i) => g - [1, 1, 0][i]);
  const G = D.map((d, i) => Q(A[i] + B[i] + C[i] + d, 4));
  const value = D.reduce((s, d, i) => qadd(s, qmul(qsub(Q(d), G[i]), qsub(Q(d), G[i]))), Q(0));
  const L = dist2(D, G1);
  return { problems: keyIs(q, value, 'explicit face'), misses: [L, (4 * L) / 9, L / 16, (3 * L) / 4] };
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
