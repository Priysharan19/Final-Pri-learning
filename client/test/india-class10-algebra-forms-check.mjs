// Pri Learning · Class X Algebra additional forms — an independent check.
//
// For every generator in india-class10-algebra-forms.js, at D1–D3 and over many
// seeds, this re-derives the keyed answer from the PROMPT TEXT alone, by a route
// that does not call the generator's own arithmetic (it parses the numbers the
// student reads and solves the problem again, often by brute force). It also
// checks the worked solution, the blueprint mapping against the covers, the
// mark scheme, the provenance flags and that a seed always writes the same item.
//
// SYNTHETIC: software checking of software-written items. Not a human maths
// review, not an examiner review, not board approval.
import assert from 'node:assert/strict';
import { generateQuestion, loadAllBanks } from '../src/engine/generators/index.js';
import { CLASS10_ALGEBRA_FORMS, CLASS10_ALGEBRA_FORMS_MAP } from '../src/engine/generators/india-class10-algebra-forms.js';
import { IN_CHAPTERS } from '../src/engine/curriculum-in.js';

await loadAllBanks();
const SEEDS = 400;
const nums = s => (String(s).replace(/\\dfrac\{(-?\d+)\}\{(\d+)\}/g, '($1/$2)').match(/-?\d+/g) || []).map(Number);
const plain = p => String(p).replace(/\$/g, '').replace(/\\ /g, ' ').replace(/\\ldots/g, '...').replace(/\^\{\\text\{(st|nd|rd|th)\}\}/g, '');
const near = (a, b) => Math.abs(a - b) < 1e-9;
const keyed = q => q.answer.value;

/** "a, b, c, ..., L" — the AP the student reads. */
function apFrom(text) {
  const m = text.match(/progression (-?\d+), (-?\d+), (-?\d+), \.\.\.(?:, (-?\d+))?/);
  assert.ok(m, `no AP in: ${text}`);
  const [a, b, c, L] = m.slice(1).map(v => (v === undefined ? undefined : Number(v)));
  assert.equal(b - a, c - b, 'the printed terms are an AP');
  return { a, d: b - a, L };
}
/** Coefficients of a quadratic "ax^2 ± bx ± c" in x (k-free). */
function quadCoeffs(expr, v = 'x') {
  const e = expr.replace(/\s+/g, '');
  const term = (re) => { const m = e.match(re); if (!m) return 0; const s = m[1]; return s === '' || s === '+' ? 1 : s === '-' ? -1 : Number(s); };
  const a = term(new RegExp(`^([+-]?\\d*)${v}\\^2`));
  const b = term(new RegExp(`([+-]\\d*)${v}(?!\\^)`));
  const cm = e.match(new RegExp(`([+-]\\d+)$`));
  const c = cm && !e.endsWith(v) ? Number(cm[1]) : 0;
  return { a, b, c };
}
/** Real roots of ax^2+bx+c, numerically. */
const roots = ({ a, b, c }) => { const D = b * b - 4 * a * c; return [(-b + Math.sqrt(D)) / (2 * a), (-b - Math.sqrt(D)) / (2 * a)]; };

