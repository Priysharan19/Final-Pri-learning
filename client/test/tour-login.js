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
      await page.getByRole('button', { name: 'Get Started' }).isVisible());
    await check('the launch hero makes no Olympiad claim', !/Olympiad/i.test(await page.locator('.auth-col').innerText()));

    await goto('/privacy');
    await page.waitForSelector('.legal-body', { timeout: 15000 });
    const privacyCopy = await page.locator('.legal-body').innerText();
    await check('signed-out privacy copy distinguishes local core from server-dependent capability',
      /core maths-practice loop local/i.test(privacyCopy) && /account or server connection/i.test(privacyCopy));
    await check('signed-out privacy copy has no public teacher-work or whole-app-offline claim',
      !/teacher can set work|your teacher|whole app without an account and without a network/i.test(privacyCopy));
    await check('signed-out privacy copy states server-authoritative paid access',
      /Paid access is granted only from subscription state verified by our server/i.test(privacyCopy));
    await goto('/');

    await page.getByRole('button', { name: 'Get Started' }).click();
    await page.waitForSelector('[data-onboarding-step="1"]', { timeout: 15000 });
    await check('first-run exposes Student as the only public V1 role',
      await page.getByRole('button', { name: 'Student', exact: true }).count() === 1
      && await page.getByRole('button', { name: 'Teacher', exact: true }).count() === 0);
    await check('Student is the fixed selected public role',
      await page.getByRole('button', { name: 'Student', exact: true }).getAttribute('aria-pressed') === 'true');
    await advance(page);
    await page.waitForSelector('[data-onboarding-step="2"]');
    const publicTracks = await page.locator('#signup-track option').allInnerTexts();
    await check('public onboarding exposes exactly Classes 7–12 plus JEE Main/Advanced',
      ['Class 7','Class 8','Class 9','Class 10','Class 11','Class 12','JEE Main','JEE Advanced'].every(x => publicTracks.includes(x))
      && !publicTracks.some(x => /Olympiad|HSC|VCE|QCE|WACE|SACE|IB/.test(x)));
    // The browser build runs with PRI_FEATURE_AUSTRALIA=1 (a production build
    // has it off: browser-run-fixes-check). Behind that flag the only door is a
    // folded student link; no course selector is shown until it is opened and
    // there is no teacher variant of it.
    await check('the Australian syllabuses sit behind one folded student-only link, no course selector in the public step',
      await page.getByRole('button', { name: /Studying in Australia/ }).count() === 1
      && await page.getByRole('button', { name: /Teaching in Australia/ }).count() === 0
      && await page.locator('#signup-course').count() === 0);
    await goto('/');
    await createProfile(STUDENT);
    const greet = await page.locator('.home-greet').innerText();
    await check('creating a profile lands on Home as that student',
      greet.includes('Ada'), `Home greeting reads ${JSON.stringify(greet)}`);
    await check('the account chip carries the new profile',
      (await page.locator('.user-chip').innerText()).includes('Ada'));

    await goto('/settings');
    await page.waitForSelector('.settings-grid', { timeout: 30000 });
    const settingsText = await page.locator('.settings-grid').innerText();
    await check('shipping plan copy matches Free and Premium boundaries',
      /20 practice questions per day/i.test(settingsText)
      && /1 exam simulation every 30 days/i.test(settingsText)
      && /JEE Advanced/i.test(settingsText)
      && /advanced Pri Explain/i.test(settingsText));
    await check('shipping plan copy keeps completed local work available', /completed local work, history and progress stay/i.test(settingsText));
    await check('shipping Settings do not advertise the old all-inclusive plan',
      !/everything else unlimited|all courses|all pathways|all features/i.test(settingsText));
    await page.getByRole('button', { name: /Edit/i }).first().click();
    await check('Settings cannot switch a public profile into an Australian curriculum', await page.locator('#set-course').count() === 0);
    await check('Settings cannot switch a public profile into Olympiad', !/Olympiad/.test(await page.locator('.settings-grid').innerText()));
    await page.getByRole('button', { name: 'Cancel', exact: true }).first().click();

    await switchProfile(page);
    const ada = page.locator('.acct-row', { hasText: STUDENT.name });
    await check('the new profile appears in the picker', await ada.count() === 1,
      `${await page.locator('.acct-row').count()} rows in the picker`);
    await check('the picker shows which year the profile is in',
      /Class 9/.test(await ada.innerText()), `row reads ${JSON.stringify(await ada.innerText())}`);
    await check('an unprotected profile carries no lock',
      await ada.locator('.acct-lock').count() === 0);

    await page.getByRole('button', { name: /Add another profile/i }).click();
    await page.waitForSelector('[data-onboarding-step="1"]');
    await page.getByRole('button', { name: 'Student', exact: true }).click();
    await advance(page);
    await page.locator('#signup-track').selectOption('jee-main');
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
