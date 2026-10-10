// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · what the card may say about a marked handwritten attempt.
//
// Two defects were seen on staging with the real handwriting reader:
//
//   A · "224" was misread as three lines (2, 2, +). The student typed 224 as
//       the final answer and the server correctly gave 3/3. The card then said
//       every line of the working had been checked and verified, ticked the
//       "+", and showed "Your answer: +".
//   B · After a wrong answer, the previous attempt's "Look here" marker stayed
//       on newly written ink that had never been submitted.
//
// This suite holds the rules (src/components/attemptEvidence.js) to the
// evidence. The step reports and method notes are produced here by the SAME
// deterministic marking function the server runs for a resolved submission
// (server/platform/markerOps.js → stepEvidence), on plain question data; the
// reader's transcripts are scripted. It is synthetic evidence: no real
// handwriting, reader, device or student is involved.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  annotationsLive, answerIsLastLine, inkLineVerdicts, reportForLines, revisionKey, sameLines,
  transcriptIsAnswer, workingEvidence, workingEvidenceCopy
} from '../src/components/attemptEvidence.js';
import { stepEvidence, marksPossibleFor } from '../../server/platform/markerOps.js';
import { checkAnswer } from '../src/engine/checker.js';
import EN from '../src/i18n/strings.en.js';
import HI from '../src/i18n/strings.hi.js';
import { pluralCategory } from '../src/i18n/languages.js';

const HERE = dirname(fileURLToPath(import.meta.url));
let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
// The catalogue entry for a key, filled the way the app fills it.
const say = (strings, language) => (key, vars = {}) => {
  const entry = strings[key];
  const template = typeof entry === 'string' ? entry : entry?.[pluralCategory(vars.count, language)] ?? entry?.other;
  return typeof template === 'string' ? template.replace(/\{(\w+)\}/g, (whole, name) => (name in vars ? String(vars[name]) : whole)) : key;
};
const en = say(EN, 'en');
const hi = say(HI, 'hi');

// ── The server's side, as the server computes it ─────────────────────────────
// A resolved reply carries { correct, stepReport, partial } from exactly this.
function serverReply(q, answer, lines) {
  const steps = lines && lines.length ? lines.join('\n') : undefined;
  const result = checkAnswer(q, answer, { steps });
  const evidence = stepEvidence(q, answer, steps, result);
  return {
    authoritative: true, resolved: true, invalid: result.invalid === true, correct: result.correct === true,
    marksPossible: marksPossibleFor(q), stepReport: evidence.stepReport, partial: evidence.partial
  };
}
const submittedInk = (answer, lines, extra = {}) => ({
  questionId: 'q1', submissionId: 'sub-1', answer, lines, viaInk: true, sourceMode: 'ink',
  hasWorking: lines.length > 1 || String(answer).trim() !== String(lines[lines.length - 1]).trim(), revision: 'rev-1', ...extra
});
const sentence = (res, submitted) => {
  const evidence = workingEvidence({ res, submitted });
  const copy = workingEvidenceCopy(evidence, { correct: res.correct === true });
  return { evidence, text: copy ? en(copy.key, copy.vars) : null, hindi: copy ? hi(copy.key, copy.vars) : null };
};
const marks = (res, submitted, shownLines = submitted.lines, more = {}) => inkLineVerdicts({
  outcome: res.resolved ? (res.correct ? 'resolved-correct' : 'resolved-wrong') : 'retry-wrong',
  res, submitted, shownLines, ...more
});
const positive = verdicts => (verdicts || []).filter(v => v.status === 'ok').length;

// A plain arithmetic question (no step meta: the server has nothing to check
// lines against) and an equation question (the server checks each line).
const ARITH = { answerType: 'numeric', answer: { value: 224 }, prompt: 'Work out $7 \\times 32$.', difficulty: 3,
  steps: [{ h: 'Split', d: '7 × 30 + 7 × 2' }, { h: 'Add', d: '210 + 14' }, { h: 'Answer', d: '224' }] };
const EQN = { answerType: 'numeric', answer: { value: 4 }, answerPrefix: 'x =', prompt: 'Solve $2x + 3 = 11$.', difficulty: 3,
  steps: [{ h: 'Subtract 3', d: '2x = 8' }, { h: 'Divide by 2', d: 'x = 4' }, { h: 'Answer', d: '4' }] };

