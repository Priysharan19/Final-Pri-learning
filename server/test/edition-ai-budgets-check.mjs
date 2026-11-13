// Pri Learning · AI budgets and the allowance day, per regional edition (plan H7).
//
// ADR-0002 §9–10: each regional deployment is a silo with its own key, its own
// bill and its own students. So:
//   1. the free-practice day is the EDITION's calendar day — Asia/Kolkata for
//      Priyabhata, Australia/Sydney (daylight saving included) for
//      Prithagoras — and Priyabhata's day is byte-for-byte the one `main`
//      computed before editions existed, shown against a frozen copy of that
//      function over a year of sampled instants;
//   2. the paid-call ceiling is required with no default in every edition: a
//      Prithagoras deployment with a model key and no ceiling refuses to
//      start, exactly as a Priyabhata one does;
//   3. under each edition the ceiling refuses before the provider is called,
//      gives a unit back when the provider was provably sent nothing, counts
//      every unit under the edition, and a PAID_CEILING_HIGH email names the
//      edition and its region; the operator's health view names them too;
//   4. over real HTTP on a Prithagoras server, a free account's day is counted
//      under the Sydney date and refused until Sydney midnight.
//
// Usage: node server/test/edition-ai-budgets-check.mjs   (PRI_TEST_ENGINE=postgres for Postgres)
import './support/hermetic.mjs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const keys = ['NODE_ENV', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_PUBLIC_ORIGIN', 'PRI_FREE_PRACTICE_PER_DAY', 'PRI_EDITION',
  'PRI_HANDWRITING_API_KEY', 'PRI_PAID_CALLS_PER_HOUR', 'PRI_PAID_CALLS_PER_DAY'];
const before = Object.fromEntries(keys.map(key => [key, process.env[key]]));
const scratch = mkdtempSync(join(tmpdir(), 'pri-edition-budgets-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = 'b8'.repeat(32);
process.env.PRI_FREE_PRACTICE_PER_DAY = '2';
// The HTTP part runs a Prithagoras server; every pure check below names its
// edition explicitly, so nothing here leans on this default.
process.env.PRI_EDITION = 'prithagoras';
delete process.env.PRI_PUBLIC_ORIGIN;
delete process.env.PRI_HANDWRITING_API_KEY;
delete process.env.PRI_PAID_CALLS_PER_HOUR;
delete process.env.PRI_PAID_CALLS_PER_DAY;

// The suite owns the clock for the HTTP part.
const realNow = Date.now;
let clockAt = null;
Date.now = () => (clockAt ?? realNow());

const { EDITIONS, EDITION_IDS } = await import('../../client/edition.config.mjs');
const { FREE_PRACTICE_ALLOWANCE, PRACTICE_DAY_TIME_ZONES, practiceDayTimeZone } = await import('../../client/src/engine/practiceAllowance.js');
const { practiceDay, practiceAllowanceVerdict, recordPracticeIssue, refusePracticeCap, PRACTICE_DAY_TIME_ZONE, PRACTICE_DAILY_SCOPE } = await import('../platform/practiceAllowance.js');
const { spendCeiling, spendCeilingMissing, reservePaidCall, refundPaidCall, PAID_BUDGET } = await import('../platform/spendCeiling.js');
const { metrics, deploymentLabel } = await import('../platform/metrics.js');
const { createAlertNotifier, alertEmailMessage } = await import('../platform/alertNotifier.js');
const { createHandwritingRouter } = await import('../platform/handwriting.js');
const { operatorHealthDetail } = await import('../platform/operatorHealth.js');
const { startApp, registerAccount, verifyEmail, checks } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const { SESSION_COOKIE, sha256 } = await import('../platform/security.js');
const { pngDataUrl } = await import('./support/test-image.mjs');
const express = (await import('express')).default;
const cookieParser = (await import('cookie-parser')).default;

const c = checks();
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const dayIn = (ms, timeZone) => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));

// ── `main`'s practiceDay before editions (origin/main d1448d6a3), frozen ────
// Copied verbatim so the comparison below is against what shipped, not
// against a second reading of the new code.
const MAIN = (() => {
  const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const pad = n => String(n).padStart(2, '0');
  return function practiceDay(now = Date.now()) {
    const start = Math.floor((now + IST_OFFSET_MS) / DAY_MS) * DAY_MS - IST_OFFSET_MS;
    const local = new Date(start + IST_OFFSET_MS);
    return {
      key: `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`,
      start,
      end: start + DAY_MS,
      timeZone: 'Asia/Kolkata'
    };
  };
})();

