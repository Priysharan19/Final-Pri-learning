// Pri Learning · the author's packet for the bank step-mark rule (owner-review/method-marks/bank-author-criteria.md)
//
// Generated, never hand-edited: every number and every worked example below is produced by running the rule (server/platform/bankSteps.js) on the
// author's own committed bank, so the packet cannot disagree with what the server would pay. It is written by tools/method-marks-drafts.mjs beside
// the other packets. It is a DRAFT: nothing is approved by writing it, and this tool never writes an approval record.
import { BANK_ID, BANK_TITLE, PARAMETERS, bankDigest, bankAuthoredLines, texToPlain } from '../server/platform/bankSteps.js';
import { installPack, resetQbank, loadPack, directorySource, DEFAULT_PACK_DIR } from '../server/platform/qbankPack.js';
import { marksPossibleFor } from '../server/platform/markerOps.js';
import { falsify, stillTrue } from './generic-steps-sweep.mjs';
import { markPage, eligibleParts, runSweep, report as sweepReport } from './bank-steps-sweep.mjs';
import { bankStepProofs, acceptedInput, trapInput } from './qbank-import.mjs';
import { _internals } from '../client/src/engine/solutionMatch.js';

const esc = s => String(s ?? '').replace(/\|/g, '/').replace(/\n/g, ' ');
const code = s => '`' + esc(s).replace(/`/g, "'") + '`';
const pct = (a, b) => (b ? (100 * a / b).toFixed(1) : '0.0') + '%';
const plainTex = t => { let r = null; try { r = _internals.spanToPlain(t); } catch { r = null; } return r || t.replace(/\\displaystyle|\\,|\\left|\\right|\\big/g, '').replace(/\\([a-zA-Z]+)/g, '$1').replace(/[{}]/g, ''); };
const plainText = s => esc(String(s).replace(/\\\$/g, '\u0001').replace(/\$([^$]+)\$/g, (m, tex) => texToPlain(tex) ?? plainTex(tex)).replace(/\u0001/g, '$'));
const REASONS = {
  manual: 'flagged by you as one only a person can check (manual)',
  'states-the-answer': 'its line is the final answer or part of it, which only the answer criterion may earn',
  given: 'its line is something the question gives',
  'given-value': 'its value is a number the question gives',
  inequality: 'its line is an inequality, which the rule does not read',
  chain: 'its line is a chain of more than one equation',
  unreadable: 'its line could not be read',
  'no-step': 'no step of your worked solution matches its words',
  'ambiguous-step': 'more than one step of your worked solution matches its words',
  'his-own-steps-do-not-earn-it': 'your own worked steps, written as a student would, do not earn it (the page cannot tick them, or the line is not one your steps write)'
};

let memo = null;
export async function bankPacket({ banner, approval = null }) {
  if (memo) return memo;
  installPack(await loadPack(directorySource(DEFAULT_PACK_DIR)));
  try {
    const digest = bankDigest();
    const { rows, summary } = bankStepProofs();
    const R = runSweep();
    const parts = eligibleParts();
    const L = [];
    L.push(banner, '', `# ${BANK_TITLE}`, '', `Approval id: \`${BANK_ID}\`. This rule is for the questions of your own bank (the ${summary.parts} parts worth two or more marks that the app serves from your pack). It uses YOUR marking criteria and YOUR worked steps, and nothing else. It is separate from the generic rule you approved on 24 November 2026, which is for the generated questions only.`, '');
    L.push('## What you are asked to decide', '',
      `Whether a question of your own bank may pay step marks, in Australia only, when the student's method is right and the final answer is wrong or missing. Today every bank question is marked on the final answer alone: a wrong final answer earns 0. ${approval ? `You approved this rule on ${approval.date}, at the digest at the foot of this packet.` : 'You have not approved this rule. Nothing here pays, and nothing will until you file your own record for it.'}`, '',
      'If you approve it, the server pays it only while all of these hold: the Australian server has the method-marks switch on, the question was marked as a bank-rule question when it was issued, and your record names the digest at the foot of this packet. Changing one word of the rule changes the digest and withdraws the approval until you read it again. It is never used in Rush, Match, the placement check, papers or for the worked-solution questions.', '');
    L.push('## The rule in five lines', '',
      '1. A part worth N marks (2 or more) with a correct final answer earns N, as it always did. Working never earns your answer criterion.',
      '2. With a wrong or missing final answer the student earns the marks of each of YOUR other criteria that the working provably meets, never more than N minus the marks of your answer criterion (N minus 1 if you have none).',
      '3. A criterion with a `line` is met when a line of the working is provably equal to it: the same expression at many sample points, the same label and value (m = 3), or the same equation with the same form. A criterion with no `line` is met when exactly one step of your worked solution matches its words and a ticked line reaches that step the way the generic rule defines.',
      '4. The line must be ticked by the marked page (the engine, never a model), come before the first crossed line and before the first line the page could not verify, and pay one criterion only.',
      '5. The reply carries your criteria, in your words, each earned, not earned or not verified, with the line numbers, and the words: "Pri practice marking, approved by the author (Priysharan Tripathi, tutor). Not an official NESA guideline."', '');
    L.push('## What it can verify, and what it cannot', '',
      'It can verify a criterion whose `line` is an expression, a label with a number (m = 3), a label with an expression (y = 4x + 1) or an equation, and a criterion with no line that names one step of your worked solution, provided your own steps, written as a student would write them, earn it on the real marked page. That last test is run on every part: a criterion your own steps do not earn is never paid.',
      '',
      'It cannot verify, and so never pays:', '',
      '- a criterion you flagged `manual`, or one in words with no line and no single matching step;',
      '- your answer criterion, whatever the working says;',
      '- a criterion whose line is the final answer or a part of it, a number the question gives, or something the question states;',
      '- an inequality, or a chain of equations in one criterion;',
      '- a criterion whose line is the same as another criterion\'s line.', '',
      'Restating the question, writing the given values, a bare value with no working before it, and every line at or after a wrong line or a line the page could not verify, earn nothing.', '');
    L.push('## The choices you can see', '', '| Name | Value | What it means |', '|---|---|---|');
    L.push(`| MIN_MARKS | ${PARAMETERS.MIN_MARKS} | The rule applies to parts worth at least this. |`,
      `| WRONG_ANSWER_CAP_BELOW_FULL | ${PARAMETERS.WRONG_ANSWER_CAP_BELOW_FULL} | With no answer criterion of yours, a wrong answer earns at most N minus this. |`,
      `| SAMPLE_POINTS | ${PARAMETERS.SAMPLE_POINTS} | How many sample points two expressions are compared at. |`,
      `| MIN_DEFINED_POINTS | ${PARAMETERS.MIN_DEFINED_POINTS} | How many of them must be defined for a comparison to count. |`,
      `| REACH_MARKS | ${PARAMETERS.REACH_MARKS} | The generic rule counts at most the last five distinct steps as reachable. |`,
      `| STOP_AT_FIRST_UNTICKED | ${PARAMETERS.STOP_AT_FIRST_UNTICKED} | No line at or after the first line the page could not tick earns, even a line of plain words. This is stricter than the generic rule, which lets plain words through. |`, '');
    // coverage
    const crit = rows.flatMap(r => r.criteria.filter(k => k.kind !== 'answer').map(k => ({ ...k, partEligible: r.eligible })));
    const why = {};
    for (const k of crit) { const key = k.live && !k.partEligible ? 'untested' : k.live ? 'verifiable' : k.why in REASONS ? k.why : /^same/.test(k.why ?? '') ? 'same' : k.kind === 'manual' ? 'manual' : (k.why ?? 'other'); why[key] = (why[key] || 0) + 1; }
    L.push('## Coverage: how many bank parts the rule can pay', '',
      `Measured on the committed pack. "Eligible" means the part passed the import-time proof below and has at least one criterion the rule can verify. Of ${summary.parts} parts worth 2 or more marks, ${summary.eligible} are eligible (${pct(summary.eligible, summary.parts)}). On those, ${summary.verifiable} of your criteria are verifiable and ${summary.notVerified} are not verified.`, '',
      '| Course and topic (your topic codes) | Parts worth 2 or more | Eligible | Share | Criteria verifiable | Criteria not verified |', '|---|---:|---:|---:|---:|---:|');
    for (const [k, v] of Object.entries(summary.by).sort()) L.push(`| ${k.replace(/^a11/, 'Advanced Y11').replace(/^a12/, 'Advanced Y12').replace(/^x11/, 'Extension 1 Y11').replace(/^x12/, 'Extension 1 Y12')} | ${v.parts} | ${v.eligible} | ${pct(v.eligible, v.parts)} | ${v.verifiable} | ${v.criteria - v.verifiable} |`);
    L.push(`| ALL | ${summary.parts} | ${summary.eligible} | ${pct(summary.eligible, summary.parts)} | ${summary.verifiable} | ${summary.notVerified} |`, '');
    L.push(`Why the other ${summary.parts - summary.eligible} parts are not eligible: ${Object.entries(summary.reasons).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k.replace(/-/g, ' ')} ${n}`).join(', ')}. "No verifiable criterion" means every non-answer criterion fell into one of the reasons below, and a part with no worked lines cannot be tested.`, '',
      `Every non-answer criterion of the ${summary.parts} parts, by what happens to it (${crit.length} criteria):`, '');
    for (const [k, n] of Object.entries(why).sort((a, b) => b[1] - a[1])) L.push(`- ${k === 'verifiable' ? 'verifiable by the rule, in an eligible part' : k === 'untested' ? 'readable in itself but in a part with no readable worked lines, or with no other verifiable criterion, so not tested and not paid' : k === 'same' ? 'the same line as another criterion of the part' : (REASONS[k] ?? k)}: ${n}`);
    L.push('');
    // proof
    L.push('## The import-time proof, run on every part', '',
      'For each part the importer and the real-pack check run your own worked steps through the real marked page, as a student would write them:', '',
      '- your steps with a wrong typed answer earn exactly the criteria the rule can verify, and never your answer criterion;',
      '- your steps with the last line made wrong earn the same, except a criterion that rested on that very line;',
      '- your steps with the right answer earn N;',
      '- the question restated, only its given values, and each of your trap answers alone (as the typed answer, and as a line) earn 0.', '',
      `A part that fails any of these is not eligible and stays on the final answer, with the reason listed. On the committed pack ${summary.parts - summary.eligible - Object.entries(summary.reasons).filter(([k]) => !/^proof:/.test(k)).reduce((n, [, v]) => n + v, 0)} parts failed a proof page; the rest were not eligible before the proof was reached.`, '');
    // sweep
    L.push('## The sweep: does it pay anything it should not', '',
      `Run with the rule approved in the test process only (nothing is approved in the repository), over every eligible part: ${R.parts} parts, ${R.pages} marked pages.`, '');
    L.push('```', sweepReport(R), '```', '',
      `Violations: ${R.violations.length}. Gamed pages that earned a mark: ${R.exceptions.length}. Another question's working that earned a mark by coincidence: ${R.coincidences.length}.`, '');
    // examples
    L.push('## Twelve worked examples', '', 'Each is a real run of the rule on one of your own bank questions. "Not checked" means the page could not judge the line, which is not the same as wrong.', '');
    const picks = pickExamples(parts);
    picks.forEach((ex, i) => L.push(...example(i + 1, ex)));
    // weaknesses
    const eligRows = rows.filter(r => r.eligible);
    const dist = R.a.dist; const aPages = R.a.pages; const aMarks = [...dist].reduce((n, [k, v]) => n + k * v, 0);
    const cap = eligRows.reduce((n, r) => n + (r.marks - 1), 0);
    const ver = eligRows.reduce((n, r) => n + r.criteria.filter(k => k.live).reduce((m, k) => m + k.marks, 0), 0);
    L.push('## What the rule cannot see, and its known weaknesses', '',
      'These are measured, in the same run, and rewritten each time the packet is generated.', '',
      `- **It pays few parts.** ${summary.eligible} of ${summary.parts} parts (${pct(summary.eligible, summary.parts)}). Most of your criteria are flagged manual, state the final answer, or name a step the page cannot tick. On the eligible parts the rule can pay ${ver} of the ${cap} marks below full (${pct(ver, cap)}).`,
      `- **A different valid method earns less.** Your steps with only the last line wrong earn on average ${(aMarks / Math.max(1, aPages)).toFixed(2)} marks (${aPages} pages; ${dist.get(0) || 0} earn 0). A student who solves it another way, or writes an equivalent line in another shape, is paid less than they deserve and sometimes nothing. Two expressions are compared as functions, so an unsimplified and a simplified form are the same; an equation must have your form (a number, a letter or something longer on each side).`,
      '- **The page decides which lines count.** Only a line the marked page ticks can earn. The page does not tick every true line (a derivative written with y\' or a fraction it cannot read is often "not checked"), so a true line can earn nothing. It also means a wrong tick by the page could be paid; the sweep cannot prove none remains.',
      '- **The stop rule is stricter than the generic rule.** Any line the page could not verify, even a few plain words, stops the paying for every later line. A student who writes "so" or a heading between lines loses the marks after it. This costs marks to honest students, on purpose.',
      '- **A bare value needs working before it.** A criterion that is only a value (m = 3) is met only if an earlier ticked line reached something of your solution, or an earlier ticked equation of the page (not the question\'s own) is solved by that value. So the first thing a student writes can never be a bare value.',
      '- **Only criteria your own steps earn.** If your worked steps are written in words, or the page cannot tick them, the criterion is not verified and a good student gets nothing for it. Your criteria lines are often the model answer, not a line your steps contain.',
      '- **A step in words is reached by any one of its results.** A criterion with no line is met when a ticked line reaches the step it names, the way the generic rule you approved defines reaching. A step with several results (a gradient and then a tangent line) is reached by one of them, so a criterion called "Tangent" can be earned by the gradient alone. Your wording of the point, not the rule, decides how much that is.',
      '- **The mark split is yours, not mine.** Each criterion carries the marks you gave it. A wrong final answer can never reach N, and where you gave no answer criterion the last working mark is held back.',
      '- **Coincidence.** Another question\'s correct working can earn a mark only if one of its lines is provably equal to one of your criterion lines; in the sweep that happened ' + `${R.coincidences.length} times.`,
      '- It never pays a question worth one mark, a worked-solution question, and never for a model\'s reading: only the engine\'s own tick.', '',
      'Nothing here is an official NESA marking guideline.', '');
    L.push('## Review record', '', 'To be filled in by the author (the tutor). Leave blank until reviewed.', '', '- Decision (approved by the author / changes needed): ', '- Note: ', '- Name: ', '- Date: ', `- Rule digest: \`${digest}\``, '');
    memo = L.join('\n');
    return memo;
  } finally { resetQbank(); }
}

