// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · E2E — what one handwritten answer costs the paid reader
//
// Owner decision, 19 Nov 2026: the reading is not shown; one press of "Mark my working" reads the page silently and marks
// it on the student's own page (CTO ruling: written working is ONE authoritative attempt; Redo is the same question
// again). This flow counts the provider calls each way of answering costs, from the first stroke to the server's verdict.
//
//   1. one line, right first time                          → 1
//   2. four lines written with pauses                      → 1
//   3. more ink written after a pause, then marked         → 1 (writing and pausing never read, device preference off)
//   4. a wrong page resolves on the first press            → 1, no second try
//   5. Redo the same question, rewrite, mark again         → 2
//   6. double press on a slow reader, then a second tab    → 1
//   7. a line corrected from the marked page, marked again → 1 (no further provider read)
//   8. ink written while the page is being read            → the earlier page's reading is never the mark
//
// WHAT IS REAL: the built client, the platform server (issue, transcribe,
// recognise, confirm, grade, the kept-read dedupe) on its own SQLite file.
// WHAT IS SYNTHETIC: the handwriting READER — a scripted stand-in that never
// looks at the picture and never escalates to a fallback model. A provider
// call here is one request from the server's provider module to the stand-in.
// With a real provider a doubtful read can cost a second (fallback) call; that
// is the provider's escalation, not a second read by the page. Not real
// provider, real handwriting or real-device evidence.
//
// Run on its own:  node client/test/tour-read-cost.js
// ─────────────────────────────────────────────────────────────────────────────
import { pathToFileURL } from 'node:url';
import { handwrite, markWorking } from './fakeServerReader.js';

const EVIDENCE = 'SYNTHETIC-READER EVIDENCE';
const TOPIC = 'c7-finding-unknown-current';


