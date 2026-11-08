// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · #680, the case set its comments preserve
//
// Issue #680 reported 197 wrong answers the checker credited on main
// a5778a319 (104 shifted interval boundaries; 93 malformed or mismatched
// answers), with 44 valid controls and 26 far-wrong controls. The frozen
// manifest of those cases was never committed and is lost. This is what the
// issue's own body and comments let us rebuild (client/test/fixtures/
// 680-sourced.json): every case cites the comment and quotes the line it
// comes from; `fidelity` says whether the comment gives the exact question and
// input ("verbatim") or only the rule it was rebuilt from ("reconstructed").
//
// It is NOT the original 197: the comments never posted the 26 boundaries,
// the four shift rules or the far-wrong rule, so this set holds 55 of the 197
// wrong answers, 35 of the 44 valid controls and 1 of the 26 far-wrong
// controls. At a5778a319, 54 of its 55 wrong answers are credited; here, none.
// SYNTHETIC: the checker, in-process.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
const SRC = new URL('../src/', import.meta.url).href;
const { checkAnswer } = await import(`${SRC}engine/checker.js`);
const cases = JSON.parse(readFileSync(new URL('./fixtures/680-sourced.json', import.meta.url), 'utf8'));

const failures = [];
const tally = { refuse: 0, credit: 0, verbatim: 0, reconstructed: 0 };
for (const c of cases) {
  let r;
  try { r = checkAnswer(c.question, c.input); } catch (e) { r = { correct: false, threw: e.message }; }
  const credited = r.correct === true;
  const ok = c.expect === 'credit' ? credited : !credited;
  tally[c.expect]++; tally[c.fidelity]++;
  if (!ok) failures.push(`${c.id} [${c.family}/${c.subfamily}] ${JSON.stringify(c.input)} — expected ${c.expect}, got ${credited ? 'credited' : 'refused'}`);
}
const families = {};
for (const c of cases) families[c.family] = (families[c.family] || 0) + 1;
const summary = Object.entries(families).map(([f, n]) => `${f} ${n}`).join(' · ');
console.log(failures.length
  ? `#680 SOURCED CASES: FAIL — ${failures.length} of ${cases.length}\n  · ${failures.join('\n  · ')}`
  : `#680 SOURCED CASES: PASS — ${cases.length}/${cases.length} cases (${tally.refuse} wrong answers refused, ${tally.credit} valid answers credited; ${tally.verbatim} verbatim, ${tally.reconstructed} reconstructed) — ${summary}. Not the original 197, which was never committed. [SYNTHETIC]`);
if (failures.length) process.exitCode = 1;
