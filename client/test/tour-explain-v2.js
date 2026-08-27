// Pri Explain V2 · browser-level proof of the visual teaching path.
// This deliberately resolves a real generated question through the normal UI;
// no test fixture injects a solution or fake handwriting payload.
import { pathToFileURL } from 'node:url';

const TOPIC = 'y7-equations';
const FIRST_WRONG = '-987654';
const SECOND_WRONG = '-987655';
const SUBMIT = { name: 'Submit Answer' };

export const flow = {
  id: 'explain-v2',
  name: 'Pri Explain V2 · visual reasoning playback',

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

    await check('the V2 visual player opens',
      /Visual Engine V2/i.test(await page.locator('.pri-explain-kicker').innerText()),
      `kicker reads ${JSON.stringify(await page.locator('.pri-explain-kicker').innerText())}`);

    const attempt = page.locator('.pri-v-attempt');
    await check('the player starts by replaying the first wrong attempt', await attempt.count() === 1,
      'the diagnosis scene did not render the submitted working');
    if (await attempt.count()) {
      await check('the replay is the first miss, not the later retry',
        (await attempt.innerText()).includes(FIRST_WRONG) && !(await attempt.innerText()).includes(SECOND_WRONG),
        `attempt replay reads ${JSON.stringify(await attempt.innerText())}`);
    }

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
    }

    await page.getByRole('button', { name: 'Close visual solution' }).click();
    await check('closing the player returns to the resolved question',
      await page.locator('.pri-explain-dialog').count() === 0 && await page.locator('.eval-card').count() === 1);
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
