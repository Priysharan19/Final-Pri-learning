// Pri Learning · E2E flow — the Instrument interface, the one student interface
// every build ships (client/interface.config.mjs, V1 decision D7).
//
// Walks the shell as a signed-in Class 10 student, in paper and night, at
// phone, tablet and web (every other browser suite now runs on the same
// interface; this one owns its own shell, Index, command bar and offline tabs):
//   · the interface is really the Instrument: html.ui-instrument, the tab bar, no rail;
//   · the Index lists the syllabus from the server, a chapter opens its plate,
//     the plate's figures are the server's (answers / correct), accuracy is
//     withheld below the floor, and the scope actually draws;
//   · Practise this chapter opens Practice for that chapter;
//   · ⌘K opens the command bar, typing filters, ↵ opens, esc closes and focus
//     returns to where it was;
//   · the theme follows the device for a profile with no saved choice;
//   · every control has an accessible name; phone controls are ≥ 44×44;
//   · nothing moves after paint (Chromium layout-shift entries).
// Screens are written to PRI_VISUAL_OUT (or a temp dir) for review.
//
// Usage: node client/test/tour-instrument.js [--no-build] [--browser=webkit]
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { handwrite, pressRead, turnOnServerReading } from './fakeServerReader.js';
import { SYNTHETIC_EVIDENCE } from './support/online-session.mjs';
import en from '../src/i18n/strings.en.js';
import hi from '../src/i18n/strings.hi.js';
import { englishInterfaceForms, leaksOnPage } from './support/hindi-fallback.mjs';

const SIZES = [
  { id: 'phone', width: 390, height: 844, phone: true },
  { id: 'tablet', width: 820, height: 1180, phone: false },
  { id: 'web', width: 1440, height: 900, phone: false }
];

const AUDIT = () => {
  const visible = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const nameOf = el => (el.getAttribute('aria-label') || (el.labels && [...el.labels].map(l => l.textContent).join(' ')) || el.getAttribute('title') || el.textContent || '').trim();
  const controls = [...document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role=button]')]
    .filter(el => visible(el) && !el.closest('[aria-hidden="true"], [inert]'));
  const unnamed = controls.filter(el => !nameOf(el)).map(el => `${el.tagName}.${String(el.className).slice(0, 40)}`);
  // The hit area, not the drawn box, probed 21px either side of the centre
  // (the same measurement as tour-interface-quality.js). The control is
  // scrolled into view first: elementFromPoint answers null for any point
  // outside the viewport, so a control below the fold could never pass, and
  // the Index is now taller than a phone screen.
  const small = controls.filter(el => {
    el.scrollIntoView({ block: 'center', inline: 'center' });
    const r = el.getBoundingClientRect();
    if (r.width >= 43.5 && r.height >= 43.5) return false;
    const cx = r.left + r.width / 2; const cy = r.top + r.height / 2;
    const owns = (x, y) => { const h = document.elementFromPoint(x, y); return !!h && (h === el || el.contains(h)); };
    return ![[cx - 21, cy], [cx + 21, cy], [cx, cy - 21], [cx, cy + 21]].every(([x, y]) => owns(x, y));
  }).map(el => `${nameOf(el).slice(0, 24) || el.tagName} ${Math.round(el.getBoundingClientRect().width)}×${Math.round(el.getBoundingClientRect().height)}`);
  window.scrollTo(0, 0);
  return { count: controls.length, unnamed, small };
};

// The native shells' accessibility smoke, as android/app/src/androidTest/…/
// WebViewAccessibilityTest.kt writes it: every visible button or link has a
// name (aria-hidden subtrees included), and every visible .btn and phone-bar
// control is at least 43.5 px tall by its own box.
const SHELL_AUDIT = () => {
  const visible = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const nameOf = el => (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').trim();
  const out = [];
  for (const el of document.querySelectorAll('button, a[href], [role=button]')) if (visible(el) && !nameOf(el)) out.push(`unnamed ${el.tagName}.${el.className}`);
  for (const el of document.querySelectorAll('.btn, .mobilenav button, .mobilenav a')) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height < 43.5) out.push(`small target ${Math.round(r.height)}px ${nameOf(el).slice(0, 20)}`);
  }
  return out;
};

