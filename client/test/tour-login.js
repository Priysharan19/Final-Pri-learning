// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · E2E flow — the profile gate.
//
// There is no sign-in service behind this screen, which is exactly why it has
// to be driven: the whole gate is client code. A profile is created here, the
// picker lists it here, and the only thing standing between a sibling and six
// months of somebody else's work is a password check that runs in this tab.
//
// So this flow asserts the gate, not the pixels: a profile that is made appears
// in the picker; an unprotected one opens on a tap; a protected one refuses the
// wrong password, says so, stays shut, and opens on the right one. The weak-
// password rule is asserted through the button it disables rather than through
// the copy beside it, because the copy is not what protects anybody.
//
// Run on its own:  node client/test/tour-login.js
// ─────────────────────────────────────────────────────────────────────────────
import { pathToFileURL } from 'node:url';

const STUDENT = { name: 'Ada Lovelace', email: 'ada@example.com', year: 9 };
const LOCKED = { name: 'Grace Hopper', year: 11, password: 'brass-monkey-42' };
const WRONG = 'not-the-password';

/** The account menu is the only way out of a signed-in session. */
async function switchProfile(page) {
  await page.locator('.user-chip').click();
  await page.getByRole('menuitem', { name: 'Switch profile' }).click();
  await page.waitForSelector('.acct-list', { timeout: 15000 });
}

export const flow = {
  id: 'login',
  name: 'Login · profiles, the picker, passwords',

  async run({ page, check, goto, createProfile, mathText }) {
    // ── 1 · the landing screen ───────────────────────────────────────────────
    await goto('/');
    await check('the landing hero renders',
      await page.locator('.hero-title').isVisible(),
      'no .hero-title on a first visit with no profiles');
    await check('the hero offers the only way in',
      await page.getByRole('button', { name: 'Get Started' }).isVisible());

    // ── 2 · the method stage is honest about what it is ──────────────────────
    await page.getByRole('button', { name: 'Get Started' }).click();
    await page.waitForSelector('.sso-btn', { timeout: 15000 });
    const methods = await page.locator('.sso-btn').allInnerTexts();
    await check('both on-device paths are offered',
      methods.some(t => /Continue with email/.test(t)) && methods.some(t => /Continue without an email/.test(t)),
      `sign-in buttons read ${JSON.stringify(methods)}`);
    const disclosure = await page.locator('.auth-note').innerText();
    await check('the screen says a profile lives on this device only',
      /this (iPad|device)/i.test(disclosure) && /never (sent|uploaded|leaves)/i.test(disclosure),
      `disclosure reads ${JSON.stringify(disclosure.slice(0, 120))}`);

    // ── 3 · a profile is created and signs straight in ───────────────────────
    await goto('/');
    await createProfile(STUDENT);
    const greet = await page.locator('.home-greet').innerText();
    await check('creating a profile lands on Home as that student',
      greet.includes('Ada'), `Home greeting reads ${JSON.stringify(greet)}`);
    await check('the account chip carries the new profile',
      (await page.locator('.user-chip').innerText()).includes('Ada'));

    // ── 4 · it is in the picker, and it is not locked ────────────────────────
    await switchProfile(page);
    const ada = page.locator('.acct-row', { hasText: STUDENT.name });
    await check('the new profile appears in the picker', await ada.count() === 1,
      `${await page.locator('.acct-row').count()} rows in the picker`);
    await check('the picker shows which year the profile is in',
      /Year 9/.test(await ada.innerText()), `row reads ${JSON.stringify(await ada.innerText())}`);
    await check('an unprotected profile carries no lock',
      await ada.locator('.acct-lock').count() === 0);

    // ── 5 · a weak password cannot be set ────────────────────────────────────
    await page.getByRole('button', { name: 'Add another profile' }).click();
    await page.waitForSelector('.sso-btn', { timeout: 15000 });
    await page.getByRole('button', { name: 'Continue without an email' }).click();
    await page.waitForSelector('.auth-card input.input', { timeout: 15000 });
    await page.getByPlaceholder('e.g. Priysharan').fill(LOCKED.name);
    await page.locator('.auth-card select').first().selectOption(String(LOCKED.year));
    await page.locator('.check-row input[type=checkbox]').check();
    const start = page.getByRole('button', { name: 'Start learning' });

    await page.getByLabel('Password', { exact: true }).fill('short');
    await page.getByLabel('Repeat password').fill('short');
    await check('a too-short password cannot be submitted', await start.isDisabled(),
      'Start learning was live with a 5-character password');

    await page.getByLabel('Password', { exact: true }).fill('password123');
    await page.getByLabel('Repeat password').fill('password123');
    await check('a guessable password cannot be submitted', await start.isDisabled(),
      'Start learning was live with "password123"');
    await check('the meter says why', /guess/i.test(await mathText('.auth-card .meter + p') || ''),
      `meter note reads ${JSON.stringify(await mathText('.auth-card .meter + p'))}`);

    // ── 6 · a protected profile is created ───────────────────────────────────
    await page.getByLabel('Password', { exact: true }).fill(LOCKED.password);
    await page.getByLabel('Repeat password').fill(LOCKED.password);
    await check('a strong password unlocks the submit', await start.isEnabled(),
      'Start learning stayed disabled with a strong password');
    await start.click();
    await page.waitForSelector('.home-greet', { timeout: 30000 });
    await check('the protected profile signs in on creation',
      (await page.locator('.home-greet').innerText()).includes('Grace'));

    // ── 7 · the picker marks it shut ─────────────────────────────────────────
    await switchProfile(page);
    const grace = page.locator('.acct-row', { hasText: LOCKED.name });
    await check('both profiles are listed', await page.locator('.acct-row').count() === 2,
      `${await page.locator('.acct-row').count()} rows, expected 2`);
    await check('the protected profile shows a lock', await grace.locator('.acct-lock').count() === 1);

    // ── 8 · the wrong password is refused ────────────────────────────────────
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

    // ── 9 · the right password opens it ──────────────────────────────────────
    await page.locator('.acct-unlock input').fill(LOCKED.password);
    await page.getByRole('button', { name: 'Unlock' }).click();
    await page.waitForSelector('.home-greet', { timeout: 30000 });
    await check('the right password opens the profile',
      (await page.locator('.home-greet').innerText()).includes('Grace'),
      `Home greeting reads ${JSON.stringify(await page.locator('.home-greet').innerText())}`);

    // ── 10 · the unprotected one still opens on a tap ────────────────────────
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
