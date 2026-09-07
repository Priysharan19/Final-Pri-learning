import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { platformDatabasePath } from './config.js';

const here = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PATH = join(here, '..', 'data', 'pri-learning-platform.db');
const SCHEMA_VERSION = 6;


/**
 * Widen the delivery CHECK constraints to admit a guardian consent email.
 *
 * A no-op once the constraint already allows it, so this costs one PRAGMA on
 * every boot after the first. Rebuilt inside one transaction with every row
 * copied, because a half-applied rebuild of the table holding unsent
 * verification email would lose somebody their account.
 */
function widenAuthKinds(db) {
  const allows = (table, needle) => {
    const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(table);
    return !row?.sql || String(row.sql).includes(needle);
  };
  if (allows('account_tokens', "'guardian-consent'") && allows('auth_delivery_outbox', "'guardian-consent'")) return;

  // Two details, both of which cost real data when I got them wrong here:
  //
  //  · auth_delivery_outbox.token_id references account_tokens ON DELETE
  //    CASCADE, so dropping account_tokens during a rebuild takes every unsent
  //    email with it. Foreign keys must genuinely be off, not merely read.
  //  · SQLite IGNORES `PRAGMA foreign_keys` inside a transaction, so it has to
  //    be set outside one — which is why this is not in the transaction below.
  const foreignKeysWereOn = db.pragma('foreign_keys', { simple: true }) === 1;
  db.pragma('foreign_keys = OFF');
  try {
    db.transaction(() => {
      if (!allows('account_tokens', "'guardian-consent'")) {
        db.exec(`
          CREATE TABLE account_tokens_v6 (
            id TEXT PRIMARY KEY,
            account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
            purpose TEXT NOT NULL CHECK(purpose IN ('verify-email','reset-password','guardian-consent')),
            token_hash TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL,
            consumed_at INTEGER
          );
          INSERT INTO account_tokens_v6(id,account_id,purpose,token_hash,created_at,expires_at,consumed_at)
            SELECT id,account_id,purpose,token_hash,created_at,expires_at,consumed_at FROM account_tokens;
          DROP TABLE account_tokens;
          ALTER TABLE account_tokens_v6 RENAME TO account_tokens;
          CREATE INDEX IF NOT EXISTS idx_account_tokens_account ON account_tokens(account_id, purpose, expires_at);
        `);
      }
      if (!allows('auth_delivery_outbox', "'guardian-consent'")) {
        const columns = db.pragma('table_info(auth_delivery_outbox)').map(c => c.name);
        const extra = ['attempt_count', 'last_attempt_at', 'next_attempt_at', 'last_error_code', 'provider_message_id']
          .filter(c => columns.includes(c));
        const list = ['id', 'account_id', 'kind', 'destination', 'token_id', 'token_ciphertext', 'created_at', 'delivered_at', ...extra].join(',');
        db.exec(`
          CREATE TABLE auth_delivery_outbox_v6 (
            id TEXT PRIMARY KEY,
            account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
            kind TEXT NOT NULL CHECK(kind IN ('verify-email','reset-password','guardian-consent')),
            destination TEXT NOT NULL,
            token_id TEXT NOT NULL REFERENCES account_tokens(id) ON DELETE CASCADE,
            token_ciphertext TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            delivered_at INTEGER,
            attempt_count INTEGER NOT NULL DEFAULT 0,
            last_attempt_at INTEGER,
            next_attempt_at INTEGER,
            last_error_code TEXT,
            provider_message_id TEXT
          );
          INSERT INTO auth_delivery_outbox_v6(${list}) SELECT ${list} FROM auth_delivery_outbox;
          DROP TABLE auth_delivery_outbox;
          ALTER TABLE auth_delivery_outbox_v6 RENAME TO auth_delivery_outbox;
          CREATE INDEX IF NOT EXISTS idx_auth_delivery_pending
            ON auth_delivery_outbox(delivered_at, next_attempt_at, created_at);
        `);
      }
    })();
  } finally {
    db.pragma(`foreign_keys = ${foreignKeysWereOn ? 'ON' : 'OFF'}`);
  }
}

function addColumnIfMissing(db, table, column, ddl) {
  const safeTable = String(table).replaceAll("'", "''");
  const columns = new Set(db.pragma(`table_info('${safeTable}')`).map(row => row.name));
  if (columns.has(column)) return false;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  return true;
}

