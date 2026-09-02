// Pri Learning · current-source Class X generator overlay.
//
// These forms exist only where the 2026–27 CBSE/NCERT source review found an
// exact outcome missing from the established Class 10 bank. Keep the legacy bank
// intact in india-class10-base.js; this module is deliberately narrow so a
// current-syllabus correction cannot silently rewrite unrelated mathematics.
import { ri, nz, mcq } from '../qhelpers.js';
import { figParabola } from '../figures.js';

function polynomial(a, b, c) {
  const ax = a === 1 ? 'x^2' : a === -1 ? '-x^2' : `${a}x^2`;
  const bx = b === 0 ? '' : ` ${b > 0 ? '+' : '-'} ${Math.abs(b) === 1 ? '' : Math.abs(b)}x`;
  const cc = c === 0 ? '' : ` ${c > 0 ? '+' : '-'} ${Math.abs(c)}`;
  return `${ax}${bx}${cc}`;
}

/**
 * Current Class X Polynomials outcome: find zeroes graphically and algebraically.
 * D1 is the graphical meaning of a zero; D2 is algebraic zero-finding. D3/D4
 * remain the established zeroes↔coefficients forms in the base bank.
 */
export function currentPolynomialZeroes(rng, diff) {
  if (diff === 1) {
    const h = ri(rng, -2, 2);
    // figParabola's fixed classroom-sized viewport shows y down to about -5.
    // d<=2 keeps the vertex k=-d² fully visible instead of plotting roots whose
    // turning point sits below the card and makes the graph needlessly ambiguous.
    const d = ri(rng, 1, 2);
    const r1 = h - d, r2 = h + d;
    return {
      prompt: 'The graph of $y=p(x)$ is shown. Read the zeroes of $p(x)$ from the graph.',
      figure: figParabola({ a: 1, h, k: -(d * d), xInts: [r1, r2], showVertex: false }),
      answerType: 'set', answer: { values: [r1, r2] },
      inputHint: 'e.g. x = -2 or x = 3',
      traps: [{ value: 0, why: 'A zero is an x-coordinate where the graph meets the x-axis; it is not the y-value 0 by itself.' }],
      hints: [
        'A zero of $p(x)$ is a value of $x$ for which $p(x)=0$.',
        'On the graph, $p(x)=0$ exactly on the x-axis.',
        'Read the two x-coordinates where the curve crosses the axis.'
      ],
      steps: [
        { h: 'Use the graphical meaning', d: 'Zeroes are the x-coordinates of the points where $y=p(x)$ meets the x-axis.' },
        { h: 'Read the intercepts', d: `$x=${r1}$ and $x=${r2}$` },
        { h: 'Answer', d: `The zeroes are $${r1}$ and $${r2}$.` }
      ],
      dotpoint: 0
    };
  }

  const r1 = nz(rng, -6, 6);
  let r2 = nz(rng, -6, 6);
  if (r2 === r1) r2 = r1 > 0 ? r1 - 1 : r1 + 1;
  const b = -(r1 + r2), c = r1 * r2;
  const p = polynomial(1, b, c);
  return {
    prompt: `Find the zeroes of $p(x)=${p}$ algebraically.`,
    answerType: 'set', answer: { values: [r1, r2] },
    inputHint: 'e.g. x = -2 or x = 3',
    traps: [{ value: r1 + r2, why: 'The sum of the zeroes is useful for checking, but the question asks for the individual values of x that make p(x)=0.' }],
    hints: [
      'To find a zero algebraically, set the polynomial equal to zero.',
      `Factor $${p}$ into two linear factors.`,
      'Then use the zero-product property.'
    ],
    steps: [
      { h: 'Set p(x) equal to zero', d: `$${p}=0$` },
      { h: 'Factorise', d: `$(x ${r1 < 0 ? '+' : '-'} ${Math.abs(r1)})(x ${r2 < 0 ? '+' : '-'} ${Math.abs(r2)})=0$` },
      { h: 'Zero-product property', d: `$x=${r1}$ or $x=${r2}$` },
      { h: 'Answer', d: `The zeroes are $${r1}$ and $${r2}$.` }
    ],
    stepcheck: { kind: 'equation', variable: 'x', solutions: [r1, r2] },
    dotpoint: 0
  };
}

const BPT_RATIOS = Object.freeze([[1, 2], [2, 3], [3, 4], [2, 5], [3, 5]]);

