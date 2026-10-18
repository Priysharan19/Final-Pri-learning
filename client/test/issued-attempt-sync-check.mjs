// Pri Learning · a server-marked attempt on a question THIS device was issued
// is recorded exactly once, whichever arrives first — the device's own
// resolution or the server's event on a sync pull — and is never lost when the
// device's write did not happen (a lost reply, then the student moved on).
import { installBrowserEnv, resetStorage, rawRows } from './backend-check.mjs';

let pass = 0; const failures = [];
const ok = (c, label) => { if (c) pass++; else failures.push(label); };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

await installBrowserEnv();
await resetStorage();
const { dispatch } = await import('../src/local/backend.js');
const idb = await import('../src/local/idb.js');
const { blindHash } = await import('../src/local/auth.js');
const { applyRemoteLearningEvents, reconcileDeferredGrades } = await import('../src/platform/cloudSyncRestore.js');

const me = (await dispatch('POST', '/profiles', { name: 'Kavya', year: 8, course: 'in', indiaTrack: 'cbse' })).user;
const attemptsOf = () => rawRows().attempts.filter(a => a.pid === me.id);
const xp = async () => (await dispatch('GET', '/me')).user.xp;
let n = 0;
const question = async extra => {
  const id = `local-q-${++n}`, serverQuestionId = `00000000-0000-4000-8000-00000000000${n}`;
  await idb.put('questions', { id, pid: me.id, serverQuestionId, subtopic: 'in-c8-rational-numbers', difficulty: 2, payload: { prompt: 'p', answerType: 'numeric' }, mode: 'practice', answered: 0, tries: 0, hintsUsed: 0, createdAt: Date.now(), ...extra });
  return { id, serverQuestionId };
};
const eventFor = (q, correct = true) => {
  const id = `attempt-${q.id}`;
  return { id, kind: 'graded-attempt', deviceId: 'server-grader', deviceSeq: n, serverCursor: 100 + n, entityId: q.serverQuestionId, occurredAt: Date.now(),
    payload: { attemptId: id, questionId: q.serverQuestionId, correct, marksEarned: correct ? 1 : 0, marksPossible: 1, subtopic: 'in-c8-rational-numbers', difficulty: 2, mode: 'practice', hintsUsed: 1, support: 'supported', createdAt: Date.now() } };
};
const claimOf = async q => `${me.id}:resolved:${await blindHash(`practice-resolution:${q.id}`)}`;

// 1 · the reply was lost and the student moved on: the pull records it, once
{
  const q = await question({});
  const before = await xp();
  const first = await applyRemoteLearningEvents(me.id, [eventFor(q)]);
  eq([first.applied, attemptsOf().length], [1, 1], 'a server-marked attempt this device never wrote is recorded by the pull');
  const row = attemptsOf()[0];
  eq([row.id, row.serverAttemptId, row.questionId], [await claimOf(q), `attempt-${q.id}`, q.id], 'under the device\'s own exactly-once claim, linked to the server attempt and the local question');
  ok(await xp() > before, 'and its progress reaches this device');
  const settled = await idb.get('questions', q.id);
  eq([settled.answered, !!settled.resolvedAt, settled.serverReceipt?.attemptId, settled.pendingGrade ?? null, 'deferredGrade' in settled],
    [1, true, `attempt-${q.id}`, null, false], 'and the question itself is settled in the same write, with the server receipt');
  const again = await applyRemoteLearningEvents(me.id, [eventFor(q)]);
  eq([again.applied, attemptsOf().length], [0, 1], 'pulling it again records nothing more');
}

// 2 · the device already resolved it: the pull is a duplicate
{
  const q = await question({ answered: 1 });
  const count = attemptsOf().length;
  const out = await applyRemoteLearningEvents(me.id, [eventFor(q)]);
  eq([out.applied, attemptsOf().length], [0, count], 'an attempt the device already resolved is not imported');
}

