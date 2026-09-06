// Pri Learning · realistic bad state comes back as an error, not a crash.
//
// An unhandled TypeError is not an API result: it has no `status`, so the UI has
// nothing to render and the student sees a blank screen instead of a sentence.
// Three ways to get one, all reachable without doing anything unusual:
//
//   · gateway.validateRequest read a missing body as `{}` — correctly, since
//     every field these routes take is optional — and then handed the handler
//     the original `null` anyway, so the guarantee it had just established
//     never reached the code that relied on it.
//   · an exam lists question ids, and the rows they name can be missing: a
//     restore whose questions store was truncated, or a half-finished delete.
//     examFor() has always skipped those; the printable paper and the marker
//     dereferenced `row.payload` and threw.
//   · safePayload accepted `multipart: true` with no `parts` list, and every
//     reader of a multipart question walks `parts` — History, the exam room and
//     the marker all threw on a row a restore had just written.
//
// Usage: node client/test/bad-input-check.mjs

import { installBrowserEnv, resetStorage } from './backend-check.mjs';

installBrowserEnv();
resetStorage();

const { dispatch } = await import('../src/local/backend.js');
const { validateRequest } = await import('../src/local/gateway.js');
const { api } = await import('../src/api.js');
const idb = await import('../src/local/idb.js');
// This suite talks to dispatch() directly as well as through api.js, so it loads
// the question banks the way src/api.js does before a request reaches the backend.
const { loadAllBanks } = await import('../src/engine/generators/index.js');
await loadAllBanks();

