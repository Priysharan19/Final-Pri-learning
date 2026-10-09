// Pri Learning · the server chooses creditable questions.
//
// Over real HTTP, in the product's own mode (NODE_ENV is not "test"):
//  · a caller-chosen seed is refused, and no seed is ever disclosed;
//  · a signed-out student can be shown a prepared question to start on;
//  · one eligible account binds that question once, gets the same question,
//    and can be marked on it; a second account cannot take it up;
//  · a forged or altered token is refused.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const scratch = mkdtempSync(join(tmpdir(), 'pri-server-question-'));
delete process.env.NODE_ENV;
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = '5a'.repeat(32);
process.env.PRI_AUTH_EMAIL_PROVIDER = 'test';
delete process.env.PRI_PUBLIC_ORIGIN;
const { startApp, registerAccount, verifyEmail } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const h = await startApp({ engine: requestedEngine() });

let count = 0;
const ok = (cond, name) => { assert.ok(cond, name); count++; };
const eq = (a, b, name) => { assert.deepEqual(a, b, name); count++; };
const PRIVATE = ['answer', 'solution', 'solutionText', 'steps', 'traps', 'stepcheck', 'seed', 'expected', 'markScheme', '_practiceMode'];
const leaks = (value, path = '') => {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([k, v]) => [...(PRIVATE.includes(k) ? [path + k] : []), ...leaks(v, path + k + '.')]);
};
const REQUEST = { generator: 'c8-linear-equations-both-sides', difficulty: 2, curriculum: 'in', mode: 'practice' };
const post = (path, body, jar = {}, headers = {}) => h.request(path, { method: 'POST', jar, body, headers });

