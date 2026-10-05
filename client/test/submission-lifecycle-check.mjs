// ─────────────────────────────────────────────────────────────────────────────
// §09 — Submission lifecycle: one tap is one authoritative attempt, a cut-off
// submission recovers to a known state, late cloud results bind to the attempt
// they were produced for, and no cloud result moves a recorded mark.
//
// Deterministic, bare Node, through the same src/api.js a student's tap uses.
// Every group names the production defect it pins:
//   1. A double tap / retry-after-timeout of a FIRST wrong answer spent the
//      second try (two deliveries, two tries) — now one keyed submission.
//   2. An unresolved first try queued a cloud `practice-progress` entry with no
//      attempt behind it; at sync it published the later attempt a second time
//      under another event id (or wedged forever) — now only resolved, non-
//      replayed submissions queue one.
//   3. A relaunch after the app was killed mid-submit served a NEW question and
//      left "did it submit?" unanswered — now the pending question comes back
//      and its replay returns the one verdict recorded for it.
//   4. A cloud misconception proposal could arrive for working that was no
//      longer the answer of record — now bound to the resolving submission.
// Usage: node client/test/submission-lifecycle-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installBrowserEnv, rawRows, resetStorage } from './backend-check.mjs';

installBrowserEnv(); resetStorage();
// A complete Web Storage (the shared fake has no key()/length, which the draft
// store's per-scope listing needs).
{
  const m = new Map();
  globalThis.localStorage = {
    getItem: k => (m.has(String(k)) ? m.get(String(k)) : null),
    setItem: (k, v) => { m.set(String(k), String(v)); },
    removeItem: k => { m.delete(String(k)); },
    clear: () => m.clear(),
    key: i => [...m.keys()][i] ?? null,
    get length() { return m.size; }
  };
}
// drafts.js reaches localStorage through `window`, and listens for page-hide.
const fakeWindow = new EventTarget();
Object.defineProperty(fakeWindow, 'localStorage', { get: () => globalThis.localStorage });
globalThis.window = fakeWindow;
if (typeof globalThis.document === 'undefined') globalThis.document = Object.assign(new EventTarget(), { visibilityState: 'visible' });

const { api } = await import('../src/api.js');
const idb = await import('../src/local/idb.js');
const { checkAnswer } = await import('../src/engine/checker.js');
const { loadAllBanks } = await import('../src/engine/generators/index.js');
const { cloudLinkRowId } = await import('../src/platform/cloudAccount.js');
const { subtopicsForYear } = await import('../src/engine/curriculum.js');
const YEAR10 = subtopicsForYear(10).map(t => t.id);
let topicTurn = 0;
const { classifyMutation } = await import('../src/local/outbox.js');
const { recordProfileMutation } = await import('../src/platform/profileOutbox.js');
const { submissionDigest, submissionIdOf } = await import('../src/local/backend.js');
const recovery = await import('../src/components/practiceRecovery.js');
const drafts = await import('../src/components/drafts.js');
const inkDrafts = await import('../src/local/inkDrafts.js');
await loadAllBanks();

let passed = 0;
const failures = [];
async function check(name, fn) {
  try { await fn(); passed++; }
  catch (e) { failures.push(`${name}\n      ${String(e?.message || e).split('\n').slice(0, 6).join('\n      ')}`); }
}

function canonical(q) {
  const a = q?.answer; if (!a) return null;
  if (a.canonicalInput !== undefined) return String(a.canonicalInput);
  if (q.answerType === 'numeric') {
    if (a.surdForm || a.simplestFraction || a.requireExact) return null;
    return String(a.value);
  }
  if (q.answerType === 'expression') return a.expr;
  if (q.answerType === 'mcq') return String(a.correctIndex);
  return null;
}
function wrongFor(q) {
  const a = q.answer;
  if (q.answerType === 'numeric') return String((Number(a.value) || 0) + 7);
  if (q.answerType === 'mcq') return String(((a.correctIndex || 0) + 1) % Math.max(2, q.mcqOptions?.length || 4));
  return null;
}
async function rowOf(id) { return idb.get('questions', id); }

