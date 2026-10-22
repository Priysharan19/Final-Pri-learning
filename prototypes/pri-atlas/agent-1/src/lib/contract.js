/**
 * PRI ATLAS mock contract — version 1.
 * Deliberately separate from production endpoints and grading authority.
 * Future implementations must adapt real, authenticated API responses into
 * this contract; they must not infer outcomes from concept colours or labels.
 */
export const CONTRACT_VERSION = 1;
export const SUBJECTS = ['mathematics', 'physics', 'chemistry'];
export const DESTINATIONS = ['command', 'atlas', 'laboratory', 'paper', 'insight'];
export const GRAPH_LAYERS = ['prerequisites', 'related', 'applications'];

export function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function expect(condition, message) {
  if (!condition) throw new TypeError('ATLAS contract: ' + message);
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validateAtlasData(data) {
  expect(isRecord(data), 'root object required');
  expect(data.version === CONTRACT_VERSION, 'unknown contract version');
  expect(data.synthetic === true, 'prototype may only accept explicitly synthetic data');
  expect(isRecord(data.student), 'student object required');
  expect(data.student.isDemo === true, 'student must be a demo persona');
  expect(nonEmpty(data.student.label), 'demo student label required');
  expect(SUBJECTS.includes(data.student.defaultSubject), 'invalid default subject');
  for (const key of ['concepts', 'edges', 'questions', 'attempts', 'evidence']) {
    expect(Array.isArray(data[key]), key + ' must be an array');
  }
  const concepts = new Set();
  for (const c of data.concepts) {
    expect(isRecord(c) && nonEmpty(c.id) && nonEmpty(c.title), 'invalid concept');
    expect(SUBJECTS.includes(c.subject), 'invalid concept subject: ' + c.id);
    expect(nonEmpty(c.chapter) && Number.isFinite(c.x) && Number.isFinite(c.y), 'invalid concept geometry');
    expect(!concepts.has(c.id), 'duplicate concept: ' + c.id);
    concepts.add(c.id);
  }
  const edges = new Set();
  for (const e of data.edges) {
    expect(isRecord(e) && nonEmpty(e.id) && GRAPH_LAYERS.includes(e.layer), 'invalid edge');
    expect(concepts.has(e.from) && concepts.has(e.to), 'edge references unknown concept');
    expect(!edges.has(e.id), 'duplicate edge');
    edges.add(e.id);
  }
  const questions = new Set();
  for (const q of data.questions) {
    expect(nonEmpty(q.id) && concepts.has(q.conceptId), 'invalid question');
    expect(nonEmpty(q.prompt) && nonEmpty(q.kind), 'invalid question content');
    expect(!questions.has(q.id), 'duplicate question');
    questions.add(q.id);
  }
  const attempts = new Set();
  for (const a of data.attempts) {
    expect(nonEmpty(a.id) && questions.has(a.questionId), 'invalid attempt');
    expect(['paused', 'submitted', 'draft'].includes(a.status), 'invalid attempt status');
    expect(!attempts.has(a.id), 'duplicate attempt');
    attempts.add(a.id);
  }
  for (const e of data.evidence) {
    expect(isRecord(e) && nonEmpty(e.id) && concepts.has(e.conceptId), 'invalid evidence');
    expect(e.source === 'synthetic', 'demo evidence must declare synthetic provenance');
    expect(Number.isInteger(e.questionsSeen) && e.questionsSeen >= 0, 'invalid evidence denominator');
    expect(Number.isInteger(e.correct) && e.correct >= 0 && e.correct <= e.questionsSeen, 'invalid evidence numerator');
    expect(Number.isInteger(e.minimumForAccuracy) && e.minimumForAccuracy > 0, 'invalid reporting floor');
  }
  expect(isRecord(data.nextAction), 'missing next action');
  expect(nonEmpty(data.nextAction.label) && nonEmpty(data.nextAction.reason), 'next action needs label and reason');
  expect(['sample-resume', 'sample-start'].includes(data.nextAction.kind), 'next action must be marked as demonstration');
  if (data.nextAction.attemptId) {
    expect(attempts.has(data.nextAction.attemptId), 'next action references unknown attempt');
  }
  return data;
}

/** No rounded percentages where denominator is below the evidence floor. */
export function displayAccuracy(evidence) {
  if (!evidence || evidence.questionsSeen < evidence.minimumForAccuracy) return null;
  return Math.round(100 * evidence.correct / evidence.questionsSeen);
}

export function normalizeContext(search) {
  const params = new URLSearchParams(search || '');
  const subject = SUBJECTS.includes(params.get('subject')) ? params.get('subject') : 'mathematics';
  const concept = params.get('concept') || null;
  return { subject, concept };
}

export function destinationHref(destination, context = {}) {
  if (!DESTINATIONS.includes(destination)) throw new TypeError('Unknown destination');
  const params = new URLSearchParams();
  if (SUBJECTS.includes(context.subject)) params.set('subject', context.subject);
  if (typeof context.concept === 'string' && context.concept) params.set('concept', context.concept);
  return '/' + (destination === 'command' ? '' : destination) + (params.size ? '?' + params.toString() : '');
}
