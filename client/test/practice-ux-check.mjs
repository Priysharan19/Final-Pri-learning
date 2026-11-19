// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Practice UX: recent attempts, first-run tour, report polish
//
// Static and unit checks (no browser): the three features exist where they
// should, reuse the existing data source and retry path, stay out of the way of
// the question, speak in both languages and keep their promises honest.
// ─────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = rel => readFileSync(new URL(rel, import.meta.url), 'utf8');
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };

const en = read('../src/i18n/strings.en.js');
const hi = read('../src/i18n/strings.hi.js');
const keyIn = (src, k) => new RegExp(`['"]${k.replace(/\./g, '\\.')}['"]\\s*:`).test(src);
const valueOf = (src, k) => (src.match(new RegExp(`['"]${k.replace(/\./g, '\\.')}['"]\\s*:\\s*'((?:[^'\\\\]|\\\\.)*)'`)) || [])[1] || '';

// ── 1. Recent attempts ─────────────────────────────────────────────────────
const recent = read('../src/components/RecentAttempts.jsx');
const base = read('../src/pages/PracticeBase.jsx');
const history = read('../src/pages/History.jsx');
const retry = read('../src/pages/historyRetry.js');
ok(/api\.post\('\/history\/list', \{[^}]*subtopic[^}]*pageSize: RECENT_COUNT/.test(recent), 'the list is the History list, filtered to the topic');
ok(/RECENT_COUNT = 5/.test(recent), 'the last five attempts');
ok(/user\?\.cloudLinked/.test(recent) && /return null/.test(recent), 'nothing renders for a signed-out or local profile');
ok(/api\.post\(`\/history\/\$\{id\}\/retry`/.test(retry) && /retryServe\(id, variant, t\)/.test(history) && /retryServe\(id, variant, t\)/.test(recent), 'History and the list share one retry path');
ok(/\/history\?subtopic=.*&open=/.test(recent) && /params\.get\('open'\)/.test(history) && /params\.get\('subtopic'\)/.test(history), 'Open leads to the attempt in History');
ok(/aria-expanded=\{open\}/.test(recent) && /aria-controls=\{panelId\}/.test(recent) && /hidden=\{!open\}/.test(recent), 'a collapsible, closed until asked for');
ok(/data-recent-empty/.test(recent) && keyIn(en, 'recent.empty') && !/—|–/.test(valueOf(en, 'recent.empty')), 'one plain empty sentence');
ok(/MarkStrip/.test(recent) && /app\.correct/.test(recent) && /app\.incorrect/.test(recent) && /history\.notMarked/.test(recent), 'results are worded as History words them');
ok(/<RecentAttempts subtopic=\{serve\.question\.subtopic\} onServe=\{setServe\}/.test(base), 'mounted under the question, serving through the page');
ok(base.indexOf('<RecentAttempts') > base.indexOf('<PriExplain'), 'after the question and its explain launcher, so neither moves');
ok(!/position:\s*(fixed|sticky)/.test((read('../src/workspace.css').match(/\.q-recent[^{]*\{[^}]*\}/g) || []).join('')), 'the list is in the page flow and cannot cover the Submit bar');
ok(!/server\.|app\.(get|post)/.test(recent), 'no new server route');

// ── 2. The first-run tour ──────────────────────────────────────────────────
const store = new Map();
const storage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
const { TOUR_STEPS, tourSeen, markTourSeen, resetTour } = await import('../src/lib/firstRunTour.js');
eq(TOUR_STEPS.map(s => s.id), ['topic', 'answer', 'marked', 'history'], 'four steps, in order');
ok(!tourSeen('p1', storage), 'a new profile has not seen it');
markTourSeen('p1', storage);
ok(tourSeen('p1', storage) && !tourSeen('p2', storage), 'seen is kept per profile');
resetTour('p1', storage);
ok(!tourSeen('p1', storage), '"Show the tour again" clears it');
ok(tourSeen('p1', { getItem() { throw new Error('blocked'); } }), 'unreadable storage never nags');
const tour = read('../src/components/PracticeTour.jsx');
const card = read('../src/components/QuestionCard.jsx');
for (const s of TOUR_STEPS) {
  ok(keyIn(en, s.key) && keyIn(hi, s.key), `${s.id} has copy in both languages`);
  const attr = s.anchor.match(/data-tour="(\w+)"/)[1];
  ok(base.includes(`data-tour="${attr}"`) || card.includes(`data-tour="${attr}"`) || recent.includes(`data-tour="${attr}"`), `${s.id} points at a real control`);
}
ok(/Escape/.test(tour) && /data-tour-skip/.test(tour), 'Escape and Skip close it');
ok(/noteRef\.current\?\.focus/.test(tour) && /back\?\.focus/.test(tour), 'focus moves to the note and returns to the control');
ok(!/aria-modal|role="dialog"/.test(tour), 'not a modal');
const css = read('../src/workspace.css');
const noteCss = (css.match(/\.pr-tour \{[^}]*\}/) || [''])[0];
ok(/pointer-events:\s*none/.test(noteCss) && /\.pr-tour-actions \.btn \{ pointer-events: auto/.test(css), 'the note lets pointer events through except on its own buttons');
ok(!/background:[^;]*(rgba|gradient)|backdrop|blur|box-shadow|animation|transition/.test(noteCss), 'no scrim, glass, shadow or motion');
ok(/React\.lazy\(\(\) => import\('\.\.\/components\/PracticeTour\.jsx'\)\)/.test(base), 'loaded on demand');
ok(/user\?\.cloudLinked === true/.test(base) && /tourSeen\(user\.id\)/.test(base) && /markTourSeen\(user\.id\)/.test(base), 'signed-in accounts only, once, recorded on close');
ok(/!assignmentMode/.test(base.slice(base.indexOf('tourReady'), base.indexOf('tourReady') + 120)), 'not during an assignment');
const settings = read('../src/pages/SettingsLegacy.jsx');
ok(settings.indexOf('data-tour-restart') > settings.indexOf('ref={el => secRefs.current.help = el}'), 'the restart sits in the Help section');
ok(/resetTour\(user\.id\); goTo\('\/practice'\)/.test(settings) && keyIn(en, 'tour.restart') && keyIn(hi, 'tour.restart'), '"Show the tour again" resets and opens Practice');
const marked = valueOf(en, 'tour.marked');
ok(/marks the lines it can check and says so when it cannot/.test(marked), 'the marking note says what Pri can and cannot do');
ok(!/every line|predict|guarantee|all lines/i.test(Object.keys({}).concat(['tour.topic', 'tour.answer', 'tour.marked', 'tour.history']).map(k => valueOf(en, k)).join(' ')), 'no promise that every line is marked or that marks are predicted');

// ── 3. Report form polish ──────────────────────────────────────────────────
const { reportFailureKey } = await import('../src/components/reportFailure.js');
eq(reportFailureKey({ status: 429, code: 'RATE_LIMITED' }), 'report.failedRate', 'rate limit');
eq(reportFailureKey({ status: 413, code: 'REPORT_CONTEXT_TOO_LARGE' }), 'report.failedTooLong', 'too long');
eq(reportFailureKey({ status: 400, code: 'REPORT_CATEGORY_INVALID' }), 'report.failedReason', 'reason refused');
eq(reportFailureKey({ status: 401, code: 'AUTH_REQUIRED' }), 'report.failedSignIn', 'signed out');
eq(reportFailureKey({ code: 'CLOUD_DISABLED' }), 'report.failedOffline', 'no server');
eq(reportFailureKey(new TypeError('Failed to fetch')), 'report.failedOffline', 'no reply');
eq(reportFailureKey({ status: 500, code: 'X' }, false), 'report.failedOffline', 'device offline');
eq(reportFailureKey({ status: 500, code: 'INTERNAL' }), 'report.failed', 'anything else keeps the general sentence');
const server = read('../../server/platform/reports.js');
for (const code of ['REPORT_CATEGORY_INVALID', 'REPORT_CONTEXT_TOO_LARGE']) ok(server.includes(code) && read('../src/components/reportFailure.js').includes(code), `${code} is a code the server returns and the form names`);
ok(/limit: 30/.test(server) && read('../src/components/reportFailure.js').includes('RATE_LIMITED'), 'the rate limit is the server\'s');
for (const k of ['report.failed', 'report.failedRate', 'report.failedTooLong', 'report.failedReason', 'report.failedSignIn', 'report.failedOffline']) ok(keyIn(en, k) && keyIn(hi, k), `${k} in both languages`);
const rep = read('../src/components/QuestionReport.jsx');
ok(/querySelector\('input\[type="radio"\]'\)\?\.focus\(\)/.test(rep), 'focus moves to the first field on open');
ok(/opener\.focus/.test(rep) && /data-report-question/.test(rep), 'focus returns to the opening button on close');
ok(/role="alert"/.test(rep) && /data-report-failure=\{failKey\}/.test(rep) && /reportFailureKey\(error/.test(rep), 'the specific reason is announced');
ok(/toast\(t\('report\.thanks'\)/.test(card), 'success goes through the app\'s live-region toast');

// ── All new copy ───────────────────────────────────────────────────────────
const fresh = ['recent.title', 'recent.empty', 'recent.failed', 'recent.open', 'recent.tryAgain', 'tour.label', 'tour.stepOf', 'tour.skip', 'tour.next', 'tour.done', 'tour.restart', 'tour.topic', 'tour.answer', 'tour.marked', 'tour.history', 'report.failedRate', 'report.failedTooLong', 'report.failedReason', 'report.failedSignIn', 'report.failedOffline'];
for (const k of fresh) {
  ok(keyIn(en, k) && keyIn(hi, k), `${k} in both catalogues`);
  const v = valueOf(en, k);
  ok(!/—|–|unlock|supercharge|seamless|[\u{1F300}-\u{1FAFF}]/u.test(v), `${k}: no em dash, buzzword or emoji`);
}
console.log(`PRACTICE UX: PASS — ${n} checks — recent attempts, first-run tour and report form`);
