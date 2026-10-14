// Source-contract and deterministic display tests for Photo's first mistake.
// A fixture report is not certification that the production mathematical
// checker can produce this report for a real authenticated issued question.
import assert from 'node:assert/strict';
import { verifiedPhotoStepFeedback } from '../src/photo/stepFeedback.js';

let passed = 0;
const pass = (name, callback) => { callback(); console.log('PASS:', name); passed++; };
const work = [
  'a = 9, d = 3',
  'T_n = a + (n - 1)d',
  'T_9 = 9 + 8 × 3',
  '= 9 + 24',
  '= 35',
  '= 35, so I am done'
];
const transcript = { lines: [
  { text: 'Old notes unrelated to the question', excluded: true },
  ...work.map(text => ({ text, excluded: false }))
]};
const submitted = {
  sourceMode: 'photo', hasWorking: true, lines: work.slice()
};
const response = {
  authoritative: true,
  stepReport: { lines: work.map((text, i) => ({
    text, status: i < 4 ? 'ok' : i === 4 ? 'break' : 'ok',
    note: i === 4 ? 'The last addition should give 33, not 35.' : ''
  })) }
};
const review = (overrides = {}) => verifiedPhotoStepFeedback({
  response, submitted, transcript, live: true, resolved: true, ...overrides
});
pass('AP first mathematical break is the 35 line, with original photo line index preserved', () => {
  const v = review();
  assert.equal(v.length, transcript.lines.length);
  assert.equal(v[0], null);
  assert.deepEqual(v.slice(1, 5).map(x => x?.status), ['ok', 'ok', 'ok', 'ok']);
  assert.equal(v[5].status, 'break');
  assert.match(v[5].note, /33.*35/);
  assert.equal(v[6], null, 'do not claim verified later independent workings');
});
pass('before resolution report can identify a break without revealing answer', () => {
  const v = review({ resolved: false });
  assert.equal(v[5].status, 'break');
  assert.equal(v[5].note, '');
});
pass('valid corrected calculation gives no mistake', () => {
  const fixed = work.map(s => s === '= 35' ? '= 33' : s);
  const saved = { ...submitted, lines: fixed };
  const photo = { lines: [{ text: 'Notes', excluded: true }, ...fixed.map(text => ({ text }))] };
  const checked = { ...response, stepReport: { lines: fixed.map(text => ({ text, status: 'ok' })) } };
  assert.deepEqual(review({ transcript: photo, submitted: saved, response: checked }).slice(1).map(x => x?.status),
    Array(fixed.length).fill('ok'));
});
pass('edited transcript invalidates prior report', () => {
  const changed = { lines: transcript.lines.map((l, i) => i === 5 ? { ...l, text: '= 33' } : l) };
  assert.equal(review({ transcript: changed }), null);
});
pass('a report for different lines cannot mark a photo', () => {
  const bad = { ...response, stepReport: { lines: response.stepReport.lines.map((l, i) => i === 3 ? { ...l, text: '= 10 + 24' } : l) } };
  assert.equal(review({ response: bad }), null);
});
pass('missing math checker report cannot manufacture a first mistake', () => {
  assert.equal(review({ response: { authoritative: true } }), null);
});
pass('provider transcription or unauthoritative client guess cannot confer ticks', () => {
  assert.equal(review({ response: { ...response, authoritative: false } }), null);
});
pass('original Photo submission required (not typed/ink)', () => {
  assert.equal(review({ submitted: { ...submitted, sourceMode: 'ink' } }), null);
  assert.equal(review({ submitted: { ...submitted, hasWorking: false } }), null);
});
pass('stale revision never shows inline feedback', () => {
  assert.equal(review({ live: false }), null);
});
pass('technical, unread or revealed outcomes suppress step marks', () => {
  for (const attribute of ['invalid', 'technical', 'revealed', 'workingNotRead']) {
    assert.equal(review({ response: { ...response, [attribute]: true } }), null, attribute);
  }
});
pass('excluded lines never receive an annotation', () => {
  const v = review();
  assert.equal(v[0], null);
  assert.equal(v[5].status, 'break');
});
pass('report silently declines unsupported math', () => {
  const unknown = { ...response, stepReport: { lines: work.map(text => ({ text, status: 'unknown' })) } };
  assert.equal(review({ response: unknown }), null);
});
console.log('PHOTO STEP FEEDBACK: PASS', passed, 'deterministic groups');
