// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · E2E journeys — the Exam Desk (ADR-0002 §8, plan F4b)
//
// The unmarked mode of the examination system, driven in a browser against the
// real platform server (/v1/desk, schema 16) and the built client:
//
//   0. DARK: a build without PRI_FEATURE_EXAM_DESK shows no way in and has no
//      /desk route.
//   1. A SITTING: library paper → Practise at the desk → reading → working →
//      pause and resume → notes, flag, done, the ← → D F N T ? shortcuts (inert
//      while typing) → RELOAD mid-attempt → another device moved the attempt on
//      (stale revision) → the DEVICE CLOCK is changed and the display follows
//      the server after its next reply → the page is HIDDEN and returns →
//      working time runs out WHILE HIDDEN (overtime, never closed for the
//      student) → OFFLINE: a note and a Pause are kept on the device and take
//      effect when the server receives them, stamped with the server's time →
//      close, once → the closed view → practise again → delete.
//      And through all of it: NO MARK, SCORE, PERCENTAGE OR BAND ON ANY SCREEN;
//      no request to the marked papers, practice or the handwriting reader; no
//      learning event, no XP, no mastery change.
//   2. THE IMPORT: nothing is stored without the press (not on load, not from
//      the address, not from a message); preview, cancel, add; THE SAME FILE
//      TWICE IS ONE RECORD; a different export is a second record; a tampered
//      file and the other edition's paper are refused.
//   3. IN HINDI: reading time ends while the page is away; the closed desk says
//      it is unmarked and carries no mark wording in Hindi either.
//
// WHAT IS REAL: the built client, the platform server and its SQLite database,
// the account, every request, the server's own clock stamps.
// WHAT IS THE TEST'S DESK (labelled where it happens, never a product path):
//   · on a Priyabhata server no India paper is published yet, so the desk
//     offers the library's one seeded paper to this edition too;
//   · to make "three hours pass" it moves the server's own stamps back in the
//     server's database;
//   · "another device" is a change made at the desk to the same account's row.
// The prithagoras-web export is the SYNTHETIC fixture
// client/test/fixtures/prithagoras-desk-export-v1.synthetic.json.
// No physical iPad, Apple Pencil or student evidence is claimed.
//
// Run on its own:  node client/test/tour-exam-desk.js [--browser=webkit]
// It makes its own builds (the flags are build-time) and leaves the suite's
// usual build in client/dist. PRI_EDITION=prithagoras runs it as that edition.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { onlinePlatform, closeOnlinePlatform } from './support/online-session.mjs';
import { markWording, saysUnmarked } from './support/no-mark-wording.mjs';
import { deriveClock } from '../src/engine/deskClock.js';
import en from '../src/i18n/strings.en.js';
import hi from '../src/i18n/strings.hi.js';

const PAPER = '2027-mathematics-advanced-assessment-1';
const FIXTURE = JSON.parse(readFileSync(new URL('./fixtures/prithagoras-desk-export-v1.synthetic.json', import.meta.url), 'utf8'));
const EDITION = String(process.env.PRI_EDITION || '').trim() || 'priyabhata';
const OTHER_EDITION = EDITION === 'priyabhata' ? 'prithagoras' : 'priyabhata';
const MIN = 60000;
const MARKED_PATH = /^\/v1\/(exams|practice|handwriting|recogni|tutor|marker|working|question-photo|rush|match)/;
// The app SHELL reads two lists for its own navigation, on the desk as on any
// route: the "due for review" badge (GET /v1/practice/review-queue, App.jsx
// refreshDue) and the mistake notebook (GET /v1/practice/notebook). They are
// not the desk's (server/test/desk-isolation-check.mjs: the desk names no
// practice route), they are reads, and they mark nothing. Those two GETs are
// the only requests outside the desk's own that are allowed here; anything
// else on a marking, practice, reader or tutor route — and any write at all —
// fails the flow.
const shellBadge = c => c.method === 'GET' && (c.path === '/v1/practice/review-queue' || c.path === '/v1/practice/notebook');
const strayCalls = calls => calls.filter(c => MARKED_PATH.test(c.path) && !shellBadge(c));
const fill = (template, vars = {}) => template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));

/** TEST DESK: this edition's library offers the seeded paper (no India paper is published yet). */
function offerPaper(platform) {
  platform.h.db.prepare('INSERT OR IGNORE INTO resource_editions(resource_id, edition) VALUES (?, ?)').run(PAPER, EDITION);
}
const rowOf = (platform, id) => platform.h.db.prepare('SELECT * FROM desk_attempts WHERE id=?').get(id);
const rowsOf = (platform, accountId) => platform.h.db.prepare('SELECT * FROM desk_attempts WHERE account_id=? ORDER BY created_at, id').all(accountId);
const eventsOf = row => JSON.parse(row.clock_json).events;
const questionsOf = row => JSON.parse(row.questions_json);
/** What the server's own record says is left, right now. */
const serverClock = row => deriveClock(JSON.parse(row.paper_json), eventsOf(row), Date.now());
/** TEST DESK: time passes — every stamp of the server's log moves back by `ms`. */
function agePaper(platform, id, ms) {
  const row = rowOf(platform, id);
  const log = JSON.parse(row.clock_json);
  log.events = log.events.map(e => ({ ...e, at: e.at - ms }));
  platform.h.db.prepare('UPDATE desk_attempts SET clock_json=? WHERE id=?').run(JSON.stringify(log), id);
}
/**
 * TEST DESK: the server itself is out of reach for /v1. The browser-side cut
 * (online.disconnect) fails a request at once, as a dead network does; this
 * makes sure one that slips past it — Chromium lets a request made while a
 * page unloads through — still never arrives. Returns the way back.
 */
function cutServer(platform) {
  const server = platform.h.server;
  const handlers = server.listeners('request');
  server.removeAllListeners('request');
  const drop = (req, res) => { if (String(req.url).startsWith('/v1/')) req.socket.destroy(); else for (const handle of handlers) handle.call(server, req, res); };
  server.on('request', drop);
  return () => { server.removeListener('request', drop); for (const handle of handlers) server.on('request', handle); };
}
/** What the server holds that only a marked or practised question would create. */
function markingFootprint(platform, accountId) {
  const n = sql => Number(platform.h.db.prepare(sql).get(accountId).n);
  return {
    learningEvents: n('SELECT COUNT(*) AS n FROM learning_events WHERE account_id=?'),
    examOrPracticeReceipts: n("SELECT COUNT(*) AS n FROM idempotency_keys WHERE account_id=? AND (scope LIKE 'exam-%' OR scope LIKE 'practice-%' OR scope LIKE 'recognition%')")
  };
}
/** The device's own learning stores: activity (XP, streak days) and ratings (mastery). */
const deviceLearning = page => page.evaluate(() => new Promise(done => {
  const open = indexedDB.open('pri-learning');
  open.onerror = () => done(null);
  open.onsuccess = () => {
    const db = open.result;
    const out = {};
    const stores = ['activity', 'ratings', 'attempts', 'exams'].filter(s => db.objectStoreNames.contains(s));
    if (!stores.length) { db.close(); done(out); return; }
    const tx = db.transaction(stores);
    for (const s of stores) { const req = tx.objectStore(s).getAll(); req.onsuccess = () => { out[s] = JSON.stringify(req.result); }; }
    tx.oncomplete = () => { db.close(); done(out); };
    tx.onerror = () => { db.close(); done(null); };
  };
}));

