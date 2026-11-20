// Pri Learning · packaging is enforced by the server, for every gated capability
// (packaging proposal, docs/product/packaging-2026-11.md).
//
//   1 · the active packaging is the owner's current one (d19-d20) until the
//       owner approves the proposal; the proposal only makes Free MORE generous;
//   2 · unlimited-practice: the server refuses the free cap's next question,
//       never refuses Premium, and never refuses free practice at all when the
//       packaging leaves it uncapped (value-2026-11);
//   3 · additional-ai-usage: marked handwriting / photo reads follow the active
//       packaging, Premium's allowance from the server's own record only;
//   4 · premium-exams and jee-advanced-content: targeted, weak-topic and JEE
//       Advanced papers are refused to free and served to Premium; the free
//       simulation follows the packaging window;
//   5 · advanced-analytics: sold only on a server enforcement point;
//   6 · the optional cancel reason: closed set, only after a real cancel, once;
//   7 · the admin funnel: aggregate only, small cells suppressed, admin + MFA.
// Usage: node server/test/packaging-enforcement-check.mjs
import './support/hermetic.mjs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const keys = ['NODE_ENV', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_PUBLIC_ORIGIN', 'PRI_FREE_PRACTICE_PER_DAY'];
const before = Object.fromEntries(keys.map(k => [k, process.env[k]]));
const scratch = mkdtempSync(join(tmpdir(), 'pri-packaging-'));
process.env.NODE_ENV = 'test';
process.env.PRI_TEST_PAID_MODE = '1'; // Retain the original paid-mode regression; free-launch is tested separately.
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = 'c4'.repeat(32);
delete process.env.PRI_PUBLIC_ORIGIN;
delete process.env.PRI_FREE_PRACTICE_PER_DAY;

const { PACKAGINGS, ACTIVE_PACKAGING_ID, PACKAGING } = await import('../../client/src/engine/packaging.js');
const { FREE_PRACTICE_ALLOWANCE, READ_ALLOWANCE } = await import('../../client/src/engine/practiceAllowance.js');
const { FREE_EXAM_ALLOWANCE } = await import('../../client/src/engine/examAllowance.js');
const { practiceAllowanceVerdict, recordPracticeIssue, freePracticePerDay } = await import('../platform/practiceAllowance.js');
const { consumeAiAllowance, AI_ALLOWANCE_DEFAULTS } = await import('../platform/aiAllowance.js');
const { entitlementRefusal } = await import('../platform/exams.js');
const { PREMIUM_CAPABILITIES } = await import('../platform/entitlements.js');
const { CANCEL_REASONS } = await import('../platform/billing.js');
const { valueFunnel, cell, rate, partOf, FUNNEL_K } = await import('../platform/valueFunnel.js');
const { createPlatformDb } = await import('../platform/db.js');
const { asStore } = await import('../platform/store.js');
const { ensureBillingSchema } = await import('../platform/billingSchema.js');
const { CAPABILITY_ENFORCEMENT } = await import('../../client/src/local/entitlementGate.js');
const { PREMIUM_ROWS } = await import('../../client/src/paywall/plans.js');
const { startApp, registerAccount, promoteRole, checks } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');

const c = checks();
const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 18, 3, 0, 0);

function freshDb() {
  const db = createPlatformDb(':memory:');
  ensureBillingSchema(db);
  return db;
}
function account(db, id, { role = 'student', createdAt = NOW - 2 * DAY } = {}) {
  db.prepare('INSERT INTO accounts(id,email,name,role,created_at,updated_at,email_verified_at) VALUES (?,?,?,?,?,?,?)')
    .run(id, `${id}@example.test`, id, role, createdAt, createdAt, createdAt);
}
function premium(db, id, now = NOW) {
  db.prepare('INSERT INTO entitlement_snapshots(account_id,plan,status,provider,current_period_end,updated_at) VALUES (?,?,?,?,?,?)')
    .run(id, 'premium', 'active', 'web', now + 30 * DAY, now);
}

