// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · multi-part question sets (NSW Year 11-12), ENGINE ONLY.
//
// An HSC-style set is one stem and parts (a), (b), (c)... each worth 1-4 marks, with later
// parts that say "Hence". Every part here is an ordinary single-answer question of the shape
// the existing generators return, so each part is marked by the same deterministic marker.
// A part that depends on an earlier result RESTATES that result as a given, so a student who
// missed (a) can still earn (b). Every key is computed in code from the numbers the prompt
// shows. Nothing here is issued yet: no ledger, no server route, no generator index entry.
// SYNTHETIC: no student or examiner evidence.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, nz, poly } from '../qhelpers.js';

const rnd = (v, dp) => Math.round(v * 10 ** dp) / 10 ** dp;
/** true when rounding v to dp places does not sit on a half-way boundary. */
const safe = (v, dp) => { const s = Math.abs(v) * 10 ** dp; return Math.abs((s - Math.floor(s)) - 0.5) > 0.03; };
const hyp = Math.hypot;
const sg = k => (k < 0 ? `- ${Math.abs(k)}` : `+ ${k}`);
const A = '\\underset{\\sim}{a}';
const B = '\\underset{\\sim}{b}';
const col = (x, y) => `\\begin{pmatrix} ${x} \\\\ ${y} \\end{pmatrix}`;
const sc = (k, s) => (k === 1 ? s : k === -1 ? `-${s}` : `${k}${s}`);

/** Polynomial key for the expression marker: [6,-6,12] -> "6*x^2-6*x+12". */
function polyKey(cs, v = 'x') {
  const n = cs.length - 1;
  let s = '';
  cs.forEach((c, i) => {
    if (!c) return;
    const p = n - i, a = Math.abs(c);
    const body = p === 0 ? `${a}` : `${a === 1 ? '' : `${a}*`}${v}${p > 1 ? `^${p}` : ''}`;
    s += (s ? (c < 0 ? '-' : '+') : (c < 0 ? '-' : '')) + body;
  });
  return s || '0';
}

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** A hint that states the final answer as a bare number is not a hint. */
function leaks(part) {
  const keys = part.answerType === 'numeric' ? [part.answer.value] : part.answerType === 'set' ? part.answer.values : [];
  return keys.some(v => {
    const body = esc(String(Math.abs(v)));
    const re = new RegExp(`(?<![\\w.^{])-?${body}(?![\\w.}])`);
    return part.hints.some(h => re.test(h));
  });
}

function numPart(label, marks, prompt, value, { tol, prefix, suffix, hints, steps, stepcheck, traps = [] }) {
  const p = { label, marks, prompt, answerType: 'numeric', answer: tol ? { value, tol } : { value }, traps: traps.filter(t => Number.isFinite(t.value) && Math.abs(t.value - value) > 2 * (tol || 1e-9)), hints, steps };
  if (prefix) p.answerPrefix = prefix;
  if (suffix) p.answerSuffix = suffix;
  if (stepcheck) p.stepcheck = stepcheck;
  return p;
}
function exprPart(label, marks, prompt, expr, { prefix, stripC, hints, steps, traps = [] }) {
  const p = { label, marks, prompt, answerType: 'expression', answer: stripC ? { expr, stripC: true } : { expr }, traps, hints, steps };
  if (prefix) p.answerPrefix = prefix;
  return p;
}
function setPart(label, marks, prompt, values, { tol, prefix, hints, steps }) {
  const p = { label, marks, prompt, answerType: 'set', answer: tol ? { values, tol } : { values }, traps: [], hints, steps };
  if (prefix) p.answerPrefix = prefix;
  return p;
}
/** Assemble a set; a draw whose hints leak a key is rejected (null). */
function build(stem, parts) {
  if (parts.some(leaks)) return null;
  return { stem, totalMarks: parts.reduce((s, p) => s + p.marks, 0), parts };
}
const go = f => { for (let i = 0; i < 600; i++) { const q = f(); if (q) return q; } throw new Error('multipart: no valid draw'); };