// ── 1 · One calendar per edition, held equal to the edition table ───────────
c.deq(Object.keys(PRACTICE_DAY_TIME_ZONES).sort(), [...EDITION_IDS].sort(), 'every edition has a practice day, and no other name does');
for (const id of EDITION_IDS) {
  c.eq(practiceDayTimeZone(id), EDITIONS[id].timezone, `${EDITIONS[id].brand}'s practice day is counted in its own timezone (${EDITIONS[id].timezone})`);
}
c.eq(PRACTICE_DAY_TIME_ZONES.priyabhata, FREE_PRACTICE_ALLOWANCE.timeZone, 'Priyabhata keeps the constant every existing import reads');
c.eq(PRACTICE_DAY_TIME_ZONE, 'Asia/Kolkata', 'and the server\'s exported default is still the Indian day');
let unknown = null;
try { practiceDayTimeZone('typo'); } catch (error) { unknown = error; }
c.ok(unknown instanceof Error, 'an unknown edition has no practice day: it throws rather than borrowing another region\'s');

// ── 2 · Priyabhata: byte-identical to `main` over a year ────────────────────
{
  const from = Date.UTC(2026, 0, 1);
  const to = Date.UTC(2027, 0, 1);
  let sampled = 0;
  let differ = null;
  const compare = ms => {
    sampled += 1;
    const shipped = JSON.stringify(MAIN(ms));
    if (JSON.stringify(practiceDay(ms, 'priyabhata')) !== shipped) differ ??= ms;
  };
  for (let ms = from; ms < to; ms += 37 * 60 * 1000 + 13_001) compare(ms);
  // Every Indian midnight of the year, and the millisecond either side of it.
  for (let start = MAIN(from).start; start < to; start += DAY) for (const ms of [start - 1, start, start + 1]) compare(ms);
  c.ok(sampled > 15_000, `${sampled} instants sampled across 2026`);
  c.eq(differ, null, `Priyabhata's practice day equals main's at every one of them${differ === null ? '' : ` (first difference at ${new Date(differ).toISOString()})`}`);
  // The default edition is Priyabhata: a caller that names none is unchanged.
  const saved = process.env.PRI_EDITION;
  delete process.env.PRI_EDITION;
  c.eq(JSON.stringify(practiceDay(Date.UTC(2026, 8, 5, 18, 30))), JSON.stringify(MAIN(Date.UTC(2026, 8, 5, 18, 30))), 'with PRI_EDITION unset the day is main\'s Indian day');
  process.env.PRI_EDITION = saved;
}