export const flow = {
  id: 'instrument',
  name: 'Instrument · v1.1 shell, Index, scope, command bar, theme, names, 44px, shift',
  online: true,

  async run({ page, check, goto, settle, createProfile, note, online, browserName = 'chromium' }) {
    const chromium = browserName === 'chromium';
    const outDir = join(process.env.PRI_VISUAL_OUT || mkdtempSync(join(tmpdir(), 'pri-instrument-')), `instrument-${browserName}`);
    mkdirSync(outDir, { recursive: true });
    note(`engine: ${browserName} · screens in ${outDir}`);

    // A new profile has no saved theme: the instrument follows the device.
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await goto('/');
    await settle();
    writeFileSync(join(outDir, 'signin-web-dark.png'), await page.screenshot({ animations: 'disabled' }));
    await check('the signed-out welcome is in the instrument material', await page.evaluate(() => document.documentElement.classList.contains('ui-instrument')));
    await check('signed out, the welcome follows the device theme too', await page.evaluate(() => document.documentElement.dataset.theme) === 'dark');
    await check('no ruled-paper backdrop on the instrument welcome', await page.evaluate(() => { const m = document.querySelector('.mathfield'); return !m || getComputedStyle(m).display === 'none'; }));
    await createProfile({ name: 'Aarav Instrument', year: 10, course: 'in' });
    await online.signIn({ name: 'Aarav Instrument' });
    await settle();
    await goto('/');
    await settle();

    await check('the flagged build is on: html.ui-instrument', await page.evaluate(() => document.documentElement.classList.contains('ui-instrument')));
    await check('the instrument bar replaces the rail', await page.locator('[data-instrument-bar]').count() === 1 && await page.locator('.sidebar').count() === 0);
    await check('a profile with no saved theme follows the device (dark here)', await page.evaluate(() => document.documentElement.dataset.theme) === 'dark');
    await check('interface type is Instrument Sans', /Instrument Sans/.test(await page.evaluate(() => getComputedStyle(document.body).fontFamily)));

    // The Index.
    await page.waitForSelector('[data-instrument-index] .in-ch', { timeout: 15000 });
    const chapters = await page.locator('.in-ch').count();
    await check('the Index lists the syllabus chapters from the server', chapters >= 5, `${chapters} chapters`);
    const second = page.locator('.in-ch').nth(1);
    const id = await second.getAttribute('data-chapter');
    const name = (await second.locator('.in-ch-t').evaluate(el => el.firstChild?.textContent || '')).trim();
    await second.click();
    await check('choosing a chapter opens its plate', await page.locator(`[data-instrument-plate="${id}"]`).count() === 1);
    await check('the plate is titled with that chapter', (await page.locator('#in-plate-title').textContent()).trim() === name, name);
    await check('the chosen chapter is announced as pressed', await second.getAttribute('aria-pressed') === 'true');
    // The plate's three figures (design s2): certified marks, questions, covered.
    const kpis = (await page.locator('.in-kpis b').allTextContents()).map(x => x.trim());
    await check('the plate has the three figures: marks, questions, covered', kpis.length === 3 && await page.locator('.in-kpis [data-plate-marks], .in-kpis [data-plate-questions], .in-kpis [data-plate-covered]').count() === 3, JSON.stringify(kpis));
    await check('a new student’s plate states no certified marks, 0 questions and 0% covered', kpis[0] === '—' && kpis[1] === '0' && /^(0%|—)$/.test(kpis[2]), JSON.stringify(kpis));
    await check('accuracy stays behind the floor: no topic states a percentage for a new student', !/\d%/.test(await page.locator('.in-exs').textContent().catch(() => '')));
    const drawn = await page.evaluate(() => {
      const c = document.querySelector('[data-instrument-scope] canvas'); if (!c || !c.width) return 0;
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let ink = 0;
      for (let i = 3; i < d.length; i += 16) if (d[i] > 0) ink++;
      return ink;
    });
    await check('the scope draws the chapter’s mathematics', drawn > 200, `${drawn} painted samples`);
    await check('the scope is labelled for assistive tech', !!(await page.locator('[data-instrument-scope]').getAttribute('aria-label')));
    writeFileSync(join(outDir, 'index-web-dark.png'), await page.screenshot({ animations: 'disabled' }));

    // The plate's topic row: the chapter's own dot points, each a way into practice.
    const dot = page.locator('[data-plate-dotpoint]').first();
    if (await check('the plate shows the chapter’s topics', await dot.count() === 1)) {
      await check('each topic is named, not an object', !/object Object/.test(await page.locator('.in-exs').textContent()));
      const href = await dot.getAttribute('href');
      await check('a topic opens practice for exactly that topic', /subtopic=/.test(href) && /dotpoint=0/.test(href), href);
    }
    await check('the plate states certified marks (none yet: —)', (await page.locator('[data-plate-marks] b').textContent()).trim() === '—');

    // Practise this chapter → Practice for that chapter.
    await page.locator('[data-instrument-practise]').click();
    await page.waitForURL(u => u.pathname === '/practice', { timeout: 10000 });
    await check('Practise this chapter opens Practice for that chapter', new URL(page.url()).searchParams.get('subtopic') === id, page.url());

    // Home parity (audit-interface item 2): what the v1.0 Home offered besides
    // the chapters is on the Index too, each as its own entry.
    await goto('/');
    await settle();
    await page.waitForSelector('[data-instrument-also]', { timeout: 15000 });
    await check('the Index offers the review queue', await page.locator('[data-instrument-review-queue]').count() === 1 && /\/practice$/.test(await page.locator('[data-instrument-review-queue]').getAttribute('href')));
    await check('a new student is told nothing is due, in words, with the shell’s own figure', await page.locator('[data-instrument-review-due="0"]').count() === 1 && /Nothing is due/.test(await page.locator('[data-instrument-review-due]').textContent()));
    await check('the Index offers the study plan', await page.locator('[data-instrument-plan][href="/plan"]').count() === 1);
    await check('the Index offers photo practice (the one link to /practise-photo)', await page.locator('[data-home-photo-practise][href="/practise-photo"]').count() === 1);
    await check('the Index offers the exact-topic generator', await page.locator('[data-instrument-generator] .genbar-toggle').count() === 1 && await page.getByTestId('choose-topic').count() === 1);
    await page.getByTestId('choose-topic').click();
    await page.waitForSelector('#gen-panel', { timeout: 10000 }).catch(() => {});
    await check('the generator opens on the Index and lists the class or track step', await page.locator('#gen-panel').count() === 1 && await page.locator('#gen-panel .gen-cat').count() === 5);
    // A new profile has no track chosen: the Topics step is disabled until
    // one is, so the pane offers the tracks first and choosing one moves on
    // to the topics (as on the v1.0 Home).
    const topicsTab = page.locator('.gen-cat', { hasText: en['home.catTopics'] });
    if (await topicsTab.isDisabled()) {
      await page.locator('#gen-pane .gen-opt').first().click();
      await page.waitForFunction(() => !!document.querySelector('.gen-cat[aria-selected="true"]:not([disabled])'), null, { timeout: 5000 }).catch(() => {});
    }
    await topicsTab.click();
    await check('its topics pane lists the syllabus chapters', await topicsTab.getAttribute('aria-selected') === 'true' && await page.locator('#gen-pane .gen-opt').count() >= 5, `${await page.locator('#gen-pane .gen-opt').count()} options`);
    await page.locator('#gen-pane .gen-opt:not([disabled])').first().click();
    await page.locator('.genbar-head .btn-ghost', { hasText: 'Generate' }).click();
    await page.waitForURL(/\/practice/, { timeout: 15000 }).catch(() => {});
    await check('Generate opens Practice for the chosen topic', /\/practice\?/.test(page.url()) && !!new URL(page.url()).searchParams.get('subtopic'), page.url());

    // Navigation parity: on an iPad and the web every non-tab destination has
    // a visible entry (the More menu beside the tabs); on a phone the Map has
    // a slot in the bottom bar and the rest sit behind More.
    await page.setViewportSize({ width: 820, height: 1180 });
    await goto('/');
    await settle();
    const moreBtn = page.locator('[data-instrument-more] .in-more');
    await check('iPad: a More menu button sits beside the tabs', await moreBtn.isVisible() && await moreBtn.getAttribute('aria-haspopup') === 'menu' && await moreBtn.getAttribute('aria-expanded') === 'false');
    await moreBtn.click();
    await page.waitForSelector('#in-more-menu[role=menu]', { timeout: 5000 }).catch(() => {});
    const moreItems = await page.locator('#in-more-menu [role=menuitem]').allTextContents();
    await check('iPad: More lists Exams, Tasks, Plan and Settings as menu items', ['Exams', 'Tasks', 'Plan', 'Settings'].every(w => moreItems.some(x => x.trim() === w)), JSON.stringify(moreItems));
    await check('iPad: opening More moves focus into the menu', await page.evaluate(() => document.activeElement?.getAttribute('role') === 'menuitem'));
    await page.keyboard.press('Escape');
    await check('iPad: Escape closes More and returns focus to its button', await page.locator('#in-more-menu').count() === 0 && await page.evaluate(() => document.activeElement?.classList.contains('in-more')));
    await moreBtn.click();
    await page.locator('#in-more-menu [role=menuitem]', { hasText: 'Exams' }).click();
    await page.waitForURL(/\/exams$/, { timeout: 15000 }).catch(() => {});
    await check('iPad: choosing Exams from More opens Exams', new URL(page.url()).pathname === '/exams', page.url());
    await goto('/tasks'); await settle();
    await check('iPad: Tasks renders under the instrument bar', await page.locator('[data-instrument-bar]').count() === 1 && new URL(page.url()).pathname === '/tasks');
    await goto('/plan'); await settle();
    await check('iPad: Plan renders under the instrument bar', await page.locator('[data-instrument-bar]').count() === 1 && new URL(page.url()).pathname === '/plan');

    await page.setViewportSize({ width: 390, height: 844 });
    await goto('/');
    await settle();
    const barHrefs = await page.locator('.mobilenav .mnav-item[href]').evaluateAll(els => els.map(e => e.getAttribute('href')));
    await check('phone: the bottom bar holds Index, Practice, Map and Report', JSON.stringify(barHrefs) === JSON.stringify(['/', '/practice', '/map', '/progress']), JSON.stringify(barHrefs));
    await check('phone: the More menu beside the tabs is not drawn (the sheet has its list)', !(await page.locator('[data-instrument-more]').isVisible().catch(() => false)));
    await page.locator('.mobilenav .mnav-item[href="/map"]').click();
    await page.waitForSelector('[data-map-chapter]', { timeout: 15000 }).catch(() => {});
    await check('phone: the Map tab opens the Map', new URL(page.url()).pathname === '/map' && await page.locator('[data-map-chapter]').count() === chapters, page.url());
    await goto('/'); await settle();
    await page.getByRole('button', { name: 'More' }).click();
    await settle();
    const sheetHrefs = await page.locator('.mnav-sheet-item[href]').evaluateAll(els => els.map(e => e.getAttribute('href')));
    await check('phone: More holds Scripts, Notes, Plan, Tasks, Exams and Settings', ['/review', '/notes', '/plan', '/tasks', '/exams', '/settings'].every(h => sheetHrefs.includes(h)), JSON.stringify(sheetHrefs));
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 1440, height: 900 });
    await goto('/');
    await settle();

    // The command bar.
    const opener = page.locator('.in-cmd');
    await opener.focus();
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+k' : 'Control+k');
    await check('⌘K opens the command bar as a modal dialog', await page.locator('[data-instrument-command] [role=dialog][aria-modal=true]').count() === 1);
    await check('the query field has focus', await page.evaluate(() => document.activeElement?.getAttribute('role') === 'combobox'));
    await page.keyboard.type(name.slice(0, 5));
    await page.waitForTimeout(150);
    const first = (await page.locator('.in-pal-item[aria-selected=true] b').first().textContent() || '').trim();
    await check('typing filters to the matching chapter', first.toLowerCase().includes(name.slice(0, 5).toLowerCase()), first);
    await page.keyboard.press('Escape');
    await check('esc closes the command bar', await page.locator('[data-instrument-command]').count() === 0);
    await check('focus returns to what opened it', await page.evaluate(() => document.activeElement?.classList.contains('in-cmd')));
    // No wait between opening and typing: a key pressed the instant the bar
    // opens must land in the field.
    await opener.click();
    await page.keyboard.type(name.slice(0, 5));
    await check('keys typed the instant the bar opens land in the field', (await page.locator('.in-pal-q input').inputValue()) === name.slice(0, 5), await page.locator('.in-pal-q input').inputValue());
    await page.waitForTimeout(150);
    await page.keyboard.press('Enter');
    await page.waitForURL(u => u.pathname === '/practice', { timeout: 10000 });
    await check('↵ on a chapter opens Practice for it', new URL(page.url()).searchParams.get('subtopic') === id, page.url());

    // The syllabus map: one node per chapter, prerequisite edges drawn, a
    // node opens its card, and the card's Practise opens that chapter.
    await goto('/map');
    await settle();
    await page.waitForSelector('[data-instrument-map] [data-map-chapter]', { timeout: 15000 });
    const nodes = await page.locator('[data-map-chapter]').count();
    await check('the map shows one node per chapter', nodes === chapters, `${nodes} nodes, ${chapters} chapters`);
    await check('prerequisite edges are drawn between chapters', await page.locator('.in-map-edge').count() > 0);
    const third = page.locator('[data-map-chapter]').nth(2);
    const thirdId = await third.getAttribute('data-map-chapter');
    await third.focus();
    await check('focusing a node opens its card', await page.locator(`[data-map-card="${thirdId}"]`).count() === 1);
    await check('a node is a 44px target with a spoken name', await third.evaluate(el => el.getBoundingClientRect().width >= 43.5 && !!el.getAttribute('aria-label')));
    await check('a new student’s card shows no certified marks yet', await page.locator(`[data-map-card="${thirdId}"] [data-map-marks]`).getAttribute('data-map-marks') === 'none');
    await check('no chapter is recommended before there is any history', await page.locator('.in-map-node.is-next').count() === 0);
    // The constellation at desktop width: no two nodes or labels overlap, and
    // the floating card covers none of them.
    const mapGeo = () => page.evaluate(() => {
      const rects = [...document.querySelectorAll('[data-map-node]')].map(g => {
        const r = g.getBoundingClientRect(); return { id: g.getAttribute('data-map-node'), l: r.left, t: r.top, r: r.right, b: r.bottom };
      });
      const c = document.querySelector('[data-map-card]')?.getBoundingClientRect();
      const hit = (a, b) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
      const pairs = [];
      for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) if (hit(rects[i], rects[j])) pairs.push(`${rects[i].id}×${rects[j].id}`);
      const card = c ? { l: c.left, t: c.top, r: c.right, b: c.bottom } : null;
      return { n: rects.length, pairs, covered: card ? rects.filter(r => hit(r, card)).map(r => r.id) : [], floating: !!c && getComputedStyle(document.querySelector('[data-map-card]')).position === 'absolute' };
    });
    await page.setViewportSize({ width: 1240, height: 900 });
    await page.waitForTimeout(400);
    const narrow = await mapGeo();
    await check('at 1240px the card covers no node and no labels overlap', narrow.covered.length === 0 && narrow.pairs.length === 0, JSON.stringify({ floating: narrow.floating, covered: narrow.covered, pairs: narrow.pairs.slice(0, 4) }));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(400);
    const geo = await mapGeo();
    await check('the map draws every chapter as a positioned node', geo.n === chapters, `${geo.n} nodes`);
    await check('no two map nodes or labels overlap', geo.pairs.length === 0, geo.pairs.slice(0, 6).join(', '));
    await check('the card floats over the map at desktop width and covers no node', geo.floating && geo.covered.length === 0, JSON.stringify(geo.covered));
    await check('the map links are straight lines', (await page.locator('.in-map-edge').evaluateAll(es => es.every(e => / L /.test(e.getAttribute('d')) && !/Q/.test(e.getAttribute('d'))))));
    writeFileSync(join(outDir, 'map-web-dark.png'), await page.screenshot({ animations: 'disabled' }));
    await page.locator('[data-map-practise]').click();
    await page.waitForURL(u => u.pathname === '/practice', { timeout: 10000 });
    await check('the card’s Practise opens that chapter', new URL(page.url()).searchParams.get('subtopic') === thirdId, page.url());

    // Every size, both themes: names, 44px on phone, no shift after paint.
    if (chromium) {
      await page.addInitScript(() => {
        window.__priShift = 0;
        try { new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__priShift += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch { /* engine without it */ }
      });
    }
    const cdp = chromium ? await page.context().newCDPSession(page) : null;
    for (const size of SIZES) {
      await page.setViewportSize({ width: size.width, height: size.height });
      if (cdp) await cdp.send('Emulation.setTouchEmulationEnabled', size.phone ? { enabled: true, maxTouchPoints: 5 } : { enabled: false });
      for (const scheme of ['light', 'dark']) {
        await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
        await goto('/');
        await settle();
        await page.waitForSelector('.in-ch', { timeout: 15000 });
        const tag = `index@${size.id}/${scheme}`;
        await check(`${tag}: the theme follows the device`, await page.evaluate(() => document.documentElement.dataset.theme) === scheme);
        if (chromium) {
          await page.evaluate(() => { window.__priShift = 0; });
          await page.waitForTimeout(500);
          const shift = await page.evaluate(() => window.__priShift || 0);
          await check(`${tag}: no layout shift after paint`, shift < 0.001, `CLS ${shift.toFixed(4)}`);
        }
        const a = await page.evaluate(AUDIT);
        await check(`${tag}: every control has an accessible name`, a.unnamed.length === 0, JSON.stringify(a.unnamed.slice(0, 6)));
        if (size.phone && chromium) await check(`${tag}: every control is ≥ 44×44`, a.small.length === 0, JSON.stringify(a.small.slice(0, 8)));
        if (size.phone) {
          const unnamed = (await page.evaluate(SHELL_AUDIT)).filter(x => x.startsWith('unnamed'));
          await check(`${tag}: no button is unnamed, not even in the aria-hidden chapter strip (the shells' audit)`, unnamed.length === 0, JSON.stringify(unnamed.slice(0, 6)));
        }
        // iPad portrait: the spine kept no gutter (the greeting and resume
        // card ran into the edge) and the plate's figures clipped "Covered".
        if (size.id === 'tablet') {
          const fit = await page.evaluate(() => {
            const g = document.querySelector('.in-greet')?.getBoundingClientRect();
            const boxes = [...document.querySelectorAll('.in-kpis, .in-kpis > div')];
            return { left: g ? Math.round(g.left) : null, clipped: boxes.filter(el => el.scrollWidth > el.clientWidth + 1).map(el => el.textContent.trim().slice(0, 30)) };
          });
          await check(`${tag}: the spine keeps a gutter (greeting ${fit.left}px from the edge)`, fit.left !== null && fit.left >= 12, JSON.stringify(fit));
          await check(`${tag}: no figure on the plate is clipped`, fit.clipped.length === 0, JSON.stringify(fit.clipped));
        }
        writeFileSync(join(outDir, `index-${size.id}-${scheme}.png`), await page.screenshot({ animations: 'disabled' }));
      }
    }
    // An iPad is a touch screen too, and until this no suite measured one: the
    // 44px rule above is phone-only, so the compact bar's 32px ⌘K button
    // passed everywhere. Every kept route, portrait, with a coarse pointer.
    if (cdp) {
      await page.setViewportSize({ width: 820, height: 1180 });
      await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
      await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
      for (const route of ['/', '/practice', '/map', '/progress', '/review', '/notes', '/plan', '/tasks', '/exams', '/settings']) {
        await goto(route);
        await settle();
        const a = await page.evaluate(AUDIT);
        await check(`${route}@ipad: every control is ≥ 44×44`, a.small.length === 0, JSON.stringify(a.small.slice(0, 30)));
        // The shells' own audits (android WebViewAccessibilityTest, the iPhone
        // journey's a11yAudit) measure each control's box and do not skip an
        // aria-hidden subtree, so neither may this: on CI they found 22 px
        // Settings switches and the phone Index's unnamed chapter strip.
        const shell = await page.evaluate(SHELL_AUDIT);
        await check(`${route}@ipad: every .btn box is ≥ 44 px tall and every button has a name, as the native shells measure them`, shell.length === 0, JSON.stringify(shell.slice(0, 10)));
      }
    }
    if (cdp) await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false });
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
  }
};


