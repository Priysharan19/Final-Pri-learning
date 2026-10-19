// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · E2E flow — interface quality on every student screen (Phase 3).
//
// For each screen, at phone (390×844) and tablet (820×1180), in paper and dark:
//   · keyboard: Tab reaches the controls, and every focus stop has a visible
//     focus ring and an accessible name (what VoiceOver reads);
//   · every visible control has an accessible name;
//   · phone: everything a finger presses is at least 44×44 CSS px;
//   · text at 200% (WCAG 1.4.4, the browser proxy for large Dynamic Type) does
//     not push the page sideways;
//   · no layout shift once the screen has painted (Chromium only: WebKit has
//     no layout-shift entries);
//   · input answers inside 100 ms (Chromium event timing; headless and
//     synthetic, so it is a regression floor, not a device measurement);
//   · a visual snapshot, compared with the committed baseline for this
//     platform and engine when one exists.
//
// Run:
//   node client/test/tour-interface-quality.js
//   node client/test/tour-interface-quality.js --no-build --browser=webkit
//   PRI_VISUAL_OUT=dir  where snapshots of this run are written (default: the temp dir)
//   PRI_UPDATE_SNAPSHOTS=1 node client/test/tour-interface-quality.js   (rewrite baselines)
// Synthetic browser evidence (S1). It is never evidence about a device.
// ─────────────────────────────────────────────────────────────────────────────
import { pathToFileURL, fileURLToPath } from 'node:url';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const SIZES = [
  { id: 'phone', width: 390, height: 844, phone: true },
  { id: 'tablet', width: 820, height: 1180, phone: false },
];
const SCHEMES = ['light', 'dark'];
const SCREENS = ['/', '/practice', '/progress', '/exams', '/tasks', '/notes', '/review', '/plan', '/settings'];
// Content that changes from run to run (drawn questions, dates, counts) is
// masked in snapshots; the layout around it is what the baseline holds.
const MASK = ['.q-prompt', '.q-card .katex', '.home-greet', 'time', '[data-volatile]', '.mode-tab ~ *'];
const MAX_INPUT_MS = 100;
// A pixel differs when any channel moves by more than this; a snapshot fails
// when more than this share of pixels differ (anti-aliasing noise stays under).
const CHANNEL_TOLERANCE = 24;
const MAX_DIFF_RATIO = 0.004;

// ── Minimal PNG decoder (8-bit RGB/RGBA, non-interlaced: what browsers write) ──
function decodePng(buf) {
  let pos = 8, width = 0, height = 0, colorType = 6;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); colorType = data[9]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  const bpp = colorType === 2 ? 3 : 4;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const out = Buffer.alloc(width * height * 4);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)];
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? line[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      let p = 0;
      if (f === 1) p = a; else if (f === 2) p = b; else if (f === 3) p = (a + b) >> 1;
      else if (f === 4) { const q = a + b - c; const pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); p = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      line[x] = (line[x] + p) & 255;
    }
    for (let x = 0; x < width; x++) {
      out[(y * width + x) * 4] = line[x * bpp];
      out[(y * width + x) * 4 + 1] = line[x * bpp + 1];
      out[(y * width + x) * 4 + 2] = line[x * bpp + 2];
      out[(y * width + x) * 4 + 3] = bpp === 4 ? line[x * bpp + 3] : 255;
    }
    prev = line;
  }
  return { width, height, data: out };
}

function diffRatio(a, b) {
  if (a.width !== b.width || a.height !== b.height) return 1;
  let diff = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    if (Math.abs(a.data[i] - b.data[i]) > CHANNEL_TOLERANCE || Math.abs(a.data[i + 1] - b.data[i + 1]) > CHANNEL_TOLERANCE
      || Math.abs(a.data[i + 2] - b.data[i + 2]) > CHANNEL_TOLERANCE) diff++;
  }
  return diff / (a.width * a.height);
}

