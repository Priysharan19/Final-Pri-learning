// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Step diagnosis
//
// Step Check finds the line where a student's working stops being true. That is
// the easy half. This module does the other half: it names the mistake.
//
// "There's a slip in your working" is what every marking app says. It is also
// the least useful thing that can be said, because the student already knows
// something went wrong — what they cannot see is *which* move they made. A
// student who wrote `2x = 12 − 4` as `2x = 12 + 4` did not make a random error;
// they made one of about twenty moves that school algebra students make, and
// each of those moves has a name, a reason and a fix.
//
// The method is hypothesis-and-test, not pattern-matching on text:
//
//   1. Take the last line that was still true (A) and the line that broke (B).
//   2. Apply every known *mis*-step to A — forget to distribute, keep the sign
//      when moving a term, square a sum term by term, add fractions across —
//      each producing a wrong line the student *might* have written.
//   3. Whichever hypothesis is mathematically the same claim as B is what the
//      student actually did. Equivalence is decided by sampling, so it holds
//      however the student wrote it down.
//   4. Failing that, fall back to a structural diff (one number changed, one
//      operator changed) and then to a concrete counterexample — the value that
//      satisfies the line above and not this one.
//
// Everything here is deterministic, runs on-device in under a millisecond, and
// needs no model and no network. A diagnosis is only ever returned when a
// hypothesis actually reproduces the student's line; nothing is guessed.
// ─────────────────────────────────────────────────────────────────────────────
import { parse, evaluate, exprEquivalent, variablesOf, normalize, numsClose } from './expr.js';

const PREC = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 4 };
const KIDS = { bin: ['l', 'r'], equation: ['l', 'r'], group: ['v'], neg: ['v'], call: ['arg'] };

// ── Tree utilities ───────────────────────────────────────────────────────────

const clone = n => (n && typeof n === 'object' ? JSON.parse(JSON.stringify(n)) : n);

/** Peel redundant parentheses markers — precedence already lives in the shape. */
function bare(n) {
  let cur = n;
  while (cur && cur.t === 'group') cur = cur.v;
  return cur;
}

/** Strip every group marker, for diffing and evaluation-shape comparison. */
function stripAll(n) {
  if (!n || typeof n !== 'object') return n;
  const cur = bare(n);
  if (!cur || typeof cur !== 'object') return cur;
  const out = { ...cur };
  for (const k of KIDS[cur.t] || []) out[k] = stripAll(cur[k]);
  return out;
}

function allPaths(ast, base = [], out = []) {
  if (!ast || typeof ast !== 'object') return out;
  out.push(base);
  for (const k of KIDS[ast.t] || []) allPaths(ast[k], [...base, k], out);
  return out;
}

function nodeAt(ast, path) {
  let n = ast;
  for (const k of path) n = n[k];
  return n;
}

function replaceAt(ast, path, node) {
  if (!path.length) return node;
  const [k, ...rest] = path;
  return { ...ast, [k]: replaceAt(ast[k], rest, node) };
}

/** Flatten a node into signed additive terms, descending through +, − and (). */
function sumTerms(node, sign = 1, acc = []) {
  const n = bare(node);
  if (!n) return acc;
  if (n.t === 'bin' && (n.op === '+' || n.op === '-')) {
    sumTerms(n.l, sign, acc);
    sumTerms(n.r, n.op === '+' ? sign : -sign, acc);
    return acc;
  }
  if (n.t === 'neg') return sumTerms(n.v, -sign, acc);
  acc.push({ sign, node: n });
  return acc;
}

function fromTerms(list) {
  if (!list.length) return { t: 'num', v: 0 };
  let acc = list[0].sign < 0 ? { t: 'neg', v: clone(list[0].node) } : clone(list[0].node);
  for (let i = 1; i < list.length; i++) {
    acc = { t: 'bin', op: list[i].sign < 0 ? '-' : '+', l: acc, r: clone(list[i].node) };
  }
  return acc;
}

// ── Rendering — AST back to something a student recognises ───────────────────

function fmtNum(v) {
  if (!Number.isFinite(v)) return String(v);
  if (Number.isInteger(v)) return String(v);
  const s = Number(v.toPrecision(6)).toString();
  return s;
}

const SYMBOL = { pi: 'π', theta: 'θ', alpha: 'α', beta: 'β' };

export function render(node) {
  const n = bare(node);
  if (!n) return '';
  switch (n.t) {
    case 'num': return fmtNum(n.v);
    case 'var':
    case 'const': return SYMBOL[n.v] || n.v;
    case 'neg': return `−${sub(n.v, 2)}`;
    case 'call': return `${n.fn}(${render(n.arg)})`;
    case 'equation': return `${render(n.l)} = ${render(n.r)}`;
    case 'bin': return renderBin(n);
    default: return '';
  }
}

function precOf(node) {
  const n = bare(node);
  if (!n) return 99;
  if (n.t === 'bin') return PREC[n.op] ?? 99;
  if (n.t === 'neg') return 1.5;
  return 99;
}

function sub(node, minPrec) {
  return precOf(node) < minPrec ? `(${render(node)})` : render(node);
}

