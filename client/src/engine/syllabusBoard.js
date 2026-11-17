// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the syllabus board, its priorities, and paper readiness
//
// Pure. Three readings over a student's own record, for both editions:
//
//   BOARD      one node per syllabus unit of the student's course — a NSW 2024
//              (or K–10 2022) outcome code for Prithagoras, a chapter learning
//              outcome (dot point) for Priyabhata — each in exactly one STATE,
//              read from the evidence model in engine/progressEvidence.js:
//                not-started   no answer that counts as evidence
//                seen          answered, never right yet
//                assisted      right only with help (hint, tutor, second try)
//                thin          right on its own, but below the evidence floor
//                              ("not enough evidence yet"), or on too few of
//                              the kinds of question Pri sets for it (BREADTH)
//                recheck       was right on its own, but has since slipped: most
//                              answers now wrong, or it did not hold after a gap
//                independent   right on its own at least the floor's times
//                retained      and still right on its own after a gap of days
//              A state is a word and a shape (progress/SyllabusBoard.jsx), never
//              a colour alone and never a percentage.
//
//   PRIORITIES each assessed area (a NSW focus area; a CBSE unit) ranked by
//              the marks of a paper that sit where the student has not yet
//              shown independent work: the area's share of the paper's marks ×
//              the share of its nodes without independent evidence, as a range
//              (low: nodes with no independent right answer; high: plus nodes
//              below the floor). It is a statement about the PAPER's design and
//              the student's EVIDENCE — never a predicted mark, band or rank.
//
//   READINESS  the raw results of the student's own timed papers, marked by the
//              server, with their conditions. Below two papers it refuses. It
//              never scales a result to an HSC or board mark.
//
// Product choices, not research thresholds: the floors are progressEvidence's;
// the question counts, the 3 minutes a question and the 5-point "level" trend
// band, and the BREADTH rule (at least half of an outcome's located dot points,
// rounded up — so an outcome with one or two needs one) are wording/estimation choices (docs/research/DELAYED_TRANSFER_
// MEASUREMENT_PROTOCOL.md §15–16: separate evidence, no fake precision; a
// missing delayed outcome is not a zero, so "independent" is not demoted for
// never having been re-checked).
// ─────────────────────────────────────────────────────────────────────────────
import { evidenceProgress, EVIDENCE_FLOORS } from './progressEvidence.js';
import { isLearningEvidence, isSupported } from './progressTruth.js';

export const NODE_STATES = Object.freeze(['not-started', 'seen', 'assisted', 'thin', 'recheck', 'independent', 'retained']);
export const ACTIONS = Object.freeze(['learn', 'consolidate', 'retain', 'extend']);
export const READINESS_MIN_PAPERS = 2;
/** How many recent papers readiness lists. */
export const READINESS_SHOWN = 3;
/** Minutes a practice question is estimated at (an estimate, said as "about"). */
export const MINUTES_PER_QUESTION = 3;
/** A change between first and last paper smaller than this share of the marks reads as "about level". */
const LEVEL_BAND = 0.05;

// ── Nodes ────────────────────────────────────────────────────────────────────

/**
 * The board's groups for an NSW course from the generated catalogue
 * (engine/nswBoardCatalogue.js). Node id = outcome code.
 */
export function nswBoardGroups(course) {
  if (!course) return [];
  return course.groups.map(g => ({
    id: g.id, name: g.name, year: g.year, stage: g.stage, contentGroups: g.contentGroups,
    nodes: g.outcomes.map(o => ({
      id: o.code, code: o.code, label: g.name, group: g.id,
      practise: o.practise ? { subtopic: o.practise[0], dotpoint: o.practise[1] } : null
    }))
  }));
}

/**
 * The board's groups for a Priyabhata track: one group per chapter, one node
 * per chapter dot point. Node id = `${chapterId}#${ordinal}`.
 * `chapters` are [{ id, name, strand, dotpoints: [text | { text, generated }] }].
 */
export function indiaBoardGroups(chapters) {
  return (chapters || []).map(ch => ({
    id: ch.id, name: ch.name, strand: ch.strand || null,
    nodes: (ch.dotpoints || []).map((dp, ordinal) => {
      const text = typeof dp === 'string' ? dp : dp?.text || '';
      const practisable = typeof dp === 'string' ? true : dp?.generated !== false;
      return {
        id: `${ch.id}#${ordinal}`, code: null, label: text, group: ch.id, ordinal,
        practise: practisable ? { subtopic: ch.id, dotpoint: ordinal } : null
      };
    })
  }));
}

