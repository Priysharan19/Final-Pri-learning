// F6: a worked solution shows a triangle CONSTRUCTED from the sides the
// question states, as inline SVG with a text alternative a screen reader hears.
// The question is real: the test server issues c9-herons-formula seed 1
// ("A triangle has sides 9, 12 and 15…"), and the real server marks it. Only
// the issue SEED is pinned (test server only, never deployed). Synthetic run.
import { pathToFileURL } from 'node:url';

const PIN = { generator: 'c9-herons-formula', difficulty: 1, curriculum: 'in', seed: 1 };
const POST_ISSUE = /\/v1\/practice\/issue(?:\?.*)?$/;
const FIG = '[data-geo-figure="triangle"]';
const front = page => page.locator('.qpage[data-question-id]');

export const flow = {
  id: 'geo-figure',
  name: 'Constructed figure · worked solution draws the stated triangle, with a text alternative',
  online: true,
  async run({ page, base, goto, createProfile, online, check, note, settle }) {
    await goto('/');
    await createProfile({ name: 'Figure Student', year: 10, course: 'in' });
    await online.signIn({ name: 'Figure Student' });
    const issued = [];
    await page.route(POST_ISSUE, async route => {
      const original = route.request().postDataJSON() || {};
      const response = await route.fetch({ postData: JSON.stringify({ ...original, ...PIN }) });
      issued.push({ status: response.status(), body: (await response.text()).slice(0, 300), original });
      await route.fulfill({ response });
    });
    await page.goto(`${base}/practice?subtopic=c10-linear-pair-methods`, { waitUntil: 'domcontentloaded' });
    await front(page).locator('.q-prompt').waitFor({ timeout: 30000 });
    await settle();
    const issuedAnswer = async () => {
      let a = await online.answerOf();
      for (let i = 0; i < 40 && a.kind === 'unissued'; i++) { await page.waitForTimeout(500); a = await online.answerOf(); }
      return a;
    };
    let known = await issuedAnswer();
    for (let n = 0; n < 4 && !/sides \$9\$, \$12\$ and \$15\$/.test(known.prompt || ''); n++) {
      const before = await front(page).getAttribute('data-question-id');
      await page.locator('.ctx-next').click();
      await page.waitForFunction(id => {
        const q = document.querySelector('.qpage[data-question-id]');
        return q && q.getAttribute('data-question-id') !== id && !!q.querySelector('.q-prompt');
      }, before, { timeout: 30000 });
      known = await issuedAnswer();
    }
    if (!await check('the real server issued the pinned 9-12-15 triangle question',
      /sides \$9\$, \$12\$ and \$15\$/.test(known.prompt || '') && known.kind === 'text', JSON.stringify({ known, issued }).slice(0, 1200))) return;

    await check('no figure before the solution exists', await page.locator(FIG).count() === 0);
    await page.locator('[data-final-answer]').fill(known.text);
    await page.locator('.ws-actions .btn-primary').click();
    await page.locator('.eval-card').waitFor({ state: 'visible', timeout: 30000 });
    const fig = page.locator(FIG);
    await fig.waitFor({ state: 'visible', timeout: 30000 });

    const drawn = await fig.evaluate(el => {
      const svg = el.querySelector('svg');
      const poly = svg?.querySelector('polygon');
      const pts = (poly?.getAttribute('points') || '').trim().split(/\s+/).map(p => p.split(',').map(Number));
      const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
      return {
        role: svg?.getAttribute('role'), title: svg?.querySelector('title')?.textContent || '',
        labelled: svg?.getAttribute('aria-labelledby') === svg?.querySelector('title')?.id,
        caption: el.querySelector('figcaption')?.textContent || '',
        images: el.querySelectorAll('img, image').length,
        ratio: pts.length === 3 ? d(pts[1], pts[2]) / d(pts[0], pts[1]) : null,
        labels: [...svg.querySelectorAll('text')].map(t => t.textContent)
      };
    });
    await check('the figure is inline SVG, no images', drawn.images === 0 && drawn.role === 'img', JSON.stringify(drawn));
    await check('drawn to scale from the stated sides (BC/AB = 12/9)', Math.abs(drawn.ratio - 12 / 9) < 0.01, String(drawn.ratio));
    await check('every stated length is labelled on the figure', ['9', '12', '15'].every(n => drawn.labels.includes(n)), drawn.labels.join('|'));
    await check('the text alternative names the sides and the right angle', /AB 9/.test(drawn.title) && /BC 12/.test(drawn.title) && /CA 15/.test(drawn.title) && /B 90°/.test(drawn.title), drawn.title);
    await check('the SVG is labelled by its <title>, and the caption shows the same words', drawn.labelled && drawn.caption === drawn.title);

    // What the browser's accessibility tree actually exposes (CDP, Chromium).
    if (page.context().browser()?.browserType().name() === 'chromium') {
      const cdp = await page.context().newCDPSession(page);
      const { nodes } = await cdp.send('Accessibility.getFullAXTree');
      const img = nodes.find(n => !n.ignored && ['image', 'img'].includes(n.role?.value) && n.name?.value === drawn.title);
      await check('the accessibility tree has an image named by the text alternative', !!img, nodes.filter(n => ['image', 'img'].includes(n.role?.value)).map(n => n.name?.value).join(' | ').slice(0, 300));
    } else {
      note('accessibility tree read via CDP in Chromium only');
    }
    note('Synthetic run on a test server; the issue seed is pinned for a known question. No physical-device claim.');
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { onlinePlatform } = await import('./support/online-session.mjs');
  await onlinePlatform({ allowSeededPractice: true });
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
