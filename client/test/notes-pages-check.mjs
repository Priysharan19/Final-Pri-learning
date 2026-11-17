// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · both editions' notes chapter PAGES, looked at in a real browser
//
// client/test/support/notes-page-gallery.jsx draws the real page component (the India
// page pages/Notes.jsx or the NSW page pages/NswNotes.jsx) at a /notes route, with the
// app's styles and no account. For an India chapter, an Olympiad topic, the Olympiad
// tab of the index and NSW chapters, in light and dark, at 375 px and at desktop width:
//
//   ORDER     the chapter's sections follow Experience 3 of the Learning Experience
//             Standard: objective, prerequisites, intuition, ideas, (India: definitions,
//             formulas, important points / NSW: definitions, formulas), diagram, examples,
//             (NSW: examiners), mistakes, check, (India: resources), practice — a section
//             is left out exactly when the chapter has no content for it, and the next
//             step into Practice is always last;
//   PRACTICE  the header's "Practise this" and the next step both open Practice on the
//             chapter (India: its subtopic and track; Olympiad: the olympiad track; NSW:
//             the issued subtopic that teaches the topic, or Practice for the student's
//             own year and course with the page saying so);
//   CHECK     self-check answers start hidden behind real buttons with aria-expanded and
//             open from them;
//   FACES     reading text paints in CMU Serif (and it loaded); no KaTeX render error;
//   A11Y      one h1, no heading level skipped, every section labelled by its heading;
//   MOTION    with reduced motion every block is visible without scrolling it in;
//   PHONE     at 375 px nothing overflows horizontally;
//   ERRORS    no console or page error.
//
//   node client/test/notes-pages-check.mjs [--shots]   (--shots: artifacts/notes-complete/pages/)
// ─────────────────────────────────────────────────────────────────────────────
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { loadNotesForGrade, loadOlympiadNotes } from '../src/notes/notesIndex.js';
import { NSW_NOTES_TOPIC_BY_ID, loadNswNotesForStage } from '../src/notes/nsw/nswNotesIndex.js';
import { nswPracticeSubtopic } from '../src/notes/nsw/nswPractice.js';
import { IN_CHAPTER_BY_ID } from '../src/engine/curriculum-in.js';
import { studyResourcesForGrade } from '../src/notes/data/notes-study-resources.js';

const CLIENT = fileURLToPath(new URL('..', import.meta.url));
const SHOTS_DIR = fileURLToPath(new URL('../../artifacts/notes-complete/pages/', import.meta.url));
const WRITE_SHOTS = process.argv.includes('--shots');
let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };

const IN_ORDER = ['objective', 'prerequisites', 'intuition', 'ideas', 'definitions', 'formulas', 'points', 'diagram', 'examples', 'mistakes', 'check', 'resources', 'practice'];
const NSW_ORDER = ['objective', 'prerequisites', 'intuition', 'ideas', 'definitions', 'formulas', 'diagram', 'examples', 'examiners', 'mistakes', 'check', 'practice'];

const india = await loadNotesForGrade(10);
const olympiad = await loadOlympiadNotes();
const CASES = [
  { name: 'india-c10-quadratic-equations', page: 'in', path: '/notes/c10-quadratic-equations', id: 'c10-quadratic-equations', notes: india['c10-quadratic-equations'],
    practice: '/practice?subtopic=c10-quadratic-equations&track=cbse', order: IN_ORDER, resources: studyResourcesForGrade(10, 'cbse').length > 0 },
  { name: 'india-olymp-number-theory', page: 'in', path: '/notes/olymp-number-theory', id: 'olymp-number-theory', notes: olympiad['olymp-number-theory'] || null,
    practice: '/practice?subtopic=olymp-number-theory&track=olympiad', order: IN_ORDER, resources: false },
  { name: 'india-index-olympiad', page: 'in', path: '/notes?class=olympiad', index: true },
  ...[['nsw-mav-11-01', 'mav-11-01'], ['nsw-ma4-frc-c-01', 'ma4-frc-c-01'], ['nsw-mav-11-03', 'mav-11-03'], ['nsw-ma5-fin-c-02', 'ma5-fin-c-02']].map(([name, id]) => ({ name, page: 'nsw', id, path: `/notes/${id}`, nsw: true }))
];
for (const c of CASES.filter(x => x.nsw)) {
  const topic = NSW_NOTES_TOPIC_BY_ID[c.id];
  c.notes = ((await loadNswNotesForStage(topic.stage, topic.course)) || {})[c.id] || null;
  const sub = nswPracticeSubtopic(topic);
  c.practice = sub ? `/practice?subtopic=${sub}` : '/practice';
  c.exactPractice = !!sub;
  c.order = NSW_ORDER;
}
// Graph transformations (MAV-11-03) is taught by an issued subtopic (y11-transform: Year 11 Advanced, every difficulty), so
// its practice link is that subtopic's. The fallback to plain /practice is exercised by a topic no issued subtopic reaches.
ok(CASES.find(c => c.id === 'mav-11-03').exactPractice === true && CASES.find(c => c.id === 'mav-11-03').practice === '/practice?subtopic=y11-transform', 'mav-11-03 (Graph transformations) links to its issued subtopic y11-transform');
ok(CASES.find(c => c.id === 'ma5-fin-c-02').exactPractice === false, 'ma5-fin-c-02 has no issued practice subtopic, so it exercises the fallback');

