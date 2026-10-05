// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the handwriting latency budget (docs/operations/alerts.md §2a)
//
// Target: ink submitted → mark shown in under 4 s at p95. This server sees the
// provider read, and this check pins the parts of the budget that are code:
//
//   · the read is bounded: a provider that does not answer is a coded refusal
//     (HANDWRITING_TIMEOUT, retryable) inside the configured budget, never a
//     hang, and the fallback shares that one budget rather than adding to it;
//   · every read, slow or failed, lands in `provider_latency_ms{provider=
//     handwriting}` with its latency, and /v1/metrics reports the series since
//     boot and over the last 5 minutes;
//   · HANDWRITING_LATENCY_P95 fires at its documented threshold and not below;
//   · what the student sees meanwhile is the designed state, in English and
//     Hindi: "still reading" past 5 s, and the saved-and-retried note on a
//     timeout — never a blank, never a mark.
//
// No network call is made; the provider is a stub and time is a fake clock
// where a clock is needed.
// ─────────────────────────────────────────────────────────────────────────────
import express from 'express';
import cookieParser from 'cookie-parser';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPlatformDb } from '../platform/db.js';
import { createHandwritingRouter } from '../platform/handwriting.js';
import { transcribeHandwriting, providerConfig } from '../platform/handwritingProvider.js';
import { ALERT_RULES, createMetrics, metrics } from '../platform/metrics.js';
import { SESSION_COOKIE, sha256 } from '../platform/security.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../..');

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

const PNG = 'data:image/png;base64,' + Buffer.from('a'.repeat(600)).toString('base64');
const env = {
  PRI_HANDWRITING_API_KEY: 'test-key-not-real', PRI_HANDWRITING_MODEL: 'test-primary', PRI_HANDWRITING_FALLBACK_MODEL: 'test-fallback',
  PRI_PAID_CALLS_PER_HOUR: '10000', PRI_PAID_CALLS_PER_DAY: '100000'
};
/** A provider that never answers; it only honours the abort signal. */
const hangs = async (_url, init) => new Promise((_resolve, reject) => {
  const fail = () => reject(new DOMException('Aborted', 'AbortError'));
  if (init.signal.aborted) fail(); else init.signal.addEventListener('abort', fail, { once: true });
});

// ── 1 · The read is bounded by one budget, fallback included ────────────────
{
  const budget = 2000;
  const started = Date.now();
  let error = null;
  try { await transcribeHandwriting(PNG, { env: { ...env, PRI_HANDWRITING_TIMEOUT_MS: String(budget) }, fetchImpl: hangs }); }
  catch (e) { error = e; }
  const took = Date.now() - started;
  eq([error?.code, error?.status, error?.retryable], ['HANDWRITING_TIMEOUT', 504, true], 'a provider that never answers is a coded, retryable 504');
  ok(took >= budget * 0.9 && took < budget + 500, `primary and fallback together stay inside the one budget (${took} ms for a ${budget} ms budget)`);
}
eq(providerConfig({ PRI_HANDWRITING_API_KEY: 'k', PRI_HANDWRITING_TIMEOUT_MS: '500' }).timeoutMs, 2000, 'the budget cannot be configured below 2 s');
eq(providerConfig({ PRI_HANDWRITING_API_KEY: 'k', PRI_HANDWRITING_TIMEOUT_MS: '600000' }).timeoutMs, 60000, 'nor above 60 s');

// ── 2 · Every read lands in the latency series, failed ones with their code ──
const db = createPlatformDb(':memory:');
const now = Date.now();
db.prepare('INSERT INTO accounts(id,email,name,role,created_at,updated_at,email_verified_at) VALUES (?,?,?,?,?,?,?)')
  .run('acct-lat', 'lat@example.test', 'Latency', 'student', now, now, now);
db.prepare(`INSERT INTO account_sessions(id,account_id,token_hash,device_id,user_agent_hash,created_at,last_seen_at,expires_at)
  VALUES (?,?,?,?,?,?,?,?)`).run('ses-lat', 'acct-lat', sha256('raw-lat'), 'ipad', null, now, now, now + 86400000);