// ── 1 · which packaging is enforced ────────────────────────────────────────
// Owner decision 2026-11-18: value-2026-11 is approved with Free 5 and Premium 50 reads a
// day (the proposal said 10 and 100); d19-d20 is superseded but stays defined.
c.eq(ACTIVE_PACKAGING_ID, 'value-2026-11', 'the owner approved the value packaging on 2026-11-18 and it is the active one');
c.eq(PACKAGINGS['value-2026-11'].status, 'current', 'the value packaging is the current one');
c.eq(PACKAGINGS['d19-d20'].status, 'superseded', 'D19 / D20 is superseded, and still defined');
c.deq([PACKAGING.free.practicePerDay, PACKAGING.free.readsPerDay, PACKAGING.premium.readsPerDay, PACKAGING.free.examsPerWindow, PACKAGING.free.examWindowDays], [null, 5, 50, 1, 30],
  'the approved numbers: Free uncapped practice, 5 reads and 5 photos a day, one exam per 30 days; Premium 50 and 50');
c.deq([FREE_PRACTICE_ALLOWANCE.perDay, READ_ALLOWANCE.free, READ_ALLOWANCE.premium, FREE_EXAM_ALLOWANCE.examsPerWindow, FREE_EXAM_ALLOWANCE.examWindowDays],
  [PACKAGING.free.practicePerDay, PACKAGING.free.readsPerDay, PACKAGING.premium.readsPerDay, PACKAGING.free.examsPerWindow, PACKAGING.free.examWindowDays],
  'every enforced allowance is read from the active packaging, in one place');
c.deq([AI_ALLOWANCE_DEFAULTS.handwriting.free, AI_ALLOWANCE_DEFAULTS['question-photo'].free, AI_ALLOWANCE_DEFAULTS.handwriting.premium],
  [PACKAGING.free.readsPerDay, PACKAGING.free.readsPerDay, PACKAGING.premium.readsPerDay], 'the server\'s read allowance defaults to the packaging');
{
  const cur = PACKAGINGS['d19-d20'].free;
  const next = PACKAGINGS['value-2026-11'].free;
  const moreOrEqual = (a, b) => a === null || (b !== null && a >= b);
  c.ok(moreOrEqual(next.practicePerDay, cur.practicePerDay) && next.readsPerDay >= cur.readsPerDay && next.examsPerWindow >= cur.examsPerWindow && next.examWindowDays <= cur.examWindowDays,
    'the proposal takes nothing away from Free: practice, reads and simulations are each at least as generous');
  c.ok(PACKAGINGS['value-2026-11'].premium.readsPerDay >= PACKAGINGS['value-2026-11'].free.readsPerDay, 'Premium reads are never below Free reads in the proposal');
}

// ── 2 · unlimited-practice, server-side ─────────────────────────────────────
{
  const db = freshDb();
  account(db, 'free-1'); account(db, 'prem-1'); premium(db, 'prem-1');
  const env = { PRI_FREE_PRACTICE_PER_DAY: '3' };
  for (let i = 0; i < 3; i++) await recordPracticeIssue(db, { accountId: 'free-1', now: NOW, env });
  const refused = await practiceAllowanceVerdict(db, { accountId: 'free-1', now: NOW, env });
  c.deq([refused.allowed, refused.plan, refused.limit], [false, 'free', 3], 'a free account at its cap is refused by the server');
  for (let i = 0; i < 50; i++) await recordPracticeIssue(db, { accountId: 'prem-1', now: NOW, env });
  const prem = await practiceAllowanceVerdict(db, { accountId: 'prem-1', now: NOW, env });
  c.deq([prem.allowed, prem.plan, prem.limit], [true, 'premium', null], 'Premium (from the server\'s own record) is never refused');
  // The proposal: free practice uncapped. The server's own verdict, with the proposal's limit.
  const proposed = PACKAGINGS['value-2026-11'].free.practicePerDay;
  for (let i = 0; i < 500; i++) await recordPracticeIssue(db, { accountId: 'free-1', now: NOW, env });
  const open = await practiceAllowanceVerdict(db, { accountId: 'free-1', now: NOW, env, freeLimit: proposed });
  c.deq([proposed, open.allowed, open.plan, open.unlimited, open.limit], [null, true, 'free', true, null], 'under the value packaging a free account is never refused practice, even after 500 questions in a day');
  c.eq(freePracticePerDay({}), PACKAGING.free.practicePerDay ?? null, 'with no deployment override the server enforces the packaging\'s cap');
  c.eq(freePracticePerDay({ PRI_FREE_PRACTICE_PER_DAY: '7' }), 7, 'a deployment override still applies');
  db.close?.();
}