function figBptTriangle({ ad, db, ae, ec }) {
  const W = 320, H = 240;
  const A = [160, 24], B = [36, 212], C = [284, 212];
  const t = ad / (ad + db);
  const D = [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t];
  const E = [A[0] + (C[0] - A[0]) * t, A[1] + (C[1] - A[1]) * t];
  const n = v => Math.round(v * 10) / 10;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Triangle ABC with DE parallel to BC" style="max-width:360px;width:100%;height:auto;display:block">` +
    `<g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="M ${A[0]} ${A[1]} L ${B[0]} ${B[1]} L ${C[0]} ${C[1]} Z"/>` +
    `<line x1="${n(D[0])}" y1="${n(D[1])}" x2="${n(E[0])}" y2="${n(E[1])}" stroke="#3987e5"/>` +
    `<text x="160" y="17" fill="currentColor" stroke="none" text-anchor="middle" font-size="13">A</text>` +
    `<text x="24" y="226" fill="currentColor" stroke="none" text-anchor="middle" font-size="13">B</text>` +
    `<text x="296" y="226" fill="currentColor" stroke="none" text-anchor="middle" font-size="13">C</text>` +
    `<text x="${n(D[0] - 12)}" y="${n(D[1] + 4)}" fill="#3987e5" stroke="none" text-anchor="middle" font-size="13">D</text>` +
    `<text x="${n(E[0] + 12)}" y="${n(E[1] + 4)}" fill="#3987e5" stroke="none" text-anchor="middle" font-size="13">E</text>` +
    `<text x="${n((A[0] + D[0]) / 2 - 18)}" y="${n((A[1] + D[1]) / 2)}" fill="currentColor" stroke="none" text-anchor="middle" font-size="12">AD=${ad}</text>` +
    `<text x="${n((D[0] + B[0]) / 2 - 18)}" y="${n((D[1] + B[1]) / 2 + 4)}" fill="currentColor" stroke="none" text-anchor="middle" font-size="12">DB=${db}</text>` +
    `<text x="${n((A[0] + E[0]) / 2 + 20)}" y="${n((A[1] + E[1]) / 2)}" fill="currentColor" stroke="none" text-anchor="middle" font-size="12">AE=${ae}</text>` +
    `<text x="${n((E[0] + C[0]) / 2 + 20)}" y="${n((E[1] + C[1]) / 2 + 4)}" fill="currentColor" stroke="none" text-anchor="middle" font-size="12">EC=${ec}</text>` +
    `</g></svg>`;
}

