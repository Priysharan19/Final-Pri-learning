// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the referral-unlocked 7-day Premium trial (owner decision, 18 Nov 2026)
//
// The owner approved "the 7 day free trial, provided they asked someone else to
// download the app". This is that trial, under the CTO's rules for a children's
// product (docs/product/packaging-2026-11.md §4a):
//
//   · NO CONTACT COLLECTION. A student gets a personal invite code and link,
//     which they share themselves (the system share sheet or a copied link).
//     The server never asks for, stores or messages a friend's email or phone.
//   · WHAT UNLOCKS IT. A NEW account (created in the last 7 days) on this same
//     server — so this same edition, whose database is bound to one region —
//     that has verified its email presents the code (POST /v1/referral/claim).
//     Both people then get 7 days of Premium, once per account, ever.
//   · NO CARD, NO CHARGE. The trial is a dated entitlement grant
//     (entitlement_support_grants, product 'referral-trial'): it lapses back to
//     Free on its own at its end. Nothing is billed and nothing converts.
//   · ANTI-ABUSE. One trial per account ever (billing_trial_claims — the same
//     claim a Stripe trial uses, so the two never stack); no self-referral (the
//     same device on both accounts, or the same mailbox after removing +tags
//     and Gmail dots); at most REFERRAL.inviterCreditsPer30Days credited
//     referrals per inviter; rate limits per account on both routes.
//   · UNDER 15s. Both routes sit behind requireGuardianConsent (router.js): a
//     child whose guardian has not approved can neither share nor claim.
//   · STORES. Web only (Apple 3.1.1 / 3.2.2(x), Google Play Payments: see the
//     packaging doc). A declared native shell is told the referral is not
//     available and is offered nothing; a trial earned on the web follows the
//     account like any other entitlement.
//   · WHAT IS STORED. Who invited whom, and nothing else: one audit_log row
//     'referral.code' (the inviter and their code) and one 'referral.joined'
//     (the friend, and the inviter it names). The same append-only pattern the
//     guardian confirmation uses (childErasure.js); no schema change.
// ─────────────────────────────────────────────────────────────────────────────
import { randomInt } from 'node:crypto';
import { asyncRouter } from './asyncRouter.js';
import { asStore } from './store.js';
import { applyVerifiedEntitlement, serverEntitlementCapabilities } from './entitlements.js';
import { declaredNativeClient, rateLimit, requireSession, requireVerifiedEmail } from './security.js';

const DAY = 24 * 60 * 60 * 1000;
export const REFERRAL = Object.freeze({
  trialDays: 7,
  productId: 'referral-trial',
  newAccountDays: 7,
  inviterCreditsPer30Days: 5,
  reminderDaysBeforeEnd: 2
});
// No 0/O, 1/I/L: a code read aloud or typed is not misread.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{10}$/;

const refuse = (res, status, code, message) => res.status(status).json({ error: { code, message } });

/** The mailbox an address delivers to: lower case, no +tag, no Gmail dots. */
export function mailbox(email) {
  const [rawLocal = '', rawDomain = ''] = String(email || '').trim().toLowerCase().split('@');
  let domain = rawDomain;
  let local = rawLocal.split('+')[0];
  if (domain === 'googlemail.com') domain = 'gmail.com';
  if (domain === 'gmail.com') local = local.replace(/\./g, '');
  return `${local}@${domain}`;
}