// ── 3 · Prithagoras: the Sydney day, both sides of daylight saving ──────────
{
  const sydney = ms => practiceDay(ms, 'prithagoras');
  // 2026: clocks go forward at 02:00 AEST on Sunday 4 October (AEST → AEDT).
  const spring = [
    [Date.UTC(2026, 9, 2, 13, 59, 59, 999), '2026-10-02', 24, '23:59:59.999 AEST on Friday 2 October is Friday'],
    [Date.UTC(2026, 9, 2, 14, 0, 0), '2026-10-03', 24, '00:00 AEST on Saturday 3 October starts Saturday'],
    [Date.UTC(2026, 9, 3, 13, 59, 59, 999), '2026-10-03', 24, 'the last millisecond of Saturday is Saturday'],
    [Date.UTC(2026, 9, 3, 14, 0, 0), '2026-10-04', 23, '00:00 AEST on Sunday 4 October starts the 23-hour day the clocks go forward'],
    [Date.UTC(2026, 9, 3, 16, 30, 0), '2026-10-04', 23, '03:30 AEDT, after the change, is still Sunday'],
    [Date.UTC(2026, 9, 4, 12, 59, 59, 999), '2026-10-04', 23, '23:59:59.999 AEDT is still Sunday'],
    [Date.UTC(2026, 9, 4, 13, 0, 0), '2026-10-05', 24, '00:00 AEDT on Monday 5 October starts Monday, an hour earlier in UTC']
  ];
  // 2027: clocks go back at 03:00 AEDT on Sunday 4 April (AEDT → AEST).
  const autumn = [
    [Date.UTC(2027, 3, 2, 12, 59, 59, 999), '2027-04-02', 24, '23:59:59.999 AEDT on Friday 2 April is Friday'],
    [Date.UTC(2027, 3, 3, 13, 0, 0), '2027-04-04', 25, '00:00 AEDT on Sunday 4 April starts the 25-hour day the clocks go back'],
    [Date.UTC(2027, 3, 3, 16, 30, 0), '2027-04-04', 25, '02:30 AEST, the repeated hour, is still Sunday'],
    [Date.UTC(2027, 3, 4, 13, 59, 59, 999), '2027-04-04', 25, '23:59:59.999 AEST is still Sunday'],
    [Date.UTC(2027, 3, 4, 14, 0, 0), '2027-04-05', 24, '00:00 AEST on Monday 5 April starts Monday, an hour later in UTC']
  ];
  for (const [ms, key, hours, label] of [...spring, ...autumn]) {
    const day = sydney(ms);
    c.deq([day.key, (day.end - day.start) / HOUR, day.timeZone], [key, hours, 'Australia/Sydney'], label);
    c.ok(day.start <= ms && ms < day.end, `${label}: the instant lies inside its day's bounds`);
  }
  c.eq(sydney(Date.UTC(2026, 9, 3, 14, 0, 0)).start, Date.UTC(2026, 9, 3, 14, 0, 0), 'the 23-hour day begins at the AEST midnight');
  c.eq(sydney(Date.UTC(2026, 9, 3, 14, 0, 0)).end, Date.UTC(2026, 9, 4, 13, 0, 0), 'and ends at the AEDT midnight');
  c.eq(sydney(Date.UTC(2027, 3, 3, 13, 0, 0)).end, Date.UTC(2027, 3, 4, 14, 0, 0), 'the 25-hour day ends at the AEST midnight');

  // Over a year: every sampled instant's key is Sydney's calendar date, and
  // its bounds are exactly that date's two local midnights.
  let sampled = 0;
  let wrong = null;
  for (let ms = Date.UTC(2026, 0, 1); ms < Date.UTC(2027, 0, 1) + 120 * DAY; ms += 53 * 60 * 1000 + 7_919) {
    sampled += 1;
    const day = sydney(ms);
    const good = day.key === dayIn(ms, 'Australia/Sydney') && day.start <= ms && ms < day.end &&
      dayIn(day.start, 'Australia/Sydney') === day.key && dayIn(day.end - 1, 'Australia/Sydney') === day.key && dayIn(day.end, 'Australia/Sydney') !== day.key &&
      dayIn(day.start - 1, 'Australia/Sydney') !== day.key && [23, 24, 25].includes((day.end - day.start) / HOUR);
    if (!good && wrong === null) wrong = ms;
  }
  c.ok(sampled > 12_000, `${sampled} instants sampled across sixteen months`);
  c.eq(wrong, null, `each lies in the Sydney calendar day, bounded by its own local midnights${wrong === null ? '' : ` (first failure at ${new Date(wrong).toISOString()})`}`);
  // The two editions disagree exactly where their calendars do.
  const t = Date.UTC(2026, 10, 13, 14, 0, 0); // 01:00 on 14 Nov in Sydney, 19:30 on 13 Nov in India
  c.deq([practiceDay(t, 'priyabhata').key, practiceDay(t, 'prithagoras').key], ['2026-11-13', '2026-11-14'], 'one instant, two regions, two calendar days');
}

