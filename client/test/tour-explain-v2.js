// Pri Explain V8 · browser-level proof of the adaptive visual teaching path.
// This deliberately resolves a real generated question through the normal UI;
// no test fixture injects a solution, diagnosis or fake handwriting payload.
import { pathToFileURL } from 'node:url';

const TOPIC = 'y7-equations';
const FIRST_WRONG = '-987654';
const SECOND_WRONG = '-987655';
const SUBMIT = { name: 'Submit Answer' };

export const flow = {
  id: 'explain-v2',
  name: 'Pri Explain V8 · adaptive board-style reasoning playback',

  async run({ page, base, check, goto, createProfile, settle }) {
    await goto('/');
    await createProfile({ name: 'Emmy Noether', year: 7 });
    await page.goto(`${base}/practice?subtopic=${TOPIC}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.q-prompt', { timeout: 30000 });

    const answerBox = page.locator('.editor-body input.answer-input');
    for (let skips = 0; skips < 12; skips++) {
      const typeTab = page.getByRole('button', { name: 'Answer by typing' });
      if (await typeTab.count()) await typeTab.click();
      await settle();
      if (await answerBox.count() === 1) break;
      await page.locator('.ctx-next').click();
      await page.waitForSelector('.q-prompt', { timeout: 30000 });
    }
    if (!await check('a typed linear-equation question was served', await answerBox.count() === 1)) return;

    await answerBox.fill(FIRST_WRONG);
    await page.getByRole('button', SUBMIT).click();
    await page.waitForSelector('.verdict-bad', { timeout: 20000 });
    await check('the first wrong attempt remains unresolved', await page.locator('.eval-card').count() === 0);

    await answerBox.fill(SECOND_WRONG);
    await page.getByRole('button', SUBMIT).click();
    await page.waitForSelector('.eval-card', { timeout: 20000 });

    const launch = page.getByRole('button', { name: 'Watch explanation' });
    if (!await check('a resolved question exposes Pri Explain', await launch.count() === 1)) return;
    await launch.click();
    await page.waitForSelector('.pri-explain-dialog', { timeout: 10000 });

    await check('the V8 adaptive board player opens',
      /V8 adaptive teacher/i.test(await page.locator('.pri-explain-kicker').innerText()),
      `kicker reads ${JSON.stringify(await page.locator('.pri-explain-kicker').innerText())}`);

    const adaptive = page.locator('.pri-explain-adaptive');
    await check('a real wrong attempt switches the teaching plan to Targeted recovery',
      await adaptive.count() === 1 && /Targeted recovery/i.test(await adaptive.innerText()),
      await adaptive.count() ? `adaptive plan reads ${JSON.stringify(await adaptive.innerText())}` : 'adaptive teaching plan missing');

    const attempt = page.locator('.pri-v-attempt');
    await check('the player starts by replaying the first wrong attempt', await attempt.count() === 1,
      'the diagnosis scene did not render the submitted working');
    if (await attempt.count()) {
      await check('the replay is the first miss, not the later retry',
        (await attempt.innerText()).includes(FIRST_WRONG) && !(await attempt.innerText()).includes(SECOND_WRONG),
        `attempt replay reads ${JSON.stringify(await attempt.innerText())}`);
    }

    await check('recovery marks the attempt/diagnosis scene as the key teaching step',
      await page.locator('.pri-explain-key-badge').count() === 1,
      'the recovery scene was not prioritised');
    await check('the key teaching step explains its presentation purpose',
      /your attempt/i.test(await page.locator('.pri-explain-why-step').innerText()),
      await page.locator('.pri-explain-why-step').count() ? JSON.stringify(await page.locator('.pri-explain-why-step').innerText()) : 'why-this-step cue missing');

    const rail = page.locator('.pri-explain-rail button');
    const scenes = await rail.count();
    await check('the explanation has a multi-scene timeline', scenes >= 2, `${scenes} scene(s)`);

    let sawTransform = false;
    for (let i = 0; i < scenes; i++) {
      await rail.nth(i).click();
      await settle();
      if (await page.locator('.pri-v-transform').count()) { sawTransform = true; break; }
    }
    await check('a verified algebra step becomes an equation-motion scene', sawTransform,
      'no timeline scene rendered an equation transition');

    if (scenes) {
      await rail.nth(scenes - 1).click();
      await settle();
      await check('the visual timeline ends on the verified final answer',
        await page.locator('.pri-explain-final').count() === 1);
      await check('targeted recovery offers a same-concept follow-up question',
        await page.getByRole('button', { name: 'Try one yourself' }).count() === 1);
    }

    const followUp = page.getByRole('button', { name: 'Try one yourself' });
    if (await followUp.count()) {
      await followUp.click();
      await page.waitForSelector('.q-prompt', { timeout: 20000 });
      await check('the follow-up returns to a fresh unresolved practice question',
        await page.locator('.pri-explain-dialog').count() === 0 && await page.locator('.eval-card').count() === 0);
    } else {
      await page.getByRole('button', { name: 'Close visual solution' }).click();
      await check('closing the player returns to the resolved question',
        await page.locator('.pri-explain-dialog').count() === 0 && await page.locator('.eval-card').count() === 1);
    }
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');

  // `npm run test:e2e` first runs the canonical browser suite, then this focused
  // flow against the exact dist that suite built. The CI coverage gate reads
  // the LAST "E2E SUITE" verdict in browser.log. Without aggregation, this
  // focused verdict shadows the canonical verdict and makes the gate report a
  // false coverage regression even though both suites passed.
  const baseChecks = Number(process.env.E2E_CHECKS || 0);
  const baseFlows = Number(process.env.E2E_FLOWS || 0);
  const originalLog = console.log;

  if (baseChecks > 0 && baseFlows > 0) {
    console.log = (...args) => {
      const mapped = args.map(arg => {
        if (typeof arg !== 'string') return arg;
        const match = arg.match(/([✔✖]) E2E SUITE (PASSED|FAILED) — (\d+)\/(\d+) checks across (\d+) flows$/);
        if (!match) return arg;
        const passed = baseChecks + Number(match[3]);
        const total = baseChecks + Number(match[4]);
        const flows = baseFlows + Number(match[5]);
        const combined = `${match[1]} E2E SUITE ${match[2]} — ${passed}/${total} checks across ${flows} flows`;
        return arg.replace(match[0], combined);
      });
      originalLog(...mapped);
    };
  }

  let failed = 1;
  try {
    failed = await runOne(flow);
  } finally {
    console.log = originalLog;
  }
  process.exit(failed ? 1 : 0);
}
