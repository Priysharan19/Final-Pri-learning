// Pri dream interface · recommendation scenarios (from KALP-04, PR #240) and
// workspace contracts. Pure node: no browser, no build.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { HOME_RECOMMENDATION_POLICY, resolveHomeRecommendation } from '../src/home/recommendation.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const read = rel => readFile(join(ROOT, rel), 'utf8');
const now = Date.parse('2026-10-01T12:00:00+05:30');
const student = {
  id: 'student-1', role: 'student', course: 'in', year: 10,
  indiaTrackName: 'CBSE / NCERT', courseLabel: 'CBSE / NCERT',
  dailyGoal: 10, today: { questions: 0 }
};
const base = {
  user: student,
  stats: { totals: { attempts: 12 }, priorities: [{ id: 'algebra', name: 'Algebra' }] },
  dueCount: 0, tasks: [], exams: [], resume: null,
  assignments: [], online: true, cloudReady: true, now
};

let passed = 0;
const failures = [];
function check(name, fn) {
  try { fn(); passed++; console.log('  ✔ ' + name); }
  catch (error) { failures.push(name + ': ' + error.message); console.log('  ✘ ' + name); }
}
const selected = overrides => resolveHomeRecommendation({ ...base, ...overrides }).primary;

check('active exam outranks ordinary work', () => {
  const row = selected({
    exams: [{ id: 'exam-1', title: 'Paper', created_at: now - 1000, finished_at: null }],
    dueCount: 1,
    resume: { kind: 'practice', questionId: 'q1', destination: '/practice' }
  });
  assert.equal(row.kind, 'exam');
  assert.equal(row.destination, '/exams/exam-1');
});

check('returned teacher assignment is urgent and contextual', () => {
  const row = selected({ assignments: [{
    id: 'a1', classId: 'c1', title: 'Quadratics', dueAt: now + 10 * 86400000,
    specification: { questionCount: 10 }, submission: { state: 'returned', summary: { questionsAnswered: 4 } }
  }] });
  assert.equal(row.kind, 'assignment');
  assert.equal(row.priority, HOME_RECOMMENDATION_POLICY.returnedAssignment);
  assert.equal(row.destination, '/practice?classId=c1&assignment=a1');
});

check('teacher assignment due soon outranks ordinary resume', () => {
  const row = selected({
    assignments: [{ id: 'a2', classId: 'c1', title: 'Due', dueAt: now + 2 * 3600000, specification: { questionCount: 8 } }],
    resume: { kind: 'practice', questionId: 'q1', destination: '/practice' }
  });
  assert.equal(row.kind, 'assignment');
});

check('active local resume outranks due reviews', () => {
  const row = selected({
    resume: { kind: 'practice', questionId: 'q1', destination: '/practice' },
    dueCount: 2
  });
  assert.equal(row.kind, 'practice-resume');
});

check('due reviews outrank daily goal', () => {
  const row = selected({
    user: { ...student, today: { questions: 4 } },
    dueCount: 1
  });
  assert.equal(row.kind, 'reviews');
});

check('partial daily goal beats generic adaptive work', () => {
  const row = selected({ user: { ...student, today: { questions: 6 } } });
  assert.equal(row.kind, 'daily-goal');
  assert.equal(row.data.remaining, 4);
});

check('new student receives a real first practice action', () => {
  const row = selected({
    stats: { totals: { attempts: 0 }, priorities: [{ id: 'zero-history', name: 'Algebra' }] },
    user: { ...student, today: { questions: 0 } }
  });
  assert.equal(row.kind, 'first-practice');
  assert.equal(row.destination, '/practice');
});

check('new offline student receives honest caveat', () => {
  const row = selected({
    stats: { totals: { attempts: 0 } },
    user: { ...student, today: { questions: 0 } },
    online: false, cloudState: 'offline'
  });
  assert.equal(row.kind, 'first-practice');
  assert.equal(row.offlineCaveat, true);
});

check('cloud assignments are excluded while offline', () => {
  const row = selected({
    online: false, cloudState: 'offline',
    assignments: [{ id: 'a3', classId: 'c1', title: 'Cloud only', dueAt: now - 1000 }],
    dueCount: 1
  });
  assert.equal(row.kind, 'reviews');
});

