// PRI-02 canonical browser regression — real student loop, restart and offline.
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from '@playwright/test';
import { ensureBuild, serveDist } from './e2e.mjs';

const TOPIC = 'c8-linear-equations';
const TOPIC_NAME = 'Linear Equations in One Variable';
const WRONG_A = '-987654';
const WRONG_B = '-987655';
const DRAFT = '12345';

const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();

async function pageOf(ctx) {
  const page = ctx.pages()[0] || await ctx.newPage();
  page.setDefaultTimeout(30000);
  return page;
}

async function waitApp(page) {
  await page.waitForSelector('.auth-wrap .hero-title, .auth-card, .shell', { timeout: 30000 });
  await page.waitForFunction(
    () => ![...document.querySelectorAll('[role="status"]')]
      .some(el => (el.textContent || '').trim().startsWith('Loading')),
    { timeout: 30000 }
  ).catch(() => {});
}

async function createFreshStudent(page, origin) {
  await page.goto(origin, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Get Started' }).click();
  await page.waitForSelector('[data-onboarding-step="1"]');
  await page.getByRole('button', { name: 'Student', exact: true }).click();
  await page.locator('.auth-card .btn-primary').click();
  await page.waitForSelector('[data-onboarding-step="2"]');
  await page.locator('#signup-track').selectOption('8');
  await page.locator('.auth-card .btn-primary').click();
  await page.waitForSelector('[data-onboarding-step="3"]');
  await page.locator('#signup-name').fill('PRI-02 Golden Student');
  await page.locator('.auth-card .btn-primary').click();
  await page.waitForSelector('[data-onboarding-step="4"]');
  await page.locator('.auth-card .btn-primary').click();
  await page.waitForSelector('[data-onboarding-step="5"]');
  await page.getByRole('button', { name: 'Start learning' }).click();
  await page.waitForSelector('.home-greet');
}

async function gotoPractice(page, origin) {
  await page.goto(origin + '/practice?subtopic=' + TOPIC, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.q-prompt');
}

async function typedQuestion(page, origin, options = {}) {
  if (options.navigate) await gotoPractice(page, origin);
  const input = page.locator('.editor-body input.answer-input');
  const typeTab = page.getByRole('button', { name: 'Answer by typing' });
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(120);
    if (await input.count() === 1 && await input.isVisible()) {
      return { prompt: clean(await page.locator('.q-prompt').textContent()), input };
    }
    if (await typeTab.count() && await typeTab.first().isVisible()) {
      const cls = await typeTab.first().getAttribute('class') || '';
      if (!cls.split(/\s+/).includes('on')) await typeTab.first().click();
    }
    await page.waitForTimeout(120);
    if (await input.count() === 1 && await input.isVisible()) {
      return { prompt: clean(await page.locator('.q-prompt').textContent()), input };
    }
    await page.locator('.ctx-next').click();
    await page.waitForSelector('.q-prompt');
  }
  throw new Error('No typed Class 8 linear-equations question was served within 12 explicit safe skips.');
}

async function resolveWrong(page, options = {}) {
  const found = await typedQuestion(page, null);
  const prompt = found.prompt;
  const input = found.input;
  await input.fill(WRONG_A);
  await page.getByRole('button', { name: 'Submit Answer' }).click();
  await page.waitForSelector('.verdict-bad');
  assert.equal(await page.locator('.eval-card').count(), 0,
    'first wrong answer must remain unresolved');

  await input.fill(WRONG_B);
  const submit = page.getByRole('button', { name: 'Submit Answer' });
  if (options.doubleSecond) {
    await Promise.allSettled([
      submit.click({ force: true }),
      submit.click({ force: true })
    ]);
  } else {
    await submit.click();
  }
  await page.waitForSelector('.eval-card');
  await page.waitForTimeout(150);
  assert.equal(await page.getByRole('button', { name: 'Submit Answer' }).count(), 0,
    'resolved question must not retain a live submit control');
  return prompt;
}

async function nextFreshTyped(page) {
  const before = clean(await page.locator('.q-prompt').textContent());
  await page.locator('.ctx-next').click();
  await page.waitForSelector('.q-prompt');
  const found = await typedQuestion(page, null);
  assert.notEqual(found.prompt, before, 'explicit Next must safely leave the prior unresolved question');
  return found;
}

async function snapshot(page, origin) {
  await page.goto(origin + '/history', { waitUntil: 'domcontentloaded' });
  await waitApp(page);
  await page.waitForSelector('.hist-row');
  const history = await page.locator('.hist-row').count();

  await page.goto(origin + '/progress', { waitUntil: 'domcontentloaded' });
  await waitApp(page);
  await page.waitForSelector('.syl-table');
  const row = page.locator(`.syl-table tbody tr[data-chapter="${TOPIC}"]`).first();
  assert.equal(await row.count(), 1, 'Progress must contain the practised Class 8 linear-equations row');
  const progressText = clean(await row.textContent());
  const topicAttempts = Number(await row.getAttribute('data-attempts'));
  const topicCorrect = Number(await row.getAttribute('data-correct'));
  const accuracyText = clean(await row.locator('td').nth(3).textContent());
  assert.ok(Number.isInteger(topicAttempts) && topicAttempts >= 0,
    'Progress row must expose its evidence-backed attempt count: ' + progressText);
  assert.ok(Number.isInteger(topicCorrect) && topicCorrect >= 0 && topicCorrect <= topicAttempts,
    'Progress row must expose a coherent correct count: ' + progressText);
  if (topicAttempts < 5) {
    assert.match(accuracyText, /Too few answers/i,
      'India Progress must withhold an accuracy percentage below its 5-attempt evidence floor');
  } else {
    assert.match(accuracyText, /^\d+%$/,
      'India Progress may show accuracy only after the 5-attempt evidence floor');
  }
  assert.doesNotMatch(progressText, /mastery/i,
    'public India Progress must not invent an unqualified mastery claim for this chapter row');

  return { history, topicAttempts, topicCorrect, accuracyText, progressText };
}

async function warmOffline(page) {
  const controlled = await page.waitForFunction(
    () => Boolean(navigator.serviceWorker && navigator.serviceWorker.controller),
    null, { timeout: 30000 }
  ).then(() => true).catch(() => false);
  assert.equal(controlled, true, 'service worker must control the app before offline restart');

  const warmed = await page.evaluate(() => new Promise(resolve => {
    const channel = new MessageChannel();
    let finished = false;
    const done = value => {
      if (finished) return;
      finished = true;
      resolve(value);
    };
    channel.port1.onmessage = () => done(true);
    navigator.serviceWorker.controller.postMessage({ type: 'pri-warm' }, [channel.port2]);
    setTimeout(() => done(false), 60000);
  }));
  assert.equal(warmed, true, 'offline bank warm-up must complete');
}

async function relaunch(profileDir) {
  const ctx = await chromium.launchPersistentContext(profileDir, {
    headless: true,
    viewport: { width: 1440, height: 900 },
    hasTouch: true,
    reducedMotion: 'reduce'
  });
  return { ctx, page: await pageOf(ctx) };
}

const build = !process.argv.includes('--no-build');
ensureBuild(build);
const server = await serveDist();
const profileDir = await mkdtemp(join(tmpdir(), 'pri-02-golden-'));
let ctx = null;

try {
  let launched = await relaunch(profileDir);
  ctx = launched.ctx;
  let page = launched.page;

  await createFreshStudent(page, server.origin);
  await gotoPractice(page, server.origin);
  for (let i = 0; i < 3; i++) {
    await typedQuestion(page, null);
    await resolveWrong(page, { doubleSecond: i === 2 });
    if (i < 2) await nextFreshTyped(page);
  }

  const beforeRestart = await snapshot(page, server.origin);
  assert.equal(beforeRestart.history, 3);
  assert.equal(beforeRestart.topicAttempts, 3);
  assert.match(beforeRestart.accuracyText, /Too few answers/i);

  const unfinished = await typedQuestion(page, server.origin, { navigate: true });
  await unfinished.input.fill(DRAFT);
  await page.waitForTimeout(500);

  const background = await ctx.newPage();
  await background.goto(server.origin, { waitUntil: 'domcontentloaded' });
  await background.bringToFront();
  await page.waitForTimeout(150);
  await page.bringToFront();
  assert.equal(await unfinished.input.inputValue(), DRAFT,
    'background/foreground must keep unfinished typed work');
  await background.close();

  await warmOffline(page);
  const unfinishedPrompt = unfinished.prompt;
  await ctx.close();
  ctx = null;

  launched = await relaunch(profileDir);
  ctx = launched.ctx;
  page = launched.page;
  await gotoPractice(page, server.origin);
  await page.getByRole('button', { name: 'Answer by typing' }).click().catch(() => {});
  await page.waitForSelector('.editor-body input.answer-input');
  assert.equal(clean(await page.locator('.q-prompt').textContent()), unfinishedPrompt,
    'restart must reopen the same unfinished question');
  assert.equal(await page.locator('.editor-body input.answer-input').inputValue(), DRAFT,
    'restart must recover the typed answer draft for that question');

  const restored = await snapshot(page, server.origin);
  assert.deepEqual(restored, beforeRestart,
    'History and progress evidence must be exactly unchanged by process restart');

  await gotoPractice(page, server.origin);
  await page.getByRole('button', { name: 'Answer by typing' }).click().catch(() => {});
  assert.equal(clean(await page.locator('.q-prompt').textContent()), unfinishedPrompt);
  assert.equal(await page.locator('.editor-body input.answer-input').inputValue(), DRAFT);

  await ctx.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForSelector('.q-prompt');
  await page.getByRole('button', { name: 'Answer by typing' }).click().catch(() => {});
  assert.equal(clean(await page.locator('.q-prompt').textContent()), unfinishedPrompt,
    'offline reload must resume the same unfinished question');
  assert.equal(await page.locator('.editor-body input.answer-input').inputValue(), DRAFT,
    'offline reload must keep the unfinished typed draft');

  await resolveWrong(page);
  const offlineNext = await nextFreshTyped(page);
  assert.ok(offlineNext.prompt.length > 8,
    'next real question must generate with cloud connectivity disabled');
  const offlineNextPrompt = offlineNext.prompt;

  await ctx.close();
  ctx = null;
  launched = await relaunch(profileDir);
  ctx = launched.ctx;
  page = launched.page;
  await ctx.setOffline(true);

  await page.goto(server.origin + '/history', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForSelector('.hist-row');
  assert.equal(await page.locator('.hist-row').count(), 4,
    'offline-resolved attempt must survive a complete application restart');

  await page.goto(server.origin + '/practice?subtopic=' + TOPIC, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForSelector('.q-prompt');
  assert.equal(clean(await page.locator('.q-prompt').textContent()), offlineNextPrompt,
    'offline restart must resume the next unresolved real question');

  await typedQuestion(page, null);
  await resolveWrong(page);

  await page.goto(server.origin + '/history', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForSelector('.hist-row');
  assert.equal(await page.locator('.hist-row').count(), 5,
    'student must continue practising normally after offline restart');

  await ctx.setOffline(false);
  const finalState = await snapshot(page, server.origin);
  assert.equal(finalState.history, 5);
  assert.equal(finalState.topicAttempts, 5);
  assert.match(finalState.accuracyText, /^\d+%$/);

  console.log('PASS — PRI-02 golden student journey: fresh public-V1 profile → 5 real marked questions → evidence-backed History/Progress → restart → unfinished recovery → offline marking/next → offline restart → continue.');
  console.log(JSON.stringify({ beforeRestart, finalState }, null, 2));
} finally {
  if (ctx) await ctx.close().catch(() => {});
  await server.close().catch(() => {});
  await rm(profileDir, { recursive: true, force: true }).catch(() => {});
}
