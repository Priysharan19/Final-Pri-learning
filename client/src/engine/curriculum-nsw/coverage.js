// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · NSW curriculum model · generator coverage (Prithagoras)
//
// The honest content-gap number for the Australian edition: for each current
// NSW syllabus, how many of its outcomes a Pri generator reaches through the
// reviewed crosswalk. The counterpart of the India availability contract
// (curriculumAvailability.js): a real syllabus outcome is not the same fact as
// a question Pri can generate for it.
//
// Per outcome:
//   mapped   at least one generator's subtopic row is `mapped` and one of its
//            dot points lands on this outcome
//   partial  only `partial` rows land on it
//   missing  no generator reaches it (the outcome is a `new-no-generator` gap)
//
// "mapped" means a generator touches the outcome somewhere, not that every
// NESA dot point of the outcome is practised: the crosswalk is at Pri dot-point
// granularity, three per subtopic. It is a floor on the gap, not a claim of
// syllabus completeness. Pure: no I/O; generator ids are passed in.
// ─────────────────────────────────────────────────────────────────────────────

import { outcomesOf } from './index.js';

function groupOf(outcome) {
  if (outcome.stage !== undefined) return `Stage ${outcome.stage} ${outcome.kind === 'path' ? 'Path' : 'Core'}`;
  if (outcome.course) return `Year ${outcome.year} ${outcome.course}`;
  return `Year ${outcome.year}`;
}

const emptyCounts = () => ({ total: 0, mapped: 0, partial: 0, missing: 0 });

/**
 * @param {{ syllabuses: object[], crosswalk: object[], generatorIds: Iterable<string> }} input
 * @returns {object[]} one report per syllabus, in the order given
 */
export function nswCoverage({ syllabuses, crosswalk, generatorIds }) {
  const generators = new Set(generatorIds || []);
  const reach = new Map(); // outcome code → { mapped: Set<subtopic>, partial: Set<subtopic> }
  for (const row of crosswalk || []) {
    if (!row.subtopicId || !generators.has(row.subtopicId)) continue;
    if (row.status !== 'mapped' && row.status !== 'partial') continue;
    for (const code of new Set((row.dotpoints || []).flat())) {
      if (!reach.has(code)) reach.set(code, { mapped: new Set(), partial: new Set() });
      reach.get(code)[row.status].add(row.subtopicId);
    }
  }
  return (syllabuses || []).map(syllabus => {
    const counts = emptyCounts();
    const groups = new Map();
    const outcomes = outcomesOf(syllabus).map(outcome => {
      const r = reach.get(outcome.code);
      const state = r?.mapped.size ? 'mapped' : r?.partial.size ? 'partial' : 'missing';
      const group = groupOf(outcome);
      if (!groups.has(group)) groups.set(group, emptyCounts());
      for (const c of [counts, groups.get(group)]) { c.total += 1; c[state] += 1; }
      return Object.freeze({
        code: outcome.code,
        focusArea: outcome.focusArea,
        group,
        state,
        subtopics: Object.freeze([...(r ? [...r.mapped, ...r.partial] : [])].sort())
      });
    });
    return Object.freeze({
      id: syllabus.id,
      title: syllabus.title,
      ...counts,
      groups: Object.freeze([...groups].map(([name, c]) => Object.freeze({ name, ...c }))),
      outcomes: Object.freeze(outcomes)
    });
  });
}

/** One line per syllabus plus its groups, for the npm script and the test log. */
export function formatNswCoverage(report) {
  const lines = [];
  for (const s of report) {
    lines.push(`${s.title}: ${s.total} outcomes — ${s.mapped} mapped, ${s.partial} partial, ${s.missing} missing`);
    for (const g of s.groups) lines.push(`  ${g.name}: ${g.total} — ${g.mapped} mapped, ${g.partial} partial, ${g.missing} missing`);
  }
  return lines.join('\n');
}