// 3 · the submit is in flight: deferred, then left to the device, or recorded later
{
  const q = await question({ pendingGrade: { submissionId: 's-in-flight-0001', at: Date.now() } });
  const count = attemptsOf().length;
  const out = await applyRemoteLearningEvents(me.id, [eventFor(q)]);
  eq([out.applied, attemptsOf().length], [0, count], 'while the submit is in flight the pull records nothing');
  ok(!!(await idb.get('questions', q.id)).deferredGrade, 'and keeps the server event with the question');
  eq(await reconcileDeferredGrades(me.id), 0, 'a later pass leaves it alone while the submit is still running');
  // the device finishes: its own resolution holds the claim, the deferred copy is dropped
  await idb.put('questions', { ...(await idb.get('questions', q.id)), answered: 1 });
  eq([await reconcileDeferredGrades(me.id), attemptsOf().length], [0, count], 'once the device has resolved it, the deferred event is dropped, not recorded');
  ok(!(await idb.get('questions', q.id)).deferredGrade, 'and no longer kept');
}
{
  const q = await question({ pendingGrade: { submissionId: 's-abandoned-0001', at: Date.now() } });
  const count = attemptsOf().length;
  await applyRemoteLearningEvents(me.id, [eventFor(q, false)]);
  // the submit never completed here and is long past its window
  const held = await idb.get('questions', q.id);
  await idb.put('questions', { ...held, pendingGrade: { ...held.pendingGrade, at: Date.now() - 10 * 60 * 1000 }, deferredGrade: { ...held.deferredGrade, at: Date.now() - 10 * 60 * 1000 } });
  eq([await reconcileDeferredGrades(me.id), attemptsOf().length], [1, count + 1], 'a deferred event whose submit never finished is recorded on a later pass');
  const settled = await idb.get('questions', q.id);
  eq([settled.answered, settled.resolution?.submissionId, settled.pendingGrade ?? null, 'deferredGrade' in settled], [1, 's-abandoned-0001', null, false],
    'the question is settled under the submission that was in flight, so a replay of it finds the verdict');
  eq(attemptsOf().find(a => a.questionId === q.id)?.id, await claimOf(q), 'under the same claim');
  eq([await reconcileDeferredGrades(me.id), attemptsOf().length], [0, count + 1], 'and only once');
}

// 3c · a retry starts after the window: the deferred copy must wait for it
{
  const q = await question({ pendingGrade: { submissionId: 's-retried-000001', at: Date.now() } });
  const count = attemptsOf().length;
  await applyRemoteLearningEvents(me.id, [eventFor(q)]);
  const held = await idb.get('questions', q.id);
  // the deferred copy is old, but the student has just pressed Retry
  await idb.put('questions', { ...held, deferredGrade: { ...held.deferredGrade, at: Date.now() - 10 * 60 * 1000 }, pendingGrade: { submissionId: 's-retried-000001', at: Date.now(), marker: 'retry' } });
  eq([await reconcileDeferredGrades(me.id), attemptsOf().length], [0, count], 'while a retry is in flight an old deferred event is not recorded');
  const after = await idb.get('questions', q.id);
  eq([after.pendingGrade?.marker, !!after.deferredGrade, after.answered], ['retry', true, 0], 'and the running submit\'s state is left exactly as it was');
}

// 3d · the reply was lost, the pull settled it, and THEN the card replays the submit
{
  const { submissionDigest } = await import('../src/local/backend.js');
  const submissionId = 's-replayed-00001';
  const q = await question({ pendingGrade: { submissionId, digest: submissionDigest('42', undefined), mode: 'typed', payload: { submissionId, answer: '42', mode: 'typed', ms: 900 }, at: Date.now() - 10 * 60 * 1000 } });
  const count = attemptsOf().length;
  await applyRemoteLearningEvents(me.id, [eventFor(q)]);
  eq(attemptsOf().length, count + 1, 'an abandoned submit\'s server attempt is recorded by the pull');
  let replay = null, refused = null;
  try { replay = await dispatch('POST', `/practice/${q.id}/submit`, { answer: '42', submissionId, ms: 900 }); } catch (e) { refused = e?.code || String(e?.message); }
  eq([refused, replay?.correct, replay?.resolved, replay?.authoritative, replay?.attemptId], [null, true, true, true, `attempt-${q.id}`],
    'replaying that submission returns the server\'s verdict, not "already finished"');
  eq(attemptsOf().length, count + 1, 'and records nothing more');
}

