// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · End-to-end suite — the four flows nothing else can reach.
//
// Every other suite in this repo runs in bare Node. They prove the engine, the
// local backend and the sanitiser, and they prove them well — but not one of
// them ever mounts a component. The four riskiest surfaces in the app are all
// on the far side of a render: the profile gate, the question card, the ink
// canvas, and the exam room. This suite is the only place they are driven the
// way a student drives them.
//
// WHAT THIS SUITE IS NOT. It is not a screenshot tour. A screenshot proves a
// page painted; it does not prove the page worked, and a tour that only paints
// is a test that cannot fail. Every flow below asserts on behaviour — an answer
// marked, a password refused, a stroke recognised, marks returned — and every
// assertion names what it expected and what it got when it breaks.
//
// HOW IT RUNS. From a clean checkout, with no machine-specific configuration:
//   · the client is rebuilt first (vite, offline, ~1s) so the suite can never
//     be green about a dist somebody left behind three commits ago
//   · dist is served by a static server started inside this process on an
//     ephemeral port. The legacy Express app is deliberately not involved —
//     the client is local-first and serves its own API from IndexedDB, so a
//     file server is the whole backend a browser needs
//   · Playwright resolves its own browser. No executablePath, no /opt paths
//   · each flow gets a fresh browser context, so profiles, IndexedDB and the
//     service worker never leak from one flow into the next
//
// Usage: node client/test/e2e.mjs [--only=ink,exam] [--no-build] [--headed] [--bail]
// A failing check names what it expected, what it got, and where the screenshot
// of the screen at that moment was written.
// ─────────────────────────────────────────────────────────────────────────────
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, normalize, extname, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DIST = join(ROOT, 'client', 'dist');

// ── Options ──────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const opts = { build: true, only: null, headed: false, bail: false };
  for (const arg of argv) {
    if (arg === '--no-build') opts.build = false;
    else if (arg === '--headed') opts.headed = true;
    else if (arg === '--bail') opts.bail = true;
    else if (arg.startsWith('--only=')) opts.only = arg.slice(7).split(',').map(s => s.trim()).filter(Boolean);
  }
  return opts;
}

// A red line that cannot be looked at is half a report, so every failed check
// leaves a picture of the screen behind. It goes to the system temp directory,
// named in the failure — a test run never leaves anything in the repo.
const SHOTS = join(tmpdir(), 'pri-e2e-shots');

// ── Assertions ───────────────────────────────────────────────────────────────
// Same shape as the security suite: groups collect counts, failures collect the
// full story, and the report at the end is the only thing that prints.

const groups = [];
let group = null;
let built = 0;
const failures = [];
const notes = [];

const section = (name) => { group = { name, pass: 0, fail: 0, ms: 0 }; groups.push(group); return group; };

function ok(name, condition, detail = '') {
  if (!group) section('startup');
  if (condition) { group.pass++; return true; }
  group.fail++;
  failures.push(`${group.name} · ${name}${detail ? `\n      ${detail}` : ''}`);
  return false;
}

const note = (text) => { notes.push(text); };

// ── Static server ────────────────────────────────────────────────────────────
// Everything the browser needs, and nothing it does not. A path that names a
// file gets that file or a 404; a path that names none is a route, and routes
// belong to the client router, so they get the shell. Falling back to the shell
// for a missing .js would turn a broken build into a blank page with no error.

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8'
};