function renderBin(n) {
  const p = PREC[n.op];
  const l = sub(n.l, p);
  // right operand of − and / needs a parenthesis at equal precedence
  const r = sub(n.r, n.op === '-' || n.op === '/' ? p + 1 : p);
  if (n.op === '*') {
    const rb = bare(n.r);
    const lb = bare(n.l);
    const implicit = lb.t === 'num' && (rb.t === 'var' || rb.t === 'const' || rb.t === 'call'
      || (rb.t === 'bin' && PREC[rb.op] < 2));
    if (implicit) return `${l}${rb.t === 'bin' ? `(${render(rb)})` : r}`;
    return `${l} × ${r}`;
  }
  if (n.op === '+') return `${l} + ${r}`;
  if (n.op === '-') return `${l} − ${r}`;
  if (n.op === '/') return `${l}/${r}`;
  return `${l}^${r}`;
}

function renderTerm(t) {
  return t.sign < 0 ? `−${sub(t.node, 2)}` : render(t.node);
}

// ── Sampling: is this the same mathematical claim? ───────────────────────────

const SAMPLES = [0.73, 1.31, -0.64, 2.17, -1.72, 0.37, 3.08, -2.29, 1.91, -0.91];

function envsFor(names, count = 8) {
  const out = [];
  for (let s = 0; s < count; s++) {
    const env = {};
    names.forEach((n, i) => { env[n] = SAMPLES[(s + i * 3) % SAMPLES.length]; });
    out.push(env);
  }
  return out;
}

function diffNode(eq) {
  return { t: 'bin', op: '-', l: eq.l, r: eq.r };
}

/** Two equations are the same claim if their (lhs − rhs) agree up to a scale. */
function sameEquation(a, b) {
  const da = diffNode(a);
  const db = diffNode(b);
  if (exprEquivalent(da, db)) return true;
  const names = [...new Set([...variablesOf(da), ...variablesOf(db)])];
  let ratio = null;
  let seen = 0;
  for (const env of envsFor(names, 10)) {
    const va = evaluate(da, env);
    const vb = evaluate(db, env);
    if (!Number.isFinite(va) || !Number.isFinite(vb)) continue;
    if (Math.abs(vb) < 1e-9) { if (Math.abs(va) > 1e-7) return false; continue; }
    const r = va / vb;
    if (Math.abs(r) < 1e-9) return false;
    if (ratio === null) ratio = r;
    else if (Math.abs(r - ratio) > 1e-6 * Math.max(1, Math.abs(ratio))) return false;
    seen++;
  }
  return seen >= 3 && ratio !== null;
}

function sameClaim(a, b) {
  if (!a || !b) return false;
  const isEqA = a.t === 'equation';
  const isEqB = b.t === 'equation';
  if (isEqA !== isEqB) return false;
  return isEqA ? sameEquation(a, b) : exprEquivalent(a, b);
}

/** The constant factor taking `a` to `b`, or null when there isn't one. */
function constantFactor(a, b) {
  const names = [...new Set([...variablesOf(a), ...variablesOf(b)])];
  let k = null;
  let seen = 0;
  for (const env of envsFor(names, 10)) {
    const va = evaluate(a, env);
    const vb = evaluate(b, env);
    if (!Number.isFinite(va) || !Number.isFinite(vb) || Math.abs(vb) < 1e-9) continue;
    const r = va / vb;
    if (!Number.isFinite(r) || Math.abs(r) < 1e-9) return null;
    if (k === null) k = r;
    else if (Math.abs(r - k) > 1e-6 * Math.max(1, Math.abs(k))) return null;
    seen++;
  }
  return seen >= 3 ? k : null;
}

/** The constant `b − a`, or null. */
function constantOffset(a, b) {
  const names = [...new Set([...variablesOf(a), ...variablesOf(b)])];
  let d = null;
  let seen = 0;
  for (const env of envsFor(names, 10)) {
    const va = evaluate(a, env);
    const vb = evaluate(b, env);
    if (!Number.isFinite(va) || !Number.isFinite(vb)) continue;
    const delta = vb - va;
    if (d === null) d = delta;
    else if (Math.abs(delta - d) > 1e-6 * Math.max(1, Math.abs(d))) return null;
    seen++;
  }
  return seen >= 3 && Math.abs(d) > 1e-9 ? d : null;
}

// ── The misstep catalogue ────────────────────────────────────────────────────
// Every entry models one thing a student actually does. `apply` turns a true
// line into the wrong line that mistake would produce; if that reproduces what
// they wrote, we know what they did.

