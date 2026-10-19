// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · NCERT Class 12 — JEE hardest-level (D4) forms, tranche 2
//
// The JEE tracks serve D2–D4 on the Class 11 and Class 12 chapters, and seven
// Class 12 dot points had no authored form at D4, so the picker could not offer
// the track's hardest level for them (docs/release/evidence/
// india-difficulty-coverage.md, issue #408). Each generator below authors
// exactly one rung — the D4 form for one dot point — and the coverage table
// (curriculum-in-hardest-covers.js) claims it at D4 and nowhere else.
//
// What makes these D4 is the idea each one needs: the inverse of a composite
// taken in the reverse order; an angle given in radians far outside the
// principal branch and reduced back into it (alone, or two at once); a
// double-angle or compound-angle identity applied to inverse ratios with exact
// rational results; counting the kinks of a sum of moduli on an open interval,
// or fixing two constants from two standard limits; a differential
// approximation from a stated base point, or a rate passed through two
// relations; the parameter boundary at which a cubic stops being monotonic, or
// the intercepts of a normal and a tangent; the internal bisector as a sum of
// unit vectors, and a component recovered from two direction cosines.
//
// Scope is the NCERT Class 12 book as JEE examines it — nothing from beyond the
// syllabus; every limit is a standard limit, no L'Hôpital's rule is needed.
//
// Provenance. These are original, parameterised forms written for Pri
// Learning. They are not transcribed from a textbook exercise or a past paper.
// Every keyed answer is computed from the drawn parameters, never typed, and
// client/test/india-hardest-forms-check.mjs (with the solvers in
// india-hardest-solvers-jee-c12.mjs) re-derives each one from the rendered
// prompt by a second, numeric route and probes the near misses. None of this is
// a human maths review, and nothing here claims board or examiner approval.
//
// Asked for any rung other than D4, each generator returns its D4 form. No
// coverage entry claims these generators anywhere but D4.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, nz, gcd, makeRng } from '../qhelpers.js';
import { exact as exactForm, frac, fracTex, traps } from './india-native-helpers.js';

/**
 * An exact answer that also accepts its exact decimal. The marker demands a
 * fraction only when the wording asks for one; these prompts never do, and
 * saying so on the key keeps a \dfrac in the GIVEN data from ever being read as
 * a demand. The keyed simplest fraction is unchanged and accepted.
 */
function exact(f, suffix) {
  const out = exactForm(f, suffix);
  if (out.answer.simplestFraction) out.answer = { ...out.answer, requireFraction: false };
  return out;
}

// ── Exact rationals ──────────────────────────────────────────────────────────
const R = (n, d = 1) => frac(n, d);
const add = (x, y) => R(x.n * y.d + y.n * x.d, x.d * y.d);
const sub = (x, y) => R(x.n * y.d - y.n * x.d, x.d * y.d);
const mul = (x, y) => R(x.n * y.n, x.d * y.d);
const div = (x, y) => R(x.n * y.d, x.d * y.n);
const rTex = x => fracTex(x.n, x.d);

const sg = k => (k >= 0 ? `+ ${k}` : `- ${Math.abs(k)}`);
const cx = (c, v = 'x') => (c === 1 ? v : c === -1 ? `-${v}` : `${c}${v}`);
const linTex = (a, b, v = 'x') => (b === 0 ? cx(a, v) : `${cx(a, v)} ${sg(b)}`);
const shift = k => (k === 0 ? 'x' : `x ${sg(k)}`);

function polyTex(coeffs, v = 'x') {
  const n = coeffs.length - 1;
  let out = '';
  coeffs.forEach((c, i) => {
    if (c === 0) return;
    const p = n - i;
    const body = p === 0 ? String(Math.abs(c)) : `${Math.abs(c) === 1 ? '' : Math.abs(c)}${v}${p === 1 ? '' : `^${p}`}`;
    if (!out) out = `${c < 0 ? '-' : ''}${body}`;
    else out += ` ${c < 0 ? '-' : '+'} ${body}`;
  });
  return out || '0';
}

const FALLBACK_SEED = 0x7c12d4e1;

