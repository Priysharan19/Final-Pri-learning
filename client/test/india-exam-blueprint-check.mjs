import assert from 'node:assert/strict';
import {
  CBSE_CLASS10_STANDARD_REFERENCE,
  JEE_MAIN_MATHEMATICS_2026,
  JEE_ADVANCED_2026,
  indiaExamBlueprint,
  indiaExamClaim,
  examBlueprintInvariant
} from '../src/engine/indiaExams.js';

assert.equal(examBlueprintInvariant(CBSE_CLASS10_STANDARD_REFERENCE), true);
assert.equal(CBSE_CLASS10_STANDARD_REFERENCE.totalMarks, 80);
assert.equal(CBSE_CLASS10_STANDARD_REFERENCE.questionCount, 38);
assert.equal(CBSE_CLASS10_STANDARD_REFERENCE.currentForCurriculum, false);
assert.equal(indiaExamClaim(CBSE_CLASS10_STANDARD_REFERENCE).authentic, false,
  'last-session CBSE SQP must not be promoted to a 2026-27 authenticity claim');

assert.equal(examBlueprintInvariant(JEE_MAIN_MATHEMATICS_2026), true);
assert.equal(JEE_MAIN_MATHEMATICS_2026.questionCount, 25);
assert.equal(JEE_MAIN_MATHEMATICS_2026.totalMarks, 100);
assert.deepEqual(JEE_MAIN_MATHEMATICS_2026.sections.map(s => s.questions), [20, 5]);
assert.deepEqual(JEE_MAIN_MATHEMATICS_2026.sections.map(s => [s.correct, s.incorrect]), [[4, -1], [4, -1]]);
assert.equal(JEE_MAIN_MATHEMATICS_2026.sectionTimerIsOfficial, false,
  'the full paper is 180 minutes; Pri must not invent an official maths-only timer');
assert.equal(indiaExamClaim(JEE_MAIN_MATHEMATICS_2026).fullPaper, false);

assert.equal(examBlueprintInvariant(JEE_ADVANCED_2026), true);
assert.equal(JEE_ADVANCED_2026.papers, 2);
assert.equal(JEE_ADVANCED_2026.durationMinutesPerPaper, 180);
assert.equal(JEE_ADVANCED_2026.bothPapersCompulsory, true);
assert.equal(JEE_ADVANCED_2026.fixedQuestionCount, null);
assert.equal(JEE_ADVANCED_2026.fixedMarkingScheme, null,
  'JEE Advanced question-level marking must remain paper-specific');

assert.equal(indiaExamBlueprint({ track: 'jee-main', grade: 12 }).id, JEE_MAIN_MATHEMATICS_2026.id);
assert.equal(indiaExamBlueprint({ track: 'jee-advanced', grade: 11 }).id, JEE_ADVANCED_2026.id);
assert.equal(indiaExamBlueprint({ track: 'cbse', grade: 10 }).id, CBSE_CLASS10_STANDARD_REFERENCE.id);
assert.equal(indiaExamBlueprint({ track: 'cbse', grade: 9 }), null);

console.log('INDIA EXAM BLUEPRINT — PASS — source-versioned CBSE/JEE claims are explicit and false full-paper claims are blocked.');
