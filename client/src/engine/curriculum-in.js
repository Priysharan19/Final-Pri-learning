// Production NCERT overlays.
// The original curriculum remains byte-for-byte in curriculum-in-base.js. This
// layer upgrades source-audited chapters while preserving Pri Learning's
// established India product contract.
import { IN_CURRICULUM, IN_CHAPTERS, IN_CHAPTER_BY_ID } from './curriculum-in-base.js';
import { NCERT_CLASS7_2026_27_CHAPTERS } from './ncert/class7-2026-27-production.js';
import { NCERT_CLASS7_PART2_2026_27_CHAPTERS } from './ncert/class7-part2-2026-27-production.js';
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
import { CBSE_CLASS10_2026_27_CHAPTERS } from './ncert/class10-2026-27-production.js';
import { INDIA_NATIVE_COVERS } from './curriculum-in-native-covers.js';

function replaceClass7() {
  const group = IN_CURRICULUM.find(g => g.grade === 7);
  if (!group) throw new Error('Class 7 curriculum group is missing');
  const oldIds = group.chapters.map(ch => ch.id);
  const source = [...NCERT_CLASS7_2026_27_CHAPTERS, ...NCERT_CLASS7_PART2_2026_27_CHAPTERS];
  const chapters = source.map(src => ({
    id: src.id,
    name: src.title,
    strand: src.strand,
    weight: src.weight,
    dotpoints: [...src.dotpoints],
    native: true,
    covers: src.covers.map(c => ({ gen:c.gen, dp:[...c.dp], diff:[...c.diff] }))
  }));

  const first = IN_CHAPTERS.findIndex(ch => ch.grade === 7);
  const count = IN_CHAPTERS.filter(ch => ch.grade === 7).length;
  if (first < 0 || !count) throw new Error('Class 7 flat curriculum is missing');

  for (const id of oldIds) delete IN_CHAPTER_BY_ID[id];
  group.caption = 'NCERT Ganita Prakash Grade 7 Parts I–II — current source-authored production coverage';
  group.chapters = chapters;

  const flat = chapters.map(ch => ({ ...ch, dotpoints:[...ch.dotpoints], covers:ch.covers.map(c=>({gen:c.gen,dp:[...c.dp],diff:[...c.diff]})), grade:7 }));
  IN_CHAPTERS.splice(first, count, ...flat);
  for (const ch of flat) IN_CHAPTER_BY_ID[ch.id] = ch;
}

replaceClass7();

function applyChapterOverlay(chapterId, dotpoints, covers, { native = true } = {}) {
  const curriculumChapter = IN_CURRICULUM.flatMap(group => group.chapters).find(chapter => chapter.id === chapterId);
  const lookupChapter = IN_CHAPTER_BY_ID[chapterId];
  const flatChapter = IN_CHAPTERS.find(chapter => chapter.id === chapterId);
  for (const chapter of new Set([curriculumChapter, lookupChapter, flatChapter].filter(Boolean))) {
    chapter.dotpoints = [...dotpoints];
    chapter.covers = covers.map(c => ({ gen:c.gen, dp:[...c.dp], diff:[...c.diff] }));
    chapter.native = native;
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

// Class X keeps the familiar fourteen NCERT chapter ids, but the 2026–27
// syllabus/textbook rationalisation changed several examinable outcomes. Overlay
// all fourteen atomically enough that chooser, generator coverage and provenance
// census agree. In particular, Euclid's division lemma, polynomial division,
// coordinate-triangle area, recasting solids and ogives no longer count as
// current Class X coverage merely because legacy generators still exist.
function overlayClass10() {
  const group = IN_CURRICULUM.find(g => g.grade === 10);
  if (!group) throw new Error('Class 10 curriculum group is missing');
  const live = new Set(group.chapters.map(ch => ch.id));
  const source = new Set(CBSE_CLASS10_2026_27_CHAPTERS.map(ch => ch.id));
  if (live.size !== source.size || [...live].some(id => !source.has(id))) {
    throw new Error('Class 10 source overlay does not match the live chapter spine');
  }
  for (const chapter of CBSE_CLASS10_2026_27_CHAPTERS) {
    applyChapterOverlay(chapter.id, chapter.dotpoints, chapter.covers, { native: false });
  }
  group.caption = 'CBSE/NCERT Class X Mathematics 2026–27 — current rationalised outcomes with source-reviewed production coverage';
}

overlayClass10();

// India-native question banks replace the borrowed NSW ones.
//
// Nineteen chapters reached at least one dot point through a generator written
// against the NSW syllabus. curriculum-in-native-covers.js says which generator
// now serves each of those dot points, and this pass installs it on every view
// of the chapter the app can reach — the chooser's grouped list, the flat list
// and the id lookup — so no surface can still be handing a Class 11 student an
// NSW Year 11 question.
//
// Only `covers` moves. The dot points stay exactly as declared, because they
// are the claim about what the chapter teaches and changing one is a curriculum
// decision rather than a generator decision; the `native` flag is left alone
// too, because the Class X overlay above sets it deliberately as a provenance
// statement and this pass has nothing to say about provenance. The rewrite is
// refused outright if
// it would leave a dot point with nothing behind it: a chapter that silently
// lost coverage here would show up as a student selecting a topic and getting
// nothing back, which is the failure this whole file exists to prevent. The
// Class X source contract in ncert/class10-2026-27-production.js is left as the
// record of what was reviewed against the syllabus and is deliberately not
// edited from here — it says which OUTCOMES were checked, and swapping the
// generator behind an outcome does not re-check the outcome.
function installNativeCovers() {
  for (const [chapterId, covers] of Object.entries(INDIA_NATIVE_COVERS)) {
    const views = new Set([
      IN_CURRICULUM.flatMap(group => group.chapters).find(chapter => chapter.id === chapterId),
      IN_CHAPTER_BY_ID[chapterId],
      IN_CHAPTERS.find(chapter => chapter.id === chapterId)
    ].filter(Boolean));
    if (!views.size) throw new Error(`${chapterId} is not a chapter of this curriculum`);
    for (const chapter of views) {
      const reached = new Set(covers.flatMap(entry => (entry.diff.length ? entry.dp : [])));
      const missing = chapter.dotpoints.map((_, i) => i).filter(i => !reached.has(i));
      if (missing.length) throw new Error(`${chapterId}: native covers leave dot point(s) ${missing.join(', ')} with no generator`);
      chapter.covers = covers.map(entry => ({ gen: entry.gen, dp: [...entry.dp], diff: [...entry.diff] }));
    }
  }
}

installNativeCovers();

export * from './curriculum-in-base.js';
