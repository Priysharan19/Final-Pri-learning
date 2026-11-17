// Captures the Exam Desk (Prithagoras edition) idle, reading and working states: light/dark, desktop/phone.
//   node docs/qa/2026-11-18/qa-desk.mjs [outDir]
const R = new URL('../../../', import.meta.url).pathname;
const { chromium } = await import(R + 'client/node_modules/@playwright/test/index.mjs');
const { mkdirSync, mkdtempSync } = await import('node:fs');
const { spawnSync } = await import('node:child_process');
const { tmpdir } = await import('node:os');
const { join } = await import('node:path');
const { startOnlinePlatform } = await import(R + 'client/test/support/online-session.mjs');
const { createVerifiedProfile } = await import(R + 'client/test/support/verified-onboarding.mjs');
const OUT = process.argv[2] || new URL('./desk/', import.meta.url).pathname; mkdirSync(OUT, { recursive: true });
const PAPER = '2027-mathematics-advanced-assessment-1';
const dist = mkdtempSync(join(tmpdir(), 'pri-desk-qa-'));
const b = spawnSync(process.execPath, [R + 'client/node_modules/vite/bin/vite.js', 'build', '--outDir', dist, '--emptyOutDir', '--logLevel', 'error'], { cwd: R + 'client', encoding: 'utf8', env: { ...process.env, PRI_EDITION: 'prithagoras', PRI_FEATURE_LIBRARY: '1', PRI_FEATURE_EXAM_DESK: '1' } });
if (b.status !== 0) throw new Error(b.stdout + b.stderr);
const platform = await startOnlinePlatform({ dist, env: { PRI_EDITION: 'prithagoras' } });
const browser = await chromium.launch();
for (const [vname, viewport, scheme] of [['desktop-light', { width: 1280, height: 900 }, 'light'], ['desktop-dark', { width: 1280, height: 900 }, 'dark'], ['phone-light', { width: 390, height: 844 }, 'light'], ['phone-dark', { width: 390, height: 844 }, 'dark']]) {
  const ctx = await browser.newContext({ viewport, colorScheme: scheme });
  const page = await ctx.newPage(); page.setDefaultTimeout(30000);
  await page.goto(platform.origin, { waitUntil: 'domcontentloaded' });
  await createVerifiedProfile(page, platform, { name: 'QA Student', year: 12, course: 'in' });
  await page.goto(`${platform.origin}/library/${PAPER}`, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-desk-entry] [data-desk-start]').waitFor();
  await page.screenshot({ path: `${OUT}/entry-${vname}.png`, fullPage: true });
  await page.locator('[data-desk-start]').click();
  await page.waitForURL(/\/desk\/[0-9a-f-]{36}$/); await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/idle-${vname}.png`, fullPage: true });
  await page.locator('[data-desk-intent="begin-reading"]').click(); await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/reading-${vname}.png`, fullPage: true });
  await page.locator('[data-desk-intent="begin-working"]').click(); await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/working-${vname}.png`, fullPage: true });
  await ctx.close();
}
await browser.close(); await platform.close?.(); process.exit(0);
