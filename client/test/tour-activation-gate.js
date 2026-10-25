// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · E2E journeys — account first: the one sign-in card, and the
// activation gate in front of every route.
//
// Owner decision (issue #477): a student opens the app only once the server
// has confirmed their account, its age/guardian decision and the first sync.
// These journeys walk that in a real browser against the real platform server
// (support/online-session.mjs: real routes, real SQLite, real cookies and
// CSRF; only email delivery is the server's TEST adapter, whose outbox the
// test desk reads the way a mailbox would be read).
//
//   1  a new adult: email → the code in the same card → name, age, class →
//      the app; reload keeps them in; sign-out returns to the card and a deep
//      link cannot get past it; the same email signs back in without a second
//      account.
//   2  a new under-18 on the landing card: the parent's approval step, the
//      shell never opens, every deep link shows the card, a reload mid-way
//      comes back to the same account's parent step (no duplicate), the parent
//      approves on their own page, and the waiting screen moves on by itself.
//   3  a minor behind the GATE (a saved device profile linked to a pending
//      child account): only the waiting screen, on every route, until the
//      guardian approves; then the app.
//   4  signed out on a saved device: a deep link opens the gate's sign-in, not
//      the page; a revoked session is noticed and relocks; a 503 never does.
//   5  an existing activated student is not disturbed: reload, back button;
//      opened offline within 72 hours of the server's last yes they are
//      inside with their History and an offline line, and the server is asked
//      again when the connection returns; a guardian's withdrawal while the
//      device is offline closes the app on reconnect and ends the grace;
//      past 72 hours an offline open is the gate's retry.
//
// Run on its own:  node client/test/tour-activation-gate.js [--no-build] [--browser=webkit]
// ─────────────────────────────────────────────────────────────────────────────
import { pathToFileURL } from 'node:url';
import { onlinePlatform } from './support/online-session.mjs';
import { createVerifiedProfile, freshEmail, lastEmailCode, resetOtpLimits, signInOnCard, typeCode } from './support/verified-onboarding.mjs';

const GATE = '[data-testid="account-activation-gate"]';
const CARD = '[data-signin-card="page"]';
const INLINE = '[data-signin-card="inline"]';
const SETTLED = `${GATE}:not([data-activation-status="checking"])`;
const DEEP_LINKS = ['/practice?subtopic=c10-polynomials', '/progress', '/exams', '/settings', '/notes', '/history'];

const accountRow = (platform, email) => platform.h.db.prepare('SELECT id, age_basis FROM accounts WHERE email=? AND deleted_at IS NULL').get(email);
const consentRow = (platform, accountId) => platform.h.db.prepare('SELECT method, confirmed_at, withdrawn_at FROM guardian_consents WHERE account_id=?').get(accountId);
const accountsFor = (platform, email) => platform.h.db.prepare('SELECT COUNT(*) AS n FROM accounts WHERE email=?').get(email).n;
const endSessions = (platform, accountId) => platform.h.db.prepare('DELETE FROM account_sessions WHERE account_id=?').run(accountId).changes;
const meStatus = page => page.evaluate(async () => (await fetch('/v1/account/me', { credentials: 'include' })).status);
const guardianState = page => page.evaluate(async () => { const r = await fetch('/v1/account/guardian/state', { credentials: 'include' }); return r.ok ? r.json() : { status: r.status }; });
const gateStatus = page => page.locator(GATE).getAttribute('data-activation-status').catch(() => null);

/** The parent, on their own device: a separate context, no profile, no session. */
async function approveAsParent(ctx, base, platform, parentEmail, childName) {
  const parentCtx = await ctx.browser().newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  try {
    const parent = await parentCtx.newPage();
    await parent.goto(`${base}/guardian/consent`, { waitUntil: 'domcontentloaded' });
    await parent.getByRole('heading', { name: 'What you are agreeing to' }).waitFor({ timeout: 20000 });
    const facts = { noticeFirst: await parent.locator('#guardian-code-0').isDisabled() };
    const emailRadio = parent.getByRole('radio', { name: 'Email' });
    if (await emailRadio.count()) await emailRadio.click();
    await parent.locator('#guardian-destination').fill(parentEmail);
    await parent.getByTestId('guardian-agree').check();
    const code = lastEmailCode(platform, parentEmail, { purpose: 'guardian-consent' });
    if (!code) throw new Error(`no guardian-consent code reached ${parentEmail}`);
    await typeCode(parent, code, { idPrefix: 'guardian-code' });
    await parent.getByTestId('guardian-approve').click();
    await parent.getByText(`${childName}’s account is approved`, { exact: false }).waitFor({ timeout: 15000 });
    facts.noChildSession = !(await parentCtx.cookies()).some(cookie => /session/i.test(cookie.name));
    return facts;
  } finally { await parentCtx.close(); }
}

