// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · from a sitting to practice and to an unseen re-test
//
// The paid workflow of the Extension 1 papers (owner decision, 19 Nov 2026):
//   sit an original timed paper  ->  feedback on each part  ->  WHAT TO PRACTISE NEXT
//   ->  an UNSEEN RE-TEST of the same criteria.
//
// Everything here is a deterministic function of the sitting's stored result and
// the structured papers. No model, no score prediction. What it can honestly say:
//
//   · a part is "weak" when the engine marked its final answer and it was wrong,
//     or it was left blank. A part the engine cannot mark (a proof, an
//     explanation, a sketch) is the student's own to check, so it is NOT counted
//     weak here; the plan says how many such parts there were. (A later version
//     can ask the student to say how a self-check went.)
//   · the "criterion" a weak part belongs to is the SYLLABUS OUTCOME the author's
//     mapping grid gives it (ME1-11-02, ...), mapped to the practice subtopics
//     whose own crosswalk row carries that outcome (SUBTOPIC_OUTCOMES, checked
//     against client/src/engine/curriculum-nsw/crosswalk.js by paper-plan-check).
//   · the re-test takes parts of the SAME outcomes from papers the account has
//     never sat (never the same questions); where no unseen paper part can stand
//     alone, the outcome goes to a practice subtopic instead and the page says so.
//   · before and after are the engine-marked marks only, per outcome: "2 of 4;
//     then 4 of 4". No claim of learning gain, no predicted HSC mark, band or ATAR.
// ─────────────────────────────────────────────────────────────────────────────
import { leafParts } from './paperContent.js';

// Practice subtopic (client/src/engine/curriculum.js, Extension 1) -> the syllabus outcomes the guideline's mapping grid names.
export const SUBTOPIC_OUTCOMES = Object.freeze({
  'me11-functions': ['ME1-11-01'], 'me11-poly': ['ME1-11-02'], 'me11-trigid': ['ME1-11-03'], 'me12-trigeq': ['ME1-11-03'],
  'me11-comb': ['ME1-11-04'], 'me11-binomial': ['ME1-11-05'], 'me12-induction': ['ME1-12-01'], 'me12-vectors': ['ME1-12-02'],
  'me11-inversetrig': ['ME1-12-03'], 'me12-calc': ['ME1-12-04'], 'me11-rates': ['ME1-12-05'], 'me12-binomial': ['ME1-12-06']
});
export const QUESTIONS_PER_WEAK_TOPIC = 3;
export const RETEST_MAX_PARTS = 8;
export const RETEST_ID = 'ext1-retest';
/** The marks a re-test aims at: what the weak parts were worth, at least 4 and at most 20. */
export const RETEST_MIN_MARKS = 4;
export const RETEST_MAX_MARKS = 20;

/** The practice subtopics whose crosswalk outcome is this one, in catalogue order. */
export function subtopicsFor(outcome) {
  return Object.entries(SUBTOPIC_OUTCOMES).filter(([, outs]) => outs.includes(outcome)).map(([id]) => id);
}

