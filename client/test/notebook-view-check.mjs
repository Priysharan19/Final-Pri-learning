// Pri Learning · the mistake notebook on screen (client/src/notebook/notebookView.js
// and components/ErrorNotebook.jsx).
//   · what the server sent is rendered and nothing is decided here: fixed,
//     due and the first broken line are the server's;
//   · topics first, slips inside them, due before not due, newest first;
//   · a server older than the notebook (only `entries`) still shows its
//     misconception groups, with nothing invented for them;
//   · a slip the marker named is named; one it named nothing in says so;
//   · the strings exist in English and Hindi.
// Usage: node client/test/notebook-view-check.mjs
import { readFileSync } from 'node:fs';

const en = (await import('../src/i18n/strings.en.js')).default;
const hi = (await import('../src/i18n/strings.hi.js')).default;
const { translateEnglish } = await import('../src/i18n/index.js');
const { normalizeNotebook, notebookSections, slipLabel } = await import('../src/notebook/notebookView.js');

let pass = 0; const failures = [];
const ok = (name, cond, detail = '') => { if (cond) pass++; else failures.push(`${name}${detail ? ` — ${detail}` : ''}`); };
const eq = (name, a, b) => ok(name, JSON.stringify(a) === JSON.stringify(b), `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

const T = Date.UTC(2026, 10, 8, 6, 0, 0);
const DAY = 24 * 60 * 60 * 1000;
const item = (id, at, extra = {}) => ({ id, subtopic: extra.subtopic || 'c10-quadratic-equations', answeredAt: at, marksEarned: 1, marksPossible: 3,
  review: { stage: 0, dueAt: at + DAY, due: false }, fixed: false, prompt: `Solve ${id}`, canTwin: true, ...extra });
const server = {
  available: true,
  notebook: {
    total: 4, shown: 4, dueCount: 1, nextDueAt: T,
    groups: [
      { key: 'c10-quadratic-equations::unclassified', subtopic: 'c10-quadratic-equations', chapterName: 'Quadratic Equations', misconception: null, count: 2,
        items: [item('q-old', T - 5 * DAY), item('q-new', T - DAY, { firstError: { line: 2, text: 'x = 8', note: 'Adding 14 gives 9.' } })] },
      { key: 'c10-quadratic-equations::sign-flip', subtopic: 'c10-quadratic-equations', chapterName: 'Quadratic Equations',
        misconception: { id: 'sign-flip', nameKey: 'misconception.signFlip', label: 'Sign flip' }, count: 1,
        items: [item('q-due', T - 3 * DAY, { review: { stage: 1, dueAt: T - 1, due: true } })] },
      { key: 'c10-triangles::unclassified', subtopic: 'c10-triangles', chapterName: 'Triangles', misconception: null, count: 1,
        items: [item('t-fixed', T - 2 * DAY, { subtopic: 'c10-triangles', fixed: true, review: { stage: null, dueAt: null, due: false } })] },
      { key: '', subtopic: 'junk', items: [item('lost', T)] }
    ]
  }
};
const book = normalizeNotebook(server);
eq('the server\'s totals are kept', [book.available, book.total, book.dueCount], [true, 4, 1]);
eq('a group without a key is dropped, not invented', book.groups.map(g => g.key), ['c10-quadratic-equations::unclassified', 'c10-quadratic-equations::sign-flip', 'c10-triangles::unclassified']);
const sections = notebookSections(book);
eq('topics with something due come first', sections.map(s => s.subtopic), ['c10-quadratic-equations', 'c10-triangles']);
eq('inside a topic, the slip with something due comes first', sections[0].groups.map(g => g.key), ['c10-quadratic-equations::sign-flip', 'c10-quadratic-equations::unclassified']);
eq('inside a slip, newest first', sections[0].groups[1].items.map(i => i.id), ['q-new', 'q-old']);
eq('the first broken line is the server\'s, as sent', sections[0].groups[1].items[0].firstError, { line: 2, text: 'x = 8', note: 'Adding 14 gives 9.' });
eq('fixed and due are the server\'s', [sections[1].groups[0].items[0].fixed, sections[0].groups[0].items[0].review.due], [true, true]);
eq('counts per topic', [sections[0].due, sections[0].open, sections[1].open], [1, 3, 0]);
const t = (k, v) => translateEnglish(k, v);
eq('a named slip is named; an undiagnosed one says no slip was named', [slipLabel(book.groups[1], k => k), slipLabel(book.groups[0], t)], ['misconception.signFlip', 'No slip named']);
eq('a slip with only an authored label shows that label', slipLabel({ misconception: { id: 'x', label: 'Dropped the sign' } }, t), 'Dropped the sign');

// An older server: only the misconception groups.
const legacy = normalizeNotebook({ available: true, entries: [{ key: 'pct-divides', misconception: { id: 'pct-divides', nameKey: null, label: 'Divides by the percentage' }, count: 2, chapterNames: ['Percentages'],
  items: [{ id: 'l1', prompt: '30% of 90', answeredAt: T, canTwin: true }] }] });
eq('an older server\'s groups are shown under their chapter', [legacy.total, legacy.groups[0].chapterName, legacy.groups[0].items[0].id], [2, 'Percentages', 'l1']);
eq('with nothing invented for them: no first error, not fixed, not scheduled', [legacy.groups[0].items[0].firstError, legacy.groups[0].items[0].fixed, legacy.groups[0].items[0].review.dueAt], [null, false, null]);
eq('signed out and offline say so', [normalizeNotebook({ entries: [], available: false, reason: 'sign-in' }).reason, normalizeNotebook(null).groups], ['sign-in', []]);
eq('nonsense is safe', normalizeNotebook({ notebook: { groups: 'no' } }).groups, []);

// The component shows what was sent and asks the server for twins.
const component = readFileSync(new URL('../src/components/ErrorNotebook.jsx', import.meta.url), 'utf8');
ok('the component renders the first broken line, fixed and due states', /data-notebook-first-error/.test(component) && /data-notebook-state="fixed"/.test(component) && /data-notebook-state="due"/.test(component));
ok('a fixed mistake offers no twin', /item\.canTwin && !item\.fixed/.test(component));
ok('it decides nothing itself: no date arithmetic on review', !/Date\.now\(\)|DAY_MS|REVIEW_INTERVALS/.test(component));
const used = [...new Set([...component.matchAll(/'(notebook\.[A-Za-z]+)'/g)].map(m => m[1]).concat(['notebook.noSlipNamed', 'notebook.unnamedSlip']))];
for (const [lang, cat] of [['en', en], ['hi', hi]]) ok(`every notebook string exists in ${lang}`, used.every(k => cat[k] !== undefined), used.filter(k => cat[k] === undefined).join(', '));

console.log(`Notebook view — ${pass}/${pass + failures.length} checks`);
if (failures.length) {
  console.log('\nfailures:');
  for (const line of failures) console.log(`  ${line}`);
}
console.log(`\nNOTEBOOK VIEW: ${failures.length ? 'FAIL' : 'PASS'} — ${pass}/${pass + failures.length} checks`);
process.exit(failures.length ? 1 : 0);
