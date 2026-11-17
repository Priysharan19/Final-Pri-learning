// Extra forms · Class 11 and JEE, part A. See forms/kit.js.
import { ri, numeric, span, person, place, r6, C, terminates } from './kit.js';

const R = d => span(d, 20, 15);
const gcd = (x, y) => (y ? gcd(y, x % y) : x);
const pascal = (n, k) => { const row = [1]; for (let i = 1; i <= n; i++) for (let j = i; j >= 1; j--) row[j] = (row[j] || 0) + row[j - 1]; return row[k] || 0; };
const perm = (n, k) => { let v = 1; for (let i = 0; i < k; i++) v *= n - i; return v; };
const fact = n => (n <= 1 ? 1 : n * fact(n - 1));
const dg = r => (r * 180) / Math.PI, rad = x => (x * Math.PI) / 180;

// ── c11-trig-functions ───────────────────────────────────────────────────────
const SOLS = [
  { fn: 'sin', val: '\\dfrac12', angles: [30, 150], f: x => Math.sin(rad(x)), v: 0.5 },
  { fn: 'sin', val: '-\\dfrac12', angles: [210, 330], f: x => Math.sin(rad(x)), v: -0.5 },
  { fn: 'cos', val: '\\dfrac12', angles: [60, 300], f: x => Math.cos(rad(x)), v: 0.5 },
  { fn: 'cos', val: '-\\dfrac12', angles: [120, 240], f: x => Math.cos(rad(x)), v: -0.5 },
  { fn: 'sin', val: '1', angles: [90], f: x => Math.sin(rad(x)), v: 1 },
  { fn: 'cos', val: '-1', angles: [180], f: x => Math.cos(rad(x)), v: -1 }
];
const DIV360 = [1, 2, 3, 4, 5, 6, 8, 9, 10, 12, 15, 18, 20, 24, 30, 36, 40, 45, 60, 72, 90, 120, 180, 360];
const trigFns = [
  { form: 'table-value', make(rng, d) {
    const a = ri(rng, 1, R(d)), b = ri(rng, 1, R(d)), c = ri(rng, 1, R(d)), e = ri(rng, 1, R(d));
    return {
      payload: numeric('table-value', `Evaluate $${a}\\sin 30^\\circ + ${b}\\cos 60^\\circ + ${c}\\tan 45^\\circ - ${e}\\sin 90^\\circ$.`, r6((a + b) / 2 + c - e), {
        hints: ['Use the standard values: $\\sin 30^\\circ$, $\\cos 60^\\circ$, $\\tan 45^\\circ$ and $\\sin 90^\\circ$.', '$\\sin 30^\\circ = \\cos 60^\\circ = \\dfrac12$.', '$\\tan 45^\\circ = \\sin 90^\\circ = 1$.'],
        steps: [{ h: 'Replace each ratio', d: '$\\tfrac12$, $\\tfrac12$, $1$, $1$' }, { h: 'Combine', d: 'multiply by the coefficients and add' }],
        traps: [{ value: r6(a + b + c - e), why: '$\\sin 30^\\circ$ and $\\cos 60^\\circ$ are $\\tfrac12$, not $1$.' }]
      }),
      check: () => r6(a * Math.sin(rad(30)) + b * Math.cos(rad(60)) + c * Math.tan(rad(45)) - e * Math.sin(rad(90)))
    };
  } },
  { form: 'arc-length', make(rng, d) {
    const r = 7 * ri(rng, 1, R(d)), t = ri(rng, 1, 8);
    return {
      payload: numeric('arc-length', `A sector of a circular garden in ${place(rng)} has radius $${r}$ m and angle $${45 * t}^\\circ$. Taking $\\pi = \\dfrac{22}{7}$, find the length of its curved edge in metres.`, r6((r / 7) * 5.5 * t), {
        hints: ['The arc length is $\\dfrac{\\theta}{360^\\circ}$ of the circumference.', 'Circumference is $2\\pi r$.', '$45^\\circ$ is one eighth of a full turn.'],
        steps: [{ h: 'Fraction of the circle', d: `$\\dfrac{${45 * t}}{360}$` }, { h: 'Circumference', d: `$2\\times\\dfrac{22}{7}\\times ${r}$` }, { h: 'Multiply', d: 'fraction times circumference' }],
        traps: [{ value: r6(2 * (22 / 7) * r), why: 'That is the full circumference; the edge is only a fraction of it.' }]
      }),
      check: () => r6(2 * (22 / 7) * r * (45 * t / 360))
    };
  } },
  { form: 'solution-count', make(rng, d) {
    const s = SOLS[ri(rng, 0, SOLS.length - 1)], n = ri(rng, 1, R(d) * 2);
    return {
      payload: numeric('solution-count', `How many angles $x$ with $0^\\circ \\le x < ${360 * n}^\\circ$ satisfy $\\${s.fn}\\,x = ${s.val}$?`, s.angles.length * n, {
        hints: ['Find the solutions in one turn, $0^\\circ \\le x < 360^\\circ$.', 'The function repeats every $360^\\circ$.', 'Multiply the number of solutions per turn by the number of turns.'],
        steps: [{ h: 'One turn', d: `$${s.angles.length}$ solution${s.angles.length > 1 ? 's' : ''}` }, { h: 'Turns', d: `$${n}$ full turns` }],
        traps: [{ value: s.angles.length, why: 'The interval holds many full turns, and each repeats the solutions.' }]
      }),
      check: () => { let c = 0; for (let x = 0; x < 360 * n; x++) if (Math.abs(s.f(x) - s.v) < 1e-9) c += 1; return c; }
    };
  } },
  { form: 'period', make(rng) {
    const a = DIV360[ri(rng, 0, DIV360.length - 1)];
    let b = a;
    while (b === a) b = DIV360[ri(rng, 0, DIV360.length - 1)];
    return {
      payload: numeric('period', `Find the smallest positive period, in degrees, of $\\sin(${a}x) + \\cos(${b}x)$.`, (() => { const p = 360 / a, q = 360 / b; return (p / gcd(p, q)) * q; })(), {
        hints: ['$\\sin(ax)$ repeats every $\\dfrac{360^\\circ}{a}$.', 'The sum repeats when both parts repeat together.', 'Take the lowest common multiple of the two periods.'],
        steps: [{ h: 'Periods', d: `$\\dfrac{360}{${a}} = ${360 / a}$ and $\\dfrac{360}{${b}} = ${360 / b}$` }, { h: 'LCM', d: 'the smallest angle that is a whole number of both periods' }],
        traps: [{ value: 360 / Math.max(a, b), why: 'The sum needs both terms to repeat, which can take longer than the shorter period.' }]
      }),
      check: () => { for (let p = 1; p <= 360; p++) { let ok = true; for (let j = 0; j < 60 && ok; j++) if (Math.abs(Math.sin(rad(a * (j * 7.31 + 0.123 + p))) - Math.sin(rad(a * (j * 7.31 + 0.123)))) > 1e-9 || Math.abs(Math.cos(rad(b * (j * 7.31 + 0.123 + p))) - Math.cos(rad(b * (j * 7.31 + 0.123)))) > 1e-9) ok = false; if (ok) return p; } return NaN; }
    };
  } }
];

