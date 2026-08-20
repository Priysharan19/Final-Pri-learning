// Visual tour of the v4 redesign — walks every screen, screenshots as it goes.
// Run: node client/test/tour-v4.js   (server on :4000 serving client/dist)
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = 'http://localhost:4000';
const OUT = new URL('../../shots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const shot = (page, name) => page.screenshot({ path: `${OUT}${name}.png`, fullPage: false });

async function main() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 860 }, deviceScaleFactor: 1.5 });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE:', m.text().slice(0, 200)); });

  // 1 · landing hero
  await page.goto(BASE);
  await page.waitForTimeout(1200);
  await shot(page, '01-landing');

  // 2 · create profile (sign-in method → email)
  await page.getByRole('button', { name: 'Get Started' }).click();
  await page.waitForTimeout(400);
  await shot(page, '01b-signin-methods');
  await page.getByRole('button', { name: /Continue with email/ }).click();
  await page.waitForTimeout(350);
  await page.getByPlaceholder('e.g. Priysharan').fill('Priysharan');
  await page.locator('select').first().selectOption('12');
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: 'Advanced', exact: true }).click();
  await shot(page, '02-create-profile');
  await page.getByRole('button', { name: 'Start learning' }).click();
  await page.waitForTimeout(900);
  await shot(page, '03-home');

  // 3 · generator flow
  await page.locator('.genbar-toggle').click();
  await page.waitForTimeout(300);
  await shot(page, '04-gen-year');
  await page.locator('.gen-pane .gen-opt', { hasText: 'Year 12' }).first().click();
  await page.waitForTimeout(250);
  await page.locator('.gen-pane .gen-opt', { hasText: 'Advanced' }).first().click();
  await page.waitForTimeout(350);
  await shot(page, '05-gen-topics');
  // pick the first Calculus-ish topic button in the topics pane
  const topicBtn = page.locator('.gen-pane .gen-opt').first();
  await topicBtn.click();
  await page.waitForTimeout(250);
  await page.getByRole('button', { name: 'Generate' }).click();
  await page.waitForTimeout(1200);
  await shot(page, '06-question');

  // 4 · reveal → evaluation
  await page.getByRole('button', { name: 'Show solution' }).click();
  await page.waitForTimeout(900);
  await shot(page, '07-evaluation');
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(400);
  await shot(page, '08-criteria');

  // 5 · next question via ctx pill, use a hint, wrong answer twice
  await page.locator('.ctx-next').click();
  await page.waitForTimeout(1300);
  const bulb = page.locator('.hint-bulb').first();
  if (await bulb.count()) {
    await bulb.click();
    await page.waitForTimeout(500);
    await shot(page, '09-hint');
  }
  const input = page.locator('.editor-body input.answer-input, .editor-body textarea').first();
  if (await input.count()) {
    await input.fill('99999');
    const sub = page.getByRole('button', { name: /Submit Answer/ });
    await sub.click();
    await page.waitForTimeout(900);
    await input.fill('88888');
    await sub.click();
    await page.waitForTimeout(1100);
    await page.mouse.wheel(0, 500);
    await shot(page, '10-wrong-eval');
  } else {
    // mcq — click an option then submit
    await page.locator('.mcq-opt').first().click();
    await page.getByRole('button', { name: /Submit Answer/ }).click();
    await page.waitForTimeout(900);
    await shot(page, '10-wrong-eval');
  }

  // 6 · progress tabs
  await page.goto(`${BASE}/progress`);
  await page.waitForTimeout(1100);
  await shot(page, '11-progress-overview');
  await page.getByRole('button', { name: 'Priorities' }).click();
  await page.waitForTimeout(700);
  await shot(page, '12-progress-priorities');
  await page.getByRole('button', { name: 'Knowledge map' }).click();
  await page.waitForTimeout(1600);
  await shot(page, '13-knowledge-map');
  await page.getByRole('button', { name: '☰ Curriculum' }).click();
  await page.waitForTimeout(500);
  await shot(page, '14-kmap-curriculum');

  // 7 · match
  await page.goto(`${BASE}/match`);
  await page.waitForTimeout(900);
  await shot(page, '15-match');

  // 8 · tasks / favorites / classes / history / settings / exams
  await page.goto(`${BASE}/tasks`); await page.waitForTimeout(700); await shot(page, '16-tasks');
  await page.goto(`${BASE}/favorites`); await page.waitForTimeout(700); await shot(page, '17-favorites');
  await page.goto(`${BASE}/classes`); await page.waitForTimeout(700); await shot(page, '18-classes');
  await page.goto(`${BASE}/history`); await page.waitForTimeout(700); await shot(page, '19-history');
  await page.goto(`${BASE}/exams`); await page.waitForTimeout(700); await shot(page, '20-exams');
  await page.goto(`${BASE}/settings`); await page.waitForTimeout(800); await shot(page, '21-settings');

  // 9 · sidebar hover
  await page.goto(BASE); await page.waitForTimeout(800);
  await page.locator('.sidebar').hover();
  await page.waitForTimeout(500);
  await shot(page, '22-sidebar-open');

  // 10 · light theme
  await page.getByTitle('Toggle theme').click();
  await page.waitForTimeout(600);
  await shot(page, '23-home-light');
  await page.getByTitle('Toggle theme').click();

  await browser.close();
  console.log('TOUR DONE');
}

main().catch(e => { console.error('TOUR FAILED:', e.message); process.exit(1); });