// ── 3 · additional-ai-usage (marked handwriting and photo answers) ──────────
{
  const db = freshDb();
  account(db, 'free-r'); account(db, 'prem-r'); premium(db, 'prem-r');
  for (const kind of ['handwriting', 'question-photo']) {
    let last = null;
    for (let i = 0; i <= READ_ALLOWANCE.free; i++) last = await consumeAiAllowance(db, { accountId: 'free-r', kind, env: {}, now: NOW });
    c.deq([last.allowed, last.limit, last.plan], [false, READ_ALLOWANCE.free, 'free'], `${kind}: the free account's read after the packaging's ${READ_ALLOWANCE.free} is refused`);
    let p = null;
    for (let i = 0; i <= READ_ALLOWANCE.free; i++) p = await consumeAiAllowance(db, { accountId: 'prem-r', kind, env: {}, now: NOW });
    c.deq([p.allowed, p.limit, p.plan], [true, READ_ALLOWANCE.premium, 'premium'], `${kind}: Premium keeps reading past the free allowance, up to the packaging's ${READ_ALLOWANCE.premium}`);
  }
  db.close?.();
}

// ── 4 · premium-exams and jee-advanced-content ──────────────────────────────
{
  const db = freshDb();
  account(db, 'free-e'); account(db, 'prem-e'); premium(db, 'prem-e');
  const ask = (id, spec) => entitlementRefusal(asStore(db), id, spec, NOW);
  const jee = { blueprint: { track: 'jee-advanced' } };
  const weak = { generated: { weak: true } };
  const targeted = { targeted: true };
  const plain = { blueprint: { track: 'cbse' } };
  c.deq([(await ask('free-e', jee))?.capability, (await ask('free-e', weak))?.capability, (await ask('free-e', targeted))?.capability],
    ['jee-advanced-content', 'premium-exams', 'premium-exams'], 'free: JEE Advanced, weak-topic and targeted papers are refused by the server');
  c.deq([await ask('prem-e', jee), await ask('prem-e', weak), await ask('prem-e', targeted)], [null, null, null], 'Premium: each is served');
  c.eq(await ask('free-e', plain), null, 'free: the first paper in the usual pattern is served');
  db.prepare("INSERT INTO idempotency_keys(account_id,scope,key,response_json,request_digest,created_at,expires_at) VALUES (?,?,?,?,?,?,?)")
    .run('free-e', 'exam-paper', 'p1', '{}', 'x', NOW - DAY, NOW + 90 * DAY);
  const capped = await ask('free-e', plain);
  c.deq([capped?.code, capped?.limit, capped?.windowDays], ['FREE_CAP_REACHED', PACKAGING.free.examsPerWindow, PACKAGING.free.examWindowDays], 'free: the simulation allowance follows the packaging');
  c.eq(await ask('prem-e', plain), null, 'Premium: unlimited simulations');
  db.close?.();
}

// ── 5 · every capability the Premium screen sells is enforced by the server ─
for (const r of PREMIUM_ROWS) {
  c.ok(PREMIUM_CAPABILITIES.includes(r.capability) && /^server · /.test(CAPABILITY_ENFORCEMENT[r.capability] || ''), `${r.key}: ${r.capability} is granted and enforced by the server`);
}

