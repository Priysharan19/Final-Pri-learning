// Pri Learning · the instrument's night tokens read at WCAG AA
// (owner request, 19 Nov 2026: the app opens dark for Prithagoras, so the dark
// tokens of client/src/instrument/instrument.css must hold).
//
//   text tokens        4.5:1 on every instrument surface (base, l1 to l3; l4 for
//                      the text a pressed or selected row carries)
//   --in-tx-4          the dimmest text/mark colour: 4.5:1 on base and l1 to l3
//   control border     3:1 on every surface a control sits on, base to l4
//
// Measured from the stylesheet itself, so a token edit that breaks a pair fails here.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../src/instrument/instrument.css'), 'utf8');
const start = css.indexOf('html.ui-instrument[data-theme="dark"] {');
const night = css.slice(start, css.indexOf('\n}', start));
const token = name => { const m = night.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`)); assert.ok(m, `--${name} is a solid colour in the night block`); return m[1]; };
const lum = hex => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

let pass = 0;
const check = (name, fn) => { fn(); pass++; console.log(`  ok  ${name}`); };
const SURFACES = ['in-base', 'in-l1', 'in-l2', 'in-l3', 'in-l4'];

check('body and secondary text, signal and state colours are AA on base and l1 to l4', () => {
  for (const t of ['in-tx', 'in-tx-2', 'in-tx-3', 'in-bad', 'in-good', 'in-slip', 'in-unc']) {
    for (const s of SURFACES) assert.ok(ratio(token(t), token(s)) >= 4.5, `--${t} on --${s} is ${ratio(token(t), token(s)).toFixed(2)}:1`);
  }
});
check('the dimmest text colour is AA on base and l1 to l3', () => {
  for (const s of SURFACES.slice(0, 4)) assert.ok(ratio(token('in-tx-4'), token(s)) >= 4.5, `--in-tx-4 on --${s} is ${ratio(token('in-tx-4'), token(s)).toFixed(2)}:1`);
});
check('the control border is 3:1 on every instrument surface', () => {
  for (const s of SURFACES) assert.ok(ratio(token('control-border'), token(s)) >= 3, `--control-border on --${s} is ${ratio(token('control-border'), token(s)).toFixed(2)}:1`);
});
check('the text ladder keeps its order (tx brighter than tx-2, tx-2 than tx-3, tx-3 than tx-4)', () => {
  const l = n => lum(token(n));
  assert.ok(l('in-tx') > l('in-tx-2') && l('in-tx-2') > l('in-tx-3') && l('in-tx-3') > l('in-tx-4'));
});
console.log(`dark-contrast-check: ${pass} checks passed`);
