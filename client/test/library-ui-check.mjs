// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the resource library, as drawn (client/src/library/)
//
// Rendered from the SERVER's own seed (server/platform/resourceCatalog.js,
// through resourcePublic, the shape /v1/resources sends), in English and Hindi:
//   · the certification state is said in plain words — the seeded paper reads
//     "Paper to read — not marked by Pri"; an unknown state reads as the lowest;
//   · the disclaimer, source, attribution and rights note are shown as recorded;
//   · the external link is https only and opens with noopener noreferrer;
//   · search and filters follow the server's rules (every word; exact filters);
//   · every call goes through the audited transport to its /v1 route;
//   · DARK: PRI_FEATURE_LIBRARY gates the nav entry and both routes, and a
//     production build without it has the flag off.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const root = fileURLToPath(new URL('..', import.meta.url));
const read = rel => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

const { RESOURCE_SEED, resourcePublic, resourceRowValues } = await import('../../server/platform/resourceCatalog.js');
const { featureStates, PENDING_FEATURE_FLAGS } = await import('../vite.config.js');
const { createServer } = await import('vite');
const react = (await import('@vitejs/plugin-react')).default;
const React = (await import('react')).default;
const { renderToStaticMarkup } = await import('react-dom/server');
const server = await createServer({
  root, configFile: false, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true },
  plugins: [react()], define: { __PRI_FEATURE_TUTOR__: 'false', __PRI_PRODUCTION_BUILD__: 'false' }
});

// The seed exactly as the server sends it.
const COLS = ['id', 'title', 'subtitle', 'description', 'type', 'subject', 'year', 'grade', 'marks', 'duration_minutes', 'reading_minutes',
  'question_count', 'tags_json', 'course', 'syllabus_version', 'certification_state', 'availability', 'url', 'source', 'attribution',
  'rights_note', 'disclaimer', 'review_state', 'created_at', 'updated_at', 'published_at'];
const SEED = RESOURCE_SEED[0];
const sent = resourcePublic(Object.fromEntries(COLS.map((k, i) => [k, resourceRowValues(SEED)[i]])));
const escapeHtml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');

