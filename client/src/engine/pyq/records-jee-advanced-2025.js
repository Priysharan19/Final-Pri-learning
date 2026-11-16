// Pri Learning · JEE Advanced 2025 · Mathematics (Paper 1 remainder, Paper 2)
//
// Transcribed from the Joint Admission Board's "Final Answer Key" documents,
// which print each question with its final answer (pyqSources.js:
// jeeadv-2025-p1-answers, jeeadv-2025-p2-answers), reading the rendered page.
// Worked steps are Pri Learning's own (PYQ_STEPS_AUTHORSHIP).
//
// Matching-list questions (Paper 1 Section 4) are carried as what they are on
// the paper: a four-option, single-correct MCQ over the four printed codes.
//
// Pending, not left out for good (one-or-more-correct; the archive has no
// multiple-correct contract yet): Paper 1 Q5–Q7, Paper 2 Q5–Q8.

import { PYQ_PROVENANCE } from './pyqSources.js';

const P1 = Object.freeze({
  examId: 'jee-advanced', year: 2025, paper: '1',
  provenance: PYQ_PROVENANCE.OFFICIAL_PAPER_AND_KEY, pastPaper: true,
  promptSource: 'jeeadv-2025-p1-answers', answerSource: 'jeeadv-2025-p1-answers'
});
const P2 = Object.freeze({
  examId: 'jee-advanced', year: 2025, paper: '2',
  provenance: PYQ_PROVENANCE.OFFICIAL_PAPER_AND_KEY, pastPaper: true,
  promptSource: 'jeeadv-2025-p2-answers', answerSource: 'jeeadv-2025-p2-answers'
});

const MATCH = 'Match each entry in List-I to the correct entry in List-II and choose the correct option.';