try {
  const a = await registerAccount(h, { email: 'server.question.a@example.test', deviceId: 'ipad-sq-a' });
  const b = await registerAccount(h, { email: 'server.question.b@example.test', deviceId: 'ipad-sq-b' });
  eq([a.status, b.status], [201, 201], 'two real accounts exist');
  eq([(await verifyEmail(h, a.account.id)).status, (await verifyEmail(h, b.account.id)).status], [200, 200], 'and are verified');

  // ── the server chooses ──────────────────────────────────────────────────
  const seeded = await post('/v1/practice/issue', { ...REQUEST, seed: 104729 }, a.jar);
  eq([seeded.status, seeded.data?.error?.code], [400, 'PRACTICE_SEED_NOT_ALLOWED'], 'a caller-chosen seed is refused');
  const first = await post('/v1/practice/issue', REQUEST, a.jar);
  eq(first.status, 201, 'a question is issued without a seed');
  eq(leaks(first.data), [], 'the issue discloses no seed, answer or solution');
  const prompts = new Set([first.data.question.prompt]);
  for (let i = 0; i < 5; i++) prompts.add((await post('/v1/practice/issue', REQUEST, a.jar)).data.question.prompt);
  ok(prompts.size > 1, 'repeated requests do not return one fixed question');
  const avoid = [first.data.question.contentHash];
  const fresh = await post('/v1/practice/issue', { ...REQUEST, avoid }, a.jar);
  ok(fresh.status === 201 && (fresh.data.repeat === true || fresh.data.question.contentHash !== avoid[0]), 'a recently seen question is avoided or declared a repeat');
  eq((await post('/v1/practice/issue', { ...REQUEST, avoid: ['<script>'] }, a.jar)).status, 400, 'a malformed recently-seen list is refused');
  eq((await post('/v1/practice/issue', { ...REQUEST, answer: '1' }, a.jar)).status, 400, 'a caller cannot attach an answer to an issue');

  // ── prepared, signed out ────────────────────────────────────────────────
  const prepared = await post('/v1/practice/prepare', REQUEST);
  eq(prepared.status, 200, 'a signed-out student is shown a prepared question');
  eq(leaks(prepared.data), [], 'the prepared question discloses no seed, answer or solution');
  ok(!('id' in prepared.data.question), 'a prepared question is not yet an issued question');
  const token = prepared.data.prepared;
  ok(typeof token === 'string' && token.length > 40 && !/"s"|seed/.test(Buffer.from(token.split('.').pop(), 'base64url').toString('latin1')), 'the token is sealed');
  eq((await post('/v1/practice/prepare', { ...REQUEST, seed: 1 })).status, 400, 'a seed cannot be chosen when preparing either');
  eq((await post('/v1/practice/issue', { prepared: token })).status, 401, 'binding needs a signed-in account');

  const bound = await post('/v1/practice/issue', { prepared: token }, a.jar);
  eq(bound.status, 201, 'the account binds the prepared question');
  eq(bound.data.question.prompt, prepared.data.question.prompt, 'it is the same question the student was working on');
  eq(bound.data.accountId, String(a.account.id), 'issued under that account');
  const again = await post('/v1/practice/issue', { prepared: token }, a.jar);
  eq([again.status, again.data?.question?.id], [201, bound.data.question.id], 'the same account retrying gets the same issue back');
  const other = await post('/v1/practice/issue', { prepared: token }, b.jar);
  eq([other.status, other.data?.error?.code], [409, 'PRACTICE_PREPARED_USED'], 'a second account cannot take the same prepared question up');
  eq((await post('/v1/practice/issue', { prepared: token, generator: REQUEST.generator }, a.jar)).status, 400, 'nothing may ride along with a prepared token');
  const forged = token.slice(0, -6) + (token.endsWith('AAAAAA') ? 'BBBBBB' : 'AAAAAA');
  eq((await post('/v1/practice/issue', { prepared: forged }, a.jar)).data?.error?.code, 'PRACTICE_PREPARED_INVALID', 'an altered token is refused');
  eq((await post('/v1/practice/issue', { prepared: 'v1.AAAA.BBBB.CCCC' }, a.jar)).data?.error?.code, 'PRACTICE_PREPARED_INVALID', 'a made-up token is refused');

  // The claim and the issue are one transaction: two binds racing from the
  // same account (a double tap, a retry crossing the first reply) end as one
  // issued question, never as a burnt token.
  const racing = (await post('/v1/practice/prepare', REQUEST)).data.prepared;
  const [r1, r2] = await Promise.all([post('/v1/practice/issue', { prepared: racing }, b.jar), post('/v1/practice/issue', { prepared: racing }, b.jar)]);
  eq([r1.status, r2.status], [201, 201], 'two racing binds by one account both succeed');
  eq(r1.data.question.id, r2.data.question.id, 'as the same issued question');
  eq((await post('/v1/practice/issue', { prepared: racing }, a.jar)).status, 409, 'and the other account still cannot take it up');

  // A device holding several profiles names the account it means. The wrong
  // session is refused before the prepared question is taken up, so the right
  // account can still bind it; nothing is escrowed under the wrong one.
  const shared = (await post('/v1/practice/prepare', REQUEST)).data.prepared;
  const escrowedA = async () => Number((await h.db.get("SELECT COUNT(*) AS n FROM idempotency_keys WHERE account_id=? AND scope='practice-question'", [a.account.id])).n);
  const before = await escrowedA();
  const wrongSession = await post('/v1/practice/issue', { prepared: shared, account: String(b.account.id) }, a.jar);
  eq([wrongSession.status, wrongSession.data?.error?.code], [409, 'PRACTICE_ACCOUNT_MISMATCH'], 'a bind sent under another account\'s session is refused');
  eq(await escrowedA(), before, 'and escrows nothing under that session\'s account');
  eq((await post('/v1/practice/issue', { ...REQUEST, account: String(b.account.id) }, a.jar)).data?.error?.code, 'PRACTICE_ACCOUNT_MISMATCH', 'a plain issue under the wrong session is refused the same way');
  const rightSession = await post('/v1/practice/issue', { prepared: shared, account: String(b.account.id) }, b.jar);
  eq(rightSession.status, 201, 'the prepared question is still there for the account it was meant for');

  // ── and it is marked like any issued question ───────────────────────────
  const qid = bound.data.question.id;
  const grade = await post(`/v1/practice/${qid}/submit`, { submissionId: 'prepared-wrong-0001', answer: '987654321', mode: 'typed' }, a.jar, { 'Idempotency-Key': 'prepared-wrong-0001' });
  eq([grade.status, grade.data?.authoritative, grade.data?.correct, grade.data?.marksEarned], [200, true, false, 0], 'a wrong answer on the bound question is server-marked 0');
  eq((await post(`/v1/practice/${qid}/submit`, { submissionId: 'prepared-foreign-001', answer: '1', mode: 'typed' }, b.jar, { 'Idempotency-Key': 'prepared-foreign-001' })).status, 404, 'the other account cannot mark it');
  // An entry that is not an attempt costs nothing, so it must not come back
  // with line-by-line verdicts: they would be a free answer oracle.
  const probe = await post('/v1/practice/issue', REQUEST, a.jar);
  const free = await post(`/v1/practice/${probe.data.question.id}/submit`, { submissionId: 'oracle-probe-000001', answer: '((', mode: 'typed', steps: 'x = 1\nx = 2\nx = 3' }, a.jar, { 'Idempotency-Key': 'oracle-probe-000001' });
  eq([free.status, free.data?.invalid, free.data?.triesLeft, free.data?.stepReport ?? null, free.data?.partial ?? null], [200, true, 1, null, null],
    'an unreadable final answer with working returns no step verdicts and spends nothing');
  const reveal = await post(`/v1/practice/${qid}/reveal`, {}, a.jar);
  ok(reveal.status === 200 && reveal.data.solution, 'the owner can be shown its solution by the server');

  // The Postgres runner only counts a suite that says which engine it ran on.
  console.log(`engine: ${h.engine}`);
  console.log(`SERVER-CHOSEN QUESTIONS: PASS — ${count}/${count} checks — the server picks the seed, discloses none, and a prepared question is bound once by one account.`);
} finally {
  await h.close();
  rmSync(scratch, { recursive: true, force: true });
}
