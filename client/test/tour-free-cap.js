// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · E2E journeys — the free plan's daily cap is the SERVER's (#537)
//
// Since #418 every creditable question is issued by the server, so the cap on
// the free plan is decided there, per account: a modified client, a cleared
// device or a second device changes nothing. These journeys drive the shipped
// client in a browser against the real platform server with the cap at its
// SHIPPED DEFAULT of twenty (every other browser suite runs with it raised by
// configuration so a skipping flow is never read as a fault):
//
//   1. A student's other device has used nineteen of today's questions (the
//      test's desk, signed in to the same account over the server's own
//      routes, is that device). In the browser the twentieth is issued; Next
//      brings the cap screen — what ran out, when it comes back, what Premium
//      changes — from the server's answer, with no question on screen, no
//      prepared question or draft fetched instead, and nothing escrowed.
//   2. A signed-out student types an answer on a prepared question, then signs
//      in on the card to an account whose twenty are used up (on another
//      device). Submit is refused as the free cap: no verdict, no marks, no
//      solution, the work kept; the server marked nothing.
//
// WHAT IS REAL: the built client, the real platform server and its SQLite
// database, the accounts, the server's count. WHAT IS SYNTHETIC: nothing is
// read by a handwriting provider here (the flows type); the stand-in reader of
// support/online-session.mjs is not reached. No device, student or examiner
// evidence is claimed.
//
// Run on its own:  node client/test/tour-free-cap.js
// ─────────────────────────────────────────────────────────────────────────────
import { pathToFileURL } from 'node:url';
import { onlinePlatform } from './support/online-session.mjs';

const TOPIC = 'y7-equations';
const SURELY_WRONG = '-987654';
const MAX_SKIPS = 14;
const FREE_PER_DAY = 20;

const shownId = page => page.locator('.qpage').first().getAttribute('data-question-id');

/** Rendered text only: a display:none node says nothing to a student. */
const visibleText = (page, selector) => page.evaluate(sel => [...document.querySelectorAll(sel)]
  .filter(el => el.getClientRects().length > 0).map(el => el.innerText).join(' ').replace(/\s+/g, ' ').trim(), selector);

/** Everything on the card that would be a result, counted. */
const resultOnCard = page => page.evaluate(() => {
  const n = sel => [...document.querySelectorAll(sel)].filter(el => el.getClientRects().length > 0).length;
  return {
    evaluation: n('.eval-card'), verdict: n('.verdict-bad, .verdict-good'), marks: n('.eval-marks'),
    xp: n('.xp-pop'), solution: n('.solution-block, .solution-panel, .final-answer, .criteria-table'),
    refusal: [...document.querySelectorAll('[data-check-refusal]')].filter(el => el.getClientRects().length > 0).map(el => el.getAttribute('data-check-refusal'))
  };
});
const nothingMarked = r => r.evaluation === 0 && r.verdict === 0 && r.marks === 0 && r.xp === 0 && r.solution === 0;

