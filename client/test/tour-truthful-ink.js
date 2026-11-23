// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · E2E flow — a marked handwritten attempt says only what is true.
//
// Two defects were seen on staging with the real handwriting reader:
//
//   A · "224" was read as three lines (2, 2, +). The student typed the answer
//       into Final answer and confirmed; the server gave full marks. The card
//       then said every line of the working had been "read and verified",
//       ticked the "+" ("Line 3 checks out"), and showed "Your answer: +".
//   B · After a wrong answer, the previous attempt's "Look here" marker, the
//       "Not quite" card and the per-line cross stayed attached to newly
//       written ink that had never been submitted.
//
// This flow drives both through the real canvas and the real platform server
// (support/online-session.mjs): every mark, step report and receipt is the
// server's. The ONE synthetic part is the reader's provider hop, a scripted
// stand-in that returns the lines this flow sets and never looks at the
// picture. It is not real-handwriting, real-reader or real-device evidence.
//
// Run on its own:  node client/test/tour-truthful-ink.js
//
// ── ONE PRESS (owner decision, 19 Nov 2026: the reading is not shown; one press marks the working on the student's own page) ──
// The page is read silently once the pen rests; "Mark my working" is the one press. CTO ruling: for handwritten working the
// first press is the ONE authoritative attempt (right or wrong, resolved at once, the full marked page shown); there is no
// "Not quite, one more go" for written working, and Redo is the same question again. Typed answers keep two tries.
// ─────────────────────────────────────────────────────────────────────────────
import { pathToFileURL } from 'node:url';
import { handwrite, markWorking, readingIsNotShown, turnOnServerReading } from './fakeServerReader.js';
import { SYNTHETIC_EVIDENCE } from './support/online-session.mjs';
import { inkLineVerdicts, workingEvidence, workingEvidenceCopy } from '../src/components/attemptEvidence.js';
import EN from '../src/i18n/strings.en.js';

const TOPIC = 'c7-finding-unknown-current';
// Plain arithmetic: the server has no step meta for these, so it can check the
// final answer and nothing else — the conditions of the staging report.
const ARITHMETIC = 'c7-integer-operations-current';
// A method the server CAN check: it needs step meta (an "x =" answer). No
// Class 7 India form carries one ("Solve $2x=12$." has no answer prefix), so
// the checked-method case uses the Class 10 pair of linear equations, whose
// D1/D2 forms ask for x (or y) by name.
const STEP_CHECKED = 'c10-linear-pair-methods';
const WHOLE = /^-?\d{1,4}$/;
// After a reading the primary button is the combined "Mark my working" (P0 #11); before one it is "Submit Answer".
const SUBMIT = { name: /^(Submit answer|Mark my working)/i };
const TAG = '[SYNTHETIC-READER EVIDENCE]';
const flat = s => String(s || '').replace(/\s+/g, ' ').trim();
const english = (key, vars = {}) => {
  const entry = EN[key];
  const template = typeof entry === 'string' ? entry : (Number(vars.count) === 1 ? entry.one : entry.other);
  return template.replace(/\{(\w+)\}/g, (whole, name) => (name in vars ? String(vars[name]) : whole));
};
// Everything a student — sighted or using a screen reader — is told on the card.
const INFERRED = /Every line of your handwritten working|read and verified|logical chain/i;

