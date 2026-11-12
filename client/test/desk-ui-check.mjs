// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the exam shell and the Exam Desk, as drawn (plan F4b)
//
// client/src/examShell (the pieces both modes of the examination system
// share) and client/src/desk (the unmarked mode), rendered and driven in Node:
//
//   1 · the navigator: one button per question, grouped by section, each
//       named "Question 7, flagged, has a note, current" (English and Hindi),
//       one tab stop, arrows move inside the grid;
//   2 · shortcuts do nothing while the student is typing or holds a modifier;
//   3 · the clock face COMPUTES NOTHING: it prints what it is given;
//   4 · notes, sheets and the paper header say what they must;
//   5 · autosave: debounced, one request at a time in order, urgent when the
//       page hides, honest about a failed save;
//   6 · the desk's state rules: edits, the save merge (a stale note), the
//       offline projection that can never buy time, the time ledger;
//   7 · EVERY DESK SCREEN SAYS IT IS UNMARKED, and none carries mark, score,
//       percentage or band wording (support/no-mark-wording.mjs), in both
//       languages; a reply that is not `mode: 'unmarked'` is refused;
//   8 · the import: read on the device, every refusal named, no storing
//       without the press;
//   9 · wiring: the desk's own routes only, dark behind PRI_FEATURE_EXAM_DESK
//       (which needs the library flag), out of the install, and the marked
//       exam room untouched.
//
//   node client/test/desk-ui-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { markWording, saysUnmarked, textOfMarkup } from './support/no-mark-wording.mjs';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
const root = fileURLToPath(new URL('..', import.meta.url));
const read = rel => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const code = rel => read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const { featureStates, PENDING_FEATURE_FLAGS, ON_DEMAND, CHUNK_GROUPS } = await import('../vite.config.js');
const { createServer } = await import('vite');
const react = (await import('@vitejs/plugin-react')).default;
const React = (await import('react')).default;
const { renderToStaticMarkup } = await import('react-dom/server');
const { MemoryRouter } = await import('react-router-dom');
const clockEngine = await import('../src/engine/deskClock.js');
const FIXTURE = JSON.parse(read('test/fixtures/prithagoras-desk-export-v1.synthetic.json'));
const server = await createServer({
  root, configFile: false, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true },
  plugins: [react()], define: { __PRI_FEATURE_TUTOR__: 'false', __PRI_PRODUCTION_BUILD__: 'false' }
});
const h = React.createElement;
// React's note that a router's layout effect does not run in a server render is true and beside the point here.
const realError = console.error;
console.error = (...args) => { if (!String(args[0]).includes('useLayoutEffect does nothing on the server')) realError(...args); };
const draw = el => renderToStaticMarkup(h(MemoryRouter, null, el));
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');

const PAPER = clockEngine.paperConfigOf({
  id: 'sample-paper', title: 'Sample paper', questionCount: 27, marks: 100, durationMinutes: 180, readingMinutes: 10, updatedAt: 1,
  sections: [{ label: 'Section I', firstQuestion: 1, lastQuestion: 10, kind: 'multiple-choice', marks: 10 }, { label: 'Section II', firstQuestion: 11, lastQuestion: 27, kind: 'extended-response', marks: 90 }]
});
const T0 = 1_800_000_000_000;
const MIN = 60000;