// 3g · a deferred event the device's routine cannot settle is still restored, not dropped
{
  const q = await question({ pendingGrade: { submissionId: 's-legacy-000001', at: Date.now() } });
  const count = attemptsOf().length;
  const legacy = eventFor(q);
  delete legacy.payload.marksEarned; delete legacy.payload.marksPossible; // an event from before marks were carried
  await applyRemoteLearningEvents(me.id, [legacy]);
  const held = await idb.get('questions', q.id);
  await idb.put('questions', { ...held, pendingGrade: { ...held.pendingGrade, at: Date.now() - 10 * 60 * 1000 } });
  const xpBefore = await xp();
  const dayXp = () => rawRows().activity.filter(a => a.pid === me.id).reduce((t, a) => t + (Number(a.xp) || 0), 0);
  const dayBefore = dayXp();
  eq([await reconcileDeferredGrades(me.id), attemptsOf().length], [1, count + 1], 'a deferred event without marks is restored as a remote attempt on a later pass');
  ok(dayXp() > dayBefore && (await xp()) - xpBefore === dayXp() - dayBefore, 'and its XP reaches the profile total as well as the day\'s activity, by the same amount');
  ok(!(await idb.get('questions', q.id)).deferredGrade, 'and only then is the deferred copy dropped');
  eq([await reconcileDeferredGrades(me.id), attemptsOf().length], [0, count + 1], 'once');
}

// 3e · two passes racing on the same event settle the question once
{
  const q = await question({});
  const count = attemptsOf().length;
  const [a, b] = await Promise.all([applyRemoteLearningEvents(me.id, [eventFor(q)]), applyRemoteLearningEvents(me.id, [eventFor(q)])]);
  eq([a.applied + b.applied, attemptsOf().length - count], [1, 1], 'two pulls racing on one event record it once (the question lock and the claim)');
}

