// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · E2E journeys — the one sign-in card.
//
//   email → Continue with email → six-digit code IN THE SAME CARD → signed in,
//   or → a new account, made and verified by that code → class → practice.
//
// WHAT IS REAL HERE
//   · the built client in a browser, driven through its own controls;
//   · the real platform server (server/app.js, in this process) on its own
//     SQLite file, serving this build from its own origin: accounts, one-time
//     codes, sessions and cookies, the guardian gate, practice issue / read /
//     grade. The page reaches /v1 exactly as a deployed page does.
//
// WHAT IS SYNTHETIC — and said so in this suite's output
//   · EMAIL DELIVERY. The server's TEST mail adapter keeps each message in
//     memory and sends nothing. The test reads the code there, the way a
//     mailbox would receive it. Nothing here is evidence that a real provider
//     delivered a real message to a real inbox, or about how long that takes.
//   · the handwriting READER (the provider hop) is a scripted stand-in that
//     never looks at the picture. Its request counter is what proves a sign-in
//     triggers no paid read; it is not evidence about real recognition.
//   · time. Code expiry and the resend countdown are advanced with the page's
//     clock (and the server's cooldown row cleared at the test's desk) rather
//     than waited out. The server's own expiry is proved in the server suites.
//
// Runs in Chromium and, with --browser=webkit, in WebKit.
// Run on its own:  node client/test/tour-sign-in-card.js [--no-build] [--browser=webkit]
// ─────────────────────────────────────────────────────────────────────────────
import { pathToFileURL } from 'node:url';
import { handwrite } from './fakeServerReader.js';

const EVIDENCE = 'TEST-MAIL-SINK EVIDENCE';
const PHONE = { width: 390, height: 844 };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
const MAX_SKIPS = 14;
let serial = 0;
const address = tag => `card.${tag}.${process.pid}.${++serial}.${Date.now().toString(36)}@example.test`;

// ── the test's desk ──────────────────────────────────────────────────────────
/** The newest message the test mail sink holds for an address. */
const mail = (online, to, purpose = null) => online.sms.readTestOutbox({ to: to.toLowerCase(), channel: 'email' })
  .filter(m => !purpose || m.purpose === purpose).at(-1) || null;
const mailCount = (online, to) => online.sms.readTestOutbox({ to: to.toLowerCase(), channel: 'email' }).length;
const db = online => online.platform.h.db;
const accountByEmail = (online, email) => db(online).prepare('SELECT id, email, name, password_hash, email_verified_at, age_basis FROM accounts WHERE email = ? AND deleted_at IS NULL').get(email.toLowerCase()) || null;
const accountCount = online => Number(db(online).prepare('SELECT COUNT(*) AS n FROM accounts').get().n);
const liveSessions = (online, accountId) => Number(db(online).prepare('SELECT COUNT(*) AS n FROM account_sessions WHERE account_id = ? AND revoked_at IS NULL AND expires_at > ?').get(accountId, Date.now()).n);
/** Every suite student arrives from one loopback address; the per-address and per-mailbox counters are the server suites' subject, not this one's. */
const clearLimits = online => db(online).prepare("DELETE FROM rate_limits WHERE bucket LIKE 'otp-%' OR bucket LIKE 'register%' OR bucket LIKE 'login%'").run();
const clearCooldown = online => db(online).prepare("DELETE FROM rate_limits WHERE bucket LIKE 'otp-cooldown%'").run();
const wrongOf = code => (code === '000000' ? '111111' : '000000');

// ── the page ─────────────────────────────────────────────────────────────────
const cardOf = scope => scope.locator('[data-signin-card]');
const stepOf = card => card.getAttribute('data-signup-step');
const boxes = card => card.locator('[data-testid="signup-code-box"]');
const boxValues = card => boxes(card).evaluateAll(els => els.map(e => e.value).join(''));
const errorText = async card => (await card.getByTestId('signup-error').count()) ? (await card.getByTestId('signup-error').innerText()).trim() : '';
const calls = (online, path, method = 'POST') => online.calls.filter(c => c.method === method && c.path === path);
const shownId = page => page.locator('.qpage').first().getAttribute('data-question-id');
const meStatus = page => page.evaluate(async () => (await fetch('/v1/account/me', { credentials: 'include', cache: 'no-store' })).status);

async function typeCode(page, card, code) {
  await card.locator('#signup-code-0').focus();
  await page.keyboard.type(code, { delay: 15 });
}

/** Ask for a code for `email` from the card's first step and wait for the code step. */
async function requestCode(card, email) {
  await card.locator('#signup-destination').fill(email);
  await card.getByTestId('signup-send-code').click();
  await card.locator('#signup-code-0').waitFor({ state: 'visible', timeout: 20000 });
}

/** The new-account questions on the card: name, age, agreement. */
async function answerAbout(card, { name = null, age = 18 } = {}) {
  await card.locator('#signup-flow-name').waitFor({ state: 'visible', timeout: 20000 });
  if (name !== null) await card.locator('#signup-flow-name').fill(name);
  await card.getByTestId(`signup-age-${age}`).click();
  await card.getByTestId('signup-agree').check();
  await card.getByTestId('signup-age-next').click();
}

function inkStored(page, questionId) {
  return page.evaluate(qid => new Promise(done => {
    const open = indexedDB.open('pri-learning');
    open.onerror = () => done(null);
    open.onsuccess = () => {
      const idb = open.result;
      let req;
      try { req = idb.transaction('inkDrafts').objectStore('inkDrafts').getAll(); } catch { idb.close(); return done(null); }
      req.onsuccess = () => {
        const row = req.result.find(r => String(r.id || '').endsWith(`:${qid}`));
        idb.close();
        done(row ? { strokes: Array.isArray(row.strokes) ? JSON.stringify(row.strokes) : 'sealed', n: Array.isArray(row.strokes) ? row.strokes.length : null } : null);
      };
      req.onerror = () => { idb.close(); done(null); };
    };
  }), questionId);
}

const inkOnCanvas = page => page.evaluate(() => {
  let inked = 0;
  for (const canvas of document.querySelectorAll('canvas.ink-canvas')) {
    const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 3; i < data.length; i += 4) if (data[i] > 40) inked++;
  }
  return inked;
});

