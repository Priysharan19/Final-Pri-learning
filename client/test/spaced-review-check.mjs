// Pri Learning · spaced review ladder (engine/spacedReview.js, docs/product/spaced-review.md)
import assert from 'node:assert/strict';
import { LADDER_DAYS, MISS_DROP, nextRung, spacedSchedule } from '../src/engine/spacedReview.js';

let n = 0;
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };
const DAY = 86_400_000;
const T = Date.parse('2026-11-01T06:00:00Z');

eq([LADDER_DAYS, MISS_DROP], [[1, 2, 4, 7, 14, 30, 60], 2], 'the documented parameters');
eq(nextRung(2, { correct: true, elapsedMs: 4 * DAY }), 3, 'a correct recall on time grows the interval');
eq(nextRung(2, { correct: true, elapsedMs: 1.9 * DAY }), 2, 'a correct answer before half the interval holds the rung');
eq(nextRung(2, { correct: true, elapsedMs: 2 * DAY }), 3, 'at exactly half the interval it counts');
eq(nextRung(2, { correct: true, hintsUsed: 1, elapsedMs: 9 * DAY }), 2, 'a hinted correct answer holds the rung');
eq(nextRung(3, { correct: false }), 1, 'a miss drops two rungs');
eq(nextRung(1, { correct: false }), 0, 'never below the first rung');
eq(nextRung(4, { correct: true, revealed: true, elapsedMs: 99 * DAY }), 2, 'a revealed answer counts as a miss');
eq(nextRung(LADDER_DAYS.length - 1, { correct: true, elapsedMs: 999 * DAY }), LADDER_DAYS.length - 1, 'bounded at the top rung');

const a = (day, correct, extra = {}) => ({ subtopic: 'c10-circles', dotpoint: '1', correct, at: T + day * DAY, ...extra });
const hist = [a(0, true), a(1, true), a(3, true), a(7, true), a(14, false)];
const s = spacedSchedule(hist, T + 15 * DAY);
eq(s.items[0].rung, 1, 'up 0→1→2→3 then a miss back to 1');
eq([s.items[0].intervalDays, s.items[0].dueAt], [2, T + 16 * DAY], 'due two days after the miss');
eq(s.today.length, 0, 'not due yet');
eq(spacedSchedule(hist, T + 16 * DAY).today.map(r => r.subtopic), ['c10-circles'], 'due today once its time comes');
eq(spacedSchedule([...hist].reverse(), T + 15 * DAY), s, 'order-independent: replayed by time');
eq(spacedSchedule([a(0, true), { subtopic: '', correct: true, at: T }, { subtopic: 'x', at: T }], T + DAY).items.length, 1, 'malformed and unmarked attempts are ignored');
const two = spacedSchedule([a(0, true), a(0, true, { dotpoint: '2' }), a(0, true, { subtopic: 'c10-statistics' })], T + 5 * DAY);
eq([two.items.length, two.today.length], [3, 3], 'each dot point is its own item, and all overdue items are due today');

console.log(`SPACED REVIEW: PASS — ${n}/${n} checks`);
