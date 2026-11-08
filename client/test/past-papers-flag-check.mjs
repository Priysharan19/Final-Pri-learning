// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · past papers are OFF by default (decision D23, 1 Nov 2026)
//
// No written rights opinion exists for the NTA, JAB and CBSE transcriptions in
// the two previous-year archives, so until one does nothing from either archive
// may reach a student: not under the "past papers only" filter, not in the
// ordinary practice pool, and not as a cell of a timed paper. This suite pins
// that default on the engine the server and the device both run, and then
// flips the switch on to prove the archive code is still there behind it — a
// switch, not a deletion — and off again.
//
// Suites that certify the archive machinery itself (india-pyq-check,
// jee-question-department-check, first-run-daily-use-check, the content
// certification regressions, server exam-authority-check) opt in with
// PRI_PAST_PAPERS=1 and say so at their top.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// The default is what production gets: no environment switch, no override.
delete process.env.PRI_PAST_PAPERS;
delete globalThis.__PRI_PAST_PAPERS__;

const { pastPapersEnabled, pastPapersStatus, PAST_PAPERS_OFF_REASON } = await import('../src/engine/pastPapers.js');
const { IN_CURRICULUM } = await import('../src/engine/curriculum-in.js');
const { indiaScope, resolveIndiaTarget, indiaPyqAlternatives, indiaDifficultyWindow } = await import('../src/engine/indiaProduct.js');
const { indiaPyqCells, indiaIssuableCells, narrowCells } = await import('../src/engine/indiaExamCells.js');
const { PYQ_COVERAGE } = await import('../src/engine/pyq/pyqCoverage.js');
const { composeIndiaPaper } = await import('../src/engine/indiaExamComposer.js');
const { indiaExamPaperSpec } = await import('../src/engine/indiaExams.js');
const { generateQuestion, loadAllBanks, loadBanksFor } = await import('../src/engine/generators/index.js');
const { enumeratePaths } = await import('./content-certify.mjs');
const { featureStates, PENDING_FEATURE_FLAGS } = await import('../vite.config.js');

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (actual, expected, label) => ok(actual === expected, `${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);

await loadAllBanks();

const TRACKS = [['cbse', [7, 8, 9, 10, 11, 12]], ['jee-main', [11, 12]], ['jee-advanced', [11, 12]]];
const ARCHIVE_GENERATOR = /^(pyq-|jee-main-|jee-advanced-)/;

// ── 1. The default ───────────────────────────────────────────────────────────
eq(pastPapersEnabled(), false, 'past papers are off with no environment switch and no override');
eq(pastPapersStatus().reason, PAST_PAPERS_OFF_REASON, 'the off state names its reason');
eq(PAST_PAPERS_OFF_REASON, 'rights-opinion-pending', 'and the reason is the pending rights opinion');

// ── 2. Practice: no archive target anywhere, and the filter is refused ──────
{
  let targets = 0, archive = 0, filterServed = 0, chapterPaths = 0;
  for (const [track, grades] of TRACKS) {
    for (const grade of grades) {
      const { floor, ceiling } = indiaDifficultyWindow(track, grade);
      for (const chapter of indiaScope(track, grade)) {
        chapterPaths++;
        const dotpoints = [null, ...(chapter.dotpoints || []).map((_, i) => i)];
        for (const dotpoint of dotpoints) {
          for (let d = floor; d <= ceiling; d++) {
            for (const r of [0, 0.5, 0.999]) {
              const t = resolveIndiaTarget(chapter, { track, grade, dotpoint, difficulty: d, random: () => r });
              if (!t) continue;
              targets++;
              if (t.pyq || t.pyqArchive || ARCHIVE_GENERATOR.test(t.generator)) archive++;
            }
          }
        }
        for (let d = floor; d <= ceiling; d++) {
          if (resolveIndiaTarget(chapter, { track, grade, difficulty: d, pyqOnly: true, random: () => 0 })) filterServed++;
        }
        if (indiaPyqAlternatives(chapter, { track, grade }).length) filterServed++;
      }
    }
  }
  ok(targets > 1000, `the sweep resolved real targets (${targets})`);
  eq(archive, 0, `no resolved practice target is a previous-year item (${archive} of ${targets})`);
  eq(filterServed, 0, `"past papers only" is refused on every chapter at every rung, and offers no alternatives (${filterServed} served across ${chapterPaths} chapters)`);
}

// ── 3. Papers: no previous-year cell is issuable, on the device or the server ─
{
  let cells = 0;
  for (const [track, grades] of TRACKS) {
    for (const grade of grades) {
      const chapters = indiaScope(track, grade);
      cells += indiaPyqCells(track, chapters).size;
      const issuable = indiaIssuableCells(track, grade);
      ok(issuable && [...issuable.generators].every(g => !ARCHIVE_GENERATOR.test(g)), `${track}/${grade}: no archive generator is issuable`);
    }
  }
  eq(cells, 0, 'indiaPyqCells is empty for every V1 track and class');
  const issuable12 = indiaIssuableCells('cbse', 12);
  ok(Object.keys(PYQ_COVERAGE).length > 0, 'the source-cited archive still publishes coverage (it is switched off, not deleted)');
  ok(!issuable12.has({ generator: 'pyq-cbse-c12-matrices', difficulty: 2 }) && !issuable12.isPyq({ generator: 'pyq-cbse-c12-matrices', difficulty: 2 }),
    'a spec naming an archive cell is outside the issuable set');
  const jee = indiaIssuableCells('jee-main', 12);
  ok(!jee.has({ generator: 'jee-main-c11-complex-numbers', difficulty: 3 }), 'a spec naming a JEE department cell is outside the issuable set');
}

{
  // Three real compositions through the composer the device and the server
  // share, with the past-paper cells exactly as indiaPyqCells now gives them.
  for (const sel of [{ track: 'cbse', grade: 12, variant: 'standard' }, { track: 'jee-main', grade: 12, variant: 'standard' }, { track: 'jee-advanced', grade: 12, variant: 'standard' }]) {
    const spec = indiaExamPaperSpec(sel);
    ok(!!spec, `${sel.track}/${sel.grade} has a released blueprint`);
    if (!spec) continue;
    const chapters = indiaScope(sel.track, sel.grade);
    const pyq = indiaPyqCells(sel.track, chapters);
    await loadBanksFor([...new Set([...pyq.values()].flatMap(list => list.map(cell => cell.generator)))]);
    const paper = composeIndiaPaper(spec, { seed: 20261101, draw: generateQuestion, chapters, pyqCellsFor: (chapter, range) => narrowCells(pyq.get(chapter.id) || [], range) });
    ok(paper.questions.length > 0, `${sel.track}/${sel.grade}: a paper still composes from authored cells alone (${paper.questions.length} items)`);
    eq(paper.composition.pyq, 0, `${sel.track}/${sel.grade}: the paper holds no previous-year item`);
    ok(paper.questions.every(q => !q.pyq && !ARCHIVE_GENERATOR.test(q.generator || '')), `${sel.track}/${sel.grade}: no sealed item comes from an archive generator`);
  }
}

// ── 4. Certification enumerates the archive paths as refused, not advertised ─
{
  const paths = enumeratePaths();
  const archivePaths = paths.filter(p => p.pyqOnly);
  ok(archivePaths.length > 0, `the past-paper paths stay enumerated (${archivePaths.length}) so the certified path count holds`);
  ok(archivePaths.every(p => p.advertised === false), 'and every one of them is unadvertised: its declared state is the refusal');
}

// ── 5. The interface offers no filter it cannot honour ──────────────────────
{
  const base = readFileSync(join(ROOT, 'client/src/pages/PracticeBase.jsx'), 'utf8');
  const toggles = base.split("className=\"icon-btn ws-filter\"").length - 1;
  eq(toggles, 2, 'PracticeBase renders the past-papers toggle in the bar and in the inline row');
  eq((base.match(/pastPapersOn && user\.course === 'in' && !assignmentMode && !taskId && \(/g) || []).length, 2, 'both toggles are gated on the past-papers switch');
  ok(base.includes("import { pastPapersEnabled } from '../engine/pastPapers.js'"), 'the page reads the same switch the engine does');
}

// ── 6. The build flag is opt-in everywhere ──────────────────────────────────
{
  ok(PENDING_FEATURE_FLAGS.includes('PAST_PAPERS'), 'PAST_PAPERS is a declared build flag');
  eq(featureStates('build', {}).pastPapers, false, 'a production build without PRI_FEATURE_PAST_PAPERS builds it off');
  eq(featureStates('serve', {}).pastPapers, false, 'the dev server builds it off too (opt-in, not default-on like the other dev flags)');
  eq(featureStates('build', { PRI_FEATURE_PAST_PAPERS: '1' }).pastPapers, true, 'PRI_FEATURE_PAST_PAPERS=1 builds it on');
}

// ── 7. It is a switch: on, the archives are reachable again ─────────────────
{
  globalThis.__PRI_PAST_PAPERS__ = true;
  eq(pastPapersEnabled(), true, 'the runtime override turns past papers on');
  const matrices = indiaScope('cbse', 12).find(c => c.id === 'c12-matrices');
  const on = resolveIndiaTarget(matrices, { track: 'cbse', grade: 12, difficulty: 2, pyqOnly: true, random: () => 0 });
  ok(on?.pyq === true && on.generator === 'pyq-cbse-c12-matrices', 'on: past-papers-only practice resolves to the archive');
  ok(indiaPyqCells('jee-main', indiaScope('jee-main', 12)).size > 0, 'on: JEE papers have previous-year cells again');
  ok(enumeratePaths().filter(p => p.pyqOnly).every(p => p.advertised === true), 'on: the past-paper certification paths are advertised');
  delete globalThis.__PRI_PAST_PAPERS__;
  eq(pastPapersEnabled(), false, 'and off again once the override is removed');
  process.env.PRI_PAST_PAPERS = '1';
  eq(pastPapersEnabled(), true, 'PRI_PAST_PAPERS=1 turns it on for a server process');
  process.env.PRI_PAST_PAPERS = '0';
  eq(pastPapersEnabled(), false, 'PRI_PAST_PAPERS=0 keeps it off');
  delete process.env.PRI_PAST_PAPERS;
  eq(pastPapersEnabled(), false, 'unset is off');
}

const total = pass + failures.length;
if (failures.length) {
  for (const f of failures) console.log(`FAIL ${f}`);
  console.log(`PAST PAPERS SWITCH: FAIL — ${pass}/${total} checks`);
  process.exit(1);
}
console.log(`PAST PAPERS SWITCH: PASS — ${pass}/${total} checks — default off: no previous-year item reachable in practice or papers; on by PRI_PAST_PAPERS=1 / PRI_FEATURE_PAST_PAPERS=1 only`);
