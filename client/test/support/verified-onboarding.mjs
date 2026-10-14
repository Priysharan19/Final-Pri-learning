// Shared real-browser first-run fixture. Never creates an unlocked local-only
// profile, writes an auth cookie, or injects a cloud account into IndexedDB.
// The platform is the real app server; only email delivery uses its test adapter.
let serial = 0;

export async function createVerifiedProfile(page, platform, {
  name = 'E2E Student', year = 9, email = null, course = 'in',
  track = 'cbse', role = 'student', fromPicker = false
} = {}) {
  if (role !== 'student') throw new Error('Teacher onboarding requires a separately authorised teacher-role fixture; student signup cannot grant teacher access.');
  if (course !== 'in') throw new Error('Australian curriculum onboarding is not represented by the Class 7-12 account signup UI; do not silently substitute a CBSE profile.');

  // The test database and provider are genuine; the desk reads an outbox entry
  // instead of receiving a real email. No test-only bypass is in the app.
  platform.h.db.prepare("DELETE FROM rate_limits WHERE bucket LIKE 'otp-%'").run();
  const address = email || ('browser.' + process.pid + '.' + (++serial) + '.' + Date.now().toString(36) + '@example.test');
  if (fromPicker) {
    // Picker is not permission to enter another profile. Its own visible
    // welcome control exposes the supported account-first creation route.
    await page.getByRole('button', { name: 'Back to the Pri Learning welcome screen' }).click();
    await page.getByTestId('hero-create-account').waitFor({ timeout: 15000 });
  }
  await page.getByTestId('hero-create-account').click();
  await page.locator('[data-signup-step="method"]').waitFor({ timeout: 15000 });
  await page.locator('#signup-destination').fill(address);
  await page.getByTestId('signup-send-code').click();
  await page.locator('[data-signup-step="code"]').waitFor({ timeout: 15000 });
  const message = platform.sms.readTestOutbox({ to: address, channel: 'email' }).at(-1);
  if (!/^\d{6}$/.test(message?.code || '')) throw new Error('The real backend did not create a six-digit email challenge');
  await page.locator('#signup-code-0').focus();
  await page.keyboard.type(message.code);
  await page.locator('[data-signup-step="age"]').waitFor({ timeout: 15000 });
  await page.getByTestId('signup-age-18').click();
  await page.locator('[data-signup-step="class"]').waitFor({ timeout: 15000 });
  const classButton = page.getByTestId('signup-class-' + year);
  if (!await classButton.count()) throw new Error('Unsupported class in account signup: ' + year);
  await classButton.click();
  if (track !== 'cbse') await page.getByTestId('signup-track-' + track).click();
  await page.locator('#signup-flow-name').fill(name);
  await page.getByTestId('signup-class-next').click();
  await page.locator('.home-greet').waitFor({ timeout: 30000 });
  if (!(await page.locator('.home-greet').innerText()).includes(name.split(' ')[0])) {
    throw new Error('Home did not display the newly verified learner');
  }
  const me = await page.evaluate(async () => {
    const response = await fetch('/v1/account/me', { credentials: 'include' });
    return { status: response.status, data: response.ok ? await response.json() : null };
  });
  if (me.status !== 200 || !me.data?.account?.id) throw new Error('Home opened without a verified platform account');
  if (await page.locator('[data-testid="account-activation-gate"]').count()) throw new Error('First sync did not finish');
  return { email: address, accountId: me.data.account.id, year, name };
}
