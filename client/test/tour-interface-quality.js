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
//     synthetic, so it is a regression floor, not a device measurement).
//     On Practice this is a real answer-mode switch on a real server-issued
//     written question, timed in every one of the four cases (below);
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
import { execFileSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
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
const MASK = ['.q-prompt', '.q-card .katex', '.home-greet', 'time', '[data-volatile]'];
const MAX_INPUT_MS = 100;

// ── Practice: a genuine answer-mode switch, timed (Step 06, issue #684) ───────
// A Practice screen that happened to draw a multiple-choice question had no
// Type / Write / Photo switch, so its input check was skipped and the run
// passed with 196 checks; and where the switch was there, the first tab was
// pressed, which is the mode already on (a press that changes nothing). Now
// the isolated test server (NODE_ENV=test, booted below with
// allowSeededPractice) issues the question tour-verified-mark-breakdown.js
// pins: a two-mark written elimination question. Only the issue seed is
// pinned; the server still issues the question and the client never sees the
// answer. In every case (phone 390×844 and tablet 820×1180, light and dark)
// a draft is typed, then Write and Type are pressed, each the mode that is
// NOT on. Each press is timed in the page from the browser's own event
// timestamp, so no Playwright round trip is inside the interval:
//   · to the first frame that shows the pressed tab, and
//   · to the first frame where the new mode can be used (an editable answer
//     field; a writing canvas that has been sized and primed);
// alongside Chromium's Event Timing entries for the press (only entries of at
// least 16 ms exist; the in-page interval is measured for every press).
// Both intervals and every entry must be inside MAX_INPUT_MS. A case with no
// question, no switch, no usable mode or no measurement fails; nothing is
// skipped. All four cases passing prints the PRACTICE INPUT TIMING sentinel
// that ci.yml requires.
const PRACTICE_SEED = { generator: 'c10-linear-pair-methods', difficulty: 2, curriculum: 'in', seed: 7 };
const POST_ISSUE = /\/v1\/practice\/issue(?:\?.*)?$/;
const PRACTICE_DRAFT = '12';
// How long a press may take to reach a usable mode before the case fails as
// unusable (a fail-closed bound, not the latency floor: that is MAX_INPUT_MS).
const USABLE_LIMIT_MS = 5000;
const PRACTICE_CASES = 4; // SIZES × SCHEMES

// In the page: arm the measurement of one press on the `to` mode tab.
const ARM_SWITCH = ({ to, limitMs, selected = false }) => {
  const card = document.querySelector('.qpage[data-question-id]');
  const tabs = card ? [...card.querySelectorAll('.mode-tabs .mode-tab')] : [];
  const target = tabs[to === 'type' ? 0 : 1];
  const s = window.__priSwitch = {
    to, armedAt: performance.now(), eventTiming: false, pressedMs: null, usableMs: null,
    entries: [], error: null, done: false
  };
  if (!target) { s.error = 'no mode tab to press'; s.done = true; return; }
  // #684's 256 ms was a press on the tab already on: that press is timed too (selected), a switch must change mode.
  if (!selected && target.getAttribute('aria-pressed') === 'true') { s.error = `${to} is already the mode on`; s.done = true; return; }
  if (selected && target.getAttribute('aria-pressed') !== 'true') { s.error = `${to} is not the mode on`; s.done = true; return; }
  s.eventTiming = typeof PerformanceObserver === 'function' && typeof PerformanceEventTiming === 'function'
    && (PerformanceObserver.supportedEntryTypes || []).includes('event') && 'interactionId' in PerformanceEventTiming.prototype;
  let observer = null;
  if (s.eventTiming) {
    observer = new PerformanceObserver(list => {
      for (const e of list.getEntries()) {
        if (!e.interactionId || e.startTime < s.armedAt) continue;
        s.entries.push({
          name: e.name, ms: e.duration, delay: Math.round(e.processingStart - e.startTime),
          handlers: Math.round(e.processingEnd - e.processingStart),
          onTarget: !!e.target && target.contains(e.target), on: String(e.target?.className || e.target?.tagName || 'none').slice(0, 30)
        });
      }
    });
    observer.observe({ type: 'event', durationThreshold: 16 });
  }
  const usable = () => {
    if (to === 'type') {
      const input = card.querySelector('[data-final-answer]');
      if (!input || input.disabled || input.readOnly) return false;
      const r = input.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }
    // InkCanvas sets the CSS size of its canvases when it sizes and primes them.
    const live = card.querySelector('.editor-shell .ink-wrap canvas.ink-canvas-live');
    if (!live || !live.style.width || !live.width || !live.height) return false;
    const r = live.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  window.__priSwitchStop = () => observer?.disconnect();
  const onClick = e => {
    if (!target.contains(e.target)) return;
    window.removeEventListener('click', onClick, true);
    const t0 = e.timeStamp;
    // The state is read in a frame's animation callback, before that frame
    // paints; the time is read in a task queued from it, after the paint.
    const frame = () => requestAnimationFrame(() => {
      const pressed = target.getAttribute('aria-pressed') === 'true';
      const ready = usable();
      const channel = new MessageChannel();
      channel.port1.onmessage = () => {
        const now = performance.now();
        if (pressed && s.pressedMs === null) s.pressedMs = now - t0;
        if (ready && s.usableMs === null) s.usableMs = now - t0;
        if (s.pressedMs !== null && s.usableMs !== null) { s.done = true; return; }
        if (now - t0 > limitMs) { s.error = `${to} was not usable ${Math.round(now - t0)} ms after the press`; s.done = true; return; }
        frame();
      };
      channel.port2.postMessage(0);
    });
    frame();
  };
  window.addEventListener('click', onClick, true);
};

const round1 = n => (n === null || n === undefined ? null : Math.round(n * 10) / 10);
const quantile = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)];
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
    // Inline text links (WCAG 2.5.8 inline exception): a link sitting in a run
    // of text, not a list row or nav item that happens to be a link.
    if (el.tagName === 'A' && el.parentElement && [...el.parentElement.childNodes].some(n => n !== el && n.nodeType === 3 && n.textContent.trim())) return false;
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
    const outDir = join(process.env.PRI_VISUAL_OUT || mkdtempSync(join(tmpdir(), 'pri-visual-')), `${process.platform}-${browserName}`);
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

    // Practice (Chromium, where input is timed): every question issued while
    // the page is on Practice is the pinned seed, forwarded to the real server.
    // Issues anywhere else go through unchanged.
    const issued = { n: 0, last: null };
    if (chromium) {
      await page.route(POST_ISSUE, async route => {
        let from = '';
        try { from = new URL(route.request().frame().url()).pathname; } catch { from = new URL(page.url()).pathname; }
        if (!from.startsWith('/practice')) return route.continue();
        issued.n++;
        const original = route.request().postDataJSON() || {};
        const response = await route.fetch({ postData: JSON.stringify({ ...original, ...PRACTICE_SEED }) });
        issued.last = { status: response.status(), body: (await response.text()).slice(0, 300) };
        await route.fulfill({ response });
      });
    }
    const pinned = k => k?.kind === 'text' && k.text === '-6' && !!k.prompt?.includes('Solve by elimination');
    const frames = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const pressAndTime = async (to, selected = false) => {
      await page.evaluate(ARM_SWITCH, { to, limitMs: USABLE_LIMIT_MS, selected });
      if (!(await page.evaluate(() => window.__priSwitch?.done === true))) {
        await page.locator('.qpage[data-question-id] .mode-tabs .mode-tab').nth(to === 'type' ? 0 : 1).click({ timeout: 3000 });
        await page.waitForFunction(() => window.__priSwitch?.done === true, null, { timeout: USABLE_LIMIT_MS + 3000 }).catch(() => {});
        // Event Timing entries are delivered once the frame has been presented.
        await page.waitForTimeout(300);
      }
      return page.evaluate(() => {
        window.__priSwitchStop?.();
        const s = window.__priSwitch;
        return s ? { ...s, error: s.error || (s.done ? null : 'the press was never seen by the page') } : { error: 'the measurement never armed' };
      });
    };
    const timePractice = async () => {
      const tabs = page.locator('.qpage[data-question-id] .mode-tabs .mode-tab');
      const answer = page.locator('.qpage[data-question-id] [data-final-answer]');
      const out = { tabs: await tabs.count(), switches: [], draft: null, slow: [], error: null };
      if (out.tabs !== 3) { out.error = `${out.tabs} answer-mode tabs on the card`; return out; }
      // Start from Type, untimed: a phone with no saved mode opens on Write.
      if (await tabs.nth(0).getAttribute('aria-pressed') !== 'true') {
        await tabs.nth(0).click({ timeout: 3000 });
        await answer.waitFor({ state: 'visible', timeout: USABLE_LIMIT_MS });
      }
      await answer.fill(PRACTICE_DRAFT);
      await settle();
      await frames();
      await page.evaluate(() => { window.__priSlowInput = []; });
      // The selected tab (Type) first, as #684 caught it; then Write and Type, each a real switch.
      for (const [to, selected] of [['type', true], ['write', false], ['type', false]]) {
        const s = { ...(await pressAndTime(to, selected)), selected };
        out.switches.push(s);
        if (s.error) break;
        await settle();
        await frames();
      }
      out.slow = await page.evaluate(() => window.__priSlowInput || []);
      out.draft = await answer.inputValue({ timeout: 2000 }).catch(() => null);
      return out;
    };
    const practiceCases = [];

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
          const practice = route === '/practice';
          let pinnedOk = false;
          await goto(route);
          await settle();
          if (practice) {
            // A question is on the card before anything is audited or timed.
            await page.locator('.qpage[data-question-id] .q-prompt').waitFor({ timeout: 30000 });
            if (chromium) {
              // A question this account already held (issued before it ever
              // opened Practice) is passed over for a new one, never answered.
              let known = await online.answerOf();
              for (let n = 0; n < 4 && !pinned(known); n++) {
                const before = await page.locator('.qpage[data-question-id]').getAttribute('data-question-id');
                await page.locator('.ctx-next').click();
                await page.waitForFunction(id => {
                  const next = document.querySelector('.qpage[data-question-id]');
                  return next && next.getAttribute('data-question-id') !== id && !!next.querySelector('.q-prompt');
                }, before, { timeout: 30000 });
                known = await online.answerOf();
              }
              const tabs = await page.locator('.qpage[data-question-id] .mode-tabs .mode-tab').count();
              pinnedOk = await check(`${tag}: the real server issued the pinned written question, with Type, Write and Photo`,
                issued.n > 0 && pinned(known) && tabs === 3, JSON.stringify({ issued, known, tabs }).slice(0, 900));
              await settle();
            }
          }
          // Nothing moves once the screen has painted and settled.
          if (chromium) {
            await page.evaluate(() => { window.__priShift = 0; });
            await page.waitForTimeout(500);
            const shift = await page.evaluate(() => window.__priShift || 0);
            await check(`${tag}: no layout shift after paint`, shift < 0.001, `CLS ${shift.toFixed(4)}`);
          }

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
                // A ring is an outline, or a shadow/border that focus changed: a
                // control that always has a shadow does not pass by having it.
                const s = getComputedStyle(el);
                const focused = { shadow: s.boxShadow, border: s.borderColor, outline: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0 };
                el.blur();
                const u = getComputedStyle(el);
                const rest = { shadow: u.boxShadow, border: u.borderColor };
                el.focus({ preventScroll: true });
                const ring = focused.outline || focused.shadow !== rest.shadow || focused.border !== rest.border;
                const name = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || (el.labels?.[0]?.textContent) || '').trim();
                return { ring, name: name.slice(0, 30), tag: el.tagName };
              }));
            }
            const reached = stops.filter(Boolean);
            await check(`${tag}: Tab reaches the controls`, reached.length > 0);
            const bad = reached.filter(s => !s.ring || !s.name);
            await check(`${tag}: every keyboard stop is named and has a visible focus ring`, bad.length === 0, JSON.stringify(bad.slice(0, 5)));
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

          // Practice: a genuine Type → Write → Type switch, timed (pressed last,
          // after the snapshot). Never skipped: a missing switch fails.
          if (chromium && practice) {
            const r = await timePractice();
            const presses = r.switches;
            const both = !r.error && presses.length === 3 && presses.every(s => !s.error);
            const inside = s => s.eventTiming === true && s.pressedMs !== null && s.usableMs !== null
              && s.pressedMs <= MAX_INPUT_MS && s.usableMs <= MAX_INPUT_MS && s.entries.every(e => e.ms <= MAX_INPUT_MS);
            const raw = {
              error: r.error, tabs: r.tabs, draft: r.draft, slow: r.slow.slice(0, 4),
              presses: presses.map(s => ({
                to: s.selected ? `${s.to} (already on)` : s.to, error: s.error, eventTiming: s.eventTiming, frameMs: round1(s.pressedMs), usableMs: round1(s.usableMs),
                entries: (s.entries || []).map(e => `${e.name} ${Math.round(e.ms)}ms (delay ${e.delay}, handlers ${e.handlers}) on ${e.onTarget ? 'the tab' : e.on}`)
              }))
            };
            note(`practice timing ${tag}: ${JSON.stringify(raw)}`);
            const usable = await check(`${tag}: Type → Write → Type: each press opens a usable mode and the typed draft is kept`,
              both && r.draft === PRACTICE_DRAFT, JSON.stringify(raw));
            const fast = await check(`${tag}: input answers inside ${MAX_INPUT_MS} ms`,
              both && presses.every(inside) && r.slow.length === 0, JSON.stringify(raw));
            practiceCases.push({ tag, pass: pinnedOk && usable && fast, presses });
            continue;
          }

          // Input answers fast (pressed last, after the snapshot): press the first safe control
          // (tabs/segmented choices, never a submit or a destructive action).
          if (chromium) {
            // Only the press below is timed, not the Tab walk above it.
            await page.evaluate(() => { window.__priSlowInput = []; });
            const safe = page.locator('[role=tab], .mode-tab, .pill-opt').first();
            if (!(await safe.count())) { note(`${tag}: no tab or choice control to time`); continue; }
            await safe.click({ timeout: 3000 });
            await page.waitForTimeout(400);
            const slow = await page.evaluate(() => window.__priSlowInput || []);
            await check(`${tag}: input answers inside ${MAX_INPUT_MS} ms`, slow.length === 0, JSON.stringify(slow.slice(0, 4)));
          }
        }
      }
    }
    await touch(false);
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });

    // Practice coverage is exact: four cases, each with two timed presses.
    if (chromium) {
      const measured = await check(`Practice input timing was measured in all ${PRACTICE_CASES} cases (phone and tablet, light and dark)`,
        practiceCases.length === PRACTICE_CASES, practiceCases.map(c => c.tag).join(', ') || 'none');
      const presses = practiceCases.flatMap(c => c.presses).filter(s => !s.error);
      const stat = values => {
        const v = values.filter(n => typeof n === 'number').sort((a, b) => a - b);
        return v.length ? `max ${round1(v[v.length - 1])}, median ${round1(quantile(v, 0.5))}, p95 ${round1(quantile(v, 0.95))} ms (n=${v.length})` : 'none';
      };
      let checkout = 'unknown';
      try { checkout = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: HERE, encoding: 'utf8' }).trim(); } catch { /* not a checkout */ }
      const version = page.context().browser()?.version() || 'unknown';
      const summary = `press→frame ${stat(presses.map(s => s.pressedMs))} · press→usable ${stat(presses.map(s => s.usableMs))}`
        + ` · Event Timing ${stat(presses.flatMap(s => s.entries.map(e => e.ms)))} · Chromium ${version} · checkout ${checkout}`;
      const passed = practiceCases.filter(c => c.pass).length;
      if (measured && passed === PRACTICE_CASES && presses.length === 3 * PRACTICE_CASES) {
        note(`PRACTICE INPUT TIMING: PASS — ${PRACTICE_CASES}/${PRACTICE_CASES} cases (390×844 and 820×1180, light and dark), `
          + `${presses.length}/${3 * PRACTICE_CASES} answer-mode presses (the selected tab included) inside ${MAX_INPUT_MS} ms · ${summary}`);
      } else {
        note(`PRACTICE INPUT TIMING: FAIL — ${passed}/${PRACTICE_CASES} cases passed · ${summary}`);
      }
    }
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  // The pinned Practice seed is accepted ONLY by this isolated test server
  // (NODE_ENV=test); the product and every deployment keep refusing it.
  // It boots before runOne and serves client/dist from disk on every request,
  // so the build runOne makes is what the browser loads; a checkout with no
  // build yet is built first, because the server will not boot without one.
  const argv = process.argv.slice(2);
  const { runOne, ensureBuild } = await import('./e2e.mjs');
  // Build BEFORE the seeded platform boots: booting sets NODE_ENV=test, and a build
  // made after it would be a development bundle (React dev, no service worker).
  if (!argv.includes('--no-build')) { ensureBuild(true); argv.push('--no-build'); }
  const { onlinePlatform } = await import('./support/online-session.mjs');
  await onlinePlatform({ allowSeededPractice: true });
  process.exit(await runOne(flow, argv) ? 1 : 0);
}
