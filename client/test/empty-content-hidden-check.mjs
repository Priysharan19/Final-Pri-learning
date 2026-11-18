// Pri Learning · empty content is hidden, never offered (owner decision 2026-11-18)
//
// A chapter with no question at any level, and a difficulty level with no
// question for a chapter, must not be offered anywhere: no "no questions for
// this topic yet" dead end. The truth is the real availability the product's own
// GET /curriculum reports (`requestable`: the server's issued cells on the
// Prithagoras edition, the authored forms on Priyabhata), never a hand list.
//
// For every profile shape of both editions (NSW Years 7-12 and every senior
// pathway; India classes 7-12 on CBSE, JEE Main, JEE Advanced and Olympiad) this
// suite asserts that
//   - every chapter the screens list (the instrument scope the Index, Map and
//     command bar draw, the Home picker's list, the Tasks list) has at least one
//     requestable level;
//   - every level a screen offers for such a chapter really yields a question
//     from the generators, across several seeds;
//   - every chapter left out had no level at all, and every chapter with a
//     level is still listed (nothing is hidden by accident);
// and prints the hidden cells, so the list can be read.
//
// SYNTHETIC: generated questions, no student.
import { installBrowserEnv, resetStorage } from './backend-check.mjs';

installBrowserEnv();
resetStorage();
const { dispatch } = await import('../src/local/backend.js');
const { loadAllBanks, generateQuestion } = await import('../src/engine/generators/index.js');
const { chapterOffered, offeredChapters, selectableDifficulties } = await import('../src/engine/curriculumAvailability.js');
const { scopeFor } = await import('../src/instrument/chapters.js');
const { indiaChapter, resolveIndiaTarget } = await import('../src/engine/indiaProduct.js');
await loadAllBanks();

let pass = 0;
const failures = [];
const ok = (name, condition, detail = '') => { if (condition) pass++; else failures.push(`${name}${detail ? ` — ${detail}` : ''}`); };
const POST = (path, body = {}) => dispatch('POST', path, body);
const GET = path => dispatch('GET', path);
const SEEDS = [1, 7, 42, 1001, 31337];

/** Does the engine really produce a question for this generator at this level? */
function yields(generator, difficulty) {
  let made = 0;
  for (const seed of SEEDS) {
    try {
      const q = generateQuestion(generator, difficulty, seed);
      if (q && typeof q.prompt === 'string' && q.prompt.length > 0) made++;
    } catch { /* a seed that cannot be built is not a question */ }
  }
  return made > 0;
}

const hidden = [];
const hiddenLevels = [];
const seenCell = new Set();
let listed = 0, levelsChecked = 0;

async function sweep(label, spec, generatorOf) {
  const user = (await POST('/profiles', { name: label.slice(0, 20), ...spec })).user;
  await POST('/profiles/select', { id: user.id });
  const curriculum = await GET('/curriculum');
  const sections = [...(curriculum.years || []), ...(curriculum.streams || [])];
  // Every chapter the product knows of for this profile, by section.
  for (const section of sections) {
    const all = section.subtopics || [];
    const offered = offeredChapters(all);
    for (const row of all) {
      const has = Array.isArray(row.requestable) && row.requestable.length > 0;
      ok(`${label} · ${section.key || section.year}: ${row.id} is offered exactly when it has a level`, chapterOffered(row) === has, JSON.stringify(row.requestable));
      if (!has && !seenCell.has(`${spec.course || 'nsw'}|${row.id}`)) { seenCell.add(`${spec.course || 'nsw'}|${row.id}`); hidden.push(`${spec.course === 'in' ? 'Priyabhata' : 'Prithagoras'} · ${section.title || section.key} · ${row.id} (${row.name})`); }
    }
    ok(`${label} · ${section.key || section.year}: the offered list is the chapters with a level`, offered.length === all.filter(r => (r.requestable || []).length > 0).length);
    for (const row of offered) {
      listed++;
      const levels = row.requestable;
      ok(`${label} · ${row.id}: lists at least one level`, levels.length > 0);
      for (const d of levels) {
        levelsChecked++;
        const generator = generatorOf(row, section, d);
        ok(`${label} · ${row.id} D${d}: a question exists`, !!generator && yields(generator, d), String(generator));
      }
      // The levels a picker may draw are exactly these.
      ok(`${label} · ${row.id}: the picker draws only those levels`, JSON.stringify(selectableDifficulties([1, 2, 3, 4], row)) === JSON.stringify([1, 2, 3, 4].filter(d => levels.includes(d))));
      const missing = [section.difficultyFloor || 1, section.difficultyCeiling || 4].length && Array.from({ length: (section.difficultyCeiling || 4) - (section.difficultyFloor || 1) + 1 }, (_, i) => (section.difficultyFloor || 1) + i).filter(d => !levels.includes(d));
      if (missing.length && !seenCell.has(`${spec.course || 'nsw'}|${row.id}|levels`)) {
        seenCell.add(`${spec.course || 'nsw'}|${row.id}|levels`);
        hiddenLevels.push(`${spec.course === 'in' ? 'Priyabhata' : 'Prithagoras'} · ${row.id} (${row.name}): not offered at ${missing.map(d => `D${d}`).join(', ')}`);
      }
    }
    // The screens' own scope (Index, Map, command bar) draws the same list.
    const scope = scopeFor({ years: curriculum.years, streams: curriculum.streams }, user);
    if (scope) {
      const rows = scope.chapters || scope.subtopics || [];
      ok(`${label}: the instrument scope lists only chapters with a level`, rows.every(r => (r.requestable || []).length > 0) && rows.length > 0, `${rows.length} rows`);
    }
  }
}

