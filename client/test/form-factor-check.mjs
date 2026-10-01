// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · semantic form factors (CP-03)
//
// The classification every layout decision rests on, and the handwriting
// canvas sizing that must never shrink the iPad (EXPANDED) writing area.
// Run on its own:  node client/test/form-factor-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { BREAKPOINTS, classify, inkCanvasHeight } from '../src/platform/formFactor.js';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };

ok(BREAKPOINTS.medium === 600 && BREAKPOINTS.expanded === 840 && BREAKPOINTS.shortMaxHeight === 480,
  'breakpoints are the FORM_FACTOR_SPEC literals (600 / 840 / 480)');

const cases = [
  [360, 640, 'compact', false], [390, 844, 'compact', false], [430, 932, 'compact', false],
  [599, 900, 'compact', false], [600, 900, 'medium', false], [744, 1133, 'medium', false],
  [820, 1180, 'medium', false], [839, 600, 'medium', false], [840, 600, 'expanded', false],
  [1180, 820, 'expanded', false], [1366, 1024, 'expanded', false], [844, 390, 'expanded', true],
  [667, 375, 'medium', true], [2000, 480, 'expanded', true], [2000, 481, 'expanded', false],
];
for (const [w, h, ff, short] of cases) {
  const c = classify(w, h, true);
  ok(c.formFactor === ff && c.short === short, `${w}×${h} is ${ff}${short ? ' + short' : ''} (got ${c.formFactor}${c.short ? ' + short' : ''})`);
}
ok(Object.isFrozen(classify(390, 844)), 'a classification is immutable');

// The iPad baseline: EXPANDED and tall MEDIUM windows keep the requested height.
for (const [w, h] of [[1180, 820], [1366, 1024], [820, 1180], [744, 1133]]) {
  ok(inkCanvasHeight(380, classify(w, h)) === 380, `${w}×${h} keeps the 380px writing area`);
}
// Phones get a canvas that fits under the chrome, never below 240px.
ok(inkCanvasHeight(380, classify(360, 640)) === 310, 'a 360×640 phone gets a 310px writing area that fits the screen');
ok(inkCanvasHeight(380, classify(390, 844)) === 380, 'a 390×844 phone has room for the full 380px');
ok(inkCanvasHeight(380, classify(320, 480)) === 240, 'nothing shrinks below 240px');
ok(inkCanvasHeight(380, classify(844, 390)) === 240, 'a short landscape window uses the 240px minimum and scrolls');
ok(inkCanvasHeight(500, classify(1180, 820)) === 500, 'a larger requested height is honoured on EXPANDED');

// No device sniffing anywhere in the module.
const src = readFileSync(new URL('../src/platform/formFactor.js', import.meta.url), 'utf8');
ok(!/userAgent|navigator\.platform|iPad|iPhone|Android/.test(src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')), 'the form-factor module never looks at device identity');

console.log(failures.length
  ? `FORM FACTOR: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `FORM FACTOR: PASS — ${pass}/${pass} checks — COMPACT/MEDIUM/EXPANDED + SHORT from the viewport alone, and the iPad writing area never shrinks.`);
process.exit(failures.length ? 1 : 0);