/** A real-practice question whose right and wrong answers this suite can give. */
async function markable(body = {}) {
  for (let i = 0; i < 60; i++) {
    const s = await api.post('/practice/next', { mode: 'topic', subtopic: YEAR10[topicTurn++ % YEAR10.length], ...body, resume: false });
    const row = await rowOf(s.question.id);
    const q = row.payload;
    const right = canonical(q), wrong = wrongFor(q);
    const ok = right !== null && wrong !== null && checkAnswer(q, right).correct && !checkAnswer(q, wrong).correct
      && !checkAnswer(q, wrong).invalid
      && !(q.answerType === 'mcq' && q.answer.optionTraps?.[Number(wrong)]);
    if (ok) return { id: s.question.id, right, wrong, q, row };
    await api.post(`/practice/${s.question.id}/discard`, {});
  }
  throw new Error('no markable question was served');
}
const attemptsOf = async (pid, qid) => (await idb.byIndex('attempts', 'pid', pid)).filter(a => a.questionId === qid);
const outboxFor = async (pid, qid) => ((await idb.get('device', `pri-cloud-outbox-v1:${pid}`))?.items || [])
  .filter(x => x.kind === 'practice-progress' && x.entityId === qid);
async function refusal(promise) {
  try { await promise; } catch (e) { return e; }
  throw new Error('expected a refusal');
}

const me = (await api.post('/profiles', { name: 'Lifecycle Student', year: 10 })).user;
// Premium, so the free daily cap does not end the suite early.
{
  const now = Date.now();
  await idb.put('device', { id: cloudLinkRowId(me.id), accountId: `acct-${me.id}`, role: 'student', emailVerified: true, linkedAt: now, lastVerifiedAt: now, lastSyncAt: null,
    entitlement: { plan: 'premium', status: 'active', provider: 'web', currentPeriodEnd: now + 30 * 86400000, offlineUntil: now + 7 * 86400000, issuedAt: now, sourceVersion: 1 } });
}

// ── 1 · One tap, one attempt ────────────────────────────────────────────────
await check('a doubled delivery of one first wrong answer spends one try, not two', async () => {
  const t = await markable();
  const sid = recovery.newSubmissionId();
  const [a, b] = await Promise.all([
    api.post(`/practice/${t.id}/submit`, { answer: t.wrong, ms: 900, submissionId: sid }),
    api.post(`/practice/${t.id}/submit`, { answer: t.wrong, ms: 900, submissionId: sid })
  ]);
  assert.deepEqual([a.resolved, b.resolved], [false, false], 'neither delivery may resolve the question');
  assert.equal(a.triesLeft, 1); assert.equal(b.triesLeft, 1);
  assert.equal([a, b].filter(r => r.replayed).length, 1, 'exactly one of the two is the replay');
  const row = await rowOf(t.id);
  assert.equal(row.tries, 1, 'one try spent');
  assert.ok(!row.answered, 'not answered');
  assert.equal((await attemptsOf(me.id, t.id)).length, 0, 'an unresolved try is not an attempt');

  // The student's genuine second try is a new submission and resolves.
  const second = await api.post(`/practice/${t.id}/submit`, { answer: t.right, ms: 900, submissionId: recovery.newSubmissionId() });
  assert.equal(second.resolved, true); assert.equal(second.correct, true);
  assert.equal((await attemptsOf(me.id, t.id)).length, 1);
});

await check('a retry after a timeout (same key, response lost) returns the recorded verdict and adds nothing', async () => {
  const t = await markable();
  const sid = recovery.newSubmissionId();
  const before = (await api.get('/me')).user;
  const first = await api.post(`/practice/${t.id}/submit`, { answer: t.right, ms: 1200, submissionId: sid });
  assert.equal(first.resolved, true); assert.equal(first.correct, true); assert.equal(first.replayed, undefined);
  const mid = (await api.get('/me')).user;
  const again = await api.post(`/practice/${t.id}/submit`, { answer: t.right, ms: 1200, submissionId: sid });
  assert.equal(again.replayed, true);
  assert.equal(again.resolved, true);
  assert.equal(again.correct, first.correct, 'the verdict is the recorded one');
  assert.equal(again.xp, first.xp); assert.equal(again.totalXp, first.totalXp);
  assert.deepEqual(again.solution, first.solution);
  assert.deepEqual(again.newBadges, [], 'badges are never re-announced on a replay');
  const after = (await api.get('/me')).user;
  assert.equal(after.xp, mid.xp, 'no XP for a replay');
  assert.equal(after.today.questions, before.today.questions + 1, 'one question counted today');
  assert.equal((await attemptsOf(me.id, t.id)).length, 1, 'one attempt row');
});

