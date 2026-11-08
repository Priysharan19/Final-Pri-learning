// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a child's account no guardian stands behind is erased (D18)
//
//   node server/test/child-erasure-check.mjs                   → SQLite
//   node server/test/child-erasure-check.mjs --engine=postgres → Postgres (with-postgres.mjs)
//
// Owner default D18: the account of an under-18 whose guardian never
// confirmed, or withdrew, is erased after 30 days, and a guardian can ask for
// erasure without the child's login (server/platform/childErasure.js). This
// suite drives the real /v1 chain and the real store (pri_server under RLS on
// Postgres) and proves:
//   · which accounts the 30-day rule selects, and every one it must never
//     touch (adult, legacy, no age on record, staff, confirmed, confirmed for
//     an older notice, younger than 30 days, withdrawn under 30 days);
//   · report mode (the default) counts and changes nothing;
//   · enforce mode soft-deletes: no sign-in, sessions revoked, links spent,
//     mail dropped, a scheduling audit row; nothing is erased until the grace
//     has run out, and then every account-bearing table is empty for it;
//   · a guardian's own request (both bearers) soft-deletes at once in either
//     mode and is erased after the grace; it is refused for an account not
//     recorded as a child's, and an invalid link changes nothing;
//   · a confirmation cannot reach a soft-deleted account, and one that lands
//     before the soft delete wins;
//   · the billing hook runs before the erasure, and a refusal leaves the
//     account scheduled for the next pass;
//   · a parent who approves by email code now gets the withdrawal credential,
//     so they can withdraw or ask for erasure later;
//   · housekeeping records the pass; the erased address can sign up again.
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const scratch = mkdtempSync(join(tmpdir(), 'pri-child-erasure-'));
process.env.NODE_ENV = 'test';
process.env.PRI_PLATFORM_DB = join(scratch, 'platform.db');
process.env.PRI_AUTH_DELIVERY_KEY = '7c'.repeat(32);
process.env.PRI_AUTH_EMAIL_PROVIDER = 'test';
delete process.env.PRI_PUBLIC_ORIGIN;
delete process.env.PRI_CHILD_ERASURE;

const { startApp, checks } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const { decryptDeliveryToken } = await import('../platform/deliveryCrypto.js');
const { CONSENT_NOTICE_VERSION, confirmConsent } = await import('../platform/guardianConsent.js');
const { readTestOutbox } = await import('../platform/smsProvider.js');
const {
  ERASURE_GRACE_MS, ERASURE_REASONS, UNCONSENTED_CHILD_RETENTION_MS, childErasureMode, retentionCandidates, runChildErasure, scheduleErasure
} = await import('../platform/childErasure.js');
const { housekeepingStatus, runHousekeeping } = await import('../platform/housekeeping.js');

const engine = requestedEngine();
console.log(`engine: ${engine}`);
const h = await startApp({ engine });
const c = checks();
const DAY = 24 * 60 * 60 * 1000;
const PASSWORD = 'erasure-pass-4821';
const NOW = Date.now();
const post = (path, body, jar = {}) => h.request(path, { method: 'POST', body, jar });
// Rate limits are not this suite's subject: it signs up about twenty accounts
// from one address, past the register limit of eight an hour.
const freshLimits = () => h.db.run('DELETE FROM rate_limits');
let serial = 0;

