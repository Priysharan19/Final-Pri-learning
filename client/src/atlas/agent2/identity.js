// PRl ATLAS IDENTITY BOUNDARY — three types, no implicit coercion.
// A curriculum chapter, an atomic mathematical concept and an editorial
// grouping can overlap pedagogically but NEVER share identity by string alias.
import { IN_CHAPTER_BY_ID } from '../../engine/curriculum-in.js';
import { mapStrandOf } from '../../engine/prerequisites.js';

export const ATLAS_ENTITY_KINDS = Object.freeze([
  'curriculum-chapter', 'mathematical-concept', 'editorial-group'
]);
export function chapterSelection(chapterId) {
  const chapter = IN_CHAPTER_BY_ID[chapterId];
  if (!chapter) throw new RangeError('Unknown Pri curriculum chapter ID');
  return Object.freeze({
    kind: 'curriculum-chapter',
    id: chapterId,
    chapterId,
    conceptId: null,
    curriculum: 'pri-india',
    subject: 'mathematics',
    grade: chapter.grade,
    editorialGroup: Object.freeze({kind:'editorial-group',id:mapStrandOf(chapterId) || 'algebra'})
  });
}
export function assertChapterSelection(input) {
  if (!input || input.kind !== 'curriculum-chapter' ||
      input.id !== input.chapterId || input.conceptId !== null ||
      input.curriculum !== 'pri-india') throw new TypeError('Not a curriculum-chapter selection');
  const expected = chapterSelection(input.id);
  if (JSON.stringify(expected) !== JSON.stringify(input)) throw new TypeError('Curriculum chapter identity was substituted');
  return expected;
}
/**
 * Typed event; consumers route by chapterId and kind. The fixture key in
 * Agent 3 is a separate DEMO lookup, not a mathematical concept alias.
 */
export function chapterNavigationEvent(chapterId, source) {
  const selection = chapterSelection(chapterId);
  return Object.freeze({
    chapterId, conceptId: null, selection, source,
    synthetic: true
  });
}
