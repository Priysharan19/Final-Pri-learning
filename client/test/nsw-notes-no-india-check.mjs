// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a Prithagoras build never shows India curriculum data on the
// Notes route (the hard rule of mission nsw-notes), held deterministically:
//
//   1. WIRING   App.jsx chooses the NSW notes page for the Prithagoras edition
//               and the India notes page only otherwise, for both /notes routes;
//   2. IMPORTS  the NSW notes page, its index, its data modules and the shared
//               parts reach (through static imports, the app shell excepted)
//               none of the India curriculum, the India notes, their loader or
//               the India page: the import graph is walked and checked;
//   3. RENDER   the NSW notes index, drawn for every Year 7–12 tab and every
//               Year 11–12 course, contains no NCERT / CBSE / JEE / "Class N" /
//               India wording, in English or Hindi, and names the Year;
//   4. HONESTY  a topic without notes says "coming soon"; no topic is stubbed
//               with other content; and every topic of the NSW model appears;
//   5. STRINGS  every notes.nsw.* string is free of India wording.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const root = fileURLToPath(new URL('..', import.meta.url));
const read = rel => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const INDIA = /NCERT|CBSE|\bJEE\b|\bClass\s*\d|\bIndian?\b|rupee|₹|lakh|crore|\bIIT\b/i;