// ── c11-permutations-combinations ────────────────────────────────────────────
const pnc = [
  { form: 'committee', make(rng, d) {
    const m = ri(rng, 4, R(d)), n = ri(rng, 4, R(d)), a = ri(rng, 2, Math.min(m, 6)), b = ri(rng, 2, Math.min(n, 6));
    return {
      payload: numeric('committee', `A school council in ${place(rng)} is chosen from $${m}$ Class XI students and $${n}$ Class XII students. In how many ways can it be formed with $${a}$ from Class XI and $${b}$ from Class XII?`, C(m, a) * C(n, b), {
        hints: ['The two choices are independent.', 'Choose the Class XI members, then the Class XII members.', 'Multiply the two counts.'],
        steps: [{ h: 'Class XI', d: `$\\binom{${m}}{${a}}$` }, { h: 'Class XII', d: `$\\binom{${n}}{${b}}$` }, { h: 'Multiply', d: 'independent choices' }],
        traps: [{ value: C(m + n, a + b), why: 'That ignores the requirement of how many come from each class.' }]
      }),
      check: () => pascal(m, a) * pascal(n, b)
    };
  } },
  { form: 'at-least-one', make(rng, d) {
    const n = ri(rng, 6, R(d)), k = ri(rng, 2, Math.min(5, n - 1)), g = ri(rng, 1, n - k);
    return {
      payload: numeric('at-least-one', `A team of $${k}$ is chosen from $${n}$ players, of whom $${g}$ are goalkeepers. In how many ways does the team contain at least one goalkeeper?`, C(n, k) - C(n - g, k), {
        hints: ['Count all teams first.', 'Then count the teams with no goalkeeper.', 'The difference is the answer.'],
        steps: [{ h: 'All teams', d: `$\\binom{${n}}{${k}}$` }, { h: 'No goalkeeper', d: `$\\binom{${n - g}}{${k}}$` }, { h: 'Subtract', d: 'complement counting' }],
        traps: [{ value: g * C(n - 1, k - 1), why: 'Teams with several goalkeepers are counted more than once.' }].filter(t => t.value !== C(n, k) - C(n - g, k))
      }),
      check: () => { let c = 0; const go = (start, left, hasG) => { if (!left) { if (hasG) c += 1; return; } for (let i = start; i < n; i++) go(i + 1, left - 1, hasG || i < g); }; if (n <= 16) { go(0, k, false); return c; } return pascal(n, k) - pascal(n - g, k); }
    };
  } },
  { form: 'repeated-letters', make(rng, d) {
    const cs = [ri(rng, 1, 3 + d), ri(rng, 1, 3 + d), ri(rng, 1, 3 + d), ri(rng, 1, 3 + d)], n = cs.reduce((s, x) => s + x, 0);
    return {
      payload: numeric('repeated-letters', `A word has $${n}$ letters made of four kinds: $${cs[0]}$ of one kind, $${cs[1]}$ of a second, $${cs[2]}$ of a third and $${cs[3]}$ of a fourth, the letters of one kind being identical. How many different arrangements of all the letters are there?`, (() => { let v = 1, left = n; for (const c of cs) { v *= pascal(left, c); left -= c; } return v; })(), {
        hints: ['Identical letters make some arrangements the same.', 'Divide the arrangements of $n$ distinct objects by the arrangements within each identical group.', 'Or choose positions for each kind in turn.'],
        steps: [{ h: 'Total', d: `$${n}!$` }, { h: 'Divide', d: `by $${cs.map(c => c + '!').join('\\cdot ')}$` }],
        traps: [{ value: fact(n), why: 'This treats the identical letters as different.' }]
      }),
      check: () => { let v = fact(n); for (const c of cs) v /= fact(c); return Math.round(v); }
    };
  } },
  { form: 'reverse', make(rng, d) {
    const n = ri(rng, 3, 4 * R(d));
    return {
      payload: numeric('reverse', `${person(rng)} finds that $^nP_2 = ${n * (n - 1)}$. Find $n$.`, n, {
        hints: ['$^nP_2 = n(n - 1)$.', 'Form the quadratic and solve it.', 'Reject the negative root, since $n$ counts objects.'],
        steps: [{ h: 'Expand', d: '$n(n-1) = $ the given value' }, { h: 'Solve', d: 'the quadratic has one positive root' }],
        traps: [{ value: n - 1, why: 'The two factors are $n$ and $n - 1$; the larger one is $n$.' }]
      }),
      check: () => { for (let t = 2; t <= 4 * R(d) + 2; t++) if (perm(t, 2) === n * (n - 1)) return t; return NaN; }
    };
  } }
];

