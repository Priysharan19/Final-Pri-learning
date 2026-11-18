// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Prithagoras content-gap forms, batch A (empty practice cells)
//   y8-equations   D1  dot point 0  solve equations involving brackets (entry level)
//   y8-linear      D4  dot points 1, 2  line through two points; gradient from a
//                      table; gradient / intercept after rearranging
//   y11-trigfunc   D4  dot points 1, 2  angles of any magnitude; simple trig equations
//   y11-quadfunc   D1  dot point 1  the discriminant and the nature of the roots
// Every question is original wording. Every key is computed in code from the
// numbers the prompt shows; exact keys carry no tolerance (the AI never sets a
// mark). Variants are chosen by au-forms-apply.js.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, nz, mcq, term, sgn } from '../qhelpers.js';

const REJ = Symbol('reject');
const rej = cond => { if (cond) throw REJ; };
/** Re-draw (same rng, so still deterministic) until a variant accepts its numbers. */
const R = fn => (rng, diff) => {
  for (let i = 0; i < 200; i++) {
    try { return fn(rng, diff); } catch (e) { if (e !== REJ) throw e; }
  }
  throw new Error('gaps-a variant: no acceptable draw');
};
const V = (diffs, fn) => ({ diffs, make: R(fn) });
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
const par = v => (v < 0 ? `(${v})` : String(v));
/** coefficient of a leading term: 1 → '', -1 → '-' */
const co = c => (c === 1 ? '' : c === -1 ? '-' : String(c));

function num(prompt, value, { prefix, suffix, traps = [], hints, steps, extra = {} } = {}) {
  rej(!Number.isFinite(value));
  const seen = new Set([value]);
  const tr = [];
  for (const t of traps) {
    if (!Number.isFinite(t.value) || seen.has(t.value)) continue;
    seen.add(t.value); tr.push(t);
  }
  const q = { prompt, answerType: 'numeric', answer: { value }, traps: tr, hints, steps, ...extra };
  if (prefix) q.answerPrefix = prefix;
  if (suffix) q.answerSuffix = suffix;
  return q;
}
function mc(rng, prompt, correct, ds, hints, steps, extra = {}) {
  const m = mcq(rng, correct, ds);
  return { prompt, answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options, hints, steps, ...extra };
}

