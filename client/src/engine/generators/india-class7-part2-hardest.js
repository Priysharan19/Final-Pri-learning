// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · CBSE/NCERT Class VII — hardest-level (D3) forms, Part II
//
// The companion of india-class7-hardest.js (Part I). The CBSE track serves
// D1–D3, and in the Ganita Prakash Grade 7 Part II chapters the D3 rung was
// authored for one dot point only, so the picker could not offer the hardest
// level for the others (docs/release/evidence/india-difficulty-coverage.md).
// Each generator below authors exactly one rung — the D3 form for one dot
// point of NCERT Ganita Prakash Grade 7 Part II (2026–27) — and the coverage
// table (curriculum-in-hardest-covers.js) claims it at D3 and nowhere else.
//
// What makes these D3 rather than another D2 is the reasoning, not the size of
// the numbers. Each form needs two connected steps or a non-routine use of the
// chapter's idea: a congruence whose letters are written out of order, an
// isosceles triangle hidden inside another, the greatest product of three
// integers chosen from a list, a divisor that leaves three different
// remainders, a decimal product read off a whole-number product, a range that
// an unknown score can meet from either end, a ray made by bisecting twice,
// a chessboard colouring that decides a domino tiling, a balance kept level.
//
// Scope is the Grade 7 book and nothing beyond it: integers, terminating
// decimals, HCF and LCM, the mean and range, triangle congruence by SSS, SAS,
// ASA and RHS, ruler-and-compass constructions, and linear equations in one
// unknown. Contexts are Indian (rupees, IPL matches, Indian names and cities)
// where a context is used at all.
//
// Provenance. These are original, parameterised forms written for Pri
// Learning, aligned to the chapter intent of the 2026–27 Ganita Prakash Part II
// text. They are not transcribed from a textbook exercise or a past paper:
// every number is drawn from the seed and every keyed answer is computed from
// the parameters, never typed. client/test/india-hardest-forms-check.mjs
// re-derives each answer from the rendered prompt by a second route
// (client/test/support/india-hardest-class7-part2-solvers.mjs). None of this
// is a human maths review, and nothing here claims board approval.
//
// Asked for any rung other than D3, each generator returns its D3 form. No
// coverage entry claims these generators below or above D3, and the check
// fails if one ever does, so the label a student sees is always D3.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, gcd, makeRng } from '../qhelpers.js';
import { IN_NAMES, IN_CITIES } from './india-native-helpers.js';
import { FALLBACK_SEED, traps, dec, numericAnswer, pick, shuffled, paren } from './india-class7-hardest-kit.js';

const lcm2 = (a, b) => (a / gcd(a, b)) * b;
const deg = a => `${a}^\\circ`;

// ══ 1 · Geometric Twins ═════════════════════════════════════════════════════

const LETTER_SETS = ['ABC', 'DEF', 'PQR', 'LMN', 'XYZ', 'STU', 'GHK'];

// dp 0 · Matching corresponding parts when the congruence is written with its
// letters out of order, then one more step (angle sum, or a perimeter).
function congruentMatching(rng) {
  const [s1, s2] = pick(rng, LETTER_SETS, 2);
  const first = s1.split('');
  const second = shuffled(rng, s2.split(''));
  const corr = Object.fromEntries(first.map((v, i) => [v, second[i]]));
  const stmt = `$\\triangle ${first.join('')} \\cong \\triangle ${second.join('')}$`;
  if (rng() < 0.5) {
    // Angles: one angle given in each triangle; find a third in the first.
    const [i, j, k] = shuffled(rng, [0, 1, 2]);
    const a = ri(rng, 25, 95), b = ri(rng, 20, 150 - a);
    const answer = 180 - a - b;
    const otherOfJ = corr[first[j]];
    return {
      prompt: `${stmt}. In these triangles, $\\angle ${first[i]} = ${deg(a)}$ and $\\angle ${otherOfJ} = ${deg(b)}$. Find $\\angle ${first[k]}$ in degrees.`,
      ...numericAnswer(answer),
      traps: traps(answer, [
        { value: b, why: `$\\angle ${otherOfJ}$ matches $\\angle ${first[j]}$, not $\\angle ${first[k]}$ — read the letters in order.` },
        { value: 180 - a, why: 'The three angles of a triangle add to 180°, and two of them are known — subtract both.' }
      ]),
      hints: [
        'In a congruence statement, the letters in the same position match: first with first, second with second, third with third.',
        `Which angle of $\\triangle ${first.join('')}$ is equal to $\\angle ${otherOfJ}$?`,
        'Now two angles of the first triangle are known. Use the angle sum of a triangle.'
      ],
      steps: [
        { h: 'Match the vertices', d: first.map(v => `$${v} \\leftrightarrow ${corr[v]}$`).join(', ') },
        { h: 'Equal angle', d: `$\\angle ${first[j]} = \\angle ${otherOfJ} = ${deg(b)}$` },
        { h: 'Angle sum', d: `$\\angle ${first[k]} = 180^\\circ - ${deg(a)} - ${deg(b)} = ${deg(answer)}$` }
      ]
    };
  }
  // Sides: two sides of the first triangle and the perimeter of the second.
  const sides = [[0, 1], [1, 2], [2, 0]].map(([u, v]) => first[u] + first[v]);
  const ask = rc(rng, [0, 1, 2]);
  const known = [0, 1, 2].filter(x => x !== ask);
  const len = [ri(rng, 4, 19), ri(rng, 4, 19), ri(rng, 4, 19)];
  const [x, y] = known.map(t => len[t]);
  const target = len[ask];
  if (target >= x + y || x >= y + target || y >= x + target) return congruentMatching(rng);
  const P = len[0] + len[1] + len[2];
  const askName = sides[ask].split('').map(v => corr[v]).join('');
  return {
    prompt: `${stmt}. In $\\triangle ${first.join('')}$, $${sides[known[0]]} = ${x}$ cm and $${sides[known[1]]} = ${y}$ cm. The perimeter of $\\triangle ${second.join('')}$ is $${P}$ cm. Find the length of $${askName}$ in cm.`,
    ...numericAnswer(target, 0, 'cm'),
    traps: traps(target, [
      { value: P - x, why: 'Both known sides must be taken away from the perimeter.' },
      { value: x, why: `Match the letters of $${askName}$ with the first triangle before choosing a side.` }
    ]),
    hints: [
      'Congruent triangles have the same perimeter.',
      `Which side of $\\triangle ${first.join('')}$ matches $${askName}$? Read the letters position by position.`,
      'Perimeter minus the two known sides gives the third side.'
    ],
    steps: [
      { h: 'Match the vertices', d: first.map(v => `$${v} \\leftrightarrow ${corr[v]}$`).join(', ') },
      { h: 'Matching side', d: `$${askName} = ${sides[ask]}$, and both triangles have perimeter $${P}$ cm` },
      { h: 'Subtract', d: `$${sides[ask]} = ${P} - ${x} - ${y} = ${target}$ cm` }
    ]
  };
}

