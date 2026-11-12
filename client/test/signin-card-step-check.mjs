#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the sign-in card helper reads a card that may leave the page.
//
// Regression for the intermittent browser-suite crash (November 2026)
// "locator.getAttribute: Timeout 30000ms exceeded — waiting for
// [data-testid="account-activation-gate"] [data-signin-card="inline"]" in the
// gate and login journeys. support/verified-onboarding.mjs asked the card
// `count()` and THEN `getAttribute('data-signup-step')`. A returning address is
// signed in the moment its code is right, and the gate replaces the card with
// the shell; when that landed between the two calls, `getAttribute` waited 30 s
// for an element that was never coming back, and the journey failed although
// the app had done exactly the right thing.
//
// No server and no app build: a stand-in card on a blank page, driven by the
// real helper. It proves that
//   1  the old two-step read hangs when the card leaves between its steps
//      (so this check can tell the defect from the fix);
//   2  `cardStep` reads presence and step in one look that never waits;
//   3  signInOnCard returns at once for a returning address whose card is
//      replaced, and still walks a new address through the age step;
//   4  waitForStep reports a card that has left the page instead of hanging.
//
// Run:  node client/test/signin-card-step-check.mjs [--browser=webkit]
// ─────────────────────────────────────────────────────────────────────────────
import { chromium, webkit } from '@playwright/test';
import { cardStep, signInOnCard, waitForStep } from './support/verified-onboarding.mjs';

const engineName = process.argv.find(a => a.startsWith('--browser='))?.slice(10) || 'chromium';
const engine = engineName === 'webkit' ? webkit : chromium;
const CODE = '246810';
const CARD = '[data-testid="account-activation-gate"] [data-signin-card="inline"]';

/** The test desk's side of signInOnCard: an outbox with one sign-in code, and a rate-limit table to clear. */
const platform = {
  h: { db: { prepare: () => ({ run: () => ({ changes: 0 }) }) } },
  sms: { readTestOutbox: () => [{ purpose: 'sign-in', code: CODE }] }
};

/**
 * A stand-in for the gate's inline card: email → code → (a returning address)
 * the card is replaced by the shell, or (a new one) the age step.
 */
const CARD_PAGE = returning => `<!doctype html><meta charset="utf-8">
<main id="root"><section data-testid="account-activation-gate" data-activation-status="signin">
  <div data-signin-card="inline" data-signup-step="method">
    <input id="signup-destination"><button data-testid="signup-send-code">Send code</button>
  </div>
</section></main>
<script>{
  // A block, not top-level: setContent reuses the window, and a second
  // top-level const would be a redeclaration error that stops the script.
  const card = document.querySelector('[data-signin-card]');
  card.querySelector('[data-testid="signup-send-code"]').onclick = () => {
    card.dataset.signupStep = 'code';
    card.innerHTML = '<input id="signup-code-0" maxlength="6" autocomplete="one-time-code">';
    card.querySelector('#signup-code-0').oninput = e => {
      if (e.target.value.length < 6) return;
      if (e.target.value !== '${CODE}') return;
      // The server's answer arrives a moment later, as it does over the network.
      setTimeout(() => {
        if (${returning}) {
          document.getElementById('root').innerHTML = '<div class="shell">signed in</div>';
        } else {
          card.dataset.signupStep = 'age';
          card.innerHTML = '<input id="signup-flow-name"><button data-testid="signup-age-18">18+</button>'
            + '<input type="checkbox" data-testid="signup-agree"><button data-testid="signup-age-next">Next</button>';
          card.querySelector('[data-testid="signup-age-next"]').onclick = () => { card.dataset.signupStep = 'class'; };
        }
      }, 50);
    };
  };
}</script>`;

let failed = 0, passed = 0;
async function check(name, run) {
  try { await run(); passed++; console.log(`  ✔ ${name}`); }
  catch (err) { failed++; console.log(`  ✖ ${name}\n      ${String(err?.message || err).split('\n')[0]}`); }
}
const assert = (ok, why) => { if (!ok) throw new Error(why); };

const browser = await engine.launch();
try {
  const page = await browser.newPage();
  console.log(`Sign-in card helper · a card that leaves the page (${engineName})`);

  await check('the old two-step read hangs when the card leaves between count() and getAttribute()', async () => {
    await page.setContent(CARD_PAGE(true));
    const card = page.locator(CARD);
    assert(await card.count() === 1, 'the stand-in card is not on the page');
    // The gate replaces the card with the shell between the two calls.
    await page.evaluate(() => { document.getElementById('root').innerHTML = '<div class="shell"></div>'; });
    const hung = await card.getAttribute('data-signup-step', { timeout: 1500 }).then(() => false, e => /Timeout/.test(e.message));
    assert(hung, 'getAttribute on a vanished card returned instead of waiting: the defect this check guards is not reproducible here');
  });

  await check('cardStep reads presence and step in one look, and never waits for a card that has gone', async () => {
    await page.setContent(CARD_PAGE(true));
    const card = page.locator(CARD);
    const here = await cardStep(card);
    assert(here.present === true && here.step === 'method', `on screen it read ${JSON.stringify(here)}`);
    await page.evaluate(() => { document.getElementById('root').innerHTML = '<div class="shell"></div>'; });
    const started = Date.now();
    const gone = await cardStep(card);
    const took = Date.now() - started;
    assert(gone.present === false && gone.step === null, `after the card left it read ${JSON.stringify(gone)}`);
    assert(took < 1000, `the read took ${took} ms — it waited for the card`);
  });

  await check('a returning address: signInOnCard returns at once when the gate replaces the card with the shell', async () => {
    await page.setContent(CARD_PAGE(true));
    const started = Date.now();
    const result = await signInOnCard(page.locator(CARD), platform, { email: 'back@example.test' });
    const took = Date.now() - started;
    assert(result.newAccount === false && result.code === CODE, `it returned ${JSON.stringify(result)}`);
    assert(await page.locator('.shell').count() === 1 && await page.locator(CARD).count() === 0, 'the stand-in did not replace the card');
    assert(took < 10000, `it took ${took} ms — it waited on the card that had left`);
  });

  await check('a new address: signInOnCard still walks the age step and leaves the card on the next one', async () => {
    await page.setContent(CARD_PAGE(false));
    const result = await signInOnCard(page.locator(CARD), platform, { email: 'new@example.test', name: 'New Student' });
    assert(result.newAccount === true, `it returned ${JSON.stringify(result)}`);
    await waitForStep(page.locator(CARD), 'class', { timeout: 5000 });
  });

  await check('waitForStep names a card that has left the page, within its own timeout', async () => {
    await page.setContent(CARD_PAGE(true));
    await page.evaluate(() => { document.getElementById('root').innerHTML = '<div class="shell"></div>'; });
    const started = Date.now();
    const said = await waitForStep(page.locator(CARD), 'age', { timeout: 1000 }).then(() => 'returned', e => e.message);
    const took = Date.now() - started;
    assert(/no card on screen/.test(said), `it said: ${said}`);
    assert(took < 5000, `it took ${took} ms`);
  });
} finally {
  await browser.close();
}

console.log(`\n${failed ? '✖ SIGN-IN CARD HELPER CHECK FAILED' : '✔ SIGN-IN CARD HELPER CHECK PASSED'} — ${passed}/${passed + failed} checks`);
process.exit(failed ? 1 : 0);
