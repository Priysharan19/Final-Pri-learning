// Pri Learning · the syllabus dot point picker on the practice page
//
// The list is the one the home page reads: the `dotpoints` of the chapter row in
// GET /curriculum. The URL carries the dot point's position in that list
// (`?subtopic=y12-diff&dotpoint=2`), which is exactly what the home links send,
// so the picker adds no new request shape. Only dot points an issued question
// stands behind are offered (`generated`), because the others are answered with
// a topic question and a label that says otherwise would be false.
import { dotpointAvailable } from '../engine/curriculumAvailability.js';
import { entryIdOf } from '../engine/curriculum.js';

/** The chapter row for a subtopic id, from a GET /curriculum reply (years and streams). */
export function chapterRowOf(curriculum, subtopicId) {
  if (!curriculum || !subtopicId) return null;
  // A link or a saved state naming a `-forms` generator lands on the topic's one entry.
  subtopicId = entryIdOf(subtopicId);
  for (const section of [...(curriculum.years || []), ...(curriculum.streams || [])]) {
    const row = (section.subtopics || section.chapters || []).find(s => s.id === subtopicId);
    if (row) return row;
  }
  return null;
}

const textOf = dp => (typeof dp === 'string' ? dp : String(dp?.text || ''));

/** Every dot point of the chapter that really changes what is issued, in syllabus order. */
export function dotpointChoices(row) {
  const list = Array.isArray(row?.dotpoints) ? row.dotpoints : [];
  return list
    .map((dp, ordinal) => ({ ordinal, id: typeof dp === 'object' && dp?.id ? String(dp.id) : null, text: textOf(dp), available: dotpointAvailable(dp) }))
    .filter(c => c.available && c.text);
}

/** The dot point a `dotpoint` query value names: `{ choice }` when it can be issued, `{ missing }` when it cannot. */
export function readDotpointParam(row, value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  const list = Array.isArray(row?.dotpoints) ? row.dotpoints : [];
  if (!Number.isInteger(n) || n < 0 || n >= list.length) return { missing: true, ordinal: null };
  const choice = dotpointChoices(row).find(c => c.ordinal === n);
  return choice ? { choice } : { missing: true, ordinal: n };
}

/** The query string after choosing a dot point (null or '' for all), every other filter kept. */
export function withDotpoint(params, ordinal) {
  const next = new URLSearchParams(params);
  // The ordinal is a place in the topic's one list, so the link names the topic and not a `-forms` generator.
  if (next.get('subtopic')) next.set('subtopic', entryIdOf(next.get('subtopic')));
  if (ordinal == null || ordinal === '') next.delete('dotpoint'); else next.set('dotpoint', String(ordinal));
  return next;
}
