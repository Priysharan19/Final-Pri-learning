// Deterministic checks for the Today set, the retest timing and edition string parity.
import assert from 'node:assert/strict';
import { buildTodaySet, interleave, ITEM_MINUTES, MAX_MINUTES, TARGET_MINUTES } from '../src/today/todaySet.js';
import { buildNotebook, reviewFor } from '../src/engine/mistakeNotebook.js';
import { spacedSchedule } from '../src/engine/spacedReview.js';
import en from '../src/i18n/strings.en.js';
import hi from '../src/i18n/strings.hi.js';

const DAY = 86_400_000;
const now = Date.UTC(2026, 10, 18, 9);
let n = 0; const ok = (name, fn) => { fn(); n++; console.log('ok', name); };

const wrong = (id, subtopic, daysAgo, extra = {}) => ({ attemptId: id, subtopic, at: now - daysAgo * DAY, correct: false, mode: 'practice', questionId: 'q' + id, ...extra });
const book = attempts => {
  const b = buildNotebook(attempts, { now });
  return { groups: b.groups.map(g => ({ ...g, items: g.items.map(i => ({ ...i, canTwin: true })) })) };
};

ok('retest timing: a miss is due after 1 day, then 3, never earlier', () => {
  assert.equal(reviewFor({ answeredAt: now - 0.5 * DAY, retries: [], fixed: false, now }).due, false);
  assert.equal(reviewFor({ answeredAt: now - 1 * DAY, retries: [], fixed: false, now }).due, true);
  const failedRetry = [{ correct: false, at: now - 0.5 * DAY }];
  const r = reviewFor({ answeredAt: now - 2 * DAY, retries: failedRetry, fixed: false, now });
  assert.equal(r.due, false); assert.equal(Math.round((r.dueAt - (now - 0.5 * DAY)) / DAY), 3);
  assert.equal(reviewFor({ answeredAt: now - 9 * DAY, retries: [], fixed: true, now }).due, false);
});

ok('a fresh miss is not in Today; a day-old miss is a retest; a fixed one never is', () => {
  const b = book([wrong('a', 'alg', 0.2), wrong('b', 'geo', 1.5), wrong('c', 'num', 2), { attemptId: 't', twinOf: 'c', subtopic: 'num', at: now - 1 * DAY, correct: true, mode: 'review' }]);
  const s = buildTodaySet({ notebook: b, now });
  assert.deepEqual(s.items.map(i => i.attemptId), ['b']);
  assert.equal(s.items[0].kind, 'retest');
});

ok('sizing: about 12 minutes, never over 15, nothing dropped from the schedule', () => {
  const attempts = Array.from({ length: 12 }, (_, i) => wrong('m' + i, 's' + i, 2 + i));
  const s = buildTodaySet({ notebook: book(attempts), now });
  assert.ok(s.minutes >= TARGET_MINUTES && s.minutes <= MAX_MINUTES, String(s.minutes));
  assert.equal(s.items.length + s.held, 12);
  assert.equal(s.minutes, s.items.length * ITEM_MINUTES.retest);
});

ok('interleaving: no two neighbours share a chapter when another order exists', () => {
  const rows = ['a', 'a', 'b', 'b', 'c'].map((subtopic, i) => ({ id: 'x' + i, subtopic }));
  const out = interleave(rows);
  for (let i = 1; i < out.length; i++) assert.notEqual(out[i].subtopic, out[i - 1].subtopic);
  assert.deepEqual(interleave(rows), out, 'deterministic');
  assert.equal(interleave([{ id: '1', subtopic: 'a' }, { id: '2', subtopic: 'a' }]).length, 2);
});

ok('spaced reviews mix with retests: retests first, most overdue review next, deterministic', () => {
  const reviews = { today: [
    { subtopic: 'ratio', dotpoint: 'd1', dueAt: now - 5 * DAY, overdueDays: 5, href: '/practice?subtopic=ratio' },
    { subtopic: 'area', dotpoint: 'd2', dueAt: now - 1 * DAY, overdueDays: 1, href: '/practice?subtopic=area' }] };
  const input = { notebook: book([wrong('a', 'alg', 3)]), reviews, now };
  const s = buildTodaySet(input);
  assert.equal(s.items[0].kind, 'retest');
  assert.deepEqual(s.items.map(i => i.kind).sort(), ['retest', 'review', 'review']);
  assert.deepEqual(buildTodaySet(input), s);
  assert.equal(s.items.at(-1).subtopic !== s.items.at(-2).subtopic, true);
});

ok('spaced ladder spaces by due date from mastery data', () => {
  const sch = spacedSchedule([{ subtopic: 'ratio', correct: true, at: now - 3 * DAY }], now);
  assert.equal(sch.today.length, 1);
  assert.equal(spacedSchedule([{ subtopic: 'ratio', correct: true, at: now - 0.2 * DAY }], now).today.length, 0);
});

ok('no-repeat: the retest is drawn by the server twin route, never the original (server suite)', () => {
  // The fresh instance is chosen by POST /notebook/:id/twin with the original's content
  // hash in `avoid` and the account's seen records consulted; server/test/mistake-notebook-check.mjs
  // covers that route. Here we pin that Today never re-serves the stored question.
  const s = buildTodaySet({ notebook: book([wrong('a', 'alg', 3)]), now });
  assert.equal(s.items[0].questionId, undefined);
  assert.equal(JSON.stringify(s.items[0]).includes('qa'), false);
});

ok('edition parity: every Today and error-log string exists in en (en-AU shares it) and hi, same plural shape', () => {
  const keys = Object.keys(en).filter(k => k.startsWith('today.') || k.startsWith('errorLog.'));
  assert.ok(keys.length >= 18);
  for (const k of keys) {
    assert.ok(k in hi, 'hi missing ' + k);
    assert.equal(typeof en[k], typeof hi[k], k);
    if (typeof en[k] === 'object') assert.deepEqual(Object.keys(en[k]), Object.keys(hi[k]), k);
    const vars = s => [...String(typeof s === 'object' ? s.other : s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join();
    assert.equal(vars(en[k]), vars(hi[k]), k);
  }
  const copy = keys.map(k => JSON.stringify(en[k])).join(' ');
  assert.equal(/improv|proven|boost|guarantee|better grades|retain more/i.test(copy), false, 'no efficacy claims');
});
console.log(`TODAY SET: PASS — ${n}/${n} checks`);
