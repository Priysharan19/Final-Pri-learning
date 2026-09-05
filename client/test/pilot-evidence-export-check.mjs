import assert from 'node:assert/strict';
import {
  aggregatePilotSummary,
  assertPilotExportAllowed,
  canonicalAttempts,
  DEFAULT_COMPLETION_RULE
} from '../src/local/pilotExport.js';

const atSydneyNoon = date => Date.parse(`${date}T02:00:00Z`);

const attempts = [
  {
    id: 1,
    pid: 'real-profile-id',
    questionId: 'q-1',
    subtopic: 'linear-equations',
    correct: 0,
    answerGiven: 'private wrong answer',
    ms: 12000,
    hintsUsed: 1,
    createdAt: atSydneyNoon('2026-09-16')
  },
  {
    id: 2,
    pid: 'real-profile-id',
    questionId: 'q-1',
    subtopic: 'linear-equations',
    correct: 1,
    answerGiven: 'private corrected answer',
    ms: 8000,
    hintsUsed: 2,
    createdAt: atSydneyNoon('2026-09-16') + 1000
  },
  {
    id: 3,
    pid: 'real-profile-id',
    questionId: 'q-2',
    subtopic: 'quadratics',
    correct: 1,
    answerGiven: 'private answer',
    ms: 18000,
    hintsUsed: 0,
    createdAt: atSydneyNoon('2026-09-17')
  },
  {
    id: 4,
    pid: 'real-profile-id',
    questionId: 'outside',
    subtopic: 'trigonometry',
    correct: 1,
    answerGiven: 'outside answer',
    ms: 99999,
    hintsUsed: 9,
    createdAt: atSydneyNoon('2026-08-01')
  }
];

const activity = [
  { pid: 'real-profile-id', date: '2026-09-16', questions: 2, correct: 1, ms: 20000 },
  { pid: 'real-profile-id', date: '2026-09-17', questions: 1, correct: 1, ms: 18000 },
  { pid: 'real-profile-id', date: '2026-09-18', questions: 0, correct: 0, ms: 0 },
  { pid: 'real-profile-id', date: '2026-08-01', questions: 8, correct: 8, ms: 99999 }
];

const canonical = canonicalAttempts(attempts, '2026-09-15', '2026-10-13');
assert.equal(canonical.length, 2, 'retry must not become another attempted question');
assert.equal(canonical.find(row => row.questionId === 'q-1').correct, 0, 'first recorded submission is canonical');

const summary = aggregatePilotSummary({
  participant: 'S042',
  from: '2026-09-15',
  to: '2026-10-13',
  activityRows: activity,
  attemptRows: attempts,
  baseline: 62,
  post: 74,
  completionRule: { ...DEFAULT_COMPLETION_RULE, minimumActiveDays: 2 },
  generatedAt: '2026-10-13T00:00:00.000Z',
  appCommit: 'test-commit'
});

assert.equal(summary.activeDays, 2);
assert.equal(summary.questionsAttempted, 2);
assert.equal(summary.correctAttempts, 1);
assert.equal(summary.accuracy, 0.5);
assert.equal(summary.practiceMs, 30000);
assert.equal(summary.hintsUsed, 1);
assert.equal(summary.topicsTouched, 2);
assert.equal(summary.baseline, 62);
assert.equal(summary.post, 74);
assert.equal(summary.completed, true);
assert.equal(summary.calculationRules.attemptRule, 'first-recorded-submission-per-question-instance');

const serialized = JSON.stringify(summary);
for (const forbidden of [
  'real-profile-id',
  'answerGiven',
  'private answer',
  'private wrong answer',
  'private corrected answer',
  'name',
  'email',
  'handwriting',
  'photo'
]) {
  assert.equal(serialized.includes(forbidden), false, `export leaked forbidden content: ${forbidden}`);
}

const empty = aggregatePilotSummary({
  participant: 'S043',
  from: '2026-09-15',
  to: '2026-10-13',
  activityRows: [],
  attemptRows: [],
  generatedAt: '2026-10-13T00:00:00.000Z'
});
assert.equal(empty.questionsAttempted, 0);
assert.equal(empty.correctAttempts, 0);
assert.equal(empty.accuracy, null);
assert.equal(empty.completed, false);

assert.throws(
  () => assertPilotExportAllowed({ auth: { verifier: 'sealed' } }, false),
  /protected profile is locked/i
);
assert.equal(assertPilotExportAllowed({ auth: null }, false), true, 'unprotected open profile remains exportable');
assert.equal(assertPilotExportAllowed({ auth: { verifier: 'sealed' } }, true), true, 'unlocked protected profile is exportable');
assert.throws(
  () => aggregatePilotSummary({ participant: 'Kalp Bajpai', from: '2026-09-15', to: '2026-10-13' }),
  /anonymous code/i,
  'participant field must resist direct names/emails by requiring a pseudonymous code'
);

console.log('PASS — pilot evidence export is deterministic, retry-safe, locked-profile aware, and excludes private/raw student data.');
