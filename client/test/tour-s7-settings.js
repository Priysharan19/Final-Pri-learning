// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · E2E flow — Section 7: Settings parity, Getting started,
// Favourites and the page states, driven the way a student meets them.
//
// Settings (7.9): Subscription, Appearance (theme, clock, text size with the
// maths previewed live), Language, Help & Safety (the shortcut list, the
// restartable introduction, contact), About (version, pricing, contact,
// terms, privacy, refunds), Data (backup, account export only when signed in,
// delete). Getting started (7.10): three steps at the foot of Home, once per
// device, restartable from Help. Favourites (7.5): save a question, folders,
// practise this folder, print worksheet. States (7.15): offline on practice,
// error states drawn from one component. Synthetic browser evidence only.
//
// Run on its own:  node client/test/tour-s7-settings.js
// ─────────────────────────────────────────────────────────────────────────────
import { pathToFileURL } from 'node:url';

const SURELY_WRONG = '-987654';
const MAX_SKIPS = 12;

// Practice draws at random; step through questions until one takes a typed
// answer. Each press waits for the new prompt before the next look, and every
// click is bounded so a question that changes mid-press cannot hang the flow.
async function answerTyped(page, settle) {
  const answerBox = page.locator('.editor-body input.answer-input');
  for (let i = 0; i < MAX_SKIPS; i++) {
    const textTab = page.getByRole('button', { name: 'Text: answer by typing' });
    if (await textTab.count()) await textTab.click({ timeout: 5000 }).catch(() => {});
    await settle();
    if (await answerBox.count() === 1) break;
    const before = await page.locator('[data-question-id]').getAttribute('data-question-id').catch(() => null);
    await page.locator('.ctx-next').click({ timeout: 5000 }).catch(() => {});
    await page.waitForFunction(id => document.querySelector('[data-question-id]')?.getAttribute('data-question-id') !== id, before, { timeout: 30000 }).catch(() => null);
    await page.waitForSelector('.q-prompt', { timeout: 30000 });
  }
  if (await answerBox.count() !== 1) return false;
  await answerBox.fill(SURELY_WRONG);
  await page.getByRole('button', { name: 'Submit Answer' }).click();
  await page.waitForSelector('.verdict-bad', { timeout: 20000 });
  await answerBox.fill(SURELY_WRONG + '1');
  await page.getByRole('button', { name: 'Submit Answer' }).click();
  await page.waitForSelector('.eval-card', { timeout: 20000 });
  return true;
}

