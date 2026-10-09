// PRI-02 canonical browser regression — real student loop, restart and offline.
//
// Owner decision 2026-10-10: only Pri's server marks. The loop therefore runs
// for a student signed in to the real platform server this file boots
// (support/online-session.mjs: real /v1, SQLite file, a verified account signed
// in through Settings). What "offline" protects changed with that decision and
// is asserted positively: offline, the app still opens from the device, the
// unfinished question and its typed draft are still there, History and
// Progress are unchanged — and Submit marks NOTHING (the card asks to
// reconnect, no verdict, no attempt). Back online, Try again is marked by the
// server exactly once and practice continues. Offline marking is gone and is
// not asserted anywhere.
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from '@playwright/test';
import { ensureBuild } from './e2e.mjs';
import { startOnlinePlatform } from './support/online-session.mjs';

const TOPIC = 'y7-equations';
const TOPIC_NAME = 'Linear Equations';
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
  await page.getByRole('button', { name: 'Use without an account' }).click();
  await page.waitForSelector('[data-onboarding-step="1"]');
  await page.getByRole('button', { name: 'Student', exact: true }).click();
  await page.locator('.auth-card .btn-primary').click();
  await page.waitForSelector('[data-onboarding-step="2"]');
  await page.getByRole('button', { name: /Studying in Australia/ }).click();
  await page.locator('#signup-course').selectOption('nsw');
  await page.locator('#signup-year').selectOption('7');
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
    if (await typeTab.count()) await typeTab.click();
    await page.waitForTimeout(80);
    if (await input.count() === 1) {
      return { prompt: clean(await page.locator('.q-prompt').textContent()), input };
    }
    await page.locator('.ctx-next').click();
    await page.waitForSelector('.q-prompt');
  }
  throw new Error('No typed Linear Equations question was served within 12 explicit safe skips.');
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
  const row = page.locator('.syl-table tbody tr').filter({ hasText: TOPIC_NAME }).first();
  assert.equal(await row.count(), 1, 'Progress must contain the practised Linear Equations row');
  const progressText = clean(await row.textContent());
  const attemptMatch = progressText.match(/(\d+) attempt(?:s)?/i);
  const masteryMatch = progressText.match(/(\d+)% mastery/i);
  assert.ok(attemptMatch, 'Progress row must expose a concrete attempt count: ' + progressText);
  assert.ok(masteryMatch, 'Progress row must expose mastery after repeated practice: ' + progressText);

  return {
    history,
    topicAttempts: Number(attemptMatch[1]),
    mastery: Number(masteryMatch[1]),
    progressText
  };
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
const platform = await startOnlinePlatform();
const server = { origin: platform.origin, close: () => platform.close() };
const profileDir = await mkdtemp(join(tmpdir(), 'pri-02-golden-'));
let ctx = null;