async function openWrittenAPQuestion(page, base, settle) {
  await page.goto(`${base}/practice?subtopic=c10-arithmetic-progressions`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.qpage[data-question-id] .q-prompt', { timeout: 30000 });
  for (let skips = 0; skips <= MAX_SKIPS; skips++) {
    const kind = await page.locator('.qpage').first().getAttribute('data-mode');
    if (kind !== 'mcq' && await page.getByRole('button', { name: 'Answer by handwriting' }).count() &&
        await page.locator('[data-check-unmarkable]').count() === 0) return true;
    const leaving = await shownId(page);
    await page.locator('.ctx-next').click();
    await page.waitForFunction(id => {
      const el = document.querySelector('.qpage[data-question-id]');
      return el && el.getAttribute('data-question-id') !== id && el.querySelector('.q-prompt');
    }, leaving, { timeout: 30000 });
    await settle();
  }
  return false;
}

/** Nothing scrolls sideways and the card's controls are inside the viewport. */
const fitsViewport = page => page.evaluate(() => {
  const wide = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
  const card = document.querySelector('[data-signin-card]');
  const outside = card ? [...card.querySelectorAll('input, button')].filter(el => el.getClientRects().length > 0)
    .filter(el => { const r = el.getBoundingClientRect(); return r.left < -1 || r.right > window.innerWidth + 1; }).length : 0;
  const small = card ? [...card.querySelectorAll('button.btn, input.input, input.otp-box')].filter(el => el.getClientRects().length > 0)
    .filter(el => el.getBoundingClientRect().height < 40).length : 0;
  return { wide, outside, small };
});

// ── 1 · a new student, on the landing screen ─────────────────────────────────

export const newStudentFlow = {
  id: 'card-new-student',
  online: true,
  name: 'Sign-in card · new student: email, code in the same card, account made and verified, class, practice',

  async run({ page, check, goto, note, online, browserName }) {
    note(`${EVIDENCE}: "Sign-in card · new student" [${browserName || 'chromium'}] reads its codes from the server's in-memory test mail adapter; no email was sent. Server, SQLite, OTP, sessions and cookies are real. Not real-mailbox or deployed evidence.`);
    clearLimits(online);
    const email = address('new');
    await goto('/');
    const card = cardOf(page);
    await card.waitFor({ state: 'visible', timeout: 30000 });

    await check('the landing screen is the card: "Welcome to Pri Learning" / "Your mathematics journey starts here."',
      (await page.locator('h1.hero-title').innerText()).trim() === 'Welcome to Pri Learning'
        && (await page.locator('.hero-sub').innerText()).trim() === 'Your mathematics journey starts here.');
    await check('one email field with a real label, and one primary action: "Continue with email"',
      await page.getByLabel('Email address').count() === 1
        && await card.locator('#signup-destination').getAttribute('type') === 'email'
        && await card.locator('#signup-destination').getAttribute('autocomplete') === 'email'
        && (await card.getByTestId('signup-send-code').innerText()).trim() === 'Continue with email');
    const offered = await page.evaluate(async () => (await (await fetch('/v1/account/identity/providers')).json()).providers);
    await check('providers the server does not report configured are not shown (this server reports none): no Google, no Apple button',
      offered.google === null && offered.apple === null && await card.locator('[data-provider]').count() === 0, JSON.stringify(offered));
    await check('a small "Sign in with password" is there for accounts that have one',
      (await card.getByTestId('signup-use-password').innerText()).trim() === 'Sign in with password');
    await check('there is no "create account" / "sign in" choice to make first, and no password field on the card\'s first step',
      await page.getByRole('button', { name: /create (your )?account/i }).count() === 0 && await card.locator('input[type="password"]').count() === 0);

    // An address that is not one is refused on the page, before any request.
    await card.locator('#signup-destination').fill('not-an-email');
    await card.getByTestId('signup-send-code').click();
    await check('a malformed address is refused in the card with no request sent',
      await errorText(card) === 'Enter a valid email address.' && calls(online, '/v1/account/otp/request').length === 0, await errorText(card));

    // ── keyboard only from here to the code ─────────────────────────────────
    await page.evaluate(() => { window.__PRI_E2E_SAME_PAGE__ = 'kept'; });
    const urlBefore = page.url();
    await card.locator('#signup-destination').fill('');
    await card.locator('#signup-destination').focus();
    await page.keyboard.type(email);
    await page.keyboard.press('Enter');
    await card.locator('#signup-code-0').waitFor({ state: 'visible', timeout: 20000 });
    const sent = mail(online, email);
    await check('Enter in the email field asks for the code; a six-digit code reaches the test mail sink (no real message)',
      /^\d{6}$/.test(sent?.code || '') && sent.purpose === 'sign-in', JSON.stringify(sent && { purpose: sent.purpose }));
    await check('the code step is the SAME card: same URL, same document (no navigation, no reload)',
      page.url() === urlBefore && await page.evaluate(() => window.__PRI_E2E_SAME_PAGE__) === 'kept' && await stepOf(card) === 'code');
    await check('"Check your email — we sent a six-digit code to <email>", and how long it lasts',
      (await card.locator('#signup-step-title').innerText()).trim() === 'Check your email'
        && (await card.locator('#signup-code-lead').innerText()).replace(/\s+/g, ' ').includes(`We sent a six-digit code to ${email}. It works for 10 minutes.`),
      await card.locator('#signup-code-lead').innerText());
    await check('six boxes, each labelled; numeric keypad; the first asks the device for the code from the message',
      await boxes(card).count() === 6
        && await boxes(card).evaluateAll(els => els.every((e, i) => e.getAttribute('aria-label') === `Digit ${i + 1} of 6` && e.getAttribute('inputmode') === 'numeric'))
        && await card.locator('#signup-code-0').getAttribute('autocomplete') === 'one-time-code');
    await check('the caret is already in the first box (keyboard-only: nothing to click)',
      await page.evaluate(() => document.activeElement?.id) === 'signup-code-0');
    await check('"Verify and continue", "Resend code" counting down, and "Change email" are all on the card',
      (await card.getByTestId('signup-verify').innerText()).trim() === 'Verify and continue'
        && await card.getByTestId('signup-resend').isDisabled() && /^Resend code in \d+ s$/.test((await card.getByTestId('signup-resend').innerText()).trim())
        && (await card.getByTestId('signup-change-destination').innerText()).trim() === 'Change email');

    // Natural typing, backspace, arrows.
    await page.keyboard.type('12');
    await check('typing moves forward box to box, and a screen reader is told how far it has got',
      await boxValues(card) === '12' && await page.evaluate(() => document.activeElement?.id) === 'signup-code-2'
        && (await card.getByTestId('signup-code-progress').innerText()).trim() === '2 of 6 digits entered');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    await check('Backspace steps back and clears', await boxValues(card) === '' && await page.evaluate(() => document.activeElement?.id) === 'signup-code-0');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowLeft');
    await check('the arrow keys move between boxes', await page.evaluate(() => document.activeElement?.id) === 'signup-code-0');

    // Too few digits + Enter.
    await page.keyboard.type('123');
    await page.keyboard.press('Enter');
    await check('Enter with three digits says "Enter all six digits" and sends nothing',
      await errorText(card) === 'Enter all six digits of the code.' && calls(online, '/v1/account/otp/verify').length === 0, await errorText(card));
    for (let i = 0; i < 3; i++) await page.keyboard.press('Backspace');

    // A wrong code.
    await page.keyboard.type(wrongOf(sent.code));
    await card.getByTestId('signup-error').waitFor({ timeout: 15000 });
    await check('a wrong code: "That code isn’t right. 4 tries left." in an alert tied to the boxes, boxes cleared, caret back in the first',
      await errorText(card) === 'That code isn’t right. 4 tries left.'
        && await card.getByTestId('signup-error').getAttribute('role') === 'alert'
        && await card.locator('#signup-code-0').getAttribute('aria-describedby') === 'signup-error'
        && await boxValues(card) === '' && await page.evaluate(() => document.activeElement?.id) === 'signup-code-0',
      `${await errorText(card)} | ${await boxValues(card)}`);
    await check('the sixth digit submitted by itself, once', calls(online, '/v1/account/otp/verify').length === 1);

    // Paste the whole code into a middle box.
    const verifiesBefore = calls(online, '/v1/account/otp/verify').length;
    await card.locator('#signup-code-3').focus();
    await page.evaluate(code => {
      const data = new DataTransfer(); data.setData('text', ` ${code.slice(0, 3)} ${code.slice(3)} `);
      document.activeElement.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    }, sent.code);
    await card.locator('#signup-flow-name').waitFor({ state: 'visible', timeout: 20000 });
    await online.settled();
    await check('pasting the code (with spaces) into the FOURTH box fills all six and submits once — one request, no duplicate',
      calls(online, '/v1/account/otp/verify').length === verifiesBefore + 1, `${calls(online, '/v1/account/otp/verify').length - verifiesBefore} request(s)`);
    await check('a new address is asked only what an account needs, still in the same card: name, age, agreement',
      await stepOf(card) === 'age' && page.url() === urlBefore && await page.evaluate(() => window.__PRI_E2E_SAME_PAGE__) === 'kept'
        && await card.locator('input').evaluateAll(els => els.filter(e => e.getClientRects().length > 0).map(e => e.id || e.type).join(',')) === 'signup-flow-name,checkbox');
    await check('no account exists yet: the code proved the mailbox, the answers below make the account',
      accountByEmail(online, email) === null);

    // Each answer is required, and said.
    await card.getByTestId('signup-age-next').click();
    await check('without a name: "Tell us your first name."', await errorText(card) === 'Tell us your first name.', await errorText(card));
    await card.locator('#signup-flow-name').fill('Asha');
    await card.getByTestId('signup-age-next').click();
    await check('without an age: "Choose your age." — silence is never read as an adult', await errorText(card) === 'Choose your age.', await errorText(card));
    await card.getByTestId('signup-age-18').click();
    await card.getByTestId('signup-age-next').click();
    await check('without the box ticked: no account — "Tick the box to agree before your account is created."',
      await errorText(card) === 'Tick the box to agree before your account is created.' && accountByEmail(online, email) === null, await errorText(card));
    await card.getByTestId('signup-agree').check();
    await card.getByTestId('signup-age-next').click();
    await card.getByTestId('signup-class-10').waitFor({ state: 'visible', timeout: 20000 });
    await card.getByTestId('signup-class-10').click();
    await card.getByTestId('signup-class-next').click();
    await page.waitForURL(/\/practice/, { timeout: 30000 });
    await page.waitForSelector('.shell', { timeout: 30000 });
    const account = accountByEmail(online, email);
    await check('the account was made by the code: verified, an adult by declaration, with no password to forget',
      !!account && account.email_verified_at > 0 && account.password_hash === null && account.age_basis === 'adult' && account.name === 'Asha', JSON.stringify(account && { verified: !!account.email_verified_at, basis: account.age_basis }));
    await check('and the student is in practice, signed in: /v1/account/me answers 200',
      new URL(page.url()).pathname === '/practice' && await meStatus(page) === 200);
    await check('the code that made the account cannot be used again',
      (await page.evaluate(async body => (await fetch('/v1/account/otp/verify', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-Pri-CSRF': decodeURIComponent((document.cookie.match(/pri_csrf=([^;]+)/) || [])[1] || '') }, body: JSON.stringify(body) })).status,
        { channel: 'email', destination: email, challengeId: calls(online, '/v1/account/otp/request').at(-1)?.json?.challengeId, code: sent.code })) === 400);

    // ── Settings says it plainly ─────────────────────────────────────────────
    await page.goto(`${online.origin}/settings`, { waitUntil: 'domcontentloaded' });
    const panel = page.locator('section', { has: page.locator('#cloud-account-title') });
    await panel.locator('[data-cloud-fact="account"]').waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForFunction(mailbox => document.querySelector('[data-cloud-fact="account"] .set-v')?.textContent?.includes(mailbox), email, { timeout: 30000 }).catch(() => {});
    const fact = async name => (await panel.locator(`[data-cloud-fact="${name}"] .set-v`).innerText()).trim();
    await check('Settings: "Signed in as <email>", "Class 10 · CBSE", "Free plan"',
      await fact('account') === `Signed in as ${email}` && await fact('study') === 'Class 10 · CBSE' && await fact('plan') === 'Free plan',
      `${await fact('account')} | ${await fact('study')} | ${await fact('plan')}`);
    const syncedAttr = await panel.locator('[data-cloud-fact="progress"]').getAttribute('data-cloud-synced');
    const progress = await fact('progress');
    await check('"Progress synced" is said only when it is true (a completed sync, nothing waiting, no error); otherwise the line says what is',
      (progress === 'Progress synced') === (syncedAttr === 'yes'), `${progress} | synced=${syncedAttr}`);
    const typeRow = (await page.locator('[data-account-type]').innerText()).trim();
    await check('the old contradiction is gone: a signed-in student is not told "no sign-in service"',
      !/no sign-in service/i.test(await page.locator('.content, main, body').first().innerText()) && typeRow === 'Pri account connected to this profile', typeRow);
    await check('sync internals are folded away under "Advanced", closed by default; no staff or second-factor control is shown to a student',
      await panel.locator('[data-cloud-advanced]').evaluate(el => el.tagName === 'DETAILS' && el.open === false)
        && !(await panel.getByText('Local outbox clear').isVisible().catch(() => false))
        && await page.getByText(/authenticator|second factor|content operations/i).count() === 0);
    await check('no claim about encryption is made in the account panel',
      !/encrypt/i.test(await panel.innerText()));

    // ── sign out, on purpose ─────────────────────────────────────────────────
    await panel.locator('[data-cloud-sign-out]').click();
    await cardOf(panel).waitFor({ state: 'visible', timeout: 20000 });
    await check('"Sign out" ends the session on the server and the card is back, in place',
      await meStatus(page) === 401 && liveSessions(online, account.id) === 0 && new URL(page.url()).pathname === '/settings');
  }
};

// ── 2 · a returning student: code, password, and every way a code goes wrong ─

export const returningFlow = {
  id: 'card-returning',
  online: true,
  name: 'Sign-in card · returning student: code for a password account, password option, resend, expiry, change email, offline, slow send, limits',

  async run({ page, ctx, check, goto, note, online, browserName }) {
    note(`${EVIDENCE}: "Sign-in card · returning student" [${browserName || 'chromium'}] — codes from the test mail sink; expiry and the resend countdown advanced with the page clock; the "could not send" case is answered at the network layer (the server's own outage path is proved in server/test/otp-sign-in-check.mjs).`);
    clearLimits(online);
    // This flow holds, cuts and answers requests at the network layer. A
    // service worker's own fetches are outside that layer in WebKit, so the
    // worker is not registered here; every request then leaves the page itself.
    await page.addInitScript(() => { if (navigator.serviceWorker) navigator.serviceWorker.register = () => new Promise(() => {}); });
    await page.clock.install();
    const who = await online.platform.newAccount({ name: 'Returning Student' });
    const accountsBefore = accountCount(online);
    await goto('/');
    const card = cardOf(page);
    await card.waitFor({ state: 'visible', timeout: 30000 });
    await page.evaluate(() => { window.__PRI_E2E_SAME_PAGE__ = 'kept'; });

    // The address already has an account: asking again to "register" would
    // have said EMAIL_EXISTS. The card just sends the code.
    const sendsBefore = calls(online, '/v1/account/otp/request').length;
    // A slow send: the request is held for a moment; a second and third press
    // must not send a second code.
    let release; const held = new Promise(r => { release = r; });
    const slow = async route => { await held; await route.continue(); };
    const toRequest = u => u.pathname === '/v1/account/otp/request';
    await ctx.route(toRequest, slow);
    await card.locator('#signup-destination').fill(who.email);
    await card.getByTestId('signup-send-code').click();
    await page.waitForFunction(() => document.querySelector('[data-testid="signup-send-code"]')?.textContent?.trim() === 'Sending…', null, { timeout: 10000 }).catch(() => {});
    const sendingState = { label: (await card.getByTestId('signup-send-code').innerText()).trim(), disabled: await card.getByTestId('signup-send-code').isDisabled() };
    await card.getByTestId('signup-send-code').click({ force: true }).catch(() => {});
    await card.locator('#signup-destination').press('Enter').catch(() => {});
    release();
    await card.locator('#signup-code-0').waitFor({ state: 'visible', timeout: 20000 });
    await ctx.unroute(toRequest, slow);
    await online.settled();
    await check('a slow send shows "Sending…" on a disabled button, and pressing again does not ask for a second code',
      sendingState.label === 'Sending…' && sendingState.disabled && calls(online, '/v1/account/otp/request').length === sendsBefore + 1 && mailCount(online, who.email) === 1,
      `${JSON.stringify(sendingState)}; ${calls(online, '/v1/account/otp/request').length - sendsBefore} request(s); ${mailCount(online, who.email)} message(s)`);
    const reply = calls(online, '/v1/account/otp/request').at(-1);
    await check('the answer to "send a code" has the same shape for an address WITH an account as for one without: 202, a challenge, no hint',
      reply.status === 202 && Object.keys(reply.json).sort().join() === 'challengeId,channel,expiresInMs,ok,resendAfterMs', JSON.stringify(Object.keys(reply.json || {})));
    const first = mail(online, who.email);

    // ── offline while verifying ──────────────────────────────────────────────
    await online.disconnect();
    await typeCode(page, card, first.code);
    await card.getByTestId('signup-error').waitFor({ timeout: 20000 });
    await check('with the connection cut: "No connection…", the six digits are kept, nothing was spent',
      /^No connection\./.test(await errorText(card)) && await boxValues(card) === first.code && await stepOf(card) === 'code', `${await errorText(card)} | ${await boxValues(card)}`);
    await online.reconnect();

    // ── resend: the earlier code stops working ───────────────────────────────
    await check('"Resend code" is still counting down', await card.getByTestId('signup-resend').isDisabled());
    await page.clock.fastForward(31_000);
    clearCooldown(online);
    await page.waitForFunction(() => document.querySelector('[data-testid="signup-resend"]')?.disabled === false, null, { timeout: 10000 }).catch(() => {});
    await card.getByTestId('signup-resend').click();
    await card.getByTestId('signup-notice').waitFor({ timeout: 20000 });
    const second = mail(online, who.email);
    await check('after the countdown "Resend code" sends a new code and says the earlier one no longer works',
      mailCount(online, who.email) === 2 && second.code !== undefined && /A new code is on its way to .*The earlier code no longer works\./.test((await card.getByTestId('signup-notice').innerText()).trim()),
      await card.getByTestId('signup-notice').innerText().catch(() => ''));
    if (first.code !== second.code) {
      await typeCode(page, card, first.code);
      await card.getByTestId('signup-error').waitFor({ timeout: 15000 });
      await check('the EARLIER code is now refused (a newer code retires it), with the tries left',
        /^That code isn’t right\. \d tries? left\.$/.test(await errorText(card)) && await meStatus(page) === 401, await errorText(card));
    } else {
      await check('the EARLIER code is now refused (a newer code retires it), with the tries left', true);
    }

    // ── change email in the middle ───────────────────────────────────────────
    const other = address('other');
    await card.getByTestId('signup-change-destination').click();
    await check('"Change email" returns to the email field in the same card with the address still in it — nothing to retype',
      await stepOf(card) === 'method' && await card.locator('#signup-destination').inputValue() === who.email
        && await page.evaluate(() => window.__PRI_E2E_SAME_PAGE__) === 'kept');
    await card.locator('#signup-destination').fill(other);
    await card.getByTestId('signup-send-code').click();
    await card.locator('#signup-code-0').waitFor({ state: 'visible', timeout: 20000 });
    await check('a code for the new address is sent and the card names the new address',
      !!mail(online, other) && (await card.locator('#signup-code-lead').innerText()).includes(other));

    // ── asked again too soon ─────────────────────────────────────────────────
    await card.getByTestId('signup-change-destination').click();
    await card.locator('#signup-destination').fill(who.email);
    await card.getByTestId('signup-send-code').click();
    await card.getByTestId('signup-error').waitFor({ timeout: 15000 });
    await online.settled();
    const limited = calls(online, '/v1/account/otp/request').at(-1);
    await check('asking for the same address again inside the cooldown: the server answers 429 and the card says how long to wait',
      limited.status === 429 && limited.json?.error?.code === 'OTP_RATE_LIMITED' && /^Please wait \d+ s before asking for another code\.$/.test(await errorText(card)),
      `${limited.status} ${await errorText(card)}`);

    // ── the send fails ───────────────────────────────────────────────────────
    const outage = route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 'OTP_DELIVERY_FAILED', message: 'The code could not be sent. Try again in a moment.' } }) });
    await ctx.route(toRequest, outage);
    await card.locator('#signup-destination').fill(address('outage'));
    await card.getByTestId('signup-send-code').click();
    await card.getByTestId('signup-error').waitFor({ timeout: 15000 });
    await check('when the code cannot be sent the card says so and stays where it is, with the address kept and the password option still there [network-layer stand-in]',
      await errorText(card) === 'We couldn’t send the code just now. Try again in a moment.' && await stepOf(card) === 'method'
        && await card.getByTestId('signup-use-password').isVisible());
    await ctx.unroute(toRequest, outage);

    // ── an expired code ──────────────────────────────────────────────────────
    clearCooldown(online);
    await card.locator('#signup-destination').fill(who.email);
    await card.getByTestId('signup-send-code').click();
    await card.locator('#signup-code-0').waitFor({ state: 'visible', timeout: 20000 });
    const third = mail(online, who.email);
    await page.clock.fastForward(10 * 60 * 1000 + 2000);
    await card.getByTestId('signup-code-expired').waitFor({ timeout: 10000 }).catch(() => {});
    const verifiesBefore = calls(online, '/v1/account/otp/verify').length;
    await check('ten minutes on, the card says the code has expired and what to do, and "Verify and continue" is off',
      (await card.getByTestId('signup-code-expired').innerText().catch(() => '')).trim() === 'That code has expired. Send a new code to continue.'
        && await card.getByTestId('signup-verify').isDisabled() && !(await card.getByTestId('signup-resend').isDisabled()));
    await typeCode(page, card, third.code);
    await card.getByTestId('signup-error').waitFor({ timeout: 10000 });
    await check('typing the expired code is answered on the page — "That code has expired…" — without a request',
      await errorText(card) === 'That code has expired. Send a new code to continue.' && calls(online, '/v1/account/otp/verify').length === verifiesBefore, await errorText(card));
    clearCooldown(online);
    await card.getByTestId('signup-resend').click();
    await card.getByTestId('signup-notice').waitFor({ timeout: 20000 });
    const fresh = mail(online, who.email);

    // ── the right code: signed in to the account that was already there ──────
    await typeCode(page, card, fresh.code);
    await card.getByTestId('signup-class-10').waitFor({ state: 'visible', timeout: 20000 });
    await check('the code signs in to the EXISTING account: no second account, no name or age asked again — only the class this new device should open',
      accountCount(online) === accountsBefore && await stepOf(card) === 'class' && await card.locator('#signup-flow-name').count() === 0 && await meStatus(page) === 200,
      `${accountCount(online) - accountsBefore} new account(s)`);
    await check('a verified account keeps its password: a code sign-in does not take it away',
      accountByEmail(online, who.email).password_hash !== null);
    await card.getByTestId('signup-class-10').click();
    await card.getByTestId('signup-class-next').click();
    await page.waitForURL(/\/practice/, { timeout: 30000 });
    await page.waitForSelector('.shell', { timeout: 30000 });
    await check('and lands in practice with one live session for that account', liveSessions(online, who.id) === 1);

    // ── the password option, for an account that has one ─────────────────────
    await page.goto(`${online.origin}/settings`, { waitUntil: 'domcontentloaded' });
    const panel = page.locator('section', { has: page.locator('#cloud-account-title') });
    await panel.locator('[data-cloud-sign-out]').click();
    const again = cardOf(panel);
    await again.waitFor({ state: 'visible', timeout: 20000 });
    await again.getByTestId('signup-use-password').click();
    await again.locator('#signup-password-email').fill(who.email);
    await again.locator('#signup-password').fill('definitely-not-the-password');
    await again.getByTestId('signup-password-submit').click();
    await again.getByTestId('signup-error').waitFor({ timeout: 15000 });
    await check('a wrong password: one message that does not say whether the account exists, and the way out — a code by email',
      await errorText(again) === 'That email and password don’t match. Check them, or get a six-digit code by email instead.'
        && await again.getByTestId('signup-use-code').isVisible() && await again.locator('#signup-password-email').inputValue() === who.email, await errorText(again));
    const unknown = address('nobody');
    await again.locator('#signup-password-email').fill(unknown);
    await again.getByTestId('signup-password-submit').click();
    await page.waitForFunction(() => !document.querySelector('[data-testid="signup-password-submit"]')?.disabled, null, { timeout: 15000 }).catch(() => {});
    await online.settled();
    const logins = calls(online, '/v1/account/login');
    await check('an address with NO account gets exactly the same answer and the same words (no enumeration)',
      logins.at(-1).status === 401 && logins.at(-2).status === 401 && JSON.stringify(logins.at(-1).json) === JSON.stringify(logins.at(-2).json)
        && await errorText(again) === 'That email and password don’t match. Check them, or get a six-digit code by email instead.', await errorText(again));
    await again.locator('#signup-password-email').fill(who.email);
    await again.locator('#signup-password').fill(who.password);
    await again.getByTestId('signup-password-submit').click();
    await panel.locator('[data-cloud-fact="account"]').waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForFunction(mailbox => document.querySelector('[data-cloud-fact="account"] .set-v')?.textContent?.includes(mailbox), who.email, { timeout: 30000 }).catch(() => {});
    await check('the right password signs in, in place: "Signed in as <email>"',
      (await panel.locator('[data-cloud-fact="account"] .set-v').innerText()).trim() === `Signed in as ${who.email}` && new URL(page.url()).pathname === '/settings');
  }
};

