import assert from 'node:assert/strict';
import fs from 'node:fs';

// Cloud transport contract: every classroom/CMS/admin operation stays behind the
// one audited HTTP boundary and mutations carry CSRF/session credentials.
globalThis.__PRI_CLOUD_ORIGIN__ = 'https://cloud.pri.example';
globalThis.document = { cookie: 'pri_csrf=test-csrf' };
globalThis.location = { origin: 'https://app.pri.example' };
if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, 'crypto', {
    value: { randomUUID: () => 'req-test' },
    configurable: true
  });
}

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
const { assignmentSubmissions } = await import('../src/platform/assignmentReview.js');
const {
  assignmentProgressSummary, assignmentQuestionTarget, assignmentSessionFromSubmission
} = await import('../src/platform/assignmentProgress.js');

await cloud.assignments();
await cloud.assignmentDetails('cls_demo', 'asn_demo');
await cloud.updateSubmission('cls_demo', 'asn_demo', {
  state: 'started',
  summary: { kind: 'practice', questionsAnswered: 3, correct: 2, xp: 20, targetQuestions: 10 }
});
await assignmentSubmissions('cls_demo', 'asn_demo');
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
  '/v1/assignments/cls_demo/asn_demo/submissions',
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
for (const index of [2, 5, 6, 7, 8, 11]) {
  assert.equal(calls[index].options.headers['X-Pri-CSRF'], 'test-csrf');
}
assert.equal(calls[2].options.method, 'PATCH');
assert.equal(calls[5].options.method, 'POST');
assert.equal(calls[11].options.method, 'PATCH');

const progressBody = JSON.parse(calls[2].options.body);
const progressJson = JSON.stringify(progressBody);
for (const forbidden of ['"answer"', '"steps"', '"ink"', '"strokes"', '"prompt"', '"solution"']) {
  assert.equal(progressJson.includes(forbidden), false, `assignment progress must not include ${forbidden}`);
}
assert.deepEqual(Object.keys(progressBody.summary).sort(), ['correct', 'kind', 'questionsAnswered', 'targetQuestions', 'xp'].sort());

let rejected = false;
try { await cloud.assignmentDetails('../admin', 'asn_demo'); } catch { rejected = true; }
assert.equal(rejected, true, 'assignment ids/classes must not escape the audited path');
rejected = false;
try { await assignmentSubmissions('cls/demo', 'asn_demo'); } catch { rejected = true; }
assert.equal(rejected, true, 'staff review ids must not escape the audited path');

assert.equal(assignmentQuestionTarget({ questionCount: 80 }), 50);
assert.deepEqual(assignmentSessionFromSubmission({
  state: 'started', summary: { questionsAnswered: 6, correct: 4, xp: 55 }
}, 10), { answered: 6, correct: 4, xp: 55 });
assert.deepEqual(assignmentProgressSummary({ answered: 12, correct: 20, xp: 50 }, 10), {
  kind: 'practice', questionsAnswered: 10, correct: 10, xp: 50, targetQuestions: 10
});

// Product source contract: assignment Practice uses the existing local Practice
// engine and reports only aggregate progress to the cloud. Handwriting/marking
// remain on QuestionCard + local api.post('/practice/next').
const practice = fs.readFileSync(new URL('../src/pages/PracticeBase.jsx', import.meta.url), 'utf8');
assert.match(practice, /cloud\.assignmentDetails\(/);
assert.match(practice, /api\.post\('\/practice\/next'/);
assert.match(practice, /cloud\.updateSubmission\(/);
assert.match(practice, /assignmentSessionFromSubmission\(/);
assert.match(practice, /assignmentTargetReached\.current/);
assert.match(practice, /Retry submission/);
assert.match(practice, /Teacher feedback/);
assert.doesNotMatch(practice, /summary:\s*\{[^}]*strokes:/s);
assert.doesNotMatch(practice, /summary:\s*\{[^}]*answer:/s);
assert.doesNotMatch(practice, /summary:\s*\{[^}]*steps:/s);

const classesPage = fs.readFileSync(new URL('../src/pages/Classes.jsx', import.meta.url), 'utf8');
assert.match(classesPage, /AssignmentInboxPanel/);
assert.match(classesPage, /Offline class packs/);

const classroom = fs.readFileSync(new URL('../src/components/ClassroomPanel.jsx', import.meta.url), 'utf8');
assert.match(classroom, /assignmentSubmissions\(/);
assert.match(classroom, /Review submissions/);
assert.match(classroom, /Return for revision/);
assert.match(classroom, /Student answers and handwriting/);

console.log('PASS — assignments resume safely, staff can review/return aggregate submissions, Classes exposes the inbox, and handwriting/answers stay outside classroom sync.');