// dp 1 · SSS in a kite: AB = AD and CB = CD give ΔABC ≅ ΔADC, so AC bisects
// both end angles and ∠ABC = ∠ADC.
function sssKite(rng) {
  const a = 2 * ri(rng, 20, 75), c = 2 * ri(rng, 15, 70);
  if (a + c > 300 || a === c) return sssKite(rng);
  const ask = rc(rng, ['ABC', 'BCA', 'BAC']);
  const answer = ask === 'ABC' ? (360 - a - c) / 2 : ask === 'BCA' ? c / 2 : a / 2;
  return {
    prompt: `In quadrilateral $ABCD$, $AB = AD$ and $CB = CD$. The diagonal $AC$ is drawn. $\\angle BAD = ${deg(a)}$ and $\\angle BCD = ${deg(c)}$. Find $\\angle ${ask}$ in degrees.`,
    ...numericAnswer(answer),
    traps: traps(answer, [
      { value: 360 - a - c, why: `That is $\\angle ABC + \\angle ADC$. The two angles are equal, so each is half of it.` },
      { value: ask === 'BAC' ? a : c, why: 'The diagonal splits that angle into two equal parts.' }
    ]),
    hints: [
      'Compare triangles $ABC$ and $ADC$: which three pairs of sides are equal?',
      'Congruent triangles have equal corresponding angles. What does that say about the angles at $A$, at $C$, and at $B$ and $D$?',
      'The angles of a quadrilateral add up to 360°.'
    ],
    steps: [
      { h: 'Congruence', d: '$AB = AD$, $CB = CD$, $AC$ common, so $\\triangle ABC \\cong \\triangle ADC$ (SSS).' },
      { h: 'Equal parts', d: `$\\angle BAC = \\angle DAC = ${deg(a / 2)}$, $\\angle BCA = \\angle DCA = ${deg(c / 2)}$, $\\angle ABC = \\angle ADC$` },
      { h: 'Answer', d: ask === 'ABC' ? `$\\angle ABC = (360^\\circ - ${deg(a)} - ${deg(c)}) \\div 2 = ${deg(answer)}$` : `$\\angle ${ask} = ${deg(answer)}$` }
    ]
  };
}

// dp 3 · An isosceles triangle with a second isosceles triangle inside it.
function nestedIsosceles(rng) {
  const a = 2 * ri(rng, 6, 28);              // apex angle, < 60
  const base = (180 - a) / 2;
  const ask = rc(rng, ['ABD', 'ADB', 'DBC']);
  const answer = { ABD: base - a, ADB: 180 - base, DBC: a }[ask];
  return {
    prompt: `In $\\triangle ABC$, $AB = AC$ and $\\angle BAC = ${deg(a)}$. A point $D$ is marked on side $AC$ so that $BD = BC$. Find $\\angle ${ask}$ in degrees.`,
    ...numericAnswer(answer),
    traps: traps(answer, [
      { value: base, why: 'That is a base angle of $\\triangle ABC$. The question asks for a different angle.' },
      { value: 180 - 2 * base, why: 'Check which triangle each angle belongs to.' }
    ]),
    hints: [
      'Since $AB = AC$, the angles opposite these sides are equal. Find $\\angle ABC$ and $\\angle ACB$.',
      'Since $BD = BC$, triangle $BDC$ is isosceles too: $\\angle BDC = \\angle BCD$.',
      'Use the angle sum in $\\triangle BDC$, then the angles on a straight line or at $B$.'
    ],
    steps: [
      { h: 'Base angles of ABC', d: `$\\angle ABC = \\angle ACB = (180^\\circ - ${deg(a)}) \\div 2 = ${deg(base)}$` },
      { h: 'Triangle BDC', d: `$\\angle BDC = \\angle BCD = ${deg(base)}$, so $\\angle DBC = 180^\\circ - 2 \\times ${deg(base)} = ${deg(a)}$` },
      { h: 'Answer', d: ask === 'ABD' ? `$\\angle ABD = ${deg(base)} - ${deg(a)} = ${deg(answer)}$` : ask === 'ADB' ? `$\\angle ADB = 180^\\circ - ${deg(base)} = ${deg(answer)}$` : `$\\angle DBC = ${deg(answer)}$` }
    ]
  };
}

// ══ 2 · Operations with Integers ════════════════════════════════════════════

// dp 0 · The greatest or smallest product of three integers chosen from a list.
function productSign(rng) {
  for (let guard = 0; guard < 200; guard++) {
    const n = ri(rng, 6, 7);
    const pool = [];
    for (let v = -12; v <= 12; v++) if (v !== 0) pool.push(v);
    const s = pick(rng, pool, n).sort((x, y) => x - y);
    const negs = s.filter(v => v < 0).length;
    if (negs < 2 || negs > n - 2) continue;
    const L = s.length;
    const ask = rng() < 0.5 ? 'greatest' : 'smallest';
    const c1 = ask === 'greatest' ? s[L - 1] * s[L - 2] * s[L - 3] : s[0] * s[1] * s[2];
    const c2 = ask === 'greatest' ? s[0] * s[1] * s[L - 1] : s[0] * s[L - 1] * s[L - 2];
    if (c1 === c2) continue;
    const answer = ask === 'greatest' ? Math.max(c1, c2) : Math.min(c1, c2);
    const wrong = ask === 'greatest' ? Math.min(c1, c2) : Math.max(c1, c2);
    return {
      prompt: `Three different numbers are chosen from the list $${s.join(',\\ ')}$ and multiplied together. What is the ${ask} product that can be made?`,
      ...numericAnswer(answer),
      traps: traps(answer, [
        { value: wrong, why: 'Compare both ways of choosing: two negatives make a positive.' },
        { value: -answer, why: 'Count the negative factors: an even number of them gives a positive product, an odd number a negative one.' }
      ]),
      hints: [
        'The sign of a product depends on how many negative factors it has.',
        ask === 'greatest' ? 'For a large positive product, use either three large positives, or two negatives with large size and the largest positive.' : 'For the most negative product, use an odd number of negatives — one or three — with sizes as large as possible.',
        'Work out each candidate and compare.'
      ],
      steps: [
        { h: 'Candidates', d: ask === 'greatest' ? `$${paren(s[L - 1])} \\times ${paren(s[L - 2])} \\times ${paren(s[L - 3])} = ${c1}$; $${paren(s[0])} \\times ${paren(s[1])} \\times ${paren(s[L - 1])} = ${c2}$` : `$${paren(s[0])} \\times ${paren(s[1])} \\times ${paren(s[2])} = ${c1}$; $${paren(s[0])} \\times ${paren(s[L - 1])} \\times ${paren(s[L - 2])} = ${c2}$` },
        { h: 'Compare', d: `The ${ask} of these is $${answer}$.` },
        { h: 'Answer', d: `$${answer}$` }
      ]
    };
  }
  return productSign(makeRng(FALLBACK_SEED));
}

