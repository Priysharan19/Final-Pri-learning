// The teacher-marked page with the AI line check (owner directive, 27 November 2026). Real chain, scripted model:
//   engine report (server) -> AI layer folded into the displayed report -> annotated model -> marked page -> teacher marks.
// What is pinned:
//   · an AI-checked line has its own tick kind, its own words and its own colour (the marking palette's accent), never the engine's green
//   · the tally counts engine lines and AI lines apart: "9 lines correct (engine). 3 AI-checked. 0 wrong. 0 not checked."
//   · an AI doubt is advisory (its own kind, never a cross), its words say so
//   · the one-line explanation of "AI-checked" is on the page, and the lower evaluation panel agrees
//   · the page with the layer OFF is byte-identical to today's; no mark is created by the layer
//   · the design ban list: no gradient, emoji, glass, coloured left-border card or em dash in anything new
//   node client/test/ai-line-check-page-check.mjs
import '../../server/test/support/hermetic.mjs';
import { readFileSync } from 'node:fs';
import { stepEvidence } from '../../server/platform/markerOps.js';
import { applyAiLineCheck } from '../../server/platform/aiLineCheck/index.js';
import { buildAnnotatedWorking } from '../src/components/annotatedWorkingModel.js';
import { buildMarkedPage } from '../src/components/markedPageModel.js';
import { buildTeacherMarks, tallyOf, buildAssessment, detailFor, markLabel, listWords, lineWord, TEXT, aiPhrase } from '../src/components/markedPageTeacher.js';

let pass = 0; const failures = [];
const ok = (c, l) => { if (c) pass++; else failures.push(l); };

const PROMPT = 'Use the product rule to find the gradient of $y = (4x - 3)(2x + 1)$ at the point where $x = -1$.';
const Q = { id: 'q', answerType: 'numeric', answer: { value: -18 }, prompt: PROMPT, steps: [] };
const PAGE = ['Use the product rule to find the gradient of y = (4x−3)(2x+1)', 'at the point where x = −1.', 'Let u = 4x − 3, v = 2x + 1', 'dy/dx = u′v + uv′', '= 4(2x+1) + (4x−3)(2)',
  '= 8x + 4 + 8x − 6', '= 16x − 2', 'At x = −1:', 'dy/dx = 16(−1) − 2', '= −16 − 2', '= −18', 'Gradient = −18'];
const ev = stepEvidence(Q, '-18', PAGE.join('\n'), { correct: true }, { slipWarnings: true });
const base = ev.stepReport;
// the model's words, as the server's guard let them through: indices are the page's lines (0-based)
const RESULT = { version: 'ai-line-check-v1', counts: { engineProved: 2, aiChecked: 3, aiDoubt: 1 }, lines: [
  { index: 1, kind: 'ai-checked', comment: 'Restates where the gradient is wanted.', generic: false },
  { index: 3, kind: 'ai-checked', comment: 'States the product rule.', generic: false },
  { index: 4, kind: 'ai-checked', comment: 'Consistent with the working.', generic: true },
  { index: 2, kind: 'ai-doubt', comment: 'This line may not follow from the working.', generic: true },
  { index: 8, kind: 'engine-proved', short: 'Correct substitution', sentence: 'Putting x = −1 into the line above gives −18, as written here.', rule: 'ai-veto-substitution' },
  { index: 11, kind: 'engine-proved', short: 'Equal to the line above', sentence: 'This line is equal to the line above.', rule: 'ai-veto-equal-to-line-above' }
] };
const view = applyAiLineCheck({ report: base, result: RESULT, working: PAGE.join('\n') });
const pageOf = report => { const model = buildAnnotatedWorking({ lines: PAGE, stepReport: report, receipt: { awarded: 1, possible: 1 }, page: true }); return { model, page: buildMarkedPage({ model, markReady: true }) }; };
const off = pageOf(base), on = pageOf(view);