/** Hypotheses reachable by rewriting one subtree of `A`. */
function subtreeHypotheses(A) {
  const out = [];
  const push = (code, path, node, detail) => {
    if (!node) return;
    out.push({ code, ast: replaceAt(A, path, node), detail: detail || {} });
  };

  for (const path of allPaths(A)) {
    const raw = nodeAt(A, path);
    const n = bare(raw);
    if (!n || typeof n !== 'object') continue;

    // k(u + v) → ku + v : the bracket was opened onto the first term only.
    if (n.t === 'bin' && n.op === '*') {
      for (const [kSide, gSide] of [['l', 'r'], ['r', 'l']]) {
        const k = n[kSide];
        const terms = sumTerms(n[gSide]);
        if (terms.length < 2) continue;
        const first = { t: 'bin', op: '*', l: clone(k), r: clone(terms[0].node) };
        const head = terms[0].sign < 0 ? { t: 'neg', v: first } : first;
        let acc = head;
        for (let i = 1; i < terms.length; i++) {
          acc = { t: 'bin', op: terms[i].sign < 0 ? '-' : '+', l: acc, r: clone(terms[i].node) };
        }
        push('distribute-partial', path, acc, { factor: render(k), bracket: render(n[gSide]), correct: render({ t: 'bin', op: '*', l: clone(k), r: { t: 'group', v: clone(bare(n[gSide])) } }) });
      }
    }

    // a − (u + v) → a − u + v : the minus reached the first term only.
    if (n.t === 'bin' && n.op === '-') {
      const terms = sumTerms(n.r);
      if (terms.length >= 2) {
        let acc = { t: 'bin', op: terms[0].sign < 0 ? '+' : '-', l: clone(n.l), r: clone(terms[0].node) };
        for (let i = 1; i < terms.length; i++) {
          acc = { t: 'bin', op: terms[i].sign < 0 ? '-' : '+', l: acc, r: clone(terms[i].node) };
        }
        push('distribute-sign', path, acc, { bracket: render(n.r) });
      }
    }

    // −(u + v) → −u + v
    if (raw && raw.t === 'neg') {
      const terms = sumTerms(raw.v);
      if (terms.length >= 2) {
        let acc = terms[0].sign < 0 ? clone(terms[0].node) : { t: 'neg', v: clone(terms[0].node) };
        for (let i = 1; i < terms.length; i++) {
          acc = { t: 'bin', op: terms[i].sign < 0 ? '-' : '+', l: acc, r: clone(terms[i].node) };
        }
        push('distribute-sign', path, acc, { bracket: render(raw.v) });
      }
    }

    if (n.t === 'bin' && n.op === '^') {
      const base = bare(n.l);
      const terms = sumTerms(n.l);
      // (u + v)^n → u^n + v^n
      if (terms.length >= 2) {
        const powered = terms.map(t => ({ sign: t.sign, node: { t: 'bin', op: '^', l: { t: 'group', v: clone(t.node) }, r: clone(n.r) } }));
        push('power-of-sum', path, fromTerms(powered), { sum: render(n.l), power: render(n.r) });
      }
      // (−u)^2 → −u^2
      if (base.t === 'neg') {
        push('negative-squared', path, { t: 'neg', v: { t: 'bin', op: '^', l: clone(base.v), r: clone(n.r) } }, { base: render(base), power: render(n.r) });
      }
      // (x^a)^b → x^(a+b)
      if (base.t === 'bin' && base.op === '^') {
        push('power-of-power', path, { t: 'bin', op: '^', l: clone(base.l), r: { t: 'bin', op: '+', l: clone(base.r), r: clone(n.r) } },
          { inner: render(base.r), outer: render(n.r), base: render(base.l) });
      }
    }

    // sqrt(u + v) → sqrt(u) + sqrt(v)
    if (n.t === 'call' && (n.fn === 'sqrt' || n.fn === 'ln' || n.fn === 'log')) {
      const terms = sumTerms(n.arg);
      if (terms.length >= 2) {
        const split = terms.map(t => ({ sign: t.sign, node: { t: 'call', fn: n.fn, arg: { t: 'group', v: clone(t.node) } } }));
        push('function-of-sum', path, fromTerms(split), { fn: n.fn, arg: render(n.arg) });
      }
    }

    // x^a · x^b → x^(ab)
    if (n.t === 'bin' && (n.op === '*' || n.op === '/')) {
      const L = bare(n.l);
      const R = bare(n.r);
      if (L.t === 'bin' && L.op === '^' && R.t === 'bin' && R.op === '^'
        && render(L.l) === render(R.l)) {
        push('power-product', path, { t: 'bin', op: '^', l: clone(L.l), r: { t: 'bin', op: n.op, l: clone(L.r), r: clone(R.r) } },
          { base: render(L.l), a: render(L.r), b: render(R.r), op: n.op });
      }
    }

    // a/b ± c/d → (a ± c)/(b ± d)
    if (n.t === 'bin' && (n.op === '+' || n.op === '-')) {
      const L = bare(n.l);
      const R = bare(n.r);
      if (L.t === 'bin' && L.op === '/' && R.t === 'bin' && R.op === '/') {
        push('fraction-across', path, {
          t: 'bin', op: '/',
          l: { t: 'group', v: { t: 'bin', op: n.op, l: clone(L.l), r: clone(R.l) } },
          r: { t: 'group', v: { t: 'bin', op: n.op, l: clone(L.r), r: clone(R.r) } }
        }, { left: render(L), right: render(R) });
      }
    }

    // (u + v)/w → u/w + v  and  → u + v/w : cancelled with one term only.
    if (n.t === 'bin' && n.op === '/') {
      const terms = sumTerms(n.l);
      if (terms.length >= 2) {
        const keepFirst = terms.map((t, i) => ({ sign: t.sign, node: i === 0 ? { t: 'bin', op: '/', l: clone(t.node), r: clone(n.r) } : clone(t.node) }));
        push('cancel-over-sum', path, fromTerms(keepFirst), { top: render(n.l), bottom: render(n.r) });
        const keepLast = terms.map((t, i) => ({ sign: t.sign, node: i === terms.length - 1 ? { t: 'bin', op: '/', l: clone(t.node), r: clone(n.r) } : clone(t.node) }));
        push('cancel-over-sum', path, fromTerms(keepLast), { top: render(n.l), bottom: render(n.r) });
      }
      // a/b → b/a
      push('reciprocal-flip', path, { t: 'bin', op: '/', l: clone(n.r), r: clone(n.l) }, { top: render(n.l), bottom: render(n.r) });
    }

    // One term of a sum dropped, or one term's sign flipped.
    if (n.t === 'bin' && (n.op === '+' || n.op === '-')) {
      const terms = sumTerms(n);
      if (terms.length >= 2) {
        for (let i = 0; i < terms.length; i++) {
          const without = terms.filter((_, k) => k !== i);
          if (without.length) push('term-dropped', path, fromTerms(without), { term: renderTerm(terms[i]) });
          const flipped = terms.map((t, k) => (k === i ? { sign: -t.sign, node: t.node } : t));
          push('sign-flipped', path, fromTerms(flipped), { term: renderTerm(terms[i]) });
        }
      }
    }

    // An operator swapped for its neighbour.
    if (n.t === 'bin' && PREC[n.op] !== undefined) {
      const swaps = { '*': ['/'], '/': ['*'], '^': ['*'] };
      for (const op of swaps[n.op] || []) {
        push('operator-swapped', path, { t: 'bin', op, l: clone(n.l), r: clone(n.r) }, { from: n.op, to: op, left: render(n.l), right: render(n.r) });
      }
    }
  }
  return out;
}

