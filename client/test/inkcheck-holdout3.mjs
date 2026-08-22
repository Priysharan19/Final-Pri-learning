// Third writer-separated synthetic holdout.
//
// IMPORTANT: this seed is disjoint from training/dev/hard/holdout #1/#2 and
// must not be tuned against. This suite deliberately prints aggregate/per-writer
// scores but not the actual misread expressions, so it can remain an honest
// regression benchmark after the earlier holdouts have been inspected.
import { TEMPLATES } from '../src/ink/templates.js';
import { recognize } from '../src/ink/recognizer.js';
import { stylize, makeRng } from '../src/ink/aug.js';

const WRITERS = Number(process.argv[2] || 40);
const rng = makeRng(822202611); // untouched V11 holdout seed

function makeWriter(r) {
  return {
    slant: (r() * 2 - 1) * 0.30,
    aspect: 0.85 + r() * 0.35,
    size: 38 + r() * 16,
    spacing: 0.06 + r() * 0.26,
    drift: (r() * 2 - 1) * 0.05,
    wobble: 0.35 + r() * 1.05,
    sizeVar: 0.04 + r() * 0.10
  };
}

function applyHand(strokes, w) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const st of strokes) for (const p of st) {
    if (p[0] < x1) x1 = p[0];
    if (p[0] > x2) x2 = p[0];
    if (p[1] < y1) y1 = p[1];
    if (p[1] > y2) y2 = p[1];
  }
  const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
  return strokes.map(st => st.map(([x, y]) => {
    let px = x - cx, py = (y - cy) * w.aspect;
    px += w.slant * py;
    return [px + cx, py + cy];
  }));
}

const place = (variant, x, y, s) => variant.map(stroke => ({
  points: stroke.map(([px, py]) => ({ x: x + (px / 100) * s, y: y + (py / 100) * s }))
}));

function writeLine(syms, w, y0) {
  let x = 0;
  const strokes = [];
  for (let i = 0; i < syms.length; i++) {
    const sym = syms[i];
    const variants = TEMPLATES[sym];
    if (!variants) throw new Error(`no template for ${sym}`);
    const v = variants[Math.floor(rng() * variants.length)].map(st => st.map(p => p.slice()));
    const warped = applyHand(stylize(v, rng, w.wobble), w);
    const s = w.size * (1 + (rng() * 2 - 1) * w.sizeVar);
    const y = y0 + w.drift * w.size * i;
    strokes.push(...place(warped, x, y, s));
    let wid = 0;
    for (const st of warped) for (const p of st) wid = Math.max(wid, p[0]);
    x += (wid / 100) * s + w.spacing * w.size;
  }
  return strokes;
}

const D = () => String(Math.floor(rng() * 10));
const NZ = () => String(1 + Math.floor(rng() * 9));
const V = () => ['x', 'y', 'n', 'a', 'k', 't'][Math.floor(rng() * 6)];
const num = len => { const o = [NZ()]; for (let i = 1; i < len; i++) o.push(D()); return o; };

const FORMS = [
  () => [...num(1), V(), '+', ...num(2), '=', ...num(2)],
  () => [...num(1), V(), '-', ...num(1), '=', ...num(2)],
  () => [V(), '=', ...num(2), '/', ...num(1)],
  () => [V(), '=', ...num(1), '.', D(), D()],
  () => ['(', V(), '+', ...num(1), ')', '(', V(), '-', ...num(1), ')'],
  () => [...num(1), V(), '=', ...num(1), 'pm', ...num(1)],
  () => [V(), '<=', ...num(2)],
  () => [...num(2), 'percent'],
  () => [...num(2), 'deg'],
  () => ['s', 'i', 'n', V(), '=', ...num(1), '.', D()],
  () => ['c', 'o', 's', V(), '=', ...num(1), '/', ...num(1)],
  () => [...num(3)],
  () => [...num(1), V(), '+', ...num(1), V(), '=', ...num(2)],
  () => [V(), '=', '-', ...num(1)],
  () => [...num(1), ':', ...num(1)]
];

const OUT = { pi: 'pi', theta: 'theta', sqrt: 'sqrt', percent: '%', div: '/', pm: '±', deg: '°' };
function expected(syms) {
  const t = syms.map(y => OUT[y] || y);
  for (const f of ['sin', 'cos', 'tan', 'ln', 'log']) {
    const n = f.length;
    if (t.length > n && t.slice(0, n).join('') === f) return `${f}(${t[n]})${t.slice(n + 1).join('')}`;
  }
  return t.join('');
}

function editDistance(a, b) {
  const n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

let exact = 0, lines = 0, chars = 0, errs = 0;
const perWriter = [];
for (let wi = 0; wi < WRITERS; wi++) {
  const w = makeWriter(rng);
  let wExact = 0;
  for (let k = 0; k < 14; k++) {
    const syms = FORMS[Math.floor(rng() * FORMS.length)]();
    const want = expected(syms);
    const got = recognize(writeLine(syms, w, 0)).text.replace(/\s+/g, '');
    lines++;
    if (got === want) { exact++; wExact++; }
    chars += want.length;
    errs += editDistance(want, got);
  }
  perWriter.push({ wi, exact: wExact, slant: w.slant, spacing: w.spacing, wobble: w.wobble });
}

console.log('\nHeld-out #3: untouched consistent simulated writers, multi-form working\n');
for (const p of perWriter) {
  console.log(`  writer ${String(p.wi).padStart(2)}  ${String(p.exact).padStart(2)}/14 exact` +
    `   (slant ${p.slant.toFixed(2)}, spacing ${p.spacing.toFixed(2)}, wobble ${p.wobble.toFixed(2)})`);
}
const exactPct = 100 * exact / lines;
const charPct = 100 * (1 - errs / chars);
const worst = Math.min(...perWriter.map(p => p.exact / 14));
console.log(`\n  HELD-OUT-3   exact ${exact}/${lines} (${exactPct.toFixed(1)}%)   chars ${charPct.toFixed(1)}%`);
console.log(`  worst writer: ${(100 * worst).toFixed(0)}% exact`);
console.log(`\nHELD-OUT-3 SCORE — ${exactPct.toFixed(1)}% lines, ${charPct.toFixed(1)}% chars, worst writer ${(100 * worst).toFixed(0)}%`);
