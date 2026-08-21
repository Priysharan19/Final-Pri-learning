// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · E2E flow — practice, and the marking behind it.
//
// The engine suite proves 672,000 generated questions have correct answers. It
// cannot prove that the answer a student types in the browser ever reaches the
// checker, that a wrong one comes back wrong, or that the worked solution the
// engine wrote is the one the card renders. That gap is this flow.
//
// HOW A CORRECT ANSWER IS KNOWN WITHOUT CHEATING. Nothing here reads the
// question's answer out of storage — it is sealed, and a test that unsealed it
// would be testing its own copy of the maths. Instead the flow answers wrongly
// twice, which is what a student gets for two misses: the card resolves and
// prints the worked solution and the final answer. It then presses the card's
// own "Redo Question", which regenerates the SAME question from the SAME seed,
// and types back what the solution just said. If the marking works, that is
// correct. If the seed does not hold, the prompts differ and the flow says so
// before it ever gets to the answer.
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

  async run({ page, ctx, base, check, goto, createProfile, mathText, settle }) {
    await goto('/');
    await createProfile({ name: 'Blaise Pascal', year: 7 });

    // ── 1 · a question renders ───────────────────────────────────────────────
    await page.goto(`${base}/practice?subtopic=${TOPIC}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.q-prompt', { timeout: 30000 });
    const firstPrompt = await mathText('.q-prompt');
    await check('a question renders with a prompt', !!firstPrompt && firstPrompt.length > 8,
      `prompt reads ${JSON.stringify(firstPrompt)}`);
    await check('the card names the topic it came from',
      (await page.locator('.q-topmeta').innerText()).includes('Linear Equations'),
      `topmeta reads ${JSON.stringify(await page.locator('.q-topmeta').innerText())}`);
    await check('the question is on the clock',
      /\d+:\d\d/.test(await page.locator('.q-timer').innerText()));

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
    await check('the marking criteria are shown',
      await page.locator('.criteria-table tbody tr').count() >= 1);

    const answer = (await mathText('.final-answer') || '').replace(/^Final answer\s*/i, '').trim();
    if (!await check('the final answer is stated', answer.length > 0,
      'the solution block carried no .final-answer')) return;

    // ── 5 · the same question again, answered correctly ──────────────────────
    await page.locator('.redo-chip').click();
    await page.waitForSelector('.editor-body input.answer-input', { timeout: 30000 });
    await settle();
    const again = await mathText('.q-prompt');
    if (!await check('"Redo Question" brings back the same question, same numbers',
      again === prompt, `first: ${JSON.stringify(prompt)}\n      again: ${JSON.stringify(again)}`)) return;

    await page.locator('.editor-body input.answer-input').fill(answer);
    await page.getByRole('button', SUBMIT).click();
    await page.waitForSelector('.eval-card', { timeout: 20000 });
    // Full marks is the signal, not the wording: the card only awards every
    // mark when the checker said the answer was right.
    const marked = (await page.locator('.eval-card').innerText()).replace(/\s+/g, ' ');
    const marks = (await page.locator('.eval-marks').innerText()).replace(/\s+/g, ' ').trim();
    await check(`the answer the solution gave (${JSON.stringify(answer)}) is marked correct`,
      /^(\d+(?:\.\d)?) \/ \1 marks \(100%\)/.test(marks), `marks read ${JSON.stringify(marks)}`);
    await check('a correct answer is not told what was expected instead',
      !/Expected:/.test(marked), `evaluation reads ${JSON.stringify(marked.slice(0, 160))}`);
    await check('the session counter agrees it was right',
      /session 1\/2/.test(await page.locator('.ctx-pill-meta').innerText()),
      `context pill reads ${JSON.stringify(await page.locator('.ctx-pill-meta').innerText())}`);

    // ── 6 · both attempts were kept ──────────────────────────────────────────
    await page.goto(`${base}/history`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.hist-row', { timeout: 30000 });
    const rows = await page.locator('.hist-row').count();
    await check('every resolved question is in History', rows === 2, `${rows} rows, expected 2`);
    const scores = await page.locator('.hist-row').allInnerTexts();
    await check('History remembers which one was right',
      scores.some(t => t.includes('✔')) && scores.some(t => t.includes('✖')),
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