async function registerChild(label) {
  await freshLimits();
  const jar = {};
  const email = `${label}-${++serial}@child.example`;
  const body = {
    name: `Child ${label}`, email, password: PASSWORD, deviceId: `ipad-${label}`, isAdult: false, year: '9',
    guardianName: 'A Parent', guardianEmail: `parent-${label}-${serial}@home.example`
  };
  const r = await post('/v1/account/register', body, jar);
  if (r.status !== 201) throw new Error(`child-erasure-check: could not register ${label} (${r.status} ${r.text})`);
  return { id: r.data.account.id, email, jar };
}
async function registerAdult(label) {
  await freshLimits();
  const jar = {};
  const email = `${label}-${++serial}@adult.example`;
  const r = await post('/v1/account/register', { name: `Adult ${label}`, email, password: PASSWORD, deviceId: `mac-${label}`, isAdult: true }, jar);
  if (r.status !== 201) throw new Error(`child-erasure-check: could not register ${label} (${r.status} ${r.text})`);
  return { id: r.data.account.id, email, jar };
}
async function bearer(accountId, kind) {
  const row = await h.db.get(`SELECT token_id, token_ciphertext FROM auth_delivery_outbox
    WHERE account_id = ? AND kind = ? ORDER BY created_at DESC LIMIT 1`, [accountId, kind]);
  return row ? decryptDeliveryToken(row.token_ciphertext, `${accountId}:${kind}:${row.token_id}`) : null;
}
const account = id => h.db.get('SELECT id, deleted_at, age_basis, role FROM accounts WHERE id = ?', [id]);
const consent = id => h.db.get('SELECT confirmed_at, withdrawn_at FROM guardian_consents WHERE account_id = ?', [id]);
const login = async a => { await freshLimits(); return post('/v1/account/login', { email: a.email, password: PASSWORD, deviceId: 'second-device' }, {}); };
const me = a => h.request('/v1/account/me', { jar: a.jar });
const setCreated = (id, at) => h.db.run('UPDATE accounts SET created_at = ? WHERE id = ?', [at, id]);
const audits = (id, action) => h.db.all('SELECT metadata_json FROM audit_log WHERE target_kind = ? AND target_id = ? AND action = ? ORDER BY id', ['account', id, action]);
const n = async (sql, args = []) => Number((await h.db.get(sql, args)).n);

// Every table with an account_id column, on either engine.
async function accountTables() {
  if (engine === 'postgres') {
    const rows = await h.db.all("SELECT table_name FROM information_schema.columns WHERE table_schema='pri' AND column_name='account_id' ORDER BY table_name");
    return rows.map(r => `pri.${r.table_name}`);
  }
  const tables = await h.db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
  const out = [];
  for (const { name } of tables) {
    const cols = await h.db.all(`SELECT name FROM pragma_table_info('${name.replace(/'/g, "''")}')`);
    if (cols.some(col => col.name === 'account_id')) out.push(name);
  }
  return out;
}
async function rowsLeft(id) {
  const left = {};
  for (const table of await accountTables()) {
    const count = await n(`SELECT COUNT(*) AS n FROM ${table} WHERE account_id = ?`, [id]);
    if (count) left[table] = count;
  }
  if (await account(id)) left.accounts = 1;
  return left;
}

