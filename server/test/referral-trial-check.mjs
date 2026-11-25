// Pri Learning · the referral-unlocked 7-day trial (server/platform/referral.js)
//
//   1 · a trial is unlocked only by a VERIFIED, NEW account claiming a real code;
//   2 · both people get 7 days, once per account ever, never stacking with any
//       other trial;
//   3 · no self-referral: own code, the same mailbox (+tags, Gmail dots), the
//       same device; the inviter's credits are capped; the claim is rate-limited;
//   4 · expiry: back to Free by itself at day 7, with no subscription, payment
//       or charge anywhere;
//   5 · under 15s: a child whose guardian has not approved can neither share
//       nor claim;
//   6 · store apps: offered nothing and refused the claim (web only);
//   7 · edition isolation: a code from one deployment's database means nothing
//       in another's;
//   8 · only who invited whom is stored — no friend contact data.
// Usage: node server/test/referral-trial-check.mjs
import './support/hermetic.mjs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const keys = ['NODE_ENV', 'PRI_PLATFORM_DB', 'PRI_AUTH_DELIVERY_KEY', 'PRI_PUBLIC_ORIGIN'];
const before = Object.fromEntries(keys.map(k => [k, process.env[k]]));
const scratch = mkdtempSync(join(tmpdir(), 'pri-referral-'));
process.env.NODE_ENV = 'test';
process.env.PRI_TEST_PAID_MODE = '1'; // Retain the original paid-mode regression; free-launch is tested separately.
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = 'd5'.repeat(32);
delete process.env.PRI_PUBLIC_ORIGIN;

const { startApp, verifyEmail, checks } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const { valueFunnel } = await import('../platform/valueFunnel.js');
const { asStore } = await import('../platform/store.js');
const { claimReferral, referralTrialState, mailbox, REFERRAL, CODE } = await import('../platform/referral.js');
const { serverEntitlementCapabilities } = await import('../platform/entitlements.js');

const c = checks();
const DAY = 86_400_000;
const NATIVE = { 'X-Pri-Client': 'ios-native-v1' };

const ENGINE = requestedEngine();
const h = await startApp({ engine: ENGINE });
const store = asStore(h.db);
let serial = 0;
const fresh = () => store.run('DELETE FROM rate_limits');
async function adult(label, { deviceId = `dev-${label}-${++serial}`, email = `${label}-${serial}@example.test`, verify = true } = {}) {
  await fresh();
  const jar = {};
  const r = await h.request('/v1/account/register', { method: 'POST', jar, body: { name: label, email, password: 'correct-horse-battery', deviceId, isAdult: true } });
  if (r.status !== 201) throw new Error(`register ${label}: ${r.status} ${r.text}`);
  if (verify) await verifyEmail(h, r.data.account.id);
  return { id: r.data.account.id, jar, email };
}
async function child(label) {
  await fresh();
  const jar = {};
  const r = await h.request('/v1/account/register', { method: 'POST', jar, body: {
    name: label, email: `${label}-${++serial}@child.example`, password: 'correct-horse-battery', deviceId: `kid-${label}-${serial}`,
    isAdult: false, year: '8', guardianName: 'A Parent', guardianEmail: `parent-${serial}@home.example` } });
  if (r.status !== 201) throw new Error(`register child: ${r.status} ${r.text}`);
  await verifyEmail(h, r.data.account.id);
  return { id: r.data.account.id, jar };
}
const codeOf = async who => (await h.request('/v1/referral', { jar: who.jar })).data;
const claim = (who, code, headers) => { return fresh().then(() => h.request('/v1/referral/claim', { method: 'POST', jar: who.jar, body: { code }, headers })); };
const snapshot = id => store.get('SELECT plan,status,provider,current_period_end,grace_until FROM entitlement_snapshots WHERE account_id=?', [id]);
const premiumAt = async (id, now) => serverEntitlementCapabilities(await snapshot(id), now).length > 0;
let issuedHere = null;

