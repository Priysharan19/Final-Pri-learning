// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Year 12 generators for the NSW Mathematics Standard 2 and Standard 1
// (2024) outcomes the original Standard bank left without an approved form. Every item
// is original to Pri; none is taken from a NESA paper or marking guideline.
//
// Every answer is a whole number: parameters are chosen so that no question
// asks for a rounded value, and the marker has no tolerance to be wider than
// the answer (the reason the older money cells are excluded from the
// Prithagoras bank — server/platform/nswBanks.js).
//
//   ms12-algebraic     MST-12-S2-01  Algebraic relationships
//   ms12-invest-loans  MST-12-S2-02  Investment and loans
//   ms12-annuity-table MST-12-S2-03  Annuities
//   ms12-rates         MST-12-S2-05  Ratios and rates
//   ms12-network-flow  MST-12-S2-06  Network flow
//   ms12-critical-path MST-12-S2-07  Critical path analysis
//   ms12-bivariate-fit MST-12-S2-08  Bivariate data analysis
//   ms12-normal-exact  MST-12-S2-10  The normal distribution
//   ms12-simple-interest MST-12-S1-02  Investment (Standard 1)
//   ms12-depreciation  MST-12-S1-03  Depreciation and loans (Standard 1)
//   ms12-right-triangle MST-12-S1-04  Right-angled triangles (Standard 1)
// ms12-algebraic, -rates and -bivariate-fit also serve Standard 1 (S1-01, S1-05, S1-06).
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc } from '../qhelpers.js';

const trim = v => String(Number(v.toFixed(6)));
const dollars = v => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const D = v => `\\$${dollars(v)}`;

// ── Graph helpers ────────────────────────────────────────────────────────────
/** The arcs from the source side of a cut to the other side, as text with its capacity. */
function cutText(arcs, side) {
  const cut = arcs.filter(([u, v]) => side.has(u) && !side.has(v));
  return { text: cut.map(([u, v, c]) => `${u}\\to ${v}$ (${c})`).join(', $'), total: cut.reduce((n, [, , c]) => n + c, 0), set: [...side].join(', ') };
}

function maxFlow(nodes, arcs, s, t) {
  const cap = new Map();
  for (const [u, v, c] of arcs) cap.set(`${u}>${v}`, (cap.get(`${u}>${v}`) || 0) + c);
  const residual = (u, v) => cap.get(`${u}>${v}`) || 0;
  let flow = 0;
  for (;;) {
    const prev = new Map([[s, null]]);
    const queue = [s];
    while (queue.length && !prev.has(t)) {
      const u = queue.shift();
      for (const v of nodes) if (!prev.has(v) && residual(u, v) > 0) { prev.set(v, u); queue.push(v); }
    }
    if (!prev.has(t)) return { flow, side: new Set(prev.keys()) };
    let add = Infinity;
    for (let v = t; prev.get(v) != null; v = prev.get(v)) add = Math.min(add, residual(prev.get(v), v));
    for (let v = t; prev.get(v) != null; v = prev.get(v)) {
      const u = prev.get(v);
      cap.set(`${u}>${v}`, residual(u, v) - add);
      cap.set(`${v}>${u}`, residual(v, u) + add);
    }
    flow += add;
  }
}

/** Earliest/latest times for activities given as { id, d, pre }. */
function schedule(acts) {
  const es = {}, ef = {};
  for (const a of acts) { es[a.id] = Math.max(0, ...a.pre.map(p => ef[p])); ef[a.id] = es[a.id] + a.d; }
  const end = Math.max(...Object.values(ef));
  const lf = {}, ls = {};
  for (const a of [...acts].reverse()) {
    const succ = acts.filter(b => b.pre.includes(a.id));
    lf[a.id] = succ.length ? Math.min(...succ.map(b => ls[b.id])) : end;
    ls[a.id] = lf[a.id] - a.d;
  }
  const float = Object.fromEntries(acts.map(a => [a.id, ls[a.id] - es[a.id]]));
  return { es, ef, ls, lf, end, float };
}

