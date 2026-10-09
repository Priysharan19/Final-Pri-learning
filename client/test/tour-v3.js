// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · E2E flow — practice, and the marking behind it.
//
// The engine suite proves 672,000 generated questions have correct answers. It
// cannot prove that the answer a student types in the browser ever reaches the
// checker, that a wrong one comes back wrong, or that the worked solution the
// engine wrote is the one the card renders. That gap is this flow.
//
// WHO MARKS. The server, and only the server (owner decision 2026-10-10): the
// profile is signed in to a verified account on the real platform server this
// suite boots (support/online-session.mjs) and every verdict asserted below is
// read from that server's receipt as well as from the card.
//
// HOW A CORRECT ANSWER IS KNOWN WITHOUT CHEATING. The device holds no answer
// key for a server-issued question and nothing here reads one from the page.
// The flow answers wrongly twice, which is what a student gets for two misses:
// the card resolves and prints the server's worked solution and final answer.
// The test's own desk regenerates that question from the generator, difficulty
// and seed the page sent to /practice/issue and requires the two to agree; the
// next question is then answered with its regenerated answer.
//
// "Redo Question" used to carry the second half of this flow. It no longer
// brings back the same question for a server-issued one, and the copy it makes
// can never be checked: see known-red-online-redo-uncheckable.mjs.
//
// Run on its own:  node client/test/tour-v3.js
// ─────────────────────────────────────────────────────────────────────────────
import { pathToFileURL } from 'node:url';

const TOPIC = 'y7-equations';
const SURELY_WRONG = '-987654';
const MAX_SKIPS = 12;

const SUBMIT = { name: 'Submit Answer' };