export const flow = {
  id: 'truthful-ink',
  name: 'Ink · a marked attempt says only what the server established',
  online: true,

  async run({ page, base, check, note, goto, createProfile, settle, online }) {
    const reader = online.reader;
    Object.assign(reader, { text: '1', lines: null, confidence: 0.97, down: false, gate: null });
    reader.requests.length = 0;
    note(`${SYNTHETIC_EVIDENCE}: the handwriting reader in "${flow.name}" is a scripted stand-in (it returns the lines this flow sets). The canvas, the server routes, the step reports, the receipts and every mark are real. Not real-handwriting, real-provider, real-device or real-student evidence.`);
    await goto('/');
    await createProfile({ name: 'Maryam Mirza', year: 7 });
    await online.signIn({ name: 'Maryam Mirza' });
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await check('server reading is on for this signed-in profile', await turnOnServerReading(page, base));

    const card = page.locator('.qpage').first();
    const cardText = async () => flat(await card.evaluate(el => el.textContent));
    const marksOnInk = () => page.locator('.ink-verdict, .ink-linebox, .ink-underline, .ink-note, .ink-line-verdict').count();
    const ticksOnInk = () => page.locator('.ink-line-verdict.good').count();
    const crossesOnInk = () => page.locator('.ink-line-verdict.bad').count();
    const lookHere = () => page.locator('.ink-comment.bad').count();
    const spoken = async () => flat(await page.locator('.qpage [role="status"][aria-atomic="true"]').first().textContent().catch(() => ''));
    const gradesOf = async id => (await online.practiceCalls(new RegExp(`^/v1/practice/${id}/submit$`)));
    // The one dominant action. A reading the reader's own shape check doubts
    // (a lone "+") turns the press into "Check this reading first", and the
    // student's "Confirm reading" is then the submit — as on staging.
    const primary = page.locator('.ws-actions .btn-primary').last();
    const submitNow = async () => {
      // The doubted reading asks "which did you write?": the student's tap on
      // "That's what I wrote" resolves it, and Mark my working is then the submit.
      const ask = page.locator('[data-confirm-keep]').first();
      if (await ask.count()) {
        await ask.click();
        await page.getByRole('button', SUBMIT).click();
        return 'confirmed';
      }
      await page.getByRole('button', SUBMIT).click();
      return 'submitted';
    };
    const waitVerdict = () => page.waitForSelector('.eval-card, .verdict[data-verdict-of]', { timeout: 30000 }).catch(() => {});

    // A navigation that cuts a background request short is reported by WebKit
    // as a page error; the flow leaves a page only once its network is quiet.
    const quiet = () => page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    // A slow server: the grade request for this question is held on the page
    // until the flow lets it go, and the flow knows the request really was
    // waiting (engine-independent — it does not rely on network interception).
    const hold = path => page.evaluate(fragment => {
      const real = window.__priRealFetch || window.fetch.bind(window);
      window.__priRealFetch = real;
      let open; const gate = new Promise(done => { open = done; });
      window.__priHeld = 0;
      window.__priRelease = () => { window.fetch = real; open(); return window.__priHeld; };
      window.fetch = async (input, init) => {
        const url = String(typeof input === 'string' ? input : input?.url || '');
        if (new RegExp(fragment).test(url)) { window.__priHeld += 1; await gate; }
        return real(input, init);
      };
    }, path);
    const holdGrades = id => hold(`/v1/practice/${id}/submit$`);
    const holdReads = () => hold('/v1/(handwriting/transcribe|practice/[^/]+/recognize)$');
    const heldGrades = () => page.evaluate(() => window.__priHeld || 0);
    const releaseGrades = () => page.evaluate(() => window.__priRelease());
    /** A fresh, untried numeric question, in handwriting mode. */
    const openFresh = async ({ want = () => true, tries = 6, topic = TOPIC } = {}) => {
      await quiet();
      // The integers chapter at D3 is mostly multiple choice; held at D2, where every form is written.
      // The step-verification assertion needs the Class 10 D1 x= form.
      // Choosing its actual student-facing difficulty prevents a random scan
      // through unrelated forms from consuming the free question allowance.
      const difficulty = topic === ARITHMETIC ? '&difficulty=2' : topic === STEP_CHECKED ? '&difficulty=1' : '';
      await page.goto(`${base}/practice?subtopic=${topic}${difficulty}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.q-prompt', { timeout: 30000 });
      await settle();
      for (let moved = 0; moved < tries; moved++) {
        const row = await online.shownRow();
        const tried = row?.serverQuestionId ? await gradesOf(row.serverQuestionId) : [];
        const right = tried.length ? null : await online.answerOf().catch(() => null);
        if (right && right.answerType === 'numeric' && WHOLE.test(String(right.text)) && want(right, row)) {
          const tab = page.getByRole('button', { name: 'Answer by handwriting' });
          if (await tab.count()) await tab.click();
          await page.waitForSelector('.ink-canvas-live', { timeout: 30000 });
          return { right, row, box: await page.locator('.ink-canvas-live').boundingBox() };
        }
        const leaving = await card.getAttribute('data-question-id');
        await page.locator('.ctx-next').click();
        await page.waitForFunction(id => {
          const el = document.querySelector('.qpage[data-question-id]');
          return el && el.getAttribute('data-question-id') !== id && el.querySelector('.q-prompt');
        }, leaving, { timeout: 30000 });
        await settle();
      }
      return null;
    };
    /** Write, let the page rest so it is read silently, and check nothing of the reading is on screen. */
    const writeAndRead = async (box, glyphs, lines, { x = 40 } = {}) => {
      online.forgetKeptReads();           // re-scripted stand-in: a different reader now (desk only)
      reader.lines = lines.map(text => ({ text }));
      const before = reader.requests.length;
      await handwrite(page, box, glyphs, { x });
      for (let i = 0; i < 40 && reader.requests.length === before; i++) await page.waitForTimeout(150);
      await page.waitForTimeout(500);
      return (await readingIsNotShown(page, lines.filter(l => l.length >= 3))).structure.length === 0 ? lines : null;
    };
    /** One press of "Mark my working"; waits for the marked page, the result card, or the final-answer sentence. */
    const markNow = async () => {
      await markWorking(page);
      await page.waitForSelector('[data-marked-page], .eval-card, [data-final-answer-sentence]', { timeout: 30000 }).catch(() => {});
    };
    /** What the card must say about the working, from the server's own reply. */
    const expectedFrom = (json, submitted) => {
      const evidence = workingEvidence({ res: json, submitted });
      const copy = workingEvidenceCopy(evidence, { correct: json.correct === true });
      const verdicts = inkLineVerdicts({ outcome: json.correct ? 'resolved-correct' : 'resolved-wrong', res: json, submitted, shownLines: submitted.lines });
      return { evidence, text: copy ? english(copy.key, copy.vars) : null,
        ticks: (verdicts || []).filter(v => v.status === 'ok').length,
        crosses: (verdicts || []).filter(v => v.status === 'break' || v.status === 'wrong').length };
    };

    // ══ A · the staging case: 2 / 2 / + read; the final line is not an answer ═══
    {
      // (An answer of exactly 2 would make a misread "2" a true line.)
      const made = await openFresh({ topic: ARITHMETIC, want: right => String(right.text) !== '2' });
      if (await check('staging case: a numeric question is on the card and its answer is known only at the desk', !!made)) {
        const { right, box } = made;
        const misread = ['2', '2', '+'];
        const wrote = await writeAndRead(box, '22', misread);
        await check(`staging case: the reader misreads the page as three lines — 2, 2, + — and none of it is on screen before marking ${TAG}`, !!wrote && reader.requests.length >= 1);
        await markNow();
        const grades0 = await gradesOf(right.serverQuestionId);
        // The shape check on the last line ("+" is no answer): the one sentence and one box, nothing sent, no verdict, no try spent.
        const asked = await page.locator('[data-final-answer-sentence]').count() === 1 && await page.locator('[data-ink-final-answer]').count() === 1;
        await check('staging case: no answer is guessed from the misread lines: the one sentence and the Final answer box are shown, nothing was sent and nothing is marked',
          asked && grades0.length === 0 && await page.locator('[data-marked-page], .eval-card').count() === 0,
          `asked ${asked}; marks ${grades0.length}; ` + (await page.locator('[data-marked-page], .eval-card').count()) + ' result(s) on screen');
        if (asked) await page.locator('[data-ink-final-answer]').fill(right.text);
        await markWorking(page);
        await page.waitForSelector('[data-marked-page], .eval-card', { timeout: 30000 }).catch(() => {});
        const grade = (await gradesOf(right.serverQuestionId)).at(-1);
        await check('staging case: the server marks the TYPED answer (said to be typed), and awards every mark',
          grade?.body?.answer === right.text && grade.body.answerTyped === true && grade.json?.authoritative === true &&
            grade.json.correct === true && grade.json.resolved === true && grade.json.marksEarned === grade.json.marksPossible,
          JSON.stringify({ sent: grade?.body?.answer, typed: grade?.body?.answerTyped, steps: grade?.body?.steps, correct: grade?.json?.correct, marks: [grade?.json?.marksEarned, grade?.json?.marksPossible] }));
        const submitted = { answer: right.text, lines: misread, viaInk: true, sourceMode: 'ink', hasWorking: true };
        const want = expectedFrom(grade?.json || {}, submitted);
        const text = await cardText();
        const said = flat(await page.locator('[data-working-evidence]').textContent().catch(() => ''));
        await check('staging case: the card does NOT say the working was checked, read and verified, or that it reached the result through a logical chain',
          !INFERRED.test(text) && !/checks out/i.test(text), text.match(INFERRED)?.[0] || text.match(/[^.]*checks out[^.]*/i)?.[0] || '');
        await check('staging case: whatever the card says about the working is exactly what the server established (nothing when the working was not verified), and no line of the misread transcript is ticked',
          (said === '' || said === (want.text || '')) && await ticksOnInk() === 0 && await page.locator('[data-mp-card][data-mp-status="checked"]').count() === (grade?.json?.stepReport?.lines || []).filter(l => l.status === 'ok').length && !/Line 3 checks out/.test(text),
          `card: ${JSON.stringify(said)}; server evidence: ${JSON.stringify(want.evidence)}; server stepReport: ${JSON.stringify(grade?.json?.stepReport)}`);
        await check(`staging case: "Your answer" is never the last ink line "+"`, !/Your answer:\s*\+/.test(text), text.slice(0, 200));

        // History, and History again after a reload: the same truthful values.
        const historyShows = async () => {
          await quiet();
          await page.goto(`${base}/history`, { waitUntil: 'domcontentloaded' });
          await page.waitForSelector('.hist-row', { timeout: 30000 });
          await page.locator('.hist-row .hist-main').first().click();
          await page.waitForSelector('.hist-detail', { timeout: 20000 }).catch(() => {});
          return flat(await page.locator('.hist-detail').first().textContent().catch(() => ''));
        };
        const once = await historyShows();
        await check(`staging case, History: the attempt is kept with "Your answer: ${right.text}", never "+", and nothing is claimed as verified`,
          once.includes(`Your answer: ${right.text}`) && !/Your answer:\s*\+/.test(once) && !INFERRED.test(once), once.slice(0, 260));
        await quiet();
        await page.reload({ waitUntil: 'domcontentloaded' });
        const again = await historyShows();
        await check('staging case, History after a reload: the same answer is replayed',
          again.includes(`Your answer: ${right.text}`) && !/Your answer:\s*\+/.test(again), again.slice(0, 260));
      }
    }

    // ══ A · a method the server DID check: said from its step report ══════════
    {
      const made = await openFresh({ topic: STEP_CHECKED, tries: 16, want: right => /^[a-z]\s*=$/i.test(String(right.answerPrefix || '')) });
      if (await check('checked method: a numeric question is on the card', !!made)) {
        const { right, box } = made;
        const lines = [String(right.text), String(right.text)];
        const wrote = await writeAndRead(box, '11', lines);
        await check(`checked method: two lines are written and read silently, the last one the answer as written ${TAG}`, !!wrote);
        await markNow();
        const grade = (await gradesOf(right.serverQuestionId)).at(-1);
        const submitted = { answer: String(right.text), lines, viaInk: true, sourceMode: 'ink', hasWorking: true };
        const want = expectedFrom(grade?.json || {}, submitted);
        const said = flat(await page.locator('[data-working-evidence]').textContent().catch(() => ''));
        note(`checked method: server stepReport ${JSON.stringify(grade?.json?.stepReport?.lines?.map(l => l.status) || null)} → evidence ${JSON.stringify(want.evidence)} → "${said}"`);
        await check('checked method: the server marks it correct', grade?.json?.correct === true && grade.json.resolved === true, JSON.stringify(grade?.json?.correct));
        await check('checked method: the server\'s step report says both submitted lines hold; the card claims nothing the report does not say — never "verified", never a logical chain',
          !INFERRED.test(await cardText()) && grade.json.stepReport.lines.length === 2 && grade.json.stepReport.lines.every(l => l.status === 'ok') &&
            (said === '' || said === want.text),
          `card ${JSON.stringify(said)}; expected ${JSON.stringify(want.text)}; report ${JSON.stringify(grade?.json?.stepReport)}`);
        await check('checked method: the lines shown as checked on the marked page are the server\'s "ok" lines, no others',
          await page.locator('[data-mp-card][data-mp-status="checked"]').count() === grade.json.stepReport.lines.filter(l => l.status === 'ok').length && await page.locator('[data-mp-card][data-mp-status="first-error"]').count() === 0,
          `${await page.locator('[data-mp-card][data-mp-status="checked"]').count()} checked on the page; ${await page.locator('[data-mp-card][data-mp-status="first-error"]').count()} first error(s)`);
      }
    }

    // ══ A · wrong final answer over working: nothing positive is inferred ═════
    {
      const made = await openFresh();
      if (await check('wrong final: a numeric question is on the card', !!made)) {
        const { right, box } = made;
        const wrong = String(Number(right.text) + 1);
        const lines = [String(right.text), wrong];
        await writeAndRead(box, '17', lines);
        await markNow();
        const only = await gradesOf(right.serverQuestionId);
        const first = only.at(-1);
        // CTO ruling, 19 Nov 2026: written working is ONE authoritative attempt; the first wrong press resolves it.
        await check('wrong final, one press: marked once, incorrect and RESOLVED by the server (no "one more go" for written working), never full marks',
          only.length === 1 && first?.json?.correct === false && first.json.resolved === true && first.json.marksEarned < first.json.marksPossible &&
            await page.locator('.verdict-bad').count() === 0 && !/one more go/i.test(await cardText()),
          JSON.stringify({ n: only.length, r: first?.json?.resolved, marks: [first?.json?.marksEarned, first?.json?.marksPossible] }));
        const want = expectedFrom(first?.json || {}, { answer: wrong, lines, viaInk: true, sourceMode: 'ink', hasWorking: true });
        const said = flat(await page.locator('[data-working-evidence]').textContent().catch(() => ''));
        note(`wrong final: server stepReport ${JSON.stringify(first?.json?.stepReport?.lines?.map(l => l.status) || null)}; partial ${JSON.stringify(first?.json?.partial && { awarded: first.json.partial.awarded })} → "${said}"`);
        const okLines = (first?.json?.stepReport?.lines || []).filter(l => l.status === 'ok').length;
        await check('wrong final: the working sentence and the lines shown as checked are exactly the server\'s evidence, and no line is ticked that the server did not establish',
          (said === '' || said === (want.text || '')) && await page.locator('[data-mp-card][data-mp-status="checked"]').count() === okLines && !INFERRED.test(await cardText()),
          `card ${JSON.stringify(said)} vs ${JSON.stringify(want.text)}; checked ${await page.locator('[data-mp-card][data-mp-status="checked"]').count()} vs ${okLines}`);

        // Redo = the same question again, no new credit: nothing of the attempt stays on the new page.
        const before = await card.getAttribute('data-question-id');
        await page.getByRole('button', { name: 'Redo question' }).click();
        await page.waitForFunction(id => { const el = document.querySelector('.qpage[data-question-id]'); return el && el.getAttribute('data-question-id') !== id && !!el.querySelector('.q-prompt') && !document.querySelector('[data-marked-page], .eval-card'); }, before, { timeout: 30000 });
        await page.getByRole('button', { name: 'Answer by handwriting' }).click().catch(() => {});
        await page.waitForSelector('.ink-canvas-live', { timeout: 30000 });
        await check('wrong final, Redo: the same question again carries no mark, no cross, no "Look here" and no earlier verdict from the attempt that was marked',
          await marksOnInk() === 0 && await lookHere() === 0 && await page.locator('.verdict, .eval-card, [data-marked-page]').count() === 0);
      }
    }

    // ══ B · a new page after a wrong one: nothing is pinned on unsubmitted work, a slow grade shows nothing early ═
    {
      const made = await openFresh();
      if (await check('rewrite: a numeric question is on the card', !!made)) {
        const { right, box } = made;
        const wrong = String(Number(right.text) + 1);
        await writeAndRead(box, '1', [wrong]);
        await markNow();
        const firstGrades = await gradesOf(right.serverQuestionId);
        await check('rewrite: a wrong handwritten answer is marked on the page it was written on, once, and resolved',
          firstGrades.length === 1 && firstGrades[0].json?.resolved === true && firstGrades[0].json?.correct === false);
        const before = await card.getAttribute('data-question-id');
        await page.getByRole('button', { name: 'Redo question' }).click();
        await page.waitForFunction(id => { const el = document.querySelector('.qpage[data-question-id]'); return el && el.getAttribute('data-question-id') !== id && !!el.querySelector('.q-prompt') && !document.querySelector('[data-marked-page], .eval-card'); }, before, { timeout: 30000 });
        await page.getByRole('button', { name: 'Answer by handwriting' }).click().catch(() => {});
        await page.waitForSelector('.ink-canvas-live', { timeout: 30000 });
        const redoBox = await page.locator('.ink-canvas-live').boundingBox();
        const callsBefore = (await online.practiceCalls(/^\/v1\/practice\/[^/]+\/submit$/)).length;
        online.forgetKeptReads();
        reader.lines = [{ text: String(right.text) }];
        await handwrite(page, redoBox, '7', { x: 150 });
        await page.waitForTimeout(3200);
        await check('rewrite: writing the page again sends nothing to be marked, and nothing of the earlier attempt is pinned on it',
          (await online.practiceCalls(/^\/v1\/practice\/[^/]+\/submit$/)).length === callsBefore && await lookHere() === 0 && await marksOnInk() === 0 && await page.locator('.verdict-bad').count() === 0);
        // A SLOW grade of it: no verdict is shown until the server's reply for THIS page.
        await hold('/v1/practice/[^/]+/submit$');
        await markWorking(page);
        await page.waitForTimeout(1500);
        await check('rewrite, slow grade in flight: no result is shown for the new page yet, and no old annotation comes back',
          await heldGrades() === 1 && await page.locator('.eval-card, [data-marked-page]').count() === 0 && await lookHere() === 0 && await marksOnInk() === 0 && await page.locator('.verdict-bad').count() === 0,
          `${await page.locator('.eval-card, [data-marked-page]').count()} verdict(s); ${await marksOnInk()} mark(s); ${await heldGrades()} grade request(s) waiting`);
        await releaseGrades();
        await page.waitForSelector('.eval-card, [data-marked-page]', { timeout: 30000 }).catch(() => {});
        const last = (await online.practiceCalls(/^\/v1\/practice\/[^/]+\/submit$/)).at(-1);
        await check('rewrite: the new page is graded on its own submission and only then annotated — correct, no cross',
          (await online.practiceCalls(/^\/v1\/practice\/[^/]+\/submit$/)).length === callsBefore + 1 && last?.json?.correct === true && last.json?.resolved === true && await crossesOnInk() === 0 && await lookHere() === 0,
          JSON.stringify({ sent: last?.body?.answer, correct: last?.json?.correct }));
      }
    }

    // ══ B · a late grade for an OLDER revision is not pinned on newer work (typed: two tries) ════
    {
      const made = await openFresh();
      if (await check('late grade: a numeric question is on the card', !!made)) {
        const { right } = made;
        const wrong = String(Number(right.text) + 1);
        await page.getByRole('button', { name: 'Answer by typing' }).click();
        const answerBox = page.locator('.editor-body input.answer-input').first();
        await answerBox.fill(wrong);
        await holdGrades(right.serverQuestionId);
        await submitNow();
        await page.waitForTimeout(700);
        // The student corrects the answer while the old one is still being marked.
        const editable = await answerBox.isEditable();
        if (editable) await answerBox.fill(String(right.text));
        // The old answer's grade request was still waiting when the edit was made.
        const waiting = await heldGrades();
        const shownBefore = await page.locator('.verdict[data-verdict-of], .eval-card').count();
        await releaseGrades();
        await page.waitForSelector('.verdict[data-verdict-of]', { timeout: 30000 }).catch(() => {});
        const late = (await gradesOf(right.serverQuestionId)).at(-1);
        await check('late grade: the reply that arrives AFTER the correction is the server\'s verdict on the OLD answer',
          waiting === 1 && shownBefore === 0 && late?.body?.answer === wrong && late.json?.correct === false && late.json.resolved === false,
          JSON.stringify({ waiting, shownBefore, sent: late?.body?.answer, correct: late?.json?.correct }));
        await check('late grade: with the answer already corrected, that verdict is shown as the previous attempt\'s — never as "Not quite" on the new, unsubmitted answer',
          editable && await answerBox.inputValue() === String(right.text) &&
            await page.locator('.verdict[data-verdict-of="previous-attempt"]').count() === 1 && await page.locator('.verdict-bad').count() === 0 &&
            flat(await page.locator('.verdict[data-verdict-of="previous-attempt"] .verdict-body').textContent().catch(() => '')) === 'This page has not been checked yet. Your last attempt was not correct.',
          `editable in flight: ${editable}; field ${JSON.stringify(await answerBox.inputValue())}; cards ${await page.locator('.verdict').count()}`);
        await submitNow();
        await page.waitForSelector('.eval-card', { timeout: 30000 }).catch(() => {});
        const final = (await gradesOf(right.serverQuestionId)).at(-1);
        await check('late grade: the corrected answer is then graded as its own submission, and marked correct',
          final?.body?.answer === String(right.text) && final.json?.correct === true && await page.locator('.eval-card[data-outcome="correct"]').count() === 1);
      }
    }

    // ══ B · input-mode change, clear pad, restored ink, refresh (nothing is marked yet) ═══
    {
      const made = await openFresh();
      if (await check('mode change: a numeric question is on the card', !!made)) {
        const { right, box } = made;
        const wrong = String(Number(right.text) + 1);
        await writeAndRead(box, '1', [wrong]);
        await page.getByRole('button', { name: 'Answer by typing' }).click();
        await settle();
        await check('mode change → Type: nothing was marked, and the empty typed field carries no verdict',
          (await gradesOf(right.serverQuestionId)).length === 0 && await page.locator('.verdict, .verdict-bad, .eval-card, [data-marked-page]').count() === 0 && await lookHere() === 0);
        await page.getByRole('button', { name: 'Answer by handwriting' }).click();
        await page.waitForSelector('.ink-canvas-live', { timeout: 30000 });
        await settle();
        const hiddenBack = await readingIsNotShown(page, []);
        await check('mode change → back to Write: the ink is restored, ready to mark, with no annotation and no reading shown',
          await page.getByRole('button', { name: /^Mark my working/ }).isEnabled() && hiddenBack.structure.length === 0 && await marksOnInk() === 0 && await lookHere() === 0,
          JSON.stringify(hiddenBack));
        await page.locator('.ink-tool[title="Clear"]').click();
        await settle();
        await check('clear pad: an empty page has nothing to mark and carries no annotation',
          await marksOnInk() === 0 && await lookHere() === 0 && await page.locator('.verdict-bad').count() === 0 && await page.getByRole('button', { name: /^Mark my working/ }).isDisabled().catch(() => true));
      }
    }
    {
      const made = await openFresh();
      if (await check('clear and refresh: a numeric question is on the card', !!made)) {
        const { right, box } = made;
        const wrong = String(Number(right.text) + 1);
        await writeAndRead(box, '1', [wrong]);
        await page.locator('.ink-tool[title="Clear"]').click();
        await settle();
        // Write the right answer, let it rest, and reload before marking.
        await writeAndRead(box, '7', [String(right.text)]);
        await page.waitForFunction(() => document.querySelector('.ws-actions .status-line')?.getAttribute('data-state') === 'saved', null, { timeout: 10000 }).catch(() => {});
        await quiet();
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.ink-canvas-live', { timeout: 30000 });
        await page.waitForTimeout(1500);
        await check('refresh: the restored, unmarked ink comes back with no annotation of any kind — no card, no cross, no "Look here" — and is ready to mark',
          await marksOnInk() === 0 && await lookHere() === 0 && await page.locator('.verdict').count() === 0 && await page.locator('.eval-card').count() === 0 &&
            await card.getAttribute('data-phase') === 'answering' && await page.getByRole('button', { name: /^Mark my working/ }).isEnabled(),
          `marks ${await marksOnInk()}; phase ${await card.getAttribute('data-phase')}`);
        await markNow();
        const grades = await gradesOf(right.serverQuestionId);
        await check('after refresh: one press is graded on its own and marked correct, and it is the only attempt on the server\'s record',
          grades.length === 1 && grades[0].json?.correct === true && grades[0].json.resolved === true &&
            await page.locator('[data-marked-page], .eval-card[data-outcome="correct"]').count() >= 1 && await crossesOnInk() === 0,
          JSON.stringify(grades.map(g => [g.body?.answer, g.json?.correct])));
      }
    }
    Object.assign(reader, { lines: null, confidence: null, gate: null });
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
