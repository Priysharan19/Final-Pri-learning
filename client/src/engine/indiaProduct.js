// Pri Learning · production-facing India curriculum helpers
//
// curriculum-in.js owns syllabus/generator declarations. indiaProductionMeta.js
// owns provenance/review truth. Product surfaces consume both so "selectable"
// never silently becomes "source reviewed".
import {
  IN_CURRICULUM,
  IN_TRACKS,
  IN_CHAPTERS,
  IN_CHAPTER_BY_ID,
  OLYMPIAD_TOPICS,
  generatorsFor,
  coversForDotpoint
} from './curriculum-in.js';
import { attachIndiaProductionStatus, indiaProductionStatus } from './indiaProductionMeta.js';
import { hasJeePyqGenerator } from './generators/jee-pyq-runtime.js';
import { hasPyqGenerator, pyqCoverageOf, pyqGeneratorId } from './pyq/pyqCoverage.js';

export const INDIA_COURSE = 'in';
export const INDIA_TRACK_IDS = Object.freeze(Object.keys(IN_TRACKS));

// ── Evidence keys ───────────────────────────────────────────────────────────
// An Indian student's evidence is keyed by the chapter they practised, never by
// the generator that happened to author the question: 36 of the generators the
// Indian spine reaches are NSW subtopic ids, and keying by them would merge a
// Class 7 student's integers with a Year 7 NSW student's. Dot points hang off
// the chapter row under `${chapterId}.${ordinal + 1}` — the same 1-based form
// the NSW registry uses, and one the backup allowlist (letters, digits, `.`,
// `_`, `-`) already accepts, so a restore keeps it.

/** The stored key of one Indian dot point on its chapter's rating row. */
export function indiaDotpointKey(chapterId, ordinal) {
  const n = Number(ordinal);
  if (!chapterId || !Number.isInteger(n) || n < 0) return null;
  return `${chapterId}.${n + 1}`;
}

/** The chapter id and ordinal a stored dot-point key names, or null. */
export function parseIndiaDotpointKey(key) {
  const m = /^(.+)\.(\d+)$/.exec(String(key || ''));
  if (!m) return null;
  const chapter = IN_CHAPTER_BY_ID[m[1]];
  const ordinal = Number(m[2]) - 1;
  if (!chapter || ordinal < 0 || ordinal >= chapter.dotpoints.length) return null;
  return { chapterId: chapter.id, ordinal };
}

let chaptersByGenerator = null;

/** Every Indian chapter that draws on a generator id, in curriculum order. */
export function indiaChaptersForGenerator(generatorId) {
  if (!chaptersByGenerator) {
    chaptersByGenerator = new Map();
    for (const chapter of IN_CHAPTERS) {
      for (const gen of generatorsFor(chapter)) {
        if (!chaptersByGenerator.has(gen)) chaptersByGenerator.set(gen, []);
        chaptersByGenerator.get(gen).push(chapter);
      }
    }
  }
  return chaptersByGenerator.get(String(generatorId || '')) || [];
}

/**
 * The display identity of an evidence key on an Indian profile: a chapter id,
 * a chapter dot-point key, or — for rows written before evidence was keyed by
 * chapter — a generator id, which resolves through the chapter that uses it.
 * `grade` breaks the tie when a reused generator serves two classes.
 */
export function indiaNameOf(id, { grade = null } = {}) {
  const key = String(id || '');
  const direct = IN_CHAPTER_BY_ID[key];
  if (direct) {
    return { id: direct.id, name: direct.name, year: indiaChapterGrade(direct), strand: direct.strand, chapter: direct, dotpoint: null, dotpointText: null };
  }
  const dp = parseIndiaDotpointKey(key);
  if (dp) {
    const chapter = IN_CHAPTER_BY_ID[dp.chapterId];
    return { id: chapter.id, name: chapter.name, year: indiaChapterGrade(chapter), strand: chapter.strand, chapter, dotpoint: dp.ordinal, dotpointText: chapter.dotpoints[dp.ordinal] };
  }
  const users = indiaChaptersForGenerator(key);
  if (!users.length) return null;
  const chapter = users.find(c => grade != null && indiaChapterGrade(c) === Number(grade)) || users[0];
  return { id: chapter.id, name: chapter.name, year: indiaChapterGrade(chapter), strand: chapter.strand, chapter, dotpoint: null, dotpointText: null, legacyGenerator: key };
}

