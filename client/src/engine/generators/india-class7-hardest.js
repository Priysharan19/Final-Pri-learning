// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · CBSE/NCERT Class VII — hardest-level (D3) forms, Part I
//
// The CBSE track serves D1–D3. In every Class VII chapter, the D3 rung was
// authored for one dot point only, so the picker could not offer the hardest
// level for the others, and a dot point whose only form sat at D4 had nothing
// in the CBSE window at all (docs/release/evidence/india-difficulty-coverage.md).
// Each generator below authors exactly one rung — the D3 form for one dot point
// of NCERT Ganita Prakash Grade 7 Part I (2026–27) — and the coverage table
// (curriculum-in-hardest-covers.js) claims it at D3 and nowhere else.
//
// What makes these D3 rather than another D2 is the reasoning, not the size of
// the numbers. Each form needs two connected steps or a non-routine use of the
// chapter's idea: rounding run backwards (the greatest possible difference of
// two rounded counts), choosing where a pair of brackets does the most, a
// product of fractions that telescopes, counting zeros by pairing 2s with 5s,
// an angle at a point between two parallel lines, a magic square completed from
// three entries, a cryptarithm whose digits are forced one after another.
//
// Scope is the Grade 7 book and nothing beyond it: whole numbers, integers,
// fractions and terminating decimals; no exponents in an answer, no
// trigonometry, no algebra beyond one letter-number at a time (two in a
// formula that is supplied). Language is kept to what a Class VII student
// reads, and the contexts are Indian (rupees, lakhs and crores, IPL matches,
// Dras in winter) where a context is used at all.
//
// Provenance. These are original, parameterised forms written for Pri
// Learning, aligned to the chapter intent of the 2026–27 Ganita Prakash Part I
// text. They are not transcribed from a textbook exercise or a past paper:
// every number is drawn from the seed and every keyed answer is computed from
// the parameters, never typed. client/test/india-hardest-forms-check.mjs
// re-derives each answer from the rendered prompt by a second route
// (client/test/support/india-hardest-class7-solvers.mjs). None of this is a
// human maths review, and nothing here claims board approval.
//
// Asked for any rung other than D3, each generator returns its D3 form. No
// coverage entry claims these generators below or above D3, and the check
// fails if one ever does, so the label a student sees is always D3.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, gcd, makeRng } from '../qhelpers.js';
import { frac, fracTex, IN_NAMES, IN_CITIES } from './india-native-helpers.js';
import {
  FALLBACK_SEED, traps, texNum, dec, numericAnswer, ordinal, pick, shuffled, plusConst, linearTex
} from './india-class7-hardest-kit.js';

const list = items => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);
const times = m => (m === 2 ? 'twice' : m === 3 ? 'three times' : `${m} times`);

// ══ 1 · Large Numbers Around Us ═════════════════════════════════════════════

const PLACES = [
  { many: 'crores', value: 10000000 },
  { many: 'ten-lakhs', value: 1000000 },
  { many: 'lakhs', value: 100000 },
  { many: 'ten-thousands', value: 10000 },
  { many: 'thousands', value: 1000 },
  { many: 'hundreds', value: 100 },
  { many: 'tens', value: 10 }
];

// dp 0 · Indian and international place value. A number described by counts
// of its places, most of them 10 or more, so it has to be regrouped before it
// can be written — then either written in figures, or read in millions.
function placeValueRegroup(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const top = ri(rng, 0, 2);
    const rest = pick(rng, [1, 2, 3, 4, 5, 6].filter(i => i > top), 3).sort((a, b) => a - b);
    const idx = [top, ...rest];
    const counts = idx.map((_, i) => (i === 0 ? ri(rng, 2, 9) : ri(rng, 11, 48)));
    const N = idx.reduce((s, p, i) => s + counts[i] * PLACES[p].value, 0);
    const ask = rng() < 0.5 ? 'figures' : 'millions';
    if (ask === 'millions' && N < 2000000) continue;
    const parts = idx.map((p, i) => `$${counts[i]}$ ${PLACES[p].many}`);
    const values = idx.map((p, i) => `$${counts[i]}$ ${PLACES[p].many} $= ${texNum(counts[i] * PLACES[p].value)}$`);
    const millions = Math.floor(N / 1000000);
    const tenThousandAt = idx.indexOf(3);
    const misread = tenThousandAt >= 0 ? N - counts[tenThousandAt] * 9000 : null;
    const base = {
      hints: [
        'Work out what each part is worth on its own — how many zeros does each place carry?',
        'A count of ten or more in one place spills over into the places to its left, so add the parts rather than writing the counts side by side.',
        ...(ask === 'millions'
          ? ['Write the total with international commas (groups of three digits from the right). One million is ten lakh.']
          : ['Line the parts up by place value and add them.'])
      ]
    };
    if (ask === 'figures') {
      return {
        prompt: `A number is made up of ${list(parts)} — and nothing else. Write this number in figures.`,
        ...numericAnswer(N),
        traps: traps(N, misread == null ? [] : [{ value: misread, why: 'A ten-thousand is $10{,}000$, not $1{,}000$ — check the value of each place.' }]),
        ...base,
        steps: [
          { h: 'Value of each part', d: values.join('; ') },
          { h: 'Add the parts', d: `$${idx.map((p, i) => texNum(counts[i] * PLACES[p].value)).join(' + ')} = ${texNum(N)}$` },
          { h: 'Answer', d: `The number is $${texNum(N)}$.` }
        ]
      };
    }
    return {
      prompt: `A number is made up of ${list(parts)} — and nothing else. When this number is read in the international system, it is read as “$\\square$ million $\\square$ thousand $\\square$”. How many millions does it have?`,
      ...numericAnswer(millions),
      traps: traps(millions, [
        { value: Math.floor(N / 100000), why: 'That is the number of lakhs. One million is ten lakh, so there are fewer millions than lakhs.' },
        { value: Math.floor(N / 10000000), why: 'That is the number of crores. One crore is ten million.' }
      ]),
      ...base,
      steps: [
        { h: 'Value of each part', d: values.join('; ') },
        { h: 'The number', d: `$${texNum(N)}$ in the Indian system` },
        { h: 'International commas', d: `$${String(N).replace(/\B(?=(\d{3})+(?!\d))/g, '{,}')}$ — the digits before the second comma from the right are the millions.` },
        { h: 'Answer', d: `$${millions}$ million` }
      ]
    };
  }
  return placeValueRegroup(makeRng(FALLBACK_SEED));
}

// Crores and lakhs read as millions, and millions read as crores.
function croreMillion(rng) {
  const city = rc(rng, IN_CITIES);
  const variant = rc(rng, ['crore-lakh', 'million', 'lakh']);
  if (variant === 'crore-lakh') {
    const X = ri(rng, 2, 99), Y = ri(rng, 1, 99);
    const tenths = 100 * X + Y;                         // millions, in tenths
    const thing = rc(rng, ['a new metro station', 'a flyover', 'a government hospital', 'a sports stadium', 'a water treatment plant']);
    return {
      prompt: `The cost of building ${thing} in ${city} is ₹$${X}$ crore $${Y}$ lakh. An English business newspaper reports the cost in millions of rupees. Write the cost in millions of rupees.`,
      ...numericAnswer(tenths, 1, 'million'),
      traps: traps(tenths / 10, [
        { value: tenths, why: `That is the cost in lakhs. One million is ten lakh, so divide the number of lakhs by 10.` },
        { value: X + Y / 100, why: 'That is the cost in crores. One crore is ten million.' }
      ]),
      hints: [
        'One crore is ten million, and one million is ten lakh.',
        'Change the crores into millions and the lakhs into millions separately.',
        'Add the two parts.'
      ],
      steps: [
        { h: 'Crores to millions', d: `$${X}$ crore $= ${X} \\times 10 = ${10 * X}$ million` },
        { h: 'Lakhs to millions', d: `$${Y}$ lakh $= ${Y} \\div 10 = ${dec(Y, 1)}$ million` },
        { h: 'Total', d: `$${10 * X} + ${dec(Y, 1)} = ${dec(tenths, 1)}$ million rupees` }
      ]
    };
  }
  if (variant === 'million') {
    const M = ri(rng, 15, 999);
    return {
      prompt: `A film shot in ${city} earned ₹$${M}$ million at the box office. Write this amount in crores of rupees.`,
      ...numericAnswer(M, 1, 'crore'),
      traps: traps(M / 10, [
        { value: M * 10, why: 'A crore is bigger than a million, so there are fewer crores than millions — divide, do not multiply.' },
        { value: M / 100, why: 'One crore is ten million, not a hundred million.' }
      ]),
      hints: [
        'Which is bigger, a crore or a million? How many millions make one crore?',
        'Write one crore with international commas to see it.',
        'Divide the number of millions by that.'
      ],
      steps: [
        { h: 'Compare the units', d: '$1$ crore $= 1{,}00{,}00{,}000 = 10{,}000{,}000 = 10$ million' },
        { h: 'Divide', d: `$${M} \\div 10 = ${dec(M, 1)}$` },
        { h: 'Answer', d: `₹$${dec(M, 1)}$ crore` }
      ]
    };
  }
  const L = ri(rng, 12, 950);
  return {
    prompt: `A school in ${city} collected ₹$${L}$ lakh for flood relief. A report for an international charity gives the amount in millions of rupees. Write the amount in millions of rupees.`,
    ...numericAnswer(L, 1, 'million'),
    traps: traps(L / 10, [
      { value: L * 10, why: 'A million is bigger than a lakh, so there are fewer millions than lakhs — divide, do not multiply.' },
      { value: L / 100, why: 'One million is ten lakh, not a hundred lakh.' }
    ]),
    hints: [
      'How many lakhs make one million?',
      'Write one million with Indian commas to check.',
      'Divide the number of lakhs by that.'
    ],
    steps: [
      { h: 'Compare the units', d: '$1$ million $= 1{,}000{,}000 = 10{,}00{,}000 = 10$ lakh' },
      { h: 'Divide', d: `$${L} \\div 10 = ${dec(L, 1)}$` },
      { h: 'Answer', d: `₹$${dec(L, 1)}$ million` }
    ]
  };
}

const placeValueSystems = rng => (rng() < 0.55 ? placeValueRegroup(rng) : croreMillion(rng));

// dp 1 · Rounding, run backwards: what a rounded count says about the count.
const ROUND_UNITS = { 100: 'hundred', 1000: 'thousand', 10000: 'ten thousand', 100000: 'lakh' };
const ROUND_K = { 1000: [15, 95], 10000: [12, 95], 100000: [3, 60] };
const lowOf = (R, U) => R - U / 2;
const highOf = (R, U) => R + U / 2 - 1;

function roundedPair(rng) {
  const city = rc(rng, IN_CITIES);
  const scenes = [
    { units: [1000], text: (u, a, b) => `The number of spectators at an IPL match in ${city}, rounded to the nearest ${u}, was $${a}$. At the next match it was $${b}$, rounded the same way.`, noun: 'numbers of spectators' },
    { units: [10000, 100000], text: (u, a, b) => `The population of one town, rounded to the nearest ${u}, is $${a}$. The population of a second town, rounded the same way, is $${b}$.`, noun: 'populations' },
    { units: [1000, 10000], text: (u, a, b) => `In a municipal election in ${city}, the winning candidate's votes, rounded to the nearest ${u}, were $${a}$. The runner-up's votes, rounded the same way, were $${b}$.`, noun: 'numbers of votes' },
    { units: [10000, 100000], text: (u, a, b) => `A museum in ${city} had $${a}$ visitors in one year and $${b}$ the next year, both rounded to the nearest ${u}.`, noun: 'numbers of visitors' }
  ];
  const scene = rc(rng, scenes);
  const U = rc(rng, scene.units);
  const [kMin, kMax] = ROUND_K[U];
  const k1 = ri(rng, kMin + 2, kMax), k2 = ri(rng, kMin, k1 - 2);
  const R1 = k1 * U, R2 = k2 * U;
  const ask = rc(rng, ['max-diff', 'min-diff', 'max-sum', 'min-sum']);
  const lo1 = lowOf(R1, U), hi1 = highOf(R1, U), lo2 = lowOf(R2, U), hi2 = highOf(R2, U);
  const answer = { 'max-diff': hi1 - lo2, 'min-diff': lo1 - hi2, 'max-sum': hi1 + hi2, 'min-sum': lo1 + lo2 }[ask];
  const diff = ask.endsWith('diff');
  const greatest = ask.startsWith('max');
  const pickFirst = greatest === true ? (diff ? `the first as large as possible ($${texNum(hi1)}$) and the second as small as possible ($${texNum(lo2)}$)` : `both as large as possible ($${texNum(hi1)}$ and $${texNum(hi2)}$)`)
    : (diff ? `the first as small as possible ($${texNum(lo1)}$) and the second as large as possible ($${texNum(hi2)}$)` : `both as small as possible ($${texNum(lo1)}$ and $${texNum(lo2)}$)`);
  return {
    prompt: `${scene.text(ROUND_UNITS[U], texNum(R1), texNum(R2))} Every count is a whole number, and a count exactly halfway is rounded up. What is the ${greatest ? 'greatest' : 'smallest'} possible ${diff ? 'difference between' : 'total of'} the two actual ${scene.noun}?`,
    ...numericAnswer(answer),
    traps: traps(answer, [
      { value: diff ? R1 - R2 : R1 + R2, why: 'That uses the rounded counts themselves. The actual counts can be anywhere in a range around each rounded count.' },
      ...(ask === 'min-sum' ? [] : [{ value: { 'max-diff': R1 - R2 + U, 'min-diff': R1 - R2 - U, 'max-sum': R1 + R2 + U }[ask], why: `A count exactly halfway is rounded UP, so the largest count that rounds to a value is one less than halfway to the next ${ROUND_UNITS[U]}.` }])
    ]),
    hints: [
      `Which whole numbers round to $${texNum(R1)}$ when rounded to the nearest ${ROUND_UNITS[U]}? Find the smallest and the largest.`,
      'Do the same for the second rounded count.',
      diff ? 'A difference is greatest when the bigger number is as big as possible and the smaller one is as small as possible — and the other way round for the smallest difference.'
        : 'A total is greatest when both numbers are as big as possible, and smallest when both are as small as possible.'
    ],
    steps: [
      { h: 'First count', d: `From $${texNum(lo1)}$ to $${texNum(hi1)}$` },
      { h: 'Second count', d: `From $${texNum(lo2)}$ to $${texNum(hi2)}$` },
      { h: 'Choose the extremes', d: `Take ${pickFirst}.` },
      { h: 'Answer', d: `$${texNum(answer)}$` }
    ]
  };
}