let mode = 'slow';
const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use('/handwriting', createHandwritingRouter(db, {
  env,
  transcribe: async (image, options) => {
    if (mode === 'timeout') {
      return transcribeHandwriting(image, { ...options, env: { ...env, PRI_HANDWRITING_TIMEOUT_MS: '2000' }, fetchImpl: hangs });
    }
    await new Promise(resolve => setTimeout(resolve, mode === 'slow' ? 120 : 5));
    return { engine: 'cloud-test', lines: [{ text: 'x = 4', latex: null, confidence: 0.97 }], text: 'x = 4', confidence: 0.97, needsConfirmation: false, latencyMs: mode === 'slow' ? 120 : 5 };
  }
}));
const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
const base = `http://127.0.0.1:${server.address().port}`;
const read = async () => {
  const res = await fetch(`${base}/handwriting/transcribe`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie: `${SESSION_COOKIE}=raw-lat` }, body: JSON.stringify({ image: PNG })
  });
  return { status: res.status, json: await res.json().catch(() => null) };
};

try {
  metrics.reset();
  mode = 'slow';
  const slow = await read();
  eq(slow.status, 200, 'a slow-but-successful read answers 200');
  ok(Number.isFinite(slow.json?.transcription?.latencyMs), 'and carries its own latency for the client diagnostics');
  mode = 'fast';
  await read();
  mode = 'timeout';
  const timedOut = await read();
  eq([timedOut.status, timedOut.json?.error?.code, timedOut.json?.error?.retryable], [504, 'HANDWRITING_TIMEOUT', true],
    'a timed-out read reaches the student as a retryable 504 with its code');

  const snap = metrics.snapshot();
  const series = snap.latency['provider_latency_ms{provider=handwriting}'];
  ok(series && series.count === 3, `three reads, three latency samples (${series?.count})`);
  ok(series && series.last5m.count === 3 && Number.isFinite(series.last5m.p95Ms), 'the series reports a 5-minute window with its own p95');
  ok(series && series.p95Ms >= 2000, `the timed-out read's full wait is in the series (p95 ${series?.p95Ms} ms)`);
  eq(snap.counters['provider_calls_total{outcome=failed,provider=handwriting}']?.total, 1, 'the timeout is one failed provider call');
  eq(snap.counters['provider_failures_total{code=HANDWRITING_TIMEOUT,provider=handwriting}']?.total, 1, 'with HANDWRITING_TIMEOUT as its code');
  eq(snap.counters['provider_calls_total{outcome=ok,provider=handwriting}']?.total, 2, 'and the two reads that answered are ok calls');
} finally {
  await new Promise(resolve => server.close(resolve));
  metrics.reset();
}

// ── 3 · HANDWRITING_LATENCY_P95 fires at its threshold, not below ───────────
{
  const rule = ALERT_RULES.find(r => r.id === 'HANDWRITING_LATENCY_P95');
  ok(rule, 'the latency rule exists');
  eq(rule?.thresholds, { count: 5, p95Ms: 4000, minutes: 5 }, 'with the documented thresholds: p95 ≥ 4 s over ≥ 5 reads in 5 minutes');
  let clock = 1_700_000_000_000;
  const m = createMetrics({ now: () => clock });
  const firing = () => m.snapshot().firing;
  for (let i = 0; i < 4; i++) m.observe('provider_latency_ms', { provider: 'handwriting' }, 9000);
  ok(!firing().includes('HANDWRITING_LATENCY_P95'), 'four slow reads are not enough to page');
  m.observe('provider_latency_ms', { provider: 'handwriting' }, 9000);
  ok(firing().includes('HANDWRITING_LATENCY_P95'), 'the fifth slow read in the window fires it');
  m.reset();
  for (let i = 0; i < 21; i++) m.observe('provider_latency_ms', { provider: 'handwriting' }, 1500);
  m.observe('provider_latency_ms', { provider: 'handwriting' }, 9000);
  ok(!firing().includes('HANDWRITING_LATENCY_P95'), 'one slow read among twenty-one fast ones is under the p95 and does not page');
  eq(m.p95('provider_latency_ms', { minutes: 5, where: { provider: 'handwriting' } }).count, 22, 'the window counts every sample');
  m.reset();
  for (let i = 0; i < 6; i++) m.observe('provider_latency_ms', { provider: 'handwriting' }, 5000);
  ok(firing().includes('HANDWRITING_LATENCY_P95'), 'six reads at 5 s fire it');
  clock += 6 * 60_000;
  ok(!firing().includes('HANDWRITING_LATENCY_P95'), 'and it clears once the window has passed');
  eq(m.snapshot().latency['provider_latency_ms{provider=handwriting}'].count, 6, 'while the since-boot count is kept');
  for (let i = 0; i < 6; i++) m.observe('provider_latency_ms', { provider: 'working' }, 9000);
  ok(!firing().includes('HANDWRITING_LATENCY_P95'), 'the working checker has its own, longer budget and does not fire the handwriting rule');
}

