import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { platformConfigStatus } from '../platform/config.js';

const names = [
  'NODE_ENV', 'PRI_PUBLIC_ORIGIN', 'PRI_CSRF_SECRET', 'PRI_AUTH_DELIVERY_KEY',
  'PRI_AUTH_EMAIL_PROVIDER', 'PRI_RESEND_API_KEY', 'PRI_AUTH_EMAIL_FROM'
];
const prior = Object.fromEntries(names.map(name => [name, process.env[name]]));

try {
  process.env.NODE_ENV = 'production';
  process.env.PRI_PUBLIC_ORIGIN = 'https://learn.pri.example';
  process.env.PRI_CSRF_SECRET = 'csrf-production-secret';
  process.env.PRI_AUTH_DELIVERY_KEY = 'delivery-production-key';
  delete process.env.PRI_AUTH_EMAIL_PROVIDER;
  delete process.env.PRI_RESEND_API_KEY;
  delete process.env.PRI_AUTH_EMAIL_FROM;

  const missing = platformConfigStatus();
  assert.equal(missing.authEmailProviderConfigured, false);
  assert.ok(missing.missing.includes('PRI_AUTH_EMAIL_PROVIDER=resend'));
  assert.ok(missing.missing.includes('PRI_RESEND_API_KEY'));
  assert.ok(missing.missing.includes('PRI_AUTH_EMAIL_FROM'));

  process.env.PRI_AUTH_EMAIL_PROVIDER = 'resend';
  process.env.PRI_RESEND_API_KEY = 're_production_secret';
  process.env.PRI_AUTH_EMAIL_FROM = 'Pri Learning <accounts@pri.example>';
  const configured = platformConfigStatus();
  assert.equal(configured.authEmailProviderConfigured, true);
  assert.ok(!configured.missing.some(name => /AUTH_EMAIL|RESEND/.test(name)),
    `mail configuration should be complete: ${configured.missing.join(', ')}`);

  process.env.PRI_AUTH_EMAIL_PROVIDER = 'other-provider';
  const unsupported = platformConfigStatus();
  assert.equal(unsupported.authEmailProviderConfigured, false);
  assert.ok(unsupported.missing.includes('PRI_AUTH_EMAIL_PROVIDER=resend'));

  const server = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
  assert.ok(server.includes("import { startAuthDeliveryWorker } from './platform/authDelivery.js'"));
  assert.ok(server.includes('startAuthDeliveryWorker(platformDb);'), 'production server must actually start the auth delivery worker');

  console.log('PASS — production fails closed without Resend auth-mail configuration and server startup drains the encrypted delivery outbox.');
} finally {
  for (const name of names) {
    if (prior[name] === undefined) delete process.env[name];
    else process.env[name] = prior[name];
  }
}