// One number, rounded two ways, where the two ranges only just overlap.
function twoRoundings(rng) {
  const U = rc(rng, [10000, 100000]);
  const u = U === 100000 ? rc(rng, [10000, 1000]) : rc(rng, [1000, 100]);
  const k = U === 100000 ? ri(rng, 2, 60) : ri(rng, 12, 95);
  const R = k * U;
  const side = rc(rng, ['low', 'high']);
  // On the low side the smallest number is the second rounded value itself,
  // which asks nothing; there only the largest is asked.
  const ask = side === 'low' ? 'largest' : rc(rng, ['smallest', 'largest']);
  const t = side === 'low' ? R - U / 2 : R + U / 2;
  const range = side === 'low' ? [R - U / 2, t + u / 2 - 1] : [t - u / 2, R + U / 2 - 1];
  const answer = ask === 'smallest' ? range[0] : range[1];
  return {
    prompt: `A whole number, rounded to the nearest ${ROUND_UNITS[U]}, is $${texNum(R)}$. The same number, rounded to the nearest ${ROUND_UNITS[u]}, is $${texNum(t)}$. A number exactly halfway is rounded up. What is the ${ask} this number can be?`,
    ...numericAnswer(answer),
    traps: traps(answer, [
      { value: ask === 'smallest' ? t - u / 2 : t + u / 2 - 1, why: `That fits the rounding to the nearest ${ROUND_UNITS[u]}, but not the rounding to the nearest ${ROUND_UNITS[U]}.` },
      { value: ask === 'smallest' ? R - U / 2 : R + U / 2 - 1, why: `That fits the rounding to the nearest ${ROUND_UNITS[U]}, but not the rounding to the nearest ${ROUND_UNITS[u]}.` },
      { value: t, why: 'That is the rounded value itself, not the smallest or largest number that rounds to it.' }
    ]),
    hints: [
      `Write down the range of whole numbers that round to $${texNum(R)}$.`,
      `Write down the range of whole numbers that round to $${texNum(t)}$.`,
      'The number must lie in BOTH ranges — find where they overlap.'
    ],
    steps: [
      { h: `Nearest ${ROUND_UNITS[U]}`, d: `From $${texNum(R - U / 2)}$ to $${texNum(R + U / 2 - 1)}$` },
      { h: `Nearest ${ROUND_UNITS[u]}`, d: `From $${texNum(t - u / 2)}$ to $${texNum(t + u / 2 - 1)}$` },
      { h: 'Overlap', d: `From $${texNum(range[0])}$ to $${texNum(range[1])}$` },
      { h: 'Answer', d: `The ${ask} possible number is $${texNum(answer)}$.` }
    ]
  };
}

const roundingBounds = rng => (rng() < 0.5 ? roundedPair(rng) : twoRoundings(rng));

// dp 3 · Factor and regroup.
function twosAndFives(n) {
  let twos = 0, fives = 0, rest = n;
  while (rest % 2 === 0) { twos++; rest /= 2; }
  while (rest % 5 === 0) { fives++; rest /= 5; }
  return { twos, fives, rest };
}
function splitText(n) {
  const { twos, fives, rest } = twosAndFives(n);
  const factors = [...Array(twos).fill(2), ...Array(fives).fill(5), ...(rest > 1 ? [rest] : [])];
  return factors.length > 1 ? `$${n} = ${factors.join(' \\times ')}$` : `$${n}$`;
}
const ZERO_FACTORS = [4, 8, 12, 14, 15, 16, 18, 24, 25, 28, 32, 35, 36, 40, 45, 48, 50, 64, 75, 80, 120, 125, 250, 625];

function trailingZeros(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const fs = pick(rng, ZERO_FACTORS, 4);
    const tw = fs.reduce((s, f) => s + twosAndFives(f).twos, 0);
    const fv = fs.reduce((s, f) => s + twosAndFives(f).fives, 0);
    const z = Math.min(tw, fv);
    if (z < 3 || tw === fv) continue;
    const shown = fs.reduce((s, f) => s + (String(f).match(/0+$/)?.[0].length || 0), 0);
    return {
      prompt: `Without multiplying it out in full, find how many zeros there are at the end of the product $${fs.join(' \\times ')}$.`,
      ...numericAnswer(z),
      traps: traps(z, [
        { value: Math.max(tw, fv), why: `Every zero at the end needs a 2 AND a 5. There are ${tw} twos and ${fv} fives, so the smaller count decides.` },
        { value: shown, why: 'Counting the zeros already written in the numbers misses the 10s made by pairing a 2 from one number with a 5 from another.' },
        { value: tw + fv, why: 'Each zero at the end uses up one 2 and one 5 together — they are not counted separately.' }
      ]),
      hints: [
        'Each zero at the end of a number comes from a factor of 10, and $10 = 2 \\times 5$.',
        'Break every number into 2s, 5s and whatever is left over.',
        'Pair each 2 with a 5. How many complete pairs can you make?'
      ],
      steps: [
        { h: 'Split into factors', d: fs.map(splitText).join(', ') },
        { h: 'Count', d: `${tw} twos and ${fv} fives` },
        { h: 'Pair them', d: `Only $${z}$ pairs $2 \\times 5 = 10$ can be made, so the product ends in $${z}$ zeros.` }
      ]
    };
  }
  return trailingZeros(makeRng(FALLBACK_SEED));
}

const ROUND_PAIRS = [[25, 36], [25, 48], [125, 24], [125, 48], [125, 56], [625, 16], [625, 32], [250, 36], [75, 12], [25, 28], [125, 72], [25, 44], [125, 32], [250, 28]];
function missingFactor(rng) {
  const [a, b] = rc(rng, ROUND_PAIRS);
  let k = ri(rng, 3, 60);
  while (k % 10 === 0 || k === a || k === b) k += 1;
  const P = a * b * k;
  const order = rc(rng, [[a, '\\square', b], [a, b, '\\square'], ['\\square', a, b]]);
  return {
    prompt: `Find the whole number that goes in the box: $${order.join(' \\times ')} = ${texNum(P)}$. Regroup the factors you know before you divide.`,
    ...numericAnswer(k),
    traps: traps(k, [
      { value: P / a, why: `That divides by ${a} only — the box also has ${b} multiplying it.` },
      { value: k * 10, why: 'Check the place value: count the zeros in the product and in what you divided by.' }
    ]),
    hints: [
      `Multiply the two numbers you know first, splitting them so that a 2 meets a 5: ${a} and ${b}.`,
      'Their product should be a round number that is easy to divide by.',
      'Divide the product on the right by it.'
    ],
    steps: [
      { h: 'Regroup the known factors', d: `${splitText(a)} and ${splitText(b)}, so $${a} \\times ${b} = ${texNum(a * b)}$` },
      { h: 'Divide', d: `$${texNum(P)} \\div ${texNum(a * b)} = ${k}$` },
      { h: 'Check', d: `$${a} \\times ${b} \\times ${k} = ${texNum(P)}$` }
    ]
  };
}

const factorRegroup = rng => (rng() < 0.6 ? trailingZeros(rng) : missingFactor(rng));

// ══ 2 · Arithmetic Expressions ══════════════════════════════════════════════

const sumTex = (terms, signs) => terms.map((t, i) => (i === 0 ? String(t) : `${signs[i] > 0 ? '+' : '-'} ${t}`)).join(' ');

// dp 0 · Compare two expressions term by term without evaluating them.
function termwiseComparison(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const signs = rc(rng, [[1, 1, -1], [1, -1, 1], [1, 1, -1, -1], [1, -1, 1, -1], [1, -1, -1]]);
    const a = signs.map((_, i) => (i === 0 ? ri(rng, 2000, 9800) : ri(rng, 105, 990)));
    const e = signs.map(() => { let v = 0; while (v === 0) v = ri(rng, -9, 9); return v; });
    const b = a.map((x, i) => x + e[i]);
    const P = a.reduce((s, x, i) => s + signs[i] * x, 0), Q = b.reduce((s, x, i) => s + signs[i] * x, 0);
    const answer = P - Q;
    if (answer === 0 || P <= 0 || Q <= 0) continue;
    const naive = -e.reduce((s, x) => s + x, 0);
    return {
      prompt: `Let $P = ${sumTex(a, signs)}$ and $Q = ${sumTex(b, signs)}$. Without working out $P$ or $Q$ in full, compare them term by term and find the value of $P - Q$. (If $P$ is smaller than $Q$, the answer is negative.)`,
      ...numericAnswer(answer),
      traps: traps(answer, [
        { value: naive, why: 'A term that is SUBTRACTED works the other way: if it is bigger in $Q$, then $Q$ is smaller, not bigger.' },
        { value: -answer, why: 'That is $Q - P$. Check which expression is the bigger one.' }
      ]),
      hints: [
        'Pair each term of $P$ with the term in the same position in $Q$ and find how much they differ.',
        'A term that is added makes the total bigger when it grows; a term that is subtracted makes the total smaller when it grows.',
        'Combine the effects of all the terms.'
      ],
      steps: [
        ...a.map((x, i) => ({ h: `Term ${i + 1}`, d: `$${x}$ in $P$ and $${b[i]}$ in $Q$: ${signs[i] > 0 ? 'added' : 'subtracted'}, so it changes $P - Q$ by $${-signs[i] * e[i]}$` })).slice(0, 4),
        { h: 'Combine', d: `$P - Q = ${a.map((_, i) => paren(-signs[i] * e[i])).join(' + ')} = ${answer}$` }
      ]
    };
  }
  return termwiseComparison(makeRng(FALLBACK_SEED));
}
const paren = n => (n < 0 ? `(${n})` : String(n));

function compensationBox(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const a = ri(rng, 1200, 9800), b = ri(rng, 120, 980), c = ri(rng, 105, 990);
    const d1 = ri(rng, -9, 9), d2 = ri(rng, -9, 9);
    if (d1 === 0 || d2 === 0 || a + b <= c) continue;
    const box = b - d1 + d2;
    return {
      prompt: `Find the number that goes in the box so that both sides are equal: $${a} + ${b} - ${c} = ${a + d1} + \\square - ${c + d2}$. Try to do it without working out either side in full.`,
      ...numericAnswer(box),
      traps: traps(box, [
        { value: b + d1 - d2, why: `The first term went ${d1 > 0 ? 'up' : 'down'} by ${Math.abs(d1)}, so the box must make up for it the OTHER way.` },
        { value: b - d1 - d2, why: 'A bigger number being SUBTRACTED makes the right side smaller, so the box has to grow to make up for it.' }
      ]),
      hints: [
        'Compare the first terms on the two sides. Which side is ahead, and by how much?',
        'Compare the subtracted terms. A bigger number taken away leaves less.',
        'The box must make up for both differences so that the totals match.'
      ],
      steps: [
        { h: 'First terms', d: `$${a + d1}$ is $${Math.abs(d1)}$ ${d1 > 0 ? 'more' : 'less'} than $${a}$` },
        { h: 'Subtracted terms', d: `$${c + d2}$ is $${Math.abs(d2)}$ ${d2 > 0 ? 'more' : 'less'} than $${c}$, which ${d2 > 0 ? 'lowers' : 'raises'} the right side by $${Math.abs(d2)}$` },
        { h: 'Balance', d: `$\\square = ${b} ${d1 > 0 ? '-' : '+'} ${Math.abs(d1)} ${d2 > 0 ? '+' : '-'} ${Math.abs(d2)} = ${box}$` }
      ]
    };
  }
  return compensationBox(makeRng(FALLBACK_SEED));
}

const expressionComparison = rng => (rng() < 0.55 ? termwiseComparison(rng) : compensationBox(rng));

// dp 1 · Terms and brackets: where one pair of brackets does the most.
const OP_TEX = { '+': '+', '-': '-', '*': '\\times' };
function evalFlat(nums, ops) {
  // multiplication first, then left to right
  const ns = [nums[0]], os = [];
  ops.forEach((op, i) => {
    if (op === '*') ns[ns.length - 1] *= nums[i + 1];
    else { os.push(op); ns.push(nums[i + 1]); }
  });
  return os.reduce((v, op, i) => (op === '+' ? v + ns[i + 1] : v - ns[i + 1]), ns[0]);
}
const flatTex = (nums, ops) => nums.map((n, i) => (i === 0 ? String(n) : `${OP_TEX[ops[i - 1]]} ${n}`)).join(' ');
function placements(nums, ops) {
  const out = [];
  for (let i = 0; i < nums.length; i++) {
    for (let j = i + 1; j < nums.length; j++) {
      if (i === 0 && j === nums.length - 1) continue;
      const inner = evalFlat(nums.slice(i, j + 1), ops.slice(i, j));
      const value = evalFlat([...nums.slice(0, i), inner, ...nums.slice(j + 1)], [...ops.slice(0, i), ...ops.slice(j)]);
      const tex = nums.map((n, t) => `${t === 0 ? '' : `${OP_TEX[ops[t - 1]]} `}${t === i ? '(' : ''}${n}${t === j ? ')' : ''}`).join(' ');
      out.push({ i, j, value, tex });
    }
  }
  return out;
}

function bracketPlacement(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const nums = [ri(rng, 2, 12), ri(rng, 2, 12), ri(rng, 2, 12), ri(rng, 2, 12)];
    const ops = [rc(rng, ['+', '-', '*']), rc(rng, ['+', '-', '*']), rc(rng, ['+', '-', '*'])];
    if (!ops.includes('*') || !ops.some(o => o !== '*')) continue;
    const plain = evalFlat(nums, ops);
    const all = placements(nums, ops);
    const ask = rc(rng, ['largest', 'smallest']);
    const best = ask === 'largest' ? Math.max(...all.map(p => p.value)) : Math.min(...all.map(p => p.value));
    if (best === plain) continue;
    const winner = all.find(p => p.value === best);
    const other = ask === 'largest' ? Math.min(...all.map(p => p.value)) : Math.max(...all.map(p => p.value));
    return {
      prompt: `Put exactly one pair of brackets into $${flatTex(nums, ops)}$, so that the brackets enclose two or more of the numbers. What is the ${ask} value the expression can then have?`,
      ...numericAnswer(best),
      traps: traps(best, [
        { value: plain, why: 'That is the value with no brackets at all. A pair of brackets in the right place changes it.' },
        { value: other, why: `That is the ${ask === 'largest' ? 'smallest' : 'largest'} value, not the ${ask}.` }
      ]),
      hints: [
        'List every place the brackets can go: around the first two numbers, the middle two, the last two, the first three or the last three.',
        'Work out the bracket first; outside it, multiplication still comes before addition and subtraction.',
        `Compare all the values and choose the ${ask}.`
      ],
      steps: [
        { h: 'Every placement', d: all.map(p => `$${p.tex} = ${p.value}$`).join('; ') },
        { h: 'Without brackets', d: `$${flatTex(nums, ops)} = ${plain}$` },
        { h: 'Answer', d: `The ${ask} value is $${best}$, from $${winner.tex}$.` }
      ]
    };
  }
  return bracketPlacement(makeRng(FALLBACK_SEED));
}

