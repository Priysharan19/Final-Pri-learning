// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · E2E — what one handwritten answer costs the paid reader
//
// Owner decision: recognition is student-triggered. Write → saved → "Read my
// answer" → ONE recognition operation → confirm → Submit. This flow counts the
// provider calls each way of answering costs, from the first stroke to the
// server's verdict, and asserts them. The target is 1 paid call for an answer
// whose ink does not change after it is read.
//
//   1. one line, right first time                          → 1
//   2. four lines written with pauses, read once           → 1
//   3. read, edit the ink, read again                      → 2
//   4. second try after a wrong first try, ink unchanged   → 1
//   5. second try after rewriting the ink                  → 2
//   6. double press on a slow reader, then a second tab    → 1
//   7. late reading vs. a hand-corrected current transcript → 2 (correction stands)
//   8. ink written while an earlier page is being read     → 2 (late one is stale)
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
import { handwrite, pressRead } from './fakeServerReader.js';

const EVIDENCE = 'SYNTHETIC-READER EVIDENCE';
const TOPIC = 'y7-equations';
const SUBMIT = { name: 'Submit Answer' };

export const flow = {
  id: 'read-cost',
  online: true,
  name: 'Read on request · provider calls per handwritten answer, first stroke to verdict',

  async run({ page, base, check, goto, createProfile, settle, note, online }) {
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
      const lines = n => page.waitForFunction(count => document.querySelectorAll('.ink-line').length === count && !document.querySelector('[data-ink-stale]'), n, { timeout: 20000 }).catch(() => {});
      const submitAndSettle = async () => {
        await page.waitForFunction(() => { const b = document.querySelector('.ws-actions .btn-primary'); return !!b && !b.disabled; }, null, { timeout: 15000 }).catch(() => {});
        await page.getByRole('button', SUBMIT).click();
        await page.waitForSelector('.eval-card, .verdict-bad', { timeout: 30000 }).catch(() => {});
        await page.waitForTimeout(600);
      };
      const gradesOf = id => online.practiceCalls(new RegExp(`^/v1/practice/${id}/submit$`));
      const receiptsOf = id => online.practiceCalls(new RegExp(`^/v1/practice/${id}/recognize$`));

      // ── 1 · one line, right first time ─────────────────────────────────────
      {
        const { canvas, right } = await fresh();
        const start = reader.requests.length, pageStart = (await readCalls()).length;
        reader.lines = null; reader.text = right.text; reader.confidence = 0.97;
        await handwrite(page, canvas, '7');
        await page.waitForTimeout(2600);              // a pause used to send a read
        const afterPause = reader.requests.length - start;
        await pressRead(page);
        await lines(1);
        await submitAndSettle();
        const grade = (await gradesOf(right.serverQuestionId)).at(-1);
        const receipt = (await receiptsOf(right.serverQuestionId)).at(-1);
        costs.oneLine = reader.requests.length - start;
        await check(`1 · one-line answer, right first time: 1 provider call from first stroke to verdict (0 while writing and pausing; the Submit receipt is reused) [${EVIDENCE}]`,
          afterPause === 0 && costs.oneLine === 1 && (await readCalls()).length === pageStart + 2 && receipt?.json?.reused === true &&
            grade?.json?.correct === true && grade.json.resolved === true,
          `provider calls ${costs.oneLine} (after the pause ${afterPause}); page read requests ${(await readCalls()).length - pageStart}; receipt reused ${receipt?.json?.reused}; correct ${grade?.json?.correct}`);
      }

      // ── 2 · four lines of working, written with pauses, read once ──────────
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
        await pressRead(page);
        await lines(4);
        await submitAndSettle();
        const grade = (await gradesOf(right.serverQuestionId)).at(-1);
        costs.fourLines = reader.requests.length - start;
        await check(`2 · four-line working written with pauses, then read once: 1 provider call (it used to be one per pause — four — plus the receipt) [${EVIDENCE}]`,
          whileWriting === 0 && costs.fourLines === 1 && grade?.json?.correct === true && grade.body?.steps === working.join('\n'),
          `provider calls ${costs.fourLines} (while writing ${whileWriting}); correct ${grade?.json?.correct}`);
      }

      // ── 3 · read, edit the ink, read again ─────────────────────────────────
      {
        const { canvas, right } = await fresh();
        const start = reader.requests.length;
        reader.lines = null; reader.text = '1'; reader.confidence = 0.97;
        await handwrite(page, canvas, '1');
        await pressRead(page);
        await lines(1);
        reader.text = right.text;
        await handwrite(page, canvas, '7', { x: 170 });
        await page.waitForTimeout(1500);
        const afterEdit = reader.requests.length - start;
        const staleShown = await page.locator('[data-ink-stale]').isVisible();
        await pressRead(page);
        await lines(1);
        await submitAndSettle();
        const grade = (await gradesOf(right.serverQuestionId)).at(-1);
        costs.editAndReread = reader.requests.length - start;
        await check(`3 · read, edit the ink, read again: 2 provider calls — one per read the student asked for, none for the edit itself [${EVIDENCE}]`,
          afterEdit === 1 && staleShown && costs.editAndReread === 2 && grade?.json?.correct === true,
          `provider calls ${costs.editAndReread} (after the edit, before Read again: ${afterEdit}); stale shown ${staleShown}; correct ${grade?.json?.correct}`);
      }

      // ── 4 · wrong first try, then a second try with the ink unchanged ──────
      {
        const { canvas, right } = await fresh();
        const start = reader.requests.length;
        const wrong = String(Number(right.text) + 3);
        reader.lines = null; reader.text = wrong; reader.confidence = 0.97;
        await handwrite(page, canvas, '17');
        await pressRead(page);
        await lines(1);
        await submitAndSettle();
        const first = (await gradesOf(right.serverQuestionId)).at(-1);
        // Second try: the student says what the line should read (no new ink, no new read).
        await page.locator('.ink-line .ink-correct-btn').first().click();
        await page.locator('.ink-line form.ink-correct input').fill(right.text);
        await page.locator('.ink-line form.ink-correct button[type="submit"]').click();
        await page.waitForFunction(t => document.querySelector('.ink-line[data-corrected="true"]')?.getAttribute('data-text') === t, right.text, { timeout: 10000 }).catch(() => {});
        await submitAndSettle();
        const grades = await gradesOf(right.serverQuestionId);
        costs.secondTrySameInk = reader.requests.length - start;
        await check(`4 · second try after a wrong first try, ink unchanged: still 1 provider call in all — both receipts reuse the kept read [${EVIDENCE}]`,
          first?.json?.correct === false && first.json.resolved === false && grades.length === 2 && grades[1].json?.correct === true && costs.secondTrySameInk === 1 &&
            (await receiptsOf(right.serverQuestionId)).every(r => r.json?.reused === true),
          `provider calls ${costs.secondTrySameInk}; grades ${JSON.stringify(grades.map(g => [g.json?.correct, g.json?.resolved]))}; receipts reused ${JSON.stringify((await receiptsOf(right.serverQuestionId)).map(r => r.json?.reused))}`);
      }

      // ── 5 · wrong first try, then the ink is rewritten ─────────────────────
      {
        const { canvas, right } = await fresh();
        const start = reader.requests.length;
        const wrong = String(Number(right.text) + 4);
        reader.lines = null; reader.text = wrong; reader.confidence = 0.97;
        await handwrite(page, canvas, '71');
        await pressRead(page);
        await lines(1);
        await submitAndSettle();
        await page.locator('.ink-tool[title="Clear"]').click();
        await settle();
        reader.text = right.text;
        await handwrite(page, canvas, '117');
        await page.waitForTimeout(1500);
        const beforeSecondRead = reader.requests.length - start;
        await pressRead(page);
        await lines(1);
        await submitAndSettle();
        const grades = await gradesOf(right.serverQuestionId);
        costs.secondTryRewritten = reader.requests.length - start;
        await check(`5 · second try after rewriting the ink: 2 provider calls — one read per page the student asked to have read [${EVIDENCE}]`,
          beforeSecondRead === 1 && grades.length === 2 && grades[0].json?.correct === false && grades[1].json?.correct === true && costs.secondTryRewritten === 2,
          `provider calls ${costs.secondTryRewritten} (before the second read: ${beforeSecondRead}); grades ${JSON.stringify(grades.map(g => g.json?.correct))}`);
      }

      // ── 6 · an impatient double press on a slow reader; then a second tab ──
      {
        const { canvas, right } = await fresh();
        const start = reader.requests.length, pageStart = (await readCalls()).length;
        reader.lines = null; reader.text = right.text; reader.confidence = 0.97;
        let release; reader.gate = new Promise(resolve => { release = resolve; });
        await handwrite(page, canvas, '7');
        await page.waitForSelector('[data-ink-read]', { timeout: 8000 });
        // Two presses in one task: the second lands before the page has re-rendered.
        await page.evaluate(() => { const b = document.querySelector('[data-ink-read]'); b.click(); b.click(); });
        await page.waitForTimeout(1200);
        // (A page request is counted when its reply lands, so the page's own count is taken after the read.)
        const whileSlow = { provider: reader.requests.length - start, button: await page.locator('[data-ink-read]').count() };
        release(); reader.gate = null;
        await lines(1);
        await page.waitForTimeout(2500);              // the transcript's own save and readback
        const afterRead = reader.requests.length - start;
        const pageRequests = (await readCalls()).length - pageStart;
        // The same account opens the same question in a second tab: the kept
        // page comes back with its transcript, and nothing is read for it.
        const tab = await page.context().newPage();
        let tabLines = [], tabQuestion = null;
        try {
          await tab.goto(page.url(), { waitUntil: 'domcontentloaded' });
          await tab.waitForSelector('.ink-line', { timeout: 30000 }).catch(() => {});
          tabLines = await tab.locator('.ink-line').evaluateAll(nodes => nodes.map(n => n.getAttribute('data-text') || ''));
          tabQuestion = await tab.locator('.qpage').first().getAttribute('data-question-id').catch(() => null);
          await tab.waitForTimeout(1500);
        } finally { await tab.close(); }
        const afterTab = reader.requests.length - start;
        const sameQuestion = tabQuestion === await page.locator('.qpage').first().getAttribute('data-question-id');
        await submitAndSettle();
        const grade = (await gradesOf(right.serverQuestionId)).at(-1);
        costs.doublePress = reader.requests.length - start;
        await check(`6 · a double press on a slow reader, then the same page in a second tab: 1 provider call in all — one page request for two presses, none for the second tab, none for Submit [${EVIDENCE}]`,
          whileSlow.provider === 1 && whileSlow.button === 0 && afterRead === 1 && pageRequests === 1 &&
            sameQuestion && tabLines.length === 1 && tabLines[0] === right.text && afterTab === 1 &&
            costs.doublePress === 1 && grade?.json?.correct === true,
          `while the reader was slow ${JSON.stringify(whileSlow)}; after the read ${afterRead} provider, ${pageRequests} page request(s); second tab same question ${sameQuestion} lines ${JSON.stringify(tabLines)} calls ${afterTab}; total ${costs.doublePress}; correct ${grade?.json?.correct}`);
      }

      // ── 7 · a late reading never replaces newer ink or a hand-corrected line ─
      {
        const { canvas, right } = await fresh();
        const start = reader.requests.length;
        const misread = String(Number(right.text) + 6);
        reader.lines = null; reader.text = misread; reader.confidence = 0.97;
        await handwrite(page, canvas, '1');
        await pressRead(page);
        await lines(1);
        // More ink, "Read again" — and the reader is slow about it.
        await handwrite(page, canvas, '7', { x: 170 });
        reader.text = '999';
        let release; reader.gate = new Promise(resolve => { release = resolve; });
        await pressRead(page);
        await page.waitForTimeout(800);
        // While it is in flight the student takes the new ink back (the page is
        // the one already read) and says what its line should read.
        for (let i = 0; i < 6 && await page.locator('[data-ink-stale]').count(); i++) {
          await page.locator('.ink-tool[title="Undo"]').click();
          await page.waitForTimeout(250);
        }
        const currentAgain = await page.locator('[data-ink-stale]').count() === 0 && (await page.locator('.ink-line').first().getAttribute('data-text')) === misread;
        await page.locator('.ink-line .ink-correct-btn').first().click();
        await page.locator('.ink-line form.ink-correct input').fill(right.text);
        await page.locator('.ink-line form.ink-correct button[type="submit"]').click();
        await page.waitForFunction(t => document.querySelector('.ink-line[data-corrected="true"]')?.getAttribute('data-text') === t, right.text, { timeout: 10000 }).catch(() => {});
        const inFlight = reader.requests.length - start;
        release(); reader.gate = null;
        await page.waitForTimeout(2500);              // the late reading lands
        const after = {
          lines: await page.locator('.ink-line').evaluateAll(nodes => nodes.map(n => [n.getAttribute('data-text'), n.getAttribute('data-corrected')])),
          stale: await page.locator('[data-ink-stale]').count()
        };
        await submitAndSettle();
        const grade = (await gradesOf(right.serverQuestionId)).at(-1);
        costs.lateReading = reader.requests.length - start;
        await check(`7 · a slow reading of ink the student has since taken back lands on a page whose transcript they corrected by hand: the correction stands, nothing is marked stale, and it is what Submit marks — 2 provider calls, both asked for [${EVIDENCE}]`,
          currentAgain && inFlight === 2 && after.lines.length === 1 && after.lines[0][0] === right.text && after.lines[0][1] === 'true' && after.stale === 0 &&
            costs.lateReading === 2 && grade?.json?.correct === true,
          `current again after undo ${currentAgain}; in flight ${inFlight}; after the late reading ${JSON.stringify(after)}; total ${costs.lateReading}; correct ${grade?.json?.correct}`);
      }

      // ── 8 · the late reading of an EARLIER page never becomes the answer ───
      {
        const { canvas, right } = await fresh();
        const start = reader.requests.length;
        reader.lines = null; reader.text = '1'; reader.confidence = 0.97;
        let release; reader.gate = new Promise(resolve => { release = resolve; });
        await handwrite(page, canvas, '1');
        await pressRead(page);
        await page.waitForTimeout(600);
        await handwrite(page, canvas, '7', { x: 170 });   // written while the first page is being read
        release(); reader.gate = null;
        await page.waitForSelector('[data-ink-stale]', { timeout: 15000 }).catch(() => {});
        const late = {
          stale: await page.locator('[data-ink-stale]').count(),
          submitDisabled: await page.getByRole('button', SUBMIT).isDisabled().catch(() => null),
          reason: await page.locator('[data-submit-reason]').getAttribute('data-submit-reason').catch(() => null),
          grades: (await gradesOf(right.serverQuestionId)).length
        };
        reader.text = right.text;
        await pressRead(page);
        await lines(1);
        await submitAndSettle();
        const grade = (await gradesOf(right.serverQuestionId)).at(-1);
        costs.wroteWhileReading = reader.requests.length - start;
        await check(`8 · ink written while an earlier page was being read: that reading arrives labelled as from earlier writing, Submit is unavailable with the reason, nothing is marked; "Read again" reads the page as it stands — 2 provider calls [${EVIDENCE}]`,
          late.stale === 1 && late.submitDisabled === true && late.reason === 'ink.submitReadAgain' && late.grades === 0 &&
            costs.wroteWhileReading === 2 && grade?.json?.correct === true,
          `when the late reading landed ${JSON.stringify(late)}; total ${costs.wroteWhileReading}; correct ${grade?.json?.correct}`);
      }
      note(`provider calls per completed handwritten answer [${EVIDENCE}]: one line right first time ${costs.oneLine} · four lines with pauses, read once ${costs.fourLines} · read, edit, read again ${costs.editAndReread} · second try, ink unchanged ${costs.secondTrySameInk} · second try after rewriting ${costs.secondTryRewritten} · double press then a second tab ${costs.doublePress} · late reading against a corrected transcript ${costs.lateReading} · ink written while reading ${costs.wroteWhileReading}`);
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
