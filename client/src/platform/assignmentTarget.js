// Assignment targets on the India syllabus — the one description of a target
// that the teacher's publish form, the student's inbox card and Practice share.
import { indiaProductSections, indiaChapter, indiaChapterGrade, indiaTrack } from '../engine/indiaProduct.js';

let sectionsCache = null;

/** Every pickable syllabus section: CBSE Classes 7–12, JEE Main/Advanced 11–12, olympiad. */
export function assignmentSections() {
  if (sectionsCache) return sectionsCache;
  const product = indiaProductSections();
  const rows = [];
  for (const y of product.years) {
    rows.push({ key: y.key, track: 'cbse', year: y.year, label: `Class ${y.year} · CBSE / NCERT`, difficultyCeiling: y.difficultyCeiling, chapters: y.chapters });
  }
  for (const s of product.streams) {
    rows.push({
      key: s.key, track: s.track, year: s.allYears ? null : s.year,
      label: s.allYears ? s.title : `Class ${s.year} · ${s.title}`,
      difficultyCeiling: s.difficultyCeiling, chapters: s.chapters
    });
  }
  sectionsCache = rows;
  return rows;
}

/** The section a student profile practises by default. */
export function defaultSectionKey(user) {
  const track = user?.indiaTrack || 'cbse';
  const year = Number(user?.year) || 10;
  if (track === 'olympiad') return 'in-olympiad';
  if (track === 'jee-main' || track === 'jee-advanced') return `in-${track}-${year >= 11 ? year : 11}`;
  return `in-cbse-${Math.min(12, Math.max(7, year))}`;
}

const TRACK_LABEL = { cbse: 'CBSE / NCERT', 'jee-main': 'JEE Main', 'jee-advanced': 'JEE Advanced', olympiad: 'Olympiad' };

/** "Class 10 · Quadratic Equations · dot point 2 · D2 · CBSE / NCERT" — or null for untargeted practice. */
export function describeAssignmentTarget(spec = {}) {
  if (!spec || typeof spec !== 'object') return null;
  const ids = Array.isArray(spec.subtopics) ? spec.subtopics.map(String) : spec.subtopic ? [String(spec.subtopic)] : [];
  const chapters = ids.map(id => indiaChapter(id)).filter(Boolean);
  const parts = [];
  if (chapters.length) {
    const grades = [...new Set(chapters.map(ch => indiaChapterGrade(ch)).filter(Boolean))];
    if (grades.length === 1) parts.push(`Class ${grades[0]}`);
    parts.push(chapters.map(ch => ch.name).join(', '));
    if (chapters.length === 1 && Number.isInteger(Number(spec.dotpoint)) && spec.dotpoint !== null && spec.dotpoint !== '') {
      const dp = chapters[0].dotpoints[Number(spec.dotpoint)];
      if (dp) parts.push(`dot point ${Number(spec.dotpoint) + 1}`);
    }
  } else if (spec.track) {
    parts.push('Any chapter');
  } else return null;
  const d = Number(spec.difficulty);
  if (Number.isFinite(d) && d >= 1 && d <= 4) parts.push(`D${d}`);
  if (spec.track && TRACK_LABEL[spec.track]) parts.push(TRACK_LABEL[spec.track]);
  return parts.join(' · ');
}

/** The dot-point text for a single-chapter target, when one was chosen. */
export function assignmentDotpointText(spec = {}) {
  const chapter = spec?.subtopic ? indiaChapter(String(spec.subtopic)) : null;
  if (!chapter) return null;
  const n = Number(spec.dotpoint);
  return Number.isInteger(n) && spec.dotpoint !== null && spec.dotpoint !== '' ? chapter.dotpoints[n] || null : null;
}

export function trackCeiling(track, grade = 12) {
  return indiaTrack(track, grade).difficultyCeiling || 4;
}