// dp 3 · Commutative, associative and distributive properties.
function knownProduct(rng) {
  const a = ri(rng, 121, 489), b = ri(rng, 23, 89), p = ri(rng, 1, 3), q = ri(rng, 1, 3);
  const variant = rng() < 0.5 ? 1 : 2;
  const tex = variant === 1 ? `${a + p} \\times ${b} - ${a} \\times ${b - q}` : `${a} \\times ${b + q} - ${a - p} \\times ${b}`;
  const answer = p * b + a * q;
  const split = variant === 1
    ? [`$${a + p} \\times ${b} = ${a} \\times ${b} + ${p} \\times ${b}$`, `$${a} \\times ${b - q} = ${a} \\times ${b} - ${a} \\times ${q}$`]
    : [`$${a} \\times ${b + q} = ${a} \\times ${b} + ${a} \\times ${q}$`, `$${a - p} \\times ${b} = ${a} \\times ${b} - ${p} \\times ${b}$`];
  return {
    prompt: `You are told that $${a} \\times ${b} = ${texNum(a * b)}$. Use this fact and the distributive property — without multiplying again — to find $${tex}$.`,
    ...numericAnswer(answer),
    traps: traps(answer, [
      { value: Math.abs(p * b - a * q), why: 'Subtracting a product that is itself SMALLER than the known one adds the difference back on.' },
      { value: a * b, why: 'That is the given product, not the expression asked for.' }
    ]),
    hints: [
      'Write each product as the known product plus or minus a small extra product.',
      `For example, $(${a} + 1) \\times ${b} = ${a} \\times ${b} + ${b}$.`,
      'When you subtract, the known product cancels — only the small extra products are left.'
    ],
    steps: [
      { h: 'First product', d: split[0] },
      { h: 'Second product', d: split[1] },
      { h: 'Subtract', d: `The $${a} \\times ${b}$ parts cancel: $${p} \\times ${b} + ${a} \\times ${q} = ${p * b} + ${a * q} = ${answer}$` }
    ]
  };
}

function commonFactor(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const target = rc(rng, [100, 100, 1000]);
    const k = ri(rng, 13, 97);
    const u = target === 100 ? ri(rng, 21, 89) : ri(rng, 210, 890);
    const v = target === 100 ? ri(rng, 21, 89) : ri(rng, 210, 890);
    const w = u + v - target;
    if (w <= 0 || w >= Math.min(u, v) || u === v || k % 10 === 0) continue;
    const term = n => (rng() < 0.5 ? `${k} \\times ${n}` : `${n} \\times ${k}`);
    const answer = k * target;
    return {
      prompt: `Use the properties of multiplication to find $${term(u)} + ${term(v)} - ${term(w)}$ without doing three separate multiplications.`,
      ...numericAnswer(answer),
      traps: traps(answer, [
        { value: k * (u + v + w), why: `The last product is SUBTRACTED, so ${w} is taken away from the bracket, not added.` },
        { value: u + v - w, why: `That is only the bracket; it still has to be multiplied by ${k}.` }
      ]),
      hints: [
        'Which number appears in every product?',
        'Swapping the order of a product does not change it, so write every product with that number first.',
        'Take the common number outside a bracket (the distributive property) and work out the bracket.'
      ],
      steps: [
        { h: 'Reorder', d: `$${k} \\times ${u} + ${k} \\times ${v} - ${k} \\times ${w}$` },
        { h: 'Take out the common factor', d: `$${k} \\times (${u} + ${v} - ${w}) = ${k} \\times ${target}$` },
        { h: 'Answer', d: `$${texNum(answer)}$` }
      ]
    };
  }
  return commonFactor(makeRng(FALLBACK_SEED));
}

const propertyRewrite = rng => (rng() < 0.5 ? knownProduct(rng) : commonFactor(rng));

// ══ 3 · A Peek Beyond the Point ═════════════════════════════════════════════

// dp 0 · Tenths, hundredths and thousandths, regrouped.
function placeRegroupDecimal(rng) {
  const o = ri(rng, 1, 9), t = ri(rng, 10, 39), h = ri(rng, 10, 49), th = ri(rng, 3, 95);
  const units = 1000 * o + 100 * t + 10 * h + th;            // thousandths
  const digitsOnly = 1000 * o + 100 * (t % 10) + 10 * (h % 10) + (th % 10);
  return {
    prompt: `Write as a single decimal number: $${o}$ ones, $${t}$ tenths, $${h}$ hundredths and $${th}$ thousandths.`,
    ...numericAnswer(units, 3),
    traps: traps(units / 1000, [
      { value: digitsOnly / 1000, why: 'Ten tenths make one whole and ten hundredths make one tenth — a count of 10 or more has to be regrouped, not cut down to one digit.' }
    ]),
    hints: [
      'Write each part as a decimal on its own: for example, 17 hundredths is 0.17.',
      'Line the parts up by their decimal points.',
      'Add them.'
    ],
    steps: [
      { h: 'Each part', d: `$${o}$, $${dec(100 * t, 3)}$, $${dec(10 * h, 3)}$, $${dec(th, 3)}$` },
      { h: 'Regroup', d: `$${t}$ tenths $= ${dec(100 * t, 3)}$ and $${h}$ hundredths $= ${dec(10 * h, 3)}$ — each count of ten or more spills into the place on its left.` },
      { h: 'Add', d: `$${o} + ${dec(100 * t, 3)} + ${dec(10 * h, 3)} + ${dec(th, 3)} = ${dec(units, 3)}$` }
    ]
  };
}

const PLACE_UNIT = { tenths: 100, hundredths: 10, thousandths: 1 };
function decimalGap(rng) {
  const unit = rc(rng, ['tenths', 'hundredths', 'hundredths', 'thousandths']);
  const x = ri(rng, 1005, 8995);
  const n = unit === 'tenths' ? ri(rng, 12, 45) : unit === 'hundredths' ? ri(rng, 12, 95) : ri(rng, 15, 480);
  const y = x + n * PLACE_UNIT[unit];
  const gap = n * PLACE_UNIT[unit];
  return {
    prompt: `How many ${unit} must be added to $${dec(x, 3)}$ to make $${dec(y, 3)}$?`,
    ...numericAnswer(n),
    traps: traps(n, [
      { value: gap, why: 'That counts thousandths. Check which place the question counts in.' },
      { value: Number(dec(gap, 3)), why: `That is the difference itself. The question asks how many ${unit} make up that difference.` }
    ]),
    hints: [
      'Find the difference between the two numbers.',
      `How many ${unit} are there in one whole? In one tenth?`,
      `Count how many ${unit} make up the difference.`
    ],
    steps: [
      { h: 'Difference', d: `$${dec(y, 3)} - ${dec(x, 3)} = ${dec(gap, 3)}$` },
      { h: 'One unit', d: `One ${unit.slice(0, -1)} is $${dec(PLACE_UNIT[unit], 3)}$.` },
      { h: `Count the ${unit}`, d: `$${dec(gap, 3)} = ${n}$ ${unit}` }
    ]
  };
}

const decimalPlaceValue = rng => (rng() < 0.55 ? placeRegroupDecimal(rng) : decimalGap(rng));

// dp 1 · Order and position by magnitude.
const thousandthsOf = s => { const [w, f = ''] = s.split('.'); return Number(w) * 1000 + Number((f + '000').slice(0, 3)); };

function decimalOrdering(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const w = ri(rng, 1, 9), p = ri(rng, 1, 9), q = ri(rng, 1, 9);
    if (p === q) continue;
    const pool = [`${w}.${p}`, `${w}.0${p}`, `${w}.${p}${q}`, `${w}.${p}0${q}`, `${w}.0${p}${q}`, `${w}.${q}`, `${w}.${q}${p}`, `${w}.00${p}`, `${w}.${q}0${p}`];
    const chosen = pick(rng, pool, 5);
    if (new Set(chosen.map(thousandthsOf)).size !== 5) continue;
    const up = rng() < 0.5;
    const k = ri(rng, 2, 4);
    const sorted = [...chosen].sort((a, b) => (up ? thousandthsOf(a) - thousandthsOf(b) : thousandthsOf(b) - thousandthsOf(a)));
    const answer = sorted[k - 1];
    // The misconception: compare the digits after the point as whole numbers.
    const wrongKey = s => Number(s.split('.')[1]);
    const wrong = [...chosen].sort((a, b) => (up ? wrongKey(a) - wrongKey(b) : wrongKey(b) - wrongKey(a)))[k - 1];
    return {
      prompt: `Arrange these numbers from ${up ? 'smallest to largest' : 'largest to smallest'}: ${chosen.map(s => `$${s}$`).join(', ')}. Which number is ${ordinal(k)} in your list?`,
      ...numericAnswer(thousandthsOf(answer), 3),
      traps: traps(thousandthsOf(answer) / 1000, [
        { value: thousandthsOf(wrong) / 1000, why: 'A decimal with more digits after the point is not automatically bigger. Compare tenths first, then hundredths, then thousandths.' }
      ]),
      hints: [
        'All the numbers have the same whole-number part, so compare the tenths digits first.',
        'Where the tenths are the same, compare the hundredths, and then the thousandths. Writing every number with three decimal places can help.',
        `Then count along to the ${ordinal(k)} place.`
      ],
      steps: [
        { h: 'Write to three places', d: chosen.map(s => `$${s} = ${(thousandthsOf(s) / 1000).toFixed(3)}$`).join(', ') },
        { h: 'Order', d: sorted.map(s => `$${s}$`).join(up ? ' < ' : ' > ') },
        { h: 'Answer', d: `The ${ordinal(k)} number is $${answer}$.` }
      ]
    };
  }
  return decimalOrdering(makeRng(FALLBACK_SEED));
}

function numberLineMarks(rng) {
  const n = rc(rng, [4, 5, 8, 10]);
  const step = rc(rng, n === 8 ? [5, 15, 25, 35, 45] : n === 4 ? [5, 15, 25, 35, 45, 55, 65] : [2, 3, 4, 6, 7, 8, 9, 12, 15]);
  const A = 10 * ri(rng, 105, 895);                    // thousandths, two decimal places
  const B = A + n * step;
  const k = ri(rng, 1, n - 1);
  const answer = A + k * step;
  return {
    prompt: `On a number line, the points $${dec(A, 3)}$ and $${dec(B, 3)}$ are marked. The gap between them is divided into $${n}$ equal parts by $${n - 1}$ marks. What number is at the ${ordinal(k)} mark from $${dec(A, 3)}$?`,
    ...numericAnswer(answer, 3),
    traps: traps(answer / 1000, [
      { value: (A + k * step * 10) / 1000, why: 'Check the size of one part: the gap divided by the number of equal parts.' },
      { value: (B - k * step) / 1000, why: `That is the ${ordinal(k)} mark counted from the other end.` }
    ]),
    hints: [
      'Find the length of the gap between the two points.',
      `Divide it into $${n}$ equal parts to find the size of one part.`,
      'Start at the first point and move that many parts.'
    ],
    steps: [
      { h: 'Gap', d: `$${dec(B, 3)} - ${dec(A, 3)} = ${dec(n * step, 3)}$` },
      { h: 'One part', d: `$${dec(n * step, 3)} \\div ${n} = ${dec(step, 3)}$` },
      { h: 'Count along', d: `$${dec(A, 3)} + ${k} \\times ${dec(step, 3)} = ${dec(answer, 3)}$` }
    ]
  };
}

const decimalOrderingForm = rng => (rng() < 0.55 ? decimalOrdering(rng) : numberLineMarks(rng));

// ══ 4 · Expressions using Letter-Numbers ════════════════════════════════════

const PATTERN_SCENES = [
  { thing: 'matchsticks', scene: 'A matchstick pattern is built step by step.' },
  { thing: 'tiles', scene: 'A border of square tiles is laid around a rangoli, one step at a time.' },
  { thing: 'diyas', scene: 'Diyas are arranged for Diwali in a pattern that grows step by step.' },
  { thing: 'chairs', scene: 'Tables are joined in a row for a school function, with chairs around them.' },
  { thing: 'beads', scene: 'A bead pattern for a rakhi grows step by step.' }
];

// dp 0 · A general rule written with a letter-number, then used.
function growingPattern(rng) {
  const { thing, scene } = rc(rng, PATTERN_SCENES);
  const a = ri(rng, 3, 12), d = ri(rng, 2, 7);
  const N = ri(rng, 15, 80);
  const T = a + d * (N - 1);
  const ask = rng() < 0.6 ? 'count' : 'step';
  const head = `${scene} Step 1 uses $${a}$ ${thing}, step 2 uses $${a + d}$ and step 3 uses $${a + 2 * d}$; every step adds the same number of ${thing} as the one before.`;
  const rule = `$${d}n${plusConst(a - d)}$`;
  if (ask === 'count') {
    return {
      prompt: `${head} Write an expression for the number of ${thing} in step $n$, and use it to find how many ${thing} step $${N}$ uses.`,
      ...numericAnswer(T),
      traps: traps(T, [
        { value: d * N, why: `${d}n gives the right growth but the wrong start: check your rule against step 1.` },
        { value: a + d * N, why: `Step 1 already has ${a} ${thing}; from step 1 to step ${N} only ${N - 1} more steps are added.` }
      ]),
      hints: [
        `How many ${thing} are added at each step?`,
        `Write the number of ${thing} in step $n$ as an expression in $n$, and check it gives the right count for steps 1, 2 and 3.`,
        `Put $n = ${N}$ into your expression.`
      ],
      steps: [
        { h: 'Growth', d: `Each step adds $${d}$ ${thing}.` },
        { h: 'Rule', d: `Step $n$ uses ${rule} ${thing} (check: step 1 gives $${a}$).` },
        { h: 'Use it', d: `$${d} \\times ${N}${plusConst(a - d)} = ${T}$` }
      ]
    };
  }
  return {
    prompt: `${head} Write an expression for the number of ${thing} in step $n$, and use it to find which step uses exactly $${T}$ ${thing}.`,
    ...numericAnswer(N),
    traps: traps(N, [
      { value: N + 1, why: 'Check your rule against step 1: the count for step 1 is not just the amount added each step.' },
      { value: Math.round(T / d), why: `Dividing by ${d} alone ignores the ${thing} the pattern starts with.` }
    ]),
    hints: [
      `How many ${thing} are added at each step?`,
      `Write the number of ${thing} in step $n$ as an expression in $n$.`,
      `Set the expression equal to $${T}$ and find $n$.`
    ],
    steps: [
      { h: 'Rule', d: `Step $n$ uses ${rule} ${thing}.` },
      { h: 'Equation', d: `$${d}n${plusConst(a - d)} = ${T}$, so $${d}n = ${T - a + d}$` },
      { h: 'Answer', d: `$n = ${N}$` }
    ]
  };
}