let pass = 0;
let fail = 0;
const failures = [];
const ok = (name, condition, detail = '') => {
  if (condition) { pass++; return true; }
  fail++;
  failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
  return false;
};
const eq = (name, actual, expected) => ok(name, JSON.stringify(actual) === JSON.stringify(expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);

/**
 * The call either returns, or throws something the UI can show. A TypeError, a
 * RangeError or anything without a `status` is the failure this suite is about.
 */
async function shaped(name, run) {
  let value = null;
  let thrown = null;
  try { value = await run(); }
  catch (err) { thrown = err; }
  // Returning is a pass, and so is a 4xx/5xx the UI can put on the screen. Only
  // a raw TypeError/RangeError — or anything else with no status on it — fails.
  ok(name, !thrown || (Number.isInteger(thrown.status) && thrown.status >= 400 && thrown.status <= 599 &&
    !(thrown instanceof TypeError) && !(thrown instanceof RangeError)), `${thrown?.name}: ${thrown?.message}`);
  return value;
}

// ── The gateway hands on what it validated ───────────────────────────────────

for (const [method, path] of [
  ['POST', '/rush/finish'], ['POST', '/match/finish'], ['POST', '/classes'], ['POST', '/tasks'],
  ['POST', '/practice/next'], ['POST', '/history/list'], ['POST', '/profiles']
]) {
  for (const body of [null, undefined]) {
    const checked = validateRequest(method, path, body);
    ok(`${method} ${path} with a ${String(body)} body is handed on as an object`,
      checked.body !== null && typeof checked.body === 'object' && !Array.isArray(checked.body),
      `${method} ${path} forwarded ${JSON.stringify(checked.body)}`);
  }
}

// A route with no contract of its own keeps whatever it was given: the gateway
// only speaks for the routes it actually checked.
ok('a route with no body contract is not silently given an object',
  validateRequest('POST', '/auth/logout', null).body === null,
  JSON.stringify(validateRequest('POST', '/auth/logout', null).body));

await api.post('/profiles', { name: 'Bad Input', year: 10, course: 'nsw' });
for (const path of ['/rush/finish', '/match/finish', '/classes', '/tasks', '/history/list', '/practice/next']) {
  await shaped(`POST ${path} with a null body comes back shaped`, () => api.post(path, null));
}

// ── An exam whose question rows are gone ─────────────────────────────────────

const me = (await dispatch('GET', '/me')).user;
const realExam = (await dispatch('POST', '/exams', { length: 10, minutes: 30 })).exam;
ok('an exam was built to break', realExam.questions.length >= 10, `${realExam.questions.length} questions`);

// Delete half the paper's question rows, exactly as a truncated restore or an
// interrupted delete would leave them.
const stored = await idb.get('exams', realExam.id);
const orphaned = stored.questionIds.slice(0, 5);
for (const qid of orphaned) await idb.del('questions', qid);

const survivors = stored.questionIds.length - orphaned.length;
await shaped('the exam page still opens when half its questions are missing',
  () => dispatch('GET', `/exams/${realExam.id}`));
const paper = await shaped('the printable paper still renders when half its questions are missing',
  () => dispatch('GET', `/exams/${realExam.id}/paper`));
eq('the printable paper prints the questions that are still there', paper?.questions?.length, survivors);
const marked = await shaped('the paper still marks when half its questions are missing',
  () => dispatch('POST', `/exams/${realExam.id}/submit`, { answers: {}, ms: 60000 }));
ok('the marker returns a score out of a real total',
  Number.isFinite(marked?.total) && Number.isFinite(marked?.score) && marked.total > 0,
  JSON.stringify({ score: marked?.score, total: marked?.total }));
eq('the marked detail covers only the questions that exist', marked?.detail?.length, survivors);
ok('a missing question is not marked wrong against the student',
  !!marked && marked.detail.every(d => !orphaned.includes(d.id)),
  JSON.stringify(marked?.detail?.map(d => d.id)));

// ── A multipart question with no parts ───────────────────────────────────────

// A backup can claim `multipart: true` and leave the list off. The importer must
// not store a row that lies about its own shape, and nothing downstream may
// assume `parts` exists on a row an older build already wrote.
const backup = await dispatch('GET', '/data/export');
const partless = structuredClone(backup);
partless.stores.questions = [{
  id: 'q-partless-multipart', pid: 'anything', subtopic: 'custom', difficulty: 2,
  payload: { multipart: true, multipartId: 'made-up', title: 'A structured question', stem: 'Work through the parts below.', totalMarks: 6 },
  mode: 'practice', examId: null, taskId: null, answered: 1, tries: 0, hintsUsed: 0, createdAt: Date.now()
}];
for (const store of Object.keys(partless.stores)) {
  if (store !== 'questions') partless.stores[store] = [];
}
const restored = await shaped('the importer accepts a partless multipart row',
  () => dispatch('POST', '/data/import', partless));
const restoredRow = restored ? (await idb.byIndex('questions', 'pid', restored.user.id))[0] : null;
ok('the importer keeps the row rather than failing the whole restore', !!restoredRow, 'the partless multipart row was dropped');
ok('a stored multipart payload always has the parts list it promises',
  Array.isArray(restoredRow?.payload?.parts), JSON.stringify(restoredRow?.payload?.parts));

await shaped('History lists a partless multipart row without crashing',
  () => dispatch('POST', '/history/list', { pageSize: 50 }));
await shaped('History detail opens a partless multipart row without crashing',
  () => dispatch('GET', `/history/${restoredRow.id}/detail`));

// The same row as an older build would already have written it: no parts key at
// all on disk, so the reader — not the importer — is what has to hold.
const legacyPayload = { multipart: true, multipartId: 'made-up', title: 'A structured question', stem: 'Work through the parts below.', totalMarks: 6 };
await idb.put('questions', { ...restoredRow, payload: legacyPayload });
await shaped('History lists a legacy partless multipart row without crashing',
  () => dispatch('POST', '/history/list', { pageSize: 50 }));
await shaped('History detail opens a legacy partless multipart row without crashing',
  () => dispatch('GET', `/history/${restoredRow.id}/detail`));

const legacyExam = {
  id: 'exam-legacy-partless', pid: restored.user.id, year: 10, pathway: null,
  title: 'Legacy paper', durationMin: 30, questionIds: [restoredRow.id],
  createdAt: Date.now(), finishedAt: null, score: null, total: null, detail: null
};
await idb.put('exams', legacyExam);
await shaped('the printable paper renders a legacy partless multipart question',
  () => dispatch('GET', `/exams/${legacyExam.id}/paper`));
await idb.put('questions', { ...restoredRow, answered: 0, payload: legacyPayload });
await shaped('the marker marks a legacy partless multipart question',
  () => dispatch('POST', `/exams/${legacyExam.id}/submit`, { answers: {}, ms: 1000 }));

console.log(`\nBad input — ${pass}/${pass + fail} checks`);
if (failures.length) {
  console.log('\nfailures:');
  for (const line of failures) console.log(`  ${line}`);
}
console.log(`\nBAD INPUT: ${fail ? 'FAIL' : 'PASS'} — ${pass}/${pass + fail} checks`);
process.exit(fail ? 1 : 0);