// ── 1 · The staging case: 224 misread as 2 / 2 / +, final answer typed ───────
{
  const lines = ['2', '2', '+'];
  const res = serverReply(ARITH, '224', lines);
  ok(res.correct === true && res.stepReport === null, 'staging case: the server marks 224 correct and reports nothing about the lines');
  const sub = submittedInk('224', lines);
  const said = sentence(res, sub);
  eq(said.evidence, { kind: 'none' }, 'staging case: no step evidence exists for the misread lines');
  eq(said.text, 'Your final answer was checked. Your working was not verified.', 'staging case: the card says the working was not verified');
  ok(!/verified, reaching|logical chain|Every line/i.test(said.text), 'staging case: nothing claims the lines were verified');
  eq(marks(res, sub), null, 'staging case: no line of the misread transcript is ticked — not the "+", not the 2s');
  ok(answerIsLastLine(sub) === false, 'staging case: the confirmed answer (224) is not the last ink line (+)');
  ok(transcriptIsAnswer(lines.join('\n'), '224') === false, 'staging case: History does not call the transcript the answer');
  ok(sub.answer === '224', 'staging case: the submitted answer shown is 224');
}

// ── 2 · Correct final + unreadable working (equation question) ───────────────
{
  const lines = ['@@ ??', '~~', 'x = 4'];
  const res = serverReply(EQN, '4', lines);
  const sub = submittedInk('4', lines);
  const said = sentence(res, sub);
  ok(res.correct === true, 'unreadable working: the final answer is correct');
  ok(said.evidence.kind === 'some' && said.evidence.ok === 1 && said.evidence.total === 3,
    `unreadable working: only the one readable line is reported as checked (${JSON.stringify(said.evidence)})`);
  eq(said.text, '1 of the 3 lines of your working were checked and are consistent with the correct solution. The rest were not verified.',
    'unreadable working: the sentence counts only what was checked');
  const v = marks(res, sub);
  ok(positive(v) === 1 && v[0].status === 'unknown' && v[1].status === 'unknown' && v[2].status === 'ok',
    'unreadable working: the unreadable lines get no tick');
}
{
  const lines = ['@@ ??', '~~'];
  const res = serverReply(EQN, '4', lines);
  const said = sentence(res, submittedInk('4', lines));
  eq(said.evidence, { kind: 'none' }, 'wholly unreadable working: nothing was verified');
  eq(marks(res, submittedInk('4', lines)), null, 'wholly unreadable working: no marks on the ink');
}

// ── 3 · Correct final + mathematically incorrect working ─────────────────────
{
  const lines = ['2x = 14', 'x = 7'];
  const res = serverReply(EQN, '4', lines);
  const sub = submittedInk('4', lines);
  const said = sentence(res, sub);
  ok(res.correct === true && res.stepReport?.firstBreak === 0, 'incorrect working: correct answer, and the server reports the break on line 1');
  eq(said.text, 'Your final answer is correct, but line 1 of your working does not hold. See the step check below.',
    'incorrect working: a right answer does not launder wrong working');
  const v = marks(res, sub);
  ok(positive(v) === 0 && v[0].status === 'break', 'incorrect working: the broken line is marked, and nothing is ticked');
}

// ── 4 · Correct + fully verified method ──────────────────────────────────────
{
  const lines = ['2x + 3 = 11', '2x = 8', 'x = 4'];
  const res = serverReply(EQN, 'x = 4', lines);
  const sub = submittedInk('x = 4', lines);
  const said = sentence(res, sub);
  ok(res.correct === true, 'verified method: correct');
  eq(said.evidence, { kind: 'all', total: 3 }, 'verified method: every submitted line is in the server report as holding');
  eq(said.text, 'Your working was checked: all 3 lines you submitted are consistent with the correct solution.', 'verified method: said from the report');
  ok(positive(marks(res, sub)) === 3, 'verified method: all three lines are ticked — from the report');
  ok(/सभी 3 पंक्तियाँ/.test(said.hindi), 'verified method: the Hindi sentence carries the same count');
}

// ── 5 · Correct + partially valid method ─────────────────────────────────────
{
  const lines = ['2x + 3 = 11', 'take 3 away from both', 'x = 4'];
  const res = serverReply(EQN, 'x = 4', lines);
  const sub = submittedInk('x = 4', lines);
  const said = sentence(res, sub);
  ok(said.evidence.kind === 'some' && said.evidence.ok === 2 && said.evidence.total === 3, `partial method: two of three lines checked (${JSON.stringify(said.evidence)})`);
  const v = marks(res, sub);
  ok(positive(v) === 2 && v[1].status === 'unknown', 'partial method: the line nobody could check has no tick');
}

