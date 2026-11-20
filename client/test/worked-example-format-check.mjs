// Pri Learning · every worked example, in both editions, is set out the way a marking guideline sets it.
//
// NSW (Prithagoras): every example's working is a list of rows (notes/workingRows.js) that
//   1. has at least one explained step: a `say` on every row that starts a step, in words;
//   2. lines up on one relation per row (at most one `&`) and uses one fraction style (\dfrac only);
//   3. writes function application with brackets, in the working, the reasons, the question, the steps and the answer;
//   4. asserts only equalities that are true: every constant equality, and every value carried down a
//      `&=` continuation, is re-evaluated by the maths engine (test/support/tex-to-expr.mjs). A line the
//      reader cannot model (symbols, text, inequalities, lists) is counted as skipped, never as passed;
//   5. ends in an answer the working supports: where both are engine-readable, a value the answer states
//      is a value the working derives;
//   6. answers what was asked ("first", "earliest") when the question asks for the first of several.
// India: every example has at least one explained step (a word, not only a sum) and bracketed functions.
// The legacy aligned-TeX string is still read, and set in the same grid (parse tests below).
import katex from 'katex';
import { loadNswNotesForStage } from '../src/notes/nsw/nswNotesIndex.js';
import { loadNotesForGrade } from '../src/notes/notesIndex.js';
import { workingRows, normaliseWorkingTex, unbracketedFunctions, splitRow } from '../src/notes/workingRows.js';
import { checkWorkingEqualities, statedValues, nearValue } from './support/tex-to-expr.mjs';

let pass = 0; const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const D = String.fromCharCode(36);
const plain = s => String(s).replace(/(?<!\\)\$((?:\\\$|[^$])+?)(?<!\\)\$/g, ' ');
const mathOf = s => [...String(s).matchAll(/(?<!\\)\$((?:\\\$|[^$])+?)(?<!\\)\$/g)].map(m => m[1]).join(' ; ');
const hasWord = s => /[A-Za-z]{3,}/.test(plain(s).replace(/\\\$/g, ''));

// ── the parser and the normaliser, on the legacy shape and the row shape ──
{
  const legacy = '\\begin{aligned}T&=\\dfrac{2\\pi}{\\pi/6}=12\\\\\\sin\\left(\\dfrac{\\pi t}{6}\\right)&=\\tfrac12\\\\&=1\\end{aligned}';
  const rows = workingRows(legacy);
  ok(rows.length === 3 && rows[0].lhs === 'T' && rows[1].rest === '=\\tfrac12' && rows[2].lhs === '', 'legacy aligned string is read as three rows');
  ok(normaliseWorkingTex('\\tfrac12+\\frac{a}{b}+\\dfrac34') === '\\dfrac12+\\dfrac{a}{b}+\\dfrac34', 'one fraction style: tfrac and frac are set as dfrac');
  ok(workingRows([{ say: 'Period:', tex: 'T&=12' }])[0].say === 'Period:', 'a row keeps its reason');
  ok(splitRow('f\\left(\\dfrac{a&b}{c}\\right)&=1').lhs === 'f\\left(\\dfrac{a&b}{c}\\right)', 'an & inside braces is not the alignment point');
  ok(workingRows(null).length === 0 && workingRows('').length === 0, 'no working is no rows');
  ok(unbracketedFunctions('\\sin\\dfrac{\\pi t}{6}').length === 1, 'sin of a fraction without brackets is caught');
  ok(unbracketedFunctions('\\sin 2x').length === 1 && unbracketedFunctions('\\sin \\pi t').length === 1, 'sin 2x and sin pi t are caught');
  ok(unbracketedFunctions('\\sin\\left(\\dfrac{\\pi t}{6}\\right)+\\sin x+\\sin\\theta+\\sin 30^\\circ+\\ln(x+1)+\\cos^2 x').length === 0, 'bracketed, single-symbol and plain-angle forms pass');
  const bad = checkWorkingEqualities(workingRows([{ tex: 'x&=2+3=6' }]));
  ok(bad.errors.length === 1, 'the equality check rejects 2+3=6');
  const carried = checkWorkingEqualities(workingRows([{ tex: 'x&=2+3' }, { tex: '&=7' }]));
  ok(carried.errors.length === 1, 'the equality check rejects a continuation that changes the value');
  ok(checkWorkingEqualities(workingRows([{ tex: 'd&=\\dfrac{2\\pi}{\\pi/6}=12' }])).errors.length === 0, 'the equality check accepts true constants');
  ok(checkWorkingEqualities(workingRows([{ tex: 'r&=\\dfrac{49}{\\sqrt{2420}}' }, { tex: '&=\\dfrac{49}{49.19}' }])).errors.length === 1, 'an unrounded = for a rounded value is rejected (write \\approx)');
}

