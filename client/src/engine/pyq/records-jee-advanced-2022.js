// Pri Learning · JEE Advanced 2022 · Mathematics (Papers 1 and 2)
//
// Transcribed from the Joint Admission Board's combined final answer key
// document (pyqSources.js: jeeadv-2022-answers), which prints each question
// with its final answer, read from the rendered page. Worked steps are Pri
// Learning's own.
//
// Pending (one-or-more-correct, no archive contract yet): Paper 1 Q9–Q14,
// Paper 2 Q9–Q14.
//
// One transcription note: in Paper 1 Q18 the authority's document prints
// List-II entry (T) as "3√3 / z"; the denominator is the digit 2 (the value
// at φ = π/3 is 3√3/2, and no z appears anywhere in the question), so it is
// transcribed as 3√3/2.

import { PYQ_PROVENANCE } from './pyqSources.js';

const P1 = Object.freeze({
  examId: 'jee-advanced', year: 2022, paper: '1',
  provenance: PYQ_PROVENANCE.OFFICIAL_PAPER_AND_KEY, pastPaper: true,
  promptSource: 'jeeadv-2022-answers', answerSource: 'jeeadv-2022-answers'
});
const P2 = Object.freeze({
  examId: 'jee-advanced', year: 2022, paper: '2',
  provenance: PYQ_PROVENANCE.OFFICIAL_PAPER_AND_KEY, pastPaper: true,
  promptSource: 'jeeadv-2022-answers', answerSource: 'jeeadv-2022-answers'
});

