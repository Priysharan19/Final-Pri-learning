// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a burst of sync pushes: no 500s, no skipped changes
// (ADR-0001 go-live, finding 1)
//
//   node server/test/platform-sync-burst-check.mjs                    → SQLite
//   node server/test/platform-sync-burst-check.mjs --engine=postgres  → Postgres
//
// Every push used to advance one global sync_cursors row inside its
// SERIALIZABLE transaction, so on Postgres every concurrent push conflicted
// with every other; ~120 at once exhausted the retry budget and one answered
// 500. Cursors now come from a sequence, and a per-account lock keeps each
// account's cursors in commit order (db.js nextSyncCursor). This suite proves:
//
//   1. BURST. 150 pushes from 30 verified accounts, all at once, through the real
//      /v1 app and a 40-connection pool: none answers 500; anything the database could not take
//      right now is a 503 with Retry-After and a PLATFORM_DB_* code, and resent
//      it succeeds; every event and entity is stored exactly once.
//   2. NO SKIPPED CHANGES. Devices pull WHILE the burst commits, keeping their
//      cursor exactly as the client does; after it, they pull from where they
//      stopped. Each one must have seen every row of its account.
//   3. COMMIT ORDER (Postgres). Two transactions for one account: the second
//      cannot allocate until the first commits, so it always gets the higher
//      cursor. A transaction for another account is not held up. And the
//      control: the same interleaving WITHOUT the lock really does make a pull
//      skip a row — the hazard the lock exists for.
//   4. OVERLOAD IS A 503 (Postgres). A push stuck behind its account's lock past
//      statement_timeout answers 503 + Retry-After + PLATFORM_DB_TIMEOUT, not 500.
// ─────────────────────────────────────────────────────────────────────────────
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const envNames = ['NODE_ENV', 'PRI_PUBLIC_ORIGIN', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_DATABASE_STATEMENT_TIMEOUT_MS', 'PRI_DATABASE_POOL_MAX'];
const prior = Object.fromEntries(envNames.map(name => [name, process.env[name]]));
const scratch = mkdtempSync(join(tmpdir(), 'pri-sync-burst-'));
process.env.NODE_ENV = 'test';
delete process.env.PRI_PUBLIC_ORIGIN;
delete process.env.PRI_DATABASE_STATEMENT_TIMEOUT_MS;
// A 40-connection pool (production allows up to 50): with the default 10 the
// pool itself queues the burst and hides the contention. With 40, the previous
// single-row allocator answered 500 to 1-2 of these 150 pushes on every run.
process.env.PRI_DATABASE_POOL_MAX = '40';
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = '78'.repeat(32);

const { startApp, registerAccount, checks } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const { nextSyncCursor, syncLockKey } = await import('../platform/db.js');
const { syncPullPage } = await import('../platform/sync.js');

const engine = requestedEngine();
const c = checks();
const ACCOUNTS = 30;
const PUSHES_PER_ACCOUNT = 5;
const EVENTS_PER_PUSH = 3;
const PULLING_ACCOUNTS = 10;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// macOS caps a listen backlog at 128 (kern.ipc.somaxconn), so opening 150
// sockets at once can have the kernel reset a connect before the server ever
// sees it. That request never reached the app; resending it is what any client
// does and proves nothing either way about the database. Counted and reported.
let connectResets = 0;
async function send(h, path, options) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await h.request(path, options);
    } catch (error) {
      const cause = error?.cause;
      if (attempt < 20 && cause?.syscall === 'connect' && ['ECONNRESET', 'ECONNREFUSED'].includes(cause.code)) {
        connectResets++;
        await sleep(10 + attempt * 10);
        continue;
      }
      throw error;
    }
  }
}

async function registerVerified(h, i, prefix) {
  await h.db.run('DELETE FROM rate_limits');
  const deviceId = `ipad-${prefix}-${i}`;
  const registered = await registerAccount(h, { email: `${prefix}.${i}@example.test`, deviceId });
  if (registered.status !== 201) throw new Error(`registration ${i} failed: ${registered.status} ${registered.text.slice(0, 200)}`);
  await h.db.run('UPDATE accounts SET email_verified_at=? WHERE id=?', [Date.now(), registered.account.id]);
  return { id: registered.account.id, jar: registered.jar, deviceId };
}

