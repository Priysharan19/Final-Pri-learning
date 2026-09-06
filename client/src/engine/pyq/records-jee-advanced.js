// Pri Learning · JEE Advanced previous-year questions
//
// Every record here was transcribed from a PDF published by the exam authority
// at jeeadv.ac.in and cited in pyqSources.js, reading the rendered page rather
// than an extracted text layer: the 2024-and-earlier files flatten fractions
// and exponents when their text is extracted ("10 31 9 11 11 x x") and a
// transcription made from that would be a different question wearing a real
// year's name.
//
// Both sittings here are cited from the authority's own answer document, which
// prints the question and the final answer on the same page, so the prompt and
// the key have one provenance. Two JEE Advanced numerical-value answers are
// keyed by the authority as an accepted band rather than a point; those records
// quote the band in `officialRange` and set `tol` to match it, so a student is
// marked exactly as the exam marks.
//
// Chapter routing is at chapter level only. The archive does not claim to know
// which NCERT dot point a JEE Advanced question exercises, and indiaProduct.js
// keeps dot-point practice on the authored generators for that reason.

import { PYQ_PROVENANCE } from './pyqSources.js';

const ADV_2026_P1 = Object.freeze({
  examId: 'jee-advanced',
  year: 2026,
  paper: '1',
  provenance: PYQ_PROVENANCE.OFFICIAL_PAPER_AND_KEY,
  pastPaper: true,
  promptSource: ['jeeadv-2026-p1-answers', 'jeeadv-2026-p1-questions'],
  answerSource: 'jeeadv-2026-p1-answers'
});

const ADV_2025_P1 = Object.freeze({
  examId: 'jee-advanced',
  year: 2025,
  paper: '1',
  provenance: PYQ_PROVENANCE.OFFICIAL_PAPER_AND_KEY,
  pastPaper: true,
  promptSource: 'jeeadv-2025-p1-answers',
  answerSource: 'jeeadv-2025-p1-answers'
});

