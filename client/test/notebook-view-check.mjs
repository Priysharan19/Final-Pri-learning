// Pri Learning · the mistake notebook screen's ordering, the local ink store's
// bounds, and the notebook review reminder (client/src/notebook/, reminders/).
// Usage: node client/test/notebook-view-check.mjs
import { readFileSync } from 'node:fs';
const { normalizeNotebook, notebookSections, dueEntries, premiumLine, firstErrorLine } = await import('../src/notebook/notebookView.js');
const { snapshotStrokes, idsBeyondCap, MAX_MISTAKE_INKS, SNAPSHOT_BOX, MAX_SNAPSHOT_CHARS, mistakeInkId } = await import('../src/notebook/inkStore.js');
const { buildNotebook } = await import('../src/engine/mistakeNotebook.js');
const { computeReminders, renderReminder, REMINDER_COPY, zonedMs } = await import('../src/reminders/schedule.js');
const en = (await import('../src/i18n/strings.en.js')).default;
const hi = (await import('../src/i18n/strings.hi.js')).default;

let pass = 0; const failures = [];
const ok = (name, cond, detail = '') => { if (cond) pass++; else failures.push(`${name}${detail ? ` — ${detail}` : ''}`); };
const eq = (name, a, b) => ok(name, JSON.stringify(a) === JSON.stringify(b), `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

const DAY = 86400000;
const NOW = Date.UTC(2026, 9, 20, 6, 0);
const at = d => NOW - d * DAY;
const attempts = [
  { attemptId: 'a1', at: at(10), correct: false, subtopic: 'linear', misconception: 'sign-flip', misconceptionLabel: 'Sign flip', firstError: { line: 2, text: '2x = -6', note: 'The sign changed sides wrongly.' }, marksEarned: 1, marksPossible: 3 },
  { attemptId: 'a2', at: at(0.5), correct: false, subtopic: 'linear', misconception: 'sign-flip', marksEarned: 0, marksPossible: 2 },
  { attemptId: 'a3', at: at(5), correct: false, subtopic: 'quadratics', marksEarned: 0, marksPossible: 4 },
  { attemptId: 'a4', at: at(4), correct: false, subtopic: 'linear' },
  { attemptId: 'a5', at: at(3), correct: false, subtopic: 'fractions' },
  { attemptId: 't1', at: at(2), correct: true, subtopic: 'fractions', twinOf: 'a5' }
];

// The server's own builder, through the response shape, into the screen.
const serverBook = (preview) => {
  const b = buildNotebook(attempts, { now: NOW, preview });
  return { plan: preview == null ? 'premium' : 'free', capability: 'full-notebook', preview, total: b.total, shown: b.shown, hidden: b.hidden, dueCount: b.dueCount, nextDueAt: b.nextDueAt, groups: b.groups, at: NOW };
};
const full = normalizeNotebook(serverBook(null));
eq('premium: everything shown, nothing hidden', [full.total, full.shown, full.hidden, full.plan], [5, 5, 0, 'premium']);
const sections = notebookSections(full);
eq('topics come first, due-for-review topics leading', sections.map(s => s.subtopic), ['linear', 'quadratics', 'fractions']);
const linear = sections[0];
eq('inside a topic, groups are by misconception, due first', linear.groups.map(g => g.key), ['linear::sign-flip', 'linear::unclassified']);
eq('inside a group, due items first, then newest', linear.groups[0].items.map(i => [i.id, i.review.due]), [['a1', true], ['a2', false]]);
eq('dueCount is the server\'s', full.dueCount, dueEntries(full).length);
eq('a fixed mistake is shown fixed and not due', sections.find(s => s.subtopic === 'fractions').groups[0].items.map(i => [i.fixed, i.review.due]), [[true, false]]);
eq('the first error line is the examiner\'s', firstErrorLine(full.groups.flatMap(g => g.items).find(i => i.id === 'a1')), { line: 2, text: '2x = -6', note: 'The sign changed sides wrongly.' });
eq('no first error → none invented', firstErrorLine(full.groups.flatMap(g => g.items).find(i => i.id === 'a2')), null);
eq('premium has no Premium line', premiumLine(full), null);

const free = normalizeNotebook(serverBook(3));
eq('free: the newest 3 shown, the rest only counted', [free.shown, free.hidden, free.groups.flatMap(g => g.items).length], [3, 2, 3]);
eq('free: the honest line counts what is held back', premiumLine(free), { key: 'notebook.olderInPremium', vars: { n: 2, count: 2 } });
ok('the line exists in both languages with a count', /\{n\} older mistakes are in the full notebook with Premium/.test(en['notebook.olderInPremium'].other) && 'notebook.olderInPremium' in hi);
eq('a short free notebook has no line', premiumLine(normalizeNotebook({ plan: 'free', hidden: 0, groups: [] })), null);
eq('a malformed response renders empty, not broken', [normalizeNotebook(null).groups, normalizeNotebook({ groups: [{ key: 'x', items: [{}] }] }).groups], [[], []]);
const screen = readFileSync(new URL('../src/notebook/MistakeNotebook.jsx', import.meta.url), 'utf8');
ok('the screen never blurs or teases hidden content', !/blur|filter:|opacity:\s*0\.[0-4]/i.test(screen.replace(/^\s*\/\/.*$/gm, '')));
ok('the screen shows the ink when kept and the first error line always', /<InkSnapshot ink=\{ink\}/.test(screen) && /data-notebook-first-error/.test(screen));
ok('the retry uses the twin route into practice', /api\.post\(`\/notebook\/\$\{id\}\/twin`/.test(screen) && /nav\('\/practice', \{ state: \{ serve:/.test(screen));
ok('ErrorNotebook still resolves to the notebook', /export \{ default \} from '\.\.\/notebook\/MistakeNotebook\.jsx'/.test(readFileSync(new URL('../src/components/ErrorNotebook.jsx', import.meta.url), 'utf8')));

// Ink store bounds
const big = Array.from({ length: 60 }, (_, s) => ({ points: Array.from({ length: 200 }, (_, i) => ({ x: 2000 + i * 7 + s, y: 300 + s * 40 + (i % 9) })) }));
const snap = snapshotStrokes(big);
ok('the snapshot fits the box', snap.w <= SNAPSHOT_BOX && snap.strokes.every(st => st.every(([x]) => x >= 0 && x <= SNAPSHOT_BOX)), `w=${snap.w}`);
ok('the snapshot is capped in characters', JSON.stringify(snap).length <= MAX_SNAPSHOT_CHARS, `${JSON.stringify(snap).length}`);
ok('the snapshot keeps the whole page (every stroke)', snap.strokes.length === 60);
ok('points are whole numbers', snap.strokes.every(st => st.every(p => Number.isInteger(p[0]) && Number.isInteger(p[1]))));
eq('compact [x,y] strokes are accepted', snapshotStrokes([{ points: [[10, 10], [20, 30]] }]), { w: 10, h: 20, strokes: [[[0, 0], [10, 20]]] });
eq('nothing written → nothing kept', snapshotStrokes([{ points: [] }]), null);
const rows = Array.from({ length: MAX_MISTAKE_INKS + 7 }, (_, i) => ({ id: `p:${i}`, createdAt: 1000 + i }));
const gone = idsBeyondCap(rows);
eq('the cap keeps the newest 200', gone.length, 7);
ok('and deletes the oldest', gone.every(id => Number(id.split(':')[1]) < 7));
eq('the row id is profile + attemptId', mistakeInkId('pid1', 'att1'), 'pid1:att1');
const idb = readFileSync(new URL('../src/local/idb.js', import.meta.url), 'utf8');
ok('mistakeInks is a sealed, profile-wiped store', /mk\('mistakeInks'/.test(idb) && /mistakeInks: \{ owner: 'pid'/.test(idb) && /\['mistakeInks', 'pid'\]/.test(idb));
const card = readFileSync(new URL('../src/components/QuestionCard.jsx', import.meta.url), 'utf8');
ok('ink is kept only after a resolved WRONG server reply with an attemptId', /if \(!diagnostic && r\.correct === false && bound\.attemptId && body\.ink\?\.strokes\?\.length\) \{\s*void saveMistakeInk\(user\?\.id, bound\.attemptId, body\.ink\.strokes\);/.test(card));

// Review reminder
const TZ = 'Asia/Kolkata';
const ON = { enabled: true, sessionHour: 17 };
const none = computeReminders({ now: NOW, timezone: TZ, settings: ON });
eq('no notebook, no plan → nothing', none, []);
const due = computeReminders({ now: NOW, timezone: TZ, settings: ON, notebook: { dueCount: 2, nextDueAt: NOW - DAY } });
eq('due entries give exactly one notebook reminder', due.filter(i => i.kind === 'notebook').length, 1);
eq('it opens the notebook and carries a count only', [due[0].url, due[0].vars], ['/notebook', { n: 2, count: 2 }]);
const later = computeReminders({ now: NOW, timezone: TZ, settings: ON, notebook: { dueCount: 0, nextDueAt: NOW + 3 * DAY } });
ok('a future due date schedules the reminder on that day', later.length === 1 && later[0].at >= NOW + 3 * DAY - DAY && later[0].at > NOW + 2 * DAY, JSON.stringify(later));
eq('off means off', computeReminders({ now: NOW, timezone: TZ, settings: { enabled: false }, notebook: { dueCount: 3 } }), []);
const streak = computeReminders({ now: zonedMs('2026-10-20', 9, TZ), timezone: TZ, settings: ON, streak: 3, reviews: [{ dueAt: NOW - DAY }], notebook: { dueCount: 1 } });
const today = streak.filter(i => i.date === '2026-10-20').map(i => i.kind);
ok('the notebook nudge never displaces the session/reviews or streak nudge', today.includes('reviews') && today.includes('streak') && !today.includes('notebook'), today.join(','));
const roomy = computeReminders({ now: zonedMs('2026-10-20', 9, TZ), timezone: TZ, settings: ON, streak: 3, notebook: { dueCount: 1 } });
ok('on a day with room it sits beside the streak nudge', ['notebook', 'streak'].every(k => roomy.some(i => i.kind === k && i.date === '2026-10-20')), roomy.map(i => i.date + i.kind).join(','));
const r = renderReminder(due[0], (k, v) => (typeof en[k] === 'string' ? en[k] : en[k].other).replace('{n}', v.n));
ok('the rendered reminder names no mark, chapter or question', !/mark|score|answer|linear|question text/i.test(`${r.title} ${r.body}`), `${r.title} ${r.body}`);
ok('copy exists in both catalogues', REMINDER_COPY.notebook.title in hi && REMINDER_COPY.notebook.body in hi);

console.log(`NOTEBOOK VIEW: ${failures.length ? 'FAIL' : 'PASS'} — ${pass}/${pass + failures.length} checks`);
for (const f of failures) console.log(`  · ${f}`);
process.exit(failures.length ? 1 : 0);
