#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a request cancelled by leaving the page is not "no connection".
//
// Regression for the WebKit browser-shard flake "Responsive matrix · 6
// viewports": Pri Explain missing at every viewport and ink left on the sheet.
// The tour leaves /practice while its question is still being fetched. WebKit
// rejects the cancelled request (a bare TypeError, like a dropped connection)
// BEFORE it tears the page down, so serveQuestion (client/src/local/backend.js)
// fell back to an offline draft and stored it; Practice then resumed that
// draft — "opened without a connection", never markable — although the
// student was online throughout. Chromium tears the page down first, which is
// why only WebKit failed.
//
// No app server: a blank page loads client/src/local/pageLeaving.js itself
// and does what serveQuestion does — fetch, and on failure store a draft —
// then navigates away mid-fetch. In each engine it proves:
//   1  without the guard, WebKit stores the draft (this check sees the defect);
//   2  with settleIfLeaving(), no draft is stored when the page really leaves;
//   3  a real failure with no navigation still stores its draft at once;
//   4  a navigation that never happens (beforeunload, then the page stays)
//      still ends in the draft, after the hold — nothing is lost.
//
// Run:  node client/test/page-leaving-draft-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { chromium, webkit } from '@playwright/test';

const MODULE = readFileSync(new URL('../src/local/pageLeaving.js', import.meta.url), 'utf8');

/** The page: one fetch that will not answer in time, and serveQuestion's fallback. */
const PAGE = guarded => `<!doctype html><meta charset="utf-8"><script type="module">
  import { settleIfLeaving } from '/pageLeaving.js';
  localStorage.removeItem('draft');
  window.__draftAt = null;
  const started = performance.now();
  fetch(new URLSearchParams(location.search).get('url') || '/slow').then(() => {}, async () => {
    ${guarded ? 'await settleIfLeaving();' : ''}
    localStorage.setItem('draft', String(Math.round(performance.now() - started)));
  });
</script>`;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/slow') { setTimeout(() => res.end('late'), 8000); return; }
  if (url.pathname === '/fail') { req.socket.destroy(); return; }
  if (url.pathname === '/pageLeaving.js') { res.setHeader('content-type', 'text/javascript'); res.end(MODULE); return; }
  if (url.pathname === '/away') { res.setHeader('content-type', 'text/html'); res.end('<!doctype html><p>another page</p>'); return; }
  res.setHeader('content-type', 'text/html');
  res.end(PAGE(url.pathname === '/guarded'));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

let failed = 0, passed = 0;
async function check(name, run) {
  try { await run(); passed++; console.log(`  ✔ ${name}`); }
  catch (err) { failed++; console.log(`  ✖ ${name}\n      ${String(err?.message || err).split('\n')[0]}`); }
}
const assert = (ok, why) => { if (!ok) throw new Error(why); };

/** Load `path`, let its fetch start, navigate away mid-fetch, then read what was stored. */
async function leaveMidFetch(page, path) {
  await page.goto(base + path);
  await page.waitForTimeout(300);
  await page.goto(base + '/away');
  await page.waitForTimeout(2500); // longer than the hold: a resumed page would have written by now
  return page.evaluate(() => localStorage.getItem('draft'));
}

try {
  for (const engine of [webkit, chromium]) {
    const browser = await engine.launch();
    try {
      const page = await browser.newPage();
      console.log(`Leaving the page mid-request is not "no connection" (${engine.name()})`);

      if (engine === webkit) {
        await check('without the guard, a request cancelled by leaving the page stores a draft (the defect this check guards)', async () => {
          const draft = await leaveMidFetch(page, '/unguarded');
          assert(draft !== null, 'WebKit did not run the fallback before tearing the page down: the defect is not reproducible here, so this check proves nothing');
        });
      }

      await check('with the guard, leaving the page mid-request stores no draft', async () => {
        const draft = await leaveMidFetch(page, '/guarded');
        assert(draft === null, `a draft was stored ${draft} ms after the page started leaving`);
      });

      await check('a real failure, with no navigation, still stores its draft at once', async () => {
        await page.goto(`${base}/guarded?url=/fail`);
        await page.waitForFunction(() => localStorage.getItem('draft') !== null, null, { timeout: 5000 });
        const after = Number(await page.evaluate(() => localStorage.getItem('draft')));
        assert(after < 1000, `the draft waited ${after} ms although nothing was leaving`);
      });

      await check('a navigation that never happens still ends in the draft, after the hold — nothing is lost', async () => {
        // The request is held until the page has said it is leaving and then
        // stayed (a cancelled navigation); only then does it fail, as a
        // dropped connection would.
        let release;
        const held = new Promise(resolve => { release = resolve; });
        await page.route('**/slow', async route => { await held; await route.abort('failed'); });
        await page.goto(`${base}/guarded`);
        await page.evaluate(() => dispatchEvent(new Event('beforeunload')));
        const signalled = Date.now();
        release();
        await page.waitForFunction(() => localStorage.getItem('draft') !== null, null, { timeout: 5000 });
        const waited = Date.now() - signalled;
        assert(waited >= 1000, `the draft was stored ${waited} ms after the leaving signal, without the hold`);
        await page.unroute('**/slow');
      });
    } finally {
      await browser.close();
    }
  }
} finally {
  server.close();
}

console.log(`\n${failed ? '✖ PAGE-LEAVING DRAFT CHECK FAILED' : '✔ PAGE-LEAVING DRAFT CHECK PASSED'} — ${passed}/${passed + failed} checks`);
process.exit(failed ? 1 : 0);
