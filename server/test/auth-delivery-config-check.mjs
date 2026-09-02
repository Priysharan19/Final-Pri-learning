import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPlatformDb } from '../platform/db.js';
import { platformConfigStatus } from '../platform/config.js';
import { startAuthDeliveryWorker } from '../platform/authDelivery.js';

const names = [
  'NODE_ENV', 'PRI_PUBLIC_ORIGIN', 'PRI_CSRF_SECRET', 'PRI_AUTH_DELIVERY_KEY',
  'PRI_AUTH_EMAIL_PROVIDER', 'PRI_RESEND_API_KEY', 'PRI_AUTH_EMAIL_FROM'
];
const prior = Object.fromEntries(names.map(name => [name, process.env[name]]));

try {
  process.env.NODE_ENV = 'production';
  process.env.PRI_PUBLIC_ORIGIN = 'https://learn.pri.example';
  process.env.PRI_CSRF_SECRET = 'csrf-production-secret';
  process.env.PRI_AUTH_DELIVERY_KEY = '22'.repeat(32);
  delete process.env.PRI_AUTH_EMAIL_PROVIDER;
  delete process.env.PRI_RESEND_API_KEY;
  delete process.env.PRI_AUTH_EMAIL_FROM;

  const missing = platformConfigStatus();
  assert.equal(missing.authEmailProviderConfigured, false);
  // Router-only contracts remain isolated from delivery-provider credentials.
  assert.ok(!missing.missing.some(name => /AUTH_EMAIL|RESEND/.test(name)));

  const db = createPlatformDb(':memory:');
  assert.throws(
    () => startAuthDeliveryWorker(db, { send: null, publicOrigin: process.env.PRI_PUBLIC_ORIGIN }),
    error => error?.code === 'AUTH_EMAIL_NOT_CONFIGURED',
    'the full production server boundary must fail closed when no mail transport exists'
  );

  process.env.PRI_AUTH_EMAIL_PROVIDER = 'resend';
  process.env.PRI_RESEND_API_KEY = 're_production_secret';
  process.env.PRI_AUTH_EMAIL_FROM = 'Pri Learning <accounts@pri.example>';
  const configured = platformConfigStatus();
  assert.equal(configured.authEmailProviderConfigured, true);

  const worker = startAuthDeliveryWorker(db, {
    publicOrigin: process.env.PRI_PUBLIC_ORIGIN,
    send: async () => ({ providerMessageId: 'test-only' }),
    intervalMs: 300_000
  });
  assert.equal(worker.enabled, true);
  worker.stop();
  db.close();

  process.env.PRI_AUTH_EMAIL_PROVIDER = 'other-provider';
  const unsupported = platformConfigStatus();
  assert.equal(unsupported.authEmailProviderConfigured, false);

  const server = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
  assert.ok(server.includes("import { startAuthDeliveryWorker } from './platform/authDelivery.js'"));
  assert.ok(server.includes('startAuthDeliveryWorker(platformDb);'), 'production server must actually start the auth delivery worker');

  console.log('PASS — router contracts stay isolated, while full production startup fails closed unless auth-email delivery is configured.');
} finally {
  for (const name of names) {
    if (prior[name] === undefined) delete process.env[name];
    else process.env[name] = prior[name];
  }
}
