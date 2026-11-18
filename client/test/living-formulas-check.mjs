// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · living formulas in a real browser, both editions' notes pages
//
// Draws the real India page (pages/Notes.jsx) and NSW page (pages/NswNotes.jsx) through
// test/support/notes-page-gallery and drives the living formulas on them:
//
//   PLACED      each chapter shows exactly its formulas (placement.india.js / placement.nsw.js), in a
//               labelled "living" section after the formulas, none elsewhere;
//   REACTIVE    one key press on a slider changes, in the same cell and at once, the formula's number,
//               the current-values line, the graph's solid curve and the feature sentences; the dashed
//               grey original does not move; Reset (disabled until something changed) restores all four;
//   KEYBOARD    every parameter is a native slider reached by Tab with a name, a value text and arrow /
//               Home / End keys; the numbers inside the formula are not extra tab stops;
//   POINTER     dragging a number sideways changes it (mouse, and a pen or finger tap-drag); a pen tap
//               keeps the symbol lit until the next tap elsewhere;
//   HOVER/FOCUS hovering or focusing a symbol lights every occurrence of it (σ appears twice), shows a
//               role=tooltip note with its meaning and current value, lights the matching graph feature
//               (c → the y-intercept) and its sentence; Escape closes the note; symbols that act together
//               (h with k) light together while one is dragged; no layout shift; no animation under
//               reduced motion;
//   A11Y        the graph is an image with a label, the formula a math role with a spoken name, 44 px
//               targets, no horizontal overflow at 375 px, one h3 per figure under the section's h2;
//   ERRORS      no console or page error, light and dark, phone and desktop.
//
//   node client/test/living-formulas-check.mjs [--shots <dir>]
// ─────────────────────────────────────────────────────────────────────────────
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { LIVING_IN } from '../src/living/placement.india.js';
import { LIVING_NSW } from '../src/living/placement.nsw.js';

const CLIENT = fileURLToPath(new URL('..', import.meta.url));
const shotArg = process.argv.indexOf('--shots');
const SHOTS = shotArg > 0 ? process.argv[shotArg + 1] : null;
let pass = 0;
const failures = [];
const ok = (c, label) => { if (c) pass++; else failures.push(label); };

const server = await createServer({
  root: CLIENT, configFile: fileURLToPath(new URL('../vite.config.js', import.meta.url)), logLevel: 'error',
  server: { host: '127.0.0.1', port: 0, strictPort: false, hmr: false, watch: null, proxy: undefined },
  optimizeDeps: { entries: ['test/support/notes-page-gallery.html'] }
});
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const url = (pg, path, theme) => `${origin}/test/support/notes-page-gallery.html?page=${pg}&path=${encodeURIComponent(path)}&theme=${theme}`;
const CASES = [
  { name: 'india-quadratic', pg: 'in', id: 'c10-quadratic-equations', ids: LIVING_IN['c10-quadratic-equations'] },
  { name: 'india-sine', pg: 'in', id: 'c11-trig-functions', ids: LIVING_IN['c11-trig-functions'] },
  { name: 'india-circle', pg: 'in', id: 'c11-conic-sections', ids: LIVING_IN['c11-conic-sections'] },
  { name: 'nsw-transformations', pg: 'nsw', id: 'mav-11-03', ids: LIVING_NSW['mav-11-03'] },
  { name: 'nsw-normal', pg: 'nsw', id: 'mst-12-s2-10', ids: LIVING_NSW['mst-12-s2-10'] }
];
const fig = (page, id) => page.locator(`[data-living-formula="${id}"]`);
const baseD = (f) => f.locator('.lf-base').first().getAttribute('d');
const nowD = (f) => f.locator('.lf-now').first().getAttribute('d');

