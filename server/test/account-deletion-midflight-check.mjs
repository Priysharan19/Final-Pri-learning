// Pri Learning · an account deleted while one of its answers is being marked.
//
//   node server/test/account-deletion-midflight-check.mjs                   → SQLite
//   node server/test/account-deletion-midflight-check.mjs --engine=postgres → Postgres (with-postgres.mjs)
//
// Marking runs off the request thread and commits afterwards. A student may
// delete their account in that window. Deletion is final: whatever order the
// two commit in, nothing of the account may remain afterwards — no attempt,
// no progress, no receipt, no session — and the late answer must not be
// recorded against a deleted account or revive it. Another account is
// untouched throughout.
//
// The marker is the real one behind the test worker, which can be told to
// take a set time (support/marker-test-worker.mjs); the answer is the sealed
// one, so a mark that commits is a correct one. Real /v1 routes, real store;
// on Postgres as pri_server under RLS. Every table with an account_id column
// is swept, so a table added later is covered without editing this file.
import './support/hermetic.mjs';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scratch = mkdtempSync(join(tmpdir(), 'pri-delete-midflight-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = '6b'.repeat(32);
process.env.PRI_FREE_PRACTICE_PER_DAY = '100000';
delete process.env.PRI_PUBLIC_ORIGIN;
const { startApp, registerAccount, verifyEmail } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const { magic } = await import('./support/marker-test-worker.mjs');
const { useMarkerPoolForTests, closeMarkerPool } = await import('../platform/markerPool.js');
const TEST_ENTRY = fileURLToPath(new URL('./support/marker-test-worker.mjs', import.meta.url));

const engine = requestedEngine();
console.log(`engine: ${engine}`);
await useMarkerPoolForTests({ entry: TEST_ENTRY });
const h = await startApp({ engine });
let count = 0;
const eq = (a, b, name) => { assert.deepEqual(a, b, name); count++; };
const ok = (cond, name) => { assert.ok(cond, name); count++; };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const PASSWORD = 'correct-horse-battery';
const post = (path, body, jar, headers = {}) => h.request(path, { method: 'POST', jar, body, headers });
const issue = (jar, seed) => post('/v1/practice/issue', { generator: 'c8-linear-equations-both-sides', difficulty: 2, seed, curriculum: 'in' }, jar);
const sealedAnswer = async id => JSON.parse((await h.db.get("SELECT response_json FROM idempotency_keys WHERE scope='practice-question' AND key=?", [id])).response_json).answer;
let n = 0;
const submit = (jar, id, answer) => {
  const sid = `midflight-${String(++n).padStart(4, '0')}`;
  return post(`/v1/practice/${id}/submit`, { submissionId: sid, answer: String(answer), mode: 'typed' }, jar, { 'Idempotency-Key': sid });
};
const deleteAccount = (jar, accountId) => h.request('/v1/account', { method: 'DELETE', jar, body: { password: PASSWORD, accountId } });

// Every table with an account_id column, on either engine.
async function accountTables() {
  if (engine === 'postgres') {
    const rows = await h.db.all("SELECT table_name FROM information_schema.columns WHERE table_schema='pri' AND column_name='account_id' ORDER BY table_name");
    return rows.map(r => `pri.${r.table_name}`);
  }
  const tables = await h.db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
  const out = [];
  for (const { name } of tables) {
    const cols = await h.db.all(`SELECT name FROM pragma_table_info('${name.replace(/'/g, "''")}')`);
    if (cols.some(c => c.name === 'account_id')) out.push(name);
  }
  return out;
}
async function rowsLeft(tables, accountId) {
  const left = {};
  for (const table of tables) {
    const row = await h.db.get(`SELECT COUNT(*) AS n FROM ${table} WHERE account_id=?`, [accountId]);
    if (Number(row.n) > 0) left[table] = Number(row.n);
  }
  const accountRow = await h.db.get(`SELECT COUNT(*) AS n FROM ${engine === 'postgres' ? 'pri.accounts' : 'accounts'} WHERE id=?`, [accountId]);
  if (Number(accountRow.n) > 0) left.accounts = Number(accountRow.n);
  return left;
}

try {
  const tables = await accountTables();
  ok(tables.length >= 10, `swept: ${tables.length} account-bearing tables`);
  const bystander = await registerAccount(h, { email: 'midflight.bystander@example.test', deviceId: 'ipad-bystander' });
  eq((await verifyEmail(h, bystander.account.id)).status, 200, 'a bystander account');
  const byQ = await issue(bystander.jar, 90_000);
  eq((await submit(bystander.jar, byQ.data.question.id, (await sealedAnswer(byQ.data.question.id)).value)).data?.correct, true, 'the bystander has a marked attempt');
  const bystanderBefore = await rowsLeft(tables, bystander.account.id);

  // The mark takes ~600 ms; the deletion leaves at a different point each round:
  // before the mark starts, while it runs, and after it has committed.
  const delays = [0, 50, 150, 300, 450, 900, 1400];
  const outcomes = [];
  for (const [round, delay] of delays.entries()) {
    await h.db.run('DELETE FROM rate_limits');
    const who = await registerAccount(h, { email: `midflight.${round}@example.test`, deviceId: `ipad-midflight-${round}` });
    eq((await verifyEmail(h, who.account.id)).status, 200, `round ${round}: a verified account`);
    const id = who.account.id;
    const q = await issue(who.jar, 91_000 + round);
    eq(q.status, 201, `round ${round}: issued`);
    const answer = `${(await sealedAnswer(q.data.question.id)).value} ${magic('spin', 600)}`;
    const [s, d] = await Promise.all([submit(who.jar, q.data.question.id, answer), sleep(delay).then(() => deleteAccount(who.jar, id))]);
    outcomes.push([delay, s.status, d.status]);
    eq(d.status, 200, `round ${round} (delete at +${delay} ms): the deletion succeeds`);
    ok(s.status === 200 || s.status === 401 || s.status === 404,
      `round ${round}: the answer is either marked before the deletion or refused (got ${s.status} ${s.data?.error?.code ?? ''})`);
    eq(await rowsLeft(tables, id), {}, `round ${round} (submit ${s.status}, delete at +${delay} ms): nothing of the deleted account remains in any table`);
    // A late retry of the same answer with the dead session cannot revive anything.
    const retry = await submit(who.jar, q.data.question.id, (await sealedAnswer(q.data.question.id).catch(() => ({ value: '0' }))).value);
    eq(retry.status, 401, `round ${round}: a retry after deletion is refused`);
    eq(await rowsLeft(tables, id), {}, `round ${round}: and leaves nothing behind`);
  }
  console.log(`  [delete delay ms, submit status, delete status]: ${JSON.stringify(outcomes)}`);
  ok(outcomes.some(([, s]) => s === 200) && outcomes.some(([, s]) => s !== 200), 'both orders were exercised: some answers committed before the deletion, some were refused');
  // rate_limits is cleared by this test between rounds, so it is left out of the bystander comparison.
  const durable = left => Object.fromEntries(Object.entries(left).filter(([t]) => !/(^|\.)rate_limits$/.test(t)));
  eq(durable(await rowsLeft(tables, bystander.account.id)), durable(bystanderBefore), 'the bystander account is untouched');

  console.log(`ACCOUNT DELETION MID-FLIGHT: PASS — ${count}/${count} checks — an account deleted while its answer is being marked leaves nothing in ${tables.length} account tables, whichever commits first; retries are refused; another account is untouched, on ${engine}.`);
} finally {
  await h.close?.();
  await closeMarkerPool?.();
  rmSync(scratch, { recursive: true, force: true });
}
