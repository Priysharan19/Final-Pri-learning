// Pri Learning · two different billing events for one subscription, at once.
//
//   node server/test/billing-out-of-order-concurrency-check.mjs                   → SQLite
//   node server/test/billing-out-of-order-concurrency-check.mjs --engine=postgres → Postgres (with-postgres.mjs)
//
// A store delivers notifications out of order and in parallel: a renewal
// signed earlier can arrive at the same moment as a refund signed later. The
// entitlement must end on the NEWEST signed statement whichever transaction
// commits last — a refunded subscription must not come back to Premium
// because the renewal's transaction happened to finish second, and a renewal
// must not be undone by an older expiry. Each event applies exactly once.
//
// platform-concurrency-check proves ONE event id delivered twice at once.
// This proves DIFFERENT events of one subscription racing, which is guarded
// only by isolation: applyVerifiedEntitlement reads the subscription's
// ordering clock and writes it in one transaction, SERIALIZABLE on Postgres
// (a loser fails with 40001 and re-runs, then sees the newer clock). On
// Postgres the two events go through two separate pools, so the race is a
// real one between connections, as two webhook requests would be.
import './support/hermetic.mjs';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.PRI_AUTH_DELIVERY_KEY = '6b'.repeat(32);
const { requestedEngine, openTestStore } = await import('./support/engine.mjs');
const { applyVerifiedEntitlement } = await import('../platform/entitlements.js');

const engine = requestedEngine();
console.log(`engine: ${engine}`);
let count = 0;
const eq = (a, b, name) => { assert.deepEqual(a, b, name); count++; };
const ok = (cond, name) => { assert.ok(cond, name); count++; };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const test = await openTestStore(engine, { label: 'billing-order' });
const a = test.store;
let b = a;
if (engine === 'postgres') {
  const { createPostgresStore } = await import('../platform/store.js');
  b = await createPostgresStore(test.url);
}
const DAY = 86_400_000;
const T = Date.UTC(2026, 10, 7, 9, 0, 0);
const ROUNDS = Number(process.env.PRI_RACE_ROUNDS || 30);

try {
  const accountId = 'acct_billing_order';
  await a.run('INSERT INTO accounts(id,email,name,role,created_at,updated_at) VALUES (?,?,?,?,?,?)', [accountId, 'billing.order@example.test', 'Billing Order', 'student', T, T]);
  const subscriptionId = 'sub_OrderRace01';
  await a.run(`INSERT INTO billing_subscriptions(provider,provider_subscription_id,account_id,product_id,cadence,trial_claimed,created_at,updated_at)
    VALUES ('web',?,?,?,'monthly',0,?,?)`, [subscriptionId, accountId, 'plan_monthly', T, T]);

  // Each scenario: an older and a newer signed event of the same subscription.
  const scenarios = [
    { name: 'renewal (older) vs refund (newer)',
      older: { eventType: 'subscription.charged', plan: 'premium', status: 'active', currentPeriodEnd: T + 60 * DAY },
      newer: { eventType: 'refund.processed', plan: 'free', status: 'revoked', currentPeriodEnd: null },
      expect: { plan: 'free', status: 'revoked' } },
    { name: 'expiry (older) vs renewal (newer)',
      older: { eventType: 'subscription.halted', plan: 'free', status: 'expired', currentPeriodEnd: null },
      newer: { eventType: 'subscription.charged', plan: 'premium', status: 'active', currentPeriodEnd: T + 90 * DAY },
      expect: { plan: 'premium', status: 'active' } },
    { name: 'grace (older) vs revocation (newer)',
      older: { eventType: 'subscription.pending', plan: 'premium', status: 'grace', currentPeriodEnd: T + 30 * DAY, graceUntil: T + 37 * DAY },
      newer: { eventType: 'subscription.cancelled', plan: 'free', status: 'revoked', currentPeriodEnd: null },
      expect: { plan: 'free', status: 'revoked' } }
  ];

  const tally = { olderCommittedLast: 0, newerCommittedLast: 0 };
  let serial = 0;
  for (let round = 0; round < ROUNDS; round++) {
    const scenario = scenarios[round % scenarios.length];
    const base = T + round * 10_000;
    // Each round starts from a clean ordering clock and no snapshot.
    await a.run(`UPDATE billing_subscriptions SET last_effective_at=0,last_event_rank=0,last_event_id=NULL,state_plan=NULL,state_status=NULL,state_period_end=NULL,state_grace_until=NULL WHERE provider='web' AND provider_subscription_id=?`, [subscriptionId]);
    await a.run('DELETE FROM entitlement_snapshots WHERE account_id=?', [accountId]);
    const event = (spec, at, id) => ({
      verified: true, provider: 'web', accountId, providerSubscriptionId: subscriptionId, productId: 'plan_monthly',
      eventId: id, effectiveAt: at, eventRank: 1, now: base + 5_000, ...spec
    });
    const olderId = `evt-old-${++serial}`, newerId = `evt-new-${++serial}`;
    const older = event(scenario.older, base + 1_000, olderId);
    const newer = event(scenario.newer, base + 2_000, newerId);
    // Alternate which pool carries which event and which leaves first.
    const [first, second] = round % 2 === 0 ? [[a, older], [b, newer]] : [[a, newer], [b, older]];
    const finished = [];
    const run = ([store, ev], delay) => sleep(delay).then(() => applyVerifiedEntitlement(store, ev)).then(result => { finished.push(ev.eventId); return result; });
    const results = await Promise.all([run(first, 0), run(second, round % 3)]);
    if (finished[finished.length - 1] === olderId) tally.olderCommittedLast++; else tally.newerCommittedLast++;

    const snap = await a.get('SELECT plan,status FROM entitlement_snapshots WHERE account_id=?', [accountId]);
    const sub = await a.get(`SELECT last_effective_at,last_event_id,state_plan,state_status FROM billing_subscriptions WHERE provider='web' AND provider_subscription_id=?`, [subscriptionId]);
    eq({ plan: snap?.plan, status: snap?.status }, scenario.expect, `round ${round} (${scenario.name}; ${finished.join(' then ')} returned): the entitlement is the newest signed statement`);
    eq([Number(sub.last_effective_at), sub.last_event_id, sub.state_plan, sub.state_status], [base + 2_000, newerId, scenario.expect.plan, scenario.expect.status], `round ${round}: the subscription's clock and state are the newer event's`);
    const applied = await a.all(`SELECT event_id FROM billing_events WHERE provider='web' AND event_id IN (?,?) AND applied_at IS NOT NULL ORDER BY event_id`, [olderId, newerId]);
    eq(applied.length, 2, `round ${round}: both events are recorded as applied, once each`);
    eq(results.filter(r => r.replayed).length, 0, `round ${round}: neither is mistaken for a replay`);
    ok(results.some(r => r.stale) || finished[finished.length - 1] === newerId, `round ${round}: when the older event finishes last it is recognised as stale`);
  }
  console.log(`  completion order over ${ROUNDS} rounds: ${JSON.stringify(tally)}`);
  ok(tally.olderCommittedLast > 0, 'the older event finished last in some rounds (the dangerous order was exercised)');

  console.log(`BILLING OUT-OF-ORDER CONCURRENCY: PASS — ${count}/${count} checks — two different events of one subscription applied at once end on the newest signed statement whichever finishes last, each applied once, on ${engine}.`);
} finally {
  if (b !== a) await b.close();
  await test.close();
}
