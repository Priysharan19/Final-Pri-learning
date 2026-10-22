// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · E2E journeys — the free plan's daily MARKING allowance is the
// SERVER's
//
// The free/Premium split: practice is unlimited on every plan; the free plan
// is marked by the examiner FREE_MARKED_PER_DAY (5) times a day per account,
// counted and refused by the server at POST /v1/practice/:id/submit (402
// FREE_CAP_REACHED, capability unlimited-marking) before it marks. These
// journeys drive the shipped client in a browser against the real platform
// server with the allowance at its SHIPPED DEFAULT of five (every other browser
// suite runs with it raised by configuration):
//
//   1. A student's other device has had today's five answers marked (the
//      test's desk, signed in to the same account over the server's own
//      routes, is that device). In the browser practice is still issued —
//      several questions in a row, no cap screen — and Submit on a sixth is
//      refused in the card as the free cap: no verdict, no marks, no
//      solution, the typed answer kept, nothing marked on the server, and
//      See Premium leads to the Premium screen at /premium.
//
// WHAT IS REAL: the built client, the real platform server and its SQLite
// database, the accounts, the server's count. WHAT IS SYNTHETIC: nothing is
// read by a handwriting provider here (the flows type). No device, student or
// examiner evidence is claimed.
//
// Run on its own:  node client/test/tour-free-cap.js
// ─────────────────────────────────────────────────────────────────────────────
import { pathToFileURL } from 'node:url';
import { onlinePlatform } from './support/online-session.mjs';

const TOPIC = 'y7-equations';
const SURELY_WRONG = '-987654';
const MAX_SKIPS = 14;
const FREE_MARKED_PER_DAY = 5;

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
 * over the server's own routes, is issued `count` practice questions and has
 * each answer marked — exactly what an iPad used earlier in the day did.
 * Returns the submit statuses.
 */
async function otherDeviceMarks(platform, account, count, generator) {
  const jar = {};
  if (account.password) {
    const login = await platform.h.request('/v1/account/login', { method: 'POST', jar, body: { email: account.email, password: account.password, deviceId: 'e2e-other-ipad' } });
    if (login.status !== 200) throw new Error(`tour-free-cap: the other device could not sign in (${login.status} ${login.text})`);
  } else {
    platform.h.db.prepare("DELETE FROM rate_limits WHERE bucket LIKE 'otp-%'").run();
    const asked = await platform.h.request('/v1/account/otp/request', { method: 'POST', jar, body: { channel: 'email', destination: account.email } });
    const code = platform.sms.readTestOutbox({ to: account.email, channel: 'email' }).filter(m => m.purpose === 'sign-in').at(-1)?.code;
    const verified = await platform.h.request('/v1/account/otp/verify', { method: 'POST', jar, body: { channel: 'email', destination: account.email, challengeId: asked.data?.challengeId, code, deviceId: 'e2e-other-ipad' } });
    if (verified.status !== 200) throw new Error(`tour-free-cap: the other device could not sign in with a code (${asked.status}/${verified.status} ${verified.text})`);
  }
  const statuses = [];
  for (let i = 0; i < count; i++) {
    const issued = await platform.h.request('/v1/practice/issue', { method: 'POST', jar, body: { generator, difficulty: 2, curriculum: 'in', mode: 'practice', account: account.id } });
    const qid = issued.data?.question?.id;
    const marked = qid ? await platform.h.request(`/v1/practice/${qid}/submit`, { method: 'POST', jar, body: { submissionId: `e2e-other-${i}-${Date.now()}`, answer: SURELY_WRONG, mode: 'typed', ms: 900 } }) : { status: issued.status };
    statuses.push(marked.status);
  }
  return statuses;
}

/** Move on to the next question in the browser and wait for it. */
async function nextQuestion(page, settle) {
  const leaving = await shownId(page);
  await page.locator('.ctx-next').click();
  await page.waitForFunction(id => {
    const el = document.querySelector('.qpage[data-question-id]');
    return el && el.getAttribute('data-question-id') !== id && el.querySelector('.q-prompt');
  }, leaving, { timeout: 30000 }).catch(() => {});
  await settle();
}

