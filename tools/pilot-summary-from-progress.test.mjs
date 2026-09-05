import assert from 'node:assert/strict';
import { buildPilotSummary } from './pilot-summary-from-progress.mjs';

const source = {
  format: 'pri-progress',
  version: 1,
  exportedAt: 1788710400000,
  student: { name: 'Sensitive Student Name', year: 10, avatar: '🙂' },
  predicted: { mark: 77 },
  streak: 9,
  totals: { attempts: 40, correct: 30 },
  ratings: { secretTopic: { rating: 1234, attempts: 40, correct: 30 } },
  taskProgress: [
    { taskId: 'private-task-1', done: 10, correct: 8, finished: true },
    { taskId: 'private-task-2', done: 5, correct: 3, finished: false }
  ]
};

const out = buildPilotSummary(source, { participant: 'S042', baseline: 62.5, post: 74 });
assert.equal(out.schema, 'pri-pilot-summary-v1');
assert.equal(out.participant, 'S042');
assert.equal(out.attempts, 40);
assert.equal(out.correctAttempts, 30);
assert.equal(out.accuracy, 0.75);
assert.deepEqual(out.tasks, { total: 2, completed: 1, questionsDone: 15, correct: 11 });
assert.equal(out.changePercentagePoints, 11.5);

const serialized = JSON.stringify(out);
for (const forbidden of ['Sensitive Student Name', 'secretTopic', 'private-task-1', 'student', 'ratings', 'taskId']) {
  assert.equal(serialized.includes(forbidden), false, `output leaked ${forbidden}`);
}

const zero = buildPilotSummary({ format: 'pri-progress', version: 1, totals: { attempts: 0, correct: 0 }, taskProgress: [] }, { participant: 'S000' });
assert.equal(zero.accuracy, null);
assert.equal(zero.baseline, null);
assert.equal(zero.post, null);

assert.throws(() => buildPilotSummary(source, { participant: '../escape' }), /participant/);
assert.throws(() => buildPilotSummary({ ...source, format: 'other' }, { participant: 'S1' }), /supported/);
assert.throws(() => buildPilotSummary(source, { participant: 'S1', baseline: 101 }), /baseline/);
assert.throws(() => buildPilotSummary({ ...source, totals: { attempts: 4, correct: 5 } }, { participant: 'S1' }), /totals.correct/);

console.log('pilot-summary-from-progress: all checks passed');
