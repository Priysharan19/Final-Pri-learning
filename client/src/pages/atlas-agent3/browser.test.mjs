// Isolated synthetic Paper -> Insight browser tour.
// Runs an ordinary Vite development server. No auth, /v1, or production marking API.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from '@playwright/test';

const clientRoot = resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const base = 'http://127.0.0.1:5189';
const url = base + '/src/pages/atlas-agent3-demo.html';
const out = process.env.PRI_ATLAS_VISUAL_OUT || join(clientRoot, 'src/pages/atlas-agent3/evidence');
mkdirSync(out, { recursive: true });

const server = spawn(process.execPath,
  [join(clientRoot, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5189', '--strictPort'],
  { cwd: clientRoot, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env } }
);
let serverTail = '';
for (const stream of [server.stdout, server.stderr]) {
  stream.on('data', chunk => { serverTail = (serverTail + String(chunk)).slice(-5000); });
}
const waitForServer = async () => {
  for (let attempt = 0; attempt < 95; attempt++) {
    if (server.exitCode !== null) throw new Error('Vite quit: ' + serverTail);
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (r.ok && (await r.text()).includes('pri-atlas-agent3')) return;
    } catch { /* Server is still starting. */ }
    await new Promise(r => setTimeout(r, 160));
  }
  throw new Error('Vite never served Atlas entry: ' + serverTail);
};
let checks = 0;
function check(description, predicate, detail = '') {
  assert(predicate, description + (detail ? ' · ' + detail : ''));
  checks++;
  console.log('PASS ' + description);
}
async function shot(page, name) {
  const path = join(out, name + '.png');
  await page.screenshot({ path, fullPage: true, animations: 'disabled' });
  console.log('SCREENSHOT ' + path);
}
async function clearDemo(page) {
  await page.goto(url);
  await page.evaluate(() => sessionStorage.clear());
  await page.reload();
  await page.waitForSelector('[data-atlas-paper]');
}
async function layoutCheck(page, key) {
  const info = await page.evaluate(() => {
    const visible = x => {
      const c = getComputedStyle(x), r = x.getBoundingClientRect();
      return c.display !== 'none' && c.visibility !== 'hidden' && r.height > 0 && r.width > 0;
    };
    const controls = [...document.querySelectorAll('button:not(:disabled),select:not(:disabled),input:not(:disabled),textarea:not(:disabled)')]
      .filter(visible);
    const unnamed = controls.filter(x => !(
      x.getAttribute('aria-label') || x.labels?.length || x.innerText.trim()
    )).map(x => x.tagName + '.' + x.className);
    const sideClipped = controls.filter(x => {
      const r = x.getBoundingClientRect();
      return r.left < -1 || r.right > window.innerWidth + 1;
    }).map(x => (x.innerText || x.getAttribute('aria-label') || x.tagName).slice(0, 45));
    const w = document.documentElement.scrollWidth;
    return { w, viewport: window.innerWidth, unnamed, sideClipped };
  });
  check(key + ' no horizontal overflow', info.w <= info.viewport + 2, JSON.stringify(info));
  check(key + ' controls have accessible names', info.unnamed.length === 0, JSON.stringify(info.unnamed));
  check(key + ' no controls clipped sideways', info.sideClipped.length === 0, JSON.stringify(info.sideClipped));
}

async function submit(page, outcome = 'result') {
  await page.getByRole('combobox', { name: 'Simulated response type' }).selectOption(outcome);
  await page.locator('[data-atlas-submit]').click();
  check('pending state is explicitly announced', await page.locator('[data-atlas-state="pending"]').count() === 1);
  if (outcome === 'result') await page.waitForSelector('[data-atlas-insight]');
  else await page.waitForSelector('[data-atlas-state="' + (outcome === 'uncertain' ?
      'uncertain-transcription' : 'technical-error') + '"]');
}

