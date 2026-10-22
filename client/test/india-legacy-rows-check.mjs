// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · India evidence on legacy (generator-keyed) rating rows (#300)
//
// A device that answered before Indian chapters had their own rating rows —
// an older install, the seeded demo — holds rows keyed by
// GENERATOR id, with no per-dot-point `dp` map. Some generators share their
// chapter's id. Two surfaces read those rows wrongly (found on PR #300,
// ported via #506):
//
//   1. The dot points of a chapter WITH answers read as untouched: a
//      generator row that merely shares the chapter's id was taken for a
//      chapter row, and its missing `dp` map read as "no answers on any dot
//      point". The dot-point targeter then ranks answered ground as new.
//   2. The predicted paper read ratings[chapterId] alone, so a unit whose
//      chapters had dozens of legacy answers was "nothing attempted yet".
//
// The converse is held too: a chapter never practised has no answers on any
// dot point and leaves its unit uncovered (the untouched-dot contract).
//
// Driven through the real local backend (GET /curriculum, GET /stats, and
// POST /practice/next for the dot-point picker) on the demo history and on a
// minimal hand-written legacy row.
//
// Usage: node client/test/india-legacy-rows-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { installBrowserEnv, resetStorage } from './backend-check.mjs';

const SRC = new URL('../src/', import.meta.url).href;

let pass = 0;
const failures = [];
const ok = (name, cond, detail = '') => { if (cond) pass++; else failures.push(`${name}${detail ? `\n      ${detail}` : ''}`); };
const eq = (name, actual, expected) => ok(name, JSON.stringify(actual) === JSON.stringify(expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);

installBrowserEnv();
resetStorage();
const { dispatch } = await import(`${SRC}local/backend.js`);
const { loadAllBanks } = await import(`${SRC}engine/generators/index.js`);
const { indiaExamBlueprint } = await import(`${SRC}engine/indiaExams.js`);
const { put } = await import(`${SRC}local/idb.js`);
await loadAllBanks();

const dpAnswers = c => (c.dotpoints || []).reduce((n, d) => n + (d.attempts || 0), 0);

/** Every surface's view of one India profile, checked against GET /curriculum. */
async function checkProfile(label, { grade, expectAnswered = 1 }) {
  const curriculum = await dispatch('GET', '/curriculum');
  const stats = await dispatch('GET', '/stats');
  const me = (await dispatch('GET', '/me')).user;
  const scope = (curriculum.years || []).find(s => Number(s.year) === grade);
  ok(`${label}: a Class ${grade} scope`, !!scope?.subtopics?.length);
  const chapters = scope?.subtopics || [];
  const answered = chapters.filter(c => c.attempts > 0);
  ok(`${label}: at least ${expectAnswered} answered chapter(s)`, answered.length >= expectAnswered, `${answered.length} answered`);

  // 1 · a chapter with answers has answers on its dot points
  for (const c of answered) {
    ok(`${label}: ${c.id} has answers on its dot points (${c.attempts} on the chapter)`, dpAnswers(c) > 0,
      `${c.attempts} chapter answers, ${dpAnswers(c)} on dot points`);
  }
  // the converse: a chapter never practised shows no dot-point answers
  for (const c of chapters.filter(ch => ch.attempts === 0)) {
    ok(`${label}: ${c.id} was never practised, so no dot point shows an answer`, dpAnswers(c) === 0,
      JSON.stringify((c.dotpoints || []).map(d => d.attempts)));
  }

  // 2 · the predicted paper counts the answers Progress shows
  const blueprint = indiaExamBlueprint({ track: me.indiaTrack || 'cbse', grade, variant: me.indiaVariant || 'standard' });
  const units = stats.examPrediction?.units || [];
  ok(`${label}: a predicted paper`, units.length > 0 && !!blueprint?.units?.length);
  const byId = new Map(chapters.map(c => [c.id, c]));
  for (const u of units) {
    const unit = blueprint.units.find(b => b.id === u.unitId);
    const fromCurriculum = (unit?.chapters || []).reduce((n, id) => n + (byId.get(id)?.attempts || 0), 0);
    eq(`${label}: unit ${u.unitId} counts the answers its chapters show`, u.attempts, fromCurriculum);
    eq(`${label}: unit ${u.unitId} is covered exactly when its chapters have answers`, u.covered, fromCurriculum > 0);
  }
  return { chapters, units };
}

// ── A · the seeded demo history (generator-keyed rows, Class 10 CBSE) ────────
await dispatch('POST', '/profiles/demo', {});
await checkProfile('demo', { grade: 10, expectAnswered: 8 });

// ── B · one hand-written legacy row that shares its chapter's id ─────────────
// Exactly the shape an older device holds: no `dp` map, keyed by generator.
resetStorage();
const created = await dispatch('POST', '/profiles', { name: 'Legacy Learner', year: 10, course: 'in' });
const pid = created?.user?.id;
ok('legacy: an India Class 10 profile', !!pid, JSON.stringify(created).slice(0, 160));
const CHAPTER = 'c10-real-numbers';
const NOW = Date.now();
await put('ratings', { key: `${pid}:${CHAPTER}`, pid, subtopic: CHAPTER, rating: 1350, attempts: 12, correct: 9, last_at: NOW - 3600e3 });
const { chapters, units } = await checkProfile('legacy', { grade: 10 });
const real = chapters.find(c => c.id === CHAPTER);
eq('legacy: the chapter shows the 12 legacy answers', real?.attempts, 12);
ok('legacy: its dot points carry those answers, not "untouched"', dpAnswers(real || {}) > 0, JSON.stringify(real?.dotpoints));
eq('legacy: every other chapter is untouched', chapters.filter(c => c.id !== CHAPTER && c.attempts > 0).map(c => c.id), []);
eq('legacy: exactly one unit is covered', units.filter(u => u.covered).length, 1);

// ── C · the dot-point picker reads the legacy evidence (R3 learning logic) ──
// indiaDotpointState also feeds the practice picker and the difficulty basis
// (backend.js, POST /practice/next). Real Numbers has two dot points: the
// generator c10-real-numbers covers dot point 0 and c10-irrationality-proofs
// dot point 1. With 12 legacy answers on dot point 0 and none on dot point 1,
// the picker (adaptive.js pickDotpoint) must treat 0 as practised ground and
// serve 1, the new ground — a margin about twice the picker's ±10 % jitter.
// Reading the legacy row as an empty chapter row (the #300 bug) made both
// look untouched and the choice a coin toss: on that code ten fresh profiles
// picking dot point 1 every time happens about once in a thousand runs.
{
  const picks = [];
  for (let i = 0; i < 10; i++) {
    resetStorage();
    const fresh = (await dispatch('POST', '/profiles', { name: `Legacy Picker ${i}`, year: 10, course: 'in' }))?.user?.id;
    await put('ratings', { key: `${fresh}:${CHAPTER}`, pid: fresh, subtopic: CHAPTER, rating: 1350, attempts: 12, correct: 9, last_at: Date.now() - 3600e3 });
    const served = await dispatch('POST', '/practice/next', { mode: 'topic', subtopic: CHAPTER });
    picks.push(served?.question?.dotpoint ?? null);
  }
  eq('picker: with legacy answers on dot point 0 only, ten fresh profiles are each served dot point 1 (new ground)', picks, Array(10).fill(1));
}

console.log(`india-legacy-rows-check: ${pass}/${pass + failures.length} checks passed`);
if (failures.length) {
  console.log(`\n${failures.length} failed:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