// Write & Check in the instrument material: the same practice surface (its
// hooks, roles and marks are the existing ones), with the reading as chips,
// the verdict as a panel and the scan on Check. The reader's provider hop is
// the scripted stand-in; the canvas, routes and every mark are real.
// The exact-pass screens (s4/s5): one state at every size and both themes.
const shootAll = async (page, outDir, state, sizes = SIZES) => {
  const before = page.viewportSize();
  for (const size of sizes) {
    await page.setViewportSize({ width: size.width, height: size.height });
    for (const scheme of ['dark', 'light']) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.waitForTimeout(250);
      writeFileSync(join(outDir, `write-${state}-${size.id}-${scheme}.png`), await page.screenshot({ animations: 'disabled' }));
    }
  }
  if (before) await page.setViewportSize(before);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForTimeout(250);
};

export const writeFlow = {
  id: 'instrument-write',
  name: 'Instrument · Write & Check — reading chips, verdict panel, scan, marks unchanged',
  online: true,

  async run({ page, base, check, goto, settle, createProfile, note, online, browserName = 'chromium' }) {
    const outDir = join(process.env.PRI_VISUAL_OUT || mkdtempSync(join(tmpdir(), 'pri-instrument-')), `instrument-${browserName}`);
    mkdirSync(outDir, { recursive: true });
    note(`${SYNTHETIC_EVIDENCE}: the handwriting reader in "${writeFlow.name}" is the scripted stand-in. Not real-handwriting or real-device evidence.`);
    Object.assign(online.reader, { text: '1', lines: null, confidence: 0.97, down: false, gate: null });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'no-preference' });
    await goto('/');
    await createProfile({ name: 'Instrument Writer', year: 7 });
    await online.signIn({ name: 'Instrument Writer' });
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await check('server reading is on for this profile', await turnOnServerReading(page, base));

    await page.goto(`${base}/practice?subtopic=c7-integer-operations-current`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.q-prompt', { timeout: 30000 });
    await settle();
    let right = null;
    for (let i = 0; i < 8; i++) {
      right = await online.answerOf().catch(() => null);
      if (right && right.answerType === 'numeric' && /^-?\d+$/.test(String(right.text))) break;
      const leaving = await page.locator('.qpage').getAttribute('data-question-id');
      await page.locator('.ctx-next').click();
      await page.waitForFunction(id => { const e = document.querySelector('.qpage[data-question-id]'); return e && e.getAttribute('data-question-id') !== id; }, leaving, { timeout: 30000 });
      await settle();
    }
    if (!await check('a numeric question is on the card', !!right && right.answerType === 'numeric')) return;
    const tab = page.getByRole('button', { name: 'Answer by handwriting' });
    if (await tab.count()) await tab.click();
    await page.waitForSelector('.ink-canvas-live', { timeout: 30000 });

    // The question header: a real count in this visit and a live clock (display only).
    const head = page.locator('[data-question-head]');
    await check('the header numbers the question within this session', await head.count() === 1 && /^\d+$/.test(await head.getAttribute('data-question-head')), await head.getAttribute('data-question-head').catch(() => 'none'));
    await check('open practice has no defined length, so no progress segments are drawn', await page.locator('.in-prog10').count() === 0);
    // Each read also records the question and whether it is resolved, so a
    // failure says whether the clock stalled, reset, or stopped.
    const clockRead = () => page.evaluate(() => {
      const q = document.querySelector('.qpage');
      return { text: (document.querySelector('[data-question-timer]')?.textContent || '').trim(), at: performance.now(),
        id: q?.getAttribute('data-question-id') || 'none', resolved: document.querySelector('[data-question-timer]')?.getAttribute('data-clock-stopped') || 'none' };
    });
    const c0 = await clockRead();
    await page.waitForTimeout(2100);
    const c1 = await clockRead();
    const t0 = c0.text; const t1 = c1.text;
    await check('the question clock runs (mm:ss) and is a labelled timer', /^\d{2}:\d{2}$/.test(t1) && t1 !== t0 && await page.locator('[data-question-timer][role=timer][aria-label]').count() === 1,
      `${t0} → ${t1} over ${Math.round(c1.at - c0.at)} ms · question ${c0.id} → ${c1.id} · resolved ${c0.resolved} → ${c1.resolved}`);
    // The ladder: every rung, locked ones closed, the charge stated.
    const ladder = page.locator('[data-hint-ladder]');
    await check('the hint ladder shows every rung before any is opened', await ladder.count() === 1 && await ladder.locator('.in-rung').count() === 4, await ladder.getAttribute('data-hint-ladder').catch(() => 'none'));
    await check('the ladder header counts rungs used', /0\D+4/.test(await ladder.locator('.hints-block-title').first().textContent()));
    await check('only the next rung can be opened; the rest are locked', await ladder.locator('[data-hint-rung-open]').count() === 1 && await ladder.locator('[data-hint-rung-locked]').count() === 3);
    await check('each rung states its charge, and the last ends the attempt', /−10%/.test(await ladder.textContent()) && /ends the attempt/.test(await ladder.locator('.in-rung').last().textContent()));
    await check('the footer carries Hint and a Check with its ⌘↵ chip', await page.locator('[data-wbar-hint]').count() === 1 && await page.locator('.ws-actions .btn-primary[aria-keyshortcuts] .in-kbd').count() === 1);
    await shootAll(page, outDir, 'write');

    // The hint ladder: a rung opened is a numbered card, marked as a rung.
    await page.locator('.hint-bulb').click();
    await page.waitForSelector('.hintbox[data-hint-shown]', { timeout: 15000 }).catch(() => {});
    const rung = await page.evaluate(() => {
      const box = document.querySelector('.hintbox[data-hint-shown]'); if (!box) return null;
      const b = getComputedStyle(box, '::before'); const probe = document.createElement('div'); probe.style.background = 'var(--in-action)'; document.body.append(probe);
      const action = getComputedStyle(probe).backgroundColor; probe.remove();
      return { numbered: b.content !== 'none' && b.content !== '', bg: b.backgroundColor, action, radius: getComputedStyle(box).borderRadius };
    });
    await check('an opened hint is a numbered rung on the ladder', !!rung && rung.numbered && rung.bg === rung.action && rung.radius === '6px', JSON.stringify(rung));
    await check('opening a rung moves the ladder on: 1 of 4 used, the next rung offered', /1\D+4/.test(await ladder.locator('.hints-block-title').first().textContent()) && await ladder.locator('[data-hint-shown]').count() === 1 && await ladder.locator('[data-hint-rung-open]').count() === 1 && await ladder.locator('[data-hint-rung-locked]').count() === 2);
    await shootAll(page, outDir, 'hint');
    // The footer Hint is the ladder's one trigger under the instrument (the
    // toolbar bulb is not drawn twice). At the last rung it names the reveal,
    // and its first press arms a confirmation rather than revealing.
    await check('the hint trigger is drawn once, in the footer', await page.locator('.hint-bulb').count() === 1 && await page.locator('.ws-actions .hint-bulb[data-wbar-hint]').count() === 1);
    for (const n of [2, 3]) {
      await page.locator('.hint-bulb').click();
      await page.waitForFunction(k => document.querySelectorAll('.hintbox[data-hint-shown]').length >= k, n, { timeout: 15000 }).catch(() => {});
    }
    const footHint = page.locator('.ws-actions [data-wbar-hint]');
    await check('at the last rung the footer Hint names the reveal', await footHint.getAttribute('data-wbar-hint') === 'solution' && /ends the question with no marks/.test(await footHint.getAttribute('aria-label') || ''), await footHint.getAttribute('aria-label').catch(() => 'none'));
    await footHint.click();
    await check('one press arms it: the footer Hint changes to the confirm text', await footHint.getAttribute('data-armed') === 'true' && /Press again/.test(await footHint.textContent()) && /Press again to see the full solution/.test(await footHint.getAttribute('aria-label') || ''), (await footHint.textContent()).trim());
    await check('the armed press revealed nothing', await page.locator('.eval-card').count() === 0 && await page.locator('[data-hint-rung-open="solution"]').count() === 1);
    await page.waitForFunction(() => !document.querySelector('.ws-actions [data-wbar-hint][data-armed]'), null, { timeout: 8000 }).catch(() => {});
    await check('left alone, it disarms', await footHint.getAttribute('data-armed') === null);
    const shell = page.locator('.editor-shell').first();
    const look = sel => page.evaluate(q => { const el = document.querySelector(q); if (!el) return null; const s = getComputedStyle(el); return { bg: s.backgroundColor, radius: s.borderRadius, font: s.fontFamily }; }, sel);
    const stage = await look('.ink-stage');
    const voidBg = await page.evaluate(() => { const p = document.createElement('div'); p.style.background = 'var(--in-void)'; document.body.append(p); const v = getComputedStyle(p).backgroundColor; p.remove(); return v; });
    await check('the writing surface is the instrument void', !!stage && stage.bg === voidBg, JSON.stringify({ stage: stage?.bg, voidBg }));
    await check('the mode switch is the instrument segmented control', (await look('.mode-tabs.seg'))?.radius === '6px');

    const wrong = String(Number(right.text) + 1);
    online.forgetKeptReads?.();
    online.reader.lines = [{ text: 'x + y = 35' }, { text: 'x - y = 13' }, { text: wrong }];
    const box = await page.locator('.ink-canvas-live').boundingBox();
    // Three written lines, one per line read, so the reading can be set beside each.
    const pitch = Math.max(96, Math.min(120, (box.height - 110) / 2));
    await handwrite(page, box, '333333', { x: 40, y: 24 });
    await handwrite(page, box, '111111', { x: 40, y: 24 + pitch });
    await handwrite(page, box, '3' + wrong.replace('-', ''), { x: 40, y: 24 + 2 * pitch });
    await check('nothing is set beside the lines before the page is read (no faked live reading)', await page.locator('[data-reading-chips]').count() === 0);
    await pressRead(page);
    await page.waitForFunction(n => document.querySelectorAll('.ink-line').length >= n, 2, { timeout: 20000 }).catch(() => {});
    const chips = await page.locator('.ink-line .ink-line-math').count();
    await check('Pri’s reading shows each line as a chip', chips >= 2, `${chips} lines`);
    const chip = await look('.ink-line .ink-line-math');
    await check('a reading chip is drawn on the raised surface', !!chip && chip.radius === '4px', JSON.stringify(chip));
    // The student's own simultaneous pair, drawn (display only).
    const drawn = page.locator('[data-reading-plot]');
    await check('the reading’s simultaneous pair is drawn as two lines', await drawn.count() === 1 && await drawn.getAttribute('data-reading-plot') === '2', await drawn.getAttribute('data-reading-plot').catch(() => 'none'));
    await check('the drawing says it is not a mark', /never sets a mark/i.test(await drawn.textContent().catch(() => '')));
    // The chips on the page: a visual duplicate of the list, which keeps Edit.
    const onPage = page.locator('[data-reading-chips]');
    if (await check('Pri’s reading is set beside each written line', await onPage.count() === 1 && await onPage.locator('[data-read-chip]').count() === 3, await onPage.getAttribute('data-reading-chips').catch(() => 'none'))) {
      await check('the chips are hidden from assistive tech (the list is the accessible reading)', await onPage.getAttribute('aria-hidden') === 'true');
      const cf = await onPage.locator('[data-read-confidence]').evaluateAll(els => els.map(e => e.getAttribute('data-read-confidence')));
      await check('each chip’s confidence bar is the reader’s own confidence', cf.length === 3 && cf.every(v => v === '97'), JSON.stringify(cf));
      const chipFont = await onPage.locator('.in-read').first().evaluate(el => getComputedStyle(el).fontFamily);
      await check('a chip is set in Computer Modern', /KaTeX|Latin Modern|Computer Modern|CMU/i.test(chipFont), chipFont);
      const side = await page.evaluate(() => {
        const c = document.querySelector('[data-read-chip="0"]')?.getBoundingClientRect(); const s = document.querySelector('.ink-stage')?.getBoundingClientRect();
        return c && s ? { right: Math.round(s.right - c.right), inside: c.top >= s.top && c.bottom <= s.bottom } : null;
      });
      await check('the chip sits on the page beside its line', !!side && side.inside && side.right >= 0 && side.right <= 24, JSON.stringify(side));
    }
    await check('the reading list still offers Edit on every line', await page.locator('.ink-line .ink-correct-btn').count() === await page.locator('.ink-line').count());
    writeFileSync(join(outDir, 'write-read-web-dark.png'), await page.screenshot({ animations: 'disabled' }));
    await shootAll(page, outDir, 'read', SIZES.filter(sz => sz.id === 'web'));

    // ⌘↵ / Ctrl+↵ presses Check (the primary), with focus anywhere on the page.
    await page.locator('.q-prompt').click();
    await page.keyboard.press('Control+Enter');
    await page.waitForSelector('.eval-card, .verdict[data-verdict-of]', { timeout: 30000 }).catch(() => {});
    await check('Ctrl+↵ checks the working, as the primary does', await page.locator('.verdict, .eval-card').count() > 0);
    await check('Check marks the shell for the scan', await shell.getAttribute('data-marked') === 'yes');
    const scan = await page.evaluate(() => {
      const el = document.querySelector('.editor-shell[data-marked="yes"] .ink-stage');
      if (!el) return null;
      const s = getComputedStyle(el, '::after');
      return { name: s.animationName, border: s.borderBottomColor, pointer: s.pointerEvents };
    });
    const signal = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--in-signal').trim());
    await check('the scan runs once, in the signal colour', scan?.name === 'in-scan', JSON.stringify({ scan, signal }));
    await check('the scan never takes the pen: it ignores pointer input', scan?.pointer === 'none');
    const verdict = page.locator('.verdict').first();
    await check('a wrong answer gets the slip verdict panel, not the failure one', await verdict.evaluate(el => el.classList.contains('verdict-bad') && !el.classList.contains('verdict-technical')));
    await page.waitForTimeout(1300);
    writeFileSync(join(outDir, 'write-marked-web-dark.png'), await page.screenshot({ animations: 'disabled' }));
    const slipChip = page.locator('[data-reading-chips] .in-read.is-slip');
    await check('the slipped line’s chip carries the slip tag and the line is underlined', await slipChip.count() === 1 && await page.locator('.ink-verdict-layer .ink-underline').count() >= 1, `${await slipChip.count()} slip chips`);
    await shootAll(page, outDir, 'marked', SIZES.filter(sz => sz.id === 'web'));

    // A second wrong try resolves the question: the reply now carries the
    // server's mark as CBSE-style step rows, which must agree with it.
    const replies = [];
    page.on('response', async r => { if (/\/v1\/practice\/[^/]+\/submit$/.test(r.url())) { try { replies.push(await r.json()); } catch { /* not json */ } } });
    await page.getByRole('button', { name: /^Submit/ }).last().click();
    // Main's marking-display rule (0b3712a74, rule A for train 12): the
    // server's mark is shown as aggregate, server-verified credit — method
    // credit as a count, the final answer accepted or not — never as invented
    // per-step rows.
    await page.waitForSelector('[data-verified-step-marks]', { timeout: 30000 }).catch(() => {});
    const reply = replies.at(-1) || null;
    await check('the resolving reply carries the server\'s aggregate mark breakdown, with no per-step rows', !!reply?.markRows && !Array.isArray(reply.markRows.rows), JSON.stringify(reply?.markRows || null));
    await check('the card shows the verified breakdown, labelled not official', await page.locator('[data-verified-step-marks]').count() === 1 &&
      /official/i.test(await page.locator('[data-verified-step-marks]').textContent().catch(() => '')));
    await check('a wrong answer\'s final answer is shown as not accepted', await page.locator('[data-verified-step-marks] [data-final-answer-credit="not-accepted"]').count() === 1);
    await check('no per-step mark rows are invented', await page.locator('[data-step-marks], [data-step-mark]').count() === 0);
    await check('no half marks are shown', !/½|0\.5/.test(await page.locator('[data-verified-step-marks]').textContent().catch(() => '')));
    writeFileSync(join(outDir, 'write-resolved-step-marks-web-dark.png'), await page.screenshot({ fullPage: true, animations: 'disabled' }));
    // The score card: the dial and figure are the server's receipt.
    const dial = page.locator('[data-score-dial]');
    await check('the score card shows the dial with the server’s marks', !!reply && await dial.count() === 1 && await dial.getAttribute('data-score-dial') === `${reply.marksEarned}/${reply.marksPossible}`, await dial.getAttribute('data-score-dial').catch(() => 'none'));
    const dialBox = await dial.locator('.in-dial').boundingBox().catch(() => null);
    const fig = await dial.locator('.in-dial b').evaluate(el => getComputedStyle(el).fontSize).catch(() => null);
    await check('the dial is 68px and its figure 21px', !!dialBox && Math.round(dialBox.width) === 68 && fig === '21px', JSON.stringify({ w: dialBox?.width, fig }));
    await check('the dial is a visual duplicate; the marks head stays for assistive tech', await dial.getAttribute('aria-hidden') === 'true' && await page.locator('.eval-card .eval-head .eval-marks').count() === 1);
    await check('the clock stops once the question is resolved', await (async () => { const a = await page.locator('[data-question-timer]').textContent(); await page.waitForTimeout(1200); return a === await page.locator('[data-question-timer]').textContent(); })());
    await check('a resolved question offers no Check shortcut', await page.locator('.ws-actions .btn-primary[aria-keyshortcuts]').count() === 0);
    await shootAll(page, outDir, 'resolved');

    // Scripts: the resolved attempt's row carries its certified mark strip.
    if (reply) {
      await page.goto(`${base}/review`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.hist-row', { timeout: 15000 }).catch(() => {});
      const strip = page.locator('[data-mark-strip]').first();
      await check('Scripts shows the certified mark strip on the attempt', await strip.count() === 1 && await strip.getAttribute('data-mark-strip') === `${reply.marksEarned}/${reply.marksPossible}`, await strip.getAttribute('data-mark-strip').catch(() => 'none'));
      await check('the strip has one square per mark', await strip.locator('i').count() === reply.marksPossible);
      // The filters state their counts; the menus and search work on the rows.
      await page.waitForSelector('[data-history-count="all"]', { timeout: 10000 });
      const count = async k => (await page.locator(`[data-history-count="${k}"]`).textContent()).trim();
      const rowsShown = await page.locator('.hist-row').count();
      await check('“All” counts every script shown', await count('all') === String(rowsShown), `${await count('all')} vs ${rowsShown} rows`);
      await check('the wrong answer is counted as incorrect and as needing another look', await count('wrong') === '1' && await count('needsLook') === '1', `${await count('wrong')} / ${await count('needsLook')}`);
      await check('there is no “Not read” filter (nothing records it)', await page.locator('[data-history-filter="notRead"]').count() === 0);
      await page.locator('[data-history-filter="needsLook"]').click();
      await page.waitForFunction(() => document.querySelector('[data-history-filter="needsLook"]')?.getAttribute('aria-pressed') === 'true' && document.querySelectorAll('.hist-row').length === 1, null, { timeout: 10000 }).catch(() => {});
      await check('“Needs another look” lists that script', await page.locator('.hist-row').count() === 1);
      await page.locator('[data-history-filter="all"]').click();
      await check('the chapter and sort menus are there', await page.locator('[data-history-chapter]').count() === 1 && await page.locator('[data-history-sort] option').count() === 3);
      // Design s8: the search sits in the shared bar in place of the ⌘K field,
      // and ⌘K still opens the command bar from here.
      await check('Scripts: the search is in the top bar, the ⌘K field reduced to its icon', await page.locator('[data-instrument-bar-slot] [data-history-search]').count() === 1 && !(await page.locator('.in-cmd .in-cmd-t').isVisible()));
      await page.locator('body').click({ position: { x: 5, y: 600 } });
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+k' : 'Control+k');
      await check('Scripts: ⌘K still opens the command bar', await page.locator('[data-instrument-command] [role=dialog]').count() === 1);
      await page.keyboard.press('Escape');
      const icon = page.locator('.in-cmd');
      await check('Scripts: a 32px icon button still opens the command bar', await icon.isVisible() && await icon.evaluate(el => Math.round(el.getBoundingClientRect().width) === 32 && !!el.getAttribute('aria-label')));
      await icon.click();
      await check('— clicking it opens the command bar', await page.locator('[data-instrument-command] [role=dialog]').count() === 1);
      await page.keyboard.press('Escape');
      await page.locator('[data-instrument-bar-slot] [data-history-search]').focus();
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+k' : 'Control+k');
      await check('Scripts: ⌘K works from inside the bar’s search', await page.locator('[data-instrument-command] [role=dialog]').count() === 1);
      await page.keyboard.press('Escape');
      await check('Scripts: the bar search is described by the filters and controls the ledger', await page.locator('[data-history-search]').getAttribute('aria-describedby') === 'in-hist-filters' && await page.locator('#in-hist-ledger').count() === 1);
      // Sorted by marks lost: one flat list, no repeated day headings, unique ids.
      await page.locator('[data-history-sort]').selectOption('marks');
      await page.waitForFunction(() => document.querySelectorAll('.hist-row').length > 0 && !document.querySelector('.in-led-dayh'), null, { timeout: 10000 }).catch(() => {});
      const ids = await page.evaluate(() => [...document.querySelectorAll('[id]')].map(e => e.id));
      await check('sorted by marks lost, the ledger has no day headings and every id is unique', await page.locator('.in-led-dayh').count() === 0 && new Set(ids).size === ids.length, `${ids.length} ids`);
      await page.locator('[data-history-sort]').selectOption('newest');
      await page.waitForSelector('.in-led-dayh', { timeout: 10000 }).catch(() => {});
      await page.keyboard.press('/');
      await check('“/” focuses the search', await page.evaluate(() => document.activeElement?.hasAttribute('data-history-search')));
      await page.keyboard.type('zzqx-no-such-question');
      // Wait for the settled search state, not merely the first render of the
      // count: under CI load the count can mount a frame before the ledger's
      // rows unmount, which made this check intermittently read 162/163. The
      // assertion below is unchanged.
      await page.waitForFunction(() => document.querySelectorAll('.hist-row').length === 0
        && document.querySelectorAll('[data-history-search-count]').length === 1, null, { timeout: 10000 }).catch(() => {});
      await check('a search with no match lists nothing', await page.locator('.hist-row').count() === 0 && await page.locator('[data-history-search-count]').count() === 1);
      await page.locator('[data-history-search]').fill('');
      await page.waitForSelector('.hist-row', { timeout: 10000 }).catch(() => {});
      writeFileSync(join(outDir, 'scripts-web-dark.png'), await page.screenshot({ animations: 'disabled' }));
      // Report: the certified total is the receipts' total.
      await page.goto(`${base}/progress`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[data-instrument-report]', { timeout: 15000 }).catch(() => {});
      const fig = (await page.locator('[data-report-marks] b').textContent().catch(() => '')).replace(/\s+/g, '');
      await check('the Report’s certified marks are the receipts’ total', fig === `${reply.marksEarned}/${reply.marksPossible}`, fig);
      await check('today’s practice is lit on the heat-map', await page.locator('.in-heat i.is-on').count() >= 1);
      // One question is under every evidence floor: the chart draws no line,
      // never a zero, and says why.
      await check('below the floor the chart draws no point and says so', await page.locator('[data-report-chart="empty"] [data-chart-empty]').count() === 1 && await page.locator('[data-chart-line]').count() === 0);
      await check('method marks are withheld below the floor', (await page.locator('[data-report-method] b').textContent()).trim() === '—');
      await check('the lede is the fixed template over the figures', /^1 question answered in this period/.test(await page.locator('[data-report-lede]').textContent().catch(() => '')), await page.locator('[data-report-lede]').textContent().catch(() => ''));
      await check('Report: the period switch is in the top bar (design s7)', await page.locator('[data-instrument-bar-slot] [data-report-periods]').count() === 1);
      await check('Report: the online dot stays in the bar', await page.locator('.in-status i').isVisible());
      await page.context().setOffline(true);
      await page.waitForSelector('.in-status.is-off', { timeout: 5000 }).catch(() => {});
      await check('Report: offline shows in full in the bar', await page.locator('.in-status.is-off .in-status-t').isVisible() && /offline/i.test(await page.locator('.in-status').textContent()));
      await page.context().setOffline(false);
      await page.waitForSelector('.in-status:not(.is-off)', { timeout: 5000 }).catch(() => {});
      // The period switch refetches the series for that window.
      // The old period's figures never show under the new title: until the
      // month arrives, the report holds no figures at all.
      const stale = page.evaluate(() => new Promise(done => {
        const el = document.querySelector('[data-instrument-report]');
        const seen = [];
        const mo = new MutationObserver(() => seen.push([el.getAttribute('data-report-period'), el.getAttribute('data-report-loaded')]));
        mo.observe(el, { attributes: true });
        setTimeout(() => { mo.disconnect(); done(seen); }, 2500);
      }));
      const series = page.waitForResponse(r => /\/report\/series\?period=month/.test(r.url()) || false, { timeout: 5000 }).catch(() => null);
      await page.locator('[data-report-period-btn="month"]').click();
      await series;
      await page.waitForSelector('[data-instrument-report][data-report-period="month"]', { timeout: 10000 }).catch(() => {});
      const seen = await stale;
      await check('switching period never shows the old period’s figures under the new title', seen.every(([p, l]) => l === 'none' || l === p), JSON.stringify(seen));
      await check('Month is pressed and the report shows the month', await page.locator('[data-report-period-btn="month"]').getAttribute('aria-pressed') === 'true' && await page.locator('[data-instrument-report]').getAttribute('data-report-period') === 'month');
      await check('the month series loaded (the marks figure is still the receipts’ total)', (await page.locator('[data-report-marks] b').textContent().catch(() => '')).replace(/\s+/g, '') === `${reply.marksEarned}/${reply.marksPossible}`);
      await check('the month chart has its four weekly points', await page.locator('.in-chart-tick').count() === 4, `${await page.locator('.in-chart-tick').count()} ticks`);
      await page.locator('[data-report-period-btn="week"]').click();
      // On a phone the bar is compact: the switch and the search stay in the page.
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(300);
      await check('phone: the period switch stays in the page, not the bar', await page.locator('[data-instrument-report] [data-report-periods]').count() === 1 && await page.locator('[data-instrument-bar-slot] *').count() === 0);
      await page.setViewportSize({ width: 1440, height: 900 });
      writeFileSync(join(outDir, 'report-web-dark.png'), await page.screenshot({ animations: 'disabled' }));
    }

    // The command bar lists the attempt under "Your scripts" with its certified mark.
    if (reply) {
      await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.in-cmd', { timeout: 15000 });
      await page.locator('.in-cmd').click();
      await page.waitForSelector('[data-instrument-command] [id^="in-pal-sc-"]', { timeout: 10000 }).catch(() => {});
      const scriptRow = page.locator('[data-instrument-command] [id^="in-pal-sc-"]').first();
      await check('the command bar lists your scripts', await scriptRow.count() === 1);
      await check('— with the certified mark', (await scriptRow.locator('small').textContent().catch(() => '')).trim() === `${reply.marksEarned}/${reply.marksPossible}`);
      await page.keyboard.press('Escape');
    }

    // The map's marks are the server-certified receipts, nothing else.
    if (reply) {
      await page.goto(`${base}/map`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[data-map-chapter]', { timeout: 15000 }).catch(() => {});
      const node = page.locator('[data-map-chapter="c7-integer-operations-current"]');
      if (await check('the chapter just practised is on the map', await node.count() === 1)) {
        await node.focus();
        const shownMarks = await page.locator('[data-map-card="c7-integer-operations-current"] [data-map-marks]').getAttribute('data-map-marks');
        await check('the map title states this month’s certified marks', (await page.locator('[data-map-subline]').textContent()).includes(`${reply.marksEarned} / ${reply.marksPossible} marks this month`), await page.locator('[data-map-subline]').textContent());
        await check('its card shows the certified marks for that chapter', shownMarks === `${reply.marksEarned}/${reply.marksPossible}`, `${shownMarks} vs ${reply.marksEarned}/${reply.marksPossible}`);
      }
    }
    await page.emulateMedia({ colorScheme: 'light' });
    await page.waitForTimeout(400);
    writeFileSync(join(outDir, 'write-marked-web-light.png'), await page.screenshot({ animations: 'disabled' }));
  }
};

// Hindi parity: every instrument screen is written in Devanagari, declared
// Hindi, and has no English interface string or raw key on it.
const ENGLISH = englishInterfaceForms(en, hi);
const KEYS = Object.keys(en);
export const hindiFlow = {
  id: 'instrument-hindi',
  name: 'Instrument · Hindi parity — Index, Map, Report, Scripts, command bar',
  online: true,
  async run({ page, check, goto, settle, createProfile, browserName = 'chromium' }) {
    const outDir = join(process.env.PRI_VISUAL_OUT || mkdtempSync(join(tmpdir(), 'pri-instrument-')), `instrument-${browserName}`);
    mkdirSync(outDir, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
    await goto('/');
    await createProfile({ name: 'Ananya Instrument', year: 10, course: 'in', language: 'hi' });
    await page.waitForFunction(() => document.documentElement.lang === 'hi', null, { timeout: 15000 });
    const audit = async (screen, ready) => {
      await settle();
      if (ready) await check(`${screen}: the screen loaded`, await page.waitForSelector(ready, { timeout: 15000 }).then(() => true, () => false));
      await check(`${screen}: the document is declared Hindi`, await page.evaluate(() => document.documentElement.lang) === 'hi');
      const words = await page.evaluate(() => ((document.querySelector('.shell') || document.body).innerText.match(/[ऀ-ॿ]+/g) || []).length);
      await check(`${screen}: the screen is written in Devanagari`, words >= 8, `${words} Devanagari words`);
      const leaks = await page.evaluate(leaksOnPage, { english: ENGLISH, keys: KEYS });
      await check(`${screen}: no English interface string or raw key falls back onto the screen`, leaks.length === 0, leaks.slice(0, 8).join(' · '));
    };
    await goto('/'); await audit('Index', '.in-ch');
    writeFileSync(join(outDir, 'index-web-light-hi.png'), await page.screenshot({ animations: 'disabled' }));
    await goto('/map'); await audit('Map', '[data-map-chapter]');
    await goto('/progress'); await audit('Report', '[data-instrument-report]');
    await goto('/review'); await audit('Scripts', '.ws-page, .card');
    await goto('/');
    await page.locator('.in-cmd').click();
    await audit('Command bar', '[data-instrument-command]');
    await page.keyboard.press('Escape');
  }
};

// Issue #658: a student opens the app online, sees the Index, loses the
// connection and taps a tab they have never opened. This flow never visits the
// Map, the Report or Scripts online, so what opens them offline can only be
// the warm pass. install-budget-check.mjs --instrument holds the manifest; this
// proves the tabs actually paint from it.
export const offlineFlow = {
  id: 'instrument-offline',
  name: 'Instrument · Map, Report and Scripts open on a first visit offline',
  online: true,
  async run({ page, check, goto, settle, createProfile, online, note, browserName = 'chromium' }) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goto('/');
    await createProfile({ name: 'Diya Instrument', year: 10, course: 'in' });
    await online.signIn({ name: 'Diya Instrument' });
    await settle();
    await goto('/');
    await page.waitForSelector('.in-ch', { timeout: 30000 });
    // The same question the page asks at boot (local/offlineWarm.js), awaited
    // here so the check cannot race the worker.
    const held = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      const worker = navigator.serviceWorker.controller || registration.active;
      return new Promise((resolve) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = e => resolve(e.data || null);
        worker.postMessage({ type: 'pri-warm', optional: false }, [channel.port2]);
        setTimeout(() => resolve(null), 180000);
      });
    });
    // Complete, not merely answered: {warmed: 0, of: N} is a reply too.
    await check('the service worker finished the offline build', !!held && held.of > 0 && held.warmed === held.of, JSON.stringify(held));
    await page.context().setOffline(true);
    await page.waitForFunction(() => !navigator.onLine, null, { timeout: 5000 }).catch(() => {});
    // The bar says what cannot happen offline, and on demand what still works.
    const banner = page.locator('[data-offline-banner]');
    await banner.waitFor({ timeout: 10000 }).catch(() => {});
    await check('offline, a one-line banner says checking answers needs a connection',
      await banner.count() === 1 && /Checking answers needs a connection/.test(await banner.innerText()));
    await banner.locator('summary').click().catch(() => {});
    await check('and "What still works" opens to list scripts, the report and notes opened before, with the work kept on the device',
      /Your scripts/.test(await banner.innerText()) && /Your report/.test(await banner.innerText()) && /kept on this device/.test(await banner.innerText()));
    // Playwright's WebKit offline mode also stops WebKit's service worker from
    // answering: even a plain fetch() of a file the worker has just reported
    // holding fails ("WebKit encountered an internal error"). That is a limit
    // of the harness, not of the app (the same one tour-activation-gate notes
    // for an offline reload), so in WebKit the network is cut at the network
    // layer instead: every request that reaches it is aborted, and only what
    // the worker answers from its cache can load. The negative control below
    // records the limitation on every run, so it is visible if it changes.
    // Neither method is evidence about Safari or WKWebView on a device.
    const heldChunk = await page.evaluate(async () => {
      const name = (await caches.keys()).find(k => k.startsWith('pri-'));
      const keys = name ? await (await caches.open(name)).keys() : [];
      return keys.map(r => new URL(r.url).pathname).find(p => /\/MapPage-[^/]+\.js$/.test(p)) || null;
    });
    if (browserName === 'webkit') {
      const underEmulation = await page.evaluate(async url => { try { return (await fetch(url)).status; } catch (e) { return `failed: ${e.message}`; } }, heldChunk);
      note(`WebKit negative control: under Playwright's offline mode a fetch of ${heldChunk} (held by the worker) gives ${JSON.stringify(underEmulation)}; the tabs are therefore opened with the network cut by aborting every request that reaches it`);
      await page.context().setOffline(false);
      await page.context().route('**/*', route => route.abort('internetdisconnected'));
      const throughWorker = await page.evaluate(async url => { try { return (await fetch(url)).status; } catch (e) { return `failed: ${e.message}`; } }, heldChunk);
      await check('WebKit, network cut: the service worker answers a held tab chunk from its cache', throughWorker === 200, `${heldChunk}: ${JSON.stringify(throughWorker)}`);
    }
    for (const [name, href, ready] of [['the Map', '/map', '[data-map-chapter]'], ['the Report', '/progress', '[data-instrument-report]'], ['Scripts', '/review', '.in-led-bar, [data-state="empty"]']]) {
      await page.locator(`.in-tab[href="${href}"]`).click();
      const painted = await page.waitForSelector(ready, { timeout: 30000 }).then(() => true, () => false);
      const crashed = await page.locator('text=This page stopped mid-render').count() > 0;
      await check(`offline, ${name} opens on its first visit`, painted && !crashed && new URL(page.url()).pathname === href, page.url());
    }
    if (browserName === 'webkit') await page.context().unroute('**/*');
    await page.context().setOffline(false);
  }
};