async function serveDist(dir = DIST) {
  const root = normalize(dir).replace(/[\\/]$/, '');
  const shell = join(root, 'index.html');

  const server = createServer((req, res) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://pri.local').pathname); }
    catch { res.writeHead(400).end(); return; }
    if (pathname.endsWith('/')) pathname += 'index.html';

    const full = normalize(join(root, pathname));
    const inside = full === root || full.startsWith(root + sep);
    const ext = extname(full).toLowerCase();

    const send = (file, status = 200) => {
      readFile(file).then(buf => {
        res.writeHead(status, {
          'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
          'content-length': buf.length,
          // The service worker owns caching in this app; the origin server
          // holding a second copy only makes a run harder to reason about.
          'cache-control': 'no-store'
        });
        res.end(buf);
      }).catch(() => {
        if (ext) { res.writeHead(404, { 'content-type': 'text/plain' }); res.end(`not built: ${pathname}`); }
        else send(shell);
      });
    };

    if (!inside) { res.writeHead(403, { 'content-type': 'text/plain' }); res.end('outside dist'); return; }
    if (!ext) { send(shell); return; }
    send(full);
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  return {
    origin: `http://127.0.0.1:${port}`,
    close: () => new Promise(resolve => { server.closeAllConnections?.(); server.close(resolve); })
  };
}

// ── Build ────────────────────────────────────────────────────────────────────

/**
 * A suite that runs against a stale dist is testing code nobody has any more,
 * and vite builds this app in about a second — so the build is made every run
 * unless it is explicitly waved off, and never silently skipped.
 */
function ensureBuild(build) {
  if (!build) {
    if (!existsSync(join(DIST, 'index.html'))) {
      throw new Error('--no-build was given but client/dist is not there — run npm run build --prefix client');
    }
    return { built: false };
  }
  const started = Date.now();
  const run = spawnSync('npm', ['run', 'build', '--prefix', 'client'], {
    cwd: ROOT, encoding: 'utf8', shell: process.platform === 'win32'
  });
  if (run.status !== 0) {
    const tail = `${run.stdout || ''}${run.stderr || ''}`.trim().split('\n').slice(-12).join('\n      ');
    throw new Error(`npm run build failed (exit ${run.status})\n      ${tail}`);
  }
  return { built: true, ms: Date.now() - started };
}

// ── Page helpers handed to every flow ────────────────────────────────────────

const SETTLE = 250;

/**
 * KaTeX writes the same maths twice — once as MathML for a screen reader and
 * once as glyphs for eyes — so textContent on anything rendered through
 * MathText reads double. This takes the visual copy only, which is what a
 * student sees and what they would type back.
 */
const readMathIn = (el) => {
  const clone = el.cloneNode(true);
  for (const m of clone.querySelectorAll('.katex-mathml')) m.remove();
  return clone.textContent.replace(/\s|\u00a0/g, ' ').replace(/ +/g, ' ').trim();
};

function helpers(page, base, flowId) {
  let shotN = 0;

  const shot = async (label) => {
    const name = `${flowId}-${String(++shotN).padStart(2, '0')}-${label}.png`;
    try {
      await mkdir(SHOTS, { recursive: true });
      await page.screenshot({ path: join(SHOTS, name), fullPage: false });
      return join(SHOTS, name);
    } catch { return null; }
  };

  /** Assert, and on a failure leave a picture of the screen behind. */
  const check = async (name, condition, detail = '') => {
    if (condition) return ok(name, true);
    const path = await shot(`FAIL-${name.replace(/[^a-z0-9]+/gi, '-').slice(0, 48)}`);
    return ok(name, false, `${detail}${path ? `\n      screenshot: ${path}` : ''}`);
  };

  /** The readable text of an element, KaTeX doubling removed. */
  const mathText = async (selector) => {
    const el = await page.$(selector);
    return el ? await el.evaluate(readMathIn) : null;
  };

  /** Load a route and wait for the app to have decided who is signed in. */
  const goto = async (path = '/') => {
    await page.goto(base + path, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.auth-wrap .hero-title, .auth-card, .shell', { timeout: 30000 });
  };

  /**
   * Make a profile the way a student makes one — through the hero, the method
   * stage and the create form — and land on Home. Every flow but the login flow
   * needs a signed-in profile before it can start, and none of them should be
   * reaching into storage to fake one.
   */
  const createProfile = async ({ name = 'E2E Student', year = 9, email = null, password = null } = {}) => {
    await page.getByRole('button', { name: 'Get Started' }).click();
    await page.waitForSelector('.sso-btn', { timeout: 15000 });
    await page.getByRole('button', { name: email ? /Continue with email/ : /Continue without an email/ }).click();
    await page.waitForSelector('.auth-card input.input', { timeout: 15000 });
    await page.getByPlaceholder('e.g. Priysharan').fill(name);
    if (email) await page.locator('.auth-card input[type=email]').fill(email);
    await page.locator('.auth-card select').first().selectOption(String(year));
    if (password) {
      await page.locator('.check-row input[type=checkbox]').check();
      await page.getByLabel('Password', { exact: true }).fill(password);
      await page.getByLabel('Repeat password').fill(password);
    }
    await page.getByRole('button', { name: 'Start learning' }).click();
    await page.waitForSelector('.home-greet', { timeout: 30000 });
  };

  return { shot, check, mathText, goto, createProfile, settle: () => page.waitForTimeout(SETTLE) };
}

// ── Flow runner ──────────────────────────────────────────────────────────────

const FLOWS = ['./tour-login.js', './tour-v3.js', './tour-ink.js', './tour-v4.js', './cal-smoke.mjs'];

async function loadFlows() {
  const loaded = [];
  for (const spec of FLOWS) {
    const mod = await import(spec);
    if (!mod.flow?.id || typeof mod.flow.run !== 'function') {
      throw new Error(`${spec} does not export a runnable flow`);
    }
    loaded.push(mod.flow);
  }
  return loaded;
}

/**
 * One flow, one context. A fresh context is a fresh IndexedDB, a fresh
 * localStorage and a fresh service-worker registration, so no flow can pass
 * because of something an earlier one left behind.
 */
async function runFlow(flow, { browser, base, opts }) {
  const g = section(flow.name || flow.id);
  const started = Date.now();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    hasTouch: true,
    reducedMotion: 'reduce'
  });
  const page = await ctx.newPage();
  const crashes = [];
  page.on('pageerror', e => crashes.push(String(e?.message || e).slice(0, 200)));

  const api = helpers(page, base, flow.id);
  try {
    await flow.run({ page, ctx, base, note, ...api });
  } catch (err) {
    const path = await api.shot('FAIL-crash');
    ok('the flow ran to the end', false,
      `threw: ${String(err?.stack || err).split('\n').slice(0, 4).join('\n      ')}${path ? `\n      screenshot: ${path}` : ''}`);
  }
  // An exception thrown out of a render is invisible to every assertion above
  // it — the boundary catches it and the page carries on looking plausible.
  ok('no uncaught errors reached the page', crashes.length === 0, crashes.slice(0, 3).join(' · '));
  await ctx.close();
  g.ms = Date.now() - started;
  return g.fail;
}