// ═════════════════════ Advanced Year 12 · stationary points ══════════════════════
function stationary(rng) {
  return go(() => {
    const p = ri(rng, -4, 3), q = p + ri(rng, 1, 5);
    if (!p || !q || p + q === 0) return null;
    const d = ri(rng, -10, 10);
    const c = [2, -3 * (p + q), 6 * p * q, d];
    const f = x => ((2 * x + c[1]) * x + c[2]) * x + d;
    const fp = polyKey([6, -6 * (p + q), 6 * p * q]);
    const fpTex = poly([6, -6 * (p + q), 6 * p * q]);
    const ymax = f(p);
    if (Math.abs(ymax) > 150 || Math.abs(f(q)) > 150) return null;
    const stem = `A curve has equation $y = f(x)$, where $f(x) = ${poly(c)}$.`;
    return build(stem, [
      exprPart('(a)', 2, 'Find $f\'(x)$.', fp, {
        prefix: 'f\'(x) =',
        hints: ['Differentiate each term using the power rule.', 'The constant term differentiates to zero.', 'Write the three terms of the derivative in descending powers of $x$.'],
        steps: [{ h: 'Power rule', d: 'Multiply each coefficient by its power, then reduce the power by one.' }, { h: 'Result', d: `$f'(x) = ${fpTex}$` }]
      }),
      setPart('(b)', 2, `You may use $f'(x) = ${fpTex}$. Hence find the $x$-coordinates of the stationary points of the curve.`, [p, q], {
        prefix: 'x =',
        hints: ['Stationary points occur where the gradient is zero.', 'Divide the equation by the common factor, then factorise.', 'Give both values of $x$, separated by a comma.'],
        steps: [{ h: 'Set the gradient to zero', d: `$${fpTex} = 0$` }, { h: 'Factorise', d: `$6(x ${sg(-p)})(x ${sg(-q)}) = 0$` }, { h: 'Solve', d: `$x = ${p}$ or $x = ${q}$` }]
      }),
      numPart('(c)', 3, `The curve has stationary points at $x = ${p}$ and $x = ${q}$. Find the $y$-coordinate of the local maximum.`, ymax, {
        prefix: 'y =',
        traps: [{ value: f(q), why: 'That is the local minimum: the cubic has a positive leading coefficient, so the smaller $x$-value is the local maximum.' }],
        hints: ['A cubic with a positive leading coefficient has its local maximum at the smaller stationary $x$-value.', 'Check the sign of $f\'(x)$ either side of each stationary point if you are unsure.', 'Substitute that $x$-value into $f(x)$, not into $f\'(x)$.'],
        steps: [{ h: 'Which point', d: `The leading coefficient is positive, so the local maximum is at the smaller value, $x = ${p}$.` }, { h: 'Substitute', d: `$f(${p}) = ${ymax}$` }]
      })
    ]);
  });
}

