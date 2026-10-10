// KALP-03 · real-browser onboarding and profile creation acceptance.
//
// Only Pri's server marks (owner decision 2026-10-10), so the "first learning
// action" runs against the real in-process platform server
// (support/online-session.mjs). The device-only student is first shown,
// honestly, that checking needs a Pri account and nothing is marked; then the
// profile is signed in through the app and the feedback on the card must be
// the server's own authoritative receipt.
import { mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { serverMarking, nothingMarkedOnCard } from './support/server-marked.mjs';

const ARTIFACTS = fileURLToPath(new URL('../../artifacts/kalp-03/', import.meta.url));
const PHONE = { width: 390, height: 844 };
const IPAD_PORTRAIT = { width: 1024, height: 1366 };
const IPAD_LANDSCAPE = { width: 1366, height: 1024 };
const DESKTOP = { width: 1440, height: 900 };

async function snap(page, name) {
  await mkdir(ARTIFACTS, { recursive: true });
  await page.screenshot({ path: join(ARTIFACTS, name + '.png'), fullPage: true });
}

async function next(page) {
  await page.locator('.auth-card .btn-primary').click();
}

async function switchProfile(page) {
  await page.locator('.user-chip').click();
  await page.getByRole('menuitem', { name: 'Switch profile' }).click();
  await page.waitForSelector('.acct-list', { timeout: 15000 });
}

async function beginAdditional(page, role = 'student') {
  await page.getByRole('button', { name: /Add another profile/i }).click();
  await page.waitForSelector('[data-onboarding-step="1"]');
  await page.getByRole('button', { name: role === 'teacher' ? 'Teacher' : 'Student', exact: true }).click();
  await next(page);
}

async function chooseIndia(page, choice, year = null) {
  await page.waitForSelector('[data-onboarding-step="2"]');
  await page.locator('#signup-track').selectOption(choice);
  if (year !== null && await page.locator('#signup-year').count()) {
    await page.locator('#signup-year').selectOption(String(year));
  }
  await next(page);
}

async function personalise(page, name, { language = 'en', avatarIndex = 0 } = {}) {
  await page.waitForSelector('[data-onboarding-step="3"]');
  await page.locator('#signup-name').fill(name);
  if (language !== 'en') await page.locator('.auth-card button[lang="' + language + '"]').click();
  const avatars = page.locator('.avatar-pick');
  if (await avatars.count() > avatarIndex) await avatars.nth(avatarIndex).click();
  await next(page);
}

async function finishLocal(page, { email = '', protect = false, password = '' } = {}) {
  await page.waitForSelector('[data-onboarding-step="4"]');
  if (email) await page.locator('#signup-email').fill(email);
  if (protect) {
    await page.locator('.check-row input[type=checkbox]').check();
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Repeat password').fill(password);
  }
  await next(page);
  await page.waitForSelector('[data-onboarding-step="5"]');
}

/** POSTs that ask the server to issue, mark or reveal — not `prepare`. */
const MARKING = /^\/v1\/practice\/(?:issue|[^/]+\/(?:submit|reveal|recognize|repeat|recognition\/.+))$/;

async function openPractice(page) {
  await page.goto(new URL('/practice', page.url()).href, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.q-prompt', { timeout: 30000 });
  const type = page.getByRole('button', { name: /Answer by typing/i }).first();
  if (await type.count()) await type.click();
  await page.waitForTimeout(150);
  return (await page.locator('.q-prompt').innerText()).trim();
}

/**
 * The profile onboarding just made is device-only. Practice opens for it, and
 * says before anything is submitted that checking needs a Pri account. Submit
 * is not pressed here: the refusal after a press is tour-online-check's
 * subject, and this flow goes on to have this same profile marked.
 */
async function deviceOnlyProfileIsNotMarked(page, check, online) {
  const before = await openPractice(page);
  await check('new student reaches a real Practice question', before.length > 5);
  const notice = page.locator('[data-check-needs-account]');
  await notice.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  const row = await online.shownRow();
  const shown = await nothingMarkedOnCard(page);
  const sent = (await online.practiceCalls(MARKING)).map(c => c.path);
  const words = await notice.innerText().catch(() => '');
  await check('a device-only profile is told checking needs a Pri account: sign-in in the card, no verdict, nothing issued or sent to be marked',
    /needs a Pri account/i.test(words) && await notice.locator('[data-check-sign-in]').isEnabled().catch(() => false)
      && row?.checkState === 'prepared' && !row.serverQuestionId && shown.none && sent.length === 0
      && !/marked on this device|checked on this device/i.test(await page.locator('.qpage').innerText()),
    JSON.stringify({ words: words.slice(0, 160), row: row && { checkState: row.checkState, issued: !!row.serverQuestionId }, card: shown.card, sent }));
}

async function reachRealFeedback(page, check, online) {
  await openPractice(page);
  const mcq = page.locator('.mcq button:visible').first();
  if (await mcq.count()) {
    await mcq.click();
  } else {
    const answer = page.locator('.answer-input:visible').first();
    const working = page.locator('.working-input:visible').first();
    if (await answer.count()) await answer.fill('0');
    else if (await working.count()) await working.fill('0');
    else throw new Error('No real answer control was available in Practice.');
  }
  const submit = page.locator('.editor-foot .btn-primary:visible, .row.no-print .btn-primary:visible').first();
  await submit.click();
  const feedback = await page.waitForSelector('.verdict-bad, .eval-card', { timeout: 30000 }).catch(() => null);
  // "Real marking" is the server's: an authoritative receipt for the question
  // it issued to this account, and the verdict on the card is that receipt's.
  const marking = await serverMarking(online, page);
  await check('a real answer reaches real marking feedback', !!feedback && marking.ok, JSON.stringify(marking));
  const ledger = online.ledger(marking.serverQuestionId);
  await check('the feedback is the server\'s authoritative receipt for a question it issued to this account',
    marking.owned && marking.authoritative && marking.agrees && marking.submits === 1 && ledger.issued >= 1
      && ledger.thisDone === (marking.receipt?.resolved ? 1 : 0),
    JSON.stringify({ marking, ledger }));

  // Another question is another question id. Its wording may match the last
  // one word for word when the numbers are read from the figure, so the text
  // is not what tells them apart, and a fixed pause is not what waits for it.
  const idOf = () => page.locator('.qpage[data-question-id]').first().getAttribute('data-question-id').catch(() => null);
  const markedId = await idOf();
  const nextButton = page.locator('.ctx-next:visible').first();
  if (await nextButton.count()) {
    await nextButton.click();
    await page.waitForFunction(id => {
      const el = document.querySelector('.qpage[data-question-id]');
      return el && el.getAttribute('data-question-id') !== id && el.querySelector('.q-prompt');
    }, markedId, { timeout: 30000 }).catch(() => {});
    const afterId = await idOf();
    const after = (await page.locator('.q-prompt').innerText()).trim();
    await check('the learning journey can continue to another question', !!markedId && !!afterId && afterId !== markedId && after.length > 5,
      `before ${markedId}; after ${afterId}; prompt ${JSON.stringify(after.slice(0, 60))}`);
  } else {
    await check('the learning journey can continue to another question', false, 'no Next control on the marked question');
  }
}

export const flow = {
  id: 'kalp03-onboarding',
  name: 'KALP-03 · onboarding, real profiles and first learning action',
  online: true,

  async run({ page, check, goto, settle, online }) {
    await page.setViewportSize(IPAD_PORTRAIT);
    await goto('/');

    await check('cold launch shows the first-run hero', await page.locator('.hero-title').isVisible());
    await page.getByRole('button', { name: 'Use without an account' }).click();
    await page.waitForSelector('[data-onboarding-step="1"]');
    await check('onboarding begins at role', await page.locator('[data-onboarding-step="1"]').count() === 1);
    await check('role buttons expose semantic selected state',
      await page.getByRole('button', { name: 'Student', exact: true }).getAttribute('aria-pressed') === 'false');

    await next(page);
    await check('missing role cannot advance', await page.locator('[data-onboarding-step="1"]').count() === 1);
    await check('missing role is announced', await page.locator('[role="alert"]').count() === 1);

    await page.getByRole('button', { name: 'Student', exact: true }).click();
    await check('Student selection is not colour-only',
      await page.getByRole('button', { name: 'Student', exact: true }).getAttribute('aria-pressed') === 'true');
    await next(page);
    await page.waitForSelector('[data-onboarding-step="2"]');
    await check('focus follows the stage heading',
      await page.evaluate(() => document.activeElement?.tagName === 'H1'));
    await check('curriculum has no silent default', await page.locator('#signup-track').inputValue() === '');

    await next(page);
    await check('missing curriculum cannot advance', await page.locator('[data-onboarding-step="2"]').count() === 1);
    await page.locator('#signup-track').selectOption('10');
    const trackOptions = await page.locator('#signup-track option').allInnerTexts();
    await check('India offers CBSE, JEE Main, JEE Advanced and Olympiad',
      trackOptions.includes('Class 10') && trackOptions.includes('JEE Main')
      && trackOptions.includes('JEE Advanced') && trackOptions.some(x => /^Olympiad/.test(x)));

    await page.setViewportSize(PHONE);
    await check('phone onboarding has no horizontal clipping',
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
    await snap(page, '01-phone-curriculum');
    await page.setViewportSize(IPAD_PORTRAIT);
    await snap(page, '02-ipad-portrait-curriculum');
    await next(page);

    await page.waitForSelector('[data-onboarding-step="3"]');
    await next(page);
    await check('blank name cannot advance', await page.locator('[data-onboarding-step="3"]').count() === 1);
    await page.locator('#signup-name').fill('KALP03 Class 10 Student');
    await page.locator('.avatar-pick').nth(3).click();
    await check('avatar selection exposes pressed state',
      await page.locator('.avatar-pick').nth(3).getAttribute('aria-pressed') === 'true');
    await page.setViewportSize(IPAD_LANDSCAPE);
    await snap(page, '03-ipad-landscape-personalise');
    await next(page);

    await page.waitForSelector('[data-onboarding-step="4"]');
    await page.locator('#signup-email').fill('not-an-email');
    await next(page);
    await check('invalid optional email cannot advance', await page.locator('[data-onboarding-step="4"]').count() === 1);
    await check('invalid email is programmatically marked',
      await page.locator('#signup-email').getAttribute('aria-invalid') === 'true');
    await page.locator('#signup-email').fill('');
    const identityCopy = await page.locator('.auth-card').innerText();
    await check('device-only identity is unmistakably not a cloud sign-in',
      /(?:not|never) verified/i.test(identityCopy) && /not a sign-in/i.test(identityCopy)
      && /handwriting\/photo reading/i.test(identityCopy));
    const identityPath = await page.getByTestId('onboarding-identity-path').innerText();
    await check('explicit offline onboarding stays device-only through the wizard',
      /Use this device profile only/i.test(identityPath)
      && await page.getByTestId('onboarding-identity-path').getByRole('button').count() === 0);

    await page.setViewportSize(DESKTOP);
    await snap(page, '04-desktop-protect');
    await next(page);
    await page.waitForSelector('[data-onboarding-step="5"]');
    const summary = await page.locator('.auth-card').innerText();
    await check('ready state carries the real chosen identity',
      /Student/.test(summary) && /Class 10/.test(summary) && /English/.test(summary));
    // Onboarding still creates no score: the placement check is offered
    // afterwards, optional, and labelled as diagnostic evidence, not mastery.
    const placementOn = await page.evaluate(() => window.__PRI_BUILD_FEATURES__?.placement === true);
    await check('ready state does not invent a diagnostic score',
      placementOn
        ? /optional placement check/i.test(summary) && /diagnostic evidence, not mastery/i.test(summary)
        : /does not currently have a separate placement diagnostic/i.test(summary));
    await snap(page, '05-ready-student');

    const finalButton = page.locator('.auth-card .btn-primary');
    await Promise.allSettled([finalButton.click({ force: true }), finalButton.click({ force: true })]);
    await page.waitForSelector('.home-greet', { timeout: 30000 });
    await check('real profile creation lands on student Home',
      (await page.locator('.home-greet').innerText()).includes('KALP03'));
    await check('Class 10 drives the real Home curriculum',
      /Class 10/.test(await page.locator('.genbar-chips').innerText()));

    const studentLabels = await page.locator('.sidebar .nav-label').allTextContents();
    await check('student receives KALP-02 student navigation',
      ['Home', 'Practice', 'Tasks', 'Exams', 'Progress', 'Review'].every(x => studentLabels.includes(x)));
    await check('student navigation does not expose Teacher workspace', !studentLabels.includes('Teacher workspace'));
    await deviceOnlyProfileIsNotMarked(page, check, online);
    // Sign this profile in through the app (Settings → Pri account).
    await online.signIn({ name: 'KALP03 Class 10 Student' });
    await reachRealFeedback(page, check, online);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.shell');
    // Practice is a thinking-mode route with no account furniture; its one way
    // out is the workspace bar's Home control.
    await page.locator('.ws-exit').click();
    await page.waitForSelector('.home-greet');
    await check('reload restores the actual created profile',
      (await page.locator('.user-chip').innerText()).includes('KALP03'));
    await check('English remains profile-specific after reload',
      await page.evaluate(() => document.documentElement.lang) === 'en');

    await switchProfile(page);
    await check('double submit created exactly one student row',
      await page.locator('.acct-row', { hasText: 'KALP03 Class 10 Student' }).count() === 1);

    await beginAdditional(page, 'student');
    await page.waitForSelector('[data-onboarding-step="2"]');
    await page.locator('#signup-track').selectOption('jee-main');
    await check('JEE Main only offers legitimate Class 11/12 years',
      JSON.stringify(await page.locator('#signup-year option').allTextContents()).includes('Class 11')
      && (await page.locator('#signup-year option').count()) === 2);
    await page.locator('#signup-year').selectOption('11');
    await next(page);
    await personalise(page, 'KALP03 Protected JEE');
    await page.waitForSelector('[data-onboarding-step="4"]');
    await page.locator('.check-row input[type=checkbox]').check();
    await page.getByLabel('Password', { exact: true }).fill('short');
    await page.getByLabel('Repeat password').fill('short');
    await next(page);
    await check('weak password stays on protection stage',
      await page.locator('[data-onboarding-step="4"]').count() === 1 && await page.locator('[role="alert"]').count() === 1);

    await page.getByLabel('Password', { exact: true }).fill('brass-monkey-42');
    await page.getByLabel('Repeat password').fill('different-strong-42');
    await next(page);
    await check('password mismatch stays on protection stage',
      await page.locator('[data-onboarding-step="4"]').count() === 1);

    await page.getByLabel('Repeat password').fill('brass-monkey-42');
    await next(page);
    await check('valid protected profile reaches ready state',
      await page.locator('[data-onboarding-step="5"]').count() === 1);
    await page.getByRole('button', { name: 'Start learning' }).click();
    await page.waitForSelector('.home-greet, .error-box', { timeout: 30000 });
    const protectedCreateError = await page.locator('.error-box').count() ? await page.locator('.error-box').innerText() : '';
    await check('protected profile is persisted by the real profile authority', await page.locator('.home-greet').count() === 1, protectedCreateError);
    if (protectedCreateError) return;
    await switchProfile(page);

    const protectedRow = page.locator('.acct-row', { hasText: 'KALP03 Protected JEE' });
    await check('protected profile is marked locked', await protectedRow.locator('.acct-lock').count() === 1);
    await protectedRow.click();
    await page.locator('.acct-unlock input').fill('wrong-password');
    await page.getByRole('button', { name: 'Unlock' }).click();
    await page.waitForSelector('.error-box');
    await check('wrong password is genuinely rejected', /wrong password/i.test(await page.locator('.error-box').innerText()));
    await check('wrong password leaves profile picker visible', await page.locator('.acct-list').count() === 1);
    await page.locator('.acct-unlock input').fill('brass-monkey-42');
    await page.getByRole('button', { name: 'Unlock' }).click();
    await page.waitForSelector('.home-greet');
    await page.locator('.user-chip').click();
    await page.waitForSelector('.acct-menu-head');
    await check('correct password genuinely unlocks the vault',
      (await page.locator('.acct-menu-head .acct-name').innerText()).trim() === 'KALP03 Protected JEE');
    await page.locator('.user-chip').click();

    await switchProfile(page);
    await page.getByRole('button', { name: /Add another profile/i }).click();
    await page.waitForSelector('[data-onboarding-step="1"]');
    await page.getByRole('button', { name: 'Teacher', exact: true }).click();
    await check('teacher onboarding explains local UX role without privileged cloud authority',
      /local UX role/i.test(await page.locator('.auth-card').innerText())
      && /does not grant/i.test(await page.locator('.auth-card').innerText()));
    await next(page);
    await chooseIndia(page, '10');
    await personalise(page, 'KALP03 Teacher', { avatarIndex: 2 });
    await finishLocal(page);
    await page.getByRole('button', { name: 'Open Teacher Workspace' }).click();
    await page.waitForURL(/\/teach(?:#.*)?$/, { timeout: 30000 });
    await page.waitForSelector('.teacher-workspace-head');
    await check('teacher profile lands directly in Teacher Workspace', new URL(page.url()).pathname === '/teach');
    const teacherLabels = await page.locator('.sidebar .nav-label').allTextContents();
    await check('teacher gets teacher-specific navigation',
      ['Teacher workspace', 'Classes', 'Assignments', 'Analytics & reports', 'Question tools'].every(x => teacherLabels.includes(x)));
    await check('teacher primary navigation excludes student Practice and Exams',
      !teacherLabels.includes('Practice') && !teacherLabels.includes('Exams'));
    await check('teacher workspace exposes legitimate class and assignment sections',
      await page.locator('#teacher-classes').count() === 1 && await page.locator('#teacher-assignments').count() === 1);

    await switchProfile(page);
    await page.getByRole('button', { name: 'Sign in to your Pri cloud account' }).click();
    await beginAdditional(page, 'student');
    await chooseIndia(page, '9');
    await personalise(page, 'KALP03 Cloud Handoff');
    await page.waitForSelector('[data-onboarding-step="4"]');
    const cloudIdentityPath = await page.getByTestId('onboarding-identity-path').innerText();
    await check('cloud handoff intent is fixed before local profile creation',
      /Connect a Pri cloud account next/i.test(cloudIdentityPath)
      && await page.getByTestId('onboarding-identity-path').getByRole('button').count() === 0);
    await check('cloud path still says local profile comes first',
      /Create this real local profile first/i.test(await page.locator('.auth-card').innerText()));
    await next(page);
    await page.waitForSelector('[data-onboarding-step="5"]');
    await page.getByRole('button', { name: /Create profile & open Account/ }).click();
    await page.waitForSelector('#cloud-account-title', { timeout: 30000 });
    await check('cloud intent reaches the real Pri account panel',
      /Your Pri account/i.test(await page.locator('#cloud-account-title').innerText()));
    await check('new local profile is not falsely shown as cloud-connected',
      /Not signed in|no Pri cloud origin configured/i.test(
        await page.locator('section[aria-labelledby="cloud-account-title"]').innerText()));

    await switchProfile(page);
    await beginAdditional(page, 'student');
    await chooseIndia(page, '8');
    await page.waitForSelector('[data-onboarding-step="3"]');
    await page.locator('#signup-name').fill('हिंदी विद्यार्थी');
    await page.locator('.auth-card button[lang="hi"]').click();
    await page.waitForFunction(() => document.documentElement.lang === 'hi', null, { timeout: 10000 });
    await check('Hindi can be selected before profile creation',
      await page.evaluate(() => document.documentElement.lang) === 'hi');
    await page.locator('.auth-card .btn-primary').click();
    await page.waitForSelector('[data-onboarding-step="4"]');
    await check('the remaining onboarding controls switch to Hindi',
      /वैकल्पिक|पासवर्ड|प्रोफ़ाइल/.test(await page.locator('.auth-card').innerText()));
    await page.locator('.auth-card .btn-primary').click();
    await page.waitForSelector('[data-onboarding-step="5"]');
    await page.locator('.auth-card .btn-primary').click();
    await page.waitForSelector('.home-greet', { timeout: 30000 });
    await check('Hindi-selected profile reaches the real app in Hindi',
      await page.evaluate(() => document.documentElement.lang) === 'hi');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.shell');
    await page.waitForFunction(() => document.documentElement.lang === 'hi', null, { timeout: 10000 });
    await page.locator('.user-chip').click();
    await page.waitForSelector('.acct-menu-head');
    await check('Hindi persists for the returning profile after reload',
      await page.evaluate(() => document.documentElement.lang) === 'hi'
      && (await page.locator('.acct-menu-head .acct-name').innerText()).trim() === 'हिंदी विद्यार्थी');
    await page.locator('.user-chip').click();

    await page.setViewportSize(IPAD_PORTRAIT);
    await check('final iPad portrait app has no horizontal clipping',
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
    await settle();
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
