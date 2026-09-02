import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPlatformDb } from '../platform/db.js';

const dir = mkdtempSync(join(tmpdir(), 'pri-platform-migration-'));
const path = join(dir, 'platform.db');
const now = Date.now();

try {
  // Construct the exact dangerous v2 invariant: event id globally unique.
  const old = new Database(path);
  old.pragma('foreign_keys = ON');
  old.exec(`
    CREATE TABLE platform_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    INSERT INTO platform_meta(key,value) VALUES ('schema_version','2');
    CREATE TABLE accounts (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      name TEXT NOT NULL,
      password_hash TEXT,
      email_verified_at INTEGER,
      role TEXT NOT NULL DEFAULT 'student',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER
    );
    CREATE TABLE learning_events (
      server_cursor INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT NOT NULL UNIQUE,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      device_id TEXT NOT NULL,
      device_seq INTEGER NOT NULL,
      kind TEXT NOT NULL,
      entity_id TEXT,
      occurred_at INTEGER,
      payload_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(account_id, device_id, device_seq)
    );
    CREATE INDEX idx_learning_events_pull ON learning_events(account_id, server_cursor);
  `);
  old.prepare(`INSERT INTO accounts(id,email,name,password_hash,role,created_at,updated_at)
    VALUES ('acct_a','a@example.test','A','hash','student',?,?)`).run(now, now);
  old.prepare(`INSERT INTO learning_events(server_cursor,id,account_id,device_id,device_seq,kind,entity_id,occurred_at,payload_json,created_at)
    VALUES (41,'evt-reused','acct_a','same-ipad',1,'practice-progress','q1',?,'{"correct":true}',?)`).run(now, now);
  old.close();

  const db = createPlatformDb(path);
  try {
    assert.equal(db.prepare("SELECT value FROM platform_meta WHERE key='schema_version'").get()?.value, '3');
    const preserved = db.prepare("SELECT server_cursor,id,account_id,device_id,device_seq,payload_json FROM learning_events WHERE account_id='acct_a'").get();
    assert.deepEqual(preserved, {
      server_cursor: 41,
      id: 'evt-reused',
      account_id: 'acct_a',
      device_id: 'same-ipad',
      device_seq: 1,
      payload_json: '{"correct":true}'
    });

    db.prepare(`INSERT INTO accounts(id,email,name,password_hash,role,created_at,updated_at)
      VALUES ('acct_b','b@example.test','B','hash','student',?,?)`).run(now, now);
    db.prepare(`INSERT INTO learning_events(id,account_id,device_id,device_seq,kind,entity_id,occurred_at,payload_json,created_at)
      VALUES ('evt-reused','acct_b','same-ipad',1,'practice-progress','q2',?,'{}',?)`).run(now, now);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM learning_events WHERE id='evt-reused'").get().n, 2,
      'migration must allow the same local event id under another account');

    assert.throws(() => db.prepare(`INSERT INTO learning_events(id,account_id,device_id,device_seq,kind,entity_id,occurred_at,payload_json,created_at)
      VALUES ('evt-reused','acct_b','same-ipad',2,'practice-progress','q3',?,'{}',?)`).run(now, now), /UNIQUE/i,
      'event ids remain unique inside the same account');
    assert.deepEqual(db.pragma('foreign_key_check'), [], 'migration must leave referential integrity valid');
  } finally {
    db.close();
  }

  console.log('PLATFORM MIGRATION — PASS — v2 global event identity migrates transactionally to account scope without losing existing events.');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