// ── c11-arrangement-reasoning ────────────────────────────────────────────────
const arrange = [
  { form: 'digit-even', make(rng, d) {
    const k = ri(rng, 2, 5), m = ri(rng, k + 1, 9), digits = [2 * ri(rng, 0, 4)];
    while (digits.length < m) { const x = ri(rng, 0, 9); if (!digits.includes(x)) digits.push(x); }
    digits.sort((a, b) => a - b);
    void d;
    const count = () => { let c = 0; const go = (pos, used) => { if (pos === k) { c += 1; return; } for (const x of digits) { if (used.has(x) || (pos === 0 && x === 0) || (pos === k - 1 && x % 2 !== 0)) continue; used.add(x); go(pos + 1, used); used.delete(x); } }; go(0, new Set()); return c; };
    return {
      payload: numeric('digit-even', `How many even ${k}-digit numbers can be formed from the digits $${digits.join(', ')}$ with no digit repeated? (A number cannot start with $0$.)`, count(), {
        hints: ['Fill the units place first, since it must be even.', 'Then fill the first place, which cannot be $0$, and then the rest.', 'Treat the case where the units digit is $0$ separately if $0$ is available.'],
        steps: [{ h: 'Units place', d: 'choose an even digit from the set' }, { h: 'First place', d: 'not $0$, and not already used' }, { h: 'Middle places', d: 'any unused digits' }],
        traps: [{ value: count() * 2, why: 'Only the numbers ending in an even digit are wanted, not all of them.' }]
      }),
      check: () => { let c = 0; const lo = Math.pow(10, k - 1), hi = Math.pow(10, k); for (let v = lo; v < hi; v++) { const s = String(v); if (v % 2 !== 0) continue; if (new Set(s).size !== k) continue; if ([...s].every(ch => digits.includes(Number(ch)))) c += 1; } return c; }
    };
  } },
  { form: 'letter-kinds', make(rng, d) {
    const cs = Array.from({ length: 5 }, () => ri(rng, 1, 3 + Math.min(d, 2))), n = cs.reduce((s, x) => s + x, 0);
    return {
      payload: numeric('letter-kinds', `A signboard in ${place(rng)} uses $${n}$ letter tiles of five kinds: $${cs.join(', ')}$ tiles of the kinds respectively, tiles of one kind being identical. In how many different orders can all the tiles be placed in a row?`, (() => { let v = 1, left = n; for (const c of cs) { v *= pascal(left, c); left -= c; } return v; })(), {
        hints: ['Identical tiles make some orders the same.', 'Choose places for the first kind, then for the second among the rest, and so on.', 'Or divide $n!$ by the factorial of each count.'],
        steps: [{ h: 'Total', d: `$${n}!$` }, { h: 'Divide', d: 'by the factorial of each count' }],
        traps: [{ value: fact(n), why: 'This treats identical tiles as different.' }]
      }),
      check: () => { let v = fact(n); for (const c of cs) v /= fact(c); return Math.round(v); }
    };
  } },
  { form: 'together', make(rng, d) {
    const n = ri(rng, 5, Math.min(17, 9 + 2 * d)), k = ri(rng, 2, Math.min(n - 1, 7));
    return {
      payload: numeric('together', `In how many ways can $${n}$ friends stand in a row for a photograph so that $${k}$ particular friends stand together?`, fact(n - k + 1) * fact(k), {
        hints: ['Treat the group that must stay together as one block.', 'Arrange the block with the other friends.', 'The members of the block can be arranged among themselves.'],
        steps: [{ h: 'Block', d: `$${n - k + 1}$ units to arrange` }, { h: 'Units', d: `$${n - k + 1}!$` }, { h: 'Inside the block', d: `$${k}!$` }],
        traps: [{ value: fact(n), why: 'This ignores the condition.' }, { value: fact(n - k + 1), why: 'The block\'s members can also swap places.' }]
      }),
      check: () => { let c = 0; const nn = n - k; for (let p = 0; p <= nn; p++) c += fact(k) * fact(nn); return c; }
    };
  } },
  { form: 'not-together', make(rng, d) {
    const n = ri(rng, 4, Math.min(17, 11 + 2 * d));
    return {
      payload: numeric('not-together', `${n} people queue at a ticket counter in ${place(rng)}. In how many ways can they line up so that two particular people are not next to each other?`, fact(n) - 2 * fact(n - 1), {
        hints: ['Count all arrangements, then subtract those where the two are adjacent.', 'Adjacent arrangements: treat the pair as one block, and allow two orders.', 'Subtract.'],
        steps: [{ h: 'All', d: `$${n}!$` }, { h: 'Adjacent', d: `$2\\times ${n - 1}!$` }, { h: 'Subtract', d: 'complement' }],
        traps: [{ value: 2 * fact(n - 1), why: 'That is the number of arrangements where they ARE together.' }]
      }),
      check: () => { let c = 0; for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) if (a !== b && Math.abs(a - b) !== 1) c += fact(n - 2); return c; }
    };
  } },
  { form: 'alternate', make(rng, d) {
    const w = ri(rng, 3, 5 + d), same = ri(rng, 0, 1), m = same ? w : w + 1;
    return {
      payload: numeric('alternate', `$${m}$ boys and $${w}$ girls sit in a row so that no two boys sit together and no two girls sit together. How many arrangements are there?`, same ? 2 * fact(m) * fact(w) : fact(m) * fact(w), {
        hints: ['The sexes must alternate along the row.', same ? 'With equal numbers, the row can start with a boy or a girl.' : 'With one more boy than girls, the row must start and end with a boy.', 'Arrange the boys among their seats and the girls among theirs.'],
        steps: [{ h: 'Pattern', d: same ? 'two possible patterns' : 'one possible pattern' }, { h: 'Boys', d: `$${m}!$` }, { h: 'Girls', d: `$${w}!$` }],
        traps: [{ value: fact(m + w), why: 'This ignores the alternation.' }]
      }),
      check: () => { const pat = same ? 2 : 1; return pat * fact(m) * fact(w); }
    };
  } },
  { form: 'digit-numbers', make(rng, d) {
    const k = ri(rng, 2, 5);
    const pool = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], digits = [];
    const m = ri(rng, k + 1, 9);
    while (digits.length < m) { const x = pool[ri(rng, 0, 9)]; if (!digits.includes(x)) digits.push(x); }
    digits.sort((a, b) => a - b);
    void d;
    return {
      payload: numeric('digit-numbers', `How many ${k}-digit numbers can be formed from the digits $${digits.join(', ')}$ if no digit is repeated? (A number cannot start with $0$.)`, (() => { let c = 0; const go = (pos, used, first) => { if (pos === k) { c += 1; return; } for (const x of digits) { if (used.has(x) || (pos === 0 && x === 0)) continue; used.add(x); go(pos + 1, used, first); used.delete(x); } }; go(0, new Set(), true); return c; })(), {
        hints: ['Fill the places one at a time, from the left.', 'The first place cannot be $0$; later places can use any unused digit.', 'Multiply the number of choices at each place.'],
        steps: [{ h: 'First place', d: digits.includes(0) ? `$${digits.length - 1}$ choices (not $0$)` : `$${digits.length}$ choices` }, { h: 'Remaining places', d: 'one fewer choice each time' }],
        traps: [{ value: perm(digits.length, k), why: 'Numbers beginning with $0$ are not $' + k + '$-digit numbers; remove them.' }].filter(t => digits.includes(0))
      }),
      check: () => { const nz = digits.filter(x => x !== 0).length; return nz * perm(digits.length - 1, k - 1); }
    };
  } }
];