function pushBody(account, p) {
  return {
    schemaVersion: 1,
    deviceId: account.deviceId,
    events: Array.from({ length: EVENTS_PER_PUSH }, (_, k) => {
      const seq = p * EVENTS_PER_PUSH + k + 1;
      return { id: `burst-${p}-${k}`, deviceId: account.deviceId, deviceSeq: seq, kind: 'practice-attempt', payload: { p, k } };
    }),
    entities: [{ kind: 'bookmark', entityId: `burst-bookmark-${p}`, operation: 'upsert', baseVersion: 0, body: { p } }]
  };
}

/** Pull the way the client's sync worker does: follow hasMore, keep the cursor. */
async function pullFrom(h, account, state) {
  for (let page = 0; page < 100; page++) {
    const response = await send(h, `/v1/sync/pull/${state.cursor}`, { jar: account.jar });
    if (response.status === 429) return 'rate-limited';
    if (response.status !== 200) throw new Error(`pull answered ${response.status}: ${response.text.slice(0, 200)}`);
    for (const event of response.data.events) state.events.add(event.id);
    for (const entity of response.data.entities) state.entities.add(entity.entityId);
    if (response.data.cursor < state.cursor) throw new Error('a pull moved the cursor backwards');
    state.cursor = response.data.cursor;
    state.pages++;
    if (!response.data.hasMore) return 'done';
  }
  throw new Error('pull exceeded 100 pages');
}