/** Every node of a board, in order. */
export const nodesOf = groups => groups.flatMap(g => g.nodes);

/**
 * The node ids one stored attempt counts towards. `dotpoints` is what the
 * backend attached (Pri dot point ids for NSW, `${chapter}#${ordinal}` for
 * India); `located` maps a Pri dot point id to its outcome codes (NSW only).
 * An attempt with no dot point is credited to no node: the board never guesses
 * which outcome an answer was about.
 */
export function nodeIdsOf(attempt, { located = null } = {}) {
  const ids = Array.isArray(attempt?.dotpoints) ? attempt.dotpoints.filter(x => typeof x === 'string' && x) : [];
  if (!located) return [...new Set(ids)];
  return [...new Set(ids.flatMap(id => (Object.hasOwn(located, id) ? located[id] : [])))];
}

// ── States ───────────────────────────────────────────────────────────────────

/**
 * The state of one node from its evidence-model topic entry (or none).
 * `breadth` ({ shown, total }) is how many of the node's source dot points have
 * an unaided right answer, of how many it has: a node is "shown on your own"
 * only when at least half of them (rounded up) do — three answers on one of an
 * outcome's twelve kinds of question do not show the outcome.
 */
export function stateOf(topic, breadth = null) {
  if (!topic) return 'not-started';
  if (topic.right === 0) return 'seen';
  if (topic.independentRight === 0 || topic.independence === 'helped') return 'assisted';
  if (topic.independentRight < EVIDENCE_FLOORS.independence) return 'thin';
  // Later evidence outranks earlier: mostly wrong now, or not held after a gap.
  if (topic.accuracy === 'early' || topic.retention === 'slipping') return 'recheck';
  if (breadth && breadth.total > 0 && breadth.shown < Math.ceil(breadth.total / 2)) return 'thin';
  if (topic.retention === 'holding') return 'retained';
  return 'independent';
}

/** Node id → the source dot point ids that can evidence it (NSW: the crosswalk inverted). */
function sourcesOf(located) {
  const out = new Map();
  for (const [dp, codes] of Object.entries(located || {})) for (const code of codes) (out.get(code) || out.set(code, new Set()).get(code)).add(dp);
  return out;
}

/**
 * The board: every node with its state and the counts behind it, and every
 * group with its tally. `attempts` are stored attempt rows carrying `dotpoints`.
 */
export function syllabusBoard(groups, attempts = [], { located = null, now = Date.now() } = {}) {
  const known = new Set(nodesOf(groups).map(n => n.id));
  const rows = [];
  const sources = located ? sourcesOf(located) : null;
  const shownBy = new Map();   // node id → source dot points with an unaided right answer
  for (const a of Array.isArray(attempts) ? attempts : []) {
    // Judged on the attempt as stored, before it is keyed by node: a game, a
    // repeat or a custom question is not evidence wherever it would land.
    if (!isLearningEvidence(a)) continue;
    const own = (a.correct === true || a.correct === 1) && !isSupported(a);
    for (const id of nodeIdsOf(a, { located })) {
      if (!known.has(id)) continue;
      rows.push({ ...a, subtopic: id });
      if (own && sources) {
        const set = shownBy.get(id) || shownBy.set(id, new Set()).get(id);
        for (const dp of a.dotpoints) if (sources.get(id)?.has(dp)) set.add(dp);
      }
    }
  }
  const evidence = evidenceProgress(rows, { now });
  const byId = new Map(evidence.topics.map(t => [t.id, t]));
  const outGroups = groups.map(g => {
    const nodes = g.nodes.map(n => {
      const t = byId.get(n.id) || null;
      const breadth = sources ? { shown: shownBy.get(n.id)?.size || 0, total: sources.get(n.id)?.size || 0 } : null;
      return {
        ...n,
        state: stateOf(t, breadth),
        breadth,
        evidence: t ? {
          answered: t.answered, right: t.right, independentRight: t.independentRight,
          helpedRight: t.right - t.independentRight, lastAt: t.lastAt,
          accuracy: t.accuracy, retention: t.retention, delayed: t.counts.delayed, delayedKept: t.counts.delayedKept
        } : null
      };
    });
    return { ...g, nodes, tally: tallyOf(nodes) };
  });
  return { groups: outGroups, tally: tallyOf(outGroups.flatMap(g => g.nodes)) };
}

/**
 * A focus area's (or chapter's) state on the map: its weakest outcome's.
 * An area reads "shown on your own" only when every outcome in it is; an
 * area none of whose outcomes has evidence is "not started".
 */
