// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the command bar's Library group (plan F2)
//
//   · the group is built only where PRI_FEATURE_LIBRARY is on, and "/" opens
//     the bar only there; with the flag off the bar is as it was;
//   · matches are found over title, subject, year, type and tags, every word;
//     saved resources rank first; at most six; a `>` query lists none;
//   · the list is read once when the bar opens and the search runs on the
//     device: no transport call is made by typing;
//   · keyboard behaviour is the bar's own (one list, ↑ ↓ ↵ esc), unchanged.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const root = fileURLToPath(new URL('..', import.meta.url));
const read = rel => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

const { createServer } = await import('vite');
const react = (await import('@vitejs/plugin-react')).default;
const server = await createServer({
  root, configFile: false, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true },
  plugins: [react()], define: { __PRI_FEATURE_TUTOR__: 'false', __PRI_PRODUCTION_BUILD__: 'false' }
});

try {
  const bar = await server.ssrLoadModule('/src/instrument/CommandBar.jsx');
  const i18n = await server.ssrLoadModule('/src/i18n/index.js');
  await i18n.setLanguage('en');
  const t = (k, v) => i18n.translate(k, v);
  const R = (id, title, o = {}) => ({ id, title, subject: 'Mathematics Advanced', year: 2024, type: 'paper', tags: [], ...o });
  const list = [
    R('nsw-2024-paper', '2024 Mathematics Advanced Trial Paper', { tags: ['trial', 'hsc'] }),
    R('nsw-2023-paper', '2023 Mathematics Advanced Trial Paper', { year: 2023, tags: ['trial'] }),
    R('calculus-notes', 'Calculus notes', { type: 'notes', subject: 'Mathematics Extension 1', year: 2024, tags: ['derivatives'] }),
    R('geometry-solutions', 'Geometry worked answers', { type: 'solutions', year: 2022 })
  ];
  const ids = (q, saved = []) => bar.libraryRows(list, new Set(saved), q, t).map(r => r.id);
  ok(ids('').length === 0, 'an empty query lists no resource');
  ok(ids('trial').join() === 'nsw-2024-paper,nsw-2023-paper', 'tags and title match');
  ok(ids('derivatives').join() === 'calculus-notes', 'a tag matches');
  ok(ids('extension 1 2024').join() === 'calculus-notes', 'every word must match across subject and year');
  ok(ids('notes').includes('calculus-notes'), 'the type is searchable by its name');
  ok(ids('solutions 2022').join() === 'geometry-solutions', 'type and year together');
  ok(ids('trial', ['nsw-2023-paper']).join() === 'nsw-2023-paper,nsw-2024-paper', 'saved resources rank first');
  ok(ids('> trial').length === 0, 'a > query is commands only: no resource');
  ok(ids('zzzzz').length === 0, 'no match, no row');
  const many = Array.from({ length: 12 }, (_, i) => R(`paper-${i}`, `Trial ${i}`));
  ok(bar.libraryRows(many, new Set(), 'trial', t).length === 6, 'at most six rows');
} finally {
  await server.close();
}

const src = read('src/instrument/CommandBar.jsx');
ok(/const LIBRARY_ON = featureEnabled\('library'\);/.test(src) && /\.\.\.\(LIBRARY_ON \? \[\{ key: 'library'/.test(src), 'the Library group is built only where the flag is on');
const effect = src.slice(src.indexOf('useEffect(() => {'), src.indexOf('const items = useMemo'));
ok(/if \(LIBRARY_ON\) \{[\s\S]*cachedLibraryList\([^)]*\)[\s\S]*api\.get\('\/library\/saved'\)/.test(effect), 'the list and saved ids are read when the bar opens, behind the flag');
const memo = src.slice(src.indexOf('const items = useMemo'), src.indexOf('const flat = '));
ok(!/api\.|cloudRequest|fetch\(|cachedLibraryList/.test(memo), 'building the rows (every keystroke) makes no call');
ok(!/onChange=\{[^}]*(api\.|cachedLibraryList|fetch)/.test(src), 'typing in the field makes no call');
ok(/e\.key === 'ArrowDown'/.test(src) && /e\.key === 'ArrowUp'/.test(src) && /e\.key === 'Enter'/.test(src) && /e\.key === 'Escape'/.test(src), 'the keyboard handling is the bar\'s own');
ok(/role="dialog" aria-modal="true"/.test(src) && /role="listbox"/.test(src) && /role="option"/.test(src) && /role="group" aria-label=\{g\.label\}/.test(src), 'the dialog, listbox, options and labelled groups are intact');
const instr = read('src/instrument/InstrumentBar.jsx');
ok(/const slash = LIBRARY_ON && e\.key === '\/'/.test(instr) && /\[data-instrument-command\]/.test(instr), '"/" opens the bar only with the flag on, and never from a field');
ok(/cachedLibraryList/.test(read('src/library/libraryApi.js')) && /listedFor !== owner/.test(read('src/library/libraryApi.js')), 'the edition list is kept per signed-in profile and a failure is not kept');

if (failures.length) {
  console.error(`COMMAND BAR LIBRARY: FAIL — ${failures.length} of ${pass + failures.length} checks failed`);
  for (const f of failures) console.error(`  · ${f}`);
  process.exit(1);
}
console.log(`COMMAND BAR LIBRARY: PASS — ${pass}/${pass} checks`);
