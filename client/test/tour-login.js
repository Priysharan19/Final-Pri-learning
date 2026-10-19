// Pri Learning · the way in: the sign-in card, the gate, saved profiles and
// device passwords — through the real platform server.
//
// The landing screen is one sign-in card (issue #477): email, the code the
// server sent, name and age, class. Nothing opens until the server has
// confirmed the account; a profile saved on this device is listed in the
// picker and passes the same gate. A device profile may still carry a
// password of its own (the picker's wizard): that is a lock on the device,
// never a substitute for the account, so a protected profile meets the gate too.
import { pathToFileURL } from 'node:url';
import { onlinePlatform } from './support/online-session.mjs';
import { freshEmail, signInOnCard } from './support/verified-onboarding.mjs';

const STUDENT = { name: 'Ada Lovelace', email: 'ada.lovelace@example.test', year: 9, course: 'in' };
const LOCKED = { name: 'Grace Hopper', year: 11, password: 'brass-monkey-42' };
const WRONG = 'not-the-password';
const GATE = '[data-testid="account-activation-gate"]';

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
  name: 'Login · the card, the gate, saved profiles, passwords',

  async run({ page, base, check, goto, createProfile, mathText }) {
    const platform = await onlinePlatform();
    await goto('/');
    await check('the landing hero renders', await page.locator('.hero-title').isVisible(), 'no .hero-title on a first visit with no profiles');
    await check('the landing screen is the sign-in card, asking for an email first',
      await page.locator('[data-signin-card="page"] #signup-destination[type="email"]').isVisible());
    await check('there is no device-only entry and no demo', await page.getByRole('button', { name: 'Use without an account' }).count() === 0 &&
      await page.locator('[data-testid="hero-offline"], [data-testid="hero-try-demo"]').count() === 0);

    const account = await createProfile(STUDENT);
    const greet = await page.locator('.home-greet').innerText();
    await check('a verified account lands on Home as that student', greet.includes('Ada'), `Home greeting reads ${JSON.stringify(greet)}`);
    await check('the account chip carries the new profile', (await page.locator('.user-chip').innerText()).includes('Ada'));
    await check('the server bound the verified email to this account',
      platform.h.db.prepare('SELECT email FROM accounts WHERE id=?').get(account.accountId)?.email === account.email);
    await check('an adult: no guardian row, age on record as adult',
      platform.h.db.prepare('SELECT age_basis FROM accounts WHERE id=?').get(account.accountId)?.age_basis === 'adult' &&
        platform.h.db.prepare('SELECT COUNT(*) AS n FROM guardian_consents WHERE account_id=?').get(account.accountId).n === 0);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('.home-greet').waitFor({ timeout: 30000 });
    await check('a reload keeps the student inside: no card, no gate, no second code',
      await page.locator(`${GATE}, [data-signin-card]`).count() === 0);

    await switchProfile(page);
    const ada = page.locator('.acct-row', { hasText: STUDENT.name });
    await check('the new profile appears in the picker', await ada.count() === 1, `${await page.locator('.acct-row').count()} rows in the picker`);
    await check('the picker shows which class the profile is in', /Class 9/.test(await ada.innerText()), `row reads ${JSON.stringify(await ada.innerText())}`);
    await check('an unprotected profile carries no lock', await ada.locator('.acct-lock').count() === 0);
    await check('the picker offers another Pri account through the same card', await page.getByTestId('picker-create-account').isVisible());

    // ── a device profile with a password of its own ──────────────────────────
    await page.getByRole('button', { name: /Add another profile/i }).click();
    await page.waitForSelector('[data-onboarding-step="1"]');
    await page.getByRole('button', { name: 'Student', exact: true }).click();
    await advance(page);
    await page.locator('#signup-track').selectOption(String(LOCKED.year));
    await advance(page);
    await page.locator('#signup-name').fill(LOCKED.name);
    await advance(page);
    await page.locator('.check-row input[type=checkbox]').check();

    await page.getByLabel('Password', { exact: true }).fill('short');
    await page.getByLabel('Repeat password').fill('short');
    await advance(page);
    await check('a too-short password cannot leave the protection step',
      await page.locator('[data-onboarding-step="4"]').count() === 1 && await page.locator('[role="alert"]').count() === 1);

    await page.getByLabel('Password', { exact: true }).fill('password123');
    await page.getByLabel('Repeat password').fill('password123');
    await advance(page);
    await check('a guessable password cannot leave the protection step', await page.locator('[data-onboarding-step="4"]').count() === 1);
    await check('the meter says why', /guess/i.test(await mathText('.auth-card .meter + p') || ''),
      `meter note reads ${JSON.stringify(await mathText('.auth-card .meter + p'))}`);

    await page.getByLabel('Password', { exact: true }).fill(LOCKED.password);
    await page.getByLabel('Repeat password').fill(LOCKED.password);
    await advance(page);
    await check('a strong password reaches the ready state', await page.locator('[data-onboarding-step="5"]').count() === 1);
    await page.getByRole('button', { name: 'Start learning' }).click();
    await page.locator(GATE).waitFor({ timeout: 30000 });
    await check('a device profile — password or not — is not an account: the gate asks for one before anything opens',
      await page.locator('.shell, .home-greet').count() === 0 && await page.locator(GATE).getAttribute('data-activation-status') === 'signin');
    const graceEmail = freshEmail('grace');
    await signInOnCard(page.locator(`${GATE} [data-signin-card="inline"]`), platform, { email: graceEmail, age: 18 });
    await page.locator('.home-greet').waitFor({ timeout: 60000 });
    await check('the protected profile opens once its own account is confirmed', (await page.locator('.home-greet').innerText()).includes('Grace'));

    await switchProfile(page);
    const grace = page.locator('.acct-row', { hasText: LOCKED.name });
    await check('both profiles are listed', await page.locator('.acct-row').count() === 2, `${await page.locator('.acct-row').count()} rows, expected 2`);
    await check('the protected profile shows a lock', await grace.locator('.acct-lock').count() === 1);

    await grace.click();
    await page.waitForSelector('.acct-unlock input', { timeout: 15000 });
    await page.locator('.acct-unlock input').fill(WRONG);
    await page.getByRole('button', { name: 'Unlock' }).click();
    await page.waitForSelector('.error-box', { timeout: 15000 });
    const refusal = await page.locator('.error-box').innerText();
    await check('a wrong password is refused', /wrong password/i.test(refusal), `refusal reads ${JSON.stringify(refusal)}`);
    await check('a wrong password leaves the profile shut',
      await page.locator('.acct-list').count() === 1 && await page.locator('.home-greet').count() === 0, 'the app left the picker after a wrong password');

    await page.locator('.acct-unlock input').fill(LOCKED.password);
    await page.getByRole('button', { name: 'Unlock' }).click();
    await page.waitForSelector('.home-greet', { timeout: 30000 });
    await check('the right password opens the profile — its account is still live and the server lets it in',
      (await page.locator('.home-greet').innerText()).includes('Grace') && await page.locator(GATE).count() === 0);

    // ── back to Ada: another account's session is live, so she signs in as herself ─
    await switchProfile(page);
    await page.locator('.acct-row', { hasText: STUDENT.name }).click();
    await page.locator(GATE).waitFor({ timeout: 30000 });
    await check('choosing a profile whose account is not the live session is refused: the gate, with the mismatch said plainly',
      /not this profile’s/.test(await page.locator(GATE).innerText()) && await page.locator('.home-greet').count() === 0);
    await signInOnCard(page.locator(`${GATE} [data-signin-card="inline"]`), platform, { email: STUDENT.email });
    await page.waitForSelector('.home-greet', { timeout: 60000 });
    await check('signed in as herself, her profile opens — one account per address, nothing duplicated',
      (await page.locator('.home-greet').innerText()).includes('Ada') && platform.h.db.prepare('SELECT COUNT(*) AS n FROM accounts WHERE email=?').get(STUDENT.email).n === 1);

    // ── sign-out returns to the card; a deep link cannot get past it ─────────
    await goto('/settings');
    await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
    await page.locator(GATE).waitFor({ timeout: 20000 });
    await check('disconnecting the account relocks the app at once', await page.locator('.shell').count() === 0);
    await goto('/practice');
    await check('a deep link to Practice cannot bypass the gate', await page.locator('.shell').count() === 0 && await page.locator(GATE).count() === 1);
    await signInOnCard(page.locator(`${GATE} [data-signin-card="inline"]`), platform, { email: STUDENT.email });
    await page.locator('.shell').waitFor({ timeout: 60000 });
    await check('signing in again on the gate restores Practice, with the same account', new URL(page.url()).pathname === '/practice' &&
      String(await page.evaluate(async () => (await (await fetch('/v1/account/me', { credentials: 'include' })).json()).account?.id)) === String(account.accountId));
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
