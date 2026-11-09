// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the server's exam-readiness forecast (server/platform/forecast.js)
//
//   1 · the forecast is the server's own estimate (readinessEstimate.js) over rows
//       replayed from the grader's own events; paper answers, revealed answers
//       and client-written events are not evidence;
//   2 · the trend only uses evidence that existed at each week's end;
//   3 · the backtest compares the estimate made before each finished, fully
//       marked Pri mock with that mock's own mark, by band, and never promotes
//       the wording past 'estimate';
//   4 · premium is the server's decision: a free account gets coverage only.
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import { backtest, chapterRows, forecastAt, forecastTrend, practiceEvidence, selectionOf } from '../platform/forecast.js';
import { estimateExamMarks } from '../platform/readinessEstimate.js';
import { updateRating, START_RATING } from '../../client/src/engine/adaptive.js';
import { checks, registerAccount, startApp, verifyEmail } from './support/app-harness.mjs';
import { requestedEngine } from './support/engine.mjs';
import { asStore } from '../platform/store.js';

const c = checks();
const DAY = 86_400_000;
const NOW = Date.parse('2026-11-10T06:00:00Z');
const CBSE10 = selectionOf({ track: 'cbse', grade: '10' });
const CH = ['c10-polynomials', 'c10-quadratic-equations', 'c10-arithmetic-progressions', 'c10-triangles', 'c10-circles', 'c10-trigonometry', 'c10-statistics', 'c10-probability'];

// Practice spread over five weeks across the chapters, mostly right.
const events = [];
for (let i = 0; i < 120; i++) events.push({ id: `a${i}`, at: NOW - 35 * DAY + i * 7 * 3600_000, subtopic: CH[i % CH.length], correct: i % 4 !== 0, difficulty: 2 + (i % 2), mode: 'practice' });
const evidence = events.map(practiceEvidence).filter(Boolean);

// ── 1 · Parity and evidence ──────────────────────────────────────────────────
c.ok(CBSE10 && CBSE10.units.length > 0, 'CBSE Class X Standard resolves to its blueprint');
c.eq(selectionOf({ track: 'hsc', grade: '12' }), null, 'an unknown track is refused');
c.eq(practiceEvidence({ subtopic: 'c10-circles', correct: true, mode: 'exam', at: NOW }), null, 'a paper answer is not practice evidence');
c.eq(practiceEvidence({ subtopic: 'c10-circles', correct: false, revealed: true, at: NOW }), null, 'a revealed answer is not evidence');
c.eq(practiceEvidence({ subtopic: 'c10-circles', at: NOW }), null, 'an attempt with no committed mark is not evidence');
{
  let r = START_RATING;
  r = updateRating(r, 0, 2, true, 0); r = updateRating(r, 1, 3, false, 0);
  const rows = chapterRows([{ subtopic: 'x', correct: false, difficulty: 3, hints: 0, at: 2 }, { subtopic: 'x', correct: true, difficulty: 2, hints: 0, at: 1 }]);
  c.deq(rows.x, { attempts: 2, correct: 1, rating: r, last_at: 2 }, 'rows are replayed in time order with the device\'s Elo update');
}
const server = forecastAt(CBSE10, evidence, NOW);
c.deq(server, estimateExamMarks(CBSE10, chapterRows(evidence, NOW), { nowMs: NOW }), 'the forecast is the server estimate over the replayed rows');
c.ok(server.show && server.low <= server.expected && server.expected <= server.high, 'with most of the paper practised it shows an interval around the estimate');
c.ok(server.unseenMarks > 0 && server.expected <= server.coveredMarks, 'untouched marks stay outside the estimate');

// ── 2 · Trend ────────────────────────────────────────────────────────────────
const trend = forecastTrend(CBSE10, evidence, NOW, 8);
c.ok(trend.length === 5 && trend.every((p, i) => i === 0 || p.weekEnding > trend[i - 1].weekEnding), 'one point per week with practice behind it, oldest first');
c.ok(trend.every((p, i) => i === 0 || p.coveredMarks >= trend[i - 1].coveredMarks), 'coverage never shrinks as weeks pass');
c.deq(trend.at(-1).expected, server.show ? server.expected : null, 'the last point is today\'s estimate');
c.ok(trend.filter(p => !p.show).every(p => p.expected === null && p.low === null), 'a week below the coverage floor carries no number');

// ── 3 · Backtest ─────────────────────────────────────────────────────────────
// Per-chapter server-marked tallies: two covered chapters (40 marks) and one
// the estimate never covered (Real Numbers), which must not be compared.
const tallies = (onCovered, onUncovered) => [
  { id: 'c10-polynomials', marks: 20, awarded: onCovered / 2 }, { id: 'c10-circles', marks: 20, awarded: onCovered / 2 },
  { id: 'c10-real-numbers', marks: 6, awarded: onUncovered }
];
const mock = (at, onCovered, extra = {}) => ({ state: 'finished', mock: true, examId: `m${at}`, createdAt: at, indiaExam: { blueprintId: CBSE10.id },
  chapters: tallies(onCovered, 6), ...extra });