export function pickExamples(parts) {
    const used = new Set();
    const picks = [];
    const byFamily = new Map();
    for (const p of parts) { if (!byFamily.has(p.family)) byFamily.set(p.family, []); byFamily.get(p.family).push(p); }
    const families = [...byFamily.keys()].sort();
    const attempt = (scenario, test) => {
      for (const fam of families) {
        if (used.has(fam)) continue;
        for (const p of byFamily.get(fam)) { const ex = test(p); if (ex) { used.add(fam); picks.push({ scenario, p, ...ex }); return true; } }
      }
      return false;
    };
    const finalWrong = p => {
      const texts = bankAuthoredLines(p.q).map(l => l.text); const last = texts.length - 1;
      const bad = falsify(texts[last]); if (!bad || bad === texts[last]) return null;
      const lines = texts.map((t, i) => (i === last ? bad : t)); const m = markPage(p.q, lines, '99991');
      return m.marks >= 1 ? { lines, typed: '99991', m, say: 'The student works through the steps and slips on the last line.' } : null;
    };
    for (let i = 0; i < 6; i++) attempt('final', finalWrong);
    attempt('middle', p => {
      const texts = bankAuthoredLines(p.q).map(l => l.text);
      for (let idx = 1; idx < texts.length - 1; idx++) { const bad = falsify(texts[idx]); if (!bad || bad === texts[idx] || stillTrue(texts[idx], bad)) continue; const lines = texts.map((t, i) => (i === idx ? bad : t)); const m = markPage(p.q, lines, '99991'); if (m.marks >= 1) return { lines, typed: '99991', m, say: `One middle line (line ${idx + 1}) is made wrong. Lines before it can earn; it and everything after it cannot.` }; }
      return null;
    });
    attempt('trap', p => {
      const texts = bankAuthoredLines(p.q).map(l => l.text);
      for (const t of p.q.traps || []) { const typed = trapInput(t); if (typed === null) continue; for (let k = texts.length - 1; k >= 1; k--) { const m = markPage(p.q, texts.slice(0, k), typed); if (m.marks >= 1 && !m.correct) return { lines: texts.slice(0, k), typed, m, say: `The student types the common wrong answer ("${plainText(t.why)}") after working that is right so far.` }; } }
      return null;
    });
    attempt('restate', p => { const lines = [...String(p.q.prompt).replace(/\\\$/g, '\u0001').matchAll(/\$([^$]+)\$/g)].map(m => plainTex(m[1])).filter(Boolean); if (!lines.length) return null; const m = markPage(p.q, lines, '99991'); return m.marks === 0 ? { lines, typed: '99991', m, say: 'A student only copies the question out. Nothing is credited.' } : null; });
    attempt('claim', p => { const texts = bankAuthoredLines(p.q).map(l => l.text); const lines = ['the gradient is clearly negative here', ...texts]; const m = markPage(p.q, lines, '99991'); return m.marks === 0 ? { lines, typed: '99991', m, say: 'A student starts with a plain-word claim the page cannot verify, then writes your lines. Nothing after the claim can earn.' } : null; });
    attempt('bare', p => { const texts = bankAuthoredLines(p.q).map(l => l.text); const v = texts.slice(0, -1).map(t => t.split('=').pop().trim()).find(x => /^-?\d+(?:\.\d+)?$/.test(x)); if (!v) return null; const m = markPage(p.q, [v], '99991'); return m.marks === 0 ? { lines: [v], typed: '99991', m, say: 'A student writes one correct intermediate value and nothing else. A value with no working is nothing.' } : null; });
    attempt('right', p => { const typed = acceptedInput({ answerType: p.q.answerType, answer: p.q.answer }); const m = markPage(p.q, [], typed); return m.correct ? { lines: [], typed, m, say: 'A student types only the correct final answer. This was always full marks, and still is.' } : null; });
  return picks;
}

