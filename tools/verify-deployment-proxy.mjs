#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · whose address does the server count anonymous requests against?
//
// Issue #653. In production the server sets Express `trust proxy` to
// PRI_TRUSTED_PROXY_HOPS, and every anonymous rate limiter (login, register,
// OTP, password reset) keys on `req.ip`. Get the hop count wrong and either a
// client mints a fresh bucket per request by sending its own X-Forwarded-For
// (too many hops), or everyone behind one proxy shares a bucket (too few). The
// value cannot be read from outside, but its effect can.
//
// Read-only and anonymous. It sends unauthenticated GETs to
// /v1/content/published-index (limit 60 a minute per identity), each on a new
// connection, and reads two response headers:
//   · RateLimit-Reset: when the bucket's window ends. A window opens at the
//     bucket's first request, so the value identifies the bucket.
//   · x-hikari-trace (falling back to x-railway-edge): which Railway edge
//     node carried the request.
// Then it sends a few requests with forged X-Forwarded-For / X-Real-IP.
//
// Verdicts (exit 0 PASS, 1 FAIL, 2 INCONCLUSIVE):
//   · PER-EDGE-NODE (FAIL): every edge node maps to exactly one bucket and
//     every bucket to one node, over at least two nodes each seen at least
//     twice. The server is counting the Railway edge, not the client: hops
//     too few for the real chain, or the edge leaks its own address.
//   · SPOOFABLE (FAIL): this client's plain requests share one bucket, but a
//     forged header lands in a different one.
//   · SINGLE-BUCKET (exit 0): one bucket for this client across several edge
//     nodes, no forged header escapes it. Consistent with per-client keying but
//     not proof (one global bucket looks the same): confirm from a second address.
//   · INCONCLUSIVE: one edge node only, a client whose own address changes
//     between connections (some VPNs and carrier NATs), or too few samples
//     from windows opened during the run. Run it from a fixed address, for
//     example a CI runner or a server shell.
//
//   node tools/verify-deployment-proxy.mjs --origin https://staging.example.com
//
// Staging only, unless the owner asks for production: the requests are
// harmless, but this lane does not probe production.
// ─────────────────────────────────────────────────────────────────────────────
import { request } from 'node:https';
import { pathToFileURL } from 'node:url';

const PATH = '/v1/content/published-index';
const WINDOW_SECONDS = 60;
// Fewer than the 60-a-minute limit even if every request shares one bucket.
const PLAIN_REQUESTS = 24;
// Forged addresses are fresh every run (a bucket left by an earlier run must
// never hide an escape). X-Real-IP is sent too but never counts as proof: Express
// does not read it, so it can never escape a bucket.
const doc = () => `203.0.113.${1 + Math.floor(Math.random() * 254)}`;
const forgedSet = () => {
  const [a, b, c] = [doc(), `198.51.100.${1 + Math.floor(Math.random() * 254)}`, `192.0.2.${1 + Math.floor(Math.random() * 254)}`];
  return [{ 'x-forwarded-for': a }, { 'x-forwarded-for': `${a}, ${b}` }, { 'x-forwarded-for': `${a}, ${b}, ${c}` }, { 'x-real-ip': doc() }];
};
const FORGED_ROUNDS = 2;
const REQUEST_TIMEOUT_MS = 15_000;
// A run must finish inside one window, or a bucket could roll over mid-run.
const RUN_BUDGET_MS = 50_000;

/**
 * Classify samples. Each sample is { node, reset, forged } with reset in
 * seconds since the epoch. Only samples from windows opened during the run
 * (reset >= startedAt + WINDOW_SECONDS - 1) are counted: a bucket that already
 * existed when the run began can roll over halfway through it.
 */