check('cloud failure leaves local recommendation usable', () => {
  const decision = resolveHomeRecommendation({
    ...base, cloudReady: false,
    assignments: [{ id: 'a4', classId: 'c1', title: 'Unavailable', dueAt: now - 1000 }]
  });
  assert.ok(decision.primary);
  assert.notEqual(decision.primary.kind, 'assignment');
});

check('unfinished local class task preserves task context', () => {
  const row = selected({ tasks: [{ id: 't1', title: 'Teacher pack', classId: 'cl', className: '10A', count: 10, done: 3, finished: false, dueAt: now + 6 * 3600000 }] });
  assert.equal(row.kind, 'task');
  assert.equal(row.destination, '/practice?task=t1');
});

check('finished local task is never primary', () => {
  const row = selected({ tasks: [{ id: 't2', title: 'Done', count: 10, done: 10, finished: true }] });
  assert.notEqual(row.id, 't2');
});

check('submitted cloud assignment is never primary', () => {
  const row = selected({ assignments: [{ id: 'a5', classId: 'c1', title: 'Submitted', submission: { state: 'submitted' } }] });
  assert.notEqual(row.id, 'a5');
});

check('teacher role receives no student recommendation', () => {
  const decision = resolveHomeRecommendation({ ...base, user: { ...student, role: 'teacher' } });
  assert.equal(decision.primary, null);
});

check('policy is deterministic under identical inputs', () => {
  const input = { ...base, dueCount: 1, tasks: [{ id: 't4', title: 'Task', count: 10, done: 0, finished: false }] };
  assert.deepEqual(resolveHomeRecommendation(input), resolveHomeRecommendation(input));
});

check('tie-break prefers earlier real deadline', () => {
  const row = selected({ assignments: [
    { id: 'later', classId: 'c', title: 'Later', dueAt: now + 10 * 3600000 },
    { id: 'earlier', classId: 'c', title: 'Earlier', dueAt: now + 2 * 3600000 }
  ] });
  assert.equal(row.id, 'earlier');
});

check('assignment without a due date is not falsely urgent', () => {
  const row = selected({
    assignments: [{ id: 'undated', classId: 'c', title: 'Undated' }],
    dueCount: 1
  });
  assert.equal(row.kind, 'reviews');
});

check('unfinished task question keeps resume priority', () => {
  const row = selected({
    tasks: [{ id: 'task-resume', title: 'Task', count: 10, done: 1, finished: false }],
    resume: { kind: 'task', taskId: 'task-resume', questionId: 'q9', title: 'Task', destination: '/practice?task=task-resume' },
    user: { ...student, today: { questions: 4 } }
  });
  assert.equal(row.kind, 'task-resume');
  assert.equal(row.destination, '/practice?task=task-resume');
});

// ── Dream interface contracts ────────────────────────────────────────────────
// Source-level guards for the paper/instrument workspace. Each one names a
// behaviour a student relies on, so a refactor that drops it fails here first.
const src = rel => readFile(join(ROOT, rel), 'utf8');
const [backend, home, app, card, practicePage, ink, exam, en, recovery] = await Promise.all([
  'src/local/backend.js', 'src/pages/Home.jsx', 'src/App.jsx', 'src/components/QuestionCard.jsx',
  'src/pages/PracticeBase.jsx', 'src/ink/InkAnswer.jsx', 'src/pages/ExamRoom.jsx', 'src/i18n/strings.en.js',
  'src/components/practiceRecovery.js'
].map(src));

check('every component that calls t() first obtains it from useT() (the Diagnosis crash)', () => {
  const offenders = [];
  for (const [file, text] of [['QuestionCard.jsx', card], ['PracticeBase.jsx', practicePage], ['InkAnswer.jsx', ink], ['ExamRoom.jsx', exam], ['Home.jsx', home], ['App.jsx', app]]) {
    const parts = text.split(/\n(?=(?:export default )?function [A-Z])/);
    for (const part of parts) {
      const name = (part.match(/^(?:export default )?function ([A-Z]\w*)\s*\(([^)]*)\)/) || [])[1];
      if (!name) continue;
      const params = (part.match(/^(?:export default )?function [A-Z]\w*\s*\(([^)]*)\)/) || [])[1] || '';
      const uses = /[^\w.]t\(\s*['`(a-z]/.test(part);
      const has = /const t = useT\(\)/.test(part) || /\bt\b/.test(params);
      if (uses && !has) offenders.push(`${file}:${name}`);
    }
  }
  assert.deepEqual(offenders, []);
});

