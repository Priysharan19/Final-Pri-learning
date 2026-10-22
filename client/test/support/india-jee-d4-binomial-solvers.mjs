// ─────────────────────────────────────────────────────────────────────────────
// Independent solvers for the JEE D4 Binomial Theorem forms
// (client/src/engine/generators/india-class11-jee-d4-binomial.js).
//
// Nothing here imports the generator. Each solver reads the numbers back out of
// the rendered prompt and re-solves by a different route from the generator:
// the expansions are multiplied out factor by factor in exact BigInt arithmetic
// (a Laurent polynomial in x, or a + b√d pairs for the surd powers) instead of
// being read off the general term; n is recovered by scanning powers rather
// than by a formula; the consecutive-coefficient ratio is matched by searching
// every (n, r); rational terms are counted by enumerating every r. Uniqueness is
// checked where it is at stake. A prompt it cannot read is a problem.
// NEAR_MISS lists answers a student could plausibly write that must be marked
// WRONG; they come from the same independent computation.
// ─────────────────────────────────────────────────────────────────────────────

const big = v => BigInt(v);
const keyedInt = q => (Number.isInteger(q.answer?.value) ? BigInt(q.answer.value) : null);
/** The key equals the exact integer x (a BigInt). */
function keyIs(q, x, label) {
  const k = keyedInt(q);
  if (k === null) return [`key ${q.answer?.value} is not an integer`];
  return k === x ? [] : [`${label}: independent ${x} vs keyed ${k}`];
}
const absB = x => (x < 0n ? -x : x);

/** Integer square root of a non-negative BigInt (floor). */
function isqrt(n) {
  if (n < 0n) throw new Error('negative');
  if (n < 2n) return n;
  let x = BigInt(Math.floor(Math.sqrt(Number(n))));
  while (x * x > n) x -= 1n;
  while ((x + 1n) * (x + 1n) <= n) x += 1n;
  return x;
}

// ── Laurent polynomials in x: Map exponent → BigInt coefficient ─────────────
function lmul(P, Q) {
  const out = new Map();
  for (const [e1, c1] of P) for (const [e2, c2] of Q) {
    const e = e1 + e2;
    out.set(e, (out.get(e) || 0n) + c1 * c2);
  }
  for (const [e, c] of out) if (c === 0n) out.delete(e);
  return out;
}
function lpow(P, n) {
  let out = new Map([[0, 1n]]);
  for (let i = 0; i < n; i++) out = lmul(out, P);
  return out;
}
const coeffOf = (P, e) => P.get(e) || 0n;
/** Exponent of "x" or "x^{k}" as written. */
const expOf = s => (s === undefined ? 1 : Number(s));
const isPrime = p => p >= 2 && [...Array(Math.max(0, Math.floor(Math.sqrt(p)) - 1))].every((_, i) => p % (i + 2) !== 0);

// ═════════════════════════════════════════════════════════════════════════════
// Each reader returns { value: BigInt, near: [Number] } or { problems: [...] }.
// ═════════════════════════════════════════════════════════════════════════════