export const capAtSubmit = {
  id: 'free-cap-marking',
  name: 'Free cap · five answers marked on another device: practice is still issued, the sixth Submit is refused as the free cap, nothing marked, See Premium opens /premium',
  online: true,

  async run({ page, base, check, goto, createProfile, settle, online }) {
    const platform = await onlinePlatform();
    await goto('/');
    await createProfile({ name: 'Capped Student', year: 7 });
    const account = await online.signIn({ name: 'Capped Student' });

    const opened = await openTypedQuestion({ page, base, settle });
    if (!await check('signed in, Practice serves a server-issued question with a box to type in', opened)) return;
    const generator = (await online.practiceCalls(/^\/v1\/practice\/issue$/)).find(c => c.status === 201)?.body?.generator;
    if (!await check('the browser\'s question was issued by the server', !!generator)) return;

    const elsewhere = await otherDeviceMarks(platform, account, FREE_MARKED_PER_DAY, generator);
    await check(`the same account has today's ${FREE_MARKED_PER_DAY} answers marked on another device`, elsewhere.every(s => s === 200), JSON.stringify(elsewhere));

    // Practice is unlimited: the browser keeps being issued questions.
    const issuesBefore = (await online.practiceCalls(/^\/v1\/practice\/issue$/)).length;
    for (let i = 0; i < 3; i++) await nextQuestion(page, settle);
    const issued = (await online.practiceCalls(/^\/v1\/practice\/issue$/)).slice(issuesBefore);
    await check('practice is still issued past the marking allowance, with no cap screen',
      issued.length >= 3 && issued.every(c => c.status === 201) && await page.locator('.q-prompt').count() === 1 &&
        await page.locator('.card[role="status"]').filter({ hasText: /free marked answers/ }).count() === 0,
      JSON.stringify(issued.map(c => c.status)));

    if (!await check('a question with a typed answer box is on screen', await openTypedQuestion({ page, base, settle }))) return;
    const qid = await shownId(page);
    const answerBox = page.locator('.editor-body input.answer-input');
    const completionsAtCap = platform.ledger(account.id).completions;
    await answerBox.fill(SURELY_WRONG);
    await page.evaluate(() => { window.__PRI_E2E_SAME_PAGE__ = 'kept'; });
    const submitsBefore = (await online.practiceCalls(/^\/v1\/practice\/[^/]+\/submit$/)).length;

    // ── Submit: the sixth marked answer of the day ───────────────────────────
    await pressSubmit(page);
    await page.locator('[data-check-refusal="free-cap"]').waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
    const shown = await resultOnCard(page);
    const verdict = await visibleText(page, '.verdict');
    await check('Submit is refused as the free cap, in the card: what ran out, that nothing was checked, and the way through',
      shown.refusal.join() === 'free-cap' && /Today.s free marked answers are used up/.test(verdict) && /has not been checked/.test(verdict) &&
        /free plan includes 5 a day/.test(verdict) && /midnight/.test(verdict) && /Practice stays unlimited/.test(verdict),
      `${JSON.stringify(shown)} ${JSON.stringify(verdict.slice(0, 280))}`);
    await check('and with NO verdict, marks, XP or solution', nothingMarked(shown), JSON.stringify(shown));
    await check('the refusal is in the card on the same question, with the typed answer kept',
      new URL(page.url()).pathname === '/practice' && await page.evaluate(() => window.__PRI_E2E_SAME_PAGE__) === 'kept' && await shownId(page) === qid &&
        await answerBox.inputValue() === SURELY_WRONG);
    const submits = (await online.practiceCalls(/^\/v1\/practice\/[^/]+\/submit$/)).slice(submitsBefore);
    const refusal = submits.find(c => c.status === 402);
    await check('the server refused it with its own code, capability, count and reset, before marking',
      !!refusal && refusal.json?.error?.code === 'FREE_CAP_REACHED' && refusal.json.error.capability === 'unlimited-marking' &&
        refusal.json.error.used === FREE_MARKED_PER_DAY && refusal.json.error.limit === FREE_MARKED_PER_DAY &&
        refusal.json.error.timeZone === 'Asia/Kolkata' && Number.isFinite(refusal.json.error.resetAt) && refusal.json.error.resetAt > Date.now(),
      JSON.stringify(submits.map(c => ({ status: c.status, code: c.json?.error?.code }))));
    await check('the server marked nothing for this account', platform.ledger(account.id).completions === completionsAtCap, JSON.stringify(platform.ledger(account.id)));

    // ── See Premium: the Premium screen ──────────────────────────────────────
    const premium = page.locator('.verdict').getByRole('link', { name: 'See Premium' });
    await check('See Premium is offered, and points at /premium', await premium.count() === 1 && await premium.getAttribute('href') === '/premium');
    await premium.click();
    await page.locator('[data-paywall]').waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
    const paywall = await visibleText(page, '[data-paywall]');
    await check('the Premium screen compares the plans honestly, with a close button and the legal links',
      new URL(page.url()).pathname === '/premium' && /Unlimited practice/.test(paywall) && /5 marked answers a day/.test(paywall) && /Unlimited marking/.test(paywall) &&
        /Mock papers/.test(paywall) && /auto-renewing subscription/.test(paywall) && await page.locator('[data-paywall-close]').count() === 1 &&
        await page.locator('[data-paywall] a[href="/terms"]').count() === 1 && await page.locator('[data-paywall] a[href="/privacy"]').count() === 1,
      paywall.slice(0, 300));
    await check('no countdown or urgency on it', !/countdown|hurry|limited time|today only|last chance/i.test(paywall));
  }
};

export const flows = [capAtSubmit];

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  // Boot the platform before the runner does, with the marking allowance at
  // its shipped default: this journey is about the five, so the five it is.
  await onlinePlatform({ env: { PRI_FREE_MARKED_PER_DAY: null } });
  const { runFlows } = await import('./e2e.mjs');
  process.exit(await runFlows(flows) ? 1 : 0);
}
