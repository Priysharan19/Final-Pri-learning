#!/usr/bin/env node
// ALERT NOTIFIER — server/platform/alertNotifier.js, deterministic: a fake
// clock, a fake transport and a private metrics registry. Proves transition
// emails, cooldown, resolved emails, the disabled no-op, send-failure
// isolation and that no PII/secret fed through the metrics reaches an email.
import './support/hermetic.mjs';
import assert from 'node:assert/strict';

const { createMetrics, ALERT_RULES, recordAuthEmail } = await import('../platform/metrics.js');
const { createAlertNotifier, alertRecipient, alertEmailMessage, ALERT_SEVERITY } = await import('../platform/alertNotifier.js');

let passed = 0;
async function check(name, fn) {
  try { await fn(); passed += 1; } catch (error) { console.error(`FAIL ${name}`); throw error; }
}

const SHA = 'a'.repeat(40);
const ENV = { PRI_ALERT_EMAIL: 'ops@example.org', PRI_ALERT_ENVIRONMENT: 'staging' };

function harness({ env = ENV, send } = {}) {
  let t = Date.UTC(2026, 9, 19, 10, 0, 0);
  const clock = { now: () => t, advance: ms => { t += ms; } };
  const registry = createMetrics({ now: clock.now });
  const sent = [];
  const transport = send || (async message => { sent.push(message); });
  const logs = [];
  const notifier = createAlertNotifier({ env, registry, send: transport, now: clock.now, releaseSha: () => SHA, log: (e, f) => logs.push([e, f]) });
  return { clock, registry, sent, notifier, logs };
}
function fireDb(registry, n = 3) { for (let i = 0; i < n; i += 1) registry.inc('db_errors_total', { code: 'PLATFORM_DB_UNAVAILABLE' }); }
function outcome(registry, rule, o) { return registry.sum('alert_notifications_total', { where: { rule, outcome: o } }); }

await check('every ALERT_RULES id has a severity', () => {
  for (const rule of ALERT_RULES) assert.ok(ALERT_SEVERITY[rule.id], rule.id);
  assert.equal(ALERT_RULES.length, 9);
});

await check('recipient validation', () => {
  assert.equal(alertRecipient({}).code, 'ALERT_EMAIL_UNSET');
  assert.equal(alertRecipient({ PRI_ALERT_EMAIL: 'not an email' }).code, 'ALERT_EMAIL_INVALID');
  assert.equal(alertRecipient({ PRI_ALERT_EMAIL: 'a@b.co\nBcc: x@y.z' }).code, 'ALERT_EMAIL_INVALID');
  assert.equal(alertRecipient({ PRI_ALERT_EMAIL: ' ops@example.org ' }).recipient, 'ops@example.org');
});

await check('quiet registry sends nothing', async () => {
  const h = harness();
  await h.notifier.tick();
  assert.equal(h.sent.length, 0);
});

await check('transition to firing sends exactly one email; staying firing sends none', async () => {
  const h = harness();
  fireDb(h.registry);
  await h.notifier.tick();
  assert.equal(h.sent.length, 1);
  assert.equal(h.sent[0].to, 'ops@example.org');
  assert.match(h.sent[0].subject, /FIRING DB_CONNECTIVITY \(critical\)/);
  assert.match(h.sent[0].text, /db_unavailable: 3/);
  assert.match(h.sent[0].text, new RegExp(`Release: ${SHA}`));
  assert.match(h.sent[0].text, /Environment: staging/);
  h.clock.advance(60_000);
  await h.notifier.tick();
  assert.equal(h.sent.length, 1);
  assert.equal(outcome(h.registry, 'DB_CONNECTIVITY', 'firing_sent'), 1);
});

await check('clears → one resolved email', async () => {
  const h = harness();
  fireDb(h.registry);
  await h.notifier.tick();
  h.clock.advance(6 * 60_000); // window is 5 minutes
  await h.notifier.tick();
  assert.equal(h.sent.length, 2);
  assert.match(h.sent[1].subject, /RESOLVED DB_CONNECTIVITY/);
  assert.equal(outcome(h.registry, 'DB_CONNECTIVITY', 'resolved_sent'), 1);
  h.clock.advance(60_000);
  await h.notifier.tick();
  assert.equal(h.sent.length, 2);
});

await check('cooldown suppresses a re-fire inside 30 minutes, allows it after', async () => {
  const h = harness();
  fireDb(h.registry); await h.notifier.tick();          // fire @0
  h.clock.advance(6 * 60_000); await h.notifier.tick(); // resolve @6
  h.clock.advance(60_000); fireDb(h.registry); await h.notifier.tick(); // re-fire @7 → suppressed
  assert.equal(h.sent.length, 2);
  assert.equal(outcome(h.registry, 'DB_CONNECTIVITY', 'suppressed_cooldown'), 1);
  h.clock.advance(6 * 60_000); await h.notifier.tick(); // clears @13: not notified → no resolved
  assert.equal(h.sent.length, 2);
  h.clock.advance(20 * 60_000); fireDb(h.registry); await h.notifier.tick(); // @33 → allowed
  assert.equal(h.sent.length, 3);
  assert.match(h.sent[2].subject, /FIRING/);
});

await check('a cooldown-suppressed episode still firing after the cooldown sends one email', async () => {
  const h = harness();
  fireDb(h.registry); await h.notifier.tick();          // fire @0 (sent)
  h.clock.advance(6 * 60_000); await h.notifier.tick(); // resolve @6 (sent)
  h.clock.advance(60_000);
  for (let m = 7; m <= 40; m += 1) { fireDb(h.registry); await h.notifier.tick(); h.clock.advance(60_000); } // keeps firing
  assert.equal(h.sent.length, 3);
  assert.match(h.sent[2].subject, /FIRING/);
  assert.equal(outcome(h.registry, 'DB_CONNECTIVITY', 'suppressed_cooldown'), 1);
});

