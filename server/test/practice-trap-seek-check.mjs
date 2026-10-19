// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the misconception seek on /v1/practice/issue
//
// A device that has seen the same slip in two sittings asks the server for a
// question that can spring it again: `trap: { owner, key }`. The server picks
// the question itself and answers with `trapDelivered: true` only when the
// question it escrowed really carries a designed distractor that maps to that
// key. This suite boots the shipped /v1 app and proves over real HTTP that:
//
//   1. a malformed `trap` is refused (400 PRACTICE_ISSUE_INVALID);
//   2. with a fixed test seed, a question that carries the trap is attested
//      (`trapDelivered: true`) and one that does not is not (field absent);
//   3. unseeded, every attestation is true of the question the server
//      escrowed: its stored traps map to the requested key;
//   4. a generator with no form for the key still issues (201), unattested;
//   5. the trap's explanation and the repair opportunities are disclosed only
//      by the reply that resolves the question, never while it is open;
//   6. the seek and its evidence are per account: another account cannot
//      grade, reveal or replay a trapped question, and asking for the first
//      account's key gets it its own question.
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const keys = ['NODE_ENV', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_PUBLIC_ORIGIN'];
const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const scratch = mkdtempSync(join(tmpdir(), 'pri-trap-seek-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = 'f6'.repeat(32);
delete process.env.PRI_PUBLIC_ORIGIN;
const { startApp, checks, registerAccount, verifyEmail } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const { loadAllBanks, generateQuestion } = await import('../../client/src/engine/generators/index.js');
const { misconceptionIdForTrap } = await import('../../client/src/engine/misconceptions.js');

const c = checks();
const h = await startApp({ engine: requestedEngine() });
await loadAllBanks();

const OWNER = 'c8-linear-equations';
const GEN = 'c8-linear-equations-both-sides';
const TRAPPED_SEED = 1; // d1 seed 1 carries a numeric trap
const PLAIN_SEED = 7; // d1 seed 7 carries none
const keysOf = q => [...(Array.isArray(q?.traps) ? q.traps : []).map(t => t?.why), ...Object.values(q?.answer?.optionTraps || {})]
  .filter(Boolean).map(why => misconceptionIdForTrap(OWNER, why));
const trapped = generateQuestion(GEN, 1, TRAPPED_SEED);
const plain = generateQuestion(GEN, 1, PLAIN_SEED);
const KEY = keysOf(trapped)[0];

try {
  c.ok(typeof KEY === 'string' && KEY.length > 0, 'the fixture seed carries a designed trap');
  c.eq(keysOf(plain).length, 0, 'and the plain seed carries none');

  const a = await registerAccount(h, { email: 'trap.seek.a@example.test', deviceId: 'ipad-trap-a' });
  c.eq(a.status, 201, 'the first student account exists');
  c.eq((await verifyEmail(h, a.account.id)).status, 200, 'and is verified');
  const b = await registerAccount(h, { email: 'trap.seek.b@example.test', deviceId: 'ipad-trap-b' });
  c.eq(b.status, 201, 'the second student account exists');
  c.eq((await verifyEmail(h, b.account.id)).status, 200, 'and is verified');

  const issue = (jar, body) => h.request('/v1/practice/issue', { method: 'POST', jar, body: { curriculum: 'in', ...body } });
  const submit = (jar, qid, submissionId, answer) => h.request(`/v1/practice/${qid}/submit`, {
    method: 'POST', jar, headers: { 'Idempotency-Key': submissionId }, body: { submissionId, answer, mode: 'typed' }
  });
  const escrowedOf = async (accountId, qid) => {
    const row = await h.db.get("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-question' AND key=?", [accountId, qid]);
    return row ? JSON.parse(row.response_json) : null;
  };
  const trap = { owner: OWNER, key: KEY };

  // 1 · malformed targets
  for (const [name, bad] of [
    ['an array', [OWNER, KEY]], ['an extra key', { ...trap, label: 'x' }], ['an empty owner', { owner: '', key: KEY }],
    ['an empty key', { owner: OWNER, key: '' }], ['a key past 200 characters', { owner: OWNER, key: 'k'.repeat(201) }],
    ['an owner past 120 characters', { owner: 'o'.repeat(121), key: KEY }], ['a string', KEY], ['a number key', { owner: OWNER, key: 7 }]
  ]) {
    const refused = await issue(a.jar, { generator: GEN, difficulty: 1, trap: bad });
    c.eq(refused.status, 400, `a trap that is ${name} is refused`);
    c.eq(refused.data?.error?.code, 'PRACTICE_ISSUE_INVALID', `${name}: coded as an invalid issue request`);
  }

  // 2 · fixed seeds: attested exactly when the question carries it
  const hit = await issue(a.jar, { generator: GEN, difficulty: 1, seed: TRAPPED_SEED, trap });
  c.eq(hit.status, 201, 'a seeded question that carries the trap is issued');
  c.eq(hit.data.trapDelivered, true, 'and attested as carrying it');
  const miss = await issue(a.jar, { generator: GEN, difficulty: 1, seed: PLAIN_SEED, trap });
  c.eq(miss.status, 201, 'a seeded question without the trap is still issued');
  c.ok(!('trapDelivered' in miss.data), 'and carries no attestation');
  const unasked = await issue(a.jar, { generator: GEN, difficulty: 1, seed: TRAPPED_SEED });
  c.ok(!('trapDelivered' in unasked.data), 'a question issued without a trap request carries no attestation either');
  const publicKeys = JSON.stringify(hit.data);
  c.ok(!/"traps"|"optionTraps"|"why"/.test(publicKeys), 'the attested issue reply discloses no trap text');

  // 3 · unseeded: every attestation is true of the escrowed question
  let attested = 0;
  for (let i = 0; i < 10; i++) {
    const r = await issue(a.jar, { generator: GEN, difficulty: 1, trap });
    c.eq(r.status, 201, `unseeded seek ${i + 1}: issued`);
    const stored = await escrowedOf(a.account.id, r.data.question.id);
    const carries = keysOf(stored).includes(KEY);
    if (r.data.trapDelivered === true) attested += 1;
    c.eq(r.data.trapDelivered === true, carries, `unseeded seek ${i + 1}: attested exactly when the escrowed question carries the trap`);
  }
  c.ok(attested > 0, `the seek finds a carrying form at least once in ten (${attested}/10)`);

  // 4 · a generator with no form for the key
  const none = await issue(a.jar, { generator: 'c8-linear-equations-verification', difficulty: 3, trap });
  c.eq(none.status, 201, 'a generator with no form for the key still issues');
  c.ok(!('trapDelivered' in none.data), 'unattested');

  // 5 · disclosure only on resolution
  const qid = hit.data.question.id;
  const value = String(trapped.traps.find(t => misconceptionIdForTrap(OWNER, t.why) === KEY).value);
  const first = await submit(a.jar, qid, 'trap-seek-first', value);
  c.eq(first.status, 200, 'the trap value is marked');
  c.eq(first.data.correct, false, 'as wrong');
  c.eq(first.data.resolved, false, 'leaving the second try');
  c.eq(first.data.trapWhy, null, 'the open reply names no misconception');
  c.ok(!('repairOpportunities' in first.data), 'and discloses no repair opportunities');
  const second = await submit(a.jar, qid, 'trap-seek-second', value);
  c.eq(second.data.resolved, true, 'the second wrong try resolves the question');
  c.ok(typeof second.data.trapWhy === 'string' && misconceptionIdForTrap(OWNER, second.data.trapWhy) === KEY, 'the resolving reply names the requested misconception');
  c.ok(Array.isArray(second.data.repairOpportunities) && second.data.repairOpportunities.some(why => misconceptionIdForTrap(OWNER, why) === KEY),
    'and lists it among the repair opportunities');

  // 6 · per account
  const foreign = await submit(b.jar, qid, 'trap-seek-second', value);
  c.eq(foreign.status, 404, 'another account cannot replay the trapped question\'s submission');
  c.ok(!JSON.stringify(foreign.data || {}).includes(second.data.trapWhy), 'and learns nothing of its misconception');
  c.eq((await h.request(`/v1/practice/${qid}/reveal`, { method: 'POST', jar: b.jar, body: {} })).status, 404, 'nor reveal it');
  const theirs = await issue(b.jar, { generator: GEN, difficulty: 1, seed: TRAPPED_SEED, trap });
  c.eq(theirs.data.trapDelivered, true, 'a second account asking for the same key is attested for its own question');
  c.ok(theirs.data.question.id !== qid, 'under its own id');
  c.ok(await escrowedOf(b.account.id, qid) === null, 'the first account\'s escrow is not the second account\'s');
  c.eq((await issue({}, { generator: GEN, difficulty: 1, trap })).status, 401, 'no session, no seek');
} finally {
  await h.close();
  rmSync(scratch, { recursive: true, force: true });
  for (const key of keys) {
    if (before[key] === undefined) delete process.env[key];
    else process.env[key] = before[key];
  }
}

console.log(`engine: ${h.engine}`);
console.log(`PRACTICE TRAP SEEK: PASS — ${c.count()}/${c.count()} checks — a misconception target is validated, attested only when the escrowed question carries it, disclosed only on resolution, and private to its account.`);
