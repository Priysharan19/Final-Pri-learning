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

  async run({ page, ctx, base, check, note, goto, createProfile, settle }) {
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
    // Whether a given question takes a typed answer depends on which one was
    // served, so this is one check either way rather than a conditional one:
    // a suite whose check count moves with the draw cannot be gated on.
    const fits = await page.evaluate(() => {
      const el = document.querySelector('.editor-body input.answer-input');
      if (!el) return 'no-typed-answer';
      const r = el.getBoundingClientRect();
      return r.left >= -1 && r.right <= document.documentElement.clientWidth + 1 ? 'fits' : 'overflows';
    });
    await check('a typed answer box, when this question has one, fits the screen', fits !== 'overflows', `answer box: ${fits}`);
    if (fits === 'no-typed-answer') note('this question does not take a typed answer; the box is covered by the desktop flow');

    // ── 6 · every destination fits the screen, not just Home ─────────────────
    // Checking Home alone was checking the one page that already fitted. Three
    // of the others did not: Progress ran 66 px past the right-hand edge at
    // 375 px with its "Practise" buttons off-screen, Practice ran 166 px past
    // it, and Settings 11 px. All three were a grid track or a flex item whose
    // automatic minimum is its content, and all three are now pinned here —
    // both at 390 px and at the 360 px an entry-level Android gives you.
    for (const [size, label] of [[PHONE, '390px'], [SMALL, '360px']]) {
      await page.setViewportSize(size);
      for (const path of ['/', '/tasks', '/match', '/progress', '/exams', '/settings', '/history', '/practice']) {
        await goto(path);
        await page.waitForTimeout(900);
        const over = await page.evaluate(() =>
          document.documentElement.scrollWidth - document.documentElement.clientWidth);
        await check(`${path} does not scroll sideways at ${label}`, over <= 1, `${over}px of horizontal overflow`);
      }
    }

    // ── 7 · the control a student presses most is reachable ──────────────────
    // "Next question" lives in the context pill at the foot of the practice
    // page. On a phone that pill sat at bottom:18px, behind a bottom navigation
    // bar 64 px tall and two stacking levels above it, and squeezed to 22 px
    // wide by a page narrower than the pill. It was the most-used control in
    // the product and it could not be pressed.
    await page.setViewportSize(PHONE);
    await goto('/practice');
    await page.waitForSelector('.q-prompt', { timeout: 30000 }).catch(() => null);
    await settle();
    const nextBtn = await page.evaluate(() => {
      const el = document.querySelector('.ctx-next');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      const bar = document.querySelector('.mobilenav')?.getBoundingClientRect();
      return {
        w: Math.round(r.width), h: Math.round(r.height),
        onTop: Boolean(hit && (el === hit || el.contains(hit))),
        clearOfBar: !bar || r.bottom <= bar.top + 1,
        insideScreen: r.right <= document.documentElement.clientWidth + 1
      };
    });
    await check('the practice page offers a next-question control on a phone', nextBtn !== null);
    await check('it is wide enough to press', (nextBtn?.w ?? 0) >= 44 && (nextBtn?.h ?? 0) >= 44, JSON.stringify(nextBtn));
    await check('nothing is covering it', nextBtn?.onTop === true, JSON.stringify(nextBtn));
    await check('it sits clear of the bottom navigation bar', nextBtn?.clearOfBar === true, JSON.stringify(nextBtn));
    await check('and inside the screen', nextBtn?.insideScreen === true, JSON.stringify(nextBtn));

    // ── 8 · answering targets a finger can land on ───────────────────────────
    // The tabs that switch between typing, writing and photographing an answer,
    // the pen and eraser, and the hint bulbs were 28–36 px on a device whose
    // pointer is about 9 mm across. They are 44 px on a coarse pointer now.
    // Playwright's context has touch, so the coarse-pointer rules are live.
    const targets = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('.mode-tab, .q-rail-btn, .hint-bulb, .ink-tool, .editor-tool, .pill-opt')) {
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        if (r.height < 44) out.push(`${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 22)} ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
      return out;
    });
    await check('every answering control is at least 44px tall on a touch phone', targets.length === 0, JSON.stringify(targets));

    // The three deliberately tiny ones keep their size and get the hit area
    // underneath instead, so this asks the question a finger asks: press 18 px
    // off centre and see what answers.
    await goto('/');
    await settle();
    const nearMiss = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('.chip-x, .home-card-x, .genbar-toggle')) {
        if (!el.getBoundingClientRect().width) continue;
        // Into the middle of the screen first: a control that happens to be
        // scrolled under the fixed bottom bar is a scroll position, not a
        // hit-area failure, and this check is about the hit area.
        el.scrollIntoView({ block: 'center' });
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2 + 18);
        if (!hit || !(el === hit || el.contains(hit))) {
          out.push(`${(el.getAttribute('aria-label') || el.textContent || el.className).trim().slice(0, 26)} → ${hit ? hit.tagName + '.' + (hit.className || '') : 'nothing'}`);
        }
      }
      return out;
    });
    await check('a press 18px below a small icon button still lands on it', nearMiss.length === 0, JSON.stringify(nearMiss));

    // ── 9 · nothing on Home is clipped out of reach ──────────────────────────
    // The home strip laid two cards side by side inside overflow:hidden. At
    // 375 px the second card — "Smart practice", and the control that dismisses
    // the strip — was cut off with no way to scroll to it.
    const stripped = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('div, section, ul')) {
        if (el.clientWidth < 60) continue;
        const hidden = el.scrollWidth - el.clientWidth;
        if (hidden > 4 && getComputedStyle(el).overflowX === 'hidden') {
          out.push(`${el.className || el.tagName} hides ${hidden}px`);
        }
      }
      return out;
    });
    await check('no block on Home hides content it gives no way to scroll to', stripped.length === 0, JSON.stringify(stripped));

    // ── 10 · and it still works with the network gone ────────────────────────
    // This is the check that guards the install budget. Six years of question
    // banks are no longer written by the install: api.js pulls the two a
    // profile actually practises from — its own year and the revision year
    // below it — the moment that profile signs in, and the worker's runtime
    // rule keeps them. If that ever stops happening, the saving turns into a
    // student who cannot practise on the bus, and this goes red rather than
    // the byte count going quietly up.
    await goto('/practice');
    await page.waitForSelector('.q-prompt', { timeout: 30000 }).catch(() => null);
    await settle();
    const claimed = await page.waitForFunction(() => !!navigator.serviceWorker?.controller, null, { timeout: 30000 })
      .then(() => true).catch(() => false);
    if (await check('a worker is in charge before the network is cut', claimed,
      'no worker claimed the page, so nothing below would prove anything')) {
      // Let the second pass finish, so this measures the state a student is in
      // a few seconds after arriving rather than a race.
      await page.evaluate(() => new Promise((done) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = () => done(true);
        navigator.serviceWorker.controller.postMessage({ type: 'pri-warm' }, [channel.port2]);
        setTimeout(() => done(false), 60000);
      })).catch(() => false);

      await ctx.setOffline(true);
      await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => { });
      const shell = await page.waitForSelector('.mobilenav', { timeout: 30000 }).then(() => true).catch(() => false);
      await check('the app opens with the network switched off', shell, 'a reload with the network down never painted the shell');

      await page.goto(`${base}/practice`, { waitUntil: 'domcontentloaded' }).catch(() => { });
      const offlineQuestion = await page.waitForSelector('.q-prompt', { timeout: 30000 }).then(() => true).catch(() => false);
      await check('and a question can still be drawn from the offline banks', offlineQuestion,
        'the practice page did not produce a question with the network down — the year bank was not in the cache');
      await ctx.setOffline(false);
    }
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
