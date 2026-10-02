// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Exam section analysis — pinned against hand-computed papers.
//
// local/examAnalysis.js turns a marked paper into the per-pattern analysis the
// results screen shows. Every expected number below was worked out by hand
// from the fixture beside it (the working is in the comments), so a change to
// the arithmetic fails here rather than quietly changing what a student is told
// about where their marks went. Fixtures cover CBSE A–E with step marks and a
// case study, JEE Main +4/−1 with negative marking, JEE Advanced partial
// credit, IOQM, time per section, weak chapters and determinism.
// ─────────────────────────────────────────────────────────────────────────────
import { analyseExam, outcomeOf } from '../src/local/examAnalysis.js';

let pass = 0;
const failures = [];
const eq = (actual, expected, label) => {
  if (JSON.stringify(actual) === JSON.stringify(expected)) pass++;
  else failures.push(`${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};
const pick = (o, keys) => Object.fromEntries(keys.map(k => [k, o?.[k]]));

// ── CBSE ─────────────────────────────────────────────────────────────────────
// A: q1 1/1, q2 0/1 (wrong), q3 unanswered (1)
// B: q4 2/2, q5 1/2 by step marks
// C: q6 2/3 by step marks
// D: q7 unanswered (5)
// E: q8 case study 3/4 (parts)
// marks 3+4+3+5+4 = 19; awarded 1+0+2+1+2+3 = 9
// attempted q1 q2 q4 q5 q6 q8 = 6; full q1 q4 = 2; partial q5 q6 q8 = 3; wrong q2 = 1
// step marks: q5 q6 q8 earned 1+2+3 = 6, lost 1+1+1 = 3
// lost on attempted: 0+1+0+1+1+1 = 4; unattempted marks 1+5 = 6
const cbseSections = ['A', 'B', 'C', 'D', 'E'].map(id => ({ id, label: `Section ${id}` }));
const q = (o) => ({ correct: o.awarded === o.marks, unanswered: false, timed: true, ...o });
const cbse = [
  q({ id: 'q1', order: 1, section: 'A', marks: 1, awarded: 1, chapterId: 'x', subtopicName: 'Real Numbers', ms: 30000 }),
  q({ id: 'q2', order: 2, section: 'A', marks: 1, awarded: 0, chapterId: 'x', subtopicName: 'Real Numbers', ms: 20000 }),
  q({ id: 'q3', order: 3, section: 'A', marks: 1, awarded: 0, unanswered: true, chapterId: 'x', subtopicName: 'Real Numbers', ms: 0 }),
  q({ id: 'q4', order: 4, section: 'B', marks: 2, awarded: 2, chapterId: 'y', subtopicName: 'Polynomials', ms: 60000 }),
  q({ id: 'q5', order: 5, section: 'B', marks: 2, awarded: 1, partial: { okLines: 1, awarded: 1 }, chapterId: 'y', subtopicName: 'Polynomials', ms: 90000 }),
  q({ id: 'q6', order: 6, section: 'C', marks: 3, awarded: 2, partial: { okLines: 2, awarded: 2 }, chapterId: 'z', subtopicName: 'Triangles', ms: 120000 }),
  q({ id: 'q7', order: 7, section: 'D', marks: 5, awarded: 0, unanswered: true, chapterId: 'z', subtopicName: 'Triangles', ms: 0 }),
  q({ id: 'q8', order: 8, section: 'E', marks: 4, awarded: 3, multipart: true, chapterId: 'w', subtopicName: 'Statistics', ms: 240000 })
];
const a1 = analyseExam({ detail: cbse, indiaExam: { track: 'cbse', sections: cbseSections } });
eq(a1.pattern, 'cbse', 'CBSE: pattern');
eq(pick(a1.totals, ['questions', 'marks', 'awarded', 'attempted', 'unattempted', 'full', 'partial', 'wrong', 'accuracy', 'scorePct']),
  { questions: 8, marks: 19, awarded: 9, attempted: 6, unattempted: 2, full: 2, partial: 3, wrong: 1, accuracy: 33.3, scorePct: 47.4 }, 'CBSE: paper totals');
eq(a1.stepMarks, { questions: 3, earned: 6, lost: 3, lostOnAttempted: 4, unattemptedMarks: 6 }, 'CBSE: step-mark losses');
eq(a1.sections.map(s => s.id), ['A', 'B', 'C', 'D', 'E'], 'CBSE: sections A–E in blueprint order');
eq(a1.sections.map(s => [s.marks, s.awarded, s.attempted, s.accuracy]), [[3, 1, 2, 50], [4, 3, 2, 50], [3, 2, 1, 0], [5, 0, 0, null], [4, 3, 1, 0]],
  'CBSE: per-section marks, awarded, attempted and accuracy');
eq(a1.sections.map(s => s.stepMarksLost), [0, 1, 1, 0, 1], 'CBSE: per-section step-mark losses');
eq(a1.timed, true, 'CBSE: a paper with measured time is timed');
eq(a1.sections.map(s => [s.ms, s.msPerQuestion]), [[50000, 16667], [150000, 75000], [120000, 120000], [0, 0], [240000, 240000]], 'CBSE: time per section and per question');
// chapters: x 1/3 (lost 2), y 3/4, z 2/8 (lost 6), w 3/4 → weak: z then x
eq(a1.weakChapters.map(c => [c.id, c.marks, c.awarded, c.lost, c.unattempted]), [['z', 8, 2, 6, 1], ['x', 3, 1, 2, 1]], 'CBSE: weak chapters, most marks lost first');
eq(a1.negativeMarking, undefined, 'CBSE: no negative-marking section on a CBSE paper');

// ── JEE Main ─────────────────────────────────────────────────────────────────
// A (MCQ +4/−1): 3 right (+12), 1 wrong (−1), 1 blank
// B (numerical +4/−1): 1 right (+4), 1 wrong (−1)
// positive 16, negative 2, net 14 of 28; attempted 6, full 4 → 66.7%
// leaving both wrong answers blank would have scored 16
const jm = [
  ...[1, 2, 3].map(i => q({ id: `m${i}`, order: i, section: 'A', marks: 4, awarded: 4, chapterId: 'calc', subtopicName: 'Calculus' })),
  q({ id: 'm4', order: 4, section: 'A', marks: 4, awarded: -1, chapterId: 'vec', subtopicName: 'Vectors' }),
  q({ id: 'm5', order: 5, section: 'A', marks: 4, awarded: 0, unanswered: true, chapterId: 'vec', subtopicName: 'Vectors' }),
  q({ id: 'n1', order: 6, section: 'B', marks: 4, awarded: 4, chapterId: 'calc', subtopicName: 'Calculus' }),
  q({ id: 'n2', order: 7, section: 'B', marks: 4, awarded: -1, chapterId: 'prob', subtopicName: 'Probability' })
].map(d => ({ ...d, timed: false, ms: 120000 }));
const a2 = analyseExam({ detail: jm, indiaExam: { track: 'jee-main', sections: [{ id: 'A', label: 'Section A' }, { id: 'B', label: 'Section B' }] } });
eq(a2.pattern, 'jee-main', 'JEE Main: pattern');
eq(pick(a2.totals, ['marks', 'awarded', 'positive', 'negative', 'attempted', 'full', 'wrong', 'unattempted', 'accuracy', 'scorePct']),
  { marks: 28, awarded: 14, positive: 16, negative: 2, attempted: 6, full: 4, wrong: 2, unattempted: 1, accuracy: 66.7, scorePct: 50 }, 'JEE Main: correct / incorrect / unattempted and +4/−1 net');
eq(a2.negativeMarking, { wrong: 2, marksLost: 2, netIfWrongLeftBlank: 16, net: 14, positive: 16 }, 'JEE Main: negative-marking analysis');
eq(a2.sections.map(s => [s.id, s.full, s.wrong, s.unattempted, s.positive, s.negative, s.awarded, s.accuracy]),
  [['A', 3, 1, 1, 12, 1, 11, 75], ['B', 1, 1, 0, 4, 1, 3, 50]], 'JEE Main: per-section breakdown');
eq([a2.timed, a2.sections[0].ms, a2.totals.ms], [false, null, null], 'JEE Main: an evenly split time is not presented as measured');
// chapters: calc 16/16, vec −1/8 (lost 9), prob −1/4 (lost 5)
eq(a2.weakChapters.map(c => [c.id, c.lost]), [['vec', 9], ['prob', 5]], 'JEE Main: weak chapters count negative marks as marks lost');
eq(a2.partialMarking, undefined, 'JEE Main: no partial-marking section');

// ── JEE Advanced ─────────────────────────────────────────────────────────────
// 1 (single +3/−1): 3, −1
// 2 (multi +4, +1 per option, −2): 4 (full), 2 (partial, two options), 1 (partial, one option)
// 3 (numerical +4/0): 0 (wrong, no penalty)
// 4 (matching +3/−1): blank
// marks 3+3+4+4+4+4+3 = 25; awarded 3−1+4+2+1+0 = 9; positive 10, negative 1
// partial: 2 questions worth 3, leaving (4−2)+(4−1) = 5
const adv = [
  q({ id: 's1a', order: 1, section: '1', marks: 3, awarded: 3, chapterId: 'a' }),
  q({ id: 's1b', order: 2, section: '1', marks: 3, awarded: -1, chapterId: 'a' }),
  q({ id: 's2a', order: 3, section: '2', marks: 4, awarded: 4, chapterId: 'b' }),
  q({ id: 's2b', order: 4, section: '2', marks: 4, awarded: 2, partial: { awarded: 2 }, chapterId: 'b' }),
  q({ id: 's2c', order: 5, section: '2', marks: 4, awarded: 1, partial: { awarded: 1 }, chapterId: 'b' }),
  q({ id: 's3a', order: 6, section: '3', marks: 4, awarded: 0, chapterId: 'c' }),
  q({ id: 's4a', order: 7, section: '4', marks: 3, awarded: 0, unanswered: true, chapterId: 'c' })
];
const advSections = ['1', '2', '3', '4'].map(id => ({ id, label: `Section ${id}` }));
const a3 = analyseExam({ detail: adv, indiaExam: { track: 'jee-advanced', sections: advSections } });
eq(pick(a3.totals, ['marks', 'awarded', 'positive', 'negative', 'full', 'partial', 'wrong', 'unattempted']),
  { marks: 25, awarded: 9, positive: 10, negative: 1, full: 2, partial: 2, wrong: 2, unattempted: 1 }, 'JEE Advanced: paper totals');
eq(pick(a3.partialMarking, ['questions', 'marks', 'left']), { questions: 2, marks: 3, left: 5 }, 'JEE Advanced: partial-marking breakdown');
eq(a3.partialMarking.sections, [{ id: '2', label: 'Section 2', partial: 2, marks: 3, left: 5, full: 1, wrong: 0 }], 'JEE Advanced: partial credit is located in the multi-correct section');
eq(a3.negativeMarking, { wrong: 2, marksLost: 1, netIfWrongLeftBlank: 10, net: 9, positive: 10 }, 'JEE Advanced: a wrong numerical answer costs nothing, a wrong single-correct costs one');
eq(a3.stepMarks, undefined, 'JEE Advanced: per-option credit is not reported as CBSE step marks');

// ── IOQM ─────────────────────────────────────────────────────────────────────
const io = [
  q({ id: 'i1', order: 1, section: '2', marks: 2, awarded: 2, chapterId: 'nt' }),
  q({ id: 'i2', order: 2, section: '3', marks: 3, awarded: 0, chapterId: 'nt' }),
  q({ id: 'i3', order: 3, section: '5', marks: 5, awarded: 0, unanswered: true, chapterId: 'geo' })
];
const a4 = analyseExam({ detail: io, indiaExam: { track: 'olympiad', sections: [{ id: '2' }, { id: '3' }, { id: '5' }] } });
eq([a4.pattern, a4.totals.awarded, a4.totals.negative, a4.negativeMarking, a4.sections.map(s => s.label)],
  ['ioqm', 2, 0, undefined, ['Section 2', 'Section 3', 'Section 5']], 'IOQM: tiers as sections, no negative marking');

// ── Outcomes, determinism, refusals ──────────────────────────────────────────
eq(['full', 'partial', 'wrong', 'wrong', 'unattempted'],
  [outcomeOf({ marks: 4, awarded: 4 }), outcomeOf({ marks: 4, awarded: 1 }), outcomeOf({ marks: 4, awarded: 0 }), outcomeOf({ marks: 4, awarded: -2 }), outcomeOf({ marks: 4, awarded: 0, unanswered: true })],
  'outcomes: full / partial / wrong (zero or negative) / unattempted');
const shuffled = [...cbse].reverse();
eq(analyseExam({ detail: shuffled, indiaExam: { track: 'cbse', sections: cbseSections } }), a1, 'deterministic: the order the detail arrives in does not change the analysis');
eq(analyseExam({ detail: cbse, indiaExam: { track: 'cbse', sections: cbseSections } }), a1, 'deterministic: the same paper always gives the same analysis');
eq(analyseExam({ detail: [{ id: 'x', marks: 1, awarded: 1 }] }), null, 'a paper without sections is not analysed (a legacy practice paper)');
eq(analyseExam({ detail: [] }), null, 'an empty paper is not analysed');
const sum = a1.sections.reduce((n, s) => n + s.awarded, 0);
eq(sum, a1.totals.awarded, 'section scores add up to the paper score');

console.log(failures.length
  ? `EXAM ANALYSIS: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `EXAM ANALYSIS: PASS — ${pass}/${pass} checks — CBSE A–E step marks, JEE Main +4/−1, JEE Advanced partial, IOQM, time and weak chapters against hand-computed papers.`);
process.exit(failures.length ? 1 : 0);