// ═════════════════════ Advanced Year 12 · motion with an exponential ═════════════════
function motionExp(rng) {
  return go(() => {
    const a = ri(rng, 10, 30), b = ri(rng, 2, 9), k = rc(rng, [0.2, 0.25, 0.4, 0.5]);
    const bk = rnd(b * k, 4), w = rc(rng, [0.25, 0.5, 1, 1.5, 2]);
    if (bk / w < 1.5) return null;
    const t = Math.log(bk / w) / k, tr = rnd(t, 2);
    if (!safe(t, 2) || tr <= 0) return null;
    const vTex = `${bk === 1 ? '' : bk}e^{-${k}t}`;
    const stem = `A particle moves along a straight line. Its displacement $x$ metres from the origin at time $t$ seconds is given by $x = ${a} - ${b}e^{-${k}t}$, for $t \\ge 0$.`;
    return build(stem, [
      exprPart('(a)', 2, 'Find an expression for the velocity $v$ of the particle at time $t$.', `${bk === 1 ? '' : `${bk}*`}exp(-${k}*t)`, {
        prefix: 'v =',
        hints: ['Velocity is the derivative of displacement with respect to time.', 'The derivative of $e^{ct}$ is $ce^{ct}$.', 'The constant term differentiates to zero, and the two negative signs combine.'],
        steps: [{ h: 'Differentiate', d: `$\\dfrac{d}{dt}\\left(${a} - ${b}e^{-${k}t}\\right)$` }, { h: 'Apply the rule', d: `$v = -${b}\\times(-${k})e^{-${k}t} = ${vTex}$` }]
      }),
      numPart('(b)', 1, `You may use $v = ${vTex}$. Find the initial velocity of the particle.`, bk, {
        suffix: 'm/s',
        traps: [{ value: a - b, why: 'That is the initial displacement, not the initial velocity.' }],
        hints: ['Initially means $t = 0$.', 'Substitute $t = 0$ into the given velocity.', 'Any number raised to the power zero is 1.'],
        steps: [{ h: 'Substitute', d: `At $t = 0$, $e^{-${k}\\times 0} = e^0 = 1$.` }, { h: 'Evaluate', d: `$v(0) = ${bk}$ m/s` }]
      }),
      numPart('(c)', 2, `You may use $v = ${vTex}$. Find the time at which the velocity of the particle is $${w}$ m/s, correct to 2 decimal places.`, tr, {
        tol: 0.005, suffix: 's',
        hints: ['Set the velocity equal to the given value.', 'Isolate the exponential, then take natural logarithms of both sides.', 'Divide by the coefficient of $t$ in the exponent.'],
        steps: [{ h: 'Equation', d: `$${vTex} = ${w}$` }, { h: 'Isolate', d: `$e^{-${k}t} = \\dfrac{${w}}{${bk}}$` }, { h: 'Take logarithms', d: `$t = \\dfrac{\\ln(${bk}/${w})}{${k}} \\approx ${tr}$` }]
      }),
      numPart('(d)', 1, 'Find the displacement of the particle as $t \\to \\infty$.', a, {
        suffix: 'm',
        hints: ['Consider what happens to $e^{-ct}$ when $c > 0$ and $t$ becomes very large.', 'The exponential term approaches zero.', 'What is left is the constant term of the displacement.'],
        steps: [{ h: 'Exponential term', d: `As $t \\to \\infty$, $e^{-${k}t} \\to 0$.` }, { h: 'Limit', d: `So $x \\to ${a} - ${b}(0) = ${a}$ m.` }]
      })
    ]);
  });
}

// ═════════════════════ Advanced Year 12 · exponential decay model ═════════════════════
function expModel(rng) {
  return go(() => {
    const m0 = rc(rng, [40, 60, 80, 100, 120, 150, 200]), k = rc(rng, [0.02, 0.03, 0.04, 0.05, 0.06, 0.08]);
    const T = ri(rng, 5, 30), mT = m0 * Math.exp(-k * T), mTr = rnd(mT, 2);
    const half = Math.log(2) / k, halfR = rnd(half, 1);
    const w = ri(rng, 5, Math.floor(m0 / 2) - 1) * 2;
    if (!safe(mT, 2) || !safe(half, 1) || w < 8) return null;
    const rate = rnd(k * w, 4);
    const stem = `The mass $M$ grams of a radioactive substance after $t$ years is modelled by $M = ${m0}e^{-${k}t}$.`;
    return build(stem, [
      numPart('(a)', 2, `Find the mass of the substance after ${T} years, correct to 2 decimal places.`, mTr, {
        tol: 0.005, suffix: 'g',
        traps: [{ value: rnd(m0 * Math.exp(-k) * T, 2), why: 'Substitute $t$ into the exponent: the power is $-kt$, not a product with $t$ outside.' }],
        hints: ['Substitute the given time into the model.', 'Multiply $k$ by $t$ first, keeping the negative sign in the exponent.', 'Use the $e^x$ key on your calculator, then multiply by the initial mass.'],
        steps: [{ h: 'Substitute', d: `$M = ${m0}e^{-${k}\\times ${T}}$` }, { h: 'Evaluate', d: `$M \\approx ${mTr}$ g` }]
      }),
      numPart('(b)', 2, 'The half-life is the time taken for the mass to fall to half of its initial value. Find the half-life, correct to 1 decimal place.', halfR, {
        tol: 0.05, suffix: 'years',
        hints: ['The initial mass is the value at $t = 0$.', 'Solve $e^{-kt} = \\tfrac{1}{2}$.', 'Take natural logarithms and note that $\\ln\\tfrac{1}{2} = -\\ln 2$.'],
        steps: [{ h: 'Set up', d: `$${m0}e^{-${k}t} = ${m0 / 2}$, so $e^{-${k}t} = \\dfrac{1}{2}$` }, { h: 'Logarithms', d: `$-${k}t = -\\ln 2$` }, { h: 'Solve', d: `$t = \\dfrac{\\ln 2}{${k}} \\approx ${halfR}$ years` }]
      }),
      numPart('(c)', 3, `You may use $\\dfrac{dM}{dt} = -${k}M$. Hence find the rate at which the mass is decreasing at the instant when the mass is $${w}$ g.`, rate, {
        suffix: 'g/year',
        traps: [{ value: -rate, why: 'The question asks for the rate of decrease, which is positive.' }],
        hints: ['The given equation expresses the rate of change in terms of the current mass.', 'Substitute the mass at that instant.', 'A decreasing mass has a negative rate of change; the rate of decrease is its size.'],
        steps: [{ h: 'Substitute', d: `$\\dfrac{dM}{dt} = -${k}\\times ${w}$` }, { h: 'Interpret', d: `$\\dfrac{dM}{dt} = -${rate}$, so the mass is decreasing at ${rate} g/year.` }]
      })
    ]);
  });
}