const raw = {
  // ── Algebraic relationships ────────────────────────────────────────────────
  'ms12-algebraic': (rng, diff) => {
    if (diff === 1) {
      const a = ri(rng, 2, 9) * 5, b = rc(rng, [2, 3]), t = b === 2 ? ri(rng, 3, 6) : ri(rng, 2, 4);
      const val = a * b ** t;
      return {
        prompt: `The number of members of an online club is modelled by $N = ${a}\\times ${b}^{t}$, where $t$ is the number of months since it began. How many members does the model give when $t = ${t}$?`,
        answerType: 'numeric', answer: { value: val },
        traps: [{ value: a * b * t, why: `$${b}^{${t}}$ means ${b} multiplied by itself ${t} times, not ${b} times ${t}.` }],
        hints: [`Substitute $t = ${t}$.`, `$${b}^{${t}} = ${b ** t}$.`, `$${a}\\times ${b ** t}$.`],
        steps: [
          { h: 'Substitute', d: `$N = ${a}\\times ${b}^{${t}}$` },
          { h: 'Evaluate the power first', d: `$${b}^{${t}} = ${b ** t}$, so $N = ${a}\\times ${b ** t} = ${val}$` }
        ]
      };
    }
    if (diff === 2) {
      // Two points on a linear cost graph: the rate.
      const fee = ri(rng, 2, 9) * 5, rate = ri(rng, 2, 9), km = ri(rng, 3, 9) * 2;
      const cost = fee + rate * km;
      return {
        prompt: `A taxi fare is a straight-line function of the distance travelled. A trip of $0$ km costs ${D(fee)} and a trip of $${km}$ km costs ${D(cost)}. How many dollars does each kilometre cost?`,
        answerType: 'numeric', answer: { value: rate },
        traps: [{ value: cost / km, why: 'The flagfall is paid before any distance is travelled: take it off before dividing by the distance.' }].filter(t => t.value !== rate && Number.isFinite(t.value)),
        hints: ['The gradient is the change in cost over the change in distance.', `Change in cost: $${cost} - ${fee}$.`, `Divide by $${km}$.`],
        steps: [
          { h: 'Gradient', d: `$m = \\dfrac{${cost} - ${fee}}{${km} - 0} = \\dfrac{${cost - fee}}{${km}} = ${rate}$` },
          { h: 'Read it', d: `Each kilometre costs ${D(rate)}.` }
        ]
      };
    }
    if (diff === 3) {
      const vary = ri(rng, 2, 9) * 5, gap = ri(rng, 1, 4) * 5, units = ri(rng, 10, 60);
      const price = vary + gap, fixed = gap * units;
      return {
        prompt: `A stall pays a fixed cost of ${D(fixed)}. Each item costs ${D(vary)} to make and sells for ${D(price)}. How many items must be sold for the stall to break even?`,
        answerType: 'numeric', answer: { value: units },
        traps: [{ value: Math.round(fixed / price), why: 'At the break-even point revenue equals the total cost, which includes the cost of making each item.' }].filter(t => t.value !== units),
        hints: ['Break even when $\\text{cost} = \\text{revenue}$.', `$${fixed} + ${vary}n = ${price}n$.`, `$${fixed} = ${gap}n$.`],
        steps: [
          { h: 'Write both models', d: `Cost $C = ${fixed} + ${vary}n$, revenue $R = ${price}n$` },
          { h: 'Set equal and solve', d: `$${fixed} + ${vary}n = ${price}n \\Rightarrow ${fixed} = ${gap}n \\Rightarrow n = ${units}$` }
        ]
      };
    }
    // Level 4: the cost at which two plans are equal.
    const b2 = ri(rng, 1, 4), b1 = b2 + ri(rng, 1, 4), g = ri(rng, 2, 12), a1 = ri(rng, 2, 9) * 5;
    const a2 = a1 + (b1 - b2) * g;
    const cost = a1 + b1 * g;
    return {
      prompt: `Plan A charges a ${D(a1)} fee plus ${D(b1)} per gigabyte. Plan B charges a ${D(a2)} fee plus ${D(b2)} per gigabyte. The two plans cost the same for a certain amount of data. What is that common cost, in dollars?`,
      answerType: 'numeric', answer: { value: cost },
      traps: [{ value: g, why: 'That is the number of gigabytes at which the plans are equal. The question asks for the cost at that point.' }],
      hints: ['Set the two costs equal and solve for the data, $g$.', `$${a1} + ${b1}g = ${a2} + ${b2}g$.`, 'Then substitute $g$ back into either plan.'],
      steps: [
        { h: 'Set the costs equal', d: `$${a1} + ${b1}g = ${a2} + ${b2}g \\Rightarrow ${b1 - b2}g = ${a2 - a1} \\Rightarrow g = ${g}$` },
        { h: 'Substitute', d: `$C = ${a1} + ${b1}(${g}) = ${cost}$ dollars` }
      ]
    };
  },

  // ── Investment and loans ───────────────────────────────────────────────────
  'ms12-invest-loans': (rng, diff) => {
    const rate = rc(rng, [10, 5]);
    const R = 1 + rate / 100;
    if (diff === 1 || diff === 2) {
      const n = rate === 10 ? ri(rng, 2, 3) : 2;
      const P = (rate === 10 ? 1000 : 4000) * ri(rng, 1, 6);
      const A = Math.round(P * R ** n);
      const interest = diff === 1 ? false : true;
      return {
        prompt: `${D(P)} is invested at ${rate}% per annum, compounded annually, for ${n} years. ${interest ? 'How much interest is earned, in dollars?' : `What is the investment worth at the end of the ${n} years, in dollars?`}`,
        answerType: 'numeric', answer: { value: interest ? A - P : A },
        traps: [{ value: interest ? P * rate / 100 * n : P + P * rate / 100 * n, why: 'Compound interest is paid on the interest already added, so it grows faster than simple interest.' }],
        hints: ['$A = P(1 + r)^n$.', `$(1 + r) = ${R.toFixed(2)}$ and $n = ${n}$.`, interest ? 'Interest $= A - P$.' : `$${P}\\times ${trim(R ** n)}$.`],
        steps: [
          { h: 'Compound interest formula', d: `$A = ${P}(${R.toFixed(2)})^{${n}} = ${A}$` },
          ...(interest ? [{ h: 'Interest earned', d: `$${A} - ${P} = ${A - P}$ dollars` }] : [])
        ]
      };
    }
    if (diff === 3) {
      const B = (rate === 10 ? 2000 : 4000) * ri(rng, 3, 9);
      const M = (rate === 10 ? 500 : 400) * ri(rng, 1, 3);
      const after = Math.round(B * R - M);
      return {
        prompt: `A loan of ${D(B)} is charged ${rate}% interest per year, added at the end of the year. A repayment of ${D(M)} is made at the end of the year, straight after the interest is added. What is the balance owing after the repayment, in dollars?`,
        answerType: 'numeric', answer: { value: after },
        traps: [{ value: B - M, why: 'Interest is added before the repayment is taken off.' }],
        hints: ['Balance $= B(1 + r) - M$.', `$${B}\\times ${R.toFixed(2)} = ${Math.round(B * R)}$.`, `Take off ${D(M)}.`],
        steps: [
          { h: 'Add the interest', d: `$${B}\\times ${R.toFixed(2)} = ${Math.round(B * R)}$` },
          { h: 'Take off the repayment', d: `$${Math.round(B * R)} - ${M} = ${after}$` }
        ]
      };
    }
    // Level 4: declining-balance depreciation.
    const dr = rc(rng, [10, 20]);
    const n = ri(rng, 2, 3);
    const V0 = (dr === 10 ? 10000 : 5000) * ri(rng, 1, 4);
    const V = Math.round(V0 * (1 - dr / 100) ** n);
    return {
      prompt: `A machine bought for ${D(V0)} loses ${dr}% of its value each year (declining-balance depreciation). What is it worth after ${n} years, in dollars?`,
      answerType: 'numeric', answer: { value: V },
      traps: [{ value: V0 - V0 * dr / 100 * n, why: 'Each year the loss is ' + dr + '% of the value at the start of that year, not of the original price.' }],
      hints: ['$S = V_0(1 - r)^n$.', `$1 - r = ${(1 - dr / 100).toFixed(2)}$ and $n = ${n}$.`, `$(${(1 - dr / 100).toFixed(2)})^{${n}} = ${trim((1 - dr / 100) ** n)}$.`],
      steps: [
        { h: 'Formula', d: `$S = V_0(1 - r)^n$` },
        { h: 'Substitute', d: `$S = ${V0}(${(1 - dr / 100).toFixed(2)})^{${n}} = ${V}$ dollars` }
      ]
    };
  },

  // ── Annuities (table factors are given in the question) ────────────────────
  'ms12-annuity-table': (rng, diff) => {
    const FV = [[2, 5, 2.05], [3, 10, 3.31], [2, 10, 2.1], [2, 20, 2.2], [3, 20, 3.64], [2, 4, 2.04], [2, 8, 2.08], [2, 6, 2.06]];
    const PV = [[2, 5, 1.86], [2, 10, 1.74], [3, 10, 2.49], [3, 5, 2.72], [2, 8, 1.78], [3, 8, 2.58]];
    const M = 100 * ri(rng, 2, 9);
    if (diff === 2) {
      const [n, r, f] = rc(rng, PV);
      const val = Math.round(M * f);
      return {
        prompt: `The table factor for the present value of an annuity of ${D(1)} per year for ${n} years at ${r}% per annum is ${f}. What is the present value of an annuity of ${D(M)} per year for ${n} years, in dollars? Use the factor as given.`,
        answerType: 'numeric', answer: { value: val },
        traps: [{ value: M * n, why: 'Money received later is worth less today, so the present value is below the total of the payments.' }],
        hints: ['Present value $= \\text{payment}\\times\\text{table factor}$.', `$${M}\\times ${f}$.`, 'Use the factor from the question.'],
        steps: [{ h: 'Multiply by the factor', d: `$PV = ${M}\\times ${f} = ${val}$ dollars` }]
      };
    }
    const [n, r, f] = rc(rng, FV);
    const val = Math.round(M * f);
    if (diff === 1) {
      return {
        prompt: `The table factor for the future value of an annuity of ${D(1)} per year for ${n} years at ${r}% per annum is ${f}. What is the future value of an annuity of ${D(M)} per year for ${n} years, in dollars?`,
        answerType: 'numeric', answer: { value: val },
        traps: [{ value: M * n, why: 'The factor includes the interest each payment earns; do not just add the payments.' }],
        hints: ['Future value $= \\text{payment}\\times\\text{table factor}$.', `$${M}\\times ${f}$.`, 'Use the factor from the question.'],
        steps: [{ h: 'Multiply by the factor', d: `$FV = ${M}\\times ${f} = ${val}$ dollars` }]
      };
    }
    if (diff === 3) {
      return {
        prompt: `Using a future value table factor of ${f} (${n} years at ${r}% per annum), find the interest earned in total on an annuity of ${D(M)} deposited each year for ${n} years, in dollars.`,
        answerType: 'numeric', answer: { value: val - M * n },
        traps: [{ value: val, why: 'That is the future value. The interest is the future value less the money paid in.' }],
        hints: [`Future value $= ${M}\\times ${f}$.`, `Money paid in $= ${M}\\times ${n}$.`, 'Interest = future value minus contributions.'],
        steps: [
          { h: 'Future value', d: `$${M}\\times ${f} = ${val}$` },
          { h: 'Contributions', d: `$${M}\\times ${n} = ${M * n}$` },
          { h: 'Interest', d: `$${val} - ${M * n} = ${val - M * n}$ dollars` }
        ]
      };
    }
    return {
      prompt: `A savings plan needs to reach ${D(val)} after ${n} years of equal yearly deposits at ${r}% per annum. The future value table factor is ${f}. What yearly deposit is needed, in dollars?`,
      answerType: 'numeric', answer: { value: M },
      traps: [{ value: Math.round(val / n), why: 'The deposits earn interest, so each one can be smaller than the target divided by the number of years.' }].filter(t => t.value !== M),
      hints: ['$\\text{payment} = \\dfrac{FV}{\\text{factor}}$.', `$${val}\\div ${f}$.`, 'The answer is a whole number of dollars.'],
      steps: [{ h: 'Divide by the factor', d: `$${val}\\div ${f} = ${M}$ dollars` }]
    };
  },

  // ── Ratios and rates ───────────────────────────────────────────────────────
  'ms12-rates': (rng, diff) => {
    if (diff === 1) {
      const vehicle = rc(rng, [['cyclist', 2, 3], ['ferry', 2, 4], ['delivery van', 3, 6], ['train', 4, 10]]), who = vehicle[0], v = 18 * ri(rng, vehicle[1], vehicle[2]);
      return {
        prompt: `A ${who} travels at $${v}$ kilometres per hour. What is this speed in metres per second?`,
        answerType: 'numeric', answer: { value: v * 5 / 18 }, answerSuffix: 'm/s',
        traps: [{ value: v * 3.6, why: 'To go from km/h to m/s divide by 3.6; multiplying goes the wrong way.' }],
        hints: ['$1\\text{ km/h} = \\dfrac{1000}{3600}\\text{ m/s}$.', 'Divide by $3.6$.', `$${v}\\div 3.6$.`],
        steps: [{ h: 'Convert', d: `$${v}\\times\\dfrac{1000}{3600} = ${v * 5 / 18}$ m/s` }]
      };
    }
    if (diff === 2) {
      const c = rc(rng, [6, 8, 10, 12]), d = 50 * ri(rng, 3, 9);
      const L = c * d / 100;
      return {
        prompt: `A car uses $${c}$ litres of fuel per 100 km. How many litres does it use on a trip of $${d}$ km?`,
        answerType: 'numeric', answer: { value: L }, answerSuffix: 'L',
        traps: [{ value: c * d, why: 'The rate is per 100 km, so divide the distance by 100 first.' }],
        hints: ['Find how many lots of 100 km there are.', `$${d}\\div 100 = ${d / 100}$.`, `Multiply by $${c}$.`],
        steps: [{ h: 'Scale the rate', d: `$${c}\\times\\dfrac{${d}}{100} = ${L}$ litres` }]
      };
    }
    if (diff === 3) {
      const a = ri(rng, 2, 5), b = ri(rng, 1, 4), unit = ri(rng, 3, 12) * 10;
      const total = (a + b) * unit;
      return {
        prompt: `${D(total)} is shared between two people in the ratio $${a}:${b}$. How many dollars does the person with the larger share receive?`,
        answerType: 'numeric', answer: { value: Math.max(a, b) * unit },
        traps: [{ value: Math.min(a, b) * unit, why: 'The larger part of the ratio gets the larger share.' }].filter(t => t.value !== Math.max(a, b) * unit),
        hints: [`The ratio has $${a} + ${b} = ${a + b}$ parts.`, `One part is $${total}\\div ${a + b} = ${unit}$.`, 'Take the bigger number of parts.'],
        steps: [
          { h: 'One part', d: `$${total}\\div ${a + b} = ${unit}$` },
          { h: 'Larger share', d: `$${Math.max(a, b)}\\times ${unit} = ${Math.max(a, b) * unit}$ dollars` }
        ]
      };
    }
    const rate = rc(rng, [20, 30, 40, 50]), hours = ri(rng, 2, 6);
    const V = rate * 60 * hours;
    return {
      prompt: `Water flows into a tank at a constant $${rate}$ litres per minute. How many hours does it take to put $${V}$ litres into the tank?`,
      answerType: 'numeric', answer: { value: hours }, answerSuffix: 'hours',
      traps: [{ value: V / rate, why: `That is the time in minutes. Divide by 60 to get hours.` }],
      hints: ['Time $= \\text{volume}\\div\\text{rate}$.', `$${V}\\div ${rate} = ${V / rate}$ minutes.`, 'Convert minutes to hours.'],
      steps: [
        { h: 'Time in minutes', d: `$${V}\\div ${rate} = ${V / rate}$ minutes` },
        { h: 'Convert', d: `$${V / rate}\\div 60 = ${hours}$ hours` }
      ]
    };
  },

  // ── Network flow ───────────────────────────────────────────────────────────
  'ms12-network-flow': (rng, diff) => {
    const cap = () => ri(rng, 3, 14);
    if (diff <= 2) {
      const arcs = { SA: cap(), SB: cap(), AT: cap(), BT: cap(), AB: cap() };
      const list = `S→A ${arcs.SA}, S→B ${arcs.SB}, A→T ${arcs.AT}, B→T ${arcs.BT}, A→B ${arcs.AB}`;
      const desc = `A network has source $S$, sink $T$ and the directed arcs (with capacities) ${list}.`;
      if (diff === 1) {
        const val = arcs.SA + arcs.SB;
        return {
          prompt: `${desc} What is the capacity of the cut that separates $\\{S\\}$ from $\\{A, B, T\\}$?`,
          answerType: 'numeric', answer: { value: val },
          traps: [{ value: arcs.AT + arcs.BT, why: 'This cut is made around the source: count the arcs leaving $S$.' }].filter(t => t.value !== val),
          hints: ['A cut counts the capacities of the arcs that go from the source side to the sink side.', 'Which arcs leave $S$?', `$${arcs.SA} + ${arcs.SB}$.`],
          steps: [{ h: 'Arcs leaving S', d: `$S\\to A$ and $S\\to B$: $${arcs.SA} + ${arcs.SB} = ${val}$` }]
        };
      }
      const val = arcs.SB + arcs.AT + arcs.AB;
      return {
        prompt: `${desc} What is the capacity of the cut that separates $\\{S, A\\}$ from $\\{B, T\\}$?`,
        answerType: 'numeric', answer: { value: val },
        traps: [{ value: val + arcs.SA, why: 'Arcs inside the source side, such as $S\\to A$, are not part of the cut.' }],
        hints: ['Count only arcs that go from $\\{S, A\\}$ to $\\{B, T\\}$.', 'Those are $S\\to B$, $A\\to B$ and $A\\to T$.', `$${arcs.SB} + ${arcs.AB} + ${arcs.AT}$.`],
        steps: [{ h: 'Arcs crossing the cut', d: `$S\\to B$, $A\\to B$, $A\\to T$: $${arcs.SB} + ${arcs.AB} + ${arcs.AT} = ${val}$` }]
      };
    }
    if (diff === 3) {
      const arcs = [['S', 'A', cap()], ['S', 'B', cap()], ['A', 'T', cap()], ['B', 'T', cap()], ['A', 'B', cap()]];
      const { flow: val, side } = maxFlow(['S', 'A', 'B', 'T'], arcs, 'S', 'T');
      const cut = cutText(arcs, side);
      return {
        prompt: `A network has source $S$, sink $T$ and the directed arcs (with capacities) ${arcs.map(([u, v, c]) => `${u}→${v} ${c}`).join(', ')}. What is the maximum flow from $S$ to $T$?`,
        answerType: 'numeric', answer: { value: val },
        traps: [{ value: arcs[0][2] + arcs[1][2], why: 'The flow is also limited by the arcs into $T$; the maximum flow equals the smallest cut.' }].filter(t => t.value !== val),
        hints: ['Maximum flow equals the capacity of the minimum cut.', 'List the possible cuts and take the smallest.', 'Check that your flow respects every arc.'],
        steps: [{ h: 'A minimum cut', d: `Separate $\\{${cut.set}\\}$ from the rest: the arcs crossing it are $${cut.text}, with total capacity $${cut.total}$` }, { h: 'Max-flow min-cut', d: `No flow can beat the smallest cut, and this one is reached by the flow, so the maximum flow is $${val}$` }]
      };
    }
    const nodes = ['S', 'A', 'B', 'C', 'T'];
    const arcs = [['S', 'A', cap()], ['S', 'B', cap()], ['A', 'C', cap()], ['B', 'C', cap()], ['A', 'T', cap()], ['C', 'T', cap()], ['B', 'T', cap()]];
    const { flow: val, side } = maxFlow(nodes, arcs, 'S', 'T');
    const cut = cutText(arcs, side);
    return {
      prompt: `A network has source $S$, sink $T$ and the directed arcs (with capacities) ${arcs.map(([u, v, c]) => `${u}→${v} ${c}`).join(', ')}. What is the capacity of a minimum cut?`,
      answerType: 'numeric', answer: { value: val },
      traps: [{ value: arcs[0][2] + arcs[1][2], why: 'That cut is only one of several; the minimum cut is the smallest of them all.' }].filter(t => t.value !== val),
      hints: ['The minimum cut equals the maximum flow.', 'Push flow along paths until no path has spare capacity.', 'The total flow reaching $T$ is the answer.'],
      steps: [{ h: 'A minimum cut', d: `Separate $\\{${cut.set}\\}$ from the rest: the arcs crossing it are $${cut.text}, with total capacity $${cut.total}$` }, { h: 'Max-flow min-cut', d: `This cut is full when the flow is maximal, so the minimum cut has capacity $${val}$` }]
    };
  },

  // ── Critical path analysis ─────────────────────────────────────────────────
  'ms12-critical-path': (rng, diff) => {
    const TEMPLATES = [
      [['A', []], ['B', []], ['C', ['A']], ['D', ['A', 'B']], ['E', ['C']], ['F', ['D', 'E']]],
      [['A', []], ['B', ['A']], ['C', ['A']], ['D', ['B']], ['E', ['B', 'C']], ['F', ['D', 'E']]],
      [['A', []], ['B', []], ['C', ['A']], ['D', ['B']], ['E', ['C', 'D']], ['F', ['E']]]
    ];
    for (let tries = 0; tries < 400; tries++) {
      const tpl = rc(rng, TEMPLATES);
      const acts = tpl.map(([id, pre]) => ({ id, pre, d: ri(rng, 2, 9) }));
      const sch = schedule(acts);
      const table = acts.map(a => `${a.id} (${a.d} days${a.pre.length ? `, after ${a.pre.join(' and ')}` : ', no predecessor'})`).join('; ');
      const head = `A project has these activities: ${table}.`;
      if (diff === 1) {
        const a = acts.find(x => x.pre.length >= 2);
        if (!a) continue;
        return {
          prompt: `${head} What is the earliest start time of activity ${a.id}, in days?`,
          answerType: 'numeric', answer: { value: sch.es[a.id] }, answerSuffix: 'days',
          traps: [{ value: Math.min(...a.pre.map(p => sch.ef[p])), why: `Activity ${a.id} cannot start until all of its predecessors have finished, so use the latest of their finish times.` }].filter(t => t.value !== sch.es[a.id]),
          hints: ['Earliest start $=$ the largest earliest finish among the predecessors.', `Work forwards from the activities with no predecessor.`, 'Earliest finish $=$ earliest start $+$ duration.'],
          steps: [{ h: 'Forward pass', d: `${acts.map(x => `${x.id}: start ${sch.es[x.id]}, finish ${sch.ef[x.id]}`).join('; ')}` }, { h: 'Read it', d: `Earliest start of ${a.id} $= ${sch.es[a.id]}$ days` }]
        };
      }
      if (diff === 4) {
        const critical = acts.filter(a => sch.float[a.id] === 0);
        return {
          prompt: `${head} How many of the activities have a float time of zero (so that delaying any of them delays the whole project)?`,
          answerType: 'numeric', answer: { value: critical.length },
          traps: [{ value: acts.length, why: 'Only the activities on a critical path have no float; the others can be delayed a little.' }].filter(t => t.value !== critical.length),
          hints: ['Float $=$ latest start $-$ earliest start.', 'Do a forward pass, then a backward pass.', 'Count the activities whose float is $0$.'],
          steps: [{ h: 'Float of each activity', d: acts.map(a => `${a.id}: ${sch.float[a.id]}`).join('; ') }, { h: 'Count the zeros', d: `${critical.map(a => a.id).join(', ')} — ${critical.length} activities` }]
        };
      }
      if (diff === 2) {
        return {
          prompt: `${head} What is the minimum time to complete the whole project, in days?`,
          answerType: 'numeric', answer: { value: sch.end }, answerSuffix: 'days',
          traps: [{ value: acts.reduce((s, a) => s + a.d, 0), why: 'Activities can run at the same time, so the project time is the longest path, not the sum of every duration.' }],
          hints: ['Find the longest path (the critical path).', 'Use a forward pass: earliest finish of the last activity.', 'Activities with no link can run together.'],
          steps: [{ h: 'Forward pass', d: `${acts.map(x => `${x.id}: ${sch.es[x.id]} → ${sch.ef[x.id]}`).join('; ')}` }, { h: 'Project time', d: `The last finish is $${sch.end}$ days` }]
        };
      }
      const slack = acts.filter(a => sch.float[a.id] > 0);
      if (!slack.length) continue;
      const a = rc(rng, slack);
      return {
        prompt: `${head} What is the float time of activity ${a.id}, in days?`,
        answerType: 'numeric', answer: { value: sch.float[a.id] }, answerSuffix: 'days',
        traps: [{ value: sch.end, why: 'Float is how long an activity can be delayed without delaying the project: latest start minus earliest start.' }].filter(t => t.value !== sch.float[a.id]),
        hints: ['Float $=$ latest start $-$ earliest start.', 'Do a forward pass, then a backward pass.', `Project time is $${sch.end}$ days.`],
        steps: [{ h: 'Earliest and latest starts', d: `${a.id}: earliest start ${sch.es[a.id]}, latest start ${sch.ls[a.id]}` }, { h: 'Float', d: `$${sch.ls[a.id]} - ${sch.es[a.id]} = ${sch.float[a.id]}$ days` }]
      };
    }
    throw new Error('ms12-critical-path: no suitable project found');
  },

  // ── Bivariate data: lines of best fit ──────────────────────────────────────
  'ms12-bivariate-fit': (rng, diff) => {
    const a = ri(rng, 5, 40), b = ri(rng, 2, 9);
    const ctx = rc(rng, [
      { x: 'hours of practice', y: 'questions answered correctly', u: 'hours' },
      { x: 'advertising spend (thousands of dollars)', y: 'weekly sales (thousands of dollars)', u: 'thousand dollars' },
      { x: 'daily maximum temperature (°C)', y: 'cold drinks sold', u: '°C' }
    ]);
    if (diff === 1) {
      const x = ri(rng, 3, 12);
      return {
        prompt: `A line of best fit for ${ctx.y} ($y$) against ${ctx.x} ($x$) is $y = ${a} + ${b}x$. Use it to predict $y$ when $x = ${x}$.`,
        answerType: 'numeric', answer: { value: a + b * x },
        traps: [{ value: (a + b) * x, why: 'Substitute $x$, multiply by the gradient only, then add the intercept.' }],
        hints: ['Substitute the value of $x$ into the equation.', `$${b}\\times ${x} = ${b * x}$.`, `Add $${a}$.`],
        steps: [{ h: 'Substitute', d: `$y = ${a} + ${b}(${x}) = ${a + b * x}$` }]
      };
    }
    if (diff === 2) {
      const dx = ri(rng, 2, 6);
      return {
        prompt: `A line of best fit for ${ctx.y} ($y$) against ${ctx.x} ($x$) is $y = ${a} + ${b}x$. According to the line, by how much does $y$ change when $x$ increases by $${dx}$?`,
        answerType: 'numeric', answer: { value: b * dx },
        traps: [{ value: b, why: `The gradient is the change in $y$ for each increase of 1 in $x$; here $x$ increases by ${dx}.` }],
        hints: ['The gradient is the change in $y$ for a 1-unit change in $x$.', `The gradient is $${b}$.`, `Multiply by $${dx}$.`],
        steps: [{ h: 'Use the gradient', d: `$\\Delta y = ${b}\\times ${dx} = ${b * dx}$` }]
      };
    }
    if (diff === 3) {
      const x1 = ri(rng, 1, 4), x2 = x1 + ri(rng, 2, 5), x3 = x2 + ri(rng, 2, 6);
      const y1 = a + b * x1, y2 = a + b * x2;
      return {
        prompt: `A line of best fit passes through $(${x1}, ${y1})$ and $(${x2}, ${y2})$. Use the line to predict $y$ when $x = ${x3}$.`,
        answerType: 'numeric', answer: { value: a + b * x3 },
        traps: [{ value: y2 + (x3 - x2), why: 'Find the gradient first, then change $y$ by the gradient for each step in $x$.' }].filter(t => t.value !== a + b * x3),
        hints: ['Find the gradient from the two points.', `$m = \\dfrac{${y2} - ${y1}}{${x2} - ${x1}} = ${b}$.`, `From $(${x2}, ${y2})$ move $${x3 - x2}$ units in $x$.`],
        steps: [
          { h: 'Gradient', d: `$m = \\dfrac{${y2} - ${y1}}{${x2} - ${x1}} = ${b}$` },
          { h: 'Predict', d: `$y = ${y2} + ${b}(${x3} - ${x2}) = ${a + b * x3}$` }
        ]
      };
    }
    const x = ri(rng, 3, 12);
    return {
      prompt: `A line of best fit for ${ctx.y} ($y$) against ${ctx.x} ($x$) is $y = ${a} + ${b}x$. For what value of $x$ does the line predict $y = ${a + b * x}$?`,
      answerType: 'numeric', answer: { value: x },
      traps: [{ value: (a + b * x) / b, why: 'Take off the intercept before dividing by the gradient.' }].filter(t => t.value !== x),
      hints: ['Set $y$ equal to the value and solve for $x$.', `$${a} + ${b}x = ${a + b * x}$.`, `$${b}x = ${b * x}$.`],
      steps: [{ h: 'Solve', d: `$${a} + ${b}x = ${a + b * x} \\Rightarrow ${b}x = ${b * x} \\Rightarrow x = ${x}$` }]
    };
  },

  // ── The normal distribution ────────────────────────────────────────────────
  'ms12-normal-exact': (rng, diff) => {
    const mu = ri(rng, 40, 90), sd = ri(rng, 2, 8);
    if (diff === 1) {
      const z = rc(rng, [1, 2, 3, -1, -2, -3]);
      const x = mu + z * sd;
      return {
        prompt: `Scores on a test are normally distributed with mean $${mu}$ and standard deviation $${sd}$. What is the $z$-score of a score of $${x}$?`,
        answerType: 'numeric', answer: { value: z },
        traps: [{ value: -z, why: z > 0 ? 'A value above the mean has a positive $z$-score.' : 'A value below the mean has a negative $z$-score.' }],
        hints: ['$z = \\dfrac{x - \\mu}{\\sigma}$.', `$${x} - ${mu} = ${x - mu}$.`, `Divide by $${sd}$.`],
        steps: [{ h: 'Formula', d: `$z = \\dfrac{${x} - ${mu}}{${sd}} = ${z}$` }]
      };
    }
    if (diff === 2) {
      const z = rc(rng, [1, 2, 3, -1, -2, -3]);
      return {
        prompt: `Scores are normally distributed with mean $${mu}$ and standard deviation $${sd}$. What score has a $z$-score of $${z}$?`,
        answerType: 'numeric', answer: { value: mu + z * sd },
        traps: [{ value: z * sd, why: 'Add the mean: $x = \\mu + z\\sigma$.' }],
        hints: ['$x = \\mu + z\\sigma$.', `$z\\sigma = ${z * sd}$.`, `Add $${mu}$.`],
        steps: [{ h: 'Rearrange', d: `$x = ${mu} + (${z})(${sd}) = ${mu + z * sd}$` }]
      };
    }
    if (diff === 3) {
      const k = rc(rng, [1, 2, 3]);
      const pct = { 1: 68, 2: 95, 3: 99.7 }[k];
      const N = { 1: rc(rng, [500, 1000, 2500]), 2: rc(rng, [1000, 2000, 4000]), 3: rc(rng, [1000, 2000, 5000]) }[k];
      return {
        prompt: `A normally distributed variable has mean $${mu}$ and standard deviation $${sd}$. In a sample of $${N}$ values, using the 68–95–99.7 rule, about how many are expected to lie between $${mu - k * sd}$ and $${mu + k * sd}$?`,
        answerType: 'numeric', answer: { value: Math.round(N * pct * 10) / 1000 },
        traps: [{ value: Math.round(N * pct * 5) / 1000, why: 'The 68–95–99.7 percentages already cover both sides of the mean.' }],
        hints: [`These limits are $${k}$ standard deviation${k > 1 ? 's' : ''} either side of the mean.`, `That is about ${pct}% of the values.`, `${pct}% of $${N}$.`],
        steps: [{ h: 'Match the rule', d: `$\\mu \\pm ${k}\\sigma$ contains about ${pct}% of values` }, { h: 'Count', d: `${pct}% of $${N} = ${Math.round(N * pct * 10) / 1000}$` }]
      };
    }
    const k = rc(rng, [1, 2, 3]);
    const pct = { 1: 16, 2: 2.5, 3: 0.15 }[k];
    const N = { 1: rc(rng, [500, 1000, 2500]), 2: rc(rng, [2000, 4000]), 3: rc(rng, [2000, 4000, 10000]) }[k];
    return {
      prompt: `A normally distributed variable has mean $${mu}$ and standard deviation $${sd}$. In a sample of $${N}$ values, using the 68–95–99.7 rule, about how many are expected to be greater than $${mu + k * sd}$?`,
      answerType: 'numeric', answer: { value: Math.round(N * pct * 10) / 1000 },
      traps: [{ value: Math.round(N * (100 - pct) * 10) / 1000, why: 'The question asks for the values above the limit, not below it.' }],
      hints: [`$${mu + k * sd}$ is $${k}$ standard deviation${k > 1 ? 's' : ''} above the mean.`, `About ${pct}% of values lie above that.`, `${pct}% of $${N}$.`],
      steps: [{ h: 'Match the rule', d: `Above $\\mu + ${k}\\sigma$: about ${pct}%` }, { h: 'Count', d: `${pct}% of $${N} = ${Math.round(N * pct * 10) / 1000}$` }]
    };
  },

  // ── Standard 1 · Investment (simple interest) ─────────────────────────────
  'ms12-simple-interest': (rng, diff) => {
    const P = 1000 * ri(rng, 1, 9), r = rc(rng, [2, 3, 4, 5, 6, 8]), n = ri(rng, 2, 6);
    const I = P * r / 100 * n;
    if (diff === 1) {
      return {
        prompt: `${D(P)} is invested at ${r}% per annum simple interest for ${n} years. How much interest is earned, in dollars?`,
        answerType: 'numeric', answer: { value: I },
        traps: [{ value: P * r / 100, why: `That is one year's interest. Simple interest is the same each year, so multiply by the ${n} years.` }],
        hints: ['$I = Prn$ with $r$ as a decimal.', `$r = ${r / 100}$.`, `$${P}\\times ${r / 100}\\times ${n}$.`],
        steps: [{ h: 'Simple interest', d: `$I = ${P}\\times ${r / 100}\\times ${n} = ${I}$ dollars` }]
      };
    }
    if (diff === 2) {
      return {
        prompt: `${D(P)} is invested at ${r}% per annum simple interest for ${n} years. What is the total value of the investment at the end, in dollars?`,
        answerType: 'numeric', answer: { value: P + I },
        traps: [{ value: I, why: 'The value includes the amount first invested as well as the interest.' }],
        hints: ['Total value $=$ amount invested $+$ interest.', `$I = ${P}\\times ${r / 100}\\times ${n} = ${I}$.`, `$${P} + ${I}$.`],
        steps: [{ h: 'Interest', d: `$I = ${P}\\times ${r / 100}\\times ${n} = ${I}$` }, { h: 'Total', d: `$${P} + ${I} = ${P + I}$ dollars` }]
      };
    }
    if (diff === 3) {
      return {
        prompt: `An investment of ${D(P)} earns ${D(I)} simple interest in ${n} years. What is the annual interest rate, as a percentage?`,
        answerType: 'numeric', answer: { value: r }, answerSuffix: '%',
        traps: [{ value: r * n, why: `The interest over ${n} years is ${r * n}% of the investment; divide by the number of years for the annual rate.` }],
        hints: ['$I = Prn$, so $r = \\dfrac{I}{Pn}$.', `$r = \\dfrac{${I}}{${P}\\times ${n}}$.`, 'Write the decimal as a percentage.'],
        steps: [{ h: 'Rearrange', d: `$r = \\dfrac{${I}}{${P}\\times ${n}} = ${r / 100}$` }, { h: 'As a percentage', d: `$${r}\\%$` }]
      };
    }
    return {
      prompt: `${D(P)} is invested at ${r}% per annum simple interest. For how many years must it be invested to earn ${D(I)} in interest?`,
      answerType: 'numeric', answer: { value: n }, answerSuffix: 'years',
      traps: [{ value: I / P, why: 'Divide the interest by the interest earned each year, not by the amount invested.' }].filter(t => t.value !== n),
      hints: ['$I = Prn$, so $n = \\dfrac{I}{Pr}$.', `Interest each year: $${P}\\times ${r / 100} = ${P * r / 100}$.`, `$${I}\\div ${P * r / 100}$.`],
      steps: [{ h: 'Interest each year', d: `$${P}\\times ${r / 100} = ${P * r / 100}$` }, { h: 'Number of years', d: `$${I}\\div ${P * r / 100} = ${n}$` }]
    };
  },

  // ── Standard 1 · Depreciation and loans ───────────────────────────────────
  'ms12-depreciation': (rng, diff) => {
    const V0 = 1000 * ri(rng, 5, 40), d = 500 * ri(rng, 1, 6), n = ri(rng, 2, 6);
    if (diff === 1) {
      const V = V0 - d * n;
      if (V < 0.3 * V0) return raw['ms12-depreciation'](rng, diff);
      return {
        prompt: `A van is bought for ${D(V0)} and loses ${D(d)} of its value each year (straight-line depreciation). What is it worth after ${n} years, in dollars?`,
        answerType: 'numeric', answer: { value: V },
        traps: [{ value: V0 - d, why: `The loss happens every year: take off ${D(d)} for each of the ${n} years.` }].filter(t => t.value !== V),
        hints: ['Straight-line depreciation takes off the same amount each year.', `Total loss $= ${d}\\times ${n} = ${d * n}$.`, `$${V0} - ${d * n}$.`],
        steps: [{ h: 'Total depreciation', d: `$${d}\\times ${n} = ${d * n}$` }, { h: 'Value', d: `$${V0} - ${d * n} = ${V}$ dollars` }]
      };
    }
    if (diff === 2) {
      const V = V0 - d * n;
      if (V <= 0) return raw['ms12-depreciation'](rng, diff);
      return {
        prompt: `A machine bought for ${D(V0)} is worth ${D(V)} after ${n} years. Assuming straight-line depreciation, how many dollars does it lose each year?`,
        answerType: 'numeric', answer: { value: d },
        traps: [{ value: V0 - V, why: `That is the loss over all ${n} years; divide by ${n} for one year.` }],
        hints: ['Loss in value $= \\text{original} - \\text{current}$.', `$${V0} - ${V} = ${V0 - V}$.`, `Divide by $${n}$ years.`],
        steps: [{ h: 'Total loss', d: `$${V0} - ${V} = ${V0 - V}$` }, { h: 'Per year', d: `$${V0 - V}\\div ${n} = ${d}$ dollars` }]
      };
    }
    if (diff === 3) {
      // Flat interest r% a year over a whole number of years, shared into equal monthly instalments.
      let P, r, yrs, total;
      for (let tries = 0; ; tries++) {
        P = 1000 * ri(rng, 2, 20); r = rc(rng, [5, 6, 8, 9, 10]); yrs = ri(rng, 1, 4);
        total = P + P * r / 100 * yrs;
        if (Number.isInteger(total / (12 * yrs))) break;
        if (tries > 2000) throw new Error('ms12-depreciation: no whole instalment found');
      }
      const months = 12 * yrs, m = total / months;
      return {
        prompt: `A loan of ${D(P)} is repaid in equal instalments of ${D(m)} per month for ${months} months. How much interest is paid in total, in dollars?`,
        answerType: 'numeric', answer: { value: total - P },
        traps: [{ value: total, why: 'That is everything repaid. The interest is the amount repaid less the amount borrowed.' }],
        hints: ['Total repaid $=$ instalment $\\times$ number of instalments.', `$${m}\\times ${months} = ${total}$.`, 'Interest = total repaid $-$ amount borrowed.'],
        steps: [{ h: 'Total repaid', d: `$${m}\\times ${months} = ${total}$` }, { h: 'Interest', d: `$${total} - ${P} = ${total - P}$ dollars` }]
      };
    }
    const lose = d * n;
    return {
      prompt: `A tractor bought for ${D(V0 + lose)} loses ${D(d)} of its value each year (straight-line depreciation). After how many years is it worth ${D(V0)}?`,
      answerType: 'numeric', answer: { value: n }, answerSuffix: 'years',
      traps: [{ value: V0 / d, why: 'Use the amount of value lost (original less current), not the current value.' }].filter(t => t.value !== n),
      hints: ['Value lost $=$ original $-$ current.', `$${V0 + lose} - ${V0} = ${lose}$.`, `Divide by $${d}$ a year.`],
      steps: [{ h: 'Value lost', d: `$${V0 + lose} - ${V0} = ${lose}$` }, { h: 'Years', d: `$${lose}\\div ${d} = ${n}$` }]
    };
  },

  // ── Standard 1 · Right-angled triangles (exact values only) ───────────────
  'ms12-right-triangle': (rng, diff) => {
    if (diff === 1) {
      const k = ri(rng, 2, 9), [a, b, c] = rc(rng, [[3, 4, 5], [5, 12, 13], [8, 15, 17]]);
      return {
        prompt: `A right-angled triangle has perpendicular sides of $${a * k}$ cm and $${b * k}$ cm. What is the length of the hypotenuse, in centimetres?`,
        answerType: 'numeric', answer: { value: c * k }, answerSuffix: 'cm',
        traps: [{ value: (a + b) * k, why: "Use Pythagoras: $c^2 = a^2 + b^2$, then take the square root. The hypotenuse is shorter than the sum of the sides." }],
        hints: ["Pythagoras' theorem: $c^2 = a^2 + b^2$.", `$${a * k}^2 + ${b * k}^2 = ${(a * k) ** 2 + (b * k) ** 2}$.`, 'Take the square root.'],
        steps: [{ h: 'Pythagoras', d: `$c^2 = ${(a * k) ** 2} + ${(b * k) ** 2} = ${(c * k) ** 2}$` }, { h: 'Square root', d: `$c = ${c * k}$ cm` }]
      };
    }
    if (diff === 2) {
      // A ladder up to 10 m, or a support wire up to 25 m: lengths that exist.
      const [a, b, c, k, thing] = rc(rng, [[3, 4, 5, 1, 'ladder'], [3, 4, 5, 2, 'ladder'], [5, 12, 13, 1, 'support wire'], [8, 15, 17, 1, 'support wire'], [9, 12, 15, 1, 'support wire'], [12, 16, 20, 1, 'support wire'], [7, 24, 25, 1, 'support wire']]);
      const wall = thing === 'ladder' ? 'leans against a vertical wall' : 'runs from the top of a vertical pole to the ground';
      const findHeight = rng() < 0.5;
      const known = findHeight ? a * k : b * k, ans = findHeight ? b * k : a * k;
      return {
        prompt: findHeight
          ? `A ${thing} $${c * k}$ m long ${wall}. Its lower end is $${a * k}$ m from the base. How high is its top above the ground, in metres?`
          : `A ${thing} $${c * k}$ m long ${wall}. Its top is $${b * k}$ m above the ground. How far is its lower end from the base, in metres?`,
        answerType: 'numeric', answer: { value: ans }, answerSuffix: 'm',
        traps: [{ value: c * k - known, why: `The ${thing} is the hypotenuse: subtract the squares, then take the square root.` }].filter(t => t.value !== ans),
        hints: [`The ${thing} is the hypotenuse of a right-angled triangle.`, `Other side$^2 = ${c * k}^2 - ${known}^2 = ${(c * k) ** 2 - known ** 2}$.`, 'Take the square root.'],
        steps: [{ h: 'Pythagoras', d: `side$^2 = ${(c * k) ** 2} - ${known ** 2} = ${ans ** 2}$` }, { h: 'Square root', d: `The side is $${ans}$ m` }]
      };
    }
    if (diff === 3) {
      const ang = rc(rng, [30, 60]);
      const L = 2 * ri(rng, 2, 5);
      const trig = ang === 30 ? 'sin' : 'cos';
      const ratio = ang === 30 ? 'opposite side and hypotenuse' : 'adjacent side and hypotenuse';
      const word = ang === 30 ? 'opposite' : 'adjacent';
      return {
        prompt: ang === 30
          ? `A ramp $${L}$ m long makes an angle of $30^\\circ$ with the horizontal ground. How high is the top of the ramp above the ground, in metres? (Use $\\sin 30^\\circ = \\tfrac12$.)`
          : `A ladder $${L}$ m long leans against a vertical wall and makes an angle of $60^\\circ$ with the wall. How far up the wall does it reach, in metres? (Use $\\cos 60^\\circ = \\tfrac12$.)`,
        answerType: 'numeric', answer: { value: L / 2 }, answerSuffix: 'm',
        traps: [{ value: L * 2, why: `The length is the hypotenuse times $\\${trig}\\,${ang}^\\circ = \\tfrac12$, so it cannot be longer than the ${ang === 30 ? 'ramp' : 'ladder'}.` }],
        hints: [`Use $\\${trig}$ with the ${ratio}.`, `$\\${trig}\\,${ang}^\\circ = \\tfrac12$.`, `$${L}\\times\\tfrac12$.`],
        steps: [{ h: 'Choose the ratio', d: `$\\${trig}\\,${ang}^\\circ = \\dfrac{\\text{${word}}}{\\text{hypotenuse}} = \\dfrac12$` }, { h: 'Evaluate', d: `$${L}\\times\\tfrac12 = ${L / 2}$ m` }]
      };
    }
    const k = ri(rng, 2, 12), kind = rc(rng, ['tan', 'sin', 'cos']);
    const ans = { tan: 45, sin: 30, cos: 60 }[kind];
    const [x, y, sx, sy] = kind === 'tan' ? [k, k, 'opposite', 'adjacent'] : kind === 'sin' ? [k, 2 * k, 'opposite', 'hypotenuse'] : [k, 2 * k, 'adjacent', 'hypotenuse'];
    const ratio = kind === 'tan' ? '1' : '\\tfrac12';
    return {
      prompt: `In a right-angled triangle, the side ${sx} to the acute angle $\\theta$ is $${x}$ cm and the ${sy === 'hypotenuse' ? 'hypotenuse' : `side ${sy} to $\\theta$`} is $${y}$ cm. Find $\\theta$ in degrees.`,
      answerType: 'numeric', answer: { value: ans }, answerSuffix: '°',
      traps: [{ value: 90 - ans, why: `The ratio is $\\${kind}\\,\\theta = \\dfrac{${x}}{${y}} = ${ratio}$, which is the ratio for ${ans}°, not ${90 - ans}°.` }].filter(t => t.value !== ans),
      hints: [`You are given the ${sx} side and the ${sy}, so use $\\${kind}$.`, `$\\${kind}\\,\\theta = \\dfrac{${x}}{${y}} = ${ratio}$.`, `Use the inverse ${kind} on your calculator.`],
      steps: [{ h: 'Choose the ratio', d: `${sx} and ${sy}: $\\${kind}\\,\\theta = \\dfrac{${x}}{${y}} = ${ratio}$` }, { h: 'Inverse ratio', d: `$\\theta = ${ans}^\\circ$` }]
    };
  }
};

// A dollar answer is asked for in a box with a "$" prefix, as the older money cells do: the marker
// reads a "$" typed with a money answer only when the question says it asks for money.
const MONEY = { 'ms12-invest-loans': [1, 2, 3, 4], 'ms12-annuity-table': [1, 2, 3, 4], 'ms12-algebraic': [2, 4], 'ms12-rates': [3], 'ms12-simple-interest': [1, 2], 'ms12-depreciation': [1, 2, 3] };
const withMoneyPrefix = (id, fn) => (rng, diff) => {
  const q = fn(rng, diff);
  return MONEY[id]?.includes(diff) ? { ...q, answerPrefix: '$' } : q;
};

// A misconception trap that equals the key is not a misconception: drop it.
const dropKeyTraps = fn => (rng, diff) => {
  const q = fn(rng, diff);
  if (Array.isArray(q.traps) && typeof q.answer?.value === 'number') q.traps = q.traps.filter(t => !(typeof t.value === 'number' && t.value === q.answer.value));
  return q;
};

export const streamsStandardNsw = Object.freeze(Object.fromEntries(Object.entries(raw).map(([id, fn]) => [id, dropKeyTraps(withMoneyPrefix(id, fn))])));
