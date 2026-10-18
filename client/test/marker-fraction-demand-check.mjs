// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · When does a question demand its answer as a fraction?
//
// Issue #527. The marker read any \frac in a prompt as a demand for a fraction
// answer, so 0.8 was refused for cos A = 4/5 whenever the given sin A was
// typeset as a fraction — 19 live generators, 6,675 rejected draws in a
// 2,000-draw sweep. "Find cos A exactly" is satisfied by 0.8: it is exact.
//
// The demand is read from the words that ask for the answer ("as a fraction",
// "in simplest form", "in lowest terms", "simplify", "in the form p/q") or from
// `answer.requireFraction` set by the generator — never from the data the
// question gives, and "partial-fraction" names a method, not a form.
//
// Every case is authored, in the style of marker-ncert-forms-check.mjs, whose
// own count ci.yml pins; these cases live here so that pin stays a statement
// about that file. The decimal sweep (marker-decimal-sweep-check.mjs) covers
// every live generator; this file is the handful of concrete prompts that name
// the bug. Both run from marker-equivalence-classes-check.mjs, so
// `npm run test:marker:equivalence`, `npm test` and CI run them.
// ─────────────────────────────────────────────────────────────────────────────
import { checkAnswer } from '../src/engine/checker.js';

let pass = 0;
const failures = [];
function ok(cond, label) {
  if (cond) pass++;
  else failures.push(label);
}
function correct(question, input, label) {
  const verdict = checkAnswer(question, input);
  ok(verdict.correct === true, `${label} — expected correct, got ${verdict.correct} (${verdict.feedback || verdict.reason || ''})`);
}
function wrong(question, input, label) {
  const verdict = checkAnswer(question, input);
  ok(verdict.correct === false, `${label} — expected wrong, got correct`);
}

// ── A fraction in the given data is not a request ────────────────────────────
const givenFraction = {
  answerType: 'numeric',
  answer: { value: 0.8, simplestFraction: { n: 4, d: 5 } },
  prompt: 'For an acute angle $A$, $\\sin A=\\frac{3}{5}$. Use $\\sin^2A+\\cos^2A=1$ to find $\\cos A$ exactly.'
};
correct(givenFraction, '0.8', 'given fraction: the exact decimal is the answer when only the data is a fraction');
correct(givenFraction, '4/5', 'given fraction: the fraction still works');
wrong(givenFraction, '0.6', 'given fraction: the given sin A is not cos A');
wrong(givenFraction, '0.75', 'given fraction: a wrong decimal is wrong');
wrong(givenFraction, '8/10', 'given fraction: an unsimplified fraction still asks to be simplified');

const piAsFraction = {
  answerType: 'numeric',
  answer: { value: 38.5, simplestFraction: { n: 77, d: 2 } },
  answerSuffix: 'cm²',
  prompt: 'Find the area of a sector of angle $90^\\circ$ in a circle of radius $7$ cm. Take $\\pi = \\dfrac{22}{7}$.'
};
correct(piAsFraction, '38.5', 'given π = 22/7: the exact decimal is the answer');
correct(piAsFraction, '38.5 cm²', 'given π = 22/7: the exact decimal with its unit');
correct(piAsFraction, '77/2', 'given π = 22/7: the fraction still works');
wrong(piAsFraction, '38.4', 'given π = 22/7: a wrong decimal is wrong');
wrong(piAsFraction, '154', 'given π = 22/7: the whole circle is not the sector');

const givenProbability = {
  answerType: 'numeric',
  answer: { value: 0.6, simplestFraction: { n: 3, d: 5 } },
  prompt: 'For two events $A$ and $B$, $P(A \\cap B) = \\dfrac{6}{18}$ and $P(B) = \\dfrac{10}{18}$. Find $P(A \\mid B)$.'
};
correct(givenProbability, '0.6', 'given probabilities: the exact decimal is the answer');
correct(givenProbability, '3/5', 'given probabilities: the fraction still works');
wrong(givenProbability, '6/10', 'given probabilities: an unsimplified fraction still asks to be simplified');
wrong(givenProbability, '0.6%', 'given probabilities: a percent sign on a probability is the wrong number');
wrong(givenProbability, '0.33', 'given probabilities: P(A ∩ B) is not P(A | B)');

