import assert from 'node:assert/strict';

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

await cloud.classes();
await cloud.classDetails('cls_demo');
await cloud.classStudents('cls_demo');
await cloud.createClass('Class 10 Mathematics');
await cloud.joinClass('ABC123');
await cloud.createAssignment('cls_demo', {
  title: 'Linear equations',
  specification: { kind: 'practice', instructions: 'Show full working.', questionCount: 10 },
  dueAt: 1900000000000
});
await cloud.updateSubmission('cls_demo', 'asn_demo', { state: 'started', summary: {} });
await cloud.returnSubmission('cls_demo', 'asn_demo', 'acct_student', { message: 'Check step 2.' });

assert.deepEqual(calls.map(call => new URL(call.url).pathname), [
  '/v1/classes',
  '/v1/classes/cls_demo',
  '/v1/classes/cls_demo/students',
  '/v1/classes',
  '/v1/classes/join',
  '/v1/classes/cls_demo/assignments',
  '/v1/classes/cls_demo/assignments/asn_demo/submission',
  '/v1/classes/cls_demo/assignments/asn_demo/submissions/acct_student/return'
]);

assert.equal(calls[0].options.method, 'GET');
for (const call of calls.slice(3)) {
  assert.equal(call.options.credentials, 'include');
  assert.equal(call.options.headers['X-Pri-CSRF'], 'test-csrf');
}
assert.equal(calls[3].options.method, 'POST');
assert.deepEqual(JSON.parse(calls[3].options.body), { name: 'Class 10 Mathematics' });
assert.equal(calls[6].options.method, 'PATCH');
assert.equal(calls[7].options.method, 'POST');

// The teacher workspace (server/platform/classroom.js): the same audited boundary.
calls.length = 0;
await cloud.classJoinCode('cls_demo');
await cloud.classroomMine();
await cloud.handInPaper('cls_demo', 'asn_demo', '0f8fad5b-d9cb-469f-a165-70867728950e');
await cloud.boardCourses();
await cloud.classBoard('cls_demo', 'k10-stage4');
await cloud.classBoard('cls_demo', 'k10-stage4', 'MA4-INT-C-01');
await cloud.paperResults('cls_demo', 'asn_demo');
const csv = await cloud.paperResultsCsv('cls_demo', 'asn_demo');
await cloud.classReviewQueue('cls_demo');
await cloud.classReviewQueue('cls_demo', 'decided');
await cloud.classReviewDecide('cls_demo', 'rvw_1', { decision: 'award', marks: 1 });
await cloud.classReviewHistory('cls_demo', 'rvw_1');
assert.deepEqual(calls.map(call => { const u = new URL(call.url); return u.pathname + u.search; }), [
  '/v1/classes/cls_demo/join-code',
  '/v1/classroom/mine',
  '/v1/classroom/classes/cls_demo/assignments/asn_demo/hand-in',
  '/v1/classroom/board/courses',
  '/v1/classroom/classes/cls_demo/board?course=k10-stage4',
  '/v1/classroom/classes/cls_demo/board?course=k10-stage4&node=MA4-INT-C-01',
  '/v1/classroom/classes/cls_demo/assignments/asn_demo/results',
  '/v1/classroom/classes/cls_demo/assignments/asn_demo/results.csv',
  '/v1/classroom/classes/cls_demo/review',
  '/v1/classroom/classes/cls_demo/review?state=decided',
  '/v1/classroom/classes/cls_demo/review/rvw_1',
  '/v1/classroom/classes/cls_demo/review/rvw_1/history'
]);
assert.equal(csv, '{}', 'a CSV export is returned as the file text, not parsed');
assert.equal(calls[2].options.method, 'POST');
assert.deepEqual(JSON.parse(calls[2].options.body), { examId: '0f8fad5b-d9cb-469f-a165-70867728950e' });
assert.equal(calls[10].options.method, 'POST');
assert.equal(calls[10].options.headers['X-Pri-CSRF'], 'test-csrf');
for (const bad of [['cls_demo', 'k10 stage4'], ['cls_demo', 'x', 'a&b=c'], ['cls_demo', '']]) {
  let refused = false;
  try { await cloud.classBoard(...bad); } catch { refused = true; }
  assert.equal(refused, true, `a query value outside the plain-id set is refused (${JSON.stringify(bad)})`);
}

let rejected = false;
try { await cloud.classDetails('../admin'); } catch { rejected = true; }
assert.equal(rejected, true, 'class ids must not escape the audited cloud path');

console.log('PASS — classroom and teacher-workspace UI operations stay inside the authenticated audited cloud transport boundary; queries and the CSV export are named, plain-id parameters on a browser GET only.');
