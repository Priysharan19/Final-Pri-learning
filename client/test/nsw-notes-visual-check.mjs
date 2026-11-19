// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the NSW notes, looked at in a real browser (Chromium)
//
// client/test/support/nsw-notes-gallery.jsx draws one chapter through the app's
// own parts and styles. For EVERY Stage 4 chapter, in light and dark:
//
//   MATHS     no KaTeX render error anywhere (no .katex-error, no [data-katex-error]);
//             every diagram label is KaTeX;
//   ORDER     the sections follow Experience 3 of the Learning Experience Standard, in the
//             same order on every chapter: objective, prerequisites (builds on), intuition,
//             ideas, definitions, formulas, diagram, examples, examiners, mistakes, check,
//             practice (the next step). A section is left out exactly when the chapter has
//             no content for it (no objective, no prerequisite topics, no intuition, no
//             diagram, no examiners' points, no self-check); every other one is required,
//             and the next step into Practice is always last;
//   CHECK     every self-check answer is hidden behind a real button with aria-expanded
//             that opens it, and opened answers are visible;
//   FACES     reading text paints in CMU Serif, section labels in Instrument Sans,
//             maths in KaTeX; no other family appears on any text in the sheet, and
//             CMU Serif really loaded (document.fonts);
//   SLOP      no left-border accent card, no gradient background, no emoji or
//             glyph tick or Unicode super/subscript in any rendered text;
//   PHONE     at 375 px nothing overflows horizontally.
//
// It also saves the screenshots the PR carries: one chapter per band that has notes
// (Stage 4 covers Years 7 and 8), light and dark, desktop and phone, in
// docs/design/nsw-notes-screens/. `--shots` writes them; the check always runs.
//
//   node client/test/nsw-notes-visual-check.mjs [--shots]
// ─────────────────────────────────────────────────────────────────────────────
import { livingIdsNsw } from '../src/living/placement.nsw.js';
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { NSW_NOTES_TOPICS, loadNswNotesForStage } from '../src/notes/nsw/nswNotesIndex.js';

const CLIENT = fileURLToPath(new URL('..', import.meta.url));
const SHOTS_DIR = fileURLToPath(new URL('../../docs/design/nsw-notes-screens/', import.meta.url));
const WRITE_SHOTS = process.argv.includes('--shots');
const SHOT_TOPICS = (process.env.SHOT_TOPICS || 'ma4-frc-c-01,ma4-pyt-c-01,mav-12-05,mst-12-s2-07').split(','); // a Year 7 and a Year 8 chapter, then an Advanced and a Standard 2 chapter
let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };

const written = {};
for (const [stage, course] of [[4, null], [5, null], [6, 'advanced'], [6, 'standard'], [6, 'ext1'], [6, 'ext2']]) Object.assign(written, (await loadNswNotesForStage(stage, course)) || {});
const topics = NSW_NOTES_TOPICS.filter(t => Object.hasOwn(written, t.id));
const ORDER = ['objective', 'prerequisites', 'intuition', 'ideas', 'definitions', 'formulas', 'living', 'diagram', 'examples', 'examiners', 'mistakes', 'check', 'practice'];
// The sections a chapter may leave out, and when: exactly when it has nothing to put in them.
const present = n => ({
  objective: !!n.objective, prerequisites: (n.prereqs || []).some(p => NSW_NOTES_TOPICS.some(x => x.id === p)), intuition: !!n.intuition,
  diagram: n.diagrams?.length > 0, examiners: n.examiners?.length > 0, check: n.check?.length > 0
});

const server = await createServer({
  root: CLIENT, configFile: fileURLToPath(new URL('../vite.config.js', import.meta.url)), logLevel: 'error',
  server: { host: '127.0.0.1', port: 0, strictPort: false, hmr: false, watch: null, proxy: undefined },
  // Its own dependency cache: the walks that ran before it in the same job leave one optimised for other entries, and a dev server
  // that finds it stale re-optimises mid-run ("Pre-transform error: the file does not exist … deps/react-dom") and never draws the chapter.
  cacheDir: fileURLToPath(new URL('../node_modules/.vite-nsw-notes-visual', import.meta.url)),
  optimizeDeps: { entries: ['test/support/nsw-notes-gallery.html'] }
});
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const urlFor = (id, theme) => `${origin}/test/support/nsw-notes-gallery.html?topic=${id}&theme=${theme}`;

