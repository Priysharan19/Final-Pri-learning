// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the exam-readiness forecast, computed by the server
//
// GET /v1/forecast?track=cbse&grade=10&variant=standard
//
// The server's own copy of the device's estimate (engine/markPredictor.js),
// built only from THIS account's server-marked practice: the grader's
// `graded-attempt` events. Client-written events never count, so nothing a
// device publishes can move the estimate.
//
// What it answers, and what it refuses to:
//
//   · `forecast` — markPredictor over the paper's blueprint: an interval on the
//     marks the student has practised, never scaled to the untouched rest, and
//     no headline below the coverage floor. Same function as the device.
//   · `trend` — the same estimate as it stood at the end of each of the last
//     weeks, so the band's movement is visible. Each point uses only the
//     evidence that existed by then.
//   · `backtest` — for every finished, fully marked Pri mock of this paper,
//     the estimate as it stood the moment the mock started, beside the mock's
//     own engine mark. This is the check the wording waits on: until it has
//     proved itself on enough mocks, across performance bands, the product
//     says "estimate from your practice", never a predicted board score. This
//     module never decides that it has: `wording` is always 'estimate', and the
//     backtest is evidence for a human calibration review, by band, because
//     knowledge-tracing models are known to overpredict for low performers
//     (docs/research/LEARNER_STATE_RETENTION_CAUSALITY.md).
//
// Premium (`advanced-analytics`, server-checked). A free account gets the
// coverage only — how much of the paper it has practised — and no band.
//
// No accuracy, improvement or score claim is made anywhere here.
// ─────────────────────────────────────────────────────────────────────────────
import { asyncRouter } from './asyncRouter.js';
import { asStore } from './store.js';
import { rateLimit, requireRole, requireSession, requireVerifiedEmail } from './security.js';
import { serverEntitlementCapabilities } from './entitlements.js';
import { predictExamMark } from '../../client/src/engine/markPredictor.js';
import { START_RATING, updateRating } from '../../client/src/engine/adaptive.js';
import { indiaExamBlueprint } from '../../client/src/engine/indiaExams.js';

export const FORECAST_CAPABILITY = 'advanced-analytics';
export const TREND_WEEKS = 8;
/** The practice modes whose answers are practice evidence. A paper's own answers are not. */
const PRACTICE_MODES = new Set(['practice', 'review', 'task']);
const DAY = 86_400_000;
const WEEK = 7 * DAY;
const SCAN = 5000;
const TRACKS = new Set(['cbse', 'jee-main', 'jee-advanced']);

const parse = row => { try { return { id: row.id, at: Number(row.occurred_at), ...JSON.parse(row.payload_json) }; } catch { return null; } };

/** One server-marked practice answer as evidence, or null. Revealed answers and paper answers are not practice. */
export function practiceEvidence(a) {
  if (!a || typeof a.subtopic !== 'string' || !a.subtopic) return null;
  if (!PRACTICE_MODES.has(a.mode || 'practice') || a.revealed === true || typeof a.correct !== 'boolean') return null;
  if (!Number.isFinite(a.at)) return null;
  return { subtopic: a.subtopic, correct: a.correct, difficulty: [1, 2, 3, 4].includes(Number(a.difficulty)) ? Number(a.difficulty) : 2,
    hints: Math.max(0, Number(a.hintLevel) || 0), at: a.at };
}

/**
 * Per-chapter rating rows, replayed in time order with the device's own Elo
 * update, from the evidence that existed strictly before `before`.
 */
export function chapterRows(evidence, before = Infinity) {
  const rows = {};
  for (const e of [...evidence].sort((x, y) => x.at - y.at)) {
    if (e.at >= before) break;
    const row = rows[e.subtopic] || (rows[e.subtopic] = { attempts: 0, correct: 0, rating: START_RATING, last_at: 0 });
    row.rating = updateRating(row.rating, row.attempts, e.difficulty, e.correct, e.hints);
    row.attempts++;
    if (e.correct) row.correct++;
    row.last_at = Math.max(row.last_at, e.at);
  }
  return rows;
}

export function forecastAt(blueprint, evidence, at) {
  return predictExamMark(blueprint, chapterRows(evidence, at), { nowMs: at });
}

/** The estimate at the end of each of the last `weeks` weeks, oldest first. Only weeks with practice behind them. */
export function forecastTrend(blueprint, evidence, now, weeks = TREND_WEEKS) {
  const out = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const at = now - i * WEEK;
    const p = forecastAt(blueprint, evidence, at);
    if (!p || !p.attempts) continue;
    out.push({ weekEnding: at, coveredMarks: p.coveredMarks, coverage: p.coverage, show: p.show,
      expected: p.show ? p.expected : null, low: p.show ? p.low : null, high: p.show ? p.high : null });
  }
  return out;
}