// ── 3 · inside practice, with ink on the page (phone viewport) ───────────────

export const inlineInkFlow = {
  id: 'card-inline-ink',
  online: true,
  name: 'Sign-in card · inside practice with ink: compact card, same question, same strokes, no navigation, no paid read',

  async run({ page, check, goto, createProfile, mathText, settle, note, online, browserName }) {
    note(`${EVIDENCE} · SYNTHETIC-READER EVIDENCE: "Sign-in card · inside practice with ink" [${browserName || 'chromium'}, 390×844] — the paid-call counter is the scripted reader's request count at the provider hop plus the server's recognise routes; no real provider, handwriting or device.`);
    clearLimits(online);
    const { reader } = online;
    reader.text = '7'; reader.confidence = 0.97; reader.down = false;
    const email = address('ink');
    await goto('/');
    await createProfile({ name: 'Ink Journey', course: 'in', year: 10 });
    await page.setViewportSize(PHONE);
    if (!await check('signed out, India Class 10 practice serves a written-answer question',
      await openWrittenAPQuestion(page, online.origin, settle), `${MAX_SKIPS} questions and none took a written answer`)) return;
    await page.getByRole('button', { name: 'Answer by handwriting' }).click();
    await page.waitForSelector('.ink-canvas-live', { timeout: 30000 });
    const qid = await shownId(page);
    const prompt = await mathText('.q-prompt');
    const box = await page.locator('.ink-canvas-live').boundingBox();
    await handwrite(page, box, '7', { x: 20, y: 24 });
    const recovery = page.locator('[data-ink-account-recovery]');
    await recovery.locator('[data-ink-sign-in]').waitFor({ state: 'visible', timeout: 20000 });
    await page.waitForFunction(() => { const b = document.querySelector('[data-ink-sign-in]'); return b && !b.disabled; }, null, { timeout: 20000 }).catch(() => {});
    const storedBefore = await inkStored(page, qid);
    const inkBefore = await inkOnCanvas(page);
    const readsBefore = reader.requests.length;
    const paidBefore = (await online.practiceCalls(/^\/v1\/(practice\/[^/]+\/recognize|handwriting\/transcribe|working\/|question-photo)/)).length;
    await check('ink is on the page and proven kept in IndexedDB before sign-in is offered',
      !!storedBefore && inkBefore > 0 && await recovery.locator('[data-ink-sign-in]').isEnabled(), JSON.stringify({ stored: !!storedBefore, inkBefore }));
    await page.evaluate(() => { window.__PRI_E2E_SAME_PAGE__ = 'kept'; });
    const urlBefore = page.url();

    await recovery.locator('[data-ink-sign-in]').click();
    const card = cardOf(recovery);
    await card.waitFor({ state: 'visible', timeout: 20000 });
    await check('a compact sign-in card opens INSIDE the question: the same email → code card, no account panel, no password form, no link to Settings',
      await card.getAttribute('data-signin-card') === 'inline' && await card.locator('#signup-destination').isVisible()
        && await page.locator('.qpage #cloud-password, .qpage #signup-password').count() === 0
        && await page.evaluate(() => [...document.querySelectorAll('.qpage a[href$="/settings"]')].filter(el => el.getClientRects().length > 0).length) === 0);
    const fit = await fitsViewport(page);
    await check('at 390px the card fits: no sideways scroll, every control inside the screen and at least 40px tall',
      !fit.wide && fit.outside === 0 && fit.small === 0, JSON.stringify(fit));

    await requestCode(card, email);
    const fitCode = await fitsViewport(page);
    await check('the six code boxes fit a phone too', !fitCode.wide && fitCode.outside === 0 && fitCode.small === 0, JSON.stringify(fitCode));
    const sent = mail(online, email);
    await typeCode(page, card, sent.code);
    await answerAbout(card, { age: 18 });
    await card.waitFor({ state: 'detached', timeout: 30000 });
    await page.locator('[data-ink-read]').waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await online.settled();
    const account = accountByEmail(online, email);
    await check('the new account took its name from this profile and was never asked the class again (the profile already has one)',
      account?.name === 'Ink Journey' && !online.calls.some(c => c.path === '/v1/account/otp/verify' && c.body?.profile && c.body.profile.year !== '10'), JSON.stringify(account && { name: account.name }));
    await check('the card closed by itself; no second sign-in prompt anywhere on the page',
      await page.locator('[data-signin-card]').count() === 0 && await page.locator('[data-ink-sign-in], [data-check-sign-in], [data-photo-sign-in]').count() === 0);
    await check('the student never left: same URL, same document (no navigation, no reload, not sent Home)',
      page.url() === urlBefore && await page.evaluate(() => window.__PRI_E2E_SAME_PAGE__) === 'kept' && new URL(page.url()).pathname === '/practice');
    await check('the SAME question is on screen (same id, same prompt)', await shownId(page) === qid && await mathText('.q-prompt') === prompt);
    const storedAfter = await inkStored(page, qid);
    const inkAfter = await inkOnCanvas(page);
    await check('the strokes are still on the canvas and unchanged in the draft store',
      inkAfter > 0 && Math.abs(inkAfter - inkBefore) <= Math.max(40, inkBefore * 0.05) && !!storedAfter && storedAfter.strokes === storedBefore.strokes,
      `canvas ${inkBefore} → ${inkAfter}; stored equal ${storedAfter?.strokes === storedBefore.strokes}`);
    const paidAfter = (await online.practiceCalls(/^\/v1\/(practice\/[^/]+\/recognize|handwriting\/transcribe|working\/|question-photo)/)).length;
    await check('PAID-CALL COUNTER: signing in triggered ZERO reads — no provider request, no recognise/transcribe call, no transcript',
      reader.requests.length === readsBefore && paidAfter === paidBefore && await page.locator('.ink-line').count() === 0,
      `provider ${reader.requests.length - readsBefore}; server ${paidAfter - paidBefore}`);
    await check('signing in issued and marked nothing either: the question waits for the student\'s own Submit',
      (await online.practiceCalls(/^\/v1\/practice\/(issue|[^/]+\/(?:submit|grade))/)).length === 0);
    await check('"Read my answer" is offered for the kept ink — the read stays the student\'s choice',
      await page.locator('[data-ink-read]').isVisible());

    // The question is still submittable under the server's authority.
    await page.locator('[data-ink-read]').click();
    await page.waitForSelector('.ink-line', { timeout: 30000 }).catch(() => {});
    await check('one press reads it once [SYNTHETIC-READER EVIDENCE]', reader.requests.length === readsBefore + 1 && await page.locator('.ink-line').count() >= 1, `${reader.requests.length - readsBefore} provider request(s)`);
    await page.waitForFunction(() => { const b = document.querySelector('.ws-actions .btn-primary'); return !!b && !b.disabled; }, null, { timeout: 20000 }).catch(() => {});
    await page.locator('.ws-actions .btn-primary').click();
    await page.waitForFunction(() => document.querySelector('.eval-card, .verdict-title'), null, { timeout: 30000 }).catch(() => {});
    await online.settled();
    const issued = await online.practiceCalls(/^\/v1\/practice\/issue$/);
    const graded = await online.practiceCalls(/^\/v1\/practice\/[^/]+\/submit$/);
    await check('the read bound this same prepared question to the new account (one issue) and Submit is then marked by the server (one submit): same question on screen',
      issued.length === 1 && issued[0].status < 300 && graded.length === 1 && graded[0].status === 200 && await shownId(page) === qid,
      `issue ${issued.map(c => c.status)}; grade ${graded.map(c => c.status)}; all ${(await online.practiceCalls(/^\/v1\/practice\//)).map(c => `${c.status} ${c.path.replace(/q_[^/]+|pq_[^/]+/, ':id')}`).join(', ')}`);
    await check('no outbound request was refused: nothing tried to reach a real provider', reader.refused.length === 0, JSON.stringify(reader.refused));
  }
};