try {
  const i18n = await server.ssrLoadModule('/src/i18n/index.js');
  const view = await server.ssrLoadModule('/src/library/Library.jsx');
  const api = await server.ssrLoadModule('/src/library/libraryApi.js');
  for (const lang of ['en', 'hi']) {
    await i18n.setLanguage(lang);
    const t = (key, vars) => i18n.translate(key, vars);
    const draw = r => renderToStaticMarkup(React.createElement(view.ResourceView, { r, t }));
    const html = draw(sent);
    ok(html.includes(escapeHtml(t('library.cert.uploaded'))) && html.includes('data-certification="uploaded"'), `${lang}: the seeded paper says it is to read and not marked by Pri`);
    ok(html.includes(escapeHtml(SEED.disclaimer)), `${lang}: the disclaimer is shown exactly as recorded`);
    ok([SEED.attribution, SEED.rightsNote, SEED.source].every(v => html.includes(escapeHtml(v))), `${lang}: source, attribution and rights note are shown`);
    ok(html.includes(escapeHtml(t('library.syllabusNone'))), `${lang}: no syllabus version is claimed where the source states none`);
    ok(html.includes(`href="${SEED.url}"`) && html.includes('target="_blank"') && html.includes('rel="noopener noreferrer"'), `${lang}: the external link is the recorded https link, opened safely`);
    ok(html.includes(escapeHtml(t('library.hours', { count: 3, n: 3 }))) && html.includes(escapeHtml(t('library.reading', { count: 10, n: 10 }))), `${lang}: 180 working minutes read as 3 hours, plus 10 minutes' reading time`);
    ok(html.includes(escapeHtml(t('library.marks', { count: 100, n: 100 }))) && html.includes(escapeHtml(t('library.questions', { count: 27, n: 27 }))), `${lang}: marks and question count`);
    const unsafe = draw({ ...sent, url: 'javascript:alert(1)' });
    ok(!unsafe.includes('javascript:') && !unsafe.includes('data-testid="library-open"'), `${lang}: a non-https link is never drawn`);
    const unknown = draw({ ...sent, certificationState: 'marked-by-ai' });
    ok(unknown.includes(escapeHtml(t('library.cert.uploaded'))), `${lang}: an unknown certification state reads as the lowest, never more`);
    const unmarked = ['uploaded', 'structured', 'verified'].map(k => t(`library.cert.${k}`));
    ok(unmarked.every(text => text.includes(lang === 'hi' ? 'अंक नहीं देता' : 'not marked by Pri')), `${lang}: the three states below an issued examination say plainly that Pri does not mark them`);
  }
  await i18n.setLanguage('en');
  ok(i18n.translate('library.cert.uploaded') === 'Paper to read — not marked by Pri', 'the CTO wording for an uploaded paper, exactly');

  // Search and filters.
  const rows = [sent, { ...sent, id: 'b-notes', type: 'notes', title: 'Calculus notes', subtitle: null, description: 'Limits 50% faster.', tags: [], year: 2026, course: 'in', subject: 'Mathematics' }];
  const ids = f => api.filterResources(rows, f).map(r => r.id);
  ok(JSON.stringify(ids({})) === JSON.stringify([SEED.id, 'b-notes']), 'no filter: everything, in the order given');
  ok(JSON.stringify(ids({ q: 'hsc 100 MARKS' })) === JSON.stringify([SEED.id]), 'search: every word, any case, title and tags');
  ok(JSON.stringify(ids({ q: 'hsc calculus' })) === '[]', 'search: one missing word excludes');
  ok(JSON.stringify(ids({ q: '50%' })) === JSON.stringify(['b-notes']), 'search: % is literal');
  ok(JSON.stringify(ids({ type: 'notes' })) === JSON.stringify(['b-notes']) && JSON.stringify(ids({ year: '2027' })) === JSON.stringify([SEED.id]), 'type and year filters');
  ok(JSON.stringify(ids({ subject: 'mathematics advanced', course: 'nsw' })) === JSON.stringify([SEED.id]), 'subject (any case) and course filters');
  ok(api.safeExternalUrl('http://example.org') === null && api.safeExternalUrl('https://u:p@example.org') === null && api.safeExternalUrl(SEED.url) === SEED.url, 'only plain https links are opened');
  ok(api.workingTime(90)?.key === 'library.minutes' && api.workingTime(120)?.n === 2 && api.workingTime(0) === null, 'working time: hours when whole, otherwise minutes');
  ok(api.isResourceId(SEED.id) && !api.isResourceId('../admin') && !api.isResourceId('A'), 'only well-formed ids are requested');
} finally {
  await server.close();
}

// Wiring: the audited transport, and dark by default.
const apiSrc = read('src/library/libraryApi.js');
ok(/cloudRequest\('\/v1\/resources'\)/.test(apiSrc) && /cloudRequest\(`\/v1\/resources\/\$\{id\}`\)/.test(apiSrc) && !/fetch\(/.test(apiSrc), 'every call goes through cloudRequest to /v1/resources');
const app = read('src/App.jsx');
ok(/const LIBRARY_ON = featureEnabled\('library'\);/.test(app), 'App reads the library flag');
ok(/\{LIBRARY_ON && <Route path="\/library" /.test(app) && /\{LIBRARY_ON && <Route path="\/library\/:id" /.test(app), 'both routes exist only where the flag is on');
ok(/\.\.\.\(LIBRARY_ON \? \[\{ to: '\/library'/.test(app), 'the nav entry exists only where the flag is on');
ok(PENDING_FEATURE_FLAGS.includes('LIBRARY'), 'LIBRARY is a pending build flag');
ok(featureStates('build', {}).library === false, 'a production build without PRI_FEATURE_LIBRARY has the library off (V1 unchanged)');
ok(featureStates('build', { PRI_FEATURE_LIBRARY: '1' }).library === true, 'a build with PRI_FEATURE_LIBRARY=1 has it on');
ok(featureStates('serve', {}).library === true, 'the development server has it on');
ok(/library: typeof __PRI_FEATURE_LIBRARY__ === 'boolean'/.test(read('src/platform/features.js')), 'features.js reads the build constant');

if (failures.length) {
  console.error(`LIBRARY UI: FAIL — ${failures.length} of ${pass + failures.length} checks failed`);
  for (const f of failures) console.error(`  · ${f}`);
  process.exit(1);
}
console.log(`LIBRARY UI: PASS — ${pass}/${pass} checks`);
