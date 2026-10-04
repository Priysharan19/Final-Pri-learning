// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · The bundled engine marks a typed answer with the network gone
//
// Ledger 3.1 (browser half). The deterministic engine ships inside the client
// and is the instant, connection-loss fallback: a student whose connection
// drops mid-question still gets a verdict, and that verdict comes from the
// same marker as online. This tour proves it the only way it can be proved —
// in a real browser, with Playwright's context.setOffline(true) pulling the
// cable after the question is on screen, for a question of every answer type
// the product serves (numeric, expression, set, point, ratio, mcq, working).
//
// For each type the tour:
//   · loads a practice question online (lazy route chunks need the wire);
//   · goes offline and proves it (navigator.onLine is false; a fetch fails);
//   · types a wrong answer and sees the engine's "not quite" verdict;
//   · types the right answer and sees the engine's full-marks evaluation card;
//   · counts the network requests that were attempted while offline and
//     checks that none of them was needed for the verdict (they all failed).
//
// WHICH TYPES. The default build serves the India product (NCERT Classes
// 7–12); a Class 10 CBSE profile is served numeric, set, point and mcq
// answers, and the tour covers all four. The expression, ratio and working
// answer types are served only by the Australian banks, which exist behind
// the PRI_FEATURE_AUSTRALIA build flag and are not in this build; their
// marking, and interval/matrix/vector/complex answers (no generator yet), is
// pinned by the node suites (marker-equivalence-classes-check.mjs and
// friends), which run the same bundled engine code. The answersFor() table
// below still knows every type so the tour grows with the banks.
//
// THE ORACLE. The card never receives the authored answer — the local backend
// strips it — so the tour reads the question's own row from the app's local
// IndexedDB (store `questions`, key = the card's data-question-id) to learn
// what the right answer is. Nothing is injected, resolved or faked: the row is
// read, not written, and the verdict is whatever the engine says to what was
// typed.
// ─────────────────────────────────────────────────────────────────────────────
import { pathToFileURL } from 'node:url';

const SUBMIT = { name: 'Submit Answer' };
// Skips cost free-tier questions (20 a day per profile), so each target is
// aimed with the dot point and difficulty that the bank serves that answer
// type at (sampled: 30/30 for numeric, set and mcq; 29/30 for point) and the
// skip loop is only a short safety net.
const MAX_SKIPS = 6;

/** Class 10 CBSE practice routes that serve each answer type. */
const TARGETS = [
  { type: 'numeric', routes: ['c10-polynomials&difficulty=3', 'c10-quadratic-equations&dotpoint=3'] },
  { type: 'set', routes: ['c10-polynomials&difficulty=1', 'c10-quadratic-equations&dotpoint=0&difficulty=1'] },
  { type: 'mcq', routes: ['c10-quadratic-equations&dotpoint=2', 'c10-pair-linear-equations&dotpoint=0'] },
  { type: 'point', routes: ['c10-pair-linear-equations&dotpoint=2&difficulty=3'] }
];

const fmt = v => (Number.isInteger(v) ? String(v) : String(Number(Number(v).toPrecision(12))));

/** The right answer and a wrong one for a stored question payload. */
function answersFor(q) {
  const a = q.answer || {};
  switch (q.answerType) {
    case 'numeric': {
      if (a.simplestFraction) return { right: `${a.simplestFraction.n}/${a.simplestFraction.d}`, wrong: `${a.simplestFraction.n + 1}/${a.simplestFraction.d}` };
      if (a.surdForm) return { right: `${a.surdForm.k}sqrt(${a.surdForm.r})`, wrong: `${a.surdForm.k + 1}sqrt(${a.surdForm.r})` };
      return { right: fmt(a.value), wrong: fmt(a.value + 1) };
    }
    case 'expression': return { right: a.expr, wrong: `(${a.expr}) + 1` };
    case 'set': return { right: a.values.map(fmt).join(', '), wrong: a.values.map(v => fmt(v + 1)).join(', ') };
    case 'point': return { right: `(${fmt(a.x)}, ${fmt(a.y)})`, wrong: `(${fmt(a.x + 1)}, ${fmt(a.y)})` };
    case 'ratio': return { right: `${a.a}:${a.b}`, wrong: `${a.a + 1}:${a.b}` };
    case 'mcq': return { right: a.correctIndex, wrong: (a.correctIndex + 1) % (q.mcqOptions?.length || 4) };
    case 'working': return { right: a.canonicalWorking || null, wrong: '1 = 2\n2 = 3' };
    default: return null;
  }
}