// ── 4 · The student-facing slow-provider states, in both languages ──────────
{
  const en = (await import(join(ROOT, 'client/src/i18n/strings.en.js'))).default;
  const hi = (await import(join(ROOT, 'client/src/i18n/strings.hi.js'))).default;
  const inkAnswer = readFileSync(join(ROOT, 'client/src/ink/InkAnswer.jsx'), 'utf8');
  ok(/export const STILL_READING_MS = 5000;/.test(inkAnswer), 'the "still reading" note appears at 5 s');
  ok(/t\(slowRead \? 'ink\.serverStillReading' : 'ink\.serverReading'\)/.test(inkAnswer), 'and swaps the reading note for the still-reading note');
  for (const key of ['ink.serverReading', 'ink.serverStillReading', 'ink.waitingServiceDown']) {
    ok(typeof en[key] === 'string' && en[key].length > 10, `EN has ${key}`);
    ok(typeof hi[key] === 'string' && /[ऀ-ॿ]/.test(hi[key]), `HI has ${key} in Devanagari`);
  }
  ok(/nothing is lost/i.test(en['ink.serverStillReading']), 'the still-reading note promises the ink is kept');
  ok(/saved/i.test(en['ink.waitingServiceDown']) && /tried again/i.test(en['ink.waitingServiceDown']), 'the timed-out note says the working is saved and will be retried');
  // A timed-out read resolves to that note, not to a settings pointer or a blank.
  const { inkReadingBlockedKey } = await import(join(ROOT, 'client/src/ink/cloudReader.js'));
  const user = { cloudLinked: true, cloudHandwriting: true };
  const available = () => true;
  const online = () => true;
  eq(inkReadingBlockedKey(user, { outcome: { error: { code: 'HANDWRITING_TIMEOUT' } }, available, online }), 'ink.waitingServiceDown',
    'a provider timeout shows the saved-and-retried note');
  eq(inkReadingBlockedKey(user, { outcome: { error: { code: 'HANDWRITING_PROVIDER_5XX' } }, available, online }), 'ink.waitingServiceDown',
    'as does a provider outage');
  eq(inkReadingBlockedKey(user, { available, online: () => false }), 'ink.waitingOffline', 'while offline is its own, saved-and-read-later note');
  ok(/Saved\. It will be read when you are back online\./.test(en['ink.waitingOffline']), 'the offline note begins with the plain promise');
}

// ── report ───────────────────────────────────────────────────────────────────
if (failures.length) {
  console.log(`HANDWRITING LATENCY BUDGET: FAIL — ${pass}/${pass + failures.length} checks`);
  for (const f of failures) console.log(`  FAIL ${f}`);
  process.exit(1);
}
console.log(`HANDWRITING LATENCY BUDGET: PASS — ${pass}/${pass} checks — timeouts are coded and bounded, every read is in provider_latency_ms with a 5-minute p95, HANDWRITING_LATENCY_P95 fires at p95 ≥ 4 s over ≥ 5 reads, and the student's slow-read states exist in EN and HI.`);