try {
  // ── 1 · only a verified, new account with a real code ─────────────────────
  const ana = await adult('ana');
  const offer = await codeOf(ana);
  c.ok(offer.available === true && CODE.test(offer.code) && offer.trialDays === 7, 'an admitted adult on the web gets a personal invite code');
  c.eq((await codeOf(ana)).code, offer.code, 'and always the same one');
  issuedHere = offer.code;
  const unverified = await adult('ben', { verify: false });
  c.eq((await claim(unverified, offer.code)).status, 403, 'an account that has not verified its email cannot claim');
  c.ok(!await premiumAt(unverified.id, Date.now()), 'and has no Premium');
  const cara = await adult('cara');
  c.eq((await claim(cara, 'NOTACODE00')).status, 400, 'a malformed code is refused');
  c.eq((await claim(cara, 'ABCDEFGHJK')).status, 404, 'an unknown code is refused');
  const old = await adult('old');
  await store.run('UPDATE accounts SET created_at=? WHERE id=?', [Date.now() - 30 * DAY, old.id]);
  c.eq((await claim(old, offer.code)).data?.error?.code, 'REFERRAL_NOT_NEW_ACCOUNT', 'an existing account cannot claim: the friend must have joined through the link');

  const ok = await claim(cara, offer.code);
  c.eq(ok.status, 200, 'a verified new account claims a real code');
  c.ok(ok.data.granted === true && Math.abs(ok.data.endsAt - (Date.now() + 7 * DAY)) < 60_000, 'the friend gets 7 days of Premium');
  const caraSnap = await snapshot(cara.id);
  c.deq([caraSnap.plan, caraSnap.status, caraSnap.provider], ['premium', 'trialing', 'admin'], 'as a server-side trialing entitlement');
  c.ok(await premiumAt(cara.id, Date.now()) && await premiumAt(ana.id, Date.now()), 'and so does the inviter, who had never had a trial');

  // ── 2 · once per account, ever ─────────────────────────────────────────────
  c.eq((await claim(cara, offer.code)).data?.error?.code, 'REFERRAL_ALREADY_USED', 'a friend claims once');
  const dan = await adult('dan');
  const second = await claim(dan, offer.code);
  c.ok(second.status === 200 && second.data.granted === true, 'a second friend still gets their own trial');
  const anaState = await referralTrialState(store, ana.id);
  c.ok(anaState.trialUsed && anaState.active, 'the inviter keeps the one trial they had: no second, no extension');
  const anaGrants = Number((await store.get("SELECT COUNT(*) AS n FROM entitlement_support_grants WHERE account_id=? AND product_id='referral-trial'", [ana.id])).n);
  c.eq(anaGrants, 1, 'exactly one trial grant for the inviter');
  const evie = await adult('evie');
  await store.run("INSERT INTO billing_trial_claims(account_id,provider,provider_subscription_id,claimed_at) VALUES (?,'web','sub_prior',?)", [evie.id, Date.now()]);
  const evieClaim = await claim(evie, (await codeOf(dan)).code);
  c.ok(evieClaim.status === 200 && evieClaim.data.granted === false && !await premiumAt(evie.id, Date.now()), 'an account that already had a trial (a Stripe trial) gets no second one');

  // ── 3 · no self-referral; capped credits ──────────────────────────────────
  c.eq((await claim(ana, offer.code)).data?.error?.code, 'REFERRAL_SELF', 'one\'s own code is refused');
  const gmailA = await adult('gmailA', { email: 'first.last@gmail.com' });
  const gmailB = await adult('gmailB', { email: 'FirstLast+pri@googlemail.com' });
  c.eq((await claim(gmailB, (await codeOf(gmailA)).code)).data?.error?.code, 'REFERRAL_SELF', 'the same mailbox under a +tag and Gmail dots is the same person');
  c.deq([mailbox('First.Last+x@GoogleMail.com'), mailbox('a.b+c@example.test')], ['firstlast@gmail.com', 'a.b@example.test'], 'mailbox: +tags dropped everywhere, dots only on Gmail');
  const shared = await adult('shared', { deviceId: 'family-ipad' });
  const sharedTwin = await adult('sharedTwin', { deviceId: 'family-ipad' });
  c.eq((await claim(sharedTwin, (await codeOf(shared)).code)).data?.error?.code, 'REFERRAL_SELF', 'an account made on the same device cannot claim');
  const busy = await adult('busy');
  const busyCode = (await codeOf(busy)).code;
  for (let i = 0; i < REFERRAL.inviterCreditsPer30Days; i++) {
    const f = await adult(`f${i}`);
    c.eq((await claim(f, busyCode)).status, 200, `friend ${i + 1} of ${REFERRAL.inviterCreditsPer30Days} is credited`);
  }
  const over = await adult('over');
  c.eq((await claim(over, busyCode)).data?.error?.code, 'REFERRAL_LIMIT', 'past the cap in 30 days an inviter\'s code credits nobody');
  {
    const spammer = await adult('spam');
    let last = null;
    for (let i = 0; i < 6; i++) last = await h.request('/v1/referral/claim', { method: 'POST', jar: spammer.jar, body: { code: 'ABCDEFGHJK' } });
    c.eq(last.status, 429, 'the claim route is rate-limited per account');
  }

  // ── 3b · review fixes: one trial per inbox, races, the 'web' stand-in device ─
  {
    const i1 = await adult('inboxInviter1');
    const i2 = await adult('inboxInviter2');
    const p1 = await adult('p1', { email: 'pat+one@example.test' });
    c.eq((await claim(p1, (await codeOf(i1)).code)).status, 200, 'pat+one claims a trial');
    const p2 = await adult('p2', { email: 'pat+two@example.test' });
    c.eq((await claim(p2, (await codeOf(i2)).code)).data?.error?.code, 'REFERRAL_ALREADY_USED', 'pat+two, the same inbox, gets no second invitation trial');
    const q1 = await adult('q1', { email: 'quinn+one@example.test' });
    const qf1 = await adult('qf1');
    c.eq((await claim(qf1, (await codeOf(q1)).code)).status, 200, 'quinn+one earns an inviter trial');
    const q2 = await adult('q2', { email: 'quinn+two@example.test' });
    const qf2 = await adult('qf2');
    await claim(qf2, (await codeOf(q2)).code);
    c.ok(!await premiumAt(q2.id, Date.now()), 'quinn+two, the same inbox, earns no second inviter trial');
    const late = await adult('late');
    await store.run('UPDATE accounts SET created_at=? WHERE id=?', [Date.now() - 20 * DAY, late.id]);
    await store.run("INSERT INTO guardian_consents(account_id,guardian_name,guardian_email,notice_version,requested_at,confirmed_at,method) VALUES (?,?,?,?,?,?,?)", [late.id, 'P', 'p@home.example', 'v1', Date.now() - 20 * DAY, Date.now() - DAY, 'email-link']);
    c.eq((await claim(late, (await codeOf(i1)).code)).status, 200, 'a child approved by a guardian in the last 7 days still counts as new');
    const racer = await adult('racer');
    const [ra, rb] = await Promise.all([
      h.request('/v1/referral/claim', { method: 'POST', jar: racer.jar, body: { code: (await codeOf(i1)).code } }),
      h.request('/v1/referral/claim', { method: 'POST', jar: racer.jar, body: { code: (await codeOf(i2)).code } })
    ]);
    c.eq([ra.status, rb.status].filter(x => x === 200).length, 1, 'two simultaneous claims by one friend: exactly one succeeds');
    c.eq(Number((await store.get("SELECT COUNT(*) AS n FROM audit_log WHERE action='referral.joined' AND actor_account_id=?", [racer.id])).n), 1, 'and one who-invited-whom row is kept');
    const w1 = await adult('webA', { deviceId: 'web' });
    const w2 = await adult('webB', { deviceId: 'web' });
    c.eq((await claim(w2, (await codeOf(w1)).code)).status, 200, 'the server\'s "web" stand-in is not a shared device');
    const f = await valueFunnel(store, { days: 30 });
    c.ok('referralTrials' in f && f.trial.started !== undefined, 'the funnel counts invitation trials apart from card trials');
  }

  // ── 4 · back to Free at day 7, with nothing charged ───────────────────────
  {
    const t0 = Date.now();
    const x = await adult('expiryInviter');
    const y = await adult('expiryFriend');
    const r = await claimReferral(store, { inviteeId: y.id, code: (await codeOf(x)).code, now: t0 });
    c.eq(r.status, 200, 'a claim at t0');
    c.ok(await premiumAt(y.id, t0 + 7 * DAY - 1000), 'Premium until the last second of day 7');
    c.ok(!await premiumAt(y.id, t0 + 7 * DAY + 1000) && !await premiumAt(x.id, t0 + 7 * DAY + 1000), 'and Free for both after it, by itself');
    const after = await referralTrialState(store, y.id, t0 + 7 * DAY + 1000);
    c.ok(after.ended && !after.active, 'the trial reads as ended');
    const remind = await referralTrialState(store, y.id, t0 + 5 * DAY + 1000);
    c.ok(remind.remind && !(await referralTrialState(store, y.id, t0 + DAY)).remind, 'the reminder is due from day 5, not before');
    const money = Number((await store.get('SELECT (SELECT COUNT(*) FROM billing_subscriptions WHERE account_id IN (?,?)) + (SELECT COUNT(*) FROM billing_payments WHERE account_id IN (?,?)) AS n', [x.id, y.id, x.id, y.id])).n);
    c.eq(money, 0, 'no subscription and no payment exists for either: nothing can be charged or converted');
  }

  // ── 5 · under 15s ──────────────────────────────────────────────────────────
  {
    const kid = await child('kid');
    const read = await h.request('/v1/referral', { jar: kid.jar });
    c.ok(read.status === 403 && /GUARDIAN/.test(read.data?.error?.code || ''), 'a child awaiting a guardian\'s approval is offered no invite');
    const kidClaim = await claim(kid, offer.code);
    c.ok(kidClaim.status === 403 && /GUARDIAN/.test(kidClaim.data?.error?.code || ''), 'and cannot claim one');
    c.ok(!await premiumAt(kid.id, Date.now()), 'and has no Premium');
  }

  // ── 6 · store apps: web only ──────────────────────────────────────────────
  {
    const app = await h.request('/v1/referral', { jar: ana.jar, headers: NATIVE });
    c.ok(app.status === 200 && app.data.available === false && !('code' in app.data) && app.data.trial?.active === true, 'a store app is offered nothing about the referral, only its own trial dates');
    const appFriend = await adult('appFriend');
    const refused = await claim(appFriend, offer.code, NATIVE);
    c.ok([409, 403].includes(refused.status) && !await premiumAt(appFriend.id, Date.now()), 'a claim from a store app is refused');
  }

  // ── 8 · stored: who invited whom, nothing else ───────────────────────────
  {
    const rows = await store.all("SELECT actor_account_id, target_kind, target_id, metadata_json FROM audit_log WHERE action IN ('referral.code','referral.joined')");
    c.ok(rows.every(r => r.metadata_json === '{}'), 'referral rows carry no metadata at all');
    const joined = rows.filter(r => r.target_kind === 'account');
    c.ok(joined.some(r => r.actor_account_id === cara.id && r.target_id === ana.id), 'the friend → inviter link is kept');
    c.ok(!JSON.stringify(rows).includes('@'), 'no email (or any contact detail) is stored with a referral');
  }
} finally {
  await h.close();
}

