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
  async run({ page, goto, check }) {
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
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
