// Pri Learning · which steps of the worked solution are not in the working (engine/missingSteps.js).
//
// Owner, 19 November 2026: a competitor's marked page says what is missing
// ("the ordinate is missing"). This is feedback only: it is shown for an answer
// that is not right, it names steps whose values are nowhere on the page, and
// no mark reads it.
import { missingSteps } from '../src/engine/missingSteps.js';
import { stepEvidence } from '../../server/platform/markerOps.js';
import { plainTex } from '../src/engine/checker.js';
import { loadAllBanks, generateQuestion } from '../src/engine/generators/index.js';
import { NSW_ISSUED_CELLS } from '../src/engine/nswIssuedCells.js';
import { readFileSync } from 'node:fs';
import en from '../src/i18n/strings.en.js';
import hi from '../src/i18n/strings.hi.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('FAIL:', m); } };
const Q = { answerType: 'numeric', answer: { value: 5 }, prompt: 'Find the stationary points.', steps: [
  { h: 'Derivative', d: "$f'(x) = \\frac{-x^2+6x-5}{e^x}$" }, { h: 'Stationary x values', d: '$x = 1$ and $x = 5$' },
  { h: 'y-coordinates', d: '$f(1) = -\\frac{2}{e}$, $f(5) = \\frac{6}{e^5}$' }, { h: 'In words', d: 'The gradient changes sign.' }] };
const PAGE = ["f'(x) = (-x^2 + 6x - 5)/e^x", '(x - 5)(x - 1) = 0', 'x = 5', 'x = 1'];

let r = missingSteps(Q, PAGE.join('\n'));
ok(r && r.missing.map(m => m.step).join() === '3' && r.missing[0].heading === 'y-coordinates' && r.found === 2 && r.total === 3, `the owner's page: only the y-coordinates step is missing (${JSON.stringify(r)})`);
ok(missingSteps(Q, [...PAGE, 'f(1) = -2/e', 'f(5) = 6/e^5'].join('\n')) === null, 'with the y-coordinates written, nothing is missing');
ok(missingSteps(Q, [...PAGE, 'y = -2/e'].join('\n')) === null, 'a step counts as found when any one of its values is on the page (lenient on purpose)');
ok(missingSteps(Q, '') === null && missingSteps({ steps: [] }, PAGE.join('\n')) === null && missingSteps(Q, 'some words only') === null, 'no working, no steps or nothing readable: nothing is said');
ok(!JSON.stringify(r).includes('In words'), 'a step with no value to read is never reported');
ok(missingSteps({ steps: [{ h: 'Round', d: '$\\sqrt{740} \\approx 27.2$' }] }, 'x = 27.20') === null && missingSteps({ steps: [{ h: 'Round', d: '$\\sqrt{740} \\approx 27.2$' }] }, 'x = sqrt(740)') === null && missingSteps({ steps: [{ h: 'Round', d: '$\\sqrt{740} \\approx 27.2$' }] }, 'x = 16.12')?.missing.length === 1, 'a rounded value or its exact form both count as found');
ok(missingSteps({ steps: [{ h: 'Trivial', d: '$x = 1$' }] }, 'y = 7') === null, 'a step that reaches only 0, 1 or -1 is not reported');
ok(missingSteps({ steps: [{ h: 'Expand', d: '$(x+1)^2 = x^2 + 2x + 1$' }] }, 'y = x^2 + 2x + 1') === null && missingSteps({ steps: [{ h: 'Expand', d: '$(x+1)^2 = x^2 + 2x + 1$' }] }, 'y = x^2 + 1')?.missing[0].heading === 'Expand', 'expressions are matched as expressions');

// wiring: shown only for an answer that is not right; no mark is touched
const working = PAGE.join('\n');
const wrong = stepEvidence(Q, '3', working, { correct: false });
ok(Array.isArray(wrong.stepReport?.missing) && wrong.stepReport.missing[0].step === 3 && wrong.partial === null, `a wrong answer's report carries the missing steps and no partial credit (${JSON.stringify(wrong.stepReport?.missing)})`);
const right = stepEvidence(Q, '5', working, { correct: true });
ok(right.stepReport && right.stepReport.missing === undefined, 'a right answer is never told a step is missing');
const card = readFileSync(new URL('../src/components/QuestionCard.jsx', import.meta.url), 'utf8');
ok(/data-working-missing/.test(card) && /!verdictGood && Array\.isArray\(res\?\.stepReport\?\.missing\)/.test(card), 'the result card shows it only when the verdict is not good');
ok(/another method/.test(JSON.stringify(en['verdict.workingMissing'])) && hi['verdict.workingMissing'] && !/wrong|incorrect|mark/i.test(JSON.stringify(en['verdict.workingMissing'])), 'the wording says "not found", allows another method, and claims no mark and no error');

// sweep: on every offered Year 11 and 12 question, the worked solution's own values are never reported missing
await loadAllBanks();
let swept = 0, falseMissing = 0, readable = 0;
for (const g of Object.keys(NSW_ISSUED_CELLS).filter(k => /^(ma1[12]|me1[12]|y1[12])-/.test(k))) for (const d of NSW_ISSUED_CELLS[g]) for (let s = 1; s <= 6; s++) {
  let q; try { q = generateQuestion(g, d, s * 7919 + d); } catch { continue; }
  if (!q || q.answerType === 'mcq' || !Array.isArray(q.steps) || !q.steps.length) continue;
  swept++;
  // the page is the worked solution itself, one line per maths span
  // the page is the worked solution itself, one line per maths span, as plain text
  const page = q.steps.flatMap(st => [...String(st.d || '').matchAll(/\$([^$]+)\$/g)].map(m => { try { return plainTex(m[1].replace(/\\approx|\\simeq/g, '=')) || ''; } catch { return ''; } })).filter(Boolean).join('\n');
  const own = missingSteps(q, page);
  if (own) { falseMissing++; if (falseMissing < 4) console.error('own solution reported missing', g, d, JSON.stringify(own.missing)); }
  if (missingSteps(q, 'x = 987654')) readable++;
}
ok(swept >= 500, `the sweep ran (${swept} questions)`);
ok(falseMissing === 0, `a page that is the worked solution itself is never told a step is missing (${falseMissing})`);
ok(readable / swept > 0.5, `most worked solutions have at least one step this can read (${readable} of ${swept})`);

console.log(`MISSING STEPS: ${fail ? 'FAIL' : 'PASS'} — ${pass}/${pass + fail} checks — steps of the worked solution not found on the page are named for an answer that is not right; feedback only, no mark`);
if (fail) process.exit(1);
