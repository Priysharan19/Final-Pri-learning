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

async function visibleSidebarLabels(page) {
  return page.locator('.sidebar .nav-label').allTextContents();
}

async function createTeacher(page) {
  await page.getByRole('button', { name: /Add another/i }).click();
  await page.waitForSelector('[data-onboarding-step="1"]');
  await page.getByRole('button', { name: 'Teacher', exact: true }).click();
  await page.locator('.auth-card .btn-primary').click();
  await page.waitForSelector('[data-onboarding-step="2"]');
  await page.locator('#signup-track').selectOption('10');
  await page.locator('.auth-card .btn-primary').click();
  await page.waitForSelector('[data-onboarding-step="3"]');
  await page.locator('#signup-name').fill('KALP02 Teacher');
  await page.locator('.auth-card .btn-primary').click();
  await page.waitForSelector('[data-onboarding-step="4"]');
  await page.locator('.auth-card .btn-primary').click();
  await page.waitForSelector('[data-onboarding-step="5"]');
  await page.getByRole('button', { name: 'Open Teacher Workspace' }).click();
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
    for (const label of ['Home', 'Practice', 'Tasks', 'Exams', 'Classes', 'Progress', 'Review', 'Rapid Fire', 'Match', 'Settings']) {
      await check('student sidebar exposes ' + label, studentLabels.includes(label), studentLabels.join(' | '));
    }
    await check('student sidebar hides teacher workspace', !studentLabels.includes('Teacher workspace'));
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
      ['/map', '/progress?tab=map'],
      ['/stats', '/progress'],
      ['/badges', '/progress'],
    ]) {
      await goto(legacy);
      await page.waitForTimeout(150);
      await check(legacy + ' redirects without a duplicate destination', (await pathState(page)) === canonical, await pathState(page));
    }
    await goto('/teach');
    await page.waitForTimeout(150);
    await check('student direct Teacher Studio URL returns safely to Home', (await pathState(page)) === '/');
    await goto('/definitely-not-a-route');
    await page.waitForTimeout(150);
    await check('unknown student route returns to Home', (await pathState(page)) === '/');

    await page.setViewportSize(PHONE);
    await goto('/');
    const primaryPhone = await page.locator('.mobilenav .mnav-item').allTextContents();
    for (const label of ['Home', 'Practice', 'Tasks', 'Progress', 'More']) {
      await check('phone primary navigation exposes ' + label, primaryPhone.some(x => x.includes(label)), primaryPhone.join(' | '));
    }
    await page.getByRole('button', { name: /More/i }).click();
    const moreText = await page.locator('#mobile-more').innerText();
    for (const label of ['Exams', 'Classes', 'Review', 'Rapid Fire', 'Match', 'Settings']) {
      await check('student More exposes ' + label, moreText.includes(label), moreText);
    }
    await snap(page, '03-student-phone-more');
    await page.keyboard.press('Escape');
    await check('Escape closes More', await page.locator('#mobile-more').count() === 0);
    await check('Escape restores focus to More trigger', await page.evaluate(() => document.activeElement?.getAttribute('aria-controls') === 'mobile-more'));

    // CP-10: Back, then a nav tap before the router has rendered Home. The
    // router applies location in a transition, so inside the popstate handler
    // it still reports /practice; the tap must push, keeping Home behind it.
    await goto('/');
    await page.locator('.mobilenav a[href="/practice"]').click();
    await page.waitForFunction(() => location.pathname === '/practice');
    await settle();
    const race = await page.evaluate(() => new Promise(resolve => {
      addEventListener('popstate', () => {
        const before = { path: location.pathname, idx: history.state?.idx };
        document.querySelector('.mobilenav a[href="/practice"]').click();
        resolve({ before, path: location.pathname, idx: history.state?.idx });
      }, { once: true });
      history.back();
    }));
    await check('Back reached Home (idx 0) before the tap', race.before.path === '/' && race.before.idx === 0, JSON.stringify(race));
    await check('a nav tap during the Back render pushes (idx > 0)', race.path === '/practice' && race.idx > 0, JSON.stringify(race));
    await page.goBack();
    await page.waitForTimeout(150);
    await check('Home is still behind it: Back returns Home', (await pathState(page)) === '/' && await page.evaluate(() => history.state?.idx === 0));
    await page.setViewportSize(TABLET);
    await page.locator('#acct-menu-btn').click();
    await page.getByRole('menuitem', { name: /Switch profile/i }).click();
    await page.waitForSelector('.acct-list');
    await createTeacher(page);
    await page.waitForSelector('.teacher-workspace-head', { timeout: 30000 });
    await check('teacher profile lands in Teacher Workspace', (await pathState(page)) === '/teach', await pathState(page));

    const teacherLabels = await visibleSidebarLabels(page);
    for (const label of ['Teacher workspace', 'Classes', 'Assignments', 'Analytics & reports', 'Question tools', 'Settings']) {
      await check('teacher sidebar exposes ' + label, teacherLabels.includes(label), teacherLabels.join(' | '));
    }
    for (const label of ['Practice', 'Exams', 'Rapid Fire', 'Match']) {
      await check('teacher sidebar hides student-only ' + label, !teacherLabels.includes(label), teacherLabels.join(' | '));
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
    await page.getByText('Assignments', { exact: true }).first().click();
    await page.waitForTimeout(120);
    await check('teacher sidebar link changes hash without leaving workspace', (await pathState(page)) === '/teach#teacher-assignments', await pathState(page));
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