// ═════════════════════ Advanced Year 11 · trigonometric ratios and equations ══════════
function trig(rng) {
  return go(() => {
    const [a0, b0, c] = rc(rng, [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29], [9, 40, 41], [12, 35, 37], [11, 60, 61], [28, 45, 53], [16, 63, 65], [33, 56, 65], [48, 55, 73]]);
    const [a, b] = rng() < 0.5 ? [a0, b0] : [b0, a0];
    const cosv = -b / c, cosR = rnd(cosv, 3);
    const tn = -a / b, tnR = rnd(tn, 3);
    const thetaD = 180 - Math.asin(a / c) * 180 / Math.PI, thR = rnd(thetaD, 1);
    if (!safe(cosv, 3) || !safe(tn, 3) || !safe(thetaD, 1)) return null;
    const stem = `The angle $\\theta$ satisfies $\\sin\\theta = \\dfrac{${a}}{${c}}$ and $90^\\circ < \\theta < 180^\\circ$.`;
    return build(stem, [
      numPart('(a)', 2, 'Find $\\cos\\theta$, correct to 3 decimal places.', cosR, {
        tol: 0.0005,
        traps: [{ value: rnd(b / c, 3), why: 'In the second quadrant cosine is negative.' }],
        hints: ['Use $\\sin^2\\theta + \\cos^2\\theta = 1$.', 'Take the square root, then decide the sign from the quadrant.', 'Cosine is negative for obtuse angles.'],
        steps: [{ h: 'Identity', d: `$\\cos^2\\theta = 1 - \\left(\\dfrac{${a}}{${c}}\\right)^2 = \\dfrac{${b * b}}{${c * c}}$` }, { h: 'Sign', d: `$\\theta$ is obtuse, so $\\cos\\theta = -\\dfrac{${b}}{${c}} \\approx ${cosR}$` }]
      }),
      numPart('(b)', 2, `You may use $\\cos\\theta = -\\dfrac{${b}}{${c}}$. Hence find $\\tan\\theta$, correct to 3 decimal places.`, tnR, {
        tol: 0.0005,
        traps: [{ value: rnd(a / b, 3), why: 'In the second quadrant tangent is negative, because sine is positive and cosine is negative.' }],
        hints: ['Tangent is sine divided by cosine.', 'Substitute the two given ratios and simplify.', 'Take care with the sign: one ratio is positive and the other is negative.'],
        steps: [{ h: 'Ratio identity', d: '$\\tan\\theta = \\dfrac{\\sin\\theta}{\\cos\\theta}$' }, { h: 'Substitute', d: `$\\dfrac{${a}/${c}}{-${b}/${c}} = -\\dfrac{${a}}{${b}} \\approx ${tnR}$` }]
      }),
      numPart('(c)', 2, `Find $\\theta$ in degrees, correct to 1 decimal place.`, thR, {
        tol: 0.05, suffix: '°',
        traps: [{ value: rnd(Math.asin(a / c) * 180 / Math.PI, 1), why: 'That is the acute angle with the same sine. $\\theta$ is obtuse, so subtract it from $180^\\circ$.' }],
        hints: ['Find the acute angle whose sine is the given ratio.', 'Sine is positive in the second quadrant as well.', 'The obtuse angle is $180^\\circ$ minus the acute angle.'],
        steps: [{ h: 'Acute angle', d: `$\\sin^{-1}\\left(\\dfrac{${a}}{${c}}\\right) \\approx ${rnd(Math.asin(a / c) * 180 / Math.PI, 1)}^\\circ$` }, { h: 'Obtuse angle', d: `$\\theta = 180^\\circ - ${rnd(Math.asin(a / c) * 180 / Math.PI, 1)}^\\circ = ${thR}^\\circ$` }]
      })
    ]);
  });
}

