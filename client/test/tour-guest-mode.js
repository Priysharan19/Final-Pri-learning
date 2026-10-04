// Pri Learning · E2E flow — guest mode (ledger 2.3): five questions with no
// account, a visible count, the sixth refused, sign-up by phone code, and the
// five carried into the new profile exactly once.
//
// The guest half talks to no server at all: every /v1 request the browser
// makes is recorded, and there must be none until the visitor starts the
// sign-up. The sign-up half runs against the real platform server
// (server/app.js, in-process, in-memory SQLite) with the SMS and email TEST
// adapters, exactly as tour-otp-onboarding.js does.

import { pathToFileURL } from 'node:url';

const SERVER_ORIGIN_SEEN = 'http://localhost:5173';
const SURELY_WRONG = '-987654';
const SUBMIT = { name: 'Submit Answer' };
const LIMIT = 5;
const MAX_SKIPS = 30;

async function startPlatform() {
  process.env.PRI_AUTH_DELIVERY_KEY = process.env.PRI_AUTH_DELIVERY_KEY || '33'.repeat(32);
  process.env.PRI_SMS_PROVIDER = 'test';
  process.env.PRI_AUTH_EMAIL_PROVIDER = 'test';
  process.env.PRI_PUBLIC_ORIGIN = SERVER_ORIGIN_SEEN;
  const { startApp } = await import('../../server/test/support/app-harness.mjs');
  const sms = await import('../../server/platform/smsProvider.js');
  return { h: await startApp(), sms };
}