/** Run one flow on its own — the standalone entry point every tour file uses. */
export async function runOne(flow, argv = process.argv.slice(2)) {
  const opts = parseArgs(argv);
  return run([flow], opts);
}

async function run(flows, opts) {
  const build = ensureBuild(opts.build);
  if (build.built) built = build.ms;
  else notes.push('--no-build: this ran against whatever was already in client/dist');

  const server = await serveDist();
  const browser = await chromium.launch({ headless: !opts.headed });
  try {
    for (const flow of flows) {
      // Every flow runs even after one fails. A run that stops at the first red
      // line makes the next fix a guess about what else is broken.
      const failed = await runFlow(flow, { browser, base: server.origin, opts });
      if (failed && opts.bail) {
        notes.push(`--bail: stopped after "${flow.name}", ${flows.length - flows.indexOf(flow) - 1} flows never ran`);
        break;
      }
    }
  } finally {
    await browser.close();
    await server.close();
  }
  return report();
}

// ── Summary ──────────────────────────────────────────────────────────────────

function report() {
  const total = groups.reduce((n, g) => n + g.pass + g.fail, 0);
  const failed = groups.reduce((n, g) => n + g.fail, 0);
  const ms = groups.reduce((n, g) => n + g.ms, 0);

  console.log('\nEnd-to-end — the app driven through a real browser, asserted at every step\n');
  for (const g of groups) {
    const n = g.pass + g.fail;
    console.log(`  ${g.name.padEnd(42)} ${String(g.pass).padStart(3)}/${String(n).padEnd(3)} ${`${(g.ms / 1000).toFixed(1)}s`.padStart(7)}  ${g.fail ? `✖ ${g.fail} FAILED` : '✔'}`);
  }
  console.log(`\n  ${groups.length} flows · ${total} checks · ${(ms / 1000).toFixed(1)}s in the browser${built ? ` · ${(built / 1000).toFixed(1)}s building the client first` : ''}`);
  if (failures.length) {
    console.log('\nfailures:');
    for (const f of failures) console.log('  ' + f);
  }
  for (const n of notes) console.log(`\n  note: ${n}`);
  const verdict = failed ? '✖ E2E SUITE FAILED' : '✔ E2E SUITE PASSED';
  console.log(`\n${verdict} — ${total - failed}/${total} checks across ${groups.length} flows`);
  return failed;
}

// ── Entry ────────────────────────────────────────────────────────────────────

const launched = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;

if (import.meta.url === launched) {
  const opts = parseArgs(process.argv.slice(2));
  let flows = await loadFlows();
  if (opts.only) {
    const wanted = new Set(opts.only);
    const missing = opts.only.filter(id => !flows.some(f => f.id === id));
    if (missing.length) {
      console.log(`no such flow: ${missing.join(', ')} — have ${flows.map(f => f.id).join(', ')}`);
      process.exit(2);
    }
    flows = flows.filter(f => wanted.has(f.id));
  }
  try {
    process.exit(await run(flows, opts) ? 1 : 0);
  } catch (err) {
    section('startup');
    ok('the suite got as far as starting', false, String(err?.stack || err));
    report();
    process.exit(1);
  }
}