// ═════════════════════ Advanced Year 12 · logarithm laws ═════════════════════════════
function logLaws(rng) {
  return go(() => {
    const B = rc(rng, [2, 2, 3]);
    const j = ri(rng, 0, 2), i = ri(rng, j + 1, B === 2 ? 4 : 3);
    const x0 = B ** i, y0 = B ** j, k = x0 - y0, m = i + j, N = B ** m, B2 = B * B;
    const stem = `Consider the equation $\\log_${B} x + \\log_${B} (x - ${k}) = ${m}$, where $x > ${k}$.`;
    return build(stem, [
      numPart('(a)', 1, `Use the logarithm laws to write the equation in the form $x(x - ${k}) = N$. Find $N$.`, N, {
        traps: [{ value: m, why: `Convert the logarithm to index form: $\\log_${B} A = m$ means $A = ${B}^m$.` }],
        hints: ['Combine the two logarithms using $\\log_a A + \\log_a B = \\log_a (AB)$.', 'Then rewrite $\\log_b A = m$ in index form.', 'The base of the logarithm becomes the base of the power.'],
        steps: [{ h: 'Combine', d: `$\\log_${B} \\left[x(x - ${k})\\right] = ${m}$` }, { h: 'Index form', d: `$x(x - ${k}) = ${B}^{${m}} = ${N}$` }]
      }),
      numPart('(b)', 3, `You may use $x^2 - ${k}x = ${N}$. Hence find the value of $x$ that satisfies the original equation.`, x0, {
        prefix: 'x =',
        traps: [{ value: -y0, why: `That root makes $x - ${k}$ negative, and a logarithm of a negative number is undefined, so it is rejected.` }],
        hints: ['Rearrange to a quadratic equal to zero and factorise.', 'Find the two roots.', 'The original equation only holds where both logarithms are defined, so test each root against $x > k$.'],
        steps: [{ h: 'Rearrange', d: `$x^2 - ${k}x - ${N} = 0$` }, { h: 'Factorise', d: `$(x - ${x0})(x + ${y0}) = 0$` }, { h: 'Reject a root', d: `$x = ${x0}$ or $x = -${y0}$; since $x > ${k}$, $x = ${x0}$.` }]
      }),
      numPart('(c)', 2, `Given that $x = ${x0}$, evaluate $\\log_{${B2}} x$.`, i / 2, {
        hints: [`Write $x$ as a power of ${B}, and ${B2} as a power of ${B}.`, 'Use the change of base formula, or ask what power of the base gives $x$.', 'The answer is a multiple of one half.'],
        steps: [{ h: `Powers of ${B}`, d: `$${x0} = ${B}^{${i}}$ and $${B2} = ${B}^2$` }, { h: 'Change of base', d: `$\\log_{${B2}} ${x0} = \\dfrac{\\log_${B} ${x0}}{\\log_${B} ${B2}} = \\dfrac{${i}}{2} = ${i / 2}$` }]
      })
    ]);
  });
}

