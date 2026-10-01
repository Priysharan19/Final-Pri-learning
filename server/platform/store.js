// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · one async data-access interface for the /v1 platform
// (ADR-0001 phase 2)
//
// Every /v1 handler talks to the database through this interface and nothing
// else, so the same handler code runs against either driver:
//
//   · SQLite (better-sqlite3)  — the default, and what every test runs today;
//   · Postgres (pg)            — selected when PRI_DATABASE_URL is set.
//
//   get(sql, params)          → first row or undefined
//   all(sql, params)          → array of rows
//   run(sql, params)          → { changes, lastInsertRowid }
//   exec(sql)                 → run a parameterless script (tests/tools only)
//   transaction(async tx => …, { readOnly })
//
// SQL is written once, with `?` placeholders, in the portable subset both
// engines accept (`ON CONFLICT … DO NOTHING/UPDATE`, `RETURNING`, `COALESCE`).
// The handful of real dialect differences are named helpers on the store
// (emailEquals, nocaseOrder, binaryText, greatest, likeEscape) so a reader can
// see exactly where the engines differ instead of discovering it at runtime.
//
// TRANSACTIONS. better-sqlite3 is synchronous, so every handler used to run
// to completion without anything else touching the database in between. Async
// handlers lose that for free; transactions are where it is put back:
//
//   · A transaction is bound to the async context that opened it
//     (AsyncLocalStorage). Any store call made inside the callback — including
//     helpers that were handed the store rather than `tx` — joins the open
//     transaction, exactly as `db.prepare()` inside `db.transaction()` did.
//     A nested transaction() is a SAVEPOINT, as it was in better-sqlite3.
//   · SQLite: one connection, so transactions are serialised by an in-process
//     lock, and statements issued from outside a transaction wait for it to
//     finish rather than leaking into it.
//   · Postgres: each transaction holds one pooled client from BEGIN to
//     COMMIT/ROLLBACK and runs at SERIALIZABLE, which is the isolation the
//     single-writer SQLite file gave every transaction. A serialization failure
//     or deadlock (40001/40P01) rolls back and re-runs the callback, so the
//     callback must not cause effects outside the database — none here do.
//     readOnly transactions run at REPEATABLE READ READ ONLY: one consistent
//     snapshot for multi-query reads such as a sync pull page.
// ─────────────────────────────────────────────────────────────────────────────
import { AsyncLocalStorage } from 'node:async_hooks';
import { platformDatabaseUrl, validPostgresUrl } from './config.js';

const txContext = new AsyncLocalStorage();
const SAFE_IDENTIFIER = /^[a-z_][a-z0-9_]{0,62}$/;

function storeError(code, message) {
  return Object.assign(new Error(message), { code });
}

function asParams(params) {
  if (params === undefined || params === null) return [];
  if (!Array.isArray(params)) throw storeError('STORE_PARAMS_INVALID', 'Store parameters must be an array.');
  return params;
}

/**
 * Is this a unique/primary-key violation, on either engine?
 * SQLite: SQLITE_CONSTRAINT_UNIQUE / SQLITE_CONSTRAINT_PRIMARYKEY. Postgres: 23505.
 */
export function isUniqueViolation(error) {
  const code = String(error?.code || '');
  return code === '23505' || code === 'SQLITE_CONSTRAINT_UNIQUE' || code === 'SQLITE_CONSTRAINT_PRIMARYKEY';
}

/** The dialect differences, as named helpers. Mixed into both stores. */
const dialectHelpers = {
  /** `<column> = ?` with the case-insensitive email semantics of each schema. */
  emailEquals(column) {
    // SQLite: the column is declared COLLATE NOCASE, so `=` already folds case
    // and uses the UNIQUE index. Postgres: the unique index is on lower(email).
    return this.dialect === 'postgres' ? `lower(${column}) = lower(?)` : `${column} = ?`;
  },
  /** ORDER BY a text expression case-insensitively, byte-ordered after folding. */
  nocaseOrder(expr) {
    return this.dialect === 'postgres' ? `lower(${expr}) COLLATE "C"` : `${expr} COLLATE NOCASE`;
  },
  /** Compare/order a text expression bytewise, as SQLite's default BINARY collation does. */
  binaryText(expr) {
    return this.dialect === 'postgres' ? `${expr} COLLATE "C"` : expr;
  },
  /** Two-argument scalar maximum: SQLite MAX(a,b), Postgres GREATEST(a,b). */
  greatest(a, b) {
    return this.dialect === 'postgres' ? `GREATEST(${a}, ${b})` : `MAX(${a}, ${b})`;
  },
  /**
   * Suffix for a LIKE whose pattern is user text. SQLite LIKE has no escape
   * character unless one is declared; Postgres defaults to backslash. ESCAPE ''
   * makes Postgres match SQLite: a backslash is an ordinary character.
   */
  likeEscape() {
    return this.dialect === 'postgres' ? " ESCAPE ''" : '';
  }
};