check('Home consumes one central recommendation resolver and one primary action', () => {
  assert.match(home, /resolveHomeRecommendation/);
  assert.match(home, /api\.get\('\/practice\/resume'\)/);
  assert.equal((home.match(/data-home-primary(?!-)/g) || []).length, 1);
  assert.equal((home.match(/data-home-primary-cta/g) || []).length, 1);
  assert.ok(home.indexOf('<HomeAction primary') < home.indexOf('className="genbar"'));
  assert.match(home, /assignments === false/);
  assert.doesNotMatch(home, /TAGLINES|Tagline|DiamondTrack|adaptiveOn/);
});

check('practice is a thinking-mode route: no navigation furniture while working', () => {
  assert.match(app, /focusMode = user\.role !== 'teacher'\s*&& \(loc\.pathname === '\/practice' \|\| \/\^\\\/exams\\\/\[\^\/\]\+\/\.test\(loc\.pathname\)\)/);
  assert.match(practicePage, /className="ws-bar/);
  assert.match(practicePage, /aria-label=\{t\('practice\.leave'\)\}/);
});

check('the action bar holds exactly one primary action', () => {
  const bar = card.slice(card.indexOf('<div className="ws-actions'), card.indexOf('</section>', card.indexOf('<div className="ws-actions')));
  assert.equal((bar.match(/btn-primary/g) || []).length, 1);
});

check('status only claims what the device actually knows', () => {
  assert.doesNotMatch(en, /'verdict\.status[A-Za-z]*': '[^']*(synced|uploaded|cloud)/i);
  assert.match(card, /saveDraft\('question', question\.id/);
  // Ink is reported saved only after the record is read back from the store.
  assert.match(card, /const at = draftSavedAt\('ink', question\.id\);\s*setSaveState\(at && at >= asked \? 'saved' : 'failed'\)/);
  // …and a draft cleared by marking is never reported as a failed save.
  assert.match(card, /if \(inFlightRef\.current \|\| attemptRef\.current\) return;\s*const at = draftSavedAt/);
  assert.match(card, /if \(!saveInkDraft\(question\.id, strokes, [^)]*\)\) \{ setSaveState\('failed'\); return; \}/);
});