/** Rows of one store filed under the current profile, read straight from IndexedDB. */
const ledger = (page, store) => page.evaluate(async (name) => {
  const pid = localStorage.getItem('pri-current-profile');
  const db = await new Promise((resolve, reject) => { const r = indexedDB.open('pri-learning'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
  const rows = await new Promise((resolve, reject) => {
    const r = db.transaction(name).objectStore(name).getAll(); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
  });
  db.close();
  return { pid, mine: rows.filter(row => row.pid === pid).length, total: rows.length, guests: rows.filter(row => row.guest === true).length };
}, store);

export const flow = {
  id: 'guest-mode',
  name: 'Guest · 5 free questions, no server, sign-up carries them over',

  async run({ page, ctx, base, check, goto, shot, settle }) {
    const { h, sms } = await startPlatform();
    try {
      await page.addInitScript(origin => { window.__PRI_CLOUD_ORIGIN__ = origin; }, base);
      await page.addInitScript(() => {
        window.__navLog = [];
        for (const fn of ['pushState', 'replaceState']) {
          const orig = history[fn].bind(history);
          history[fn] = (...args) => { window.__navLog.push(`${fn} ${args[2]} :: ${new Error().stack.split('\n').slice(1, 6).join(' | ')}`); return orig(...args); };
        }
      });
      const seen = [];
      const proxy = async route => {
        const request = route.request();
        const url = new URL(request.url());
        seen.push(`${request.method()} ${url.pathname}`);
        const incoming = request.headers();
        const headers = { Accept: 'application/json', Origin: SERVER_ORIGIN_SEEN };
        for (const name of ['cookie', 'content-type', 'x-pri-csrf', 'x-pri-client', 'x-pri-request-id', 'idempotency-key']) {
          if (incoming[name]) headers[name] = incoming[name];
        }
        const response = await fetch(`${h.origin}${url.pathname}${url.search}`, {
          method: request.method(), headers, body: ['GET', 'HEAD'].includes(request.method()) ? undefined : request.postData() ?? undefined
        });
        const outHeaders = { 'content-type': response.headers.get('content-type') || 'application/json' };
        const cookies = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
        if (cookies.length) outHeaders['set-cookie'] = cookies.join('\n');
        return route.fulfill({ status: response.status, headers: outHeaders, body: Buffer.from(await response.arrayBuffer()) });
      };
      await ctx.route('**/v1/**', proxy);

      // ── 1 · a visitor starts without an account ────────────────────────────
      await goto('/');
      await page.getByTestId('hero-try-guest').click();
      await page.waitForURL(/\/practice/, { timeout: 30000 });
      await page.waitForSelector('[data-guest-strip]', { timeout: 30000 });
      const strip = page.locator('[data-guest-strip]');
      await check('the guest lands on practice with the count at 0 of 5',
        (await strip.getAttribute('data-guest-used')) === '0' && /0 of 5 free questions/.test(await strip.innerText()),
        await strip.innerText());
      await check('a guest has no Settings, Progress or Exams to reach',
        await page.locator('a[href="/settings"], a[href="/progress"], a[href="/exams"]').count() === 0);
      await check('and the one account action is to create one', await page.getByTestId('guest-create-account').isVisible());
      await shot('guest-start');

      // ── 2 · five questions, typed, marked on the device ────────────────────
      const answerBox = page.locator('.editor-body input.answer-input');
      const typeTab = page.getByRole('button', { name: 'Answer by typing' });
      let answered = 0;
      let skips = 0;
      /** Ask for the next question and wait until the card has really changed. */
      const nextQuestion = async () => {
        const before = await page.locator('.q-prompt').first().textContent().catch(() => null);
        await page.locator('.ctx-next').click();
        await page.waitForFunction(prev => {
          if (document.querySelector('[data-guest-cap]')) return true;
          if (document.querySelector('.eval-card')) return false;
          const now = document.querySelector('.q-prompt')?.textContent ?? null;
          return now !== null && now !== prev;
        }, before, { timeout: 30000 });
        await settle();
      };
      while (answered < LIMIT && skips < MAX_SKIPS) {
        await page.waitForSelector('.q-prompt, [data-guest-cap]', { timeout: 30000 });
        if (await page.locator('[data-guest-cap]').count()) break;
        if (!(await strip.count())) await check(`the strip is on screen before question ${answered + 1}`, false, 'the guest strip vanished');
        const mcq = page.locator('.mcq .mcq-opt');
        if (await mcq.count()) {
          // Multiple choice: pick A, and B if A was not the end of it. Right or
          // wrong, a resolved question is an answered one.
          await mcq.nth(0).click();
          await page.getByRole('button', SUBMIT).click();
          await page.waitForSelector('.verdict-bad, .eval-card', { timeout: 20000 });
          if (!(await page.locator('.eval-card').count())) {
            await mcq.nth(1).click();
            await page.getByRole('button', SUBMIT).click();
            await page.waitForSelector('.eval-card', { timeout: 20000 });
          }
        } else {
          if (await typeTab.count() && await typeTab.isVisible()) await typeTab.click();
          await settle();
          if (await answerBox.count() !== 1) {
            skips++;
            await nextQuestion();
            continue;
          }
          // Two misses resolve a question (tour-v3.js proves the marking); the
          // count is about questions answered, right or wrong.
          await answerBox.fill(SURELY_WRONG);
          await page.getByRole('button', SUBMIT).click();
          await page.waitForSelector('.verdict-bad, .eval-card', { timeout: 20000 });
          if (!(await page.locator('.eval-card').count())) {
            await answerBox.fill(SURELY_WRONG + '1');
            await page.getByRole('button', SUBMIT).click();
            await page.waitForSelector('.eval-card', { timeout: 20000 });
          }
        }
        answered++;
        await page.waitForFunction(n => document.querySelector('[data-guest-strip]')?.getAttribute('data-guest-used') === String(n), answered, { timeout: 15000 });
        await check(`after question ${answered} the strip reads ${answered} of 5`,
          new RegExp(`${answered} of 5 free questions`).test(await strip.innerText()), await strip.innerText());
        if (answered < LIMIT) await nextQuestion();
      }
      await check('five questions were answered as a guest', answered === LIMIT, `${answered} answered, ${skips} skipped`);
      await shot('guest-five');
      const guestAttempts = await ledger(page, 'attempts');
      await check('five attempts sit on the guest\'s own ledger', guestAttempts.mine === LIMIT, JSON.stringify(guestAttempts));
      const guestPid = guestAttempts.pid;

      // ── 3 · the sixth is refused, honestly ─────────────────────────────────
      await nextQuestion();
      await page.waitForSelector('[data-guest-cap]', { timeout: 30000 });
      await check('the sixth question is refused with the account notice, not an error',
        await page.locator('[data-guest-cap]').isVisible() && await page.locator('.error-box').count() === 0);
      await check('the notice says the work comes along and the account is free',
        /nothing is lost/i.test(await page.locator('[data-guest-cap]').innerText()) && /free/i.test(await page.locator('[data-guest-cap]').innerText()));
      await check('the strip reads 5 of 5', /5 of 5 free questions/.test(await strip.innerText()));
      await check('no request reached the server while the visitor was a guest', seen.length === 0, seen.slice(0, 5).join(' · '));
      await shot('guest-cap');

      // ── 4 · sign up by phone code; the five come along ─────────────────────
      await page.getByTestId('guest-cap-create-account').click();
      await page.waitForURL(/\/account$/, { timeout: 15000 });
      await page.waitForSelector('[data-signup-step="role"]', { timeout: 15000 });
      await check('the sign-up says what will be kept', /5 questions you answered as a guest/.test(await page.getByTestId('guest-upgrade-note').innerText()));
      await page.getByTestId('signup-role-student').click();
      await page.waitForSelector('[data-signup-step="age"]');
      await page.getByTestId('signup-age-18').click();
      await page.waitForSelector('[data-signup-step="class"]');
      await page.getByTestId('signup-class-10').click();
      await page.getByTestId('signup-class-next').click();
      await page.waitForSelector('[data-signup-step="method"]');
      await page.locator('#signup-flow-name').fill('Guest Graduate');
      await page.locator('#signup-destination').fill('98765 00001');
      await page.getByTestId('signup-send-code').click();
      await page.waitForSelector('[data-signup-step="code"]');
      const sent = sms.readTestOutbox({ to: '+919876500001' }).at(-1);
      await check('a code went to the phone through the test SMS adapter', /^\d{6}$/.test(sent?.code || ''), JSON.stringify(sent));
      await page.locator('#signup-code-0').focus();
      await page.keyboard.type(sent.code);
      await page.waitForURL(/\/practice/, { timeout: 30000 });
      await page.waitForSelector('.shell', { timeout: 30000 });
      const urlAtShell = page.url();
      await settle();
      await page.waitForTimeout(1500);
      await check(`DEBUG url stayed on practice (${urlAtShell} → ${page.url()})`, new URL(page.url()).pathname === '/practice', (await page.evaluate(() => window.__navLog.slice(-4))).join('\n      '));
      await check('the guest strip is gone once the account exists', await page.locator('[data-guest-strip]').count() === 0);
      await check('Settings is reachable now', await page.locator('a[href="/settings"]').count() >= 1);
      const after = await ledger(page, 'attempts');
      await check('the new profile is a different profile', after.pid && after.pid !== guestPid, `${guestPid} → ${after.pid}`);
      await check('and holds exactly the five attempts, with none left under the guest',
        after.mine === LIMIT && after.total === LIMIT, JSON.stringify(after));
      const profiles = await ledger(page, 'profiles');
      await check('the guest profile itself is gone', profiles.guests === 0 && profiles.total === 1, JSON.stringify(profiles));
      const account = h.db.prepare("SELECT a.id FROM account_phones p JOIN accounts a ON a.id=p.account_id WHERE p.phone_e164='+919876500001'").get();
      await check('the cloud account was really created on the server', !!account && seen.includes('POST /v1/account/otp/verify'));
      await check('the first request to the server was the sign-up itself, never guest practice',
        seen.length > 0 && seen.every(line => !line.includes('/v1/sync/') || seen.indexOf(line) > seen.indexOf('POST /v1/account/otp/verify')), seen.slice(0, 6).join(' · '));

      // ── 5 · a question past the cap, and the sixth question now serves ────
      await page.waitForSelector('.q-prompt', { timeout: 30000 });
      await check('a sixth question serves to the new profile', !!(await page.locator('.q-prompt').innerText()));
      await shot('graduated');
    } finally {
      await h.close();
    }
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