function uniqueIndexColumns(db, table) {
  const safeTable = String(table).replaceAll("'", "''");
  return db.pragma(`index_list('${safeTable}')`)
    .filter(index => !!index.unique)
    .map(index => {
      const safeName = String(index.name).replaceAll("'", "''");
      return db.pragma(`index_info('${safeName}')`).map(row => row.name);
    });
}

function migrateLearningEventIdentity(db) {
  const uniqueSets = uniqueIndexColumns(db, 'learning_events');
  const hasGlobalEventId = uniqueSets.some(columns => columns.length === 1 && columns[0] === 'id');
  if (!hasGlobalEventId) return false;

  // v1/v2 made event ids globally unique. Event ids are generated by a local
  // device and are meaningful only inside one account; the same physical iPad
  // can later be deliberately linked to another account and legitimately reuse
  // that local id. Rebuild transactionally so all cursors and payloads survive.
  db.transaction(() => {
    db.exec(`
      DROP TABLE IF EXISTS learning_events_v3;
      CREATE TABLE learning_events_v3 (
        server_cursor INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT NOT NULL,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        device_id TEXT NOT NULL,
        device_seq INTEGER NOT NULL,
        kind TEXT NOT NULL,
        entity_id TEXT,
        occurred_at INTEGER,
        payload_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        UNIQUE(account_id, id),
        UNIQUE(account_id, device_id, device_seq)
      );
      INSERT INTO learning_events_v3(
        server_cursor,id,account_id,device_id,device_seq,kind,entity_id,occurred_at,payload_json,created_at
      )
      SELECT server_cursor,id,account_id,device_id,device_seq,kind,entity_id,occurred_at,payload_json,created_at
      FROM learning_events ORDER BY server_cursor;
      DROP TABLE learning_events;
      ALTER TABLE learning_events_v3 RENAME TO learning_events;
      CREATE INDEX idx_learning_events_pull ON learning_events(account_id, server_cursor);
    `);
  })();
  return true;
}

