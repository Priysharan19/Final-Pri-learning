// Production NCERT overlays.
// The original curriculum remains byte-for-byte in curriculum-in-base.js. This
// layer upgrades source-audited NCERT chapters while preserving Pri Learning's
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

function applyChapterOverlay(chapterId, dotpoints, covers) {
  const curriculumChapter = IN_CURRICULUM
    .flatMap(group => group.chapters)
    .find(chapter => chapter.id === chapterId);
  const lookupChapter = IN_CHAPTER_BY_ID[chapterId];
  const flatChapter = IN_CHAPTERS.find(chapter => chapter.id === chapterId);

  for (const chapter of new Set([curriculumChapter, lookupChapter, flatChapter].filter(Boolean))) {
    chapter.dotpoints = [...dotpoints];
    chapter.covers = covers.map(c => ({
      gen: c.gen,
      dp: [...c.dp],
      diff: [...c.diff]
    }));
    chapter.native = true;
  }
}

applyChapterOverlay('c8-rational-numbers', NCERT_CLASS8_RATIONAL_DOTPOINTS, NCERT_CLASS8_RATIONAL_COVERS);
applyChapterOverlay('c8-linear-equations', NCERT_CLASS8_LINEAR_DOTPOINTS, NCERT_CLASS8_LINEAR_COVERS);

for (const chapterId of NCERT_CLASS8_3_13_IDS) {
  applyChapterOverlay(
    chapterId,
    NCERT_CLASS8_3_13_DOTPOINTS_BY_ID[chapterId],
    NCERT_CLASS8_3_13_COVERS_BY_ID[chapterId]
  );
}

export * from './curriculum-in-base.js';
