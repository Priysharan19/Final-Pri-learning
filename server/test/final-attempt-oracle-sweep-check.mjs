// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · final-attempt detection is never a guess oracle — every plan bank
//
// The line check (and the live coach built on the same evidence) must reply
// identically to a RIGHT and a WRONG final value. Two root causes made it
// differ on main (reviewer probes826/repro2.mjs, c10-areas-circles D1 seed 11,
// answer "462 cm²": "A = 462" judged, "A = 461" final — 24 of 38 plan
// questions differed):
//   1. the constant-answer guard read "462 cm²" as carrying letters;
//   2. the plan Step Check's stage tag (which marks a WRONG final value at the
//      last stage and leaves a right one untagged) took part in the decision.
//
// This sweep takes EVERY generator whose Step Check is a plan, at every
// difficulty, over several seeds, and for each question probes the final
// value written several ways — "A = v", "v = A", "V_1 = v", "v", "A = v cm²",
// a one-letter relation, and the same after a symbolic working line — with the
// RIGHT value and three WRONG ones (±1, ×1.1, a different constant). For each
// probe shape the evidence must be byte-identical across the four values.
//
//   node server/test/final-attempt-oracle-sweep-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { GENERATORS, loadAllBanks, generateQuestion } from '../../client/src/engine/generators/index.js';
import { lineCheckEvidence, stepMetaFor } from '../platform/markerOps.js';
import { isConstantAnswer, stripUnits } from '../platform/finalAttempt.js';
import { answerTextFor } from '../platform/practice.js';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };

await loadAllBanks?.();

const SEEDS = [1, 2, 3, 5, 8, 11, 13, 21];
const fmt = n => (Number.isInteger(n) ? String(n) : String(Number(n.toFixed(4))));
const SHAPES = [
  v => [`A = ${v}`],
  v => [`${v} = A`],
  v => [`V_1 = ${v}`],
  v => [`${v}`],
  v => [`A = ${v} cm²`],
  v => [`A = ${v} cm^2`],
  v => [`A = ${v} square units`],
  v => [`A = ${v} sq. units`],
  v => [`V = ${v} cubic units`],
  v => [`A = ${v} square metres`],
  v => [`2*A = 2*${v}`],
  v => [`A = l * b`, `A = ${v}`],
  v => [`A = l * b`, `A = ${v}`, `A + l = ${v} + l`],
  // Word labels (#831 review round 3): any label, any script, any spacing.
  v => [`area = ${v}`],
  v => [`Area = ${v}`],
  v => [`volume = ${v}`],
  v => [`total = ${v}`],
  v => [`total area = ${v}`],
  v => [`Total surface area = ${v} sq units`],
  v => [`area of the shaded region = ${v} square units`],
  v => [`the area is ${v}`],
  v => [`The answer is ${v} cm²`],
  v => [`answer is ${v}`],
  v => [`ans: ${v}`],
  v => [`Ans : ${v} sq. units`],
  v => [`= ${v} sq units`],
  v => [`${v} sq units`],
  v => [`A_1 = ${v}`],
  v => [`f(r) = ${v}`],
  v => [`area(ABCD) = ${v}`],
  v => [`क्षेत्रफल = ${v}`],
  v => [`कुल क्षेत्रफल = ${v} वर्ग सेमी`],
  v => [`उत्तर ${v} है`],
  v => [`उत्तर: ${v}`],
  v => [`area = l * b`, `area = ${v}`],
  v => [`area = l * b`, `the area is ${v}`, `so area = ${v}`]
];

const SPELLED_UNITS = ['square units', 'sq units', 'sq. units', 'cubic units', 'units', 'square metres', 'sq. cm', 'cubic centimetres'];

let planQuestions = 0;
let constantAnswers = 0;
const banks = new Set();
for (const id of Object.keys(GENERATORS)) {
  for (const diff of [1, 2, 3]) {
    for (const seed of SEEDS) {
      let q;
      try { q = generateQuestion(id, diff, seed); } catch { continue; }
      const meta = q && stepMetaFor(q);
      if (meta?.kind !== 'plan') continue;
      planQuestions += 1;
      banks.add(id);
      const answerText = String(answerTextFor(q) ?? '');
      if (!isConstantAnswer(answerText)) continue;   // non-constant answers: the form rules in finalAttempt.js
      constantAnswers += 1;
      const right = Number(stripUnits(answerText).replace(/,/g, ''));
      if (!Number.isFinite(right)) continue;
      const values = [right, right + 1, right * 1.1 + 0.37, right === 400 ? 401 : 400].map(fmt);
      // The escrow's own answer text, and the same value with each spelled-out unit (#831 review).
      const answers = [answerText, ...SPELLED_UNITS.map(u => `${fmt(right)} ${u}`)];
      for (const answer of answers) {
        for (const [s, shape] of SHAPES.entries()) {
          const replies = values.map(v => JSON.stringify(lineCheckEvidence(q, shape(v), answer)));
          ok(replies.every(r => r === replies[0]),
            `${id} D${diff} seed ${seed} (answer "${answer}") shape ${s} ${JSON.stringify(shape('v'))}: right and wrong values differ — ${[...new Set(replies)].join(' | ')}`);
        }
      }
    }
  }
}

// The reviewer's exact repro.
{
  const q = generateQuestion('c10-areas-circles', 1, 11);
  const answerText = String(answerTextFor(q) ?? '');
  ok(/462/.test(answerText), `the repro question is the reviewer's (answer "${answerText}")`);
  const replies = ['A = 462', 'A = 461', 'A = 463', 'A = 400', 'A = 462 cm²'].map(l => JSON.stringify(lineCheckEvidence(q, [l], answerText)));
  ok(replies.every(r => r === replies[0]), `repro: "A = 462" and its wrong values give identical evidence — ${[...new Set(replies)].join(' | ')}`);
}

ok(planQuestions >= 30, `the sweep reached the plan banks (${planQuestions} plan questions in ${banks.size} banks)`);
ok(constantAnswers >= 20, `and their constant answers (${constantAnswers})`);

console.log(failures.length
  ? `FINAL-ATTEMPT ORACLE SWEEP: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.slice(0, 40).join('\n  · ')}`
  : `FINAL-ATTEMPT ORACLE SWEEP: PASS — ${pass}/${pass} checks — ${planQuestions} plan questions in ${banks.size} banks, ${constantAnswers} constant answers, right and wrong values byte-identical for every probe shape.`);
process.exit(failures.length ? 1 : 0);