export const JEE_ADVANCED_2025_RECORDS = Object.freeze([
  // ── Paper 1 ──
  {
    ...P1, id: 'jeeadv-2025-p1-q3', section: 'Section 1', questionNumber: 3,
    chapterId: 'c12-continuity-differentiability', difficulty: 4, answerType: 'mcq',
    prompt: 'Let $\\mathbb R$ denote the set of all real numbers. Define the function $f:\\mathbb R\\to\\mathbb R$ by\n\n$f(x) = \\begin{cases} 2 - 2x^2 - x^2\\sin\\dfrac1x & \\text{if } x \\ne 0,\\\\ 2 & \\text{if } x = 0.\\end{cases}$\n\nThen which one of the following statements is TRUE?',
    mcqOptions: [
      'The function $f$ is NOT differentiable at $x = 0$',
      'There is a positive real number $\\delta$, such that $f$ is a decreasing function on the interval $(0, \\delta)$',
      'For any positive real number $\\delta$, the function $f$ is NOT an increasing function on the interval $(-\\delta, 0)$',
      '$x = 0$ is a point of local minima of $f$'
    ],
    answer: { correctIndex: 2 },
    hints: ['Find $f\'(x)$ for $x \\ne 0$ and look at the $\\cos\\frac1x$ term near $0$.'],
    steps: [
      { h: 'Idea', d: 'Near $0$ the derivative is dominated by $\\cos\\frac1x$, which keeps flipping sign, so $f$ cannot be monotone on any one-sided interval at $0$.' },
      { h: 'Differentiable at $0$', d: '$\\dfrac{f(x) - f(0)}{x} = -2x - x\\sin\\frac1x \\to 0$, so $f\'(0) = 0$ and (A) is false.' },
      { h: 'Derivative elsewhere', d: 'For $x \\ne 0$: $f\'(x) = -4x - 2x\\sin\\frac1x + \\cos\\frac1x$. The first two terms tend to $0$; $\\cos\\frac1x$ takes the values $1$ and $-1$ in every interval $(0,\\delta)$ and $(-\\delta,0)$.' },
      { h: 'Monotonicity', d: 'So $f\'$ is positive at some points and negative at others on each side: (B) is false and (C) is true.' },
      { h: 'Rule out (D)', d: '$f(x) = 2 - x^2\\left(2 + \\sin\\frac1x\\right) \\le 2 - x^2 < 2 = f(0)$ for $x \\ne 0$, so $0$ is a local maximum, not a minimum.' }
    ]
  },
  {
    ...P1, id: 'jeeadv-2025-p1-q14', section: 'Section 4', questionNumber: 14,
    chapterId: 'c11-statistics', difficulty: 3, answerType: 'mcq',
    prompt: 'Consider the following frequency distribution:\n\n$\\begin{array}{c|ccccccc} \\text{Value} & 4 & 5 & 8 & 9 & 6 & 12 & 11\\\\ \\hline \\text{Frequency} & 5 & f_1 & f_2 & 2 & 1 & 1 & 3\\end{array}$\n\nSuppose that the sum of the frequencies is $19$ and the median of this frequency distribution is $6$.\n\nFor the given frequency distribution, let $\\alpha$ denote the mean deviation about the mean, $\\beta$ denote the mean deviation about the median, and $\\sigma^2$ denote the variance.\n\n' + MATCH + '\n\nList-I: (P) $7f_1 + 9f_2$ is equal to; (Q) $19\\alpha$ is equal to; (R) $19\\beta$ is equal to; (S) $19\\sigma^2$ is equal to.\n\nList-II: (1) $146$; (2) $47$; (3) $48$; (4) $145$; (5) $55$.',
    mcqOptions: [
      '(P)→(5) (Q)→(3) (R)→(2) (S)→(4)',
      '(P)→(5) (Q)→(2) (R)→(3) (S)→(1)',
      '(P)→(5) (Q)→(3) (R)→(2) (S)→(1)',
      '(P)→(3) (Q)→(2) (R)→(5) (S)→(4)'
    ],
    answer: { correctIndex: 2 },
    hints: ['Sort the values first; the median is the $10$th observation.'],
    steps: [
      { h: 'Idea', d: 'The median condition pins down $f_1$; everything else is arithmetic on the completed table.' },
      { h: 'Find $f_1, f_2$', d: '$f_1 + f_2 = 7$. In order the values are $4\\,(5),\\ 5\\,(f_1),\\ 6\\,(1),\\ 8\\,(f_2), \\ldots$ The $10$th value is $6$ only if $5 + f_1 < 10 \\le 6 + f_1$, so $f_1 = 4$, $f_2 = 3$. Then (P) $= 28 + 27 = 55$.' },
      { h: 'Mean', d: '$\\sum f x = 20 + 20 + 24 + 18 + 6 + 12 + 33 = 133$, so the mean is $7$.' },
      { h: 'Deviations', d: '$19\\alpha = \\sum f|x - 7| = 15 + 8 + 3 + 4 + 1 + 5 + 12 = 48$; $19\\beta = \\sum f|x - 6| = 10 + 4 + 6 + 6 + 0 + 6 + 15 = 47$.' },
      { h: 'Variance', d: '$19\\sigma^2 = \\sum f(x - 7)^2 = 45 + 16 + 3 + 8 + 1 + 25 + 48 = 146$.' },
      { h: 'Match', d: '(P)→(5), (Q)→(3), (R)→(2), (S)→(1).' }
    ]
  },
  {
    ...P1, id: 'jeeadv-2025-p1-q15', section: 'Section 4', questionNumber: 15,
    chapterId: 'c12-applications-derivatives', difficulty: 4, answerType: 'mcq',
    prompt: 'Let $\\mathbb R$ denote the set of all real numbers. For a real number $x$, let $[x]$ denote the greatest integer less than or equal to $x$. Let $n$ denote a natural number.\n\n' + MATCH + '\n\nList-I:\n(P) The minimum value of $n$ for which the function $f(x) = \\left[\\dfrac{10x^3 - 45x^2 + 60x + 35}{n}\\right]$ is continuous on the interval $[1, 2]$, is\n(Q) The minimum value of $n$ for which $g(x) = (2n^2 - 13n - 15)(x^3 + 3x)$, $x \\in \\mathbb R$, is an increasing function on $\\mathbb R$, is\n(R) The smallest natural number $n$ which is greater than $5$, such that $x = 3$ is a point of local minima of $h(x) = (x^2 - 9)^n(x^2 + 2x + 3)$, is\n(S) Number of $x_0 \\in \\mathbb R$ such that $l(x) = \\displaystyle\\sum_{k=0}^{4}\\left(\\sin|x - k| + \\cos\\left|x - k + \\tfrac12\\right|\\right)$, $x \\in \\mathbb R$, is NOT differentiable at $x_0$, is\n\nList-II: (1) $8$; (2) $9$; (3) $5$; (4) $6$; (5) $10$.',
    mcqOptions: [
      '(P)→(1) (Q)→(3) (R)→(2) (S)→(5)',
      '(P)→(2) (Q)→(1) (R)→(4) (S)→(3)',
      '(P)→(5) (Q)→(1) (R)→(4) (S)→(3)',
      '(P)→(2) (Q)→(3) (R)→(1) (S)→(5)'
    ],
    answer: { correctIndex: 1 },
    hints: ['For (P), find the range of the cubic on $[1, 2]$ first.'],
    steps: [
      { h: '(P) range of the cubic', d: '$p(x) = 10x^3 - 45x^2 + 60x + 35$ has $p\'(x) = 30(x - 1)(x - 2) \\le 0$ on $[1,2]$, so $p$ falls from $60$ to $55$.' },
      { h: '(P) no integer crossed', d: '$[p/n]$ is continuous exactly when $p/n$ crosses no integer, i.e. $[60/n] = [55/n]$. For $n = 8$: $7.5 \\to 6.875$ crosses $7$; smaller $n$ fail similarly. For $n = 9$: $6.67 \\to 6.11$, no crossing. So (P) $= 9$.' },
      { h: '(Q)', d: '$x^3 + 3x$ is increasing, so we need $2n^2 - 13n - 15 = (2n - 15)(n + 1) > 0$, i.e. $n > 7.5$: (Q) $= 8$.' },
      { h: '(R)', d: '$h = (x - 3)^n(x + 3)^n(x^2 + 2x + 3)$. Near $x = 3$ everything but $(x - 3)^n$ is positive, so $x = 3$ is a local minimum exactly when $n$ is even: (R) $= 6$.' },
      { h: '(S)', d: '$\\cos|t| = \\cos t$ is smooth, while $\\sin|x - k|$ has a corner at $x = k$ (slopes $-1$ and $1$). The corners at $k = 0, 1, 2, 3, 4$ are at different points, so (S) $= 5$.' },
      { h: 'Match', d: '(P)→(2), (Q)→(1), (R)→(4), (S)→(3).' }
    ]
  },
  {
    ...P1, id: 'jeeadv-2025-p1-q16', section: 'Section 4', questionNumber: 16,
    chapterId: 'c12-vector-algebra', difficulty: 4, answerType: 'mcq',
    prompt: 'Let $\\vec w = \\hat\\imath + \\hat\\jmath - 2\\hat k$, and $\\vec u$ and $\\vec v$ be two vectors, such that $\\vec u \\times \\vec v = \\vec w$ and $\\vec v \\times \\vec w = \\vec u$. Let $\\alpha, \\beta, \\gamma$, and $t$ be real numbers such that\n\n$\\vec u = \\alpha\\hat\\imath + \\beta\\hat\\jmath + \\gamma\\hat k$, $\\ -t\\alpha + \\beta + \\gamma = 0$, $\\ \\alpha - t\\beta + \\gamma = 0$, and $\\alpha + \\beta - t\\gamma = 0$.\n\n' + MATCH + '\n\nList-I: (P) $|\\vec v|^2$ is equal to; (Q) If $\\alpha = \\sqrt3$, then $\\gamma^2$ is equal to; (R) If $\\alpha = \\sqrt3$, then $(\\beta + \\gamma)^2$ is equal to; (S) If $\\alpha = \\sqrt2$, then $t + 3$ is equal to.\n\nList-II: (1) $0$; (2) $1$; (3) $2$; (4) $3$; (5) $5$.',
    mcqOptions: [
      '(P)→(2) (Q)→(1) (R)→(4) (S)→(5)',
      '(P)→(2) (Q)→(4) (R)→(3) (S)→(5)',
      '(P)→(2) (Q)→(1) (R)→(4) (S)→(3)',
      '(P)→(5) (Q)→(4) (R)→(1) (S)→(3)'
    ],
    answer: { correctIndex: 0 },
    hints: ['The two cross products make $\\vec u, \\vec v, \\vec w$ mutually perpendicular.'],
    steps: [
      { h: 'Idea', d: '$\\vec u \\times \\vec v = \\vec w$ and $\\vec v \\times \\vec w = \\vec u$ force the three vectors to be mutually perpendicular, which fixes their lengths.' },
      { h: 'Lengths', d: 'Then $|\\vec w| = |\\vec u||\\vec v|$ and $|\\vec u| = |\\vec v||\\vec w|$, so $|\\vec w| = |\\vec v|^2|\\vec w|$: $|\\vec v|^2 = 1$ (P→2), and $|\\vec u|^2 = |\\vec w|^2 = 6$.' },
      { h: 'The system', d: 'The coefficient matrix is $J - (t + 1)I$ with $J$ the all-ones matrix (eigenvalues $3, 0, 0$). A non-zero $\\vec u$ needs $t = 2$ (then $\\vec u \\parallel (1,1,1)$) or $t = -1$ (then $\\alpha + \\beta + \\gamma = 0$). Also $\\vec u \\perp \\vec w$: $\\alpha + \\beta - 2\\gamma = 0$.' },
      { h: '$\\alpha = \\sqrt3$', d: '$t = 2$ would give $|\\vec u|^2 = 9 \\ne 6$. So $t = -1$: $\\gamma = 0$, $\\beta = -\\sqrt3$, $|\\vec u|^2 = 6$ ✓. Then $\\gamma^2 = 0$ (Q→1) and $(\\beta + \\gamma)^2 = 3$ (R→4).' },
      { h: '$\\alpha = \\sqrt2$', d: '$t = -1$ would give $|\\vec u|^2 = 4$; $t = 2$ gives $\\vec u = (\\sqrt2, \\sqrt2, \\sqrt2)$, $|\\vec u|^2 = 6$ ✓. So $t + 3 = 5$ (S→5).' }
    ]
  },

  // ── Paper 2 · Section 1 (single correct) ──
  {
    ...P2, id: 'jeeadv-2025-p2-q1', section: 'Section 1', questionNumber: 1,
    chapterId: 'c11-limits-derivatives', difficulty: 4, answerType: 'mcq',
    prompt: 'Let $x_0$ be the real number such that $e^{x_0} + x_0 = 0$. For a given real number $\\alpha$, define\n\n$g(x) = \\dfrac{3xe^x + 3x - \\alpha e^x - \\alpha x}{3(e^x + 1)}$\n\nfor all real numbers $x$.\n\nThen which one of the following statements is TRUE?',
    mcqOptions: [
      'For $\\alpha = 2$, $\\displaystyle\\lim_{x\\to x_0}\\left|\\frac{g(x) + e^{x_0}}{x - x_0}\\right| = 0$',
      'For $\\alpha = 2$, $\\displaystyle\\lim_{x\\to x_0}\\left|\\frac{g(x) + e^{x_0}}{x - x_0}\\right| = 1$',
      'For $\\alpha = 3$, $\\displaystyle\\lim_{x\\to x_0}\\left|\\frac{g(x) + e^{x_0}}{x - x_0}\\right| = 0$',
      'For $\\alpha = 3$, $\\displaystyle\\lim_{x\\to x_0}\\left|\\frac{g(x) + e^{x_0}}{x - x_0}\\right| = \\dfrac23'
    ],
    answer: { correctIndex: 2 },
    hints: ['Simplify $g$, then show $-e^{x_0} = g(x_0)$: the limit is a derivative.'],
    steps: [
      { h: 'Idea', d: 'The limit is $|g\'(x_0)|$ in disguise.' },
      { h: 'Simplify $g$', d: '$g(x) = x - \\dfrac{\\alpha}{3}\\cdot\\dfrac{e^x + x}{e^x + 1}$.' },
      { h: 'Value at $x_0$', d: 'Since $e^{x_0} + x_0 = 0$, $g(x_0) = x_0 = -e^{x_0}$. So $\\dfrac{g(x) + e^{x_0}}{x - x_0} = \\dfrac{g(x) - g(x_0)}{x - x_0} \\to g\'(x_0)$.' },
      { h: 'Derivative', d: '$\\dfrac{d}{dx}\\dfrac{e^x + x}{e^x + 1} = \\dfrac{(e^x + 1)^2 - (e^x + x)e^x}{(e^x + 1)^2}$, which equals $1$ at $x_0$. So $g\'(x_0) = 1 - \\dfrac{\\alpha}{3}$.' },
      { h: 'Check options', d: '$\\alpha = 2$ gives $\\tfrac13$; $\\alpha = 3$ gives $0$. Only (C) holds.' }
    ]
  },
  {
    ...P2, id: 'jeeadv-2025-p2-q2', section: 'Section 1', questionNumber: 2,
    chapterId: 'c12-applications-integrals', difficulty: 3, answerType: 'mcq',
    prompt: 'Let $\\mathbb R$ denote the set of all real numbers. Then the area of the region\n\n$\\left\\{(x, y) \\in \\mathbb R \\times \\mathbb R : x > 0,\\ y > \\dfrac1x,\\ 5x - 4y - 1 > 0,\\ 4x + 4y - 17 < 0\\right\\}$\n\nis',
    mcqOptions: ['$\\dfrac{17}{16} - \\log_e 4$', '$\\dfrac{33}{8} - \\log_e 4$', '$\\dfrac{57}{8} - \\log_e 4$', '$\\dfrac{17}{2} - \\log_e 4$'],
    answer: { correctIndex: 1 },
    hints: ['Sketch $y = \\frac1x$ and the two lines; find where each pair meets.'],
    steps: [
      { h: 'Idea', d: 'The region sits above the hyperbola $y = \\frac1x$ and below two lines that meet at a corner; integrate top minus bottom in two pieces.' },
      { h: 'Corners', d: '$y = \\frac{5x - 1}{4}$ meets $y = \\frac1x$ where $5x^2 - x - 4 = 0$: $x = 1$. The lines meet where $5x - 1 = 17 - 4x$: $x = 2$. $y = \\frac{17 - 4x}{4}$ meets $y = \\frac1x$ at $x = 4$ (and $\\frac14$, outside the region).' },
      { h: 'Integrate', d: '$\\displaystyle\\int_1^2 \\frac{5x - 1}{4}\\,dx + \\int_2^4 \\frac{17 - 4x}{4}\\,dx - \\int_1^4 \\frac{dx}{x} = \\frac{13}{8} + \\frac52 - \\log_e 4$.' },
      { h: 'Answer', d: '$\\dfrac{33}{8} - \\log_e 4$.' }
    ]
  },
  {
    ...P2, id: 'jeeadv-2025-p2-q3', section: 'Section 1', questionNumber: 3,
    chapterId: 'c12-inverse-trigonometric', difficulty: 4, answerType: 'mcq',
    prompt: 'The total number of real solutions of the equation\n\n$\\theta = \\tan^{-1}(2\\tan\\theta) - \\dfrac12\\sin^{-1}\\!\\left(\\dfrac{6\\tan\\theta}{9 + \\tan^2\\theta}\\right)$\n\nis\n\n(Here, the inverse trigonometric functions $\\sin^{-1}x$ and $\\tan^{-1}x$ assume values in $\\left[-\\frac\\pi2, \\frac\\pi2\\right]$ and $\\left(-\\frac\\pi2, \\frac\\pi2\\right)$, respectively.)',
    mcqOptions: ['$1$', '$2$', '$3$', '$5$'],
    answer: { correctIndex: 2 },
    hints: ['Write $t = \\tan\\theta$ and notice $\\dfrac{6t}{9 + t^2} = \\dfrac{2(t/3)}{1 + (t/3)^2}$.'],
    steps: [
      { h: 'Idea', d: 'The $\\sin^{-1}$ term is a double-angle in disguise; it collapses to $2\\tan^{-1}\\frac t3$ when $|t| \\le 3$.' },
      { h: 'Range of $\\theta$', d: 'The right side lies in $\\left(-\\frac{3\\pi}{4}, \\frac{3\\pi}4\\right)$ and $\\tan\\theta$ must exist, so $\\theta \\in \\left(-\\frac\\pi2, \\frac\\pi2\\right)$ and $\\theta = \\tan^{-1} t$.' },
      { h: 'Case $|t| \\le 3$', d: 'The equation is $\\tan^{-1}t = \\tan^{-1}2t - \\tan^{-1}\\frac t3$. Taking tangents: $t = \\dfrac{5t/3}{1 + 2t^2/3}$, so $t = 0$ or $t^2 = 1$. That gives $\\theta = 0, \\pm\\frac\\pi4$.' },
      { h: 'Case $t > 3$', d: 'Now $\\sin^{-1}(\\cdot) = \\pi - 2\\tan^{-1}\\frac t3$ and the right side is $\\tan^{-1}2t + \\tan^{-1}\\frac t3 - \\frac\\pi2 < \\tan^{-1}\\frac t3 < \\tan^{-1}t$: no solution. $t < -3$ is the mirror image.' },
      { h: 'Answer', d: 'Three solutions: $\\theta = -\\frac\\pi4, 0, \\frac\\pi4$.' }
    ]
  },
  {
    ...P2, id: 'jeeadv-2025-p2-q4', section: 'Section 1', questionNumber: 4,
    chapterId: 'c11-conic-sections', difficulty: 3, answerType: 'mcq',
    prompt: 'Let $S$ denote the locus of the point of intersection of the pair of lines\n\n$4x - 3y = 12\\alpha$,\n$4\\alpha x + 3\\alpha y = 12$,\n\nwhere $\\alpha$ varies over the set of non-zero real numbers. Let $T$ be the tangent to $S$ passing through the points $(p, 0)$ and $(0, q)$, $q > 0$, and parallel to the line $4x - \\frac{3}{\\sqrt2}y = 0$.\n\nThen the value of $pq$ is',
    mcqOptions: ['$-6\\sqrt2$', '$-3\\sqrt2$', '$-9\\sqrt2$', '$-12\\sqrt2$'],
    answer: { correctIndex: 0 },
    hints: ['Eliminate $\\alpha$ by multiplying the two equations.'],
    steps: [
      { h: 'Idea', d: 'Multiplying the two lines kills $\\alpha$ and leaves a hyperbola; then use the tangent-slope condition.' },
      { h: 'Locus', d: '$(4x - 3y)(4x + 3y) = 12\\alpha\\cdot\\frac{12}{\\alpha} = 144$, so $S: \\dfrac{x^2}{9} - \\dfrac{y^2}{16} = 1$.' },
      { h: 'Tangent', d: 'Slope $m = \\dfrac{4\\sqrt2}{3}$. Tangents of slope $m$ are $y = mx \\pm\\sqrt{9m^2 - 16} = mx \\pm 4$. With $q > 0$, $q = 4$.' },
      { h: 'Intercept', d: '$0 = mp + 4$ gives $p = -\\dfrac{3}{\\sqrt2}$, so $pq = -\\dfrac{12}{\\sqrt2} = -6\\sqrt2$.' }
    ]
  },

  // ── Paper 2 · Section 3 (numerical value) ──
  {
    ...P2, id: 'jeeadv-2025-p2-q9', section: 'Section 3', questionNumber: 9,
    chapterId: 'c12-differential-equations', difficulty: 3, answerType: 'numeric',
    prompt: 'Let $y(x)$ be the solution of the differential equation\n\n$x^2\\dfrac{dy}{dx} + xy = x^2 + y^2,\\quad x > \\dfrac1e,$\n\nsatisfying $y(1) = 0$. Then the value of $2\\dfrac{(y(e))^2}{y(e^2)}$ is ____.',
    answer: { value: 0.75, tol: 0.05, officialRange: [0.7, 0.8] },
    inputHint: 'Enter the value',
    hints: ['Homogeneous: put $y = vx$.'],
    steps: [
      { h: 'Idea', d: 'Every term has degree $2$, so $y = vx$ separates the variables.' },
      { h: 'Substitute', d: '$x^2(v + xv\') + x^2 v = x^2 + v^2x^2$ gives $x\\,v\' = (1 - v)^2$.' },
      { h: 'Integrate', d: '$\\dfrac{dv}{(1 - v)^2} = \\dfrac{dx}{x}$ gives $\\dfrac1{1 - v} = \\log_e x + C$; $v(1) = 0$ gives $C = 1$.' },
      { h: 'Solution', d: '$v = \\dfrac{\\log_e x}{1 + \\log_e x}$, so $y = \\dfrac{x\\log_e x}{1 + \\log_e x}$. Then $y(e) = \\dfrac e2$ and $y(e^2) = \\dfrac{2e^2}{3}$.' },
      { h: 'Answer', d: '$2\\cdot\\dfrac{e^2/4}{2e^2/3} = \\dfrac34 = 0.75$.' }
    ]
  },
  {
    ...P2, id: 'jeeadv-2025-p2-q10', section: 'Section 3', questionNumber: 10,
    chapterId: 'c11-binomial-theorem', difficulty: 3, answerType: 'numeric',
    prompt: 'Let $a_0, a_1, \\ldots, a_{23}$ be real numbers such that\n\n$\\left(1 + \\dfrac25x\\right)^{23} = \\displaystyle\\sum_{i=0}^{23} a_i x^i$\n\nfor every real number $x$. Let $a_r$ be the largest among the numbers $a_j$ for $0 \\le j \\le 23$. Then the value of $r$ is ____.',
    answer: { value: 6 },
    inputHint: 'Enter $r$',
    hints: ['Compare consecutive coefficients: when is $a_r / a_{r-1} \\ge 1$?'],
    steps: [
      { h: 'Idea', d: 'Coefficients rise while the ratio of neighbours exceeds $1$, then fall.' },
      { h: 'Ratio', d: '$a_r = \\binom{23}{r}\\left(\\frac25\\right)^r$, so $\\dfrac{a_r}{a_{r-1}} = \\dfrac{24 - r}{r}\\cdot\\dfrac25$.' },
      { h: 'Solve', d: '$\\dfrac{2(24 - r)}{5r} \\ge 1 \\iff 48 \\ge 7r \\iff r \\le 6.86$. So $a_6 > a_5$ and $a_7 < a_6$: $r = 6$.' }
    ]
  },
  {
    ...P2, id: 'jeeadv-2025-p2-q11', section: 'Section 3', questionNumber: 11,
    chapterId: 'c12-probability', difficulty: 2, answerType: 'numeric',
    prompt: 'A factory has a total of three manufacturing units, $M_1$, $M_2$, and $M_3$, which produce bulbs independent of each other. The units $M_1$, $M_2$, and $M_3$ produce bulbs in the proportions of $2 : 2 : 1$, respectively. It is known that $20\\%$ of the bulbs produced in the factory are defective. It is also known that, of all the bulbs produced by $M_1$, $15\\%$ are defective. Suppose that, if a randomly chosen bulb produced in the factory is found to be defective, the probability that it was produced by $M_2$ is $\\dfrac25$.\n\nIf a bulb is chosen randomly from the bulbs produced by $M_3$, then the probability that it is defective is ____.',
    answer: { value: 0.3, tol: 0.03, officialRange: [0.27, 0.33] },
    inputHint: 'Enter the probability',
    hints: ['Work with the joint probabilities $P(M_i \\cap D)$; they add to $0.2$.'],
    steps: [
      { h: 'Idea', d: 'Split the $20\\%$ defective rate into the three units\' shares.' },
      { h: 'Unit shares', d: '$P(M_1) = P(M_2) = \\frac25$, $P(M_3) = \\frac15$, and $P(D) = 0.2$.' },
      { h: 'Known pieces', d: '$P(M_1 \\cap D) = 0.4 \\times 0.15 = 0.06$; $P(M_2 \\cap D) = P(M_2 \\mid D)P(D) = 0.4 \\times 0.2 = 0.08$.' },
      { h: 'Remainder', d: '$P(M_3 \\cap D) = 0.2 - 0.06 - 0.08 = 0.06$, so $P(D \\mid M_3) = \\dfrac{0.06}{0.2} = 0.3$.' }
    ]
  },
  {
    ...P2, id: 'jeeadv-2025-p2-q12', section: 'Section 3', questionNumber: 12,
    chapterId: 'c12-vector-algebra', difficulty: 4, answerType: 'numeric',
    prompt: 'Consider the vectors\n\n$\\vec x = \\hat\\imath + 2\\hat\\jmath + 3\\hat k$, $\\ \\vec y = 2\\hat\\imath + 3\\hat\\jmath + \\hat k$, and $\\vec z = 3\\hat\\imath + \\hat\\jmath + 2\\hat k$.\n\nFor two distinct positive real numbers $\\alpha$ and $\\beta$, define\n\n$\\vec X = \\alpha\\vec x + \\beta\\vec y - \\vec z$, $\\ \\vec Y = \\alpha\\vec y + \\beta\\vec z - \\vec x$, and $\\vec Z = \\alpha\\vec z + \\beta\\vec x - \\vec y$.\n\nIf the vectors $\\vec X$, $\\vec Y$, and $\\vec Z$ lie in a plane, then the value of $\\alpha + \\beta - 3$ is ____.',
    answer: { value: -2 },
    inputHint: 'Enter the value',
    hints: ['$\\vec x, \\vec y, \\vec z$ are not coplanar, so the coefficient determinant must vanish.'],
    steps: [
      { h: 'Idea', d: 'Coplanarity of $\\vec X, \\vec Y, \\vec Z$ reduces to a $3\\times3$ determinant in $\\alpha, \\beta$, which factors.' },
      { h: 'Base vectors are independent', d: '$[\\vec x\\ \\vec y\\ \\vec z] = 1(6 - 1) - 2(4 - 3) + 3(2 - 9) = -18 \\ne 0$.' },
      { h: 'Coefficient determinant', d: '$\\begin{vmatrix}\\alpha & \\beta & -1\\\\ -1 & \\alpha & \\beta\\\\ \\beta & -1 & \\alpha\\end{vmatrix} = \\alpha^3 + \\beta^3 - 1 + 3\\alpha\\beta$, which must be $0$.' },
      { h: 'Factor', d: 'With $a^3 + b^3 + c^3 - 3abc$ and $c = -1$: $(\\alpha + \\beta - 1)\\cdot\\tfrac12\\left[(\\alpha - \\beta)^2 + (\\alpha + 1)^2 + (\\beta + 1)^2\\right] = 0$. The bracket is positive.' },
      { h: 'Answer', d: '$\\alpha + \\beta = 1$, so $\\alpha + \\beta - 3 = -2$.' }
    ]
  },
  {
    ...P2, id: 'jeeadv-2025-p2-q13', section: 'Section 3', questionNumber: 13,
    chapterId: 'c11-complex-numbers', difficulty: 3, answerType: 'numeric',
    prompt: 'For a non-zero complex number $z$, let $\\arg(z)$ denote the principal argument of $z$, with $-\\pi < \\arg(z) \\le \\pi$. Let $\\omega$ be the cube root of unity for which $0 < \\arg(\\omega) < \\pi$. Let\n\n$\\alpha = \\arg\\!\\left(\\displaystyle\\sum_{n=1}^{2025}(-\\omega)^n\\right).$\n\nThen the value of $\\dfrac{3\\alpha}{\\pi}$ is ____.',
    answer: { value: -2 },
    inputHint: 'Enter the value',
    hints: ['$-\\omega$ is a sixth root of unity, so the powers repeat every $6$.'],
    steps: [
      { h: 'Idea', d: 'The powers of $-\\omega$ cycle with period $6$ and each full cycle sums to $0$.' },
      { h: 'Reduce', d: '$2025 = 6\\cdot337 + 3$, so the sum is $(-\\omega) + \\omega^2 + (-\\omega^3) = -\\omega + \\omega^2 - 1$.' },
      { h: 'Simplify', d: 'Using $1 + \\omega + \\omega^2 = 0$: $-1 - \\omega = \\omega^2$, so the sum is $2\\omega^2$.' },
      { h: 'Argument', d: '$\\omega = e^{2\\pi i/3}$, so $\\omega^2 = e^{-2\\pi i/3}$ and $\\alpha = -\\dfrac{2\\pi}{3}$. Then $\\dfrac{3\\alpha}{\\pi} = -2$.' }
    ]
  },
  {
    ...P2, id: 'jeeadv-2025-p2-q14', section: 'Section 3', questionNumber: 14,
    chapterId: 'c12-continuity-differentiability', difficulty: 3, answerType: 'numeric',
    prompt: 'Let $\\mathbb R$ denote the set of all real numbers. Let $f:\\mathbb R \\to \\mathbb R$ and $g:\\mathbb R \\to (0, 4)$ be functions defined by\n\n$f(x) = \\log_e(x^2 + 2x + 4)$, and $g(x) = \\dfrac{4}{1 + e^{-2x}}$.\n\nDefine the composite function $f\\circ g^{-1}$ by $(f\\circ g^{-1})(x) = f(g^{-1}(x))$, where $g^{-1}$ is the inverse of the function $g$.\n\nThen the value of the derivative of the composite function $f\\circ g^{-1}$ at $x = 2$ is ____.',
    answer: { value: 0.25, tol: 0.05, officialRange: [0.2, 0.3] },
    inputHint: 'Enter the value',
    hints: ['$(g^{-1})\'(2) = \\dfrac1{g\'(g^{-1}(2))}$.'],
    steps: [
      { h: 'Idea', d: 'Chain rule with the inverse-function rule: $(f\\circ g^{-1})\'(2) = \\dfrac{f\'(a)}{g\'(a)}$ where $g(a) = 2$.' },
      { h: 'Find $a$', d: '$\\dfrac{4}{1 + e^{-2a}} = 2$ gives $e^{-2a} = 1$, so $a = 0$.' },
      { h: 'Derivatives at $0$', d: '$f\'(x) = \\dfrac{2x + 2}{x^2 + 2x + 4}$ gives $f\'(0) = \\frac12$. $g\'(x) = \\dfrac{8e^{-2x}}{(1 + e^{-2x})^2}$ gives $g\'(0) = 2$.' },
      { h: 'Answer', d: '$\\dfrac{1/2}{2} = 0.25$.' }
    ]
  },
  {
    ...P2, id: 'jeeadv-2025-p2-q15', section: 'Section 3', questionNumber: 15,
    chapterId: 'c11-trig-functions', difficulty: 4, answerType: 'numeric',
    prompt: 'Let\n\n$\\alpha = \\dfrac{1}{\\sin60^\\circ\\sin61^\\circ} + \\dfrac{1}{\\sin62^\\circ\\sin63^\\circ} + \\cdots + \\dfrac{1}{\\sin118^\\circ\\sin119^\\circ}.$\n\nThen the value of\n\n$\\left(\\dfrac{\\operatorname{cosec}1^\\circ}{\\alpha}\\right)^2$\n\nis ____.',
    answer: { value: 3 },
    inputHint: 'Enter the value',
    hints: ['$\\dfrac{\\sin 1^\\circ}{\\sin a\\sin(a + 1^\\circ)} = \\cot a - \\cot(a + 1^\\circ)$.'],
    steps: [
      { h: 'Idea', d: 'Each term becomes a difference of cotangents; then $\\cot(180^\\circ - \\theta) = -\\cot\\theta$ cancels almost everything.' },
      { h: 'Rewrite', d: '$\\alpha\\sin1^\\circ = (\\cot60^\\circ - \\cot61^\\circ) + (\\cot62^\\circ - \\cot63^\\circ) + \\cdots + (\\cot118^\\circ - \\cot119^\\circ)$.' },
      { h: 'Even angles', d: 'The $+$ terms are $\\cot k$ for even $k = 60, \\ldots, 118$. For $62 \\le k \\le 118$ they pair $k \\leftrightarrow 180 - k$ and cancel ($\\cot 90^\\circ = 0$), leaving $\\cot60^\\circ$.' },
      { h: 'Odd angles', d: 'The $-$ terms are $\\cot k$ for odd $k = 61, \\ldots, 119$; these pair $61 \\leftrightarrow 119$, …, $89 \\leftrightarrow 91$ and all cancel.' },
      { h: 'Answer', d: '$\\alpha\\sin1^\\circ = \\cot60^\\circ = \\dfrac1{\\sqrt3}$, so $\\dfrac{\\operatorname{cosec}1^\\circ}{\\alpha} = \\sqrt3$ and its square is $3$.' }
    ]
  },
  {
    ...P2, id: 'jeeadv-2025-p2-q16', section: 'Section 3', questionNumber: 16,
    chapterId: 'c12-integrals', difficulty: 4, answerType: 'numeric',
    prompt: 'If\n\n$\\alpha = \\displaystyle\\int_{1/2}^{2}\\frac{\\tan^{-1}x}{2x^2 - 3x + 2}\\,dx,$\n\nthen the value of $\\sqrt7\\tan\\!\\left(\\dfrac{2\\alpha\\sqrt7}{\\pi}\\right)$ is ____.\n\n(Here, the inverse trigonometric function $\\tan^{-1}x$ assumes values in $\\left(-\\frac\\pi2, \\frac\\pi2\\right)$.)',
    answer: { value: 21 },
    inputHint: 'Enter the value',
    hints: ['Substitute $x \\to \\frac1x$; the limits swap and $\\tan^{-1}\\frac1x = \\frac\\pi2 - \\tan^{-1}x$.'],
    steps: [
      { h: 'Idea', d: 'The limits $\\frac12$ and $2$ are reciprocals: $x \\to \\frac1x$ turns $\\tan^{-1}x$ into $\\frac\\pi2 - \\tan^{-1}x$ and keeps the rest.' },
      { h: 'Substitute', d: 'With $x \\to \\frac1x$, $\\dfrac{dx}{2x^2 - 3x + 2}$ is unchanged in form, so $\\alpha = \\displaystyle\\int_{1/2}^2 \\frac{\\frac\\pi2 - \\tan^{-1}x}{2x^2 - 3x + 2}\\,dx$.' },
      { h: 'Add', d: '$2\\alpha = \\dfrac\\pi2\\displaystyle\\int_{1/2}^2 \\frac{dx}{2\\left[(x - \\frac34)^2 + \\frac7{16}\\right]} = \\dfrac\\pi2\\cdot\\dfrac{2}{\\sqrt7}\\left[\\tan^{-1}\\dfrac{5}{\\sqrt7} + \\tan^{-1}\\dfrac{1}{\\sqrt7}\\right]$.' },
      { h: 'Combine the angles', d: '$\\tan\\left(\\tan^{-1}\\frac5{\\sqrt7} + \\tan^{-1}\\frac1{\\sqrt7}\\right) = \\dfrac{6/\\sqrt7}{1 - 5/7} = 3\\sqrt7$, so $\\dfrac{2\\alpha\\sqrt7}{\\pi} = \\tan^{-1}(3\\sqrt7)$.' },
      { h: 'Answer', d: '$\\sqrt7\\tan\\left(\\tan^{-1}3\\sqrt7\\right) = \\sqrt7\\cdot3\\sqrt7 = 21$.' }
    ]
  }
]);