// ── 1 · Relations and Functions — the inverse of a composite ────────────────
function compositeInverseReasoning(rng) {
  if (rng() < 0.5) {
    for (let guard = 0; guard < 400; guard++) {
      const a = nz(rng, -5, 5), b = nz(rng, -9, 9), c = nz(rng, -9, 9), t = nz(rng, -5, 5);
      if (Math.abs(a) === 1) continue;
      const V = a * (t ** 3 + c) + b;
      const wrongOrder = (Math.cbrt(V - c) - b) / a;
      return {
        prompt: `Let $f : \\mathbb{R} \\to \\mathbb{R}$ and $g : \\mathbb{R} \\to \\mathbb{R}$ be the bijections $f(x) = ${linTex(a, b)}$ and $g(x) = x^3 ${sg(c)}$. Find the value of $(f \\circ g)^{-1}(${V})$.`,
        answerType: 'numeric', answer: { value: t },
        traps: traps(t, [
          { value: wrongOrder, why: 'That applies $f^{-1}$ after $g^{-1}$. The inverse of a composite reverses the order: $(f \\circ g)^{-1} = g^{-1} \\circ f^{-1}$.' },
          { value: (V - b) / a, why: 'That is only $f^{-1}$ of the value; $g^{-1}$ still has to be applied to it.' },
          { value: a * (V ** 3 + c) + b, why: 'That is $(f \\circ g)$ of the value, not its inverse.' }
        ]),
        hints: [
          'The inverse of a composite reverses the order: $(f \\circ g)^{-1} = g^{-1} \\circ f^{-1}$.',
          'Equivalently, find the $x$ for which $f(g(x))$ equals the given value.',
          'Undo $f$ first (solve the linear equation), then undo $g$ (take a cube root).'
        ],
        steps: [
          { h: 'Reverse the order', d: '$(f \\circ g)^{-1}(y) = g^{-1}\\left(f^{-1}(y)\\right)$' },
          { h: 'Undo f', d: `$f^{-1}(${V}) = \\dfrac{${V} ${sg(-b)}}{${a}} = ${t ** 3 + c}$` },
          { h: 'Undo g', d: `$x^3 ${sg(c)} = ${t ** 3 + c} \\Rightarrow x^3 = ${t ** 3} \\Rightarrow x = ${t}$` },
          { h: 'Answer', d: `$${t}$` }
        ],
        reasoning: 'inverse-of-composite'
      };
    }
  }
  for (let guard = 0; guard < 400; guard++) {
    const p = nz(rng, -6, 6), q = nz(rng, -9, 9), r = ri(rng, 1, 4), s = nz(rng, -9, 9);
    const m = nz(rng, -4, 4), n = nz(rng, -9, 9), t = nz(rng, -6, 6);
    if (p * s - q * r === 0 || r * t + s === 0 || gcd(gcd(Math.abs(p), Math.abs(q)), gcd(r, Math.abs(s))) !== 1) continue;
    if (Math.abs(m) === 1 && rng() < 0.5) continue;
    const ft = R(p * t + q, r * t + s);
    const V = add(mul(R(m), ft), R(n));
    if (V.d > 40 || Math.abs(V.n) > 400) continue;
    const finv = y => (s * y - q) / (p - r * y);
    const Vv = V.value;
    const list = [{ value: (finv(Vv) - n) / m, why: 'That undoes $f$ before $g$. For $(g \\circ f)^{-1} = f^{-1} \\circ g^{-1}$, undo $g$ first.' }];
    if (p - r * Vv !== 0) list.push({ value: finv(Vv), why: 'That applies $f^{-1}$ to the value directly and forgets to undo $g$ first.' });
    list.push({ value: m * ((p * Vv + q) / (r * Vv + s)) + n, why: 'That is $(g \\circ f)$ of the value, not its inverse.' });
    return {
      prompt: `Let $f(x) = \\dfrac{${linTex(p, q)}}{${linTex(r, s)}}$ for $x \\ne ${fracTex(-s, r)}$, a one-one function onto $\\mathbb{R} - \\left\\{${fracTex(p, r)}\\right\\}$, and let $g(x) = ${linTex(m, n)}$. Find the value of $(g \\circ f)^{-1}\\left(${rTex(V)}\\right)$.`,
      answerType: 'numeric', answer: { value: t },
      traps: traps(t, list),
      hints: [
        'The inverse of a composite reverses the order: $(g \\circ f)^{-1} = f^{-1} \\circ g^{-1}$.',
        'Undo the linear map $g$ first, then solve $f(x)$ equal to what you get.',
        'To undo $f$, cross-multiply and collect the terms in $x$.'
      ],
      steps: [
        { h: 'Reverse the order', d: '$(g \\circ f)^{-1}(y) = f^{-1}\\left(g^{-1}(y)\\right)$' },
        { h: 'Undo g', d: `$g^{-1}\\left(${rTex(V)}\\right) = ${rTex(ft)}$` },
        { h: 'Undo f', d: `$\\dfrac{${linTex(p, q)}}{${linTex(r, s)}} = ${rTex(ft)} \\Rightarrow x = ${t}$` },
        { h: 'Answer', d: `$${t}$` }
      ],
      reasoning: 'inverse-of-composite'
    };
  }
  return compositeInverseReasoning(makeRng(FALLBACK_SEED));
}

// ── 2 · Inverse trigonometric functions — reducing a radian angle ───────────
const mod = (a, m) => ((a % m) + m) % m;
const BRANCH_TEX = {
  sin: '\\left[-\\dfrac{\\pi}{2}, \\dfrac{\\pi}{2}\\right]',
  cos: '\\left[0, \\pi\\right]',
  tan: '\\left(-\\dfrac{\\pi}{2}, \\dfrac{\\pi}{2}\\right)'
};
/** In the branch? n/d is the angle as a multiple of π. */
const inBranch = (fn, n, d) => (fn === 'sin' ? 2 * Math.abs(n) <= d : fn === 'cos' ? n >= 0 && n <= d : 2 * Math.abs(n) < d);
/** The numerator over d of the principal value, as a multiple of π. */
function principalNum(fn, n, d) {
  if (fn === 'sin') {
    const t = mod(n + d, 2 * d) - d;
    return 2 * t > d ? d - t : 2 * t < -d ? -d - t : t;
  }
  if (fn === 'cos') {
    const t = mod(n, 2 * d);
    return t > d ? 2 * d - t : t;
  }
  const t = mod(n, d);
  return 2 * t > d ? t - d : t;
}
const angTex = (n, d) => `${n < 0 ? '-' : ''}\\dfrac{${Math.abs(n) === 1 ? '' : Math.abs(n)}\\pi}{${d}}`;
const termTex = (fn, n, d) => `\\${fn}^{-1}\\left(\\${fn} ${n < 0 ? `\\left(${angTex(n, d)}\\right)` : angTex(n, d)}\\right)`;

function drawAngle(rng, fn) {
  for (let guard = 0; guard < 200; guard++) {
    const d = rc(rng, [3, 4, 5, 6, 7, 8, 9, 10, 12]);
    const n = nz(rng, -5 * d, 5 * d);
    if (gcd(Math.abs(n), d) !== 1 || inBranch(fn, n, d)) continue;
    return { n, d, v: principalNum(fn, n, d) };
  }
  return null;
}

