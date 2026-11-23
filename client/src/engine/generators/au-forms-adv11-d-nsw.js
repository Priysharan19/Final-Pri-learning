// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Prithagoras variety overlay · Advanced Year 11 (slot adv11-d)
//   y11-transform       graph transformations (order, equations, domain and range, a graph to read)
//   y11-functions-more  inverse and composite functions
//   y11-data-sets       mean, median and standard deviation (choice of measure, tables, transformations)
// Each form asks the student to make a different DECISION. Every key is computed in code from the
// numbers the prompt shows; the AI never sets a key. Original wording. SYNTHETIC: no student or
// examiner evidence. Difficulty is the writer's own assessment, not reviewed by a teacher.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, nz, rs, br, gcd, mcq } from '../qhelpers.js';
import { figPolyline } from '../figures.js';

// Builders: every key is computed in code from the numbers the prompt shows. A form's `audit` (kind + raw
// parameters) is attached as a NON-ENUMERABLE property, so it is never spread into a served question;
// client/test/adv-variety-forms-check.mjs reads it to recompute each answer by a different route.
const REJ = Symbol('reject');

const rej = cond => { if (cond) throw REJ; };

/** One variant: re-draw from the same rng (so still deterministic) until the numbers are acceptable. */
const V = (diffs, fn) => ({
  diffs,
  make: (rng, diff) => {
    for (let i = 0; i < 400; i++) {
      try { return fn(rng, diff); } catch (e) { if (e !== REJ) throw e; }
    }
    throw new Error('advanced variety form: no acceptable draw');
  }
});

const fin = v => typeof v === 'number' && Number.isFinite(v);

