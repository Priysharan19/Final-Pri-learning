// Pri Learning · the REAL engine reports behind the teacher-marked page's browser tour
//
// The tour must not show a report somebody typed. This script runs the server's own marking path (checkAnswer, then stepEvidence, the call the
// practice route makes) on two transcribed pages and saves exactly what comes back, with the page lines, for the gallery to draw:
//
//   wrong    the stationary-points page of the owner's 18 Nov photo (the reader's text), marked against the generated question it belongs to
//            (y12-appdiff, difficulty 1, seed 450: y = 2x^3 + 9x^2, the y-coordinate at the smaller x), with the slip on `0 = 6x[x + 4]`
//   owner19  the owner's 19-line reference page (y = 4x^3 - 36x^2, the larger x-coordinate), marked against a question built here with the same
//            structured meta the generators use. There is no generated question for this exact curve.
//
//   node server/test/support/teacher-page-real-reports.mjs           write client/test/support/teacher-page-real-reports.json
//   node server/test/support/teacher-page-real-reports.mjs --check   fail when the saved file is not what the engine returns today
import '../support/hermetic.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { stepEvidence } from '../../platform/markerOps.js';
import { checkAnswer } from '../../../client/src/engine/checker.js';
import * as G from '../../../client/src/engine/generators/index.js';

const OUT = new URL('../../../client/test/support/teacher-page-real-reports.json', import.meta.url);
await G.loadAllBanks();

const WRONG_LINES = ['y = 2x^3 + 9x^2', "y' = 6x^2 + 18x", "for stat points y' = 0", '0 = 6x^2 + 18x', '0 = 6x[x + 4]', '@@@', 'foo', 'x = 0 or x = -3', 'smallest: (0,0)'];
const FOLLOWED_LINES = ['y = 2x^3 + 9x^2', "y' = 6x^2 + 18x", "for stat points y' = 0", '0 = 6x^2 + 18x', '0 = 6x[x + 4]', 'x = 0 or x = -4', 'smallest: (-4,0)'];
const OWNER19_LINES = [
  'Solution:', 'y = 4x^3 - 36x^2', 'dy/dx = 12x^2 - 72x', 'Stationary points when dy/dx = 0:', '12x^2 - 72x = 0', '12x(x - 6) = 0', 'x = 0 or x = 6',
  'd2y/dx2 = 24x - 72', 'At x = 0: d2y/dx2 = -72 < 0', '(local maximum)', 'At x = 6: d2y/dx2 = 72 > 0', '(local minimum)',
  'The stationary points are:', 'At x = 0: y = 4(0)^3 - 36(0)^2 = 0', 'At x = 6: y = 4(6)^3 - 36(6)^2 = 4(216) - 36(36)', '= 864 - 1296 = -432',
  '(0, 0) and (6, -432)', 'The two stationary points are (0,0) and (6,-432).', 'The larger x-coordinate is 6'
];
const OWNER19_Q = {
  id: 'owner-stationary-4x3-36x2', contentId: 'gen:y12-appdiff:d1:owner-19-line-page', answerType: 'numeric', answerPrefix: 'x =', answer: { value: 6 }, difficulty: 1,
  prompt: 'The curve $y = 4x^3 - 36x^2$ has two stationary points. Find the **larger** $x$-coordinate.',
  stepcheck: { kind: 'value-chain', fn: { name: 'y', variable: 'x', expr: '(4)*x^3+(-36)*x^2' }, curve: { derivative: '(12)*x^2+(-72)*x', stationary: [0, 6], choose: 'larger' } },
  steps: [{ h: 'Stationary $x$-values', d: "$y' = 12x^2 - 72x = 0 \\Rightarrow x = 0, 6$" }, { h: 'Choose', d: 'The larger is $x = 6$' }]
};

function run(q, lines, answer) {
  const res = checkAnswer(q, answer);
  const ev = stepEvidence(q, answer, lines.join('\n'), res, { slipWarnings: true });
  return { question: { prompt: q.prompt, answer: q.answer }, answer, correct: res.correct === true, lines, stepReport: JSON.parse(JSON.stringify(ev.stepReport)), ...(ev.shownReport ? { shownReport: JSON.parse(JSON.stringify(ev.shownReport)) } : {}) };
}
const wrongQ = G.generateQuestion('y12-appdiff', 1, 450);
const out = { note: 'The server marking path (checkAnswer, stepEvidence) on transcribed pages. Regenerate with server/test/support/teacher-page-real-reports.mjs.',
  pages: { wrong: run(wrongQ, WRONG_LINES, '0'), followed: run(wrongQ, FOLLOWED_LINES, '-4'), owner19: run(OWNER19_Q, OWNER19_LINES, '6') } };
const text = JSON.stringify(out, null, 1) + '\n';
if (process.argv.includes('--check')) {
  if (readFileSync(OUT, 'utf8') !== text) { console.error('teacher-page-real-reports: the saved file is not what the engine returns today; run the script without --check'); process.exit(1); }
  console.log('teacher-page-real-reports: the saved reports are what the engine returns today');
} else { writeFileSync(OUT, text); console.log('wrote', OUT.pathname); }
