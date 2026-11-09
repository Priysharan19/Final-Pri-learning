// Pri Learning · NCERT Class 8 · Chapter 1 — Rational Numbers
// Source-aligned learning layer for NCERT Mathematics, Reprint 2024–25.
//
// The chapter content is represented twice on purpose:
//   1. as a compact, auditable source map + topper teaching notes used by the UI;
//   2. as parameterised question generators with Pri-style hints, misconceptions,
//      handwritten-working support, and complete worked solutions.
//
// No textbook prose is required at runtime. The notes below are rewritten for Pri
// Learning while preserving every mathematical idea, worked example, Try These
// check, Exercise 1.1 outcome, and the chapter summary.
//
// Served questions are original. Every generator below draws its own numbers
// and solves them itself; none carries an NCERT exercise, example or Try These
// number, and none reproduces a textbook item (NCERT's reuse terms; audit item
// 6, Nov 2026). The textbook's own items appear only in the chapter shell's
// source map and worked source checks, labelled as such.

import { ri, rc, mcq, Frac } from '../qhelpers.js';

export const NCERT_CLASS8_RATIONAL_DOTPOINTS = Object.freeze([
  'Build the number-system ladder and identify rational numbers as p/q with q ≠ 0',
  'Use closure correctly for natural, whole, integer and rational numbers, including the zero-divisor caveat',
  'Test and use commutativity of addition and multiplication, and recognise why subtraction and division fail it',
  'Test and use associativity of addition and multiplication, and recognise why subtraction and division fail it',
  'Use additive identity 0, multiplicative identity 1, additive inverses and multiplicative inverses without confusing them',
  'Use distributivity of multiplication over addition and subtraction for rational numbers',
  'Simplify multi-step rational-number calculations strategically using LCM, regrouping, cancellation and factorisation',
  'Find rational numbers between two rational numbers and explain why there are infinitely many'
]);

export const NCERT_CLASS8_RATIONAL_GENERATOR_IDS = Object.freeze([
  'y8-ncert-rational-foundations',
  'y8-ncert-rational-closure',
  'y8-ncert-rational-commutativity',
  'y8-ncert-rational-associativity',
  'y8-ncert-rational-identities',
  'y8-ncert-rational-distributivity',
  'y8-ncert-rational-strategy',
  'y8-ncert-rational-between'
]);

export const NCERT_CLASS8_RATIONAL_COVERS = Object.freeze(
  NCERT_CLASS8_RATIONAL_GENERATOR_IDS.map((gen, dp) => ({ gen, dp: [dp], diff: [1, 2, 3, 4] }))
);

export const NCERT_CLASS8_RATIONAL_SOURCE_MAP = Object.freeze([
  { pages: '1', section: '1.1 Introduction', coverage: 'Equations motivate the extension natural → whole → integers → rationals; 2x = 3 and 5x + 7 = 0 require 3/2 and −7/5.' },
  { pages: '2–4', section: '1.2.1 Closure', coverage: 'Closure tables for whole numbers and integers; rational-number definition; closure under +, − and ×; division fails only because division by 0 is undefined; non-zero rationals are closed under division.' },
  { pages: '5–6', section: '1.2.2 Commutativity', coverage: 'Addition and multiplication commute; subtraction and division do not. Includes comparison tables for natural, whole, integer and rational numbers.' },
  { pages: '7–9', section: '1.2.3 Associativity', coverage: 'Addition and multiplication associate; subtraction and division do not. Includes rational counterexamples and the first multi-fraction worked example.' },
  { pages: '9–10', section: 'Examples 1–2', coverage: 'Efficient fraction addition and multiplication using LCM, commutativity, associativity and cancellation.' },
  { pages: '10–11', section: '1.2.4–1.2.5 Identities', coverage: '0 is the additive identity and 1 is the multiplicative identity for rational numbers (and the relevant earlier number systems).' },
  { pages: '11–12', section: '1.2.6 Distributivity', coverage: 'a(b + c) = ab + ac and a(b − c) = ab − ac, with direct verification, Try These and a factorisation-style worked example.' },
  { pages: '12', section: 'Exercise 1.1', coverage: 'Multiplicative identity, commutativity, multiplicative inverse, associativity and closure under multiplication.' },
  { pages: '13', section: 'What Have We Discussed?', coverage: 'Chapter summary plus the density fact: between any two different rational numbers there are infinitely many rational numbers; the mean gives one.' },
  { pages: '14', section: 'Notes', coverage: 'Blank learner-notes page; no additional mathematical statement is present.' }
]);

export const NCERT_CLASS8_RATIONAL_TOPPER_NOTES = Object.freeze([
  {
    title: '1. Number systems are built to remove “no-solution” gaps',
    level: 'Core idea → proof-ready',
    points: [
      'Natural numbers handle positive counting. Adding 0 gives whole numbers; adding negatives gives integers; allowing ratios p/q with q ≠ 0 gives rational numbers.',
      'A fast diagnostic is to ask what kind of answer an equation demands. x + 5 = 5 needs 0; x + 18 = 5 needs −13; 2x = 3 needs 3/2.',
      'Every integer is rational because n = n/1. Zero is rational because 0 = 0/1. A denominator of 0 is never allowed.'
    ],
    edge: 'Topper move: distinguish the representation p/q from a particular written fraction. The same rational number has infinitely many equivalent representations, but every valid denominator is non-zero.'
  },
  {
    title: '2. Closure: check the output set, not whether the operation “works”',
    level: 'High-frequency exam distinction',
    points: [
      'Closure means: for every pair chosen from the set, the result of the operation is still in that set.',
      'Rational numbers are closed under addition, subtraction and multiplication.',
      'Rational numbers are not closed under unrestricted division because a ÷ 0 is undefined. If the divisor is restricted to a non-zero rational number, the quotient is rational.',
      'Whole numbers are closed under + and × only; integers are closed under +, − and ×; natural numbers are not closed under − or ÷.'
    ],
    formula: 'If a = p/q and b = r/s, then a+b = (ps+rq)/(qs), a−b = (ps−rq)/(qs), ab = pr/(qs), and a÷b = ps/(qr) when r ≠ 0.',
    edge: 'Topper move: one valid counterexample destroys a universal closure claim. For whole-number subtraction, 5 − 7 = −2 is enough.'
  },
  {
    title: '3. Commutative vs associative: order and grouping are different questions',
    level: 'Trap-proof understanding',
    points: [
      'Commutative asks whether swapping two inputs changes the answer: a+b = b+a and ab = ba.',
      'Associative asks whether regrouping three inputs changes the answer: a+(b+c) = (a+b)+c and a(bc) = (ab)c.',
      'For rational numbers, addition and multiplication are both commutative and associative; subtraction and division are neither.',
      'Never “move” a subtracted or divided term as if the operation were commutative. Rewrite subtraction as addition of a negative, or division as multiplication by a reciprocal, before regrouping.'
    ],
    edge: 'Topper move: properties belong to operations. Saying “rational numbers are commutative” is imprecise; addition of rationals is commutative, while subtraction is not.'
  },
  {
    title: '4. Identity and inverse are not the same object',
    level: 'Definition precision',
    points: [
      '0 is the additive identity because a + 0 = 0 + a = a.',
      '1 is the multiplicative identity because a × 1 = 1 × a = a.',
      'The additive inverse of a is −a because a + (−a) = 0.',
      'The multiplicative inverse of non-zero a is 1/a because a(1/a) = 1. Zero has no multiplicative inverse.'
    ],
    edge: 'Topper move: identity is fixed for the operation; inverse depends on the number. “Change the sign” finds an additive inverse; “turn the fraction over” finds a multiplicative inverse, provided the number is non-zero.'
  },
  {
    title: '5. Distributivity is both an expansion rule and a factorisation shortcut',
    level: 'Calculation accelerator',
    points: [
      'For rationals a, b, c: a(b+c) = ab+ac and a(b−c) = ab−ac.',
      'Read the rule in reverse when two terms share a factor: ab + ac = a(b+c). This is often faster than separately multiplying and then finding another LCM.',
      'A negative common factor is legal and often makes the bracket simpler.'
    ],
    edge: 'Topper move: distribution works over addition/subtraction, not over arbitrary operations. Also, cancellation is between factors, never across terms joined by + or −.'
  },
  {
    title: '6. Fraction arithmetic: minimise work before you calculate',
    level: 'Topper execution method',
    points: [
      'For sums/differences, group terms with related denominators first when commutativity/associativity allow it; only then take an LCM.',
      'For products, determine the sign first and cancel common factors across numerators and denominators before multiplying.',
      'For division, multiply by the reciprocal of the non-zero divisor, then cancel.',
      'Always reduce the final rational number to lowest terms; a mathematically equal but unsimplified fraction hides mistakes and wastes checking time.'
    ],
    edge: 'Topper move: before writing a large common denominator, look for structure. The NCERT examples are designed to reward regrouping and cancellation, not brute-force arithmetic.'
  },
  {
    title: '7. Density: there is never a “next” rational number',
    level: 'Conceptual topper note',
    points: [
      'For two different rational numbers a and b, their mean (a+b)/2 is rational and lies strictly between them.',
      'Once one middle rational is found, repeat the same process between an endpoint and the new number. The process never ends.',
      'Therefore every open interval between two rationals contains infinitely many rational numbers.'
    ],
    edge: 'Topper move: “infinitely many” is stronger than “at least one”. The repeated-mean construction is an actual proof strategy, not just a trick for finding an example.'
  },
  {
    title: '8. One-page property matrix to memorise only after understanding it',
    level: 'Revision matrix',
    table: [
      ['Set', 'Closed +', 'Closed −', 'Closed ×', 'Closed ÷', 'Commutative +/×', 'Associative +/×'],
      ['Rational', 'Yes', 'Yes', 'Yes', 'No*', 'Yes', 'Yes'],
      ['Integer', 'Yes', 'Yes', 'Yes', 'No', 'Yes', 'Yes'],
      ['Whole', 'Yes', 'No', 'Yes', 'No', 'Yes', 'Yes'],
      ['Natural', 'Yes', 'No', 'Yes', 'No', 'Yes', 'Yes']
    ],
    edge: '*For rationals, division is closed when the divisor is explicitly restricted to be non-zero. Subtraction and division are not commutative or associative in any of these number systems.'
  }
]);

