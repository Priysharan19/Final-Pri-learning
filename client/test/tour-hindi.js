// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · E2E flow — a Hindi-medium student's day, in Hindi.
//
// The catalogue suites prove that every string HAS a Hindi translation and the
// coverage scan proves that no screen hard-codes English. Neither proves what a
// student actually sees, because a screen can still fall back: a key looked up
// before the Hindi chunk arrived, a label computed once at module load, a
// string that comes back from a helper in English. This flow is that proof. It
// makes an Indian profile in Hindi through the real onboarding, then walks the
// screens the student uses — Home, Practice (typed and handwritten), Exams, an
// exam room, Progress and the Pri Explain player — and on every one asserts:
//
//   - <html lang="hi">, so a screen reader reads it with a Hindi voice;
//   - the screen is actually written in Devanagari, not merely tagged hi;
//   - not one visible text node, aria-label, title or placeholder is an
//     English interface string from the catalogue (the fallback this flow
//     exists to catch), and no raw catalogue key has leaked onto the page.
//
// What it does not flag, on purpose: question text, worked solutions, chapter
// names and anything else the engine and curriculum supply. Those stay English
// by design (see client/test/i18n-check.mjs), and this flow compares against
// the interface catalogue only, so it cannot mistake mathematics for a bug.
//
// Run on its own:  node client/test/tour-hindi.js
// ─────────────────────────────────────────────────────────────────────────────
import { pathToFileURL } from 'node:url';
import en from '../src/i18n/strings.en.js';
import hi from '../src/i18n/strings.hi.js';

// JEE Main is the India track whose exam is released (a source-checked
// Mathematics-section paper), so the exam room can be entered and audited.
const STUDENT = { name: 'Ananya Gupta', year: 12, course: 'in', track: 'jee-main', language: 'hi' };
const DEVANAGARI = /[ऀ-ॿ]/;

// Every English interface string whose Hindi is different — i.e. every string
// whose appearance on a Hindi screen is a fallback. Templates become patterns
// with their placeholders as wildcards; a template with too little fixed text
// to be distinctive ("{n}%", "{a} · {b}") is left out rather than matching
// half the page.
const flat = v => (typeof v === 'string' ? [v] : Object.values(v || {}));
const ENGLISH = [];
for (const [key, value] of Object.entries(en)) {
  const hiFlat = flat(hi[key]).join('\u0000');
  for (const form of flat(value)) {
    if (hiFlat === form || hiFlat.split('\u0000').includes(form)) continue;
    const fixed = form.replace(/\{\w+\}/g, ' ').replace(/[^A-Za-z]+/g, ' ').trim();
    if (fixed.split(' ').filter(w => w.length >= 2).length < (form.includes('{') ? 2 : 1) || fixed.length < 4) continue;
    ENGLISH.push({ key, form });
  }
}
const KEYS = Object.keys(en);

/**
 * In the page: every English catalogue string that is on screen, and every raw
 * key. Text inside KaTeX is skipped — it is typeset mathematics.
 */
function leaksOnPage({ english, keys }) {
  const norm = s => String(s || '').replace(/\s+/g, ' ').trim();
  const patterns = english.map(({ key, form }) => {
    if (!form.includes('{')) return { key, form: norm(form), re: null };
    const parts = norm(form).split(/\{\w+\}/).map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return { key, form, re: new RegExp(`^${parts.join('.+?')}$`) };
  });
  const keySet = new Set(keys);
  const seen = [];
  const consider = (text, where) => {
    const t = norm(text);
    if (!t || !/[A-Za-z]/.test(t)) return;
    if (keySet.has(t)) { seen.push(`raw key ${t} (${where})`); return; }
    for (const p of patterns) {
      if (p.re ? p.re.test(t) : p.form === t) { seen.push(`“${t.slice(0, 70)}” = ${p.key} (${where})`); return; }
    }
  };
  const visible = el => {
    if (!el) return false;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    return el.getClientRects().length > 0;
  };
  const root = document.querySelector('.shell') || document.body;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const parent = node.parentElement;
    if (!parent || parent.closest('.katex, script, style, noscript')) continue;
    // Content the app marks as English on purpose (curriculum names, engine
    // text) carries lang="en"; it is declared, not a fallback.
    if (parent.closest('[lang]')?.getAttribute('lang') === 'en' && parent.closest('[lang]') !== document.documentElement) continue;
    if (!visible(parent)) continue;
    consider(node.nodeValue, parent.tagName.toLowerCase());
  }
  for (const el of root.querySelectorAll('[aria-label], [title], [placeholder], [alt]')) {
    for (const attr of ['aria-label', 'title', 'placeholder', 'alt']) {
      if (el.hasAttribute(attr)) consider(el.getAttribute(attr), `${el.tagName.toLowerCase()}[${attr}]`);
    }
  }
  return [...new Set(seen)];
}