// ── c11-statistics ───────────────────────────────────────────────────────────
function dataset(rng, n, spread) {
  // Positive, all different observations, so no variance or deviation is zero and no list repeats a value.
  for (;;) {
    const mean = ri(rng, 25, 70), xs = Array.from({ length: n - 1 }, () => mean + ri(rng, -spread, spread));
    const last = mean * n - xs.reduce((s, x) => s + x, 0), all = [...xs, last];
    if (all.every(x => x > 0) && new Set(all).size === n) return all;
  }
}
const stats = [
  { form: 'mean-deviation', make(rng, d) {
    const n = [4, 5, 8, 10][ri(rng, 0, 3)], xs = dataset(rng, n, 5 + 3 * d), mean = xs.reduce((s, x) => s + x, 0) / n;
    return {
      payload: numeric('mean-deviation', `The daily temperatures (°C) recorded in ${place(rng)} over $${n}$ days were $${xs.join(', ')}$. Find the mean deviation about the mean.`, r6(xs.reduce((s, x) => s + Math.abs(x - mean), 0) / n), {
        hints: ['Find the mean first.', 'Take the distance of each value from the mean, ignoring signs.', 'Average those distances.'],
        steps: [{ h: 'Mean', d: `$\\bar{x} = ${mean}$` }, { h: 'Absolute deviations', d: '$|x_i - \\bar{x}|$' }, { h: 'Average', d: 'sum, divided by $n$' }],
        traps: [{ value: 0, why: 'Signed deviations from the mean cancel to zero; mean deviation uses absolute values.' }]
      }),
      check: () => { let s = 0; for (const x of xs) s += Math.abs(x - mean); return r6(s / n); }
    };
  } },
  { form: 'variance', make(rng, d) {
    const n = [4, 5, 8, 10][ri(rng, 0, 3)], xs = dataset(rng, n, 4 + 2 * d), mean = xs.reduce((s, x) => s + x, 0) / n;
    return {
      payload: numeric('variance', `A cricketer scored $${xs.join(', ')}$ in $${n}$ innings. Find the variance of these scores.`, r6(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / n), {
        hints: ['Variance is the mean of the squared deviations from the mean.', 'Compute the mean, then each deviation, then square.', 'Divide the sum of squares by $n$.'],
        steps: [{ h: 'Mean', d: `$${mean}$` }, { h: 'Squared deviations', d: '$(x_i - \\bar{x})^2$' }, { h: 'Average', d: 'divide by $n$' }],
        traps: [{ value: r6(Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / n)), why: 'That is the standard deviation; variance is its square.' }]
      }),
      check: () => { const m = xs.reduce((s, x) => s + x, 0) / n; return r6(xs.reduce((s, x) => s + x * x, 0) / n - m * m); }
    };
  } },
  { form: 'missing-value', make(rng, d) {
    const n = ri(rng, 4, 9), xs = dataset(rng, n, 6 + 3 * d), mean = xs.reduce((s, x) => s + x, 0) / n, missing = xs[n - 1];
    return {
      payload: numeric('missing-value', `The mean of $${n}$ observations is $${mean}$. Of them, $${n - 1}$ are $${xs.slice(0, -1).join(', ')}$. Find the remaining observation.`, missing, {
        hints: ['The sum of all observations is the mean times the count.', 'Add the known observations.', 'Subtract to find the missing one.'],
        steps: [{ h: 'Total', d: `$${n}\\times ${mean}$` }, { h: 'Known', d: 'sum of the given values' }, { h: 'Missing', d: 'total minus known' }],
        traps: [{ value: mean, why: 'The missing value balances the others; it is not simply the mean.' }].filter(t => t.value !== missing)
      }),
      check: () => { let s = 0; for (let i = 0; i < n - 1; i++) s += xs[i]; return mean * n - s; }
    };
  } },
  { form: 'change-of-scale', make(rng, d) {
    const n = [4, 5, 8, 10][ri(rng, 0, 3)], xs = dataset(rng, n, 4 + 2 * d), c = ri(rng, 2, 9), k = ri(rng, 1, R(d)), mean = xs.reduce((s, x) => s + x, 0) / n;
    const variance = xs.reduce((s, x) => s + (x - mean) ** 2, 0) / n;
    return {
      payload: numeric('change-of-scale', `The variance of $${n}$ scores $${xs.join(', ')}$ is known. Each score is multiplied by $${c}$ and then $${k}$ is added. Find the variance of the new scores.`, r6(c * c * variance), {
        hints: ['Adding a constant shifts every value but not the spread.', 'Multiplying by $c$ multiplies each deviation by $c$.', 'Variance squares the deviations.'],
        steps: [{ h: 'Adding $k$', d: 'no effect on variance' }, { h: 'Multiplying by $c$', d: 'variance is multiplied by $c^2$' }],
        traps: [{ value: r6(c * variance), why: 'Variance involves squared deviations, so the factor is $c^2$.' }]
      }),
      check: () => { const ys = xs.map(x => c * x + k), m = ys.reduce((s, x) => s + x, 0) / n; return r6(ys.reduce((s, x) => s + (x - m) ** 2, 0) / n); }
    };
  } }
];

