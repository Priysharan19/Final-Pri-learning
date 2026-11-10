// Pri Learning · CBSE board previous-year questions
//
// CBSE publishes both halves of what a PYQ needs: the sat question paper at
// cbse.gov.in/cbsenew/question-paper, and the official Marking Scheme at
// cbse.gov.in/cbsenew/marking-scheme. The marking scheme reprints each question
// above the answer the Board expects, so every record here has one document
// behind both its prompt and its key, and both documents are cited.
//
// Only Section A (the one-mark objective section) is transcribed. Sections B to
// E are short-, long- and case-study answers whose marking scheme awards method
// marks over several steps; Pri can mark a final answer but it cannot award the
// Board's step marks, and a PYQ that is marked by a different rule from the one
// printed beside it is not the question the student thinks they are sitting.
// When the archive grows to those sections it will need a marks-carrying
// contract, and pyqSchema.js refuses them until it has one.
//
// Two Section A items are left out on purpose: 2025 65/1/1 Q17 and 30/1/1 Q10
// both depend on a printed diagram, and a transcription that describes a graph
// in words is not the question that was set.

import { PYQ_PROVENANCE } from './pyqSources.js';

const CBSE_2025_XII = Object.freeze({
  examId: 'cbse-class-12',
  year: 2025,
  setCode: '65/1/1',
  section: 'Section A',
  provenance: PYQ_PROVENANCE.OFFICIAL_PAPER_AND_KEY,
  pastPaper: true,
  promptSource: ['cbse-2025-xii-65-1-1-marking-scheme', 'cbse-2025-xii-65-1-1-questions'],
  answerSource: 'cbse-2025-xii-65-1-1-marking-scheme',
  answerType: 'mcq'
});

const CBSE_2025_X = Object.freeze({
  examId: 'cbse-class-10',
  year: 2025,
  setCode: '30/1/1',
  section: 'Section A',
  provenance: PYQ_PROVENANCE.OFFICIAL_PAPER_AND_KEY,
  pastPaper: true,
  promptSource: ['cbse-2025-x-30-1-1-marking-scheme', 'cbse-2025-x-30-1-1-questions'],
  answerSource: 'cbse-2025-x-30-1-1-marking-scheme',
  answerType: 'mcq'
});

const CBSE_2025_X_SET2 = Object.freeze({
  ...CBSE_2025_X,
  setCode: '30/1/2',
  promptSource: ['cbse-2025-x-30-1-2-marking-scheme', 'cbse-2025-x-30-1-2-questions'],
  answerSource: 'cbse-2025-x-30-1-2-marking-scheme'
});

const CBSE_2025_X_SET3 = Object.freeze({
  ...CBSE_2025_X,
  setCode: '30/1/3',
  promptSource: ['cbse-2025-x-30-1-3-marking-scheme', 'cbse-2025-x-30-1-3-questions'],
  answerSource: 'cbse-2025-x-30-1-3-marking-scheme'
});

const CBSE_2025_X_2_1 = Object.freeze({
  ...CBSE_2025_X,
  setCode: '30/2/1',
  promptSource: ['cbse-2025-x-30-2-1-marking-scheme', 'cbse-2025-x-30-2-1-questions'],
  answerSource: 'cbse-2025-x-30-2-1-marking-scheme'
});

// The four Assertion–Reason codes, printed once above Q19 and Q20 of the paper.
const AR_CODES = Object.freeze([
  'Both Assertion (A) and Reason (R) are true and Reason (R) is the correct explanation of the Assertion (A).',
  'Both Assertion (A) and Reason (R) are true, but Reason (R) is not the correct explanation of the Assertion (A).',
  'Assertion (A) is true, but Reason (R) is false.',
  'Assertion (A) is false, but Reason (R) is true.'
]);

