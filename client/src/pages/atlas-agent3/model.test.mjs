import assert from 'node:assert/strict';
import {
  QUESTIONS, authoredErrorMatches, currentDraft, currentQuestion,
  emptyDraft, hasAnswer, initialDemoState, restoreDemo,
  sanitizeDraft, storageEnvelope
} from './model.js';

let checks = 0;
const test = (label, run) => { run(); checks++; process.stdout.write('PASS ' + label + '\n'); };

test('isolated synthetic fixture contains two authored questions', () => {
  assert.equal(QUESTIONS.length, 2);
  assert(QUESTIONS.every(q => q.conceptId === 'linear-equations'));
});
test('no progress inferred for a fresh student', () => {
  const s = initialDemoState();
  assert.equal(s.profile, 'new');
  assert.deepEqual(s.drafts, {});
  assert.equal(s.status, 'unsubmitted');
  assert.equal(s.view, 'paper');
});
test('old or malformed storage is ignored', () => {
  assert.deepEqual(restoreDemo('{bad'), initialDemoState());
  assert.deepEqual(restoreDemo('{"version":0}'), initialDemoState());
});
test('pending work cannot masquerade as a persisted result', () => {
  const s = initialDemoState();
  s.status = 'pending';
  assert.equal(restoreDemo(storageEnvelope(s)).status, 'unsubmitted');
});
test('inconsistent stale Insight view never produces a blank route', () => {
  const s = initialDemoState();
  s.view = 'insight';
  s.status = 'pending';
  assert.equal(restoreDemo(storageEnvelope(s)).view, 'paper');
});
test('safe restore clamps arbitrary injected content and navigation', () => {
  const s = initialDemoState();
  s.questionIndex = 999;
  s.outcome = 'not-a-state';
  s.drafts = { [QUESTIONS[0].id]: { working: 'a'.repeat(9000), answer: 3, strokes: [[[1,2],[3,4]], [[NaN,1]]] }, other: { answer: 'untrusted' } };
  const got = restoreDemo(storageEnvelope(s));
  assert.equal(got.questionIndex, 1);
  assert.equal(got.outcome, 'result');
  assert.equal(Object.keys(got.drafts).length, 1);
  assert.equal(got.drafts[QUESTIONS[0].id].working.length, 1800);
  assert.equal(got.drafts[QUESTIONS[0].id].answer, '');
  assert.equal(got.drafts[QUESTIONS[0].id].strokes.length, 1);
});
test('working, final value or own strokes is enough to demonstrate submission', () => {
  assert.equal(hasAnswer(emptyDraft()), false);
  assert(hasAnswer({ ...emptyDraft(), answer: 'x=3' }));
  assert(hasAnswer({ ...emptyDraft(), working: '6x=18' }));
  assert(hasAnswer({ ...emptyDraft(), strokes: [[[1,1],[2,2]]] }));
});
test('mathematical error diagnosis is restricted to exact fixture', () => {
  const q = QUESTIONS[0];
  const exact = { ...emptyDraft(), working: q.errorExample.working, answer: q.errorExample.answer };
  assert(authoredErrorMatches(q, exact));
  assert(!authoredErrorMatches(q, { ...exact, working: '6x - 3 = 15\n6x = 18\nx = 3' }));
  assert(!authoredErrorMatches(QUESTIONS[1], exact));
});
test('question and draft restore by stable ID', () => {
  const s = initialDemoState('returning');
  s.questionIndex = 1;
  s.drafts[QUESTIONS[1].id] = { working: 'x-2=4', answer: 'x=6', strokes: [] };
  const restored = restoreDemo(storageEnvelope(s));
  assert.equal(currentQuestion(restored).id, QUESTIONS[1].id);
  assert.equal(currentDraft(restored).answer, 'x=6');
  assert.equal(restored.profile, 'returning');
});
test('pointer-surface input sanitization caps finite coordinates', () => {
  const d = sanitizeDraft({ strokes: [[[1000,-20],[2,3],[4,5]]] });
  assert.deepEqual(d.strokes[0][0], [800,0]);
});
console.log('Atlas Agent 3: ' + checks + '/' + checks + ' deterministic model checks passed.');