export const JEE_ADVANCED_2022_RECORDS = Object.freeze([
  // ── Paper 1 · Section 1 (numerical value) ──
  {
    ...P1, id: 'jeeadv-2022-p1-q1', section: 'Section 1', questionNumber: 1,
    chapterId: 'c12-inverse-trigonometric', difficulty: 4, answerType: 'numeric',
    prompt: 'Considering only the principal values of the inverse trigonometric functions, the value of\n\n$\\dfrac32\\cos^{-1}\\sqrt{\\dfrac{2}{2 + \\pi^2}} + \\dfrac14\\sin^{-1}\\dfrac{2\\sqrt2\\,\\pi}{2 + \\pi^2} + \\tan^{-1}\\dfrac{\\sqrt2}{\\pi}$\n\nis ____.',
    answer: { value: 2.36, tol: 0.01, officialRange: [2.35, 2.37] },
    inputHint: 'Enter the value',
    hints: ['Let $\\theta = \\cos^{-1}\\sqrt{\\frac{2}{2 + \\pi^2}}$, so $\\tan\\theta = \\frac{\\pi}{\\sqrt2}$.'],
    steps: [
      { h: 'Idea', d: 'All three terms are functions of one angle $\\theta$, and they add up to a constant.' },
      { h: 'The angle', d: '$\\cos\\theta = \\dfrac{\\sqrt2}{\\sqrt{2 + \\pi^2}}$ gives $\\tan\\theta = \\dfrac{\\pi}{\\sqrt2} \\approx 2.22$, so $\\theta \\in \\left(\\frac\\pi4, \\frac\\pi2\\right)$.' },
      { h: 'Second term', d: '$\\sin2\\theta = \\dfrac{2\\tan\\theta}{1 + \\tan^2\\theta} = \\dfrac{2\\sqrt2\\pi}{2 + \\pi^2}$. Since $2\\theta > \\frac\\pi2$, $\\sin^{-1}(\\sin2\\theta) = \\pi - 2\\theta$.' },
      { h: 'Third term', d: '$\\tan^{-1}\\dfrac{\\sqrt2}{\\pi} = \\dfrac\\pi2 - \\theta$.' },
      { h: 'Add', d: '$\\frac32\\theta + \\frac14(\\pi - 2\\theta) + \\frac\\pi2 - \\theta = \\dfrac{3\\pi}{4} \\approx 2.36$.' }
    ]
  },
  {
    ...P1, id: 'jeeadv-2022-p1-q2', section: 'Section 1', questionNumber: 2,
    chapterId: 'c11-limits-derivatives', difficulty: 3, answerType: 'numeric',
    prompt: 'Let $\\alpha$ be a positive real number. Let $f:\\mathbb R \\to \\mathbb R$ and $g:(\\alpha, \\infty) \\to \\mathbb R$ be the functions defined by\n\n$f(x) = \\sin\\left(\\dfrac{\\pi x}{12}\\right)$ and $g(x) = \\dfrac{2\\log_e(\\sqrt x - \\sqrt\\alpha)}{\\log_e\\left(e^{\\sqrt x} - e^{\\sqrt\\alpha}\\right)}$.\n\nThen the value of $\\displaystyle\\lim_{x\\to\\alpha^+} f(g(x))$ is ____.',
    answer: { value: 0.5, tol: 0.01, officialRange: [0.49, 0.51] },
    inputHint: 'Enter the value',
    hints: ['Write $t = \\sqrt x - \\sqrt\\alpha \\to 0^+$.'],
    steps: [
      { h: 'Idea', d: 'Find $\\lim g$ first, then use continuity of $f$.' },
      { h: 'Rewrite the bottom', d: 'With $t = \\sqrt x - \\sqrt\\alpha$: $e^{\\sqrt x} - e^{\\sqrt\\alpha} = e^{\\sqrt\\alpha}(e^t - 1)$, so $\\log_e(\\cdot) = \\sqrt\\alpha + \\log_e(e^t - 1)$.' },
      { h: 'Limit of $g$', d: '$g = \\dfrac{2\\log_e t}{\\sqrt\\alpha + \\log_e t + \\log_e\\frac{e^t - 1}{t}} \\to 2$ as $t \\to 0^+$, because $\\log_e t \\to -\\infty$ and $\\frac{e^t - 1}{t} \\to 1$.' },
      { h: 'Answer', d: '$f(2) = \\sin\\frac\\pi6 = 0.5$.' }
    ]
  },
  {
    ...P1, id: 'jeeadv-2022-p1-q3', section: 'Section 1', questionNumber: 3,
    chapterId: 'c11-sets', difficulty: 3, answerType: 'numeric',
    prompt: 'In a study about a pandemic, data of $900$ persons was collected. It was found that\n\n$190$ persons had symptom of fever,\n$220$ persons had symptom of cough,\n$220$ persons had symptom of breathing problem,\n$330$ persons had symptom of fever or cough or both,\n$350$ persons had symptom of cough or breathing problem or both,\n$340$ persons had symptom of fever or breathing problem or both,\n$30$ persons had all three symptoms (fever, cough and breathing problem).\n\nIf a person is chosen randomly from these $900$ persons, then the probability that the person has at most one symptom is ____.',
    answer: { value: 0.8, tol: 0.01, officialRange: [0.79, 0.81] },
    inputHint: 'Enter the probability',
    hints: ['Get each pairwise intersection from the "or both" counts.'],
    steps: [
      { h: 'Idea', d: 'Inclusion–exclusion gives the pairwise overlaps, and from them the number with two or more symptoms.' },
      { h: 'Pairs', d: '$|F\\cap C| = 190 + 220 - 330 = 80$, $|C\\cap B| = 220 + 220 - 350 = 90$, $|F\\cap B| = 190 + 220 - 340 = 70$.' },
      { h: 'Two or more', d: 'Exactly two: $(80 + 90 + 70) - 3\\cdot30 = 150$; all three: $30$. So $180$ have at least two symptoms.' },
      { h: 'Answer', d: '$\\dfrac{900 - 180}{900} = 0.8$.' }
    ]
  },
  {
    ...P1, id: 'jeeadv-2022-p1-q4', section: 'Section 1', questionNumber: 4,
    chapterId: 'c11-complex-numbers', difficulty: 3, answerType: 'numeric',
    prompt: 'Let $z$ be a complex number with non-zero imaginary part. If\n\n$\\dfrac{2 + 3z + 4z^2}{2 - 3z + 4z^2}$\n\nis a real number, then the value of $|z|^2$ is ____.',
    answer: { value: 0.5, tol: 0.01, officialRange: [0.49, 0.51] },
    inputHint: 'Enter the value',
    hints: ['Divide top and bottom by $z$.'],
    steps: [
      { h: 'Idea', d: 'Dividing by $z$ turns the condition into "$4z + \\frac2z$ is real".' },
      { h: 'Reduce', d: 'With $u = 4z + \\frac2z$ the ratio is $\\dfrac{u + 3}{u - 3}$, which is real exactly when $u$ is real.' },
      { h: 'Imaginary part', d: '$\\operatorname{Im}\\left(4z + \\frac{2\\bar z}{|z|^2}\\right) = \\operatorname{Im}z\\left(4 - \\frac{2}{|z|^2}\\right) = 0$, and $\\operatorname{Im} z \\ne 0$.' },
      { h: 'Answer', d: '$|z|^2 = \\dfrac12 = 0.5$.' }
    ]
  },
  {
    ...P1, id: 'jeeadv-2022-p1-q5', section: 'Section 1', questionNumber: 5,
    chapterId: 'c11-complex-numbers', difficulty: 3, answerType: 'numeric',
    prompt: 'Let $\\bar z$ denote the complex conjugate of a complex number $z$ and let $i = \\sqrt{-1}$. In the set of complex numbers, the number of distinct roots of the equation\n\n$\\bar z - z^2 = i\\left(\\bar z + z^2\\right)$\n\nis ____.',
    answer: { value: 4 },
    inputHint: 'Enter the number of roots',
    hints: ['Collect $\\bar z$ on one side: $\\bar z(1 - i) = z^2(1 + i)$.'],
    steps: [
      { h: 'Idea', d: 'The equation simplifies to $\\bar z = iz^2$; take moduli.' },
      { h: 'Simplify', d: '$\\bar z = \\dfrac{1 + i}{1 - i}z^2 = iz^2$.' },
      { h: 'Moduli', d: '$|z| = |z|^2$, so $z = 0$ or $|z| = 1$.' },
      { h: 'Unit circle', d: 'If $|z| = 1$, $\\bar z = \\frac1z$, so $z^3 = -i$: three distinct roots.' },
      { h: 'Answer', d: '$1 + 3 = 4$.' }
    ]
  },
  {
    ...P1, id: 'jeeadv-2022-p1-q6', section: 'Section 1', questionNumber: 6,
    chapterId: 'c11-sequences-series', difficulty: 3, answerType: 'numeric',
    prompt: 'Let $l_1, l_2, \\ldots, l_{100}$ be consecutive terms of an arithmetic progression with common difference $d_1$, and let $w_1, w_2, \\ldots, w_{100}$ be consecutive terms of another arithmetic progression with common difference $d_2$, where $d_1d_2 = 10$. For each $i = 1, 2, \\ldots, 100$, let $R_i$ be a rectangle with length $l_i$, width $w_i$ and area $A_i$. If $A_{51} - A_{50} = 1000$, then the value of $A_{100} - A_{90}$ is ____.',
    answer: { value: 18900 },
    inputHint: 'Enter the value',
    hints: ['The differences $A_{n+1} - A_n$ form an AP with common difference $2d_1d_2$.'],
    steps: [
      { h: 'Idea', d: '$A_n = l_nw_n$ is quadratic in $n$, so its first differences grow linearly.' },
      { h: 'First differences', d: '$D_n = A_{n+1} - A_n$ satisfies $D_{n+1} - D_n = 2d_1d_2 = 20$, and $D_{50} = 1000$.' },
      { h: 'Sum them', d: '$A_{100} - A_{90} = \\displaystyle\\sum_{n=90}^{99} D_n = \\sum_{n=90}^{99}\\left(1000 + 20(n - 50)\\right) = 10000 + 20\\cdot445$.' },
      { h: 'Answer', d: '$18900$.' }
    ]
  },
  {
    ...P1, id: 'jeeadv-2022-p1-q7', section: 'Section 1', questionNumber: 7,
    chapterId: 'c11-permutations-combinations', difficulty: 2, answerType: 'numeric',
    prompt: 'The number of $4$-digit integers in the closed interval $[2022, 4482]$ formed by using the digits $0, 2, 3, 4, 6, 7$ is ____.',
    answer: { value: 569 },
    inputHint: 'Enter the count',
    hints: ['Split by the thousands digit: $2$, $3$ or $4$.'],
    steps: [
      { h: 'Idea', d: 'Count by the leading digit, correcting at the two ends of the interval.' },
      { h: 'Leading 2', d: '$6^3 = 216$ numbers, minus those below $2022$: $2000, 2002, 2003, 2004, 2006, 2007, 2020$. That leaves $209$.' },
      { h: 'Leading 3', d: '$216$.' },
      { h: 'Leading 4', d: 'Second digit $0, 2, 3$: $3\\cdot36 = 108$. Second digit $4$: every $44xy$ is at most $4477 \\le 4482$: $36$. Total $144$.' },
      { h: 'Answer', d: '$209 + 216 + 144 = 569$.' }
    ]
  },
  {
    ...P1, id: 'jeeadv-2022-p1-q8', section: 'Section 1', questionNumber: 8,
    chapterId: 'c11-straight-lines', difficulty: 4, answerType: 'numeric',
    prompt: 'Let $ABC$ be the triangle with $AB = 1$, $AC = 3$ and $\\angle BAC = \\dfrac\\pi2$. If a circle of radius $r > 0$ touches the sides $AB$, $AC$ and also touches internally the circumcircle of the triangle $ABC$, then the value of $r$ is ____.',
    answer: { value: 0.84, tol: 0.02, officialRange: [0.82, 0.86] },
    inputHint: 'Enter $r$',
    hints: ['Put $A$ at the origin; the circle\'s centre is $(r, r)$.'],
    steps: [
      { h: 'Idea', d: 'Coordinates make both tangency conditions algebraic.' },
      { h: 'Set up', d: '$A = (0,0)$, $B = (1, 0)$, $C = (0, 3)$. The circumcircle has centre $M = \\left(\\frac12, \\frac32\\right)$ (midpoint of $BC$) and radius $R = \\frac{\\sqrt{10}}{2}$.' },
      { h: 'Internal tangency', d: 'The circle touching both legs has centre $(r, r)$, and $|(r, r) - M| = R - r$: $\\left(r - \\frac12\\right)^2 + \\left(r - \\frac32\\right)^2 = \\left(\\frac{\\sqrt{10}}2 - r\\right)^2$.' },
      { h: 'Solve', d: 'This simplifies to $r^2 - (4 - \\sqrt{10})r = 0$, so $r = 4 - \\sqrt{10} \\approx 0.84$.' }
    ]
  },

  // ── Paper 1 · Section 3 (matching lists) ──
  {
    ...P1, id: 'jeeadv-2022-p1-q15', section: 'Section 3', questionNumber: 15,
    chapterId: 'c11-trig-functions', difficulty: 3, answerType: 'mcq',
    prompt: 'Consider the following lists:\n\nList-I:\n(I) $\\left\\{x \\in \\left[-\\frac{2\\pi}{3}, \\frac{2\\pi}{3}\\right] : \\cos x + \\sin x = 1\\right\\}$\n(II) $\\left\\{x \\in \\left[-\\frac{5\\pi}{18}, \\frac{5\\pi}{18}\\right] : \\sqrt3\\tan3x = 1\\right\\}$\n(III) $\\left\\{x \\in \\left[-\\frac{6\\pi}{5}, \\frac{6\\pi}{5}\\right] : 2\\cos(2x) = \\sqrt3\\right\\}$\n(IV) $\\left\\{x \\in \\left[-\\frac{7\\pi}{4}, \\frac{7\\pi}{4}\\right] : \\sin x - \\cos x = 1\\right\\}$\n\nList-II: (P) has two elements; (Q) has three elements; (R) has four elements; (S) has five elements; (T) has six elements.\n\nThe correct option is:',
    mcqOptions: [
      '(I)→(P); (II)→(S); (III)→(P); (IV)→(S)',
      '(I)→(P); (II)→(P); (III)→(T); (IV)→(R)',
      '(I)→(Q); (II)→(P); (III)→(T); (IV)→(S)',
      '(I)→(Q); (II)→(S); (III)→(P); (IV)→(R)'
    ],
    answer: { correctIndex: 1 },
    hints: ['Write each equation in the form $\\sin(\\cdot)$ or $\\cos(\\cdot) = $ constant and list the solutions.'],
    steps: [
      { h: '(I)', d: '$\\sqrt2\\sin\\left(x + \\frac\\pi4\\right) = 1$ gives $x = 2k\\pi$ or $\\frac\\pi2 + 2k\\pi$. In the interval: $0, \\frac\\pi2$ — two.' },
      { h: '(II)', d: '$\\tan3x = \\frac1{\\sqrt3}$: $x = \\frac{\\pi}{18} + \\frac{k\\pi}{3}$. In $\\left[-\\frac{5\\pi}{18}, \\frac{5\\pi}{18}\\right]$: $-\\frac{5\\pi}{18}, \\frac{\\pi}{18}$ — two.' },
      { h: '(III)', d: '$\\cos2x = \\frac{\\sqrt3}2$: $x = \\pm\\frac\\pi{12} + k\\pi$. For $k = -1, 0, 1$ both signs fit: six.' },
      { h: '(IV)', d: '$\\sqrt2\\sin\\left(x - \\frac\\pi4\\right) = 1$: $x = \\frac\\pi2 + 2k\\pi$ or $\\pi + 2k\\pi$. In the interval: $-\\frac{3\\pi}2, -\\pi, \\frac\\pi2, \\pi$ — four.' },
      { h: 'Match', d: '(I)→(P), (II)→(P), (III)→(T), (IV)→(R).' }
    ]
  },
  {
    ...P1, id: 'jeeadv-2022-p1-q16', section: 'Section 3', questionNumber: 16,
    chapterId: 'c12-probability', difficulty: 4, answerType: 'mcq',
    prompt: 'Two players, $P_1$ and $P_2$, play a game against each other. In every round of the game, each player rolls a fair die once, where the six faces of the die have six distinct numbers. Let $x$ and $y$ denote the readings on the die rolled by $P_1$ and $P_2$, respectively. If $x > y$, then $P_1$ scores $5$ points and $P_2$ scores $0$ point. If $x = y$, then each player scores $2$ points. If $x < y$, then $P_1$ scores $0$ point and $P_2$ scores $5$ points. Let $X_i$ and $Y_i$ be the total scores of $P_1$ and $P_2$, respectively, after playing the $i^{\\text{th}}$ round.\n\nList-I: (I) Probability of $(X_2 \\ge Y_2)$ is; (II) Probability of $(X_2 > Y_2)$ is; (III) Probability of $(X_3 = Y_3)$ is; (IV) Probability of $(X_3 > Y_3)$ is.\n\nList-II: (P) $\\dfrac38$; (Q) $\\dfrac{11}{16}$; (R) $\\dfrac{5}{16}$; (S) $\\dfrac{355}{864}$; (T) $\\dfrac{77}{432}$.\n\nThe correct option is:',
    mcqOptions: [
      '(I)→(Q); (II)→(R); (III)→(T); (IV)→(S)',
      '(I)→(Q); (II)→(R); (III)→(T); (IV)→(T)',
      '(I)→(P); (II)→(R); (III)→(Q); (IV)→(S)',
      '(I)→(P); (II)→(R); (III)→(Q); (IV)→(T)'
    ],
    answer: { correctIndex: 0 },
    hints: ['Each round is a win ($\\frac5{12}$), a draw ($\\frac16$) or a loss ($\\frac5{12}$) for $P_1$.'],
    steps: [
      { h: 'Idea', d: 'Only the numbers of wins and losses matter; draws add the same to both.' },
      { h: 'One round', d: '$P(W) = P(L) = \\frac{15}{36} = \\frac5{12}$, $P(D) = \\frac16$.' },
      { h: 'Two rounds', d: '$X_2 > Y_2$ means more wins than losses: $WW$, $WD$, $DW$: $\\frac{25}{144} + 2\\cdot\\frac{5}{72} = \\frac{45}{144} = \\frac5{16}$. Ties: $\\frac{1}{36} + 2\\cdot\\frac{25}{144} = \\frac{54}{144}$. So $P(X_2 \\ge Y_2) = \\frac{99}{144} = \\frac{11}{16}$.' },
      { h: 'Three rounds, tie', d: '$DDD$ or one $W$, one $L$, one $D$: $\\frac1{216} + 6\\cdot\\frac{25}{144}\\cdot\\frac16 = \\frac{1}{216} + \\frac{25}{144} = \\frac{77}{432}$.' },
      { h: 'Three rounds, ahead', d: 'By symmetry, $P(X_3 > Y_3) = \\frac12\\left(1 - \\frac{77}{432}\\right) = \\frac{355}{864}$.' },
      { h: 'Match', d: '(I)→(Q), (II)→(R), (III)→(T), (IV)→(S).' }
    ]
  },
  {
    ...P1, id: 'jeeadv-2022-p1-q17', section: 'Section 3', questionNumber: 17,
    chapterId: 'c12-determinants', difficulty: 4, answerType: 'mcq',
    prompt: 'Let $p, q, r$ be nonzero real numbers that are, respectively, the $10^{\\text{th}}$, $100^{\\text{th}}$ and $1000^{\\text{th}}$ terms of a harmonic progression. Consider the system of linear equations\n\n$x + y + z = 1$\n$10x + 100y + 1000z = 0$\n$qr\\,x + pr\\,y + pq\\,z = 0$.\n\nList-I: (I) If $\\frac qr = 10$, then the system of linear equations has; (II) If $\\frac pr \\ne 100$, then the system of linear equations has; (III) If $\\frac pq \\ne 10$, then the system of linear equations has; (IV) If $\\frac pq = 10$, then the system of linear equations has.\n\nList-II: (P) $x = 0$, $y = \\frac{10}{9}$, $z = -\\frac19$ as a solution; (Q) $x = \\frac{10}{9}$, $y = -\\frac19$, $z = 0$ as a solution; (R) infinitely many solutions; (S) no solution; (T) at least one solution.\n\nThe correct option is:',
    mcqOptions: [
      '(I)→(T); (II)→(R); (III)→(S); (IV)→(T)',
      '(I)→(Q); (II)→(S); (III)→(S); (IV)→(R)',
      '(I)→(Q); (II)→(R); (III)→(P); (IV)→(R)',
      '(I)→(T); (II)→(S); (III)→(P); (IV)→(T)'
    ],
    answer: { correctIndex: 1 },
    hints: ['Write $\\frac1p = a + 9d$, $\\frac1q = a + 99d$, $\\frac1r = a + 999d$ and divide the third equation by $pqr$.'],
    steps: [
      { h: 'Idea', d: 'The third equation is a combination of the first two plus a multiple of $a - d$.' },
      { h: 'Third equation', d: 'Dividing by $pqr$: $\\frac xp + \\frac yq + \\frac zr = a(x + y + z) + d(9x + 99y + 999z) = 0$.' },
      { h: 'Use equation 2', d: '$9x + 99y + 999z = (10x + 100y + 1000z) - (x + y + z) = -(x + y + z)$, so the third equation reads $(a - d)(x + y + z) = 0$.' },
      { h: 'Cases', d: 'If $a = d$ (equivalently $\\frac qr = 10$, $\\frac pr = 100$, $\\frac pq = 10$), it is redundant: infinitely many solutions, including $\\left(\\frac{10}9, -\\frac19, 0\\right)$. If $a \\ne d$ it contradicts $x + y + z = 1$: no solution.' },
      { h: 'Match', d: '(I)→(Q), (II)→(S), (III)→(S), (IV)→(R).' }
    ]
  },
  {
    ...P1, id: 'jeeadv-2022-p1-q18', section: 'Section 3', questionNumber: 18,
    chapterId: 'c11-conic-sections', difficulty: 4, answerType: 'mcq',
    prompt: 'Consider the ellipse\n\n$\\dfrac{x^2}{4} + \\dfrac{y^2}{3} = 1.$\n\nLet $H(\\alpha, 0)$, $0 < \\alpha < 2$, be a point. A straight line drawn through $H$ parallel to the $y$-axis crosses the ellipse and its auxiliary circle at points $E$ and $F$ respectively, in the first quadrant. The tangent to the ellipse at the point $E$ intersects the positive $x$-axis at a point $G$. Suppose the straight line joining $F$ and the origin makes an angle $\\phi$ with the positive $x$-axis.\n\nList-I: (I) If $\\phi = \\frac\\pi4$, then the area of the triangle $FGH$ is; (II) If $\\phi = \\frac\\pi3$, then the area of the triangle $FGH$ is; (III) If $\\phi = \\frac\\pi6$, then the area of the triangle $FGH$ is; (IV) If $\\phi = \\frac{\\pi}{12}$, then the area of the triangle $FGH$ is.\n\nList-II: (P) $\\dfrac{(\\sqrt3 - 1)^4}{8}$; (Q) $1$; (R) $\\dfrac34$; (S) $\\dfrac{1}{2\\sqrt3}$; (T) $\\dfrac{3\\sqrt3}{2}$.\n\nThe correct option is:',
    mcqOptions: [
      '(I)→(R); (II)→(S); (III)→(Q); (IV)→(P)',
      '(I)→(R); (II)→(T); (III)→(S); (IV)→(P)',
      '(I)→(Q); (II)→(T); (III)→(S); (IV)→(P)',
      '(I)→(Q); (II)→(S); (III)→(Q); (IV)→(P)'
    ],
    answer: { correctIndex: 2 },
    hints: ['$F$ is $(2\\cos\\phi, 2\\sin\\phi)$ and $E$ is $(2\\cos\\phi, \\sqrt3\\sin\\phi)$ — the eccentric angle.'],
    steps: [
      { h: 'Idea', d: '$\\phi$ is exactly the eccentric angle of $E$, which makes the tangent easy.' },
      { h: 'Points', d: '$H = (2\\cos\\phi, 0)$, $F = (2\\cos\\phi, 2\\sin\\phi)$, $E = (2\\cos\\phi, \\sqrt3\\sin\\phi)$.' },
      { h: 'Point $G$', d: 'The tangent $\\frac{x\\cos\\phi}{2} + \\frac{y\\sin\\phi}{\\sqrt3} = 1$ meets $y = 0$ at $G = \\left(\\frac{2}{\\cos\\phi}, 0\\right)$.' },
      { h: 'Area', d: '$\\frac12\\cdot HG\\cdot HF = \\frac12\\cdot\\frac{2\\sin^2\\phi}{\\cos\\phi}\\cdot2\\sin\\phi = \\dfrac{2\\sin^3\\phi}{\\cos\\phi}$.' },
      { h: 'Evaluate', d: '$\\frac\\pi4$: $1$. $\\frac\\pi3$: $\\frac{3\\sqrt3}{2}$. $\\frac\\pi6$: $\\frac{1}{2\\sqrt3}$. $\\frac\\pi{12}$: $\\frac{(\\sqrt3 - 1)^4}{8}$ (both $\\approx 0.0359$).' },
      { h: 'Match', d: '(I)→(Q), (II)→(T), (III)→(S), (IV)→(P).' }
    ]
  },

  // ── Paper 2 · Section 1 (single-digit integer) ──
  {
    ...P2, id: 'jeeadv-2022-p2-q1', section: 'Section 1', questionNumber: 1,
    chapterId: 'c11-trig-functions', difficulty: 4, answerType: 'numeric',
    prompt: 'Let $\\alpha$ and $\\beta$ be real numbers such that $-\\dfrac\\pi4 < \\beta < 0 < \\alpha < \\dfrac\\pi4$. If $\\sin(\\alpha + \\beta) = \\dfrac13$ and $\\cos(\\alpha - \\beta) = \\dfrac23$, then the greatest integer less than or equal to\n\n$\\left(\\dfrac{\\sin\\alpha}{\\cos\\beta} + \\dfrac{\\cos\\beta}{\\sin\\alpha} + \\dfrac{\\cos\\alpha}{\\sin\\beta} + \\dfrac{\\sin\\beta}{\\cos\\alpha}\\right)^2$\n\nis ____.',
    answer: { value: 1 },
    inputHint: 'Enter the integer',
    hints: ['Let $X = \\sin\\alpha\\cos\\beta$ and $Y = \\cos\\alpha\\sin\\beta$; then $X + Y$ and $X - Y$ are known.'],
    steps: [
      { h: 'Idea', d: 'Pair the terms over the common denominators $X = \\sin\\alpha\\cos\\beta$ and $Y = \\cos\\alpha\\sin\\beta$.' },
      { h: 'Known values', d: '$X + Y = \\sin(\\alpha + \\beta) = \\frac13$; $X - Y = \\sin(\\alpha - \\beta) = \\frac{\\sqrt5}{3}$ (as $0 < \\alpha - \\beta < \\frac\\pi2$). So $X = \\frac{1 + \\sqrt5}{6}$, $Y = \\frac{1 - \\sqrt5}{6}$.' },
      { h: 'Numerators', d: '$\\sin^2\\alpha + \\cos^2\\beta = 1 + \\sin(\\alpha + \\beta)\\sin(\\alpha - \\beta) = 1 + \\frac{\\sqrt5}9$ and $\\cos^2\\alpha + \\sin^2\\beta = 1 - \\frac{\\sqrt5}{9}$.' },
      { h: 'Sum', d: '$\\dfrac{1 + \\frac{\\sqrt5}9}{X} + \\dfrac{1 - \\frac{\\sqrt5}9}{Y} = \\dfrac{6\\left[(1 + \\frac{\\sqrt5}9)(1 - \\sqrt5) + (1 - \\frac{\\sqrt5}9)(1 + \\sqrt5)\\right]}{-4} = -\\dfrac43$.' },
      { h: 'Answer', d: 'The square is $\\frac{16}{9} \\approx 1.78$, whose integer part is $1$.' }
    ]
  },
  {
    ...P2, id: 'jeeadv-2022-p2-q2', section: 'Section 1', questionNumber: 2,
    chapterId: 'c12-differential-equations', difficulty: 3, answerType: 'numeric',
    prompt: 'If $y(x)$ is the solution of the differential equation\n\n$x\\,dy - (y^2 - 4y)\\,dx = 0$ for $x > 0$, $y(1) = 2$,\n\nand the slope of the curve $y = y(x)$ is never zero, then the value of $10\\,y(\\sqrt2)$ is ____.',
    answer: { value: 8 },
    inputHint: 'Enter the integer',
    hints: ['Separate: $\\dfrac{dy}{y(y - 4)} = \\dfrac{dx}{x}$.'],
    steps: [
      { h: 'Idea', d: 'Separate variables and use partial fractions.' },
      { h: 'Integrate', d: '$\\frac14\\left(\\frac1{y - 4} - \\frac1y\\right)dy = \\frac{dx}x$ gives $\\log\\left|\\frac{y - 4}{y}\\right| = 4\\log x + C$.' },
      { h: 'Constant', d: 'At $x = 1$, $\\frac{y - 4}{y} = -1$, so $\\frac{y - 4}{y} = -x^4$ and $y = \\dfrac{4}{1 + x^4}$ (non-constant, so its slope is never zero for $x > 0$).' },
      { h: 'Answer', d: '$y(\\sqrt2) = \\frac45$, so $10y(\\sqrt2) = 8$.' }
    ]
  },
  {
    ...P2, id: 'jeeadv-2022-p2-q3', section: 'Section 1', questionNumber: 3,
    chapterId: 'c12-integrals', difficulty: 4, answerType: 'numeric',
    prompt: 'The greatest integer less than or equal to\n\n$\\displaystyle\\int_1^2 \\log_2(x^3 + 1)\\,dx + \\int_1^{\\log_2 9}\\left(2^x - 1\\right)^{1/3}dx$\n\nis ____.',
    answer: { value: 5 },
    inputHint: 'Enter the integer',
    hints: ['The two integrands are inverse functions of each other.'],
    steps: [
      { h: 'Idea', d: '$\\int_a^b f + \\int_{f(a)}^{f(b)} f^{-1} = bf(b) - af(a)$ for an increasing $f$.' },
      { h: 'The pair', d: '$f(x) = \\log_2(x^3 + 1)$ has $f(1) = 1$, $f(2) = \\log_2 9$ and inverse $f^{-1}(y) = (2^y - 1)^{1/3}$.' },
      { h: 'Rectangles', d: 'The sum is $2\\log_2 9 - 1\\cdot1 = 4\\log_2 3 - 1 \\approx 5.34$.' },
      { h: 'Answer', d: '$5$.' }
    ]
  },
  {
    ...P2, id: 'jeeadv-2022-p2-q4', section: 'Section 1', questionNumber: 4,
    chapterId: 'c11-relations-functions', difficulty: 3, answerType: 'numeric',
    prompt: 'The product of all positive real values of $x$ satisfying the equation\n\n$x^{\\left(16(\\log_5 x)^3 - 68\\log_5 x\\right)} = 5^{-16}$\n\nis ____.',
    answer: { value: 1 },
    inputHint: 'Enter the integer',
    hints: ['Take $\\log_5$ of both sides and set $t = \\log_5 x$.'],
    steps: [
      { h: 'Idea', d: 'In $t = \\log_5 x$ the equation is a biquadratic, and the product of the $x$ values is $5^{\\text{sum of the } t}$.' },
      { h: 'Take logs', d: '$t(16t^3 - 68t) = -16$, i.e. $4t^4 - 17t^2 + 4 = 0$.' },
      { h: 'Solve', d: '$t^2 = 4$ or $\\frac14$: $t = \\pm2, \\pm\\frac12$.' },
      { h: 'Answer', d: 'The $t$ values sum to $0$, so the product of the $x$ values is $5^0 = 1$.' }
    ]
  },
  {
    ...P2, id: 'jeeadv-2022-p2-q5', section: 'Section 1', questionNumber: 5,
    chapterId: 'c11-limits-derivatives', difficulty: 3, answerType: 'numeric',
    prompt: 'If\n\n$\\beta = \\displaystyle\\lim_{x\\to0}\\frac{e^{x^3} - (1 - x^3)^{1/3} + \\left((1 - x^2)^{1/2} - 1\\right)\\sin x}{x\\sin^2 x},$\n\nthen the value of $6\\beta$ is ____.',
    answer: { value: 5 },
    inputHint: 'Enter the integer',
    hints: ['Expand every piece to order $x^3$.'],
    steps: [
      { h: 'Idea', d: 'The denominator is $\\sim x^3$, so only the $x^3$ terms of the numerator matter.' },
      { h: 'Expand', d: '$e^{x^3} = 1 + x^3 + \\cdots$, $(1 - x^3)^{1/3} = 1 - \\frac{x^3}{3} + \\cdots$, $\\left((1 - x^2)^{1/2} - 1\\right)\\sin x = -\\frac{x^2}{2}\\cdot x + \\cdots$.' },
      { h: 'Numerator', d: '$x^3\\left(1 + \\frac13 - \\frac12\\right) + \\cdots = \\frac56x^3 + \\cdots$.' },
      { h: 'Answer', d: '$\\beta = \\frac56$, so $6\\beta = 5$.' }
    ]
  },
  {
    ...P2, id: 'jeeadv-2022-p2-q6', section: 'Section 1', questionNumber: 6,
    chapterId: 'c12-matrices', difficulty: 4, answerType: 'numeric',
    prompt: 'Let $\\beta$ be a real number. Consider the matrix\n\n$A = \\begin{pmatrix}\\beta & 0 & 1\\\\ 2 & 1 & -2\\\\ 3 & 1 & -2\\end{pmatrix}.$\n\nIf $A^7 - (\\beta - 1)A^6 - \\beta A^5$ is a singular matrix, then the value of $9\\beta$ is ____.',
    answer: { value: 3 },
    inputHint: 'Enter the integer',
    hints: ['Factor: $A^5(A - \\beta I)(A + I)$.'],
    steps: [
      { h: 'Idea', d: 'Factor the matrix polynomial and find which factor can be singular.' },
      { h: 'Factor', d: '$A^7 - (\\beta - 1)A^6 - \\beta A^5 = A^5(A^2 - (\\beta - 1)A - \\beta I) = A^5(A - \\beta I)(A + I)$.' },
      { h: 'Two factors are invertible', d: '$\\det A = \\beta(0) - 0 + 1(2 - 3) = -1$, and $\\det(A + I) = (\\beta + 1)\\cdot0 + 1\\cdot(2 - 6) = -4$.' },
      { h: 'The third', d: '$\\det(A - \\beta I) = \\begin{vmatrix}0 & 0 & 1\\\\ 2 & 1 - \\beta & -2\\\\ 3 & 1 & -2 - \\beta\\end{vmatrix} = 2 - 3(1 - \\beta) = 3\\beta - 1 = 0$.' },
      { h: 'Answer', d: '$\\beta = \\frac13$, so $9\\beta = 3$.' }
    ]
  },
  {
    ...P2, id: 'jeeadv-2022-p2-q7', section: 'Section 1', questionNumber: 7,
    chapterId: 'c11-conic-sections', difficulty: 4, answerType: 'numeric',
    prompt: 'Consider the hyperbola\n\n$\\dfrac{x^2}{100} - \\dfrac{y^2}{64} = 1$\n\nwith foci at $S$ and $S_1$, where $S$ lies on the positive $x$-axis. Let $P$ be a point on the hyperbola, in the first quadrant. Let $\\angle SPS_1 = \\alpha$, with $\\alpha < \\dfrac\\pi2$. The straight line passing through the point $S$ and having the same slope as that of the tangent at $P$ to the hyperbola, intersects the straight line $S_1P$ at $P_1$. Let $\\delta$ be the distance of $P$ from the straight line $SP_1$, and $\\beta = S_1P$. Then the greatest integer less than or equal to $\\dfrac{\\beta\\delta}{9}\\sin\\dfrac\\alpha2$ is ____.',
    answer: { value: 7 },
    inputHint: 'Enter the integer',
    hints: ['The tangent at $P$ bisects $\\angle SPS_1$, so triangle $PSP_1$ is isosceles.'],
    steps: [
      { h: 'Idea', d: 'The tangent bisects the focal angle; the parallel line through $S$ makes an isosceles triangle, and the law of cosines finishes it.' },
      { h: 'Isosceles triangle', d: 'With $r_1 = PS$, $r_2 = PS_1 = \\beta$: $SP_1$ makes angle $\\frac\\alpha2$ with both $PS$ and $PS_1$, so $PP_1 = PS = r_1$ and $\\delta = r_1\\sin\\frac\\alpha2$.' },
      { h: 'Law of cosines', d: '$(2c)^2 = r_1^2 + r_2^2 - 2r_1r_2\\cos\\alpha = (r_2 - r_1)^2 + 4r_1r_2\\sin^2\\frac\\alpha2$, with $r_2 - r_1 = 2a$.' },
      { h: 'Simplify', d: '$r_1r_2\\sin^2\\frac\\alpha2 = c^2 - a^2 = b^2 = 64$, so $\\dfrac{\\beta\\delta}{9}\\sin\\dfrac\\alpha2 = \\dfrac{64}{9} \\approx 7.11$.' },
      { h: 'Answer', d: '$7$.' }
    ]
  },
  {
    ...P2, id: 'jeeadv-2022-p2-q8', section: 'Section 1', questionNumber: 8,
    chapterId: 'c12-applications-integrals', difficulty: 3, answerType: 'numeric',
    prompt: 'Consider the functions $f, g:\\mathbb R \\to \\mathbb R$ defined by\n\n$f(x) = x^2 + \\dfrac{5}{12}$ and $g(x) = \\begin{cases} 2\\left(1 - \\dfrac{4|x|}{3}\\right), & |x| \\le \\dfrac34,\\\\ 0, & |x| > \\dfrac34.\\end{cases}$\n\nIf $\\alpha$ is the area of the region\n\n$\\left\\{(x, y) \\in \\mathbb R \\times \\mathbb R : |x| \\le \\dfrac34,\\ 0 \\le y \\le \\min\\{f(x), g(x)\\}\\right\\},$\n\nthen the value of $9\\alpha$ is ____.',
    answer: { value: 6 },
    inputHint: 'Enter the integer',
    hints: ['Find where the parabola meets the triangle for $x \\ge 0$; double at the end.'],
    steps: [
      { h: 'Idea', d: 'The lower of the two graphs switches from the parabola to the triangle\'s edge at one point on each side.' },
      { h: 'Crossing', d: 'For $x \\ge 0$: $x^2 + \\frac5{12} = 2 - \\frac{8x}3$, i.e. $12x^2 + 32x - 19 = 0$, so $x = \\frac12$.' },
      { h: 'Right half', d: '$\\displaystyle\\int_0^{1/2}\\left(x^2 + \\frac5{12}\\right)dx = \\frac1{24} + \\frac5{24} = \\frac14$, plus the triangle from $\\frac12$ to $\\frac34$ of height $\\frac23$: $\\frac1{12}$. Total $\\frac13$.' },
      { h: 'Answer', d: '$\\alpha = \\frac23$ by symmetry, so $9\\alpha = 6$.' }
    ]
  },

  // ── Paper 2 · Section 3 (single correct) ──
  {
    ...P2, id: 'jeeadv-2022-p2-q15', section: 'Section 3', questionNumber: 15,
    chapterId: 'c11-permutations-combinations', difficulty: 4, answerType: 'mcq',
    prompt: 'Consider $4$ boxes, where each box contains $3$ red balls and $2$ blue balls. Assume that all $20$ balls are distinct. In how many different ways can $10$ balls be chosen from these $4$ boxes so that from each box at least one red ball and one blue ball are chosen?',
    mcqOptions: ['$21816$', '$85536$', '$12096$', '$156816$'],
    answer: { correctIndex: 0 },
    hints: ['Each box gives at least $2$ balls; distribute the $2$ extra balls.'],
    steps: [
      { h: 'Idea', d: 'Count ways per box by how many balls it gives, then distribute the total of $10$.' },
      { h: 'Per box', d: '$2$ balls (1R1B): $3\\cdot2 = 6$. $3$ balls: $\\binom32\\cdot2 + 3\\cdot1 = 9$. $4$ balls: $1\\cdot2 + 3\\cdot1 = 5$.' },
      { h: 'Distribute', d: 'Sizes are $2 + $ extras with extras summing to $2$: one box gets $2$ extra ($4$ ways): $4\\cdot5\\cdot6^3 = 4320$; two boxes get $1$ each ($6$ ways): $6\\cdot9^2\\cdot6^2 = 17496$.' },
      { h: 'Answer', d: '$4320 + 17496 = 21816$.' }
    ]
  },
  {
    ...P2, id: 'jeeadv-2022-p2-q16', section: 'Section 3', questionNumber: 16,
    chapterId: 'c12-matrices', difficulty: 3, answerType: 'mcq',
    prompt: 'If $M = \\begin{pmatrix}\\frac52 & \\frac32\\\\ -\\frac32 & -\\frac12\\end{pmatrix}$, then which of the following matrices is equal to $M^{2022}$?',
    mcqOptions: [
      '$\\begin{pmatrix}3034 & 3033\\\\ -3033 & -3032\\end{pmatrix}$',
      '$\\begin{pmatrix}3034 & -3033\\\\ 3033 & -3032\\end{pmatrix}$',
      '$\\begin{pmatrix}3033 & 3032\\\\ -3032 & -3031\\end{pmatrix}$',
      '$\\begin{pmatrix}3032 & 3031\\\\ -3031 & -3030\\end{pmatrix}$'
    ],
    answer: { correctIndex: 0 },
    hints: ['Write $M = I + N$ and compute $N^2$.'],
    steps: [
      { h: 'Idea', d: '$M - I$ squares to zero, so the binomial expansion stops after two terms.' },
      { h: 'Nilpotent part', d: '$N = M - I = \\frac32\\begin{pmatrix}1 & 1\\\\ -1 & -1\\end{pmatrix}$ and $N^2 = 0$.' },
      { h: 'Power', d: '$M^{2022} = I + 2022N = \\begin{pmatrix}1 + 3033 & 3033\\\\ -3033 & 1 - 3033\\end{pmatrix}$.' },
      { h: 'Answer', d: '$\\begin{pmatrix}3034 & 3033\\\\ -3033 & -3032\\end{pmatrix}$.' }
    ]
  },
  {
    ...P2, id: 'jeeadv-2022-p2-q17', section: 'Section 3', questionNumber: 17,
    chapterId: 'c12-probability', difficulty: 3, answerType: 'mcq',
    prompt: 'Suppose that\n\nBox-I contains $8$ red, $3$ blue and $5$ green balls,\nBox-II contains $24$ red, $9$ blue and $15$ green balls,\nBox-III contains $1$ blue, $12$ green and $3$ yellow balls,\nBox-IV contains $10$ green, $16$ orange and $6$ white balls.\n\nA ball is chosen randomly from Box-I; call this ball $b$. If $b$ is red then a ball is chosen randomly from Box-II, if $b$ is blue then a ball is chosen randomly from Box-III, and if $b$ is green then a ball is chosen randomly from Box-IV. The conditional probability of the event \'one of the chosen balls is white\' given that the event \'at least one of the chosen balls is green\' has happened, is equal to',
    mcqOptions: ['$\\dfrac{15}{256}$', '$\\dfrac{3}{16}$', '$\\dfrac{5}{52}$', '$\\dfrac18$'],
    answer: { correctIndex: 2 },
    hints: ['A white ball is possible only when $b$ is green — and then a green ball has already been chosen.'],
    steps: [
      { h: 'Idea', d: 'White forces the route through Box-IV, which already contains the green condition.' },
      { h: 'At least one green', d: '$\\frac12\\cdot\\frac{15}{48} + \\frac{3}{16}\\cdot\\frac{12}{16} + \\frac{5}{16} = \\frac{10}{64} + \\frac{9}{64} + \\frac{20}{64} = \\frac{39}{64}$.' },
      { h: 'White and green', d: '$\\frac5{16}\\cdot\\frac{6}{32} = \\frac{15}{256}$.' },
      { h: 'Answer', d: '$\\dfrac{15/256}{39/64} = \\dfrac{15}{156} = \\dfrac{5}{52}$.' }
    ]
  },
  {
    ...P2, id: 'jeeadv-2022-p2-q18', section: 'Section 3', questionNumber: 18,
    chapterId: 'c12-integrals', difficulty: 4, answerType: 'mcq',
    prompt: 'For positive integer $n$, define\n\n$f(n) = n + \\dfrac{16 + 5n - 3n^2}{4n + 3n^2} + \\dfrac{32 + n - 3n^2}{8n + 3n^2} + \\dfrac{48 - 3n - 3n^2}{12n + 3n^2} + \\cdots + \\dfrac{25n - 7n^2}{7n^2}.$\n\nThen, the value of $\\displaystyle\\lim_{n\\to\\infty} f(n)$ is equal to',
    mcqOptions: ['$3 + \\dfrac43\\log_e 7$', '$4 - \\dfrac34\\log_e\\left(\\dfrac73\\right)$', '$4 - \\dfrac43\\log_e\\left(\\dfrac73\\right)$', '$3 + \\dfrac34\\log_e 7$'],
    answer: { correctIndex: 1 },
    hints: ['The $k$-th fraction is $\\dfrac{16k + (9 - 4k)n - 3n^2}{4kn + 3n^2}$, for $k = 1, \\ldots, n$.'],
    steps: [
      { h: 'Idea', d: 'Absorb the leading $n$ into the $n$ fractions; what remains is a Riemann sum.' },
      { h: 'General term', d: 'The $k$-th fraction equals $-1 + \\dfrac{16k + 9n}{4kn + 3n^2}$; the $-1$\'s cancel the leading $n$.' },
      { h: 'Riemann sum', d: '$f(n) = \\dfrac1n\\displaystyle\\sum_{k=1}^n\\frac{16\\frac kn + 9}{4\\frac kn + 3} \\to \\int_0^1\\frac{16x + 9}{4x + 3}\\,dx$.' },
      { h: 'Integrate', d: '$\\displaystyle\\int_0^1\\left(4 - \\frac{3}{4x + 3}\\right)dx = 4 - \\frac34\\log_e\\frac73$.' }
    ]
  }
]);
