// Pri Learning — the curriculum identity every Priyabhata question is sealed with
// (audit P0 #38), the counterpart of nswQuestionIdentity() in nswBanks.js.
//
// A sealed identity says WHERE in the India curriculum a question sits, so a
// result, a report or an examiner can name the board, class, chapter and
// syllabus it belongs to instead of trusting a generator id. It is the
// curriculum's own claim (client/src/engine/curriculum-in.js, the chapter whose
// covers draw on the generator) — not a claim that the question covers the
// chapter's every outcome, not the board's wording, and not board approval.
//
//   · graded chapters (Classes 7–12) carry board CBSE and the NCERT chapter;
//   · Olympiad topics carry no class or board;
//   · previous-year banks (pyq-<track>-<chapter>, the reviewed JEE catalog) carry
//     the track and, when the id names one, the chapter they were drawn for.
//
// `syllabusVersion` is the syllabus year the product declares for the board
// course (INDIA_SYLLABUS_VERSION). A question the curriculum cannot place gets
// null, and editionBanks.js then refuses to issue it.
import { IN_CHAPTERS } from '../../client/src/engine/curriculum-in.js';
import { practicePapersAllowed } from './indiaBanks.js';
import { hasPyqGenerator } from '../../client/src/engine/pyq/pyqIndex.js';
import { hasJeePyqGenerator } from '../../client/src/engine/generators/jee-pyq-runtime.js';

/** The CBSE syllabus year the product's Indian course declares (the class-10 provenance uses the same string). */
export const INDIA_SYLLABUS_VERSION = 'CBSE-2026-27';
const TRACKS = Object.freeze(['jee-advanced', 'jee-main', 'olympiad', 'cbse']);

const CHAPTER_BY_ID = new Map(IN_CHAPTERS.map(c => [c.id, c]));
const COVERS_BY_GENERATOR = new Map();
for (const chapter of IN_CHAPTERS) for (const cover of chapter.covers) {
  if (!COVERS_BY_GENERATOR.has(cover.gen)) COVERS_BY_GENERATOR.set(cover.gen, []);
  COVERS_BY_GENERATOR.get(cover.gen).push({ chapter, cover });
}

const text = v => (typeof v === 'string' && v.trim() ? v.trim() : null);

function chapterRecord(chapter, extra = {}) {
  const graded = Number.isInteger(chapter.grade);
  return {
    jurisdiction: 'IN',
    authority: graded ? 'CBSE' : 'Olympiad',
    board: graded ? 'CBSE' : null,
    class: graded ? chapter.grade : null,
    syllabus: graded ? `cbse-mathematics-class-${chapter.grade}` : 'olympiad',
    syllabusVersion: graded ? INDIA_SYLLABUS_VERSION : null,
    source: graded && /^c\d+-/.test(chapter.id) ? 'NCERT' : null,
    chapterId: chapter.id,
    chapterName: text(chapter.name),
    strand: text(chapter.strand),
    ...extra
  };
}

/** The identity of an India question, or null when the curriculum cannot place it. */
export function indiaQuestionIdentity(q, generator = q?._generator ?? q?.subtopic) {
  if (!q || typeof q !== 'object' || typeof generator !== 'string') return null;
  const placed = COVERS_BY_GENERATOR.get(generator);
  if (placed?.length) {
    const difficulty = Number(q.difficulty);
    const hit = placed.find(p => p.cover.diff?.includes(difficulty)) || placed[0];
    const topics = (hit.cover.dp || []).map(i => text(hit.chapter.dotpoints?.[i])).filter(Boolean);
    return chapterRecord(hit.chapter, { generator, topics, kind: 'practice' });
  }
  if (hasPyqGenerator(generator) || hasJeePyqGenerator(generator)) {
    const tail = generator.replace(/^pyq-/, '');
    const track = TRACKS.find(t => tail === t || tail.startsWith(`${t}-`)) || null;
    const chapter = track ? CHAPTER_BY_ID.get(tail.slice(track.length + 1)) : null;
    if (chapter) return chapterRecord(chapter, { generator, topics: [], kind: 'previous-year', track });
    return { jurisdiction: 'IN', authority: 'previous-year bank', board: null, class: null, syllabus: null, syllabusVersion: null, source: null, chapterId: null, chapterName: null, strand: null, generator, topics: [], kind: 'previous-year', track };
  }
  // A suite that borrows an NSW-era bank as a vehicle (allowBanksOutsideIndiaForTests, refused in
  // production) gets a labelled identity, so the borrowed question is still issued in that suite.
  if (practicePapersAllowed()) return { jurisdiction: 'IN', authority: 'test-vehicle', board: null, class: null, syllabus: null, syllabusVersion: null, source: null, chapterId: null, chapterName: null, strand: null, generator, topics: [], kind: 'test-vehicle' };
  return null;
}
