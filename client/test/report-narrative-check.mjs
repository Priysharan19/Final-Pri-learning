// Audit #11: the report narrates its trend, scopes "Where marks were lost" to
// the window on screen, and links each lost chapter to practice.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { trendSentence, worstDotpoint } from '../src/instrument/reportNarrative.js';

const en = (await import('../src/i18n/strings.en.js')).default;
const t = (k, v = {}) => String(en[k] ?? k).replace(/\{(\w+)\}/g, (_, x) => v[x] ?? '');
let passed = 0; const failures = [];
const check = (name, fn) => { try { fn(); passed++; } catch (e) { failures.push(name + ': ' + e.message); } };
const src = readFileSync(new URL('../src/instrument/ReportHead.jsx', import.meta.url), 'utf8');

check('trend names both sides and the window', () =>
  assert.equal(trendSentence({ delta: { methodPct: 9.2, accuracyPct: -4 } }, 'week', t),
    'Method up 9 points, final answers down 4 on last week. The method is holding, so the marks are going at the last line.'));
check('a change under a point reads as level, no last-line claim', () =>
  assert.equal(trendSentence({ delta: { methodPct: 0.4, accuracyPct: -0.3 } }, 'month', t), 'Method level, final answers level on the month before.'));
check('no trend when either window is under the floor', () => {
  assert.equal(trendSentence({ delta: { methodPct: null, accuracyPct: 3 } }, 'week', t), null);
  assert.equal(trendSentence(null, 'week', t), null);
});
check('a falling method never gets the last-line sentence', () =>
  assert.doesNotMatch(trendSentence({ delta: { methodPct: -5, accuracyPct: -6 } }, 'term', t), /last line/));
check('worst dot point: Indian index keys only, most lost wins', () => {
  const c = { dotpoints: { 0: { earned: 3, possible: 4 }, 2: { earned: 0, possible: 4 }, x: { earned: 0, possible: 9 } } };
  assert.equal(worstDotpoint(c, { course: 'in' }), 2);
  assert.equal(worstDotpoint(c, { course: 'nsw' }), null);
  assert.equal(worstDotpoint({ dotpoints: { 1: { earned: 2, possible: 2 } } }, { course: 'in' }), null);
});
check('lost marks are read with since = the period start, never all-time', () => {
  assert.match(src, /\/marks\/by-chapter\?since=\$\{encodeURIComponent\(periodFrom\)\}/);
  assert.doesNotMatch(src, /api\.get\('\/marks\/by-chapter'\)/);
});
check('each lost chapter links to practice', () => assert.match(src, /<PageLink to=\{c\.href\} data-report-lost-link/));
check('period-scoped copy, English and Hindi', () => {
  const hi = readFileSync(new URL('../src/i18n/strings.hi.js', import.meta.url), 'utf8');
  for (const k of ['inst.ledeChapterPeriod', 'inst.reportLostNonePeriod', 'inst.trend', 'inst.trendLastLine', 'inst.trendSinceTerm'])
    { assert.ok(en[k], k); assert.ok(hi.includes(`"${k}"`), 'hi ' + k); }
  assert.match(src, /inst\.ledeChapterPeriod/);
});

console.log(`REPORT NARRATIVE: ${failures.length ? 'FAIL' : 'PASS'} — ${passed}/${passed + failures.length} checks`);
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