/** Hypotheses that only make sense across an equals sign. */
function equationHypotheses(A) {
  if (A.t !== 'equation') return [];
  const out = [];
  const L = sumTerms(A.l);
  const R = sumTerms(A.r);

  const transfer = (from, to, fromKey) => {
    if (from.length < 2) return;
    for (let i = 0; i < from.length; i++) {
      const rest = from.filter((_, k) => k !== i);
      const grown = [...to, { sign: from[i].sign, node: from[i].node }];
      const eq = fromKey === 'l'
        ? { t: 'equation', l: fromTerms(rest), r: fromTerms(grown) }
        : { t: 'equation', l: fromTerms(grown), r: fromTerms(rest) };
      out.push({
        code: 'sign-on-transfer', ast: eq,
        detail: { term: renderTerm(from[i]), side: fromKey === 'l' ? 'left' : 'right', correct: renderTerm({ sign: -from[i].sign, node: from[i].node }) }
      });
    }
  };
  transfer(L, R, 'l');
  transfer(R, L, 'r');

  // The whole of one side negated, the other left alone.
  out.push({ code: 'sign-flipped', ast: { t: 'equation', l: { t: 'neg', v: clone(A.l) }, r: clone(A.r) }, detail: { term: render(A.l) } });
  out.push({ code: 'sign-flipped', ast: { t: 'equation', l: clone(A.l), r: { t: 'neg', v: clone(A.r) } }, detail: { term: render(A.r) } });

  return out;
}

// ── Message copy ─────────────────────────────────────────────────────────────

const COPY = {
  'sign-on-transfer': d => ({
    title: 'A term crossed the equals sign without changing sign',
    message: `${d.term} moved to the other side but kept its sign. Crossing the = flips it: it should arrive as ${d.correct}.`,
    fix: 'Moving a term across the equals sign is really subtracting it from both sides, so its sign flips.'
  }),
  'distribute-partial': d => ({
    title: 'The bracket was only partly expanded',
    message: `${d.factor} multiplied the first term inside ${d.bracket} but not the rest. ${d.correct} expands to every term.`,
    fix: 'Everything inside the bracket gets multiplied — a(b + c) = ab + ac.'
  }),
  'distribute-sign': d => ({
    title: 'The minus sign reached only the first term',
    message: `Subtracting ${d.bracket} subtracts every term in it, not just the first one.`,
    fix: 'a − (b + c) = a − b − c. The minus applies to the whole bracket.'
  }),
  'power-of-sum': d => ({
    title: 'A sum was squared term by term',
    message: `(${d.sum})^${d.power} is not each term raised to ${d.power} — expanding the bracket leaves a cross term behind.`,
    fix: '(a + b)² = a² + 2ab + b². The 2ab is the part that goes missing.'
  }),
  'negative-squared': d => ({
    title: 'A negative lost its bracket under the power',
    message: `${d.base} raised to ${d.power} keeps the bracket: the sign is inside the power, so the result is positive.`,
    fix: '(−a)² = a², but −a² is the negative of a². The bracket is what decides.'
  }),
  'power-of-power': d => ({
    title: 'Powers of a power were added instead of multiplied',
    message: `Raising ${d.base}^${d.inner} to the power ${d.outer} multiplies the indices, it does not add them.`,
    fix: '(xᵃ)ᵇ = xᵃᵇ — multiply. xᵃ · xᵇ = xᵃ⁺ᵇ — add. It is easy to swap these two.'
  }),
  'power-product': d => ({
    title: 'Index law applied the wrong way round',
    message: `${d.base}^${d.a} ${d.op === '*' ? '×' : '÷'} ${d.base}^${d.b} ${d.op === '*' ? 'adds' : 'subtracts'} the indices — they were ${d.op === '*' ? 'multiplied' : 'divided'} instead.`,
    fix: 'Same base: multiply → add the indices, divide → subtract them.'
  }),
  'function-of-sum': d => ({
    title: `${d.fn} was split across a sum`,
    message: `${d.fn}(${d.arg}) cannot be broken into ${d.fn} of each term — the sum has to be worked out first.`,
    fix: 'Only multiplication passes through these: √(ab) = √a·√b, but √(a + b) ≠ √a + √b.'
  }),
  'fraction-across': d => ({
    title: 'Fractions added straight across',
    message: `${d.left} and ${d.right} were combined by adding tops and bottoms. Fractions need a common denominator first.`,
    fix: 'a/b + c/d = (ad + bc)/(bd). Adding the denominators is never a step.'
  }),
  'cancel-over-sum': d => ({
    title: 'Cancelled with one term of the top only',
    message: `In (${d.top})/${d.bottom} the ${d.bottom} divides the whole numerator, so it cannot be cancelled against a single term.`,
    fix: 'Factorise the numerator first — you can only cancel a factor of the whole top, never a term of a sum.'
  }),
  'reciprocal-flip': d => ({
    title: 'A fraction was turned upside down',
    message: `${d.top}/${d.bottom} became ${d.bottom}/${d.top}.`,
    fix: 'Dividing by a fraction flips the fraction you are dividing by — not the one you are dividing.'
  }),
  'term-dropped': d => ({
    title: 'A term went missing',
    message: `${d.term} is in the line above and not in this one. Everything else matches, so it looks like it was lost in the copy.`,
    fix: 'Rewrite the whole line before changing it — dropped terms almost always happen while re-copying.'
  }),
  'sign-flipped': d => ({
    title: 'A sign changed on its own',
    message: `${d.term} changed sign between these two lines with nothing done to it.`,
    fix: 'A sign only changes when something is done to both sides, or a bracket is expanded.'
  }),
  'operator-swapped': d => ({
    title: 'The wrong operation between two terms',
    message: d.left && d.right
      ? `The line above has ${d.left} ${opName(d.from)} ${d.right}; this line has ${opName(d.to)}.`
      : `The line above has ${opName(d.from)} where this line has ${opName(d.to)}.`,
    fix: 'Re-read the line above before rewriting it.'
  }),
  'one-side-only': d => ({
    title: 'Only one side of the equation was changed',
    message: `The ${d.side} side ${d.action}, but the ${d.other} side was left as it was.${d.should || ''}`,
    fix: 'An equation stays true only if both sides get the same treatment.'
  }),
  'sides-mismatched': d => ({
    title: 'The two sides were not treated the same way',
    message: `The left side ${d.left} but the right side ${d.right}.${d.should || ''}`,
    fix: 'Whatever you do to one side of an equation has to happen to the other, exactly.'
  }),
  'arithmetic-slip': d => ({
    title: 'The method is right — the arithmetic is not',
    message: `This line is the line above with ${d.from} in place of ${d.to}. Everything around it is correct.`,
    fix: 'Check that one calculation and carry the rest of the working forward.'
  }),
  'variable-swapped': d => ({
    title: 'A different letter appeared',
    message: `${d.from} in the line above is written as ${d.to} here.`,
    fix: 'Keep the same letter throughout unless you say what you are substituting.'
  }),
  'lost-root': d => ({
    title: 'One of the solutions was lost',
    message: `This line is true for ${d.variable} = ${d.kept}, but ${d.variable} = ${d.lost} also solves the original and does not satisfy it.`,
    fix: 'Taking a square root gives two branches: x² = k means x = ±√k.'
  }),
  'divided-by-variable': d => ({
    title: `Both sides were divided by ${d.variable}`,
    message: `Dividing by ${d.variable} throws away the solution ${d.variable} = 0, which the original equation has.`,
    fix: 'Take the common factor out and set each factor to zero instead of dividing by the variable.'
  }),
  'counterexample': d => ({
    title: 'This line is no longer true',
    message: d.text,
    fix: 'Compare it term by term with the line above — the change between them is where to look.'
  })
};

