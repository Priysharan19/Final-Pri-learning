// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a stand-in server handwriting reader for browser flows.
//
// Handwriting and photos are read only by the server reader (owner decision,
// ADR-0001 amendment). A browser flow that writes by hand therefore needs a
// reader to talk to. This one answers /v1/handwriting/* on the page's own
// origin, records every request so a flow can prove it was answer-blind, and
// reads back whatever text the flow scripts — the flow, not the app, knows what
// was written, exactly as a real reader would only know the picture.
// ─────────────────────────────────────────────────────────────────────────────

import { TEMPLATES } from '../src/ink/templates.js';

// Glyph geometry, matched to the shape the recogniser suites score against:
// a little taller than wide, with a clear gap between neighbours so the
// segmenter has something to cut on.
const GLYPH_W = 58;
const GLYPH_H = 84;
const ADVANCE = 66;

/** Write one line of glyphs onto the canvas with the mouse, stroke by stroke. */
export async function handwrite(page, box, text, { x = 40, y = 34 } = {}) {
  let ox = box.x + x;
  for (const ch of text) {
    const variant = TEMPLATES[ch]?.[0];
    if (!variant) throw new Error(`no template for ${JSON.stringify(ch)}`);
    for (const stroke of variant) {
      const pts = stroke.map(([px, py]) => [
        ox + (px / 100) * GLYPH_W,
        box.y + y + (py / 100) * GLYPH_H
      ]);
      await page.mouse.move(pts[0][0], pts[0][1]);
      await page.mouse.down();
      for (const [px, py] of pts) await page.mouse.move(px, py);
      await page.mouse.up();
    }
    ox += ADVANCE;
  }
  await page.waitForTimeout(600);   // the reader is asked 240 ms after the last point
}

/**
 * D17: the first read of a profile meets the one-time prompt naming OpenAI.
 * A flow that is not about that prompt accepts it the moment it appears — the
 * same press a student makes — so every reading flow still passes through the
 * real prompt and proves its accept lets the read go ahead. The count of
 * prompts accepted this way is on window.__priReaderPermissionAccepted.
 * client/test/tour-ink-reader-permission.js is the flow about the prompt
 * itself and opts out (flow.readerPermission = 'ask').
 */
export function acceptReaderPermissionOnSight() {
  const accept = () => {
    const button = document.querySelector('[data-reader-permission="accept"]');
    if (!button || button.dataset.priAccepted) return;
    button.dataset.priAccepted = '1';
    globalThis.__priReaderPermissionAccepted = (globalThis.__priReaderPermissionAccepted || 0) + 1;
    setTimeout(() => button.click(), 0);
  };
  new MutationObserver(accept).observe(document, { childList: true, subtree: true });
}

/** Install the stand-in reader on a fresh context's page. */
export async function useFakeServerReader(page, base, ctx = page.context()) {
  // `confidence` scripts how sure the stand-in is of every line (default 0.97,
  // above the floor); a flow sets it low to exercise the doubtful-line path.
  const reader = { text: '', requests: [], down: false, confidence: null };
  await page.addInitScript(() => { globalThis.__PRI_CLOUD_ORIGIN__ = globalThis.location.origin; });
  const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  // Every other /v1 call is a plain "not here" (no account, no sync), so the
  // page behaves as a signed-out device whose only server is the reader.
  // Playwright gives the most recently registered route priority. Routes are
  // on the context so requests passing through the service worker are seen.
  await ctx.route(`${base}/v1/**`, route => json(route, 404, { error: { code: 'NOT_FOUND', message: 'not in this harness' } }));
  await ctx.route(`${base}/v1/handwriting/status`, route => json(route, 200, {
    available: true, configured: true, usable: true, degraded: false, state: 'ready',
    model: 'e2e-stand-in', fallbackModel: null, confidenceFloor: 0.8, timeoutMs: 20000,
    lastLatencyMs: 1, lastFailureCode: null, releaseSha: null
  }));
  await ctx.route(`${base}/v1/handwriting/transcribe`, async route => {
    let body = null;
    try { body = JSON.parse(route.request().postData() || 'null'); } catch { body = null; }
    reader.requests.push(body);
    if (reader.down) return json(route, 503, { error: { code: 'HANDWRITING_UNAVAILABLE', message: 'down' } });
    const confidence = Number.isFinite(reader.confidence) ? reader.confidence : 0.97;
    const lines = String(reader.text).split('\n').filter(Boolean).map(text => ({ text, confidence }));
    return json(route, 200, {
      transcription: {
        lines, text: lines.map(l => l.text).join('\n'), confidence,
        needsConfirmation: confidence < 0.8, engine: 'cloud-e2e-stand-in'
      }
    });
  });
  return reader;
}

