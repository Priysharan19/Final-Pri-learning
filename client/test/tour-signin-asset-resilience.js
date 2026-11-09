// Exact-head browser regression for an on-demand, visual-only sign-in chunk.
// No real account, email, provider, guardian decision or backend mutation.
import { readFileSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const worker = () => readFileSync(ROOT + 'client/dist/sw.js', 'utf8');
const manifest = (source, kind) => {
  const match = source.match(new RegExp('^const ' + kind + ' = (.*);$', 'm'));
  return match ? JSON.parse(match[1]) : [];
};

export const flow = {
  id: 'signin-illustration-asset-failure',
  name: 'Sign-in visual cannot break offline account entry',
  async run({ page, ctx, base, goto, check }) {
    const sw = worker();
    const warm = [...manifest(sw, 'PRECACHE'), ...manifest(sw, 'WARM')];
    await check('sign-in graph is not an upfront install or warm asset',
      !warm.some(name => /\/SignInPlot-[^/]*\.(js|css)$/.test(name)));
    const failures = [];
    await page.route('**/assets/SignInPlot-*.js', async route => {
      failures.push(route.request().url());
      await route.abort('failed');
    });

    await goto('/');
    await page.locator('#signup-destination').waitFor({state:'visible',timeout:15000});
    // A failed visual fetch must resolve to the safe React.lazy fallback rather
    // than reject into the app ErrorBoundary and replace the real sign-in page.
    await page.waitForTimeout(550);
    await check('test intentionally denied the optional graphics chunk', failures.length > 0, failures.join(','));
    await check('real email form remains visible', await page.locator('#signup-destination').isVisible());
    await check('continue action is still rendered', await page.getByTestId('signup-send-code').count() === 1);
    await check('password alternative remains rendered', await page.getByTestId('signup-use-password').count() === 1);
    await check('guardian alternative remains rendered', await page.getByTestId('signup-parent-link').count() === 1);
    await check('visual slot has a non-interactive placeholder', await page.locator('.in-signin-plot[aria-hidden=true]').count() === 1);
    await check('fatal error boundary never replaced sign-in', await page.locator('.crash-card').count() === 0);
    await check('offline visual failure causes no horizontal document overflow',
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));


    // A delayed but successful visual chunk must not move the account form.
    // The two pieces render independently; neither can move the other once
    // the form becomes actionable. This is checked in a fresh page so the
    // aborted import above cannot poison the React.lazy module cache.
    const delayedPage = await ctx.newPage();
    await delayedPage.setViewportSize({width:390,height:844});
    const delayed = [];
    const pageErrors = [];
    delayedPage.on('pageerror', error => pageErrors.push(error.message));
    await delayedPage.route('**/assets/SignInPlot-*.js', async route => {
      delayed.push(route.request().url());
      await new Promise(resolve => setTimeout(resolve, 1200));
      await route.continue();
    });
    await delayedPage.goto(base + '/', {waitUntil:'domcontentloaded',timeout:15000});
    await delayedPage.locator('#signup-destination').waitFor({state:'visible',timeout:15000});
    const geometry = () => delayedPage.evaluate(() => {
      const rect = selector => {
        const el = document.querySelector(selector);
        const r = el?.getBoundingClientRect();
        return r ? {x:r.x,y:r.y,width:r.width,height:r.height} : null;
      };
      return {
        email:rect('#signup-destination'),
        primary:rect('.signup-next'),
        heading:rect('.hero-title'),
        column:rect('.auth-col'),
        background:getComputedStyle(document.querySelector('.auth-col')).backgroundColor,
        overflow:document.documentElement.scrollWidth-innerWidth
      };
    });
    const first = await geometry();
    await delayedPage.locator('.pri-plot-viewport canvas').waitFor({state:'visible',timeout:10000});
    await delayedPage.waitForTimeout(120);
    const last = await geometry();
    const aligned = (a,b) => !!a && !!b && Math.abs(a.x-b.x) < 2 &&
      Math.abs(a.y-b.y) < 2 && Math.abs(a.width-b.width) < 2;
    await check('the test delayed the actual optional visual chunk', delayed.length > 0);
    await check('the email field does not move when the plot appears', aligned(first.email,last.email));
    await check('the primary action does not jump', aligned(first.primary,last.primary));
    await check('the heading retains its original position', aligned(first.heading,last.heading));
    await check('the form column stays at the same width', aligned(first.column,last.column));
    await check('dark materials paint before the visual chunk', first.background === last.background,
      first.background + ' / ' + last.background);
    await check('delayed load does not create page errors', pageErrors.length === 0, pageErrors.join(','));
    await check('delayed load stays within the viewport', first.overflow <= 0 && last.overflow <= 0);
    await delayedPage.close();
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
