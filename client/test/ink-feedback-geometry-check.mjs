// Regression for the exact class of iPad feedback/recognition bug where
// detached side working shares a vertical band with an equation.
import { feedbackGeometry } from '../src/ink/feedbackGeometry.js';
import { recognizeWithoutDetachedSideWork } from '../src/ink/runtimeSpatial.js';

let failures = 0;
const check = (name, ok) => {
  if (ok) { console.log(`  ok   ${name}`); return; }
  failures++;
  console.log(`  FAIL ${name}`);
};
const sym = (x1, y1, w = 28, h = 34) => ({ box: { x1, y1, x2: x1 + w, y2: y1 + h, w, h } });
const stroke = (x, y, w = 12, h = 30) => ({ points: [{ x, y }, { x: x + w, y: y + h }] });

console.log('\nPri Ink feedback geometry\n');

// Screenshot-shaped case: the first algebra line lives on the left while a
// factor tree is drawn hundreds of pixels away on the right at the same y.
const equation = [120, 160, 205, 250, 302, 350, 400, 450].map(x => sym(x, 100));
const factorTree = [980, 1030, 1080].map((x, i) => sym(x, 92 + i * 8, 24, 30));
const mixed = {
  symbols: [...equation, ...factorTree],
  box: { x: 120, y: 92, w: 984, h: 54 }
};
const repaired = feedbackGeometry(mixed);
check('detects detached side working', repaired.detached === true && repaired.detachedCount === 1);
check('keeps every equation glyph in the marked component', repaired.boxes.length === equation.length);
check('does not highlight the far-right factor tree', repaired.anchor && repaired.anchor.x2 < 600);
check('does not use the giant legacy line rectangle', repaired.anchor && repaired.anchor.w < 450);

// Normal school maths can contain generous spacing around operators. It should
// still remain one feedback component unless the gap is genuinely detached.
const spaced = {
  symbols: [sym(100, 200), sym(145, 200), sym(225, 200), sym(280, 200), sym(345, 200)],
  box: { x: 100, y: 200, w: 273, h: 34 }
};
const ordinary = feedbackGeometry(spaced);
check('ordinary maths spacing remains one component', ordinary.detached === false && ordinary.boxes.length === 5);

// Raised powers overlap the base in x/y structure and must stay attached.
const exponent = {
  symbols: [sym(100, 300, 30, 38), sym(126, 280, 15, 18), sym(160, 300, 28, 38)],
  box: { x: 100, y: 280, w: 88, h: 58 }
};
const power = feedbackGeometry(exponent);
check('superscript geometry stays in the same feedback component', power.detached === false && power.boxes.length === 3);

console.log('\nPri Ink V3 detached-side-work runtime guard\n');

// Two aligned equation rows, eight physical strokes each.
const row1 = Array.from({ length: 8 }, (_, i) => stroke(100 + i * 28, 90));
const row2 = Array.from({ length: 8 }, (_, i) => stroke(100 + i * 28, 180));
// A compact factor tree / scratch calculation far to the right. It deliberately
// shares the y-band of the main rows so the old v3 splitter would absorb it.
const side = [
  stroke(940, 92, 18, 26), stroke(970, 118, 20, 28),
  stroke(1000, 150, 16, 28), stroke(1030, 180, 18, 28)
];
const page = [...row1, ...row2, ...side];
let seenLengths = [];
const fakeRecognize = (input, overrides = {}) => {
  seenLengths.push(input.length);
  const chosen = overrides.s0 || 'x';
  return {
    lines: [{
      text: chosen,
      symbols: [{ id: 's0', sym: chosen, conf: 0.9, alts: [{ sym: chosen, conf: 0.9 }], strokeIdxs: [0], box: { x1: input[0].points[0].x, y1: input[0].points[0].y, x2: input[0].points[1].x, y2: input[0].points[1].y } }],
      box: { x: input[0].points[0].x, y: input[0].points[0].y, w: 12, h: 30 }
    }],
    text: chosen,
    symbols: [], minConf: 0.9, margin: 0.5, weakest: null
  };
};
const guarded = recognizeWithoutDetachedSideWork(page, {}, null, fakeRecognize);
check('V3 fallback excludes far-right scratch strokes before recognition', seenLengths[0] === 16 && guarded.ignoredAuxiliaryStrokeCount === 4);
check('spatially guarded symbol ids are grounded to original stroke ids', guarded.lines[0].symbols[0].id.startsWith('g0:'));

const stableId = guarded.lines[0].symbols[0].id;
seenLengths = [];
const corrected = recognizeWithoutDetachedSideWork(page, { [stableId]: '7' }, null, fakeRecognize);
check('tap-to-correct survives spatial filtering', corrected.lines[0].text === '7' && seenLengths.length === 2 && seenLengths.every(n => n === 16));

// No detached lane => byte-path stays the old recogniser call, so the safety
// guard cannot perturb normal handwriting merely by existing.
seenLengths = [];
recognizeWithoutDetachedSideWork([...row1, ...row2], {}, null, fakeRecognize);
check('ordinary one-column working stays on the unmodified V3 path', seenLengths.length === 1 && seenLengths[0] === 16);

console.log(`\n${failures ? `FAIL — ${failures} handwriting spatial regression(s)` : 'PASS — feedback and fallback recognition stay grounded to the intended handwriting'}`);
process.exit(failures ? 1 : 0);