async function browserTour(browserType, name) {
  const browser = await browserType.launch({ headless: true });
  try {
    const sizes = name === 'webkit'
      ? [{ id: 'phone', width: 390, height: 844 }, { id: 'desktop', width: 1440, height: 900 }]
      : [{ id: 'desktop', width: 1440, height: 900 }, { id: 'tablet', width: 820, height: 1180 },
        { id: 'phone', width: 390, height: 844 }];
    for (const size of sizes) {
      const ctx = await browser.newContext({ viewport: size, reducedMotion: 'reduce', isMobile: false });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
      await clearDemo(page);
      check(name + '/' + size.id + ' new student has no inferred progress',
        (await page.getByText('No progress evidence').count()) === 1);
      check(name + '/' + size.id + ' initially unsubmitted',
        (await page.locator('[data-atlas-state="unsubmitted"]').count()) === 1);
      check(name + '/' + size.id + ' cannot submit blank input',
        await page.locator('[data-atlas-submit]').isDisabled());
      check(name + '/' + size.id + ' local-only disclosure visible',
        (await page.getByText('HANDWRITING NOT RECOGNISED').count()) >= 1 ||
          (await page.getByText(/HANDWRITING NOT RECOGNISED/).count()) >= 1);
      await layoutCheck(page, name + '/' + size.id + '/paper');
      if (name === 'chromium') await shot(page, 'atlas-agent3-' + size.id + '-paper');
      await page.getByLabel('Your working and reasoning').fill('6x - 3 = 15\n6x = 18\nx = 3');
      await page.getByLabel('Final answer').fill('x = 3');
      await page.reload();
      check(name + '/' + size.id + ' draft persisted through refresh',
        (await page.getByLabel('Your working and reasoning').inputValue()).includes('6x = 18'));
      // Keyboard-only activation: focus a button then press Enter, not a pointer click.
      await page.locator('[data-atlas-focus]').focus();
      await page.keyboard.press('Enter');
      check(name + '/' + size.id + ' keyboard focus mode',
        await page.locator('.pa3-app').getAttribute('data-focus') === 'true');
      await page.keyboard.press('Enter');
      check(name + '/' + size.id + ' focus mode reversible',
        await page.locator('.pa3-app').getAttribute('data-focus') === 'false');
      if (size.id === 'desktop' && name === 'chromium') {
        await page.getByRole('button', { name: 'A small hint' }).click();
        check('authored hint appears only after request',
          await page.locator('[data-atlas-hint-level="1"]').count() === 1);
      }
      await submit(page);
      check(name + '/' + size.id + ' Insight repeats own entered working',
        (await page.locator('[data-atlas-original-working]').innerText()).includes('6x = 18'));
      check(name + '/' + size.id + ' no unsupported error diagnosis',
        await page.locator('[data-atlas-no-diagnosis]').count() === 1);
      check(name + '/' + size.id + ' no invented mark for arbitrary answer',
        (await page.locator('.pa3-insight-seal').innerText()).includes('Not assessed'));
      await layoutCheck(page, name + '/' + size.id + '/insight');
      if (name === 'chromium') await shot(page, 'atlas-agent3-' + size.id + '-insight');
      await page.locator('[data-atlas-next]').click();
      check(name + '/' + size.id + ' next question starts unsubmitted',
        await page.locator('[data-atlas-state="unsubmitted"]').count() === 1);
      check(name + '/' + size.id + ' second question is distinct',
        (await page.locator('.pa3-problem').innerText()).includes('5('));
      await page.locator('.pa3-nav-link').first().click();
      check(name + '/' + size.id + ' returns concept handoff', (await page.locator('[data-atlas-handoff] code').innerText()) === 'linear-equations');
      check(name + '/' + size.id + ' no browser error', errors.length === 0, errors.join('\n'));
      await ctx.close();
    }
    if (name !== 'chromium') return;
    const context = await browser.newContext({ viewport: { width: 1024, height: 850 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await clearDemo(page);
    await page.getByLabel('Student fixture').selectOption('returning');
    check('returning student shown only explicitly synthetic history',
      (await page.getByText(/4 invented practice visits/).count()) === 1);
    await page.getByLabel('Your working and reasoning').fill('I want to check this');
    await submit(page, 'uncertain');
    check('uncertain transcription is not classified as a mathematical mistake',
      (await page.locator('[data-atlas-state="uncertain-transcription"]').innerText()).includes('not a maths error'));
    check('cannot continue uncertain state without explicit confirmation',
      await page.getByRole('button', { name: /Confirm transcription/ }).isDisabled());
    await shot(page, 'atlas-agent3-uncertain');
    await page.getByLabel('Your confirmed transcription').fill('6x=18');
    await page.getByRole('button', { name: /Confirm transcription/ }).click();
    check('confirmed transcript shown separately', (await page.locator('.pa3-manual-confirmation').innerText()).includes('6x=18'));
    await page.getByRole('button', { name: /Back to paper/ }).click();
    await page.getByLabel('Your working and reasoning').fill('This edit invalidates prior recognition');
    check('editing invalidates prior review', await page.locator('[data-atlas-state="unsubmitted"]').count() === 1);
    await submit(page, 'error');
    check('technical error does not erase the draft',
      (await page.getByLabel('Your working and reasoning').inputValue()).includes('invalidates'));
    await shot(page, 'atlas-agent3-technical-error');
    await page.getByRole('button', { name: /Return to draft and retry/ }).click();
    check('manual retry explicitly returns to draft', await page.locator('[data-atlas-state="unsubmitted"]').count() === 1);
    await page.getByRole('button', { name: /^Write$/ }).click();
    const svg = page.locator('[data-atlas-sketch] svg');
    const rect = await svg.boundingBox();
    assert(rect, 'Sketch should have a visible pointer target');
    await page.mouse.move(rect.x + 40, rect.y + 50);
    await page.mouse.down();
    await page.mouse.move(rect.x + 90, rect.y + 85, { steps: 6 });
    await page.mouse.up();
    check('pointer sketch commits strokes', Number(await svg.getAttribute('data-drawn-strokes')) > 0);
    await page.reload();
    check('sketched strokes survive refresh', Number(await page.locator('[data-atlas-sketch] svg').getAttribute('data-drawn-strokes')) > 0);
    await page.getByRole('button', { name: /^Type$/ }).click();
    await page.getByRole('button', { name: /Load an explicitly incorrect sample/ }).click();
    await submit(page);
    check('exact authored slip produces clearly sample-only diagnosis',
      await page.locator('[data-atlas-defined-error]').count() === 1);
    check('sample-only score is explicitly labeled',
      (await page.locator('.pa3-insight-seal').innerText()).includes('Sample-only marks'));
    await shot(page, 'atlas-agent3-explicit-fixture-error');
    check('extended scenarios have no browser errors', errors.length === 0, errors.join('\n'));
    const keyPage = await context.newPage();
    await clearDemo(keyPage);
    await keyPage.getByLabel('Your working and reasoning').focus();
    await keyPage.keyboard.type('6x = 18');
    await keyPage.keyboard.press('Tab');
    check('Tab reaches final-answer input from working field',
      await keyPage.evaluate(() => document.activeElement?.id === 'pa3-final-answer'));
    await keyPage.keyboard.type('x = 3');
    await keyPage.keyboard.press('Tab'); // Authored-example control.
    await keyPage.keyboard.press('Tab'); // Submit.
    check('keyboard can reach the submit action',
      await keyPage.evaluate(() => document.activeElement?.hasAttribute('data-atlas-submit')));
    await keyPage.keyboard.press('Enter');
    await keyPage.waitForSelector('[data-atlas-insight]');
    check('keyboard-only form flow reaches Insight', await keyPage.locator('[data-atlas-no-diagnosis]').count() === 1);
    check('reduced motion disables arrival animation',
      await keyPage.locator('.pa3-insight').evaluate(el => parseFloat(getComputedStyle(el).animationDuration) < 0.01));
    await keyPage.close();
    await context.close();

    const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const touchPage = await touchContext.newPage();
    await clearDemo(touchPage);
    await touchPage.getByRole('button', { name: /^Write$/ }).click();
    const touchSurface = touchPage.locator('[data-atlas-sketch] svg');
    await touchSurface.scrollIntoViewIfNeeded();
    const touchBounds = await touchSurface.boundingBox();
    assert(touchBounds);
    await touchPage.touchscreen.tap(touchBounds.x + 40, touchBounds.y + 55);
    await touchPage.waitForFunction(() => Number(document.querySelector('[data-atlas-sketch] svg')?.getAttribute('data-drawn-strokes')) > 0, null, { timeout: 1800 });
    check('touch event produces a locally stored writing dot',
      Number(await touchSurface.getAttribute('data-drawn-strokes')) > 0);
    await touchContext.close();

    const blockedContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await blockedContext.addInitScript(() => {
      Storage.prototype.setItem = () => { throw new Error('simulated blocked browser storage'); };
    });
    const blockedPage = await blockedContext.newPage();
    await blockedPage.goto(url);
    await blockedPage.waitForSelector('[data-atlas-state="unsubmitted"]');
    check('blocked browser storage never claims durable draft saving',
      (await blockedPage.locator('[data-atlas-state="unsubmitted"]').innerText()).includes('may be lost on refresh'));
    await blockedContext.close();
  } finally {
    await browser.close();
  }
}

try {
  await waitForServer();
  await browserTour(chromium, 'chromium');
  await browserTour(webkit, 'webkit');
  console.log('Atlas Agent 3 browser tour: ' + checks + ' checks PASS. Evidence: ' + out);
} finally {
  server.kill('SIGTERM');
}
