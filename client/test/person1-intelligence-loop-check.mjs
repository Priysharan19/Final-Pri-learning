// Pri Learning · Person 1 end-to-end intelligence release contract
//
// This is intentionally a cross-subsystem contract rather than another unit
// test for one engine. A release must preserve the chain:
//
// recognition evidence -> authority/confirmation -> mathematical equivalence
// -> step validity -> named diagnosis -> adaptive state -> Pri Explain policy.
//
// It uses only deterministic, answer-blind fixtures. Real-writer accuracy and
// physical-device latency remain separate evidence gates.

import assert from 'node:assert/strict';
import { parse } from '../src/engine/expr.js';
import { checkAnswer, checkWorking, stepCheck } from '../src/engine/checker-core.js';
import { sameEquationClaim } from '../src/engine/reason-v2-safe.js';
import {
  GRADE,
  gradeFor,
  scheduleReview,
  targetSuccess,
  updateRating
} from '../src/engine/adaptive.js';
import {
  TEACHING_MODES,
  adaptiveCheckpointPrompt,
  buildTeachingProfile
} from '../src/explain/adaptiveTeaching.js';
import { chooseNativeConsensus } from '../src/ink/nativeConsensus.js';

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  PASS ${name}`);
  } catch (error) {
    console.error(`  FAIL ${name}`);
    throw error;
  }
}

const symbol = (id, sym, conf = 0.96, rival = 0.03) => ({
  id,
  sym,
  conf,
  alts: [{ sym, conf }, { sym: sym === '3' ? '8' : '?', conf: rival }]
});

const reading = (text, engine, conf = 0.96, margin = 0.70) => ({
  text,
  engine,
  minConf: conf,
  margin,
  lines: [{
    text,
    symbols: [...text].filter(ch => ch !== ' ').map((ch, i) => symbol(`${engine}-${i}`, ch, conf, Math.max(0.01, conf - margin)))
  }]
});

console.log('\nPERSON 1 INTELLIGENCE LOOP CONTRACT\n');

test('independent native agreement may remain authoritative', () => {
  const result = chooseNativeConsensus([
    reading('x=3', 'pri-foundation'),
    reading('x=3', 'pri-native-rescue')
  ]);
  assert.ok(result);
  assert.equal(result.disagreement, false);
  assert.equal(result.text, 'x=3');
  assert.match(result.engine, /^pri-consensus:/);
});

test('engine disagreement destroys auto-mark certainty', () => {
  const result = chooseNativeConsensus([
    reading('x=3', 'pri-foundation'),
    reading('x=8', 'pri-js-v3')
  ]);
  assert.ok(result);
  assert.equal(result.disagreement, true);
  assert.ok(result.minConf <= 0.54, `minConf must force confirmation, got ${result.minConf}`);
  assert.ok(result.margin <= 0.08, `margin must force confirmation, got ${result.margin}`);
  assert.equal(result.candidateReadings.length, 2);
});

test('mathematically equivalent expressions are accepted', () => {
  const q = { answerType: 'expression', answer: { expr: 'x^2+x' } };
  const result = checkAnswer(q, 'x*(x+1)');
  assert.equal(result.correct, true);
});

test('Pri Reason certifies equivalent equation claims', () => {
  const source = parse('2*x+4=10');
  const transformed = parse('2*x=6');
  assert.equal(sameEquationClaim(source, transformed, 'x'), true);
});

test('Step Check locates the first invalid transformation and names it', () => {
  const report = stepCheck(
    { kind: 'equation', variable: 'x', solutions: [3] },
    '2*x+4=10\n2*x=6\nx=4\nx=4'
  );
  assert.equal(report.firstBreak, 2);
  assert.equal(report.lines[0].status, 'ok');
  assert.equal(report.lines[1].status, 'ok');
  assert.equal(report.lines[2].status, 'break');
  assert.equal(report.lines[3].status, 'note');
  assert.ok(report.diagnosis, 'the first broken transition must carry a named diagnosis');
  assert.ok(report.diagnosis.title || report.diagnosis.code, 'diagnosis must be stable/named');
  assert.ok(report.lines[2].note, 'student-facing explanation must exist');
});

test('working marks cannot pass after a broken line even if later text looks final', () => {
  const q = {
    answerType: 'working',
    answer: {
      stepMeta: { kind: 'equation', variable: 'x', solutions: [3] },
      minLines: 2,
      final: { kind: 'solution' }
    }
  };
  const result = checkWorking(q, '2*x+4=10\n2*x=6\nx=4\nx=3');
  assert.equal(result.correct, false);
  assert.equal(result.stepReport.firstBreak, 2);
  assert.ok(result.stepReport.diagnosis);
});

test('adaptive state reacts in the correct direction to evidence', () => {
  const base = 1150;
  const afterWrong = updateRating(base, 8, 2, false, 0);
  const afterCleanCorrect = updateRating(base, 8, 2, true, 0);
  const afterHintedCorrect = updateRating(base, 8, 2, true, 2);
  assert.ok(afterWrong < base);
  assert.ok(afterCleanCorrect > base);
  assert.ok(afterHintedCorrect < afterCleanCorrect);

  const fragileTarget = targetSuccess({ rating: afterWrong, attempts: 8, recentWrong: 2 });
  assert.ok(fragileTarget >= 0.80, `recovery target should favour success, got ${fragileTarget}`);
});

test('review scheduler distinguishes failure, effortful success and fluent success', () => {
  const now = 1_800_000_000_000;
  assert.equal(gradeFor({ correct: false }), GRADE.AGAIN);
  assert.equal(gradeFor({ correct: true, hintsUsed: 1, ms: 50000, difficulty: 2 }), GRADE.HARD);
  assert.equal(gradeFor({ correct: true, hintsUsed: 0, tries: 0, ms: 10000, difficulty: 2 }), GRADE.EASY);

  const again = scheduleReview(null, GRADE.AGAIN, now);
  const easy = scheduleReview(null, GRADE.EASY, now);
  assert.ok(again.intervalDays <= easy.intervalDays);
  assert.ok(again.lapses > easy.lapses);
  assert.ok(again.dueAt > now && easy.dueAt > now);
});

test('Pri Explain turns marker evidence into recovery teaching without changing maths', () => {
  const diagnosis = {
    code: 'arithmetic-slip',
    title: 'Arithmetic slip',
    message: 'The equation stops being true on this line.',
    fix: 'Recheck the arithmetic before continuing.',
    confidence: 'high'
  };
  const timeline = [
    { kind: 'solution', concept: 'algebra', lines: ['2x+4=10'], visuals: [] },
    { kind: 'diagnosis', concept: 'diagnosis', lines: ['2x=6', 'x=4'], visuals: [{ kind: 'attempt' }] },
    { kind: 'solution', concept: 'algebra', lines: ['x=3'], visuals: [{ kind: 'transform' }] }
  ];
  const profile = buildTeachingProfile({
    payload: { correct: false, hadWrongAttempt: true, wrongAttempt: 'x=4', diagnosis },
    studentContext: { year: 10, difficulty: 2, session: { answered: 4, correct: 2 } },
    timeline
  });
  assert.equal(profile.mode, TEACHING_MODES.RECOVERY);
  assert.equal(profile.focus.kind, 'diagnosis');
  assert.equal(profile.focus.label, diagnosis.title);
  assert.equal(profile.importantSceneIndex, 1);
  assert.equal(profile.pauseAtKeyStep, true);
  assert.ok(adaptiveCheckpointPrompt(timeline[1], profile, 1));

  const serialized = JSON.stringify(profile);
  assert.ok(!serialized.includes('expectedAnswer'));
  assert.ok(!serialized.includes('canonicalAnswer'));
});

test('the complete deterministic failure path produces actionable next-state evidence', () => {
  const ink = chooseNativeConsensus([
    reading('x=4', 'pri-foundation'),
    reading('x=4', 'pri-native-rescue')
  ]);
  assert.equal(ink.disagreement, false);

  const marked = checkWorking({
    answerType: 'working',
    answer: {
      stepMeta: { kind: 'equation', variable: 'x', solutions: [3] },
      minLines: 2,
      final: { kind: 'solution' }
    }
  }, '2*x+4=10\n2*x=6\nx=4');
  assert.equal(marked.correct, false);
  assert.ok(marked.stepReport.diagnosis);

  const nextRating = updateRating(1150, 3, 2, false, 0);
  assert.ok(nextRating < 1150);

  const teaching = buildTeachingProfile({
    payload: { correct: false, hadWrongAttempt: true, diagnosis: marked.stepReport.diagnosis },
    studentContext: { year: 10, difficulty: 2, session: { answered: 1, correct: 0 } },
    timeline: [{ kind: 'diagnosis', concept: 'diagnosis', lines: ['x=4'], visuals: [{ kind: 'attempt' }] }]
  });
  assert.equal(teaching.mode, TEACHING_MODES.RECOVERY);
  assert.equal(teaching.focus.kind, 'diagnosis');
});

console.log(`\nPERSON 1 INTELLIGENCE LOOP — PASS (${passed} cross-system contracts)\n`);
