// Pri Learning · the hint ladder, the error notebook and the per-dot-point
// review queue are the server's, per account, over real HTTP.
//
//   hint ladder   rungs are served from the server's escrow in order (a skip
//                 is 409, an unknown rung 400), charged the moment they are
//                 served, never un-charged, and the commit that marks a
//                 correct answer credits it with the weight the served rungs
//                 left. The solution rung resolves the question as REVEALED,
//                 never correct. One-try modes offer no ladder. Another
//                 account's question is 404.
//   notebook      every wrong resolution is filed (the notebook/paywall
//                 split: "every marked step that was wrong is saved"); it is
//                 grouped under the misconception the deterministic engine
//                 diagnosed (an authored trap its feedback matched), and a
//                 wrong answer with no diagnosis is filed under its topic
//                 alone, never given an invented misconception. A reveal is
//                 not a mistake. A correct twin marks the entry fixed. A twin is a
//                 new server-issued question from the same generator, dot
//                 point and difficulty, with no key in it, and only the
//                 owning account can draw one.
//   review queue  derived from the account's own server-graded attempts.
import './support/hermetic.mjs';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const scratch = mkdtempSync(join(tmpdir(), 'pri-hints-notebook-'));
process.env.NODE_ENV = 'test'; // fixed seeds: the same content on demand
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
// The free plan's 5 marked scripts a day is proven in practice-daily-cap-check.mjs;
// this suite marks many answers on one free account, so it raises it by configuration.
process.env.PRI_FREE_MARKED_PER_DAY = '100000';
process.env.PRI_AUTH_DELIVERY_KEY = '6b'.repeat(32);
delete process.env.PRI_PUBLIC_ORIGIN;
const { startApp, registerAccount, verifyEmail } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const { misconceptionIdForTrap } = await import('../../client/src/engine/misconceptions.js');
const { HINT_RUNGS } = await import('../../client/src/engine/hintLadder.js');
console.log(`engine: ${requestedEngine()}`);
const h = await startApp({ engine: requestedEngine() });
let count = 0;
const eq = (a, b, name) => { assert.deepEqual(a, b, name); count++; };
const ok = (cond, name) => { assert.ok(cond, name); count++; };
const post = (path, body, jar, headers = {}) => h.request(path, { method: 'POST', jar, body, headers });
const get = (path, jar) => h.request(path, { method: 'GET', jar });
const issue = (jar, generator, seed, extra = {}) => post('/v1/practice/issue', { generator, difficulty: 2, seed, curriculum: 'in', ...extra }, jar);
const sealed = async id => JSON.parse((await h.db.get("SELECT response_json FROM idempotency_keys WHERE scope='practice-question' AND key=?", [id])).response_json);
const eventOf = async id => { const row = await h.db.get("SELECT id,payload_json FROM learning_events WHERE kind='graded-attempt' AND entity_id=?", [id]); return row ? { eventId: row.id, ...JSON.parse(row.payload_json) } : null; };
const hint = (jar, id, rung) => post(`/v1/practice/${id}/hint`, rung === undefined ? {} : { rung }, jar);
let n = 0;
const grade = (jar, id, answer) => { const sid = `hints-notebook-${String(++n).padStart(4, '0')}`; return post(`/v1/practice/${id}/submit`, { submissionId: sid, answer: String(answer), mode: 'typed' }, jar, { 'Idempotency-Key': sid }); };
const LINEAR = 'c8-linear-equations-both-sides';
const PERCENT = 'y7-decimals-perc';       // seed 4242: 30% of 90; the trap answer 3 divides by 30