// 3f · a submit holds the question's lock while it waits on the server: the pull waits its turn
{
  const backendSource = (await import('node:fs')).readFileSync(new URL('../src/local/backend.js', import.meta.url), 'utf8');
  ok(/registerIssuedAttemptRecorder\(\(pid, rowId, event\) => withMutationLock\(`question:\$\{rowId\}`/.test(backendSource),
    'the recorder runs under the same question lock a submit holds');
  ok(/key === 'POST \/practice\/:id\/submit'[\s\S]{0,400}withMutationLock\(`question:\$\{params\.id\}`/.test(backendSource),
    'and submit takes that lock before it reads the row');
}

// 3h · a pull that lands while a submit holds the question writes nothing until
//      the submit is done, and never puts the question back to unanswered
//      (production: Sync · a pull overlapping a submit — the pull kept the
//      server event by rewriting the whole row it had read before the submit
//      resolved it; the finished question was served again and refused as
//      "already finished").
{
  const { withMutationLock } = await import('../src/local/mutationLock.js');
  const q = await question({});
  const count = attemptsOf().length;
  const rawRow = () => JSON.stringify(rawRows().questions.find(r => r.id === q.id));
  let pulled = null, during = null, before = null;
  // What a submit does, under the question lock it takes before it reads the
  // row (3f): the grade goes in flight, the server answers, the row resolves.
  await withMutationLock(`question:${q.id}`, async () => {
    const row = await idb.get('questions', q.id);
    await idb.put('questions', { ...row, pendingGrade: { submissionId: 's-overlapped-001', at: Date.now() } });
    before = rawRow();
    const pull = applyRemoteLearningEvents(me.id, [eventFor(q)]).then(out => { pulled = out; return out; });
    for (let i = 0; i < 20; i++) await new Promise(r => setTimeout(r, 5));
    during = { row: rawRow(), settled: pulled !== null };
    await idb.put('questions', { ...row, answered: 1, resolvedAt: Date.now(), pendingGrade: null, serverReceipt: { attemptId: `attempt-${q.id}` } });
    void pull;
  });
  while (pulled === null) await new Promise(r => setTimeout(r, 5));
  eq([during.row === before, during.settled], [true, false],
    'while the submit holds the question, the pull waits and writes nothing to its row');
  const settled = await idb.get('questions', q.id);
  eq([settled.answered, settled.pendingGrade ?? null, 'deferredGrade' in settled, !!settled.resolvedAt], [1, null, false, true],
    'after it the question is still answered: the submit\'s resolution is not undone by the pull');
  eq([pulled.applied, attemptsOf().length], [0, count], 'and the pull records nothing more');
}
// 3i · the stale write itself, staged: the pull reads the row while the submit
//      is in flight; the submit then resolves the row and releases the lock
//      BEFORE the pull writes. The question must still be answered after the
//      pull (on the old code the pull put its pre-resolution copy back).
//      Played for a practice row and for a Rush row — a Rush answer is a
//      server-marked resolution of an issued row too.
const { withMutationLock } = await import('../src/local/mutationLock.js');
// The fake IndexedDB's own read, hooked: the first read of one question row
// runs `then` right after the row is read (the moment a submit could land).
const fakeDb = globalThis.indexedDB.open().result;
const Handle = Object.getPrototypeOf(fakeDb.transaction(['questions']).objectStore('questions'));
const plainGet = Handle.get;
let onceRead = null;
Handle.get = function get(key) {
  if (this.store.name !== 'questions') return plainGet.call(this, key);
  return this.req(() => {
    const value = this.store.rows.get(key);
    const copy = value === undefined ? undefined : JSON.parse(JSON.stringify(value));
    if (onceRead && value?.id === onceRead.id) { const hook = onceRead; onceRead = null; hook.then(this.store, key); }
    return copy;
  });
};
for (const mode of ['practice', 'rush']) {
  const q = await question({ mode });
  const count = attemptsOf().length;
  let release = null, resolvedRow = null;
  // The submit (or Rush answer): under the question lock, grade in flight, waiting on the server.
  const submit = withMutationLock(`question:${q.id}`, async () => {
    const row = await idb.get('questions', q.id);
    const inFlight = { ...row, pendingGrade: { submissionId: `s-staged-${mode}-01`, at: Date.now() } };
    await idb.put('questions', inFlight);
    resolvedRow = { ...inFlight, answered: 1, resolvedAt: Date.now(), pendingGrade: null, serverReceipt: { attemptId: `attempt-${q.id}`, correct: true } };
    await new Promise(r => { release = r; });
  });
  while (!release) await new Promise(r => setTimeout(r, 1));
  // The server answers just after the pull has read the in-flight row: the
  // submit's resolution lands, and the submit lets go of the question.
  onceRead = { id: q.id, then: (store, key) => { store.rows.set(key, JSON.parse(JSON.stringify(resolvedRow))); release(); } };
  const out = await applyRemoteLearningEvents(me.id, [eventFor(q)]);
  await submit;
  const after = await idb.get('questions', q.id);
  eq([onceRead, after.answered, after.pendingGrade ?? null, 'deferredGrade' in after, !!after.resolvedAt], [null, 1, null, false, true],
    `${mode}: a pull that read the row before the submit resolved it does not put the question back to unanswered`);
  eq([out.applied, attemptsOf().length], [0, count], `${mode}: and records nothing more`);
}
Handle.get = plainGet;

// 3j · a Rush/Match answer and a misconception proposal take the question lock:
//      while a submit or a pull holds the question they wait their turn.
{
  for (const [label, row, call] of [
    ['a Rush answer', { mode: 'rush' }, q => dispatch('POST', '/rush/answer', { id: q.id, answer: '1' })],
    ['a Match answer', { mode: 'match' }, q => dispatch('POST', '/rush/answer', { id: q.id, answer: '1' })],
    ['a misconception proposal', { answered: 1 }, q => dispatch('POST', `/practice/${q.id}/misconception`, { misconceptionId: 'x', lines: [] })]
  ]) {
    const q = await question(row);
    let settled = false;
    let call$ = null;
    await withMutationLock(`question:${q.id}`, async () => {
      call$ = call(q).then(() => {}, () => {}).finally(() => { settled = true; });
      for (let i = 0; i < 20; i++) await new Promise(r => setTimeout(r, 2));
      ok(!settled, `${label} waits while the question is held (it takes the question lock)`);
    });
    await call$;
    ok(settled, `${label} runs once the question is free`);
  }
}

// 3k · every write of a question row in the sync restore and in the backend's
//      routes is accounted for: under the question lock, or a route that only
//      writes rows it creates (or exam-paper rows, under the paper's lock).
{
  const fs = await import('node:fs');
  const restore = fs.readFileSync(new URL('../src/platform/cloudSyncRestore.js', import.meta.url), 'utf8');
  const writes = [...restore.matchAll(/await put\('questions'/g)].length;
  const locked = [...restore.matchAll(/withMutationLock\(`question:\$\{(?:rowId|row\.id)\}`, async \(\) => \{\s*const (?:row|after) = await get\('questions'/g)].length;
  eq([writes, locked], [2, 2], 'every question-row write in the sync restore reads and writes under the question lock');

  const backend = fs.readFileSync(new URL('../src/local/backend.js', import.meta.url), 'utf8');
  const gated = backend.slice(backend.indexOf('async function runGated('));
  const lockedSet = new Set([...gated.slice(0, gated.indexOf('withMutationLock(`question:${params.id}`')).matchAll(/key === '([^']+)'/g)].map(m => m[1]));
  if (/key === 'POST \/rush\/answer' && body\?\.id\) \{\s*return withMutationLock\(`question:\$\{body\.id\}`/.test(gated)) lockedSet.add('POST /rush/answer');
  // A route that only writes rows it has just created (nothing can be settling
  // them yet), or exam-paper rows (never a practice event's row; the paper has its own lock).
  const creates = {
    'POST /exams': 'creates the paper\'s rows', 'GET /exams/:id': 'exam-paper rows, under the exam lock',
    'POST /exams/:id/submit': 'exam-paper rows, under the exam lock', 'POST /rush/start': 'creates the run\'s rows',
    'POST /match/start': 'creates the match\'s rows', 'POST /history/:id/retry': 'creates a new row'
  };
  const writer = /put\('questions'|store: 'questions'|\bresolve\(|gradeOnServer\(|revealOnServer\(|requireServerIssue\(|adoptPaperResult\(/;
  const table = backend.slice(0, backend.indexOf('\n};\n', backend.indexOf("'POST /practice/:id/submit'")));
  const starts = [...table.matchAll(/^ {2}'((?:GET|POST|PUT|PATCH|DELETE) [^']+)': async/mg)];
  const unaccounted = [], writers = [];
  starts.forEach((m, i) => {
    const body = table.slice(m.index, i + 1 < starts.length ? starts[i + 1].index : table.length);
    if (!writer.test(body)) return;
    writers.push(m[1]);
    if (!lockedSet.has(m[1]) && !creates[m[1]]) unaccounted.push(m[1]);
  });
  eq(unaccounted, [], 'every backend route that writes a question row holds the question lock (or only writes rows it creates)');
  ok(writers.length >= 13 && Object.keys(creates).every(r => writers.includes(r)), `the scan found the writers it should (${writers.length}) and no stale exemption`);
  for (const route of ['POST /practice/:id/submit', 'POST /practice/:id/reveal', 'POST /practice/:id/hint', 'POST /practice/:id/tutor', 'POST /practice/:id/discard', 'POST /practice/:id/misconception', 'POST /rush/answer']) {
    ok(lockedSet.has(route), `${route} is under the question lock`);
  }
  // The helpers that rewrite an existing row are reached only from those routes or the locked recorder.
  for (const helper of ['gradeOnServer', 'revealOnServer', 'requireServerIssue']) {
    const callers = [];
    starts.forEach((m, i) => {
      const body = table.slice(m.index, i + 1 < starts.length ? starts[i + 1].index : table.length);
      if (new RegExp(`\\b${helper}\\(`).test(body)) callers.push(m[1]);
    });
    eq(callers.filter(r => !lockedSet.has(r)), [], `${helper} is called only from routes under the question lock`);
  }
  const creditXp = restore.slice(restore.indexOf('async function creditXp'), restore.indexOf('async function creditXp') + 600);
  ok(/withMutationLock\(`profile-row:\$\{pid\}`/.test(creditXp) && !/locks\?\.request|return work\(\)/.test(creditXp),
    'restored XP is added under the profile-row lock backend.js uses, with no unlocked fallback');
}

// 4 · another device's attempt (no local question) is imported as before
{
  const foreign = { id: 'local-none', serverQuestionId: '11111111-1111-4111-8111-111111111111' };
  const count = attemptsOf().length;
  const out = await applyRemoteLearningEvents(me.id, [eventFor(foreign)]);
  eq([out.applied, attemptsOf().length], [1, count + 1], 'an attempt made on another device is still restored');
  ok(typeof attemptsOf().find(a => a.remoteEventId === `attempt-${foreign.id}`)?.id === 'string', 'as a remote row');
}

console.log(failures.length
  ? `ISSUED ATTEMPT SYNC: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `ISSUED ATTEMPT SYNC: PASS — ${pass}/${pass} checks — a server-marked attempt on a question this device was issued is recorded exactly once and never lost.`);
process.exit(failures.length ? 1 : 0);