// ── SQLite ───────────────────────────────────────────────────────────────────

class SqliteTx {
  constructor(store, depth = 0) {
    this.store = store;
    this.dialect = 'sqlite';
    this.depth = depth;
    this.closed = false;
  }
  #check() { if (this.closed) throw storeError('STORE_TX_FINISHED', 'This transaction has already finished.'); }
  async get(sql, params) { this.#check(); return this.store._exec('get', sql, params); }
  async all(sql, params) { this.#check(); return this.store._exec('all', sql, params); }
  async run(sql, params) { this.#check(); return this.store._exec('run', sql, params); }
  async exec(sql) { this.#check(); this.store.raw.exec(sql); }
  async transaction(fn) {
    this.#check();
    const name = `pri_sp_${this.depth + 1}`;
    const raw = this.store.raw;
    raw.exec(`SAVEPOINT ${name}`);
    const nested = new SqliteTx(this.store, this.depth + 1);
    try {
      const result = await txContext.run({ store: this.store, tx: nested }, () => fn(nested));
      raw.exec(`RELEASE ${name}`);
      return result;
    } catch (error) {
      if (raw.inTransaction) {
        raw.exec(`ROLLBACK TO ${name}`);
        raw.exec(`RELEASE ${name}`);
      }
      throw error;
    } finally {
      nested.closed = true;
    }
  }
}
Object.assign(SqliteTx.prototype, dialectHelpers);

export class SqliteStore {
  constructor(db) {
    if (!db || typeof db.prepare !== 'function') throw storeError('STORE_DB_INVALID', 'SqliteStore needs a better-sqlite3 database.');
    this.dialect = 'sqlite';
    /** The better-sqlite3 handle, for SQLite-only schema code and file operations. */
    this.raw = db;
    this.statements = new Map();
    this.active = null;
    // Same shape as PostgresStore.stats; one connection never needs a retry.
    this.stats = { transactions: 0, retries: 0 };
  }

  get open() { return !!this.raw.open; }

  _statement(sql) {
    let statement = this.statements.get(sql);
    if (!statement) {
      statement = this.raw.prepare(sql);
      if (this.statements.size > 2000) this.statements.clear();
      this.statements.set(sql, statement);
    }
    return statement;
  }

  _exec(kind, sql, params) {
    const values = asParams(params);
    const statement = this._statement(sql);
    if (kind === 'get') return statement.reader ? statement.get(...values) : (statement.run(...values), undefined);
    if (kind === 'all') return statement.reader ? statement.all(...values) : (statement.run(...values), []);
    if (statement.reader) {
      // INSERT … RETURNING is a reader in better-sqlite3; run it as one so the
      // returned row is available, and report the row count as changes.
      const rows = statement.all(...values);
      return { changes: rows.length, lastInsertRowid: undefined, rows };
    }
    const info = statement.run(...values);
    return { changes: info.changes, lastInsertRowid: info.lastInsertRowid == null ? undefined : Number(info.lastInsertRowid) };
  }

  async #idle() {
    while (this.active) await this.active.done;
  }

  #joined() {
    const context = txContext.getStore();
    return context?.store === this ? context.tx : null;
  }

  async get(sql, params) {
    const tx = this.#joined();
    if (tx) return tx.get(sql, params);
    // Idle: run now, synchronously, exactly as better-sqlite3 did. Only wait
    // when another request's transaction holds the connection.
    if (this.active) await this.#idle();
    return this._exec('get', sql, params);
  }

  async all(sql, params) {
    const tx = this.#joined();
    if (tx) return tx.all(sql, params);
    // Idle: run now, synchronously, exactly as better-sqlite3 did. Only wait
    // when another request's transaction holds the connection.
    if (this.active) await this.#idle();
    return this._exec('all', sql, params);
  }

  async run(sql, params) {
    const tx = this.#joined();
    if (tx) return tx.run(sql, params);
    // Idle: run now, synchronously, exactly as better-sqlite3 did. Only wait
    // when another request's transaction holds the connection.
    if (this.active) await this.#idle();
    return this._exec('run', sql, params);
  }

  async exec(sql) {
    const tx = this.#joined();
    if (tx) return tx.exec(sql);
    // Idle: run now, synchronously, exactly as better-sqlite3 did. Only wait
    // when another request's transaction holds the connection.
    if (this.active) await this.#idle();
    this.raw.exec(sql);
  }

  async transaction(fn, options = {}) {
    const joined = this.#joined();
    if (joined) return joined.transaction(fn, options);
    // One connection: take the in-process lock so no other request's
    // statement can land inside this transaction.
    while (this.active) await this.active.done;
    let release;
    this.active = { done: new Promise(resolve => { release = resolve; }) };
    this.stats.transactions++;
    const tx = new SqliteTx(this, 0);
    try {
      this.raw.exec('BEGIN');
      let result;
      try {
        result = await txContext.run({ store: this, tx }, () => fn(tx));
      } catch (error) {
        if (this.raw.inTransaction) this.raw.exec('ROLLBACK');
        throw error;
      }
      this.raw.exec('COMMIT');
      return result;
    } finally {
      tx.closed = true;
      this.active = null;
      release();
    }
  }

  async close() {
    if (this.raw.open) this.raw.close();
  }
}
Object.assign(SqliteStore.prototype, dialectHelpers);

// ── Postgres ─────────────────────────────────────────────────────────────────

const placeholderCache = new Map();

/**
 * Rewrite `?` placeholders as `$1…$n`, leaving `?` inside string literals,
 * quoted identifiers and comments alone.
 */
export function toPostgresPlaceholders(sql) {
  const cached = placeholderCache.get(sql);
  if (cached) return cached;
  let out = '';
  let index = 0;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "'" || ch === '"') {
      const end = sql.indexOf(ch, i + 1);
      const stop = end === -1 ? sql.length : end;
      out += sql.slice(i, stop + 1);
      i = stop;
      continue;
    }
    if (ch === '-' && sql[i + 1] === '-') {
      const end = sql.indexOf('\n', i);
      const stop = end === -1 ? sql.length : end;
      out += sql.slice(i, stop);
      i = stop - 1;
      continue;
    }
    if (ch === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i + 2);
      const stop = end === -1 ? sql.length : end + 2;
      out += sql.slice(i, stop);
      i = stop - 1;
      continue;
    }
    if (ch === '?') { out += `$${++index}`; continue; }
    out += ch;
  }
  if (placeholderCache.size > 4000) placeholderCache.clear();
  placeholderCache.set(sql, out);
  return out;
}