/** Open practice on a question with one typed answer box (skipping others). */
async function openTypedQuestion({ page, base, settle }) {
  await page.goto(`${base}/practice?subtopic=${TOPIC}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.qpage[data-question-id] .q-prompt', { timeout: 30000 });
  const typeTab = page.getByRole('button', { name: 'Answer by typing' });
  const answerBox = page.locator('.editor-body input.answer-input');
  for (let skips = 0; skips <= MAX_SKIPS; skips++) {
    if (await typeTab.count()) await typeTab.click();
    await settle();
    if (await answerBox.count() === 1) return true;
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

const submitButton = page => page.locator('.ws-actions .btn-primary');
async function pressSubmit(page) {
  await page.waitForFunction(() => { const b = document.querySelector('.ws-actions .btn-primary'); return !!b && !b.disabled; }, null, { timeout: 15000 });
  await submitButton(page).click();
}

/**
 * The student's OTHER device: the test's desk signs in to the same account
 * over the server's own route and is issued `count` practice questions —
 * exactly what an iPad used earlier in the day did. Returns the statuses.
 */
async function otherDeviceUses(platform, account, count, generator) {
  const jar = {};
  const login = await platform.h.request('/v1/account/login', { method: 'POST', jar, body: { email: account.email, password: account.password, deviceId: 'e2e-other-ipad' } });
  if (login.status !== 200) throw new Error(`tour-free-cap: the other device could not sign in (${login.status} ${login.text})`);
  const statuses = [];
  for (let i = 0; i < count; i++) {
    const issued = await platform.h.request('/v1/practice/issue', { method: 'POST', jar, body: { generator, difficulty: 2, curriculum: 'in', mode: 'practice', account: account.id } });
    statuses.push(issued.status);
  }
  return statuses;
}

/** The server's own count of the account's practice day, read at the desk. */
const serverCount = (platform, accountId) => {
  const row = platform.h.db.prepare("SELECT response_json FROM idempotency_keys WHERE account_id=? AND scope='practice-daily'").get(accountId);
  return row ? Number(JSON.parse(row.response_json).issued) : 0;
};

// ── 1 · the twenty-first question: the cap screen, from the server ───────────

export const capScreen = {
  id: 'free-cap-screen',
  name: 'Free cap · nineteen used on another device: the twentieth is issued, Next shows the cap screen from the server, nothing fetched instead',
  online: true,

  async run({ page, base, check, goto, createProfile, settle, online }) {
    const platform = await onlinePlatform();
    await goto('/');
    await createProfile({ name: 'Capped Student', year: 7 });
    const account = await online.signIn({ name: 'Capped Student' });

    // One question in the browser first, so the "other device" asks for the
    // same authored question the app does.
    const opened = await openTypedQuestion({ page, base, settle });
    if (!await check('signed in, Practice serves a server-issued question with a box to type in', opened)) return;
    const issues = await online.practiceCalls(/^\/v1\/practice\/issue$/);
    const generator = issues.find(c => c.status === 201)?.body?.generator;
    const usedHere = issues.filter(c => c.status === 201).length;
    if (!await check('the browser\'s questions were issued by the server under this account', !!generator && usedHere >= 1 && serverCount(platform, account.id) === usedHere,
      `generator ${generator}; ${usedHere} issued here; server count ${serverCount(platform, account.id)}`)) return;

    // The student's iPad, earlier today: the rest of the twenty.
    const remaining = FREE_PER_DAY - usedHere;
    const elsewhere = await otherDeviceUses(platform, account, remaining, generator);
    await check(`the same account is issued the day's remaining ${remaining} questions on another device`,
      elsewhere.every(s => s === 201) && serverCount(platform, account.id) === FREE_PER_DAY, `statuses ${JSON.stringify(elsewhere)}; server count ${serverCount(platform, account.id)}`);
    const escrowedAtCap = platform.ledger(account.id).issued;

    // ── Next: the twenty-first ───────────────────────────────────────────────
    const before = (await online.practiceCalls(/^\/v1\/practice\/(issue|prepare)$/)).length;
    await page.evaluate(() => { window.__PRI_E2E_SAME_PAGE__ = 'kept'; });
    await page.locator('.ctx-next').click();
    const notice = page.locator('.card[role="status"]').filter({ hasText: /Today.s free questions/ });
    await notice.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
    const text = (await notice.innerText().catch(() => '')).replace(/\s+/g, ' ');
    await check('the cap screen is shown: what ran out, as a polite status, not an error',
      await notice.count() === 1 && await notice.getAttribute('aria-live') === 'polite' && /used all 20 free practice questions for today/.test(text),
      JSON.stringify(text.slice(0, 240)));
    await check('it says when they come back — midnight, with the server\'s calendar named',
      /come back at midnight/.test(text) && /\(Asia\/Kolkata\)/.test(text) && /\d{1,2}:\d{2}\s*(am|pm)/i.test(text), JSON.stringify(text.slice(0, 240)));
    await check('and what Premium changes, with the way there and the way back to finished work',
      await notice.getByRole('link', { name: 'See Premium' }).count() === 1 && await notice.getByRole('link', { name: 'Review what I have done' }).count() === 1, text.slice(0, 200));
    await check('no question is on screen and nothing reads as a fault', await page.locator('.q-prompt').count() === 0 && !/something went wrong|error/i.test(text), text.slice(0, 200));
    await check('nothing claims a mark made on this device', !/marked on this device|checked on this device/i.test(await visibleText(page, 'main, .shell')));

    const calls = (await online.practiceCalls(/^\/v1\/practice\/(issue|prepare)$/)).slice(before);
    const refusal = calls.find(c => c.path === '/v1/practice/issue' && c.status === 402);
    await check('the server refused the twenty-first with its own code, count and reset — and the device asked for nothing else instead (no prepared question, no second issue)',
      calls.length === 1 && !!refusal && refusal.json?.error?.code === 'FREE_CAP_REACHED' && refusal.json.error.used === FREE_PER_DAY && refusal.json.error.limit === FREE_PER_DAY &&
        refusal.json.error.timeZone === 'Asia/Kolkata' && Number.isFinite(refusal.json.error.resetAt) && refusal.json.error.resetAt > Date.now(),
      JSON.stringify(calls.map(c => ({ path: c.path, status: c.status, code: c.json?.error?.code }))));
    await check('the refusal escrowed nothing and counted nothing', platform.ledger(account.id).issued === escrowedAtCap && serverCount(platform, account.id) === FREE_PER_DAY,
      `${platform.ledger(account.id).issued} escrowed (was ${escrowedAtCap}); count ${serverCount(platform, account.id)}`);

    // Try again is the same answer today.
    const again = (await online.practiceCalls(/^\/v1\/practice\/issue$/)).length;
    await notice.getByRole('button', { name: 'Try again' }).click();
    await page.waitForFunction(n => performance.getEntriesByType('resource').filter(e => /\/v1\/practice\/issue$/.test(e.name)).length > n, again, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(400);
    const retried = (await online.practiceCalls(/^\/v1\/practice\/issue$/)).slice(again);
    await check('Try again asks the server once more and is refused once more; the cap screen stays',
      retried.length === 1 && retried[0].status === 402 && await notice.count() === 1 && await page.locator('.q-prompt').count() === 0,
      JSON.stringify(retried.map(c => c.status)));
  }
};