const BLOCK = { 3: [0, 1, 2, 7, 8, 9, 14, 15, 16], 2: [0, 1, 7, 8] };
function calendarBlock(rng) {
  const size = rc(rng, [2, 3, 3]);
  const cells = BLOCK[size];
  const t = ri(rng, 1, size === 3 ? 14 : 22);
  const S = cells.reduce((s, c) => s + t + c, 0);
  const ask = size === 3 ? rc(rng, ['top-left', 'centre', 'largest']) : rc(rng, ['top-left', 'largest']);
  const answer = t + { 'top-left': 0, centre: 8, largest: cells[cells.length - 1] }[ask];
  const askText = { 'top-left': 'the date in the top-left corner of the square', centre: 'the date in the centre of the square', largest: 'the largest date in the square' }[ask];
  const sumCoeff = cells.reduce((s, c) => s + c, 0);
  return {
    prompt: `On a monthly calendar, a ${size} × ${size} square of dates is outlined: ${size} dates next to each other in a row, from ${size} weeks one below the other. The ${size * size} dates in the square add up to $${S}$. What is ${askText}?`,
    ...numericAnswer(answer),
    traps: traps(answer, [
      { value: Math.round(S / (size * size)), why: 'That is the average of the dates. Check which date the question asks for.' },
      { value: t + (ask === 'top-left' ? 1 : 0), why: 'Dates one below the other on a calendar are 7 apart, not 1 apart.' }
    ]),
    hints: [
      'Call the date in the top-left corner $n$. A date one place to the right is $n + 1$; a date one row down is $n + 7$.',
      'Write all the dates in the square in terms of $n$ and add them.',
      `Set the total equal to $${S}$, find $n$, and then the date asked for.`
    ],
    steps: [
      { h: 'Dates in terms of n', d: cells.map(c => (c === 0 ? '$n$' : `$n + ${c}$`)).join(', ') },
      { h: 'Total', d: `$${size * size}n + ${sumCoeff} = ${S}$, so $n = ${t}$` },
      { h: 'Answer', d: `${askText[0].toUpperCase()}${askText.slice(1)} is $${answer}$.` }
    ]
  };
}

const letterPattern = rng => (rng() < 0.55 ? growingPattern(rng) : calendarBlock(rng));

// dp 1 · Ordinary language ↔ expressions.
function numberTrick(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const kind = rc(rng, [1, 2, 3, 4]);
    let p = 1, q = 0;
    const steps = [];
    const lines = [];
    const apply = (sentence, fn) => { [p, q] = fn(p, q); steps.push(sentence); lines.push(`$${p === 0 ? q : linearTex(p, q)}$`); };
    if (kind === 1) {
      const a = ri(rng, 2, 6), b = ri(rng, 3, 15), c = ri(rng, 2, 5);
      apply(`Multiply it by $${a}$.`, (P, Q) => [P * a, Q * a]);
      apply(`Add $${b}$.`, (P, Q) => [P, Q + b]);
      apply(`Multiply the result by $${c}$.`, (P, Q) => [P * c, Q * c]);
      apply(`Subtract $${a * c}$ times the number you first thought of.`, (P, Q) => [P - a * c, Q]);
      const ds = [2, 3, 4, 5, 6].filter(dv => q % dv === 0 && q / dv > 1);
      if (ds.length && rng() < 0.7) { const dv = rc(rng, ds); apply(`Divide the result by $${dv}$.`, (P, Q) => [P / dv, Q / dv]); }
    } else if (kind === 2) {
      const a = ri(rng, 2, 7), b = ri(rng, 3, 12), e = ri(rng, 2, 20);
      apply(`Add $${b}$.`, (P, Q) => [P, Q + b]);
      apply(`Multiply the result by $${a}$.`, (P, Q) => [P * a, Q * a]);
      apply(`Subtract $${a}$ times the number you first thought of.`, (P, Q) => [P - a, Q]);
      apply(`Add $${e}$.`, (P, Q) => [P, Q + e]);
    } else if (kind === 3) {
      const a = ri(rng, 2, 6), m = ri(rng, 2, 9), s = ri(rng, 1, a * m - 1);
      apply(`Multiply it by $${a}$.`, (P, Q) => [P * a, Q * a]);
      apply(`Add $${a * m}$.`, (P, Q) => [P, Q + a * m]);
      apply(`Divide the result by $${a}$.`, (P, Q) => [P / a, Q / a]);
      apply('Subtract the number you first thought of.', (P, Q) => [P - 1, Q]);
      if (s < m && rng() < 0.5) apply(`Subtract $${s}$.`, (P, Q) => [P, Q - s]);
    } else {
      const b = ri(rng, 3, 14), a = ri(rng, 2, 5), c = a * ri(rng, 1, 3);
      apply(`Add $${b}$.`, (P, Q) => [P, Q + b]);
      apply(`Multiply the result by $${a}$.`, (P, Q) => [P * a, Q * a]);
      apply(`Subtract $${c}$.`, (P, Q) => [P, Q - c]);
      apply(`Divide the result by $${a}$.`, (P, Q) => [P / a, Q / a]);
      apply('Subtract the number you first thought of.', (P, Q) => [P - 1, Q]);
    }
    if (p !== 0 || !Number.isInteger(q) || q <= 0) continue;
    const name = rc(rng, IN_NAMES);
    return {
      prompt: `${name} says: “Think of any number. ${steps.join(' ')} Everyone ends up with the same number!” Let the number you first thought of be $x$, write each step as an expression in $x$, and find the number everyone ends up with.`,
      ...numericAnswer(q),
      traps: traps(q, []),
      hints: [
        'Start with $x$ and write what each instruction does to the expression.',
        'Remember that multiplying or dividing acts on EVERY term of the expression so far.',
        'At the end the $x$ terms cancel — what number is left?'
      ],
      steps: [
        { h: 'Start', d: '$x$' },
        ...lines.map((l, i) => ({ h: `Step ${i + 1}`, d: `${steps[i]} → ${l}` }))
      ]
    };
  }
  return numberTrick(makeRng(FALLBACK_SEED));
}

function relationChain(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const [A, B, C] = pick(rng, IN_NAMES, 3);
    const m1 = ri(rng, 2, 4), k1 = ri(rng, -15, 25), m2 = ri(rng, 2, 3), k2 = ri(rng, -20, 30);
    if (k1 === 0 || k2 === 0) continue;
    const x0 = ri(rng, 12, 60);
    const b = m1 * x0 + k1, c = m2 * b + k2;
    if (b <= 0 || c <= 0) continue;
    const phrase = (k, m, who) => `₹$${Math.abs(k)}$ ${k > 0 ? 'more' : 'less'} than ${times(m)} what ${who} has`;
    const bExpr = linearTex(m1, k1), cExpr = linearTex(m2 * m1, m2 * k1 + k2);
    return {
      prompt: `${A} has ₹$x$. ${B} has ${phrase(k1, m1, A)}. ${C} has ${phrase(k2, m2, B)}. Write an expression in $x$ for the amount ${C} has. Then find how much ${C} has when ${A} has ₹$${x0}$.`,
      ...numericAnswer(c),
      answerPrefix: '₹',
      traps: traps(c, [
        { value: b, why: `That is how much ${B} has. ${C}'s amount is built from ${B}'s.` },
        { value: m2 * m1 * x0 + k1 + k2, why: `“${times(m2)} what ${B} has” multiplies ALL of ${B}'s amount, including the ₹$${Math.abs(k1)}$ — use brackets.` }
      ]),
      hints: [
        `Write ${B}'s amount as an expression in $x$ first.`,
        `${C}'s amount is ${times(m2)} ${B}'s whole amount — put ${B}'s expression in brackets before multiplying.`,
        `Simplify, then put in $x = ${x0}$.`
      ],
      steps: [
        { h: `${B}'s amount`, d: `$${bExpr}$` },
        { h: `${C}'s amount`, d: `$${m2}(${bExpr})${plusConst(k2)} = ${cExpr}$` },
        { h: `When x = ${x0}`, d: `$${m2 * m1} \\times ${x0}${plusConst(m2 * k1 + k2)} = ${c}$, so ${C} has ₹$${c}$.` }
      ]
    };
  }
  return relationChain(makeRng(FALLBACK_SEED));
}

const expressionTranslation = rng => (rng() < 0.5 ? numberTrick(rng) : relationChain(rng));

// dp 3 · A formula evaluated, or used backwards against a budget.
const lin2 = (m, n) => `${m === 1 ? '' : m}a ${n < 0 ? '-' : '+'} ${Math.abs(n) === 1 ? '' : Math.abs(n)}b`;
function bracketFormula(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const k1 = ri(rng, 2, 5), k2 = ri(rng, 2, 5), m1 = ri(rng, 1, 4), m2 = ri(rng, 1, 4);
    const n1 = rc(rng, [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5]), n2 = rc(rng, [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5]);
    const c = ri(rng, -9, 9);
    const a = rc(rng, [-9, -8, -7, -6, -5, -4, -3, -2, 2, 3, 4, 5, 6, 7, 8, 9]), b = rc(rng, [-9, -8, -7, -6, -5, -4, -3, -2, 2, 3, 4, 5, 6, 7, 8, 9]);
    if (a > 0 && b > 0) continue;
    const ca = k1 * m1 - k2 * m2, cb = k1 * n1 - k2 * n2;
    if (ca === 0 || cb === 0) continue;
    const value = ca * a + cb * b + c;
    const slip = k1 * (m1 * a + n1 * b) - k2 * m2 * a + k2 * n2 * b + c;
    const E = `${k1}(${lin2(m1, n1)}) - ${k2}(${lin2(m2, n2)})${plusConst(c)}`;
    return {
      prompt: `Find the value of $${E}$ when $a = ${a}$ and $b = ${b}$.`,
      ...numericAnswer(value),
      traps: traps(value, [
        { value: slip, why: `The minus sign in front of the second bracket changes the sign of EVERY term inside it.` },
        { value: ca * a + cb * b - c, why: 'Check the sign of the number at the end.' }
      ]),
      hints: [
        'You can simplify first: open the brackets, remembering the minus sign in front of the second one.',
        'Collect the $a$ terms and the $b$ terms.',
        'Then put in the values, taking care with the negative numbers.'
      ],
      steps: [
        { h: 'Open the brackets', d: `$${k1 * m1}a ${k1 * n1 < 0 ? '-' : '+'} ${Math.abs(k1 * n1)}b - ${k2 * m2}a ${-k2 * n2 < 0 ? '-' : '+'} ${Math.abs(k2 * n2)}b${plusConst(c)}$` },
        { h: 'Collect', d: `$${ca}a ${cb < 0 ? '-' : '+'} ${Math.abs(cb)}b${plusConst(c)}$` },
        { h: 'Substitute', d: `$${ca} \\times ${paren(a)} ${cb < 0 ? '-' : '+'} ${Math.abs(cb)} \\times ${paren(b)}${plusConst(c)} = ${value}$` }
      ]
    };
  }
  return bracketFormula(makeRng(FALLBACK_SEED));
}

function budgetFormula(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const kind = rc(rng, ['magazine', 'auto']);
    if (kind === 'magazine') {
      const F = 100 * ri(rng, 12, 45), r = ri(rng, 12, 35), B = 500 * ri(rng, 10, 40);
      if (B <= F + r) continue;
      const n = Math.floor((B - F) / r);
      if ((B - F) % r === 0 || [F, r, B].includes(n)) continue;
      return {
        prompt: `The cost, in rupees, of printing $n$ copies of the school magazine is $C = ${F} + ${r}n$. The school has ₹$${texNum(B)}$ for printing. What is the greatest number of copies it can print?`,
        ...numericAnswer(n),
        traps: traps(n, [
          { value: n + 1, why: `Check: $${n + 1}$ copies would cost more than ₹$${texNum(B)}$. Round DOWN — a part of a copy cannot be printed.` },
          { value: Math.floor(B / r), why: `The fixed ₹$${F}$ has to be paid first, out of the same money.` }
        ]),
        hints: [
          `Take away the fixed amount ₹$${F}$ from the money available.`,
          `Each copy costs ₹$${r}$. How many whole copies does what is left pay for?`,
          'Check your answer by putting it back into the formula.'
        ],
        steps: [
          { h: 'Money for copies', d: `$${texNum(B)} - ${F} = ${texNum(B - F)}$` },
          { h: 'Divide', d: `$${texNum(B - F)} \\div ${r}$ is $${n}$ with something left over` },
          { h: 'Check', d: `$C = ${F} + ${r} \\times ${n} = ${texNum(F + r * n)} \\le ${texNum(B)}$, but $${n + 1}$ copies cost $${texNum(F + r * (n + 1))}$.` }
        ]
      };
    }
    const base = rc(rng, [25, 30, 35, 40]), free = rc(rng, [1, 2]), r = ri(rng, 11, 19), B = 10 * ri(rng, 12, 40);
    if (B <= base + r) continue;
    const d = free + Math.floor((B - base) / r);
    if ((B - base) % r === 0 || [base, r, B].includes(d)) continue;
    return {
      prompt: `An auto-rickshaw in ${rc(rng, IN_CITIES)} charges ₹$${base}$ for the first $${free}$ km and ₹$${r}$ for every further whole kilometre, so the fare for a trip of $d$ whole kilometres ($d \\ge ${free}$) is $F = ${base} + ${r}(d - ${free})$. What is the greatest whole number of kilometres you can travel with ₹$${B}$?`,
      ...numericAnswer(d),
      answerSuffix: 'km',
      traps: traps(d, [
        { value: d - free, why: `That counts only the extra kilometres; the first ${free} km are included in the ₹$${base}$.` },
        { value: d + 1, why: `Check: one more kilometre would cost more than ₹$${B}$.` }
      ]),
      hints: [
        `Take away the ₹$${base}$ for the first $${free}$ km.`,
        `Each further kilometre costs ₹$${r}$. How many whole further kilometres does the rest pay for?`,
        `Add back the first $${free}$ km.`
      ],
      steps: [
        { h: 'Money for further km', d: `$${B} - ${base} = ${B - base}$` },
        { h: 'Further km', d: `$${B - base} \\div ${r}$ is $${d - free}$ with something left over` },
        { h: 'Total distance', d: `$${d - free} + ${free} = ${d}$ km (fare $F = ${base + r * (d - free)}$)` }
      ]
    };
  }
  return budgetFormula(makeRng(FALLBACK_SEED));
}

const formulaEvaluation = rng => (rng() < 0.5 ? bracketFormula(rng) : budgetFormula(rng));

// ══ 5 · Parallel and Intersecting Lines ═════════════════════════════════════

const angleExpr = (a, b) => `(${linearTex(a, b)})^\\circ`;