const BANDS = [['below-40', 0, 40], ['40-70', 40, 70], ['70-plus', 70, Infinity]];
const bandOf = pct => BANDS.find(([, lo, hi]) => pct >= lo && pct < hi)[0];

/**
 * Past estimates against Pri mocks of the same paper. A mock is used only
 * when it is finished and fully marked (no handwriting still pending), and
 * only when an estimate could be shown before it started. The comparison is
 * on the practised marks' share, since that is all the estimate speaks to:
 * the estimate's percentage band against the mock's percentage.
 */
export function backtest(blueprint, evidence, mocks) {
  const rows = [];
  for (const m of mocks) {
    if (!m || m.indiaExam?.blueprintId !== blueprint.id || m.mock !== true || m.pendingHandwriting) continue;
    const total = Number(m.total), score = Number(m.score), startedAt = Number(m.createdAt);
    if (!(total > 0) || !Number.isFinite(score) || !Number.isFinite(startedAt)) continue;
    const p = forecastAt(blueprint, evidence, startedAt);
    if (!p?.show) continue;
    const mockPct = Math.round(1000 * score / total) / 10;
    const lowPct = Math.round(1000 * p.low / p.coveredMarks) / 10;
    const highPct = Math.round(1000 * p.high / p.coveredMarks) / 10;
    rows.push({ examId: m.examId || null, startedAt, estimatePct: p.percent, lowPct, highPct, coverage: p.coverage,
      mockPct, error: Math.round((p.percent - mockPct) * 10) / 10, inBand: mockPct >= lowPct && mockPct <= highPct, band: bandOf(mockPct) });
  }
  const summary = rows => rows.length ? {
    n: rows.length, inBand: rows.filter(r => r.inBand).length,
    meanError: Math.round(10 * rows.reduce((s, r) => s + r.error, 0) / rows.length) / 10
  } : { n: 0, inBand: 0, meanError: null };
  return {
    // Never promoted here: a human calibration review over many accounts,
    // by band, decides whether any stronger wording is earned.
    wording: 'estimate',
    mocks: rows.sort((a, b) => a.startedAt - b.startedAt),
    overall: summary(rows),
    byBand: Object.fromEntries(BANDS.map(([b]) => [b, summary(rows.filter(r => r.band === b))]))
  };
}

export function selectionOf(query = {}) {
  const track = String(query.track || 'cbse');
  const grade = Number(query.grade);
  const variant = query.variant === 'basic' ? 'basic' : 'standard';
  if (!TRACKS.has(track) || !Number.isInteger(grade)) return null;
  const blueprint = indiaExamBlueprint({ track, grade, variant });
  return blueprint?.units?.length ? blueprint : null;
}

export function createForecastRouter(rawDb) {
  const db = asStore(rawDb);
  const router = asyncRouter();
  router.use(requireSession(db), requireVerifiedEmail, requireRole('student'));

  router.get('/', rateLimit(db, 'forecast', { limit: 120, windowMs: 3600000 }), async (req, res) => {
    const accountId = req.platformSession.account_id;
    const now = Date.now();
    const blueprint = selectionOf(req.query);
    if (!blueprint) return res.status(400).json({ error: { code: 'FORECAST_PAPER_UNKNOWN', message: 'Choose a CBSE or JEE paper to estimate.' } });
    const rows = (await db.all(
      "SELECT id,occurred_at,payload_json FROM learning_events WHERE account_id=? AND device_id='server-grader' AND kind IN ('graded-attempt','exam-result') ORDER BY server_cursor DESC LIMIT ?",
      [accountId, SCAN])).map(parse).filter(Boolean);
    const evidence = rows.map(practiceEvidence).filter(Boolean);
    const now_ = forecastAt(blueprint, evidence, now);
    const paper = { id: blueprint.id, label: blueprint.label, totalMarks: now_.totalMarks };
    const snapshot = await db.get('SELECT plan,status,current_period_end,grace_until FROM entitlement_snapshots WHERE account_id=?', [accountId]);
    res.set('Cache-Control', 'no-store');
    if (!serverEntitlementCapabilities(snapshot, now).includes(FORECAST_CAPABILITY)) {
      // Free: how much of the paper is practised, and nothing that reads as a mark.
      return res.status(200).json({ premium: false, capability: FORECAST_CAPABILITY, wording: 'estimate', paper,
        coverage: now_.coverage, coveredMarks: now_.coveredMarks, unseenMarks: now_.unseenMarks });
    }
    const mocks = rows.filter(r => r.state === 'finished' && r.mock === true);
    return res.status(200).json({
      premium: true, wording: 'estimate', paper,
      forecast: { ...now_, units: now_.units.map(({ sd, ...u }) => u), priorities: now_.priorities.slice(0, 3).map(({ sd, ...u }) => u) },
      trend: forecastTrend(blueprint, evidence, now),
      backtest: backtest(blueprint, evidence, mocks)
    });
  });
  return router;
}