const INT8_OID = 20;
const NUMERIC_OID = 1700;

/**
 * The /v1 schema stores epoch milliseconds and counters in BIGINT, which `pg`
 * returns as strings by default. Handlers compare and do arithmetic on them as
 * numbers (as they did with SQLite), so int8 and numeric come back as Number. A
 * value outside the safe-integer range fails loudly instead of losing digits.
 */
export function postgresTypes(pgTypes) {
  return {
    getTypeParser(oid, format) {
      if (format !== 'binary' && oid === INT8_OID) {
        return value => {
          const number = Number(value);
          if (!Number.isSafeInteger(number)) throw storeError('STORE_INT8_UNSAFE', 'A BIGINT value is outside the JavaScript safe-integer range.');
          return number;
        };
      }
      if (format !== 'binary' && oid === NUMERIC_OID) return value => Number(value);
      return pgTypes.getTypeParser(oid, format);
    }
  };
}

const RETRYABLE = new Set(['40001', '40P01']);
const MAX_ATTEMPTS = 8;

function pause(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function runResult(result) {
  const rows = result.rows || [];
  const id = rows[0]?.id ?? rows[0]?.server_cursor;
  return { changes: result.rowCount ?? 0, lastInsertRowid: id === undefined ? undefined : id, rows };
}

class PostgresTx {
  constructor(store, client, depth = 0, readOnly = false) {
    this.store = store;
    this.client = client;
    this.dialect = 'postgres';
    this.depth = depth;
    this.readOnly = readOnly;
    this.closed = false;
  }
  #check() { if (this.closed) throw storeError('STORE_TX_FINISHED', 'This transaction has already finished.'); }
  async #query(sql, params) {
    this.#check();
    return this.client.query(toPostgresPlaceholders(sql), asParams(params));
  }
  async get(sql, params) { return (await this.#query(sql, params)).rows[0]; }
  async all(sql, params) { return (await this.#query(sql, params)).rows; }
  async run(sql, params) { return runResult(await this.#query(sql, params)); }
  async exec(sql) { this.#check(); await this.client.query(sql); }
  async transaction(fn) {
    this.#check();
    const name = `pri_sp_${this.depth + 1}`;
    await this.client.query(`SAVEPOINT ${name}`);
    const nested = new PostgresTx(this.store, this.client, this.depth + 1, this.readOnly);
    try {
      const result = await txContext.run({ store: this.store, tx: nested }, () => fn(nested));
      await this.client.query(`RELEASE SAVEPOINT ${name}`);
      return result;
    } catch (error) {
      // A serialization failure dooms the whole transaction; let the outer
      // level roll back and retry rather than pretending a savepoint fixed it.
      if (!RETRYABLE.has(String(error?.code || ''))) {
        await this.client.query(`ROLLBACK TO SAVEPOINT ${name}`);
        await this.client.query(`RELEASE SAVEPOINT ${name}`);
      }
      throw error;
    } finally {
      nested.closed = true;
    }
  }
}
Object.assign(PostgresTx.prototype, dialectHelpers);

export class PostgresStore {
  constructor(pool, { schema = 'pri', ownsPool = true, maxAttempts = MAX_ATTEMPTS } = {}) {
    if (!SAFE_IDENTIFIER.test(String(schema))) throw storeError('STORE_SCHEMA_INVALID', 'Postgres schema name is invalid.');
    this.dialect = 'postgres';
    this.maxAttempts = Math.max(1, Math.floor(Number(maxAttempts) || MAX_ATTEMPTS));
    /** Counters for operators and tests: transactions begun, and re-runs after 40001/40P01. */
    this.stats = { transactions: 0, retries: 0 };
    this.pool = pool;
    this.schema = schema;
    this.ownsPool = ownsPool;
    this.closed = false;
  }

  get open() { return !this.closed; }

  #joined() {
    const context = txContext.getStore();
    return context?.store === this ? context.tx : null;
  }

  /**
   * A pooled client whose session is ready: search_path set once, on first
   * use, and awaited before any statement runs on it. (Setting it from the
   * pool's 'connect' event raced the first query on the same client.)
   */
  async _client() {
    const client = await this.pool.connect();
    if (!client.__priSchema) {
      try {
        await client.query(`SET search_path TO ${this.schema}`);
      } catch (error) {
        client.release(error);
        throw error;
      }
      client.__priSchema = this.schema;
    }
    return client;
  }

  async #query(sql, params) {
    const client = await this._client();
    let broken;
    try {
      return await client.query(toPostgresPlaceholders(sql), asParams(params));
    } catch (error) {
      // A statement error leaves the session usable; a lost connection does not.
      if (!error?.code || String(error.code).startsWith('08') || error.code === '57P01') broken = error;
      throw error;
    } finally {
      client.release(broken);
    }
  }

  async get(sql, params) {
    const tx = this.#joined();
    if (tx) return tx.get(sql, params);
    return (await this.#query(sql, params)).rows[0];
  }

  async all(sql, params) {
    const tx = this.#joined();
    if (tx) return tx.all(sql, params);
    return (await this.#query(sql, params)).rows;
  }

  async run(sql, params) {
    const tx = this.#joined();
    if (tx) return tx.run(sql, params);
    return runResult(await this.#query(sql, params));
  }

  async exec(sql) {
    const tx = this.#joined();
    if (tx) return tx.exec(sql);
    const client = await this._client();
    try { await client.query(sql); } finally { client.release(); }
  }

  async transaction(fn, { readOnly = false } = {}) {
    const joined = this.#joined();
    if (joined) return joined.transaction(fn);
    for (let attempt = 1; ; attempt++) {
      if (attempt > 1) this.stats.retries++;
      this.stats.transactions++;
      const client = await this._client();
      const tx = new PostgresTx(this, client, 0, readOnly);
      let broken;
      try {
        await client.query(readOnly
          ? 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'
          : 'BEGIN ISOLATION LEVEL SERIALIZABLE');
        const result = await txContext.run({ store: this, tx }, () => fn(tx));
        tx.closed = true;
        await client.query('COMMIT');
        return result;
      } catch (error) {
        tx.closed = true;
        // A client whose ROLLBACK fails is in an unknown state: destroy it
        // rather than hand it to the next request.
        try { await client.query('ROLLBACK'); } catch (rollbackError) { broken = rollbackError; }
        if (!RETRYABLE.has(String(error?.code || '')) || attempt >= this.maxAttempts) throw error;
      } finally {
        tx.closed = true;
        client.release(broken);
      }
      await pause(Math.floor(Math.random() * 10 * attempt) + attempt);
    }
  }

  async close() {
    if (this.closed) return;
    this.closed = true;
    if (this.ownsPool) await this.pool.end();
  }
}
Object.assign(PostgresStore.prototype, dialectHelpers);

export { platformDatabaseUrl, validPostgresUrl };

/**
 * A pg Pool that parses int8 as Number (PostgresStore sets each client's
 * search_path before first use). Use a direct or session-mode connection string: SERIALIZABLE
 * transactions and the per-connection search_path both need a real session,
 * which a transaction-mode pooler does not give.
 */
export async function createPostgresPool(connectionString, { schema = 'pri', max } = {}) {
  if (!validPostgresUrl(connectionString)) throw storeError('PLATFORM_DB_URL_INVALID', 'PRI_DATABASE_URL must be a postgres:// or postgresql:// URL with a host.');
  if (!SAFE_IDENTIFIER.test(String(schema))) throw storeError('STORE_SCHEMA_INVALID', 'Postgres schema name is invalid.');
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({
    connectionString,
    max: Math.max(1, Math.min(50, Number(max ?? process.env.PRI_DATABASE_POOL_MAX) || 10)),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    types: postgresTypes(pg.types),
    application_name: 'pri-learning-v1'
  });
  // An idle client dropped by the server must not crash the process; the pool
  // discards it and the next query opens a fresh connection.
  pool.on('error', error => {
    console.error('platform_db_pool_error', { code: error?.code || 'POOL_ERROR' });
  });
  return pool;
}

export async function createPostgresStore(connectionString, { schema = 'pri', max } = {}) {
  if (!validPostgresUrl(connectionString)) {
    throw storeError('PLATFORM_DB_URL_INVALID', 'PRI_DATABASE_URL must be a postgres:// or postgresql:// URL with a host.');
  }
  const pool = await createPostgresPool(connectionString, { schema, max });
  const store = new PostgresStore(pool, { schema });
  // Fail at boot, not on the first student request: the database must be
  // reachable and the schema already migrated (supabase/migrations) — this
  // process never creates tables. Only the driver's error code is surfaced:
  // a connection error can name the host, and the URL carries the password.
  let meta;
  try {
    meta = await store.get("SELECT value FROM platform_meta WHERE key='schema_version'");
  } catch (error) {
    await store.close().catch(() => {});
    const code = String(error?.code || 'CONNECT_FAILED').replace(/[^A-Z0-9_]/gi, '').slice(0, 40) || 'CONNECT_FAILED';
    throw storeError(code === '42P01' ? 'PLATFORM_DB_NOT_MIGRATED' : 'PLATFORM_DB_UNAVAILABLE',
      `Postgres platform database is not usable (${code}). Check PRI_DATABASE_URL and apply supabase/migrations.`);
  }
  if (!meta?.value) {
    await store.close().catch(() => {});
    throw storeError('PLATFORM_DB_NOT_MIGRATED', 'Postgres platform schema has no schema_version. Apply supabase/migrations first.');
  }
  return store;
}

export function createSqliteStore(db) {
  return new SqliteStore(db);
}

/** Accept a store or a bare better-sqlite3 handle (tests and tools). */
export function asStore(db) {
  if (db instanceof SqliteStore || db instanceof PostgresStore) return db;
  if (db && typeof db.prepare === 'function' && typeof db.pragma === 'function') {
    if (!db.__priStore) Object.defineProperty(db, '__priStore', { value: new SqliteStore(db), enumerable: false });
    return db.__priStore;
  }
  if (db && typeof db.get === 'function' && typeof db.transaction === 'function' && db.dialect) return db;
  throw storeError('STORE_DB_INVALID', 'Expected a platform store.');
}

/**
 * The better-sqlite3 handle behind a SQLite store (or a bare handle), for the
 * schema code that builds SQLite tables at boot. Null for Postgres, whose
 * schema is owned by supabase/migrations and never created by this process.
 */
export function sqliteHandle(db) {
  if (!db) return null;
  if (db instanceof SqliteStore) return db.raw;
  if (db instanceof PostgresStore || db.dialect === 'postgres') return null;
  if (typeof db.prepare === 'function' && typeof db.pragma === 'function') return db;
  return null;
}

/**
 * The process's platform store: Postgres when PRI_DATABASE_URL is set,
 * otherwise the SQLite file (opened by platform/db.js exactly as before).
 */
export async function openPlatformStore(env = process.env) {
  const url = platformDatabaseUrl(env);
  if (url) return createPostgresStore(url, { schema: String(env.PRI_DATABASE_SCHEMA || 'pri').trim() || 'pri' });
  const { platformDb } = await import('./db.js');
  return asStore(platformDb);
}
