// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the built app starts and its main screens render, in both editions.
//
// Why this exists: a one-word missing import (setLanguage in i18n/index.js)
// reached a release train as a ReferenceError that put every student on the
// crash screen, and no suite noticed because the suites that load the app were
// not the ones run before the train. This one is cheap and has one job: build
// each edition, sign a student in, walk the main routes in Chromium, and fail on
//   · any uncaught page error,
//   · any console error that is a JavaScript fault (ReferenceError, TypeError…),
//   · the crash screen (.crash-card) on any route.
//
// SYNTHETIC: Playwright Chromium against the real test platform. Not evidence
// about a device or a real provider.
//
// Usage: node client/test/app-boot-smoke-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { startOnlinePlatform } from './support/online-session.mjs';
import { createVerifiedProfile } from './support/verified-onboarding.mjs';

const CLIENT = fileURLToPath(new URL('..', import.meta.url));
const ROUTES = ['/', '/today', '/map', '/practice', '/notes', '/paper-generator', '/exams', '/progress', '/settings'];
const failures = [];
let pass = 0;
const check = (ok, label) => { if (ok) pass++; else { failures.push(label); console.log(`  ✗ ${label}`); } };

function build(edition) {
  const out = mkdtempSync(join(tmpdir(), `pri-smoke-${edition}-`));
  const vite = join(CLIENT, 'node_modules', 'vite', 'bin', 'vite.js');
  const r = spawnSync(process.execPath, [vite, 'build', '--outDir', out, '--emptyOutDir', '--logLevel', 'error'],
    { cwd: CLIENT, encoding: 'utf8', env: { ...process.env, PRI_EDITION: edition } });
  if (r.status !== 0 || !existsSync(join(out, 'index.html'))) throw new Error(`the ${edition} build failed:\n${r.stdout || ''}${r.stderr || ''}`);
  return out;
}

const JS_FAULT = /\b(ReferenceError|TypeError|SyntaxError|RangeError|is not defined|is not a function|Cannot read propert)/;

for (const edition of (process.env.PRI_EDITIONS || 'priyabhata,prithagoras').split(',')) {
  console.log(edition);
  const platform = await startOnlinePlatform({ dist: build(edition), env: { PRI_EDITION: edition } });
  const browser = await chromium.launch();
  try {
    const page = await (await browser.newContext({ viewport: { width: 1180, height: 860 } })).newPage();
    page.setDefaultTimeout(30000);
    const faults = [];
    page.on('pageerror', e => faults.push(`pageerror: ${String(e.message).slice(0, 200)}`));
    page.on('console', m => { if (m.type() === 'error' && JS_FAULT.test(m.text())) faults.push(`console: ${m.text().slice(0, 200)}`); });

    await page.goto(platform.origin, { waitUntil: 'domcontentloaded' });
    // A visitor's first screen is the question picker (ADR-0003); the sign-in card is one click away.
    await page.waitForSelector('[data-guest-try], [data-signin-card="page"], .crash-card', { timeout: 30000 });
    check(await page.locator('.crash-card').count() === 0, `${edition}: first load is not the crash screen`);
    // Prithagoras opens on a question the server has drawn (or its choices when none can be); Priyabhata on the picker.
    if (edition === 'prithagoras') await page.waitForSelector('[data-guest-question], [data-guest-chooser]', { timeout: 30000 });
    check(await page.locator(edition === 'prithagoras' ? '[data-guest-try] [data-guest-question], [data-guest-try] [data-guest-chooser]' : '[data-guest-try] [data-question-picker]').count() === 1, `${edition}: a device with no profile opens on ${edition === 'prithagoras' ? 'a question' : 'the question picker'}`);
    check(faults.length === 0, `${edition}: first load raises no JavaScript error ${faults.join(' | ')}`);

    await createVerifiedProfile(page, platform, { name: 'Smoke Student', year: 10, course: 'in' });
    for (const route of ROUTES) {
      faults.length = 0;
      await page.goto(platform.origin + route, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.shell, .crash-card');
      await page.waitForTimeout(700);
      check(await page.locator('.crash-card').count() === 0, `${edition} ${route}: not the crash screen`);
      check(faults.length === 0, `${edition} ${route}: no JavaScript error ${faults.join(' | ')}`);
    }
  } finally { await browser.close(); await platform.close?.(); }
}
if (failures.length) { console.log(`\nAPP BOOT SMOKE: FAIL — ${failures.length} of ${pass + failures.length}`); process.exit(1); }
console.log(`\nAPP BOOT SMOKE: PASS — ${pass} checks, both editions, no page error, no crash screen`);
process.exit(0);
