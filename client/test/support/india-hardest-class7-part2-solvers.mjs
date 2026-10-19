// Independent solvers for the Class VII Part II hardest-level (D3) forms
// (client/src/engine/generators/india-class7-part2-hardest.js).
//
// Nothing here imports the generator. Each solver reads the numbers back out
// of the rendered prompt and re-solves by a different route — brute-force
// search, simulation, coordinates or enumeration — checks the solution is
// unique where that matters, and compares with the key. NEAR_MISS lists
// answers a student could plausibly write that must be marked WRONG.

const close = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const nums = s => (s.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
const key = q => q.answer.value;
const verdict = (got, q, label = '') => (close(got, key(q)) ? [] : [`${label}re-derived ${got} vs keyed ${key(q)}`]);
/** A decimal string as an exact fraction of integers: "3.75" → [375, 100]. */
const exact = s => { const [w, f = ''] = s.split('.'); return [Number(w + f), 10 ** f.length]; };
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
/** Angle (degrees) at vertex V between points P and Q. */
const angleAt = (V, P, Q) => {
  const u = [P[0] - V[0], P[1] - V[1]], v = [Q[0] - V[0], Q[1] - V[1]];
  return Math.acos((u[0] * v[0] + u[1] * v[1]) / (Math.hypot(...u) * Math.hypot(...v))) * 180 / Math.PI;
};
const neighbours = v => [v + 1, v - 1, -v, v * 10, v / 10, v * 100, v / 100].filter(x => x !== v && Number.isFinite(x)).map(x => String(Number(x.toFixed(10))));

/**
 * Every question the statistical-question form may show, labelled by hand:
 * true when its answers vary across a group so data must be collected,
 * false when it has one fixed answer. Items whose label could reasonably be
 * argued either way are kept out of the generator altogether.
 */
const STATISTICAL_LABELS = {
  'How many hours of sleep do the students of Class VII get on a school night?': true,
  'How long does each student in our class take to travel to school?': true,
  'How many runs did the batters in last season’s IPL usually score in a match?': true,
  'What are the heights of the players in the school kabaddi team?': true,
  'How much pocket money do the students in our school get each week?': true,
  'How many books did each family in our building read last month?': true,
  'What was the highest temperature on each day of May in our city?': true,
  'How many siblings do the students in Class VII have?': true,
  'How many glasses of water do my classmates drink in a day?': true,
  'How many minutes do the students of our school spend on homework each evening?': true,
  'How tall is the Qutub Minar?': false,
  'How many days are there in March?': false,
  'What is the capital of Karnataka?': false,
  'How many players are there in a cricket team on the field?': false,
  'In which year did India become a republic?': false,
  'How many sides does a hexagon have?': false,
  'How far is it from my house to my school?': false,
  'What is my roll number in class?': false,
  'How many states share a border with Telangana?': false,
  'What was the score of India in yesterday’s match?': false
};

export const SOLVE = {
  'c7-congruent-matching-reasoning'(q) {
    const m = q.prompt.match(/triangle (\w)(\w)(\w) \\cong \\triangle (\w)(\w)(\w)/);
    if (!m) return ['could not read the congruence'];
    const map = { [m[1]]: m[4], [m[2]]: m[5], [m[3]]: m[6] };
    const back = Object.fromEntries(Object.entries(map).map(([k, v]) => [v, k]));
    let a = q.prompt.match(/\\angle (\w) = (\d+)\^\\circ\$ and \$\\angle (\w) = (\d+)\^\\circ\$\. Find \$\\angle (\w)\$/);
    if (a) {
      // Collect the first triangle's angles; search 1..178 for the unknown.
      const known = { [a[1]]: Number(a[2]), [back[a[3]]]: Number(a[4]) };
      if (Object.keys(known).length !== 2 || known[a[5]] !== undefined) return ['angles do not name two different vertices and a third'];
      const sols = [];
      for (let x = 1; x < 180; x++) if (x + Number(a[2]) + Number(a[4]) === 180) sols.push(x);
      return sols.length === 1 ? verdict(sols[0], q) : [`${sols.length} solutions`];
    }
    a = q.prompt.match(/\$(\w\w) = (\d+)\$ cm and \$(\w\w) = (\d+)\$ cm\. The perimeter of \$\\triangle \w+\$ is \$(\d+)\$ cm\. Find the length of \$(\w\w)\$/);
    if (!a) return ['could not read the sides'];
    const target = back[a[6][0]] + back[a[6][1]];
    const norm = s => s.split('').sort().join('');
    const known = [norm(a[1]), norm(a[3])];
    if (known.includes(norm(target)) || known[0] === known[1]) return ['asked side is one of the given ones'];
    const side = Number(a[5]) - Number(a[2]) - Number(a[4]);
    const sides = [Number(a[2]), Number(a[4]), side];
    if (sides.some((s, i) => s <= 0 || s >= sides.reduce((t, x) => t + x, 0) - s)) return ['no triangle'];
    return verdict(side, q);
  },
  'c7-sss-sas-reasoning'(q) {
    const m = q.prompt.match(/BAD = (\d+)\^\\circ\$ and \$\\angle BCD = (\d+)\^\\circ\$\. Find \$\\angle (\w+)\$/);
    if (!m) return ['could not read the kite'];
    const [a, c] = [Number(m[1]), Number(m[2])];
    // Build the kite: A at origin, axis AC along x; B above, D below.
    const h = Math.tan((a / 2) * Math.PI / 180);
    // B = (t, t*h); angle BCA = c/2 with C = (s, 0): find s by bisection on the angle at C.
    const B = [1, h];
    let lo = 1 + 1e-9, hi = 1e6;
    for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (angleAt([mid, 0], B, [0, 0]) > c / 2) lo = mid; else hi = mid; }
    const A = [0, 0], C = [(lo + hi) / 2, 0];
    const got = { ABC: angleAt(B, A, C), BCA: angleAt(C, B, A), BAC: angleAt(A, B, C) }[m[3]];
    return close(got, key(q), 1e-6) ? [] : [`coordinates ${got} vs ${key(q)}`];
  },
  'c7-congruence-inference-reasoning'(q) {
    const m = q.prompt.match(/BAC = (\d+)\^\\circ\$.*Find \$\\angle (\w+)\$/);
    if (!m) return ['could not read the triangle'];
    const a = Number(m[1]) * Math.PI / 180;
    const B = [0, 0], C = [1, 0], A = [0.5, 0.5 / Math.tan(a / 2)];
    // D on AC with BD = BC = 1: walk along CA and find the second point at distance 1 from B.
    let D = null;
    for (let i = 1; i <= 200000; i++) {
      const t = i / 200000, P = [C[0] + t * (A[0] - C[0]), C[1] + t * (A[1] - C[1])];
      if (Math.hypot(...P) >= 1) { D = P; break; }
    }
    if (!D) return ['D not on AC'];
    const got = { ABD: angleAt(B, A, D), ADB: angleAt(D, A, B), DBC: angleAt(B, D, C) }[m[2]];
    return close(got, key(q), 0.01) && Number.isInteger(key(q)) ? [] : [`coordinates ${got} vs ${key(q)}`];
  },
  'c7-integer-product-sign-reasoning'(q) {
    const m = q.prompt.match(/list \$([^$]+)\$.*the (greatest|smallest) product/);
    if (!m) return ['could not read the list'];
    const s = m[1].split(',\\ ').map(Number);
    let best = m[2] === 'greatest' ? -Infinity : Infinity;
    for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) for (let k = j + 1; k < s.length; k++) {
      const p = s[i] * s[j] * s[k];
      best = m[2] === 'greatest' ? Math.max(best, p) : Math.min(best, p);
    }
    return verdict(best, q);
  },
  'c7-integer-division-reasoning'(q) {
    let m = q.prompt.match(/at 6 p\.m\. was \$(-?\d+)\^\\circ\$C, and at (midnight|(\d+) p\.m\.|(\d+) a\.m\. the next day) it was \$(-?\d+)\^\\circ\$C\..*\$(\d+)\$ hours after 6 p\.m\./);
    if (m) {
      // Hours after 6 p.m.: an evening time, midnight, or a time the next morning.
      const h = m[2] === 'midnight' ? 6 : m[3] ? Number(m[3]) - 6 : Number(m[4]) + 6;
      if (m[3] && (Number(m[3]) < 7 || Number(m[3]) > 11)) return ['evening time out of range'];
      if (m[4] && (Number(m[4]) < 1 || Number(m[4]) > 11)) return ['morning time out of range'];
      let T = Number(m[1]);
      const drop = (Number(m[1]) - Number(m[5])) / h;
      if (!Number.isInteger(drop) || drop <= 0) return ['not a steady whole-degree fall'];
      for (let hour = 0; hour < Number(m[6]); hour++) T -= drop;   // simulate hour by hour
      return verdict(T, q);
    }
    m = q.prompt.match(/divided by \$\(?(-?\d+)\)?\$, the answer is \$\(?(-?\d+)\)?\$\. .*divided by \$\(?(-?\d+)\)?\$/);
    if (!m) return ['could not read the division'];
    const [a, qq, b] = m.slice(1).map(Number);
    const sols = [];
    for (let x = -5000; x <= 5000; x++) if (x / a === qq) sols.push(x);
    if (sols.length !== 1 || sols[0] % b !== 0) return ['number not unique or not divisible'];
    return verdict(sols[0] / b, q);
  },
  'c7-integer-expression-reasoning'(q) {
    const m = q.prompt.match(/\$\(?(-?\d+)\)? \\times \\square ([+-]) \(?(-?\d+)\)? \\div \(?(-?\d+)\)? = (-?\d+)\$/);
    if (!m) return ['could not read the expression'];
    const [a, , b, c, R] = [Number(m[1]), m[2], Number(m[3]), Number(m[4]), Number(m[5])];
    const sols = [];
    for (let x = -500; x <= 500; x++) {
      const v = m[2] === '-' ? a * x - b / c : a * x + b / c;
      if (v === R) sols.push(x);
    }
    return sols.length === 1 ? verdict(sols[0], q) : [`${sols.length} solutions`];
  },
  'c7-hcf-reasoning'(q) {
    const n = nums(q.prompt);
    if (n.length !== 6) return ['could not read the numbers'];
    const [N1, N2, N3, r1, r2, r3] = n;
    for (let d = Math.min(N1, N2, N3); d >= 1; d--) {
      if (N1 % d === r1 && N2 % d === r2 && N3 % d === r3) return verdict(d, q);
    }
    return ['no divisor found'];
  },
  'c7-lcm-reasoning'(q) {
    let m = q.prompt.match(/greater than \$(\d+)\$ that leaves a remainder of \$\d+\$ when divided by each of \$(\d+)\$, \$(\d+)\$ and \$(\d+)\$/);
    if (m) {
      const [r, a, b, c] = m.slice(1).map(Number);
      for (let x = r + 1; x < 1e6; x++) if (x % a === r && x % b === r && x % c === r) return verdict(x, q);
      return ['none found'];
    }
    m = q.prompt.match(/the (greatest|smallest) 4-digit number .* each of \$(\d+)\$, \$(\d+)\$ and \$(\d+)\$/);
    if (!m) return ['could not read the divisors'];
    const [a, b, c] = m.slice(2).map(Number);
    const all = [];
    for (let x = 1000; x <= 9999; x++) if (x % a === 0 && x % b === 0 && x % c === 0) all.push(x);
    if (!all.length) return ['no 4-digit multiple'];
    return verdict(m[1] === 'greatest' ? all[all.length - 1] : all[0], q);
  },
  'c7-hcf-lcm-context-reasoning'(q) {
    let m = q.prompt.match(/\$(\d+)\$ cm long and \$(\d+)\$ cm wide/);
    if (m) {
      const [L, W] = m.slice(1).map(Number);
      let s = Math.min(L, W);
      while (L % s || W % s) s--;
      return verdict((L / s) * (W / s), q);
    }
    m = q.prompt.match(/every \$(\d+)\$, \$(\d+)\$ and \$(\d+)\$ minutes\. At (\d+) a\.m\. they ring together\..*including (\d+ a\.m\.|noon|\d+ p\.m\.)/);
    if (!m) return ['could not read the bells'];
    const [a, b, c, start] = m.slice(1, 5).map(Number);
    const end = m[5] === 'noon' ? 12 : m[5].endsWith('p.m.') ? Number(m[5].split(' ')[0]) + 12 : Number(m[5].split(' ')[0]);
    let count = 0;
    for (let t = 1; t <= (end - start) * 60; t++) if (t % a === 0 && t % b === 0 && t % c === 0) count++;
    return verdict(count, q);
  },
  'c7-decimal-multiplication-reasoning'(q) {
    let m = q.prompt.match(/find \$([\d.]+) \\times ([\d.]+)\$/);
    if (m) {
      const [a, da] = exact(m[1]), [b, db] = exact(m[2]);
      return verdict((a * b) / (da * db), q);
    }
    m = q.prompt.match(/\$([\d.]+) \\times \\square = ([\d.]+)\$/);
    if (!m) return ['could not read the product'];
    const [a, da] = exact(m[1]), [p, dp] = exact(m[2]);
    // box = (p/dp) / (a/da); check it is a terminating decimal and multiply back.
    const num = p * da, den = dp * a, g = gcd(num, den);
    let d = den / g; while (d % 2 === 0) d /= 2; while (d % 5 === 0) d /= 5;
    if (d !== 1) return ['missing factor does not terminate'];
    const box = num / den;
    return verdict(box, q);
  },
  'c7-decimal-division-reasoning'(q) {
    const m = q.prompt.match(/find \$([\d.]+) \\div ([\d.]+)\$/);
    if (!m) return ['could not read the division'];
    const [n, dn] = exact(m[1]), [d, dd] = exact(m[2]);
    const num = n * dd, den = dn * d;
    // Long division by repeated subtraction, digit by digit.
    let whole = Math.floor(num / den), rem = num % den, out = String(whole), places = 0;
    if (rem) out += '.';
    while (rem && places < 6) { rem *= 10; out += Math.floor(rem / den); rem %= den; places++; }
    if (rem) return ['quotient does not terminate'];
    return verdict(Number(out), q);
  },
  'c7-decimal-context-reasoning'(q) {
    const m = q.prompt.match(/distance of \$([\d.]+)\$ km\. Their car runs \$([\d.]+)\$ km on one litre .* costs ₹\$([\d.]+)\$ per litre/);
    if (!m) return ['could not read the journey'];
    const [D, dD] = exact(m[1]), [M, dM] = exact(m[2]), [P, dP] = exact(m[3]);
    // cost in paise = D/dD ÷ M/dM × P/dP × 100, exactly.
    const num = D * dM * P * 100, den = dD * M * dP;
    if (num % den) return ['cost is not a whole number of paise'];
    return verdict(num / den / 100, q);
  },
  'c7-statistical-question-reasoning'(q) {
    const parts = q.prompt.split(/\(\d\) /).slice(1).map(s => s.replace(/ How many of the five.*$/, '').trim());
    if (parts.length !== 5) return ['could not read five questions'];
    // Classify from the labelled list below, never by keywords: an item the
    // list does not know is a failure, so a new or reworded item must be
    // labelled here by a person before it can pass.
    const out = [];
    let count = 0;
    for (const p of parts) {
      if (!Object.hasOwn(STATISTICAL_LABELS, p)) { out.push(`unlabelled item: ${p}`); continue; }
      if (STATISTICAL_LABELS[p]) count++;
    }
    return out.length ? out : verdict(count, q);
  },
  'c7-mean-reasoning'(q) {
    let m = q.prompt.match(/of \$(\d+)\$ students .* as \$(\d+)\$\. .* copied as \$(\d+)\$ instead of \$(\d+)\$/);
    if (m) {
      const [n, mean, w, c] = m.slice(1).map(Number);
      const marks = Array(n).fill(mean);           // any data with this mean
      marks[0] += c - w;                           // swap the wrong mark for the right one
      return verdict(marks.reduce((s, x) => s + x, 0) / n, q);
    }
    m = q.prompt.match(/mean of \$(\d+)\$ runs in \$(\d+)\$ innings\. .* raise the mean to \$(\d+)\$/);
    if (!m) return ['could not read the mean'];
    const [mean, n, target] = m.slice(1).map(Number);
    for (let x = 0; x <= 400; x++) if ((mean * n + x) === target * (n + 1)) return verdict(x, q);
    return ['no score works'];
  },
  'c7-range-display-reasoning'(q) {
    const m = q.prompt.match(/tests are \$([^$]+)\$.*range of the \d+ scores is \$(\d+)\$/);
    if (!m) return ['could not read the scores'];
    const vals = m[1].split(',\\ ').filter(v => v !== 'x').map(Number);
    const R = Number(m[2]);
    const sols = [];
    for (let x = 0; x <= 100; x++) { const all = [...vals, x]; if (Math.max(...all) - Math.min(...all) === R) sols.push(x); }
    const keyed = [...q.answer.values].sort((a, b) => a - b);
    return JSON.stringify(sols) === JSON.stringify(keyed) ? [] : [`values ${sols} vs ${keyed}`];
  },
  'c7-perpendicular-bisector-reasoning'(q) {
    const m = q.prompt.match(/PAB = (\d+)\^\\circ\$ and \$\\angle QAB = (\d+)\^\\circ\$\. Find \$\\angle (\w+)\$/);
    if (!m) return ['could not read the angles'];
    const [p, qq] = [Number(m[1]), Number(m[2])];
    const A = [-1, 0], B = [1, 0];
    const P = [0, Math.tan(p * Math.PI / 180)], Q = [0, Math.tan(qq * Math.PI / 180)];
    const got = { APQ: angleAt(P, A, Q), PAQ: angleAt(A, P, Q), AQB: angleAt(Q, A, B), APB: angleAt(P, A, B) }[m[3]];
    return close(got, key(q), 1e-6) ? [] : [`coordinates ${got} vs ${key(q)}`];
  },
  'c7-angle-construction-reasoning'(q) {
    const m = q.prompt.match(/\$\\angle AOB\$ is constructed at \$O\$ (as a right angle|to measure \$(\d+)\^\\circ\$)/);
    if (!m) return ['could not read the first angle'];
    // Rays as unit vectors; a bisector is the normalised sum of the two arms.
    const unit = d => [Math.cos(d * Math.PI / 180), Math.sin(d * Math.PI / 180)];
    const rays = { A: unit(0), X: unit(180), B: unit(m[1] === 'as a right angle' ? 90 : Number(m[2])) };
    for (const b of q.prompt.matchAll(/\\angle (\w)O(\w)\$ is bisected by ray \$O(\w)\$/g)) {
      const s = [rays[b[1]][0] + rays[b[2]][0], rays[b[1]][1] + rays[b[2]][1]], l = Math.hypot(...s);
      rays[b[3]] = [s[0] / l, s[1] / l];
    }
    const ask = q.prompt.match(/Find \$\\angle (\w)O(\w)\$/);
    if (!ask || !rays[ask[1]] || !rays[ask[2]]) return ['could not read the asked angle'];
    const got = angleAt([0, 0], rays[ask[1]], rays[ask[2]]);
    return close(got, key(q), 1e-6) ? [] : [`vectors ${got} vs ${key(q)}`];
  },
  'c7-tiling-invariant-reasoning'(q) {
    const m = q.prompt.match(/\$(\d+)\$ rows and \$(\d+)\$ columns/);
    if (!m) return ['could not read the board'];
    const [rows, cols] = m.slice(1).map(Number);
    const cut = [...q.prompt.matchAll(/\(row \$(\d+)\$, column \$(\d+)\$\)/g)].map(c => `${c[1]},${c[2]}`);
    // Paint the board square by square, alternating along each row.
    let black = 0, white = 0;
    for (let r = 1; r <= rows; r++) {
      let colour = r % 2 === 1 ? 'black' : 'white';
      for (let c = 1; c <= cols; c++) {
        if (!cut.includes(`${r},${c}`)) colour === 'black' ? black++ : white++;
        colour = colour === 'black' ? 'white' : 'black';
      }
    }
    return verdict(Math.abs(black - white), q);
  },
  'c7-balance-reasoning'(q) {
    const m = q.prompt.match(/with \$(\d+)\$ identical .* a \$(\d+)\$ kg weight on the left pan, and \$(\d+)\$ of the same .* a \$(\d+)\$ kg weight on the right pan\. (What is the weight of one|What is the total weight of all)/);
    if (!m) return ['could not read the balance'];
    const [a, b, c, d] = m.slice(1, 5).map(Number);
    const sols = [];
    for (let x = 0.5; x <= 200; x += 0.5) if (a * x + b === c * x + d) sols.push(x);
    if (sols.length !== 1) return [`${sols.length} weights balance`];
    return verdict(m[5].includes('one') ? sols[0] : (a + c) * sols[0], q);
  },
  'c7-one-step-equation-reasoning'(q) {
    const p = q.prompt;
    const find = test => { const s = []; for (let x = -3000; x <= 3000; x++) if (test(x)) s.push(x); return s; };
    let m = p.match(/\$\w \+ \(?(-?\d+)\)? = (-?\d+)\$, what is the value of \$\w - \(?(-?\d+)\)?\$/);
    if (m) { const s = find(x => x + Number(m[1]) === Number(m[2])); return s.length === 1 ? verdict(s[0] - Number(m[3]), q) : ['not unique']; }
    m = p.match(/If \$(-?\d+)\w = (-?\d+)\$, what is the value of \$(-?\d+)\w\$/);
    if (m) { const s = find(x => Number(m[1]) * x === Number(m[2])); return s.length === 1 ? verdict(Number(m[3]) * s[0], q) : ['not unique']; }
    m = p.match(/dfrac\{\w\}\{(\d+)\} = (-?\d+)\$, what is the value of \$\\dfrac\{\w\}\{(\d+)\}/);
    if (m) { const s = find(x => x / Number(m[1]) === Number(m[2])); return s.length === 1 ? verdict(s[0] / Number(m[3]), q) : ['not unique']; }
    return ['could not read the equation'];
  },
  'c7-equation-context-reasoning'(q) {
    const p = q.prompt;
    let m = p.match(/sum of (\d) consecutive multiples of \$(\d+)\$ is \$(\d+)\$\. What is the (largest|smallest)/);
    if (m) {
      const [n, k, S] = m.slice(1, 4).map(Number);
      for (let start = k; start < S; start += k) {
        let sum = 0; for (let i = 0; i < n; i++) sum += start + i * k;
        if (sum === S) return verdict(m[4] === 'largest' ? start + (n - 1) * k : start, q);
      }
      return ['no run of multiples'];
    }
    m = p.match(/^(\w+) is (twice|\d+ times) as old as (\w+), .* In \$(\d+)\$ years, the sum of their ages will be \$(\d+)\$ years\. How old is (\w+) now/);
    if (m) {
      const mult = m[2] === 'twice' ? 2 : Number(m[2].split(' ')[0]);
      const [t, S] = [Number(m[4]), Number(m[5])];
      const sols = [];
      for (let y = 1; y < 100; y++) if ((y + t) + (mult * y + t) === S) sols.push(y);
      if (sols.length !== 1) return ['ages not unique'];
      return verdict(m[6] === m[1] ? mult * sols[0] : sols[0], q);
    }
    m = p.match(/₹\$(\d+)\$ notes and ₹\$(\d+)\$ notes — \$(\d+)\$ notes in all, worth ₹\$(\d+)\$\. How many ₹\$(\d+)\$ notes/);
    if (!m) return ['could not read the context'];
    const [big, small, N, V, ask] = m.slice(1).map(Number);
    const sols = [];
    for (let b = 0; b <= N; b++) if (b * big + (N - b) * small === V) sols.push(b);
    if (sols.length !== 1) return ['notes not unique'];
    return verdict(ask === big ? sols[0] : N - sols[0], q);
  }
};