// ── 1 · wiring ───────────────────────────────────────────────────────────────
const app = read('src/App.jsx');
ok(/const NSW_NOTES_BUILD = typeof __PRI_EDITION__ === 'string' && __PRI_EDITION__ === 'prithagoras';\s*const Notes = NSW_NOTES_BUILD\s*\?\s*React\.lazy\(\(\) => import\('\.\/pages\/NswNotes\.jsx'\)\)\s*:\s*React\.lazy\(\(\) => import\('\.\/pages\/Notes\.jsx'\)\);/.test(app), 'App picks the NSW notes page for the Prithagoras edition and the India page otherwise');
ok(/<Route path="\/notes" element=\{studentOnly\(<Notes \/>\)\} \/>/.test(app) && /<Route path="\/notes\/:chapterId" element=\{studentOnly\(<Notes \/>\)\} \/>/.test(app), 'both /notes routes render the edition-chosen page');
ok(!/import\(['"]\.\/pages\/Notes\.jsx['"]\)/.test(app.replace(/const Notes = EDITION[\s\S]*?Notes\.jsx'\)\);/, '')), 'no other route imports the India notes page');

// The welcome screen's kicker named CBSE / NCERT / JEE on every edition; it now
// names them only where the edition offers the India course.
const login = read('src/pages/Login.jsx');
ok(/\{!offersCourse\('in'\) \? t\('login\.kickerNsw'\) : featureEnabled\('extendedTracks'\)/.test(login), 'the welcome kicker shows CBSE / NCERT / JEE only where the edition offers the India course');

// ── 2 · the import graph ─────────────────────────────────────────────────────
const FORBIDDEN = [/engine\/curriculum-in\.js$/, /notes\/notesIndex\.js$/, /notes\/data\//, /pages\/Notes\.jsx$/, /engine\/curriculum\.js$/, /lib\/studyJourney\.js$/, /lib\/practiceLinks\.js$/];
const SHELL = /src\/App\.jsx$/; // the app shell (context, router); not part of the notes page
function staticImports(file) {
  const text = readFileSync(file, 'utf8');
  const out = [];
  for (const m of text.matchAll(/(?:^|\n)\s*(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]|(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g)) out.push(m[1] || m[2]);
  return out.filter(s => s.startsWith('.'));
}
const seen = new Map();
function walk(file) {
  if (seen.has(file)) return;
  seen.set(file, true);
  if (SHELL.test(file)) return;
  for (const spec of staticImports(file)) {
    let target = resolve(dirname(file), spec);
    for (const candidate of [target, `${target}.js`, `${target}.jsx`, join(target, 'index.js')]) { if (existsSync(candidate) && !candidate.endsWith('/')) { try { if (readFileSync(candidate, 'utf8') !== undefined) { target = candidate; break; } } catch { /* a directory */ } } }
    if (/\.(css)$/.test(target)) continue;
    if (!existsSync(target)) continue;
    walk(target);
  }
}
const entries = ['src/pages/NswNotes.jsx', 'src/notes/NotesParts.jsx', 'src/notes/nsw/nswNotesIndex.js', 'src/notes/nsw/notes-nsw-stage4.js'].map(p => join(root, p));
for (const e of entries) walk(e);
const graph = [...seen.keys()].map(f => f.slice(root.length));
for (const f of graph) {
  for (const re of FORBIDDEN) ok(!re.test(f), `the NSW notes import graph reaches ${f} (matches ${re})`);
}
ok(graph.some(f => /curriculum-nsw\/index\.js$/.test(f)), 'the NSW notes are built from the NSW curriculum model');
ok(graph.length > 6 && graph.length < 80, `the walked graph is the page and its parts (${graph.length} files)`);

// ── 3 · the render ───────────────────────────────────────────────────────────
const { createServer } = await import('vite');
const react = (await import('@vitejs/plugin-react')).default;
const React = (await import('react')).default;
const { renderToStaticMarkup } = await import('react-dom/server');
const { MemoryRouter, Routes, Route } = await import('react-router-dom');
const server = await createServer({
  root, configFile: false, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true },
  plugins: [react()], define: { __PRI_FEATURE_TUTOR__: 'false', __PRI_PRODUCTION_BUILD__: 'false', __PRI_EDITION__: '"prithagoras"' }
});
try {
  const i18n = await server.ssrLoadModule('/src/i18n/index.js');
  const index = await server.ssrLoadModule('/src/notes/nsw/nswNotesIndex.js');
  const page = await server.ssrLoadModule('/src/pages/NswNotes.jsx');
  const draw = (url) => renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: [url] }, React.createElement(Routes, null,
    React.createElement(Route, { path: '/notes', element: React.createElement(page.default) }),
    React.createElement(Route, { path: '/notes/:chapterId', element: React.createElement(page.default) }))));
  for (const lang of ['en', 'hi']) {
    await i18n.setLanguage(lang);
    const t = (k, v) => i18n.translate(k, v);
    for (const year of index.NSW_NOTES_YEARS) {
      for (const course of (year >= 11 ? index.NSW_NOTES_COURSES.map(c => c.id) : [null])) {
        const url = `/notes?year=${year}${course ? `&course=${course}` : ''}`;
        const html = draw(url);
        const label = `${lang} ${url}`;
        ok(!INDIA.test(html.replace(/<[^>]+>/g, ' ')), `${label}: India wording in the rendered notes index (${(html.replace(/<[^>]+>/g, ' ').match(INDIA) || [])[0]})`);
        ok(html.includes(`data-nsw-notes`) && html.includes(`data-year="${year}"`), `${label}: the NSW notes page is drawn with the Year tab`);
        ok(index.NSW_NOTES_YEARS.every(y => html.includes(`>${t('notes.nsw.yearTab', { n: y })}<`)), `${label}: the tabs read Year 7 … Year 12`);
        const topics = index.topicsFor(year, course);
        ok(topics.length === 0 ? html.includes('data-no-topics') : topics.every(x => html.includes(x.name.replace(/&/g, '&amp;').replace(/’/g, '’'))) , `${label}: every topic of the NSW model for this year${course ? ' and course' : ''} is listed (${topics.length})`);
        ok(!/data-testid="notes-chapter"/.test(html) || year <= 8, `${label}: only topics with written notes link through (and only Stage 4 has any yet)`);
        if (year >= 11) ok(html.includes(t(`notes.nsw.course.${course}`)), `${label}: the course is named`);
      }
    }
  }
  // 4 · honesty: every NSW focus area is in the index; those without notes say so.
  const { NSW_NOTES_TOPICS } = index;
  ok(NSW_NOTES_TOPICS.length === 112, `the index holds every focus area of the current NSW syllabuses (${NSW_NOTES_TOPICS.length})`);
  await i18n.setLanguage('en');
  const y9 = draw('/notes?year=9');
  ok((y9.match(/data-coming-soon/g) || []).length === index.topicsFor(9).length, 'Year 9: every topic says "coming soon" until its notes are written');
  ok(!/data-testid="notes-chapter"/.test(y9), 'Year 9 links to nothing that has no notes');
  const y7 = draw('/notes?year=7');
  ok((y7.match(/data-coming-soon/g) || []).length === index.topicsFor(7).length, 'Year 7 (before the notes load) marks every topic "coming soon", never India content');
  // A topic page for a topic without notes, and an unknown id, never show India content.
  const unknown = draw('/notes/c10-real-numbers');
  ok(!INDIA.test(unknown.replace(/<[^>]+>/g, ' ')) && /not in the NSW notes/.test(unknown), 'an India chapter id on the Prithagoras notes route shows the NSW "not found", not the chapter');
  const soon = draw('/notes/ma5-alg-c-01?year=9');
  ok(!INDIA.test(soon.replace(/<[^>]+>/g, ' ')) && soon.includes('Algebraic techniques A'), 'a Stage 5 topic page is the NSW topic (its notes load, or say "coming soon")');

  // 5 · strings
  const { default: en } = await server.ssrLoadModule('/src/i18n/strings.en.js');
  const { default: hi } = await server.ssrLoadModule('/src/i18n/strings.hi.js');
  for (const [lang, cat] of [['en', en], ['hi', hi]]) {
    const keys = Object.keys(cat).filter(k => k.startsWith('notes.nsw.'));
    ok(keys.length >= 26, `${lang}: the NSW notes strings exist (${keys.length})`);
    for (const k of keys) ok(!INDIA.test(JSON.stringify(cat[k])), `${lang} ${k}: India wording`);
  }
} finally {
  await server.close();
}

if (failures.length) {
  console.error(`NSW NOTES · NO INDIA: FAIL — ${failures.length} of ${pass + failures.length} checks failed`);
  for (const f of failures.slice(0, 40)) console.error(`  · ${f}`);
  process.exit(1);
}
console.log(`NSW NOTES · NO INDIA: PASS — ${pass}/${pass} checks — the notes route in a Prithagoras build is the NSW page, its import graph reaches none of the India curriculum or notes, and every Year and course renders without India wording`);
