// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the /v1 store's contract on both engines (ADR-0001 phase 2)
//
//   node server/test/platform-store-check.mjs                    → SQLite
//   node server/test/platform-store-check.mjs --engine=postgres  → Postgres
//
// Part 1 needs no database: the Postgres retry loop is driven through a fake
// pool, so the serialization-retry path is proven on every run, including
// the default SQLite one. Part 2 runs the same contract against a real engine:
// transactions are atomic and isolated, a nested transaction is a savepoint,
// helpers join the open transaction, concurrent read-modify-write
// transactions never lose an update (SQLite by its lock; Postgres by
// SERIALIZABLE plus retry, which this run must actually exercise), and the
// dialect helpers give both engines the same answers.
// ─────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
import {
  PostgresStore, assertNoOpenTransaction, createPostgresStore, databaseOverload, inStoreTransaction, isDatabaseOverload,
  isUniqueViolation, postgresTypes, retryDelayMs, toPostgresPlaceholders
} from '../platform/store.js';
import { openTestStore, requestedEngine } from './support/engine.mjs';

let checks = 0;
const ok = (cond, label) => { assert.ok(cond, label); checks++; };
const eq = (a, b, label) => { assert.deepEqual(a, b, label); checks++; };
const rejects = async (fn, test, label) => { await assert.rejects(fn, test, label); checks++; };

// ── Part 1 · Postgres transaction semantics against a scripted fake pool ────
function fakePool(script) {
  const log = [];
  let released = 0;
  let destroyed = 0;
  const client = {
    async query(sql) {
      log.push(sql);
      const step = script(sql, log);
      if (step instanceof Error) throw step;
      return step || { rows: [], rowCount: 0 };
    },
    release(error) { if (error) destroyed++; else released++; }
  };
  return {
    log,
    get released() { return released; },
    get destroyed() { return destroyed; },
    async connect() { return client; },
    async end() {}
  };
}
const pgError = code => Object.assign(new Error(`fake ${code}`), { code });