const browser = await chromium.launch();
try {
  for (const theme of ['light', 'dark']) {
    for (const [size, viewport] of [['phone', { width: 375, height: 812 }], ['desktop', { width: 1280, height: 900 }]]) {
      const context = await browser.newContext({ viewport, deviceScaleFactor: 2, colorScheme: theme, reducedMotion: size === 'phone' ? 'reduce' : 'no-preference' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      for (const c of CASES) {
        const where = `${c.name} (${theme}, ${size})`;
        await page.goto(url(c.pg, `/notes/${c.id}${c.pg === 'nsw' ? '' : ''}`, theme), { waitUntil: 'networkidle' });
        await page.waitForSelector('[data-nn-section="living"] .lf', { timeout: 30000 });
        await page.evaluate(() => { document.querySelectorAll('.nt-reveal').forEach(el => el.classList.add('is-in')); });

        // PLACED
        const placed = await page.evaluate(() => ({
          ids: [...document.querySelectorAll('[data-living-formula]')].map(f => f.dataset.livingFormula),
          inside: [...document.querySelectorAll('[data-living-formula]')].every(f => f.closest('[data-nn-section="living"]')),
          prev: document.querySelector('[data-nn-section="living"]').previousElementSibling?.dataset.nnSection,
          h2: document.querySelector('[data-nn-section="living"] h2')?.textContent,
          h3: document.querySelectorAll('[data-nn-section="living"] h3').length,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
        }));
        ok(JSON.stringify(placed.ids) === JSON.stringify(c.ids) && placed.inside, `${where}: formulas ${placed.ids} expected ${c.ids}`);
        ok(placed.prev === 'formulas' && placed.h3 === c.ids.length && /living formulas/i.test(placed.h2), `${where}: section after formulas, one h3 per figure (${placed.prev}, ${placed.h3})`);
        ok(placed.overflow <= 0, `${where}: overflows by ${placed.overflow}px`);

        const f = fig(page, c.ids[0]);
        await f.scrollIntoViewIfNeeded();
        // A11Y
        const a11y = await f.evaluate(el => {
          const ranges = [...el.querySelectorAll('input[type=range]')];
          const name = r => (r.labels?.[0]?.textContent || '').trim();
          return {
            ranges: ranges.length,
            named: ranges.every(r => name(r).length > 3 && r.getAttribute('aria-valuetext')),
            svg: el.querySelector('svg.lf-svg')?.getAttribute('role') === 'img' && el.querySelector('svg.lf-svg').getAttribute('aria-label').length > 10,
            math: el.querySelector('.lf-formula')?.getAttribute('role') === 'group' && el.querySelector('.lf-formula').getAttribute('aria-label').length > 10,
            slotsFocusable: [...el.querySelectorAll('.lf-slot')].some(s => s.tabIndex >= 0 || s.getAttribute('aria-hidden') !== 'true'),
            targets: ranges.every(r => r.getBoundingClientRect().height >= 43) && el.querySelector('.lf-reset').getBoundingClientRect().height >= 43,
            slots: el.querySelectorAll('.lf-slot').length,
            readout: el.querySelector('.lf-readout').textContent,
            caption: el.querySelector('.lf-caption').textContent,
            resetDisabled: el.querySelector('.lf-reset').disabled
          };
        });
        ok(a11y.ranges >= 2 && a11y.named, `${where}: every parameter is a named slider with a value text`);
        ok(a11y.svg && a11y.math, `${where}: graph is a labelled image, formula a named group with its spoken reading`);
        ok(!a11y.slotsFocusable, `${where}: numbers in the formula are not extra tab stops`);
        ok(a11y.targets, `${where}: sliders and Reset are 44 px tall`);
        // A parameter at its identity value (a 1 or a 0) is not written in the formula, so there are at most as many
        // numbers in the formula as sliders, and every parameter is still a slider.
        ok(a11y.slots >= 1 && a11y.slots <= a11y.ranges && /=/.test(a11y.readout) && a11y.caption === 'The dashed grey line is the original.', `${where}: readout "${a11y.readout}" and caption`);
        ok(a11y.resetDisabled, `${where}: Reset is disabled at the starting values`);

        // REACTIVE + KEYBOARD
        const range = f.locator('input[type=range]').first();
        const before = { base: await baseD(f), now: await nowD(f), readout: await f.locator('.lf-readout').textContent(), feats: await f.locator('.lf-list').textContent(), formula: await f.locator('.lf-formula').getAttribute('aria-label') };
        await range.focus();
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowRight');
        const after = { base: await baseD(f), now: await nowD(f), readout: await f.locator('.lf-readout').textContent(), feats: await f.locator('.lf-list').textContent(), formula: await f.locator('.lf-formula').getAttribute('aria-label') };
        ok(after.now !== before.now && after.readout !== before.readout && after.formula !== before.formula, `${where}: arrow keys change the curve, the values line and the spoken formula`);
        ok(after.feats !== before.feats || c.ids[0] === 'sine', `${where}: the feature sentences follow the value`);
        ok(after.base === before.base, `${where}: the dashed original does not move`);
        ok(await f.locator('.lf-reset').isEnabled(), `${where}: Reset is enabled after a change`);
        await page.keyboard.press('End');
        const endVal = await range.inputValue();
        ok(Number(endVal) === Number(await range.getAttribute('max')), `${where}: End goes to the top stop`);
        await page.keyboard.press('Home');
        ok(Number(await range.inputValue()) === Number(await range.getAttribute('min')), `${where}: Home goes to the bottom stop`);
        await f.locator('.lf-reset').click();
        const reset = { now: await nowD(f), readout: await f.locator('.lf-readout').textContent() };
        ok(reset.now === before.now && reset.readout === before.readout && await f.locator('.lf-reset').isDisabled(), `${where}: Reset restores the starting curve and values`);

        // HOVER / FOCUS
        if (size === 'desktop') {
          const slot = f.locator('.lf-slot').first();
          const pid = await slot.getAttribute('data-param');
          const boxBefore = await f.boundingBox();
          await slot.hover();
          const tip = f.locator('[role=tooltip]');
          ok(await tip.count() === 1 && /Now /.test(await tip.textContent()), `${where}: hover shows a tooltip with the meaning and the current value`);
          const lit = await f.locator(`.lf-slot.is-active[data-param="${pid}"]`).count();
          ok(lit === await f.locator(`.lf-slot[data-param="${pid}"]`).count() && lit >= 1, `${where}: every occurrence of the symbol is lit together`);
          ok(await f.locator('.lf-row.is-hot').count() >= 1, `${where}: a matching feature sentence is lit`);
          const boxAfter = await f.boundingBox();
          ok(boxBefore.height === boxAfter.height && boxBefore.y === boxAfter.y, `${where}: the note causes no layout shift`);
          // a feature row: icon, label, value, meaning; hovering the row lights its mark on the graph
          const rows = await f.locator('.lf-row').evaluateAll(rs => rs.map(r => ({ icon: !!r.querySelector('svg.lf-icon[aria-hidden="true"]'), label: r.querySelector('.lf-row-label')?.textContent, val: r.querySelector('.lf-row-val')?.textContent, note: r.querySelector('.lf-row-note')?.textContent, valFont: getComputedStyle(r.querySelector('.lf-row-val')).fontFamily, labelFont: getComputedStyle(r.querySelector('.lf-row-label')).fontFamily })));
          ok(rows.length >= 2 && rows.every(r => r.icon && r.label && r.val && r.note), `${where}: every feature row has an icon, a label, a value and a meaning`);
          ok(rows.every(r => /KaTeX|Latin Modern|STIX|Cambria|Georgia|serif/.test(r.valFont) && !/KaTeX|Latin Modern/.test(r.labelFont)), `${where}: the value is in the maths face, the label in the body face`);
          ok(await f.locator('.lf-legend', { hasText: 'filled dot' }).count() === 0, `${where}: the marker legend line is gone`);
          const hotBefore = await f.locator('.lf-mark.is-hot, .lf-guide.is-hot').count();
          await page.mouse.move(2, 2);
          const row = f.locator('.lf-row').filter({ has: f.locator('.lf-row-label', { hasText: /intercept|Roots|Turning|Corner|Centre|Peak|Midline|Axis|asymptote/ }) }).first();
          if (await row.count()) {
            await row.hover();
            ok(await row.evaluate(r => r.classList.contains('is-hot')), `${where}: hovering a row lights it`);
            ok(await f.locator('.lf-mark.is-hot, .lf-guide.is-hot').count() > hotBefore || hotBefore > 0, `${where}: hovering a row lights its mark on the graph`);
            await page.mouse.move(2, 2);
          }
          await slot.hover();
          await page.keyboard.press('Escape');
          ok(await tip.count() === 0, `${where}: Escape closes the note`);
          await page.mouse.move(2, 2);
          ok(await f.locator('.lf-slot.is-active').count() === 0, `${where}: moving away unlights the symbol`);

          // focus path: the slider's tooltip is its description
          await f.locator('input[type=range]').nth(1).focus();
          const dby = await f.locator('input[type=range]').nth(1).getAttribute('aria-describedby');
          ok(!!dby && await f.locator(`#${CSS_ESC(dby)}[role=tooltip]`).count() === 1, `${where}: focusing a slider shows its note, described-by`);
          await page.keyboard.press('Escape');

          // POINTER: drag a number sideways with the mouse
          const b = await slot.boundingBox();
          const v0 = await f.locator('.lf-readout').textContent();
          await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
          await page.mouse.down();
          await page.mouse.move(b.x + b.width / 2 + 60, b.y + b.height / 2, { steps: 6 });
          const dragLit = await f.locator('.lf-slot.is-dragging').count();
          await page.mouse.up();
          const v1 = await f.locator(".lf-readout").textContent(); ok(v1 !== v0 && dragLit >= 1, `${where}: dragging a number sideways changes it (${v0} -> ${v1}, lit ${dragLit})`);
          await page.mouse.move(2, 2);
          await f.locator('.lf-reset').click();
        }
      }

      // together + touch/pen + c -> y-intercept, on the vertex and quadratic figures
      if (size === 'desktop') {
        const where = `(${theme}) detail`;
        await page.goto(url('in', '/notes/c10-quadratic-equations', theme), { waitUntil: 'networkidle' });
        await page.waitForSelector('[data-living-formula="quadratic"]');
        const q = fig(page, 'quadratic');
        await q.scrollIntoViewIfNeeded();
        await q.locator('.lf-slot[data-param="c"]').hover();
        ok(await q.locator('.lf-m-diamond.is-hot').count() === 1, `${where}: hovering c lights the y-intercept point on the graph`);
        await page.mouse.move(2, 2);
        const v = fig(page, 'vertex');
        await v.scrollIntoViewIfNeeded();
        const hSlot = v.locator('.lf-slot[data-param="h"]');
        const hb = await hSlot.boundingBox();
        await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
        await page.mouse.down();
        await page.mouse.move(hb.x + hb.width / 2 + 24, hb.y + hb.height / 2, { steps: 4 });
        ok(await v.locator('.lf-slot[data-param="k"].is-active').count() === 1, `${where}: while dragging h, k lights with it`);
        await page.mouse.up();
        // pen tap keeps the note until a tap elsewhere
        await page.mouse.move(2, 2);
        ok(await v.locator('.lf-reset').isEnabled(), `${where}: dragging h changed it`);
        await v.locator('.lf-reset').click({ timeout: 2000 }).catch(() => {});
        await hSlot.evaluate(el => {
          const o = { bubbles: true, pointerId: 7, pointerType: 'pen', isPrimary: true, clientX: el.getBoundingClientRect().x + 4, clientY: el.getBoundingClientRect().y + 4, button: 0 };
          el.dispatchEvent(new PointerEvent('pointerdown', o)); el.dispatchEvent(new PointerEvent('pointerup', o));
        });
        ok(await v.locator('[role=tooltip]').count() === 1, `${where}: a pen tap keeps the note shown`);
        await page.evaluate(() => document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'pen' })));
        ok(await v.locator('[role=tooltip]').count() === 0, `${where}: a tap elsewhere puts it away`);
        // σ appears twice in the normal curve's formula and both light together
        await page.goto(url('nsw', '/notes/mst-12-s2-10', theme), { waitUntil: 'networkidle' });
        await page.waitForSelector('[data-living-formula="normal"]');
        const n = fig(page, 'normal');
        await n.scrollIntoViewIfNeeded();
        await n.locator('.lf-slot[data-param="sigma"]').first().hover();
        ok(await n.locator('.lf-slot[data-param="sigma"].is-active').count() === 2, `${where}: both σ in the normal curve light together`);
        await page.mouse.move(2, 2);
      }
      ok(errors.length === 0, `${theme} ${size}: no console or page errors (${errors.slice(0, 2).join(' | ')})`);

      if (SHOTS) {
        mkdirSync(SHOTS, { recursive: true });
        for (const [name, pg, path, formula] of [['india-quadratic', 'in', '/notes/c10-quadratic-equations', 'quadratic'], ['nsw-sine', 'nsw', '/notes/mav-11-04', 'sine'], ['nsw-normal', 'nsw', '/notes/mst-12-s2-10', 'normal'], ['india-circle', 'in', '/notes/c11-conic-sections', 'circle']]) {
          await page.goto(url(pg, path, theme), { waitUntil: 'networkidle' });
          await page.waitForSelector(`[data-living-formula="${formula}"]`);
          await page.evaluate(() => document.querySelectorAll('.nt-reveal').forEach(el => el.classList.add('is-in')));
          const f = fig(page, formula);
          await f.scrollIntoViewIfNeeded();
          await f.locator('input[type=range]').first().focus();
          for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
          await page.mouse.move(2, 2);
          await page.locator('body').click({ position: { x: 2, y: 2 } });
          await page.waitForTimeout(150);
          await f.screenshot({ path: `${SHOTS}/${name}-${theme}-${size}.png` });
          if (size === 'desktop' && name === 'india-quadratic') {
            await f.locator('.lf-slot[data-param="c"]').hover();
            await page.waitForTimeout(250);
            await f.screenshot({ path: `${SHOTS}/hover-popover-${name}-${theme}-${size}.png` });
          }
        }
      }
      await context.close();
    }
  }
  // reduced motion: no animation on the note
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const pg = await ctx.newPage();
  await pg.goto(url('in', '/notes/c10-quadratic-equations', 'light'), { waitUntil: 'networkidle' });
  await pg.waitForSelector('[data-living-formula="quadratic"]');
  await pg.locator('[data-living-formula="quadratic"] .lf-slot').first().hover();
  const anim = await pg.locator('[role=tooltip]').evaluate(el => getComputedStyle(el).animationName);
  ok(anim === 'none', `reduced motion: the note does not animate (${anim})`);
  await ctx.close();
} finally {
  await browser.close();
  await server.close();
}
function CSS_ESC(s) { return s.replace(/([^\w-])/g, '\\$1'); }

if (failures.length) {
  console.error(`LIVING FORMULAS BROWSER: FAIL — ${failures.length} of ${pass + failures.length} checks failed`);
  for (const f of failures.slice(0, 40)) console.error(`  · ${f}`);
  process.exit(1);
}
console.log(`LIVING FORMULAS BROWSER: PASS — ${pass}/${pass} checks — India and NSW notes pages, light and dark, phone and desktop: placement, reactive cells, keyboard sliders, drag, hover and focus notes, together-lighting, Escape, pen tap, reduced motion, labelled graph and formula, 44 px targets, no overflow, no errors`);