try {
  const i18n = await server.ssrLoadModule('/src/i18n/index.js');
  const nav = await server.ssrLoadModule('/src/examShell/QuestionNavigator.jsx');
  const keys = await server.ssrLoadModule('/src/examShell/useExamShortcuts.js');
  const face = await server.ssrLoadModule('/src/examShell/ClockFace.jsx');
  const notes = await server.ssrLoadModule('/src/examShell/QuestionNotes.jsx');
  const sheets = await server.ssrLoadModule('/src/examShell/ConfirmSheet.jsx');
  const keySheet = await server.ssrLoadModule('/src/examShell/ShortcutsSheet.jsx');
  const header = await server.ssrLoadModule('/src/examShell/PaperHeader.jsx');
  const autosave = await server.ssrLoadModule('/src/examShell/useAutosave.js');
  const state = await server.ssrLoadModule('/src/desk/deskState.js');
  const api = await server.ssrLoadModule('/src/desk/deskApi.js');
  const cache = await server.ssrLoadModule('/src/desk/deskCache.js');
  const page = await server.ssrLoadModule('/src/desk/DeskPage.jsx');
  const entry = await server.ssrLoadModule('/src/desk/DeskEntry.jsx');
  const importer = await server.ssrLoadModule('/src/desk/DeskImport.jsx');
  const en = (await server.ssrLoadModule('/src/i18n/strings.en.js')).default;

  // ── 1 · The navigator ─────────────────────────────────────────────────────
  const groups = state.groupsOf(PAPER, kind => kind, 'Questions');
  eq(groups.map(g => [g.label, g.start, g.end]), [['Section I', 1, 10], ['Section II', 11, 27]], 'the navigator is grouped by the paper\'s sections');
  eq(state.groupsOf({ questionCount: 5, sections: [] }, () => '', 'Questions').map(g => [g.label, g.start, g.end]), [['Questions', 1, 5]], 'a paper with no sections is one group');
  const stateOf = q => ({ done: q === 3, flagged: q === 7, noted: q === 7 || q === 12 });
  for (const lang of ['en', 'hi']) {
    await i18n.setLanguage(lang);
    const t = (key, vars) => i18n.translate(key, vars);
    const html = draw(h(nav.default, { groups, current: 7, stateOf, onSelect() {} }));
    eq((html.match(/<button/g) || []).length, 27, `${lang}: one button per question`);
    const label7 = [t('shell.q', { n: 7 }), t('shell.qFlagged'), t('shell.qNoted'), t('shell.qCurrent')].join(', ');
    ok(html.includes(`aria-label="${esc(label7)}"`), `${lang}: the current flagged question with a note is named "${label7}"`);
    ok(html.includes(`aria-label="${esc([t('shell.q', { n: 3 }), t('shell.qDone')].join(', '))}"`), `${lang}: a done question says so`);
    ok(html.includes(`aria-label="${esc(t('shell.q', { n: 1 }))}"`), `${lang}: an untouched question is only its number`);
    eq((html.match(/aria-current="true"/g) || []).length, 1, `${lang}: exactly one question is aria-current`);
    eq([(html.match(/tabindex="0"/g) || []).length, (html.match(/tabindex="-1"/g) || []).length], [1, 26], `${lang}: one tab stop (roving tabindex)`);
    ok(html.includes(`aria-label="${esc(t('shell.questions'))}"`) && html.includes('role="group"') && html.includes('Section II'), `${lang}: a labelled navigation landmark with labelled groups`);
  }
  await i18n.setLanguage('en');
  const t = (key, vars) => i18n.translate(key, vars);
  eq(nav.questionLabel(t, 7, { flagged: true, noted: true }, true), 'Question 7, flagged, has a note, current', 'the label composition, exactly');
  eq(nav.questionLabel(t, 2, { done: true, flagged: true }, false), 'Question 2, done, flagged', 'done and flagged are independent, and both are said');
  // A 5-wide grid of 12 buttons.
  const boxes = Array.from({ length: 12 }, (_, i) => ({ top: Math.floor(i / 5) * 50, left: (i % 5) * 50 }));
  eq([nav.rovingTarget('ArrowRight', 0, boxes), nav.rovingTarget('ArrowLeft', 0, boxes), nav.rovingTarget('ArrowRight', 11, boxes)], [1, 0, 11], 'left and right move one question and stop at the ends');
  eq([nav.rovingTarget('ArrowDown', 1, boxes), nav.rovingTarget('ArrowUp', 6, boxes), nav.rovingTarget('ArrowDown', 8, boxes), nav.rovingTarget('ArrowUp', 2, boxes)], [6, 1, 11, 2], 'up and down move by the row the buttons wrap into');
  eq([nav.rovingTarget('Home', 7, boxes), nav.rovingTarget('End', 7, boxes), nav.rovingTarget('a', 7, boxes)], [0, 11, null], 'Home, End, and any other key is left alone');

  // ── 2 · Shortcuts ─────────────────────────────────────────────────────────
  const map = { ArrowLeft: () => 'left', d: () => 'done', '?': () => 'help' };
  const event = (key, target = { tagName: 'BODY' }, extra = {}) => ({ key, target, ...extra });
  eq([keys.shortcutFor(event('d'), map)?.(), keys.shortcutFor(event('D'), map)?.(), keys.shortcutFor(event('ArrowLeft'), map)?.(), keys.shortcutFor(event('?'), map)?.()], ['done', 'done', 'left', 'help'], 'a shortcut runs on its key, in either case');
  for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT', 'textarea']) ok(keys.shortcutFor(event('d', { tagName }), map) === null, `typing in a ${tagName.toLowerCase()} is never a shortcut`);
  ok(keys.shortcutFor(event('d', { tagName: 'DIV', isContentEditable: true }), map) === null, 'typing in an editable region is never a shortcut');
  for (const mod of ['altKey', 'ctrlKey', 'metaKey']) ok(keys.shortcutFor(event('d', { tagName: 'BODY' }, { [mod]: true }), map) === null, `${mod} + a key is the browser's, not a shortcut`);
  ok(keys.shortcutFor(event('ArrowLeft', { tagName: 'BUTTON' }, { defaultPrevented: true }), map) === null, 'a key the navigator already handled is not also a shortcut');
  ok(keys.shortcutFor(event('x'), map) === null && keys.shortcutFor(event('constructor'), map) === null && keys.shortcutFor(event('toString'), map) === null, 'an unmapped key (or an inherited property name) does nothing');

  // ── 3 · The clock face computes nothing ──────────────────────────────────
  const faceSource = code('src/examShell/ClockFace.jsx');
  for (const [what, re] of [['the device clock', /\bDate\b/], ['a timer', /set(Interval|Timeout)|requestAnimationFrame/], ['the clock\'s derivation', /deriveClock|applyIntent|phaseEndsAt|deadline/], ['state or an effect', /use(State|Effect|Ref|Memo)\b/]]) {
    ok(!re.test(faceSource), `ClockFace.jsx holds no ${what}`);
  }
  const shown = draw(h(face.default, { remainingMs: 252_000, label: 'Reading time' }));
  ok(shown.includes('00:04:12') && shown.includes('role="timer"') && shown.includes('aria-live="off"') && shown.includes('aria-label="Reading time 00:04:12"'), 'it prints the time it is given, as a timer that never interrupts');
  ok(draw(h(face.default, { remainingMs: 251_001, label: 'x' })).includes('00:04:12') && draw(h(face.default, { remainingMs: 0, label: 'x' })).includes('00:00:00'), 'rounded up to the second shown, never below zero');
  const overtime = draw(h(face.default, { remainingMs: 0, overtimeMs: 252_000, label: 'Working time', note: 'over time' }));
  ok(overtime.includes('+00:04:12') && overtime.includes('over time') && overtime.includes('is-over'), 'past the allotment it shows the overtime it is given, with a plus');
  const hiddenFace = draw(h(face.default, { remainingMs: 252_000, label: 'Working time', hidden: true, onToggle() {} }));
  ok(!hiddenFace.includes('00:04:12') && hiddenFace.includes(t('shell.clockHidden')) && hiddenFace.includes(`aria-label="${esc(t('shell.clockShow'))}"`), 'a hidden clock shows no figures, says it is hidden, and its button is named "Show the clock"');
  ok(draw(h(face.default, { remainingMs: 1, label: 'x', onToggle() {} })).includes(`aria-label="${esc(t('shell.clockHide'))}"`), 'a shown clock\'s button is named "Hide the clock", not the running time');
  const rule = draw(h(face.ElapsedRule, { fraction: 0.25 }));
  ok(rule.includes('aria-hidden="true"') && rule.includes('width:25%'), 'the elapsed rule is decorative and as long as the fraction it is given');
  ok(draw(h(face.ElapsedRule, { fraction: 7 })).includes('width:100%') && draw(h(face.ElapsedRule, { fraction: -1 })).includes('width:0%'), 'and never longer than the bar or shorter than nothing');

  // ── 4 · Notes, sheets, the paper header ──────────────────────────────────
  const noteHtml = draw(h(notes.default, { q: 3, text: 'check the domain', onText() {} }));
  ok(noteHtml.includes(`for="xs-notes-3"`) && noteHtml.includes('id="xs-notes-3"') && noteHtml.includes(esc(t('shell.notesFor', { n: 3 }))), 'the note has a visible label naming its question');
  ok(noteHtml.includes('maxLength="5000"') && noteHtml.includes('check the domain') && notes.NOTE_LIMIT === clockEngine.NOTE_MAX, 'typed text, at most the server\'s 5,000 characters');
  ok(noteHtml.includes(esc(t('shell.notesHint'))) && !/characters left/.test(noteHtml), 'it says nothing reads the notes, and counts characters only near the limit');
  ok(draw(h(notes.default, { q: 3, text: 'x'.repeat(4990), onText() {} })).includes(esc(t('shell.notesLeft', { count: 10, n: 10 }))), 'near the limit it says how many characters are left');
  ok(!/onInk|InkCanvas|ink\//.test(code('src/examShell/QuestionNotes.jsx')), 'notes are typed only: no ink in this mission');
  const confirm = draw(h(sheets.default, { open: true, title: 'Close this paper?', confirmLabel: 'Close paper', cancelLabel: 'Keep going', onConfirm() {}, onCancel() {} }, h('p', null, 'facts')));
  ok(/role="dialog"/.test(confirm) && /aria-modal="true"/.test(confirm) && /aria-labelledby="([^"]+)"[\s\S]*<h2 id="\1">Close this paper\?<\/h2>/.test(confirm), 'the confirm sheet is a labelled modal dialog');
  ok(confirm.indexOf('Keep going</button>') < confirm.indexOf('Close paper</button>') && confirm.includes('facts'), 'the button that changes nothing comes first (it takes the focus)');
  eq(draw(h(sheets.default, { open: false, title: 'x', confirmLabel: 'a', cancelLabel: 'b', onConfirm() {}, onCancel() {} })), '', 'a closed sheet draws nothing');
  const keysHtml = draw(h(keySheet.default, { open: true, onClose() {}, shortcuts: [{ keys: ['←', '→'], label: 'Previous or next question' }, { keys: ['D'], label: 'Done, on or off' }] }));
  ok(keysHtml.includes('<kbd>←</kbd><kbd>→</kbd>') && keysHtml.includes('Done, on or off') && keysHtml.includes(esc(t('shell.shortcutsNote'))), 'the shortcut sheet lists each key and says shortcuts wait while typing');
  const head = draw(h(header.default, { title: 'A paper', source: 'Somewhere', attribution: 'By someone', disclaimer: 'Not official.', link: 'https://example.org/p', linkLabel: 'Open the paper' }));
  ok(['A paper', 'Somewhere · By someone', 'Not official.'].every(v => head.includes(v)) && head.includes('rel="noopener noreferrer"') && head.includes('target="_blank"'), 'the paper header shows the source, attribution and disclaimer, and opens the paper safely');

  // ── 5 · Autosave ─────────────────────────────────────────────────────────
  {
    const timers = [];
    const states = [];
    const sent = [];
    let release = null;
    let fail = false;
    let more = 0;
    const saver = autosave.createAutosave({
      debounceMs: 600, onState: s => states.push(s),
      setTimer: (fn, ms) => { const id = { fn, ms }; timers.push(id); return id; },
      clearTimer: id => { const i = timers.indexOf(id); if (i >= 0) timers.splice(i, 1); },
      send: async (options) => {
        sent.push(options);
        if (release) await release;
        if (fail) throw new Error('offline');
        return more-- > 0 ? { more: true } : undefined;
      }
    });
    saver.schedule(); saver.schedule(); saver.schedule();
    eq([timers.length, timers[0]?.ms, sent.length, states.at(-1)], [1, 600, 0, 'saving'], 'three edits are one pending save 600 ms out, and an unsaved change never reads as saved');
    timers.shift().fn();
    await saver.settled();
    eq([sent.length, sent[0], states.at(-1)], [1, { urgent: false, reason: 'change' }, 'saved'], 'the debounce fires one save; then it says saved');
    // One at a time, in order: the second waits for the first.
    let open;
    release = new Promise(r => { open = r; });
    saver.flush(false, 'a'); saver.flush(true, 'hidden');
    await Promise.resolve(); await Promise.resolve();
    eq(sent.length, 2, 'a second save does not start while the first is in flight');
    open(); release = null;
    await saver.settled();
    eq([sent.length, sent[1].reason, sent[2]], [3, 'a', { urgent: true, reason: 'hidden' }], 'saves run in the order they were asked for, and a hidden page\'s save is urgent');
    fail = true;
    await saver.flush();
    eq(states.at(-1), 'unsaved', 'a save that could not be sent says so (not saved — kept on this device)');
    fail = false; more = 1;
    const before = sent.length;
    await saver.flush();
    await saver.settled();
    eq([sent.length - before, states.at(-1)], [2, 'saved'], 'a save that reports more to send is called again at once');
    // A slow network: many triggers while one save is in flight are ONE waiting save, not a backlog.
    let unblock;
    release = new Promise(r => { unblock = r; });
    const backlog = sent.length;
    for (let i = 0; i < 40; i++) saver.flush(false, 'retry');
    await Promise.resolve(); await Promise.resolve();
    unblock(); release = null;
    await saver.settled();
    eq(sent.length - backlog, 2, 'forty triggers behind a slow save are one save in flight and one waiting — never a burst on recovery');
    saver.schedule(); saver.stop();
    eq(timers.length, 0, 'stopping cancels the pending save');
    // Leaving the page inside the app: what is outstanding is sent at once, once.
    const leaving = [];
    const leaver = autosave.createAutosave({ debounceMs: 600, setTimer: () => 1, clearTimer() {}, send: async o => { leaving.push(o); } });
    leaver.schedule(); leaver.stop({ leave: true }); leaver.flush(); leaver.schedule();
    await leaver.settled();
    eq(leaving, [{ urgent: true, reason: 'leave' }], 'leaving the page sends what is outstanding now (the debounce would never fire), and nothing after');
    // Torn down and set up again without being left (React's development double-mount): saving resumes.
    const again = [];
    const remount = autosave.createAutosave({ debounceMs: 600, setTimer: () => 1, clearTimer() {}, send: async o => { again.push(o.reason); } });
    remount.stop(); remount.start(); await remount.flush(false, 'after'); await remount.settled();
    eq(again, ['after'], 'a saver stopped by a teardown saves again once the page is set up again');
    ok(/saver\.start\(\); return \(\) => saver\.stop/.test(code('src/examShell/useAutosave.js')) && /mounted\.current = true; return \(\) => \{ mounted\.current = false; \}/.test(code('src/desk/DeskPage.jsx')), 'the hook and the page re-arm on every setup, so the development double-mount leaves a working desk');
    eq([autosave.saveStateKey('saving'), autosave.saveStateKey('saved'), autosave.saveStateKey('unsaved'), autosave.saveStateKey('idle')], ['shell.saving', 'shell.saved', 'shell.unsaved', null], 'the status line\'s three sentences');
    const hook = code('src/examShell/useAutosave.js');
    ok(/visibilitychange/.test(hook) && /pagehide/.test(hook) && /'online'/.test(hook) && /setInterval/.test(hook), 'the hook saves when the page hides, returns, reconnects, and on a heartbeat');
  }

  // ── 6 · The desk's state rules ───────────────────────────────────────────
  {
    let s = state.editQuestion({}, {}, '3', { note: 'a' });
    s = state.editQuestion(s.questions, s.pending, '3', { note: 'ab' });
    s = state.editQuestion(s.questions, s.pending, '3', { done: true });
    eq([s.questions['3'], s.pending['3']], [{ done: true, flagged: false, note: 'ab', noteRev: 2, ms: 0 }, { note: 'ab', noteRev: 2, done: true }], 'each edit of a note raises its revision; done is its own field');
    eq(state.changesOf(s.pending), { 3: { done: true, note: 'ab', noteRev: 2 } }, 'a save carries only what changed, a note always with its revision');
    eq(state.editQuestion({ 4: { done: false, flagged: false, note: '', noteRev: 0, ms: 5000 } }, {}, '4', { ms: 3000 }).questions['4'].ms, 5000, 'time on a question only grows');
    eq(state.editQuestion({}, {}, '1', { note: 'x'.repeat(6000) }).questions['1'].note.length, 5000, 'a note is cut at 5,000 characters');
    // Every control character the server's note rule refuses is dropped as it is typed (a pasted vertical tab must not block every later save).
    const controls = Array.from({ length: 32 }, (_, i) => String.fromCharCode(i)).join('') + '\u007f';
    const pasted = state.editQuestion({}, {}, '1', { note: `line one${controls}\u000bline two\ttabbed\nnext` }).questions['1'].note;
    ok(clockEngine.validNote(pasted) && pasted === 'line one\t\n\rline two\ttabbed\nnext'.replace('\r', '\r') && !/[\u000b\u000c\u007f\u0000]/.test(pasted), `a pasted note keeps tabs and line breaks and loses every other control character (${JSON.stringify(pasted)})`);
    eq(state.confirmQuestions({ 1: { note: 'old' }, 2: { done: true } }, { 1: { note: 'new', noteRev: 2 }, 2: null, 5: { flagged: true } }), { 1: { note: 'new', noteRev: 2 }, 5: { flagged: true } }, 'a confirmed save becomes part of the kept copy of the attempt (so an offline reload still has it)');
    // Confirmed by the server.
    const sent = state.changesOf(s.pending);
    const confirmed = state.settleSave(s.questions, s.pending, sent, { stale: [], questions: { 3: { done: true, flagged: false, note: 'ab', noteRev: 2, ms: 0 } } });
    eq([confirmed.pending, confirmed.questions['3'].note], [{}, 'ab'], 'a confirmed save leaves nothing pending');
    // Edited again while the save was in flight.
    const later = state.editQuestion(s.questions, s.pending, '3', { note: 'abc' });
    const racing = state.settleSave(later.questions, later.pending, sent, { stale: [], questions: { 3: { done: true, flagged: false, note: 'ab', noteRev: 2, ms: 0 } } });
    eq([racing.pending['3'].note, racing.pending['3'].noteRev, racing.questions['3'].note], ['abc', 3, 'abc'], 'an edit made while a save was in flight stays pending and stays on screen');
    // A newer note exists on the server (another device).
    const other = { done: false, flagged: false, note: 'from the iPad', noteRev: 9, ms: 0 };
    const typedNow = state.settleSave(s.questions, s.pending, sent, { stale: [3], questions: { 3: other } });
    eq([typedNow.pending['3'].note, typedNow.pending['3'].noteRev, typedNow.questions['3'].note], ['ab', 10, 'ab'], 'a note typed in this visit that the server called stale is sent again above the server\'s revision');
    const fromCache = state.fromCache(s.pending);
    const stale = state.settleSave(state.overlay({}, fromCache, 27), fromCache, state.changesOf(fromCache), { stale: [3], questions: { 3: other } });
    eq([stale.pending, stale.questions['3'].note], [{}, 'from the iPad'], 'an OLD unsent note from the device cache never overwrites a newer one: the server\'s stands');
    eq(state.overlay({ 3: other, 99: other }, { 5: { flagged: true } }, 27), { 3: other, 5: { done: false, flagged: true, note: '', noteRev: 0, ms: 0 } }, 'the screen is the server\'s questions with unconfirmed edits over them; questions off the paper are dropped');

    // The offline projection is display only, and can never buy time.
    const events = [{ t: 'begin-working', at: T0 }];
    const queued = [{ intent: 'pause', at: T0 + 10 * MIN }];
    const projected = state.projectEvents(PAPER, events, queued);
    eq([events.length, projected.at(-1)], [1, { t: 'pause', at: T0 + 10 * MIN }], 'a queued pause is projected for display without touching the server\'s log');
    const estimate = clockEngine.deriveClock(PAPER, projected, T0 + 40 * MIN);
    // The server receives the pause thirty minutes later and stamps its own time.
    const stamped = clockEngine.applyIntent(PAPER, events, 'pause', T0 + 40 * MIN).events;
    const truth = clockEngine.deriveClock(PAPER, stamped, T0 + 40 * MIN);
    eq([estimate.remainingMs, truth.remainingMs], [170 * MIN, 140 * MIN], 'the estimate showed 170 minutes left; the server, stamping the pause when it ARRIVED, says 140 — offline never adds time');
    eq(state.projectEvents(PAPER, events, [{ intent: 'resume', at: T0 + MIN }]).length, 1, 'a press the clock cannot take is not projected');

    const ledger = state.timeLedger(PAPER, { elapsedWorkingMs: 100 * MIN, elapsedReadingMs: 10 * MIN, pausedMs: 14 * MIN, overtimeMs: 0 },
      { 2: { ms: 5 * MIN }, 12: { ms: 30 * MIN }, 14: { ms: 12 * MIN }, 20: { ms: 30 * MIN } }, groups);
    eq([ledger.allottedMs, ledger.workingMs, ledger.pausedMs, ledger.sections, ledger.longest.map(x => x.q)],
      [180 * MIN, 100 * MIN, 14 * MIN, [{ label: 'Section I', ms: 5 * MIN }, { label: 'Section II', ms: 72 * MIN }], [12, 20, 14]], 'the time ledger: figures only — time used, paused, per section, and where most time went');
    ok(!Object.keys(ledger).some(k => /pct|share|pace|ahead|behind|rating|verdict/i.test(k)), 'the ledger derives no judgement');
    eq([state.nextFlagged({ 3: { flagged: true }, 9: { flagged: true } }, 27, 3), state.nextFlagged({ 3: { flagged: true }, 9: { flagged: true } }, 27, 9), state.nextFlagged({}, 27, 1)], [9, 3, null], 'going through flags wraps round; none flagged is none');
  }

  // ── 7 · Unmarked, on every screen, in both languages ─────────────────────
  eq([markWording('You scored 71/100 (71%), a Band 5 result — 12 correct.').length > 4, markWording('Practice · not marked. Nothing was marked.'), markWording('3 marks'), markWording('अभ्यास · अंक नहीं दिए जाते', 'hi'), markWording('आपके अंक 71', 'hi').length],
    [true, [], ['marks'], [], 1], 'self-test: the wording scanner catches marks, scores, percentages, bands and results, and lets only "not marked" through');
  const attempt = (patch = {}) => ({
    id: '11111111-1111-4111-8111-111111111111', kind: 'desk-attempt', mode: 'unmarked', origin: 'desk', paper: PAPER, state: 'finished',
    resource: { id: 'sample-paper', title: 'Sample paper', listed: true }, questions: {}, ...patch
  });
  const closedClock = { phase: 'finished', running: false, remainingMs: 0, overtimeMs: 4 * MIN, elapsedReadingMs: 10 * MIN, elapsedWorkingMs: 184 * MIN, pausedMs: 14 * MIN, finishReason: 'student' };
  const sat = { 3: { done: true, flagged: false, note: 'check', noteRev: 1, ms: 12 * MIN }, 14: { done: false, flagged: true, note: '', noteRev: 0, ms: 30 * MIN } };
  for (const lang of ['en', 'hi']) {
    await i18n.setLanguage(lang);
    const tr = (key, vars) => i18n.translate(key, vars);
    const screens = {
      'the standing plate': draw(h(page.UnmarkedPlate, { t: tr })),
      'the closed paper': draw(h(page.ClosedSummary, { t: tr, attempt: attempt(), clock: closedClock, questions: sat, groups, onNextFlagged() {}, onAgain() {}, onDelete() {} })),
      'an imported attempt': draw(h(page.ClosedSummary, { t: tr, attempt: attempt({ origin: 'prithagoras-import', imported: { exportedAt: Date.parse(FIXTURE.createdAt), phase: 'working' } }), clock: { ...closedClock, finishReason: 'imported', elapsedWorkingMs: 0, overtimeMs: 0, pausedMs: 0, elapsedReadingMs: 0 }, questions: sat, groups, onNextFlagged() {}, onAgain() {}, onDelete() {} })),
      'the way in from a library paper': draw(h(entry.DeskEntryView, { t: tr, attempts: [{ id: 'a', state: 'finished', origin: 'desk', finishedAt: T0, tallies: { done: 4, flagged: 2, notes: 3 }, time: { elapsedWorkingMs: 100 * MIN } }], onStart() {} })),
      'the import preview': draw(h(importer.ImportPreview, { t: tr, preview: { resourceId: 'sample-paper', title: 'Sample paper', questionCount: 27, exportedAt: Date.parse(FIXTURE.createdAt), tallies: { done: 4, flagged: 2, notes: 3 } }, already: null, earlier: 1 }))
    };
    for (const [name, html] of Object.entries(screens)) {
      eq(markWording(textOfMarkup(html), lang), [], `${lang}: ${name} carries no mark, score, percentage, band or result wording`);
    }
    for (const name of ['the standing plate', 'the closed paper', 'the way in from a library paper']) ok(saysUnmarked(textOfMarkup(screens[name]), lang), `${lang}: ${name} says in plain words that this is not marked`);
    ok(screens['the standing plate'].includes('data-desk-unmarked') && screens['the way in from a library paper'].includes('data-desk-unmarked'), `${lang}: the plate is on the entry too`);
    const closed = textOfMarkup(screens['the closed paper']);
    ok(closed.includes('03:04:00') && closed.includes('03:00:00') && closed.includes('+00:04:00') && closed.includes('00:14:00'), `${lang}: the closed paper states time used, the allotment, overtime and the pause, as figures`);
    ok(closed.includes(tr('desk.tallies', { done: 1, flagged: 1, notes: 1 })) && screens['the closed paper'].includes('data-desk-next-flagged'), `${lang}: and the student's own done, flagged and note counts, with a way through the flags`);
    const imported = textOfMarkup(screens['an imported attempt']);
    ok(imported.includes(tr('desk.importedOn', { date: new Date(Date.parse(FIXTURE.createdAt)).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) })) && !imported.includes('03:00:00'), `${lang}: an imported attempt says the timer was not brought across, and shows no sitting time`);
    ok(/data-desk-continue/.test(draw(h(entry.DeskEntryView, { t: tr, attempts: [{ id: 'open-one', state: 'working', tallies: {} }], onStart() {} }))) && /data-desk-start/.test(screens['the way in from a library paper']),
      `${lang}: an open attempt offers Continue; otherwise Practise at the desk`);
  }
  await i18n.setLanguage('en');
  eq([t('desk.unmarked'), t('desk.close'), t('desk.closeBody')], ['Practice · not marked', 'Close paper', 'Nothing is marked or sent for checking. Your notes stay with this attempt.'], 'the spec\'s wording, exactly: the plate, "Close paper" (never Submit), and the confirm text');
  const deskKeys = Object.keys(en).filter(k => k.startsWith('desk.') || k.startsWith('shell.'));
  const wording = deskKeys.flatMap(k => (typeof en[k] === 'string' ? [en[k]] : Object.values(en[k]))).join('\n');
  eq(markWording(wording), [], `none of the ${deskKeys.length} desk and shell strings carries mark-shaped wording, beyond saying it is not marked`);
  ok(!/\bsubmit/i.test(wording), 'no desk string says Submit');
  ok(entry.deskable({ type: 'paper', questionCount: 27 }) && !entry.deskable({ type: 'notes', questionCount: 27 }) && !entry.deskable({ type: 'paper', questionCount: null }) && !entry.deskable({ type: 'paper', questionCount: 201 }), 'only a paper with 1–200 questions can be sat at the desk');
  // A reply that is not unmarked practice is never drawn.
  const good = { mode: 'unmarked', attempt: { mode: 'unmarked', kind: 'desk-attempt' } };
  ok(api.unmarked(good) === good && api.unmarked({ mode: 'unmarked', attempts: [{ mode: 'unmarked', kind: 'desk-attempt' }] }), 'an unmarked reply is passed through');
  for (const [name, reply] of [['no mode', { attempt: good.attempt }], ['another mode', { ...good, mode: 'marked' }], ['an attempt of another mode', { mode: 'unmarked', attempt: { mode: 'marked', kind: 'desk-attempt' } }],
    ['an attempt of another kind', { mode: 'unmarked', attempt: { mode: 'unmarked', kind: 'exam-paper' } }], ['a list holding another kind', { mode: 'unmarked', attempts: [{ mode: 'unmarked', kind: 'exam-paper' }] }], ['nothing', null]]) {
    let refused = null;
    try { api.unmarked(reply); } catch (err) { refused = err.code; }
    eq(refused, 'DESK_MODE_INVALID', `a reply with ${name} is refused, never drawn`);
  }

  // ── 8 · The import, on the device ────────────────────────────────────────
  {
    const paper = { id: FIXTURE.resource.id, type: 'paper', title: FIXTURE.resource.title, questionCount: 27 };
    const lookup = async id => { if (id !== paper.id) throw Object.assign(new Error('nope'), { code: 'RESOURCE_NOT_FOUND', status: 404 }); return { resource: paper }; };
    const text = JSON.stringify(FIXTURE);
    const accepted = await importer.readChosenFile(text, lookup);
    eq([accepted.plan?.tallies, accepted.plan?.resourceId, 'remainingTimeSeconds' in (accepted.plan || {}), JSON.stringify(accepted.plan).includes('4360')], [{ done: 4, flagged: 2, notes: 3 }, paper.id, false, false],
      'the synthetic prithagoras-web export is read on the device: 4 done, 2 flagged, 3 notes — and nothing of its timer');
    const refusedAs = async (file, look = lookup) => (await importer.readChosenFile(typeof file === 'string' ? file : JSON.stringify(file), look)).refused;
    eq(await refusedAs('{"exportVersion": 1, '), 'DESK_IMPORT_NOT_A_DESK_FILE', 'a file that is not JSON is not a desk export');
    eq(await refusedAs('[1,2,3]'), 'DESK_IMPORT_NOT_A_DESK_FILE', 'nor is a list');
    eq(await refusedAs(JSON.stringify({ ...FIXTURE, notes: { 1: 'x'.repeat(300 * 1024) } })), 'DESK_IMPORT_NOT_A_DESK_FILE', 'nor is a file over 256 KB');
    eq(await refusedAs({ ...FIXTURE, exportVersion: 2 }), 'DESK_IMPORT_VERSION', 'another export version is refused');
    eq(await refusedAs({ ...FIXTURE, resource: { id: 'some-other-paper' } }), 'DESK_IMPORT_UNKNOWN_PAPER', 'a paper this edition\'s library does not hold is refused');
    eq(await refusedAs({ ...FIXTURE, exam: { ...FIXTURE.exam, questions: 28 } }), 'DESK_IMPORT_PAPER_CHANGED', 'an export for a different question count is refused');
    eq(await refusedAs({ ...FIXTURE, statuses: { ...FIXTURE.statuses, 4: 'correct' } }), 'DESK_IMPORT_MALFORMED', 'a tampered status ("correct") is refused: the file can only say done or flagged');
    eq(await refusedAs({ ...FIXTURE, statuses: { 28: 'done' } }), 'DESK_IMPORT_MALFORMED', 'a status for a question the paper does not have is refused');
    eq(await refusedAs({ ...FIXTURE, statuses: {}, notes: {} }), 'DESK_IMPORT_EMPTY', 'an export with nothing in it is refused');
    eq(await refusedAs(FIXTURE, async () => { throw new Error('network'); }), 'CLOUD_DISABLED', 'with no connection the file is not judged at all');
    for (const refusal of ['DESK_IMPORT_NOT_A_DESK_FILE', 'DESK_IMPORT_VERSION', 'DESK_IMPORT_UNKNOWN_PAPER', 'DESK_IMPORT_PAPER_CHANGED', 'DESK_IMPORT_MALFORMED', 'DESK_IMPORT_EMPTY', 'SOMETHING_ELSE']) {
      ok(typeof en[importer.refusalKey(refusal)] === 'string', `the refusal ${refusal} has its own sentence`);
    }
    const src = code('src/desk/DeskImport.jsx');
    ok(!/useEffect|postMessage|addEventListener|location\.|useSearchParams|useLocation/.test(src), 'the import page acts on nothing but the student: no effect on load, no message listener, nothing read from the address');
    eq((src.match(/deskApi\.importAdd\(/g) || []).length, 1, 'one call stores an import');
    ok(/const add = async \(\) => \{[\s\S]*?deskApi\.importAdd\(/.test(src) && /onClick=\{add\}/.test(src) && /data-import-add/.test(src), 'and it is the press of "Add to my account"');
    ok(/await chosen\.text\(\)/.test(src) && !/FormData|multipart/.test(src), 'the file is read on the device and sent as the parsed record, never uploaded as a file');
  }

  // ── 9 · Wiring ───────────────────────────────────────────────────────────
  const deskFiles = readdirSync(new URL('../src/desk', import.meta.url)).filter(f => /\.jsx?$/.test(f));
  const shellFiles = readdirSync(new URL('../src/examShell', import.meta.url)).filter(f => /\.jsx?$/.test(f));
  for (const name of ['QuestionNavigator.jsx', 'QuestionNotes.jsx', 'ClockFace.jsx', 'ConfirmSheet.jsx', 'ShortcutsSheet.jsx', 'PaperHeader.jsx', 'useAutosave.js', 'useExamShortcuts.js', 'useAnnounce.js']) {
    ok(shellFiles.includes(name), `the shell has ${name}`);
  }
  const apiSrc = code('src/desk/deskApi.js');
  const paths = [...apiSrc.matchAll(/cloudRequest\(\s*[`']([^`'$]+)/g)].map(m => m[1]);
  ok(paths.length >= 8 && paths.every(p => p.startsWith('/v1/desk/') || p === '/v1/account/me'), `every desk call goes to /v1/desk (or asks whose account this is): ${[...new Set(paths)].join(', ')}`);
  ok(!/fetch\(|XMLHttpRequest|sendBeacon/.test(apiSrc), 'through the audited transport only');
  ok(/body: \{ intent, rev, \.\.\.\(early \? \{ early: true \} : \{\}\) \}/.test(apiSrc), 'a clock call carries an intent, the revision and the early flag: never a time');
  const allDesk = [...deskFiles.map(f => code(`src/desk/${f}`)), ...shellFiles.map(f => code(`src/examShell/${f}`))].join('\n');
  for (const [what, re] of [['the marked papers\' routes', /\/v1\/exams|\/exams\//], ['practice', /\/v1\/practice/], ['the handwriting reader', /\/v1\/handwriting|recogni[sz]e/i], ['the device backend', /local\/backend|from '\.\.\/api\.js'/],
    ['a celebration', /celebrate|confetti|xp\b/i], ['a write to localStorage', /localStorage\??\.(setItem|removeItem|clear)|localStorage\[/]]) {
    ok(!re.test(allDesk), `the desk and the shell name no ${what}`);
  }
  eq([cache.cacheKey('42', 'abc'), cache.DESK_DB], ['desk:v1:42:abc', 'pri-desk-v1'], 'the device cache is the desk\'s own database, keyed by account and attempt');
  const cacheSrc = code('src/desk/deskCache.js');
  ok(/hasDataKey\(pid\)/.test(cacheSrc) && /sealField\(pid, body\)/.test(cacheSrc) && /row\.pid === profileId\(\) \? await openField\(row\.pid, row\.sealed\)/.test(cacheSrc),
    'at rest the cache follows the profile\'s protection: sealed under the profile\'s key where it holds one, opened only for that profile');
  ok(/get\('device', `\$\{LINK_PREFIX\}\$\{pid\}`\)/.test(cacheSrc) && /const LINK_PREFIX = 'pri-cloud-account-link-v1:';/.test(cacheSrc) && read('src/platform/cloudAccount.js').includes("const LINK_PREFIX = 'pri-cloud-account-link-v1:';"),
    'with no connection the desk belongs to the account this device profile is linked to (the gate\'s own link row)');
  eq([await cache.readCache('42', 'abc'), await cache.writeCache('42', 'abc', { attempt: { id: 'abc' } })], [null, null], 'with no IndexedDB (Node, private mode) there is simply no cache, and keeping one fails soft');
  // WHO FIRST: the page establishes the account before it reads anything kept on the device.
  const pageSrc = code('src/desk/DeskPage.jsx');
  const load = pageSrc.slice(pageSrc.indexOf('let accountId = null;'), pageSrc.indexOf('// ── The clock on screen'));
  ok(load.indexOf('await deskApi.account()') >= 0 && load.indexOf('await deskApi.account()') < load.indexOf('readCache(') && load.indexOf('linkedAccount()') < load.indexOf('readCache(') && (load.match(/readCache\(/g) || []).length === 1 && /readCache\(accountId, attemptId\)/.test(load),
    'the load path asks who is signed in (or, unreachable, who this profile is linked to) BEFORE the one read of the device cache, which is by that account');
  ok(!/lastAccount|rememberAccount/.test(pageSrc + cacheSrc), 'there is no "whoever used the desk last" pointer');
  ok(/if \(reply\?\.attempt\?\.id !== attemptId\) return live\.current;/.test(pageSrc) && /<Desk key=\{attemptId\} attemptId=\{attemptId\} \/>/.test(pageSrc), 'a reply for another attempt is never adopted, and each attempt is its own page');
  ok(/adopt\(reply, \{ accountId \}\);/.test(load) && !/pending: fromCache\(mine/.test(pageSrc), 'the first server reply keeps whatever was typed or pressed while it was in flight');
  ok(api.unreachable(new TypeError('Failed to fetch')) && api.unreachable(Object.assign(new Error('x'), { code: 'CLOUD_DISABLED' })) && !api.unreachable(Object.assign(new Error('x'), { code: 'DESK_MODE_INVALID' })) && !api.unreachable(Object.assign(new Error('x'), { status: 429, code: 'RATE_LIMITED' })),
    'only a transport failure is "offline"; a refused or rate-limited reply is not retried as one');
  ok(!/role="status"/.test(pageSrc.slice(pageSrc.indexOf('className="dk-status"') - 4, pageSrc.indexOf('className="dk-status"') + 60)), 'the save-state line is not a live region (a screen reader is not told "saved" every thirty seconds)');
  ok(/clearDeskCache\(\)/.test(read('src/App.jsx')) && /connected === false/.test(read('src/App.jsx')) && /forgotten = true;/.test(cacheSrc) && /if \(forgotten \|\|/.test(cacheSrc), 'signing out of the account on this device forgets the desk\'s cache, and a save still in flight cannot write it back');
  const app = read('src/App.jsx');
  ok(/const DESK_ON = LIBRARY_ON && featureEnabled\('examDesk'\);/.test(app), 'App turns the desk on only where the library is on too');
  ok(/\{DESK_ON && <Route path="\/desk\/import" element=\{studentOnly\(/.test(app) && /\{DESK_ON && <Route path="\/desk\/:attemptId" element=\{studentOnly\(/.test(app), 'both routes exist only where the flag is on, for students only');
  ok(/<Library desk=\{DESK_ON\} \/>/.test(app) && /\{desk && state\.resource\.type === 'paper'/.test(read('src/library/Library.jsx')), 'the library shows the way in only on a paper, only where the flag is on');
  ok(PENDING_FEATURE_FLAGS.includes('EXAM_DESK'), 'EXAM_DESK is a pending build flag');
  eq([featureStates('build', {}).examDesk, featureStates('build', { PRI_FEATURE_EXAM_DESK: '1' }).examDesk, featureStates('serve', {}).examDesk], [false, true, true], 'off in a production build without PRI_FEATURE_EXAM_DESK=1; on with it, and on the development server');
  ok(/examDesk: typeof __PRI_FEATURE_EXAM_DESK__ === 'boolean'/.test(read('src/platform/features.js')), 'features.js reads the build constant');
  const group = CHUNK_GROUPS.find(g => g.name === 'exam-desk');
  ok(group && ['/x/src/desk/DeskPage.jsx', '/x/src/examShell/ClockFace.jsx', '/x/src/engine/deskClock.js', '/x/src/engine/deskImport.js'].every(f => group.test.test(f)) && !group.test.test('/x/src/pages/ExamRoom.jsx') && !group.test.test('/x/src/engine/examTime.js'),
    'the desk, the shell and the desk\'s pure modules are one named chunk, and nothing else is');
  for (const file of ['assets/exam-desk-Bl2D7GYK.js', 'assets/exam-desk-BECvxl1c.css', 'assets/DeskPage-CSttVgzJ.js', 'assets/DeskImport-Bn-QSsVr.js', 'assets/DeskEntry-BCuXJmcw.js', 'assets/deskCache-C0ffee12.js']) {
    ok(ON_DEMAND.some(([re]) => re.test(file)), `${file} is fetched on demand, never installed`);
  }
  // Moving the marked room onto the shell is plan F4c, not this mission.
  ok(!/examShell/.test(read('src/pages/ExamRoom.jsx')) && !/examShell|\/desk\//.test(read('src/pages/Exams.jsx')), 'the marked exam room and the Exams page are untouched by the shell and the desk');
} finally {
  await server.close();
}

if (failures.length) {
  console.error(`DESK UI: FAIL — ${failures.length} of ${pass + failures.length} checks failed`);
  for (const f of failures) console.error(`  · ${f}`);
  process.exit(1);
}
console.log(`DESK UI: PASS — ${pass}/${pass} checks`);