export const flow = {
  id: 'practice',
  name: 'Practice · a question, marked both ways',
  online: true,

  async run({ page, ctx, base, check, goto, createProfile, mathText, settle, online }) {
    await goto('/');
    await createProfile({ name: 'Blaise Pascal', year: 7 });
    await online.signIn({ name: 'Blaise Pascal' });

    // ── 1 · a question renders ───────────────────────────────────────────────
    await page.goto(`${base}/practice?subtopic=${TOPIC}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.q-prompt', { timeout: 30000 });
    const firstPrompt = await mathText('.q-prompt');
    await check('a question renders with a prompt', !!firstPrompt && firstPrompt.length > 8,
      `prompt reads ${JSON.stringify(firstPrompt)}`);
    await check('the card names the topic it came from',
      (await page.locator('.q-topmeta').innerText()).includes('Linear Equations'),
      `topmeta reads ${JSON.stringify(await page.locator('.q-topmeta').innerText())}`);
    // Practice is deliberately untimed on screen: time on task is still
    // recorded with the attempt, but a running clock is pressure, not help.
    await check('practice shows no running clock',
      await page.locator('.q-timer').count() === 0);

    // ── 2 · find one that takes a typed answer ───────────────────────────────
    // The card opens in handwriting mode on a touch device, so typing is asked
    // for explicitly. Multiple choice and full-working questions are answered by
    // other controls and are covered elsewhere; this flow is about the box.
    const answerBox = page.locator('.editor-body input.answer-input');
    const typeTab = page.getByRole('button', { name: 'Answer by typing' });
    await check('the card offers all three ways of answering',
      await page.locator('.mode-tab').count() === 3,
      `${await page.locator('.mode-tab').count()} mode tabs, expected type, write and photo`);

    let skips = 0;
    for (; ;) {
      if (await typeTab.count()) await typeTab.click();
      await settle();
      if (await answerBox.count() === 1 || skips++ >= MAX_SKIPS) break;
      await page.locator('.ctx-next').click();
      await page.waitForSelector('.q-prompt', { timeout: 30000 });
    }
    if (!await check('a typed-answer question was served', await answerBox.count() === 1,
      `${MAX_SKIPS} questions from ${TOPIC} and none of them had an answer box`)) return;

    const prompt = await mathText('.q-prompt');

    // ── 3 · a wrong answer is marked wrong ───────────────────────────────────
    await answerBox.fill(SURELY_WRONG);
    await page.getByRole('button', SUBMIT).click();
    await page.waitForSelector('.verdict-bad', { timeout: 20000 });
    await check('a wrong answer is marked wrong',
      /not quite|couldn’t read/i.test(await page.locator('.verdict-bad').innerText()),
      `verdict reads ${JSON.stringify(await page.locator('.verdict-bad').innerText())}`);
    await check('a first miss is not the end of the question',
      await page.locator('.eval-card').count() === 0,
      'the card resolved on the first wrong answer instead of offering another go');

    // ── 4 · the second miss resolves it, with the solution ───────────────────
    await answerBox.fill(SURELY_WRONG + '1');
    await page.getByRole('button', SUBMIT).click();
    await page.waitForSelector('.eval-card', { timeout: 20000 });
    const evalText = await page.locator('.eval-card').innerText();
    await check('two misses resolve the question — there is no third try',
      await page.getByRole('button', SUBMIT).count() === 0,
      'the submit button was still live after the question resolved');
    await check('the evaluation says what was expected', /Expected:/.test(evalText),
      `evaluation reads ${JSON.stringify(evalText.replace(/\s+/g, ' ').slice(0, 160))}`);
    await check('no marks are awarded for a wrong answer',
      /\b0 \/ \d+\b/.test(await page.locator('.eval-marks').innerText()),
      `marks read ${JSON.stringify(await page.locator('.eval-marks').innerText())}`);

    await check('the worked solution appears', await page.locator('.solution-block').count() === 1);
    const steps = await page.locator('.solution-block .step').count();
    await check('the worked solution is worked, step by step', steps >= 1, `${steps} steps rendered`);

    const answer = (await mathText('.final-answer') || '').replace(/^Final answer\s*/i, '').trim();
    if (!await check('the final answer is stated', answer.length > 0,
      'the solution block carried no .final-answer')) return;

    // Who marked it. Both misses were committed by the server for a question
    // the server issued; the device held no answer key and marked nothing.
    const firstId = (await online.shownRow())?.serverQuestionId;
    const misses = await online.practiceCalls(new RegExp(`^/v1/practice/${firstId}/submit$`));
    await check('both misses were marked by the server, for a question the server issued',
      !!firstId && misses.length === 2 && misses.every(c => c.status === 200 && c.json?.authoritative === true && c.json.correct === false) &&
        misses[0].json.resolved === false && misses[1].json.resolved === true,
      JSON.stringify(misses.map(c => ({ status: c.status, correct: c.json?.correct, resolved: c.json?.resolved }))));
    await check('the marks on the card are the server\'s: 0 of the marks it issued the question for',
      new RegExp(`^0 / ${misses[1]?.json?.marksPossible} marks?\\b`).test((await page.locator('.eval-marks').innerText()).replace(/\s+/g, ' ').trim()) &&
        await page.locator('[data-grade-unavailable]').count() === 0,
      `marks read ${JSON.stringify(await page.locator('.eval-marks').innerText())}; server said ${misses[1]?.json?.marksEarned}/${misses[1]?.json?.marksPossible}`);
    await check('nothing on the card calls this a mark made on the device',
      !/marked on this device/i.test(await page.locator('.qpage').innerText()));
    // The solution the card printed is the server's. The test's own desk
    // regenerates the same question from the generator, difficulty and seed the
    // page asked the server to issue; the two must name the same answer.
    const solved = await online.answerOf();
    await check('the final answer the server released is the one the question\'s own generator gives',
      solved.text !== null && answer.replace(/\s+/g, '').includes(String(solved.text).replace(/\s+/g, '')),
      `card: ${JSON.stringify(answer)}; regenerated: ${JSON.stringify(solved.text)}`);

    // ── 5 · the next question, answered correctly ────────────────────────────
    // The right answer comes from the oracle (support/online-session.mjs): the
    // device no longer holds one to read, and the server never hands one out
    // before the question is resolved.
    await page.locator('.ws-actions .btn-primary').click();
    await page.waitForFunction(id => {
      const el = document.querySelector('.qpage[data-question-id]');
      return el && el.getAttribute('data-question-id') !== id && el.querySelector('.q-prompt');
    }, (await online.shownRow()).id, { timeout: 30000 });
    let right = null;
    for (let i = 0; i <= MAX_SKIPS; i++) {
      if (await typeTab.count()) await typeTab.click();
      await settle();
      if (await answerBox.count() === 1) {
        right = await online.answerOf();
        if (right.kind === 'text' && right.text !== null) break;
      }
      right = null;
      await page.locator('.ctx-next').click();
      await page.waitForSelector('.q-prompt', { timeout: 30000 });
    }
    if (!await check('the next question is a typed one whose answer the oracle can regenerate',
      !!right && await mathText('.q-prompt') !== prompt, JSON.stringify(right && { answerType: right.answerType }))) return;

    await answerBox.fill(right.text);
    await page.getByRole('button', SUBMIT).click();
    await page.waitForSelector('.eval-card', { timeout: 20000 });
    // Full marks is the signal, not the wording: the card only awards every
    // mark when the checker said the answer was right.
    const marked = (await page.locator('.eval-card').innerText()).replace(/\s+/g, ' ');
    const marks = (await page.locator('.eval-marks').innerText()).replace(/\s+/g, ' ').trim();
    const graded = (await online.practiceCalls(new RegExp(`^/v1/practice/${(await online.shownRow())?.serverQuestionId}/submit$`))).at(-1);
    await check(`the regenerated answer (${JSON.stringify(right.text)}) is marked correct, by the server, at the first try`,
      /^(\d+(?:\.\d)?) \/ \1 marks\b/.test(marks) && graded?.json?.authoritative === true && graded.json.correct === true &&
        graded.json.resolved === true && graded.json.marksEarned === graded.json.marksPossible,
      `marks read ${JSON.stringify(marks)}; server ${String(JSON.stringify(graded?.json)).slice(0, 200)}`);
    await check('a correct answer is not told what was expected instead',
      !/Expected:/.test(marked), `evaluation reads ${JSON.stringify(marked.slice(0, 160))}`);
    await check('the session counter agrees it was right',
      /session 1\/2/.test(await page.locator('.ctx-pill-meta').innerText()),
      `context pill reads ${JSON.stringify(await page.locator('.ctx-pill-meta').innerText())}`);
    const ledger = online.ledger();
    await check('the server holds exactly these two questions as completed, once each',
      ledger.completions === 2, JSON.stringify(ledger));

    // ── 6 · both attempts were kept ──────────────────────────────────────────
    await page.goto(`${base}/history`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.hist-row', { timeout: 30000 });
    const rows = await page.locator('.hist-row').count();
    await check('every resolved question is in History', rows === 2, `${rows} rows, expected 2`);
    const scores = await page.locator('.hist-row').allInnerTexts();
    await check('History remembers which one was right',
      // The verdict is an icon plus its spoken word, so the words are what a row says.
      scores.some(t => /\bCorrect\b/.test(t)) && scores.some(t => /\bIncorrect\b/.test(t)),
      `rows read ${JSON.stringify(scores.map(t => t.replace(/\s+/g, ' ').slice(0, 60)))}`);
    await check('both attempts are on the same question',
      scores.every(t => t.includes('Linear Equations')),
      `rows read ${JSON.stringify(scores.map(t => t.replace(/\s+/g, ' ').slice(0, 60)))}`);

    // ── 7 · a question that comes with a diagram ─────────────────────────────
    await page.goto(`${base}/practice?subtopic=y9-pythagoras`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.q-prompt', { timeout: 30000 });
    let figure = false;
    for (let i = 0; i < 6 && !figure; i++) {
      figure = await page.locator('.q-figure svg').count() > 0;
      if (figure) break;
      await page.locator('.ctx-next').click();
      await page.waitForSelector('.q-prompt', { timeout: 30000 });
      await settle();
    }
    await check('a geometry question draws its own figure', figure,
      'six Pythagoras questions and not one of them rendered an SVG figure');

    // ── 8 · and all of it works with the network gone ───────────────────────
    // The headline claim on the landing page. It rests on the service worker
    // having precached the build, which is a thing only a browser can be asked.
    await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.home-greet', { timeout: 30000 });
    const claimed = await page.waitForFunction(() => !!navigator.serviceWorker?.controller, null, { timeout: 30000 })
      .then(() => true).catch(() => false);
    if (await check('the service worker takes charge of the page', claimed,
      'no worker claimed the client, so nothing was cached to go offline with')) {
      await ctx.setOffline(true);
      await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => { });
      const up = await page.waitForSelector('.home-greet', { timeout: 30000 }).then(() => true).catch(() => false);
      await check('the app opens again with the network switched off', up,
        'a reload with the network down did not reach Home');
      await ctx.setOffline(false);
    }
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
