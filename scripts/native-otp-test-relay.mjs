#!/usr/bin/env node
// CI fixture ONLY, never imported by a production application. Run by
// cloud-fixture-server.mjs with NODE_ENV=development and a random bearer token.
// It uses the normal six-digit OTP delivery adapter INSIDE the real backend
// process, and exposes the resulting test email to authorised native tests on
// loopback. The client gets no shortcut or privileged API.
import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { readTestOutbox } from '../server/platform/smsProvider.js';

const token = String(process.env.PRI_NATIVE_OTP_RELAY_TOKEN || '');
const port = Number(process.env.PRI_NATIVE_OTP_RELAY_PORT || 4312);
if (process.env.NODE_ENV !== 'development' || process.env.PRI_NATIVE_OTP_TEST_RELAY_ENABLED !== '1' ||
    !/^[A-Za-z0-9_-]{24,}$/.test(token) || !Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error('Native OTP test relay is strictly restricted to an authenticated development test fixture.');
}

const response = (res, status, data) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
};
const relay = createServer((req, res) => {
  const received = String(req.headers['x-pri-native-test-token'] || '');
  const ok = received.length === token.length &&
    timingSafeEqual(Buffer.from(received), Buffer.from(token));
  if (!ok) return response(res, 404, { error: 'not-found' });
  if (req.method !== 'GET') return response(res, 405, { error: 'method-not-allowed' });
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  if (url.pathname !== '/otp' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(url.searchParams.get('to') || '')) {
    return response(res, 404, { error: 'not-found' });
  }
  const email = url.searchParams.get('to');
  const sent = readTestOutbox({ to: email, channel: 'email' })
    .filter(x => x.purpose === 'sign-in').at(-1);
  // This is an explicitly named synthetic email adapter result. No codes are
  // logged, placed in the app bundle or returned from production endpoints.
  return response(res, sent ? 200 : 404, sent ? { code: sent.code } : { error: 'not-ready' });
});
relay.listen(port, '127.0.0.1');
await import('../server/index.js');
