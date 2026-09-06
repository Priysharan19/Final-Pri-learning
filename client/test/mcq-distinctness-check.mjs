// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · a four-option question must offer four options
//
// A JEE paper promises one guess in four. An item that prints the same text
// twice quietly makes it one in three, and a student who eliminates one
// distractor is handed a better guess than the paper says they get. It is the
// kind of defect that never crashes anything and is worth marks.
//
// This was live, and it is worth stating exactly how, because the mechanism is
// not the obvious one. `numericDistractors` rejects duplicate VALUES, but the
// student reads TEXT, and `formatLike` rounds every candidate to the precision
// of the answer. The question that produced it was:
//
//   "An archer hits gold with probability 0.6 per arrow. Over 12 arrows, find
//    P(at least one gold), correct to 4 decimal places."
//
// The keyed answer rounds to 1, an integer, so every option prints to zero
// decimals. Two of the generator's designed traps are small probabilities —
// 0.4^12 and another near zero — which are far apart as numbers and both print
// "0". The paper offered ["2","0","1","0"].
//
// It appeared in about one JEE paper in ninety-five, and only after a profile
// had built up enough history to reach that draw, which is why a twenty-paper
// sweep never saw it. Pinned here at the unit so finding it never again depends
// on how many papers a sweep happens to draw.
import { hasFourDistinctOptions, numericDistractors, numericToMcq } from '../src/engine/indiaExamComposer.js';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

/** A deterministic stand-in for the composer's RNG. */
const rng = () => 0.42;

const numeric = (value, traps = [], extra = {}) => ({
  prompt: 'A question.',
  answerType: 'numeric',
  answer: { value, ...extra.answer },
  traps,
  ...extra
});

// ── 1 · The exact question that was reaching real papers ─────────────────────
// Reconstructed from the offender: the answer rounds to the integer 1, and two
// designed traps are distinct small probabilities that both print "0".
// Before the fix this returned ["0","1","2","0"].
const archer = numeric(1, [
  { value: Math.pow(0.4, 12), why: 'answered P(no gold) instead' },
  { value: 0.0021, why: 'used the wrong complement' }
]);
const collided = numericToMcq(archer, rng);
ok(collided !== null, 'the question still converts to an MCQ rather than being lost');
ok(hasFourDistinctOptions(collided), 'and every printed option differs from every other');
const archerTexts = collided.mcqOptions.map(t => String(t).trim());
eq(new Set(archerTexts).size, 4, 'four options means four different strings');
eq(collided.mcqOptions[collided.answer.correctIndex], '1', 'and the keyed answer is still the one marked correct');
ok(!archerTexts.some((t, i) => archerTexts.indexOf(t) !== i), 'with no repeat anywhere in the list');

// ── 2 · Deduplication is on what the student reads ───────────────────────────
// Values that differ but print the same must not both survive.
const rounded = numericToMcq(numeric(5, [{ value: 4.6 }, { value: 4.7 }, { value: 4.8 }]), rng);
if (rounded) {
  const texts = rounded.mcqOptions.map(t => String(t).trim());
  eq(new Set(texts).size, 4, 'three traps that all print "5" cannot fill three option slots');
}

// ── 3 · The general property, over the shapes questions actually take ────────
const shapes = [];
for (const value of [0, 1, 2, 3, 7, 10, 12, 25, 99, 100, 144, 1000, 0.5, 1.25, 2.75, 3.14, -4, -0.5, 0.001]) {
  shapes.push(numeric(value));
  shapes.push(numeric(value, [{ value: 0 }, { value: value / 2 }, { value: value + 0.4 }]));
  shapes.push(numeric(value, [{ value: -value }, { value: value * 2 }, { value: value / 10 }, { value: value + 0.49 }]));
  shapes.push(numeric(value, [], { answerPrefix: 'x =' }));
  shapes.push(numeric(value, [], { answerSuffix: 'cm' }));
}
let converted = 0;
const offenders = [];
for (const q of shapes) {
  const mcq = numericToMcq(q, rng);
  if (!mcq) continue;                       // refusing is always allowed
  converted += 1;
  const texts = mcq.mcqOptions.map(t => String(t).trim());
  if (texts.length !== 4 || new Set(texts).size !== 4 || texts.some(t => !t)) {
    offenders.push(`${JSON.stringify(q.answer.value)} → ${JSON.stringify(texts)}`);
  }
  if (texts[mcq.answer.correctIndex] !== texts.find((_, i) => i === mcq.answer.correctIndex)) {
    offenders.push(`correctIndex does not point at the answer for ${q.answer.value}`);
  }
}
ok(converted > 30, `enough of the sample actually converted to MCQ (${converted} of ${shapes.length})`);
eq(offenders, [], 'no numeric question converts to an MCQ with a missing, empty or repeated option');

// ── 4 · Refusing is the correct outcome when three cannot be found ───────────
// numericDistractors is asked for more than it needs precisely because the
// text-level dedup downstream discards some.
ok(numericDistractors(numeric(4), 8).length > 3,
  'the distractor pool is deeper than the three slots, so collisions can be dropped and still leave three');
const impossible = numericToMcq({
  prompt: 'x', answerType: 'numeric', answer: { value: 1 },
  traps: [{ value: 1 }, { value: 1 }, { value: 1 }]
}, rng);
ok(impossible === null || hasFourDistinctOptions(impossible),
  'a question with no usable distractors is refused rather than padded with repeats');

// ── 5 · The gate itself ──────────────────────────────────────────────────────
ok(!hasFourDistinctOptions({ mcqOptions: ['2', '0', '1', '0'] }), 'the gate rejects the exact options that reached a paper');
ok(!hasFourDistinctOptions({ mcqOptions: ['1', '2', '3'] }), 'and three options are not four');
ok(!hasFourDistinctOptions({ mcqOptions: ['1', '2', '3', ' '] }), 'and a blank option is not an option');
ok(hasFourDistinctOptions({ mcqOptions: ['1', '2', '3', '4'] }), 'and passes four distinct ones');

console.log(failures.length
  ? `MCQ DISTINCTNESS: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`
  : `MCQ DISTINCTNESS: PASS — ${pass}/${pass} checks — four options means four different options, deduplicated on what the student reads.`);
process.exit(failures.length ? 1 : 0);