// ── NSW ──
const NSW = [[4, null], [5, null], [6, 'standard'], [6, 'advanced'], [6, 'ext1'], [6, 'ext2']];
let nswExamples = 0; let eqChecked = 0; let eqSkipped = 0; let answerChecked = 0; let answerSkipped = 0; let explainedRows = 0;
for (const [stage, course] of NSW) {
  const notes = await loadNswNotesForStage(stage, course);
  for (const [id, n] of Object.entries(notes)) {
    (n.examples || []).forEach((ex, i) => {
      nswExamples++;
      const where = `NSW ${id} example ${i + 1}`;
      const rows = workingRows(ex.working);
      ok(rows.length >= 1, `${where}: has working`);
      ok(rows.some(r => r.say), `${where}: at least one explained step`);
      rows.forEach((r, k) => {
        const tex = r.lhs == null ? r.rest : `${r.lhs}&${r.rest}`;
        ok((tex.match(/(?<!\\)&/g) || []).length <= 1, `${where} row ${k + 1}: more than one alignment point`);
        ok(!/\\(?:tfrac|frac)(?![a-zA-Z])/.test(tex), `${where} row ${k + 1}: use \\dfrac (one fraction style in a working block)`);
        ok(unbracketedFunctions(tex).length === 0, `${where} row ${k + 1}: function without brackets: ${unbracketedFunctions(tex).join(', ')}`);
        const starts = r.lhs === null || r.lhs !== '';
        ok(!starts || Boolean(r.say), `${where} row ${k + 1}: a step row needs its reason in words`);
        if (r.say) { explainedRows++; ok(hasWord(r.say), `${where} row ${k + 1}: the reason has no words`); ok(unbracketedFunctions(mathOf(r.say)).length === 0, `${where} row ${k + 1}: reason has an unbracketed function`); }
        try { katex.renderToString(`${r.lhs ?? ''}${r.rest}`, { throwOnError: true, displayMode: true }); ok(true, ''); } catch (e) { ok(false, `${where} row ${k + 1}: KaTeX failed - ${e.message.slice(0, 80)}`); }
      });
      const eq = checkWorkingEqualities(rows);
      eqChecked += eq.checked; eqSkipped += eq.skipped;
      eq.errors.forEach(e => ok(false, `${where}: ${e}`));
      for (const field of ['question', 'answer']) ok(unbracketedFunctions(mathOf(ex[field])).length === 0, `${where}: ${field} has an unbracketed function`);
      ok(ex.steps.every(s => unbracketedFunctions(mathOf(s)).length === 0), `${where}: a step has an unbracketed function`);
      // The answer is supported by the working: a value it states is a value the working derives.
      const derived = rows.flatMap(r => statedValues(`${D}${r.lhs ?? ''}${r.rest}${D}`));
      const stated = statedValues(ex.answer);
      if (derived.length && stated.length) { answerChecked++; ok(stated.some(a => derived.some(d => nearValue(a, d))), `${where}: the answer states no value the working derives`); } else answerSkipped++;
      // A question that asks for the first of several is answered with the first.
      if (/\bfirst (time|occurs|reaches|is|year|when|positive)|\bwhen[^.?]*\bfirst\b|\bfirst\b[^.?]*\b(time|solution)\b/i.test(plain(ex.question))) ok(/\b(first|earliest)\b/i.test(plain(ex.answer)), `${where}: asks for the FIRST and the answer does not say so`);
    });
  }
}
ok(nswExamples >= 313, `all NSW examples were read (${nswExamples})`);
ok(eqChecked >= 250, `the engine re-evaluated at least 250 working lines (${eqChecked})`);

// ── India ──
let inExamples = 0;
for (const grade of [7, 8, 9, 10, 11, 12]) {
  const notes = await loadNotesForGrade(grade);
  for (const [id, c] of Object.entries(notes)) {
    (c.examples || []).forEach((ex, i) => {
      inExamples++;
      const where = `IN class ${grade} ${id} example ${i + 1}`;
      ok(ex.steps.some(hasWord), `${where}: no step has a word of explanation`);
      const all = [ex.question, ...ex.steps, ex.answer].map(mathOf).join(' ; ');
      ok(unbracketedFunctions(all).length === 0, `${where}: function without brackets: ${unbracketedFunctions(all).join(', ')}`);
    });
  }
}
ok(inExamples >= 1900, `all India examples were read (${inExamples})`);

if (failures.length) {
  console.error(`WORKED EXAMPLE FORMAT: FAIL — ${failures.length} of ${pass + failures.length} checks failed`);
  failures.slice(0, 80).forEach(f => console.error('  · ' + f));
  process.exit(1);
}
console.log(`WORKED EXAMPLE FORMAT: PASS — ${pass} checks — ${nswExamples} NSW examples (${explainedRows} explained rows; engine re-evaluated ${eqChecked} working lines, ${eqSkipped} not machine-readable and not counted as checked; answer-vs-working compared in ${answerChecked}, skipped ${answerSkipped}) and ${inExamples} India examples`);