function inverseTrigBranchReasoning(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const two = rng() < 0.5;
    const fns = two ? rc(rng, [['sin', 'cos'], ['sin', 'tan'], ['cos', 'tan'], ['tan', 'cos'], ['cos', 'sin'], ['tan', 'sin']]) : [rc(rng, ['sin', 'cos', 'tan'])];
    const angles = fns.map(fn => drawAngle(rng, fn));
    if (angles.some(x => !x)) continue;
    const k = angles.reduce((s, a) => add(s, R(a.v, a.d)), R(0));
    const naive = angles.reduce((s, a) => add(s, R(a.n, a.d)), R(0));
    if (k.n === naive.n && k.d === naive.d) continue;
    const expr = fns.map((fn, i) => termTex(fn, angles[i].n, angles[i].d)).join(' + ');
    const list = [{ value: naive.value, why: '$\\theta$ comes straight back only when it already lies in the principal branch, and this angle does not.' }];
    if (two) {
      const a0 = angles[0];
      list.push({ value: add(R(a0.n, a0.d), R(angles[1].v, angles[1].d)).value, why: 'Both angles lie outside their branches; the first one has to be reduced too.' });
    }
    list.push({ value: k.value + 1, why: 'Reducing by a whole turn is not enough — the result must land inside the branch.' });
    return {
      prompt: `The value of $${expr}$ can be written as $k\\pi$. Find $k$.`,
      answerType: 'numeric', ...exact(k),
      traps: traps(k.value, list),
      hints: [
        ...fns.filter((fn, i) => fns.indexOf(fn) === i).map(fn => `The principal value branch of $\\${fn}^{-1}$ is $${BRANCH_TEX[fn]}$.`),
        'Use the period of the ratio to bring the angle near the branch, then an allied-angle relation to move it inside.',
        'Check the angle you choose gives the same ratio, sign included, before you add.'
      ],
      steps: [
        ...fns.map((fn, i) => ({ h: `Reduce the ${fn} term`, d: `$\\${fn} ${angles[i].n < 0 ? `\\left(${angTex(angles[i].n, angles[i].d)}\\right)` : angTex(angles[i].n, angles[i].d)} = \\${fn}\\left(${fracTex(angles[i].v, angles[i].d)}\\pi\\right)$, inside $${BRANCH_TEX[fn]}$` })),
        { h: 'Add', d: `$k = ${rTex(k)}$` },
        { h: 'Answer', d: `$k = ${rTex(k)}$` }
      ],
      reasoning: 'reduce-radian-into-branch'
    };
  }
  return inverseTrigBranchReasoning(makeRng(FALLBACK_SEED));
}

// ── 3 · Inverse trigonometric functions — exact evaluation ──────────────────
const TRIPLES = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29]];
const argTex = x => (x.n < 0 ? `-${fracTex(-x.n, x.d)}` : rTex(x));

