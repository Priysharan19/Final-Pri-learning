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
      await goto('/practice');
      await page.waitForSelector('.q-prompt', { timeout: 30000 }).catch(() => null);
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
      await check(`${tag}: a question renders`, await page.locator('.q-prompt').count() === 1);

      // ── 3 · writing: fits the screen, takes strokes, no developer copy ───
      const writeTab = page.getByRole('button', { name: 'Answer by handwriting' });
      if (await writeTab.count()) { await writeTab.click(); await settle(); }
      const canvas = page.locator('.ink-canvas').last();
      const ink = await canvas.count() ? await canvas.evaluate(c => {
        const r = c.getBoundingClientRect();
        return { h: Math.round(r.height), w: Math.round(r.width) };
      }) : null;
      if (vp.ff === 'expanded' && !vp.short || vp.id === 'tablet-portrait') {
        await check(`${tag}: the writing area keeps the iPad height (${BASE_INK_HEIGHT}px)`, ink?.h === BASE_INK_HEIGHT, JSON.stringify(ink));
      } else {
        const limit = Math.max(240, vp.height - 200);
        await check(`${tag}: the writing area fits the screen (≤ ${limit}px, ≥ 240px)`, !!ink && ink.h <= limit && ink.h >= 240, JSON.stringify(ink));
      }
      let drew = false;
      if (ink) {
        await canvas.scrollIntoViewIfNeeded();
        const box = await canvas.boundingBox();
        if (box) {
          for (const [y, x0, x1] of [[0.35, 0.2, 0.5], [0.6, 0.25, 0.6]]) {
            await page.mouse.move(box.x + box.width * x0, box.y + box.height * y);
            await page.mouse.down();
            for (let i = 1; i <= 8; i++) await page.mouse.move(box.x + box.width * (x0 + (x1 - x0) * i / 8), box.y + box.height * y + (i % 2 ? 6 : -6));
            await page.mouse.up();
          }
          await page.waitForTimeout(150);
          drew = await page.evaluate(() => {
            const base = [...document.querySelectorAll('.ink-canvas, canvas')].find(c => c.width > 0 && c.getContext);
            const all = [...document.querySelectorAll('canvas')];
            return all.some(c => {
              try {
                const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
                for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true;
              } catch { /* not a 2d canvas */ }
              return false;
            }) || !!base && false;
          });
        }
      }
      await check(`${tag}: synthetic strokes land on the writing area`, drew);
      const devCopy = await page.evaluate(() => /legacy JS fallback|not native PencilKit|legacy JavaScript handwriting/i.test(document.body.innerText));
      await check(`${tag}: no developer-only handwriting copy is shown to students`, !devCopy);

      // ── 4 · typing is first class; the primary action is reachable ───────
      const typeTab = page.getByRole('button', { name: 'Answer by typing' });
      if (await typeTab.count()) { await typeTab.click(); await settle(); }
      const input = page.locator('.editor-body input.answer-input').first();
      const attrs = await input.count() ? await input.evaluate(e => ({ m: e.inputMode, k: e.enterKeyHint })) : null;
      await check(`${tag}: the answer box opens a full keyboard with a Go key`, attrs === null || (attrs.m === 'text' && attrs.k === 'go'),
        JSON.stringify(attrs));
      if (attrs === null) note(`${tag}: this question has no typed answer box`);
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
      const launcher = await page.evaluate(() => {
        const l = document.querySelector('.pri-explain-launch');
        const n = document.querySelector('.ctx-next');
        if (!l) return { present: false, ok: true };
        const a = l.getBoundingClientRect(), b = n?.getBoundingClientRect();
        const overlap = b && !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
        return { present: true, ok: !overlap && a.left >= -1 && a.right <= innerWidth + 1 && a.bottom <= innerHeight + 1 };
      });
      await check(`${tag}: Pri Explain's launcher, when offered, sits clear of Next and inside the screen`, launcher.ok, JSON.stringify(launcher));

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