// Accessible name, as close to the browser's computation as the page lets us.
const AUDIT = () => {
  const visible = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const nameOf = el => {
    const by = el.getAttribute('aria-labelledby');
    if (by) return by.split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ').trim();
    const label = el.getAttribute('aria-label') || (el.labels && [...el.labels].map(l => l.textContent).join(' ')) || el.getAttribute('title') || el.getAttribute('alt')
      || (el.tagName === 'INPUT' ? el.getAttribute('placeholder') : '') || el.textContent || '';
    if (label.trim()) return label.trim();
    const img = el.querySelector('img[alt], svg[aria-label]');
    return (img?.getAttribute('alt') || img?.getAttribute('aria-label') || '').trim();
  };
  const controls = [...document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=link], [role=switch], [role=checkbox], [role=radio], [role=menuitem]')]
    .filter(el => visible(el) && !el.closest('[aria-hidden="true"], [inert]'));
  const unnamed = controls.filter(el => !nameOf(el)).map(el => `${el.tagName}.${String(el.className).slice(0, 40)}`);
  // The hit area, not the drawn box: small glyph controls keep their size and
  // get a 44px area underneath on touch screens (theme-legacy.css). Probe the
  // points 21px either side of the centre; each must land on the control.
  const small = controls.filter(el => {
    if (el.tagName === 'A' && el.closest('p, li, .katex')) return false; // inline text links (WCAG 2.5.8 inline exception)
    if (el.tagName === 'INPUT' && /checkbox|radio/.test(el.type) && el.closest('label')) return false; // the label is the target
    el.scrollIntoView({ block: 'center', inline: 'center' });
    const r = el.getBoundingClientRect();
    if (r.width >= 43.5 && r.height >= 43.5) return false;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const owns = (x, y) => { const h = document.elementFromPoint(x, y); return !!h && (h === el || el.contains(h)); };
    return ![[cx - 21, cy], [cx + 21, cy], [cx, cy - 21], [cx, cy + 21]].every(([x, y]) => owns(x, y));
  }).map(el => { const r = el.getBoundingClientRect(); return `${nameOf(el).slice(0, 24) || el.tagName} ${Math.round(r.width)}×${Math.round(r.height)}`; });
  window.scrollTo(0, 0);
  return { count: controls.length, unnamed, small };
};

