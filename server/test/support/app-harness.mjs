// Shared harness for HTTP-level server contracts.
//
// Every test that imports this drives the exact production middleware chain
// (server/app.js -> /v1 platform router) in-process against its own SQLite
// database, over a real loopback socket, with a cookie jar that mirrors what a
// browser or the native URLSession jar would hold. Nothing here stubs a route.
//
// Import it with a dynamic import AFTER setting any process.env the test needs:
// server/platform/db.js resolves the platform database path at module load.

import assert from 'node:assert/strict';
import http from 'node:http';
import { createServerApp } from '../../app.js';
import { createPlatformDb } from '../../platform/db.js';
import { decryptDeliveryToken } from '../../platform/deliveryCrypto.js';
import { asStore } from '../../platform/store.js';
import { base32Decode, totp } from '../../platform/mfa.js';
import { openTestStore } from './engine.mjs';

export function cookieHeader(jar) {
  return Object.entries(jar).filter(([, value]) => value !== '').map(([name, value]) => `${name}=${value}`).join('; ');
}

export function absorbCookies(response, jar) {
  const values = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean);
  for (const raw of values) {
    const first = String(raw).split(';', 1)[0];
    const index = first.indexOf('=');
    if (index <= 0) continue;
    jar[first.slice(0, index)] = first.slice(index + 1);
  }
}

export async function startApp({
  db,
  // 'sqlite' | 'postgres': run on a store from support/engine.mjs instead of a
  // bare SQLite handle. h.db is then the async store (get/all/run), and
  // h.adminExec runs privileged SQL (DDL) as the database owner.
  engine = null,
  production = process.env.NODE_ENV === 'production',
  dist = null,
  legacy = false,
  log = null,
  // { transport, publicOrigin } for the parent report router (parentReport.js).
  parentReport
} = {}) {
  let testStore = null;
  if (!db && engine) {
    testStore = await openTestStore(engine, { label: 'app' });
    db = testStore.store;
  }
  if (!db) db = createPlatformDb(':memory:');
  const app = await createServerApp(db, { production, dist, legacy, requestLog: typeof log === 'function', log: log || undefined, parentReport });
  const server = await new Promise((resolve, reject) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    listener.once('error', reject);
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  // One keep-alive connection pool per harness, over node:http rather than the
  // global fetch dispatcher. Global fetch (undici 7) stops reusing connections
  // for the rest of the process after a DELETE that carries a body, so a long
  // suite (abuse-limits: ~2,800 requests) opened a fresh loopback socket per
  // request; with thousands of sockets in TIME_WAIT macOS intermittently
  // stalled a loopback SYN and undici gave up with connect ETIMEDOUT — in that
  // suite and in every other suite running beside it. Requests here reuse a
  // bounded pool for the harness's lifetime, whatever methods they use.
  // No socket cap: burst suites (platform-sync-burst: 150 pushes at once) must
  // reach the server with their full concurrency; pooling alone ends the churn.
  const agent = new http.Agent({ keepAlive: true, maxSockets: Infinity });
  // Connects resent below, so suites can report them instead of hiding them.
  let connectRetries = 0;
  const { port } = server.address();

  // This host's loopback occasionally refuses or times out a connect for a
  // moment machine-wide (measured with bare net.connect, no app involved: every
  // process stalls at the same instant). A connect that failed sent no bytes,
  // so the request never reached the app and resending it is exactly what any
  // client does; it proves nothing either way about the server. Anything that
  // fails after the socket connected is reported as-is.
  async function send(method, path, headers, payload) {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await sendOnce(method, path, headers, payload);
      } catch (error) {
        const connectFailure = error?.syscall === 'connect' && ['ETIMEDOUT', 'ECONNREFUSED', 'ECONNRESET'].includes(error.code);
        if (!connectFailure || attempt >= 8) throw error;
        connectRetries += 1;
        await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
      }
    }
  }

  function sendOnce(method, path, headers, payload) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const outgoing = { ...headers };
      if (payload !== undefined) {
        if (!Buffer.isBuffer(payload) && typeof payload !== 'string') throw new TypeError('app harness bodies are strings or Buffers');
        payload = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
        outgoing['Content-Length'] = String(payload.length);
      }
      const req = http.request({ host: '127.0.0.1', port, method, path, headers: outgoing, agent }, res => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('error', error => { if (!settled) { settled = true; reject(error); } });
        res.on('end', () => {
          if (settled) return;
          settled = true;
          const responseHeaders = new Headers();
          for (let i = 0; i < res.rawHeaders.length; i += 2) responseHeaders.append(res.rawHeaders[i], res.rawHeaders[i + 1]);
          const bytes = Buffer.concat(chunks);
          resolve({ status: res.statusCode, headers: responseHeaders, text: async () => bytes.toString('utf8') });
        });
      });
      // A server may answer (413, 400) and close before an oversized body is
      // fully written; the answer that already arrived is the result.
      req.on('error', error => { if (!settled) { settled = true; reject(error); } });
      if (payload !== undefined) req.end(payload); else req.end();
    });
  }
  const browserOrigin = production ? String(process.env.PRI_PUBLIC_ORIGIN || '').trim() : '';

  async function request(path, { method = 'GET', body, rawBody, jar = {}, headers = {} } = {}) {
    const sendHeaders = { Accept: 'application/json', ...headers };
    const lower = Object.fromEntries(Object.keys(sendHeaders).map(name => [name.toLowerCase(), name]));
    const cookies = cookieHeader(jar);
    if (cookies) sendHeaders.Cookie = cookies;
    if ((body !== undefined || rawBody !== undefined) && !lower['content-type']) sendHeaders['Content-Type'] = 'application/json';
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      // Browser double-submit CSRF pair and the configured product Origin, the
      // way the shipped client sends them.
      if (jar.pri_csrf && !lower['x-pri-csrf']) sendHeaders['x-pri-csrf'] = jar.pri_csrf;
      if (browserOrigin && !lower.origin) sendHeaders.Origin = browserOrigin;
    }
    let payload = rawBody !== undefined ? rawBody : (body === undefined ? undefined : JSON.stringify(body));
    if (payload instanceof URLSearchParams) {
      if (!lower['content-type']) sendHeaders['Content-Type'] = 'application/x-www-form-urlencoded;charset=UTF-8';
      payload = payload.toString();
    }
    // The same URL normalisation fetch applies (percent-encoding, dot segments).
    const target = new URL(`${origin}${path}`);
    const response = await send(method, `${target.pathname}${target.search}`, sendHeaders, payload);
    absorbCookies(response, jar);
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    return { status: response.status, data, text, headers: response.headers };
  }

  async function close() {
    await new Promise(resolve => {
      agent.destroy();
      server.closeAllConnections?.();
      server.close(resolve);
    });
    if (testStore) await testStore.close();
  }

  async function adminExec(sql) {
    if (testStore?.scratch) return testStore.scratch.client.query(sql);
    const raw = testStore?.raw || db;
    return raw.exec(sql);
  }

  // url: the pri_server-member connection URL on Postgres (null on SQLite).
  return { app, db, server, origin, request, close, adminExec, engine: testStore?.engine || 'sqlite', url: testStore?.url || null, get connectRetries() { return connectRetries; } };
}

