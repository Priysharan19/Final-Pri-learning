// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · India identity suite — the app opens as an Indian product.
//
// Three things are asserted here, all in bare Node against the real code:
//
//   · lib/locale.js — where a profile's day ends and how it reads dates,
//     numbers and money: Asia/Kolkata and en-IN with the rupee sign for an
//     Indian profile, Australia/Sydney and en-AU for the legacy ones.
//   · the local backend — a new profile gets its course's timezone unless it
//     named a real one; streaks, activity days and the time-of-day badges are
//     judged in that timezone, not in Sydney for everyone.
//   · the demo — the account-less "Try the demo" seeds an Indian Class 10
//     CBSE / NCERT student with NCERT chapter evidence and no invented board
//     mark; the NSW demo is still there when asked for by course.
//
// Every backend check drives a real route through dispatch() on the same
// in-memory IndexedDB the backend suite uses. Instants are fixed, so a check
// that passes at midnight in Kolkata passes at noon in Sydney.
//
// Usage: node client/test/india-identity-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { installBrowserEnv, resetStorage } from './backend-check.mjs';

const SRC = new URL('../src/', import.meta.url).href;
const CLIENT = fileURLToPath(new URL('../', import.meta.url));

// ── Assertions ───────────────────────────────────────────────────────────────

const groups = [];
let group = null;
const failures = [];

const section = (name) => { group = { name, pass: 0, fail: 0 }; groups.push(group); };

function ok(name, condition, detail = '') {
  if (condition) { group.pass++; return true; }
  group.fail++;
  failures.push(`${group.name} · ${name}${detail ? `\n      ${detail}` : ''}`);
  return false;
}

const show = v => (typeof v === 'string' ? JSON.stringify(v) : JSON.stringify(v) ?? String(v));
const eq = (name, actual, expected) =>
  ok(name, JSON.stringify(actual) === JSON.stringify(expected), `expected ${show(expected)}, got ${show(actual)}`);
const crashed = err => ok('the group ran to the end', false, `threw: ${err?.stack || err}`);

// ── Fixed instants ───────────────────────────────────────────────────────────
// IST is UTC+5:30 all year; Sydney is UTC+10 in September (no daylight saving
// until October), UTC+11 in March.

const T_LATE_IST = Date.UTC(2026, 8, 5, 18, 0);     // Sat 5 Sep 23:30 IST · Sun 6 Sep 04:00 AEST
const T_MIDNIGHT_IST = Date.UTC(2026, 8, 5, 18, 30); // Sun 6 Sep 00:00 IST · Sun 6 Sep 04:30 AEST
const T_MARCH = Date.UTC(2026, 2, 1, 18, 0);        // Sun 1 Mar 23:30 IST · Mon 2 Mar 05:00 AEDT

