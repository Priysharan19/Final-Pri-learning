// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · E2E flow — teaching the recogniser your own hand.
//
// Calibration is the one place a student changes the recogniser. What they draw
// here is stored as a personal template that outranks the built-in shapes, and
// the app makes two promises about it: the samples are kept, and they are kept
// per profile — the handwriting one child teaches must never be reaching for
// another child's ink on the same iPad.
//
// Both promises are asserted here by driving the flow: samples are written on
// the calibration canvas, counted on the settings card afterwards, found to be
// absent on a second profile made on the same device, and cleared again.
//
// Run on its own:  node client/test/cal-smoke.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { pathToFileURL } from 'node:url';
import { TEMPLATES } from '../src/ink/templates.js';

const TEACH = ['0', '1'];             // the first two prompts the flow walks
const GLYPH_W = 60;
const GLYPH_H = 90;

/** Draw one template glyph in the middle of a calibration canvas. */
async function draw(page, box, sym) {
  const variant = TEMPLATES[sym][0];
  const ox = box.x + box.width / 2 - GLYPH_W / 2;
  const oy = box.y + Math.max(10, (box.height - GLYPH_H) / 2);
  for (const stroke of variant) {
    const pts = stroke.map(([px, py]) => [ox + (px / 100) * GLYPH_W, oy + (py / 100) * GLYPH_H]);
    await page.mouse.move(pts[0][0], pts[0][1]);
    await page.mouse.down();
    for (const [x, y] of pts) await page.mouse.move(x, y);
    await page.mouse.up();
  }
}

const learnedLine = (page) =>
  page.locator('.card', { hasText: 'Personal templates learned' }).locator('.set-v').innerText();

export const flow = {
  id: 'calibrate',
  name: 'Calibrate · the recogniser learns a hand',

  async run({ page, base, check, goto, createProfile, settle }) {
    await goto('/');
    await createProfile({ name: 'Sofia Kovalevskaya', year: 10 });

    // ── 1 · nothing is learned yet ───────────────────────────────────────────
    await page.goto(`${base}/settings`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.card:has-text("Personal templates learned")', { timeout: 30000 });
    await check('a new profile has taught the recogniser nothing',
      (await learnedLine(page)) === 'None yet',
      `the card reads ${JSON.stringify(await learnedLine(page))}`);

    // ── 2 · the calibration flow opens on the first symbol ───────────────────
    await page.getByRole('button', { name: 'Teach it your handwriting' }).click();
    await page.waitForSelector('.ink-canvas-live', { timeout: 30000 });
    await check('calibration opens at the first of its prompts',
      /^1 \/ \d+$/.test(await page.locator('.card-head .muted').innerText()),
      `counter reads ${JSON.stringify(await page.locator('.card-head .muted').innerText())}`);
    const total = Number(/\/ (\d+)/.exec(await page.locator('.card-head .muted').innerText())[1]);
    await check('there is a full alphabet to teach', total >= 20, `${total} prompts`);

    // ── 3 · two symbols are written and saved ────────────────────────────────
    for (let i = 0; i < TEACH.length; i++) {
      const box = await page.locator('.ink-canvas-live').boundingBox();
      await check(`prompt ${i + 1} gives somewhere to write`, !!box && box.height > 100,
        `canvas box ${JSON.stringify(box)}`);
      await draw(page, box, TEACH[i]);
      await settle();
      await page.getByRole('button', { name: 'Save & next' }).click();
      await settle();
      await check(`saving advances to prompt ${i + 2}`,
        (await page.locator('.card-head .muted').innerText()).startsWith(`${i + 2} /`),
        `counter reads ${JSON.stringify(await page.locator('.card-head .muted').innerText())}`);
    }

    // ── 4 · the samples were kept ────────────────────────────────────────────
    await page.getByRole('button', { name: 'Stop' }).click();
    await page.waitForSelector('.card:has-text("Personal templates learned")', { timeout: 30000 });
    const learned = await learnedLine(page);
    await check('the samples written are counted against the profile',
      learned === `${TEACH.length} across ${TEACH.length} symbols`,
      `the card reads ${JSON.stringify(learned)}`);

    // ── 5 · they belong to that profile and no other ─────────────────────────
    await page.locator('.user-chip').click();
    await page.getByRole('menuitem', { name: 'Switch profile' }).click();
    await page.waitForSelector('.acct-list', { timeout: 30000 });
    await page.getByRole('button', { name: 'Add another profile' }).click();
    await page.waitForSelector('.sso-btn', { timeout: 30000 });
    await page.getByRole('button', { name: 'Continue without an email' }).click();
    await page.waitForSelector('.auth-card input.input', { timeout: 30000 });
    await page.getByPlaceholder('e.g. Priysharan').fill('Maryam Mirzakhani');
    await page.getByRole('button', { name: 'Start learning' }).click();
    // Switching profiles keeps the route it was done from, so it is the account
    // chip that says who is signed in now, not the Home greeting.
    await page.waitForSelector('.user-chip:has-text("Maryam")', { timeout: 30000 });
    await page.goto(`${base}/settings`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.card:has-text("Personal templates learned")', { timeout: 30000 });
    await check('a second profile on the same device inherits nothing',
      (await learnedLine(page)) === 'None yet',
      `the second profile's card reads ${JSON.stringify(await learnedLine(page))}`);

    // ── 6 · and the first profile still has its own ──────────────────────────
    await page.locator('.user-chip').click();
    await page.getByRole('menuitem', { name: 'Switch profile' }).click();
    await page.waitForSelector('.acct-list', { timeout: 30000 });
    await page.locator('.acct-row', { hasText: 'Sofia Kovalevskaya' }).click();
    await page.waitForSelector('.user-chip:has-text("Sofia")', { timeout: 30000 });
    await page.goto(`${base}/settings`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.card:has-text("Personal templates learned")', { timeout: 30000 });
    await check('switching back finds the learned handwriting where it was left',
      (await learnedLine(page)) === learned,
      `the card now reads ${JSON.stringify(await learnedLine(page))}, was ${JSON.stringify(learned)}`);

    // ── 7 · and it can be taken away again ───────────────────────────────────
    await page.getByRole('button', { name: 'Reset learned handwriting' }).click();
    await settle();
    await check('resetting clears the learned handwriting',
      (await learnedLine(page)) === 'None yet',
      `the card reads ${JSON.stringify(await learnedLine(page))} after a reset`);
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