function opName(op) {
  return op === '+' ? '+' : op === '-' ? '−' : op === '*' ? '×' : op === '/' ? '÷' : '^';
}

export const DIAGNOSIS_CODES = Object.keys(COPY);

function build(code, detail, confidence) {
  const copy = COPY[code];
  if (!copy) return null;
  const c = copy(detail || {});
  return { code, title: c.title, message: c.message, fix: c.fix, confidence, detail: detail || {} };
}

// ── Structural diff — one leaf changed, everything else identical ────────────

function structDiff(a, b, path = [], out = []) {
  if (!a || !b || a.t !== b.t) { out.push({ kind: 'shape', path }); return out; }
  switch (a.t) {
    case 'num': if (!numsClose(a.v, b.v, 1e-9)) out.push({ kind: 'num', path, from: a.v, to: b.v }); break;
    case 'var':
    case 'const': if (a.v !== b.v) out.push({ kind: 'name', path, from: a.v, to: b.v }); break;
    case 'bin':
      if (a.op !== b.op) out.push({ kind: 'op', path, from: a.op, to: b.op });
      structDiff(a.l, b.l, [...path, 'l'], out);
      structDiff(a.r, b.r, [...path, 'r'], out);
      break;
    case 'call':
      if (a.fn !== b.fn) out.push({ kind: 'fn', path, from: a.fn, to: b.fn });
      structDiff(a.arg, b.arg, [...path, 'arg'], out);
      break;
    case 'neg': structDiff(a.v, b.v, [...path, 'v'], out); break;
    case 'equation':
      structDiff(a.l, b.l, [...path, 'l'], out);
      structDiff(a.r, b.r, [...path, 'r'], out);
      break;
    default: break;
  }
  return out;
}

function singleEditDiagnosis(A, B) {
  const diffs = structDiff(stripAll(A), stripAll(B));
  if (diffs.length !== 1) return null;
  const d = diffs[0];
  if (d.kind === 'num') return build('arithmetic-slip', { from: fmtNum(d.from), to: fmtNum(d.to) }, 'high');
  if (d.kind === 'op') return build('operator-swapped', { from: d.from, to: d.to, left: '', right: '' }, 'medium');
  if (d.kind === 'name') return build('variable-swapped', { from: SYMBOL[d.from] || d.from, to: SYMBOL[d.to] || d.to }, 'high');
  return null;
}

// ── Equation-level analysis ─────────────────────────────────────────────────

/** How round a number is: 0 for a whole number, then one per decimal place. */
function niceness(v) {
  const r = Number(Math.abs(v).toPrecision(10));
  if (Number.isInteger(r)) return 0;
  for (let d = 1; d <= 4; d++) if (Math.abs(r - Number(r.toFixed(d))) < 1e-12) return d;
  return 9;
}

