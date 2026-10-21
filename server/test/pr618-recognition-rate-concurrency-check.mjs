#!/usr/bin/env node
// PR #618: HTTP-level concurrency proof of the route CodeQL flagged.
// The invalid synthetic payload is refused before touching a paid provider.
// Every request still consumes the recognition-route limiter.
import './support/hermetic.mjs';
const { startApp, registerAccount, verifyEmail } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');

const h = await startApp({ engine: requestedEngine() });
const path = '/v1/practice/00000000-0000-4000-8000-000000000001/recognize';
const call = jar => h.request(path, { method: 'POST', jar: { ...jar }, body: {} });
let checks = 0;
const assert = (condition, message) => { checks++; if (!condition) throw Error(message); };
try {
  const a = await registerAccount(h, { email: 'pr618.rate.a@example.test', deviceId: 'rate-a' });
  assert(a.status === 201, 'first fixture account created');
  await verifyEmail(h, a.account.id);
  const b = await registerAccount(h, { email: 'pr618.rate.b@example.test', deviceId: 'rate-b' });
  assert(b.status === 201, 'second fixture account created');
  await verifyEmail(h, b.account.id);

  const unauthorized = await call({});
  assert(unauthorized.status === 401, 'unauthenticated recognition rejected before route');

  // 110 serial requests make the bucket near-full. 12 simultaneous callers
  // compete for only 10 remaining units; DB atomicity must refuse exactly 2.
  for (let i = 0; i < 110; i++) {
    const response = await call(a.jar);
    assert(response.status === 400, 'authorized malformed recognition consumes a unit ' + (i + 1));
  }
  const burst = await Promise.all(Array.from({ length: 12 }, () => call(a.jar)));
  const admitted = burst.filter(r => r.status === 400);
  const blocked = burst.filter(r => r.status === 429 && r.data?.error?.code === 'RATE_LIMITED');
  assert(admitted.length === 10, 'exactly ten concurrent requests take the remaining units');
  assert(blocked.length === 2, 'both overflow requests receive coded HTTP 429');
  assert(blocked.every(r => r.headers.get('ratelimit-remaining') === '0' && Number(r.headers.get('retry-after')) > 0),
    'over-cap responses carry RateLimit-Remaining and Retry-After');
  const again = await call(a.jar);
  assert(again.status === 429, 'replay cannot bypass exhausted limit');
  const other = await call(b.jar);
  assert(other.status === 400, 'second account has an independent bucket');
  console.log('engine: ' + h.engine);
  console.log('PR618 RECOGNITION RATE CONCURRENCY: PASS — 110 accepted serial, 10 accepted simultaneous, 2 rejected simultaneous; ' + checks + ' assertions');
} finally {
  await h.close();
}
