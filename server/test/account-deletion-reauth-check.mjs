import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { createPlatformDb } from '../platform/db.js';
import { authorizeAccountDeletion } from '../platform/accounts.js';

const db = createPlatformDb(':memory:');
const now = Date.now();

function addAccount(id, email, passwordHash = null) {
  db.prepare(`INSERT INTO accounts(id,email,name,password_hash,role,created_at,updated_at)
    VALUES (?,?,?,?, 'student', ?, ?)`).run(id, email, id, passwordHash, now, now);
  db.prepare(`INSERT INTO entitlement_snapshots(account_id,plan,status,provider,source_version,updated_at)
    VALUES (?,'free','free','none',0,?)`).run(id, now);
}

addAccount('acct-password', 'password@example.test', bcrypt.hashSync('correct-password', 4));
await assert.rejects(
  () => authorizeAccountDeletion(db, 'acct-password', { password: 'wrong-password' }),
  error => error?.code === 'REAUTH_REQUIRED'
);
assert.deepEqual(
  await authorizeAccountDeletion(db, 'acct-password', { password: 'correct-password' }),
  { method: 'password' }
);

addAccount('acct-social', 'social@example.test');
db.prepare(`INSERT INTO account_identities(provider,provider_subject,account_id,email_at_link,linked_at)
  VALUES ('google','google-subject-good','acct-social','social@example.test',?)`).run(now);

await assert.rejects(
  () => authorizeAccountDeletion(db, 'acct-social', {}),
  error => error?.code === 'SOCIAL_REAUTH_REQUIRED'
);
await assert.rejects(
  () => authorizeAccountDeletion(db, 'acct-social', { provider: 'google', idToken: 'fresh-token' },
    async () => ({ provider: 'google', subject: 'different-subject' })),
  error => error?.code === 'SOCIAL_IDENTITY_MISMATCH'
);
assert.deepEqual(
  await authorizeAccountDeletion(db, 'acct-social', { provider: 'google', idToken: 'fresh-token', nonce: 'n-1' },
    async (provider, token, options) => {
      assert.equal(provider, 'google');
      assert.equal(token, 'fresh-token');
      assert.equal(options.nonce, 'n-1');
      return { provider: 'google', subject: 'google-subject-good' };
    }),
  { method: 'google', subject: 'google-subject-good' }
);

addAccount('acct-apple', 'apple@example.test');
db.prepare(`INSERT INTO account_identities(provider,provider_subject,account_id,email_at_link,linked_at)
  VALUES ('apple','apple-subject','acct-apple','apple@example.test',?)`).run(now);
assert.deepEqual(
  await authorizeAccountDeletion(db, 'acct-apple', { provider: 'apple', idToken: 'fresh-apple-token' },
    async () => ({ provider: 'apple', subject: 'apple-subject' })),
  { method: 'apple', subject: 'apple-subject' }
);

await assert.rejects(
  () => authorizeAccountDeletion(db, 'missing-account', { password: 'anything' }),
  error => error?.code === 'ACCOUNT_NOT_FOUND' && error?.status === 404
);

db.close();
console.log('PASS — account deletion always requires fresh password or linked Apple/Google identity proof.');
