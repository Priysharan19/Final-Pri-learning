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

// Load supplements beside the requested grade, never in another grade's chunk.
// Original authored notes are retained and immutable; each addition is checked
// by the same rigorous chapter-notes mathematical verification suite.
const EXPANSION_LOADERS = {
  7: () => import('./data/notes-expansion-class7.js'),
  8: () => import('./data/notes-expansion-class8.js'),
  9: () => import('./data/notes-expansion-class9.js'),
  10: () => import('./data/notes-expansion-class10.js'),
  11: () => import('./data/notes-expansion-class11.js'),
  12: () => import('./data/notes-expansion-class12.js')
};

function mergeStudySupplements(base, additions) {
  for (const chapterId of Object.keys(additions)) {
    if (!Object.hasOwn(base, chapterId)) throw new Error(`Unknown study supplement chapter: ${chapterId}`);
  }
  return Object.fromEntries(Object.entries(base).map(([chapterId, chapter]) => {
    const add = additions[chapterId];
    if (!add) return [chapterId, chapter];
    const fields = {};
    for (const field of ['concepts', 'points', 'mistakes', 'examples']) {
      if (!Array.isArray(chapter[field]) || !Array.isArray(add[field])) {
        throw new Error(`Invalid supplement ${chapterId}.${field}`);
      }
      fields[field] = [...chapter[field], ...add[field]];
    }
    return [chapterId, { ...chapter, ...fields }];
  }));
}

// Optional advanced study is separate from the CBSE core and the generated
// exam/question bank. These are worked lessons, not server-issued questions.
const CHALLENGE_LOADERS = {
  7: () => import('./data/notes-challenges-class7.js'),
  8: () => import('./data/notes-challenges-class8.js'),
  9: () => import('./data/notes-challenges-class9.js'),
  10: () => import('./data/notes-challenges-class10.js'),
  11: () => import('./data/notes-challenges-class11.js'),
  12: () => import('./data/notes-challenges-class12.js')
};

// Per-grade diagram-question chunks; diagram data does not ride in other grades.
const VISUAL_LOADERS = {
  7: () => import('./data/notes-visual-class7.js'),
  8: () => import('./data/notes-visual-class8.js'),
  9: () => import('./data/notes-visual-class9.js'),
  10: () => import('./data/notes-visual-class10.js'),
  11: () => import('./data/notes-visual-class11.js'),
  12: () => import('./data/notes-visual-class12.js')
};

function mergeOptionalComplexStudies(notes, extra) {
  for (const [id, section] of Object.entries(extra || {})) {
    if (!Object.hasOwn(notes,id) || !Array.isArray(section.examples) || !section.examples.every(x => x.question && Array.isArray(x.steps) && x.steps.length && x.answer && x.verify)) {
      throw new Error(`Invalid optional mathematics study section: ${id}`);
    }
    notes = { ...notes, [id]: { ...notes[id], examples: [...notes[id].examples, ...section.examples] } };
  }
  return notes;
}

export const NOTES_GRADES = Object.freeze(Object.keys(LOADERS).map(Number));

const cache = new Map();

/** The notes for one class, keyed by chapter id. Rejects if the chunk cannot be fetched. */
export function loadNotesForGrade(grade) {
  const g = Number(grade);
  if (!LOADERS[g]) return Promise.resolve({});
  if (!cache.has(g)) {
    cache.set(g, Promise.all([
      LOADERS[g](),
      EXPANSION_LOADERS[g](),
      g === 11 ? import('./data/notes-advanced-complex.js') : Promise.resolve({ default: {} }),
      CHALLENGE_LOADERS[g] ? CHALLENGE_LOADERS[g]() : Promise.resolve({ default: {} }),
      VISUAL_LOADERS[g]()
    ])
      .then(([original, supplement, optional, challenges, visuals]) => mergeOptionalComplexStudies(
        mergeOptionalComplexStudies(
          mergeOptionalComplexStudies(
            mergeStudySupplements(original.default || {}, supplement.default || {}), optional.default || {}
          ), challenges.default || {}
        ), visuals.default || {}
      ))
      .catch(err => { cache.delete(g); throw err; }));
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
