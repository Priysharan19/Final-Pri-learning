// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · saved library resources through sync (plan F2)
//
// A saved resource is the entity kind `resource-bookmark` (entity id = the
// resource id, body exactly { present: true }), account-scoped, set-union.
// Held here: upsert and delete (a tombstone), two devices of one account see
// the same set, another account sees nothing and cannot change it, a wrong
// body or id is refused, the per-account cap is refused with a typed code,
// and the rows are in the account export and gone with the account.
//
//   node server/test/resource-bookmark-sync-check.mjs [--engine=postgres]
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const names = ['NODE_ENV', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_PUBLIC_ORIGIN'];
const prior = Object.fromEntries(names.map(name => [name, process.env[name]]));
const scratch = mkdtempSync(join(tmpdir(), 'pri-resource-bookmark-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = '67'.repeat(32);
delete process.env.PRI_PUBLIC_ORIGIN;

const { startApp, checks } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const { MAX_RESOURCE_BOOKMARKS } = await import('../platform/sync.js');

const c = checks();
const app = await startApp({ engine: requestedEngine() });
const db = app.db;
const PASSWORD = 'correct-horse-battery';
let n = 0;

async function signIn(label, deviceId) {
  const jar = {};
  const r = await app.request('/v1/account/register', { method: 'POST', jar, body: { email: `${label}@example.test`, name: label, password: PASSWORD, deviceId, isAdult: true } });
  c.eq(r.status, 201, `${label} registers`);
  await db.run('UPDATE accounts SET email_verified_at=? WHERE id=?', [Date.now(), r.data.account.id]);
  return { jar, id: r.data.account.id, deviceId };
}
const push = (who, entities) => app.request('/v1/sync/push', {
  method: 'POST', jar: who.jar, headers: { 'Idempotency-Key': `rb-${++n}` },
  body: { schemaVersion: 1, deviceId: who.deviceId, entities }
});
const save = (id, baseVersion = 0) => ({ kind: 'resource-bookmark', entityId: id, operation: 'upsert', baseVersion, body: { present: true } });
const live = async who => (await app.request('/v1/sync/pull/0', { jar: who.jar })).data.entities.filter(e => e.kind === 'resource-bookmark' && !e.tombstone).map(e => e.entityId).sort();

try {
  const alice = await signIn('alice-rb', 'dev-a1');
  const bob = await signIn('bob-rb', 'dev-b1');

  let r = await push(alice, [save('nsw-2024-paper'), save('other-paper')]);
  c.eq(r.status, 200, 'saving two resources is accepted');
  c.deq(await live(alice), ['nsw-2024-paper', 'other-paper'], 'both are held for the account');

  // A second device of the same account signs in and sees the same set.
  const second = { jar: {}, id: alice.id, deviceId: 'dev-a2' };
  const login = await app.request('/v1/account/login', { method: 'POST', jar: second.jar, body: { email: 'alice-rb@example.test', password: PASSWORD, deviceId: 'dev-a2' } });
  c.eq(login.status, 200, 'the second device signs in');
  c.deq(await live(second), ['nsw-2024-paper', 'other-paper'], 'the second device sees the first device\'s saved resources');

  // Set-union: the second device saves another one concurrently; both survive.
  r = await push(second, [save('third-paper')]);
  c.eq(r.status, 200, 'the second device saves a different resource');
  c.deq(await live(alice), ['nsw-2024-paper', 'other-paper', 'third-paper'], 'the union is held');

  // Removing = a delete (tombstone), at the version the device knows.
  r = await push(alice, [{ kind: 'resource-bookmark', entityId: 'other-paper', operation: 'delete', baseVersion: 1 }]);
  c.eq(r.status, 200, 'un-saving is accepted');
  c.deq(await live(second), ['nsw-2024-paper', 'third-paper'], 'and follows the account to the other device');

  // Isolation.
  c.deq(await live(bob), [], 'another account sees no saved resource');
  r = await push(bob, [save('nsw-2024-paper')]);
  c.eq(r.status, 200, 'another account saving the same resource id writes only its own row');
  c.eq((await db.get('SELECT COUNT(*) AS n FROM sync_entities WHERE kind=? AND entity_id=?', ['resource-bookmark', 'nsw-2024-paper'])).n, 2, 'one row per account');
  c.deq(await live(alice), ['nsw-2024-paper', 'third-paper'], 'and Alice\'s set is unchanged by it');

  // Validation.
  for (const [label, entity] of [
    ['a body with a question id', { ...save('x-paper-1'), body: { present: true, questionId: 'q1' } }],
    ['present: false', { ...save('x-paper-1'), body: { present: false } }],
    ['an empty body', { ...save('x-paper-1'), body: {} }],
    ['an id that is not a resource id', save('Not A Resource')],
    ['an upper-case id', save('ABC-PAPER')]
  ]) {
    r = await push(alice, [entity]);
    c.eq(r.status, 400, `${label} is refused`);
  }

  // The cap, refused with a typed code; un-saving frees room.
  const many = Array.from({ length: MAX_RESOURCE_BOOKMARKS }, (_, i) => `cap-paper-${i}`);
  const have = (await live(bob)).length;
  for (let i = 0; i < many.length - have; i += 100) {
    const chunk = many.slice(i, Math.min(i + 100, many.length - have));
    r = await push(bob, chunk.map(id => save(id)));
    c.eq(r.status, 200, `filling the account (${i + chunk.length})`);
  }
  c.eq((await live(bob)).length, MAX_RESOURCE_BOOKMARKS, 'the account holds exactly the cap');
  r = await push(bob, [save('one-too-many')]);
  c.eq(r.data?.error?.code, 'SYNC_RESOURCE_BOOKMARK_LIMIT', 'the next save is refused with a typed code');
  c.eq(r.status, 422, 'as a 422');

  // Export carries the rows (Alice's only) and account deletion removes them.
  const exp = await app.request('/v1/account/export', { jar: alice.jar });
  if (exp.status === 200) {
    const kinds = (exp.data.entities || []).filter(e => e.kind === 'resource-bookmark').map(e => e.entity_id || e.entityId);
    c.ok(kinds.includes('nsw-2024-paper') && kinds.includes('third-paper'), 'the account export carries the saved resources');
    c.ok(!JSON.stringify(exp.data).includes('cap-paper-'), 'and nothing of another account');
  } else c.eq(exp.data?.error?.code, 'REAUTH_REQUIRED', 'the export asks for a fresh password first');
  await db.run('DELETE FROM accounts WHERE id=?', [alice.id]);
  c.eq((await db.get('SELECT COUNT(*) AS n FROM sync_entities WHERE account_id=?', [alice.id])).n, 0, 'deleting the account deletes its saved resources');
} finally {
  await app.close();
  rmSync(scratch, { recursive: true, force: true });
  for (const name of names) {
    if (prior[name] === undefined) delete process.env[name];
    else process.env[name] = prior[name];
  }
}

console.log(`engine: ${app.engine}`);
console.log(`RESOURCE BOOKMARK SYNC — PASS — ${c.count()}/${c.count()} checks — saved resources follow the account, stay inside it, and are capped.`);
