import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { commercialConfig } from '../../server/platform/billing.js';
import { normalizeCommercialDisplay } from '../src/platform/entitlements.js';

const names = [
  'PRI_DISPLAY_CURRENCY', 'PRI_DISPLAY_MONTHLY_PRICE',
  'PRI_DISPLAY_ANNUAL_PRICE', 'PRI_DISPLAY_TRIAL_DAYS'
];
const prior = Object.fromEntries(names.map(name => [name, process.env[name]]));
try {
  for (const name of names) delete process.env[name];
  const empty = commercialConfig().display;
  assert.equal(empty.monthly, null, 'monthly price must not fall back to a hard-coded commercial amount');
  assert.equal(empty.annual, null, 'annual price must not fall back to a hard-coded commercial amount');
  assert.equal(empty.trialDays, null, 'trial duration must not fall back to a hard-coded commercial term');

  process.env.PRI_DISPLAY_CURRENCY = 'INR';
  process.env.PRI_DISPLAY_MONTHLY_PRICE = '1234';
  process.env.PRI_DISPLAY_ANNUAL_PRICE = '9876';
  process.env.PRI_DISPLAY_TRIAL_DAYS = '9';
  const configured = commercialConfig().display;
  assert.deepEqual(
    { currency: configured.currency, monthly: configured.monthly, annual: configured.annual, trialDays: configured.trialDays },
    { currency: 'INR', monthly: 1234, annual: 9876, trialDays: 9 }
  );

  const client = normalizeCommercialDisplay(configured);
  assert.equal(client.monthly, 1234);
  assert.equal(client.annual, 9876);
  assert.equal(client.trialDays, 9);

  const entitlementSource = readFileSync(new URL('../src/platform/entitlements.js', import.meta.url), 'utf8');
  const panelSource = readFileSync(new URL('../src/components/CloudAccountPanel.jsx', import.meta.url), 'utf8');
  assert.ok(!entitlementSource.includes('monthlyDisplay'), 'client entitlement authority must not carry commercial display defaults');
  assert.ok(!entitlementSource.includes('annualDisplay'), 'client entitlement authority must not carry commercial display defaults');
  assert.ok(!panelSource.includes('DEFAULT_PUBLIC_PRICING'), 'Settings must render server/storefront pricing rather than a client constant');

  console.log('PASS — billing display terms are deployment-configured and client rendering has no hard-coded price authority.');
} finally {
  for (const name of names) {
    if (prior[name] === undefined) delete process.env[name];
    else process.env[name] = prior[name];
  }
}