function inverseTrigEvaluateReasoning(rng) {
  if (rng() < 0.5) {
    for (let guard = 0; guard < 400; guard++) {
      const qa = ri(rng, 1, 5), pa = nz(rng, -6, 6);
      if (gcd(Math.abs(pa), qa) !== 1 || Math.abs(pa) === qa) continue;
      const a = R(pa, qa);
      const b = rng() < 0.5 ? R(nz(rng, -5, 5)) : R(nz(rng, -5, 5), ri(rng, 2, 5));
      if (b.d > 1 && gcd(Math.abs(b.n), b.d) !== 1) continue;
      const minus = rng() < 0.5;
      const T = R(2 * pa * qa, qa * qa - pa * pa);
      const bb = minus ? b : R(-b.n, b.d);
      const den = add(R(1), mul(T, bb));
      if (den.n === 0) continue;
      const v = div(sub(T, bb), den);
      if (v.d > 200 || Math.abs(v.n) > 2000 || v.n === 0) continue;
      const twoA = mul(R(2), a);
      const dn2 = add(R(1), mul(twoA, bb));
      const list = [];
      if (dn2.n !== 0) list.push({ value: div(sub(twoA, bb), dn2).value, why: '$\\tan\\left(2\\tan^{-1} a\\right)$ is $\\dfrac{2a}{1 - a^2}$, not $2a$.' });
      list.push({ value: T.value, why: `That is only $\\tan\\left(2\\tan^{-1} a\\right)$; the second inverse ratio still has to be ${minus ? 'subtracted' : 'added'}.` });
      const dn3 = sub(R(1), mul(T, bb));
      if (dn3.n !== 0) list.push({ value: div(add(T, bb), dn3).value, why: 'The signs in $\\tan(A - B) = \\dfrac{\\tan A - \\tan B}{1 + \\tan A \\tan B}$ are swapped.' });
      return {
        prompt: `Find the exact value of $\\tan\\left(2\\tan^{-1}\\left(${argTex(a)}\\right) ${minus ? '-' : '+'} \\tan^{-1}\\left(${argTex(b)}\\right)\\right)$.`,
        answerType: 'numeric', ...exact(v),
        traps: traps(v.value, list),
        hints: [
          'Let $A$ and $B$ be the two inverse tangents, so $\\tan A$ and $\\tan B$ are known.',
          'Use $\\tan 2A = \\dfrac{2\\tan A}{1 - \\tan^2 A}$.',
          'Then use the compound-angle formula for the tangent of a sum or difference.'
        ],
        steps: [
          { h: 'Double angle', d: `$\\tan 2A = \\dfrac{2 \\cdot ${argTex(a)}}{1 - \\left(${argTex(a)}\\right)^2} = ${rTex(T)}$` },
          { h: 'Compound angle', d: `$\\tan(2A ${minus ? '-' : '+'} B) = \\dfrac{${rTex(T)} ${minus ? '-' : '+'} \\left(${argTex(b)}\\right)}{1 ${minus ? '+' : '-'} ${rTex(T)} \\cdot \\left(${argTex(b)}\\right)}$` },
          { h: 'Answer', d: `$${rTex(v)}$` }
        ],
        reasoning: 'double-angle-inverse'
      };
    }
  }
  for (let guard = 0; guard < 400; guard++) {
    const t1 = rc(rng, TRIPLES), t2 = rc(rng, TRIPLES);
    const swap1 = rng() < 0.5, swap2 = rng() < 0.5;
    const [c1, s1] = swap1 ? [t1[1], t1[0]] : [t1[0], t1[1]];
    const sgn1 = rng() < 0.5 ? -1 : 1;
    const [o2, a2] = swap2 ? [t2[1], t2[0]] : [t2[0], t2[1]];
    const sgn2 = rng() < 0.5 ? -1 : 1;
    const h1 = t1[2], h2 = t2[2];
    const cosA = R(sgn1 * c1, h1), sinA = R(s1, h1);
    const tanB = R(sgn2 * o2, a2), sinB = R(sgn2 * o2, h2), cosB = R(a2, h2);
    const ratio = rc(rng, ['sin', 'cos']), plus = rng() < 0.5;
    const pm = plus ? 1 : -1;
    const v = ratio === 'sin'
      ? add(mul(sinA, cosB), mul(R(pm), mul(cosA, sinB)))
      : sub(mul(cosA, cosB), mul(R(pm), mul(sinA, sinB)));
    if (v.n === 0) continue;
    const wrong = ratio === 'sin'
      ? add(mul(R(-1), mul(sinA, cosB)), mul(R(pm), mul(cosA, sinB)))
      : add(mul(cosA, cosB), mul(R(pm), mul(sinA, sinB)));
    const naive = ratio === 'sin' ? add(mul(cosA, cosB), mul(R(pm), mul(sinA, sinB))) : sub(mul(sinA, cosB), mul(R(pm), mul(cosA, sinB)));
    return {
      prompt: `Find the exact value of $\\${ratio}\\left(\\cos^{-1}\\left(${argTex(cosA)}\\right) ${plus ? '+' : '-'} \\tan^{-1}\\left(${argTex(tanB)}\\right)\\right)$.`,
      answerType: 'numeric', ...exact(v),
      traps: traps(v.value, [
        { value: wrong.value, why: '$\\cos^{-1}$ takes values in $[0, \\pi]$, so the sine of that angle is never negative; check each sign against the branch.' },
        { value: naive.value, why: `The sine and cosine have been interchanged in the compound-angle formula for $\\${ratio}$.` }
      ]),
      hints: [
        'Let $A = \\cos^{-1}(\\cdot)$ and $B = \\tan^{-1}(\\cdot)$; draw a right triangle for each to find the other ratios.',
        'Signs come from the branches: $A$ lies in $[0, \\pi]$, so $\\sin A \\ge 0$; $B$ lies in $\\left(-\\dfrac{\\pi}{2}, \\dfrac{\\pi}{2}\\right)$, so $\\cos B > 0$.',
        `Then expand with the compound-angle formula for $\\${ratio}$.`
      ],
      steps: [
        { h: 'Ratios of A', d: `$\\cos A = ${rTex(cosA)},\\ \\sin A = ${rTex(sinA)}$` },
        { h: 'Ratios of B', d: `$\\sin B = ${rTex(sinB)},\\ \\cos B = ${rTex(cosB)}$` },
        { h: 'Expand', d: ratio === 'sin' ? `$\\sin A\\cos B ${plus ? '+' : '-'} \\cos A\\sin B$` : `$\\cos A\\cos B ${plus ? '-' : '+'} \\sin A\\sin B$` },
        { h: 'Answer', d: `$${rTex(v)}$` }
      ],
      reasoning: 'compound-angle-inverse'
    };
  }
  return inverseTrigEvaluateReasoning(makeRng(FALLBACK_SEED));
}