// ── 6 · Incorrect final + legitimate intermediate steps ──────────────────────
{
  const lines = ['2x + 3 = 11', '2x = 8', 'x = 5'];
  const res = serverReply(EQN, 'x = 5', lines);
  const sub = submittedInk('x = 5', lines);
  ok(res.correct === false, 'wrong final: marked incorrect');
  ok(res.stepReport?.lines?.[0]?.status === 'ok' && res.stepReport.lines[1].status === 'ok' && res.stepReport.firstBreak === 2,
    'wrong final: the server report credits the two true lines and places the break on the last');
  const said = sentence(res, sub);
  eq(said.text, 'Line 3 of your working does not hold. See the step check below.', 'wrong final: the break is named, not the whole page');
  const v = marks(res, sub);
  ok(v[0].status === 'ok' && v[1].status === 'ok' && v[2].status === 'break', 'wrong final: true lines keep their ticks, the wrong line is marked');
  ok(res.partial === null || Number.isInteger(res.partial.awarded), 'wrong final: any method credit is the server\'s own figure');
}

// ── 7 · Multiple reader lines with incomplete symbols ────────────────────────
{
  const lines = ['2x +', '= 8', 'x ='];
  const res = serverReply(EQN, '4', lines);
  const sub = submittedInk('4', lines);
  const said = sentence(res, sub);
  ok(res.correct === true, 'incomplete symbols: the typed final answer is correct');
  ok(said.evidence.kind === 'none' || (said.evidence.kind !== 'all' && positive(marks(res, sub)) < 3),
    `incomplete symbols: fragments are not reported as verified (${JSON.stringify(said.evidence)})`);
  ok(!(marks(res, sub) || []).some((v, i) => v.status === 'ok' && res.stepReport?.lines?.[i]?.status !== 'ok'),
    'incomplete symbols: every tick has a server "ok" behind it');
}

// ── 8 · A report is used only for the lines it is a report OF ────────────────
{
  const lines = ['2x + 3 = 11', '2x = 8', 'x = 4'];
  const res = serverReply(EQN, 'x = 4', lines);
  ok(reportForLines(res.stepReport, lines) === res.stepReport, 'a report of the submitted lines is used');
  ok(reportForLines(res.stepReport, ['2x + 3 = 11', 'x = 4']) === null, 'a report of other lines (a different count) is not');
  ok(reportForLines(res.stepReport, ['2x + 3 = 11', '2x = 9', 'x = 4']) === null, 'a report of other lines (different text) is not');
  ok(reportForLines(null, lines) === null && reportForLines({ lines: [] }, lines) === null, 'no report is no evidence');
  // The transcript on screen is not the one that was submitted (a later read).
  eq(marks(res, submittedInk('x = 4', lines), ['2x + 3 = 11', '2x = 8', 'x = 9']), null, 'marks are not drawn on a transcript that was not the one submitted');
  eq(workingEvidence({ res: { ...res, workingNotRead: true }, submitted: submittedInk('x = 4', lines) }), { kind: 'none' },
    'working the server says it did not read is not verified, whatever else the reply holds');
  eq(workingEvidence({ res: { ...res, revealed: true }, submitted: submittedInk('x = 4', lines) }), null, 'a revealed solution is not a marked attempt');
  eq(workingEvidence({ res, submitted: { ...submittedInk('x = 4', ['x = 4']), hasWorking: false } }), null, 'an answer with no working gets no sentence about working');
}

// ── 9 · The last line carries the answer's verdict only when it IS the answer ─
{
  const one = submittedInk('224', ['224'], { hasWorking: false });
  const right = { authoritative: true, resolved: true, correct: true, stepReport: null };
  eq(marks(right, one), [{ status: 'ok' }], 'a single written line that is the submitted answer is ticked when the server marks it correct');
  const wrongOpen = { authoritative: true, resolved: false, correct: false, stepReport: null };
  const wrote = submittedInk('186', ['186'], { hasWorking: false });
  eq(marks(wrongOpen, wrote), [{ status: 'wrong', noteKind: 'rework' }], 'a wrong answer that is the last line is pointed at');
  eq(marks(wrongOpen, submittedInk('200', ['2', '2', '+'])), null, 'a wrong typed answer is never pinned on an unrelated last ink line');
  eq(marks({ ...wrongOpen, resolved: true }, wrote), [{ status: 'wrong', noteKind: 'conclude' }], 'resolved wrong: the same line, with the resolved wording');
  ok(answerIsLastLine(submittedInk('x = 4', ['2x = 8', 'x = 4']), { answeredByWorking: true }) === false, 'a question answered by its working has no separate answer line');
}