function readExpansion(q) {
  const p = q.prompt;
  let m = p.match(/^Find the (greatest integer less than or equal to|least integer greater than or equal to) \$\\left\((\d+) \+ \\sqrt\{(\d+)\}\\right\)\^\{(\d+)\}\$\.$/);
  if (m) {
    const floorAsked = m[1].startsWith('greatest');
    const a = big(m[2]), d = big(m[3]), n = Number(m[4]);
    if (isqrt(d) ** 2n === d) return { problems: ['the root is rational'] };
    // (a + √d)^n = P + Q√d by repeated multiplication.
    let P = 1n, Q = 0n;
    for (let i = 0; i < n; i++) [P, Q] = [P * a + Q * d, P + Q * a];
    if (Q <= 0n) return { problems: ['the surd part vanished'] };
    const floor = P + isqrt(Q * Q * d);          // Q√d is irrational, so floor(Q√d) = isqrt(Q²d)
    const value = floorAsked ? floor : floor + 1n;
    // The conjugate sum is the integer just above the power: 2P.
    return { value, near: floorAsked ? [Number(2n * P), Number(P), Number(floor + 2n)] : [Number(floor), Number(P), Number(floor + 2n)] };
  }
  m = p.match(/^Find the coefficient of \$x(?:\^\{(\d+)\})?\$ in the expansion of \$\(1 \+ (\d*)x\)\^\{(\d+)\}\(1 - (\d*)x\)\^\{(\d+)\}\$\.$/);
  if (m) {
    const k = expOf(m[1]);
    const al = big(m[2] === '' ? 1 : m[2]), al2 = big(m[4] === '' ? 1 : m[4]);
    if (al !== al2) return { problems: ['the two factors use different multiples of x'] };
    const mm = Number(m[3]), nn = Number(m[5]);
    const F = lpow(new Map([[0, 1n], [1, al]]), mm), G = lpow(new Map([[0, 1n], [1, -al]]), nn);
    const value = coeffOf(lmul(F, G), k);
    const allPlus = coeffOf(lpow(new Map([[0, 1n], [1, al]]), mm + nn), k);
    const swapped = coeffOf(lmul(lpow(new Map([[0, 1n], [1, -al]]), mm), lpow(new Map([[0, 1n], [1, al]]), nn)), k);
    const noAlpha = coeffOf(lmul(lpow(new Map([[0, 1n], [1, 1n]]), mm), lpow(new Map([[0, 1n], [1, -1n]]), nn)), k);
    return { value, near: [Number(allPlus), Number(coeffOf(F, k) + coeffOf(G, k)), Number(-value), Number(swapped), Number(noAlpha),
      Number(coeffOf(lmul(F, G), k - 1)), Number(coeffOf(lmul(F, G), k + 1))] };
  }
  m = p.match(/^In the expansion of \$\((\d*)x ([+-]) (\d+)\)\^\{n\}\$ in powers of \$x\$, the sum of all the coefficients is \$(\d+)\$\. Find the sum of the coefficients of the (even powers of \$x\$ \(the constant term included\)|odd powers of \$x\$)\.$/);
  if (m) {
    const a = big(m[1] === '' ? 1 : m[1]), b = (m[2] === '-' ? -1n : 1n) * big(m[3]), S = big(m[4]);
    const lin = new Map([[0, b], [1, a]]);
    // Scan n: the expansion's coefficients, added, must give S. Exactly one n may work.
    const ns = [];
    let E = new Map([[0, 1n]]);
    for (let n = 1; n <= 60; n++) {
      E = lmul(E, lin);
      let total = 0n;
      for (const c of E.values()) total += c;
      if (total === S) ns.push({ n, E: new Map(E) });
    }
    if (ns.length !== 1) return { problems: [`${ns.length} values of n give the sum`] };
    let even = 0n, odd = 0n;
    for (const [e, c] of ns[0].E) { if (e % 2 === 0) even += c; else odd += c; }
    const wantEven = m[5].startsWith('even');
    const value = wantEven ? even : odd;
    return { value, near: [Number(S) / 2, Number(wantEven ? odd : even), Number(-value), Number(S), Number(even - odd)] };
  }
  return { problems: ['could not read the prompt'] };
}