await check('a key reused for different content is refused and the mark stands', async () => {
  const t = await markable();
  const sid = recovery.newSubmissionId();
  await api.post(`/practice/${t.id}/submit`, { answer: t.wrong, ms: 900, submissionId: sid });
  const tryClash = await refusal(api.post(`/practice/${t.id}/submit`, { answer: t.right, ms: 900, submissionId: sid }));
  assert.equal(tryClash.status, 409); assert.equal(tryClash.code, 'SUBMISSION_ID_REUSED');
  assert.equal((await rowOf(t.id)).tries, 1, 'a refused clash spends nothing');
  const sid2 = recovery.newSubmissionId();
  const done = await api.post(`/practice/${t.id}/submit`, { answer: t.wrong, ms: 900, submissionId: sid2 });
  assert.equal(done.resolved, true); assert.equal(done.correct, false);
  const resolved = await rowOf(t.id);
  const clash = await refusal(api.post(`/practice/${t.id}/submit`, { answer: t.right, ms: 900, submissionId: sid2 }));
  assert.equal(clash.code, 'SUBMISSION_ID_REUSED');
  const fresh = await refusal(api.post(`/practice/${t.id}/submit`, { answer: t.right, ms: 900, submissionId: recovery.newSubmissionId() }));
  assert.equal(fresh.status, 409, 'a new key on a resolved question is still already answered');
  assert.deepEqual((await rowOf(t.id)).resolution, resolved.resolution, 'the recorded mark never moved');
  assert.equal((await attemptsOf(me.id, t.id)).length, 1);
});

await check('a malformed submission id is refused at the gateway, not silently ignored', async () => {
  const t = await markable();
  for (const bad of ['short', 'has spaces in it!!', 'x'.repeat(81), 42]) {
    const e = await refusal(api.post(`/practice/${t.id}/submit`, { answer: t.wrong, submissionId: bad }));
    assert.equal(e.status, 400, `submissionId ${JSON.stringify(bad)}`);
  }
  assert.equal((await rowOf(t.id)).tries || 0, 0);
  assert.equal(submissionIdOf({ submissionId: 'sub_0123456789abcdef' }), 'sub_0123456789abcdef');
  assert.equal(submissionIdOf({ submissionId: 'no' }), null);
  assert.equal(submissionDigest('3', undefined), submissionDigest('3', null));
  assert.notEqual(submissionDigest('3', 'x = 3'), submissionDigest('3', undefined));
  await api.post(`/practice/${t.id}/discard`, {});
});

