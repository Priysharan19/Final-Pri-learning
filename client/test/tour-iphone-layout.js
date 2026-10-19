// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · E2E flow — iPhone portrait layout (393 × 852, iPhone 16).
//
// The defects an iPhone 16 simulator showed on 2026-10-18, each held to a
// measurable rule:
//   · the page background fills the status-bar and home-indicator strips, and
//     every bar keeps its content out of them (insets are simulated through the
//     --pri-inset-* tokens, which are env(safe-area-inset-*) on a device);
//   · the sticky action bar never covers the last field, option or the sheet:
//     at the foot of the page every control sits above it;
//   · Type · Write · Photo spans the column;
//   · choosing Write shows the whole sheet, clear of both bars;
//   · the photo target is one full-width row, its instruction on one line;
//   · the status under the action reads as whole lines, not wrapped columns;
//   · the topic in the question bar is not cut off;
//   · the first screen's demo link is one line and no margin rule crosses text;
//   · Settings' section menu lands a section below the top bar, and nothing at
//     the foot of Settings sits under the tab bar.
// The same screens at iPad portrait, iPad landscape and desktop keep their
// composition (the rules above are COMPACT-only).
//
//   node client/test/tour-iphone-layout.js
//   node client/test/tour-iphone-layout.js --no-build --browser=webkit
// Synthetic browser evidence (S1). It is never evidence about a device.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const PHONE = { width: 393, height: 852 };
// iPhone 16 portrait: the status bar with the Dynamic Island, and the home indicator.
const INSETS = { top: 59, bottom: 34 };
// iPhone SE (home button: no inset below) and iPhone 16 Pro Max.
const OTHER_PHONES = [
  { id: 'iPhone SE', width: 375, height: 667, insets: { top: 20, bottom: 0 } },
  { id: 'iPhone 16 Pro Max', width: 430, height: 932, insets: { top: 59, bottom: 34 } },
];
const LARGER = [
  { id: 'iPad portrait', width: 820, height: 1180 },
  { id: 'iPad landscape', width: 1180, height: 820 },
  { id: 'desktop', width: 1440, height: 900 },
];
const ROOT = new URL('../../', import.meta.url);

const setInsets = (page, insets) => page.evaluate(({ top, bottom }) => {
  const s = document.documentElement.style;
  s.setProperty('--pri-inset-top', `${top}px`);
  s.setProperty('--pri-inset-bottom', `${bottom}px`);
}, insets);
const clearInsets = page => page.evaluate(() => {
  const s = document.documentElement.style;
  s.removeProperty('--pri-inset-top');
  s.removeProperty('--pri-inset-bottom');
});
const toEnd = page => page.evaluate(() => { scrollTo(0, document.scrollingElement.scrollHeight); });
const toTop = page => page.evaluate(() => { scrollTo(0, 0); });
const overflowOf = page => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
/** What runs past the right edge, by the container that cannot hold it. */
const overflowDetail = page => page.evaluate(() => {
  const W = document.documentElement.clientWidth;
  const spill = [...document.querySelectorAll('body *')]
    .filter(e => e.clientWidth > 0 && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX === 'visible')
    .slice(-4).map(e => `${e.tagName}.${String(e.className).slice(0, 40)} ${e.scrollWidth}>${e.clientWidth}`);
  return { over: document.documentElement.scrollWidth - W, spill };
});

/** Step through questions until `want(page)` holds (the draw is random). */
async function questionWhere(page, settle, want) {
  for (let i = 0; i < 30; i++) {
    if (await page.evaluate(want)) return true;
    const next = page.locator('.ctx-next');
    if (!(await next.count())) return false;
    await next.click({ timeout: 5000 }).catch(() => {});
    await page.waitForSelector('.q-prompt', { timeout: 30000 }).catch(() => null);
    await settle();
  }
  return false;
}
const hasModes = () => document.querySelectorAll('.mode-tab').length === 3;
const hasOptions = () => document.querySelectorAll('.mcq-opt').length >= 2;

