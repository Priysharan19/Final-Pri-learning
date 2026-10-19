// ─────────────────────────────────────────────────────────────────────────────
// Independent solvers for the CBSE Class XI hardest-level (D3) forms
// (client/src/engine/generators/india-class11-hardest.js).
//
// Nothing here imports the generator. Each solver reads the numbers back out of
// the rendered prompt and re-solves the problem by a different route — brute
// force over the unknowns, enumeration of a sample space or of every
// arrangement, a fine grid over an interval, a numeric limit or derivative, a
// simulated data set — checks that the answer is unique where uniqueness is at
// stake, and compares with the keyed value. NEAR_MISS lists answers a student
// could plausibly write that must be marked WRONG.
// ─────────────────────────────────────────────────────────────────────────────

const close = (x, y, tol = 1e-9) => Math.abs(x - y) <= tol * Math.max(1, Math.abs(x), Math.abs(y));
const keyed = q => q.answer.value;
const expect = (q, v, what, tol) => (Number.isFinite(v) && close(keyed(q), v, tol) ? [] : [`${what}: solved ${v} vs keyed ${keyed(q)}`]);
const num = s => Number(String(s).replace(/\{,\}/g, '').replace(/,/g, ''));
const sameValue = (q, list) => list.filter(v => Number.isFinite(v) && !close(v, keyed(q), 1e-9)).map(v => String(Number(v.toFixed(6))));

/** "2x^2 - 3x + 5", "-n^2 + 4n" → { power: coef }. */
function parsePoly(tex, v = 'x') {
  const s = String(tex).replace(/\s+/g, '');
  const terms = s.match(/[+-]?[^+-]+/g);
  if (!terms) return null;
  const P = {};
  for (const t of terms) {
    const i = t.indexOf(v);
    if (i < 0) { if (!/^[+-]?\d+$/.test(t)) return null; P[0] = (P[0] || 0) + Number(t); continue; }
    const c = t.slice(0, i), rest = t.slice(i + v.length);
    const coef = c === '' || c === '+' ? 1 : c === '-' ? -1 : Number(c);
    const pw = rest === '' ? 1 : Number(rest.replace(/^\^\{?(\d+)\}?$/, '$1'));
    if (!Number.isFinite(coef) || !Number.isFinite(pw)) return null;
    P[pw] = (P[pw] || 0) + coef;
  }
  return P;
}
const evalPoly = (P, x) => Object.entries(P).reduce((s, [p, c]) => s + c * x ** Number(p), 0);

/** "5 - 5i", "-i", "3", "2i" → [re, im]. */
function parseC(t) {
  const s = String(t).replace(/\s+/g, '');
  let m = s.match(/^(-?)(\d*)i$/);
  if (m) return [0, (m[1] ? -1 : 1) * (m[2] === '' ? 1 : Number(m[2]))];
  m = s.match(/^(-?\d+)(?:([+-])(\d*)i)?$/);
  if (!m) return null;
  return [Number(m[1]), m[2] ? (m[2] === '-' ? -1 : 1) * (m[3] === '' ? 1 : Number(m[3])) : 0];
}
const cmul = ([a, b], [c, d]) => [a * c - b * d, a * d + b * c];
const cdiv = ([a, b], [c, d]) => { const D = c * c + d * d; return [(a * c + b * d) / D, (b * c - a * d) / D]; };

/** "3x - 4y + 7 = 0" → [A, B, C]. */
function parseLine(tex) {
  const s = tex.replace(/\s*=\s*0\s*$/, '').replace(/\s+/g, '');
  const out = [0, 0, 0];
  for (const t of s.match(/[+-]?[^+-]+/g) || []) {
    const m = t.match(/^([+-]?)(\d*)(x|y)?$/);
    if (!m) return null;
    const sign = m[1] === '-' ? -1 : 1;
    const c = m[2] === '' ? 1 : Number(m[2]);
    out[m[3] === 'x' ? 0 : m[3] === 'y' ? 1 : 2] += sign * c;
  }
  return out;
}