export function createPlatformDb(path = DEFAULT_PATH) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  // WAL + NORMAL keeps every committed transaction durable against process
  // crashes (the WAL is fsynced at checkpoint) while avoiding an fsync per
  // commit on the single-writer volume. Graceful shutdown checkpoints the WAL
  // (closePlatformDb) so the main file is complete for backup/restore.
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.exec(`
    CREATE TABLE IF NOT EXISTS platform_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      name TEXT NOT NULL,
      password_hash TEXT,
      email_verified_at INTEGER,
      role TEXT NOT NULL DEFAULT 'student' CHECK(role IN ('student','teacher','support','admin')),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS account_identities (
      provider TEXT NOT NULL CHECK(provider IN ('password','google','apple')),
      provider_subject TEXT NOT NULL,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      email_at_link TEXT,
      linked_at INTEGER NOT NULL,
      PRIMARY KEY(provider, provider_subject),
      UNIQUE(account_id, provider)
    );

    CREATE TABLE IF NOT EXISTS account_sessions (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      device_id TEXT NOT NULL,
      user_agent_hash TEXT,
      created_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      revoked_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_account ON account_sessions(account_id, expires_at);

    CREATE TABLE IF NOT EXISTS account_tokens (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      purpose TEXT NOT NULL CHECK(purpose IN ('verify-email','reset-password','guardian-consent')),
      token_hash TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      consumed_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_account_tokens_account ON account_tokens(account_id, purpose, expires_at);

    -- Append-only learning events. Client clocks are evidence only; server_cursor
    -- is the canonical ordering. Local ids/sequences are account-scoped so a
    -- shared or relinked physical device cannot collide across tenants.
    CREATE TABLE IF NOT EXISTS learning_events (
      server_cursor INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT NOT NULL,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      device_id TEXT NOT NULL,
      device_seq INTEGER NOT NULL,
      kind TEXT NOT NULL,
      entity_id TEXT,
      occurred_at INTEGER,
      payload_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(account_id, id),
      UNIQUE(account_id, device_id, device_seq)
    );
    CREATE INDEX IF NOT EXISTS idx_learning_events_pull ON learning_events(account_id, server_cursor);

    -- Mutable replicated entities use optimistic versions rather than blind LWW.
    -- The service applies kind-specific conflict rules before updating this table.
    CREATE TABLE IF NOT EXISTS sync_entities (
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      server_cursor INTEGER NOT NULL,
      body_json TEXT,
      tombstone INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY(account_id, kind, entity_id)
    );
    CREATE INDEX IF NOT EXISTS idx_sync_entities_pull ON sync_entities(account_id, server_cursor);

    CREATE TABLE IF NOT EXISTS sync_cursors (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      value INTEGER NOT NULL
    );
    INSERT OR IGNORE INTO sync_cursors(id, value) VALUES (1, 0);

    CREATE TABLE IF NOT EXISTS entitlement_snapshots (
      account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
      plan TEXT NOT NULL DEFAULT 'free',
      status TEXT NOT NULL DEFAULT 'free',
      provider TEXT,
      product_id TEXT,
      current_period_end INTEGER,
      grace_until INTEGER,
      offline_until INTEGER,
      source_version INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS billing_events (
      provider TEXT NOT NULL,
      event_id TEXT NOT NULL,
      account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
      event_type TEXT NOT NULL,
      verified INTEGER NOT NULL DEFAULT 0,
      payload_digest TEXT NOT NULL,
      received_at INTEGER NOT NULL,
      applied_at INTEGER,
      PRIMARY KEY(provider, event_id)
    );

    CREATE TABLE IF NOT EXISTS classes (
      id TEXT PRIMARY KEY,
      teacher_account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      join_code_hash TEXT NOT NULL UNIQUE,
      join_code TEXT,
      join_code_rotated_at INTEGER,
      created_at INTEGER NOT NULL,
      archived_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS class_members (
      class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      student_account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      joined_at INTEGER NOT NULL,
      removed_at INTEGER,
      PRIMARY KEY(class_id, student_account_id)
    );

    CREATE TABLE IF NOT EXISTS assignments (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      teacher_account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      specification_json TEXT NOT NULL,
      due_at INTEGER,
      created_at INTEGER NOT NULL,
      archived_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_assignments_class ON assignments(class_id, created_at);

    CREATE TABLE IF NOT EXISTS assignment_submissions (
      assignment_id TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
      student_account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      state TEXT NOT NULL CHECK(state IN ('started','submitted','returned')),
      summary_json TEXT NOT NULL DEFAULT '{}',
      started_at INTEGER NOT NULL,
      submitted_at INTEGER,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY(assignment_id, student_account_id)
    );

    CREATE TABLE IF NOT EXISTS assignment_feedback (
      assignment_id TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
      student_account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      teacher_account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      feedback_json TEXT NOT NULL DEFAULT '{}',
      returned_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY(assignment_id, student_account_id)
    );

    CREATE TABLE IF NOT EXISTS content_revisions (
      id TEXT PRIMARY KEY,
      content_key TEXT NOT NULL,
      curriculum_version TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('draft','review','approved','published','retired')),
      author_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
      reviewer_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
      source_json TEXT NOT NULL,
      body_json TEXT NOT NULL,
      revision INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      published_at INTEGER,
      UNIQUE(content_key, revision)
    );
    CREATE INDEX IF NOT EXISTS idx_content_release ON content_revisions(content_key, status, revision);

    CREATE TABLE IF NOT EXISTS issue_reports (
      id TEXT PRIMARY KEY,
      account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
      category TEXT NOT NULL CHECK(category IN ('wrong-answer','bad-solution','ambiguous-wording','incorrect-diagram','curriculum-mismatch','impossible-question','recognition-problem','other')),
      content_id TEXT,
      question_id TEXT,
      app_version TEXT,
      curriculum_version TEXT,
      context_json TEXT NOT NULL DEFAULT '{}',
      note TEXT,
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','triaged','resolved','dismissed')),
      created_at INTEGER NOT NULL,
      resolved_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_issue_reports_status ON issue_reports(status, created_at);

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      target_kind TEXT NOT NULL,
      target_id TEXT,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS idempotency_keys (
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      scope TEXT NOT NULL,
      key TEXT NOT NULL,
      response_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      PRIMARY KEY(account_id, scope, key)
    );

    CREATE TABLE IF NOT EXISTS rate_limits (
      bucket TEXT PRIMARY KEY,
      window_start INTEGER NOT NULL,
      count INTEGER NOT NULL
    );
  `);

  migrateLearningEventIdentity(db);

  // WP server-security: teacher invite codes, per-account login lockout and
  // server-issued OIDC nonces (schema v4). Only one-way hashes are stored; raw
  // invite codes and nonces never touch the database.
  db.exec(`
    CREATE TABLE IF NOT EXISTS teacher_invites (
      id TEXT PRIMARY KEY,
      code_hash TEXT NOT NULL UNIQUE,
      code_prefix TEXT NOT NULL,
      created_by TEXT REFERENCES accounts(id) ON DELETE SET NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      used_by TEXT REFERENCES accounts(id) ON DELETE SET NULL,
      used_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS login_attempts (
      email_hash TEXT PRIMARY KEY,
      failures INTEGER NOT NULL,
      window_start INTEGER NOT NULL,
      last_failed_at INTEGER NOT NULL,
      locked_until INTEGER
    );

    CREATE TABLE IF NOT EXISTS oidc_nonces (
      nonce_hash TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      consumed_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_oidc_nonces_expiry ON oidc_nonces(expires_at);
  `);
  // WP server-commerce-classes: schema v4 — recoverable classroom join codes.
  // Teachers must be able to reveal and rotate a class code (cloud-05). The
  // hashed column remains the join lookup key; the plain code is kept beside it
  // because an 8-character code has no meaningful hashing protection and the
  // only consequence of disclosure is joining a class the teacher can prune.
  // Classes created before v4 keep join_code NULL until the teacher rotates.
  addColumnIfMissing(db, 'classes', 'join_code', 'join_code TEXT');
  addColumnIfMissing(db, 'classes', 'join_code_rotated_at', 'join_code_rotated_at INTEGER');

  // Schema v5 — an idempotency key remembers which request it answered.
  // Without the digest a key is only a name, so a second push under the same
  // name replayed the first response and discarded the new writes with a 200:
  // the device believed it had synced work the server never stored. Rows
  // written before v5 keep a NULL digest and are still replayable; only a key
  // that recorded what it acknowledged can refuse a different request.
  addColumnIfMissing(db, 'idempotency_keys', 'request_digest', 'request_digest TEXT');

  // Schema v6 — a guardian's confirmation, and the two CHECK constraints that
  // have to widen to carry it.
  //
  // Every Class 7-12 student is a child under the DPDP Act, which draws its
  // line at 18 with no younger tier. A local profile never reaches this server
  // and is not ours to consent to; a cloud account is, so the consent gates the
  // cloud account and nothing else. The app stays fully usable offline without
  // one, which is what makes gating the account acceptable rather than a wall.
  //
  // SQLite cannot ALTER a CHECK, so the two tables that name the delivery kinds
  // are rebuilt transactionally, exactly as learning_events was at v3. Every row
  // is carried across; in-flight verification and reset email survives.
  widenAuthKinds(db);

  db.exec(`CREATE TABLE IF NOT EXISTS guardian_consents (
    account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    guardian_name TEXT NOT NULL,
    guardian_email TEXT NOT NULL,
    notice_version TEXT NOT NULL,
    requested_at INTEGER NOT NULL,
    confirmed_at INTEGER,
    withdrawn_at INTEGER,
    -- What was actually established, so no later reader can mistake this for
    -- more than it is. See guardianConsent.js: this records that somebody with
    -- access to the guardian's mailbox followed a link. It does not establish
    -- that they are an adult, or that they are this child's parent, which is
    -- what Rule 10 will require.
    method TEXT NOT NULL
  );`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_guardian_consents_state
    ON guardian_consents(confirmed_at, withdrawn_at);`);

  db.prepare("INSERT OR REPLACE INTO platform_meta(key,value) VALUES ('schema_version',?)").run(String(SCHEMA_VERSION));
  return db;
}

/**
 * Flush the write-ahead log into the main database file. TRUNCATE leaves the
 * WAL empty so the main file alone is a complete, consistent snapshot for
 * backup tooling. Returns SQLite's checkpoint counters.
 */
export function checkpointPlatformDb(db) {
  const [row] = db.pragma('wal_checkpoint(TRUNCATE)');
  return { busy: Number(row?.busy || 0), log: Number(row?.log || 0), checkpointed: Number(row?.checkpointed || 0) };
}

/**
 * Graceful shutdown: checkpoint, then close so the last connection removes the
 * -wal/-shm sidecars and no committed transaction is left only in the WAL.
 */
export function closePlatformDb(db) {
  if (!db || !db.open) return { closed: false, checkpoint: null };
  let checkpoint = null;
  try { checkpoint = checkpointPlatformDb(db); } finally { db.close(); }
  return { closed: true, checkpoint };
}

export function nextSyncCursor(db) {
  return db.transaction(() => {
    const row = db.prepare('SELECT value FROM sync_cursors WHERE id = 1').get();
    const next = Number(row?.value || 0) + 1;
    db.prepare('UPDATE sync_cursors SET value = ? WHERE id = 1').run(next);
    return next;
  })();
}

const configuredPlatformPath = platformDatabasePath();
export const platformDb = createPlatformDb(configuredPlatformPath || DEFAULT_PATH);