/** The desk's own words on screen: the page, without the paper's own title and disclaimer. */
const deskText = page => page.evaluate(() => {
  const root = document.querySelector('.dk-page') || document.querySelector('[data-desk-entry]')?.closest('.lib-page') || document.body;
  const clone = root.cloneNode(true);
  for (const el of clone.querySelectorAll('[data-paper-own], .lib-detail')) el.remove();
  // Each piece of text on its own, so two neighbouring labels never read as one word.
  const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
  const pieces = [];
  while (walker.nextNode()) pieces.push(walker.currentNode.nodeValue);
  return pieces.join(' ').replace(/\s+/g, ' ').trim();
});
const resultFurniture = page => page.evaluate(() => document.querySelectorAll('.eval-card, .verdict-good, .verdict-bad, .eval-marks, .xp-pop, .solution-block, .solution-panel, .criteria-table, [data-exam-result]').length);
const clockSeconds = async (page) => {
  const text = (await page.locator('[data-clock-time]').first().textContent()) || '';
  const m = /(\+?)(\d\d):(\d\d):(\d\d)/.exec(text);
  return m ? { over: m[1] === '+', seconds: Number(m[2]) * 3600 + Number(m[3]) * 60 + Number(m[4]) } : null;
};
/** The desk shows this phase, and the server has confirmed every press (nothing is still queued on the device). */
const phaseIs = (page, phase, running = null) => page.waitForFunction(([p, r]) => {
  const el = document.querySelector('[data-desk-attempt]');
  return !!el && el.getAttribute('data-desk-phase') === p && (r === null || el.getAttribute('data-desk-running') === String(r)) &&
    el.getAttribute('data-desk-queued') === '0' && el.getAttribute('data-desk-save') !== 'saving';
}, [phase, running], { timeout: 20000 });
const savedIs = (page, state = 'saved') => page.waitForFunction(s => document.querySelector('[data-desk-attempt]')?.getAttribute('data-desk-save') === s, state, { timeout: 20000 });
const attemptIdOf = page => page.locator('[data-desk-attempt]').getAttribute('data-desk-attempt');
/** The page goes to the background (another app, a locked iPad) and comes back. */
const setVisibility = (page, state) => page.evaluate(s => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => s });
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => s === 'hidden' });
  document.dispatchEvent(new Event('visibilitychange'));
}, state);
const announced = page => page.locator('[data-shell-announce]').textContent();
const within = (a, b, tolerance) => Math.abs(a - b) <= tolerance;
/** Every control of the desk on screen that is smaller than a 44 × 44 px target. */
const smallControls = page => page.evaluate(() => [...document.querySelectorAll('.dk-page button, .dk-page a[href], .dk-page textarea, .dk-page input, [data-desk-entry] button, [data-desk-entry] a[href]')]
  .filter(el => el.getClientRects().length > 0 && !el.classList.contains('sheet-scrim'))
  .map(el => { const r = el.getBoundingClientRect(); return { control: (el.getAttribute('aria-label') || el.textContent || el.id || el.tagName).trim().slice(0, 32), w: Math.round(r.width), h: Math.round(r.height) }; })
  .filter(c => c.w < 43.5 || c.h < 43.5));
const noSideScroll = page => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
/** The same screen at a phone, an iPad Split View half, an iPad portrait and landscape: 44 px targets, nothing off the side. */
async function atEverySize(page, check, where) {
  const before = page.viewportSize();
  for (const [name, width, height] of [['phone 390', 390, 844], ['iPad half 507', 507, 1024], ['iPad portrait 820', 820, 1180], ['iPad Pro portrait 1024', 1024, 1366], ['iPad landscape 1180', 1180, 820], ['iPad Pro landscape 1366', 1366, 1024]]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(150);
    const small = await smallControls(page);
    await check(`${where} @ ${name}: every control is at least 44 × 44 px and nothing runs off the side`, small.length === 0 && await noSideScroll(page), JSON.stringify(small.slice(0, 6)));
  }
  await page.setViewportSize(before);
  await page.waitForTimeout(150);
}

/** TEST DESK: read or rewrite the desk's own device cache (IndexedDB pri-desk-v1), as someone with the device could. */
const cacheRows = page => page.evaluate(() => new Promise(done => {
  const open = indexedDB.open('pri-desk-v1');
  open.onerror = () => done([]);
  open.onsuccess = () => { const db = open.result; if (!db.objectStoreNames.contains('attempts')) { db.close(); done([]); return; } const req = db.transaction('attempts').objectStore('attempts').getAll(); req.onsuccess = () => { db.close(); done(req.result); }; req.onerror = () => { db.close(); done([]); }; };
}));
const putCacheRow = (page, row) => page.evaluate(r => new Promise(done => {
  const open = indexedDB.open('pri-desk-v1');
  open.onsuccess = () => { const db = open.result; const tx = db.transaction('attempts', 'readwrite'); tx.objectStore('attempts').put(r); tx.oncomplete = () => { db.close(); done(true); }; tx.onerror = () => { db.close(); done(false); }; };
  open.onerror = () => done(false);
}), row);

async function startFromLibrary({ page, base }) {
  await page.goto(`${base}/library/${PAPER}`, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-desk-entry] [data-desk-start]').waitFor({ timeout: 30000 });
  await page.locator('[data-desk-start]').click();
  await page.waitForURL(/\/desk\/[0-9a-f-]{36}$/, { timeout: 20000 });
  await phaseIs(page, 'idle');
  return attemptIdOf(page);
}

// ── 0 · dark ─────────────────────────────────────────────────────────────────

export const flowDark = {
  id: 'exam-desk-dark',
  name: 'Exam desk · dark without PRI_FEATURE_EXAM_DESK: no way in from a library paper, no /desk route',
  online: true,
  // No service worker between the page and the server: every request is seen, and the offline cut is the same in both engines.
  inspectNetwork: true,

  async run({ page, base, check, goto, createProfile, online }) {
    const platform = await onlinePlatform();
    offerPaper(platform);
    await goto('/');
    await createProfile({ name: 'Dark Desk Student', year: 10 });
    await online.signIn({ name: 'Dark Desk Student' });
    const flags = await (await page.request.get(`${base}/features.json`)).json();
    await check('this build has the library on and the Exam Desk off', flags.library === true && flags.examDesk === false, JSON.stringify(flags));
    await page.goto(`${base}/library/${PAPER}`, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-library-detail]').waitFor({ timeout: 30000 });
    await page.waitForTimeout(800);
    await check('the library paper offers no way to the desk', await page.locator('[data-desk-entry], [data-desk-start], [data-desk-import-link]').count() === 0);
    await page.goto(`${base}/desk/import`, { waitUntil: 'domcontentloaded' });
    await page.locator('.shell').waitFor({ timeout: 30000 });
    await page.waitForTimeout(800);
    await check('/desk/import is not a page of this build', await page.locator('.dk-page, [data-desk-import]').count() === 0, page.url());
    await online.settled();
    await check('and nothing asked the server for the desk', online.calls.filter(c => c.path.startsWith('/v1/desk')).length === 0);
  }
};

// ── 1 · a sitting ────────────────────────────────────────────────────────────

