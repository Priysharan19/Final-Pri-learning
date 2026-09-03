import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertPlatformConfig, platformConfigStatus, platformDatabasePath } from '../platform/config.js';

const names = [
  'NODE_ENV', 'PRI_PUBLIC_ORIGIN', 'PRI_CSRF_SECRET', 'PRI_AUTH_DELIVERY_KEY', 'PRI_PLATFORM_DB',
  'PRI_RAZORPAY_MONTHLY_PLAN_ID', 'PRI_WEB_MONTHLY_PRICE_ID',
  'PRI_RAZORPAY_ANNUAL_PLAN_ID', 'PRI_WEB_ANNUAL_PRICE_ID',
  'PRI_APPLE_MONTHLY_PRODUCT_ID', 'PRI_APPLE_ANNUAL_PRODUCT_ID'
];
const prior = Object.fromEntries(names.map(name => [name, process.env[name]]));

function clearOptionalProducts() {
  for (const name of names.filter(name => /RAZORPAY|WEB_MONTHLY|WEB_ANNUAL|APPLE_MONTHLY|APPLE_ANNUAL/.test(name))) {
    delete process.env[name];
  }
}

try {
  process.env.NODE_ENV = 'production';
  process.env.PRI_PUBLIC_ORIGIN = 'https://learn.pri.example';
  process.env.PRI_CSRF_SECRET = 'csrf-production-secret';
  process.env.PRI_AUTH_DELIVERY_KEY = '33'.repeat(32);
  clearOptionalProducts();

  delete process.env.PRI_PLATFORM_DB;
  let status = platformConfigStatus();
  assert.equal(status.ok, false);
  assert.equal(status.persistentDatabaseConfigured, false);
  assert.ok(status.missing.includes('PRI_PLATFORM_DB'));
  assert.throws(() => platformDatabasePath(), error => error?.code === 'PLATFORM_DB_NOT_CONFIGURED');
  assert.throws(() => assertPlatformConfig(), /PRI_PLATFORM_DB/);

  for (const unsafe of [':memory:', 'data/pri-learning-platform.db', './server/data/pri-learning-platform.db']) {
    process.env.PRI_PLATFORM_DB = unsafe;
    status = platformConfigStatus();
    assert.equal(status.ok, false, `${unsafe}: production must reject non-persistent/relative storage`);
    assert.equal(status.persistentDatabaseConfigured, false);
    assert.throws(() => platformDatabasePath(), error => error?.code === 'PLATFORM_DB_NOT_PERSISTENT');
    assert.throws(() => assertPlatformConfig(), /absolute persistent path/);
  }

  process.env.PRI_PLATFORM_DB = '/data/pri-learning-platform.db';
  status = platformConfigStatus();
  assert.equal(status.ok, true);
  assert.equal(status.persistentDatabaseConfigured, true);
  assert.deepEqual(status.missing, []);
  assert.equal(platformDatabasePath(), '/data/pri-learning-platform.db');
  assert.equal(assertPlatformConfig().persistentDatabaseConfigured, true);

  process.env.NODE_ENV = 'development';
  delete process.env.PRI_PLATFORM_DB;
  status = platformConfigStatus();
  assert.equal(status.ok, true, 'local development may keep the repository-local default');
  assert.equal(status.persistentDatabaseConfigured, false);
  assert.equal(platformDatabasePath(), null);
  process.env.PRI_PLATFORM_DB = ':memory:';
  assert.equal(platformDatabasePath(), ':memory:', 'focused development/tests may explicitly use memory');

  const router = readFileSync(new URL('../platform/router.js', import.meta.url), 'utf8');
  assert.ok(router.includes('storage: { persistentDatabase: config.persistentDatabaseConfigured }'));
  assert.ok(!router.includes('PRI_PLATFORM_DB'), 'health must expose only readiness, never a filesystem path');

  console.log('PASS — production fails closed without an explicit absolute persistent platform DB and health exposes only storage readiness.');
} finally {
  for (const name of names) {
    if (prior[name] === undefined) delete process.env[name];
    else process.env[name] = prior[name];
  }
}
