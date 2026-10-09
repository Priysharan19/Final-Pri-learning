import { selectedStudyContext, studyHref } from '../lib/studyJourney.js';

// Open a chapter from the index, map, search or prerequisites without silently
// changing JEE → CBSE or D4 → default difficulty. A dotpoint belongs to one
// chapter, never to the next chapter with the same numeric dotpoint index.
export function chapterNotesLink(chapter, params) {
  if (!chapter?.id) return null;
  const selection = selectedStudyContext(chapter, params);
  const selectedChapter = params?.get?.('subtopic');
  const dotpoint = selectedChapter === chapter.id ? selection.dotpoint : null;
  return studyHref({ ...selection, dotpoint, view: 'notes' });
}

export function notesIndexReturnLink(chapter, params) {
  if (!chapter?.id) return '/notes';
  const selection = selectedStudyContext(chapter, params);
  const next = new URLSearchParams({ class: String(chapter.grade), track: selection.track });
  if (selection.difficulty != null) next.set('difficulty', String(selection.difficulty));
  if (selection.dotpoint != null) {
    next.set('subtopic', chapter.id);
    next.set('dotpoint', String(selection.dotpoint));
  }
  return '/notes?' + next;
}
