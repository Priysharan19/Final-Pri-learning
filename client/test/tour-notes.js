// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · E2E flow — Notes: open a chapter, read it, revise, practise.
//
// Walks the Notes section the way a Class 10 student meets it, on an iPad-sized
// touch viewport: the index for their class, the chapter map, one chapter's
// notes (formulas drawn by KaTeX, a worked example stepped through to its
// engine-checked answer), the five-minute flashcards (flip by keyboard and by
// tap, advance, close with Escape), a bookmark that survives a reload, search
// across every class, and "Practise this" landing on that chapter's questions.
// Then it repeats the chapter read with reduced motion and in light/dark to
// prove nothing is hidden behind an animation.
//
// Usage: node client/test/tour-notes.js [--no-build] [--shots <dir>]
// ─────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { ensureBuild, serveDist } from './e2e.mjs';

const args = process.argv.slice(2);
const build = !args.includes('--no-build');
const shotsAt = args.indexOf('--shots');
const SHOTS = shotsAt >= 0 ? args[shotsAt + 1] : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const CHAPTER = 'c10-quadratic-equations';
let passed = 0;
const check = async (name, cond, detail = '') => {
  if (!cond) throw new Error(`✖ ${name}${detail ? ` — ${detail}` : ''}`);
  passed++; console.log(`  ✔ ${name}`);
};
const shot = async (page, name, opts = {}) => { if (SHOTS) await page.screenshot({ path: join(SHOTS, `notes-${name}.png`), ...opts }); };

async function startDemo(page, origin) {
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  // A fresh local Class 10 CBSE profile, made through the real onboarding.
  await page.getByRole('button', { name: 'Get Started' }).click();
  await page.waitForSelector('[data-onboarding-step="1"]');
  await page.getByRole('button', { name: 'Student', exact: true }).click();
  await page.locator('.auth-card .btn-primary').click();
  await page.waitForSelector('[data-onboarding-step="2"]');
  await page.locator('#signup-track').selectOption('10');
  await page.locator('.auth-card .btn-primary').click();
  await page.waitForSelector('[data-onboarding-step="3"]');
  await page.locator('#signup-name').fill('Notes Student');
  await page.locator('.auth-card .btn-primary').click();
  await page.waitForSelector('[data-onboarding-step="4"]');
  await page.locator('.auth-card .btn-primary').click();
  await page.waitForSelector('[data-onboarding-step="5"]');
  await page.locator('.auth-card .btn-primary').click();
  await page.waitForSelector('.home-greet', { timeout: 120000 });
}

/** Scrolls the whole page through so every scroll-linked reveal has fired. */
async function readThrough(page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); }
  });
  await page.waitForTimeout(1600);
}

