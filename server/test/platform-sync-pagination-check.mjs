import assert from 'node:assert/strict';
import { createPlatformDb, nextSyncCursor } from '../platform/db.js';
import { syncPullPage } from '../platform/sync.js';

const db = createPlatformDb(':memory:');
const now = Date.now();

function addAccount(id, email) {
  db.prepare(`INSERT INTO accounts(id,email,name,role,created_at,updated_at)
    VALUES (?, ?, ?, 'student', ?, ?)`).run(id, email, id, now, now);
}

function addEvent(accountId, id, deviceId, deviceSeq) {
  const cursor = nextSyncCursor(db);
  db.prepare(`INSERT INTO learning_events(server_cursor,id,account_id,device_id,device_seq,kind,entity_id,occurred_at,payload_json,created_at)
    VALUES (?,?,?,?,?,'practice-progress',NULL,?, '{}',?)`)
    .run(cursor, id, accountId, deviceId, deviceSeq, now, now);
  return cursor;
}

function addEntity(accountId, entityId, version = 1) {
  const cursor = nextSyncCursor(db);
  db.prepare(`INSERT INTO sync_entities(account_id,kind,entity_id,version,server_cursor,body_json,tombstone,updated_at)
    VALUES (?,'bookmark',?,?,?,'{"present":true}',0,?)`)
    .run(accountId, entityId, version, cursor, now);
  return cursor;
}

addAccount('acct-a', 'a@example.test');
addAccount('acct-b', 'b@example.test');

const a1 = addEvent('acct-a', 'evt-a-1', 'device-a', 1);
const b1 = addEvent('acct-b', 'evt-b-1', 'device-b', 1);

// Regression: another account advancing the global sync cursor must not make
// acct-a believe it has another page forever.
const isolated = syncPullPage(db, 'acct-a', 0);
assert.equal(isolated.cursor, a1);
assert.equal(isolated.hasMore, false);
assert.deepEqual(isolated.events.map(event => event.id), ['evt-a-1']);
assert.equal(isolated.entities.length, 0);
assert.ok(b1 > isolated.cursor, 'fixture must advance the global cursor with another account');

// Account-scoped pagination must continue across gaps created by other users,
// then stop exactly when this account has no remaining rows.
const a2 = addEntity('acct-a', 'question-1');
addEvent('acct-b', 'evt-b-2', 'device-b', 2);
const a3 = addEvent('acct-a', 'evt-a-2', 'device-a', 2);

const page1 = syncPullPage(db, 'acct-a', a1, 1);
assert.equal(page1.cursor, a2);
assert.equal(page1.hasMore, true);
assert.equal(page1.events.length, 0);
assert.deepEqual(page1.entities.map(entity => entity.entityId), ['question-1']);

const page2 = syncPullPage(db, 'acct-a', page1.cursor, 1);
assert.equal(page2.cursor, a3);
assert.equal(page2.hasMore, false);
assert.deepEqual(page2.events.map(event => event.id), ['evt-a-2']);
assert.equal(page2.entities.length, 0);

const empty = syncPullPage(db, 'acct-a', page2.cursor, 1);
assert.equal(empty.cursor, a3);
assert.equal(empty.hasMore, false);
assert.equal(empty.events.length, 0);
assert.equal(empty.entities.length, 0);

db.close();
console.log('platform sync pagination: ok');