const BLOCK_TEXT = blocks => (blocks || []).map(b => (b.k === 'list' ? b.items.join(' ') : b.t || '')).join(' ');
// A part that leans on an earlier part cannot stand alone in another paper.
const DEPENDS = /\b(hence|deduce|your (answer|result|expression|value)|the result (of|in) part|part \(|previous part|from part|using (the )?(result|part)|in (part )?\(?[ivx]+\)|above)\b|\([ivx]+\)/i;

/** Every part of a paper with what a plan or a re-test needs, in paper order. */
const INDEX_CACHE = new WeakMap();
export function partsIndex(doc) {
  if (!INDEX_CACHE.has(doc)) INDEX_CACHE.set(doc, buildIndex(doc));
  return INDEX_CACHE.get(doc);
}
function buildIndex(doc) {
  return leafParts(doc).map(({ part, question, section }) => {
    const ancestors = [];
    const find = (parts, trail) => {
      for (const p of parts) {
        if (p === part) return [...trail, p.prompt];
        if (p.parts) { const hit = find(p.parts, [...trail, p.prompt]); if (hit) return hit; }
      }
      return null;
    };
    const chain = find(question.parts, []) || [part.prompt];
    ancestors.push(...chain.slice(0, -1));
    const blocks = [question.stem, ...chain].flat();
    const hasFigure = blocks.some(b => b?.k === 'fig') || (part.options || []).some(o => (o.blocks || []).some(b => b?.k === 'fig')) || part.figureOptions === true;
    const own = BLOCK_TEXT(part.prompt);
    const standalone = !hasFigure && !DEPENDS.test(own) && ancestors.every(a => !DEPENDS.test(BLOCK_TEXT(a)) || section.id === 'II' && ancestors.length === 0);
    return { paperId: doc.id, paperNumber: doc.paperNumber, section: section.id, question: question.number, part, outcomes: part.classification?.outcomes || [],
      content: part.classification?.content || null, marks: part.marks, keyed: !!part.key, standalone };
  });
}

/** The index of every outcome over all papers: where a re-test can come from. */
export function outcomeIndex(docs) {
  const map = new Map();
  for (const doc of docs.values()) {
    for (const row of partsIndex(doc)) {
      for (const o of row.outcomes) {
        if (!map.has(o)) map.set(o, []);
        map.get(o).push(row);
      }
    }
  }
  return map;
}

/** "What to practise next": the weak outcomes of one result, biggest loss first. */
export function buildPlan(doc, result) {
  const rows = new Map(partsIndex(doc).map(r => [r.part.id, r]));
  const byOutcome = new Map();
  let selfChecked = 0;
  for (const [id, row] of rows) {
    const r = result.parts?.[id];
    if (!r) continue;
    if (!row.keyed) { selfChecked += 1; continue; }
    const weak = r.verdict === 'incorrect' || r.verdict === 'unanswered' || r.verdict === 'unreadable';
    for (const o of row.outcomes.length ? row.outcomes : ['untagged']) {
      const e = byOutcome.get(o) || { outcome: o, content: row.content, available: 0, awarded: 0, partIds: [] };
      e.available += r.autoMarks || 0; e.awarded += r.awarded || 0;
      if (weak) e.partIds.push(id);
      byOutcome.set(o, e);
    }
  }
  const items = [...byOutcome.values()].filter(e => e.partIds.length)
    .map(e => ({ ...e, lost: e.available - e.awarded, subtopics: subtopicsFor(e.outcome), questions: QUESTIONS_PER_WEAK_TOPIC }))
    .sort((a, b) => b.lost - a.lost || b.partIds.length - a.partIds.length || a.outcome.localeCompare(b.outcome));
  return { items, selfChecked, note: 'Built only from parts the engine marked. Parts you check yourself are not counted.' };
}

/**
 * The parts of an UNSEEN re-test. `sat` is the set of paper ids this account has ever sat; `weak` the plan's items.
 * Never a part of a paper in `sat`. Where no unseen part can stand alone for an outcome it is listed in `fallbacks` with its practice subtopic.
 */
export function buildRetest(docs, weak, sat) {
  const index = outcomeIndex(docs);
  const chosen = [];
  const fallbacks = [];
  let marks = 0;
  const used = new Set();
  const target = Math.min(RETEST_MAX_MARKS, Math.max(RETEST_MIN_MARKS, weak.reduce((a, w) => a + w.lost, 0) * 2));
  for (const w of weak) {
    const options = (index.get(w.outcome) || []).filter(r => !sat.has(r.paperId) && r.standalone && r.keyed && !used.has(`${r.paperId}:${r.part.id}`))
      .sort((a, b) => Math.abs(a.marks - 3) - Math.abs(b.marks - 3) || a.paperNumber - b.paperNumber || a.question - b.question);
    const pick = options[0];
    if (pick && chosen.length < RETEST_MAX_PARTS && marks < target) {
      used.add(`${pick.paperId}:${pick.part.id}`);
      chosen.push({ paperId: pick.paperId, partId: pick.part.id, outcome: w.outcome, marks: pick.marks });
      marks += pick.marks;
    } else {
      fallbacks.push({ outcome: w.outcome, content: w.content, subtopics: w.subtopics, reason: pick ? 'The re-test is full.' : 'No unseen paper part covers this on its own; practise the hardest questions in this topic instead.' });
    }
  }
  return { parts: chosen, fallbacks, marks };
}

/** The re-test as a paper (pri-paper-v1): one question per chosen part, built from the stored composition each time it is read. */
export function retestDoc(docs, composition) {
  const questions = [];
  const taken = [];
  composition.parts.forEach((c, i) => {
    const src = docs.get(c.paperId);
    const row = src && partsIndex(src).find(r => r.part.id === c.partId);
    if (!row) return;
    const chain = [];
    const find = (parts, trail) => { for (const p of parts) { if (p === row.part) return [...trail, p.prompt]; if (p.parts) { const hit = find(p.parts, [...trail, p.prompt]); if (hit) return hit; } } return null; };
    const sectionQs = src.sections.find(s => s.id === row.section).questions;
    const q = sectionQs.find(x => x.number === row.question);
    chain.push(...(find(q.parts, []) || [row.part.prompt]).slice(0, -1));
    const n = i + 1;
    const marks = row.part.marks;
    taken.push(marks);
    questions.push({ id: `q${n}`, number: n, marks, stem: [...q.stem, ...chain.flat()], figures: [],
      parts: [{ ...row.part, id: `q${n}`, label: '', figures: [] }] });
  });
  const total = taken.reduce((a, b) => a + b, 0);
  return {
    format: 'pri-paper-v1', id: RETEST_ID, paperNumber: 0, title: 'Re-test', course: 'nsw-ext1', edition: 'prithagoras', year: 2027, totalMarks: total,
    readingTime: '0 minutes', workingTime: `${Math.max(5, Math.ceil(total * 1.5))} minutes`, markingScheme: { status: 'draft', note: 'Parts of papers you have not sat.', digest: null },
    sections: [{ id: 'II', title: 'Re-test', marks: total, minutes: Math.max(5, Math.ceil(total * 1.5)), instructions: 'Parts of other papers, on the topics you lost marks in. Show relevant mathematical reasoning.', questions }],
    figures: []
  };
}

/** Before and after, per outcome, from the engine-marked marks only. */
export function compare(firstDoc, firstResult, retestComposition, retestResultDoc, retestResult) {
  const first = new Map(partsIndex(firstDoc).map(r => [r.part.id, r]));
  const per = new Map();
  const add = (o, side, avail, got) => {
    const e = per.get(o) || { outcome: o, before: { available: 0, awarded: 0 }, after: { available: 0, awarded: 0 } };
    e[side].available += avail; e[side].awarded += got; per.set(o, e);
  };
  for (const c of retestComposition.parts) {
    const r = retestResult.parts?.[`q${retestComposition.parts.indexOf(c) + 1}`];
    if (r) add(c.outcome, 'after', r.autoMarks || 0, r.awarded || 0);
  }
  for (const e of [...per.values()]) {
    for (const [id, row] of first) {
      const r = firstResult.parts?.[id];
      if (r && row.keyed && row.outcomes.includes(e.outcome)) { e.before.available += r.autoMarks || 0; e.before.awarded += r.awarded || 0; }
    }
  }
  void retestResultDoc;
  return [...per.values()].map(e => ({ ...e, words: `First sitting ${e.before.awarded} of ${e.before.available}; re-test ${e.after.awarded} of ${e.after.available}.` }));
}