function newCode() {
  let out = '';
  for (let i = 0; i < 10; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

/** This account's invite code, made once and kept (audit_log 'referral.code'). */
export async function inviteCodeFor(db, accountId, now = Date.now()) {
  db = asStore(db);
  const existing = await db.get("SELECT target_id FROM audit_log WHERE action='referral.code' AND actor_account_id=? ORDER BY id LIMIT 1", [accountId]);
  if (existing?.target_id) return existing.target_id;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newCode();
    if (await db.get("SELECT 1 AS taken FROM audit_log WHERE action='referral.code' AND target_id=?", [code])) continue;
    await db.run('INSERT INTO audit_log(actor_account_id,action,target_kind,target_id,metadata_json,created_at) VALUES (?,?,?,?,?,?)',
      [accountId, 'referral.code', 'referral-code', code, '{}', now]);
    const first = await db.get("SELECT target_id FROM audit_log WHERE action='referral.code' AND actor_account_id=? ORDER BY id LIMIT 1", [accountId]);
    return first.target_id;
  }
  throw Object.assign(new Error('Could not make an invite code.'), { status: 503, code: 'REFERRAL_CODE_UNAVAILABLE' });
}

/** The referral trial as the account sees it: never had one, running, or ended. */
export async function referralTrialState(db, accountId, now = Date.now()) {
  db = asStore(db);
  const grant = await db.get('SELECT period_end FROM entitlement_support_grants WHERE account_id=? AND product_id=? ORDER BY period_end DESC LIMIT 1', [accountId, REFERRAL.productId]);
  const claim = await db.get('SELECT provider_subscription_id FROM billing_trial_claims WHERE account_id=?', [accountId]);
  const endsAt = grant ? Number(grant.period_end) : null;
  return {
    trialUsed: !!claim,
    active: !!endsAt && endsAt > now,
    endsAt,
    ended: !!endsAt && endsAt <= now,
    // Day 5 onward: the reminder says when it ends and that nothing is charged.
    remind: !!endsAt && endsAt > now && endsAt - now <= REFERRAL.reminderDaysBeforeEnd * DAY
  };
}

/** Grant the 7-day trial once, ever. False when this account already had a trial. */
export async function grantReferralTrial(db, accountId, now = Date.now()) {
  db = asStore(db);
  const claimed = await db.run(`INSERT INTO billing_trial_claims(account_id,provider,provider_subscription_id,claimed_at)
    VALUES (?,'web',?,?) ON CONFLICT(account_id) DO NOTHING`, [accountId, `referral:${accountId}`, now]);
  if (claimed.changes !== 1) return false;
  await applyVerifiedEntitlement(db, {
    verified: true, provider: 'admin', eventId: `referral-trial-${accountId}`, accountId, eventType: 'referral.trial',
    productId: REFERRAL.productId, plan: 'premium', status: 'trialing', currentPeriodEnd: now + REFERRAL.trialDays * DAY, now
  });
  return true;
}

async function sharesDevice(db, a, b) {
  // 'web' is the server's stand-in when a client names no device: it is not a device.
  return !!await db.get(`SELECT 1 AS shared FROM account_sessions x JOIN account_sessions y ON x.device_id = y.device_id
    WHERE x.account_id=? AND y.account_id=? AND x.device_id NOT IN ('web','') LIMIT 1`, [a, b]);
}

/**
 * The claim itself, without HTTP: `inviteeId` presents `code`. Returns
 * { status, code?, granted?, endsAt? }. Every refusal is coded.
 */
export async function claimReferral(db, { inviteeId, code, now = Date.now() }) {
  db = asStore(db);
  // One claim at a time, all or nothing: the friend's record, both grants and
  // the checks before them commit together (a failure leaves no half-spent
  // trial), and the per-inviter cap, the one-trial-per-mailbox rule and the
  // once-per-friend rule cannot be raced by simultaneous claims (Postgres runs
  // statements outside a transaction at READ COMMITTED).
  return db.transaction(() => claimUnderLock(db, { inviteeId, code, now }), { lock: 'referral-claim' });
}

async function claimUnderLock(db, { inviteeId, code, now }) {
  const clean = String(code || '').trim().toUpperCase();
  if (!CODE.test(clean)) return { status: 400, code: 'REFERRAL_CODE_INVALID' };
  const owner = await db.get(`SELECT l.actor_account_id AS inviter FROM audit_log l JOIN accounts a ON a.id = l.actor_account_id
    WHERE l.action='referral.code' AND l.target_id=? AND a.deleted_at IS NULL LIMIT 1`, [clean]);
  if (!owner?.inviter) return { status: 404, code: 'REFERRAL_CODE_UNKNOWN' };
  const inviterId = owner.inviter;
  if (inviterId === inviteeId) return { status: 409, code: 'REFERRAL_SELF' };
  const [inviter, invitee] = await Promise.all([
    db.get('SELECT id,email,created_at FROM accounts WHERE id=? AND deleted_at IS NULL', [inviterId]),
    db.get('SELECT id,email,created_at,email_verified_at FROM accounts WHERE id=? AND deleted_at IS NULL', [inviteeId])
  ]);
  if (!inviter || !invitee) return { status: 404, code: 'REFERRAL_CODE_UNKNOWN' };
  if (!invitee.email_verified_at) return { status: 403, code: 'EMAIL_UNVERIFIED' };
  // New = created in the last 7 days, or (a child) approved by a guardian in
  // the last 7 days: a slow approval does not cost the friend their trial.
  const approved = Number((await db.get('SELECT confirmed_at FROM guardian_consents WHERE account_id=? AND withdrawn_at IS NULL', [inviteeId]))?.confirmed_at) || 0;
  if (now - Math.max(Number(invitee.created_at), approved) > REFERRAL.newAccountDays * DAY) return { status: 409, code: 'REFERRAL_NOT_NEW_ACCOUNT' };
  if (await db.get("SELECT 1 AS joined FROM audit_log WHERE action='referral.joined' AND actor_account_id=? LIMIT 1", [inviteeId])) return { status: 409, code: 'REFERRAL_ALREADY_USED' };
  if (mailbox(inviter.email) === mailbox(invitee.email) || await sharesDevice(db, inviterId, inviteeId)) return { status: 409, code: 'REFERRAL_SELF' };
  // One invitation trial per person, not per address: another account at the
  // same mailbox (+tags, Gmail dots) that already had one rules this one out.
  const trialled = await db.all(`SELECT a.id, a.email FROM accounts a JOIN entitlement_support_grants g ON g.account_id = a.id
    WHERE g.product_id=?`, [REFERRAL.productId]);
  const inboxHadTrial = (who) => trialled.some(row => row.id !== who.id && mailbox(row.email) === mailbox(who.email));
  if (inboxHadTrial(invitee)) return { status: 409, code: 'REFERRAL_ALREADY_USED' };
  const credited = Number((await db.get("SELECT COUNT(*) AS n FROM audit_log WHERE action='referral.joined' AND target_id=? AND created_at>?", [inviterId, now - 30 * DAY]))?.n || 0);
  if (credited >= REFERRAL.inviterCreditsPer30Days) return { status: 429, code: 'REFERRAL_LIMIT' };

  // Who invited whom — the one thing kept. One row per friend, ever.
  const joined = await db.run(`INSERT INTO audit_log(actor_account_id,action,target_kind,target_id,metadata_json,created_at)
    SELECT CAST(? AS TEXT),'referral.joined','account',CAST(? AS TEXT),'{}',CAST(? AS BIGINT)
    WHERE NOT EXISTS (SELECT 1 FROM audit_log WHERE action='referral.joined' AND actor_account_id=CAST(? AS TEXT))`, [inviteeId, inviterId, now, inviteeId]);
  if (joined.changes !== 1) return { status: 409, code: 'REFERRAL_ALREADY_USED' };

  const granted = await grantReferralTrial(db, inviteeId, now);
  // The inviter's own trial: once, ever, and never spent while they already pay.
  const inviterSnapshot = await db.get('SELECT plan,status,current_period_end,grace_until FROM entitlement_snapshots WHERE account_id=?', [inviterId]);
  const inviterPaying = serverEntitlementCapabilities(inviterSnapshot, now).length > 0;
  // The same one-per-inbox rule holds for the inviter.
  const inviterGranted = inviterPaying || inboxHadTrial(inviter) ? false : await grantReferralTrial(db, inviterId, now);
  return { status: 200, granted, inviterGranted, endsAt: granted ? now + REFERRAL.trialDays * DAY : null };
}

const NOT_ON_STORE_APPS = 'The invite trial is offered on the website only.';

export function createReferralRouter(db) {
  db = asStore(db);
  const router = asyncRouter();

  router.get('/', requireSession(db), requireVerifiedEmail, rateLimit(db, 'referral-read', { limit: 60, windowMs: 60 * 60 * 1000 }), async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const accountId = req.platformSession.account_id;
    const trial = await referralTrialState(db, accountId);
    // A store build is offered nothing about the referral (store rules); it
    // still learns the trial's dates, so its reminder can say when it ends.
    if (declaredNativeClient(req)) return res.json({ available: false, trial });
    res.json({ available: true, code: await inviteCodeFor(db, accountId), path: '/', param: 'invite', trialDays: REFERRAL.trialDays, trial });
  });

  router.post('/claim', requireSession(db), requireVerifiedEmail, rateLimit(db, 'referral-claim', { limit: 5, windowMs: 60 * 60 * 1000 }), async (req, res) => {
    if (declaredNativeClient(req)) return refuse(res, 409, 'REFERRAL_WEB_ONLY', NOT_ON_STORE_APPS);
    const result = await claimReferral(db, { inviteeId: req.platformSession.account_id, code: req.body?.code });
    res.set('Cache-Control', 'no-store');
    if (result.status !== 200) return refuse(res, result.status, result.code, 'This invite cannot be used here.');
    res.json({ granted: result.granted, endsAt: result.endsAt, trialDays: REFERRAL.trialDays });
  });

  return router;
}
