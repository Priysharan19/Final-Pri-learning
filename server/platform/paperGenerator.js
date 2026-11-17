// Pri Learning — the Paper Generator (one platform, two editions).
//
// A student picks a course (from their profile), topics, a length and a
// difficulty mix; the SERVER assembles a paper from the approved, issued banks
// of the edition it serves (editionBanks.js: India's covers for Priyabhata, the
// NSW crosswalk-mapped issued cells for Prithagoras) and from nothing else.
//
//   · DETERMINISTIC. The same request, seed and seen-set give the same paper:
//     every choice (topic, form, question seed) comes from one seeded RNG.
//   · EXACT MARKS. The plan is a composition of the requested total, so the
//     marks add up exactly; a paper that cannot reach the total is refused,
//     never padded, and the nearest valid length is offered.
//   · FRESH. Questions the account has recently seen are passed over. A seen
//     one is used only when a slot has nothing fresh left, and is counted.
//   · KEY-BLIND. This module returns drawn questions for the server to seal;
//     preview() and the public summary carry counts and names only.
//
// Marking is not decided here. A paper is sat through the existing exam router
// (kind 'generated'), marked by the same deterministic final-answer engine.
// Method marks stay off until certified (docs/release/...): the marks here are
// all-or-nothing per question, as on an NSW paper.
//
// Honesty: the paper is "Pri practice paper", never a CBSE, JEE or NESA paper.
import { makeRng } from '../../client/src/engine/qhelpers.js';
import { generateQuestion } from '../../client/src/engine/generators/index.js';
import { contentHashOf } from '../../client/src/engine/contentIdentity.js';
import { IN_CHAPTERS, generatorsFor } from '../../client/src/engine/curriculum-in.js';
import { scopeForYear, subtopicsForYear, PATHWAYS } from '../../client/src/engine/curriculum.js';

export const GENERATED_LABEL = 'Pri practice paper';
export const MINUTES_PER_MARK = 1.5;
export const PAPER_MARKS = Object.freeze([10, 20, 40]);
export const PAPER_MINUTES = Object.freeze([30, 60, 90]);
export const MIXES = Object.freeze(['foundation', 'standard', 'challenge', 'exam']);
export const MAX_TOPICS = 12;
const CANDIDATES = 12;

/** Minutes → the marks that fit them (30 → 20, 60 → 40, 90 → 60). */
export const marksForMinutes = minutes => Math.round(minutes / MINUTES_PER_MARK);
/** Marks → the minutes they take (24 → 36). */
export const minutesForMarks = marks => Math.round(marks * MINUTES_PER_MARK);

// The share of each difficulty (1–4) a mix draws. "exam" is the ladder the
// practice paper already uses (20 / 40 / 30 / 10 %).
const MIX_SHARE = Object.freeze({
  foundation: [0.5, 0.4, 0.1, 0],
  standard: [0.15, 0.4, 0.35, 0.1],
  challenge: [0, 0.15, 0.45, 0.4],
  exam: [0.2, 0.4, 0.3, 0.1]
});

/**
 * The topics an edition offers for a course, from its own curriculum model:
 * India — a grade's chapters, each with the generators that cover it and the
 * difficulties each covers; NSW — the year's (and pathway's) subtopics.
 * Each topic: { id, name, gens: [{ gen, diffs }] }.
 */
export function generatorTopics({ curriculum, year, pathway = null, issues }) {
  if (curriculum === 'in') {
    return IN_CHAPTERS.filter(c => c.grade === year).map(c => ({
      id: c.id, name: c.name,
      gens: generatorsFor(c).filter(issues).map(gen => ({ gen, diffs: [...new Set(c.covers.filter(cv => cv.gen === gen).flatMap(cv => cv.diff))].sort() }))
    })).filter(t => t.gens.length);
  }
  const own = (year >= 11 ? (pathway && PATHWAYS[pathway] ? scopeForYear(year, pathway).own : []) : subtopicsForYear(year));
  return own.map(s => ({ id: s.id, name: s.name, gens: issues(s.id) ? [{ gen: s.id, diffs: [1, 2, 3, 4] }] : [] })).filter(t => t.gens.length);
}

