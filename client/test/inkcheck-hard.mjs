// ─────────────────────────────────────────────────────────────────────────────
// HARD handwriting suite — messy-writer stress test.
// Every symbol under heavy style distortion (slant, warp, tails, speed), plus
// full scenes: function names, mixed digit/letter lines, sloppy equations.
// Usage: node client/test/inkcheck-hard.mjs [trials]
// ─────────────────────────────────────────────────────────────────────────────
import { TEMPLATES } from '../src/ink/templates.js';
import { recognize, segment, classify } from '../src/ink/recognizer.js';
import { stylize, makeRng } from '../src/ink/aug.js';

const TRIALS = Number(process.argv[2] || 24);
const rng = makeRng(777001);   // held-out seed space (training used 20260819)

const place = (variant, x, y, s) => variant.map(stroke => ({
  points: stroke.map(([px, py]) => ({ x: x + (px / 100) * s, y: y + (py / 100) * s }))
}));

const styled = (sym, strength, x = 0, y = 0, size = 60) => {
  const variants = TEMPLATES[sym];
  const v = variants[Math.floor(rng() * variants.length)].map(st => st.map(p => p.slice()));
  const warped = stylize(v, rng, strength);
  return place(warped, x, y, size);
};

function classifyOne(strokes) {
  const groups = segment(strokes);
  if (groups.length !== 1) return { sym: `SEGFAIL(${groups.length})` };
  return classify(groups[0], 60);
}

// context-dependent readings that are CORRECT under the maths prior
const ACCEPT = {
  l: ['l', '1'], o: ['o', '0', 'deg'], i: ['i'], g: ['g', '9'], q: ['q', '9'],
  '0': ['0', 'o'], '1': ['1', 'l'],
};

// ── 1. Heavy single-symbol distortion ───────────────────────────────────────
let pass = 0, tot = 0;
const conf = {};
for (const sym of Object.keys(TEMPLATES)) {
  if ([':', 'deg', '.'].includes(sym)) continue;   // size-contextual — scene-tested
  for (let t = 0; t < TRIALS; t++) {
    const strength = 0.9 + rng() * 0.8;            // messy → very messy
    const strokes = styled(sym, strength, rng() * 150, rng() * 150, 40 + rng() * 45);
    const res = classifyOne(strokes);
    const okSet = ACCEPT[sym] || [sym];
    tot++;
    if (okSet.includes(res.sym)) pass++;
    else conf[`${sym}→${res.sym}`] = (conf[`${sym}→${res.sym}`] || 0) + 1;
  }
}
console.log(`Heavy-distortion symbols: ${pass}/${tot} (${(100 * pass / tot).toFixed(1)}%)`);
const top = Object.entries(conf).sort((a, b) => b[1] - a[1]).slice(0, 12);
if (top.length) console.log('worst:', top.map(([k, v]) => `${k}×${v}`).join('  '));

// ── 2. Messy scenes (styled glyphs laid out as writing) ─────────────────────
function scene(items, strength = 0.8) {
  // items: [sym, x, y, size]
  return items.flatMap(([sym, x, y, s]) => styled(sym, strength, x, y, s));
}
let sPass = 0, sTot = 0;
const expectScene = (name, strokes, want, wantAlso = []) => {
  const r = recognize(strokes);
  const got = r.text.replace(/\s+/g, '');
  const wants = [want, ...wantAlso].map(w => w.replace(/\s+/g, ''));
  const ok = wants.includes(got);
  sTot++; if (ok) sPass++;
  console.log(`${ok ? 'PASS' : 'FAIL'} scene: ${name} → "${r.text}"${ok ? '' : ` (wanted "${want}")`}`);
};