const built = ensureBuild(build);
if (built.built) console.log(`  built client in ${built.ms} ms`);
const server = await serveDist();
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 1366 }, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await startDemo(page, server.origin);

  // ── 1 · Notes is in the navigation and opens on the student's class ───────
  await page.locator('.sidebar a[href="/notes"]').first().click();
  await page.waitForSelector('[data-testid="notes-chapter"]');
  await check('Notes opens from the navigation', page.url().endsWith('/notes'));
  await check('it opens on Class 10, the student’s class',
    await page.locator('[role="tab"][aria-selected="true"]').innerText() === 'Class 10');
  await check('every Class 10 chapter is listed', await page.locator('[data-testid="notes-chapter"]').count() === 14);
  await page.waitForSelector('.nt-map-node');
  await check('the chapter map draws a node per chapter', await page.locator('.nt-map-node').count() === 14);
  await page.waitForTimeout(1400);
  await shot(page, 'index');

  // Arrow keys move between classes like any tablist.
  await page.locator('[role="tab"][aria-selected="true"]').focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => document.querySelector('[role="tab"][aria-selected="true"]')?.textContent === 'Class 11');
  await check('arrow keys move to Class 11', /class=11/.test(page.url()));
  await page.keyboard.press('ArrowLeft');
  await page.waitForFunction(() => document.querySelector('[role="tab"][aria-selected="true"]')?.textContent === 'Class 10');

  // ── 2 · open a chapter and read it ─────────────────────────────────────────
  await page.locator(`a[href="/notes/${CHAPTER}"]`).first().click();
  await page.waitForSelector('.nt-formula');
  await check('the chapter opens with its title', (await page.locator('h1').innerText()).includes('Quadratic Equations'));
  for (const h of ['Key ideas', 'Definitions', 'Formulas', 'Important points', 'Common mistakes', 'Worked examples']) {
    await check(`the chapter has a “${h}” section`, await page.getByRole('heading', { name: h, exact: true }).count() === 1);
  }
  await check('formulas are typeset by KaTeX, not left as source',
    await page.locator('.nt-formula .katex').count() >= 2 && await page.locator('.nt-formula .katex-error').count() === 0);
  await check('the quadratic formula is among them',
    await page.locator('.nt-formula annotation').evaluateAll(a => a.some(n => /\\pm/.test(n.textContent) && /4ac/.test(n.textContent))));
  await shot(page, 'chapter-top');
  await readThrough(page);
  await check('every revealed block has settled visible after reading through',
    await page.locator('.nt-reveal:not(.is-in)').count() === 0);
  const veil = await page.locator('.nt-formula .nt-ink-veil').first().evaluate(el => getComputedStyle(el).transform);
  await check('the ink veil has fully slid off the first formula', /matrix\(0, 0, 0, 1/.test(veil) || veil === 'none', veil);
  await page.locator('.nt-formulas').scrollIntoViewIfNeeded();
  await shot(page, 'formulas');

  // Concept cards unfold.
  const second = page.locator('.nt-concept h3 button').nth(1);
  await check('the second concept starts folded', await second.getAttribute('aria-expanded') === 'false');
  await second.click();
  await check('tapping a concept unfolds it', await second.getAttribute('aria-expanded') === 'true' &&
    await page.locator('.nt-concept').nth(1).locator('.nt-concept-body').isVisible());

  // A worked example, stepped through to its checked answer.
  const ex = page.locator('.nt-example').first();
  await ex.scrollIntoViewIfNeeded();
  await ex.getByRole('button', { name: 'Show all steps' }).click();
  await check('the worked example reaches its answer', await ex.locator('.nt-answer').isVisible());
  await check('the answer says the engine checked it', /checked by the maths engine/.test(await ex.locator('.nt-answer').innerText()));
  await shot(page, 'example');
  await page.locator('.nt-mistakes').scrollIntoViewIfNeeded();
  await shot(page, 'mistakes');

  // ── 3 · bookmark survives a reload ─────────────────────────────────────────
  await page.evaluate(() => window.scrollTo(0, 0));
  const mark = page.locator('.nt-mark-toggle');
  await mark.click();
  await check('the chapter can be bookmarked', await mark.getAttribute('aria-pressed') === 'true');
  await page.reload();
  await page.waitForSelector('.nt-formula');
  await check('the bookmark is still there after a reload', await page.locator('.nt-mark-toggle').getAttribute('aria-pressed') === 'true');

  // ── 4 · revise in five minutes ─────────────────────────────────────────────
  await page.getByTestId('notes-revise').click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  await check('the flashcards open as a modal dialog', await dialog.getAttribute('aria-modal') === 'true');
  const card = page.getByTestId('notes-card');
  await check('focus moves onto the card', await card.evaluate(el => el === document.activeElement));
  const front = await card.locator('.nt-card-front').innerText();
  await shot(page, 'flashcard-front');
  await page.keyboard.press('Space');
  await check('Space flips the card', /is-flipped/.test(await card.getAttribute('class')));
  await page.waitForTimeout(800);
  await shot(page, 'flashcard-back');
  const total = Number(/of (\d+)/.exec(await page.locator('.nt-cards-count').innerText())[1]);
  await check('there are at least five cards', total >= 5, `${total}`);
  await page.getByTestId('notes-card-next').click();
  await check('Next moves to card 2 face-up', /Card 2 of/.test(await page.locator('.nt-cards-count').innerText()) &&
    !/is-flipped/.test(await page.getByTestId('notes-card').getAttribute('class')) &&
    await page.getByTestId('notes-card').locator('.nt-card-front').innerText() !== front);
  await page.getByTestId('notes-card').tap();
  await check('a tap flips the card too', /is-flipped/.test(await page.getByTestId('notes-card').getAttribute('class')));
  for (let i = 2; i <= total; i++) await page.keyboard.press('ArrowRight');
  await check('reaching the end says so', await page.locator('.nt-cards-done').isVisible());
  await page.keyboard.press('Escape');
  await check('Escape closes the flashcards', await page.getByRole('dialog').count() === 0);

  // ── 5 · search across every class ──────────────────────────────────────────
  await page.goto(server.origin + '/notes', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('notes-search').fill('discriminant');
  await page.waitForSelector('.nt-results .nt-chapter');
  const hits = await page.locator('.nt-results .nt-chapter-name').allInnerTexts();
  await check('search finds the discriminant in Quadratic Equations', hits.some(h => /Quadratic Equations/.test(h)), JSON.stringify(hits));
  await shot(page, 'search');
  await page.getByTestId('notes-search').fill('');
  await page.getByLabel('Bookmarked only').check();
  await check('the bookmarked filter lists the bookmarked chapter',
    (await page.locator('[data-testid="notes-chapter"]').allInnerTexts()).length === 1);

  // ── 6 · practise this ──────────────────────────────────────────────────────
  await page.goto(server.origin + `/notes/${CHAPTER}`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('notes-practise').click();
  await page.waitForURL(/\/practice\?/);
  const url = new URL(page.url());
  await check('Practise this opens Practice on this chapter', url.searchParams.get('subtopic') === CHAPTER, page.url());
  await page.waitForSelector('.q-prompt', { timeout: 60000 });
  await check('a question from the chapter is served', (await page.locator('.q-prompt').innerText()).trim().length > 0);
  await shot(page, 'practise');

  // ── 7 · reduced motion, dark and light, phone width ────────────────────────
  for (const scheme of ['dark', 'light']) {
    const rm = await browser.newContext({ viewport: { width: 1024, height: 1366 }, reducedMotion: 'reduce', colorScheme: scheme, deviceScaleFactor: 2 });
    const p2 = await rm.newPage();
    await startDemo(p2, server.origin);
    await p2.evaluate((s) => { document.documentElement.setAttribute('data-theme', s); }, scheme);
    await p2.goto(server.origin + `/notes/${CHAPTER}`, { waitUntil: 'domcontentloaded' });
    await p2.evaluate((s) => { document.documentElement.setAttribute('data-theme', s); }, scheme);
    await p2.waitForSelector('.nt-formula');
    const hidden = await p2.locator('.nt-reveal').evaluateAll(els => els.filter(e => getComputedStyle(e).opacity !== '1').length);
    await check(`with reduced motion (${scheme}) every block is visible without scrolling it in`, hidden === 0, `${hidden} hidden`);
    await shot(p2, `chapter-${scheme}`);
    await rm.close();
  }
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
  const p3 = await phone.newPage();
  await startDemo(p3, server.origin);
  await p3.goto(server.origin + `/notes/${CHAPTER}`, { waitUntil: 'domcontentloaded' });
  await p3.waitForSelector('.nt-formula');
  const overflow = await p3.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await check('no horizontal page scroll at phone width', overflow <= 0, `${overflow}px`);
  await shot(p3, 'phone');
  await phone.close();

  assert.deepEqual(errors, [], `page errors: ${errors.join(' | ')}`);
  passed++;
  console.log(`\n✔ NOTES E2E PASSED — ${passed} checks`);
} catch (e) {
  console.error(e.message || e);
  console.error(`\n✖ NOTES E2E FAILED after ${passed} checks`);
  process.exitCode = 1;
} finally {
  await browser.close();
  await server.close();
}