// ═══════════════════════ y8-equations · D1 · brackets ═══════════════════════
const equations = [
  // c = a(x − b), the equation written the other way round
  V([1], rng => {
    const x = ri(rng, -6, 12), a = rc(rng, [2, 3, 4, 5, 6, 7]), b = ri(rng, 1, 9);
    const c = a * (x - b);
    return num(`Solve $${c} = ${a}(x - ${b})$.`, x, {
      prefix: 'x =',
      traps: [{ value: c / a - b, why: `Divide by ${a} first: the bracket is $x - ${b}$, so add ${b} to undo the subtraction.` }],
      hints: ['The unknown is in the bracket on the right; the number is on the left, which is fine.', `Divide both sides by ${a}: the bracket equals ${c / a}.`, `Undo the subtraction of ${b}.`],
      steps: [{ h: `Divide both sides by ${a}`, d: `$${c / a} = x - ${b}$` }, { h: `Add ${b}`, d: `$x = ${x}$` }, { h: 'Check', d: `$${a}(${par(x)} - ${b}) = ${c}$ ✓` }],
      extra: { dotpoint: 0, stepcheck: { kind: 'equation', variable: 'x', solutions: [x] } }
    });
  }),
  // negative multiplier −a(x + b) = c
  V([1], rng => {
    const x = ri(rng, -8, 8), a = rc(rng, [2, 3, 4, 5]), b = nz(rng, -7, 7);
    const c = -a * (x + b);
    rej(c === 0);
    return num(`Solve $-${a}(x ${sgn(b)}) = ${c}$.`, x, {
      prefix: 'x =',
      traps: [{ value: c / a - b, why: `The multiplier is $-${a}$, so divide both sides by $-${a}$ (the sign changes).` }],
      hints: [`Divide both sides by $-${a}$ — remember what happens to the sign of ${c}.`, `The bracket equals ${c / -a}.`, `Now undo the ${sgn(b)}.`],
      steps: [{ h: `Divide both sides by $-${a}$`, d: `$x ${sgn(b)} = ${c / -a}$` }, { h: `${b > 0 ? 'Subtract' : 'Add'} ${Math.abs(b)}`, d: `$x = ${x}$` }, { h: 'Check', d: `$-${a}(${par(x)} ${sgn(b)}) = ${c}$ ✓` }],
      extra: { dotpoint: 0, stepcheck: { kind: 'equation', variable: 'x', solutions: [x] } }
    });
  }),
  // the variable second: a(b − x) = c
  V([1], rng => {
    const x = ri(rng, -6, 9), a = rc(rng, [2, 3, 4, 5]), b = ri(rng, 1, 9);
    const c = a * (b - x);
    rej(c === 0);
    return num(`Solve $${a}(${b} - x) = ${c}$.`, x, {
      prefix: 'x =',
      traps: [{ value: c / a - b, why: `After dividing by ${a} you have $${b} - x = ${c / a}$, so $x = ${b} - ${par(c / a)}$, not $${c / a} - ${b}$.` }],
      hints: [`Divide both sides by ${a}.`, `Now $${b} - x = ${c / a}$.`, 'Take care: the unknown is being subtracted, so isolate $-x$ and then change its sign.'],
      steps: [{ h: `Divide both sides by ${a}`, d: `$${b} - x = ${c / a}$` }, { h: `Subtract ${b}`, d: `$-x = ${c / a - b}$` }, { h: 'Change the sign', d: `$x = ${x}$` }, { h: 'Check', d: `$${a}(${b} - ${par(x)}) = ${c}$ ✓` }],
      extra: { dotpoint: 0, stepcheck: { kind: 'equation', variable: 'x', solutions: [x] } }
    });
  }),
  // worded: a number plus b, times a, gives c — then solve the bracket equation
  V([1], rng => {
    const x = ri(rng, 1, 12), a = rc(rng, [2, 3, 4, 5, 6]), b = ri(rng, 1, 9);
    const c = a * (x + b);
    return num(`I think of a number $x$, add ${b}, then multiply the result by ${a}. I get ${c}. This gives the equation $${a}(x + ${b}) = ${c}$. Solve it to find my number.`, x, {
      prefix: 'x =',
      traps: [{ value: (c - b) / a, why: `The ${a} multiplies the whole bracket, not just $x$.` }],
      hints: ['Undo the last operation first: the multiplication by ' + a + '.', `The bracket equals ${c / a}.`, `Then undo the addition of ${b}.`],
      steps: [{ h: `Divide by ${a}`, d: `$x + ${b} = ${c / a}$` }, { h: `Subtract ${b}`, d: `$x = ${x}$` }, { h: 'Check', d: `$${a}(${x} + ${b}) = ${c}$ ✓` }],
      extra: { dotpoint: 0, stepcheck: { kind: 'equation', variable: 'x', solutions: [x] } }
    });
  }),
  // expand first: a(x + b) = c shown with its expansion step requested
  V([1], rng => {
    const x = ri(rng, -6, 10), a = rc(rng, [2, 3, 4, 5, 6]), b = nz(rng, -6, 6);
    const c = a * (x + b);
    const ab = a * b;
    return num(`Expand the bracket, then solve: $${a}(x ${sgn(b)}) = ${c}$.`, x, {
      prefix: 'x =',
      traps: [{ value: (c - b) / a, why: `Expanding gives $${a}x ${sgn(ab)}$: the ${a} multiplies the ${Math.abs(b)} as well.` }],
      hints: [`Multiply every term inside the bracket by ${a}.`, `You should get $${a}x ${sgn(ab)} = ${c}$.`, 'Then solve the two-step equation.'],
      steps: [{ h: 'Expand', d: `$${a}x ${sgn(ab)} = ${c}$` }, { h: `${ab > 0 ? 'Subtract' : 'Add'} ${Math.abs(ab)}`, d: `$${a}x = ${c - ab}$` }, { h: `Divide by ${a}`, d: `$x = ${x}$` }],
      extra: { dotpoint: 0, stepcheck: { kind: 'equation', variable: 'x', solutions: [x] } }
    });
  })
];

