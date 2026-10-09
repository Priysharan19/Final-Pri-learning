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

  console.log(`REPEAT CREDIT: PASS — ${count}/${count} checks — content an account has been shown the solution of is marked as a repeat however it is issued again.`);
} finally {
  await h.close();
  rmSync(scratch, { recursive: true, force: true });
}
