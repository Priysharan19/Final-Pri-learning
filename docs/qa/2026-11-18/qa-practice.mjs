// Captures the Practice question and the marked-work (wrong and right) states, both themes, desktop and phone.
//   node docs/qa/2026-11-18/qa-practice.mjs [outDir]   (needs client/dist built from the tree under test)
const R = new URL('../../../', import.meta.url).pathname;
const { chromium } = await import(R + 'client/node_modules/@playwright/test/index.mjs');
const { mkdirSync } = await import('node:fs');
const { startOnlinePlatform } = await import(R + 'client/test/support/online-session.mjs');
const { createVerifiedProfile } = await import(R + 'client/test/support/verified-onboarding.mjs');
const OUT = process.argv[2] || new URL('./practice/', import.meta.url).pathname; mkdirSync(OUT, { recursive: true });
const platform = await startOnlinePlatform({ env: { PRI_EDITION: process.env.PRI_EDITION || 'priyabhata' } });
const browser = await chromium.launch();
for (const [vname, viewport, scheme] of [['desktop-light', { width: 1280, height: 900 }, 'light'], ['desktop-dark', { width: 1280, height: 900 }, 'dark'], ['phone-light', { width: 390, height: 844 }, 'light'], ['phone-dark', { width: 390, height: 844 }, 'dark']]) {
  const ctx = await browser.newContext({ viewport, colorScheme: scheme });
  const page = await ctx.newPage(); page.setDefaultTimeout(30000);
  const online = platform.session(ctx, page);
  await page.goto(platform.origin, { waitUntil: 'domcontentloaded' });
  await createVerifiedProfile(page, platform, { name: 'QA Student', year: 10, course: 'in' });
  for (const outcome of ['wrong', 'right']) {
    await page.goto(`${platform.origin}/practice`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.qpage[data-question-id] .q-prompt');
    const box = page.locator('.editor-body input.answer-input');
    let known = null;
    for (let i = 0; i < 12 && !known; i++) {
      const tab = page.locator('.mode-tab').first(); if (await tab.count()) await tab.click();
      await online.settled();
      if (await box.count() === 1) { const k = await online.answerOf(); if (k.kind === 'text' && k.text !== null) known = k; }
      if (!known) { const id = await page.locator('.qpage[data-question-id]').getAttribute('data-question-id'); await page.locator('.ctx-next').first().click(); await page.waitForFunction(x => { const e = document.querySelector('.qpage[data-question-id]'); return e && e.getAttribute('data-question-id') !== x && e.querySelector('.q-prompt'); }, id); }
    }
    if (!known) { console.log(vname, outcome, 'no typed question reached'); continue; }
    if (outcome === 'wrong') await page.screenshot({ path: `${OUT}/question-${vname}.png`, fullPage: true });
    await box.fill(outcome === 'right' ? String(known.text) : '99999');
    await page.getByRole('button', { name: /Submit answer/ }).click();
    await page.waitForSelector('.verdict-good, .verdict-bad, .eval-card, .verdict', { timeout: 30000 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/marked-${outcome}-${vname}.png`, fullPage: true });
  }
  await ctx.close();
}
await browser.close(); await platform.close?.(); process.exit(0);
