// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · nothing an Indian student touches is still Australian
//
// This product was built for NSW and pivoted to India. The pivot moved the
// curriculum and the exams; it did not move everything, and what it left behind
// is the kind of thing a student notices immediately and a test never does.
//
// Two that were live:
//
//   · Rapid Fire and Match — two top-level navigation items — called
//     scopeForYear(), the NSW scope, for every profile. An Indian Class 10
//     student playing Rapid Fire was answering MA5 subtopics, and the results
//     were then counted into India Progress.
//   · A JEE mock scoring above 90% ended with "Outstanding — Band 6 territory."
//     A band is an NSW HSC construct. It means nothing in India.
//
// Copy assertions are brittle by nature, so each one here names a specific
// Australian construct rather than policing tone.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { installBrowserEnv, resetStorage } from './backend-check.mjs';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
const read = f => readFileSync(f, 'utf8');

// ── 1 · No Australian qualification vocabulary on a shared surface ───────────
// These render for every profile, India included, so an Australian construct
// here reaches an Indian student directly.
const SHARED = [
  'client/src/pages/ExamRoom.jsx',
  'client/src/components/QuestionCard.jsx',
  'client/src/pages/Rush.jsx',
  'client/src/pages/Match.jsx'
];
const BANNED = [
  [/Band\s*[1-6]\b/, 'an NSW HSC band'],
  [/\bATAR\b/, 'an ATAR'],
  [/\bHSC\b/, 'the HSC'],
  [/\bNAPLAN\b/, 'NAPLAN']
];
for (const file of SHARED) {
  const src = read(file);
  for (const [re, what] of BANNED) {
    ok(!re.test(src), `${file} does not show ${what} to a student who may be Indian`);
  }
}

// ── 2 · Where Australian vocabulary IS allowed, it is branched ───────────────
const settings = read('client/src/pages/SettingsLegacy.jsx');
ok(/user\.course === 'in'/.test(settings),
  'Settings branches its explanation on the course rather than describing one country to everyone');
ok(/calibrated to HSC bands/.test(settings) === true && /course === 'in'\s*\?[\s\S]{0,400}CBSE percentage/.test(settings),
  'the HSC sentence is reachable only on the Australian branch, and the India branch describes what India actually gets');

// ── 3 · The game modes draw from the student's own curriculum ───────────────
// The behavioural half. A copy check would not have caught this one.
await installBrowserEnv();
await resetStorage();
const { dispatch } = await import('../src/local/backend.js');
const { loadAllBanks } = await import('../src/engine/generators/index.js');
await loadAllBanks();

const call = (method, path, body) => dispatch(method, path, body);
await call('POST', '/profiles', { name: 'Aarav', year: 10, course: 'in', indiaTrack: 'cbse' });

const rush = await call('POST', '/rush/start', {});
eq(rush.questions.length, 20, 'Rapid Fire still deals a full round');
// The invariant is that the round is drawn from THIS student's curriculum, not
// that the generator id looks Indian. Some India chapters still map to
// Australian-authored generators — a known, separately-tracked gap — and that is
// a content-authoring problem, not a scope problem. What was broken here was the
// scope: Rapid Fire asked the NSW spine which subtopics existed at all.
const { IN_CHAPTERS } = await import('../src/engine/curriculum-in.js');
const declared = new Set(IN_CHAPTERS.flatMap(ch => (ch.covers || []).map(c => c.gen)));

const rushIds = [...new Set(rush.questions.map(q => q.subtopic))];
ok(rushIds.length > 0, 'and the round names the generators it drew from');
const strayRush = rushIds.filter(id => !declared.has(id));
eq(strayRush, [], 'every Rapid Fire question comes from a generator the India curriculum declares');

const match = await call('POST', '/match/start', { rival: 'rookie' });
const matchIds = [...new Set((match.questions || []).map(q => q.subtopic))];
ok(matchIds.length > 0, 'Match deals a round too');
eq(matchIds.filter(id => !declared.has(id)), [], 'and so does every Match question');

// The NSW spine offers subtopics the India curriculum never declares; before
// this fix the rounds were drawn from exactly that set.
const { scopeForYear } = await import('../src/engine/curriculum.js');
const nswOnly = [...scopeForYear(10, 'advanced').own, ...scopeForYear(10, 'advanced').revision]
  .map(s => s.id).filter(id => !declared.has(id));
ok(nswOnly.length > 0, 'the NSW scope does contain subtopics India never declares, so this check can fail');

// An Australian profile must still get the Australian scope — this is a pivot,
// not a deletion, and those courses still ship.
await resetStorage();
await call('POST', '/profiles', { name: 'Mia', year: 10, course: 'nsw', pathway: 'advanced' });
const auRush = await call('POST', '/rush/start', {});
const auIds = [...new Set(auRush.questions.map(q => q.subtopic))];
ok(auIds.some(id => !declared.has(id)),
  'an Australian profile still draws from the Australian scope, so this narrowed nothing');

console.log(failures.length
  ? `INDIA NATIVE SURFACES: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `INDIA NATIVE SURFACES: PASS — ${pass}/${pass} checks — no band, no ATAR, no HSC on a shared screen, and the game modes draw from the student's own curriculum.`);
process.exit(failures.length ? 1 : 0);
