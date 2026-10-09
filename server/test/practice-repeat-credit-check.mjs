// Pri Learning · a repeat of content an account has already been shown the
// solution of is marked, and is recorded as a repeat — never as new work.
//
// Over real HTTP: however the same content comes to be issued again (the same
// request, with or without the device's recently-seen list, after a reveal or
// after a resolved answer), the server seals it as a repeat, and both the
// receipt and the server's own graded-attempt event say so. Another account's
// first sitting of that content is not a repeat.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const scratch = mkdtempSync(join(tmpdir(), 'pri-repeat-credit-'));
process.env.NODE_ENV = 'test'; // fixed seeds: the same content on demand
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = '6b'.repeat(32);
delete process.env.PRI_PUBLIC_ORIGIN;
const { startApp, registerAccount, verifyEmail } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
console.log(`engine: ${requestedEngine()}`);
const h = await startApp({ engine: requestedEngine() });
let count = 0;
const eq = (a, b, name) => { assert.deepEqual(a, b, name); count++; };
const post = (path, body, jar, headers = {}) => h.request(path, { method: 'POST', jar, body, headers });
const issue = (jar, seed) => post('/v1/practice/issue', { generator: 'c8-linear-equations-both-sides', difficulty: 2, seed, curriculum: 'in' }, jar);
const sealedAnswer = async id => JSON.parse((await h.db.get("SELECT response_json FROM idempotency_keys WHERE scope='practice-question' AND key=?", [id])).response_json).answer;
const eventOf = async id => { const row = await h.db.get("SELECT payload_json FROM learning_events WHERE kind='graded-attempt' AND entity_id=?", [id]); return row ? JSON.parse(row.payload_json) : null; };
let n = 0;
const grade = (jar, id, answer) => { const sid = `repeat-credit-${String(++n).padStart(4, '0')}`; return post(`/v1/practice/${id}/submit`, { submissionId: sid, answer: String(answer), mode: 'typed' }, jar, { 'Idempotency-Key': sid }); };

