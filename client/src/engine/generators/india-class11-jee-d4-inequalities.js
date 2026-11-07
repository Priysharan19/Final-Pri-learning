// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · NCERT Class 11 Linear Inequalities — JEE D4 forms, one per
// dot point (issue #408)
//
// The JEE Main and JEE Advanced tracks reached this chapter's hardest level
// (D4) through the whole-chapter generator, whose D4 rung counted the integers
// in |ax + b| < c — one routine template for all three dot points. That rung
// is retired; the three forms below replace it, one per dot point.
//
// What makes each one D4 rather than another D3 is that it joins two separate
// ideas, not that its numbers are bigger:
//
//  · c11-linear-inequality-jee-reasoning (dot point 0, one variable)
//      interval-containment — solve an inequality with fractions (the direction
//        reverses when the collected coefficient of x is negative), THEN ask
//        that a whole interval of x lies in the solution ray: only its far end
//        binds, and the strict/non-strict bound on k gives the extremal integer.
//      natural-count — solve for x (with the reversal), THEN turn "exactly N
//        natural-number solutions" into a unit window for the end point, and
//        count (or take the extreme of) the integers k that land in it.
//      sign-casework — (k − p)x op uk + w for every x in an interval: the
//        coefficient of x changes sign with k, so the cases k > p, k = p and
//        k < p are solved separately (the direction reverses in the last), THEN
//        in each case only one end of the interval binds; the cases combine
//        into one interval of k.
//  · c11-inequality-system-jee-reasoning (dot point 1, systems)
//      exact-count — a fixed inequality and one with a parameter a: solve both
//        (one may reverse), THEN translate "exactly N integer solutions" into a
//        window for a, and count / take the extreme of the integers in it.
//      three-inequalities — two fixed inequalities give a finite set of integer
//        solutions; a third carries k. "At least one INTEGER solution" is decided
//        at an end of that set, not at the real end point.
//  · c11-inequality-region-jee-reasoning (dot point 2, two variables)
//      lattice-count — four half-planes; read off which side of each line is
//        kept, THEN count lattice points column by column with strict lines
//        excluded.
//      region-area — find the corner points (which line binds where, one of the
//        listed constraints sometimes redundant), THEN the exact area.
//      area-parameter — a rectangle cut by ax + by ≤ k has a given area: decide
//        from the areas at the corner values of k whether the region is a
//        triangle, a trapezium or the rectangle with a corner cut off, THEN solve
//        that piece's equation for k, rejecting the root outside the piece.
//      moving-point — a point depending on k lies in a region given by three
//        half-planes: substituting turns the region into a system in k (with
//        reversals), THEN count / take the extreme of the integers k.
//
// Scope is NCERT Class 11 Linear Inequalities as JEE Main / Advanced examine it:
// linear inequalities in one and two variables, their systems and graphs. No
// modulus or quadratic inequalities and no linear programming are used.
//
// Provenance. Original, parameterised forms written for Pri Learning — not
// transcribed from NCERT exercises, the exemplar or past papers. Every keyed
// answer is computed from the drawn parameters, never typed, and
// client/test/support/india-jee-d4-inequalities-solvers.mjs re-derives each one
// from the rendered prompt by an independent route (direct substitution over k,
// x and lattice points; half-plane clipping for areas). Human maths review is
// pending; no board or examiner approval is claimed.
//
// Asked for any rung other than D4, each generator returns its D4 form.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, nz, gcd, makeRng } from '../qhelpers.js';
import { exact as exactForm, frac, fracTex, traps } from './india-native-helpers.js';

/** An exact answer that also accepts its exact decimal (see india-class11-jee-hardest.js). */
function exact(f, suffix) {
  const out = exactForm(f, suffix);
  if (out.answer.simplestFraction) out.answer = { ...out.answer, requireFraction: false };
  return out;
}

// ── Exact rationals ──────────────────────────────────────────────────────────
const R = (n, d = 1) => frac(n, d);
const rTex = f => fracTex(f.n, f.d);
const floorQ = f => Math.floor(f.n / f.d);
const ceilQ = f => Math.ceil(f.n / f.d);
const isInt = f => f.d === 1;
const add = (x, y) => R(x.n * y.d + y.n * x.d, x.d * y.d);
const mulQ = (x, y) => R(x.n * y.n, x.d * y.d);

// ── Operators ────────────────────────────────────────────────────────────────
const OPS = ['<', '<=', '>', '>='];
const TEX = { '<': '<', '<=': '\\le', '>': '>', '>=': '\\ge' };
const FLIP = { '<': '>', '<=': '>=', '>': '<', '>=': '<=' };
const strict = op => op === '<' || op === '>';
const upward = op => op === '>' || op === '>=';     // "x > …" is a lower bound on x
const holdsOp = (l, op, r) => (op === '<' ? l < r : op === '<=' ? l <= r : op === '>' ? l > r : l >= r);

/** The extreme integer k with k OP K: greatest for < and ≤, least for > and ≥. */
function extremal(K, OP) {
  if (OP === '<') return ceilQ(K) - 1;
  if (OP === '<=') return floorQ(K);
  if (OP === '>') return floorQ(K) + 1;
  return ceilQ(K);
}

/** The integers in an interval whose ends are rationals, each open or closed. */
function intsIn(lo, loClosed, hi, hiClosed) {
  const first = loClosed ? ceilQ(lo) : floorQ(lo) + 1;
  const last = hiClosed ? floorQ(hi) : ceilQ(hi) - 1;
  return { first, last, count: Math.max(0, last - first + 1) };
}

