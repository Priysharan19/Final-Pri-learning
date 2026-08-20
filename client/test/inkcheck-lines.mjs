// ─────────────────────────────────────────────────────────────────────────────
// LINE-LEVEL handwriting suite — the metric that matches the product.
//
// Isolated-glyph accuracy overstates some errors and understates others: a
// heavily slanted "l" is genuinely indistinguishable from "(" on its own, while
// a "%" that fragments into three symbols is unrecoverable no matter how good
// the classifier is. What the student actually experiences is whether the LINE
// reads back correctly, so that is what this measures.
//
// It also guards the thing the segmenter can most easily get wrong: writing
// tightly. Every expression is rendered at several inter-glyph spacings, down
// to cramped, so an over-eager merge rule shows up here as fused glyphs.
//
// Usage: node client/test/inkcheck-lines.mjs [lines-per-condition]
// ─────────────────────────────────────────────────────────────────────────────
import { TEMPLATES } from '../src/ink/templates.js';
import { recognize } from '../src/ink/recognizer.js';
import { stylize, makeRng } from '../src/ink/aug.js';

const PER = Number(process.argv[2] || 30);
const rng = makeRng(31337);                 // held out from training and the hard suite

const place = (variant, x, y, s) => variant.map(stroke => ({
  points: stroke.map(([px, py]) => ({ x: x + (px / 100) * s, y: y + (py / 100) * s }))
}));

/** Lay a sequence of symbols out as one written line. */
function writeLine(syms, { strength, gap, size, jitterY }) {
  let x = 0;
  const strokes = [];
  for (const sym of syms) {
    const variants = TEMPLATES[sym];
    if (!variants) throw new Error(`no template for ${sym}`);
    const v = variants[Math.floor(rng() * variants.length)].map(st => st.map(p => p.slice()));
    const warped = stylize(v, rng, strength);
    const s = size * (0.9 + rng() * 0.2);
    strokes.push(...place(warped, x, jitterY * (rng() * 2 - 1) * size, s));
    // advance by the glyph's own width plus the spacing under test
    let w = 0;
    for (const st of warped) for (const p of st) w = Math.max(w, p[0]);
    x += (w / 100) * s + gap * size;
  }
  return strokes;
}

// ── expression grammar: what a student actually writes ───────────────────────
const D = () => String(Math.floor(rng() * 10));
const NZ = () => String(1 + Math.floor(rng() * 9));
const VAR = () => ['x', 'y', 'n', 't', 'a', 'k'][Math.floor(rng() * 6)];
const num = (len) => {
  const out = [NZ()];
  for (let i = 1; i < len; i++) out.push(D());
  return out;
};

const FORMS = [
  // 2x+35=105
  () => { const a = num(1), b = num(1 + Math.floor(rng() * 2)), c = num(2 + Math.floor(rng() * 2));
          return [...a, VAR(), '+', ...b, '=', ...c]; },
  // 7n-4=17
  () => { const a = num(1), b = num(1 + Math.floor(rng() * 2)), c = num(1 + Math.floor(rng() * 2));
          return [...a, VAR(), '-', ...b, '=', ...c]; },
  // x=12.5
  () => [VAR(), '=', ...num(1 + Math.floor(rng() * 2)), '.', D()],
  // 3(x+4)
  () => [...num(1), '(', VAR(), rng() < 0.5 ? '+' : '-', ...num(1), ')'],
  // sin(theta)=0.5
  () => { const f = [['s', 'i', 'n'], ['c', 'o', 's'], ['t', 'a', 'n'], ['l', 'n'], ['l', 'o', 'g']][Math.floor(rng() * 5)];
          return [...f, VAR()]; },
  // 24/6=4
  () => { const a = num(2), b = num(1); return [...a, '/', ...b, '=', ...num(1)]; },
  // x<=15
  () => [VAR(), ['<', '>', '<=', '>='][Math.floor(rng() * 4)], ...num(1 + Math.floor(rng() * 2))],
  // 45deg
  () => [...num(2), 'deg'],
  // pure number strings — the bread and butter
  () => num(2 + Math.floor(rng() * 3)),
  // 2x=1pm3
  () => [...num(1), VAR(), '=', ...num(1), 'pm', ...num(1)],
];