await check('submissions without a key keep the exactly-once 409 contract', async () => {
  const t = await markable();
  const raced = await Promise.allSettled([
    api.post(`/practice/${t.id}/submit`, { answer: t.right }),
    api.post(`/practice/${t.id}/submit`, { answer: t.right })
  ]);
  assert.equal(raced.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal(raced.filter(x => x.status === 'rejected' && x.reason?.status === 409).length, 1);
  assert.equal((await attemptsOf(me.id, t.id)).length, 1);
});

// ── 2 · Sync carries each attempt exactly once ──────────────────────────────
await check('only a resolved submission queues a cloud practice-progress entry, exactly once', async () => {
  assert.equal(classifyMutation('POST', '/practice/q-1/submit', { resolved: false, correct: false }), null);
  // A replay still marks the question dirty in the install-wide journal
  // (coalesced); the profile cloud queue refuses to queue it a second time.
  assert.deepEqual(classifyMutation('POST', '/practice/q-1/submit', { resolved: true, replayed: true }),
    { kind: 'practice-progress', entityId: 'q-1', operation: 'upsert' });
  assert.equal(await recordProfileMutation(me.id, 'POST', '/practice/q-1/submit', { resolved: true, replayed: true }), null);
  assert.equal(await recordProfileMutation(me.id, 'POST', '/practice/q-1/submit', { resolved: true, syncQueued: true }), null);
  assert.deepEqual(classifyMutation('POST', '/practice/q-1/submit', { resolved: true }),
    { kind: 'practice-progress', entityId: 'q-1', operation: 'upsert' });
  assert.deepEqual(classifyMutation('POST', '/practice/q-1/reveal', { resolved: true, revealed: true }),
    { kind: 'practice-progress', entityId: 'q-1', operation: 'upsert' });

  const t = await markable();
  await api.post(`/practice/${t.id}/submit`, { answer: t.wrong, submissionId: recovery.newSubmissionId() });
  await api.post(`/practice/${t.id}/submit`, { answer: 'not maths at all ###', submissionId: recovery.newSubmissionId() }).catch(() => null);
  assert.equal((await outboxFor(me.id, t.id)).length, 0, 'an unresolved try queues nothing');
  const sid = recovery.newSubmissionId();
  await api.post(`/practice/${t.id}/submit`, { answer: t.right, submissionId: sid });
  await api.post(`/practice/${t.id}/submit`, { answer: t.right, submissionId: sid });
  const queued = await outboxFor(me.id, t.id);
  const attempts = await attemptsOf(me.id, t.id);
  assert.equal(attempts.length, 1);
  assert.equal(queued.length, 1, `one queued entry for one attempt, got ${queued.length}`);
  assert.equal(queued[0].sourceId, attempts[0].id, 'and it names that exact attempt');
});

// ── 3 · Interrupted submission recovers to a known state ────────────────────
await check('killed after the commit: relaunch serves the pending question and the replay shows its verdict', async () => {
  const t = await markable();
  const sid = recovery.newSubmissionId();
  // The card writes the pending record before the request leaves…
  recovery.savePendingSubmission(t.id, { submissionId: sid, answer: t.wrong, ms: 800, viaInk: false });
  await api.post(`/practice/${t.id}/submit`, { answer: t.wrong, ms: 800, submissionId: sid });
  await api.post(`/practice/${t.id}/submit`, { answer: t.wrong, ms: 800, submissionId: (() => {
    const s2 = recovery.newSubmissionId();
    recovery.savePendingSubmission(t.id, { submissionId: s2, answer: t.wrong, ms: 800, viaInk: false });
    return s2;
  })() });
  // …and the app died before the response cleared it.
  const pending = recovery.readPendingSubmission(t.id);
  assert.ok(pending, 'the pending record survived the "kill"');
  assert.equal(recovery.pendingSubmissionQuestionId(), t.id);
  const unrelated = await markable();   // something else is unfinished too
  const relaunch = await api.post('/practice/next', { resume: true, pendingQuestionId: recovery.pendingSubmissionQuestionId() });
  assert.equal(relaunch.question.id, t.id, 'the pending question comes back first, though it is answered');
  assert.equal(relaunch.resumed, true);
  assert.ok(!('answer' in relaunch.question) && !('solution' in relaunch.question), 'served without its answer');
  const replay = await api.post(`/practice/${t.id}/submit`, {
    answer: pending.answer, ms: pending.ms, steps: pending.steps, viaInk: pending.viaInk, submissionId: pending.submissionId
  });
  assert.equal(replay.replayed, true); assert.equal(replay.resolved, true); assert.equal(replay.correct, false);
  assert.equal((await attemptsOf(me.id, t.id)).length, 1, 'still exactly one attempt');
  recovery.clearPendingSubmission(t.id);
  assert.equal(recovery.pendingSubmissionQuestionId(), null);
  await api.post(`/practice/${unrelated.id}/discard`, {});
});

await check('killed before the request landed: the replay marks it now, once', async () => {
  const t = await markable();
  const sid = recovery.newSubmissionId();
  recovery.savePendingSubmission(t.id, { submissionId: sid, answer: t.right, ms: 700, viaInk: false });
  // Nothing reached the backend. Relaunch:
  const relaunch = await api.post('/practice/next', { resume: true, pendingQuestionId: recovery.pendingSubmissionQuestionId() });
  assert.equal(relaunch.question.id, t.id);
  const p = recovery.readPendingSubmission(t.id);
  const r = await api.post(`/practice/${t.id}/submit`, { answer: p.answer, ms: p.ms, submissionId: p.submissionId });
  assert.equal(r.resolved, true); assert.equal(r.correct, true); assert.equal(r.replayed, undefined);
  const r2 = await api.post(`/practice/${t.id}/submit`, { answer: p.answer, ms: p.ms, submissionId: p.submissionId });
  assert.equal(r2.replayed, true);
  assert.equal((await attemptsOf(me.id, t.id)).length, 1);
  recovery.clearPendingSubmission(t.id);
});

await check('a pending id that is skipped, foreign or unknown never resurrects a question', async () => {
  const t = await markable();
  await api.post(`/practice/${t.id}/discard`, {});
  const a = await api.post('/practice/next', { resume: true, pendingQuestionId: t.id });
  assert.notEqual(a.question.id, t.id, 'a skipped question stays skipped');
  const b = await api.post('/practice/next', { resume: true, pendingQuestionId: 'q-does-not-exist' });
  assert.ok(b.question?.id);
  const other = (await api.post('/profiles', { name: 'Other Student', year: 10 })).user;
  const theirs = await api.post('/practice/next', { resume: false });
  await api.post('/profiles/select', { id: me.id });
  const c = await api.post('/practice/next', { resume: true, pendingQuestionId: theirs.question.id });
  assert.notEqual(c.question.id, theirs.question.id, "another profile's question is never served");
  assert.ok(other.id !== me.id);
});

// ── 4 · Skip while marking, and advancing ───────────────────────────────────
await check('skipping while a submission is being marked records it once and never double-advances', async () => {
  const t = await markable();
  const [submitted, discarded] = await Promise.allSettled([
    api.post(`/practice/${t.id}/submit`, { answer: t.right, submissionId: recovery.newSubmissionId() }),
    api.post(`/practice/${t.id}/discard`, {})
  ]);
  assert.equal(submitted.status, 'fulfilled'); assert.equal(submitted.value.resolved, true);
  assert.equal(discarded.status, 'rejected'); assert.equal(discarded.reason.status, 409);
  assert.equal((await rowOf(t.id)).discardedAt, undefined, 'an answered question is never marked skipped');
  assert.equal((await attemptsOf(me.id, t.id)).length, 1);
  const n1 = await api.post('/practice/next', { resume: true });
  const n2 = await api.post('/practice/next', { resume: true });
  assert.notEqual(n1.question.id, t.id);
  assert.equal(n2.question.id, n1.question.id, 'a doubled Next resumes, it does not serve two');
  await api.post(`/practice/${n1.question.id}/discard`, {});
});

// ── 5 · AI is subordinate: no cloud result moves a recorded mark ────────────
await check('a misconception proposal for a stale submission changes nothing; none ever moves the mark', async () => {
  const t = await markable();
  const s1 = recovery.newSubmissionId();
  const s2 = recovery.newSubmissionId();
  await api.post(`/practice/${t.id}/submit`, { answer: t.wrong, submissionId: s1 });
  await api.post(`/practice/${t.id}/submit`, { answer: t.wrong, submissionId: s2 });
  const resolved = await rowOf(t.id);
  assert.equal(resolved.resolution.correct, false);
  assert.equal(resolved.resolution.submissionId, s2, 'the resolving submission is recorded with the verdict');
  const owner = resolved.india?.chapterId || resolved.payload.subtopic;
  const ledger = async () => (await idb.get('ratings', `${me.id}:${owner}`))?.traps || {};
  const before = await ledger();
  const attemptsBefore = await attemptsOf(me.id, t.id);
  const lines = ['2(x + 3) = 10', '2x + 3 = 10', 'x = 3.5'];
  const stale = await api.post(`/practice/${t.id}/misconception`, {
    lines, firstBreak: 1, misconceptionId: 'distribute-partial', confident: true, submissionId: s1
  });
  assert.equal(stale.stale, true); assert.equal(stale.recorded, false); assert.equal(stale.status, null);
  assert.deepEqual(await ledger(), before, 'learner state untouched by a stale proposal');
  assert.equal((await rowOf(t.id)).trapKey, resolved.trapKey);
  // The live submission's proposal is judged by the engine; whatever it says,
  // the mark, the attempt and the XP do not move.
  await api.post(`/practice/${t.id}/misconception`, {
    lines, firstBreak: 1, misconceptionId: 'distribute-partial', confident: true, submissionId: s2
  });
  const after = await rowOf(t.id);
  assert.deepEqual(after.resolution, resolved.resolution, 'the recorded verdict is byte-for-byte the same');
  assert.deepEqual(await attemptsOf(me.id, t.id), attemptsBefore, 'the attempt row is unchanged');
  const replay = await api.post(`/practice/${t.id}/submit`, { answer: t.wrong, submissionId: s2 });
  assert.equal(replay.correct, false, 'a replay after cloud feedback still reports the recorded mark');
});

// ── 6 · Client recovery store ───────────────────────────────────────────────
await check('pending submissions and kept ink are profile-scoped, bounded and self-recovering', async () => {
  // Upgrade safety: pre-sealed-store builds wrote ink drafts in plaintext
  // localStorage. Activating a profile must remove only that profile's legacy
  // rows, keep another profile's row untouched until that profile is selected,
  // and never surface either row on the crash-card draft list.
  const legacyA = 'pri.draft.pid-a.ink.q-legacy-a';
  const legacyB = 'pri.draft.pid-b.ink.q-legacy-b';
  const legacy = (id, x) => JSON.stringify({
    v: 1, scope: 'ink', id, data: { strokes: [{ points: [[x, x + 1], [x + 2, x + 3]] }] },
    label: 'Legacy handwriting', note: 'Handwriting in progress', path: '/practice', savedAt: Date.now()
  });
  localStorage.setItem(legacyA, legacy('q-legacy-a', 41));
  localStorage.setItem(legacyB, legacy('q-legacy-b', 51));

  drafts.setDraftProfile('pid-a');
  assert.equal(localStorage.getItem(legacyA), null, 'active profile legacy plaintext ink is removed on upgrade');
  assert.notEqual(localStorage.getItem(legacyB), null, 'another profile legacy ink is not touched during the wrong profile switch');
  assert.deepEqual(drafts.listDrafts().map(d => d.scope).filter(s => s === 'ink'), [], 'legacy ink is never offered on the crash card');
  drafts.setDraftProfile('pid-b');
  assert.equal(localStorage.getItem(legacyB), null, 'the other profile legacy row is removed only when that profile becomes active');
  drafts.setDraftProfile('pid-a');

  const strokes = [{ points: [{ x: 10.4, y: 20.6, w: 3 }, { x: 11, y: 22 }] }, { points: [] }, { points: [[5, 6]] }];
  assert.equal(recovery.saveInkDraft('q-ink', strokes), true);
  assert.deepEqual(await recovery.readInkDraft('q-ink'), [
    { points: [{ x: 10, y: 21 }, { x: 11, y: 22 }] }, { points: [{ x: 5, y: 6 }] }
  ], 'ink survives as integer points, empty strokes dropped — readable through the coalesced write');
  await inkDrafts.flushInkDrafts();
  assert.deepEqual((await recovery.readInkDraft('q-ink'))?.length, 2, 'and after the write has landed');
  const onDisk = rawRows().inkDrafts || [];
  assert.equal(onDisk.length, 1, 'one row in the inkDrafts IndexedDB store');
  assert.equal(onDisk[0].pid, 'pid-a', 'owned by the profile, in the clear for the index');
  assert.deepEqual(Object.keys(localStorage).filter(k => /\.ink\./.test(k)), [], 'nothing of it in localStorage');
  assert.equal(JSON.stringify(localStorage).includes('"strokes"'), false, 'no strokes anywhere in web storage');
  const huge = Array.from({ length: 2000 }, () => ({ points: Array.from({ length: 40 }, (_, i) => ({ x: 1000 + i, y: 1000 + i })) }));
  assert.equal(recovery.saveInkDraft('q-huge', huge), false, 'an oversized page is not kept');
  assert.equal(await recovery.readInkDraft('q-huge'), null);
  assert.deepEqual((await inkDrafts.queuedInkDrafts()).map(d => d.questionId), ['q-ink'], 'the outbox view lists the page waiting to be read');
  recovery.savePendingSubmission('q-pend', { submissionId: 'sub_aaaaaaaaaaaaaaaa', answer: '7', ms: 12, viaInk: true, lines: ['x = 7'] });
  assert.equal(recovery.savePendingSubmission('q-bad', { submissionId: 'bad id', answer: '7' }), false);
  assert.equal(recovery.pendingSubmissionQuestionId(), 'q-pend');
  assert.deepEqual(drafts.listDrafts().map(d => d.scope).filter(s => s === 'ink' || s === 'submit'), [],
    'the crash card does not list records that recover by themselves');
  drafts.setDraftProfile('pid-b');
  assert.equal(recovery.pendingSubmissionQuestionId(), null, 'another profile sees none of it');
  assert.equal(await recovery.readInkDraft('q-ink'), null);
  assert.deepEqual(await inkDrafts.queuedInkDrafts(), [], 'nor its queue');
  drafts.setDraftProfile('pid-a');
  recovery.clearPendingSubmission('q-pend');
  await recovery.clearInkDraft('q-ink');
  assert.equal(recovery.pendingSubmissionQuestionId(), null);
  assert.equal(await recovery.readInkDraft('q-ink'), null);
  assert.equal((rawRows().inkDrafts || []).length, 0, 'clearing removes the row');
  const a = recovery.newSubmissionId(), b = recovery.newSubmissionId();
  assert.match(a, /^[A-Za-z0-9_-]{8,80}$/); assert.notEqual(a, b);
  assert.equal(recovery.submissionContentKey('3', undefined), recovery.submissionContentKey('3', null));
  drafts.setDraftProfile(null);
});

// ── 6b · A protected profile's kept page is ciphertext at rest ──────────────
// The reason the ink left localStorage: a page of working is the student's
// private work. With the profile's data key held, the row keeps only its id and
// pid in the clear; every stroke is inside the sealed blob.
await check('a protected profile’s kept ink is sealed on disk', async () => {
  const sealed = (await api.post('/profiles', { name: 'Sealed Sam', year: 10, password: 'sealed-at-rest-1' })).user;
  drafts.setDraftProfile(sealed.id);
  const canaryX = 7351, canaryY = 9137;
  assert.equal(recovery.saveInkDraft('q-sealed', [{ points: [{ x: canaryX, y: canaryY }, { x: canaryX + 1, y: canaryY + 1 }] }]), true);
  await inkDrafts.flushInkDrafts();
  const rows = (rawRows().inkDrafts || []).filter(r => r.pid === sealed.id);
  assert.equal(rows.length, 1, 'one row for the protected profile');
  assert.deepEqual(Object.keys(rows[0]).sort(), ['id', 'pid', 'sealed'], 'only the id and pid are in the clear; everything else is in the sealed blob');
  assert.equal(JSON.stringify(rows[0]).includes(String(canaryX)), false, 'no coordinate is readable on disk');
  assert.deepEqual((await recovery.readInkDraft('q-sealed'))?.[0]?.points?.[0], { x: canaryX, y: canaryY }, 'and it opens for the profile that owns it');
  await recovery.clearInkDraft('q-sealed');
  drafts.setDraftProfile(null);
});

// ── 7 · The card is wired to these guards ───────────────────────────────────
// The behaviour is driven in the browser by tour-submit-lifecycle.js; these
// pin the wiring that suite cannot reach without a slow cloud.
await check('QuestionCard and InkAnswer bind late results to the attempt', async () => {
  const card = readFileSync(new URL('../src/components/QuestionCard.jsx', import.meta.url), 'utf8');
  const ink = readFileSync(new URL('../src/ink/InkAnswer.jsx', import.meta.url), 'utf8');
  assert.match(card, /if \(inFlightRef\.current \|\| busy \|\| resolved\) return;/, 'submit has a synchronous in-flight guard');
  assert.match(card, /savePendingSubmission\(question\.id,[\s\S]{0,200}\);\s*const scribbleStrokes[\s\S]{0,300}await deliver\(/, 'the pending record is written before the request leaves');
  assert.match(card, /attemptRef\.current\?\.submissionId !== bound\.submissionId\) return;/, 'a late working check for another attempt is dropped');
  assert.match(card, /misconception`, \{ \.\.\.proposal\.body, submissionId: sid \}/, 'a proposal names its submission');
  assert.match(card, /disabled=\{resolved \|\| busy\}/, 'the ink surface locks while marking');
  assert.match(ink, /seq !== readSeqRef\.current \|\| disabledRef\.current\) return;/, 'a late cloud reading is ignored once the page is locked');
  assert.doesNotMatch(card, /onRecognized=\{setInkResult\}/, 'readings pass through the freeze');
});

if (failures.length) {
  console.log(`\n✖ submission lifecycle — ${failures.length} failed, ${passed} passed\n`);
  for (const f of failures) console.log('  ' + f + '\n');
  process.exit(1);
}
console.log(`PASS — §09 submission lifecycle: ${passed} groups (one attempt per submission, sync once, interruption recovery, stale-result binding, AI subordinate, ink kept).`);