export const flowSitting = {
  id: 'exam-desk-sitting',
  name: 'Exam desk · a sitting: reading, working, notes, reload, stale revision, device clock, hidden, offline, time up while away, closed once — never a mark',
  online: true,
  // No service worker between the page and the server: every request is seen, and the offline cut is the same in both engines.
  inspectNetwork: true,

  async run({ page, ctx, base, check, goto, createProfile, online, settle }) {
    const platform = await onlinePlatform();
    offerPaper(platform);
    await goto('/');
    await createProfile({ name: 'Desk Student', year: 10 });
    const account = await online.signIn({ name: 'Desk Student' });
    await online.settled();
    const footprintBefore = markingFootprint(platform, account.id);
    const deviceBefore = await deviceLearning(page);
    const callsFrom = online.calls.length;
    const deskCalls = async () => { await online.settled(); return online.calls.slice(callsFrom).filter(c => c.path.startsWith('/v1/desk')); };
    const plateOn = async (where) => check(`${where}: the screen says "Practice · not marked"`,
      (await page.locator('[data-desk-unmarked]').first().textContent())?.trim() === en['desk.unmarked']);
    const noMarkOn = async (where) => {
      const text = await deskText(page);
      const found = markWording(text, 'en');
      await check(`${where}: no mark, score, percentage, band or result wording on the screen`, found.length === 0 && await resultFurniture(page) === 0, `${JSON.stringify(found)} in ${JSON.stringify(text.slice(0, 300))}`);
    };

    // ── from the library ───────────────────────────────────────────────────
    await page.goto(`${base}/library/${PAPER}`, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-desk-entry] [data-desk-start]').waitFor({ timeout: 30000 });
    await plateOn('the library paper');
    await noMarkOn('the way in');
    const id = await startFromLibrary({ page, base });
    let row = rowOf(platform, id);
    await check('Practise at the desk starts one unmarked attempt for this account, idle, on the server',
      !!row && String(row.account_id) === account.id && row.mode === 'unmarked' && row.state === 'idle' && row.edition === EDITION && eventsOf(row).length === 0, JSON.stringify(row && { state: row.state, mode: row.mode, edition: row.edition }));
    await plateOn('before starting');
    const heading = await page.locator('.xs-paper-title').textContent();
    await check('the paper header shows the paper, its source and its disclaimer', heading === FIXTURE.resource.title && /Bored of Studies/.test(await page.locator('.xs-paper-source').textContent()) && /not affiliated/i.test(await page.locator('.xs-paper-disclaimer').textContent()));
    await check('27 questions in two sections', await page.locator('.xs-nav button[data-q]').count() === 27 && await page.locator('.xs-nav [role="group"]').count() === 2);

    // ── reading, then working ──────────────────────────────────────────────
    await page.locator('[data-desk-intent="begin-reading"]').click();
    await phaseIs(page, 'reading', true);
    let shown = await clockSeconds(page);
    await check('reading time starts at ten minutes, labelled Reading time', within(shown.seconds, 600, 5) && (await page.locator('.xs-clock-label').textContent()) === en['desk.clockReading'], JSON.stringify(shown));
    let calls = await deskCalls();
    const firstClock = calls.find(c => /\/clock$/.test(c.path));
    await check('the press sent an intent and the revision — no time, deadline or remaining time', JSON.stringify(firstClock?.body) === JSON.stringify({ intent: 'begin-reading', rev: 0 }) && firstClock.status === 200, JSON.stringify(calls.map(c => [c.method, c.path.replace(id, ':id'), c.status, c.body])));
    row = rowOf(platform, id);
    await check('the server stamped the start with its own clock', eventsOf(row).length === 1 && eventsOf(row)[0].t === 'begin-reading' && within(eventsOf(row)[0].at, Date.now(), 15000));
    await check('the timer is a timer that never interrupts a screen reader', await page.locator('.xs-clock[role="timer"][aria-live="off"]').count() === 1);

    await page.locator('[data-desk-intent="begin-working"]').click();
    await phaseIs(page, 'working', true);
    shown = await clockSeconds(page);
    await check('skipping the rest of reading starts the full three hours of working time', within(shown.seconds, 180 * 60, 5) && (await page.locator('.xs-clock-label').textContent()) === en['desk.clockWorking'], JSON.stringify(shown));
    await plateOn('working');

    // ── pause and resume ───────────────────────────────────────────────────
    await page.locator('[data-desk-intent="pause"]').click();
    await phaseIs(page, 'working', false);
    const frozen = await clockSeconds(page);
    await page.waitForTimeout(1600);
    await check('paused: the clock stands still and says so', (await clockSeconds(page)).seconds === frozen.seconds && (await page.locator('.xs-clock-note').textContent()) === en['desk.paused']);
    await page.locator('[data-desk-intent="resume"]').click();
    await phaseIs(page, 'working', true);

    // ── notes, flag, done, shortcuts ───────────────────────────────────────
    await page.locator('.xs-nav button[data-q="3"]').click();
    const notes = page.locator('textarea[data-notes-for="3"]');
    await notes.fill('check the domain');
    await savedIs(page);
    await check('a note on question 3 is saved to the account', questionsOf(rowOf(platform, id))['3']?.note === 'check the domain', JSON.stringify(questionsOf(rowOf(platform, id))));
    await page.locator('#dk-question-title').click();
    await page.keyboard.press('f');
    await check('F flags the question', await page.locator('[data-desk-flag]').getAttribute('aria-pressed') === 'true');
    await check('the navigator names it "Question 3, flagged, has a note, current"', await page.locator('.xs-nav button[data-q="3"]').getAttribute('aria-label') === 'Question 3, flagged, has a note, current');
    await page.keyboard.press('ArrowRight');
    await check('→ moves to question 4', await page.locator('[data-desk-question]').getAttribute('data-desk-question') === '4');
    await page.keyboard.press('d');
    await check('D sets it done', await page.locator('[data-desk-done]').getAttribute('aria-pressed') === 'true');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('n');
    await check('N goes to the notes of the question on screen', await page.evaluate(() => document.activeElement?.getAttribute('data-notes-for')) === '3');
    await page.keyboard.press('End');
    await page.keyboard.type(' df?');
    await check('typing D, F and ? in a note is typing: nothing is flagged, done or opened',
      await notes.inputValue() === 'check the domain df?' && await page.locator('[data-desk-done]').getAttribute('aria-pressed') === 'false' &&
        await page.locator('[data-desk-flag]').getAttribute('aria-pressed') === 'true' && await page.locator('[role="dialog"]').count() === 0);
    await page.keyboard.press('ArrowLeft');
    await check('and ← moves the caret, not the question', await page.locator('[data-desk-question]').getAttribute('data-desk-question') === '3');
    await notes.fill('check the domain');
    await page.locator('#dk-question-title').click();
    await page.keyboard.press('?');
    await page.locator('[data-testid="shell-shortcuts"]').waitFor({ timeout: 5000 });
    await check('? opens the shortcut list, a dialog with the focus inside it', await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')));
    await page.keyboard.press('d');
    await page.keyboard.press('Escape');
    await check('Esc closes it; a key pressed while it was open did nothing', await page.locator('[role="dialog"]').count() === 0 && await page.locator('[data-desk-done]').getAttribute('aria-pressed') === 'false');
    await page.keyboard.press('t');
    await check('T hides the clock', await page.locator('.xs-clock[data-clock-hidden="true"]').count() === 1 && !/\d\d:\d\d/.test(await page.locator('[data-clock-time]').textContent()));
    await page.keyboard.press('t');
    await check('and shows it again', await page.locator('.xs-clock[data-clock-hidden="true"]').count() === 0);
    await savedIs(page);
    row = rowOf(platform, id);
    await check('flag, done and the note are on the server; done and flagged are separate',
      questionsOf(row)['3']?.flagged === true && questionsOf(row)['3']?.done === false && questionsOf(row)['4']?.done === true && questionsOf(row)['3']?.note === 'check the domain', JSON.stringify(questionsOf(row)));

    await atEverySize(page, check, 'working');
    await check('at iPad landscape the desk is rail · question · notes side by side; on a phone it is one column',
      await page.evaluate(() => getComputedStyle(document.querySelector('.xs-grid')).gridTemplateColumns.split(' ').length) === 3);
    await page.setViewportSize({ width: 390, height: 844 });
    await check('(phone: one column)', await page.evaluate(() => getComputedStyle(document.querySelector('.xs-grid')).gridTemplateColumns.split(' ').length) === 1);
    await page.setViewportSize({ width: 1440, height: 900 });

    // ── reload mid-attempt ─────────────────────────────────────────────────
    await page.reload({ waitUntil: 'domcontentloaded' });
    await phaseIs(page, 'working', true);
    await page.waitForFunction(() => document.querySelector('[data-desk-attempt]')?.getAttribute('data-desk-save') !== 'saving', null, { timeout: 20000 }).catch(() => {});
    await settle();
    shown = await clockSeconds(page);
    const afterReload = serverClock(rowOf(platform, id));
    await check('RELOAD: the time goes on from the server\'s record', !shown.over && within(shown.seconds, afterReload.remainingMs / 1000, 4), `${JSON.stringify(shown)} vs ${afterReload.remainingMs / 1000}`);
    await page.locator('.xs-nav button[data-q="3"]').click();
    await check('RELOAD: the note, the flag and the done question are still there',
      await page.locator('textarea[data-notes-for="3"]').inputValue() === 'check the domain' && await page.locator('[data-desk-flag]').getAttribute('aria-pressed') === 'true' &&
        /is-done/.test(await page.locator('.xs-nav button[data-q="4"]').getAttribute('class')));
    await check('RELOAD: the same attempt, not a new one', rowsOf(platform, account.id).length === 1 && await attemptIdOf(page) === id);

    // ── typed while the first reply is still on its way ────────────────────
    // A slow connection: the page has painted from this device and the server's reply is two seconds out.
    const slowRead = async route => { await new Promise(r => setTimeout(r, 2000)); await route.continue().catch(() => {}); };
    const readUrl = url => url.pathname === `/v1/desk/attempts/${id}`;
    await ctx.route(readUrl, slowRead);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('[data-desk-attempt]').waitFor({ timeout: 30000 });
    await page.locator('.xs-nav button[data-q="7"]').click();
    await page.locator('textarea[data-notes-for="7"]').fill('typed before the server answered');
    await page.locator('[data-desk-flag]').click();
    await page.waitForTimeout(2600);
    await ctx.unroute(readUrl, slowRead);
    await phaseIs(page, 'working', true);
    await savedIs(page);
    await check('SLOW LOAD: a note and a flag made while the page still said "checking" survive the server\'s reply, on screen and on the server',
      await page.locator('textarea[data-notes-for="7"]').inputValue() === 'typed before the server answered' && await page.locator('[data-desk-flag]').getAttribute('aria-pressed') === 'true' &&
        questionsOf(rowOf(platform, id))['7']?.note === 'typed before the server answered' && questionsOf(rowOf(platform, id))['7']?.flagged === true, JSON.stringify(questionsOf(rowOf(platform, id))['7']));
    await page.locator('[data-desk-flag]').click();
    await page.locator('textarea[data-notes-for="7"]').fill('');
    await savedIs(page);

    // ── the device cache is not the record ─────────────────────────────────
    const kept = (await cacheRows(page)).find(r => r.attemptId === id);
    await check('the device keeps this attempt under this account, and no other', !!kept && kept.accountId === account.id && kept.key === `desk:v1:${account.id}:${id}` && (await cacheRows(page)).every(r => r.accountId === account.id));
    if (kept?.body) {
      // TEST DESK: someone edits the cache — working time "began" two hours later than it did, and a note is rewritten.
      const forged = JSON.parse(JSON.stringify(kept));
      forged.body.attempt.events = forged.body.attempt.events.map(e => ({ ...e, at: e.at + 2 * 60 * MIN }));
      forged.body.attempt.questions['3'] = { ...forged.body.attempt.questions['3'], note: 'FORGED ON THE DEVICE' };
      const serverBefore = JSON.stringify([rowOf(platform, id).clock_json, rowOf(platform, id).questions_json]);
      await putCacheRow(page, forged);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await phaseIs(page, 'working', true);
      await settle();
      await page.locator('.xs-nav button[data-q="3"]').click();
      shown = await clockSeconds(page);
      await check('FORGED CACHE: after the server\'s reply the clock and the note are the server\'s; the server\'s record did not move',
        within(shown.seconds, serverClock(rowOf(platform, id)).remainingMs / 1000, 4) && await page.locator('textarea[data-notes-for="3"]').inputValue() === 'check the domain' &&
          JSON.stringify([rowOf(platform, id).clock_json, rowOf(platform, id).questions_json]) === serverBefore, JSON.stringify(shown));
      // TEST DESK: a record kept on this device for ANOTHER account, under an attempt id of its own.
      const other = '99999999-9999-4999-8999-999999999999';
      const foreign = JSON.parse(JSON.stringify(kept));
      Object.assign(foreign, { key: `desk:v1:424242:${other}`, accountId: '424242', attemptId: other, unsent: true });
      foreign.body.attempt.id = other;
      foreign.body.attempt.questions = { 1: { done: false, flagged: false, note: 'SECRET NOTE OF ANOTHER ACCOUNT', noteRev: 1, ms: 0 } };
      foreign.body.pending = { 2: { note: 'UNSENT SECRET OF ANOTHER ACCOUNT', noteRev: 1 } };
      await putCacheRow(page, foreign);
      const seen = [];
      const watch = setInterval(() => { page.evaluate(() => document.body.innerText).then(text => seen.push(text)).catch(() => {}); }, 60);
      await page.goto(`${base}/desk/${other}`, { waitUntil: 'domcontentloaded' });
      await page.locator('[data-desk-error]').waitFor({ timeout: 30000 });
      // …and with the server out of reach, when only the device can say whose desk this is.
      const restore = cutServer(platform);
      await online.disconnect();
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.locator('[data-desk-error], [data-desk-attempt]').first().waitFor({ timeout: 30000 });
      await page.waitForTimeout(600);
      restore();
      await online.reconnect();
      clearInterval(watch);
      await check('ANOTHER ACCOUNT\'S CACHE on this device is never painted for this account — online or with the server out of reach',
        seen.length > 3 && !seen.some(text => /SECRET/.test(text)) && await page.locator('[data-desk-attempt]').count() === 0 && await page.locator('[data-desk-error]').count() === 1, `${seen.length} looks at the page`);
      await check('and it is neither sent nor changed', !(await online.calls).some(c => /SECRET/.test(JSON.stringify(c.body || ''))) && (await cacheRows(page)).some(r => r.attemptId === other && r.accountId === '424242'));
      await page.goto(`${base}/desk/${id}`, { waitUntil: 'domcontentloaded' });
      await phaseIs(page, 'working', true);
      await page.locator('[data-desk-others]').waitFor({ timeout: 10000 });
      await page.locator('[data-desk-others] button').click();
      await page.locator('[data-desk-others]').waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});
      await check('the page says another account\'s unsent notes are held here, and removes them only when told to', await page.locator('[data-desk-others]').count() === 0 && !(await cacheRows(page)).some(r => r.accountId === '424242'));
    } else {
      await check('the kept record is sealed under the profile\'s key (its contents cannot be read or forged from the device)', !!kept?.sealed);
    }

    // ── leaving the page inside the app ────────────────────────────────────
    await page.locator('.xs-nav button[data-q="8"]').click();
    await page.locator('textarea[data-notes-for="8"]').fill('typed, then straight back to the paper');
    await page.locator('.dk-back').first().click();
    await page.waitForURL(new RegExp(`/library/${PAPER}$`), { timeout: 20000 });
    for (let i = 0; i < 60 && questionsOf(rowOf(platform, id))['8']?.note !== 'typed, then straight back to the paper'; i++) await page.waitForTimeout(50);
    await check('LEFT WITHIN THE DEBOUNCE: the note typed a moment before going back to the paper reached the server', questionsOf(rowOf(platform, id))['8']?.note === 'typed, then straight back to the paper');
    await page.locator('[data-desk-continue]').waitFor({ timeout: 20000 });
    await check('the library paper now offers "Continue your attempt", not a second start', await page.locator('[data-desk-start]').count() === 0);
    // The cache was forgotten (a sign-out elsewhere in this page's lifetime): the next desk opened keeps again.
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('pri:cloud-session-change', { detail: { connected: false, relayOnly: true } })));
    for (let i = 0; i < 40 && (await cacheRows(page)).length; i++) await page.waitForTimeout(50);
    const forgotten = (await cacheRows(page)).length === 0;
    await page.goto(`${base}/library/${PAPER}`, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-desk-continue]').waitFor({ timeout: 30000 });
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('pri:cloud-session-change', { detail: { connected: false } })));
    await page.waitForTimeout(400);
    await page.locator('[data-desk-continue]').click();
    await phaseIs(page, 'working', true);
    await page.locator('.xs-nav button[data-q="8"]').click();
    await page.locator('[data-desk-done]').click();
    await savedIs(page);
    for (let i = 0; i < 40 && !(await cacheRows(page)).length; i++) await page.waitForTimeout(50);
    await check('FORGOTTEN, THEN KEPT AGAIN: a sign-out signal empties the desk\'s device cache, and a desk opened afterwards in the same page keeps its record again',
      forgotten && (await cacheRows(page)).some(r => r.attemptId === id && r.accountId === account.id));
    await page.locator('[data-desk-done]').click();
    await page.locator('textarea[data-notes-for="8"]').fill('');
    await savedIs(page);

    // ── another device moved the attempt on: a stale revision ──────────────
    // TEST DESK: the same account's row, changed as a save from another device would change it.
    platform.h.db.prepare('UPDATE desk_attempts SET rev=rev+5 WHERE id=?').run(id);
    const before409 = (await deskCalls()).length;
    await page.locator('[data-desk-intent="pause"]').click();
    await phaseIs(page, 'working', false);
    calls = (await deskCalls()).slice(before409);
    const clockReplies = calls.filter(c => /\/clock$/.test(c.path));
    await check('STALE REVISION: the server refused the press with the attempt\'s new state, and the page sent it again with that revision',
      clockReplies.length === 2 && clockReplies[0].status === 409 && clockReplies[0].json?.error?.code === 'DESK_REV_STALE' && clockReplies[1].status === 200 && clockReplies[1].body.rev === clockReplies[0].body.rev + 5,
      JSON.stringify(clockReplies.map(c => ({ status: c.status, code: c.json?.error?.code, rev: c.body?.rev }))));
    await check('STALE REVISION: paused exactly once on the server', eventsOf(rowOf(platform, id)).filter(e => e.t === 'pause').length === 2);
    await page.locator('[data-desk-intent="resume"]').click();
    await phaseIs(page, 'working', true);
    await savedIs(page);

    // ── the device clock is changed ────────────────────────────────────────
    const eventsBeforeSkew = rowOf(platform, id).clock_json;
    await page.evaluate(() => { const real = Date.now.bind(Date); window.__priRealNow = real; Date.now = () => real() + 3 * 60 * 60 * 1000 + 7 * 60 * 1000; });
    await page.waitForTimeout(1600);
    shown = await clockSeconds(page);
    await check('DEVICE CLOCK moved forward three hours: the face does not move — it runs on the server\'s time, pinned to the page\'s own steady clock',
      !shown.over && within(shown.seconds, serverClock(rowOf(platform, id)).remainingMs / 1000, 4), `${JSON.stringify(shown)} vs server ${serverClock(rowOf(platform, id)).remainingMs / 1000}`);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.waitForTimeout(900);
    shown = await clockSeconds(page);
    await check('DEVICE CLOCK: nor after the next reply, and the server\'s log did not move',
      !shown.over && within(shown.seconds, serverClock(rowOf(platform, id)).remainingMs / 1000, 4) && rowOf(platform, id).clock_json === eventsBeforeSkew && (await announced(page)) !== en['desk.sayOver']);
    await page.evaluate(() => { Date.now = window.__priRealNow; });

    // ── hidden, and back ───────────────────────────────────────────────────
    await page.locator('.xs-nav button[data-q="5"]').click();
    const hiddenFrom = (await deskCalls()).length;
    await page.locator('textarea[data-notes-for="5"]').fill('typed just before the app was hidden');
    await setVisibility(page, 'hidden');
    for (let i = 0; i < 40 && questionsOf(rowOf(platform, id))['5']?.note !== 'typed just before the app was hidden'; i++) await page.waitForTimeout(50);
    await check('HIDDEN: the note typed a moment before is saved at once, not after the debounce', questionsOf(rowOf(platform, id))['5']?.note === 'typed just before the app was hidden');
    const readsBefore = (await deskCalls()).filter(c => c.method === 'GET' && c.path === `/v1/desk/attempts/${id}`).length;
    await setVisibility(page, 'visible');
    for (let i = 0; i < 60; i++) { if ((await deskCalls()).filter(c => c.method === 'GET' && c.path === `/v1/desk/attempts/${id}`).length > readsBefore) break; await page.waitForTimeout(100); }
    await check('RESUMED: the page reads the attempt again from the server', (await deskCalls()).filter(c => c.method === 'GET' && c.path === `/v1/desk/attempts/${id}`).length > readsBefore && (await deskCalls()).length > hiddenFrom);
    await phaseIs(page, 'working', true);

    // ── working time runs out while the page is hidden ─────────────────────
    await setVisibility(page, 'hidden');
    // TEST DESK: three hours and four minutes pass — the server's own stamps move back.
    agePaper(platform, id, 184 * MIN);
    await page.waitForTimeout(700);
    await setVisibility(page, 'visible');
    await page.locator('[data-desk-over]').waitFor({ timeout: 20000 });
    shown = await clockSeconds(page);
    const overdue = serverClock(rowOf(platform, id));
    await check('TIME UP WHILE AWAY: the paper is still open, counting overtime from the server\'s record',
      rowOf(platform, id).state === 'working' && await page.locator('[data-desk-attempt]').getAttribute('data-desk-phase') === 'working' && shown.over && within(shown.seconds, overdue.overtimeMs / 1000, 5) && overdue.overtimeMs > 0,
      `${JSON.stringify(shown)} vs ${overdue.overtimeMs / 1000}`);
    const minutes = Math.max(1, Math.round(overdue.overtimeMs / MIN));
    await page.waitForFunction(() => /\S/.test(document.querySelector('[data-shell-announce]')?.textContent || ''), null, { timeout: 5000 }).catch(() => {});
    const said = (await announced(page)) || '';
    await check('TIME UP WHILE AWAY: said once, as "ended N minutes ago, while you were away", and shown in words',
      /Working time ended \d+ minutes? ago, while you were away\./.test(said) && (await page.locator('[data-desk-over]').textContent()).includes(`Working time ended ${minutes} minute`), JSON.stringify(said));
    await noMarkOn('overtime');

    // ── offline: kept on the device, applied when the server receives it ───
    const eventsOnline = eventsOf(rowOf(platform, id)).length;
    const restoreServer = cutServer(platform);
    await online.disconnect();
    await page.locator('.xs-nav button[data-q="6"]').click();
    await page.locator('textarea[data-notes-for="6"]').fill('written with no connection');
    await page.locator('[data-desk-intent="pause"]').click();
    const pressedAt = Date.now();
    await page.locator('[data-desk-estimate-note]').waitFor({ timeout: 20000 });
    await check('OFFLINE: the page says the work is kept on this device and the clock is an estimate',
      (await page.locator('[data-save-state]').textContent()) === en['shell.unsaved'] && (await page.locator('.xs-clock-note').textContent()) === en['desk.estimate'] &&
        await page.locator('[data-desk-attempt]').getAttribute('data-desk-estimate') === 'true');
    row = rowOf(platform, id);
    await check('OFFLINE: the server has neither the note nor the pause', eventsOf(row).length === eventsOnline && !questionsOf(row)['6']);
    // Reloaded with still no connection: the page paints from the device cache, unsent work and all.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('[data-desk-attempt]').waitFor({ timeout: 30000 });
    await page.locator('[data-desk-estimate-note]').waitFor({ timeout: 20000 });
    await page.locator('.xs-nav button[data-q="6"]').click();
    await check('OFFLINE RELOAD: the attempt, the earlier saved notes, the unsent note and the queued Pause come back from this device, still marked as not saved and an estimate',
      await page.locator('textarea[data-notes-for="6"]').inputValue() === 'written with no connection' && await page.locator('[data-desk-attempt]').getAttribute('data-desk-queued') === '1' &&
        await page.locator('.xs-nav button[data-q="5"]').getAttribute('aria-label') === 'Question 5, has a note' && /is-done/.test(await page.locator('.xs-nav button[data-q="4"]').getAttribute('class')) &&
        await page.locator('[data-desk-attempt]').getAttribute('data-desk-phase') === 'working' && (await page.locator('[data-save-state]').textContent()) === en['shell.unsaved'] && await attemptIdOf(page) === id);
    row = rowOf(platform, id);
    await check('OFFLINE RELOAD: and the server still has neither', eventsOf(row).length === eventsOnline && !questionsOf(row)['6']);
    await page.waitForTimeout(1500);
    restoreServer();
    await online.reconnect();
    const reconnectedAt = Date.now();
    // A real browser raises `online` when the connection returns; the cut here is at the network layer, so the test raises it.
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    // (The page also tries again by itself every few seconds while the server is out of reach.)
    await phaseIs(page, 'working', false);
    await savedIs(page);
    row = rowOf(platform, id);
    const pause = eventsOf(row).at(-1);
    await check('RECONNECTED: the note and the pause reached the server in one go', questionsOf(row)['6']?.note === 'written with no connection' && eventsOf(row).length === eventsOnline + 1 && pause.t === 'pause');
    await check('RECONNECTED: the pause is stamped when the server RECEIVED it, not when it was pressed — offline bought no time',
      pause.at >= reconnectedAt - 250 && pause.at - pressedAt >= 2000, `pressed ${pressedAt}, reconnected ${reconnectedAt}, stamped ${pause.at}`);
    await check('RECONNECTED: the estimate label is gone and the page says saved', await page.locator('[data-desk-estimate-note]').count() === 0 && (await page.locator('[data-save-state]').textContent()) === en['shell.saved']);

    // ── close the paper, once ──────────────────────────────────────────────
    await page.locator('[data-desk-close]').click();
    const sheet = page.locator('[data-testid="desk-close-sheet"]');
    await sheet.waitFor({ timeout: 5000 });
    await check('Close paper asks first, and says nothing is marked or sent for checking',
      (await sheet.textContent()).includes(en['desk.closeBody']) && await sheet.getByRole('button', { name: en['desk.close'] }).count() === 1 && !/submit/i.test(await sheet.textContent()));
    await page.keyboard.press('Escape');
    await check('Esc keeps the paper open', await page.locator('[role="dialog"]').count() === 0 && rowOf(platform, id).state !== 'finished');
    await page.locator('[data-desk-close]').click();
    await sheet.locator('[data-sheet-confirm]').click();
    await phaseIs(page, 'finished');
    await page.locator('[data-desk-closed]').waitFor({ timeout: 10000 });
    row = rowOf(platform, id);
    await check('CLOSED: the server recorded one finish, by the student', row.state === 'finished' && eventsOf(row).filter(e => e.t === 'finish').length === 1 && Number(row.finished_at) > 0);
    // A second close (a double tap, a second tab): the server answers that it is closed and writes nothing.
    const again = await page.evaluate(async ([attemptId, rev]) => {
      const csrf = document.cookie.split('; ').find(c => c.startsWith('pri_csrf='))?.split('=')[1] || '';
      const r = await fetch(`/v1/desk/attempts/${attemptId}/clock`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json', 'X-Pri-CSRF': decodeURIComponent(csrf), 'X-Pri-Client': 'web-v1' }, body: JSON.stringify({ intent: 'finish', rev }) });
      return { status: r.status, code: (await r.json())?.error?.code };
    }, [id, Number(row.rev)]);
    await check('CLOSED TWICE: the second close is refused as already closed, and there is still one finish', again.status === 409 && again.code === 'DESK_FINISHED' && eventsOf(rowOf(platform, id)).filter(e => e.t === 'finish').length === 1, JSON.stringify(again));
    const second = await ctx.newPage();
    await second.goto(`${base}/desk/${id}`, { waitUntil: 'domcontentloaded' });
    await second.locator('[data-desk-closed]').waitFor({ timeout: 30000 });
    await check('a second tab opens the same paper closed, with no way to close or restart it', await second.locator('[data-desk-close], [data-desk-intent]').count() === 0);
    await second.close();

    // ── the closed view: a record, never a result ──────────────────────────
    await plateOn('closed');
    await noMarkOn('the closed paper');
    await atEverySize(page, check, 'closed');
    const closedText = await deskText(page);
    await check('CLOSED: it says in plain words that nothing was marked', saysUnmarked(closedText, 'en') && closedText.includes(en['desk.closedLead']));
    await check('CLOSED: the ledger states the time used against the three hours, the overtime and the pause — figures only',
      /03:0\d:\d\d of 03:00:00/.test(closedText) && closedText.includes(en['desk.ledgerOver']) && closedText.includes(en['desk.ledgerPaused']), closedText.slice(0, 500));
    await check('CLOSED: and the student\'s own counts', (await page.locator('[data-desk-tallies]').textContent()) === fill(en['desk.tallies'], { done: 1, flagged: 1, notes: 3 }));
    await page.locator('[data-desk-next-flagged]').click();
    await check('"Next flagged question" goes to the flag', await page.locator('[data-desk-question]').getAttribute('data-desk-question') === '3');
    await page.locator('textarea[data-notes-for="3"]').fill('check the domain — done in review');
    await savedIs(page);
    await check('notes stay editable after closing, and are saved', questionsOf(rowOf(platform, id))['3']?.note === 'check the domain — done in review' && rowOf(platform, id).state === 'finished');

    // ── nothing was marked, anywhere ───────────────────────────────────────
    await online.settled();
    const session = online.calls.slice(callsFrom);
    const strays = strayCalls(session);
    await check('NO MARKING: across the whole sitting no request went to the marked papers, practice, the reader or the tutor (the shell\'s review-queue badge read apart)',
      strays.length === 0 && session.some(c => c.path.startsWith('/v1/desk')), JSON.stringify([...new Set(strays.map(c => `${c.method} ${c.path}`))]));
    await check('NO MARKING: every desk reply said mode: unmarked, and none carried a result field',
      session.filter(c => c.path.startsWith('/v1/desk') && c.status < 300 && c.json).every(c => c.json.mode === 'unmarked' && !/"(score|awarded|pct|correct|result|grade|marksEarned|outcome)"\s*:/.test(JSON.stringify(c.json))));
    await check('NO MARKING: the server holds no learning event and no exam or practice receipt for this sitting',
      JSON.stringify(markingFootprint(platform, account.id)) === JSON.stringify(footprintBefore), `${JSON.stringify(footprintBefore)} → ${JSON.stringify(markingFootprint(platform, account.id))}`);
    const deviceAfter = await deviceLearning(page);
    await check('NO MARKING: the device\'s XP, streak days, mastery ratings, attempts and papers are exactly as they were',
      !!deviceBefore && JSON.stringify(deviceAfter) === JSON.stringify(deviceBefore), JSON.stringify(Object.keys(deviceBefore || {})));
    await check('the desk kept its cache in its own database, with one record: this attempt, for this account',
      JSON.stringify((await cacheRows(page)).map(r => [r.key, r.accountId])) === JSON.stringify([[`desk:v1:${account.id}:${id}`, account.id]]));

    // ── again, and delete ──────────────────────────────────────────────────
    await page.locator('[data-desk-again]').click();
    await page.waitForFunction(old => { const el = document.querySelector('[data-desk-attempt]'); return !!el && el.getAttribute('data-desk-attempt') !== old && el.getAttribute('data-desk-phase') === 'idle'; }, id, { timeout: 20000 });
    const fresh = await attemptIdOf(page);
    await check('"Practise this paper again" is a new attempt; the closed one is unchanged',
      fresh !== id && rowsOf(platform, account.id).length === 2 && rowOf(platform, id).state === 'finished' && Object.keys(questionsOf(rowOf(platform, fresh))).length === 0);
    await page.locator('[data-desk-delete]').click();
    await page.locator('[data-testid="desk-delete-sheet"] [data-sheet-confirm]').click();
    await page.waitForURL(new RegExp(`/library/${PAPER}$`), { timeout: 20000 });
    await check('Delete, once confirmed, removes that attempt from the account and nothing else', !rowOf(platform, fresh) && !!rowOf(platform, id));
    await page.locator('[data-desk-entry] .dk-history li').first().waitFor({ timeout: 20000 });
    await check('the library paper lists the closed attempt with its time and counts, and offers a new start',
      await page.locator('.dk-history li').count() === 1 && await page.locator('[data-desk-start]').count() === 1);
    await noMarkOn('the attempt list');
  }
};