export const NCERT_CLASS8_RATIONAL_WORKED_EXAMPLES = Object.freeze([
  {
    id: 'ncert-example-1',
    title: 'Worked example 1 · strategic addition',
    prompt: '$\\frac{3}{7}-\\frac{6}{11}-\\frac{8}{21}+\\frac{5}{22}$',
    steps: [
      'Regroup using commutativity and associativity: $(\\frac{3}{7}-\\frac{8}{21})+(-\\frac{6}{11}+\\frac{5}{22})$.',
      '$\\frac{3}{7}-\\frac{8}{21}=\\frac{9}{21}-\\frac{8}{21}=\\frac{1}{21}$.',
      '$-\\frac{6}{11}+\\frac{5}{22}=-\\frac{12}{22}+\\frac{5}{22}=-\\frac{7}{22}$.',
      '$\\frac{1}{21}-\\frac{7}{22}=\\frac{22-147}{462}=-\\frac{125}{462}$.',
      'The numerator and denominator have no common factor, so the fraction is already in lowest terms.'
    ],
    answer: '$-\\frac{125}{462}$',
    topper: 'A direct LCM of 7, 11, 21 and 22 also works (462), but the regrouping exposes two tiny intermediate calculations and is safer.'
  },
  {
    id: 'ncert-example-2',
    title: 'Worked example 2 · cancel before multiplying',
    prompt: '$-\\frac45\\times\\frac37\\times\\frac{15}{16}\\times(-\\frac{14}{9})$',
    steps: [
      'There are two negative factors, so the final product is positive.',
      'Regroup: $(-\\frac45\\times\\frac{15}{16})(\\frac37\\times-\\frac{14}{9})$.',
      '$-\\frac45\\times\\frac{15}{16}=-\\frac34$ after cancelling 5 with 15 and 4 with 16.',
      '$\\frac37\\times-\\frac{14}{9}=-\\frac23$ after cancelling 7 with 14 and 3 with 9.',
      '$(-\\frac34)(-\\frac23)=\\frac{6}{12}=\\frac12$.'
    ],
    answer: '$\\frac12$',
    topper: 'Do not multiply 4×3×15×14 and 5×7×16×9 first. Cross-cancellation cuts the arithmetic dramatically.'
  },
  {
    id: 'ncert-example-3',
    title: 'Worked example 3 · factor with distributivity',
    prompt: '$\\frac25\\times(-\\frac37)-\\frac1{14}-\\frac37\\times\\frac35$',
    steps: [
      'Use commutativity on the last product: $\\frac25(-\\frac37)-\\frac35(\\frac37)-\\frac1{14}$.',
      'Write both products with the common factor $-\\frac37$: $(-\\frac37)(\\frac25)+(-\\frac37)(\\frac35)-\\frac1{14}$.',
      'Factor by distributivity: $(-\\frac37)(\\frac25+\\frac35)-\\frac1{14}$.',
      '$\\frac25+\\frac35=1$, so this becomes $-\\frac37-\\frac1{14}$.',
      '$-\\frac37=-\\frac6{14}$, hence $-\\frac6{14}-\\frac1{14}=-\\frac7{14}=-\\frac12$.'
    ],
    answer: '$-\\frac12$',
    topper: 'The high-value observation is the shared factor −3/7. Distributivity in reverse turns two products into one.'
  }
]);

export const NCERT_CLASS8_RATIONAL_SOURCE_CHECKS = Object.freeze([
  {
    title: 'Closure Try These · subtraction',
    prompt: '$\\frac58-\\frac45$',
    solution: '$\\frac{25}{40}-\\frac{32}{40}=-\\frac7{40}$, which is rational.'
  },
  {
    title: 'Closure Try These · subtract a negative',
    prompt: '$\\frac37-(-\\frac85)$',
    solution: '$\\frac37+\\frac85=\\frac{15+56}{35}=\\frac{71}{35}$, which is rational.'
  },
  {
    title: 'Closure Try These · division by a non-zero rational',
    prompt: '$\\frac27\\div\\frac53$',
    solution: '$\\frac27\\times\\frac35=\\frac6{35}$. The divisor is non-zero, so the quotient is rational.'
  },
  {
    title: 'Closure Try These · negative ÷ negative',
    prompt: '$-\\frac38\\div(-\\frac29)$',
    solution: '$-\\frac38\\times(-\\frac92)=\\frac{27}{16}$.'
  },
  {
    title: 'Commutativity check',
    prompt: 'Compare $-\\frac65+(-\\frac83)$ with $-\\frac83+(-\\frac65)$.',
    solution: 'Both equal $-\\frac{58}{15}$, confirming addition is commutative for this pair. Subtraction and division do not have this property.'
  },
  {
    title: 'Associativity check · division counterexample',
    prompt: '$[\\frac12\\div(-\\frac13)]\\div\\frac25$ versus $\\frac12\\div[(-\\frac13)\\div\\frac25]$',
    solution: 'LHS $=(-\\frac32)\\div\\frac25=-\\frac{15}{4}$. RHS $=\\frac12\\div(-\\frac56)=-\\frac35$. They differ, so division is not associative.'
  },
  {
    title: 'Distributivity Try These (i)',
    prompt: '$\\frac75(-\\frac3{12})+\\frac75(\\frac5{12})$',
    solution: '$\\frac75(-\\frac3{12}+\\frac5{12})=\\frac75\\cdot\\frac2{12}=\\frac7{30}$.'
  },
  {
    title: 'Distributivity Try These (ii)',
    prompt: '$\\frac9{16}(\\frac4{12})+\\frac9{16}(-\\frac39)$',
    solution: '$\\frac9{16}(\\frac13-\\frac13)=0$.'
  },
  {
    title: 'Exercise 1.1 · Q1(i)',
    prompt: '$(-\\frac45)\\times1=1\\times(-\\frac45)=-\\frac45$',
    solution: 'Multiplicative identity (1 leaves every rational number unchanged under multiplication).'
  },
  {
    title: 'Exercise 1.1 · Q1(ii)',
    prompt: '$(-\\frac{13}{17})(-\\frac27)=(-\\frac27)(-\\frac{13}{17})$',
    solution: 'Commutativity of multiplication: $ab=ba$.'
  },
  {
    title: 'Exercise 1.1 · Q1(iii)',
    prompt: '$(-\\frac{19}{29})(\\frac{29}{-19})=1$',
    solution: 'Multiplicative inverse: the two non-zero rational numbers are reciprocals.'
  },
  {
    title: 'Exercise 1.1 · Q2',
    prompt: 'What allows $\\frac13(6\\times\\frac43)$ to be computed as $(\\frac13\\times6)\\times\\frac43$?',
    solution: 'Associativity of multiplication: $a(bc)=(ab)c$.'
  },
  {
    title: 'Exercise 1.1 · Q3',
    prompt: 'The product of two rational numbers is always a ______.',
    solution: 'Rational number — this is closure under multiplication.'
  },
  {
    title: 'Completed property tables',
    prompt: 'Fill the chapter summary tables for natural, whole, integer and rational numbers.',
    solution: 'Closure: Q yes/yes/yes/no; Z yes/yes/yes/no; W yes/no/yes/no; N yes/no/yes/no for +,−,×,÷. Commutativity and associativity: + and × yes; − and ÷ no, for all four sets (where the expressions are defined).'
  }
]);

