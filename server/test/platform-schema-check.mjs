import assert from 'node:assert/strict';
import { createPlatformDb, nextSyncCursor } from '../platform/db.js';

const db = createPlatformDb(':memory:');
try {
  const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name));
  for (const required of [
    'accounts','account_identities','account_sessions','account_tokens','learning_events','sync_entities',
    'entitlement_snapshots','billing_events','classes','class_members','assignments','assignment_submissions','assignment_feedback',
    'content_revisions','issue_reports','audit_log','idempotency_keys','rate_limits'
  ]) assert.ok(tables.has(required), `missing platform table ${required}`);
  assert.equal(db.prepare("SELECT value FROM platform_meta WHERE key='schema_version'").get()?.value, '3');

  const now = Date.now();
  db.prepare(`INSERT INTO accounts(id,email,name,password_hash,role,created_at,updated_at)
    VALUES ('acct_1','Student@Example.com','Student','hash','student',?,?)`).run(now, now);
  assert.throws(() => db.prepare(`INSERT INTO accounts(id,email,name,password_hash,role,created_at,updated_at)
    VALUES ('acct_duplicate','student@example.com','Duplicate','hash','student',?,?)`).run(now, now), /UNIQUE/i,
    'account emails must be unique case-insensitively');
  db.prepare(`INSERT INTO accounts(id,email,name,password_hash,role,created_at,updated_at)
    VALUES ('acct_2','other@example.com','Other','hash','student',?,?)`).run(now, now);

  db.prepare(`INSERT INTO learning_events(id,account_id,device_id,device_seq,kind,entity_id,occurred_at,payload_json,created_at)
    VALUES ('evt_shared','acct_1','ipad-a',1,'attempt','q1',?,'{}',?)`).run(now, now);
  assert.throws(() => db.prepare(`INSERT INTO learning_events(id,account_id,device_id,device_seq,kind,entity_id,occurred_at,payload_json,created_at)
    VALUES ('evt_2','acct_1','ipad-a',1,'attempt','q2',?,'{}',?)`).run(now, now), /UNIQUE/i,
    'device sequence retries must be idempotent rather than duplicating learning events');
  assert.throws(() => db.prepare(`INSERT INTO learning_events(id,account_id,device_id,device_seq,kind,entity_id,occurred_at,payload_json,created_at)
    VALUES ('evt_shared','acct_1','ipad-a',2,'attempt','q2',?,'{}',?)`).run(now, now), /UNIQUE/i,
    'an event id must remain unique inside one account');
  db.prepare(`INSERT INTO learning_events(id,account_id,device_id,device_seq,kind,entity_id,occurred_at,payload_json,created_at)
    VALUES ('evt_shared','acct_2','ipad-a',1,'attempt','q9',?,'{}',?)`).run(now, now);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM learning_events WHERE id='evt_shared'").get().n, 2,
    'the same device-local event id must be legal in two different accounts');

  const c1 = nextSyncCursor(db), c2 = nextSyncCursor(db);
  assert.equal(c2, c1 + 1, 'server sync cursor must be canonical and monotonic');

  db.prepare(`INSERT INTO sync_entities(account_id,kind,entity_id,version,server_cursor,body_json,tombstone,updated_at)
    VALUES ('acct_1','profile','self',1,?,'{}',0,?)`).run(c2, now);
  const entity = db.prepare(`SELECT version,tombstone FROM sync_entities WHERE account_id='acct_1' AND kind='profile' AND entity_id='self'`).get();
  assert.deepEqual(entity, { version: 1, tombstone: 0 });

  assert.throws(() => db.prepare(`INSERT INTO content_revisions(id,content_key,curriculum_version,status,source_json,body_json,revision,created_at)
    VALUES ('bad','x','2026-27','unreviewed','{}','{}',1,?)`).run(now), /CHECK/i,
    'unreviewed content must not invent an unsupported publishing status');

  db.prepare(`INSERT INTO entitlement_snapshots(account_id,plan,status,provider,source_version,updated_at)
    VALUES ('acct_1','free','free','none',0,?)`).run(now);
  assert.equal(db.prepare(`SELECT status FROM entitlement_snapshots WHERE account_id='acct_1'`).get().status, 'free');

  console.log(`PLATFORM SCHEMA — PASS — ${tables.size} tables inspected; tenant-scoped event identity, sync cursor, CMS and entitlement invariants hold.`);
} finally {
  db.close();
}