// ── Trigonometric grid ──────────────────────────────────────────────────────
const TEXVAL = { '': 1, 2: 2, '\\sqrt{2}': Math.SQRT2, '\\sqrt{3}': Math.sqrt(3), 1: 1 };
const TRIG = { sin: Math.sin, cos: Math.cos, tan: Math.tan };
function trigSolutions(q) {
  const m = q.prompt.match(/of \$(.+?)\$ in the interval \$(-?\d+)\^\\circ \\le x \\le (-?\d+)\^\\circ\$/);
  if (!m) return null;
  const [eq, L, U] = [m[1], Number(m[2]), Number(m[3])];
  let g;
  let k = 1;
  let lin = eq.match(/^(2|\\sqrt\{2\}|\\sqrt\{3\})?\\(sin|cos|tan) (\d)x = (-?)(\\sqrt\{3\}|1)$/);
  if (lin) {
    const a = TEXVAL[lin[1] || ''], f = TRIG[lin[2]], b = (lin[4] ? -1 : 1) * TEXVAL[lin[5]];
    k = Number(lin[3]);
    g = x => a * f(k * x * Math.PI / 180) - b;
  } else {
    const qd = eq.match(/^2\\(sin|cos)\^2 x ([+-]) (\d*)\\(sin|cos) x(?: ([+-]) (\d+))? = 0$/);
    if (!qd || qd[1] !== qd[4]) return null;
    const f = TRIG[qd[1]];
    const b = (qd[2] === '-' ? -1 : 1) * (qd[3] === '' ? 1 : Number(qd[3]));
    const c = qd[5] ? (qd[5] === '-' ? -1 : 1) * Number(qd[6]) : 0;
    g = x => { const s = f(x * Math.PI / 180); return 2 * s * s + b * s + c; };
  }
  const xs = [];
  for (let i = L * 120; i <= U * 120; i++) {
    const x = i / 120;
    if (Math.abs(g(x)) < 1e-9) xs.push(x);
  }
  return { xs, k, L, U };
}

// ── Arrangements ────────────────────────────────────────────────────────────
function distinctPerms(word) {
  const a = word.split('');
  const out = new Set();
  const c = new Array(a.length).fill(0);
  out.add(a.join(''));
  let i = 0;
  while (i < a.length) {
    if (c[i] < i) {
      const j = i % 2 === 0 ? 0 : c[i];
      [a[j], a[i]] = [a[i], a[j]];
      out.add(a.join(''));
      c[i]++; i = 0;
    } else { c[i] = 0; i++; }
  }
  return [...out];
}
const isV = ch => /[AEIOU]/.test(ch);

// ── Event predicates (written apart from the generator) ─────────────────────
function dicePredicate(text) {
  let m;
  if ((m = text.match(/sum of the numbers is a multiple of \$(\d+)\$/))) { const k = +m[1]; return (a, b) => (a + b) % k === 0; }
  if ((m = text.match(/sum of the numbers is greater than \$(\d+)\$/))) { const k = +m[1]; return (a, b) => a + b > k; }
  if (/first die shows a larger number than the second/.test(text)) return (a, b) => a > b;
  if (/both dice show the same number/.test(text)) return (a, b) => a === b;
  if (/product of the numbers is even/.test(text)) return (a, b) => a % 2 === 0 || b % 2 === 0;
  if (/at least one die shows a \$6\$/.test(text)) return (a, b) => Math.max(a, b) === 6;
  if ((m = text.match(/numbers differ by \$(\d+)\$/))) { const k = +m[1]; return (a, b) => a - b === k || b - a === k; }
  return null;
}
function coinPredicate(text) {
  let m;
  const heads = s => [...s].filter(c => c === 'H').length;
  if ((m = text.match(/at least (\d) heads? appears?/))) { const k = +m[1]; return s => heads(s) >= k; }
  if ((m = text.match(/exactly (\d) heads? appears?/))) { const k = +m[1]; return s => heads(s) === k; }
  if (/first toss is a head/.test(text)) return s => s[0] === 'H';
  if (/no two consecutive tosses are heads/.test(text)) return s => [...s].every((c, i) => !(c === 'H' && s[i + 1] === 'H'));
  if (/last two tosses are the same/.test(text)) return s => s.at(-1) === s.at(-2);
  return null;
}