// dp 0 · Linear pairs and vertically opposite angles.
function crossingLines(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const theta = ri(rng, 32, 148), x = ri(rng, 5, 30);
    const a = ri(rng, 1, 5), c = ri(rng, 1, 5);
    if (a === c) continue;
    const variant = rng() < 0.5 ? 'opposite' : 'pair';
    const b = theta - a * x;
    const d = variant === 'opposite' ? theta - c * x : 180 - theta - c * x;
    if (Math.abs(b) > 90 || Math.abs(d) > 90) continue;
    if (variant === 'opposite') {
      const ask = rc(rng, ['AOD', 'BOC']);
      return {
        prompt: `Two straight lines $AB$ and $CD$ cross at the point $O$. $\\angle AOC = ${angleExpr(a, b)}$ and $\\angle BOD = ${angleExpr(c, d)}$. Find $\\angle ${ask}$.`,
        ...numericAnswer(180 - theta, 0, '°'),
        traps: traps(180 - theta, [
          { value: theta, why: `That is $\\angle AOC$ itself. $\\angle ${ask}$ sits next to it on a straight line.` },
          { value: x, why: 'That is the value of $x$, not the angle.' }
        ]),
        hints: [
          '$\\angle AOC$ and $\\angle BOD$ are vertically opposite. What do you know about vertically opposite angles?',
          'Use that to form an equation in $x$ and solve it.',
          `$\\angle ${ask}$ and $\\angle AOC$ together make a straight line.`
        ],
        steps: [
          { h: 'Vertically opposite angles are equal', d: `$${linearTex(a, b)} = ${linearTex(c, d)}$, so $x = ${x}$` },
          { h: 'The angle', d: `$\\angle AOC = ${a} \\times ${x}${plusConst(b)} = ${theta}^\\circ$` },
          { h: 'Linear pair', d: `$\\angle ${ask} = 180^\\circ - ${theta}^\\circ = ${180 - theta}^\\circ$` }
        ]
      };
    }
    return {
      prompt: `Two straight lines $AB$ and $CD$ cross at the point $O$. $\\angle AOC = ${angleExpr(a, b)}$ and $\\angle BOC = ${angleExpr(c, d)}$. Find $\\angle BOD$.`,
      ...numericAnswer(theta, 0, '°'),
      traps: traps(theta, [
        { value: 180 - theta, why: 'That is $\\angle BOC$. $\\angle BOD$ is vertically opposite $\\angle AOC$.' },
        { value: x, why: 'That is the value of $x$, not the angle.' }
      ]),
      hints: [
        '$\\angle AOC$ and $\\angle BOC$ sit side by side on the straight line $AB$. What do they add up to?',
        'Use that to form an equation in $x$ and solve it.',
        '$\\angle BOD$ is vertically opposite one of the two angles.'
      ],
      steps: [
        { h: 'Linear pair', d: `$(${linearTex(a, b)}) + (${linearTex(c, d)}) = 180$, so $x = ${x}$` },
        { h: 'The angles', d: `$\\angle AOC = ${theta}^\\circ$, $\\angle BOC = ${180 - theta}^\\circ$` },
        { h: 'Vertically opposite', d: `$\\angle BOD = \\angle AOC = ${theta}^\\circ$` }
      ]
    };
  }
  return crossingLines(makeRng(FALLBACK_SEED));
}

const RATIO_TRIPLES = [[1, 2, 3], [2, 3, 4], [1, 3, 5], [3, 4, 5], [2, 3, 5], [1, 4, 7], [4, 5, 6], [5, 6, 7], [2, 5, 8], [3, 5, 7], [1, 2, 6], [3, 7, 8], [4, 7, 9], [1, 5, 6], [2, 7, 9]];
function threeLines(rng) {
  const triple = shuffled(rng, rc(rng, RATIO_TRIPLES));
  const k = 180 / triple.reduce((s, v) => s + v, 0);
  const angles = triple.map(v => v * k);
  const ask = rc(rng, ['largest', 'smallest']);
  const answer = ask === 'largest' ? Math.max(...angles) : Math.min(...angles);
  return {
    prompt: `Three straight lines pass through the same point, making six angles around it. Going round the point, three angles next to one another are in the ratio $${triple.join(' : ')}$. What is the ${ask} of the six angles?`,
    ...numericAnswer(answer, 0, '°'),
    traps: traps(answer, [
      { value: (360 / triple.reduce((s, v) => s + v, 0)) * (ask === 'largest' ? Math.max(...triple) : Math.min(...triple)), why: 'Three angles next to one another are not all the way round the point: the other three are vertically opposite these.' }
    ]),
    hints: [
      'Each of the six angles has a vertically opposite partner, so the six angles are three pairs.',
      'Three angles next to one another make up half a turn. What do they add up to?',
      `Share that total in the ratio $${triple.join(' : ')}$.`
    ],
    steps: [
      { h: 'Half a turn', d: 'Three angles next to one another make a straight angle: their sum is $180^\\circ$.' },
      { h: 'One part', d: `$180^\\circ \\div (${triple.join(' + ')}) = ${k}^\\circ$` },
      { h: 'The angles', d: `$${angles.join('^\\circ, ')}^\\circ$, each repeated by its vertically opposite angle` },
      { h: 'Answer', d: `The ${ask} angle is $${answer}^\\circ$.` }
    ]
  };
}

const anglePairs = rng => (rng() < 0.6 ? crossingLines(rng) : threeLines(rng));

// dp 1 · Corresponding and alternate angles.
function bentPath(rng) {
  const a = ri(rng, 18, 76), c = ri(rng, 18, 76);
  const setup = 'Lines $AB$ and $CD$ are parallel, with $AB$ above $CD$, $B$ to the right of $A$ and $D$ to the right of $C$. A point $E$ lies between the two lines, to the right of both $A$ and $C$, and $E$ is joined to $A$ and to $C$.';
  if (rng() < 0.55) {
    return {
      prompt: `${setup} If $\\angle BAE = ${a}^\\circ$ and $\\angle DCE = ${c}^\\circ$, find $\\angle AEC$.`,
      ...numericAnswer(a + c, 0, '°'),
      traps: traps(a + c, [
        { value: 180 - a - c, why: 'The angle at $E$ is not the third angle of a triangle here — draw a line through $E$ parallel to $AB$.' },
        { value: 360 - a - c, why: 'That is the reflex angle at $E$, on the other side.' }
      ]),
      hints: [
        'Draw a line through $E$ parallel to $AB$ (and so also parallel to $CD$).',
        'This line splits $\\angle AEC$ into two parts. Each part is an alternate angle to one of the given angles.',
        'Add the two parts.'
      ],
      steps: [
        { h: 'Construction', d: 'Draw $EF$ through $E$, parallel to $AB$ and $CD$, pointing left.' },
        { h: 'Alternate angles', d: `$\\angle AEF = \\angle BAE = ${a}^\\circ$ and $\\angle CEF = \\angle DCE = ${c}^\\circ$` },
        { h: 'Add', d: `$\\angle AEC = ${a}^\\circ + ${c}^\\circ = ${a + c}^\\circ$` }
      ]
    };
  }
  const s = a + c;
  return {
    prompt: `${setup} If $\\angle AEC = ${s}^\\circ$ and $\\angle BAE = ${a}^\\circ$, find $\\angle DCE$.`,
    ...numericAnswer(c, 0, '°'),
    traps: traps(c, [
      { value: 180 - s, why: 'The angle at $E$ is not part of a triangle with these angles — draw a line through $E$ parallel to $AB$.' },
      { value: s + a, why: '$\\angle BAE$ is one PART of the angle at $E$, so it is taken away, not added.' }
    ]),
    hints: [
      'Draw a line through $E$ parallel to $AB$ (and so also parallel to $CD$).',
      'This line splits $\\angle AEC$ into two parts, each an alternate angle to an angle at $A$ or at $C$.',
      'One part is known; find the other.'
    ],
    steps: [
      { h: 'Construction', d: 'Draw $EF$ through $E$, parallel to $AB$ and $CD$, pointing left.' },
      { h: 'Alternate angles', d: `$\\angle AEF = \\angle BAE = ${a}^\\circ$, so $\\angle CEF = ${s}^\\circ - ${a}^\\circ = ${c}^\\circ$` },
      { h: 'Answer', d: `$\\angle DCE = \\angle CEF = ${c}^\\circ$` }
    ]
  };
}

function transversalAlgebra(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const theta = ri(rng, 35, 145), x = ri(rng, 4, 30);
    const a = ri(rng, 1, 6), c = ri(rng, 1, 6);
    if (a === c) continue;
    const b = theta - a * x, d = theta - c * x;
    if (Math.abs(b) > 90 || Math.abs(d) > 90) continue;
    const pair = rc(rng, ['alternate interior', 'corresponding']);
    const ask = pair === 'corresponding' ? 'linear' : rc(rng, ['linear', 'other']);
    const askText = ask === 'linear' ? 'the angle that forms a linear pair with the first of these angles' : 'each angle of the other pair of alternate interior angles';
    return {
      prompt: `Two parallel lines are cut by a transversal. A pair of ${pair} angles measure $${angleExpr(a, b)}$ and $${angleExpr(c, d)}$. Find ${askText}.`,
      ...numericAnswer(180 - theta, 0, '°'),
      traps: traps(180 - theta, [
        { value: theta, why: `That is the size of the ${pair} angles themselves; the question asks for an angle that is supplementary to them.` },
        { value: x, why: 'That is the value of $x$, not an angle.' }
      ]),
      hints: [
        `${pair[0].toUpperCase()}${pair.slice(1)} angles between parallel lines are equal. Form an equation in $x$.`,
        'Solve it and find the size of the angles.',
        'The angle asked for, together with one of them, makes $180^\\circ$.'
      ],
      steps: [
        { h: `${pair[0].toUpperCase()}${pair.slice(1)} angles are equal`, d: `$${linearTex(a, b)} = ${linearTex(c, d)}$, so $x = ${x}$` },
        { h: 'The angles', d: `$${a} \\times ${x}${plusConst(b)} = ${theta}^\\circ$` },
        { h: 'Supplementary', d: `$180^\\circ - ${theta}^\\circ = ${180 - theta}^\\circ$` }
      ]
    };
  }
  return transversalAlgebra(makeRng(FALLBACK_SEED));
}

const transversal = rng => (rng() < 0.5 ? bentPath(rng) : transversalAlgebra(rng));

// ══ 6 · Number Play ═════════════════════════════════════════════════════════

// dp 0 · Parity of sums and products.
function parityCards(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const n = rc(rng, [6, 7]);
    const nums = pick(rng, Array.from({ length: 59 }, (_, i) => i + 2), n).sort((a, b) => a - b);
    const odd = nums.filter(v => v % 2).length, even = n - odd;
    if (odd < 2 || even < 2) continue;
    const kind = rc(rng, ['pair-odd-sum', 'pair-even-sum', 'pair-odd-product', 'triple-even-sum', 'triple-odd-sum']);
    const C2 = m => (m * (m - 1)) / 2, C3 = m => (m * (m - 1) * (m - 2)) / 6;
    const answer = {
      'pair-odd-sum': odd * even, 'pair-even-sum': C2(odd) + C2(even), 'pair-odd-product': C2(odd),
      'triple-even-sum': C3(even) + C2(odd) * even, 'triple-odd-sum': odd * C2(even) + C3(odd)
    }[kind];
    if (answer < 2) continue;
    const pair = kind.startsWith('pair');
    const what = { 'pair-odd-sum': 'two cards whose numbers add up to an odd number', 'pair-even-sum': 'two cards whose numbers add up to an even number', 'pair-odd-product': 'two cards whose numbers multiply to an odd number', 'triple-even-sum': 'three cards whose numbers add up to an even number', 'triple-odd-sum': 'three cards whose numbers add up to an odd number' }[kind];
    const rule = {
      'pair-odd-sum': 'A sum of two numbers is odd only when one is odd and the other even.',
      'pair-even-sum': 'A sum of two numbers is even when both are odd or both are even.',
      'pair-odd-product': 'A product is odd only when every factor is odd.',
      'triple-even-sum': 'A sum of three numbers is even when none of them is odd, or exactly two of them are odd.',
      'triple-odd-sum': 'A sum of three numbers is odd when exactly one of them is odd, or all three are odd.'
    }[kind];
    const total = pair ? C2(n) : C3(n);
    return {
      prompt: `${n === 6 ? 'Six' : 'Seven'} cards carry the numbers ${nums.map(v => `$${v}$`).join(', ')}. In how many different ways can you choose ${what}? (The same cards chosen in a different order count as the same way.)`,
      ...numericAnswer(answer),
      traps: traps(answer, [
        { value: total - answer, why: 'That counts the choices that do NOT work.' },
        { value: total, why: 'That counts every possible choice, without checking odd and even.' }
      ]),
      hints: [
        'Sort the cards into odd numbers and even numbers.',
        `Think about which mixes of odd and even give the result you want. ${pair ? 'Two' : 'Three'} odd numbers add up to ${pair ? 'an even' : 'an odd'} number.`,
        'Count the choices for each mix that works, and add.'
      ],
      steps: [
        { h: 'Sort', d: `Odd: ${nums.filter(v => v % 2).join(', ')} (${odd} cards). Even: ${nums.filter(v => v % 2 === 0).join(', ')} (${even} cards).` },
        { h: 'Rule', d: rule },
        { h: 'Count', d: `$${answer}$ ways (out of $${total}$ possible choices)` }
      ]
    };
  }
  return parityCards(makeRng(FALLBACK_SEED));
}

const PARITY_EXPRESSIONS = [
  { tex: 'a + b', p: [1, 0] }, { tex: 'ab', p: null }, { tex: '3a', p: [3, 0] }, { tex: 'a + a', p: [2, 0] },
  { tex: '2a + b', p: [2, 1] }, { tex: 'a + b + 1', p: [1, 1, 1] }, { tex: 'ab + a', p: null }, { tex: '5a + 3b', p: [5, 3] },
  { tex: 'a \\times a', p: null }, { tex: 'a + 3b + 1', p: [1, 3, 1] }, { tex: '4a + 1', p: [4, 0, 1] }, { tex: 'b + 7', p: [0, 1, 7] },
  { tex: 'ab + 1', p: null }, { tex: '3a + 2b', p: [3, 2] }, { tex: 'a \\times b \\times b', p: null }, { tex: '2a + 2b + 1', p: [2, 2, 1] }
];
const parityOf = (tex, a, b) => {
  const v = { 'a + b': a + b, ab: a * b, '3a': 3 * a, 'a + a': 2 * a, '2a + b': 2 * a + b, 'a + b + 1': a + b + 1, 'ab + a': a * b + a, '5a + 3b': 5 * a + 3 * b, 'a \\times a': a * a, 'a + 3b + 1': a + 3 * b + 1, '4a + 1': 4 * a + 1, 'b + 7': b + 7, 'ab + 1': a * b + 1, '3a + 2b': 3 * a + 2 * b, 'a \\times b \\times b': a * b * b, '2a + 2b + 1': 2 * a + 2 * b + 1 }[tex];
  return Math.abs(v) % 2;
};
function parityExpressions(rng) {
  const [pa, pb] = rc(rng, [[1, 0], [0, 1], [1, 1]]);
  const items = pick(rng, PARITY_EXPRESSIONS, 6);
  const want = rc(rng, ['odd', 'even']);
  const odds = items.filter(e => parityOf(e.tex, pa ? 3 : 2, pb ? 3 : 2) === 1).length;
  const answer = want === 'odd' ? odds : 6 - odds;
  const desc = v => (v ? 'odd' : 'even');
  return {
    prompt: `The whole number $a$ is ${desc(pa)} and the whole number $b$ is ${desc(pb)}. How many of these are always ${want}? ${items.map(e => `$${e.tex}$`).join(', ')}`,
    ...numericAnswer(answer),
    traps: traps(answer, [{ value: 6 - answer, why: `That counts the ones that are always ${want === 'odd' ? 'even' : 'odd'}.` }]),
    hints: [
      'Odd + odd and even + even are even; odd + even is odd.',
      'A product is odd only when every factor is odd; any even factor makes it even.',
      `Try small numbers to check: for example, put ${pa ? 'an odd number such as 3' : 'an even number such as 2'} in place of $a$ and ${pb ? 'an odd number such as 3' : 'an even number such as 2'} in place of $b$ — then check your reasoning works for every such $a$ and $b$.`
    ],
    steps: [
      ...items.map(e => ({ h: `$${e.tex}$`, d: desc(parityOf(e.tex, pa ? 3 : 2, pb ? 3 : 2)) })).slice(0, 6),
      { h: 'Count', d: `$${answer}$ of them are always ${want}.` }
    ]
  };
}

