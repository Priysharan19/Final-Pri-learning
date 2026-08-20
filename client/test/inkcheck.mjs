// ─────────────────────────────────────────────────────────────────────────────
// Handwriting recognizer accuracy harness.
// 1. Jittered/scaled/translated template variants must classify correctly.
// 2. Independently-authored probe shapes (NOT in the template set) must too.
// 3. Layout scenes (equations, fractions, roots, exponents) must assemble.
// Usage: node client/test/inkcheck.mjs [trials]
// ─────────────────────────────────────────────────────────────────────────────
import { TEMPLATES } from '../src/ink/templates.js';
import { recognize, segment, classify, exprToLatex } from '../src/ink/recognizer.js';

const TRIALS = Number(process.argv[2] || 30);

// simple seeded rng
let seed = 12345;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const jitter = amt => (rnd() * 2 - 1) * amt;

/** Instantiate a template's strokes at (x, y) with size `s`, with noise. */
function place(variant, x, y, s, noise = 0) {
  return variant.map(stroke => ({
    points: stroke.map(([px, py]) => ({
      x: x + (px / 100) * s + jitter(noise * s),
      y: y + (py / 100) * s + jitter(noise * s)
    }))
  }));
}

function classifyOne(strokes) {
  const groups = segment(strokes);
  if (groups.length !== 1) return { sym: `SEGFAIL(${groups.length})` };
  // realistic surrounding-text scale: symbols in context are ~40-70px tall
  return classify(groups[0], 60);
}

// ── 1. Self-recognition under distortion ─────────────────────────────────────
let pass = 0, fail = 0;
const confusions = {};
for (const [sym, variants] of Object.entries(TEMPLATES)) {
  if (sym === ':' || sym === 'deg') continue; // context-dependent size — tested in layout scenes below
  for (let t = 0; t < TRIALS; t++) {
    const v = variants[t % variants.length];
    const size = 30 + rnd() * 60;
    const strokes = place(v, rnd() * 200, rnd() * 200, size, 0.035);
    const res = classifyOne(strokes);
    if (res.sym === sym) pass++;
    else {
      fail++;
      const key = `${sym}→${res.sym}`;
      confusions[key] = (confusions[key] || 0) + 1;
    }
  }
}
const total = pass + fail;
console.log(`\nSymbol self-recognition: ${pass}/${total} (${Math.round(100 * pass / total)}%)`);
const confList = Object.entries(confusions).sort((a, b) => b[1] - a[1]);
if (confList.length) console.log('confusions:', confList.slice(0, 12).map(([k, v]) => `${k}×${v}`).join('  '));

// ── 2. Independent probe shapes (different from templates) ───────────────────
const L = (x1, y1, x2, y2, n = 12) => Array.from({ length: n }, (_, i) => [x1 + (x2 - x1) * i / (n - 1), y1 + (y2 - y1) * i / (n - 1)]);
const A = (cx, cy, rx, ry, a0, a1, n = 16) => Array.from({ length: n }, (_, i) => { const a = (a0 + (a1 - a0) * i / (n - 1)) * Math.PI / 180; return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)]; });
const j2 = (...parts) => parts.flat();