/** Every element matched, scrolled to the page's foot, ends above the action bar. */
const clearOfBarAtFoot = (page, selector) => page.evaluate(sel => {
  scrollTo(0, document.scrollingElement.scrollHeight);
  const bar = document.querySelector('.ws-actions')?.getBoundingClientRect();
  if (!bar) return { ok: false, why: 'no action bar' };
  const els = [...document.querySelectorAll(sel)].filter(e => e.getClientRects().length);
  if (!els.length) return { ok: false, why: `nothing matches ${sel}` };
  const under = els.map(e => e.getBoundingClientRect()).filter(r => r.bottom > bar.top + 0.5).map(r => Math.round(r.bottom));
  return { ok: under.length === 0, barTop: Math.round(bar.top), barBottom: Math.round(bar.bottom), vh: innerHeight, under };
}, selector);

export const flow = {
  id: 'iphone-layout',
  name: 'iPhone portrait · safe areas, sticky bar, mode switch, write and photo space',
  online: true,

  async run({ page, check, goto, settle, createProfile, note, online, browserName = 'chromium' }) {
    note(`engine: ${browserName}`);

    // ── 0 · the native shell and the copy, read from source ─────────────────
    for (const pkg of ['PriLearning.swiftpm', 'PriLearning 2.swiftpm']) {
      const app = readFileSync(new URL(`ios/${pkg}/PriLearningApp.swift`, ROOT), 'utf8');
      await check(`${pkg}: on iPhone the web view runs under the status bar and home indicator (container safe area only, iPad unchanged)`,
        /WebShell\(\)\s*\.ignoresSafeArea\(\.container,\s*edges:\s*Self\.edgeToEdge\)/.test(app)
          && /userInterfaceIdiom == \.phone \? \.all : \[\]/.test(app));
    }
    const en = (await import(new URL('client/src/i18n/strings.en.js', ROOT).href)).default;
    await check('the week card says a touched session was started, not that today is done (Home showed "8 more" above "sessions are done")',
      !/done/i.test(en['plan.allDone']) && /started/.test(en['plan.allDone']) && /started/.test(en['plan.todayProgress']),
      en['plan.allDone']);

    // ── 1 · first screen ────────────────────────────────────────────────────
    await page.setViewportSize(PHONE);
    await goto('/');
    await page.waitForSelector('.auth-wrap .hero-title', { timeout: 30000 });
    await setInsets(page, INSETS);
    const hero = await page.evaluate(() => {
      const demo = document.querySelector('[data-testid="signup-send-code"]');
      const lh = parseFloat(getComputedStyle(demo).lineHeight) || parseFloat(getComputedStyle(demo).fontSize) * 1.5;
      const logo = document.querySelector('.auth-wrap .auth-col')?.getBoundingClientRect();
      const field = getComputedStyle(document.querySelector('.mathfield')).backgroundImage;
      const range = document.createRange(); range.selectNodeContents(demo);
      const lines = new Set([...range.getClientRects()].filter(r => r.width > 0).map(r => Math.round(r.top))).size;
      return { demoH: demo.getBoundingClientRect().height, lines, lh, logoTop: logo?.top, marginRule: /90deg/.test(field) };
    });
    await check('welcome: the card\'s "Continue with email" is one line', hero.lines === 1, JSON.stringify(hero));
    await check('welcome: the primary action is finger-sized (≥ 44px)', hero.demoH >= 44, JSON.stringify(hero));
    await check('welcome: no margin rule runs through the centred text', !hero.marginRule, JSON.stringify(hero));
    await check('welcome: the content starts below the status bar', hero.logoTop >= INSETS.top, JSON.stringify(hero));
    await check('welcome: no horizontal overflow', await overflowOf(page) <= 1);
    // App Review's first screen: at scroll top the wordmark sits at or below
    // the status bar / Dynamic Island on every iPhone size, the tallest
    // included (iPhone 17 Pro Max, 440 × 956, top inset 62). A centred column
    // taller than the screen must not overflow upwards past the inset.
    for (const d of [{ id: 'iPhone 17 Pro Max', width: 440, height: 956, insets: { top: 62, bottom: 34 } }, ...DEVICES.filter(x => x.insets)]) {
      await page.setViewportSize({ width: d.width, height: d.height });
      await setInsets(page, d.insets);
      await page.evaluate(() => window.scrollTo(0, 0));
      await settle();
      const at = await page.evaluate(() => {
        const logo = document.querySelector('.auth-wrap .logo');
        const r = logo?.getBoundingClientRect();
        return { logoTop: r ? Math.round(r.top) : null, scrollY: Math.round(window.scrollY), wrapScroll: document.querySelector('.auth-wrap')?.scrollTop ?? null };
      });
      await check(`welcome@${d.id}: the wordmark is at or below the status-bar inset at scroll top`, at.logoTop !== null && at.logoTop >= d.insets.top, JSON.stringify({ ...at, inset: d.insets.top }));
    }
    await page.setViewportSize(PHONE);
    await setInsets(page, INSETS);
    await clearInsets(page);

    await createProfile({ name: 'Layout Student', year: 10, course: 'in' });
    await online.signIn({ name: 'Layout Student' });
    await settle();

    // ── 2 · shell: the strips are paper, the bars keep out of them ──────────
    await goto('/');
    await settle();
    await setInsets(page, INSETS);
    const shell = await page.evaluate(({ top, bottom }) => {
      const page = getComputedStyle(document.body).getPropertyValue('--page').trim();
      const probe = document.createElement('div'); probe.style.color = page; document.body.appendChild(probe);
      const pageRgb = getComputedStyle(probe).color; probe.remove();
      const htmlBg = getComputedStyle(document.documentElement).backgroundColor;
      const bar = document.querySelector('.topbar');
      const strip = document.elementFromPoint(innerWidth / 2, 4);
      const brand = bar.querySelector('a, button, svg')?.getBoundingClientRect();
      const nav = document.querySelector('.mobilenav');
      const items = [...nav.querySelectorAll('.mnav-item')].map(e => e.getBoundingClientRect());
      const skip = document.querySelector('.skip-link')?.getBoundingClientRect();
      return {
        skipBottom: skip ? Math.round(skip.bottom) : null,
        pageRgb, htmlBg, stripIsBar: !!strip && (strip === bar || bar.contains(strip)), barBg: getComputedStyle(bar).backgroundColor,
        brandTop: brand?.top, navBottom: Math.max(...items.map(r => r.bottom)), navEdge: nav.getBoundingClientRect().bottom, vh: innerHeight, top, bottom
      };
    }, INSETS);
    await check('the document background is the page colour, so nothing dark shows behind the bars', shell.htmlBg === shell.pageRgb, JSON.stringify(shell));
    await check('the status-bar strip is the top bar, in the page colour', shell.stripIsBar && shell.barBg === shell.pageRgb, JSON.stringify(shell));
    await check('the skip link stays off screen until focused, status-bar inset included', shell.skipBottom === null || shell.skipBottom <= 0, JSON.stringify(shell));
    await check('the top bar\'s content starts below the status bar', shell.brandTop >= INSETS.top, JSON.stringify(shell));
    await check('the tab bar reaches the bottom edge; its items end above the home indicator',
      Math.abs(shell.navEdge - shell.vh) <= 1 && shell.navBottom <= shell.vh - INSETS.bottom + 1, JSON.stringify(shell));
    await clearInsets(page);

    // ── 3 · Practice: one question with Type, Write and Photo ───────────────
    await goto('/practice');
    await page.waitForSelector('.q-prompt', { timeout: 30000 }).catch(() => null);
    await settle();
    await check('a question offering Type, Write and Photo is served', await questionWhere(page, settle, hasModes));
    await setInsets(page, INSETS);
    await toTop(page);
    const head = await page.evaluate(({ top }) => {
      const bar = document.querySelector('.ws-bar');
      const name = bar.querySelector('.ctx-pill-name');
      const exitLabel = bar.querySelector('.ws-exit > span');
      const buttons = [...bar.querySelectorAll('button')].filter(b => b.getClientRects().length).map(b => b.getBoundingClientRect().top);
      const tabs = document.querySelector('.mode-tabs').getBoundingClientRect();
      const tools = document.querySelector('.ws-tools').getBoundingClientRect();
      const widths = [...document.querySelectorAll('.mode-tab')].map(t => Math.round(t.getBoundingClientRect().width));
      return {
        text: name.textContent, clipped: name.scrollHeight > name.clientHeight + 1 || name.scrollWidth > name.clientWidth + 1,
        exitLabelShown: !!exitLabel && getComputedStyle(exitLabel).display !== 'none', minButtonTop: Math.min(...buttons),
        barTop: bar.getBoundingClientRect().top, tabsW: tabs.width, toolsW: tools.width, widths, top
      };
    }, INSETS);
    await check('question bar: the topic is shown whole (two lines allowed), not cut off', !head.clipped, JSON.stringify(head));
    await check('question bar: the way out is its chevron, leaving the topic the width', !head.exitLabelShown, JSON.stringify(head));
    await check('question bar: fills the status-bar strip, its controls start below it', head.barTop <= 0.5 && head.minButtonTop >= INSETS.top, JSON.stringify(head));
    await check('Type · Write · Photo spans the column in three equal parts',
      head.tabsW >= head.toolsW - 1 && Math.max(...head.widths) - Math.min(...head.widths) <= 2, JSON.stringify(head));

    // Type: the final answer and the working stay above the bar at the foot.
    const typeTab = page.getByRole('button', { name: 'Answer by typing' });
    await typeTab.click(); await settle();
    const working = page.locator('.editor-body button[aria-expanded="false"]').first();
    if (await working.count()) { await working.click().catch(() => {}); await settle(); }
    const typed = await clearOfBarAtFoot(page, '.editor-body input, .editor-body textarea, .editor-shell');
    await check('Type: at the foot of the page, the answer, the working and the sheet end above the action bar', typed.ok, JSON.stringify(typed));
    await check('Type: the action bar reaches the bottom edge and pads into the home indicator',
      Math.abs(typed.barBottom - typed.vh) <= 1, JSON.stringify(typed));
    const status = await page.evaluate(() => {
      const line = document.querySelector('.ws-actions .status-line');
      const btn = document.querySelector('.ws-actions .btn-primary')?.getBoundingClientRect();
      return { h: line.getBoundingClientRect().height, btnBottom: btn?.bottom, vh: innerHeight };
    });
    await check('the primary action ends above the home indicator', status.btnBottom <= status.vh - INSETS.bottom, JSON.stringify(status));

    // Write: the whole sheet is shown between the bars, mode switch uncovered.
    await toTop(page);
    await page.getByRole('button', { name: 'Answer by handwriting' }).click();
    await page.waitForSelector('.editor-shell .ink-canvas', { timeout: 20000 }).catch(() => null);
    await page.waitForTimeout(1200);
    const write = await page.evaluate(() => {
      const sheet = document.querySelector('.editor-shell').getBoundingClientRect();
      const bar = document.querySelector('.ws-actions').getBoundingClientRect();
      const head = document.querySelector('.ws-bar').getBoundingClientRect();
      const peek = document.querySelector('.ws-qpeek.is-on')?.getBoundingClientRect();
      const ceiling = Math.max(head.bottom, peek ? peek.bottom : 0);
      const tabsCovered = [...document.querySelectorAll('.mode-tab')].filter(t => {
        const r = t.getBoundingClientRect();
        if (r.bottom < ceiling) return false; // scrolled away, not covered
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !(hit === t || t.contains(hit));
      }).length;
      return { sheetTop: Math.round(sheet.top), sheetBottom: Math.round(sheet.bottom), barTop: Math.round(bar.top), ceiling: Math.round(ceiling), tabsCovered };
    });
    await check('Write: choosing it shows the whole sheet between the top bars and the action bar',
      write.sheetTop >= write.ceiling - 1 && write.sheetBottom <= write.barTop + 1, JSON.stringify(write));
    await check('Write: nothing lies over the mode switch', write.tabsCovered === 0, JSON.stringify(write));
    const writeStatus = await page.evaluate(() => {
      const line = document.querySelector('.ws-actions .status-line');
      const by = line.querySelector('.ws-read-by');
      const lh = parseFloat(getComputedStyle(line).lineHeight) || 17;
      return { lines: Math.round(line.getBoundingClientRect().height / lh), byH: by?.getBoundingClientRect().height, lh };
    });
    await check('Write: the status reads as whole lines (each statement on one line, at most two)',
      writeStatus.lines <= 2 && (!writeStatus.byH || writeStatus.byH < writeStatus.lh * 1.5), JSON.stringify(writeStatus));
    const inked = await clearOfBarAtFoot(page, '.editor-shell');
    await check('Write: at the foot of the page the sheet ends above the action bar', inked.ok, JSON.stringify(inked));

    // Photo: one full-width target, the instruction on one line.
    await toTop(page);
    await page.evaluate(() => { HTMLInputElement.prototype.click = function () {}; }); // no file picker in a test
    await page.getByRole('button', { name: /Answer (with|by) (a )?photo/i }).first().click().catch(async () => {
      await page.locator('.mode-tab').nth(2).click();
    });
    await settle();
    const photo = await page.evaluate(() => {
      const b = document.querySelector('.photo-pick');
      if (!b) return null;
      const body = b.closest('.editor-body').getBoundingClientRect();
      const title = b.querySelector('.photo-pick-title').getBoundingClientRect();
      const help = b.querySelector('.photo-pick-help').getBoundingClientRect();
      const lh = parseFloat(getComputedStyle(b.querySelector('.photo-pick-title')).lineHeight) || 22;
      const pad = parseFloat(getComputedStyle(b.closest('.editor-body')).paddingLeft) * 2;
      return { w: b.getBoundingClientRect().width, avail: body.width - pad, titleH: title.height, lh, helpBelow: help.top >= title.bottom - 1 };
    });
    await check('Photo: the target spans the sheet', !!photo && photo.w >= photo.avail - 1, JSON.stringify(photo));
    await check('Photo: "Photograph your working on paper" is one line, the formats beneath it',
      !!photo && photo.titleH < photo.lh * 1.5 && photo.helpBelow, JSON.stringify(photo));
    const photoFoot = await clearOfBarAtFoot(page, '.editor-body input:not([type=file]), .photo-pick, .editor-shell');
    await check('Photo: at the foot of the page the target, the answer and the sheet end above the action bar', photoFoot.ok, JSON.stringify(photoFoot));

    // Multiple choice: every option, D included, above the bar at the foot;
    // a short page still puts the bar at the bottom edge.
    await clearInsets(page);
    await check('a multiple-choice question is served', await questionWhere(page, settle, hasOptions));
    await setInsets(page, INSETS);
    const options = await clearOfBarAtFoot(page, '.mcq-opt');
    await check('MCQ: at the foot of the page every option ends above the action bar', options.ok, JSON.stringify(options));
    await check('MCQ: the action bar sits at the bottom edge, never mid-screen', Math.abs(options.barBottom - options.vh) <= 1, JSON.stringify(options));
    await check('Practice: no horizontal overflow', await overflowOf(page) <= 1);
    // A larger text size: the native shell narrows the layout viewport by the
    // text scale (WebShell.viewportContent), so at 120% an iPhone 16 lays out
    // 327 × 710 and the bar's status wraps. The bar must still be its own spacer.
    await page.setViewportSize({ width: 327, height: 710 });
    await page.waitForTimeout(400);
    const larger = await clearOfBarAtFoot(page, '.mcq-opt');
    await check('MCQ at a 120% text size (327 × 710): every option still ends above the action bar', larger.ok, JSON.stringify(larger));
    await page.setViewportSize(PHONE);
    await page.waitForTimeout(300);
    await clearInsets(page);

    // ── 4 · Settings: sections land below the top bar, the foot clears the tab bar
    await goto('/settings');
    await settle();
    await setInsets(page, INSETS);
    await page.locator('.set-menu-item').first().click();
    await page.waitForTimeout(900);
    const plan = await page.evaluate(() => {
      const card = document.querySelector('.settings-grid .grid > .card');
      const top = document.querySelector('.topbar').getBoundingClientRect().bottom;
      const nav = document.querySelector('.mobilenav').getBoundingClientRect().top;
      const rows = [...card.querySelectorAll('.set-row')].map(r => r.getBoundingClientRect());
      return { cardTop: Math.round(card.getBoundingClientRect().top), topbar: Math.round(top), nav: Math.round(nav), lastRow: Math.round(rows.at(-1)?.bottom) };
    });
    await check('Settings: the Plan section opens below the top bar', plan.cardTop >= plan.topbar, JSON.stringify(plan));
    await toEnd(page);
    await page.waitForTimeout(300);
    const foot = await page.evaluate(() => {
      const nav = document.querySelector('.mobilenav').getBoundingClientRect().top;
      const cards = [...document.querySelectorAll('.settings-grid .card')].filter(c => c.getClientRects().length);
      return { nav: Math.round(nav), last: Math.round(cards.at(-1).getBoundingClientRect().bottom) };
    });
    await check('Settings: at the foot, the last section ends above the tab bar', foot.last <= foot.nav, JSON.stringify(foot));
    await clearInsets(page);

    // ── 4b · the smallest and the largest iPhone, at 100% and 200% ─────────
    // 200% is the page zoomed to twice the size (WCAG 1.4.4): the layout
    // viewport halves, and so do the insets in CSS pixels.
    for (const d of OTHER_PHONES) {
      for (const zoom of [1, 2]) {
        const tag = `${d.id} ${d.width}×${d.height} at ${zoom * 100}%`;
        const vp = { width: Math.round(d.width / zoom), height: Math.round(d.height / zoom) };
        const insets = { top: Math.round(d.insets.top / zoom), bottom: Math.round(d.insets.bottom / zoom) };
        await page.setViewportSize(vp);
        await goto('/practice');
        await page.waitForSelector('.q-prompt', { timeout: 30000 }).catch(() => null);
        await settle();
        await questionWhere(page, settle, hasModes);
        await setInsets(page, insets);
        await toTop(page);
        const modes = await page.evaluate(() => {
          const tabs = document.querySelector('.mode-tabs')?.getBoundingClientRect();
          const tools = document.querySelector('.ws-tools')?.getBoundingClientRect();
          return tabs && tools ? { tabsW: Math.round(tabs.width), toolsW: Math.round(tools.width) } : null;
        });
        await check(`${tag}: Type · Write · Photo spans the column`, !!modes && modes.tabsW >= modes.toolsW - 1, JSON.stringify(modes));
        await page.getByRole('button', { name: 'Answer by typing' }).click();
        await settle();
        const typedFoot = await clearOfBarAtFoot(page, '.editor-body input, .editor-body textarea, .editor-shell');
        await check(`${tag}: Type — at the foot every field ends above the action bar, which reaches the bottom edge`,
          typedFoot.ok && Math.abs(typedFoot.barBottom - typedFoot.vh) <= 1, JSON.stringify(typedFoot));
        await toTop(page);
        await page.getByRole('button', { name: 'Answer by handwriting' }).click();
        await page.waitForSelector('.editor-shell .ink-canvas', { timeout: 20000 }).catch(() => null);
        await page.waitForTimeout(1200);
        if (zoom === 1) {
          const shown = await page.evaluate(() => {
            const sheet = document.querySelector('.editor-shell').getBoundingClientRect();
            const bar = document.querySelector('.ws-actions').getBoundingClientRect();
            const head = document.querySelector('.ws-bar').getBoundingClientRect();
            const peek = document.querySelector('.ws-qpeek.is-on')?.getBoundingClientRect();
            const ceiling = Math.max(head.bottom, peek ? peek.bottom : 0);
            const tops = [...document.querySelectorAll('.ink-toolbar .ink-tool')].filter(t => t.getClientRects().length).map(t => Math.round(t.getBoundingClientRect().top));
            return { sheetTop: Math.round(sheet.top), sheetBottom: Math.round(sheet.bottom), barTop: Math.round(bar.top), ceiling: Math.round(ceiling), toolRows: new Set(tops).size };
          });
          await check(`${tag}: Write — choosing it shows the whole sheet between the top bars and the action bar`,
            shown.sheetTop >= shown.ceiling - 1 && shown.sheetBottom <= shown.barTop + 1, JSON.stringify(shown));
          await check(`${tag}: Write — the ink tools stay on one row`, shown.toolRows === 1, JSON.stringify(shown));
        }
        const inkFoot = await clearOfBarAtFoot(page, '.editor-shell');
        await check(`${tag}: Write — at the foot the sheet ends above the action bar`, inkFoot.ok, JSON.stringify(inkFoot));
        const spill = await overflowDetail(page);
        await check(`${tag}: no horizontal overflow`, spill.over <= 1, JSON.stringify(spill));
        await clearInsets(page);
      }
    }
    await page.setViewportSize(PHONE);

    // ── 5 · iPad and desktop keep their composition ────────────────────────
    for (const vp of LARGER) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await goto('/practice');
      await page.waitForSelector('.q-prompt', { timeout: 30000 }).catch(() => null);
      await settle();
      await questionWhere(page, settle, hasModes);
      const s = await page.evaluate(() => {
        const tabs = document.querySelector('.mode-tabs')?.getBoundingClientRect();
        const tools = document.querySelector('.ws-tools')?.getBoundingClientRect();
        const actions = getComputedStyle(document.querySelector('.ws-actions'));
        const exitLabel = document.querySelector('.ws-exit > span');
        const peek = getComputedStyle(document.querySelector('.ws-qpeek'));
        const name = getComputedStyle(document.querySelector('.ws-bar .ctx-pill-name'));
        return {
          tabsShare: tabs && tools ? +(tabs.width / tools.width).toFixed(2) : null,
          actionsPosition: actions.position, actionsMarginTop: actions.marginTop,
          exitLabel: !!exitLabel && getComputedStyle(exitLabel).display !== 'none',
          peekPosition: peek.position, peekTop: peek.top, nameWrap: name.whiteSpace,
          barMinHeight: getComputedStyle(document.querySelector('.ws-bar')).minHeight
        };
      });
      await check(`${vp.id} ${vp.width}×${vp.height}: the workspace keeps its composition (inline mode switch, labelled exit, sticky bars, one-line topic)`,
        s.tabsShare !== null && s.tabsShare < 0.8 && s.actionsPosition === 'sticky' && s.actionsMarginTop === '6px' && s.exitLabel
          && s.peekPosition === 'sticky' && s.peekTop === '52px' && s.nameWrap === 'nowrap' && s.barMinHeight === '52px',
        JSON.stringify(s));
      await goto('/');
      await settle();
      const shellSig = await page.evaluate(() => ({
        side: getComputedStyle(document.querySelector('.sidebar')).display !== 'none',
        bar: !!document.querySelector('.mobilenav') && getComputedStyle(document.querySelector('.mobilenav')).display !== 'none',
        topbar: Math.round(document.querySelector('.topbar').getBoundingClientRect().height),
        pad: getComputedStyle(document.querySelector('.content')).paddingBottom
      }));
      await check(`${vp.id}: the shell keeps its rail and top bar, no bottom bar`, shellSig.side && !shellSig.bar && shellSig.topbar === 64, JSON.stringify(shellSig));
    }
    await page.setViewportSize(PHONE);
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