const attemptRows = page => page.evaluate(() => new Promise(ok => {
  const r = indexedDB.open('pri-learning');
  r.onsuccess = () => { const db = r.result; const c = db.transaction('attempts').objectStore('attempts').getAll();
    c.onsuccess = () => { db.close(); ok(c.result.map(a => ({ server: a.serverAttemptId || null, remote: typeof a.remoteEventId === 'string' }))); };
    c.onerror = () => { db.close(); ok(null); }; };
  r.onerror = () => ok(null);
}));
const historyCount = async (page) => {
  await page.goto(server.origin + '/history', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForSelector('.hist-row');
  return page.locator('.hist-row').count();
};

try {
  let launched = await relaunch(profileDir);
  ctx = launched.ctx;
  let page = launched.page;
  let online = platform.session(ctx, page);

  await createFreshStudent(page, server.origin);
  const account = await online.signIn({ name: 'PRI-02 Golden Student' });
  await gotoPractice(page, server.origin);
  for (let i = 0; i < 3; i++) {
    await typedQuestion(page, null);
    await resolveWrong(page, { doubleSecond: i === 2 });
    if (i < 2) await nextFreshTyped(page);
  }
  // Marked by the server, and a double tap on the resolving submit is one attempt.
  assert.equal(platform.ledger(account.id).completions, 3, 'the server must hold exactly three completed questions');
  const firstGrades = await online.practiceCalls(/^\/v1\/practice\/[^/]+\/submit$/);
  assert.ok(firstGrades.length >= 6 && firstGrades.every(c => c.status === 200 && c.json?.authoritative === true && c.json.correct === false),
    'every verdict must be the server\'s authoritative result');
  assert.equal(new Set(firstGrades.map(c => c.body?.submissionId)).size, 6, 'a double tap must reuse its submission key: six keys for six tries');

  const beforeRestart = await snapshot(page, server.origin);
  assert.equal(beforeRestart.history, 3);
  assert.equal(beforeRestart.topicAttempts, 3);
  assert.ok(beforeRestart.mastery >= 0 && beforeRestart.mastery <= 100);

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
  online = platform.session(ctx, page);
  online.account = account;
  await gotoPractice(page, server.origin);
  await page.getByRole('button', { name: 'Answer by typing' }).click().catch(() => {});
  await page.waitForSelector('.editor-body input.answer-input');
  assert.equal(clean(await page.locator('.q-prompt').textContent()), unfinishedPrompt,
    'restart must reopen the same unfinished question');
  assert.equal(await page.locator('.editor-body input.answer-input').inputValue(), DRAFT,
    'restart must recover the typed answer draft for that question');

  const restored = await snapshot(page, server.origin);
  assert.deepEqual(restored, beforeRestart,
    'History, attempts and mastery must be exactly unchanged by process restart');

  await gotoPractice(page, server.origin);
  await page.getByRole('button', { name: 'Answer by typing' }).click().catch(() => {});
  assert.equal(clean(await page.locator('.q-prompt').textContent()), unfinishedPrompt);
  assert.equal(await page.locator('.editor-body input.answer-input').inputValue(), DRAFT);

  // ── offline: the work is there, nothing is marked ──────────────────────────
  await ctx.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForSelector('.q-prompt');
  await page.getByRole('button', { name: 'Answer by typing' }).click().catch(() => {});
  assert.equal(clean(await page.locator('.q-prompt').textContent()), unfinishedPrompt,
    'offline reload must resume the same unfinished question');
  const offlineInput = page.locator('.editor-body input.answer-input');
  assert.equal(await offlineInput.inputValue(), DRAFT,
    'offline reload must keep the unfinished typed draft');

  await offlineInput.fill(WRONG_A);
  await page.getByRole('button', { name: 'Submit Answer' }).click();
  await page.waitForSelector('[data-check-refusal]');
  assert.equal(await page.locator('[data-check-refusal]').first().getAttribute('data-check-refusal'), 'reconnect',
    'offline, Submit must ask to reconnect');
  assert.equal(await page.locator('.verdict-bad, .eval-card, .eval-marks, .solution-block').count(), 0,
    'offline, nothing may be marked: no verdict, marks or solution');
  assert.equal(await offlineInput.inputValue(), WRONG_A, 'offline, the typed answer must stay in the box');
  assert.equal((await attemptRows(page)).length, 3, 'offline, no attempt may be written');
  assert.equal(platform.ledger(account.id).completions, 3, 'offline, the server must have marked nothing');
  assert.ok(!/marked on this device|checked on this device/i.test(await page.locator('.qpage').innerText()),
    'nothing may claim a mark made on this device');

  // ── a complete restart, still offline: nothing lost, nothing invented ──────
  await ctx.close();
  ctx = null;
  launched = await relaunch(profileDir);
  ctx = launched.ctx;
  page = launched.page;
  online = platform.session(ctx, page);
  online.account = account;
  await ctx.setOffline(true);

  await page.goto(server.origin + '/history', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForSelector('.hist-row');
  assert.equal(await page.locator('.hist-row').count(), 3,
    'the three server-marked attempts must survive a complete offline restart — and no fourth may appear');

  await page.goto(server.origin + '/practice?subtopic=' + TOPIC, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForSelector('.q-prompt');
  assert.equal(clean(await page.locator('.q-prompt').textContent()), unfinishedPrompt,
    'offline restart must resume the same unfinished question');
  assert.equal(await page.locator('.verdict-bad, .eval-card').count(), 0,
    'an offline restart must not mark the submission that was refused');

  // ── back online: the same submission is marked by the server, once ─────────
  await ctx.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.getByRole('button', { name: 'Answer by typing' }).click().catch(() => {});
  // The card may still hold the "reconnect" refusal from before the restart,
  // and the first press after reconnecting can be refused once more while the
  // app finds the server again. The student presses Try again; at most TWO
  // presses may be needed, and every press reuses the one submission key,
  // which the counts below hold to exactly one marked attempt.
  let presses = 0;
  const refusals = [];
  while (presses < 2 && !(await page.locator('.verdict-bad').count())) {
    const retry = page.locator('[data-check-retry]');
    if (await retry.count()) await retry.click();
    else {
      await page.locator('.editor-body input.answer-input').fill(WRONG_A);
      await page.getByRole('button', { name: 'Submit Answer' }).click();
    }
    presses++;
    await page.waitForSelector('.verdict-bad, [data-check-refusal]', { timeout: 30000 });
    if (!(await page.locator('.verdict-bad').count())) refusals.push(await page.locator('[data-check-refusal]').first().getAttribute('data-check-refusal'));
  }
  assert.equal(await page.locator('.verdict-bad').count(), 1,
    `after reconnecting, the kept answer must be marked within two presses (pressed ${presses}; refused as ${JSON.stringify(refusals)})`);
  if (presses > 1) console.log(`note: reconnect needed ${presses} presses; first refused as ${JSON.stringify(refusals)}`);
  assert.equal(await page.locator('.eval-card').count(), 0, 'the first try, marked after reconnecting, must leave the question open');
  await page.locator('.editor-body input.answer-input').fill(WRONG_B);
  await page.getByRole('button', { name: 'Submit Answer' }).click();
  await page.waitForSelector('.eval-card');
  assert.equal(platform.ledger(account.id).completions, 4, 'after reconnecting the server must hold exactly one more completion');
  assert.equal(await historyCount(page), 4, 'the reconnected attempt must be in History exactly once');

  await gotoPractice(page, server.origin);
  await typedQuestion(page, null);
  await resolveWrong(page);
  assert.equal(await historyCount(page), 5, 'student must continue practising normally after the offline restart');

  const finalState = await snapshot(page, server.origin);
  assert.equal(finalState.history, 5);
  assert.equal(finalState.topicAttempts, 5);
  assert.ok(finalState.mastery >= 0 && finalState.mastery <= 100);
  const rows = await attemptRows(page);
  assert.ok(rows.length === 5 && rows.every(a => typeof a.server === 'string') && new Set(rows.map(a => a.server)).size === 5,
    'five attempt rows, each one a distinct server attempt: ' + JSON.stringify(rows));
  assert.equal(platform.ledger(account.id).completions, 5, 'the server must hold exactly five completed questions');

  console.log('PASS — PRI-02 golden student journey: fresh profile → signed in → 5 server-marked questions → History/Progress/mastery → restart → unfinished recovery → offline: work kept, nothing marked, reconnect asked → offline restart → reconnect: marked once → continued practice.');
  console.log(JSON.stringify({ beforeRestart, finalState }, null, 2));
} finally {
  if (ctx) await ctx.close().catch(() => {});
  await server.close().catch(() => {});
  await rm(profileDir, { recursive: true, force: true }).catch(() => {});
}
