// Smart feedback — number, sequences and series, financial maths.
// Each slip has wrong-line fixtures (named specifically, on the right line),
// and correct working must never be flagged. Reports specificity and right-line
// rate. Pure engine check: no network, no model, no mark touched.
import assert from 'node:assert/strict';
import { NUMBER_SLIPS } from '../src/engine/misconceptions/topics/number.js';
import { SEQUENCE_SLIPS } from '../src/engine/misconceptions/topics/sequences.js';
import { FINANCE_SLIPS } from '../src/engine/misconceptions/topics/finance.js';
import { detectSlip } from '../src/engine/misconceptions/topics/_run.js';

const ALL = [...NUMBER_SLIPS, ...SEQUENCE_SLIPS, ...FINANCE_SLIPS];
let pass = 0; const bad = [];
const ok = (c, m) => { if (c) pass += 1; else { bad.push(m); console.log('  ✖ ' + m); } };

// [slip code, previous (true) line, student's line]
const WRONG = [
  ['left-to-right-order', '2 + 3 × 4', '20'], ['left-to-right-order', '10 - 2 × 3', '24'], ['left-to-right-order', '5 + 6 / 2', '5.5'],
  ['fraction-add-across', '(1/2) + (1/3)', '2/5'], ['fraction-add-across', '(3/4) + (1/6)', '4/10'], ['fraction-add-across', '(5/6) - (1/3)', '4/3'],
  ['fraction-multiply-common-denominator', '(2/5) × (3/5)', '6/5'], ['fraction-multiply-common-denominator', '(1/4) × (3/4)', '3/4'],
  ['percent-not-divided', '15/100 × 80', '1200'], ['percent-not-divided', '8/100 × 250', '2000'],
  ['percent-change-wrong-base', '240 × (1 + 0.15)', '240.15'], ['percent-change-wrong-base', '500 × (1 - 0.2)', '499.8'],
  ['subtract-negative-as-subtract', '7 - -3', '4'], ['subtract-negative-as-subtract', '2 - -5', '-3'],
  ['round-down-only', '3.678', '3.67'], ['round-down-only', '12.8', '12'],
  ['significant-figures-as-decimals', '0.004567', '0.005'], ['significant-figures-as-decimals', '12.3456', '12.35'],
  ['ratio-share-by-part', '600 × (2/5)', '300'], ['ratio-share-by-part', '84 × (3/7)', '28'],
  ['ap-term-n-not-n-minus-1', '3 + (10 - 1) × 4', '3 + 10 × 4'], ['ap-term-n-not-n-minus-1', '7 + (20 - 1) × 2', '7 + 20 × 2'],
  ['gp-term-power-n', '3 × 2^(8 - 1)', '3 × 2^8'], ['gp-term-power-n', '5 × 3^(6 - 1)', '5 × 3^6'],
  ['ap-sum-half-dropped', '(10/2) × (4 + 31)', '10 × (4 + 31)'], ['ap-sum-half-dropped', '(20/2) × (3 + 60)', '20 × (3 + 60)'],
  ['sum-to-infinity-plus-r', '12 / (1 - 0.25)', '12 / (1 + 0.25)'], ['sum-to-infinity-plus-r', '8 / (1 - 0.5)', '8 / (1 + 0.5)'],
  ['sigma-terms-missing-plus-1', '(12 - 4) + 1', '12 - 4'], ['sigma-terms-missing-plus-1', '(30 - 5) + 1', '30 - 5'],
  ['compound-as-simple', '5000 × (1 + 0.08)^3', '5000 × (1 + 0.24)'], ['compound-as-simple', '12000 × (1 + 0.06)^5', '12000 × (1 + 0.3)'],
  ['rate-not-per-period', '8000 × (1 + 0.06/12)^36', '8000 × (1 + 0.06)^36'], ['rate-not-per-period', '2500 × (1 + 0.04/4)^20', '2500 × (1 + 0.04)^20'],
  ['periods-not-multiplied', '9000 × (1 + 0.05/4)^(4 × 3)', '9000 × (1 + 0.05/4)^3'], ['periods-not-multiplied', '1500 × (1 + 0.09/12)^(12 × 2)', '1500 × (1 + 0.09/12)^2'],
  ['percent-rate-not-converted', '5000 × (1 + 0.08)^3', '5000 × (1 + 8)^3'], ['percent-rate-not-converted', '4000 × (1 - 0.15)^2', '4000 × (1 - 15)^2'],
  ['depreciation-added', '30000 × (1 - 0.2)^3', '30000 × (1 + 0.2)^3'], ['depreciation-added', '80000 × (1 - 0.1)^4', '80000 × (1 + 0.1)^4'],
  ['reducing-balance-as-straight-line', '30000 × (1 - 0.2)^3', '30000 × (1 - 0.6)'], ['reducing-balance-as-straight-line', '50000 × (1 - 0.15)^2', '50000 × (1 - 0.3)'],
  ['annuity-not-divided-by-rate', '200 × ((1 + 0.05)^10 - 1)/0.05', '200 × ((1 + 0.05)^10 - 1)'], ['annuity-not-divided-by-rate', '1000 × ((1 + 0.04)^6 - 1)/0.04', '1000 × ((1 + 0.04)^6 - 1)']
];
// Correct working: each pair is an equivalent step.
const RIGHT = [
  ['2 + 3 × 4', '2 + 12'], ['2 + 12', '14'], ['1/2 + 1/3', '3/6 + 2/6'], ['3/6 + 2/6', '5/6'], ['15/100 × 80', '12'], ['240 × (1 + 0.15)', '276'],
  ['7 - -3', '7 + 3'], ['7 + 3', '10'], ['3.678', '3.678'], ['600 × (2/5)', '240'], ['3 + (10 - 1) × 4', '3 + 36'], ['3 + 36', '39'],
  ['3 × 2^(8 - 1)', '3 × 128'], ['(10/2) × (4 + 31)', '5 × 35'], ['12 / (1 - 0.25)', '12 / 0.75'], ['12 / 0.75', '16'], ['(12 - 4) + 1', '9'],
  ['5000 × (1 + 0.08)^3', '5000 × 1.259712'], ['8000 × (1 + 0.06/12)^36', '8000 × (1 + 0.005)^36'], ['30000 × (1 - 0.2)^3', '30000 × 0.512'],
  ['9000 × (1 + 0.05/4)^(4 × 3)', '9000 × (1 + 0.0125)^12'], ['200 × ((1 + 0.05)^10 - 1)/0.05', '200 × 12.5778925']
];

