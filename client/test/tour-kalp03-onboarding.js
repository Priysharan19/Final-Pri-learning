// KALP-03 · real-browser account-first onboarding and profile acceptance.
//
// A real in-process platform verifies each six-digit OTP, owns the age and
// guardian authority, binds a distinct profile, and performs initial sync.
// Email delivery alone uses the deterministic test adapter. Practice must
// reach Pri's genuine server marking receipt without a second sign-in.
// Obsolete anonymous device-profile onboarding must not re-enter this suite.
import { mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { serverMarking } from './support/server-marked.mjs';
import { onlinePlatform } from './support/online-session.mjs';

const ARTIFACTS = fileURLToPath(new URL('../../artifacts/kalp-03/', import.meta.url));
const PHONE = { width: 390, height: 844 };
const IPAD_PORTRAIT = { width: 1024, height: 1366 };
const IPAD_LANDSCAPE = { width: 1366, height: 1024 };
const DESKTOP = { width: 1440, height: 900 };

async function snap(page, name) {
  await mkdir(ARTIFACTS, { recursive: true });
  await page.screenshot({ path: join(ARTIFACTS, name + '.png'), fullPage: true });
}

async function switchProfile(page) {
  await page.locator('.user-chip').click();
  await page.getByRole('menuitem', { name: 'Switch profile' }).click();
  await page.waitForSelector('.acct-list', { timeout: 15000 });
}

async function openPractice(page) {
  await page.goto(new URL('/practice', page.url()).href, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.q-prompt', { timeout: 30000 });
  const type = page.getByRole('button', { name: /Answer by typing/i }).first();
  if (await type.count()) await type.click();
  await page.waitForTimeout(150);
  return (await page.locator('.q-prompt').innerText()).trim();
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

  async run({ page, check, goto, createProfile, settle, online }) {
    await page.setViewportSize(IPAD_PORTRAIT);
    await goto('/');
    await check('cold launch shows the first-run hero', await page.locator('.hero-title').isVisible());
    await check('first-run begins with an account, never anonymous local entry',
      await page.getByTestId('hero-create-account').isVisible()
      && await page.getByRole('button', { name: 'Use without an account' }).count() === 0);

    // Real Pri server, real OTP challenge and consent records; only email
    // delivery is the deterministic test adapter. The shared helper drives
    // the public six-digit OTP UI and waits for the first cloud sync.
    const platform = await onlinePlatform();
    const adult = await createProfile({
      name: 'KALP03 Class 10 Student', year: 10, course: 'in'
    });
    const account = platform.h.db.prepare(
      'SELECT id, email, age_basis, email_verified_at FROM accounts WHERE id=?'
    ).get(adult.accountId);
    await check('signup creates exactly one verified email identity',
      !!account?.email_verified_at && account.email === adult.email
      && platform.h.db.prepare('SELECT COUNT(*) AS n FROM accounts WHERE email=?')
        .get(adult.email).n === 1);
    await check('adult is classified by the server and needs no guardian consent',
      account?.age_basis === 'adult'
      && platform.h.db.prepare('SELECT COUNT(*) AS n FROM guardian_consents WHERE account_id=?')
        .get(adult.accountId).n === 0);
    await check('verified first-sync opens the real student Home',
      await page.locator('.home-greet').isVisible()
      && await page.getByTestId('account-activation-gate').count() === 0
      && /KALP03/.test(await page.locator('.home-greet').innerText()));
    await check('Class 10 drives the real curriculum, not a local-only profile',
      /Class 10/.test(await page.locator('.genbar-chips').innerText()));
    const studentLabels = await page.locator('.sidebar .nav-label').allTextContents();
    await check('student receives the real student navigation',
      ['Home', 'Practice', 'Tasks', 'Exams', 'Progress', 'Review'].every(x => studentLabels.includes(x)));
    await check('student cannot self-enter teacher workspace',
      !studentLabels.includes('Teacher workspace'));
    await check('account-first onboarding never creates a local device-only consent bypass',
      await page.locator('[data-onboarding-step], [data-check-sign-in]').count() === 0);

    await page.setViewportSize(PHONE);
    await check('phone Home has no horizontal clipping',
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
    await snap(page, '01-verified-adult-phone');
    await page.setViewportSize(IPAD_PORTRAIT);
    await check('iPad portrait Home has no horizontal clipping',
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
    await snap(page, '02-verified-adult-ipad');
    await page.setViewportSize(IPAD_LANDSCAPE);
    await check('iPad landscape Home has no horizontal clipping',
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
    await snap(page, '03-verified-adult-landscape');
    await page.setViewportSize(DESKTOP);
    await check('desktop Home has no horizontal clipping',
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));

    const session = await online.signIn({ name: 'KALP03 Class 10 Student' });
    await check('Practice reuses first-login identity rather than asking for Settings sign-in',
      String(session.id) === String(adult.accountId));
    await reachRealFeedback(page, check, online);
    await goto('/');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('.home-greet').waitFor({ timeout: 30000 });
    await check('returning student reopens the same verified profile without OTP',
      /KALP03/.test(await page.locator('.home-greet').innerText())
      && await page.locator('[data-signup-step="code"]').count() === 0
      && await page.getByTestId('account-activation-gate').count() === 0);

    await switchProfile(page);
    await check('signup did not create a duplicate local profile',
      await page.locator('.acct-row', { hasText: 'KALP03 Class 10 Student' }).count() === 1);
    await page.locator('.acct-row', { hasText: 'KALP03 Class 10 Student' }).click();
    await page.locator('.home-greet').waitFor({ timeout: 30000 });
    await check('reselecting verified profile requires no second authentication',
      await page.getByTestId('account-activation-gate').count() === 0);

    // Second student genuinely signs up with their own independently verified
    // email. Reusing the first account, even by accident, must not pass.
    await switchProfile(page);
    const jee = await createProfile({
      name: 'KALP03 JEE Student', year: 11, course: 'in', track: 'jee-main', fromPicker: true
    });
    await check('second verified student has a distinct backend account',
      !!jee.accountId && String(jee.accountId) !== String(adult.accountId));
    await page.waitForFunction(() => /Class 11/.test(document.querySelector('#home-next-title')?.textContent || ''),
      null, { timeout: 15000 });
    await check('second student is actually Class 11, not the original Class 10',
      /Class 11/.test(await page.locator('#home-next-title').innerText())
      && (await page.locator('.home-greet').innerText()).includes('KALP03'));
    await check('second signup cannot silently inherit the first student name',
      !(await page.locator('.user-chip').innerText()).includes('Class 10 Student'));
    await check('both student accounts remain unique in backend authority',
      platform.h.db.prepare('SELECT COUNT(*) AS n FROM accounts WHERE email IN (?,?)')
        .get(adult.email, jee.email).n === 2);

    let teacherDenied = false;
    try {
      await createProfile({ name: 'KALP03 Teacher', year: 10, role: 'teacher' });
    } catch (error) {
      teacherDenied = /separately authorised teacher-role fixture/.test(String(error));
    }
    await check('a public student OTP signup cannot mint teacher authority',
      teacherDenied && await page.locator('.teacher-workspace-head').count() === 0);
    await check('second verified student retains the main app without a new OTP',
      await page.locator('.home-greet').isVisible()
      && await page.locator('[data-signup-step="code"]').count() === 0);
    await settle();
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