export const flow = {
  id: 'interface-quality',
  name: 'Interface quality · keyboard, names, 44px, text zoom, layout shift, input, snapshots',
  online: true,

  async run({ page, check, goto, settle, createProfile, note, online, browserName = 'chromium' }) {
    note(`engine: ${browserName}`);
    const chromium = browserName === 'chromium';
    const baseDir = join(HERE, 'visual-baselines', `${process.platform}-${browserName}`);
    // Outside the repo: a dirty tree blocks the release build.
    const outDir = join(process.env.PRI_VISUAL_OUT || join(tmpdir(), 'pri-visual'), `${process.platform}-${browserName}`);
    const update = process.env.PRI_UPDATE_SNAPSHOTS === '1';
    mkdirSync(outDir, { recursive: true });
    if (update) mkdirSync(baseDir, { recursive: true });
    if (!update && !existsSync(baseDir)) note(`no baselines for ${process.platform}-${browserName}: snapshots are captured to ${outDir}, not compared`);

    // The signed-out welcome is a screen too.
    // Phones are touch screens: the product sizes targets for (pointer: coarse).
    // Chromium emulates that over CDP; WebKit cannot, so it skips the 44px rule.
    const cdp = chromium ? await page.context().newCDPSession(page) : null;
    const touch = async on => { if (cdp) await cdp.send('Emulation.setTouchEmulationEnabled', on ? { enabled: true, maxTouchPoints: 5 } : { enabled: false }); };
    if (!chromium) note('44px hit areas are checked in Chromium only (WebKit cannot emulate a coarse pointer here)');

    for (const size of SIZES) {
      await page.setViewportSize({ width: size.width, height: size.height });
      await touch(size.phone);
      await goto('/');
      await settle();
      const a = await page.evaluate(AUDIT);
      await check(`welcome@${size.id}: every control has an accessible name`, a.unnamed.length === 0, JSON.stringify(a.unnamed.slice(0, 6)));
      if (size.phone && chromium) await check(`welcome@${size.id}: every control is ≥ 44×44`, a.small.length === 0, JSON.stringify(a.small.slice(0, 6)));
    }

    await createProfile({ name: 'Quality Student', year: 10, course: 'in' });
    await online.signIn({ name: 'Quality Student' });
    await settle();

    // Registered once: it runs on every later load.
    if (chromium) {
      await page.addInitScript(() => {
        window.__priShift = 0; window.__priSlowInput = [];
        try {
          new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__priShift += e.value; })
            .observe({ type: 'layout-shift', buffered: true });
          new PerformanceObserver(l => { for (const e of l.getEntries()) if (e.interactionId && e.duration > 100) window.__priSlowInput.push(`${e.name} ${Math.round(e.duration)}ms on ${e.target?.className || e.target?.tagName}`); })
            .observe({ type: 'event', buffered: true, durationThreshold: 16 });
        } catch { /* engine without the entry types */ }
      });
    }
    for (const size of SIZES) {
      await page.setViewportSize({ width: size.width, height: size.height });
      await touch(size.phone);
      for (const scheme of SCHEMES) {
        await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
        for (const route of SCREENS) {
          const tag = `${route}@${size.id}/${scheme}`;
          await goto(route);
          await settle();
          if (chromium) await page.evaluate(() => { window.__priShift = 0; });

          // Names and targets.
          const a = await page.evaluate(AUDIT);
          await check(`${tag}: the screen has controls`, a.count > 0, `${a.count}`);
          await check(`${tag}: every control has an accessible name`, a.unnamed.length === 0, JSON.stringify(a.unnamed.slice(0, 6)));
          if (size.phone && chromium) await check(`${tag}: every control is ≥ 44×44`, a.small.length === 0, JSON.stringify(a.small.slice(0, 8)));

          // Keyboard: the first stops are named and show where focus is.
          if (scheme === 'light') {
            await page.evaluate(() => { document.activeElement?.blur?.(); window.scrollTo(0, 0); });
            const stops = [];
            for (let i = 0; i < 12; i++) {
              await page.keyboard.press('Tab');
              stops.push(await page.evaluate(() => {
                const el = document.activeElement;
                if (!el || el === document.body) return null;
                const s = getComputedStyle(el);
                const ring = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== 'none');
                const name = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || (el.labels?.[0]?.textContent) || '').trim();
                return { ring, name: name.slice(0, 30), tag: el.tagName };
              }));
            }
            const reached = stops.filter(Boolean);
            await check(`${tag}: Tab reaches the controls`, reached.length > 0);
            const bad = reached.filter(s => !s.ring || !s.name);
            await check(`${tag}: every keyboard stop is named and has a visible focus ring`, bad.length === 0, JSON.stringify(bad.slice(0, 5)));
          }

          // Input answers fast and nothing jumps: press the first safe control
          // (tabs/segmented choices, never a submit or a destructive action).
          if (chromium) {
            // Only the press below is timed, not the Tab walk above it.
            await page.evaluate(() => { window.__priSlowInput = []; });
            const safe = page.locator('[role=tab], .mode-tab, .pill-opt').first();
            if (await safe.count()) await safe.click({ timeout: 3000 }).catch(() => {});
            await page.waitForTimeout(400);
            const { shift, slow } = await page.evaluate(() => ({ shift: window.__priShift || 0, slow: window.__priSlowInput || [] }));
            await check(`${tag}: no layout shift after paint`, shift < 0.001, `CLS ${shift.toFixed(4)}`);
            await check(`${tag}: input answers inside ${MAX_INPUT_MS} ms`, slow.length === 0, JSON.stringify(slow.slice(0, 4)));
            await goto(route); await settle();
          }

          // Text at 200%: no sideways scroll.
          if (scheme === 'light') {
            const overflow = await page.evaluate(async () => {
              const root = document.documentElement; const was = root.style.fontSize;
              root.style.fontSize = '200%';
              await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
              const over = root.scrollWidth - root.clientWidth;
              root.style.fontSize = was;
              return over;
            });
            await check(`${tag}: text at 200% does not scroll sideways`, overflow <= 1, `${overflow}px`);
          }

          // Snapshot.
          const file = `${route === '/' ? 'home' : route.slice(1)}-${size.id}-${scheme}.png`;
          const png = await page.screenshot({ fullPage: false, animations: 'disabled', caret: 'hide', mask: MASK.map(s => page.locator(s)) });
          writeFileSync(join(outDir, file), png);
          const baseline = join(baseDir, file);
          if (update) writeFileSync(baseline, png);
          else if (existsSync(baseline)) {
            const ratio = diffRatio(decodePng(readFileSync(baseline)), decodePng(png));
            await check(`${tag}: matches its visual baseline`, ratio <= MAX_DIFF_RATIO, `${(ratio * 100).toFixed(2)}% of pixels differ (${join(outDir, file)})`);
          }
        }
      }
    }
    await touch(false);
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