// dp 1 · Division with signs, used twice.
/** A time from 6 p.m. on, in 24-hour form: "9 p.m.", "midnight", "3 a.m. the next day". */
const eveningClock = H => (H < 24 ? `${H - 12} p.m.` : H === 24 ? 'midnight' : `${H - 24} a.m. the next day`);
function integerDivision(rng) {
  const city = rc(rng, ['Dras', 'Leh', 'Kargil', 'Gulmarg', 'Tawang', 'Kibithu']);
  if (rng() < 0.55) {
    const h = ri(rng, 3, 9), rate = -ri(rng, 2, 6);
    const T1 = ri(rng, -6, 8);
    const T2 = T1 + rate * h;
    const k = ri(rng, h + 2, h + 8);
    const answer = T1 + rate * k;
    return {
      prompt: `On a winter evening in ${city}, the temperature at 6 p.m. was $${T1}^\\circ$C, and at ${eveningClock(18 + h)} it was $${T2}^\\circ$C. It fell by the same number of degrees every hour, and kept falling at that rate. What was the temperature, in °C, $${k}$ hours after 6 p.m.?`,
      ...numericAnswer(answer, 0, '°C'),
      traps: traps(answer, [
        { value: T1 - rate * k, why: 'The temperature is falling, so the change per hour is negative.' },
        { value: rate * k, why: 'Add the change to the starting temperature.' }
      ]),
      hints: [
        'Find the total change in temperature, then divide it by the number of hours to get the change per hour.',
        'A fall is a negative change: a negative number divided by a positive number is negative.',
        'Multiply the change per hour by the number of hours asked about, and add it to the starting temperature.'
      ],
      steps: [
        { h: 'Total change', d: `$${T2} - ${paren(T1)} = ${T2 - T1}$ over $${h}$ hours` },
        { h: 'Change per hour', d: `$${T2 - T1} \\div ${h} = ${rate}$` },
        { h: 'After the given hours', d: `$${T1} + ${k} \\times ${paren(rate)} = ${answer}$` }
      ]
    };
  }
  const a = ri(rng, 3, 12) * (rng() < 0.5 ? -1 : 1), q = ri(rng, 4, 25) * (rng() < 0.5 ? -1 : 1);
  const x = a * q;
  const divs = [];
  for (let d = 2; d <= Math.abs(x); d++) if (x % d === 0 && d !== Math.abs(a)) divs.push(d);
  if (!divs.length) return integerDivision(rng);
  const b = rc(rng, divs) * (rng() < 0.5 ? -1 : 1);
  const answer = x / b;
  return {
    prompt: `When a number is divided by $${paren(a)}$, the answer is $${paren(q)}$. What is the answer when the same number is divided by $${paren(b)}$?`,
    ...numericAnswer(answer),
    traps: traps(answer, [
      { value: -answer, why: 'Check the sign at each step: same signs give a positive quotient, different signs a negative one.' },
      { value: x, why: 'That is the number itself. Now divide it.' }
    ]),
    hints: [
      'Division undoes multiplication: the number is the divisor times the quotient.',
      'Find the number, taking care with the sign.',
      'Divide it by the new divisor, using the sign rules again.'
    ],
    steps: [
      { h: 'The number', d: `$${paren(a)} \\times ${paren(q)} = ${x}$` },
      { h: 'Divide', d: `$${paren(x)} \\div ${paren(b)} = ${answer}$` },
      { h: 'Answer', d: `$${answer}$` }
    ]
  };
}

// dp 3 · A missing integer in a multi-operation expression.
function integerExpression(rng) {
  for (let guard = 0; guard < 200; guard++) {
    const a = ri(rng, 2, 9) * (rng() < 0.6 ? -1 : 1);
    const m = ri(rng, 2, 15) * (rng() < 0.5 ? -1 : 1);
    const c = ri(rng, 2, 8) * (rng() < 0.5 ? -1 : 1);
    const q = ri(rng, 2, 9) * (rng() < 0.5 ? -1 : 1);
    const b = c * q;
    const op = rng() < 0.5 ? '-' : '+';
    const R = op === '-' ? a * m - b / c : a * m + b / c;
    if (Math.abs(R) > 150) continue;
    return {
      prompt: `Find the integer that goes in the box: $${paren(a)} \\times \\square ${op} ${paren(b)} \\div ${paren(c)} = ${R}$.`,
      ...numericAnswer(m),
      traps: traps(m, [
        { value: -m, why: 'Check the signs: a negative times a negative is positive.' },
        { value: op === '-' ? (R - b / c) / a : (R + b / c) / a, why: 'Undo the addition or subtraction the right way round: move it to the other side with the opposite operation.' }
      ]),
      hints: [
        'Division and multiplication are done before addition and subtraction. Work out the division part first.',
        'What must the product with the box be, so that the whole expression has the given value?',
        'Divide that product by the number in front of the box, using the sign rules.'
      ],
      steps: [
        { h: 'Division first', d: `$${paren(b)} \\div ${paren(c)} = ${q}$` },
        { h: 'The product', d: `$${paren(a)} \\times \\square = ${R} ${op === '-' ? '+' : '-'} ${paren(q)} = ${a * m}$` },
        { h: 'The box', d: `$\\square = ${a * m} \\div ${paren(a)} = ${m}$` }
      ]
    };
  }
  return integerExpression(makeRng(FALLBACK_SEED));
}

// ══ 3 · Finding Common Ground ═══════════════════════════════════════════════

// dp 0 · The largest divisor that leaves given remainders.
function hcfRemainders(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const h = ri(rng, 9, 48);
    const ks = pick(rng, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13], 3);
    if (gcd(gcd(ks[0], ks[1]), ks[2]) !== 1) continue;
    const rs = [ri(rng, 1, h - 1), ri(rng, 1, h - 1), ri(rng, 1, h - 1)];
    if (new Set(rs).size < 2) continue;
    const N = ks.map((k, i) => h * k + rs[i]);
    const answer = gcd(gcd(N[0] - rs[0], N[1] - rs[1]), N[2] - rs[2]);
    if (answer <= Math.max(...rs)) continue;
    return {
      prompt: `Find the largest number that divides $${N[0]}$, $${N[1]}$ and $${N[2]}$ leaving remainders $${rs[0]}$, $${rs[1]}$ and $${rs[2]}$ respectively.`,
      ...numericAnswer(answer),
      traps: traps(answer, [
        { value: gcd(gcd(N[0], N[1]), N[2]), why: 'Take away the remainders first: the divisor divides each number minus its remainder exactly.' }
      ]),
      hints: [
        'If a number leaves a remainder when it divides another, it divides exactly what is left after taking the remainder away.',
        'Subtract each remainder from its own number.',
        'The largest number dividing all three results is their HCF. Check it is bigger than every remainder.'
      ],
      steps: [
        { h: 'Remove the remainders', d: `$${N[0]} - ${rs[0]} = ${N[0] - rs[0]}$, $${N[1]} - ${rs[1]} = ${N[1] - rs[1]}$, $${N[2]} - ${rs[2]} = ${N[2] - rs[2]}$` },
        { h: 'HCF', d: `HCF$(${N[0] - rs[0]}, ${N[1] - rs[1]}, ${N[2] - rs[2]}) = ${answer}$` },
        { h: 'Check', d: `$${answer}$ is greater than each remainder, so the remainders are possible. Answer: $${answer}$` }
      ]
    };
  }
  return hcfRemainders(makeRng(FALLBACK_SEED));
}

// dp 1 · LCM with a twist: a common remainder, or the smallest 4-digit multiple.
function lcmTwist(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const t = pick(rng, [4, 6, 8, 9, 10, 12, 14, 15, 16, 18, 20, 21, 24, 25], 3).sort((x, y) => x - y);
    const L = lcm2(lcm2(t[0], t[1]), t[2]);
    if (L < 60 || L > 900) continue;
    if (rng() < 0.5) {
      const r = ri(rng, 1, t[0] - 1);
      const answer = L + r;
      return {
        prompt: `Find the smallest number greater than $${r}$ that leaves a remainder of $${r}$ when divided by each of $${t[0]}$, $${t[1]}$ and $${t[2]}$.`,
        ...numericAnswer(answer),
        traps: traps(answer, [
          { value: t[0] * t[1] * t[2] + r, why: 'The product is a common multiple, but not always the least one.' },
          { value: L, why: 'That leaves no remainder. Add the remainder.' }
        ]),
        hints: [
          'Take the remainder away from the number: what is left is divisible by all three divisors.',
          'The smallest such positive number is the LCM of the divisors.',
          'Add the remainder back.'
        ],
        steps: [
          { h: 'LCM', d: `LCM$(${t[0]}, ${t[1]}, ${t[2]}) = ${L}$` },
          { h: 'Add the remainder', d: `$${L} + ${r} = ${answer}$` },
          { h: 'Check', d: `$${answer}$ divided by each of $${t.join(', ')}$ leaves $${r}$.` }
        ]
      };
    }
    const big = rng() < 0.5;
    const answer = big ? Math.floor(9999 / L) * L : Math.ceil(1000 / L) * L;
    return {
      prompt: `Find the ${big ? 'greatest' : 'smallest'} 4-digit number that is exactly divisible by each of $${t[0]}$, $${t[1]}$ and $${t[2]}$.`,
      ...numericAnswer(answer),
      traps: traps(answer, [
        { value: big ? Math.floor(9999 / (t[0] * t[1] * t[2])) * t[0] * t[1] * t[2] : Math.ceil(1000 / (t[0] * t[1] * t[2])) * t[0] * t[1] * t[2], why: 'Use the LCM, not the product: the product is not the least common multiple here.' }
      ]),
      hints: [
        'A number divisible by all three is a multiple of their LCM.',
        'Find the LCM using prime factors.',
        big ? 'Divide the greatest 4-digit number by the LCM and take away the remainder.' : 'Find the first multiple of the LCM that reaches four digits.'
      ],
      steps: [
        { h: 'LCM', d: `LCM$(${t[0]}, ${t[1]}, ${t[2]}) = ${L}$` },
        { h: 'Multiples', d: big ? `$9999 = ${L} \\times ${Math.floor(9999 / L)} + ${9999 % L}$` : `$${L} \\times ${Math.ceil(1000 / L) - 1} = ${L * (Math.ceil(1000 / L) - 1)}$ has 3 digits; the next multiple is $${answer}$` },
        { h: 'Answer', d: `$${answer}$` }
      ]
    };
  }
  return lcmTwist(makeRng(FALLBACK_SEED));
}