const PROBES = {
  '0': [[A(50, 50, 28, 40, 300, 660)]],
  '1': [[L(50, 12, 47, 88, 14)]],
  '2': [[j2(A(47, 30, 23, 21, 205, 350, 9), L(64, 40, 28, 84, 9), L(28, 84, 72, 84, 7))]],
  '3': [[j2(A(45, 30, 21, 19, 215, 375, 11), A(47, 68, 24, 21, 275, 465, 13))]],
  '5': [[j2(L(66, 14, 38, 14, 5), L(38, 14, 35, 45, 7), A(50, 63, 22, 21, 225, 435, 12))]],
  '7': [[j2(L(28, 15, 72, 13, 7), L(72, 13, 45, 88, 11))]],
  '8': [[j2(A(50, 31, 19, 19, 280, -50, 11), A(50, 70, 22, 21, 255, 615, 13))]],
  'x': [[L(30, 22, 72, 84, 9), L(72, 24, 28, 84, 9)]],
  '+': [[L(50, 25, 50, 78, 9), L(25, 51, 78, 51, 9)]],
  '=': [[L(24, 40, 78, 39, 9), L(24, 60, 78, 59, 9)]],
  '(': [[A(75, 50, 40, 45, 142, 218, 12)]],
  ')': [[A(25, 50, 40, 45, 38, -38, 12)]],
  'sqrt': [[j2(L(15, 60, 28, 88, 7), L(28, 88, 42, 15, 9), L(42, 15, 88, 13, 9))]],
  '.': [[A(50, 85, 3.5, 3.5, 0, 360, 7)]],
  '-': [[L(22, 51, 80, 49, 9)]],
  'c': [[A(60, 50, 28, 36, 60, 300, 13)]],
  'v': [[j2(L(30, 28, 51, 86, 9), L(51, 86, 72, 32, 9))]],
  'z': [[j2(L(28, 30, 72, 29, 7), L(72, 29, 28, 86, 9), L(28, 86, 74, 85, 7))]],
  'k': [[L(32, 10, 32, 88, 11), j2(L(66, 32, 31, 56, 7), L(38, 51, 68, 88, 7))]],
  'div': [[A(50, 24, 4.5, 4.5, 0, 360, 6), L(22, 51, 80, 50, 9), A(50, 78, 4.5, 4.5, 0, 360, 6)]],
  '!=': [[L(24, 38, 79, 36, 9), L(24, 61, 79, 59, 9), L(64, 16, 38, 86, 9)]],
  'pm': [[L(50, 14, 50, 60, 9), L(26, 39, 76, 37, 8), L(24, 82, 78, 80, 8)]]
};
let ppass = 0, pfail = 0;
const pconf = [];
for (const [sym, variants] of Object.entries(PROBES)) {
  for (let t = 0; t < 10; t++) {
    const strokes = place(variants[0], rnd() * 100, rnd() * 100, 35 + rnd() * 40, 0.03);
    const res = classifyOne(strokes);
    if (res.sym === sym) ppass++;
    else { pfail++; pconf.push(`${sym}→${res.sym}`); }
  }
}
console.log(`Probe generalisation: ${ppass}/${ppass + pfail} (${Math.round(100 * ppass / (ppass + pfail))}%)`);
if (pconf.length) console.log('probe confusions:', [...new Set(pconf)].join('  '));

// ── 3. Layout scenes ─────────────────────────────────────────────────────────
const T = sym => TEMPLATES[sym][0];
function scene(items) {
  // items: [sym, x, y, size]
  return items.flatMap(([sym, x, y, s]) => place(T(sym), x, y, s, 0.02));
}
const layoutTests = [];
const expect = (name, strokes, want) => {
  const r = recognize(strokes);
  const got = r.text.replace(/\s+/g, '');
  const wanted = want.replace(/\s+/g, '');
  const ok = got === wanted;
  layoutTests.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'} layout: ${name} → "${r.text}"${ok ? '' : ` (wanted "${want}")`}`);
};

// 2x + 3 = 13  (one line)
expect('2x+3=13', scene([
  ['2', 0, 20, 40], ['x', 45, 22, 38], ['+', 95, 22, 36], ['3', 140, 20, 40],
  ['=', 190, 22, 36], ['1', 238, 20, 40], ['3', 270, 20, 40]
]), '2x+3=13');

// two lines: "2x=10" / "x=5"
expect('two lines', scene([
  ['2', 0, 0, 36], ['x', 40, 2, 34], ['=', 82, 2, 32], ['1', 124, 0, 36], ['0', 155, 0, 36],
  ['x', 10, 90, 34], ['=', 52, 92, 32], ['5', 96, 90, 36]
]), '2x=10\nx=5');

// fraction 3/4 (vertical): 3 at y 0-30, bar at y≈38, 4 at y 48-76
expect('fraction 3 over 4', [
  ...place(T('3'), 18, 2, 30, 0.02),
  ...place([L(0, 0, 100, 0, 10)], 4, 38, 58, 0.01),
  ...place(T('4'), 18, 48, 30, 0.02)
], '(3)/(4)');

// sqrt(2)
expect('sqrt 2', [
  ...place(T('sqrt'), 0, 0, 60, 0.02),
  ...place(T('2'), 28, 12, 32, 0.02)
], 'sqrt(2)');

// x^2
expect('x squared', [
  ...place(T('x'), 0, 30, 40, 0.02),
  ...place(T('2'), 42, 8, 22, 0.02)
], 'x^(2)');