/** Turn server reading on for the signed-in profile, through Settings. */
export async function turnOnServerReading(page, base) {
  await page.goto(`${base}/settings`, { waitUntil: 'domcontentloaded' });
  const tab = page.getByRole('button', { name: 'Handwriting' }).or(page.getByRole('tab', { name: 'Handwriting' })).first();
  await tab.waitFor({ timeout: 30000 });
  await tab.click();
  const row = page.locator('.set-row', { hasText: 'Read my handwriting and photos on the server' });
  try { await row.waitFor({ timeout: 30000 }); }
  catch (e) {
    const probe = await page.evaluate(async () => ({ origin: globalThis.__PRI_CLOUD_ORIGIN__, loc: location.origin,
      res: await fetch(location.origin + '/v1/handwriting/status').then(r => r.status + ' ' + r.headers.get('content-type')).catch(x => String(x)) }));
    throw new Error('server reading row never appeared: ' + JSON.stringify(probe));
  }
  const toggle = row.locator('button');
  for (let i = 0; i < 40 && (await toggle.isDisabled()); i++) await page.waitForTimeout(250);
  if ((await toggle.getAttribute('aria-pressed')) !== 'true') {
    await toggle.click();
    for (let i = 0; i < 40 && (await toggle.getAttribute('aria-pressed')) !== 'true'; i++) await page.waitForTimeout(250);
  }
  return (await toggle.getAttribute('aria-pressed')) === 'true';
}

/**
 * Owner decision, 19 Nov 2026 (ADR-0001 amendment): the typed reading is NOT shown before marking, so there is no reading
 * panel to read lines from. What Pri read is available on demand from the marked page.
 *
 * Open "See how Pri read your page" and return the reading of each line, in page order (empty strings for lines that
 * are not shown). Needs a marked page.
 */
export async function readLines(page) {
  // The readings of the page are under "About this reading", a closed disclosure to begin with.
  const about = page.locator('[data-mp-about]');
  if (await about.count() && !(await about.evaluate(d => d.open))) await about.locator('summary').click();
  const link = page.locator('[data-mp-see-page]');
  if (await link.count() && (await link.getAttribute('aria-expanded')) !== 'true') await link.click();
  return page.locator('[data-mp-reading]').evaluateAll(nodes => nodes.map(n => n.getAttribute('data-text') || ''));
}

/** The one press: "Mark my working". True when the button was there and was pressed. */
export async function markWorking(page, { timeout = 8000 } = {}) {
  const button = page.getByRole('button', { name: /^Mark my working/ }).first();
  const there = await button.waitFor({ state: 'visible', timeout }).then(() => true, () => false);
  if (!there || await button.isDisabled()) return false;
  await button.click();
  return true;
}

/**
 * No typed reading is on screen before marking: no reading list, no per-line chips, no confirmation panel, no
 * "Read my answer", and none of the given reading texts anywhere in what the student can see.
 */
export async function readingIsNotShown(page, texts = []) {
  return page.evaluate(wanted => {
    const visible = el => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0; };
    const structure = ['.ink-preview', '.ink-line', '.in-read-layer', '[data-read-chip]', '[data-confirm-reading]', '.ws-confirm', '[data-ink-read]', '.reading-review', '.rr-lines', '[data-mp-reading]']
      .filter(sel => [...document.querySelectorAll(sel)].some(visible));
    // Every visible text node outside the typed answer field and the question; the hidden ink data attributes do not count.
    const text = document.body.innerText || '';
    const leaked = wanted.filter(w => w && text.includes(w));
    return { structure, leaked };
  }, texts);
}

/**
 * Press "Read my answer" (or "Read again"). Practice no longer has this button (19 Nov 2026: one press of Mark my
 * working reads and marks); a surface that still shows its reading (the exam room) does. Returns false when the button
 * is not offered.
 */
export async function pressRead(page, { timeout = 8000 } = {}) {
  const button = page.locator('[data-ink-read]').first();
  const there = await button.waitFor({ state: 'visible', timeout }).then(() => true, () => false);
  if (!there) return false;
  await button.click();
  return true;
}
