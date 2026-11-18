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
// no combination of confidences lets a below-floor text through
let leaked = 0;
for (let c = 0; c < 82; c += 3) { const rr = applyReadingFloor({ readLines: [L('y = 1', c / 100)], floor: FLOOR, steps: ['y = 1'], answer: 'y = 1' }); if (rr.judged.length || rr.answer) leaked++; }
ok(leaked === 0, 'sweep: no confidence below the floor ever yields a judged line or an answer');
if (fail.length) { console.error(fail.map(f => `  · ${f}`).join('\n')); console.error(`READING FLOOR: FAIL (${fail.length})`); process.exit(1); }
console.log(`READING FLOOR: PASS — ${pass} checks — below-floor lines are never judged and never the final answer; an unreadable final answer is not marked wrong`);