// the page with the layer off is today's
ok(off.model.cards.every(c => c.status !== 'ai-checked' && c.status !== 'ai-doubt'), 'the layer off: no AI card');
ok(!/AI-checked|AI doubt/.test(tallyOf(off.page)) && /^\d+ lines? correct\. \d+ wrong\. \d+ not checked\.$/.test(tallyOf(off.page)), `the layer off: the tally keeps today's words (${tallyOf(off.page)})`);
ok(buildTeacherMarks({ page: off.page }).every(m => m.kind === 'right' || m.kind === 'wrong'), 'the layer off: only ticks and crosses');

// the page with it on
const statuses = on.page.lines.map(l => l.status);
ok(statuses[1] === 'ai-checked' && statuses[3] === 'ai-checked' && statuses[4] === 'ai-checked', `AI-checked lines become their own card status (${statuses})`);
ok(statuses[2] === 'ai-doubt', 'an AI doubt is its own card status');
ok(statuses[8] === 'checked' && statuses[11] === 'checked', 'an engine proof from the layer is an ordinary engine tick');
ok(on.page.lines.every((l, i) => (base.lines[i].status === 'ok' ? l.status === 'checked' : true)), 'every line the engine ticked is still ticked');
ok(!on.page.lines.some(l => l.status === 'first-error') && on.page.firstError === null, 'nothing is crossed');
ok(on.model.aiChecked.join() === '2,4,5' && on.model.aiDoubt.join() === '3', 'the model lists AI lines apart');
ok(on.model.allChecked === false && on.page.header.everyLine === false, 'a page with AI lines is never "every line checked"');
const tally = tallyOf(on.page);
const nEngine = on.page.lines.filter(l => l.status === 'checked').length;
ok(tally === `${nEngine} lines correct (engine). 3 AI-checked. 1 AI doubt. 0 wrong. ${on.page.lines.filter(l => !['checked', 'first-error', 'condition', 'ai-checked', 'ai-doubt'].includes(l.status)).length} not checked.`, `the tally counts them apart (${tally})`);
ok(/\(engine\)\. \d+ AI-checked\./.test(tally), 'the engine\'s lines say "(engine)" and the AI count follows');
const marks = buildTeacherMarks({ page: on.page });
const ai = marks.filter(m => m.kind === 'ai'), doubt = marks.filter(m => m.kind === 'doubt');
ok(ai.length === 3 && doubt.length === 1, 'one mark of its own kind per AI line');
ok(ai.every(m => m.cls === null && m.paid === null && m.explain === null && m.reason === null), 'an AI mark has no engine class, no mark box, no engine explanation');
ok(ai[0].phrase === 'Checked by AI: Restates where the gradient is wanted.' && ai[0].aiComment === 'Restates where the gradient is wanted.', 'the words beside the tick: the label and the comment');
ok(aiPhrase(false, 'x'.repeat(60)) === 'Checked by AI' && aiPhrase(true, 'Short.') === 'AI doubt: Short.', 'a long comment leaves only the label beside the tick (the popover and the list carry it)');
ok(ai.every(m => /^Line \d+: checked by AI, not verified by the engine\./.test(markLabel(m))) && /AI doubt, advisory only/.test(markLabel(doubt[0])), 'a screen reader hears that it is AI and not engine-verified');
const pop = detailFor(ai[0]);
ok(pop.title === `Line ${ai[0].n}: checked by AI` && pop.lines.some(l => l.some(x => x.v === TEXT.aiWhat)) && pop.mark === null, 'the popover says what AI-checked means and carries no mark');
const popD = detailFor(doubt[0]);
ok(/AI doubt/.test(popD.title) && popD.lines.some(l => l.some(x => /Marks are set only by Pri/.test(x.v))) && popD.lines.some(l => l.some(x => /advice only/.test(x.v))), 'a doubt says it is advice only and that marks are set by the engine');
ok(listWords(ai[0]).head === 'Checked by AI: Restates where the gradient is wanted.' && listWords(doubt[0]).head === 'AI thinks this line may be wrong: This line may not follow from the working.', 'the detailed list carries the comment and the advisory wording');
ok(lineWord({ status: 'ai-checked' }) === 'Checked by AI' && lineWord({ status: 'ai-doubt' }) === 'AI doubt', 'the detail panel names the kind');
ok(TEXT.aiWhat.includes('not verified by Pri') && TEXT.aiWhat.includes('never changes your marks') && TEXT.aiMarks === 'Marks are set only by Pri’s engine.', 'the one line says plainly what AI-checked means');

