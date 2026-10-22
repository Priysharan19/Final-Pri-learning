// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the parent weekly report, as drawn (client/src/parent/)
//
// Rendered from reports the SERVER's own builder made (server/platform/
// parentReport.js buildWeeklyReport), in English and Hindi:
//   · below the evidence floor the view says "not enough data yet" and shows no
//     accuracy, no chapters and no mistakes count — never a 0% or a 100%;
//   · time is labelled as a lower bound wherever it is shown;
//   · the emailed-link page reads its token only from the fragment;
//   · every call goes through the audited transport to its /v1 route.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const root = fileURLToPath(new URL('..', import.meta.url));
const read = rel => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

const { attemptFromEvent, buildWeeklyReport } = await import('../../server/platform/parentReport.js');
const { createServer } = await import('vite');
const react = (await import('@vitejs/plugin-react')).default;
const React = (await import('react')).default;
const { renderToStaticMarkup } = await import('react-dom/server');
const server = await createServer({
  root, configFile: false, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true },
  plugins: [react()], define: { __PRI_FEATURE_TUTOR__: 'false', __PRI_PRODUCTION_BUILD__: 'false' }
});

const MONDAY = Date.parse('2026-10-18T18:30:00Z');
const W = { weekStart: MONDAY, weekEnd: MONDAY + 7 * 86400000 };
const graded = (at, item, correct, topic = 'c10-circles') => attemptFromEvent({ kind: 'graded-attempt', device_id: 'server-grader', entity_id: item, occurred_at: at,
  payload_json: JSON.stringify({ questionId: item, contentId: item, subtopic: topic, correct, marksEarned: correct ? 2 : 0, marksPossible: 2 }) });

try {
  const i18n = await server.ssrLoadModule('/src/i18n/index.js');
  const view = await server.ssrLoadModule('/src/parent/ParentReport.jsx');
  const api = await server.ssrLoadModule('/src/parent/parentReportApi.js');
  for (const lang of ['en', 'hi']) {
    await i18n.setLanguage(lang);
    const t = (key, vars) => i18n.translate(key, vars);
    const draw = report => renderToStaticMarkup(React.createElement(view.Report, { report, t, locale: lang === 'hi' ? 'hi-IN' : 'en-IN' }));

    const thin = draw(buildWeeklyReport([graded(MONDAY + 60000, 'a', true), graded(MONDAY + 120000, 'b', true)], W));
    ok(thin.includes('data-parent-report="not-enough"'), `${lang}: two answers render as not-enough-data`);
    ok(thin.includes(t('parent.notEnoughShort')), `${lang}: and say "not enough data yet" in place of a rate`);
    ok(!/\b100%|\b0%/.test(thin), `${lang}: no percentage is drawn from two answers`);
    ok(!thin.includes(t('parent.strong')), `${lang}: no chapter verdicts below the floor`);
    ok(thin.includes(t('parent.timeNote')), `${lang}: time is labelled as a lower bound`);

    const none = draw(buildWeeklyReport([], W));
    ok(none.includes(t('parent.nothingYet')) && none.includes(t('parent.timeNone')), `${lang}: an empty week says nothing was recorded, honestly`);

    const full = draw(buildWeeklyReport([...Array(6)].map((_, i) => graded(MONDAY + 3600000 + i * 60000, `q${i}`, i < 5)), W));
    ok(full.includes('data-parent-report="enough"') && full.includes('83%'), `${lang}: a measured week shows its share of marks (10 / 12)`);
    ok(full.includes('Circles'), `${lang}: chapters are named from the syllabus`);
    ok(full.includes(t('parent.honestyNote')), `${lang}: the report says it is not a prediction`);
  }

  ok(api.parseParentEmailFragment('#action=confirm&token=abc')?.token === 'abc', 'the emailed link\'s token is read from the fragment');
  ok(api.parseParentEmailFragment('#action=delete&token=abc') === null, 'an unknown action is refused');
  ok(api.parseParentEmailFragment('#action=confirm&token=' + 'x'.repeat(600)) === null, 'an oversized token is refused');
  const src = read('src/parent/parentReportApi.js');
  for (const route of ["'/v1/parent-report'", "'/v1/parent-report/link'", "'/v1/parent-report/link/stop'", "'/v1/parent-report/confirm'", "'/v1/parent-report/unsubscribe'"]) {
    ok(src.includes(`cloudRequest(${route}`), `${route} goes through the audited transport`);
  }
  const main = read('src/main.jsx');
  ok(/PARENT_EMAIL_MODE[\s\S]*parseParentEmailFragment\(window\.location\.hash\)[\s\S]*history\.replaceState/.test(main), 'the token is stripped from the address bar before render');
  const page = read('src/parent/ParentReportEmailAction.jsx');
  ok(/onClick=\{act\}/.test(page) && !/useEffect/.test(page), 'nothing is confirmed or stopped until the parent presses the button');
} finally {
  await server.close();
}

console.log(failures.length
  ? `PARENT REPORT UI: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `PARENT REPORT UI: PASS — ${pass}/${pass} checks — honest below the floor in both languages, time as a lower bound, fragment-only tokens, audited routes.`);
process.exit(failures.length ? 1 : 0);