check('handwriting drafts live in one recovery store and are restored, never marked', () => {
  // One store (components/practiceRecovery.js). A second copy on the question
  // row would give a restored page two sources of truth.
  assert.doesNotMatch(backend, /ink-draft|inkDraft/);
  assert.match(card, /saveInkDraft\(question\.id, strokes/);
  assert.match(card, /initialStrokes=\{latestInk\.current \|\| restoredInk \|\| null\}/);
  assert.match(card, /clearInkDraft\(question\.id\)/);
  assert.match(ink, /canvasRef\.current\?\.setStrokes\?\.\(initialStrokes\)/);
  assert.match(recovery, /Neither ever holds the expected answer, a solution or a mark/);
});

check('a reading in doubt is confirmed in place, not by rewriting', () => {
  assert.match(card, /needsCheck && checking\s*\? \{ label: t\('verdict\.confirmReading'\), run: acceptReading/);
  assert.match(card, /className="ws-check"/);
});

check('mistakes, uncertainty and failures are three different states', () => {
  assert.match(card, /verdict-technical/);
  assert.match(card, /verdict-unsure/);
  assert.match(card, /'verdict-bad'/);
  assert.match(card, /technical: true/);
});

check('the first meaningful break leads; the rest wait behind a disclosure', () => {
  assert.match(card, /const first = report\.lines\.findIndex\(l => l\.status === 'break'\)/);
  assert.match(card, /className="stepcheck-more"/);
});

check('scratch work is labelled as never marked', () => {
  assert.match(card, /verdict\.scratchNotMarked/);
  assert.match(en, /'verdict\.scratchNotMarked': ["']Not marked["']/);
});

check('no learner-model numbers or game points in the result', () => {
  assert.doesNotMatch(card, /verdict\.mastery|verdict\.skillUp|xp-pop|PRAISE_KEYS/);
});

check('formal assessment: no hints, confirmed submission, flags and a spoken timer', () => {
  assert.doesNotMatch(exam, /getHint|hintsAvailable|PriExplain/);
  assert.match(exam, /role="dialog"[\s\S]*exam\.confirmUnanswered/);
  assert.match(exam, /setFlagged/);
  assert.match(exam, /left === 600 \|\| left === 300 \|\| left === 60/);
  assert.match(exam, /role="timer"/);
});

check('no effect shadows the translator it calls (the exam-timer crash)', () => {
  for (const [file, text] of [['ExamRoom.jsx', exam], ['QuestionCard.jsx', card], ['InkAnswer.jsx', ink], ['PracticeBase.jsx', practicePage], ['Home.jsx', home]]) {
    assert.doesNotMatch(text, /\bconst t = set(?:Timeout|Interval)\(/, `${file} declares a local \`t\` that is not the translator`);
  }
});

// ── Theme architecture ───────────────────────────────────────────────────────
const themeLib = await import(pathToFileURL(join(ROOT, 'src/lib/theme.js')).href);
const [indexHtml, themeBoot, themeCss, syncWorker] = await Promise.all(
  ['index.html', 'public/theme-boot.js', 'src/theme.css', 'src/platform/syncWorker.js'].map(src)
);

check('a preference resolves to exactly light or dark; unknown values are paper', () => {
  const dark = { matches: true }, light = { matches: false };
  assert.equal(themeLib.resolveTheme('light', dark), 'light');
  assert.equal(themeLib.resolveTheme('dark', light), 'dark');
  assert.equal(themeLib.resolveTheme('system', dark), 'dark');
  assert.equal(themeLib.resolveTheme('system', light), 'light');
  assert.equal(themeLib.resolveTheme('system', null), 'light');
  for (const junk of [undefined, null, '', 'blackboard', 'DARK', 7]) {
    assert.equal(themeLib.cleanThemePref(junk), 'light');
    assert.equal(themeLib.resolveTheme(junk, dark), 'light');
  }
});

check('the theme is painted before the app loads, from a file a strict script policy allows', () => {
  const boot = indexHtml.indexOf('<script src="/theme-boot.js"></script>');
  assert.ok(boot > 0, 'index.html loads theme-boot.js');
  assert.ok(boot < indexHtml.indexOf('type="module"'), 'theme-boot.js runs before the app bundle');
  assert.doesNotMatch(indexHtml, /<script>(?!<)/, 'no inline script in index.html');
  assert.match(themeBoot, new RegExp(`getItem\\('${themeLib.THEME_STORAGE_KEY}'\\)`));
});

check('browser chrome colour matches the desk of each theme', () => {
  const page = block => (block.match(/--page:\s*(#[0-9a-f]{6})/i) || [])[1];
  const lightPage = page(themeCss.slice(themeCss.indexOf(':root {')));
  const darkPage = page(themeCss.slice(themeCss.indexOf('[data-theme="dark"] {')));
  assert.equal(themeLib.THEME_CHROME.light, lightPage);
  assert.equal(themeLib.THEME_CHROME.dark, darkPage);
  assert.ok(themeBoot.includes(lightPage) && themeBoot.includes(darkPage), 'theme-boot.js paints the same two colours');
});

check('every layer that stores or syncs the preference accepts light, dark and system', () => {
  assert.match(backend, /THEME_PREFS\.includes\(body\.theme\)/);
  assert.doesNotMatch(backend, /theme === 'dark' \? 'dark' : 'light'/);
  assert.match(syncWorker, /\['light', 'dark', 'system'\]\.includes\(row\.theme\) \? row\.theme : 'light'/);
  assert.match(app, /return followSystemTheme\(pref, \(\) => applyTheme\(pref\)\)/);
});

// ── Contrast, measured from the tokens themselves ────────────────────────────
const tokenBlock = (css, start) => css.slice(css.indexOf(start), css.indexOf('\n}', css.indexOf(start)));
const hexToken = (block, name) => (block.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`)) || [])[1];
const luminance = hex => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const paperTokens = tokenBlock(themeCss, ':root {');
const nightTokens = tokenBlock(themeCss, '[data-theme="dark"] {');
const SURFACES = ['page', 'surface', 'surface-2', 'surface-raised', 'paper'];

check('anything typed, written or picked in has an edge at 3:1 on every surface, in both themes', () => {
  for (const [theme, block] of [['paper', paperTokens], ['night', nightTokens]]) {
    const edge = hexToken(block, 'control-border');
    assert.ok(edge, `${theme}: --control-border is a solid colour`);
    for (const surface of SURFACES) {
      const ratio = contrast(edge, hexToken(block, surface));
      assert.ok(ratio >= 3, `${theme}: --control-border on --${surface} is ${ratio.toFixed(2)}:1`);
    }
  }
  assert.match(themeCss, /\.input, select\.input, textarea\.input, \.answer-input, \.working-input \{[^}]*border: 1px solid var\(--control-border\)/);
  assert.match(themeCss, /\.editor-shell \{[^}]*border: 1px solid var\(--control-border\)/);
});

check('every text and state colour reads at AA (4.5:1) on every surface, in both themes', () => {
  for (const [theme, block] of [['paper', paperTokens], ['night', nightTokens]]) {
    for (const token of ['ink', 'ink-2', 'ink-3', 'accent', 'correction', 'uncertain', 'good', 'bad', 'warn']) {
      for (const surface of SURFACES) {
        const ratio = contrast(hexToken(block, token), hexToken(block, surface));
        assert.ok(ratio >= 4.5, `${theme}: --${token} on --${surface} is ${ratio.toFixed(2)}:1`);
      }
    }
    assert.ok(contrast(hexToken(block, 'accent-ink'), hexToken(block, 'accent')) >= 4.5, `${theme}: primary button label`);
  }
});

const [explainCss, explainJsx, progressJsx] = await Promise.all(
  ['src/components/PriExplainInstrument.css', 'src/components/PriExplainV5.jsx', 'src/pages/IndiaProgress.jsx'].map(src)
);

check('the explanation player never case-transforms mathematics, and shows no engine version', () => {
  // text-transform: uppercase on the question turned the variable x into X.
  assert.match(explainCss, /\.pri-explain-question > span:not\(:first-child\) \{[^}]*text-transform: none/);
  assert.match(explainCss, /\.pri-explain-question \{[^}]*text-transform: none/);
  const imports = [...explainJsx.matchAll(/^import '\.\/(PriExplain\w+)\.css';$/gm)].map(m => m[1]);
  assert.equal(imports.at(-1), 'PriExplainInstrument', 'the instrument layer is loaded last');
  assert.doesNotMatch(en, /'explain\.kicker': '[^']*V\d/);
  assert.match(explainJsx, /data-explain-engine="v8-adaptive"/);
  assert.match(en, /'explain\.presentationOnly': 'This explanation cannot change your mark\./);
});

check('the reading line runs once, only on a page the engine marked, and not under reduced motion', () => {
  assert.match(card, /data-marked=\{\(resolved && !res\?\.revealed\) \|\| \(state\.phase === 'retry' && !state\.res\?\.invalid\) \? 'yes' : undefined\}/);
  assert.match(themeCss, /\.editor-shell\[data-marked="yes"\] \.ink-stage::after \{[^}]*animation: reading-sweep 640ms var\(--ease-standard\) 1;/);
  assert.match(themeCss, /@media \(prefers-reduced-motion: reduce\) \{\s*\.editor-shell\[data-marked="yes"\] \.ink-stage::after \{ animation: none; display: none; \}/);
});

check('the result states the mark once and Progress shows whole marks, no percentile', () => {
  const head = card.slice(card.indexOf('<span className="eval-marks">'), card.indexOf('</span>', card.indexOf('<span className="eval-marks">')));
  assert.doesNotMatch(head, /%/);
  assert.match(card, /boardAward\.rows\.length > 1 && <b/);
  assert.match(progressJsx, /\+\{Math\.round\(unit\.atStake\)\}/);
  assert.doesNotMatch(progressJsx, /className="card"[^>]*>\s*<div className="card-title"/);
});

console.log('');
console.log('DREAM INTERFACE CHECK — ' + passed + '/' + (passed + failures.length) + ' checks');
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
}
