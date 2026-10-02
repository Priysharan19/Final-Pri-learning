// Pri Learning · device side of the StoreKit entitlement contract (§19)
//
// The device never decides Premium; it files the snapshot the server issued
// for the account linked to a local profile, and it never opens web checkout
// inside a native shell. This suite proves:
//   · a snapshot answered for a different account (the device-wide session now
//     belongs to another profile's account) is refused, not filed — Premium
//     cannot leak between two students on one iPad;
//   · a Premium snapshot that does not say whose it is is refused;
//   · a tampered local cache is overwritten by the server's answer on the next
//     refresh, and the offline window is bounded to seven days from issue;
//   · createWebBillingCheckout refuses inside a native shell without a request.
import { installBrowserEnv, resetStorage } from './backend-check.mjs';

installBrowserEnv();
resetStorage();
globalThis.__PRI_CLOUD_ORIGIN__ = 'https://pri.example.test';

const { get, put } = await import('../src/local/idb.js');
const { cloudAccountLink, loginCloudAccount, refreshCloudEntitlement, cloudLinkRowId } = await import('../src/platform/cloudAccount.js');
const { cloud } = await import('../src/platform/cloudTransport.js');
const { normalizeEntitlementSnapshot, MAX_OFFLINE_MS } = await import('../src/platform/entitlements.js');
const { cloudEntitlement, configureEntitlementGate, requireCapability } = await import('../src/local/entitlementGate.js');
const { ENTITLEMENTS } = await import('../src/platform/entitlements.js');

const DAY = 86_400_000;
const account = { id: 'acct-A', email: 'a@example.test', name: 'A', role: 'student', emailVerified: true };
let answer = { accountId: 'acct-A', entitlement: { plan: 'free', status: 'free', provider: 'none', sourceVersion: 0 } };
const requested = [];

const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
globalThis.fetch = async (url) => {
  const path = new URL(url).pathname;
  requested.push(path);
  if (path === '/v1/account/login' || path === '/v1/account/me') return json({ account });
  if (path === '/v1/entitlements') return json(answer);
  if (path === '/v1/billing/checkout/web') return json({ checkout: { url: 'https://checkout.example.test' } }, 201);
  return json({ error: { code: 'NOT_FOUND', message: path } }, 404);
};

let pass = 0;
const failures = [];
const ok = (name, condition, detail = '') => { if (condition) pass++; else failures.push(`${name}${detail ? ` — ${detail}` : ''}`); };
async function code(fn) { try { await fn(); return null; } catch (error) { return error?.code || error?.message; } }

const now = Date.now();
const premium = (extra = {}) => ({
  plan: 'premium', status: 'active', provider: 'apple', currentPeriodEnd: now + 30 * DAY,
  offlineUntil: now + 7 * DAY, issuedAt: now, sourceVersion: 4, capabilities: [], ...extra
});

await put('profiles', { id: 'p1', name: 'Student A', year: 10, course: 'in' });
await loginCloudAccount('p1', { email: account.email, password: 'pw-not-stored' });
ok('profile is linked to account A', (await cloudAccountLink('p1'))?.accountId === 'acct-A');

// 1. Another account's Premium is never filed under this profile.
answer = { accountId: 'acct-B', entitlement: premium() };
ok('a snapshot for another account is refused', await code(() => refreshCloudEntitlement('p1')) === 'CLOUD_ACCOUNT_MISMATCH');
ok('and nothing was filed', (await cloudEntitlement('p1', now)).active === false);

// 2. A Premium answer that names no account is refused; a free one is harmless.
answer = { entitlement: premium() };
ok('an unattributed Premium snapshot is refused', await code(() => refreshCloudEntitlement('p1')) === 'CLOUD_ACCOUNT_MISMATCH');
answer = { entitlement: { plan: 'free', status: 'free', provider: 'none', sourceVersion: 1 } };
ok('an unattributed free snapshot is accepted', await code(() => refreshCloudEntitlement('p1')) === null);

// 3. The linked account's own Premium is filed and honoured.
answer = { accountId: 'acct-A', entitlement: premium() };
await refreshCloudEntitlement('p1');
ok('the account\'s own Premium is filed', (await cloudEntitlement('p1', now)).active === true);

// 4. A tampered local cache: the student edits IndexedDB to a year of Premium.
const id = cloudLinkRowId('p1');
const row = await get('device', id);
await put('device', { ...row, entitlement: premium({ currentPeriodEnd: now + 365 * DAY, offlineUntil: now + 365 * DAY, issuedAt: now }) });
ok('the offline window is bounded to seven days from issue', normalizeEntitlementSnapshot(premium({ offlineUntil: now + 365 * DAY }), now).offlineUntil === now + MAX_OFFLINE_MS);
ok('so a stretched offline window lapses after seven days', (await cloudEntitlement('p1', now + 8 * DAY)).active === false);
// The next refresh replaces the cache with the server's truth (a refund).
answer = { accountId: 'acct-A', entitlement: { plan: 'free', status: 'revoked', provider: 'apple', sourceVersion: 9 } };
await refreshCloudEntitlement('p1');
ok('the next server refresh overwrites the tampered cache', (await cloudEntitlement('p1', now)).status === 'revoked');
configureEntitlementGate({ now: () => now, online: () => true });
ok('and the Premium gate then refuses', await code(() => requireCapability({ id: 'p1' }, ENTITLEMENTS.PREMIUM_EXAMS, now)) === 'PREMIUM_REQUIRED');
configureEntitlementGate({});

// 5. Web checkout is never opened inside a native shell.
const scope = typeof window !== 'undefined' && window ? window : globalThis;
scope.__PRI_NATIVE__ = true;
requested.length = 0;
ok('native shell: web checkout is refused on the device', await code(() => cloud.createWebBillingCheckout('monthly')) === 'BILLING_WEB_CHECKOUT_NATIVE_REFUSED');
ok('native shell: no checkout request left the device', !requested.includes('/v1/billing/checkout/web'));
delete scope.__PRI_NATIVE__;
ok('browser: web checkout is still requested', await code(() => cloud.createWebBillingCheckout('monthly')) === null && requested.includes('/v1/billing/checkout/web'));

if (failures.length) {
  console.error(`STOREKIT ENTITLEMENT CLIENT: FAIL — ${failures.length} of ${pass + failures.length} checks\n  · ${failures.join('\n  · ')}`);
  process.exit(1);
}
console.log(`STOREKIT ENTITLEMENT CLIENT: PASS — ${pass}/${pass} checks — another account's Premium is never filed under a profile, a stretched offline window lapses after seven days, a tampered cache is overwritten by the server, and web checkout never leaves a native shell.`);
