// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the quality gate's own regression suite
//
// A gate that cannot fail is not a gate. Each of the five checks in
// question-quality-gate.mjs is handed a real generated question broken in one
// specific way and must name that defect — and must stay quiet on the
// unbroken question and on the legitimate shapes it once flagged (bare NCERT
// equations, LaTeX braces, "is undefined at").
//
// Usage: node client/test/question-quality-regressions.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { loadBanksFor, generateQuestion } from '../src/engine/generators/index.js';
import { stampContent } from '../src/engine/contentIdentity.js';
import { qualityProblems, uniquenessProblems, ambiguityProblems, readingProblems, proseOf, CHECKS, runGate } from './question-quality-gate.mjs';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };

await loadBanksFor(['c10-quadratic-roots', 'c8-linear-equations-both-sides', 'c10-probability-classical']);
const good = generateQuestion('c10-quadratic-roots', 2, 12345);
const ctx = { generatorId: 'c10-quadratic-roots', grade: 10 };
const flat = r => CHECKS.flatMap(c => r[c]);

ok(flat(qualityProblems(good, ctx)).length === 0, 'a real generated question passes all five checks');
const restamp = q => stampContent(q, 'c10-quadratic-roots');

// solvable
{ const r = qualityProblems(restamp({ ...good, answer: { ...good.answer, value: Number.NaN } }), ctx);
  ok(r.solvable.length > 0 && r.renders.length === 0, 'a keyed answer the marker cannot accept fails "solvable", not "renders"'); }
{ const r = qualityProblems(restamp({ ...good, steps: [] }), ctx);
  ok(r.solvable.some(p => /no steps/.test(p)), 'a question with no worked steps fails "solvable"'); }
// renders
{ const r = qualityProblems(restamp({ ...good, prompt: `${good.prompt} Then $\\frac{1}{2$.` }), ctx);
  ok(r.renders.length > 0 && r.solvable.length === 0, 'broken LaTeX fails "renders", not "solvable"'); }
// unique
ok(uniquenessProblems({ answerType: 'mcq', mcqOptions: ['$12$', '12', '$13$', '$14$'], answer: { correctIndex: 0 } }).length === 1, 'an MCQ whose distractor equals the keyed value fails "unique"');
ok(uniquenessProblems({ answerType: 'mcq', mcqOptions: ['$12$', '$21$', '$13$', '$14$'], answer: { correctIndex: 0 } }).length === 0, 'an MCQ with four different values passes "unique"');
ok(uniquenessProblems({ answerType: 'numeric', answer: { value: [1, 2] } }).length === 1, 'a numeric key that is a list fails "unique"');
ok(uniquenessProblems({ answerType: 'numeric', answer: { value: 7 } }).length === 0, 'one finite numeric key passes "unique"');
// unambiguous
ok(ambiguityProblems({ prompt: 'Find $x = undefined$.' }).some(p => /leaks/.test(p)), 'undefined interpolated into maths fails "unambiguous"');
ok(ambiguityProblems({ prompt: 'The function is undefined at $x = 8$. What value makes $f$ continuous?' }).length === 0, '"is undefined at" in English prose is not a leak');
ok(ambiguityProblems({ prompt: 'Expand $\\left(x + \\dfrac{3}{x^{3}}\\right)^{8}$.' }).length === 0, 'LaTeX braces are not template braces');
ok(ambiguityProblems({ prompt: 'Find the {{value}} of x.' }).some(p => /leaks/.test(p)), 'template braces in prose fail "unambiguous"');
ok(ambiguityProblems({ prompt: 'Find the the value of $x$.' }).some(p => /doubles/.test(p)), 'a doubled word fails "unambiguous"');
ok(ambiguityProblems({ prompt: 'What is $x$? And $y$? And $z$?' }).some(p => /more than two questions/.test(p)), 'three questions in one prompt fail "unambiguous"');
ok(ambiguityProblems({ prompt: '$5t - 7 = 4t$' }).length === 0, 'a bare equation is an equation to solve, not a wordless prompt');
ok(ambiguityProblems({ prompt: '$5t - 7 + 4t$' }).some(p => /no words/.test(p)), 'a bare expression with no = and no instruction fails "unambiguous"');
ok(ambiguityProblems({ prompt: 'Find the value of $x$ such that' }).some(p => /does not end/.test(p)), 'a prompt that stops mid-sentence fails "unambiguous"');
// readable
const long = Array.from({ length: 80 }, (_, i) => `word${i}`).join(' ') + '.';
ok(readingProblems({ prompt: long }, 7).length === 2, 'an 80-word sentence breaks both Class 7 ceilings');
ok(readingProblems({ prompt: long }, 12).length >= 1, 'and still the Class 12 average ceiling');
ok(readingProblems({ prompt: 'A train leaves at 9. It travels $120$ km. Find its speed.' }, 7).length === 0, 'short sentences pass "readable"');
ok(proseOf('Find $\\sqrt{441}$ and $$x$$.') === 'Find M and M .', 'proseOf replaces every maths segment with one placeholder word');

// The sweep itself: one chapter, deterministic, and a per-chapter report line.
const lines = [];
const sweep = await runGate({ n: 2, only: 'c10-probability', log: l => lines.push(l) });
ok(sweep.rows.length === 1 && sweep.rows[0].served > 0, 'the sweep can be limited to one chapter');
ok(lines.some(l => /Class 10 c10-probability /.test(l)), 'the report has a per-chapter line');
const again = await runGate({ n: 2, only: 'c10-probability', log: () => {} });
ok(JSON.stringify(again.rows) === JSON.stringify(sweep.rows), 'the sweep is deterministic');

const total = pass + failures.length;
if (failures.length) {
  for (const f of failures) console.log(`  ✖ ${f}`);
  console.log(`QUALITY GATE REGRESSIONS: FAIL — ${pass}/${total} checks`);
  process.exit(1);
}
console.log(`QUALITY GATE REGRESSIONS: PASS — ${pass}/${total} checks`);