// ── 7 · edition isolation: another deployment's database knows no code ─────
{
  const other = await startApp({ engine: ENGINE });
  try {
    const os = asStore(other.db);
    await os.run('DELETE FROM rate_limits');
    const jar = {};
    const r = await other.request('/v1/account/register', { method: 'POST', jar, body: { name: 'Elsewhere', email: 'elsewhere@example.test', password: 'correct-horse-battery', deviceId: 'dev-elsewhere', isAdult: true } });
    await verifyEmail(other, r.data.account.id);
    const tryIt = await other.request('/v1/referral/claim', { method: 'POST', jar, body: { code: issuedHere } });
    c.ok(CODE.test(issuedHere) && tryIt.data?.error?.code === 'REFERRAL_CODE_UNKNOWN', 'a real code issued by another deployment is unknown here (each database is bound to one edition)');
  } finally {
    await other.close();
  }
}

// ── the terms state the figures the code enforces ─────────────────────────
{
  const { readFileSync } = await import('node:fs');
  for (const f of ['docs/legal/au/terms.md', 'docs/legal/terms.md']) {
    const text = readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');
    c.ok(text.includes(`gets ${REFERRAL.trialDays} days of Premium free`) && text.includes(`created in the last ${REFERRAL.newAccountDays}\n  days`) &&
      text.includes(`at most ${REFERRAL.inviterCreditsPer30Days} friends in any 30 days`) && /Nothing is charged/.test(text) && /No cash value/.test(text),
      `${f} states the trial's length, eligibility, cap, no charge and no cash value as the code enforces them`);
  }
}

for (const k of keys) { if (before[k] === undefined) delete process.env[k]; else process.env[k] = before[k]; }
rmSync(scratch, { recursive: true, force: true });
console.log(`engine: ${ENGINE || 'sqlite'}`);
console.log(`REFERRAL TRIAL: PASS — ${c.count()}/${c.count()} checks`);