// ── 4 · Continuity and differentiability ────────────────────────────────────
function continuityTestReasoning(rng) {
  if (rng() < 0.5) {
    for (let guard = 0; guard < 400; guard++) {
      const al = ri(rng, -6, 6), be = ri(rng, -6, 6), ga = ri(rng, -6, 6), c = ri(rng, 1, 4);
      const L = ri(rng, -7, 3), Rr = L + ri(rng, 3, 9);
      if (al >= be) continue;
      const pts = [...new Set([al, be, ga])];
      const inside = pts.filter(x => x > L && x < Rr);
      const answer = inside.length;
      const closed = pts.filter(x => x >= L && x <= Rr).length;
      if (closed === answer && pts.length === answer && rng() < 0.7) continue;
      const inner = polyTex([1, -(al + be), al * be]);
      return {
        prompt: `Let $f(x) = \\left|${inner}\\right| + ${c === 1 ? '' : c}\\left|${shift(-ga)}\\right|$. How many points of the open interval $(${L}, ${Rr})$ are there at which $f$ is not differentiable?`,
        answerType: 'numeric', answer: { value: answer },
        traps: traps(answer, [
          { value: pts.length, why: 'Only the points INSIDE the open interval count.' },
          { value: closed, why: 'The interval is open, so its end points are not in it.' },
          { value: [al, be, ga].filter(x => x > L && x < Rr).length, why: 'A point where two of the moduli switch at once is still a single point.' }
        ]),
        hints: [
          'A modulus $|g(x)|$ can only fail to be differentiable where $g$ vanishes and changes sign.',
          'Factorise the quadratic inside the first modulus to find where it vanishes.',
          'Check whether the corners at a shared point could cancel — here both moduli add, so they cannot — and keep only points inside the open interval.'
        ],
        steps: [
          { h: 'Zeros of the quadratic', d: `$${inner} = (${shift(-al)})(${shift(-be)})$, zero at $x = ${al}$ and $x = ${be}$, with a sign change at each` },
          { h: 'Zero of the linear term', d: `$x = ${ga}$` },
          { h: 'Inside the interval', d: inside.length ? `$${inside.join(',\\ ')}$` : 'none of them' },
          { h: 'Answer', d: `$${answer}$` }
        ],
        reasoning: 'count-corners'
      };
    }
  }
  for (let guard = 0; guard < 400; guard++) {
    const p = ri(rng, 2, 6), q = nz(rng, -6, 6);
    const askSum = rng() < 0.5;
    const a = R(p * p, 2), b = sub(a, R(q));
    const v = askSum ? add(a, b) : b;
    const qTex = q < 0 ? `(${cx(q)})` : cx(q);
    return {
      prompt: `The function $f$ defined by $f(x) = \\dfrac{1 - \\cos ${p}x}{x^2}$ for $x < 0$, $f(0) = a$, and $f(x) = \\dfrac{\\tan ${qTex}}{x} + b$ for $x > 0$ is continuous at $x = 0$. Find the value of ${askSum ? '$a + b$' : '$b$'}.`,
      answerType: 'numeric', ...exact(v),
      traps: traps(v.value, [
        { value: askSum ? p * p / 2 - q : p * p / 4 - q, why: '$1 - \\cos \\theta = 2\\sin^2\\dfrac{\\theta}{2}$, so the left-hand limit is $\\dfrac{p^2}{2}$, not $\\dfrac{p^2}{4}$.' },
        { value: askSum ? p * p + q : p * p / 2 + q, why: 'From $q + b = a$, the constant $b$ is $a$ MINUS the limit of the tangent term.' },
        { value: askSum ? p - q : p / 2 - q, why: 'The left-hand limit grows like the square of the coefficient of $x$.' }
      ]),
      hints: [
        'Continuity at $0$ means the left-hand limit, $f(0)$ and the right-hand limit are all equal.',
        'Write $1 - \\cos \\theta = 2\\sin^2\\dfrac{\\theta}{2}$ and use the standard limit of $\\dfrac{\\sin t}{t}$ as $t \\to 0$.',
        'For the right-hand side use the standard limit of $\\dfrac{\\tan t}{t}$ as $t \\to 0$.'
      ],
      steps: [
        { h: 'Left-hand limit', d: `$\\lim_{x \\to 0^-} \\dfrac{2\\sin^2(${fracTex(p, 2)}x)}{x^2} = ${rTex(a)}$, so $a = ${rTex(a)}$` },
        { h: 'Right-hand limit', d: `$\\lim_{x \\to 0^+} \\dfrac{\\tan ${qTex}}{x} = ${q}$, so $${q} + b = ${rTex(a)}$ and $b = ${rTex(b)}$` },
        { h: 'Answer', d: `$${rTex(v)}$` }
      ],
      reasoning: 'two-standard-limits'
    };
  }
  return continuityTestReasoning(makeRng(FALLBACK_SEED));
}

// ── 5 · Applications of derivatives — approximations and rates ──────────────
const dec2 = x => String(Number(x.toFixed(2)));

