// Pri Learning · chapter notes — the loader
//
// The notes are original revision writing aligned to the NCERT chapter
// structure, one module per class under ./data. Each class is its own chunk,
// reached only through the import() below, so a student who never opens Notes
// downloads none of it and a Class 10 student opening Notes downloads Class 10.
//
// ── The shape of one chapter's notes ─────────────────────────────────────────
// {
//   summary:     string                      one plain-language paragraph
//   prereqs:     [chapterId]                 curriculum chapters this builds on
//   concepts:    [{ title, body }]           the ideas, in plain language
//   definitions: [{ term, meaning }]
//   formulas:    [{ label, tex, note? }]     tex is bare KaTeX source
//   points:      [{ front, back }]           important points; also the flashcards
//   mistakes:    [{ wrong, right, misconception? }]   id from engine/misconceptions.js
//   examples:    [{ question, steps:[string], answer, verify }]
// }
// Prose fields may hold $…$ inline maths. `verify` restates the example's data
// for the deterministic engine; client/test/notes-content-check.mjs re-derives
// every answer from it, so no worked answer ships on its author's say-so.
import { practiceHref } from '../lib/practiceLinks.js';

const LOADERS = {
  7: () => import('./data/notes-class7.js'),
  8: () => import('./data/notes-class8.js'),
  9: () => import('./data/notes-class9.js'),
  10: () => import('./data/notes-class10.js'),
  11: () => import('./data/notes-class11.js'),
  12: () => import('./data/notes-class12.js')
};

export const NOTES_GRADES = Object.freeze(Object.keys(LOADERS).map(Number));

const cache = new Map();

/** The notes for one class, keyed by chapter id. Rejects if the chunk cannot be fetched. */
export function loadNotesForGrade(grade) {
  const g = Number(grade);
  if (!LOADERS[g]) return Promise.resolve({});
  if (!cache.has(g)) {
    cache.set(g, LOADERS[g]().then(m => m.default || {}, err => { cache.delete(g); throw err; }));
  }
  return cache.get(g);
}

/** The grade a chapter id belongs to: c10-… → 10. */
export function gradeOfChapter(id) {
  const m = /^c(\d{1,2})-/.exec(String(id || ''));
  return m ? Number(m[1]) : null;
}

/** "Practise this" — the same link builder every other surface uses. */
export function notesPracticeHref(chapter) {
  return practiceHref({ subtopic: chapter?.id, track: 'cbse' });
}

/** Lower-cased searchable text for one chapter's notes. */
export function notesSearchText(chapter, notes) {
  if (!notes) return String(chapter?.name || '').toLowerCase();
  const parts = [chapter?.name, notes.summary];
  for (const c of notes.concepts || []) parts.push(c.title, c.body);
  for (const d of notes.definitions || []) parts.push(d.term, d.meaning);
  for (const f of notes.formulas || []) parts.push(f.label, f.note);
  for (const p of notes.points || []) parts.push(p.front, p.back);
  for (const m of notes.mistakes || []) parts.push(m.wrong, m.right);
  return parts.filter(Boolean).join(' \n ').toLowerCase();
}
