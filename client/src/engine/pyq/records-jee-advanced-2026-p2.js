// Pri Learning · JEE Advanced 2026 · Paper 2 · Mathematics
//
// Transcribed from the Joint Admission Board's own "final key" document for
// Paper 2 (pyqSources.js: jeeadv-2026-p2-answers), which prints each question
// and its final answer on the same page — reading the rendered page, not a text
// layer. The worked steps are Pri Learning's own (PYQ_STEPS_AUTHORSHIP).
//
// Left out, and why (the archive carries single-correct MCQ and numerical
// value only — the two contracts it can prove checker.js marks):
//   · Q5–Q9 (Section 2) are "one or more correct" questions with JEE partial
//     marking. The archive has no multiple-correct contract.

import { PYQ_PROVENANCE } from './pyqSources.js';

const ADV_2026_P2 = Object.freeze({
  examId: 'jee-advanced',
  year: 2026,
  paper: '2',
  provenance: PYQ_PROVENANCE.OFFICIAL_PAPER_AND_KEY,
  pastPaper: true,
  promptSource: 'jeeadv-2026-p2-answers',
  answerSource: 'jeeadv-2026-p2-answers'
});

const STEM_15_16 = 'Consider the curve $C_1$ given by $y = e^{-x}$ for $x \\in [0, 10\\pi]$, and the curve $C_2$ given by $y = e^{-x}(\\sin x + \\cos x)$ for $x \\in [0, 10\\pi]$. Let $n$ be the total number of points of intersection of the curves $C_1$ and $C_2$. Suppose that $\\alpha_1, \\alpha_2, \\ldots, \\alpha_n \\in [0, 10\\pi]$ are the $x$-coordinates of the points of intersection of the curves $C_1$ and $C_2$ such that $\\alpha_1 < \\alpha_2 < \\cdots < \\alpha_n$.';

const STEM_17_18 = 'Consider the ellipses given by $x^2 + 4y^2 = 1$ and $4x^2 + y^2 = 1$.';