const h = await startApp({ engine });
try {
  // ── 1 · The burst ──────────────────────────────────────────────────────────
  const accounts = [];
  for (let i = 0; i < ACCOUNTS; i++) accounts.push(await registerVerified(h, i, 'burst'));
  await h.db.run('DELETE FROM rate_limits');
  const pullStates = accounts.slice(0, PULLING_ACCOUNTS).map(() => ({ cursor: 0, events: new Set(), entities: new Set(), pages: 0 }));

  let bursting = true;
  const pullers = pullStates.map(async (state, i) => {
    // Devices polling during the burst, each at its own pace.
    while (bursting) {
      if (await pullFrom(h, accounts[i], state) === 'rate-limited') break;
      await sleep(15 + i * 3);
    }
  });

  const statuses = new Map();
  const note = status => statuses.set(status, (statuses.get(status) || 0) + 1);
  const overloads = [];
  const jobs = [];
  for (const account of accounts) {
    for (let p = 0; p < PUSHES_PER_ACCOUNT; p++) {
      jobs.push((async () => {
        const body = pushBody(account, p);
        for (let attempt = 0; ; attempt++) {
          const response = await send(h, '/v1/sync/push', {
            method: 'POST', jar: account.jar, headers: { 'Idempotency-Key': `burst-${account.id}-${p}` }, body
          });
          note(response.status);
          if (response.status === 503) {
            overloads.push({ retryAfter: response.headers.get('retry-after'), code: response.data?.error?.code, retryable: response.data?.error?.retryable });
            if (attempt < 5) { await sleep(Number(response.headers.get('retry-after') || 1) * 100); continue; }
          }
          return response;
        }
      })());
    }
  }
  const started = Date.now();
  const finals = await Promise.all(jobs);
  const burstMs = Date.now() - started;
  bursting = false;
  await Promise.all(pullers);

  const total = ACCOUNTS * PUSHES_PER_ACCOUNT;
  const summary = [...statuses].map(([s, n]) => `${s}×${n}`).join(' ');
  console.log(`burst: ${total} pushes in ${burstMs} ms — statuses ${summary}; ${overloads.length} overload answers; ${connectResets} kernel connect resets resent; store retries ${h.db.stats?.retries ?? 0}`);
  c.eq(statuses.get(500) || 0, 0, `no push of ${total} concurrent pushes answers 500 (${summary}, ${burstMs} ms, ${connectResets} kernel connect resets resent)`);
  c.ok(overloads.every(o => /^\d+$/.test(String(o.retryAfter)) && /^PLATFORM_DB_(BUSY|TIMEOUT)$/.test(String(o.code)) && o.retryable === true),
    `every overload answer is a coded, retryable 503 with Retry-After (${overloads.length} seen)`);
  c.ok(finals.every(r => r.status === 200), `every push is accepted, resent where told to (${finals.filter(r => r.status !== 200).map(r => `${r.status}:${r.data?.error?.code}`).join(',') || 'all 200'})`);

  const expectedEvents = ACCOUNTS * PUSHES_PER_ACCOUNT * EVENTS_PER_PUSH;
  c.eq(Number((await h.db.get(`SELECT COUNT(*) AS n FROM learning_events WHERE id LIKE 'burst-%'`)).n), expectedEvents, `all ${expectedEvents} events are stored, once each`);
  c.eq(Number((await h.db.get(`SELECT COUNT(*) AS n FROM sync_entities WHERE entity_id LIKE 'burst-bookmark-%'`)).n), ACCOUNTS * PUSHES_PER_ACCOUNT, 'every entity is stored once');
  const cursorRows = await h.db.all(`SELECT server_cursor AS c FROM learning_events UNION ALL SELECT server_cursor AS c FROM sync_entities`);
  c.eq(new Set(cursorRows.map(r => Number(r.c))).size, cursorRows.length, 'no two rows share a server cursor');
  const acknowledged = finals.flatMap(r => r.data.acceptedEvents.map(e => e.serverCursor));
  c.ok(acknowledged.every(Number.isSafeInteger) && new Set(acknowledged).size === acknowledged.length, 'every acknowledged event cursor is a distinct integer');

  // ── 2 · Nobody pulling during the burst missed anything ───────────────────
  await h.db.run('DELETE FROM rate_limits');
  let missing = 0;
  let midBurstPages = 0;
  for (const [i, state] of pullStates.entries()) {
    midBurstPages += state.pages;
    await pullFrom(h, accounts[i], state);
    const stored = await h.db.all('SELECT id FROM learning_events WHERE account_id=?', [accounts[i].id]);
    const storedEntities = await h.db.all('SELECT entity_id FROM sync_entities WHERE account_id=?', [accounts[i].id]);
    missing += stored.filter(r => !state.events.has(r.id)).length + storedEntities.filter(r => !state.entities.has(r.entity_id)).length;
    if (stored.length !== PUSHES_PER_ACCOUNT * EVENTS_PER_PUSH) missing += 1000;
  }
  c.ok(midBurstPages > 0, `devices really pulled while the burst committed (${midBurstPages} pages)`);
  c.eq(missing, 0, `${PULLING_ACCOUNTS} devices that pulled during the burst and resumed from their cursor saw every row of their account`);

  // ── 3 · Commit order per account (store level) ─────────────────────────────
  const store = h.db;
  const [solo, other] = accounts;
  let seq = 10_000;
  const write = (accountId, cursor) => store.run(`INSERT INTO learning_events(server_cursor,id,account_id,device_id,device_seq,kind,entity_id,occurred_at,payload_json,created_at)
    VALUES (?,?,?,?,?,'practice-attempt',NULL,NULL,'{}',?)`, [cursor, `order-${++seq}`, accountId, 'order-device', seq, Date.now()]);
  const timeline = [];
  const slow = store.transaction(async () => {
    const cursor = await nextSyncCursor(store, solo.id);
    await write(solo.id, cursor);
    await sleep(150);
    timeline.push(['slow-commit', Date.now()]);
    return cursor;
  }, { lock: syncLockKey(solo.id) });
  await sleep(20);
  const fast = store.transaction(async () => {
    timeline.push(['fast-allocates', Date.now()]);
    const cursor = await nextSyncCursor(store, solo.id);
    await write(solo.id, cursor);
    return cursor;
  }, { lock: syncLockKey(solo.id) });
  const elsewhere = store.transaction(async () => {
    const cursor = await nextSyncCursor(store, other.id);
    await write(other.id, cursor);
    timeline.push(['other-account-commit', Date.now()]);
    return cursor;
  }, { lock: syncLockKey(other.id) });
  const [slowCursor, fastCursor] = await Promise.all([slow, fast, elsewhere]);
  const at = name => timeline.find(([n]) => n === name)?.[1];
  c.ok(fastCursor > slowCursor, `the later writer for one account gets the higher cursor (${slowCursor} < ${fastCursor})`);
  c.ok(at('fast-allocates') >= at('slow-commit'), 'and could not even start until the earlier one committed');
  if (engine === 'postgres') {
    c.ok(at('other-account-commit') < at('slow-commit'), 'another account\'s push is not held up by this account\'s lock');

    // The control: the same interleaving without the lock, on raw connections.
    const { pgModule } = await import('./support/postgres.mjs');
    const pg = await pgModule();
    const connect = async () => { const client = new pg.Client({ connectionString: h.url }); await client.connect(); await client.query('SET search_path TO pri'); return client; };
    const [a, b] = [await connect(), await connect()];
    try {
      const raw = async (client, cursor, id) => client.query(`INSERT INTO learning_events(server_cursor,id,account_id,device_id,device_seq,kind,payload_json,created_at)
        VALUES ($1,$2,$3,'control-device',$4,'practice-attempt','{}',$5)`, [cursor, id, solo.id, cursor, Date.now()]);
      const startCursor = (await syncPullPage(store, solo.id, 0)).cursor;
      await a.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
      const low = Number((await a.query("SELECT nextval('sync_cursor_seq') AS v")).rows[0].v);
      await raw(a, low, 'control-low');
      await b.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
      const high = Number((await b.query("SELECT nextval('sync_cursor_seq') AS v")).rows[0].v);
      await raw(b, high, 'control-high');
      await b.query('COMMIT');
      const seen = await syncPullPage(store, solo.id, startCursor);
      await a.query('COMMIT');
      const after = await syncPullPage(store, solo.id, seen.cursor);
      c.ok(seen.events.some(e => e.id === 'control-high') && !after.events.some(e => e.id === 'control-low'),
        'control: WITHOUT the lock, a row committed after a higher cursor is skipped by a pull — the hazard the lock prevents');
    } finally {
      await a.end().catch(() => {});
      await b.end().catch(() => {});
    }
  }
} finally {
  await h.close();
}