export const NEAR_MISS = {
  'c7-congruent-matching-reasoning': q => neighbours(key(q)),
  'c7-sss-sas-reasoning': q => [...neighbours(key(q)), String(2 * key(q))],
  'c7-congruence-inference-reasoning': q => neighbours(key(q)),
  'c7-integer-product-sign-reasoning': q => neighbours(key(q)),
  'c7-integer-division-reasoning': q => neighbours(key(q)),
  'c7-integer-expression-reasoning': q => neighbours(key(q)),
  'c7-hcf-reasoning': q => [...neighbours(key(q)), String(key(q) * 2)],
  'c7-lcm-reasoning': q => neighbours(key(q)),
  'c7-hcf-lcm-context-reasoning': q => neighbours(key(q)),
  'c7-decimal-multiplication-reasoning': q => neighbours(key(q)),
  'c7-decimal-division-reasoning': q => neighbours(key(q)),
  'c7-decimal-context-reasoning': q => [...neighbours(key(q)), String(Number((key(q) + 0.01).toFixed(2))), String(Number((key(q) - 0.01).toFixed(2)))],
  'c7-statistical-question-reasoning': q => [0, 1, 2, 3, 4, 5].filter(k => k !== key(q)).map(String),
  'c7-mean-reasoning': q => [...neighbours(key(q)), String(Number((key(q) + 0.01).toFixed(2)))],
  'c7-range-display-reasoning': q => { const [a, b] = q.answer.values; return [String(a), String(b), `${a + 1}, ${b}`, `${a}, ${b - 1}`]; },
  'c7-perpendicular-bisector-reasoning': q => neighbours(key(q)),
  'c7-angle-construction-reasoning': q => [...neighbours(key(q)), String(180 - key(q))].filter(x => Number(x) !== key(q)),
  'c7-tiling-invariant-reasoning': q => neighbours(key(q)).filter(x => Number(x) >= 0 || key(q) !== 0),
  'c7-balance-reasoning': q => neighbours(key(q)),
  'c7-one-step-equation-reasoning': q => neighbours(key(q)),
  'c7-equation-context-reasoning': q => neighbours(key(q))
};
