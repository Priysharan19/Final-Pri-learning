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
// ─────────────────────────────────────────────────────────────────────────────
import { pathToFileURL } from 'node:url';
import { handwrite, pressRead, readLines, turnOnServerReading } from './fakeServerReader.js';
import { SYNTHETIC_EVIDENCE } from './support/online-session.mjs';
import { inkLineVerdicts, workingEvidence, workingEvidenceCopy } from '../src/components/attemptEvidence.js';
import EN from '../src/i18n/strings.en.js';

const TOPIC = 'y7-equations';
// Plain arithmetic: the server has no step meta for these, so it can check the
// final answer and nothing else — the conditions of the staging report.
const ARITHMETIC = 'y7-integers';
const WHOLE = /^-?\d{1,4}$/;
const SUBMIT = { name: 'Submit Answer' };
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
      const ask = page.getByRole('button', { name: 'Check this reading first' });
      if (await ask.count()) {
        await ask.click();
        await page.getByRole('button', { name: 'Confirm reading' }).click();
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
    const holdGrades = id => page.evaluate(path => {
      const real = window.fetch.bind(window);
      let open; const gate = new Promise(done => { open = done; });
      window.__priHeldGrades = 0;
      window.__priReleaseGrades = () => { window.fetch = real; open(); return window.__priHeldGrades; };
      window.fetch = async (input, init) => {
        const url = String(typeof input === 'string' ? input : input?.url || '');
        if (url.includes(path)) { window.__priHeldGrades += 1; await gate; }
        return real(input, init);
      };
    }, `/v1/practice/${id}/submit`);
    const heldGrades = () => page.evaluate(() => window.__priHeldGrades || 0);
    const releaseGrades = () => page.evaluate(() => window.__priReleaseGrades());
    /** A fresh, untried numeric question, in handwriting mode. */
    const openFresh = async ({ want = () => true, tries = 6, topic = TOPIC } = {}) => {
      await quiet();
      await page.goto(`${base}/practice?subtopic=${topic}`, { waitUntil: 'domcontentloaded' });
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
    /** Write, ask for the read, and wait for the scripted lines. */
    const writeAndRead = async (box, glyphs, lines, { x = 40 } = {}) => {
      online.forgetKeptReads();           // re-scripted stand-in: a different reader now (desk only)
      reader.lines = lines.map(text => ({ text }));
      await handwrite(page, box, glyphs, { x });
      await pressRead(page);
      await page.waitForFunction(want => {
        const got = [...document.querySelectorAll('.ink-line')].map(n => n.getAttribute('data-text') || '');
        return JSON.stringify(got) === want && !document.querySelector('[data-ink-stale]');
      }, JSON.stringify(lines), { timeout: 20000 }).catch(() => {});
      return readLines(page);
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

    // ══ A · the staging case: 2 / 2 / + read, the answer typed and confirmed ══
    {
      // (An answer of exactly 2 would make a misread "2" a true line.)
      const made = await openFresh({ topic: ARITHMETIC, want: right => String(right.text) !== '2' });
      if (await check('staging case: a numeric question is on the card and its answer is known only at the desk', !!made)) {
        const { right, box } = made;
        const misread = ['2', '2', '+'];
        const shown = await writeAndRead(box, '22', misread);
        await check(`staging case: the reader misreads the page as three lines — 2, 2, + ${TAG}`, JSON.stringify(shown) === JSON.stringify(misread), JSON.stringify(shown));
        const field = page.locator('[data-ink-final-answer]');
        await check('staging case: no answer is guessed from the misread lines; the Final answer field is there for the student',
          await field.isVisible().catch(() => false) && await field.inputValue() === '' && await primary.isDisabled(),
          `field ${JSON.stringify(await field.inputValue().catch(() => null))}`);
        await field.fill(right.text);
        await submitNow();
        await page.waitForSelector('.eval-card', { timeout: 30000 }).catch(() => {});
        const grade = (await gradesOf(right.serverQuestionId)).at(-1);
        await check('staging case: the server marks the CONFIRMED answer, with the misread lines as working, and awards every mark',
          grade?.body?.answer === right.text && grade.body.steps === misread.join('\n') && grade.json?.authoritative === true &&
            grade.json.correct === true && grade.json.resolved === true && grade.json.marksEarned === grade.json.marksPossible,
          JSON.stringify({ sent: grade?.body?.answer, steps: grade?.body?.steps, correct: grade?.json?.correct, marks: [grade?.json?.marksEarned, grade?.json?.marksPossible] }));
        const submitted = { answer: right.text, lines: misread, viaInk: true, sourceMode: 'ink', hasWorking: true };
        const want = expectedFrom(grade?.json || {}, submitted);
        const text = await cardText();
        const said = flat(await page.locator('[data-working-evidence]').textContent().catch(() => ''));
        await check('staging case: the card does NOT say the working was checked, read and verified, or that it reached the result through a logical chain',
          !INFERRED.test(text) && !/checks out/i.test(text), text.match(INFERRED)?.[0] || text.match(/[^.]*checks out[^.]*/i)?.[0] || '');
        await check('staging case: it says, from the server\'s reply and nothing else, what was established about the working — here that the final answer was checked and the working was not verified',
          grade?.json?.stepReport === null && want.evidence?.kind === 'none' && said === want.text &&
            said === 'Your final answer was checked. Your working was not verified.',
          `card: ${JSON.stringify(said)}; server evidence: ${JSON.stringify(want.evidence)}; server stepReport: ${JSON.stringify(grade?.json?.stepReport)}`);
        await check('staging case: no line of the misread transcript is ticked — "Line 3 checks out" is not shown or spoken for "+"',
          await ticksOnInk() === 0 && await page.locator('.ink-verdict.good, .ink-linebox.good').count() === 0 && want.ticks === 0 && !/Line 3 checks out/.test(text),
          `${await ticksOnInk()} tick(s) on the transcript`);
        const answerShown = await page.locator('[data-submitted-answer]').getAttribute('data-submitted-answer').catch(() => null);
        const bar = flat(await page.locator('.ws-answer-preview').textContent().catch(() => ''));
        await check(`staging case: "Your answer" is the submitted, confirmed value (${right.text}) — never the last ink line "+"`,
          answerShown === right.text && !/Your answer:\s*\+/.test(text) && (bar === '' || (bar.includes(right.text) && !bar.includes('+'))) &&
            flat(await page.locator('[data-submitted-answer]').textContent()).startsWith('Your answer:'),
          `submitted-answer ${JSON.stringify(answerShown)}; bar ${JSON.stringify(bar)}`);
        await check('staging case: the mistaken transcript stays on the page as the reading it is, said not to be the answer',
          JSON.stringify(await readLines(page)) === JSON.stringify(misread) &&
            flat(await page.locator('[data-transcript-not-answer]').textContent().catch(() => '')) === english('verdict.transcriptNotAnswer'),
          JSON.stringify(await readLines(page)));
        await check('staging case: the verdict is spoken as correct with the server\'s marks, and nothing about verified lines',
          /Correct/.test(await spoken()) && !INFERRED.test(await spoken()), await spoken());

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
        await check(`staging case, History: the attempt is kept with "Your answer: ${right.text}", and the transcript is labelled as the reader\'s transcript, not as the answer`,
          once.includes(`Your answer: ${right.text}`) && /the reader’s transcript was “2 ?2 ?\+”\. It is not your answer/.test(once) && !/Your answer:\s*\+/.test(once) && !INFERRED.test(once), once.slice(0, 260));
        await quiet();
        await page.reload({ waitUntil: 'domcontentloaded' });
        const again = await historyShows();
        await check('staging case, History after a reload: the same answer and the same labelled transcript are replayed',
          again.includes(`Your answer: ${right.text}`) && /It is not your answer/.test(again) && !/Your answer:\s*\+/.test(again), again.slice(0, 260));
      }
    }

    // ══ A · a method the server DID check: said from its step report ══════════
    {
      // The page says the question's working can be step-checked only when the
      // server has step meta for it; the lines below are then checked by it.
      const made = await openFresh();
      if (await check('checked method: a numeric question is on the card', !!made)) {
        const { right, box } = made;
        const lines = [String(right.text), String(right.text)];
        const shown = await writeAndRead(box, '11', lines);
        await check(`checked method: two lines are read, the last one the answer as written ${TAG}`, JSON.stringify(shown) === JSON.stringify(lines), JSON.stringify(shown));
        await submitNow();
        await page.waitForSelector('.eval-card', { timeout: 30000 }).catch(() => {});
        const grade = (await gradesOf(right.serverQuestionId)).at(-1);
        const submitted = { answer: String(right.text), lines, viaInk: true, sourceMode: 'ink', hasWorking: true };
        const want = expectedFrom(grade?.json || {}, submitted);
        const said = flat(await page.locator('[data-working-evidence]').textContent().catch(() => ''));
        note(`checked method: server stepReport ${JSON.stringify(grade?.json?.stepReport?.lines?.map(l => l.status) || null)} → evidence ${JSON.stringify(want.evidence)} → "${said}"`);
        await check('checked method: the server marks it correct', grade?.json?.correct === true && grade.json.resolved === true, JSON.stringify(grade?.json?.correct));
        await check('checked method: the server\'s step report says both submitted lines hold, and ONLY therefore the card says the working was checked — "all 2 lines"',
          said === want.text && !INFERRED.test(await cardText()) && want.evidence?.kind === 'all' &&
            grade.json.stepReport.lines.length === 2 && grade.json.stepReport.lines.every(l => l.status === 'ok') &&
            said === 'Your working was checked: all 2 lines you submitted are consistent with the correct solution.',
          `card ${JSON.stringify(said)}; expected ${JSON.stringify(want.text)}`);
        await check('checked method: the ticks on the transcript are the server\'s "ok" lines, plus the answer line the server marked correct — no others',
          await ticksOnInk() === want.ticks && await crossesOnInk() === want.crosses && want.ticks >= 1,
          `${await ticksOnInk()} tick(s), ${await crossesOnInk()} cross(es); expected ${want.ticks}/${want.crosses}`);
        await check('checked method: "Your answer" is the submitted value',
          await page.locator('[data-submitted-answer]').getAttribute('data-submitted-answer') === String(right.text) && await page.locator('[data-transcript-not-answer]').count() === 0);
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
        await submitNow();
        await waitVerdict();
        const first = (await gradesOf(right.serverQuestionId)).at(-1);
        await check('wrong final, first try: the server says only that the try was wrong — no step report while the question is open',
          first?.json?.correct === false && first.json.resolved === false && first.json.stepReport === null, JSON.stringify({ r: first?.json?.resolved, s: first?.json?.stepReport }));
        await check('wrong final, first try: no line is ticked; the one mark on the page is on the submitted answer line',
          await ticksOnInk() === 0 && await crossesOnInk() === 1 && await lookHere() === 1 &&
            await page.locator('.verdict[data-verdict-of="this-page"]').count() === 1,
          `${await ticksOnInk()} tick(s), ${await crossesOnInk()} cross(es), ${await lookHere()} "Look here"`);
        await submitNow();
        await page.waitForSelector('.eval-card', { timeout: 30000 }).catch(() => {});
        const second = (await gradesOf(right.serverQuestionId)).at(-1);
        const submitted = { answer: wrong, lines, viaInk: true, sourceMode: 'ink', hasWorking: true };
        const want = expectedFrom(second?.json || {}, submitted);
        const said = flat(await page.locator('[data-working-evidence]').textContent().catch(() => ''));
        note(`wrong final: server stepReport ${JSON.stringify(second?.json?.stepReport?.lines?.map(l => l.status) || null)}; partial ${JSON.stringify(second?.json?.partial && { awarded: second.json.partial.awarded })} → "${said}"`);
        await check('wrong final, resolved: marked incorrect, never full marks',
          second?.json?.correct === false && second.json.resolved === true && second.json.marksEarned < second.json.marksPossible &&
            await page.locator('.eval-card[data-outcome="incorrect"]').count() === 1, JSON.stringify([second?.json?.marksEarned, second?.json?.marksPossible]));
        await check('wrong final, resolved: the working sentence and the marks on the ink are exactly the server\'s evidence; "Your answer" is the wrong value that was submitted',
          said === (want.text || '') && await ticksOnInk() === want.ticks && await crossesOnInk() === want.crosses &&
            await page.locator('[data-submitted-answer]').getAttribute('data-submitted-answer') === wrong && !INFERRED.test(await cardText()),
          `card ${JSON.stringify(said)} vs ${JSON.stringify(want.text)}; ticks ${await ticksOnInk()}/${want.ticks}; crosses ${await crossesOnInk()}/${want.crosses}`);
      }
    }

    // ══ B · wrong → rewrite → correct → submit, with slow responses ═══════════
    {
      const made = await openFresh();
      if (await check('rewrite: a numeric question is on the card', !!made)) {
        const { right, box } = made;
        const wrong = String(Number(right.text) + 1);
        await writeAndRead(box, '1', [wrong]);
        await submitNow();
        await waitVerdict();
        await check('rewrite: a wrong handwritten answer is marked on the page it was written on — "Not quite", "Look here", a cross on the line',
          flat(await page.locator('.verdict[data-verdict-of="this-page"] .verdict-title').textContent().catch(() => '')) === 'Not quite.' &&
            await lookHere() === 1 && await crossesOnInk() === 1 && await page.locator('.editor-shell[data-marked="yes"]').count() === 1,
          `${await lookHere()} "Look here", ${await crossesOnInk()} cross(es)`);

        // One new stroke. Nothing is read, nothing is submitted.
        const callsBefore = (await gradesOf(right.serverQuestionId)).length;
        await handwrite(page, box, '7', { x: 150 });
        const after = {
          look: await lookHere(), marks: await marksOnInk(), sweep: await page.locator('.editor-shell[data-marked="yes"]').count(),
          previous: flat(await page.locator('.verdict[data-verdict-of="previous-attempt"]').textContent().catch(() => '')),
          pinned: await page.locator('.verdict[data-verdict-of="this-page"], .verdict-bad').count(), speech: await spoken()
        };
        await check('rewrite: ONE new stroke withdraws every annotation of the previous submission — no "Look here", no cross, no note on the canvas, no marked-page sweep',
          after.look === 0 && after.marks === 0 && after.sweep === 0, JSON.stringify(after));
        await check('rewrite: what remains is a neutral statement about the PREVIOUS attempt, and the new work is said not to be checked — on screen and to a screen reader',
          after.previous.includes('Your previous attempt was not correct.') && after.previous.includes('What is on the page now has not been checked yet.') &&
            after.pinned === 0 && !/Not quite/.test(after.previous) && after.speech.includes('Your previous attempt was not correct.') && !/Not quite/.test(after.speech),
          JSON.stringify({ previous: after.previous, speech: after.speech, pinned: after.pinned }));
        await check('rewrite: the new ink was not sent anywhere by being written', (await gradesOf(right.serverQuestionId)).length === callsBefore);

        // A SLOW read of the rewritten page: still nothing judged while it flies…
        online.forgetKeptReads();
        reader.lines = [{ text: String(right.text) }];
        let openRead; reader.gate = new Promise(done => { openRead = done; });
        await pressRead(page);
        await page.waitForTimeout(1200);
        await check('rewrite, slow read in flight: the unread new work carries no annotation',
          await lookHere() === 0 && await marksOnInk() === 0 && await page.locator('.verdict[data-verdict-of="previous-attempt"]').count() === 1);
        openRead(); reader.gate = null;
        await page.waitForFunction(want => document.querySelector('.ink-line')?.getAttribute('data-text') === want && !document.querySelector('[data-ink-stale]'), String(right.text), { timeout: 20000 }).catch(() => {});
        const bar = flat(await page.locator('.ws-answer-preview').textContent().catch(() => ''));
        await check(`rewrite: the correct, UNSUBMITTED ${right.text} is on the page with no "Look here", no cross and no "Not quite" — it does not look judged`,
          JSON.stringify(await readLines(page)) === JSON.stringify([String(right.text)]) && await lookHere() === 0 && await marksOnInk() === 0 &&
            await page.locator('.verdict-bad').count() === 0 && await page.locator('.verdict[data-verdict-of="previous-attempt"]').count() === 1 &&
            !bar.includes(wrong),
          `lines ${JSON.stringify(await readLines(page))}; marks ${await marksOnInk()}; bar ${JSON.stringify(bar)}`);

        // …and a SLOW grade of it: no verdict is shown until the server's reply for THIS revision.
        await holdGrades(right.serverQuestionId);
        await submitNow();
        await page.waitForTimeout(1500);
        await check('rewrite, slow grade in flight: no result is shown for the new answer yet, and the old annotations do not come back',
          await heldGrades() === 1 && await page.locator('.eval-card').count() === 0 && await lookHere() === 0 && await marksOnInk() === 0 && await page.locator('.verdict-bad').count() === 0,
          `${await page.locator('.eval-card').count()} verdict(s); ${await marksOnInk()} mark(s); ${await heldGrades()} grade request(s) waiting`);
        await releaseGrades();
        await page.waitForSelector('.eval-card', { timeout: 30000 }).catch(() => {});
        const grades = await gradesOf(right.serverQuestionId);
        await check('rewrite: the new revision is graded on its own submission and only then annotated — correct, the submitted answer shown, one tick on the answer line, no cross',
          grades.length === 2 && grades[1].body?.answer === String(right.text) && grades[1].json?.correct === true && grades[0].json?.submissionId !== grades[1].json?.submissionId &&
            await page.locator('.eval-card[data-outcome="correct"]').count() === 1 && await page.locator('[data-submitted-answer]').getAttribute('data-submitted-answer') === String(right.text) &&
            await ticksOnInk() === 1 && await crossesOnInk() === 0 && await lookHere() === 0 && await page.locator('.verdict[data-verdict-of]').count() === 0,
          JSON.stringify({ n: grades.length, sent: grades.map(g => g.body?.answer), correct: grades.map(g => g.json?.correct), ticks: await ticksOnInk(), crosses: await crossesOnInk() }));
        await check('rewrite: the earlier wrong try is still on the server\'s record of this question — both submissions were marked, in order',
          grades[0].json?.correct === false && grades[0].json.resolved === false && grades[0].body?.answer === wrong);
      }
    }

    // ══ B · a late grade for an OLDER revision is not pinned on newer work ════
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
            flat(await page.locator('.verdict[data-verdict-of="previous-attempt"] .verdict-title').textContent().catch(() => '')) === 'Your previous attempt was not correct.',
          `editable in flight: ${editable}; field ${JSON.stringify(await answerBox.inputValue())}; cards ${await page.locator('.verdict').count()}`);
        await submitNow();
        await page.waitForSelector('.eval-card', { timeout: 30000 }).catch(() => {});
        const final = (await gradesOf(right.serverQuestionId)).at(-1);
        await check('late grade: the corrected answer is then graded as its own submission, and marked correct',
          final?.body?.answer === String(right.text) && final.json?.correct === true && await page.locator('.eval-card[data-outcome="correct"]').count() === 1);
      }
    }

    // ══ B · input-mode change, clear pad, restored ink, refresh ═══════════════
    {
      const made = await openFresh();
      if (await check('mode change: a numeric question is on the card', !!made)) {
        const { right, box } = made;
        const wrong = String(Number(right.text) + 1);
        await writeAndRead(box, '1', [wrong]);
        await submitNow();
        await waitVerdict();
        await check('mode change: the wrong answer is marked on its own page first', await lookHere() === 1 && await crossesOnInk() === 1);
        await page.getByRole('button', { name: 'Answer by typing' }).click();
        await settle();
        await check('mode change → Type: the handwritten attempt\'s result is the previous attempt\'s; the empty typed field is not "Not quite"',
          await page.locator('.verdict[data-verdict-of="previous-attempt"]').count() === 1 && await page.locator('.verdict-bad').count() === 0 && await lookHere() === 0);
        await page.getByRole('button', { name: 'Answer by handwriting' }).click();
        await page.waitForSelector('.ink-canvas-live', { timeout: 30000 });
        await page.waitForSelector('.ink-line', { timeout: 15000 }).catch(() => {});
        await settle();
        await check('mode change → back to Write: the ink and its transcript are restored WITHOUT the old cross, note or "Look here" — withdrawn annotations do not return',
          (await readLines(page))[0] === wrong && await marksOnInk() === 0 && await lookHere() === 0 &&
            await page.locator('.verdict[data-verdict-of="previous-attempt"]').count() === 1 && await page.locator('.verdict-bad').count() === 0,
          `lines ${JSON.stringify(await readLines(page))}; marks ${await marksOnInk()}`);
        await page.locator('.ink-tool[title="Clear"]').click();
        await settle();
        await check('clear pad: an empty page carries nothing of the previous attempt but the neutral statement',
          await page.locator('.ink-line').count() === 0 && await marksOnInk() === 0 && await lookHere() === 0 && await page.locator('.verdict-bad').count() === 0);
      }
    }
    {
      const made = await openFresh();
      if (await check('clear and refresh: a numeric question is on the card', !!made)) {
        const { right, box } = made;
        const wrong = String(Number(right.text) + 1);
        await writeAndRead(box, '1', [wrong]);
        await submitNow();
        await waitVerdict();
        await check('clear and refresh: the wrong answer is marked on its own page first', await lookHere() === 1 && await crossesOnInk() === 1);
        // Clear straight after the verdict: the first edit IS the clear.
        await page.locator('.ink-tool[title="Clear"]').click();
        await settle();
        await check('clear pad straight after a wrong answer: the marker, the cross and "Not quite" go with the ink they were about',
          await marksOnInk() === 0 && await lookHere() === 0 && await page.locator('.verdict-bad').count() === 0 &&
            await page.locator('.verdict[data-verdict-of="previous-attempt"]').count() === 1);
        // Write the right answer, read it, and reload before submitting.
        await writeAndRead(box, '7', [String(right.text)]);
        await page.waitForFunction(() => document.querySelector('.ws-actions .status-line')?.getAttribute('data-state') === 'saved', null, { timeout: 10000 }).catch(() => {});
        await quiet();
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.ink-canvas-live', { timeout: 30000 });
        await page.waitForSelector('.ink-line', { timeout: 20000 }).catch(() => {});
        await page.waitForTimeout(1500);
        await check('refresh: the restored, unsubmitted ink and its transcript come back with no annotation of any earlier attempt — no card, no cross, no "Look here"',
          (await readLines(page))[0] === String(right.text) && await marksOnInk() === 0 && await lookHere() === 0 &&
            await page.locator('.verdict').count() === 0 && await page.locator('.eval-card').count() === 0 && await card.getAttribute('data-phase') === 'answering',
          `lines ${JSON.stringify(await readLines(page))}; marks ${await marksOnInk()}; phase ${await card.getAttribute('data-phase')}`);
        await submitNow();
        await page.waitForSelector('.eval-card', { timeout: 30000 }).catch(() => {});
        const grades = await gradesOf(right.serverQuestionId);
        await check('retry after refresh: the second try is graded on its own and marked correct; the first, wrong try is still the server\'s record',
          grades.length === 2 && grades[0].json?.correct === false && grades[1].json?.correct === true && grades[1].body?.answer === String(right.text) &&
            await page.locator('.eval-card[data-outcome="correct"]').count() === 1 && await crossesOnInk() === 0,
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
