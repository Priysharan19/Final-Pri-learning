// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · E2E flow — a slow or failing cloud never makes input sluggish (standard #43).
//
// The page is held against a throttled cloud in two phases, through the real
// platform server (support/online-session.mjs): SLOW (every /v1 call waits
// SLOW_MS before it is answered) and FAILING (every /v1 call but the session
// answers 503, and the scripted handwriting reader is down). In each phase the
// student writes with the pointer, types, and moves between screens. The page's
// own Long Tasks observer runs the whole time:
//   · no long task of 50 ms or more may start while the pointer or keyboard is
//     being driven (the browser reports a task only when it passes 50 ms);
//   · moving between screens answers from the device within NAV_MS, not after the cloud;
//   · the work is kept: the ink is on the canvas and in the sealed draft store,
//     and the typed answer is still in its field.
// The ONE synthetic part is the handwriting reader's provider hop (a scripted stand-in).
// This is not real-iPad, real-Pencil or real-network evidence: Chromium on this
// machine under an injected delay; the 50 ms budget is the Long Tasks API's.
//
// Run on its own:  node client/test/tour-responsive-cloud.js
// ─────────────────────────────────────────────────────────────────────────────
import { pathToFileURL } from 'node:url';
import { handwrite, turnOnServerReading } from './fakeServerReader.js';
import { SYNTHETIC_EVIDENCE } from './support/online-session.mjs';

const TOPIC = 'c7-integer-operations-current';
const SLOW_MS = 4000;
const LONG_TASK_BUDGET_MS = 50;
const NAV_MS = 1500;

