// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · E2E flow — the responsive product matrix (CP-03).
//
// One shared product across phones, tablets and short windows, checked the way
// a student meets it: every critical route fits, navigation works, the writing
// area fits the screen and accepts strokes, the typed answer path is first
// class, the primary action can be reached and pressed before and after an
// answer, Settings controls are not covered, nothing a finger presses is under
// 44px, and the iPad (EXPANDED) composition is unchanged.
//
// Run in both engines (WebKit is the engine behind every Apple web view):
//   node client/test/tour-responsive-matrix.js
//   node client/test/tour-responsive-matrix.js --browser=webkit
// Synthetic browser evidence (S1). It is never evidence about a device.
// ─────────────────────────────────────────────────────────────────────────────
import { pathToFileURL } from 'node:url';

export const VIEWPORTS = [
  { id: 'small-phone', width: 360, height: 640, ff: 'compact' },
  { id: 'phone', width: 390, height: 844, ff: 'compact' },
  { id: 'large-phone', width: 430, height: 932, ff: 'compact' },
  { id: 'tablet-portrait', width: 820, height: 1180, ff: 'medium' },
  { id: 'tablet-landscape', width: 1180, height: 820, ff: 'expanded' },
  { id: 'short', width: 844, height: 390, ff: 'expanded', short: true },
];
const ROUTES = ['/', '/practice', '/progress', '/exams', '/tasks', '/settings', '/review'];
// The writing area every non-short window had before CP-03; EXPANDED keeps it.
const BASE_INK_HEIGHT = 380;

const overflowOf = page => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

async function reachable(page, selector) {
  return page.evaluate(sel => {
    const el = typeof sel === 'string' ? document.querySelector(sel) : null;
    if (!el) return { ok: false, why: 'missing' };
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const inside = r.top >= 0 && r.bottom <= innerHeight + 1 && r.left >= -1 && r.right <= innerWidth + 1;
    return { ok: !!hit && (hit === el || el.contains(hit)) && inside, why: hit ? `${hit.tagName}.${hit.className}`.slice(0, 60) : 'nothing', inside };
  }, selector);
}

// Practice draws questions at random, and some take only a multiple-choice or
// working answer. A check that moves with the draw cannot be gated on, so step
// through questions (Next) until one offers both handwriting and typing.
async function writableQuestion(page, settle) {
  for (let i = 0; i < 12; i++) {
    const ready = await page.evaluate(() => {
      // The accessible name leads with the visible word ("Write: answer by
      // handwriting", WCAG 2.5.3), so match the phrase, not the whole name.
      const tabs = [...document.querySelectorAll('.mode-tab')].map(t => (t.getAttribute('aria-label') || '').toLowerCase());
      return tabs.some(n => n.includes('answer by handwriting')) && tabs.some(n => n.includes('answer by typing'));
    });
    if (ready) return true;
    const next = page.locator('.ctx-next');
    if (!(await next.count())) return false;
    await next.click({ timeout: 5000 }).catch(() => {});
    await page.waitForSelector('.q-prompt', { timeout: 30000 }).catch(() => null);
    await settle();
  }
  return false;
}