// ── 4 · The count and the refusal under Prithagoras (no HTTP) ───────────────
{
  const { createPlatformDb } = await import('../platform/db.js');
  const db = createPlatformDb(':memory:');
  const now = Date.UTC(2026, 9, 4, 12, 30, 0); // 23:30 AEDT on Sunday 4 October
  db.prepare('INSERT INTO accounts(id,email,name,role,created_at,updated_at,email_verified_at) VALUES (?,?,?,?,?,?,?)')
    .run('acct-au', 'au@example.test', 'AU', 'student', now, now, now);
  const env = { PRI_FREE_PRACTICE_PER_DAY: '1', PRI_EDITION: 'prithagoras' };
  c.eq(await recordPracticeIssue(db, { accountId: 'acct-au', now, env }), 1, 'one question is counted');
  const row = db.prepare('SELECT key, expires_at FROM idempotency_keys WHERE account_id=? AND scope=?').get('acct-au', PRACTICE_DAILY_SCOPE);
  c.eq(row.key, '2026-10-04', 'under the Sydney date (India is still on Sunday afternoon, the UTC date is the 4th too, the edition decides)');
  const verdict = await practiceAllowanceVerdict(db, { accountId: 'acct-au', now, env });
  c.deq([verdict.allowed, verdict.used, verdict.limit, verdict.day, verdict.timeZone, verdict.resetsAt], [false, 1, 1, '2026-10-04', 'Australia/Sydney', Date.UTC(2026, 9, 4, 13, 0, 0)],
    'the verdict refuses the second and names the Sydney midnight it lifts at');
  const sent = {};
  const res = { headers: {}, set(k, v) { this.headers[k] = v; return this; }, status(code) { sent.status = code; return this; }, json(body) { sent.body = body; return this; } };
  refusePracticeCap(res, verdict, now);
  c.deq([sent.status, sent.body.error.code, sent.body.error.resetAt, sent.body.error.timeZone, res.headers['Retry-After']], [402, 'FREE_CAP_REACHED', Date.UTC(2026, 9, 4, 13, 0, 0), 'Australia/Sydney', String(30 * 60)],
    'the refusal reports the reset instant, its calendar and a Retry-After of the thirty minutes to Sydney midnight');
  const next = await practiceAllowanceVerdict(db, { accountId: 'acct-au', now: Date.UTC(2026, 9, 4, 13, 0, 0), env });
  c.deq([next.allowed, next.used, next.day], [true, 0, '2026-10-05'], 'at Sydney midnight the count starts afresh');
  // The same instant under Priyabhata is the Indian day, as before.
  const india = await practiceAllowanceVerdict(db, { accountId: 'acct-au', now, env: { PRI_FREE_PRACTICE_PER_DAY: '1' } });
  c.deq([india.day, india.timeZone, india.resetsAt], ['2026-10-04', 'Asia/Kolkata', MAIN(now).end], 'the default edition counts the same instant in the Indian day, as main did');
  db.close?.();
}