export const SOLVE = {
  'c11-cartesian-product-reasoning'(q) {
    const p = q.prompt;
    const A = p.match(/A = \\\{([^\\]+)\\\}/)?.[1].split(',').map(Number);
    const B = p.match(/B = \\\{([^\\]+)\\\}/)?.[1].split(',').map(Number);
    if (!A || !B) return ['could not read A and B'];
    let rule, m;
    if ((m = p.match(/\$a \+ b\$ is a multiple of \$(\d+)\$/))) rule = (a, b) => Number.isInteger((a + b) / +m[1]);
    else if (/\$a < b\$/.test(p)) rule = (a, b) => b - a > 0;
    else if (/\$a\$ is a factor of \$b\$/.test(p)) rule = (a, b) => Number.isInteger(b / a);
    else if ((m = p.match(/differ by at most \$(\d+)\$/))) rule = (a, b) => (a - b) ** 2 <= (+m[1]) ** 2;
    else if ((m = p.match(/\$b - a\$ is a multiple of \$(\d+)\$/))) rule = (a, b) => Number.isInteger((b - a) / +m[1]);
    else return ['could not read the rule'];
    let inR = 0, out = 0;
    for (const a of A) for (const b of B) (rule(a, b) ? inR++ : out++);
    return expect(q, /are NOT in/.test(p) ? out : inR, 'relation count');
  },
  'c11-radian-unit-circle-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/The (minute|second) hand .* is \$([\d.]+)\$ cm long\. How far, in cm, does its tip move in \$(\d+)\$ (minutes|seconds)\?/);
    if (m) {
      if ((m[1] === 'minute') !== (m[4] === 'minutes')) return ['hand and unit disagree'];
      // fraction of a turn × circumference, π = 22/7
      return expect(q, (Number(m[3]) / 60) * 2 * (22 / 7) * Number(m[2]), 'clock arc');
    }
    m = p.match(/\\angle P = (\d+)\^\\circ\$ and \$\\angle Q = \\dfrac\{(\d*)\\pi\}\{(\d+)\}\$ radians\. Find \$\\angle R\$ in degrees/);
    if (m) {
      const Q = (m[2] === '' ? 1 : Number(m[2])) * Math.PI / Number(m[3]) * 180 / Math.PI;
      return expect(q, 180 - Number(m[1]) - Q, 'third angle');
    }
    m = p.match(/An arc of length \$(\d+)\$ cm is cut off on a circle of radius \$(\d+)\$ cm\. Find, in degrees/);
    if (m) {
      // the arc is θ/360 of the circumference 2πr with π = 22/7
      const theta = Number(m[1]) / (2 * (22 / 7) * Number(m[2])) * 360;
      return expect(q, theta, 'central angle');
    }
    return ['could not read the situation'];
  },
  'c11-trig-general-solution-reasoning'(q) {
    const s = trigSolutions(q);
    if (!s) return ['could not read the equation'];
    if (!s.xs.length) return ['no solutions found'];
    if (/the number of solutions/.test(q.prompt)) return expect(q, s.xs.length, 'count');
    if (/the sum, in degrees/.test(q.prompt)) return expect(q, s.xs.reduce((a, b) => a + b, 0), 'sum');
    return ['could not read what is asked'];
  },
  'c11-complex-modulus-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/Let \$z = \\dfrac\{\(([^)]+)\)\(([^)]+)\)\}\{([^}]+)\}\$\. Find \$\|z\|\^2\$/);
    if (m) {
      const [z1, z2, z3] = [m[1], m[2], m[3]].map(parseC);
      if (!z1 || !z2 || !z3) return ['could not read the numbers'];
      const z = cdiv(cmul(z1, z2), z3);
      return expect(q, z[0] ** 2 + z[1] ** 2, '|z|^2');
    }
    m = p.match(/satisfies \$(\d*)z \+ (\d*)\\bar\{z\} = ([^$]+)\$.*Find (\$\|z\|\^2\$|\$x \+ y\$)/);
    if (m) {
      const P = m[1] === '' ? 1 : +m[1], Qc = m[2] === '' ? 1 : +m[2], w = parseC(m[3]);
      const sols = [];
      for (let x = -40; x <= 40; x++) for (let y = -40; y <= 40; y++) {
        const lhs = [P * x + Qc * x, P * y - Qc * y];
        if (lhs[0] === w[0] && lhs[1] === w[1]) sols.push([x, y]);
      }
      if (sols.length !== 1) return [`${sols.length} solutions for z`];
      const [x, y] = sols[0];
      return expect(q, m[4].includes('|z|') ? x * x + y * y : x + y, 'conjugate equation');
    }
    m = p.match(/Express \$\\dfrac\{([^}]+)\}\{([^}]+)\}\$ in the form \$p \+ iq\$ and give the value of \$(p|q)\$/);
    if (m) {
      const z = cdiv(parseC(m[1]), parseC(m[2]));
      return expect(q, m[3] === 'p' ? z[0] : z[1], 'quotient part');
    }
    return ['could not read the situation'];
  },
  'c11-complex-quadratic-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/where \$b\$ and \$c\$ are real, is \$([^$]+)\$\. Find \$(b \+ c|c - b)\$/);
    if (m) {
      const [x, y] = parseC(m[1]);
      const sols = [];
      for (let b = -60; b <= 60; b++) for (let c = -10; c <= 250; c++) {
        // (x + iy)^2 + b(x + iy) + c = 0
        if (x * x - y * y + b * x + c === 0 && 2 * x * y + b * y === 0) sols.push([b, c]);
      }
      if (sols.length !== 1) return [`${sols.length} pairs (b, c)`];
      const [b, c] = sols[0];
      return expect(q, m[2] === 'b + c' ? b + c : c - b, 'coefficients');
    }
    m = p.match(/roots of \$(.+) = 0\$\. Find (.+)\.$/);
    if (!m) return ['could not read the equation'];
    const P = parsePoly(m[1]);
    if (!P) return ['could not parse the quadratic'];
    const a = P[2] || 0, b = P[1] || 0, c = P[0] || 0;
    const disc = b * b - 4 * a * c;
    if (!(a && disc < 0)) return ['roots are not complex'];
    const re = -b / (2 * a), im = Math.sqrt(-disc) / (2 * Math.abs(a));
    const al = [re, im], be = [re, -im];
    if (/square of the imaginary part/.test(m[2])) return expect(q, im * im, 'im^2', 1e-9);
    if (/alpha\^2 \+ \\beta\^2/.test(m[2])) { const s1 = cmul(al, al), s2 = cmul(be, be); return expect(q, s1[0] + s2[0], 'sum of squares', 1e-9); }
    if (/alpha - \\beta\|\^2/.test(m[2])) return expect(q, (2 * im) ** 2, '|alpha - beta|^2', 1e-9);
    return ['could not read what is asked'];
  },
  'c11-counting-principle-reasoning'(q) {
    const m = q.prompt.match(/How many (\d)-digit numbers can be formed from the digits \$([\d, ]+)\$ (if digits may be repeated|if no digit is repeated) and the number is (.+)\?$/);
    if (!m) return ['could not read the question'];
    const L = +m[1], D = new Set(m[2].split(',').map(s => s.trim()));
    const rep = /may be repeated/.test(m[3]);
    let test, t;
    if (m[4] === 'even') test = n => n % 2 === 0;
    else if (m[4] === 'odd') test = n => n % 2 !== 0;
    else if (m[4] === 'divisible by $5$') test = n => n % 5 === 0;
    else if ((t = m[4].match(/greater than \$([\d{},]+)\$/))) { const T = num(t[1]); test = n => n > T; }
    else return ['could not read the condition'];
    let count = 0;
    for (let n = 10 ** (L - 1); n < 10 ** L; n++) {
      const s = String(n);
      if (![...s].every(ch => D.has(ch))) continue;
      if (!rep && new Set(s).size !== s.length) continue;
      if (test(n)) count++;
    }
    return expect(q, count, 'count');
  },
  'c11-arrangement-reasoning'(q) {
    const m = q.prompt.match(/letters of the word ([A-Z]+) are there in which (.+)\?$/);
    if (!m) return ['could not read the question'];
    const perms = distinctPerms(m[1]);
    const cond = m[2];
    let test, e;
    if (/all the vowels come together/.test(cond)) test = s => /^[^AEIOU]*[AEIOU]+[^AEIOU]*$/.test(s);
    else if (/no two vowels are next to each other/.test(cond)) test = s => [...s].every((c, i) => !(isV(c) && isV(s[i + 1] || '')));
    else if ((e = cond.match(/first letter is ([A-Z]) and the last letter is ([A-Z])/))) test = s => s.startsWith(e[1]) && s.endsWith(e[2]);
    else if (/vowels occupy only the even places/.test(cond)) test = s => [...s].every((c, i) => !isV(c) || (i + 1) % 2 === 0);
    else return ['could not read the restriction'];
    return expect(q, perms.filter(test).length, 'arrangements');
  },
  'c11-ap-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/The (\d+)\w\w term of an AP is \$(-?\d+)\$ and its (\d+)\w\w term is \$(-?\d+)\$\. Find the sum of its first \$(\d+)\$ terms/);
    if (m) {
      const [P, X, Qn, Y, n] = m.slice(1).map(Number);
      const sols = [];
      for (let a = -400; a <= 400; a++) for (let d = -60; d <= 60; d++) if (a + (P - 1) * d === X && a + (Qn - 1) * d === Y) sols.push([a, d]);
      if (sols.length !== 1) return [`${sols.length} APs`];
      let s = 0, t = sols[0][0];
      for (let i = 0; i < n; i++) { s += t; t += sols[0][1]; }
      return expect(q, s, 'sum');
    }
    m = p.match(/S_n = ([^$]+)\$\. Find its (\d+)\w\w term/);
    if (m) {
      const P = parsePoly(m[1], 'n');
      if (!P) return ['could not read S_n'];
      const S = k => evalPoly(P, k);
      const terms = [];
      for (let k = 1; k <= +m[2]; k++) terms.push(S(k) - S(k - 1));
      const d = terms[1] - terms[0];
      if (!terms.every((t, i) => i === 0 || t - terms[i - 1] === d)) return ['the terms are not an AP'];
      return expect(q, terms.at(-1), 'term');
    }
    m = p.match(/sum of all (two|three)-digit numbers which leave remainder \$(\d+)\$ when divided by \$(\d+)\$/);
    if (m) {
      const lo = m[1] === 'two' ? 10 : 100;
      let s = 0;
      for (let n = lo; n < lo * 10; n++) if (n % +m[3] === +m[2]) s += n;
      return expect(q, s, 'sum of numbers');
    }
    m = p.match(/saves ₹\$([\d{},]+)\$ in the first month.*saves ₹\$(\d+)\$ more.*exactly ₹\$([\d{},]+)\$\?/);
    if (m) {
      const [a, d, T] = [num(m[1]), num(m[2]), num(m[3])];
      let total = 0, month = 0, save = a;
      while (total < T && month < 1000) { total += save; save += d; month++; }
      return total === T ? expect(q, month, 'months') : ['total is never hit exactly'];
    }
    return ['could not read the situation'];
  },
  'c11-line-equation-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/^At what \$(x|y)\$-coordinate does the perpendicular bisector of the segment joining \$A\((-?\d+), (-?\d+)\)\$ and \$B\((-?\d+), (-?\d+)\)\$ cross the (x|y)-axis/);
    if (m && /perpendicular bisector/.test(p)) {
      if (m[1] !== m[6]) return ['asked coordinate does not match the axis'];
      const [x1, y1, x2, y2] = m.slice(2, 6).map(Number);
      // A point on the axis equidistant from A and B: |PA|² − |PB|² is linear in the free coordinate.
      const pt = t => (m[6] === 'y' ? [0, t] : [t, 0]);
      const f = t => { const [x, y] = pt(t); return (x - x1) ** 2 + (y - y1) ** 2 - (x - x2) ** 2 - (y - y2) ** 2; };
      const slope = f(1) - f(0);
      if (slope === 0) return ['bisector parallel to the axis'];
      return expect(q, -f(0) / slope, 'axis crossing');
    }
    m = p.match(/\$P\((-?\d+), (-?\d+)\)\$ is the midpoint of \$AB\$\. (.*)$/);
    if (m) {
      const h = +m[1], k = +m[2];
      const sols = [];
      for (let a = -40; a <= 40; a++) for (let b = -40; b <= 40; b++) if (a !== 0 && b !== 0 && a + 0 === 2 * h && 0 + b === 2 * k) sols.push([a, b]);
      if (sols.length !== 1) return ['intercepts not unique'];
      const [a, b] = sols[0];
      // shoelace on O(0,0), A(a,0), B(0,b)
      const area = Math.abs(a * b - 0) / 2;
      return /area/.test(m[3]) ? expect(q, area, 'area') : expect(q, a + b, 'a + b');
    }
    m = p.match(/through \$P\((-?\d+), (-?\d+)\)\$ parallel to the line joining \$A\((-?\d+), (-?\d+)\)\$ and \$B\((-?\d+), (-?\d+)\)\$/);
    if (m) {
      const [h, k, xa, ya, xb, yb] = m.slice(1).map(Number);
      if (yb === ya) return ['never meets the x-axis'];
      const s = -k / (yb - ya);
      return expect(q, h + s * (xb - xa), 'x-axis meet');
    }
    return ['could not read the situation'];
  },
  'c11-line-distance-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/parallel lines \$([^$]+)\$ and \$([^$]+)\$/);
    if (m) {
      const L1 = parseLine(m[1]), L2 = parseLine(m[2]);
      if (!L1 || !L2) return ['could not read the lines'];
      if (L1[0] * L2[1] !== L1[1] * L2[0]) return ['lines are not parallel'];
      const P0 = L1[1] !== 0 ? [0, -L1[2] / L1[1]] : [-L1[2] / L1[0], 0];
      const d = Math.abs(L2[0] * P0[0] + L2[1] * P0[1] + L2[2]) / Math.hypot(L2[0], L2[1]);
      return expect(q, d, 'distance', 1e-9);
    }
    m = p.match(/point \$\((-?\d+), (-?\d+)\)\$ from the line \$(.+) \+ c = 0\$ is \$(\d+)\$\. Find the (sum|greater|smaller)/);
    if (!m) return ['could not read the situation'];
    const L = parseLine(`${m[3]} = 0`);
    const [h, k, d] = [+m[1], +m[2], +m[4]];
    const cs = [];
    for (let c = -600; c <= 600; c++) if (close(Math.abs(L[0] * h + L[1] * k + c) / Math.hypot(L[0], L[1]), d, 1e-12)) cs.push(c);
    if (cs.length !== 2) return [`${cs.length} values of c`];
    return expect(q, m[5] === 'sum' ? cs[0] + cs[1] : m[5] === 'greater' ? Math.max(...cs) : Math.min(...cs), 'c');
  },
  'c11-limit-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/\\lim_\{x \\to (\d+)\} \\dfrac\{x\^(\d) - (\d+)\}\{x\^(\d) - (\d+)\}\$\.$/);
    if (m) {
      const [a, M, A, N, B] = m.slice(1).map(Number);
      if (a ** M !== A || a ** N !== B) return ['constants are not powers of the limit point'];
      const f = x => (x ** M - A) / (x ** N - B);
      const h = 1e-5;
      return expect(q, (f(a + h) + f(a - h)) / 2, 'algebraic limit', 1e-7);
    }
    m = p.match(/\\lim_\{x \\to (\d+)\} \\dfrac\{x\^n - (\d+)\^n\}\{x - (\d+)\} = ([\d{},]+)\$, where \$n\$ is a positive integer/);
    if (m) {
      const a = +m[1], K = num(m[4]);
      if (+m[2] !== a || +m[3] !== a) return ['inconsistent limit point'];
      const ns = [];
      for (let n = 1; n <= 30; n++) { const f = x => (x ** n - a ** n) / (x - a); if (close((f(a + 1e-6) + f(a - 1e-6)) / 2, K, 1e-6)) ns.push(n); }
      if (ns.length !== 1) return [`${ns.length} values of n`];
      return expect(q, ns[0], 'n');
    }
    const k = s => (s === '' ? 1 : Number(s));
    m = p.match(/\\lim_\{x \\to 0\} \\dfrac\{\\sin (\d*)x \+ \\tan (\d*)x\}\{(\d+)x\}\$/);
    if (m) {
      const [P, Qn, R] = [k(m[1]), k(m[2]), +m[3]];
      const f = x => (Math.sin(P * x) + Math.tan(Qn * x)) / (R * x);
      return expect(q, (f(1e-5) + f(-1e-5)) / 2, 'trig limit', 1e-6);
    }
    m = p.match(/\\lim_\{x \\to 0\} \\dfrac\{1 - \\cos (\d*)x\}\{(\d+)x\^2\}\$/);
    if (m) {
      const [P, R] = [k(m[1]), +m[2]];
      const f = x => (1 - Math.cos(P * x)) / (R * x * x);
      return expect(q, f(1e-4), 'trig limit', 1e-6);
    }
    return ['could not read the limit'];
  },
  'c11-derivative-rules-reasoning'(q) {
    const p = q.prompt;
    const deriv = (f, t, h = 1e-4) => (f(t - 2 * h) - 8 * f(t - h) + 8 * f(t + h) - f(t + 2 * h)) / (12 * h);
    let m = p.match(/f\(x\) = \\dfrac\{([^}]+)\}\{([^}]+)\}\$\. Using the quotient rule, find \$f'\((-?\d+)\)\$/);
    if (m) {
      const U = parsePoly(m[1]), V = parsePoly(m[2]);
      if (!U || !V) return ['could not read f'];
      return expect(q, deriv(x => evalPoly(U, x) / evalPoly(V, x), +m[3]), "f'", 1e-7);
    }
    m = p.match(/f\(x\) = \(([^)]+)\)\(([^)]+)\)\$\. Using the product rule, find \$f'\((-?\d+)\)\$/);
    if (m) {
      const U = parsePoly(m[1]), V = parsePoly(m[2]);
      return expect(q, deriv(x => evalPoly(U, x) * evalPoly(V, x), +m[3]), "f'", 1e-7);
    }
    m = p.match(/f\(x\) = \(x\^2 \+ kx\)\(([^)]+)\)\$, where \$k\$ is a constant\. If \$f'\((-?\d+)\) = (-?\d+)\$, find \$k\$/);
    if (m) {
      const V = parsePoly(m[1]), t = +m[2], K = +m[3];
      const ks = [];
      for (let k = -80; k <= 80; k++) if (close(deriv(x => (x * x + k * x) * evalPoly(V, x), t), K, 1e-7)) ks.push(k);
      if (ks.length !== 1) return [`${ks.length} values of k`];
      return expect(q, ks[0], 'k');
    }
    return ['could not read f'];
  },
  'c11-mean-deviation-reasoning'(q) {
    const p = q.prompt;
    const nums = s => s.split(',').map(t => Number(t.trim()));
    let m = p.match(/\$x_i\$: \$([^$]+)\$ with frequencies \$f_i\$: \$([^$]+)\$/);
    if (m) {
      const xs = nums(m[1]), fs = nums(m[2]);
      const data = xs.flatMap((x, i) => Array(fs[i]).fill(x));
      const mean = data.reduce((s, v) => s + v, 0) / data.length;
      return expect(q, data.reduce((s, v) => s + Math.abs(v - mean), 0) / data.length, 'MD about mean', 1e-9);
    }
    m = p.match(/are \$([^$]+)\$\. Find the mean deviation about the median/);
    if (m) {
      const v = nums(m[1]).sort((a, b) => a - b);
      if (v.length % 2 === 0) return ['even count'];
      const M = v[(v.length - 1) / 2];
      return expect(q, v.reduce((s, x) => s + Math.abs(x - M), 0) / v.length, 'MD about median', 1e-9);
    }
    m = p.match(/observations \$([^$]+)\$ and \$x\$ is \$(\d+)\$\. Find the mean deviation of the (\d) observations/);
    if (m) {
      const known = nums(m[1]), mean = +m[2], n = +m[3];
      if (known.length + 1 !== n) return ['count mismatch'];
      const xs = [];
      for (let x = -500; x <= 1000; x++) if ((known.reduce((s, v) => s + v, 0) + x) === mean * n) xs.push(x);
      if (xs.length !== 1) return ['x not unique'];
      const all = [...known, xs[0]];
      return expect(q, all.reduce((s, v) => s + Math.abs(v - mean), 0) / n, 'MD', 1e-9);
    }
    return ['could not read the data'];
  },
  'c11-coefficient-variation-reasoning'(q) {
    const p = q.prompt;
    const groups = [...p.matchAll(/for ([A-Za-z]+), \$n = (\d+)\$, \$\\sum x = (\d+)\$ and \$\\sum x\^2 = ([\d{},]+)\$/g)];
    if (groups.length === 2) {
      const cvs = groups.map(g => {
        const n = +g[2], S = +g[3], Qs = num(g[4]);
        const mean = S / n, sd = Math.sqrt(Qs / n - mean * mean);
        return 100 * sd / mean;
      });
      const m = p.match(/more (consistent|variable)\.$/);
      if (!m) return ['could not read what is asked'];
      return expect(q, m[1] === 'consistent' ? Math.min(...cvs) : Math.max(...cvs), 'CV', 1e-9);
    }
    const m = p.match(/mean \$(\d+)\$ and variance \$(\d+)\$\. Each observation is multiplied by \$(\d+)\$ and then \$(\d+)\$ is added/);
    if (!m) return ['could not read the data'];
    const [mu, v, k, c] = m.slice(1).map(Number);
    // Simulate: two observations mu ± sd have that mean and variance.
    const sd = Math.sqrt(v);
    const data = [mu - sd, mu + sd].map(x => k * x + c);
    const mean = (data[0] + data[1]) / 2;
    const sd2 = Math.sqrt(data.reduce((s, x) => s + (x - mean) ** 2, 0) / 2);
    return expect(q, 100 * sd2 / mean, 'new CV', 1e-9);
  },
  'c11-sample-space-reasoning'(q) {
    const p = q.prompt;
    const m = p.match(/Let \$A\$ be the event that (.+?), and \$B\$ the event that (.+?)\. How many outcomes of the sample space are in (.+)\?$/);
    if (!m) return ['could not read the events'];
    let outcomes, A, B;
    if (/Two dice/.test(p)) {
      const pa = dicePredicate(m[1]), pb = dicePredicate(m[2]);
      if (!pa || !pb) return ['could not read a dice event'];
      outcomes = [];
      for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) outcomes.push([a, b]);
      A = o => pa(o[0], o[1]); B = o => pb(o[0], o[1]);
    } else {
      const t = p.match(/A coin is tossed (three|four) times/);
      const pa = coinPredicate(m[1]), pb = coinPredicate(m[2]);
      if (!t || !pa || !pb) return ['could not read a coin event'];
      const n = t[1] === 'three' ? 3 : 4;
      outcomes = [''];
      for (let i = 0; i < n; i++) outcomes = outcomes.flatMap(s => [s + 'H', s + 'T']);
      A = pa; B = pb;
    }
    const c = m[3];
    let f;
    if (/\\cup/.test(c)) f = o => A(o) || B(o);
    else if (/neither/.test(c)) f = o => !A(o) && !B(o);
    else if (/but not/.test(c)) f = o => A(o) && !B(o);
    else if (/^\$A \\cap B\$$/.test(c)) f = o => A(o) && B(o);
    else return ['could not read the combination'];
    return expect(q, outcomes.filter(f).length, 'outcomes');
  },
  'c11-compound-event-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/\$P\(A\) = ([\d.]+)\$, \$P\(B\) = ([\d.]+)\$ and \$P\(A \\(cup|cap) B\) = ([\d.]+)\$\. Find the probability that (.+)\. Give/);
    if (m) {
      const h = s => Math.round(Number(s) * 100);
      const [a, b, given] = [h(m[1]), h(m[2]), h(m[4])];
      // Search the four Venn regions in hundredths.
      const sols = [];
      for (let both = 0; both <= 100; both++) {
        const onlyA = a - both, onlyB = b - both, none = 100 - onlyA - onlyB - both;
        if (onlyA < 0 || onlyB < 0 || none < 0) continue;
        if ((m[3] === 'cup' ? onlyA + onlyB + both : both) === given) sols.push({ both, onlyA, onlyB, none });
      }
      if (sols.length !== 1) return [`${sols.length} Venn diagrams`];
      const r = sols[0];
      const ask = m[5];
      const v = /neither/.test(ask) ? r.none : /exactly one/.test(ask) ? r.onlyA + r.onlyB : /but \$B\$ does not/.test(ask) ? r.onlyA : /do not both/.test(ask) ? 100 - r.both : NaN;
      return expect(q, v / 100, 'probability');
    }
    m = p.match(/class of \$(\d+)\$ students in [A-Za-z]+, \$(\d+)\$ play ([a-z-]+), \$(\d+)\$ play ([a-z-]+) and \$(\d+)\$ play both\. .* the student (.+)\. Give/);
    if (!m) return ['could not read the situation'];
    const [N, x, y, both] = [+m[1], +m[2], +m[4], +m[6]];
    // Build the class roll and count.
    const roll = [];
    for (let i = 0; i < both; i++) roll.push([1, 1]);
    for (let i = 0; i < x - both; i++) roll.push([1, 0]);
    for (let i = 0; i < y - both; i++) roll.push([0, 1]);
    while (roll.length < N) roll.push([0, 0]);
    if (roll.length !== N) return ['counts exceed the class'];
    const ask = m[7];
    const f = /neither/.test(ask) ? s => !s[0] && !s[1] : /exactly one/.test(ask) ? s => s[0] !== s[1] : /but not/.test(ask) ? s => s[0] && !s[1] : /does not play both/.test(ask) ? s => !(s[0] && s[1]) : null;
    if (!f) return ['could not read what is asked'];
    if (/but not/.test(ask) && !ask.includes(`plays ${m[3]} but not ${m[5]}`)) return ['games named out of order'];
    return expect(q, roll.filter(f).length / N, 'probability');
  }
};