export const flow = {
  id: 'responsive-matrix',
  name: 'Responsive matrix · 6 viewports, critical routes, write/type, actions',

  async run({ page, check, goto, settle, createProfile, note, browserName = 'chromium' }) {
    note(`engine: ${browserName}`);
    await goto('/');
    await createProfile({ name: 'Matrix Student', year: 10, course: 'in' });
    await settle();

    for (const vp of VIEWPORTS) {
      const tag = `${vp.id} ${vp.width}×${vp.height}`;
      await page.setViewportSize({ width: vp.width, height: vp.height });

      // ── 1 · every critical route fits ────────────────────────────────────
      for (const route of ROUTES) {
        await goto(route);
        await page.waitForTimeout(700);
        const over = await overflowOf(page);
        await check(`${tag}: ${route} has no horizontal overflow`, over <= 1, `${over}px`);
      }

      // ── 2 · form factor and navigation ───────────────────────────────────
      // Practice is a thinking-mode route (docs/design/PRI-DREAM-INTERFACE.md
      // §10): it deliberately has no rail and no bottom bar. The shell is
      // therefore measured on Home, and Practice is asserted to be free of it.
      await goto('/');
      await settle();
      const shell = await page.evaluate(() => ({
        ff: document.documentElement.dataset.ff,
        short: document.documentElement.dataset.short,
        bar: !!document.querySelector('.mobilenav') && getComputedStyle(document.querySelector('.mobilenav')).display !== 'none',
        side: !!document.querySelector('.sidebar') && getComputedStyle(document.querySelector('.sidebar')).display !== 'none',
      }));
      await check(`${tag}: classified ${vp.ff}${vp.short ? ' + short' : ''}`,
        shell.ff === vp.ff && shell.short === String(!!vp.short), JSON.stringify(shell));
      const phoneNav = vp.width <= 760;
      await check(`${tag}: ${phoneNav ? 'bottom bar, no sidebar' : 'sidebar, no bottom bar'}`,
        phoneNav ? shell.bar && !shell.side : shell.side && !shell.bar, JSON.stringify(shell));
      // The top bar and sidebar line up (measured where the shell exists).
      const align = vp.width > 760 ? await page.evaluate(() => {
        const t = document.querySelector('.topbar')?.getBoundingClientRect();
        const sb = document.querySelector('.sidebar')?.getBoundingClientRect();
        return t && sb ? { topbarBottom: Math.round(t.bottom), sidebarTop: Math.round(sb.top) } : null;
      }) : null;

      await goto('/practice');
      await page.waitForSelector('.q-prompt', { timeout: 30000 }).catch(() => null);
      await settle();
      const thinking = await page.evaluate(() => {
        const shown = sel => { const el = document.querySelector(sel); return !!el && getComputedStyle(el).display !== 'none'; };
        return { bar: shown('.mobilenav'), side: shown('.sidebar'), workspaceBar: shown('.ws-bar') };
      });
      await check(`${tag}: Practice is thinking mode — its own bar, no rail, no bottom bar`,
        thinking.workspaceBar && !thinking.bar && !thinking.side, JSON.stringify(thinking));
      await check(`${tag}: a question renders`, await page.locator('.q-prompt').count() === 1);
      await check(`${tag}: a question with handwriting and typing is available`, await writableQuestion(page, settle));

      // ── 3 · writing: fits the screen, takes strokes, no developer copy ───
      const writeTab = page.getByRole('button', { name: 'Answer by handwriting' });
      if (await writeTab.count()) { await writeTab.click(); await settle(); }
      const canvas = page.locator('.ink-canvas').last();
      const ink = await canvas.count() ? await canvas.evaluate(c => {
        const r = c.getBoundingClientRect();
        return { h: Math.round(r.height), w: Math.round(r.width) };
      }) : null;
      if (vp.ff === 'expanded' && !vp.short || vp.id === 'tablet-portrait') {
        // One sheet of the notebook is at least the pre-CP-03 iPad height and
        // never taller than the window less its bars (the redesign's page is
        // 420px in landscape and up to 640px in portrait).
        await check(`${tag}: the writing area is at least the iPad height (${BASE_INK_HEIGHT}px) and fits the window`,
          !!ink && ink.h >= BASE_INK_HEIGHT && ink.h <= vp.height - 150, JSON.stringify(ink));
      } else {
        // Room must remain for the top bar, toolbar and the bottom bars: the
        // pre-CP-03 fixed 380px canvas fails this on a 640px-tall phone.
        const limit = Math.max(240, vp.height - 300);
        await check(`${tag}: the writing area fits the screen (≤ ${limit}px, ≥ 240px)`, !!ink && ink.h <= limit && ink.h >= 240, JSON.stringify(ink));
      }
      // The editor's own committed-ink canvas: empty before, ink inside the
      // stroke box after. No other canvas on the page can satisfy this.
      const inkBox = () => page.evaluate(() => {
        const c = document.querySelector('.editor-shell .ink-canvas-base') || document.querySelector('.ink-canvas-base');
        if (!c || !c.width) return null;
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let minY = Infinity, maxY = -1, minX = Infinity, maxX = -1;
        for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
          if (d[(y * c.width + x) * 4 + 3] > 0) { if (y < minY) minY = y; if (y > maxY) maxY = y; if (x < minX) minX = x; if (x > maxX) maxX = x; }
        }
        return { empty: maxY < 0, minX, maxX, minY, maxY, w: c.width, h: c.height };
      });
      let drew = false;
      if (ink) {
        await canvas.scrollIntoViewIfNeeded();
        const before = await inkBox();
        const box = await canvas.boundingBox();
        if (box && before?.empty) {
          for (const [y, x0, x1] of [[0.35, 0.2, 0.5], [0.6, 0.25, 0.6]]) {
            await page.mouse.move(box.x + box.width * x0, box.y + box.height * y);
            await page.mouse.down();
            for (let i = 1; i <= 8; i++) await page.mouse.move(box.x + box.width * (x0 + (x1 - x0) * i / 8), box.y + box.height * y + (i % 2 ? 6 : -6));
            await page.mouse.up();
          }
          await page.waitForTimeout(150);
          const after = await inkBox();
          const sx = after ? after.w / box.width : 1;
          drew = !!after && !after.empty &&
            after.minX >= box.width * 0.15 * sx && after.maxX <= box.width * 0.65 * sx &&
            after.minY >= box.height * 0.25 * sx && after.maxY <= box.height * 0.72 * sx;
        }
      }
      await check(`${tag}: synthetic strokes land on the writing area`, drew);
      if (vp.id === 'phone' && drew) {
        // Ink near the foot of the sheet is what widening could push off it.
        const low = await canvas.boundingBox();
        await page.mouse.move(low.x + low.width * 0.2, low.y + low.height * 0.9);
        await page.mouse.down();
        for (let i = 1; i <= 8; i++) await page.mouse.move(low.x + low.width * (0.2 + 0.3 * i / 8), low.y + low.height * 0.9);
        await page.mouse.up();
        await page.waitForTimeout(150);
        const beforeWiden = await inkBox();
        // Phone → tablet roughly doubles the sheet's width: the widening case.
        await page.setViewportSize({ width: 820, height: 1180 });
        await page.waitForTimeout(400);
        const rotated = await inkBox();
        // Ink scaled past the foot is simply not painted, so "still visible" is
        // the test: the lowest stroke (drawn at 90% height) must still show
        // near the foot of the wider sheet.
        // The notebook sheet is taller on a tablet than on a phone (up to 640px
        // against 340px), so ink drawn near the phone sheet's foot no longer
        // sits at the tablet sheet's foot. What must hold is unchanged: the ink
        // is still there, it moved down with the widening, and none of it is
        // cut off at an edge.
        await check(`${tag}: widening to a tablet keeps every stroke on the sheet`,
          !!rotated && !rotated.empty && rotated.maxY >= rotated.h * 0.5 && rotated.maxY <= rotated.h - 4 && rotated.maxX < rotated.w - 1,
          JSON.stringify(rotated));
        // And it was scaled, not merely left in place: the ink's right edge
        // keeps its share of the sheet's width (unscaled ink would halve it).
        const shareBefore = beforeWiden && !beforeWiden.empty ? beforeWiden.maxX / beforeWiden.w : null;
        const shareAfter = rotated && !rotated.empty ? rotated.maxX / rotated.w : null;
        await check(`${tag}: widening scales the ink with the sheet`,
          shareBefore != null && shareAfter != null && Math.abs(shareAfter - shareBefore) <= 0.08,
          JSON.stringify({ shareBefore, shareAfter }));
        // (Ink pushed past the foot is painted up to the very edge and cut off;
        //  the clamp leaves the lowest point 8px above it.)
        await page.setViewportSize({ width: 360, height: 640 });
        await page.waitForTimeout(400);
        const narrowed = await inkBox();
        await check(`${tag}: narrowing to a small phone keeps every stroke on the sheet`,
          !!narrowed && !narrowed.empty && narrowed.maxX < narrowed.w - 1 && narrowed.maxY < narrowed.h - 1, JSON.stringify(narrowed));
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.waitForTimeout(400);
      } else {
        await check(`${tag}: (widening with ink is exercised on the phone viewport)`, vp.id !== 'phone' || drew);
        await check(`${tag}: (narrowing with ink is exercised on the phone viewport)`, vp.id !== 'phone' || drew);
      }
      const devCopy = await page.evaluate(() => /legacy JS fallback|not native PencilKit|legacy JavaScript handwriting/i.test(document.body.innerText));
      await check(`${tag}: no developer-only handwriting copy is shown to students`, !devCopy);

      // ── 4 · typing is first class; the primary action is reachable ───────
      const typeTab = page.getByRole('button', { name: 'Answer by typing' });
      if (await typeTab.count()) { await typeTab.click(); await settle(); }
      const input = page.locator('.editor-body input.answer-input').first();
      // The markup is what the OS keyboard reads; not every engine exposes the
      // enterKeyHint/inputMode DOM properties (Linux WebKit does not).
      const attrs = await input.count() ? await input.evaluate(e => ({ m: e.getAttribute('inputmode'), k: e.getAttribute('enterkeyhint') })) : null;
      await check(`${tag}: the answer box opens a full keyboard with a Go key`, attrs !== null && attrs.m === 'text' && attrs.k === 'go',
        JSON.stringify(attrs));
      if (await input.count()) await input.fill('12345');
      const submit = await page.evaluate(() => {
        const b = [...document.querySelectorAll('.editor-foot .btn-primary')].find(x => x.offsetParent);
        if (b) b.setAttribute('data-matrix', 'submit');
        return !!b;
      });
      const submitReach = submit ? await reachable(page, '[data-matrix="submit"]') : { ok: false, why: 'no submit button' };
      await check(`${tag}: the submit action can be scrolled into view and pressed`, submitReach.ok, JSON.stringify(submitReach));
      if (submit) await page.locator('[data-matrix="submit"]').click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(1800);

      const after = await reachable(page, '.ctx-next');
      await check(`${tag}: after answering, Next is visible and not covered`, after.ok, JSON.stringify(after));
      // A worked solution is what offers Pri Explain; ask for it so the launcher
      // check always has something to measure.
      // Showing the solution ends the attempt with no marks, so it takes two
      // deliberate presses (the first arms it).
      const show = page.getByRole('button', { name: 'Show solution' });
      for (let press = 0; press < 2 && await show.count(); press++) {
        await show.first().click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(press ? 1200 : 250);
      }
      // The launcher is a row in the flow of the page under the marked work,
      // never a card floating over the student's reasoning: scroll to it, then
      // measure that it is on screen, within the width, and clear of Next.
      const launcher = await page.evaluate(() => {
        const l = document.querySelector('.pri-explain-launch');
        // Instant, centred scroll: the measurement must not race a scroll animation.
        l?.scrollIntoView({ block: 'center', behavior: 'instant' });
        const n = document.querySelector('.ctx-next');
        const bar = document.querySelector('.ws-actions');
        if (!l) return { present: false };
        const a = l.getBoundingClientRect(), b = n?.getBoundingClientRect(), c = bar?.getBoundingClientRect();
        const hits = r => !!r && !(a.right <= r.left || a.left >= r.right || a.bottom <= r.top || a.top >= r.bottom);
        const mid = document.elementFromPoint(a.left + a.width / 2, a.top + a.height / 2);
        return {
          present: true, overlap: hits(b), inside: a.left >= -1 && a.right <= innerWidth + 1 && a.top >= 0 && a.bottom <= innerHeight + 1,
          pressable: !!mid && (mid === l || l.contains(mid)), position: getComputedStyle(l).position, underBar: hits(c)
        };
      });
      await check(`${tag}: Pri Explain is offered once a worked solution exists`, launcher.present, JSON.stringify(launcher));
      await check(`${tag}: its launcher sits in the page flow, clear of Next, inside the screen and pressable`,
        launcher.present && !launcher.overlap && !launcher.underBar && launcher.inside && launcher.pressable && launcher.position === 'static',
        JSON.stringify(launcher));

      // ── iPad composition: the top bar and sidebar line up ─────────────────
      if (vp.width > 760) {
        await check(`${tag}: the sidebar starts below the top bar`, !!align && align.sidebarTop >= align.topbarBottom - 1, JSON.stringify(align));
      } else {
        await check(`${tag}: (sidebar alignment applies above 760px)`, true);
      }

      // ── 5 · touch targets on a phone ─────────────────────────────────────
      if (vp.width <= 760) {
        const small = await page.evaluate(() => {
          const out = [];
          for (const el of document.querySelectorAll('.mode-tab, .ink-tool, .editor-tool, .sym-key, .btn, .ctx-next, .mnav-item')) {
            const r = el.getBoundingClientRect();
            if (r.width < 1 || r.height < 1 || getComputedStyle(el).visibility === 'hidden') continue;
            if (r.height < 44) out.push(`${(el.getAttribute('aria-label') || el.textContent || el.className).trim().slice(0, 18)} ${Math.round(r.height)}`);
          }
          return out;
        });
        await check(`${tag}: everything a finger presses on Practice is ≥ 44px tall`, small.length === 0, JSON.stringify(small.slice(0, 8)));
      } else {
        await check(`${tag}: (touch-target rule applies to phones only)`, true);
      }

      // ── 6 · Settings controls are never covered ──────────────────────────
      await goto('/settings');
      await settle();
      const covered = await page.evaluate(() => {
        const out = [];
        const menu = document.querySelector('.set-menu');
        for (const el of document.querySelectorAll('.settings-grid button, .settings-grid input, .settings-grid select')) {
          if (menu && menu.contains(el)) continue;
          if (!el.offsetParent) continue;
          el.scrollIntoView({ block: 'center' });
          const r = el.getBoundingClientRect();
          const hit = document.elementFromPoint(r.left + Math.min(r.width / 2, 20), r.top + r.height / 2);
          if (!hit || !(hit === el || el.contains(hit) || hit.contains(el))) out.push(`${(el.getAttribute('aria-label') || el.textContent || el.id || el.tagName).trim().slice(0, 24)} under ${hit?.className || hit?.tagName}`);
        }
        return out;
      });
      await check(`${tag}: no Settings control is covered by another element`, covered.length === 0, JSON.stringify(covered.slice(0, 6)));
    }
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
