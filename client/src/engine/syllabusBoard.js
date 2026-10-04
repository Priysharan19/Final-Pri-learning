// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · syllabus board and practice priorities
//
// Two presentation models over evidence the app already holds, with nothing
// new computed about the student:
//
//   THE BOARD colours every dot point of the student's syllabus by its own
//   mastery — the per-dot-point rating GET /curriculum already decorates, which
//   the dot-point picker ranks on — not by its chapter's average. A chapter with
//   one secure idea and four untouched ones looks like that, rather than like a
//   chapter that is one-fifth known everywhere. A dot point with a single
//   answer behind it is drawn as "too few answers", never as a colour: one
//   right answer is one right answer, not mastery.
//
//   THE PRIORITIES are the topic queue's own ranking (adaptive.prioritiesAmong
//   via GET /stats: exam weight × gap to secure × time since practice ×
//   repeating slips), in its order, each joined to the mark predictor's unit
//   for the marks still at stake there and to the weakest dot point inside the
//   chapter, so "practise this" lands on the idea that needs it. The order is
//   never re-ranked here; a second ranking would be a second engine.
//
// Pure functions, no I/O, so the suite checks exactly what the page renders.
// ─────────────────────────────────────────────────────────────────────────────
import { masteryBand } from './adaptive.js';

/** Answers on one dot point before it is given a mastery colour. */
export const DOTPOINT_COLOUR_FLOOR = 3;

/** Every state a dot point can be drawn in, weakest evidence first. */
export const BOARD_STATES = Object.freeze(['unseen', 'thin', 'emerging', 'developing', 'strong', 'mastered']);
const BANDS = new Set(['emerging', 'developing', 'strong', 'mastered']);

const finite = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const clamp100 = v => Math.max(0, Math.min(100, Math.round(finite(v))));

/** The state one dot point is drawn in. */
export function dotpointState(dp) {
  const attempts = Math.max(0, finite(dp?.attempts));
  if (!attempts) return 'unseen';
  if (attempts < DOTPOINT_COLOUR_FLOOR) return 'thin';
  if (BANDS.has(dp?.band)) return dp.band;
  const band = masteryBand(clamp100(dp?.mastery) / 100);
  return BANDS.has(band) ? band : 'emerging';
}

function emptyCounts() {
  return Object.fromEntries(BOARD_STATES.map(s => [s, 0]));
}

function boardDotpoints(row) {
  const list = Array.isArray(row?.dotpoints) ? row.dotpoints : [];
  return list.map((dp, index) => {
    const obj = typeof dp === 'string' ? { text: dp } : (dp || {});
    const attempts = Math.max(0, finite(obj.attempts));
    return Object.freeze({
      index,
      key: String(obj.key ?? index),
      text: String(obj.text || ''),
      attempts,
      correct: Math.max(0, Math.min(attempts, finite(obj.correct))),
      mastery: attempts ? clamp100(obj.mastery) : 0,
      // A dot point no authored form reaches cannot be practised on its own;
      // the board still shows it, because it is still on the syllabus.
      practisable: obj.generated !== false,
      state: dotpointState({ ...obj, attempts })
    });
  });
}

/**
 * The board for one syllabus scope: the chapter rows GET /curriculum returns
 * for the student's class or track, grouped by strand in syllabus order.
 */
export function syllabusBoard(rows = []) {
  const strands = [];
  const byName = new Map();
  const counts = emptyCounts();
  for (const row of rows || []) {
    if (!row?.id) continue;
    const dotpoints = boardDotpoints(row);
    const own = emptyCounts();
    for (const dp of dotpoints) { own[dp.state]++; counts[dp.state]++; }
    const attempts = Math.max(0, finite(row.attempts));
    const chapter = Object.freeze({
      id: row.id,
      name: String(row.name || row.title || row.id),
      strand: row.strand || null,
      attempts,
      mastery: attempts ? clamp100(row.mastery) : 0,
      due: !!row.due,
      dotpoints: Object.freeze(dotpoints),
      counts: Object.freeze(own),
      seen: dotpoints.filter(dp => dp.attempts > 0).length
    });
    const strandName = row.strand || '';
    if (!byName.has(strandName)) {
      const strand = { name: strandName, chapters: [] };
      byName.set(strandName, strand);
      strands.push(strand);
    }
    byName.get(strandName).chapters.push(chapter);
  }
  const total = BOARD_STATES.reduce((n, s) => n + counts[s], 0);
  return Object.freeze({
    strands: Object.freeze(strands.map(s => Object.freeze({ name: s.name, chapters: Object.freeze(s.chapters) }))),
    counts: Object.freeze(counts),
    total,
    seen: total - counts.unseen,
    mastered: counts.mastered,
    chaptersDue: strands.reduce((n, s) => n + s.chapters.filter(c => c.due).length, 0)
  });
}

