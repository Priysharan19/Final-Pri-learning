// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · HSC 2027 priorities (Prithagoras) — the contract
//
//   1. Schema and provenance: every record validates, cites a NESA document in
//      the registry with a sha256, and every paper adds to its total.
//   2. Rights: no record carries NESA text; a record that tries is refused,
//      and the generated metadata files hold no prose.
//   3. The old → new map and the 2024 outcomes agree with the NSW curriculum
//      model (codes, focus-area names, Years, content-group counts), and the
//      practice links equal what the model's crosswalk derives.
//   4. Determinism: the ranking is pinned; the backtest is reproducible and the
//      evidence doc matches it (tools/hsc-backtest.mjs --check).
//   5. Edition isolation: nothing is offered to a Priyabhata (India) profile,
//      and no India surface imports the engine.
//   6. Copy: en-AU spelling, the required "not a prediction" sentence, no
//      predicted mark/band/ATAR language, a Hindi string for every key.
//   7. Render: the view renders for an Advanced and an Extension 1 student.
//
// Usage: node client/test/hsc-priorities-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const repo = join(root, '..');
const read = rel => readFileSync(join(repo, rel), 'utf8');
let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const throws = (fn, re, label) => { try { fn(); failures.push(`${label} (did not throw)`); } catch (e) { ok(re.test(e.message), `${label} (${e.message})`); } };

const { HSC_RECORDS, HSC_PAST_PAPERS, HSC_SAMPLE } = await import('../src/engine/hsc/hscIndex.js');
const { HSC_SOURCES, HSC_REPRODUCTION } = await import('../src/engine/hsc/hscSources.js');
const { validateHscRecord, HSC_TEXT_FIELDS, HSC_PAPER_MARKS } = await import('../src/engine/hsc/hscSchema.js');
const { HSC_OUTCOMES_2024, HSC_TOPIC_MAP, HSC_PRACTICE_LINKS } = await import('../src/engine/hsc/hscOutcomes.js');
const P = await import('../src/engine/hsc/hscPriorities.js');
const { hscPractiseNext, hscPaperWeights, hscCoursesFor } = await import('../src/engine/hsc/hscPractice.js');
const NSW = await import('../src/engine/curriculum-nsw/index.js');

