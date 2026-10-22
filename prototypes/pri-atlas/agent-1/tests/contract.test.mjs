import test from 'node:test';
import assert from 'node:assert/strict';
import { demoData } from '../src/lib/demoData.js';
import { validateAtlasData, displayAccuracy, destinationHref, normalizeContext } from '../src/lib/contract.js';

test('demo contract is valid, explicitly synthetic and contains unique concepts', () => {
  assert.equal(validateAtlasData(demoData), demoData);
  assert.equal(demoData.synthetic, true);
  assert.equal(demoData.student.isDemo, true);
});

test('rejects non-synthetic datasets rather than misrepresenting evidence', () => {
  assert.throws(() => validateAtlasData({ ...demoData, synthetic: false }), /synthetic/);
});

test('rejects broken edges and evidence outside valid denominators', () => {
  const brokenEdge = { ...demoData, edges: [{ ...demoData.edges[0], to: 'not-real' }] };
  assert.throws(() => validateAtlasData(brokenEdge), /unknown concept/);
  const badEvidence = { ...demoData, evidence: [{ ...demoData.evidence[0], correct: 100 }] };
  assert.throws(() => validateAtlasData(badEvidence), /invalid evidence numerator/);
});

test('withholds accuracy when sample is below demonstration evidence floor', () => {
  assert.equal(displayAccuracy(demoData.evidence[0]), null);
  assert.equal(displayAccuracy(demoData.evidence[1]), 75);
  assert.equal(displayAccuracy(null), null);
});

test('validates preserved subject and concept in deep-link URL', () => {
  assert.deepEqual(normalizeContext('?subject=physics&concept=motion'), { subject: 'physics', concept: 'motion' });
  assert.deepEqual(normalizeContext('?subject=garbage'), { subject: 'mathematics', concept: null });
  assert.equal(destinationHref('atlas', { subject: 'mathematics', concept: 'algebra' }), '/atlas?subject=mathematics&concept=algebra');
  assert.equal(destinationHref('command', { subject: 'chemistry' }), '/?subject=chemistry');
  assert.throws(() => destinationHref('invalid'), /Unknown destination/);
});

test('paused sample next action resolves to an existing attempt', () => {
  const sample = demoData.attempts.find(a => a.id === demoData.nextAction.attemptId);
  assert.equal(sample?.status, 'paused');
  const question = demoData.questions.find(q => q.id === sample?.questionId);
  assert.equal(question?.conceptId, demoData.nextAction.conceptId);
});
