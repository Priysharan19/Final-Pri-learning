// Pri Learning · CBSE/NCERT Class X Real Numbers — irrationality proofs.
//
// The current source explicitly asks students to prove irrationality of √2, √3
// and √5. These forms assess the logical contradiction argument in bounded,
// deterministic steps. They deliberately do NOT claim to auto-mark arbitrary
// free-form prose proofs.
import { ri, rc, mcq } from '../qhelpers.js';

const PRIMES = Object.freeze([2, 3, 5]);

function root(p) { return `\\sqrt{${p}}`; }

function proofSteps(p) {
  return [
    { h: 'Assume the opposite', d: `Suppose $${root(p)}=\\dfrac{a}{b}$ where $a,b$ are positive coprime integers.` },
    { h: 'Square and rearrange', d: `$${p}b^2=a^2$, so the prime $${p}$ divides $a^2$ and therefore divides $a$.` },
    { h: 'Substitute the divisibility', d: `Write $a=${p}k$. Then $${p}b^2=${p * p}k^2$, so $b^2=${p}k^2$ and $${p}$ also divides $b$.` },
    { h: 'Contradiction', d: `$${p}$ divides both $a$ and $b$, contradicting that $\\gcd(a,b)=1$. Therefore $${root(p)}$ is irrational.` }
  ];
}

export function currentIrrationalityProof(rng, diff) {
  const p = rc(rng, PRIMES);
  const steps = proofSteps(p);

  if (diff === 1) {
    const correct = `Assume $${root(p)}=\\dfrac{a}{b}$ for coprime positive integers $a,b$`;
    const m = mcq(rng, correct, [
      { text: `Assume $${root(p)}$ is an integer`, why: 'That is stronger than the negation of irrationality and does not cover all rational numbers.' },
      { text: `Assume $${root(p)}=a+b$ for integers $a,b$`, why: 'A rational number must be represented as a quotient, not an arbitrary sum of integers.' },
      { text: `Assume $a$ and $b$ have a common factor`, why: 'The fraction should first be reduced to lowest terms; coprimality is what the final contradiction will violate.' }
    ]);
    return {
      prompt: `To prove $${root(p)}$ is irrational by contradiction, which assumption should the proof begin with?`,
      answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
      hints: [
        'A contradiction proof assumes the negation of the desired conclusion.',
        'The negation of “irrational” is “rational”.',
        'Write a rational number as a fraction in lowest terms.'
      ],
      steps,
      dotpoint: 1,
      proofSkill: 'contradiction-setup'
    };
  }

  if (diff === 2) {
    const correct = `$${p}\\mid a$`;
    const m = mcq(rng, correct, [
      { text: `$a\\mid ${p}$`, why: 'Divisibility is reversed. From the equation we know the prime divides the square, not that the square’s root divides the prime.' },
      { text: `$${p * p}\\mid a$`, why: `From $${p}\\mid a^2$ and primality we may conclude $${p}\\mid a$, not necessarily $${p * p}\\mid a$.` },
      { text: `$${p}\\nmid a$`, why: `For a prime $p$, if $p$ divides $a^2=a\\cdot a$, Euclid's lemma forces $p$ to divide $a$.` }
    ]);
    return {
      prompt: `Assume $${root(p)}=\\dfrac{a}{b}$ in lowest terms. Squaring gives $${p}b^2=a^2$, so $${p}\\mid a^2$. Since $${p}$ is prime, what must follow?`,
      answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
      hints: [
        'Use the prime-divisor property: if a prime divides a product, it divides at least one factor.',
        '$a^2=a\\cdot a$.',
        `Therefore the prime $${p}$ divides $a$.`
      ],
      steps,
      dotpoint: 1,
      proofSkill: 'prime-divisibility'
    };
  }

  if (diff === 3) {
    const correct = `$${p}$ divides both $a$ and $b$, contradicting $\\gcd(a,b)=1$`;
    const m = mcq(rng, correct, [
      { text: `$a=b$, contradicting that the fraction is proper`, why: 'The proof never requires the fraction to be proper, and it does not imply a=b.' },
      { text: `$a$ and $b$ are both even`, why: p === 2 ? 'For √2 this is a consequence, but the general contradiction is that the same prime divides both coprime integers.' : `For √${p}, the common divisor is ${p}, not necessarily 2.` },
      { text: `$b=0$, contradicting the definition of a fraction`, why: 'No step implies b=0; b was chosen positive and the contradiction comes from a common prime factor.' }
    ]);
    return {
      prompt: `In the contradiction proof for $${root(p)}$, the argument reaches $${p}\\mid a$ and $${p}\\mid b$. What is the contradiction?`,
      answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
      hints: [
        'Recall why the rational representation was chosen in lowest terms.',
        'Lowest terms means the numerator and denominator have no common factor greater than 1.',
        `$${p}$ is a common prime factor of both.`
      ],
      steps,
      dotpoint: 1,
      proofSkill: 'coprimality-contradiction'
    };
  }

  const badStep = ri(rng, 0, 1);
  const invalid = badStep === 0
    ? `From $${p}\\mid a^2$, conclude $${p * p}\\mid a$`
    : `From $b^2=${p}k^2$, conclude $b=${p}k^2$`;
  const correctWhy = badStep === 0
    ? `Primality only gives $${p}\\mid a$; it does not give $${p * p}\\mid a$.`
    : 'Divisibility of a square does not permit taking square roots term-by-term in that way; the valid conclusion is that the prime divides b.';
  const m = mcq(rng, invalid, [
    { text: `Assume $${root(p)}=\\dfrac{a}{b}$ with $\\gcd(a,b)=1$`, why: 'This is the correct contradiction setup: assume the square root is rational and reduce the fraction to lowest terms.' },
    { text: `From $${p}b^2=a^2$, conclude $${p}\\mid a^2$`, why: 'This is valid because the left side is visibly a multiple of the prime.' },
    { text: `If $${p}\\mid a$, write $a=${p}k$ for some integer $k$`, why: 'This is exactly the definition of divisibility and is a valid substitution.' }
  ]);
  return {
    prompt: `A student is proving $${root(p)}$ irrational by contradiction. Which proposed line is invalid?`,
    answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
    hints: [
      'Check each implication, not just whether its symbols resemble the standard proof.',
      'A prime dividing a square implies it divides the base, but do not strengthen that conclusion without justification.',
      correctWhy
    ],
    steps: [
      ...steps,
      { h: 'Diagnose the invalid line', d: `${invalid}. ${correctWhy}` }
    ],
    dotpoint: 1,
    proofSkill: 'proof-diagnosis'
  };
}