// dp 3 · Choosing HCF or LCM: tiles for a floor, or bells ringing together.
function hcfLcmContext(rng) {
  const name = rc(rng, IN_NAMES), city = rc(rng, IN_CITIES);
  if (rng() < 0.5) {
    for (let guard = 0; guard < 400; guard++) {
      const s = rc(rng, [15, 18, 20, 24, 25, 30, 36, 40, 45, 48, 60]);
      const p = ri(rng, 7, 40), q = ri(rng, 5, 30);
      if (gcd(p, q) !== 1 || p === q) continue;
      const Lc = s * p, Wc = s * q;
      if (Lc > 1500 || Wc > 1500) continue;
      const answer = p * q;
      return {
        prompt: `A hall in ${city} has a rectangular floor $${Lc}$ cm long and $${Wc}$ cm wide. ${name} wants to cover it with square tiles, all the same size, without cutting any tile. The tiles must be as large as possible. How many tiles are needed?`,
        ...numericAnswer(answer),
        traps: traps(answer, [
          { value: s, why: 'That is the side of each tile in cm. The question asks how many tiles.' },
          { value: (Lc * Wc) / lcm2(Lc, Wc), why: 'The tile side must divide both lengths: use the HCF, not the LCM.' }
        ]),
        hints: [
          'The side of a tile must divide both the length and the width exactly. Is that a common factor or a common multiple?',
          'The largest such side is the HCF of the two lengths.',
          'Count the tiles along the length and along the width, and multiply.'
        ],
        steps: [
          { h: 'Largest tile', d: `HCF$(${Lc}, ${Wc}) = ${s}$ cm` },
          { h: 'Tiles in each direction', d: `$${Lc} \\div ${s} = ${p}$ along, $${Wc} \\div ${s} = ${q}$ across` },
          { h: 'Total', d: `$${p} \\times ${q} = ${answer}$ tiles` }
        ]
      };
    }
  }
  for (let guard = 0; guard < 400; guard++) {
    const t = pick(rng, [6, 8, 9, 10, 12, 15, 16, 18, 20, 24, 25, 30], 3).sort((x, y) => x - y);
    const L = lcm2(lcm2(t[0], t[1]), t[2]);
    if (L < 30 || L > 180) continue;
    const startH = ri(rng, 6, 9);
    const hours = ri(rng, 3, 8);
    const answer = Math.floor((hours * 60) / L);
    if (answer < 2) continue;
    const endH = startH + hours;
    const clock = h => (h < 12 ? `${h} a.m.` : h === 12 ? 'noon' : `${h - 12} p.m.`);
    return {
      prompt: `Three bells at a temple in ${city} ring every $${t[0]}$, $${t[1]}$ and $${t[2]}$ minutes. At ${clock(startH)} they ring together. How many more times do they ring together after that, up to and including ${clock(endH)}?`,
      ...numericAnswer(answer),
      traps: traps(answer, [
        { value: answer + 1, why: `The ring at ${clock(startH)} itself is not counted — the question asks how many more times.` },
        { value: Math.floor((hours * 60) / (t[0] * t[1] * t[2])), why: 'They ring together every LCM minutes, which is not always the product.' }
      ]),
      hints: [
        'The bells ring together again after a time that is a multiple of each interval. Which is the smallest such time?',
        'Find the LCM of the three intervals.',
        'Count how many of these gaps fit into the time from the start to the end.'
      ],
      steps: [
        { h: 'Together every', d: `LCM$(${t[0]}, ${t[1]}, ${t[2]}) = ${L}$ minutes` },
        { h: 'Time available', d: `From ${clock(startH)} to ${clock(endH)} is $${hours * 60}$ minutes` },
        { h: 'Count', d: `$${hours * 60} \\div ${L}$ gives $${answer}$ whole gaps, so they ring together $${answer}$ more times.` }
      ]
    };
  }
  return hcfLcmContext(makeRng(FALLBACK_SEED));
}

// ══ 4 · Another Peek Beyond the Point ═══════════════════════════════════════

/** The number of decimal places written in a decimal string. */
const placesOf = s => (s.includes('.') ? s.split('.')[1].length : 0);

// dp 0 · A decimal product read off a whole-number product, or a missing factor.
function decimalMultiplication(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const A = ri(rng, 12, 999), B = ri(rng, 13, 99);
    if (A % 10 === 0 || B % 10 === 0) continue;
    const P = A * B;
    const pa = ri(rng, 1, 3), pb = ri(rng, 0, 3);
    if (pa + pb > 4 || pa + pb < 2) continue;
    const a = dec(A, pa), b = dec(B, pb);
    if (placesOf(a) !== pa || placesOf(b) !== pb) continue;
    const prodTxt = dec(P, pa + pb);
    if (rng() < 0.5) {
      return {
        prompt: `Given that $${A} \\times ${B} = ${P}$, find $${a} \\times ${b}$ without multiplying again.`,
        ...numericAnswer(P, pa + pb),
        traps: traps(Number(prodTxt), [
          { value: Number(dec(P, pa + pb - 1)), why: 'Count the decimal places in BOTH factors and add them.' },
          { value: Number(dec(P, pa + pb + 1)), why: 'The product has as many decimal places as the two factors together — no more.' }
        ]),
        hints: [
          'Each factor is the whole number divided by 10, 100 or 1000.',
          'Count the decimal places in each factor and add them.',
          'The product has that many decimal places; the digits come from the given product.'
        ],
        steps: [
          { h: 'Decimal places', d: `$${a}$ has $${pa}$, $${b}$ has $${pb}$: together $${pa + pb}$` },
          { h: 'Place the point', d: `Write $${P}$ with $${pa + pb}$ decimal places.` },
          { h: 'Answer', d: `$${a} \\times ${b} = ${prodTxt}$` }
        ]
      };
    }
    if (placesOf(prodTxt) > 3 || placesOf(prodTxt) !== pa + pb) continue;
    return {
      prompt: `Given that $${A} \\times ${B} = ${P}$, find the number that goes in the box: $${a} \\times \\square = ${prodTxt}$.`,
      ...numericAnswer(B, pb),
      traps: traps(Number(b), [
        { value: B, why: 'The decimal places matter: count how many the product has, and how many the first factor has.' },
        { value: Number(dec(B, pb + 1)), why: 'The product has as many decimal places as the two factors together.' }
      ]),
      hints: [
        'The digits of the missing factor come from the given whole-number fact.',
        'The number of decimal places in a product is the total in the two factors.',
        'Take the decimal places of the first factor away from those of the product.'
      ],
      steps: [
        { h: 'Places in the product', d: `$${prodTxt}$ has $${placesOf(prodTxt)}$ decimal places, $${a}$ has $${pa}$` },
        { h: 'Places in the box', d: `$${placesOf(prodTxt)} - ${pa} = ${pb}$` },
        { h: 'Answer', d: `$\\square = ${b}$` }
      ]
    };
  }
  return decimalMultiplication(makeRng(FALLBACK_SEED));
}