export const NEAR_MISS = {
  'c11-cartesian-product-reasoning'(q) {
    const A = q.prompt.match(/A = \\\{([^\\]+)\\\}/)[1].split(',').length;
    const B = q.prompt.match(/B = \\\{([^\\]+)\\\}/)[1].split(',').length;
    return sameValue(q, [A * B, A * B - keyed(q)]);
  },
  'c11-radian-unit-circle-reasoning'(q) {
    const v = keyed(q);
    const m = q.prompt.match(/An arc of length \$(\d+)\$ cm is cut off on a circle of radius \$(\d+)\$ cm/);
    return sameValue(q, [m ? +m[1] / +m[2] : v / 2, v * 2]);
  },
  'c11-trig-general-solution-reasoning'(q) {
    const s = trigSolutions(q);
    if (!s) return [];
    const first = s.xs.filter(x => x >= 0 && s.k * x < 360);
    return sameValue(q, /number of solutions/.test(q.prompt) ? [first.length] : [first.reduce((a, b) => a + b, 0)]);
  },
  'c11-complex-modulus-reasoning'(q) { return sameValue(q, [-keyed(q), keyed(q) * 2]); },
  'c11-complex-quadratic-reasoning'(q) { return sameValue(q, [-keyed(q), keyed(q) / 2]); },
  'c11-counting-principle-reasoning'(q) { return sameValue(q, [keyed(q) * 2, keyed(q) - 2]); },
  'c11-arrangement-reasoning'(q) {
    const w = q.prompt.match(/word ([A-Z]+)/)[1];
    return sameValue(q, [distinctPerms(w).length]);
  },
  'c11-ap-reasoning'(q) {
    const m = q.prompt.match(/S_n = ([^$]+)\$\. Find its (\d+)\w\w term/);
    if (m) { const P = parsePoly(m[1], 'n'); return sameValue(q, [evalPoly(P, +m[2])]); }
    return sameValue(q, [keyed(q) + 2, keyed(q) - 2]);
  },
  'c11-line-equation-reasoning'(q) { return sameValue(q, [-keyed(q), keyed(q) / 2]); },
  'c11-line-distance-reasoning'(q) {
    const m = q.prompt.match(/parallel lines \$([^$]+)\$ and \$([^$]+)\$/);
    if (m) { const L1 = parseLine(m[1]), L2 = parseLine(m[2]); return sameValue(q, [Math.abs(L1[2] - L2[2]) / Math.hypot(L1[0], L1[1])]); }
    return sameValue(q, [-keyed(q)]);
  },
  'c11-limit-reasoning'(q) {
    const m = q.prompt.match(/\\dfrac\{x\^(\d) - \d+\}\{x\^(\d) - \d+\}/);
    return sameValue(q, m ? [+m[1] / +m[2]] : [keyed(q) * 2]);
  },
  'c11-derivative-rules-reasoning'(q) { return sameValue(q, [-keyed(q), keyed(q) + 0.5]); },
  'c11-mean-deviation-reasoning'(q) { return sameValue(q, [keyed(q) + 0.5, keyed(q) * 2]); },
  'c11-coefficient-variation-reasoning'(q) {
    const m = q.prompt.match(/mean \$(\d+)\$ and variance \$(\d+)\$/);
    return sameValue(q, m ? [100 * Math.sqrt(+m[2]) / +m[1]] : [keyed(q) / 100]);
  },
  'c11-sample-space-reasoning'(q) { return sameValue(q, [/Two dice/.test(q.prompt) ? 36 - keyed(q) : keyed(q) + 2]); },
  'c11-compound-event-reasoning'(q) { return sameValue(q, [1 - keyed(q), keyed(q) * 100]); }
};
