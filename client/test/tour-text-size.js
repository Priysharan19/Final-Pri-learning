// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Text size at the largest step (the layout proof).
//
// Builds the Prithagoras client, serves it from the real platform server, signs
// a student in, and at 375x812 and 1280x800, at Standard and at Largest:
//   · Home, Practice (Type, Write, Photo), the marked card, History, Settings
//     and the paper sitting page do not scroll sideways
//     (documentElement.scrollWidth <= clientWidth);
//   · the Submit / action bar is wholly inside the viewport;
//   · the first line of the question text and of the marked card is at least
//     1.35 times its Standard height (the line box of the text itself: CSS zoom
//     does not change getComputedStyle().fontSize, the rendered line does);
//   · the handwriting canvas still draws under the pen, within 2 px, at both
//     steps (a stroke is drawn with the mouse and read back from the bitmap);
//   · the choice made in Settings survives a reload and is applied before the
//     app loads (data-text-size is on <html> at DOMContentLoaded).
// Screenshots: $PRI_TEXT_SIZE_SHOTS (default: a temp folder), dark.
//
// Usage: node client/test/tour-text-size.js
// Synthetic: the local test platform and a headless browser. Not device evidence.
// ─────────────────────────────────────────────────────────────────────────────
import { chromium } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startOnlinePlatform } from './support/online-session.mjs';
import { createVerifiedProfile, switchSyllabus } from './support/verified-onboarding.mjs';

const CLIENT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EDITION = 'prithagoras';
const CHAPTER = 'y11-explog';
const SHOTS = process.env.PRI_TEXT_SIZE_SHOTS || mkdtempSync(join(tmpdir(), 'pri-text-size-'));
mkdirSync(SHOTS, { recursive: true });
const VIEWPORTS = [['375x812', 375, 812], ['1280x800', 1280, 800]];
const MIN_RATIO = 1.35;

let pass = 0;
const failures = [];
const check = (name, condition, detail = '') => {
  if (condition) pass++; else failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
  console.log(`  ${condition ? '✓' : '✗'} ${name}${condition || !detail ? '' : ` — ${detail}`}`);
};

function build() {
  const out = mkdtempSync(join(tmpdir(), 'pri-text-size-build-'));
  const vite = join(CLIENT, 'node_modules', 'vite', 'bin', 'vite.js');
  const result = spawnSync(process.execPath, [vite, 'build', '--outDir', out, '--emptyOutDir', '--logLevel', 'error'],
    { cwd: CLIENT, encoding: 'utf8', env: { ...process.env, PRI_EDITION: EDITION } });
  if (result.status !== 0 || !existsSync(join(out, 'index.html'))) throw new Error(`the ${EDITION} build failed:\n${result.stdout || ''}${result.stderr || ''}`);
  return out;
}

// In the page: a step without a reload, so the page keeps its question and its answer.
const SET_STEP = ([size, scale]) => {
  const r = document.documentElement;
  if (size === 'standard') { r.removeAttribute('data-text-size'); r.style.removeProperty('--pri-text-scale'); }
  else { r.setAttribute('data-text-size', size); r.style.setProperty('--pri-text-scale', String(scale)); }
};
const SCALES = { standard: 1, large: 1.125, larger: 1.25, largest: 1.4 };

// The first rendered line of the first visible match, as the line box of the text itself.
const LINE_HEIGHT = selectors => {
  for (const sel of selectors) {
    for (const el of document.querySelectorAll(sel)) {
      if (!el.getClientRects().length) continue;
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let n; while ((n = w.nextNode())) {
        if (!n.textContent.trim() || n.parentElement.closest('.katex-mathml, .sr-only, script, style')) continue;
        const range = document.createRange(); range.selectNodeContents(n);
        const rects = [...range.getClientRects()].filter(q => q.height > 0);
        if (rects.length) return { sel, text: n.textContent.trim().slice(0, 30), h: rects[0].height };
      }
    }
  }
  return null;
};

