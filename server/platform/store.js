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
//   · transaction(fn, { lock, isolation: 'repeatable read' }) — snapshot
//     isolation — is allowed only with a lock (see isolationOption).
//   · transaction(fn, { lock }) names a lock the transaction holds from before
//     BEGIN until after COMMIT/ROLLBACK. Postgres: a session advisory lock taken
//     on the transaction's own client BEFORE the transaction's snapshot, so two
//     holders of one key run strictly one after the other and the second sees
//     everything the first committed. SQLite: already true of every transaction
//     (one connection), so the key is only recorded. heldLock() tells code such
//     as the sync-cursor allocator which lock the current transaction holds.
//
// OVERLOAD. Contention the store cannot resolve — serialization retries
// exhausted, a statement or lock wait past statement_timeout, no pooled
// connection within the pool's timeout — is a 503 with a Retry-After and a
// coded error (PLATFORM_DB_BUSY / PLATFORM_DB_TIMEOUT), never a 500: the request
// is safe to resend and the client is told so.
// ─────────────────────────────────────────────────────────────────────────────
import { AsyncLocalStorage } from 'node:async_hooks';
import { platformDatabaseUrl, postgresConnectionSettings, validPostgresUrl } from './config.js';
import { BILLING_SCHEMA_VERSION, SCHEMA_VERSION } from './schemaVersions.js';

const txContext = new AsyncLocalStorage();
const SAFE_IDENTIFIER = /^[a-z_][a-z0-9_]{0,62}$/;

function storeError(code, message) {
  return Object.assign(new Error(message), { code });
}

/** Is a transaction of this store open in the current async context? */
export function inStoreTransaction() {
  const context = txContext.getStore();
  // A task spawned inside a transaction keeps its async context after the
  // transaction ends; only a transaction that is still open counts.
  return !!context && !context.tx.closed;
}

/**
 * Outbound network I/O (a payment provider, a mailer, a JWKS fetch) must never
 * run while a database transaction is open: on Postgres the transaction would
 * hold a pooled connection and its row locks for the length of a network call,
 * and a serialization retry re-runs the whole callback, so the call would be
 * repeated. Code that talks to the network calls this first.
 */
export function assertNoOpenTransaction(what = 'This network call') {
  if (inStoreTransaction()) {
    throw storeError('STORE_EXTERNAL_IO_IN_TRANSACTION', `${what} must not run inside a database transaction.`);
  }
}

function lockOption(options) {
  const lock = options?.lock;
  if (lock === undefined || lock === null) return null;
  if (typeof lock !== 'string' || !lock || lock.length > 200) throw storeError('STORE_LOCK_INVALID', 'A transaction lock key must be a non-empty string of at most 200 characters.');
  return lock;
}

/**
 * Isolation for a writable transaction. SERIALIZABLE is the default and what
 * every transaction gets unless it says otherwise. 'repeatable read' (snapshot
 * isolation) is accepted ONLY together with a lock: the lock then makes every
 * writer of the rows the transaction touches run one after another, with a
 * snapshot taken after the previous one committed — serial execution for those
 * rows — while SERIALIZABLE's page-granular predicate locks would still abort
 * unrelated transactions that merely share an index page. Without a lock the
 * store refuses it, so nothing can drop to snapshot isolation by accident.
 */
function isolationOption(options, lock) {
  const isolation = options?.isolation ?? 'serializable';
  if (isolation !== 'serializable' && isolation !== 'repeatable read') {
    throw storeError('STORE_ISOLATION_INVALID', "Transaction isolation must be 'serializable' or 'repeatable read'.");
  }
  if (isolation === 'repeatable read' && !options?.readOnly && !lock) {
    throw storeError('STORE_ISOLATION_REQUIRES_LOCK', "A writable 'repeatable read' transaction must hold a lock.");
  }
  return isolation;
}