// ── 10 · Defect B: annotations belong to one revision of the page ────────────
{
  const base = { questionId: 'q1', mode: 'write', inkSignature: '3:40:abc', inkStale: false, transcript: '186', inkAnswer: '186' };
  const judged = { ...submittedInk('168', ['168'], { hasWorking: false }), revision: revisionKey({ ...base, inkSignature: '3:38:old', transcript: '168', inkAnswer: '168' }) };
  const sameKey = judged.revision;
  ok(annotationsLive({ judged, currentKey: sameKey }) === true, 'unchanged page: the annotations are of what is on screen');
  const wrongOpen = { authoritative: true, resolved: false, correct: false, stepReport: null };
  const changes = {
    'a new stroke': { inkSignature: '4:52:new', transcript: '168', inkAnswer: '168' },
    'an erased stroke': { inkSignature: '2:21:less', transcript: '168', inkAnswer: '168' },
    'a cleared pad': { inkSignature: null, transcript: '', inkAnswer: '' },
    'a reading gone stale': { inkSignature: '3:38:old', inkStale: true, transcript: '168', inkAnswer: '168' },
    'a corrected transcript': { inkSignature: '3:38:old', transcript: '186', inkAnswer: '186' },
    'a corrected final answer': { inkSignature: '3:38:old', transcript: '168', inkAnswer: '186' },
    'typing instead': { mode: 'type', inkSignature: '3:38:old', transcript: '168', inkAnswer: '168' },
    'a photo instead': { mode: 'photo', inkSignature: '3:38:old', transcript: '168', inkAnswer: '168' },
    'another question': { questionId: 'q2', inkSignature: '3:38:old', transcript: '168', inkAnswer: '168' }
  };
  for (const [what, change] of Object.entries(changes)) {
    const key = revisionKey({ ...base, ...change });
    const live = annotationsLive({ judged, currentKey: key });
    ok(key !== sameKey && live === false, `${what}: the previous submission's annotations are withdrawn`);
    eq(marks(wrongOpen, judged, ['168'], { live }), null, `${what}: no mark is drawn on the page`);
  }
  // The correct, unsubmitted 186 of the staging report.
  const rewritten = revisionKey({ ...base });
  eq(marks(wrongOpen, judged, ['186'], { live: annotationsLive({ judged, currentKey: rewritten }) }), null,
    'a correct, unsubmitted 186 written over a wrong 168 carries no "Look here"');
  // Withdrawn stays withdrawn: undoing back to the old page does not restore it.
  ok(annotationsLive({ judged, currentKey: sameKey, latched: true }) === false, 'once withdrawn, the annotations do not come back by undoing');
  // A result recovered for an earlier submission names no revision of this page.
  ok(annotationsLive({ judged: { ...judged, revision: null }, currentKey: sameKey }) === false, 'a recovered result is not pinned on the page');
  ok(annotationsLive({ judged: null, currentKey: sameKey }) === true, 'nothing judged, nothing to withdraw');
  // Typed and photo revisions move too.
  const typed = revisionKey({ questionId: 'q1', mode: 'type', answer: '168', working: '' });
  ok(typed !== revisionKey({ questionId: 'q1', mode: 'type', answer: '186', working: '' }), 'a different typed answer is a different revision');
  ok(typed !== revisionKey({ questionId: 'q1', mode: 'type', answer: '168', working: '100 + 68' }), 'different typed working is a different revision');
  ok(typed === revisionKey({ questionId: 'q1', mode: 'type', answer: ' 168 ', working: '' }), 'surrounding spaces are not a correction');
  ok(revisionKey({ questionId: 'q1', mode: 'photo', photo: 'data:a', answer: '1' }) !== revisionKey({ questionId: 'q1', mode: 'photo', photo: 'data:bb', answer: '1' }), 'another photo is a different revision');
  ok(revisionKey({ questionId: 'q1', mode: 'mcq', choice: 0 }) !== revisionKey({ questionId: 'q1', mode: 'mcq', choice: 2 }), 'another choice is a different revision');
}