const parity = rng => (rng() < 0.55 ? parityCards(rng) : parityExpressions(rng));

// dp 1 · Magic squares.
const lucas = (a, b, c) => [c - b, c + a + b, c - a, c - a + b, c, c + a - b, c + a, c - a - b, c + b];
const SYMMETRIES = [
  i => i, i => [6, 3, 0, 7, 4, 1, 8, 5, 2][i], i => 8 - i, i => [2, 5, 8, 1, 4, 7, 0, 3, 6][i],
  i => [2, 1, 0, 5, 4, 3, 8, 7, 6][i], i => [6, 7, 8, 3, 4, 5, 0, 1, 2][i], i => [0, 3, 6, 1, 4, 7, 2, 5, 8][i], i => [8, 5, 2, 7, 4, 1, 6, 3, 0][i]
];
const GIVEN_PATTERNS = [[4, 0, 1], [0, 2, 7], [0, 1, 2], [3, 5, 6]];
const squareTex = cells => `\\begin{array}{|c|c|c|}\\hline ${[0, 1, 2].map(r => cells.slice(3 * r, 3 * r + 3).join(' & ')).join(' \\\\ \\hline ')} \\\\ \\hline\\end{array}`;

function magicFromThree(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const c = ri(rng, 10, 30), a = ri(rng, 1, 9), b = ri(rng, a + 1, 12);
    if (b === 2 * a || b >= c - a) continue;
    const base = lucas(a, b, c);
    const sym = rc(rng, SYMMETRIES);
    const grid = Array(9);
    base.forEach((v, i) => { grid[sym(i)] = v; });
    const given = rc(rng, GIVEN_PATTERNS).map(sym);
    const free = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter(i => !given.includes(i));
    const target = rc(rng, free);
    const cells = grid.map((v, i) => (given.includes(i) ? String(v) : i === target ? 'x' : '\\phantom{00}'));
    const answer = grid[target];
    return {
      prompt: `In this magic square, every row, every column and both diagonals add up to the same number. Find $x$. $${squareTex(cells)}$`,
      ...numericAnswer(answer),
      traps: traps(answer, [{ value: 3 * c, why: 'That is the magic sum — the total of a whole line — not the number in one square.' }]),
      hints: [
        'In a 3 × 3 magic square, the magic sum is three times the number in the centre.',
        'Look for a row, column or diagonal with two numbers filled in: once you know the magic sum, the third is found by subtraction.',
        'Fill in squares one at a time until you reach $x$.'
      ],
      steps: [
        { h: 'Completed square', d: `$${squareTex(grid.map(String))}$` },
        { h: 'Magic sum', d: `Every line adds up to $${3 * c}$ (the centre is $${c}$).` },
        { h: 'Answer', d: `$x = ${answer}$` }
      ]
    };
  }
  return magicFromThree(makeRng(FALLBACK_SEED));
}

function magicFromNine(rng) {
  const n = ri(rng, 2, 40), d = rc(rng, [1, 1, 2, 3, 5]);
  const nums = Array.from({ length: 9 }, (_, i) => n + i * d);
  const centre = n + 4 * d;
  const ask = rc(rng, ['centre', 'sum', 'corners']);
  const answer = { centre, sum: 3 * centre, corners: 4 * centre }[ask];
  const askText = { centre: 'What number must go in the centre square?', sum: 'What must the common sum of each line be?', corners: 'What is the total of the four numbers in the corner squares?' }[ask];
  return {
    prompt: `The nine numbers ${nums.map(v => `$${v}$`).join(', ')} are placed in a 3 × 3 grid, one in each square, so that every row, every column and both diagonals add up to the same number. ${askText}`,
    ...numericAnswer(answer),
    traps: traps(answer, [
      { value: nums.reduce((s, v) => s + v, 0), why: 'That is the total of all nine numbers — it is shared equally among the three rows.' },
      ...(ask !== 'centre' ? [{ value: centre, why: 'That is the number in the centre square.' }] : [{ value: 3 * centre, why: 'That is the common sum of a line, not the centre number.' }])
    ]),
    hints: [
      'The three rows use all nine numbers once, so each row adds up to one third of the total.',
      'The middle row, the middle column and both diagonals all pass through the centre. Add those four lines together and compare with the total of all nine numbers.',
      ask === 'corners' ? 'The two diagonals together use the four corners and the centre twice.' : 'Use these facts to find what is asked.'
    ],
    steps: [
      { h: 'Total', d: `$${nums.join(' + ')} = ${9 * centre}$` },
      { h: 'Common sum', d: `$${9 * centre} \\div 3 = ${3 * centre}$` },
      { h: 'Centre', d: `The four lines through the centre add up to $4 \\times ${3 * centre}$ = (all nine numbers) + 3 × centre, so centre $= (${12 * centre} - ${9 * centre}) \\div 3 = ${centre}$` },
      ...(ask === 'corners' ? [{ h: 'Corners', d: `The two diagonals add up to $2 \\times ${3 * centre}$ and use the centre twice: corners $= ${6 * centre} - 2 \\times ${centre} = ${4 * centre}$` }] : [])
    ]
  };
}

const magicSquare = rng => (rng() < 0.6 ? magicFromThree(rng) : magicFromNine(rng));

// dp 3 · Cryptarithms: digits forced one after another.
const CRYPT_PATTERNS = [
  'AB+BA=CAC', 'AB+BA=CBC', 'AB+BA=BBC', 'AA+BB=CBC', 'AB+CB=BBA', 'AB+AB=BCC', 'AB+AB=CBB', 'AB+AC=BCB',
  'AB+BC=AAA', 'AB+CA=CCC', 'AA+AB=CCC', 'AB+BB=CAA', 'AB+AC=CBA', 'AB+AB+AB=CCB', 'AB*C=BBB', 'AB*A=CBB',
  'AB*A=CCC', 'AB*C=AAA', 'AB*B=ACA', 'AB*A=BCB', 'AB*A=BCA', 'AB*C=AAB', 'AB*C=BAA', 'AB*B=CDC', 'AB+CB=CBB'
];
const LETTER_POOL = ['A', 'B', 'C', 'D', 'E', 'K', 'M', 'N', 'P', 'R', 'S', 'T', 'X', 'Y'];

function solveCrypt(pattern) {
  const letters = [...new Set(pattern.replace(/[^A-Z]/g, ''))];
  const [lhs, rhs] = pattern.split('=');
  const words = pattern.match(/[A-Z]+/g);
  const leading = new Set(words.filter(w => w.length > 1).map(w => w[0]));
  const a = {}, used = new Set(), sols = [];
  const val = w => [...w].reduce((v, ch) => v * 10 + a[ch], 0);
  const side = s => s.split('+').reduce((t, term) => t + term.split('*').map(val).reduce((x, y) => x * y, 1), 0);
  const rec = i => {
    if (sols.length > 1) return;
    if (i === letters.length) { if (side(lhs) === side(rhs)) sols.push({ ...a }); return; }
    for (let dgt = 0; dgt <= 9; dgt++) {
      if (used.has(dgt) || (dgt === 0 && leading.has(letters[i]))) continue;
      a[letters[i]] = dgt; used.add(dgt); rec(i + 1); used.delete(dgt);
    }
  };
  rec(0);
  return sols.length === 1 ? sols[0] : null;
}

function cryptarithm(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const pattern = rc(rng, CRYPT_PATTERNS);
    const sol = solveCrypt(pattern);
    if (!sol) continue;
    const letters = Object.keys(sol);
    const names = pick(rng, LETTER_POOL, letters.length);
    const rename = s => s.replace(/[A-Z]/g, ch => names[letters.indexOf(ch)]);
    const shown = rename(pattern);
    const tex = shown.replace(/\*/g, ' \\times ').replace(/\+/g, ' + ').replace('=', ' = ');
    const words = shown.match(/[A-Z]+/g);
    const ask = rc(rng, ['result', 'first', 'sum']);
    const digit = ch => sol[letters[names.indexOf(ch)]];
    const valueOf = w => [...w].reduce((v, ch) => v * 10 + digit(ch), 0);
    const result = words[words.length - 1];
    const answer = ask === 'result' ? valueOf(result) : ask === 'first' ? valueOf(words[0]) : names.slice(0, letters.length).reduce((s, ch) => s + digit(ch), 0);
    if (ask === 'first' && words[0].length < 2) continue;
    const askText = ask === 'result' ? `What number is $${result}$?` : ask === 'first' ? `What number is $${words[0]}$?` : `What is $${names.slice(0, letters.length).join(' + ')}$?`;
    const filled = shown.replace(/[A-Z]/g, ch => String(digit(ch))).replace(/\*/g, ' \\times ').replace(/\+/g, ' + ').replace('=', ' = ');
    return {
      prompt: `In the puzzle $${tex}$, each letter stands for a different digit, the same letter always stands for the same digit, and no number with two or more digits begins with $0$ (so $${words[0]}$ is ${words[0].length === 2 ? 'a two-digit number' : 'a number'} with digits ${[...words[0]].map(ch => `$${ch}$`).join(' and ')}). ${askText}`,
      ...numericAnswer(answer),
      traps: traps(answer, []),
      hints: [
        'Start with the leftmost digit of the answer: how big can a carry, or a product of this size, be?',
        'Then look at the ones column: what must the ones digit be for the ones digits to work?',
        'Try the few digits that are still possible, and check the whole sum or product.'
      ],
      steps: [
        { h: 'Digits', d: names.slice(0, letters.length).map(ch => `$${ch} = ${digit(ch)}$`).join(', ') },
        { h: 'Check', d: `$${filled}$` },
        { h: 'Only answer', d: 'No other choice of different digits works.' }
      ]
    };
  }
  return cryptarithm(makeRng(FALLBACK_SEED));
}

// ══ 7 · A Tale of Three Intersecting Lines ═════════════════════════════════

// dp 0 · Angle sum, exterior angle and classification.
function exteriorRatio(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const p = ri(rng, 1, 7), q = ri(rng, 1, 7);
    if (p === q || gcd(p, q) !== 1) continue;
    const e = ri(rng, 95, 165);
    if (e % (p + q)) continue;
    const A = (e / (p + q)) * p, B = (e / (p + q)) * q;
    const ask = rc(rng, ['A', 'B']);
    const answer = ask === 'A' ? A : B;
    return {
      prompt: `In triangle $ABC$, the side $BC$ is extended beyond $C$ to a point $D$. $\\angle ACD = ${e}^\\circ$ and $\\angle A : \\angle B = ${p} : ${q}$. Find $\\angle ${ask}$.`,
      ...numericAnswer(answer, 0, '°'),
      traps: traps(answer, [
        { value: ((180 - e) / (p + q)) * (ask === 'A' ? p : q), why: `That shares $\\angle ACB$ in the ratio. The exterior angle $\\angle ACD$ equals the sum of the two OPPOSITE interior angles, $\\angle A + \\angle B$.` },
        { value: ask === 'A' ? B : A, why: `That is $\\angle ${ask === 'A' ? 'B' : 'A'}$.` }
      ]),
      hints: [
        '$\\angle ACB$ and $\\angle ACD$ form a linear pair.',
        'The three angles of the triangle add up to $180^\\circ$. What does that tell you about $\\angle A + \\angle B$?',
        `Share $\\angle A + \\angle B$ in the ratio $${p} : ${q}$.`
      ],
      steps: [
        { h: 'Linear pair', d: `$\\angle ACB = 180^\\circ - ${e}^\\circ = ${180 - e}^\\circ$` },
        { h: 'Angle sum', d: `$\\angle A + \\angle B = 180^\\circ - ${180 - e}^\\circ = ${e}^\\circ$` },
        { h: 'Share in the ratio', d: `One part $= ${e} \\div ${p + q} = ${e / (p + q)}$, so $\\angle A = ${A}^\\circ$ and $\\angle B = ${B}^\\circ$` }
      ]
    };
  }
  return exteriorRatio(makeRng(FALLBACK_SEED));
}

const CLASSES = ['Acute-angled', 'Right-angled', 'Obtuse-angled'];
function classifyByAngles(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const kind = rc(rng, CLASSES);
    let A;
    if (kind === 'Right-angled') { const s = ri(rng, 20, 70); A = [90, s, 90 - s]; }
    else if (kind === 'Obtuse-angled') { const big = ri(rng, 92, 130), s = ri(rng, 15, 180 - big - 15); A = [big, s, 180 - big - s]; }
    else { const big = ri(rng, 76, 89), s = ri(rng, 180 - 2 * big + 1, 89); A = [big, s, 180 - big - s]; if (A[2] >= 90 || A[2] < 5) continue; }
    A = shuffled(rng, A);
    const coeffs = shuffled(rng, rc(rng, [[1, 2, 3], [1, 1, 2], [2, 3, 4], [1, 2, 2], [1, 3, 4]]));
    const x = ri(rng, 6, 25);
    const offs = A.map((v, i) => v - coeffs[i] * x);
    if (offs.some(o => Math.abs(o) > 80)) continue;
    const m = mcqOptions(rng, kind, [...CLASSES.filter(k => k !== kind), 'No such triangle can exist']);
    return {
      prompt: `The angles of triangle $PQR$ are $\\angle P = ${angleExpr(coeffs[0], offs[0])}$, $\\angle Q = ${angleExpr(coeffs[1], offs[1])}$ and $\\angle R = ${angleExpr(coeffs[2], offs[2])}$. Classify the triangle by its angles.`,
      answerType: 'mcq',
      answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps },
      mcqOptions: m.options,
      hints: [
        'The three angles of a triangle add up to $180^\\circ$. Form an equation in $x$.',
        'Solve it, then work out each angle.',
        'Look at the largest angle: is it less than, equal to, or more than $90^\\circ$?'
      ],
      steps: [
        { h: 'Angle sum', d: `$(${linearTex(coeffs[0], offs[0])}) + (${linearTex(coeffs[1], offs[1])}) + (${linearTex(coeffs[2], offs[2])}) = 180$, so $x = ${x}$` },
        { h: 'The angles', d: `$\\angle P = ${A[0]}^\\circ$, $\\angle Q = ${A[1]}^\\circ$, $\\angle R = ${A[2]}^\\circ$` },
        { h: 'Classify', d: `The largest angle is $${Math.max(...A)}^\\circ$, so the triangle is ${kind.toLowerCase()}.` }
      ]
    };
  }
  return classifyByAngles(makeRng(FALLBACK_SEED));
}

