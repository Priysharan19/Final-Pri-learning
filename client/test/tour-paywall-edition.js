// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the Premium screen in an edition with nothing to sell (plan E5)
//
// Prithagoras has no payment provider until the owner chooses one (decision
// O2). This builds the client for Prithagoras, serves it from the real
// platform server running as Prithagoras, signs a student in and looks at
// what that student can see and do:
//
//   · the Premium screen says Premium is not on sale yet, keeps the free and
//     Premium comparison, the legal links and a working close button, and
//     shows no price, plan, purchase or restore control;
//   · the account panel in Settings says the same and offers no checkout;
//   · a shell that announces App Store billing is given no store: the screen
//     stays the same and the shell's billing bridge is never called;
//   · the server tells the page nothing is available and refuses a checkout
//     the page tries anyway;
//   · CONTROL: the same announced shell on a Priyabhata build and server does
//     select the App Store and does ask for its bootstrap, so the silence
//     above is the edition's doing and not a probe that could never fire.
//
// WHAT IS REAL: the built Prithagoras client, the platform server and its
// SQLite database, the account. WHAT IS SYNTHETIC: the "native shell" is two
// globals set in a desktop browser; no iPad, App Store, payment provider or
// student is involved and none is claimed.
//
// Run:  node client/test/tour-paywall-edition.js
// ─────────────────────────────────────────────────────────────────────────────
import { chromium } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startOnlinePlatform } from './support/online-session.mjs';
import { createVerifiedProfile } from './support/verified-onboarding.mjs';

const CLIENT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EDITION = 'prithagoras';
const en = (await import('../src/i18n/strings.en.js')).default;
// A currency amount in any form the app could print one.
const AMOUNT = /[₹$]\s?\d|\b(?:INR|AUD|Rs\.?)\s?\d/;

let pass = 0;
const failures = [];
const check = (name, condition, detail = '') => {
  if (condition) pass++; else failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
  console.log(`  ${condition ? '✓' : '✗'} ${name}${condition || !detail ? '' : ` — ${detail}`}`);
};

function build(edition = EDITION) {
  const out = mkdtempSync(join(tmpdir(), `pri-paywall-${edition}-`));
  const vite = join(CLIENT, 'node_modules', 'vite', 'bin', 'vite.js');
  const result = spawnSync(process.execPath, [vite, 'build', '--outDir', out, '--emptyOutDir', '--logLevel', 'error'],
    { cwd: CLIENT, encoding: 'utf8', env: { ...process.env, PRI_EDITION: edition } });
  if (result.status !== 0 || !existsSync(join(out, 'index.html'))) throw new Error(`the ${edition} build failed:\n${result.stdout || ''}${result.stderr || ''}`);
  return out;
}

const visibleText = (page, selector) => page.evaluate(sel => [...document.querySelectorAll(sel)]
  .filter(el => el.getClientRects().length > 0).map(el => el.innerText).join(' ').replace(/\s+/g, ' ').trim(), selector);