/**
 * How one side of an equation changed: unchanged, scaled by a constant, or
 * shifted by one. A side carrying no letters is ambiguous — 31 becoming 24 is
 * equally "minus 7" and "divided by 1.29" — so where both readings exist the
 * rounder number wins, which is nearly always the move the student made.
 */
function describeChange(before, after) {
  if (exprEquivalent(before, after)) return { kind: 'same' };
  const k = constantFactor(before, after);
  const d = constantOffset(before, after);
  const scaled = k !== null && Math.abs(k - 1) > 1e-9 ? { kind: 'scaled', k } : null;
  const shifted = d !== null ? { kind: 'shifted', d } : null;
  if (scaled && shifted) {
    const scaleNum = Math.abs(k) >= 1 ? k : 1 / k;
    return niceness(shifted.d) <= niceness(scaleNum) ? shifted : scaled;
  }
  return scaled || shifted;
}

function sameAction(a, b) {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'same') return true;
  if (a.kind === 'scaled') return Math.abs(a.k - b.k) <= 1e-6 * Math.max(1, Math.abs(a.k));
  return Math.abs(a.d - b.d) <= 1e-6 * Math.max(1, Math.abs(a.d));
}

/** A full predicate, so the sentence around it reads as English. */
function actionText(c) {
  if (c.kind === 'same') return 'was left as it was';
  if (c.kind === 'scaled') {
    return Math.abs(c.k) >= 1 ? `was divided by ${fmtNum(c.k)}` : `was multiplied by ${fmtNum(1 / c.k)}`;
  }
  return c.d > 0 ? `had ${fmtNum(c.d)} added` : `had ${fmtNum(-c.d)} taken off`;
}

/** Apply a described change to a node and read off the number, when there is one. */
function applyChange(node, c) {
  try {
    let out;
    if (c.kind === 'same') out = clone(node);
    else if (c.kind === 'scaled') out = { t: 'bin', op: '/', l: clone(node), r: { t: 'num', v: c.k } };
    else out = { t: 'bin', op: '+', l: clone(node), r: { t: 'num', v: c.d } };
    if (variablesOf(out).size) return null;
    const v = evaluate(out, {});
    return Number.isFinite(v) ? fmtNum(Number(v.toPrecision(10))) : null;
  } catch { return null; }
}

/**
 * What happened to each side of the equation, and whether the two agree. An
 * equation survives only what is done to both halves of it, so two different
 * answers here *is* the mistake — and naming both of them tells the student
 * which half to trust.
 */
function sideAnalysis(A, B) {
  if (A.t !== 'equation' || B.t !== 'equation') return null;
  const dl = describeChange(A.l, B.l);
  const dr = describeChange(A.r, B.r);
  // One side left exactly as it was is the whole diagnosis, even when what
  // happened to the other side is too tangled to put a number on.
  if (dl && dl.kind === 'same' && !dr) return build('one-side-only', { side: 'right', other: 'left', action: 'was changed', should: '' }, 'high');
  if (dr && dr.kind === 'same' && !dl) return build('one-side-only', { side: 'left', other: 'right', action: 'was changed', should: '' }, 'high');
  if (!dl || !dr) return null;
  if (sameAction(dl, dr)) return null;                    // consistent: not the fault

  if (dl.kind === 'same' || dr.kind === 'same') {
    const changed = dl.kind === 'same' ? 'right' : 'left';
    const other = changed === 'left' ? 'right' : 'left';
    const c = changed === 'left' ? dl : dr;
    const should = applyChange(changed === 'left' ? A.r : A.l, c);
    return build('one-side-only', {
      side: changed, other, action: actionText(c),
      should: should === null ? '' : ` The ${other} side should then read ${should}.`
    }, 'high');
  }
  const should = applyChange(A.r, dl);
  return build('sides-mismatched', {
    left: actionText(dl), right: actionText(dr),
    should: should === null ? '' : ` If the left side is what you meant, the right side should read ${should}.`
  }, 'high');
}

/** Every path in `ast` that lands on a numeric literal. */
function numPaths(ast) {
  return allPaths(ast).filter(p => nodeAt(ast, p).t === 'num');
}

/** Follow a path down the +/− spine to the whole term the leaf sits inside. */
function termNodeFor(root, path) {
  let node = root;
  for (let i = 0; i < path.length; i++) {
    const onSpine = node.t === 'equation' || node.t === 'group' || node.t === 'neg'
      || (node.t === 'bin' && (node.op === '+' || node.op === '-'));
    if (!onSpine) break;
    node = node[path[i]];
  }
  return node;
}

/** Every top-level term of a line, as text. */
function termStrings(ast) {
  const sides = ast.t === 'equation' ? [ast.l, ast.r] : [ast];
  return sides.flatMap(side => sumTerms(side).map(t => render(t.node)));
}

/**
 * The method held and one number did not. Every numeric literal in the broken
 * line is solved for the value that would have made the line true; a single
 * clean answer means the student's working is sound apart from one calculation,
 * which is worth saying out loud — it is the difference between "you cannot do
 * this" and "check that subtraction".
 */