/** Options in a seeded order, with a note on each wrong one. */
function mcqOptions(rng, correct, wrong) {
  const notes = {
    'Acute-angled': 'An acute-angled triangle has ALL three angles less than $90^\\circ$.',
    'Right-angled': 'A right-angled triangle has one angle of exactly $90^\\circ$.',
    'Obtuse-angled': 'An obtuse-angled triangle has one angle greater than $90^\\circ$.',
    'No such triangle can exist': 'The angles found are all positive and add up to $180^\\circ$, so the triangle exists.'
  };
  const all = shuffled(rng, [correct, ...wrong]);
  const correctIndex = all.indexOf(correct);
  const optionTraps = {};
  all.forEach((o, i) => { if (i !== correctIndex && notes[o]) optionTraps[i] = notes[o]; });
  return { options: all, correctIndex, optionTraps };
}

const angleSum = rng => (rng() < 0.5 ? exteriorRatio(rng) : classifyByAngles(rng));

// dp 1 · The triangle inequality, used to count.
function thirdSideCount(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const a = ri(rng, 3, 18), b = ri(rng, 3, 18);
    if (a === b) continue;
    const cond = rc(rng, ['even', 'odd', 'scalene', 'longest', 'perimeter']);
    const k = rc(rng, [3, 4, 5]);
    const ok = c => c > Math.abs(a - b) && c < a + b && (
      cond === 'even' ? c % 2 === 0 : cond === 'odd' ? c % 2 === 1 : cond === 'scalene' ? c !== a && c !== b
        : cond === 'longest' ? c > Math.max(a, b) : (a + b + c) % k === 0);
    const all = [];
    for (let c = 1; c < a + b + 5; c++) if (ok(c)) all.push(c);
    if (all.length < 2) continue;
    const condText = {
      even: 'and is an even number', odd: 'and is an odd number', scalene: 'and the triangle is scalene',
      longest: `and is the longest side of the triangle`, perimeter: `and the perimeter of the triangle is a multiple of $${k}$`
    }[cond];
    const plain = a + b - 1 - Math.abs(a - b);
    return {
      prompt: `Two sides of a triangle are $${a}$ cm and $${b}$ cm long. The third side is a whole number of centimetres ${condText}. How many different lengths are possible for the third side?`,
      ...numericAnswer(all.length),
      traps: traps(all.length, [
        { value: plain, why: 'That counts every length the triangle inequality allows, without the extra condition.' },
        { value: all.length + 1, why: `The third side must be strictly between $${Math.abs(a - b)}$ and $${a + b}$ — a side equal to either end does not make a triangle.` }
      ]),
      hints: [
        'The third side must be less than the sum of the other two sides and more than their difference.',
        'List the whole numbers in that range.',
        'Keep only the ones that also meet the extra condition, and count them.'
      ],
      steps: [
        { h: 'Triangle inequality', d: `$${Math.abs(a - b)} < c < ${a + b}$` },
        { h: 'Extra condition', d: `Possible lengths: ${all.join(', ')} cm` },
        { h: 'Count', d: `$${all.length}$ lengths` }
      ]
    };
  }
  return thirdSideCount(makeRng(FALLBACK_SEED));
}

function isoscelesPerimeter(rng) {
  const P = ri(rng, 11, 40);
  const tris = [];
  for (let s = 1; 2 * s < P; s++) { const base = P - 2 * s; if (base < 2 * s) tris.push([s, base]); }
  const answer = tris.length;
  return {
    prompt: `An isosceles triangle has a perimeter of $${P}$ cm, and all its sides are whole numbers of centimetres. How many different such triangles are there? (Count an equilateral triangle as isosceles.)`,
    ...numericAnswer(answer),
    traps: traps(answer, [
      { value: Math.floor((P - 1) / 2), why: 'Not every choice of equal sides works: the two equal sides together must be longer than the base.' }
    ]),
    hints: [
      'Call the two equal sides $s$ each. What is the base in terms of $s$?',
      'The base must be at least 1 cm, and the two equal sides together must be longer than the base.',
      'List the possible values of $s$ and count them.'
    ],
    steps: [
      { h: 'Base', d: `$\\text{base} = ${P} - 2s$` },
      { h: 'Conditions', d: `$${P} - 2s \\ge 1$ and $2s > ${P} - 2s$` },
      { h: 'Triangles', d: tris.map(([s, b]) => `$${s}, ${s}, ${b}$`).join('; ') }
    ]
  };
}

function stickPieces(rng) {
  const L = ri(rng, 12, 60);
  const answer = Math.ceil(L / 2) - 1;
  return {
    prompt: `A stick $${L}$ cm long is cut into three pieces, each a whole number of centimetres, and the pieces are used to make a triangle. What is the greatest possible length of the longest piece?`,
    ...numericAnswer(answer, 0, 'cm'),
    traps: traps(answer, [
      { value: L / 2 === Math.floor(L / 2) ? L / 2 : Math.floor(L / 2), why: 'If the longest piece is half the stick or more, the other two pieces together are not longer than it, and they cannot meet to make a triangle.' },
      { value: L - 2, why: 'The other two pieces must together be LONGER than the longest piece.' }
    ]),
    hints: [
      'If the longest piece is $m$ cm, the other two pieces together are $' + L + ' - m$ cm.',
      'For a triangle, the other two pieces together must be longer than the longest piece.',
      'Find the largest whole $m$ that allows this.'
    ],
    steps: [
      { h: 'Condition', d: `$${L} - m > m$, so $m < ${L / 2}$` },
      { h: 'Largest whole number', d: `$m = ${answer}$` },
      { h: 'Check', d: `For example $${answer}$, $${Math.ceil((L - answer) / 2)}$ and $${Math.floor((L - answer) / 2)}$ cm make a triangle.` }
    ]
  };
}

const triangleInequality = rng => { const r = rng(); return r < 0.45 ? thirdSideCount(rng) : r < 0.75 ? isoscelesPerimeter(rng) : stickPieces(rng); };

// dp 3 · Constructions: what data fixes a triangle.
function compassArcs(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const d = ri(rng, 5, 12), r1 = ri(rng, 3, 11);
    if (r1 === d) continue;
    const cond = rc(rng, ['none', 'scalene', 'longer']);
    const name = rc(rng, IN_NAMES);
    const ok = r => Math.abs(d - r1) < r && r < d + r1 && (cond === 'scalene' ? r !== d && r !== r1 : cond === 'longer' ? r > r1 : true);
    const all = [];
    for (let r = 1; r < d + r1 + 3; r++) if (ok(r)) all.push(r);
    if (all.length < 2) continue;
    const condText = { none: '', scalene: ' and the triangle is to be scalene', longer: ` and $PR$ is to be longer than $PQ$` }[cond];
    return {
      prompt: `${name} draws $QR = ${d}$ cm and then, with a compass, an arc of radius $${r1}$ cm centred at $Q$. A second arc, centred at $R$, is to cross the first at a point $P$ and so complete triangle $PQR$. The radius of the second arc is a whole number of centimetres${condText}. How many different radii are possible for the second arc?`,
      ...numericAnswer(all.length),
      traps: traps(all.length, [
        { value: d + r1 - Math.abs(d - r1) + 1, why: `When the radius is exactly $${Math.abs(d - r1)}$ or $${d + r1}$ cm the arcs only touch on the line $QR$, and no triangle is made.` },
        ...(cond !== 'none' ? [{ value: d + r1 - 1 - Math.abs(d - r1), why: 'That counts every radius that makes a triangle, without the extra condition.' }] : [])
      ]),
      hints: [
        'The arcs give $PQ$ and $PR$, so the three sides are $QR$, $PQ$ and $PR$.',
        'The arcs cross (above $QR$) only when the three lengths satisfy the triangle inequality.',
        'List the whole-number radii that work and count them.'
      ],
      steps: [
        { h: 'Sides', d: `$QR = ${d}$, $PQ = ${r1}$, $PR = r$` },
        { h: 'Triangle inequality', d: `$${Math.abs(d - r1)} < r < ${d + r1}$` },
        { h: 'Radii', d: `${all.join(', ')} cm — $${all.length}$ choices` }
      ]
    };
  }
  return compassArcs(makeRng(FALLBACK_SEED));
}

// Each option is a set of measurements for triangle PQR; exactly one fixes one triangle.
function dataSets(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const good = rc(rng, ['SAS', 'ASA', 'SSS']);
    const opts = [];
    if (good === 'SAS') { const a = ri(rng, 4, 9), b = ri(rng, 4, 9), ang = ri(rng, 35, 120); opts.push({ text: `$PQ = ${a}$ cm, $QR = ${b}$ cm, $\\angle Q = ${ang}^\\circ$`, ok: true }); }
    if (good === 'ASA') { const x = ri(rng, 30, 80), y = ri(rng, 30, 80); opts.push({ text: `$\\angle P = ${x}^\\circ$, $\\angle Q = ${y}^\\circ$, $PQ = ${ri(rng, 4, 9)}$ cm`, ok: true }); }
    if (good === 'SSS') { const a = ri(rng, 4, 9), b = ri(rng, 4, 9), c = ri(rng, Math.abs(a - b) + 1, a + b - 1); opts.push({ text: `$PQ = ${a}$ cm, $QR = ${b}$ cm, $RP = ${c}$ cm`, ok: true }); }
    // Too much in the angles: no triangle.
    const big = ri(rng, 95, 120), other = ri(rng, 181 - big, 100);
    opts.push({ text: `$\\angle P = ${big}^\\circ$, $\\angle Q = ${other}^\\circ$, $PQ = ${ri(rng, 4, 9)}$ cm`, ok: false });
    // Sides that cannot meet.
    const s1 = ri(rng, 3, 6), s2 = ri(rng, 3, 6), s3 = s1 + s2 + ri(rng, 0, 3);
    opts.push({ text: `$PQ = ${s1}$ cm, $QR = ${s2}$ cm, $RP = ${s3}$ cm`, ok: false });
    // All three angles: any size.
    const g1 = ri(rng, 40, 80), g2 = ri(rng, 40, 80);
    const third = rc(rng, ['AAA', 'SSA']);
    if (third === 'AAA') opts.push({ text: `$\\angle P = ${g1}^\\circ$, $\\angle Q = ${g2}^\\circ$, $\\angle R = ${180 - g1 - g2}^\\circ$`, ok: false });
    else {
      // SSA with two triangles: angle at P, PQ = c, QR = a with c·sin P < a < c.
      const c = ri(rng, 7, 10), angP = ri(rng, 25, 45), a = Math.ceil(c * Math.sin((angP * Math.PI) / 180) + 0.6);
      if (!(a < c)) continue;
      opts.push({ text: `$PQ = ${c}$ cm, $QR = ${a}$ cm, $\\angle P = ${angP}^\\circ$`, ok: false });
    }
    if (180 - g1 - g2 <= 0) continue;
    const shuffledOpts = shuffled(rng, opts);
    const correctIndex = shuffledOpts.findIndex(o => o.ok);
    return {
      prompt: 'Which one of these sets of measurements fixes exactly one triangle $PQR$ (so that every triangle drawn with these measurements is the same)?',
      answerType: 'mcq',
      answer: { correctIndex, optionTraps: Object.fromEntries(shuffledOpts.map((o, i) => [i, o]).filter(([i]) => i !== correctIndex).map(([i, o]) => [i, /\\angle R/.test(o.text) ? 'Three angles fix the shape but not the size: triangles of every size have these angles.' : /RP/.test(o.text) ? 'Check the triangle inequality: the two shorter sides together are not longer than the third.' : /\\angle Q/.test(o.text) ? 'Two angles of a triangle must add up to less than $180^\\circ$.' : 'The angle is not between the two given sides: the second arc can cut the arm of the angle in two places, giving two different triangles.'])) },
      mcqOptions: shuffledOpts.map(o => o.text),
      hints: [
        'Check each set: can a triangle be drawn at all? Use the triangle inequality and the angle sum.',
        'Three angles alone fix the shape but not the size.',
        'Two sides with an angle fix the triangle only when the angle is the one BETWEEN those two sides.'
      ],
      steps: [
        { h: 'Rule', d: 'SSS (if the sides satisfy the triangle inequality), SAS with the included angle, and ASA (if the two angles add up to less than $180^\\circ$) each fix exactly one triangle.' },
        { h: 'The other sets', d: 'A set that breaks the triangle inequality or the angle sum gives no triangle; three angles give triangles of every size; two sides with an angle that is not between them can give two triangles.' },
        { h: 'Answer', d: shuffledOpts[correctIndex].text }
      ]
    };
  }
  return dataSets(makeRng(FALLBACK_SEED));
}

const triangleConstruction = rng => (rng() < 0.55 ? compassArcs(rng) : dataSets(rng));

// ══ 8 · Working with Fractions ══════════════════════════════════════════════

/** True when 1/d is a terminating decimal (d has no prime factor but 2 and 5). */
const terminates = d => { while (d % 2 === 0) d /= 2; while (d % 5 === 0) d /= 5; return d === 1; };

const fractionAnswer = f => ({
  answerType: 'numeric',
  answer: { value: f.n / f.d, simplestFraction: { n: f.n, d: f.d } },
  inputHint: 'e.g. 5/8'
});

// dp 0 · Products that cancel.
function telescoping(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const kind = rc(rng, ['minus', 'plus']);
    const k = ri(rng, 2, 6), n = ri(rng, k + 6, k + 30);
    const f = kind === 'minus' ? frac(k - 1, n) : frac(n + 1, k);
    // The prompt asks for a fraction, so the answer must be one that has no
    // exact decimal: a terminating result would have to be accepted as a decimal.
    if (f.d === 1 || terminates(f.d)) continue;
    const factor = m => `\\left(1 ${kind === 'minus' ? '-' : '+'} \\dfrac{1}{${m}}\\right)`;
    const first = kind === 'minus' ? `\\dfrac{${k - 1}}{${k}}` : `\\dfrac{${k + 1}}{${k}}`;
    return {
      prompt: `Find the product $${factor(k)}${factor(k + 1)}${factor(k + 2)} \\cdots ${factor(n)}$, in which the denominators go up by one from $${k}$ to $${n}$. Give your answer as a fraction in simplest form.`,
      ...fractionAnswer(f),
      traps: traps(f.value, [
        { value: kind === 'minus' ? 1 / n : n / k, why: kind === 'minus' ? `The first bracket is $\\dfrac{${k - 1}}{${k}}$, so its numerator $${k - 1}$ is not cancelled.` : `The last bracket is $\\dfrac{${n + 1}}{${n}}$, so its numerator $${n + 1}$ is not cancelled.` }
      ]),
      hints: [
        'Write each bracket as a single fraction first.',
        'Write out the first few and the last fraction of the product. What cancels?',
        'Only a number at the start and a number at the end survive.'
      ],
      steps: [
        { h: 'Each bracket', d: kind === 'minus' ? `$\\dfrac{${k - 1}}{${k}} \\times \\dfrac{${k}}{${k + 1}} \\times \\dfrac{${k + 1}}{${k + 2}} \\times \\cdots \\times \\dfrac{${n - 1}}{${n}}$` : `$\\dfrac{${k + 1}}{${k}} \\times \\dfrac{${k + 2}}{${k + 1}} \\times \\dfrac{${k + 3}}{${k + 2}} \\times \\cdots \\times \\dfrac{${n + 1}}{${n}}$` },
        { h: 'Cancel', d: `Each denominator cancels with the next numerator, starting from $${first}$.` },
        { h: 'Answer', d: `$${kind === 'minus' ? `\\dfrac{${k - 1}}{${n}}` : `\\dfrac{${n + 1}}{${k}}`} = ${fracTex(f.n, f.d)}$` }
      ]
    };
  }
  return telescoping(makeRng(FALLBACK_SEED));
}

