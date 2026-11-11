// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Root-gap finder: where a gap in the working actually starts
//
// A pure reading over server-marked practice answers. For each chapter the
// student is failing, it follows the prerequisite graph (prerequisites.js)
// downward, ONE LINK AT A TIME, and only while the prerequisite below has its
// own failing evidence. Where that stops is the root it names. Every link it
// shows carries its evidence: wrong answers against chances (all practice
// answers on that chapter).
//
// What it never does (KNOWLEDGE_GRAPH_PREREQUISITE_CAUSALITY_DEEP_DIVE_V7.md
// §5 and §27; LEARNER_MODELING_KT_CDM_IRT_DEEP_DIVE.md §12):
//   · infer a gap in a chapter with no answers, or too few (INSUFFICIENT
//     EVIDENCE: the walk stops there, and the chapter is listed as unchecked);
//   · walk through a prerequisite the student is holding;
//   · call an edge causal. The graph is a Pri-authored K0 (expert) map; the
//     evidence on each link is observational. The reading says "your wrong
//     answers on X sit under your wrong answers on Y", not "X causes Y";
//   · claim anything for a student with no failing chapter.
//
// The floors below are Pri product floors, not research-derived thresholds.
// ─────────────────────────────────────────────────────────────────────────────
import { IN_CHAPTERS, IN_CHAPTER_BY_ID } from './curriculum-in.js';
import { prerequisitesOf, PREREQ_PROVENANCE } from './prerequisites.js';
import { NOTEBOOK_MODES } from './mistakeNotebook.js';

/** A chapter needs at least this many marked practice answers before it says anything. */
export const EVIDENCE_MIN = 4;
/** …and at least this many of them wrong, and more wrong than right, to count as failing. */
export const WRONG_MIN = 2;
export const GAP_ROWS = 5;

const GEN_CHAPTER = (() => {
  const m = new Map();
  for (const ch of IN_CHAPTERS) for (const c of ch.covers || []) (m.get(c.gen) || m.set(c.gen, new Set()).get(c.gen)).add(ch.id);
  return m;
})();
const hasChapter = id => (IN_CHAPTER_BY_ID instanceof Map ? IN_CHAPTER_BY_ID.has(id) : !!IN_CHAPTER_BY_ID?.[id]);

/** The one chapter an answer's subtopic belongs to, or null when it is not exactly one. */
export function chapterOfSubtopic(subtopic) {
  const id = String(subtopic || '');
  if (hasChapter(id)) return id;
  const set = GEN_CHAPTER.get(id);
  return set && set.size === 1 ? [...set][0] : null;
}

const practised = a => !!a && a.revealed !== true && typeof a.correct === 'boolean' &&
  NOTEBOOK_MODES.includes(a.mode || 'practice') && typeof a.subtopic === 'string' && !!a.subtopic;

/** Per-chapter evidence: { answered, wrong, state: 'failing' | 'holding' | 'insufficient' }. */
export function chapterEvidence(attempts = []) {
  const out = new Map();
  for (const a of (attempts || []).filter(practised)) {
    const ch = chapterOfSubtopic(a.subtopic);
    if (!ch) continue;
    const e = out.get(ch) || out.set(ch, { answered: 0, wrong: 0 }).get(ch);
    e.answered += 1;
    if (!a.correct) e.wrong += 1;
  }
  for (const e of out.values()) e.state = stateOf(e);
  return out;
}

function stateOf(e) {
  if (!e || e.answered < EVIDENCE_MIN) return 'insufficient';
  return e.wrong >= WRONG_MIN && e.wrong * 2 > e.answered ? 'failing' : 'holding';
}

const link = (id, e, skill) => ({ chapter: id, wrong: e?.wrong || 0, chances: e?.answered || 0, state: stateOf(e), skill: skill || null });

/**
 * @param {Array} attempts graded-attempt payloads (server-marked).
 * @returns {{ gaps: Array, answered: number, provenance: object }}
 *   gaps[i] = { from, root, chain: [link…] (from first, root last), unchecked: [chapter…] }
 */
export function rootGaps(attempts = []) {
  const ev = chapterEvidence(attempts);
  const answered = [...ev.values()].reduce((s, e) => s + e.answered, 0);
  const failing = [...ev.entries()].filter(([, e]) => e.state === 'failing').map(([id]) => id);
  const walks = failing.map(from => {
    const chain = [link(from, ev.get(from), null)];
    const seen = new Set([from]);
    let at = from;
    for (;;) {
      // Authored priority order: the first prerequisite with its own failing evidence.
      const next = prerequisitesOf(at).find(p => !seen.has(p.id) && ev.get(p.id)?.state === 'failing');
      if (!next) break;
      chain.push(link(next.id, ev.get(next.id), next.skill));
      seen.add(next.id);
      at = next.id;
    }
    const unchecked = prerequisitesOf(at).filter(p => stateOf(ev.get(p.id)) === 'insufficient').map(p => p.id);
    return { from, root: at, chain, unchecked };
  });
  // A failing chapter that is already a link in a longer walk is not its own row.
  const inner = new Set(walks.flatMap(w => w.chain.slice(1).map(l => l.chapter)));
  const gaps = walks.filter(w => !inner.has(w.from))
    .sort((x, y) => y.chain.length - x.chain.length || y.chain[0].wrong - x.chain[0].wrong || x.from.localeCompare(y.from))
    .slice(0, GAP_ROWS);
  return { gaps, answered, provenance: { graph: PREREQ_PROVENANCE.statement, evidence: 'observational', evidenceMin: EVIDENCE_MIN, wrongMin: WRONG_MIN } };
}
