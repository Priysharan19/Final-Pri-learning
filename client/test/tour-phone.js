// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · E2E flow — the app on a phone.
//
// Most students in India will meet Pri on a phone, not an iPad, and every other
// browser flow runs at 1440×900. At 390 px the bottom bar holds five slots, and
// before the More sheet existed three destinations — Exams, Favorites and
// Classes — had no entry point at all: a student on a phone could not reach an
// exam simulation.
//
// This flow walks the phone: sign up, reach every destination, answer a
// question, and check the page never scrolls sideways and never asks for a tap
// target too small to hit.
//
// Run on its own:  node client/test/tour-phone.js
// ─────────────────────────────────────────────────────────────────────────────
import { pathToFileURL } from 'node:url';

const PHONE = { width: 390, height: 844 };   // iPhone 12/13/14
const SMALL = { width: 360, height: 800 };   // a common Android width

export const flow = {
  id: 'phone',
  name: 'Phone · every destination reachable at 390px',

  async run({ page, base, check, note, goto, createProfile, settle }) {
    await page.setViewportSize(PHONE);
    await goto('/');
    await createProfile({ name: 'Phone Student', year: 10, course: 'in' });
    await settle();

    // ── 1 · the bottom bar ───────────────────────────────────────────────────
    const bar = page.locator('.mobilenav');
    await check('the bottom bar is shown on a phone', await bar.isVisible());
    await check('the sidebar is not', !(await page.locator('.sidebar').isVisible().catch(() => false)));

    const hrefsNow = () => page.locator('a[href]:visible')
      .evaluateAll(els => [...new Set(els.map(e => e.getAttribute('href')).filter(h => h && h.startsWith('/')))]);

    const onBar = await hrefsNow();
    await check('the bar itself holds four destinations plus More',
      await page.locator('.mnav-item').count() === 5, `${await page.locator('.mnav-item').count()} slots`);

    // ── 2 · everything else is behind More ───────────────────────────────────
    const more = page.getByRole('button', { name: 'More' });
    await check('there is a More button', await more.count() === 1);
    await check('and it says whether it is open', await more.getAttribute('aria-expanded') === 'false');
    await more.click();
    await settle();
    await check('opening More reports itself open', await more.getAttribute('aria-expanded') === 'true');

    const reachable = await hrefsNow();
    for (const path of ['/', '/tasks', '/match', '/progress', '/exams', '/favorites', '/classes', '/settings', '/history']) {
      await check(`a student on a phone can reach ${path}`, reachable.includes(path),
        `reachable: ${JSON.stringify(reachable.sort())}`);
    }
    await check('the sheet adds what the bar could not hold',
      reachable.length > onBar.length, `${onBar.length} on the bar, ${reachable.length} with More open`);

    // ── 3 · it closes, and it goes where it says ─────────────────────────────
    await page.locator('.mnav-sheet-item[href="/exams"]').click();
    await settle();
    await check('choosing Exams goes to Exams', new URL(page.url()).pathname === '/exams', `landed on ${page.url()}`);
    await check('and the sheet closed behind it', await page.locator('.mnav-sheet').count() === 0);

    // ── 4 · nothing is too small to hit, nothing overflows ───────────────────
    for (const [size, label] of [[PHONE, '390px'], [SMALL, '360px']]) {
      await page.setViewportSize(size);
      await goto('/');
      await settle();
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      await check(`the page does not scroll sideways at ${label}`, overflow <= 1, `${overflow}px of horizontal overflow`);

      const tooSmall = await page.evaluate(() => [...document.querySelectorAll('.mnav-item, .mnav-sheet-item')]
        .filter(el => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && (r.height < 44 || r.width < 44);
        })
        .map(el => el.textContent.trim().slice(0, 20)));
      await check(`every navigation target is at least 44px at ${label}`, tooSmall.length === 0, JSON.stringify(tooSmall));
    }

    // ── 5 · a question can actually be answered ──────────────────────────────
    await page.setViewportSize(PHONE);
    await goto('/practice');
    await page.waitForSelector('.q-prompt', { timeout: 30000 }).catch(() => null);
    await settle();
    await check('a question renders on a phone', await page.locator('.q-prompt').count() === 1);
    const typeTab = page.getByRole('button', { name: 'Answer by typing' });
    if (await typeTab.count()) { await typeTab.click(); await settle(); }
    const box = page.locator('.editor-body input.answer-input');
    if (await box.count()) {
      const inside = await page.evaluate(() => {
        const el = document.querySelector('.editor-body input.answer-input');
        const r = el.getBoundingClientRect();
        return r.left >= -1 && r.right <= document.documentElement.clientWidth + 1;
      });
      await check('the answer box fits the screen', inside);
    } else {
      note('this question does not take a typed answer; the box is covered by the desktop flow');
    }
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
