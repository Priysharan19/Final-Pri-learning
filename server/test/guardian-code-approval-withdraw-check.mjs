// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a parent who approves by code gets the withdrawal link too
//
//   node server/test/guardian-code-approval-withdraw-check.mjs                   → SQLite
//   node server/test/guardian-code-approval-withdraw-check.mjs --engine=postgres → Postgres
//
// L8's local journey on 63deeb757: a 13-year-old signs up by code, the parent
// approves with the code their email carried (POST /v1/account/otp/guardian/
// approve), and no withdrawal mail is queued. The link-approval path
// (POST /v1/account/guardian/confirm) emails the long-lived withdrawal
// credential; the code path did not, and the consent link expires within the
// hour and is purged, so a parent who approved by code could never withdraw
// from their own inbox — "withdrawal is as easy as giving it" was untrue.
//
// Proves: approving by email code queues exactly one 'guardian-withdraw'
// credential to the address that approved, as the link path does; that
// credential withdraws consent through the real route and is spent by it; a
// failed or refused approval queues nothing; a phone (SMS) approval is unchanged.
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
process.env.NODE_ENV = 'test';
process.env.PRI_AUTH_DELIVERY_KEY = '5e'.repeat(32);
process.env.PRI_AUTH_EMAIL_PROVIDER = 'test';
process.env.PRI_SMS_PROVIDER = 'test';
delete process.env.PRI_PUBLIC_ORIGIN;

const { startApp, checks } = await import('./support/app-harness.mjs');
const { requestedEngine } = await import('./support/engine.mjs');
const { readTestOutbox } = await import('../platform/smsProvider.js');
const { decryptDeliveryToken } = await import('../platform/deliveryCrypto.js');
const { CONSENT_NOTICE_VERSION } = await import('../platform/guardianConsent.js');

const engine = requestedEngine();
console.log(`engine: ${engine}`);
const h = await startApp({ engine });
const c = checks();
const post = (path, body, jar = {}) => h.request(path, { method: 'POST', body, jar });
const fresh = () => h.db.run('DELETE FROM rate_limits');
const withdrawRows = async accountId => h.db.all("SELECT destination, token_id, token_ciphertext, delivered_at FROM auth_delivery_outbox WHERE account_id = ? AND kind = 'guardian-withdraw'", [accountId]);
let serial = 0;

/** A 13-year-old signs up with an email code, as the card does. */
async function childByCode() {
  const email = `child.${++serial}@code-approval.example`;
  await fresh();
  let r = await post('/v1/account/otp/request', { channel: 'email', destination: email });
  if (r.status !== 202) throw new Error(`child code request: ${r.status}`);
  const code = readTestOutbox({ to: email, channel: 'email' }).at(-1).code;
  r = await post('/v1/account/otp/verify', { channel: 'email', destination: email, challengeId: r.data.challengeId, code });
  const jar = {};
  r = await post('/v1/account/otp/verify', { channel: 'email', destination: email, signupTicket: r.data.signupTicket, profile: { name: 'Child', year: '8', isAdult: false } }, jar);
  if (r.status !== 201) throw new Error(`child sign-up: ${r.status} ${r.text}`);
  return { id: r.data.account.id, jar };
}

try {
  // ── by email code ──────────────────────────────────────────────────────────
  const kid = await childByCode();
  const parent = `parent.${serial}@code-approval.example`;
  await fresh();
  let r = await post('/v1/account/otp/guardian/request', { guardianName: 'Parent', channel: 'email', destination: parent }, kid.jar);
  c.eq(r.status, 202, 'the child asks a parent by email code');
  const mail = readTestOutbox({ to: parent, channel: 'email' }).filter(m => m.purpose === 'guardian-consent').at(-1);
  c.eq((await withdrawRows(kid.id)).length, 0, 'no withdrawal credential exists before the parent approves');
  const wrong = mail.code === '000000' ? '111111' : '000000';
  r = await post('/v1/account/otp/guardian/approve', { channel: 'email', destination: parent, code: wrong, approve: true, noticeVersion: CONSENT_NOTICE_VERSION });
  c.eq(r.status, 400, 'a wrong code approves nothing');
  c.eq((await withdrawRows(kid.id)).length, 0, 'and queues no withdrawal credential');
  r = await post('/v1/account/otp/guardian/approve', { channel: 'email', destination: parent, code: mail.code, approve: true, noticeVersion: CONSENT_NOTICE_VERSION });
  c.deq({ status: r.status, confirmed: r.data?.confirmed }, { status: 200, confirmed: true }, 'the parent approves with their code');
  const rows = await withdrawRows(kid.id);
  c.eq(rows.length, 1, 'exactly one withdrawal credential is queued, as on the link path');
  c.eq(rows[0]?.destination, parent, 'to the address that approved');
  const token = decryptDeliveryToken(rows[0].token_ciphertext, `${kid.id}:guardian-withdraw:${rows[0].token_id}`);
  const lifetime = await h.db.get('SELECT expires_at - created_at AS life FROM account_tokens WHERE id = ?', [rows[0].token_id]);
  c.ok(Number(lifetime.life) > 365 * 24 * 60 * 60 * 1000, 'the credential is the long-lived one, not a one-hour link');
  r = await post('/v1/account/guardian/withdraw', { token });
  c.deq({ status: r.status, withdrawn: r.data?.withdrawn }, { status: 200, withdrawn: true }, 'and it withdraws consent from the parent\'s own inbox');
  r = await h.request('/v1/account/guardian/state', { jar: kid.jar });
  c.eq(r.data?.state, 'withdrawn', 'the child\'s account sees the withdrawal');
  r = await post('/v1/account/guardian/withdraw', { token });
  c.eq(r.status, 400, 'the credential is spent by the withdrawal it made');

  // ── by phone code: unchanged (a phone parent withdraws by SMS) ─────────────
  const phoneKid = await childByCode();
  await fresh();
  r = await post('/v1/account/otp/guardian/request', { guardianName: 'Phone Parent', channel: 'sms', destination: '9876501234' }, phoneKid.jar);
  c.eq(r.status, 202, 'another child asks a parent by phone');
  const sms = readTestOutbox({ to: '+919876501234' }).filter(m => m.purpose === 'guardian-consent').at(-1);
  r = await post('/v1/account/otp/guardian/approve', { channel: 'sms', destination: '9876501234', code: sms.code, approve: true, noticeVersion: CONSENT_NOTICE_VERSION });
  c.deq({ status: r.status, confirmed: r.data?.confirmed }, { status: 200, confirmed: true }, 'the phone parent approves with their code');
  c.eq((await withdrawRows(phoneKid.id)).length, 0, 'no email credential is invented for a phone parent');
} finally {
  await h.close();
}

console.log(`GUARDIAN CODE APPROVAL WITHDRAWAL: PASS — ${c.count()}/${c.count()} checks — a parent who approves by email code is sent the long-lived withdrawal credential, as the link path does, and can withdraw with it.`);
