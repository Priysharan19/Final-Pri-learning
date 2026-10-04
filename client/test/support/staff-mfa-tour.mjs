// Pri Learning · E2E support — drive the real staff MFA panel in the browser.
//
// After a staff sign-in the StaffMfaGate (client/src/components/StaffMfaGate.jsx)
// hides the console behind MfaPanel until the account has enrolled an
// authenticator app and this session has confirmed a code. These steps play the
// staff member and their authenticator app against the tour's in-test mock of
// the server (createMfaMock in ./totp.mjs), through the product UI only: the
// secret is read off the page exactly as a person would copy it into an app.
import { totp, wrongTotp } from './totp.mjs';

const EN = {
  start: 'Set up authenticator app',
  codeLabel: 'Six-digit code from the app',
  confirm: 'Confirm code',
  codeRejected: 'That code was not accepted. Check the time on your device and try again.',
  stepUpIntro: 'Enter the code from your authenticator app again to confirm this action.',
  codeOrRecovery: 'Code or recovery code',
  verify: 'Verify'
};

export const mfaPanelOf = page => page.locator('section', { has: page.locator('#mfa-title') });
export const staffConsoleOf = page => page.locator('section', { has: page.locator('#staff-operations-title') });

/**
 * Enrol through the panel: intro → secret → (wrong code refused) → right code →
 * recovery codes → acknowledge → console. Adds five checks and returns the
 * base32 secret so the caller can answer later step-up prompts.
 */
export async function enrolStaffMfaThroughPanel({ page, check, timeout = 15000 }) {
  const panel = mfaPanelOf(page);
  const staff = staffConsoleOf(page);

  await page.locator('section[data-mfa-step="intro"]').waitFor({ state: 'visible', timeout });
  await check('the staff console is hidden behind the authenticator gate before enrolment',
    await staff.count() === 0 && await panel.isVisible());

  await panel.getByRole('button', { name: EN.start }).click();
  await page.locator('section[data-mfa-step="enrol"]').waitFor({ state: 'visible', timeout });
  const secret = (await panel.locator('[data-mfa-secret]').innerText()).trim();
  const uri = (await panel.locator('[data-mfa-uri]').innerText()).trim();
  const uriSecret = (() => { try { return new URL(uri).searchParams.get('secret'); } catch { return null; } })();
  await check('enrolment shows a base32 setup key and an otpauth link carrying the same secret',
    /^[A-Z2-7]{32}$/.test(secret) && uri.startsWith('otpauth://totp/') && uriSecret === secret,
    `secret=${secret} uri=${uri}`);

  await panel.getByLabel(EN.codeLabel).fill(wrongTotp(secret));
  await panel.getByRole('button', { name: EN.confirm }).click();
  const rejected = panel.getByRole('alert').getByText(EN.codeRejected, { exact: true });
  await rejected.waitFor({ state: 'visible', timeout });
  await check('a wrong six-digit code is refused by the server and the console stays hidden',
    await rejected.isVisible() && await staff.count() === 0 && await page.locator('section[data-mfa-step="enrol"]').count() === 1);

  await panel.getByLabel(EN.codeLabel).fill(totp(secret));
  await panel.getByRole('button', { name: EN.confirm }).click();
  await page.locator('section[data-mfa-step="recovery"]').waitFor({ state: 'visible', timeout });
  const recoveryCodes = await panel.locator('[data-mfa-recovery-codes] li').allInnerTexts();
  await check('the right code confirms enrolment and shows eight recovery codes once, with the secret gone from the page',
    recoveryCodes.length === 8 && recoveryCodes.every(code => /^\d{5}-\d{5}$/.test(code.trim())) &&
      await panel.locator('[data-mfa-secret]').count() === 0,
    JSON.stringify(recoveryCodes));

  await panel.locator('[data-mfa-acknowledge]').click();
  await staff.waitFor({ state: 'visible', timeout });
  await check('acknowledging the recovery codes opens the staff console without a reload',
    await staff.isVisible() && await panel.count() === 0 && new URL(page.url()).pathname === '/settings');

  return { secret, recoveryCodes };
}

/**
 * Answer a step-up prompt (reason "step-up") with a code for the next 30-second
 * step, which the server has not yet spent. Adds no checks of its own.
 */
export async function answerStepUpPrompt({ page, secret, timeout = 15000 }) {
  const panel = mfaPanelOf(page);
  await page.locator('section[data-mfa-step="verify"]').waitFor({ state: 'visible', timeout });
  const intro = await panel.innerText();
  await panel.getByLabel(EN.codeOrRecovery).fill(totp(secret, Date.now() + 30_000));
  await panel.getByRole('button', { name: EN.verify }).click();
  await panel.waitFor({ state: 'hidden', timeout });
  return { stepUpIntroShown: intro.includes(EN.stepUpIntro) };
}