// dp 1 · A decimal quotient read off a whole-number division.
function decimalDivision(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const D = ri(rng, 12, 96), Q = ri(rng, 13, 99);
    if (D % 10 === 0 || Q % 10 === 0) continue;
    const N = D * Q;
    const pn = ri(rng, 0, 3), pd = ri(rng, 0, 3);
    if (pn === pd) continue;
    const n = dec(N, pn), d = dec(D, pd);
    if (placesOf(n) !== pn || placesOf(d) !== pd) continue;
    // n / d = (N / D) * 10^(pd - pn)
    const shift = pd - pn;
    const qUnits = shift >= 0 ? Q * 10 ** shift : Q;
    const qPlaces = shift >= 0 ? 0 : -shift;
    if (qPlaces > 3) continue;
    const answer = Number(dec(qUnits, qPlaces));
    return {
      prompt: `Given that $${N} \\div ${D} = ${Q}$, find $${n} \\div ${d}$.`,
      ...numericAnswer(qUnits, qPlaces),
      traps: traps(answer, [
        { value: Q, why: 'Moving the decimal point in the dividend or divisor changes the quotient.' },
        { value: Number(dec(Q * 10 ** Math.max(0, -shift), Math.max(0, shift))), why: 'Dividing by a smaller number gives a bigger answer — check which way the point moves.' }
      ]),
      hints: [
        'Multiplying the divisor and the dividend by the same power of 10 does not change the quotient.',
        'Make the divisor a whole number first.',
        'Compare the new dividend with the whole-number fact you are given.'
      ],
      steps: [
        { h: 'Clear the divisor', d: `Multiply both by $${10 ** pd}$: $${n} \\div ${d} = ${dec(N * 10 ** pd, pn)} \\div ${D}$` },
        { h: 'Compare', d: `$${N} \\div ${D} = ${Q}$, and the dividend is ${shift >= 0 ? `$${10 ** shift}$ times` : `$\\dfrac{1}{${10 ** -shift}}$ of`} $${N}$` },
        { h: 'Answer', d: `$${dec(qUnits, qPlaces)}$` }
      ]
    };
  }
  return decimalDivision(makeRng(FALLBACK_SEED));
}

// dp 3 · Petrol for a journey: divide to find litres, multiply to find cost.
function decimalContext(rng) {
  const name = rc(rng, IN_NAMES);
  for (let guard = 0; guard < 400; guard++) {
    const Lt = ri(rng, 41, 399);           // litres in tenths
    const Mt = ri(rng, 121, 249);          // km per litre in tenths
    const Pt = ri(rng, 941, 1089);         // ₹ per litre in tenths (₹94.1 – ₹108.9)
    if (Lt % 10 === 0 || Mt % 10 === 0) continue;
    const Dh = Lt * Mt;                    // distance in hundredths of a km
    if (Dh % 10 === 0) continue;
    const Ch = Lt * Pt;                    // cost in paise (hundredths of ₹)
    const [c1, c2] = pick(rng, IN_CITIES, 2);
    return {
      prompt: `${name}'s family drove from ${c1} to ${c2}, a distance of $${dec(Dh, 2)}$ km. Their car runs $${dec(Mt, 1)}$ km on one litre of petrol, and petrol costs ₹$${dec(Pt, 1)}$ per litre. How much did the petrol for the journey cost, in rupees?`,
      ...numericAnswer(Ch, 2, 'rupees'),
      traps: traps(Ch / 100, [
        { value: Number(dec(Lt, 1)), why: 'That is the number of litres. Now find the cost.' },
        { value: Number(((Dh / 100) * (Pt / 10)).toFixed(2)), why: 'Multiply the cost of one litre by the number of litres, not by the number of kilometres.' }
      ]),
      hints: [
        'First find how many litres of petrol the journey needs.',
        'Divide the distance by the kilometres the car runs on one litre: make the divisor a whole number first.',
        'Multiply the number of litres by the price of one litre.'
      ],
      steps: [
        { h: 'Litres', d: `$${dec(Dh, 2)} \\div ${dec(Mt, 1)} = ${dec(Dh * 10, 2)} \\div ${Mt} = ${dec(Lt, 1)}$ litres` },
        { h: 'Cost', d: `$${dec(Lt, 1)} \\times ${dec(Pt, 1)} = ${dec(Ch, 2)}$` },
        { h: 'Answer', d: `₹$${dec(Ch, 2)}$` }
      ]
    };
  }
  return decimalContext(makeRng(FALLBACK_SEED));
}

// ══ 5 · Connecting the Dots ═════════════════════════════════════════════════

const STAT_QS = [
  'How many hours of sleep do the students of Class VII get on a school night?',
  'How long does each student in our class take to travel to school?',
  'How many runs did the batters in last season’s IPL usually score in a match?',
  'What are the heights of the players in the school kabaddi team?',
  'How much pocket money do the students in our school get each week?',
  'How many books did each family in our building read last month?',
  'What was the highest temperature on each day of May in our city?',
  'How many siblings do the students in Class VII have?',
  'How many glasses of water do my classmates drink in a day?',
  'How many minutes do the students of our school spend on homework each evening?'
];
const FIXED_QS = [
  'How tall is the Qutub Minar?',
  'How many days are there in March?',
  'What is the capital of Karnataka?',
  'How many players are there in a cricket team on the field?',
  'In which year did India become a republic?',
  'How many sides does a hexagon have?',
  'How far is it from my house to my school?',
  'What is my roll number in class?',
  'How many states share a border with Telangana?',
  'What was the score of India in yesterday’s match?'
];

// dp 0 · Counting the statistical questions among five.
function statisticalQuestion(rng) {
  const k = ri(rng, 1, 4);
  const items = shuffled(rng, [...pick(rng, STAT_QS, k).map(t => ({ t, s: true })), ...pick(rng, FIXED_QS, 5 - k).map(t => ({ t, s: false }))]);
  const name = rc(rng, IN_NAMES), city = rc(rng, IN_CITIES);
  return {
    prompt: `${name}, a student in ${city}, wrote down five questions: (1) ${items[0].t} (2) ${items[1].t} (3) ${items[2].t} (4) ${items[3].t} (5) ${items[4].t} How many of the five are statistical questions?`,
    ...numericAnswer(k),
    traps: traps(k, [
      { value: 5 - k, why: 'That counts the questions with a single fixed answer.' },
      { value: 5, why: 'A question with one fixed answer, which nobody needs to collect data for, is not a statistical question.' }
    ]),
    hints: [
      'A statistical question expects answers that vary, so data has to be collected from many people, days or things.',
      'A question with a single fixed answer is not statistical, even if it contains a number.',
      'Decide for each question in turn, then count.'
    ],
    steps: [
      { h: 'Statistical', d: items.map((it, i) => (it.s ? `(${i + 1})` : '')).filter(Boolean).join(', ') + ' — the answers vary across a group.' },
      { h: 'Not statistical', d: items.map((it, i) => (it.s ? '' : `(${i + 1})`)).filter(Boolean).join(', ') + ' — each has one fixed answer.' },
      { h: 'Count', d: `$${k}$ statistical questions` }
    ]
  };
}