let specific = 0;
for (const [code, prev, broken] of WRONG) {
  const got = detectSlip(ALL, prev, broken);
  if (got?.code === code) specific += 1;
  ok(got?.code === code, `${code}: "${prev}" → "${broken}" named ${got?.code || 'nothing'}`);
}
for (const [prev, next] of RIGHT) ok(detectSlip(ALL, prev, next) === null, `correct step flagged: "${prev}" → "${next}"`);

// Right line: in a worked solution the FIRST line that departs from the true
// value is the one named, and every earlier line is clean.
const WORKINGS = [
  { lines: ['2 + 3 × 4', '2 + 12', '14'], bad: null }, { lines: ['2 + 3 × 4', '5 × 4', '20'], bad: 1 },
  { lines: ['3 + (10 - 1) × 4', '3 + 10 × 4', '43'], bad: 1 }, { lines: ['3 + (10 - 1) × 4', '3 + 9 × 4', '39'], bad: null },
  { lines: ['5000 × (1 + 0.08)^3', '5000 × (1 + 0.24)', '6200'], bad: 1 }, { lines: ['5000 × (1 + 0.08)^3', '5000 × 1.259712', '6298.56'], bad: null }
];
let rightLine = 0;
for (const w of WORKINGS) {
  let flagged = null;
  for (let i = 1; i < w.lines.length && flagged === null; i += 1) if (detectSlip(ALL, w.lines[i - 1], w.lines[i])) flagged = i;
  if (flagged === w.bad) rightLine += 1;
  ok(flagged === w.bad, `right line: ${w.lines.join(' ⏎ ')} flagged ${flagged} expected ${w.bad}`);
}
const bySlip = Object.fromEntries(ALL.map(s => [s.code, WRONG.filter(w => w[0] === s.code).length]));
ok(Object.values(bySlip).every(n => n >= 2), 'every slip has at least two wrong-line fixtures');
ok(ALL.every(s => typeof s.copy === 'function' && s.copy({ n: 3, r: 0.1, d: 2, m: 12, a: 2, tot: 5, p: 15, line: 'x', got: '1', left: 'a', right: 'b', op: '+', value: '1', dp: 1, cut: '1', rounded: '1', up: true, top: 9, bottom: 1, pct: 8 }, { edition: 'au' }).message.length > 20), 'every slip has a one-sentence message');
console.log(`\nSMART NUMBER / SERIES / FINANCE: ${pass} passed, ${bad.length} failed — specific ${specific}/${WRONG.length} (${Math.round(100 * specific / WRONG.length)}%), right line ${rightLine}/${WORKINGS.length}, correct steps flagged 0/${RIGHT.length}`);
if (bad.length) process.exit(1);