/** Current Class X Triangles: BPT/converse and prescribed similarity criteria. */
export function currentTriangles(rng, diff) {
  const [p, q] = BPT_RATIOS[ri(rng, 0, BPT_RATIOS.length - 1)];
  const s1 = ri(rng, 2, 5), s2 = ri(rng, 2, 5);
  const ad = p * s1, db = q * s1, ae = p * s2, ec = q * s2;

  if (diff === 1) {
    return {
      prompt: 'In $\\triangle ABC$, $DE \\parallel BC$. Use the Basic Proportionality Theorem to find $EC$.',
      figure: figBptTriangle({ ad, db, ae, ec: '?' }),
      answerType: 'numeric', answer: { value: ec },
      traps: [{ value: ae * db, why: 'BPT gives a proportion. Keep corresponding segments in the same ratio before solving for EC.' }].filter(t => t.value !== ec),
      hints: [
        'A line parallel to one side of a triangle divides the other two sides proportionally.',
        '$\\dfrac{AD}{DB}=\\dfrac{AE}{EC}$.',
        `$\\dfrac{${ad}}{${db}}=\\dfrac{${ae}}{EC}$.`
      ],
      steps: [
        { h: 'Basic Proportionality Theorem', d: '$\\dfrac{AD}{DB}=\\dfrac{AE}{EC}$' },
        { h: 'Substitute', d: `$\\dfrac{${ad}}{${db}}=\\dfrac{${ae}}{EC}$` },
        { h: 'Solve', d: `$${ad}EC=${db * ae}$, so $EC=${ec}$` }
      ],
      dotpoint: 0
    };
  }

  if (diff === 2) {
    const m = mcq(rng, '$DE \\parallel BC$', [
      { text: '$DE \\perp BC$', why: 'Equal division ratios on the two sides imply parallelism by the converse of BPT, not perpendicularity.' },
      { text: '$DE = BC$', why: 'The converse establishes a direction relationship; it does not say the two segments have equal length.' },
      { text: 'No conclusion about $DE$ and $BC$', why: 'The converse of BPT applies exactly when the two sides are divided in the same ratio.' }
    ]);
    return {
      prompt: `In $\\triangle ABC$, points $D$ and $E$ lie on $AB$ and $AC$ with $AD=${ad}$, $DB=${db}$, $AE=${ae}$ and $EC=${ec}$. What follows from the converse of the Basic Proportionality Theorem?`,
      figure: figBptTriangle({ ad, db, ae, ec }),
      answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
      hints: [
        'Compare the two division ratios on the sides.',
        `$\\dfrac{AD}{DB}=\\dfrac{${ad}}{${db}}=\\dfrac{${p}}{${q}}$ and $\\dfrac{AE}{EC}=\\dfrac{${ae}}{${ec}}=\\dfrac{${p}}{${q}}$.`,
        'Equal ratios trigger the converse of BPT.'
      ],
      steps: [
        { h: 'Compare the ratios', d: `$\\dfrac{AD}{DB}=\\dfrac{AE}{EC}=\\dfrac{${p}}{${q}}$` },
        { h: 'Use the converse', d: 'If a line divides two sides of a triangle in the same ratio, it is parallel to the third side.' },
        { h: 'Conclusion', d: '$DE \\parallel BC$' }
      ],
      dotpoint: 0
    };
  }

  if (diff === 3) {
    const kind = ri(rng, 0, 2);
    const scenarios = [
      {
        correct: 'AAA similarity criterion',
        prompt: 'For triangles $ABC$ and $DEF$, $\\angle A=\\angle D$ and $\\angle B=\\angle E$. Which similarity criterion establishes that the triangles are similar?',
        reason: 'Two corresponding angle equalities force the third pair to be equal too, so the triangles satisfy the AAA similarity criterion.'
      },
      {
        correct: 'SSS similarity criterion',
        prompt: 'For triangles $ABC$ and $DEF$, $\\dfrac{AB}{DE}=\\dfrac{BC}{EF}=\\dfrac{CA}{FD}$. Which similarity criterion establishes that the triangles are similar?',
        reason: 'All three pairs of corresponding sides are proportional, which is exactly SSS similarity.'
      },
      {
        correct: 'SAS similarity criterion',
        prompt: 'For triangles $ABC$ and $DEF$, $\\angle A=\\angle D$ and $\\dfrac{AB}{DE}=\\dfrac{AC}{DF}$. Which similarity criterion establishes that the triangles are similar?',
        reason: 'The equal angle is included between the two proportional side pairs, which is exactly SAS similarity.'
      }
    ];
    const s = scenarios[kind];
    const alternatives = [
      { text: 'AAA similarity criterion', why: 'AAA requires corresponding angle information; use the data actually supplied.' },
      { text: 'SSS similarity criterion', why: 'SSS requires all three pairs of corresponding sides to be proportional.' },
      { text: 'SAS similarity criterion', why: 'SAS requires an equal included angle and the two surrounding side pairs to be proportional.' },
      { text: 'RHS congruence criterion', why: 'RHS is a congruence criterion for right triangles, not one of the similarity criteria being tested here.' }
    ].filter(x => x.text !== s.correct);
    const m = mcq(rng, s.correct, alternatives);
    return {
      prompt: s.prompt,
      answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
      hints: ['Match the information given to the definition of each similarity criterion.', s.reason],
      steps: [
        { h: 'Read the supplied data', d: s.prompt.replace(/^For triangles .*?, /, '') },
        { h: 'Match the criterion', d: s.reason },
        { h: 'Conclusion', d: s.correct }
      ],
      dotpoint: 1
    };
  }

  const k = ri(rng, 2, 4);
  const ab = ri(rng, 3, 8), ac = ri(rng, 4, 10);
  const de = ab * k, df = ac * k;
  return {
    prompt: `Triangles $ABC$ and $DEF$ have $\\angle A=\\angle D$, $AB=${ab}$ cm, $DE=${de}$ cm and $AC=${ac}$ cm. The sides including the equal angles are proportional, so the triangles are similar by SAS. Find $DF$.`,
    answerType: 'numeric', answer: { value: df }, answerSuffix: 'cm',
    traps: [{ value: ac + k, why: 'Similar triangles scale corresponding lengths multiplicatively, not by adding the scale factor.' }, { value: ac / k, why: 'DE is larger than AB, so the scale from ABC to DEF is greater than 1; multiply AC by it.' }].filter(t => t.value !== df),
    hints: [
      `The scale factor from $ABC$ to $DEF$ is $\\dfrac{DE}{AB}=\\dfrac{${de}}{${ab}}=${k}$.`,
      'Corresponding sides of similar triangles have the same scale factor.',
      `$DF=${k}\\times ${ac}$.`
    ],
    steps: [
      { h: 'Establish similarity', d: '$\\angle A=\\angle D$ and the including sides are proportional, so $\\triangle ABC\\sim\\triangle DEF$ by SAS.' },
      { h: 'Scale factor', d: `$\\dfrac{DE}{AB}=\\dfrac{${de}}{${ab}}=${k}$` },
      { h: 'Apply to the matching side', d: `$DF=${k}\\times ${ac}=${df}$ cm` }
    ],
    dotpoint: 1
  };
}