export function classify(samples, startedAtSeconds) {
  const fresh = samples.filter(s => s.node && Number.isFinite(s.reset) && s.reset >= startedAtSeconds + WINDOW_SECONDS - 1);
  const plain = fresh.filter(s => !s.forged && !s.realIpOnly);
  // Forged X-Forwarded-For samples count whether or not their window is fresh:
  // a bucket that a forged address already owned is still an escape.
  const forged = samples.filter(s => s.forged && s.node && Number.isFinite(s.reset));
  const nodes = new Map();      // node → Set(bucket)
  const buckets = new Map();    // bucket → Set(node)
  const seen = new Map();       // node → plain samples
  for (const s of plain) {
    if (!nodes.has(s.node)) nodes.set(s.node, new Set());
    nodes.get(s.node).add(s.reset);
    if (!buckets.has(s.reset)) buckets.set(s.reset, new Set());
    buckets.get(s.reset).add(s.node);
    seen.set(s.node, (seen.get(s.node) || 0) + 1);
  }
  // RateLimit-Reset is in whole seconds, so two buckets opened in the same
  // second share it. One real bucket's Remaining falls strictly, request by
  // request; a repeat or a rise under one Reset means two buckets collided.
  const byReset = new Map();
  for (const s of [...plain, ...forged]) { if (!Number.isFinite(s.remaining)) continue; if (!byReset.has(s.reset)) byReset.set(s.reset, []); byReset.get(s.reset).push(s.remaining); }
  const collided = [...byReset.values()].some(r => r.some((v, i) => i > 0 && !(v < r[i - 1])));
  const facts = {
    samples: samples.length, counted: fresh.length, plain: plain.length, forged: forged.length,
    nodes: nodes.size, buckets: buckets.size, collided
  };
  if (plain.length < 8) return { verdict: 'INCONCLUSIVE', reason: 'too few samples from windows opened during the run (wait a minute and run again)', facts };
  if (nodes.size < 2) return { verdict: 'INCONCLUSIVE', reason: 'every request reached the same edge node, so node and client cannot be told apart', facts };
  if (buckets.size === 1) {
    const [only] = buckets.keys();
    const escaped = forged.filter(s => s.reset !== only);
    if (escaped.length) return { verdict: 'SPOOFABLE', reason: `${escaped.length} of ${forged.length} forged requests got a bucket of their own`, facts };
    if (collided) return { verdict: 'INCONCLUSIVE', reason: 'buckets opened in the same second share one Reset (its Remaining did not fall strictly); run again', facts };
    if (!forged.length) return { verdict: 'INCONCLUSIVE', reason: 'no forged X-Forwarded-For request was counted', facts };
    // One vantage point cannot tell per-client keying from one bucket that all
    // traffic shares; a second address must confirm before production copies it.
    return { verdict: 'SINGLE-BUCKET', reason: `one bucket for this client across ${nodes.size} edge nodes and no forged header escaped it: consistent with per-client keying, NOT proof of it; confirm from a second address`, facts };
  }
  const oneToOne = [...nodes.values()].every(set => set.size === 1) && [...buckets.values()].every(set => set.size === 1);
  if (oneToOne && [...seen.values()].every(n => n >= 2)) {
    return { verdict: 'PER-EDGE-NODE', reason: `${nodes.size} edge nodes, ${buckets.size} buckets, one bucket per node: the server counts the Railway edge, not the client`, facts };
  }
  if (oneToOne || collided) return { verdict: 'INCONCLUSIVE', reason: 'buckets look per edge node, but a node was seen once or buckets shared a Reset second; run again', facts };
  return { verdict: 'INCONCLUSIVE', reason: 'buckets vary within an edge node: either this client\'s address changes between connections or buckets are keyed some other way; run from a fixed address', facts };
}

/**
 * X-Real-IP forgery verdict from the staging diagnostic (/v1/diag/client-ip).
 * `echoes`: [{ forged, reply }]. SPOOFABLE when any forged value reached the app.
 */
export function classifyRealIp(echoes) {
  const usable = echoes.filter(e => e.reply && e.reply.probe === 'client-ip');
  if (!usable.length) return { verdict: 'UNAVAILABLE', reason: 'the staging diagnostic /v1/diag/client-ip is not on (PRI_CLIENT_IP_HEADER_PROBE=1 on staging)' };
  const leaked = usable.filter(e => String(e.reply.xRealIp || '').split(',').map(v => v.trim()).includes(e.forged));
  if (leaked.length) return { verdict: 'X-REAL-IP-SPOOFABLE', reason: `${leaked.length} of ${usable.length} forged X-Real-IP values reached the app: X-Real-IP must NOT be trusted` };
  const empty = usable.filter(e => !e.reply.xRealIp);
  if (empty.length) return { verdict: 'X-REAL-IP-ABSENT', reason: 'the edge did not set X-Real-IP on every request' };
  return { verdict: 'X-REAL-IP-EDGE-SET', reason: `the edge replaced every forged X-Real-IP (${usable.length} tries)` };
}