// One tidy pass over everything a student reads: a doubled sign from a negative term, and stray spaces.
const tidy = s => (typeof s === 'string'
  ? s.replace(/ [+-] 0[a-z](?:\^\{?\d+\}?)?(?![\w])/g, '').replace(/\+ -/g, '- ').replace(/- -/g, '+ ')
    .replace(/(?<![\d.^_{(,\w\\])1(?=[a-zA-Z]|\\(?:sin|cos|tan|theta|log|sqrt))/g, '').replace(/(?<=\S) {2,}(?=\S)/g, ' ')
  : s);
function attach(q, audit) {
  q.prompt = tidy(q.prompt);
  if (Array.isArray(q.hints)) q.hints = q.hints.map(tidy);
  if (Array.isArray(q.steps)) q.steps = q.steps.map(s => ({ h: tidy(s.h), d: tidy(s.d) }));
  if (Array.isArray(q.mcqOptions)) q.mcqOptions = q.mcqOptions.map(tidy);
  if (audit) Object.defineProperty(q, '__audit', { value: audit, enumerable: false });
  return q;
}

const cleanTraps = (traps, value, band) => {
  const keep = [value], out = [];
  for (const [v, why] of traps || []) {
    if (!fin(v) || keep.some(k => Math.abs(k - v) <= band + 1e-9)) continue;
    keep.push(v);
    out.push({ value: v, why, ...(band > 0 ? { tol: band } : {}) });
  }
  return out;
};

const steps4 = a => (a || []).map(([h, d]) => ({ h, d }));

/** numeric key. o: { hints[4], steps[[h,d]], traps[[value, why]], tol, suffix, prefix, frac:{n,d}, audit } */
function N(prompt, value, o) {
  rej(!fin(value));
  const answer = { value };
  if (o.tol != null) answer.tol = o.tol;
  if (o.frac && o.frac.d !== 1) answer.simplestFraction = { n: o.frac.n, d: o.frac.d };
  const q = { prompt, answerType: 'numeric', answer, traps: cleanTraps(o.traps, value, o.tol || 0), hints: o.hints, steps: steps4(o.steps) };
  if (o.suffix) q.answerSuffix = o.suffix;
  if (o.prefix) q.answerPrefix = o.prefix;
  if (o.dotpoint != null) q.dotpoint = o.dotpoint;
  if (o.figure) q.figure = o.figure;
  return attach(q, o.audit);
}

/** an exact rational n/d (reduced here). */
function Fr(prompt, n, d, o) {
  const g = gcd(n, d) || 1;
  const nn = n / g, dd = d / g;
  const sg = dd < 0 ? -1 : 1;
  return N(prompt, n / d, { ...o, frac: { n: sg * nn, d: sg * dd } });
}

/** a set of values (any order). */
function S(prompt, values, o) {
  const traps = (o.traps || []).filter(([v]) => fin(v) && !values.some(x => Math.abs(x - v) < 1e-9)).map(([v, why]) => ({ value: v, why }));
  const q = { prompt, answerType: 'set', answer: { values }, traps, hints: o.hints, steps: steps4(o.steps) };
  if (o.suffix) q.answerSuffix = o.suffix;
  if (o.dotpoint != null) q.dotpoint = o.dotpoint;
  if (o.figure) q.figure = o.figure;
  return attach(q, o.audit);
}

function P(prompt, x, y, o) {
  const q = { prompt, answerType: 'point', answer: { x, y }, inputHint: 'e.g. (3, -4)', traps: (o.traps || []).map(([why]) => ({ why })), hints: o.hints, steps: steps4(o.steps) };
  if (o.dotpoint != null) q.dotpoint = o.dotpoint;
  if (o.figure) q.figure = o.figure;
  return attach(q, o.audit);
}

/** an expression key; traps are [expr, why]. */
function E(prompt, expr, o) {
  const answer = { expr };
  if (o.stripC) answer.stripC = true;
  const q = { prompt, answerType: 'expression', answer, traps: (o.traps || []).filter(([e]) => e !== expr).map(([e, why]) => ({ expr: e, why })), hints: o.hints, steps: steps4(o.steps) };
  if (o.dotpoint != null) q.dotpoint = o.dotpoint;
  if (o.figure) q.figure = o.figure;
  return attach(q, o.audit);
}

/** multiple choice: correct text and distractors [{text, why}]. */
function M(rng, prompt, correct, ds, o) {
  const m = mcq(rng, correct, ds);
  const q = { prompt, answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options, hints: o.hints, steps: steps4(o.steps) };
  if (o.dotpoint != null) q.dotpoint = o.dotpoint;
  if (o.figure) q.figure = o.figure;
  return attach(q, o.audit);
}

/** Signed term for a constant: sg(3) = "+ 3", sg(-3) = "- 3". */
const sg = c => (c >= 0 ? `+ ${c}` : `- ${Math.abs(c)}`);

/** LaTeX for a reduced fraction. */
const fr = (n, d) => {
  const g = gcd(n, d) || 1;
  let a = n / g, b = d / g;
  if (b < 0) { a = -a; b = -b; }
  return b === 1 ? String(a) : `${a < 0 ? '-' : ''}\\dfrac{${Math.abs(a)}}{${b}}`;
};

const un = n => (n === 1 ? '1 unit' : `${n} units`);
const sgn1 = c => (c < 0 ? '-' : '+');
/** coefficients, highest power first, as TeX: [2,-3,1] -> 2x^2 - 3x + 1 */
const polyTex = cs => {
  const n = cs.length - 1;
  let out = '';
  cs.forEach((c, i) => {
    if (!c) return;
    const p = n - i, a = Math.abs(c);
    const body = p === 0 ? `${a}` : `${a === 1 ? '' : a}x${p === 1 ? '' : `^{${p}}`}`;
    out += out ? ` ${sgn1(c)} ${body}` : `${c < 0 ? '-' : ''}${body}`;
  });
  return out || '0';
};
/** the same polynomial as plain text for an expression key */
const polyPlain = cs => {
  const n = cs.length - 1;
  let out = '';
  cs.forEach((c, i) => {
    if (!c) return;
    const p = n - i, a = Math.abs(c);
    const body = p === 0 ? `${a}` : `${a === 1 ? '' : `${a}*`}x${p === 1 ? '' : `^${p}`}`;
    out += out ? `${sgn1(c)}${body}` : `${c < 0 ? '-' : ''}${body}`;
  });
  return out || '0';
};
const evalPoly = (cs, x) => cs.reduce((s, c) => s * x + c, 0);
const tbl = (head, vals, freq) => `\\begin{array}{c|${'c'.repeat(vals.length)}} \\text{${head}} & ${vals.join(' & ')} \\\\ \\hline \\text{Frequency} & ${freq.join(' & ')} \\end{array}`;
const fmtList = xs => xs.join(', ');
const shuffle = (rng, xs) => rs(rng, xs);

// ── y11-transform ────────────────────────────────────────────────────────────
const transform = [
  // R1 · D2 · the value of the reflected function (which reflection changes what)
  V([2], rng => {
    const a = ri(rng, 1, 3), b = nz(rng, -6, 6), c = nz(rng, -8, 8), k = nz(rng, -4, 4);
    const axis = rc(rng, ['x', 'y']);
    const cs = [a, b, c];
    const val = axis === 'x' ? -evalPoly(cs, k) : evalPoly(cs, -k);
    const wrong = axis === 'x' ? evalPoly(cs, -k) : -evalPoly(cs, k);
    return N(`The graph of $y = f(x)$, where $f(x) = ${polyTex(cs)}$, is reflected in the $${axis}$-axis. The image is the graph of $y = g(x)$. Find $g(${k})$.`, val, {
      traps: [[wrong, axis === 'x' ? 'A reflection in the $x$-axis negates the $y$-value: $g(x) = -f(x)$. It does not change the input.' : 'A reflection in the $y$-axis replaces $x$ by $-x$: $g(x) = f(-x)$. It does not negate the output.'], [evalPoly(cs, k), 'This is $f(' + k + ')$. The image is a different function.']],
      hints: [axis === 'x' ? 'A reflection in the $x$-axis turns every $y$-value into its negative.' : 'A reflection in the $y$-axis swaps $x$ and $-x$.', `So $g(x) = ${axis === 'x' ? '-f(x)' : 'f(-x)'}$.`, `Substitute $x = ${k}$ into the correct rule.`, 'Take care with negative numbers inside brackets.'],
      steps: [['Rule for the image', `$g(x) = ${axis === 'x' ? '-f(x)' : 'f(-x)'}$`], ['Substitute', `$g(${k}) = ${axis === 'x' ? `-f(${k})` : `f(${-k})`} = ${val}$`]],
      audit: { kind: 'reflectval', cs, axis, k, expect: val }
    });
  }),

  // R2 · D2 · write the equation of the reflected graph
  V([2], rng => {
    const deg = rc(rng, [2, 3]);
    const cs = Array.from({ length: deg + 1 }, (_, i) => (i === 0 ? ri(rng, 1, 3) : nz(rng, -5, 5)));
    rej(cs[1] === 0);
    const axis = rc(rng, ['x', 'y']);
    const img = axis === 'x' ? cs.map(c => -c) : cs.map((c, i) => c * ((deg - i) % 2 === 0 ? 1 : -1));
    const other = axis === 'x' ? cs.map((c, i) => c * ((deg - i) % 2 === 0 ? 1 : -1)) : cs.map(c => -c);
    return E(`The graph of $y = ${polyTex(cs)}$ is reflected in the $${axis}$-axis. Write the equation of the image in the form $y = \\ldots$ (enter the right-hand side).`, polyPlain(img), {
      traps: [[polyPlain(other), `That is the reflection in the other axis. A reflection in the $${axis}$-axis ${axis === 'x' ? 'negates the whole expression' : 'replaces $x$ by $-x$'}.`]],
      hints: [axis === 'x' ? 'A reflection in the $x$-axis changes $y$ to $-y$.' : 'A reflection in the $y$-axis changes $x$ to $-x$.', axis === 'x' ? 'Negate every term.' : 'Replace every $x$ with $(-x)$.', axis === 'x' ? 'Every sign flips.' : 'Odd powers of $x$ change sign; even powers do not.', 'Write the result in descending powers.'],
      steps: [['Replacement rule', axis === 'x' ? '$y \\to -y$' : '$x \\to -x$'], ['Image', `$y = ${polyTex(img)}$`]],
      audit: { kind: 'reflectexpr', cs, axis, img }
    });
  }),

  // R3 · D2 · which single transformation maps one rule onto the other?
  V([2], rng => {
    const p = nz(rng, -6, 6), q = nz(rng, -8, 8), t = ri(rng, 2, 6);
    const f = [1, p, q];
    const kinds = [
      { g: [-1, -p, -q], ans: 'a reflection in the $x$-axis' },
      { g: [1, -p, q], ans: 'a reflection in the $y$-axis' },
      { g: [1, p, q + t], ans: `a translation of ${t} units up` },
      { g: [-1, p, -q], ans: 'a reflection in both axes (a half-turn about the origin)' }
    ];
    const key = rc(rng, kinds);
    const ds = kinds.filter(k => k !== key).map(k => ({ text: k.ans, why: 'Compare the two rules term by term: this transformation would give a different rule.' }));
    return M(rng, `The graph of $y = ${polyTex(f)}$ is transformed onto the graph of $y = ${polyTex(key.g)}$. Which single description fits?`, key.ans, ds, {
      hints: ['Compare the two rules term by term.', 'A reflection in the $x$-axis negates every term; a reflection in the $y$-axis changes only the sign of the $x$ term.', 'A reflection in both axes changes the sign of the $x^2$ term and the constant but not the $x$ term.', 'A translation up changes only the constant.'],
      steps: [['Compare', `Original: $${polyTex(f)}$; image: $${polyTex(key.g)}$`], ['Decide', key.ans]],
      audit: { kind: 'reflectmc', f, g: key.g, key: key.ans, kinds: kinds.map(k => ({ g: k.g, ans: k.ans })) }
    });
  }),

  // R4 · D2 · where does the vertex go?
  V([2], rng => {
    const a = rc(rng, [1, 2, 3, -1, -2]), h = nz(rng, -6, 6), k = nz(rng, -8, 8);
    const axis = rc(rng, ['x', 'y']);
    const lead = a === 1 ? '' : a === -1 ? '-' : String(a);
    return P(`The parabola $y = ${lead}(x ${sg(-h)})^2 ${sg(k)}$ has its vertex at $(${h}, ${k})$. The parabola is reflected in the $${axis}$-axis. Find the vertex of the image.`, axis === 'x' ? h : -h, axis === 'x' ? -k : k, {
      traps: [[axis === 'x' ? 'A reflection in the $x$-axis changes only the sign of the $y$-coordinate.' : 'A reflection in the $y$-axis changes only the sign of the $x$-coordinate.']],
      hints: ['The vertex is a point on the graph, so it is reflected like any point.', axis === 'x' ? 'A reflection in the $x$-axis keeps $x$ and negates $y$.' : 'A reflection in the $y$-axis negates $x$ and keeps $y$.', 'You do not need the equation of the image.', 'Apply the rule to $(' + h + ', ' + k + ')$.'],
      steps: [['Reflect the vertex', axis === 'x' ? `$(${h}, ${k}) \\to (${h}, ${-k})$` : `$(${h}, ${k}) \\to (${-h}, ${k})$`]],
      audit: { kind: 'vertexreflect', h, k, axis, expect: axis === 'x' ? [h, -k] : [-h, k] }
    });
  }),

  // R5 · D2 · what a reflection does to the x-intercepts
  V([2], rng => {
    const p = nz(rng, -7, 7), q = nz(rng, -7, 7);
    rej(p === q);
    const axis = rc(rng, ['x', 'y']);
    const val = axis === 'x' ? p + q : -(p + q);
    rej(val === 0);
    return N(`The graph of $y = (x ${sg(-p)})(x ${sg(-q)})$ is reflected in the $${axis}$-axis. Find the sum of the $x$-intercepts of the image.`, val, {
      traps: [[-val, axis === 'x' ? 'Points on the $x$-axis do not move when reflected in the $x$-axis, so the intercepts are unchanged.' : 'A reflection in the $y$-axis negates each $x$-intercept.'], [p * q, 'That is the product of the intercepts, not their sum.']],
      hints: ['Find the $x$-intercepts of the original graph.', axis === 'x' ? 'A point on the $x$-axis is its own reflection in the $x$-axis.' : 'A reflection in the $y$-axis changes the sign of every $x$-coordinate.', 'List the intercepts of the image.', 'Add them.'],
      steps: [['Original intercepts', `$x = ${p}$ and $x = ${q}$`], ['Image intercepts', axis === 'x' ? `Unchanged: $${p}$ and $${q}$` : `$${-p}$ and $${-q}$`], ['Sum', `$${val}$`]],
      audit: { kind: 'interceptsum', p, q, axis, expect: val }
    });
  }),

  // Q1 · D3 · a vertical dilation of a power function equals a horizontal one
  V([3], rng => {
    const n = rc(rng, [2, 3]), c = ri(rng, 2, 5), k = c ** n;
    return Fr(`The graph of $y = x^{${n}}$ is dilated vertically by a factor of $${k}$. The same image can be produced by a horizontal dilation of $y = x^{${n}}$. What is the horizontal dilation factor?`, 1, c, {
      traps: [[c, 'A horizontal dilation by factor $c$ replaces $x$ by $\\dfrac{x}{c}$, so a factor greater than 1 would make the new graph flatter, not steeper.'], [k, 'That is the vertical factor. A horizontal factor $c$ gives a vertical equivalent of $c^{' + n + '}$ in the reverse direction.']],
      hints: [`The image has equation $y = ${k}x^{${n}}$.`, `Write $${k}$ as a power with index $${n}$: $${k} = ${c}^{${n}}$.`, `So $y = (${c}x)^{${n}}$, which is $x$ replaced by $${c}x$.`, 'Replacing $x$ by $x \\div c$ is a horizontal dilation by factor $c$. What is $c$ here?'],
      steps: [['Image', `$y = ${k}x^{${n}} = (${c}x)^{${n}}$`], ['Horizontal factor', `$x \\to ${c}x$ is a horizontal dilation by $\\dfrac{1}{${c}}$`]],
      audit: { kind: 'dilationequiv', n, c, k, expect: 1 / c }
    });
  }),

  // Q2a · D3 · image of a point under y = a f(bx) + k
  V([3], rng => {
    const b = rc(rng, [2, 3, 4]), u = nz(rng, -5, 5), y = nz(rng, -6, 6), a = rc(rng, [-3, -2, 2, 3]), k = nz(rng, -5, 5);
    return P(`The point $(${b * u}, ${y})$ lies on the graph of $y = f(x)$. Find the image of this point on the graph of $y = ${a === -1 ? '-' : a}f(${b}x) ${sg(k)}$.`, u, a * y + k, {
      traps: [['Replacing $x$ by $' + b + 'x$ compresses horizontally: divide the $x$-coordinate by ' + b + '. The factor ' + a + ' and the shift apply to $y$ only.']],
      hints: ['Look at what is done to $x$ (inside the bracket) and to $y$ (outside) separately.', `Inside: $x \\to ${b}x$ means the old $x$-coordinate is divided by $${b}$.`, `Outside: multiply $y$ by $${a}$, then add $${k}$.`, 'Combine into one point.'],
      steps: [['Horizontal', `$x = ${b * u} \\div ${b} = ${u}$`], ['Vertical', `$y = ${a}(${y}) ${sg(k)} = ${a * y + k}$`]],
      audit: { kind: 'imagepoint', pt: [b * u, y], a, b, h: 0, k, expect: [u, a * y + k] }
    });
  }),

  // Q2b · D3, D4 · work backwards: which point of y = f(x) produced this image point?
  V([3, 4], (rng, d) => {
    const a = rc(rng, [-3, -2, 2, 3, 4]), k = nz(rng, -6, 6), h = nz(rng, -5, 5), x = nz(rng, -4, 4), y = nz(rng, -5, 5);
    if (d === 3) {
      return P(`The point $(${x + h}, ${a * y + k})$ lies on the graph of $y = ${a}f(x ${sg(-h)}) ${sg(k)}$. Find the corresponding point on the graph of $y = f(x)$.`, x, y, {
        traps: [['Undo each step in reverse: first remove the vertical shift, then divide by the dilation factor; and undo the horizontal shift by subtracting.']],
        hints: ['Work backwards from the image to the original.', `Horizontal: $x ${sg(-h)}$ was added to the input, so subtract $${h}$ from the $x$-coordinate... check the sign carefully.`, `Vertical: subtract $${k}$, then divide by $${a}$.`, 'Check by applying the transformation to your point.'],
        steps: [['Undo the horizontal shift', `$x = ${x + h} ${sg(-h)} = ${x}$`], ['Undo the vertical shift and dilation', `$y = \\dfrac{${a * y + k} ${sg(-k)}}{${a}} = ${y}$`]],
        audit: { kind: 'imageback', img: [x + h, a * y + k], a, b: 1, h, k, expect: [x, y] }
      });
    }
    const b = rc(rng, [2, 3, -2]), u = nz(rng, -4, 4);
    return P(`The point $(${u + h}, ${a * y + k})$ lies on the graph of $y = ${a}f\\big(${b}(x ${sg(-h)})\\big) ${sg(k)}$. Find the corresponding point on the graph of $y = f(x)$.`, b * u, y, {
      traps: [['Undo the transformations in reverse order. The expression inside $f$ is $' + b + '(x ' + sg(-h) + ')$, which equals the original $x$-coordinate.']],
      hints: ['The original $x$-coordinate is the value fed into $f$.', `That value is $${b}(x ${sg(-h)})$ evaluated at the image $x$-coordinate.`, `Vertically: subtract $${k}$ and divide by $${a}$.`, 'State the original point.'],
      steps: [['Input of f', `$${b}(${u + h} ${sg(-h)}) = ${b * u}$`], ['Output of f', `$y = \\dfrac{${a * y + k} ${sg(-k)}}{${a}} = ${y}$`]],
      audit: { kind: 'imageback', img: [u + h, a * y + k], a, b, h, k, expect: [b * u, y] }
    });
  }),

  // Q2c · D4 · forward image under y = a f(b(x - h)) + k, with a negative factor allowed
  V([4], rng => {
    const a = rc(rng, [-3, -2, -1, 2, 3]), b = rc(rng, [2, 3, 4, -2, -1]), h = nz(rng, -5, 5), k = nz(rng, -6, 6), u = nz(rng, -3, 3), y = nz(rng, -5, 5);
    const x = b * u;
    return P(`The point $(${x}, ${y})$ lies on the graph of $y = f(x)$. Find the image of this point on the graph of $y = ${a === -1 ? '-' : a}f\\big(${b === -1 ? '-' : b}(x ${sg(-h)})\\big) ${sg(k)}$.`, u + h, a * y + k, {
      traps: [[`The input of $f$ is $${b}(x ${sg(-h)})$, so set it equal to ${x} and solve for $x$: divide by ${b}, then add ${h}.`]],
      hints: ['Set the input of $f$ equal to the original $x$-coordinate.', `$${b}(x ${sg(-h)}) = ${x}$, so $x ${sg(-h)} = ${u}$.`, `The output: $y = ${a}(${y}) ${sg(k)}$.`, 'Combine.'],
      steps: [['New x', `$${b}(x ${sg(-h)}) = ${x} \\Rightarrow x = ${u} + ${h} = ${u + h}$`], ['New y', `$${a}(${y}) ${sg(k)} = ${a * y + k}$`]],
      audit: { kind: 'imagepoint', pt: [x, y], a, b, h, k, expect: [u + h, a * y + k] }
    });
  }),

  // Q3 · D3 · the equation of the image of a power function after a sequence
  V([3], rng => {
    const n = rc(rng, [2, 3]), h = nz(rng, -5, 5), k = nz(rng, -6, 6), a = ri(rng, 2, 4);
    const br = ri(rng, 0, 2);
    const xn = n === 2 ? 'x^2' : 'x^3';
    if (br === 0) {
      return E(`The graph of $y = ${xn}$ is translated ${un(Math.abs(h))} ${h > 0 ? 'right' : 'left'} and then stretched vertically by a factor of $${a}$. Write the equation of the image in the form $y = \\ldots$.`, `${a}*(x${h < 0 ? '+' : '-'}${Math.abs(h)})^${n}`, {
        traps: [[`(x${h < 0 ? '+' : '-'}${Math.abs(h)})^${n}`, 'The vertical stretch multiplies the whole expression.'], [`${a}*(x${h < 0 ? '-' : '+'}${Math.abs(h)})^${n}`, `Moving ${h > 0 ? 'right' : 'left'} replaces $x$ by $x ${sg(-h)}$.`]],
        hints: ['Apply the transformations in the order given.', `A shift of $${h}$ to the right replaces $x$ by $(x - ${h})$.`, 'A vertical stretch multiplies the whole right-hand side.', 'Write the final equation.'],
        steps: [['Translate', `$y = (x ${sg(-h)})^{${n}}$`], ['Stretch', `$y = ${a}(x ${sg(-h)})^{${n}}$`]],
        audit: { kind: 'imageexpr', base: n, ops: [['tx', h], ['sy', a]], key: `${a}*(x${h < 0 ? '+' : '-'}${Math.abs(h)})^${n}` }
      });
    }
    if (br === 1) {
      return E(`The graph of $y = ${xn}$ is stretched vertically by a factor of $${a}$ and then translated ${un(Math.abs(k))} ${k > 0 ? 'up' : 'down'}. Write the equation of the image in the form $y = \\ldots$.`, `${a}*x^${n}${k < 0 ? '-' : '+'}${Math.abs(k)}`, {
        traps: [[`${a}*(x^${n}${k < 0 ? '-' : '+'}${Math.abs(k)})`, 'The stretch happens first, so only $x^' + n + '$ is multiplied. The shift is added afterwards.']],
        hints: ['Apply the transformations in the order given.', `Stretching first gives $y = ${a}x^{${n}}$.`, 'The translation then adds to the whole right-hand side.', 'Write the final equation.'],
        steps: [['Stretch', `$y = ${a}x^{${n}}$`], ['Translate', `$y = ${a}x^{${n}} ${sg(k)}$`]],
        audit: { kind: 'imageexpr', base: n, ops: [['sy', a], ['ty', k]], key: `${a}*x^${n}${k < 0 ? '-' : '+'}${Math.abs(k)}` }
      });
    }
    return E(`The graph of $y = ${xn}$ is reflected in the $x$-axis and then translated ${un(Math.abs(k))} ${k > 0 ? 'up' : 'down'}. Write the equation of the image in the form $y = \\ldots$.`, `-x^${n}${k < 0 ? '-' : '+'}${Math.abs(k)}`, {
      traps: [[`-(x^${n}${k < 0 ? '-' : '+'}${Math.abs(k)})`, 'The reflection is applied first, so only $x^' + n + '$ is negated.']],
      hints: ['Apply the transformations in the order given.', 'A reflection in the $x$-axis gives $y = -x^{' + n + '}$.', 'The translation then adds to the whole right-hand side.', 'Write the final equation.'],
      steps: [['Reflect', `$y = -x^{${n}}$`], ['Translate', `$y = -x^{${n}} ${sg(k)}$`]],
      audit: { kind: 'imageexpr', base: n, ops: [['sy', -1], ['ty', k]], key: `-x^${n}${k < 0 ? '-' : '+'}${Math.abs(k)}` }
    });
  }),

  // Q3b · D4 · the ORDER of a horizontal dilation and a translation changes the image
  V([4], rng => {
    const c = rc(rng, [2, 3]), h = nz(rng, -4, 4);
    const horizontal = rng() < 0.5;
    const first = rng() < 0.5;
    if (horizontal) {
      const dil = `dilated horizontally by a factor of $${c}$`, trans = `translated ${un(Math.abs(h))} ${h > 0 ? 'right' : 'left'}`;
      const key = first ? `((x${h < 0 ? '+' : '-'}${Math.abs(h)})/${c})^2` : `(x/${c}${h < 0 ? '+' : '-'}${Math.abs(h)})^2`;
      const wrong = first ? `(x/${c}${h < 0 ? '+' : '-'}${Math.abs(h)})^2` : `((x${h < 0 ? '+' : '-'}${Math.abs(h)})/${c})^2`;
      return E(`The graph of $y = x^2$ is first ${first ? dil : trans}, and then ${first ? trans : dil}. Write the equation of the image in the form $y = \\ldots$.`, key, {
        traps: [[wrong, 'The order matters. The second transformation acts on the equation produced by the first, so it replaces $x$ in that expression.']],
        hints: ['Do the transformations one at a time, in the order stated.', `A horizontal dilation by factor $${c}$ replaces $x$ by $\\dfrac{x}{${c}}$.`, `A translation ${h > 0 ? 'right' : 'left'} by ${Math.abs(h)} replaces $x$ by $(x ${sg(-h)})$.`, 'The second change replaces every $x$ in the equation you have after the first.'],
        steps: [['First step', first ? `$y = \\left(\\dfrac{x}{${c}}\\right)^2$` : `$y = (x ${sg(-h)})^2$`], ['Second step', first ? `Replace $x$ by $(x ${sg(-h)})$: $y = \\left(\\dfrac{x ${sg(-h)}}{${c}}\\right)^2$` : `Replace $x$ by $\\dfrac{x}{${c}}$: $y = \\left(\\dfrac{x}{${c}} ${sg(-h)}\\right)^2$`]],
        audit: { kind: 'imageexpr', base: 2, ops: first ? [['dx', c], ['tx', h]] : [['tx', h], ['dx', c]], key }
      });
    }
    const a = rc(rng, [2, 3, 4]), k = nz(rng, -5, 5);
    const st = `stretched vertically by a factor of $${a}$`, up = `translated ${un(Math.abs(k))} ${k > 0 ? 'up' : 'down'}`;
    const key = first ? `${a}*x^2${k < 0 ? '-' : '+'}${Math.abs(k)}` : `${a}*(x^2${k < 0 ? '-' : '+'}${Math.abs(k)})`;
    const wrong = first ? `${a}*(x^2${k < 0 ? '-' : '+'}${Math.abs(k)})` : `${a}*x^2${k < 0 ? '-' : '+'}${Math.abs(k)}`;
    return E(`The graph of $y = x^2$ is first ${first ? st : up}, and then ${first ? up : st}. Write the equation of the image in the form $y = \\ldots$.`, key, {
      traps: [[wrong, 'The order matters. The second transformation acts on the whole equation produced by the first.']],
      hints: ['Do the transformations one at a time, in the order stated.', 'A vertical stretch multiplies the whole right-hand side.', 'A vertical translation adds to the whole right-hand side.', 'The second operation acts on everything the first produced.'],
      steps: [['First step', first ? `$y = ${a}x^2$` : `$y = x^2 ${sg(k)}$`], ['Second step', first ? `$y = ${a}x^2 ${sg(k)}$` : `$y = ${a}(x^2 ${sg(k)})$`]],
      audit: { kind: 'imageexpr', base: 2, ops: first ? [['sy', a], ['ty', k]] : [['ty', k], ['sy', a]], key }
    });
  }),

  // Q4 · D3, D4 · domain and range of the image
  V([3, 4], (rng, d) => {
    if (d === 3) {
      const lo = nz(rng, -6, 2), hi = lo + ri(rng, 3, 8), c = ri(rng, -5, 2), dd = c + ri(rng, 3, 9);
      const a = rc(rng, [-3, -2, -1, 2, 3]), k = nz(rng, -6, 6);
      const greatest = rng() < 0.5;
      const cand = [a * c + k, a * dd + k];
      const val = greatest ? Math.max(...cand) : Math.min(...cand);
      return N(`The function $f$ has domain $${lo} \\le x \\le ${hi}$ and range $${c} \\le y \\le ${dd}$. The function $g$ is defined by $g(x) = ${a === -1 ? '-' : a}f(x) ${sg(k)}$. What is the ${greatest ? 'greatest' : 'least'} value in the range of $g$?`, val, {
        traps: [[greatest ? Math.min(...cand) : Math.max(...cand), a < 0 ? 'A negative factor reverses the order: the greatest value of $f$ gives the LEAST value of $' + a + 'f$.' : 'Apply the factor and the shift to the correct end of the range.'], [a * (greatest ? dd : c), 'Do not forget to add the shift $' + k + '$.']],
        hints: ['The domain of $f$ does not change the range of $g$. Use the range of $f$.', a < 0 ? 'A negative factor flips the range: the top becomes the bottom.' : 'A positive factor keeps the order of the ends.', `Transform both ends: $y \\to ${a}y ${sg(k)}$.`, `Choose the ${greatest ? 'larger' : 'smaller'} result.`],
        steps: [['Transform each end', `$${a}(${c}) ${sg(k)} = ${a * c + k}$ and $${a}(${dd}) ${sg(k)} = ${a * dd + k}$`], [greatest ? 'Greatest' : 'Least', `$${val}$`]],
        audit: { kind: 'rangeimage', c, dd, a, k, greatest, expect: val }
      });
    }
    const b = rc(rng, [2, 3, -1, -2, -3]), h = nz(rng, -5, 5);
    const lo = b * ri(rng, -4, 0), hi = lo + Math.abs(b) * ri(rng, 2, 5);
    // g(x) = f(b(x - h)): b(x-h) in [lo, hi] -> x = h + t/b
    const xs = [h + lo / b, h + hi / b];
    const val = Math.max(...xs);
    return N(`The function $f$ has domain $${lo} \\le x \\le ${hi}$. The function $g$ is defined by $g(x) = f\\big(${b === -1 ? '-' : b}(x ${sg(-h)})\\big)$. What is the greatest value of $x$ in the domain of $g$?`, val, {
      traps: [[h + hi * b, 'The input to $f$ is $' + b + '(x ' + sg(-h) + ')$. Solve $' + b + '(x ' + sg(-h) + ') = ' + hi + '$ for $x$: divide by ' + b + ' first.'], [Math.min(...xs), b < 0 ? 'A negative factor reverses the order of the ends.' : 'Choose the larger of the two $x$-values.']],
      hints: ['The expression inside $f$ must lie between the ends of the domain of $f$.', `Write $${lo} \\le ${b}(x ${sg(-h)}) \\le ${hi}$.`, b < 0 ? 'Dividing an inequality by a negative number reverses it.' : 'Divide by the positive factor, then add the shift.', 'Read off the greatest value of $x$.'],
      steps: [['Condition', `$${lo} \\le ${b}(x ${sg(-h)}) \\le ${hi}$`], ['Solve for x', `The ends are $x = ${xs[0]}$ and $x = ${xs[1]}$`], ['Greatest', `$${val}$`]],
      audit: { kind: 'domainimage', lo, hi, b, h, expect: val }
    });
  }),

  // Q5 · D3, D4 · a graph to read: transform its labelled points
  V([3, 4], (rng, d) => {
    const xs = [], ys = [];
    let x = ri(rng, -5, -3);
    for (let i = 0; i < 4; i++) { xs.push(x); x += ri(rng, 2, 3); }
    let ok = false;
    while (!ok) {
      ys.length = 0;
      for (let i = 0; i < 4; i++) ys.push(ri(rng, -3, 4));
      const mx = Math.max(...ys), mn = Math.min(...ys);
      ok = ys.filter(v => v === mx).length === 1 && ys.filter(v => v === mn).length === 1 && mx - mn >= 4;
    }
    const pts = xs.map((v, i) => [v, ys[i]]);
    const figure = figPolyline(pts, { xr: [Math.min(...xs) - 1, Math.max(...xs) + 2], yr: [-8, 10] });
    const hi = pts.find(p => p[1] === Math.max(...ys)), lo = pts.find(p => p[1] === Math.min(...ys));
    if (d === 3) {
      const h = nz(rng, -4, 4), k = nz(rng, -4, 4);
      return P(`The graph of $y = f(x)$ is shown. The graph of $y = f(x ${sg(-h)}) ${sg(k)}$ is drawn. Find the coordinates of the image of the highest point of the original graph.`, hi[0] + h, hi[1] + k, {
        figure,
        traps: [['Read the highest labelled point first. Then shift: $x ' + sg(-h) + '$ moves the graph ' + un(Math.abs(h)) + ' ' + (h > 0 ? 'right' : 'left') + ', and $' + sg(k) + '$ moves it ' + un(Math.abs(k)) + ' ' + (k > 0 ? 'up' : 'down') + '.']],
        hints: ['Identify the highest labelled point on the graph.', 'Read its coordinates from the label.', `Move it $${h}$ in the $x$-direction and $${k}$ in the $y$-direction.`, 'State the new point.'],
        steps: [['Highest point', `$(${hi[0]}, ${hi[1]})$`], ['Translate', `$(${hi[0]} + ${h}, ${hi[1]} + ${k}) = (${hi[0] + h}, ${hi[1] + k})$`]],
        audit: { kind: 'figpoint', pts, mode: 'high-translate', h, k, expect: [hi[0] + h, hi[1] + k] }
      });
    }
    const a = rc(rng, [2, 3]), k = nz(rng, -5, 5);
    return N(`The graph of $y = f(x)$ is shown. The graph of $y = g(x)$ is defined by $g(x) = -${a}f(x) ${sg(k)}$. What is the lowest $y$-value reached by the graph of $g$ over the interval shown?`, -a * hi[1] + k, {
      figure,
      traps: [[a * lo[1] + k, 'A negative factor turns the HIGHEST point of $f$ into the LOWEST point of $g$.'], [-a * lo[1] + k, 'That is the highest value of $g$. The lowest comes from the highest value of $f$.']],
      hints: ['Read the highest and lowest labelled $y$-values of $f$.', `$g(x) = -${a}f(x) ${sg(k)}$ multiplies $y$ by $-${a}$, which reverses the order.`, 'So the lowest value of $g$ comes from the highest value of $f$.', `Compute $-${a} \\times y_{\\max} ${sg(k)}$.`],
      steps: [['Highest value of f', `$${hi[1]}$`], ['Lowest value of g', `$-${a}(${hi[1]}) ${sg(k)} = ${-a * hi[1] + k}$`]],
      audit: { kind: 'figpoint', pts, mode: 'low-negdilate', a, k, expect: -a * hi[1] + k }
    });
  }),
  // U1 · D1 · the equation of a translated power function
  V([1], rng => {
    const n = rc(rng, [2, 3]), h = nz(rng, -6, 6), k = nz(rng, -7, 7);
    const key = `(x${h < 0 ? '+' : '-'}${Math.abs(h)})^${n}${k < 0 ? '-' : '+'}${Math.abs(k)}`;
    return E(`The graph of $y = x^${n}$ is translated ${un(Math.abs(h))} ${h > 0 ? 'right' : 'left'} and ${un(Math.abs(k))} ${k > 0 ? 'up' : 'down'}. Write the equation of the image in the form $y = \\ldots$.`, key, {
      traps: [[`(x${h < 0 ? '-' : '+'}${Math.abs(h)})^${n}${k < 0 ? '-' : '+'}${Math.abs(k)}`, `Moving ${h > 0 ? 'right' : 'left'} by ${Math.abs(h)} replaces $x$ by $x ${sg(-h)}$.`]],
      hints: ['A horizontal translation changes the INPUT, $x$, inside the function.', `A shift of ${Math.abs(h)} to the ${h > 0 ? 'right' : 'left'} replaces $x$ by $(x ${sg(-h)})$.`, 'A vertical translation adds to the whole right-hand side.', 'Combine the two changes.'],
      steps: [['Horizontal', `$y = (x ${sg(-h)})^${n}$`], ['Vertical', `$y = (x ${sg(-h)})^${n} ${sg(k)}$`]],
      audit: { kind: 'imageexpr', base: n, ops: [['tx', h], ['ty', k]], key }
    });
  }),

  // U2 · D1 · read the translation from the rule (which way does a sign inside move the graph?)
  V([1], rng => {
    const h = nz(rng, -7, 7), k = nz(rng, -7, 7);
    const dx = h, dy = k;
    const txt = (a, b) => `${un(Math.abs(a))} ${a > 0 ? 'right' : 'left'} and ${un(Math.abs(b))} ${b > 0 ? 'up' : 'down'}`;
    return M(rng, `The graph of $y = g(x)$ is $y = f(x ${sg(-h)}) ${sg(k)}$. Which describes how the graph of $y = f(x)$ is moved to give $y = g(x)$?`, txt(dx, dy), [
      { text: txt(-dx, dy), why: 'A change inside the bracket works the opposite way to its sign: $x - h$ moves the graph to the right.' },
      { text: txt(dx, -dy), why: 'A constant added outside moves the graph up if it is positive.' },
      { text: txt(-dx, -dy), why: 'Both directions are reversed here. Inside the bracket, $x - h$ means right by $h$; outside, $+ k$ means up by $k$.' }
    ], {
      hints: ['Treat the bracket and the outside separately.', `Inside: $x ${sg(-h)}$.`, `A subtraction inside the bracket moves the graph to the RIGHT, and an addition moves it LEFT.`, `Outside: $${sg(k)}$ moves the graph ${k > 0 ? 'up' : 'down'}.`],
      steps: [['Inside the bracket', `$x ${sg(-h)}$: ${un(Math.abs(h))} ${h > 0 ? 'right' : 'left'}`], ['Outside', `$${sg(k)}$: ${un(Math.abs(k))} ${k > 0 ? 'up' : 'down'}`]],
      audit: { kind: 'transmc', h, k, key: txt(dx, dy) }
    });
  }),

  // U3 · D1 · the vertex moves with the translation
  V([1], rng => {
    const p = nz(rng, -5, 5), q = nz(rng, -6, 6), h = nz(rng, -5, 5), k = nz(rng, -5, 5);
    return P(`The parabola $y = (x ${sg(-p)})^2 ${sg(q)}$ is translated ${un(Math.abs(h))} ${h > 0 ? 'right' : 'left'} and ${un(Math.abs(k))} ${k > 0 ? 'up' : 'down'}. Find the coordinates of the vertex of the image.`, p + h, q + k, {
      traps: [['The vertex is a point on the graph, so it moves by the same translation. First read the vertex from the equation.']],
      hints: ['Read the vertex of the original parabola from its equation.', `$y = (x ${sg(-p)})^2 ${sg(q)}$ has its vertex at $(${p}, ${q})$.`, 'The vertex moves by the same translation as every other point.', 'Add the horizontal and vertical movements to the coordinates.'],
      steps: [['Original vertex', `$(${p}, ${q})$`], ['Translate', `$(${p} ${sg(h)}, ${q} ${sg(k)}) = (${p + h}, ${q + k})$`]],
      audit: { kind: 'transvertex', p, q, h, k, expect: [p + h, q + k] }
    });
  }),

  // U4 · D1 · find the translation from a point and its image
  V([1], rng => {
    const x1 = nz(rng, -6, 6), y1 = nz(rng, -6, 6), x2 = nz(rng, -6, 6), y2 = nz(rng, -6, 6);
    rej(x1 === x2 || y1 === y2);
    const askH = rng() < 0.5;
    return N(`The point $(${x1}, ${y1})$ on the graph of $y = f(x)$ is mapped to $(${x2}, ${y2})$ on the graph of $y = f(x - h) + k$. Find ${askH ? '$h$' : '$k$'}.`, askH ? x2 - x1 : y2 - y1, {
      traps: [[askH ? y2 - y1 : x2 - x1, askH ? 'The constant $h$ moves the graph horizontally: compare the $x$-coordinates.' : 'The constant $k$ moves the graph vertically: compare the $y$-coordinates.'], [askH ? x1 - x2 : y1 - y2, 'Take the image minus the original.']],
      hints: [`$y = f(x - h) + k$ moves every point $h$ to the right and $k$ up.`, askH ? 'Compare the $x$-coordinates before and after.' : 'Compare the $y$-coordinates before and after.', 'Subtract the original coordinate from the image coordinate.', 'Check the sign.'],
      steps: [[askH ? 'Horizontal movement' : 'Vertical movement', askH ? `$h = ${x2} - ${br(x1)} = ${x2 - x1}$` : `$k = ${y2} - ${br(y1)} = ${y2 - y1}$`]],
      audit: { kind: 'transh', x1, y1, x2, y2, askH, expect: askH ? x2 - x1 : y2 - y1 }
    });
  }),
];

// ── y11-functions-more ───────────────────────────────────────────────────────
const lin = (a, b) => `${a === 1 ? '' : a === -1 ? '-' : a}x ${sg(b)}`;
const functions = [
  // F1 · D3, D4 · the inverse of a quadratic on a restricted domain: choose the correct branch
  V([3, 4], (rng, d) => {
    const m = ri(rng, 1, 9), pos = rng() < 0.5;
    const h = d === 3 ? 0 : nz(rng, -5, 5), c = nz(rng, -9, 9);
    const Nv = c + m * m;
    const val = pos ? h + m : h - m;
    const body = h === 0 ? 'x^2' : `(x ${sg(-h)})^2`;
    const dom = pos ? `x \\ge ${h}` : `x \\le ${h}`;
    return N(`The function $f(x) = ${body} ${sg(c)}$ is defined for $${dom}$. Find $f^{-1}(${Nv})$.`, val, {
      traps: [[pos ? h - m : h + m, `The domain is $${dom}$, so only the ${pos ? 'positive' : 'negative'} square root applies.`], [Nv - c, 'Solve $f(x) = ' + Nv + '$. Subtract the constant first, then take a square root.']],
      hints: [`$f^{-1}(${Nv})$ is the value of $x$ in the domain with $f(x) = ${Nv}$.`, `Solve $${body} ${sg(c)} = ${Nv}$.`, `A square root gives two values; choose the one with $${dom}$.`, 'Check that your value lies in the domain.'],
      steps: [['Set up', `$${body} ${sg(c)} = ${Nv}$, so $${h === 0 ? 'x^2' : `(x ${sg(-h)})^2`} = ${m * m}$`], ['Both roots', `$x ${h === 0 ? '' : sg(-h)}= \\pm ${m}$`], ['Use the domain', `$${dom}$ gives $x = ${val}$`]],
      audit: { kind: 'inversequad', h, c, N: Nv, pos, expect: val }
    });
  }),

  // F2 · D3, D4 · solve f(g(x)) = N
  V([3, 4], (rng, d) => {
    if (d === 3) {
      const a = ri(rng, 2, 5), b = nz(rng, -6, 6), c = ri(rng, 2, 5), e = nz(rng, -6, 6), x0 = nz(rng, -5, 6);
      const Nv = a * (c * x0 + e) + b;
      return N(`$f(x) = ${lin(a, b)}$ and $g(x) = ${lin(c, e)}$. Solve $f(g(x)) = ${Nv}$.`, x0, {
        traps: [[(Nv - b) / a, 'That value is $g(x)$. Now solve $g(x) = ' + (Nv - b) / a + '$ for $x$.'], [(Nv - e) / c, '$f(g(x))$ means $g$ is applied first, then $f$.']],
        hints: ['$f(g(x))$ means substitute $g(x)$ into $f$.', `$f(g(x)) = ${a}(${lin(c, e)}) ${sg(b)}$.`, 'Expand and simplify, then set equal to the number.', 'Solve the linear equation.'],
        steps: [['Composite', `$f(g(x)) = ${a}(${lin(c, e)}) ${sg(b)} = ${a * c}x ${sg(a * e + b)}$`], ['Solve', `$${a * c}x ${sg(a * e + b)} = ${Nv}$, so $x = ${x0}$`]],
        audit: { kind: 'composesolve', f: [a, b], g: [c, e], N: Nv, expect: x0 }
      });
    }
    const a = ri(rng, 2, 4), b = nz(rng, -7, 7), c = nz(rng, -6, 6), m = ri(rng, 1, 5);
    const Nv = a * (m * m + c) + b;
    return S(`$f(x) = ${lin(a, b)}$ and $g(x) = x^2 ${sg(c)}$. Solve $f(g(x)) = ${Nv}$ for $x$.`, [-m, m], {
      traps: [[m, 'A squared term gives two solutions, $x = m$ and $x = -m$.']],
      hints: ['Substitute $g(x)$ into $f$ (the inner function goes first).', `$f(g(x)) = ${a}(x^2 ${sg(c)}) ${sg(b)}$.`, 'Solve for $x^2$ first.', 'Take the square root, keeping both signs.'],
      steps: [['Composite', `$f(g(x)) = ${a}x^2 ${sg(a * c + b)}$`], ['Solve for x²', `$${a}x^2 = ${Nv - a * c - b}$, so $x^2 = ${m * m}$`], ['Both roots', `$x = \\pm ${m}$`]],
      audit: { kind: 'composesolve2', a, b, c, N: Nv, expect: [-m, m] }
    });
  }),

  // F3 · D3, D4 · for which constant do the two composites agree?
  V([3, 4], (rng, d) => {
    const a = nz(rng, -3, 4), b = nz(rng, -3, 4), dd = nz(rng, -6, 6);
    rej(b === 1 || a === 1 || a === 0 || b === 0 || (d === 3 && (Math.abs(a) > 3 || Math.abs(b) > 3)));
    const n = dd * (1 - a), den = 1 - b;
    const lead = k => (k === 1 ? '' : k === -1 ? '-' : k);
    return Fr(`$f(x) = ${lead(a)}x + c$ and $g(x) = ${lead(b)}x ${sg(dd)}$, where $c$ is a constant. Find the value of $c$ for which $f(g(x)) = g(f(x))$ for every $x$.`, n, den, {
      traps: [[dd * (1 - b) / (1 - a), 'Equate the CONSTANT terms of $f(g(x))$ and $g(f(x))$ and solve for $c$ carefully.'], [dd, 'Compare the constant terms, not the coefficients of $x$ (those are equal automatically).']],
      hints: ['Work out $f(g(x))$ and $g(f(x))$ separately.', `$f(g(x)) = ${a}(${lead(b)}x ${sg(dd)}) + c$ and $g(f(x)) = ${b}(${lead(a)}x + c) ${sg(dd)}$.`, 'The coefficients of $x$ agree automatically; the constant terms must also be equal.', 'Solve the resulting equation for $c$.'],
      steps: [['f(g(x))', `$${a * b}x ${sg(a * dd)} + c$`], ['g(f(x))', `$${a * b}x ${sg(b)}c ${sg(dd)}$`], ['Equate constants', `$${a * dd} + c = ${b}c ${sg(dd)}$, so $c(1 - ${b}) = ${dd}(1 - ${a})$`], ['Solve', `$c = ${fr(n, den)}$`]],
      audit: { kind: 'commute', a, b, d: dd, expectFrac: [n, den] }
    });
  }),

  // F4 · D3, D4 · the domain of a composite function
  V([3, 4], (rng, d) => {
    if (d === 3) {
      const p = rc(rng, [1, 2, 3, 4, -1, -2, -3]), q = nz(rng, -9, 9);
      const edge = -q / p;
      const lower = p > 0;
      return Fr(`$f(x) = \\sqrt{x}$ and $g(x) = ${lin(p, q)}$. Find the ${lower ? 'smallest' : 'largest'} value of $x$ in the domain of $f(g(x))$. Give the answer as a fraction in simplest form if needed.`, -q, p, {
        traps: [[q / p, 'Solve $g(x) \\ge 0$: the expression under the root cannot be negative. Move the constant across with the opposite sign.'], [-q, 'Divide by the coefficient of $x$ as well.']],
        hints: ['$f(g(x)) = \\sqrt{g(x)}$, so $g(x)$ must not be negative.', `Solve $${lin(p, q)} \\ge 0$.`, p < 0 ? 'Dividing by a negative number reverses the inequality.' : 'Divide by the positive coefficient.', `The boundary value is the ${lower ? 'smallest' : 'largest'} allowed $x$.`],
        steps: [['Condition', `$${lin(p, q)} \\ge 0$`], ['Solve', `$x ${lower ? '\\ge' : '\\le'} ${fr(-q, p)}$`], [lower ? 'Smallest' : 'Largest', `$x = ${fr(-q, p)}$`]],
        audit: { kind: 'composedomain', p, q, mode: 'sqrt', expect: edge, expectFrac: [-q, p] }
      });
    }
    const a = ri(rng, -6, 6), p = rc(rng, [2, 3, 4, -2, -3]), q = nz(rng, -7, 7);
    rej(a === 0);
    return Fr(`$f(x) = \\dfrac{1}{x ${sg(-a)}}$ and $g(x) = ${lin(p, q)}$. One real value of $x$ is NOT in the domain of $f(g(x))$. What is it? Give the answer as a fraction in simplest form if needed.`, a - q, p, {
      traps: [[a, 'The excluded value of $f$ is the OUTPUT of $g$ that makes the denominator zero. Solve $g(x) = ' + a + '$ for $x$.'], [q - a, 'Check the sign: solve $' + lin(p, q) + ' = ' + a + '$.']],
      hints: ['$f$ cannot accept the input that makes its denominator zero.', `That input is $${a}$.`, `So $g(x)$ must not equal $${a}$.`, `Solve $${lin(p, q)} = ${a}$ for $x$.`],
      steps: [['Excluded input of f', `$x ${sg(-a)} = 0$, so the input $${a}$ is excluded`], ['Solve g(x) = ' + a, `$${lin(p, q)} = ${a}$, so $x = ${fr(a - q, p)}$`]],
      audit: { kind: 'composedomain', p, q, a, mode: 'recip', expect: (a - q) / p, expectFrac: [a - q, p] }
    });
  }),

  // F5 · D3, D4 · work backwards to find f from f(g(x))
  V([3, 4], (rng, d) => {
    if (d === 3) {
      const a = nz(rng, -4, 5), b = nz(rng, -8, 8), p = ri(rng, 2, 4), q = nz(rng, -6, 6), t = nz(rng, -6, 8);
      rej(a === 0);
      const r = a * p, s = a * q + b;
      return N(`$g(x) = ${lin(p, q)}$ and $f(g(x)) = ${lin(r, s)}$. Find $f(${t})$.`, a * t + b, {
        traps: [[r * t + s, 'The given rule is for $f(g(x))$, not $f(x)$. First find $f(x)$ or the value of $x$ with $g(x) = ' + t + '$.']],
        hints: ['$f(g(x))$ means $f$ applied to $g(x)$. You want the input $' + t + '$ to $f$.', `Find the $x$ with $g(x) = ${t}$: solve $${lin(p, q)} = ${t}$.`, `Substitute that $x$ into $f(g(x)) = ${lin(r, s)}$.`, 'The result is $f(' + t + ')$.'],
        steps: [['Solve g(x) = ' + t, `$${lin(p, q)} = ${t}$, so $x = ${fr(t - q, p)}$`], ['Evaluate f(g(x))', `$f(${t}) = ${r}\\left(${fr(t - q, p)}\\right) ${sg(s)} = ${a * t + b}$`]],
        audit: { kind: 'backwardsf', g: [p, q], fg: [r, s], t, expect: a * t + b }
      });
    }
    const a = nz(rng, -5, 5), b = nz(rng, -9, 9), q = nz(rng, -5, 5), t = nz(rng, -5, 8);
    const A = 2 * q + a, B = q * q + a * q + b;
    return N(`$g(x) = x ${sg(q)}$ and $f(g(x)) = x^2 ${A === 0 ? '' : `${A > 0 ? '+' : '-'} ${Math.abs(A) === 1 ? '' : Math.abs(A)}x`} ${sg(B)}$. Find $f(${t})$.`, t * t + a * t + b, {
      traps: [[t * t + A * t + B, 'The given rule is for $f(g(x))$. Express $f$ in terms of its own input by letting $u = x ' + sg(q) + '$.']],
      hints: ['Let $u = g(x) = x + ' + q + '$, so $x = u - ' + q + '$.', 'Substitute $x = u ' + sg(-q) + '$ into the expression for $f(g(x))$.', 'Simplify to get $f(u)$.', 'Then substitute $u = ' + t + '$.'],
      steps: [['Express in u', `$x = u ${sg(-q)}$`], ['Find f(u)', `$f(u) = u^2 ${sg(a)}u ${sg(b)}$`], ['Evaluate', `$f(${t}) = ${t * t + a * t + b}$`]],
      audit: { kind: 'backwardsf2', q, A, B, t, expect: t * t + a * t + b }
    });
  }),

  // F6 · D3, D4 · the inverse of a composite: undo in the reverse order
  V([3, 4], (rng, d) => {
    const x0 = nz(rng, -5, 6);
    if (d === 3) {
      const a = ri(rng, 2, 4), b = nz(rng, -6, 6), c = ri(rng, 2, 4), e = nz(rng, -6, 6);
      const Nv = a * (c * x0 + e) + b;
      return N(`$f(x) = ${lin(a, b)}$ and $g(x) = ${lin(c, e)}$. Find $(f \\circ g)^{-1}(${Nv})$, the value of $x$ with $f(g(x)) = ${Nv}$.`, x0, {
        traps: [[(Nv - e) / c, 'Undo $f$ first (the last function applied), then undo $g$. Check the order and the arithmetic.']],
        hints: ['$(f \\circ g)(x) = f(g(x))$: $g$ is applied first, then $f$.', 'To undo, reverse the order: undo $f$, then undo $g$.', `Undo $f$: $\\dfrac{${Nv} ${sg(-b)}}{${a}}$.`, `Then undo $g$: subtract $${e}$ and divide by $${c}$.`],
        steps: [['Undo f', `$g(x) = \\dfrac{${Nv} ${sg(-b)}}{${a}} = ${(Nv - b) / a}$`], ['Undo g', `$${lin(c, e)} = ${(Nv - b) / a}$, so $x = ${x0}$`]],
        audit: { kind: 'composesolve', f: [a, b], g: [c, e], N: Nv, expect: x0 }
      });
    }
    const a = ri(rng, 2, 4), b = nz(rng, -6, 6), c = nz(rng, -6, 6);
    const Nv = a * (x0 ** 3 + c) + b;
    return N(`$f(x) = ${lin(a, b)}$ and $g(x) = x^3 ${sg(c)}$. Find $(f \\circ g)^{-1}(${Nv})$.`, x0, {
      traps: [[Nv - b - c, 'Undo $f$ first (divide, after removing the constant), then undo $g$ (remove its constant, then take a cube root).']],
      hints: ['$(f \\circ g)^{-1}(N)$ is the $x$ with $f(g(x)) = N$.', `Undo $f$: $g(x) = \\dfrac{${Nv} ${sg(-b)}}{${a}}$.`, `Then solve $x^3 ${sg(c)} = g(x)$.`, 'Take a cube root; a cube root of a negative number is negative.'],
      steps: [['Undo f', `$g(x) = ${(Nv - b) / a}$`], ['Undo g', `$x^3 = ${(Nv - b) / a - c} = ${x0 ** 3}$`], ['Cube root', `$x = ${x0}$`]],
      audit: { kind: 'composesolve3', a, b, c, N: Nv, expect: x0 }
    });
  }),
  // V1 · D1 · the one value a denominator forbids
  V([1], rng => {
    const a = rc(rng, [1, 2, 3, 4, 5, -1, -2, -3]), b = nz(rng, -9, 9);
    return Fr(`For the function $f(x) = \\dfrac{${ri(rng, 1, 9)}}{${a === 1 ? '' : a === -1 ? '-' : a}x ${sg(b)}}$, one real number is NOT in the domain. What is it? Give the answer as a fraction in simplest form if needed.`, -b, a, {
      traps: [[b / a, 'Set the denominator equal to zero and solve: move the constant across with the opposite sign.'], [-b, 'Divide by the coefficient of $x$ as well.']],
      hints: ['A fraction has no value when its denominator is zero.', 'Set the denominator equal to zero.', 'Solve the linear equation for $x$.', 'That value is the only one excluded from the domain.'],
      steps: [['Denominator zero', `$${a === 1 ? '' : a === -1 ? '-' : a}x ${sg(b)} = 0$`], ['Solve', `$x = ${fr(-b, a)}$`]],
      audit: { kind: 'domrecip', a, b, expect: -b / a, expectFrac: [-b, a] }
    });
  }),

  // V2 · D1 · the largest input a square root allows
  V([1], rng => {
    const m = ri(rng, 1, 5), c = nz(rng, -9, 12);
    return Fr(`The function $f(x) = \\sqrt{${c} - ${m === 1 ? '' : m}x}$ is defined for $x \\le x_0$. Find the greatest value $x_0$ in the domain. Give the answer as a fraction in simplest form if needed.`, c, m, {
      traps: [[-c / m, 'Solve $c - mx \\ge 0$, so $mx \\le c$.'], [c, 'Divide by the coefficient of $x$ as well.']],
      hints: ['The expression under a square root cannot be negative.', `$${c} - ${m === 1 ? '' : m}x \\ge 0$.`, 'Rearrange: bring $x$ to one side. Dividing by a positive number keeps the inequality direction.', 'The boundary value is the greatest allowed $x$.'],
      steps: [['Under the root', `$${c} - ${m === 1 ? '' : m}x \\ge 0$`], ['Solve', `$x \\le ${fr(c, m)}$`]],
      audit: { kind: 'domsqrt', m, c, expect: c / m, expectFrac: [c, m] }
    });
  }),

  // V3 · D1 · which function is defined for every real number?
  V([1], rng => {
    const k = ri(rng, 1, 9), a = ri(rng, 1, 7), b = ri(rng, 2, 7);
    const tex = s => `$${s}$`;
    const keyOpts = [{ t: `f(x) = \\sqrt{x^2 + ${k}}`, js: `Math.sqrt(x*x+${k})` }, { t: `f(x) = \\dfrac{1}{x^2 + ${k}}`, js: `1/(x*x+${k})` }];
    const key = rc(rng, keyOpts);
    const bad = [{ t: `f(x) = \\sqrt{x ${sg(-a)}}`, js: `Math.sqrt(x-${a})` }, { t: `f(x) = \\dfrac{1}{x ${sg(-a)}}`, js: `1/(x-${a})` }, { t: `f(x) = \\dfrac{1}{x^2 - ${b * b}}`, js: `1/(x*x-${b * b})` }, { t: `f(x) = \\sqrt{${k} - x^2}`, js: `Math.sqrt(${k}-x*x)` }];
    const ds = rs(rng, bad).slice(0, 3).map(o => ({ text: tex(o.t), why: 'This function has no value for some real $x$: a denominator is zero or the expression under a root is negative.' }));
    return M(rng, 'Which function is defined for every real number $x$?', tex(key.t), ds, {
      hints: ['Check each function for a denominator that can be zero.', 'Check each square root for an expression that can be negative.', 'A square plus a positive constant is never zero or negative.', 'Choose the function with neither problem.'],
      steps: [['Check', `$x^2 + ${k} \\ge ${k} > 0$ for every real $x$`], ['Answer', tex(key.t)]],
      audit: { kind: 'domallreals', key: key.js, others: bad.filter(o => ds.some(d => d.text === tex(o.t))).map(o => o.js), keyText: tex(key.t) }
    });
  }),

  // V4 · D1 · two square roots: the domain is where both conditions hold
  V([1], rng => {
    const p = nz(rng, -6, 4), q = p + ri(rng, 2, 9);
    return N(`How many integers are in the domain of $f(x) = \\sqrt{x ${sg(-p)}} + \\sqrt{${q} - x}$?`, q - p + 1, {
      traps: [[q - p, 'Both end values are allowed, so count them: a closed interval from $' + p + '$ to $' + q + '$.'], [q + p, 'Count the integers from the smallest to the greatest allowed value, inclusive.']],
      hints: ['Both expressions under the roots must be non-negative at the same time.', `$x ${sg(-p)} \\ge 0$ gives $x \\ge ${p}$, and $${q} - x \\ge 0$ gives $x \\le ${q}$.`, 'The domain is the interval where both hold.', 'Count the integers in that interval, including both ends.'],
      steps: [['Both conditions', `$${p} \\le x \\le ${q}$`], ['Count the integers', `$${q} - ${br(p)} + 1 = ${q - p + 1}$`]],
      audit: { kind: 'domcount', p, q, expect: q - p + 1 }
    });
  }),
];

// ── y11-data-sets ────────────────────────────────────────────────────────────
const exactTo = (v, dp) => Math.abs(v * 10 ** dp - Math.round(v * 10 ** dp)) < 1e-9;
const mean = xs => xs.reduce((s, v) => s + v, 0) / xs.length;
const sortNum = xs => xs.slice().sort((p, q) => p - q);
const med = xs => { const s = sortNum(xs), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };

const CONTEXTS = ['goals scored by a netball team in each game', 'books borrowed by a student each month', 'phone calls received at a front desk each hour', 'pets owned by each student in a class', 'customers served at a kiosk each ten minutes'];
const data = [
  // M1 · D1 · the mean from a frequency table (multiply before dividing)
  V([1], rng => {
    const m = ri(rng, 4, 6), s0 = ri(rng, 0, 3);
    const vals = Array.from({ length: m }, (_, i) => s0 + i);
    const freq = vals.map(() => ri(rng, 1, 9));
    const n = freq.reduce((a, b) => a + b, 0), tot = vals.reduce((a, v, i) => a + v * freq[i], 0);
    rej(!exactTo(tot / n, 2) || n < 12);
    return N(`The table shows the ${rc(rng, CONTEXTS)} over ${n} observations.\n\n$${tbl('Value', vals, freq)}$\n\nFind the mean.`, tot / n, {
      traps: [[mean(vals), 'Each value occurs several times. Weight each value by its frequency before dividing by the total frequency.'], [tot / m, 'Divide by the total frequency (the number of observations), not the number of different values.']],
      hints: ['Each value counts as many times as its frequency.', 'Multiply each value by its frequency and add the results.', `The total frequency is $${n}$.`, 'Divide the weighted total by the total frequency.'],
      steps: [['Weighted total', `$${vals.map((v, i) => `${v}\\times ${freq[i]}`).join(' + ')} = ${tot}$`], ['Total frequency', `$${freq.join(' + ')} = ${n}$`], ['Mean', `$\\dfrac{${tot}}{${n}} = ${tot / n}$`]],
      audit: { kind: 'freqmean', vals, freq, expect: tot / n }
    });
  }),

  // M2 · D1 · a missing value from a given mean
  V([1], rng => {
    const n = ri(rng, 4, 7), mu = ri(rng, 12, 60);
    const known = Array.from({ length: n - 1 }, () => ri(rng, mu - 12, mu + 12));
    const miss = n * mu - known.reduce((a, b) => a + b, 0);
    rej(miss < 0 || miss > 150);
    return N(`The mean of ${n} numbers is $${mu}$. ${n - 1} of the numbers are ${fmtList(known)}. What is the remaining number?`, miss, {
      traps: [[mu, 'The mean is not one of the numbers. The total of all ' + n + ' numbers is $' + n + ' \\times ' + mu + '$.'], [n * mu, 'That is the total of all the numbers. Subtract the ones you know.']],
      hints: [`Total of all ${n} numbers $= ${n}\\times ${mu}$.`, `$${n} \\times ${mu} = ${n * mu}$.`, `The ${n - 1} known numbers add to $${known.reduce((a, b) => a + b, 0)}$.`, 'The difference is the missing number.'],
      steps: [['Total', `$${n}\\times ${mu} = ${n * mu}$`], ['Known numbers', `$${known.join(' + ')} = ${known.reduce((a, b) => a + b, 0)}$`], ['Missing', `$${n * mu} - ${known.reduce((a, b) => a + b, 0)} = ${miss}$`]],
      audit: { kind: 'missingmean', n, mu, known, expect: miss }
    });
  }),

  // M3 · D1 · combine the means of two groups (weight by group size)
  V([1], rng => {
    const n1 = ri(rng, 5, 30), n2 = ri(rng, 5, 30), m1 = ri(rng, 40, 90), m2 = ri(rng, 40, 90);
    const tot = n1 * m1 + n2 * m2;
    rej(!exactTo(tot / (n1 + n2), 2) || m1 === m2);
    const ctx = rc(rng, [['Class A', 'Class B', 'test mark'], ['Group X', 'Group Y', 'score']]);
    return N(`${ctx[0]} has ${n1} students with a mean ${ctx[2]} of ${m1}. ${ctx[1]} has ${n2} students with a mean ${ctx[2]} of ${m2}. Find the mean ${ctx[2]} of all ${n1 + n2} students together.`, tot / (n1 + n2), {
      traps: [[(m1 + m2) / 2, 'The groups have different sizes, so the combined mean is weighted: find each group\'s total first.']],
      hints: ['A mean is a total divided by a count, so find each group\'s total.', `Total for the first group: $${n1}\\times ${m1}$.`, `Total for the second group: $${n2}\\times ${m2}$.`, `Add the totals and divide by $${n1 + n2}$.`],
      steps: [['Group totals', `$${n1}\\times ${m1} = ${n1 * m1}$ and $${n2}\\times ${m2} = ${n2 * m2}$`], ['Combined', `$\\dfrac{${n1 * m1} + ${n2 * m2}}{${n1 + n2}} = ${tot / (n1 + n2)}$`]],
      audit: { kind: 'combinedmean', n1, n2, m1, m2, expect: tot / (n1 + n2) }
    });
  }),

  // M4 · D1 · the mean after every value is scaled and shifted
  V([1], rng => {
    const mu = ri(rng, 8, 40), a = ri(rng, 2, 5), b = nz(rng, -9, 9);
    return N(`A data set has a mean of $${mu}$. Every value is multiplied by $${a}$ and then $${Math.abs(b)}$ is ${b > 0 ? 'added' : 'subtracted'}. What is the mean of the new data?`, a * mu + b, {
      traps: [[a * (mu + b), 'Do the operations in the order stated: multiply first, then add or subtract.'], [mu + b, 'The mean is also multiplied by ' + a + '.']],
      hints: ['The mean follows the same operations as every value.', `Multiply the mean by $${a}$.`, `Then ${b > 0 ? 'add' : 'subtract'} $${Math.abs(b)}$.`, 'Check the order of the operations.'],
      steps: [['Multiply', `$${a}\\times ${mu} = ${a * mu}$`], [b > 0 ? 'Add' : 'Subtract', `$${a * mu} ${sg(b)} = ${a * mu + b}$`]],
      audit: { kind: 'meantransform', mu, a, b, expect: a * mu + b }
    });
  }),

  // Dm1 · D2 · an unordered list with an even number of values: sort first, then average the middle pair
  V([2], rng => {
    const n = rc(rng, [6, 8, 10, 12]);
    const xs = Array.from({ length: n }, () => ri(rng, 5, 95));
    const m = med(xs);
    rej(new Set(xs).size < n);
    const mn = mean(xs);
    return N(`The ${n} values are ${fmtList(shuffle(rng, xs))}. Find the median.`, m, {
      traps: [[xs[n / 2], 'The values are not in order. Sort them first.'], [Math.round(mn * 100) / 100, 'That is the mean, not the median.']].filter(t => Number.isFinite(t[0])),
      hints: ['Put the values in order first.', `With ${n} values there is no single middle value.`, `The median is the mean of the ${n / 2}th and ${n / 2 + 1}th values.`, 'Add the two middle values and halve.'],
      steps: [['Order', `$${sortNum(xs).join(', ')}$`], ['Middle pair', `$${sortNum(xs)[n / 2 - 1]}$ and $${sortNum(xs)[n / 2]}$`], ['Median', `$${m}$`]],
      audit: { kind: 'median', xs, expect: m }
    });
  }),

  // Dm2 · D2 · the median from a frequency table (locate the middle position)
  V([2], rng => {
    const m = ri(rng, 4, 6), s0 = ri(rng, 1, 4);
    const vals = Array.from({ length: m }, (_, i) => s0 + i);
    const freq = vals.map(() => ri(rng, 2, 9));
    const n = freq.reduce((a, b) => a + b, 0);
    const flat = vals.flatMap((v, i) => Array(freq[i]).fill(v));
    const mm = med(flat);
    return N(`The table shows the ${rc(rng, CONTEXTS)} over ${n} observations.\n\n$${tbl('Value', vals, freq)}$\n\nFind the median.`, mm, {
      traps: [[mean(vals), 'The values are repeated according to their frequencies. Find the middle POSITION in the full list.'], [vals[Math.floor(m / 2)], 'Count positions using the frequencies (cumulative frequency), not the number of different values.']],
      hints: [`There are $${n}$ observations in all.`, n % 2 ? `The median is the ${(n + 1) / 2}th value.` : `The median is the mean of the ${n / 2}th and ${n / 2 + 1}th values.`, 'Add the frequencies as you go to find which value covers that position.', 'Read off that value (or average the two).'],
      steps: [['Position', n % 2 ? `$\\dfrac{${n} + 1}{2} = ${(n + 1) / 2}$th value` : `The ${n / 2}th and ${n / 2 + 1}th values`], ['Cumulative frequency', `$${vals.map((v, i) => `${v}: ${freq.slice(0, i + 1).reduce((a, b) => a + b, 0)}`).join(',\\; ')}$`], ['Median', `$${mm}$`]],
      audit: { kind: 'freqmedian', vals, freq, expect: mm }
    });
  }),

  // Dm3 · D2 · which measure of centre suits the data? (mean, median or mode)
  V([2], rng => {
    const ctxs = [
      () => { const base = ri(rng, 40, 60), xs = [base, base + 3, base - 2, base + 5, base + 1, base * ri(rng, 6, 9)]; return { t: `The annual salaries (in thousands of dollars) of six staff in a small firm are ${fmtList(xs)}. Which measure of centre best describes a typical salary?`, a: 'the median', why: 'One very large value pulls the mean up. The median is not affected by it.' }; },
      () => { const xs = Array.from({ length: 6 }, () => ri(rng, 60, 80)); return { t: `A mark is recorded for each of six students: ${fmtList(xs)}. The marks are spread evenly with no extreme values. Which measure of centre uses every mark?`, a: 'the mean', why: 'The mean uses every value, and with no outliers it is a good summary.' }; },
      () => { const sz = ri(rng, 6, 9); return { t: `A shoe shop recorded the size of every pair sold in a week. The shop wants to order more of the size that sells most often (size ${sz} sold most). Which measure of centre should it use?`, a: 'the mode', why: 'The question asks for the most frequent value, which is the mode.' }; },
      () => { const xs = [ri(rng, 100, 140), ri(rng, 100, 140), ri(rng, 100, 140), ri(rng, 100, 140), ri(rng, 100, 140), ri(rng, 2, 6) * 100 + 600]; return { t: `The prices (in thousands of dollars) of six houses on one street are ${fmtList(xs)}. Which measure of centre best describes a typical house price?`, a: 'the median', why: 'One mansion is far above the others and pulls the mean up. The median is more typical.' }; },
      () => { const col = rc(rng, ['red', 'blue', 'green', 'silver']); return { t: `Cars in a car park are recorded by colour (${col} is the most common). Which measure of centre can be used for colour data?`, a: 'the mode', why: 'Colours are not numbers, so only the mode makes sense.' }; }
    ];
    const c = rc(rng, ctxs)();
    const all = ['the mean', 'the median', 'the mode', 'the range'];
    const ds = all.filter(x => x !== c.a).map(x => ({ text: x, why: x === 'the range' ? 'The range measures spread, not centre.' : `${x[0].toUpperCase()}${x.slice(1)} is not the best choice here: ${c.why}` }));
    return M(rng, c.t, c.a, ds, {
      hints: ['Ask whether any value is far from the others.', 'The mean is pulled by extreme values; the median is not.', 'If the data are categories or counts of a most-common item, think about the mode.', 'The range is a measure of spread.'],
      steps: [['Look at the data', c.why], ['Choose', c.a]],
      audit: { kind: 'measuremc', key: c.a }
    });
  }),

  // Dm4 · D2 · the new median after one more value is added
  V([2], rng => {
    const n = rc(rng, [5, 7, 9]);
    const xs = sortNum(Array.from({ length: n }, () => ri(rng, 10, 90)));
    rej(new Set(xs).size < n);
    const v = ri(rng, 5, 95);
    rej(xs.includes(v));
    const all = sortNum([...xs, v]);
    const m = med(all);
    return N(`The ${n} values ${xs.join(', ')} are in order. A new value, ${v}, is added to the set. What is the new median?`, m, {
      traps: [[med(xs), 'Adding a value changes the count to ' + (n + 1) + ', so the median is now the mean of the two middle values.']],
      hints: ['Insert the new value in its correct place in the ordered list.', `The set now has $${n + 1}$ values, an even number.`, `The median is the mean of the ${(n + 1) / 2}th and ${(n + 1) / 2 + 1}th values.`, 'Add them and halve.'],
      steps: [['New ordered set', `$${all.join(', ')}$`], ['Middle pair', `$${all[(n + 1) / 2 - 1]}$ and $${all[(n + 1) / 2]}$`], ['Median', `$${m}$`]],
      audit: { kind: 'median', xs: [...xs, v], expect: m }
    });
  }),

  // Dm5 · D2 · an outlier appears: which statistic moves?
  V([2], rng => {
    const xs = sortNum(Array.from({ length: 9 }, () => ri(rng, 20, 60)));
    rej(new Set(xs).size < 9);
    const X = ri(rng, 150, 400);
    const ys = [...xs.slice(0, 8), X];
    return N(`Nine ordered values are ${xs.join(', ')}. The largest value, ${xs[8]}, is replaced by an extreme value, ${X}. What is the median of the new set?`, xs[4], {
      traps: [[Math.round(mean(ys) * 100) / 100, 'That is the new mean, which an extreme value changes. The median is the middle value.']],
      hints: ['The median depends on the middle position only.', 'Is the middle (5th) value affected by replacing the largest value?', 'The new value is still the largest, so the order of the others is unchanged.', 'Read the 5th value.'],
      steps: [['New order', `$${sortNum(ys).join(', ')}$`], ['Middle (5th) value', `$${xs[4]}$ is unchanged`]],
      audit: { kind: 'median', xs: ys, expect: xs[4] }
    });
  }),

  // Dm6 · D2 · an unknown value inside an ordered list with a given median
  V([2], rng => {
    const n = rc(rng, [6, 8]);
    const xs = [];
    let v = ri(rng, 3, 20);
    for (let k = 0; k < n; k++) { xs.push(v); v += ri(rng, 2, 7); }
    const lo = n / 2 - 1;            // index of the lower middle value; the upper middle value is the unknown
    const x = xs[lo + 1];
    const m = (xs[lo] + x) / 2;
    const shown = xs.map((val, k) => (k === lo + 1 ? 'x' : val));
    return N(`The ${n} values ${shown.join(', ')} are in order from smallest to largest. Their median is ${m}. Find $x$.`, x, {
      traps: [[m, 'The median is the mean of the two middle values, so it is not equal to the unknown value.'], [m - xs[lo], 'Solve $\\dfrac{' + xs[lo] + ' + x}{2} = ' + m + '$ for $x$.']],
      hints: [`With ${n} values the median is the mean of the ${n / 2}th and ${n / 2 + 1}th values.`, `The ${n / 2}th value is $${xs[lo]}$ and the ${n / 2 + 1}th is $x$.`, `Write $\\dfrac{${xs[lo]} + x}{2} = ${m}$.`, 'Solve the equation for $x$.'],
      steps: [['Middle pair', `$${xs[lo]}$ and $x$`], ['Equation', `$\\dfrac{${xs[lo]} + x}{2} = ${m}$`], ['Solve', `$x = ${2 * m} - ${xs[lo]} = ${x}$`]],
      audit: { kind: 'medianunknown' }
    });
  }),

  // Sd1 · D3 · the variance of a list (variance, not standard deviation)
  V([3], rng => {
    const n = rc(rng, [4, 5, 6]);
    const mu = ri(rng, 8, 40);
    let ds;
    for (let i = 0; i < 200; i++) {
      ds = Array.from({ length: n - 1 }, () => nz(rng, -6, 6));
      ds.push(-ds.reduce((a, b) => a + b, 0));
      const ss = ds.reduce((a, d) => a + d * d, 0);
      if (ss % n === 0 && Math.abs(ds[n - 1]) <= 8 && ss / n > 1 && new Set(ds).size >= n - 1) break;
      ds = null;
    }
    rej(!ds);
    const xs = ds.map(d => mu + d), ss = ds.reduce((a, d) => a + d * d, 0), vr = ss / n;
    rej(vr === mu);
    return N(`A population of ${n} values is ${fmtList(shuffle(rng, xs))}. Find the variance, $\\sigma^2$.`, vr, {
      traps: [[Math.sqrt(vr), 'That is the standard deviation. The question asks for the variance, the average squared distance from the mean.'], [ss, 'Divide the sum of squared deviations by the number of values.']],
      hints: ['First find the mean.', `The mean is $${mu}$.`, 'Square each deviation from the mean and add the squares.', `Divide by $${n}$. Do not take a square root.`],
      steps: [['Mean', `$\\mu = ${mu}$`], ['Deviations squared', `$${ds.map(d => `(${d})^2`).join(' + ')} = ${ss}$`], ['Variance', `$\\sigma^2 = \\dfrac{${ss}}{${n}} = ${vr}$`]],
      audit: { kind: 'variance', xs, expect: vr }
    });
  }),

  // Sd2 · D3 · from the sums: sigma^2 = sum(x^2)/n - mean^2
  V([3, 4], (rng, d) => {
    const n = ri(rng, 5, 25), mu = ri(rng, 4, 30), sd = ri(rng, 2, 9);
    const sx = n * mu, sxx = n * (sd * sd + mu * mu);
    return N(`For a data set of ${n} values, $\\sum x = ${sx}$ and $\\sum x^2 = ${sxx}$. Find the population standard deviation, $\\sigma$.`, sd, {
      traps: [[sd * sd, 'That is the variance. Take the square root.'], [Math.sqrt(sxx / n), 'Subtract the square of the mean before taking the square root: $\\sigma^2 = \\dfrac{\\sum x^2}{n} - \\mu^2$.']],
      hints: [`The mean is $\\dfrac{\\sum x}{n} = \\dfrac{${sx}}{${n}}$.`, `$\\mu = ${mu}$.`, 'Use $\\sigma^2 = \\dfrac{\\sum x^2}{n} - \\mu^2$.', 'Take the square root of the variance.'],
      steps: [['Mean', `$\\mu = ${mu}$`], ['Variance', `$\\sigma^2 = \\dfrac{${sxx}}{${n}} - ${mu}^2 = ${sd * sd}$`], ['Standard deviation', `$\\sigma = ${sd}$`]],
      audit: { kind: 'sdfromsums', n, sx, sxx, expect: sd }
    });
  }),

  // Sd3 · D3, D4 · adding a value equal to the mean changes the variance, but how?
  V([3, 4], (rng, d) => {
    const n = ri(rng, 3, d === 3 ? 7 : 11), t = ri(rng, 1, 6), s = (n + 1) * t;
    const mu = ri(rng, 10, 60);
    const val = (n * s) / (n + 1);
    return N(`${n} values have mean $${mu}$ and variance $${s}$. A new value equal to $${mu}$ is added to the set. What is the new variance?`, val, {
      traps: [[s, 'The sum of squared deviations is unchanged, but it is now divided by one more value.'], [Math.sqrt(val), 'The question asks for the variance.']],
      hints: ['The new value is exactly the mean, so its deviation is $0$.', `The sum of squared deviations before is $${n}\\times ${s}$.`, 'It does not change, because the new deviation squared is $0$.', `Divide by the new count, $${n + 1}$.`],
      steps: [['Sum of squared deviations', `$${n}\\times ${s} = ${n * s}$ (unchanged)`], ['New variance', `$\\dfrac{${n * s}}{${n + 1}} = ${val}$`]],
      audit: { kind: 'addmean', n, s, expect: val }
    });
  }),

  // Sd4 · D3 · which of two sets is more spread out?
  V([3], rng => {
    const mu = ri(rng, 20, 60), dA = ri(rng, 6, 12), dB = ri(rng, 1, 4);
    const A = [mu - dA, mu - ri(rng, 1, 3), mu, mu + ri(rng, 1, 3), mu + dA].sort((p, q) => p - q);
    const B = [mu - dB, mu - 1, mu, mu + 1, mu + dB].sort((p, q) => p - q);
    const sdOf = xs => Math.sqrt(xs.reduce((a, x) => a + (x - mean(xs)) ** 2, 0) / xs.length);
    rej(Math.abs(mean(A) - mean(B)) > 1.5 || sdOf(A) - sdOf(B) < 1);
    const aFirst = rng() < 0.5;
    const L = aFirst ? [A, B] : [B, A];
    const big = aFirst ? 'Set P' : 'Set Q';
    const small = aFirst ? 'Set Q' : 'Set P';
    return M(rng, `Set P is ${fmtList(L[0])}. Set Q is ${fmtList(L[1])}. Without calculating, which set has the larger standard deviation?`, big, [
      { text: small, why: 'The standard deviation measures how far values are from the mean. This set is more tightly clustered.' },
      { text: 'They are equal', why: 'The means are close, but the spread is different: compare how far the end values are from the middle.' },
      { text: 'It depends on the mean', why: 'The standard deviation measures spread, not centre. Compare the distances from the middle.' }
    ], {
      hints: ['The standard deviation measures typical distance from the mean.', 'Both sets are centred around the same value.', 'Compare how far the smallest and largest values are from the middle.', 'The set with values further from the middle has the larger standard deviation.'],
      steps: [['Compare the spread', `Set ${aFirst ? 'P' : 'Q'} ranges over $${Math.max(...A) - Math.min(...A)}$; the other over $${Math.max(...B) - Math.min(...B)}$`], ['Larger standard deviation', big]],
      audit: { kind: 'larger-sd', P: L[0], Q: L[1], expect: aFirst ? 'P' : 'Q' }
    });
  }),

  // Sd5 · D3 · which data set has no spread at all? (a standard deviation of zero)
  V([3], rng => {
    const k = ri(rng, 4, 40), ctx = rc(rng, ['five test marks', 'five heights in centimetres', 'five ticket prices in dollars', 'five times in seconds']);
    const same = Array(5).fill(k);
    const near = [k, k, k, k, k + ri(rng, 1, 3)];
    const ap = [k, k + 1, k + 2, k + 3, k + 4];
    const sym = [k - 2, k - 1, k, k + 1, k + 2];
    return M(rng, `A data set of ${ctx} has a standard deviation of exactly $0$. Which could the data set be?`, `$${same.join(', ')}$`, [
      { text: `$${near.join(', ')}$`, why: 'One value is different, so the values are not all the same distance from the mean: the spread is not zero.' },
      { text: `$${ap.join(', ')}$`, why: 'Evenly spaced values still spread out from their mean.' },
      { text: `$${sym.join(', ')}$`, why: 'The mean is the middle value, but the other values are not at the mean, so the spread is not zero.' }
    ], {
      hints: ['The standard deviation measures how far the values are from the mean.', 'It is zero only if every value is at the mean.', 'That means every value is equal.', 'Choose the set whose values are all the same.'],
      steps: [['Meaning of zero spread', 'Every deviation from the mean is $0$, so all the values are equal.'], ['Answer', `$${same.join(', ')}$`]],
      audit: { kind: 'sdzero', key: same }
    });
  }),

  // Sd6 · D3, D4 · variance and standard deviation after y = ax + b (the shift does nothing, the factor is squared)
  V([3, 4], (rng, d) => {
    const mu = ri(rng, 8, 50), sd = ri(rng, 2, 9);
    const a = d === 3 ? ri(rng, 2, 5) : rc(rng, [-2, -3, -4, 2, 3]), b = nz(rng, -9, 9);
    if (d === 3) {
      return N(`A data set has mean $${mu}$ and standard deviation $${sd}$. Every value $x$ is replaced by $${a}x ${sg(b)}$. What is the variance of the new data?`, a * a * sd * sd, {
        traps: [[a * sd * a * sd + b, 'Adding a constant does not change the spread.'], [a * sd, 'That is the new standard deviation. The variance is its square.']],
        hints: ['Adding a constant shifts every value equally, so it does not change the spread.', `Multiplying every value by $${a}$ multiplies the standard deviation by $${a}$.`, `The new standard deviation is $${a * sd}$.`, 'The variance is the square of the standard deviation.'],
        steps: [['New standard deviation', `$${a}\\times ${sd} = ${a * sd}$`], ['Variance', `$${a * sd}^2 = ${a * a * sd * sd}$`]],
        audit: { kind: 'sdtransform', sd, a, b, ask: 'var', expect: a * a * sd * sd }
      });
    }
    return N(`A data set has mean $${mu}$ and standard deviation $${sd}$. Every value $x$ is replaced by $${a}x ${sg(b)}$. What is the standard deviation of the new data?`, Math.abs(a) * sd, {
      traps: [[a * sd, 'A standard deviation cannot be negative: multiplying by ' + a + ' scales the spread by $|' + a + '|$.'], [a * sd + b, 'Adding a constant does not change the spread, and the factor applies as an absolute value.']],
      hints: ['Adding a constant does not change the spread.', `Multiplying by $${a}$ scales the spread by $|${a}| = ${Math.abs(a)}$.`, 'A spread is never negative.', 'Multiply the original standard deviation by that positive factor.'],
      steps: [['Constant shift', 'No effect on the standard deviation'], ['Scale', `$|${a}|\\times ${sd} = ${Math.abs(a) * sd}$`]],
      audit: { kind: 'sdtransform', sd, a, b, ask: 'sd', expect: Math.abs(a) * sd }
    });
  }),

  // Sd8 · D4 · two groups with the same mean: combine their variances (weighted by size)
  V([4], rng => {
    const n1 = ri(rng, 2, 10), n2 = ri(rng, 2, 10), s1 = ri(rng, 1, 6), s2 = ri(rng, 1, 6), mu = ri(rng, 10, 50);
    rej(s1 === s2 || n1 === n2);
    const tot = n1 * s1 * s1 + n2 * s2 * s2, N2 = n1 + n2;
    rej(!exactTo(tot / N2, 2));
    return N(`Group A has ${n1} values, mean $${mu}$ and standard deviation $${s1}$. Group B has ${n2} values, the same mean $${mu}$, and standard deviation $${s2}$. The groups are combined. What is the variance of the combined ${N2} values?`, tot / N2, {
      traps: [[(s1 * s1 + s2 * s2) / 2, 'The groups have different sizes, so weight each variance by its group size.'], [Math.sqrt(tot / N2), 'The question asks for the variance, not the standard deviation.']],
      hints: ['Because both groups have the same mean, the combined mean is the same.', 'The sum of squared deviations for each group is its size times its variance.', `Add: $${n1}(${s1})^2 + ${n2}(${s2})^2$.`, `Divide by the total count, $${N2}$.`],
      steps: [['Squared deviations', `$${n1}\\times ${s1 * s1} = ${n1 * s1 * s1}$ and $${n2}\\times ${s2 * s2} = ${n2 * s2 * s2}$`], ['Combined variance', `$\\dfrac{${n1 * s1 * s1} + ${n2 * s2 * s2}}{${N2}} = ${tot / N2}$`]],
      audit: { kind: 'combinedvar', n1, n2, s1, s2, expect: tot / N2 }
    });
  }),

  // Sd9 · D4 · choose a and b so that the new data has a target mean and standard deviation
  V([4], rng => {
    const mu = ri(rng, 40, 70), sd = ri(rng, 3, 12), a = rc(rng, [2, 3, 4, 5]), b = nz(rng, -30, 30);
    const mu2 = a * mu + b, sd2 = a * sd;
    return N(`A data set has mean $${mu}$ and standard deviation $${sd}$. Every value $x$ is replaced by $ax + b$, where $a > 0$, so that the new data has mean $${mu2}$ and standard deviation $${sd2}$. Find $b$.`, b, {
      traps: [[mu2 - mu, 'The mean is multiplied by $a$ as well as shifted by $b$.'], [a, 'That is $a$. The question asks for $b$.']],
      hints: ['Only the factor $a$ changes the standard deviation.', `$a = \\dfrac{${sd2}}{${sd}}$.`, 'The new mean is $a\\mu + b$.', 'Solve for $b$.'],
      steps: [['Find a', `$a = ${sd2} \\div ${sd} = ${a}$`], ['New mean', `$${a}(${mu}) + b = ${mu2}$`], ['Solve', `$b = ${mu2} - ${a * mu} = ${b}$`]],
      audit: { kind: 'solveab', mu, sd, mu2, sd2, expect: b }
    });
  }),

  // Sd10 · D4 · the variance from a frequency table
  V([4], rng => {
    const m = ri(rng, 3, 4), vals = Array.from({ length: m }, (_, i) => i + 1), freq = vals.map(() => ri(rng, 1, 6));
    const n = freq.reduce((a, b) => a + b, 0), sx = vals.reduce((a, v, i) => a + v * freq[i], 0), sxx = vals.reduce((a, v, i) => a + v * v * freq[i], 0);
    const num = n * sxx - sx * sx, den = n * n;
    rej(num <= 0 || n < 8 || n > 16 || (num % den === 0 && false));
    return Fr(`The table shows a data set.\n\n$${tbl('Value', vals, freq)}$\n\nFind the population variance as a fraction in simplest form (or a whole number).`, num, den, {
      traps: [[(sxx / n) - (sx / n), 'Square the mean: $\\sigma^2 = \\dfrac{\\sum fx^2}{\\sum f} - \\mu^2$.'], [sxx / n, 'Subtract the square of the mean.']],
      hints: ['Use $\\sigma^2 = \\dfrac{\\sum fx^2}{\\sum f} - \\mu^2$.', `Find $\\sum f$, $\\sum fx$ and $\\sum fx^2$ from the table.`, `$\\sum f = ${n}$, $\\sum fx = ${sx}$, $\\sum fx^2 = ${sxx}$.`, 'Substitute and simplify.'],
      steps: [['Totals', `$\\sum f = ${n}$, $\\sum fx = ${sx}$, $\\sum fx^2 = ${sxx}$`], ['Variance', `$\\sigma^2 = \\dfrac{${sxx}}{${n}} - \\left(\\dfrac{${sx}}{${n}}\\right)^2 = ${fr(num, den)}$`]],
      audit: { kind: 'freqvariance', vals, freq, expect: num / den }
    });
  })
];

export const forms = { 'y11-transform': transform, 'y11-functions-more': functions, 'y11-data-sets': data };