function assertJoinableLock(joined, lock) {
  // A lock must be taken before the snapshot it protects. Inside an open
  // transaction that moment has passed, so asking for a different lock there is
  // a programming error, not something to paper over.
  if (lock && joined.lock !== lock) {
    throw storeError('STORE_LOCK_NESTED', 'A transaction lock can only be taken by the outermost transaction.');
  }
}

/**
 * A retryable database overload, as the HTTP error the /v1 error handler
 * answers with: 503, Retry-After, a stable code. The driver's code is kept for
 * the operator log only.
 */
function overloaded(code, retryAfter, cause) {
  return Object.assign(new Error(code === 'PLATFORM_DB_TIMEOUT'
    ? 'The database did not answer in time. Retry shortly.'
    : 'The database is busy. Retry shortly.'), {
    code, status: 503, retryAfter, retryable: true, dbCode: String(cause?.code || '') || undefined
  });
}

const BUSY_CODES = new Set(['40001', '40P01', '55P03']);
const TIMEOUT_CODES = new Set(['57014', '25P03']);

/** A retryable database overload (503 + Retry-After): handlers pass it on to the /v1 error handler untouched. */
export function isDatabaseOverload(error) {
  return !!error?.retryable && error.status === 503 && /^PLATFORM_DB_(BUSY|TIMEOUT)$/.test(String(error.code || ''));
}

