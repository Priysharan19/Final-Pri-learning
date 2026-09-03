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

let rejected = false;
try { await cloud.classDetails('../admin'); } catch { rejected = true; }
assert.equal(rejected, true, 'class ids must not escape the audited cloud path');

console.log('PASS — classroom UI operations stay inside the authenticated audited cloud transport boundary.');