// dp 1 · The mean when a value was misread, or the score needed to reach a mean.
function meanReasoning(rng) {
  const name = rc(rng, IN_NAMES);
  if (rng() < 0.5) {
    for (let guard = 0; guard < 400; guard++) {
      const n = rc(rng, [4, 5, 8, 10, 20, 25]);
      const m = ri(rng, 25, 80);
      const w = ri(rng, 10, 99), c = ri(rng, 10, 99);
      if (w === c) continue;
      const total = n * m - w + c;
      if ((total * 100) % n !== 0) continue;
      const units = (total * 100) / n;
      return {
        prompt: `The mean of the marks of $${n}$ students in a test was worked out as $${m}$. Later it was found that one student's mark had been copied as $${w}$ instead of $${c}$. What is the correct mean?`,
        ...numericAnswer(units, 2),
        traps: traps(units / 100, [
          { value: m - w + c, why: 'The error changes the TOTAL; share that change among all the students.' },
          { value: (n * m + w - c) / n, why: 'Take the wrong mark out and put the right mark in — not the other way round.' }
        ]),
        hints: [
          'The mean times the number of students gives the total of the marks.',
          'Correct the total: remove the wrongly copied mark and add the right one.',
          'Divide the corrected total by the number of students.'
        ],
        steps: [
          { h: 'Wrong total', d: `$${n} \\times ${m} = ${n * m}$` },
          { h: 'Correct total', d: `$${n * m} - ${w} + ${c} = ${total}$` },
          { h: 'Correct mean', d: `$${total} \\div ${n} = ${dec(units, 2)}$` }
        ]
      };
    }
  }
  const n = ri(rng, 4, 12), m = ri(rng, 22, 55), up = ri(rng, 2, 6);
  const answer = (n + 1) * (m + up) - n * m;
  return {
    prompt: `In the IPL season so far, ${name} has scored a mean of $${m}$ runs in $${n}$ innings. How many runs must ${name} score in the next innings to raise the mean to $${m + up}$?`,
    ...numericAnswer(answer, 0, 'runs'),
    traps: traps(answer, [
      { value: m + up, why: 'Scoring exactly the new mean would leave the mean of the earlier innings unchanged; the extra runs must lift every innings.' },
      { value: m + up * n, why: 'After the next innings there are one more innings to share the total among.' }
    ]),
    hints: [
      'Find the total runs so far from the mean.',
      'Find the total needed after one more innings for the new mean.',
      'The runs needed are the difference between the two totals.'
    ],
    steps: [
      { h: 'Runs so far', d: `$${n} \\times ${m} = ${n * m}$` },
      { h: 'Runs needed in all', d: `$${n + 1} \\times ${m + up} = ${(n + 1) * (m + up)}$` },
      { h: 'Next innings', d: `$${(n + 1) * (m + up)} - ${n * m} = ${answer}$ runs` }
    ]
  };
}

// dp 3 · An unknown score that can set the range from either end.
function rangeDisplay(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const k = ri(rng, 5, 7);
    const vals = Array.from({ length: k }, () => ri(rng, 25, 75));
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const extra = ri(rng, 3, 20);
    const R = hi - lo + extra;
    const x1 = lo + R, x2 = hi - R;
    if (x2 < 0 || x1 > 100 || x1 === x2) continue;
    const name = rc(rng, IN_NAMES);
    const shown = shuffled(rng, [...vals.map(String), 'x']);
    return {
      prompt: `The scores out of $100$ of ${name} in ${k + 1} class tests are $${shown.join(',\\ ')}$, where $x$ is one score that is smudged. The range of the ${k + 1} scores is $${R}$. Find all possible values of $x$.`,
      answerType: 'set',
      answer: { values: [x2, x1] },
      inputHint: 'e.g. 12, 30',
      hints: [
        'The range is the highest score minus the lowest score.',
        'The range of the scores you can read is smaller than the given range, so the smudged score must be either the new highest or the new lowest.',
        'Try each case in turn.'
      ],
      steps: [
        { h: 'Known scores', d: `Highest $${hi}$, lowest $${lo}$, range $${hi - lo}$` },
        { h: 'Smudged score highest', d: `$x - ${lo} = ${R}$ gives $${x1}$` },
        { h: 'Smudged score lowest', d: `$${hi} - x = ${R}$ gives $${x2}$. Both are possible.` }
      ]
    };
  }
  return rangeDisplay(makeRng(FALLBACK_SEED));
}

// ══ 6 · Constructions and Tilings ═══════════════════════════════════════════

// dp 0 · Two points on a perpendicular bisector.
function perpBisector(rng) {
  const p = ri(rng, 20, 60), q = ri(rng, p + 8, 82);
  const ask = rc(rng, ['APQ', 'PAQ', 'AQB', 'APB']);
  const answer = { APQ: 90 + p, PAQ: q - p, AQB: 180 - 2 * q, APB: 180 - 2 * p }[ask];
  return {
    prompt: `Using a ruler and compass, the perpendicular bisector of a line segment $AB$ is constructed; it meets $AB$ at $M$. Points $P$ and $Q$ are marked on it, on the same side of $AB$, with $P$ between $M$ and $Q$. $\\angle PAB = ${deg(p)}$ and $\\angle QAB = ${deg(q)}$. Find $\\angle ${ask}$ in degrees.`,
    ...numericAnswer(answer),
    traps: traps(answer, [
      { value: 90 - p, why: 'That is $\\angle APM$. $P$ lies between $M$ and $Q$, so use the straight line $MPQ$.' },
      { value: 180 - p - q, why: 'Find the angles one triangle at a time.' }
    ]),
    hints: [
      'Every point on the perpendicular bisector is the same distance from $A$ and $B$, and the bisector makes right angles with $AB$ at $M$.',
      'Look at the right-angled triangles $AMP$ and $AMQ$, and at the isosceles triangles $APB$ and $AQB$.',
      'Angles on a straight line add up to 180°.'
    ],
    steps: [
      { h: 'Right angles at M', d: `$\\angle AMP = 90^\\circ$, so $\\angle APM = ${deg(90 - p)}$ and $\\angle AQM = ${deg(90 - q)}$` },
      { h: 'Isosceles triangles', d: `$PA = PB$ and $QA = QB$, so $\\angle PBA = ${deg(p)}$ and $\\angle QBA = ${deg(q)}$` },
      { h: 'Answer', d: `$\\angle ${ask} = ${deg(answer)}$` }
    ]
  };
}

// dp 1 · Rays from a constructed angle, bisected step by step.
function angleConstruction(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const T = rc(rng, [60, 90, 120]);
    const rays = { A: 0, X: 180, B: T };
    const lines = [`Line $AOX$ is a straight line. Using a compass, $\\angle AOB$ is constructed at $O$ ${T === 90 ? 'as a right angle' : `to measure $${deg(T)}$`}.`];
    const steps = [`$\\angle AOB = ${deg(T)}$, $\\angle BOX = ${deg(180 - T)}$`];
    const names = ['C', 'D', 'E'];
    const k = ri(rng, 2, 3);
    let ok = true;
    for (let i = 0; i < k; i++) {
      const sorted = Object.entries(rays).sort((u, v) => u[1] - v[1]);
      const j = ri(rng, 0, sorted.length - 2);
      const [u, v] = [sorted[j], sorted[j + 1]];
      const w = (u[1] + v[1]) / 2;
      if (Math.round(w * 100) !== w * 100) { ok = false; break; }
      rays[names[i]] = w;
      lines.push(`Then $\\angle ${u[0]}O${v[0]}$ is bisected by ray $O${names[i]}$.`);
      steps.push(`$O${names[i]}$ is at $${deg(dec(Math.round(w * 100), 2))}$ from $OA$`);
    }
    if (!ok) continue;
    const last = names[k - 1];
    const keys = Object.keys(rays).filter(r => r !== last && r !== 'O');
    const other = rc(rng, keys);
    const angle = Math.abs(rays[last] - rays[other]);
    if (angle === 0 || angle === 180) continue;
    const units = Math.round(angle * 100);
    return {
      prompt: `${lines.join(' ')} Find $\\angle ${last}O${other}$ in degrees.`,
      ...numericAnswer(units, 2),
      traps: traps(angle, [
        { value: 180 - angle, why: 'Measure from the correct ray: that is the angle on the other side.' },
        { value: angle * 2, why: 'Bisecting halves an angle.' }
      ]),
      hints: [
        'Measure every ray by its angle from $OA$, going round towards $OB$.',
        'A bisecting ray lies exactly halfway between the two rays of the angle it bisects.',
        'The angle between two rays is the difference of their positions.'
      ],
      steps: [
        { h: 'Start', d: steps[0] },
        { h: 'Each bisection', d: steps.slice(1).join('; ') },
        { h: 'Answer', d: `$\\angle ${last}O${other} = ${deg(dec(units, 2))}$` }
      ]
    };
  }
  return angleConstruction(makeRng(FALLBACK_SEED));
}

