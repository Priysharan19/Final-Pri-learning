// Pri Learning · a solution shown and a correct answer sent at the same time.
//
//   node server/test/practice-reveal-submit-race-check.mjs                   → SQLite
//   node server/test/practice-reveal-submit-race-check.mjs --engine=postgres → Postgres (with-postgres.mjs)
//
// A student who opens the solution while a correct answer for the same
// question is still being marked must not get credit for it: the question
// resolves exactly once, either as answered (the reveal is then refused) or as
// revealed (the answer is then refused, or recorded with no credit). The
// submit is marked off the request thread and commits later, so this is a
// real window. The guard is in practice.js: the commit re-reads the
// question's state under the account's sync lock, the same lock /reveal
// commits under, and a reveal writes the question's completion record.
//
// Real /v1 routes, real store, real marker; two sessions of one account (two
// devices) as well as one. The answer is the sealed one, so every submit that
// is allowed to commit is correct. Synthetic accounts; no provider is called.
import './support/hermetic.mjs';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const scratch = mkdtempSync(join(tmpdir(), 'pri-reveal-race-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = '6b'.repeat(32);
process.env.PRI_FREE_PRACTICE_PER_DAY = '100000';
delete process.env.PRI_PUBLIC_ORIGIN;
const { startApp, registerAccount, verifyEmail } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const engine = requestedEngine();
console.log(`engine: ${engine}`);
const h = await startApp({ engine });
let count = 0;
const eq = (a, b, name) => { assert.deepEqual(a, b, name); count++; };
const ok = (cond, name) => { assert.ok(cond, name); count++; };
const post = (path, body, jar, headers = {}) => h.request(path, { method: 'POST', jar, body, headers });
const issue = (jar, seed) => post('/v1/practice/issue', { generator: 'c8-linear-equations-both-sides', difficulty: 2, seed, curriculum: 'in' }, jar);
const sealedAnswer = async id => JSON.parse((await h.db.get("SELECT response_json FROM idempotency_keys WHERE scope='practice-question' AND key=?", [id])).response_json).answer;
const rows = async (scope, key) => (await h.db.all('SELECT response_json FROM idempotency_keys WHERE scope=? AND key=?', [scope, key])).map(r => JSON.parse(r.response_json));
const events = async id => (await h.db.all("SELECT payload_json FROM learning_events WHERE kind='graded-attempt' AND entity_id=?", [id])).map(r => JSON.parse(r.payload_json));
let n = 0;
const submit = (jar, id, answer) => {
  const sid = `race-${String(++n).padStart(5, '0')}`;
  return post(`/v1/practice/${id}/submit`, { submissionId: sid, answer: String(answer), mode: 'typed' }, jar, { 'Idempotency-Key': sid });
};
const reveal = (jar, id) => post(`/v1/practice/${id}/reveal`, {}, jar);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const ROUNDS = Number(process.env.PRI_RACE_ROUNDS || 24);

try {
  const reg = await registerAccount(h, { email: 'race.a@example.test', deviceId: 'ipad-race-a' });
  eq((await verifyEmail(h, reg.account.id)).status, 200, 'a verified account');
  const phone = {};
  const login = await h.request('/v1/account/login', { method: 'POST', jar: phone, body: { email: 'race.a@example.test', password: 'correct-horse-battery', deviceId: 'phone-race-a' } });
  eq(login.status, 200, 'signed in on a second device');

  const outcomes = { answered: 0, revealed: 0 };
  for (let round = 0; round < ROUNDS; round++) {
    await h.db.run('DELETE FROM rate_limits');
    // Alternate: the same device, then the second device revealing; and which request leaves first.
    const revealJar = round % 2 === 0 ? reg.jar : phone;
    const issued = await issue(reg.jar, 70_000 + round);
    eq(issued.status, 201, `round ${round}: issued`);
    const id = issued.data.question.id;
    const answer = (await sealedAnswer(id)).value;
    // The reveal leaves 0 to ~40 ms after the submit, so the commit order
    // varies across rounds: early reveals win, late ones lose.
    const delay = Math.round((round / Math.max(1, ROUNDS - 1)) * 40);
    const [s, r] = await Promise.all([submit(reg.jar, id, answer), sleep(delay).then(() => reveal(revealJar, id))]);

    const completion = await rows('practice-completion', id);
    const evs = await events(id);
    eq(completion.length, 1, `round ${round}: the question resolves exactly once`);
    const creditedEvents = evs.filter(e => e.correct === true && e.revealed !== true && Number(e.creditedMarks ?? e.marksEarned ?? 0) > 0);

    if (r.status === 200) {
      // Revealed first: no answer may be credited.
      outcomes.revealed++;
      eq(completion[0].revealed, true, `round ${round}: the completion is the reveal`);
      ok(!(s.status === 200 && s.data?.correct === true && s.data?.revealed !== true && Number(s.data?.creditedMarks ?? 0) > 0),
        `round ${round}: a correct answer racing a reveal that won earns no credit (submit ${s.status} ${s.data?.error?.code ?? ''})`);
      if (s.status !== 200) eq(s.data?.error?.code, 'QUESTION_ALREADY_GRADED', `round ${round}: the answer is refused because the question was resolved`);
      eq(creditedEvents.length, 0, `round ${round}: no credited attempt was recorded`);
    } else {
      // Answered first: the reveal is refused and the answer keeps its credit.
      outcomes.answered++;
      eq([r.status, r.data?.error?.code], [409, 'QUESTION_ALREADY_GRADED'], `round ${round}: a reveal after the answer resolved is refused`);
      eq([s.status, s.data?.correct, s.data?.authoritative], [200, true, true], `round ${round}: the answer that won is marked correct`);
      eq(completion[0].revealed ?? false, false, `round ${round}: the completion is the answer`);
      eq(creditedEvents.length, 1, `round ${round}: exactly one credited attempt`);
    }
    eq(evs.length <= 1, true, `round ${round}: at most one graded attempt`);
  }
  console.log(`  outcomes over ${ROUNDS} rounds: ${JSON.stringify(outcomes)}`);
  ok(outcomes.answered + outcomes.revealed === ROUNDS, 'every round resolved one way or the other');
  ok(outcomes.answered > 0 && outcomes.revealed > 0, `both orders were exercised (${outcomes.answered} answered first, ${outcomes.revealed} revealed first)`);

  // The reveal's answer is not usable afterwards on a fresh copy either: a copy
  // issued after the reveal is a repeat and its correct answer earns nothing.
  await h.db.run('DELETE FROM rate_limits');
  const shown = await issue(reg.jar, 80_001);
  eq((await reveal(phone, shown.data.question.id)).status, 200, 'revealed on the second device');
  const copy = await issue(reg.jar, 80_001);
  const copyGrade = await submit(reg.jar, copy.data.question.id, (await sealedAnswer(copy.data.question.id)).value);
  eq([copy.data.repeat, copyGrade.data.correct, copyGrade.data.repeat], [true, true, true], 'a fresh copy after the reveal is a repeat: marked, but as a repeat');

  console.log(`PRACTICE REVEAL/SUBMIT RACE: PASS — ${count}/${count} checks — a solution shown and a correct answer sent together resolve the question once, on one or two devices; an answer that loses to a reveal earns no credit, on ${engine}.`);
} finally {
  await h.close?.();
  rmSync(scratch, { recursive: true, force: true });
}
