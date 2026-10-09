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
  eq([await reconcileDeferredGrades(me.id), attemptsOf().length], [1, count + 1], 'a deferred event without marks is restored as a remote attempt on a later pass');
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