{
  // A serialization failure at COMMIT re-runs the whole callback.
  let commits = 0;
  const pool = fakePool(sql => {
    if (sql === 'COMMIT' && ++commits === 1) return pgError('40001');
    return undefined;
  });
  const store = new PostgresStore(pool, { ownsPool: false });
  let runs = 0;
  const result = await store.transaction(async tx => { runs++; await tx.run('UPDATE t SET n = n + 1 WHERE id = ?', [1]); return 'done'; });
  eq(result, 'done', '40001 at COMMIT: the retried transaction returns its result');
  eq(runs, 2, '40001 at COMMIT: the callback ran twice');
  eq(store.stats.retries, 1, '40001 at COMMIT: one retry is counted');
  ok(pool.log.filter(s => s === 'ROLLBACK').length === 1, '40001 at COMMIT: the failed attempt is rolled back');
  ok(pool.log.filter(s => s.startsWith('BEGIN ISOLATION LEVEL SERIALIZABLE')).length === 2, 'each attempt is its own SERIALIZABLE transaction');
  ok(pool.log.includes('UPDATE t SET n = n + 1 WHERE id = $1'), '`?` placeholders reach Postgres as $n');
}
{
  // A deadlock mid-transaction is retried the same way.
  let updates = 0;
  const pool = fakePool(sql => (sql.startsWith('UPDATE') && ++updates === 1 ? pgError('40P01') : undefined));
  const store = new PostgresStore(pool, { ownsPool: false });
  let runs = 0;
  await store.transaction(async tx => { runs++; await tx.run('UPDATE t SET n = 1'); });
  eq(runs, 2, '40P01 (deadlock) is retried');
}
{
  // A unique violation is an answer, not contention: never retried.
  const pool = fakePool(sql => (sql.startsWith('INSERT') ? pgError('23505') : undefined));
  const store = new PostgresStore(pool, { ownsPool: false });
  let runs = 0;
  await rejects(() => store.transaction(async tx => { runs++; await tx.run('INSERT INTO t VALUES (1)'); }),
    error => error.code === '23505', '23505 propagates');
  eq(runs, 1, '23505 is not retried');
  ok(isUniqueViolation(pgError('23505')) && isUniqueViolation({ code: 'SQLITE_CONSTRAINT_UNIQUE' }) && isUniqueViolation({ code: 'SQLITE_CONSTRAINT_PRIMARYKEY' }) && !isUniqueViolation(pgError('40001')),
    'isUniqueViolation recognises both engines');
}
{
  // Retries are bounded, and persistent contention is a retryable 503 — never
  // a bare driver error that the /v1 error handler would answer as 500.
  const pool = fakePool(sql => (sql === 'COMMIT' ? pgError('40001') : undefined));
  const store = new PostgresStore(pool, { ownsPool: false, maxAttempts: 3 });
  let runs = 0;
  await rejects(() => store.transaction(async () => { runs++; }),
    error => error.code === 'PLATFORM_DB_BUSY' && error.status === 503 && error.retryAfter === 1 && error.retryable === true && error.dbCode === '40001',
    'exhausted serialization retries surface as PLATFORM_DB_BUSY: 503, Retry-After 1, retryable, driver code kept for the log');
  eq(runs, 3, 'retries stop at maxAttempts');
  eq(pool.released + pool.destroyed, 3, 'every attempt returns its client to the pool');
}
{
  // Overload mapping: which driver errors become which retryable 503.
  const mapped = code => databaseOverload(pgError(code));
  ok(['40001', '40P01', '55P03'].every(code => mapped(code).code === 'PLATFORM_DB_BUSY' && mapped(code).status === 503),
    'serialization failure, deadlock and lock-not-available map to PLATFORM_DB_BUSY 503');
  ok(['57014', '25P03'].every(code => mapped(code).code === 'PLATFORM_DB_TIMEOUT' && mapped(code).retryAfter === 2),
    'statement timeout and idle-in-transaction termination map to PLATFORM_DB_TIMEOUT 503, Retry-After 2');
  const poolTimeout = databaseOverload(new Error('timeout exceeded when trying to connect'));
  ok(poolTimeout.code === 'PLATFORM_DB_BUSY' && poolTimeout.status === 503, 'no pooled connection in time is PLATFORM_DB_BUSY 503');
  ok(['23505', '22P02', '42P01'].every(code => mapped(code).code === code && !mapped(code).status), 'real answers and bugs are not disguised as overload');
  const answered = Object.assign(new Error('conflict'), { status: 409, code: 'SYNC_ENTITY_CONFLICT' });
  ok(databaseOverload(answered) === answered && isDatabaseOverload(mapped('40001')) && !isDatabaseOverload(answered), 'a composed answer passes through untouched');

  // A statement timeout inside a transaction is not retried; it is answered.
  const timeoutPool = fakePool(sql => (sql.startsWith('SELECT slow') ? pgError('57014') : undefined));
  const timeoutStore = new PostgresStore(timeoutPool, { ownsPool: false });
  let timeoutRuns = 0;
  await rejects(() => timeoutStore.transaction(async tx => { timeoutRuns++; await tx.get('SELECT slow'); }),
    error => error.code === 'PLATFORM_DB_TIMEOUT' && error.status === 503, 'a statement timeout in a transaction is PLATFORM_DB_TIMEOUT');
  eq(timeoutRuns, 1, 'and is not retried');

  // So is one outside a transaction, and a pool that cannot hand out a client.
  await rejects(() => timeoutStore.get('SELECT slow'), error => error.code === 'PLATFORM_DB_TIMEOUT', 'a statement timeout outside a transaction is PLATFORM_DB_TIMEOUT');
  const starved = new PostgresStore({ async connect() { throw new Error('timeout exceeded when trying to connect'); }, async end() {} }, { ownsPool: false });
  await rejects(() => starved.get('SELECT 1'), error => error.code === 'PLATFORM_DB_BUSY' && error.status === 503, 'pool exhaustion is PLATFORM_DB_BUSY');
}
{
  // Every pooled session gets search_path and both timeouts before its first statement.
  const pool = fakePool(() => undefined);
  const store = new PostgresStore(pool, { ownsPool: false, statementTimeoutMs: 15000, idleInTransactionTimeoutMs: 30000 });
  await store.get('SELECT 1');
  eq(pool.log[0], 'SET search_path TO pri; SET statement_timeout = 15000; SET idle_in_transaction_session_timeout = 30000',
    'session setup sets search_path, statement_timeout and idle_in_transaction_session_timeout');
  eq(pool.log.filter(sql => sql.startsWith('SET ')).length, 1, 'once per connection, not per statement');
  await rejects(async () => new PostgresStore(pool, { statementTimeoutMs: '15s; DROP TABLE x' }), error => error.code === 'STORE_SESSION_INVALID', 'a non-integer timeout is refused, so nothing but a number reaches SET');
}
{
  // A named lock is taken before BEGIN and released after COMMIT, on the same client.
  const lockScript = (acquired = () => true) => sql => {
    if (sql.startsWith('SELECT pg_try_advisory_lock')) return { rows: [{ acquired: acquired() }], rowCount: 1 };
    if (sql.startsWith('SELECT pg_advisory_unlock')) return { rows: [{ released: true }], rowCount: 1 };
    return undefined;
  };
  const pool = fakePool(lockScript());
  const store = new PostgresStore(pool, { ownsPool: false });
  let held;
  await store.transaction(async () => { held = store.heldLock(); await store.get('SELECT inside'); }, { lock: 'pri.sync:acct-1' });
  const order = pool.log.filter(sql => /pg_advisory|pg_try_advisory|^BEGIN|^COMMIT|SELECT inside/.test(sql));
  eq(order, ['SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS acquired', 'BEGIN ISOLATION LEVEL SERIALIZABLE', 'SELECT inside', 'COMMIT', 'SELECT pg_advisory_unlock(hashtextextended($1, 0)) AS released'],
    'lock → BEGIN → work → COMMIT → unlock: the snapshot is taken after the lock');
  ok(!pool.log.some(sql => sql.startsWith('SELECT pg_advisory_lock')), 'never a blocking pg_advisory_lock, which would hold a pooled connection while it waits');
  eq(held, 'pri.sync:acct-1', 'heldLock() names the lock inside the transaction');
  eq(store.heldLock(), null, 'and nothing outside it');
  eq([pool.released, pool.destroyed], [1, 0], 'a cleanly unlocked client goes back to the pool');

  // A client that cannot prove it released the lock is destroyed.
  const lost = fakePool(sql => (sql.startsWith('SELECT pg_try_advisory_lock') ? { rows: [{ acquired: true }] } : sql.startsWith('SELECT pg_advisory_unlock') ? { rows: [{ released: false }], rowCount: 1 } : undefined));
  await new PostgresStore(lost, { ownsPool: false }).transaction(async () => {}, { lock: 'k' });
  eq(lost.destroyed, 1, 'an unlock that reports false destroys the client (ending the session frees the lock)');

  // Another instance holds the lock: retried until it frees up, within the budget…
  let busyRounds = 3;
  const contended = fakePool(lockScript(() => busyRounds-- <= 0));
  await new PostgresStore(contended, { ownsPool: false, lockWaitMs: 1000 }).transaction(async () => {}, { lock: 'k' });
  eq(contended.log.filter(sql => sql.startsWith('SELECT pg_try_advisory_lock')).length, 4, 'a lock held elsewhere is retried with pg_try_advisory_lock until it frees');
  // …and past it, a retryable 503 with nothing begun and a reusable client.
  const stuck = fakePool(lockScript(() => false));
  const startedStuck = Date.now();
  await rejects(() => new PostgresStore(stuck, { ownsPool: false, lockWaitMs: 120 }).transaction(async () => {}, { lock: 'k' }),
    error => error.code === 'PLATFORM_DB_BUSY' && error.status === 503 && error.retryAfter === 1, 'a lock not obtained within lockWaitMs is PLATFORM_DB_BUSY 503');
  ok(Date.now() - startedStuck < 1000, 'and the wait is bounded by lockWaitMs, not statement_timeout');
  ok(!stuck.log.some(sql => sql.startsWith('BEGIN')) && stuck.released === 1 && stuck.destroyed === 0, 'no transaction was begun; the client holds no lock and goes back to the pool');
  // A lock statement that errors ends the session (no doubt left about a held lock).
  const failing = fakePool(sql => (sql.startsWith('SELECT pg_try_advisory_lock') ? pgError('57014') : undefined));
  await rejects(() => new PostgresStore(failing, { ownsPool: false }).transaction(async () => {}, { lock: 'k' }),
    error => error.code === 'PLATFORM_DB_TIMEOUT', 'a lock statement that times out is PLATFORM_DB_TIMEOUT');
  eq(failing.destroyed, 1, 'and its session is ended');

  // Waiters for one key queue in this process and take NO pooled connection.
  let connects = 0;
  let open = 0;
  let maxOpen = 0;
  const queued = fakePool(lockScript());
  const counting = { ...queued, async connect() { connects++; open++; maxOpen = Math.max(maxOpen, open); const client = await queued.connect(); return { ...client, query: client.query, release(error) { open--; client.release(error); } }; } };
  const queuedStore = new PostgresStore(counting, { ownsPool: false });
  const order2 = [];
  await Promise.all(Array.from({ length: 8 }, (_, i) => queuedStore.transaction(async () => {
    order2.push(i);
    await new Promise(resolve => setTimeout(resolve, 5));
  }, { lock: 'one-account' })));
  eq(maxOpen, 1, 'eight concurrent transactions for one lock key never hold more than ONE pooled connection');
  eq(order2, [0, 1, 2, 3, 4, 5, 6, 7], 'and run first come, first served');
  eq(connects, 8, 'each takes its connection only when it reaches the head of the queue');
  // A queued waiter past the budget leaves the queue with a 503.
  const slowStore = new PostgresStore(fakePool(lockScript()), { ownsPool: false, lockWaitMs: 40 });
  const holder = slowStore.transaction(async () => { await new Promise(resolve => setTimeout(resolve, 150)); }, { lock: 'q' });
  await new Promise(resolve => setTimeout(resolve, 5));
  await rejects(() => slowStore.transaction(async () => {}, { lock: 'q' }), error => error.code === 'PLATFORM_DB_BUSY' && error.dbCode === 'LOCK_QUEUE_TIMEOUT',
    'a waiter queued past lockWaitMs gets PLATFORM_DB_BUSY');
  await holder;
  eq(slowStore.localLocks.waiting('q'), 0, 'and is removed from the queue');
  await slowStore.transaction(async () => {}, { lock: 'q' });
  ok(slowStore.localLocks.waiting('q') === 0 && !slowStore.localLocks.queues.has('q'), 'the key is free again afterwards');

  // Snapshot isolation only with a lock; never by accident.
  const iso = fakePool(lockScript());
  const isoStore = new PostgresStore(iso, { ownsPool: false });
  await rejects(() => isoStore.transaction(async () => {}, { isolation: 'repeatable read' }), error => error.code === 'STORE_ISOLATION_REQUIRES_LOCK',
    "a writable 'repeatable read' transaction without a lock is refused");
  await rejects(() => isoStore.transaction(async () => {}, { isolation: 'read committed' }), error => error.code === 'STORE_ISOLATION_INVALID', 'other isolation levels are refused');
  await isoStore.transaction(async () => {}, { lock: 'k', isolation: 'repeatable read' });
  ok(iso.log.includes('BEGIN ISOLATION LEVEL REPEATABLE READ'), "with a lock, 'repeatable read' begins a snapshot-isolation transaction");
  await rejects(() => isoStore.transaction(async () => isoStore.transaction(async () => {}, { lock: 'other' }), { lock: 'k' }),
    error => error.code === 'STORE_LOCK_NESTED', 'a nested transaction cannot take a different lock');
}
{
  // No outbound I/O while a transaction is open (the webhook verifier contract).
  const pool = fakePool(() => undefined);
  const store = new PostgresStore(pool, { ownsPool: false });
  let spawned;
  await rejects(() => store.transaction(async () => {
    spawned = new Promise(resolve => setTimeout(() => resolve(inStoreTransaction()), 5));
    assertNoOpenTransaction('A test call');
  }), error => error.code === 'STORE_EXTERNAL_IO_IN_TRANSACTION', 'an outbound call inside a transaction is refused');
  ok(!inStoreTransaction() && (await spawned) === false, 'outside it — including a task spawned inside it that runs after it ended — it is allowed');
}
{
  // Backoff grows and is capped; the default budget outlasts a burst of
  // writers on one hot row (each conflict round commits at least one).
  ok(retryDelayMs(1, () => 0.999) <= 4 && retryDelayMs(4, () => 0.999) <= 32 && retryDelayMs(30, () => 0.999) <= 250 && retryDelayMs(30, () => 0) >= 1,
    'retry backoff is full-jitter exponential, at least 1 ms and capped at 250 ms');
  ok(new PostgresStore(fakePool(() => undefined), { ownsPool: false }).maxAttempts >= 16, 'the default retry budget is at least 16 attempts');
}
{
  // A savepoint must not pretend to have absorbed a serialization failure.
  let inner = 0;
  const pool = fakePool(sql => (sql.startsWith('UPDATE inner') && ++inner === 1 ? pgError('40001') : undefined));
  const store = new PostgresStore(pool, { ownsPool: false });
  let outerRuns = 0;
  await store.transaction(async tx => {
    outerRuns++;
    await tx.transaction(async nested => { await nested.run('UPDATE inner SET n = 1'); });
  });
  eq(outerRuns, 2, '40001 inside a savepoint re-runs the whole outer transaction');
  ok(!pool.log.some(s => s.startsWith('ROLLBACK TO SAVEPOINT')), 'and is not "handled" by rolling back to the savepoint');
}
{
  // A client whose ROLLBACK fails is destroyed, not reused.
  const pool = fakePool(sql => (sql === 'ROLLBACK' ? pgError('08006') : sql.startsWith('UPDATE') ? pgError('22P02') : undefined));
  const store = new PostgresStore(pool, { ownsPool: false });
  await rejects(() => store.transaction(async tx => { await tx.run('UPDATE t SET n = 1'); }), error => error.code === '22P02', 'the statement error propagates');
  eq(pool.destroyed, 1, 'a client that could not roll back is destroyed');
}
{
  const pool = fakePool(() => undefined);
  const store = new PostgresStore(pool, { ownsPool: false });
  await store.transaction(async () => {}, { readOnly: true });
  ok(pool.log.includes('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'), 'readOnly transactions take one REPEATABLE READ snapshot');
}
eq(toPostgresPlaceholders("SELECT '?' AS q, \"a?\" FROM t WHERE a = ? AND b = ? -- trailing ?\n AND c = ? /* ? */"),
  "SELECT '?' AS q, \"a?\" FROM t WHERE a = $1 AND b = $2 -- trailing ?\n AND c = $3 /* ? */",
  'placeholders inside literals, identifiers and comments are left alone');
{
  const types = postgresTypes({ getTypeParser: () => value => `default:${value}` });
  const int8 = types.getTypeParser(20, 'text');
  eq(int8('1700000000000'), 1_700_000_000_000, 'BIGINT epoch milliseconds parse to Number');
  assert.throws(() => int8('9007199254740993'), error => error.code === 'STORE_INT8_UNSAFE'); checks++;
  eq(types.getTypeParser(25, 'text')('x'), 'default:x', 'other types keep pg defaults');
}