const FRACS = Object.freeze([
  [1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [2, 5], [3, 5], [1, 6], [5, 6], [3, 8], [5, 7], [7, 9]
]);

const asFrac = ([n, d], sign = 1) => new Frac(sign * n, d);
const signedFrac = rng => asFrac(rc(rng, FRACS), rng() < 0.45 ? -1 : 1);
const fracAnswer = f => ({ value: f.value, simplestFraction: { n: f.n, d: f.d } });
const fracInput = f => `e.g. ${f.str()}`;
const paren = f => f.n < 0 ? `(${f.latex()})` : f.latex();
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
const lcm = (a, b) => Math.abs(a * b) / gcd(a, b);
/** Signed fractions with distinct values, so a comparison or a regrouping is a real one. */
function distinctFracs(rng, count) {
  const out = [];
  for (let guard = 0; out.length < count && guard < 80; guard++) {
    const f = signedFrac(rng);
    if (!out.some(g => g.value === f.value)) out.push(f);
  }
  while (out.length < count) out.push(new Frac(out.length + 2, 11));
  return out;
}
/** A fraction displayed exactly as written — unreduced when that is the point — with its sign in front. */
const rawFrac = (n, d) => (n < 0 ? `-\\frac{${-n}}{${d}}` : `\\frac{${n}}{${d}}`);
const rawParen = (n, d) => (n < 0 ? `(${rawFrac(n, d)})` : rawFrac(n, d));
/** "a+b-c": fractions joined by the right sign, the first one bare. */
const joinSum = fracs => fracs.map((f, i) => (i === 0 ? f.latex() : f.n < 0 ? `-${new Frac(-f.n, f.d).latex()}` : `+${f.latex()}`)).join('');
/** "+b" / "-b" for a fraction appended to a sum. */
const signedTerm = f => (f.n < 0 ? `-${new Frac(-f.n, f.d).latex()}` : `+${f.latex()}`);
/** Keep drawing until the value is a genuine non-integer, non-zero fraction (so "as a fraction" is answerable as one). */
function untilFraction(rng, make, fallback) {
  for (let guard = 0; guard < 60; guard++) {
    const out = make();
    if (out && out.ans && out.ans.n !== 0 && out.ans.d !== 1) return out;
  }
  return fallback();
}

function propertyMcq(rng, prompt, correct, distractors, hints, steps) {
  const m = mcq(rng, correct, distractors);
  return {
    prompt,
    answerType: 'mcq',
    answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps },
    mcqOptions: m.options,
    hints,
    steps
  };
}

// The sentence a prompt carries when the exercise is fraction arithmetic and
// the answer must be written as a fraction. It travels with `requireFraction`
// so the demand the marker enforces is the demand the student was shown: the
// exact decimal (0.5 for 1/2) is refused only on a question that said so (#527).
export const AS_FRACTION = 'Give your answer as a fraction in simplest form.';

function fractionNumeric(prompt, f, { hints = [], steps = [], traps = [], solutionText = '', requireFraction = false } = {}) {
  return {
    prompt,
    answerType: 'numeric',
    answer: requireFraction ? { ...fracAnswer(f), requireFraction: true } : fracAnswer(f),
    inputHint: fracInput(f),
    hints,
    steps,
    traps,
    solutionText
  };
}

function integerNumeric(prompt, value, { hints = [], steps = [], traps = [], suffix = '' } = {}) {
  return {
    prompt,
    answerType: 'numeric',
    answer: { value },
    answerSuffix: suffix,
    hints,
    steps,
    traps
  };
}

const commonPropertyTraps = {
  closure: { text: 'Closure', why: 'Closure asks whether the result stays in the set; it does not describe swapping or regrouping.' },
  comm: { text: 'Commutativity', why: 'Commutativity is about changing order: $a+b=b+a$ or $ab=ba$.' },
  assoc: { text: 'Associativity', why: 'Associativity is about changing grouping: $a+(b+c)=(a+b)+c$ or $a(bc)=(ab)c$.' },
  dist: { text: 'Distributivity', why: 'Distributivity connects multiplication with addition or subtraction.' }
};