export const CBSE_PYQ_RECORDS = Object.freeze([
  // ── CBSE Class 12 Mathematics (041) · 2025 · Set 65/1/1 · Section A ─────────
  {
    ...CBSE_2025_XII,
    id: 'cbse-2025-xii-65-1-1-q1',
    questionNumber: 1,
    chapterId: 'c12-matrices',
    difficulty: 2,
    prompt: 'If $A = \\begin{bmatrix}-1&0&0\\\\0&1&0\\\\0&0&1\\end{bmatrix}$, then $A^{-1}$ is',
    mcqOptions: [
      '$\\begin{bmatrix}-1&0&0\\\\0&-1&0\\\\0&0&-1\\end{bmatrix}$',
      '$\\begin{bmatrix}1&0&0\\\\0&-1&0\\\\0&0&-1\\end{bmatrix}$',
      '$\\begin{bmatrix}-1&0&0\\\\0&-1&0\\\\0&0&1\\end{bmatrix}$',
      '$\\begin{bmatrix}-1&0&0\\\\0&1&0\\\\0&0&1\\end{bmatrix}$'
    ],
    answer: { correctIndex: 3 },
    steps: [
      { h: 'Diagonal matrices invert entry by entry', d: 'The inverse of $\\mathrm{diag}(d_1, d_2, d_3)$ is $\\mathrm{diag}(1/d_1, 1/d_2, 1/d_3)$.' },
      { h: 'Apply it', d: 'Here the entries are $-1, 1, 1$, whose reciprocals are $-1, 1, 1$ again, so $A^{-1} = A$. (Equivalently, $A^2 = I$.)' }
    ]
  },
  {
    ...CBSE_2025_XII,
    id: 'cbse-2025-xii-65-1-1-q2',
    questionNumber: 2,
    chapterId: 'c12-vector-algebra',
    difficulty: 2,
    prompt: 'If vector $\\vec{a} = 3\\hat{i} + 2\\hat{j} - \\hat{k}$ and vector $\\vec{b} = \\hat{i} - \\hat{j} + \\hat{k}$, then which of the following is correct?',
    mcqOptions: ['$\\vec{a} \\parallel \\vec{b}$', '$\\vec{a} \\perp \\vec{b}$', '$|\\vec{b}| > |\\vec{a}|$', '$|\\vec{a}| = |\\vec{b}|$'],
    answer: { correctIndex: 1 },
    steps: [
      { h: 'Dot product', d: '$\\vec{a}\\cdot\\vec{b} = (3)(1) + (2)(-1) + (-1)(1) = 3 - 2 - 1 = 0$.' },
      { h: 'Read it', d: 'A zero dot product between two non-zero vectors means they are perpendicular.' },
      { h: 'Rule out the rest', d: '$|\\vec{a}| = \\sqrt{14}$ and $|\\vec{b}| = \\sqrt{3}$, so they are neither equal nor the other way round; and perpendicular vectors are not parallel.' }
    ]
  },
  {
    ...CBSE_2025_XII,
    id: 'cbse-2025-xii-65-1-1-q3',
    questionNumber: 3,
    chapterId: 'c12-integrals',
    difficulty: 2,
    prompt: '$\\displaystyle\\int_{-1}^{1}\\dfrac{|x|}{x}\\,dx$, $x \\ne 0$, is equal to',
    mcqOptions: ['$-1$', '$0$', '$1$', '$2$'],
    answer: { correctIndex: 1 },
    steps: [
      { h: 'Split at the origin', d: '$\\dfrac{|x|}{x} = -1$ for $x < 0$ and $+1$ for $x > 0$.' },
      { h: 'Integrate each piece', d: '$\\displaystyle\\int_{-1}^{0}(-1)\\,dx = -1$ and $\\displaystyle\\int_{0}^{1}(1)\\,dx = 1$.' },
      { h: 'Add', d: '$-1 + 1 = 0$. (The integrand is odd on a symmetric interval, which is the same statement.)' }
    ]
  },
  {
    ...CBSE_2025_XII,
    id: 'cbse-2025-xii-65-1-1-q4',
    questionNumber: 4,
    chapterId: 'c12-differential-equations',
    difficulty: 2,
    prompt: 'Which of the following is **not** a homogeneous function of $x$ and $y$?',
    mcqOptions: ['$y^2 - xy$', '$x - 3y$', '$\\sin^2\\dfrac{y}{x} + \\dfrac{y}{x}$', '$\\tan x - \\sec y$'],
    answer: { correctIndex: 3 },
    steps: [
      { h: 'The test', d: '$f$ is homogeneous of degree $n$ when $f(\\lambda x, \\lambda y) = \\lambda^{n}f(x, y)$ for every $\\lambda$.' },
      { h: 'Check the first three', d: '$y^2 - xy$ is degree $2$; $x - 3y$ is degree $1$; $\\sin^2\\tfrac{y}{x} + \\tfrac{y}{x}$ depends only on $\\tfrac{y}{x}$, so it is degree $0$.' },
      { h: 'The odd one out', d: '$\\tan(\\lambda x) - \\sec(\\lambda y)$ is not $\\lambda^{n}(\\tan x - \\sec y)$ for any $n$, so $\\tan x - \\sec y$ is not homogeneous.' }
    ]
  },
  {
    ...CBSE_2025_XII,
    id: 'cbse-2025-xii-65-1-1-q5',
    questionNumber: 5,
    chapterId: 'c12-continuity-differentiability',
    difficulty: 2,
    prompt: 'If $f(x) = |x| + |x - 1|$, then which of the following is correct?',
    mcqOptions: [
      '$f(x)$ is both continuous and differentiable, at $x = 0$ and $x = 1$.',
      '$f(x)$ is differentiable but not continuous, at $x = 0$ and $x = 1$.',
      '$f(x)$ is continuous but not differentiable, at $x = 0$ and $x = 1$.',
      '$f(x)$ is neither continuous nor differentiable, at $x = 0$ and $x = 1$.'
    ],
    answer: { correctIndex: 2 },
    steps: [
      { h: 'Continuity', d: 'The modulus function is continuous everywhere, and a sum of continuous functions is continuous, so $f$ is continuous at both points.' },
      { h: 'Differentiability at $x = 0$', d: 'Just left of $0$, $f(x) = -x + (1 - x) = 1 - 2x$ with slope $-2$; just right, $f(x) = x + (1 - x) = 1$ with slope $0$. The one-sided derivatives differ.' },
      { h: 'Differentiability at $x = 1$', d: 'Just left of $1$ the slope is $0$; just right, $f(x) = x + (x - 1) = 2x - 1$ with slope $2$. Again they differ.' },
      { h: 'Conclude', d: 'Continuous at both, differentiable at neither.' }
    ]
  },
  {
    ...CBSE_2025_XII,
    id: 'cbse-2025-xii-65-1-1-q6',
    questionNumber: 6,
    chapterId: 'c12-determinants',
    difficulty: 2,
    prompt: 'If $A$ is a square matrix of order $2$ such that $\\det(A) = 4$, then $\\det(4\\,\\mathrm{adj}\\,A)$ is equal to',
    mcqOptions: ['$16$', '$64$', '$256$', '$512$'],
    answer: { correctIndex: 1 },
    steps: [
      { h: 'Determinant of the adjugate', d: 'For an $n \\times n$ matrix, $\\det(\\mathrm{adj}\\,A) = (\\det A)^{n-1}$. With $n = 2$, $\\det(\\mathrm{adj}\\,A) = 4$.' },
      { h: 'Scalar multiple', d: '$\\det(kM) = k^{n}\\det M$, so $\\det(4\\,\\mathrm{adj}\\,A) = 4^{2} \\times 4$.' },
      { h: 'Answer', d: '$16 \\times 4 = 64$.' }
    ]
  },
  {
    ...CBSE_2025_XII,
    id: 'cbse-2025-xii-65-1-1-q7',
    questionNumber: 7,
    chapterId: 'c12-probability',
    difficulty: 2,
    prompt: 'If $E$ and $F$ are two independent events such that $P(E) = \\dfrac{2}{3}$ and $P(F) = \\dfrac{3}{7}$, then $P(E \\mid \\overline{F})$ is equal to',
    mcqOptions: ['$\\dfrac{1}{6}$', '$\\dfrac{1}{2}$', '$\\dfrac{2}{3}$', '$\\dfrac{7}{9}$'],
    answer: { correctIndex: 2 },
    steps: [
      { h: 'Independence carries to complements', d: 'If $E$ and $F$ are independent, so are $E$ and $\\overline{F}$.' },
      { h: 'Apply the definition', d: '$P(E \\mid \\overline{F}) = \\dfrac{P(E \\cap \\overline{F})}{P(\\overline{F})} = \\dfrac{P(E)P(\\overline{F})}{P(\\overline{F})} = P(E)$.' },
      { h: 'Answer', d: '$P(E) = \\dfrac{2}{3}$. Knowing $F$ did not happen tells you nothing about $E$.' }
    ]
  },
  {
    ...CBSE_2025_XII,
    id: 'cbse-2025-xii-65-1-1-q8',
    questionNumber: 8,
    chapterId: 'c12-applications-derivatives',
    difficulty: 2,
    prompt: 'The absolute maximum value of the function $f(x) = x^3 - 3x + 2$ in $[0, 2]$ is',
    mcqOptions: ['$0$', '$2$', '$4$', '$5$'],
    answer: { correctIndex: 2 },
    steps: [
      { h: 'Find the critical points', d: '$f\'(x) = 3x^2 - 3 = 0$ gives $x = \\pm 1$; only $x = 1$ lies in $[0, 2]$.' },
      { h: 'Test the candidates', d: '$f(0) = 2$, $f(1) = 0$, $f(2) = 8 - 6 + 2 = 4$.' },
      { h: 'Answer', d: 'On a closed interval the absolute maximum is the largest of those values: $4$.' }
    ]
  },
  {
    ...CBSE_2025_XII,
    id: 'cbse-2025-xii-65-1-1-q9',
    questionNumber: 9,
    chapterId: 'c12-matrices',
    difficulty: 2,
    prompt: 'Let $A = \\begin{bmatrix}1&-2&-1\\\\0&4&-1\\\\-3&2&1\\end{bmatrix}$, $B = \\begin{bmatrix}-2\\\\-5\\\\-7\\end{bmatrix}$, $C = \\begin{bmatrix}9&8&7\\end{bmatrix}$. Which of the following is defined?',
    mcqOptions: ['Only $AB$', 'Only $AC$', 'Only $BA$', 'All $AB$, $AC$ and $BA$'],
    answer: { correctIndex: 0 },
    steps: [
      { h: 'Write down the orders', d: '$A$ is $3\\times3$, $B$ is $3\\times1$ and $C$ is $1\\times3$.' },
      { h: 'The rule', d: 'A product $XY$ exists only when the number of columns of $X$ equals the number of rows of $Y$.' },
      { h: 'Test each', d: '$AB$: $3\\times3$ by $3\\times1$ — defined. $AC$: $3\\times3$ by $1\\times3$ — not defined. $BA$: $3\\times1$ by $3\\times3$ — not defined.' }
    ]
  },
  {
    ...CBSE_2025_XII,
    id: 'cbse-2025-xii-65-1-1-q10',
    questionNumber: 10,
    chapterId: 'c12-integrals',
    difficulty: 3,
    prompt: 'If $\\displaystyle\\int \\dfrac{2^{\\frac{1}{x}}}{x^2}\\,dx = k\\cdot 2^{\\frac{1}{x}} + C$, then $k$ is equal to',
    mcqOptions: ['$\\dfrac{-1}{\\log 2}$', '$-\\log 2$', '$-1$', '$\\dfrac{1}{2}$'],
    answer: { correctIndex: 0 },
    steps: [
      { h: 'Differentiate the proposed answer', d: '$\\dfrac{d}{dx}\\left(2^{1/x}\\right) = 2^{1/x}\\log 2 \\cdot \\dfrac{d}{dx}\\left(\\dfrac{1}{x}\\right) = -\\dfrac{2^{1/x}\\log 2}{x^{2}}$.' },
      { h: 'Match the integrand', d: 'So $\\dfrac{d}{dx}\\left(k\\cdot 2^{1/x}\\right) = -\\dfrac{k\\log 2 \\cdot 2^{1/x}}{x^{2}}$, and this must equal $\\dfrac{2^{1/x}}{x^{2}}$.' },
      { h: 'Solve for $k$', d: '$-k\\log 2 = 1$, so $k = \\dfrac{-1}{\\log 2}$.' }
    ]
  },
  {
    ...CBSE_2025_XII,
    id: 'cbse-2025-xii-65-1-1-q11',
    questionNumber: 11,
    chapterId: 'c12-vector-algebra',
    difficulty: 2,
    prompt: 'If $\\vec{a} + \\vec{b} + \\vec{c} = \\vec{0}$, $|\\vec{a}| = \\sqrt{37}$, $|\\vec{b}| = 3$ and $|\\vec{c}| = 4$, then the angle between $\\vec{b}$ and $\\vec{c}$ is',
    mcqOptions: ['$\\dfrac{\\pi}{6}$', '$\\dfrac{\\pi}{4}$', '$\\dfrac{\\pi}{3}$', '$\\dfrac{\\pi}{2}$'],
    answer: { correctIndex: 2 },
    steps: [
      { h: 'Isolate $\\vec{a}$', d: '$\\vec{a} = -(\\vec{b} + \\vec{c})$, so $|\\vec{a}|^2 = |\\vec{b} + \\vec{c}|^2$.' },
      { h: 'Expand', d: '$37 = |\\vec{b}|^2 + |\\vec{c}|^2 + 2|\\vec{b}||\\vec{c}|\\cos\\theta = 9 + 16 + 24\\cos\\theta$.' },
      { h: 'Solve', d: '$24\\cos\\theta = 12$, so $\\cos\\theta = \\tfrac{1}{2}$ and $\\theta = \\dfrac{\\pi}{3}$.' }
    ]
  },
  {
    ...CBSE_2025_XII,
    id: 'cbse-2025-xii-65-1-1-q12',
    questionNumber: 12,
    chapterId: 'c12-differential-equations',
    difficulty: 3,
    prompt: 'The integrating factor of the differential equation $(x + 2y^3)\\dfrac{dy}{dx} = 2y$ is',
    mcqOptions: ['$e^{\\frac{y^2}{2}}$', '$\\dfrac{1}{\\sqrt{y}}$', '$\\dfrac{1}{y^2}$', '$e^{-\\frac{1}{y^2}}$'],
    answer: { correctIndex: 1 },
    steps: [
      { h: 'Treat $x$ as the dependent variable', d: 'Inverting, $\\dfrac{dx}{dy} = \\dfrac{x + 2y^3}{2y} = \\dfrac{x}{2y} + y^2$.' },
      { h: 'Put it in linear form', d: '$\\dfrac{dx}{dy} - \\dfrac{1}{2y}x = y^2$, which is linear in $x$ with $P(y) = -\\dfrac{1}{2y}$.' },
      { h: 'Integrating factor', d: '$\\mathrm{IF} = e^{\\int P\\,dy} = e^{-\\frac{1}{2}\\log y} = y^{-1/2} = \\dfrac{1}{\\sqrt{y}}$.' }
    ]
  },
  {
    ...CBSE_2025_XII,
    id: 'cbse-2025-xii-65-1-1-q13',
    questionNumber: 13,
    chapterId: 'c12-matrices',
    difficulty: 2,
    prompt: 'If $A = \\begin{bmatrix}7&0&x\\\\0&7&0\\\\0&0&y\\end{bmatrix}$ is a scalar matrix, then $y^{x}$ is equal to',
    mcqOptions: ['$0$', '$1$', '$7$', '$\\pm 7$'],
    answer: { correctIndex: 1 },
    steps: [
      { h: 'What a scalar matrix is', d: 'A scalar matrix is diagonal with all diagonal entries equal, so every off-diagonal entry is $0$ and every diagonal entry is the same.' },
      { h: 'Read off $x$ and $y$', d: 'The off-diagonal entry forces $x = 0$; the equal-diagonal condition forces $y = 7$.' },
      { h: 'Evaluate', d: '$y^{x} = 7^{0} = 1$.' }
    ]
  },
  {
    ...CBSE_2025_XII,
    id: 'cbse-2025-xii-65-1-1-q14',
    questionNumber: 14,
    chapterId: 'c12-linear-programming',
    difficulty: 2,
    prompt: 'The corner points of the feasible region in the graphical representation of a L.P.P. are $(2, 72)$, $(15, 20)$ and $(40, 15)$. If $Z = 18x + 9y$ is the objective function, then',
    mcqOptions: [
      '$Z$ is maximum at $(2, 72)$, minimum at $(15, 20)$',
      '$Z$ is maximum at $(15, 20)$, minimum at $(40, 15)$',
      '$Z$ is maximum at $(40, 15)$, minimum at $(15, 20)$',
      '$Z$ is maximum at $(40, 15)$, minimum at $(2, 72)$'
    ],
    answer: { correctIndex: 2 },
    steps: [
      { h: 'The corner point method', d: 'On a bounded feasible region the optimum of a linear objective is reached at a corner point, so evaluate $Z$ at each.' },
      { h: 'Evaluate', d: '$Z(2, 72) = 36 + 648 = 684$; $Z(15, 20) = 270 + 180 = 450$; $Z(40, 15) = 720 + 135 = 855$.' },
      { h: 'Compare', d: 'The largest is $855$ at $(40, 15)$ and the smallest is $450$ at $(15, 20)$.' }
    ]
  },
  {
    ...CBSE_2025_XII,
    id: 'cbse-2025-xii-65-1-1-q15',
    questionNumber: 15,
    chapterId: 'c12-determinants',
    difficulty: 2,
    prompt: 'If $A$ and $B$ are invertible matrices, then which of the following is **not** correct?',
    mcqOptions: [
      '$(A + B)^{-1} = B^{-1} + A^{-1}$',
      '$(AB)^{-1} = B^{-1}A^{-1}$',
      '$\\mathrm{adj}(A) = |A|\\,A^{-1}$',
      '$|A|^{-1} = |A^{-1}|$'
    ],
    answer: { correctIndex: 0 },
    steps: [
      { h: 'The three that are true', d: 'The reversal law $(AB)^{-1} = B^{-1}A^{-1}$, the adjugate identity $A^{-1} = \\tfrac{1}{|A|}\\mathrm{adj}(A)$ rearranged, and $|A^{-1}| = \\tfrac{1}{|A|}$ are all standard results.' },
      { h: 'The one that is not', d: 'There is no rule turning the inverse of a sum into a sum of inverses; $A + B$ need not even be invertible.' },
      { h: 'A counterexample', d: 'Take $A = B = I$. Then $(A+B)^{-1} = \\tfrac{1}{2}I$, but $B^{-1} + A^{-1} = 2I$.' }
    ]
  },
  {
    ...CBSE_2025_XII,
    id: 'cbse-2025-xii-65-1-1-q16',
    questionNumber: 16,
    chapterId: 'c12-linear-programming',
    difficulty: 2,
    prompt: 'If the feasible region of a linear programming problem with objective function $Z = ax + by$ is bounded, then which of the following is correct?',
    mcqOptions: [
      'It will only have a maximum value.',
      'It will only have a minimum value.',
      'It will have both maximum and minimum values.',
      'It will have neither maximum nor minimum value.'
    ],
    answer: { correctIndex: 2 },
    steps: [
      { h: 'What "bounded" gives you', d: 'A bounded feasible region is closed and bounded, and a linear function on such a region attains both its greatest and its least value.' },
      { h: 'Where they sit', d: 'Both are attained at corner points, which is why the corner point method works.' },
      { h: 'Contrast', d: 'It is an unbounded region that can be missing one of the two — that is when the corner-point candidate has to be checked against the open half-plane.' }
    ]
  },

  // ── CBSE Class 10 Mathematics Standard (041) · 2025 · Set 30/1/1 · Section A ─
  {
    ...CBSE_2025_X,
    id: 'cbse-2025-x-30-1-1-q1',
    questionNumber: 1,
    chapterId: 'c10-polynomials',
    difficulty: 2,
    prompt: 'If $\\alpha$ and $\\beta$ are the zeroes of the polynomial $3x^2 + 6x + k$ such that $\\alpha + \\beta + \\alpha\\beta = -\\dfrac{2}{3}$, then the value of $k$ is',
    mcqOptions: ['$-8$', '$8$', '$-4$', '$4$'],
    answer: { correctIndex: 3 },
    steps: [
      { h: 'Sum and product of zeroes', d: 'For $ax^2 + bx + c$, $\\alpha + \\beta = -\\dfrac{b}{a} = -\\dfrac{6}{3} = -2$ and $\\alpha\\beta = \\dfrac{c}{a} = \\dfrac{k}{3}$.' },
      { h: 'Substitute', d: '$-2 + \\dfrac{k}{3} = -\\dfrac{2}{3}$.' },
      { h: 'Solve', d: '$\\dfrac{k}{3} = -\\dfrac{2}{3} + 2 = \\dfrac{4}{3}$, so $k = 4$.' }
    ]
  },
  {
    ...CBSE_2025_X,
    id: 'cbse-2025-x-30-1-1-q2',
    questionNumber: 2,
    chapterId: 'c10-pair-linear-equations',
    difficulty: 2,
    prompt: 'If $x = 1$ and $y = 2$ is a solution of the pair of linear equations $2x - 3y + a = 0$ and $2x + 3y - b = 0$, then',
    mcqOptions: ['$a = 2b$', '$2a = b$', '$a + 2b = 0$', '$2a + b = 0$'],
    answer: { correctIndex: 1 },
    steps: [
      { h: 'Substitute into the first equation', d: '$2(1) - 3(2) + a = 0$ gives $2 - 6 + a = 0$, so $a = 4$.' },
      { h: 'Substitute into the second', d: '$2(1) + 3(2) - b = 0$ gives $8 = b$.' },
      { h: 'Compare', d: '$2a = 8 = b$, so $2a = b$.' }
    ]
  },
  {
    ...CBSE_2025_X,
    id: 'cbse-2025-x-30-1-1-q3',
    questionNumber: 3,
    chapterId: 'c10-coordinate-geometry',
    difficulty: 2,
    prompt: 'The mid-point of the line segment joining the points $P(-4, 5)$ and $Q(4, 6)$ lies on',
    mcqOptions: ['$x$-axis', '$y$-axis', 'origin', 'neither $x$-axis nor $y$-axis'],
    answer: { correctIndex: 1 },
    steps: [
      { h: 'Mid-point formula', d: '$\\left(\\dfrac{-4 + 4}{2}, \\dfrac{5 + 6}{2}\\right) = \\left(0, \\dfrac{11}{2}\\right)$.' },
      { h: 'Read the coordinates', d: 'The $x$-coordinate is $0$ and the $y$-coordinate is not, so the point lies on the $y$-axis (and is not the origin).' }
    ]
  },
  {
    ...CBSE_2025_X,
    id: 'cbse-2025-x-30-1-1-q4',
    questionNumber: 4,
    chapterId: 'c10-trigonometry',
    difficulty: 1,
    prompt: 'If $\\theta$ is an acute angle and $7 + 4\\sin\\theta = 9$, then the value of $\\theta$ is',
    mcqOptions: ['$90^{\\circ}$', '$30^{\\circ}$', '$45^{\\circ}$', '$60^{\\circ}$'],
    answer: { correctIndex: 1 },
    steps: [
      { h: 'Isolate $\\sin\\theta$', d: '$4\\sin\\theta = 2$, so $\\sin\\theta = \\dfrac{1}{2}$.' },
      { h: 'Read the acute angle', d: 'The acute angle with sine $\\tfrac{1}{2}$ is $30^{\\circ}$.' }
    ]
  },
  {
    ...CBSE_2025_X,
    id: 'cbse-2025-x-30-1-1-q5',
    questionNumber: 5,
    chapterId: 'c10-trigonometry',
    difficulty: 2,
    prompt: 'The value of $\\tan^2\\theta - \\left(\\dfrac{1}{\\cos\\theta} \\times \\sec\\theta\\right)$ is',
    mcqOptions: ['$1$', '$0$', '$-1$', '$2$'],
    answer: { correctIndex: 2 },
    steps: [
      { h: 'Simplify the bracket', d: '$\\dfrac{1}{\\cos\\theta} = \\sec\\theta$, so the bracket is $\\sec\\theta \\times \\sec\\theta = \\sec^2\\theta$.' },
      { h: 'Use the identity', d: '$\\tan^2\\theta - \\sec^2\\theta = -1$, since $1 + \\tan^2\\theta = \\sec^2\\theta$.' }
    ]
  },
  {
    ...CBSE_2025_X,
    id: 'cbse-2025-x-30-1-1-q6',
    questionNumber: 6,
    chapterId: 'c10-real-numbers',
    difficulty: 2,
    prompt: 'If $\\mathrm{HCF}(98, 28) = m$ and $\\mathrm{LCM}(98, 28) = n$, then the value of $n - 7m$ is',
    mcqOptions: ['$0$', '$28$', '$98$', '$198$'],
    answer: { correctIndex: 2 },
    steps: [
      { h: 'Factorise', d: '$98 = 2 \\times 7^2$ and $28 = 2^2 \\times 7$.' },
      { h: 'HCF and LCM', d: '$m = \\mathrm{HCF} = 2 \\times 7 = 14$ and $n = \\mathrm{LCM} = 2^2 \\times 7^2 = 196$. (Check: $14 \\times 196 = 98 \\times 28$.)' },
      { h: 'Evaluate', d: '$n - 7m = 196 - 98 = 98$.' }
    ]
  },
  {
    ...CBSE_2025_X,
    id: 'cbse-2025-x-30-1-1-q7',
    questionNumber: 7,
    chapterId: 'c10-circles',
    difficulty: 1,
    prompt: 'The tangents drawn at the extremities of the diameter of a circle are always',
    mcqOptions: ['parallel', 'perpendicular', 'equal', 'intersecting'],
    answer: { correctIndex: 0 },
    steps: [
      { h: 'Tangent and radius', d: 'A tangent is perpendicular to the radius at its point of contact.' },
      { h: 'Both ends of a diameter', d: 'The two radii to the ends of a diameter lie on one straight line, so both tangents are perpendicular to the same line.' },
      { h: 'Conclude', d: 'Two lines perpendicular to the same line are parallel.' }
    ]
  },
  {
    ...CBSE_2025_X,
    id: 'cbse-2025-x-30-1-1-q8',
    questionNumber: 8,
    chapterId: 'c10-triangles',
    difficulty: 2,
    prompt: 'In triangles $ABC$ and $DEF$, $\\angle B = \\angle E$, $\\angle F = \\angle C$ and $AB = 3\\,DE$. Then, the two triangles are',
    mcqOptions: [
      'congruent but not similar',
      'congruent as well as similar',
      'neither congruent nor similar',
      'similar but not congruent'
    ],
    answer: { correctIndex: 3 },
    steps: [
      { h: 'Similarity', d: 'Two pairs of equal angles give $\\triangle ABC \\sim \\triangle DEF$ by the AA criterion.' },
      { h: 'Congruence', d: 'Congruent triangles have equal corresponding sides, but $AB = 3\\,DE$, so the scale factor is $3$, not $1$.' },
      { h: 'Conclude', d: 'They are similar but not congruent.' }
    ]
  },
  {
    ...CBSE_2025_X,
    id: 'cbse-2025-x-30-1-1-q9',
    questionNumber: 9,
    chapterId: 'c10-real-numbers',
    difficulty: 1,
    prompt: 'If $(-1)^{n} + (-1)^{8} = 0$, then $n$ is',
    mcqOptions: ['any positive integer', 'any negative integer', 'any odd number', 'any even number'],
    answer: { correctIndex: 2 },
    steps: [
      { h: 'Evaluate the known term', d: '$(-1)^{8} = 1$, because $8$ is even.' },
      { h: 'Solve for the other', d: 'The sum is $0$, so $(-1)^{n} = -1$.' },
      { h: 'Read off $n$', d: '$(-1)^{n} = -1$ exactly when $n$ is odd.' }
    ]
  },
  {
    ...CBSE_2025_X,
    id: 'cbse-2025-x-30-1-1-q11',
    questionNumber: 11,
    chapterId: 'c10-arithmetic-progressions',
    difficulty: 2,
    prompt: 'If the sum of the first $m$ terms of an AP is $2m^2 + 3m$, then its second term is',
    mcqOptions: ['$10$', '$9$', '$12$', '$4$'],
    answer: { correctIndex: 1 },
    steps: [
      { h: 'A term from the sums', d: '$a_2 = S_2 - S_1$.' },
      { h: 'Evaluate the sums', d: '$S_1 = 2(1)^2 + 3(1) = 5$ and $S_2 = 2(2)^2 + 3(2) = 14$.' },
      { h: 'Subtract', d: '$a_2 = 14 - 5 = 9$.' }
    ]
  },
  {
    ...CBSE_2025_X,
    id: 'cbse-2025-x-30-1-1-q12',
    questionNumber: 12,
    chapterId: 'c10-statistics',
    difficulty: 2,
    prompt: 'Mode and Mean of a data are $15x$ and $18x$, respectively. Then the median of the data is',
    mcqOptions: ['$x$', '$11x$', '$17x$', '$34x$'],
    answer: { correctIndex: 2 },
    steps: [
      { h: 'The empirical relationship', d: '$\\text{Mode} = 3\\,\\text{Median} - 2\\,\\text{Mean}$.' },
      { h: 'Substitute', d: '$15x = 3M - 2(18x) = 3M - 36x$.' },
      { h: 'Solve', d: '$3M = 51x$, so $M = 17x$.' }
    ]
  },
  {
    ...CBSE_2025_X,
    id: 'cbse-2025-x-30-1-1-q13',
    questionNumber: 13,
    chapterId: 'c10-probability',
    difficulty: 2,
    prompt: 'A card is selected at random from a deck of $52$ playing cards. The probability of it being a red face card is',
    mcqOptions: ['$\\dfrac{3}{13}$', '$\\dfrac{2}{13}$', '$\\dfrac{1}{2}$', '$\\dfrac{3}{26}$'],
    answer: { correctIndex: 3 },
    steps: [
      { h: 'Count the favourable cards', d: 'The face cards are jack, queen and king; the red suits are hearts and diamonds, so there are $3 \\times 2 = 6$ red face cards.' },
      { h: 'Divide', d: '$P = \\dfrac{6}{52} = \\dfrac{3}{26}$.' }
    ]
  },
  // ── CBSE Class 10 Mathematics Standard (041) · 2025 · Set 30/1/2 · Section A ─
  // Set 30/1/2 reprints eight of 30/1/1's Section A questions in a new order
  // (its Q5, Q8, Q9, Q10, Q12, Q16, Q17, Q18); those are not repeated here. Q1
  // and Q6 depend on a printed figure and are left out for the reason above.
  {
    ...CBSE_2025_X_SET2,
    id: 'cbse-2025-x-30-1-2-q2',
    questionNumber: 2,
    chapterId: 'c10-areas-circles',
    difficulty: 2,
    prompt: 'A piece of wire $20$ cm long is bent into the form of an arc of a circle of radius $\\dfrac{60}{\\pi}$ cm. The angle subtended by the arc at the centre of the circle is',
    mcqOptions: ['$30^{\\circ}$', '$60^{\\circ}$', '$90^{\\circ}$', '$50^{\\circ}$'],
    answer: { correctIndex: 1 },
    steps: [
      { h: 'Arc length', d: 'An arc subtending $\\theta^{\\circ}$ has length $\\dfrac{\\theta}{360} \\times 2\\pi r$.' },
      { h: 'Substitute', d: '$20 = \\dfrac{\\theta}{360} \\times 2\\pi \\times \\dfrac{60}{\\pi} = \\dfrac{\\theta}{360} \\times 120$.' },
      { h: 'Solve', d: '$\\theta = \\dfrac{20 \\times 360}{120} = 60^{\\circ}$.' }
    ]
  },
  {
    ...CBSE_2025_X_SET2,
    id: 'cbse-2025-x-30-1-2-q3',
    questionNumber: 3,
    chapterId: 'c10-arithmetic-progressions',
    difficulty: 1,
    prompt: 'Three numbers in AP have the sum $30$. What is its middle term?',
    mcqOptions: ['$4$', '$10$', '$16$', '$8$'],
    answer: { correctIndex: 1 },
    steps: [
      { h: 'Name the terms', d: 'Write three terms in AP as $a - d$, $a$, $a + d$.' },
      { h: 'Add', d: 'The $d$ terms cancel: $(a - d) + a + (a + d) = 3a = 30$.' },
      { h: 'Middle term', d: '$a = 10$.' }
    ]
  },
  {
    ...CBSE_2025_X_SET2,
    id: 'cbse-2025-x-30-1-2-q4',
    questionNumber: 4,
    chapterId: 'c10-areas-circles',
    difficulty: 2,
    prompt: 'An arc of a circle is of length $5\\pi$ cm and the sector it bounds has an area of $20\\pi$ cm$^2$. Its radius is',
    mcqOptions: ['$10$ cm', '$1$ cm', '$5$ cm', '$8$ cm'],
    answer: { correctIndex: 3 },
    steps: [
      { h: 'Sector area from arc length', d: 'A sector with arc length $l$ and radius $r$ has area $\\dfrac{1}{2}lr$.' },
      { h: 'Substitute', d: '$20\\pi = \\dfrac{1}{2} \\times 5\\pi \\times r$.' },
      { h: 'Solve', d: '$r = \\dfrac{40\\pi}{5\\pi} = 8$ cm.' }
    ]
  },
  {
    ...CBSE_2025_X_SET2,
    id: 'cbse-2025-x-30-1-2-q7',
    questionNumber: 7,
    chapterId: 'c10-trigonometry',
    difficulty: 2,
    prompt: 'If $\\alpha + \\beta = 90^{\\circ}$ and $\\alpha = 2\\beta$, then $\\cos^2\\alpha + \\sin^2\\beta$ is equal to',
    mcqOptions: ['$0$', '$\\dfrac{1}{2}$', '$1$', '$2$'],
    answer: { correctIndex: 1 },
    steps: [
      { h: 'Find the angles', d: '$2\\beta + \\beta = 90^{\\circ}$, so $\\beta = 30^{\\circ}$ and $\\alpha = 60^{\\circ}$.' },
      { h: 'Standard values', d: '$\\cos 60^{\\circ} = \\dfrac{1}{2}$ and $\\sin 30^{\\circ} = \\dfrac{1}{2}$.' },
      { h: 'Evaluate', d: '$\\cos^2\\alpha + \\sin^2\\beta = \\dfrac{1}{4} + \\dfrac{1}{4} = \\dfrac{1}{2}$.' }
    ]
  },
  {
    ...CBSE_2025_X_SET2,
    id: 'cbse-2025-x-30-1-2-q11',
    questionNumber: 11,
    chapterId: 'c10-real-numbers',
    difficulty: 2,
    prompt: 'Which of the following is a rational number between $\\sqrt{3}$ and $\\sqrt{5}$?',
    mcqOptions: ['$1.4142387954012\\ldots$', '$2.32\\overline{6}$', '$\\pi$', '$1.857142$'],
    answer: { correctIndex: 3 },
    steps: [
      { h: 'Locate the bounds', d: '$\\sqrt{3} \\approx 1.732$ and $\\sqrt{5} \\approx 2.236$.' },
      { h: 'Rule out the irrationals', d: 'A non-terminating, non-repeating decimal and $\\pi$ are irrational.' },
      { h: 'Check the rationals', d: '$2.32\\overline{6}$ is rational but greater than $2.236$. $1.857142$ terminates, so it is rational, and $1.732 < 1.857142 < 2.236$.' }
    ]
  },
  {
    ...CBSE_2025_X_SET2,
    id: 'cbse-2025-x-30-1-2-q13',
    questionNumber: 13,
    chapterId: 'c10-circles',
    difficulty: 1,
    prompt: 'If the length of a chord of a circle is equal to its radius, then the angle subtended by the chord at the centre is',
    mcqOptions: ['$60^{\\circ}$', '$30^{\\circ}$', '$120^{\\circ}$', '$90^{\\circ}$'],
    answer: { correctIndex: 0 },
    steps: [
      { h: 'The triangle at the centre', d: 'The chord and the two radii to its ends form a triangle with all three sides equal to $r$.' },
      { h: 'Equilateral', d: 'An equilateral triangle has every angle $60^{\\circ}$, so the chord subtends $60^{\\circ}$ at the centre.' }
    ]
  },
  {
    ...CBSE_2025_X_SET2,
    id: 'cbse-2025-x-30-1-2-q14',
    questionNumber: 14,
    chapterId: 'c10-real-numbers',
    difficulty: 2,
    prompt: 'The greatest number which divides $70$ and $125$, leaving remainders $5$ and $8$ respectively, is',
    mcqOptions: ['$13$', '$65$', '$875$', '$1750$'],
    answer: { correctIndex: 0 },
    steps: [
      { h: 'Remove the remainders', d: 'The number divides $70 - 5 = 65$ and $125 - 8 = 117$ exactly.' },
      { h: 'Greatest common divisor', d: '$65 = 5 \\times 13$ and $117 = 3^2 \\times 13$, so $\\mathrm{HCF}(65, 117) = 13$.' },
      { h: 'Check', d: '$70 = 5 \\times 13 + 5$ and $125 = 9 \\times 13 + 8$.' }
    ]
  },
  {
    ...CBSE_2025_X_SET2,
    id: 'cbse-2025-x-30-1-2-q15',
    questionNumber: 15,
    chapterId: 'c10-trig-applications',
    difficulty: 1,
    prompt: 'A ladder $14$ m long leans against a wall. If the foot of the ladder is $7$ m from the wall, then the angle of elevation of the top of the wall is',
    mcqOptions: ['$15^{\\circ}$', '$30^{\\circ}$', '$45^{\\circ}$', '$60^{\\circ}$'],
    answer: { correctIndex: 3 },
    steps: [
      { h: 'The right triangle', d: 'The ladder is the hypotenuse ($14$ m) and the distance from the wall is the side adjacent to the angle at the foot ($7$ m).' },
      { h: 'Cosine', d: '$\\cos\\theta = \\dfrac{7}{14} = \\dfrac{1}{2}$.' },
      { h: 'Read the angle', d: '$\\theta = 60^{\\circ}$.' }
    ]
  },
  {
    ...CBSE_2025_X_SET2,
    id: 'cbse-2025-x-30-1-2-q19',
    questionNumber: 19,
    chapterId: 'c10-surface-volume',
    difficulty: 1,
    prompt: 'Assertion (A): If we join two hemispheres of same radius along their bases, then we get a sphere.\n\nReason (R): Total Surface Area of a sphere of radius $r$ is $3\\pi r^2$.',
    mcqOptions: [...AR_CODES],
    answer: { correctIndex: 2 },
    steps: [
      { h: 'Assertion', d: 'Two hemispheres of the same radius joined along their flat circular bases make a complete sphere, so (A) is true.' },
      { h: 'Reason', d: 'The surface area of a sphere is $4\\pi r^2$; $3\\pi r^2$ is the total surface area of a solid hemisphere ($2\\pi r^2$ curved $+ \\pi r^2$ base). So (R) is false.' }
    ]
  },
  {
    ...CBSE_2025_X_SET2,
    id: 'cbse-2025-x-30-1-2-q20',
    questionNumber: 20,
    chapterId: 'c10-probability',
    difficulty: 1,
    prompt: 'Assertion (A): The probability of selecting a number at random from the numbers $1$ to $20$ is $1$.\n\nReason (R): For any event $E$, if $P(E) = 1$, then $E$ is called a sure event.',
    mcqOptions: [...AR_CODES],
    answer: { correctIndex: 0 },
    steps: [
      { h: 'Assertion', d: 'Every outcome of the draw is one of the numbers $1$ to $20$, so selecting one of them is certain: the probability is $\\dfrac{20}{20} = 1$. (A) is true.' },
      { h: 'Reason', d: 'An event with probability $1$ is by definition a sure event, so (R) is true.' },
      { h: 'Does (R) explain (A)?', d: 'Yes: the event in (A) is a sure event, which is exactly why its probability is $1$.' }
    ]
  },
  // ── CBSE Class 10 Mathematics Standard (041) · 2025 · Set 30/1/3 · Section A ─
  // Twelve of 30/1/3's Section A items reprint 30/1/1 or 30/1/2 questions and are
  // not repeated; its Q6 and Q7 depend on a printed figure.
  {
    ...CBSE_2025_X_SET3,
    id: 'cbse-2025-x-30-1-3-q1',
    questionNumber: 1,
    chapterId: 'c10-statistics',
    difficulty: 2,
    prompt: 'What is the mode of a data if median and mean of the same data are $9.6$ and $10.5$, respectively?',
    mcqOptions: ['$7.8$', '$12.3$', '$8.4$', '$7$'],
    answer: { correctIndex: 0 },
    steps: [
      { h: 'The empirical relationship', d: '$\\text{Mode} = 3\\,\\text{Median} - 2\\,\\text{Mean}$.' },
      { h: 'Substitute', d: '$3(9.6) - 2(10.5) = 28.8 - 21 = 7.8$.' }
    ]
  },
  {
    ...CBSE_2025_X_SET3,
    id: 'cbse-2025-x-30-1-3-q2',
    questionNumber: 2,
    chapterId: 'c10-trigonometry',
    difficulty: 2,
    prompt: 'The value of $(\\tan A\\,\\mathrm{cosec}\\,A)^2 - (\\sin A\\,\\sec A)^2$ is',
    mcqOptions: ['$0$', '$1$', '$-1$', '$2$'],
    answer: { correctIndex: 1 },
    steps: [
      { h: 'First bracket', d: '$\\tan A\\,\\mathrm{cosec}\\,A = \\dfrac{\\sin A}{\\cos A} \\cdot \\dfrac{1}{\\sin A} = \\sec A$.' },
      { h: 'Second bracket', d: '$\\sin A\\,\\sec A = \\dfrac{\\sin A}{\\cos A} = \\tan A$.' },
      { h: 'Identity', d: '$\\sec^2 A - \\tan^2 A = 1$.' }
    ]
  },
  {
    ...CBSE_2025_X_SET3,
    id: 'cbse-2025-x-30-1-3-q3',
    questionNumber: 3,
    chapterId: 'c10-trig-applications',
    difficulty: 1,
    prompt: 'A kite is flying at a height of $150$ m from the ground. It is attached to a string inclined at an angle of $30^{\\circ}$ to the horizontal. The length of the string is',
    mcqOptions: ['$100\\sqrt{3}$ m', '$300$ m', '$150\\sqrt{2}$ m', '$150\\sqrt{3}$ m'],
    answer: { correctIndex: 1 },
    steps: [
      { h: 'The right triangle', d: 'The height $150$ m is opposite the $30^{\\circ}$ angle and the string $L$ is the hypotenuse.' },
      { h: 'Sine', d: '$\\sin 30^{\\circ} = \\dfrac{150}{L} = \\dfrac{1}{2}$, so $L = 300$ m.' }
    ]
  },
  {
    ...CBSE_2025_X_SET3,
    id: 'cbse-2025-x-30-1-3-q11',
    questionNumber: 11,
    chapterId: 'c10-polynomials',
    difficulty: 1,
    prompt: 'The sum of the zeroes of the polynomial $p(x) = 5x - 7x^2 + 3$ is',
    mcqOptions: ['$\\dfrac{-7}{5}$', '$\\dfrac{7}{5}$', '$\\dfrac{5}{7}$', '$\\dfrac{-5}{7}$'],
    answer: { correctIndex: 2 },
    steps: [
      { h: 'Standard form', d: '$p(x) = -7x^2 + 5x + 3$, so $a = -7$, $b = 5$.' },
      { h: 'Sum of zeroes', d: '$-\\dfrac{b}{a} = -\\dfrac{5}{-7} = \\dfrac{5}{7}$.' }
    ]
  },
  {
    ...CBSE_2025_X_SET3,
    id: 'cbse-2025-x-30-1-3-q13',
    questionNumber: 13,
    chapterId: 'c10-areas-circles',
    difficulty: 2,
    prompt: 'If a sector of a circle has an area of $40\\pi$ sq. units and a central angle of $72^{\\circ}$, the radius of the circle is',
    mcqOptions: ['$200$ units', '$100$ units', '$20$ units', '$10\\sqrt{2}$ units'],
    answer: { correctIndex: 3 },
    steps: [
      { h: 'Sector area', d: '$\\dfrac{72}{360}\\pi r^2 = \\dfrac{1}{5}\\pi r^2 = 40\\pi$.' },
      { h: 'Solve', d: '$r^2 = 200$, so $r = \\sqrt{200} = 10\\sqrt{2}$ units.' }
    ]
  },
  {
    ...CBSE_2025_X_SET3,
    id: 'cbse-2025-x-30-1-3-q16',
    questionNumber: 16,
    chapterId: 'c10-coordinate-geometry',
    difficulty: 2,
    prompt: 'The end points of a diameter of circle are $(2, 4)$ and $(-3, -1)$. The length of its radius is',
    mcqOptions: ['$\\dfrac{5\\sqrt{2}}{2}$ units', '$5\\sqrt{2}$ units', '$3\\sqrt{2}$ units', '$\\pm\\dfrac{5\\sqrt{2}}{2}$ units'],
    answer: { correctIndex: 0 },
    steps: [
      { h: 'Diameter', d: '$\\sqrt{(2 - (-3))^2 + (4 - (-1))^2} = \\sqrt{25 + 25} = 5\\sqrt{2}$.' },
      { h: 'Radius', d: 'Half the diameter: $\\dfrac{5\\sqrt{2}}{2}$ units. A length is never negative, so the $\\pm$ option is wrong.' }
    ]
  },
  {
    ...CBSE_2025_X_SET3,
    id: 'cbse-2025-x-30-1-3-q17',
    questionNumber: 17,
    chapterId: 'c10-arithmetic-progressions',
    difficulty: 1,
    prompt: 'The $11^{\\text{th}}$ and $13^{\\text{th}}$ term of an AP are $39$ and $45$, respectively. What is the common difference of the AP?',
    mcqOptions: ['$42$', '$21$', '$6$', '$3$'],
    answer: { correctIndex: 3 },
    steps: [
      { h: 'Two steps apart', d: '$a_{13} - a_{11} = 2d$.' },
      { h: 'Solve', d: '$2d = 45 - 39 = 6$, so $d = 3$.' }
    ]
  },
  {
    ...CBSE_2025_X_SET3,
    id: 'cbse-2025-x-30-1-3-q18',
    questionNumber: 18,
    chapterId: 'c10-probability',
    difficulty: 2,
    prompt: 'A card is drawn at random from a pack of $52$ cards. What is the probability that the card drawn is a spade or a king?',
    mcqOptions: ['$\\dfrac{1}{13}$', '$\\dfrac{2}{13}$', '$\\dfrac{4}{13}$', '$\\dfrac{9}{13}$'],
    answer: { correctIndex: 2 },
    steps: [
      { h: 'Count without double counting', d: '$13$ spades and $4$ kings, but the king of spades is in both: $13 + 4 - 1 = 16$ cards.' },
      { h: 'Divide', d: '$P = \\dfrac{16}{52} = \\dfrac{4}{13}$.' }
    ]
  },
  // ── CBSE Class 10 Mathematics Standard (041) · 2025 · Set 30/2/1 · Section A ─
  // Q7 and Q8 depend on a printed figure. Q4 is left out because the Board's own
  // marking scheme says none of its printed options is correct ("full marks may
  // be awarded to every attempt"), so it has no official key to carry.
  {
    ...CBSE_2025_X_2_1,
    id: 'cbse-2025-x-30-2-1-q1',
    questionNumber: 1,
    chapterId: 'c10-trigonometry',
    difficulty: 2,
    prompt: 'If $7\\cos^2\\theta + 3\\sin^2\\theta = 4$, then the value of $\\theta$ is',
    mcqOptions: ['$30^{\\circ}$', '$45^{\\circ}$', '$60^{\\circ}$', '$90^{\\circ}$'],
    answer: { correctIndex: 2 },
    steps: [
      { h: 'Use $\\sin^2	heta = 1 - \\cos^2	heta$', d: '$7\\cos^2\\theta + 3 - 3\\cos^2\\theta = 4$, so $4\\cos^2\\theta = 1$.' },
      { h: 'Solve', d: '$\\cos\\theta = \\dfrac{1}{2}$ (the options are acute angles), so $\\theta = 60^{\\circ}$.' }
    ]
  },
  {
    ...CBSE_2025_X_2_1,
    id: 'cbse-2025-x-30-2-1-q2',
    questionNumber: 2,
    chapterId: 'c10-probability',
    difficulty: 1,
    prompt: 'The probability of drawing an even prime number out of numbers from $1$ to $30$ is',
    mcqOptions: ['$\\dfrac{1}{30}$', '$\\dfrac{4}{15}$', '$\\dfrac{7}{30}$', '$0$'],
    answer: { correctIndex: 0 },
    steps: [
      { h: 'Favourable outcomes', d: 'The only even prime is $2$.' },
      { h: 'Probability', d: '$P = \\dfrac{1}{30}$.' }
    ]
  },
  {
    ...CBSE_2025_X_2_1,
    id: 'cbse-2025-x-30-2-1-q3',
    questionNumber: 3,
    chapterId: 'c10-quadratic-equations',
    difficulty: 2,
    prompt: 'The quadratic equation whose roots are $7$ and $\\dfrac{1}{7}$ is',
    mcqOptions: ['$7x^2 - 50x + 7 = 0$', '$7x^2 - 50x + 1 = 0$', '$7x^2 + 50x - 7 = 0$', '$7x^2 + 50x - 1 = 0$'],
    answer: { correctIndex: 0 },
    steps: [
      { h: 'Sum and product', d: 'Sum $= 7 + \\dfrac{1}{7} = \\dfrac{50}{7}$, product $= 1$.' },
      { h: 'Form the equation', d: '$x^2 - \\dfrac{50}{7}x + 1 = 0$; multiply by $7$: $7x^2 - 50x + 7 = 0$.' }
    ]
  },
  {
    ...CBSE_2025_X_2_1,
    id: 'cbse-2025-x-30-2-1-q5',
    questionNumber: 5,
    chapterId: 'c10-coordinate-geometry',
    difficulty: 1,
    prompt: 'The coordinates of the end points of a diameter of a circle are $(5, -2)$ and $(5, 2)$. The length of the radius of the circle is',
    mcqOptions: ['$\\pm 2$', '$\\pm 4$', '$4$', '$2$'],
    answer: { correctIndex: 3 },
    steps: [
      { h: 'Diameter', d: 'The points share $x = 5$, so the diameter is $|2 - (-2)| = 4$.' },
      { h: 'Radius', d: '$\\dfrac{4}{2} = 2$. A length is positive, so not $\\pm 2$.' }
    ]
  },
  {
    ...CBSE_2025_X_2_1,
    id: 'cbse-2025-x-30-2-1-q6',
    questionNumber: 6,
    chapterId: 'c10-coordinate-geometry',
    difficulty: 2,
    prompt: 'The points $(-5, 0)$, $(5, 0)$ and $(0, 4)$ are the vertices of a triangle which is a/an',
    mcqOptions: ['right-angled triangle', 'isosceles triangle', 'equilateral triangle', 'scalene triangle'],
    answer: { correctIndex: 1 },
    steps: [
      { h: 'Side lengths', d: 'Between $(-5,0)$ and $(5,0)$: $10$. From $(0,4)$ to each: $\\sqrt{25 + 16} = \\sqrt{41}$.' },
      { h: 'Classify', d: 'Two sides are equal and the third is not, so it is isosceles. It is not right-angled: $41 + 41 \\ne 100$.' }
    ]
  },
  {
    ...CBSE_2025_X_2_1,
    id: 'cbse-2025-x-30-2-1-q9',
    questionNumber: 9,
    chapterId: 'c10-triangles',
    difficulty: 1,
    prompt: 'Which of the following statements is incorrect?',
    mcqOptions: ['Two congruent figures are always similar.', 'A square and a rhombus of the same area are always similar.', 'Two equilateral triangles are always similar.', 'Two similar triangles need not be congruent.'],
    answer: { correctIndex: 1 },
    steps: [
      { h: 'Similar polygons', d: 'Similar polygons need equal corresponding angles and proportional sides.' },
      { h: 'Square and rhombus', d: 'A rhombus need not have right angles, so it need not be similar to a square, whatever its area. That statement is the incorrect one.' }
    ]
  },
  {
    ...CBSE_2025_X_2_1,
    id: 'cbse-2025-x-30-2-1-q10',
    questionNumber: 10,
    chapterId: 'c10-real-numbers',
    difficulty: 1,
    prompt: 'The sum of the exponents of prime factors in the prime factorisation of $4004$ is',
    mcqOptions: ['$5$', '$4$', '$3$', '$2$'],
    answer: { correctIndex: 0 },
    steps: [
      { h: 'Factorise', d: '$4004 = 4 \\times 1001 = 2^2 \\times 7 \\times 11 \\times 13$.' },
      { h: 'Add the exponents', d: '$2 + 1 + 1 + 1 = 5$.' }
    ]
  },
  {
    ...CBSE_2025_X_2_1,
    id: 'cbse-2025-x-30-2-1-q11',
    questionNumber: 11,
    chapterId: 'c10-probability',
    difficulty: 1,
    prompt: 'In a cricket match, a batsman hits the boundary $7$ times out of the $42$ balls he plays. The probability of his not hitting a boundary is',
    mcqOptions: ['$\\dfrac{1}{7}$', '$\\dfrac{2}{7}$', '$\\dfrac{5}{6}$', '$\\dfrac{1}{6}$'],
    answer: { correctIndex: 2 },
    steps: [
      { h: 'Not a boundary', d: '$42 - 7 = 35$ balls.' },
      { h: 'Probability', d: '$\\dfrac{35}{42} = \\dfrac{5}{6}$.' }
    ]
  },
  {
    ...CBSE_2025_X_2_1,
    id: 'cbse-2025-x-30-2-1-q12',
    questionNumber: 12,
    chapterId: 'c10-areas-circles',
    difficulty: 1,
    prompt: 'If a large circular pizza is divided into $5$ equal sectors, then the central angle of each sector will be',
    mcqOptions: ['$60^{\\circ}$', '$90^{\\circ}$', '$45^{\\circ}$', '$72^{\\circ}$'],
    answer: { correctIndex: 3 },
    steps: [
      { h: 'Share the full turn', d: '$\\dfrac{360^{\\circ}}{5} = 72^{\\circ}$.' }
    ]
  },
  {
    ...CBSE_2025_X_2_1,
    id: 'cbse-2025-x-30-2-1-q13',
    questionNumber: 13,
    chapterId: 'c10-trigonometry',
    difficulty: 1,
    prompt: 'If $\\sin 30^{\\circ}\\tan 45^{\\circ} = \\dfrac{\\sec 60^{\\circ}}{k}$, then the value of $k$ is',
    mcqOptions: ['$4$', '$3$', '$2$', '$1$'],
    answer: { correctIndex: 0 },
    steps: [
      { h: 'Standard values', d: '$\\sin 30^{\\circ} = \\dfrac{1}{2}$, $\\tan 45^{\\circ} = 1$, $\\sec 60^{\\circ} = 2$.' },
      { h: 'Solve', d: '$\\dfrac{1}{2} = \\dfrac{2}{k}$, so $k = 4$.' }
    ]
  },
  {
    ...CBSE_2025_X_2_1,
    id: 'cbse-2025-x-30-2-1-q14',
    questionNumber: 14,
    chapterId: 'c10-pair-linear-equations',
    difficulty: 1,
    prompt: 'The line represented by the equation $x - y = 0$ is',
    mcqOptions: ['parallel to $x$-axis', 'parallel to $y$-axis', 'passing through the origin', 'passing through the point $(3, 2)$'],
    answer: { correctIndex: 2 },
    steps: [
      { h: 'Test the origin', d: '$0 - 0 = 0$, so $(0, 0)$ lies on the line.' },
      { h: 'Rule out the rest', d: 'The line is $y = x$, which is slanted, and $(3, 2)$ gives $3 - 2 = 1 \\ne 0$.' }
    ]
  },
  {
    ...CBSE_2025_X_2_1,
    id: 'cbse-2025-x-30-2-1-q15',
    questionNumber: 15,
    chapterId: 'c10-arithmetic-progressions',
    difficulty: 2,
    prompt: 'The $10^{\\text{th}}$ term of the AP $5, \\dfrac{19}{4}, \\dfrac{9}{2}, \\dfrac{17}{4}, \\ldots$ is',
    mcqOptions: ['$\\dfrac{11}{4}$', '$\\dfrac{4}{11}$', '$\\dfrac{13}{4}$', '$\\dfrac{4}{13}$'],
    answer: { correctIndex: 0 },
    steps: [
      { h: 'Common difference', d: '$d = \\dfrac{19}{4} - 5 = -\\dfrac{1}{4}$.' },
      { h: 'Tenth term', d: '$a_{10} = 5 + 9\\left(-\\dfrac{1}{4}\\right) = \\dfrac{20 - 9}{4} = \\dfrac{11}{4}$.' }
    ]
  },
  {
    ...CBSE_2025_X_2_1,
    id: 'cbse-2025-x-30-2-1-q16',
    questionNumber: 16,
    chapterId: 'c10-polynomials',
    difficulty: 1,
    prompt: 'If $-4$ is a zero of the polynomial $p(x) = x^2 - x - (2 + 2k)$, then the value of $k$ is',
    mcqOptions: ['$3$', '$9$', '$6$', '$-9$'],
    answer: { correctIndex: 1 },
    steps: [
      { h: 'Substitute the zero', d: '$p(-4) = 16 + 4 - 2 - 2k = 18 - 2k$.' },
      { h: 'Solve', d: '$18 - 2k = 0$, so $k = 9$.' }
    ]
  },
  {
    ...CBSE_2025_X_2_1,
    id: 'cbse-2025-x-30-2-1-q17',
    questionNumber: 17,
    chapterId: 'c10-pair-linear-equations',
    difficulty: 1,
    prompt: 'The equation of a line parallel to the $x$-axis and at a distance of $3$ units below $x$-axis is',
    mcqOptions: ['$x = 3$', '$x = -3$', '$y = -3$', '$y = 3$'],
    answer: { correctIndex: 2 },
    steps: [
      { h: 'Parallel to the $x$-axis', d: 'Such a line has the form $y = c$.' },
      { h: 'Below the axis', d: 'Three units below means $c = -3$: $y = -3$.' }
    ]
  },
  {
    ...CBSE_2025_X_2_1,
    id: 'cbse-2025-x-30-2-1-q18',
    questionNumber: 18,
    chapterId: 'c10-real-numbers',
    difficulty: 1,
    prompt: 'The HCF of $40$, $110$ and $360$ is',
    mcqOptions: ['$40$', '$110$', '$360$', '$10$'],
    answer: { correctIndex: 3 },
    steps: [
      { h: 'Factorise', d: '$40 = 2^3 \\times 5$, $110 = 2 \\times 5 \\times 11$, $360 = 2^3 \\times 3^2 \\times 5$.' },
      { h: 'Common factors', d: 'The lowest powers common to all three: $2 \\times 5 = 10$.' }
    ]
  },
  {
    ...CBSE_2025_X_2_1,
    id: 'cbse-2025-x-30-2-1-q19',
    questionNumber: 19,
    chapterId: 'c10-arithmetic-progressions',
    difficulty: 1,
    prompt: 'Assertion (A): Common difference of the AP $5, 1, -3, -7, \\ldots$ is $4$.\n\nReason (R): Common difference of the AP $a_1, a_2, a_3, \\ldots, a_n$ is obtained by $d = a_n - a_{n-1}$.',
    mcqOptions: [...AR_CODES],
    answer: { correctIndex: 3 },
    steps: [
      { h: 'Assertion', d: '$d = 1 - 5 = -4$, not $4$, so (A) is false.' },
      { h: 'Reason', d: 'Any term minus the term before it gives the common difference, so (R) is true.' }
    ]
  },
  {
    ...CBSE_2025_X_2_1,
    id: 'cbse-2025-x-30-2-1-q20',
    questionNumber: 20,
    chapterId: 'c10-pair-linear-equations',
    difficulty: 2,
    prompt: 'Assertion (A): The pair of linear equations $px + 3y + 59 = 0$ and $2x + 6y + 118 = 0$ will have infinitely many solutions if $p = 1$.\n\nReason (R): If the pair of linear equations $px + 3y + 19 = 0$ and $2x + 6y + 157 = 0$ has a unique solution, then $p \\ne 1$.',
    mcqOptions: [...AR_CODES],
    answer: { correctIndex: 1 },
    steps: [
      { h: 'Assertion', d: 'With $p = 1$: $\\dfrac{1}{2} = \\dfrac{3}{6} = \\dfrac{59}{118}$, so the lines coincide and there are infinitely many solutions. (A) is true.' },
      { h: 'Reason', d: 'A unique solution needs $\\dfrac{p}{2} \\ne \\dfrac{3}{6}$, i.e. $p \\ne 1$. (R) is true.' },
      { h: 'Does (R) explain (A)?', d: 'No: (R) is about a different pair and the unique-solution condition, while (A) rests on all three ratios being equal.' }
    ]
  }
]);