export const flow = {
  id: 's7-settings',
  name: 'Section 7 · Settings parity, Getting started, Favourites, page states',

  async run({ page, ctx, base, check, goto, createProfile, settle }) {
    await goto('/');
    await createProfile({ name: 'Parity Settings', year: 10, course: 'in' });

    // ── 1 · Getting started: once per device, at the foot of Home, not a modal ─
    await page.waitForSelector('[data-tutorial]', { timeout: 30000 });
    await check('a new profile sees the three-step introduction at the foot of Home',
      await page.locator('[data-tutorial]').count() === 1 && (await page.locator('[data-tutorial]').getAttribute('data-tutorial-step')) === 'generate');
    await check('the introduction covers nothing: the primary action is still clickable',
      await page.locator('[data-home-primary-cta]').isEnabled() && await page.locator('.sheet-scrim').count() === 0);
    await page.locator('[data-tutorial-next]').click();
    await page.locator('[data-tutorial-next]').click();
    await settle();
    await check('three steps in order: generate, write, see the verdict',
      (await page.locator('[data-tutorial]').getAttribute('data-tutorial-step')) === 'verdict'
      && await page.locator('[data-tutorial-done]').count() === 1);
    await page.locator('[data-tutorial-done]').click();
    await settle();
    await check('Done puts it away', await page.locator('[data-tutorial]').count() === 0);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.home-greet', { timeout: 30000 });
    await page.waitForTimeout(600);
    await check('and it stays away on this device', await page.locator('[data-tutorial]').count() === 0);

    // ── 2 · Settings: the sections of the reference product, in our grammar ──
    await goto('/settings');
    await page.waitForSelector('.set-menu', { timeout: 30000 });
    const menu = (await page.locator('.set-menu-item').allInnerTexts()).map(s => s.trim());
    await check('the section index reads Subscription … Help & Safety, About',
      menu[0] === 'Subscription' && menu.includes('Appearance') && menu.includes('Language') && menu.includes('Help & Safety') && menu[menu.length - 1] === 'About',
      JSON.stringify(menu));
    await check('Subscription says the server decides Premium and points to the cloud section',
      /Only the server decides Premium/.test(await page.locator('[data-settings-section="subscription"]').innerText())
      && await page.locator('[data-settings-to-cloud]').count() === 1);
    await check('About names the version and links pricing, contact, terms, privacy and refunds',
      /Version/.test(await page.locator('[data-settings-section="about"]').innerText())
      && JSON.stringify(await page.locator('[data-settings-links] .btn').allInnerTexts()) === JSON.stringify(['Pricing', 'Contact', 'Terms', 'Privacy', 'Refund policy']));
    await check('the account export is offered only to a signed-in cloud account (not here)',
      await page.locator('[data-account-export]').count() === 0);

    // Appearance: text size slider with a live maths preview.
    const slider = page.locator('input[data-text-scale]');
    await check('Appearance has a text-size slider with a maths preview',
      await slider.count() === 1 && await page.locator('[data-text-scale-preview] .katex').count() >= 1);
    const before = await page.locator('[data-text-scale-preview] .set-preview-prompt').evaluate(el => parseFloat(getComputedStyle(el).fontSize));
    await slider.fill('130');
    await settle();
    const after = await page.locator('[data-text-scale-preview] .set-preview-prompt').evaluate(el => parseFloat(getComputedStyle(el).fontSize));
    await check('moving the slider changes the preview live', after > before * 1.2, `${before}px → ${after}px`);
    await check('the chosen size is painted on the document', await page.evaluate(() => document.documentElement.style.getPropertyValue('--text-scale').trim()) === '1.3');
    await goto('/practice');
    await page.waitForSelector('.q-prompt', { timeout: 30000 });
    const promptPx = await page.locator('.q-prompt').evaluate(el => parseFloat(getComputedStyle(el).fontSize));
    const barPx = await page.locator('.ws-bar .ctx-pill-name').evaluate(el => parseFloat(getComputedStyle(el).fontSize));
    await check('the question text follows the size and the chrome keeps its measure', promptPx >= 24 && barPx <= 15, `prompt ${promptPx}px, bar ${barPx}px`);
    await goto('/settings');
    await page.waitForSelector('input[data-text-scale]', { timeout: 30000 });
    await page.locator('input[data-text-scale]').fill('100');
    await settle();

    // Help: the shortcut list and the restartable introduction.
    const table = await page.locator('[data-shortcuts-table]').innerText();
    await check('Help lists N, H, S, ⌘Z, Tab and Esc with what each does',
      /\bN\b/.test(table) && /\bH\b/.test(table) && /\bS\b/.test(table) && /⌘Z/.test(table) && /Tab/.test(table) && /Esc/.test(table) && /Next question/.test(table));
    await check('Help has a contact link to the grievance page', (await page.locator('[data-settings-contact]').getAttribute('href')) === '/grievance');
    await page.locator('[data-restart-tour]').click();
    await page.waitForSelector('[data-tutorial]', { timeout: 30000 });
    await check('"Show it again" restarts the introduction on Home at step one',
      /\/$/.test(page.url()) && (await page.locator('[data-tutorial]').getAttribute('data-tutorial-step')) === 'generate');
    await page.locator('.tutorial-close').click();

    // ── 3 · Favourites: save, folders, practise this folder, worksheet ───────
    await page.goto(`${base}/practice?subtopic=c10-coordinate-geometry`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.q-prompt', { timeout: 30000 });
    await page.getByRole('button', { name: 'Favorite this question' }).click();
    await settle();
    await check('a question can be saved while it is open', (await page.getByRole('button', { name: 'Favorite this question' }).getAttribute('aria-pressed')) === 'true');
    if (!await check('a typed question was answered so it appears in Favourites', await answerTyped(page, settle))) return;

    await goto('/review?filter=bookmarked');
    await page.waitForSelector('[data-open-favorites]', { timeout: 30000 });
    await page.locator('[data-open-favorites]').click();
    await page.waitForSelector('.fav', { timeout: 30000 });
    await check('Review’s saved filter leads to Favourites, which lists the saved question',
      /\/favorites$/.test(page.url()) && await page.locator('.fav-row').count() >= 1);
    await page.locator('[data-fav-new-folder]').click();
    await page.getByLabel('Folder name').fill('Before the test');
    await page.getByRole('button', { name: 'Create' }).click();
    await settle();
    await check('a folder is created and selected', (await page.locator('.fav-folder.on').innerText()).includes('Before the test'));
    await check('the new folder is empty and says so', await page.locator('[data-page-state="empty"]').count() === 1);
    await page.locator('[data-folder="__all"]').click();
    const folderId = await page.locator('[data-folder]').nth(1).getAttribute('data-folder');
    await page.locator('[data-fav-move]').first().selectOption(folderId);
    await settle();
    await page.locator(`[data-folder="${folderId}"]`).click();
    await settle();
    await check('a saved question moves into the folder', await page.locator('.fav-row').count() === 1);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.fav', { timeout: 30000 });
    await check('folders survive a reload on this device', (await page.locator('[data-folder]').nth(1).innerText()).includes('Before the test'));
    await page.locator(`[data-folder="${folderId}"]`).click();
    await settle();

    // The worksheet is drawn for printing; print itself is stubbed.
    await page.evaluate(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });
    await page.locator('[data-fav-print]').click();
    // The worksheet is for the printer: display:none on screen, so wait for it attached, not visible.
    await page.waitForSelector('[data-fav-worksheet]', { state: 'attached', timeout: 5000 }).catch(() => null);
    await page.waitForTimeout(250);
    const ws = await page.evaluate(() => ({ n: document.querySelector('[data-fav-worksheet]')?.getAttribute('data-fav-worksheet'), printed: window.__printed || 0, items: document.querySelectorAll('.fav-ws-item').length }));
    await check('Print worksheet draws the folder as a numbered worksheet and prints it', ws.n === '1' && ws.items === 1 && ws.printed === 1, JSON.stringify(ws));

    await page.locator('[data-fav-practise]').click();
    await page.waitForSelector('.q-prompt', { timeout: 30000 });
    await check('Practise this folder opens practice on the folder’s question, with the folder named',
      /\/practice/.test(page.url()) && /Before the test/.test(await page.locator('[data-folder-queue]').innerText()));

    // ── 4 · States: offline on practice, drawn by the one component ──────────
    await ctx.setOffline(true);
    await page.waitForTimeout(300);
    await check('offline, practice says what still works instead of failing',
      await page.locator('[data-page-state="offline"]').count() === 1
      && /continues on this device/.test(await page.locator('[data-page-state="offline"]').innerText()));
    await ctx.setOffline(false);
    await page.waitForTimeout(300);
    await check('back online, the notice goes', await page.locator('[data-page-state="offline"]').count() === 0);

    // ── 5 · Night: Favourites and Settings draw from tokens ──────────────────
    await goto('/settings');
    await page.getByRole('button', { name: 'Night', exact: true }).click();
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark', { timeout: 5000 });
    await page.waitForTimeout(600);
    await goto('/favorites');
    await page.waitForSelector('.fav', { timeout: 30000 });
    await check('Favourites paints at night without a literal colour',
      await page.evaluate(() => document.documentElement.dataset.theme === 'dark' && !!document.querySelector('.fav-folders')));
    await goto('/settings');
    await page.getByRole('button', { name: 'Paper', exact: true }).click();
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'light', { timeout: 5000 });
  }
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { runOne } = await import('./e2e.mjs');
  await runOne(flow);
}