// Open every worked example and every self-check answer, as a student who has asked for them.
async function openAll(page) {
  while (await page.locator('.nn-more .nt-link-btn').count()) await page.locator('.nn-more .nt-link-btn').first().click();
  while (await page.locator('.nn-check .nt-link-btn[aria-expanded="false"]').count()) await page.locator('.nn-check .nt-link-btn[aria-expanded="false"]').first().click();
}
// Before anything is opened: every self-check answer is hidden, behind a button that says so.
async function checkClosed(page) {
  return page.evaluate(() => [...document.querySelectorAll('.nn-check li')].map(li => {
    const b = li.querySelector('button[aria-expanded]'); const a = b && document.getElementById(b.getAttribute('aria-controls'));
    return !!b && b.getAttribute('aria-expanded') === 'false' && !!a && a.hidden && li.contains(a);
  }));
}

const browser = await chromium.launch();
try {
  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, colorScheme: theme });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

    for (const t of topics) {
      const where = `${t.id} (${theme})`;
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto(urlFor(t.id, theme), { waitUntil: 'networkidle' });
      await page.waitForSelector('[data-chapter-sheet]');
      await page.evaluate(() => document.fonts.ready);
      const closed = await checkClosed(page);
      ok(closed.every(Boolean), `${where}: a self-check answer is shown before it is asked for, or has no aria-expanded button`);
      // Open every worked example and every self-check answer, as a student who has asked for them.
      await openAll(page);
      const opened = await page.evaluate(() => [...document.querySelectorAll('.nn-check .nn-check-a')].map(a => !a.hidden && a.getBoundingClientRect().height > 0));
      ok(opened.length === closed.length && opened.every(Boolean), `${where}: a self-check answer did not open from its button`);
      await page.evaluate(() => document.fonts.ready);

      const r = await page.evaluate(() => {
        const sheet = document.querySelector('[data-chapter-sheet]');
        const sections = [...sheet.querySelectorAll('[data-nn-section]')].map(s => s.dataset.nnSection);
        const families = new Map();
        const walker = document.createTreeWalker(sheet, NodeFilter.SHOW_TEXT);
        let text = '';
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const s = n.nodeValue.trim(); if (!s) continue;
          // The living-formula block is an interactive instrument with its own readouts (tabular mono, unicode powers); its type and
          // sections are pinned by the living-formula suites, not by the notes' reading-text rules.
          const el = n.parentElement; if (el.closest('[hidden]') || el.closest('.dg-sr, .katex-mathml') || el.closest('[data-nn-section="living"]')) continue;
          text += `${s} `;
          const fam = getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g, '').trim();
          families.set(fam, (families.get(fam) || 0) + 1);
        }
        const stripes = [];
        const gradients = [];
        for (const el of sheet.querySelectorAll('*')) {
          const cs = getComputedStyle(el);
          const l = parseFloat(cs.borderLeftWidth); const rr = parseFloat(cs.borderRightWidth);
          if (l >= 2 && l > rr && cs.borderLeftStyle !== 'none' && !el.closest('svg')) stripes.push(el.className?.toString?.() || el.tagName);
          if (/gradient/.test(cs.backgroundImage) && !el.closest('svg')) gradients.push(el.className?.toString?.() || el.tagName);
        }
        const read = sheet.querySelector('.nn-read'); const label = sheet.querySelector('.nn-h');
        // h1 (the page) then h2 per section and h3 within one: no level is skipped.
        const levels = [...document.querySelectorAll('h1, h2, h3, h4')].map(h => Number(h.tagName[1]));
        const headingsInOrder = levels[0] === 1 && levels.every((l, i) => i === 0 || l <= levels[i - 1] + 1);
        return {
          sections, families: Object.fromEntries(families), stripes, gradients, text, headingsInOrder,
          katexErrors: document.querySelectorAll('.katex-error, [data-katex-error]').length,
          katexCount: sheet.querySelectorAll('.katex').length,
          plainLabels: [...sheet.querySelectorAll('.dg-tex-in')].filter(e => !e.querySelector('.katex')).length,
          diagrams: sheet.querySelectorAll('.dg, .dgi').length,
          readFont: getComputedStyle(read).fontFamily, labelFont: getComputedStyle(label).fontFamily,
          cmuLoaded: document.fonts.check('19px "CMU Serif"') && [...document.fonts].some(f => f.family.replace(/["']/g, '') === 'CMU Serif' && f.status === 'loaded'),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          widest: [...sheet.querySelectorAll('*')].filter(e => !e.closest('svg') && e.getBoundingClientRect().right > document.documentElement.clientWidth + 0.5).slice(0, 3).map(e => `${e.tagName}.${e.className?.toString?.().slice(0, 40)}`)
        };
      });
      ok(r.katexErrors === 0, `${where}: ${r.katexErrors} KaTeX render errors`);
      ok(r.katexCount > 10, `${where}: the maths is drawn by KaTeX (${r.katexCount} elements)`);
      ok(r.plainLabels === 0, `${where}: a diagram label is not KaTeX`);
      const has = present(written[t.id]);
      const expected = ORDER.filter(s => (s === 'living' ? livingIdsNsw(t.id).length > 0 : (!(s in has) || has[s])));
      ok(JSON.stringify(r.sections) === JSON.stringify(expected), `${where}: sections out of order or missing (${r.sections.join(', ')}; expected ${expected.join(', ')})`);
      ok(r.headingsInOrder, `${where}: the sheet's headings skip a level`);
      ok(r.sections.includes('diagram') === (written[t.id].diagrams?.length > 0), `${where}: the diagram section does not match the chapter's diagrams`);
      ok(/^"?CMU Serif/.test(r.readFont), `${where}: reading text is not CMU Serif (${r.readFont})`);
      ok(/Instrument Sans/.test(r.labelFont), `${where}: section labels are not Instrument Sans (${r.labelFont})`);
      ok(r.cmuLoaded, `${where}: CMU Serif did not load`);
      const allowed = f => /^(CMU Serif|Instrument Sans|KaTeX_[A-Za-z0-9]+|Instrument Sans Variable)$/.test(f);
      const stray = Object.keys(r.families).filter(f => !allowed(f));
      ok(stray.length === 0, `${where}: other faces on text: ${stray.join(', ')}`);
      ok(r.stripes.length === 0, `${where}: left-border accent on ${r.stripes.join(', ')}`);
      ok(r.gradients.length === 0, `${where}: gradient background on ${r.gradients.join(', ')}`);
      ok(!/[²³¹⁰-₟]/.test(r.text), `${where}: a Unicode superscript or subscript in rendered text`);
      ok(!/[✓✔✕✖✗✘✅❌✨]|\p{Extended_Pictographic}/u.test(r.text), `${where}: an emoji or glyph tick in rendered text`);
      ok(r.overflow <= 0, `${where}: overflows horizontally by ${r.overflow}px at phone width (${r.widest.join(' | ')})`);
    }

    if (WRITE_SHOTS) {
      mkdirSync(SHOTS_DIR, { recursive: true });
      for (const id of SHOT_TOPICS) {
        for (const [name, size] of [['desktop', { width: 1100, height: 900 }], ['phone', { width: 375, height: 812 }]]) {
          await page.setViewportSize(size);
          await page.goto(urlFor(id, theme), { waitUntil: 'networkidle' });
          await page.waitForSelector('[data-chapter-sheet]');
          await openAll(page);
          await page.evaluate(() => document.fonts.ready);
          await page.screenshot({ path: `${SHOTS_DIR}${id}-${theme}-${name}.png`, fullPage: true });
        }
      }
    }
    ok(errors.length === 0, `${theme}: no console or page errors (${errors.slice(0, 2).join(' | ')})`);
    await context.close();
  }
} finally {
  await browser.close();
  await server.close();
}

if (failures.length) {
  console.error(`NSW NOTES VISUAL: FAIL — ${failures.length} of ${pass + failures.length} checks failed`);
  for (const f of failures.slice(0, 40)) console.error(`  · ${f}`);
  process.exit(1);
}
console.log(`NSW NOTES VISUAL: PASS — ${pass}/${pass} checks — every written chapter, light and dark: no KaTeX error, the Experience 3 section order, self-check answers behind aria-expanded buttons, headings in order, CMU Serif for reading and Instrument Sans for labels, no accent stripe, gradient, emoji or Unicode script, and no overflow at phone width`);