// dp 3 · Chessboard colouring decides whether dominoes can tile.
function tilingInvariant(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const m = ri(rng, 4, 8), n = ri(rng, 4, 8);
    if ((m * n) % 2) continue;
    const r = ri(rng, 2, 4) * 2 - (rng() < 0.5 ? 1 : 0);
    const cells = [];
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) cells.push([i, j]);
    const removed = pick(rng, cells, r).sort((u, v) => u[0] - v[0] || u[1] - v[1]);
    let black = 0, white = 0;
    for (const [i, j] of cells) {
      if (removed.some(c => c[0] === i && c[1] === j)) continue;
      if ((i + j) % 2 === 0) black++; else white++;
    }
    const answer = Math.abs(black - white);
    if (answer === 0 && rng() < 0.6) continue;
    return {
      prompt: `A board of $${m}$ rows and $${n}$ columns of squares is coloured like a chessboard, with the square in row $1$, column $1$ black. These squares are cut out: ${removed.map(([i, j]) => `(row $${i}$, column $${j}$)`).join(', ')}. A domino covers two squares side by side. How many more squares of one colour than of the other are left on the board? (If this is not $0$, no set of dominoes can cover the board exactly.)`,
      ...numericAnswer(answer),
      traps: traps(answer, [
        { value: m * n - r, why: 'That is the number of squares left, not the difference between the colours.' },
        { value: r, why: 'Find the colour of each square that was cut out.' }
      ]),
      hints: [
        'A square is black when its row number plus its column number is even.',
        'Before any square is cut out, the board has equally many black and white squares.',
        'Count the colours of the squares cut out, and see how far the two colours now differ.'
      ],
      steps: [
        { h: 'Whole board', d: `$${m * n}$ squares: $${(m * n) / 2}$ black, $${(m * n) / 2}$ white` },
        { h: 'Cut out', d: `${removed.filter(([i, j]) => (i + j) % 2 === 0).length} black, ${removed.filter(([i, j]) => (i + j) % 2 === 1).length} white` },
        { h: 'Left', d: `$${black}$ black and $${white}$ white, a difference of $${answer}$.${answer ? ' Each domino covers one of each colour, so no tiling is possible.' : ''}` }
      ]
    };
  }
  return tilingInvariant(makeRng(FALLBACK_SEED));
}

// ══ 7 · Finding the Unknown ═════════════════════════════════════════════════

/** [one, many]: the plural goes on the container, not on what it holds. */
const BAG = [['bag of rice', 'bags of rice'], ['packet of dal', 'packets of dal'], ['box of mangoes', 'boxes of mangoes'], ['bag of sugar', 'bags of sugar'], ['tin of ghee', 'tins of ghee']];

// dp 0 · A balance kept level: the same done to both pans.
function balance(rng) {
  for (let guard = 0; guard < 400; guard++) {
    const [thing, things] = rc(rng, BAG);
    const x = ri(rng, 2, 15);
    const a = ri(rng, 3, 7), c = ri(rng, 1, a - 1);
    const b = ri(rng, 1, 20);
    const d = b + (a - c) * x;
    if (d > 99) continue;
    const name = rc(rng, IN_NAMES);
    const ask = rng() < 0.5 ? 'one' : 'all';
    const answer = ask === 'one' ? x : (a + c) * x;
    return {
      prompt: `${name}'s shop scale balances with $${a}$ identical ${things} and a $${b}$ kg weight on the left pan, and $${c}$ of the same ${things} and a $${d}$ kg weight on the right pan. ${ask === 'one' ? `What is the weight of one ${thing}, in kg?` : `What is the total weight of all the ${things} on the scale, in kg?`}`,
      ...numericAnswer(answer, 0, 'kg'),
      traps: traps(answer, [
        { value: (d - b) / a, why: `Remove the same number of ${things} from both pans first.` },
        { value: ask === 'one' ? (d + b) / (a - c) : x, why: ask === 'one' ? 'Take the same weight off both pans: subtract, do not add.' : 'That is one item. The question asks for all of them.' }
      ]),
      hints: [
        `Take the same number of ${things} off each pan: the scale stays balanced.`,
        'Then take the same weight off each pan.',
        'What is left shows a number of items balancing a weight. Divide.'
      ],
      steps: [
        { h: 'Equation', d: `$${a}x + ${b} = ${c}x + ${d}$` },
        { h: 'Same on both sides', d: `Remove $${c}x$ and $${b}$: $${a - c}x = ${d - b}$` },
        { h: 'Answer', d: ask === 'one' ? `$x = ${x}$ kg` : `$x = ${x}$, and there are $${a + c}$ items: $${answer}$ kg` }
      ]
    };
  }
  return balance(makeRng(FALLBACK_SEED));
}

// dp 1 · One-step equations used to find a related value.
function oneStep(rng) {
  const v = rc(rng, ['x', 'y', 'n', 'p']);
  const kind = rc(rng, ['add', 'mul', 'div']);
  if (kind === 'add') {
    const a = ri(rng, 4, 30) * (rng() < 0.5 ? -1 : 1), x = ri(rng, -40, 40);
    const b = x + a;
    const answer = x - a;
    return {
      prompt: `If $${v} + ${paren(a)} = ${b}$, what is the value of $${v} - ${paren(a)}$?`,
      ...numericAnswer(answer),
      traps: traps(answer, [{ value: x, why: `That is $${v}$ itself. The question asks for $${v} - ${paren(a)}$.` }, { value: b, why: 'Find the unknown first.' }]),
      hints: ['Find the unknown first: undo the addition by subtracting the same number from both sides.', 'Take care with the signs of negative numbers.', 'Then substitute into the new expression.'],
      steps: [
        { h: 'Solve', d: `$${v} = ${b} - ${paren(a)} = ${x}$` },
        { h: 'Substitute', d: `$${v} - ${paren(a)} = ${x} - ${paren(a)}$` },
        { h: 'Answer', d: `$${answer}$` }
      ]
    };
  }
  if (kind === 'mul') {
    const a = ri(rng, 2, 12) * (rng() < 0.5 ? -1 : 1), x = ri(rng, 2, 20) * (rng() < 0.5 ? -1 : 1);
    const c = ri(rng, 2, 12) * (rng() < 0.5 ? -1 : 1);
    if (Math.abs(a) === Math.abs(c)) return oneStep(rng);
    const answer = c * x;
    return {
      prompt: `If $${a}${v} = ${a * x}$, what is the value of $${c}${v}$?`,
      ...numericAnswer(answer),
      traps: traps(answer, [{ value: x, why: `That is $${v}$ itself.` }, { value: -answer, why: 'Check the signs when you divide and multiply.' }]),
      hints: ['Undo the multiplication: divide both sides by the same number.', 'A negative divided by a negative is positive.', 'Then multiply by the new number.'],
      steps: [
        { h: 'Solve', d: `$${v} = ${a * x} \\div ${paren(a)} = ${x}$` },
        { h: 'Substitute', d: `$${c} \\times ${paren(x)}$` },
        { h: 'Answer', d: `$${answer}$` }
      ]
    };
  }
  const a = ri(rng, 2, 9), q = ri(rng, 2, 15) * (rng() < 0.5 ? -1 : 1);
  const x = a * q;
  const divs = [];
  for (let d = 2; d <= Math.abs(x); d++) if (x % d === 0 && d !== a) divs.push(d);
  const c = rc(rng, divs);
  const answer = x / c;
  return {
    prompt: `If $\\dfrac{${v}}{${a}} = ${q}$, what is the value of $\\dfrac{${v}}{${c}}$?`,
    ...numericAnswer(answer),
    traps: traps(answer, [{ value: x, why: `That is $${v}$ itself. Divide it as asked.` }, { value: (q * c) / a, why: 'Find the unknown first, by multiplying both sides.' }]),
    hints: ['Undo the division: multiply both sides by the same number.', 'That gives the unknown.', 'Now divide it by the new number.'],
    steps: [
      { h: 'Solve', d: `$${v} = ${q} \\times ${a} = ${x}$` },
      { h: 'Divide', d: `$${x} \\div ${c}$` },
      { h: 'Answer', d: `$${answer}$` }
    ]
  };
}