// ── Formatting ───────────────────────────────────────────────────────────────
const sg = k => (k >= 0 ? `+ ${k}` : `- ${Math.abs(k)}`);
const cx = (c, v = 'x') => (c === 1 ? v : c === -1 ? `-${v}` : `${c}${v}`);
function lin(a, b, v = 'x') {
  if (a === 0) return String(b);
  return b === 0 ? cx(a, v) : `${cx(a, v)} ${sg(b)}`;
}
/** "3x - 2y", "-x + 4y", "5y" — a linear form in x and y without a constant. */
function linXY(A, B) {
  if (A === 0) return cx(B, 'y');
  if (B === 0) return cx(A, 'x');
  return `${cx(A, 'x')} ${B > 0 ? '+' : '-'} ${Math.abs(B) === 1 ? '' : Math.abs(B)}y`;
}
/** A linear expression over a positive integer denominator: \dfrac{…}{d}, or the expression when d = 1. */
const over = (num, d) => (d === 1 ? num : `\\dfrac{${num}}{${d}}`);
const par = v => (v < 0 ? `(${v})` : String(v));
/** (c·v + d)/den in lowest terms, den > 0: \dfrac{3k - 1}{10}, or 3k - 1 when den divides out. */
function linOver(c, d, den, v) {
  const g = gcd(gcd(Math.abs(c), Math.abs(d)), den);
  return over(lin(c / g, d / g, v), den / g);
}
const ineqTex = (A, B, op, C) => `${linXY(A, B)} ${TEX[op]} ${C}`;
/** Consecutive integers a … b inside $…$: "a", "a$ and $b", "a$, $a+1$ and $b", or "a, \ldots, b". */
const run = (a, b) => (b === a ? `${a}` : b - a === 1 ? `${a}$ and $${b}` : b - a === 2 ? `${a}$, $${a + 1}$ and $${b}` : `${a}, \\ldots, ${b}`);
const andList = items => (items.length === 1 ? items[0] : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

const FALLBACK_SEED = 0x494e4551;   // "INEQ"

// ═════════════════════════════════════════════════════════════════════════════
// Dot point 0 · Solve a linear inequality in one variable and graph the solution
// ═════════════════════════════════════════════════════════════════════════════

function linearInequalityReasoning(rng) {
  const kind = rc(rng, ['interval-containment', 'natural-count', 'sign-casework']);
  const askOnce = rc(rng, ['count', 'count', 'greatest', 'least']);   // drawn once so retries keep it
  for (let guard = 0; guard < 600; guard++) {
    if (kind === 'interval-containment') {
      // (ax ± k)/m  op  (bx + c)/n  for every x in [α, β].
      const m = ri(rng, 2, 6), n = ri(rng, 2, 6);
      if (m === n) continue;
      const a = nz(rng, -6, 6), b = nz(rng, -6, 6), c = nz(rng, -9, 9), s = rng() < 0.5 ? 1 : -1;
      const op = rc(rng, OPS);
      const e = n * a - m * b;                       // collected coefficient of x
      if (e === 0 || Math.abs(e) > 30) continue;
      if (e > 0 && rng() < 0.55) continue;           // a reversal most of the time
      if (gcd(gcd(Math.abs(b), Math.abs(c)), n) > 1) continue;    // a fraction that does not cancel
      const alpha = ri(rng, -6, 3), beta = alpha + ri(rng, 2, 7);
      // n·s·k  op  m·c − e·x must hold at every x; the binding end is where the
      // right side is smallest (op < / ≤) or largest (op > / ≥).
      const worst = (!upward(op)) === (e > 0) ? beta : alpha;
      const other = worst === beta ? alpha : beta;
      const bound = x => (s > 0 ? { K: R(m * c - e * x, n), OP: op } : { K: R(e * x - m * c, n), OP: FLIP[op] });
      const { K, OP } = bound(worst);
      const value = extremal(K, OP);
      if (Math.abs(value) > 60 || Math.abs(K.n / K.d) > 60) continue;
      const word = upward(OP) ? 'least' : 'greatest';
      const wrongEnd = extremal(bound(other).K, OP);
      // Solving for x: e·x op m·c − n·s·k.
      const xOp = e > 0 ? op : FLIP[op];
      const ray = e > 0 ? linOver(-n * s, m * c, e, 'k') : linOver(n * s, -m * c, -e, 'k');
      const numL = `${cx(a)} ${s > 0 ? '+' : '-'} k`;
      const ineq = `\\dfrac{${numL}}{${m}} ${TEX[op]} \\dfrac{${lin(b, c)}}{${n}}`;
      const trapList = [
        { value: wrongEnd, why: `That value only makes the inequality hold at $x = ${other}$; at the other end of the interval, $x = ${worst}$, it fails${e < 0 ? ' — this is what happens if the direction is not reversed on dividing by the negative coefficient of $x$' : ''}.` }
      ];
      if (isInt(K) && strict(OP)) trapList.push({ value: K.n, why: `At $k = ${K.n}$ the two sides are equal at $x = ${worst}$, and the inequality is strict.` });
      if (!isInt(K)) trapList.push({ value: upward(OP) ? floorQ(K) : ceilQ(K), why: `That value is on the wrong side of the bound on $k$, so the inequality fails at $x = ${worst}$.` });
      trapList.push({ value: upward(OP) ? value - 1 : value + 1, why: `With that $k$ the inequality fails at $x = ${worst}$.` });
      return {
        prompt: `Find the ${word} integer $k$ such that every real number $x$ with $${alpha} \\le x \\le ${beta}$ satisfies $${ineq}$.`,
        answerType: 'numeric', answer: { value },
        traps: traps(value, trapList),
        hints: [
          'Multiply both sides by the (positive) product of the denominators, then collect the $x$ terms on one side.',
          'Dividing by the coefficient of $x$ reverses the inequality when that coefficient is negative; the solution set is then a ray on the number line.',
          'A closed interval lies inside a ray exactly when its end nearer the ray\'s boundary does, so only one end gives a condition on $k$. Check whether the bound on $k$ itself is allowed.'
        ],
        steps: [
          { h: 'Clear the denominators', d: `Multiply by $${m * n}$: $${n}(${numL}) ${TEX[op]} ${m}(${lin(b, c)})$, so $${cx(e)} ${TEX[op]} ${lin(-n * s, m * c, 'k')}$` },
          { h: 'Solve for x', d: `${e < 0 ? `The coefficient $${e}$ is negative, so the inequality reverses: ` : ''}$x ${TEX[xOp]} ${ray}$ — a ray ${upward(xOp) ? 'to the right' : 'to the left'} on the number line` },
          { h: 'The interval inside the ray', d: `$[${alpha}, ${beta}]$ lies inside it exactly when the end $x = ${worst}$ does: $${worst} ${TEX[xOp]} ${ray}$` },
          { h: 'Bound on k', d: `$k ${TEX[OP]} ${rTex(K)}$, so the ${word} integer is $${value}$` },
          { h: 'Answer', d: `$k = ${value}$` }
        ],
        reasoning: 'interval-containment'
      };
    }
    if (kind === 'natural-count') {
      // (ax + c)/m  op  (bx + k)/n  →  e·x op m·k − n·c, solved as x < U(k) or x ≤ U(k).
      const m = ri(rng, 2, 6), n = ri(rng, 2, 6);
      if (m === n) continue;
      const a = nz(rng, -6, 6), b = nz(rng, -6, 6), c = nz(rng, -9, 9);
      const e = n * a - m * b;
      if (e === 0 || Math.abs(e) <= m || Math.abs(e) > 24) continue;
      if (gcd(gcd(Math.abs(a), Math.abs(c)), m) > 1) continue;
      if (e > 0 && rng() < 0.6) continue;
      const op = e > 0 ? rc(rng, ['<', '<=']) : rc(rng, ['>', '>=']);
      const xOp = e > 0 ? op : FLIP[op];                     // < or ≤
      const N = ri(rng, 2, 6);
      // k-window for "exactly N natural solutions": strict x < U needs N < U ≤ N + 1,
      // x ≤ U needs N ≤ U < N + 1. U = (m·k − n·c)/e, so k = (e·U + n·c)/m.
      const kWindow = N0 => {
        const uLo = { v: N0, closed: !strict(xOp) }, uHi = { v: N0 + 1, closed: strict(xOp) };
        const toK = u => R(e * u + n * c, m);
        return e > 0
          ? { lo: toK(uLo.v), loClosed: uLo.closed, hi: toK(uHi.v), hiClosed: uHi.closed }
          : { lo: toK(uHi.v), loClosed: uHi.closed, hi: toK(uLo.v), hiClosed: uLo.closed };
      };
      const W = kWindow(N);
      const ks = intsIn(W.lo, W.loClosed, W.hi, W.hiClosed);
      if (ks.count < 1 || Math.abs(ks.first) > 80 || Math.abs(ks.last) > 80) continue;
      const ask = askOnce;
      if (ask === 'count' && ks.count < 2) continue;
      // Integer ends make the open/closed decision matter; prefer them.
      if (!isInt(W.lo) && !isInt(W.hi) && rng() < 0.75) continue;
      const pick = I => (ask === 'count' ? I.count : ask === 'greatest' ? I.last : I.first);
      const value = pick(ks);
      const Wz = kWindow(N - 1);                              // N among 0, 1, 2, … = N − 1 naturals
      const wholeTrap = intsIn(Wz.lo, Wz.loClosed, Wz.hi, Wz.hiClosed);
      const trapList = [];
      if (wholeTrap.count) trapList.push({ value: pick(wholeTrap), why: 'That counts solutions among $0, 1, 2, \\ldots$; the natural numbers start at $1$, so $x = 0$ is not one of them.' });
      if (ask === 'count') {
        trapList.push({ value: intsIn(W.lo, true, W.hi, true).count, why: 'That treats both ends of the interval for $k$ as included, but one of them is not.' });
        trapList.push({ value: intsIn(W.lo, false, W.hi, false).count, why: 'That treats both ends of the interval for $k$ as excluded, but one of them is included.' });
        const width = R(Math.abs(e), m);
        if (!isInt(width)) trapList.push({ value: value === floorQ(width) ? ceilQ(width) : floorQ(width), why: 'That goes by the length of the interval for $k$; the number of integers in it depends on where its ends fall.' });
      } else {
        const end = ask === 'greatest' ? { q: W.hi, closed: W.hiClosed } : { q: W.lo, closed: W.loClosed };
        if (!end.closed && isInt(end.q)) trapList.push({ value: end.q.n, why: `At $k = ${end.q.n}$ the number of natural-number solutions is not $${N}$.` });
        trapList.push({ value: ask === 'greatest' ? ks.first : ks.last, why: `That value works, but it is the ${ask === 'greatest' ? 'least' : 'greatest'} such $k$, not the ${ask}.` });
      }
      if (traps(value, trapList).length < 2) continue;             // keep draws with two misconceptions to offer
      const ineq = `\\dfrac{${lin(a, c)}}{${m}} ${TEX[op]} \\dfrac{${lin(b, 0)} + k}{${n}}`;
      const question = ask === 'count'
        ? `For how many integers $k$ does the inequality $${ineq}$ have exactly $${N}$ solutions in natural numbers $x$?`
        : `Find the ${ask} integer $k$ for which the inequality $${ineq}$ has exactly $${N}$ solutions in natural numbers $x$.`;
      const U = e > 0 ? linOver(m, -n * c, e, 'k') : linOver(-m, n * c, -e, 'k');
      const uRange = strict(xOp) ? `${N} < ${U} \\le ${N + 1}` : `${N} \\le ${U} < ${N + 1}`;
      return {
        prompt: question,
        answerType: 'numeric', answer: { value },
        traps: traps(value, trapList),
        hints: [
          'Clear the denominators and collect the $x$ terms; mind the direction when you divide by a negative coefficient.',
          'The solutions form a ray $x < U$ or $x \\le U$, where $U$ depends on $k$. The natural numbers in it are $1, 2, \\ldots$ up to the last one below (or at) $U$.',
          'Exactly that many natural solutions pins $U$ between two consecutive integers — decide which end is allowed — and that becomes an interval for $k$.'
        ],
        steps: [
          { h: 'Clear the denominators', d: `$${n}(${lin(a, c)}) ${TEX[op]} ${m}(${lin(b, 0)} + k)$, so $${cx(e)} ${TEX[op]} ${lin(m, -n * c, 'k')}$` },
          { h: 'Solve for x', d: `${e < 0 ? `Dividing by $${e}$ reverses the inequality: ` : ''}$x ${TEX[xOp]} ${U}$` },
          { h: `Exactly ${N} natural solutions`, d: `They must be $${run(1, N)}$ and not $${N + 1}$: $${uRange}$` },
          { h: 'Interval for k', d: `$${rTex(W.lo)} ${W.loClosed ? '\\le' : '<'} k ${W.hiClosed ? '\\le' : '<'} ${rTex(W.hi)}$, whose integers are $${run(ks.first, ks.last)}$` },
          { h: 'Answer', d: ask === 'count' ? `$${value}$ integer value${value === 1 ? '' : 's'} of $k$` : `$k = ${value}$` }
        ],
        reasoning: ask === 'count' ? 'natural-count' : 'natural-count-extreme'
      };
    }
    // sign-casework: (k − p)x op u·k + w for every x in [α, β], with α < u < β.
    const p = nz(rng, -5, 6);
    const alpha = ri(rng, -4, 3), beta = alpha + ri(rng, 2, 6);
    const u = ri(rng, alpha + 1, beta - 1), w = nz(rng, -12, 12);
    const op = rc(rng, OPS);
    // At an end x the condition is (x − u)k op w + p·x; x − u < 0 at α and > 0 at β.
    const endCond = x => ({ x, coef: x - u, rhs: w + p * x, K: R(w + p * x, x - u), D: x - u > 0 ? op : FLIP[op] });
    const cA = endCond(alpha), cB = endCond(beta);
    const lower = upward(cA.D) ? cA : cB, upper = lower === cA ? cB : cA;
    const ks = intsIn(lower.K, !strict(lower.D), upper.K, !strict(upper.D));
    if (ks.count < 3 || ks.count > 30 || Math.abs(ks.first) > 60 || Math.abs(ks.last) > 60) continue;
    if (!(ks.first < p && p < ks.last) && rng() < 0.85) continue;      // both signs of the coefficient usually occur
    const zeroOk = holdsOp(0, op, u * p + w);
    if (zeroOk !== (ks.first <= p && p <= ks.last)) continue;         // cannot happen; kept as a guard
    const ask = rc(rng, ['count', 'count', 'least', 'greatest']);
    const pick = I => (ask === 'count' ? I.count : ask === 'least' ? I.first : I.last);
    const value = pick(ks);
    const above = Math.max(ks.first, p + 1) <= ks.last ? { first: Math.max(ks.first, p + 1), last: ks.last } : null;
    const below = ks.first <= Math.min(ks.last, p - 1) ? { first: ks.first, last: Math.min(ks.last, p - 1) } : null;
    const trapList = [];
    if (ask === 'count') {
      if (zeroOk) trapList.push({ value: value - 1, why: `That leaves out $k = ${p}$: there the coefficient of $x$ is zero and the inequality reads $0 ${TEX[op]} ${u * p + w}$, which is true.` });
      if (above && below) {
        trapList.push({ value: above.last - above.first + 1, why: `That counts only values of $k$ greater than $${p}$; for $k < ${p}$ the inequality reverses on dividing by $k ${sg(-p)}$, and some of those values work too.` });
        trapList.push({ value: below.last - below.first + 1, why: `That counts only values of $k$ less than $${p}$; some values greater than $${p}$ work too.` });
      }
      if (strict(op)) {
        const closed = intsIn(lower.K, true, upper.K, true).count, extra = closed - value;
        trapList.push({ value: closed, why: extra === 1
          ? 'That includes a value of $k$ at which the two sides are equal at an end of the interval, but the inequality is strict.'
          : 'That includes the values of $k$ at which the two sides are equal at an end of the interval, but the inequality is strict.' });
      }
    } else {
      const bind = ask === 'least' ? lower : upper;
      trapList.push({ value: ask === 'least' ? ks.first - 1 : ks.last + 1, why: `With that $k$ the inequality fails at $x = ${bind.x}$.` });
      trapList.push({ value: ask === 'least' ? ks.last : ks.first, why: `That value works, but it is the ${ask === 'least' ? 'greatest' : 'least'} such $k$, not the ${ask}.` });
      if (ask === 'least' && above && ks.first < p) trapList.push({ value: above.first, why: `That is the least value above $${p}$, but values of $k$ below $${p}$, where the inequality reverses, also work.` });
      if (ask === 'greatest' && below && ks.last > p) trapList.push({ value: below.last, why: `That is the greatest value below $${p}$, but values of $k$ above $${p}$ also work.` });
    }
    if (!traps(value, trapList).length) continue;
    const coefTex = `(k ${sg(-p)})`;
    const rhsTex = lin(u, w, 'k');
    const ineq = `${coefTex}x ${TEX[op]} ${rhsTex}`;
    const interval = `$${alpha} \\le x \\le ${beta}$`;
    const question = ask === 'count'
      ? `For how many integers $k$ does the inequality $${ineq}$ hold for every real number $x$ with ${interval}?`
      : `Find the ${ask} integer $k$ for which the inequality $${ineq}$ holds for every real number $x$ with ${interval}.`;
    // For k > p the ray keeps the direction of op; for k < p it reverses.
    const posEnd = upward(op) ? cA : cB, negEnd = posEnd === cA ? cB : cA;
    const times = x => (x === 0 ? '0' : x === 1 ? coefTex : x === -1 ? `-${coefTex}` : `${x}${coefTex}`);
    const caseLine = c => `the interval lies inside the ray exactly when $x = ${c.x}$ does: $${times(c.x)} ${TEX[op]} ${rhsTex}$, ${c.coef === 1 ? '' : `i.e. $${cx(c.coef, 'k')} ${TEX[op]} ${c.rhs}$, `}so $k ${TEX[c.D]} ${rTex(c.K)}$`;
    return {
      prompt: question,
      answerType: 'numeric', answer: { value },
      traps: traps(value, trapList),
      hints: [
        'The coefficient of $x$ depends on $k$. Treat separately the values of $k$ that make it positive, zero and negative.',
        'For each sign, solve for $x$ (reversing when the coefficient is negative) and ask when the whole interval lies in the solution set: in each case only one end of the interval matters.',
        'Do not forget the value of $k$ that makes the coefficient zero. Then combine the cases, keeping strict ends open.'
      ],
      steps: [
        { h: `Case k = ${p}`, d: `The inequality reads $0 ${TEX[op]} ${u * p + w}$, which is ${zeroOk ? 'true for every $x$' : 'false'}` },
        { h: `Case k > ${p}`, d: `Dividing by $k ${sg(-p)} > 0$ keeps the direction: $x ${TEX[op]} \\dfrac{${rhsTex}}{k ${sg(-p)}}$; ${caseLine(posEnd)}` },
        { h: `Case k < ${p}`, d: `Dividing by $k ${sg(-p)} < 0$ reverses it: $x ${TEX[FLIP[op]]} \\dfrac{${rhsTex}}{k ${sg(-p)}}$; multiplying back by the negative $k ${sg(-p)}$, ${caseLine(negEnd)}` },
        { h: 'Combine', d: `With the case ranges, $${rTex(lower.K)} ${strict(lower.D) ? '<' : '\\le'} k ${strict(upper.D) ? '<' : '\\le'} ${rTex(upper.K)}$: the integers $${run(ks.first, ks.last)}$` },
        { h: 'Answer', d: ask === 'count' ? `$${value}$ integers` : `$k = ${value}$` }
      ],
      reasoning: ask === 'count' ? 'sign-casework' : 'sign-casework-extreme'
    };
  }
  return linearInequalityReasoning(makeRng(FALLBACK_SEED));
}

// ═════════════════════════════════════════════════════════════════════════════
// Dot point 1 · Solve a system of linear inequalities in one variable
// ═════════════════════════════════════════════════════════════════════════════

/** (px + q)/m op (rx + s)/n, solved as a LOWER bound on x: { tex, L, strict, steps }. */
function lowerBoundInequality(rng) {
  for (let guard = 0; guard < 200; guard++) {
    const m = ri(rng, 2, 6), n = ri(rng, 2, 6);
    if (m === n) continue;
    const p = nz(rng, -6, 6), q = nz(rng, -9, 9), r = nz(rng, -6, 6), s = nz(rng, -9, 9);
    const e = n * p - m * r;
    if (e === 0 || Math.abs(e) > 20) continue;
    if (gcd(gcd(Math.abs(p), Math.abs(q)), m) > 1 || gcd(gcd(Math.abs(r), Math.abs(s)), n) > 1) continue;
    const op = e > 0 ? rc(rng, ['>', '>=']) : rc(rng, ['<', '<=']);
    const L = R(m * s - n * q, e);
    if (Math.abs(L.n / L.d) > 10 || L.d > 9) continue;
    const xOp = e > 0 ? op : FLIP[op];
    return {
      tex: `\\dfrac{${lin(p, q)}}{${m}} ${TEX[op]} \\dfrac{${lin(r, s)}}{${n}}`,
      L, strict: strict(xOp), e,
      work: `$${n}(${lin(p, q)}) ${TEX[op]} ${m}(${lin(r, s)})$ gives $${cx(e)} ${TEX[op]} ${m * s - n * q}$, so ${e < 0 ? 'reversing on division by a negative, ' : ''}$x ${TEX[xOp]} ${rTex(L)}$`
    };
  }
  return null;
}

function inequalitySystemReasoning(rng) {
  const kind = rc(rng, ['exact-count', 'three-inequalities']);
  for (let guard = 0; guard < 600; guard++) {
    const first = lowerBoundInequality(rng);
    if (!first) continue;
    const { L } = first;
    const x0 = first.strict ? floorQ(L) + 1 : ceilQ(L);            // least integer solution of the first
    if (kind === 'exact-count') {
      // Px + Q op Rx + a  →  (P − R)x op a − Q, solved as an UPPER bound x < U or x ≤ U.
      const P = nz(rng, -6, 6), R2 = ri(rng, -6, 6), Q = nz(rng, -9, 9);
      const e2 = P - R2;
      if (e2 === 0 || Math.abs(e2) < 2 || Math.abs(e2) > 7) continue;
      const op2 = e2 > 0 ? rc(rng, ['<', '<=']) : rc(rng, ['>', '>=']);
      const xOp2 = e2 > 0 ? op2 : FLIP[op2];
      const N = ri(rng, 2, 6);
      // Exactly x0, …, x0 + N − 1: U in [x0+N−1, x0+N) for ≤, (x0+N−1, x0+N] for <.
      const uWin = { lo: x0 + N - 1, loClosed: !strict(xOp2), hi: x0 + N, hiClosed: strict(xOp2) };
      const toA = u => R(e2 * u + Q, 1);
      const W = e2 > 0
        ? { lo: toA(uWin.lo), loClosed: uWin.loClosed, hi: toA(uWin.hi), hiClosed: uWin.hiClosed }
        : { lo: toA(uWin.hi), loClosed: uWin.hiClosed, hi: toA(uWin.lo), hiClosed: uWin.loClosed };
      const as = intsIn(W.lo, W.loClosed, W.hi, W.hiClosed);
      if (as.count < 1 || Math.abs(as.first) > 90 || Math.abs(as.last) > 90) continue;
      const ask = rc(rng, ['count', 'count', 'least', 'greatest']);
      const value = ask === 'count' ? as.count : ask === 'least' ? as.first : as.last;
      const trapList = [];
      if (ask === 'count') {
        trapList.push({ value: intsIn(W.lo, true, W.hi, true).count, why: 'That treats both ends of the interval for $a$ as included, but one of them gives a different number of integer solutions.' });
        trapList.push({ value: intsIn(W.lo, false, W.hi, false).count, why: 'That treats both ends of the interval for $a$ as excluded, but one of them is allowed.' });
      } else {
        const end = ask === 'greatest' ? { v: W.hi.n, closed: W.hiClosed } : { v: W.lo.n, closed: W.loClosed };
        if (!end.closed) trapList.push({ value: end.v, why: `At $a = ${end.v}$ the system does not have exactly $${N}$ integer solutions.` });
        trapList.push({ value: ask === 'greatest' ? as.first : as.last, why: `That value works, but it is the ${ask === 'greatest' ? 'least' : 'greatest'} such $a$, not the ${ask}.` });
        for (const N1 of [N + 1, N - 1]) {
          // The window for N1 solutions: same construction, shifted by one.
          const u1 = { lo: x0 + N1 - 1, hi: x0 + N1 };
          const W1 = e2 > 0
            ? intsIn(toA(u1.lo), uWin.loClosed, toA(u1.hi), uWin.hiClosed)
            : intsIn(toA(u1.hi), uWin.hiClosed, toA(u1.lo), uWin.loClosed);
          if (N1 >= 1 && W1.count) trapList.push({ value: ask === 'least' ? W1.first : W1.last, why: `With that $a$ the system has $${N1}$ integer solutions, not $${N}$.` });
        }
      }
      const second = `${lin(P, Q)} ${TEX[op2]} ${R2 === 0 ? 'a' : `${cx(R2)} + a`}`;
      const sys = `$${first.tex}$ and $${second}$`;
      const question = ask === 'count'
        ? `For how many integers $a$ does the system of inequalities ${sys} have exactly $${N}$ integer solutions $x$?`
        : `Find the ${ask} integer $a$ for which the system of inequalities ${sys} has exactly $${N}$ integer solutions $x$.`;
      const Utex = linOver(Math.sign(e2), -Q * Math.sign(e2), Math.abs(e2), 'a');
      return {
        prompt: question,
        answerType: 'numeric', answer: { value },
        traps: traps(value, trapList),
        hints: [
          'Solve each inequality for $x$ on its own, reversing the direction whenever you divide by a negative number.',
          'The fixed inequality decides the least integer solution. The one with $a$ gives an upper end that moves with $a$.',
          'Exactly that many integer solutions traps the moving end between two consecutive integers; decide which end of that gap is allowed, then turn it into a range for $a$.'
        ],
        steps: [
          { h: 'First inequality', d: first.work },
          { h: 'Least integer solution', d: `$x = ${x0}$` },
          { h: 'Second inequality', d: `$${cx(e2)} ${TEX[op2]} ${lin(1, -Q, 'a')}$, so ${e2 < 0 ? 'reversing, ' : ''}$x ${TEX[xOp2]} ${Utex}$` },
          { h: `Exactly ${N} integers`, d: `The solutions must be $${run(x0, x0 + N - 1)}$ and not $${x0 + N}$: $${x0 + N - 1} ${uWin.loClosed ? '\\le' : '<'} ${Utex} ${uWin.hiClosed ? '\\le' : '<'} ${x0 + N}$` },
          { h: 'Range of a', d: `$${W.lo.n} ${W.loClosed ? '\\le' : '<'} a ${W.hiClosed ? '\\le' : '<'} ${W.hi.n}$: the integers $${run(as.first, as.last)}$` },
          { h: 'Answer', d: ask === 'count' ? `$${value}$ integer value${value === 1 ? '' : 's'} of $a$` : `$a = ${value}$` }
        ],
        reasoning: ask === 'count' ? 'exact-count' : 'exact-count-extreme'
      };
    }
    // three-inequalities: lower bound L, upper bound B, and t·x − k op3 c.
    const P = nz(rng, -6, 6), R2 = ri(rng, -6, 6), Q = nz(rng, -12, 12), S = ri(rng, -12, 12);
    const e2 = P - R2;
    if (e2 === 0 || Math.abs(e2) > 7) continue;
    const op2 = e2 > 0 ? rc(rng, ['<', '<=']) : rc(rng, ['>', '>=']);
    const xOp2 = e2 > 0 ? op2 : FLIP[op2];
    const B = R(S - Q, e2);
    if (B.d === 1 && rng() < 0.6) continue;                       // a fractional end most of the time
    const M = strict(xOp2) ? ceilQ(B) - 1 : floorQ(B);           // greatest integer solution of the second
    if (M - x0 < 1 || M - x0 > 10) continue;
    const t = nz(rng, -5, 5), c3 = nz(rng, -9, 9);
    const op3 = rc(rng, OPS);
    const wantGreatest = upward(op3);                             // t·x − c ≥ k: k is bounded above
    // Extreme of t·x − c over the integer solutions x0 … M.
    const best = wantGreatest ? Math.max(t * x0, t * M) - c3 : Math.min(t * x0, t * M) - c3;
    const worse = wantGreatest ? Math.min(t * x0, t * M) - c3 : Math.max(t * x0, t * M) - c3;
    const value = wantGreatest ? (strict(op3) ? best - 1 : best) : (strict(op3) ? best + 1 : best);
    if (Math.abs(value) > 90) continue;
    const atX = (wantGreatest ? t > 0 : t < 0) ? M : x0;
    // The same question over the reals: sup / inf of t·x − c on the real solution set.
    const realEnd = (wantGreatest ? t > 0 : t < 0) ? { q: B, closed: !strict(xOp2) } : { q: L, closed: !first.strict };
    const ext = add(mulQ(R(t), realEnd.q), R(-c3));
    const attained = realEnd.closed && !strict(op3);
    const realValue = wantGreatest ? (attained ? floorQ(ext) : ceilQ(ext) - 1) : (attained ? ceilQ(ext) : floorQ(ext) + 1);
    const trapList = [
      { value: realValue, why: 'With that $k$ the system still has real solutions, but none of them is an integer.' },
      { value: wantGreatest ? (strict(op3) ? worse - 1 : worse) : (strict(op3) ? worse + 1 : worse), why: `That $k$ works, but a ${wantGreatest ? 'larger' : 'smaller'} one also does: use the integer solution at the other end of the range.` }
    ];
    if (!strict(op3)) trapList.push({ value: wantGreatest ? best + 1 : best - 1, why: 'With that $k$ the third inequality fails at every integer solution of the other two.' });
    if (strict(op3)) trapList.push({ value: best, why: `At $k = ${best}$ the third inequality becomes an equality at $x = ${atX}$, and it is strict.` });
    const word = wantGreatest ? 'greatest' : 'least';
    const second = `${lin(P, Q)} ${TEX[op2]} ${lin(R2, S)}`;
    const third = `${cx(t)} - k ${TEX[op3]} ${c3}`;
    return {
      prompt: `Find the ${word} integer $k$ for which the system $${first.tex}$, $${second}$, $${third}$ has at least one integer solution $x$.`,
      answerType: 'numeric', answer: { value },
      traps: traps(value, trapList),
      hints: [
        'Solve the two inequalities without $k$ first, reversing the direction whenever you divide by a negative number.',
        'Together they allow only finitely many integers. List them.',
        `The third inequality reads $${lin(t, -c3)} ${TEX[op3]} k$; you need it for at least one of those integers, so look at the one that makes the left side ${wantGreatest ? 'largest' : 'smallest'}.`
      ],
      steps: [
        { h: 'First inequality', d: first.work },
        { h: 'Second inequality', d: `$${cx(e2)} ${TEX[op2]} ${S - Q}$, so ${e2 < 0 ? 'reversing, ' : ''}$x ${TEX[xOp2]} ${rTex(B)}$` },
        { h: 'Integer solutions of the two', d: `$x = ${run(x0, M)}$` },
        { h: 'Third inequality', d: `$${lin(t, -c3)} ${TEX[op3]} k$ must hold for some such $x$; $${lin(t, -c3)}$ is ${wantGreatest ? 'largest' : 'smallest'} at $x = ${atX}$, where it is $${best}$` },
        { h: 'Answer', d: `$k ${TEX[FLIP[op3]]} ${best}$, so the ${word} integer is $k = ${value}$` }
      ],
      reasoning: 'three-inequalities'
    };
  }
  return inequalitySystemReasoning(makeRng(FALLBACK_SEED));
}

// ═════════════════════════════════════════════════════════════════════════════
// Dot point 2 · Graph the solution region of linear inequalities in two variables
// ═════════════════════════════════════════════════════════════════════════════

/** Does (x, y) satisfy A·x + B·y op C? */
const holds = (A, B, op, C, x, y) => {
  const v = A * x + B * y;
  return op === '<' ? v < C : op === '<=' ? v <= C : op === '>' ? v > C : v >= C;
};
/** The y-interval a half-plane allows on the column x: { lo?, loClosed, hi?, hiClosed } with B ≠ 0. */
function columnBound(A, B, op, C, x) {
  const yOp = B > 0 ? op : FLIP[op];
  const v = R(C - A * x, B);
  return upward(yOp) ? { lo: v, loClosed: !strict(yOp) } : { hi: v, hiClosed: !strict(yOp) };
}

function inequalityRegionReasoning(rng) {
  const kind = rc(rng, ['lattice-count', 'lattice-count', 'region-area', 'area-parameter', 'area-parameter', 'moving-point', 'moving-point']);
  const shape = rc(rng, ['triangle', 'trapezium', 'cut-rectangle']);     // for area-parameter, drawn once so retries keep it
  const askOnce = rc(rng, ['count', 'count', 'least', 'greatest']);     // for moving-point, likewise
  for (let guard = 0; guard < 800; guard++) {
    if (kind === 'lattice-count') {
      const xl = rc(rng, [0, 0, 1, -1, -2]), yl = rc(rng, [0, 0, 1, -1]);
      const a1 = ri(rng, 1, 5), b1 = ri(rng, 1, 5), c1 = a1 * xl + b1 * yl + ri(rng, 8, 30);
      const op1 = rc(rng, ['<=', '<']);
      const A2 = nz(rng, -4, 4), B2 = nz(rng, -4, 4);
      if (A2 * b1 === B2 * a1) continue;                          // parallel to the first line
      const xMax = floorQ(R(c1 - b1 * yl, a1));
      const px = ri(rng, xl, Math.max(xl, xMax)), py = yl + ri(rng, 0, 3);
      const C2 = A2 * px + B2 * py + ri(rng, -2, 2);
      if (gcd(gcd(Math.abs(A2), Math.abs(B2)), Math.abs(C2)) > 1 || gcd(gcd(a1, b1), Math.abs(c1)) > 1) continue;
      const op2 = rc(rng, OPS);
      const lines = [
        { A: 1, B: 0, op: '>=', C: xl }, { A: 0, B: 1, op: '>=', C: yl },
        { A: a1, B: b1, op: op1, C: c1 }, { A: A2, B: B2, op: op2, C: C2 }
      ];
      // Column by column: y from yl up to the first line, cut by the second.
      const countWith = (use, relax = false, lift = false) => {
        let total = 0;
        const cols = [];
        for (let x = lift ? xl + 1 : xl; x <= xMax; x++) {
          let lo = R(lift ? yl + 1 : yl), loC = true, hi = null, hiC = true;
          for (const [i, ln] of lines.entries()) {
            if (i < 2 || !use[i]) continue;
            const b = columnBound(ln.A, ln.B, relax ? (strict(ln.op) ? `${ln.op}=` : ln.op) : ln.op, ln.C, x);
            if (b.lo) {
              const cmp = b.lo.n * lo.d - lo.n * b.lo.d;
              if (cmp > 0 || (cmp === 0 && !b.loClosed)) { lo = b.lo; loC = b.loClosed; }
            } else if (hi === null || b.hi.n * hi.d - hi.n * b.hi.d < 0 || (b.hi.n * hi.d === hi.n * b.hi.d && !b.hiClosed)) { hi = b.hi; hiC = b.hiClosed; }
          }
          const I = intsIn(lo, loC, hi, hiC);
          cols.push({ x, ...I });
          total += I.count;
        }
        return { total, cols };
      };
      const all = countWith([1, 1, 1, 1]);
      const value = all.total;
      if (value < 8 || value > 90) continue;
      const noSecond = countWith([1, 1, 1, 0]).total;
      if (noSecond - value < 3) continue;
      // The second line must touch the region from inside, not just clip a corner it never enters.
      if (all.cols.filter(c => c.count > 0).length < 3) continue;
      const anyStrict = strict(op1) || strict(op2);
      const trapList = [
        { value: noSecond, why: `That ignores the inequality $${ineqTex(A2, B2, op2, C2)}$.` },
        { value: countWith([1, 1, 1, 1], false, true).total, why: `That leaves out the points on the lines $x = ${xl}$ and $y = ${yl}$, which do satisfy $x \\ge ${xl}$ and $y \\ge ${yl}$.` }
      ];
      if (anyStrict) trapList.unshift({ value: countWith([1, 1, 1, 1], true).total, why: 'That includes points lying on a line whose inequality is strict.' });
      const shown = all.cols.filter(c => c.count > 0);
      return {
        prompt: `How many points $(x, y)$ with integer coordinates satisfy all of $x \\ge ${xl}$, $y \\ge ${yl}$, $${ineqTex(a1, b1, op1, c1)}$ and $${ineqTex(A2, B2, op2, C2)}$?`,
        answerType: 'numeric', answer: { value },
        traps: traps(value, trapList),
        hints: [
          'Draw each boundary line and decide which side is kept by testing a point not on it, such as the origin when it is not on the line.',
          'The region is bounded. Find the range of integer $x$ it covers, then count the integer $y$ allowed on each vertical line $x = $ constant.',
          'A point on a boundary line belongs to the region only if that inequality allows equality.'
        ],
        steps: [
          { h: 'The region', d: `$x \\ge ${xl}$ and $y \\ge ${yl}$ with $${ineqTex(a1, b1, op1, c1)}$ confine $x$ to $${xl} \\le x \\le ${xMax}$; the line $${linXY(A2, B2)} = ${C2}$ then cuts the region` },
          { h: 'Column by column', d: shown.map(c => `$x = ${c.x}$: $y = ${c.first}$ to $${c.last}$ (${c.count})`).join('; ') },
          { h: 'Boundary points', d: `Points on $${linXY(a1, b1)} = ${c1}$ ${strict(op1) ? 'are excluded' : 'are included'}; points on $${linXY(A2, B2)} = ${C2}$ ${strict(op2) ? 'are excluded' : 'are included'}` },
          { h: 'Answer', d: `$${value}$ lattice points` }
        ],
        reasoning: 'lattice-count'
      };
    }
    if (kind === 'region-area') {
      // In shifted coordinates X = x − p0, Y = y − q0, line 1 has intercepts X1, Y1
      // and line 2 has X2, Y2, with X1 < X2 and Y1 > Y2 so they cross in the quadrant.
      const p0 = rc(rng, [0, 0, 0, 1, 2, -1, -2]), q0 = rc(rng, [0, 0, 0, 1, -1, 2]);
      const X1 = ri(rng, 2, 9), X2 = X1 + ri(rng, 1, 6), Y2 = ri(rng, 2, 9), Y1 = Y2 + ri(rng, 1, 6);
      const g1 = gcd(X1, Y1), g2 = gcd(X2, Y2);
      const A1 = Y1 / g1, B1 = X1 / g1, D1 = X1 * Y1 / g1;
      const A2 = Y2 / g2, B2 = X2 / g2, D2 = X2 * Y2 / g2;
      const C1 = D1 + A1 * p0 + B1 * q0, C2 = D2 + A2 * p0 + B2 * q0;
      const det = A1 * B2 - A2 * B1;
      const Px = R(D1 * B2 - D2 * B1, det), Py = R(A1 * D2 - A2 * D1, det);
      const shape = rc(rng, ['under-both', 'between-left', 'between-right']);
      let area, items, trapList, corners;
      const pt = (X, Y) => `(${rTex(add(X, R(p0)))}, ${rTex(add(Y, R(q0)))})`;
      if (shape === 'under-both') {
        area = add(mulQ(R(X1, 2), Py), mulQ(R(Y2, 2), Px));
        items = [`$x \\ge ${p0}$`, `$y \\ge ${q0}$`, `$${ineqTex(A1, B1, '<=', C1)}$`, `$${ineqTex(A2, B2, '<=', C2)}$`];
        corners = [pt(R(0), R(0)), pt(R(X1), R(0)), pt(Px, Py), pt(R(0), R(Y2))];
        trapList = [
          { value: X1 * Y1 / 2, why: `That is the whole triangle under $${linXY(A1, B1)} = ${C1}$; the line $${linXY(A2, B2)} = ${C2}$ cuts a corner off it.` },
          { value: X2 * Y2 / 2, why: `That is the whole triangle under $${linXY(A2, B2)} = ${C2}$; the line $${linXY(A1, B1)} = ${C1}$ cuts a corner off it.` }
        ];
      } else if (shape === 'between-left') {
        area = mulQ(R(Y1 - Y2, 2), Px);
        items = [`$x \\ge ${p0}$`, `$y \\ge ${q0}$`, `$${ineqTex(A1, B1, '<=', C1)}$`, `$${ineqTex(A2, B2, '>=', C2)}$`];   // y ≥ q0 is redundant
        corners = [pt(R(0), R(Y2)), pt(R(0), R(Y1)), pt(Px, Py)];
        trapList = [
          { value: (Y1 - Y2) * Px.n / Px.d, why: 'That is the base times the height; the area of a triangle is half of that.' },
          { value: (Y1 - Y2) * X1 / 2, why: `That runs the triangle out to where $${linXY(A1, B1)} = ${C1}$ meets $y = ${q0}$, but the region ends where the two slanted lines meet, at $x = ${rTex(add(Px, R(p0)))}$; the condition $y \\ge ${q0}$ never binds.` },
          ...(p0 === 0 ? [] : [{ value: Math.abs((Y1 - Y2) * (Px.n / Px.d + p0) / 2), why: `That takes the width as the $x$-coordinate of the corner where the lines meet, but the vertical side lies on $x = ${p0}$, so the width is measured from there.` }])
        ];
      } else {
        area = mulQ(R(X2 - X1, 2), Py);
        items = [`$x \\ge ${p0}$`, `$y \\ge ${q0}$`, `$${ineqTex(A1, B1, '>=', C1)}$`, `$${ineqTex(A2, B2, '<=', C2)}$`];   // x ≥ p0 is redundant
        corners = [pt(R(X1), R(0)), pt(R(X2), R(0)), pt(Px, Py)];
        trapList = [
          { value: (X2 - X1) * Py.n / Py.d, why: 'That is the base times the height; the area of a triangle is half of that.' },
          { value: (X2 - X1) * Y2 / 2, why: `That takes the height where $${linXY(A2, B2)} = ${C2}$ meets $x = ${p0}$, but the region's top corner is where the two slanted lines meet, at $y = ${rTex(add(Py, R(q0)))}$; the condition $x \\ge ${p0}$ never binds.` },
          ...(q0 === 0 ? [] : [{ value: Math.abs((X2 - X1) * (Py.n / Py.d + q0) / 2), why: `That takes the height as the $y$-coordinate of the corner where the lines meet, but the base lies on $y = ${q0}$, so the height is measured from there.` }])
        ];
      }
      if (area.n / area.d < 2 || area.n / area.d > 80) continue;
      const ordered = rng() < 0.5 ? items : [...items.slice(1), items[0]];
      return {
        prompt: `Find the area of the region of the plane in which ${andList(ordered)} all hold.`,
        answerType: 'numeric', ...exact(area, 'square units'),
        traps: traps(area.n / area.d, trapList),
        hints: [
          'Draw each boundary line from its two intercepts on the lines $x = $ constant and $y = $ constant that appear, and shade the side each inequality keeps.',
          'Find where the two slanted lines meet; check whether that point is a corner of the region.',
          'List the corners in order around the region and split it into triangles (or use the shoelace formula).'
        ],
        steps: [
          { h: 'Boundary lines', d: `$${linXY(A1, B1)} = ${C1}$ and $${linXY(A2, B2)} = ${C2}$ meet at $${pt(Px, Py)}$` },
          { h: 'Corners', d: `The region is the polygon with corners ${corners.map(c => `$${c}$`).join(', ')}` },
          { h: 'Area', d: shape === 'under-both' ? `Split along the diagonal from $${pt(R(0), R(0))}$: $\\tfrac12 \\cdot ${X1} \\cdot ${rTex(Py)} + \\tfrac12 \\cdot ${Y2} \\cdot ${rTex(Px)}$`
            : shape === 'between-left' ? `A triangle with a vertical side of length $${Y1 - Y2}$ and width $${rTex(Px)}$: $\\tfrac12 \\cdot ${Y1 - Y2} \\cdot ${rTex(Px)}$`
              : `A triangle with base $${X2 - X1}$ on $y = ${q0}$ and height $${rTex(Py)}$: $\\tfrac12 \\cdot ${X2 - X1} \\cdot ${rTex(Py)}$` },
          { h: 'Answer', d: `$${rTex(area)}$ square units` }
        ],
        reasoning: `region-area-${shape}`
      };
    }
    if (kind === 'area-parameter') {
      // 0 ≤ x ≤ P, 0 ≤ y ≤ Q, ax + by ≤ k. The line passes (P, 0) at k = aP, (0, Q)
      // at k = bQ and (P, Q) at k = aP + bQ; the area is piecewise in k.
      const P = ri(rng, 2, 8), Qh = ri(rng, 2, 8), a = ri(rng, 1, 4), b = ri(rng, 1, 4);
      if (gcd(a, b) > 1) continue;
      const kx = a * P, ky = b * Qh, k3 = kx + ky, k1 = Math.min(kx, ky), k2 = Math.max(kx, ky);
      const xFirst = kx <= ky;                                       // the line reaches (P, 0) first
      // Pick the shape first, then a half-integer k strictly inside its range.
      const piece = shape;
      if (piece === 'trapezium' && k1 === k2) continue;
      const [kLo, kHi] = piece === 'triangle' ? [0, k1] : piece === 'trapezium' ? [k1, k2] : [k2, k3];
      if (kHi - kLo < 1) continue;
      const kq = R(ri(rng, 2 * kLo + 1, 2 * kHi - 1), 2);
      const kv = kq.n / kq.d;
      if (kv < 2) continue;
      const ab2 = 2 * a * b;
      const t = R(k3 * kq.d - kq.n, kq.d);                           // k3 − k
      const A = piece === 'triangle' ? R(kq.n * kq.n, kq.d * kq.d * ab2)
        : piece === 'trapezium' ? (xFirst ? R(2 * P * kq.n - a * P * P * kq.d, 2 * b * kq.d) : R(2 * Qh * kq.n - b * Qh * Qh * kq.d, 2 * a * kq.d))
          : R(P * Qh * ab2 * t.d * t.d - t.n * t.n, ab2 * t.d * t.d);
      if (100 % A.d !== 0 || A.n <= 0) continue;
      const Av = A.n / A.d;
      const areaAt = k => (k <= k1 ? k * k / ab2 : k <= k2 ? (xFirst ? (2 * P * k - a * P * P) / (2 * b) : (2 * Qh * k - b * Qh * Qh) / (2 * a)) : P * Qh - (k3 - k) ** 2 / ab2);
      const corner = which => (kx === ky ? `$(${P}, 0)$ and $(0, ${Qh})$` : (which === 1) === xFirst ? `$(${P}, 0)$` : `$(0, ${Qh})$`);
      const triK = Math.sqrt(ab2 * Av);
      const trapK = xFirst ? (2 * b * Av + a * P * P) / (2 * P) : (2 * a * Av + b * Qh * Qh) / (2 * Qh);
      const cutK = k3 - Math.sqrt(ab2 * (P * Qh - Av));
      const trapList = [];
      if (piece !== 'triangle') trapList.push({ value: triK, why: `That treats the region as a triangle cut off by the line, but at that $k$ the line has already passed ${corner(1)}, so the region is not a triangle.` });
      if (piece === 'triangle' && k1 < k2) trapList.push({ value: trapK, why: `That uses the trapezium formula, but at that $k$ the line has not yet reached ${corner(1)}, so the region is still a triangle.` });
      if (piece === 'cut-rectangle' && k1 < k2) trapList.push({ value: trapK, why: `That uses the trapezium formula, but at that $k$ the line has already passed ${corner(2)} as well, so a corner of the rectangle is cut off instead.` });
      if (piece !== 'cut-rectangle') trapList.push({ value: cutK, why: `That treats the region as the rectangle with one corner cut off, but at that $k$ the line has not yet passed ${corner(2)}.` });
      if (piece === 'cut-rectangle') trapList.push({ value: k3 + Math.sqrt(ab2 * (P * Qh - Av)), why: `That root is larger than $${k3}$, where the line lies beyond $(${P}, ${Qh})$ and the region would be the whole rectangle.` });
      if (piece === 'triangle') trapList.push({ value: -kv, why: 'That is the negative root; $k$ is a positive constant.' });
      if (piece === 'trapezium') {
        // Rational slips: the trapezium stood on the wrong pair of sides, and the ½ dropped.
        const [side, other] = xFirst ? [['x = 0', `x = ${P}`], ['y = 0', `y = ${Qh}`]] : [['y = 0', `y = ${Qh}`], ['x = 0', `x = ${P}`]];
        const wrongSides = xFirst ? R(2 * a * A.n + b * Qh * Qh * A.d, 2 * Qh * A.d) : R(2 * b * A.n + a * P * P * A.d, 2 * P * A.d);
        trapList.push({ value: wrongSides.n / wrongSides.d, why: `That takes the parallel sides of the trapezium on $${other[0]}$ and $${other[1]}$, but the line meets $${side[0]}$ and $${side[1]}$, so those are the parallel sides.` });
        const noHalf = xFirst ? R(b * A.n + a * P * P * A.d, 2 * P * A.d) : R(a * A.n + b * Qh * Qh * A.d, 2 * Qh * A.d);
        trapList.push({ value: noHalf.n / noHalf.d, why: 'That leaves out the $\\tfrac12$ in the area of a trapezium.' });
      }
      const triTex = `\\dfrac{k^2}{${ab2}}`;
      const trapTex = xFirst ? linOver(2 * P, -a * P * P, 2 * b, 'k') : linOver(2 * Qh, -b * Qh * Qh, 2 * a, 'k');
      const cutTex = `${P * Qh} - \\dfrac{(${k3} - k)^2}{${ab2}}`;
      const fmtA = v => String(Number(v.toFixed(4)));
      const stages = [`for $0 < k \\le ${k1}$ it is a triangle of area $${triTex}$, at most $${fmtA(areaAt(k1))}$`];
      if (k1 < k2) stages.push(`for $${k1} \\le k \\le ${k2}$ a trapezium of area $${trapTex}$, at most $${fmtA(areaAt(k2))}$`);
      stages.push(`for $${k2} \\le k \\le ${k3}$ the rectangle with a corner cut off, area $${cutTex}$`);
      const solveLine = piece === 'triangle' ? `$${triTex} = ${Av}$ gives $k^2 = ${fmtA(ab2 * Av)}$, so $k = ${rTex(kq)}$ (the root $-${rTex(kq)}$ is not positive)`
        : piece === 'trapezium' ? `$${trapTex} = ${Av}$ gives $k = ${rTex(kq)}$, which is between $${k1}$ and $${k2}$`
          : `$(${k3} - k)^2 = ${fmtA(ab2 * (P * Qh - Av))}$, so $k = ${k3} \\pm ${rTex(t)}$; only $k = ${rTex(kq)}$ lies between $${k2}$ and $${k3}$`;
      return {
        prompt: `The region of the plane given by $0 \\le x \\le ${P}$, $0 \\le y \\le ${Qh}$ and $${linXY(a, b)} \\le k$, where $k$ is a positive constant, has area $${Av}$ square unit${Av === 1 ? '' : 's'}. Find $k$.`,
        answerType: 'numeric', ...exact(kq),
        // A wrong-shape value can land very near the key; offer only those clearly apart from it.
        traps: traps(kv, trapList.filter(tr => Math.abs(tr.value - kv) > Math.max(0.05 * kv, 0.5))),
        hints: [
          'As $k$ grows the line moves across the rectangle. Find the values of $k$ at which it passes the corners of the rectangle.',
          'Between those values the region has one shape: a triangle, a trapezium, or the rectangle with one corner cut off. Work out the area at each corner value to see which shape gives the stated area.',
          'Write the area of that shape in terms of $k$ and solve; keep only a root that lies in the range of $k$ for that shape.'
        ],
        steps: [
          { h: 'Corner values of k', d: `$${linXY(a, b)} = k$ passes through $(${P}, 0)$ at $k = ${kx}$, through $(0, ${Qh})$ at $k = ${ky}$ and through $(${P}, ${Qh})$ at $k = ${k3}$` },
          { h: 'The shape', d: `${stages.join('; ')}. The area $${Av}$ falls in the ${piece === 'triangle' ? 'first' : piece === 'trapezium' ? 'middle' : 'last'} range, so the region is ${piece === 'triangle' ? 'a triangle' : piece === 'trapezium' ? 'a trapezium' : 'the rectangle with a corner cut off'}` },
          { h: 'Solve for k', d: solveLine },
          { h: 'Answer', d: `$k = ${rTex(kq)}$` }
        ],
        reasoning: `area-parameter-${piece}`
      };
    }
    // moving-point: (u1·k + v1, u2·k + v2) in the region of three half-planes.
    const u1 = nz(rng, -3, 3), v1 = ri(rng, -5, 5), u2 = nz(rng, -3, 3), v2 = ri(rng, -5, 5);
    const center = ri(rng, -4, 6);
    const halves = [];
    for (let i = 0; i < 3; i++) {
      const A = ri(rng, -4, 4), B = ri(rng, -4, 4);
      const gk = A * u1 + B * u2;
      if ((A === 0 && B === 0) || gk === 0) break;
      const op = rc(rng, OPS);
      const C0 = A * v1 + B * v2;
      const kOp = gk > 0 ? op : FLIP[op];                           // direction once divided by gk
      const t = upward(kOp) ? center - ri(rng, 1, 5) : center + ri(rng, 1, 5);
      const C = C0 + gk * t + ri(rng, -2, 2);
      if (gcd(gcd(Math.abs(A), Math.abs(B)), Math.abs(C)) > 1) break;
      halves.push({ A, B, C, op, gk, kOp, K: R(C - A * v1 - B * v2, gk) });
    }
    if (halves.length < 3) continue;
    if (halves.some((h, i) => halves.some((g, j) => j > i && h.A * g.B === g.A * h.B))) continue;   // two parallel boundaries
    if (!halves.some(h => h.gk < 0)) continue;                     // at least one reversal
    const solve = (list, relax = false) => {
      let lo = null, loC = true, hi = null, hiC = true;
      for (const h of list) {
        const cl = relax || !strict(h.kOp);
        if (upward(h.kOp)) {
          if (lo === null || h.K.n * lo.d - lo.n * h.K.d > 0 || (h.K.n * lo.d === lo.n * h.K.d && !cl)) { lo = h.K; loC = cl; }
        } else if (hi === null || h.K.n * hi.d - hi.n * h.K.d < 0 || (h.K.n * hi.d === hi.n * h.K.d && !cl)) { hi = h.K; hiC = cl; }
      }
      return lo === null || hi === null ? null : intsIn(lo, loC, hi, hiC);
    };
    const sol = solve(halves);
    if (!sol || sol.count < 2 || sol.count > 14) continue;
    const binding = halves.filter((h, i) => { const s = solve(halves.filter((_, j) => j !== i)); return !s || s.count !== sol.count; });
    if (binding.length < 2) continue;
    const ask = askOnce;
    const pick = I => (ask === 'count' ? I.count : ask === 'least' ? I.first : I.last);
    const value = pick(sol);
    const relaxed = solve(halves, true);
    const trapList = [];
    if (relaxed) trapList.push({ value: pick(relaxed), why: 'That allows a value of $k$ that puts the point on a boundary line whose inequality is strict.' });
    for (const h of binding) {
      const s = solve(halves.filter(x => x !== h));
      if (s) trapList.push({ value: pick(s), why: `That ignores the condition $${ineqTex(h.A, h.B, h.op, h.C)}$.` });
    }
    const unreversed = solve(halves.map(h => ({ ...h, kOp: h.gk < 0 ? FLIP[h.kOp] : h.kOp })));
    for (const h of halves.filter(x => x.gk < 0)) {
      const one = solve(halves.map(x => (x === h ? { ...x, kOp: FLIP[x.kOp] } : x)));
      if (one && one.count > 0) trapList.push({ value: pick(one), why: `That keeps the direction of $${ineqTex(h.A, h.B, h.op, h.C)}$ after dividing by the negative coefficient of $k$.` });
    }
    if (unreversed && unreversed.count > 0) trapList.push({ value: pick(unreversed), why: 'That keeps the direction of an inequality after dividing it by a negative coefficient of $k$.' });
    if (ask !== 'count') trapList.push({ value: ask === 'least' ? sol.first - 1 : sol.last + 1, why: 'That value of $k$ puts the point outside the region.' });
    if (ask === 'count') {
      const ends = halves.reduce((acc, h) => {
        if (upward(h.kOp)) { if (!acc.lo || h.K.value > acc.lo.value) acc.lo = h.K; } else if (!acc.hi || h.K.value < acc.hi.value) acc.hi = h.K;
        return acc;
      }, {});
      const width = R(ends.hi.n * ends.lo.d - ends.lo.n * ends.hi.d, ends.hi.d * ends.lo.d);
      if (!isInt(width)) trapList.push({ value: value === floorQ(width) ? ceilQ(width) : floorQ(width), why: 'That goes by the length of the interval for $k$; the number of integers in it depends on where its ends fall.' });
    }
    if (ask !== 'count') trapList.push({ value: ask === 'least' ? sol.last : sol.first, why: `That value works, but it is the ${ask === 'least' ? 'greatest' : 'least'} such $k$, not the ${ask}.` });
    if (traps(value, trapList).length < 2) continue;
    const point = `(${lin(u1, v1, 'k')}, ${lin(u2, v2, 'k')})`;
    const region = andList(halves.map(h => `$${ineqTex(h.A, h.B, h.op, h.C)}$`));
    const question = ask === 'count'
      ? `For how many integers $k$ does the point $${point}$ lie in the region given by ${region}?`
      : `Find the ${ask} integer $k$ for which the point $${point}$ lies in the region given by ${region}.`;
    return {
      prompt: question,
      answerType: 'numeric', answer: { value },
      traps: traps(value, trapList),
      hints: [
        'Substitute the coordinates of the point into each inequality: each one becomes a linear inequality in $k$ alone.',
        'Solve each for $k$, reversing the direction whenever you divide by a negative number. Together they form a system in one variable.',
        'Intersect the three solution sets on the number line, keeping strict ends open, and read off the integers.'
      ],
      steps: [
        ...halves.map(h => ({
          h: `Substitute into $${ineqTex(h.A, h.B, h.op, h.C)}$`,
          d: h.gk === 1 ? `$k ${TEX[h.op]} ${h.K.n}$` : `$${cx(h.gk, 'k')} ${TEX[h.op]} ${h.C - h.A * v1 - h.B * v2}$, so ${h.gk < 0 ? 'reversing, ' : ''}$k ${TEX[h.kOp]} ${rTex(h.K)}$`
        })),
        { h: 'Intersect', d: `The integers allowed by all three are $k = ${run(sol.first, sol.last)}$` },
        { h: 'Answer', d: ask === 'count' ? `$${value}$ integer${value === 1 ? '' : 's'}` : `$k = ${value}$` }
      ],
      reasoning: ask === 'count' ? 'moving-point' : 'moving-point-extreme'
    };
  }
  return inequalityRegionReasoning(makeRng(FALLBACK_SEED));
}

// ═════════════════════════════════════════════════════════════════════════════

/** One rung, D4: every other rung returns the same form (see the header). */
const d4 = form => (rng, _diff) => form(rng);

export const forms = Object.freeze({
  'c11-linear-inequality-jee-reasoning': d4(linearInequalityReasoning),
  'c11-inequality-system-jee-reasoning': d4(inequalitySystemReasoning),
  'c11-inequality-region-jee-reasoning': d4(inequalityRegionReasoning)
});
