// Pri Learning · the Experience 3 layer of a chapter's notes (both editions).
//
// Experience 3 of the Learning Experience Standard asks every chapter for an objective,
// prerequisites, intuition, a formal statement, worked examples, misconceptions, an
// independent checkpoint and the next step into Practice, with the diagram beside the
// reasoning. Most of that is already in each chapter's notes. The missing parts are
// written as a LAYER, one file per course band, merged over the chapter when its band's
// chunk loads (so nothing reaches a student who never opens that band's notes):
//
//   { [chapterId]: {
//       objective:   string                 what the student can do at the end (one sentence, KaTeX in $…$)
//       intuition:   string                 the picture or reason behind the idea, before any formalism
//       check?:      [{ question, answer, verify }]   the independent checkpoint (engine-verified)
//       diagrams?:   [{ title, spec, note }] teaching diagrams from the kit, beside the ideas
//       mistakes?:   [{ wrong, right }]      extra misconceptions, appended
//       interactiveNone?: string            only when no interactive diagram genuinely helps: why
//   } }
//
// client/test/notes-e3-check.mjs validates every layer (chapter ids, KaTeX, the engine
// re-derives every checkpoint answer, every diagram spec is valid for its kind).
export const E3_FIELDS = Object.freeze(['objective', 'intuition', 'check', 'diagrams', 'mistakes', 'interactiveNone']);

/** Merge one band's layer over its chapters. A layer naming an unknown chapter is a bug, not a no-op. */
export function mergeE3(notes, layer, where = 'notes') {
  if (!layer || !Object.keys(layer).length) return notes;
  const out = { ...notes };
  for (const [id, add] of Object.entries(layer)) {
    if (!Object.hasOwn(out, id)) throw new Error(`${where}: Experience 3 layer names unknown chapter ${id}`);
    for (const k of Object.keys(add)) if (!E3_FIELDS.includes(k)) throw new Error(`${where}: ${id} has unknown layer field ${k}`);
    const n = out[id];
    out[id] = {
      ...n,
      ...(add.objective ? { objective: add.objective } : {}),
      ...(add.intuition ? { intuition: add.intuition } : {}),
      ...(add.interactiveNone ? { interactiveNone: add.interactiveNone } : {}),
      ...(add.check ? { check: [...(n.check || []), ...add.check] } : {}),
      ...(add.diagrams ? { diagrams: [...(n.diagrams || []), ...add.diagrams] } : {}),
      ...(add.mistakes ? { mistakes: [...(n.mistakes || []), ...add.mistakes] } : {})
    };
  }
  return out;
}