// ── 4 · Overload is a 503 with Retry-After, never a 500 (Postgres) ──────────
if (engine === 'postgres') {
  process.env.PRI_DATABASE_STATEMENT_TIMEOUT_MS = '1500';
  const slowApp = await startApp({ engine });
  try {
    const account = await registerVerified(slowApp, 0, 'stuck');
    const { pgModule } = await import('./support/postgres.mjs');
    const pg = await pgModule();
    const holder = new pg.Client({ connectionString: slowApp.url });
    await holder.connect();
    try {
      await holder.query('SELECT pg_advisory_lock(hashtextextended($1, 0))', [syncLockKey(account.id)]);
      const stuck = await slowApp.request('/v1/sync/push', {
        method: 'POST', jar: account.jar, headers: { 'Idempotency-Key': 'stuck-1' }, body: pushBody(account, 0)
      });
      c.eq(stuck.status, 503, `a push that cannot get its account's lock within statement_timeout answers 503 (${stuck.status} ${stuck.text.slice(0, 120)})`);
      c.eq(stuck.headers.get('retry-after'), '2', 'with Retry-After');
      c.eq(stuck.data?.error?.code, 'PLATFORM_DB_TIMEOUT', 'and the coded error PLATFORM_DB_TIMEOUT');
      c.eq(stuck.data?.error?.retryable, true, 'marked retryable');
      await holder.query('SELECT pg_advisory_unlock(hashtextextended($1, 0))', [syncLockKey(account.id)]);
      const resent = await slowApp.request('/v1/sync/push', {
        method: 'POST', jar: account.jar, headers: { 'Idempotency-Key': 'stuck-1' }, body: pushBody(account, 0)
      });
      c.eq(resent.status, 200, 'resent once the lock is free, the same push is accepted');
      c.eq(Number((await slowApp.db.get('SELECT COUNT(*) AS n FROM learning_events WHERE account_id=?', [account.id])).n), EVENTS_PER_PUSH, 'and nothing of the timed-out attempt was kept');
    } finally {
      await holder.end().catch(() => {});
    }
  } finally {
    await slowApp.close();
  }
}

for (const name of envNames) {
  if (prior[name] === undefined) delete process.env[name];
  else process.env[name] = prior[name];
}
rmSync(scratch, { recursive: true, force: true });
console.log(`engine: ${engine}`);
console.log(`PLATFORM SYNC BURST: PASS — ${c.count()}/${c.count()} checks — ${ACCOUNTS * PUSHES_PER_ACCOUNT} concurrent pushes: no 500s, every overload a coded 503 with Retry-After, every change stored once and seen by devices pulling mid-burst; per-account cursors follow commit order on ${engine}.`);
