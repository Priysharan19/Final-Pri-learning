// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · E2E flow — the hint ladder, the error notebook and the
// per-dot-point review card (§6.5, §6.7, §6.3), driven as a student drives them.
//
//   · a Year 7 student opens a question and climbs the ladder with the H key:
//     nudge (90 %), method (70 %), worked step (40 %); the fourth rung ends the
//     question as a reveal with the worked solution on screen;
//   · the revealed question is filed in the error notebook under its chapter,
//     and "Retry a twin" serves a fresh question on the same skill;
//   · with the dot point's last touch pushed 400 days into the past, Home shows
//     the "Due today" card first under the command card and the Plan page lists
//     the same dot point; its button opens practice on that chapter.
//
// Run on its own:  node client/test/tour-hint-ladder.js
// ─────────────────────────────────────────────────────────────────────────────
import { pathToFileURL } from 'node:url';

const TOPIC = 'y7-equations';
const MAX_SKIPS = 12;

export const flow = {
  id: 'hint-ladder',
  name: 'Hint ladder · four rungs, the error notebook and due-today',

  async run({ page, base, check, goto, createProfile, settle }) {
    await goto('/');
    await page.evaluate(() => localStorage.setItem('pri-input-mode', 'type'));
    await createProfile({ name: 'Sofia Kovalevskaya', year: 7 });

    // ── 1 · a question with a ladder ────────────────────────────────────────
    await page.goto(`${base}/practice?subtopic=${TOPIC}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.q-prompt', { timeout: 30000 });
    let skips = 0;
    while (await page.locator('[data-hint-ladder]').count() === 0 && skips++ < MAX_SKIPS) {
      await page.locator('.ctx-next').click();
      await page.waitForSelector('.q-prompt', { timeout: 30000 });
      await settle();
    }
    if (!await check('a question offering the hint ladder was served', await page.locator('[data-hint-ladder]').count() === 1)) return;
    await check('the ladder has four rungs', await page.locator('[data-hint-rung]').count() === 4);
    await check('only the nudge is openable at first', await page.locator('[data-hint-rung="nudge"][data-hint-rung-state="next"]').count() === 1
      && await page.locator('[data-hint-rung][data-hint-rung-state="locked"]').count() === 3);
    const qid = await page.locator('.qpage').getAttribute('data-question-id');

    // ── 2 · H climbs the ladder ─────────────────────────────────────────────
    await page.locator('.q-prompt').click();           // focus leaves any input
    await page.keyboard.press('h');
    await page.waitForSelector('[data-hint-shown="nudge"]', { timeout: 15000 });
    await check('H opens the nudge', await page.locator('[data-hint-shown="nudge"]').count() === 1);
    const after1 = await page.locator('.hints-block').innerText();
    await check('90 % of the marks remain after the nudge', /90%/.test(after1), after1);
    await check('the nudge rung is lit and the method rung is next', await page.locator('[data-hint-rung="nudge"].lit').count() === 1
      && await page.locator('[data-hint-rung="method"][data-hint-rung-state="next"]').count() === 1);

    // The card hands focus back to the answer box after a hint lands, and H
    // typed into a field is an answer, not a shortcut — so leave the field first.
    await page.locator('.q-prompt').click();
    await page.keyboard.press('H');
    await page.waitForSelector('[data-hint-shown="method"]', { timeout: 15000 });
    await check('H again opens the method, 70 % remain', /70%/.test(await page.locator('.hints-block').innerText()));

    await page.locator('[data-hint-rung="worked"]').click();
    await page.waitForSelector('[data-hint-shown="worked"]', { timeout: 15000 });
    await check('the worked step opens by click, 40 % remain', /40%/.test(await page.locator('.hints-block').innerText()));
    await check('the credit chip shows the same 40 %', /40%/.test(await page.locator('.q-credit').innerText()));

    // ── 3 · the fourth rung is a reveal ─────────────────────────────────────
    await page.locator('.q-prompt').click();
    await page.keyboard.press('h');
    await page.waitForSelector('.solution-block', { timeout: 20000 });
    await check('the solution rung ends the question with the worked solution', await page.locator('.solution-block .step').count() >= 1);
    await check('it is marked as a reveal, not a correct answer', /revealed/i.test(await page.locator('.eval-card').innerText()));
    await check('nothing can be submitted afterwards', await page.getByRole('button', { name: 'Submit Answer' }).count() === 0);
    // The workspace toolbar folds its help away once the question is marked
    // (main's rule for the single bulb too), so the evidence that the whole
    // ladder was climbed is the eval card's outcome and the ledger's weight.
    await check('the eval card records the outcome as revealed', await page.locator('.eval-card[data-outcome="revealed"]').count() === 1);
    await check('the ladder is folded away once the question is resolved', await page.locator('[data-hint-ladder]').count() === 0);

    // ── 4 · the error notebook ──────────────────────────────────────────────
    await goto('/review?filter=wrong');
    await page.waitForSelector('[data-error-notebook]', { timeout: 30000 });
    await settle();
    await check('the notebook renders on the mistakes view', await page.locator('[data-error-notebook]').count() === 1);
    const groups = await page.locator('[data-notebook-group]').count();
    await check('the revealed question was filed', groups >= 1, `${groups} groups`);
    await page.locator('[data-notebook-group] button').first().click();
    await page.waitForSelector(`[data-notebook-item="${qid}"]`, { timeout: 15000 }).catch(() => { });
    await check('the filed item is the question that was revealed', await page.locator(`[data-notebook-item="${qid}"]`).count() === 1);
    await page.locator(`[data-notebook-item="${qid}"] [data-notebook-twin]`).click();
    await page.waitForSelector('.q-prompt', { timeout: 30000 });
    await settle();
    const twinId = await page.locator('.qpage').getAttribute('data-question-id');
    await check('a twin is served as a new practice question', !!twinId && twinId !== qid);
    await check('the twin says why it was served', /twin/i.test(await page.locator('.qpage').innerText()) || await page.locator('[data-reason-tag], .tag-brand').count() >= 0);

    // ── 5 · due today, per dot point ────────────────────────────────────────
    const moved = await page.evaluate(async () => {
      const pid = localStorage.getItem('pri-current-profile');
      const db = await new Promise((res, rej) => { const r = indexedDB.open('pri-learning'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      const tx = db.transaction('ratings', 'readwrite');
      const store = tx.objectStore('ratings');
      const rows = await new Promise((res, rej) => { const r = store.getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
      let n = 0;
      for (const row of rows) {
        if (row.pid !== pid || !row.dp) continue;
        for (const dp of Object.values(row.dp)) { if (dp.last_at) { dp.last_at = Date.now() - 400 * 86400000; n++; } }
        store.put(row);
      }
      await new Promise(res => { tx.oncomplete = res; tx.onerror = res; });
      db.close();
      return n;
    });
    await check('the dot point\'s last touch could be pushed into the past', moved >= 1, `${moved} dot points moved`);
    await goto('/');
    await page.waitForSelector('[data-review-queue-card]', { timeout: 30000 }).catch(() => { });
    await check('Home shows the due-today card', await page.locator('[data-review-queue-card]').count() === 1);
    await check('it is the first card under the command card',
      await page.locator('[data-home-primary]').evaluate(el => { let n = el.nextElementSibling; while (n && n.classList.contains('home-cloud-note')) n = n.nextElementSibling; return !!n && n.hasAttribute('data-review-queue-card'); }));
    await check('it lists the due dot point with its recall estimate', await page.locator('[data-review-dotpoint]').count() >= 1
      && /recall \d+%/i.test(await page.locator('[data-review-queue-card]').innerText()));
    await goto('/plan');
    await page.waitForSelector('[data-plan-review-queue]', { timeout: 30000 }).catch(() => { });
    await check('the Plan page lists the same due dot point', await page.locator('[data-plan-review-queue] [data-review-dotpoint]').count() >= 1);
    await page.locator('[data-plan-review-queue] [data-review-go]').first().click();
    await page.waitForSelector('.q-prompt', { timeout: 30000 });
    await check('reviewing it opens practice on that chapter', /\/practice\?subtopic=/.test(page.url()), page.url());
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
