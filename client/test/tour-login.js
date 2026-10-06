// Pri Learning · profile gate acceptance through the real KALP-03 onboarding.
import { pathToFileURL } from 'node:url';

const STUDENT = { name: 'Ada Lovelace', email: 'ada@example.com', year: 9 };
const LOCKED = { name: 'Grace Hopper', year: 11, password: 'brass-monkey-42' };
const WRONG = 'not-the-password';

async function switchProfile(page) {
  await page.locator('.user-chip').click();
  await page.getByRole('menuitem', { name: 'Switch profile' }).click();
  await page.waitForSelector('.acct-list', { timeout: 15000 });
}

async function advance(page) {
  await page.locator('.auth-card .btn-primary').click();
}

export const flow = {
  id: 'login',
  name: 'Login · profiles, the picker, passwords',

  async run({ page, check, goto, createProfile, mathText }) {
    await goto('/');
    await check('the landing hero renders',
      await page.locator('.hero-title').isVisible(),
      'no .hero-title on a first visit with no profiles');
    await check('the hero offers the way into onboarding',
      await page.getByRole('button', { name: 'Use without an account' }).isVisible());

    await page.getByRole('button', { name: 'Use without an account' }).click();
    await page.waitForSelector('[data-onboarding-step="1"]', { timeout: 15000 });
    await check('first-run starts by asking for the real product role',
      await page.getByRole('button', { name: 'Student', exact: true }).count() === 1
      && await page.getByRole('button', { name: 'Teacher', exact: true }).count() === 1);
    await page.getByRole('button', { name: 'Teacher', exact: true }).click();
    await check('teacher role is described as local UX rather than cloud privilege',
      /local UX role/i.test(await page.locator('.auth-card').innerText())
      && /does not grant/i.test(await page.locator('.auth-card').innerText()));

    await goto('/');
    await createProfile(STUDENT);
    const greet = await page.locator('.home-greet').innerText();
    await check('creating a profile lands on Home as that student',
      greet.includes('Ada'), `Home greeting reads ${JSON.stringify(greet)}`);
    await check('the account chip carries the new profile',
      (await page.locator('.user-chip').innerText()).includes('Ada'));

    await switchProfile(page);
    const ada = page.locator('.acct-row', { hasText: STUDENT.name });
    await check('the new profile appears in the picker', await ada.count() === 1,
      `${await page.locator('.acct-row').count()} rows in the picker`);
    await check('the picker shows which year the profile is in',
      /Year 9/.test(await ada.innerText()), `row reads ${JSON.stringify(await ada.innerText())}`);
    await check('an unprotected profile carries no lock',
      await ada.locator('.acct-lock').count() === 0);

    await page.getByRole('button', { name: /Add another profile/i }).click();
    await page.waitForSelector('[data-onboarding-step="1"]');
    await page.getByRole('button', { name: 'Student', exact: true }).click();
    await advance(page);
    await page.getByRole('button', { name: /Studying in Australia/ }).click();
    await page.locator('#signup-course').selectOption('nsw');
    await page.locator('#signup-year').selectOption(String(LOCKED.year));
    await advance(page);
    await page.locator('#signup-name').fill(LOCKED.name);
    await advance(page);
    await page.locator('.check-row input[type=checkbox]').check();

    await page.getByLabel('Password', { exact: true }).fill('short');
    await page.getByLabel('Repeat password').fill('short');
    await advance(page);
    await check('a too-short password cannot leave the protection step',
      await page.locator('[data-onboarding-step="4"]').count() === 1
      && await page.locator('[role="alert"]').count() === 1);

    await page.getByLabel('Password', { exact: true }).fill('password123');
    await page.getByLabel('Repeat password').fill('password123');
    await advance(page);
    await check('a guessable password cannot leave the protection step',
      await page.locator('[data-onboarding-step="4"]').count() === 1);
    await check('the meter says why', /guess/i.test(await mathText('.auth-card .meter + p') || ''),
      `meter note reads ${JSON.stringify(await mathText('.auth-card .meter + p'))}`);

    await page.getByLabel('Password', { exact: true }).fill(LOCKED.password);
    await page.getByLabel('Repeat password').fill(LOCKED.password);
    await advance(page);
    await check('a strong password reaches the ready state',
      await page.locator('[data-onboarding-step="5"]').count() === 1);
    await page.getByRole('button', { name: 'Start learning' }).click();
    await page.waitForSelector('.home-greet', { timeout: 30000 });
    await check('the protected profile signs in on creation',
      (await page.locator('.home-greet').innerText()).includes('Grace'));

    await switchProfile(page);
    const grace = page.locator('.acct-row', { hasText: LOCKED.name });
    await check('both profiles are listed', await page.locator('.acct-row').count() === 2,
      `${await page.locator('.acct-row').count()} rows, expected 2`);
    await check('the protected profile shows a lock', await grace.locator('.acct-lock').count() === 1);

    await grace.click();
    await page.waitForSelector('.acct-unlock input', { timeout: 15000 });
    await page.locator('.acct-unlock input').fill(WRONG);
    await page.getByRole('button', { name: 'Unlock' }).click();
    await page.waitForSelector('.error-box', { timeout: 15000 });
    const refusal = await page.locator('.error-box').innerText();
    await check('a wrong password is refused', /wrong password/i.test(refusal),
      `refusal reads ${JSON.stringify(refusal)}`);
    await check('a wrong password leaves the profile shut',
      await page.locator('.acct-list').count() === 1 && await page.locator('.home-greet').count() === 0,
      'the app left the picker after a wrong password');

    await page.locator('.acct-unlock input').fill(LOCKED.password);
    await page.getByRole('button', { name: 'Unlock' }).click();
    await page.waitForSelector('.home-greet', { timeout: 30000 });
    await check('the right password opens the profile',
      (await page.locator('.home-greet').innerText()).includes('Grace'));

    await switchProfile(page);
    await page.locator('.acct-row', { hasText: STUDENT.name }).click();
    await page.waitForSelector('.home-greet', { timeout: 30000 });
    await check('an unprotected profile opens without a password',
      (await page.locator('.home-greet').innerText()).includes('Ada'));
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
