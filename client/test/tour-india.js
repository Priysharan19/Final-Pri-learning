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
    await check('the privacy copy is offline-first, optional cloud, no ads',
      /offline-first/i.test(privacy) && /cloud account is optional/i.test(privacy) && /no ads/i.test(privacy),
      `privacy copy reads ${JSON.stringify(privacy)}`);
    for (const [label, href] of [['Privacy', '/privacy'], ['Terms', '/terms'], ['Refunds', '/refund-policy'], ['Grievances', '/grievance']]) {
      await check(`the landing screen links to ${label.toLowerCase()}`,
        await page.locator(`.auth-col a[href="${href}"]`).count() === 1, `${label} -> ${href}`);
    }
    await check('the landing screen offers the cloud account sign-in',
      await page.getByRole('button', { name: 'Sign in to your Pri cloud account' }).count() === 1);
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

    // ── 2 · the sign-up form opens on India ──────────────────────────────────
    await page.getByRole('button', { name: 'Get Started' }).click();
    await page.waitForSelector('.sso-btn', { timeout: 15000 });
    await page.getByRole('button', { name: /Continue without an email/ }).click();
    await page.waitForSelector('.auth-card input.input', { timeout: 15000 });
    const first = page.locator('.auth-card select').first();
    await check('the first control is the class / track picker', (await first.getAttribute('id')) === 'signup-track',
      `first select is #${await first.getAttribute('id')}`);
    const options = await first.locator('option').allInnerTexts();
    await check('it offers Classes 7–12, JEE Main, JEE Advanced and Olympiad',
      options[0] === 'Class 7' && options[5] === 'Class 12' && options.includes('JEE Main') && options.includes('JEE Advanced') && options.some(o => /^Olympiad/.test(o)),
      `options are ${JSON.stringify(options)}`);
    await check('Class 10 is the default', (await first.inputValue()) === '10', `default is ${JSON.stringify(await first.inputValue())}`);
    await check('the Australian syllabuses are folded away behind one link',
      await page.locator('#signup-course').count() === 0 && await page.getByRole('button', { name: /Studying in Australia/ }).count() === 1);
    const formText = await page.locator('.auth-card').innerText();
    await check('the India form never says Year or HSC', !/\bYear\b/.test(formText) && !HSC.test(formText),
      `form reads ${JSON.stringify(formText.slice(0, 200))}`);
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.waitForSelector('.sso-btn', { timeout: 15000 });
    const disclosure = await page.locator('.auth-note').innerText();
    await check('the method stage says the cloud account is a separate, optional step',
      /this device/i.test(disclosure) && /never sent/i.test(disclosure) && /optional/i.test(disclosure),
      `disclosure reads ${JSON.stringify(disclosure)}`);

    // ── 3 · a Class 10 profile lands on Home, labelled by class ──────────────
    await goto('/');
    await createProfile(STUDENT);
    await check('creating the profile lands on Home as Asha',
      (await page.locator('.home-greet').innerText()).includes('Asha'));
    await page.waitForSelector('.genbar-chips .chip', { timeout: 15000 });
    const chips = await page.locator('.genbar-chips').innerText();
    await check('Home targets Class 10, not Year 10', /Class 10/.test(chips) && !/\bYear\b/.test(chips),
      `chips read ${JSON.stringify(chips)}`);
    await page.locator('.genbar-toggle').click();
    await settle();
    const cats = await page.locator('.gen-cats').innerText();
    await check('the generator speaks in classes and tracks', /Class/.test(cats) && /Track/.test(cats) && !/\bYear\b/.test(cats),
      `categories read ${JSON.stringify(cats)}`);
    await check('the week strip draws seven days in the profile’s week', await page.locator('.week-day').count() === 7,
      `${await page.locator('.week-day').count()} days drawn`);
    const nav = await page.locator('.sidebar').innerText();
    await check('the navigation carries no NSW jargon', !HSC.test(nav) && !/\bYear\b/.test(nav), `nav reads ${JSON.stringify(nav)}`);

    await switchProfile(page);
    const asha = page.locator('.acct-row', { hasText: STUDENT.name });
    await check('the picker files her under Class 10', /Class 10/.test(await asha.innerText()) && !/\bYear\b/.test(await asha.innerText()),
      `row reads ${JSON.stringify(await asha.innerText())}`);

    // ── 4 · the demo is an Indian Class 10 student ───────────────────────────
    await page.getByRole('button', { name: /Try the demo/ }).click();
    await page.waitForSelector('.home-greet', { timeout: 120000 });
    await check('the demo signs in as Pri', (await page.locator('.user-chip').innerText()).includes('Pri'));
    await page.waitForSelector('.genbar-chips .chip', { timeout: 15000 });
    await check('the demo practises Class 10', /Class 10/.test(await page.locator('.genbar-chips').innerText()),
      `chips read ${JSON.stringify(await page.locator('.genbar-chips').innerText())}`);
    await check('the demo arrives with a streak', /\d+-day streak/.test(await page.locator('.goal-sub').innerText()),
      `goal card reads ${JSON.stringify(await page.locator('.goal-sub').innerText())}`);

    await page.goto(`${base}/progress`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.syl-table', { timeout: 30000 });
    const progressTitle = await page.locator('main h1').innerText();
    await check('Progress is the India presentation for Class 10', /Class 10 CBSE \/ NCERT progress/.test(progressTitle),
      `heading reads ${JSON.stringify(progressTitle)}`);
    const started = await page.locator('.grid.cols-4 .card').first().innerText();
    const startedN = Number((/(\d+)\s*\/\s*(\d+)/.exec(started.replace(/\s+/g, ' ')) || [])[1]);
    await check('the demo has NCERT chapters started', startedN >= 8, `chapters card reads ${JSON.stringify(started)}`);
    await check('Progress never predicts a board mark', await page.locator('text=No predicted board/JEE score').count() === 1);
    note(`the demo opens with ${started.replace(/\s+/g, ' ').trim()}`);

    await page.goto(`${base}/history`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.hist-row', { timeout: 30000 });
    const rows = await page.locator('.hist-row').count();
    await check('History has the demo’s recent questions', rows > 0, `${rows} rows`);
    const names = await page.locator('.hist-name').allInnerTexts();
    await check('every History row is named by its NCERT chapter', names.length > 0 && names.every(n => n && n !== 'Custom question'),
      `names are ${JSON.stringify(names.slice(0, 6))}`);
    const stamp = await page.locator('.hist-top .muted').first().innerText();
    await check('dates are written day-month in the profile’s locale', /^\d{1,2} [A-Z][a-z]{2,4}$/.test(stamp.trim()), `stamp reads ${JSON.stringify(stamp)}`);
    const sub = await page.locator('main p.sub').first().innerText();
    await check('History does not call the device an iPad', !/iPad/.test(sub), `copy reads ${JSON.stringify(sub)}`);

    // ── 5 · the way to the cloud account ─────────────────────────────────────
    await switchProfile(page);
    await page.getByRole('button', { name: 'Sign in to your Pri cloud account' }).click();
    await check('choosing the cloud sign-in explains the next step',
      /cloud account/i.test(await page.locator('.cloud-intent').innerText()));
    await page.locator('.acct-row', { hasText: 'Pri' }).first().click();
    await page.waitForSelector('#cloud-account-title', { timeout: 30000 });
    await settle();
    await check('opening a profile lands in Settings', new URL(page.url()).pathname === '/settings', `landed on ${page.url()}`);
    // innerText is the RENDERED text, and the card title is uppercased in CSS.
    const cloudTitle = await page.locator('#cloud-account-title').innerText();
    await check('at the cloud account panel', /Account & cross-device sync/i.test(cloudTitle), `heading reads ${JSON.stringify(cloudTitle)}`);
    const inView = await page.evaluate(() => {
      const el = document.getElementById('cloud-account-title');
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.top >= 0 && r.top <= window.innerHeight;
    });
    await check('and the panel is scrolled into view', inView, 'the cloud account title is off-screen');
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