const bt = backtest(CBSE10, evidence, [
  mock(NOW - 2 * DAY, 30), mock(NOW - DAY, 10, { chapters: tallies(10, 0) }),
  mock(NOW - 3 * DAY, 30, { pendingHandwriting: 2 }),
  mock(NOW - 4 * DAY, 30, { indiaExam: { blueprintId: 'other' } }),
  mock(NOW - 5 * DAY, 30, { chapters: null }),
  mock(NOW - 6 * DAY, 30, { chapters: [{ id: 'c10-real-numbers', marks: 6, awarded: 6 }] }),
  mock(NOW - 35 * DAY + 3600_000, 30)
]);
c.eq(bt.wording, 'estimate', 'the backtest never promotes the wording');
c.eq(bt.overall.n, 2, 'pending, other-paper, unheld, no-covered-chapter and too-early mocks are left out');
const early = forecastAt(CBSE10, evidence, NOW - 2 * DAY);
c.eq(bt.mocks[0].estimatePct, early.percent, 'each mock is compared with the estimate as it stood when the mock started');
c.deq([bt.mocks[0].mockPct, bt.mocks[1].mockPct, bt.mocks[1].band], [75, 25, 'below-40'], 'the mock is re-scored on the covered chapters only, and banded');
c.deq([bt.basis, bt.mocks[0].mockMarksCompared], ['covered-chapters', 40], 'an uncovered chapter\'s marks are not in the comparison');
c.eq(bt.mocks[1].inBand, false, 'a mock far below the band is recorded as outside it, not hidden');
c.eq(bt.byBand['below-40'].n + bt.byBand['40-70'].n + bt.byBand['70-plus'].n, 2, 'every compared mock falls in exactly one band');

// ── 4 · Over HTTP: premium is the server's decision ──────────────────────────
const h = await startApp({ engine: requestedEngine() });
const db = asStore(h.db);
try {
  const now = Date.now();
  let cursor = 1;
  async function student(email, premium) {
    const r = await registerAccount(h, { email });
    await verifyEmail(h, r.account.id);
    if (premium) await db.run("INSERT INTO entitlement_snapshots(account_id,plan,status,provider,current_period_end,updated_at) VALUES (?,'premium','active','web',?,?) ON CONFLICT(account_id) DO UPDATE SET plan='premium',status='active',current_period_end=excluded.current_period_end", [r.account.id, now + 30 * DAY, now]);
    let seq = 1;
    for (const e of events) {
      const at = now - (NOW - e.at);
      await db.run("INSERT INTO learning_events(server_cursor,id,account_id,device_id,device_seq,kind,entity_id,occurred_at,payload_json,created_at) VALUES (?,?,?,?,?,'graded-attempt',?,?,?,?)",
        [cursor++, `${email}-${e.id}`, r.account.id, 'server-grader', seq++, 'q', at, JSON.stringify(e), at]);
    }
    // A device-written event claiming a perfect record must not count.
    await db.run("INSERT INTO learning_events(server_cursor,id,account_id,device_id,device_seq,kind,entity_id,occurred_at,payload_json,created_at) VALUES (?,?,?,?,?,'graded-attempt',?,?,?,?)",
      [cursor++, `${email}-fake`, r.account.id, 'ipad-test', 1, 'q', now, JSON.stringify({ subtopic: 'c10-real-numbers', correct: true, mode: 'practice' }), now]);
    return r.jar;
  }
  const free = await student('free@example.test', false);
  const paid = await student('paid@example.test', true);
  const get = (jar, q = 'track=cbse&grade=10') => h.request(`/v1/forecast?${q}`, { jar });

  c.eq((await h.request('/v1/forecast?track=cbse&grade=10')).status, 401, 'no session, no forecast');
  c.eq((await get(paid, 'track=nope&grade=10')).data?.error?.code, 'FORECAST_PAPER_UNKNOWN', 'an unknown paper is refused');
  const f = (await get(free)).data;
  c.deq([f.premium, f.wording, 'forecast' in f, 'trend' in f, 'backtest' in f], [false, 'estimate', false, false, false], 'a free account gets coverage only: no band, trend or backtest');
  c.ok(f.coverage > 0 && f.coveredMarks > 0, 'and the coverage is real');
  const p = (await get(paid)).data;
  c.deq([p.premium, p.wording, p.forecast.show], [true, 'estimate', true], 'premium gets the estimate, worded as an estimate');
  c.ok(!p.forecast.units.some(u => u.unitId === 'number-systems' && u.covered), 'a device-written event is not evidence');
  c.ok(Array.isArray(p.trend) && p.trend.length > 0 && p.backtest.overall.n === 0, 'the trend is returned; with no mocks the backtest is empty, not invented');
  // A held mock: its exam-result event and the server's own marked record.
  const paidId = (await db.get("SELECT id FROM accounts WHERE email=?", ['paid@example.test'])).id;
  const mockAt = now - DAY;
  await db.run("INSERT INTO learning_events(server_cursor,id,account_id,device_id,device_seq,kind,entity_id,occurred_at,payload_json,created_at) VALUES (?,?,?,?,?,'exam-result',?,?,?,?)",
    [cursor++, 'exam-1', paidId, 'server-grader', 9999, 'exam-1', mockAt + 3600_000, JSON.stringify({ state: 'finished', examId: 'exam-1', mock: true, createdAt: mockAt, score: 46, total: 80, indiaExam: { blueprintId: CBSE10.id } }), mockAt]);
  await db.run("INSERT INTO idempotency_keys(account_id,scope,key,response_json,request_digest,created_at,expires_at) VALUES (?,?,?,?,?,?,?)",
    [paidId, 'exam-result', 'exam-1', JSON.stringify({ summary: { chapters: tallies(30, 6) } }), 'd', mockAt, now + 30 * DAY]);
  const withMock = (await get(paid)).data.backtest;
  c.deq([withMock.overall.n, withMock.mocks[0]?.mockPct, withMock.mocks[0]?.mockMarksCompared], [1, 75, 40], 'over HTTP the mock is re-scored from the server\'s own record, on covered chapters only');
  c.ok(p.forecast.priorities.length <= 3, 'at most three "what would move this most" chapters');
} finally {
  await h.close();
}

console.log(`READINESS FORECAST: PASS — ${c.count()}/${c.count()} checks`);
