// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · one compressed request must never take the process down
//
// GHSA-27r3-jxmh-p828 (body-parser < 1.20.9): a request that carries
// Content-Encoding: gzip is piped through a zlib stream. After the body has
// been read the stream stays piped with no error listener, so a payload of one
// valid gzip frame followed by trailing bytes decodes, the route answers
// normally, and the trailing bytes then reach the finished decoder, which
// emits an error nobody listens for. Node re-throws it as an uncaught
// exception and the whole server exits. No sign-in and no matching route is
// needed: parsing runs before routing, so any anonymous client could do it.
//
// Both live servers locked 1.20.6 (audit-backend item 1). This suite drives the
// exact production middleware chain over a real loopback socket, sends such a
// request, and proves the process is still answering afterwards. It guards the
// property the fix exists to protect: a compressed body with trailing bytes
// must never take the process down.
//
// Honest note on what this test does and does not prove (mutation run on
// 1 Nov 2026): pinning body-parser back to the vulnerable 1.20.6 and running
// this suite on Node 24 still PASSED — the trailing bytes surfaced as a
// synchronous 400 (Z_DATA_ERROR) that the app's error handling caught, both
// over Content-Length and over chunked transfer encoding, so the historic
// uncaught-exception crash did not reproduce deterministically in this harness
// on this Node. This is therefore a survival GUARD (the behaviour the fix
// protects), not a test that goes red on 1.20.6. The authority that pins the
// patched version is the runtime audit floor (npm audit --omit=dev → 0); the
// upstream fix is body-parser 1.20.9. Task item 3 asks exactly for a test that
// sends a gzip frame with trailing bytes and proves the process survives.
//
// Synthetic evidence: an in-process server and crafted bytes, not production.
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import { gzipSync } from 'node:zlib';
import { setTimeout as sleep } from 'node:timers/promises';

process.env.NODE_ENV = 'test';
process.env.PRI_AUTH_DELIVERY_KEY = '53'.repeat(32);
delete process.env.PRI_PUBLIC_ORIGIN;

const { startApp, checks } = await import('./support/app-harness.mjs');
const { createPlatformDb } = await import('../platform/db.js');

const c = checks();

// With a listener on, Node no longer exits on an uncaught exception — so the
// suite records every one and fails on it explicitly. Without the listener
// the vulnerable server kills this very process, which is also a red run, but
// a named failure says what happened.
const uncaught = [];
const onUncaught = error => { uncaught.push(error); };
const onRejection = reason => { uncaught.push(reason instanceof Error ? reason : new Error(String(reason))); };
process.on('uncaughtException', onUncaught);
process.on('unhandledRejection', onRejection);

const db = createPlatformDb(':memory:');
const app = await startApp({ db });
try {
  const alive = async label => {
    const health = await app.request('/v1/health');
    c.eq(health.status, 200, `${label}: /v1/health answers 200`);
    return health;
  };
  await alive('before');

  // One valid frame, then bytes that are not a gzip member.
  const frame = gzipSync(Buffer.from(JSON.stringify({ email: 'nobody@example.test' })));
  const trailing = Buffer.concat([frame, Buffer.from('not-gzip-after-the-frame-'.repeat(8))]);
  const sendGzip = (path, rawBody) => app.request(path, {
    method: 'POST', rawBody,
    headers: { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' }
  });

  // ── 1 · Trailing bytes after the frame: the request is answered, nothing dies ──
  // An unmatched /v1 path: parsing runs before routing, exactly as the advisory
  // says, so this needs neither a session nor a real route.
  const unrouted = await sendGzip('/v1/no-such-route', trailing);
  c.ok(unrouted.status >= 400 && unrouted.status < 500, `the unrouted compressed request gets an HTTP answer (${unrouted.status})`);
  // The zlib error, when it comes, comes on a later tick than the response.
  await sleep(150);
  c.eq(uncaught.length, 0, `no uncaught exception after the unrouted request${uncaught[0] ? `: ${uncaught[0].message}` : ''}`);
  await alive('after the unrouted request');

  // A routed anonymous endpoint too: the frame decodes to a body the route can
  // read, the route answers, and the trailing bytes still change nothing.
  const routed = await sendGzip('/v1/account/register', trailing);
  c.ok(routed.status >= 400 && routed.status < 500, `the routed compressed request gets an HTTP answer (${routed.status})`);
  await sleep(150);
  c.eq(uncaught.length, 0, `no uncaught exception after the routed request${uncaught[0] ? `: ${uncaught[0].message}` : ''}`);
  await alive('after the routed request');

  // ── 2 · Many in a row, concurrently: still one living process ───────────────
  const burst = await Promise.all(Array.from({ length: 12 }, (_, i) => sendGzip(`/v1/no-such-route-${i}`, trailing)));
  c.ok(burst.every(r => r.status >= 400 && r.status < 500), 'twelve concurrent trailing-byte requests are all answered');
  await sleep(250);
  c.eq(uncaught.length, 0, `no uncaught exception after the burst${uncaught[0] ? `: ${uncaught[0].message}` : ''}`);
  await alive('after the burst');

  // ── 3 · A frame that is simply corrupt is a 400, not a crash ────────────────
  const corrupt = Buffer.concat([frame.subarray(0, 10), Buffer.from('garbage-in-the-middle'), frame.subarray(10)]);
  const refused = await sendGzip('/v1/no-such-route', corrupt);
  c.eq(refused.status, 400, 'a corrupt gzip body is refused with 400');
  await sleep(150);
  c.eq(uncaught.length, 0, 'and raises nothing uncaught');
  await alive('after the corrupt frame');
} finally {
  await app.close();
  process.off('uncaughtException', onUncaught);
  process.off('unhandledRejection', onRejection);
}

console.log(`COMPRESSED BODY SURVIVAL: PASS — ${c.count()}/${c.count()} checks — trailing bytes after a gzip frame leave the process answering`);
