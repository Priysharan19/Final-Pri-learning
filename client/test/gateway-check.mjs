// Pri Learning · production local API gateway checks
// These tests exercise the exact validation/diagnostic module imported by
// client/src/api.js. No browser and no network are required.

import {
  apiDiagnostics, beginRequest, clearApiDiagnostics, finishRequest,
  normalizeApiError, validateRequest
} from '../src/local/gateway.js';

let pass = 0;
let fail = 0;
const failures = [];

function ok(name, condition, detail = '') {
  if (condition) { pass++; return; }
  fail++;
  failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
}

function same(name, actual, expected) {
  ok(name, JSON.stringify(actual) === JSON.stringify(expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function throws(name, fn, { status, code } = {}) {
  try {
    fn();
    ok(name, false, 'did not throw');
  } catch (err) {
    ok(name, status === undefined || err.status === status, `status ${err.status}`);
    if (code !== undefined) ok(`${name} · code`, err.code === code, `code ${err.code}`);
  }
}

// ── good traffic ─────────────────────────────────────────────────────────────

same('GET /me passes', validateRequest('GET', '/me').path, '/me');
same('method is canonicalised', validateRequest('post', '/profiles/demo', {}).method, 'POST');
same('normal profile create passes', validateRequest('POST', '/profiles', {
  name: 'Ada', year: 10, email: 'ada@example.test', provider: 'email', password: 'correct horse battery staple'
}).path, '/profiles');
same('practice request passes', validateRequest('POST', '/practice/next', {
  mode: 'topic', subtopic: 'y10-trig', difficulty: 3, dotpoint: 'y10-trig.1'
}).path, '/practice/next');
same('ink submit passes', validateRequest('POST', '/practice/a1-b2/submit', {
  answer: '4', ms: 1200, viaInk: true,
  ink: { strokes: [{ points: [{ x: 1, y: 2 }, { x: 3, y: 4 }] }], recognized: '4' }
}).path, '/practice/a1-b2/submit');
same('exam submit passes', validateRequest('POST', '/exams/paper-1/submit', {
  answers: { q1: '2' }, workings: { q1: '1+1=2' }, ms: 10000
}).path, '/exams/paper-1/submit');
same('class roll passes', validateRequest('POST', '/classes/class-1/students', {
  add: ['student-1'], remove: ['student-2']
}).path, '/classes/class-1/students');
same('task passes', validateRequest('POST', '/tasks', {
  classId: 'class-1', title: 'Trig', subtopics: ['y10-trig'], count: 10
}).path, '/tasks');
same('backup import passes structurally', validateRequest('POST', '/data/import', {
  format: 'pri-learning-backup', profile: { name: 'Ada' }, stores: { attempts: [] }
}).path, '/data/import');
same('task pack passes structurally', validateRequest('POST', '/tasks/import-pack', {
  format: 'pri-task-pack', task: { title: 'HW' }, customQs: []
}).path, '/tasks/import-pack');
same('progress import passes structurally', validateRequest('POST', '/classes/c1/import-progress', {
  format: 'pri-progress', student: { name: 'Ada' }
}).path, '/classes/c1/import-progress');
same('custom question passes structurally', validateRequest('POST', '/custom-questions', {
  name: 'Check', prompt: '2+2?', answerType: 'numeric', answer: { value: 4 }, difficulty: 1
}).path, '/custom-questions');

// ── path boundary ────────────────────────────────────────────────────────────

throws('rejects relative paths', () => validateRequest('GET', 'me'), { status: 400, code: 'INVALID_PATH' });
throws('rejects query strings', () => validateRequest('GET', '/me?x=1'), { status: 400, code: 'INVALID_PATH' });
throws('rejects fragments', () => validateRequest('GET', '/me#x'), { status: 400, code: 'INVALID_PATH' });
throws('rejects backslashes', () => validateRequest('GET', '/me\\x'), { status: 400, code: 'INVALID_PATH' });
throws('rejects traversal', () => validateRequest('GET', '/../me'), { status: 400, code: 'INVALID_PATH' });
throws('rejects encoded traversal', () => validateRequest('GET', '/%2e%2e/me'), { status: 400, code: 'INVALID_PATH' });
throws('rejects bad percent encoding', () => validateRequest('GET', '/%QQ'), { status: 400, code: 'INVALID_PATH' });
throws('rejects trailing slash', () => validateRequest('GET', '/me/'), { status: 400, code: 'INVALID_PATH' });
throws('rejects control chars', () => validateRequest('GET', '/me\n'), { status: 400, code: 'INVALID_PATH' });
throws('rejects unsupported methods', () => validateRequest('DELETE', '/me'), { status: 405, code: 'METHOD_NOT_ALLOWED' });
throws('GET cannot smuggle a body', () => validateRequest('GET', '/me', { x: 1 }), { status: 400, code: 'GET_BODY' });

// ── deep object safety ───────────────────────────────────────────────────────

const polluted = Object.create(null);
polluted.__proto__ = { admin: true };
throws('rejects prototype pollution keys', () => validateRequest('POST', '/profiles/demo', polluted), { status: 400, code: 'UNSAFE_KEY' });
throws('rejects constructor pollution keys', () => validateRequest('POST', '/profiles/demo', { constructor: { prototype: { admin: true } } }), { status: 400, code: 'UNSAFE_KEY' });
throws('rejects prototype keys', () => validateRequest('POST', '/profiles/demo', { prototype: {} }), { status: 400, code: 'UNSAFE_KEY' });
throws('rejects non-finite numbers', () => validateRequest('POST', '/profiles/demo', { x: Infinity }), { status: 400, code: 'INVALID_NUMBER' });
throws('rejects functions', () => validateRequest('POST', '/profiles/demo', { x: () => 1 }), { status: 400, code: 'INVALID_BODY' });
throws('rejects dates/non-plain objects', () => validateRequest('POST', '/profiles/demo', { x: new Date() }), { status: 400, code: 'INVALID_BODY' });
const circular = {}; circular.self = circular;
throws('rejects cycles', () => validateRequest('POST', '/profiles/demo', circular), { status: 400, code: 'INVALID_BODY' });
let deep = {};
for (let i = 0; i < 25; i++) deep = { x: deep };
throws('rejects excessive nesting', () => validateRequest('POST', '/profiles/demo', deep), { status: 413, code: 'BODY_TOO_COMPLEX' });
throws('rejects oversized arrays', () => validateRequest('POST', '/profiles/demo', { x: new Array(10001).fill(0) }), { status: 413, code: 'FIELD_TOO_LARGE' });
throws('rejects huge strings early', () => validateRequest('POST', '/profiles/demo', { x: 'a'.repeat(4 * 1024 * 1024 + 1) }), { status: 413, code: 'FIELD_TOO_LARGE' });

// ── route contracts ─────────────────────────────────────────────────────────

throws('profile select requires id', () => validateRequest('POST', '/profiles/select', {}), { status: 400, code: 'MISSING_FIELD' });
throws('profile select rejects malformed id', () => validateRequest('POST', '/profiles/select', { id: '../x' }), { status: 400, code: 'INVALID_ID' });
throws('profile password rejects object password', () => validateRequest('POST', '/profiles/password', { current: {} }), { status: 400, code: 'INVALID_FIELD' });
throws('profile create rejects giant password', () => validateRequest('POST', '/profiles', { password: 'x'.repeat(1025) }), { status: 413, code: 'FIELD_TOO_LARGE' });
throws('PATCH /me rejects object email', () => validateRequest('PATCH', '/me', { email: {} }), { status: 400, code: 'INVALID_FIELD' });
throws('practice next rejects object subtopic', () => validateRequest('POST', '/practice/next', { subtopic: {} }), { status: 400, code: 'INVALID_ID' });
throws('practice submit rejects object steps', () => validateRequest('POST', '/practice/q1/submit', { steps: {} }), { status: 400, code: 'INVALID_FIELD' });
throws('practice submit rejects array ink', () => validateRequest('POST', '/practice/q1/submit', { ink: [] }), { status: 400, code: 'INVALID_FIELD' });
throws('exam submit rejects answer array', () => validateRequest('POST', '/exams/e1/submit', { answers: [] }), { status: 400, code: 'INVALID_FIELD' });
throws('exam submit bounds answer map', () => validateRequest('POST', '/exams/e1/submit', { answers: Object.fromEntries(Array.from({ length: 121 }, (_, i) => [`q${i}`, i])) }), { status: 413, code: 'FIELD_TOO_LARGE' });
throws('class roll bounds membership list', () => validateRequest('POST', '/classes/c1/students', { add: new Array(201).fill('a') }), { status: 400, code: 'INVALID_FIELD' });
throws('class roll checks every id', () => validateRequest('POST', '/classes/c1/students', { add: ['ok', '../bad'] }), { status: 400, code: 'INVALID_ID' });
throws('tasks reject object title', () => validateRequest('POST', '/tasks', { title: {} }), { status: 400, code: 'INVALID_FIELD' });
throws('tasks bound subtopic list', () => validateRequest('POST', '/tasks', { subtopics: new Array(101).fill('topic') }), { status: 400, code: 'INVALID_FIELD' });
throws('history list rejects object filter', () => validateRequest('POST', '/history/list', { filter: {} }), { status: 400, code: 'INVALID_FIELD' });
throws('backup import rejects array profile', () => validateRequest('POST', '/data/import', { profile: [] }), { status: 400, code: 'INVALID_FIELD' });
throws('backup import rejects array stores', () => validateRequest('POST', '/data/import', { stores: [] }), { status: 400, code: 'INVALID_FIELD' });
throws('task pack rejects object customQs', () => validateRequest('POST', '/tasks/import-pack', { customQs: {} }), { status: 400, code: 'INVALID_FIELD' });
throws('progress import rejects student array', () => validateRequest('POST', '/classes/c1/import-progress', { student: [] }), { status: 400, code: 'INVALID_FIELD' });
throws('custom question rejects answer array', () => validateRequest('POST', '/custom-questions', { answer: [] }), { status: 400, code: 'INVALID_FIELD' });
throws('match start rejects object rival', () => validateRequest('POST', '/match/start', { rival: {} }), { status: 400, code: 'INVALID_FIELD' });

// ── error/diagnostic behaviour ───────────────────────────────────────────────

const missingStatus = normalizeApiError(new Error('boom'), 'r1');
same('unknown errors become 500', missingStatus.status, 500);
same('unknown errors get a stable code', missingStatus.code, 'INTERNAL_ERROR');
same('request id is attached', missingStatus.requestId, 'r1');
const known = Object.assign(new Error('nope'), { status: 404, code: 'NOT_FOUND', custom: true });
const normalizedKnown = normalizeApiError(known, 'r2');
same('known status is preserved', normalizedKnown.status, 404);
same('known code is preserved', normalizedKnown.code, 'NOT_FOUND');
same('existing error metadata survives', normalizedKnown.custom, true);

clearApiDiagnostics();
const req = beginRequest('POST', '/practice/next');
finishRequest(req, 200);
const rows = apiDiagnostics();
same('one diagnostic is recorded', rows.length, 1);
same('diagnostic carries method', rows[0].method, 'POST');
same('diagnostic carries path', rows[0].path, '/practice/next');
same('diagnostic carries status', rows[0].status, 200);
ok('diagnostic carries non-negative duration', rows[0].durationMs >= 0);
ok('diagnostic contains no request body', !('body' in rows[0]));
ok('diagnostic contains no payload', !('payload' in rows[0]));
rows[0].path = '/tampered';
same('diagnostic reads are copies', apiDiagnostics()[0].path, '/practice/next');
clearApiDiagnostics();
same('diagnostics can be cleared', apiDiagnostics().length, 0);

console.log(`\nProduction API gateway — ${pass}/${pass + fail} checks`);
if (failures.length) {
  console.log('\nfailures:');
  for (const line of failures) console.log(`  ${line}`);
}
console.log(`\n${fail ? '✖ GATEWAY SUITE FAILED' : '✔ GATEWAY SUITE PASSED'} — ${pass}/${pass + fail} checks`);
process.exit(fail ? 1 : 0);
