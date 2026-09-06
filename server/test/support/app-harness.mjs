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
import { createServerApp } from '../../app.js';
import { createPlatformDb } from '../../platform/db.js';
import { decryptDeliveryToken } from '../../platform/deliveryCrypto.js';

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
  db = createPlatformDb(':memory:'),
  production = process.env.NODE_ENV === 'production',
  dist = null,
  legacy = false,
  log = null
} = {}) {
  const app = await createServerApp(db, { production, dist, legacy, requestLog: typeof log === 'function', log: log || undefined });
  const server = await new Promise((resolve, reject) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    listener.once('error', reject);
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
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
    const response = await fetch(`${origin}${path}`, {
      method,
      headers: sendHeaders,
      body: rawBody !== undefined ? rawBody : (body === undefined ? undefined : JSON.stringify(body)),
      redirect: 'manual'
    });
    absorbCookies(response, jar);
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    return { status: response.status, data, text, headers: response.headers };
  }

  async function close() {
    await new Promise(resolve => {
      server.closeAllConnections?.();
      server.close(resolve);
    });
  }

  return { app, db, server, origin, request, close };
}

export async function registerAccount(harness, {
  name = 'Test Student',
  email,
  password = 'correct-horse-battery',
  deviceId = 'ipad-test',
  teacherInviteCode
} = {}) {
  const jar = {};
  const body = { name, email, password, deviceId };
  if (teacherInviteCode !== undefined) body.teacherInviteCode = teacherInviteCode;
  const response = await harness.request('/v1/account/register', { method: 'POST', jar, body });
  return { ...response, jar, account: response.data?.account || null };
}

export function pendingVerificationToken(db, accountId) {
  const row = db.prepare(`SELECT token_id, token_ciphertext FROM auth_delivery_outbox
    WHERE account_id=? AND kind='verify-email' AND delivered_at IS NULL ORDER BY created_at DESC`).get(accountId);
  if (!row) return null;
  return decryptDeliveryToken(row.token_ciphertext, `${accountId}:verify-email:${row.token_id}`);
}

export async function verifyEmail(harness, accountId) {
  const token = pendingVerificationToken(harness.db, accountId);
  if (!token) throw new Error(`no pending verification token for ${accountId}`);
  return harness.request('/v1/account/email/verify', { method: 'POST', body: { token } });
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
