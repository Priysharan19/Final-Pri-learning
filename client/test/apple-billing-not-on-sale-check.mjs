// When the deployment sells no App Store subscription (server billing not
// configured, no product ids, or StoreKit returns none of them), the plan
// panel must say Premium is not on sale — not show a red error, buy buttons
// or a disabled Restore button that cannot work (App Review 2.1).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../src/components/CloudAccountPanel.jsx', import.meta.url), 'utf8');
const en = readFileSync(new URL('../src/i18n/strings.en.js', import.meta.url), 'utf8');
const hi = readFileSync(new URL('../src/i18n/strings.hi.js', import.meta.url), 'utf8');
assert.match(src, /err\?\.code === 'BILLING_PROVIDER_NOT_CONFIGURED'\) return \{ notOnSale: true \}/);
assert.match(src, /!productIds\.length\) return \{ notOnSale: true \}/);
assert.match(src, /notOnSale: !products\.length/);
assert.match(src, /nativeStoreKit && appleNotOnSale && <div[^>]*>\s*\{t\('cloud\.appleNotOnSale'\)\}/);
assert.match(src, /nativeStoreKit && !appleNotOnSale && <div/, 'buy and restore buttons render only when something is on sale');
assert.doesNotMatch(src, /storefrontMissing/);
for (const cat of [en, hi]) assert.match(cat, /'cloud\.appleNotOnSale':/);
console.log('APPLE NOT-ON-SALE: PASS — no error, buttons or restore when no App Store subscription is on sale');