// ═════════════════════ Advanced Year 12 · area by integration ═════════════════════════
function areaIntegral(rng) {
  return go(() => {
    const a = rc(rng, [6, 12, 18]), p = ri(rng, 2, 6);
    const c2 = (a * p) / 2, c3 = a / 3, area = (a * p ** 3) / 6;
    const intTex = `${c2}x^2 - ${c3}x^3`;
    const stem = `The curve $y = ${a}x(${p} - x)$ meets the $x$-axis at two points.`;
    return build(stem, [
      setPart('(a)', 1, 'Find the $x$-coordinates of the points where the curve meets the $x$-axis.', [0, p], {
        prefix: 'x =',
        hints: ['Set $y$ equal to zero.', 'A product is zero when one of its factors is zero.', 'Solve each factor separately and list the values in increasing order.'],
        steps: [{ h: 'Set y to zero', d: `$${a}x(${p} - x) = 0$` }, { h: 'Solve', d: `$x = 0$ or $x = ${p}$` }]
      }),
      exprPart('(b)', 2, `Find $\\displaystyle\\int ${a}x(${p} - x)\\,dx$. (You may omit the $+C$.)`, `${c2}*x^2-${c3}*x^3`, {
        stripC: true,
        hints: ['Expand the brackets before integrating.', 'Integrate each term: raise the power by one and divide by the new power.', 'Simplify each coefficient.'],
        steps: [{ h: 'Expand', d: `$${a}x(${p} - x) = ${a * p}x - ${a}x^2$` }, { h: 'Integrate', d: `$\\int (${a * p}x - ${a}x^2)\\,dx = ${intTex} + C$` }]
      }),
      numPart('(c)', 3, `You may use $\\displaystyle\\int ${a}x(${p} - x)\\,dx = ${intTex} + C$. Hence find the area enclosed between the curve and the $x$-axis.`, area, {
        suffix: 'square units',
        hints: ['The enclosed region lies between the two $x$-intercepts.', 'Evaluate the antiderivative at the upper limit and subtract its value at the lower limit.', 'The region lies above the $x$-axis, so the definite integral is the area.'],
        steps: [{ h: 'Limits', d: `The area is $\\displaystyle\\int_0^{${p}} ${a}x(${p} - x)\\,dx$.` }, { h: 'Substitute', d: `$\\left[${intTex}\\right]_0^{${p}} = ${c2}(${p})^2 - ${c3}(${p})^3 - 0$` }, { h: 'Evaluate', d: `$${area}$ square units` }]
      })
    ]);
  });
}

