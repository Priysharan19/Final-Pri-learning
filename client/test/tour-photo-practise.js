// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · E2E flow — "Practise this": photo → chapter → fresh practice.
//
// /v1/question-photo/identify is stubbed with what the real route returns: the
// question's text and a proposed chapter/skill. The real page is driven from
// Home: a photo is chosen, the recognised question and chapter are shown, the
// student confirms, and Practice serves a freshly generated question of that
// chapter. A provider outage is shown as an honest message, not a result.
// Run on its own:  node client/test/tour-photo-practise.js
// ─────────────────────────────────────────────────────────────────────────────
import { pathToFileURL } from 'node:url';

// A real, decodable 1×1 PNG, so the page's own re-encoder runs.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
const QUESTION = 'Find the nature of the roots of 2x^2 - 4x + 3 = 0.';

export const flow = {
  id: 'photo-practise',
  name: 'Practise this · photo a question, practise its skill',

  async run({ page, ctx, base, check, goto, createProfile }) {
    const stub = { calls: 0, bodies: [], down: false };
    await page.addInitScript(origin => { window.__PRI_CLOUD_ORIGIN__ = origin; }, base);
    const json = (route, status, value) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) }).catch(() => {});
    await ctx.route('**/v1/**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/v1/question-photo/identify' && route.request().method() === 'POST') {
        stub.calls++;
        stub.bodies.push(JSON.parse(route.request().postData() || '{}'));
        if (stub.down) return json(route, 503, { error: { code: 'QUESTION_PHOTO_PROVIDER_5XX', message: 'down', retryable: true } });
        return json(route, 200, { identification: {
          isMathsQuestion: true, readable: true, questionText: QUESTION, needsConfirmation: true,
          candidates: [{ chapterId: 'c10-quadratic-equations', chapterName: 'Quadratic Equations', grade: 10, skillId: 'c10-quadratic-discriminant', dotpoint: 2, confidence: 0.91 }]
        } });
      }
      return json(route, 404, { error: { code: 'NOT_FOUND', message: url.pathname } });
    });

    await goto('/');
    await createProfile({ name: 'Asha Iyer', year: 10, course: 'in' });

    const entry = page.locator('[data-home-photo-practise]');
    await entry.waitFor({ timeout: 20000 });
    await check('Home offers "Practise this"', await entry.isVisible(), 'no entry on Home');
    await entry.click();
    await page.waitForSelector('[data-photo-practise]', { timeout: 30000 });

    await page.locator('[data-photo-practise-input]').setInputFiles({ name: 'question.png', mimeType: 'image/png', buffer: PNG });
    await page.waitForSelector('[data-photo-practise-state]', { timeout: 30000 });
    const shown = await page.locator('[data-photo-practise-question]').innerText().catch(() => '');
    await check('the recognised question is shown', shown.includes('nature of the roots'), shown);
    const chapter = await page.locator('[data-photo-practise-chapter]').inputValue();
    await check('the proposed chapter is preselected for the student to confirm', chapter === 'c10-quadratic-equations', chapter);
    const skill = await page.locator('[data-photo-practise-skill]').innerText().catch(() => '');
    await check('the skill is named', /discriminant/i.test(skill), skill);
    const body = stub.bodies[0] || {};
    await check('only the photo is sent', JSON.stringify(Object.keys(body)) === '["image"]' && /^data:image\/jpeg;base64,/.test(body.image || ''), JSON.stringify(Object.keys(body)));

    await page.locator('[data-photo-practise-start]').click();
    await page.waitForURL(/\/practice\?subtopic=c10-quadratic-equations&dotpoint=2/, { timeout: 20000 });
    await page.waitForSelector('.qpage .q-prompt', { timeout: 45000 });
    const prompt = await page.locator('.qpage .q-prompt').first().innerText();
    await check('Practice serves a freshly generated question, not the photographed one', prompt.length > 0 && !prompt.includes('2x^2 - 4x + 3'), prompt.slice(0, 80));

    // Provider down: an honest message, never a result.
    stub.down = true;
    await page.goto(`${base}/practise-photo`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-photo-practise]', { timeout: 30000 });
    await page.locator('[data-photo-practise-input]').setInputFiles({ name: 'question.png', mimeType: 'image/png', buffer: PNG });
    await page.waitForSelector('[data-photo-practise-state="provider-down"]', { timeout: 30000 }).catch(() => null);
    const alert = await page.locator('[data-photo-practise-state]').first().getAttribute('data-photo-practise-state');
    await check('a provider outage is an honest message', alert === 'provider-down' && await page.locator('[data-photo-practise-start]').count() === 0, alert);
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