/** Map an overload error from the driver to its retryable 503; anything else is returned as is. */
export function databaseOverload(error) {
  if (!error || error.status) return error;
  const code = String(error.code || '');
  if (BUSY_CODES.has(code)) return overloaded('PLATFORM_DB_BUSY', 1, error);
  if (TIMEOUT_CODES.has(code)) return overloaded('PLATFORM_DB_TIMEOUT', 2, error);
  // pg-pool's acquisition timeout carries no code, only this message.
  if (!code && /timeout exceeded when trying to connect/i.test(String(error.message || ''))) return overloaded('PLATFORM_DB_BUSY', 2, { code: 'POOL_TIMEOUT' });
  return error;
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
  constructor(store, depth = 0, lock = null) {
    this.store = store;
    this.dialect = 'sqlite';
    this.depth = depth;
    this.lock = lock;
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
    const nested = new SqliteTx(this.store, this.depth + 1, this.lock);
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

  /** The lock key the current transaction holds, or null. */
  heldLock() {
    return this.#joined()?.lock ?? null;
  }

  async transaction(fn, options = {}) {
    const lock = lockOption(options);
    isolationOption(options, lock); // validated on both engines; SQLite is always serial
    const joined = this.#joined();
    if (joined) {
      assertJoinableLock(joined, lock);
      return joined.transaction(fn, options);
    }
    // One connection: take the in-process lock so no other request's
    // statement can land inside this transaction. That already serialises
    // every transaction, so a named lock needs nothing more than recording.
    while (this.active) await this.active.done;
    let release;
    this.active = { done: new Promise(resolve => { release = resolve; }) };
    this.stats.transactions++;
    const tx = new SqliteTx(this, 0, lock);
    try {
      this.raw.exec('BEGIN');
      let result;
      try {
        result = await txContext.run({ store: this, tx }, () => fn(tx));
      } catch (error) {
        if (this.raw.inTransaction) this.raw.exec('ROLLBACK');
        throw error;
      }
      try {
        this.raw.exec('COMMIT');
      } catch (error) {
        // A COMMIT that fails (SQLITE_BUSY, SQLITE_FULL, an I/O error) can leave
        // the transaction open. Released like that, the next request's BEGIN
        // would fail — or, worse, its statements would join this transaction's
        // uncommitted writes. Roll back before the lock is released.
        if (this.raw.inTransaction) {
          try { this.raw.exec('ROLLBACK'); } catch { /* the original error is the one to report */ }
        }
        throw error;
      }
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
// Every round of a conflict on one hot row (sync_cursors, a rate bucket)
// commits at least one writer, so N concurrent writers need at most N
// attempts. 16 covers a burst well beyond one replica's pool; backoff below
// spreads the retries so they stop colliding.
const MAX_ATTEMPTS = 16;

/** Full-jitter exponential backoff: up to 4, 8, 16 … ms, capped at 250 ms. */
export function retryDelayMs(attempt, random = Math.random) {
  const ceiling = Math.min(250, 2 ** Math.min(8, attempt + 1));
  return Math.floor(random() * ceiling) + 1;
}

function pause(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function runResult(result) {
  const rows = result.rows || [];
  const id = rows[0]?.id ?? rows[0]?.server_cursor;
  return { changes: result.rowCount ?? 0, lastInsertRowid: id === undefined ? undefined : id, rows };
}

class PostgresTx {
  constructor(store, client, depth = 0, readOnly = false, lock = null) {
    this.store = store;
    this.client = client;
    this.dialect = 'postgres';
    this.depth = depth;
    this.readOnly = readOnly;
    this.lock = lock;
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
    const nested = new PostgresTx(this.store, this.client, this.depth + 1, this.readOnly, this.lock);
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

// A session advisory lock, keyed by a 64-bit hash of the lock name. Distinct
// names that collide only serialise more than necessary; they never deadlock,
// because a transaction takes at most one such lock.
const ADVISORY_LOCK = 'SELECT pg_advisory_lock(hashtextextended($1, 0))';
const ADVISORY_UNLOCK = 'SELECT pg_advisory_unlock(hashtextextended($1, 0)) AS released';

function sessionMillis(value, name) {
  if (value === undefined || value === null) return null;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw storeError('STORE_SESSION_INVALID', `${name} must be a whole number of milliseconds.`);
  return number;
}

export class PostgresStore {
  constructor(pool, { schema = 'pri', ownsPool = true, maxAttempts = MAX_ATTEMPTS, statementTimeoutMs, idleInTransactionTimeoutMs } = {}) {
    if (!SAFE_IDENTIFIER.test(String(schema))) throw storeError('STORE_SCHEMA_INVALID', 'Postgres schema name is invalid.');
    this.dialect = 'postgres';
    // Applied to every pooled connection before its first statement.
    this.session = Object.freeze({
      statementTimeoutMs: sessionMillis(statementTimeoutMs, 'statementTimeoutMs'),
      idleInTransactionTimeoutMs: sessionMillis(idleInTransactionTimeoutMs, 'idleInTransactionTimeoutMs')
    });
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

  /** The lock key the current transaction holds, or null. */
  heldLock() {
    return this.#joined()?.lock ?? null;
  }

  /** The session statements every pooled connection runs before first use. */
  sessionSetup() {
    const statements = [`SET search_path TO ${this.schema}`];
    // Integers validated in the constructor; SET cannot take a bind parameter.
    if (this.session.statementTimeoutMs !== null) statements.push(`SET statement_timeout = ${this.session.statementTimeoutMs}`);
    if (this.session.idleInTransactionTimeoutMs !== null) statements.push(`SET idle_in_transaction_session_timeout = ${this.session.idleInTransactionTimeoutMs}`);
    return statements.join('; ');
  }

  /**
   * A pooled client whose session is ready: search_path and the per-session
   * timeouts set once, on first use, and awaited before any statement runs on
   * it. (Setting them from the pool's 'connect' event raced the first query on
   * the same client.) SET, not startup parameters, so they also hold through a
   * session-mode pooler that does not forward startup options.
   */
  async _client() {
    let client;
    try {
      client = await this.pool.connect();
    } catch (error) {
      throw databaseOverload(error);
    }
    if (!client.__priErrorListener && typeof client.on === 'function') {
      // The server can end a checked-out session on its own — most often
      // idle_in_transaction_session_timeout (25P03). pg reports that as an
      // 'error' event on the client, and pg-pool only listens while the client
      // is idle in the pool: unheard, it would crash the process. Record it; the
      // next statement on this client fails, and the client is destroyed.
      client.__priErrorListener = error => { client.__priLost ||= error; }; // the first is the cause
      client.on('error', client.__priErrorListener);
    }
    if (!client.__priSchema) {
      try {
        await client.query(this.sessionSetup());
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
      if (client.__priLost) { broken = client.__priLost; throw databaseOverload(client.__priLost); }
      if (!error?.code || String(error.code).startsWith('08') || error.code === '57P01' || error.code === '25P03') broken = error;
      throw databaseOverload(error);
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

  async transaction(fn, options = {}) {
    const { readOnly = false } = options;
    const lock = lockOption(options);
    const isolation = isolationOption(options, lock);
    const joined = this.#joined();
    if (joined) {
      assertJoinableLock(joined, lock);
      return joined.transaction(fn);
    }
    for (let attempt = 1; ; attempt++) {
      if (attempt > 1) this.stats.retries++;
      this.stats.transactions++;
      const client = await this._client();
      const tx = new PostgresTx(this, client, 0, readOnly, lock);
      let broken;
      let locked = false;
      let begun = false;
      try {
        // The lock is taken before BEGIN, so this transaction's snapshot is
        // taken after the previous holder committed and includes its writes.
        if (lock) {
          try {
            await client.query(ADVISORY_LOCK, [lock]);
          } catch (lockError) {
            // A lock wait that failed (statement_timeout) must not leave any
            // doubt about a session lock on a pooled connection: end the session.
            broken = lockError;
            throw lockError;
          }
          locked = true;
        }
        await client.query(readOnly
          ? 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'
          : isolation === 'repeatable read' ? 'BEGIN ISOLATION LEVEL REPEATABLE READ' : 'BEGIN ISOLATION LEVEL SERIALIZABLE');
        begun = true;
        const result = await txContext.run({ store: this, tx }, () => fn(tx));
        tx.closed = true;
        await client.query('COMMIT');
        return result;
      } catch (thrown) {
        tx.closed = true;
        // A session the server ended (see _client) explains whatever the next
        // statement then failed with: report the cause, destroy the client.
        const error = client.__priLost && !thrown?.status ? client.__priLost : thrown;
        if (client.__priLost) broken = client.__priLost;
        // A client whose ROLLBACK fails is in an unknown state: destroy it
        // rather than hand it to the next request.
        if (begun && !broken) {
          try { await client.query('ROLLBACK'); } catch (rollbackError) { broken = rollbackError; }
        }
        if (String(error?.code || '') === '25P03' || String(error?.code || '').startsWith('08')) broken = broken || error;
        if (!RETRYABLE.has(String(error?.code || '')) || attempt >= this.maxAttempts) throw databaseOverload(error);
      } finally {
        tx.closed = true;
        // Released only after COMMIT/ROLLBACK. A client that cannot prove it
        // released the lock is destroyed: ending the session releases it.
        if (locked && !broken) {
          try {
            const unlocked = await client.query(ADVISORY_UNLOCK, [lock]);
            if (unlocked?.rows?.[0]?.released !== true) broken = storeError('STORE_LOCK_LOST', 'The transaction lock was not held at release.');
          } catch (unlockError) {
            broken = unlockError;
          }
        }
        client.release(broken);
      }
      await pause(retryDelayMs(attempt));
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
 * The pg Pool options for a connection string and environment: TLS from
 * sslmode (refused without TLS in production — see config.js
 * postgresConnectionSettings), the pool size from PRI_DATABASE_POOL_MAX. Pure,
 * so the exact options are testable without a database.
 */
export function postgresPoolOptions(connectionString, { max, env = process.env } = {}) {
  const settings = postgresConnectionSettings(connectionString, env);
  const poolMax = max === undefined || max === null ? settings.poolMax : Number(max);
  if (!Number.isSafeInteger(poolMax) || poolMax < 1 || poolMax > 50) throw storeError('PLATFORM_DB_CONFIG_INVALID', 'The Postgres pool size must be between 1 and 50.');
  return {
    settings,
    options: {
      connectionString: settings.connectionString,
      ssl: settings.ssl,
      max: poolMax,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      application_name: 'pri-learning-v1'
    }
  };
}

/**
 * A pg Pool that parses int8 as Number (PostgresStore sets each client's
 * search_path and timeouts before first use). Use a direct or session-mode connection string: SERIALIZABLE
 * transactions, session advisory locks and the per-connection settings all need
 * a real session, which a transaction-mode pooler does not give.
 */
export async function createPostgresPool(connectionString, { schema = 'pri', max, env = process.env } = {}) {
  if (!validPostgresUrl(connectionString)) throw storeError('PLATFORM_DB_URL_INVALID', 'PRI_DATABASE_URL must be a postgres:// or postgresql:// URL with a host.');
  if (!SAFE_IDENTIFIER.test(String(schema))) throw storeError('STORE_SCHEMA_INVALID', 'Postgres schema name is invalid.');
  const { options } = postgresPoolOptions(connectionString, { max, env });
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ ...options, types: postgresTypes(pg.types) });
  // An idle client dropped by the server must not crash the process; the pool
  // discards it and the next query opens a fresh connection.
  pool.on('error', error => {
    console.error('platform_db_pool_error', { code: error?.code || 'POOL_ERROR' });
  });
  return pool;
}

export async function createPostgresStore(connectionString, { schema = 'pri', max, env = process.env, expected } = {}) {
  if (!validPostgresUrl(connectionString)) {
    throw storeError('PLATFORM_DB_URL_INVALID', 'PRI_DATABASE_URL must be a postgres:// or postgresql:// URL with a host.');
  }
  const { settings } = postgresPoolOptions(connectionString, { max, env });
  const pool = await createPostgresPool(connectionString, { schema, max, env });
  const store = new PostgresStore(pool, {
    schema,
    statementTimeoutMs: settings.statementTimeoutMs,
    idleInTransactionTimeoutMs: settings.idleInTransactionTimeoutMs
  });
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
  try {
    await assertSchemaVersions(store, expected);
  } catch (error) {
    await store.close().catch(() => {});
    throw error;
  }
  return store;
}

/**
 * The database must be exactly the schema this build was written against:
 * platform_meta.schema_version and billing_schema_version equal to the
 * constants in schemaVersions.js, and the objects later migrations add present.
 * Older means a migration was not applied; newer means this build is behind the
 * database. Either way handlers would read or write columns that are not what
 * they expect, so the process stops before it listens.
 */
export async function assertSchemaVersions(store, expected = {}) {
  const want = {
    schema_version: String(expected.schemaVersion ?? SCHEMA_VERSION),
    billing_schema_version: String(expected.billingSchemaVersion ?? BILLING_SCHEMA_VERSION)
  };
  const rows = await store.all("SELECT key, value FROM platform_meta WHERE key IN ('schema_version','billing_schema_version')");
  const found = new Map(rows.map(row => [row.key, String(row.value)]));
  for (const [key, value] of Object.entries(want)) {
    const actual = found.get(key);
    if (actual !== value) {
      throw storeError('PLATFORM_DB_SCHEMA_MISMATCH',
        `Postgres platform_meta.${key} is ${actual === undefined ? 'missing' : JSON.stringify(actual.slice(0, 20))}; this server needs ${value}. Apply supabase/migrations or deploy the matching server build.`);
    }
  }
  // supabase/migrations/20261002000000_sync_cursor_sequence.sql. Without it
  // every sync push would fail at its first event.
  try {
    await store.get("SELECT last_value FROM sync_cursor_seq");
  } catch (error) {
    if (String(error?.code || '') === '42P01') {
      throw storeError('PLATFORM_DB_SCHEMA_MISMATCH', 'Postgres is missing pri.sync_cursor_seq. Apply supabase/migrations.');
    }
    throw storeError('PLATFORM_DB_UNAVAILABLE', `Postgres sync cursor sequence is not usable (${String(error?.code || 'UNKNOWN').replace(/[^A-Z0-9_]/gi, '').slice(0, 40)}).`);
  }
  return true;
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