/** Wait until the service worker controls the page, so an offline reload can paint the app at all. */
async function workerInCharge(page) {
  const claimed = await page.waitForFunction(() => !!navigator.serviceWorker?.controller, null, { timeout: 30000 }).then(() => true).catch(() => false);
  if (!claimed) return false;
  // The install holds what the first paint needs; the rest of the offline
  // build (every route's code) is the worker's second pass, which the app asks
  // for when idle. Ask for it and wait, as boot-resilience-check.mjs does.
  const warmed = await page.evaluate(() => new Promise(resolve => {
    const channel = new MessageChannel();
    channel.port1.onmessage = e => resolve(e.data);
    navigator.serviceWorker.controller.postMessage({ type: 'pri-warm', optional: true }, [channel.port2]);
    setTimeout(() => resolve(null), 60000);
  })).catch(() => null);
  return !!warmed && warmed.warmed === warmed.of && warmed.of > 0;
}

export const flow = {
  id: 'activation-gate',
  name: 'Account first · one card, the gate on every route, guardian approval, sign-out, deep links, reload, offline',

  async run({ page, ctx, base, check, note, goto, settle, browserName = 'chromium' }) {
    const platform = await onlinePlatform();
    note(`engine: ${browserName} · real platform server, real routes and database; email delivery is the server's TEST adapter (synthetic, read at the test desk)`);

    // ── 1 · a new adult ──────────────────────────────────────────────────────
    await goto('/');
    await check('the landing screen is the sign-in card', await page.locator(`${CARD}[data-signup-step="method"]`).isVisible());
    await check('there is no demo and no device-only entry on the welcome screen',
      await page.locator('[data-testid="hero-offline"], [data-testid="hero-try-demo"], [data-testid="hero-existing-device"]').count() === 0 &&
        await page.locator('.shell').count() === 0);
    const legalLinks = [];
    for (const href of ['/privacy', '/terms', '/refund-policy', '/grievance']) legalLinks.push(await page.locator(`.auth-col a[href="${href}"]`).count());
    await check('the welcome screen still links to the legal pages', legalLinks.every(n => n === 1), JSON.stringify(legalLinks));
    const adultEmail = freshEmail('adult');
    resetOtpLimits(platform);
    await page.locator('#signup-destination').fill(adultEmail);
    await page.getByTestId('signup-send-code').click();
    await page.locator(`${CARD}[data-signup-step="code"]`).waitFor({ timeout: 20000 });
    const code = lastEmailCode(platform, adultEmail);
    await check('the real server sent a six-digit code to the address, through its test email adapter', /^\d{6}$/.test(code || ''));
    await check('the code is asked for in the same card, with no second screen', await page.locator(CARD).count() === 1 && await page.locator('#signup-code-0').isVisible());
    await check('the first box asks the keyboard for the code from the message', await page.locator('#signup-code-0').getAttribute('autocomplete') === 'one-time-code');
    await typeCode(page, code === '000000' ? '111111' : '000000');
    await page.locator('[data-testid="signup-error"]').waitFor({ timeout: 10000 });
    await check('a wrong code is refused, the boxes clear, and no account was made',
      (await page.locator('[data-testid="signup-code-box"]').evaluateAll(els => els.map(e => e.value).join(''))) === '' && !accountRow(platform, adultEmail));
    await typeCode(page, code);
    await page.locator(`${CARD}[data-signup-step="age"]`).waitFor({ timeout: 20000 });
    await check('a right code for a new address asks who they are — after the mailbox is proved, not before', !accountRow(platform, adultEmail));
    await page.locator('#signup-flow-name').fill('Asha Adult');
    await page.getByTestId('signup-age-next').click();
    await check('no account is made without an age and the agreement', await page.locator('[data-testid="signup-error"]').isVisible() && !accountRow(platform, adultEmail));
    await page.getByTestId('signup-age-18').click();
    await page.getByTestId('signup-agree').check();
    await page.getByTestId('signup-age-next').click();
    await page.locator(`${CARD}[data-signup-step="class"]`).waitFor({ timeout: 20000 });
    await page.getByTestId('signup-class-10').click();
    await check('JEE is not offered below Class 11', await page.getByTestId('signup-track-jee-main').isDisabled());
    await page.getByTestId('signup-class-next').click();
    await page.locator('.shell').waitFor({ timeout: 60000 });
    await page.waitForURL(/\/practice/, { timeout: 30000 }).catch(() => {});
    const adult = accountRow(platform, adultEmail);
    await check('an adult lands in the app with no guardian step and no Settings detour',
      new URL(page.url()).pathname === '/practice' && await page.locator(`${GATE}, [data-signup-step="parent"], [data-testid="activation-guardian"]`).count() === 0, page.url());
    await check('the server holds the account as an adult, with no guardian row', adult?.age_basis === 'adult' && !consentRow(platform, adult.id), JSON.stringify(adult));
    await check('the device holds a live, verified session for it', await meStatus(page) === 200);
    const adultState = await guardianState(page);
    await check('the server\'s bound statement says: this account, nothing required, eligible',
      String(adultState.accountId) === String(adult.id) && adultState.required === false && adultState.state === 'not-required' && adultState.eligible === true, JSON.stringify(adultState));
    await page.locator('.q-prompt').waitFor({ timeout: 30000 });
    await check('a question is served: nothing asks for sign-in again', await page.locator('[data-check-needs-account], [data-ink-account-recovery]').count() === 0);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('.shell').waitFor({ timeout: 30000 });
    await check('a reload keeps an activated student inside, with no card and no gate',
      await page.locator(`${GATE}, ${CARD}`).count() === 0 && new URL(page.url()).pathname === '/practice');

    // sign-out returns to the card; a deep link cannot get past it
    await goto('/settings');
    await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
    await page.locator(GATE).waitFor({ timeout: 20000 });
    // The gate is up while it asks the server ('checking'); judge its answer, not the question.
    await page.locator(SETTLED).waitFor({ timeout: 20000 }).catch(() => {});
    await check('signing out relocks at once: the shell is gone and the gate shows the sign-in card',
      await page.locator('.shell').count() === 0 && await gateStatus(page) === 'signin' && await page.locator(`${GATE} ${INLINE}`).count() === 1);
    let lastLink = '/';
    for (const link of DEEP_LINKS.slice(0, 3)) {
      await page.goto(`${base}${link}`, { waitUntil: 'domcontentloaded' });
      await page.locator(GATE).waitFor({ timeout: 20000 });
      await page.locator(SETTLED).waitFor({ timeout: 20000 }).catch(() => {});
      await check(`signed out, a deep link to ${link.split('?')[0]} is the gate, not the page`, await page.locator('.shell').count() === 0 && await gateStatus(page) === 'signin');
      lastLink = link.split('?')[0];
    }
    const signedBack = await signInOnCard(page.locator(`${GATE} ${INLINE}`), platform, { email: adultEmail });
    await page.locator('.shell').waitFor({ timeout: 60000 });
    await check('the same email signs back in on the gate, into the deep-linked route, with no second account',
      !signedBack.newAccount && accountsFor(platform, adultEmail) === 1 && new URL(page.url()).pathname === lastLink && await page.locator(GATE).count() === 0, page.url());
    await check('the recovered session is the same account', String(await page.evaluate(async () => (await (await fetch('/v1/account/me', { credentials: 'include' })).json()).account?.id)) === String(adult.id));

    // ── 2 · a new under-18, on the landing card ──────────────────────────────
    const childCtx = await ctx.browser().newContext({ viewport: { width: 1024, height: 1366 }, reducedMotion: 'reduce', hasTouch: true });
    try {
      const child = await childCtx.newPage();
      const childEmail = freshEmail('child');
      const parentEmail = freshEmail('parent');
      await child.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
      await child.locator(`${CARD}[data-signup-step="method"]`).waitFor({ timeout: 30000 });
      await signInOnCard(child.locator(CARD), platform, { email: childEmail, name: 'Ravi Child', age: 15 });
      await child.locator(`${CARD}[data-signup-step="class"]`).waitFor({ timeout: 20000 });
      await child.getByTestId('signup-class-9').click();
      await child.getByTestId('signup-class-next').click();
      await child.locator(`${CARD}[data-signup-step="parent"]`).waitFor({ timeout: 20000 });
      const minor = accountRow(platform, childEmail);
      await check('a 15-year-old is asked for a parent next, and the shell has not opened',
        await child.getByRole('heading', { name: 'Now, a parent’s approval' }).isVisible() && await child.locator('.shell').count() === 0);
      await check('the account exists, limited: consent pending on the server',
        minor?.age_basis !== 'adult' && consentRow(platform, minor?.id)?.confirmed_at === null, JSON.stringify({ minor, consent: consentRow(platform, minor?.id) }));
      await check('the card says plainly that approval comes before the app, and offers no way past',
        await child.getByTestId('signup-parent-required').isVisible() && await child.locator('[data-testid="signup-parent-later"], [data-testid="signup-parent-continue"]').count() === 0);
      await child.locator('#signup-parent-name').fill('Meera');
      await child.locator('#signup-parent-destination').fill(parentEmail);
      await child.getByTestId('signup-parent-send').click();
      await child.locator(`${CARD}[data-signup-step="parent-wait"]`).waitFor({ timeout: 20000 });
      await check('the child\'s screen only waits: no code box, no approve button',
        await child.getByTestId('signup-parent-waiting').isVisible() && await child.locator('input[autocomplete="one-time-code"]').count() === 0 && await child.getByRole('button', { name: 'Approve' }).count() === 0);
      const parentMail = platform.sms.readTestOutbox({ to: parentEmail, channel: 'email' }).at(-1);
      // The mail names the parent's own page: as a link only when this
      // deployment's public origin is configured (otpEmail.js), never a
      // caller-supplied one; this harness runs without one, so it is named in words.
      await check('the parent was sent an approval code (to their own address) that points them to their own page',
        parentMail?.purpose === 'guardian-consent' && /^\d{6}$/.test(parentMail?.code || '') && /\/guardian\/consent|parent page/i.test(parentMail?.body || ''), JSON.stringify(parentMail?.body || '').slice(0, 200));

      // every route, while pending: the card, never the shell
      for (const link of DEEP_LINKS) {
        await child.goto(`${base}${link}`, { waitUntil: 'domcontentloaded' });
        await child.locator(`${CARD}, ${GATE}`).first().waitFor({ timeout: 20000 });
        await check(`pending approval, a deep link to ${link.split('?')[0]} does not open the app`, await child.locator('.shell, .q-prompt').count() === 0);
      }
      await child.goto(`${base}/privacy`, { waitUntil: 'domcontentloaded' });
      // The legal page is a lazy chunk behind the boot read of the profile:
      // waited for, not sampled at domcontentloaded (WebKit paints it later).
      await child.locator('main, article, .legal').first().waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
      await check('the privacy page stays public meanwhile', await child.locator('main, article, .legal').first().isVisible().catch(() => false) && await child.locator('.shell').count() === 0);

      // reload mid-onboarding: the same account, back at the parent step
      await child.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
      await child.locator(`${CARD}[data-signup-step="method"]`).waitFor({ timeout: 30000 });
      await signInOnCard(child.locator(CARD), platform, { email: childEmail });
      await child.locator(`${CARD}[data-signup-step="class"]`).waitFor({ timeout: 20000 });
      await child.getByTestId('signup-class-9').click();
      await child.getByTestId('signup-class-next').click();
      await child.locator(`${CARD}[data-signup-step="parent"], ${CARD}[data-signup-step="parent-wait"]`).first().waitFor({ timeout: 20000 });
      await check('after a reload mid-onboarding the same email comes back to the parent step: one account, nothing opened',
        accountsFor(platform, childEmail) === 1 && await child.locator('.shell').count() === 0);
      await child.locator('#signup-parent-name').fill('Meera');
      await child.locator('#signup-parent-destination').fill(parentEmail);
      await child.getByTestId('signup-parent-send').click();
      await child.locator(`${CARD}[data-signup-step="parent-wait"]`).waitFor({ timeout: 20000 });

      const approval = await approveAsParent(ctx, base, platform, parentEmail, 'Ravi Child');
      await check('the parent read the notice before the code could be entered, and held no child session', approval.noticeFirst && approval.noChildSession);
      await child.locator('.shell').waitFor({ timeout: 60000 });
      await check('the child\'s waiting screen noticed the approval by itself and the app opened',
        new URL(child.url()).pathname === '/practice' && await child.locator(`${GATE}, ${CARD}`).count() === 0);
      const given = consentRow(platform, minor.id);
      await check('the approval is on the server, by the guardian\'s own code', given?.confirmed_at > 0 && /^guardian-/.test(given?.method || ''), JSON.stringify(given));
      await child.reload({ waitUntil: 'domcontentloaded' });
      await child.locator('.shell').waitFor({ timeout: 30000 });
      await check('an approved minor reopens the app without a second sign-in or guardian step', await child.locator(`${GATE}, ${CARD}`).count() === 0);

      // a guardian's withdrawal relocks the app on the server's say-so
      platform.h.db.prepare('UPDATE guardian_consents SET withdrawn_at=? WHERE account_id=?').run(Date.now(), minor.id);
      // A synthetic event alone does not make a background WebKit tab visible:
      // the app correctly rechecks only while document.visibilityState is visible.
      // Exercise a real foreground transition before requesting the recheck.
      await child.bringToFront();
      await child.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
      await child.locator(`${GATE}[data-activation-status="blocked"]`).waitFor({ timeout: 20000 }).catch(() => {});
      await check('a guardian\'s withdrawal, noticed on the next recheck, closes the app: the "needs attention" screen, nothing to tap around',
        await gateStatus(child) === 'blocked' && await child.locator('.shell').count() === 0 && await child.getByTestId('activation-blocked').isVisible());
    } finally { await childCtx.close(); }

    // ── 3 · a minor behind the gate, on a saved device profile ──────────────
    // The adult's device: the picker offers another profile; the device-profile
    // wizard makes one; the gate then asks for ITS account — a child's.
    await goto('/');
    await page.locator('.shell').waitFor({ timeout: 30000 });
    await page.locator('.user-chip').click();
    await page.getByRole('menuitem', { name: 'Switch profile' }).click();
    await page.locator('.acct-list').waitFor({ timeout: 15000 });
    await check('the saved adult profile is listed, and the picker offers another Pri account', await page.locator('.acct-row').count() === 1 && await page.getByTestId('picker-create-account').isVisible());
    await page.getByRole('button', { name: /Add another profile/i }).click();
    await page.waitForSelector('[data-onboarding-step="1"]', { timeout: 15000 });
    await page.getByRole('button', { name: 'Student', exact: true }).click();
    await page.locator('.auth-card .btn-primary').click();
    await page.waitForSelector('[data-onboarding-step="2"]', { timeout: 15000 });
    await page.locator('#signup-track').selectOption('8');
    await page.locator('.auth-card .btn-primary').click();
    await page.waitForSelector('[data-onboarding-step="3"]', { timeout: 15000 });
    await page.locator('#signup-name').fill('Kabir Child');
    await page.locator('.auth-card .btn-primary').click();
    await page.waitForSelector('[data-onboarding-step="4"]', { timeout: 15000 });
    await page.locator('.auth-card .btn-primary').click();
    await page.waitForSelector('[data-onboarding-step="5"]', { timeout: 15000 });
    await page.locator('.auth-card .btn-primary').click();
    await page.locator(GATE).waitFor({ timeout: 30000 });
    // The gate is up while it asks; 'signin' is its answer.
    await page.locator(`${GATE}[data-activation-status="signin"]`).waitFor({ timeout: 15000 }).catch(() => {});
    await check('a device profile with no account meets the gate\'s sign-in, not Home',
      await gateStatus(page) === 'signin' && await page.locator('.shell, .home-greet').count() === 0);
    const kabirEmail = freshEmail('kabir');
    const kabirParent = freshEmail('kabir-parent');
    await signInOnCard(page.locator(`${GATE} ${INLINE}`), platform, { email: kabirEmail, age: 14 });
    await page.locator(`${GATE} ${INLINE}[data-signup-step="parent"]`).waitFor({ timeout: 20000 });
    await page.locator('#signup-parent-name').fill('Nikhil');
    await page.locator('#signup-parent-destination').fill(kabirParent);
    await page.getByTestId('signup-parent-send').click();
    await page.locator(`${GATE} ${INLINE}[data-signup-step="parent-wait"]`).waitFor({ timeout: 20000 });
    const kabir = accountRow(platform, kabirEmail);
    await check('the child\'s account is made and limited; the device profile is still outside the gate, on the waiting step',
      kabir && consentRow(platform, kabir.id)?.confirmed_at === null && await page.locator('.shell').count() === 0 && await page.getByTestId('signup-parent-waiting').isVisible());
    await check('the waiting step offers resend and "check approval", and nothing that enters',
      await page.getByTestId('signup-parent-resend').count() === 1 && await page.getByTestId('signup-parent-check').count() === 1 &&
        await page.locator('[data-testid="signup-parent-later"], [data-testid="signup-parent-continue"], .shell').count() === 0);
    for (const link of DEEP_LINKS) {
      await page.goto(`${base}${link}`, { waitUntil: 'domcontentloaded' });
      await page.locator(GATE).waitFor({ timeout: 20000 });
      await check(`a child's device profile, deep-linked to ${link.split('?')[0]}, sees only the gate`, await page.locator('.shell, .q-prompt').count() === 0);
    }
    // After a reload the gate asks for the profile's account again; the same
    // email comes straight back to the parent step — one account, still outside.
    await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
    await page.locator(`${GATE} ${INLINE}`).waitFor({ timeout: 30000 });
    await signInOnCard(page.locator(`${GATE} ${INLINE}`), platform, { email: kabirEmail });
    await page.locator(`${GATE} ${INLINE}[data-signup-step="parent"], ${GATE} ${INLINE}[data-signup-step="parent-wait"]`).first().waitFor({ timeout: 30000 });
    await check('signed in again as the pending child, the gate\'s card is back at the parent step: one account, nothing opened',
      accountsFor(platform, kabirEmail) === 1 && await page.locator('.shell').count() === 0 && await gateStatus(page) === 'signin');
    if (await page.locator(`${GATE} ${INLINE}[data-signup-step="parent"]`).count()) {
      await page.locator('#signup-parent-name').fill('Nikhil');
      await page.locator('#signup-parent-destination').fill(kabirParent);
      await page.getByTestId('signup-parent-send').click();
      await page.locator(`${GATE} ${INLINE}[data-signup-step="parent-wait"]`).waitFor({ timeout: 20000 });
    }
    await approveAsParent(ctx, base, platform, kabirParent, 'Kabir Child');
    await page.locator('.shell').waitFor({ timeout: 60000 });
    await check('the gate noticed the guardian\'s approval on the server and let the child in', await page.locator(GATE).count() === 0 && consentRow(platform, kabir.id)?.confirmed_at > 0);

    // ── 4 · signed out on a saved device: deep link, revoked session, a 503 ──
    await page.locator('.user-chip').click();
    await page.getByRole('menuitem', { name: 'Switch profile' }).click();
    await page.locator('.acct-list').waitFor({ timeout: 15000 });
    await page.locator('.acct-row', { hasText: 'Asha Adult' }).click();
    await page.locator(GATE).waitFor({ timeout: 20000 });
    // The device's live session is the child's. Asha's profile is linked to
    // HER account, so the server's answer is a mismatch: nothing of hers opens
    // on another account's session — she signs in as herself. The gate is up
    // before the server's answer is; give the answer time to arrive.
    await page.waitForFunction(sel => /not this profile’s/.test(document.querySelector(sel)?.innerText || ''), GATE, { timeout: 15000 }).catch(() => {});
    await check('choosing the adult\'s saved profile while another account\'s session is live is refused as a mismatch: the gate, not her Home',
      await gateStatus(page) === 'signin' && /not this profile’s/.test(await page.locator(GATE).innerText()) && await page.locator('.shell').count() === 0,
      (await page.locator(GATE).innerText()).slice(0, 160));
    await signInOnCard(page.locator(`${GATE} ${INLINE}`), platform, { email: adultEmail });
    await page.locator('.shell').waitFor({ timeout: 60000 });
    await check('signed in as herself, her saved profile opens: her account is live and the server lets it in',
      await page.locator(GATE).count() === 0 && await meStatus(page) === 200 && accountsFor(platform, adultEmail) === 1);
    await page.goto(`${base}/progress`, { waitUntil: 'domcontentloaded' });
    await page.locator('.shell').waitFor({ timeout: 30000 });
    await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.locator('.shell').waitFor({ timeout: 30000 });
    await check('the back button moves between routes inside the app, with no gate in between', await page.locator(GATE).count() === 0);

    // the server ends the session (revoked elsewhere): a deep link is the gate
    const ended = endSessions(platform, adult.id);
    await page.goto(`${base}/practice?subtopic=c10-polynomials`, { waitUntil: 'domcontentloaded' });
    await page.locator(`${GATE}[data-activation-status="signin"]`).waitFor({ timeout: 30000 }).catch(() => {});
    await check('with the session revoked on the server, a deep link opens the gate\'s sign-in — the page itself never shows',
      ended >= 1 && await gateStatus(page) === 'signin' && await page.locator('.shell').count() === 0 && /You’ve been signed out/.test(await page.locator(GATE).innerText()));
    await signInOnCard(page.locator(`${GATE} ${INLINE}`), platform, { email: adultEmail });
    await page.locator('.shell').waitFor({ timeout: 60000 });
    await check('signing in again on the gate lands on the deep-linked route', new URL(page.url()).pathname === '/practice' && await page.locator(GATE).count() === 0);

    // a 503 on the recheck never ejects; a revoked session, noticed, does
    await page.locator('.q-prompt').waitFor({ timeout: 30000 });
    // The 503 is scripted at the network in Chromium. In WebKit, Playwright
    // does not intercept requests from a page a service worker controls (this
    // one is: the worker passes /v1/ through, but the request still leaves
    // from the worker's side), so there the same 503 is answered by the
    // page's fetch — the very call cloudTransport makes — for the same path.
    let outages = 0;
    const outage = route => { outages++; return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 'SERVICE_UNAVAILABLE', message: 'scripted outage' } }) }); };
    const scriptInPage = browserName === 'webkit';
    if (scriptInPage) {
      await page.evaluate(() => {
        window.__outages = 0;
        window.__realFetch = window.fetch;
        window.fetch = (input, init) => {
          const url = new URL(typeof input === 'string' ? input : input.url, location.href);
          if (url.pathname === '/v1/account/me') {
            window.__outages++;
            return Promise.resolve(new Response(JSON.stringify({ error: { code: 'SERVICE_UNAVAILABLE', message: 'scripted outage' } }), { status: 503, headers: { 'content-type': 'application/json' } }));
          }
          return window.__realFetch(input, init);
        };
      });
    } else {
      await page.route('**/v1/account/me', outage);
    }
    await page.evaluate(() => { window.__gateShell = document.querySelector('.shell'); document.dispatchEvent(new Event('visibilitychange')); });
    await settle(); await settle();
    if (scriptInPage) outages = await page.evaluate(() => window.__outages);
    await check('a 503 while rechecking in the foreground keeps the student inside, the same shell mounted',
      outages >= 1 && await page.evaluate(() => document.querySelector('.shell') === window.__gateShell) && await page.locator(GATE).count() === 0, `${outages} refused /me calls`);
    if (scriptInPage) await page.evaluate(() => { window.fetch = window.__realFetch; });
    else await page.unroute('**/v1/account/me', outage);
    endSessions(platform, adult.id);
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.locator(`${GATE}[data-activation-status="signin"]`).waitFor({ timeout: 20000 }).catch(() => {});
    await check('the server\'s own refusal (401: session gone), noticed in the foreground, relocks the gate', await gateStatus(page) === 'signin' && await page.locator('.shell').count() === 0);
    await signInOnCard(page.locator(`${GATE} ${INLINE}`), platform, { email: adultEmail });
    await page.locator('.shell').waitFor({ timeout: 60000 });

    // ── 5 · opened offline: the 72-hour grace ───────────────────────────────
    // A device the server let in, as this account, under 72 hours ago opens
    // offline into the app with its own work and History; nothing is checked
    // until the connection returns and the server is asked again. Past 72
    // hours, or after any refusal the server gave, it is the gate's retry.
    const offlineReload = async (p, c) => {
      await c.setOffline(true);
      // Marks this document, so a reload that never happened cannot be read
      // as the app's answer: the old shell would still be on screen.
      await p.evaluate(() => { window.__beforeOfflineReload = true; });
      await p.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
      return !(await p.evaluate(() => window.__beforeOfflineReload === true).catch(() => false));
    };
    const backOnline = async (p, c) => { await c.setOffline(false); await p.evaluate(() => window.dispatchEvent(new Event('online'))); };
    const inApp = (p, path) => p.evaluate(to => { history.pushState({}, '', to); dispatchEvent(new PopStateEvent('popstate')); }, path);
    const OFFLINE_LINE = '[data-testid="offline-entry"]';
    await goto('/');
    await page.locator('.shell').waitFor({ timeout: 30000 });
    const claimed = await workerInCharge(page);
    if (await check('the service worker is in charge of the page and holds the whole offline build, so an offline open can paint anything at all', claimed)) {
      const reloaded = await offlineReload(page, ctx);
      if (!reloaded && browserName === 'webkit') {
        // Playwright's offline emulation in WebKit fails the service worker's
        // navigation ("WebKit encountered an internal error"): no offline
        // document is ever loaded, so the offline open is not exercised in
        // this engine. Said, not passed; Chromium runs it.
        note('offline open: NOT exercised in WebKit — Playwright\'s offline emulation fails the service-worker navigation, so the page never reloaded');
        // The connection's return makes the shell ask the server again; let
        // that answer land before the page is closed under it.
        const asked = page.waitForResponse(r => r.url().includes('/v1/account/me'), { timeout: 15000 }).catch(() => null);
        await ctx.setOffline(false);
        await asked;
      } else {
      // 5a · under 72 hours: inside, with the offline line, History from the device
      await page.locator(`.shell, ${GATE}`).first().waitFor({ timeout: 30000 }).catch(() => {});
      await page.locator(OFFLINE_LINE).waitFor({ timeout: 30000 }).catch(() => {});
      await check('opened offline within 72 hours of the server\'s last yes, the same student is inside, told that nothing is checked until they reconnect',
        reloaded && await page.locator('.shell').count() === 1 && await page.locator(GATE).count() === 0 &&
          /nothing is checked/.test(await page.locator(OFFLINE_LINE).innerText().catch(() => '')), `gate ${await gateStatus(page)}`);
      await inApp(page, '/review');
      await page.waitForFunction(() => { const m = document.querySelector('main#main'); return m && m.innerText.trim() && !/^Loading/.test(m.innerText.trim()); }, null, { timeout: 30000 }).catch(() => {});
      const historyText = (await page.locator('main#main').innerText().catch(() => '')).trim();
      await check('History opens offline, from the device', new URL(page.url()).pathname === '/review' &&
        await page.locator('.shell').count() === 1 && historyText.length > 0 && !/^Loading/.test(historyText), historyText.slice(0, 120));
      await backOnline(page, ctx);
      await page.waitForFunction(sel => !document.querySelector(sel), OFFLINE_LINE, { timeout: 60000 }).catch(() => {});
      await check('back online, the server answers again: the offline line goes and the same student stays inside, with no sign-in asked for',
        await page.locator(OFFLINE_LINE).count() === 0 && await page.locator('.shell').count() === 1 && await page.locator(GATE).count() === 0 && await meStatus(page) === 200);

      // 5b · a guardian withdraws while the child's device is offline
      await page.locator('.user-chip').click();
      await page.getByRole('menuitem', { name: 'Switch profile' }).click();
      await page.locator('.acct-row', { hasText: 'Kabir Child' }).waitFor({ timeout: 15000 });
      await page.locator('.acct-row', { hasText: 'Kabir Child' }).click();
      // One session per device: the adult's is live, so the child's profile
      // asks for its own account on the gate's card first.
      await page.locator(`${GATE} ${INLINE}`).waitFor({ timeout: 30000 }).catch(() => {});
      if (await page.locator(`${GATE} ${INLINE}`).count()) await signInOnCard(page.locator(`${GATE} ${INLINE}`), platform, { email: kabirEmail });
      await page.locator('.shell').waitFor({ timeout: 60000 }).catch(() => {});
      await check('the approved child\'s saved profile, signed in as the child, is let in online', await page.locator('.shell').count() === 1 && await page.locator(GATE).count() === 0);
      const childReloaded = await offlineReload(page, ctx);
      await page.locator(OFFLINE_LINE).waitFor({ timeout: 30000 }).catch(() => {});
      await check('opened offline inside the grace, the child is inside on the device\'s last server answer',
        childReloaded && await page.locator('.shell').count() === 1 && await page.locator(OFFLINE_LINE).count() === 1);
      platform.h.db.prepare('UPDATE guardian_consents SET withdrawn_at=? WHERE account_id=?').run(Date.now(), kabir.id);
      await backOnline(page, ctx);
      await page.locator(`${GATE}[data-activation-status="blocked"]`).waitFor({ timeout: 60000 }).catch(() => {});
      await check('the guardian withdrew while the device was offline; the moment the connection returns the server is asked, and the app closes on its refusal',
        await gateStatus(page) === 'blocked' && await page.locator('.shell').count() === 0);
      const afterWithdrawal = await offlineReload(page, ctx);
      await page.locator(GATE).waitFor({ timeout: 30000 }).catch(() => {});
      await page.locator(`${GATE}[data-activation-status="retry"]`).waitFor({ timeout: 30000 }).catch(() => {});
      await check('opened offline after that refusal there is no grace: the gate\'s retry, not the shell',
        afterWithdrawal && await page.locator('.shell').count() === 0 && await gateStatus(page) === 'retry', `status ${await gateStatus(page)}`);
      await ctx.setOffline(false);

      // 5c · past 72 hours: the gate's retry; the connection's return lets them in
      const staleCtx = await ctx.browser().newContext({ viewport: { width: 1180, height: 820 }, reducedMotion: 'reduce' });
      try {
        await staleCtx.clock.install({ time: new Date() });
        const stale = await staleCtx.newPage();
        await stale.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
        await createVerifiedProfile(stale, platform, { name: 'Ravi Stale', year: 10, email: freshEmail('stale'), note });
        await stale.locator('.shell').waitFor({ timeout: 60000 });
        if (await check('a second adult\'s device is inside, with the service worker in charge', await workerInCharge(stale))) {
          await staleCtx.clock.setSystemTime(new Date(Date.now() + 73 * 60 * 60 * 1000));
          const staleReloaded = await offlineReload(stale, staleCtx);
          await stale.locator(GATE).waitFor({ timeout: 30000 }).catch(() => {});
          await stale.locator(`${GATE}[data-activation-status="retry"]`).waitFor({ timeout: 30000 }).catch(() => {});
          await check('opened offline 73 hours after the server\'s last yes, it is the gate\'s retry — the server could not confirm anything, and nothing is lost',
            staleReloaded && await stale.locator('.shell').count() === 0 && await stale.locator(GATE).getAttribute('data-activation-status') === 'retry' &&
              /can’t be reached|isn’t answering/.test(await stale.locator(GATE).innerText()) && await stale.getByTestId('activation-retry-button').isVisible());
          await backOnline(stale, staleCtx);
          await stale.locator('.shell').waitFor({ timeout: 60000 }).catch(() => {});
          if (!(await stale.locator('.shell').count())) { await stale.getByTestId('activation-retry-button').click().catch(() => {}); await stale.locator('.shell').waitFor({ timeout: 60000 }).catch(() => {}); }
          await check('back online, the gate asks again and the same student is inside, with no offline line and no sign-in asked for',
            await stale.locator('.shell').count() === 1 && await stale.locator(OFFLINE_LINE).count() === 0 && await meStatus(stale) === 200);
        }
      } finally { await staleCtx.close(); }
      }
    }
    await check('throughout, one account per address: nothing was duplicated', accountsFor(platform, adultEmail) === 1 && accountsFor(platform, kabirEmail) === 1);
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