// V1 decisions D7–D9: the Aurora skin dresses the chrome and nothing else.
// aurora.css is scoped to html.skin-aurora, so removing that class on the same
// page is exactly the 'instrument' skin for everything the stylesheet does;
// the flow compares the two on one page. aurora-skin-check.mjs holds the
// stylesheet itself (scope, reach, AA contrast).
const INSTRUMENT_CSS = readFileSync(new URL('../src/instrument/instrument.css', import.meta.url), 'utf8');
const CONTENT_TOKENS = [...new Set([...INSTRUMENT_CSS.matchAll(/(--in-[a-z0-9-]+)\s*:/g)].map(m => m[1]))]
  .concat(['--page', '--surface', '--surface-2', '--paper', '--ink', '--ink-2', '--ink-3', '--accent', '--hairline', '--good', '--bad']);
const CONTENT_SURFACES = ['.qpage', '.q-prompt', '.q-prompt .katex', '.ws-actions', '.ws-bar', '.editor-body', '.ink-stage', '.ink-canvas-live'];
const SURFACE_PROPS = ['color', 'background-color', 'background-image', 'box-shadow', 'backdrop-filter', 'filter', 'font-family', 'border-top-color', 'opacity'];
export const auroraFlow = {
  id: 'instrument-aurora',
  name: 'Instrument · the Aurora skin stays on chrome: content tokens, ink alignment, pools, motion and transparency (D7–D9)',
  online: true,
  async run({ page, check, goto, settle, createProfile, online, note, browserName = 'chromium' }) {
    const chromium = browserName === 'chromium';
    const setSkin = on => page.evaluate(v => document.documentElement.classList.toggle('skin-aurora', v), on);
    await page.setViewportSize({ width: 1180, height: 820 });
    await goto('/');
    await createProfile({ name: 'Aurora Student', year: 7 });
    await online.signIn({ name: 'Aurora Student' });
    await settle();
    await goto('/');
    await page.waitForSelector('.in-ch', { timeout: 30000 });
    await check('the setting\'s default skin is on: html.skin-aurora', await page.evaluate(() => document.documentElement.classList.contains('skin-aurora')));
    await check('on the Index the light pools are drawn behind the page',
      await page.locator('.a-aurora').count() === 1 && await page.evaluate(() => document.documentElement.hasAttribute('data-aurora-pools')));
    const alphaOf = c => { const m = String(c).match(/rgba?\(([^)]+)\)/); if (!m) return 0; const p = m[1].split(',').map(Number); return p.length > 3 ? p[3] : 1; };
    await check('the Index plate, which holds the chapter\'s mathematics, is opaque over them',
      alphaOf(await page.locator('.in-plate').first().evaluate(el => getComputedStyle(el).backgroundColor)) === 1);
    const barGlass = async () => page.locator('[data-instrument-bar]').evaluate(el => getComputedStyle(el).backdropFilter || getComputedStyle(el).webkitBackdropFilter || 'none');
    await check('the tab bar is glass', /blur/.test(await barGlass()), await barGlass());
    for (const [path, ready, want] of [['/map', '[data-map-chapter]', true], ['/settings', 'main h1, .settings-grid', true], ['/review', '.in-led-bar, [data-state="empty"]', false], ['/progress', '[data-instrument-report]', false], ['/practice?subtopic=y7-integers', '.q-prompt', false]]) {
      await goto(path);
      await page.waitForSelector(ready, { timeout: 30000 }).catch(() => {});
      await settle();
      const drawn = await page.locator('.a-aurora').count();
      await check(`${path}: light pools ${want ? 'drawn' : 'never drawn (a question, script or report is on screen)'}`, want ? drawn === 1 : drawn === 0, `${drawn} pool layers`);
    }

    // Content is the Instrument's under both skins: every content token and
    // every content surface computes the same with and without the skin.
    await page.waitForSelector('.q-prompt', { timeout: 30000 });
    const tab = page.getByRole('button', { name: 'Answer by handwriting' });
    if (await tab.count()) await tab.click();
    await page.waitForSelector('.ink-canvas-live', { timeout: 30000 });
    await settle();
    const contentSnapshot = () => page.evaluate(([tokens, surfaces, props]) => {
      const root = getComputedStyle(document.documentElement);
      const out = { tokens: Object.fromEntries(tokens.map(t => [t, root.getPropertyValue(t).trim()])), surfaces: {}, glassInside: 0 };
      for (const sel of surfaces) {
        const el = document.querySelector(sel);
        out.surfaces[sel] = el ? Object.fromEntries(props.map(p => [p, getComputedStyle(el).getPropertyValue(p)])) : null;
      }
      for (const el of document.querySelectorAll('.qpage *')) {
        const s = getComputedStyle(el);
        if ((s.backdropFilter && s.backdropFilter !== 'none') || (s.webkitBackdropFilter && s.webkitBackdropFilter !== 'none')) out.glassInside++;
      }
      return out;
    }, [CONTENT_TOKENS, CONTENT_SURFACES, SURFACE_PROPS]);
    const withSkin = await contentSnapshot();
    await setSkin(false); await page.waitForTimeout(300);
    const without = await contentSnapshot();
    await setSkin(true); await page.waitForTimeout(300);
    const tokenDiff = CONTENT_TOKENS.filter(t => withSkin.tokens[t] !== without.tokens[t]);
    await check(`every content token is identical under both skins (${CONTENT_TOKENS.length} tokens)`, tokenDiff.length === 0, JSON.stringify(tokenDiff.slice(0, 5)));
    const surfaceDiff = CONTENT_SURFACES.filter(s => JSON.stringify(withSkin.surfaces[s]) !== JSON.stringify(without.surfaces[s]));
    await check('the question, its KaTeX, the working area, the action bar and the ink surface compute the same under both skins', surfaceDiff.length === 0, JSON.stringify(surfaceDiff));
    await check('no glass anywhere inside the question card', withSkin.glassInside === 0, `${withSkin.glassInside} elements with a backdrop filter`);

    // Ink alignment: the canvas sits on the same pixels, maps them the same
    // way and holds the same bitmap under both skins.
    const canvas = page.locator('.ink-canvas-live').first();
    const box = await canvas.boundingBox();
    await page.mouse.move(box.x + 60, box.y + 60); await page.mouse.down();
    for (let i = 1; i <= 12; i++) await page.mouse.move(box.x + 60 + i * 9, box.y + 60 + (i % 4) * 7);
    await page.mouse.up();
    await page.waitForTimeout(1500);
    const inkState = () => canvas.evaluate(c => {
      const r = c.getBoundingClientRect();
      let h = 0; const d = c.toDataURL(); for (let i = 0; i < d.length; i += 7) h = (h * 31 + d.charCodeAt(i)) | 0;
      const chain = []; for (let n = c; n; n = n.parentElement) { const s = getComputedStyle(n); chain.push([s.transform, s.filter, s.backdropFilter || s.webkitBackdropFilter || 'none'].join('|')); }
      return { rect: [r.x, r.y, r.width, r.height].map(v => Math.round(v * 100) / 100), size: [c.width, c.height], dpr: devicePixelRatio, bitmap: `${d.length}:${h}`, chain: chain.join(' / ') };
    });
    let a = await inkState();
    await page.waitForTimeout(500);
    const a2 = await inkState();
    if (JSON.stringify(a) !== JSON.stringify(a2)) { note('ink surface still settling; re-read'); await page.waitForTimeout(1500); a = await inkState(); }
    await setSkin(false); await page.waitForTimeout(600);
    const b = await inkState();
    await setSkin(true); await page.waitForTimeout(300);
    await check('ink alignment: the canvas has the same position, size and pixel ratio under both skins', JSON.stringify([a.rect, a.size, a.dpr]) === JSON.stringify([b.rect, b.size, b.dpr]), JSON.stringify({ aurora: a.rect, instrument: b.rect }));
    await check('ink alignment: the same strokes hold the same bitmap under both skins', a.bitmap === b.bitmap, JSON.stringify({ aurora: a.bitmap, instrument: b.bitmap }));
    await check('nothing above the canvas transforms or filters it under the skin', !/blur|matrix|scale|translate/.test(a.chain.replace(/none/g, '')), a.chain.slice(0, 200));

    // Motion, transparency, forced colours (on the Index, where the pools are).
    await goto('/');
    await page.waitForSelector('.a-aurora i', { timeout: 30000 });
    const poolAnim = () => page.locator('.a-aurora i').first().evaluate(el => getComputedStyle(el).animationName);
    const poolShown = () => page.locator('.a-aurora').evaluate(el => getComputedStyle(el).display !== 'none');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await check('with motion allowed the pools drift', await poolAnim() === 'au-drift', await poolAnim());
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await check('under Reduce Motion they stand still', await poolAnim() === 'none', await poolAnim());
    // The iOS shell's Reduce Transparency class (WebShell.swift): WebKit does not
    // answer the media query, so the class alone must make the chrome opaque.
    await page.evaluate(() => document.documentElement.classList.add('a11y-reduce-transparency'));
    await check('with the shell\'s Reduce Transparency class the bar is opaque and no pool is drawn', !/blur/.test(await barGlass()) && !(await poolShown()), `${await barGlass()} / pools ${await poolShown()}`);
    await page.evaluate(() => document.documentElement.classList.remove('a11y-reduce-transparency'));
    await check('and without it the glass and the pools return', /blur/.test(await barGlass()) && await poolShown(), `${await barGlass()} / pools ${await poolShown()}`);
    if (chromium) {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
      await check('under Reduce Transparency the bar is opaque and no pool is drawn', !/blur/.test(await barGlass()) && !(await poolShown()), `${await barGlass()} / pools ${await poolShown()}`);
      await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
      await check('in forced colours there is no glass and no pool', !/blur/.test(await barGlass()) && !(await poolShown()), `${await barGlass()} / pools ${await poolShown()}`);
      await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    } else note('Reduce Transparency and forced colours are emulated in Chromium only (CDP); aurora-skin-check holds the rules for every engine');

    // D8: the plain skin is the class away. Without it nothing Aurora remains.
    await setSkin(false); await page.waitForTimeout(300);
    await check('without the skin (D8\'s fallback): no pools drawn, no glass bar', !(await poolShown()) && !/blur/.test(await barGlass()), `${await barGlass()}`);
    await setSkin(true);
  }
};

