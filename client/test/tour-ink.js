// Ink mistake-pointing verification: writes a WRONG answer by hand, checks the
// engine pins the exact line (✗ + red underline + margin note on the ink),
// then corrects it by hand and checks the green ✓ lands on the ink too.
// Run: node client/test/tour-ink.js   (server on :4000 serving client/dist)
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { TEMPLATES } from '../src/ink/templates.js';

const BASE = 'http://localhost:4000';
const OUT = new URL('../../shots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

let failures = 0;
const ok = (name, cond) => { console.log(cond ? 'PASS' : 'FAIL', name); if (!cond) failures++; };

async function drawText(page, canvasBox, text, oy = 46) {
  const SIZE = 64;
  let ox = canvasBox.x + 36;
  for (const ch of text) {
    const variant = TEMPLATES[ch]?.[0];
    if (!variant) continue;
    for (const stroke of variant) {
      const pts = stroke.map(([px, py]) => [ox + px / 100 * SIZE * 0.7, canvasBox.y + oy + py / 100 * SIZE]);
      await page.mouse.move(pts[0][0], pts[0][1]);
      await page.mouse.down();
      for (const [x, y] of pts) await page.mouse.move(x, y, { steps: 2 });
      await page.mouse.up();
      await page.waitForTimeout(50);
    }
    ox += SIZE * 1.05;
  }
  await page.waitForTimeout(900); // recognition debounce
}

async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 860 }, deviceScaleFactor: 1.5, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));

  // fresh Year 7 profile
  await page.goto(BASE);
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: 'Get Started' }).click();
  await page.waitForTimeout(350);
  await page.getByRole('button', { name: /Continue with email/ }).click();
  await page.waitForTimeout(400);
  await page.getByPlaceholder('e.g. Priysharan').fill('Ink Tester');
  await page.locator('select').first().selectOption('7');
  await page.getByRole('button', { name: 'Start learning' }).click();
  await page.waitForTimeout(900);

  // deterministic numeric question
  await page.goto(`${BASE}/practice?subtopic=y7-angles`);
  await page.waitForSelector('.q-prompt', { timeout: 15000 });
  await page.locator('.mode-tab').nth(1).click(); // ✎ write
  await page.waitForSelector('.ink-canvas', { timeout: 8000 });

  const promptText = await page.$eval('.q-prompt', el => el.textContent);
  let expected = null;
  const m1 = promptText.match(/One of them is\s*(\d+)/);
  if (m1) expected = String((promptText.includes('complementary') ? 90 : 180) - Number(m1[1]));
  const m2 = promptText.match(/Three of them are\s*(\d+)°?,\s*(\d+)°?\s*and\s*(\d+)/);
  if (!expected && m2) expected = String(360 - Number(m2[1]) - Number(m2[2]) - Number(m2[3]));
  const m3 = promptText.match(/angles?\s+of\s+(\d+)°?\s+and\s+x/);
  if (!expected && m3) expected = String(180 - Number(m3[1]));
  if (!expected) { console.log('SKIP: unrecognised prompt:', promptText.slice(0, 90)); process.exit(0); }
  const wrong = String(Number(expected) + 10);
  console.log('prompt expects', expected, '— writing wrong answer', wrong);

  const canvas = await page.$('.ink-canvas');
  const box = await canvas.boundingBox();

  // 1 · wrong answer by hand → submit → ✗ pinned on the ink line
  await drawText(page, box, wrong);
  await page.getByRole('button', { name: /Submit Answer/ }).click();
  await page.waitForTimeout(1200);
  const badPin = await page.$('.ink-verdict.bad');
  const badBox = await page.$('.ink-linebox.bad');
  const note = await page.$('.ink-note');
  const comments = await page.$('.ink-comments .ink-comment.bad');
  ok('✗ verdict pinned on the handwritten line', !!badPin);
  ok('red box drawn around the exact step', !!badBox);
  ok('margin note explains the mistake', !!note);
  ok('comments panel carries the mistake card', !!comments);
  await page.screenshot({ path: `${OUT}ink-1-wrong-pinned.png` });

  // 2 · erase, write a two-line correct working → green boxes on every step
  await page.locator('.ink-tool[title="Clear"]').click();
  await page.waitForTimeout(400);
  // two lines of working: a consistent chain ending in the answer
  await drawText(page, box, expected, 30);
  await drawText(page, box, expected, 150);
  try {
    await page.waitForSelector('.editor-foot .btn-primary:not([disabled])', { timeout: 8000 });
    await page.getByRole('button', { name: /Submit Answer/ }).click({ timeout: 8000 });
  } catch (e) {
    const reading = await page.$$eval('.ink-line-math', els => els.map(el => el.textContent));
    const btns = await page.$$eval('button', els => els.filter(b => /Submit/.test(b.textContent)).map(b => `${b.textContent} disabled=${b.disabled}`));
    console.log('DEBUG reading:', JSON.stringify(reading), 'buttons:', JSON.stringify(btns));
    await page.screenshot({ path: `${OUT}ink-debug.png` });
    throw e;
  }
  await page.waitForTimeout(1400);
  ok('marked correct on second try', !!(await page.$('.verdict-good, .eval-head')) && !(await page.$('.ink-linebox.bad')));
  ok('✓ verdict on the corrected ink', !!(await page.$('.ink-verdict.good')));
  ok('green box drawn around the correct step', !!(await page.$('.ink-linebox.good')));
  await page.screenshot({ path: `${OUT}ink-2-correct.png` });

  // 3 · multi-line working (typed) — Step Check pins the broken line
  await page.goto(`${BASE}/practice?subtopic=y7-equations`);
  await page.waitForSelector('.q-prompt', { timeout: 15000 });
  await page.locator('.mode-tab').nth(0).click();
  const p2 = await page.$eval('.q-prompt', el => el.textContent);
  console.log('typed-working prompt:', p2.slice(0, 90));
  const toggle = page.getByRole('button', { name: /Show working for partial credit/ });
  const ansInput = page.locator('.editor-body input.answer-input');
  if (await toggle.count() && await ansInput.count()) {
    await toggle.click();
    // a chain whose second line breaks on purpose
    await page.locator('.editor-body textarea.input').fill('2x + 3 = 13\n2x = 11\nx = 5.5');
    await ansInput.fill('5.5');
    await page.getByRole('button', { name: /Submit Answer/ }).click();
    await page.waitForTimeout(1200);
    const breakLine = await page.$('.stepcheck-line.sc-break');
    ok('typed Step Check highlights the broken line', !!breakLine);
    await page.screenshot({ path: `${OUT}ink-3-stepcheck.png` });
  } else {
    console.log('SKIP typed working (no steps support on this question)');
  }

  await browser.close();
  console.log(failures ? `INK TOUR: ${failures} FAILURES` : 'INK TOUR: ALL PASS');
  process.exit(failures ? 1 : 0);
}

main().catch(e => { console.error('INK TOUR FAILED:', e.message); process.exit(1); });
