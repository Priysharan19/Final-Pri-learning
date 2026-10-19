// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · DELETE /v1/account is bound to the account the client means (#521)
//
// The session cookie is device-wide. Between the Account panel being drawn for
// one local profile and the Delete click, another local profile on the same
// device can sign in from a second tab, so the cookie now names a different
// account — and the server would delete the session's account, not the one on
// screen. The client therefore sends the account id it means to delete, and the
// server refuses a mismatch with 409 ACCOUNT_MISMATCH before any proof is
// checked or spent. The id never selects what is deleted: only the session does.
//
// The account-delete rate limit (3 per account per day) counts refusals too, so
// each scenario below uses its own accounts and stays within it.
//
//   node server/test/account-deletion-session-binding-check.mjs
//   node server/test/account-deletion-session-binding-check.mjs --engine=postgres
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import { requestedEngine } from './support/engine.mjs';
import { checks, registerAccount, startApp } from './support/app-harness.mjs';

const c = checks();
const h = await startApp({ engine: requestedEngine() });
const PASSWORD = 'correct-horse-battery';
const register = async name => {
  const made = await registerAccount(h, { email: `${name}.binding@example.test`, password: PASSWORD, deviceId: 'ipad-shared' });
  c.eq(made.status, 201, `${name} registers`);
  return made;
};
const exists = async id => !!(await h.db.get('SELECT 1 FROM accounts WHERE id = ? AND deleted_at IS NULL', [id]));
const auditDeletes = async () => (await h.db.all("SELECT target_id FROM audit_log WHERE action = 'account.delete'")).map(row => row.target_id);
const del = (jar, body) => h.request('/v1/account', { method: 'DELETE', jar, body });

try {
  const alice = await register('alice');
  const bob = await register('bob');

  // ── The race: Alice's panel, Bob's cookie ──────────────────────────────────
  // Bob signed in on this device after Alice's panel was drawn; the device-wide
  // cookie is now Bob's. The panel still names Alice's account.
  const swapped = await del(bob.jar, { password: PASSWORD, accountId: alice.account.id });
  c.deq([swapped.status, swapped.data?.error?.code], [409, 'ACCOUNT_MISMATCH'], 'a delete naming an account other than the session\'s is refused 409 ACCOUNT_MISMATCH');
  c.ok(await exists(alice.account.id), 'Alice\'s account is untouched');
  c.ok(await exists(bob.account.id), 'Bob\'s account (the session\'s) is untouched too: the id never selects, and a mismatch deletes nothing');
  c.eq((await h.request('/v1/account/me', { jar: bob.jar })).status, 200, 'Bob\'s session survives the refusal');
  c.deq(await auditDeletes(), [], 'no deletion receipt was written');

  // The mismatch is decided before any proof is examined: a wrong password with
  // a wrong id is still a 409 (not a 401), so the refusal spends no proof and
  // tells the client exactly what to fix.
  const wrongBoth = await del(bob.jar, { password: 'not-the-password', accountId: alice.account.id });
  c.deq([wrongBoth.status, wrongBoth.data?.error?.code], [409, 'ACCOUNT_MISMATCH'], 'the mismatch is reported before the proof is checked');
  c.ok((await exists(alice.account.id)) && (await exists(bob.account.id)), 'nothing was deleted by either refused attempt');

  // ── Once the id matches, the proof decides, exactly as before ──────────────
  const matched = await del(bob.jar, { password: PASSWORD, accountId: bob.account.id });
  c.deq([matched.status, matched.data?.deleted], [200, true], 'a matching id with the right password deletes the session\'s account');
  c.ok(!(await exists(bob.account.id)), 'Bob\'s account is gone');
  c.ok(await exists(alice.account.id), 'Alice\'s is not');
  c.deq(await auditDeletes(), [bob.account.id], 'one deletion receipt, for Bob');
  c.eq((await h.request('/v1/account/me', { jar: bob.jar })).status, 401, 'the deleting session is dead');

  // ── Ids that match nothing, and ids of the wrong type ──────────────────────
  const dave = await register('dave');
  const noise = await del(dave.jar, { password: PASSWORD, accountId: 'acct_does-not-exist' });
  c.deq([noise.status, noise.data?.error?.code], [409, 'ACCOUNT_MISMATCH'], 'an unknown account id is a mismatch like any other');
  const typed = await del(dave.jar, { password: PASSWORD, accountId: 42 });
  c.deq([typed.status, typed.data?.error?.code], [409, 'ACCOUNT_MISMATCH'], 'a non-string id is compared as text and refused');
  c.ok(await exists(dave.account.id), 'Dave\'s account survives both');

  // ── A matching id never weakens the proof ──────────────────────────────────
  const erin = await register('erin');
  const wrongProof = await del(erin.jar, { password: 'not-the-password', accountId: erin.account.id });
  c.deq([wrongProof.status, wrongProof.data?.error?.code], [401, 'REAUTH_REQUIRED'], 'a matching id with the wrong password is still refused for proof');
  c.ok(await exists(erin.account.id), 'and deletes nothing');
  const noProof = await del(erin.jar, { accountId: erin.account.id });
  c.deq([noProof.status, noProof.data?.error?.code], [401, 'REAUTH_REQUIRED'], 'a matching id with no proof at all is refused');
  c.ok(await exists(erin.account.id), 'and deletes nothing either');

  // ── An older client that sends no id keeps working ─────────────────────────
  const carol = await register('carol');
  const legacy = await del(carol.jar, { password: PASSWORD });
  c.deq([legacy.status, legacy.data?.deleted], [200, true], 'a delete without an accountId (older client) is still accepted on proof alone');
  c.ok(!(await exists(carol.account.id)), 'Carol\'s account is gone');
  c.ok(await exists(alice.account.id), 'Alice\'s account survives the whole run');
  c.deq((await auditDeletes()).sort(), [bob.account.id, carol.account.id].sort(), 'exactly two deletion receipts: Bob and Carol');
} finally {
  await h.close();
}

console.log(`engine: ${h.engine}`);
console.log(`ACCOUNT DELETION SESSION BINDING: PASS — ${c.count()}/${c.count()} checks`);