// The first screen on a touch phone. #487 measured the welcome footer's legal
// links at 15 px tall; on a coarse pointer each is a 44 px target now. V1
// decision D11: the language switch stays, and choosing Hindi says at once
// that questions and worked solutions stay in English.
export const welcomeFlow = {
  id: 'instrument-welcome',
  name: 'Instrument · the welcome screen on a touch phone: 44px legal links, the language note (D11)',
  async run({ page, check, goto, settle }) {
    await page.setViewportSize({ width: 390, height: 844 });
    await goto('/');
    await page.waitForSelector('.login-legal a', { timeout: 30000 });
    const coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
    await check('the phone context is a coarse pointer, as a phone is', coarse);
    const small = await page.locator('.login-legal a').evaluateAll(els => els.map(el => {
      el.scrollIntoView({ block: 'center' });
      const r = el.getBoundingClientRect();
      return { link: el.textContent.trim(), w: Math.round(r.width), h: Math.round(r.height) };
    }).filter(x => x.w < 43.5 || x.h < 43.5));
    await check('every legal link on the welcome screen is a 44×44 touch target', small.length === 0, JSON.stringify(small));
    await check('in English the screen adds no language note', await page.locator('[data-lang-note]').count() === 0);
    await page.locator('button[lang="hi"][aria-pressed]').first().click();
    await page.waitForSelector('[data-lang-note]', { timeout: 15000 }).catch(() => {});
    await settle();
    const note = await page.locator('[data-lang-note]').first().innerText().catch(() => '');
    await check('choosing Hindi says, in Hindi, that questions and worked solutions stay in English', /अंग्रेज़ी/.test(note), JSON.stringify(note));
    await page.locator('button[lang="en"][aria-pressed]').first().click();
    await settle();
    await check('and back in English the note goes again', await page.locator('[data-lang-note]').count() === 0);
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runFlows } = await import('./e2e.mjs');
  process.exit(await runFlows([flow, writeFlow, hindiFlow, offlineFlow, welcomeFlow, auroraFlow]) ? 1 : 0);
}