// ── 4 · inside practice, with a photo (phone viewport) ───────────────────────

export const inlinePhotoFlow = {
  id: 'card-inline-photo',
  online: true,
  name: 'Sign-in card · inside practice with a photo: same question, same photo, no navigation, no paid read',

  async run({ page, check, goto, createProfile, mathText, settle, note, online, browserName }) {
    note(`${EVIDENCE} · SYNTHETIC-READER EVIDENCE: "Sign-in card · inside practice with a photo" [${browserName || 'chromium'}, 390×844] — a 1×1 test image; the reader is a scripted stand-in.`);
    clearLimits(online);
    const { reader } = online;
    reader.text = '12'; reader.confidence = 0.97; reader.down = false;
    const who = await online.platform.newAccount({ name: 'Photo Returning' });
    await goto('/');
    await createProfile({ name: 'Photo Journey', course: 'in', year: 10 });
    await page.setViewportSize(PHONE);
    if (!await check('signed out, India Class 10 practice serves a written-answer question',
      await openWrittenAPQuestion(page, online.origin, settle), `${MAX_SKIPS} questions and none took a written answer`)) return;
    const qid = await shownId(page);
    const prompt = await mathText('.q-prompt');
    await page.getByRole('button', { name: /answer with a photo/i }).click();
    await page.locator('.editor-body input[type="file"]').setInputFiles({ name: 'working.png', mimeType: 'image/png', buffer: PNG });
    const signIn = page.locator('[data-photo-sign-in]');
    await signIn.waitFor({ state: 'visible', timeout: 20000 });
    await page.waitForFunction(() => document.querySelector('.ws-actions .status-line')?.getAttribute('data-work-state') !== 'saving', null, { timeout: 15000 }).catch(() => {});
    const thumb = await page.locator('.photo-thumb img').getAttribute('src');
    const readsBefore = reader.requests.length;
    await page.evaluate(() => { window.__PRI_E2E_SAME_PAGE__ = 'kept'; });
    const urlBefore = page.url();

    await signIn.click();
    const panel = page.locator('[data-photo-account-recovery]');
    const card = cardOf(panel);
    await card.waitFor({ state: 'visible', timeout: 20000 });
    await check('the same compact card opens beside the photo', await card.getAttribute('data-signin-card') === 'inline' && await page.locator('.qpage #cloud-password').count() === 0);
    // A returning student this time: email → code → done. Nothing else asked.
    await requestCode(card, who.email);
    await typeCode(page, card, mail(online, who.email).code);
    await card.waitFor({ state: 'detached', timeout: 30000 });
    const readPhoto = page.locator('[data-photo-read]');
    await readPhoto.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await online.settled();
    await check('a returning student is asked nothing after the code: no name, no age, no class — the card just closes',
      !online.calls.some(c => c.path === '/v1/account/otp/verify' && c.json?.status === 'profile-required') && await page.locator('[data-signin-card]').count() === 0);
    await check('same URL, same document, same question; not sent Home; no second sign-in prompt',
      page.url() === urlBefore && await page.evaluate(() => window.__PRI_E2E_SAME_PAGE__) === 'kept' && await shownId(page) === qid && await mathText('.q-prompt') === prompt
        && await page.locator('[data-photo-sign-in], [data-check-sign-in], [data-ink-sign-in]').count() === 0);
    await check('the SAME photo is still attached', await page.locator('.photo-thumb img').getAttribute('src') === thumb);
    await check('PAID-CALL COUNTER: signing in triggered ZERO reads of the photo — "Read my photo" is offered, no provider request, no transcript',
      reader.requests.length === readsBefore && await readPhoto.isVisible() && await page.locator('[data-photo-correct-transcript]').count() === 0,
      `${reader.requests.length - readsBefore} provider request(s)`);
    await check('and nothing was issued or marked by signing in', (await online.practiceCalls(/^\/v1\/practice\/(issue|[^/]+\/(?:submit|grade))/)).length === 0);
    await readPhoto.click();
    await page.locator('[data-photo-correct-transcript]').first().waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
    await check('one press then reads it once [SYNTHETIC-READER EVIDENCE]', reader.requests.length === readsBefore + 1, `${reader.requests.length - readsBefore} provider request(s)`);
    await check('no outbound request was refused: nothing tried to reach a real provider', reader.refused.length === 0, JSON.stringify(reader.refused));
  }
};