// ── 5 · The ceiling: required in every edition, with no default ─────────────
for (const id of EDITION_IDS) {
  c.deq(spendCeilingMissing({ PRI_EDITION: id, PRI_HANDWRITING_API_KEY: 'k' }), ['PRI_PAID_CALLS_PER_HOUR', 'PRI_PAID_CALLS_PER_DAY'],
    `${EDITIONS[id].brand}: a key with no ceiling is missing both numbers`);
  c.deq([spendCeiling({ PRI_EDITION: id }).edition, spendCeiling({ PRI_EDITION: id }).required], [id, false], `${EDITIONS[id].brand}: the ceiling is labelled with its edition, and is not required with no key`);
}
{
  const { assertPlatformConfig } = await import('../platform/config.js');
  const saved = Object.fromEntries(['PRI_EDITION', 'PRI_HANDWRITING_API_KEY', 'PRI_PAID_CALLS_PER_HOUR', 'PRI_PAID_CALLS_PER_DAY'].map(k => [k, process.env[k]]));
  const startsWith = env => {
    for (const [k, v] of Object.entries(env)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    try { assertPlatformConfig(); return null; } catch (error) { return error.message; }
  };
  const refused = startsWith({ PRI_EDITION: 'prithagoras', PRI_HANDWRITING_API_KEY: 'sk-test-au', PRI_PAID_CALLS_PER_HOUR: undefined, PRI_PAID_CALLS_PER_DAY: undefined });
  c.ok(/PRI_PAID_CALLS_PER_HOUR/.test(refused || '') && /PRI_PAID_CALLS_PER_DAY/.test(refused || ''), `a Prithagoras deployment with a model key and no ceiling refuses to start (${refused})`);
  const india = startsWith({ PRI_EDITION: 'priyabhata', PRI_HANDWRITING_API_KEY: 'sk-test-in', PRI_PAID_CALLS_PER_HOUR: undefined, PRI_PAID_CALLS_PER_DAY: undefined });
  c.ok(/PRI_PAID_CALLS_PER_HOUR/.test(india || ''), 'and so does a Priyabhata one, as before');
  const fine = startsWith({ PRI_EDITION: 'prithagoras', PRI_HANDWRITING_API_KEY: 'sk-test-au', PRI_PAID_CALLS_PER_HOUR: '10', PRI_PAID_CALLS_PER_DAY: '100' });
  c.ok(!/PRI_PAID_CALLS/.test(fine || ''), 'with its own ceiling it no longer names one as missing');
  startsWith(saved);
}

// ── 6 · Under each edition: refuse before the provider, refund, label, alert
{
  const { createPlatformDb } = await import('../platform/db.js');
  const db = createPlatformDb(':memory:');
  const now = Date.now();
  db.prepare('INSERT INTO accounts(id,email,name,role,created_at,updated_at,email_verified_at) VALUES (?,?,?,?,?,?,?)')
    .run('acct-s', 's@example.test', 'S', 'student', now, now, now);
  db.prepare(`INSERT INTO account_sessions(id,account_id,token_hash,device_id,user_agent_hash,created_at,last_seen_at,expires_at)
    VALUES (?,?,?,?,?,?,?,?)`).run('ses-s', 'acct-s', sha256('raw-s'), 'ipad', null, now, now, now + DAY);
  const counter = key => metrics.snapshot().counters[key]?.total || 0;
  let pictures = 0;
  const freshPicture = () => pngDataUrl('b'.repeat(600) + `-${pictures += 1}`);

  for (const id of EDITION_IDS) {
    metrics.reset();
    // Each edition's run starts from an empty budget of its own.
    db.prepare('DELETE FROM rate_limits').run();
    // The per-account allowance is raised so the deployment ceiling is what refuses.
    const env = { PRI_EDITION: id, PRI_HANDWRITING_API_KEY: 'k-test', PRI_PAID_CALLS_PER_HOUR: '5', PRI_PAID_CALLS_PER_DAY: '50', PRI_AI_DAILY_FREE: '100' };
    let providerCalls = 0;
    let mode = 'read';
    const app = express();
    app.use(express.json({ limit: '2mb' }));
    app.use(cookieParser());
    app.use('/handwriting', createHandwritingRouter(db, {
      env,
      transcribe: async () => {
        providerCalls += 1;
        if (mode === 'never-sent') throw Object.assign(new Error('not configured'), { code: 'HANDWRITING_NOT_CONFIGURED' });
        return { engine: 'cloud-test', lines: [{ text: 'x = 4', confidence: 0.95 }], text: 'x = 4', confidence: 0.95, needsConfirmation: false, escalated: false };
      }
    }));
    const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    const call = async () => {
      const res = await fetch(`http://127.0.0.1:${server.address().port}/handwriting/transcribe`, {
        method: 'POST', headers: { 'content-type': 'application/json', cookie: `${SESSION_COOKIE}=raw-s` }, body: JSON.stringify({ image: freshPicture() })
      });
      return { status: res.status, json: await res.json().catch(() => null) };
    };
    const brand = EDITIONS[id].brand;
    try {
      const hourCount = () => db.prepare('SELECT SUM(count) AS n FROM rate_limits WHERE bucket = ?').get(`${PAID_BUDGET}:hour`)?.n || 0;
      // A read the provider was provably never sent gives its unit back.
      mode = 'never-sent';
      const notSent = await call();
      c.ok(notSent.status >= 400, `${brand}: a read the provider was never sent fails`);
      c.deq([hourCount(), counter(`paid_calls_total{edition=${id},outcome=spent}`), counter(`paid_calls_total{edition=${id},outcome=refunded}`)], [0, 1, 1],
        `${brand}: and its unit is refunded, counted as spent then refunded under ${id}`);
      mode = 'read';
      const statuses = [];
      for (let i = 0; i < 5; i++) statuses.push((await call()).status);
      c.deq(statuses, [200, 200, 200, 200, 200], `${brand}: five reads fit a ceiling of five`);
      const sixth = await call();
      c.deq([sixth.status, sixth.json?.error?.code, providerCalls], [503, 'PAID_CAPACITY_REACHED', 6], `${brand}: the sixth is refused before the provider is called`);
      c.ok(/has not been read or marked/.test(sixth.json?.error?.message || '') && Number(sixth.json?.error?.resetAt) > now,
        `${brand}: the refusal says the work was not read or marked, and when the limit lifts`);
      c.ok(!Object.keys(sixth.json?.error || {}).some(k => /edition|region/i.test(k)), `${brand}: the student's refusal is the same body in every edition (no region named to the student)`);
      c.deq([counter(`paid_calls_total{edition=${id},outcome=spent}`), counter(`paid_calls_total{edition=${id},outcome=refused}`)], [6, 1], `${brand}: every unit spent and refused is counted under its edition`);
      c.ok(!Object.keys(metrics.snapshot().counters).some(k => k.startsWith('paid_calls_total') && !k.includes(`edition=${id}`)), `${brand}: and under no other edition`);
      c.deq(metrics.snapshot().deployment, { edition: process.env.PRI_EDITION, brand: EDITIONS[process.env.PRI_EDITION].brand, region: EDITIONS[process.env.PRI_EDITION].region },
        'the metrics snapshot names the edition and region this process serves');
      c.ok(metrics.snapshot().firing.includes('PAID_CEILING_HIGH'), `${brand}: four of five is 80%, so PAID_CEILING_HIGH is firing`);

      // The operator is emailed, and the email says whose budget it is.
      const sent = [];
      const notifier = createAlertNotifier({ env: { PRI_EDITION: id, PRI_ALERT_EMAIL: 'ops@example.org', PRI_ALERT_ENVIRONMENT: 'staging' }, registry: metrics, send: async m => { sent.push(m); }, releaseSha: () => 'abc1234' });
      await notifier.tick();
      const alert = sent.find(m => /PAID_CEILING_HIGH/.test(m.subject));
      c.ok(!!alert, `${brand}: a PAID_CEILING_HIGH email is sent`);
      c.eq(alert?.subject, `[Pri staging] FIRING PAID_CEILING_HIGH (warning) · ${brand}, region ${EDITIONS[id].region}`, `${brand}: its subject names the edition and region`);
      c.ok((alert?.text || '').includes(`Edition: ${id} (${brand}, region ${EDITIONS[id].region})`), `${brand}: and so does its body`);
    } finally {
      server.close();
    }
  }

  // The label never carries anything but a value from the edition table.
  const odd = alertEmailMessage({ kind: 'firing', ruleId: 'PAID_CEILING_HIGH', severity: 'warning', thresholds: { count: 1, minutes: 60 }, counts: {}, releaseSha: 'abc1234', environment: 'staging', at: 0,
    deployment: { edition: 'x<script>', brand: 'a b', region: 'not-a-region' } });
  c.ok(!/script|a b|not-a-region/.test(odd.subject + odd.text) && /Edition: unknown/.test(odd.text), 'an edition label that is not one from the table is written as unknown');
  const plain = alertEmailMessage({ kind: 'firing', ruleId: 'DB_CONNECTIVITY', severity: 'critical', thresholds: { count: 3, minutes: 5 }, counts: {}, releaseSha: 'abc1234', environment: 'staging', at: 0,
    deployment: deploymentLabel({ PRI_EDITION: 'priyabhata' }) });
  c.eq(plain.subject, '[Pri staging] FIRING DB_CONNECTIVITY (critical)', 'other alerts keep their subject');
  c.ok(plain.text.includes('Edition: priyabhata (Priyabhata, region IN)'), 'and gain the edition line in their body');

  // A refused reservation records no unit to refund.
  const env = { PRI_EDITION: 'prithagoras', PRI_HANDWRITING_API_KEY: 'k', PRI_PAID_CALLS_PER_HOUR: '1', PRI_PAID_CALLS_PER_DAY: '1' };
  db.prepare('DELETE FROM rate_limits').run();
  const first = await reservePaidCall(db, { env });
  const second = await reservePaidCall(db, { env });
  c.deq([first.verdict, first.edition, second.verdict?.code, second.units.length], [null, 'prithagoras', 'PAID_CAPACITY_REACHED', 0], 'a reservation carries its edition; a refused one holds nothing');
  await refundPaidCall(db, first);
  c.eq((await reservePaidCall(db, { env })).verdict, null, 'a refunded unit can be spent again');
  db.close?.();
}

// ── 7 · The operator's health view names the region's budget ────────────────
{
  const saved = Object.fromEntries(['PRI_HANDWRITING_API_KEY', 'PRI_PAID_CALLS_PER_HOUR', 'PRI_PAID_CALLS_PER_DAY'].map(k => [k, process.env[k]]));
  Object.assign(process.env, { PRI_HANDWRITING_API_KEY: 'sk-test', PRI_PAID_CALLS_PER_HOUR: '40', PRI_PAID_CALLS_PER_DAY: '400' });
  const detail = await operatorHealthDetail(null, { reachable: false, housekeeping: null });
  c.deq(detail.paidCeiling, { edition: 'prithagoras', region: 'AU', required: true, perHour: 40, perDay: 400, alertRatio: 0.8 }, 'the health detail says whose paid-call ceiling this is, and its numbers');
  c.ok(!JSON.stringify(detail).includes('sk-test'), 'and never the key');
  for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
}

// ── 8 · The model-path inventory names every module that spends ─────────────
{
  const { execFileSync } = await import('node:child_process');
  const { readFileSync } = await import('node:fs');
  const ROOT = join(import.meta.dirname, '..', '..');
  const spenders = execFileSync('git', ['-C', ROOT, 'grep', '-l', '-F', "from './spendCeiling.js'", '--', 'server/platform'], { encoding: 'utf8' })
    .split('\n').filter(Boolean)
    .filter(path => /import \{[^}]*\b(?:consumePaidCall|reservePaidCall)\b[^}]*\} from '\.\/spendCeiling\.js'/.test(readFileSync(join(ROOT, path), 'utf8')))
    .map(path => path.split('/').pop()).sort();
  c.ok(spenders.length >= 4, `the modules that spend from the ceiling are found (${spenders.join(', ')})`);
  const doc = readFileSync(join(ROOT, 'docs/operations/ai-budgets-per-region.md'), 'utf8');
  const inventory = doc.slice(doc.indexOf('## 5. Model-path inventory'), doc.indexOf('## 6.'));
  for (const module of spenders) c.ok(inventory.includes(`\`${module}\``), `the model-path inventory lists ${module}`);
  c.ok(/\*\*Not verified: where the provider processes any of this\.\*\*/.test(inventory), 'and says plainly that the provider\'s processing location is not verified');
}

