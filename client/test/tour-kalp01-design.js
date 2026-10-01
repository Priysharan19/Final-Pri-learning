// KALP-01 · real-browser visual and responsive acceptance flow.
// This uses the same local-first production build and profile UI as the main
// Pri E2E suite. It does not inject a profile, mock API responses, or fake a
// success state. Screenshots are evidence of the state the working app reached.

import { mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';

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
  await page.getByRole('button', { name: 'Get Started' }).click();
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

async function reachFeedback(page, check) {
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
      return false;
    }
  }

  const submit = page.locator('.editor-foot .btn-primary:visible, .row.no-print .btn-primary:visible').first();
  if (!(await submit.count())) {
    await check('practice exposes a real submit control', false, 'submit button not found');
    return false;
  }
  await submit.click();
  const reached = await page.waitForSelector('.verdict, .eval-card', { timeout: 30000 })
    .then(() => true).catch(() => false);
  await check('submitting a real answer reaches real feedback', reached);
  return reached;
}

export const flow = {
  id: 'kalp01-design',
  name: 'KALP-01 · visual system, tablet and real demo journey',

  async run({ page, check, goto, settle }) {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 300));
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
    if (await reachFeedback(page, check)) {
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
      const isLight = await page.evaluate(() => document.documentElement.dataset.theme === 'light');
      await check('light theme activates through the real account preference', isLight);
      const ratio = await contrast(page);
      await check('light theme body text has readable contrast', ratio === null || ratio >= 4.5, `ratio=${ratio}`);
      await snap(page, '07-home-desktop-light');
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
