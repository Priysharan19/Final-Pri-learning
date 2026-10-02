// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · automated failure and recovery drills (V1 hard blocker #15)
//
//   node server/test/failure-drills-check.mjs                    → SQLite
//   node server/test/failure-drills-check.mjs --engine=postgres  → Postgres
//                                         (scripts/with-postgres.mjs)
//
// Each drill breaks one dependency of a running /v1 server, checks that the
// server answers with a coded, retryable refusal (never a 500 or a hang), that
// nothing is corrupted, and that it recovers by itself when the dependency
// comes back:
//
//   1. DATABASE UNAVAILABLE at runtime. On Postgres the server's connections
//      go through a TCP relay that the drill cuts (every socket destroyed, new
//      connections refused) and restores — a real network-level outage of a
//      real Postgres. On SQLite the store is faulted with the driver error a
//      refused connection produces.
//   2. PROVIDER timeout / 5xx / 429 / malformed for handwriting and working,
//      from a local fake provider the server is pointed at.
//   3. EMAIL PROVIDER failure: bounded retry with backoff, no account state
//      touched, delivery once the provider is back.
//   4. PROCESS RESTART mid-request: a push that died before its commit and a
//      push whose response was lost after its commit are both replayed against
//      a freshly started server on the same database; each is applied once.
//
// docs/operations/drills.md lists the manual versions for staging/production.
// ─────────────────────────────────────────────────────────────────────────────
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createTcpServer, connect } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const names = ['NODE_ENV', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_PUBLIC_ORIGIN', 'PRI_HANDWRITING_API_KEY',
  'PRI_HANDWRITING_ENDPOINT', 'PRI_WORKING_ENDPOINT', 'PRI_PAID_CALLS_PER_HOUR', 'PRI_PAID_CALLS_PER_DAY',
  'PRI_HANDWRITING_TIMEOUT_MS', 'PRI_WORKING_TIMEOUT_MS', 'PRI_AUTH_EMAIL_PROVIDER', 'PRI_RESEND_API_KEY', 'PRI_AUTH_EMAIL_FROM', 'PRI_METRICS_TOKEN'];
const prior = Object.fromEntries(names.map(name => [name, process.env[name]]));
const scratch = mkdtempSync(join(tmpdir(), 'pri-failure-drills-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = '88'.repeat(32);
delete process.env.PRI_PUBLIC_ORIGIN;
for (const name of names.slice(4)) delete process.env[name];

const { startApp, registerAccount, checks } = await import('./support/app-harness.mjs');
const { requestedEngine, openTestStore } = await import('./support/engine.mjs');
const { createPlatformDb } = await import('../platform/db.js');
const { ensureBillingSchema } = await import('../platform/billingSchema.js');
const { ensureAuthDeliverySchema, drainAuthDeliveryOutbox, createResendAuthEmailTransport } = await import('../platform/authDelivery.js');
const { asStore, createPostgresStore, databaseOverload } = await import('../platform/store.js');
const { metrics } = await import('../platform/metrics.js');
const { setLogSink } = await import('../platform/observability.js');

const engine = requestedEngine();
const c = checks();
const logLines = [];
const previousSink = setLogSink((level, line) => logLines.push(line));
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const cleanups = [];

// ── Stores: one engine-agnostic way to open, fault and reopen a database ────

/** A TCP relay in front of Postgres that can be cut and restored on the same port. */
async function tcpRelay(targetHost, targetPort) {
  const sockets = new Set();
  let server = null;
  let port = 0;
  const listen = () => new Promise((resolve, reject) => {
    server = createTcpServer(client => {
      const upstream = connect(targetPort, targetHost);
      sockets.add(client); sockets.add(upstream);
      const drop = () => { client.destroy(); upstream.destroy(); sockets.delete(client); sockets.delete(upstream); };
      client.on('error', drop); upstream.on('error', drop);
      client.on('close', drop); upstream.on('close', drop);
      client.pipe(upstream); upstream.pipe(client);
    });
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => { port = server.address().port; resolve(); });
  });
  await listen();
  return {
    get port() { return port; },
    async cut() {
      await new Promise(resolve => { server.close(() => resolve()); for (const socket of sockets) socket.destroy(); sockets.clear(); });
    },
    async restore() { await listen(); },
    async close() { try { await this.cut(); } catch { /* already cut */ } }
  };
}

/**
 * A store whose get/all/run/exec/transaction can be made to fail the way a
 * refused connection fails, or to die between its work and its commit.
 */
function faultable(store) {
  // mode: null | 'down' | 'hang' | 'crash-before-commit'; failWhen(sql) faults
  // only the statements it matches (once, when failOnce is set).
  const state = { mode: null, failWhen: null, failOnce: false, failed: 0 };
  const refused = () => databaseOverload(Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), { code: 'ECONNREFUSED' }));
  const proxy = new Proxy(store, {
    get(target, prop) {
      const value = Reflect.get(target, prop, target);
      if (typeof value !== 'function') return value;
      if (state.mode === 'down' && ['get', 'all', 'run', 'exec', 'transaction'].includes(prop)) return async () => { throw refused(); };
      // A silent partition: packets dropped, no reset, the statement never returns.
      if (state.mode === 'hang' && ['get', 'all'].includes(prop)) return () => new Promise(() => {});
      if (state.failWhen && ['get', 'all', 'run'].includes(prop)) {
        return async (sql, params) => {
          if (state.failWhen(String(sql)) && !(state.failOnce && state.failed > 0)) {
            state.failed += 1;
            throw refused();
          }
          return value.call(target, sql, params);
        };
      }
      if (state.mode === 'crash-before-commit' && prop === 'transaction') {
        return (fn, options) => target.transaction(async tx => {
          await fn(tx);
          // The process dies here: the work is done, COMMIT never runs.
          throw Object.assign(new Error('process killed before COMMIT'), { code: 'SIMULATED_CRASH' });
        }, options);
      }
      return value.bind(target);
    }
  });
  return { store: proxy, state };
}

