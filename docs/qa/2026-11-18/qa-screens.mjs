// Renders the signed-in app screens in light/dark and desktop/phone and runs structural assertions.
//   node docs/qa/<date>/qa-screens.mjs   (needs a built client/dist and client/node_modules)
const { chromium } = await import(new URL('../../../client/node_modules/@playwright/test/index.mjs', import.meta.url).href);
const { mkdirSync, writeFileSync } = await import('node:fs');
const R = new URL('../../../', import.meta.url).pathname;
const { startOnlinePlatform } = await import(R + 'client/test/support/online-session.mjs');
const { createVerifiedProfile } = await import(R + 'client/test/support/verified-onboarding.mjs');
const OUT = new URL('./screens/', import.meta.url).pathname; mkdirSync(OUT, { recursive: true });
const ROUTES = ['/', '/today', '/map', '/practice', '/paper-generator', '/exams', '/notes', '/library', '/progress', '/error-log', '/plan', '/insights', '/settings'];
const VIEWS = [['desktop-light', { width: 1280, height: 900 }, 'light'], ['desktop-dark', { width: 1280, height: 900 }, 'dark'], ['phone-light', { width: 390, height: 844 }, 'light'], ['phone-dark', { width: 390, height: 844 }, 'dark']];
const server = await startOnlinePlatform();
const browser = await chromium.launch();
const findings = [];
for (const [vname, viewport, scheme] of VIEWS) {
  const ctx = await browser.newContext({ viewport, colorScheme: scheme, deviceScaleFactor: 1, hasTouch: vname.startsWith('phone') });
  const page = await ctx.newPage(); page.setDefaultTimeout(30000);
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
  await page.goto(server.origin, { waitUntil: 'domcontentloaded' });
  await createVerifiedProfile(page, server, { name: 'QA Student', year: 10, course: 'in' });
  for (const route of ROUTES) {
    errs.length = 0;
    await page.goto(server.origin + route, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);
    const r = await page.evaluate(() => {
      const o = { overflowX: document.documentElement.scrollWidth - innerWidth, katexErr: document.querySelectorAll('.katex-error').length, uni: [], unlabelled: [], clipped: [], tiny: [] };
      const RE = /[✓✔✕✖✗✘²³⁰-⁹]/;
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) { const p = n.parentElement; if (!p || p.closest('.katex,script,style')) continue; if (RE.test(n.nodeValue)) o.uni.push(n.nodeValue.trim().slice(0, 60)); }
      for (const b of document.querySelectorAll('button,a[href],input,select,textarea,[role=button]')) {
        const r = b.getBoundingClientRect(); if (!r.width || !r.height) continue;
        const name = (b.getAttribute('aria-label') || b.getAttribute('aria-labelledby') || b.innerText || b.getAttribute('title') || b.labels?.[0]?.innerText || b.getAttribute('placeholder') || '').trim();
        if (!name && b.type !== 'hidden') o.unlabelled.push(b.outerHTML.slice(0, 100));
        if (b.matches('button,[role=button],a[href]') && (r.height < 32 || r.width < 32) && b.innerText.trim().length < 3) o.tiny.push(b.outerHTML.slice(0, 80));
      }
      for (const e of document.querySelectorAll('h1,h2,h3,button,a,p,li,label')) { if (e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflow !== 'visible' && e.clientWidth > 0) o.clipped.push((e.innerText || '').slice(0, 50)); }
      return o;
    });
    const slug = route === '/' ? 'home' : route.slice(1).replace(/\//g, '-');
    await page.screenshot({ path: `${OUT}${slug}-${vname}.png`, fullPage: false });
    if (r.overflowX > 1 || r.katexErr || r.uni.length || r.unlabelled.length || r.clipped.length || errs.length) findings.push({ view: vname, route, url: page.url().replace(server.origin, ''), ...r, errs: errs.slice(0, 3) });
  }
  await ctx.close();
}
writeFileSync(new URL('./screens-sweep.json', import.meta.url).pathname, JSON.stringify(findings, null, 1));
console.log('findings', findings.length);
for (const f of findings) console.log(f.view, f.route, '->', f.url, JSON.stringify({ ox: f.overflowX, k: f.katexErr, uni: f.uni.slice(0, 2), unl: f.unlabelled.slice(0, 2), clip: f.clipped.slice(0, 2), e: f.errs }));
await browser.close(); process.exit(0);