// ── 2 · the import ───────────────────────────────────────────────────────────

const fileOf = (name, value) => ({ name, mimeType: 'application/json', buffer: Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)) });

export const flowImport = {
  id: 'exam-desk-import',
  name: 'Exam desk · import from the Prithagoras website: nothing stored without the press; the same file twice is one record; tampered and other-edition files refused',
  online: true,
  // No service worker between the page and the server: every request is seen, and the offline cut is the same in both engines.
  inspectNetwork: true,

  async run({ page, base, check, goto, createProfile, online }) {
    const platform = await onlinePlatform();
    offerPaper(platform);
    await goto('/');
    await createProfile({ name: 'Import Student', year: 11 });
    const account = await online.signIn({ name: 'Import Student' });
    await online.settled();
    const callsFrom = online.calls.length;
    const posts = async (path) => { await online.settled(); return online.calls.filter(c => c.method === 'POST' && c.path === path); };
    const choose = async (file) => { await page.locator('#dk-import-file').setInputFiles(file); };

    // ── nothing happens by itself ──────────────────────────────────────────
    await page.goto(`${base}/desk/import?export=${encodeURIComponent(JSON.stringify(FIXTURE).slice(0, 400))}#${PAPER}`, { waitUntil: 'domcontentloaded' });
    await page.locator('#dk-import-file').waitFor({ timeout: 30000 });
    await page.evaluate(file => { window.postMessage({ bundleVersion: 1, exports: [file] }, '*'); window.postMessage(file, '*'); }, FIXTURE);
    await page.waitForTimeout(1200);
    await check('NO SILENT IMPORT: opening the page with an export in the address and a message from a window stores nothing and asks the server nothing',
      rowsOf(platform, account.id).length === 0 && (await posts('/v1/desk/import')).length === 0 && (await posts('/v1/desk/import/preview')).length === 0);
    await check('the import page says it is unmarked practice', (await page.locator('[data-desk-unmarked]').textContent()) === en['desk.unmarked']);

    // ── preview, cancel ────────────────────────────────────────────────────
    await choose(fileOf('prithagoras-attempt.json', FIXTURE));
    await page.locator('[data-import-preview]').waitFor({ timeout: 20000 });
    await check('PREVIEW: the paper, 4 done · 2 flagged · 3 with notes, and that the timer is not brought across',
      (await page.locator('[data-import-tallies]').textContent()) === fill(en['desk.tallies'], { done: 4, flagged: 2, notes: 3 }) && (await page.locator('[data-import-preview]').textContent()).includes(en['desk.previewTimer']) &&
        (await page.locator('.dk-preview-paper').textContent()) === FIXTURE.resource.title);
    await atEverySize(page, check, 'import preview');
    await check('PREVIEW: nothing is stored yet', rowsOf(platform, account.id).length === 0 && (await posts('/v1/desk/import')).length === 0 && (await posts('/v1/desk/import/preview')).length === 1);
    await page.locator('[data-import-cancel]').click();
    await page.locator('#dk-import-file').waitFor({ timeout: 5000 });
    await check('CANCEL: stores nothing', rowsOf(platform, account.id).length === 0 && (await posts('/v1/desk/import')).length === 0);

    // ── add ────────────────────────────────────────────────────────────────
    await choose(fileOf('prithagoras-attempt.json', FIXTURE));
    await page.locator('[data-import-add]').click();
    await page.waitForURL(/\/desk\/[0-9a-f-]{36}$/, { timeout: 20000 });
    await page.locator('[data-desk-closed="imported"]').waitFor({ timeout: 20000 });
    const first = await attemptIdOf(page);
    let rows = rowsOf(platform, account.id);
    await check('ADD: one finished record, from the import, with the statuses and notes and NO timer',
      rows.length === 1 && rows[0].id === first && rows[0].origin === 'prithagoras-import' && rows[0].state === 'finished' && rows[0].mode === 'unmarked' && eventsOf(rows[0]).length === 0 &&
        questionsOf(rows[0])['3']?.flagged === true && questionsOf(rows[0])['1']?.done === true && /substitution/.test(questionsOf(rows[0])['14']?.note || '') && !rows[0].clock_json.includes('4360'),
      JSON.stringify(rows.map(r => ({ origin: r.origin, state: r.state }))));
    const importedText = await deskText(page);
    await check('the imported attempt opens closed, says the timer was not brought across, and shows no sitting time or mark',
      importedText.includes('The timer was not brought across') && !/\d\d:\d\d:\d\d of/.test(importedText) && markWording(importedText).length === 0 && await resultFurniture(page) === 0, importedText.slice(0, 300));
    await page.locator('.xs-nav button[data-q="14"]').click();
    await check('its notes are there to read and edit', /substitution/.test(await page.locator('textarea[data-notes-for="14"]').inputValue()));

    // ── the same file again ────────────────────────────────────────────────
    await page.goto(`${base}/desk/import`, { waitUntil: 'domcontentloaded' });
    await page.locator('#dk-import-file').waitFor({ timeout: 30000 });
    await choose(fileOf('prithagoras-attempt-copy.json', FIXTURE));
    await page.locator('[data-import-already]').waitFor({ timeout: 20000 });
    await page.locator('[data-import-add]').click();
    await page.waitForURL(/\/desk\/[0-9a-f-]{36}$/, { timeout: 20000 });
    await page.locator('[data-desk-closed="imported"]').waitFor({ timeout: 20000 });
    const replies = await posts('/v1/desk/import');
    await check('IMPORT TWICE: the preview says it is already here, and adding it again is the SAME record — still one row',
      await attemptIdOf(page) === first && rowsOf(platform, account.id).length === 1 && replies.length === 2 && replies[0].status === 201 && replies[1].status === 200 && replies[1].json?.replayed === true,
      JSON.stringify(replies.map(r => [r.status, r.json?.replayed])));

    // ── a different export of the same paper ───────────────────────────────
    await page.goto(`${base}/desk/import`, { waitUntil: 'domcontentloaded' });
    await page.locator('#dk-import-file').waitFor({ timeout: 30000 });
    await choose(fileOf('later.json', { ...FIXTURE, statuses: { ...FIXTURE.statuses, 20: 'done' } }));
    await page.locator('[data-import-earlier]').waitFor({ timeout: 20000 });
    await page.locator('[data-import-add]').click();
    await page.waitForURL(/\/desk\/[0-9a-f-]{36}$/, { timeout: 20000 });
    await page.locator('[data-desk-closed="imported"]').waitFor({ timeout: 20000 });
    rows = rowsOf(platform, account.id);
    await check('A LATER EXPORT: a second record; the first is unchanged', rows.length === 2 && await attemptIdOf(page) !== first && !questionsOf(rowOf(platform, first))['20']);

    // ── refused ────────────────────────────────────────────────────────────
    const refusedWith = async (file, code) => {
      await page.goto(`${base}/desk/import`, { waitUntil: 'domcontentloaded' });
      await page.locator('#dk-import-file').waitFor({ timeout: 30000 });
      const before = (await posts('/v1/desk/import')).length;
      await choose(file);
      await page.locator('[data-import-refused]').waitFor({ timeout: 20000 });
      return await page.locator('[data-import-refused]').getAttribute('data-import-refused') === code && await page.locator('[data-import-add]').count() === 0 &&
        (await posts('/v1/desk/import')).length === before && rowsOf(platform, account.id).length === 2;
    };
    await check('TAMPERED: a status of "correct" is refused — the file can only say done or flagged', await refusedWith(fileOf('tampered.json', { ...FIXTURE, statuses: { ...FIXTURE.statuses, 4: 'correct' } }), 'DESK_IMPORT_MALFORMED'));
    await check('TAMPERED: a file with a result field and nothing else is refused as empty', await refusedWith(fileOf('made-up.json', { ...FIXTURE, statuses: {}, notes: {}, result: { awarded: 71, total: 100 } }), 'DESK_IMPORT_EMPTY'));
    await check('NOT A DESK FILE: text that is not JSON is refused', await refusedWith(fileOf('notes.json', 'These are my notes, not an export.'), 'DESK_IMPORT_NOT_A_DESK_FILE'));
    await check('ANOTHER VERSION is refused', await refusedWith(fileOf('v2.json', { ...FIXTURE, exportVersion: 2 }), 'DESK_IMPORT_VERSION'));
    // TEST DESK: a published paper the OTHER edition's library offers and this one does not.
    const seed = platform.h.db.prepare('SELECT * FROM resources WHERE id=?').get(PAPER);
    const columns = Object.keys(seed);
    platform.h.db.prepare(`INSERT OR IGNORE INTO resources(${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`).run(...columns.map(c => (c === 'id' ? 'other-edition-paper' : seed[c])));
    platform.h.db.prepare('INSERT OR IGNORE INTO resource_editions(resource_id, edition) VALUES (?, ?)').run('other-edition-paper', OTHER_EDITION);
    await check('THE OTHER EDITION\'S PAPER is refused exactly like a paper that does not exist',
      await refusedWith(fileOf('other.json', { ...FIXTURE, resource: { ...FIXTURE.resource, id: 'other-edition-paper' } }), 'DESK_IMPORT_UNKNOWN_PAPER') &&
        await refusedWith(fileOf('none.json', { ...FIXTURE, resource: { ...FIXTURE.resource, id: 'no-such-paper-anywhere' } }), 'DESK_IMPORT_UNKNOWN_PAPER'));
    await online.settled();
    await check('NO MARKING: the import made no learning event, and no request left the desk and library routes for a marking route',
      markingFootprint(platform, account.id).learningEvents === 0 && strayCalls(online.calls.slice(callsFrom)).length === 0 &&
        online.calls.filter(c => c.path.startsWith('/v1/desk') && c.status < 300 && c.json).every(c => c.json.mode === 'unmarked'),
      JSON.stringify([...new Set(strayCalls(online.calls.slice(callsFrom)).map(c => `${c.method} ${c.path}`))]));
  }
};