// ── 5 · sessions: restart, another tab, expiry, sign out everywhere ──────────

export const sessionsFlow = {
  id: 'card-sessions',
  online: true,
  name: 'Sessions · kept across a browser restart, a second tab follows sign-in and sign-out, expiry asks again in place, sign out everywhere',

  async run({ page, ctx, check, goto, createProfile, mathText, settle, note, online, browserName }) {
    note(`${EVIDENCE}: "Sessions" [${browserName || 'chromium'}] — "browser restart" is a NEW browser context opened from the saved cookies and IndexedDB of the first (Playwright storage state); it is not an operating-system process restart of a real browser.`);
    clearLimits(online);
    const email = address('session');
    await goto('/');
    await createProfile({ name: 'Session Student', course: 'in', year: 10 });
    await page.goto(`${online.origin}/settings`, { waitUntil: 'domcontentloaded' });
    const panel = page.locator('section', { has: page.locator('#cloud-account-title') });
    const card = cardOf(panel);
    await card.waitFor({ state: 'visible', timeout: 30000 });

    // A second tab of the same browser, on a question, before anyone signs in.
    const tab = await ctx.newPage();
    await tab.goto(`${online.origin}/practice?subtopic=c10-arithmetic-progressions`, { waitUntil: 'domcontentloaded' });
    await tab.waitForSelector('.qpage[data-question-id] .q-prompt', { timeout: 30000 });
    await tab.locator('[data-check-needs-account]').waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
    const tabQuestion = await tab.locator('.qpage').first().getAttribute('data-question-id');
    await tab.evaluate(() => { window.__PRI_E2E_SAME_PAGE__ = 'tab-kept'; });
    await check('a second tab, signed out, shows "Sign in to check this answer" on its question',
      await tab.locator('[data-check-needs-account]').count() === 1);

    await requestCode(card, email);
    await typeCode(page, card, mail(online, email).code);
    await answerAbout(card, { age: 18 });
    await panel.locator('[data-cloud-fact="account"]').waitFor({ state: 'visible', timeout: 30000 });
    const account = accountByEmail(online, email);

    await tab.waitForFunction(() => !document.querySelector('[data-check-needs-account]'), null, { timeout: 20000 }).catch(() => {});
    await check('signing in here is followed by the other tab without a reload: its notice goes, same question, same document',
      await tab.locator('[data-check-needs-account]').count() === 0 && await tab.locator('.qpage').first().getAttribute('data-question-id') === tabQuestion
        && await tab.evaluate(() => window.__PRI_E2E_SAME_PAGE__) === 'tab-kept');

    // ── the cookie itself ────────────────────────────────────────────────────
    const cookies = await ctx.cookies(online.origin);
    const sessionCookie = cookies.find(c => c.name === 'pri_cloud_session');
    const days = sessionCookie ? (sessionCookie.expires - Date.now() / 1000) / 86400 : 0;
    await check('the session cookie is HttpOnly, SameSite=Lax, and lasts the server\'s 30-day sliding window — not a permanent session, not a tab-only one',
      !!sessionCookie && sessionCookie.httpOnly === true && sessionCookie.sameSite === 'Lax' && days > 29 && days <= 30.01,
      JSON.stringify(sessionCookie && { httpOnly: sessionCookie.httpOnly, sameSite: sessionCookie.sameSite, days: Number(days.toFixed(2)) }));
    await check('the page cannot read it: document.cookie holds no session token',
      !(await page.evaluate(() => document.cookie)).includes('pri_cloud_session'));

    // ── close the browser, open it again ─────────────────────────────────────
    const state = await ctx.storageState({ indexedDB: true });
    const again = await ctx.browser().newContext({ storageState: state, viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
    try {
      const reopened = await again.newPage();
      await reopened.goto(`${online.origin}/settings`, { waitUntil: 'domcontentloaded' });
      const reopenedPanel = reopened.locator('section', { has: reopened.locator('#cloud-account-title') });
      await reopenedPanel.locator('[data-cloud-fact="account"]').waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
      await reopened.waitForFunction(mailbox => document.querySelector('[data-cloud-fact="account"] .set-v')?.textContent?.includes(mailbox), email, { timeout: 30000 }).catch(() => {});
      await check('after the browser is closed and reopened the student is still signed in — no code asked again [new context from saved state]',
        (await reopenedPanel.locator('[data-cloud-fact="account"] .set-v').innerText().catch(() => '')).trim() === `Signed in as ${email}`
          && await reopenedPanel.locator('[data-signin-card]').count() === 0 && await meStatus(reopened) === 200);
    } finally { await again.close(); }

    // ── the session ends while the student is working ────────────────────────
    await tab.bringToFront();
    const answerBox = tab.locator('.editor-body input.answer-input').first();
    const typeTab = tab.getByRole('button', { name: 'Answer by typing' });
    if (await typeTab.count()) await typeTab.click();
    let typedHere = false;
    if (await answerBox.count()) { await answerBox.fill('41'); typedHere = true; }
    const revoked = db(online).prepare('UPDATE account_sessions SET revoked_at = ? WHERE account_id = ? AND revoked_at IS NULL').run(Date.now(), account.id);
    await check('the server revokes the session (as an expiry or "sign out everywhere" elsewhere does)', Number(revoked.changes) >= 1 && await meStatus(tab) === 401);
    if (typedHere) {
      await tab.waitForFunction(() => { const b = document.querySelector('.ws-actions .btn-primary'); return !!b && !b.disabled; }, null, { timeout: 15000 }).catch(() => {});
      await tab.locator('.ws-actions .btn-primary').click();
      await tab.locator('[data-check-refusal="sign-in"], [data-check-session-ended]').first().waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
      await check('Submit with the session gone: NOT CHECKED and "sign in again", in place — no blank screen, no wrong-answer verdict, the typed answer still in its box',
        await tab.locator('[data-check-session-ended]').count() === 1 && await tab.locator('.eval-card[data-outcome]').count() === 0
          && await answerBox.inputValue() === '41' && await tab.locator('.qpage').first().getAttribute('data-question-id') === tabQuestion
          && await tab.evaluate(() => window.__PRI_E2E_SAME_PAGE__) === 'tab-kept');
      await tab.locator('[data-check-session-ended] [data-check-sign-in]').click();
      const reauth = cardOf(tab.locator('.qpage'));
      await reauth.waitFor({ state: 'visible', timeout: 20000 });
      // A linked profile signing in again may not become a second account.
      const stranger = address('stranger');
      const before = accountCount(online);
      clearCooldown(online);
      await requestCode(reauth, stranger);
      await typeCode(tab, reauth, mail(online, stranger).code);
      await reauth.getByTestId('signup-error').waitFor({ timeout: 20000 });
      await check('signing in again with an address that has NO account does not create one beside this profile: it is said, and the card stays',
        accountCount(online) === before && /^No Pri account uses that email\./.test(await errorText(reauth)) && await meStatus(tab) === 401, await errorText(reauth));
      clearCooldown(online);
      await requestCode(reauth, email);
      await typeCode(tab, reauth, mail(online, email).code);
      await reauth.waitFor({ state: 'detached', timeout: 30000 });
      await check('signing in again with the account\'s own email: the card closes, the answer is still there, same question, nothing was submitted by itself',
        await answerBox.inputValue() === '41' && await tab.locator('.qpage').first().getAttribute('data-question-id') === tabQuestion
          && await tab.evaluate(() => window.__PRI_E2E_SAME_PAGE__) === 'tab-kept' && await meStatus(tab) === 200
          && (await online.practiceCalls(/^\/v1\/practice\/[^/]+\/submit$/)).filter(c => c.status === 200).length === 0);
    } else {
      await check('a typed-answer question was available for the expiry journey', false, 'the served question took no typed answer');
    }

    // ── sign out everywhere ──────────────────────────────────────────────────
    await page.bringToFront();
    await page.goto(`${online.origin}/settings`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('cloud-sign-out-everywhere').waitFor({ state: 'visible', timeout: 30000 });
    // A second device's session, made at the desk with a code.
    clearCooldown(online);
    const jar = {};
    const asked = await online.platform.h.request('/v1/account/otp/request', { method: 'POST', jar, body: { channel: 'email', destination: email } });
    await online.platform.h.request('/v1/account/otp/verify', { method: 'POST', jar, body: { channel: 'email', destination: email, challengeId: asked.data.challengeId, code: mail(online, email).code, deviceId: 'e2e-second-device' } });
    const live = liveSessions(online, account.id);
    await page.getByTestId('cloud-sign-out-everywhere').click();
    await cardOf(page.locator('section', { has: page.locator('#cloud-account-title') })).waitFor({ state: 'visible', timeout: 30000 });
    const other = await online.platform.h.request('/v1/account/me', { jar });
    await check('"Sign out everywhere" revokes every session of the account — this device, the other tab and the second device',
      live >= 2 && liveSessions(online, account.id) === 0 && await meStatus(page) === 401 && other.status === 401, `${live} live before; ${liveSessions(online, account.id)} after; other device ${other.status}`);
    await tab.waitForFunction(() => !!document.querySelector('[data-check-needs-account], [data-check-session-ended], [data-check-sign-in]'), null, { timeout: 20000 }).catch(() => {});
    await check('the other tab learns it without a reload and offers sign-in again beside the same work',
      await tab.locator('[data-check-sign-in]').count() >= 1 && await tab.locator('.qpage').first().getAttribute('data-question-id') === tabQuestion
        && (!typedHere || await answerBox.inputValue() === '41'));
    await tab.close();
  }
};

// ── 6 · under 18: the guardian, explained where it matters ───────────────────

export const minorFlow = {
  id: 'card-minor',
  online: true,
  name: 'Sign-in card · under 18: a parent is asked in the card, the account stays limited until they approve on their own page',

  async run({ page, ctx, check, goto, note, online, browserName }) {
    note(`${EVIDENCE}: "Sign-in card · under 18" [${browserName || 'chromium'}] — the parent's code is read from the test mail sink; no guardian, child or real mailbox is involved. This is software behaviour, not evidence of a real parent's consent.`);
    clearLimits(online);
    const email = address('minor');
    const parent = address('parent');
    await goto('/');
    const card = cardOf(page);
    await card.waitFor({ state: 'visible', timeout: 30000 });
    await requestCode(card, email);
    await typeCode(page, card, mail(online, email).code);
    await card.locator('#signup-flow-name').waitFor({ state: 'visible', timeout: 20000 });
    await check('the age question says, before it is answered, what being under 18 means here',
      /a parent or guardian approves your account before answers can be checked or anything syncs/.test(await card.innerText()));
    await answerAbout(card, { name: 'Ravi', age: 15 });
    await card.getByTestId('signup-class-10').waitFor({ state: 'visible', timeout: 20000 });
    await card.getByTestId('signup-class-10').click();
    await card.getByTestId('signup-class-next').click();
    await card.locator('#signup-parent-name').waitFor({ state: 'visible', timeout: 20000 });
    const account = accountByEmail(online, email);
    const consent = () => db(online).prepare('SELECT method, confirmed_at, withdrawn_at, guardian_email FROM guardian_consents WHERE account_id = ?').get(account.id);
    await check('a 15-year-old\'s account is created LIMITED: a pending consent row in the same transaction, nothing confirmed',
      account?.age_basis === 'child' && consent() && consent().confirmed_at === null, JSON.stringify(consent()));
    await check('the parent step explains, in the card, why a guardian is needed and what works meanwhile',
      (await card.locator('#signup-step-title').innerText()).trim() === 'Now, a parent’s approval'
        && /Because you are under 18, a parent or guardian approves your account\. Until they do, you can read questions, write and keep drafts on this device, but answers cannot be checked and nothing syncs\./.test(await card.innerText()));
    const gate = await page.evaluate(async () => {
      const csrf = decodeURIComponent((document.cookie.match(/pri_csrf=([^;]+)/) || [])[1] || '');
      const r = await fetch('/v1/sync/pull', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-Pri-CSRF': csrf }, body: '{}' });
      return { status: r.status, code: (await r.json().catch(() => ({})))?.error?.code || null };
    });
    await check('until a parent approves the server refuses the gated routes for this session (403 GUARDIAN_CONSENT_REQUIRED)',
      gate.status === 403 && /GUARDIAN/.test(gate.code || ''), JSON.stringify(gate));

    await card.locator('#signup-parent-name').fill('Meera');
    await card.locator('#signup-parent-destination').fill(email);
    await card.getByTestId('signup-parent-send').click();
    await card.getByTestId('signup-error').waitFor({ timeout: 15000 });
    await check('the student\'s own address is refused as the parent\'s', await errorText(card) === 'Use your parent or guardian’s own email or number, not yours.', await errorText(card));
    await card.locator('#signup-parent-destination').fill(parent);
    await card.getByTestId('signup-parent-send').click();
    await card.getByTestId('signup-parent-waiting').waitFor({ state: 'visible', timeout: 20000 });
    const parentMail = mail(online, parent, 'guardian-consent');
    // This harness configures no public origin, so the mail names the parent's
    // page in words; it must never name some other host. (The link's origin
    // rules are proved in server/test/otp-sign-in-check.mjs.)
    await check('the parent\'s mailbox gets the approval code, told to open the parent page themselves — with no link to any other host — and nothing is approved yet',
      /^\d{6}$/.test(parentMail?.code || '') && /read what you are agreeing to/.test(parentMail.body) && !/https?:\/\/(?!127\.0\.0\.1|localhost)/.test(parentMail.body) && consent().confirmed_at === null,
      JSON.stringify(parentMail && { purpose: parentMail.purpose }));
    const childSide = { codeBoxes: await card.locator('input[autocomplete="one-time-code"]').count(), approve: await page.getByRole('button', { name: 'Approve', exact: true }).count(), step: await stepOf(card) };
    await check('the child\'s screen only waits: no code box, no approve button — a child cannot approve their own account',
      childSide.codeBoxes === 0 && childSide.approve === 0 && childSide.step === 'parent-wait', JSON.stringify(childSide));

    const parentCtx = await ctx.browser().newContext({ viewport: PHONE, reducedMotion: 'reduce' });
    try {
      const parentPage = await parentCtx.newPage();
      await parentPage.goto(`${online.origin}/guardian/consent`, { waitUntil: 'domcontentloaded' });
      await parentPage.getByRole('heading', { name: 'What you are agreeing to' }).waitFor({ timeout: 20000 });
      await parentPage.getByRole('radio', { name: 'Email' }).click();
      await parentPage.locator('#guardian-destination').fill(parent);
      await parentPage.getByTestId('guardian-agree').check();
      await parentPage.locator('#guardian-code-0').focus();
      await parentPage.keyboard.type(parentMail.code, { delay: 15 });
      await parentPage.getByTestId('guardian-approve').click();
      await parentPage.getByText('Ravi’s account is approved', { exact: false }).waitFor({ timeout: 15000 });
      await check('the parent approves on their own page, in their own browser, which never holds the child\'s session',
        consent().confirmed_at > 0 && !(await parentCtx.cookies()).some(c => /session/i.test(c.name)), JSON.stringify(consent()));
    } finally { await parentCtx.close(); }

    await page.waitForURL(/\/practice/, { timeout: 30000 });
    await page.waitForSelector('.shell', { timeout: 30000 });
    await check('the child\'s card notices by itself and opens practice; the consent on record is the parent\'s own email code',
      new URL(page.url()).pathname === '/practice' && consent().method === 'guardian-email-otp', JSON.stringify(consent()));
  }
};

export const flows = [newStudentFlow, returningFlow, inlineInkFlow, inlinePhotoFlow, sessionsFlow, minorFlow];

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runFlows } = await import('./e2e.mjs');
  console.log(`${EVIDENCE} — codes in this suite are read from the server's in-memory test mail adapter; no email is sent and no real mailbox is evidenced. The handwriting reader is a scripted stand-in (SYNTHETIC-READER EVIDENCE).`);
  process.exit(await runFlows(flows) ? 1 : 0);
}