try {
  const nswGenerator = row => row.id;
  const NSW = [[7], [8], [9], [10], [11, 'standard'], [11, 'advanced'], [11, 'ext1'], [12, 'standard'], [12, 'advanced'], [12, 'ext1'], [12, 'ext2']];
  for (const [year, pathway] of NSW) await sweep(`NSW Year ${year}${pathway ? ` ${pathway}` : ''}`, { year, course: 'nsw', ...(pathway ? { pathway } : {}) }, nswGenerator);

  const indiaGenerator = (row, section, d) => {
    const chapter = indiaChapter(row.id);
    const t = chapter && resolveIndiaTarget(chapter, { difficulty: d, track: section.track, grade: section.year ?? undefined, random: () => 0 });
    return t?.generator || null;
  };
  const INDIA = [
    ...[7, 8, 9, 10, 11, 12].map(year => ({ year, indiaTrack: 'cbse' })),
    ...[11, 12].flatMap(year => [{ year, indiaTrack: 'jee-main' }, { year, indiaTrack: 'jee-advanced' }]),
    { year: 9, indiaTrack: 'olympiad' }
  ];
  for (const spec of INDIA) await sweep(`India Class ${spec.year} ${spec.indiaTrack}`, { ...spec, course: 'in' }, indiaGenerator);

  // The named case was Year 12 Financial Maths & Annuities, hidden while no level of
  // it was issued. The marking release issues its D2-D4 forms (engine/nswIssuedCells.js),
  // so it is now listed, with levels the server really serves; a chapter is hidden only
  // while it has none (Combinatorics and Further Calculus, asserted below).
  const y12 = (await POST('/profiles', { name: 'Fin', year: 12, course: 'nsw', pathway: 'advanced' })).user;
  await POST('/profiles/select', { id: y12.id });
  const cur = await GET('/curriculum');
  const ids = scopeFor(cur, y12).subtopics.map(s => s.id);
  ok('Year 12 Financial Maths & Annuities (y12-financial) is listed now that D2-D4 are issued', ids.includes('y12-financial'));
  ok('Year 12 Financial Mathematics: Practice (y12-fin-exact) is listed', ids.includes('y12-fin-exact'));
  ok('the three renamed chapters read ": Practice"', ['y12-integral-calc', 'y12-random-var', 'y12-fin-exact'].every(id => /: Practice$/.test(scopeFor(cur, y12).subtopics.find(s => s.id === id)?.name || '')));
} catch (err) {
  failures.push(`the suite stopped: ${err.stack || err.message}`);
}

// The screens that list chapters outside the instrument scope take the same rule.
{
  const { readFileSync } = await import('node:fs');
  const src = f => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
  ok('the Home picker leaves out a chapter with no level', /if \(!chapterOffered\(s\)\) continue;/.test(src('home/TopicGenerator.jsx')));
  ok('the Tasks chapter list leaves out a chapter with no level', (src('pages/Tasks.jsx').match(/offeredChapters\(/g) || []).length >= 2);
  ok('the Progress chapter list leaves out a chapter with no level', /offeredChapters\(scope\?\.subtopics\)/.test(src('pages/ProgressAustralia.jsx')));
  ok('the teacher workspace lists only chapters the server issues', /filter\(s => nswIssuedLevels\(s\.id\)\.length > 0\)/.test(src('pages/Teach.jsx')));
  ok('the instrument scope (Index, Map, command bar, report head, History) is filtered in one place', /offeredChapters\(scope\.chapters\)/.test(src('instrument/chapters.js')) && /offeredChapters\(scope\.subtopics\)/.test(src('instrument/chapters.js')));
}

// Every chapter that still has no issued level is hidden: these two (Extension 1 Combinatorics and Further Calculus) are the ones left.
ok('the NSW chapters that still have no issued level are hidden', hidden.length >= 2 && hidden.some(h => /me11-comb/.test(h)) && hidden.some(h => /me12-calc/.test(h)), `${hidden.length}: ${hidden.join(' | ')}`);
if (process.env.LIST_HIDDEN) console.log(`HIDDEN CHAPTERS (${hidden.length})\n  ${hidden.join('\n  ')}\nHIDDEN LEVELS (${hiddenLevels.length})\n  ${hiddenLevels.join('\n  ')}`);

const total = pass + failures.length;
if (failures.length) {
  console.log(`EMPTY CONTENT HIDDEN: FAIL — ${failures.length} of ${total} checks failed\n  · ${failures.slice(0, 40).join('\n  · ')}`);
  process.exit(1);
}
console.log(`EMPTY CONTENT HIDDEN: PASS — ${pass} checks — ${listed} offered chapters x profile shapes, ${levelsChecked} offered levels each yielding a question, ${hidden.length} empty chapters hidden, ${hiddenLevels.length} chapters with a level not offered`);
process.exit(0);