// ── Part 2 · the same contract on a real engine ─────────────────────────────
const engine = requestedEngine();
const { store, close, url } = await openTestStore(engine, { label: 'store', max: 12 });
const now = Date.now();
try {
  eq(store.dialect, engine, `the store reports its engine (${engine})`);
  await store.run(`INSERT INTO accounts(id,email,name,role,created_at,updated_at) VALUES (?,?,?,?,?,?)`, ['acct-store', 'store.case@example.test', 'Zed', 'student', now, now]);
  await store.run(`INSERT INTO accounts(id,email,name,role,created_at,updated_at) VALUES (?,?,?,?,?,?)`, ['acct-store-2', 'second@example.test', 'adam', 'student', now, now]);
  await store.run(`INSERT INTO accounts(id,email,name,role,created_at,updated_at) VALUES (?,?,?,?,?,?)`, ['acct-store-3', 'third@example.test', 'Beth', 'student', now, now]);

  // Atomicity.
  await rejects(() => store.transaction(async tx => {
    await tx.run("UPDATE accounts SET name='changed' WHERE id=?", ['acct-store']);
    throw new Error('abort');
  }), /abort/, 'a throwing transaction rejects');
  eq((await store.get('SELECT name FROM accounts WHERE id=?', ['acct-store'])).name, 'Zed', 'and leaves nothing behind');

  // Nested transaction = savepoint: the inner failure rolls back only the inner work.
  await store.transaction(async tx => {
    await tx.run("UPDATE accounts SET name='outer' WHERE id=?", ['acct-store']);
    await rejects(() => tx.transaction(async nested => {
      await nested.run("UPDATE accounts SET name='inner' WHERE id=?", ['acct-store-2']);
      throw new Error('inner abort');
    }), /inner abort/, 'a failing nested transaction rejects');
  });
  eq((await store.get('SELECT name FROM accounts WHERE id=?', ['acct-store'])).name, 'outer', 'the outer transaction commits');
  eq((await store.get('SELECT name FROM accounts WHERE id=?', ['acct-store-2'])).name, 'adam', 'the savepoint rolled back only the inner write');
  await store.run("UPDATE accounts SET name='Zed' WHERE id=?", ['acct-store']);

  // A helper handed the store (not tx) joins the open transaction.
  const helper = async () => store.run("UPDATE accounts SET name='via-helper' WHERE id=?", ['acct-store-3']);
  await rejects(() => store.transaction(async () => { await helper(); throw new Error('roll back the helper too'); }),
    /roll back/, 'a transaction whose helper wrote then failed rejects');
  eq((await store.get('SELECT name FROM accounts WHERE id=?', ['acct-store-3'])).name, 'Beth', 'the helper write joined the transaction and rolled back with it');

  // Lost-update freedom under concurrency: read, yield, write.
  await store.run(`INSERT INTO rate_limits(bucket, window_start, count) VALUES ('counter', 0, 0)`);
  const before = { ...store.stats };
  const WRITERS = 10;
  await Promise.all(Array.from({ length: WRITERS }, () => store.transaction(async tx => {
    const row = await tx.get(`SELECT count FROM rate_limits WHERE bucket='counter'`);
    await new Promise(resolve => setTimeout(resolve, 15));
    await tx.run(`UPDATE rate_limits SET count = ? WHERE bucket='counter'`, [Number(row.count) + 1]);
  })));
  eq(Number((await store.get(`SELECT count FROM rate_limits WHERE bucket='counter'`)).count), WRITERS, `${WRITERS} concurrent read-modify-write transactions lose no update`);
  const retries = store.stats.retries - before.retries;
  if (engine === 'postgres') ok(retries > 0, `Postgres resolved the contention by SERIALIZABLE retry (${retries} retries)`);
  else eq(retries, 0, 'SQLite serialises transactions on its lock and never needs a retry');

  // A statement outside a transaction never lands inside another request's one.
  const order = [];
  const slow = store.transaction(async tx => {
    await tx.run("UPDATE accounts SET name='mid-transaction' WHERE id=?", ['acct-store']);
    order.push('tx-wrote');
    await new Promise(resolve => setTimeout(resolve, 25));
    await tx.run("UPDATE accounts SET name='Zed' WHERE id=?", ['acct-store']);
    order.push('tx-committing');
  });
  await new Promise(resolve => setTimeout(resolve, 5));
  const seen = (await store.get('SELECT name FROM accounts WHERE id=?', ['acct-store'])).name;
  order.push('outside-read');
  await slow;
  eq(seen, 'Zed', 'an outside read never sees another transaction\'s uncommitted write');

  // Dialect helpers give the same answers on both engines.
  eq((await store.get(`SELECT id FROM accounts WHERE ${store.emailEquals('email')}`, ['STORE.Case@Example.TEST']))?.id, 'acct-store', 'email lookup is case-insensitive');
  eq((await store.all(`SELECT name FROM accounts WHERE id LIKE 'acct-store%' ORDER BY ${store.nocaseOrder('name')}`)).map(r => r.name), ['adam', 'Beth', 'Zed'], 'names order case-insensitively');
  eq((await store.all(`SELECT name FROM accounts WHERE id LIKE 'acct-store%' ORDER BY ${store.binaryText('name')}`)).map(r => r.name), ['Beth', 'Zed', 'adam'], 'binary order is bytewise');
  eq(Number((await store.get(`SELECT ${store.greatest('?', '?')} AS m`, [3, 7])).m), 7, 'greatest() is a two-argument maximum');
  eq((await store.all(`SELECT id FROM accounts WHERE name LIKE ?${store.likeEscape()} ORDER BY id`, ['a\\%'])).length, 0, 'a backslash in a LIKE pattern is literal on both engines');

  // Unique violations are recognisable on both engines.
  await rejects(() => store.run(`INSERT INTO accounts(id,email,name,role,created_at,updated_at) VALUES (?,?,?,?,?,?)`, ['acct-dupe', 'store.case@example.test', 'Dupe', 'student', now, now]),
    error => isUniqueViolation(error), 'a duplicate email is a unique violation');

  // BIGINT columns come back as numbers.
  const created = (await store.get('SELECT created_at FROM accounts WHERE id=?', ['acct-store'])).created_at;
  ok(typeof created === 'number' && created === now, 'epoch-ms BIGINT columns round-trip as Number');
  // RETURNING works through run() and get() on both engines.
  const bumped = await store.get(`UPDATE rate_limits SET count = count + 1 WHERE bucket = 'counter' RETURNING count`);
  ok(typeof bumped.count === 'number' && bumped.count === WRITERS + 1, 'UPDATE … RETURNING returns the new row');
  if (engine === 'postgres') {
    // The pre-sequence allocator, as a build from before migration
    // 20261002000000 would run it as pri_server: refused, so such a build fails
    // closed instead of handing out stale cursors.
    await rejects(() => store.get('UPDATE sync_cursors SET value = value + 1 WHERE id = 1 RETURNING value'),
      error => error.code === '42501', 'an old-style sync_cursors allocation is refused to pri_server (42501) after the migration');
    await rejects(() => store.transaction(async tx => {
      await tx.run(`INSERT INTO learning_events(server_cursor,id,account_id,device_id,device_seq,kind,payload_json,created_at)
        VALUES (999999,'old-build-evt','acct-store','old-device',1,'practice-attempt','{}',?)`, [now]);
      await tx.get('UPDATE sync_cursors SET value = value + 1 WHERE id = 1 RETURNING value');
    }), error => error.code === '42501', 'an old build\'s whole push transaction fails');
    eq(Number((await store.get(`SELECT COUNT(*) AS n FROM learning_events WHERE id='old-build-evt'`)).n), 0, 'and writes nothing');
    eq(Number((await store.get('SELECT value FROM sync_cursors WHERE id=1')).value), 0, 'the row stays readable and untouched');
    await rejects(() => store.transaction(async tx => tx.run("UPDATE accounts SET name='x' WHERE id=?", ['acct-store']), { readOnly: true }),
      error => error.code === '25006', 'a readOnly transaction refuses writes');
  }

  // A named lock is visible to code inside the transaction on both engines.
  eq(await store.transaction(async () => store.heldLock(), { lock: 'pri.sync:acct-store' }), 'pri.sync:acct-store', 'heldLock() inside a locked transaction');

  if (engine === 'sqlite') {
    // A COMMIT that throws must not leave the transaction open behind the lock.
    const raw = store.raw;
    const realExec = raw.exec.bind(raw);
    let failCommit = true;
    raw.exec = sql => {
      if (sql === 'COMMIT' && failCommit) { failCommit = false; throw Object.assign(new Error('injected COMMIT failure'), { code: 'SQLITE_IOERR' }); }
      return realExec(sql);
    };
    try {
      await rejects(() => store.transaction(async tx => { await tx.run("UPDATE accounts SET name='never-committed' WHERE id=?", ['acct-store']); }),
        error => error.code === 'SQLITE_IOERR', 'a failing COMMIT rejects with its own error');
      ok(!raw.inTransaction, 'and the transaction was rolled back before the lock was released');
      eq((await store.get('SELECT name FROM accounts WHERE id=?', ['acct-store'])).name, 'Zed', 'its write is gone');
      await store.transaction(async tx => { await tx.run("UPDATE accounts SET name='next' WHERE id=?", ['acct-store']); });
      eq((await store.get('SELECT name FROM accounts WHERE id=?', ['acct-store'])).name, 'next', 'the next transaction begins and commits normally');
      await store.run("UPDATE accounts SET name='Zed' WHERE id=?", ['acct-store']);
    } finally {
      raw.exec = realExec;
    }
  }

  if (engine === 'postgres') {
    // Session limits are applied to every connection, from the environment.
    eq((await store.get('SHOW statement_timeout')).statement_timeout, '15s', 'default statement_timeout is 15 s on every connection');
    eq((await store.get('SHOW idle_in_transaction_session_timeout')).idle_in_transaction_session_timeout, '30s', 'default idle_in_transaction_session_timeout is 30 s');
    // One lock key cannot take the pool. 20 transactions for one account, each
    // holding its lock for 40 ms (≥ 800 ms in all), on a 3-connection pool:
    // transactions for other accounts, started meanwhile, finish long before
    // that queue drains — the queue waits in process, holding one connection.
    const small = await createPostgresStore(url, { env: { ...process.env, PRI_DATABASE_POOL_MAX: '3' } });
    try {
      const startedAt = Date.now();
      let hotOpen = 0;
      let hotMaxOpen = 0;
      const hot = Array.from({ length: 20 }, () => small.transaction(async tx => {
        hotOpen++; hotMaxOpen = Math.max(hotMaxOpen, hotOpen);
        await tx.get('SELECT 1');
        await new Promise(resolve => setTimeout(resolve, 40));
        hotOpen--;
      }, { lock: 'pri.sync:hot-account', isolation: 'repeatable read' }).then(() => Date.now() - startedAt));
      await new Promise(resolve => setTimeout(resolve, 20));
      const cool = Array.from({ length: 5 }, (_, i) => small.transaction(async tx => tx.get('SELECT ? AS i', [i]), { lock: `pri.sync:cool-${i}`, isolation: 'repeatable read' })
        .then(() => Date.now() - startedAt));
      const plain = small.get('SELECT 1 AS n').then(() => Date.now() - startedAt);
      const [hotTimes, coolTimes, plainTime] = await Promise.all([Promise.all(hot), Promise.all(cool), plain]);
      const hotLast = Math.max(...hotTimes);
      const coolLast = Math.max(...coolTimes, plainTime);
      ok(hotLast >= 800, `the one account's 20 transactions ran one at a time (${hotLast} ms)`);
      ok(coolLast < 400 && coolLast < hotLast / 2, `other accounts and plain queries are not starved behind them (done by ${coolLast} ms of ${hotLast} ms)`);
      eq(hotMaxOpen, 1, 'and the account never had two transactions open at once');
    } finally {
      await small.close();
    }

    const tight = await createPostgresStore(url, { env: {
      ...process.env, PRI_DATABASE_STATEMENT_TIMEOUT_MS: '1200', PRI_DATABASE_IDLE_TX_TIMEOUT_MS: '1000', PRI_DATABASE_POOL_MAX: '3'
    } });
    try {
      eq(tight.pool.options.max, 3, 'PRI_DATABASE_POOL_MAX sizes the pool');
      eq((await tight.get('SHOW statement_timeout')).statement_timeout, '1200ms', 'PRI_DATABASE_STATEMENT_TIMEOUT_MS is applied');
      eq((await tight.get('SHOW idle_in_transaction_session_timeout')).idle_in_transaction_session_timeout, '1s', 'PRI_DATABASE_IDLE_TX_TIMEOUT_MS is applied');
      await rejects(() => tight.get('SELECT pg_sleep(3)'), error => error.code === 'PLATFORM_DB_TIMEOUT' && error.status === 503 && error.dbCode === '57014',
        'a statement past statement_timeout is cancelled and answered PLATFORM_DB_TIMEOUT 503');
      await rejects(() => tight.transaction(async tx => {
        await tx.get('SELECT 1');
        await new Promise(resolve => setTimeout(resolve, 1600));
        await tx.get('SELECT 2');
      }), error => error.code === 'PLATFORM_DB_TIMEOUT' && error.dbCode === '25P03',
      'a transaction left idle past the limit is ended by the server, answered PLATFORM_DB_TIMEOUT, and does not crash the process');
      eq(Number((await tight.get('SELECT 3 AS n')).n), 3, 'and the pool carries on with a fresh connection');
    } finally {
      await tight.close();
    }
  }

  console.log(`engine: ${engine}`);
  console.log(`PLATFORM STORE: PASS — ${checks}/${checks} checks — retry on 40001/40P01 only and bounded, overload as a coded 503, locks before BEGIN, session timeouts, savepoints, joined helpers, no lost updates under concurrency and identical dialect answers on ${engine}.`);
} finally {
  await close();
}