function expectedSections(c) {
  const n = c.notes;
  const has = {
    objective: !!n.objective,
    prerequisites: (n.prereqs || []).some(p => (c.nsw ? NSW_NOTES_TOPIC_BY_ID[p] : IN_CHAPTER_BY_ID[p])),
    intuition: !!n.intuition, points: n.points?.length > 0, diagram: n.diagrams?.length > 0, examiners: n.examiners?.length > 0,
    mistakes: n.mistakes?.length > 0, check: n.check?.length > 0, resources: !!c.resources
  };
  return c.order.filter(s => !(s in has) || has[s]);
}

const server = await createServer({
  root: CLIENT, configFile: fileURLToPath(new URL('../vite.config.js', import.meta.url)), logLevel: 'error',
  server: { host: '127.0.0.1', port: 0, strictPort: false, hmr: false, watch: null, proxy: undefined },
  optimizeDeps: { entries: ['test/support/notes-page-gallery.html'] }
});
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const urlFor = (c, theme) => `${origin}/test/support/notes-page-gallery.html?page=${c.page}&path=${encodeURIComponent(c.path)}&theme=${theme}`;
const ready = c => (c.index ? '[data-testid="notes-chapter"]' : c.notes ? '[data-nn-section="practice"]' : '[data-not-written], [data-coming-soon]');

