// Pri Learning · signed out and offline: the card says the server cannot be reached, with Try again
// (launch QA 26 Nov 2026, SHOULD FIX 7).
//
// Signed out and offline the home page said "Accounts are not available on this build". Accounts are available; the device
// was offline, so the page's one probe of the server (cloudTransport.js discoverCloudOrigin) had nothing to hear. The card
// now says the server cannot be reached and offers Try again, and finds the server again when the connection returns.
// Builds the Prithagoras client, serves it from the real platform server and, in Chromium with the service worker in charge:
//   · online: the card has no notice and the email box is usable;
//   · offline, reloaded: "Pri's server can't be reached. Check your connection and try again." with a Try again button,
//     and never "not available on this build"; Try again while offline keeps that notice;
//   · back online and pressed: the notice goes and the email box is usable.
// SYNTHETIC: a local server; Playwright's offline emulation. Not device evidence.
//
// Usage: node client/test/tour-signup-offline.js
import { chromium } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startOnlinePlatform } from './support/online-session.mjs';

const CLIENT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EDITION = 'prithagoras';
let pass = 0;
const failures = [];
const check = (name, condition, detail = '') => {
  if (condition) pass++; else failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
  console.log(`  ${condition ? '✓' : '✗'} ${name}${condition || !detail ? '' : ` — ${detail}`}`);
};
function build() {
  const out = mkdtempSync(join(tmpdir(), 'pri-signup-offline-'));
  const vite = join(CLIENT, 'node_modules', 'vite', 'bin', 'vite.js');
  const result = spawnSync(process.execPath, [vite, 'build', '--outDir', out, '--emptyOutDir', '--logLevel', 'error'],
    { cwd: CLIENT, encoding: 'utf8', env: { ...process.env, PRI_EDITION: EDITION } });
  if (result.status !== 0 || !existsSync(join(out, 'index.html'))) throw new Error(`the ${EDITION} build failed:\n${result.stdout || ''}${result.stderr || ''}`);
  return out;
}

let dist = null, platform = null, browser = null, stage = 'build';
const stall = setTimeout(() => { console.log(`SIGNUP OFFLINE TOUR: FAIL — stalled at "${stage}" (${pass} checks passed)`); process.exit(1); }, 300000);
stall.unref();
try {
  dist = build();
  platform = await startOnlinePlatform({ dist, env: { PRI_EDITION: EDITION } });
  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } });
  const page = await ctx.newPage();
  stage = 'online';
  await page.goto(platform.origin, { waitUntil: 'domcontentloaded' });
  // A visitor's first screen is the question picker; the sign-in card is one click away.
  await page.locator('[data-signin-card="page"], [data-guest-try]').first().waitFor({ timeout: 30000 });
  if (await page.locator('[data-guest-try]').count()) await page.getByTestId('guest-sign-in').click();
  const card = page.locator('[data-signin-card="page"]');
  await card.waitFor({ timeout: 30000 });
  check('online: the card shows no notice and the email box is usable', await card.getByTestId('signup-unreachable').count() === 0 && await card.locator('#signup-destination').isEnabled());
  stage = 'service worker';
  const claimed = await page.waitForFunction(() => !!navigator.serviceWorker?.controller, null, { timeout: 30000 }).then(() => true).catch(() => false);
  check('the service worker is in charge of the page, so an offline open can paint', claimed);
  if (claimed) {
    await page.evaluate(() => new Promise(resolve => {
      const channel = new MessageChannel();
      channel.port1.onmessage = () => resolve(null);
      navigator.serviceWorker.controller.postMessage({ type: 'pri-warm', optional: true }, [channel.port2]);
      setTimeout(() => resolve(null), 60000);
    })).catch(() => {});
    stage = 'offline';
    await ctx.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(2500);
    if (await page.locator('[data-guest-try]').count()) await page.getByTestId('guest-sign-in').click().catch(() => {});
    const offlineCard = page.locator('[data-signin-card="page"]');
    await offlineCard.waitFor({ timeout: 20000 }).catch(() => {});
    const unreachable = offlineCard.getByTestId('signup-unreachable');
    check('offline: the card says the server cannot be reached, with a Try again button',
      await unreachable.count() === 1 && /can.t be reached/.test(await unreachable.innerText()) && await offlineCard.getByTestId('signup-try-again').count() === 1,
      (await offlineCard.innerText().catch(() => '')).slice(0, 200));
    check('offline: it never says accounts are not available on this build', !/not available on this build/.test(await page.locator('body').innerText()));
    await offlineCard.getByTestId('signup-try-again').click().catch(() => {});
    await page.waitForTimeout(1500);
    check('offline: Try again keeps the notice (nothing answered)', await offlineCard.getByTestId('signup-unreachable').count() === 1);
    stage = 'back online';
    await ctx.setOffline(false);
    await offlineCard.getByTestId('signup-try-again').click().catch(() => {});
    await page.waitForFunction(() => !document.querySelector('[data-testid="signup-unreachable"]'), null, { timeout: 15000 }).catch(() => {});
    check('back online, Try again clears the notice and the email box is usable', await offlineCard.getByTestId('signup-unreachable').count() === 0 && await offlineCard.locator('#signup-destination').isEnabled().catch(() => false));
  }
} catch (err) {
  failures.push(`the tour stopped at "${stage}": ${String(err.stack || err.message).split('\n').slice(0, 4).join(' | ')}`);
} finally {
  clearTimeout(stall);
  await browser?.close().catch(() => {});
  await platform?.close?.().catch?.(() => {});
  if (dist) rmSync(dist, { recursive: true, force: true });
}
const total = pass + failures.length;
if (failures.length) { console.log(`SIGNUP OFFLINE TOUR: FAIL — ${failures.length} of ${total} checks failed\n  · ${failures.join('\n  · ')}`); process.exit(1); }
console.log(`SIGNUP OFFLINE TOUR: PASS — ${pass}/${total} checks — signed out and offline the card says the server cannot be reached and offers Try again`);
process.exit(0);