// ═════════════════════ Extension 1 · vectors in the plane ══════════════════════════════
function vectors(rng) {
  return go(() => {
    const a = [nz(rng, -6, 6), nz(rng, -6, 6)], b = [nz(rng, -6, 6), nz(rng, -6, 6)], p = nz(rng, -4, 4), q = nz(rng, -4, 4);
    const D = a[0] * b[0] + a[1] * b[1];
    const cross = a[0] * b[1] - a[1] * b[0];
    if (D === 0 || cross === 0) return null;
    const cx = p * a[0] + q * b[0], cy = p * a[1] + q * b[1], m = hyp(cx, cy);
    const ang = Math.acos(D / (hyp(...a) * hyp(...b))) * 180 / Math.PI;
    const bb = b[0] * b[0] + b[1] * b[1], kk = -D / bb;
    if (m < 1 || !safe(m, 2) || !safe(ang, 1) || !safe(kk, 2) || Math.abs(kk) < 0.05) return null;
    const stem = `Let $${A} = ${col(a[0], a[1])}$ and $${B} = ${col(b[0], b[1])}$.`;
    return build(stem, [
      numPart('(a)', 2, `Find $\\left|${sc(p, A)} ${q < 0 ? '-' : '+'} ${Math.abs(q) === 1 ? '' : Math.abs(q)}${B}\\right|$, correct to 2 decimal places.`, rnd(m, 2), {
        tol: 0.0005,
        traps: [{ value: rnd(Math.abs(p) * hyp(...a) + Math.abs(q) * hyp(...b), 2), why: 'The magnitude of a sum is not the sum of the magnitudes: combine the components first.' }],
        hints: ['Find the combined vector component by component.', 'Then use the magnitude formula $\\sqrt{x^2 + y^2}$.', 'Round only at the end.'],
        steps: [{ h: 'Combine', d: `$${col(cx, cy)}$` }, { h: 'Magnitude', d: `$\\sqrt{${cx * cx} + ${cy * cy}} \\approx ${rnd(m, 2)}$` }],
        stepcheck: { kind: 'vector-chain', vectors: { a, b }, target: `|${p}*a+(${q})*b|` }
      }),
      numPart('(b)', 1, `Find $${A}\\cdot${B}$.`, D, {
        traps: [{ value: a[0] * b[1] + a[1] * b[0], why: 'Multiply matching components: $a_1b_1 + a_2b_2$.' }],
        hints: ['The dot product multiplies matching components and adds.', 'The result is a number, not a vector.', 'Bracket any negative components when you substitute.'],
        steps: [{ h: 'Formula', d: `$${A}\\cdot${B} = a_1b_1 + a_2b_2$` }, { h: 'Substitute', d: `$(${a[0]})(${b[0]}) + (${a[1]})(${b[1]}) = ${D}$` }]
      }),
      numPart('(c)', 2, `You may use $${A}\\cdot${B} = ${D}$. Hence find the angle between $${A}$ and $${B}$, correct to 1 decimal place.`, rnd(ang, 1), {
        tol: 0.05, suffix: '°',
        hints: ['Use $\\underset{\\sim}{a}\\cdot\\underset{\\sim}{b} = |\\underset{\\sim}{a}||\\underset{\\sim}{b}|\\cos\\theta$.', 'Find the two magnitudes.', 'Make $\\cos\\theta$ the subject, then use the inverse cosine.'],
        steps: [{ h: 'Magnitudes', d: `$|${A}| = \\sqrt{${a[0] ** 2 + a[1] ** 2}}$, $|${B}| = \\sqrt{${bb}}$` }, { h: 'Cosine', d: `$\\cos\\theta = \\dfrac{${D}}{\\sqrt{${a[0] ** 2 + a[1] ** 2}}\\sqrt{${bb}}}$` }, { h: 'Angle', d: `$\\theta \\approx ${rnd(ang, 1)}^\\circ$` }]
      }),
      numPart('(d)', 2, `You may use $${A}\\cdot${B} = ${D}$. Find the value of $k$ for which $${A} + k${B}$ is perpendicular to $${B}$, correct to 2 decimal places.`, rnd(kk, 2), {
        tol: 0.005, prefix: 'k =',
        hints: ['Perpendicular vectors have dot product zero.', 'Expand $(\\underset{\\sim}{a} + k\\underset{\\sim}{b})\\cdot\\underset{\\sim}{b}$ using the distributive law.', 'Make $k$ the subject.'],
        steps: [{ h: 'Perpendicular', d: `$(${A} + k${B})\\cdot ${B} = 0$` }, { h: 'Expand', d: `$${A}\\cdot${B} + k|${B}|^2 = 0$, so $${D} + ${bb}k = 0$` }, { h: 'Solve', d: `$k = -\\dfrac{${D}}{${bb}} \\approx ${rnd(kk, 2)}$` }]
      })
    ]);
  });
}

