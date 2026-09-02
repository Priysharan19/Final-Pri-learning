import assert from 'node:assert/strict';
import { createPlatformDb } from '../platform/db.js';
import { encryptDeliveryToken } from '../platform/deliveryCrypto.js';
import {
  buildAuthActionUrl,
  createResendAuthEmailTransport,
  drainAuthDeliveryOutbox,
  ensureAuthDeliverySchema
} from '../platform/authDelivery.js';

const priorNodeEnv = process.env.NODE_ENV;
const priorCsrf = process.env.PRI_CSRF_SECRET;
process.env.NODE_ENV = 'test';
process.env.PRI_CSRF_SECRET = 'auth-delivery-test-secret';

try {
  const db = createPlatformDb(':memory:');
  ensureAuthDeliverySchema(db);
  const now = 1_788_359_200_000;
  const accountId = 'acct_delivery';
  db.prepare(`INSERT INTO accounts(id,email,name,password_hash,role,created_at,updated_at)
    VALUES (?, ?, ?, NULL, 'student', ?, ?)`).run(accountId, 'student@example.test', 'Student', now, now);

  const queue = ({ id, outboxId, kind, rawToken, expiresAt = now + 60 * 60_000 }) => {
    const context = `${accountId}:${kind}:${id}`;
    db.prepare(`INSERT INTO account_tokens(id,account_id,purpose,token_hash,created_at,expires_at)
      VALUES (?, ?, ?, ?, ?, ?)`).run(id, accountId, kind, `hash-${id}`, now, expiresAt);
    const envelope = encryptDeliveryToken(rawToken, context);
    assert.ok(!envelope.includes(rawToken), 'raw auth token must not be persisted inside its envelope');
    db.prepare(`INSERT INTO auth_delivery_outbox(id,account_id,kind,destination,token_id,token_ciphertext,created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(outboxId, accountId, kind, 'student@example.test', id, envelope, now);
  };

  const verifyRaw = 'verify-secret-token-value';
  queue({ id: 'tok_verify', outboxId: 'mail_verify', kind: 'verify-email', rawToken: verifyRaw });
  let captured = null;
  let sends = 0;
  const first = await drainAuthDeliveryOutbox(db, {
    now,
    publicOrigin: 'https://learn.pri.example',
    send: async message => {
      sends += 1;
      captured = message;
      return { providerMessageId: 'email_provider_1' };
    }
  });
  assert.deepEqual(first, { enabled: true, sent: 1, failed: 0, purged: 0 });
  assert.equal(sends, 1);
  assert.equal(captured.kind, 'verify-email');
  assert.equal(captured.to, 'student@example.test');
  const link = new URL(captured.actionUrl);
  assert.equal(link.origin, 'https://learn.pri.example');
  assert.equal(link.pathname, '/account-action');
  assert.equal(link.search, '', 'auth secrets must never be placed in the query string');
  const fragment = new URLSearchParams(link.hash.slice(1));
  assert.equal(fragment.get('action'), 'verify-email');
  assert.equal(fragment.get('token'), verifyRaw);

  const delivered = db.prepare('SELECT * FROM auth_delivery_outbox WHERE id=?').get('mail_verify');
  assert.equal(delivered.delivered_at, now);
  assert.equal(delivered.attempt_count, 1);
  assert.equal(delivered.token_ciphertext, '', 'successful delivery must erase the encrypted raw-token envelope');
  assert.equal(delivered.provider_message_id, 'email_provider_1');
  assert.ok(!JSON.stringify(delivered).includes(verifyRaw));

  await drainAuthDeliveryOutbox(db, {
    now: now + 1,
    publicOrigin: 'https://learn.pri.example',
    send: async () => { sends += 1; return { providerMessageId: 'duplicate' }; }
  });
  assert.equal(sends, 1, 'a delivered outbox row must never be sent twice by the worker');

  const resetRaw = 'reset-secret-token-value';
  queue({ id: 'tok_reset', outboxId: 'mail_reset', kind: 'reset-password', rawToken: resetRaw });
  const failed = await drainAuthDeliveryOutbox(db, {
    now: now + 10,
    publicOrigin: 'https://learn.pri.example',
    send: async () => { const error = new Error('temporary provider failure'); error.code = 'provider-temporary'; throw error; }
  });
  assert.equal(failed.failed, 1);
  const retry = db.prepare('SELECT * FROM auth_delivery_outbox WHERE id=?').get('mail_reset');
  assert.equal(retry.attempt_count, 1);
  assert.equal(retry.last_error_code, 'PROVIDER-TEMPORARY');
  assert.equal(retry.next_attempt_at, now + 10 + 60_000);
  assert.notEqual(retry.token_ciphertext, '');
  assert.ok(!retry.token_ciphertext.includes(resetRaw), 'retry state must keep only ciphertext, never plaintext');

  queue({ id: 'tok_expired', outboxId: 'mail_expired', kind: 'reset-password', rawToken: 'expired-secret', expiresAt: now - 1 });
  let expiredSent = false;
  const cleanup = await drainAuthDeliveryOutbox(db, {
    now: now + 20,
    publicOrigin: 'https://learn.pri.example',
    send: async () => { expiredSent = true; return { providerMessageId: 'must-not-send' }; }
  });
  assert.equal(cleanup.purged, 1);
  assert.equal(expiredSent, false, 'expired reset tokens must be purged rather than emailed');
  assert.equal(db.prepare('SELECT 1 FROM auth_delivery_outbox WHERE id=?').get('mail_expired'), undefined);

  const direct = buildAuthActionUrl('https://learn.pri.example', 'reset-password', 'fragment-only');
  assert.ok(direct.includes('#action=reset-password&token=fragment-only'));
  assert.ok(!direct.includes('?token='));

  let providerRequest = null;
  const transport = createResendAuthEmailTransport({
    apiKey: 're_test_secret',
    from: 'Pri Learning <accounts@pri.example>',
    fetchImpl: async (url, options) => {
      providerRequest = { url, options };
      return { ok: true, status: 200, text: async () => JSON.stringify({ id: 'resend_message_1' }) };
    }
  });
  const provider = await transport({
    outboxId: 'mail_resend',
    to: 'student@example.test',
    kind: 'verify-email',
    actionUrl: 'https://learn.pri.example/account-action#action=verify-email&token=provider-secret'
  });
  assert.equal(provider.providerMessageId, 'resend_message_1');
  assert.equal(providerRequest.url, 'https://api.resend.com/emails');
  assert.equal(providerRequest.options.headers.Authorization, 'Bearer re_test_secret');
  assert.equal(providerRequest.options.headers['Idempotency-Key'], 'pri-auth/mail_resend');
  assert.equal(providerRequest.options.headers['User-Agent'], 'Pri-Learning-Auth/1.0');
  const body = JSON.parse(providerRequest.options.body);
  assert.deepEqual(body.to, ['student@example.test']);
  assert.equal(body.from, 'Pri Learning <accounts@pri.example>');
  assert.match(body.subject, /verify/i);
  assert.match(body.text, /#action=verify-email&token=provider-secret/);

  console.log('PASS — auth delivery decrypts only at send time, uses fragment-only links + provider idempotency, retries safely and erases delivered envelopes.');
  db.close();
} finally {
  if (priorNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = priorNodeEnv;
  if (priorCsrf === undefined) delete process.env.PRI_CSRF_SECRET; else process.env.PRI_CSRF_SECRET = priorCsrf;
}
