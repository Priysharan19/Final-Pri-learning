// Pri Learning · JEE Advanced 2024 · Mathematics (Papers 1 and 2)
//
// Transcribed from the Joint Admission Board's "with final keys" documents
// (pyqSources.js: jeeadv-2024-p1-answers, jeeadv-2024-p2-answers), read from
// the rendered page. Worked steps are Pri Learning's own.
//
// Pending (one-or-more-correct, no archive contract yet): Paper 1 Q5–Q7,
// Paper 2 Q5–Q7. Matching-list questions (Paper 1 Q14–Q17) are four-option
// single-correct MCQs on the paper and are carried as such.

import { PYQ_PROVENANCE } from './pyqSources.js';

const P1 = Object.freeze({
  examId: 'jee-advanced', year: 2024, paper: '1',
  provenance: PYQ_PROVENANCE.OFFICIAL_PAPER_AND_KEY, pastPaper: true,
  promptSource: 'jeeadv-2024-p1-answers', answerSource: 'jeeadv-2024-p1-answers'
});
const P2 = Object.freeze({
  examId: 'jee-advanced', year: 2024, paper: '2',
  provenance: PYQ_PROVENANCE.OFFICIAL_PAPER_AND_KEY, pastPaper: true,
  promptSource: 'jeeadv-2024-p2-answers', answerSource: 'jeeadv-2024-p2-answers'
});

const MATCH = 'Match each entry in List-I to the correct entry in List-II.';
const PARA_I = 'Let $S = \\{1, 2, 3, 4, 5, 6\\}$ and $X$ be the set of all relations $R$ from $S$ to $S$ that satisfy both the following properties:\n(i) $R$ has exactly $6$ elements.\n(ii) For each $(a, b) \\in R$, we have $|a - b| \\ge 2$.\n\nLet $Y = \\{R \\in X :$ the range of $R$ has exactly one element$\\}$ and $Z = \\{R \\in X : R$ is a function from $S$ to $S\\}$. Let $n(A)$ denote the number of elements in a set $A$.';
const PARA_II = 'Let $f : \\left[0, \\frac\\pi2\\right] \\to [0, 1]$ be the function defined by $f(x) = \\sin^2 x$ and let $g : \\left[0, \\frac\\pi2\\right] \\to [0, \\infty)$ be the function defined by $g(x) = \\sqrt{\\dfrac{\\pi x}{2} - x^2}$.';