export const flow = {
  id: 'read-cost',
  online: true,
  name: 'Read on request · provider calls per handwritten answer, first stroke to verdict',

  async run({ page, base, check, goto, createProfile, settle, note, online }) {
    // Device preference off: the page is read only when marked, so writing and pausing never costs a call; automatic reading (owner decision, 18 Nov 2026) is switched off on this device, as a student can in Settings; auto mode is pinned in tour-auto-read.js.
    await page.context().addInitScript(() => { try { localStorage.setItem('pri.autoRead', 'off'); } catch { /* none */ } });
    note(`${EVIDENCE}: "Read on request · provider calls…" counts requests from the real server's provider module to the scripted stand-in reader (which never escalates to a fallback model). The server, its kept-read dedupe and every mark are real.`);
    const { reader } = online;
    const costs = {};
    try {
      await goto('/');
      await createProfile({ name: 'Cost Counter', year: 7 });
      await online.signIn({ name: 'Cost Counter' });

      const readCalls = () => online.practiceCalls(/^\/v1\/(?:handwriting\/transcribe|practice\/[^/]+\/recognize)$/);
      /** A fresh, untried, numeric written question; returns { canvas, right }. */
      const fresh = async () => {
        await page.goto(`${base}/practice?subtopic=${TOPIC}`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.q-prompt', { timeout: 30000 });
        await settle();
        for (let moved = 0; moved < 12; moved++) {
          const row = await online.shownRow();
          const tried = row?.serverQuestionId ? await online.practiceCalls(new RegExp(`^/v1/practice/${row.serverQuestionId}/submit$`)) : [];
          const known = await online.answerOf().catch(() => null);
          const usable = !tried.length && known?.answerType === 'numeric' && /^-?\d{1,4}$/.test(String(known.text)) && await page.getByRole('button', { name: 'Answer by handwriting' }).count();
          if (usable) break;
          const leaving = await page.locator('.qpage').first().getAttribute('data-question-id');
          await page.locator('.ctx-next').click();
          await page.waitForFunction(id => {
            const el = document.querySelector('.qpage[data-question-id]');
            return el && el.getAttribute('data-question-id') !== id && el.querySelector('.q-prompt');
          }, leaving, { timeout: 30000 });
          await settle();
        }
        await page.getByRole('button', { name: 'Answer by handwriting' }).click();
        await page.waitForSelector('.ink-canvas-live', { timeout: 30000 });
        online.forgetKeptReads();           // each scenario starts with nothing kept (desk only)
        return { canvas: await page.locator('.ink-canvas-live').boundingBox(), right: await online.answerOf() };
      };
      // One press marks the working on the student's own page (owner decision, 19 Nov 2026: the reading is not shown).
      const submitAndSettle = async () => {
        await markWorking(page);
        await page.waitForSelector('[data-marked-page], .eval-card', { timeout: 30000 }).catch(() => {});
        await page.waitForTimeout(600);
      };
      // Submit is ONE request (#506): the reading travels with it. A Submit the server refuses (read again) is a request, not an attempt, so
      // only a 200 is counted as marked.
      const gradesOf = async id => (await online.practiceCalls(new RegExp(`^/v1/practice/${id}/submit$`))).filter(c => c.status === 200);
      const receiptsOf = id => online.practiceCalls(new RegExp(`^/v1/practice/${id}/recognize$`));

      // ── 1 · one line, right first time ─────────────────────────────────────
      {
        const { canvas, right } = await fresh();
        const start = reader.requests.length, pageStart = (await readCalls()).length;
        reader.lines = null; reader.text = right.text; reader.confidence = 0.97;
        await handwrite(page, canvas, '7');
        await page.waitForTimeout(2600);              // a pause used to send a read
        const afterPause = reader.requests.length - start;
        await submitAndSettle();
        const grade = (await gradesOf(right.serverQuestionId)).at(-1);
        costs.oneLine = reader.requests.length - start;
        await check(`1 · one-line answer, right first time: 1 provider call from first stroke to verdict (0 while writing and pausing; one press reads and marks) [${EVIDENCE}]`,
          afterPause === 0 && costs.oneLine === 1 && grade?.json?.correct === true && grade.json.resolved === true,
          `provider calls ${costs.oneLine} (after the pause ${afterPause}); page read requests ${(await readCalls()).length - pageStart}; correct ${grade?.json?.correct}`);
      }

      // ── 2 · four lines of working, written with pauses ─────────────────────
      {
        const { canvas, right } = await fresh();
        const start = reader.requests.length;
        const n = Number(right.text);
        const working = [`${n + 5} - 5`, `${n + 2} - 2`, `${n + 1} - 1`, `x = ${n}`];
        reader.lines = working.map(text => ({ text })); reader.confidence = 0.97;
        for (const [i, glyph] of ['1', '7', '1', '7'].entries()) {
          await handwrite(page, canvas, glyph, { x: 40 + i * 110 });
          await page.waitForTimeout(1500);            // longer than the old 1.1 s settle
        }
        const whileWriting = reader.requests.length - start;
        await submitAndSettle();
        const grade = (await gradesOf(right.serverQuestionId)).at(-1);
        costs.fourLines = reader.requests.length - start;
        await check(`2 · four-line working written with pauses, then marked once: 1 provider call (it used to be one per pause — four — plus the receipt) [${EVIDENCE}]`,
          whileWriting === 0 && costs.fourLines === 1 && grade?.json?.correct === true && `${grade?.body?.steps || ''}\n${grade?.body?.answer || ''}`.includes(working.join('\n')) || grade?.body?.answer === working.join('\n'),
          `provider calls ${costs.fourLines} (while writing ${whileWriting}); correct ${grade?.json?.correct}; body ${JSON.stringify({ answer: grade?.body?.answer, steps: grade?.body?.steps })}`);
      }

      // ── 3 · more ink after a pause, then marked ────────────────────────────
      // There is no read-edit-read-again loop any more: the reading is not shown, so editing the ink costs nothing until the one press.
      {
        const { canvas, right } = await fresh();
        const start = reader.requests.length;
        reader.lines = null; reader.text = '1'; reader.confidence = 0.97;
        await handwrite(page, canvas, '1');
        await page.waitForTimeout(1500);
        reader.text = right.text;
        await handwrite(page, canvas, '7', { x: 170 });
        await page.waitForTimeout(1500);
        const afterEdit = reader.requests.length - start;
        await submitAndSettle();
        const grade = (await gradesOf(right.serverQuestionId)).at(-1);
        costs.editAndReread = reader.requests.length - start;
        await check(`3 · write, pause, write more, mark: 1 provider call — none for writing or editing the ink, one for the page as it stands when marked [${EVIDENCE}]`,
          afterEdit === 0 && costs.editAndReread === 1 && grade?.json?.correct === true,
          `provider calls ${costs.editAndReread} (after the edit, before marking: ${afterEdit}); correct ${grade?.json?.correct}`);
      }

      // ── 4 · a wrong written page resolves on the first press ───────────────
      {
        const { canvas, right } = await fresh();
        const start = reader.requests.length;
        const wrong = String(Number(right.text) + 3);
        reader.lines = null; reader.text = wrong; reader.confidence = 0.97;
        await handwrite(page, canvas, '17');
        await submitAndSettle();
        const grades = await gradesOf(right.serverQuestionId);
        costs.secondTrySameInk = reader.requests.length - start;
        // CTO ruling, 19 Nov 2026: the first Mark my working is the ONE authoritative attempt for written working: the server
        // resolves it right or wrong and the full marked page is shown at once; there is no "Not quite, one more go".
        await check(`4 · a wrong written page: 1 provider call, resolved by the server on the first press, no second try opened [${EVIDENCE}]`,
          grades.length === 1 && grades[0].json?.correct === false && grades[0].json.resolved === true && costs.secondTrySameInk === 1 &&
            await page.locator('.verdict-bad').count() === 0 && !/one more go/i.test(await page.locator('body').innerText()) && await page.getByRole('button', { name: 'Redo question' }).count() === 1,
          `provider calls ${costs.secondTrySameInk}; grades ${JSON.stringify(grades.map(g => [g.json?.correct, g.json?.resolved]))}`);
      }

      // ── 5 · Redo the same question, rewrite, mark again ────────────────────
      {
        const { canvas, right } = await fresh();
        const start = reader.requests.length;
        const wrong = String(Number(right.text) + 4);
        reader.lines = null; reader.text = wrong; reader.confidence = 0.97;
        await handwrite(page, canvas, '71');
        await submitAndSettle();
        const first = (await online.practiceCalls(/^\/v1\/practice\/[^/]+\/submit$/)).at(-1);
        const before = await page.locator('.qpage[data-question-id]').getAttribute('data-question-id');
        await page.getByRole('button', { name: 'Redo question' }).click();
        await page.waitForFunction(id => { const el = document.querySelector('.qpage[data-question-id]'); return el && el.getAttribute('data-question-id') !== id && !!el.querySelector('.q-prompt') && !document.querySelector('[data-marked-page], .eval-card'); }, before, { timeout: 30000 });
        await page.getByRole('button', { name: 'Answer by handwriting' }).click().catch(() => {});
        await page.waitForSelector('.ink-canvas-live', { timeout: 30000 });
        const canvas2 = await page.locator('.ink-canvas-live').boundingBox();
        reader.text = right.text;
        await handwrite(page, canvas2, '117');
        await page.waitForTimeout(1500);
        const beforeSecondRead = reader.requests.length - start;
        await submitAndSettle();
        const second = (await online.practiceCalls(/^\/v1\/practice\/[^/]+\/submit$/)).at(-1);
        costs.secondTryRewritten = reader.requests.length - start;
        await check(`5 · Redo the same question and mark a rewritten page: 2 provider calls in all — one read per marked page, none while writing [${EVIDENCE}]`,
          beforeSecondRead === 1 && first?.json?.correct === false && first.json.resolved === true && second !== first && second?.json?.correct === true && costs.secondTryRewritten === 2,
          `provider calls ${costs.secondTryRewritten} (before the second press: ${beforeSecondRead}); grades ${JSON.stringify([first?.json?.correct, second?.json?.correct])}`);
      }

      // ── 6 · an impatient double press on a slow reader; then a second tab ──
      {
        const { canvas, right } = await fresh();
        const start = reader.requests.length, pageStart = (await readCalls()).length;
        reader.lines = null; reader.text = right.text; reader.confidence = 0.97;
        let release; reader.gate = new Promise(resolve => { release = resolve; });
        await handwrite(page, canvas, '7');
        const mark = page.getByRole('button', { name: /^Mark my working/ }).first();
        await mark.waitFor({ state: 'visible', timeout: 8000 });
        // Two presses in one task: the second lands before the page has re-rendered.
        await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /^Mark my working/.test(x.textContent || '')); b.click(); b.click(); });
        await page.waitForTimeout(1200);
        const whileSlow = { provider: reader.requests.length - start, submits: (await gradesOf(right.serverQuestionId)).length };
        release(); reader.gate = null;
        await page.waitForSelector('[data-marked-page], .eval-card', { timeout: 30000 }).catch(() => {});
        await page.waitForTimeout(1500);
        const afterRead = reader.requests.length - start;
        const pageRequests = (await readCalls()).length - pageStart;
        // The same account opens the same question in a second tab: nothing is read for it.
        const tab = await page.context().newPage();
        try {
          await tab.goto(page.url(), { waitUntil: 'domcontentloaded' });
          await tab.waitForSelector('.qpage[data-question-id]', { timeout: 30000 }).catch(() => {});
          await tab.waitForTimeout(2500);
        } finally { await tab.close(); }
        const afterTab = reader.requests.length - start;
        const grades = await gradesOf(right.serverQuestionId);
        costs.doublePress = reader.requests.length - start;
        await check(`6 · a double press on a slow reader, then the same page in a second tab: 1 provider call in all — one page request and one mark for two presses, none for the second tab [${EVIDENCE}]`,
          whileSlow.provider === 1 && whileSlow.submits === 0 && afterRead === 1 && pageRequests === 1 && afterTab === 1 &&
            costs.doublePress === 1 && grades.length === 1 && grades[0].json?.correct === true,
          `while the reader was slow ${JSON.stringify(whileSlow)}; after the read ${afterRead} provider, ${pageRequests} page request(s); after the tab ${afterTab}; total ${costs.doublePress}; marks ${grades.length}`);
      }

      // ── 7 · an unreadable final answer, typed instead: no further read ────
      {
        const { canvas, right } = await fresh();
        const start = reader.requests.length;
        reader.lines = [{ text: String(Number(right.text) + 6), confidence: 0.4 }]; reader.confidence = 0.4;
        await handwrite(page, canvas, '1');
        const gradedBefore = (await online.practiceCalls(/^\/v1\/practice\/[^/]+\/submit$/)).length;
        await markWorking(page);
        await page.waitForSelector('[data-final-answer-sentence]', { timeout: 30000 }).catch(() => {});
        const asked = await page.locator('[data-final-answer-sentence]').count() === 1 && await page.locator('[data-ink-final-answer]').count() === 1;
        const sentWhileAsking = (await online.practiceCalls(/^\/v1\/practice\/[^/]+\/submit$/)).length - gradedBefore;
        if (asked) await page.locator('[data-ink-final-answer]').fill(right.text);
        await submitAndSettle();
        const second = (await online.practiceCalls(/^\/v1\/practice\/[^/]+\/submit$/)).at(-1);
        costs.lateReading = reader.requests.length - start;
        await check(`7 · a final answer the reader was not sure of is never marked: the one sentence and a box, nothing sent; the typed answer is marked as typed, with no further provider read — 1 in all [${EVIDENCE}]`,
          asked && sentWhileAsking === 0 && second?.body?.answerTyped === true && second.body.answer === right.text && second.json?.correct === true && costs.lateReading === 1,
          `asked ${asked}; sent while asking ${sentWhileAsking}; provider calls ${costs.lateReading}; typed ${second?.body?.answerTyped}; correct ${second?.json?.correct}`);
        reader.confidence = 0.97;
      }

      // ── 8 · ink written while the page is being read: the earlier reading is never the mark ──
      {
        const { canvas, right } = await fresh();
        const start = reader.requests.length;
        reader.lines = null; reader.text = '1'; reader.confidence = 0.97;
        let release; reader.gate = new Promise(resolve => { release = resolve; });
        await handwrite(page, canvas, '1');
        await markWorking(page);
        await page.waitForTimeout(800);
        const gradesBefore = (await gradesOf(right.serverQuestionId)).length;
        await handwrite(page, canvas, '7', { x: 170 }).catch(() => {});   // written while the first page is being read (the canvas may be locked)
        reader.text = right.text;
        release(); reader.gate = null;
        await page.waitForTimeout(4000);
        const grades = await gradesOf(right.serverQuestionId);
        costs.wroteWhileReading = reader.requests.length - start;
        await check(`8 · ink written while the page is being read: the earlier page's reading ("1") is never what was marked while newer ink was on the page [${EVIDENCE}]`,
          gradesBefore === 0 && grades.every(g => g.body?.answer !== '1' || false),
          `marks ${JSON.stringify(grades.map(g => [g.body?.answer, g.json?.correct]))}; provider calls ${costs.wroteWhileReading}`);
      }

      // Scenarios 9 and 10 pinned the read receipt of the removed "Read my answer" step (a kept read gone at Submit, a damaged
      // receipt). With one press there is no separate read to expire; the server-side receipt and dedupe rules are pinned by
      // server/test/recognition-dedupe-check.mjs and recognize-question-cap-check.mjs.
      note(`provider calls per completed handwritten answer [${EVIDENCE}]: one line right first time ${costs.oneLine} · four lines with pauses, read once ${costs.fourLines} · read, edit, read again ${costs.editAndReread} · second try, ink unchanged ${costs.secondTrySameInk} · second try after rewriting ${costs.secondTryRewritten} · double press then a second tab ${costs.doublePress} · late reading against a corrected transcript ${costs.lateReading} · ink written while reading ${costs.wroteWhileReading} · kept read gone before Submit, read receipt valid ${costs.expiredWithReceipt} (0 at Submit) · kept read gone, no valid receipt ${costs.expiredRead} (0 at Submit, 1 for Read again)`);
      await check('no provider was reached but the scripted reader', reader.refused.length === 0, JSON.stringify(reader.refused));
    } finally {
      reader.gate = null;
      reader.lines = null; reader.text = '7'; reader.confidence = 0.6;
    }
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
