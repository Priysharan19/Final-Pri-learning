// Pri Learning · the Prithagoras "page not found" route table
//
// App.jsx keeps APP_PATHS, the real app addresses, so that a signed-out visitor
// (or an account waiting at the activation gate) who opens an address that IS an
// app route still reaches sign-in or the gate, and any other address meets the
// not-found page. This holds that list equal to the routes the signed-in router
// declares, holds the Priyabhata path to what it was, and holds the page to one
// heading, one sentence and one button.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = rel => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const app = read('../src/App.jsx');
const main = read('../src/main.jsx');
const page = read('../src/landing/NotFound.jsx');
let n = 0;
const ok = (cond, label) => { assert.ok(cond, label); n++; };

const list = app.match(/const APP_PATHS = NOT_FOUND_PAGE \? \[([\s\S]*?)\] : \[\];/);
ok(list, 'App.jsx declares APP_PATHS behind NOT_FOUND_PAGE');
const known = new Set([...list[1].matchAll(/'([^']+)'/g)].map(m => m[1]));
const declared = [...app.matchAll(/<Route path="([^"]+)"/g)].map(m => m[1]).filter(p => p !== '*');
ok(declared.length > 30, `the router declares routes (${declared.length})`);
for (const p of declared) ok(known.has(p), `${p} is declared by a route and listed in APP_PATHS`);
for (const p of known) ok(declared.includes(p) || main.includes(`'${p}'`) || p === '/index.html', `${p} is listed in APP_PATHS and is a route or a main.jsx page`);

ok(/const NOT_FOUND_PAGE = typeof __PRI_AU_BUILD__ === 'boolean' && __PRI_AU_BUILD__;/.test(app), 'the page is a Prithagoras build literal, so Priyabhata\'s build never includes it');
ok(/NOT_FOUND_PAGE \? React\.lazy\(\(\) => import\('\.\/landing\/NotFound\.jsx'\)\) : null/.test(app), 'the page is a lazy chunk only a Prithagoras build has');
ok(/path="\*" element=\{NOT_FOUND_PAGE \? <UnknownAddress otherwise=\{<Login \/>\} to="\/welcome" \/> : <Login \/>\}/.test(app), 'signed out: Login at real addresses, not-found elsewhere, button to /welcome; Priyabhata: Login');
ok(/<Route path="\*" element=\{NOT_FOUND_PAGE \? <SignedInUnknown home=\{roleLanding\} \/> : <Navigate to=\{roleLanding\} replace \/>\}/.test(app), 'signed in: public and switched-off paths go home, other paths are not found; Priyabhata: the redirect it had');
ok(!/<UnknownAddress to="\/"/.test(app) && /<Route path="\*" element=\{<AccountActivationGate/.test(app), 'the activation gate runs at every address (an unknown one is judged after activation, by the signed-in router)');

// The matcher itself, lifted from App.jsx and run: it must agree with react-router on these patterns.
const matcher = app.match(/const isRoute = (\(pattern, pathname\) => \{[\s\S]*?\n\};)/);
ok(matcher, 'App.jsx declares isRoute');
const isRoute = new Function(`return ${matcher[1].replace(/;$/, '')}`)();
for (const [pattern, path, want] of [
  ['/practice', '/practice', true], ['/practice', '/practice/', true], ['/Practice', '/practice', true], ['/practice', '/practise', false],
  ['/exams/:id', '/exams/abc', true], ['/exams/:id', '/exams', false], ['/exams/:id', '/exams/a/b', false],
  ['/', '/', true], ['/', '/x', false], ['/welcome/marking', '/welcome/marking', true], ['/welcome', '/this-does-not-exist', false]
]) ok(isRoute(pattern, path) === want, `isRoute(${pattern}, ${path}) is ${want}`);

ok((page.match(/<h1\b/g) || []).length === 1, 'the page has exactly one h1');
ok((page.match(/<p\b/g) || []).length === 1, 'the page has exactly one sentence');
ok((page.match(/<PageLink\b/g) || []).length === 1 && !/<button\b/.test(page), 'the page has exactly one button');
ok(!/—|–|!/.test(page.replace(/^\/\/.*$/gm, '')), 'no dash or exclamation mark in the copy');

// ── The behaviour, in a browser, on the Prithagoras build ───────────────────
// The same build a deployment makes (every feature flag at its production default, so the parent report, placement,
// library and desk routes are OFF), served by the real platform server. Signed out, then signed in as a student: a real,
// public-landing or switched-off address never shows the not-found page, and only an unknown address does.
// `--static` stops before this (it needs Chromium and a build). Prithagoras has no guardian role (family.parentFeatures
// is false) and the Teacher role is offered only to a build with PRI_FEATURE_EXTENDED_TRACKS, so the walk is a student's;
// the teacher's home is the same `roleLanding` argument of the same component, held by the source checks above.
if (!process.argv.includes('--static')) {
  const { chromium } = await import('@playwright/test');
  const { spawnSync } = await import('node:child_process');
  const { existsSync, mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { startOnlinePlatform, closeOnlinePlatform } = await import('./support/online-session.mjs');
  const { createVerifiedProfile } = await import('./support/verified-onboarding.mjs');
  const CLIENT = fileURLToPath(new URL('..', import.meta.url));
  const out = mkdtempSync(join(tmpdir(), 'pri-not-found-'));
  let platform = null, browser = null;
  const env = { ...process.env, PRI_EDITION: 'prithagoras' };
  for (const k of Object.keys(env)) if (k.startsWith('PRI_FEATURE_')) delete env[k];
  const timer = setTimeout(() => { console.error('NOT FOUND ROUTES: FAIL — the browser walk stalled for 300s'); process.exit(1); }, 300000);
  timer.unref();
  try {
    const built = spawnSync(process.execPath, [join(CLIENT, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', out, '--emptyOutDir', '--logLevel', 'error'], { cwd: CLIENT, encoding: 'utf8', env });
    ok(built.status === 0 && existsSync(join(out, 'index.html')), `the Prithagoras build succeeds${built.status === 0 ? '' : `: ${built.stderr}`}`);
    platform = await startOnlinePlatform({ dist: out, env: { PRI_EDITION: 'prithagoras' } });
    browser = await chromium.launch();
    const NOT_FOUND = '[data-testid="not-found"]';
    const PUBLIC = ['/welcome', '/welcome/', '/welcome/marking', '/welcome/syllabus', '/welcome/teachers', '/index.html'];
    const SWITCHED_OFF = ['/parent-report', '/placement', '/library', '/library/abc', '/desk/import', '/desk/abc', '/parent/report-email'];
    const REAL = ['/', '/practice', '/progress', '/plan', '/today', '/exams', '/review', '/notes', '/settings', '/map', '/insights', '/privacy', '/terms', '/refund-policy', '/contact', '/signin', '/stats', '/rush'];
    const UNKNOWN = ['/this-does-not-exist', '/practice/x/y', '/welcome/nope', '/Privacy2', '/library/a/b'];
    const settle = async page => {
      await page.waitForSelector('h1', { timeout: 30000 });
      await page.waitForTimeout(900);
    };
    for (const [label, width, height] of [['375x812', 375, 812], ['1280x800', 1280, 800]]) {
      const ctx = await browser.newContext({ viewport: { width, height } });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      const online = platform.session(ctx, page);
      const visit = async path => { await page.goto(platform.origin + path, { waitUntil: 'domcontentloaded' }); await settle(page); return { found: await page.locator(NOT_FOUND).count(), path: new URL(page.url()).pathname }; };

      // Signed out.
      for (const path of ['/welcome', '/welcome/marking', '/privacy', '/practice', '/progress', '/exams/abc']) ok((await visit(path)).found === 0, `${label} signed out: ${path} is not "not found"`);
      for (const path of UNKNOWN) ok((await visit(path)).found === 1, `${label} signed out: ${path} is "not found"`);
      await visit('/this-does-not-exist');
      await page.getByTestId('not-found-home').click();
      await page.waitForFunction(() => location.pathname === '/welcome', null, { timeout: 15000 });
      ok(true, `${label} signed out: the button goes to the landing page`);

      // Signed in as a student.
      await page.goto(platform.origin, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.auth-wrap, .shell, [data-guest-try]', { timeout: 30000 });
      await createVerifiedProfile(page, platform, { name: 'Not Found Student', year: 12, fromPicker: await page.getByTestId('picker-create-account').count() > 0 });
      await online.signIn({ name: 'Not Found Student' });
      await page.waitForSelector('.shell', { timeout: 30000 });
      for (const [kind, paths] of [['public landing', PUBLIC], ['switched-off', SWITCHED_OFF]]) {
        for (const path of paths) {
          const r = await visit(path);
          ok(r.found === 0 && r.path === '/' && await page.locator('.shell').count() === 1, `${label} signed in: ${kind} ${path} goes home, never "not found" (ended on ${r.path}, found=${r.found})`);
        }
      }
      for (const path of REAL) ok((await visit(path)).found === 0, `${label} signed in: real route ${path} is not "not found"`);
      for (const path of UNKNOWN) ok((await visit(path)).found === 1, `${label} signed in: ${path} is "not found", inside the shell`);
      await visit('/this-does-not-exist');
      await page.getByTestId('not-found-home').click();
      await page.waitForFunction(() => location.pathname === '/', null, { timeout: 15000 });
      await page.waitForSelector(NOT_FOUND, { state: 'detached', timeout: 15000 });
      ok(await page.locator('.shell').count() === 1, `${label} signed in: the button goes to the student's home`);
      ok(errors.length === 0, `${label}: no page errors (${errors.slice(0, 2).join(' | ')})`);
      await ctx.close();
    }
  } finally {
    clearTimeout(timer);
    await browser?.close().catch(() => {});
    await closeOnlinePlatform().catch(() => {});
    rmSync(out, { recursive: true, force: true });
  }
}

console.log(`NOT FOUND ROUTES: PASS — ${n}/${n} checks`);