const SOLVE = {
  'nth-from-end': t => { const { d, L } = apFrom(t); const k = Number(t.match(/Find the (\d+) term/)[1]); return L - (k - 1) * d; },
  'number-of-terms': t => { const { a, d, L } = apFrom(t); let n = 1, x = a; while (x !== L) { x += d; n += 1; assert.ok(n < 500); } return n; },
  'k-three-terms': t => {
    const m = t.match(/are (.+?), (-?\d+) and (.+?) three/); const f = s => { const [, p, q] = s.replace(/\s+/g, '').match(/^(-?\d*)k([+-]\d+)?$/); return [p === '' ? 1 : p === '-' ? -1 : Number(p), Number(q || 0)]; };
    const [p, q] = f(m[1]), r = Number(m[2]), [s, u] = f(m[3]);
    for (let k = -50; k <= 50; k++) if (2 * r === p * k + q + s * k + u) return k;
  },
  'term-from-two-terms': t => { const [m, Am, n, An, p] = nums(t); const d = (An - Am) / (n - m), a = Am - (m - 1) * d; return a + (p - 1) * d; },
  'first-negative-term': t => { const { a, d } = apFrom(t); for (let n = 1; ; n++) if (a + (n - 1) * d < 0) return n; },
  'zero-term': t => { const [m, Am, n, An] = nums(t); const d = (An - Am) / (n - m), a = Am - (m - 1) * d; for (let p = 1; p < 500; p++) if (a + (p - 1) * d === 0) return p; },
  'sum-first-last': t => { const [n, a, l] = nums(t); let s = 0; const d = (l - a) / (n - 1); for (let i = 0; i < n; i++) s += a + i * d; return s; },
  'sum-of-multiples': t => { const [n, m] = nums(t); let s = 0; for (let i = 1; i <= n; i++) s += i * m; return s; },
  'multiples-between': t => { const [L, U, m] = nums(t); let s = 0; for (let x = L + 1; x < U; x++) if (x % m === 0) s += x; return s; },
  'difference-from-sum': t => { const [n, S, a] = nums(t); for (let d = -50; d <= 50; d++) { let s = 0; for (let i = 0; i < n; i++) s += a + i * d; if (s === S) return d; } },
  'term-from-sum-formula': t => { const e = t.match(/is (.+?) for every/)[1]; const { a: p, b: q } = quadCoeffs(e, 'n'); const r = Number(t.match(/Find its (\d+) term/)[1]); const S = n => p * n * n + q * n; return S(r) - S(r - 1); },
  'difference-from-ends': t => { const [a, l, S] = nums(t); for (let n = 2; n < 500; n++) { const d = (l - a) / (n - 1); if (!Number.isInteger(d)) continue; let s = 0; for (let i = 0; i < n; i++) s += a + i * d; if (s === S) return d; } },
  'zero-sum': t => { const r = roots(quadCoeffs(t.match(/= (.+?)\.$/)[1])); return r[0] + r[1]; },
  'zero-product': t => { const r = roots(quadCoeffs(t.match(/= (.+?)\.$/)[1])); return r[0] * r[1]; },
  'sum-of-squares': t => { const r = roots(quadCoeffs(t.match(/p\(x\) = (.+?), find/)[1])); return r[0] ** 2 + r[1] ** 2; },
  'sum-of-reciprocals': t => { const r = roots(quadCoeffs(t.match(/p\(x\) = (.+?), find/)[1])); return 1 / r[0] + 1 / r[1]; },
  'k-from-one-zero': t => { const r = Number(t.match(/If x = (-?\d+)/)[1]); const { a, b } = quadCoeffs(t.match(/polynomial (.+?) \+ k/)[1]); return -(a * r * r + b * r); },
  'constant-from-difference': t => {
    const m = t.match(/x\^2 - (\d*)x \+ q differ by (\d+)/); const p = m[1] === '' ? 1 : Number(m[1]), gap = Number(m[2]);
    // Brute force over q: the zeroes of x^2 - px + q, when real, must differ by gap.
    const hits = [];
    for (let q = -400; q <= 400; q++) { const D = p * p - 4 * q; if (D >= 0 && near(Math.sqrt(D), gap)) hits.push(q); }
    assert.equal(hits.length, 1); return hits[0];
  },
  'discriminant-value': t => { const { a, b, c } = quadCoeffs(t.match(/equation (.+?) = 0/)[1]); return b * b - 4 * a * c; },
  'middle-k-positive': t => { const { a, c } = quadCoeffs(t.match(/equation (.+?) = 0/)[1].replace('kx', '0x')); for (let k = 1; k < 200; k++) if (k * k === 4 * a * c) return k; },
  'middle-k-negative': t => { const { a, c } = quadCoeffs(t.match(/equation (.+?) = 0/)[1].replace('kx', '0x')); for (let k = -1; k > -200; k--) if (k * k === 4 * a * c) return k; },
  'leading-k-equal-roots': t => { const { b, c } = quadCoeffs(t.match(/equation (.+?) = 0/)[1].replace('kx^2', '1x^2')); for (let k = 1; k < 500; k++) if (b * b === 4 * k * c) return k; },
  'shifted-k-equal-roots': t => { const m = t.match(/\(k ([+-]) (\d+)\)x\^2|kx\^2/); const p = m[1] ? (m[1] === '-' ? -1 : 1) * Number(m[2]) : 0; const n = t.match(/- 2\(k(?: ([+-]) (\d+))?\)x/); const q = n[1] ? (n[1] === '-' ? -1 : 1) * Number(n[2]) : 0;
    for (let k = 1; k < 100; k++) if ((k + q) ** 2 - (k + p) === 0 && k + p !== 0) return k; },
  'least-k-no-real-roots': t => { const { b } = quadCoeffs(t.match(/equation (.+?) = 0/)[1].replace('+ k', '+ 0')); for (let k = 1; ; k++) if (b * b - 4 * k < 0) return k; },
  ...Object.fromEntries(['k-no-solution', 'k-infinitely-many', 'k-both-sides-none', 'k-both-sides-infinite', 'k-squared-no-solution'].map(form => [form, t => {
    // Brute force: for each k, classify the pair by its coefficients.
    const want = /no solution/.test(t) ? 'none' : 'infinite';
    const eqs = t.match(/equations (.+?) and (.+?) ha/).slice(1);
    const hits = [];
    for (let k = -60; k <= 60; k++) {
      const parse = e => {
        const [lhs, rhs] = e.split(' = ');
        const val = s => Function('k', `return ${s.replace(/(\d)k/g, '$1*k')}`)(k);
        const coef = v => { const m = lhs.replace(/\s+/g, '').match(new RegExp(`([+-]?(?:\\([^)]*\\)|\\d*k?|\\d*))${v}`)); const s = m[1]; return s === '' || s === '+' ? 1 : s === '-' ? -1 : val(s.replace(/^\+/, '')); };
        return [coef('x'), coef('y'), val(rhs)];
      };
      const [[a1, b1, c1], [a2, b2, c2]] = eqs.map(parse);
      if ((a2 === 0 && b2 === 0)) continue;
      const parallel = a1 * b2 === a2 * b1;
      const same = parallel && a1 * c2 === a2 * c1 && b1 * c2 === b2 * c1;
      if (want === 'none' && parallel && !same) hits.push(k);
      if (want === 'infinite' && same) hits.push(k);
    }
    assert.equal(hits.length, 1, `exactly one k answers "${t}" — found ${JSON.stringify(hits)}`);
    return hits[0];
  }]))
};