async function openDrillDatabase(label) {
  if (engine === 'postgres') {
    const scratchDb = await openTestStore('postgres', { label });
    const url = new URL(scratchDb.url);
    const relay = await tcpRelay(url.hostname === 'localhost' ? '127.0.0.1' : url.hostname, Number(url.port || 5432));
    const relayed = new URL(scratchDb.url);
    relayed.hostname = '127.0.0.1';
    relayed.port = String(relay.port);
    // The scratch store connects directly; the server's own store goes through the relay.
    const open = () => createPostgresStore(relayed.toString(), { max: 4 });
    let current = await open();
    return {
      relay,
      store: () => current,
      async reopen() { await current.close(); current = await open(); return current; },
      async close() { await current.close().catch(() => {}); await relay.close(); await scratchDb.close(); }
    };
  }
  const file = join(scratch, `${label}.db`);
  const open = () => {
    const raw = createPlatformDb(file);
    ensureAuthDeliverySchema(raw);
    ensureBillingSchema(raw);
    return { raw, store: asStore(raw) };
  };
  let current = open();
  return {
    relay: null,
    store: () => current.store,
    async reopen() { current.raw.close(); current = open(); return current.store; },
    async close() { if (current.raw.open) current.raw.close(); }
  };
}

async function verifiedStudent(app, email, deviceId = 'ipad-drill') {
  const student = await registerAccount(app, { email, deviceId });
  if (student.status !== 201) throw new Error(`registration failed: ${student.status} ${student.text}`);
  await app.db.run('UPDATE accounts SET email_verified_at=? WHERE id=?', [Date.now(), student.account.id]);
  return student;
}

const counter = key => metrics.snapshot().counters[key]?.total || 0;

