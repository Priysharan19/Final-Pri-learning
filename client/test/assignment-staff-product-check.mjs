import assert from 'node:assert/strict';
import fs from 'node:fs';

// Cloud transport contract: every classroom/CMS/admin operation stays behind the
// one audited HTTP boundary and mutations carry CSRF/session credentials.
globalThis.__PRI_CLOUD_ORIGIN__ = 'https://cloud.pri.example';
globalThis.document = { cookie: 'pri_csrf=test-csrf' };
globalThis.location = { origin: 'https://app.pri.example' };
globalThis.crypto = { randomUUID: () => 'req-test' };

const calls = [];
globalThis.fetch = async (url, options = {}) => {
  calls.push({ url, options });
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    text: async () => '{}'
  };
};

const { cloud } = await import('../src/platform/cloudTransport.js');

await cloud.assignments();
await cloud.assignmentDetails('cls_demo', 'asn_demo');
await cloud.updateSubmission('cls_demo', 'asn_demo', {
  state: 'started',
  summary: { kind: 'practice', questionsAnswered: 3, correct: 2, xp: 20, targetQuestions: 10 }
});
await cloud.contentRevisions();
await cloud.createContentDraft({ contentKey: 'cbse/class10/demo', curriculumVersion: 'CBSE-2026-27', source: {}, body: {} });
await cloud.submitContentReview('content_demo');
await cloud.approveContent('content_demo');
await cloud.publishContent('content_demo');
await cloud.adminHealth();
await cloud.adminUsers();
await cloud.updateUserRole('acct_demo', 'teacher');
await cloud.adminAudit();

assert.deepEqual(calls.map(call => new URL(call.url).pathname), [
  '/v1/assignments',
  '/v1/assignments/cls_demo/asn_demo',
  '/v1/classes/cls_demo/assignments/asn_demo/submission',
  '/v1/content/admin/revisions',
  '/v1/content/drafts',
  '/v1/content/content_demo/submit-review',
  '/v1/content/content_demo/approve',
  '/v1/content/content_demo/publish',
  '/v1/admin/health',
  '/v1/admin/users',
  '/v1/admin/users/acct_demo/role',
  '/v1/admin/audit'
]);

for (const call of calls) assert.equal(call.options.credentials, 'include');
for (const index of [2, 4, 5, 6, 7, 10]) {
  assert.equal(calls[index].options.headers['X-Pri-CSRF'], 'test-csrf');
}
assert.equal(calls[2].options.method, 'PATCH');
assert.equal(calls[4].options.method, 'POST');
assert.equal(calls[10].options.method, 'PATCH');

const progressBody = JSON.parse(calls[2].options.body);
const progressJson = JSON.stringify(progressBody);
for (const forbidden of ['"answer"', '"steps"', '"ink"', '"strokes"', '"prompt"', '"solution"']) {
  assert.equal(progressJson.includes(forbidden), false, `assignment progress must not include ${forbidden}`);
}
assert.deepEqual(Object.keys(progressBody.summary).sort(), ['correct', 'kind', 'questionsAnswered', 'targetQuestions', 'xp'].sort());

let rejected = false;
try { await cloud.assignmentDetails('../admin', 'asn_demo'); } catch { rejected = true; }
assert.equal(rejected, true, 'assignment ids/classes must not escape the audited path');

// Product source contract: assignment Practice uses the existing local Practice
// engine and reports only aggregate progress to the cloud. Handwriting/marking
// remain on QuestionCard + local api.post('/practice/next').
const practice = fs.readFileSync(new URL('../src/pages/PracticeBase.jsx', import.meta.url), 'utf8');
assert.match(practice, /cloud\.assignmentDetails\(/);
assert.match(practice, /api\.post\('\/practice\/next'/);
assert.match(practice, /cloud\.updateSubmission\(/);
assert.match(practice, /questionsAnswered:/);
assert.match(practice, /correct:/);
assert.match(practice, /xp:/);
assert.doesNotMatch(practice, /summary:\s*\{[^}]*strokes:/s);
assert.doesNotMatch(practice, /summary:\s*\{[^}]*answer:/s);
assert.doesNotMatch(practice, /summary:\s*\{[^}]*steps:/s);

console.log('PASS — assignment execution and staff operations stay behind authorised cloud routes while student answers and handwriting remain outside classroom progress sync.');