function readGeneralTerm(q) {
  const p = q.prompt;
  let m = p.match(/^Three consecutive coefficients in the expansion of \$\(1 \+ x\)\^\{n\}\$ are in the ratio \$(\d+) : (\d+) : (\d+)\$, in that order\. Find the middle one of these three coefficients\.$/);
  if (m) {
    const [A, B, C] = [big(m[1]), big(m[2]), big(m[3])];
    // Every row of Pascal's triangle up to n = 80, every run of three.
    const hits = [];
    let row = [1n];
    for (let n = 1; n <= 80; n++) {
      const next = [1n];
      for (let i = 1; i < row.length; i++) next.push(row[i - 1] + row[i]);
      next.push(1n);
      row = next;
      for (let r = 1; r + 1 <= n; r++) {
        const [x, y, z] = [row[r - 1], row[r], row[r + 1]];
        if (x * B === y * A && y * C === z * B) hits.push({ n, r, x, y, z });
      }
    }
    if (hits.length !== 1) return { problems: [`${hits.length} runs of three coefficients have that ratio`] };
    const h = hits[0];
    return { value: h.y, near: [h.n, h.r, Number(h.x), Number(h.z), Number(B)] };
  }
  m = p.match(/^Find the coefficient of \$x(?:\^\{(-?\d+)\})?\$ in the expansion of \$\((\d+) ([+-]) (\d*)x\^\{(\d+)\}\)\\left\(x(?:\^\{(\d+)\})? ([+-]) \\dfrac\{(\d+)\}\{x(?:\^\{(\d+)\})?\}\\right\)\^\{(\d+)\}\$\.$/);
  if (m) {
    const k = expOf(m[1]);
    const P0 = big(m[2]), Q0 = (m[3] === '-' ? -1n : 1n) * big(m[4] === '' ? 1 : m[4]), t = Number(m[5]);
    const a = expOf(m[6]), c = (m[7] === '-' ? -1n : 1n) * big(m[8]), b = expOf(m[9]), n = Number(m[10]);
    const F = lpow(new Map([[a, 1n], [-b, c]]), n);
    const whole = lmul(new Map([[0, P0], [t, Q0]]), F);
    const value = coeffOf(whole, k);
    const A = coeffOf(F, k), B = coeffOf(F, k - t);
    return { value, near: [Number(P0 * A), Number(Q0 * B), Number(A + B), Number(-value), Number(P0 * A - Q0 * B)] };
  }
  m = p.match(/^How many terms of the expansion of \$\\left\(\\sqrt(?:\[(\d+)\])?\{(\d+)\} \+ \\sqrt(?:\[(\d+)\])?\{(\d+)\}\\right\)\^\{(\d+)\}\$ are (rational|irrational) numbers\?$/);
  if (m) {
    const a = m[1] ? Number(m[1]) : 2, P = Number(m[2]), b = m[3] ? Number(m[3]) : 2, Q = Number(m[4]), n = Number(m[5]);
    if (!isPrime(P) || !isPrime(Q) || P === Q) return { problems: ['the bases are not two distinct primes'] };
    // Term r is C(n,r)·P^((n−r)/a)·Q^(r/b). With distinct primes it is rational
    // iff the exponent of each prime is whole; test every r.
    let rational = 0, naive = 0, onlyFirst = 0, onlySecond = 0;
    for (let r = 0; r <= n; r++) {
      if ((n - r) % a === 0 && r % b === 0) rational++;
      if (r % a === 0 && r % b === 0) naive++;
      if ((n - r) % a === 0) onlyFirst++;
      if (r % b === 0) onlySecond++;
    }
    const wantRational = m[6] === 'rational';
    const value = big(wantRational ? rational : n + 1 - rational);
    return { value, near: wantRational ? [n + 1 - rational, naive, rational - 1, rational + 1, onlyFirst, onlySecond]
      : [rational, n - rational, n + 1 - naive, n + 1, n + 1 - onlyFirst, n + 1 - onlySecond] };
  }
  return { problems: ['could not read the prompt'] };
}

