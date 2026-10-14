// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · E2E flow — the app opens as an Indian product.
//
// Every other flow in this suite makes an Australian profile, so until this
// one existed not a single browser check ran as the student the product is
// now built for. This flow walks the India path the way a Class 10 student
// meets it: the landing copy, the first control on the sign-up form, the
// labels on Home and in the profile picker, the account-less demo, the
// History page, and the way from the landing screen to the cloud account.
//
// It asserts behaviour, not pixels: what the picker says a profile is, which
// chapters the demo has evidence for, where the cloud link actually lands.
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
    // The welcome screen now also carries the legal links in a muted line, so
    // the privacy copy is named rather than taken as the only muted paragraph.
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
    await check('the landing screen offers the real account sign-in',
      await page.getByRole('button', { name: 'I already have an account' }).count() === 1);
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

    // ── 2 · account-first setup asks email before curriculum ────────────────
    await page.getByTestId('hero-create-account').click();
    await page.waitForSelector('[data-signup-step="method"]', { timeout: 15000 });
    await check('email is the default sign-in method',
      await page.getByTestId('signup-channel-email').getAttribute('aria-checked') === 'true');
    await check('account-first onboarding asks for verified contact, not a local profile',
      await page.locator('#signup-destination[type="email"]').count() === 1 &&
      await page.locator('[data-onboarding-step="1"]').count() === 0);
    await goto('/');

    // ── 3 · a genuine verified Class 10 learner reaches the main app ────────
    const member = await createProfile(STUDENT);
    await check('a verified account lands on Home as Asha',
      (await page.locator('.home-greet').innerText()).includes('Asha'));
    await page.waitForSelector('.genbar-chips .chip', { timeout: 15000 });
    const chips = await page.locator('.genbar-chips').innerText();
    await check('Home targets Class 10, not Year 10', /Class 10/.test(chips) && !/\bYear\b/.test(chips),
      `chips read ${JSON.stringify(chips)}`);
    await page.locator('.genbar-toggle').click();
    await settle();
    const cats = await page.locator('.gen-cats').innerText();
    await check('generator offers classes and tracks, not the NSW syllabus',
      /Class/.test(cats) && /Track/.test(cats) && !HSC.test(cats));
    await check('the week strip draws seven days', await page.locator('.week-day').count() === 7);
    const nav = await page.locator('.sidebar').innerText();
    await check('navigation contains no HSC terminology', !HSC.test(nav) && !/\bYear\b/.test(nav));

    await goto('/progress');
    // IndiaProgress waits for both the server curriculum and stats before it
    // mounts its heading. The app shell can render first, so asserting the h1
    // immediately races its honest loading skeleton on slower CI runners.
    // An error is NOT treated as success: surface the real page state below.
    await page.locator('main .pg-head h1, main [role="alert"]').first()
      .waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
    const progressHeadings = page.locator('main .pg-head h1');
    const progressHeading = await progressHeadings.count() === 1
      ? await progressHeadings.innerText() : '';
    await check('Class 10 learner can open the real progress page',
      await progressHeadings.count() === 1 && /Class 10/.test(progressHeading),
      `URL ${page.url()}, heading ${JSON.stringify(progressHeading)}, screen ${JSON.stringify((await page.locator('main').innerText().catch(() => '')).slice(0, 400))}`);
    await check('fresh profile does not pretend to have studied before',
      !/\bPri demo\b/i.test(await page.locator('main').innerText()));
    await goto('/history');
    await check('new learner sees truthful empty or new history rather than seeded demo history',
      await page.locator('.hist-row').count() === 0 ||
      !(await page.locator('main').innerText()).includes('Pri demo'));

    // ── 4 · a demo profile cannot bypass verified account activation ────────
    await goto('/');
    await switchProfile(page);
    const saved = page.locator('.acct-row', { hasText: STUDENT.name });
    await check('the picker retains the real Class 10 device profile',
      await saved.count() === 1 && /Class 10/.test(await saved.innerText()));
    await page.getByRole('button', { name: /Try the demo/i }).click();
    await page.waitForSelector('[data-testid="account-activation-gate"]', { timeout: 30000 });
    await check('a local demo cannot enter the student app without authentication',
      await page.locator('.shell').count() === 0);
    await page.getByRole('button', { name: 'Use another profile' }).click();
    await page.waitForSelector('.acct-list', { timeout: 15000 });
    await page.locator('.acct-row', { hasText: STUDENT.name }).click();
    await page.waitForSelector('.home-greet', { timeout: 30000 });
    await check('selecting the verified account recovers Home without a second sign-in',
      await page.locator('[data-testid="account-activation-gate"]').count() === 0);

    // ── 5 · Settings reflects the account already signed in ────────────────
    await goto('/settings');
    const card = page.locator('#cloud-account-title');
    await check('Settings still provides account and cross-device sync controls',
      await card.count() === 1);
    await check('Settings does not force a second email login after onboarding',
      await page.locator('#cloud-password').count() === 0);
    const actual = await page.evaluate(async () => {
      const r = await fetch('/v1/account/me', { credentials: 'include' });
      return r.ok ? (await r.json()).account?.id : null;
    });
    await check('the verified cloud identity remains unchanged after profile recovery',
      String(actual) === String(member.accountId));

  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