/** How much of the screen is in Devanagari — enough to show it is not just tagged hi. */
function devanagariOnPage() {
  const root = document.querySelector('.shell') || document.body;
  const text = root.innerText || '';
  return (text.match(/[ऀ-ॿ]+/g) || []).length;
}

export const flow = {
  id: 'hindi',
  name: 'Hindi · Practice, handwriting, Exams, exam room, Progress, Explain',

  async run({ page, base, check, goto, createProfile, settle }) {
    const audit = async (screen) => {
      await settle();
      await check(`${screen}: the document is declared Hindi`,
        await page.evaluate(() => document.documentElement.lang) === 'hi',
        `html lang is ${await page.evaluate(() => document.documentElement.lang)}`);
      const words = await page.evaluate(devanagariOnPage);
      await check(`${screen}: the screen is written in Devanagari`, words >= 8, `${words} Devanagari words`);
      const leaks = await page.evaluate(leaksOnPage, { english: ENGLISH, keys: KEYS });
      await check(`${screen}: no English interface string or raw key falls back onto the screen`,
        leaks.length === 0, leaks.slice(0, 8).join(' · '));
    };

    await goto('/');
    await createProfile(STUDENT);
    await page.waitForFunction(() => document.documentElement.lang === 'hi', null, { timeout: 15000 });
    await audit('Home');

    // ── Practice: a real served question, answered wrong twice, then explained ──
    await page.goto(`${base}/practice`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.q-prompt', { timeout: 30000 });
    await audit('Practice');

    // ── Handwriting: the ink toolbar, the reading panel and a symbol correction ──
    const writeTab = page.getByRole('button', { name: hi['verdict.modeWriteLabel'] });
    for (let skips = 0; skips < 20 && !await writeTab.count(); skips++) {
      await page.locator('.ctx-next').click();
      await page.waitForSelector('.q-prompt', { timeout: 30000 });
      await settle();
    }
    if (await check('Handwriting: a question that can be answered by hand was served', await writeTab.count() > 0)) {
      await writeTab.first().click();
      await page.waitForSelector('.ink-canvas-live', { timeout: 30000 });
      await settle();
      const toolbar = page.locator('.ink-toolbar');
      const toolbarText = await toolbar.innerText();
      // The instrument toolbar: Pen, Eraser, Page (sheets replace "more space"),
      // Finger, and the one-step-per-line hint.
      for (const key of ['ink.pen', 'ink.eraser', 'ink.addPage', 'ink.finger', 'ink.hint']) {
        await check(`Handwriting: the toolbar shows ${key} in Hindi`, toolbarText.includes(hi[key]), JSON.stringify(toolbarText));
      }
      const titles = await toolbar.locator('button').evaluateAll(els => els.map(el => [el.getAttribute('title'), el.getAttribute('aria-label')]));
      for (const [titleKey, ariaKey] of [['ink.undo', 'ink.undoLabel'], ['ink.redo', 'ink.redoLabel'], ['ink.clear', 'ink.clearLabel'],
        ['ink.fingerTitle', 'ink.fingerLabel']]) {
        await check(`Handwriting: the ${titleKey} control is titled and labelled in Hindi`,
          titles.some(([title, aria]) => title === hi[titleKey] && aria === hi[ariaKey]), JSON.stringify(titles));
      }
      // "More space" became Page: the control that adds a sheet is titled and
      // labelled in Hindi (its label names the page number it will add).
      await check('Handwriting: the ink.addPage control is titled and labelled in Hindi',
        titles.some(([title, aria]) => title === hi['ink.addPage'] && !!aria && aria.startsWith(hi['ink.addPageLabel'].split('{n}')[0])),
        JSON.stringify(titles));
      await check('Handwriting: the writing surface is labelled in Hindi',
        await page.locator('.ink-stage [role="img"]').first().getAttribute('aria-label') === hi['ink.surfaceLabel']);
      await check('Handwriting: no developer engine diagnostics are shown to the student',
        await page.locator('.ink-answer [role="note"]').count() === 0);

      // One stroke. Handwriting is read only by the server reader (owner
      // decision); this device has none, so nothing is read on the device and
      // the student is told why — in Hindi.
      const box = await page.locator('.ink-canvas-live').boundingBox();
      await page.mouse.move(box.x + 60, box.y + 30);
      await page.mouse.down();
      for (let i = 1; i <= 12; i++) await page.mouse.move(box.x + 60 + i * 0.4, box.y + 30 + i * 6);
      await page.mouse.up();
      await page.waitForSelector('.ink-status', { timeout: 15000 }).catch(() => {});
      const inkStatus = (await page.locator('.ink-status').innerText().catch(() => '')) || '';
      await check('Handwriting: nothing is read on the device without the server reader',
        await page.locator('.ink-preview').count() === 0);
      await check('Handwriting: the student is told why, in Hindi',
        DEVANAGARI.test(inkStatus) && Object.keys(hi).some(k => k.startsWith('ink.waiting') && hi[k] === inkStatus), JSON.stringify(inkStatus));
      await audit('Practice handwriting');
      await page.locator(`.ink-tool[title="${hi['ink.clear']}"]`).click();
      await settle();
    }

    const answerBox = page.locator('.editor-body input.answer-input');
    const typeTab = page.getByRole('button', { name: hi['verdict.modeTypeLabel'] });
    for (let skips = 0; skips < 20; skips++) {
      if (await typeTab.count()) await typeTab.first().click();
      await settle();
      if (await answerBox.count() === 1) break;
      await page.locator('.ctx-next').click();
      await page.waitForSelector('.q-prompt', { timeout: 30000 });
    }
    if (await check('Practice: a typed question was served', await answerBox.count() === 1)) {
      const send = async (value) => {
        await answerBox.fill(value);
        await answerBox.press('Enter');
        await settle();
      };
      await send('-987654');
      await page.waitForSelector('.verdict-bad, .eval-card', { timeout: 20000 });
      await audit('Practice feedback');
      if (!await page.locator('.eval-card').count()) {
        await send('-987655');
        await page.waitForSelector('.eval-card', { timeout: 20000 }).catch(() => {});
      }
      await audit('Practice verdict');

      const launch = page.locator('.pri-explain-launch');
      if (await check('Explain: a resolved question offers the explanation in Hindi',
        await launch.count() === 1 && (await launch.innerText()).includes(hi['explain.launch']),
        await launch.count() ? JSON.stringify(await launch.innerText()) : 'no launch button')) {
        await launch.click();
        await page.waitForSelector('.pri-explain-dialog', { timeout: 10000 });
        await check('Explain: the player opens in Hindi',
          (await page.locator('.pri-explain-kicker').innerText()).includes('बोर्ड मोड'),
          JSON.stringify(await page.locator('.pri-explain-kicker').innerText()));
        await audit('Explain');
        const rail = page.locator('.pri-explain-rail button');
        if (await rail.count() > 1) {
          await rail.nth(await rail.count() - 1).click();
          await audit('Explain final step');
        }
        await page.getByRole('button', { name: hi['explain.close'] }).click();
      }
    }

    // ── Exams and an exam room ──────────────────────────────────────────────────
    await page.goto(`${base}/exams`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.shell main .btn-primary', { timeout: 30000 });
    await audit('Exams');
    await page.locator('.shell main .btn-primary.btn-lg').first().click();
    await page.waitForURL(/\/exams\/[^/]+$/, { timeout: 30000 });
    await page.waitForSelector('.q-prompt, .exam-q, .shell main h1, .shell main h2', { timeout: 30000 });
    await audit('Exam room');

    // ── Progress ───────────────────────────────────────────────────────────────
    await page.goto(`${base}/progress`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.shell main h1, .shell main h2', { timeout: 30000 });
    await audit('Progress');

    // ── Settings: the switch back works and the screens return to English ──────
    await page.goto(`${base}/settings`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.shell main', { timeout: 30000 });
    await audit('Settings');
    await page.locator('button[aria-pressed]', { hasText: 'English' }).first().click();
    await page.waitForFunction(() => document.documentElement.lang === 'en', null, { timeout: 10000 }).catch(() => {});
    await check('switching back to English returns the document to English',
      await page.evaluate(() => document.documentElement.lang) === 'en');
    await page.goto(`${base}/exams`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.shell main .btn-primary', { timeout: 30000 });
    await settle();
    await check('and Exams reads in English again',
      !DEVANAGARI.test(await page.locator('.shell main h1, .shell main h2').first().innerText()));
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