function rateApproximationReasoning(rng) {
  if (rng() < 0.55) {
    for (let guard = 0; guard < 400; guard++) {
      const cube = rng() < 0.4;
      const a = cube ? ri(rng, 2, 6) : ri(rng, 3, 15);
      const base = cube ? a ** 3 : a * a;
      const k = nz(rng, -60, 60);
      const N = dec2((base * 100 + k) / 100);
      if (Math.abs(Number(N) - base) * 100 - Math.abs(k) > 1e-6) continue;
      const v = cube ? R(300 * a * a * a + k, 300 * a * a) : R(200 * a * a + k, 200 * a);
      const root = cube ? `\\sqrt[3]{${N}}` : `\\sqrt{${N}}`;
      const deriv = cube ? `\\dfrac{1}{3x^{2/3}}` : `\\dfrac{1}{2\\sqrt{x}}`;
      return {
        prompt: `Using differentials, with $y = ${cube ? '\\sqrt[3]{x}' : '\\sqrt{x}'}$, $x = ${base}$ and $\\Delta x = ${dec2(k / 100)}$, find the approximate value of $${root}$ that $y + \\Delta y \\approx y + \\dfrac{dy}{dx}\\Delta x$ gives.`,
        answerType: 'numeric', ...exact(v),
        traps: traps(v.value, [
          { value: a + k / (100 * a * (cube ? a : 1)), why: `$\\dfrac{dy}{dx}$ carries the factor $\\dfrac{1}{${cube ? 3 : 2}}$ from the power rule.` },
          { value: a - (cube ? k / (300 * a * a) : k / (200 * a)), why: 'The sign of $\\Delta x$ has been lost.' },
          { value: Number((cube ? Math.cbrt(Number(N)) : Math.sqrt(Number(N))).toFixed(4)), why: 'That is a calculator value of the root, not the value the differential approximation gives.' }
        ]),
        hints: [
          'Evaluate $y$ at the given $x$ exactly.',
          `Differentiate: $\\dfrac{dy}{dx} = ${deriv}$, and evaluate it at the same $x$.`,
          'Multiply the derivative by $\\Delta x$ and add it to $y$.'
        ],
        steps: [
          { h: 'Value at the base', d: `$y = ${a}$` },
          { h: 'Derivative', d: `$\\dfrac{dy}{dx} = ${cube ? fracTex(1, 3 * a * a) : fracTex(1, 2 * a)}$` },
          { h: 'Change', d: `$\\Delta y \\approx ${cube ? fracTex(1, 3 * a * a) : fracTex(1, 2 * a)} \\times ${dec2(k / 100)} = ${rTex(sub(v, R(a)))}$` },
          { h: 'Answer', d: `$${rTex(v)}$` }
        ],
        reasoning: 'differential-approximation'
      };
    }
  }
  for (let guard = 0; guard < 400; guard++) {
    const Vp = 10 * ri(rng, 1, 12), r = ri(rng, 2, 15);
    const v = R(2 * Vp, r);
    if (v.d === 1 && rng() < 0.5) continue;
    return {
      prompt: `Air is pumped into a spherical balloon so that its volume increases at $${Vp}$ cm³/s. How fast, in cm²/s, is its surface area increasing at the instant its radius is $${r}$ cm?`,
      answerType: 'numeric', ...exact(v),
      traps: traps(v.value, [
        { value: Vp / r, why: '$\\dfrac{dS}{dt} = 8\\pi r \\dfrac{dr}{dt}$ and $\\dfrac{dV}{dt} = 4\\pi r^2 \\dfrac{dr}{dt}$, so the ratio has a factor $2$.' },
        { value: (2 * Vp) / (r * r), why: 'Only one power of $r$ cancels between the two rates.' },
        { value: Vp / (4 * r * r), why: 'That is $\\dfrac{dr}{dt}$ times $\\pi$; the question asks for the rate of the surface area.' }
      ]),
      hints: [
        'Write $V = \\tfrac{4}{3}\\pi r^3$ and $S = 4\\pi r^2$, both as functions of time through $r$.',
        'Differentiate each with respect to $t$ by the chain rule.',
        'Eliminate $\\dfrac{dr}{dt}$ between the two rates.'
      ],
      steps: [
        { h: 'Volume rate', d: `$${Vp} = 4\\pi (${r})^2 \\dfrac{dr}{dt}$, so $\\dfrac{dr}{dt} = ${fracTex(Vp, 4 * r * r)}\\cdot\\dfrac{1}{\\pi}$` },
        { h: 'Area rate', d: `$\\dfrac{dS}{dt} = 8\\pi (${r}) \\dfrac{dr}{dt} = \\dfrac{2}{r}\\dfrac{dV}{dt}$` },
        { h: 'Answer', d: `$${rTex(v)}$` }
      ],
      reasoning: 'chained-rates'
    };
  }
  return rateApproximationReasoning(makeRng(FALLBACK_SEED));
}

