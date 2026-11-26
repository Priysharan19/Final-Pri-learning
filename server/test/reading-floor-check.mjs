// The reading floor (owner decision 19 Nov 2026): a below-floor line is never judged and never feeds the final answer.
import { applyReadingFloor, lineJudgeable } from '../platform/readingFloor.js';
let pass = 0; const fail = [];
const ok = (c, l) => { if (c) pass++; else fail.push(l); };
const FLOOR = 0.82;
const L = (text, confidence, uncertain = false) => ({ text, confidence, uncertain });
const read = [L('3x + 5 = 20', 0.97), L('3x = 15', 0.9), L('x = 5', 0.4), L('x = 5', 0.4)];

ok(lineJudgeable(L('x', 0.82), FLOOR) && !lineJudgeable(L('x', 0.8199), FLOOR), 'a line is judgeable at the floor and not just below it');
ok(!lineJudgeable(L('x', 0.99, true), FLOOR) && !lineJudgeable(L('', 0.99), FLOOR) && !lineJudgeable(L('x', undefined), FLOOR) && !lineJudgeable(L('x', NaN), FLOOR), 'a doubted, blank or confidence-less line is never judgeable');

const r = applyReadingFloor({ readLines: read, floor: FLOOR, steps: ['3x + 5 = 20', '3x = 15', 'x = 5'], answer: 'x = 5' });
ok(JSON.stringify(r.judged) === JSON.stringify(['3x + 5 = 20', '3x = 15']) && JSON.stringify(r.excluded) === '[2]', 'the below-floor line is dropped from judgement and named');
ok(r.answerUnreadable === true && r.answer === '', 'a final answer read below the floor is unreadable: it is not marked, wrong or right');
ok(r.unconfirmed === true, 'the result always says the reading was not student-confirmed');

const clear = applyReadingFloor({ readLines: [L('x = 5', 0.95)], floor: FLOOR, steps: ['x = 5'], answer: 'x = 5' });
ok(!clear.answerUnreadable && clear.answer === 'x = 5' && clear.excluded.length === 0, 'a line read at or above the floor is judged and may be the answer');
ok(applyReadingFloor({ readLines: read, floor: FLOOR, steps: ['3x = 15'], answer: '' }).answerUnreadable === true, 'an absent final answer is unreadable, not wrong');
ok(applyReadingFloor({ readLines: read, floor: FLOOR, steps: ['3x = 15', 'x = 5 (corrected by the student)'], answer: 'x = 5 (corrected by the student)' }).answerUnreadable === false, 'a line the student edited is their own text and is judged as typed');
ok(applyReadingFloor({ readLines: read, floor: FLOOR, steps: ['3x = 15', 'x = 5'], answer: 'x = 5', answerTyped: true }).answerUnreadable === false, 'a final answer the student typed is theirs even when it equals a below-floor line');
ok(applyReadingFloor({ readLines: read, floor: FLOOR, steps: ['3x = 15'], answer: '', answerTyped: true }).answerUnreadable === true, 'but an absent typed answer is still absent');
ok(JSON.stringify(applyReadingFloor({ readLines: [], floor: FLOOR, steps: ['a'], answer: 'a' }).judged) === '["a"]', 'with no read (typed working) nothing is excluded');
// A tick mark "12" read below the floor does not make a stated "12" unreadable (the owner's velocity page, 26 Nov 2026) ...
const page = [L('The maximum velocity is 12 m s^-1', 0.95), L('12', 0.5)];
ok(applyReadingFloor({ readLines: page, floor: FLOOR, steps: ['The maximum velocity is 12 m s^-1', '12'], answer: '12' }).answerUnreadable === false, 'an answer a sure line states is readable although an unrelated doubtful line is the same bare number');
// A doubtful last line is NOT rescued by a number in working: the doubtful line may say something else (reviewer, 26 Nov 2026).
ok(applyReadingFloor({ readLines: [L('v(2) = 12(2) - 3(2)^2 = 12', 0.95), L('12', 0.4)], floor: FLOOR, steps: ['v(2) = 12(2) - 3(2)^2 = 12', '12'], answer: '12' }).answerUnreadable === true, 'a working line with the same number does not rescue a doubtful final 12');
ok(applyReadingFloor({ readLines: [L('Check: v(2) = 12', 0.95), L('12', 0.4)], floor: FLOOR, steps: ['Check: v(2) = 12', '12'], answer: '12' }).answerUnreadable === true, 'nor does a check line');
ok(applyReadingFloor({ readLines: [L('v(2) = 24 - 12 = 12', 0.95), L('10', 0.4)], floor: FLOOR, steps: ['v(2) = 24 - 12 = 12', '10'], answer: '10' }).answerUnreadable === true, 'and a doubtful 10 stays unreadable');
// ... but only a whole value: 12 is not "120", "1.12" or "x12".
ok(applyReadingFloor({ readLines: [L('area = 120', 0.95), L('12', 0.5)], floor: FLOOR, steps: ['area = 120', '12'], answer: '12' }).answerUnreadable === true, 'a longer number in a sure line does not state the doubtful 12');
ok(applyReadingFloor({ readLines: [L('x = 1.12', 0.95), L('12', 0.5)], floor: FLOOR, steps: ['x = 1.12', '12'], answer: '12' }).answerUnreadable === true, 'the tail of a decimal does not state it either');
ok(applyReadingFloor({ readLines: [L('12', 0.5)], floor: FLOOR, steps: ['12'], answer: '12' }).answerUnreadable === true, 'with nothing sure that says it, a doubtful 12 is still unreadable');
// no combination of confidences lets a below-floor text through
let leaked = 0;
for (let c = 0; c < 82; c += 3) { const rr = applyReadingFloor({ readLines: [L('y = 1', c / 100)], floor: FLOOR, steps: ['y = 1'], answer: 'y = 1' }); if (rr.judged.length || rr.answer) leaked++; }
ok(leaked === 0, 'sweep: no confidence below the floor ever yields a judged line or an answer');
if (fail.length) { console.error(fail.map(f => `  · ${f}`).join('\n')); console.error(`READING FLOOR: FAIL (${fail.length})`); process.exit(1); }
console.log(`READING FLOOR: PASS — ${pass} checks — below-floor lines are never judged and never the final answer; an unreadable final answer is not marked wrong`);
