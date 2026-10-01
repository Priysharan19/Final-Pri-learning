// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · E2E flow — onboarding → placement check → Class 7 → JEE map.
//
// A Class 11 India student is made through the real staged onboarding, is
// offered the placement check on Home, starts it, has the exact question
// survive a reload, answers through the real practice question card in its
// diagnostic mode (typed answers and "I don't know" — the handwriting path is
// the same card and is driven by tour-ink.js), and lands on the result: strand
// estimates, traced gaps and the map. The answers here are not chosen to be
// right, so the flow asserts the shape and the honesty of what is shown, not a
// particular level.
//
// Run on its own:  node client/test/tour-placement.js
// ─────────────────────────────────────────────────────────────────────────────
import { pathToFileURL } from 'node:url';

export const flow = {
  id: 'placement',
  name: 'Placement · onboarding → diagnostic → evidence map',

  async run({ page, check, goto, createProfile, settle }) {
    await goto('/');
    // Type mode is the deterministic way to drive the card from a script; the
    // write tab is the same card and has its own flow.
    await page.evaluate(() => localStorage.setItem('pri-input-mode', 'type'));
    await createProfile({ name: 'Nisha Rao', year: 11, course: 'in' });

    // ── 1 · Home offers the check after onboarding ───────────────────────────
    const offer = page.locator('[data-placement-card="none"]');
    await offer.waitFor({ timeout: 30000 }).catch(() => { });
    await check('Home offers the placement check after onboarding', await offer.count() === 1);
    await check('the offer says it is optional', /optional/i.test(await offer.innerText().catch(() => '')));
    await check('the offer can be declined', await offer.getByRole('button', { name: 'Not now' }).count() === 1);
    await offer.getByRole('button', { name: 'Start the placement check' }).click();

    // ── 2 · the first question, and it survives a reload ─────────────────────
    await page.waitForSelector('.q-prompt', { timeout: 30000 });
    const status = await page.locator('.pm-progress').innerText();
    await check('the progress line counts toward about ten, at most twelve', /Question 1 of about 10 \(at most 12\)/.test(status), status);
    await check('the first probe is at the student\'s own class', await page.locator('[data-placement-phase="anchor"]').count() === 1);
    await check('no hints are offered', await page.locator('.hint-bulb').count() === 0);
    await check('no reveal is offered — only "I don\'t know"',
      await page.getByRole('button', { name: 'Show solution' }).count() === 0 &&
      await page.getByRole('button', { name: /I don.t know/ }).count() === 1);
    await check('the handwriting tab is on the card', await page.getByRole('button', { name: /handwriting|Write/i }).count() >= 1);
    const firstPrompt = (await page.locator('.q-prompt').innerText()).trim();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.q-prompt', { timeout: 30000 });
    await check('after a reload the exact question is resumed', (await page.locator('.q-prompt').innerText()).trim() === firstPrompt);

    // ── 3 · answer through to the end ────────────────────────────────────────
    let asked = 0;
    for (; asked < 14; asked++) {
      const prompt = page.locator('.q-prompt');
      if (!(await prompt.count())) break;
      const mcq = page.locator('.mcq button:visible').first();
      const input = page.locator('.answer-input:visible').first();
      const working = page.locator('.working-input:visible').first();
      if (asked % 3 === 2) {
        await page.getByRole('button', { name: /I don.t know/ }).click();
      } else if (await mcq.count()) {
        await mcq.click();
        await page.locator('.row.no-print .btn-primary:visible').first().click();
      } else if (await input.count()) {
        await input.fill('0');
        await page.locator('.editor-foot .btn-primary:visible').first().click();
      } else if (await working.count()) {
        await working.fill('0');
        await page.locator('.editor-foot .btn-primary:visible').first().click();
      } else {
        await page.getByRole('button', { name: /I don.t know/ }).click();
      }
      // An unreadable answer stays on the question; fall back to "I don't know".
      const next = page.locator('[data-placement-next]');
      await next.waitFor({ timeout: 8000 }).catch(() => { });
      if (!(await next.count())) {
        await page.getByRole('button', { name: /I don.t know/ }).click();
        await next.waitFor({ timeout: 15000 });
      }
      if (asked === 0) {
        await check('a marked answer shows the evaluation card', await page.locator('.eval-card').count() === 1);
        await check('and says the mark is diagnostic evidence only', /diagnostic evidence only/.test(await page.locator('.eval-card').innerText()));
        await check('no XP or mastery tags appear on a diagnostic item', await page.locator('.xp-pop').count() === 0 && !/Mastery/.test(await page.locator('.eval-card').innerText()));
      }
      const label = (await next.innerText()).trim();
      await next.click();
      if (/See my map/.test(label)) { asked++; break; }
      await page.waitForSelector('.q-prompt', { timeout: 30000 });
    }
    await check('the check ended within twelve questions', asked >= 1 && asked <= 12, `${asked} answered`);

    // ── 4 · the result and the map ───────────────────────────────────────────
    await page.waitForSelector('.pm-map', { timeout: 30000 });
    await settle();
    const body = await page.locator('main, .shell').first().innerText();
    await check('the result is called an estimate', /estimate/i.test(body));
    await check('the result says it is diagnostic evidence, not mastery', /diagnostic evidence/.test(body) && /not a mastery score/.test(body));
    await check('the graph\'s provenance is stated, not claimed as official', /not an NCERT or CBSE publication/.test(body));
    await check('confidence is never shown as high', !/High confidence/i.test(body));
    await check('the map is called an evidence map, not a mastery map', /Evidence map/i.test(body) && !/Mastery map/i.test(body));
    await check('the legend can show practice and the check disagreeing', /Practised well · missed in the check/.test(await page.locator('.pm-legend').innerText()));
    await check('the result says it reorders smart practice', /reorder smart practice/.test(body));
    const cut = page.locator('[data-stopped-by]');
    if (await cut.count()) await check('a trace cut short says why it stopped', /question limit|12-question limit/.test(await cut.first().innerText()));
    const headers = await page.locator('.pm-map thead th').allInnerTexts();
    await check('the map runs Class 7 → 12 and then JEE', headers.join('|').includes('Class 7') && headers.join('|').includes('Class 12') && /JEE/.test(headers.at(-1) || ''), headers.join('|'));
    await check('the map has a row per strand', await page.locator('.pm-map tbody tr').count() === 7);
    await check('every Class 7–12 chapter is on the map', await page.locator('.pm-map [data-chapter]').count() >= 77);
    const tested = await page.locator('.pm-map [data-status="root-gap"], .pm-map [data-status="gap"], .pm-map [data-status="secure"]').count();
    await check('the questions asked are marked on the map', tested >= 1, `${tested} tested chips`);
    const roots = page.locator('[data-root-gap]');
    if (await roots.count()) {
      const chain = await roots.first().locator('.pm-chain').getAttribute('data-chain');
      await check('a traced gap shows its chain', !!chain && chain.length > 3, chain);
      await check('the root gap is highlighted on the map', await page.locator('.pm-map .pm-root-gap').count() >= 1);
      await check('a root gap can be practised directly', await roots.first().getByRole('button', { name: /^Practise / }).count() === 1);
    } else {
      await check('with no traced gap the page says so', /No gap was traced/.test(body));
    }

    // ── 5 · the page fits a phone ────────────────────────────────────────────
    await page.setViewportSize({ width: 390, height: 844 });
    await settle();
    await check('the result page has no horizontal page scroll at 390px',
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
    await page.setViewportSize({ width: 1440, height: 900 });

    // ── 6 · Home and Progress now point at the result ────────────────────────
    await goto('/');
    await page.waitForSelector('[data-placement-card="finished"]', { timeout: 30000 }).catch(() => { });
    await check('Home now shows the finished check', await page.locator('[data-placement-card="finished"]').count() === 1);
    await goto('/progress');
    await page.waitForSelector('[data-placement-entry]', { timeout: 30000 }).catch(() => { });
    await check('Progress links to the placement map', await page.locator('[data-placement-entry]').count() === 1);
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