export const STATE_RANK = Object.freeze(['not-started', 'seen', 'assisted', 'recheck', 'thin', 'independent', 'retained']);
export function groupState(nodes) {
  if (!nodes.length || nodes.every(n => n.state === 'not-started')) return 'not-started';
  return nodes.reduce((worst, n) => (STATE_RANK.indexOf(n.state) < STATE_RANK.indexOf(worst) ? n.state : worst), 'retained');
}

/** Node count per state, plus the total. */
export function tallyOf(nodes) {
  const t = Object.fromEntries(NODE_STATES.map(s => [s, 0]));
  for (const n of nodes) t[n.state]++;
  return { ...t, total: nodes.length };
}

// ── Priorities ───────────────────────────────────────────────────────────────

/**
 * NSW areas: one per focus area of the course, its marks the slot marks Pri's
 * HSC-style blueprint (engine/nswExams.js) puts on its outcomes. `blueprint`
 * null (Years 7–10) gives areas without marks. `weights` (optional) replaces
 * the blueprint's marks with { [outcomeCode]: marks } from elsewhere.
 */
export function nswAreas(board, blueprint = null, weights = null) {
  const marksByCode = new Map();
  if (weights) for (const [code, m] of Object.entries(weights)) marksByCode.set(code, Number(m) || 0);
  else if (blueprint) for (const s of blueprint.sections) for (const slot of s.slots) marksByCode.set(slot.outcome, (marksByCode.get(slot.outcome) || 0) + slot.marks);
  const paperMarks = weights ? [...marksByCode.values()].reduce((n, m) => n + m, 0) : blueprint ? blueprint.totalMarks : null;
  const areas = board.groups.map(g => ({
    id: g.id, name: g.name, nodeIds: g.nodes.map(n => n.id),
    marks: paperMarks == null ? null : g.nodes.reduce((n, node) => n + (marksByCode.get(node.id) || 0), 0),
    // Each outcome's own marks, so the stake counts the marks of exactly the outcomes not shown.
    nodeMarks: paperMarks == null ? null : Object.fromEntries(g.nodes.map(node => [node.id, marksByCode.get(node.id) || 0]))
  }));
  return { areas, paperMarks };
}

/**
 * India areas: one per unit of the CBSE blueprint (engine/indiaExams.js), its
 * marks the unit's published weightage, its nodes the dot points of its
 * chapters on the board. Without a blueprint (or units), one area per chapter
 * without marks.
 */
export function indiaAreas(board, blueprint = null) {
  const units = blueprint?.units || [];
  if (!units.length) return { areas: board.groups.map(g => ({ id: g.id, name: g.name, nodeIds: g.nodes.map(n => n.id), marks: null })), paperMarks: null };
  const byChapter = new Map(board.groups.map(g => [g.id, g]));
  const areas = units.map(u => ({
    id: u.id, name: u.name, marks: u.marks,
    nodeIds: u.chapters.flatMap(c => (byChapter.get(c)?.nodes || []).map(n => n.id))
  })).filter(a => a.nodeIds.length);
  return { areas, paperMarks: areas.length ? units.reduce((n, u) => n + u.marks, 0) : null };
}

/** Board course key → hsc-forecast's course name (PR #1003); others have no forecast. */
export const FORECAST_COURSE = Object.freeze({ advanced: 'advanced', 'extension-1': 'extension1' });

/**
 * NSW areas from hsc-forecast's ranges (client/src/engine/hsc/hscPriorities.js):
 * topicWeightRanges(course) → { code: { low, mid, high } } shares of the paper,
 * forecastMeta(course) → { paperMarks, disclaimer, … }. Each outcome carries its
 * own low–high marks (share × paper marks). Null when the module, the course or
 * the ranges are not there — a single expected share is never turned into a
 * point figure — and the caller then falls back to the labelled blueprint.
 */
