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

const CBSE_2025_X_2_2 = Object.freeze({
  ...CBSE_2025_X,
  setCode: '30/2/2',
  promptSource: ['cbse-2025-x-30-2-2-marking-scheme', 'cbse-2025-x-30-2-2-questions'],
  answerSource: 'cbse-2025-x-30-2-2-marking-scheme'
});

const CBSE_2025_X_2_3 = Object.freeze({
  ...CBSE_2025_X,
  setCode: '30/2/3',
  promptSource: ['cbse-2025-x-30-2-3-marking-scheme', 'cbse-2025-x-30-2-3-questions'],
  answerSource: 'cbse-2025-x-30-2-3-marking-scheme'
});

const CBSE_2025_XII_2_1 = Object.freeze({
  ...CBSE_2025_XII,
  setCode: '65/2/1',
  promptSource: ['cbse-2025-xii-65-2-1-marking-scheme', 'cbse-2025-xii-65-2-1-questions'],
  answerSource: 'cbse-2025-xii-65-2-1-marking-scheme'
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
  },
  // ── CBSE Class 10 Mathematics Standard (041) · 2025 · Set 30/2/2 · Section A ─
  // Q9 and Q15 depend on a printed figure. Q8 is left out because the Board's own
  // marking scheme says none of its printed options is correct (the least such
  // square is 400), so it has no official key to carry. Q4–Q7, Q10, Q16, Q17,
  // Q19 and Q20 are printed word for word in Set 30/2/1 and are carried there once.
  {
    ...CBSE_2025_X_2_2,
    id: 'cbse-2025-x-30-2-2-q1',
    questionNumber: 1,
    chapterId: 'c10-quadratic-equations',
    difficulty: 2,
    prompt: 'The quadratic equation whose sum and product of roots are $a$ and $\\dfrac{1}{a}$ respectively is',
    mcqOptions: ['$ax^2 - ax + 1 = 0$', '$ax^2 - a^2x + 1 = 0$', '$ax^2 + ax + 1 = 0$', '$ax^2 + a^2x - 1 = 0$'],
    answer: { correctIndex: 1 },
    steps: [
      { h: 'Form the equation', d: '$x^2 - (\\text{sum})x + \\text{product} = 0$: $x^2 - ax + \\dfrac{1}{a} = 0$.' },
      { h: 'Clear the fraction', d: 'Multiply by $a$: $ax^2 - a^2x + 1 = 0$.' }
    ]
  },
  {
    ...CBSE_2025_X_2_2,
    id: 'cbse-2025-x-30-2-2-q2',
    questionNumber: 2,
    chapterId: 'c10-arithmetic-progressions',
    difficulty: 2,
    prompt: 'The $9^{\\text{th}}$ term from the end (towards first term) of the AP $7, 11, 15, 19, \\ldots, 147$ is',
    mcqOptions: ['$135$', '$125$', '$115$', '$39$'],
    answer: { correctIndex: 2 },
    steps: [
      { h: 'Read the AP backwards', d: 'From the end it starts at $147$ with common difference $-4$.' },
      { h: 'Ninth term', d: '$147 + 8(-4) = 115$.' }
    ]
  },
  {
    ...CBSE_2025_X_2_2,
    id: 'cbse-2025-x-30-2-2-q3',
    questionNumber: 3,
    chapterId: 'c10-coordinate-geometry',
    difficulty: 1,
    prompt: 'The perimeter of the triangle formed by the vertices $(0, 0)$, $(2, 0)$ and $(0, 2)$ is',
    mcqOptions: ['$4$ units', '$6$ units', '$6\\sqrt{2}$ units', '$(4 + 2\\sqrt{2})$ units'],
    answer: { correctIndex: 3 },
    steps: [
      { h: 'Sides', d: 'The legs along the axes are $2$ and $2$; the third side is $\\sqrt{2^2 + 2^2} = 2\\sqrt{2}$.' },
      { h: 'Perimeter', d: '$2 + 2 + 2\\sqrt{2} = 4 + 2\\sqrt{2}$ units.' }
    ]
  },
  {
    ...CBSE_2025_X_2_2,
    id: 'cbse-2025-x-30-2-2-q11',
    questionNumber: 11,
    chapterId: 'c10-trigonometry',
    difficulty: 1,
    prompt: 'If $\\sin(\\alpha + \\beta) = 1$, then the value of $\\sin\\left(\\dfrac{\\alpha + \\beta}{2}\\right)$ is',
    mcqOptions: ['$\\dfrac{1}{\\sqrt{2}}$', '$\\dfrac{1}{2}$', '$0$', '$1$'],
    answer: { correctIndex: 0 },
    steps: [
      { h: 'Find the angle', d: '$\\sin 90^{\\circ} = 1$, so $\\alpha + \\beta = 90^{\\circ}$.' },
      { h: 'Halve it', d: '$\\sin 45^{\\circ} = \\dfrac{1}{\\sqrt{2}}$.' }
    ]
  },
  {
    ...CBSE_2025_X_2_2,
    id: 'cbse-2025-x-30-2-2-q12',
    questionNumber: 12,
    chapterId: 'c10-real-numbers',
    difficulty: 2,
    prompt: 'If $1080 = 2^p \\times 3^q \\times 5$, then $(p - q)$ is equal to',
    mcqOptions: ['$6$', '$-1$', '$1$', '$0$'],
    answer: { correctIndex: 3 },
    steps: [
      { h: 'Factorise', d: '$1080 = 8 \\times 135 = 2^3 \\times 3^3 \\times 5$.' },
      { h: 'Compare', d: '$p = 3$, $q = 3$, so $p - q = 0$.' }
    ]
  },
  {
    ...CBSE_2025_X_2_2,
    id: 'cbse-2025-x-30-2-2-q13',
    questionNumber: 13,
    chapterId: 'c10-probability',
    difficulty: 2,
    prompt: 'If all the red face cards are removed from the deck of $52$ playing cards, then the probability of getting a black jack from the remaining cards is',
    mcqOptions: ['$\\dfrac{2}{46}$', '$\\dfrac{2}{52}$', '$\\dfrac{4}{48}$', '$\\dfrac{2}{23}$'],
    answer: { correctIndex: 0 },
    steps: [
      { h: 'Remaining cards', d: 'The $6$ red face cards go: $52 - 6 = 46$ remain.' },
      { h: 'Favourable', d: 'The two black jacks are still there: $P = \\dfrac{2}{46}$.' }
    ]
  },
  {
    ...CBSE_2025_X_2_2,
    id: 'cbse-2025-x-30-2-2-q14',
    questionNumber: 14,
    chapterId: 'c10-coordinate-geometry',
    difficulty: 1,
    prompt: 'The equation of a line parallel to the x-axis and at a distance of $3$ units below x-axis is',
    mcqOptions: ['$x = 3$', '$x = -3$', '$y = -3$', '$y = 3$'],
    answer: { correctIndex: 2 },
    steps: [
      { h: 'Parallel to the x-axis', d: 'Such a line has the form $y = c$.' },
      { h: 'Below the axis', d: '$3$ units below means $y = -3$.' }
    ]
  },
  {
    ...CBSE_2025_X_2_2,
    id: 'cbse-2025-x-30-2-2-q18',
    questionNumber: 18,
    chapterId: 'c10-trigonometry',
    difficulty: 1,
    prompt: 'If $\\sin 30^{\\circ} \\tan 45^{\\circ} = \\dfrac{\\sec 60^{\\circ}}{k}$, then the value of $k$ is',
    mcqOptions: ['$4$', '$3$', '$2$', '$1$'],
    answer: { correctIndex: 0 },
    steps: [
      { h: 'Values', d: '$\\sin 30^{\\circ} \\tan 45^{\\circ} = \\dfrac{1}{2} \\cdot 1 = \\dfrac{1}{2}$ and $\\sec 60^{\\circ} = 2$.' },
      { h: 'Solve', d: '$\\dfrac{2}{k} = \\dfrac{1}{2}$, so $k = 4$.' }
    ]
  },
  // ── CBSE Class 10 Mathematics Standard (041) · 2025 · Set 30/2/3 · Section A ─
  // Q9 and Q13 depend on a printed figure; Q16 has no official key (the Board's
  // scheme says none of its options is correct). Q7, Q8, Q10, Q11, Q14, Q15 and
  // Q17–Q20 are printed word for word in Set 30/2/1 and are carried there once.
  {
    ...CBSE_2025_X_2_3,
    id: 'cbse-2025-x-30-2-3-q1',
    questionNumber: 1,
    chapterId: 'c10-probability',
    difficulty: 1,
    prompt: 'If for any event $E$, $P(E) + P(\overline{E}) = q$, then the value of $q^2 - 3$ is',
    mcqOptions: ['$0$', '$-2$', '$2$', '$1$'],
    answer: { correctIndex: 1 },
    steps: [
      { h: 'Complementary events', d: '$P(E) + P(\overline{E}) = 1$, so $q = 1$.' },
      { h: 'Evaluate', d: '$q^2 - 3 = 1 - 3 = -2$.' }
    ]
  },
  {
    ...CBSE_2025_X_2_3,
    id: 'cbse-2025-x-30-2-3-q2',
    questionNumber: 2,
    chapterId: 'c10-trigonometry',
    difficulty: 1,
    prompt: 'If $\sin\theta = \cos\theta$ $(0^{\circ} < \theta < 90^{\circ})$, then the value of $\sec\theta \cdot \sin\theta$ is',
    mcqOptions: ['$\dfrac{1}{\sqrt{2}}$', '$\sqrt{2}$', '$0$', '$1$'],
    answer: { correctIndex: 3 },
    steps: [
      { h: 'Rewrite', d: '$\sec\theta \cdot \sin\theta = \dfrac{\sin\theta}{\cos\theta} = \tan\theta$.' },
      { h: 'Use the condition', d: '$\sin\theta = \cos\theta$ gives $\tan\theta = 1$.' }
    ]
  },
  {
    ...CBSE_2025_X_2_3,
    id: 'cbse-2025-x-30-2-3-q3',
    questionNumber: 3,
    chapterId: 'c10-areas-circles',
    difficulty: 1,
    prompt: 'If an arc of a circle of diameter $10$ cm subtends an angle of $144^{\circ}$ at the centre of the circle, then the length of the arc is',
    mcqOptions: ['$2\pi$ cm', '$4\pi$ cm', '$5\pi$ cm', '$6\pi$ cm'],
    answer: { correctIndex: 1 },
    steps: [
      { h: 'Radius', d: '$r = 5$ cm.' },
      { h: 'Arc length', d: '$\dfrac{144}{360} \times 2\pi \times 5 = \dfrac{2}{5} \times 10\pi = 4\pi$ cm.' }
    ]
  },
  {
    ...CBSE_2025_X_2_3,
    id: 'cbse-2025-x-30-2-3-q4',
    questionNumber: 4,
    chapterId: 'c10-real-numbers',
    difficulty: 2,
    prompt: 'If $a^b = 32$, where $a$ and $b$ are positive integers, then the value of $b^{ab}$ is',
    mcqOptions: ['$72$', '$5^{10}$', '$2^{10}$', '$5^{12}$'],
    answer: { correctIndex: 1 },
    steps: [
      { h: 'Write 32 as a power', d: '$32 = 2^5$, so $a = 2$, $b = 5$. ($a = 32$, $b = 1$ gives $1$, which is not an option.)' },
      { h: 'Evaluate', d: '$ab = 10$, so $b^{ab} = 5^{10}$.' }
    ]
  },
  {
    ...CBSE_2025_X_2_3,
    id: 'cbse-2025-x-30-2-3-q5',
    questionNumber: 5,
    chapterId: 'c10-polynomials',
    difficulty: 2,
    prompt: 'If one zero of the polynomial $q(x) = (p^2 + 4)x^2 + 65x + 4p$ is reciprocal of the other, then the value of $p$ is',
    mcqOptions: ['$-1$', '$1$', '$-2$', '$2$'],
    answer: { correctIndex: 3 },
    steps: [
      { h: 'Product of zeros', d: 'Reciprocal zeros multiply to $1$: $\dfrac{4p}{p^2 + 4} = 1$.' },
      { h: 'Solve', d: '$p^2 - 4p + 4 = 0$, so $(p - 2)^2 = 0$ and $p = 2$.' }
    ]
  },
  {
    ...CBSE_2025_X_2_3,
    id: 'cbse-2025-x-30-2-3-q6',
    questionNumber: 6,
    chapterId: 'c10-coordinate-geometry',
    difficulty: 1,
    prompt: 'The equation of a line parallel to y-axis and at a distance of $5$ units to the right of y-axis is',
    mcqOptions: ['$x = 5$', '$x = -5$', '$y = 5$', '$y = -5$'],
    answer: { correctIndex: 0 },
    steps: [
      { h: 'Parallel to the y-axis', d: 'Such a line has the form $x = c$.' },
      { h: 'To the right', d: '$5$ units to the right means $x = 5$.' }
    ]
  },
  {
    ...CBSE_2025_X_2_3,
    id: 'cbse-2025-x-30-2-3-q12',
    questionNumber: 12,
    chapterId: 'c10-arithmetic-progressions',
    difficulty: 1,
    prompt: 'The $10^{\text{th}}$ term of the AP $5, \dfrac{19}{4}, \dfrac{9}{2}, \dfrac{17}{4}, \ldots$ is',
    mcqOptions: ['$\dfrac{11}{4}$', '$\dfrac{4}{11}$', '$\dfrac{13}{4}$', '$\dfrac{4}{13}$'],
    answer: { correctIndex: 0 },
    steps: [
      { h: 'Common difference', d: '$d = \dfrac{19}{4} - 5 = -\dfrac{1}{4}$.' },
      { h: 'Tenth term', d: '$a_{10} = 5 + 9\left(-\dfrac{1}{4}\right) = \dfrac{11}{4}$.' }
    ]
  },
  // ── CBSE Class 12 Mathematics (041) · 2025 · Set 65/2/1 · Section A ─────────
  // Q6 is left out: the Board's marking scheme says no printed option is correct.
  // Q14's options are diagrams and Q15 depends on a printed figure.
  {
    ...CBSE_2025_XII_2_1, id: 'cbse-2025-xii-65-2-1-q1', questionNumber: 1, chapterId: 'c12-vector-algebra', difficulty: 1,
    prompt: 'The projection vector of vector $\\vec{a}$ on vector $\\vec{b}$ is',
    mcqOptions: ['$\\left(\\dfrac{\\vec{a}\\cdot\\vec{b}}{|\\vec{b}|^2}\\right)\\vec{b}$', '$\\dfrac{\\vec{a}\\cdot\\vec{b}}{|\\vec{b}|}$', '$\\dfrac{\\vec{a}\\cdot\\vec{b}}{|\\vec{a}|}$', '$\\left(\\dfrac{\\vec{a}\\cdot\\vec{b}}{|\\vec{a}|^2}\\right)\\vec{b}$'],
    answer: { correctIndex: 0 },
    steps: [
      { h: 'Scalar projection', d: 'The length of the projection of $\\vec{a}$ on $\\vec{b}$ is $\\dfrac{\\vec{a}\\cdot\\vec{b}}{|\\vec{b}|}$.' },
      { h: 'Make it a vector', d: 'Multiply by the unit vector $\\dfrac{\\vec{b}}{|\\vec{b}|}$: $\\left(\\dfrac{\\vec{a}\\cdot\\vec{b}}{|\\vec{b}|^2}\\right)\\vec{b}$.' }
    ]
  },
  {
    ...CBSE_2025_XII_2_1, id: 'cbse-2025-xii-65-2-1-q2', questionNumber: 2, chapterId: 'c12-applications-derivatives', difficulty: 1,
    prompt: 'The function $f(x) = x^2 - 4x + 6$ is increasing in the interval',
    mcqOptions: ['$(0, 2)$', '$(-\\infty, 2]$', '$[1, 2]$', '$[2, \\infty)$'],
    answer: { correctIndex: 3 },
    steps: [
      { h: 'Derivative', d: '$f\'(x) = 2x - 4$.' },
      { h: 'Sign', d: '$f\'(x) \\ge 0$ exactly when $x \\ge 2$, so $f$ is increasing on $[2, \\infty)$.' }
    ]
  },
  {
    ...CBSE_2025_XII_2_1, id: 'cbse-2025-xii-65-2-1-q3', questionNumber: 3, chapterId: 'c12-integrals', difficulty: 2,
    prompt: 'If $f(2a - x) = f(x)$, then $\\displaystyle\\int_0^{2a} f(x)\\,dx$ is',
    mcqOptions: ['$\\displaystyle\\int_0^{2a} f\\left(\\dfrac{x}{2}\\right)dx$', '$\\displaystyle\\int_0^{a} f(x)\\,dx$', '$2\\displaystyle\\int_a^{0} f(x)\\,dx$', '$2\\displaystyle\\int_0^{a} f(x)\\,dx$'],
    answer: { correctIndex: 3 },
    steps: [
      { h: 'Split at $a$', d: '$\\displaystyle\\int_0^{2a} f = \\int_0^{a} f(x)\\,dx + \\int_a^{2a} f(x)\\,dx$.' },
      { h: 'Substitute $x = 2a - t$ in the second', d: 'It becomes $\\displaystyle\\int_0^{a} f(2a - t)\\,dt = \\int_0^{a} f(t)\\,dt$.' },
      { h: 'Add', d: '$2\\displaystyle\\int_0^{a} f(x)\\,dx$.' }
    ]
  },
  {
    ...CBSE_2025_XII_2_1, id: 'cbse-2025-xii-65-2-1-q4', questionNumber: 4, chapterId: 'c12-matrices', difficulty: 1,
    prompt: 'If $A = \\begin{bmatrix}1&12&4y\\\\6x&5&2x\\\\8x&4&6\\end{bmatrix}$ is a symmetric matrix, then $(2x + y)$ is',
    mcqOptions: ['$-8$', '$0$', '$6$', '$8$'],
    answer: { correctIndex: 3 },
    steps: [
      { h: 'Symmetric means $a_{ij} = a_{ji}$', d: '$6x = 12$ gives $x = 2$, and $4y = 8x = 16$ gives $y = 4$. (Check: $2x = 4$ matches the entry $4$.)' },
      { h: 'Evaluate', d: '$2x + y = 4 + 4 = 8$.' }
    ]
  },
  {
    ...CBSE_2025_XII_2_1, id: 'cbse-2025-xii-65-2-1-q5', questionNumber: 5, chapterId: 'c12-inverse-trigonometric', difficulty: 1,
    prompt: 'If $y = \\sin^{-1}x$, $-1 \\le x \\le 0$, then the range of $y$ is',
    mcqOptions: ['$\\left(-\\dfrac{\\pi}{2}, 0\\right)$', '$\\left[-\\dfrac{\\pi}{2}, 0\\right]$', '$\\left[-\\dfrac{\\pi}{2}, 0\\right)$', '$\\left(-\\dfrac{\\pi}{2}, 0\\right]$'],
    answer: { correctIndex: 1 },
    steps: [
      { h: 'Endpoints', d: '$\\sin^{-1}(-1) = -\\dfrac{\\pi}{2}$ and $\\sin^{-1}(0) = 0$; both endpoints are in the domain.' },
      { h: 'Increasing', d: '$\\sin^{-1}$ is increasing, so the range is the closed interval $\\left[-\\dfrac{\\pi}{2}, 0\\right]$.' }
    ]
  },
  {
    ...CBSE_2025_XII_2_1, id: 'cbse-2025-xii-65-2-1-q7', questionNumber: 7, chapterId: 'c12-probability', difficulty: 2,
    prompt: 'If $E$ and $F$ are two events such that $P(E) > 0$ and $P(F) \\ne 1$, then $P(\\overline{E} \\mid \\overline{F})$ is',
    mcqOptions: ['$\\dfrac{P(\\overline{E})}{P(\\overline{F})}$', '$1 - P(\\overline{E} \\mid F)$', '$1 - P(E \\mid F)$', '$\\dfrac{1 - P(E \\cup F)}{P(\\overline{F})}$'],
    answer: { correctIndex: 3 },
    steps: [
      { h: 'Definition', d: '$P(\\overline{E} \\mid \\overline{F}) = \\dfrac{P(\\overline{E} \\cap \\overline{F})}{P(\\overline{F})}$, defined because $P(F) \\ne 1$.' },
      { h: 'De Morgan', d: '$\\overline{E} \\cap \\overline{F} = \\overline{E \\cup F}$, so the numerator is $1 - P(E \\cup F)$.' }
    ]
  },
  {
    ...CBSE_2025_XII_2_1, id: 'cbse-2025-xii-65-2-1-q8', questionNumber: 8, chapterId: 'c12-matrices', difficulty: 1,
    prompt: 'Which of the following can be both a symmetric and skew-symmetric matrix?',
    mcqOptions: ['Unit Matrix', 'Diagonal Matrix', 'Null Matrix', 'Row Matrix'],
    answer: { correctIndex: 2 },
    steps: [
      { h: 'Both conditions', d: '$A^{T} = A$ and $A^{T} = -A$ together give $A = -A$, so $A = O$.' },
      { h: 'Conclude', d: 'Only the null matrix is both.' }
    ]
  },
  {
    ...CBSE_2025_XII_2_1, id: 'cbse-2025-xii-65-2-1-q9', questionNumber: 9, chapterId: 'c12-3d-geometry', difficulty: 1,
    prompt: 'The equation of a line parallel to the vector $3\\hat{i} + \\hat{j} + 2\\hat{k}$ and passing through the point $(4, -3, 7)$ is',
    mcqOptions: ['$x = 4t + 3$, $y = -3t + 1$, $z = 7t + 2$', '$x = 3t + 4$, $y = t + 3$, $z = 2t + 7$', '$x = 3t + 4$, $y = t - 3$, $z = 2t + 7$', '$x = 3t + 4$, $y = -t + 3$, $z = 2t + 7$'],
    answer: { correctIndex: 2 },
    steps: [
      { h: 'Parametric form', d: 'Through $(x_0, y_0, z_0)$ with direction $(a, b, c)$: $x = x_0 + at$, $y = y_0 + bt$, $z = z_0 + ct$.' },
      { h: 'Substitute', d: '$x = 3t + 4$, $y = t - 3$, $z = 2t + 7$.' }
    ]
  },
  {
    ...CBSE_2025_XII_2_1, id: 'cbse-2025-xii-65-2-1-q10', questionNumber: 10, chapterId: 'c12-matrices', difficulty: 2,
    prompt: 'Four friends Abhay, Bina, Chhaya and Devesh were asked to simplify $4AB + 3(AB + BA) - 4BA$, where $A$ and $B$ are both matrices of order $2 \\times 2$. It is known that $A \\ne B \\ne I$ and $A^{-1} \\ne B$. Their answers are given as: Abhay: $6AB$; Bina: $7AB - BA$; Chhaya: $8AB$; Devesh: $7BA - AB$. Who answered it correctly?',
    mcqOptions: ['Abhay', 'Bina', 'Chhaya', 'Devesh'],
    answer: { correctIndex: 1 },
    steps: [
      { h: 'Expand', d: '$4AB + 3AB + 3BA - 4BA = 7AB - BA$.' },
      { h: 'Do not combine $AB$ and $BA$', d: 'Matrix multiplication is not commutative in general, so $AB$ and $BA$ stay separate: Bina is right.' }
    ]
  },
  {
    ...CBSE_2025_XII_2_1, id: 'cbse-2025-xii-65-2-1-q11', questionNumber: 11, chapterId: 'c12-applications-derivatives', difficulty: 2,
    prompt: 'A cylindrical tank of radius $10$ cm is being filled with sugar at the rate of $100\\pi$ cm$^3$/s. The rate, at which the height of the sugar inside the tank is increasing, is',
    mcqOptions: ['$0.1$ cm/s', '$0.5$ cm/s', '$1$ cm/s', '$1.1$ cm/s'],
    answer: { correctIndex: 2 },
    steps: [
      { h: 'Volume', d: '$V = \\pi r^2 h = 100\\pi h$, with the radius fixed.' },
      { h: 'Differentiate', d: '$\\dfrac{dV}{dt} = 100\\pi\\dfrac{dh}{dt} = 100\\pi$, so $\\dfrac{dh}{dt} = 1$ cm/s.' }
    ]
  },
  {
    ...CBSE_2025_XII_2_1, id: 'cbse-2025-xii-65-2-1-q12', questionNumber: 12, chapterId: 'c12-vector-algebra', difficulty: 2,
    prompt: 'Let $\\vec{p}$ and $\\vec{q}$ be two unit vectors and $\\alpha$ be the angle between them. Then $(\\vec{p} + \\vec{q})$ will be a unit vector for what value of $\\alpha$?',
    mcqOptions: ['$\\dfrac{\\pi}{4}$', '$\\dfrac{\\pi}{3}$', '$\\dfrac{\\pi}{2}$', '$\\dfrac{2\\pi}{3}$'],
    answer: { correctIndex: 3 },
    steps: [
      { h: 'Square the length', d: '$|\\vec{p} + \\vec{q}|^2 = 1 + 1 + 2\\cos\\alpha$.' },
      { h: 'Set it to 1', d: '$2 + 2\\cos\\alpha = 1$, so $\\cos\\alpha = -\\dfrac{1}{2}$ and $\\alpha = \\dfrac{2\\pi}{3}$.' }
    ]
  },
  {
    ...CBSE_2025_XII_2_1, id: 'cbse-2025-xii-65-2-1-q13', questionNumber: 13, chapterId: 'c12-3d-geometry', difficulty: 1,
    prompt: 'The line $x = 1 + 5\\mu$, $y = -5 + \\mu$, $z = -6 - 3\\mu$ passes through which of the following point?',
    mcqOptions: ['$(1, -5, 6)$', '$(1, 5, 6)$', '$(1, -5, -6)$', '$(-1, -5, 6)$'],
    answer: { correctIndex: 2 },
    steps: [
      { h: 'Take $\\mu = 0$', d: 'The point is $(1, -5, -6)$.' },
      { h: 'The others', d: '$x = 1$ forces $\\mu = 0$, and then $y = -5$, $z = -6$, so no other option lies on the line.' }
    ]
  },
  {
    ...CBSE_2025_XII_2_1, id: 'cbse-2025-xii-65-2-1-q16', questionNumber: 16, chapterId: 'c12-linear-programming', difficulty: 1,
    prompt: 'A factory produces two products $X$ and $Y$. The profit earned by selling $X$ and $Y$ is represented by the objective function $Z = 5x + 7y$, where $x$ and $y$ are the number of units of $X$ and $Y$ respectively sold. Which of the following statement is correct?',
    mcqOptions: [
      'The objective function maximizes the difference of the profit earned from products X and Y.',
      'The objective function measures the total production of products X and Y.',
      'The objective function maximizes the combined profit earned from selling X and Y.',
      'The objective function ensures the company produces more of product X than product Y.'
    ],
    answer: { correctIndex: 2 },
    steps: [
      { h: 'Read the function', d: '$5x$ is the profit from $X$ and $7y$ the profit from $Y$; $Z$ is their sum.' },
      { h: 'Conclude', d: 'Maximising $Z$ maximises the combined profit from selling $X$ and $Y$.' }
    ]
  },
  {
    ...CBSE_2025_XII_2_1, id: 'cbse-2025-xii-65-2-1-q17', questionNumber: 17, chapterId: 'c12-matrices', difficulty: 2,
    prompt: 'If $A$ and $B$ are square matrices of order $m$ such that $A^2 - B^2 = (A - B)(A + B)$, then which of the following is always correct?',
    mcqOptions: ['$A = B$', '$AB = BA$', '$A = 0$ or $B = 0$', '$A = I$ or $B = I$'],
    answer: { correctIndex: 1 },
    steps: [
      { h: 'Expand the right side', d: '$(A - B)(A + B) = A^2 + AB - BA - B^2$.' },
      { h: 'Compare', d: '$A^2 - B^2 = A^2 + AB - BA - B^2$ gives $AB = BA$.' }
    ]
  },
  {
    ...CBSE_2025_XII_2_1, id: 'cbse-2025-xii-65-2-1-q18', questionNumber: 18, chapterId: 'c12-differential-equations', difficulty: 2,
    prompt: 'If $p$ and $q$ are respectively the order and degree of the differential equation $\\dfrac{d}{dx}\\left(\\dfrac{dy}{dx}\\right)^3 = 0$, then $(p - q)$ is',
    mcqOptions: ['$0$', '$1$', '$2$', '$3$'],
    answer: { correctIndex: 1 },
    steps: [
      { h: 'Carry out the derivative', d: '$3\\left(\\dfrac{dy}{dx}\\right)^2\\dfrac{d^2y}{dx^2} = 0$.' },
      { h: 'Order and degree', d: 'The highest derivative is $\\dfrac{d^2y}{dx^2}$ (order $p = 2$), appearing to the first power (degree $q = 1$), so $p - q = 1$.' }
    ]
  },
  {
    ...CBSE_2025_XII_2_1, id: 'cbse-2025-xii-65-2-1-q19', questionNumber: 19, chapterId: 'c12-matrices', difficulty: 1,
    prompt: 'Assertion (A): $A = \\mathrm{diag}\\,[3\\ 5\\ 2]$ is a scalar matrix of order $3 \\times 3$.\n\nReason (R): If a diagonal matrix has all non-zero elements equal, it is known as a scalar matrix.',
    mcqOptions: [...AR_CODES],
    answer: { correctIndex: 3 },
    steps: [
      { h: 'Assertion', d: 'A scalar matrix has every diagonal entry equal; $3$, $5$, $2$ are not, so (A) is false.' },
      { h: 'Reason', d: 'A diagonal matrix whose diagonal entries are all equal is a scalar matrix, which is what (R) states; the Board takes (R) as true.' }
    ]
  },
  {
    ...CBSE_2025_XII_2_1, id: 'cbse-2025-xii-65-2-1-q20', questionNumber: 20, chapterId: 'c12-linear-programming', difficulty: 2,
    prompt: 'Assertion (A): Every point of the feasible region of a Linear Programming Problem is an optimal solution.\n\nReason (R): The optimal solution for a Linear Programming Problem exists only at one or more corner point(s) of the feasible region.',
    mcqOptions: [...AR_CODES],
    answer: { correctIndex: 3 },
    steps: [
      { h: 'Assertion', d: 'A feasible point is one that satisfies the constraints; it is optimal only if it gives the best value of $Z$, which in general only some points do. (A) is false.' },
      { h: 'Reason', d: 'By the corner point theorem, when an optimal value exists it is attained at a corner point of the feasible region; the Board takes (R) as true.' }
    ]
  },
  // ── CBSE Class 12 · 2025 · Set 65/2/1 · Section B — on the Board-scheme contract ─
  // Marked by the Board's own value points (boardScheme.js, #844): 1½ for the
  // collinearity equation, ½ for the answer. Grouped into whole marks that is ONE
  // 2-mark group, so a wrong final answer earns nothing here even where the Board
  // would give 1½ — the contract may fall below the Board, never above it. The
  // point is the Board's wording; its `line` is the same statement cross-multiplied
  // (3 + 2x ≠ 0 at the solution), the form the deterministic step check verifies.
  {
    ...CBSE_2025_XII_2_1, id: 'cbse-2025-xii-65-2-1-q24', questionNumber: 24, section: 'Section B',
    chapterId: 'c12-vector-algebra', difficulty: 2, answerType: 'numeric',
    prompt: 'If $\\vec{a}$ and $\\vec{b}$ are two non-collinear vectors, then find $x$, such that $\\vec{\\alpha} = (x - 2)\\vec{a} + \\vec{b}$ and $\\vec{\\beta} = (3 + 2x)\\vec{a} - 2\\vec{b}$ are collinear.',
    answer: { value: 0.25, simplestFraction: { n: 1, d: 4 } },
    inputHint: 'e.g. 1/4',
    marks: 2,
    boardScheme: [
      { marks: 1.5, point: '$\\vec{\\alpha}$ and $\\vec{\\beta}$ collinear $\\Rightarrow \\dfrac{x-2}{3+2x} = \\dfrac{1}{-2}$', line: '-2(x-2) = 3+2x' },
      { marks: 0.5, point: '$x = \\dfrac{1}{4}$', answer: true }
    ],
    stepcheck: { kind: 'equation', variable: 'x', solutions: [0.25] },
    steps: [
      { h: 'Collinear means proportional coefficients', d: 'Since $\\vec{a}$ and $\\vec{b}$ are non-collinear, $\\vec{\\alpha} \\parallel \\vec{\\beta}$ exactly when $\\dfrac{x-2}{3+2x} = \\dfrac{1}{-2}$.' },
      { h: 'Cross-multiply', d: '$-2(x - 2) = 3 + 2x$, so $-2x + 4 = 3 + 2x$.' },
      { h: 'Solve', d: '$4x = 1$, so $x = \\dfrac{1}{4}$.' }
    ]
  }
]);