export function example(n, ex) {
  const { p, lines, typed, m, say } = ex;
  const q = p.q, N = marksPossibleFor(q);
  const L = [`### Example ${n}: ${p.id}`, '', say, '', `Question (${N} marks, ${p.id}): ${plainText(q.prompt)}`, '', 'Your worked solution, step by step:', ''];
  (q.steps || []).forEach((s, i) => L.push(`${i + 1}. ${plainText(s.h)}: ${plainText(s.d)}`));
  L.push('', `Final answer typed: ${typed === '' ? '(none)' : code(typed)}. The answer checker says it is ${m.correct ? 'correct' : 'not correct'}.`, '');
  if (lines.length) {
    L.push('| Line | What the student wrote | What the marked page shows | Earns |', '|---:|---|---|---|');
    lines.forEach((t, i) => {
      const l = m.lines[i];
      const shows = l?.status === 'ok' ? 'ticked' : l?.status === 'break' ? 'crossed' : 'not checked';
      const earns = m.pay.items.filter(x => x.awarded && x.basis === 'lines' && x.lines.includes(i + 1)).map(x => plainText(x.text)).join('; ');
      L.push(`| ${i + 1} | ${code(t)} | ${shows} | ${earns || 'nothing'} |`);
    });
    L.push('');
  } else L.push('No working was written.', '');
  L.push('| Criterion (yours) | Marks | Result | Lines |', '|---|---:|---|---|');
  for (const it of m.pay.items) L.push(`| ${plainText(it.text)} | ${it.marks} | ${it.awarded ? 'earned' : it.verified ? 'not earned' : 'not verified'} | ${it.lines.length ? it.lines.join(', ') : '-'} |`);
  L.push('', `Marks: **${m.marks} of ${N}**.`, '');
  return L;
}
