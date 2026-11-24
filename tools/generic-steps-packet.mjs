// Pri Learning · the author's packet for the generic step-mark rule (owner-review/method-marks/generic-solution-steps.md)
//
// Generated, never hand-edited: every number and every worked example below is produced by running the rule (server/platform/genericSteps.js) on
// generated questions, so the packet cannot disagree with what the server would pay. It is written by tools/method-marks-drafts.mjs beside the
// per-type packets. It is a DRAFT: nothing is approved by writing it, and this tool never writes an approval record.
import * as G from '../client/src/engine/generators/index.js';
import { GENERIC_ID, GENERIC_TITLE, PARAMETERS, genericDigest, genericPlan, authoredLines } from '../server/platform/genericSteps.js';
import { markPage, falsify, stillTrue, runSweep } from './generic-steps-sweep.mjs';
import { measure, tables } from './scheme-coverage-y1112.mjs';
import { _internals } from '../client/src/engine/solutionMatch.js';

const COVERAGE_SEEDS = 40;
const SWEEP_SEEDS = 6;
const IRRELEVANT = ['2 + 2 = 4', '3 * 5 = 15', '7 - 3 = 4', '12 - 5 = 7'];

const esc = s => String(s ?? '').replace(/\|/g, '/').replace(/\n/g, ' ');
const code = s => '`' + esc(s).replace(/`/g, "'") + '`';
const finalOf = lines => { const l = lines[lines.length - 1] || ''; return l.includes('=') ? l.slice(l.lastIndexOf('=') + 1).trim() : l.trim(); };
const pct = (a, b) => (b ? (100 * a / b).toFixed(1) : '0.0') + '%';
// The question as plain text: each $...$ span through the engine's own tex-to-plain reader, a matrix as (a, b), anything it cannot read stripped of its markup.
const plainPrompt = p => esc(String(p).replace(/\\\$/g, '\u0001').replace(/\$([^$]+)\$/g, (m, tex) => {
  const t = tex.replace(/\\begin\{pmatrix\}([^]*?)\\end\{pmatrix\}/g, (mm, body) => `(${body.split('\\\\').map(x => x.trim()).join(', ')})`).replace(/\\underline\{([^{}]*)\}|\\underset\{\\sim\}\{([^{}]*)\}/g, (mm, a1, a2) => a1 || a2);
  let r = null; try { r = _internals.spanToPlain(t); } catch { r = null; }
  return r || t.replace(/\\displaystyle|\\,|\\left|\\right|\\big/g, '').replace(/\\([a-zA-Z]+)/g, '$1').replace(/[{}]/g, '');
}).replace(/\u0001/g, '$'));

// Twelve worked examples: question, student lines, ticks, marks, and the criteria table. Each names how the lines are made from the authored solution.
const EXAMPLES = [
  { topic: 'Integration (Advanced, Calculus)', gen: 'y12-integration', d: 3, seed: 1, how: 'final-wrong', say: 'A student sets up the equation correctly and then slips at the last line.' },
  { topic: 'Stationary points (Advanced, Calculus)', gen: 'y12-appdiff', d: 3, seed: 1, how: 'final-wrong', say: 'A student differentiates, solves for the stationary point and shows the second derivative, then slips on the final value.' },
  { topic: 'Series (Advanced, Functions)', gen: 'y12-series', d: 2, seed: 4, how: 'final-wrong', say: 'A student sets up the arithmetic-sequence condition correctly, then slips while solving.' },
  { topic: 'Financial mathematics (Advanced)', gen: 'y12-financial', d: 4, seed: 6, how: 'wrong-from-2', say: 'A student works out the first plan\'s interest correctly, but is wrong from the second key step onward (a slip carried down the page).' },
  { topic: 'Trigonometric equations (Extension 1)', gen: 'me12-trigeq', d: 3, seed: 1, how: 'final-wrong', say: 'A student factorises and finds both factors, then gives wrong solutions.' },
  { topic: 'Probability (Extension 1, binomial)', gen: 'me12-binomial', d: 3, seed: 1, how: 'final-wrong', say: 'A student finds p correctly, then slips. Only one step of this solution is one the page can read, so the rule pays at most one mark.' },
  { topic: 'Polynomials (Extension 1)', gen: 'me11-poly', d: 4, seed: 4, how: 'final-wrong', say: 'A student differentiates and finds the repeated-root candidates, then slips on k.' },
  { topic: 'Vectors (Extension 1)', gen: 'me12-vectors-forms', d: 2, seed: 1, how: 'final-wrong', say: 'A student sets the dot product to zero, then solves it wrongly.' },
  { topic: 'Integration, restating the question', gen: 'y12-integration', d: 3, seed: 1, how: 'restate', say: 'A student only copies the question out. Nothing is credited: copying the question is not progress.' },
  { topic: 'Functions and modelling, a bare value and true but irrelevant sums', gen: 'y12-func-model', d: 4, seed: 5, how: 'bare-and-irrelevant', say: 'A student writes one correct intermediate value and some true sums that have nothing to do with the question.' },
  { topic: 'Calculus, volume of revolution (Extension 1), no final answer', gen: 'me12-calc', d: 3, seed: 2, how: 'no-final', say: 'A student sets up the integral and integrates, but leaves the final answer box empty.' },
  { topic: 'Calculus, motion, right answer and no working', gen: 'y12-motion', d: 2, seed: 2, how: 'right-no-working', say: 'A student types only the correct final answer. This was always full marks, and still is.' }
];

function makeLines(how, q, plan) {
  const AL = authoredLines(q); const texts = AL.map(l => l.text);
  const ansStep = Math.max(...q.steps.map((s, i) => (/^(check|note|bonus)/i.test(s?.h) ? -1 : i)));
  const lastAns = AL.reduce((m, l, i) => (l.step === ansStep ? i : m), -1);
  const wrong = '99991';
  if (how === 'final-wrong') {
    const bad = lastAns >= 0 ? falsify(texts[lastAns]) : null;
    const lines = lastAns >= 0 && bad ? texts.map((t, i) => (i === lastAns ? bad : t)) : texts;
    return { lines, answer: lastAns >= 0 && bad ? finalOf(lines.slice(0, lastAns + 1)) : wrong };
  }
  if (how.startsWith('wrong-from-')) {
    const k = Number(how.slice(11));
    const step = plan.keySteps[k - 1]?.step ?? plan.keySteps[0].step;
    const at = AL.findIndex(l => l.step === step);
    const lines = texts.map((t, i) => (i >= at && falsify(t) && !stillTrue(t, falsify(t)) ? falsify(t) : t));
    return { lines, answer: wrong };
  }
  if (how === 'restate') return { lines: [...String(q.prompt).matchAll(/\$([^$]+)\$/g)].map(m => m[1].replace(/\\displaystyle|\\,/g, '').replace(/\\dfrac|\\frac/g, '').replace(/[{}]/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, 4), answer: wrong };
  if (how === 'bare-and-irrelevant') {
    const own = AL.filter(l => plan.keySteps.some(k => k.step === l.step)).map(l => l.text.split('=').pop().trim()).filter(v => /^-?\d+(?:\.\d+)?$/.test(v));
    return { lines: [...IRRELEVANT.filter(t => !texts.some(a => a.replace(/\s+/g, '') === t.replace(/\s+/g, ''))), own[0] ?? '1'], answer: wrong };
  }
  if (how === 'no-final') return { lines: texts.filter((t, i) => AL[i].step !== ansStep), answer: '' };
  if (how === 'right-no-working') return { lines: [], answer: finalOf(texts) };
  return { lines: texts, answer: wrong };
}

function exampleMarkdown(n, spec) {
  const raw = G.generateQuestion(spec.gen, spec.d, spec.seed);
  const q = { ...raw, _generator: spec.gen, _methodScheme: GENERIC_ID };
  const plan = genericPlan(q);
  const { lines, answer } = makeLines(spec.how, q, plan);
  const page = markPage(q, lines, answer);
  const L = [];
  L.push(`### Example ${n}: ${spec.topic}`, '', spec.say, '');
  L.push(`Question (${page.N} marks): ${plainPrompt(q.prompt)}`, '');
  L.push('The authored worked solution, step by step:', '');
  const AL = authoredLines(q);
  q.steps.forEach((s, i) => { const own = AL.filter(l => l.step === i).map(l => l.text).join('; '); L.push(`${i + 1}. ${esc(String(s.h).replace(/\$/g, ''))}: ${own || plainPrompt(s.d)}`); });
  L.push('');
  L.push(`Final answer typed: ${answer === '' ? '(left empty)' : code(answer)}. The answer checker says it is ${page.correct ? 'correct' : 'not correct'}.`, '');
  if (lines.length) {
    L.push('| Line | What the student wrote | What the marked page shows | Earns |', '|---:|---|---|---|');
    const earned = new Map();
    for (const it of page.pay.items || []) for (const ln of it.lines || []) earned.set(ln, it.key === 'answer' ? 'the answer' : it.key.replace('step-', 'step '));
    lines.forEach((t, i) => {
      const r = page.lines[i];
      const shown = !r ? 'no line report' : r.status === 'ok' ? 'ticked' : r.status === 'break' ? 'crossed (first wrong line)' : 'not checked';
      L.push(`| ${i + 1} | ${code(t)} | ${shown} | ${earned.get(i + 1) ?? 'nothing'} |`);
    });
    L.push('');
  } else L.push('No working was written.', '');
  if (page.pay.paid) {
    L.push('| Criterion | Marks | Result | Lines |', '|---|---:|---|---|');
    for (const it of page.pay.items) L.push(`| ${esc(it.text)} | ${it.marks} | ${it.awarded ? 'earned' : (it.verified === false ? 'not verified' : 'not earned')} | ${it.lines.length ? it.lines.join(', ') : (it.awarded ? 'the final answer' : '-')} |`);
    L.push('', `Marks: **${page.marks} of ${page.N}**.`, '');
  } else {
    L.push(`The rule does not pay this question (${esc(page.pay.reason)}), so it stays on the final answer: **${page.marks} of ${page.N}** by the final answer alone.`, '');
  }
  return { text: L.join('\n'), marks: page.marks, N: page.N };
}

let memo = null;
/** The packet text. `banner` is the DRAFT banner line the other packets start with. Memoised: it runs the sweep once per process. */
export async function genericPacket({ banner }) {
  if (memo) return memo;
  await G.loadAllBanks();
  const digest = genericDigest();
  const rows = await measure({ seeds: COVERAGE_SEEDS });
  const t = tables(rows)[0].rows;
  const sw = await runSweep({ seeds: SWEEP_SEEDS });
  const cov = await coverageByTopic(rows);
  const L = [];
  L.push(banner, '', `# ${GENERIC_TITLE}`, '', `Approval id: \`${GENERIC_ID}\`. This is ONE rule for every multi-mark written Year 11 and Year 12 question (Mathematics Advanced and Extension 1), where each type used to need its own hand-built scheme.`, '');
  L.push('## What you are asked to decide', '',
    'Whether the rule below may pay step marks, in Australia only, for a student whose method is right and whose final answer is wrong or missing. It pays nothing until you approve it. It is a separate approval from your seven question types, which are unchanged: a question whose type you approved still uses that type\'s scheme.', '',
    'If you approve it the server pays it only while all of these hold: the Australian server has the method-marks switch on, the question was marked as a rule question when it was issued, and your record names the digest at the foot of this packet. Change one word of the rule and the digest changes, and the approval no longer counts.', '');
  L.push('## The rule in plain words', '',
    '1. A question worth N marks (N is 2 or more) with a correct final answer earns N, as it always did. Working never earns the final-answer mark.',
    `2. With a wrong or missing final answer the student can earn at most N minus ${PARAMETERS.WRONG_ANSWER_CAP_BELOW_FULL}: one mark for each KEY STEP of the authored worked solution that one of their lines reaches.`,
    '3. A line reaches a key step only if all of these hold. The marked page ticks the line (the page the engine builds, never the interpreter\'s extra reading). It comes before the first line the page crosses. It states the step\'s result by the same matching the page already uses to say "matches step 2 of the worked solution". It is real progress (below).',
    '4. One line pays one step, and one step is paid once.',
    '5. The reply carries a table of the key steps (earned, not earned, or not verified, with the line numbers) and the words: "Pri practice marking, approved by the author (Priysharan Tripathi, tutor). Not an official NESA guideline."', '');
  L.push('## How the key steps are chosen, and how the marks are shared out', '',
    'The authored solution has steps. Steps headed Check, Note or Bonus are left out. The last step states the answer, so it is never a key step.', '',
    `A step before it is a candidate if it is real progress and the engine can read it. Key steps are the LAST N minus 1 distinct candidates, in order (${PARAMETERS.KEY_STEP_CHOICE}).`, '',
    'Why the last ones: the early steps of a worked solution are mostly set-up (writing the function, naming the rule). The later ones are the results a student has to derive. The usual slip is near the end, so the steps a student with a slip still reaches are the ones the marks sit on. A fixed list also means every mark has a named step you can read in the table.', '',
    'If the solution has more usable steps than N minus 1, only the last N minus 1 count. If it has fewer, one mark is paid per usable step and the answer criterion carries the rest (a 3 mark question with one usable step pays at most 1 mark for working, and the answer criterion is worth 2). If it has none, the question is not paid by this rule and stays on the final answer.', '',
    'A step is "readable" only if the engine, given the author\'s own line for that step as if a student wrote it, ticks it and recognises it as that step. This is a self-test run on every question, so a step the engine cannot tick when you wrote it is never paid.', '');
  L.push('## Real progress, and what never earns', '',
    'A step is real progress only if its result is not the question\'s own statement or expression, not a number the question gives, and not the same as the answer step. A line earns nothing if it is:', '',
    '- a restatement of the question, or the question\'s own expression copied;',
    '- a number or value the question gives;',
    '- a line that only names a formula with nothing put in (unless the authored step is exactly that);',
    '- true but irrelevant arithmetic (2 + 2 = 4), unless it uses the same operations on the question\'s own numbers as the authored step does;',
    '- a number from the solution written without the working, when the step\'s result is an expression (an equation, a derivative, an antiderivative);',
    '- a line the page only notes, or one that comes at or after the first crossed line;',
    '- a line carried forward from an earlier slip;',
    '- a line that comes at or after a line the page could not verify (THE STOP RULE below);',
    '- a bare value or bare condition with nothing derived behind it (THE BARE-LINE TEST below).', '',
    'THE STOP RULE. The page leaves some lines as notes: it cannot tell whether they are true. A student whose middle line is wrong, and which the page can only note, can then write the right lines again and collect marks. So no line at or after the first NOTE THAT CLAIMS SOMETHING may earn a key step. A note claims something unless it is plain words and nothing else. Any relation (= < > and the words for them), any digit, any operator or mathematical sign (+ - * / ^, a root, a power, an arrow), any function name (sin, cos, ln), any single-letter name (x, y, k) and any short run of letters that is not a common word (xy, dx) makes it a claim. So "x > y", "x - y", "x is seven", "sin x" and "g(3) = 4" all stop it. This is deliberately strict. WHAT DOES NOT STOP IT: a line the page ticks; a note that restates the question; plain words ("so the answer is clear", "by the formula"); and a definition the page itself reads (u = 2x + 1) when it is exactly the line the authored solution has. A DIFFERENT definition (u = 3x + 1 where the authored one is u = 2x + 1) stops it, whether or not later lines use u. Lines are not rescued by being true: there is no exception for a later line that happens to match the solution.', '',
    'THE BARE-LINE TEST. A bare line is a letter equal to a number (t = 1, x = -6) or a number alone. It can earn a key step only if ALL hold: the authored step is itself only values; the step does not list several values of that one letter (t = 9 or t = 10 is a guess at one candidate, and never earns); the value is not zero (v = 0, tan(theta) = 0 and sin(5x) = 0, with any letter or Greek letter, are the set-up of solving, never a result); the value is not a number the question gives; the step is not the first step of the solution (which is set-up); and EITHER the step has that one result alone, OR a line that is not bare and reached a key step stands before it. So x = -6 alone earns nothing on a step whose result is the equation x + 6 = 0, and v = 0 alone earns nothing.', '');
  L.push('## The choices you can see', '',
    '| Name | Value | What it means |', '|---|---|---|',
    `| BARE_VALUE_EVIDENCE | ${PARAMETERS.BARE_VALUE_EVIDENCE} | A correct intermediate value written as a bare number is evidence of the step that produces it, as an examiner would credit it. It counts only for a step whose result is a number, only when the marked page itself ticks the line as the value at that step (the page does this only after an earlier line of the working that it recognised, in order), and only if the value is not a number the question gives or something computed in a different way. As the very first line, alone, the page does not tick a bare value, so it earns nothing. Set the choice to false and a bare value never earns. |`,
    `| WRONG_ANSWER_CAP_BELOW_FULL | ${PARAMETERS.WRONG_ANSWER_CAP_BELOW_FULL} | A wrong or missing final answer earns at most N minus this. |`,
    `| MIN_MARKS | ${PARAMETERS.MIN_MARKS} | The rule applies to questions worth at least this. |`,
    `| KEY_STEP_CHOICE | ${PARAMETERS.KEY_STEP_CHOICE} | Which steps carry the marks. |`, '');
  L.push('## Coverage: how many questions the rule can pay', '',
    `Measured on the generated Year 11 and 12 Advanced and Extension 1 written questions that the NSW bank issues, seeds 1 to ${COVERAGE_SEEDS} per issued cell. "Can pay" means the question is worth 2 or more marks and the rule has at least one key step to pay. "All N-1" means it has a key step for every mark below full.`, '',
    '| Topic | Multi-mark written | Your seven types today | Rule can pay | Share | Rule can pay all N-1 |', '|---|---:|---:|---:|---:|---:|');
  for (const r of t) L.push(`| ${esc(r.label)} | ${r.multi} | ${r.today} | ${r.generic} | ${pct(r.generic, r.multi)} | ${r.full} |`);
  L.push('', `Before this rule only ${pct(t[t.length - 1].today, t[t.length - 1].multi)} of these questions could earn a step mark. With it, ${pct(t[t.length - 1].generic, t[t.length - 1].multi)} can. ${cov}`, '');
  L.push('## The sweep: does it pay anything it should not', '',
    `Run with the rule approved in the test process only (nothing is approved in the repository), over every topic, seeds 1 to ${SWEEP_SEEDS}: ${sw.payable} payable questions, ${sw.e.pages} marked pages.`, '',
    `- Authored working with only the final line wrong (${sw.a.pages} pages): marks earned ${[...sw.a.dist].sort((x, y) => x[0] - y[0]).map(([k, v]) => `${k} mark(s) on ${v}`).join(', ')}.`,
    `- Authored working in full with the right answer: N on ${sw.b.full} of ${sw.b.pages}. Full working with a wrong typed answer: N on ${sw.b.wrongTypedAtN} of ${sw.b.wrongTyped}.`,
    `- Wrong from a key step onward (${sw.c.fromPages} pages): marks earned on or after the wrong step: ${sw.c.fromEarnedAtOrAfter}. One wrong line only (${sw.c.pages} pages): the wrong line earned ${sw.c.falsifiedEarned}, anything at or after a crossed line earned ${sw.c.atOrAfterCross}.`,
    ...[...sw.d.classes].map(([k, v]) => `- Gaming, ${k.replace(/-/g, ' ')} (${v.pages} pages): a mark was earned on ${v.earned}, exceptions ${v.exceptions}.`),
    `- Every page: a wrong answer at full marks ${sw.e.wrongFull}, above N ${sw.e.overN}, a mark on an unticked line ${sw.e.unticked}, a mark at or after a crossed line ${sw.e.afterCross}, the answer mark earned by working ${sw.e.finalByLines}.`, '');
  L.push('## Twelve worked examples', '', 'Each is a real run of the rule on a generated question. "Not checked" means the page could not judge the line, which is not the same as wrong.', '');
  EXAMPLES.forEach((spec, i) => L.push(exampleMarkdown(i + 1, spec).text));
  const mean = o => (o.pages ? (o.marks / o.pages).toFixed(2) : 'n/a');
  L.push('## What the rule cannot see, and its known weaknesses', '',
    `These are measured, in the same sweep (seeds 1 to ${SWEEP_SEEDS}), and rewritten each time the packet is generated.`, '',
    `- **A different valid method earns less.** The same correct route, with a wrong last line, earns on average ${mean(sw.h.route)} marks when it is written the way the author wrote it (${sw.h.route.pages} pages). Written with the sides of each equation swapped it earns ${mean(sw.h.swap)}, and with every equation moved to one side it earns ${mean(sw.h.onesided)}. The rule recognises the authored route best. A student who solves it another valid way, or writes an equivalent line in a different shape, is paid less than they deserve and sometimes nothing.`,
    `- **Over-credit after a wrong line the page cannot see.** One middle line was made wrong in turn, and the authored lines left after it (${sw.f.pages} pages, hard test, tolerance 0): ${sw.f.marks} marks were earned against an ideal of ${sw.f.ideal} (the steps written before the wrong line); pages above the ideal: ${sw.f.overPages}; marks earned by the wrong line or a line after it: ${sw.f.afterWrong}. The cost of the stop rule is that true working is sometimes not paid: a true line the page can only note (a bare list of numbers, an inequality, a definition it does not read) ends the paying. The stop rule and the bare-line test together reduced the questions the rule can pay from 52.5 percent to 44.9 percent of the multi-mark written questions (45.8 percent with your seven types), seeds 1 to 40, and the marks paid on the authored route with a wrong last line from 2702 over 2260 pages (1.20 a page) to 2257 over 1940 pages (1.16 a page): a loss of 16.5 percent of marks, almost all of it questions that no longer pay at all, not a lower mark on those that still do.`,
    `- **A single bare line.** A letter equal to a number, or a number, alone (${sw.g.pages} pages, hard test, tolerance 0): a mark was earned on ${sw.g.earned}, every one a step whose one result that is (${sw.g.singleResult}); over-credit ${sw.g.overCredit}. Examples that no longer earn: v = 0 alone, and x = -6 alone for the domain of a composite function.`,
    `- **A true first line, then nothing readable.** ${sw.i.pages} pages: a mark was earned on ${sw.i.earned}. In ${sw.i.firstSolutionStep} of those the step is the first step of the solution, and the line is a derived expression on ${sw.i.derived} and a bare value on ${sw.i.bareFirst}. This is intended: a derived first line (a derivative, the equation set up from the question) is a true result a student had to find, and it earns one mark, the same as it does at the answer step of an examiner's scheme. A bare value as the first step does not pay (it is set-up).`,
    '- It reads only what the page can tick. A question whose solution is in words, in a table, as an inequality, as a sketch or as a vector or matrix the page cannot read has no usable steps, and stays on the final answer.',
    '- A value counts for a numeric step only if it is worked from the question\'s or the solution\'s own numbers with the same operations on the same numbers as the authored step (so 2 + 2 = 4 is not the step 2^2 = 4, and 9 / 3 = 3 is not 27 / 9 = 3).',
    '- Another question\'s correct working earns nothing, except where one of its lines is also a true statement of this question\'s own solution (the same root, an equivalent equation). That is rare in the sweep and each case is listed in the test output.',
    '- It trusts the page\'s ticks. If the page wrongly ticks a line, the rule can pay for it. The review of this rule found one such false tick (a derivative of the wrong function ticked when the question gave a value for x) and it is fixed in the page; the sweep cannot prove none remains.',
    '- Only the LAST N minus 1 usable steps pay. A student who does the early steps correctly and goes wrong in the middle may earn nothing for working although they did earn something in an examiner\'s eyes.',
    '- It never pays on a question worth one mark, and never for a model\'s reading: only the engine\'s own tick.',
    '- The mark split between steps is the same, one mark each. It does not weigh a hard step more than an easy one.', '',
    'Nothing here is an official NESA marking guideline.', '');
  L.push('## Review record', '', 'To be filled in by the author (the tutor). Leave blank until reviewed.', '', '- Decision (approved by the author / changes needed): ', '- Note: ', '- Name: ', '- Date: ', `- Scheme digest: \`${digest}\``, '');
  memo = L.join('\n');
  return memo;
}

async function coverageByTopic(rows) {
  const multi = rows.filter(r => r.written && r.marks >= 2);
  const can = multi.filter(r => r.generic > 0);
  const marks = can.reduce((n, r) => n + r.generic, 0);
  const possible = can.reduce((n, r) => n + (r.marks - 1), 0);
  return `On the ${can.length} questions it can pay, it can pay ${marks} of the ${possible} marks below full (${pct(marks, possible)}).`;
}
