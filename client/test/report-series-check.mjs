// Pri Learning · report series + History filter definitions (engine/reportSeries.js)
// Deterministic: fixed instants, fixed timezones.
// Usage: node client/test/report-series-check.mjs
import { reportSeries, needsAnotherLookIds, isSlip, addDays, REPORT_FLOORS, HISTORY_SORTS } from '../src/engine/reportSeries.js';

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => { if (cond) pass++; else { fail++; console.log(`FAIL ${name} ${detail}`); } };
const eq = (name, a, b) => ok(name, JSON.stringify(a) === JSON.stringify(b), `got ${JSON.stringify(a)} want ${JSON.stringify(b)}`);

const IST = 'Asia/Kolkata', SYD = 'Australia/Sydney';
// 2026-10-22 12:00 IST
const NOW = Date.UTC(2026, 9, 22, 6, 30);
const at = (y, m, d, h, mi = 0) => Date.UTC(y, m - 1, d, h, mi);   // UTC instant
const rows3 = (earnedMethod, possibleMethod, answerEarned) => ({
  scheme: 'pri-practice-cbse-style',
  rows: [
    ...Array.from({ length: possibleMethod }, (_, i) => ({ kind: 'working', step: i + 1, outOf: 1, earned: i < earnedMethod ? 1 : 0 })),
    { kind: 'answer', step: possibleMethod + 1, outOf: 1, earned: answerEarned }
  ]
});
const certified = (em, pm, ae, extra = {}) => ({ earned: em + ae, possible: pm + 1, repeat: false, markRows: rows3(em, pm, ae), ...extra });

// ── windows and timezone day boundaries ──────────────────────────────────────
eq('addDays crosses a month', addDays('2026-10-01', -1), '2026-09-30');
eq('addDays crosses a year', addDays('2026-01-01', -1), '2025-12-31');
{
  // 2026-10-15 18:29 UTC is 23:59 IST on the 15th; 18:31 UTC is 00:01 IST on the 16th.
  // The week ending 22 Oct runs 16–22 Oct, so the first is the previous window.
  const r = reportSeries({ period: 'week', now: NOW, timezone: IST, rows: [
    { answeredAt: at(2026, 10, 15, 18, 29), marks: certified(1, 2, 1) },
    { answeredAt: at(2026, 10, 15, 18, 31), marks: certified(2, 2, 1) }
  ] });
  eq('week window is the 7 local days ending today', [r.current.from, r.current.to], ['2026-10-16', '2026-10-22']);
  eq('previous window is the 7 days before', [r.previous.from, r.previous.to], ['2026-10-09', '2026-10-15']);
  eq('23:59 IST falls in the previous window', r.previous.questions, 1);
  eq('00:01 IST falls in the current window', r.current.questions, 1);
  eq('the 00:01 answer is the first chart day', r.series[0].questions, 1);
  eq('a week has seven daily points', r.series.length, 7);
  // The same instants in Sydney (UTC+11 in October) are both on the 16th.
  const s = reportSeries({ period: 'week', now: NOW, timezone: SYD, rows: [
    { answeredAt: at(2026, 10, 15, 18, 29), marks: certified(1, 2, 1) },
    { answeredAt: at(2026, 10, 15, 18, 31), marks: certified(2, 2, 1) }
  ] });
  eq('the day boundary is the profile’s timezone, not the device’s', [s.current.questions, s.previous.questions], [2, 0]);
}
{
  const m = reportSeries({ period: 'month', now: NOW, timezone: IST, rows: [] });
  eq('month is 28 days in four weekly points', [m.days, m.series.length, m.current.from], [28, 4, '2026-09-25']);
  const t = reportSeries({ period: 'term', now: NOW, timezone: IST, rows: [] });
  eq('term is a named rolling 13-week window', [t.window, t.days, t.series.length], ['rolling-13-weeks', 91, 13]);
  let threw = null; try { reportSeries({ period: 'year', now: NOW, timezone: IST }); } catch (e) { threw = e.status; }
  eq('an unknown period is refused', threw, 400);
}