try {
  const a = await registerAccount(h, { email: 'hints.a@example.test', deviceId: 'ipad-hints-a' });
  const b = await registerAccount(h, { email: 'hints.b@example.test', deviceId: 'ipad-hints-b' });
  eq([(await verifyEmail(h, a.account.id)).status, (await verifyEmail(h, b.account.id)).status], [200, 200], 'two verified accounts');

  // ── The ladder: order, charge, credit ─────────────────────────────────────
  const q1 = await issue(a.jar, LINEAR, 4242);
  eq(q1.status, 201, 'a question is issued');
  const id1 = q1.data.question.id;
  const key1 = await sealed(id1);
  ok(!('steps' in q1.data.question) && !('answer' in q1.data.question), 'the issued question carries no steps and no key');
  const skip = await hint(a.jar, id1, 'method');
  eq([skip.status, skip.data.error?.code, skip.data.next], [409, 'HINT_RUNG_ORDER', 'nudge'], 'a rung cannot be skipped: the server names the next one');
  eq((await hint(a.jar, id1, 'answer')).status, 400, 'an unknown rung is refused');
  eq((await hint(a.jar, id1)).status, 400, 'a rung must be named');
  eq((await post(`/v1/practice/${id1}/hint`, { rung: 'nudge', level: 0 }, a.jar)).status, 400, 'nothing else may ride on a hint request (no level to set)');
  const foreign = await hint(b.jar, id1, 'nudge');
  eq([foreign.status, foreign.data.error?.code], [404, 'QUESTION_NOT_FOUND'], 'another account cannot open a rung on this question');
  eq((await hint(a.jar, '00000000-0000-4000-8000-000000000000', 'nudge')).status, 404, 'an unknown question is 404');
  const nudge = await hint(a.jar, id1, 'nudge');
  eq([nudge.status, nudge.data.rung, nudge.data.level, nudge.data.markWeight, nudge.data.next], [200, 'nudge', 1, 0.9, 'method'], 'the nudge is served and charged 10%');
  eq(nudge.data.hint, key1.hints[0], 'the nudge is the authored first hint, read from the escrow');
  const again = await hint(a.jar, id1, 'nudge');
  eq([again.data.level, again.data.markWeight, again.data.hint], [1, 0.9, nudge.data.hint], 'asking for an opened rung again re-serves it and charges nothing more');
  const method = await hint(a.jar, id1, 'method');
  eq([method.data.level, method.data.markWeight], [2, 0.7], 'the method rung takes the weight to 70%');
  const worked = await hint(a.jar, id1, 'worked');
  eq([worked.data.level, worked.data.markWeight, worked.data.remaining], [3, 0.4, 1], 'the worked step takes it to 40%');
  eq(worked.data.hint, key1.steps[0].d || key1.steps[0].h, 'the worked step is the first solution step');
  const back = await hint(a.jar, id1, 'nudge');
  eq([back.data.level, back.data.markWeight], [3, 0.4], 'reopening an early rung never lowers the charge');
  const charged = JSON.parse((await h.db.get("SELECT response_json FROM idempotency_keys WHERE scope='practice-hints' AND key=?", [id1])).response_json);
  eq([charged.level, charged.rungs], [3, ['nudge', 'method', 'worked']], 'the charge is committed on the server');
  const right = await grade(a.jar, id1, key1.answer.value);
  eq([right.data.correct, right.data.resolved, right.data.marksEarned === right.data.marksPossible], [true, true, true], 'a correct answer is still correct: hints never change the verdict');
  eq([right.data.hintLevel, right.data.markWeight, right.data.creditedMarks], [3, 0.4, Math.round(right.data.marksPossible * 0.4 * 100) / 100], 'and is credited with the weight left');
  const ev1 = await eventOf(id1);
  eq([ev1.hintLevel, ev1.hintRungs, ev1.markWeight, ev1.creditedMarks, ev1.support], [3, ['nudge', 'method', 'worked'], 0.4, right.data.creditedMarks, 'supported'], 'the graded attempt carries the ladder as supported evidence');
  const late = await hint(a.jar, id1, 'solution');
  eq([late.status, late.data.error?.code], [409, 'QUESTION_ALREADY_GRADED'], 'no rung opens once the question is resolved');

  // A clean answer is credited in full and logs no rungs.
  const q2 = await issue(a.jar, LINEAR, 5151);
  const clean = await grade(a.jar, q2.data.question.id, (await sealed(q2.data.question.id)).answer.value);
  eq([clean.data.hintLevel, clean.data.markWeight, clean.data.creditedMarks], [0, 1, clean.data.marksEarned], 'no rungs, full credit');
  eq((await eventOf(q2.data.question.id)).hintRungs, [], 'and an empty rung list on the attempt');

  // An open wrong try keeps its silent shape: no ladder fields leak.
  const q3 = await issue(a.jar, LINEAR, 6161);
  await hint(a.jar, q3.data.question.id, 'nudge');
  const open = await grade(a.jar, q3.data.question.id, '987654');
  eq([open.data.resolved, 'hintLevel' in open.data, 'creditedMarks' in open.data], [false, false, false], 'an open wrong try says nothing about the ladder');

  // ── The solution rung is a reveal ─────────────────────────────────────────
  const q4 = await issue(a.jar, LINEAR, 7171);
  const id4 = q4.data.question.id;
  eq((await hint(a.jar, id4, 'solution')).status, 409, 'the solution rung cannot be reached by skipping');
  for (const rung of HINT_RUNGS.slice(0, 3)) await hint(a.jar, id4, rung);
  const sol = await hint(a.jar, id4, 'solution');
  eq([sol.status, sol.data.revealed, sol.data.resolved, sol.data.correct, sol.data.marksEarned, sol.data.creditedMarks, sol.data.endsQuestion],
    [200, true, true, false, 0, 0, true], 'the full solution ends the question as revealed, never correct, with no marks');
  ok(!!sol.data.solution?.answerText, 'and carries the server\'s solution');
  const ev4 = await eventOf(id4);
  eq([ev4.revealed, ev4.correct, ev4.hintLevel, ev4.markWeight], [true, false, 4, 0], 'its attempt is a reveal with the full ladder');
  const typedAfter = await grade(a.jar, id4, (await sealed(id4)).answer.value);
  eq([typedAfter.status, typedAfter.data.error?.code], [409, 'QUESTION_ALREADY_GRADED'], 'the answer cannot be typed in after reading it');
  eq((await post(`/v1/practice/${id4}/reveal`, {}, a.jar)).data.attemptId, sol.data.attemptId, 'Show solution afterwards replays the same reveal');

  // One-try modes offer no ladder.
  const rush = await issue(a.jar, LINEAR, 8181, { mode: 'rush' });
  eq([(await hint(a.jar, rush.data.question.id, 'nudge')).data.error?.code], ['HINT_NOT_AVAILABLE'], 'a Rush question offers no hints');

  // ── The error notebook ───────────────────────────────────────────────────
  const c = await registerAccount(h, { email: 'notebook.c@example.test', deviceId: 'ipad-notebook-c' });
  const d = await registerAccount(h, { email: 'notebook.d@example.test', deviceId: 'ipad-notebook-d' });
  eq([(await verifyEmail(h, c.account.id)).status, (await verifyEmail(h, d.account.id)).status], [200, 200], 'two more verified accounts');
  eq((await get('/v1/practice/notebook', c.jar)).data.groups, [], 'an empty notebook to begin with');

  const t = await issue(c.jar, PERCENT, 4242);
  const tid = t.data.question.id;
  const tq = await sealed(tid);
  const trap = tq.traps.find(x => x.value !== undefined);
  eq((await grade(c.jar, tid, trap.value)).data.resolved, false, 'the trap answer once: an open try');
  const second = await grade(c.jar, tid, trap.value);
  eq([second.data.resolved, second.data.correct, second.data.trapWhy], [true, false, trap.why], 'and again: resolved wrong, the engine names the trap');
  const tev = await eventOf(tid);
  eq([tev.misconception, tev.misconceptionSource], [misconceptionIdForTrap(tq.subtopic, trap.why), 'trap'], 'the attempt is filed under what the engine diagnosed');
  eq(tev.dotpoint, tq.dotpoint, 'with its dot point');

  // Wrong with no diagnosis: filed under its topic alone. Revealed: not filed.
  const w = await issue(c.jar, PERCENT, 5151);
  await grade(c.jar, w.data.question.id, '123456');
  const wrongPlain = await grade(c.jar, w.data.question.id, '123457');
  eq([wrongPlain.data.resolved, wrongPlain.data.trapWhy], [true, null], 'a wrong answer the engine names no slip for');
  eq('misconception' in await eventOf(w.data.question.id), false, 'is not given an invented misconception');
  const r = await issue(c.jar, PERCENT, 6161);
  await post(`/v1/practice/${r.data.question.id}/reveal`, {}, c.jar);

  const book = await get('/v1/practice/notebook', c.jar);
  eq(book.status, 200, 'the notebook is served');
  eq([book.data.total, book.data.groups.length], [2, 2], 'two mistakes in two groups: the reveal is not filed');
  const g = book.data.groups.find(x => x.misconception?.id === tev.misconception);
  ok(!!g, 'one group is the diagnosed slip');
  eq([g.key, g.count, g.items.length, g.items[0].id, g.items[0].questionId, g.items[0].prompt, g.items[0].canTwin, g.items[0].fixed],
    [`${tq.subtopic}::${tev.misconception}`, 1, 1, tev.eventId, tid, tq.prompt, true, false], 'the group names the topic, the slip and the question it came from');
  const plainGroup = book.data.groups.find(x => x !== g);
  eq([plainGroup.misconception, plainGroup.key, plainGroup.items[0].questionId], [null, `${tq.subtopic}::unclassified`, w.data.question.id],
    'the undiagnosed wrong answer is filed under its topic with no invented misconception');
  eq((await get('/v1/practice/notebook', d.jar)).data.groups, [], 'another account sees none of it');

  // ── The twin ─────────────────────────────────────────────────────────────
  const stolen = await post(`/v1/practice/notebook/${tev.eventId}/twin`, {}, d.jar);
  eq([stolen.status, stolen.data.error?.code], [404, 'NOTEBOOK_ENTRY_NOT_FOUND'], 'another account cannot draw a twin of this entry');
  const revealedEv = await eventOf(r.data.question.id);
  eq((await post(`/v1/practice/notebook/${revealedEv.eventId}/twin`, {}, c.jar)).status, 404, 'a revealed attempt was never filed and has no twin');
  eq((await post(`/v1/practice/notebook/${tev.eventId}/twin`, { seed: 1 }, c.jar)).status, 400, 'a twin takes no parameters (no seed from the device)');
  const twin = await post(`/v1/practice/notebook/${tev.eventId}/twin`, {}, c.jar);
  eq(twin.status, 201, 'the owner draws a twin');
  const tw = twin.data.question;
  const twSealed = await sealed(tw.id);
  eq([tw.subtopic, twSealed._generator, tw.difficulty, tw.dotpoint, twin.data.twin.sameDotpoint], [tq.subtopic, PERCENT, tq.difficulty, tq.dotpoint, true], 'same generator, difficulty and dot point');
  ok(tw.prompt !== tq.prompt, 'but a different question');
  ok(!('answer' in tw) && !('steps' in tw) && !('traps' in tw) && !('seed' in tw), 'with no key, steps, traps or seed in it');
  eq(twSealed._practiceMode, 'review', 'issued as review practice');
  const twGrade = await grade(c.jar, tw.id, twSealed.answer.value);
  eq([twGrade.data.authoritative, twGrade.data.correct], [true, true], 'and marked by the server like any question');
  eq((await grade(d.jar, tw.id, twSealed.answer.value)).status, 404, 'another account cannot answer it');
  eq(twSealed._twinOf, tev.eventId, 'the twin is sealed with the mistake it retries');
  const fixedEntry = (await get('/v1/practice/notebook', c.jar)).data.groups.flatMap(x => x.items).find(i => i.id === tev.eventId);
  eq([fixedEntry.fixed, fixedEntry.retries, fixedEntry.review.due], [true, 1, false], 'answering the twin correctly marks the mistake fixed and ends its reviews');

  // ── The review queue ─────────────────────────────────────────────────────
  const queue = await get('/v1/practice/review-queue', c.jar);
  eq(queue.status, 200, 'the review queue is served');
  ok(queue.data.counted >= 1, 'it counts the dot points this account has been marked on');
  const row = [...queue.data.due, ...queue.data.upcoming];
  ok(row.every(x => x.subtopic && x.dotpoint && x.recall >= 0 && x.recall <= 1), 'each row names a chapter and dot point with a recall');
  eq((await get('/v1/practice/review-queue', d.jar)).data.counted, 0, 'another account\'s queue is its own');
  eq((await get('/v1/practice/review-queue', {})).status, 401, 'signed out, there is no queue');
  eq((await get('/v1/practice/notebook', {})).status, 401, 'nor a notebook');

  console.log(`HINTS AND NOTEBOOK: PASS — ${count}/${count} checks — the server serves and charges each rung in order and credits a correct answer with the weight left, the solution rung is a reveal, the notebook files every wrong resolution under what the engine diagnosed, twins are server-issued per account, and the review queue is the account's own.`);
} finally {
  await h.close();
  rmSync(scratch, { recursive: true, force: true });
}
