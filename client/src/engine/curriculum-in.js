// Production NCERT overlay.
// The original curriculum remains byte-for-byte in curriculum-in-base.js. This
// layer upgrades Class 8 Chapter 1 from its thin legacy coverage to the complete
// source-audited NCERT bank while preserving Pri Learning's three-dot-point India
// product contract.
import { IN_CURRICULUM, IN_CHAPTERS, IN_CHAPTER_BY_ID } from './curriculum-in-base.js';
import {
  NCERT_CLASS8_RATIONAL_DOTPOINTS,
  NCERT_CLASS8_RATIONAL_COVERS
} from './ncert/class8-rational-production.js';

const chapterId = 'c8-rational-numbers';
const curriculumChapter = IN_CURRICULUM
  .flatMap(group => group.chapters)
  .find(chapter => chapter.id === chapterId);
const lookupChapter = IN_CHAPTER_BY_ID[chapterId];
const flatChapter = IN_CHAPTERS.find(chapter => chapter.id === chapterId);

for (const chapter of new Set([curriculumChapter, lookupChapter, flatChapter].filter(Boolean))) {
  chapter.dotpoints = [...NCERT_CLASS8_RATIONAL_DOTPOINTS];
  chapter.covers = NCERT_CLASS8_RATIONAL_COVERS.map(c => ({
    gen: c.gen,
    dp: [...c.dp],
    diff: [...c.diff]
  }));
  chapter.native = true;
}

export * from './curriculum-in-base.js';
