// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · E2E flow — the app opens as an Indian product.
//
// This flow walks the India path the way a Class 10 student meets it: the
// landing copy, the first thing the sign-in card asks for, the labels on Home
// and in the profile picker, the History page, and Settings already connected
// to the account the student entered with. There is no account-less demo any
// more (issue #477): nothing opens without a verified account.
//
// It asserts behaviour, not pixels: what the picker says a profile is, where
// the account lives, which class Home targets.
//
// Run on its own:  node client/test/tour-india.js
// ─────────────────────────────────────────────────────────────────────────────
import { pathToFileURL } from 'node:url';

const STUDENT = { name: 'Asha Iyer', year: 10, course: 'in' };
const HSC = /\bHSC\b|\bNSW\b|\bNESA\b|Band 6/i;

/** The account menu is the only way out of a signed-in session. */
async function switchProfile(page) {
  await page.locator('.user-chip').click();
  await page.getByRole('menuitem', { name: 'Switch profile' }).click();
  await page.waitForSelector('.acct-list', { timeout: 15000 });
}

export const flow = {
  id: 'india',
  name: 'India · onboarding, class labels, demo, cloud entry',

  async run({ page, base, check, note, goto, createProfile, settle }) {
    // ── 1 · the landing screen is an Indian product ──────────────────────────
    await goto('/');
    const hero = [
      await page.locator('.hero-kicker').innerText(),
      await page.locator('.hero-title').innerText(),
      await page.locator('.hero-sub').innerText()
    ].join(' ');
    await check('the landing screen names NCERT and JEE', /NCERT/.test(hero) && /JEE/.test(hero),
      `hero reads ${JSON.stringify(hero.slice(0, 160))}`);
    await check('and says nothing about the HSC', !HSC.test(hero), `hero reads ${JSON.stringify(hero.slice(0, 160))}`);
    // The welcome screen also carries the legal links in a muted line, so the
    // privacy copy is named rather than taken as the only muted paragraph.
    const privacy = await page.locator('.auth-col p.muted').first().innerText();
    // Owner decision 2026-10-10: the welcome line may no longer promise an
    // optional account or offline checking. What it must still say honestly is
    // where a student's work lives and that there are no ads — and now, that
    // checking needs an account and a connection.
    await check('the privacy copy says work stays on this device, checking needs an account and a connection, no ads',
      /stored on this device/i.test(privacy) && /checking answers needs a Pri account and a connection/i.test(privacy) && /no ads/i.test(privacy) &&
        !/account is optional|offline-first|works offline/i.test(privacy),
      `privacy copy reads ${JSON.stringify(privacy)}`);
    for (const [label, href] of [['Privacy', '/privacy'], ['Terms', '/terms'], ['Refunds', '/refund-policy'], ['Grievances', '/grievance']]) {
      await check(`the landing screen links to ${label.toLowerCase()}`,
        await page.locator(`.auth-col a[href="${href}"]`).count() === 1, `${label} -> ${href}`);
    }
    await check('the landing screen IS the account sign-in: one card, an email first',
      await page.locator('[data-signin-card="page"] #signup-destination[type="email"]').count() === 1);
    await check('the tab is titled after the app', (await page.title()) === 'Pri Learning',
      `title reads ${JSON.stringify(await page.title())}`);
    const description = (await page.locator('meta[name="description"]').getAttribute('content')) || '';
    await check('the page description is written for Indian students',
      /NCERT/.test(description) && /JEE/.test(description) && !/HSC|iPad/i.test(description),
      `description reads ${JSON.stringify(description)}`);
    const manifest = await page.evaluate(async () => {
      try { return await (await fetch('/manifest.webmanifest')).json(); } catch (err) { return { error: String(err) }; }
    });
    await check('the web app manifest describes the Indian product',
      manifest.name === 'Pri Learning' && /NCERT/.test(manifest.description || '') && !/HSC|iPad/i.test(manifest.description || ''),
      `manifest reads ${JSON.stringify(manifest)}`);

    // ── 2 · account first: the card asks for a verified contact, not a local profile ─
    await check('no device-only wizard and no demo stand on the welcome screen',
      await page.locator('[data-onboarding-step="1"], [data-testid="hero-offline"], [data-testid="hero-try-demo"]').count() === 0 &&
        await page.getByRole('button', { name: 'Use without an account' }).count() === 0);
    await check('the card is email by default and offers Classes 7–12 only after the mailbox is proved',
      await page.locator('[data-signin-card="page"]').getAttribute('data-signup-step') === 'method' &&
        await page.locator('[data-testid="signup-class-10"]').count() === 0);

    // ── 3 · a verified Class 10 student lands on Home, labelled by class ────────
    const member = await createProfile(STUDENT);
    await check('the verified account lands on Home as Asha', (await page.locator('.home-greet').innerText()).includes('Asha'));
    await page.waitForSelector('.genbar-chips .chip', { timeout: 15000 });
    const chips = await page.locator('.genbar-chips').innerText();
    await check('Home targets Class 10, not Year 10', /Class 10/.test(chips) && !/\bYear\b/.test(chips), `chips read ${JSON.stringify(chips)}`);
    await page.locator('.genbar-toggle').click();
    await settle();
    const cats = await page.locator('.gen-cats').innerText();
    await check('the generator speaks in classes and tracks', /Class/.test(cats) && /Track/.test(cats) && !/\bYear\b/.test(cats),
      `categories read ${JSON.stringify(cats)}`);
    await check('the week strip draws seven days in the profile’s week', await page.locator('.week-day').count() === 7,
      `${await page.locator('.week-day').count()} days drawn`);
    const nav = await page.locator('.sidebar').innerText();
    await check('the navigation carries no NSW jargon', !HSC.test(nav) && !/\bYear\b/.test(nav), `nav reads ${JSON.stringify(nav)}`);

    await page.goto(`${base}/progress`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('main h1', { timeout: 30000 });
    const progressTitle = await page.locator('main h1').innerText();
    await check('Progress is the India presentation for Class 10', /Class 10/.test(progressTitle) && !HSC.test(progressTitle),
      `heading reads ${JSON.stringify(progressTitle)}`);
    await check('a fresh student is not shown someone else’s past: no demo history', !/\bPri demo\b/i.test(await page.locator('main').innerText()));
    await page.goto(`${base}/history`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('main', { timeout: 30000 });
    const sub = await page.locator('main p.sub').first().innerText().catch(() => '');
    await check('History does not call the device an iPad', !/iPad/.test(sub), `copy reads ${JSON.stringify(sub)}`);
    note(`the new student opens with ${JSON.stringify(progressTitle)}`);

    // ── 4 · the picker: the saved profile, labelled by class, and no demo ─────
    await goto('/');
    await switchProfile(page);
    const asha = page.locator('.acct-row', { hasText: STUDENT.name });
    await check('the picker files her under Class 10', /Class 10/.test(await asha.innerText()) && !/\bYear\b/.test(await asha.innerText()),
      `row reads ${JSON.stringify(await asha.innerText())}`);
    await check('the picker offers no demo and no account-less entry — another Pri account, or a saved profile',
      await page.getByRole('button', { name: /Try the demo/i }).count() === 0 && await page.getByTestId('picker-create-account').isVisible());
    await asha.click();
    await page.waitForSelector('.home-greet', { timeout: 30000 });
    await check('choosing the saved profile opens Home again on the same live session, with no second sign-in',
      await page.locator('[data-testid="account-activation-gate"]').count() === 0 && (await page.locator('.home-greet').innerText()).includes('Asha'));

    // ── 5 · Settings is already the account’s ───────────────────────────────
    await goto('/settings');
    await page.locator('#cloud-account-title').waitFor({ timeout: 30000 });
    await settle();
    const panel = page.locator('section', { has: page.locator('#cloud-account-title') });
    await check('Settings shows the account connected, with no second email login asked for',
      /Connected/.test(await panel.innerText()) && await panel.locator('#cloud-password').count() === 0,
      `panel reads ${JSON.stringify((await panel.innerText()).slice(0, 160))}`);
    const actual = await page.evaluate(async () => {
      const r = await fetch('/v1/account/me', { credentials: 'include' });
      return r.ok ? (await r.json()).account?.id : null;
    });
    await check('the live session is the account the card made', String(actual) === String(member.accountId));
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
