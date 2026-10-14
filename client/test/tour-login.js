// The primary account-first journey. Real server/SQLite, real OTP API and
// verified browser session; only email delivery is through the test adapter.
// These assertions replace obsolete anonymous-profile/password wizard checks
// with stronger lifecycle, existing-profile and account-authority coverage.
import { pathToFileURL } from 'node:url';
import { onlinePlatform } from './support/online-session.mjs';

export const flow = {
  id: 'login',
  name: 'Login · verified email, persistent profile, logout and recovery',

  async run({ page, check, goto, createProfile }) {
    const platform = await onlinePlatform();
    await goto('/');
    await check('first-run welcome is visible', await page.locator('.hero-title').isVisible());
    await check('the first-run action creates a verified Pri account',
      await page.getByTestId('hero-create-account').isVisible());
    await check('a returning learner can choose email sign-in',
      await page.getByTestId('hero-sign-in-code').isVisible());
    await check('the insecure local-only entry is not offered',
      await page.getByRole('button', { name: 'Use without an account' }).count() === 0);

    const account = await createProfile({ name: 'Ada Lovelace', year: 9, course: 'in' });
    await check('verified first-run reaches Home', await page.locator('.home-greet').isVisible());
    await check('Home names the actual account profile',
      (await page.locator('.home-greet').innerText()).includes('Ada'));
    await check('account chip identifies the learner',
      (await page.locator('.user-chip').innerText()).includes('Ada'));
    await check('Home carries the selected Class 9 curriculum',
      /Class 9/.test(await page.locator('.genbar-chips').innerText()));
    await check('the server bound the verified email to this account',
      platform.h.db.prepare('SELECT email FROM accounts WHERE id=?').get(account.accountId)?.email === account.email);
    await check('adult consent is explicitly not required',
      platform.h.db.prepare('SELECT age_basis FROM accounts WHERE id=?').get(account.accountId)?.age_basis === 'adult' &&
      platform.h.db.prepare('SELECT COUNT(*) AS n FROM guardian_consents WHERE account_id=?').get(account.accountId).n === 0);
    await check('the student has a real nav link to practice',
      await page.locator('a[href="/practice"]').count() > 0);
    await check('the student has a real nav link to notes',
      await page.locator('a[href="/notes"]').count() > 0);

    await goto('/practice');
    await page.locator('.q-prompt').waitFor({ timeout: 30000 });
    await check('Practice is available without Settings sign-in',
      await page.locator('.q-prompt').isVisible() &&
      await page.locator('[data-testid="account-activation-gate"]').count() === 0);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('.q-prompt').waitFor({ timeout: 30000 });
    await check('refresh stays in the same practice session without second OTP',
      await page.locator('[data-signup-step="code"], [data-testid="account-activation-gate"]').count() === 0);

    await goto('/');
    await page.locator('.user-chip').click();
    await page.getByRole('menuitem', { name: 'Switch profile' }).click();
    await page.locator('.acct-list').waitFor({ timeout: 15000 });
    const existing = page.locator('.acct-row', { hasText: 'Ada Lovelace' });
    await check('existing account profile is still listed', await existing.count() === 1);
    await check('existing account retains its class', /Class 9/.test(await existing.innerText()));
    await check('existing profile does not silently acquire a local password',
      await existing.locator('.acct-lock').count() === 0);
    await existing.click();
    await page.locator('.home-greet').waitFor({ timeout: 30000 });
    await check('re-selecting same profile keeps verified account access',
      await page.locator('[data-testid="account-activation-gate"]').count() === 0);

    await goto('/settings');
    await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
    await page.locator('[data-testid="account-activation-gate"]').waitFor({ timeout: 15000 });
    await check('disconnect revokes Home immediately',
      await page.locator('.shell').count() === 0);
    await goto('/practice');
    await check('deep-linking to Practice cannot bypass logout',
      await page.locator('.shell').count() === 0 &&
      await page.locator('[data-testid="account-activation-gate"]').count() === 1);

    const input = page.locator('#signup-destination');
    await input.waitFor({ timeout: 15000 });
    await input.fill(account.email);
    await page.getByTestId('signup-send-code').click();
    await page.locator('[data-signup-step="code"]').waitFor({ timeout: 15000 });
    const code = platform.sms.readTestOutbox({ to: account.email, channel: 'email' }).at(-1)?.code;
    await check('returning learner receives a real backend sign-in OTP', /^\d{6}$/.test(code || ''));
    await page.locator('#signup-code-0').focus();
    await page.keyboard.type(code);
    await page.locator('.q-prompt').waitFor({ timeout: 30000 });
    await check('recovery restores Practice without Settings authentication',
      await page.locator('[data-testid="account-activation-gate"]').count() === 0);
    const current = await page.evaluate(async () => {
      const r = await fetch('/v1/account/me', { credentials: 'include' });
      return r.ok ? (await r.json()).account?.id : null;
    });
    await check('recovered account identity is unchanged', String(current) === String(account.accountId));
    await check('reauthentication did not create a duplicate cloud account',
      platform.h.db.prepare('SELECT COUNT(*) AS n FROM accounts WHERE email=?').get(account.email).n === 1);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('.q-prompt').waitFor({ timeout: 30000 });
    await check('the recovered sign-in survives reopening',
      await page.locator('[data-testid="account-activation-gate"]').count() === 0);
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
