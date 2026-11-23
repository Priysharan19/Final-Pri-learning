// ───────────────────────────────────────────────────────────────────────────────
// Pri Learning · the owner's product-rule page, REAL engine report into the marked-page model
//
// No synthetic report: the question and the nine lines are marked by the real engine (checkAnswer + stepEvidence), and the report it
// returns goes through buildAnnotatedWorking and buildMarkedPage, the same two calls the client makes. What the page then shows:
//
//   ticks on lines 2, 3, 5, 6, 7 and 8, each with a specific comment; lines 1 and 4 context; a cross on line 9;
//   the header says where the first error is; the panel for line 9 has what changed, why it is wrong, the corrected line,
//   the check and what was kept.
//
//   node server/test/marked-page-real-report-check.mjs
// ───────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import { stepEvidence } from '../platform/markerOps.js';
import { checkAnswer } from '../../client/src/engine/checker.js';
import { buildAnnotatedWorking } from '../../client/src/components/annotatedWorkingModel.js';
import { buildMarkedPage, commentItems, defaultLine } from '../../client/src/components/markedPageModel.js';
import { commentFor } from '../../client/src/engine/lineCommentary.js';
import { readFileSync } from 'node:fs';
import { lookupString } from '../../client/src/i18n/core.js';
import en from '../../client/src/i18n/strings.en.js';

let pass = 0; const failures = [];
const ok = (c, l) => { if (c) pass++; else failures.push(l); };
const t = (k, v) => lookupString(en, k, v, 'en');

const QUESTION = { id: 'owner-product-rule', answerType: 'expression', difficulty: 3, steps: [], answer: { expr: '3x^2-2x' },
  prompt: 'Use the product rule to differentiate $y = x^{2}(x - 1)$, giving your answer expanded and simplified.' };
const PAGE = ['Differentiate y = x^2(x-1) using the product rule.', 'Let u = x^2 and v = x - 1.', "Then u' = 2x and v' = 1.", 'By the product rule,', "dy/dx = u'v + uv'", '= 2x(x-1) + x^2(1)', '= 2x(x-1) + x^2', '= 2x^2 - 2x + x^2', '= 3x^2 - x'];

const answer = '3x^2-x';
const res = checkAnswer(QUESTION, answer);
const ev = stepEvidence(QUESTION, answer, PAGE.join('\n'), res, { slipWarnings: true });
const report = ev.stepReport;
ok(res.correct === false && !!report, 'the engine marks the final answer wrong and returns a step report');

// The gallery shows a saved copy of this report: it must be exactly what the engine returns today.
const saved = JSON.parse(readFileSync(new URL('../../client/test/support/product-rule-real-report.json', import.meta.url), 'utf8'));
ok(JSON.stringify(saved.stepReport) === JSON.stringify(JSON.parse(JSON.stringify(report))) && JSON.stringify(saved.lines) === JSON.stringify(PAGE), 'the report saved for the marked-page gallery is the engine\'s report today');

// The client's two calls, on the engine's report as it is.
const model = buildAnnotatedWorking({ lines: PAGE, stepReport: report });
const page = buildMarkedPage({ model });
ok(!!model && !!page && page.lines.length === 9, 'the page model has nine lines');
const line = n => page.lines[n - 1];

// ticks on 2, 3, 5, 6, 7, 8, each with its own specific comment
const ticked = [2, 3, 5, 6, 7, 8];
ok(ticked.every(n => line(n).status === 'checked'), `lines 2,3,5,6,7,8 are ticks: ${page.lines.map(l => l.status)}`);
// What the panel says on a tick is commentFor(card), built from the engine's own structured `how` and `note` (the panel's `say`).
const said = n => commentFor(line(n).card, {})?.text ?? '';
ok(ticked.every(n => said(n).trim().length > 15), `each tick carries a non-empty comment: ${ticked.map(said).join(' | ')}`);
ok(new Set(ticked.map(said)).size === ticked.length, 'the comments differ from line to line, none is boilerplate');
ok(ticked.every(n => !/^(this line is|correct\.?|ok\.?)$/i.test(said(n).trim())), 'no generic filler comment');
ok(/product rule/i.test(said(5)), `line 5 names the product rule: ${said(5)}`);
ok(/2x\^2 - 2x/.test(said(8)), `line 8 names its expansion: ${said(8)}`);

// lines 1 and 4 are context; they are neither ticks nor "not checked", and they say nothing false
ok(line(1).status === 'condition' && line(4).status === 'condition', 'lines 1 and 4 are context');
ok(page.collapsed === null && page.header.counts.unchecked === 0, 'no line is counted as not checked');
ok(page.header.counts.right === 6 && page.header.counts.wrong === 1, `counts: ${JSON.stringify(page.header.counts)}`);

// the cross on 9, and the header sentence
ok(line(9).status === 'first-error' && page.firstError === 9 && defaultLine(page) === 9, 'line 9 is the cross, and the one selected first');
ok(page.firstBreakLine === 9, `the engine's zero-based firstBreak 8 reads as line 9 (got ${page.firstBreakLine})`);
const sentence = page.header.parts.map(p => t(p.key, p.vars)).join(' ');
ok(/first error is on line 9\b/.test(sentence), `header: ${sentence}`);
ok(!/line 8\b.*first error/i.test(sentence.replace('Correct up to line 8.', '')), 'the header does not put the first error on any other line');

// the panel for line 9
const c9 = line(9).card;
const f = c9.facts || {};
ok(typeof f.whatChanged === 'string' && /-2x/.test(f.whatChanged) && /-x/.test(f.whatChanged), `whatChanged: ${f.whatChanged}`);
ok(typeof f.whyWrong === 'string' && f.whyWrong.trim().length > 20, `whyWrong: ${f.whyWrong}`);
ok(c9.corrected === '= 3x^2 - 2x', `corrected: ${c9.corrected}`);
ok(typeof f.check === 'string' && /x = 1/.test(f.check), `check: ${f.check}`);
ok(typeof f.kept === 'string' && /before line 9/.test(f.kept), `kept: ${f.kept}`);
ok(f.fromLine === 8, `fromLine: ${f.fromLine}`);
ok(typeof c9.comment === 'string' && c9.comment.includes(f.whatChanged), 'the cross keeps the engine\'s plain message for an old reader');
ok(said(1) === '' && said(4) === '', 'context lines carry no praise');

// the comments column lists every judged line, in order, and nothing is collapsed
const items = commentItems(page);
ok(items.length === 9 && items.every(i => i.kind === 'line'), 'nine line items, no collapsed card');

// nothing here is a dash in the copy the page shows
const shown = [sentence, ...ticked.map(said), c9.comment, f.whatChanged, f.whyWrong, f.check, f.kept].join(' ');
ok(!/[—–]/.test(shown), 'no em dash or en dash in anything the page shows');

if (failures.length) { console.error(`MARKED PAGE REAL REPORT: FAIL (${failures.length})`); for (const f2 of failures) console.error(`  ${f2}`); process.exit(1); }
console.log(`MARKED PAGE REAL REPORT: PASS: ${pass} checks`);