// dp 3 · Forming an equation from a context.
function equationContext(rng) {
  const name = rc(rng, IN_NAMES);
  const kind = rc(rng, ['consecutive', 'ages', 'notes']);
  if (kind === 'consecutive') {
    const k = rc(rng, [2, 3, 4, 5, 6, 7, 9, 11]), n = ri(rng, 3, 5), start = ri(rng, 3, 30) * k;
    const terms = Array.from({ length: n }, (_, i) => start + i * k);
    const S = terms.reduce((s, t) => s + t, 0);
    const ask = rng() < 0.5 ? 'largest' : 'smallest';
    const answer = ask === 'largest' ? terms[n - 1] : terms[0];
    return {
      prompt: `The sum of ${n} consecutive multiples of $${k}$ is $${S}$. What is the ${ask} of these multiples?`,
      ...numericAnswer(answer),
      traps: traps(answer, [{ value: ask === 'largest' ? terms[0] : terms[n - 1], why: `That is the ${ask === 'largest' ? 'smallest' : 'largest'} one.` }, { value: S / n, why: 'That is the middle value (the mean). The question asks for an end one.' }]),
      hints: [`Call the smallest multiple $m$. The next ones are $m + ${k}$, $m + ${2 * k}$ and so on.`, 'Add them and set the sum equal to the given total.', 'Solve for $m$, then find the multiple asked for.'],
      steps: [
        { h: 'Equation', d: `$${n}m + ${(k * n * (n - 1)) / 2} = ${S}$` },
        { h: 'Solve', d: `$${n}m = ${S - (k * n * (n - 1)) / 2}$, so $m = ${terms[0]}$` },
        { h: 'Answer', d: `The multiples are $${terms.join(', ')}$; the ${ask} is $${answer}$.` }
      ]
    };
  }
  if (kind === 'ages') {
    const b = ri(rng, 3, 14), m = ri(rng, 2, 4), t = ri(rng, 2, 9);
    const sib = rc(rng, ['brother', 'sister', 'cousin']);
    const S = m * b + b + 2 * t;
    const ask = rng() < 0.5 ? 'younger' : 'elder';
    const answer = ask === 'younger' ? b : m * b;
    return {
      prompt: `${name} is ${m === 2 ? 'twice' : `${m} times`} as old as ${name === 'Meera' ? 'Ravi' : 'Meera'}, ${name}'s ${sib}. In $${t}$ years, the sum of their ages will be $${S}$ years. How old is ${ask === 'younger' ? (name === 'Meera' ? 'Ravi' : 'Meera') : name} now, in years?`,
      ...numericAnswer(answer, 0, 'years'),
      traps: traps(answer, [{ value: ask === 'younger' ? m * b : b, why: 'Check whose age the question asks for.' }, { value: S / (m + 1), why: `In $${t}$ years EACH of them is $${t}$ years older — add $${t}$ twice.` }]),
      hints: ['Let the younger one’s age now be $a$. Write the elder one’s age in terms of $a$.', 'Add the number of years to each age before adding the two ages.', 'Solve the equation and answer the question asked.'],
      steps: [
        { h: 'Equation', d: `$(a + ${t}) + (${m}a + ${t}) = ${S}$` },
        { h: 'Solve', d: `$${m + 1}a = ${S - 2 * t}$, so $a = ${b}$` },
        { h: 'Answer', d: `Ages now: $${b}$ and $${m * b}$; the answer is $${answer}$ years.` }
      ]
    };
  }
  const big = rc(rng, [50, 100, 200]), small = rc(rng, [10, 20].filter(s => s < big));
  const nb = ri(rng, 3, 25), ns = ri(rng, 3, 25);
  const V = nb * big + ns * small, N = nb + ns;
  const ask = rng() < 0.5 ? big : small;
  const answer = ask === big ? nb : ns;
  return {
    prompt: `${name} has only ₹$${big}$ notes and ₹$${small}$ notes — $${N}$ notes in all, worth ₹$${V}$. How many ₹$${ask}$ notes does ${name} have?`,
    ...numericAnswer(answer),
    traps: traps(answer, [{ value: N - answer, why: 'That is the number of the other notes.' }, { value: V / ask, why: 'Not all the money is in one kind of note.' }]),
    hints: ['Let the number of the larger notes be $b$. How many of the smaller notes are there, in terms of $b$?', 'Write the total value in terms of $b$ and set it equal to the given amount.', 'Solve for $b$ and answer the question asked.'],
    steps: [
      { h: 'Equation', d: `$${big}b + ${small}(${N} - b) = ${V}$` },
      { h: 'Solve', d: `$${big - small}b = ${V - small * N}$, so $b = ${nb}$` },
      { h: 'Answer', d: `$${nb}$ notes of ₹$${big}$ and $${ns}$ notes of ₹$${small}$` }
    ]
  };
}

/** One rung, D3: every other rung returns the same form (see the header). */
const d3 = form => (rng, _diff) => form(rng);

export const class7HardestFormsPart2 = Object.freeze({
  'c7-congruent-matching-reasoning': d3(congruentMatching),
  'c7-sss-sas-reasoning': d3(sssKite),
  'c7-congruence-inference-reasoning': d3(nestedIsosceles),
  'c7-integer-product-sign-reasoning': d3(productSign),
  'c7-integer-division-reasoning': d3(integerDivision),
  'c7-integer-expression-reasoning': d3(integerExpression),
  'c7-hcf-reasoning': d3(hcfRemainders),
  'c7-lcm-reasoning': d3(lcmTwist),
  'c7-hcf-lcm-context-reasoning': d3(hcfLcmContext),
  'c7-decimal-multiplication-reasoning': d3(decimalMultiplication),
  'c7-decimal-division-reasoning': d3(decimalDivision),
  'c7-decimal-context-reasoning': d3(decimalContext),
  'c7-statistical-question-reasoning': d3(statisticalQuestion),
  'c7-mean-reasoning': d3(meanReasoning),
  'c7-range-display-reasoning': d3(rangeDisplay),
  'c7-perpendicular-bisector-reasoning': d3(perpBisector),
  'c7-angle-construction-reasoning': d3(angleConstruction),
  'c7-tiling-invariant-reasoning': d3(tilingInvariant),
  'c7-balance-reasoning': d3(balance),
  'c7-one-step-equation-reasoning': d3(oneStep),
  'c7-equation-context-reasoning': d3(equationContext)
});