for (let round = 0; round < 3; round++) {
  const st = 0.55 + round * 0.35;
  // sinθ
  expectScene(`sin theta (s=${st.toFixed(2)})`, scene([
    ['s', 0, 20, 40], ['i', 34, 20, 40], ['n', 68, 22, 38], ['theta', 112, 16, 44]
  ], st), 'sin(theta)');
  // cosx = 1/2 (linear slash)
  expectScene(`cos x (s=${st.toFixed(2)})`, scene([
    ['c', 0, 20, 40], ['o', 38, 22, 38], ['s', 74, 20, 40], ['x', 116, 20, 42],
    ['=', 165, 22, 36], ['1', 210, 18, 42], ['/', 240, 18, 44], ['2', 272, 20, 42]
  ], st), 'cos(x)=1/2');
  // tanθ
  expectScene(`tan theta (s=${st.toFixed(2)})`, scene([
    ['t', 0, 16, 44], ['a', 36, 24, 36], ['n', 72, 24, 36], ['theta', 116, 16, 44]
  ], st), 'tan(theta)');
  // 2x+35=105
  expectScene(`equation (s=${st.toFixed(2)})`, scene([
    ['2', 0, 20, 42], ['x', 32, 22, 40], ['+', 76, 24, 34], ['3', 118, 20, 42], ['5', 150, 20, 42],
    ['=', 196, 24, 34], ['1', 240, 20, 42], ['0', 270, 20, 42], ['5', 302, 20, 42]
  ], st), '2x+35=105');
  // ln x
  expectScene(`ln x (s=${st.toFixed(2)})`, scene([
    ['l', 0, 14, 46], ['n', 26, 26, 34], ['x', 68, 22, 40]
  ], st), 'ln(x)');
}

console.log(`Scenes: ${sPass}/${sTot}`);

// ── 3. Digit strings under messiness (the bread and butter) ─────────────────
let dPass = 0, dTot = 0;
for (let t = 0; t < 40; t++) {
  const len = 2 + Math.floor(rng() * 3);
  const digits = Array.from({ length: len }, () => String(Math.floor(rng() * 10)));
  let x = 0;
  const strokes = digits.flatMap(d => {
    const s = styled(d, 0.9 + rng() * 0.5, x, rng() * 8, 40 + rng() * 12);
    x += 46 + rng() * 10;
    return s;
  });
  const r = recognize(strokes);
  dTot++;
  if (r.text === digits.join('')) dPass++;
}
console.log(`Messy digit strings: ${dPass}/${dTot} (${(100 * dPass / dTot).toFixed(0)}%)`);

// ── 4. Personal learning: a MISREAD glyph becomes right after ONE sample ─────
// This check has to prove two things, and until now it proved neither. It used a
// European crossed 7, which the stock templates already read as "7" — so the
// assertion `after.sym === '7'` held with addPersonal deleted entirely. A check
// that passes with the feature removed is not a check.
// The barred one below is genuinely misread: the stock recogniser calls it "2".
// So the glyph is asserted WRONG first and RIGHT after a single correction, and
// deleting addPersonal now fails the suite.
const { addPersonal } = await import('../src/ink/personal.js');
const L = (x1, y1, x2, y2, n = 10) => Array.from({ length: n }, (_, i) => [x1 + (x2 - x1) * i / (n - 1), y1 + (y2 - y1) * i / (n - 1)]);
const barred1 = [L(50, 12, 50, 88), L(30, 88, 70, 88), L(34, 26, 50, 12)];
const mk = (v, x, y, s) => v.map(st => ({ points: st.map(([px, py]) => ({ x: x + px / 100 * s, y: y + py / 100 * s })) }));
const before = classifyOne(mk(barred1, 10, 10, 60));
await addPersonal('1', mk(barred1, 0, 0, 100), 'test');
const after = classifyOne(mk(barred1, 40, 25, 52));
const misreadFirst = before.sym !== '1';
const learned = misreadFirst && after.sym === '1';
console.log(`Personal learning: before="${before.sym}"${misreadFirst ? '' : ' (NOT A MISREAD — this check proves nothing)'} → after one correction="${after.sym}" ${learned ? 'PASS' : 'FAIL'}`);

const okAll = pass / tot >= 0.87 && sPass / sTot >= 0.86 && dPass / dTot >= 0.85 && learned;
console.log(`\n${okAll ? '✔ HARD SUITE PASSED' : '✖ HARD SUITE FAILED'} — symbols ${(100 * pass / tot).toFixed(1)}%, scenes ${sPass}/${sTot}, digit strings ${(100 * dPass / dTot).toFixed(0)}%, learns-your-hand ${learned ? 'yes' : 'NO'}`);
process.exit(okAll ? 0 : 1);