export const NCERT_CLASS8_RATIONAL_GENERATORS = {
  'y8-ncert-rational-foundations': (rng, diff) => {
    if (diff === 1) {
      return propertyMcq(
        rng,
        'Which statement is the exact definition of a **rational number**?',
        '$\\dfrac{p}{q}$ where $p,q$ are integers and $q\\ne0$',
        [
          { text: '$\\dfrac{p}{q}$ where $p,q$ are natural numbers only', why: 'Rational numerators and denominators may be negative; integers are required.' },
          { text: '$\\dfrac{p}{q}$ where $q$ may be 0', why: 'Division by zero is undefined, so a rational-number denominator must be non-zero.' },
          { text: 'Only fractions that are not integers', why: 'Every integer $n$ is rational because $n=n/1$.' }
        ],
        ['Think about what values the numerator and denominator may take.', 'The denominator has one essential restriction.', 'Integers themselves must fit the definition.'],
        [
          { h: 'General form', d: 'A rational number can be represented as $p/q$.' },
          { h: 'Allowed values', d: '$p$ and $q$ are integers.' },
          { h: 'Essential restriction', d: '$q\\ne0$ because division by zero is undefined.' }
        ]
      );
    }
    if (diff === 2) {
      // x + add = rhs with a negative solution: whole numbers cannot hold it.
      const x = -ri(rng, 3, 19), add = ri(rng, 4, 25), rhs = x + add;
      return integerNumeric(`Solve $x+${add}=${rhs}$. Which extension beyond whole numbers is needed to contain the solution?`, x, {
        hints: [`Undo the addition of ${add}.`, `Subtract ${add} from both sides.`, `$x=${rhs}-${add}$.`],
        steps: [
          { h: 'Start', d: `$x+${add}=${rhs}$` },
          { h: `Subtract ${add}`, d: `$x=${rhs}-${add}$` },
          { h: 'Answer', d: `$x=${x}$, an integer but not a whole number` }
        ],
        traps: [{ value: -x, why: `Subtracting ${add} from ${rhs} gives ${x}, not ${-x}.` }]
      });
    }
    if (diff === 3) {
      // kx = m with k not dividing m: integers cannot hold the solution.
      const k = rc(rng, [2, 3, 4, 5, 6, 7]);
      let m = ri(rng, 1, 20);
      while (m % k === 0) m += 1;
      const ans = new Frac(m, k);
      return fractionNumeric(`Solve $${k}x=${m}$. Give the answer as a rational number in simplest form.`, ans, {
        requireFraction: true,
        hints: [`Divide both sides by ${k}.`, `$x=${m}\\div${k}$.`, 'Write the quotient as a fraction in lowest terms.'],
        steps: [
          { h: 'Start', d: `$${k}x=${m}$` },
          { h: `Divide by ${k}`, d: `$x=${rawFrac(m, k)}${ans.d === k && ans.n === m ? '' : `=${ans.latex()}`}$` },
          { h: 'Why rationals are needed', d: `$${ans.latex()}$ is not an integer, but it is rational.` }
        ],
        traps: [{ value: new Frac(k, m).value, why: `Dividing ${m} by ${k} gives $${ans.latex()}$, not its reciprocal.` }]
      });
    }
    // ax + b = 0 with a not dividing b: a negative, non-integer rational.
    const a = ri(rng, 2, 9);
    let b = ri(rng, 1, 20);
    while (b % a === 0) b += 1;
    const ans = new Frac(-b, a);
    return fractionNumeric(`Solve $${a}x+${b}=0$ exactly.`, ans, {
      hints: [`First isolate $${a}x$.`, `Subtract ${b} from both sides.`, `Then divide by ${a}.`],
      steps: [
        { h: 'Start', d: `$${a}x+${b}=0$` },
        { h: `Subtract ${b}`, d: `$${a}x=${-b}$` },
        { h: `Divide by ${a}`, d: `$x=${ans.latex()}$` },
        { h: 'Classification', d: `$${ans.latex()}$ is rational and is not an integer.` }
      ],
      traps: [
        { value: new Frac(b, a).value, why: `The ${b} moves by subtracting, so the numerator is negative.` },
        { value: new Frac(-a, b).value, why: `After $${a}x=${-b}$, divide ${-b} by ${a}; do not flip the quotient.` }
      ]
    });
  },

  'y8-ncert-rational-closure': (rng, diff) => {
    if (diff === 1) {
      const [a, b] = distinctFracs(rng, 2);
      const op = rc(rng, ['sum', 'difference', 'product']);
      const opName = op === 'sum' ? 'addition' : op === 'difference' ? 'subtraction' : 'multiplication';
      const sym = op === 'sum' ? '+' : op === 'difference' ? '-' : '\\times';
      const result = op === 'sum' ? a.add(b) : op === 'difference' ? a.sub(b) : a.mul(b);
      const general = op === 'sum' ? '$a+b=\\frac{ps+rq}{qs}$' : op === 'difference' ? '$a-b=\\frac{ps-rq}{qs}$' : '$ab=\\frac{pr}{qs}$';
      return propertyMcq(
        rng,
        `Take the rational numbers $${a.latex()}$ and $${b.latex()}$. Whichever two rational numbers are chosen, their ${op} is always a ______.`,
        'rational number',
        [
          { text: 'whole number', why: `$${a.latex()}${sym}${paren(b)}=${result.latex()}$ — the ${op} need not be a whole number.` },
          { text: 'natural number', why: `The ${op} can be negative or a fraction, so it need not be a natural number.` },
          { text: 'non-zero number', why: op === 'difference' ? 'The difference of two equal rational numbers is 0.' : 'A rational number can be 0, and so can the result.' }
        ],
        [`This is asking about closure under ${opName}.`, 'Write the two numbers as $\\frac pq$ and $\\frac rs$ with $q,s\\ne0$.', `Here $${a.latex()}${sym}${paren(b)}=${result.latex()}$; in general the result is an integer over a non-zero integer.`],
        [
          { h: 'Write two rationals', d: '$a=\\frac pq$ and $b=\\frac rs$ with $q,s\\ne0$' },
          { h: `Form the ${op}`, d: general },
          { h: 'Conclusion', d: `The numerator and $qs$ are integers and $qs\\ne0$, so the ${op} is rational: rational numbers are closed under ${opName}.` }
        ]
      );
    }
    if (diff === 2) {
      const { a, b, ans } = untilFraction(rng, () => {
        const [a, b] = distinctFracs(rng, 2);
        return { a, b, ans: a.sub(b) };
      }, () => ({ a: new Frac(5, 8), b: new Frac(-4, 5), ans: new Frac(5, 8).sub(new Frac(-4, 5)) }));
      const L = lcm(a.d, b.d);
      const an = a.n * (L / a.d), bn = b.n * (L / b.d);
      return fractionNumeric(`Work out the difference $${a.latex()}-${paren(b)}$. ${AS_FRACTION}`, ans, {
        requireFraction: true,
        hints: ['Use a common denominator.', `LCM$(${a.d},${b.d})=${L}$.`, `$${a.latex()}=${rawFrac(an, L)}$ and $${paren(b)}=${rawParen(bn, L)}$.`],
        steps: [
          { h: 'Common denominator', d: `$\\operatorname{LCM}(${a.d},${b.d})=${L}$` },
          { h: 'Convert', d: `$${a.latex()}=${rawFrac(an, L)},\\quad ${paren(b)}=${rawParen(bn, L)}$` },
          { h: 'Subtract numerators', d: `$\\frac{${an}${bn < 0 ? `+${-bn}` : `-${bn}`}}{${L}}=${rawFrac(an - bn, L)}${gcd(an - bn, L) === 1 ? '' : `=${ans.latex()}`}$` },
          { h: 'Closure check', d: 'The result is rational, illustrating closure under subtraction.' }
        ],
        traps: [
          { value: a.add(b).value, why: 'The second number is subtracted, not added.' },
          { value: -ans.value, why: 'Keep the order: the first number minus the second.' }
        ]
      });
    }
    if (diff === 3) {
      const { a, b, ans } = untilFraction(rng, () => {
        const [a, b] = distinctFracs(rng, 2);
        return { a, b, ans: a.div(b) };
      }, () => ({ a: new Frac(2, 7), b: new Frac(5, 3), ans: new Frac(6, 35) }));
      const recip = new Frac(b.d, b.n);
      const rawN = a.n * recip.n, rawD = a.d * recip.d;
      return fractionNumeric(`Work out the quotient $${a.latex()}\\div${paren(b)}$. ${AS_FRACTION}`, ans, {
        requireFraction: true,
        hints: ['Division by a non-zero rational number means multiply by its reciprocal.', `The reciprocal of $${b.latex()}$ is $${recip.latex()}$.`, 'Now multiply and reduce to lowest terms.'],
        steps: [
          { h: 'Reciprocal', d: `$${b.latex()}\\mapsto${recip.latex()}$` },
          { h: 'Replace division', d: `$${a.latex()}\\div${paren(b)}=${a.latex()}\\times${paren(recip)}$` },
          { h: 'Multiply', d: `$${rawFrac(rawN, rawD)}${gcd(rawN, rawD) === 1 ? '' : `=${ans.latex()}`}$` },
          { h: 'Closure caveat', d: 'The divisor was non-zero, so the quotient is a rational number.' }
        ],
        traps: [{ value: a.mul(b).value, why: `You multiplied by $${b.latex()}$ instead of its reciprocal $${recip.latex()}$.` }]
      });
    }
    return propertyMcq(
      rng,
      'Which statement gives the **most precise** closure result for rational numbers?',
      'They are closed under +, − and ×; division is closed only when the divisor is restricted to be non-zero.',
      [
        { text: 'They are closed under all four operations without restriction.', why: '$a\\div0$ is undefined, so unrestricted division is not closed.' },
        { text: 'They are not closed under subtraction because answers can be negative.', why: 'Negative rational numbers are still rational numbers.' },
        { text: 'They are closed only under addition and multiplication.', why: 'Unlike whole numbers, rationals are also closed under subtraction.' }
      ],
      ['Separate the operation from the domain restriction.', 'Addition, subtraction and multiplication never create a zero denominator.', 'Division by a rational is safe only when that divisor is not zero.'],
      [
        { h: 'Addition/subtraction', d: '$\\frac pq\\pm\\frac rs=\\frac{ps\\pm rq}{qs}$, with $qs\\ne0$' },
        { h: 'Multiplication', d: '$\\frac pq\\cdot\\frac rs=\\frac{pr}{qs}$, again rational' },
        { h: 'Division', d: '$\\frac pq\\div\\frac rs=\\frac{ps}{qr}$ requires $r\\ne0$' },
        { h: 'Conclusion', d: 'Unrestricted division fails because division by 0 is undefined.' }
      ]
    );
  },

  'y8-ncert-rational-commutativity': (rng, diff) => {
    if (diff === 1) {
      const [a, b] = distinctFracs(rng, 2);
      const mult = rng() < 0.6;
      const sym = mult ? '\\times' : '+';
      const opName = mult ? 'multiplication' : 'addition';
      const otherName = mult ? 'addition' : 'multiplication';
      return propertyMcq(
        rng,
        `$${paren(a)}${sym}${paren(b)}=${paren(b)}${sym}${paren(a)}$. Which property of rational numbers does this equation illustrate?`,
        `Commutativity of ${opName}`,
        [
          { text: `Commutativity of ${otherName}`, why: `The operation shown is ${opName}, not ${otherName}.` },
          commonPropertyTraps.assoc,
          commonPropertyTraps.dist
        ],
        ['Look at what changed from the left side to the right side.', 'The grouping did not change; only the order of the two numbers did.', `$${mult ? 'ab=ba' : 'a+b=b+a'}$ names the property.`],
        [
          { h: 'Compare the sides', d: `The same two numbers appear in reverse order under ${opName}.` },
          { h: 'Rule', d: `$${mult ? 'ab=ba' : 'a+b=b+a'}$` },
          { h: 'Property', d: `Commutativity of ${opName}` }
        ]
      );
    }
    if (diff === 2) {
      return propertyMcq(
        rng,
        'For rational numbers, which pair of operations is commutative?',
        'Addition and multiplication',
        [
          { text: 'Addition and subtraction', why: 'Subtraction is not commutative; for example $2-5\\ne5-2$.' },
          { text: 'Multiplication and division', why: 'Division is not commutative; for example $2\\div3\\ne3\\div2$.' },
          { text: 'Subtraction and division', why: 'Neither operation is commutative.' }
        ],
        ['Commutative means the order may be swapped.', 'Test a simple pair such as 2 and 3.', 'Only + and × survive the swap for every pair.'],
        [
          { h: 'Addition', d: '$a+b=b+a$' },
          { h: 'Multiplication', d: '$ab=ba$' },
          { h: 'Counterexamples', d: '$2-3\\ne3-2$ and $2\\div3\\ne3\\div2$' },
          { h: 'Answer', d: 'Addition and multiplication only' }
        ]
      );
    }
    if (diff === 3) {
      const a = new Frac(2, 3), b = new Frac(5, 4);
      const lhs = a.sub(b), rhs = b.sub(a);
      return propertyMcq(
        rng,
        'Compare $\\frac23-\\frac54$ and $\\frac54-\\frac23$. What does the comparison prove?',
        'Subtraction is not commutative',
        [
          { text: 'Subtraction is commutative', why: `$\\frac23-\\frac54=${lhs.latex()}$ while $\\frac54-\\frac23=${rhs.latex()}$; they are different.` },
          { text: 'Addition is not commutative', why: 'The calculation shown is subtraction, not addition.' },
          { text: 'Rational numbers are not closed under subtraction', why: 'Both results are rational; closure holds even though order matters.' }
        ],
        ['Compute both orders.', `$\\frac23-\\frac54=${lhs.latex()}$.`, `$\\frac54-\\frac23=${rhs.latex()}$.`],
        [
          { h: 'First order', d: `$\\frac23-\\frac54=${lhs.latex()}$` },
          { h: 'Reverse order', d: `$\\frac54-\\frac23=${rhs.latex()}$` },
          { h: 'Compare', d: `$${lhs.latex()}\\ne${rhs.latex()}$` },
          { h: 'Conclusion', d: 'Subtraction is not commutative.' }
        ]
      );
    }
    const a = signedFrac(rng), b = signedFrac(rng);
    const sum = a.add(b).sub(a).sub(b);
    return integerNumeric(
      `Without doing four separate denominator conversions, evaluate $${paren(a)}+${paren(b)}-${paren(a)}-${paren(b)}$.`,
      sum.n,
      {
        hints: ['Rewrite subtraction as addition of opposites.', 'Addition is commutative and associative.', 'Bring each number next to its additive inverse.'],
        steps: [
          { h: 'Rewrite', d: `$${paren(a)}+${paren(b)}+${paren(new Frac(-a.n, a.d))}+${paren(new Frac(-b.n, b.d))}$` },
          { h: 'Commute and regroup', d: `$[${paren(a)}+${paren(new Frac(-a.n, a.d))}]+[${paren(b)}+${paren(new Frac(-b.n, b.d))}]$` },
          { h: 'Use additive inverses', d: '$0+0$' },
          { h: 'Answer', d: '$0$' }
        ]
      }
    );
  },

  'y8-ncert-rational-associativity': (rng, diff) => {
    if (diff === 1) {
      const [a, b, c] = distinctFracs(rng, 3);
      const mult = rng() < 0.6;
      const sym = mult ? '\\times' : '+';
      const opName = mult ? 'multiplication' : 'addition';
      return propertyMcq(
        rng,
        `What allows $${paren(a)}${sym}\\left(${paren(b)}${sym}${paren(c)}\\right)$ to be computed as $\\left(${paren(a)}${sym}${paren(b)}\\right)${sym}${paren(c)}$?`,
        `Associativity of ${opName}`,
        [commonPropertyTraps.comm, commonPropertyTraps.dist, commonPropertyTraps.closure],
        ['The order of the three numbers is unchanged.', 'Only the brackets moved.', `$${mult ? 'a(bc)=(ab)c' : 'a+(b+c)=(a+b)+c'}$ is the relevant rule.`],
        [
          { h: 'Observe', d: `The order $${a.latex()},\\ ${b.latex()},\\ ${c.latex()}$ stays the same.` },
          { h: 'Only grouping changes', d: `$${mult ? 'a(bc)\\to(ab)c' : 'a+(b+c)\\to(a+b)+c'}$` },
          { h: 'Property', d: `Associativity of ${opName}` }
        ]
      );
    }
    if (diff === 2) {
      return propertyMcq(
        rng,
        'Compare $5-(7-3)$ and $(5-7)-3$. Which conclusion is correct?',
        'Subtraction is not associative',
        [
          { text: 'Subtraction is associative', why: '$5-(7-3)=1$ but $(5-7)-3=-5$.' },
          { text: 'Subtraction is not closed for integers', why: 'Both 1 and −5 are integers; this example concerns grouping, not closure.' },
          { text: 'Addition is not associative', why: 'No regrouping of an addition expression was tested.' }
        ],
        ['Evaluate inside the brackets first.', '$5-(7-3)=5-4=1$.', '$(5-7)-3=-2-3=-5$.'],
        [
          { h: 'Left grouping', d: '$5-(7-3)=5-4=1$' },
          { h: 'Right grouping', d: '$(5-7)-3=-2-3=-5$' },
          { h: 'Compare', d: '$1\\ne-5$' },
          { h: 'Conclusion', d: 'Subtraction is not associative.' }
        ]
      );
    }
    if (diff === 3) {
      // [a ÷ b] ÷ c against a ÷ [b ÷ c]: they differ by a factor c², and no
      // fraction in FRACS has c² = 1, so the comparison always separates them.
      const [a, b, c] = distinctFracs(rng, 3);
      const inner = a.div(b);
      const lhs = inner.div(c);
      const innerRight = b.div(c);
      const rhs = a.div(innerRight);
      return propertyMcq(
        rng,
        `Compare $\\left[${paren(a)}\\div${paren(b)}\\right]\\div${paren(c)}$ with $${paren(a)}\\div\\left[${paren(b)}\\div${paren(c)}\\right]$. What does the comparison show?`,
        'They are unequal, so division is not associative',
        [
          { text: 'They are equal, so division is associative', why: `The values are $${lhs.latex()}$ and $${rhs.latex()}$, which are unequal.` },
          { text: 'They are unequal, so rational numbers are not closed under division by non-zero numbers', why: 'Both values are rational; the failure is associativity, not closure.' },
          { text: 'They are equal because division is commutative', why: 'Division is neither commutative nor associative.' }
        ],
        ['Work on each bracketed expression separately.', `The left grouping gives $${lhs.latex()}$.`, `The right grouping gives $${rhs.latex()}$.`],
        [
          { h: 'Left inner bracket', d: `$${paren(a)}\\div${paren(b)}=${a.latex()}\\times${paren(new Frac(b.d, b.n))}=${inner.latex()}$` },
          { h: 'Left grouping', d: `$${paren(inner)}\\div${paren(c)}=${lhs.latex()}$` },
          { h: 'Right inner bracket', d: `$${paren(b)}\\div${paren(c)}=${innerRight.latex()}$` },
          { h: 'Right grouping', d: `$${paren(a)}\\div${paren(innerRight)}=${rhs.latex()}$` },
          { h: 'Conclusion', d: `$${lhs.latex()}\\ne${rhs.latex()}$, so division is not associative.` }
        ]
      );
    }
    const a = signedFrac(rng), b = signedFrac(rng), c = signedFrac(rng);
    const ans = a.add(b).add(c);
    return fractionNumeric(
      `Evaluate $${paren(a)}+(${paren(b)}+${paren(c)})$. ${AS_FRACTION} Your working should make clear why regrouping is allowed.`,
      ans,
      {
        requireFraction: true,
        hints: ['Addition of rationals is associative.', 'You may regroup to make the easiest pair first.', 'Then reduce the final fraction.'],
        steps: [
          { h: 'Associativity', d: `$${paren(a)}+(${paren(b)}+${paren(c)})=(${paren(a)}+${paren(b)})+${paren(c)}$` },
          { h: 'Add the first pair', d: `$${paren(a)}+${paren(b)}=${a.add(b).latex()}$` },
          { h: 'Add the last number', d: `$${a.add(b).latex()}+${paren(c)}=${ans.latex()}$` },
          { h: 'Answer', d: `$${ans.latex()}$` }
        ]
      }
    );
  },

  'y8-ncert-rational-identities': (rng, diff) => {
    if (diff === 1) {
      const a = signedFrac(rng);
      return propertyMcq(
        rng,
        `$${paren(a)}\\times1=1\\times${paren(a)}=${a.latex()}$. Which property is displayed?`,
        'Multiplicative identity',
        [
          { text: 'Additive identity', why: 'The additive identity is 0 and belongs to addition.' },
          { text: 'Multiplicative inverse', why: `An inverse would multiply with $${a.latex()}$ to produce 1; here 1 leaves the number unchanged.` },
          commonPropertyTraps.comm
        ],
        ['Which operation appears?', 'Which special number leaves a factor unchanged?', 'For multiplication that special number is 1.'],
        [
          { h: 'Identity rule', d: '$a\\times1=1\\times a=a$' },
          { h: 'Here', d: `$a=${a.latex()}$` },
          { h: 'Property', d: '1 is the multiplicative identity.' }
        ]
      );
    }
    if (diff === 2) {
      const a = signedFrac(rng);
      const inv = new Frac(a.d, a.n);
      return propertyMcq(
        rng,
        `$${paren(a)}\\times${paren(inv)}=1$. How are the two factors related?`,
        'They are multiplicative inverses (reciprocals)',
        [
          { text: 'They are additive inverses', why: 'Additive inverses add to 0; these factors multiply to 1.' },
          { text: 'They are additive identities', why: 'The additive identity is the single number 0.' },
          { text: 'They are equal rational numbers', why: `$${a.latex()}$ and $${inv.latex()}$ are not equal.` }
        ],
        ['Look at the product on the right.', 'Numbers whose product is 1 are multiplicative inverses.', 'For a non-zero fraction, swap numerator and denominator and keep the sign.'],
        [
          { h: 'Definition', d: '$a\\cdot a^{-1}=1$ for $a\\ne0$' },
          { h: 'Reciprocal', d: `The reciprocal of $${a.latex()}$ is $${inv.latex()}$.` },
          { h: 'Check', d: `$${paren(a)}\\times${paren(inv)}=1$` }
        ]
      );
    }
    if (diff === 3) {
      const a = signedFrac(rng);
      const inv = new Frac(-a.n, a.d);
      return fractionNumeric(`Find the **additive inverse** of $${a.latex()}$.`, inv, {
        hints: ['An additive inverse must add with the original number to give 0.', 'Keep the magnitude and change the sign.', `Check $${a.latex()}+?=0$.`],
        steps: [
          { h: 'Definition', d: 'The additive inverse of $a$ is the number $b$ for which $a+b=0$.' },
          { h: 'Change the sign', d: `$${a.latex()}\\to${inv.latex()}$` },
          { h: 'Check', d: `$${a.latex()}+${paren(inv)}=0$` },
          { h: 'Answer', d: `$${inv.latex()}$` }
        ],
        traps: [{ value: new Frac(a.d, a.n).value, why: 'Turning a fraction over gives the multiplicative inverse; the additive inverse changes its sign.' }]
      });
    }
    const a = signedFrac(rng);
    const inv = new Frac(a.d, a.n);
    return fractionNumeric(`Find $x$ if $${a.latex()}x=1$.`, inv, {
      hints: ['You need the multiplicative inverse of the coefficient.', 'The coefficient is non-zero.', 'Turn the fraction over, keeping its sign.'],
      steps: [
        { h: 'Equation', d: `$${a.latex()}x=1$` },
        { h: 'Use reciprocal', d: `The multiplicative inverse of $${a.latex()}$ is $${inv.latex()}$.` },
        { h: 'Multiply/divide', d: `$x=${inv.latex()}$` },
        { h: 'Check', d: `$${a.latex()}\\times${paren(inv)}=1$` }
      ],
      traps: [{ value: new Frac(-a.n, a.d).value, why: 'Changing the sign gives the additive inverse; this equation requires the multiplicative inverse.' }]
    });
  },

  'y8-ncert-rational-distributivity': (rng, diff) => {
    if (diff === 1) {
      return propertyMcq(
        rng,
        'Which identity states distributivity of multiplication over subtraction for rational numbers?',
        '$a(b-c)=ab-ac$',
        [
          { text: '$a(b-c)=ab-c$', why: 'The factor $a$ must multiply both terms inside the bracket.' },
          { text: '$a(b-c)=a-bc$', why: 'Distribution does not move the factor onto only the second term.' },
          { text: '$a(b-c)=(ab)c$', why: 'That expression is a regrouping idea, not distributivity.' }
        ],
        ['The outside factor must reach every term in the bracket.', 'Keep the subtraction sign.', 'Multiply $a$ by both $b$ and $c$.'],
        [
          { h: 'Distribute to first term', d: '$a\\cdot b=ab$' },
          { h: 'Distribute to second term', d: '$a\\cdot c=ac$' },
          { h: 'Preserve the operation', d: '$a(b-c)=ab-ac$' }
        ]
      );
    }
    if (diff === 2) {
      const { a, b, c, ans } = untilFraction(rng, () => {
        const a = signedFrac(rng);
        const [b, c] = distinctFracs(rng, 2);
        return { a, b, c, ans: a.mul(b.add(c)) };
      }, () => ({ a: new Frac(7, 5), b: new Frac(-1, 4), c: new Frac(5, 12), ans: new Frac(7, 30) }));
      const inside = b.add(c);
      return fractionNumeric(`Find $${paren(a)}\\left(${b.latex()}\\right)+${paren(a)}\\left(${c.latex()}\\right)$ **using distributivity**. ${AS_FRACTION}`, ans, {
        requireFraction: true,
        hints: [`Both terms have the common factor $${a.latex()}$.`, 'Factor it out: $ab+ac=a(b+c)$.', `$${b.latex()}${signedTerm(c)}=${inside.latex()}$.`],
        steps: [
          { h: 'Factor the common rational', d: `$${paren(a)}\\left(${b.latex()}${signedTerm(c)}\\right)$` },
          { h: 'Combine inside', d: `$${b.latex()}${signedTerm(c)}=${inside.latex()}$` },
          { h: 'Multiply', d: `$${paren(a)}\\times${paren(inside)}=${ans.latex()}$` },
          { h: 'Answer', d: `$${ans.latex()}$` }
        ],
        traps: [{ value: a.mul(b).add(c).value, why: `The factor $${a.latex()}$ multiplies both brackets, not only the first.` }]
      });
    }
    if (diff === 3) {
      // Two fractions written unreduced that are opposites of each other: the
      // bracket collapses to 0 once each is reduced.
      const a = signedFrac(rng);
      const d = rc(rng, [2, 3, 4, 5, 6]);
      const k1 = rc(rng, [2, 3, 4]);
      let k2 = rc(rng, [2, 3, 4, 5]);
      if (k2 === k1) k2 += 1;
      return integerNumeric(`Find $${paren(a)}\\left(${rawFrac(k1, k1 * d)}\\right)+${paren(a)}\\left(${rawFrac(-k2, k2 * d)}\\right)$ using distributivity.`, 0, {
        hints: [`Factor out $${a.latex()}$.`, `Reduce $${rawFrac(k1, k1 * d)}$ and $${rawFrac(-k2, k2 * d)}$ to lowest terms.`, `The bracket becomes $\\frac{1}{${d}}-\\frac{1}{${d}}$.`],
        steps: [
          { h: 'Factor', d: `$${paren(a)}\\left(${rawFrac(k1, k1 * d)}-${rawFrac(k2, k2 * d)}\\right)$` },
          { h: 'Reduce inside', d: `$${rawFrac(k1, k1 * d)}=\\frac{1}{${d}}$ and $${rawFrac(k2, k2 * d)}=\\frac{1}{${d}}$` },
          { h: 'Bracket', d: `$\\frac{1}{${d}}-\\frac{1}{${d}}=0$` },
          { h: 'Answer', d: `$${paren(a)}\\times0=0$` }
        ],
        traps: [{ value: a.mul(new Frac(2, d)).value, why: 'The second fraction is negative, so the bracket is a difference, not a sum.' }]
      });
    }
    const a = signedFrac(rng);
    const b = signedFrac(rng);
    const c = signedFrac(rng);
    const ans = a.mul(b.sub(c));
    return fractionNumeric(
      `Evaluate $${paren(a)}\\left(${b.latex()}\\right)-${paren(a)}\\left(${c.latex()}\\right)$ by factoring the common rational number. ${AS_FRACTION}`,
      ans,
      {
        requireFraction: true,
        hints: [`Both products contain $${a.latex()}$.`, 'Use $ab-ac=a(b-c)$.', `First calculate $${paren(b)}-${paren(c)}$.`],
        steps: [
          { h: 'Factor', d: `$${paren(a)}\\left[${paren(b)}-${paren(c)}\\right]$` },
          { h: 'Bracket', d: `$${paren(b)}-${paren(c)}=${b.sub(c).latex()}$` },
          { h: 'Multiply', d: `$${a.latex()}\\times${paren(b.sub(c))}=${ans.latex()}$` },
          { h: 'Answer', d: `$${ans.latex()}$` }
        ]
      }
    );
  },

  'y8-ncert-rational-strategy': (rng, diff) => {
    if (diff === 1) {
      // Four terms whose denominators pair up (p with mp, q with nq), so
      // regrouping before one big LCM is the efficient route.
      const { A, B, C, D, ans } = untilFraction(rng, () => {
        const [p, q] = (() => { const pool = [5, 7, 9, 11, 13]; const first = rc(rng, pool); return [first, rc(rng, pool.filter(x => x !== first))]; })();
        const m = rc(rng, [2, 3]), n = rc(rng, [2, 3]);
        const small = () => (rng() < 0.5 ? -1 : 1) * ri(rng, 1, 4);
        const odd = k => { const pool = (k === 2 ? [1, 3, 5, 7, 9] : [1, 2, 4, 5, 7, 8]); return (rng() < 0.5 ? -1 : 1) * rc(rng, pool); };
        let x3 = odd(m); if (Math.abs(x3) === p) x3 = x3 > 0 ? x3 + 1 : x3 - 1;
        let x4 = odd(n); if (Math.abs(x4) === q) x4 = x4 > 0 ? x4 + 1 : x4 - 1;
        const A = new Frac(small(), p), B = new Frac(small(), q), C = new Frac(x3, m * p), D = new Frac(x4, n * q);
        if (C.d !== m * p || D.d !== n * q) return null;
        return { A, B, C, D, ans: A.add(B).add(C).add(D) };
      }, () => {
        const A = new Frac(3, 7), B = new Frac(-5, 11), C = new Frac(-8, 21), D = new Frac(4, 22);
        return { A, B, C, D, ans: A.add(B).add(C).add(D) };
      });
      const first = A.add(C), second = B.add(D);
      return fractionNumeric(`Find the sum $${joinSum([A, B, C, D])}$ efficiently. ${AS_FRACTION}`, ans, {
        requireFraction: true,
        hints: ['Do not rush to one four-denominator LCM.', `Group $${A.latex()}$ with $${C.latex()}$, and $${B.latex()}$ with $${D.latex()}$: each pair shares a factor in its denominators.`, 'Then combine the two simple results.'],
        steps: [
          { h: 'Regroup', d: `$\\left(${A.latex()}${signedTerm(C)}\\right)+\\left(${B.latex()}${signedTerm(D)}\\right)$` },
          { h: 'First pair', d: `$${A.latex()}${signedTerm(C)}=${first.latex()}$` },
          { h: 'Second pair', d: `$${B.latex()}${signedTerm(D)}=${second.latex()}$` },
          { h: 'Final LCM', d: `$${first.latex()}${signedTerm(second)}=${ans.latex()}$` },
          { h: 'Answer', d: `$${ans.latex()}$` }
        ],
        traps: [{ value: -ans.value, why: 'Check the sign of each pair before the final addition.' }],
        solutionText: 'Commutativity and associativity make the arithmetic smaller before the final LCM.'
      });
    }
    if (diff === 2) {
      // Four factors built so that numerators cancel against other
      // denominators: the product collapses to ±k/(mn).
      const { f1, f2, f3, f4, negatives, ans, p13, p24 } = untilFraction(rng, () => {
        const Aa = ri(rng, 2, 9), Bb = ri(rng, 2, 9), Cc = ri(rng, 2, 9), Dd = ri(rng, 2, 9);
        const k = rc(rng, [1, 3]), m = rc(rng, [2, 3, 4]), n = rc(rng, [2, 3, 4]);
        // Each written factor is a genuine fraction in lowest terms except the
        // two that are meant to cancel; nothing displayed is an integer in disguise.
        if (gcd(Aa, Bb) !== 1 || gcd(Cc, Dd) !== 1 || Bb * k === Aa * m || Dd === Cc * n) return null;
        const signs = [1, 1, 1, 1].map(() => (rng() < 0.5 ? -1 : 1));
        const negatives = signs.filter(s => s < 0).length;
        const sign = negatives % 2 === 0 ? 1 : -1;
        const f1 = { n: signs[0] * Aa, d: Bb }, f2 = { n: signs[1] * Cc, d: Dd }, f3 = { n: signs[2] * Bb * k, d: Aa * m }, f4 = { n: signs[3] * Dd, d: Cc * n };
        const p13 = new Frac(signs[0] * signs[2] * k, m), p24 = new Frac(signs[1] * signs[3], n);
        return { f1, f2, f3, f4, negatives, ans: new Frac(sign * k, m * n), p13, p24 };
      }, () => ({
        f1: { n: -4, d: 5 }, f2: { n: 3, d: 7 }, f3: { n: 15, d: 16 }, f4: { n: -14, d: 9 }, negatives: 2,
        ans: new Frac(1, 2), p13: new Frac(-3, 4), p24: new Frac(-2, 3)
      }));
      const show = f => rawFrac(f.n, f.d);
      const showP = f => rawParen(f.n, f.d);
      return fractionNumeric(`Find the product $${show(f1)}\\times${showP(f2)}\\times${showP(f3)}\\times${showP(f4)}$. ${AS_FRACTION}`, ans, {
        requireFraction: true,
        hints: [`${negatives === 0 ? 'No factor is negative' : `${negatives} of the factors ${negatives === 1 ? 'is' : 'are'} negative`}, so the result is ${negatives % 2 === 0 ? 'positive' : 'negative'}.`, 'Regroup so that a numerator sits over the denominator it cancels with.', 'Cancel before multiplying.'],
        steps: [
          { h: 'Sign', d: `${negatives} negative factor${negatives === 1 ? '' : 's'} $\\Rightarrow$ ${negatives % 2 === 0 ? 'positive' : 'negative'} product` },
          { h: 'Regroup', d: `$\\left(${show(f1)}\\times${showP(f3)}\\right)\\left(${show(f2)}\\times${showP(f4)}\\right)$` },
          { h: 'First product', d: `$${show(f1)}\\times${showP(f3)}=${p13.latex()}$` },
          { h: 'Second product', d: `$${show(f2)}\\times${showP(f4)}=${p24.latex()}$` },
          { h: 'Finish', d: `$${paren(p13)}\\times${paren(p24)}=${ans.latex()}$` }
        ],
        traps: [{ value: -ans.value, why: 'Count the negative factors: an even number gives a positive product.' }],
        solutionText: 'The intended skill is strategic cancellation, not large-number multiplication.'
      });
    }
    if (diff === 3) {
      // b·a − c − a·d with b + d = 1: factoring the shared a leaves a − c.
      const { a, b, c, d, ans } = untilFraction(rng, () => {
        const a = signedFrac(rng), c = signedFrac(rng);
        const q = rc(rng, [5, 7, 9, 11]);
        const p = ri(rng, 1, q - 1);
        const b = new Frac(p, q), d = new Frac(q - p, q);
        if (b.d !== q || d.d !== q) return null;
        return { a, b, c, d, ans: a.sub(c) };
      }, () => ({ a: new Frac(-3, 7), b: new Frac(2, 5), c: new Frac(1, 14), d: new Frac(3, 5), ans: new Frac(-1, 2) }));
      const cTerm = c.n < 0 ? `+${new Frac(-c.n, c.d).latex()}` : `-${c.latex()}`;
      return fractionNumeric(`Evaluate $${b.latex()}\\times${paren(a)}${cTerm}-${paren(a)}\\times${d.latex()}$ by factoring the shared rational number. ${AS_FRACTION}`, ans, {
        requireFraction: true,
        hints: ['Rewrite the two products so the same factor appears in both.', `Factor out $${a.latex()}$.`, `$${b.latex()}+${d.latex()}=1$.`],
        steps: [
          { h: 'Reveal the common factor', d: `$${paren(a)}\\left(${b.latex()}\\right)+${paren(a)}\\left(${d.latex()}\\right)${cTerm}$` },
          { h: 'Factor by distributivity', d: `$${paren(a)}\\left(${b.latex()}+${d.latex()}\\right)${cTerm}$` },
          { h: 'Simplify bracket', d: `$${b.latex()}+${d.latex()}=1$` },
          { h: 'Combine', d: `$${a.latex()}${cTerm}=${ans.latex()}$` },
          { h: 'Answer', d: `$${ans.latex()}$` }
        ],
        traps: [{ value: a.mul(b).sub(c).sub(a.mul(d)).value === ans.value ? a.add(c).value : a.mul(b).sub(c).add(a.mul(d)).value, why: 'The last product is subtracted; keep its sign when you factor.' }],
        solutionText: 'Distributivity in reverse is the key observation.'
      });
    }
    const p = ri(rng, 2, 7), q = ri(rng, 2, 7);
    const a = new Frac(p, p + 1), b = new Frac(1, q), c = new Frac(p, p + 1), d = new Frac(q - 1, q);
    const ans = a;
    return fractionNumeric(
      `Topper challenge: evaluate $${a.latex()}\\times${b.latex()}+${c.latex()}\\times${d.latex()}$ without multiplying the two products separately. ${AS_FRACTION}`,
      ans,
      {
        requireFraction: true,
        hints: ['The same factor appears in both products.', `Factor out $${a.latex()}$.`, `Notice $${b.latex()}+${d.latex()}=1$.`],
        steps: [
          { h: 'Common factor', d: `$${a.latex()}[${b.latex()}+${d.latex()}]$` },
          { h: 'Inside bracket', d: `$${b.latex()}+${d.latex()}=1$` },
          { h: 'Use multiplicative identity', d: `$${a.latex()}\\times1=${a.latex()}$` },
          { h: 'Answer', d: `$${ans.latex()}$` }
        ],
        solutionText: 'This combines distributivity with the role of 1, exactly the kind of structural shortcut a topper should look for.'
      }
    );
  },

  'y8-ncert-rational-between': (rng, diff) => {
    if (diff === 1) {
      const a = new Frac(1, 3), b = new Frac(2, 3), mid = a.add(b).div(new Frac(2));
      return fractionNumeric('Use the **mean method** to find one rational number strictly between $\\frac13$ and $\\frac23$.', mid, {
        hints: ['Average the two rational numbers.', 'Add them, then divide by 2.', 'The result must be greater than $1/3$ and less than $2/3$.'],
        steps: [
          { h: 'Mean', d: '$\\frac12(\\frac13+\\frac23)$' },
          { h: 'Add', d: '$\\frac13+\\frac23=1$' },
          { h: 'Halve', d: '$\\frac12\\times1=\\frac12$' },
          { h: 'Check', d: '$\\frac13<\\frac12<\\frac23$' }
        ]
      });
    }
    if (diff === 2) {
      let a = signedFrac(rng), b = signedFrac(rng);
      if (a.value === b.value) b = new Frac(b.n + b.d, b.d);
      if (a.value > b.value) [a, b] = [b, a];
      const mid = a.add(b).div(new Frac(2));
      return fractionNumeric(`Find the mean of $${a.latex()}$ and $${b.latex()}$, giving a rational number strictly between them.`, mid, {
        hints: ['Use $(a+b)/2$.', 'First add the endpoints exactly.', 'Then multiply by $1/2$.'],
        steps: [
          { h: 'Formula', d: '$m=\\frac{a+b}{2}$' },
          { h: 'Add endpoints', d: `$${a.latex()}+${b.n < 0 ? `\\left(${b.latex()}\\right)` : b.latex()}=${a.add(b).latex()}$` },
          { h: 'Divide by 2', d: `$m=${a.add(b).latex()}\\div2=${mid.latex()}$` },
          { h: 'Location', d: `$${a.latex()}<${mid.latex()}<${b.latex()}$` }
        ]
      });
    }
    if (diff === 3) {
      const a = new Frac(1, 4), b = new Frac(3, 4);
      const m1 = a.add(b).div(new Frac(2));
      const m2 = a.add(m1).div(new Frac(2));
      return fractionNumeric('Start with $\\frac14$ and $\\frac34$. First take their mean, then take the mean of $\\frac14$ and that first mean. What is the **second** mean?', m2, {
        hints: ['First mean: $(1/4+3/4)/2$.', 'That first mean is $1/2$.', 'Now average $1/4$ and $1/2$.'],
        steps: [
          { h: 'First mean', d: '$m_1=\\frac12(\\frac14+\\frac34)=\\frac12$' },
          { h: 'Repeat', d: '$m_2=\\frac12(\\frac14+\\frac12)$' },
          { h: 'Add', d: '$\\frac14+\\frac12=\\frac34$' },
          { h: 'Halve', d: '$m_2=\\frac38$' },
          { h: 'Meaning', d: 'Repeating this construction keeps producing new rationals between the endpoints.' }
        ]
      });
    }
    return propertyMcq(
      rng,
      'How many rational numbers lie strictly between any two **different** rational numbers?',
      'Infinitely many',
      [
        { text: 'Exactly one', why: 'After finding one mean, take another mean between an endpoint and that new rational number.' },
        { text: 'A finite number depending on the denominators', why: 'The repeated-mean construction works forever, regardless of the denominators.' },
        { text: 'Possibly none if the numbers are very close', why: 'The mean is always strictly between two different numbers, however close they are.' }
      ],
      ['Find one rational using the mean.', 'Can you repeat the same construction?', 'There is no final step at which the process must stop.'],
      [
        { h: 'Take two rationals', d: '$a<b$' },
        { h: 'Construct one', d: '$m_1=(a+b)/2$ is rational and satisfies $a<m_1<b$' },
        { h: 'Construct another', d: '$m_2=(a+m_1)/2$ is rational and satisfies $a<m_2<m_1$' },
        { h: 'Repeat indefinitely', d: 'The construction never runs out, so there are infinitely many rational numbers between $a$ and $b$.' }
      ]
    );
  }
};

export const NCERT_CLASS8_RATIONAL_CONTENT = Object.freeze({
  source: {
    board: 'NCERT / CBSE',
    class: 8,
    chapter: 1,
    title: 'Rational Numbers',
    edition: 'Reprint 2024–25',
    pages: 14
  },
  sourceMap: NCERT_CLASS8_RATIONAL_SOURCE_MAP,
  dotpoints: NCERT_CLASS8_RATIONAL_DOTPOINTS,
  topperNotes: NCERT_CLASS8_RATIONAL_TOPPER_NOTES,
  workedExamples: NCERT_CLASS8_RATIONAL_WORKED_EXAMPLES,
  sourceChecks: NCERT_CLASS8_RATIONAL_SOURCE_CHECKS,
  questionBank: {
    generators: NCERT_CLASS8_RATIONAL_GENERATOR_IDS,
    difficultyLevels: [1, 2, 3, 4],
    authoredCells: NCERT_CLASS8_RATIONAL_GENERATOR_IDS.length * 4,
    inputSupport: ['type', 'AI handwriting', 'photo OCR'],
    solutionSupport: 'Every generated form carries hints, misconception feedback and a fully worked step sequence.'
  }
});
