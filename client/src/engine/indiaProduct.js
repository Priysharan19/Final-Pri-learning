// Pri Learning · production-facing India curriculum helpers
//
// curriculum-in.js owns the authored syllabus/coverage declarations. This file
// is the thin product contract used by profiles, the local API and the UI. It
// deliberately does not manufacture coverage: an India chapter/dot point is
// selectable only when curriculum-in.js names a real generator behind it.
import {
  IN_CURRICULUM,
  IN_TRACKS,
  IN_CHAPTER_BY_ID,
  OLYMPIAD_TOPICS,
  generatorsFor,
  coversForDotpoint
} from './curriculum-in.js';

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

export function indiaScope(rawTrack, grade) {
  const track = indiaTrack(rawTrack, grade);
  return track.scopeFor(grade).map(id => IN_CHAPTER_BY_ID[id]).filter(Boolean);
}

export function indiaGeneratorsForScope(rawTrack, grade) {
  return [...new Set(indiaScope(rawTrack, grade).flatMap(generatorsFor))];
}

export function indiaChapter(id) {
  return IN_CHAPTER_BY_ID[String(id || '')] || null;
}

export function indiaDotpointIndex(chapter, ref) {
  if (!chapter || ref === undefined || ref === null || ref === '') return null;
  const n = Number(ref);
  return Number.isInteger(n) && n >= 0 && n < chapter.dotpoints.length ? n : null;
}

/**
 * Resolve an India chapter request to a generator/difficulty that is explicitly
 * declared to cover it. The requested difficulty is snapped to the closest real
 * authored form, capped by the selected track. No NSW topic fallback occurs.
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
  let covers = ordinal == null ? (chapter.covers || []) : coversForDotpoint(chapter, ordinal);
  const ceiling = track.difficultyCeiling || 4;
  const choices = [];
  for (const cover of covers) {
    for (const d of cover.diff || []) {
      if (d >= 1 && d <= ceiling) choices.push({ generator: cover.gen, difficulty: d, dotpointIndex: ordinal });
    }
  }
  if (!choices.length) return null;
  const want = difficulty == null ? Math.min(2, ceiling) : Math.max(1, Math.min(ceiling, Number(difficulty) || 2));
  const gap = Math.min(...choices.map(c => Math.abs(c.difficulty - want)));
  const nearest = choices.filter(c => Math.abs(c.difficulty - want) === gap);
  return nearest[Math.min(nearest.length - 1, Math.floor(Math.max(0, Math.min(0.999999, Number(random()) || 0)) * nearest.length))];
}

/** Sections the Home generator can render without knowing India internals. */
export function indiaProductSections() {
  const years = IN_CURRICULUM.map(group => ({
    year: group.grade,
    key: `in-cbse-${group.grade}`,
    track: 'cbse',
    title: group.title,
    label: 'CBSE / NCERT',
    caption: group.caption,
    difficultyCeiling: IN_TRACKS.cbse.difficultyCeiling,
    chapters: group.chapters
  }));
  const streams = [];
  for (const year of [11, 12]) {
    for (const id of ['jee-main', 'jee-advanced']) {
      const t = IN_TRACKS[id];
      streams.push({
        year,
        key: `in-${id}-${year}`,
        track: id,
        title: t.name,
        label: t.name,
        caption: t.caption,
        difficultyCeiling: t.difficultyCeiling,
        chapters: t.scopeFor(year).map(chapterId => IN_CHAPTER_BY_ID[chapterId]).filter(Boolean)
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
    chapters: OLYMPIAD_TOPICS
  });
  return { years, streams };
}
