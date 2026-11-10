// KALP-02 · real-browser information architecture and navigation acceptance.
import { mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';

const ARTIFACTS = fileURLToPath(new URL('../../artifacts/kalp-02/', import.meta.url));
const TABLET = { width: 1024, height: 1366 };
const PHONE = { width: 390, height: 844 };

async function snap(page, name) {
  await mkdir(ARTIFACTS, { recursive: true });
  await page.screenshot({ path: join(ARTIFACTS, name + '.png'), fullPage: true });
}

async function pathState(page) {
  return page.evaluate(() => location.pathname + location.search + location.hash);
}

// The one student interface (client/interface.config.mjs) is the Instrument:
// its navigation is the bar's tabs plus its More menu. Both are read, More
// opened and closed again, so a destination counts wherever the bar puts it.
async function visibleSidebarLabels(page) {
  const tabs = (await page.locator('[data-instrument-bar] .in-tab').allTextContents()).map(s => s.trim());
  let more = [];
  if (await page.locator('#in-more-btn').count()) {
    await page.locator('#in-more-btn').click();
    await page.waitForSelector('#in-more-menu', { timeout: 10000 });
    more = (await page.locator('#in-more-menu [role="menuitem"]').allTextContents()).map(s => s.trim());
    await page.keyboard.press('Escape');
  }
  return [...tabs, ...more];
}

export const flow = {
  id: 'kalp02-navigation',
  name: 'KALP-02 · role-aware IA, deep links and navigation',

  async run({ page, check, goto, settle, createProfile }) {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 300));
    });

    await page.setViewportSize(TABLET);
    await goto('/');
    await createProfile({ name: 'KALP02 Student', year: 10, course: 'in' });
    await settle();

    const studentLabels = await visibleSidebarLabels(page);
    // The v1.0 names are the Instrument's: Home is the Index, Progress the
    // Report, Review is Scripts (every script; Wrong is one of its filters).
    for (const label of ['Index', 'Practice', 'Map', 'Report', 'Scripts', 'Notes', 'Plan', 'Tasks', 'Exams', 'Classes', 'Rapid Fire', 'Match', 'Settings']) {
      await check('student navigation exposes ' + label, studentLabels.includes(label), studentLabels.join(' | '));
    }
    await check('student navigation hides teacher workspace', !studentLabels.includes('Teacher workspace'));
    await snap(page, '01-student-tablet-home');
    await goto('/practice');
    await check('Practice direct load reaches the real workspace',
      !!(await page.waitForSelector('.q-prompt', { timeout: 30000 }).catch(() => null)));

    await goto('/review?filter=wrong');
    await check('Review direct link preserves wrong filter', (await pathState(page)) === '/review?filter=wrong');
    await check('wrong filter is selected', await page.getByRole('button', { name: /Incorrect/i }).getAttribute('aria-pressed') === 'true');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.shell');
    await check('Review survives refresh with query state', (await pathState(page)) === '/review?filter=wrong');

    await page.getByRole('button', { name: /Bookmarked/i }).click();
    await check('Review filter writes canonical query state', (await pathState(page)) === '/review?filter=bookmarked');
    await page.goBack();
    await check('Back restores prior Review filter', (await pathState(page)) === '/review?filter=wrong');
    await page.goForward();
    await check('Forward restores later Review filter', (await pathState(page)) === '/review?filter=bookmarked');
    await snap(page, '02-student-review');

    for (const [legacy, canonical] of [
      ['/history', '/review'],
      ['/favorites', '/review?filter=bookmarked'],
      ['/mistakes', '/review?filter=wrong'],
      ['/stats', '/progress'],
      ['/badges', '/progress'],
    ]) {
      await goto(legacy);
      await page.waitForTimeout(150);
      await check(legacy + ' redirects without a duplicate destination', (await pathState(page)) === canonical, await pathState(page));
    }
    // The Map is a destination of its own in the Instrument, not a Progress tab.
    await goto('/map');
    await page.waitForTimeout(150);
    await check('/map is its own destination', (await pathState(page)) === '/map' && !!(await page.waitForSelector('[data-map-chapter]', { timeout: 30000 }).catch(() => null)), await pathState(page));
    await goto('/teach');
    await page.waitForTimeout(150);
    await check('student direct Teacher Studio URL returns safely to Home', (await pathState(page)) === '/');
    await goto('/definitely-not-a-route');
    await page.waitForTimeout(150);
    await check('unknown student route returns to Home', (await pathState(page)) === '/');

    await page.setViewportSize(PHONE);
    await goto('/');
    const primaryPhone = await page.locator('.mobilenav .mnav-item').allTextContents();
    for (const label of ['Index', 'Practice', 'Map', 'Report', 'More']) {
      await check('phone primary navigation exposes ' + label, primaryPhone.some(x => x.includes(label)), primaryPhone.join(' | '));
    }
    await page.getByRole('button', { name: /More/i }).click();
    const moreText = await page.locator('#mobile-more').innerText();
    for (const label of ['Scripts', 'Notes', 'Plan', 'Tasks', 'Exams', 'Classes', 'Rapid Fire', 'Match', 'Settings']) {
      await check('student More exposes ' + label, moreText.includes(label), moreText);
    }
    await snap(page, '03-student-phone-more');
    await page.keyboard.press('Escape');
    await check('Escape closes More', await page.locator('#mobile-more').count() === 0);
    await check('Escape restores focus to More trigger', await page.evaluate(() => document.activeElement?.getAttribute('aria-controls') === 'mobile-more'));
    await page.setViewportSize(TABLET);
    await page.locator('#acct-menu-btn').click();
    await page.getByRole('menuitem', { name: /Switch profile/i }).click();
    await page.waitForSelector('.acct-list');
    // A teacher device profile, made from the picker's device-profile wizard,
    // passes the same activation gate (issue #477): the gate's sign-in card
    // links it to a verified account before the workspace opens.
    await createProfile({ role: 'teacher', name: 'KALP02 Teacher', year: 10 });
    await page.waitForSelector('.teacher-workspace-head', { timeout: 30000 });
    await check('teacher profile lands in Teacher Workspace', (await pathState(page)) === '/teach', await pathState(page));

    const teacherLabels = await visibleSidebarLabels(page);
    for (const label of ['Teacher workspace', 'Classes', 'Assignments', 'Analytics & reports', 'Question tools', 'Settings']) {
      await check('teacher navigation exposes ' + label, teacherLabels.includes(label), teacherLabels.join(' | '));
    }
    for (const label of ['Index', 'Practice', 'Map', 'Report', 'Scripts', 'Exams', 'Rapid Fire', 'Match']) {
      await check('teacher navigation hides student-only ' + label, !teacherLabels.includes(label), teacherLabels.join(' | '));
    }
    await snap(page, '04-teacher-tablet-workspace');

    for (const [studentRoute, teacherRoute, anchor] of [
      ['/tasks', '/teach#teacher-assignments', 'teacher-assignments'],
      ['/progress', '/teach#teacher-analytics', 'teacher-analytics'],
      ['/classes', '/teach#teacher-classes', 'teacher-classes'],
      ['/practice', '/teach', null],
      ['/exams', '/teach', null],
      ['/match', '/teach', null],
    ]) {
      await goto(studentRoute);
      await page.waitForTimeout(180);
      await check('teacher direct ' + studentRoute + ' is role-safe', (await pathState(page)) === teacherRoute, await pathState(page));
      if (anchor) await check(anchor + ' exists on the real workspace', await page.locator('#' + anchor).count() === 1);
    }
    await goto('/teach#teacher-classes');
    await page.waitForTimeout(180);
    await page.locator('[data-instrument-bar] .in-tab', { hasText: 'Assignments' }).first().click();
    await page.waitForTimeout(120);
    await check('teacher tab changes hash without leaving workspace', (await pathState(page)) === '/teach#teacher-assignments', await pathState(page));
    await page.goBack();
    await check('Back restores prior teacher workspace section', (await pathState(page)) === '/teach#teacher-classes');
    await page.goForward();
    await check('Forward restores teacher workspace section', (await pathState(page)) === '/teach#teacher-assignments');

    await goto('/');
    await page.waitForTimeout(150);
    await check('teacher root resolves to Teacher Workspace', (await pathState(page)) === '/teach');
    await goto('/unknown-for-teacher');
    await page.waitForTimeout(150);
    await check('unknown teacher route resolves to Teacher Workspace', (await pathState(page)) === '/teach');

    await page.locator('#acct-menu-btn').click();
    const menuText = await page.locator('[role=menu]').innerText();
    await check('teacher account menu includes Teacher Workspace', menuText.includes('Teacher workspace'), menuText);
    await check('teacher account menu omits student My Progress', !menuText.includes('My progress'), menuText);
    await page.keyboard.press('Escape');

    await check('no browser console errors were introduced', consoleErrors.length === 0, consoleErrors.slice(0, 5).join(' · '));
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