export const JEE_ADVANCED_2024_RECORDS = Object.freeze([
  // ── Paper 1 · Section 1 ──
  {
    ...P1, id: 'jeeadv-2024-p1-q1', section: 'Section 1', questionNumber: 1,
    chapterId: 'c12-differential-equations', difficulty: 4, answerType: 'mcq',
    prompt: 'Let $f(x)$ be a continuously differentiable function on the interval $(0, \\infty)$ such that $f(1) = 2$ and\n\n$\\displaystyle\\lim_{t\\to x}\\frac{t^{10}f(x) - x^{10}f(t)}{t^9 - x^9} = 1$\n\nfor each $x > 0$. Then, for all $x > 0$, $f(x)$ is equal to',
    mcqOptions: ['$\\dfrac{31}{11x} - \\dfrac{9}{11}x^{10}$', '$\\dfrac{9}{11x} + \\dfrac{13}{11}x^{10}$', '$\\dfrac{-9}{11x} + \\dfrac{31}{11}x^{10}$', '$\\dfrac{13}{11x} + \\dfrac{9}{11}x^{10}$'],
    answer: { correctIndex: 1 },
    hints: ['The limit is $0/0$ in $t$; apply L\'Hôpital in $t$ to get a differential equation.'],
    steps: [
      { h: 'Idea', d: 'The limit turns into a first-order linear differential equation for $f$.' },
      { h: 'L\'Hôpital in $t$', d: 'Differentiating top and bottom in $t$ and putting $t = x$: $\\dfrac{10x^9 f(x) - x^{10}f\'(x)}{9x^8} = 1$, i.e. $f\' - \\dfrac{10}{x}f = -\\dfrac{9}{x^2}$.' },
      { h: 'Integrating factor', d: 'Multiply by $x^{-10}$: $\\left(x^{-10}f\\right)\' = -9x^{-12}$, so $x^{-10}f = \\dfrac{9}{11}x^{-11} + C$.' },
      { h: 'Use $f(1) = 2$', d: '$f(x) = \\dfrac{9}{11x} + Cx^{10}$ and $\\dfrac{9}{11} + C = 2$ gives $C = \\dfrac{13}{11}$.' }
    ]
  },
  {
    ...P1, id: 'jeeadv-2024-p1-q2', section: 'Section 1', questionNumber: 2,
    chapterId: 'c12-probability', difficulty: 3, answerType: 'mcq',
    prompt: 'A student appears for a quiz consisting of only true-false type questions and answers all the questions. The student knows the answers of some questions and guesses the answers for the remaining questions. Whenever the student knows the answer of a question, he gives the correct answer. Assume that the probability of the student giving the correct answer for a question, given that he has guessed it, is $\\dfrac12$. Also assume that the probability of the answer for a question being guessed, given that the student\'s answer is correct, is $\\dfrac16$. Then the probability that the student knows the answer of a randomly chosen question is',
    mcqOptions: ['$\\dfrac{1}{12}$', '$\\dfrac17$', '$\\dfrac57$', '$\\dfrac{5}{12}$'],
    answer: { correctIndex: 2 },
    hints: ['Let $p$ be the probability he knows the answer and apply Bayes\' theorem.'],
    steps: [
      { h: 'Idea', d: 'Bayes\' theorem with one unknown, $p = P(\\text{knows})$.' },
      { h: 'Correct answers', d: '$P(\\text{correct}) = p + \\dfrac{1 - p}{2} = \\dfrac{1 + p}{2}$, and $P(\\text{guessed and correct}) = \\dfrac{1 - p}{2}$.' },
      { h: 'Bayes', d: '$\\dfrac{(1 - p)/2}{(1 + p)/2} = \\dfrac16$, so $6 - 6p = 1 + p$ and $p = \\dfrac57$.' }
    ]
  },
  {
    ...P1, id: 'jeeadv-2024-p1-q3', section: 'Section 1', questionNumber: 3,
    chapterId: 'c11-trig-functions', difficulty: 3, answerType: 'mcq',
    prompt: 'Let $\\dfrac\\pi2 < x < \\pi$ be such that $\\cot x = \\dfrac{-5}{\\sqrt{11}}$. Then\n\n$\\left(\\sin\\dfrac{11x}{2}\\right)(\\sin6x - \\cos6x) + \\left(\\cos\\dfrac{11x}{2}\\right)(\\sin6x + \\cos6x)$\n\nis equal to',
    mcqOptions: ['$\\dfrac{\\sqrt{11} - 1}{2\\sqrt3}$', '$\\dfrac{\\sqrt{11} + 1}{2\\sqrt3}$', '$\\dfrac{\\sqrt{11} + 1}{3\\sqrt2}$', '$\\dfrac{\\sqrt{11} - 1}{3\\sqrt2}$'],
    answer: { correctIndex: 1 },
    hints: ['Regroup into $\\cos(A - B)$ and $\\sin(A - B)$ with $A = 6x$, $B = \\frac{11x}{2}$.'],
    steps: [
      { h: 'Idea', d: 'The expression is a compound-angle formula in disguise and collapses to a function of $\\frac x2$.' },
      { h: 'Regroup', d: '$(\\cos6x\\cos\\tfrac{11x}2 + \\sin6x\\sin\\tfrac{11x}2) + (\\sin6x\\cos\\tfrac{11x}2 - \\cos6x\\sin\\tfrac{11x}2) = \\cos\\tfrac x2 + \\sin\\tfrac x2$.' },
      { h: 'Find $\\sin x$', d: '$\\cot x = -\\dfrac{5}{\\sqrt{11}}$ in the second quadrant gives hypotenuse $6$ and $\\sin x = \\dfrac{\\sqrt{11}}{6}$.' },
      { h: 'Square', d: '$\\left(\\cos\\tfrac x2 + \\sin\\tfrac x2\\right)^2 = 1 + \\sin x = \\dfrac{6 + \\sqrt{11}}{6}$, and the sum is positive since $\\frac x2 \\in \\left(\\frac\\pi4, \\frac\\pi2\\right)$.' },
      { h: 'Match', d: '$\\left(\\dfrac{\\sqrt{11} + 1}{2\\sqrt3}\\right)^2 = \\dfrac{12 + 2\\sqrt{11}}{12} = \\dfrac{6 + \\sqrt{11}}{6}$, so the value is $\\dfrac{\\sqrt{11} + 1}{2\\sqrt3}$.' }
    ]
  },
  {
    ...P1, id: 'jeeadv-2024-p1-q4', section: 'Section 1', questionNumber: 4,
    chapterId: 'c11-conic-sections', difficulty: 3, answerType: 'mcq',
    prompt: 'Consider the ellipse $\\dfrac{x^2}{9} + \\dfrac{y^2}{4} = 1$. Let $S(p, q)$ be a point in the first quadrant such that $\\dfrac{p^2}{9} + \\dfrac{q^2}{4} > 1$. Two tangents are drawn from $S$ to the ellipse, of which one meets the ellipse at one end point of the minor axis and the other meets the ellipse at a point $T$ in the fourth quadrant. Let $R$ be the vertex of the ellipse with positive $x$-coordinate and $O$ be the center of the ellipse. If the area of the triangle $\\triangle ORT$ is $\\dfrac32$, then which of the following options is correct?',
    mcqOptions: ['$q = 2,\\ p = 3\\sqrt3$', '$q = 2,\\ p = 4\\sqrt3$', '$q = 1,\\ p = 5\\sqrt3$', '$q = 1,\\ p = 6\\sqrt3$'],
    answer: { correctIndex: 0 },
    hints: ['The tangent at a minor-axis end is horizontal; the area fixes $T$.'],
    steps: [
      { h: 'Idea', d: 'Each tangent pins one coordinate of $S$.' },
      { h: 'First tangent', d: '$S$ is in the first quadrant, so the minor-axis end is $(0, 2)$ with tangent $y = 2$: $q = 2$.' },
      { h: 'Find $T$', d: 'Area $\\triangle ORT = \\tfrac12\\cdot3\\cdot|y_T| = \\tfrac32$ gives $y_T = -1$; on the ellipse, $x_T = \\dfrac{3\\sqrt3}{2}$.' },
      { h: 'Second tangent', d: 'At $T$: $\\dfrac{x\\cdot\\frac{3\\sqrt3}{2}}{9} - \\dfrac{y}{4} = 1$. With $y = 2$: $\\dfrac{\\sqrt3 x}{6} = \\dfrac32$, so $p = 3\\sqrt3$.' }
    ]
  },

  // ── Paper 1 · Section 3 (non-negative integer) ──
  {
    ...P1, id: 'jeeadv-2024-p1-q8', section: 'Section 3', questionNumber: 8,
    chapterId: 'c11-relations-functions', difficulty: 3, answerType: 'numeric',
    prompt: 'Let $a = 3\\sqrt2$ and $b = \\dfrac{1}{5^{1/6}\\sqrt6}$. If $x, y \\in \\mathbb R$ are such that\n\n$3x + 2y = \\log_a\\!\\left(18\\right)^{5/4}$ and $2x - y = \\log_b\\!\\left(\\sqrt{1080}\\right)$,\n\nthen $4x + 5y$ is equal to ____.',
    answer: { value: 8 },
    inputHint: 'Enter the integer',
    hints: ['$a^2 = 18$, and $b^{-6} = 1080$.'],
    steps: [
      { h: 'Idea', d: 'Both logarithms are simple once each argument is written as a power of its base.' },
      { h: 'First log', d: '$a^2 = 18$, so $\\log_a 18^{5/4} = \\tfrac54\\cdot2 = \\tfrac52$.' },
      { h: 'Second log', d: '$b^{-6} = 5\\cdot6^3 = 1080$, so $\\sqrt{1080} = b^{-3}$ and the log is $-3$.' },
      { h: 'Solve', d: '$3x + 2y = \\tfrac52$ and $y = 2x + 3$ give $7x = -\\tfrac72$: $x = -\\tfrac12$, $y = 2$.' },
      { h: 'Answer', d: '$4x + 5y = -2 + 10 = 8$.' }
    ]
  },
  {
    ...P1, id: 'jeeadv-2024-p1-q9', section: 'Section 3', questionNumber: 9,
    chapterId: 'c11-complex-numbers', difficulty: 3, answerType: 'numeric',
    prompt: 'Let $f(x) = x^4 + ax^3 + bx^2 + c$ be a polynomial with real coefficients such that $f(1) = -9$. Suppose that $i\\sqrt3$ is a root of the equation $4x^3 + 3ax^2 + 2bx = 0$, where $i = \\sqrt{-1}$. If $\\alpha_1, \\alpha_2, \\alpha_3$, and $\\alpha_4$ are all the roots of the equation $f(x) = 0$, then $|\\alpha_1|^2 + |\\alpha_2|^2 + |\\alpha_3|^2 + |\\alpha_4|^2$ is equal to ____.',
    answer: { value: 20 },
    inputHint: 'Enter the integer',
    hints: ['Real coefficients: $-i\\sqrt3$ is a root too.'],
    steps: [
      { h: 'Idea', d: 'The derivative-like cubic fixes $a$ and $b$; then $f$ factors.' },
      { h: 'Find $a, b$', d: '$4x^3 + 3ax^2 + 2bx = x(4x^2 + 3ax + 2b)$ has roots $\\pm i\\sqrt3$, so $4x^2 + 3ax + 2b = 4(x^2 + 3)$: $a = 0$, $b = 6$.' },
      { h: 'Find $c$', d: '$f(1) = 1 + 6 + c = -9$ gives $c = -16$.' },
      { h: 'Factor', d: '$f = x^4 + 6x^2 - 16 = (x^2 + 8)(x^2 - 2)$, roots $\\pm2\\sqrt2\\,i$, $\\pm\\sqrt2$.' },
      { h: 'Answer', d: '$8 + 8 + 2 + 2 = 20$.' }
    ]
  },
  {
    ...P1, id: 'jeeadv-2024-p1-q10', section: 'Section 3', questionNumber: 10,
    chapterId: 'c12-determinants', difficulty: 3, answerType: 'numeric',
    prompt: 'Let $S = \\left\\{A = \\begin{pmatrix}0 & 1 & c\\\\ 1 & a & d\\\\ 1 & b & e\\end{pmatrix} : a, b, c, d, e \\in \\{0, 1\\}\\text{ and } |A| \\in \\{-1, 1\\}\\right\\}$, where $|A|$ denotes the determinant of $A$. Then the number of elements in $S$ is ____.',
    answer: { value: 16 },
    inputHint: 'Enter the integer',
    hints: ['Expand along the first row: $|A| = (d - e) + c(b - a)$.'],
    steps: [
      { h: 'Idea', d: 'The determinant is a short expression in the five bits; count by cases on $c$.' },
      { h: 'Expand', d: '$|A| = -1\\cdot(e - d) + c(b - a) = (d - e) + c(b - a)$.' },
      { h: '$c = 0$', d: 'Need $d \\ne e$ (2 ways), with $a, b$ free (4 ways): $8$.' },
      { h: '$c = 1$', d: 'Need $(d - e) + (b - a) = \\pm1$: one difference is $0$ (2 ways) and the other $\\pm1$ (2 ways), in either order: $2\\cdot2\\cdot2 = 8$.' },
      { h: 'Answer', d: '$8 + 8 = 16$.' }
    ]
  },
  {
    ...P1, id: 'jeeadv-2024-p1-q11', section: 'Section 3', questionNumber: 11,
    chapterId: 'c11-permutations-combinations', difficulty: 3, answerType: 'numeric',
    prompt: 'A group of $9$ students, $s_1, s_2, \\ldots, s_9$, is to be divided to form three teams $X, Y$, and $Z$ of sizes $2, 3$, and $4$, respectively. Suppose that $s_1$ cannot be selected for the team $X$, and $s_2$ cannot be selected for the team $Y$. Then the number of ways to form such teams, is ____.',
    answer: { value: 665 },
    inputHint: 'Enter the integer',
    hints: ['Count all splits, then use inclusion–exclusion on the two bad events.'],
    steps: [
      { h: 'Idea', d: 'Inclusion–exclusion on "$s_1 \\in X$" and "$s_2 \\in Y$".' },
      { h: 'All splits', d: '$\\dfrac{9!}{2!\\,3!\\,4!} = 1260$.' },
      { h: 'Bad events', d: '$s_1 \\in X$: $\\dfrac{8!}{1!\\,3!\\,4!} = 280$. $s_2 \\in Y$: $\\dfrac{8!}{2!\\,2!\\,4!} = 420$. Both: $\\dfrac{7!}{1!\\,2!\\,4!} = 105$.' },
      { h: 'Answer', d: '$1260 - 280 - 420 + 105 = 665$.' }
    ]
  },
  {
    ...P1, id: 'jeeadv-2024-p1-q12', section: 'Section 3', questionNumber: 12,
    chapterId: 'c12-vector-algebra', difficulty: 4, answerType: 'numeric',
    prompt: 'Let $\\overrightarrow{OP} = \\dfrac{\\alpha - 1}{\\alpha}\\hat\\imath + \\hat\\jmath + \\hat k$, $\\overrightarrow{OQ} = \\hat\\imath + \\dfrac{\\beta - 1}{\\beta}\\hat\\jmath + \\hat k$ and $\\overrightarrow{OR} = \\hat\\imath + \\hat\\jmath + \\dfrac12\\hat k$ be three vectors, where $\\alpha, \\beta \\in \\mathbb R - \\{0\\}$ and $O$ denotes the origin. If $\\left(\\overrightarrow{OP} \\times \\overrightarrow{OQ}\\right)\\cdot\\overrightarrow{OR} = 0$ and the point $(\\alpha, \\beta, 2)$ lies on the plane $3x + 3y - z + l = 0$, then the value of $l$ is ____.',
    answer: { value: 5 },
    inputHint: 'Enter the integer',
    hints: ['Write $u = 1 - \\frac1\\alpha$, $v = 1 - \\frac1\\beta$ and expand the box product.'],
    steps: [
      { h: 'Idea', d: 'The zero box product factors neatly and gives $\\alpha + \\beta$.' },
      { h: 'Expand', d: 'With $u = 1 - \\frac1\\alpha$, $v = 1 - \\frac1\\beta$: $\\begin{vmatrix}u & 1 & 1\\\\ 1 & v & 1\\\\ 1 & 1 & \\frac12\\end{vmatrix} = \\dfrac{uv}{2} - u - v + \\dfrac32 = 0$, i.e. $(u - 2)(v - 2) = 1$.' },
      { h: 'Back to $\\alpha, \\beta$', d: '$u - 2 = -\\dfrac{\\alpha + 1}{\\alpha}$, $v - 2 = -\\dfrac{\\beta + 1}{\\beta}$, so $(\\alpha + 1)(\\beta + 1) = \\alpha\\beta$ and $\\alpha + \\beta = -1$.' },
      { h: 'Plane', d: '$3(\\alpha + \\beta) - 2 + l = 0$ gives $l = 5$.' }
    ]
  },
  {
    ...P1, id: 'jeeadv-2024-p1-q13', section: 'Section 3', questionNumber: 13,
    chapterId: 'c12-probability', difficulty: 3, answerType: 'numeric',
    prompt: 'Let $X$ be a random variable, and let $P(X = x)$ denote the probability that $X$ takes the value $x$. Suppose that the points $(x, P(X = x))$, $x = 0, 1, 2, 3, 4$, lie on a fixed straight line in the $xy$-plane, and $P(X = x) = 0$ for all $x \\in \\mathbb R - \\{0, 1, 2, 3, 4\\}$. If the mean of $X$ is $\\dfrac52$, and the variance of $X$ is $\\alpha$, then the value of $24\\alpha$ is ____.',
    answer: { value: 42 },
    inputHint: 'Enter the integer',
    hints: ['Write $P(X = x) = mx + c$ and use total probability and the mean.'],
    steps: [
      { h: 'Idea', d: 'Two conditions fix the line $P = mx + c$.' },
      { h: 'Equations', d: '$\\sum P = 10m + 5c = 1$ and $\\sum xP = 30m + 10c = \\frac52$. So $m = \\frac1{20}$, $c = \\frac1{10}$.' },
      { h: 'Distribution', d: '$P = 0.10, 0.15, 0.20, 0.25, 0.30$ for $x = 0, \\ldots, 4$.' },
      { h: 'Variance', d: '$E[X^2] = 0.15 + 0.8 + 2.25 + 4.8 = 8$, so $\\alpha = 8 - \\frac{25}{4} = \\frac74$ and $24\\alpha = 42$.' }
    ]
  },

  // ── Paper 1 · Section 4 (matching lists) ──
  {
    ...P1, id: 'jeeadv-2024-p1-q14', section: 'Section 4', questionNumber: 14,
    chapterId: 'c12-matrices', difficulty: 4, answerType: 'mcq',
    prompt: 'Let $\\alpha$ and $\\beta$ be the distinct roots of the equation $x^2 + x - 1 = 0$. Consider the set $T = \\{1, \\alpha, \\beta\\}$. For a $3 \\times 3$ matrix $M = (a_{ij})_{3\\times3}$, define $R_i = a_{i1} + a_{i2} + a_{i3}$ and $C_j = a_{1j} + a_{2j} + a_{3j}$ for $i = 1, 2, 3$ and $j = 1, 2, 3$.\n\n' + MATCH + '\n\nList-I:\n(P) The number of matrices $M = (a_{ij})_{3\\times3}$ with all entries in $T$ such that $R_i = C_j = 0$ for all $i, j$, is\n(Q) The number of symmetric matrices $M = (a_{ij})_{3\\times3}$ with all entries in $T$ such that $C_j = 0$ for all $j$, is\n(R) Let $M = (a_{ij})_{3\\times3}$ be a skew symmetric matrix such that $a_{ij} \\in T$ for $i > j$. Then the number of elements in the set $\\left\\{\\begin{pmatrix}x\\\\y\\\\z\\end{pmatrix} : x, y, z \\in \\mathbb R,\\ M\\begin{pmatrix}x\\\\y\\\\z\\end{pmatrix} = \\begin{pmatrix}a_{12}\\\\0\\\\-a_{23}\\end{pmatrix}\\right\\}$ is\n(S) Let $M = (a_{ij})_{3\\times3}$ be a matrix with all entries in $T$ such that $R_i = 0$ for all $i$. Then the absolute value of the determinant of $M$ is\n\nList-II: (1) $1$; (2) $12$; (3) infinite; (4) $6$; (5) $0$.',
    mcqOptions: [
      '(P)→(4) (Q)→(2) (R)→(5) (S)→(1)',
      '(P)→(2) (Q)→(4) (R)→(1) (S)→(5)',
      '(P)→(2) (Q)→(4) (R)→(3) (S)→(5)',
      '(P)→(1) (Q)→(5) (R)→(3) (S)→(4)'
    ],
    answer: { correctIndex: 2 },
    hints: ['$1 + \\alpha + \\beta = 0$: which triples from $T$ sum to $0$?'],
    steps: [
      { h: 'Idea', d: 'Since $\\alpha + \\beta = -1$, three entries of $T$ sum to $0$ only when they are $1, \\alpha, \\beta$ in some order, so zero line sums mean each line is a permutation of $T$.' },
      { h: '(P)', d: 'Every row and column a permutation of $T$: a $3\\times3$ Latin square, of which there are $12$.' },
      { h: '(Q)', d: 'A symmetric Latin square of odd order has each symbol once on the diagonal, and the diagonal then fixes the square: $3! = 6$.' },
      { h: '(R)', d: 'The second column of $M$ is $(a_{12}, 0, -a_{23})^T$, so $(0, 1, 0)$ is a solution; a $3\\times3$ skew-symmetric matrix is singular, so there are infinitely many.' },
      { h: '(S)', d: '$R_i = 0$ means $M(1, 1, 1)^T = 0$, so $|M| = 0$.' },
      { h: 'Match', d: '(P)→(2), (Q)→(4), (R)→(3), (S)→(5).' }
    ]
  },
  {
    ...P1, id: 'jeeadv-2024-p1-q15', section: 'Section 4', questionNumber: 15,
    chapterId: 'c11-conic-sections', difficulty: 3, answerType: 'mcq',
    prompt: 'Let the straight line $y = 2x$ touch a circle with center $(0, \\alpha)$, $\\alpha > 0$, and radius $r$ at a point $A_1$. Let $B_1$ be the point on the circle such that the line segment $A_1B_1$ is a diameter of the circle. Let $\\alpha + r = 5 + \\sqrt5$.\n\n' + MATCH + '\n\nList-I: (P) $\\alpha$ equals; (Q) $r$ equals; (R) $A_1$ equals; (S) $B_1$ equals.\n\nList-II: (1) $(-2, 4)$; (2) $\\sqrt5$; (3) $(-2, 6)$; (4) $5$; (5) $(2, 4)$.',
    mcqOptions: [
      '(P)→(4) (Q)→(2) (R)→(1) (S)→(3)',
      '(P)→(2) (Q)→(4) (R)→(1) (S)→(3)',
      '(P)→(4) (Q)→(2) (R)→(5) (S)→(3)',
      '(P)→(2) (Q)→(4) (R)→(3) (S)→(5)'
    ],
    answer: { correctIndex: 2 },
    hints: ['Tangency: the distance from the centre to $y = 2x$ is $r$.'],
    steps: [
      { h: 'Idea', d: 'Tangency gives $r$ in terms of $\\alpha$; the given sum fixes both.' },
      { h: 'Radius', d: 'Distance from $(0, \\alpha)$ to $2x - y = 0$ is $\\dfrac{\\alpha}{\\sqrt5} = r$. Then $\\alpha + r = \\alpha\\cdot\\dfrac{\\sqrt5 + 1}{\\sqrt5} = \\sqrt5(\\sqrt5 + 1)$, giving $\\alpha = 5$ and $r = \\sqrt5$.' },
      { h: 'Point of contact', d: '$A_1$ is the foot of the perpendicular from $(0, 5)$ to $y = 2x$: projecting onto $(1, 2)$ gives $A_1 = (2, 4)$.' },
      { h: 'Other end', d: '$B_1 = 2(0, 5) - (2, 4) = (-2, 6)$.' },
      { h: 'Match', d: '(P)→(4), (Q)→(2), (R)→(5), (S)→(3).' }
    ]
  },
  {
    ...P1, id: 'jeeadv-2024-p1-q16', section: 'Section 4', questionNumber: 16,
    chapterId: 'c12-3d-geometry', difficulty: 3, answerType: 'mcq',
    prompt: 'Let $\\gamma \\in \\mathbb R$ be such that the lines $L_1: \\dfrac{x + 11}{1} = \\dfrac{y + 21}{2} = \\dfrac{z + 29}{3}$ and $L_2: \\dfrac{x + 16}{3} = \\dfrac{y + 11}{2} = \\dfrac{z + 4}{\\gamma}$ intersect. Let $R_1$ be the point of intersection of $L_1$ and $L_2$. Let $O = (0, 0, 0)$, and $\\hat n$ denote a unit normal vector to the plane containing both the lines $L_1$ and $L_2$.\n\n' + MATCH + '\n\nList-I: (P) $\\gamma$ equals; (Q) A possible choice for $\\hat n$ is; (R) $\\overrightarrow{OR_1}$ equals; (S) A possible value of $\\overrightarrow{OR_1}\\cdot\\hat n$ is.\n\nList-II: (1) $-\\hat\\imath - \\hat\\jmath + \\hat k$; (2) $\\sqrt{\\dfrac32}$; (3) $1$; (4) $\\dfrac{1}{\\sqrt6}\\hat\\imath - \\dfrac{2}{\\sqrt6}\\hat\\jmath + \\dfrac{1}{\\sqrt6}\\hat k$; (5) $\\sqrt{\\dfrac23}$.',
    mcqOptions: [
      '(P)→(3) (Q)→(4) (R)→(1) (S)→(2)',
      '(P)→(5) (Q)→(4) (R)→(1) (S)→(2)',
      '(P)→(3) (Q)→(4) (R)→(1) (S)→(5)',
      '(P)→(3) (Q)→(1) (R)→(4) (S)→(5)'
    ],
    answer: { correctIndex: 2 },
    hints: ['Match the $x$ and $y$ coordinates of general points first.'],
    steps: [
      { h: 'Idea', d: 'Two coordinates find the intersection; the third gives $\\gamma$.' },
      { h: 'Intersect', d: '$L_1$: $(-11 + t, -21 + 2t, -29 + 3t)$; $L_2$: $(-16 + 3s, -11 + 2s, -4 + \\gamma s)$. From $x$: $t = 3s - 5$; from $y$: $t = s + 5$. So $s = 5$, $t = 10$ and $R_1 = (-1, -1, 1)$.' },
      { h: '$\\gamma$', d: '$z$: $1 = -4 + 5\\gamma$ gives $\\gamma = 1$.' },
      { h: 'Normal', d: '$(1, 2, 3)\\times(3, 2, 1) = (-4, 8, -4) \\parallel (1, -2, 1)$, so $\\hat n = \\frac1{\\sqrt6}(1, -2, 1)$.' },
      { h: 'Dot product', d: '$\\overrightarrow{OR_1}\\cdot\\hat n = \\dfrac{-1 + 2 + 1}{\\sqrt6} = \\sqrt{\\dfrac23}$.' },
      { h: 'Match', d: '(P)→(3), (Q)→(4), (R)→(1), (S)→(5).' }
    ]
  },
  {
    ...P1, id: 'jeeadv-2024-p1-q17', section: 'Section 4', questionNumber: 17,
    chapterId: 'c12-continuity-differentiability', difficulty: 4, answerType: 'mcq',
    prompt: 'Let $f:\\mathbb R \\to \\mathbb R$ and $g:\\mathbb R \\to \\mathbb R$ be functions defined by\n\n$f(x) = \\begin{cases} x|x|\\sin\\left(\\dfrac1x\\right), & x \\ne 0,\\\\ 0, & x = 0,\\end{cases}$ and $g(x) = \\begin{cases} 1 - 2x, & 0 \\le x \\le \\frac12,\\\\ 0, & \\text{otherwise}.\\end{cases}$\n\nLet $a, b, c, d \\in \\mathbb R$. Define the function $h:\\mathbb R \\to \\mathbb R$ by\n\n$h(x) = a\\,f(x) + b\\left(g(x) + g\\left(\\tfrac12 - x\\right)\\right) + c\\,(x - g(x)) + d\\,g(x)$, $x \\in \\mathbb R$.\n\n' + MATCH + '\n\nList-I: (P) If $a = 0, b = 1, c = 0$, and $d = 0$, then; (Q) If $a = 1, b = 0, c = 0$, and $d = 0$, then; (R) If $a = 0, b = 0, c = 1$, and $d = 0$, then; (S) If $a = 0, b = 0, c = 0$, and $d = 1$, then.\n\nList-II: (1) $h$ is one-one. (2) $h$ is onto. (3) $h$ is differentiable on $\\mathbb R$. (4) the range of $h$ is $[0, 1]$. (5) the range of $h$ is $\\{0, 1\\}$.',
    mcqOptions: [
      '(P)→(4) (Q)→(3) (R)→(1) (S)→(2)',
      '(P)→(5) (Q)→(2) (R)→(4) (S)→(3)',
      '(P)→(5) (Q)→(3) (R)→(2) (S)→(4)',
      '(P)→(4) (Q)→(2) (R)→(1) (S)→(3)'
    ],
    answer: { correctIndex: 2 },
    hints: ['Work out $g(x) + g(\\frac12 - x)$ on $[0, \\frac12]$ and off it.'],
    steps: [
      { h: '(P)', d: 'On $[0, \\frac12]$, $g(x) + g(\\frac12 - x) = (1 - 2x) + 2x = 1$; elsewhere one argument is outside $[0, \\frac12]$ and the other too, so the sum is $0$. Range $\\{0, 1\\}$.' },
      { h: '(Q)', d: '$f\'(0) = \\lim |x|\\sin\\frac1x = 0$, and $f$ is differentiable away from $0$, so $h = f$ is differentiable on $\\mathbb R$.' },
      { h: '(R)', d: '$h = x - g(x)$ is $x$ off $[0, \\frac12]$ and $3x - 1$ on it: it takes every value in $(-\\infty, 0)$, $[-1, \\frac12]$ and $(\\frac12, \\infty)$, so it is onto (but not one-one).' },
      { h: '(S)', d: '$h = g$ falls from $1$ to $0$ on $[0, \\frac12]$ and is $0$ elsewhere: range $[0, 1]$.' },
      { h: 'Match', d: '(P)→(5), (Q)→(3), (R)→(2), (S)→(4).' }
    ]
  },

  // ── Paper 2 · Section 1 ──
  {
    ...P2, id: 'jeeadv-2024-p2-q1', section: 'Section 1', questionNumber: 1,
    chapterId: 'c12-inverse-trigonometric', difficulty: 2, answerType: 'mcq',
    prompt: 'Considering only the principal values of the inverse trigonometric functions, the value of\n\n$\\tan\\left(\\sin^{-1}\\left(\\dfrac35\\right) - 2\\cos^{-1}\\left(\\dfrac{2}{\\sqrt5}\\right)\\right)$\n\nis',
    mcqOptions: ['$\\dfrac{7}{24}$', '$\\dfrac{-7}{24}$', '$\\dfrac{-5}{24}$', '$\\dfrac{5}{24}$'],
    answer: { correctIndex: 1 },
    hints: ['Convert both angles to tangents.'],
    steps: [
      { h: 'Idea', d: 'Name the angles and use tangent formulas.' },
      { h: 'Tangents', d: '$A = \\sin^{-1}\\frac35$ has $\\tan A = \\frac34$. $B = \\cos^{-1}\\frac2{\\sqrt5}$ has $\\tan B = \\frac12$, so $\\tan2B = \\dfrac{1}{1 - \\frac14} = \\frac43$.' },
      { h: 'Subtract', d: '$\\tan(A - 2B) = \\dfrac{\\frac34 - \\frac43}{1 + 1} = -\\dfrac{7}{24}$.' }
    ]
  },
  {
    ...P2, id: 'jeeadv-2024-p2-q2', section: 'Section 1', questionNumber: 2,
    chapterId: 'c12-applications-integrals', difficulty: 3, answerType: 'mcq',
    prompt: 'Let $S = \\left\\{(x, y) \\in \\mathbb R \\times \\mathbb R : x \\ge 0,\\ y \\ge 0,\\ y^2 \\le 4x,\\ y^2 \\le 12 - 2x \\text{ and } 3y + \\sqrt8\\,x \\le 5\\sqrt8\\right\\}$. If the area of the region $S$ is $\\alpha\\sqrt2$, then $\\alpha$ is equal to',
    mcqOptions: ['$\\dfrac{17}{2}$', '$\\dfrac{17}{3}$', '$\\dfrac{17}{4}$', '$\\dfrac{17}{5}$'],
    answer: { correctIndex: 1 },
    hints: ['All three boundaries pass through $(2, 2\\sqrt2)$. Integrate in $y$.'],
    steps: [
      { h: 'Idea', d: 'The two parabolas and the line meet at one point, and in $0 \\le y \\le 2\\sqrt2$ the line is the right-hand boundary.' },
      { h: 'Common point', d: '$4x = 12 - 2x$ gives $(2, 2\\sqrt2)$, and $3(2\\sqrt2) + 2\\sqrt2\\cdot2 = 10\\sqrt2$, so the line passes through it too.' },
      { h: 'Bounds', d: 'For $0 \\le y \\le 2\\sqrt2$: $\\dfrac{y^2}{4} \\le x \\le \\dfrac{10\\sqrt2 - 3y}{2\\sqrt2}$ (the line lies inside $y^2 \\le 12 - 2x$ there). Above $2\\sqrt2$ the region is empty.' },
      { h: 'Integrate', d: '$\\displaystyle\\int_0^{2\\sqrt2}\\left(5 - \\frac{3y}{2\\sqrt2} - \\frac{y^2}{4}\\right)dy = 10\\sqrt2 - 3\\sqrt2 - \\frac{4\\sqrt2}{3} = \\frac{17}{3}\\sqrt2$.' }
    ]
  },
  {
    ...P2, id: 'jeeadv-2024-p2-q3', section: 'Section 1', questionNumber: 3,
    chapterId: 'c11-limits-derivatives', difficulty: 2, answerType: 'mcq',
    prompt: 'Let $k \\in \\mathbb R$. If $\\displaystyle\\lim_{x\\to0^+}\\left(\\sin(\\sin kx) + \\cos x + x\\right)^{2/x} = e^6$, then the value of $k$ is',
    mcqOptions: ['$1$', '$2$', '$3$', '$4$'],
    answer: { correctIndex: 1 },
    hints: ['A $1^\\infty$ form: the limit is $e^{\\lim \\frac2x(\\text{base} - 1)}$.'],
    steps: [
      { h: 'Idea', d: 'For $1^\\infty$, $\\lim(1 + u)^{v} = e^{\\lim uv}$.' },
      { h: 'Exponent', d: '$\\dfrac{2}{x}\\left(\\sin(\\sin kx) + \\cos x - 1 + x\\right) \\to 2(k + 0 + 1)$.' },
      { h: 'Solve', d: '$2k + 2 = 6$ gives $k = 2$.' }
    ]
  },
  {
    ...P2, id: 'jeeadv-2024-p2-q4', section: 'Section 1', questionNumber: 4,
    chapterId: 'c11-trig-functions', difficulty: 3, answerType: 'mcq',
    prompt: 'Let $f:\\mathbb R \\to \\mathbb R$ be a function defined by\n\n$f(x) = \\begin{cases} x^2\\sin\\left(\\dfrac{\\pi}{x^2}\\right), & \\text{if } x \\ne 0,\\\\ 0, & \\text{if } x = 0.\\end{cases}$\n\nThen which of the following statements is TRUE?',
    mcqOptions: [
      '$f(x) = 0$ has infinitely many solutions in the interval $\\left[\\dfrac{1}{10^{10}}, \\infty\\right)$.',
      '$f(x) = 0$ has no solutions in the interval $\\left[\\dfrac1\\pi, \\infty\\right)$.',
      'The set of solutions of $f(x) = 0$ in the interval $\\left(0, \\dfrac{1}{10^{10}}\\right)$ is finite.',
      '$f(x) = 0$ has more than $25$ solutions in the interval $\\left(\\dfrac{1}{\\pi^2}, \\dfrac1\\pi\\right)$.'
    ],
    answer: { correctIndex: 3 },
    hints: ['For $x > 0$, $f(x) = 0$ exactly when $x = \\dfrac{1}{\\sqrt n}$.'],
    steps: [
      { h: 'Idea', d: 'List the positive zeros explicitly and count them in each interval.' },
      { h: 'Zeros', d: '$\\sin\\frac{\\pi}{x^2} = 0 \\iff \\frac{\\pi}{x^2} = n\\pi \\iff x = \\frac1{\\sqrt n}$, $n = 1, 2, \\ldots$' },
      { h: '(A), (B), (C)', d: '$x \\ge 10^{-10}$ needs $n \\le 10^{20}$: finitely many. $x \\ge \\frac1\\pi$ includes $n = 1, \\ldots, 9$. Near $0$ there are infinitely many. All three are false.' },
      { h: '(D)', d: '$\\frac1{\\pi^2} < \\frac1{\\sqrt n} < \\frac1\\pi \\iff \\pi^2 < n < \\pi^4 \\approx 97.4$: $n = 10, \\ldots, 97$, i.e. $88$ solutions, more than $25$.' }
    ]
  },

  // ── Paper 2 · Section 3 (non-negative integer) ──
  {
    ...P2, id: 'jeeadv-2024-p2-q8', section: 'Section 3', questionNumber: 8,
    chapterId: 'c11-relations-functions', difficulty: 3, answerType: 'numeric',
    prompt: 'Let $f:\\mathbb R \\to \\mathbb R$ be a function such that $f(x + y) = f(x) + f(y)$ for all $x, y \\in \\mathbb R$, and $g:\\mathbb R \\to (0, \\infty)$ be a function such that $g(x + y) = g(x)g(y)$ for all $x, y \\in \\mathbb R$. If $f\\left(\\dfrac{-3}{5}\\right) = 12$ and $g\\left(\\dfrac{-1}{3}\\right) = 2$, then the value of $\\left(f\\left(\\dfrac14\\right) + g(-2) - 8\\right)g(0)$ is ____.',
    answer: { value: 51 },
    inputHint: 'Enter the integer',
    hints: ['At rational points, $f(q) = q\\,f(1)$ and $g(q) = g(1)^q$.'],
    steps: [
      { h: 'Idea', d: 'The functional equations fix $f$ and $g$ at every rational point from one value each.' },
      { h: '$f$', d: '$f(q) = qf(1)$: $-\\frac35f(1) = 12$ gives $f(1) = -20$ and $f(\\frac14) = -5$.' },
      { h: '$g$', d: '$g(q) = g(1)^q$: $g(1)^{-1/3} = 2$ gives $g(1) = \\frac18$, so $g(-2) = 64$; and $g(0) = 1$.' },
      { h: 'Answer', d: '$(-5 + 64 - 8)\\cdot1 = 51$.' }
    ]
  },
  {
    ...P2, id: 'jeeadv-2024-p2-q9', section: 'Section 3', questionNumber: 9,
    chapterId: 'c12-probability', difficulty: 3, answerType: 'numeric',
    prompt: 'A bag contains $N$ balls out of which $3$ balls are white, $6$ balls are green, and the remaining balls are blue. Assume that the balls are identical otherwise. Three balls are drawn randomly one after the other without replacement. For $i = 1, 2, 3$, let $W_i, G_i$, and $B_i$ denote the events that the ball drawn in the $i$th draw is a white ball, green ball, and blue ball, respectively. If the probability $P(W_1 \\cap G_2 \\cap B_3) = \\dfrac{2}{5N}$ and the conditional probability $P(B_3 \\mid W_1 \\cap G_2) = \\dfrac29$, then $N$ equals ____.',
    answer: { value: 11 },
    inputHint: 'Enter the integer',
    hints: ['After a white and a green are drawn, $N - 2$ balls remain, $N - 9$ of them blue.'],
    steps: [
      { h: 'Idea', d: 'The conditional probability alone fixes $N$; the other condition checks it.' },
      { h: 'Condition', d: '$P(B_3 \\mid W_1G_2) = \\dfrac{N - 9}{N - 2} = \\dfrac29$ gives $9N - 81 = 2N - 4$, so $N = 11$.' },
      { h: 'Check', d: '$\\dfrac3{11}\\cdot\\dfrac6{10}\\cdot\\dfrac29 = \\dfrac{2}{55} = \\dfrac{2}{5\\cdot11}$ ✓.' }
    ]
  },
  {
    ...P2, id: 'jeeadv-2024-p2-q10', section: 'Section 3', questionNumber: 10,
    chapterId: 'c12-applications-derivatives', difficulty: 2, answerType: 'numeric',
    prompt: 'Let the function $f:\\mathbb R \\to \\mathbb R$ be defined by\n\n$f(x) = \\dfrac{\\sin x}{e^{\\pi x}}\\cdot\\dfrac{x^{2023} + 2024x + 2025}{x^2 - x + 3} + \\dfrac{2}{e^{\\pi x}}\\cdot\\dfrac{x^{2023} + 2024x + 2025}{x^2 - x + 3}.$\n\nThen the number of solutions of $f(x) = 0$ in $\\mathbb R$ is ____.',
    answer: { value: 1 },
    inputHint: 'Enter the integer',
    hints: ['Factor out the common fraction.'],
    steps: [
      { h: 'Idea', d: 'Factor; every factor but one is never zero.' },
      { h: 'Factor', d: '$f(x) = \\dfrac{(\\sin x + 2)(x^{2023} + 2024x + 2025)}{e^{\\pi x}(x^2 - x + 3)}$, with $\\sin x + 2 > 0$, $e^{\\pi x} > 0$ and $x^2 - x + 3 > 0$.' },
      { h: 'Count', d: '$p(x) = x^{2023} + 2024x + 2025$ has $p\'(x) = 2023x^{2022} + 2024 > 0$, so it is strictly increasing from $-\\infty$ to $\\infty$: exactly $1$ root.' }
    ]
  },
  {
    ...P2, id: 'jeeadv-2024-p2-q11', section: 'Section 3', questionNumber: 11,
    chapterId: 'c12-vector-algebra', difficulty: 3, answerType: 'numeric',
    prompt: 'Let $\\vec p = 2\\hat\\imath + \\hat\\jmath + 3\\hat k$ and $\\vec q = \\hat\\imath - \\hat\\jmath + \\hat k$. If for some real numbers $\\alpha, \\beta$, and $\\gamma$, we have\n\n$15\\hat\\imath + 10\\hat\\jmath + 6\\hat k = \\alpha\\left(2\\vec p + \\vec q\\right) + \\beta\\left(\\vec p - 2\\vec q\\right) + \\gamma\\left(\\vec p \\times \\vec q\\right),$\n\nthen the value of $\\gamma$ is ____.',
    answer: { value: 2 },
    inputHint: 'Enter the integer',
    hints: ['Dot both sides with $\\vec p \\times \\vec q$.'],
    steps: [
      { h: 'Idea', d: '$\\vec p \\times \\vec q$ is perpendicular to $\\vec p$ and $\\vec q$, so a dot product isolates $\\gamma$.' },
      { h: 'Cross product', d: '$\\vec p \\times \\vec q = (1\\cdot1 - 3\\cdot(-1),\\ 3\\cdot1 - 2\\cdot1,\\ 2\\cdot(-1) - 1\\cdot1) = (4, 1, -3)$, with $|\\vec p \\times \\vec q|^2 = 26$.' },
      { h: 'Dot', d: '$(15, 10, 6)\\cdot(4, 1, -3) = 60 + 10 - 18 = 52 = 26\\gamma$, so $\\gamma = 2$.' }
    ]
  },
  {
    ...P2, id: 'jeeadv-2024-p2-q12', section: 'Section 3', questionNumber: 12,
    chapterId: 'c11-conic-sections', difficulty: 4, answerType: 'numeric',
    prompt: 'A normal with slope $\\dfrac{1}{\\sqrt6}$ is drawn from the point $(0, -\\alpha)$ to the parabola $x^2 = -4ay$, where $a > 0$. Let $L$ be the line passing through $(0, -\\alpha)$ and parallel to the directrix of the parabola. Suppose that $L$ intersects the parabola at two points $A$ and $B$. Let $r$ denote the length of the latus rectum and $s$ denote the square of the length of the line segment $AB$. If $r : s = 1 : 16$, then the value of $24a$ is ____.',
    answer: { value: 12 },
    inputHint: 'Enter the integer',
    hints: ['Use the point $(2at, -at^2)$; the normal there has slope $\\frac1t$.'],
    steps: [
      { h: 'Idea', d: 'The normal\'s slope fixes the foot, which gives $\\alpha$ in terms of $a$; then $AB$ follows.' },
      { h: 'Normal', d: 'At $(2at, -at^2)$ the tangent slope is $-t$, so the normal slope is $\\frac1t = \\frac1{\\sqrt6}$: $t = \\sqrt6$, foot $(2\\sqrt6 a, -6a)$.' },
      { h: 'Find $\\alpha$', d: 'The normal $y + 6a = \\frac1{\\sqrt6}(x - 2\\sqrt6a)$ meets $x = 0$ at $y = -8a$, so $\\alpha = 8a$.' },
      { h: 'Chord $AB$', d: '$L: y = -8a$ (the directrix $y = a$ is horizontal). Then $x^2 = 32a^2$, $AB = 8\\sqrt2a$ and $s = 128a^2$.' },
      { h: 'Ratio', d: '$r = 4a$, so $\\dfrac{4a}{128a^2} = \\dfrac1{32a} = \\dfrac1{16}$ gives $a = \\frac12$ and $24a = 12$.' }
    ]
  },
  {
    ...P2, id: 'jeeadv-2024-p2-q13', section: 'Section 3', questionNumber: 13,
    chapterId: 'c12-integrals', difficulty: 4, answerType: 'numeric',
    prompt: 'Let the function $f:[1, \\infty) \\to \\mathbb R$ be defined by\n\n$f(t) = \\begin{cases} (-1)^{n+1}\\,2, & \\text{if } t = 2n - 1,\\ n \\in \\mathbb N,\\\\ \\dfrac{(2n + 1 - t)}{2}f(2n - 1) + \\dfrac{(t - (2n - 1))}{2}f(2n + 1), & \\text{if } 2n - 1 < t < 2n + 1,\\ n \\in \\mathbb N.\\end{cases}$\n\nDefine $g(x) = \\displaystyle\\int_1^x f(t)\\,dt$, $x \\in (1, \\infty)$. Let $\\alpha$ denote the number of solutions of the equation $g(x) = 0$ in the interval $(1, 8]$ and $\\beta = \\displaystyle\\lim_{x\\to1^+}\\frac{g(x)}{x - 1}$. Then the value of $\\alpha + \\beta$ is equal to ____.',
    answer: { value: 5 },
    inputHint: 'Enter the integer',
    hints: ['$f$ zig-zags linearly between $2$ and $-2$ at the odd integers.'],
    steps: [
      { h: 'Idea', d: '$f$ is a triangle wave, so $g$ returns to $0$ after every full rise or fall.' },
      { h: 'Shape of $f$', d: '$f(1) = 2, f(3) = -2, f(5) = 2, f(7) = -2, f(9) = 2$, linear in between.' },
      { h: 'Zeros of $g$', d: 'Over each $[2n - 1, 2n + 1]$, $f$ is linear and antisymmetric about the midpoint, so its integral is $0$: $g(3) = g(5) = g(7) = 0$. Between them $g$ is strictly one sign, and on $(7, 8]$ $f < 0$ so $g < 0$. So $\\alpha = 3$.' },
      { h: '$\\beta$', d: 'By the fundamental theorem, $\\beta = f(1) = 2$.' },
      { h: 'Answer', d: '$\\alpha + \\beta = 5$.' }
    ]
  },

  // ── Paper 2 · Section 4 (paragraphs, numerical value) ──
  {
    ...P2, id: 'jeeadv-2024-p2-q14', section: 'Section 4', questionNumber: 14,
    chapterId: 'c11-permutations-combinations', difficulty: 2, answerType: 'numeric',
    prompt: `${PARA_I}\n\nIf $n(X) = {}^mC_6$, then the value of $m$ is ____.`,
    answer: { value: 20, tol: 0.01, officialRange: [19.99, 20.01] },
    inputHint: 'Enter $m$',
    hints: ['Count the ordered pairs $(a, b)$ with $|a - b| \\ge 2$.'],
    steps: [
      { h: 'Idea', d: 'A relation in $X$ is any $6$ of the allowed pairs.' },
      { h: 'Allowed pairs', d: 'Of the $36$ pairs, $6$ have $a = b$ and $10$ have $|a - b| = 1$, leaving $20$.' },
      { h: 'Answer', d: '$n(X) = {}^{20}C_6$, so $m = 20$.' }
    ]
  },
  {
    ...P2, id: 'jeeadv-2024-p2-q15', section: 'Section 4', questionNumber: 15,
    chapterId: 'c12-relations-functions', difficulty: 3, answerType: 'numeric',
    prompt: `${PARA_I}\n\nIf the value of $n(Y) + n(Z)$ is $k^2$, then $|k|$ is ____.`,
    answer: { value: 36, tol: 0.01, officialRange: [35.99, 36.01] },
    inputHint: 'Enter $|k|$',
    hints: ['For each $b$, how many $a$ satisfy $|a - b| \\ge 2$?'],
    steps: [
      { h: 'Idea', d: 'Both counts depend only on how many partners each element has.' },
      { h: 'Partners', d: 'For $b = 1, \\ldots, 6$ the number of $a$ with $|a - b| \\ge 2$ is $4, 3, 3, 3, 3, 4$.' },
      { h: '$n(Y)$', d: 'A single range value $b$ needs $6$ distinct partners, but at most $4$ exist: $n(Y) = 0$.' },
      { h: '$n(Z)$', d: 'A function picks one allowed image for each $a$: $4\\cdot3\\cdot3\\cdot3\\cdot3\\cdot4 = 1296 = 36^2$.' },
      { h: 'Answer', d: '$|k| = 36$.' }
    ]
  },
  {
    ...P2, id: 'jeeadv-2024-p2-q16', section: 'Section 4', questionNumber: 16,
    chapterId: 'c12-integrals', difficulty: 3, answerType: 'numeric',
    prompt: `${PARA_II}\n\nThe value of $2\\displaystyle\\int_0^{\\pi/2} f(x)g(x)\\,dx - \\int_0^{\\pi/2} g(x)\\,dx$ is ____.`,
    answer: { value: 0, tol: 0, officialRange: [0, 0] },
    inputHint: 'Enter the value',
    hints: ['$g\\left(\\frac\\pi2 - x\\right) = g(x)$.'],
    steps: [
      { h: 'Idea', d: '$g$ is symmetric about $\\frac\\pi4$, so $\\sin^2$ and $\\cos^2$ weight it equally.' },
      { h: 'Reflect', d: 'With $x \\to \\frac\\pi2 - x$: $I = \\displaystyle\\int_0^{\\pi/2}\\sin^2x\\,g(x)\\,dx = \\int_0^{\\pi/2}\\cos^2x\\,g(x)\\,dx$.' },
      { h: 'Add', d: '$2I = \\displaystyle\\int_0^{\\pi/2} g(x)\\,dx$, so the expression is $0$.' }
    ]
  },
  {
    ...P2, id: 'jeeadv-2024-p2-q17', section: 'Section 4', questionNumber: 17,
    chapterId: 'c12-integrals', difficulty: 4, answerType: 'numeric',
    prompt: `${PARA_II}\n\nThe value of $\\dfrac{16}{\\pi^3}\\displaystyle\\int_0^{\\pi/2} f(x)g(x)\\,dx$ is ____.`,
    answer: { value: 0.25, tol: 0.01, officialRange: [0.24, 0.26] },
    inputHint: 'Enter the value',
    hints: ['$y = g(x)$ is the upper half of a circle.'],
    steps: [
      { h: 'Idea', d: 'Halve $\\int g$ (previous question) and read $\\int g$ as a semicircle\'s area.' },
      { h: 'A semicircle', d: '$y^2 = \\frac{\\pi x}{2} - x^2$ is $\\left(x - \\frac\\pi4\\right)^2 + y^2 = \\left(\\frac\\pi4\\right)^2$, so $\\int_0^{\\pi/2} g = \\frac12\\pi\\left(\\frac\\pi4\\right)^2 = \\frac{\\pi^3}{32}$.' },
      { h: 'Halve', d: '$\\int_0^{\\pi/2} fg = \\frac12\\cdot\\frac{\\pi^3}{32} = \\frac{\\pi^3}{64}$.' },
      { h: 'Answer', d: '$\\dfrac{16}{\\pi^3}\\cdot\\dfrac{\\pi^3}{64} = \\dfrac14 = 0.25$.' }
    ]
  }
]);