// ── 11 · History and replay: the answer is the confirmed one ─────────────────
ok(transcriptIsAnswer('2x = 8\nx = 4', 'x = 4') === true, 'History: a transcript ending in the marked answer is that answer');
ok(transcriptIsAnswer('2\n2\n+', '224') === false, 'History: a misread transcript is labelled as a transcript, not as the answer');
ok(transcriptIsAnswer('2x = 8\nx = 4', '2x = 8\nx = 4') === true, 'History: working that was itself the answer');
ok(transcriptIsAnswer('', '224') === false && transcriptIsAnswer('224', '') === false, 'History: nothing is claimed from an empty side');
ok(sameLines(['a ', 'b'], ['a', ' b']) && !sameLines(['a'], ['a', 'b']) && !sameLines(null, []), 'line comparison ignores surrounding space only');

// ── 12 · The copy, in both languages, and the retired claim ──────────────────
const KEYS = ['verdict.workingNotChecked', 'verdict.workingSomeChecked', 'verdict.workingBreakButCorrect', 'verdict.workingBreak',
  'verdict.transcriptNotAnswer', 'verdict.previousAttemptWrong', 'verdict.previousAttemptUnread', 'verdict.newWorkNotChecked', 'history.readAsNotAnswer'];
for (const key of KEYS) {
  const [e, h] = [en(key, { ok: 1, total: 3, line: 2, text: 'x' }), hi(key, { ok: 1, total: 3, line: 2, text: 'x' })];
  ok(typeof e === 'string' && e && e !== key && typeof h === 'string' && h && h !== key && h !== e, `${key} exists in English and in Hindi`);
}
ok(en('verdict.workingAllChecked', { count: 1, n: 1 }) === 'Your working was checked: the 1 line you submitted is consistent with the correct solution.', 'the singular form reads as one line');
eq(en('verdict.previousAttemptWrong'), 'Your previous attempt was not correct.', 'the previous attempt is named as the previous attempt');
eq(en('verdict.newWorkNotChecked'), 'What is on the page now has not been checked yet. Submit it when you are ready.', 'new work is said to be unchecked');
const card = readFileSync(join(HERE, '../src/components/QuestionCard.jsx'), 'utf8');
const strings = readFileSync(join(HERE, '../src/i18n/strings.en.js'), 'utf8') + readFileSync(join(HERE, '../src/i18n/strings.hi.js'), 'utf8');
ok(!/everyLineChecked/.test(card + strings), 'the inferred "every line was checked and verified" sentence is gone from the card and from both languages');
ok(!/logical chain/.test(strings), 'no string claims a "logical chain"');
ok(!/inkResult\??\.lines\??\.length\s*>\s*1\s*&&[^\n]*verdict\./.test(card), 'no sentence about the working is keyed on the number of ink lines');
ok(/data-working-evidence=\{workEvidence\.kind\}/.test(card) && /workingEvidence\(\{ res, submitted: judged \}\)/.test(card),
  'the sentence about the working is rendered from the server evidence of the judged submission');
ok(/data-submitted-answer=\{judged\.answer\}/.test(card), '"Your answer" on a marked handwritten attempt is the submitted answer');
ok(!/boundLines\[boundLines\.length - 1\]\s*:\s*\(inkResult/.test(card) && /\? \(isWorking \? \(boundLines \? boundLines\[boundLines\.length - 1\] : ''\) : judged\.answer\)/.test(card),
  'the answer bar shows the confirmed answer, not the last transcript line');
ok(/data-verdict-of=\{previousAttempt \? 'previous-attempt'/.test(card) && /!previousAttempt && state\.res\.stepReport/.test(card),
  'a result of an earlier revision is shown as the previous attempt, without its step report');

console.log(failures.length
  ? `TRUTHFUL FEEDBACK: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `TRUTHFUL FEEDBACK: PASS — ${pass}/${pass} checks — working is called checked only from the server's step report of the submitted lines; the answer shown is the confirmed one; annotations die with their revision. [SYNTHETIC EVIDENCE: scripted transcripts, the server's marking function on plain question data]`);
process.exit(failures.length ? 1 : 0);