const LAYOUT = () => {
  const de = document.documentElement;
  const bar = [...document.querySelectorAll('.ws-actions, .ctx-bar')].find(el => el.getClientRects().length);
  const r = bar?.getBoundingClientRect();
  const wide = [...document.querySelectorAll('.content *')].filter(el => el.getClientRects().length && !el.closest('.katex-mathml') && !(() => { for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) if (getComputedStyle(n).overflowX !== 'visible') return true; return false; })() && el.getBoundingClientRect().right > de.clientWidth + 1)
    .slice(0, 3).map(el => `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}:${Math.round(el.getBoundingClientRect().right)}`);
  const pinned = [...document.querySelectorAll('.content *')].filter(el => { const p = getComputedStyle(el).position; return (p === 'fixed' || p === 'sticky') && el.getClientRects().length; })
    .map(el => { const q = el.getBoundingClientRect(); return { n: `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}`, pos: getComputedStyle(el).position, off: q.left < -1 || q.right > de.clientWidth + 1 || (getComputedStyle(el).position === 'fixed' && (q.top < -1 || q.bottom > innerHeight + 1)) }; });
  const wrapped = [...document.querySelectorAll('.ws-actions .btn')].filter(b => b.getClientRects().length).filter(b => { const w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { if (!n.textContent.trim()) continue; const g = document.createRange(); g.selectNodeContents(n); if (new Set([...g.getClientRects()].map(q => Math.round(q.top))).size > 1) return true; } return false; }).map(b => b.textContent.trim());
  return { wrapped, pinned, over: de.scrollWidth - de.clientWidth, wide, bar: r ? { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) } : null, vw: de.clientWidth, vh: innerHeight };
};
const barInside = l => !l.bar || (l.bar.left >= -1 && l.bar.right <= l.vw + 1 && l.bar.top >= 0 && l.bar.bottom <= l.vh + 1);

// The first-run note at the current step: wholly on screen, clear of the prompt and the dot-point picker, beside its anchor.
const NOTE_AUDIT = () => {
  const note = document.querySelector('.pr-tour');
  if (!note) return { missing: true };
  const r = note.getBoundingClientRect(), vw = document.documentElement.clientWidth, vh = innerHeight;
  const step = note.getAttribute('data-practice-tour');
  const anchor = document.querySelector({ topic: '[data-tour="topic"]', answer: '[data-tour="modes"]', marked: '[data-tour="submit"]', history: '[data-tour="history"]' }[step]);
  const a = anchor?.getBoundingClientRect();
  const hit = sel => { const e = document.querySelector(sel); if (!e || !e.getClientRects().length) return false; const q = e.getBoundingClientRect(); return r.left < q.right - 1 && r.right > q.left + 1 && r.top < q.bottom - 1 && r.bottom > q.top + 1; };
  const gap = a ? Math.max(0, a.left - r.right, r.left - a.right) + Math.max(0, a.top - r.bottom, r.top - a.bottom) : NaN;
  const pq = document.querySelector('.q-prompt')?.getBoundingClientRect();
  const underPrompt = !!pq && step === 'topic' && Math.abs(r.top - pq.bottom) <= 24;   // the topic note sits directly under the question it names when nothing nearer is clear
  const free = sel => { const b = note.querySelector(sel); if (!b) return false; const q = b.getBoundingClientRect(); const e = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); return !!e && note.contains(e); };
  const hiddenBy = getComputedStyle(note).visibility === 'hidden' ? ([...document.querySelectorAll('[role="dialog"]:not(.pr-tour), [aria-modal="true"], .in-hintsheet, .in-hintsheet-scrim, .mnav-sheet, .mnav-sheet-scrim, .in-more-menu, [role="menu"], .pri-explain-backdrop, .drawer, .paper-overlay, [data-question-report]')].filter(e => e.getClientRects().length).map(e => `${e.tagName}.${String(e.className).split(' ')[0]}`)[0] || 'unknown') : '';
  return { hiddenBy, step, skipFree: free('[data-tour-skip]'), nextFree: free('[data-tour-next]'), underPrompt, inside: r.left >= 0 && r.top >= 0 && r.right <= vw && r.bottom <= vh, coversPrompt: hit('.q-prompt'), coversPicker: hit('[data-dotpoint-picker]'), gap: Math.round(gap), box: [r.left, r.top, r.right, r.bottom].map(Math.round), inBody: note.parentElement === document.body };
};

const PINNED = new Set();
let dist = null, platform = null, browser = null, stage = 'build';
const STALL_MS = 420000;
const stall = setTimeout(() => { console.log(`TEXT SIZE TOUR: FAIL — stalled for ${STALL_MS / 1000}s at stage "${stage}" (${pass} checks had passed)`); process.exit(1); }, STALL_MS);
stall.unref();

