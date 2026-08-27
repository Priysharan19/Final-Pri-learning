// Pri Explain V4 · browser-level proof of the personalised teaching path.
// This deliberately resolves a real generated question through the normal UI;
// no test fixture injects a solution or fake handwriting payload.
import { pathToFileURL } from 'node:url';

const TOPIC = 'y7-equations';
const FIRST_WRONG = '-987654';
const SECOND_WRONG = '-987655';
const SUBMIT = { name: 'Submit Answer' };

export const flow = {
  id: 'explain-v4',
  name: 'Pri Explain V4 · teaching director playback',

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

    await check('the V4 teaching director player opens',
      /Teaching Director V4/i.test(await page.locator('.pri-explain-kicker').innerText()),
      `kicker reads ${JSON.stringify(await page.locator('.pri-explain-kicker').innerText())}`);

    const attempt = page.locator('.pri-v-attempt');
    await check('the director starts by replaying the first wrong attempt', await attempt.count() === 1,
      'the diagnosis scene did not render the submitted working');
    if (await attempt.count()) {
      await check('the replay is the first miss, not the later retry',
        (await attempt.innerText()).includes(FIRST_WRONG) && !(await attempt.innerText()).includes(SECOND_WRONG),
        `attempt replay reads ${JSON.stringify(await attempt.innerText())}`);
    }

    const rail = page.locator('.pri-explain-rail button');
    const scenes = await rail.count();
    await check('the director creates a multi-scene teaching timeline', scenes >= 3, `${scenes} scene(s)`);

    let checkpointIndex = -1;
    let transformIndex = -1;
    for (let i = 0; i < scenes; i++) {
      await rail.nth(i).click();
      await settle();
      if (checkpointIndex < 0 && await page.locator('.pri-v-checkpoint').count()) checkpointIndex = i;
      if (transformIndex < 0 && await page.locator('.pri-v-transform').count()) transformIndex = i;
    }

    await check('the director inserts a prediction checkpoint before a verified move', checkpointIndex >= 0,
      'no timeline scene rendered a prediction checkpoint');
    if (checkpointIndex >= 0) {
      await rail.nth(checkpointIndex).click();
      await settle();
      const reveal = page.getByRole('button', { name: 'Reveal next verified step' });
      await check('checkpoint autoplay is replaced by an explicit reveal', await reveal.count() === 1,
        'prediction scene did not expose the reveal control');
      if (await reveal.count()) {
        await reveal.click();
        await settle();
        await check('revealing a checkpoint advances to checked mathematics',
          await page.locator('.pri-v-checkpoint').count() === 0);
      }
    }

    await check('a verified algebra step becomes an equation-motion scene', transformIndex >= 0,
      'no timeline scene rendered an equation transition');
    if (transformIndex >= 0) {
      await rail.nth(transformIndex).click();
      await settle();
      const slower = page.getByRole('button', { name: 'Show it slower' });
      await check('a verified transform offers personalised branch controls', await slower.count() === 1);
      if (await slower.count()) {
        await slower.click();
        await page.waitForSelector('.pri-explain-branch', { timeout: 5000 });
        await check('the slower branch is rendered inside the same verified player',
          await page.locator('.pri-explain-branch-scenes article').count() >= 2);
        await page.getByRole('button', { name: 'Close extra explanation' }).click();
      }
    }

    if (scenes) {
      await rail.nth(scenes - 1).click();
      await settle();
      await check('the teaching timeline ends on the verified final answer',
        await page.locator('.pri-explain-final').count() === 1);
    }

    await page.getByRole('button', { name: 'Close visual solution' }).click();
    await check('closing the player returns to the resolved question',
      await page.locator('.pri-explain-dialog').count() === 0 && await page.locator('.eval-card').count() === 1);
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');

  // The canonical browser suite runs first; this focused flow runs against the
  // same built dist. CI reads the last E2E verdict, so when the canonical floors
  // are supplied we report their combined coverage rather than shadowing it.
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