try {
  // ── Drill 1 · database unavailable at runtime ────────────────────────────
  {
    const database = await openDrillDatabase('drill_db_outage');
    cleanups.push(() => database.close());
    const fault = faultable(database.store());
    // On Postgres the outage is the relay; the fault proxy stays transparent.
    const app = await startApp({ db: engine === 'postgres' ? database.store() : fault.store });
    cleanups.push(() => app.close());
    const student = await verifiedStudent(app, 'outage.student@example.test');
    const outageStart = counter('db_errors_total{code=PLATFORM_DB_UNAVAILABLE}');

    c.eq((await app.request('/v1/ready')).status, 200, 'drill 1: ready before the outage');

    if (engine === 'postgres') await database.relay.cut();
    else fault.state.mode = 'down';

    const ready = await app.request('/v1/ready');
    c.eq(ready.status, 503, 'drill 1: /v1/ready is 503 while the database is unreachable');
    c.eq(ready.data.checks.database.state, 'unavailable', 'drill 1: the database check says unavailable');
    c.ok(['PLATFORM_DB_UNAVAILABLE', 'PLATFORM_DB_TIMEOUT', 'PLATFORM_DB_BUSY'].includes(ready.data.checks.database.code), `drill 1: coded (${ready.data.checks.database.code})`);
    c.eq(ready.headers.get('retry-after'), '5', 'drill 1: readiness says when to look again');

    const live = await app.request('/v1/health');
    c.eq(live.status, 200, 'drill 1: liveness stays 200 — the process is fine, so nothing restarts it in a loop');
    c.eq(live.data.database.reachable, false, 'drill 1: and reports the database unreachable');

    const me = await app.request('/v1/account/me', { jar: student.jar, headers: { 'X-Request-Id': 'drill-outage-me' } });
    c.eq(me.status, 503, 'drill 1: an authenticated read is a 503, not a 500');
    c.eq(me.data.error.code, 'PLATFORM_DB_UNAVAILABLE', 'drill 1: coded PLATFORM_DB_UNAVAILABLE');
    c.eq(me.data.error.retryable, true, 'drill 1: marked retryable');
    c.eq(me.headers.get('retry-after'), '5', 'drill 1: with Retry-After');
    c.eq(me.data.requestId, 'drill-outage-me', 'drill 1: the error body carries the request id');

    const push = await app.request('/v1/sync/push', {
      method: 'POST', jar: student.jar, headers: { 'Idempotency-Key': 'drill-outage-push' },
      body: { schemaVersion: 1, deviceId: 'ipad-drill', events: [{ id: 'outage-evt-1', deviceId: 'ipad-drill', deviceSeq: 1, kind: 'practice-attempt', payload: { n: 1 } }] }
    });
    c.eq(push.status, 503, 'drill 1: a sync push during the outage is a retryable 503 — not a guardian-consent 403 the device would give up on');
    c.eq(push.data.error.code, 'PLATFORM_DB_UNAVAILABLE', 'drill 1: coded PLATFORM_DB_UNAVAILABLE');

    for (let i = 0; i < 2; i++) await app.request('/v1/account/me', { jar: student.jar });
    c.ok(counter('db_errors_total{code=PLATFORM_DB_UNAVAILABLE}') - outageStart >= 3, 'drill 1: the outage is counted');
    c.ok(metrics.snapshot().firing.includes('DB_CONNECTIVITY'), 'drill 1: and fires DB_CONNECTIVITY');
    const outageLines = logLines.filter(line => line.includes('"PLATFORM_DB_UNAVAILABLE"'));
    c.ok(outageLines.length > 0 && outageLines.every(line => !line.includes('5432') && !line.includes('postgres://')), 'drill 1: logged by code, never by host, port or URL');

    if (engine === 'postgres') await database.relay.restore();
    else fault.state.mode = null;

    let recovered = null;
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      recovered = await app.request('/v1/ready');
      if (recovered.status === 200) break;
      await wait(200);
    }
    c.eq(recovered.status, 200, 'drill 1: ready again once the database is back, with no restart');
    const meAgain = await app.request('/v1/account/me', { jar: student.jar });
    c.eq(meAgain.status, 200, 'drill 1: the same session works again');
    const pushAgain = await app.request('/v1/sync/push', {
      method: 'POST', jar: student.jar, headers: { 'Idempotency-Key': 'drill-outage-push' },
      body: { schemaVersion: 1, deviceId: 'ipad-drill', events: [{ id: 'outage-evt-1', deviceId: 'ipad-drill', deviceSeq: 1, kind: 'practice-attempt', payload: { n: 1 } }] }
    });
    c.eq(pushAgain.status, 200, 'drill 1: the refused push, resent under its key, is accepted');
    c.eq((await app.db.get('SELECT COUNT(*) AS n FROM learning_events WHERE account_id=?', [student.account.id])).n, 1, 'drill 1: and stored once');
  }

  // ── Drill 2 · provider timeout, 5xx, 429 and malformed answers ───────────
  {
    let mode = 'ok';
    const fake = createHttpServer((req, res) => {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        if (mode === 'hang') return; // never answers: the server's own timeout must fire
        if (mode === '500') { res.writeHead(500); return res.end('{}'); }
        if (mode === '429') { res.writeHead(429, { 'Retry-After': '1' }); return res.end('{}'); }
        if (mode === 'malformed') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ output_text: 'not json {' })); }
        const working = body.includes('pri_working_check');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          output_text: JSON.stringify(working
            ? { lines: [{ index: 0, status: 'ok', carried: false, why: '' }], first_break: -1, hint: '', confidence: 0.9 }
            : { lines: [{ text: 'x = 4', confidence: 0.95 }], confidence: 0.95, needs_confirmation: false })
        }));
      });
    });
    await new Promise(resolve => fake.listen(0, '127.0.0.1', resolve));
    cleanups.push(() => new Promise(resolve => { fake.closeAllConnections?.(); fake.close(resolve); }));
    const endpoint = `http://127.0.0.1:${fake.address().port}/v1/responses`;
    Object.assign(process.env, {
      PRI_HANDWRITING_API_KEY: 'drill-provider-key-not-real',
      PRI_HANDWRITING_ENDPOINT: endpoint,
      PRI_WORKING_ENDPOINT: endpoint,
      PRI_PAID_CALLS_PER_HOUR: '1000',
      PRI_PAID_CALLS_PER_DAY: '10000',
      PRI_HANDWRITING_TIMEOUT_MS: '2000',
      PRI_WORKING_TIMEOUT_MS: '2000'
    });
    const database = await openDrillDatabase('drill_provider');
    cleanups.push(() => database.close());
    const app = await startApp({ db: database.store() });
    cleanups.push(() => app.close());
    const reader = await verifiedStudent(app, 'provider.student@example.test');
    const read = () => app.request('/v1/handwriting/transcribe', { method: 'POST', jar: reader.jar, body: { image: PNG } });
    const check = () => app.request('/v1/working/check', { method: 'POST', jar: reader.jar, body: { prompt: 'Solve 2x = 8', lines: ['2x = 8', 'x = 4'] } });

    const cases = [
      ['500', 503, 'HANDWRITING_PROVIDER_5XX', 503, 'WORKING_UNAVAILABLE'],
      ['429', 503, 'HANDWRITING_PROVIDER_429', 503, 'WORKING_UNAVAILABLE'],
      ['malformed', 502, 'HANDWRITING_MALFORMED', 502, 'WORKING_MALFORMED'],
      ['hang', 504, 'HANDWRITING_TIMEOUT', 504, 'WORKING_TIMEOUT']
    ];
    for (const [label, hwStatus, hwCode, wkStatus, wkCode] of cases) {
      mode = label;
      const started = Date.now();
      const failedRead = await read();
      c.eq(failedRead.status, hwStatus, `drill 2: provider ${label} → handwriting ${hwStatus}`);
      c.eq(failedRead.data?.error?.code, hwCode, `drill 2: provider ${label} → ${hwCode}`);
      c.eq(failedRead.data?.error?.retryable, true, `drill 2: provider ${label} is retryable for handwriting`);
      if (label === 'hang') c.ok(Date.now() - started < 9_000, `drill 2: a hung provider is cut off by the timeout (${Date.now() - started} ms)`);
      const failedCheck = await check();
      c.eq(failedCheck.status, wkStatus, `drill 2: provider ${label} → working ${wkStatus}`);
      c.eq(failedCheck.data?.error?.code, wkCode, `drill 2: provider ${label} → ${wkCode}`);
      c.eq(failedCheck.data?.error?.retryable, true, `drill 2: provider ${label} is retryable for working`);
    }
    c.ok(counter('provider_failures_total{code=HANDWRITING_PROVIDER_429,provider=handwriting}') >= 1, 'drill 2: a 429 is counted by code');
    c.ok(counter('provider_failures_total{code=HANDWRITING_TIMEOUT,provider=handwriting}') >= 1, 'drill 2: a timeout is counted by code');
    c.ok((metrics.snapshot().latency['provider_latency_ms{provider=handwriting}']?.count || 0) >= 4, 'drill 2: provider latency is recorded');

    mode = 'ok';
    const recoveredRead = await read();
    c.eq(recoveredRead.status, 200, 'drill 2: handwriting recovers as soon as the provider does');
    c.eq(recoveredRead.data.transcription.text, 'x = 4', 'drill 2: with the provider\'s transcription');
    const recoveredCheck = await check();
    c.eq(recoveredCheck.status, 200, 'drill 2: working recovers as soon as the provider does');
    const failures = logLines.filter(line => line.includes('"provider_call_failed"'));
    c.ok(failures.length >= 8 && failures.every(line => !line.includes('base64') && !line.includes('drill-provider-key')), 'drill 2: every failure is logged by code, without the image or the key');
    for (const name of ['PRI_HANDWRITING_API_KEY', 'PRI_HANDWRITING_ENDPOINT', 'PRI_WORKING_ENDPOINT', 'PRI_PAID_CALLS_PER_HOUR', 'PRI_PAID_CALLS_PER_DAY', 'PRI_HANDWRITING_TIMEOUT_MS', 'PRI_WORKING_TIMEOUT_MS']) delete process.env[name];
  }

  // ── Drill 3 · email provider failure ─────────────────────────────────────
  {
    const database = await openDrillDatabase('drill_email');
    cleanups.push(() => database.close());
    const app = await startApp({ db: database.store() });
    cleanups.push(() => app.close());
    const student = await registerAccount(app, { email: 'email.drill@example.test', password: 'correct-horse-battery' });
    c.eq(student.status, 201, 'drill 3: registration succeeds while email is down — delivery is queued, not inline');
    const accountId = student.account.id;
    const before = await app.db.get('SELECT email_verified_at, password_hash, role FROM accounts WHERE id=?', [accountId]);

    let providerUp = false;
    const sent = [];
    let calls = 0;
    const transport = createResendAuthEmailTransport({
      apiKey: 'drill-resend-key-not-real',
      from: 'Pri <noreply@pri.example>',
      fetchImpl: async (url, init) => {
        calls++;
        if (!providerUp) return { ok: false, status: 503, text: async () => '{"message":"unavailable"}' };
        const body = JSON.parse(init.body);
        sent.push(body);
        return { ok: true, status: 200, text: async () => JSON.stringify({ id: `msg_${sent.length}` }) };
      }
    });
    const outbox = () => app.db.get("SELECT attempt_count, delivered_at, next_attempt_at, last_error_code FROM auth_delivery_outbox WHERE account_id=? AND kind='verify-email' ORDER BY created_at DESC", [accountId]);

    let now = Date.now();
    await drainAuthDeliveryOutbox(app.db, { send: transport, publicOrigin: 'http://localhost:5173', now });
    let row = await outbox();
    c.eq(row.attempt_count, 1, 'drill 3: one attempt was made');
    c.eq(row.delivered_at, null, 'drill 3: nothing is marked delivered');
    c.eq(row.last_error_code, 'RESEND_503', 'drill 3: the failure is recorded by code');
    c.ok(row.next_attempt_at > now, 'drill 3: the retry is scheduled with backoff');
    await drainAuthDeliveryOutbox(app.db, { send: transport, publicOrigin: 'http://localhost:5173', now });
    c.eq((await outbox()).attempt_count, 1, 'drill 3: a drain before the backoff elapses sends nothing');

    // Keep failing past every scheduled retry and past the token's hour.
    let maxAttempts = 1;
    for (let i = 0; i < 20; i++) {
      now += 16 * 60_000;
      await drainAuthDeliveryOutbox(app.db, { send: transport, publicOrigin: 'http://localhost:5173', now });
      row = await outbox();
      if (row) maxAttempts = Math.max(maxAttempts, Number(row.attempt_count));
    }
    c.ok(maxAttempts <= 8 && calls <= 8, `drill 3: retries are bounded (${maxAttempts} attempts, ${calls} provider calls)`);
    c.eq(row ?? null, null, 'drill 3: once the link has expired the envelope is purged rather than retried forever');
    const after = await app.db.get('SELECT email_verified_at, password_hash, role FROM accounts WHERE id=?', [accountId]);
    c.deq(after, before, 'drill 3: the account is exactly as it was — not verified, same credential, same role');
    const login = await app.request('/v1/account/login', { method: 'POST', jar: {}, body: { email: 'email.drill@example.test', password: 'correct-horse-battery', deviceId: 'ipad-drill-2' } });
    c.eq(login.status, 200, 'drill 3: the student can still sign in');
    c.ok(counter('auth_email_failures_total{code=RESEND_503}') >= 2, 'drill 3: failures are counted');
    c.ok(logLines.some(line => line.includes('"auth_email_failed"') && line.includes('RESEND_503')) && !logLines.some(line => line.includes('email.drill@example.test')), 'drill 3: logged by code, never by address');

    providerUp = true;
    const request = await app.request('/v1/account/email/verification-request', { method: 'POST', jar: student.jar, body: {} });
    c.ok([200, 202].includes(request.status), `drill 3: the student asks again once the provider is back (${request.status})`);
    const delivered = await drainAuthDeliveryOutbox(app.db, { send: transport, publicOrigin: 'http://localhost:5173' });
    c.eq(delivered.sent, 1, 'drill 3: the new email is delivered');
    const link = /#action=verify-email&token=([^\s"<]+)/.exec(sent[0].text);
    c.ok(link, 'drill 3: it carries a verification link');
    const verified = await app.request('/v1/account/email/verify', { method: 'POST', body: { token: decodeURIComponent(link[1]) } });
    c.eq(verified.status, 200, 'drill 3: and the link verifies the account');
  }

  // ── Drill 4 · process restart mid-request ────────────────────────────────
  {
    const database = await openDrillDatabase('drill_restart');
    cleanups.push(() => database.close());
    const fault = faultable(database.store());
    let app = await startApp({ db: fault.store });
    const student = await verifiedStudent(app, 'restart.student@example.test', 'ipad-restart');
    const accountId = student.account.id;
    const push = (target, key, events) => target.request('/v1/sync/push', {
      method: 'POST', jar: student.jar, headers: { 'Idempotency-Key': key },
      body: { schemaVersion: 1, deviceId: 'ipad-restart', events }
    });
    const event = (id, seq) => ({ id, deviceId: 'ipad-restart', deviceSeq: seq, kind: 'practice-attempt', payload: { seq } });
    const stored = async () => Number((await database.store().get('SELECT COUNT(*) AS n FROM learning_events WHERE account_id=?', [accountId])).n);

    // 4a · The process dies after doing the work and before COMMIT.
    fault.state.mode = 'crash-before-commit';
    const died = await push(app, 'restart-batch-1', [event('restart-evt-1', 1), event('restart-evt-2', 2)]);
    fault.state.mode = null;
    c.ok(died.status >= 500, `drill 4a: the dying request did not succeed (${died.status})`);
    c.eq(await stored(), 0, 'drill 4a: nothing from the uncommitted push survived');
    c.eq(Number((await database.store().get("SELECT COUNT(*) AS n FROM idempotency_keys WHERE account_id=? AND key='restart-batch-1'", [accountId])).n), 0,
      'drill 4a: and its idempotency key was not recorded, so a replay is not mistaken for a duplicate');

    await app.close();
    await database.reopen();
    app = await startApp({ db: database.store() });
    const replayed = await push(app, 'restart-batch-1', [event('restart-evt-1', 1), event('restart-evt-2', 2)]);
    c.eq(replayed.status, 200, 'drill 4a: the device\'s replay to the restarted server is accepted');
    c.eq(await stored(), 2, 'drill 4a: and applied exactly once');

    // 4b · The push commits, then the process restarts before the device hears back.
    const committed = await push(app, 'restart-batch-2', [event('restart-evt-3', 3)]);
    c.eq(committed.status, 200, 'drill 4b: the push commits');
    await app.close();
    await database.reopen();
    app = await startApp({ db: database.store() });
    const lostResponseReplay = await push(app, 'restart-batch-2', [event('restart-evt-3', 3)]);
    c.eq(lostResponseReplay.status, 200, 'drill 4b: the replay after restart is answered');
    c.eq(JSON.stringify(lostResponseReplay.data), JSON.stringify(committed.data), 'drill 4b: with the acknowledgement the device never received');
    c.eq(await stored(), 3, 'drill 4b: nothing was stored twice');
    const pulled = await app.request('/v1/sync/pull/0', { jar: student.jar });
    c.eq(pulled.status, 200, 'drill 4b: the restarted server serves pulls');
    await app.close();
  }

  // ── Drill 5 · partitions and the guardian-consent gate under failure ─────
  {
    const database = await openDrillDatabase('drill_gate');
    cleanups.push(() => database.close());
    const fault = faultable(database.store());
    const app = await startApp({ db: fault.store });
    cleanups.push(() => app.close());

    // A silent partition must not outlast the container's 5 s HEALTHCHECK.
    fault.state.mode = 'hang';
    let started = Date.now();
    const hungHealth = await app.request('/v1/health');
    const healthMs = Date.now() - started;
    c.eq(hungHealth.status, 200, 'drill 5: liveness answers through a silent partition');
    c.eq(hungHealth.data.database.reachable, false, 'drill 5: and reports the database unreachable');
    c.ok(healthMs < 3_000, `drill 5: within its own bound, well inside the 5 s healthcheck (${healthMs} ms)`);
    started = Date.now();
    const hungReady = await app.request('/v1/ready');
    c.eq(hungReady.status, 503, 'drill 5: readiness is 503 through a silent partition');
    c.eq(hungReady.data.checks.database.code, 'PLATFORM_DB_TIMEOUT', 'drill 5: coded PLATFORM_DB_TIMEOUT');
    c.ok(Date.now() - started < 3_500, `drill 5: and answers within its bound (${Date.now() - started} ms)`);
    fault.state.mode = null;

    const minorJar = {};
    const minor = await app.request('/v1/account/register', {
      method: 'POST', jar: minorJar,
      body: { name: 'Gate Student', email: 'gate.minor@example.test', password: 'gate-password-123', deviceId: 'ipad-gate', isAdult: false, year: '9', guardianName: 'Gate Guardian', guardianEmail: 'gate.guardian@example.test' }
    });
    c.eq(minor.status, 201, 'drill 5: a student under the age of consent registers');
    await app.db.run('UPDATE accounts SET email_verified_at=? WHERE id=?', [Date.now(), minor.data.account.id]);
    const gatePush = key => app.request('/v1/sync/push', {
      method: 'POST', jar: minorJar, headers: { 'Idempotency-Key': key },
      body: { schemaVersion: 1, deviceId: 'ipad-gate', events: [{ id: `gate-${key}`, deviceId: 'ipad-gate', deviceSeq: 1, kind: 'practice-attempt', payload: { n: 1 } }] }
    });
    const minorEvents = async () => Number((await database.store().get('SELECT COUNT(*) AS n FROM learning_events WHERE account_id=?', [minor.data.account.id])).n);

    const pending = await gatePush('gate-1');
    c.eq(pending.status, 403, 'drill 5: with the database up, missing guardian consent is a 403');
    c.eq(pending.data.error.code, 'GUARDIAN_CONSENT_PENDING', 'drill 5: coded GUARDIAN_CONSENT_PENDING');

    // The consent query alone fails: an outage, not a refusal.
    fault.state.failWhen = sql => /guardian_consents/.test(sql);
    const consentDown = await gatePush('gate-2');
    fault.state.failWhen = null;
    c.eq(consentDown.status, 503, 'drill 5: a failed consent read is a retryable 503, not a 403 the device gives up on');
    c.eq(consentDown.data.error.code, 'PLATFORM_DB_UNAVAILABLE', 'drill 5: coded PLATFORM_DB_UNAVAILABLE');

    // Only the gate's own session lookup fails (the first one in the request).
    // It used to be swallowed as "no session", the sub-router's lookup then
    // succeeded, and a child's sync ran with the consent gate skipped.
    fault.state.failed = 0;
    fault.state.failOnce = true;
    fault.state.failWhen = sql => /FROM account_sessions/.test(sql);
    const sessionDown = await gatePush('gate-3');
    fault.state.failWhen = null;
    fault.state.failOnce = false;
    c.eq(sessionDown.status, 503, 'drill 5: a failed session lookup in the consent gate is a 503 — never a pass-through');
    c.eq(sessionDown.data.error.code, 'PLATFORM_DB_UNAVAILABLE', 'drill 5: coded PLATFORM_DB_UNAVAILABLE');
    c.eq(await minorEvents(), 0, 'drill 5: and nothing from the unconsented account was stored');
  }
} finally {
  for (const cleanup of cleanups.reverse()) {
    try { await cleanup(); } catch { /* already closed */ }
  }
  setLogSink(previousSink);
  rmSync(scratch, { recursive: true, force: true });
  for (const name of names) {
    if (prior[name] === undefined) delete process.env[name];
    else process.env[name] = prior[name];
  }
}

console.log(`engine: ${engine}`);
console.log(`FAILURE DRILLS: PASS — ${c.count()}/${c.count()} checks — database outage answers coded 503s and recovers without a restart, provider timeout/5xx/429/malformed are retryable codes, email failure retries are bounded and leave accounts untouched, a push interrupted by a restart is applied exactly once, partitions are bounded and the consent gate fails closed on ${engine}.`);