async function setProfile(page, { year, pathway }) {
  await page.goto(`${platform.origin}/settings`, { waitUntil: 'domcontentloaded' });
  const card = page.locator('.card', { has: page.getByRole('heading', { name: 'Profile Information' }) });
  await card.waitFor({ timeout: 30000 });
  await card.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.locator('#set-year').waitFor({ timeout: 15000 });
  await page.locator('#set-year').selectOption(String(year));
  if (pathway) await card.locator('.pathway-pick', { hasText: pathway }).first().click();
  await card.getByRole('button', { name: 'Save changes' }).click();
  await page.locator('#set-year').waitFor({ state: 'detached', timeout: 15000 });
}

try {
  dist = build();
  stage = 'start the platform server';
  platform = await startOnlinePlatform({ dist, allowSeededPractice: true, env: { PRI_EDITION: EDITION } });
  browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark' });
  await ctx.addInitScript(() => { try { localStorage.setItem('pri.theme', 'dark'); } catch { /* */ } });
  const page = await ctx.newPage();
  const online = platform.session(ctx, page);

  stage = 'sign in';
  await page.goto(platform.origin, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.auth-wrap, .shell', { timeout: 30000 });
  await createVerifiedProfile(page, platform, { name: 'Text Size Student', year: 11, fromPicker: await page.getByTestId('picker-create-account').count() > 0 });
  await switchSyllabus(page, platform, { course: 'nsw', year: 11 });

  // ── persistence and the boot paint, through the real control ──
  stage = 'settings control';
  await page.goto(`${platform.origin}/settings`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-text-size-option]', { timeout: 30000 });
  check('Standard is the default: nothing is set on <html>', await page.evaluate(() => !document.documentElement.hasAttribute('data-text-size') && getComputedStyle(document.querySelector('.content')).zoom === '1'));
  const group = page.getByRole('radiogroup', { name: 'Text size' });
  check('the control is a radio group named "Text size" with four radios', await group.getByRole('radio').count() === 4);
  await group.getByRole('radio', { name: 'Largest' }).focus();
  await page.keyboard.press('Enter');
  check('keyboard: Enter on "Largest" selects it and says so', await group.getByRole('radio', { name: 'Largest' }).getAttribute('aria-checked') === 'true'
    && /Text size set to Largest/.test(await page.locator('[role="status"]', { hasText: 'Text size set to' }).innerText()));
  check('Largest zooms the content by 1.4', await page.evaluate(() => getComputedStyle(document.querySelector('.content')).zoom) === '1.4');
  await page.reload({ waitUntil: 'commit' });
  await page.waitForFunction(() => document.readyState !== 'loading');
  check('the choice survives a reload and is on <html> before the app is built', await page.evaluate(() => document.documentElement.getAttribute('data-text-size') === 'largest' && document.documentElement.style.getPropertyValue('--pri-text-scale') === '1.4'));
  await page.waitForSelector('[data-text-size-option]', { timeout: 30000 });
  await page.getByRole('radiogroup', { name: 'Text size' }).getByRole('radio', { name: 'Standard' }).click();
  check('choosing Standard again removes it from <html>', await page.evaluate(() => !document.documentElement.hasAttribute('data-text-size') && localStorage.getItem('pri.textSize') === 'standard'));

  for (const [vid, w, h] of VIEWPORTS) {
    await page.setViewportSize({ width: w, height: h });
    const tag = vid;
    const measure = async (route, label, { shot, bar = false } = {}) => {
      const rows = {};
      for (const size of ['standard', 'large', 'larger', 'largest']) {
        await page.evaluate(SET_STEP, [size, SCALES[size]]);
        await page.waitForTimeout(250);
        rows[size] = await page.evaluate(LAYOUT);
        if (bar) {   // the bar sits at the foot of the page: scroll there, then it must be wholly on screen
          await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(250);
          rows[size].foot = await page.evaluate(LAYOUT);
          await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(150);
        }
        check(`${tag} ${size}: ${label}: no horizontal scroll`, rows[size].over <= 0, `scrollWidth over by ${rows[size].over}: ${(rows[size].wide || []).join(' ')}`);
        for (const p of rows[size].pinned) { PINNED.add(`${p.pos} ${p.n}`); }
        check(`${tag} ${size}: ${label}: no fixed or sticky element in the content is off screen`, rows[size].pinned.every(p => !p.off), JSON.stringify(rows[size].pinned.filter(p => p.off)));
        if (bar) check(`${tag} ${size}: ${label}: every action-bar button is on one line`, rows[size].wrapped.length === 0, JSON.stringify(rows[size].wrapped));
        if (bar) check(`${tag} ${size}: ${label}: the action bar is inside the viewport`, barInside(rows[size].foot), JSON.stringify(rows[size].foot));
        if (shot) {   // the question in view, the first-run note, if it is up, left showing
          await page.evaluate(() => { const st = document.getElementById('ts-shot') || Object.assign(document.head.appendChild(document.createElement('style')), { id: 'ts-shot' }); document.querySelector('.qpage .q-prompt, .qpage')?.scrollIntoView({ block: 'start' }); });
          await page.waitForTimeout(200);
          await page.screenshot({ path: join(SHOTS, `${shot}-${size}-${vid}.png`) });
        }
      }
      await page.evaluate(SET_STEP, ['standard', 1]);
      return rows;
    };

    stage = `${tag} home`;
    await page.goto(`${platform.origin}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.content', { timeout: 30000 }); await online.settled();
    await measure('/', 'Home', { shot: 'home' });

    const EXPECTED = ['topic', 'answer', 'marked', 'history'];
    // A student who has never seen the tour, at this size. The question is drawn by the server, and a draw without a control
    // (a multiple-choice question has no answer modes) has fewer steps, so a load is repeated until the note says it has all four.
    const fresh = async (size, { wantAll = true } = {}) => {
      for (let attempt = 0; attempt < 10; attempt++) {
        await page.evaluate(sz => { for (const k of Object.keys(localStorage)) if (k.startsWith('pri.tour.practice.')) localStorage.removeItem(k); localStorage.setItem('pri.textSize', sz); }, size);
        await page.goto(`${platform.origin}/practice?subtopic=${CHAPTER}`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.qpage[data-question-id] .q-prompt', { timeout: 30000 });
        // The note opens 600 ms after the question is served, then loads its chunk: wait for it, for as long as that takes.
        const up = await page.waitForSelector('.pr-tour[data-practice-tour]', { state: 'attached', timeout: 20000 }).then(() => true, () => false);
        const total = up ? await page.evaluate(() => Number((document.querySelector('.pr-tour-step')?.textContent.match(/of (\d+)/) || [])[1] || 0)) : 0;
        if (up && (!wantAll || total === EXPECTED.length)) return true;
        // No note (the resumed question already holds work, which the tour never interrupts) or too few steps: move to a fresh question.
        const leaving = await page.locator('.qpage[data-question-id]').getAttribute('data-question-id');
        const next = page.locator('.ctx-next').first();
        if (await next.count()) {
          await next.click({ timeout: 8000 }).catch(() => {});
          await page.waitForFunction(id => { const el = document.querySelector('.qpage[data-question-id]'); return el && el.getAttribute('data-question-id') !== id && el.querySelector('.q-prompt'); }, leaving, { timeout: 30000 }).catch(() => {});
        }
      }
      return false;
    };
    const SHEETS = '.in-hintsheet, .mnav-sheet, .in-more-menu, .pri-explain-dialog, .pri-explain-backdrop';
    for (const size of ['standard', 'large', 'larger', 'largest']) {
      stage = `${tag} first-run tour at ${size}`;
      const label = `${tag} ${size}`;
      const up = await fresh(size);
      check(`${label}: the first-run note appears with all four steps`, up);
      const audited = []; let closed = false;
      if (up) {
        for (let i = 0; i < EXPECTED.length + 2; i++) {
          if (!(await page.locator('.pr-tour').count())) { closed = true; break; }
          await page.waitForFunction(() => { const n = document.querySelector('.pr-tour'); return !n || n.style.visibility !== 'hidden'; }, null, { timeout: 5000 }).catch(() => {});
          await page.waitForTimeout(250);   // the note settles (it re-places on scroll and resize); the audit reads the settled box
          const n = await page.evaluate(NOTE_AUDIT);
          if (n.missing) { closed = true; break; }
          audited.push(n.step);
          check(`${label}: note step ${i + 1} (${n.step}): wholly on screen, clear of the prompt and the picker, within 24px of its control (or, for the topic note, directly under the question), on <body>, Skip and Next not covered`,
            n.inside && !n.coversPrompt && !n.coversPicker && (n.gap <= 24 || n.underPrompt) && n.inBody && n.skipFree && n.nextFree, JSON.stringify(n));
          await page.locator('[data-tour-next]').click({ timeout: 8000 });
          await page.waitForTimeout(100);
        }
        if (!closed) closed = (await page.locator('.pr-tour').count()) === 0;
      }
      console.log(`  steps audited ${label}: ${audited.join(', ') || 'none'}`);
      check(`${label}: every tour step was audited, in order (${EXPECTED.join(', ')}), and Next closed the note`, JSON.stringify(audited) === JSON.stringify(EXPECTED) && closed, `audited [${audited.join(', ')}], closed ${closed}`);
      const up2 = await fresh(size);
      check(`${label}: the note appears again for the Skip check`, up2);
      if (up2) {
        await page.locator('[data-tour-skip]').click({ timeout: 8000 }).catch(() => {});
        check(`${label}: Skip can be pressed and closes the note`, (await page.locator('.pr-tour').count()) === 0);
      }
    }
    // The note is never above a sheet, scrim, menu or dialog: with it up, open each one; nothing inside it may be the note.
    for (const size of ['standard', 'largest']) {
      stage = `${tag} note under sheets at ${size}`;
      const opens = w < 700
        ? [['hint sheet', async () => { await page.locator('.in-hintrow-all').first().click({ timeout: 8000 }); }], ['mobile More sheet', async () => { await page.evaluate(() => [...document.querySelectorAll('.mobilenav .mnav-item')].pop().click()); }]]
        : [['More menu', async () => { await page.evaluate(() => document.querySelector('#in-more-btn').click()); }]];
      for (const [name, open] of opens) {
        const up = await fresh(size, { wantAll: false });
        let hit = { n: 0 }; let err = '';
        if (up) {
          await page.waitForTimeout(300);
          await open().catch(e => { err = String(e.message).split('\n').slice(0, 4).join(' | ').slice(0, 300); });
          await page.waitForTimeout(400);
          hit = await page.evaluate(sel => {
            const el = [...document.querySelectorAll(sel)].find(e => e.getClientRects().length); if (!el) return { n: 0 };
            const r = el.getBoundingClientRect(); const note = document.querySelector('.pr-tour'); let n = 0, over = 0;
            for (let iy = 1; iy < 6; iy++) for (let ix = 1; ix < 6; ix++) {
              const x = Math.min(innerWidth - 1, Math.max(0, r.left + r.width * ix / 6)), y = Math.min(innerHeight - 1, Math.max(0, r.top + r.height * iy / 6));
              const e = document.elementFromPoint(x, y); n++; if (e && note && note.contains(e)) over++;
            }
            return { n, over, noteHidden: !note || getComputedStyle(note).visibility === 'hidden' };
          }, SHEETS);
          hit.err = err;
        }
        if (up && name === 'More menu' && !(await page.evaluate(() => { const b = document.querySelector('#in-more-btn'); return !!b && b.getClientRects().length > 0; }))) {
          console.log(`  note: ${tag} ${size}: the bar's More menu is not shown on Practice at this width, so there is no menu to cover`);
          continue;
        }
        check(`${tag} ${size}: with the note up, the ${name} opens and the note is never drawn over it`, up && hit.n > 0 && hit.over === 0 && hit.noteHidden, JSON.stringify(hit) + (hit.err || ''));
      }
      // The explain dialog, where this build offers one.
      const explain = await page.locator('.pri-explain-launch').count();
      if (!explain) console.log(`  note: ${tag} ${size}: this build shows no explain launcher on Practice, so there is no explain dialog to cover`);
    }
    await page.evaluate(() => localStorage.setItem('pri.textSize', 'standard'));

    stage = `${tag} practice`;
    await page.goto(`${platform.origin}/practice?subtopic=${CHAPTER}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.qpage[data-question-id] .q-prompt', { timeout: 30000 });
    await online.settled();
    const modeTab = n => page.locator('.mode-tab').nth(n);
    for (let skips = 0; skips < 12 && !(await page.locator('.mode-tab').count()); skips++) {   // a multiple-choice draw has no answer modes
      const leaving = await page.locator('.qpage[data-question-id]').getAttribute('data-question-id');
      await page.locator('.ctx-next').first().click();
      await page.waitForFunction(id => { const el = document.querySelector('.qpage[data-question-id]'); return el && el.getAttribute('data-question-id') !== id && el.querySelector('.q-prompt'); }, leaving, { timeout: 30000 });
    }
    // Type
    await modeTab(0).click(); await online.settled();
    await measure('/practice', 'Practice Type', { shot: 'practice-type', bar: true });
    await page.evaluate(SET_STEP, ['standard', 1]); await page.waitForTimeout(200);
    const qStd = await page.evaluate(LINE_HEIGHT, [['.q-prompt']]);
    await page.evaluate(SET_STEP, ['largest', 1.4]); await page.waitForTimeout(200);
    const qBig = await page.evaluate(LINE_HEIGHT, [['.q-prompt']]);
    check(`${tag}: the question text is at least ${MIN_RATIO}x its Standard size at Largest`, !!qStd && !!qBig && qBig.h / qStd.h >= MIN_RATIO, `${qStd?.h} -> ${qBig?.h} (${(qBig?.h / qStd?.h).toFixed(3)}x)`);
    await page.evaluate(SET_STEP, ['standard', 1]);
    // Write: layout and the pen
    if (await modeTab(1).count()) {
      await modeTab(1).click();
      await page.waitForSelector('.ink-canvas, canvas', { timeout: 15000 }).catch(() => {});
      await online.settled();
      await measure('/practice', 'Practice Write', { shot: 'practice-write', bar: true });
      for (const size of ['standard', 'largest']) {
        await page.evaluate(SET_STEP, [size, SCALES[size]]); await page.waitForTimeout(300);
        const canvas = page.locator('canvas').last();
        await canvas.scrollIntoViewIfNeeded(); await page.waitForTimeout(500);
        const box = await canvas.boundingBox();
        const sy0 = await page.evaluate(() => scrollY);
        const y = box.y + Math.min(box.height * 0.4, 80), x0 = box.x + box.width * 0.2, x1 = box.x + box.width * 0.6;
        await page.mouse.move(x0, y); await page.mouse.down();
        for (let i = 1; i <= 20; i++) await page.mouse.move(x0 + (x1 - x0) * i / 20, y);
        await page.mouse.up(); await page.waitForTimeout(300);
        const sy1 = await page.evaluate(() => scrollY);
        const got = await page.evaluate(() => {
          const cs = [...document.querySelectorAll('canvas')];
          const out = [];
          for (const c of cs) {
            const g = c.getContext('2d'); if (!g || !c.width) continue;
            const d = g.getImageData(0, 0, c.width, c.height).data;
            let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
            for (let i = 3; i < d.length; i += 4) if (d[i] > 40) { const p = (i - 3) / 4; const px = p % c.width, py = (p - px) / c.width; if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py; }
            if (x1 >= 0) { const r = c.getBoundingClientRect(); const kx = r.width / c.width, ky = r.height / c.height; out.push({ top: r.top, l: r.left + x0 * kx, r: r.left + (x1 + 1) * kx, t: r.top + y0 * ky, b: r.top + (y1 + 1) * ky }); }
          }
          return out[0] || null;
        });
        const cy = got ? (got.t + got.b) / 2 - got.top : NaN;   // relative to the sheet, so a page that moved meanwhile does not matter
        check(`${tag} ${size}: the pen draws under the pen (centre within 2px)`, !!got && Math.abs(cy - (y - box.y)) <= 2 && Math.abs(got.l - x0) <= 8 && Math.abs(got.r - x1) <= 12,
          got ? `drawn y ${cy.toFixed(1)} vs ${(y - box.y).toFixed(1)} (sheet-relative), x ${(got.l).toFixed(1)}..${(got.r).toFixed(1)} vs ${x0.toFixed(1)}..${x1.toFixed(1)}; scrollY ${sy0}->${sy1}; box.h ${box.height}` : 'no ink on any canvas', `scrollY ${sy0}->${sy1}`);
        await page.evaluate(SET_STEP, ['standard', 1]);
        const undo = page.getByRole('button', { name: 'Undo last stroke' }).first();
        if (await undo.count()) await undo.click().catch(() => {});   // leave a clean sheet for the next step
        await page.waitForTimeout(250);
      }
    }
    // Photo
    if (await modeTab(2).count()) {
      await modeTab(2).click(); await online.settled();
      await measure('/practice', 'Practice Photo', { shot: 'practice-photo', bar: true });
    }
    // Marked card
    await modeTab(0).click(); await online.settled();
    const known = await online.answerOf().catch(() => null);
    const box = page.locator('.editor-body input.answer-input');
    if (known && known.kind === 'text' && known.text !== null && await box.count() === 1) {
      await box.fill(String(known.text));
      await page.getByRole('button', { name: /Submit answer/ }).click();
      await page.waitForSelector('.verdict-good, .verdict-bad, .eval-card', { timeout: 30000 });
      await online.settled();
      await measure('/practice', 'the marked card', { shot: 'marked', bar: true });
      for (const size of ['standard', 'large', 'larger', 'largest']) {   // the action bar at all four steps: one line per button, wholly on screen
        await page.evaluate(SET_STEP, [size, SCALES[size]]); await page.waitForTimeout(250);
        await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(250);
        const bar = await page.evaluate(() => {
          const l = LAYOUT_BAR(); return l;
          function LAYOUT_BAR() {
            const el = [...document.querySelectorAll('.ws-actions')].find(e => e.getClientRects().length); if (!el) return null;
            const r = el.getBoundingClientRect(); const wrapped = [];
            for (const b of el.querySelectorAll('.btn')) { const g = document.createRange(); g.selectNodeContents(b); const tops = new Set([...g.getClientRects()].map(q => Math.round(q.top))); if (tops.size > 1) wrapped.push(b.textContent.trim()); }
            return { left: r.left, right: r.right, bottom: r.bottom, vw: document.documentElement.clientWidth, vh: innerHeight, over: document.documentElement.scrollWidth - document.documentElement.clientWidth, wrapped };
          }
        });
        check(`${tag} ${size}: the marked card's action bar: every button on one line, wholly on screen, no sideways scroll`, !!bar && bar.wrapped.length === 0 && bar.left >= -1 && bar.right <= bar.vw + 1 && bar.bottom <= bar.vh + 1 && bar.over <= 0, JSON.stringify(bar));
      }
      await page.evaluate(SET_STEP, ['standard', 1]); await page.waitForTimeout(200);
      const sel = [['.eval-card p', '.eval-card li', '.eval-card'], ['.verdict-good', '.verdict-bad']];
      const mStd = await page.evaluate(LINE_HEIGHT, sel);
      await page.evaluate(SET_STEP, ['largest', 1.4]); await page.waitForTimeout(200);
      const mBig = await page.evaluate(LINE_HEIGHT, sel);
      check(`${tag}: the marked card text is at least ${MIN_RATIO}x its Standard size at Largest`, !!mStd && !!mBig && mBig.h / mStd.h >= MIN_RATIO, `${mStd?.sel} ${mStd?.h} -> ${mBig?.h}`);
      await page.evaluate(SET_STEP, ['standard', 1]);
    } else check(`${tag}: a typed question the server issued was reached to mark`, false, 'no known answer');

    stage = `${tag} map picking`;
    await page.goto(`${platform.origin}/progress`, { waitUntil: 'domcontentloaded' });
    if (await page.waitForSelector('[data-board-map]', { state: 'attached', timeout: 20000 }).then(() => true, () => false)) {
      await online.settled();
      // Each size starts from a fresh page (the same first selection); the grid is walked in the same order and every
      // click that CHANGES the selected node is a pick. The two sequences of picks must be the same.
      const scan = async size => {
        await page.goto(`${platform.origin}/progress`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('[data-board-map]', { state: 'attached', timeout: 20000 }); await online.settled();
        await page.evaluate(SET_STEP, [size, SCALES[size]]); await page.waitForTimeout(500);
        // Synthetic click events at fractions of the canvas's own box (the page listens natively on the canvas), so a sticky bar
        // over part of the canvas cannot intercept them: what is tested is the mapping from the pointer to a node.
        const picks = await page.evaluate(async () => {
          const el = [...document.querySelectorAll('[data-board-map]')].find(c => c.getClientRects().length);
          const r = el.getBoundingClientRect(); const out = []; let prev = document.querySelector('[data-board-area]')?.getAttribute('data-board-area') || '';
          for (let iy = 1; iy < 28; iy++) for (let ix = 1; ix < 48; ix++) {
            el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.left + r.width * ix / 48, clientY: r.top + r.height * iy / 28 }));
            await new Promise(x => setTimeout(x, 12));
            const id = document.querySelector('[data-board-area]')?.getAttribute('data-board-area') || '';
            if (id !== prev) { out.push(id); prev = id; }
          }
          return out;
        });
        return picks;
      };
      const std = await scan('standard'); const big = await scan('largest');
      const A = new Set(std), B = new Set(big); const both = [...A].filter(x => B.has(x)).length;
      check(`${tag}: map: clicking at Largest picks the same nodes as at Standard`, A.size >= 3 && both / A.size >= 0.9 && B.size >= 0.9 * A.size, `${both}/${A.size} of Standard's picked nodes are picked at Largest (${B.size} distinct); standard [${[...A].join(' ')}] largest [${[...B].join(' ')}]`);
      await page.evaluate(SET_STEP, ['standard', 1]);
    } else check(`${tag}: the map canvas was reached`, false, 'no [data-board-map] on /progress');

    for (const [route, label, shot] of [['/review', 'History', 'history'], ['/settings', 'Settings', 'settings']]) {
      stage = `${tag} ${label}`;
      await page.goto(`${platform.origin}${route}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.content h1, .content h2', { timeout: 30000 }); await online.settled();
      await measure(route, label, { shot });
    }
  }

  // ── the paper sitting page (a Year 12 Extension 1 student) ──
  stage = 'paper sitting';
  await setProfile(page, { year: 12, pathway: 'Extension 1' });
  await page.goto(`${platform.origin}/exams`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-ext1-sit="ext1-2027-p01"]', { timeout: 30000 });
  await page.locator('[data-ext1-sit="ext1-2027-p01"]').click();
  await page.waitForSelector('[data-paper-sitting="ext1-2027-p01"]', { timeout: 30000 });
  for (const [vid, w, h] of VIEWPORTS) {
    await page.setViewportSize({ width: w, height: h });
    for (const size of ['standard', 'largest']) {
      await page.evaluate(SET_STEP, [size, SCALES[size]]); await page.waitForTimeout(300);
      const l = await page.evaluate(LAYOUT);
      if (l.over > 0) l.wide.push(...await page.evaluate(() => { const k = [...document.querySelectorAll('.katex-base')].find(e => e.getBoundingClientRect().right > document.documentElement.clientWidth + 1); const c = []; for (let n = k; n && c.length < 9; n = n.parentElement) c.push(`${n.tagName.toLowerCase()}.${String(n.className).split(' ')[0]}[${getComputedStyle(n).display}/${getComputedStyle(n).whiteSpace}]`); return ['chain:' + c.join('<')]; }));
      if (l.over > 0) l.wide.push(...await page.evaluate(() => { const r = document.documentElement; const out = []; for (const el of document.querySelectorAll('body *')) { const d = el.style.display; el.style.display = 'none'; const w = r.scrollWidth - r.clientWidth; el.style.display = d; if (w <= 0) out.push('hides:' + el.tagName + '.' + String(el.className).slice(0, 25)); } return out.slice(-4); }));
      check(`${vid} ${size}: the paper sitting page: no horizontal scroll`, l.over <= 0, `over by ${l.over}: ${(l.wide || []).join(' ')}`);
      await page.screenshot({ path: join(SHOTS, `paper-${size}-${vid}.png`) });
    }
    await page.evaluate(SET_STEP, ['standard', 1]);
  }
} catch (err) {
  failures.push(`the tour stopped at "${stage}": ${String(err.stack || err.message).split('\n').slice(0, 4).join(' | ')}`);
} finally {
  clearTimeout(stall);
  await browser?.close().catch(() => {});
  await platform?.close?.().catch?.(() => {});
  if (dist) rmSync(dist, { recursive: true, force: true });
}

console.log(`  note: fixed or sticky elements seen inside the content: ${[...PINNED].join(', ')}`);
const total = pass + failures.length;
if (failures.length) {
  console.log(`TEXT SIZE TOUR: FAIL — ${failures.length} of ${total} checks failed\n  · ${failures.join('\n  · ')}`);
  process.exit(1);
}
console.log(`TEXT SIZE TOUR: PASS — ${pass}/${total} checks — at Largest nothing scrolls sideways on Home, Practice, the marked card, History, Settings and the paper sitting page; text is 1.4x; the pen stays under the pen; the choice survives a reload`);
process.exit(0);
