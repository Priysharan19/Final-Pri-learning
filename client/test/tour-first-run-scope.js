// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · E2E · first run → correctly scoped practice (V1 §04/§05)
//
// A new student picks class and track in onboarding and the very first
// Practice question is from that class/track's syllabus; the choice survives a
// reload; changing class later in Settings re-scopes Practice (the unfinished
// question from the old class is not resumed under the new one); "Past papers
// only" on a chapter with no archive offers nearby chapters that do, and one
// tap serves a real previous-year question.
//
// Chapter scope is computed from the same engine the app bundles, and the
// served chapter is read off the question card's topic chip.
//
// Run on its own:  node client/test/tour-first-run-scope.js [--no-build]
// ─────────────────────────────────────────────────────────────────────────────
import { pathToFileURL } from 'node:url';
import { indiaPracticeScope, indiaScope, resolveIndiaTarget } from '../src/engine/indiaProduct.js';

const IPAD_PORTRAIT = { width: 1024, height: 1366 };
const scopeNames = (track, year) => {
  const { own, ahead } = indiaPracticeScope(track, year);
  return new Set([...own, ...ahead].map(c => c.name));
};

async function next(page) {
  await page.locator('.auth-card .btn-primary').click();
}

async function servedChapter(page) {
  await page.waitForSelector('.q-prompt', { timeout: 30000 });
  return (await page.locator('.qpage .tag[lang="en"]').first().innerText()).trim();
}

export const flow = {
  id: 'first-run-scope',
  name: 'First run · class/track scope, reload, class change, past papers empty state',

  async run({ page, check, goto, settle }) {
    await page.setViewportSize(IPAD_PORTRAIT);
    await goto('/');
    await page.getByRole('button', { name: 'Use without an account' }).click();
    await page.waitForSelector('[data-onboarding-step="1"]');
    await page.getByRole('button', { name: 'Student', exact: true }).click();
    await next(page);

    await page.waitForSelector('[data-onboarding-step="2"]');
    await page.locator('#signup-track').selectOption('jee-main');
    await page.locator('#signup-year').selectOption('12');
    await next(page);
    await page.waitForSelector('[data-onboarding-step="3"]');
    await page.locator('#signup-name').fill('Scope Student');
    await next(page);
    await page.waitForSelector('[data-onboarding-step="4"]');
    await next(page);
    await page.waitForSelector('[data-onboarding-step="5"]');
    await page.locator('.auth-card .btn-primary').click();
    await page.waitForSelector('.home-greet', { timeout: 30000 });

    // ── the first question is from Class 12 JEE Main ──
    await goto('/practice');
    const jee = scopeNames('jee-main', 12);
    const first = await servedChapter(page);
    await check('the first Practice question is from the chosen class and track (Class 12 · JEE Main)', jee.has(first), `served "${first}"`);

    await page.reload({ waitUntil: 'domcontentloaded' });
    const resumed = await servedChapter(page);
    await check('reload resumes the same unfinished question', resumed === first, `before "${first}", after "${resumed}"`);
    await goto('/settings');
    const settingsText = await page.locator('main, .shell').first().innerText();
    await check('reload keeps the chosen class and track', /Class 12/.test(settingsText) && /JEE Main/.test(settingsText));

    // ── changing class later re-scopes practice ──
    await page.getByRole('button', { name: /Edit/ }).first().click();
    await page.locator('#set-year').selectOption('10');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.waitForFunction(() => !document.querySelector('#set-year'), null, { timeout: 15000 });
    await goto('/practice');
    const cbse10 = scopeNames('cbse', 10);
    const afterMove = await servedChapter(page);
    await check('after moving to Class 10 the next question is Class 10 CBSE', cbse10.has(afterMove), `served "${afterMove}"`);
    await check('the old Class 12 question is not resumed under Class 10', afterMove !== first || cbse10.has(first));

    // ── past papers only: a chapter with no archive offers nearby chapters ──
    const bare = indiaScope('cbse', 10).find(c => !resolveIndiaTarget(c, { track: 'cbse', grade: 10, pyqOnly: true, random: () => 0 }));
    const hasAny = indiaScope('cbse', 10).some(c => resolveIndiaTarget(c, { track: 'cbse', grade: 10, pyqOnly: true, random: () => 0 }));
    if (bare && hasAny) {
      await goto(`/practice?subtopic=${encodeURIComponent(bare.id)}&track=cbse&pyq=1`);
      await page.waitForSelector('[data-practice-error="INDIA_PYQ_UNAVAILABLE"]', { timeout: 30000 });
      await check('the past-papers empty state is titled as such, not as a load failure',
        /past papers/i.test(await page.locator('[data-practice-error] .verdict-title').innerText()));
      await check('a chapter with no past papers says so under the filter (no substitute question)',
        await page.locator('.q-prompt').count() === 0);
      const alternatives = page.locator('[data-pyq-alternatives] a');
      await check('the empty state offers nearby chapters that have past papers', await alternatives.count() > 0);
      if (await alternatives.count()) {
        await alternatives.first().click();
        await page.waitForSelector('.q-prompt', { timeout: 30000 });
        await check('one tap serves a real previous-year question',
          await page.getByText('Previous year question', { exact: true }).count() > 0);
        await check('and the filter is still on', new URL(page.url()).searchParams.get('pyq') === '1');
      }
    } else {
      await check('Class 10 CBSE has both archived and unarchived chapters to exercise the empty state', false,
        `bare=${!!bare} archived=${hasAny}`);
    }
    await settle();
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
