// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the progress evidence reading, pinned against hand-worked
// records (engine/progressEvidence.js). Every expected band below was worked out
// from the fixture beside it. All records are SYNTHETIC.
// ─────────────────────────────────────────────────────────────────────────────
import { evidenceProgress, EVIDENCE_FLOORS, RETENTION_GAP_DAYS, BANDS } from '../src/engine/progressEvidence.js';

let pass = 0;
const failures = [];
const eq = (actual, expected, label) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) pass++;
  else failures.push(`${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };

const DAY = 86_400_000;
const T0 = Date.parse('2026-11-01T06:00:00Z');
let n = 0;
const at = (topic, correct, day, extra = {}) => ({ id: `a${++n}`, subtopic: topic, generator: 'g1', correct: correct ? 1 : 0, support: 'independent', createdAt: T0 + day * DAY + n * 1000, mode: 'practice', ...extra });
const NOW = T0 + 30 * DAY;
const topic = (r, id) => r.topics.find(t => t.id === id);

// ── Thin evidence says so, in every dimension ───────────────────────────────
{
  const r = evidenceProgress([at('a', true, 0), at('a', true, 0)], { now: NOW });
  const t = topic(r, 'a');
  eq([t.accuracy, t.independence, t.retention, t.transfer], ['thin', 'thin', 'thin', 'thin'], 'two answers: every dimension is "not enough evidence yet"');
  eq(r.overall.accuracy, 'thin', 'two answers: the overall picture is thin too');
  eq(r.overall.needed, EVIDENCE_FLOORS.overall - 2, 'and says how many more answers it needs');
}

// ── Accuracy bands: strong ≥ 4 of 5, building 3 of 5, early below half ───
{
  const mk = (id, right) => Array.from({ length: 5 }, (_, i) => at(id, i < right, i));
  const r = evidenceProgress([...mk('s', 5), ...mk('b', 3), ...mk('e', 1), ...mk('b2', 2)], { now: NOW });
  eq(['s', 'b', 'b2', 'e'].map(id => topic(r, id).accuracy), ['strong', 'building', 'early', 'early'], 'accuracy bands: 5/5 strong, 3/5 building, 2/5 and 1/5 early');
  eq(topic(evidenceProgress(Array.from({ length: 4 }, (_, i) => at('x', true, i)), { now: NOW }), 'x').accuracy, 'thin', 'four answers are below the accuracy floor of five');
}

// ── Independence: right answers with help are not independent ──────────────
{
  const own = Array.from({ length: 4 }, (_, i) => at('own', true, i));
  const helped = Array.from({ length: 4 }, (_, i) => at('helped', true, i, i < 3 ? { support: 'supported' } : {}));
  const hints = [at('hint', true, 0, { support: undefined, hintsUsed: 2 }), at('hint', true, 1, { support: undefined, tutorLevel: 1 }), at('hint', true, 2), at('hint', true, 3)];
  const r = evidenceProgress([...own, ...helped, ...hints], { now: NOW });
  eq(topic(r, 'own').independence, 'own', 'independence: 4 of 4 right answers unaided is "on your own"');
  eq(topic(r, 'helped').independence, 'helped', 'independence: 1 of 4 unaided is "mostly with help"');
  eq(topic(r, 'hint').independence, 'mixed', 'independence: a hint or tutor help on an older row (no support field) is supported: 2 of 4 is mixed');
  eq(topic(r, 'own').counts.independentRight, 4, 'counts carry the authorised detail');
}

// ── Retention: right again after a gap of days ─────────────────────────────
{
  const gap = RETENTION_GAP_DAYS;
  const holding = [at('h', true, 0), at('h', true, 1), at('h', true, 1 + gap), at('h', true, 1 + 2 * gap + 1), at('h', true, 1 + 3 * gap + 3)];
  const slipping = [at('s', true, 0), at('s', false, 0 + gap), at('s', false, 2 * gap + 1), at('s', true, 3 * gap + 2), at('s', true, 3 * gap + 2)];
  const sameDay = [at('d', true, 0), at('d', true, 0), at('d', true, 0), at('d', true, 0), at('d', true, 0)];
  const r = evidenceProgress([...holding, ...slipping, ...sameDay], { now: NOW });
  eq(topic(r, 'h').retention, 'holding', 'retention: right again after each gap is "holding"');
  eq(topic(r, 's').retention, 'slipping', 'retention: wrong after a gap is "slipping"');
  eq(topic(r, 'd').retention, 'thin', 'retention: five right answers in one sitting say nothing about holding');
  ok(topic(r, 'h').counts.delayed >= EVIDENCE_FLOORS.retention, 'retention counts the delayed answers');
  const aided = [at('x', true, 0), at('x', true, 3, { support: 'supported' }), at('x', true, 6, { support: 'supported' })];
  eq(topic(evidenceProgress(aided, { now: NOW }), 'x').retention, 'slipping', 'retention: a delayed right answer that needed help is not "kept"');
}

// One sitting after a break is one trial, not one per row.
{
  const retry = [at('r', true, 0), ...Array.from({ length: 6 }, (_, i) => at('r', false, 10 + i * 0.01))];
  const t = topic(evidenceProgress(retry, { now: NOW }), 'r');
  eq([t.counts.delayed, t.retention], [1, 'thin'], 'retention: six wrong answers in one later sitting are one delayed trial, below the floor');
  const twoBreaks = [at('q', true, 0), at('q', false, 10), at('q', false, 10.01), at('q', false, 20), at('q', false, 20.01)];
  const q = topic(evidenceProgress(twoBreaks, { now: NOW }), 'q');
  eq([q.counts.delayed, q.counts.delayedKept, q.retention], [2, 0, 'slipping'], 'retention: two separate breaks are two trials');
}

// ── Transfer: a different kind of question in the same topic ───────────────
{
  const carries = [at('c', true, 0), at('c', true, 1), at('c', true, 2, { generator: 'g2' }), at('c', true, 3, { generator: 'g3' }), at('c', true, 4, { generator: 'g2' })];
  const single = [at('s', true, 0), at('s', true, 1), at('s', false, 2, { generator: 'g2' }), at('s', false, 3, { generator: 'g3' }), at('s', true, 4, { generator: 'g2' })];
  const oneKind = Array.from({ length: 6 }, (_, i) => at('o', true, i));
  const r = evidenceProgress([...carries, ...single, ...oneKind], { now: NOW });
  eq(topic(r, 'c').transfer, 'carries', 'transfer: right on other kinds is "carries over"');
  eq(topic(r, 's').transfer, 'single', 'transfer: wrong on other kinds is "tied to one kind"');
  eq(topic(r, 'o').transfer, 'thin', 'transfer: one kind of question has no transfer evidence');
}

// ── Review priority: from the schedule, as words ───────────────────────────
{
  const rows = [
    ...[at('slip', true, 0), at('slip', true, 1), at('slip', false, 1 + RETENTION_GAP_DAYS), at('slip', false, 2 + 2 * RETENTION_GAP_DAYS), at('slip', true, 20)],
    ...Array.from({ length: 5 }, (_, i) => at('shaky', i === 0, 5)),
    ...Array.from({ length: 4 }, (_, i) => at('fine', true, i + 24))
  ];
  const r = evidenceProgress(rows, { now: NOW });
  eq(r.review.map(x => [x.id, x.reason]).slice(0, 2), [['slip', 'slipping'], ['shaky', 'shaky']], 'review: slipping first, then shaky, each with a reason in words');
  ok(r.review.every(x => typeof x.reason === 'string' && !('score' in x)), 'review: a reason, never a score');
  ok(r.review.length <= 3, 'review: at most three topics');
}

// ── No numbers a student could read as a mark ──────────────────────────────
{
  const rows = Array.from({ length: 12 }, (_, i) => at(i % 2 ? 'a' : 'b', i % 3 !== 0, i));
  const r = evidenceProgress(rows, { now: NOW });
  const keys = new Set();
  const walk = (v, p = '') => { if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { keys.add(k); walk(x, `${p}.${k}`); } };
  walk(r);
  ok(![...keys].some(k => /mastery|percent|predict|mark|score|rating/i.test(k) || /band$/i.test(k)), 'the reading has no mastery, percentage, prediction, mark, score or rating field');
  const bands = [...BANDS.accuracy, ...BANDS.independence, ...BANDS.retention, ...BANDS.transfer, 'thin'];
  ok(r.topics.every(t => [t.accuracy, t.independence, t.retention, t.transfer].every(b => bands.includes(b))), 'every dimension is one of the named bands');
}

// ── Not evidence: games, custom questions, repeats, malformed rows ─────────
{
  const rows = [at('g', true, 0, { mode: 'rush' }), at('g', true, 1, { mode: 'match' }), at('custom', true, 2, { subtopic: 'custom' }), at('g', true, 3, { repeat: true }), null, { subtopic: 'g' }, at('real', true, 4)];
  const r = evidenceProgress(rows, { now: NOW });
  eq(r.topics.map(t => t.id), ['real'], 'games, custom questions, repeats and malformed rows are not evidence');
}

// ── Deterministic, order-independent ───────────────────────────────────────
{
  const rows = Array.from({ length: 14 }, (_, i) => at(`t${i % 3}`, i % 4 !== 0, i, i % 5 === 0 ? { support: 'supported' } : {}));
  eq(evidenceProgress([...rows].reverse(), { now: NOW }), evidenceProgress(rows, { now: NOW }), 'the same record gives the same reading, whatever order it arrives in');
  eq(evidenceProgress([], { now: NOW }).topics, [], 'an empty record has no topics');
}

console.log(failures.length
  ? `PROGRESS EVIDENCE: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `PROGRESS EVIDENCE: PASS — ${pass}/${pass} checks — thin evidence says so, accuracy/independence/retention/transfer bands against hand-worked records, review reasons in words, no mark-like numbers. [SYNTHETIC]`);
process.exit(failures.length ? 1 : 0);