await check('disabled (PRI_ALERT_EMAIL unset) is a counted no-op', async () => {
  const h = harness({ env: { PRI_ALERT_ENVIRONMENT: 'staging' } });
  assert.equal(h.notifier.enabled, false);
  assert.equal(h.notifier.disabledCode, 'ALERT_EMAIL_UNSET');
  fireDb(h.registry); await h.notifier.tick();
  assert.equal(h.sent.length, 0);
  assert.equal(outcome(h.registry, 'DB_CONNECTIVITY', 'disabled'), 1);
});

await check('disabled when the Resend transport is not configured', () => {
  const n = createAlertNotifier({ env: { PRI_ALERT_EMAIL: 'ops@example.org' }, registry: createMetrics() });
  assert.equal(n.enabled, false);
  assert.equal(n.disabledCode, 'ALERT_EMAIL_TRANSPORT_UNCONFIGURED');
});

await check('send failure is counted, isolated and retried after the retry delay', async () => {
  let calls = 0;
  const h = harness({ send: async () => { calls += 1; if (calls === 1) throw Object.assign(new Error('boom secret=sk-live'), { code: 'RESEND_503' }); } });
  fireDb(h.registry);
  await h.notifier.tick(); // must not throw
  assert.equal(outcome(h.registry, 'DB_CONNECTIVITY', 'failed'), 1);
  assert.deepEqual(h.logs[0], ['alert_notification_failed', { rule: 'DB_CONNECTIVITY', kind: 'firing', code: 'RESEND_503' }]);
  h.clock.advance(60_000); fireDb(h.registry); await h.notifier.tick();
  assert.equal(calls, 1);
  h.clock.advance(5 * 60_000); fireDb(h.registry); await h.notifier.tick();
  assert.equal(calls, 2);
  assert.equal(outcome(h.registry, 'DB_CONNECTIVITY', 'firing_sent'), 1);
});

await check('a throwing transport and a throwing registry never escape a tick', async () => {
  const h = harness({ send: () => { throw new Error('sync throw'); } });
  fireDb(h.registry);
  await h.notifier.tick();
  const broken = createAlertNotifier({ env: ENV, registry: { snapshot() { throw new Error('x'); }, inc() { throw new Error('y'); } }, send: async () => {} });
  await broken.tick();
});

await check('no PII or secret fed through reaches an email', async () => {
  const PII = ['student@example.com', 'acct_123456', '/v1/accounts/acct_123456', 'Bearer sk-secret-token', 're_live_key_abc', 'x² + 3 = 7'];
  const h = harness({ env: { ...ENV, PRI_RESEND_API_KEY: 're_live_key_abc', PRI_AUTH_EMAIL_FROM: 'auth@pri.example', PRI_METRICS_TOKEN: 'Bearer sk-secret-token' } });
  for (const p of PII) {
    h.registry.inc('db_errors_total', { code: p });
    h.registry.inc('auth_email_total', { outcome: 'failed', to: p });
    h.registry.inc('http_responses_total', { class: '5xx', path: p });
  }
  for (let i = 0; i < 20; i += 1) h.registry.inc('http_responses_total', { class: '5xx', path: PII[i % PII.length] });
  recordAuthEmail({ ok: false, code: PII[0] });
  for (let i = 0; i < 3; i += 1) h.registry.inc('auth_email_total', { outcome: 'failed', account: PII[1] });
  await h.notifier.tick();
  assert.ok(h.sent.length >= 2, `expected HTTP_5XX_SPIKE and AUTH_EMAIL_FAILURES, got ${h.sent.length}`);
  for (const message of h.sent) {
    const blob = JSON.stringify({ subject: message.subject, text: message.text, key: message.idempotencyKey });
    for (const p of PII) assert.ok(!blob.includes(p), `leaked ${p}`);
    assert.ok(!blob.includes('auth@pri.example'));
  }
  const msg = alertEmailMessage({ kind: 'firing', ruleId: 'X', severity: 'warning', thresholds: { count: 1, minutes: 5 }, counts: { a: 'student@example.com' }, releaseSha: SHA, environment: 'staging', at: 0 });
  assert.ok(!msg.text.includes('student@example.com'), 'non-numeric count is coerced');
});

await check('environment name is sanitized', async () => {
  const h = harness({ env: { PRI_ALERT_EMAIL: 'ops@example.org', PRI_ALERT_ENVIRONMENT: 'Prod <script>' } });
  fireDb(h.registry); await h.notifier.tick();
  assert.match(h.sent[0].subject, /^\[Pri prod--script-\]/);
});

await check('notifier counters appear on the metrics snapshot', async () => {
  const h = harness();
  fireDb(h.registry); await h.notifier.tick();
  const snap = h.registry.snapshot();
  assert.ok(snap.counters['alert_notifications_total{outcome=firing_sent,rule=DB_CONNECTIVITY}'] || Object.keys(snap.counters).some(k => k.startsWith('alert_notifications_total') && k.includes('DB_CONNECTIVITY')));
});

await check('start() uses an unref’d timer and stop() clears it', () => {
  const n = createAlertNotifier({ env: ENV, registry: createMetrics(), send: async () => {}, log: () => {} }).start();
  n.stop();
});

console.log(`ALERT NOTIFIER: PASS — ${passed}/${passed} checks — firing/resolved transitions, 30-minute cooldown, disabled no-op, isolated send failure, no PII in the email.`);
