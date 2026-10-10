// Pri Learning · the authored cells an India exam paper may draw from
//
// One definition, read by the device when it composes a paper
// (local/indiaExamBackend.js) and by the server when it checks a paper spec
// before issuing it (server/platform/exams.js). A cell is one
// (generator, difficulty) pair. Two kinds exist for a track and class:
//   · authored cells — what each chapter in scope declares in `covers`;
//   · previous-year cells — the reviewed JEE department catalog for the JEE
//     tracks, and the source-cited archive (engine/pyq) for any track it
//     publishes.
// The server issues from nothing outside this set, so a spec cannot name a
// generator the student's own track and class do not own.
import { indiaScope, resolveIndiaTarget } from './indiaProduct.js';
import { pyqCellsFor } from './pyq/pyqCoverage.js';
import { chapterCells } from './indiaExamComposer.js';

/** Previous-year cells for every chapter in scope: Map(chapterId → cells). */
export function indiaPyqCells(track, chapters) {
  const cells = new Map();
  for (const chapter of chapters) {
    const list = [];
    if (track === 'jee-main' || track === 'jee-advanced') {
      for (const difficulty of [3, 4]) {
        const target = resolveIndiaTarget(chapter, { track, grade: 12, difficulty, random: () => 0 });
        if (target?.pyqArchive !== 'jee-question-department') continue;
        if (list.some(c => c.generator === target.generator && c.difficulty === target.difficulty)) continue;
        list.push({ generator: target.generator, difficulty: target.difficulty, pyq: true });
      }
    }
    // Every rung the source-cited archive actually publishes for this chapter.
    for (const cell of pyqCellsFor(track, chapter.id)) list.push(cell);
    if (list.length) cells.set(chapter.id, list);
  }
  return cells;
}

const cellKey = (generator, difficulty) => `${generator}|${Number(difficulty)}`;

/**
 * Everything a paper for this track and class may be issued from.
 * Returns { chapters, has(cell), isPyq(cell), generators } or null when the
 * selection has no scope.
 */
export function indiaIssuableCells(track, grade) {
  const chapters = indiaScope(track, grade);
  if (!chapters.length) return null;
  const authored = new Set();
  const pyq = new Set();
  const generators = new Set();
  for (const chapter of chapters) {
    for (const cover of chapter.covers || []) {
      generators.add(cover.gen);
      for (const d of cover.diff || []) authored.add(cellKey(cover.gen, d));
    }
  }
  for (const list of indiaPyqCells(track, chapters).values()) {
    for (const cell of list) { pyq.add(cellKey(cell.generator, cell.difficulty)); generators.add(cell.generator); }
  }
  return {
    chapters,
    generators: [...generators],
    has: cell => authored.has(cellKey(cell?.generator, cell?.difficulty)) || pyq.has(cellKey(cell?.generator, cell?.difficulty)),
    isPyq: cell => pyq.has(cellKey(cell?.generator, cell?.difficulty))
  };
}

/** Cells inside a difficulty window, or the nearest rungs to it when none are. */
export function narrowCells(cells, { min = 1, max = 4 } = {}) {
  if (!cells.length) return cells;
  const inside = cells.filter(c => c.difficulty >= min && c.difficulty <= max);
  if (inside.length) return inside;
  const gap = c => Math.min(Math.abs(c.difficulty - min), Math.abs(c.difficulty - max));
  const best = Math.min(...cells.map(gap));
  return cells.filter(c => gap(c) === best);
}

/**
 * The cells ONE chapter may supply inside one difficulty window — exactly what
 * the composer draws a slot from: the chapter's authored cells in the window
 * (nearest rung when it has none there), and its previous-year cells narrowed
 * the same way. `pyq` is indiaPyqCells() for the track.
 * Returns { authored: Set, any: Set } of `generator|difficulty` keys.
 */
export function chapterWindowCells(chapter, range, pyq) {
  const authored = new Set(chapterCells(chapter, range).map(c => cellKey(c.generator, c.difficulty)));
  const any = new Set(authored);
  for (const cell of narrowCells(pyq?.get(chapter.id) || [], range)) any.add(cellKey(cell.generator, cell.difficulty));
  return { authored, any };
}

export const cellKeyOf = cell => cellKey(cell?.generator, cell?.difficulty);
