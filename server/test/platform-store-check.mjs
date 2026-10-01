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
  PostgresStore, isUniqueViolation, postgresTypes, retryDelayMs, toPostgresPlaceholders
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
  // Retries are bounded: persistent contention surfaces as 40001.
  const pool = fakePool(sql => (sql === 'COMMIT' ? pgError('40001') : undefined));
  const store = new PostgresStore(pool, { ownsPool: false, maxAttempts: 3 });
  let runs = 0;
  await rejects(() => store.transaction(async () => { runs++; }), error => error.code === '40001', 'exhausted retries surface the serialization failure');
  eq(runs, 3, 'retries stop at maxAttempts');
  eq(pool.released + pool.destroyed, 3, 'every attempt returns its client to the pool');
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
const { store, close } = await openTestStore(engine, { label: 'store', max: 12 });
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
  const bumped = await store.get(`UPDATE sync_cursors SET value = value + 1 WHERE id = 1 RETURNING value`);
  ok(typeof bumped.value === 'number' && bumped.value >= 1, 'UPDATE … RETURNING returns the new row');
  if (engine === 'postgres') {
    await rejects(() => store.transaction(async tx => tx.run("UPDATE accounts SET name='x' WHERE id=?", ['acct-store']), { readOnly: true }),
      error => error.code === '25006', 'a readOnly transaction refuses writes');
  }

  console.log(`engine: ${engine}`);
  console.log(`PLATFORM STORE: PASS — ${checks}/${checks} checks — retry on 40001/40P01 only and bounded, savepoints, joined helpers, no lost updates under concurrency and identical dialect answers on ${engine}.`);
} finally {
  await close();
}
