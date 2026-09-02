// Pri Learning · production-facing India curriculum helpers
//
// curriculum-in.js owns syllabus/generator declarations. indiaProductionMeta.js
// owns provenance/review truth. Product surfaces consume both so "selectable"
// never silently becomes "source reviewed".
import {
  IN_CURRICULUM,
  IN_TRACKS,
  IN_CHAPTER_BY_ID,
  OLYMPIAD_TOPICS,
  generatorsFor,
  coversForDotpoint
} from './curriculum-in.js';
import { attachIndiaProductionStatus, indiaProductionStatus } from './indiaProductionMeta.js';
import { hasJeePyqGenerator } from './generators/jee-pyq-runtime.js';

export const INDIA_COURSE = 'in';
export const INDIA_TRACK_IDS = Object.freeze(Object.keys(IN_TRACKS));

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

/**
 * Resolve an India chapter request to a real generator/difficulty. Reviewed JEE
 * PYQs are preferred only for chapter-level JEE practice: the archive has source
 * chapter provenance but does not claim syllabus-dot-point precision. A request
 * for a specific dot point therefore stays on the authored generator that can
 * prove it covers that dot point. If no reviewed PYQ has been published for the
 * chapter yet, JEE practice falls back to the existing authored form.
 */
export function resolveIndiaTarget(chapter, {
  dotpoint = null,
  difficulty = null,
  track: rawTrack = 'cbse',
  grade = indiaChapterGrade(chapter) || 12,
  random = Math.random
} = {}) {
  if (!chapter) return null;
  const track = indiaTrack(rawTrack, grade);
  const ordinal = indiaDotpointIndex(chapter, dotpoint);
  const ceiling = track.difficultyCeiling || 4;
  const want = difficulty == null ? Math.min(2, ceiling) : Math.max(1, Math.min(ceiling, Number(difficulty) || 2));

  if (ordinal == null && (track.id === 'jee-main' || track.id === 'jee-advanced')) {
    const pyqGenerator = `${track.id}-${chapter.id}`;
    if (hasJeePyqGenerator(pyqGenerator)) {
      return { generator: pyqGenerator, difficulty: want, dotpointIndex: null, pyq: true };
    }
  }

  const covers = ordinal == null ? (chapter.covers || []) : coversForDotpoint(chapter, ordinal);
  const choices = [];
  for (const cover of covers) {
    for (const d of cover.diff || []) {
      if (d >= 1 && d <= ceiling) choices.push({ generator: cover.gen, difficulty: d, dotpointIndex: ordinal, pyq: false });
    }
  }
  if (!choices.length) return null;
  const gap = Math.min(...choices.map(c => Math.abs(c.difficulty - want)));
  const nearest = choices.filter(c => Math.abs(c.difficulty - want) === gap);
  return nearest[Math.min(nearest.length - 1, Math.floor(Math.max(0, Math.min(0.999999, Number(random()) || 0)) * nearest.length))];
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
    difficultyCeiling: IN_TRACKS.olympiad.difficultyCeiling,
    chapters: OLYMPIAD_TOPICS.map(ch => attachIndiaProductionStatus(ch, null))
  });
  return { years, streams };
}