// 3.5
expect('3.5 decimal', [
  ...place(T('3'), 0, 10, 40, 0.02),
  ...place(T('.'), 40, 10, 40, 0.01),
  ...place(T('5'), 60, 10, 40, 0.02)
], '3.5');

// (x+1)
expect('(x+1)', scene([
  ['(', 0, 8, 44], ['x', 30, 14, 34], ['+', 70, 16, 30], ['1', 108, 12, 38], [')', 138, 8, 44]
]), '(x+1)');

// ratio 2:3 — colon assembled from two dots in context
expect('2:3 ratio', scene([
  ['2', 0, 10, 40], [':', 46, 12, 38], ['3', 78, 10, 40]
]), '2:3');

// 90° — the degree mark is a small high circle after digits
expect('90 degrees', scene([
  ['9', 0, 10, 40], ['0', 45, 10, 40], ['deg', 92, 6, 36]
]), '90°');

// 12 ÷ 4 = 3 — the obelus reads as a division slash
expect('12 divided by 4', scene([
  ['1', 0, 10, 40], ['2', 30, 10, 40], ['div', 78, 12, 38], ['4', 124, 10, 40],
  ['=', 170, 12, 36], ['3', 214, 10, 40]
]), '12/4=3');

// x ≤ 5 — chevron with underbar
expect('x <= 5', scene([
  ['x', 0, 12, 38], ['<=', 48, 10, 40], ['5', 98, 10, 40]
]), 'x<=5');

// x = 1 ± 2 — plus-minus in an answer line
expect('x = 1 pm 2', scene([
  ['x', 0, 12, 38], ['=', 44, 14, 34], ['1', 88, 10, 40], ['pm', 122, 10, 40], ['2', 168, 10, 40]
]), 'x=1±2');

// mixed number 2½ — whole digit beside a stacked fraction
expect('mixed number 2 1/2', [
  ...place(T('2'), 0, 8, 44, 0.02),
  ...place(T('1'), 62, 0, 24, 0.02),
  ...place([L(0, 0, 100, 0, 10)], 52, 36, 46, 0.01),
  ...place(T('2'), 62, 46, 24, 0.02)
], '2 (1)/(2)');

// ── 3b. Every two-digit combination at pen-perfect geometry ─────────────────
// (zero jitter is the degenerate case: closed loops, exact chords)
let comboFails = 0;
for (let a = 0; a <= 9; a++) {
  for (let b = 0; b <= 9; b++) {
    const digits = [String(a), String(b)];
    let ox = 40;
    let strokes = [];
    for (const ch of digits) {
      strokes = strokes.concat(TEMPLATES[ch][0].map(stroke => ({ points: stroke.map(([px, py]) => ({ x: ox + px / 100 * 63, y: 60 + py / 100 * 90 })) })));
      ox += 68;
    }
    const r = recognize(strokes);
    if (r.text !== digits.join('')) { comboFails++; console.log('FAIL combo', digits.join(''), '→', r.text); }
  }
}
console.log(`Two-digit combos (pen-perfect): ${100 - comboFails}/100`);

// ── 4. exprToLatex ───────────────────────────────────────────────────────────
const lx = [
  ['sqrt(2)', '\\sqrt{2}'],
  ['(3)/(4)', '\\frac{3}{4}'],
  ['x^(2)', 'x^{2}'],
  ['2pi', '2\\pi '],
  ['x<=5', 'x \\le 5'],
  ['90°', '90^{\\circ}'],
  ['x=1±2', 'x=1 \\pm 2']
];
let lpass = 0;
for (const [inp, want] of lx) {
  const got = exprToLatex(inp);
  if (got === want) lpass++;
  else console.log(`FAIL latex: ${inp} → ${got} (wanted ${want})`);
}
console.log(`exprToLatex: ${lpass}/${lx.length}`);

const layoutPass = layoutTests.filter(Boolean).length;
const okAll = pass / total >= 0.93 && ppass / (ppass + pfail) >= 0.85 && layoutPass === layoutTests.length && lpass === lx.length && comboFails === 0;
console.log(`\n${okAll ? '✔ RECOGNIZER SUITE PASSED' : '✖ RECOGNIZER SUITE FAILED'} — self ${Math.round(100 * pass / total)}%, probes ${Math.round(100 * ppass / (ppass + pfail))}%, layout ${layoutPass}/${layoutTests.length}`);
process.exit(okAll ? 0 : 1);