// ── 6 · Monotonicity, tangents and normals ──────────────────────────────────
function monotonicTangentReasoning(rng) {
  if (rng() < 0.5) {
    for (let guard = 0; guard < 400; guard++) {
      const c = ri(rng, 1, 4), a = nz(rng, -9, 9), b = ri(rng, -9, 9);
      const dec = rng() < 0.4;
      const lead = dec ? -c : c;
      const K = R(dec ? -(a * a) : a * a, 3 * c);
      if (K.d === 1 && rng() < 0.6) continue;
      const fTex = `${polyTex([lead, a, 0, 0])} + kx${b === 0 ? '' : ` ${sg(b)}`}`;
      return {
        prompt: `Find the ${dec ? 'greatest' : 'least'} value of $k$ for which $f(x) = ${fTex}$ is ${dec ? 'decreasing' : 'increasing'} on $\\mathbb{R}$.`,
        answerType: 'numeric', ...exact(K),
        traps: traps(K.value, [
          { value: (dec ? -1 : 1) * a * a / c, why: 'The discriminant of $3cx^2 + 2ax + k$ is $4a^2 - 12ck$; the factor $3$ stays.' },
          { value: (dec ? -1 : 1) * a * a / (9 * c), why: 'The middle coefficient of $f\'(x)$ is $2a$, not $\\dfrac{2a}{3}$.' },
          { value: (dec ? 1 : -1) * a * a / (3 * c), why: 'The sign of the boundary comes from the leading coefficient.' }
        ]),
        hints: [
          `$f$ is ${dec ? 'decreasing' : 'increasing'} on $\\mathbb{R}$ when $f'(x)$ keeps one sign for every $x$ (it may touch zero at an isolated point).`,
          '$f\'(x)$ is a quadratic; it keeps one sign exactly when its discriminant is not positive.',
          'Solve the discriminant inequality for $k$ and read off the boundary.'
        ],
        steps: [
          { h: 'Derivative', d: `$f'(x) = ${polyTex([3 * lead, 2 * a, 0])} + k$` },
          { h: 'Discriminant', d: `$${4 * a * a} ${dec ? '+' : '-'} ${12 * c}k \\le 0$` },
          { h: 'Boundary', d: `$k ${dec ? '\\le' : '\\ge'} ${rTex(K)}$` },
          { h: 'Answer', d: `$${rTex(K)}$` }
        ],
        reasoning: 'monotone-discriminant'
      };
    }
  }
  for (let guard = 0; guard < 400; guard++) {
    const b = ri(rng, -8, 8), c = ri(rng, -9, 9), x0 = nz(rng, -5, 5);
    const m = 2 * x0 + b, y0 = x0 * x0 + b * x0 + c;
    if (m === 0) continue;
    const normal = rng() < 0.6;
    const v = normal ? add(R(y0), R(x0, m)) : sub(R(x0), R(y0, m));
    if (v.n === 0 && rng() < 0.7) continue;
    const curve = polyTex([1, b, c]);
    return {
      prompt: normal
        ? `Find the $y$-intercept of the normal to the curve $y = ${curve}$ at the point where $x = ${x0}$.`
        : `Find the $x$-intercept of the tangent to the curve $y = ${curve}$ at the point where $x = ${x0}$.`,
      answerType: 'numeric', ...exact(v),
      traps: traps(v.value, normal ? [
        { value: y0 - x0 * m, why: 'That is the $y$-intercept of the TANGENT. The normal has slope $-\\dfrac{1}{m}$.' },
        { value: y0 - x0 / m, why: 'The normal has slope $-\\dfrac{1}{m}$; the intercept is $y_0 + \\dfrac{x_0}{m}$.' },
        { value: y0, why: 'That is the $y$-coordinate of the point itself.' }
      ] : [
        { value: x0 + y0 / m, why: 'Setting $y = 0$ in $y - y_0 = m(x - x_0)$ gives $x = x_0 - \\dfrac{y_0}{m}$.' },
        { value: y0 - x0 * m, why: 'That is the $y$-intercept of the tangent.' },
        { value: x0 + y0 * m, why: 'That is the $x$-intercept of the normal, which has slope $-\\dfrac{1}{m}$.' }
      ]),
      hints: [
        'Find the point of contact and the slope $\\dfrac{dy}{dx}$ there.',
        normal ? 'The normal is perpendicular to the tangent, so its slope is the negative reciprocal.' : 'Write the tangent as $y - y_0 = m(x - x_0)$.',
        normal ? 'Write the normal\'s equation and find where it meets the $y$-axis.' : 'Find where that line meets the $x$-axis.'
      ],
      steps: [
        { h: 'Point', d: `$(${x0}, ${y0})$` },
        { h: 'Slope', d: `$\\dfrac{dy}{dx} = ${linTex(2, b)} = ${m}$ at $x = ${x0}$` },
        { h: normal ? 'Normal' : 'Tangent', d: normal ? `$y - ${y0 < 0 ? `(${y0})` : y0} = ${fracTex(-1, m)}(x - ${x0 < 0 ? `(${x0})` : x0})$; at $x = 0$` : `$y - ${y0 < 0 ? `(${y0})` : y0} = ${m}(x - ${x0 < 0 ? `(${x0})` : x0})$; at $y = 0$` },
        { h: 'Answer', d: `$${rTex(v)}$` }
      ],
      reasoning: normal ? 'normal-intercept' : 'tangent-intercept'
    };
  }
  return monotonicTangentReasoning(makeRng(FALLBACK_SEED));
}

// ── 7 · Vectors — bisectors and direction cosines ───────────────────────────
const QUADS = [[1, 2, 2, 3], [2, 3, 6, 7], [1, 4, 8, 9], [4, 4, 7, 9], [2, 6, 9, 11], [6, 6, 7, 11], [3, 4, 12, 13], [2, 10, 11, 15], [2, 5, 14, 15], [1, 12, 12, 17], [8, 9, 12, 17], [4, 8, 19, 21]];
const UNIT = ['\\hat{i}', '\\hat{j}', '\\hat{k}'];
function vecTex(v) {
  const parts = [];
  v.forEach((x, i) => {
    if (x === 0) return;
    const sign = parts.length === 0 ? (x < 0 ? '-' : '') : (x < 0 ? ' - ' : ' + ');
    parts.push(`${sign}${Math.abs(x) === 1 ? '' : Math.abs(x)}${UNIT[i]}`);
  });
  return parts.length ? parts.join('') : '\\vec{0}';
}
function direction(rng) {
  const [x, y, z, L] = rc(rng, QUADS);
  const order = rc(rng, [[x, y, z], [x, z, y], [y, x, z], [y, z, x], [z, x, y], [z, y, x]]);
  return { d: order.map(v => (rng() < 0.5 ? -v : v)), L };
}