async function run() {
  // ── locale ─────────────────────────────────────────────────────────────────
  section('locale');
  try {
    const L = await import(`${SRC}lib/locale.js`);
    eq('an Indian profile lives in Asia/Kolkata', L.timezoneOf({ course: 'in' }), 'Asia/Kolkata');
    eq('an NSW profile lives in Australia/Sydney', L.timezoneOf({ course: 'nsw' }), 'Australia/Sydney');
    eq('a bare course id resolves the same way', L.timezoneOf('in'), 'Asia/Kolkata');
    eq('a profile that named a real timezone keeps it', L.timezoneOf({ course: 'in', timezone: 'Asia/Dubai' }), 'Asia/Dubai');
    eq('a made-up timezone falls back to the course default', L.timezoneOf({ course: 'in', timezone: 'Mars/Olympus' }), 'Asia/Kolkata');
    eq('a timezone with junk in it is refused outright', L.cleanTimezone('Asia/Kolkata; DROP TABLE'), null);
    eq('no course at all is the legacy default', L.defaultTimezone(undefined), 'Australia/Sydney');
    eq('India reads en-IN', L.localeOf({ course: 'in' }), 'en-IN');
    eq('Australia reads en-AU', L.localeOf({ course: 'nsw' }), 'en-AU');
    eq('India pays in rupees', L.currencyOf('in'), 'INR');

    eq('23:30 in Kolkata is still 5 September', L.dayKey(T_LATE_IST, 'Asia/Kolkata'), '2026-09-05');
    eq('the same instant is already 6 September in Sydney', L.dayKey(T_LATE_IST, 'Australia/Sydney'), '2026-09-06');
    eq('the hour is read in Kolkata', L.hourIn(T_LATE_IST, 'Asia/Kolkata'), 23);
    eq('and in Sydney', L.hourIn(T_LATE_IST, 'Australia/Sydney'), 4);
    eq('midnight in Kolkata is hour 0, not 24', L.hourIn(T_MIDNIGHT_IST, 'Asia/Kolkata'), 0);

    eq('en-IN groups in lakhs', L.formatNumber(1234567, 'in'), '12,34,567');
    eq('en-AU groups in thousands', L.formatNumber(1234567, 'nsw'), '1,234,567');
    eq('a whole rupee amount carries the sign and no paise', L.formatCurrency(499, 'in'), '₹499');
    eq('paise are shown when there are any', L.formatCurrency(499.5, 'in'), '₹499.50');
    eq('an Australian profile is billed in dollars and cents', L.formatCurrency(499, 'nsw'), '$499.00');
    eq('a date is written in the profile’s own day', L.formatDate(T_MARCH, 'in'), '1 Mar');
    eq('the same instant is the next day for an Australian profile', L.formatDate(T_MARCH, 'nsw'), '2 Mar');
    eq('a nonsense value formats to nothing rather than "Invalid Date"', L.formatDate('never', 'in'), '');
    eq('a nonsense number formats to a dash', L.formatNumber('lots', 'in'), '—');
  } catch (err) { crashed(err); }

  // ── the backend ────────────────────────────────────────────────────────────
  installBrowserEnv();
  const { dispatch } = await import(`${SRC}local/backend.js`);
  const store = await import(`${SRC}local/store.js`);
  const { checkBadges } = await import(`${SRC}local/badges.js`);
  const { loadAllBanks } = await import(`${SRC}engine/generators/index.js`);
  await loadAllBanks();
  const GET = (path) => dispatch('GET', path, undefined);
  const POST = (path, body) => dispatch('POST', path, body);
  const PATCH = (path, body) => dispatch('PATCH', path, body);

  section('profile timezone defaults');
  try {
    resetStorage();
    const asha = (await POST('/profiles', { name: 'Asha Iyer', year: 10, course: 'in', indiaTrack: 'cbse' })).user;
    eq('an India profile defaults to Asia/Kolkata', asha.timezone, 'Asia/Kolkata');
    eq('and reads en-IN', asha.locale, 'en-IN');
    eq('and is labelled by class, not year', asha.courseLabel, 'Class 10 · CBSE / NCERT');
    const grace = (await POST('/profiles', { name: 'Grace Hopper', year: 11, course: 'nsw', pathway: 'ext1' })).user;
    eq('an NSW profile defaults to Australia/Sydney', grace.timezone, 'Australia/Sydney');
    eq('and reads en-AU', grace.locale, 'en-AU');
    const dev = (await POST('/profiles', { name: 'Dev Sharma', year: 12, course: 'in', indiaTrack: 'jee-main', timezone: 'Asia/Dubai' })).user;
    eq('a profile that names a real timezone keeps it', dev.timezone, 'Asia/Dubai');
    eq('and is still an Indian JEE student', dev.courseLabel, 'Classes 11–12 · JEE Main');
    const bo = (await POST('/profiles', { name: 'Bo', year: 9, course: 'in', timezone: 'Nowhere/Land' })).user;
    eq('a bogus timezone is replaced by the course default', bo.timezone, 'Asia/Kolkata');
    const legacy = (await POST('/profiles', { name: 'Legacy', year: 9 })).user;
    eq('a body with no course is still the legacy NSW profile', legacy.timezone, 'Australia/Sydney');

    const picker = (await GET('/profiles')).profiles;
    eq('the picker is told which profiles are Indian', picker.find(p => p.id === asha.id)?.course, 'in');
    eq('and which are Australian', picker.find(p => p.id === grace.id)?.course, 'nsw');

    await POST('/profiles/select', { id: asha.id });
    let me = (await PATCH('/me', { timezone: 'Europe/London' })).user;
    eq('PATCH /me can move a profile to another timezone', me.timezone, 'Europe/London');
    me = (await PATCH('/me', { course: 'nsw' })).user;
    eq('a profile that chose its own timezone keeps it across a course change', me.timezone, 'Europe/London');
    me = (await PATCH('/me', { timezone: 'Not/AZone' })).user;
    eq('a bogus timezone on PATCH falls back to the course default', me.timezone, 'Australia/Sydney');
    me = (await PATCH('/me', { course: 'in', indiaTrack: 'cbse' })).user;
    eq('a profile on its course default follows the course to India', me.timezone, 'Asia/Kolkata');
    eq('and becomes a class again', me.courseLabel, 'Class 10 · CBSE / NCERT');

    await POST('/profiles/select', { id: grace.id });
    me = (await PATCH('/me', { course: 'in' })).user;
    eq('an NSW profile moving to India moves its day boundary too', me.timezone, 'Asia/Kolkata');

    await POST('/profiles/select', { id: dev.id });
    const backup = await GET('/data/export');
    eq('a backup carries the timezone', backup.profile?.timezone, 'Asia/Dubai');
    const restored = (await POST('/data/import', structuredClone(backup))).user;
    eq('and a restore keeps it', restored.timezone, 'Asia/Dubai');
    backup.profile.timezone = 'Evil/Zone';
    const cleaned = (await POST('/data/import', structuredClone(backup))).user;
    eq('a tampered timezone in a backup is replaced, not stored', cleaned.timezone, 'Asia/Kolkata');
  } catch (err) { crashed(err); }

  section('streak day boundary in Asia/Kolkata');
  try {
    resetStorage();
    const asha = (await POST('/profiles', { name: 'Asha Iyer', year: 10, course: 'in' })).user;
    const grace = (await POST('/profiles', { name: 'Grace Hopper', year: 10, course: 'nsw' })).user;
    // Friday evening and the small hours of Sunday, Indian time. In Sydney the
    // same two instants fall on Saturday and Sunday.
    const friday = Date.UTC(2026, 8, 4, 14, 30);   // Fri 4 Sep 20:00 IST · Sat 5 Sep 00:30 AEST
    const sunday = Date.UTC(2026, 8, 5, 20, 30);   // Sun 6 Sep 02:00 IST · Sun 6 Sep 06:30 AEST
    const check = Date.UTC(2026, 8, 5, 21, 30);    // Sun 6 Sep 03:00 IST · Sun 6 Sep 07:30 AEST
    for (const pid of [asha.id, grace.id]) {
      await store.bumpActivity(pid, { correct: true, xp: 6, ms: 40000 }, friday);
      await store.bumpActivity(pid, { correct: false, xp: 0, ms: 50000 }, sunday);
    }
    eq('an Indian profile files the days under Indian dates',
      (await store.activityFor(asha.id)).map(d => d.date), ['2026-09-04', '2026-09-06']);
    eq('the same instants are Saturday and Sunday for the Australian profile',
      (await store.activityFor(grace.id)).map(d => d.date), ['2026-09-05', '2026-09-06']);
    eq('Friday and Sunday in Kolkata are not a streak', await store.streakFor(asha.id, check), 1);
    eq('Saturday and Sunday in Sydney are — the boundary is the whole difference', await store.streakFor(grace.id, check), 2);
    eq('a caller may name the zone explicitly', await store.streakFor(asha.id, check, 'Asia/Kolkata'), 1);
    eq('the deprecated Sydney helper still answers for the legacy profiles', store.sydneyDate(friday), '2026-09-05');
    eq('and the profile’s own zone is read off the profile', await store.profileTimezone(asha.id), 'Asia/Kolkata');

    // Day-of-time badges: a question answered at midnight in Kolkata is a
    // night owl's; the same instant is half past four in the morning in Sydney,
    // which is neither owl nor bird.
    const event = { type: 'attempt', difficulty: 2, correct: true, hintsUsed: 0, year: 10, xp: 10 };
    const owl = await checkBadges(asha.id, event, T_MIDNIGHT_IST);
    ok('midnight in Kolkata earns the night-owl badge', owl.some(b => b.id === 'night-owl'), `awarded ${show(owl.map(b => b.id))}`);
    const none = await checkBadges(grace.id, event, T_MIDNIGHT_IST);
    ok('the same instant in Sydney earns neither owl nor bird',
      !none.some(b => b.id === 'night-owl' || b.id === 'early-bird'), `awarded ${show(none.map(b => b.id))}`);
    const bird = await checkBadges(grace.id, event, Date.UTC(2026, 8, 5, 20, 30)); // 06:30 AEST
    ok('half past six in Sydney is an early bird', bird.some(b => b.id === 'early-bird'), `awarded ${show(bird.map(b => b.id))}`);
  } catch (err) { crashed(err); }

  section('the demo is an Indian Class 10 student');
  try {
    resetStorage();
    const demo = (await POST('/profiles/demo', {})).user;
    eq('the demo is flagged as one', demo.isDemo, true);
    eq('the demo is on the India course', demo.course, 'in');
    eq('in Class 10', demo.year, 10);
    eq('on the CBSE / NCERT track', demo.indiaTrack, 'cbse');
    eq('with her day ending in Kolkata', demo.timezone, 'Asia/Kolkata');
    eq('labelled by class', demo.courseLabel, 'Class 10 · CBSE / NCERT');
    ok('the demo arrives with history', demo.xp > 0, `xp ${demo.xp}`);
    eq('asking twice reuses the same demo', (await POST('/profiles/demo', {})).user.id, demo.id);

    const curriculum = await GET('/curriculum');
    eq('the demo’s curriculum is India’s', curriculum.country, 'in');
    const class10 = curriculum.years.find(s => Number(s.year) === 10);
    const started = (class10?.subtopics || []).filter(c => c.attempts > 0);
    ok('the demo has evidence on most Class 10 NCERT chapters', started.length >= 8 && started.length < (class10?.subtopics || []).length,
      `${started.length} of ${class10?.subtopics?.length} chapters started`);
    ok('the untouched chapters are the ones she has not opened',
      (class10?.subtopics || []).some(c => c.id === 'c10-probability' && c.attempts === 0));

    const stats = await GET('/stats');
    ok('the demo has real attempts behind it', stats.totals.attempts > 50, `attempts ${stats.totals.attempts}`);
    eq('no day carries an invented board mark', stats.trajectory, []);
    ok('her activity is filed under Indian dates', stats.activity.length > 20 && stats.activity.every(d => /^\d{4}-\d{2}-\d{2}$/.test(d.date)),
      `${stats.activity.length} days`);

    const history = await POST('/history/list', { filter: 'all', page: 0 });
    ok('History has her recent questions', history.total > 0, `${history.total} rows`);
    ok('every row is named by its NCERT chapter, not by a bank generator',
      history.items.length > 0 && history.items.every(i => i.subtopicName && !/^[cy]\d+-/.test(i.subtopicName) && i.subtopicName !== 'Custom question'),
      `names ${show(history.items.slice(0, 5).map(i => i.subtopicName))}`);
    ok('and is filed under the chapter id the practice route understands',
      history.items.every(i => /^c10-/.test(i.subtopic)), `subtopics ${show(history.items.slice(0, 5).map(i => i.subtopic))}`);
    eq('no fake practice paper is seeded for India', (await GET('/exams')).exams.length, 0);

    const nsw = (await POST('/profiles/demo', { course: 'nsw' })).user;
    ok('the legacy NSW demo is a separate profile', nsw.id !== demo.id);
    eq('on the NSW course', nsw.course, 'nsw');
    eq('labelled by year', nsw.courseLabel, 'Year 10 · Stage 5');
    eq('with its day ending in Sydney', nsw.timezone, 'Australia/Sydney');
    eq('and its practice paper', (await GET('/exams')).exams.length, 1);
    eq('asking for the NSW demo twice reuses it too', (await POST('/profiles/demo', { course: 'nsw' })).user.id, nsw.id);
    eq('the picker lists both demos', (await GET('/profiles')).profiles.filter(p => p.isDemo).length, 2);
  } catch (err) { crashed(err); }

  // ── the product describes itself as Indian ─────────────────────────────────
  section('product identity');
  try {
    const html = readFileSync(`${CLIENT}index.html`, 'utf8');
    const description = /<meta name="description" content="([^"]*)"/.exec(html)?.[1] || '';
    ok('index.html describes the app for Indian students', /NCERT/.test(description) && /JEE/.test(description) && /olympiad/i.test(description),
      `description reads ${show(description)}`);
    ok('and never mentions the HSC or an iPad', !/HSC|iPad/i.test(description), `description reads ${show(description)}`);
    ok('the document language is English', /<html lang="en[^"]*">/.test(html));
    const manifest = JSON.parse(readFileSync(`${CLIENT}public/manifest.webmanifest`, 'utf8'));
    eq('the manifest names the app', manifest.name, 'Pri Learning');
    ok('the manifest describes the Indian product', /NCERT/.test(manifest.description) && /JEE/.test(manifest.description) && !/HSC|iPad/i.test(manifest.description),
      `manifest description reads ${show(manifest.description)}`);
    eq('the manifest is in Indian English', manifest.lang, 'en-IN');
    ok('the manifest theme matches the page', manifest.theme_color === manifest.background_color && html.includes(`content="${manifest.theme_color}"`),
      `theme ${manifest.theme_color}, background ${manifest.background_color}`);

    const login = readFileSync(`${CLIENT}src/pages/Login.jsx`, 'utf8');
    const heroStart = login.indexOf('/* ── hero ── */');
    const splitStart = login.indexOf('/* ── split layout');
    const hero = login.slice(heroStart, splitStart);
    ok('the Login hero source carries no HSC or NSW copy', heroStart > 0 && splitStart > heroStart && !/HSC|NSW|NESA/.test(hero));
    ok('the sign-up form opens on the India course', /course: 'in'/.test(login) && /STUDY_DEFAULT/.test(login));
    ok('the Australian option is a secondary, collapsed control', /Studying in Australia/.test(login) && /australia && \(/.test(login));
    ok('the cloud sign-in routes to the cloud account panel', /CLOUD_ACCOUNT_ROUTE = '\/settings#cloud-account-title'/.test(login));

    for (const page of ['Home.jsx', 'History.jsx', 'Favorites.jsx', 'Progress.jsx']) {
      const src = readFileSync(`${CLIENT}src/pages/${page}`, 'utf8');
      ok(`${page} has no hardcoded Sydney day boundary or Australian locale`,
        !/Australia\/Sydney|'en-AU'|'en-CA'|sydneyDate/.test(src));
      ok(`${page} never says HSC, NESA or Band`, !/\bHSC\b|\bNESA\b|Band \d|Leibniz/.test(src));
    }
    const nav = readFileSync(`${CLIENT}src/App.jsx`, 'utf8');
    ok('the navigation labels carry no NSW jargon', !/label: '[^']*(Year|HSC|NESA)[^']*'/.test(nav));
    for (const local of ['store.js', 'backend.js', 'badges.js']) {
      const src = readFileSync(`${CLIENT}src/local/${local}`, 'utf8');
      ok(`local/${local} has no hardcoded Australia/Sydney day boundary`, !/Australia\/Sydney/.test(src.replace(/\/\/.*$/gm, '')));
    }
  } catch (err) { crashed(err); }

  return report();
}

function report() {
  const total = groups.reduce((n, g) => n + g.pass + g.fail, 0);
  const failed = groups.reduce((n, g) => n + g.fail, 0);
  console.log('\nIndia identity — timezone, locale, demo and product copy, asserted in bare Node\n');
  for (const g of groups) {
    const n = g.pass + g.fail;
    console.log(`  ${g.name.padEnd(42)} ${String(g.pass).padStart(3)}/${String(n).padEnd(3)} ${g.fail ? `✖ ${g.fail} FAILED` : '✔'}`);
  }
  if (failures.length) {
    console.log('\nfailures:');
    for (const f of failures) console.log('  ' + f);
  }
  const verdict = failed ? '✖ INDIA IDENTITY SUITE FAILED' : '✔ INDIA IDENTITY SUITE PASSED';
  console.log(`\n${verdict} — ${total - failed}/${total} checks across ${groups.length} groups`);
  return failed;
}

process.exit(await run() ? 1 : 0);