export function forecastAreas(board, forecast, courseKey) {
  const course = FORECAST_COURSE[courseKey];
  if (!course || typeof forecast?.topicWeightRanges !== 'function' || typeof forecast?.forecastMeta !== 'function') return null;
  let ranges, meta;
  try { ranges = forecast.topicWeightRanges(course); meta = forecast.forecastMeta(course); } catch { return null; }
  const P = Number(meta?.paperMarks);
  if (!ranges || !Number.isFinite(P) || P <= 0) return null;
  const range = code => {
    const r = Object.hasOwn(ranges, code) ? ranges[code] : null;
    const lo = Number(r?.low), hi = Number(r?.high);
    return Number.isFinite(lo) && Number.isFinite(hi) && lo >= 0 && hi >= lo && hi <= 1 ? { low: lo * P, high: hi * P } : null;
  };
  const areas = board.groups.map(g => ({
    id: g.id, name: g.name, nodeIds: g.nodes.map(n => n.id), marks: null,
    nodeRanges: Object.fromEntries(g.nodes.map(n => [n.id, range(n.id)]).filter(([, r]) => r))
  }));
  if (!areas.some(a => Object.keys(a.nodeRanges).length)) return null;
  return { areas, paperMarks: P, source: 'forecast', disclaimer: String(meta.disclaimer || '') };
}

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const ACTION_RANK = { learn: 0, consolidate: 1, retain: 2, extend: 3 };
const PRACTISE_FIRST = {
  learn: ['not-started', 'seen', 'assisted', 'recheck', 'thin'],
  consolidate: ['recheck', 'assisted', 'thin', 'seen', 'not-started'],
  retain: ['independent'],
  extend: ['retained', 'independent']
};

/**
 * The ranked priorities. Deterministic: ties are broken by area id.
 * @returns {{ items: object[], stake: {low:number, high:number}|null, paperMarks: number|null }}
 */