export const JEE_ADVANCED_PYQ_RECORDS = Object.freeze([
  // ── JEE Advanced 2026 · Paper 1 · Mathematics · Section 1 (single correct) ──
  {
    ...ADV_2026_P1,
    id: 'jeeadv-2026-p1-q1',
    section: 'Section 1',
    questionNumber: 1,
    chapterId: 'c12-applications-derivatives',
    difficulty: 4,
    answerType: 'mcq',
    prompt: 'Consider the function $f:(0,\\infty)\\to(-\\infty,\\infty)$ given by\n\n$f(x) = \\sqrt{x}\\,\\log_e(x) - x + 1.$\n\nThen which one of the following statements is TRUE?',
    mcqOptions: [
      'The derivative of the function $f$ is decreasing in the interval $(0, 1)$',
      'The function $f$ has a local maximum at some point $a \\in (0, \\infty)$',
      'The function $f$ has a local minimum at some point $b \\in (0, \\infty)$',
      'The function $f$ has NEITHER a point of local maximum NOR a point of local minimum in the interval $(0, \\infty)$'
    ],
    answer: { correctIndex: 3 },
    hints: ['Differentiate, then write everything in terms of $t = \\sqrt{x}$.'],
    steps: [
      { h: 'Differentiate', d: '$f\'(x) = \\dfrac{\\log_e x}{2\\sqrt{x}} + \\dfrac{1}{\\sqrt{x}} - 1$.' },
      { h: 'Substitute $t = \\sqrt{x}$', d: 'With $t = \\sqrt{x} > 0$, $\\log_e x = 2\\log_e t$, so $f\'= \\dfrac{\\log_e t + 1 - t}{t}$.' },
      { h: 'Use $\\log_e t \\le t - 1$', d: 'That inequality holds for every $t > 0$ with equality only at $t = 1$, so $\\log_e t + 1 - t \\le 0$ and therefore $f\'(x) \\le 0$ everywhere on $(0, \\infty)$.' },
      { h: 'Read the sign', d: '$f\'$ is never positive and touches $0$ only at $x = 1$. It does not change sign there, so that stationary point is neither a maximum nor a minimum, and $f$ has no turning point at all.' },
      { h: 'Check option (A)', d: 'As $x \\to 0^+$, $f\'(x) \\to -\\infty$, and $f\'(1) = 0$, so $f\'$ is increasing on $(0,1)$, not decreasing.' }
    ]
  },
  {
    ...ADV_2026_P1,
    id: 'jeeadv-2026-p1-q2',
    section: 'Section 1',
    questionNumber: 2,
    chapterId: 'c11-conic-sections',
    difficulty: 4,
    answerType: 'mcq',
    prompt: 'Let $P$ be the point on the parabola $y = x^2$ such that the slope of the tangent to the parabola at the point $P$ is $4$. Let $Q$ be the point in the first quadrant lying on the circle $x^2 + y^2 = 2$ such that the slope of the tangent to the circle at the point $Q$ is $-1$. Let $R$ be the point in the first quadrant lying on the ellipse $x^2 + 4y^2 = 8$ such that the slope of the tangent to the ellipse at the point $R$ is $-\\tfrac{1}{2}$. Then the radius of the circle passing through the points $P, Q$ and $R$ is',
    mcqOptions: ['$\\sqrt{10}$', '$\\sqrt{5}$', '$\\sqrt{\\dfrac{5}{2}}$', '$2\\sqrt{5}$'],
    answer: { correctIndex: 2 },
    hints: ['Find the three points first; then look for a right angle among them.'],
    steps: [
      { h: 'Point $P$', d: 'On $y = x^2$, $\\dfrac{dy}{dx} = 2x = 4$ gives $x = 2$, so $P = (2, 4)$.' },
      { h: 'Point $Q$', d: 'On $x^2 + y^2 = 2$, $\\dfrac{dy}{dx} = -\\dfrac{x}{y} = -1$ gives $x = y$, and $2x^2 = 2$ gives the first-quadrant point $Q = (1, 1)$.' },
      { h: 'Point $R$', d: 'On $x^2 + 4y^2 = 8$, $\\dfrac{dy}{dx} = -\\dfrac{x}{4y} = -\\tfrac{1}{2}$ gives $x = 2y$, and $8y^2 = 8$ gives the first-quadrant point $R = (2, 1)$.' },
      { h: 'Spot the right angle', d: '$RP$ is vertical ($x = 2$) and $RQ$ is horizontal ($y = 1$), so the angle at $R$ is a right angle and $PQ$ is a diameter of the circle through $P, Q, R$.' },
      { h: 'Radius', d: '$PQ = \\sqrt{(2-1)^2 + (4-1)^2} = \\sqrt{10}$, so the radius is $\\dfrac{\\sqrt{10}}{2} = \\sqrt{\\dfrac{5}{2}}$.' }
    ]
  },
  {
    ...ADV_2026_P1,
    id: 'jeeadv-2026-p1-q3',
    section: 'Section 1',
    questionNumber: 3,
    chapterId: 'c12-matrices',
    difficulty: 3,
    answerType: 'mcq',
    prompt: 'Which one of the following matrices can be obtained by performing elementary row transformations on the $3 \\times 3$ identity matrix?',
    mcqOptions: [
      '$\\begin{bmatrix}1&1&1\\\\1&1&1\\\\1&1&1\\end{bmatrix}$',
      '$\\begin{bmatrix}1&1&1\\\\2&3&4\\\\1&2&1\\end{bmatrix}$',
      '$\\begin{bmatrix}1&1&1\\\\2&3&4\\\\2&5&8\\end{bmatrix}$',
      '$\\begin{bmatrix}1&1&1\\\\-1&1&2\\\\0&2&3\\end{bmatrix}$'
    ],
    answer: { correctIndex: 1 },
    hints: ['Every elementary row operation is invertible, so ask which of these four matrices is.'],
    steps: [
      { h: 'What row operations preserve', d: 'Each elementary row operation is invertible, so a matrix reachable from $I$ by row operations must itself be invertible — its determinant cannot be $0$.' },
      { h: 'Rule out (A)', d: 'All three rows are equal, so the determinant is $0$.' },
      { h: 'Rule out (C) and (D)', d: 'For (C), $\\det = 4 - 8 + 4 = 0$; for (D), $\\det = -1 + 3 - 2 = 0$.' },
      { h: 'Check (B)', d: '$\\det = 1(3 - 8) - 1(2 - 4) + 1(4 - 3) = -5 + 2 + 1 = -2 \\ne 0$, so (B) is the invertible one and is reachable from $I$.' }
    ]
  },
  {
    ...ADV_2026_P1,
    id: 'jeeadv-2026-p1-q4',
    section: 'Section 1',
    questionNumber: 4,
    chapterId: 'c12-inverse-trigonometric',
    difficulty: 4,
    answerType: 'mcq',
    prompt: 'Considering only the principal values of the inverse trigonometric functions, the value of\n\n$\\cot^{-1}(\\cot(-11)) + 10\\,\\sin\\!\\left(2\\cos^{-1}\\!\\left(\\dfrac{1}{\\sqrt{2}}\\right)\\right) + 10\\sin(2\\tan^{-1}(2))$\n\nis',
    mcqOptions: ['$3\\pi + 7$', '$7$', '$4\\pi + 7$', '$3\\pi - 5$'],
    answer: { correctIndex: 2 },
    hints: ['The principal branch of $\\cot^{-1}$ is $(0, \\pi)$; add a whole number of $\\pi$ to $-11$ to land inside it.'],
    steps: [
      { h: 'First term', d: '$\\cot$ has period $\\pi$ and $\\cot^{-1}$ returns a value in $(0, \\pi)$. Since $-11 + 4\\pi \\approx 1.566$ lies in $(0, \\pi)$, $\\cot^{-1}(\\cot(-11)) = 4\\pi - 11$.' },
      { h: 'Second term', d: '$\\cos^{-1}\\!\\left(\\tfrac{1}{\\sqrt{2}}\\right) = \\tfrac{\\pi}{4}$, so $10\\sin\\!\\left(\\tfrac{\\pi}{2}\\right) = 10$.' },
      { h: 'Third term', d: 'If $\\theta = \\tan^{-1} 2$ then $\\sin 2\\theta = \\dfrac{2\\tan\\theta}{1 + \\tan^2\\theta} = \\dfrac{4}{5}$, so the term is $8$.' },
      { h: 'Add', d: '$(4\\pi - 11) + 10 + 8 = 4\\pi + 7$.' }
    ]
  },

  // ── JEE Advanced 2026 · Paper 1 · Mathematics · Section 3 (numerical value) ──
  {
    ...ADV_2026_P1,
    id: 'jeeadv-2026-p1-q9',
    section: 'Section 3',
    questionNumber: 9,
    chapterId: 'c12-relations-functions',
    difficulty: 4,
    answerType: 'numeric',
    prompt: 'Let $S = \\{1, 2, 3, \\ldots, 10\\}$. Consider the set\n\n$X = \\{R : R$ is an equivalence relation on the set $S$ such that $R$ has exactly $42$ elements$\\}$.\n\nThen the number of elements in $X$ is ____.',
    answer: { value: 2520 },
    inputHint: 'Enter the number of equivalence relations',
    hints: ['An equivalence relation on $S$ is a partition of $S$; count the ordered pairs a partition produces.'],
    steps: [
      { h: 'Translate to partitions', d: 'An equivalence relation on $S$ is exactly a partition of $S$ into blocks of sizes $n_1, n_2, \\ldots$, and it contains $\\sum n_i^2$ ordered pairs.' },
      { h: 'Solve the size condition', d: 'We need $\\sum n_i = 10$ and $\\sum n_i^2 = 42$. Checking the partitions of $10$, only $5 + 4 + 1$ and $6 + 2 + 1 + 1$ work.' },
      { h: 'Count $5 + 4 + 1$', d: 'All three block sizes differ, so the count is $\\dfrac{10!}{5!\\,4!\\,1!} = 1260$.' },
      { h: 'Count $6 + 2 + 1 + 1$', d: '$\\binom{10}{6}\\binom{4}{2} = 210 \\times 6 = 1260$; the two remaining singletons are then forced.' },
      { h: 'Add', d: '$1260 + 1260 = 2520$.' }
    ]
  },
  {
    ...ADV_2026_P1,
    id: 'jeeadv-2026-p1-q10',
    section: 'Section 3',
    questionNumber: 10,
    chapterId: 'c12-continuity-differentiability',
    difficulty: 4,
    answerType: 'numeric',
    prompt: 'Consider the function $f:\\left(-\\dfrac{\\pi}{2}, \\dfrac{\\pi}{2}\\right) \\to (-\\infty, \\infty)$ defined by\n\n$f(x) = (|x| + |x - 1|)\\sin x + [\\,x\\sin x\\,],$\n\nwhere $[\\,x\\sin x\\,]$ is the greatest integer less than or equal to $x\\sin x$.\n\nLet $\\alpha$ be the total number of points in the interval $\\left(-\\dfrac{\\pi}{2}, \\dfrac{\\pi}{2}\\right)$ at which $f$ is NOT continuous, and let $\\beta$ be the total number of points in $\\left(-\\dfrac{\\pi}{2}, \\dfrac{\\pi}{2}\\right)$ at which $f$ is NOT differentiable.\n\nThen the value of $\\alpha + \\beta$ is ____.',
    answer: { value: 5 },
    inputHint: 'Enter the value of $\\alpha + \\beta$',
    hints: ['Treat the two pieces separately: the modulus part is continuous everywhere, and only the greatest-integer part can jump.'],
    steps: [
      { h: 'The smooth part', d: 'Write $g(x) = (|x| + |x-1|)\\sin x$. It is continuous everywhere. Its only possible corners are at $x = 0$ and $x = 1$.' },
      { h: '$x = 0$ is safe', d: 'Near $0$ the bracket is $1 - 2x$ on the left and $1$ on the right; both one-sided derivatives of $g$ come to $\\cos 0 = 1$ because the corner is multiplied by $\\sin 0 = 0$. So $g$ is differentiable at $0$.' },
      { h: '$x = 1$ is a corner', d: 'On the left of $1$ the bracket is $1$ and on the right it is $2x - 1$, giving one-sided derivatives $\\cos 1$ and $2\\sin 1 + \\cos 1$. These differ, so $g$ is not differentiable at $x = 1$ (which lies inside the interval, since $1 < \\tfrac{\\pi}{2}$).' },
      { h: 'The jump part', d: '$u(x) = x\\sin x$ is even, equals $0$ at $x = 0$ and rises towards $\\tfrac{\\pi}{2}$ at the ends, so $u$ takes the value $1$ at exactly two points $\\pm x_1$ ($x_1 \\approx 1.114$). There $[\\,u\\,]$ jumps from $0$ to $1$.' },
      { h: 'Count', d: '$\\alpha = 2$ (the two jumps). A jump is also a failure of differentiability, so $\\beta = 2 + 1 = 3$ counting $x = 1$. Hence $\\alpha + \\beta = 5$.' }
    ]
  },
  {
    ...ADV_2026_P1,
    id: 'jeeadv-2026-p1-q11',
    section: 'Section 3',
    questionNumber: 11,
    chapterId: 'c11-permutations-combinations',
    difficulty: 4,
    answerType: 'numeric',
    prompt: 'The number of ways to distribute $10$ identical red pens and $14$ identical blue pens among four persons such that each person gets $6$ pens, is ____.',
    answer: { value: 206 },
    inputHint: 'Enter the number of ways',
    hints: ['Once you fix how many red pens each person gets, the blue pens are forced.'],
    steps: [
      { h: 'Reduce to one variable', d: 'If person $i$ gets $r_i$ red pens then they get $6 - r_i$ blue pens, so only $r_1 + r_2 + r_3 + r_4 = 10$ with $0 \\le r_i \\le 6$ has to be counted.' },
      { h: 'Count without the cap', d: 'Non-negative solutions of $r_1 + r_2 + r_3 + r_4 = 10$ number $\\binom{13}{3} = 286$.' },
      { h: 'Remove the over-6 cases', d: 'If some $r_i \\ge 7$, put $r_i\' = r_i - 7$; the rest sum to $3$, giving $\\binom{6}{3} = 20$ for each of the $4$ choices of $i$. Two people cannot both exceed $6$, so there is no double count.' },
      { h: 'Subtract', d: '$286 - 4 \\times 20 = 206$.' }
    ]
  },
  {
    ...ADV_2026_P1,
    id: 'jeeadv-2026-p1-q12',
    section: 'Section 3',
    questionNumber: 12,
    chapterId: 'c11-trig-functions',
    difficulty: 4,
    answerType: 'numeric',
    prompt: 'Let\n\n$\\alpha = \\left(1 - 2\\cos\\dfrac{\\pi}{11}\\right)\\left(1 - 2\\cos\\dfrac{3\\pi}{11}\\right)\\left(1 - 2\\cos\\dfrac{9\\pi}{11}\\right)\\left(1 - 2\\cos\\dfrac{27\\pi}{11}\\right)\\left(1 - 2\\cos\\dfrac{81\\pi}{11}\\right).$\n\nThen the value of $5 - \\alpha^2$ is ____.',
    // The authority accepts 3.9 to 4.1 for this item; the exact value is 4.
    answer: { value: 4, tol: 0.1, officialRange: [3.9, 4.1] },
    inputHint: 'Enter the value of $5 - \\alpha^2$',
    hints: ['The five angles are $\\tfrac{3^k\\pi}{11}$ — reduce each one modulo $2\\pi$ first.'],
    steps: [
      { h: 'Reduce the angles', d: 'Modulo $2\\pi$, the five angles $\\tfrac{\\pi}{11}, \\tfrac{3\\pi}{11}, \\tfrac{9\\pi}{11}, \\tfrac{27\\pi}{11}, \\tfrac{81\\pi}{11}$ give the cosines of $\\tfrac{\\pi}{11}, \\tfrac{3\\pi}{11}, \\tfrac{9\\pi}{11}, \\tfrac{5\\pi}{11}, \\tfrac{7\\pi}{11}$ — the five odd multiples of $\\tfrac{\\pi}{11}$ below $\\pi$.' },
      { h: 'Bring in roots of unity', d: 'Those five angles are exactly the arguments of the ten primitive $22$nd roots of unity, taken in conjugate pairs. If $\\zeta = e^{i\\theta}$ is one of them, $1 - 2\\cos\\theta = 1 - \\zeta - \\zeta^{-1}$, and multiplying over all ten roots gives $\\alpha^2$.' },
      { h: 'Evaluate the product', d: '$1 - \\zeta - \\zeta^{-1} = -\\zeta^{-1}(\\zeta^2 - \\zeta + 1)$, and the ten primitive roots multiply to $1$, so $\\alpha^2 = \\prod_\\zeta(\\zeta^2 - \\zeta + 1) = \\Phi_{22}(\\omega)\\,\\Phi_{22}(\\bar\\omega)$ where $\\omega = e^{i\\pi/3}$ is a root of $x^2 - x + 1$.' },
      { h: 'Finish with $\\Phi_{22}$', d: '$\\Phi_{22}(x) = \\dfrac{x^{11} + 1}{x + 1}$, and $\\omega^{11} = \\bar\\omega$, so $|\\Phi_{22}(\\omega)| = \\dfrac{|1 + \\bar\\omega|}{|1 + \\omega|} = 1$. Hence $\\alpha^2 = 1$ (numerically $\\alpha = 1$).' },
      { h: 'Answer', d: '$5 - \\alpha^2 = 4$.' }
    ]
  },

  // ── JEE Advanced 2025 · Paper 1 · Mathematics · Section 1 (single correct) ──
  {
    ...ADV_2025_P1,
    id: 'jeeadv-2025-p1-q1',
    section: 'Section 1',
    questionNumber: 1,
    chapterId: 'c11-relations-functions',
    difficulty: 4,
    answerType: 'mcq',
    prompt: 'Let $\\mathbb{R}$ denote the set of all real numbers. Let $a_i, b_i \\in \\mathbb{R}$ for $i \\in \\{1, 2, 3\\}$. Define the functions $f:\\mathbb{R}\\to\\mathbb{R}$, $g:\\mathbb{R}\\to\\mathbb{R}$ and $h:\\mathbb{R}\\to\\mathbb{R}$ by\n\n$f(x) = a_1 + 10x + a_2x^2 + a_3x^3 + x^4,$\n\n$g(x) = b_1 + 3x + b_2x^2 + b_3x^3 + x^4,$\n\n$h(x) = f(x + 1) - g(x + 2).$\n\nIf $f(x) \\neq g(x)$ for every $x \\in \\mathbb{R}$, then the coefficient of $x^3$ in $h(x)$ is',
    mcqOptions: ['$8$', '$2$', '$-4$', '$-6$'],
    answer: { correctIndex: 2 },
    hints: ['A cubic with a non-zero leading coefficient always has a real root.'],
    steps: [
      { h: 'Use the "never equal" condition', d: '$f - g = (a_1 - b_1) + 7x + (a_2 - b_2)x^2 + (a_3 - b_3)x^3$. If $a_3 \\ne b_3$ this is a genuine cubic and must have a real root, so $f(x) = g(x)$ somewhere. Hence $a_3 = b_3$.' },
      { h: 'Coefficient from $f(x+1)$', d: 'Expanding, the $x^3$ coefficient of $f(x+1)$ is $a_3 + \\binom{4}{1}\\cdot 1 = a_3 + 4$.' },
      { h: 'Coefficient from $g(x+2)$', d: 'Similarly the $x^3$ coefficient of $g(x+2)$ is $b_3 + \\binom{4}{1}\\cdot 2 = b_3 + 8$.' },
      { h: 'Subtract', d: '$(a_3 + 4) - (b_3 + 8) = a_3 - b_3 - 4 = -4$, since $a_3 = b_3$.' }
    ]
  },
  {
    ...ADV_2025_P1,
    id: 'jeeadv-2025-p1-q2',
    section: 'Section 1',
    questionNumber: 2,
    chapterId: 'c12-probability',
    difficulty: 4,
    answerType: 'mcq',
    prompt: 'Three students $S_1, S_2$ and $S_3$ are given a problem to solve. Consider the following events:\n\n$U$: at least one of $S_1, S_2$ and $S_3$ can solve the problem,\n\n$V$: $S_1$ can solve the problem, given that neither $S_2$ nor $S_3$ can solve the problem,\n\n$W$: $S_2$ can solve the problem and $S_3$ cannot solve the problem,\n\n$T$: $S_3$ can solve the problem.\n\nFor any event $E$, let $P(E)$ denote the probability of $E$. If $P(U) = \\dfrac{1}{2}$, $P(V) = \\dfrac{1}{10}$ and $P(W) = \\dfrac{1}{12}$, then $P(T)$ is equal to',
    mcqOptions: ['$\\dfrac{13}{36}$', '$\\dfrac{1}{3}$', '$\\dfrac{19}{60}$', '$\\dfrac{1}{4}$'],
    answer: { correctIndex: 0 },
    hints: ['Write $p_i$ for the probability that $S_i$ solves it, and read each event as a product of independent factors.'],
    steps: [
      { h: 'Name the probabilities', d: 'Let $p_i$ be the probability that $S_i$ solves the problem, and put $a = 1 - p_2$, $b = 1 - p_3$.' },
      { h: 'Use $P(V)$', d: 'The students act independently, so conditioning on $S_2$ and $S_3$ failing does not change $S_1$: $p_1 = \\tfrac{1}{10}$.' },
      { h: 'Use $P(U)$', d: '$1 - (1 - p_1)ab = \\tfrac{1}{2}$ gives $\\tfrac{9}{10}ab = \\tfrac{1}{2}$, so $ab = \\tfrac{5}{9}$.' },
      { h: 'Use $P(W)$', d: '$(1 - a)b = \\tfrac{1}{12}$, so $b - ab = \\tfrac{1}{12}$ and $b = \\tfrac{1}{12} + \\tfrac{5}{9} = \\tfrac{23}{36}$.' },
      { h: 'Answer', d: '$P(T) = p_3 = 1 - b = \\dfrac{13}{36}$.' }
    ]
  },
  {
    ...ADV_2025_P1,
    id: 'jeeadv-2025-p1-q4',
    section: 'Section 1',
    questionNumber: 4,
    chapterId: 'c12-matrices',
    difficulty: 4,
    answerType: 'mcq',
    prompt: 'Consider the matrix $P = \\begin{pmatrix}2&0&0\\\\0&2&0\\\\0&0&3\\end{pmatrix}$. Let the transpose of a matrix $X$ be denoted by $X^{T}$. Then the number of $3 \\times 3$ invertible matrices $Q$ with integer entries, such that\n\n$Q^{-1} = Q^{T}$ and $PQ = QP$,\n\nis',
    mcqOptions: ['$32$', '$8$', '$16$', '$24$'],
    answer: { correctIndex: 2 },
    hints: ['An orthogonal matrix with integer entries has exactly one non-zero entry, $\\pm 1$, in each row and column.'],
    steps: [
      { h: 'What $Q^{-1} = Q^{T}$ forces', d: '$Q$ is orthogonal, so its columns are unit vectors with integer entries: each column is $\\pm$ a standard basis vector, and $Q$ is a signed permutation matrix.' },
      { h: 'What $PQ = QP$ forces', d: '$P$ has eigenvalue $2$ on the span of $e_1, e_2$ and eigenvalue $3$ on $e_3$. A matrix commuting with $P$ must preserve each eigenspace, so $Q$ is block diagonal: a $2 \\times 2$ block and a $1 \\times 1$ block.' },
      { h: 'Count the blocks', d: 'Signed permutation matrices of size $2$: two permutations times four sign choices, so $8$. The $1 \\times 1$ block is $\\pm 1$, so $2$.' },
      { h: 'Multiply', d: '$8 \\times 2 = 16$.' }
    ]
  },

  // ── JEE Advanced 2025 · Paper 1 · Mathematics · Section 3 (numerical value) ──
  {
    ...ADV_2025_P1,
    id: 'jeeadv-2025-p1-q8',
    section: 'Section 3',
    questionNumber: 8,
    chapterId: 'c12-relations-functions',
    difficulty: 3,
    answerType: 'numeric',
    prompt: 'Let the set of all relations $R$ on the set $\\{a, b, c, d, e, f\\}$, such that $R$ is reflexive and symmetric, and $R$ contains exactly $10$ elements, be denoted by $S$.\n\nThen the number of elements in $S$ is ____.',
    answer: { value: 105 },
    inputHint: 'Enter the number of relations',
    hints: ['Reflexivity already forces six of the ten pairs.'],
    steps: [
      { h: 'Account for reflexivity', d: 'The six pairs $(a,a), \\ldots, (f,f)$ must be in $R$, leaving $10 - 6 = 4$ further ordered pairs.' },
      { h: 'Account for symmetry', d: 'Off-diagonal pairs arrive two at a time, so those four pairs are exactly two unordered pairs of distinct elements.' },
      { h: 'Count', d: 'There are $\\binom{6}{2} = 15$ unordered pairs to choose from, so the answer is $\\binom{15}{2} = 105$.' }
    ]
  },
  {
    ...ADV_2025_P1,
    id: 'jeeadv-2025-p1-q9',
    section: 'Section 3',
    questionNumber: 9,
    chapterId: 'c12-vector-algebra',
    difficulty: 4,
    answerType: 'numeric',
    prompt: 'For any two points $M$ and $N$ in the $XY$-plane, let $\\overrightarrow{MN}$ denote the vector from $M$ to $N$, and $\\vec{0}$ denote the zero vector. Let $P, Q$ and $R$ be three distinct points in the $XY$-plane. Let $S$ be a point inside the triangle $\\triangle PQR$ such that\n\n$\\overrightarrow{SP} + 5\\,\\overrightarrow{SQ} + 6\\,\\overrightarrow{SR} = \\vec{0}.$\n\nLet $E$ and $F$ be the mid-points of the sides $PR$ and $QR$ respectively. Then the value of\n\n$\\dfrac{\\text{length of the line segment } EF}{\\text{length of the line segment } ES}$\n\nis ____.',
    // The authority accepts 1.15 to 1.25 for this item; the exact value is 1.2.
    answer: { value: 1.2, tol: 0.05, officialRange: [1.15, 1.25] },
    inputHint: 'Enter the ratio',
    hints: ['Write $S$ as a weighted average of $P$, $Q$ and $R$ using position vectors.'],
    steps: [
      { h: 'Locate $S$', d: 'With position vectors, $\\overrightarrow{SP} + 5\\overrightarrow{SQ} + 6\\overrightarrow{SR} = \\vec{0}$ gives $S = \\dfrac{P + 5Q + 6R}{12}$.' },
      { h: 'Length $EF$', d: '$E = \\tfrac{P+R}{2}$ and $F = \\tfrac{Q+R}{2}$, so $\\overrightarrow{EF} = \\tfrac{Q - P}{2}$ — the mid-point theorem.' },
      { h: 'Length $ES$', d: '$\\overrightarrow{ES} = \\dfrac{P + 5Q + 6R}{12} - \\dfrac{P+R}{2} = \\dfrac{5(Q - P)}{12}$.' },
      { h: 'Ratio', d: '$\\dfrac{EF}{ES} = \\dfrac{1/2}{5/12} = \\dfrac{12}{10} = 1.2$.' }
    ]
  },
  {
    ...ADV_2025_P1,
    id: 'jeeadv-2025-p1-q10',
    section: 'Section 3',
    questionNumber: 10,
    chapterId: 'c11-permutations-combinations',
    difficulty: 4,
    answerType: 'numeric',
    prompt: 'Let $S$ be the set of all seven-digit numbers that can be formed using the digits $0, 1$ and $2$. For example, $2210222$ is in $S$, but $0210222$ is NOT in $S$.\n\nThen the number of elements $x$ in $S$ such that at least one of the digits $0$ and $1$ appears exactly twice in $x$, is equal to ____.',
    answer: { value: 762 },
    inputHint: 'Enter the count',
    hints: ['Count "exactly two zeros" and "exactly two ones" separately, then take off the overlap — and remember the leading digit cannot be $0$.'],
    steps: [
      { h: 'Exactly two ones', d: 'Choose the two positions for the $1$s and fill the rest with $0$ or $2$, then discard the strings starting with $0$: this gives $\\binom{7}{2}2^5 - \\binom{6}{2}2^4 = 672 - 240 = 432$.' },
      { h: 'Exactly two zeros', d: 'Both zeros must avoid the first place, so choose them from the last six positions and fill the remaining five with $1$ or $2$: $\\binom{6}{2}2^5 = 480$.' },
      { h: 'Both conditions at once', d: 'Two zeros (not leading) and two ones leave three places for $2$s: $\\binom{6}{2}\\binom{5}{2} = 15 \\times 10 = 150$.' },
      { h: 'Inclusion-exclusion', d: '$432 + 480 - 150 = 762$.' }
    ]
  },
  {
    ...ADV_2025_P1,
    id: 'jeeadv-2025-p1-q11',
    section: 'Section 3',
    questionNumber: 11,
    chapterId: 'c11-limits-derivatives',
    difficulty: 4,
    answerType: 'numeric',
    prompt: 'Let $\\alpha$ and $\\beta$ be the real numbers such that\n\n$\\displaystyle\\lim_{x\\to 0}\\dfrac{1}{x^3}\\left(\\dfrac{\\alpha}{2}\\int_0^x \\dfrac{1}{1 - t^2}\\,dt + \\beta x\\cos x\\right) = 2.$\n\nThen the value of $\\alpha + \\beta$ is ____.',
    // The authority accepts 2.35 to 2.45 for this item; the exact value is 2.4.
    answer: { value: 2.4, tol: 0.05, officialRange: [2.35, 2.45] },
    inputHint: 'Enter the value of $\\alpha + \\beta$',
    hints: ['Expand both pieces as far as $x^3$ and make the $x$ term cancel.'],
    steps: [
      { h: 'Expand the integral', d: '$\\displaystyle\\int_0^x \\dfrac{dt}{1 - t^2} = x + \\dfrac{x^3}{3} + O(x^5)$.' },
      { h: 'Expand the cosine term', d: '$\\beta x\\cos x = \\beta x - \\dfrac{\\beta x^3}{2} + O(x^5)$.' },
      { h: 'Kill the $x$ term', d: 'The bracket is $\\left(\\tfrac{\\alpha}{2} + \\beta\\right)x + \\left(\\tfrac{\\alpha}{6} - \\tfrac{\\beta}{2}\\right)x^3 + \\cdots$. For the limit to be finite, $\\tfrac{\\alpha}{2} + \\beta = 0$, so $\\beta = -\\tfrac{\\alpha}{2}$.' },
      { h: 'Match the limit', d: '$\\tfrac{\\alpha}{6} - \\tfrac{\\beta}{2} = \\tfrac{\\alpha}{6} + \\tfrac{\\alpha}{4} = \\tfrac{5\\alpha}{12} = 2$, so $\\alpha = \\tfrac{24}{5} = 4.8$ and $\\beta = -2.4$.' },
      { h: 'Answer', d: '$\\alpha + \\beta = 4.8 - 2.4 = 2.4$.' }
    ]
  },
  {
    ...ADV_2025_P1,
    id: 'jeeadv-2025-p1-q12',
    section: 'Section 3',
    questionNumber: 12,
    chapterId: 'c11-sequences-series',
    difficulty: 4,
    answerType: 'numeric',
    prompt: 'Let $\\mathbb{R}$ denote the set of all real numbers. Let $f:\\mathbb{R}\\to\\mathbb{R}$ be a function such that $f(x) > 0$ for all $x \\in \\mathbb{R}$, and $f(x + y) = f(x)f(y)$ for all $x, y \\in \\mathbb{R}$.\n\nLet the real numbers $a_1, a_2, \\ldots, a_{50}$ be in an arithmetic progression. If $f(a_{31}) = 64f(a_{25})$ and\n\n$\\displaystyle\\sum_{i=1}^{50} f(a_i) = 3\\left(2^{25} + 1\\right),$\n\nthen the value of $\\displaystyle\\sum_{i=6}^{30} f(a_i)$ is ____.',
    answer: { value: 96 },
    inputHint: 'Enter the value of the sum',
    hints: ['$f(x+y) = f(x)f(y)$ with $f > 0$ turns an arithmetic progression into a geometric one.'],
    steps: [
      { h: 'Turn the AP into a GP', d: 'If the common difference is $d$ then $f(a_{i+1}) = f(a_i)f(d)$, so $f(a_1), f(a_2), \\ldots$ is a GP with ratio $r = f(d)$.' },
      { h: 'Find the ratio', d: '$f(a_{31}) = f(a_{25})r^{6} = 64f(a_{25})$ gives $r^{6} = 64$, so $r = 2$.' },
      { h: 'Find the first term', d: '$\\sum_{i=1}^{50} f(a_i) = f(a_1)\\dfrac{2^{50} - 1}{2 - 1} = f(a_1)(2^{25}-1)(2^{25}+1) = 3(2^{25}+1)$, so $f(a_1) = \\dfrac{3}{2^{25} - 1}$.' },
      { h: 'Sum the requested block', d: '$\\sum_{i=6}^{30} f(a_i) = f(a_1)\\,2^{5}\\,(2^{25} - 1) = \\dfrac{3}{2^{25}-1}\\cdot 32\\,(2^{25}-1) = 96$.' }
    ]
  },
  {
    ...ADV_2025_P1,
    id: 'jeeadv-2025-p1-q13',
    section: 'Section 3',
    questionNumber: 13,
    chapterId: 'c12-differential-equations',
    difficulty: 4,
    answerType: 'numeric',
    prompt: 'For all $x > 0$, let $y_1(x)$, $y_2(x)$ and $y_3(x)$ be the functions satisfying\n\n$\\dfrac{dy_1}{dx} - (\\sin x)^2 y_1 = 0,\\quad y_1(1) = 5,$\n\n$\\dfrac{dy_2}{dx} - (\\cos x)^2 y_2 = 0,\\quad y_2(1) = \\dfrac{1}{3},$\n\n$\\dfrac{dy_3}{dx} - \\left(\\dfrac{2 - x^3}{x^3}\\right)y_3 = 0,\\quad y_3(1) = \\dfrac{3}{5e},$\n\nrespectively. Then\n\n$\\displaystyle\\lim_{x\\to 0^+}\\dfrac{y_1(x)y_2(x)y_3(x) + 2x}{e^{3x}\\sin x}$\n\nis equal to ____.',
    answer: { value: 2 },
    inputHint: 'Enter the value of the limit',
    hints: ['Multiply the three solutions before simplifying — $\\sin^2 + \\cos^2$ does the work.'],
    steps: [
      { h: 'Solve the first two', d: 'Separating variables, $y_1 = 5\\exp\\!\\left(\\int_1^x \\sin^2 t\\,dt\\right)$ and $y_2 = \\tfrac{1}{3}\\exp\\!\\left(\\int_1^x \\cos^2 t\\,dt\\right)$.' },
      { h: 'Multiply them', d: '$y_1y_2 = \\tfrac{5}{3}\\exp\\!\\left(\\int_1^x 1\\,dt\\right) = \\tfrac{5}{3}e^{\\,x-1}$.' },
      { h: 'Solve the third', d: '$y_3 = \\tfrac{3}{5e}\\exp\\!\\left(\\int_1^x\\left(\\tfrac{2}{t^3} - 1\\right)dt\\right) = \\tfrac{3}{5e}\\exp\\!\\left(2 - x - \\tfrac{1}{x^2}\\right)$.' },
      { h: 'Combine', d: '$y_1y_2y_3 = \\tfrac{5}{3}\\cdot\\tfrac{3}{5e}\\,e^{\\,x-1}\\exp\\!\\left(2 - x - \\tfrac{1}{x^2}\\right) = e^{-1/x^2}$.' },
      { h: 'Take the limit', d: 'As $x \\to 0^+$, $e^{-1/x^2}$ vanishes faster than any power of $x$, so the fraction behaves like $\\dfrac{2x}{e^{3x}\\sin x} \\to \\dfrac{2x}{x} = 2$.' }
    ]
  }
]);