// "partial-fraction" names a method, not a form of answer.
const partialFractions = {
  answerType: 'numeric',
  answer: { value: 0.2, simplestFraction: { n: 1, d: 5 } },
  prompt: 'In the partial-fraction decomposition $\\dfrac{1}{(x + 1)(x - 4)} = \\dfrac{A}{x + 1} + \\dfrac{B}{x - 4}$, find $B$.'
};
correct(partialFractions, '0.2', 'partial fractions: the method\'s name is not a request for a fraction');
correct(partialFractions, '1/5', 'partial fractions: the fraction still works');
wrong(partialFractions, '-0.2', 'partial fractions: the wrong sign is wrong');
wrong(partialFractions, '0.25', 'partial fractions: a wrong decimal is wrong');

// ── The request is read however it is written ────────────────────────────────
const hyphenated = {
  answerType: 'numeric',
  answer: { value: 13 / 31, simplestFraction: { n: 13, d: 31 } },
  prompt: 'Given that a randomly chosen student **owns a pet**, find the probability they are in Year 10 (simplest-form fraction).'
};
correct(hyphenated, '13/31', 'hyphenated request: the fraction');
wrong(hyphenated, String(13 / 31), 'hyphenated request: the decimal is refused when a fraction is asked for');
wrong(hyphenated, '0.42', 'hyphenated request: a rounded decimal is refused');

const simplifyFully = {
  answerType: 'numeric',
  answer: { value: 1.75, simplestFraction: { n: 7, d: 4 } },
  prompt: 'Simplify $\\dfrac{35}{20}$ fully.'
};
correct(simplifyFully, '7/4', 'simplify: the simplified fraction');
correct(simplifyFully, '1 3/4', 'simplify: the mixed numeral');
wrong(simplifyFully, '1.75', 'simplify: simplifying a fraction asks for a fraction');
wrong(simplifyFully, '35/20', 'simplify: the fraction as given is not simplified');

// ── The generator's own flag is honoured, and never overridden by wording ────
const flaggedWithoutWording = {
  answerType: 'numeric',
  answer: { value: 0.5, simplestFraction: { n: 1, d: 2 }, requireFraction: true },
  prompt: 'Find $\\frac34 - \\frac14$.'
};
correct(flaggedWithoutWording, '1/2', 'requireFraction: the fraction');
wrong(flaggedWithoutWording, '0.5', 'requireFraction: the generator demanded the form, so the exact decimal is refused');
wrong(flaggedWithoutWording, '2/4', 'requireFraction: the unsimplified fraction is refused');

const flaggedOff = {
  answerType: 'numeric',
  answer: { value: 0.5, simplestFraction: { n: 1, d: 2 }, requireFraction: false },
  prompt: 'Give the answer as a fraction in simplest form: $\\frac34 - \\frac14$.'
};
correct(flaggedOff, '0.5', 'requireFraction false: the generator released the form, so wording does not refuse the exact decimal');
correct(flaggedOff, '1/2', 'requireFraction false: the fraction still works');
wrong(flaggedOff, '0.25', 'requireFraction false: the wrong value is still wrong');

// ── Report ───────────────────────────────────────────────────────────────────
if (failures.length) {
  console.log(`FRACTION DEMAND: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`);
  process.exit(1);
}
console.log(`FRACTION DEMAND: PASS — ${pass}/${pass} checks — a fraction in the given data is not a request; "as a fraction", "simplest form", "lowest terms", "simplify" and the generator's requireFraction are.`);