// how the recogniser is expected to render each symbol in its output string
const OUT = { pi: 'pi', theta: 'theta', sqrt: 'sqrt', percent: '%', div: '/', pm: '±', deg: '°' };
const expected = (syms) => {
  const fns = ['sin', 'cos', 'tan', 'ln', 'log'];
  const s = syms.map(y => OUT[y] || y).join('');
  // function names are decoded as f(arg)
  for (const f of fns) {
    if (s.startsWith(f) && s.length > f.length) return `${f}(${s.slice(f.length)})`;
  }
  return s;
};

// ── conditions: neat → messy, roomy → cramped ───────────────────────────────
const CONDITIONS = [
  { name: 'neat · roomy',    strength: 0.45, gap: 0.30, size: 46, jitterY: 0.03 },
  { name: 'neat · tight',    strength: 0.45, gap: 0.10, size: 46, jitterY: 0.03 },
  { name: 'natural · roomy', strength: 0.90, gap: 0.28, size: 44, jitterY: 0.06 },
  { name: 'natural · tight', strength: 0.90, gap: 0.09, size: 44, jitterY: 0.06 },
  { name: 'messy · roomy',   strength: 1.35, gap: 0.30, size: 42, jitterY: 0.09 },
  { name: 'messy · tight',   strength: 1.35, gap: 0.10, size: 42, jitterY: 0.09 },
];

const editDistance = (a, b) => {
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
};

let totExact = 0, totLines = 0, totChars = 0, totErrs = 0;
const rows = [];
const samples = [];

for (const cond of CONDITIONS) {
  let exact = 0, chars = 0, errs = 0;
  for (let i = 0; i < PER; i++) {
    const syms = FORMS[Math.floor(rng() * FORMS.length)]();
    const want = expected(syms);
    const strokes = writeLine(syms, cond);
    const got = recognize(strokes).text.replace(/\s+/g, '');
    if (got === want) exact++;
    else if (samples.length < 12) samples.push(`${cond.name.padEnd(15)} want "${want}"  got "${got}"`);
    chars += want.length;
    errs += editDistance(want, got);
  }
  rows.push({ cond: cond.name, exact, chars, errs });
  totExact += exact; totLines += PER; totChars += chars; totErrs += errs;
}

console.log('\nLine-level recognition (exact string match, and per-character accuracy)\n');
for (const r of rows) {
  const cAcc = 100 * (1 - r.errs / r.chars);
  console.log(`  ${r.cond.padEnd(16)} exact ${String(r.exact).padStart(3)}/${PER} (${String(Math.round(100 * r.exact / PER)).padStart(3)}%)   chars ${cAcc.toFixed(1)}%`);
}
const exactPct = 100 * totExact / totLines;
const charPct = 100 * (1 - totErrs / totChars);
console.log(`\n  OVERALL          exact ${totExact}/${totLines} (${exactPct.toFixed(1)}%)   chars ${charPct.toFixed(1)}%`);

if (samples.length) {
  console.log('\nsample misreads:');
  for (const s of samples) console.log('  ' + s);
}

// Cramped conditions are the over-merge canary: if a merge rule is too greedy
// the tight rows collapse well below the roomy ones.
const roomy = rows.filter((_, i) => i % 2 === 0).reduce((a, r) => a + r.exact, 0);
const tight = rows.filter((_, i) => i % 2 === 1).reduce((a, r) => a + r.exact, 0);
const spacingDrop = roomy ? 100 * (roomy - tight) / roomy : 0;
console.log(`\n  spacing sensitivity: roomy ${roomy} vs tight ${tight} exact — ${spacingDrop.toFixed(0)}% drop when cramped`);

const ok = charPct >= 90 && exactPct >= 60 && spacingDrop <= 35;
console.log(`\n${ok ? '✔ LINE SUITE PASSED' : '✖ LINE SUITE FAILED'} — ${exactPct.toFixed(1)}% lines exact, ${charPct.toFixed(1)}% chars, ${spacingDrop.toFixed(0)}% cramped drop`);
process.exit(ok ? 0 : 1);
