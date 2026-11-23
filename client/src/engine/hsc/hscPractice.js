// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · HSC priorities joined to the student's own evidence
//
// Two pure functions the Prithagoras surfaces use:
//
//   hscPractiseNext(priorities, rows)   each 2024 outcome with the student's own
//       evidence on the Pri practice behind it (answers, right answers, right
//       answers without help) and a "practise next" order:
//         need = expected share × gap
//         gap  = 1 while there are fewer than HSC_EVIDENCE_FLOOR answers,
//                else 1 − (right without help) / answers.
//       The evidence is the student's practice, never a forecast of their mark.
//
//   hscPaperWeights(course, scopeIds)   the weight each Pri subtopic gets in a
//       practice paper weighted by the priorities: an outcome's expected share,
//       split evenly over the subtopics behind it that the paper's scope holds.
//       The paper is Pri's own questions from the issued banks; nothing in it is
//       a NESA question.
// ─────────────────────────────────────────────────────────────────────────────

import { HSC_PRACTICE_LINKS } from './hscOutcomes.js';
import { hscPriorities } from './hscPriorities.js';
import { hscCoursesFor } from '../hscCourses.js';
import { entryIdOf } from '../curriculum.js';

/** Answers on an outcome's practice before its success rate is used. */
export const HSC_EVIDENCE_FLOOR = 5;

/** At or above this rate of right-without-help answers an outcome reads as secure. */
export const HSC_SECURE_RATE = 0.8;

/** Which HSC examinations a student sits here (engine/hscCourses.js). */
export { hscCoursesFor };

/** Flattens a GET /curriculum reply into subtopic id → row. */
export function curriculumRows(curriculum) {
  const out = {};
  for (const section of [...(curriculum?.years || []), ...(curriculum?.streams || [])]) {
    for (const s of section.subtopics || []) if (s?.id && !out[s.id]) out[s.id] = s;
  }
  return out;
}

const offered = row => !!row && Array.isArray(row.requestable) && row.requestable.length > 0;

/**
 * priorities: hscPriorities(course).priorities; rows: curriculumRows(...).
 * → [{ ...priority, links: [{ id, name }], evidence: { answers, right, independent }, status, need }]
 *   sorted by need (largest first), ties by rank.
 */
export function hscPractiseNext(priorities, rows) {
  const out = priorities.map(p => {
    // A topic and its `-forms` generator are one row (engine/curriculum.js): its counts are read once, and it is named once.
    const topics = [...new Set((HSC_PRACTICE_LINKS[p.code] || []).map(id => rows[entryIdOf(id)]).filter(offered))];
    const links = topics.map(r => ({ id: r.id, name: r.name }));
    let answers = 0, right = 0, independent = 0, known = true;
    for (const r of topics) {
      const ev = r.evidence;
      if (ev) { answers += ev.attempts || 0; right += ev.correct || 0; independent += ev.independentCorrect || 0; }
      else { answers += r.attempts || 0; right += r.correct || 0; known = false; }
    }
    const rate = answers >= HSC_EVIDENCE_FLOOR ? (known ? independent : right) / answers : null;
    const status = !links.length ? 'no-practice'
      : answers === 0 ? 'not-started'
      : rate === null ? 'thin'
      : rate >= HSC_SECURE_RATE ? 'secure' : 'working';
    const gap = rate === null ? 1 : 1 - rate;
    return {
      ...p, links,
      evidence: { answers, right, independent: known ? independent : null },
      status,
      need: links.length ? Math.round(p.expected * gap * 1e4) / 1e4 : 0
    };
  });
  return out.sort((a, b) => (b.need - a.need) || (a.rank - b.rank));
}

/**
 * Subtopic id → weight (summing to 1) for a practice paper weighted by the
 * priorities, over the subtopics in `scopeIds` only. Outcomes with no subtopic
 * in scope contribute nothing (the paper cannot set what Pri cannot issue).
 */
export function hscPaperWeights(course, scopeIds) {
  const scope = new Set(scopeIds || []);
  const weights = {};
  for (const p of hscPriorities(course).priorities) {
    const ids = (HSC_PRACTICE_LINKS[p.code] || []).filter(id => scope.has(id));
    for (const id of ids) weights[id] = (weights[id] || 0) + p.expected / ids.length;
  }
  const total = Object.values(weights).reduce((s, v) => s + v, 0);
  return total > 0 ? Object.fromEntries(Object.entries(weights).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => [k, v / total])) : {};
}
