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
//      canteen-price — a ₹ profit inequality that must hold on EVERY day of a
//        range of sales: divide by the (positive) number sold, find the worst
//        day, THEN the least whole-rupee price, strict or not.
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
//      region-area — find the corner points (which line binds where), THEN the
//        exact area of the polygon.
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
import { exact as exactForm, frac, fracTex, traps, IN_CITIES, IN_NAMES } from './india-native-helpers.js';

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
const andList = items => (items.length === 1 ? items[0] : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

const FALLBACK_SEED = 0x494e4551;   // "INEQ"

// ═════════════════════════════════════════════════════════════════════════════
// Dot point 0 · Solve a linear inequality in one variable and graph the solution
// ═════════════════════════════════════════════════════════════════════════════

function linearInequalityReasoning(rng) {
  const kind = rc(rng, ['interval-containment', 'natural-count', 'canteen-price']);
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
      if (!traps(value, trapList).length) continue;
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
      const ask = rc(rng, ['count', 'count', 'greatest', 'least']);
      if (ask === 'count' && ks.count < 2) continue;
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
      if (!traps(value, trapList).length) continue;                // keep draws that have a misconception to offer
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
          { h: `Exactly ${N} natural solutions`, d: `They must be $1, 2, \\ldots, ${N}$ and not $${N + 1}$: $${uRange}$` },
          { h: 'Interval for k', d: `$${rTex(W.lo)} ${W.loClosed ? '\\le' : '<'} k ${W.hiClosed ? '\\le' : '<'} ${rTex(W.hi)}$, whose integers are $${ks.first}$${ks.count > 1 ? ` to $${ks.last}$` : ''}` },
          { h: 'Answer', d: ask === 'count' ? `$${value}$ integer value${value === 1 ? '' : 's'} of $k$` : `$k = ${value}$` }
        ],
        reasoning: ask === 'count' ? 'natural-count' : 'natural-count-extreme'
      };
    }
    // canteen-price: p·n − c·(n + g) − F (op) 0 for every whole n from n1 to n2.
    const n1 = ri(rng, 20, 60), n2 = n1 + ri(rng, 15, 80);
    const cP = ri(rng, 24, 48) * 25;                    // cost per samosa in paise: ₹6 to ₹12 in steps of 25 paise
    const F = ri(rng, 4, 20) * 50, g = ri(rng, 2, 12);
    const profit = rng() < 0.6;                          // strict profit, or "no loss"
    const bound = (n, gg) => R(cP * (n + gg) + 100 * F, 100 * n);   // p must exceed (or reach) this
    const least = (n, gg) => { const B = bound(n, gg); return profit ? floorQ(B) + 1 : ceilQ(B); };
    const value = least(n1, g);
    if (value > 45) continue;
    const B = bound(n1, g);
    const rupees = p => (p % 100 === 0 ? String(p / 100) : (p / 100).toFixed(2));
    const city = rc(rng, IN_CITIES), name = rc(rng, IN_NAMES);
    const goal = profit ? 'makes a profit (income strictly more than total cost)' : 'makes no loss (income at least the total cost)';
    const trapList = [
      { value: least(n2, g), why: `That price is enough on a day when $${n2}$ samosas are sold, but on a day with only $${n1}$ sold the income ${profit ? 'does not exceed' : 'falls short of'} the cost.` },
      { value: least(n1, 0), why: `That leaves out the cost of the $${g}$ free samosas, which is paid every day.` }
    ];
    if (!isInt(B)) trapList.push({ value: floorQ(B), why: `That rounds the bound down: at that price the income ${profit ? 'does not exceed' : 'falls short of'} the cost on a day with $${n1}$ sold.` });
    if (profit && isInt(B)) trapList.push({ value: B.n, why: `At ₹$${B.n}$ the income exactly equals the cost on a day with $${n1}$ sold, which is not a profit.` });
    return {
      prompt: `${name} runs a school canteen in ${city}. Each samosa costs ₹$${rupees(cP)}$ to make, the canteen has a fixed cost of ₹$${F}$ a day, and every day $${g}$ samosas are given free to the staff. On any day the canteen sells some whole number of samosas from $${n1}$ to $${n2}$. Find the least whole-rupee selling price per samosa for which the canteen ${goal} on every such day.`,
      answerType: 'numeric', answer: { value },
      traps: traps(value, trapList),
      hints: [
        'Write the day\'s income and total cost for a day on which $n$ samosas are sold; remember the free ones are made too.',
        'Divide by $n$, which is positive, so the direction stays. The price must beat a bound that changes with $n$.',
        'The bound must hold on every day at once, so find the day on which it is largest; then take the least whole rupee that satisfies it, minding whether equality is allowed.'
      ],
      steps: [
        { h: 'Inequality for one day', d: `Selling $n$ at ₹$p$: $pn ${profit ? '>' : '\\ge'} ${rupees(cP)}(n + ${g}) + ${F}$` },
        { h: 'Solve for p', d: `$p ${profit ? '>' : '\\ge'} ${rupees(cP)} + \\dfrac{${rupees(cP * g + 100 * F)}}{n}$ — dividing by $n > 0$ keeps the direction` },
        { h: 'Worst day', d: `The bound is largest when $n$ is smallest, $n = ${n1}$: $p ${profit ? '>' : '\\ge'} ${rTex(B)}$${isInt(B) ? '' : ` $\\approx ${(B.n / B.d).toFixed(2)}$`}` },
        { h: 'Least whole rupee', d: `₹$${value}$ satisfies it on that day, hence on every day` },
        { h: 'Answer', d: `₹$${value}$` }
      ],
      reasoning: profit ? 'canteen-price-profit' : 'canteen-price-no-loss'
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
          { h: `Exactly ${N} integers`, d: `The solutions must be $${x0}, \\ldots, ${x0 + N - 1}$ and not $${x0 + N}$: $${x0 + N - 1} ${uWin.loClosed ? '\\le' : '<'} ${Utex} ${uWin.hiClosed ? '\\le' : '<'} ${x0 + N}$` },
          { h: 'Range of a', d: `$${W.lo.n} ${W.loClosed ? '\\le' : '<'} a ${W.hiClosed ? '\\le' : '<'} ${W.hi.n}$: the integers $${as.first}$${as.count > 1 ? ` to $${as.last}$` : ''}` },
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
        { h: 'Integer solutions of the two', d: `$x = ${M - x0 <= 2 ? Array.from({ length: M - x0 + 1 }, (_, i) => x0 + i).join(', ') : `${x0}, \\ldots, ${M}`}$` },
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
  const kind = rc(rng, ['lattice-count', 'region-area', 'moving-point']);
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
        items = [`$x \\ge ${p0}$`, `$${ineqTex(A1, B1, '<=', C1)}$`, `$${ineqTex(A2, B2, '>=', C2)}$`];
        corners = [pt(R(0), R(Y2)), pt(R(0), R(Y1)), pt(Px, Py)];
        trapList = [
          { value: (Y1 - Y2) * Px.n / Px.d, why: 'That is the base times the height; the area of a triangle is half of that.' },
          ...(p0 === 0 ? [] : [{ value: Math.abs((Y1 - Y2) * (Px.n / Px.d + p0) / 2), why: `That takes the width as the $x$-coordinate of the corner where the lines meet, but the vertical side lies on $x = ${p0}$, so the width is measured from there.` }])
        ];
      } else {
        area = mulQ(R(X2 - X1, 2), Py);
        items = [`$y \\ge ${q0}$`, `$${ineqTex(A1, B1, '>=', C1)}$`, `$${ineqTex(A2, B2, '<=', C2)}$`];
        corners = [pt(R(X1), R(0)), pt(R(X2), R(0)), pt(Px, Py)];
        trapList = [
          { value: (X2 - X1) * Py.n / Py.d, why: 'That is the base times the height; the area of a triangle is half of that.' },
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
    const ask = rc(rng, ['count', 'count', 'least', 'greatest']);
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
        { h: 'Intersect', d: `The integers allowed by all three are $k = ${sol.first}$ to $${sol.last}$` },
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