// ── Difficulty windows and class order ──────────────────────────────────────

/** The difficulty rungs a track serves: `{ floor, ceiling }`. */
export function indiaDifficultyWindow(rawTrack, grade = 12) {
  const track = indiaTrack(rawTrack, grade);
  const ceiling = Math.max(1, Math.min(4, track.difficultyCeiling || 4));
  const floor = Math.max(1, Math.min(ceiling, track.difficultyFloor || 1));
  return { floor, ceiling };
}

/** `d` clamped into the track's window. */
export function clampToIndiaWindow(d, rawTrack, grade = 12) {
  const { floor, ceiling } = indiaDifficultyWindow(rawTrack, grade);
  const n = Number(d);
  return Math.max(floor, Math.min(ceiling, Number.isFinite(n) ? Math.round(n) : floor));
}

// What "Class 11 mastery" means before a Class 11 JEE student is moved on to
// Class 12 chapters by smart practice: every Class 11 chapter met at least
// three times, and their attempt-weighted mastery at the 'strong' band. Below
// that, Class 12 material is reachable by explicit choice only.
export const JEE_AHEAD_UNLOCK = Object.freeze({ minAttempts: 3, minMastery: 0.65 });

/**
 * Has a student earned smart practice on the year ahead? `ownStates` are the
 * `{ attempts, mastery }` of every chapter in their own class.
 */
export function indiaAheadUnlocked(ownStates) {
  const rows = (ownStates || []).map(s => ({ attempts: Number(s?.attempts) || 0, mastery: Number(s?.mastery) || 0 }));
  if (!rows.length) return false;
  if (rows.some(s => s.attempts < JEE_AHEAD_UNLOCK.minAttempts)) return false;
  const weights = rows.reduce((n, s) => n + s.attempts, 0);
  const mean = rows.reduce((n, s) => n + s.mastery * s.attempts, 0) / Math.max(1, weights);
  return mean >= JEE_AHEAD_UNLOCK.minMastery;
}

/** Does any authored form of this chapter sit inside a difficulty window? */
export function indiaChapterInWindow(chapter, { floor = 1, ceiling = 4 } = {}) {
  return (chapter?.covers || []).some(c => (c.diff || []).some(d => d >= floor && d <= ceiling));
}

/**
 * The ordinals of a chapter's dot points that an authored form reaches inside
 * the track's window. Every chapter has at least one (the CI suite checks it);
 * a dot point that has none is left to explicit choice, where the reply says
 * the rung was not honoured, rather than handed to smart practice as a D1
 * warm-up on a JEE track.
 */
export function indiaDotpointsInWindow(chapter, rawTrack, grade = indiaChapterGrade(chapter) || 12) {
  const { floor, ceiling } = indiaDifficultyWindow(rawTrack, grade);
  return (chapter?.dotpoints || []).map((_, i) => i)
    .filter(i => (chapter.covers || []).some(c => c.dp.includes(i) && (c.diff || []).some(d => d >= floor && d <= ceiling)));
}

/**
 * The chapters smart practice draws on for a track and class, split into the
 * student's own class (`own`) and the year ahead (`ahead`). CBSE and olympiad
 * tracks have no year ahead; a Class 11 JEE student's `ahead` is Class 12.
 * Only chapters with an authored form inside the track's window are listed —
 * a chapter smart practice cannot serve at the track's depth is not a choice.
 */
export function indiaPracticeScope(rawTrack, grade) {
  const track = indiaTrack(rawTrack, grade);
  const window = indiaDifficultyWindow(track.id, grade);
  const ownGrades = new Set((track.ownGrades ? track.ownGrades(grade) : [grade]).map(Number));
  const chapters = indiaScope(track.id, grade).filter(c => indiaChapterInWindow(c, window));
  if (!ownGrades.size) return { track, own: chapters, ahead: [] };
  return {
    track,
    own: chapters.filter(c => ownGrades.has(Number(indiaChapterGrade(c)))),
    ahead: chapters.filter(c => !ownGrades.has(Number(indiaChapterGrade(c))))
  };
}

export function cleanIndiaTrack(raw, grade = 12) {
  const id = IN_TRACKS[raw] ? raw : 'cbse';
  if (grade < 11 && (id === 'jee-main' || id === 'jee-advanced')) return 'cbse';
  return id;
}

export function indiaTrack(raw, grade = 12) {
  return IN_TRACKS[cleanIndiaTrack(raw, grade)];
}