export const flow = {
  id: 'offline-marking',
  name: 'Offline marking · the bundled engine marks every answer type with the network gone',

  async run({ page, ctx, base, check, goto, createProfile, settle, note }) {
    await goto('/');
    await createProfile({ name: 'Shakuntala Devi', year: 10, course: 'in' });

    const readRow = id => page.evaluate(qid => new Promise((resolveRow, reject) => {
      const req = indexedDB.open('pri-learning');
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        try {
          const tx = db.transaction('questions', 'readonly');
          const get = tx.objectStore('questions').get(qid);
          get.onsuccess = () => { db.close(); resolveRow(get.result ? { answerType: get.result.payload?.answerType, answer: get.result.payload?.answer, mcqOptions: get.result.payload?.mcqOptions } : null); };
          get.onerror = () => { db.close(); reject(get.error); };
        } catch (e) { db.close(); reject(e); }
      };
    }), id);

    /** Serve a question of `type` from one of its routes, online. */
    const serve = async (target) => {
      for (const sub of target.routes) {
        await page.goto(`${base}/practice?subtopic=${sub}`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.qpage[data-answer-type]', { timeout: 30000 });
        for (let skips = 0; skips < MAX_SKIPS; skips++) {
          const got = await page.locator('.qpage[data-question-id]').getAttribute('data-answer-type');
          if (got === target.type) return sub;
          const next = page.locator('.ctx-next');
          if (!await next.count()) break;
          const before = await page.locator('.qpage[data-question-id]').getAttribute('data-question-id');
          await next.click();
          await page.waitForFunction(prev => document.querySelector('.qpage[data-question-id]')?.getAttribute('data-question-id') !== prev, before, { timeout: 30000 });
        }
      }
      return null;
    };

    const typeTab = async () => {
      const tab = page.getByRole('button', { name: 'Answer by typing' });
      if (await tab.count()) { await tab.click(); await settle(); }
    };

    for (const target of TARGETS) {
      const sub = await serve(target);
      if (!await check(`${target.type}: a question of this type was served (${target.routes.join(' | ')})`, !!sub)) continue;
      const qid = await page.locator('.qpage[data-question-id]').getAttribute('data-question-id');
      const row = await readRow(qid);
      if (!await check(`${target.type}: the question's own row is readable from the local store`, row && row.answerType === target.type, JSON.stringify(row).slice(0, 200))) continue;
      const answers = answersFor(row);
      if (!await check(`${target.type}: an answer can be derived from the authored payload`, !!answers)) continue;

      // ── pull the cable ──
      const attempted = [];
      const failed = [];
      const onReq = r => attempted.push(r.url());
      const onFail = r => failed.push(r.url());
      page.on('request', onReq);
      page.on('requestfailed', onFail);
      await ctx.setOffline(true);
      const online = await page.evaluate(() => navigator.onLine);
      await check(`${target.type}: the page reports itself offline`, online === false);
      const probe = await page.evaluate(async b => { try { await fetch(`${b}/__offline-probe__?${Date.now()}`, { cache: 'no-store' }); return 'reached'; } catch { return 'failed'; } }, base);
      await check(`${target.type}: a network request really fails while offline`, probe === 'failed', `probe ${probe}`);

      try {
        if (target.type === 'mcq') {
          await page.locator('.mcq-opt').nth(answers.wrong).click();
          await page.getByRole('button', SUBMIT).click();
          // An MCQ may resolve on the first wrong try or allow a retry; either is a verdict from the engine.
          await page.waitForSelector('.verdict-bad, .eval-card', { timeout: 20000 });
          const resolvedEarly = await page.locator('.eval-card').count();
          if (!resolvedEarly) {
            await page.locator('.mcq-opt').nth(answers.right).click();
            await page.getByRole('button', SUBMIT).click();
            await page.waitForSelector('.eval-card', { timeout: 20000 });
          }
          const verdict = await page.locator('.eval-card').getAttribute('data-verdict');
          await check(`${target.type}: the engine delivered a verdict offline (${resolvedEarly ? 'resolved on the wrong option' : 'wrong then right'})`, verdict === (resolvedEarly ? 'incorrect' : 'correct'), `data-verdict=${verdict}`);
        } else if (target.type === 'working') {
          await typeTab();
          const box = page.locator('textarea.working-input');
          await check(`${target.type}: a working box is on screen`, await box.count() === 1);
          await box.fill(answers.wrong);
          await page.getByRole('button', SUBMIT).click();
          await page.waitForSelector('.verdict-bad, .eval-card', { timeout: 20000 });
          await check(`${target.type}: wrong working gets the engine's verdict offline`, (await page.locator('.verdict-bad').count()) + (await page.locator('.eval-card[data-verdict="incorrect"]').count()) >= 1);
          if (answers.right && await page.locator('.eval-card').count() === 0) {
            await box.fill(answers.right);
            await page.getByRole('button', SUBMIT).click();
            await page.waitForSelector('.eval-card', { timeout: 20000 });
            const verdict = await page.locator('.eval-card').getAttribute('data-verdict');
            await check(`${target.type}: the canonical working earns full marks offline`, verdict === 'correct', `data-verdict=${verdict}`);
          }
        } else {
          await typeTab();
          const box = page.locator('.editor-body input.answer-input');
          if (!await check(`${target.type}: a typed answer box is on screen`, await box.count() === 1)) continue;
          await box.fill(String(answers.wrong));
          await page.getByRole('button', SUBMIT).click();
          await page.waitForSelector('.verdict-bad, .eval-card', { timeout: 20000 });
          const retry = await page.locator('.verdict-bad').count();
          await check(`${target.type}: the wrong answer "${answers.wrong}" gets the engine's "not quite" offline`, retry === 1 || await page.locator('.eval-card[data-verdict="incorrect"]').count() === 1);
          if (retry) {
            const feedback = (await page.locator('.verdict-bad').innerText()).trim();
            await check(`${target.type}: the offline verdict carries the engine's wording`, feedback.length > 0, feedback.slice(0, 120));
            await box.fill(String(answers.right));
            await page.getByRole('button', SUBMIT).click();
            await page.waitForSelector('.eval-card', { timeout: 20000 });
            const verdict = await page.locator('.eval-card').getAttribute('data-verdict');
            await check(`${target.type}: the right answer "${answers.right}" earns the engine's correct verdict offline`, verdict === 'correct', `data-verdict=${verdict}`);
            await check(`${target.type}: the evaluation card says it was marked on-device`, /on-device|Pri engine/i.test(await page.locator('.eval-disclaimer').innerText()));
          }
        }
        // Every request attempted offline failed — the verdict owed nothing to the wire.
        const succeeded = attempted.filter(u => !failed.includes(u) && !u.startsWith('data:') && !u.startsWith('blob:'));
        await check(`${target.type}: no network request succeeded while offline (${attempted.length} attempted, ${failed.length} failed)`, succeeded.length === 0, succeeded.slice(0, 3).join(' · '));
      } finally {
        page.off('request', onReq);
        page.off('requestfailed', onFail);
        await ctx.setOffline(false);
      }
      note?.(`${target.type} served from ${sub}`);
    }
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  const failed = await runOne(flow);
  process.exit(failed ? 1 : 0);
}
