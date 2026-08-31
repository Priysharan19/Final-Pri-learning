// Production NCERT overlays.
// The original curriculum remains byte-for-byte in curriculum-in-base.js. This
// layer upgrades source-audited chapters while preserving Pri Learning's
// established three-dot-point India product contract.
import { IN_CURRICULUM, IN_CHAPTERS, IN_CHAPTER_BY_ID } from './curriculum-in-base.js';
import {
  NCERT_CLASS8_RATIONAL_DOTPOINTS,
  NCERT_CLASS8_RATIONAL_COVERS
} from './ncert/class8-rational-production.js';
import {
  NCERT_CLASS8_LINEAR_DOTPOINTS,
  NCERT_CLASS8_LINEAR_COVERS
} from './ncert/class8-linear-production.js';
import {
  NCERT_CLASS8_3_13_IDS,
  NCERT_CLASS8_3_13_DOTPOINTS_BY_ID,
  NCERT_CLASS8_3_13_COVERS_BY_ID
} from './ncert/class8-chapters-3-13-production.js';
import { NCERT_CLASS9_CHAPTERS } from './ncert/class9-chapters-production.js';

function applyChapterOverlay(chapterId, dotpoints, covers) {
  const curriculumChapter = IN_CURRICULUM.flatMap(group => group.chapters).find(chapter => chapter.id === chapterId);
  const lookupChapter = IN_CHAPTER_BY_ID[chapterId];
  const flatChapter = IN_CHAPTERS.find(chapter => chapter.id === chapterId);
  for (const chapter of new Set([curriculumChapter, lookupChapter, flatChapter].filter(Boolean))) {
    chapter.dotpoints = [...dotpoints];
    chapter.covers = covers.map(c => ({ gen:c.gen, dp:[...c.dp], diff:[...c.diff] }));
    chapter.native = true;
  }
}

applyChapterOverlay('c8-rational-numbers', NCERT_CLASS8_RATIONAL_DOTPOINTS, NCERT_CLASS8_RATIONAL_COVERS);
applyChapterOverlay('c8-linear-equations', NCERT_CLASS8_LINEAR_DOTPOINTS, NCERT_CLASS8_LINEAR_COVERS);
for (const chapterId of NCERT_CLASS8_3_13_IDS) {
  applyChapterOverlay(chapterId, NCERT_CLASS8_3_13_DOTPOINTS_BY_ID[chapterId], NCERT_CLASS8_3_13_COVERS_BY_ID[chapterId]);
}

// Ganita Manjari Grade 9 Part I is a new eight-chapter 2026–27 structure, not a
// one-to-one rename of the older NCERT spine in curriculum-in-base.js. Replace
// the whole Grade 9 group atomically so the chooser, flat lookup and track scope
// cannot disagree about which textbook the student is practising.
function replaceClass9() {
  const group = IN_CURRICULUM.find(g => g.grade === 9);
  if (!group) throw new Error('Class 9 curriculum group is missing');
  const oldIds = group.chapters.map(ch => ch.id);
  const chapters = NCERT_CLASS9_CHAPTERS.map(src => ({
    id: src.id,
    name: src.title,
    strand: src.strand,
    weight: src.weight,
    dotpoints: [...src.dotpoints],
    native: true,
    covers: src.covers.map(c => ({ gen:c.gen, dp:[...c.dp], diff:[...c.diff] }))
  }));

  const first = IN_CHAPTERS.findIndex(ch => ch.grade === 9);
  const count = IN_CHAPTERS.filter(ch => ch.grade === 9).length;
  if (first < 0 || !count) throw new Error('Class 9 flat curriculum is missing');

  for (const id of oldIds) delete IN_CHAPTER_BY_ID[id];
  group.caption = 'Ganita Manjari Grade 9 Part I — coordinates, linear polynomials, real numbers, identities, circles, mensuration, probability and progressions';
  group.chapters = chapters;

  const flat = chapters.map(ch => ({ ...ch, dotpoints:[...ch.dotpoints], covers:ch.covers.map(c=>({gen:c.gen,dp:[...c.dp],diff:[...c.diff]})), grade:9 }));
  IN_CHAPTERS.splice(first, count, ...flat);
  for (const ch of flat) IN_CHAPTER_BY_ID[ch.id] = ch;
}

replaceClass9();

export * from './curriculum-in-base.js';