// ═══════════════════════ y8-linear · D4 ═════════════════════════════════════
const linear = [
  // gradient and y-intercept after rearranging  k·y = p·x + q
  V([4], rng => {
    const k = rc(rng, [2, 3, 4]), m = nz(rng, -4, 4), c = nz(rng, -6, 6);
    const p = k * m, q = k * c;
    const mm = mc(rng, `The equation of a line is $${k}y = ${co(p)}x ${sgn(q)}$. What are its gradient and y-intercept?`,
      `gradient $${m}$, y-intercept $${c}$`,
      [{ text: `gradient $${p}$, y-intercept $${q}$`, why: `The equation is not yet in the form $y = mx + c$: divide every term by ${k} first.` },
        { text: `gradient $${m}$, y-intercept $${q}$`, why: `Divide the constant by ${k} too, not just the $x$ term.` },
        { text: `gradient $${c}$, y-intercept $${m}$`, why: 'The gradient is the coefficient of $x$; the y-intercept is the constant.' }],
      [`Divide every term by ${k} so that $y$ stands alone.`, `$y = ${term(m)} ${sgn(c)}$ would be the rearranged form — check each term was divided.`, 'Compare with $y = mx + c$.'],
      [{ h: `Divide every term by ${k}`, d: `$y = ${term(m)} ${sgn(c)}$` }, { h: 'Read off', d: `$m = ${m}$, $c = ${c}$` }],
      { dotpoint: 2 });
    return mm;
  }),
  // gradient of  p·x + y = q   (numeric)
  V([4], rng => {
    const p = nz(rng, -6, 6), q = nz(rng, -12, 12);
    const m = -p;
    return num(`Rearrange $${co(p)}x + y = ${q}$ into the form $y = mx + c$, and state the gradient.`, m, {
      prefix: 'm =',
      traps: [{ value: p, why: 'Moving the $x$ term to the other side changes its sign.' }],
      hints: ['Get $y$ on its own by moving the $x$ term across.', 'Subtract the $x$ term from both sides: its sign changes.', 'The gradient is the coefficient of $x$.'],
      steps: [{ h: 'Rearrange', d: `$y = ${term(-p)} ${sgn(q)}$` }, { h: 'Read the gradient', d: `$m = ${m}$` }],
      extra: { dotpoint: 2 }
    });
  }),
  // y-intercept from  ax + by = c   (numeric)
  V([4], rng => {
    const b = rc(rng, [2, 3, 4, 5]), yint = nz(rng, -6, 6), a = nz(rng, -7, 7);
    const c = b * yint;
    return num(`A line has equation $${co(a)}x + ${b}y = ${c}$. Find its y-intercept.`, yint, {
      traps: [{ value: c, why: `Make $y$ the subject: divide every term by ${b}, including ${c}.` }],
      hints: ['The y-intercept is the value of $y$ when $x = 0$.', `Put $x = 0$ in the equation: $${b}y = ${c}$.`, `Divide by ${b}.`],
      steps: [{ h: 'Put x = 0', d: `$${b}y = ${c}$` }, { h: `Divide by ${b}`, d: `$y = ${yint}$` }],
      extra: { dotpoint: 2 }
    });
  }),
  // gradient from a table of values with unequal x-steps
  V([4], rng => {
    const m = nz(rng, -4, 4), c = nz(rng, -8, 8), x0 = ri(rng, -3, 1), step = rc(rng, [2, 3]);
    const xs = [0, 1, 2, 3].map(i => x0 + i * step);
    const ys = xs.map(x => m * x + c);
    return num(`Points on a straight line have $x$-values $${xs.join(', ')}$ and corresponding $y$-values $${ys.join(', ')}$ respectively. Find the gradient of the line.`, m, {
      prefix: 'm =',
      traps: [{ value: m * step, why: `The $x$-values go up by ${step} each time, not by 1: divide the change in $y$ by the change in $x$.` }],
      hints: ['Gradient = change in $y$ ÷ change in $x$ between any two columns.', `The $x$-values increase by ${step} from one column to the next.`, 'Divide the change in $y$ by that step.'],
      steps: [{ h: 'Pick two columns', d: `$x$ goes from ${xs[0]} to ${xs[1]} (change ${step}), $y$ goes from ${ys[0]} to ${ys[1]} (change ${ys[1] - ys[0]})` }, { h: 'Divide', d: `$m = \\dfrac{${ys[1] - ys[0]}}{${step}} = ${m}$` }],
      extra: { dotpoint: 1 }
    });
  }),
  // equation from gradient and a point
  V([4], rng => {
    const m = nz(rng, -4, 4), c = nz(rng, -8, 8), px = nz(rng, -4, 4);
    const py = m * px + c;
    return {
      prompt: `A line has gradient $${m}$ and passes through the point $(${px}, ${py})$. Find its equation in the form $y = mx + c$.`,
      answerType: 'expression', answer: { expr: `${term(m)} ${sgn(c)}` }, answerPrefix: 'y =', dotpoint: 1,
      inputHint: 'e.g. 2x - 3',
      traps: [],
      hints: [`The gradient is given, so $y = ${m}x + c$.`, 'Substitute the coordinates of the point into this equation.', 'Solve the resulting equation for $c$.'],
      steps: [{ h: 'Use the gradient', d: `$y = ${m}x + c$` }, { h: 'Substitute the point', d: `$${py} = ${m}(${px}) + c$, so $c = ${c}$` }, { h: 'Equation', d: `$y = ${term(m)} ${sgn(c)}$` }]
    };
  }),
  // parallel line through a point: y-intercept
  V([4], rng => {
    const m = nz(rng, -4, 4), c1 = nz(rng, -6, 6), px = nz(rng, -4, 4), c2 = nz(rng, -9, 9);
    rej(c2 === c1);
    const py = m * px + c2;
    return num(`A line is parallel to $y = ${term(m)} ${sgn(c1)}$ and passes through $(${px}, ${py})$. Find the y-intercept of this line.`, c2, {
      traps: [{ value: c1, why: 'Parallel lines share the gradient, not the intercept: the new line passes through a different point.' }],
      hints: ['Parallel lines have the same gradient.', `The new line is $y = ${m}x + c$; use the given point to find $c$.`, 'Substitute the coordinates and solve for $c$.'],
      steps: [{ h: 'Same gradient', d: `$y = ${m}x + c$` }, { h: 'Substitute the point', d: `$${py} = ${m}(${px}) + c$, so $c = ${c2}$` }],
      extra: { dotpoint: 1 }
    });
  })
];


export const forms = {
  'y8-equations': equations,
  'y8-linear': linear
};