function numericSlip(A, B, meta) {
  const residualAt = (ast, roots, envs) => {
    if (ast.t === 'equation') {
      const d = diffNode(ast);
      return roots.map(env => evaluate(d, env));
    }
    return envs.map(env => evaluate(ast, env) - evaluate(A, env));
  };

  let roots = [];
  let envs = [];
  if (B.t === 'equation') {
    const name = meta?.variable || [...variablesOf(A)][0] || [...variablesOf(B)][0];
    const sols = Array.isArray(meta?.solutions) && meta.solutions.length
      ? meta.solutions
      : (name ? rootsOf(diffNode(A), name) : []);
    if (!name || !sols.length) return null;
    roots = sols.map(v => ({ [name]: v }));
  } else {
    const names = [...new Set([...variablesOf(A), ...variablesOf(B)])];
    envs = envsFor(names, 4);
  }

  // A term that came through from the line above untouched is not where the
  // slip is — the student copied it, they did not calculate it. Ruling those
  // out is what turns "one of these two numbers is wrong" into an answer.
  const carried = new Set(termStrings(A));
  const candidates = [];
  for (const path of numPaths(B)) {
    if (carried.has(render(termNodeFor(B, path)))) continue;
    const original = nodeAt(B, path).v;
    const f = t => {
      const probe = replaceAt(B, path, { t: 'num', v: t });
      const vals = residualAt(probe, roots, envs);
      return vals.every(Number.isFinite) ? vals.reduce((a, b) => a + b, 0) : NaN;
    };
    const t0 = original;
    const t1 = original + 1;
    const f0 = f(t0);
    const f1 = f(t1);
    if (!Number.isFinite(f0) || !Number.isFinite(f1) || Math.abs(f1 - f0) < 1e-12) continue;
    let t = t0 - f0 * (t1 - t0) / (f1 - f0);
    if (!Number.isFinite(t)) continue;
    t = Number(t.toPrecision(10));
    if (Math.abs(t - original) < 1e-9) continue;
    const fixed = replaceAt(B, path, { t: 'num', v: t });
    const vals = residualAt(fixed, roots, envs);
    const holds = vals.every(v => Number.isFinite(v) && Math.abs(v) <= 1e-6 * Math.max(1, Math.abs(t)));
    if (!holds) continue;
    candidates.push({ from: original, to: t, score: niceness(t) });
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => a.score - b.score);
  if (candidates.length > 1 && candidates[1].score === candidates[0].score) return null;  // ambiguous
  const best = candidates[0];
  return build('arithmetic-slip', { from: fmtNum(best.from), to: fmtNum(best.to) }, 'high');
}

/**
 * Real roots of a single-variable expression, by scan and bisection. Two passes:
 * a fine one over the range most school answers land in, then a coarse one wide
 * enough for the ones that do not. A single narrow scan silently returned "no
 * roots" for any equation whose answer was past 30, and no roots means no
 * diagnosis — the failure was invisible because it looked like caution.
 */
function rootsOf(ast, name) {
  const found = scanRoots(ast, name, -40, 40, 0.25);
  return found.length ? found : scanRoots(ast, name, -2000, 2000, 2);
}

function scanRoots(ast, name, LO, HI, STEP) {
  const f = x => {
    const v = evaluate(ast, { [name]: x });
    return Number.isFinite(v) ? v : NaN;
  };
  const out = [];
  let prevX = LO;
  let prevY = f(LO);
  for (let x = LO + STEP; x <= HI + 1e-9; x += STEP) {
    const y = f(x);
    if (Number.isFinite(prevY) && Math.abs(prevY) < 1e-12) out.push(Number(prevX.toPrecision(10)));
    if (Number.isFinite(y) && Number.isFinite(prevY) && prevY * y < 0) {
      let lo = prevX;
      let hi = x;
      for (let i = 0; i < 60; i++) {
        const mid = (lo + hi) / 2;
        const fm = f(mid);
        if (!Number.isFinite(fm)) break;
        if (f(lo) * fm <= 0) hi = mid; else lo = mid;
      }
      out.push(Number(((lo + hi) / 2).toPrecision(10)));
    }
    prevX = x;
    prevY = y;
    if (out.length >= 4) break;
  }
  return [...new Set(out.map(v => Number(v.toPrecision(8))))];
}

function rootAnalysis(B, meta) {
  if (!meta || meta.kind !== 'equation' || !Array.isArray(meta.solutions) || meta.solutions.length < 2) return null;
  if (B.t !== 'equation') return null;
  const kept = [];
  const lost = [];
  for (const sol of meta.solutions) {
    const env = { [meta.variable]: sol };
    const L = evaluate(B.l, env);
    const R = evaluate(B.r, env);
    const holds = Number.isFinite(L) && Number.isFinite(R) && Math.abs(L - R) <= Math.max(1e-6, Math.abs(R) * 1e-6);
    (holds ? kept : lost).push(sol);
  }
  if (!kept.length || !lost.length) return null;
  const variable = meta.variable || 'x';
  if (lost.some(v => Math.abs(v) < 1e-9)) {
    return build('divided-by-variable', { variable }, 'high');
  }
  return build('lost-root', {
    variable, kept: kept.map(fmtNum).join(' or '), lost: lost.map(fmtNum).join(' or ')
  }, 'high');
}