// ── c11-binomial-theorem ─────────────────────────────────────────────────────
const bino = [
  { form: 'coefficient', make(rng, d) {
    const n = ri(rng, 4, 8 + d), a = ri(rng, 1, 9), b = ri(rng, 1, 9), k = ri(rng, 1, n - 1);
    return {
      payload: numeric('coefficient', `Find the coefficient of $x^{${k}}$ in the expansion of $(${a === 1 ? '' : a}x + ${b})^{${n}}$.`, pascal(n, k) * a ** k * b ** (n - k), {
        hints: ['Use the general term $T_{r+1} = \\binom{n}{r}A^{n-r}B^{r}$.', 'Match the power of $x$ to find which term is needed.', 'Evaluate the binomial coefficient and both powers.'],
        steps: [{ h: 'General term', d: `$\\binom{${n}}{r}(${a}x)^{r}(${b})^{${n}-r}$` }, { h: 'Match', d: `$r = ${k}$` }, { h: 'Evaluate', d: `$\\binom{${n}}{${k}}${a}^{${k}}${b}^{${n - k}}$` }],
        traps: [{ value: pascal(n, k), why: 'The numbers $' + a + '$ and $' + b + '$ are raised to powers too.' }].filter(() => a * b !== 1)
      }),
      check: () => { let c = 1; for (let i = 0; i < k; i++) c = (c * (n - i)) / (i + 1); return Math.round(c) * a ** k * b ** (n - k); }
    };
  } },
  { form: 'sum-of-coefficients', make(rng, d) {
    const n = ri(rng, 3, 5 + d);
    let a = 0, b = 0;
    do { a = ri(rng, 1, 9 + 4 * d); b = ri(rng, -9 - 4 * d, 9 + 4 * d); } while (Math.abs(a + b) <= 1);
    return {
      payload: numeric('sum-of-coefficients', `Find the sum of all the coefficients in the expansion of $(${a}x ${b < 0 ? '-' : '+'} ${Math.abs(b)})^{${n}}$.`, (a + b) ** n, {
        hints: ['Every power of $x$ becomes $1$ if you substitute $x = 1$.', 'Then the polynomial equals the sum of its coefficients.', 'Evaluate the bracket at $x = 1$ and raise it to the power.'],
        steps: [{ h: 'Substitute', d: '$x = 1$' }, { h: 'Evaluate', d: `$(${a} ${b < 0 ? '-' : '+'} ${Math.abs(b)})^{${n}}$` }],
        traps: [{ value: 2 ** n, why: '$2^n$ is the sum of the coefficients of $(1 + x)^n$, not of this expansion.' }].filter(t => t.value !== (a + b) ** n)
      }),
      check: () => { let s = 0; for (let k = 0; k <= n; k++) s += pascal(n, k) * a ** k * b ** (n - k); return s; }
    };
  } },
  { form: 'constant-term', make(rng, d) {
    const q = ri(rng, 1, 4 + Math.floor(d / 2)), n = 3 * q, a = ri(rng, 1, 5);
    const r = 2 * q;
    return {
      payload: numeric('constant-term', `Find the constant term in the expansion of $\\left(x^2 + \\dfrac{${a}}{x}\\right)^{${n}}$.`, pascal(n, r) * a ** r, {
        hints: ['Write the general term and collect the power of $x$.', `The term with $r$ factors of $\\dfrac{${a}}{x}$ has $x^{${2 * n}-3r}$.`, 'Set the power to $0$ and solve for $r$.'],
        steps: [{ h: 'General term', d: `$\\binom{${n}}{r}(x^2)^{${n}-r}\\left(\\dfrac{${a}}{x}\\right)^r$` }, { h: 'Power of $x$', d: `$${2 * n} - 3r = 0$` }, { h: 'Evaluate', d: `$r = ${r}$` }],
        traps: [{ value: pascal(n, r), why: 'The factor $' + a + '^{' + r + '}$ belongs to the term.' }].filter(() => a !== 1)
      }),
      check: () => { for (let rr = 0; rr <= n; rr++) if (2 * (n - rr) - rr === 0) return pascal(n, rr) * a ** rr; return NaN; }
    };
  } },
  { form: 'reverse', make(rng, d) {
    const n = ri(rng, 3, 20 + 8 * d);
    return {
      payload: numeric('reverse', `The coefficient of $x^2$ in the expansion of $(1 + x)^n$ is $${pascal(n, 2)}$. Find $n$.`, n, {
        hints: ['The coefficient of $x^2$ is $\\binom{n}{2}$.', 'Write it as $\\dfrac{n(n-1)}{2}$.', 'Solve the quadratic and keep the positive root.'],
        steps: [{ h: 'Coefficient', d: '$\\binom{n}{2} = \\dfrac{n(n-1)}{2}$' }, { h: 'Equate', d: `$n(n-1) = ${2 * pascal(n, 2)}$` }],
        traps: [{ value: pascal(n, 2), why: 'That is the coefficient, not $n$.' }]
      }),
      check: () => { for (let t = 2; t <= 20 + 8 * d + 2; t++) if (pascal(t, 2) === pascal(n, 2)) return t; return NaN; }
    };
  } }
];

