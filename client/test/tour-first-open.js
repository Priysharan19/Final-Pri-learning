// Pri Learning · E2E flow — the instrument build's once-only first-open moment
// (instrument/FirstOpen.jsx), with PRI_FEATURE_INSTRUMENT on.
//
// Every other journey starts past this moment (support/verified-onboarding.mjs
// passFirstOpen). This one does not, and checks the moment itself:
//   · it appears on a first open, before sign-in, exactly once;
//   · while it shows, the page behind is inert; after it closes, it is not;
//   · Escape skips it, and so does Skip; focus moves to the sign-in heading;
//   · the pad acknowledges ink without claiming to read it;
//   · it does not come back on reload;
//   · and sign-in then completes as usual.
//
// Usage: node client/test/tour-first-open.js
import { pathToFileURL } from 'node:url';
import en from '../src/i18n/strings.en.js';

const KEY = 'pri.firstOpen.v1';
const DIALOG = '[data-first-open]';
const backgroundInert = page => page.evaluate(sel => {
  const dialog = document.querySelector(sel);
  const others = [...document.body.children].filter(el => !dialog || !el.contains(dialog));
  return others.length > 0 && others.every(el => el.inert === true);
}, DIALOG);
const nothingInert = page => page.evaluate(() => [...document.body.children].every(el => !el.inert));
const focusOnHeading = page => page.evaluate(() => {
  const a = document.activeElement;
  return !!a && !!a.closest('.auth-col') && (a.matches('h1, .signup-title') || a.classList.contains('auth-col'));
});

export const flow = {
  id: 'first-open',
  name: 'First open · once, inert behind, Escape and Skip, focus to sign-in, not on reload, then sign-in',
  online: true,
  firstOpen: true,

  async run({ page, check, goto, settle, createProfile }) {
    await goto('/');
    const dialog = page.locator(DIALOG);
    await dialog.waitFor({ timeout: 30000 });
    await check('first open: the moment shows on a first open, before sign-in', await dialog.count() === 1);
    await check('first open: the page behind is inert while it shows', await backgroundInert(page));
    await check('first open: the dialog is named by its line', (await dialog.getAttribute('aria-labelledby')) === 'fo-line');

    // Ink is acknowledged, never read.
    const pad = page.locator('.fo-pad');
    const box = await pad.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + 30); await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height - 30, { steps: 10 }); await page.mouse.up();
    const ack = await page.locator('.fo-ack').innerText();
    await check('first open: ink is acknowledged without a reading', ack.trim() === en['first.ack'] && !/\d/.test(ack));

    // Escape skips.
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached', timeout: 10000 });
    await check('first open: Escape closes it', await dialog.count() === 0);
    await check('first open: focus moves to the sign-in heading', await focusOnHeading(page));
    await check('first open: nothing is inert after it closes', await nothingInert(page));
    await check('first open: the flag is stored', await page.evaluate(k => localStorage.getItem(k), KEY) === '1');

    // Not on reload.
    await page.reload({ waitUntil: 'domcontentloaded' }); await settle();
    await check('first open: it does not come back on reload', await page.locator(DIALOG).count() === 0);

    // Skip, on a device that has never seen it.
    await page.evaluate(k => localStorage.removeItem(k), KEY);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await dialog.waitFor({ timeout: 30000 });
    await page.getByRole('button', { name: en['first.skip'], exact: true }).click();
    await dialog.waitFor({ state: 'detached', timeout: 10000 });
    await check('first open: Skip closes it and focus moves to the sign-in heading', await page.locator(DIALOG).count() === 0 && await focusOnHeading(page));
    await check('first open: the sign-in form is interactive after it closes',
      await page.locator('[data-signin-card="page"] input').first().isEditable());

    // Sign-in completes as usual.
    await createProfile({ name: 'First Open Student', year: 10, course: 'in' });
    await check('first open: sign-in completes after the moment', await page.locator('.shell').count() === 1);
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  process.env.PRI_FEATURE_INSTRUMENT = '1';
  const { runFlows } = await import('./e2e.mjs');
  process.exit(await runFlows([flow]) ? 1 : 0);
}