export function indiaCourseLabel(grade, rawTrack = 'cbse') {
  const track = indiaTrack(rawTrack, grade);
  if (track.id === 'cbse') return `Class ${grade} · CBSE / NCERT`;
  if (track.id === 'olympiad') return `Olympiad · PRMO → RMO → INMO`;
  return `Classes 11–12 · ${track.name}`;
}

export function indiaChapterGrade(chapter) {
  if (!chapter) return null;
  if (Number.isFinite(chapter.grade)) return chapter.grade;
  for (const group of IN_CURRICULUM) {
    if (group.chapters.some(item => item.id === chapter.id)) return group.grade;
  }
  return null;
}

export function indiaScope(rawTrack, grade, { productionMeta = false } = {}) {
  const track = indiaTrack(rawTrack, grade);
  const chapters = track.scopeFor(grade).map(id => IN_CHAPTER_BY_ID[id]).filter(Boolean);
  return productionMeta ? chapters.map(ch => attachIndiaProductionStatus(ch, grade)) : chapters;
}

export function indiaGeneratorsForScope(rawTrack, grade) {
  return [...new Set(indiaScope(rawTrack, grade).flatMap(generatorsFor))];
}

export function indiaChapter(id, { productionMeta = false } = {}) {
  const chapter = IN_CHAPTER_BY_ID[String(id || '')] || null;
  if (!productionMeta || !chapter) return chapter;
  return attachIndiaProductionStatus(chapter, indiaChapterGrade(chapter));
}

export function indiaDotpointIndex(chapter, ref) {
  if (!chapter || ref === undefined || ref === null || ref === '') return null;
  const n = Number(ref);
  return Number.isInteger(n) && n >= 0 && n < chapter.dotpoints.length ? n : null;
}

/** One of `pool`, chosen by `random`, without ever running off the end. */
function drawFrom(pool, random) {
  const unit = Math.max(0, Math.min(0.999999, Number(random()) || 0));
  return pool[Math.min(pool.length - 1, Math.floor(unit * pool.length))];
}

/**
 * Resolve an India chapter request to a real generator/difficulty. Two separate
 * previous-year archives can answer at chapter level, and both are chapter-level
 * only: neither claims syllabus-dot-point precision, so a request for a specific
 * dot point stays on the authored generator that can prove it covers that dot
 * point.
 *
 *   · the reviewed JEE department catalog (generators/jee-pyq-runtime.js) is
 *     preferred outright for JEE tracks when it has the chapter, which is the
 *     behaviour that pipeline was built for;
 *   · the source-cited archive (engine/pyq) joins the ordinary pool of authored
 *     forms instead, so a chapter with three past-paper questions and four
 *     authored forms serves a mix rather than the same three questions forever.
 *
 * `pyqOnly` is the student-facing filter — "practise past papers only". It
 * returns null rather than an authored question when the archive has nothing for
 * the chapter, so the caller can say so instead of quietly serving practice.
 */