// ── 2 · a capped account cannot have a signed-out question checked ──────────

export const capAtCheck = {
  id: 'free-cap-check',
  name: 'Free cap · a prepared question, signed in on the card to a capped account: Submit refused as the free cap, nothing marked, work kept',
  online: true,

  async run({ page, base, check, goto, createProfile, settle, online }) {
    const platform = await onlinePlatform();
    await goto('/');
    await createProfile({ name: 'Late Typist', year: 7 });
    const opened = await openTypedQuestion({ page, base, settle });
    if (!await check('signed out, Practice serves a prepared question to read and a box to type in', opened)) return;
    const qid = await shownId(page);
    const answerBox = page.locator('.editor-body input.answer-input');
    const prepares = await online.practiceCalls(/^\/v1\/practice\/prepare$/);
    const generator = prepares.find(c => c.status === 200)?.body?.generator;
    await check('the question on screen was prepared by the server, not issued', !!generator && (await online.practiceCalls(/^\/v1\/practice\/issue$/)).length === 0, `${prepares.length} prepare call(s)`);

    // The account this student will sign in to has used its twenty today, on
    // its own iPad.
    const account = await platform.newAccount({ name: 'Late Typist' });
    const elsewhere = await otherDeviceUses(platform, account, FREE_PER_DAY, generator);
    await check('an account has used all twenty of today\'s questions on another device', elsewhere.every(s => s === 201) && serverCount(platform, account.id) === FREE_PER_DAY, JSON.stringify(elsewhere));
    const escrowedAtCap = platform.ledger(account.id).issued;

    await answerBox.fill(SURELY_WRONG);
    await page.evaluate(() => { window.__PRI_E2E_SAME_PAGE__ = 'kept'; });
    await pressSubmit(page);
    await page.locator('[data-check-refusal]').waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    await check('signed out, Submit is answered with the sign-in in the card', (await resultOnCard(page)).refusal.join() === 'sign-in');
    await page.locator('.verdict [data-check-sign-in]').click();
    await online.signInHere(page.locator('.qpage'), { account });
    await page.waitForFunction(() => !document.querySelector('.qpage #cloud-password'), null, { timeout: 30000 }).catch(() => {});
    await check('signed in on the card without leaving the question; the typed answer is still in the box',
      new URL(page.url()).pathname === '/practice' && await page.evaluate(() => window.__PRI_E2E_SAME_PAGE__) === 'kept' && await shownId(page) === qid && await answerBox.inputValue() === SURELY_WRONG,
      `${page.url()} ${await shownId(page)} ${JSON.stringify(await answerBox.inputValue())}`);

    // ── Submit: binding would be a twenty-first question ─────────────────────
    await pressSubmit(page);
    await page.locator('[data-check-refusal="free-cap"]').waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
    const shown = await resultOnCard(page);
    const verdict = await visibleText(page, '.verdict');
    await check('Submit is refused as the free cap, in the card: what ran out, that nothing was checked, and the way through',
      shown.refusal.join() === 'free-cap' && /Today.s free questions are used up/.test(verdict) && /has not been checked/.test(verdict) &&
        /free plan includes 20 a day/.test(verdict) && /midnight/.test(verdict) && await page.locator('.verdict').getByRole('link', { name: 'See Premium' }).count() === 1,
      `${JSON.stringify(shown)} ${JSON.stringify(verdict.slice(0, 240))}`);
    await check('and with NO verdict, marks, XP or solution', nothingMarked(shown), JSON.stringify(shown));
    await check('the typed answer is still in the box', await answerBox.inputValue() === SURELY_WRONG, JSON.stringify(await answerBox.inputValue()));
    const binds = (await online.practiceCalls(/^\/v1\/practice\/issue$/));
    const submits = await online.practiceCalls(/^\/v1\/practice\/[^/]+\/submit$/);
    await check('the server refused the bind with its own code; the answer was never sent to be marked',
      binds.length === 1 && binds[0].status === 402 && binds[0].json?.error?.code === 'FREE_CAP_REACHED' && typeof binds[0].body?.prepared === 'string' && submits.length === 0,
      JSON.stringify({ binds: binds.map(c => ({ status: c.status, code: c.json?.error?.code })), submits: submits.length }));
    await check('the server escrowed nothing, marked nothing and counted nothing for this account',
      platform.ledger(account.id).issued === escrowedAtCap && platform.ledger(account.id).completions === 0 && serverCount(platform, account.id) === FREE_PER_DAY,
      JSON.stringify(platform.ledger(account.id)));
    const row = await online.shownRow();
    await check('the question on the device is still the prepared one — unbound, so it can be bound and marked tomorrow',
      row?.id === qid && row.checkState === 'prepared' && row.serverQuestionId === null, JSON.stringify(row));
  }
};

export const flows = [capScreen, capAtCheck];

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  // Boot the platform before the runner does, with the cap at its shipped
  // default: these journeys are about the twenty, so the twenty it is.
  await onlinePlatform({ env: { PRI_FREE_PRACTICE_PER_DAY: null } });
  const { runFlows } = await import('./e2e.mjs');
  process.exit(await runFlows(flows) ? 1 : 0);
}
