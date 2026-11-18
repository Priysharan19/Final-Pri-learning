// RETIRED GATE, DECIDED RULE (owner decision, 19 Nov 2026; ADR-0001 amendment of the same date).
//
// This suite used to pin the confirmation gate (standard P0 #11, PRs #999 and #1016): "Check what Pri read" and
// "Confirm and mark". The owner decided the student no longer confirms the reading, and the typed reading is not shown
// before marking. What the old suite protected is kept, in its new form:
//   - NO MARK FROM A DOUBTFUL LINE: a line read below the reader's floor, flagged uncertain or blank is never judged and
//     never feeds the final answer (client/src/ink/readingFloor.js here; the SERVER enforces the same on the submission:
//     server/platform/readingFloor.js, tested over HTTP by server/test/reading-floor-http-check.mjs);
//   - an unreadable final answer stops the press before anything is sent;
//   - the reading used is recorded with the submission and never as confirmed by the student;
//   - the original strokes still travel, the reader stays answer-blind, the exam room is untouched.
// The browser behaviour is pinned by tour-ink.js, tour-auto-read.js, tour-photo-answer.js and tour-marked-page.mjs.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { confirmedRevision } from '../src/ink/confirmGate.js';
import { lineIsJudged, readingJudgement } from '../src/ink/readingFloor.js';

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n += 1; };
const F = 0.82;

// The floor: at the floor judged, just below not; doubt, blank and a missing confidence never.
ok(lineIsJudged('x = 5', { conf: 0.82 }, F) && !lineIsJudged('x = 5', { conf: 0.8199 }, F), 'a line is judged at the floor and not just below it');
for (let c = 0; c < 82; c += 2) ok(!lineIsJudged('y = 1', { conf: c / 100 }, F), `sweep: confidence ${c / 100} is below the floor and is never judged`);
ok(!lineIsJudged('x = 5', { conf: 0.99, uncertain: true }, F) && !lineIsJudged('x = 5', { conf: 0.99, doubt: 'a or o' }, F), 'a line the reader flagged uncertain is never judged, however confident');
ok(!lineIsJudged('   ', { conf: 0.99 }, F) && !lineIsJudged('x', {}, F) && !lineIsJudged('x', { conf: NaN }, F), 'a blank line and a line with no confidence are never judged');
ok(lineIsJudged('x = 9', { conf: 0.2, corrected: true }, F), 'a line the student corrected is their own text: judged as typed');

const reading = { lines: ['3x + 5 = 20', '3x = 15', 'x = 5'], lineMeta: [{ conf: 0.97 }, { conf: 0.9 }, { conf: 0.4 }], confidenceFloor: 0.82 };
const j = readingJudgement(reading);
ok(JSON.stringify(j.judged) === '[true,true,false]' && JSON.stringify(j.notRead) === '[2]' && j.lastJudged === false, 'the page is judged line by line; a doubtful final line is named and the final answer is unreadable');
ok(readingJudgement({ ...reading, confidenceFloor: 0.95 }).notRead.length === 2, 'the reader\'s own floor travels with the reading and is never lowered here');
ok(readingJudgement({ lines: ['a'], lineMeta: [{ conf: 0.9 }] }).judged[0] === true, 'a reading without a floor falls back to the reader\'s default 0.82, never lower');

// The record kept with a submission never says the student confirmed.
const rev = confirmedRevision({ reading: '7', signature: '3:120:abc', text: 'x=7', edited: true, now: 5 });
ok(rev.reading === '7' && rev.signature === '3:120:abc' && rev.transcript === 'x=7' && rev.edited === true && rev.at === 5, 'the record names the reading used, the page signature, the transcript and whether it was edited');
ok(rev.studentConfirmed === false && Object.isFrozen(rev), 'and says the student did not confirm it; it is immutable');
ok(JSON.stringify(Object.keys(confirmedRevision({ reading: 'a' })).sort()) === JSON.stringify(['at', 'edited', 'reading', 'signature', 'studentConfirmed', 'transcript']), 'the record carries no answer, mark or expected value');

const card = readFileSync(new URL('../src/components/QuestionCard.jsx', import.meta.url), 'utf8');
ok(!/needsConfirmation\(|data-confirm-reading|acceptReading|verdict\.confirmTitle|vouched/.test(card), 'the card has no confirmation gate, panel or "Confirm and mark" any more');
ok(/const floorJudgement = useMemo\(\(\) => readingJudgement\(inkResult\), \[inkResult\]\);/.test(card), 'the card asks the reading floor which lines are judged');
ok(/!floorJudgement\.lastJudged \? ''/.test(card) && /proposeFinalAnswer\(inkResult\.lines\.filter\(\(_, i\) => floorJudgement\.judged\[i\]\), publicAnswerShape\)/.test(card), 'the final answer is never taken from a line that is not judged');
ok(/if \(!String\(inkAnswer\)\.trim\(\)\) \{ setFinalUnreadable\(true\); return; \}/.test(card), 'an unreadable final answer stops the press before anything is sent or spent');
ok(/e\?\.code === 'FINAL_ANSWER_UNREADABLE'/.test(card) && /clearPendingSubmission\(question\.id\);\s*setFinalUnreadable\(true\)/.test(card), 'the server\'s FINAL_ANSWER_UNREADABLE keeps the page, records nothing and asks for the line again');
ok(/\{ answerTyped: true \}/.test(card) && /\(viaInk && !isWorking && inkAnswerTyped\)/.test(card), 'only a final answer the student typed themselves is sent as typed');
ok(/studentConfirmed: false/.test(readFileSync(new URL('../src/ink/confirmGate.js', import.meta.url), 'utf8')) && /confirmed: viaInk \? confirmedRef\.current : null/.test(card), 'the reading used is kept with the submission record');
ok(/ink = \{ strokes: compactInkStrokes\(inkResult\.strokes\), recognized: inkResult\.text/.test(card), 'the original strokes still travel with the reading');
ok(/run: pressMark/.test(card) && /verdict\.markMyWorking/.test(card), 'the primary is one press: Mark my working');
const inkSrc = readFileSync(new URL('../src/ink/InkAnswer.jsx', import.meta.url), 'utf8');
ok(/showReading=\{false\}/.test(card) && /\{showReading && rec\.lines\.length > 0 && \(/.test(inkSrc) && /\{showReading && INSTRUMENT_PLOT && !stale && rec\.lines\.some/.test(inkSrc), 'practice never draws the reading list or the per-line chips');
const exam = readFileSync(new URL('../src/pages/ExamRoom.jsx', import.meta.url), 'utf8');
ok(!/confirmGate\.js|readingFloor\.js/.test(exam), 'the exam room keeps its own rules (it is not touched here)');
// Photo/PDF transcript helpers stay pure and unchanged: the line a reader doubted is still flagged and a student edit still replaces it.
const { editLine, reviveTranscript } = await import('../src/photo/transcript.js');
const tr = { lines: [{ text: 'a', read: 'a', check: false, excluded: true, why: 'student', edited: false }, { text: 'x+1', read: 'x+1', check: true, excluded: false, edited: false }], undecided: false, anchor: null };
ok(editLine(tr, 1, 'x+2').lines[1].edited === true && reviveTranscript(editLine(tr, 1, 'x+2')).lines[1].text === 'x+2', 'an edited photo line is the student\'s own text and survives a kept draft');
console.log(`READING FLOOR (CLIENT): PASS — ${n}/${n} checks — a doubtful line is never judged or the final answer, an unreadable final answer stops the press, nothing is confirmed by the student, the reading used is recorded, the exam room is untouched`);
