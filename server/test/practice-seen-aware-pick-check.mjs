// Pri Learning · the server does not hand back a question the account has already resolved.
//
//   node server/test/practice-seen-aware-pick-check.mjs                   → SQLite
//   node server/test/practice-seen-aware-pick-check.mjs --engine=postgres → Postgres (with-postgres.mjs)
//
// The question picker re-draws past the request's `avoid` list: the content a
// device has just been served. That list lives in the device's memory, so it
// is empty after a relaunch and on every other device. The repeat verdict, on
// the other hand, reads the account's own seen records on the server. Before
// this suite the picker never consulted those records, so after a relaunch the
// server could pick content the student had already resolved and then mark it
// a repeat: the student was handed solved work for no credit while fresh
// questions were left in the pool (C3 on #695; the golden journey's
// "Progress 4 ≠ 5").
//
// A cell with seven distinct questions (c10-circles, D1 — an India bank, D15). The account resolves
// six of them; then, with an EMPTY avoid list, every issue must be the seventh
// until it too is resolved. Before the fix each such issue was a resolved one
// with probability 6/7. Then:
//   · a second device (another session, its own empty list) gets the same;
//   · a question the device is avoiding but has not resolved is still
//     preferred to resolved ones (it can earn credit; they cannot);
//   · with the whole cell resolved, the issue is a flagged repeat, promptly,
//     and its correct answer earns nothing (the exhaustion contract);
//   · records that have expired no longer count, and one account's records
//     never steer another's questions.
// Real /v1 routes, real store and marker; on Postgres as pri_server under RLS.
import './support/hermetic.mjs';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const scratch = mkdtempSync(join(tmpdir(), 'pri-seen-pick-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = '6b'.repeat(32);
process.env.PRI_FREE_PRACTICE_PER_DAY = '100000';
delete process.env.PRI_PUBLIC_ORIGIN;
const { startApp, registerAccount, verifyEmail } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const { loadAllBanks, generateQuestion } = await import('../../client/src/engine/generators/index.js');
const engine = requestedEngine();
console.log(`engine: ${engine}`);
const h = await startApp({ engine });
let count = 0;
const eq = (a, b, name) => { assert.deepEqual(a, b, name); count++; };
const ok = (cond, name) => { assert.ok(cond, name); count++; };

const CELL = { generator: 'c10-circles', difficulty: 1, curriculum: 'in', mode: 'practice' };
const PASSWORD = 'correct-horse-battery';
const post = (path, body, jar, headers = {}) => h.request(path, { method: 'POST', jar, body, headers });
const issue = (jar, extra = {}) => post('/v1/practice/issue', { ...CELL, ...extra }, jar);
const sealedAnswer = async id => JSON.parse((await h.db.get("SELECT response_json FROM idempotency_keys WHERE scope='practice-question' AND key=?", [id])).response_json).answer;
let n = 0;
const submit = (jar, id, answer) => {
  const sid = `seen-pick-${String(++n).padStart(4, '0')}`;
  return post(`/v1/practice/${id}/submit`, { submissionId: sid, answer: String(answer), mode: 'typed' }, jar, { 'Idempotency-Key': sid });
};
const resolve = async (jar, seed) => {
  const q = await issue(jar, { seed });
  assert.equal(q.status, 201, `seeded issue ${seed}: ${q.status}`);
  const s = await submit(jar, q.data.question.id, (await sealedAnswer(q.data.question.id)).value);
  assert.deepEqual([s.status, s.data?.correct, s.data?.resolved], [200, true, true], `resolve seed ${seed}`);
  return q.data.question.contentHash;
};

try {
  // The cell's seven contents, one seed for each (generation is deterministic).
  await loadAllBanks();
  const seedOf = new Map();
  for (let s = 1; seedOf.size < 7 && s < 20_000; s++) {
    const q = generateQuestion(CELL.generator, CELL.difficulty, s);
    if (!seedOf.has(q.contentHash)) seedOf.set(q.contentHash, s);
  }
  const seeds = [...seedOf.values()];
  eq(seeds.length, 7, 'the cell holds seven distinct questions');
  let distinct = 0;
  for (let s = 20_000; s < 22_000; s++) if (!seedOf.has(generateQuestion(CELL.generator, CELL.difficulty, s).contentHash)) distinct++;
  eq(distinct, 0, 'and no eighth (2,000 further draws)');

  // ── the picker itself, on a scripted draw: the budget grows with what the
  // account has resolved, exactly as with what the device avoids ────────────
  const { chooseQuestionFor, ensureBanks } = await import('../platform/practice.js');
  const { seenKeysOf } = await import('../platform/contentSeen.js');
  await ensureBanks();
  const hashes = [...seedOf.keys()];
  const doneKeys = new Set(seeds.slice(0, 6).flatMap(seed => seenKeysOf(generateQuestion(CELL.generator, CELL.difficulty, seed))));
  const records = { reads: 0, all: async (sql, params) => { records.reads++; return params.slice(2).filter(key => doneKeys.has(key)).map(key => ({ key })); } };
  // `before` draws of resolved content, then the fresh one.
  const scripted = before => { let i = 0; return () => (i++ < before ? seeds[i % 6] : seeds[6]); };
  const pick = async before => { records.reads = 0; return chooseQuestionFor(records, 'acct_scripted', { ...CELL, avoid: new Set(), trap: null }, Date.now(), { draw: scripted(before) }); };
  const early = await pick(0);
  eq([early.q.contentHash, early.repeat, records.reads], [hashes[6], false, 1], 'a fresh first draw ends the seek after one read of the records');
  const late = await pick(60);
  eq([late.q.contentHash, late.repeat], [hashes[6], false], 'a fresh question 61st in line is still found: six resolved contents widen the budget to 98 draws');
  ok(records.reads <= 3, `in ${records.reads} reads of the records`);
  const beyond = await pick(400);
  eq([hashes.slice(0, 6).includes(beyond.q.contentHash), beyond.repeat], [true, true], 'beyond the budget the seek stops and serves a flagged repeat (deterministic exhaustion)');
  ok(records.reads <= 5, `after a bounded ${records.reads} reads`);

  const reg = await registerAccount(h, { email: 'seen.pick@example.test', deviceId: 'ipad-seen-pick' });
  eq((await verifyEmail(h, reg.account.id)).status, 200, 'a verified account');
  const resolved = new Set();
  for (const seed of seeds.slice(0, 6)) resolved.add(await resolve(reg.jar, seed));
  eq(resolved.size, 6, 'six of the seven are resolved on the iPad');
  const lastIssue = await issue(reg.jar, { seed: seeds[6] });
  const last = lastIssue.data.question.contentHash;
  ok(!resolved.has(last) && lastIssue.data.repeat !== true, 'the seventh is not resolved and is not a repeat');

  // ── after a relaunch: the device's avoid list is empty ──────────────────
  await h.db.run('DELETE FROM rate_limits');
  const relaunch = [];
  for (let i = 0; i < 8; i++) relaunch.push(await issue(reg.jar));
  eq(relaunch.map(r => r.status), Array(8).fill(201), 'eight issues with an empty avoid list');
  eq(relaunch.map(r => r.data.question.contentHash), Array(8).fill(last), 'every one is the question not yet resolved, never a resolved one');
  eq(relaunch.map(r => r.data.repeat === true), Array(8).fill(false), 'and none is flagged a repeat');

  // ── on a second device ─────────────────────────────────────────────────
  const phone = {};
  eq((await post('/v1/account/login', { email: 'seen.pick@example.test', password: PASSWORD, deviceId: 'phone-seen-pick' }, phone)).status, 200, 'signed in on a phone');
  const onPhone = [];
  for (let i = 0; i < 5; i++) onPhone.push(await issue(phone));
  eq(onPhone.map(r => r.data.question.contentHash), Array(5).fill(last), 'the phone, with its own empty list, is given the unresolved question too');

  // ── avoided but unresolved beats resolved ───────────────────────────────
  const avoiding = [];
  for (let i = 0; i < 4; i++) avoiding.push(await issue(reg.jar, { avoid: [last] }));
  eq(avoiding.map(r => r.data.question.contentHash), Array(4).fill(last),
    'when the device avoids the only unresolved question, it is still preferred to resolved ones (it can earn credit, they cannot)');

  // ── the whole cell resolved: a flagged repeat, promptly ─────────────────
  await h.db.run('DELETE FROM rate_limits');
  const grade = await submit(reg.jar, relaunch[0].data.question.id, (await sealedAnswer(relaunch[0].data.question.id)).value);
  eq([grade.status, grade.data?.correct, grade.data?.repeat === true], [200, true, false], 'the seventh is answered: correct, and new work');
  resolved.add(last);
  const started = Date.now();
  const exhausted = [];
  for (let i = 0; i < 6; i++) exhausted.push(await issue(reg.jar));
  const perIssue = (Date.now() - started) / 6;
  eq(exhausted.map(r => r.status), Array(6).fill(201), 'an exhausted cell still issues');
  eq(exhausted.map(r => resolved.has(r.data.question.contentHash) && r.data.repeat === true), Array(6).fill(true), 'each a resolved question, flagged a repeat');
  ok(perIssue < 1500, `and promptly (${perIssue.toFixed(0)} ms an issue)`);
  const again = await submit(reg.jar, exhausted[0].data.question.id, (await sealedAnswer(exhausted[0].data.question.id)).value);
  eq([again.status, again.data?.correct, again.data?.repeat], [200, true, true], 'its correct answer is marked, as a repeat');
  const recorded = (await h.db.all("SELECT payload_json FROM learning_events WHERE kind='graded-attempt' AND entity_id=?", [exhausted[0].data.question.id])).map(r => JSON.parse(r.payload_json));
  eq(recorded.map(e => [e.correct, e.repeat === true]), [[true, true]], 'and is recorded as a repeat: no first-sitting credit, no progress');

  // ── expired records no longer count ─────────────────────────────────────
  await h.db.run("UPDATE idempotency_keys SET expires_at=? WHERE account_id=? AND scope='practice-content'", [Date.now() - 1000, reg.account.id]);
  const afterExpiry = await issue(reg.jar);
  eq([afterExpiry.status, afterExpiry.data.repeat === true], [201, false], 'once every record has expired, the cell is new again');

  // ── one account's records never steer another's ─────────────────────────
  await h.db.run('DELETE FROM rate_limits');
  const other = await registerAccount(h, { email: 'seen.pick.other@example.test', deviceId: 'ipad-seen-pick-other' });
  eq((await verifyEmail(h, other.account.id)).status, 200, 'a second account');
  const theirs = [];
  for (let i = 0; i < 8; i++) theirs.push(await issue(other.jar));
  eq(theirs.map(r => r.data.repeat === true), Array(8).fill(false), 'its questions are never repeats');
  ok(new Set(theirs.map(r => r.data.question.contentHash)).size > 1, 'and are drawn from the whole cell, not steered by the first account');

  console.log(`PRACTICE SEEN-AWARE PICK: PASS — ${count}/${count} checks — after a relaunch or on another device the server passes over content the account has resolved, while fresh content remains; an exhausted cell is a prompt flagged repeat with no credit; expired records and other accounts do not count, on ${engine}.`);
} finally {
  await h.close?.();
  rmSync(scratch, { recursive: true, force: true });
}