// ── 3 · in Hindi ─────────────────────────────────────────────────────────────

export const flowHindi = {
  id: 'exam-desk-hindi',
  name: 'Exam desk · in Hindi: reading time ends while away; the closed desk says it is unmarked and carries no mark wording',
  online: true,
  // No service worker between the page and the server: every request is seen, and the offline cut is the same in both engines.
  inspectNetwork: true,

  async run({ page, base, check, goto, createProfile, online }) {
    if (EDITION !== 'priyabhata') { await check('Hindi is a Priyabhata language; this edition runs the desk in English only', true); return; }
    const platform = await onlinePlatform();
    offerPaper(platform);
    await goto('/');
    await createProfile({ name: 'Hindi Desk Student', year: 10, language: 'hi' });
    await online.signIn({ name: 'Hindi Desk Student' });
    const id = await startFromLibrary({ page, base });
    await check('the document is declared Hindi and the plate is in Hindi', await page.evaluate(() => document.documentElement.lang) === 'hi' && (await page.locator('[data-desk-unmarked]').first().textContent()) === hi['desk.unmarked']);
    await page.locator('[data-desk-intent="begin-reading"]').click();
    await phaseIs(page, 'reading', true);
    await setVisibility(page, 'hidden');
    // TEST DESK: eleven minutes pass on the server's record.
    agePaper(platform, id, 11 * MIN);
    await page.waitForTimeout(700);
    await setVisibility(page, 'visible');
    await phaseIs(page, 'ready', false);
    await page.waitForFunction(text => document.querySelector('[data-shell-announce]')?.textContent === text, hi['desk.sayReadingEndedAway'], { timeout: 10000 }).catch(() => {});
    await check('READING ENDED WHILE AWAY: the desk is ready, working time has not started by itself, and it says so once, in Hindi',
      (await announced(page)) === hi['desk.sayReadingEndedAway'] && (await page.locator('[data-desk-ready]').textContent()) === hi['desk.readyLine'] && eventsOf(rowOf(platform, id)).length === 1,
      JSON.stringify(await announced(page)));
    await page.locator('[data-desk-intent="begin-working"]').click();
    await phaseIs(page, 'working', true);
    const log = eventsOf(rowOf(platform, id));
    await check('starting working time records when reading actually ended, then the start', log.map(e => e.t).join() === 'begin-reading,reading-ended,begin-working' && log[1].at - log[0].at === 10 * MIN, JSON.stringify(log));
    await page.locator('.xs-nav button[data-q="2"]').click();
    await page.locator('textarea[data-notes-for="2"]').fill('हल की जाँच करें');
    await page.locator('[data-desk-flag]').click();
    await page.locator('[data-desk-close]').click();
    await page.locator('[data-testid="desk-close-sheet"] [data-sheet-confirm]').click();
    await phaseIs(page, 'finished');
    await page.locator('[data-desk-closed]').waitFor({ timeout: 10000 });
    const text = await deskText(page);
    const found = markWording(text, 'hi');
    await check('HINDI: the closed desk carries no mark, score, percentage, band or result wording', found.length === 0 && await resultFurniture(page) === 0, `${JSON.stringify(found)} in ${JSON.stringify(text.slice(0, 300))}`);
    await check('HINDI: and says in plain words that no marks are given', saysUnmarked(text, 'hi') && text.includes(hi['desk.closedLead']));
    const english = ['Practice · not marked', 'Paper closed', 'Close paper', 'Working time', 'Reading time', 'Saved to your account', 'Notes for question', 'Question 2'].filter(s => text.includes(s));
    await check('HINDI: none of the desk\'s English falls back onto the screen', english.length === 0, english.join(' · '));
    await check('HINDI: the navigator names the question in Hindi', await page.locator('.xs-nav button[data-q="2"]').getAttribute('aria-label') === [fill(hi['shell.q'], { n: 2 }), hi['shell.qFlagged'], hi['shell.qNoted'], hi['shell.qCurrent']].join(', '));
  }
};

export const flows = [flowSitting, flowImport, flowHindi];

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne, runFlows, ensureBuild } = await import('./e2e.mjs');
  const argv = process.argv.slice(2).filter(a => a !== '--no-build');
  const prior = { library: process.env.PRI_FEATURE_LIBRARY, desk: process.env.PRI_FEATURE_EXAM_DESK };
  const restore = () => { for (const [k, v] of [['PRI_FEATURE_LIBRARY', prior.library], ['PRI_FEATURE_EXAM_DESK', prior.desk]]) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } };
  // The flags are build-time constants, so each state gets its own build:
  // the library on and the desk off (dark), then both on.
  process.env.PRI_FEATURE_LIBRARY = '1';
  process.env.PRI_FEATURE_EXAM_DESK = '0';
  const darkFailed = await runOne(flowDark, argv);
  await closeOnlinePlatform();
  process.env.PRI_FEATURE_EXAM_DESK = '1';
  const failed = await runFlows(flows, argv);
  // Leave client/dist as the suite's other tours expect it.
  restore();
  ensureBuild(true);
  process.exit(darkFailed || failed ? 1 : 0);
}
