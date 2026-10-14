#!/usr/bin/env node
/**
 * Pri Learning staging first-launch PRE-FLIGHT, not full certification.
 * Read-only: health GET and browser navigation only. No OTP, cookies, test
 * account creation, paid provider calls, submission or production writes.
 *
 * Usage:
 *   node tools/acceptance/staging-student-preflight.mjs \
 *     --sha=0123456789abcdef0123456789abcdef01234567 \
 *     --origin=https://pri-learning-staging-staging.up.railway.app
 *
 * Exit 0: exact deployed SHA + initial entry UI passed on both viewports.
 * Exit 3: not the exact deployed release or missing expected student UI.
 * Exit 2: incorrect invocation or network/browser error.
 */
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../client/package.json', import.meta.url));
const { chromium } = require('@playwright/test');
const args = Object.fromEntries(process.argv.slice(2).filter(x => x.startsWith('--') && x.includes('='))
  .map(x => { const at = x.indexOf('='); return [x.slice(2, at), x.slice(at + 1)]; }));
const expected = String(args.sha || process.env.PRI_ACCEPT_SHA || '').toLowerCase();
const origin = String(args.origin || 'https://pri-learning-staging-staging.up.railway.app').replace(/\/$/, '');
if (!/^[a-f0-9]{40}$/.test(expected) || !/^https:\/\/[a-z0-9.-]+$/i.test(origin)) {
  console.error('INVOCATION ERROR: supply a 40-character reviewed --sha and HTTPS --origin.');
  process.exit(2);
}
let browser = null;
let exit = 0;
try {
  const healthResponse = await fetch(origin + '/v1/health', { signal: AbortSignal.timeout(12000) });
  if (!healthResponse.ok) throw new Error('Staging /v1/health returned HTTP ' + healthResponse.status);
  const health = await healthResponse.json();
  const actual = String(health?.releaseIdentity?.releaseSha || '').toLowerCase();
  console.log('STAGING IDENTITY', JSON.stringify({ origin, expectedSha: expected, deployedSha: actual, database: health?.database?.engine || null }));
  if (actual !== expected) {
    console.log('NOT VERIFIED: Staging is not running the reviewed candidate. No signup, grade, OCR or guardian flow was attempted.');
    process.exitCode = 3;
  } else {
    browser = await chromium.launch({ headless: true });
    for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
      const ctx = await browser.newContext({ viewport, reducedMotion: 'reduce' });
      try {
        const page = await ctx.newPage();
        const errors = [];
        page.on('pageerror', e => errors.push(String(e.message).slice(0, 140)));
        const response = await page.goto(origin + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        const card = page.locator('[data-signin-card]');
        await card.waitFor({ state: 'visible', timeout: 6000 }).catch(() => {});
        const found = await page.evaluate(() => ({
          firstCard: document.querySelector('[data-signin-card]')?.getAttribute('data-signup-step') || null,
          emailInput: !!document.querySelector('#signup-destination[type=email]'),
          sendButton: !!document.querySelector('[data-testid=signup-send-code]'),
          bypass: !!document.querySelector('[data-testid=signup-parent-later], [data-testid=signup-parent-continue]'),
          heading: [...document.querySelectorAll('h1')].some(el => /Welcome to Pri Learning/i.test(el.textContent || ''))
        }));
        const ok = response?.status() === 200 && found.firstCard === 'method' && found.emailInput
          && found.sendButton && !found.bypass && found.heading && errors.length === 0;
        console.log('FIRST-LAUNCH READ-ONLY', JSON.stringify({ viewport, ok, page: found, jsErrors: errors }));
        if (!ok) exit = 3;
      } finally { await ctx.close(); }
    }
    process.exitCode = exit;
    if (!exit) console.log('PASS: Exact staging SHA and read-only first-use entry in mobile + desktop Chromium. OTP, consent, grading, drafts and real devices remain NOT VERIFIED.');
    else console.log('NOT VERIFIED: Exact staging SHA responded but first-use entry failed. Do not accept release.');
  }
} catch (err) {
  console.error('STAGING PREFLIGHT ERROR:', String(err?.message || err).slice(0, 250));
  process.exitCode = 2;
} finally {
  if (browser) await browser.close();
}