const shown = (page, selector) => page.evaluate(sel => [...document.querySelectorAll(sel)].filter(el => el.getClientRects().length > 0).length, selector);
const enabledButtons = (page, selector) => page.evaluate(sel => [...document.querySelectorAll(`${sel} button, ${sel} [role="button"]`)]
  .filter(el => el.getClientRects().length > 0 && !el.disabled).map(el => (el.innerText || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim()), selector);

/** A shell that announces App Store billing; every bridge message is kept. */
async function announcedShell(browser, platform, name) {
  const shell = await browser.newContext({ viewport: { width: 1024, height: 1366 } });
  await shell.addInitScript(() => {
    window.__PRI_BILLING_BRIDGE_CALLS__ = [];
    window.__PRI_NATIVE_BILLING__ = true;
    window.webkit = { messageHandlers: { priBilling: { postMessage(message) { window.__PRI_BILLING_BRIDGE_CALLS__.push(message); } } } };
  });
  const tablet = await shell.newPage();
  const requests = [];
  tablet.on('request', request => { const url = new URL(request.url()); if (url.pathname.startsWith('/v1/billing/')) requests.push(`${request.method()} ${url.pathname}`); });
  await tablet.goto(platform.origin, { waitUntil: 'domcontentloaded' });
  await tablet.waitForSelector('.auth-wrap, .shell', { timeout: 30000 });
  await createVerifiedProfile(tablet, platform, { name, year: 10, fromPicker: await tablet.getByTestId('picker-create-account').count() > 0 });
  await tablet.goto(`${platform.origin}/premium`, { waitUntil: 'domcontentloaded' });
  await tablet.waitForSelector('[data-paywall] [data-paywall-close]', { timeout: 30000 });
  await tablet.waitForTimeout(1200);
  return { shell, tablet, requests };
}

let dist = null;
let control = null;
let platform = null;
let browser = null;
try {
  dist = build();
  const features = JSON.parse(readFileSync(join(dist, 'features.json'), 'utf8'));
  check('the build under test is the Prithagoras build', features.edition === EDITION, JSON.stringify(features.edition));
  platform = await startOnlinePlatform({ dist, env: { PRI_EDITION: EDITION } });
  browser = await chromium.launch();

  // ── a student in the browser ───────────────────────────────────────────────
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const billing = [];
  page.on('response', async response => {
    const url = new URL(response.url());
    if (!url.pathname.startsWith('/v1/billing/')) return;
    billing.push({ method: response.request().method(), path: url.pathname, status: response.status(), body: await response.text().catch(() => '') });
  });
  await page.goto(platform.origin, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.auth-wrap, .shell', { timeout: 30000 });
  await createVerifiedProfile(page, platform, { name: 'Edition Student', year: 10, fromPicker: await page.getByTestId('picker-create-account').count() > 0 });

  await page.goto(`${platform.origin}/premium`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-paywall] [data-paywall-close]', { timeout: 30000 });
  await page.waitForTimeout(800);
  const paywall = await visibleText(page, '[data-paywall]');
  check('the Premium screen says Premium is not on sale yet', await shown(page, '[data-paywall-not-on-sale]') === 1 && paywall.includes(en['paywall.notOnSale']), paywall.slice(0, 300));
  check('it shows no currency amount', !AMOUNT.test(paywall), (paywall.match(AMOUNT) || [])[0]);
  check('it shows no plan, purchase, restore, renewal terms or "buy it in the app" line',
    await shown(page, '[data-paywall-plan], [data-paywall-plans], [data-paywall-buy], [data-paywall-restore], [data-paywall-disclosure], [data-paywall-in-app], [data-paywall-manage]') === 0);
  check('the screen is the web one: no store is selected', await page.locator('[data-paywall]').getAttribute('data-paywall-store') === 'web');
  const paywallButtons = await enabledButtons(page, '[data-paywall]');
  check('the only button that can be pressed is Close', paywallButtons.length === 1 && paywallButtons[0] === en['paywall.close'], JSON.stringify(paywallButtons));
  check('it still says what the free plan includes and what Premium adds', await shown(page, '[data-paywall-free] li') >= 4 && await shown(page, '[data-paywall-premium-rows] li') >= 5);
  check('Terms, Privacy and Refunds are still linked', await shown(page, '[data-paywall-legal] a') === 3);
  await page.locator('[data-paywall-close]').click();
  await page.waitForFunction(() => !document.querySelector('[data-paywall]'), null, { timeout: 15000 }).catch(() => {});
  check('Close leaves the screen', await page.locator('[data-paywall]').count() === 0, page.url());

  // ── the account panel ──────────────────────────────────────────────────────
  await page.goto(`${platform.origin}/settings`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#cloud-account-title', { timeout: 30000 });
  await page.waitForSelector('[data-premium-not-on-sale]', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(800);
  const settings = await visibleText(page, 'main');
  check('the account panel says Premium is not on sale yet', await shown(page, '[data-premium-not-on-sale]') === 1, settings.slice(0, 200));
  check('Settings shows no currency amount', !AMOUNT.test(settings), (settings.match(AMOUNT) || [])[0]);
  const purchaseLabels = [en['cloud.restoreWeb'], en['cloud.restoreApple'], en['cloud.restoreGoogle'], en['cloud.cancelSubscription'], en['paywall.restore']].filter(Boolean);
  const settingsButtons = await enabledButtons(page, 'main');
  check('Settings offers no purchase, restore or cancel-subscription button',
    !settingsButtons.some(label => purchaseLabels.includes(label) || /per month|per year|a month|a year|subscribe/i.test(label)) && await shown(page, '[data-google-play-billing]') === 0,
    JSON.stringify(settingsButtons.filter(label => purchaseLabels.includes(label))));

  // ── what the server told the page, and what it does to a checkout anyway ──
  const configs = billing.filter(entry => entry.path === '/v1/billing/config');
  check('the server told the page nothing is available, in AUD, with no product',
    configs.length >= 1 && configs.every(entry => { const c = JSON.parse(entry.body); return c.available === false && c.display.currency === 'AUD' && c.display.monthly === null && Object.values(c.products).every(v => v === null) && c.webCheckout.provider === null; }),
    JSON.stringify(configs.map(entry => entry.body.slice(0, 120))));
  check('the page asked the server for no purchase, bootstrap, restore or checkout',
    billing.every(entry => entry.method === 'GET' && ['/v1/billing/config', '/v1/billing/status', '/v1/billing/manage'].includes(entry.path)), JSON.stringify(billing.map(entry => `${entry.method} ${entry.path}`)));
  const forced = await page.evaluate(async () => {
    const csrf = (document.cookie.split('; ').find(c => c.startsWith('pri_csrf=')) || '').slice('pri_csrf='.length);
    const out = [];
    for (const [method, path] of [['POST', '/v1/billing/checkout/web'], ['GET', '/v1/billing/apple/bootstrap'], ['GET', '/v1/billing/google/bootstrap'], ['POST', '/v1/billing/restore/web']]) {
      const response = await fetch(path, { method, credentials: 'include', headers: { 'content-type': 'application/json', 'x-pri-csrf': csrf }, body: method === 'POST' ? JSON.stringify({ cadence: 'monthly' }) : undefined });
      out.push({ path, status: response.status, code: (await response.json().catch(() => null))?.error?.code || null });
    }
    return out;
  });
  check('a checkout, bootstrap or restore the signed-in page sends anyway is refused by the server',
    forced.every(entry => entry.status === 404 && entry.code === 'BILLING_NOT_AVAILABLE_IN_EDITION'), JSON.stringify(forced));
  await ctx.close();

  // ── a shell that announces App Store billing ───────────────────────────────
  const { shell, tablet, requests: shellBilling } = await announcedShell(browser, platform, 'Shell Student');
  const shellPaywall = await visibleText(tablet, '[data-paywall]');
  check('with a billing bridge announced, the screen still selects no store and says not on sale',
    await tablet.locator('[data-paywall]').getAttribute('data-paywall-store') === 'web' && await shown(tablet, '[data-paywall-not-on-sale]') === 1 && !AMOUNT.test(shellPaywall), shellPaywall.slice(0, 200));
  check('and shows no purchase or restore control', await shown(tablet, '[data-paywall-plan], [data-paywall-buy], [data-paywall-restore], [data-paywall-disclosure]') === 0);
  await tablet.goto(`${platform.origin}/settings`, { waitUntil: 'domcontentloaded' });
  await tablet.waitForSelector('#cloud-account-title', { timeout: 30000 });
  await tablet.waitForTimeout(1200);
  const bridgeCalls = await tablet.evaluate(() => window.__PRI_BILLING_BRIDGE_CALLS__.length);
  check('the billing bridge was never called: no product, price, purchase or restore was asked of the store', bridgeCalls === 0, `${bridgeCalls} calls`);
  check('and the server was asked for no store bootstrap', !shellBilling.some(entry => /bootstrap|transaction|purchase|restore|checkout/.test(entry)), JSON.stringify(shellBilling));
  await shell.close();
  await platform.close();
  platform = null;

  // ── CONTROL: the same shell where Premium is on sale ───────────────────────
  control = build('priyabhata');
  platform = await startOnlinePlatform({ dist: control, env: { PRI_EDITION: null } });
  const india = await announcedShell(browser, platform, 'Control Student');
  await india.tablet.waitForFunction(() => document.querySelector('[data-paywall-not-on-sale], [data-paywall-plans] p, [data-paywall-plan]'), null, { timeout: 15000 }).catch(() => {});
  check('CONTROL: on a Priyabhata build the same shell selects the App Store', await india.tablet.locator('[data-paywall]').getAttribute('data-paywall-store') === 'app-store' && await shown(india.tablet, '[data-paywall-in-app]') === 0);
  check('CONTROL: and its server is asked for the App Store bootstrap', india.requests.includes('GET /v1/billing/apple/bootstrap'), JSON.stringify(india.requests));
  await india.shell.close();
} catch (error) {
  failures.push(`the tour stopped: ${String(error?.stack || error).split('\n').slice(0, 4).join(' | ')}`);
} finally {
  await browser?.close().catch(() => {});
  await platform?.close?.().catch(() => {});
  for (const dir of [dist, control]) if (dir) rmSync(dir, { recursive: true, force: true });
}

if (failures.length) {
  console.log('\nfailures:');
  for (const line of failures) console.log(`  ${line}`);
}
console.log(`\nPAYWALL PER EDITION: ${failures.length ? 'FAIL' : 'PASS'} — ${pass}/${pass + failures.length} checks — SYNTHETIC shell; a built Prithagoras client on the real platform server shows no price, plan or purchase control and reaches no store; the same shell on a Priyabhata build does`);
process.exit(failures.length ? 1 : 0);