// ── 9 · Over HTTP on a Prithagoras server: the Sydney day ────────────────────
const h = await startApp({ engine: requestedEngine() });
try {
  c.eq((await h.request('/v1/health')).data?.edition, 'prithagoras', 'the server is Prithagoras');
  const a = await registerAccount(h, { email: 'edition.day@example.test', deviceId: 'ipad-edition-day' });
  c.eq((await verifyEmail(h, a.account.id)).status, 200, 'a free student is verified');
  const issue = () => h.request('/v1/practice/issue', { method: 'POST', jar: a.jar, body: { generator: 'y8-equations', difficulty: 3, curriculum: 'nsw' } });
  // 23:00 AEDT on Sunday 4 October 2026, the 23-hour day.
  clockAt = Date.UTC(2026, 9, 4, 12, 0, 0);
  const counted = async key => {
    const row = await h.db.get('SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope=? AND key=?', [a.account.id, PRACTICE_DAILY_SCOPE, key]);
    return row ? Number(JSON.parse(row.response_json).issued) : 0;
  };
  c.deq([(await issue()).status, (await issue()).status], [201, 201], 'two questions are issued (PRI_FREE_PRACTICE_PER_DAY=2)');
  c.eq(await counted('2026-10-04'), 2, 'counted under the Sydney date');
  const third = await issue();
  c.deq([third.status, third.data?.error?.code, third.data?.error?.timeZone, third.data?.error?.resetAt], [402, 'FREE_CAP_REACHED', 'Australia/Sydney', Date.UTC(2026, 9, 4, 13, 0, 0)],
    'the third is refused until Sydney midnight (00:00 AEDT, 13:00 UTC)');
  c.ok(/midnight \(Australia\/Sydney\)/.test(third.data?.error?.message || ''), 'and the message names the calendar it counts in');
  clockAt = Date.UTC(2026, 9, 4, 12, 59, 59);
  c.eq((await issue()).status, 402, 'a second before Sydney midnight it is still refused');
  clockAt = Date.UTC(2026, 9, 4, 13, 0, 0);
  c.eq((await issue()).status, 201, 'at Sydney midnight a new day begins (in India it is still 18:30 on the 4th)');
  c.eq(await counted('2026-10-05'), 1, 'counted under the new Sydney date');
} finally {
  await h.close();
  Date.now = realNow;
  for (const [key, value] of Object.entries(before)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  rmSync(scratch, { recursive: true, force: true });
}

console.log(`engine: ${h.engine}`);
console.log(`EDITION AI BUDGETS (H7): PASS — ${c.count()}/${c.count()} checks — the practice day is the edition's own (Priyabhata identical to main over a year of instants; Sydney across both daylight-saving changes), the paid-call ceiling is required in every edition, refuses before the provider, refunds what was never sent and is counted and alerted under its edition and region.`);