// ── marks, split, repeats, floor, deltas ─────────────────────────────────────
{
  const today = at(2026, 10, 22, 4);
  const lastWeek = at(2026, 10, 12, 4);
  const cur = Array.from({ length: 10 }, (_, i) => ({ answeredAt: today, marks: certified(i % 2 ? 2 : 1, 2, i % 3 ? 1 : 0) }));
  const repeat = { answeredAt: today, repeatOf: 'x', marks: certified(2, 2, 1, { repeat: true }) };
  const repeatFlag = { answeredAt: today, marks: certified(2, 2, 1, { repeat: true }) };
  const uncertified = { answeredAt: today, marks: null };
  const unsplit = { answeredAt: today, marks: { earned: 2, possible: 3, repeat: false, markRows: null } };
  const game = { answeredAt: today, mode: 'rush', marks: certified(2, 2, 1) };
  const prev = Array.from({ length: 4 }, () => ({ answeredAt: lastWeek, marks: certified(1, 2, 0) }));
  const r = reportSeries({ period: 'week', now: NOW, timezone: IST,
    rows: [...cur, repeat, repeatFlag, uncertified, unsplit, game, ...prev],
    activeDates: ['2026-10-20', '2026-10-21', '2026-10-22', '2026-10-12', '2026-10-13'] });
  const c = r.current;
  const me = cur.reduce((s, x) => s + x.marks.markRows.rows.filter(y => y.kind === 'working').reduce((a, y) => a + y.earned, 0), 0);
  const ae = cur.reduce((s, x) => s + x.marks.markRows.rows.find(y => y.kind === 'answer').earned, 0);
  eq('repeats are counted only as repeats', [c.repeats, c.questions], [2, 12]);
  eq('game rounds are left out', c.questions + c.repeats, 14);
  eq('certified questions exclude the uncertified answer', c.certifiedQuestions, 11);
  eq('certified marks are the receipts’ sums', [c.marksEarned, c.marksPossible], [me + ae + 2, 33]);
  eq('method marks are the working rows', [c.methodMarksEarned, c.methodMarksPossible], [me, 20]);
  eq('accuracy marks are the answer rows', [c.accuracyMarksEarned, c.accuracyMarksPossible], [ae, 10]);
  eq('a receipt without step rows is unsplit', [c.unsplit, c.splitQuestions], [1, 10]);
  eq('at the floor a percentage is shown', c.methodPct, Math.round(1000 * me / 20) / 10);
  eq('below the floor it is null', r.previous.methodPct, null);
  eq('a delta against a hidden percentage is null', r.delta.methodPct, null);
  eq('the question delta is a plain difference', r.delta.questions, 12 - 4);
  eq('days practised count active days in the window', [c.daysPractised, r.previous.daysPractised], [3, 2]);
  eq('streak ends today; the previous window’s ends on its last day', [c.streak, r.previous.streak], [3, 0]);
  eq('the floor is the progress-truth one', REPORT_FLOORS.window, 10);
  eq('today’s chart point holds today’s split answers', r.series[6].splitQuestions, 10);
  ok('a chart point below its floor is null', r.series[0].methodPct === null);
}
{
  // Exactly one below the floor, then exactly at it.
  const mk = n => Array.from({ length: n }, () => ({ answeredAt: at(2026, 10, 22, 4), marks: certified(1, 1, 1) }));
  eq('floor − 1 answers: null', reportSeries({ period: 'week', now: NOW, timezone: IST, rows: mk(REPORT_FLOORS.window - 1) }).current.marksPct, null);
  eq('floor answers: shown', reportSeries({ period: 'week', now: NOW, timezone: IST, rows: mk(REPORT_FLOORS.window) }).current.marksPct, 100);
}

// ── needs another look ───────────────────────────────────────────────────────
{
  const rows = [
    { id: 'a', answered: true, correct: false, marks: null },                           // slip, never redone
    { id: 'b', answered: true, correct: false, marks: null },                           // slip, redone right
    { id: 'b2', answered: true, correct: true, retryOf: 'b', marks: null },
    { id: 'c', answered: true, correct: true, marks: { earned: 2, possible: 3 } },      // partial = slip
    { id: 'c2', answered: true, correct: false, retryOf: 'c', marks: null },            // redone wrong
    { id: 'd', answered: true, correct: false, marks: null },                           // redone via a chain
    { id: 'd2', answered: false, retryOf: 'd' },
    { id: 'd3', answered: true, correct: true, repeatOf: 'd2' },
    { id: 'e', answered: true, correct: true, marks: { earned: 3, possible: 3 } },      // clean
    { id: 'f', answered: true, correct: false, repeatOf: 'z', marks: { earned: 0, possible: 3, repeat: true } } // a repeat is no slip
  ];
  eq('needs another look: slips not correctly redone since', [...needsAnotherLookIds(rows)].sort(), ['a', 'c', 'c2']);
  ok('a repeat is never a slip', !isSlip(rows[9]));
}

// ── sorts ────────────────────────────────────────────────────────────────────
{
  const items = [
    { id: 1, answeredAt: 1, marksEarned: 3, marksPossible: 3 },
    { id: 2, answeredAt: 2 },
    { id: 3, answeredAt: 3, marksEarned: 0, marksPossible: 3 },
    { id: 4, answeredAt: 4, marksEarned: 0, marksPossible: 4, repeat: true }
  ];
  eq('sort oldest', [...items].sort(HISTORY_SORTS.oldest).map(x => x.id), [1, 2, 3, 4]);
  eq('sort newest', [...items].sort(HISTORY_SORTS.newest).map(x => x.id), [4, 3, 2, 1]);
  eq('sort marks: most lost first, repeats and uncertified last', [...items].sort(HISTORY_SORTS.marks).map(x => x.id), [3, 1, 4, 2]);
}

console.log(`report-series: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