// ── 1. Schema and provenance ────────────────────────────────────────────────
ok(HSC_RECORDS.length === 622, `622 records (${HSC_RECORDS.length})`);
ok(HSC_PAST_PAPERS.advanced.map(p => p.year).join() === '2020,2021,2022,2023,2024,2025', 'Advanced 2020–2025 tagged (2026 waits for NESA\'s marking guidelines)');
ok(HSC_PAST_PAPERS.extension1.map(p => p.year).join() === '2020,2021,2022,2023,2024,2025,2026', 'Extension 1 2020–2026 tagged');
for (const [course, papers] of Object.entries(HSC_PAST_PAPERS)) {
  for (const p of papers) ok(p.records.reduce((s, r) => s + r.marks, 0) === HSC_PAPER_MARKS[course], `${course} ${p.year} adds to ${HSC_PAPER_MARKS[course]}`);
}
for (const s of Object.values(HSC_SAMPLE)) ok(s.records.reduce((a, r) => a + r.marks, 0) === HSC_PAPER_MARKS[s.course], `${s.course} sample adds to its total`);
for (const r of HSC_RECORDS) {
  const src = HSC_SOURCES[r.source];
  ok(src && /^[0-9a-f]{64}$/.test(src.sha256) && /^https:\/\/(www\.nsw\.gov\.au|library\.curriculum\.nsw\.edu\.au)\//.test(src.url) && src.retrieved === '2026-11-18', `${r.id} cites a pinned NESA document`);
  if (r.kind === 'past-paper') ok(HSC_SOURCES[r.paper]?.kind === 'exam-paper', `${r.id} names its NESA paper`);
}
const base = HSC_RECORDS.find(r => r.kind === 'past-paper');
const raw = { id: base.id, kind: base.kind, course: base.course, year: base.year, part: base.part, marks: base.marks, codes: [...base.codes], response: base.response, source: base.source, paper: base.paper };
ok(!!validateHscRecord(raw), 'a well-formed record validates');
throws(() => validateHscRecord({ ...raw, source: 'somewhere' }), /not a document/, 'an unregistered source is refused');
throws(() => validateHscRecord({ ...raw, codes: ['ME-V1'] }), /belongs to extension1|not a/, 'another course\'s code is refused');
throws(() => validateHscRecord({ ...raw, codes: ['MA-Z9'] }), /not a 2017 topic/, 'an unknown code is refused');
throws(() => validateHscRecord({ ...raw, part: '11a', response: 'mcq' }), /Section I/, 'a Section II multiple choice is refused');
throws(() => validateHscRecord({ ...raw, marks: 0 }), /marks/, 'zero marks is refused');

// ── 2. Rights ───────────────────────────────────────────────────────────────
ok(Object.values(HSC_SOURCES).every(s => s.reproduction === HSC_REPRODUCTION.NOT_PERMITTED), 'no NESA document is marked as permitting reproduction');
for (const field of HSC_TEXT_FIELDS) throws(() => validateHscRecord({ ...raw, [field]: 'Find the value of x.' }), /does not permit reproduction/, `NESA text in "${field}" is refused`);
ok(HSC_RECORDS.every(r => HSC_TEXT_FIELDS.every(f => r[f] === undefined)), 'no record carries a text field');
for (const f of ['records-advanced.js', 'records-extension1.js', 'sample-2024.js']) {
  const body = read(`client/src/engine/hsc/${f}`).split('\n').filter(l => /^\s*\['/.test(l));
  ok(body.length > 30 && body.every(l => /^\s*\['\d+[a-h]?[ivx]*', \d, '[A-Z0-9 -]+', '[a-z]+'(, "NESA prints [^"]{0,80}")?\],$/.test(l)), `${f} rows are metadata only`);
}
ok(!/GPL|hsc-paper-tagger|examrag/i.test(read('tools/hsc/extract-mapping-grids.py').replace('Ideas only from public HSC-paper tooling: no third-party code is used here.', '')), 'the extractor carries no third-party code reference');
ok(/Crown copyright/.test(read('docs/content/hsc-priorities-rights.md')) && /legal review/i.test(read('docs/content/hsc-priorities-rights.md')), 'the rights position is written down and flagged for legal review');

// ── 3. The map and the 2024 outcomes agree with the curriculum model ───────
const model = { advanced: NSW.NSW_MATHEMATICS_ADVANCED_2024, extension1: NSW.NSW_MATHEMATICS_EXTENSION1_2024 };
for (const o of HSC_OUTCOMES_2024) {
  const rec = NSW.NSW_OUTCOME_BY_CODE[o.code];
  ok(rec && rec.syllabus === model[o.course].id && rec.focusArea === o.focusArea && rec.year === o.year, `${o.code} matches the model (focus area, Year)`);
  const fa = model[o.course].focusAreas.find(f => f.outcomes.includes(o.code));
  const groups = Math.max(1, fa.contentGroups.length);
  const share = fa.outcomes.length === 1 ? groups : null;
  if (share !== null) ok(o.groups === share, `${o.code} content groups (${o.groups}) = the model's ${share}`);
  ok(o.newGroups.every(g => fa.contentGroups.includes(g)), `${o.code} new groups are content groups of its focus area`);
}
for (const course of ['advanced', 'extension1']) {
  const pairs = model[course].focusAreas.filter(f => f.outcomes.length > 1);
  for (const fa of pairs) ok(fa.outcomes.reduce((s, c) => s + HSC_OUTCOMES_2024.find(o => o.code === c).groups, 0) === Math.max(fa.outcomes.length, fa.contentGroups.length), `${fa.name}: its outcomes share its content groups`);
  const codes = model[course].focusAreas.flatMap(f => f.outcomes);
  ok(codes.every(c => HSC_OUTCOMES_2024.some(o => o.code === c)), `every ${course} 2024 outcome is in the engine`);
}
const topics2017 = { advanced: NSW.NSW_MATHEMATICS_ADVANCED_2017, extension1: NSW.NSW_MATHEMATICS_EXTENSION1_2017 };
for (const t of HSC_TOPIC_MAP) {
  ok(topics2017[t.course].topics.some(x => x.code === t.code), `${t.code} is a 2017 topic`);
  ok(Math.abs(t.to.reduce((s, x) => s + x.share, 0) - 1) < 1e-9, `${t.code} shares sum to 1`);
  ok(t.to.every(x => x.outcome === null || HSC_OUTCOMES_2024.find(o => o.code === x.outcome)?.course === t.course), `${t.code} maps within its course`);
}
const derived = {};
for (const r of NSW.LEGACY_CROSSWALK) for (const c of new Set(r.dotpoints.flat())) if (/^(MAV|ME1)-/.test(c)) (derived[c] ||= []).push(r.subtopicId);
for (const o of HSC_OUTCOMES_2024) ok(JSON.stringify(HSC_PRACTICE_LINKS[o.code]) === JSON.stringify(derived[o.code] || []), `${o.code} practice links = the crosswalk's`);

// ── 4. Determinism and the backtest ─────────────────────────────────────────
const adv = P.hscPriorities('advanced'), ext = P.hscPriorities('extension1');
ok(adv.priorities.map(p => p.code).join() === 'MAV-12-06,MAV-12-05,MAV-12-07,MAV-11-02,MAV-12-03,MAV-12-08,MAV-11-04,MAV-12-04,MAV-11-09,MAV-12-02,MAV-12-01,MAV-11-06,MAV-11-10,MAV-11-03,MAV-11-01,MAV-11-05,MAV-11-07,MAV-11-08', 'the Advanced ranking is pinned');
ok(ext.priorities.map(p => p.code).join() === 'ME1-12-05,ME1-12-02,ME1-12-04,ME1-12-06,ME1-11-01,ME1-11-03,ME1-11-02,ME1-12-03,ME1-12-01,ME1-11-04,ME1-11-05', 'the Extension 1 ranking is pinned');
for (const r of [adv, ext]) {
  const sum = r.priorities.reduce((s, p) => s + p.expected, 0);
  ok(Math.abs(sum - 1) < 1e-3, `${r.course} expected shares sum to 1 (${sum})`);
  ok(r.priorities.every(p => p.band[0] <= p.expected && p.expected <= p.band[1] && p.marks[0] <= p.marks[1]), `${r.course} every band contains its estimate`);
  ok(r.priorities.every(p => p.reasons.length >= 2), `${r.course} every outcome has its reasons`);
}
const again = JSON.stringify(P.backtest('advanced')) + JSON.stringify(P.backtest('extension1'));
ok(again === JSON.stringify(P.backtest('advanced')) + JSON.stringify(P.backtest('extension1')), 'the backtest is reproducible');
const btA = P.backtest('advanced'), btE = P.backtest('extension1');
ok(btA.years.join() === '2021,2022,2023,2024,2025' && btE.years.join() === '2021,2022,2023,2024,2025,2026', 'test years fit only on earlier years');
ok(P.selectHistoryMethod(btA).method === 'decayed' && P.selectHistoryMethod(btE).method === 'decayed', 'the decayed mean beat both baselines on mean TVD in both courses');
// A model that does not beat the baselines must fall back to the better baseline.
ok(P.selectHistoryMethod({ mean: { decayed: { tvd: 0.3 }, last: { tvd: 0.2 }, uniform: { tvd: 0.25 } } }).method === 'last', 'a losing model falls back to the better baseline');
ok(P.HSC_PREREGISTERED.decay === 0.7 && P.HSC_PREREGISTERED.primaryMetric === 'tvd', 'the pre-registered settings are unchanged');
ok(P.topicWeights('advanced')['MAV-12-06'] === adv.priorities[0].expected && /Not a prediction/.test(P.forecastMeta('extension1').disclaimer), 'topicWeights and forecastMeta expose the ranking with its disclaimer');
for (const course of ['advanced', 'extension1']) {
  const ranges = P.topicWeightRanges(course), weights = P.topicWeights(course), meta = P.forecastMeta(course);
  ok(Object.keys(ranges).join() === Object.keys(weights).join(), `${course} ranges cover exactly the weighted outcomes`);
  ok(Object.entries(ranges).every(([c, r]) => r.mid === weights[c] && r.low === meta.bands[c][0] && r.high === meta.bands[c][1]), `${course} ranges agree with topicWeights (mid) and forecastMeta.bands (low, high)`);
  ok(Object.values(ranges).every(r => r.low >= 0 && r.low <= r.mid && r.mid <= r.high && r.high <= 1 && r.high > r.low), `${course} every range is a real range around its mid`);
  ok(Object.isFrozen(ranges) && Object.values(ranges).every(Object.isFrozen), `${course} ranges are frozen`);
}
try { execFileSync(process.execPath, [join(repo, 'tools', 'hsc-backtest.mjs'), '--check'], { stdio: 'pipe' }); ok(true, 'evidence doc'); }
catch (e) { ok(false, `docs/evidence/hsc-forecast-backtest-2026-11-18.md matches the engine: ${String(e.stderr)}`); }

// ── 5. Edition isolation and the student join ───────────────────────────────
ok(hscCoursesFor({ course: 'in', year: 12, pathway: 'ext1' }).length === 0, 'a Priyabhata (India) profile gets nothing');
ok(hscCoursesFor({ course: 'nsw', year: 10 }).length === 0 && hscCoursesFor({ course: 'nsw', year: 12, pathway: 'standard' }).length === 0, 'Years 7–10 and Standard get nothing');
ok(hscCoursesFor({ course: 'nsw', year: 12, pathway: 'ext1' }).join() === 'advanced,extension1' && hscCoursesFor({ course: 'nsw', year: 11, pathway: 'ext2' }).join() === 'extension1', 'Extension 1 sits both papers; Extension 2 sits Extension 1');
const walk = (dir, out = []) => { for (const n of readdirSync(dir)) { const p = join(dir, n); if (statSync(p).isDirectory()) walk(p, out); else if (/\.(m?js|jsx)$/.test(n)) out.push(p); } return out; };
const importers = walk(join(root, 'src')).filter(f => !f.includes(`${join('src', 'engine', 'hsc')}`) && /(from\s+|import\()'[^']*(engine\/hsc\/|hsc\/HscPriorities)/.test(readFileSync(f, 'utf8')));
ok(importers.map(f => f.slice(root.length)).sort().join() === 'src/hsc/HscPriorities.jsx,src/local/backend.js,src/pages/ProgressAustralia.jsx', `only the Prithagoras surfaces reach the engine (${importers.map(f => f.slice(root.length)).join(', ')})`);
ok(!/hsc/i.test(read('client/src/pages/IndiaProgress.jsx')) && !/hscPriorities/.test(read('client/src/local/indiaExamBackend.js')), 'no India surface mentions it');
ok(/\[\/\(\^\|\\\/\)\(hsc-priorities\|HscPriorities\)/.test(read('client/vite.config.js')), 'the chunk is on demand, not in any install');
const rows = { 'y12-appdiff': { name: 'Applications', requestable: [1, 2], evidence: { attempts: 10, correct: 9, independentCorrect: 9 } }, 'y12-integration': { name: 'Integration', requestable: [1], evidence: { attempts: 6, correct: 6, independentCorrect: 2 } } };
const joined = hscPractiseNext(adv.priorities, rows);
const a6 = joined.find(r => r.code === 'MAV-12-06'), a5 = joined.find(r => r.code === 'MAV-12-05'), a3 = joined.find(r => r.code === 'MAV-11-03');
ok(a6.status === 'secure' && a5.status === 'working' && a3.status === 'no-practice' && a3.need === 0, 'evidence: secure, working, no practice');
ok(a5.evidence.independent === 2 && a5.need > a6.need, 'help-free answers drive the need, not right answers');
const w = hscPaperWeights('advanced', ['y12-appdiff', 'y12-integration', 'y12-series', 'y11-explog']);
ok(Math.abs(Object.values(w).reduce((s, v) => s + v, 0) - 1) < 1e-9 && Object.keys(w).every(k => ['y12-appdiff', 'y12-integration', 'y12-series', 'y11-explog'].includes(k)), 'paper weights stay inside the scope and sum to 1');
const be = read('client/src/local/backend.js');
ok(/hscCoursesFor\(\{ \.\.\.p, course: p\.course \|\| 'nsw', year, pathway: examPw \}\)\.includes\(hsc\)/.test(be) && /import\('\.\.\/engine\/hsc\/hscPractice\.js'\)/.test(be), 'the weighted paper is refused outside Year 12 Advanced / Extension 1 and loads the engine on demand');

// ── 6. Copy ─────────────────────────────────────────────────────────────────
const { default: en } = await import('../src/i18n/strings.en.js');
const { default: hi } = await import('../src/i18n/strings.hi.js');
const keys = Object.keys(en).filter(k => k.startsWith('hsc.') || k === 'progressAu.tabHsc');
ok(keys.length >= 45, `${keys.length} strings`);
ok(keys.every(k => hi[k] !== undefined && JSON.stringify(hi[k]) !== JSON.stringify(en[k])), 'every string has its own Hindi');
const text = keys.map(k => JSON.stringify(en[k])).join(' ');
ok(!/\b\w{2,}iz(e|es|ed|ing|ation)\b/i.test(text.replace(/\bsize\b/g, '')) && !/\b(color|center|program)\b/i.test(text), 'en-AU spelling (no -ize, color, center)');
ok(!/\bpractice (it|this|again|more|next)\b/i.test(text) && /Practise next/.test(text), 'practise is the verb, practice the noun');
ok(en['hsc.whatThisIs'] === "Based on the new syllabus, NESA's sample materials and past papers. Not a prediction of the actual questions.", 'the required sentence, word for word');
ok(!/predicted (mark|band|score)|you (will|would) (get|score)|expected (mark|band|ATAR)/i.test(text.replace('It is not a predicted mark, band or ATAR', '')), 'no predicted mark, band or ATAR is offered');

// ── 7. Render ───────────────────────────────────────────────────────────────
const { createServer } = await import('vite');
const react = (await import('@vitejs/plugin-react')).default;
const React = (await import('react')).default;
const { renderToStaticMarkup } = await import('react-dom/server');
const server = await createServer({
  root, configFile: false, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true },
  plugins: [react()], define: { __PRI_FEATURE_TUTOR__: 'false', __PRI_PRODUCTION_BUILD__: 'false' },
  // One React and one router for the view and the test (also when node_modules is a link).
  ssr: { external: ['react', 'react-dom', 'react-router', 'react-router-dom'] }
});
const quiet = console.error;
console.error = (...a) => { if (!/useLayoutEffect does nothing on the server/.test(String(a[0]))) quiet(...a); };
try {
  const { MemoryRouter } = await import('react-router-dom');
  const view = await server.ssrLoadModule('/src/hsc/HscPriorities.jsx');
  const curriculum = { years: [{ subtopics: Object.entries(rows).map(([id, r]) => ({ id, ...r })) }], streams: [] };
  const html = (user, courses) => renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(view.default, { user, courses, curriculum })));
  const a = html({ course: 'nsw', year: 12, pathway: 'advanced' }, ['advanced']);
  ok(a.includes('data-hsc-priorities="advanced"') && a.includes('HSC 2027 priorities') && a.includes('Not a prediction of the actual questions'), 'Advanced renders with the disclaimer');
  ok((a.match(/data-hsc-outcome=/g) || []).length === 18 && a.includes('data-hsc-paper'), 'every Advanced outcome is listed, and Year 12 is offered the weighted paper');
  const r6 = P.topicWeightRanges('advanced')['MAV-12-06'];
  ok(a.includes(`About ${Math.floor(r6.low * 100)}–${Math.ceil(r6.high * 100)} of 100 marks`) && !/\d+(\.\d+)?% of (the )?(paper|marks)/.test(a.replace(/about \d+% of the marks went on this content/g, '')), 'the tab shows marks at stake as ranges from topicWeightRanges, never as a point share');
  ok(!/\{[a-z]+\}/.test(a) && !/hsc\.[a-z]/.test(a), 'no raw placeholder or key reaches the page');
  const e = html({ course: 'nsw', year: 11, pathway: 'ext1' }, ['advanced', 'extension1']);
  ok(e.includes('Mathematics Extension 1') && !e.includes('data-hsc-paper'), 'Extension 1 offers both papers; Year 11 is not offered the Year 12 paper');
} finally { console.error = quiet; await server.close(); }

if (failures.length) {
  console.error(`HSC PRIORITIES · ${failures.length} failed of ${pass + failures.length}`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`HSC PRIORITIES · ${pass}/${pass} checks passed`);