/** The section a question of this many marks sits in, per edition style. */
export function sectionOf(style, marks, objective) {
  if (style === 'hsc') return objective ? { id: 'I', label: 'Section I · Multiple choice' } : { id: 'II', label: 'Section II · Extended response' };
  if (style === 'jee') return objective ? { id: 'A', label: 'Section A · Single correct' } : { id: 'B', label: 'Section B · Numerical value' };
  const letter = 'ABCD'[Math.min(3, Math.max(1, marks) - 1)];
  return { id: letter, label: `Section ${letter} · ${marks >= 4 ? '4' : marks} mark${marks === 1 ? '' : 's'} each` };
}

// ── Planning ─────────────────────────────────────────────────────────────────

function pickIndex(rng, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let x = rng() * total;
  for (let i = 0; i < weights.length; i++) { x -= weights[i]; if (x < 0) return i; }
  return weights.length - 1;
}

/** A composition of `marks` into questions of 1–4 marks following the mix. Pure. */
export function planSlots({ marks, mix, topicIds, weakIds = [], style, rng, objectiveOk = true }) {
  const share = MIX_SHARE[mix];
  const slots = [];
  const used = new Map(topicIds.map(id => [id, 0]));
  const weak = new Set(weakIds);
  let left = marks;
  let last = null;
  while (left > 0) {
    const difficulty = pickIndex(rng, share) + 1;
    // Marks follow difficulty. An HSC multiple-choice question is one mark, and
    // Section I exists only where the banks issue multiple choice; a JEE-style
    // single-correct question is an easy one.
    const objective = style === 'hsc' ? objectiveOk && (difficulty === 1 || left === 1) : style === 'jee' && difficulty <= 2;
    let m = objective && style === 'hsc' ? 1 : Math.min(style === 'hsc' ? Math.max(2, difficulty) : difficulty, left);
    // Never leave a single mark that only a one-mark question could take.
    if (style === 'hsc' && !objectiveOk && left - m === 1) m = m >= 3 ? m - 1 : m + 1;
    // The least-used topic, weak ones counted lighter so they come up more.
    let best = null;
    for (const id of topicIds) {
      if (topicIds.length > 1 && id === last) continue;
      const score = (used.get(id) + rng() * 0.5) / (weak.has(id) ? 3 : 1);
      if (best === null || score < best.score) best = { id, score };
    }
    used.set(best.id, used.get(best.id) + 1); last = best.id;
    slots.push({ topicId: best.id, difficulty: objective ? Math.min(difficulty, 2) : difficulty, marks: m, objective });
    left -= m;
  }
  return slots.filter(Boolean).sort((a, b) => a.marks - b.marks);
}

/**
 * Assemble a paper. `admit(q, gen, slot)` is the edition's gate (bank issues it,
 * identity sealed, answer type allowed); `seenOf(questions)` resolves to the set
 * of indices the account has recently seen. Returns
 *   { ok: true, questions: [{ q, gen, topicId, topicName, difficulty, marks, section, repeat }], marks, minutes, repeats }
 * or { ok: false, code, message, nearest } — nothing is ever padded.
 */