function readMiddleTerm(q) {
  const p = q.prompt;
  let m = p.match(/^Let \$n\$ be the least (positive integer|integer greater than \$(\d+)\$) for which the expansion of \$\\left\((\d*)x(?:\^\{(\d+)\})? ([+-]) \\dfrac\{(\d+)\}\{x(?:\^\{(\d+)\})?\}\\right\)\^\{n\}\$ has a term independent of \$x\$\. Find that term\.$/);
  if (m) {
    const start = m[2] ? Number(m[2]) + 1 : 1;
    const alpha = big(m[3] === '' ? 1 : m[3]), a = expOf(m[4]);
    const c = (m[5] === '-' ? -1n : 1n) * big(m[6]), b = expOf(m[7]);
    const base = new Map([[a, alpha], [-b, c]]);
    let E = lpow(base, start - 1);
    for (let n = start; n <= start + 60; n++) {
      E = lmul(E, base);
      if (E.has(0)) {
        const value = E.get(0);
        // The bare binomial coefficient of that term: same expansion with both constants 1.
        const bare = coeffOf(lpow(new Map([[a, 1n], [-b, 1n]]), n), 0);
        const twice = coeffOf(lpow(base, 2 * n), 0);   // the next admissible n overshot to 2n
        return { value, near: [n, Number(bare), Number(-value), Number(twice)] };
      }
    }
    return { problems: ['no n in range gives a term independent of x'] };
  }
  m = p.match(/^The term independent of \$x\$ in the expansion of \$\\left\(x(?:\^\{(\d+)\})? \+ \\dfrac\{k\}\{x(?:\^\{(\d+)\})?\}\\right\)\^\{(\d+)\}\$, where \$k\$ is a (positive real|real) number, is \$(-?\d+)\$\. Find the coefficient of \$x(?:\^\{(-?\d+)\})?\$ in the same expansion\.$/);
  if (m) {
    const a = expOf(m[1]), b = expOf(m[2]), n = Number(m[3]), positive = m[4] === 'positive real';
    const V = big(m[5]), e = expOf(m[6]);
    // Expand (x^a + K·x^{−b})^n with K kept as a second variable: encode K^j by
    // the exponent pair (x-power, j) folded into one key.
    const W = 1000;   // x-powers stay well inside ±W/2
    let E = new Map([[0, 1n]]);
    const step = new Map([[a * W, 1n], [-b * W + 1, 1n]]);   // x^a, and K·x^{−b}
    for (let i = 0; i < n; i++) E = lmul(E, step);
    const split = key => { const j = ((key % W) + W) % W; return { j, x: (key - j) / W }; };
    const at = xp => [...E].map(([key, c]) => ({ ...split(key), c })).filter(t => t.x === xp);
    const zero = at(0);
    if (zero.length !== 1) return { problems: ['the term independent of x is not a single term'] };
    const { j: R, c: C0 } = zero[0];
    if (R === 0) return { problems: ['the independent term does not involve k'] };
    if (V % C0 !== 0n) return { problems: ['k^r is not a whole number'] };
    const kr = V / C0;
    // Real roots of K^R = kr, then the stated restriction.
    let cands = [];
    for (let K = -1000n; K <= 1000n; K++) if (K !== 0n && K ** BigInt(R) === kr) cands.push(K);
    if (positive) cands = cands.filter(K => K > 0n);
    if (cands.length !== 1) return { problems: [`${cands.length} admissible values of k`] };
    // A real non-integer root would leave no integer candidate; the scan above already returns a problem then.
    const K = cands[0];
    const target = at(e);
    if (target.length !== 1) return { problems: ['the target power is not a single term'] };
    const { j: S, c: CS } = target[0];
    const value = CS * K ** BigInt(S);
    const mirror = [...E].map(([key, c]) => ({ ...split(key), c })).find(t => t.j === n - S);
    return { value, near: [Number(CS), Number(-value), Number(kr), Number(K), ...(mirror ? [Number(mirror.c * K ** BigInt(n - S))] : [])] };
  }
  m = p.match(/^The sum of all the coefficients in the expansion of \$\\left\(x(?:\^\{(\d+)\})? ([+-]) \\dfrac\{(\d+)\}\{x(?:\^\{(\d+)\})?\}\\right\)\^\{n\}\$ is \$(-?\d+)\$\. Find the coefficient of its middle term; if the expansion has two middle terms, give the sum of their coefficients\.$/);
  if (m) {
    const a = expOf(m[1]), c = (m[2] === '-' ? -1n : 1n) * big(m[3]), b = expOf(m[4]), S = big(m[5]);
    const base = new Map([[a, 1n], [-b, c]]);
    const ns = [];
    let E = new Map([[0, 1n]]);
    for (let n = 1; n <= 60; n++) {
      E = lmul(E, base);
      let total = 0n;
      for (const v of E.values()) total += v;
      if (total === S) ns.push({ n, E: new Map(E) });
    }
    if (ns.length !== 1) return { problems: [`${ns.length} values of n give the sum`] };
    const { n, E: X } = ns[0];
    // Terms in descending powers of x; there are n + 1 of them, all non-zero.
    const terms = [...X].sort((u, v) => v[0] - u[0]).map(([, v]) => v);
    if (terms.length !== n + 1) return { problems: ['terms merged in the expansion'] };
    const mids = terms.length % 2 === 1 ? [terms[(terms.length - 1) / 2]] : [terms[terms.length / 2 - 1], terms[terms.length / 2]];
    const value = mids.reduce((s, v) => s + v, 0n);
    const near = mids.length === 2 ? [Number(mids[0]), Number(mids[1]), Number(-value), Number(mids[0] - mids[1])]
      : [Number(terms[(terms.length - 1) / 2 + 1]), Number(terms[(terms.length - 1) / 2 - 1]), Number(-value), n];
    return { value, near };
  }
  return { problems: ['could not read the prompt'] };
}

const run = (reader, label) => q => {
  const out = reader(q);
  return out.problems ? out.problems : keyIs(q, out.value, label);
};
const near = reader => q => {
  const out = reader(q);
  if (out.problems) return [];
  const key = q.answer.value;
  return [...new Set(out.near.filter(v => Number.isFinite(v) && v !== key).map(v => String(Number(v.toFixed(6)))))];
};

export const SOLVE = {
  'c11-binomial-expansion-jee-reasoning': run(readExpansion, 'exact BigInt expansion'),
  'c11-binomial-general-term-jee-reasoning': run(readGeneralTerm, 'expansion / Pascal search / enumeration'),
  'c11-binomial-middle-term-jee-reasoning': run(readMiddleTerm, 'exact BigInt expansion')
};

export const NEAR_MISS = {
  'c11-binomial-expansion-jee-reasoning': near(readExpansion),
  'c11-binomial-general-term-jee-reasoning': near(readGeneralTerm),
  'c11-binomial-middle-term-jee-reasoning': near(readMiddleTerm)
};
