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

/** Install the stand-in reader on a fresh context's page. */
export async function useFakeServerReader(page, base, ctx = page.context()) {
  const reader = { text: '', requests: [], down: false };
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
    const lines = String(reader.text).split('\n').filter(Boolean).map(text => ({ text, confidence: 0.97 }));
    return json(route, 200, {
      transcription: {
        lines, text: lines.map(l => l.text).join('\n'), confidence: 0.97,
        needsConfirmation: false, engine: 'cloud-e2e-stand-in'
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

/** The lines the reading panel shows, as the reader returned them. */
export const readLines = (page) => page.locator('.ink-line').evaluateAll(nodes => nodes.map(n => n.getAttribute('data-text') || ''));