export async function assemblePaper({ topics, topicIds, marks, mix, seed, weakIds = [], style, admit, seenOf = async () => new Set(), nearest = true }) {
  const byId = new Map(topics.map(t => [t.id, t]));
  const chosen = topicIds.filter(id => byId.has(id));
  const rng = makeRng(seed);
  // HSC Section I is multiple choice: it is set only if a chosen topic's banks
  // issue some (probed with fixed seeds, so the probe never moves the paper).
  let objectiveOk = true;
  if (style === 'hsc') {
    objectiveOk = false;
    probe: for (const id of chosen) for (const g of byId.get(id).gens) for (const d of [1, 2]) {
      if (!g.diffs.includes(d)) continue;
      for (let k = 1; k <= 6; k++) {
        try {
          const q = generateQuestion(g.gen, d, k * 7919); q._generator = g.gen;
          if (admit(q, g.gen, { objective: true, difficulty: d, marks: 1 }) === true) { objectiveOk = true; break probe; }
        } catch { /* not issuable at this seed */ }
      }
    }
  }
  const slots = planSlots({ marks, mix, topicIds: chosen, weakIds, style, rng, objectiveOk });
  const onPaper = new Set();
  const out = [];
  let repeats = 0;
  for (const slot of slots) {
    // The slot's topic first, then the other chosen topics: a thin topic does
    // not sink the paper while the rest can fill its place.
    const order = [slot.topicId, ...chosen.filter(id => id !== slot.topicId)];
    let filled = null;
    for (const topicId of order) {
      const topic = byId.get(topicId);
      // A multiple-choice question is an easy one: it may come from either of
      // the two easier levels, wherever the topic's bank issues it.
      const levels = slot.objective ? [1, 2] : [slot.difficulty];
      const forms = topic.gens.filter(g => g.diffs.some(d => levels.includes(d)));
      if (!forms.length) continue;
      const cands = [];
      for (let k = 0; k < CANDIDATES; k++) {
        const form = forms[Math.floor(rng() * forms.length)];
        const own = form.diffs.filter(d => levels.includes(d));
        const level = own[Math.floor(rng() * own.length)];
        const qseed = Math.floor(rng() * 0x7ffffffe) + 1;
        let q;
        try { q = generateQuestion(form.gen, level, qseed); } catch { continue; }
        if (!q?.prompt) continue;
        q._generator = form.gen;
        let ok = false;
        try { ok = admit(q, form.gen, slot) === true; } catch { ok = false; }
        if (!ok) continue;
        const hash = contentHashOf(q);
        if (onPaper.has(hash) || cands.some(c => c.hash === hash)) continue;
        cands.push({ q, gen: form.gen, hash });
      }
      if (!cands.length) continue;
      const seen = await seenOf(cands.map(c => c.q));
      const fresh = cands.findIndex((_, i) => !seen.has(i));
      const pick = fresh >= 0 ? fresh : 0;
      filled = { ...cands[pick], topicId, repeat: fresh < 0 };
      break;
    }
    if (!filled) {
      const refusal = { ok: false, code: 'PAPER_BANK_INSUFFICIENT', message: 'The approved question banks cannot fill this paper from those topics right now. Nothing was started.' };
      if (!nearest) return refusal;
      // The nearest valid paper: the same length at an easier mix, then a
      // shorter one (easier mixes last). Found by assembling it, never assumed.
      const easier = MIXES.slice(0, MIXES.indexOf(mix) > 0 && mix !== 'exam' ? MIXES.indexOf(mix) : 0).reverse();
      const lengths = [marks, ...PAPER_MARKS.filter(m => m < marks).reverse()];
      for (const m of lengths) for (const mx of [mix, ...easier]) {
        if (m === marks && mx === mix) continue;
        const tried = await assemblePaper({ topics, topicIds, marks: m, mix: mx, seed, weakIds, style, admit, seenOf, nearest: false });
        if (tried.ok) return { ...refusal, nearest: { marks: m, minutes: minutesForMarks(m), mix: mx, questions: tried.questions.length } };
      }
      return { ...refusal, nearest: null };
    }
    onPaper.add(filled.hash);
    if (filled.repeat) repeats += 1;
    out.push({
      q: filled.q, gen: filled.gen, topicId: filled.topicId, topicName: byId.get(filled.topicId).name,
      difficulty: filled.q.difficulty || slot.difficulty, marks: slot.marks, section: sectionOf(style, slot.marks, slot.objective), repeat: filled.repeat
    });
  }
  const total = out.reduce((n, s) => n + s.marks, 0);
  if (total !== marks) return { ok: false, code: 'PAPER_MARKS_MISMATCH', message: 'The paper could not be balanced to the marks asked for. Nothing was started.', nearest: null };
  return { ok: true, questions: out, marks: total, minutes: minutesForMarks(total), repeats };
}

/** What the device may read before it sits a paper: counts and names, never a question. */
export function publicSummary(result, { topicNames = [] } = {}) {
  if (!result.ok) return { ok: false, code: result.code, message: result.message, nearest: result.nearest || null };
  const sections = [];
  for (const s of result.questions) {
    let row = sections.find(x => x.id === s.section.id);
    if (!row) { row = { id: s.section.id, label: s.section.label, questions: 0, marks: 0 }; sections.push(row); }
    row.questions += 1; row.marks += s.marks;
  }
  const topics = [];
  for (const s of result.questions) {
    let row = topics.find(x => x.id === s.topicId);
    if (!row) { row = { id: s.topicId, name: s.topicName, questions: 0 }; topics.push(row); }
    row.questions += 1;
  }
  return { ok: true, marks: result.marks, minutes: result.minutes, questions: result.questions.length, sections, topics, repeats: result.repeats, topicNames };
}