const coverOf = {};
for (const ch of IN_CHAPTERS) for (const c of ch.covers) if (CLASS10_ALGEBRA_FORMS[c.gen]) (coverOf[c.gen] ||= []).push({ chapter: ch.id, dp: c.dp, diff: c.diff });

let items = 0;
const formsSeen = new Set();
for (const gen of Object.keys(CLASS10_ALGEBRA_FORMS)) {
  const covers = coverOf[gen] || [];
  assert.ok(covers.length >= 1, `${gen} is a cover of a chapter`);
  const where = CLASS10_ALGEBRA_FORMS_MAP[gen];
  for (const c of covers) {
    assert.equal(c.chapter, where.chapter, `${gen}: covered in the chapter it writes for`);
    assert.deepEqual(c.dp, [where.dotpoint], `${gen}: covered at the dot point it writes for`);
    assert.deepEqual(c.diff, [1, 2, 3], `${gen}: claimed at the CBSE rungs D1–D3 only`);
  }
  for (const d of [1, 2, 3]) {
    const forms = new Set();
    for (let seed = 1; seed <= SEEDS; seed++) {
      const q = generateQuestion(gen, d, seed);
      const again = generateQuestion(gen, d, seed);
      assert.deepEqual(again, q, `${gen} D${d} seed ${seed} is reproducible`);
      const solve = SOLVE[q.form];
      assert.ok(solve, `${gen}: an independent solver for form ${q.form}`);
      const got = solve(plain(q.prompt));
      assert.ok(Number.isFinite(got) && near(got, keyed(q)), `${gen} D${d} seed ${seed} (${q.form}): keyed ${keyed(q)}, re-derived ${got}\n${q.prompt}`);
      if (q.answer.simplestFraction) assert.ok(near(q.answer.simplestFraction.n / q.answer.simplestFraction.d, keyed(q)));
      // The worked solution and what the item says about itself.
      assert.ok(q.steps.length >= 3 && q.steps.every(s => s.h && s.d), `${gen} ${q.form}: at least three worked steps`);
      assert.ok(q.hints.length >= 1, `${gen} ${q.form}: a hint`);
      assert.ok(!/previous[- ]year|past paper|PYQ|board[- ]approved|CBSE \d{4}/i.test(q.prompt), `${gen}: never presented as a past paper`);
      assert.equal(q.blueprint.chapter, where.chapter); assert.equal(q.blueprint.dotpoint, where.dotpoint);
      assert.equal(q.blueprint.difficulty, d);
      assert.ok(['very-short-answer', 'short-answer'].includes(q.blueprint.questionType));
      assert.equal(q.markScheme.reduce((n, r) => n + r.marks, 0), q.blueprint.marks, `${gen}: the mark scheme adds up to the item's marks`);
      assert.equal(q.markScheme.at(-1).kind, 'answer');
      assert.ok(q.markScheme.every(r => q.steps.some(s => s.h === r.step)), `${gen}: every mark is for a worked step`);
      assert.deepEqual({ ...q.provenance, source: undefined }, { authoredBy: 'agent', checkedBy: 'software', humanReviewed: false, examinerReviewed: false, previousYearQuestion: false, source: undefined });
      forms.add(q.form); formsSeen.add(q.form); items += 1;
    }
    assert.ok(forms.size >= 2, `${gen} D${d}: at least two question forms (${[...forms]})`);
  }
}
assert.equal(formsSeen.size, 29, `distinct forms across the bank (${formsSeen.size})`);
console.log(`CLASS X ALGEBRA FORMS: PASS — ${Object.keys(CLASS10_ALGEBRA_FORMS).length} generators, ${formsSeen.size} forms, ${items} items re-derived from the prompt by a second route; steps, blueprint, mark scheme and provenance checked. [SYNTHETIC — software check, not a human or examiner review]`);
