// Pri Learning · E2E flow — a child signs up on the one card with an emailed
// code, a parent approves by SMS code on their own page, and the student
// lands on the first question only then; an adult goes straight in.
//
// Nothing is mocked on the server side. The browser and the real platform
// server share one origin (support/online-session.mjs: real routes, real
// SQLite, real cookies and CSRF). Email and SMS delivery are the server's
// TEST adapters, which send nothing and keep each code in memory; the test
// reads a code the way a phone or a mailbox would and types it into the
// shipped UI.

import { pathToFileURL } from 'node:url';
import { onlinePlatform } from './support/online-session.mjs';
import { freshEmail, lastEmailCode, resetOtpLimits, typeCode, waitForStep } from './support/verified-onboarding.mjs';

const CARD = '[data-signin-card="page"]';
const GATE = '[data-testid="account-activation-gate"]';

export const flow = {
  id: 'otp-onboarding',
  name: 'Account · email code sign-up, a parent approves by SMS on their own page, first question',

  async run({ page, ctx, base, check, goto, shot }) {
    const { h, sms } = await onlinePlatform();
    const seen = [];
    const captureRequest = request => {
      const target = new URL(request.url());
      if (target.pathname.startsWith('/v1/')) seen.push(`${request.method()} ${target.pathname}`);
    };
    ctx.on('request', captureRequest);
    const childEmail = freshEmail('asha');

    await goto('/');
    const card = page.locator(CARD);
    await check('the landing screen opens on the card, asking for an email', await card.getAttribute('data-signup-step') === 'method' &&
      await page.locator('#signup-destination').getAttribute('type') === 'email');
    await check('a phone code is offered beside it only because this deployment has an SMS sender', await page.getByTestId('signup-channel-sms').count() === 1);
    const animation = await page.locator('.signup-step').evaluate(el => getComputedStyle(el).animationName);
    await check('reduced motion removes the step animation', animation === 'none', animation);
    resetOtpLimits(await onlinePlatform());
    await page.locator('#signup-destination').fill(childEmail);
    await shot('method');
    await page.getByTestId('signup-send-code').click();
    await page.locator('#signup-code-0').waitFor({ timeout: 15000 });
    const sent = lastEmailCode(await onlinePlatform(), childEmail);
    await check('a 6-digit code went to the address through the test email adapter', /^\d{6}$/.test(sent || ''));
    await check('the first box asks the keyboard for the code from the message', await page.locator('#signup-code-0').getAttribute('autocomplete') === 'one-time-code');
    await check('the resend button waits out its cooldown', await page.getByTestId('signup-resend').isDisabled());
    await check('the code step moves focus into the first box', await page.evaluate(() => document.activeElement?.id === 'signup-code-0'));

    const wrong = sent === '000000' ? '111111' : '000000';
    await typeCode(page, wrong);
    await page.getByRole('alert').waitFor({ timeout: 10000 });
    await check('a wrong code is refused, the boxes clear for another try, and no account was made',
      (await page.locator('[data-testid="signup-code-box"]').evaluateAll(els => els.map(e => e.value).join(''))) === '' &&
        h.db.prepare('SELECT COUNT(*) AS n FROM accounts WHERE email=?').get(childEmail).n === 0);
    // Typing digit by digit auto-advances box to box and submits on the sixth.
    await typeCode(page, sent);
    await waitForStep(card, 'age');
    await check('the right code for a new address asks who they are — the mailbox is proved first, the account made after',
      await page.getByTestId('signup-age-18').isVisible() && h.db.prepare('SELECT COUNT(*) AS n FROM accounts WHERE email=?').get(childEmail).n === 0);
    await check('the step heading takes focus for screen readers', await page.evaluate(() => document.activeElement?.id === 'signup-step-title'));
    await page.locator('#signup-flow-name').fill('Asha');
    await page.getByTestId('signup-age-15').click();
    await page.getByTestId('signup-agree').check();
    await page.getByTestId('signup-age-next').click();
    await waitForStep(card, 'class');
    await page.getByTestId('signup-class-9').click();
    await check('JEE is not offered below Class 11', await page.getByTestId('signup-track-jee-main').isDisabled());
    await page.getByTestId('signup-class-11').click();
    await page.getByTestId('signup-track-jee-main').click();
    await shot('class');
    await page.getByTestId('signup-class-next').click();
    await waitForStep(card, 'parent');
    await check('a 15-year-old is asked for a parent next, and the app has not opened',
      await page.getByRole('heading', { name: 'Now, a parent’s approval' }).isVisible() && await page.locator('.shell').count() === 0);

    const account = h.db.prepare('SELECT id, email, age_basis FROM accounts WHERE email=?').get(childEmail);
    await check('the account exists, keyed to the verified email, as a child', !!account && account.age_basis !== 'adult', JSON.stringify(account));
    const pending = h.db.prepare('SELECT method, confirmed_at FROM guardian_consents WHERE account_id=?').get(account.id);
    await check('and it starts limited: consent pending', pending && pending.confirmed_at === null, JSON.stringify(pending));
    await check('there is no "ask them later": approval comes before the app',
      await page.getByTestId('signup-parent-required').isVisible() && await page.locator('[data-testid="signup-parent-later"], [data-testid="signup-parent-continue"]').count() === 0);

    // The parent is reached by SMS here (the deployment has an SMS sender).
    await page.locator('#signup-parent-name').fill('Meera');
    await page.getByTestId('signup-parent-sms').click();
    await page.locator('#signup-parent-destination').fill('99887 76655');
    await page.getByTestId('signup-parent-send').click();
    await waitForStep(card, 'parent-wait');
    await check('the child’s screen only waits for the parent: no code box, no approve button',
      await page.locator('[data-testid="signup-parent-waiting"]').isVisible() &&
        await page.locator('input[autocomplete="one-time-code"]').count() === 0 &&
        await page.getByRole('button', { name: 'Approve' }).count() === 0);
    await check('and can ask for the code again once the cooldown ends', await page.getByTestId('signup-parent-resend').isDisabled());
    const parentSms = sms.readTestOutbox({ to: '+919988776655' }).at(-1);
    await check('the parent’s phone got the consent code with the address of their own page',
      parentSms?.purpose === 'guardian-consent' && /^\d{6}$/.test(parentSms?.code || '') && /\/guardian\/consent|parent page/i.test(parentSms?.body || ''), JSON.stringify(parentSms?.body || '').slice(0, 160));

    // The parent, on their own device: a separate browser context, no profile,
    // no session, nothing shared with the child's browser.
    const parentCtx = await ctx.browser().newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    try {
      parentCtx.on('request', captureRequest);
      const parentPage = await parentCtx.newPage();
      await parentPage.goto(`${base}/guardian/consent`, { waitUntil: 'domcontentloaded' });
      await parentPage.getByRole('heading', { name: 'What you are agreeing to' }).waitFor({ timeout: 20000 });
      await check('the parent page shows the notice before the code can be entered', await parentPage.locator('#guardian-code-0').isDisabled());
      const phoneRadio = parentPage.getByRole('radio', { name: /Phone|SMS/i });
      if (await phoneRadio.count()) await phoneRadio.click();
      await parentPage.locator('#guardian-destination').fill('99887 76655');
      await parentPage.getByTestId('guardian-agree').check();
      await parentPage.locator('#guardian-code-0').focus();
      await parentPage.evaluate(code => {
        const data = new DataTransfer(); data.setData('text', code);
        document.activeElement.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
      }, parentSms.code);
      await check('pasting fills all six boxes',
        (await parentPage.locator('[data-testid="guardian-code-box"]').evaluateAll(els => els.map(e => e.value).join(''))) === parentSms.code);
      await shot('parent-wait');
      await parentPage.getByTestId('guardian-approve').click();
      await parentPage.getByText('Asha’s account is approved', { exact: false }).waitFor({ timeout: 15000 });
      await check('the parent is told whose account they approved', true);
      await check('the parent page never held a child session', !(await parentCtx.cookies()).some(cookie => /session/i.test(cookie.name)));
    } finally {
      await parentCtx.close();
    }

    // The child's waiting screen notices on its own and opens the first question.
    await page.waitForURL(/\/practice/, { timeout: 30000 });
    await page.waitForSelector('.shell', { timeout: 30000 });
    await check('the student lands on practice, the first question — only now', new URL(page.url()).pathname === '/practice' && await page.locator(GATE).count() === 0);
    const cloudMeStatus = await page.evaluate(async () => (await fetch('/v1/account/me', { credentials: 'include' })).status);
    await check('the same onboarding leaves a live Pri cloud session', cloudMeStatus === 200, String(cloudMeStatus));

    // The adaptive first question may legitimately be MCQ. Move to the first
    // written-answer question before checking the working modes; this keeps the
    // auth regression deterministic instead of depending on question type.
    let answerModesAvailable = false;
    for (let i = 0; i < 12; i++) {
      const photo = await page.getByRole('button', { name: 'Photo' }).count();
      const write = await page.getByRole('button', { name: 'Write' }).count();
      if (photo && write) { answerModesAvailable = true; break; }
      const next = page.locator('.ctx-next');
      if (!await next.count()) break;
      await next.click();
      await page.waitForSelector('.q-prompt', { timeout: 15000 });
      await page.waitForTimeout(80);
    }
    await check('the signed-in journey reaches a written-answer question', answerModesAvailable);
    if (answerModesAvailable) {
      await page.getByRole('button', { name: 'Photo' }).click();
      await page.waitForTimeout(120);
      await check('photo mode does not ask the newly signed-in learner to sign in again',
        await page.getByText('Sign in to read photos of your working.', { exact: false }).count() === 0);
      await page.getByRole('button', { name: 'Write' }).click();
      await page.waitForTimeout(120);
      await check('handwriting mode does not ask the newly signed-in learner to sign in again',
        await page.getByText('Reading your handwriting needs a Pri account.', { exact: false }).count() === 0);
    }

    const given = h.db.prepare('SELECT method, confirmed_at FROM guardian_consents WHERE account_id=?').get(account.id);
    await check('the parent’s approval is recorded as a phone-code consent', given.method === 'guardian-phone-otp' && given.confirmed_at > 0, JSON.stringify(given));
    await check('every step went through the real server', seen.includes('POST /v1/account/otp/verify') && seen.includes('POST /v1/account/otp/guardian/approve'));

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.shell', { timeout: 30000 });
    await check('an approved minor reopens Practice without a second sign-in or guardian step',
      new URL(page.url()).pathname === '/practice' && await page.locator(`${GATE}, ${CARD}`).count() === 0);

    // A guardian's withdrawal is enforced by the live server state, not by
    // anything the child's device remembers.
    h.db.prepare('UPDATE guardian_consents SET withdrawn_at=? WHERE account_id=?').run(Date.now(), account.id);
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.locator(GATE).waitFor({ timeout: 20000 });
    await check('a guardian’s withdrawal, noticed on the next recheck, closes the app with the "needs attention" screen',
      await page.locator('.shell').count() === 0 && await page.getByTestId('activation-blocked').isVisible());

    // ── an adult, on a fresh device: no parent step anywhere ──────────────────
    const adultCtx = await ctx.browser().newContext({ viewport: { width: 1080, height: 820 }, reducedMotion: 'reduce' });
    try {
      adultCtx.on('request', captureRequest);
      const adult = await adultCtx.newPage();
      const adultEmail = freshEmail('adult');
      await adult.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
      await adult.locator(`${CARD} #signup-destination`).waitFor({ timeout: 30000 });
      resetOtpLimits(await onlinePlatform());
      await adult.locator('#signup-destination').fill(adultEmail);
      await adult.getByTestId('signup-send-code').click();
      await adult.locator('#signup-code-0').waitFor({ timeout: 15000 });
      await typeCode(adult, lastEmailCode(await onlinePlatform(), adultEmail));
      await waitForStep(adult.locator(CARD), 'age');
      await adult.locator('#signup-flow-name').fill('Adult learner');
      await adult.getByTestId('signup-age-18').click();
      await adult.getByTestId('signup-agree').check();
      await adult.getByTestId('signup-age-next').click();
      await waitForStep(adult.locator(CARD), 'class');
      await adult.getByTestId('signup-class-12').click();
      await adult.getByTestId('signup-class-next').click();
      await adult.waitForSelector('.shell', { timeout: 60000 });
      await check('18+ goes straight in: no parent step, no waiting screen',
        await adult.locator('[data-signup-step="parent"], [data-signup-step="parent-wait"], [data-testid="activation-guardian"]').count() === 0 && new URL(adult.url()).pathname === '/practice');
      const adultAccount = h.db.prepare('SELECT id, age_basis FROM accounts WHERE email=?').get(adultEmail);
      await check('the server holds the adult age authority and NO guardian row',
        adultAccount?.age_basis === 'adult' && h.db.prepare('SELECT COUNT(*) AS n FROM guardian_consents WHERE account_id=?').get(adultAccount.id).n === 0, JSON.stringify(adultAccount));
      const adultState = await adult.evaluate(async () => { const r = await fetch('/v1/account/guardian/state', { credentials: 'include' }); return r.ok ? r.json() : { status: r.status }; });
      await check('the server’s bound statement for the adult: this account, nothing required, eligible',
        String(adultState?.accountId) === String(adultAccount.id) && adultState?.required === false && adultState?.state === 'not-required' && adultState?.eligible === true, JSON.stringify(adultState));
    } finally { await adultCtx.close(); }
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