export function resolveIndiaTarget(chapter, {
  dotpoint = null,
  difficulty = null,
  track: rawTrack = 'cbse',
  grade = indiaChapterGrade(chapter) || 12,
  pyqOnly = false,
  random = Math.random
} = {}) {
  if (!chapter) return null;
  const track = indiaTrack(rawTrack, grade);
  const ordinal = indiaDotpointIndex(chapter, dotpoint);
  const { floor, ceiling } = indiaDifficultyWindow(track.id, grade);
  const want = difficulty == null ? Math.max(floor, Math.min(2, ceiling)) : Math.max(floor, Math.min(ceiling, Number(difficulty) || 2));

  if (ordinal == null && (track.id === 'jee-main' || track.id === 'jee-advanced')) {
    const pyqGenerator = `${track.id}-${chapter.id}`;
    if (hasJeePyqGenerator(pyqGenerator)) {
      return { generator: pyqGenerator, difficulty: want, dotpointIndex: null, pyq: true, pyqArchive: 'jee-question-department', windowed: true };
    }
  }

  const archiveId = pyqGeneratorId(track.id, chapter.id);
  const archiveCells = ordinal == null && hasPyqGenerator(archiveId)
    ? pyqCoverageOf(archiveId).difficulties.map(d => ({
      generator: archiveId, difficulty: d, dotpointIndex: null,
      pyq: true, pyqArchive: 'source-cited-archive', windowed: d >= floor && d <= ceiling
    }))
    : [];

  if (pyqOnly) {
    if (!archiveCells.length) return null;
    const gap = Math.min(...archiveCells.map(c => Math.abs(c.difficulty - want)));
    return drawFrom(archiveCells.filter(c => Math.abs(c.difficulty - want) === gap), random);
  }

  const covers = ordinal == null ? (chapter.covers || []) : coversForDotpoint(chapter, ordinal);
  const choices = [];
  const below = [];
  for (const cell of archiveCells) (cell.windowed ? choices : below).push(cell);
  for (const cover of covers) {
    for (const d of cover.diff || []) {
      if (d >= floor && d <= ceiling) choices.push({ generator: cover.gen, difficulty: d, dotpointIndex: ordinal, pyq: false, pyqArchive: null, windowed: true });
      else if (d >= 1 && d < floor) below.push({ generator: cover.gen, difficulty: d, dotpointIndex: ordinal, pyq: false, pyqArchive: null, windowed: false });
    }
  }
  // Every chapter has an authored form inside its track's window, but a single
  // dot point may not: a student who explicitly asks for one is served the
  // nearest form below the floor rather than refused, and the reply says so
  // (`windowed: false`) instead of pretending the rung was honoured.
  const pool = choices.length ? choices : below;
  if (!pool.length) return null;
  const gap = Math.min(...pool.map(c => Math.abs(c.difficulty - want)));
  return drawFrom(pool.filter(c => Math.abs(c.difficulty - want) === gap), random);
}

function productionSummary(chapters, grade) {
  const reviewedChapters = chapters.filter(ch => indiaProductionStatus(ch, grade).sourceReviewed).length;
  const totalChapters = chapters.length;
  return Object.freeze({
    reviewedChapters,
    totalChapters,
    reviewState: totalChapters > 0 && reviewedChapters === totalChapters
      ? 'source-reviewed'
      : reviewedChapters > 0 ? 'mixed-review' : 'source-review-pending'
  });
}

function cbseProductLabel(production) {
  return production.reviewState === 'source-reviewed'
    ? 'CBSE / NCERT · source-reviewed'
    : 'CBSE / NCERT · source review in progress';
}

/** Product sections with explicit provenance/review state on every chapter. */
export function indiaProductSections() {
  const years = IN_CURRICULUM.map(group => {
    const production = productionSummary(group.chapters, group.grade);
    return {
      year: group.grade,
      key: `in-cbse-${group.grade}`,
      track: 'cbse',
      title: group.title,
      // A class with C/D mappings must not look identical to an audited A/B class
      // in the track picker. The chapter bank remains usable, but the product
      // surface discloses that source review is still underway.
      label: cbseProductLabel(production),
      caption: group.caption,
      difficultyFloor: IN_TRACKS.cbse.difficultyFloor || 1,
      difficultyCeiling: IN_TRACKS.cbse.difficultyCeiling,
      chapters: group.chapters.map(ch => attachIndiaProductionStatus(ch, group.grade)),
      production
    };
  });
  const streams = [];
  for (const year of [11, 12]) {
    for (const id of ['jee-main', 'jee-advanced']) {
      const t = IN_TRACKS[id];
      const chapters = t.scopeFor(year).map(chapterId => IN_CHAPTER_BY_ID[chapterId]).filter(Boolean);
      streams.push({
        year,
        key: `in-${id}-${year}`,
        track: id,
        title: t.name,
        label: t.name,
        caption: t.caption,
        difficultyFloor: t.difficultyFloor || 1,
        difficultyCeiling: t.difficultyCeiling,
        chapters: chapters.map(ch => attachIndiaProductionStatus(ch, year)),
        production: Object.freeze({
          reviewedChapters: chapters.filter(ch => indiaProductionStatus(ch, year).sourceReviewed).length,
          totalChapters: chapters.length
        })
      });
    }
  }
  streams.push({
    allYears: true,
    key: 'in-olympiad',
    track: 'olympiad',
    title: IN_TRACKS.olympiad.name,
    label: 'Olympiad',
    caption: IN_TRACKS.olympiad.caption,
    difficultyFloor: IN_TRACKS.olympiad.difficultyFloor || 1,
    difficultyCeiling: IN_TRACKS.olympiad.difficultyCeiling,
    chapters: OLYMPIAD_TOPICS.map(ch => attachIndiaProductionStatus(ch, null))
  });
  return { years, streams };
}
