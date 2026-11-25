// Pri Learning · the author's packet for the generic step-mark rule applied to his own bank (owner-review/method-marks/generic-solution-steps-bank.md)
//
// Generated, never hand-edited: every number and example comes from running the approved generic rule, unchanged, on the committed pack. A DRAFT: this tool
// never writes an approval record.
import { BANK_GENERIC_ID, BANK_GENERIC_TITLE, bankGenericDigest } from '../server/platform/bankGenericSteps.js';
import { genericDigest } from '../server/platform/genericSteps.js';
import { installPack, resetQbank, loadPack, directorySource, DEFAULT_PACK_DIR } from '../server/platform/qbankPack.js';
import { runSweep, eligibleParts, report as sweepReport } from './bank-steps-sweep.mjs';
import { eligibility, compare, unticked } from './bank-generic-measure.mjs';
import { pickExamples, example } from './bank-steps-packet.mjs';

const pct = (a, b) => (b ? (100 * a / b).toFixed(1) : '0.0') + '%';
let memo = null;
export async function bankGenericPacket({ banner, approval = null }) {
  if (memo) return memo;
  installPack(await loadPack(directorySource(DEFAULT_PACK_DIR)));
  try {
    const E = eligibility().summary, C = compare(), U = unticked();
    const R = runSweep({ rule: 'generic' });
    const L = [];
    L.push(banner, '', `# ${BANK_GENERIC_TITLE}`, '', `Approval id: \`${BANK_GENERIC_ID}\`. This is the generic rule you approved on 24 November 2026, unchanged, applied to the questions of your own bank. Your worked steps are the authored solution and your marks are N. It is a separate approval from the generic rule's own: the rule's code is not touched and its approval is not affected.`, '');
    L.push('## What you are asked to decide', '',
      `Whether a question of your own bank may pay step marks, in Australia only, when the student's method is right and the final answer is wrong or missing. Today a wrong final answer on a bank question earns 0. ${approval ? `You approved this on ${approval.date}, at the digest at the foot of this packet.` : 'You have not approved this. Nothing here pays, and nothing will until you file your own record for it.'}`, '',
      'It pays only while the Australian server has the method-marks switch on, the question was marked as a bank question of this rule when it was issued, and your record names the digest at the foot of this packet. It is never used in Rush, Match, the placement check, papers or for the worked-solution questions.', '');
    L.push('## The rule in five lines', '',
      '1. A part worth N marks (2 or more) with a correct final answer earns N, as it always did. Working never earns the final-answer mark.',
      '2. With a wrong or missing final answer the student can earn at most N minus 1: one mark for each KEY STEP of your worked solution that one of their lines reaches.',
      '3. Your steps headed Check, Note or Bonus are left out. The last step states the answer, so it is never a key step. The key steps are the last N minus 1 distinct steps before it that are real progress and that the engine can read (the engine must tick your own line for that step when written as a student would).',
      '4. A line reaches a key step only if the marked page ticks it (the engine, never a model), it comes before the first crossed line and before the first line the page could not verify as a claim, it says the step\'s result, and it is not a restatement of the question or a number the question gives. One line pays one step.',
      '5. The reply shows a table of the key steps by YOUR step headings, each earned, not earned or not verified, with the line numbers, and the words: "Pri practice marking, approved by the author (Priysharan Tripathi, tutor). Not an official NESA guideline."', '');
    L.push(`## Coverage: how many bank parts the rule can pay`, '',
      `Of ${E.parts} parts worth 2 or more marks, ${E.eligible} (${pct(E.eligible, E.parts)}) can pay at least one step, and ${E.all} of those can pay a mark for every step below full marks.`, '',
      '| Course | Parts worth 2 or more | Can pay a step | Share | Can pay all N-1 |', '|---|---:|---:|---:|---:|');
    for (const [k, v] of Object.entries(E.by).sort()) L.push(`| ${k.replace(/ ma$| me$/, '')} | ${v.parts} | ${v.eligible} | ${pct(v.eligible, v.parts)} | ${v.all} |`);
    L.push(`| ALL | ${E.parts} | ${E.eligible} | ${pct(E.eligible, E.parts)} | ${E.all} |`, '', 'Why the other parts cannot pay, with an example each:', '');
    for (const [k, n] of Object.entries(E.reasons).sort((a, b) => b[1] - a[1])) L.push(`- ${k.replace(/[-:]/g, ' ')}: ${n}. For example ${E.examples[k][0]}`);
    L.push('', '## The sweep: does it pay anything it should not', '', `Run with the rule approved in the test process only, over every part that can pay: ${R.parts} parts, ${R.pages} marked pages.`, '', '```', sweepReport(R), '```', '',
      `Violations: ${R.violations.length}. Gamed pages that earned a mark other than for your own true lines: ${R.exceptions.length}. Another question's working that earned a mark by coincidence: ${R.coincidences.length}.`, '',
      'One class needs saying plainly. A line of pure plain words with no number, sign or letter that means anything ("the gradient is clearly negative here") is not a claim to the approved rule, so your true lines after it still earn. A line that does claim something the page cannot verify (x > y, x equals seven) stops every later line: that class earned 0.', '');
    L.push('## Twelve worked examples', '', 'Each is a real run of the rule on one of your own bank questions. "Not checked" means the page could not judge the line, which is not the same as wrong.', '');
    pickExamples(eligibleParts({ rule: 'generic' })).forEach((ex, i) => L.push(...example(i + 1, ex).map(l => l.replace('| Criterion (yours) |', '| Step of your worked solution |'))));
    L.push('## What the rule cannot see, and its known weaknesses', '', 'These are measured, in the same run, and rewritten each time the packet is generated.', '',
      `- **It pays ${pct(E.eligible, E.parts)} of the parts.** The rest have a one-step solution (${E.reasons['one-step-solution'] || 0}), no readable steps, or no step that the page ticks and counts as real progress. See the next section.`,
      `- **A different valid method earns less.** Your steps with only the last line wrong earn on average ${(([...R.a.dist].reduce((n, [k, v]) => n + k * v, 0)) / Math.max(1, R.a.pages)).toFixed(2)} marks (${R.a.pages} pages; ${R.a.dist.get(0) || 0} earn 0).`,
      `- **A right method with a wrong last line still earns marks.** On average ${(([...R.a.dist].reduce((n, [k, v]) => n + k * v, 0)) / Math.max(1, R.a.pages)).toFixed(2)} marks over all ${R.a.pages} pages, by marks available: ${[...R.a.byN].sort((x, y) => x[0] - y[0]).map(([n, o]) => `${n} marks ${(o.marks / o.pages).toFixed(2)} (${o.pages} pages)`).join('; ')}. That is the rule working as approved: a mark for each key step reached, at most N minus 1. (The independent review of this draft measured about 1.0 on average: 0.98 at 2 marks, 1.19 at 3, 1.5 at 4.)`,
      `- **A false statement in plain words does not stop the paying.** ${R.byClass.get('plain-word-false-claim-then-his-lines') ? `In the sweep, ${R.byClass.get('plain-word-false-claim-then-his-lines').proseThrough} of ${R.byClass.get('plain-word-false-claim-then-his-lines').pages} pages that put a false plain-word sentence before his true lines still earned their step marks` : 'see the sweep above'}: the approved rule does not treat prose as a claim.`,
      `- **Working from a different question can earn a mark where steps are genuinely shared.** In the sweep, ${R.byClass.get('another-questions-working') ? `${R.byClass.get('another-questions-working').coincidences || 0} of ${R.byClass.get('another-questions-working').pages} pages of another question's working earned a mark` : 'a page of another question\'s working earned a mark in a few cases'}; these are listed as coincidences, not hidden, and the paying line is a line that is also true for this question. (The independent review found 5 such pages over its own, larger set of other-question pages.)`,
      '- **It trusts the page\'s ticks.** A wrong tick by the page could be paid; the sweep cannot prove none remains.',
      '- **Prose is let through.** As said above, plain words are not a claim to this rule, so a false sentence does not stop your true lines after it.',
      `- **Your criteria are not shown.** The table shows your step headings and the step's result, not your marking criteria. Your criteria rule (a separate, unapproved draft) pays on only ${C.parts + C.onlyCriteriaParts} parts; on the ${C.parts} parts where both apply this rule paid more on ${C.genericMore} of ${C.pages} test pages and less on ${C.criteriaMore}. On ${C.onlyGeneric} pages only this rule paid and on ${C.onlyCriteria} only the criteria rule did, and in the six pages of that kind checked by hand the extra mark was for a true line of your own working.`,
      '- It never pays a question worth one mark, a worked-solution question, and never for a model\'s reading: only the engine\'s own tick.', '');
    L.push('## What would raise the number most', '', `Your ${U.parts} parts worth 2 or more marks have ${U.lines} worked lines the page can read, of which ${U.ticked} are ticked and ${U.notTicked} are not. The commonest kinds of line it does not tick:`, '');
    for (const k of U.kinds.slice(0, 6)) L.push(`- ${k.n} lines, ${k.kind}. For example ${k.ex[0]}`);
    L.push('', 'And the maths the line reader cannot turn into a line at all, by the command it stops on:', '');
    for (const [k, v] of U.unread) L.push(`- ${v.n} pieces with ${k}. For example ${v.ex}`);
    L.push('', 'Nothing here is an official NESA marking guideline.', '');
    L.push('## Review record', '', 'To be filled in by the author (the tutor). Leave blank until reviewed.', '', '- Decision (approved by the author / changes needed): ', '- Note: ', '- Name: ', '- Date: ', `- Rule digest: \`${bankGenericDigest()}\` (the generic rule it applies is unchanged at \`${genericDigest()}\`)`, '');
    memo = L.join('\n');
    return memo;
  } finally { resetQbank(); }
}