// ═════════════════════ Extension 1 · projectile motion ═════════════════════════════════
function projectile(rng) {
  return go(() => {
    const [x5, y5, V] = rc(rng, [[15, 8, 17], [15, 20, 25], [20, 15, 25], [20, 21, 29], [10, 24, 26], [30, 16, 34], [30, 40, 50], [40, 30, 50], [35, 12, 37], [5, 12, 13], [15, 36, 39], [20, 48, 52]]);
    // The first leg is always the multiple of 5, so it is the vertical component and the flight time is a whole number.
    const vert = x5, horiz = y5, U = { ux: horiz, uy: vert };
    const T = vert / 5, range = horiz * T, H = (vert * vert) / 20;
    const stem = `A ball is kicked from level ground. At time $t$ seconds its horizontal and vertical positions, in metres, are $x = ${U.ux}t$ and $y = ${U.uy}t - 5t^2$. Ignore air resistance.`;
    return build(stem, [
      numPart('(a)', 1, 'Find the initial speed of the ball.', V, {
        suffix: 'm/s',
        traps: [{ value: U.ux + U.uy, why: 'Speed is the magnitude of the velocity vector, found with Pythagoras, not by adding the components.' }],
        hints: ['The initial velocity has a horizontal and a vertical component.', 'Differentiate $x$ and $y$ with respect to $t$ and set $t = 0$.', 'The speed is the magnitude of the velocity.'],
        steps: [{ h: 'Components', d: `Initial velocity components: $${U.ux}$ m/s and $${U.uy}$ m/s.` }, { h: 'Magnitude', d: `$\\sqrt{${U.ux}^2 + ${U.uy}^2} = ${V}$ m/s` }]
      }),
      numPart('(b)', 2, 'Find the time of flight, that is, the time when the ball returns to the ground.', T, {
        suffix: 's',
        hints: ['The ball is on the ground when $y = 0$.', 'Factorise out $t$.', 'Reject the root $t = 0$, which is the launch.'],
        steps: [{ h: 'Set y to zero', d: `$${U.uy}t - 5t^2 = 0$` }, { h: 'Factorise', d: `$t(${U.uy} - 5t) = 0$` }, { h: 'Solve', d: `$t = 0$ (launch) or $t = ${T}$` }]
      }),
      numPart('(c)', 2, `You may use that the ball lands when $t = ${T}$. Hence find the horizontal range of the ball.`, range, {
        suffix: 'm',
        hints: ['The range is the horizontal position at the landing time.', 'Substitute the landing time into the equation for $x$.', 'Check that your units are metres.'],
        steps: [{ h: 'Substitute', d: `$x = ${U.ux}\\times ${T}$` }, { h: 'Range', d: `$${range}$ m` }]
      }),
      numPart('(d)', 2, 'Find the maximum height reached by the ball.', H, {
        suffix: 'm',
        traps: [{ value: U.uy, why: 'That is the initial vertical speed, not a height.' }],
        hints: ['The maximum height occurs when the vertical velocity is zero.', 'Differentiate $y$ and set the result to zero to find the time.', 'Substitute that time into $y$.'],
        steps: [{ h: 'Vertical velocity', d: `$\\dfrac{dy}{dt} = ${U.uy} - 10t = 0$, so $t = ${U.uy / 10}$` }, { h: 'Substitute', d: `$y = ${U.uy}(${U.uy / 10}) - 5(${U.uy / 10})^2 = ${H}$ m` }]
      })
    ]);
  });
}

export const MULTIPART_SETS = {
  'mp-adv12-stationary': { title: 'Stationary points of a cubic', course: 'advanced', year: 12, make: stationary },
  'mp-adv12-motion-exp': { title: 'Motion with an exponential displacement', course: 'advanced', year: 12, make: motionExp },
  'mp-adv12-exp-model': { title: 'Exponential decay model', course: 'advanced', year: 12, make: expModel },
  'mp-adv11-trig-identity-equation': { title: 'Trigonometric ratios and equations', course: 'advanced', year: 11, make: trig },
  'mp-adv12-log-laws': { title: 'Logarithm laws and equations', course: 'advanced', year: 12, make: logLaws },
  'mp-adv12-area-integral': { title: 'Area under a curve', course: 'advanced', year: 12, make: areaIntegral },
  'mp-ext1-vectors': { title: 'Vectors in the plane', course: 'extension1', year: 12, make: vectors },
  'mp-ext1-projectile': { title: 'Projectile motion', course: 'extension1', year: 12, make: projectile }
};

/** Deterministic RNG (mulberry32), built from an integer seed. */
function rngFrom(seed) {
  let a = (Number(seed) >>> 0) || 1;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const multipartIds = () => Object.keys(MULTIPART_SETS);

export function multipartSet(id, seed) {
  const def = MULTIPART_SETS[id];
  if (!def) throw new Error(`unknown multipart set: ${id}`);
  const s = def.make(rngFrom(seed));
  return { id, title: def.title, course: def.course, year: def.year, ...s };
}