try {
  const a = await registerAccount(h, { email: 'repeat.a@example.test', deviceId: 'ipad-repeat-a' });
  const b = await registerAccount(h, { email: 'repeat.b@example.test', deviceId: 'ipad-repeat-b' });
  eq([(await verifyEmail(h, a.account.id)).status, (await verifyEmail(h, b.account.id)).status], [200, 200], 'two verified accounts');

  // first sitting, resolved by a correct answer
  const first = await issue(a.jar, 4242);
  eq([first.status, first.data.repeat ?? false], [201, false], 'a first sitting is not a repeat');
  const firstGrade = await grade(a.jar, first.data.question.id, (await sealedAnswer(first.data.question.id)).value);
  eq([firstGrade.data.correct, firstGrade.data.repeat ?? false], [true, false], 'its receipt is not a repeat');
  eq((await eventOf(first.data.question.id)).repeat ?? false, false, 'nor is its attempt');

  // the same content again, with no recently-seen list from the device
  const again = await issue(a.jar, 4242);
  eq([again.status, again.data.repeat, again.data.question.prompt === first.data.question.prompt], [201, true, true], 'the same content issued again is declared a repeat');
  const againGrade = await grade(a.jar, again.data.question.id, (await sealedAnswer(again.data.question.id)).value);
  eq([againGrade.data.authoritative, againGrade.data.correct, againGrade.data.repeat], [true, true, true], 'it is still marked, and its receipt says repeat');
  eq((await eventOf(again.data.question.id)).repeat, true, 'and so does the server\'s graded-attempt event');

  // revealed, then issued again: also a repeat
  const shown = await issue(a.jar, 9191);
  eq((await post(`/v1/practice/${shown.data.question.id}/reveal`, {}, a.jar)).status, 200, 'a second question is revealed');
  const afterReveal = await issue(a.jar, 9191);
  eq(afterReveal.data.repeat, true, 'content whose solution was revealed is a repeat when issued again');
  eq((await grade(a.jar, afterReveal.data.question.id, (await sealedAnswer(afterReveal.data.question.id)).value)).data.repeat, true, 'and is marked as one');

  // a copy issued BEFORE the first was resolved is not retroactively a repeat by seal,
  // but content issued after resolution always is
  const third = await issue(a.jar, 4242);
  eq(third.data.repeat, true, 'every later copy stays a repeat');

  // another account's first sitting of the same content is its own
  const other = await issue(b.jar, 4242);
  eq([other.status, other.data.repeat ?? false], [201, false], 'another account\'s first sitting of that content is not a repeat');

  // ── copies issued up front, before any of them is resolved ───────────────
  // None is a repeat when issued. Once one has shown its solution the others
  // are no longer new work, and the server says so when it marks them.
  const c = await registerAccount(h, { email: 'repeat.c@example.test', deviceId: 'ipad-repeat-c' });
  eq((await verifyEmail(h, c.account.id)).status, 200, 'a third verified account');
  const copies = [];
  for (let i = 0; i < 4; i++) copies.push(await issue(c.jar, 31337));
  eq(copies.map(x => [x.status, x.data.repeat ?? false]), copies.map(() => [201, false]), 'four copies of one question issued before any is resolved: none is a repeat yet');
  const key = (await sealedAnswer(copies[0].data.question.id)).value;
  const opened = await post(`/v1/practice/${copies[0].data.question.id}/reveal`, {}, c.jar);
  eq([opened.status, opened.data.repeat ?? false], [200, false], 'the first is revealed, as new work');
  const second = await grade(c.jar, copies[1].data.question.id, key);
  eq([second.data.correct, second.data.repeat], [true, true], 'a copy issued earlier and answered after the reveal is marked as a repeat');
  eq((await eventOf(copies[1].data.question.id)).repeat, true, 'and its graded-attempt event says repeat');
  const third2 = await post(`/v1/practice/${copies[2].data.question.id}/reveal`, {}, c.jar);
  eq(third2.data.repeat, true, 'revealing another earlier copy is a repeat too');
  eq((await eventOf(copies[2].data.question.id)).repeat, true, 'in its event as well');
  const wrongFirst = await grade(c.jar, copies[3].data.question.id, '987654');
  eq([wrongFirst.data.resolved, wrongFirst.data.repeat], [false, true], 'a first wrong try on the last copy already says repeat');

  // ── working with no final answer is an attempt, right or wrong ───────────
  const d = await registerAccount(h, { email: 'repeat.d@example.test', deviceId: 'ipad-repeat-d' });
  eq((await verifyEmail(h, d.account.id)).status, 200, 'a fourth verified account');
  const sub = (jar, id, answer, steps) => { const sid = `repeat-credit-${String(++n).padStart(4, '0')}`; return post(`/v1/practice/${id}/submit`, { submissionId: sid, answer, mode: 'typed', steps }, jar, { 'Idempotency-Key': sid }); };
  const probe = await issue(d.jar, 2024);
  const guess1 = await sub(d.jar, probe.data.question.id, '', ['x = 123456']);
  eq([guess1.status, guess1.data.invalid, guess1.data.resolved, guess1.data.triesLeft, guess1.data.marksEarned], [200, false, false, 1, 0], 'a false line with no final answer spends a try');
  const guess2 = await sub(d.jar, probe.data.question.id, '', ['x = 123457']);
  eq([guess2.status, guess2.data.resolved, guess2.data.correct, guess2.data.marksEarned], [200, true, false, 0], 'and a second one resolves the question: there is no free third check');
  eq((await sub(d.jar, probe.data.question.id, '', ['x = 1'])).status, 409, 'after which nothing more is checked');
  const empty = await issue(d.jar, 2025);
  const nothing = await sub(d.jar, empty.data.question.id, '', []);
  eq([nothing.data.invalid, nothing.data.triesLeft, nothing.data.stepReport, nothing.data.partial], [true, 1, null, null], 'a submission with neither answer nor working is still not an attempt, and says nothing');

  // ── true arithmetic that is not about the question earns nothing ─────────
  const padded = await issue(d.jar, 2026);
  const paddedGrade = await sub(d.jar, padded.data.question.id, '987654', ['3 + 4 = 7', '10 - 2 = 8', '5 * 5 = 25']);
  eq([paddedGrade.data.correct, paddedGrade.data.marksEarned, paddedGrade.data.partial?.awarded ?? 0], [false, 0, 0], 'a wrong answer with unrelated true arithmetic as working earns no method mark');

  // ── a prepared question names its account ────────────────────────────────
  const prep = await post('/v1/practice/prepare', { generator: 'c8-linear-equations-both-sides', difficulty: 2, curriculum: 'in' });
  eq(prep.status, 200, 'a prepared question');
  eq((await post('/v1/practice/issue', { prepared: prep.data.prepared }, d.jar)).status, 400, 'binding it without naming the account is refused');
  eq((await post('/v1/practice/issue', { prepared: prep.data.prepared, account: String(d.account.id) }, d.jar)).status, 201, 'and it is still there to bind for the account it names');

  // ── the grader's device id is not a device's to use ──────────────────────
  const g = await registerAccount(h, { email: 'repeat.g@example.test', deviceId: 'server-grader' });
  eq((await verifyEmail(h, g.account.id)).status, 200, 'an account whose device calls itself the grader');
  const taken = await post('/v1/sync/push', { schemaVersion: 1, deviceId: 'server-grader', events: [{ id: 'evt-grader-1', kind: 'practice-attempt', deviceId: 'server-grader', deviceSeq: 9007199254740991, entityId: 'q-grader-1', occurredAt: Date.now(), payload: {} }], entities: [] }, g.jar, { 'Idempotency-Key': 'grader-push-1' });
  eq([taken.status, taken.data?.error?.code], [400, 'SYNC_DEVICE_RESERVED'], 'cannot push events under it');
  for (const seed of [51, 52]) {
    const q = await issue(g.jar, seed);
    eq((await grade(g.jar, q.data.question.id, (await sealedAnswer(q.data.question.id)).value)).status, 200, `and that account's own answers are still marked (${seed})`);
  }

  console.log(`REPEAT CREDIT: PASS — ${count}/${count} checks — content an account has been shown the solution of is a repeat however and whenever it was issued; working without an answer always spends a try; unrelated arithmetic earns nothing.`);
} finally {
  await h.close();
  rmSync(scratch, { recursive: true, force: true });
}