try {
  // ── 0 · the switch ─────────────────────────────────────────────────────────
  c.eq(childErasureMode({}), 'report', 'with nothing set the 30-day rule only reports');
  c.eq(childErasureMode({ PRI_CHILD_ERASURE: 'yes' }), 'report', 'anything but "enforce" only reports');
  c.eq(childErasureMode({ PRI_CHILD_ERASURE: ' Enforce ' }), 'enforce', 'PRI_CHILD_ERASURE=enforce turns it on');
  c.eq(UNCONSENTED_CHILD_RETENTION_MS, 30 * DAY, 'the period is 30 days (D18; counsel sets it)');
  c.eq(ERASURE_GRACE_MS, 7 * DAY, 'the grace between soft delete and erasure is 7 days');

  // ── 1 · the population ─────────────────────────────────────────────────────
  const old = NOW - 31 * DAY;
  const neverConfirmed = await registerChild('never');
  await setCreated(neverConfirmed.id, old);
  // A child whose consent row is missing (the guardian contact was never given).
  const noRow = await registerChild('norow');
  await h.db.run('DELETE FROM guardian_consents WHERE account_id = ?', [noRow.id]);
  await setCreated(noRow.id, old);
  const withdrawnOld = await registerChild('withdrawn-old');
  await setCreated(withdrawnOld.id, NOW - 60 * DAY);
  c.eq((await post('/v1/account/guardian/withdraw', { token: await bearer(withdrawnOld.id, 'guardian-consent') })).status, 200, 'a guardian withdraws one child');
  await h.db.run('UPDATE guardian_consents SET withdrawn_at = ? WHERE account_id = ?', [NOW - 31 * DAY, withdrawnOld.id]);

  const young = await registerChild('young');
  await setCreated(young.id, NOW - 29 * DAY);
  const withdrawnYoung = await registerChild('withdrawn-young');
  await setCreated(withdrawnYoung.id, NOW - 60 * DAY);
  await post('/v1/account/guardian/withdraw', { token: await bearer(withdrawnYoung.id, 'guardian-consent') });
  await h.db.run('UPDATE guardian_consents SET withdrawn_at = ? WHERE account_id = ?', [NOW - 29 * DAY, withdrawnYoung.id]);
  const confirmed = await registerChild('confirmed');
  c.eq((await post('/v1/account/guardian/confirm', { token: await bearer(confirmed.id, 'guardian-consent'), approve: true, noticeVersion: CONSENT_NOTICE_VERSION })).status, 200, 'a guardian confirms one child');
  await setCreated(confirmed.id, old);
  const renewal = await registerChild('renewal');
  await post('/v1/account/guardian/confirm', { token: await bearer(renewal.id, 'guardian-consent'), approve: true, noticeVersion: CONSENT_NOTICE_VERSION });
  await h.db.run("UPDATE guardian_consents SET notice_version = '2026-01-01' WHERE account_id = ?", [renewal.id]);
  await setCreated(renewal.id, old);
  c.eq((await h.request('/v1/account/guardian/state', { jar: renewal.jar })).data.renewalRequired, true, 'one child was confirmed for an older notice (renewal pending)');
  const adult = await registerAdult('adult');
  await setCreated(adult.id, NOW - 90 * DAY);
  const legacy = await registerChild('legacy');
  await h.db.run("UPDATE accounts SET age_basis = 'legacy' WHERE id = ?", [legacy.id]);
  await setCreated(legacy.id, old);
  const undeclared = await registerChild('undeclared');
  await h.db.run('UPDATE accounts SET age_basis = NULL WHERE id = ?', [undeclared.id]);
  await setCreated(undeclared.id, old);
  const staff = await registerChild('staff');
  await h.db.run("UPDATE accounts SET role = 'teacher' WHERE id = ?", [staff.id]);
  await setCreated(staff.id, old);

  const selected = (await retentionCandidates(h.db, { now: NOW })).map(r => r.account_id).sort();
  c.deq(selected, [neverConfirmed.id, noRow.id, withdrawnOld.id].sort(),
    'the 30-day rule selects exactly: never confirmed (with or without a consent row) and withdrawn 30+ days ago');
  const bases = Object.fromEntries((await retentionCandidates(h.db, { now: NOW })).map(r => [r.account_id, r.basis]));
  c.deq([bases[neverConfirmed.id], bases[noRow.id], bases[withdrawnOld.id]], ['never-confirmed', 'never-confirmed', 'withdrawn'], 'each with its basis');
  c.deq((await retentionCandidates(h.db, { now: NOW, limit: 2 })).length, 2, 'a pass is bounded');

  // ── 2 · report mode changes nothing ────────────────────────────────────────
  const neverHook = [];
  const reported = await runChildErasure(h.db, { now: NOW, mode: 'report', beforeDelete: ({ accountId }) => { neverHook.push(accountId); } });
  c.deq(reported, { mode: 'report', erased: 0, eraseFailed: 0, scheduled: 0, scheduleFailed: 0, candidates: 3 }, 'report mode counts three and changes nothing');
  c.eq((await account(neverConfirmed.id)).deleted_at, null, 'the account is untouched');
  c.eq((await login(neverConfirmed)).status, 200, 'and still signs in');
  c.deq(neverHook, [], 'and no billing hook ran');

  // ── 3 · enforce mode soft-deletes, nothing more ────────────────────────────
  const hooked = [];
  const hook = ({ accountId }) => { hooked.push(accountId); };
  const outboxBefore = await n("SELECT COUNT(*) AS n FROM auth_delivery_outbox WHERE account_id = ? AND delivered_at IS NULL", [neverConfirmed.id]);
  c.ok(outboxBefore > 0, 'the never-confirmed child still has mail waiting to be sent');
  const pass1 = await runChildErasure(h.db, { now: NOW, mode: 'enforce', beforeDelete: hook });
  c.deq({ scheduled: pass1.scheduled, erased: pass1.erased, failed: pass1.scheduleFailed + pass1.eraseFailed }, { scheduled: 3, erased: 0, failed: 0 }, 'enforce mode schedules the three and erases none');
  c.deq(hooked.sort(), [neverConfirmed.id, noRow.id, withdrawnOld.id].sort(), 'a charging web subscription is cancelled first, for each');
  for (const a of [neverConfirmed, noRow, withdrawnOld]) {
    c.eq(Number((await account(a.id)).deleted_at), NOW, `${a.email}: soft-deleted at the pass`);
  }
  c.eq((await login(neverConfirmed)).status, 401, 'a soft-deleted account cannot sign in');
  c.eq((await me(neverConfirmed)).status, 401, 'and its existing session is gone');
  c.eq(await n('SELECT COUNT(*) AS n FROM account_sessions WHERE account_id = ? AND revoked_at IS NULL', [neverConfirmed.id]), 0, 'every session is revoked');
  c.eq(await n('SELECT COUNT(*) AS n FROM account_tokens WHERE account_id = ? AND consumed_at IS NULL', [neverConfirmed.id]), 0, 'every link is spent');
  c.eq(await n('SELECT COUNT(*) AS n FROM auth_delivery_outbox WHERE account_id = ? AND delivered_at IS NULL', [neverConfirmed.id]), 0, 'no mail is sent for it');
  const scheduledRow = (await audits(neverConfirmed.id, 'account.erasure.scheduled'))[0];
  c.deq(JSON.parse(scheduledRow.metadata_json), { reason: ERASURE_REASONS.neverConfirmed, eraseAfter: NOW + ERASURE_GRACE_MS }, 'the schedule is audited with its reason and date, nothing personal');
  c.eq(JSON.parse((await audits(withdrawnOld.id, 'account.erasure.scheduled'))[0].metadata_json).reason, ERASURE_REASONS.withdrawn, 'a withdrawn child is scheduled as withdrawn');
  for (const a of [young, withdrawnYoung, confirmed, renewal, adult, legacy, undeclared, staff]) {
    c.eq((await account(a.id)).deleted_at, null, `never selected: ${a.email}`);
  }
  c.eq((await login(confirmed)).status, 200, 'a confirmed child signs in as before');

  // A confirmation cannot reach a soft-deleted account.
  c.eq((await post('/v1/account/guardian/confirm', { token: await bearer(neverConfirmed.id, 'guardian-consent'), approve: true, noticeVersion: CONSENT_NOTICE_VERSION })).status, 400,
    'its guardian link no longer confirms');
  c.eq(await confirmConsent(h.db, neverConfirmed.id, CONSENT_NOTICE_VERSION, NOW), false, 'and confirmConsent itself refuses a soft-deleted account');
  c.eq((await consent(neverConfirmed.id)).confirmed_at, null, 'nothing was recorded as confirmed');
  const again = await runChildErasure(h.db, { now: NOW + 60 * 60 * 1000, mode: 'enforce', beforeDelete: hook });
  c.deq({ scheduled: again.scheduled, erased: again.erased }, { scheduled: 0, erased: 0 }, 'a second pass inside the grace changes nothing');
  c.eq((await audits(neverConfirmed.id, 'account.erasure.scheduled')).length, 1, 'and schedules nothing twice');

  // ── 4 · a guardian's confirmation that lands first wins ────────────────────
  const racer = await registerChild('racer');
  await setCreated(racer.id, old);
  c.ok((await retentionCandidates(h.db, { now: NOW })).some(r => r.account_id === racer.id), 'an old unconfirmed child is a candidate');
  c.eq((await post('/v1/account/guardian/confirm', { token: await bearer(racer.id, 'guardian-consent'), approve: true, noticeVersion: CONSENT_NOTICE_VERSION })).status, 200,
    'its guardian confirms between the listing and the schedule');
  c.deq(await scheduleErasure(h.db, racer.id, { now: NOW }), { scheduled: false, eraseAfter: null, reason: null }, 'the schedule re-reads the consent and does nothing');
  c.eq((await account(racer.id)).deleted_at, null, 'the confirmed child is untouched');

  // ── 5 · the grace, then the erasure ────────────────────────────────────────
  const beforeGrace = await runChildErasure(h.db, { now: NOW + ERASURE_GRACE_MS - 1, mode: 'report', beforeDelete: hook });
  c.eq(beforeGrace.erased, 0, 'one millisecond before the grace runs out nothing is erased');
  const refusing = async ({ accountId }) => { if (accountId === withdrawnOld.id) throw Object.assign(new Error('provider down'), { code: 'BILLING_PROVIDER_UNAVAILABLE' }); };
  const pass2 = await runChildErasure(h.db, { now: NOW + ERASURE_GRACE_MS, mode: 'report', beforeDelete: refusing });
  c.deq({ erased: pass2.erased, eraseFailed: pass2.eraseFailed }, { erased: 2, eraseFailed: 1 }, 'at the end of the grace two are erased; the one whose billing hook refused is not');
  c.deq(await rowsLeft(neverConfirmed.id), {}, 'nothing of the erased account remains in any account-bearing table');
  c.deq(await rowsLeft(noRow.id), {}, 'nor of the account that never named a guardian');
  c.ok(await account(withdrawnOld.id), 'the refused one is still there, soft-deleted');
  c.eq(JSON.parse((await audits(neverConfirmed.id, 'account.erase'))[0].metadata_json).reason, ERASURE_REASONS.neverConfirmed, 'the erasure receipt names its reason');
  c.eq((await audits(neverConfirmed.id, 'account.erasure.scheduled')).length, 1, 'and the schedule row outlives the account: the trail is kept');
  const pass3 = await runChildErasure(h.db, { now: NOW + ERASURE_GRACE_MS + DAY, mode: 'report', beforeDelete: hook });
  c.deq({ erased: pass3.erased, eraseFailed: pass3.eraseFailed }, { erased: 1, eraseFailed: 0 }, 'the next pass erases it');
  c.deq(await rowsLeft(withdrawnOld.id), {}, 'and nothing of it remains');
  c.eq(JSON.parse((await audits(withdrawnOld.id, 'account.erase'))[0].metadata_json).reason, ERASURE_REASONS.withdrawn, 'with its own reason');
  c.eq((await audits(neverConfirmed.id, 'account.erase')).length, 1, 'an erased account is never erased twice');
  for (const a of [young, withdrawnYoung, confirmed, renewal, adult, legacy, undeclared, staff, racer]) {
    c.ok(await account(a.id), `still here: ${a.email}`);
  }

  // A soft delete that something other than the schedule made is never erased.
  const stray = await registerAdult('stray');
  await h.db.run('UPDATE accounts SET deleted_at = ? WHERE id = ?', [NOW - 30 * DAY, stray.id]);
  const pass4 = await runChildErasure(h.db, { now: NOW + 40 * DAY, mode: 'report', beforeDelete: hook });
  c.eq(pass4.erased, 0, 'an account with deleted_at but no scheduling record is not erased');
  c.ok(await account(stray.id), 'it is still there');

  // The erased address is free again.
  await freshLimits();
  c.eq((await post('/v1/account/register', { name: 'Again', email: neverConfirmed.email, password: PASSWORD, deviceId: 'ipad-again', isAdult: true }, {})).status, 201,
    'the erased account\'s address can sign up again');

  // ── 6 · a guardian asks, without the child's login ─────────────────────────
  const asked = await registerChild('asked');
  const askToken = await bearer(asked.id, 'guardian-consent');
  let r = await post('/v1/account/guardian/erase', { token: 'not-a-real-token' });
  c.deq({ status: r.status, code: r.data?.error?.code }, { status: 400, code: 'TOKEN_INVALID' }, 'an invalid link is refused');
  c.eq((await account(asked.id)).deleted_at, null, 'and changes nothing');
  r = await post('/v1/account/guardian/erase', { token: askToken });
  c.deq({ status: r.status, erasure: r.data?.erasure }, { status: 200, erasure: 'scheduled' }, 'the confirmation link asks for erasure (report mode: a request is always honoured)');
  c.ok(Math.abs(Number(r.data.eraseAfter) - (Date.now() + ERASURE_GRACE_MS)) < 60_000, 'and says when it will be erased');
  c.ok((await account(asked.id)).deleted_at != null, 'the account is soft-deleted at once');
  c.ok((await consent(asked.id)).withdrawn_at != null, 'consent is withdrawn with it');
  c.eq((await login(asked)).status, 401, 'the child can no longer sign in');
  c.eq((await me(asked)).status, 401, 'and the child\'s session is gone');
  c.deq(JSON.parse((await h.db.get("SELECT metadata_json FROM audit_log WHERE action = 'guardian.erase-request' AND target_id = ?", [asked.id])).metadata_json),
    { via: 'guardian-consent', withdrawn: true, scheduled: true }, 'the request is audited: which bearer, what it did');
  c.eq(JSON.parse((await audits(asked.id, 'account.erasure.scheduled'))[0].metadata_json).reason, ERASURE_REASONS.guardianRequest, 'scheduled as a guardian request');
  r = await post('/v1/account/guardian/erase', { token: askToken });
  c.deq({ status: r.status, already: r.data?.alreadyScheduled }, { status: 200, already: true }, 'a second click answers the same, and changes nothing');
  c.eq((await audits(asked.id, 'account.erasure.scheduled')).length, 1, 'nothing is scheduled twice');

  // The long-lived withdrawal credential asks too.
  const keeper = await registerChild('keeper');
  await post('/v1/account/guardian/confirm', { token: await bearer(keeper.id, 'guardian-consent'), approve: true, noticeVersion: CONSENT_NOTICE_VERSION });
  const keepToken = await bearer(keeper.id, 'guardian-withdraw');
  c.ok(keepToken, 'a confirming guardian holds the withdrawal credential');
  r = await post('/v1/account/guardian/erase', { token: keepToken });
  c.deq({ status: r.status, erasure: r.data?.erasure }, { status: 200, erasure: 'scheduled' }, 'the withdrawal credential asks for erasure');
  c.ok((await consent(keeper.id)).withdrawn_at != null && (await account(keeper.id)).deleted_at != null, 'withdrawn and soft-deleted');
  r = await post('/v1/account/guardian/erase', { token: keepToken });
  c.eq(r.status, 400, 'the credential is spent by the request it made');

  // Not for an account no longer recorded as a child's.
  const corrected = await registerChild('corrected');
  const correctedToken = await bearer(corrected.id, 'guardian-consent');
  await h.db.run("UPDATE accounts SET age_basis = 'adult' WHERE id = ?", [corrected.id]);
  r = await post('/v1/account/guardian/erase', { token: correctedToken });
  c.deq({ status: r.status, code: r.data?.error?.code }, { status: 409, code: 'GUARDIAN_ERASURE_NOT_AVAILABLE' }, 'a child credential cannot erase an account since recorded as an adult\'s');
  c.eq((await account(corrected.id)).deleted_at, null, 'it is untouched');
  c.eq((await consent(corrected.id)).withdrawn_at, null, 'and its consent row is unchanged');

  // A guardian's request is erased after the grace even in report mode.
  const later = Date.now() + ERASURE_GRACE_MS + 1000;
  const pass5 = await runChildErasure(h.db, { now: later, mode: 'report', beforeDelete: hook });
  c.eq(pass5.erased, 2, 'both guardian requests are erased once the grace has run out, in report mode too');
  c.deq(await rowsLeft(asked.id), {}, 'nothing of the first remains');
  c.deq(await rowsLeft(keeper.id), {}, 'nothing of the second remains');

  // ── 7 · a parent who approves by email code can withdraw or erase later ────
  // The guardian is asked again through the code flow, and no link is followed.
  const kid = await registerChild('coded');
  await freshLimits();
  const parentAddress = `parent-coded-${serial}@home.example`;
  r = await post('/v1/account/otp/guardian/request', { guardianName: 'Coded Parent', channel: 'email', destination: parentAddress }, kid.jar);
  c.eq(r.status, 202, 'the child asks a parent by email code');
  const mail = readTestOutbox({ to: parentAddress, channel: 'email' }).filter(m => m.purpose === 'guardian-consent').at(-1);
  c.ok(mail?.code, 'the parent receives a code');
  c.eq(await n("SELECT COUNT(*) AS n FROM auth_delivery_outbox WHERE account_id = ? AND kind = 'guardian-withdraw'", [kid.id]), 0, 'no withdrawal credential exists before approval');
  r = await post('/v1/account/otp/guardian/approve', { channel: 'email', destination: parentAddress, code: mail.code, approve: true, noticeVersion: CONSENT_NOTICE_VERSION });
  c.deq({ status: r.status, confirmed: r.data?.confirmed }, { status: 200, confirmed: true }, 'the parent approves with the code');
  const withdrawMail = await h.db.get("SELECT destination FROM auth_delivery_outbox WHERE account_id = ? AND kind = 'guardian-withdraw' AND delivered_at IS NULL", [kid.id]);
  c.eq(withdrawMail?.destination, parentAddress, 'and is now sent the long-lived withdrawal credential, to the address that approved');
  r = await post('/v1/account/guardian/erase', { token: await bearer(kid.id, 'guardian-withdraw') });
  c.deq({ status: r.status, erasure: r.data?.erasure }, { status: 200, erasure: 'scheduled' }, 'which can ask for erasure without the child\'s login');

  // ── 8 · housekeeping runs the pass and records it ──────────────────────────
  const stale = await registerChild('stale');
  await setCreated(stale.id, NOW - 45 * DAY);
  const record = await runHousekeeping(h.db, NOW, { childErasureMode: 'enforce', beforeErase: hook });
  c.eq(record.childErasure?.mode, 'enforce', 'housekeeping runs the erasure pass');
  c.ok(record.childErasure.scheduled >= 1 && (await account(stale.id)).deleted_at != null, 'and schedules what the rule selects');
  c.eq((await housekeepingStatus(h.db)).lastRun.childErasure.mode, 'enforce', '/v1/health\'s housekeeping record carries the pass');
  const quiet = await runHousekeeping(h.db, NOW);
  c.eq(quiet.childErasure?.mode, 'report', 'with PRI_CHILD_ERASURE unset the server\'s own pass only reports');
} finally {
  await h.close();
  rmSync(scratch, { recursive: true, force: true });
}

console.log(`CHILD ERASURE: PASS — ${c.count()}/${c.count()} checks — a child account no guardian confirmed (or one withdrawn) for 30 days is soft-deleted only in enforce mode and erased after a 7-day grace; a guardian's own request is honoured at once in either mode; nothing else is ever selected.`);