export const flow = {
  id: 'responsive-cloud',
  name: 'Input · writing, typing and navigation stay responsive on a slow or failing cloud',
  online: true,

  async run({ page, base, check, note, goto, createProfile, settle, online }) {
    const reader = online.reader;
    Object.assign(reader, { text: '1', lines: null, confidence: 0.97, down: false, gate: null });
    note(`${SYNTHETIC_EVIDENCE}: the handwriting reader is a scripted stand-in. The delay and the 503s are injected by this flow in Chromium on this machine; nothing here is real-network or real-device evidence.`);
    await goto('/');
    await createProfile({ name: 'Responsive Student', year: 7 });
    await online.signIn({ name: 'Responsive Student' });
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await check('server reading is on for this signed-in profile', await turnOnServerReading(page, base));

    await page.goto(`${base}/practice?subtopic=${TOPIC}&difficulty=2`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.q-prompt', { timeout: 30000 });
    await settle();
    const tab = page.getByRole('button', { name: 'Answer by handwriting' });
    if (await tab.count()) await tab.click();
    await page.waitForSelector('.ink-canvas-live', { timeout: 30000 });
    const questionId = await page.locator('.qpage').first().getAttribute('data-question-id');

    // The page's own Long Tasks observer; windows mark when input is being driven.
    await page.evaluate(() => {
      window.__long = []; window.__window = null;
      new PerformanceObserver(list => {
        for (const e of list.getEntries()) window.__long.push({ start: e.startTime, end: e.startTime + e.duration, ms: Math.round(e.duration), window: window.__window });
      }).observe({ type: 'longtask', buffered: false });
    });
    const inWindow = async (label, body) => { await page.evaluate(l => { window.__window = l; }, label); await body(); await page.evaluate(() => { window.__window = null; }); };
    const longIn = label => page.evaluate(l => window.__long.filter(t => t.window === l && t.ms >= 50), label);

    const driveInput = async phase => {
      const box = await page.locator('.ink-canvas-live').boundingBox();
      await inWindow(`${phase}:write`, async () => { await handwrite(page, box, '12'); });
      const writing = await longIn(`${phase}:write`);
      await check(`${phase}: writing with the pointer has no long task over ${LONG_TASK_BUDGET_MS} ms`, writing.length === 0, JSON.stringify(writing));
      const kind = page.getByRole('button', { name: /Answer by typing|Type your answer|Type/i }).first();
      if (await kind.count()) await kind.click().catch(() => {});
      const field = page.locator('input.answer-input, .editor-body input').first();
      if (await field.count()) {
        await inWindow(`${phase}:type`, async () => { await field.click(); await field.fill(''); await page.keyboard.type('12345', { delay: 20 }); });
        const typing = await longIn(`${phase}:type`);
        await check(`${phase}: typing has no long task over ${LONG_TASK_BUDGET_MS} ms`, typing.length === 0, JSON.stringify(typing));
        await check(`${phase}: the typed answer is still in its field`, (await field.inputValue()) === '12345', await field.inputValue());
      } else note(`${phase}: no typing field on this form; typing check not applicable`);
      // The practice screen is a focus view: its way out is the Index link; the shell's tabs follow.
      const hops = [{ path: '/', link: page.locator('a:visible, button:visible', { hasText: /^Index$/ }).first() },
        { path: '/progress', link: page.locator('a[href="/progress"]:visible').first() }, { path: '/notes', link: page.locator('a[href="/notes"]:visible').first() }];
      for (const { path, link } of hops) {
        await link.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
        if (!(await link.count())) { note(`${phase}: no visible link to ${path}`); continue; }
        const t0 = Date.now();
        await inWindow(`${phase}:nav${path}`, async () => { await link.click({ timeout: 5000 }); await page.waitForSelector('.shell main, main', { timeout: NAV_MS }).catch(() => {}); });
        const took = Date.now() - t0;
        const long = await longIn(`${phase}:nav${path}`);
        await check(`${phase}: moving to ${path} answers within ${NAV_MS} ms and without a long task`, took <= NAV_MS && long.length === 0, `${took} ms ${JSON.stringify(long)}`);
      }
    };

    // ── SLOW cloud ──────────────────────────────────────────────────────────
    let held = 0;
    const slow = async route => { held++; await new Promise(r => setTimeout(r, SLOW_MS)); await route.continue().catch(() => {}); };
    await page.route('**/v1/**', slow);
    await driveInput('slow');
    await check('slow: the cloud calls really were being held', held > 0, String(held));
    await page.unroute('**/v1/**', slow);

    // ── FAILING cloud and a down reader ─────────────────────────────────────
    // The question is opened while the cloud is healthy (the server issues it); the cloud then fails under the student's hands.
    await page.goto(`${base}/practice?subtopic=${TOPIC}&difficulty=2`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.q-prompt', { timeout: 30000 });
    await settle();
    const tab2 = page.getByRole('button', { name: 'Answer by handwriting' });
    if (await tab2.count()) await tab2.click();
    await page.waitForSelector('.ink-canvas-live', { timeout: 30000 });
    await page.evaluate(() => { window.__long = []; window.__window = null; new PerformanceObserver(l => { for (const e of l.getEntries()) window.__long.push({ ms: Math.round(e.duration), window: window.__window }); }).observe({ type: 'longtask' }); });
    reader.down = true;
    let refused = 0;
    const failing = route => { refused++; return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 'UNAVAILABLE', message: 'down' } }) }); };
    await page.route('**/v1/**', failing);
    await driveInput('failing');
    await check('failing: calls really were being refused while the student wrote', refused > 0, String(refused));
    await page.unroute('**/v1/**', failing);
    reader.down = false;

    // ── the work is kept ────────────────────────────────────────────────────
    const kept = await page.evaluate(qid => new Promise(done => {
      const open = indexedDB.open('pri-learning');
      open.onerror = () => done(false);
      open.onsuccess = () => {
        const db = open.result;
        try {
          const req = db.transaction('inkDrafts').objectStore('inkDrafts').getAllKeys();
          req.onsuccess = () => { db.close(); done(req.result.length > 0); };
          req.onerror = () => { db.close(); done(false); };
        } catch { db.close(); done(false); }
      };
    }), questionId);
    await check('the handwriting is kept in the sealed draft store whatever the cloud did', kept === true);
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