// the lower evaluation panel agrees
const assess = buildAssessment({ page: on.page, table: null, attempt: 1 });
ok(assess.aiChecked === 3 && assess.aiDoubt === 1 && /3 AI-checked/.test(assess.footer) && /1 AI doubt/.test(assess.footer), `the evaluation panel's footer agrees (${assess.footer})`);
ok(assess.aiNote === `${TEXT.aiWhat} ${TEXT.aiMarks}` && buildAssessment({ page: off.page, table: null, attempt: 1 }).aiNote === null, 'the panel carries the explanation only when the page has AI lines');
ok(assess.mark && assess.mark.awarded === 1 && assess.mark.possible === 1, 'the mark is the server\'s receipt, untouched');

// the layer changes no mark and no engine verdict
ok(JSON.stringify(view.lines.filter((l, i) => base.lines[i].status === 'ok' || base.lines[i].status === 'break')) === JSON.stringify(base.lines.filter(l => l.status === 'ok' || l.status === 'break')) || view.lines.every((l, i) => base.lines[i].status !== 'ok' || JSON.stringify(l) === JSON.stringify(base.lines[i])), 'every engine-ticked line is byte-identical after the fold');
ok(view.firstBreak === base.firstBreak && view.diagnosis === base.diagnosis, 'the first break and the diagnosis are the engine\'s');

// the design ban list, over everything new
const css = readFileSync(new URL('../src/components/MarkedPageTeacher.css', import.meta.url), 'utf8');
const aiCss = css.split('\n').filter(l => /is-ai|is-doubt|ainote|--pg-ai|--pg-doubt/.test(l)).join('\n');
ok(aiCss.length > 0 && !/gradient|backdrop-filter|blur\(|border-left|box-shadow|text-shadow/i.test(aiCss), 'no gradient, glass, shadow or coloured left border in the AI styles');
ok(/\.mp-t-glyph\.is-ai \{ color: var\(--mk-accent\)/.test(css) && !/\.is-ai[^{]*\{[^}]*--mk-correct/.test(css) && /--pg-ai: #7654A5/.test(css), 'the AI tick uses the marking palette\'s accent, not the green of an engine tick');
ok(/\.mp-t-glyph\.is-doubt \{ color: var\(--mk-advisory\)/.test(css), 'a doubt uses the advisory colour');
const copy = [TEXT.aiChecked, TEXT.aiDoubt, TEXT.aiDoubtLead, TEXT.aiWhat, TEXT.aiMarks, TEXT.aiCorrection, tally, assess.footer, assess.aiNote, pop.title, popD.title, ...ai.map(m => m.phrase)].join(' ');
ok(!/[—–]/.test(copy) && !/\p{Extended_Pictographic}/u.test(copy), 'no em dash, no en dash, no emoji in the new copy');
const jsx = readFileSync(new URL('../src/components/TeacherMarks.jsx', import.meta.url), 'utf8');
ok(!/[—–]/.test(jsx.split('\n').filter(l => /ai|doubt/i.test(l)).join('\n')), 'no dash in the new component lines');

if (failures.length) { console.error(failures.join('\n')); console.error(`AI LINE CHECK PAGE: FAIL (${failures.length})`); process.exit(1); }
console.log(`AI LINE CHECK PAGE: PASS — ${pass} checks`);