const browser = await chromium.launch();
try {
  for (const theme of ['light', 'dark']) {
    for (const [size, viewport] of [['phone', { width: 375, height: 812 }], ['desktop', { width: 1280, height: 900 }]]) {
      const context = await browser.newContext({ viewport, deviceScaleFactor: 2, colorScheme: theme, reducedMotion: size === 'phone' ? 'reduce' : 'no-preference' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      for (const c of CASES) {
        const where = `${c.name} (${theme}, ${size})`;
        await page.goto(urlFor(c, theme), { waitUntil: 'networkidle' });
        await page.waitForSelector(ready(c), { timeout: 30000 });
        await page.evaluate(() => document.fonts.ready);

        if (c.index) {
          const r = await page.evaluate(() => ({
            tab: document.querySelector('[role="tab"][aria-selected="true"]')?.textContent,
            rows: document.querySelectorAll('[data-testid="notes-chapter"]').length,
            map: document.querySelectorAll('.nt-map-node').length
          }));
          ok(r.tab === 'Olympiad', `${where}: the Olympiad tab is selected (${r.tab})`);
          ok(r.rows === 7, `${where}: all 7 Olympiad topics are listed (${r.rows})`);
          ok(r.map === 0, `${where}: no class chapter map on the Olympiad tab`);
        } else if (c.notes) {
          const closed = await page.evaluate(() => [...document.querySelectorAll('.nn-check li')].map(li => {
            const b = li.querySelector('button[aria-expanded]'); const a = b && document.getElementById(b.getAttribute('aria-controls'));
            return !!b && b.getAttribute('aria-expanded') === 'false' && !!a && a.hidden;
          }));
          ok(closed.every(Boolean), `${where}: a self-check answer shows before it is asked for`);
          while (await page.locator('.nn-check button[aria-expanded="false"]').count()) await page.locator('.nn-check button[aria-expanded="false"]').first().click();
          const opened = await page.evaluate(() => [...document.querySelectorAll('.nn-check .nn-check-a')].every(a => !a.hidden && a.getBoundingClientRect().height > 0));
          ok(opened, `${where}: a self-check answer does not open from its button`);
          if (size === 'phone') await page.evaluate(() => document.querySelectorAll('.nt-reveal').forEach(el => el.classList.add('is-in')));
          const r = await page.evaluate(() => {
            const sections = [...document.querySelectorAll('[data-nn-section]')];
            const levels = [...document.querySelectorAll('h1, h2, h3, h4')].map(h => Number(h.tagName[1]));
            const read = document.querySelector('.nn-read, .nt-concept-body, .nt-example-q');
            // Every kind of reading text on either page, not only the first one found.
            const READING = ['.nn-read', '.nt-lede', '.nt-concept-body', '.nt-example-q', '.nt-defs dd', '.nt-point-back', '.nt-wrong', '.nt-right', '.nn-idea-t'];
            const notCmu = READING.filter(sel => { const el = document.querySelector(sel); return el && !/^"?CMU Serif/.test(getComputedStyle(el).fontFamily); });
            return {
              order: sections.map(s => s.dataset.nnSection),
              labelled: sections.every(s => { const h = document.getElementById(s.getAttribute('aria-labelledby')); return !!h && s.contains(h) && h.textContent.trim().length > 0; }),
              h1: document.querySelectorAll('h1').length,
              headingsInOrder: levels[0] === 1 && levels.every((l, i) => i === 0 || l <= levels[i - 1] + 1),
              katexErrors: document.querySelectorAll('.katex-error, [data-katex-error]').length,
              readFont: read ? getComputedStyle(read).fontFamily : '', notCmu,
              cmuLoaded: [...document.fonts].some(f => f.family.replace(/["']/g, '') === 'CMU Serif' && f.status === 'loaded'),
              hidden: [...document.querySelectorAll('.nt-reveal')].filter(e => getComputedStyle(e).opacity !== '1').length,
              overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
              practiceButtons: document.querySelectorAll('[data-testid="notes-practise"]').length,
              nextNote: document.querySelector('.nn-next-note')?.textContent || null
            };
          });
          const expected = expectedSections(c);
          ok(JSON.stringify(r.order) === JSON.stringify(expected), `${where}: sections ${r.order.join(', ')}; expected ${expected.join(', ')}`);
          ok(r.labelled, `${where}: a section is not labelled by its own heading`);
          ok(r.h1 === 1 && r.headingsInOrder, `${where}: headings skip a level or there is not exactly one h1`);
          ok(r.katexErrors === 0, `${where}: ${r.katexErrors} KaTeX render errors`);
          ok(/^"?CMU Serif/.test(r.readFont), `${where}: reading text is not CMU Serif (${r.readFont})`);
          ok(r.cmuLoaded, `${where}: CMU Serif did not load`);
          ok(r.notCmu.length === 0, `${where}: reading text not in CMU Serif: ${r.notCmu.join(', ')}`);
          if (size === 'phone') ok(r.hidden === 0, `${where}: ${r.hidden} blocks hidden under reduced motion`);
          ok(r.practiceButtons === 1, `${where}: exactly one header "Practise this" (${r.practiceButtons})`);
          if (c.nsw) ok(!!r.nextNote === !c.exactPractice, `${where}: the next step says so exactly when the topic has no practice set of its own`);
          ok(r.overflow <= 0, `${where}: overflows horizontally by ${r.overflow}px`);
        } else {
          ok(await page.locator('[data-testid="notes-practise"]').count() === 1, `${where}: a topic without notes still offers its practice`);
        }

        if (WRITE_SHOTS && !c.name.startsWith('nsw-ma4')) {
          mkdirSync(SHOTS_DIR, { recursive: true });
          // A full-page shot never scrolls, so settle every scroll-linked reveal first.
          await page.evaluate(() => { document.querySelectorAll('.nt-reveal').forEach(el => el.classList.add('is-in')); window.scrollTo(0, 0); });
          await page.waitForTimeout(800);
          await page.screenshot({ path: `${SHOTS_DIR}${c.name}-${theme}-${size}.png`, fullPage: true, scale: 'css' });
        }

        if (!c.index) {
          for (const sel of ['[data-testid="notes-practise"]', '[data-testid="notes-next-practise"]']) {
            if (!(await page.locator(sel).count())) continue;
            await page.goto(urlFor(c, theme), { waitUntil: 'networkidle' });
            await page.waitForSelector(ready(c));
            await page.locator(sel).click();
            const left = await page.locator('[data-left-notes]').getAttribute('data-left-notes');
            ok(left === c.practice, `${where}: ${sel} opened ${left}, expected ${c.practice}`);
          }
        }
      }
      ok(errors.length === 0, `${theme} ${size}: no console or page errors (${errors.slice(0, 2).join(' | ')})`);
      await context.close();
    }
  }
} finally {
  await browser.close();
  await server.close();
}

if (failures.length) {
  console.error(`NOTES PAGES: FAIL — ${failures.length} of ${pass + failures.length} checks failed`);
  for (const f of failures.slice(0, 40)) console.error(`  · ${f}`);
  process.exit(1);
}
console.log(`NOTES PAGES: PASS — ${pass}/${pass} checks — India, Olympiad and NSW chapter pages, light and dark, phone and desktop: Experience 3 section order, Practice links with their context, self-check behind aria-expanded buttons, CMU Serif reading face, headings in order, nothing hidden under reduced motion, no overflow, no errors`);