// ── c11-conic-sections ───────────────────────────────────────────────────────
const sgnStr = v => (v < 0 ? `- ${-v}` : `+ ${v}`);
const conics = [
  { form: 'circle-radius', make(rng, d) {
    const h = ri(rng, -R(d), R(d)), k = ri(rng, -R(d), R(d)), r = ri(rng, 1, R(d));
    const c = h * h + k * k - r * r;
    return {
      payload: numeric('circle-radius', `Find the radius of the circle $x^2 + y^2 ${sgnStr(-2 * h)}x ${sgnStr(-2 * k)}y ${sgnStr(c)} = 0$.`, r, {
        hints: ['Complete the square in $x$ and in $y$.', 'Or use $r^2 = g^2 + f^2 - c$ for $x^2 + y^2 + 2gx + 2fy + c = 0$.', 'Take the positive square root.'],
        steps: [{ h: 'Identify', d: `$g = ${-h}$, $f = ${-k}$, $c = ${c}$` }, { h: 'Radius', d: '$r = \\sqrt{g^2 + f^2 - c}$' }],
        traps: [{ value: r * r, why: 'That is $r^2$; take the square root.' }].filter(t => r > 1)
      }),
      check: () => { const g = -h, f = -k; return Math.round(Math.sqrt(g * g + f * f - c)); }
    };
  } },
  { form: 'diameter-ends', make(rng, d) {
    const x1 = ri(rng, -R(d), R(d)), y1 = ri(rng, -R(d), R(d)), t = [[3, 4], [6, 8], [5, 12], [8, 15], [9, 12]][ri(rng, 0, 4)], s = ri(rng, 1, 3);
    const dx = 2 * t[0] * s, dy = 2 * t[1] * s;
    return {
      payload: numeric('diameter-ends', `A circle has the points $(${x1}, ${y1})$ and $(${x1 + dx}, ${y1 + dy})$ as the ends of a diameter. Find its radius.`, Math.hypot(dx, dy) / 2, {
        hints: ['The length of the diameter is the distance between the two points.', 'The radius is half the diameter.', 'Use the distance formula.'],
        steps: [{ h: 'Diameter', d: `$\\sqrt{${dx}^2 + ${dy}^2}$` }, { h: 'Halve', d: 'radius is half of that' }],
        traps: [{ value: Math.hypot(dx, dy), why: 'That is the diameter, not the radius.' }]
      }),
      check: () => Math.sqrt((dx / 2) ** 2 + (dy / 2) ** 2)
    };
  } },
  { form: 'parabola-latus', make(rng, d) {
    const a = ri(rng, 1, 3 * R(d));
    return {
      payload: numeric('parabola-latus', `Find the length of the latus rectum of the parabola $y^2 = ${4 * a}x$.`, 4 * a, {
        hints: ['Compare with $y^2 = 4px$.', 'The focus is at $(p, 0)$.', 'The latus rectum has length $4p$.'],
        steps: [{ h: 'Compare', d: `$4p = ${4 * a}$` }, { h: 'Latus rectum', d: '$4p$' }],
        traps: [{ value: a, why: 'The focal distance is $' + a + '$; the latus rectum is the chord through the focus, of length $4p$.' }]
      }),
      check: () => { const x = a; const y = Math.sqrt(4 * a * x); return Math.round(2 * y); }
    };
  } },
  { form: 'focus-reverse', make(rng, d) {
    const a = ri(rng, 1, 3 * R(d));
    return {
      payload: numeric('focus-reverse', `The focus of the parabola $y^2 = kx$ is at $(${a}, 0)$. Find $k$.`, 4 * a, {
        hints: ['For $y^2 = kx$, the focus is $\\left(\\dfrac{k}{4}, 0\\right)$.', 'Equate the focus to the given point.', 'Solve for $k$.'],
        steps: [{ h: 'Focus', d: '$x = \\dfrac{k}{4}$' }, { h: 'Solve', d: `$\\dfrac{k}{4} = ${a}$` }],
        traps: [{ value: a, why: '$k$ is four times the focal distance.' }]
      }),
      check: () => { for (let k = 1; k <= 12 * R(d); k++) if (k / 4 === a) return k; return NaN; }
    };
  } }
];

export const BAND_11_A = {
  'c11-trig-functions': trigFns,
  'c11-permutations-combinations': pnc,
  'c11-arrangement-reasoning': arrange,
  'c11-statistics': stats,
  'c11-binomial-theorem': bino,
  'c11-conic-sections': conics
};
void [dg, terminates, C];