/**
 * The dot point inside a chapter to send the student to: the weakest one an
 * authored form can serve. An untouched dot point in a chapter the student has
 * started counts as weaker than "developing" and stronger than "emerging" — it
 * is a gap, but one with no evidence of a misunderstanding behind it.
 */
export function weakestDotpoint(dotpoints = []) {
  const UNSEEN_SCORE = 30;
  let best = null;
  for (const dp of dotpoints || []) {
    if (!dp?.practisable) continue;
    if (dp.state === 'mastered') continue;
    const score = dp.attempts ? dp.mastery : UNSEEN_SCORE;
    if (!best || score < best.score) best = { dp, score };
  }
  return best ? best.dp : null;
}

/** The reason tag a priority row leads with: the strongest single reason it is on the list. */
export function priorityTag(row, chapter) {
  if (row?.due || chapter?.due) return 'review-due';
  if (row?.misconception) return 'misconception';
  const attempts = chapter ? chapter.attempts : null;
  if (attempts === 0 || (attempts == null && /not attempted/.test(String(row?.reason || '')))) return 'new-ground';
  return 'weak-spot';
}

/**
 * The Priorities list: the topic queue's ranking, joined to the board and to
 * the mark predictor. `queue` is GET /stats `priorities`; `prediction` is
 * `examPrediction` (may be null — JEE tracks have no blueprint for every
 * class); `rows` are the scope's chapter rows from GET /curriculum.
 */
export function practisePriorities({ queue = [], prediction = null, rows = [], limit = 5 } = {}) {
  const board = syllabusBoard(rows);
  const chapterById = new Map(board.strands.flatMap(s => s.chapters).map(c => [c.id, c]));
  const unitByChapter = new Map();
  for (const unit of prediction?.units || []) {
    for (const id of unit.chapters || []) unitByChapter.set(id, unit);
  }
  const stakeByUnit = new Map((prediction?.priorities || []).map(u => [u.unitId, u.atStake]));

  return (queue || []).slice(0, Math.max(0, limit)).map((row, i) => {
    const id = row?.subtopic || row?.id;
    const chapter = chapterById.get(id) || null;
    const unit = unitByChapter.get(id) || null;
    const weakest = chapter ? weakestDotpoint(chapter.dotpoints) : null;
    return Object.freeze({
      rank: i + 1,
      id,
      name: chapter?.name || row?.name || id,
      strand: chapter?.strand || row?.strand || null,
      year: row?.year ?? null,
      tag: priorityTag(row, chapter),
      mastery: clamp100(row?.mastery),
      attempts: chapter ? chapter.attempts : null,
      misconception: row?.misconception || null,
      // The bare trap label, for a surface to wrap in its own language.
      misconceptionLabel: row?.misconceptionLabel || null,
      due: !!(row?.due || chapter?.due),
      unit: unit ? Object.freeze({
        id: unit.unitId,
        name: unit.name,
        marks: unit.marks,
        // Marks the unit is still leaving on the table, as the predictor states
        // them: the whole unit when untouched, its gap to full marks otherwise.
        atStake: stakeByUnit.has(unit.unitId) ? stakeByUnit.get(unit.unitId) : 0
      }) : null,
      dotpoint: weakest ? Object.freeze({ index: weakest.index, text: weakest.text, state: weakest.state }) : null,
      seen: chapter ? chapter.seen : null,
      dotpointTotal: chapter ? chapter.dotpoints.length : null
    });
  });
}