export async function registerAccount(harness, {
  name = 'Test Student',
  email,
  password = 'correct-horse-battery',
  deviceId = 'ipad-test',
  teacherInviteCode
} = {}) {
  const jar = {};
  const body = { name, email, password, deviceId, isAdult: true };
  if (teacherInviteCode !== undefined) body.teacherInviteCode = teacherInviteCode;
  const response = await harness.request('/v1/account/register', { method: 'POST', jar, body });
  return { ...response, jar, account: response.data?.account || null };
}

export async function pendingVerificationToken(db, accountId) {
  const row = await asStore(db).get(`SELECT token_id, token_ciphertext FROM auth_delivery_outbox
    WHERE account_id=? AND kind='verify-email' AND delivered_at IS NULL ORDER BY created_at DESC`, [accountId]);
  if (!row) return null;
  return decryptDeliveryToken(row.token_ciphertext, `${accountId}:verify-email:${row.token_id}`);
}

export async function verifyEmail(harness, accountId) {
  const token = await pendingVerificationToken(harness.db, accountId);
  if (!token) throw new Error(`no pending verification token for ${accountId}`);
  return harness.request('/v1/account/email/verify', { method: 'POST', body: { token } });
}

/**
 * Enrol and verify a staff account's second factor the way the admin UI does:
 * enrol → code from the returned secret → confirm. Returns the secret and the
 * recovery codes so a suite can present later codes or a recovery code.
 */
export async function enrolMfa(harness, jar, { now = Date.now() } = {}) {
  const enrol = await harness.request('/v1/account/mfa/totp/enrol', { method: 'POST', jar, body: {} });
  if (enrol.status !== 201) throw new Error(`mfa enrol: ${enrol.status} ${enrol.text}`);
  const secret = base32Decode(enrol.data.secret);
  const confirm = await harness.request('/v1/account/mfa/totp/confirm', { method: 'POST', jar, body: { code: totp(secret, now) } });
  if (confirm.status !== 200) throw new Error(`mfa confirm: ${confirm.status} ${confirm.text}`);
  return { secret, secretBase32: enrol.data.secret, otpauthUri: enrol.data.otpauthUri, recoveryCodes: confirm.data.recoveryCodes };
}

/** Present the current code for `secret` on this session (sign-in or step-up). */
export async function verifyMfa(harness, jar, secret, { now = Date.now() } = {}) {
  return harness.request('/v1/account/mfa/verify', { method: 'POST', jar, body: { code: totp(secret, now) } });
}

/**
 * Give an account a role directly in the database, as the bootstrap/CLI would,
 * and — for admin and support — enrol the second factor every staff route
 * requires. Returns the enrolment (or null for other roles).
 */
export async function promoteRole(harness, jar, accountId, role) {
  await asStore(harness.db).run('UPDATE accounts SET role=? WHERE id=?', [role, accountId]);
  if (role !== 'admin' && role !== 'support') return null;
  return enrolMfa(harness, jar);
}

/** Counted assertions so every suite can print an honest n/n line. */
export function checks() {
  let n = 0;
  return {
    count: () => n,
    ok(condition, message) { assert.ok(condition, message); n++; },
    eq(actual, expected, message) { assert.equal(actual, expected, message); n++; },
    deq(actual, expected, message) { assert.deepEqual(actual, expected, message); n++; },
    match(value, pattern, message) { assert.match(String(value), pattern, message); n++; },
    async rejects(fn, expected, message) { await assert.rejects(fn, expected, message); n++; }
  };
}
