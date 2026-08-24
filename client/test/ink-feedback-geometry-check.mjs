// Regression for the exact class of iPad feedback bug where detached side
// working shares a vertical band with an equation. The verdict must remain on
// the equation glyphs instead of stretching across the canvas.
import { feedbackGeometry } from '../src/ink/feedbackGeometry.js';

let failures = 0;
const check = (name, ok) => {
  if (ok) { console.log(`  ok   ${name}`); return; }
  failures++;
  console.log(`  FAIL ${name}`);
};
const sym = (x1, y1, w = 28, h = 34) => ({ box: { x1, y1, x2: x1 + w, y2: y1 + h, w, h } });

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

console.log(`\n${failures ? `FAIL — ${failures} feedback geometry regression(s)` : 'PASS — feedback stays grounded to the intended handwriting'}`);
process.exit(failures ? 1 : 0);