export const JEE_ADVANCED_2026_P2_RECORDS = Object.freeze([
  // ── Section 1 (single correct) ──
  {
    ...ADV_2026_P2,
    id: 'jeeadv-2026-p2-q1',
    section: 'Section 1',
    questionNumber: 1,
    chapterId: 'c12-vector-algebra',
    difficulty: 3,
    answerType: 'mcq',
    prompt: 'Let $\\vec a, \\vec b$ be two vectors, and let $P, Q$ and $R$ be the points with position vectors $\\vec a$, $\\vec b$ and $\\vec a + \\vec b$, respectively, with respect to the origin $O$. If $|\\vec a + \\vec b| = \\sqrt{21}$, $|\\vec a - \\vec b| = 3$, and $\\vec a$ and $(\\vec a - \\vec b)$ are perpendicular to each other, then the area of the triangle $OPR$ is',
    mcqOptions: ['$\\sqrt{3}$', '$\\dfrac{\\sqrt{3}}{2}$', '$\\dfrac{3\\sqrt{3}}{2}$', '$\\dfrac{3}{2}$'],
    answer: { correctIndex: 2 },
    hints: ['Turn the three conditions into equations for $|\\vec a|^2$, $|\\vec b|^2$ and $\\vec a\\cdot\\vec b$.'],
    steps: [
      { h: 'Area as a cross product', d: 'Area $= \\tfrac12|\\vec a \\times (\\vec a + \\vec b)| = \\tfrac12|\\vec a \\times \\vec b|$, since $\\vec a \\times \\vec a = \\vec 0$.' },
      { h: 'Use the two lengths', d: 'Adding and subtracting $|\\vec a+\\vec b|^2 = 21$ and $|\\vec a-\\vec b|^2 = 9$ gives $|\\vec a|^2 + |\\vec b|^2 = 15$ and $\\vec a\\cdot\\vec b = 3$.' },
      { h: 'Use the right angle', d: '$\\vec a\\cdot(\\vec a-\\vec b) = 0$ gives $|\\vec a|^2 = \\vec a\\cdot\\vec b = 3$, so $|\\vec b|^2 = 12$.' },
      { h: 'Lagrange identity', d: '$|\\vec a\\times\\vec b|^2 = |\\vec a|^2|\\vec b|^2 - (\\vec a\\cdot\\vec b)^2 = 36 - 9 = 27$, so $|\\vec a\\times\\vec b| = 3\\sqrt3$ and the area is $\\dfrac{3\\sqrt3}{2}$.' }
    ]
  },
  {
    ...ADV_2026_P2,
    id: 'jeeadv-2026-p2-q2',
    section: 'Section 1',
    questionNumber: 2,
    chapterId: 'c11-conic-sections',
    difficulty: 3,
    answerType: 'mcq',
    prompt: 'Let $T$ be the tangent to the parabola $y^2 = 16x$ at the point $(64, 32)$. Let $L$ be the tangent to the same parabola at another point $(x_1, y_1)$ on the parabola. If $L$ and $T$ are perpendicular to each other, then the distance between the point $(x_1, y_1)$ and the focus of the parabola, is',
    mcqOptions: ['$\\dfrac{15}{4}$', '$4$', '$\\dfrac{17}{4}$', '$5$'],
    answer: { correctIndex: 2 },
    hints: ['Use the parametric point $(4t^2, 8t)$; perpendicular tangents have $t_1t_2 = -1$.'],
    steps: [
      { h: 'Parametrise', d: 'For $y^2 = 4ax$ with $a = 4$, a point is $(4t^2, 8t)$ and the tangent there has slope $\\dfrac1t$. The point $(64, 32)$ has $t = 4$.' },
      { h: 'Perpendicular tangent', d: 'Slopes $\\dfrac14$ and $\\dfrac1{t_1}$ multiply to $-1$ when $t_1 = -\\dfrac14$, giving $(x_1, y_1) = \\left(\\dfrac14, -2\\right)$.' },
      { h: 'Focal distance', d: 'The distance from a point of the parabola to its focus $(4, 0)$ equals its distance to the directrix $x = -4$, which is $x_1 + 4 = \\dfrac{17}{4}$.' }
    ]
  },
  {
    ...ADV_2026_P2,
    id: 'jeeadv-2026-p2-q3',
    section: 'Section 1',
    questionNumber: 3,
    chapterId: 'c12-differential-equations',
    difficulty: 4,
    answerType: 'mcq',
    prompt: 'Let $y : (-\\infty, \\infty) \\to (0, \\infty)$ be the solution of the differential equation\n\n$\\dfrac{dy}{dx} = \\dfrac{e^{5x}y^3 + y^3}{e^x + e^x y^4},$\n\nsatisfying $y(0) = \\dfrac{1}{\\sqrt2}$. Then the value of $y(\\log_e 2)$ is',
    mcqOptions: ['$\\sqrt{\\dfrac{5 + \\sqrt{35}}{2}}$', '$\\sqrt{\\dfrac{7 + \\sqrt{53}}{2}}$', '$\\dfrac{7 + \\sqrt{53}}{2}$', '$\\dfrac{5 + \\sqrt{35}}{2}$'],
    answer: { correctIndex: 1 },
    hints: ['Factor $y^3$ from the top and $e^x$ from the bottom — the equation separates.'],
    steps: [
      { h: 'Separate', d: '$\\dfrac{dy}{dx} = \\dfrac{y^3(e^{5x} + 1)}{e^x(1 + y^4)}$, so $\\dfrac{1 + y^4}{y^3}\\,dy = (e^{4x} + e^{-x})\\,dx$.' },
      { h: 'Integrate', d: '$-\\dfrac{1}{2y^2} + \\dfrac{y^2}{2} = \\dfrac{e^{4x}}{4} - e^{-x} + C$.' },
      { h: 'Fix the constant', d: 'At $x = 0$, $y^2 = \\tfrac12$: the left side is $-1 + \\tfrac14 = -\\tfrac34$ and the right side is $\\tfrac14 - 1 + C$, so $C = 0$.' },
      { h: 'Evaluate at $x = \\log_e 2$', d: 'The right side is $\\dfrac{16}{4} - \\dfrac12 = \\dfrac72$. With $u = y^2$: $u - \\dfrac1u = 7$, so $u^2 - 7u - 1 = 0$ and $u = \\dfrac{7 + \\sqrt{53}}{2}$ (the positive root).' },
      { h: 'Answer', d: 'Since $y > 0$, $y(\\log_e 2) = \\sqrt{\\dfrac{7 + \\sqrt{53}}{2}}$.' }
    ]
  },
  {
    ...ADV_2026_P2,
    id: 'jeeadv-2026-p2-q4',
    section: 'Section 1',
    questionNumber: 4,
    chapterId: 'c12-integrals',
    difficulty: 3,
    answerType: 'mcq',
    prompt: 'The value of the definite integral\n\n$\\displaystyle\\int_0^2 \\frac{1}{3^x + 3}\\,dx$\n\nis',
    mcqOptions: ['$\\dfrac12$', '$\\dfrac13$', '$\\dfrac{\\log_e 3}{3}$', '$\\dfrac{\\log_e 3}{2}$'],
    answer: { correctIndex: 1 },
    hints: ['Try the property $\\int_0^a f(x)\\,dx = \\int_0^a f(a - x)\\,dx$.'],
    steps: [
      { h: 'Reflect', d: 'With $x \\to 2 - x$: $\\dfrac{1}{3^{2-x} + 3} = \\dfrac{3^x}{9 + 3\\cdot3^x} = \\dfrac13\\cdot\\dfrac{3^x}{3^x + 3}$.' },
      { h: 'Add the two forms', d: 'The integrand and its reflection add to $\\dfrac{1}{3^x+3} + \\dfrac{3^x}{3(3^x+3)} = \\dfrac{3 + 3^x}{3(3^x+3)} = \\dfrac13$.' },
      { h: 'Conclude', d: 'So $I + I = \\displaystyle\\int_0^2 \\tfrac13\\,dx = \\tfrac23$, and $I = \\dfrac13$.' }
    ]
  },

  // ── Section 3 (numerical value) ──
  {
    ...ADV_2026_P2,
    id: 'jeeadv-2026-p2-q10',
    section: 'Section 3',
    questionNumber: 10,
    chapterId: 'c12-relations-functions',
    difficulty: 4,
    answerType: 'numeric',
    prompt: 'Let $\\mathbb N$ denote the set of all positive integers. Consider the sets $A = \\{1, 2, 3, 4, 5\\}$ and $B = \\{1, 2, 3, 4, 5, 6, 7\\}$. Let $S$ be the set of all functions $f : A \\to B$ such that $f(2) \\ne 2$ and $f(4) \\ne 4$. Consider the set\n\n$T = \\{f \\in S :$ there exists a function $g : B \\to \\mathbb N$ such that $g(f(x)) = 2^x$ for all $x \\in A\\}$.\n\nThen the number of elements in the set $T$ is ____.',
    answer: { value: 1860 },
    inputHint: 'Enter the number of functions',
    hints: ['If $f(x) = f(y)$ then $g(f(x)) = g(f(y))$. What does that force?'],
    steps: [
      { h: 'What $g$ needs', d: 'If $f(x) = f(y)$ for $x \\ne y$ then $2^x = g(f(x)) = g(f(y)) = 2^y$, impossible. So $f$ must be one-one; and any one-one $f$ works, defining $g$ on its image by $g(f(x)) = 2^x$.' },
      { h: 'Count one-one maps', d: 'One-one $f : A \\to B$: $7\\cdot6\\cdot5\\cdot4\\cdot3 = 2520$.' },
      { h: 'Exclude by inclusion–exclusion', d: 'With $f(2) = 2$: $6\\cdot5\\cdot4\\cdot3 = 360$; likewise $360$ with $f(4) = 4$; with both: $5\\cdot4\\cdot3 = 60$.' },
      { h: 'Answer', d: '$2520 - 360 - 360 + 60 = 1860$.' }
    ]
  },
  {
    ...ADV_2026_P2,
    id: 'jeeadv-2026-p2-q11',
    section: 'Section 3',
    questionNumber: 11,
    chapterId: 'c12-probability',
    difficulty: 3,
    answerType: 'numeric',
    prompt: 'A bookshelf contains $6$ distinct books of Mathematics and $5$ distinct books of Physics. From these $11$ books, $6$ books are chosen at random. Let $X$ be the absolute value of the difference between the number of Mathematics books chosen and the number of Physics books chosen. If $\\alpha$ is the mean of the random variable $X$, then the value of $77\\alpha$ is ____.',
    answer: { value: 100, tol: 1, officialRange: [99, 101] },
    inputHint: 'Enter the value of $77\\alpha$',
    hints: ['If $k$ Mathematics books are chosen, $X = |2k - 6|$.'],
    steps: [
      { h: 'Set up', d: 'Choosing $k$ Mathematics books leaves $6 - k$ Physics books, so $k \\ge 1$ and $X = |k - (6 - k)| = |2k - 6|$. There are $\\binom{11}{6} = 462$ equally likely choices.' },
      { h: 'Count each $k$', d: '$\\binom6k\\binom5{6-k}$ for $k = 1, \\ldots, 6$ is $6, 75, 200, 150, 30, 1$, with $X = 4, 2, 0, 2, 4, 6$.' },
      { h: 'Mean', d: '$462\\,\\alpha = 24 + 150 + 0 + 300 + 120 + 6 = 600$, so $\\alpha = \\dfrac{600}{462} = \\dfrac{100}{77}$.' },
      { h: 'Answer', d: '$77\\alpha = 100$.' }
    ]
  },
  {
    ...ADV_2026_P2,
    id: 'jeeadv-2026-p2-q12',
    section: 'Section 3',
    questionNumber: 12,
    chapterId: 'c11-statistics',
    difficulty: 3,
    answerType: 'numeric',
    prompt: 'Consider a data consisting of $10$ observations $x_1, x_2, \\ldots, x_{10}$, whose mean is $5$ and variance is $7$. If the mean and the variance of the first $8$ observations $x_1, x_2, \\ldots, x_8$ are $4$ and $3.5$, respectively, and $x_9 < x_{10}$, then the value of $3x_9 + 2x_{10}$ is ____.',
    answer: { value: 44 },
    inputHint: 'Enter the value of $3x_9 + 2x_{10}$',
    hints: ['Variance $=$ mean of squares $-$ square of mean: recover $\\sum x_i$ and $\\sum x_i^2$ for both groups.'],
    steps: [
      { h: 'All ten', d: '$\\sum x_i = 50$ and $\\sum x_i^2 = 10(7 + 25) = 320$.' },
      { h: 'First eight', d: '$\\sum x_i = 32$ and $\\sum x_i^2 = 8(3.5 + 16) = 156$.' },
      { h: 'The last two', d: '$x_9 + x_{10} = 18$ and $x_9^2 + x_{10}^2 = 164$, so $2x_9x_{10} = 324 - 164 = 160$ and $x_9x_{10} = 80$.' },
      { h: 'Solve', d: '$x_9, x_{10}$ are the roots of $t^2 - 18t + 80 = 0$, i.e. $8$ and $10$; with $x_9 < x_{10}$, $3(8) + 2(10) = 44$.' }
    ]
  },
  {
    ...ADV_2026_P2,
    id: 'jeeadv-2026-p2-q13',
    section: 'Section 3',
    questionNumber: 13,
    chapterId: 'c11-conic-sections',
    difficulty: 4,
    answerType: 'numeric',
    prompt: 'Consider the ellipse $E$ given by $\\dfrac{x^2}{18} + \\dfrac{y^2}{12} = 1$. Let $H$ be the hyperbola whose eccentricity is the reciprocal of the eccentricity of $E$ and whose foci are the same as that of $E$. Let $P$ and $Q$ be the points of intersection of $H$ and the parabola $\\sqrt5\\,y = x^2$ in the first quadrant. Let $d$ be the distance between $P$ and $Q$.\n\nIf $a$ and $b$ are the integers such that $d^2 = a + b\\sqrt5$, then the value of $a - b$ is ____.',
    answer: { value: 18 },
    inputHint: 'Enter the value of $a - b$',
    hints: ['Find the hyperbola first: same foci, eccentricity $\\sqrt3$.'],
    steps: [
      { h: 'The ellipse', d: '$e^2 = 1 - \\dfrac{12}{18} = \\dfrac13$, so $e = \\dfrac1{\\sqrt3}$ and the foci are $(\\pm\\sqrt{18}\\cdot\\tfrac1{\\sqrt3}, 0) = (\\pm\\sqrt6, 0)$.' },
      { h: 'The hyperbola', d: 'Eccentricity $\\sqrt3$ and $ae = \\sqrt6$ give $a^2 = 2$, $b^2 = a^2(e^2 - 1) = 4$: $\\dfrac{x^2}{2} - \\dfrac{y^2}{4} = 1$.' },
      { h: 'Intersect with the parabola', d: 'Put $x^2 = \\sqrt5\\,y$: $\\dfrac{\\sqrt5 y}{2} - \\dfrac{y^2}{4} = 1$, i.e. $y^2 - 2\\sqrt5 y + 4 = 0$, so $y = \\sqrt5 \\pm 1$ and $x^2 = 5 \\pm \\sqrt5$ (both in the first quadrant).' },
      { h: 'Distance', d: '$d^2 = (x_1 - x_2)^2 + 2^2 = (5 + \\sqrt5) + (5 - \\sqrt5) - 2\\sqrt{20} + 4 = 14 - 4\\sqrt5$.' },
      { h: 'Answer', d: '$a = 14$, $b = -4$, so $a - b = 18$.' }
    ]
  },
  {
    ...ADV_2026_P2,
    id: 'jeeadv-2026-p2-q14',
    section: 'Section 3',
    questionNumber: 14,
    chapterId: 'c12-continuity-differentiability',
    difficulty: 4,
    answerType: 'numeric',
    prompt: 'For a real number $\\alpha$, let $[\\alpha]$ denote the greatest integer less than or equal to $\\alpha$. For a finite set $S$, let $|S|$ denote the number of elements in the set $S$.\n\nConsider the functions $f : (-3, 3) \\to (-\\infty, \\infty)$ and $g : (-3, 3) \\to (-\\infty, \\infty)$ defined by\n\n$f(x) = [x^3]\\,\\log_e\\!\\big(1 + \\sin^2(\\pi(x - [x]))\\big)$ and $g(x) = x^3\\sin^2\\!\\big(\\pi\\log_e(1 + x - [x])\\big)$.\n\nLet $A = \\{x \\in (-3, 3) : f$ is discontinuous at $x\\}$ and $B = \\{x \\in (-3, 3) : g$ is discontinuous at $x\\}$.\n\nThen the value of $|A| + 2|B| - |A \\cap B|$ is ____.',
    answer: { value: 56 },
    inputHint: 'Enter the value',
    hints: ['$\\sin^2(\\pi(x - [x])) = \\sin^2(\\pi x)$ is continuous; where does the other factor jump?'],
    steps: [
      { h: 'Simplify $f$', d: '$\\sin^2(\\pi(x - [x])) = \\sin^2(\\pi x)$, so $f(x) = [x^3]\\,\\log_e(1 + \\sin^2\\pi x)$, a step function times a continuous one.' },
      { h: 'Where $f$ can jump', d: '$[x^3]$ jumps where $x^3$ is an integer, $-26, \\ldots, 26$: $53$ points of $(-3, 3)$.' },
      { h: 'Where it does not', d: 'At $x = -2, -1, 0, 1, 2$ the continuous factor is $\\log_e 1 = 0$ and $[x^3]$ stays bounded, so $f \\to 0 = f(x)$ there. So $|A| = 53 - 5 = 48$.' },
      { h: 'The function $g$', d: '$x - [x]$ jumps from near $1$ to $0$ at each integer $n$: just left of $n$, $g \\to n^3\\sin^2(\\pi\\log_e 2) \\ne 0$ unless $n = 0$, while $g(n) = 0$. Elsewhere $g$ is continuous. So $B = \\{-2, -1, 1, 2\\}$ and $|B| = 4$.' },
      { h: 'Combine', d: 'Every point of $B$ is an integer $\\ne 0$, where $f$ is continuous, so $A \\cap B = \\emptyset$. The value is $48 + 8 - 0 = 56$.' }
    ]
  },

  // ── Section 4 (numerical value, paired stems) ──
  {
    ...ADV_2026_P2,
    id: 'jeeadv-2026-p2-q15',
    section: 'Section 4',
    questionNumber: 15,
    chapterId: 'c11-trig-functions',
    difficulty: 3,
    answerType: 'numeric',
    prompt: `${STEM_15_16}\n\nThe value of $n$ is ____.`,
    answer: { value: 11 },
    inputHint: 'Enter the number of intersection points',
    hints: ['Divide both sides by $e^{-x}$, which is never zero.'],
    steps: [
      { h: 'Reduce', d: '$e^{-x} = e^{-x}(\\sin x + \\cos x)$ exactly when $\\sin x + \\cos x = 1$, i.e. $\\sqrt2\\sin\\!\\left(x + \\tfrac\\pi4\\right) = 1$.' },
      { h: 'Solve', d: '$x + \\tfrac\\pi4 = \\tfrac\\pi4 + 2k\\pi$ or $\\tfrac{3\\pi}4 + 2k\\pi$, so $x = 2k\\pi$ or $x = \\tfrac\\pi2 + 2k\\pi$.' },
      { h: 'Count in $[0, 10\\pi]$', d: '$x = 0, 2\\pi, \\ldots, 10\\pi$ gives $6$ points; $x = \\tfrac\\pi2, \\tfrac{5\\pi}2, \\ldots, \\tfrac{17\\pi}2$ gives $5$. So $n = 11$.' }
    ]
  },
  {
    ...ADV_2026_P2,
    id: 'jeeadv-2026-p2-q16',
    section: 'Section 4',
    questionNumber: 16,
    chapterId: 'c12-applications-integrals',
    difficulty: 4,
    answerType: 'numeric',
    prompt: `${STEM_15_16}\n\nLet $\\beta$ be the area of the region enclosed between the curves $C_1$, $C_2$, and the lines $x = \\alpha_1$ and $x = \\alpha_4$. Then the value of\n\n$-\\dfrac{1}{\\pi}\\log_e\\!\\left(\\beta - 2e^{-\\pi/2}\\right)$\n\nis ____.`,
    answer: { value: 2.5, tol: 0.1, officialRange: [2.4, 2.6] },
    inputHint: 'Enter the value',
    hints: ['An antiderivative of $e^{-x}(\\sin x + \\cos x - 1)$ is $e^{-x}(1 - \\cos x)$.'],
    steps: [
      { h: 'The limits', d: 'From the intersection points, $\\alpha_1 = 0$, $\\alpha_2 = \\tfrac\\pi2$, $\\alpha_3 = 2\\pi$, $\\alpha_4 = \\tfrac{5\\pi}2$.' },
      { h: 'An antiderivative', d: 'Let $h = e^{-x}(\\sin x + \\cos x - 1)$. Then $F(x) = e^{-x}(1 - \\cos x)$ has $F\' = h$ (check by differentiating).' },
      { h: 'Signs', d: '$\\sin x + \\cos x \\ge 1$ on $[0, \\tfrac\\pi2]$ and $[2\\pi, \\tfrac{5\\pi}2]$, and $\\le 1$ on $[\\tfrac\\pi2, 2\\pi]$.' },
      { h: 'Area', d: 'With $F(0) = 0$, $F(\\tfrac\\pi2) = e^{-\\pi/2}$, $F(2\\pi) = 0$, $F(\\tfrac{5\\pi}2) = e^{-5\\pi/2}$: $\\beta = e^{-\\pi/2} + e^{-\\pi/2} + e^{-5\\pi/2}$.' },
      { h: 'Answer', d: '$\\beta - 2e^{-\\pi/2} = e^{-5\\pi/2}$, so the value is $-\\dfrac1\\pi\\left(-\\dfrac{5\\pi}{2}\\right) = 2.5$.' }
    ]
  },
  {
    ...ADV_2026_P2,
    id: 'jeeadv-2026-p2-q17',
    section: 'Section 4',
    questionNumber: 17,
    chapterId: 'c11-conic-sections',
    difficulty: 3,
    answerType: 'numeric',
    prompt: `${STEM_17_18}\n\nLet $P$ be the point in the first quadrant where the given ellipses intersect. If $\\theta$ is the acute angle between the tangents to the given ellipses at the point $P$, then the value of $4\\tan\\theta$ is ____.`,
    answer: { value: 7.5, tol: 0.1, officialRange: [7.4, 7.6] },
    inputHint: 'Enter the value of $4\\tan\\theta$',
    hints: ['Subtract the equations to find $P$, then differentiate each implicitly.'],
    steps: [
      { h: 'Find $P$', d: 'Subtracting gives $3x^2 = 3y^2$, so in the first quadrant $x = y$ and $5x^2 = 1$: $P = \\left(\\tfrac1{\\sqrt5}, \\tfrac1{\\sqrt5}\\right)$.' },
      { h: 'Slopes at $P$', d: 'For $x^2 + 4y^2 = 1$, $y\' = -\\dfrac{x}{4y} = -\\dfrac14$; for $4x^2 + y^2 = 1$, $y\' = -\\dfrac{4x}{y} = -4$.' },
      { h: 'Angle', d: '$\\tan\\theta = \\left|\\dfrac{-\\tfrac14 + 4}{1 + 1}\\right| = \\dfrac{15}{8}$, so $4\\tan\\theta = 7.5$.' }
    ]
  },
  {
    ...ADV_2026_P2,
    id: 'jeeadv-2026-p2-q18',
    section: 'Section 4',
    questionNumber: 18,
    chapterId: 'c12-applications-integrals',
    difficulty: 4,
    answerType: 'numeric',
    prompt: `${STEM_17_18}\n\nIf $\\alpha$ is the area of the common region that lies inside both the given ellipses, then the value of $\\cot\\alpha$ is ____.`,
    answer: { value: 0.75, tol: 0.01, officialRange: [0.74, 0.76] },
    inputHint: 'Enter the value of $\\cot\\alpha$',
    hints: ['The common region is symmetric about $y = x$; stretch one ellipse into a circle.'],
    steps: [
      { h: 'Split by symmetry', d: 'The region is symmetric in both axes and in the line $y = x$, so $\\alpha$ is $8$ times the part between the $x$-axis and the ray $y = x$ in the first quadrant. That part is bounded by $4x^2 + y^2 = 1$.' },
      { h: 'Stretch to a circle', d: 'Under $u = 2x$, $v = y$ the ellipse $4x^2 + y^2 = 1$ becomes the unit circle, areas double, and the ray $y = x$ becomes $v = \\tfrac u2$, at angle $\\tan^{-1}\\tfrac12$.' },
      { h: 'Sector area', d: 'The circular sector has area $\\tfrac12\\tan^{-1}\\tfrac12$, so the original piece has area $\\tfrac14\\tan^{-1}\\tfrac12$ and $\\alpha = 2\\tan^{-1}\\tfrac12$.' },
      { h: 'Cotangent', d: 'With $t = \\tan^{-1}\\tfrac12$, $\\tan 2t = \\dfrac{1}{1 - \\tfrac14} = \\dfrac43$, so $\\cot\\alpha = \\dfrac34 = 0.75$.' }
    ]
  }
]);