function counterexample(A, B, meta) {
  try {
    if (B.t === 'equation' && meta?.kind === 'equation' && Array.isArray(meta.solutions) && meta.solutions.length) {
      const variable = meta.variable || 'x';
      for (const sol of meta.solutions) {
        const env = { [variable]: sol };
        const L = evaluate(B.l, env);
        const R = evaluate(B.r, env);
        if (!Number.isFinite(L) || !Number.isFinite(R)) continue;
        if (Math.abs(L - R) > Math.max(1e-6, Math.abs(R) * 1e-6)) {
          return build('counterexample', {
            text: `Put ${variable} = ${fmtNum(sol)} — the answer to the original — into this line and it reads ${fmtNum(L)} = ${fmtNum(R)}, which is false.`
          }, 'medium');
        }
      }
      return null;
    }
    if (!A) return null;
    if (A.t === 'equation' && B.t === 'equation') {
      const name = [...variablesOf(diffNode(A))][0];
      if (!name) return null;
      for (const root of rootsOf(diffNode(A), name)) {
        const env = { [name]: root };
        const L = evaluate(B.l, env);
        const R = evaluate(B.r, env);
        if (!Number.isFinite(L) || !Number.isFinite(R)) continue;
        if (Math.abs(L - R) > Math.max(1e-6, Math.abs(R) * 1e-6)) {
          return build('counterexample', {
            text: `${SYMBOL[name] || name} = ${fmtNum(root)} makes the line above true; put it into this line and it reads ${fmtNum(L)} = ${fmtNum(R)}.`
          }, 'medium');
        }
      }
      return null;
    }
    const dA = A.t === 'equation' ? diffNode(A) : A;
    const dB = B.t === 'equation' ? diffNode(B) : B;
    const names = [...new Set([...variablesOf(dA), ...variablesOf(dB)])];
    if (names.length !== 1) return null;
    const name = names[0];
    for (const value of [2, 3, 1, 4, 5, -2]) {
      const env = { [name]: value };
      const va = evaluate(dA, env);
      const vb = evaluate(dB, env);
      if (!Number.isFinite(va) || !Number.isFinite(vb)) continue;
      if (Math.abs(va - vb) > 1e-6 * Math.max(1, Math.abs(va))) {
        if (A.t === 'equation') return null;
        return build('counterexample', {
          text: `At ${SYMBOL[name] || name} = ${value} the line above is ${fmtNum(va)} and this line is ${fmtNum(vb)}.`
        }, 'medium');
      }
    }
  } catch { /* a counterexample is a bonus, never a requirement */ }
  return null;
}

// ── The entry point ──────────────────────────────────────────────────────────

function readLine(text) {
  if (!text) return null;
  try {
    const cleaned = normalize(String(text))
      .replace(/^∴\s*/, '')
      .replace(/^(so|hence|then|therefore)\s+/i, '');
    if (!cleaned) return null;
    return parse(cleaned);
  } catch { return null; }
}

/** Search order matters: the named mistakes are checked before the generic ones. */
const PRIORITY = [
  'sign-on-transfer', 'distribute-partial', 'distribute-sign', 'power-of-sum',
  'negative-squared', 'power-of-power', 'power-product', 'function-of-sum',
  'fraction-across', 'cancel-over-sum', 'reciprocal-flip', 'sign-flipped',
  'operator-swapped', 'term-dropped'
];

// A missing term or a flipped sign is a true description of what changed, but a
// thin one. Where the line is an equation, "you took 5 off the left and not the
// right" says the same thing and says why it matters, so it wins.
const THIN = new Set(['term-dropped', 'sign-flipped', 'operator-swapped', 'reciprocal-flip']);

/**
 * Name the mistake between two lines of working.
 *
 *   prevText  the last line that was still true — null when the break is the
 *             first line, in which case the question's own starting expression
 *             is used instead
 *   brokenText the line Step Check marked
 *   meta      the question's stepMeta, for solution-set reasoning
 *
 * Returns { code, title, message, fix, confidence } or null when nothing here
 * reproduces what the student wrote. Never guesses.
 */
export function diagnoseStep({ prevText = null, brokenText, meta = null } = {}) {
  const B = readLine(brokenText);
  if (!B) return null;

  // A dropped solution is about the original equation, not the line above, so
  // it is checked first and works even when the break is the very first line.
  const roots = rootAnalysis(B, meta);
  if (roots) return roots;

  let A0 = readLine(prevText);
  if (A0 && sameClaim(A0, B)) return null;   // the step holds; there is nothing to name

  let A = A0;
  if (!A) {
    const fallback = meta?.source || (meta?.kind === 'expression' ? meta.canonical : null);
    A = readLine(fallback);
  }
  if (!A) return counterexample(null, B, meta);

  const hypotheses = [...equationHypotheses(A), ...subtreeHypotheses(A)];
  const seen = new Set();
  const hits = [];
  for (const h of hypotheses) {
    const key = `${h.code}|${render(h.ast)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (sameClaim(h.ast, A)) continue;                 // not actually a mistake
    if (!sameClaim(h.ast, B)) continue;
    hits.push(h);
  }
  if (hits.length) {
    hits.sort((a, b) => PRIORITY.indexOf(a.code) - PRIORITY.indexOf(b.code));
    const best = hits[0];
    if (THIN.has(best.code)) {
      const side = sideAnalysis(A, B);
      if (side) return side;
    }
    return build(best.code, best.detail, hits.length === 1 ? 'high' : 'medium');
  }

  const single = singleEditDiagnosis(A, B);
  if (single) return single;

  const side = sideAnalysis(A, B);
  if (side) return side;

  const slip = numericSlip(A, B, meta);
  if (slip) return slip;

  return counterexample(A, B, meta);
}

/**
 * A stable key for one diagnosed misstep in one subtopic. The code carries no
 * numbers, so the same mistake about different questions lands on one key and
 * the adaptive engine can treat it as a pattern rather than a run of accidents.
 */
export function stepTrapKey(subtopicId, code) {
  if (!subtopicId || !code) return null;
  return `${subtopicId}.step-${code}`;
}
