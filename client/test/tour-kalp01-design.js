// KALP-01 · real-browser visual and responsive acceptance flow.
// This uses the same production build and profile UI as the main Pri E2E
// suite. It does not inject a profile, mock API responses, or fake a success
// state. Screenshots are evidence of the state the working app reached.
//
// Only Pri's server marks (owner decision 2026-10-10), so the flow runs
// against the real in-process platform server (support/online-session.mjs).
// It first proves the signed-out student is honestly refused — nothing marked,
// nothing sent — then signs in through the app and proves the feedback on the
// card is the server's own authoritative receipt.

import { mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { serverMarking, nothingMarkedOnCard } from './support/server-marked.mjs';

const ARTIFACTS = fileURLToPath(new URL('../../artifacts/kalp-01/', import.meta.url));
const TABLET = { width: 1024, height: 1366 };
const TABLET_LANDSCAPE = { width: 1366, height: 1024 };
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

async function snap(page, name) {
  await mkdir(ARTIFACTS, { recursive: true });
  const path = join(ARTIFACTS, `${name}.png`);
  await page.screenshot({ path, fullPage: true });
  return path;
}

async function fit(page) {
  return page.evaluate(() => ({
    over: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
    width: document.documentElement.clientWidth,
    height: document.documentElement.clientHeight
  }));
}

async function contrast(page) {
  return page.evaluate(() => {
    const parse = (value) => {
      const nums = String(value).match(/[\d.]+/g)?.slice(0, 3).map(Number) || [];
      return nums.length === 3 ? nums : null;
    };
    const luminance = (rgb) => {
      const c = rgb.map(v => {
        const x = v / 255;
        return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const style = getComputedStyle(document.body);
    const fg = parse(style.color);
    const bg = parse(style.backgroundColor);
    if (!fg || !bg) return null;
    const l1 = luminance(fg);
    const l2 = luminance(bg);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  });
}

async function createStudentThroughUI(page, settle) {
  await page.getByRole('button', { name: 'Use without an account' }).click();
  await page.waitForSelector('[data-onboarding-step="1"]', { timeout: 15000 });
  await page.getByRole('button', { name: 'Student', exact: true }).click();
  await page.locator('.auth-card .btn-primary').click();
  await page.waitForSelector('[data-onboarding-step="2"]');
  await page.locator('#signup-track').selectOption('10');
  await page.locator('.auth-card .btn-primary').click();
  await page.waitForSelector('[data-onboarding-step="3"]');
  await page.locator('#signup-name').fill('KALP Demo Student');
  await page.locator('.auth-card .btn-primary').click();
  await page.waitForSelector('[data-onboarding-step="4"]');
  await page.locator('.auth-card .btn-primary').click();
  await page.waitForSelector('[data-onboarding-step="5"]');
  await page.getByRole('button', { name: 'Start learning' }).click();
  await page.waitForSelector('.home-greet', { timeout: 30000 });
  await settle();
}

async function forceTypedAnswerMode(page) {
  const typeButton = page.getByRole('button', { name: /Answer by typing/i }).first();
  if (await typeButton.count()) await typeButton.click();
  await page.waitForTimeout(250);
}

/** POSTs that ask the server to issue, mark or reveal — not `prepare`. */
const MARKING = /^\/v1\/practice\/(?:issue|[^/]+\/(?:submit|reveal|recognize|repeat|recognition\/.+))$/;

async function enterAnAnswer(page, check) {
  await forceTypedAnswerMode(page);
  const mcq = page.locator('.mcq button:visible').first();
  if (await mcq.count()) {
    await mcq.click();
  } else {
    const answer = page.locator('.answer-input:visible').first();
    const working = page.locator('.working-input:visible').first();
    if (await answer.count()) await answer.fill('0');
    else if (await working.count()) await working.fill('0');
    else {
      await check('practice exposes an answer control', false, 'no visible MCQ, typed answer or working field');
      return null;
    }
  }
  const submit = page.locator('.editor-foot .btn-primary:visible, .row.no-print .btn-primary:visible').first();
  if (!(await submit.count())) {
    await check('practice exposes a real submit control', false, 'submit button not found');
    return null;
  }
  return submit;
}

/**
 * Signed out, the card says so BEFORE anything is submitted, and nothing is
 * marked. Submit is deliberately not pressed here: the refusal after a press is
 * tour-online-check's subject, and this flow goes on to mark this same question.
 */
async function signedOutSaysSo(page, check, online) {
  await forceTypedAnswerMode(page);
  const notice = page.locator('[data-check-needs-account]');
  await notice.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  const row = await online.shownRow();
  const shown = await nothingMarkedOnCard(page);
  const sent = (await online.practiceCalls(MARKING)).map(c => c.path);
  const words = await notice.innerText().catch(() => '');
  return check('signed out, the question says checking needs a Pri account: sign-in in the card, no verdict, nothing issued or sent to be marked',
    /needs a Pri account/i.test(words) && await notice.locator('[data-check-sign-in]').isEnabled().catch(() => false)
      && row?.checkState === 'prepared' && !row.serverQuestionId && shown.none && sent.length === 0
      && !/marked on this device|checked on this device/i.test(await page.locator('.qpage').innerText()),
    JSON.stringify({ words: words.slice(0, 160), row: row && { checkState: row.checkState, issued: !!row.serverQuestionId }, card: shown.card, sent }));
}

async function reachFeedback(page, check, online) {
  const submit = await enterAnAnswer(page, check);
  if (!submit) return false;
  await submit.click();
  const reached = await page.waitForSelector('.verdict-bad, .eval-card', { timeout: 30000 })
    .then(() => true).catch(() => false);
  const marking = await serverMarking(online, page);
  // "Real feedback" is the server's: an authoritative receipt for the question
  // this account was issued, and the verdict on the card is that receipt's.
  await check('submitting a real answer reaches real feedback', reached && marking.ok, JSON.stringify(marking));
  const ledger = online.ledger(marking.serverQuestionId);
  await check('the feedback is the server\'s authoritative receipt for a question it issued to this account',
    marking.owned && marking.authoritative && marking.agrees && ledger.issued >= 1
      && ledger.thisDone === (marking.receipt?.resolved ? 1 : 0),
    JSON.stringify({ marking, ledger }));
  return reached && marking.ok;
}

export const flow = {
  id: 'kalp01-design',
  name: 'KALP-01 · visual system, tablet and real demo journey',
  online: true,

  async run({ page, check, goto, settle, online }) {
    // The flow now runs against the real server, and a browser logs every
    // non-2xx reply as a console error of its own. While the student is signed
    // out, the server answering 401 to the app's "is anyone signed in?" reads
    // is the correct reply, not a fault: only those — a 401, from this
    // server's /v1, before sign-in — are set aside. Every other console error,
    // and any 401 once signed in, still fails the flow.
    const consoleErrors = [];
    let signedIn = false;
    page.on('console', msg => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      let from = null;
      try { from = new URL(msg.location()?.url || ''); } catch { from = null; }
      const signedOutProbe = !signedIn && /^Failed to load resource: the server responded with a status of 401\b/.test(text)
        && from?.origin === online.origin && from.pathname.startsWith('/v1/');
      if (!signedOutProbe) consoleErrors.push(`${text.slice(0, 300)}${from ? ` @${from.pathname}` : ''}`);
    });

    await page.setViewportSize(TABLET);
    await goto('/');
    await settle();

    await check('the real first-entry hero renders', await page.locator('.hero-title').isVisible());
    await snap(page, '01-login-tablet-dark');

    await createStudentThroughUI(page, settle);
    await check('a student profile created through the product reaches Home', await page.locator('.home-greet').isVisible());
    await snap(page, '02-home-tablet-dark');

    const tabletNav = await page.evaluate(() => {
      const bar = document.querySelector('.sidebar');
      const labels = [...document.querySelectorAll('.nav-label')];
      if (!bar) return null;
      const r = bar.getBoundingClientRect();
      return {
        width: Math.round(r.width),
        visibleLabels: labels.filter(el => {
          const s = getComputedStyle(el);
          const rr = el.getBoundingClientRect();
          return s.opacity !== '0' && rr.width > 0 && rr.height > 0;
        }).length
      };
    });
    await check('tablet navigation is persistently usable without hover',
      tabletNav && tabletNav.width >= 170 && tabletNav.visibleLabels >= 6,
      JSON.stringify(tabletNav));

    const routes = [
      ['/', 'home'],
      ['/practice', 'practice'],
      ['/progress', 'progress'],
      ['/exams', 'exams'],
      ['/tasks', 'tasks'],
      ['/teach', 'teach'],
      ['/settings', 'settings']
    ];

    for (const [route, name] of routes) {
      await goto(route);
      if (route === '/practice') await page.waitForSelector('.q-prompt', { timeout: 30000 }).catch(() => null);
      await page.waitForTimeout(500);
      const box = await fit(page);
      await check(`${name} has no horizontal overflow at iPad portrait`, box.over <= 1, JSON.stringify(box));
      await snap(page, `tablet-${name}-dark`);
    }

    await goto('/practice');
    await page.waitForSelector('.q-prompt', { timeout: 30000 });
    await settle();
    await signedOutSaysSo(page, check, online);
    await snap(page, '03a-practice-sign-in-needed-tablet');

    // Sign in through the app (Settings → Pri account), then mark for real.
    await online.signIn({ name: 'KALP Demo Student' });
    signedIn = true;
    await goto('/practice');
    await page.waitForSelector('.q-prompt', { timeout: 30000 });
    await settle();
    if (await reachFeedback(page, check, online)) {
      await snap(page, '03-practice-feedback-tablet-dark');
      const explain = page.locator('.pri-explain-launch:visible, .pri-explain-play:visible').first();
      if (await explain.count()) {
        await explain.click();
        const opened = await page.waitForSelector('.pri-explain-dialog', { timeout: 15000 })
          .then(() => true).catch(() => false);
        await check('Pri Explain opens from the real resolved question when available', opened);
        if (opened) await snap(page, '04-pri-explain-tablet-dark');
      }
    }

    await goto('/');
    await page.setViewportSize(TABLET_LANDSCAPE);
    await page.waitForTimeout(350);
    let box = await fit(page);
    await check('Home has no overflow at iPad landscape', box.over <= 1, JSON.stringify(box));
    await snap(page, '05-home-tablet-landscape-dark');

    await page.setViewportSize(DESKTOP);
    await goto('/');
    box = await fit(page);
    await check('Home has no overflow on desktop', box.over <= 1, JSON.stringify(box));
    await snap(page, '06-home-desktop-dark');

    const toggle = page.locator('header .btn[aria-label*="light" i], header .btn[aria-label*="theme" i]').first();
    await check('theme toggle is present', await toggle.count() === 1);
    if (await toggle.count()) {
      await toggle.click();
      await page.waitForTimeout(250);
      // Paper is the default identity; the toggle moves the account to the
      // same notebook at night, and both must read.
      const isDark = await page.evaluate(() => document.documentElement.dataset.theme === 'dark');
      await check('night theme activates through the real account preference', isDark);
      const ratio = await contrast(page);
      await check('night theme body text has readable contrast', ratio === null || ratio >= 4.5, `ratio=${ratio}`);
      await snap(page, '07-home-desktop-night');
      await toggle.click();
      await page.waitForTimeout(250);
      await check('paper theme restores through the same preference',
        await page.evaluate(() => document.documentElement.dataset.theme === 'light'));
      const paperRatio = await contrast(page);
      await check('paper theme body text has readable contrast', paperRatio === null || paperRatio >= 4.5, `ratio=${paperRatio}`);
    }

    await page.keyboard.press('Tab');
    const focus = await page.evaluate(() => {
      const el = document.activeElement;
      const style = el ? getComputedStyle(el) : null;
      return el && style ? {
        tag: el.tagName,
        className: el.className,
        outlineWidth: style.outlineWidth,
        outlineStyle: style.outlineStyle
      } : null;
    });
    await check('keyboard focus is visibly styled',
      focus && focus.outlineStyle !== 'none' && parseFloat(focus.outlineWidth) >= 2,
      JSON.stringify(focus));

    const reduced = await page.evaluate(() => {
      const button = document.querySelector('.btn');
      if (!button) return null;
      const s = getComputedStyle(button);
      return { transitionDuration: s.transitionDuration, animationDuration: s.animationDuration };
    });
    await check('reduced-motion media query suppresses long control motion',
      reduced && !/(^|,\s*)(?:0\.[1-9]|[1-9])s/.test(reduced.transitionDuration),
      JSON.stringify(reduced));

    await page.setViewportSize(PHONE);
    for (const [route, name] of [['/', 'home'], ['/practice', 'practice'], ['/progress', 'progress'], ['/settings', 'settings']]) {
      await goto(route);
      if (route === '/practice') await page.waitForSelector('.q-prompt', { timeout: 30000 }).catch(() => null);
      await page.waitForTimeout(450);
      box = await fit(page);
      await check(`${name} has no horizontal overflow at phone width`, box.over <= 1, JSON.stringify(box));
      if (name === 'practice') await snap(page, '08-practice-phone-light');
    }
    await snap(page, '09-settings-phone-light');

    await check('no browser console errors were introduced', consoleErrors.length === 0, consoleErrors.slice(0, 4).join(' · '));
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