function echo(origin, headers) {
  return new Promise(resolve => {
    const req = request(new URL('/v1/diag/client-ip', origin), { method: 'GET', agent: false, headers: { Accept: 'application/json', ...headers }, timeout: REQUEST_TIMEOUT_MS }, res => {
      let body = ''; res.setEncoding('utf8'); res.on('data', d => { body += d; });
      res.on('end', () => { try { resolve(res.statusCode === 200 ? JSON.parse(body) : null); } catch { resolve(null); } });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', () => resolve(null));
    req.end();
  });
}

export async function forgeRealIp(origin, tries = 4) {
  const echoes = [];
  for (let i = 0; i < tries; i++) {
    const forged = `198.18.${Math.floor(Math.random() * 255)}.${1 + Math.floor(Math.random() * 254)}`;
    echoes.push({ forged, reply: await echo(origin, { 'X-Real-IP': forged, 'X-Forwarded-For': forged }) });
  }
  return { ...classifyRealIp(echoes), echoes };
}

function probe(origin, headers = {}) {
  return new Promise(resolve => {
    // agent: false — a new connection (and so a fresh edge choice) per request.
    const req = request(new URL(PATH, origin), { method: 'GET', agent: false, headers: { 'user-agent': 'pri-verify-deployment-proxy', ...headers }, timeout: REQUEST_TIMEOUT_MS }, res => {
      res.resume();
      const node = String(res.headers['x-hikari-trace'] || res.headers['x-railway-edge'] || '');
      const reset = Number(res.headers['ratelimit-reset']);
      resolve({ status: res.statusCode, node, reset, remaining: Number(res.headers['ratelimit-remaining']) });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', err => resolve({ status: 0, node: '', reset: NaN, error: String(err.message || err) }));
    req.end();
  });
}

export async function verifyProxyIdentity({ origin }) {
  const started = Date.now();
  const startedAt = Math.floor(started / 1000);
  const samples = [];
  const order = [];
  for (let i = 0; i < PLAIN_REQUESTS; i++) order.push(null);
  for (let r = 0; r < FORGED_ROUNDS; r++) for (const h of forgedSet()) order.push(h);
  for (const headers of order) {
    if (Date.now() - started > RUN_BUDGET_MS) break;
    const s = await probe(origin, headers || {});
    samples.push({ ...s, forged: !!headers && !!headers['x-forwarded-for'], realIpOnly: !!headers && !headers['x-forwarded-for'], forgedWith: headers ? Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('') : null });
  }
  const result = classify(samples, startedAt);
  return { ...result, samples, elapsedMs: Date.now() - started };
}

function parseArgs(argv) {
  const args = { origin: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--origin') { args.origin = argv[++i]; continue; }
    throw new Error(`Unknown argument: ${argv[i]}`);
  }
  if (!args.origin || !/^https:\/\/[^/]+\/?$/.test(args.origin)) throw new Error('--origin https://host is required');
  return args;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { origin } = parseArgs(process.argv.slice(2));
  const out = await verifyProxyIdentity({ origin });
  const byNode = new Map();
  for (const s of out.samples) {
    const k = `${s.node || '(no node)'} bucket ${Number.isFinite(s.reset) ? s.reset : '?'}`;
    byNode.set(k, (byNode.get(k) || 0) + 1);
  }
  for (const [k, n] of [...byNode.entries()].sort()) console.log(`  ${String(n).padStart(3)} × ${k}`);
  const errors = out.samples.filter(s => s.status !== 200);
  if (errors.length) console.log(`  ${errors.length} request(s) did not answer 200: ${[...new Set(errors.map(s => s.status || s.error))].join(', ')}`);
  console.log(`  ${JSON.stringify(out.facts)} in ${Math.round(out.elapsedMs / 1000)} s`);
  const realIp = await forgeRealIp(origin);
  console.log(`X-REAL-IP: ${realIp.verdict} — ${realIp.reason}`);
  for (const e of realIp.echoes) if (e.reply) console.log(`  forged ${e.forged} → X-Real-IP ${e.reply.xRealIp} · XFF ${e.reply.xForwardedFor} · req.ip ${e.reply.reqIp}`);
  if (realIp.verdict === 'X-REAL-IP-SPOOFABLE') { console.log(`PROXY IDENTITY: ${out.verdict} — ${out.reason}`); process.exit(1); }
  console.log(`PROXY IDENTITY: ${out.verdict} — ${out.reason} (${origin}, ${new Date().toISOString()})`);
  process.exit(out.verdict === 'SINGLE-BUCKET' ? 0 : out.verdict === 'INCONCLUSIVE' ? 2 : 1);
}