function crossCancel(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const fs = [0, 1, 2].map(() => { const n = ri(rng, 2, 28), d = ri(rng, 3, 30); return [n, d]; });
    if (fs.some(([n, d]) => gcd(n, d) !== 1 || n === d)) continue;
    const N = fs.reduce((p, [n]) => p * n, 1), D = fs.reduce((p, [, d]) => p * d, 1);
    const f = frac(N, D);
    if (terminates(f.d) || gcd(N, D) < 24 || f.d === 1 || f.n === 1 && f.d > 60) continue;
    const naive = frac(fs[0][0] * fs[1][0], fs[0][1] * fs[1][1]);
    return {
      prompt: `Find $${fs.map(([n, d]) => `\\dfrac{${n}}{${d}}`).join(' \\times ')}$. Cancel common factors before you multiply, and give your answer as a fraction in simplest form.`,
      ...fractionAnswer(f),
      traps: traps(f.value, [{ value: naive.value, why: 'All three fractions have to be multiplied.' }]),
      hints: [
        'Write every numerator and denominator as a product of primes.',
        'A factor in ANY numerator can cancel with the same factor in ANY denominator.',
        'Multiply what is left.'
      ],
      steps: [
        { h: 'One fraction', d: `$\\dfrac{${fs.map(([n]) => n).join(' \\times ')}}{${fs.map(([, d]) => d).join(' \\times ')}}$` },
        { h: 'Cancel', d: `The common factor of top and bottom is $${gcd(N, D)}$.` },
        { h: 'Answer', d: `$${fracTex(f.n, f.d)}$` }
      ]
    };
  }
  return crossCancel(makeRng(FALLBACK_SEED));
}

const fractionProduct = rng => (rng() < 0.55 ? telescoping(rng) : crossCancel(rng));

// dp 1 · Multiplying by less than or more than one.
const MAG_POOL = [
  [[3, 4]], [[5, 6]], [[7, 8]], [[11, 12]], [[9, 10]], [[2, 3]], [[5, 4]], [[7, 6]], [[9, 8]], [[13, 12]], [[11, 10]], [[4, 3]],
  [[6, 6]], [[9, 9]], [[3, 4], [5, 3]], [[2, 3], [5, 4]], [[4, 5], [5, 4]], [[3, 2], [3, 5]], [[7, 8], [8, 7]], [[5, 6], [3, 2]], [[2, 5], [3, 2]]
];
function magnitudeCount(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const N = rc(rng, [24, 36, 48, 60, 72, 84, 96, 120]);
    const items = pick(rng, MAG_POOL, 6);
    const want = rc(rng, ['greater', 'less']);
    const prodOf = it => it.reduce((p, [n, d]) => p * n / d, 1);
    const count = items.filter(it => (want === 'greater' ? prodOf(it) > 1 + 1e-12 : prodOf(it) < 1 - 1e-12)).length;
    const equal = items.filter(it => Math.abs(prodOf(it) - 1) < 1e-12).length;
    if (count === 0 || count === 6 || equal === 0 && rng() < 0.5) continue;
    const tex = it => `${N} \\times ${it.map(([n, d]) => `\\dfrac{${n}}{${d}}`).join(' \\times ')}`;
    return {
      prompt: `Without working any of them out, decide how many of these products are ${want} than $${N}$: ${items.map(it => `$${tex(it)}$`).join(', ')}.`,
      ...numericAnswer(count),
      traps: traps(count, [
        { value: count + equal, why: `A product equal to $${N}$ is neither greater nor less than it.` },
        { value: 6 - count - equal, why: `That counts the products that are ${want === 'greater' ? 'less' : 'greater'} than $${N}$.` }
      ]),
      hints: [
        `Multiplying $${N}$ by a number greater than 1 makes it bigger; by a number less than 1 makes it smaller; by exactly 1 leaves it the same.`,
        'Where there are two fractions, combine them first: is their product more than 1, less than 1, or exactly 1?',
        'Count the products that fit.'
      ],
      steps: [
        ...items.map(it => { const v = prodOf(it); const f = frac(it.reduce((p, [n]) => p * n, 1), it.reduce((p, [, d]) => p * d, 1)); return { h: `$${tex(it)}$`, d: `multiplier $${fracTex(f.n, f.d)}$ is ${Math.abs(v - 1) < 1e-12 ? 'equal to' : v > 1 ? 'greater than' : 'less than'} 1` }; }),
        { h: 'Count', d: `$${count}$ products are ${want} than $${N}$.` }
      ]
    };
  }
  return magnitudeCount(makeRng(FALLBACK_SEED));
}

function smallestMultiplier(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const q = ri(rng, 3, 9), p = ri(rng, 1, q - 1), r = ri(rng, 3, 9);
    if (gcd(p, q) !== 1) continue;
    const name = rc(rng, IN_NAMES);
    const ask = rc(rng, ['smallest', 'greatest']);
    const bound = (q * r) / p;
    const answer = ask === 'smallest' ? Math.floor(bound) + 1 : Math.ceil(bound) - 1;
    if (answer < 2) continue;
    return {
      prompt: `${name} starts with a positive number, multiplies it by $\\dfrac{${p}}{${q}}$, and then multiplies the result by $\\dfrac{k}{${r}}$, where $k$ is a whole number. What is the ${ask} whole number $k$ for which the final answer is ${ask === 'smallest' ? 'greater' : 'less'} than the number ${name} started with?`,
      ...numericAnswer(answer),
      traps: traps(answer, [
        { value: ask === 'smallest' ? Math.ceil(bound) : Math.floor(bound), why: Number.isInteger(bound) ? `With $k = ${bound}$ the two multipliers make exactly 1, and the number stays the same — not ${ask === 'smallest' ? 'greater' : 'less'}.` : 'Check: the combined multiplier must be on the right side of 1.' },
        { value: r, why: `$\\dfrac{${r}}{${r}} = 1$, but the first multiplier has already made the number smaller.` }
      ]),
      hints: [
        'The two multiplications together multiply the number by one combined fraction.',
        `The final answer is ${ask === 'smallest' ? 'greater' : 'less'} than the start exactly when that combined fraction is ${ask === 'smallest' ? 'greater' : 'less'} than 1.`,
        'Try whole numbers for $k$ near where the combined fraction equals 1.'
      ],
      steps: [
        { h: 'Combined multiplier', d: `$\\dfrac{${p}}{${q}} \\times \\dfrac{k}{${r}} = \\dfrac{${p}k}{${q * r}}$` },
        { h: 'Condition', d: `$\\dfrac{${p}k}{${q * r}} ${ask === 'smallest' ? '>' : '<'} 1$ means $${p}k ${ask === 'smallest' ? '>' : '<'} ${q * r}$` },
        { h: 'Answer', d: `$k = ${answer}$ ($${p} \\times ${answer} = ${p * answer}$)` }
      ]
    };
  }
  return smallestMultiplier(makeRng(FALLBACK_SEED));
}

const fractionMagnitude = rng => (rng() < 0.55 ? magnitudeCount(rng) : smallestMultiplier(rng));

// dp 3 · A fraction of a fraction, in context.
const SPEND_ON = ['a story book', 'a cricket ball', 'a gift for Diwali', 'a school bag', 'a geometry box', 'art supplies', 'a pair of chappals'];
function remainderChain(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const q1 = ri(rng, 3, 6), p1 = ri(rng, 1, q1 - 1), q2 = ri(rng, 3, 7), p2 = ri(rng, 1, q2 - 1);
    if (gcd(p1, q1) !== 1 || gcd(p2, q2) !== 1) continue;
    const unit = q1 * q2 * ri(rng, 2, 12) * 5;
    const M = unit, after1 = M - (M * p1) / q1, left = after1 - (after1 * p2) / q2;
    if (!Number.isInteger(after1) || !Number.isInteger(left) || left <= 0) continue;
    const name = rc(rng, IN_NAMES);
    const [thing1, thing2] = pick(rng, SPEND_ON, 2);
    const wrongStart = left / (1 - p1 / q1 - p2 / q2);
    return {
      prompt: `${name} spent $\\dfrac{${p1}}{${q1}}$ of a sum of savings on ${thing1}, and then $\\dfrac{${p2}}{${q2}}$ of what was left on ${thing2}. After that, ₹$${left}$ of the savings was left. How much were the savings at the start?`,
      ...numericAnswer(M),
      answerPrefix: '₹',
      traps: traps(M, [
        ...(Number.isFinite(wrongStart) && wrongStart > 0 ? [{ value: wrongStart, why: `The second fraction is a fraction of what was LEFT, not of the whole savings.` }] : []),
        { value: after1, why: 'That is the amount after the first purchase.' }
      ]),
      hints: [
        'After the first purchase, what fraction of the savings is left?',
        `The second purchase takes $\\dfrac{${p2}}{${q2}}$ of THAT amount. What fraction of the savings is left now?`,
        `That fraction of the savings is ₹$${left}$. Work back to the whole.`
      ],
      steps: [
        { h: 'After the first purchase', d: `$1 - \\dfrac{${p1}}{${q1}} = \\dfrac{${q1 - p1}}{${q1}}$ of the savings is left` },
        { h: 'After the second purchase', d: `$\\dfrac{${q2 - p2}}{${q2}} \\times \\dfrac{${q1 - p1}}{${q1}} = ${fracTex((q2 - p2) * (q1 - p1), q1 * q2)}$ of the savings is left` },
        { h: 'Whole', d: `$${fracTex((q2 - p2) * (q1 - p1), q1 * q2)}$ of the savings $= ₹${left}$, so the savings were ₹$${M}$` }
      ]
    };
  }
  return remainderChain(makeRng(FALLBACK_SEED));
}

function classTrip(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const gb = rc(rng, [[2, 5], [3, 5], [3, 7], [4, 7], [4, 9], [5, 9], [1, 2], [5, 8], [3, 8]]);
    const fg = rc(rng, [[1, 2], [2, 3], [3, 4], [1, 3], [3, 5], [2, 5]]);
    const fb = rc(rng, [[1, 2], [2, 3], [1, 4], [1, 3], [3, 4], [2, 5], [4, 5]]);
    const N = gb[1] * fg[1] * fb[1] * ri(rng, 1, 4);
    const girls = (N * gb[0]) / gb[1], boys = N - girls;
    const gGo = (girls * fg[0]) / fg[1], bGo = (boys * fb[0]) / fb[1];
    if (![girls, boys, gGo, bGo].every(Number.isInteger) || N > 240 || N < 20) continue;
    const ask = rng() < 0.5 ? 'boys' : 'total';
    // The hints quote the girls' count, so it must never equal the answer.
    if (ask === 'boys' && bGo === gGo) continue;
    const answer = ask === 'boys' ? bGo : gGo + bGo;
    return {
      prompt: `In a school, $\\dfrac{${gb[0]}}{${gb[1]}}$ of the Class VII students are girls and the rest are boys. For a trip to a science museum, $\\dfrac{${fg[0]}}{${fg[1]}}$ of the girls and $\\dfrac{${fb[0]}}{${fb[1]}}$ of the boys signed up. If $${gGo}$ girls signed up, ${ask === 'boys' ? 'how many boys signed up' : 'how many students signed up altogether'}?`,
      ...numericAnswer(answer),
      traps: traps(answer, [
        { value: ask === 'boys' ? gGo : bGo, why: ask === 'boys' ? 'That is the number of girls who signed up.' : 'That counts only the boys.' },
        { value: (girls * fb[0]) / fb[1], why: `The fraction $\\dfrac{${fb[0]}}{${fb[1]}}$ is a fraction of the BOYS, not of the girls.` }
      ]),
      hints: [
        `$${gGo}$ is $\\dfrac{${fg[0]}}{${fg[1]}}$ of the girls. How many girls are there?`,
        `The girls are $\\dfrac{${gb[0]}}{${gb[1]}}$ of all the students. How many students are there, and so how many boys?`,
        `Take $\\dfrac{${fb[0]}}{${fb[1]}}$ of the boys.`
      ],
      steps: [
        { h: 'Girls', d: `$${gGo} \\div \\dfrac{${fg[0]}}{${fg[1]}} = ${girls}$ girls` },
        { h: 'All students', d: `$${girls} \\div \\dfrac{${gb[0]}}{${gb[1]}} = ${N}$, so $${boys}$ boys` },
        { h: 'Boys who signed up', d: `$\\dfrac{${fb[0]}}{${fb[1]}} \\times ${boys} = ${bGo}$${ask === 'total' ? `; altogether $${gGo} + ${bGo} = ${answer}$` : ''}` }
      ]
    };
  }
  return classTrip(makeRng(FALLBACK_SEED));
}

const fractionContext = rng => (rng() < 0.55 ? remainderChain(rng) : classTrip(rng));

/** One rung, D3: every other rung returns the same form (see the header). */
const d3 = form => (rng, _diff) => form(rng);

export const class7HardestFormsPart1 = Object.freeze({
  'c7-place-value-systems-reasoning': d3(placeValueSystems),
  'c7-rounding-bounds-reasoning': d3(roundingBounds),
  'c7-factor-regroup-reasoning': d3(factorRegroup),
  'c7-expression-comparison-reasoning': d3(expressionComparison),
  'c7-bracket-placement-reasoning': d3(bracketPlacement),
  'c7-property-rewrite-reasoning': d3(propertyRewrite),
  'c7-decimal-place-value-reasoning': d3(decimalPlaceValue),
  'c7-decimal-ordering-reasoning': d3(decimalOrderingForm),
  'c7-letter-pattern-reasoning': d3(letterPattern),
  'c7-expression-translation-reasoning': d3(expressionTranslation),
  'c7-formula-evaluation-reasoning': d3(formulaEvaluation),
  'c7-angle-pair-reasoning': d3(anglePairs),
  'c7-transversal-reasoning': d3(transversal),
  'c7-parity-reasoning': d3(parity),
  'c7-magic-square-reasoning': d3(magicSquare),
  'c7-cryptarithm-reasoning': d3(cryptarithm),
  'c7-angle-sum-reasoning': d3(angleSum),
  'c7-triangle-inequality-reasoning': d3(triangleInequality),
  'c7-triangle-construction-reasoning': d3(triangleConstruction),
  'c7-fraction-product-reasoning': d3(fractionProduct),
  'c7-fraction-magnitude-reasoning': d3(fractionMagnitude),
  'c7-fraction-context-reasoning': d3(fractionContext)
});

/** For the check: the cryptarithm patterns this bank draws from. */
export const CLASS7_CRYPT_PATTERNS_FOR_CHECK = Object.freeze([...CRYPT_PATTERNS]);