export function boardPriorities(board, { areas, paperMarks = null }, { limit = 4, minutesPerQuestion = MINUTES_PER_QUESTION } = {}) {
  const nodeById = new Map(board.groups.flatMap(g => g.nodes).map(n => [n.id, n]));
  const items = areas.map(area => {
    const nodes = area.nodeIds.map(id => nodeById.get(id)).filter(Boolean);
    const t = tallyOf(nodes);
    const n = nodes.length;
    // Not shown on your own: surely (no unaided evidence, or slipped since) and
    // maybe (unaided, but too little or too narrow to say).
    const SURE = ['not-started', 'seen', 'assisted', 'recheck'];
    const sure = SURE.reduce((k, s) => k + t[s], 0);
    const maybe = sure + t.thin;
    let action;
    if (maybe === 0) action = t.independent > 0 ? 'retain' : 'extend';
    else if ((t['not-started'] + t.seen) * 2 >= n) action = 'learn';
    else action = 'consolidate';
    const questions = action === 'learn' ? clamp(2 * maybe, 4, 10)
      : action === 'consolidate' ? clamp(2 * maybe, 4, 8)
        : action === 'retain' ? clamp(t.independent, 3, 6) : 4;
    let stake = null;
    if (area.nodeRanges) {
      // hsc-forecast: each outcome's own low–high marks, rounded outwards.
      const sum = (states, k) => nodes.filter(x => states.includes(x.state)).reduce((acc, x) => acc + (area.nodeRanges[x.id]?.[k] || 0), 0);
      stake = { low: Math.floor(sum(SURE, 'low') + 1e-9), high: Math.ceil(sum([...SURE, 'thin'], 'high') - 1e-9) };
    } else if (area.marks != null && n) {
      if (area.nodeMarks) {
        // Exact: the marks on the outcomes in each set.
        const sum = states => nodes.filter(x => states.includes(x.state)).reduce((k, x) => k + (area.nodeMarks[x.id] || 0), 0);
        stake = { low: sum(SURE), high: sum([...SURE, 'thin']) };
      } else {
        // Only the area's marks are published (CBSE units): a share, rounded outwards.
        stake = { low: Math.floor(area.marks * sure / n), high: Math.ceil(area.marks * maybe / n) };
      }
    }
    const order = PRACTISE_FIRST[action];
    const target = [...nodes].filter(x => x.practise && order.includes(x.state))
      .sort((a, b) => order.indexOf(a.state) - order.indexOf(b.state))[0] || null;
    // Why, in plain words (progress/SyllabusBoard.jsx turns this into a sentence).
    const started = n - t['not-started'];
    const why = t.recheck > 0 ? { key: 'slipped', n: t.recheck }
      : action === 'learn' ? (started ? { key: 'learnSome', started, n } : { key: 'learnNone' })
        : action === 'consolidate' ? { key: 'consolidate', gap: maybe, n }
          : action === 'retain' ? { key: 'retain' } : { key: 'extend' };
    return {
      id: area.id, name: area.name, action, why, questions, minutes: questions * minutesPerQuestion,
      marks: area.marks, stake, gap: maybe, nodes: n, tally: t,
      practise: target ? { ...target.practise, node: target.id } : null
    };
  });
  items.sort((a, b) => (b.gap > 0) - (a.gap > 0)
    || (b.stake?.high ?? -1) - (a.stake?.high ?? -1)
    || (b.stake?.low ?? -1) - (a.stake?.low ?? -1)
    || b.gap - a.gap
    || ACTION_RANK[a.action] - ACTION_RANK[b.action]
    || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const withMarks = items.filter(i => i.stake);
  const stake = paperMarks != null && withMarks.length
    ? { low: withMarks.reduce((s, i) => s + i.stake.low, 0), high: withMarks.reduce((s, i) => s + i.stake.high, 0) }
    : null;
  return { items: items.filter(i => i.action !== 'extend' || items.every(x => x.action === 'extend')).slice(0, limit), stake, paperMarks };
}

// ── Readiness from real papers ───────────────────────────────────────────────

/**
 * One finished paper as readiness reads it, or null when it is not evidence:
 * only a TIMED paper the SERVER marked (markedBy 'server'), finished, with every
 * mark decided (not provisional, nothing pending), counts.
 * `exam` is { id, title, finishedAt, score, total, deadlineAt, markedBy, provisional, pending, full }.
 */
export function readinessPaper(exam, { course = null } = {}) {
  if (!exam || exam.markedBy !== 'server' || !Number.isFinite(Number(exam.finishedAt))) return null;
  // Timed papers only: an untimed paper is not exam conditions.
  if (exam.deadlineAt == null || !Number.isFinite(Number(exam.deadlineAt))) return null;
  // A paper set for another course (an Extension 1 paper on the Advanced board) is not this course's evidence.
  if (course && exam.course && exam.course !== course) return null;
  if (exam.provisional || exam.pending) return null;
  if (exam.score == null || exam.total == null) return null;
  const score = Number(exam.score), total = Number(exam.total);
  if (!Number.isFinite(score) || !Number.isFinite(total) || total <= 0 || score < 0 || score > total) return null;
  return {
    id: String(exam.id ?? ''), title: String(exam.title || ''), finishedAt: Number(exam.finishedAt),
    score, total, timed: true, full: exam.full === true,
    minutes: Number.isFinite(Number(exam.durationMin)) && exam.durationMin != null ? Number(exam.durationMin) : null,
    readingMin: Number.isFinite(Number(exam.readingMin)) && exam.readingMin != null ? Number(exam.readingMin) : null,
    // By section, only when the sections add up to the paper's own result.
    sections: sectionsAddUp(exam.sections, score, total) ? exam.sections.map(x => ({ id: String(x.id), label: String(x.label || ''), awarded: Number(x.awarded), marks: Number(x.marks) })) : null
  };
}

function sectionsAddUp(sections, score, total) {
  if (!Array.isArray(sections) || !sections.length) return false;
  const ok = sections.every(x => Number.isFinite(Number(x?.marks)) && Number.isFinite(Number(x?.awarded)) && Number(x.marks) > 0 && Number(x.awarded) >= 0 && Number(x.awarded) <= Number(x.marks));
  return ok && sections.reduce((n, x) => n + Number(x.marks), 0) === total && sections.reduce((n, x) => n + Number(x.awarded), 0) === score;
}

/**
 * Readiness: the last READINESS_SHOWN server-marked papers, oldest first, with
 * a trend in words and the spread of THESE papers' raw results. Fewer than
 * READINESS_MIN_PAPERS: refused, with how many more are needed.
 */
export function paperReadiness(exams = [], { course = null } = {}) {
  const papers = (Array.isArray(exams) ? exams : []).map(e => readinessPaper(e, { course })).filter(Boolean)
    .sort((a, b) => a.finishedAt - b.finishedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  if (papers.length < READINESS_MIN_PAPERS) {
    return { status: 'too-few', count: papers.length, needed: READINESS_MIN_PAPERS - papers.length };
  }
  const shown = papers.slice(-READINESS_SHOWN);
  const share = p => p.score / p.total;
  const first = shown[0], last = shown[shown.length - 1];
  // Rounded to a thousandth so 64/100 → 69/100 is exactly the 5-point edge, not 4.999…
  const diff = Math.round((share(last) - share(first)) * 1000) / 1000;
  const trend = Math.abs(diff) < LEVEL_BAND ? 'level' : diff > 0 ? 'up' : 'down';
  const byShare = [...shown].sort((a, b) => share(a) - share(b) || a.finishedAt - b.finishedAt);
  const sameConditions = shown.every(p => p.full === first.full && p.total === first.total);
  return {
    status: 'ready', count: papers.length, papers: shown, trend, sameConditions,
    spread: { low: byShare[0], high: byShare[byShare.length - 1] }
  };
}