function vectorDirectionReasoning(rng) {
  if (rng() < 0.55) {
    for (let guard = 0; guard < 400; guard++) {
      const A = direction(rng), B = direction(rng);
      const a = A.d, b = B.d;
      const cross = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
      if (cross.every(x => x === 0)) continue;
      const dot = a.reduce((s, x, i) => s + x * b[i], 0);
      const askMag = rng() < 0.4;
      const comp = ri(rng, 0, 2);
      const v = askMag ? add(R(2), R(2 * dot, A.L * B.L)) : add(R(a[comp], A.L), R(b[comp], B.L));
      if (!askMag && v.n === 0) continue;
      const list = askMag
        ? [{ value: add(R(1), R(dot, A.L * B.L)).value, why: '$|\\hat{a} + \\hat{b}|^2 = 1 + 1 + 2\\,\\hat{a}\\cdot\\hat{b}$ — both the squares and the factor $2$ count.' },
           { value: 2 + 2 * dot, why: 'The dot product of the UNIT vectors is $\\dfrac{\\vec{a}\\cdot\\vec{b}}{|\\vec{a}||\\vec{b}|}$.' },
           { value: 2 - (2 * dot) / (A.L * B.L), why: 'That is $|\\hat{a} - \\hat{b}|^2$, along the other bisector direction.' }]
        : [{ value: a[comp] + b[comp], why: 'That adds $\\vec{a}$ and $\\vec{b}$ themselves; the bisector needs the unit vectors.' },
           { value: R(a[comp], A.L).value - R(b[comp], B.L).value, why: '$\\hat{a} - \\hat{b}$ lies along the external bisector.' },
           { value: (a[comp] + b[comp]) / (A.L + B.L), why: 'Each vector is divided by its OWN magnitude before adding.' }];
      return {
        prompt: `Let $\\vec{a} = ${vecTex(a)}$ and $\\vec{b} = ${vecTex(b)}$, and let $\\vec{c} = \\hat{a} + \\hat{b}$, which lies along the internal bisector of the angle between $\\vec{a}$ and $\\vec{b}$. ${askMag ? 'Find $|\\vec{c}|^2$.' : `Find the $${UNIT[comp]}$ component of $\\vec{c}$.`}`,
        answerType: 'numeric', ...exact(v),
        traps: traps(v.value, list),
        hints: [
          'Find $|\\vec{a}|$ and $|\\vec{b}|$; each unit vector is the vector divided by its magnitude.',
          askMag ? 'Expand $|\\hat{a} + \\hat{b}|^2 = (\\hat{a} + \\hat{b})\\cdot(\\hat{a} + \\hat{b})$.' : 'Add the unit vectors component by component.',
          askMag ? 'Use $\\hat{a}\\cdot\\hat{b} = \\dfrac{\\vec{a}\\cdot\\vec{b}}{|\\vec{a}||\\vec{b}|}$.' : 'Keep the sign of each component.'
        ],
        steps: [
          { h: 'Magnitudes', d: `$|\\vec{a}| = ${A.L},\\ |\\vec{b}| = ${B.L}$` },
          askMag ? { h: 'Dot product', d: `$\\vec{a}\\cdot\\vec{b} = ${dot}$, so $\\hat{a}\\cdot\\hat{b} = ${fracTex(dot, A.L * B.L)}$` }
            : { h: 'Unit vectors', d: `$\\hat{a} = \\dfrac{1}{${A.L}}\\left(${vecTex(a)}\\right),\\ \\hat{b} = \\dfrac{1}{${B.L}}\\left(${vecTex(b)}\\right)$` },
          askMag ? { h: 'Expand', d: `$|\\vec{c}|^2 = 2 + 2\\left(${fracTex(dot, A.L * B.L)}\\right)$` } : { h: 'Add', d: `$${fracTex(a[comp], A.L)} + \\left(${fracTex(b[comp], B.L)}\\right)$` },
          { h: 'Answer', d: `$${rTex(v)}$` }
        ],
        reasoning: 'unit-vector-bisector'
      };
    }
  }
  for (let guard = 0; guard < 400; guard++) {
    const [x, y, z, w] = rc(rng, QUADS);
    const order = rc(rng, [[x, y, z], [x, z, y], [y, x, z], [y, z, x], [z, x, y], [z, y, x]]);
    const l = R(rng() < 0.5 ? -order[0] : order[0], w), m = R(rng() < 0.5 ? -order[1] : order[1], w);
    const t = ri(rng, 1, 4), M = t * w;
    const v = t * order[2];
    return {
      prompt: `A vector $\\vec{r}$ has magnitude $${M}$. The cosines of the angles it makes with the $x$-axis and the $y$-axis are $${rTex(l)}$ and $${rTex(m)}$, and it makes an acute angle with the $z$-axis. Find the $\\hat{k}$ component of $\\vec{r}$.`,
      answerType: 'numeric', answer: { value: v },
      traps: traps(v, [
        { value: order[2], why: 'That is the $\\hat{k}$ component of a vector of magnitude equal to the denominator; scale to the given magnitude.' },
        { value: M * (1 - Math.abs(l.value) - Math.abs(m.value)), why: 'Direction cosines satisfy $l^2 + m^2 + n^2 = 1$ — squares, not the cosines themselves.' },
        { value: M * (1 - l.value * l.value - m.value * m.value), why: 'That is $|\\vec{r}|\\,n^2$; take the square root to get $n$ first.' }
      ]),
      hints: [
        'The squares of the direction cosines $l, m, n$ add up to one.',
        'The angle with the $z$-axis is acute, which fixes the sign of $n$.',
        'Each component of $\\vec{r}$ is its magnitude times the matching direction cosine.'
      ],
      steps: [
        { h: 'Third direction cosine', d: `$n^2 = 1 - \\left(${rTex(l)}\\right)^2 - \\left(${rTex(m)}\\right)^2 = ${fracTex(order[2] * order[2], w * w)}$` },
        { h: 'Sign', d: `acute angle, so $n = ${fracTex(order[2], w)}$` },
        { h: 'Component', d: `$${M} \\times ${fracTex(order[2], w)} = ${v}$` },
        { h: 'Answer', d: `$${v}$` }
      ],
      reasoning: 'direction-cosine-constraint'
    };
  }
  return vectorDirectionReasoning(makeRng(FALLBACK_SEED));
}

/** One rung, D4: every other rung returns the same form (see the header). */
const d4 = form => (rng, _diff) => form(rng);

export const class12JeeHardestForms = Object.freeze({
  'c12-composite-inverse-reasoning': d4(compositeInverseReasoning),
  'c12-inverse-trig-branch-reasoning': d4(inverseTrigBranchReasoning),
  'c12-inverse-trig-evaluate-reasoning': d4(inverseTrigEvaluateReasoning),
  'c12-continuity-test-reasoning': d4(continuityTestReasoning),
  'c12-rate-approximation-reasoning': d4(rateApproximationReasoning),
  'c12-monotonic-tangent-reasoning': d4(monotonicTangentReasoning),
  'c12-vector-direction-reasoning': d4(vectorDirectionReasoning)
});