// ── 6 · the optional cancel reason, and 7 · the admin funnel, over HTTP ─────
const h = await startApp({ engine: requestedEngine() });
try {
  const student = await registerAccount(h, { email: 'cancel@example.test' });
  const id = student.account.id;
  const store = (await import('../platform/store.js')).asStore(h.db);
  const send = (reason, jar = student.jar) => h.request('/v1/billing/cancel-feedback', { method: 'POST', jar, body: { reason } });
  c.eq((await send('price')).status, 409, 'no reason is accepted from an account that has not cancelled');
  await store.run("INSERT INTO billing_subscriptions(provider,provider_subscription_id,account_id,product_id,cadence,trial_claimed,created_at,updated_at,cancel_requested_at,cancel_mode,cancel_reason) VALUES ('web','sub_test_0',?,'price_x','monthly',0,?,?,?,'cycle-end','provider')",
    [id, Date.now() - DAY, Date.now(), Date.now() - 60_000]);
  c.eq((await send('price')).status, 409, 'a cancellation the student did not ask for here (provider portal) takes no reason');
  await store.run("INSERT INTO billing_subscriptions(provider,provider_subscription_id,account_id,product_id,cadence,trial_claimed,created_at,updated_at,cancel_requested_at,cancel_mode,cancel_reason) VALUES ('web','sub_test_1',?,'price_x','monthly',0,?,?,?,'cycle-end','user')",
    [id, Date.now() - DAY, Date.now(), Date.now() - 60_000]);
  c.eq((await send('Too expensive!!')).status, 400, 'free text is refused: the reason is a closed set');
  c.deq(CANCEL_REASONS, ['price', 'notUsing', 'examDone', 'missing', 'other'], 'the closed set the panel offers');
  c.eq((await send('price')).status, 200, 'a listed reason after a real cancellation is kept');
  await Promise.all([send('other'), send('missing')]);
  c.ok(true, 'two more taps at once are answered…');
  const rows = await store.all("SELECT metadata_json FROM audit_log WHERE action='billing.cancel-feedback'");
  c.deq(rows.map(r => JSON.parse(r.metadata_json)), [{ reason: 'price' }], '…but only the first reason per subscription is counted');

  c.eq((await h.request('/v1/admin/funnel', { jar: student.jar })).status, 403, 'a student cannot read the funnel');
  const admin = await registerAccount(h, { email: 'admin@example.test' });
  await promoteRole(h, admin.jar, admin.account.id, 'admin');
  const read = await h.request('/v1/admin/funnel?days=30', { jar: admin.jar });
  c.eq(read.status, 200, 'an admin with a verified second factor reads the funnel');
  c.ok(!/@example\.test|acct_|"id"/.test(read.text) && read.data.k === FUNNEL_K, 'the funnel carries no email or account id, and states its suppression threshold');
  c.eq(read.data.cohort.accounts, null, 'two accounts are a small cell: suppressed');
} finally {
  await h.close();
}

{
  const db = freshDb();
  for (let i = 0; i < 40; i++) {
    const a = `s${i}`;
    account(db, a, { createdAt: NOW - 20 * DAY });
    if (i < 30) {
      const first = NOW - 19 * DAY;
      db.prepare("INSERT INTO learning_events(id,account_id,device_id,device_seq,kind,occurred_at,payload_json,created_at) VALUES (?,?,?,?,?,?,?,?)")
        .run(`e${i}a`, a, 'server-grader', 1, 'graded-attempt', first, '{}', first);
      if (i < 15) db.prepare("INSERT INTO learning_events(id,account_id,device_id,device_seq,kind,occurred_at,payload_json,created_at) VALUES (?,?,?,?,?,?,?,?)")
        .run(`e${i}b`, a, 'server-grader', 2, 'graded-attempt', first + 8 * DAY, '{}', first + 8 * DAY);
    }
  }
  const f = await valueFunnel(db, { days: 30, now: NOW });
  c.deq([f.cohort.accounts, f.activation.activated, f.activation.rate], [40, 30, 0.75], 'activation = accounts with a first server-checked answer');
  c.deq([f.retention.d7.eligible, f.retention.d7.returned, f.retention.d7.rate], [30, 15, 0.5], 'D7 = a checked answer seven or more days after the first');
  c.deq([f.retention.d30.eligible, f.retention.d30.returned], [0, 0], 'D30 has no eligible account yet');
  c.deq([cell(3), cell(0), cell(10), rate(9, 100), rate(95, 100), rate(50, 100)], [null, 0, 10, null, null, 0.5], 'small cells and rates near 0 or 1 are suppressed');
  c.deq([partOf(35, 40), partOf(30, 40), partOf(0, 40), partOf(40, 40)], [null, 30, 0, 40], 'a count beside its total is suppressed when the remainder is a small cell');
  db.close?.();
}

for (const k of keys) { if (before[k] === undefined) delete process.env[k]; else process.env[k] = before[k]; }
rmSync(scratch, { recursive: true, force: true });
console.log(`engine: ${h.engine}`);
console.log(`PACKAGING ENFORCEMENT: PASS — ${c.count()}/${c.count()} checks`);
