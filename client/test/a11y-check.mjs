// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Accessibility suite — every control named, every route headed,
// nothing meaning-by-colour, everything clickable reachable from a keyboard.
//
// WHY THIS IS NOT A GREP. Accessibility here was put right by hand twice and
// guarded by nothing, so the next refactor quietly undoes it. A suite that read
// the JSX and counted `aria-label=` would be the same kind of proof this project
// has already been burned by: it passes because a string is present in the
// source and says nothing about whether a screen reader ever hears it. An
// aria-label on a wrapper whose child overrides it, a <label> that names no
// control, a title attribute standing in for a name — all read fine in source
// and all announce nothing.
//
// So the app is BUILT, SERVED and DRIVEN, and every judgement below is made on
// what the browser actually computed: Chrome's own accessibility tree for names
// and roles — through CDP, including each name's SOURCE, which is how "named
// only by its title attribute" becomes something this suite can prove — and
// computed style for the colour rule. A refactor that keeps the behaviour keeps
// passing; one that breaks it fails here.
//
// WHY TITLE DOES NOT COUNT. This is an iPad-first app and its screen reader is
// VoiceOver, which does not reliably announce a title attribute: a control whose
// only name is a tooltip is an unnamed control to the student using it. The name
// check therefore fails a control whose computed name came from title, even
// though its accessible name is technically non-empty. A name made only of
// symbols ("✕", "☼", "🖨") fails for the same reason — WCAG 2.4.6 asks a label
// to describe purpose, and a dingbat describes nothing.
//
// WHY REACT'S OWN PROPS ARE READ. "Clickable but not reachable from a keyboard"
// cannot be seen in the DOM: React attaches one listener at the root, so a <tr>
// carrying onClick is indistinguishable from any other <tr>. The handlers are
// therefore read off React's own per-node props (`__reactProps$…` on the host
// element), which is exact where a cursor:pointer heuristic is only a guess.
// If that introspection ever stops working the suite fails rather than quietly
// finding nothing — see "the handler scan is alive" below.
//
// WHAT IS ASSERTED, on every route the router declares and on the states that
// only exist after an interaction (a marked question, an exam being sat, a
// picker open, a profile being deleted):
//
//   names        every interactive control has a name a screen reader will say,
//                and that name is neither a tooltip nor a lone symbol
//   headings     exactly one <h1> per view
//   tab order    no positive tabindex, nothing focusable that does nothing,
//                nothing with a click handler that a keyboard cannot reach
//   labels       every field is tied to a <label> or an aria-label
//   verdict      the marking verdict sits in a live region, and that region
//                really does carry the verdict once a question is marked
//   colour       correct / incorrect is never carried by colour alone
//   skip link    it exists, it is the first tab stop, and it moves focus
//
// AND THE SUITE PROVES IT CAN FAIL. A green accessibility check is worth exactly
// as much as its ability to go red, so before the verdicts are printed a handful
// of deliberately broken controls are put into the live page and every rule
// above is required to catch its own one. A rule that has quietly stopped
// working fails there instead of passing everything for a year.
//
// Usage: node client/test/a11y-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { chromium } from '@playwright/test';
import { watchBoot, bootFailure, bootRecovery } from './support/boot-diagnostics.mjs';
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, statSync, mkdtempSync, rmSync } from 'node:fs';
import { join, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { startOnlinePlatform } from './support/online-session.mjs';

const CLIENT = fileURLToPath(new URL('../', import.meta.url));
const APP_JSX = join(CLIENT, 'src', 'App.jsx');

// ── Findings this suite is not allowed to fix ────────────────────────────────
// Real failures, in a file outside this suite's remit. They are named here so
// they cannot be lost, and this group goes RED the day one of them is fixed —
// which is the only way an entry ever gets deleted. Nothing else is exempt:
// anything not matched below fails its own group in the ordinary way.

const OUTSTANDING = [
  // Empty, and it should stay that way. An entry here exempts a real defect from
  // one of the rules below while the suite still prints a pass, so anything
  // parked here is a green run that does not mean what a reader takes it to mean.
  // The three that used to sit here — the unnamed theme toggle, the wordmark that
  // navigated from a <span>, and the history verdict carried only by colour — are
  // fixed in the app rather than exempted here.
];

// ── Assertions ───────────────────────────────────────────────────────────────

const groups = [];
let group = null;
const failures = [];
const notes = [];
// Loads that passed only after public/boot-guard.js reloaded the page once.
const bootRecoveries = [];

const section = (name) => { group = { name, pass: 0, fail: 0 }; groups.push(group); };

function ok(name, condition, detail = '') {
  if (condition) { group.pass++; return true; }
  group.fail++;
  failures.push(`${group.name} · ${name}${detail ? `\n      ${detail}` : ''}`);
  return false;
}

/** One finding per element per rule; the same control recurs on many views. */
const found = new Map();
function file(check, view, signature, detail) {
  const key = `${check} ${signature}`;
  const hit = found.get(key);
  if (hit) { hit.views.add(view); return; }
  found.set(key, { check, signature, detail, views: new Set([view]) });
}
const outstanding = (f) => OUTSTANDING.some(o => o.check === f.check && o.test(f));
const findingsFor = (check) => [...found.values()].filter(f => f.check === check && !outstanding(f));

const show = (findings) => findings
  .map(f => `${f.signature}\n        ${f.detail}\n        seen on: ${[...f.views].slice(0, 3).join(', ')}${f.views.size > 3 ? ` (+${f.views.size - 3} more)` : ''}`)
  .join('\n      ');

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// ── The app under test, built and served ─────────────────────────────────────
// Built here rather than trusted from client/dist, because a suite that audits
// last week's bundle audits last week's accessibility. The build goes to a
// directory of its own so a test run never disturbs the shipped one.

function buildApp() {
  const out = mkdtempSync(join(tmpdir(), 'pri-a11y-'));
  const vite = join(CLIENT, 'node_modules', 'vite', 'bin', 'vite.js');
  if (!existsSync(vite)) throw new Error(`vite is not installed at ${vite}`);
  const r = spawnSync(process.execPath, [vite, 'build', '--outDir', out, '--emptyOutDir', '--logLevel', 'error'],
    // A test build: flagged non-V1 screens are on so they are audited too —
    // the same three flags client/test/e2e.mjs builds with. The walk below
    // signs up a Teacher and audits /teach; the Teacher role is offered to a
    // new profile only under EXTENDED_TRACKS, so without it here the suite
    // only passes where the CI job happens to export the variable.
    { cwd: CLIENT, encoding: 'utf8', env: { ...process.env, PRI_FEATURE_PLACEMENT: '1', PRI_FEATURE_EXTENDED_TRACKS: '1', PRI_FEATURE_AUSTRALIA: '1' } });
  if (r.status !== 0) throw new Error(`the build failed:\n${r.stdout || ''}${r.stderr || ''}`);
  if (!existsSync(join(out, 'index.html'))) throw new Error('the build emitted no index.html');
  return out;
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
  '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon'
};

async function serve(dir) {
  const server = createServer((req, res) => {
    const path = decodeURIComponent((req.url || '/').split('?')[0]);
    let target = join(dir, path);
    // one page, many routes: an unknown path is a route, not a missing file
    if (!target.startsWith(dir) || !existsSync(target) || statSync(target).isDirectory()) target = join(dir, 'index.html');
    res.writeHead(200, { 'Content-Type': MIME[extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(readFileSync(target));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

// ── The audit, run inside the page ───────────────────────────────────────────
// Everything below executes in the browser against the rendered document, and
// is deliberately closure-free so it can be handed straight to page.evaluate().

function auditPage() {
  // The tokens the app paints a verdict in. --m1/--m5 are the ends of the
  // mastery ramp and are what the home page colours right and wrong with.
  const VERDICT_TOKENS = ['--good', '--bad', '--warn', '--good-soft', '--bad-soft', '--warn-soft', '--m1', '--m5'];
  const MARKS = /[✓✔✗✘✕✖✅❌●▲▼◐⚠★☆·→←]/;      // the app's own non-colour marks
  const HAS_WORD = /\p{L}/u;

  const NAMED_SEL = [
    'a[href]', 'button', 'summary',
    '[role="button"]', '[role="link"]', '[role="menuitem"]',
    '[role="menuitemcheckbox"]', '[role="menuitemradio"]', '[role="tab"]', '[role="switch"]'
  ].join(', ');
  const FIELD_SEL = 'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]), select, textarea';
  const NATIVELY_FOCUSABLE = 'a[href], button, input, select, textarea, summary, audio[controls], video[controls], iframe';
  const INTERACTIVE_ROLES = new Set([
    'button', 'link', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'tab', 'checkbox',
    'radio', 'switch', 'option', 'slider', 'spinbutton', 'combobox', 'textbox', 'searchbox'
  ]);

  const el2str = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    const cls = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
    if (cls.length) s += '.' + cls.join('.');
    const label = el.getAttribute('aria-label') || el.textContent || '';
    const text = label.replace(/\s+/g, ' ').trim().slice(0, 40);
    return text ? `${s} “${text}”` : s;
  };

  const shown = (el) => {
    if (!el.getClientRects().length) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0';
  };

  const hiddenFromAT = (el) => {
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      if (n.getAttribute('aria-hidden') === 'true' || n.hasAttribute('hidden')) return true;
    }
    return false;
  };

  const focusable = (el) => {
    if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') return false;
    const ti = el.getAttribute('tabindex');
    if (ti !== null) return Number(ti) >= 0;
    return el.matches(NATIVELY_FOCUSABLE) && !(el.tagName === 'A' && !el.hasAttribute('href'));
  };
  const interactive = (el) => {
    const role = el.getAttribute('role');
    if (role && INTERACTIVE_ROLES.has(role)) return true;
    if (el.matches(NATIVELY_FOCUSABLE)) return !(el.tagName === 'A' && !el.hasAttribute('href'));
    return el.isContentEditable;
  };

  /** React's own props for a host element, or null if it owns none. */
  const reactProps = (el) => {
    for (const key in el) if (key.charCodeAt(0) === 95 && key.startsWith('__reactProps$')) return el[key];
    return null;
  };

  // ── the verdict colours, resolved the way the browser resolved them ──
  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;left:-9999px;top:0';
  document.body.appendChild(probe);
  const rootStyle = getComputedStyle(document.documentElement);
  const verdictColours = new Map();
  for (const token of VERDICT_TOKENS) {
    const raw = rootStyle.getPropertyValue(token).trim();
    if (!raw) continue;
    probe.style.color = '';
    probe.style.color = raw;
    const resolved = getComputedStyle(probe).color;
    if (resolved && resolved !== 'rgba(0, 0, 0, 0)') verdictColours.set(resolved, token);
  }
  probe.remove();

  const out = {
    headings: [], unnamedFields: [], positiveTabindex: [], inertFocusable: [],
    unreachable: [], colourOnly: [], liveRegions: [],
    counts: { controls: 0, fields: 0, elements: 0, handlers: 0, colours: verdictColours.size }
  };

  for (const h of document.querySelectorAll('h1, [role="heading"][aria-level="1"]')) {
    if (!hiddenFromAT(h)) out.headings.push((h.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60) || '(empty)');
  }

  // Controls are tagged in document order so Chrome's accessibility tree can be
  // matched back to the element it belongs to without a second query.
  let n = 0;
  for (const el of document.querySelectorAll(NAMED_SEL)) {
    if (!shown(el) || hiddenFromAT(el)) continue;
    el.setAttribute('data-a11y-n', String(n++));
    out.counts.controls++;
  }

  for (const el of document.querySelectorAll(FIELD_SEL)) {
    if (!shown(el) || hiddenFromAT(el)) continue;
    out.counts.fields++;
    const labelled =
      !!(el.getAttribute('aria-label') || '').trim() ||
      !!(el.getAttribute('aria-labelledby') || '').trim() ||
      !!el.closest('label') ||
      (!!el.id && !!document.querySelector(`label[for="${CSS.escape(el.id)}"]`));
    if (!labelled) {
      const via = el.getAttribute('placeholder') ? 'its placeholder alone'
        : el.getAttribute('title') ? 'its title alone' : 'nothing at all';
      out.unnamedFields.push({ el: el2str(el), detail: `no <label> and no aria-label — named by ${via}` });
    }
  }

  for (const el of document.querySelectorAll('[tabindex]')) {
    const v = Number(el.getAttribute('tabindex'));
    if (Number.isFinite(v) && v > 0) out.positiveTabindex.push({ el: el2str(el), detail: `tabindex="${v}" jumps the document order` });
  }

  for (const el of document.querySelectorAll('*')) {
    out.counts.elements++;
    if (!shown(el)) continue;
    const hidden = hiddenFromAT(el);

    if (focusable(el) && !interactive(el) && !hidden) {
      out.inertFocusable.push({ el: el2str(el), detail: 'is a tab stop but is neither a control nor given an interactive role' });
    }

    const props = reactProps(el);
    if (props && typeof props.onClick === 'function') {
      out.counts.handlers++;
      if (!focusable(el) && !interactive(el)) {
        out.unreachable.push({
          el: el2str(el),
          detail: 'carries an onClick but is not focusable and has no interactive role — a keyboard can never fire it'
        });
      }
    }

    if (!hidden) {
      const cs = getComputedStyle(el);
      const parent = el.parentElement ? getComputedStyle(el.parentElement) : null;
      const channels = [];
      if (verdictColours.has(cs.color) && (!parent || parent.color !== cs.color)) channels.push(`text ${verdictColours.get(cs.color)}`);
      if (verdictColours.has(cs.backgroundColor)) channels.push(`background ${verdictColours.get(cs.backgroundColor)}`);
      for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
        if (parseFloat(cs[`border${side}Width`]) > 0 && verdictColours.has(cs[`border${side}Color`])) {
          channels.push(`border ${verdictColours.get(cs[`border${side}Color`])}`);
          break;
        }
      }
      if (channels.length) {
        const words = `${el.getAttribute('aria-label') || ''} ${el.textContent || ''}`.trim();
        if (!HAS_WORD.test(words) && !MARKS.test(words)) {
          out.colourOnly.push({ el: el2str(el), detail: `${channels.join(', ')}, with no word or mark carrying the same meaning` });
        }
      }
    }
  }

  // A <label> wrapping a display:none file input is the classic dead control:
  // a pointer can click it, and a keyboard has nothing to land on, because a
  // hidden input is not focusable and a label is not a control.
  for (const el of document.querySelectorAll('label')) {
    if (!shown(el) || hiddenFromAT(el)) continue;
    const controls = [...el.querySelectorAll('input, select, textarea, button')];
    const forId = el.getAttribute('for');
    if (forId) { const t = document.getElementById(forId); if (t) controls.push(t); }
    if (controls.length && !controls.some(c => shown(c) && focusable(c))) {
      out.unreachable.push({ el: el2str(el), detail: 'is a <label> whose only control cannot be focused — clickable with a pointer, dead to a keyboard' });
    }
  }

  for (const el of document.querySelectorAll('[aria-live], [role="status"], [role="alert"]')) {
    out.liveRegions.push({
      el: el2str(el),
      politeness: el.getAttribute('aria-live') || (el.getAttribute('role') === 'alert' ? 'assertive' : 'polite'),
      text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 140)
    });
  }
  return out;
}

/** Descriptions for the elements the audit tagged, in the same document order. */
function describeTagged() {
  return [...document.querySelectorAll('[data-a11y-n]')]
    .sort((a, b) => Number(a.dataset.a11yN) - Number(b.dataset.a11yN))
    .map(el => {
      let s = el.tagName.toLowerCase();
      if (el.id) s += '#' + el.id;
      const cls = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
      if (cls.length) s += '.' + cls.join('.');
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
      return text ? `${s} “${text}”` : s;
    });
}

const clearTags = () => { for (const el of document.querySelectorAll('[data-a11y-n]')) el.removeAttribute('data-a11y-n'); };

// ── Names, straight out of Chrome's accessibility tree ───────────────────────
// getFullAXTree carries, for every node, the name Chrome computed AND every
// source it considered — aria-labelledby, aria-label, a <label>, the element's
// own contents, the placeholder, the title — marking which won and which were
// superseded. That is what makes "this control is named by its tooltip"
// provable rather than inferred.

const NAME_SOURCE = (src) => {
  if (!src) return 'nothing';
  if (src.type === 'relatedElement') return src.attribute === 'aria-labelledby' ? 'aria-labelledby' : (src.nativeSource || 'a related element');
  if (src.type === 'contents') return 'its own text';
  if (src.type === 'attribute') return src.attribute;
  return src.type;
};

async function namesOnThisView(cdp, page) {
  const tagged = await page.evaluate(describeTagged);
  if (!tagged.length) return [];

  const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
  const backends = [];
  (function walk(node) {
    const attrs = node.attributes || [];
    for (let i = 0; i < attrs.length; i += 2) {
      if (attrs[i] === 'data-a11y-n') backends[Number(attrs[i + 1])] = node.backendNodeId;
    }
    for (const child of node.children || []) walk(child);
    if (node.contentDocument) walk(node.contentDocument);
  })(root);

  const { nodes } = await cdp.send('Accessibility.getFullAXTree');
  const byBackend = new Map();
  for (const node of nodes) if (node.backendDOMNodeId != null) byBackend.set(node.backendDOMNodeId, node);

  return tagged.map((sig, i) => {
    const ax = byBackend.get(backends[i]);
    if (!ax) return { sig, name: '', source: 'nothing', missing: true };
    const sources = ax.name?.sources || [];
    const used = sources.find(s => s.value?.value && !s.superseded && !s.invalid);
    return {
      sig,
      role: ax.role?.value || '',
      name: (ax.name?.value || '').trim(),
      source: NAME_SOURCE(used),
      ignored: !!ax.ignored
    };
  });
}

// ── Routes, taken from the router itself ─────────────────────────────────────
// The one thing read from source, and only to enumerate what has to be walked:
// a route added to App.jsx and never driven here would otherwise go unaudited
// forever. Every assertion is still made against the rendered page.

function declaredRoutes() {
  return [...new Set([...readFileSync(APP_JSX, 'utf8').matchAll(/<Route\s+path="([^"]+)"/g)].map(m => m[1]))];
}

// ── The deliberately broken controls ─────────────────────────────────────────
// Injected into the live page so every rule has to catch its own one. The fake
// React props key is how the keyboard-reachability rule is exercised: it is the
// same shape React puts on a host element, read the same way.

function plantBrokenControls() {
  const box = document.createElement('div');
  box.id = 'a11y-selftest';
  box.innerHTML = `
    <h1>a second h1</h1>
    <button id="st-nameless"></button>
    <button id="st-title" title="Only a tooltip"></button>
    <button id="st-symbol">✱</button>
    <div id="st-positive" tabindex="4">positive tabindex</div>
    <div id="st-inert" tabindex="0">focusable, does nothing</div>
    <input id="st-field" type="text" placeholder="unlabelled">
    <span id="st-colour" style="color: var(--bad)">7</span>
    <div id="st-click">clickable div</div>
    <label id="st-deadlabel">dead label<input type="file" style="display:none"></label>`;
  document.body.appendChild(box);
  box.querySelector('#st-click').__reactProps$selftest = { onClick() { } };
  return true;
}

const uprootBrokenControls = () => { document.getElementById('a11y-selftest')?.remove(); };

// ── Driving the app ──────────────────────────────────────────────────────────

const SETTLE = 260;
const wait = (page, ms) => page.waitForTimeout(ms);

/** Click the first visible control matching, or throw so the view is recorded. */
async function click(page, selector, { text = null, timeout = 5000 } = {}) {
  let loc = page.locator(selector);
  if (text) loc = loc.filter({ hasText: text });
  const target = loc.first();
  await target.waitFor({ state: 'visible', timeout });
  await target.click({ timeout });
  await wait(page, SETTLE);
}

async function signInToDemo(page, base) {
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.auth-wrap, .shell', { timeout: 20000 });
  await wait(page, 500);
  if (await page.locator('.shell').count()) return;

  const started = page.getByRole('button', { name: 'Use without an account' });
  if (await started.count()) { await started.click(); await wait(page, 300); }
  const addAnother = page.getByRole('button', { name: /Add another profile/ });
  if (await addAnother.count()) { await addAnother.click(); await wait(page, 300); }

  await page.waitForSelector('[data-onboarding-step="1"]', { timeout: 10000 });
  await page.getByRole('button', { name: 'Student', exact: true }).click();
  await click(page, '.auth-card .btn-primary');
  await page.waitForSelector('[data-onboarding-step="2"]');
  await page.getByRole('button', { name: /Studying in Australia/ }).click();
  await page.locator('#signup-course').selectOption('nsw');
  await page.locator('#signup-year').selectOption('10');
  await click(page, '.auth-card .btn-primary');
  await page.waitForSelector('[data-onboarding-step="3"]');
  await page.locator('#signup-name').fill('Accessibility Student');
  await click(page, '.auth-card .btn-primary');
  await page.waitForSelector('[data-onboarding-step="4"]');
  await click(page, '.auth-card .btn-primary');
  await page.waitForSelector('[data-onboarding-step="5"]');
  await page.getByRole('button', { name: 'Start learning' }).click();
  await page.waitForSelector('.shell', { timeout: 30000 });
  await wait(page, 900);
}

async function goTo(page, base, path) {
  // A route that never shows the app (seen in CI on a second visit to /exams
  // and to /teach, never locally) must say what WAS happening: the bundle not
  // running, a chunk that failed or came back as the wrong kind of file, the
  // root error boundary, a page still loading — different faults that
  // "Timeout 20000ms exceeded" does not tell apart. support/boot-diagnostics
  // records them for this one load. No retry: a second load would hide it.
  const watch = watchBoot(page);
  try {
    await page.goto(base + path, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.shell, .auth-wrap', { timeout: 20000 });
  } catch (err) {
    throw await bootFailure(err, watch, `${path} never showed the app`);
  }
  // A load that needed the page's one automatic reload passed, and says so.
  const recovered = await bootRecovery(watch, page, path);
  if (recovered) bootRecoveries.push(recovered);
  watch.stop();
  await wait(page, 700);
}

/**
 * Practice legitimately serves MCQ questions, which have no Type/Write/Photo
 * mode tabs. Accessibility coverage for handwriting must therefore select a
 * question that actually exposes those controls instead of assuming the first
 * random/local question is writable. The test still fails closed if the normal
 * Next-question path cannot reach one.
 */
async function reachAnswerModeQuestion(page, base, { attempts = 20 } = {}) {
  await goTo(page, base, '/practice');
  await page.waitForSelector('.q-prompt', { timeout: 30000 });

  for (let i = 0; i <= attempts; i++) {
    if (await page.locator('.mode-tab').count() >= 3) return;
    if (i === attempts) break;

    const next = page.locator('.ctx-next').first();
    await next.waitFor({ state: 'visible', timeout: 5000 });
    await next.click({ timeout: 5000 });
    await page.waitForSelector('.q-prompt', { timeout: 30000 });
    await wait(page, SETTLE);
  }

  throw new Error('no Type/Write/Photo practice question reachable within the bounded search');
}

// ── The suite ────────────────────────────────────────────────────────────────

async function run() {
  section('setup');
  let dist = null, server = null, browser = null, platform = null;
  let online = null;
  const refusals = {};
  const routesSeen = new Set();
  const views = [];
  const skipped = [];
  let liveVerdict = null;
  let skipLink = null;
  let selfTest = null;

  try {
    dist = buildApp();
    ok('the app under test builds from source', true);
    // Only Pri's server marks (owner decision 2026-10-10), so the marked
    // states can only be walked against a server: the build is served by the
    // real platform server (support/online-session.mjs) from its own origin.
    // The walk starts signed out — every screen up to the first refused check
    // is audited as a signed-out student sees it — and signs in on the card.
    platform = await startOnlinePlatform({ dist });
    const BASE = platform.origin;
    ok('the build is being served', !!BASE);

    browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    online = platform.session(ctx, page);
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Accessibility.enable');
    await cdp.send('DOM.enable');

    /** Read whatever is on screen right now and file everything it finds. */
    async function inspect() {
      const res = await page.evaluate(auditPage);
      const named = await namesOnThisView(cdp, page);
      await page.evaluate(clearTags);
      return { res, named };
    }

    const nameFault = (c) => {
      if (!c.name) return 'has no accessible name — a screen reader announces only its role';
      if (c.source === 'title') return `is named "${c.name}" by its title attribute alone — VoiceOver on iPadOS will not say it`;
      if (c.source === 'placeholder') return `is named "${c.name}" by its placeholder alone`;
      if (!/\p{L}|\p{N}/u.test(c.name)) return `is named "${c.name}" — a symbol is not a name`;
      return null;
    };

    async function audit(view, route) {
      if (route) routesSeen.add(route);
      const { res, named } = await inspect();
      views.push({
        view, headings: res.headings.length, controls: res.counts.controls,
        fields: res.counts.fields, elements: res.counts.elements, handlers: res.counts.handlers,
        colours: res.counts.colours
      });

      if (res.headings.length !== 1) {
        file('headings', view, view,
          res.headings.length === 0 ? 'no <h1> at all' : `${res.headings.length} <h1>s: ${res.headings.join(' | ')}`);
      }
      for (const c of named) {
        if (c.ignored) continue;
        const fault = nameFault(c);
        if (fault) file('names', view, c.sig, fault);
      }
      for (const f of res.unnamedFields) file('labels', view, f.el, f.detail);
      for (const f of res.positiveTabindex) file('tabindex', view, f.el, f.detail);
      for (const f of res.inertFocusable) file('inert', view, f.el, f.detail);
      for (const f of res.unreachable) file('reachable', view, f.el, f.detail);
      for (const f of res.colourOnly) file('colour', view, f.el, f.detail);
      return res;
    }

    const step = async (view, route, drive) => {
      try {
        await drive();
        await audit(view, route);
      } catch (err) {
        skipped.push(`${view} — ${String(err.message || err).split('\n')[0].slice(0, 620)}`);
      }
    };

    // ── signed out: the landing page ─────────────────────────────────────────
    await step('login · hero', '/', async () => {
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.auth-wrap', { timeout: 20000 });
      await wait(page, 600);
    });

    // ── the skip link, measured on a page nothing has focused yet ────────────
    try {
      await signInToDemo(page, BASE);
      await page.evaluate(() => document.body.focus());
      await page.keyboard.press('Tab');
      const first = await page.evaluate(() => {
        const el = document.activeElement;
        return el ? { tag: el.tagName.toLowerCase(), text: (el.textContent || '').trim(), href: el.getAttribute('href') || '' } : null;
      });
      await page.keyboard.press('Enter');
      await wait(page, 300);
      const landed = await page.evaluate(() => {
        const el = document.activeElement;
        const main = document.querySelector('main');
        return { tag: el?.tagName.toLowerCase() || '', id: el?.id || '', inMain: !!(main && (el === main || main.contains(el))) };
      });
      skipLink = { first, landed };
    } catch (err) {
      skipLink = { error: String(err.message || err) };
    }

    // ── back out to the signed-out screens, now that a profile exists ────────
    await step('login · pick a profile', '/', async () => {
      await click(page, '.user-chip');
      await click(page, '[role="menuitem"]', { text: 'Switch profile' });
      await page.waitForSelector('.auth-wrap', { timeout: 15000 });
      await wait(page, 500);
    });

    await step('login · onboarding role', '/', async () => {
      await click(page, 'button.btn-ghost', { text: 'Add another profile' });
    });

    await step('login · onboarding curriculum', '/', async () => {
      await page.getByRole('button', { name: 'Student', exact: true }).click();
      await click(page, '.auth-card .btn-primary');
    });

    await step('login · onboarding protection', '/', async () => {
      await page.locator('#signup-track').selectOption('10');
      await click(page, '.auth-card .btn-primary');
      await page.locator('#signup-name').fill('Accessibility Draft');
      await click(page, '.auth-card .btn-primary');
      await page.getByRole('checkbox').first().check();
      await wait(page, SETTLE);
    });

    // ── signed in ────────────────────────────────────────────────────────────
    await signInToDemo(page, BASE);

    await step('home', '/', async () => { await goTo(page, BASE, '/'); });

    await step('home · generator open', '/', async () => {
      await goTo(page, BASE, '/');
      await click(page, '.genbar-toggle');
    });

    for (const label of ['Course', 'Topics', 'Dot Points', 'Difficulty']) {
      await step(`home · generator · ${label.toLowerCase()}`, '/', async () => {
        const tab = page.locator('.gen-cat', { hasText: label }).first();
        if (await tab.isDisabled()) {
          // walk far enough into the flow that this pane has something to show
          await click(page, '.gen-cat', { text: 'Course' });
          await click(page, '.gen-pane .gen-opt');
          await click(page, '.gen-pane .gen-opt');
        }
        await click(page, '.gen-cat', { text: label });
      });
    }

    await step('account menu open', '/', async () => {
      await goTo(page, BASE, '/');
      await click(page, '.user-chip');
    });

    await step('practice · a question', '/practice', async () => {
      await goTo(page, BASE, '/practice');
      await page.waitForSelector('.q-prompt', { timeout: 30000 });
      await wait(page, 600);
    });

    await step('practice · symbol palette + working', '/practice', async () => {
      const sym = page.locator('.editor-tool').first();
      if (await sym.count()) await sym.click();
      const wk = page.getByRole('button', { name: /Show working for partial credit/ });
      if (await wk.count()) await wk.click();
      await wait(page, SETTLE);
    });

    await step('practice · scribble pad', '/practice', async () => {
      await click(page, '.q-rail-btn[aria-label="Scratch"]');
    });

    await step('practice · handwriting mode', '/practice', async () => {
      await reachAnswerModeQuestion(page, BASE);
      await click(page, '.mode-tab:nth-child(2)');
      await page.waitForSelector('.ink-answer', { timeout: 30000 });
      await wait(page, 700);
    });

    // written on, so the reading panel and its tap-to-correct picker are real
    await step('practice · handwriting read back', '/practice', async () => {
      const box = await page.locator('.ink-canvas-live').boundingBox();
      const draw = async (points) => {
        await page.mouse.move(box.x + points[0][0], box.y + points[0][1]);
        await page.mouse.down();
        for (const [dx, dy] of points.slice(1)) await page.mouse.move(box.x + dx, box.y + dy, { steps: 8 });
        await page.mouse.up();
        await wait(page, 120);
      };
      await draw([[70, 50], [70, 105], [120, 105]]);
      await draw([[150, 50], [150, 105]]);
      // Server-only reading (owner decision): with no reader in this harness
      // the page shows the reading/waiting status rather than a local reading.
      // Signed out (as this walk is here) the page shows the in-card sign-in
      // for the kept ink instead: that state is what gets audited.
      // Any ONE of them rendered: a hidden .ink-status sits earlier in the
      // document than the visible in-card sign-in, so they are not waited for
      // as one selector list.
      await page.waitForFunction(() => [...document.querySelectorAll('.ink-preview, .ink-status, [data-ink-account-recovery]')]
        .some(el => el.getClientRects().length > 0), null, { timeout: 20000 })
        .catch(async err => { throw new Error(`${String(err.message).split('\n')[0]} · on screen: ${JSON.stringify(await page.evaluate(() => ({
          recovery: !!document.querySelector('[data-ink-account-recovery]'), status: document.querySelector('.ink-status')?.textContent || null,
          notice: !!document.querySelector('[data-check-needs-account]'), foot: (document.querySelector('.ws-actions')?.innerText || '').replace(/\s+/g, ' ').slice(0, 120),
          canvas: !!document.querySelector('.ink-canvas-live') })))}`.slice(0, 600)); });
      await wait(page, 600);
    });

    await step('practice · photo mode', '/practice', async () => {
      await reachAnswerModeQuestion(page, BASE);
      await click(page, '.mode-tab:nth-child(3)');
      await wait(page, 500);
    });

    // ── online-only checking: the states a refused check puts on the card ────
    // What the live regions say (the spoken refusal), read the same way the
    // marked verdict is read below.
    const spokenNow = () => page.evaluate(() =>
      [...document.querySelectorAll('[aria-live="polite"], [aria-live="assertive"], [role="status"], [role="alert"]')]
        .map(r => (r.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean));
    const typedQuestion = async () => {
      await goTo(page, BASE, '/practice');
      await page.waitForSelector('.q-prompt', { timeout: 30000 });
      for (let i = 0; i < 20; i++) {
        const typeTab = page.locator('.mode-tab').first();
        if (await typeTab.count()) { await typeTab.click(); await wait(page, 250); }
        if (await page.locator('.editor-body input.answer-input').count() === 1) return page.locator('.editor-body input.answer-input');
        await page.locator('.ctx-next').first().click();
        await page.waitForSelector('.q-prompt', { timeout: 30000 });
        await wait(page, SETTLE);
      }
      throw new Error('no typed-answer practice question reachable within the bounded search');
    };
    const pressSubmit = async () => {
      await page.getByRole('button', { name: /Submit answer/ }).click();
      await page.waitForSelector('[data-check-refusal]', { timeout: 20000 });
      await wait(page, 400);
    };

    // signed out, before Submit: the card already says checking needs an account
    await step('practice · signed out, account needed', '/practice', async () => {
      const input = await typedQuestion();
      await input.fill('99901');
      await page.waitForSelector('[data-check-needs-account]', { timeout: 15000 });
      refusals.notice = await page.evaluate(() => {
        const g = document.querySelector('[data-check-needs-account]');
        const b = g?.querySelector('[data-check-sign-in]');
        return { role: g?.getAttribute('role'), label: g?.getAttribute('aria-label'), text: (g?.textContent || '').replace(/\s+/g, ' ').trim(),
          button: b ? { tag: b.tagName.toLowerCase(), expanded: b.getAttribute('aria-expanded'), name: (b.textContent || '').trim() } : null };
      });
    });

    // signed out, Submit pressed: refused, with the sign-in in the card
    await step('practice · signed out, check refused', '/practice', async () => {
      await pressSubmit();
      refusals.signIn = {
        kind: await page.locator('[data-check-refusal]').first().getAttribute('data-check-refusal'),
        spoken: await spokenNow(),
        result: await page.locator('.eval-card, .verdict-bad, .eval-marks, .solution-block').count()
      };
    });

    // the sign-in opened in place: its fields, and where the keyboard goes next
    await step('practice · sign-in on the card', '/practice', async () => {
      const button = page.locator('.verdict [data-check-sign-in]');
      await button.focus();
      await page.keyboard.press('Enter');
      await page.waitForSelector('.qpage [data-signin-card] #signup-destination', { timeout: 20000 });
      await wait(page, 500);
      // Focus order: from the button that opened it, Tab goes into the panel
      // it opened (inside the card), not on past it to the rest of the page.
      await button.focus();
      const stops = [];
      for (let i = 0; i < 4; i++) {
        await page.keyboard.press('Tab');
        stops.push(await page.evaluate(() => {
          const el = document.activeElement;
          const card = document.querySelector('.qpage .verdict');
          return { tag: el?.tagName.toLowerCase() || '', id: el?.id || '', text: (el?.textContent || '').trim().slice(0, 30), inRefusal: !!(card && el && card.contains(el)) };
        }));
      }
      refusals.focus = { expanded: await button.getAttribute('aria-expanded'), stops };
    });

    // signed in on the card (the real server, a real verified account)
    try {
      await online.signInHere(page.locator('.qpage'), { name: 'Accessibility Student' });
      await page.waitForFunction(() => !document.querySelector('.qpage [data-signin-card]'), null, { timeout: 30000 }).catch(() => { });
      refusals.signedIn = true;
    } catch (err) {
      skipped.push(`practice · signing in on the card — ${String(err.message || err).split('\n')[0].slice(0, 130)}`);
    }

    // signed in, but the account may not check yet: the server's own refusal
    // (email not verified), produced by the real server for this account.
    await step('practice · account blocker', '/practice', async () => {
      const verifiedAt = platform.db.prepare('SELECT email_verified_at AS at FROM accounts WHERE id=?').get(online.account.id).at;
      platform.db.prepare('UPDATE accounts SET email_verified_at=NULL WHERE id=?').run(online.account.id);
      try {
        const input = await typedQuestion();
        await input.fill('99902');
        await pressSubmit();
        refusals.blocker = {
          kind: await page.locator('[data-check-refusal]').first().getAttribute('data-check-refusal'),
          spoken: await spokenNow(),
          link: await page.locator('.verdict [data-check-account]').evaluate(a => ({ tag: a.tagName.toLowerCase(), href: a.getAttribute('href'), name: (a.textContent || '').trim() })).catch(() => null),
          result: await page.locator('.eval-card, .verdict-bad, .eval-marks, .solution-block').count()
        };
      } finally {
        platform.db.prepare('UPDATE accounts SET email_verified_at=? WHERE id=?').run(verifiedAt, online.account.id);
      }
    });

    // signed in, the connection gone: reconnect asked, with a Try again
    await step('practice · reconnect asked', '/practice', async () => {
      const input = await typedQuestion();
      await input.fill('99903');
      await online.disconnect();
      try {
        await pressSubmit();
        refusals.reconnect = {
          kind: await page.locator('[data-check-refusal]').first().getAttribute('data-check-refusal'),
          spoken: await spokenNow(),
          retry: await page.locator('.verdict [data-check-retry]').evaluate(b => ({ tag: b.tagName.toLowerCase(), name: (b.textContent || '').trim(), disabled: b.disabled })).catch(() => null),
          result: await page.locator('.eval-card, .verdict-bad, .eval-marks, .solution-block').count()
        };
      } finally {
        await online.reconnect();
      }
    });

    // the marked state — the verdict, the evaluation card and the criteria table
    await step('practice · marked', '/practice', async () => {
      // Signed in by now: the verdict is the server's. A typed question, so the
      // two misses below are what resolves it (the answer left in the box by
      // the refused checks above is simply the first of them).
      let input = await typedQuestion();
      // The question the refused checks were made on may already carry a first
      // miss; "says nothing before an answer is marked" is measured on a fresh one.
      if (await page.locator('.verdict-bad, .eval-card').count()) {
        await page.locator('.ctx-next').first().click();
        await page.waitForSelector('.q-prompt', { timeout: 30000 });
        await wait(page, SETTLE);
        input = await typedQuestion();
      }
      const before = await page.evaluate(() => {
        const r = document.querySelector('[aria-live], [role="status"]');
        return r ? (r.textContent || '').trim() : null;
      });
      for (let attempt = 0; attempt < 3 && !(await page.locator('.eval-card').count()); attempt++) {
        await input.fill(`999${attempt}1`);
        const submit = page.getByRole('button', { name: /Submit answer/ });
        if (!(await submit.count())) break;
        await submit.click();
        await page.waitForSelector(attempt ? '.eval-card, .verdict-bad' : '.verdict-bad, .eval-card', { timeout: 20000 }).catch(() => { });
        await wait(page, 900);
      }
      if (!(await page.locator('.eval-card').count())) {
        const reveal = page.getByRole('button', { name: 'Show solution' });
        if (await reveal.count()) { await reveal.click(); await reveal.click(); await wait(page, 1400); }
      }
      await page.waitForSelector('.eval-card', { timeout: 20000 });
      const after = await page.evaluate(() =>
        [...document.querySelectorAll('[aria-live="polite"], [aria-live="assertive"], [role="status"], [role="alert"]')]
          .map(r => (r.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean));
      liveVerdict = { before, after, grades: (await online.practiceCalls(/^\/v1\/practice\/[^/]+\/(?:submit|reveal)$/)).filter(c => c.status === 200 && c.json?.authoritative === true).length };
    });

    await step('progress · overview', '/progress', async () => {
      await goTo(page, BASE, '/progress');
      await page.waitForSelector('.band-card, .skeleton', { timeout: 20000 });
      await wait(page, 900);
    });

    await step('progress · priorities', '/progress', async () => {
      await click(page, '.page-tab', { text: 'Priorities' });
      await wait(page, 700);
    });

    await step('progress · knowledge map', '/progress', async () => {
      await click(page, '.page-tab', { text: 'Knowledge map' });
      await wait(page, 1200);
    });

    await step('progress · knowledge map · curriculum', '/progress', async () => {
      await click(page, '.kmap-foot .btn');
      await wait(page, 600);
    });

    await step('progress · knowledge map · a year opened', '/progress', async () => {
      await click(page, '.kmap-panel .nav-item');
      await wait(page, 500);
    });

    // This walk's profile is Australian, so the placement route renders its
    // India-only notice; the India intro, question and map views are driven by
    // tour-placement.js in the end-to-end suite.
    await step('placement', '/placement', async () => {
      await goTo(page, BASE, '/placement');
      await page.waitForSelector('.card', { timeout: 20000 });
      await wait(page, 400);
    });

    // "Practise this": the photo picker before any photo is chosen. The read
    // result and failure states are driven by tour-photo-practise.js.
    await step('practise this · photo', '/practise-photo', async () => {
      await goTo(page, BASE, '/practise-photo');
      await page.waitForSelector('[data-photo-practise]', { timeout: 20000 });
      await wait(page, 300);
    });

    await step('tasks', '/tasks', async () => { await goTo(page, BASE, '/tasks'); });

    await step('tasks · new task', '/tasks', async () => {
      await click(page, 'button.btn-primary', { text: 'Set myself a task' });
    });

    await step('exams', '/exams', async () => { await goTo(page, BASE, '/exams'); });

    await step('exam room · sitting a paper', '/exams/:id', async () => {
      await goTo(page, BASE, '/exams');
      await click(page, 'button.btn-primary', { text: 'Start practice paper' });
      await page.waitForSelector('.exam-nav', { timeout: 60000 }).catch(async err => {
        throw new Error(`${String(err.message).split('\n')[0]} · on screen: ${JSON.stringify((await page.locator('[role="alert"]').allInnerTexts()).map(t => t.replace(/\s+/g, ' ').slice(0, 200)))} · last server calls ${JSON.stringify(online.calls.slice(-4).map(c => `${c.status} ${c.path}`))}`);
      });
      await wait(page, 900);
      const wk = page.getByRole('button', { name: /Show working for partial credit/ });
      if (await wk.count()) { await wk.click(); await wait(page, SETTLE); }
    });

    await step('exam room · marked paper', '/exams/:id', async () => {
      await click(page, '.exam-head .btn', { text: 'Review and submit' });
      await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
      await click(page, '[role="dialog"] button.btn-primary', { text: 'Submit paper' });
      await page.waitForSelector('.hero-num', { timeout: 60000 });
      await wait(page, 900);
    });

    await step('exams · printable paper', '/exams', async () => {
      await goTo(page, BASE, '/exams');
      await click(page, '.prio-item .btn-quiet');
      await page.waitForSelector('.paper-overlay', { timeout: 20000 });
      await wait(page, 700);
    });

    await step('rapid fire · lobby', '/rush', async () => { await goTo(page, BASE, '/rush'); });

    await step('rapid fire · running', '/rush', async () => {
      await click(page, 'button.btn-primary', { text: 'Start Rush' });
      await page.waitForSelector('.rush-timer', { timeout: 40000 });
      await wait(page, 700);
    });

    await step('match · lobby', '/match', async () => {
      await goTo(page, BASE, '/match');
      await wait(page, 700);
    });

    await step('match · racing', '/match', async () => {
      await click(page, 'button.btn-primary', { text: 'Play' });
      await page.waitForSelector('.race-track', { timeout: 40000 });
      await wait(page, 700);
    });

    await step('plan · this week, the week grid and settings', '/plan', async () => {
      await goTo(page, BASE, '/plan');
      await page.waitForSelector('[data-plan-day]', { timeout: 20000 });
      await wait(page, 800);
    });

    await step('notes · index and chapter map', '/notes', async () => {
      await goTo(page, BASE, '/notes?class=10');
      await page.waitForSelector('.nt-map-node', { timeout: 20000 });
      await wait(page, 1200);
    });

    await step('notes · a chapter read through', '/notes/:chapterId', async () => {
      await goTo(page, BASE, '/notes/c10-quadratic-equations');
      await page.waitForSelector('.nt-formula', { timeout: 20000 });
      await page.evaluate(() => document.querySelectorAll('.nt-reveal').forEach(el => el.classList.add('is-in')));
      await wait(page, 1600);
    });

    await step('notes · revision flashcards', '/notes/:chapterId', async () => {
      await click(page, '[data-testid="notes-revise"]');
      await page.waitForSelector('.nt-card', { timeout: 10000 });
      await wait(page, 600);
      await page.keyboard.press('Escape');
    });

    await step('review · mistakes', '/review', async () => {
      await goTo(page, BASE, '/review?filter=wrong');
      await page.waitForSelector('.hist-row, .muted', { timeout: 20000 });
      await wait(page, 600);
    });

    await step('mistakes · compatibility redirect', '/mistakes', async () => {
      await goTo(page, BASE, '/mistakes');
      await page.waitForSelector('.hist-row, .muted', { timeout: 20000 });
      await wait(page, 600);
    });

    await step('favorites · compatibility redirect', '/favorites', async () => { await goTo(page, BASE, '/favorites'); });

    await step('favorites · saved questions', '/favorites', async () => {
      await goTo(page, BASE, '/review');
      await click(page, '.hist-star');
      await goTo(page, BASE, '/favorites');
      await page.waitForSelector('.hist-row', { timeout: 20000 });
      await wait(page, 600);
    });

    await step('classes', '/classes', async () => { await goTo(page, BASE, '/classes'); });

    await step('history · compatibility redirect', '/history', async () => {
      await goTo(page, BASE, '/history');
      await page.waitForSelector('.hist-row, .muted', { timeout: 20000 });
      await wait(page, 600);
    });

    await step('history · one question opened', '/history', async () => {
      await click(page, '.hist-main');
      await wait(page, 700);
    });

    await step('settings', '/settings', async () => {
      await goTo(page, BASE, '/settings');
      await wait(page, 700);
    });


    await step('settings · editing the profile', '/settings', async () => {
      await click(page, 'button.btn-ghost', { text: 'Edit' });
    });

    await step('settings · password panel', '/settings', async () => {
      await goTo(page, BASE, '/settings');
      await click(page, 'button.btn-ghost', { text: 'Set password' });
    });

    await step('settings · deleting the profile', '/settings', async () => {
      await goTo(page, BASE, '/settings');
      await click(page, 'button.btn-quiet', { text: 'Delete this profile' });
    });

    await step('settings · handwriting calibration', '/settings', async () => {
      await goTo(page, BASE, '/settings');
      await click(page, 'button.btn-primary', { text: 'Teach it your handwriting' });
      await page.waitForSelector('.ink-wrap', { timeout: 30000 });
      await wait(page, 600);
    });

    // ── the documents a store, a payment provider and the DPDP Act require ──
    // A parent reading a privacy notice on a phone with a screen reader is
    // exactly the reader these pages have to work for.
    for (const path of ['/privacy', '/terms', '/refund-policy', '/grievance']) {
      await step(`legal · ${path.slice(1)}`, path, async () => {
        await goTo(page, BASE, path);
        await wait(page, 500);
      });
    }

    // ── the redirects are routes too ──
    for (const [path, route] of [['/map', '/map'], ['/stats', '/stats'], ['/badges', '/badges'], ['/no-such-page', '*']]) {
      await step(`redirect ${path}`, route, async () => {
        await goTo(page, BASE, path);
        await wait(page, 800);
      });
    }

    // ── prove every rule can still go red ────────────────────────────────────
    try {
      await goTo(page, BASE, '/');
      await page.evaluate(plantBrokenControls);
      await wait(page, 120);
      const { res, named } = await inspect();
      const caught = (list, id) => list.some(f => f.el.includes(`#${id}`));
      selfTest = {
        headings: res.headings.length > 1,
        nameless: named.some(c => c.sig.includes('#st-nameless') && nameFault(c)?.includes('no accessible name')),
        title: named.some(c => c.sig.includes('#st-title') && nameFault(c)?.includes('title attribute alone')),
        symbol: named.some(c => c.sig.includes('#st-symbol') && nameFault(c)?.includes('a symbol is not a name')),
        positive: caught(res.positiveTabindex, 'st-positive'),
        inert: caught(res.inertFocusable, 'st-inert'),
        field: caught(res.unnamedFields, 'st-field'),
        colour: caught(res.colourOnly, 'st-colour'),
        click: caught(res.unreachable, 'st-click'),
        deadLabel: caught(res.unreachable, 'st-deadlabel')
      };
      await page.evaluate(uprootBrokenControls);
    } catch (err) {
      selfTest = { error: String(err.message || err) };
    }

    // ── the India exam room: a JEE Main paper sat partly by hand ────────────
    // The handwriting surface, the write/type switch, the multiple-choice
    // options and the section analysis only exist on an India paper.
    // ── signed out (the India profile made here has no account): marked work
    // that does not start says so in place — a paper, the placement check,
    // Rapid Fire and Match.
    const refusalBlock = selector => page.evaluate(sel => {
      const block = document.querySelector(sel);
      const button = block?.querySelector('[data-check-sign-in]');
      const icon = block?.querySelector('.verdict-ico');
      return block ? {
        kind: block.getAttribute(sel.slice(1, -1)), role: block.getAttribute('role'),
        text: (block.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200),
        iconWord: (icon?.textContent || '').trim(),
        button: button ? { tag: button.tagName.toLowerCase(), name: (button.textContent || '').trim(), expanded: button.getAttribute('aria-expanded'), disabled: button.disabled } : null
      } : null;
    }, selector);

    await step('exams · refused signed out', '/exams', async () => {
      await goTo(page, BASE, '/');
      await click(page, '.user-chip');
      await click(page, '[role="menuitem"]', { text: 'Switch profile' });
      await page.waitForSelector('.auth-wrap', { timeout: 15000 });
      await click(page, 'button.btn-ghost', { text: 'Add another profile' });
      await page.getByRole('button', { name: 'Student', exact: true }).click();
      await click(page, '.auth-card .btn-primary');
      await page.locator('#signup-track').selectOption('jee-main');
      await page.locator('#signup-year').selectOption('12');
      await click(page, '.auth-card .btn-primary');
      await page.locator('#signup-name').fill('Accessibility JEE Student');
      await click(page, '.auth-card .btn-primary');
      await click(page, '.auth-card .btn-primary');
      await page.waitForSelector('[data-onboarding-step="5"]');
      await page.getByRole('button', { name: 'Start learning' }).click();
      await page.waitForSelector('.shell', { timeout: 30000 });
      // Signed out, a paper does not start: the refusal is the state audited here.
      await goTo(page, BASE, '/exams');
      await page.getByRole('button', { name: 'Start JEE Main Mathematics simulation' }).click();
      await page.waitForSelector('[data-exam-start-refused]', { timeout: 30000 });
      await wait(page, 400);
      refusals.exam = { ...(await refusalBlock('[data-exam-start-refused]')), room: await page.locator('.exam-nav').count() };
    });

    await step('placement · refused signed out', '/placement', async () => {
      await goTo(page, BASE, '/placement?go=1');
      await page.waitForSelector('[data-placement-refused]', { timeout: 30000 });
      await wait(page, 400);
      refusals.placement = await refusalBlock('[data-placement-refused]');
    });

    await step('rapid fire · refused signed out', '/rush', async () => {
      await goTo(page, BASE, '/rush');
      await click(page, '.qcard .btn-primary.btn-lg');
      await page.waitForSelector('[data-game-refused]', { timeout: 30000 });
      await wait(page, 400);
      refusals.rush = { ...(await refusalBlock('[data-game-refused]')), clock: await page.locator('.rush-timer').count() };
    });

    await step('match · refused signed out', '/match', async () => {
      await goTo(page, BASE, '/match');
      await click(page, '.btn-glow');
      await page.waitForSelector('[data-game-refused]', { timeout: 30000 });
      await wait(page, 400);
      refusals.match = { ...(await refusalBlock('[data-game-refused]')), question: await page.locator('.q-prompt').count() };
    });

    // The India student signs in where the paper was refused (a real account on
    // the real server), and the paper — issued and marked by the server — opens.
    await step('india exam room · writing a numerical answer', '/exams/:id', async () => {
      await goTo(page, BASE, '/exams');
      await page.getByRole('button', { name: 'Start JEE Main Mathematics simulation' }).click();
      const refusedStart = page.locator('[data-exam-start-refused]');
      await refusedStart.waitFor({ state: 'visible', timeout: 30000 });
      await refusedStart.locator('[data-check-sign-in]').click();
      await online.signInHere(refusedStart, { name: 'Accessibility JEE Student' });
      await page.getByRole('button', { name: 'Start JEE Main Mathematics simulation' }).click();
      await page.waitForSelector('.exam-nav', { timeout: 60000 });
      await click(page, '.mcq .mcq-opt');
      await page.locator('.exam-dot').nth(20).click();
      await page.getByRole('button', { name: '✍ Write by hand' }).click();
      await page.waitForSelector('.ink-canvas-live', { timeout: 30000 });
      await wait(page, 700);
    });

    await step('india exam room · section analysis', '/exams/:id', async () => {
      await click(page, '.exam-head .btn', { text: 'Review and submit' });
      await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
      await click(page, '[role="dialog"] button.btn-primary', { text: 'Submit paper' });
      await page.waitForSelector('.exam-analysis', { timeout: 60000 });
      await wait(page, 700);
    });

    // ── teacher-only workspace, exercised under a real teacher profile ──────
    await step('teacher studio', '/teach', async () => {
      await goTo(page, BASE, '/');
      await click(page, '.user-chip');
      await click(page, '[role="menuitem"]', { text: 'Switch profile' });
      await page.waitForSelector('.auth-wrap', { timeout: 15000 });
      await click(page, 'button.btn-ghost', { text: 'Add another profile' });
      await page.getByRole('button', { name: 'Teacher', exact: true }).click();
      await click(page, '.auth-card .btn-primary');
      await page.locator('#signup-track').selectOption('10');
      await click(page, '.auth-card .btn-primary');
      await page.locator('#signup-name').fill('Accessibility Teacher');
      await click(page, '.auth-card .btn-primary');
      await click(page, '.auth-card .btn-primary');
      await page.waitForSelector('[data-onboarding-step="5"]');
      await page.getByRole('button', { name: 'Open Teacher Workspace' }).click();
      await page.waitForSelector('.teacher-workspace-head', { timeout: 30000 });
      await wait(page, 700);
    });

    await step('teacher studio · a class with a task form', '/teach', async () => {
      await goTo(page, BASE, '/teach');
      await page.locator('input.input').first().fill('10MaA');
      await click(page, 'button.btn-primary', { text: 'Create' });
      await page.waitForSelector('.prio-item', { timeout: 20000 });
      await wait(page, 900);
    });

    await step('teacher studio · question builder', '/teach', async () => {
      await click(page, 'button.btn-ghost', { text: 'Write a question' });
    });

    // ── verdicts ─────────────────────────────────────────────────────────────

    section('the walk');
    const declared = declaredRoutes();
    ok('the router declares routes to walk', declared.length > 0, `${declared.length} found in App.jsx`);
    const missed = declared.filter(r => !routesSeen.has(r));
    ok('every route the router declares was rendered and audited', missed.length === 0,
      missed.length ? `never visited: ${missed.join(', ')}` : '');
    ok('the walk reached past the routes into their states', views.length >= declared.length + 12,
      `${views.length} views across ${declared.length} routes`);
    ok('every view opened', skipped.length === 0, skipped.join('\n      '));
    ok('nothing threw while the app was driven', pageErrors.length === 0, pageErrors.slice(0, 4).join('\n      '));
    const handlers = views.reduce((n, v) => n + v.handlers, 0);
    ok('the handler scan is alive — React props were read on real nodes', handlers > 200,
      `only ${handlers} onClick handlers were seen; the keyboard-reachability rule may be finding nothing because it is broken`);
    const colours = Math.max(0, ...views.map(v => v.colours));
    ok('the verdict colours resolved', colours >= 6, `only ${colours} of the verdict tokens resolved to a colour`);

    section('the suite can fail');
    if (!selfTest || selfTest.error) {
      ok('the broken controls were planted', false, selfTest?.error || 'the self-test never ran');
    } else {
      ok('a second <h1> is caught', selfTest.headings);
      ok('a button with no name is caught', selfTest.nameless);
      ok('a button named only by its title is caught', selfTest.title);
      ok('a button named only by a symbol is caught', selfTest.symbol);
      ok('a positive tabindex is caught', selfTest.positive);
      ok('something focusable that does nothing is caught', selfTest.inert);
      ok('an unlabelled field is caught', selfTest.field);
      ok('a verdict colour with no words is caught', selfTest.colour);
      ok('a click handler a keyboard cannot reach is caught', selfTest.click);
      ok('a <label> over a hidden input is caught', selfTest.deadLabel);
    }

    section('accessible names');
    const nameFindings = findingsFor('names');
    const controls = views.reduce((n, v) => n + v.controls, 0);
    ok('every interactive control has a name a screen reader will say', nameFindings.length === 0, show(nameFindings));
    ok('there were controls to read', controls > 200, `${controls} read out of the accessibility tree`);

    section('page headings');
    const headingFindings = findingsFor('headings');
    ok('every view renders exactly one <h1>', headingFindings.length === 0,
      headingFindings.map(f => `${f.signature} — ${f.detail}`).join('\n      '));

    section('tab order');
    ok('no positive tabindex anywhere', findingsFor('tabindex').length === 0,
      findingsFor('tabindex').map(f => `${f.signature} — ${f.detail}`).join('\n      '));
    ok('nothing focusable does nothing', findingsFor('inert').length === 0, show(findingsFor('inert')));
    ok('every click handler can be reached from a keyboard', findingsFor('reachable').length === 0, show(findingsFor('reachable')));

    section('form labels');
    const labelFindings = findingsFor('labels');
    const fields = views.reduce((n, v) => n + v.fields, 0);
    ok('every field is tied to a label or an aria-label', labelFindings.length === 0, show(labelFindings));
    ok('there were fields to check', fields > 30, `${fields} inspected`);

    section('the marking verdict');
    ok('a question was marked — by the server', !!liveVerdict && liveVerdict.grades >= 1,
      liveVerdict ? `${liveVerdict.grades} authoritative server results behind the marked card` : 'the practice view never reached a marked question');
    if (liveVerdict) {
      ok('the verdict region says nothing before an answer is marked',
        !liveVerdict.before || !/correct|not quite|revealed|marks/i.test(liveVerdict.before),
        `it already said ${JSON.stringify(liveVerdict.before)}`);
      const spoken = (liveVerdict.after || []).join(' ');
      ok('the verdict lands inside a live region once the question is marked',
        /(correct|not quite|revealed)/i.test(spoken) && /marks?/i.test(spoken),
        `the live regions on the marked page said ${JSON.stringify(liveVerdict.after)}`);
    }

    section('online-only checking');
    ok('signed out, the card says before Submit that checking needs an account: a labelled group holding a real, named sign-in button',
      refusals.notice?.role === 'group' && !!refusals.notice.label && /needs a Pri account/i.test(refusals.notice.text) &&
        refusals.notice.button?.tag === 'button' && /\p{L}/u.test(refusals.notice.button.name) && refusals.notice.button.expanded === 'false',
      JSON.stringify(refusals.notice));
    ok('a refused check (signed out) is announced in a live region, in words — and nothing is marked',
      refusals.signIn?.kind === 'sign-in' && /has not been checked/i.test((refusals.signIn.spoken || []).join(' ')) && refusals.signIn.result === 0,
      JSON.stringify(refusals.signIn));
    ok('opening the sign-in sets aria-expanded, and Tab from its button goes into the panel it opened, inside the card',
      refusals.focus?.expanded === 'true' && refusals.focus.stops.length === 4 && refusals.focus.stops.every(stop => stop.inRefusal),
      JSON.stringify(refusals.focus));
    ok('the walk signed in on the card, on the real server', refusals.signedIn === true);
    ok('an account blocker (email not verified) is announced in a live region and offers a named link to Account settings — and nothing is marked',
      refusals.blocker?.kind === 'verify-email' && /has not been checked/i.test((refusals.blocker.spoken || []).join(' ')) &&
        refusals.blocker.link?.tag === 'a' && refusals.blocker.link.href === '/settings' && /\p{L}/u.test(refusals.blocker.link.name) && refusals.blocker.result === 0,
      JSON.stringify(refusals.blocker));
    ok('offline, the reconnect message is announced in a live region with a named Try again button — and nothing is marked',
      refusals.reconnect?.kind === 'reconnect' && /has not been checked/i.test((refusals.reconnect.spoken || []).join(' ')) &&
        refusals.reconnect.retry?.tag === 'button' && /\p{L}/u.test(refusals.reconnect.retry.name) && refusals.reconnect.result === 0,
      JSON.stringify(refusals.reconnect));

    const announced = r => r?.kind === 'sign-in' && r.role === 'alert' && /\p{L}/u.test(r.iconWord || '') &&
      r.button?.tag === 'button' && /\p{L}/u.test(r.button.name) && r.button.expanded === 'false' && r.button.disabled === false;
    ok('signed out, a placement check that does not start is an alert in words (its icon named), with a real, named sign-in button in place',
      announced(refusals.placement), JSON.stringify(refusals.placement));
    ok('signed out, an exam paper that does not start is an alert in words with the same named sign-in — and no exam room opens',
      // (Its icon alone has no word yet — Exams.jsx:82, tracked under "owned elsewhere".)
      announced({ ...refusals.exam, iconWord: refusals.exam?.iconWord || 'tracked elsewhere' }) && refusals.exam.room === 0, JSON.stringify(refusals.exam));
    ok('signed out, Rapid Fire and Match that do not start are alerts in words with the same named sign-in — and no clock or question appears',
      announced(refusals.rush) && refusals.rush.clock === 0 && announced(refusals.match) && refusals.match.question === 0,
      JSON.stringify({ rush: refusals.rush, match: refusals.match }));

    section('colour is never alone');
    ok('correct / incorrect is never carried by colour alone', findingsFor('colour').length === 0, show(findingsFor('colour')));

    section('skip link');
    ok('the skip link was measured', skipLink && !skipLink.error, skipLink?.error || '');
    if (skipLink && !skipLink.error) {
      ok('the first tab stop on the page is the skip link',
        !!skipLink.first && skipLink.first.tag === 'a' && /skip/i.test(skipLink.first.text),
        `the first tab stop was ${JSON.stringify(skipLink.first)}`);
      ok('it points at a target in the page', (skipLink.first?.href || '').startsWith('#'),
        `href was ${JSON.stringify(skipLink.first?.href)}`);
      ok('activating it moves focus into the main region', !!skipLink.landed?.inMain,
        `focus landed on ${JSON.stringify(skipLink.landed)}`);
    }

    section('owned elsewhere');
    for (const entry of OUTSTANDING) {
      const still = [...found.values()].some(f => f.check === entry.check && entry.test(f));
      ok(`${entry.file} — ${entry.what}`, still,
        'this is FIXED. Delete its entry from OUTSTANDING at the top of this file so the rule guards it like everything else.');
    }
  } catch (err) {
    if (!group) section('startup');
    ok('the suite ran to the end', false, `crashed: ${err?.stack || err}`);
  } finally {
    if (browser) await browser.close().catch(() => { });
    if (server) server.close();
    if (platform) await platform.close().catch(() => { });
    if (dist) rmSync(dist, { recursive: true, force: true });
  }

  return finish(views);
}

// ── Summary ──────────────────────────────────────────────────────────────────

function finish(views) {
  const total = groups.reduce((n, g) => n + g.pass + g.fail, 0);
  const failed = groups.reduce((n, g) => n + g.fail, 0);

  console.log('\nAccessibility — driven in a real browser, judged on the real accessibility tree\n');
  for (const g of groups) {
    const n = g.pass + g.fail;
    console.log(`  ${g.name.padEnd(24)} ${String(g.pass).padStart(3)}/${String(n).padEnd(3)} ${g.fail ? `✖ ${g.fail} FAILED` : '✔'}`);
  }
  const sum = (k) => views.reduce((n, v) => n + v[k], 0);
  console.log(`\n  ${plural(views.length, 'view')} walked · ${plural(sum('controls'), 'control')} named · ${plural(sum('fields'), 'field')} labelled · ${plural(sum('handlers'), 'click handler')} traced · ${sum('elements').toLocaleString()} elements inspected`);

  if (failures.length) {
    console.log('\nfailures:');
    for (const f of failures) console.log('  ' + f);
  }
  if (OUTSTANDING.length) {
    console.log('\nstill outstanding, in files this suite may not edit:');
    for (const o of OUTSTANDING) console.log(`  ${o.file}\n      ${o.what}`);
  }
  for (const n of notes) console.log(`\n  not measured: ${n}`);
  for (const n of bootRecoveries) console.log(`\n  note: ${n}`);
  console.log(`\n${failed ? '✖ ACCESSIBILITY SUITE FAILED' : '✔ ACCESSIBILITY SUITE PASSED'} — ${total - failed}/${total} checks across ${groups.length} groups`);
  return failed;
}

const launched = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (import.meta.url === launched) {
  run().then(failed => process.exit(failed ? 1 : 0)).catch(err => {
    if (!group) section('startup');
    ok('the suite ran to the end', false, `crashed: ${err?.stack || err}`);
    finish([]);
    process.exit(1);
  });
}
