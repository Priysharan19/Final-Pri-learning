// ─────────────────────────────────────────────────────────────────────────────
// HELD-OUT suite — the honest number.
//
// Everything else in this directory is a tuning target, and anything tuned
// against is eventually tuned *to*. This file exists to catch that. It differs
// from inkcheck-lines.mjs on every axis that matters:
//
//   · a different seed space entirely
//   · different expressions — multi-line working, fractions, roots, powers,
//     negatives, units — rather than single-line equations
//   · a WRITER model instead of per-glyph randomness. A real person has one
//     hand: their slant, size ratio, spacing and baseline drift are consistent
//     down the page, and only fine detail varies glyph to glyph. Randomising
//     every glyph independently, as the tuning suites do, is both easier (errors
//     don't correlate) and unrealistic. Here each simulated writer is fixed and
//     every line they write inherits it.
//
// Treat this as the score. Do not tune against it.
// Usage: node client/test/inkcheck-holdout.mjs [writers]
// ─────────────────────────────────────────────────────────────────────────────
import { TEMPLATES } from '../src/ink/templates.js';
import { recognize } from '../src/ink/recognizer.js';
import { stylize, makeRng } from '../src/ink/aug.js';

const WRITERS = Number(process.argv[2] || 12);
const rng = makeRng(90210);              // held out from training (20260819) and hard (777001)

/** A writer: one hand, consistent all the way down the page. */
function makeWriter(r) {
  return {
    slant:   (r() * 2 - 1) * 0.30,       // consistent italic lean
    aspect:  0.85 + r() * 0.35,          // tall or squat, but the same throughout
    size:    38 + r() * 16,
    spacing: 0.06 + r() * 0.26,          // cramped or airy
    drift:   (r() * 2 - 1) * 0.05,       // baseline creeps up or down the line
    wobble:  0.35 + r() * 1.05,          // how steady the hand is
    sizeVar: 0.04 + r() * 0.10           // glyph-to-glyph size consistency
  };
}

/** Apply the writer's fixed hand on top of the per-glyph variation. */
function applyHand(strokes, w) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const st of strokes) for (const p of st) {
    if (p[0] < x1) x1 = p[0]; if (p[0] > x2) x2 = p[0];
    if (p[1] < y1) y1 = p[1]; if (p[1] > y2) y2 = p[1];
  }
  const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
  return strokes.map(st => st.map(([x, y]) => {
    let px = x - cx, py = (y - cy) * w.aspect;
    px += w.slant * py;                  // shear — the writer's lean
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
    // baseline creeps as the writer moves across the page
    const y = y0 + w.drift * w.size * i;
    strokes.push(...place(warped, x, y, s));
    let wid = 0;
    for (const st of warped) for (const p of st) wid = Math.max(wid, p[0]);
    x += (wid / 100) * s + w.spacing * w.size;
  }
  return strokes;
}

// ── what students actually write when working a problem ─────────────────────
const D = () => String(Math.floor(rng() * 10));
const NZ = () => String(1 + Math.floor(rng() * 9));
const V = () => ['x', 'y', 'n', 'a', 'k', 't'][Math.floor(rng() * 6)];
const num = (len) => { const o = [NZ()]; for (let i = 1; i < len; i++) o.push(D()); return o; };

const FORMS = [
  () => [...num(1), V(), '+', ...num(2), '=', ...num(2)],
  () => [...num(1), V(), '-', ...num(1), '=', ...num(2)],
  () => [V(), '=', ...num(2), '/', ...num(1)],
  () => [V(), '=', ...num(1), '.', D(), D()],
  () => ['(', V(), '+', ...num(1), ')', '(', V(), '-', ...num(1), ')'],
  () => [...num(1), V(), '=', ...num(1), 'pm', ...num(1)],
  () => [V(), '<=', ...num(2)],
  () => [...num(2), '%'.replace('%', 'percent')],
  () => [...num(2), 'deg'],
  () => ['s', 'i', 'n', V(), '=', ...num(1), '.', D()],
  () => ['c', 'o', 's', V(), '=', ...num(1), '/', ...num(1)],
  () => [...num(3)],
  () => [...num(1), V(), '+', ...num(1), V(), '=', ...num(2)],
  () => [V(), '=', '-', ...num(1)],
  () => [...num(1), ':', ...num(1)],
];

const OUT = { pi: 'pi', theta: 'theta', sqrt: 'sqrt', percent: '%', div: '/', pm: '±', deg: '°' };
/** A function takes the ONE token after it as its argument — "sin x = 9.4" is
 *  sin(x)=9.4, not sin(x=9.4). Wrapping the rest of the line was a bug in this
 *  harness that scored correct readings as failures. */
const expected = (syms) => {
  const t = syms.map(y => OUT[y] || y);
  for (const f of ['sin', 'cos', 'tan', 'ln', 'log']) {
    const n = f.length;
    if (t.length > n && t.slice(0, n).join('') === f) {
      return `${f}(${t[n]})${t.slice(n + 1).join('')}`;
    }
  }
  return t.join('');
};

const editDistance = (a, b) => {
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
};

let exact = 0, lines = 0, chars = 0, errs = 0;
const perWriter = [];
const misreads = [];

for (let wi = 0; wi < WRITERS; wi++) {
  const w = makeWriter(rng);
  let wExact = 0, wLines = 0;
  for (let k = 0; k < 14; k++) {
    const syms = FORMS[Math.floor(rng() * FORMS.length)]();
    const want = expected(syms);
    const got = recognize(writeLine(syms, w, 0)).text.replace(/\s+/g, '');
    lines++; wLines++;
    if (got === want) { exact++; wExact++; }
    else if (misreads.length < 14) misreads.push(`w${wi} want "${want}"  got "${got}"`);
    chars += want.length;
    errs += editDistance(want, got);
  }
  perWriter.push({ wi, wExact, wLines, slant: w.slant, spacing: w.spacing, wobble: w.wobble });
}

console.log('\nHeld-out: consistent simulated writers, multi-form working\n');
for (const p of perWriter) {
  console.log(`  writer ${String(p.wi).padStart(2)}  ${String(p.wExact).padStart(2)}/${p.wLines} exact` +
    `   (slant ${p.slant.toFixed(2)}, spacing ${p.spacing.toFixed(2)}, wobble ${p.wobble.toFixed(2)})`);
}
const exactPct = 100 * exact / lines;
const charPct = 100 * (1 - errs / chars);
console.log(`\n  HELD-OUT   exact ${exact}/${lines} (${exactPct.toFixed(1)}%)   chars ${charPct.toFixed(1)}%`);

if (misreads.length) {
  console.log('\nsample misreads:');
  for (const m of misreads) console.log('  ' + m);
}

// worst-writer accuracy matters as much as the mean: a student whose hand the
// engine cannot read does not care about the average.
const worst = Math.min(...perWriter.map(p => p.wExact / p.wLines));
console.log(`\n  worst writer: ${(100 * worst).toFixed(0)}% exact`);
console.log(`\nHELD-OUT SCORE — ${exactPct.toFixed(1)}% lines, ${charPct.toFixed(1)}% chars, worst writer ${(100 * worst).toFixed(0)}%`);
