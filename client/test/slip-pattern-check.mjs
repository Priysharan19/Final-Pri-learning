// The same slip, again: deterministic pattern detection over one account's attempts.
import assert from 'node:assert/strict';
import { slipPatterns, topSlipPattern, PATTERN_WINDOW, PATTERN_MIN, DRILL_SIZE } from '../src/engine/slipPattern.js';
import { SLIP_HINTS } from '../src/engine/slipHint.js';
import { MISCONCEPTION_IDS } from '../src/engine/misconceptions.js';

let n = 0; const ok = (c, m) => { assert.ok(c, m); n += 1; };
const at = i => 1_000_000 + i * 1000;
const att = (i, over = {}) => ({ attemptId: `a${i}`, at: at(i), correct: false, subtopic: 'integration', mode: 'practice', misconception: 'int-sign', ...over });

// 3 of the last 5, newest first by time whatever the input order.
const five = [att(1, { correct: true }), att(2), att(3, { correct: true }), att(4), att(5)];
const shuffled = [five[3], five[0], five[4], five[2], five[1]];
const p = topSlipPattern(shuffled);
ok(p && p.subtopic === 'integration' && p.misconceptionId === 'int-sign' && p.count === 3 && p.of === 5, 'three of the last five');
ok(JSON.stringify(slipPatterns(shuffled)) === JSON.stringify(slipPatterns([...shuffled].reverse())), 'order of input never changes the result');
ok(p.drillFrom.length === DRILL_SIZE && p.drillFrom[0] === 'a5' && p.drillFrom.join() === 'a5,a4,a2', 'the drill is its own mistakes, newest first');
ok(PATTERN_WINDOW === 5 && PATTERN_MIN === 3 && DRILL_SIZE === 3, 'the window, floor and drill size are the stated ones');

// Two of five is not a pattern; the sixth-oldest attempt is outside the window.
ok(topSlipPattern([att(1), att(2), att(3, { correct: true }), att(4, { correct: true }), att(5, { correct: true })]) === null, 'two of five is not a pattern');
const old = [att(1), att(2), att(3), att(4, { correct: true }), att(5, { correct: true }), att(6, { correct: true }), att(7, { correct: true })];
ok(topSlipPattern(old) === null, 'slips older than the last five are outside the window');

// Only a diagnosed move counts; a wrong answer with no diagnosis is not guessed at.
ok(topSlipPattern([att(1, { misconception: null }), att(2, { misconception: undefined }), att(3, { misconception: 'not-a-move' })]) === null, 'unnamed or unknown moves are not counted');
// A revealed solution, a one-try mode and an unresolved attempt are not evidence.
ok(topSlipPattern([att(1, { revealed: true }), att(2, { revealed: true }), att(3, { revealed: true })]) === null, 'a revealed solution is not a slip');
ok(topSlipPattern([att(1, { mode: 'exam' }), att(2, { mode: 'exam' }), att(3, { mode: 'exam' })]) === null, 'exam attempts are not read here');
ok(topSlipPattern([att(1, { resolved: false }), att(2, { resolved: false }), att(3, { resolved: false })]) === null, 'unresolved attempts are not evidence');

// Topics never mix, and two moves are counted separately.
const mixed = [att(1), att(2, { subtopic: 'algebra' }), att(3), att(4, { subtopic: 'algebra' }), att(5)];
const both = slipPatterns(mixed);
ok(both.length === 1 && both[0].subtopic === 'integration' && both[0].count === 3, 'a pattern is per topic');
const two = slipPatterns([att(1), att(2), att(3), att(4, { misconception: 'diff-sign' }), att(5, { misconception: 'diff-sign' }), att(6, { misconception: 'diff-sign' })], { window: 6 });
ok(two.length === 2 && two[0].count === 3 && two[1].count === 3, 'two different moves are two patterns');

// A correct twin as the newest answer: the repair has just been shown.
ok(topSlipPattern([att(1), att(2), att(3), att(9, { correct: true, twinOf: 'a3' })]) === null, 'a correct twin retry clears the note');
ok(topSlipPattern([att(1), att(2), att(3), att(9, { correct: true })]) !== null, 'an ordinary correct answer does not');

// Input is not mutated; junk is ignored.
const frozen = Object.freeze(five.map(a => Object.freeze({ ...a })));
slipPatterns(frozen);
ok(slipPatterns([null, 7, 'x', {}, undefined]).length === 0 && slipPatterns(undefined).length === 0, 'junk input gives no pattern');

// Every hint id is a real ontology move.
for (const id of Object.keys(SLIP_HINTS)) ok(MISCONCEPTION_IDS.includes(id), `${id} is an ontology move`);
console.log(`SLIP PATTERN: PASS — ${n}/${n} checks — a repeated move is 3 of the last 5 marked answers on one topic, deterministic, per account, drill from its own mistakes`);
