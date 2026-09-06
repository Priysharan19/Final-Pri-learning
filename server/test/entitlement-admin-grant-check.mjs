// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a support grant either happened or is refused
//
// The admin grant is the one path that hands out Premium without a payment, so
// its audit trail is the only record that it was legitimate. The grant used to
// be identified by actor and clock alone — `admin-<actor>-<now>` — which meant
// two grants in the same millisecond shared an id: a bulk grant loop, a script,
// two people in support. The billing ledger treated the second as a replay of
// the first, so the second student got no entitlement, the response still said
// 200, and the audit log recorded a grant that never happened.
//
// The clock is pinned here so that collision is not a matter of how fast the
// machine is: every grant below is issued in the same millisecond.
// ─────────────────────────────────────────────────────────────────────────────
import express from 'express';
import cookieParser from 'cookie-parser';
import { createPlatformDb } from '../platform/db.js';
import { ensureBillingSchema } from '../platform/billingSchema.js';
import { createEntitlementRouter, supportGrantEventId } from '../platform/entitlements.js';
import { csrfForSession, CSRF_COOKIE, SESSION_COOKIE, opaqueToken, sha256 } from '../platform/security.js';

let pass = 0;
const failures = [];
const ok = (condition, label) => { if (condition) pass++; else failures.push(label); };
const eq = (actual, expected, label) => ok(actual === expected, `${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);

const FROZEN = 1_800_000_000_000;
const realNow = Date.now;
const db = createPlatformDb(':memory:');
ensureBillingSchema(db);

function account(id, role = 'student') {
  db.prepare('INSERT INTO accounts(id,email,name,role,email_verified_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?)')
    .run(id, `${id}@example.test`, id, role, FROZEN, FROZEN, FROZEN);
  return id;
}

function session(accountId) {
  const raw = opaqueToken(32);
  db.prepare(`INSERT INTO account_sessions(id,account_id,token_hash,device_id,created_at,last_seen_at,expires_at)
    VALUES (?,?,?,?,?,?,?)`)
    .run(`ses_${accountId}`, accountId, sha256(raw), 'contract', FROZEN, FROZEN, FROZEN + 3_600_000);
  return { [SESSION_COOKIE]: raw, [CSRF_COOKIE]: csrfForSession(raw) };
}

const admin = account('acct_admin', 'admin');
const targets = [account('acct_alpha'), account('acct_beta'), account('acct_gamma')];
const cookies = session(admin);

// A fixed event id, so the replay branch can be reached at all now that a real
// grant id carries a random tail.
let fixedEventId = null;
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/v1/entitlements', createEntitlementRouter(db, {
  grantEventId: (context) => fixedEventId || supportGrantEventId(context)
}));
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

async function grant(accountId) {
  const response = await fetch(`${origin}/v1/entitlements/admin/grant`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-pri-csrf': cookies[CSRF_COOKIE],
      Cookie: Object.entries(cookies).map(([name, value]) => `${name}=${value}`).join('; ')
    },
    body: JSON.stringify({ accountId, durationMs: 30 * 24 * 60 * 60 * 1000 })
  });
  return { status: response.status, data: await response.json() };
}

try {
  // Every grant below happens in the same millisecond.
  Date.now = () => FROZEN;

  // ── 1 · Three grants in one millisecond are three grants ──────────────────
  for (const target of targets) {
    const result = await grant(target);
    eq(result.status, 200, `${target} is granted Premium`);
    eq(result.data?.replayed, false, `${target} is not mistaken for a replay`);
    eq(result.data?.snapshot?.plan, 'premium', `${target} receives a premium snapshot in the response`);
    const snapshot = db.prepare('SELECT plan,status,provider FROM entitlement_snapshots WHERE account_id=?').get(target);
    eq(snapshot?.plan, 'premium', `${target} holds a premium entitlement in the database`);
    eq(snapshot?.status, 'active', `${target} is active`);
  }
  const events = db.prepare("SELECT event_id,account_id FROM billing_events WHERE provider='admin'").all();
  eq(events.length, 3, 'the ledger holds one event per grant');
  eq(new Set(events.map(row => row.event_id)).size, 3, 'and the ids are distinct despite one clock reading');
  eq(new Set(events.map(row => row.account_id)).size, 3, 'each naming its own target');
  for (const target of targets) {
    ok(events.some(row => row.event_id.includes(target)), `the event id for ${target} names the account it granted`);
  }
  eq(db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action='entitlement.grant'").get().n, 3,
    'the audit log records exactly the grants that happened');

  // ── 2 · A genuine replay is refused, and is not audited ───────────────────
  fixedEventId = `admin-${admin}-replayed-${FROZEN}`;
  const fresh = account('acct_delta');
  const firstDelta = await grant(fresh);
  eq(firstDelta.status, 200, 'the first grant under a fixed id applies');
  const replayed = await grant('acct_alpha');
  eq(replayed.status, 409, 'a grant whose event was already applied is refused');
  eq(replayed.data.error.code, 'ENTITLEMENT_GRANT_REPLAYED', 'and says so');
  eq(db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action='entitlement.grant'").get().n, 4,
    'the refused grant is not written to the audit log as a grant');
  eq(db.prepare('SELECT plan FROM entitlement_snapshots WHERE account_id=?').get(fresh)?.plan, 'premium',
    'the grant that did apply is intact');

  // ── 3 · The id is unique per grant, not per millisecond ──────────────────
  const one = supportGrantEventId({ actorAccountId: admin, accountId: 'acct_alpha', now: FROZEN });
  const two = supportGrantEventId({ actorAccountId: admin, accountId: 'acct_alpha', now: FROZEN });
  ok(one !== two, 'two grants to the same account in the same millisecond still differ');
  ok(one.includes('acct_alpha') && one.includes(admin) && one.includes(String(FROZEN)),
    'the id still names the actor, the target and the moment');
} finally {
  Date.now = realNow;
  server.close();
  db.close();
}

console.log(failures.length
  ? `ENTITLEMENT ADMIN GRANT: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `ENTITLEMENT ADMIN GRANT: PASS — ${pass}/${pass} checks — grants in the same millisecond do not collide, a replay is refused rather than audited, and every audit row is a grant that happened.`);
process.exit(failures.length ? 1 : 0);
