// Pri Learning · JEE Advanced 2023 · Mathematics (Papers 1 and 2)
//
// Transcribed from the Joint Admission Board's "Final Answer Keys" documents
// (pyqSources.js: jeeadv-2023-p1-answers, jeeadv-2023-p2-answers), read from
// the rendered page. Worked steps are Pri Learning's own.
//
// Pending (one-or-more-correct, no archive contract yet): Paper 1 Q1–Q3,
// Paper 2 Q5–Q7. Matching lists (Paper 1 Q14–Q17) are single-correct MCQs.
// Paper 2 Q16–Q17 refer to a printed grid; the grid is fully described in
// words here, and a figure follows once the archive carries figures.

import { PYQ_PROVENANCE } from './pyqSources.js';

const P1 = Object.freeze({
  examId: 'jee-advanced', year: 2023, paper: '1',
  provenance: PYQ_PROVENANCE.OFFICIAL_PAPER_AND_KEY, pastPaper: true,
  promptSource: 'jeeadv-2023-p1-answers', answerSource: 'jeeadv-2023-p1-answers'
});
const P2 = Object.freeze({
  examId: 'jee-advanced', year: 2023, paper: '2',
  provenance: PYQ_PROVENANCE.OFFICIAL_PAPER_AND_KEY, pastPaper: true,
  promptSource: 'jeeadv-2023-p2-answers', answerSource: 'jeeadv-2023-p2-answers'
});

const MATCH = 'Match each entry in List-I to the correct entries in List-II.';
const PARA_I = 'Consider an obtuse angled triangle $ABC$ in which the difference between the largest and the smallest angle is $\\dfrac\\pi2$ and whose sides are in arithmetic progression. Suppose that the vertices of this triangle lie on a circle of radius $1$.';
const PARA_II = 'Consider a $6 \\times 6$ square divided into unit squares by grid lines (a $7 \\times 7$ array of grid points). Let $A_1, A_2, \\ldots, A_{49}$ be the points of intersection of the grid lines in some order. We say that $A_i$ and $A_j$ are friends if they are adjacent along a row or along a column. Assume that each point $A_i$ has an equal chance of being chosen.';

export const JEE_ADVANCED_2023_RECORDS = Object.freeze([
  // ── Paper 1 · Section 2 (single correct) ──
  {
    ...P1, id: 'jeeadv-2023-p1-q4', section: 'Section 2', questionNumber: 4,
    chapterId: 'c11-limits-derivatives', difficulty: 4, answerType: 'mcq',
    prompt: 'Let $f:(0, 1) \\to \\mathbb R$ be the function defined as $f(x) = \\sqrt n$ if $x \\in \\left[\\dfrac{1}{n + 1}, \\dfrac1n\\right)$ where $n \\in \\mathbb N$. Let $g:(0, 1) \\to \\mathbb R$ be a function such that $\\displaystyle\\int_{x^2}^{x}\\sqrt{\\frac{1 - t}{t}}\\,dt < g(x) < 2\\sqrt x$ for all $x \\in (0, 1)$. Then $\\displaystyle\\lim_{x\\to0} f(x)g(x)$',
    mcqOptions: ['does NOT exist', 'is equal to $1$', 'is equal to $2$', 'is equal to $3$'],
    answer: { correctIndex: 2 },
    hints: ['Compare both $f$ and $g$ with powers of $\\sqrt x$.'],
    steps: [
      { h: 'Idea', d: '$f(x) \\approx \\dfrac{1}{\\sqrt x}$ and $g(x) \\approx 2\\sqrt x$, so squeeze $f(x)\\sqrt x$ and $\\dfrac{g(x)}{\\sqrt x}$ separately.' },
      { h: '$f(x)\\sqrt x \\to 1$', d: 'For $x \\in \\left[\\frac1{n+1}, \\frac1n\\right)$: $\\sqrt{\\dfrac{n}{n + 1}} \\le \\sqrt n\\,\\sqrt x < 1$, and $n \\to \\infty$ as $x \\to 0$.' },
      { h: '$g(x)/\\sqrt x \\to 2$', d: 'On $(x^2, x)$, $\\sqrt{\\frac{1 - t}{t}} \\ge \\sqrt{1 - x}\\,t^{-1/2}$, so the lower bound is at least $\\sqrt{1 - x}\\,(2\\sqrt x - 2x)$. Divided by $\\sqrt x$ both bounds tend to $2$.' },
      { h: 'Answer', d: '$f(x)g(x) = f(x)\\sqrt x\\cdot\\dfrac{g(x)}{\\sqrt x} \\to 1\\cdot2 = 2$.' }
    ]
  },
  {
    ...P1, id: 'jeeadv-2023-p1-q5', section: 'Section 2', questionNumber: 5,
    chapterId: 'c12-3d-geometry', difficulty: 4, answerType: 'mcq',
    prompt: 'Let $Q$ be the cube with the set of vertices $\\{(x_1, x_2, x_3) \\in \\mathbb R^3 : x_1, x_2, x_3 \\in \\{0, 1\\}\\}$. Let $F$ be the set of all twelve lines containing the diagonals of the six faces of the cube $Q$. Let $S$ be the set of all four lines containing the main diagonals of the cube $Q$; for instance, the line passing through the vertices $(0, 0, 0)$ and $(1, 1, 1)$ is in $S$. For lines $\\ell_1$ and $\\ell_2$, let $d(\\ell_1, \\ell_2)$ denote the shortest distance between them. Then the maximum value of $d(\\ell_1, \\ell_2)$, as $\\ell_1$ varies over $F$ and $\\ell_2$ varies over $S$, is',
    mcqOptions: ['$\\dfrac{1}{\\sqrt6}$', '$\\dfrac{1}{\\sqrt8}$', '$\\dfrac{1}{\\sqrt3}$', '$\\dfrac{1}{\\sqrt{12}}$'],
    answer: { correctIndex: 0 },
    hints: ['By symmetry, fix the main diagonal through $(0,0,0)$ and $(1,1,1)$.'],
    steps: [
      { h: 'Idea', d: 'Fix one main diagonal; every face diagonal either meets it (distance $0$) or is skew to it, and the skew ones are all alike by symmetry.' },
      { h: 'A skew pair', d: 'Take the main diagonal through $O$ with direction $(1, 1, 1)$, and the face diagonal through $(1, 0, 0)$ and $(0, 1, 0)$, direction $(-1, 1, 0)$.' },
      { h: 'Common normal', d: '$(1, 1, 1)\\times(-1, 1, 0) = (-1, -1, 2)$, of length $\\sqrt6$.' },
      { h: 'Distance', d: '$\\dfrac{|(1, 0, 0)\\cdot(-1, -1, 2)|}{\\sqrt6} = \\dfrac{1}{\\sqrt6}$.' },
      { h: 'Answer', d: 'Face diagonals that share a vertex with the main diagonal meet it, so the maximum is $\\dfrac1{\\sqrt6}$.' }
    ]
  },
  {
    ...P1, id: 'jeeadv-2023-p1-q6', section: 'Section 2', questionNumber: 6,
    chapterId: 'c11-probability', difficulty: 4, answerType: 'mcq',
    prompt: 'Let $X = \\left\\{(x, y) \\in \\mathbb Z \\times \\mathbb Z : \\dfrac{x^2}{8} + \\dfrac{y^2}{20} < 1 \\text{ and } y^2 < 5x\\right\\}$. Three distinct points $P, Q$ and $R$ are randomly chosen from $X$. Then the probability that $P, Q$ and $R$ form a triangle whose area is a positive integer, is',
    mcqOptions: ['$\\dfrac{71}{220}$', '$\\dfrac{73}{220}$', '$\\dfrac{79}{220}$', '$\\dfrac{83}{220}$'],
    answer: { correctIndex: 1 },
    hints: ['List $X$: only $x = 1$ and $x = 2$ are possible.'],
    steps: [
      { h: 'Idea', d: 'The lattice points sit on two vertical lines, so every triangle has a vertical side and its area is half that side times $1$.' },
      { h: 'List $X$', d: '$x = 1$: $y = -2, \\ldots, 2$ ($5$ points). $x = 2$: $y = -3, \\ldots, 3$ ($7$ points). So $|X| = 12$ and there are $\\binom{12}{3} = 220$ choices.' },
      { h: 'Area', d: 'A triangle needs two points on one line, say $y_1, y_2$, and one on the other. Its area is $\\frac12|y_1 - y_2|$, a positive integer exactly when $y_1 - y_2$ is even.' },
      { h: 'Count', d: 'Even-gap pairs on $x = 1$: $3 + 1 = 4$, times $7$ points opposite: $28$. On $x = 2$: $6 + 3 = 9$, times $5$: $45$. Total $73$.' },
      { h: 'Answer', d: '$\\dfrac{73}{220}$.' }
    ]
  },
  {
    ...P1, id: 'jeeadv-2023-p1-q7', section: 'Section 2', questionNumber: 7,
    chapterId: 'c11-conic-sections', difficulty: 3, answerType: 'mcq',
    prompt: 'Let $P$ be a point on the parabola $y^2 = 4ax$, where $a > 0$. The normal to the parabola at $P$ meets the $x$-axis at a point $Q$. The area of the triangle $PFQ$, where $F$ is the focus of the parabola, is $120$. If the slope $m$ of the normal and $a$ are both positive integers, then the pair $(a, m)$ is',
    mcqOptions: ['$(2, 3)$', '$(1, 3)$', '$(2, 4)$', '$(3, 4)$'],
    answer: { correctIndex: 0 },
    hints: ['At $P = (at^2, 2at)$ the normal has slope $-t$.'],
    steps: [
      { h: 'Idea', d: 'Write everything in the parameter $t$; the area becomes $a^2m(m^2 + 1)$.' },
      { h: 'Normal', d: 'At $(at^2, 2at)$ the normal $y - 2at = -t(x - at^2)$ has slope $m = -t$ and meets the $x$-axis at $Q = (at^2 + 2a, 0)$.' },
      { h: 'Area', d: '$F = (a, 0)$, so $FQ = a(t^2 + 1)$ and the height is $2a|t|$: area $= a^2|t|(t^2 + 1) = a^2m(m^2 + 1) = 120$.' },
      { h: 'Solve in integers', d: '$m = 1, 2, 4$ give $a^2 = 60, 12, \\frac{120}{68}$, not squares; $m = 3$ gives $a^2 = 4$, $a = 2$. So $(a, m) = (2, 3)$.' }
    ]
  },

  // ── Paper 1 · Section 3 (non-negative integer) ──
  {
    ...P1, id: 'jeeadv-2023-p1-q8', section: 'Section 3', questionNumber: 8,
    chapterId: 'c12-inverse-trigonometric', difficulty: 3, answerType: 'numeric',
    prompt: 'Let $\\tan^{-1}(x) \\in \\left(-\\dfrac\\pi2, \\dfrac\\pi2\\right)$, for $x \\in \\mathbb R$. Then the number of real solutions of the equation\n\n$\\sqrt{1 + \\cos(2x)} = \\sqrt2\\,\\tan^{-1}(\\tan x)$\n\nin the set $\\left(-\\dfrac{3\\pi}{2}, -\\dfrac\\pi2\\right)\\cup\\left(-\\dfrac\\pi2, \\dfrac\\pi2\\right)\\cup\\left(\\dfrac\\pi2, \\dfrac{3\\pi}{2}\\right)$ is equal to ____.',
    answer: { value: 3 },
    inputHint: 'Enter the integer',
    hints: ['$\\sqrt{1 + \\cos2x} = \\sqrt2|\\cos x|$ and $\\tan^{-1}(\\tan x) = x - k\\pi$ on each interval.'],
    steps: [
      { h: 'Idea', d: 'On each interval write $u = x - k\\pi \\in \\left(-\\frac\\pi2, \\frac\\pi2\\right)$; the equation becomes $\\cos u = u$ every time.' },
      { h: 'Simplify', d: 'The equation is $|\\cos x| = \\tan^{-1}(\\tan x) = u$, and $|\\cos x| = |\\cos u| = \\cos u$ since $\\cos u > 0$.' },
      { h: 'One root each', d: '$\\cos u = u$ has exactly one solution in $\\left(-\\frac\\pi2, \\frac\\pi2\\right)$ ($u \\approx 0.739$), since $u - \\cos u$ is increasing.' },
      { h: 'Answer', d: 'One solution in each of the three intervals: $3$.' }
    ]
  },
  {
    ...P1, id: 'jeeadv-2023-p1-q9', section: 'Section 3', questionNumber: 9,
    chapterId: 'c12-applications-integrals', difficulty: 3, answerType: 'numeric',
    prompt: 'Let $n \\ge 2$ be a natural number and $f:[0, 1] \\to \\mathbb R$ be the function defined by\n\n$f(x) = \\begin{cases} n(1 - 2nx) & \\text{if } 0 \\le x \\le \\frac{1}{2n}\\\\ 2n(2nx - 1) & \\text{if } \\frac{1}{2n} \\le x \\le \\frac{3}{4n}\\\\ 4n(1 - nx) & \\text{if } \\frac{3}{4n} \\le x \\le \\frac1n\\\\ \\frac{n}{n - 1}(nx - 1) & \\text{if } \\frac1n \\le x \\le 1\\end{cases}$\n\nIf $n$ is such that the area of the region bounded by the curves $x = 0$, $x = 1$, $y = 0$ and $y = f(x)$ is $4$, then the maximum value of the function $f$ is ____.',
    answer: { value: 8 },
    inputHint: 'Enter the integer',
    hints: ['The graph is three triangles.'],
    steps: [
      { h: 'Idea', d: 'Each piece is a straight segment, so the area is a sum of triangles.' },
      { h: 'Vertices', d: 'The graph runs $(0, n) \\to \\left(\\frac1{2n}, 0\\right) \\to \\left(\\frac3{4n}, n\\right) \\to \\left(\\frac1n, 0\\right) \\to (1, n)$.' },
      { h: 'Area', d: '$\\tfrac12\\cdot\\tfrac1{2n}\\cdot n + \\tfrac12\\cdot\\tfrac1{2n}\\cdot n + \\tfrac12\\left(1 - \\tfrac1n\\right)n = \\tfrac14 + \\tfrac14 + \\tfrac{n - 1}{2} = \\tfrac n2$.' },
      { h: 'Answer', d: '$\\frac n2 = 4$ gives $n = 8$, and the maximum of $f$ is $n = 8$.' }
    ]
  },
  {
    ...P1, id: 'jeeadv-2023-p1-q10', section: 'Section 3', questionNumber: 10,
    chapterId: 'c11-sequences-series', difficulty: 4, answerType: 'numeric',
    prompt: 'Let $7\\overbrace{5\\cdots5}^{r}7$ denote the $(r + 2)$ digit number where the first and the last digits are $7$ and the remaining $r$ digits are $5$. Consider the sum $S = 77 + 757 + 7557 + \\cdots + 7\\overbrace{5\\cdots5}^{98}7$. If $S = \\dfrac{7\\overbrace{5\\cdots5}^{99}7 + m}{n}$, where $m$ and $n$ are natural numbers less than $3000$, then the value of $m + n$ is ____.',
    answer: { value: 1219 },
    inputHint: 'Enter the integer',
    hints: ['Write $7\\overbrace{5\\cdots5}^{r}7 = \\dfrac{68\\cdot10^{r+1} + 13}{9}$.'],
    steps: [
      { h: 'Idea', d: 'Each term is a geometric-series expression in $10^{r+1}$, so the sum is too.' },
      { h: 'One term', d: '$7\\cdot10^{r+1} + \\frac{50}{9}(10^r - 1) + 7 = \\dfrac{68\\cdot10^{r+1} + 13}{9}$.' },
      { h: 'Sum', d: '$9S = 68(10 + 10^2 + \\cdots + 10^{99}) + 13\\cdot99 = \\dfrac{68(10^{100} - 10)}{9} + 1287$.' },
      { h: 'Compare', d: 'With $T = 7\\overbrace{5\\cdots5}^{99}7 = \\dfrac{68\\cdot10^{100} + 13}{9}$: $9S = T + \\dfrac{-680 - 13}{9} + 1287 = T + 1210$.' },
      { h: 'Answer', d: '$S = \\dfrac{T + 1210}{9}$, so $m + n = 1210 + 9 = 1219$.' }
    ]
  },
  {
    ...P1, id: 'jeeadv-2023-p1-q11', section: 'Section 3', questionNumber: 11,
    chapterId: 'c11-complex-numbers', difficulty: 3, answerType: 'numeric',
    prompt: 'Let $A = \\left\\{\\dfrac{1967 + 1686\\,i\\sin\\theta}{7 - 3\\,i\\cos\\theta} : \\theta \\in \\mathbb R\\right\\}$. If $A$ contains exactly one positive integer $n$, then the value of $n$ is ____.',
    answer: { value: 281 },
    inputHint: 'Enter the integer',
    hints: ['Multiply by the conjugate and set the imaginary part to zero.'],
    steps: [
      { h: 'Idea', d: 'A real value needs zero imaginary part, which ties $\\cos\\theta$ to $\\sin\\theta$.' },
      { h: 'Rationalise', d: 'Numerator times $7 + 3i\\cos\\theta$: real part $13769 - 5058\\sin\\theta\\cos\\theta$, imaginary part $5901\\cos\\theta + 11802\\sin\\theta$; denominator $49 + 9\\cos^2\\theta$.' },
      { h: 'Real condition', d: '$5901(\\cos\\theta + 2\\sin\\theta) = 0$: $\\cos\\theta = -2\\sin\\theta$, so $\\sin^2\\theta = \\frac15$, $\\cos^2\\theta = \\frac45$ and $\\sin\\theta\\cos\\theta = -\\frac25$.' },
      { h: 'Value', d: '$\\dfrac{13769 + 5058\\cdot\\frac25}{49 + \\frac{36}{5}} = \\dfrac{15792.2}{56.2} = 281$.' }
    ]
  },
  {
    ...P1, id: 'jeeadv-2023-p1-q12', section: 'Section 3', questionNumber: 12,
    chapterId: 'c12-3d-geometry', difficulty: 4, answerType: 'numeric',
    prompt: 'Let $P$ be the plane $\\sqrt3x + 2y + 3z = 16$ and let\n\n$S = \\left\\{\\alpha\\hat\\imath + \\beta\\hat\\jmath + \\gamma\\hat k : \\alpha^2 + \\beta^2 + \\gamma^2 = 1 \\text{ and the distance of } (\\alpha, \\beta, \\gamma) \\text{ from the plane } P \\text{ is } \\tfrac72\\right\\}.$\n\nLet $\\vec u, \\vec v$ and $\\vec w$ be three distinct vectors in $S$ such that $|\\vec u - \\vec v| = |\\vec v - \\vec w| = |\\vec w - \\vec u|$. Let $V$ be the volume of the parallelepiped determined by vectors $\\vec u, \\vec v$ and $\\vec w$. Then the value of $\\dfrac{80}{\\sqrt3}V$ is ____.',
    answer: { value: 45 },
    inputHint: 'Enter the integer',
    hints: ['$S$ is a circle: the unit sphere cut by a plane at distance $\\frac12$ from the origin.'],
    steps: [
      { h: 'Idea', d: '$\\vec u, \\vec v, \\vec w$ form an equilateral triangle on a small circle; the parallelepiped is $6$ times the tetrahedron with apex $O$.' },
      { h: 'The circle', d: '$P$ is at distance $\\frac{16}{4} = 4$ from $O$, so points at distance $\\frac72$ from $P$ (on $O$\'s side) lie on a parallel plane at distance $\\frac12$ from $O$. It meets the unit sphere in a circle of radius $\\frac{\\sqrt3}{2}$.' },
      { h: 'The triangle', d: 'An equilateral triangle inscribed in radius $\\frac{\\sqrt3}2$ has side $\\frac32$ and area $\\frac{\\sqrt3}{4}\\cdot\\frac94 = \\frac{9\\sqrt3}{16}$.' },
      { h: 'Volume', d: 'Tetrahedron: $\\frac13\\cdot\\frac{9\\sqrt3}{16}\\cdot\\frac12 = \\frac{3\\sqrt3}{32}$, so $V = 6\\cdot\\frac{3\\sqrt3}{32} = \\frac{9\\sqrt3}{16}$.' },
      { h: 'Answer', d: '$\\dfrac{80}{\\sqrt3}\\cdot\\dfrac{9\\sqrt3}{16} = 45$.' }
    ]
  },
  {
    ...P1, id: 'jeeadv-2023-p1-q13', section: 'Section 3', questionNumber: 13,
    chapterId: 'c11-binomial-theorem', difficulty: 3, answerType: 'numeric',
    prompt: 'Let $a$ and $b$ be two nonzero real numbers. If the coefficient of $x^5$ in the expansion of $\\left(ax^2 + \\dfrac{70}{27bx}\\right)^4$ is equal to the coefficient of $x^{-5}$ in the expansion of $\\left(ax - \\dfrac{1}{bx^2}\\right)^7$, then the value of $2b$ is ____.',
    answer: { value: 3 },
    inputHint: 'Enter the integer',
    hints: ['Find the general term of each expansion and match the powers.'],
    steps: [
      { h: 'Idea', d: 'Pick the right general term in each expansion; $a^3$ cancels.' },
      { h: 'First expansion', d: 'Term $\\binom4r(ax^2)^{4-r}\\left(\\frac{70}{27bx}\\right)^r$ has power $8 - 3r = 5$ at $r = 1$: coefficient $\\dfrac{280a^3}{27b}$.' },
      { h: 'Second expansion', d: 'Term $\\binom7r(ax)^{7-r}\\left(-\\frac{1}{bx^2}\\right)^r$ has power $7 - 3r = -5$ at $r = 4$: coefficient $\\dfrac{35a^3}{b^4}$.' },
      { h: 'Solve', d: '$\\dfrac{280}{27b} = \\dfrac{35}{b^4}$ gives $b^3 = \\dfrac{27}{8}$, $b = \\dfrac32$ and $2b = 3$.' }
    ]
  },

  // ── Paper 1 · Section 4 (matching lists) ──
  {
    ...P1, id: 'jeeadv-2023-p1-q14', section: 'Section 4', questionNumber: 14,
    chapterId: 'c12-determinants', difficulty: 3, answerType: 'mcq',
    prompt: 'Let $\\alpha, \\beta$ and $\\gamma$ be real numbers. Consider the following system of linear equations\n\n$x + 2y + z = 7$\n$x + \\alpha z = 11$\n$2x - 3y + \\beta z = \\gamma$\n\n' + MATCH + '\n\nList-I:\n(P) If $\\beta = \\frac12(7\\alpha - 3)$ and $\\gamma = 28$, then the system has\n(Q) If $\\beta = \\frac12(7\\alpha - 3)$ and $\\gamma \\ne 28$, then the system has\n(R) If $\\beta \\ne \\frac12(7\\alpha - 3)$ where $\\alpha = 1$ and $\\gamma \\ne 28$, then the system has\n(S) If $\\beta \\ne \\frac12(7\\alpha - 3)$ where $\\alpha = 1$ and $\\gamma = 28$, then the system has\n\nList-II: (1) a unique solution; (2) no solution; (3) infinitely many solutions; (4) $x = 11$, $y = -2$ and $z = 0$ as a solution; (5) $x = -15$, $y = 4$ and $z = 0$ as a solution.',
    mcqOptions: [
      '(P)→(3) (Q)→(2) (R)→(1) (S)→(4)',
      '(P)→(3) (Q)→(2) (R)→(5) (S)→(4)',
      '(P)→(2) (Q)→(1) (R)→(4) (S)→(5)',
      '(P)→(2) (Q)→(1) (R)→(1) (S)→(3)'
    ],
    answer: { correctIndex: 0 },
    hints: ['Compute the coefficient determinant; then write the third row as a combination of the first two.'],
    steps: [
      { h: 'Idea', d: 'The determinant says when the solution is unique; when it is not, compare the constants.' },
      { h: 'Determinant', d: '$\\begin{vmatrix}1 & 2 & 1\\\\ 1 & 0 & \\alpha\\\\ 2 & -3 & \\beta\\end{vmatrix} = 7\\alpha - 2\\beta - 3$, zero exactly when $\\beta = \\frac12(7\\alpha - 3)$.' },
      { h: 'Singular case', d: 'Then row 3 $= -\\frac32$ row 1 $+ \\frac72$ row 2 in the coefficients, and the matching constant is $-\\frac{21}2 + \\frac{77}{2} = 28$. So $\\gamma = 28$: infinitely many (P→3); $\\gamma \\ne 28$: none (Q→2).' },
      { h: 'Non-singular case', d: 'A unique solution (R→1). With $\\alpha = 1$, $\\gamma = 28$: $(11, -2, 0)$ satisfies $7$, $11$ and $22 + 6 = 28$ (S→4).' }
    ]
  },
  {
    ...P1, id: 'jeeadv-2023-p1-q15', section: 'Section 4', questionNumber: 15,
    chapterId: 'c11-statistics', difficulty: 2, answerType: 'mcq',
    prompt: 'Consider the given data with frequency distribution\n\n$\\begin{array}{c|cccccc} x_i & 3 & 8 & 11 & 10 & 5 & 4\\\\ \\hline f_i & 5 & 2 & 3 & 2 & 4 & 4\\end{array}$\n\n' + MATCH + '\n\nList-I: (P) The mean of the above data is; (Q) The median of the above data is; (R) The mean deviation about the mean of the above data is; (S) The mean deviation about the median of the above data is.\n\nList-II: (1) $2.5$; (2) $5$; (3) $6$; (4) $2.7$; (5) $2.4$.',
    mcqOptions: [
      '(P)→(3) (Q)→(2) (R)→(4) (S)→(5)',
      '(P)→(3) (Q)→(2) (R)→(1) (S)→(5)',
      '(P)→(2) (Q)→(3) (R)→(4) (S)→(1)',
      '(P)→(3) (Q)→(3) (R)→(5) (S)→(5)'
    ],
    answer: { correctIndex: 0 },
    hints: ['$\\sum f_i = 20$; sort the values before finding the median.'],
    steps: [
      { h: 'Mean', d: '$\\sum f_ix_i = 15 + 16 + 33 + 20 + 20 + 16 = 120$ over $20$: mean $6$.' },
      { h: 'Median', d: 'In order: $3\\,(5), 4\\,(4), 5\\,(4), \\ldots$; the $10$th and $11$th values are both $5$, so the median is $5$.' },
      { h: 'About the mean', d: '$\\sum f|x - 6| = 15 + 4 + 15 + 8 + 4 + 8 = 54$; $54/20 = 2.7$.' },
      { h: 'About the median', d: '$\\sum f|x - 5| = 10 + 6 + 18 + 10 + 0 + 4 = 48$; $48/20 = 2.4$.' },
      { h: 'Match', d: '(P)→(3), (Q)→(2), (R)→(4), (S)→(5).' }
    ]
  },
  {
    ...P1, id: 'jeeadv-2023-p1-q16', section: 'Section 4', questionNumber: 16,
    chapterId: 'c12-3d-geometry', difficulty: 4, answerType: 'mcq',
    prompt: 'Let $\\ell_1$ and $\\ell_2$ be the lines $\\vec r_1 = \\lambda(\\hat\\imath + \\hat\\jmath + \\hat k)$ and $\\vec r_2 = (\\hat\\jmath - \\hat k) + \\mu(\\hat\\imath + \\hat k)$, respectively. Let $X$ be the set of all the planes $H$ that contain the line $\\ell_1$. For a plane $H$, let $d(H)$ denote the smallest possible distance between the points of $\\ell_2$ and $H$. Let $H_0$ be a plane in $X$ for which $d(H_0)$ is the maximum value of $d(H)$ as $H$ varies over all planes in $X$.\n\n' + MATCH + '\n\nList-I: (P) The value of $d(H_0)$ is; (Q) The distance of the point $(0, 1, 2)$ from $H_0$ is; (R) The distance of origin from $H_0$ is; (S) The distance of origin from the point of intersection of planes $y = z$, $x = 1$ and $H_0$ is.\n\nList-II: (1) $\\sqrt3$; (2) $\\dfrac{1}{\\sqrt3}$; (3) $0$; (4) $\\sqrt2$; (5) $\\dfrac{1}{\\sqrt2}$.',
    mcqOptions: [
      '(P)→(2) (Q)→(4) (R)→(5) (S)→(1)',
      '(P)→(5) (Q)→(4) (R)→(3) (S)→(1)',
      '(P)→(2) (Q)→(1) (R)→(3) (S)→(2)',
      '(P)→(5) (Q)→(1) (R)→(4) (S)→(2)'
    ],
    answer: { correctIndex: 1 },
    hints: ['$d(H) = 0$ unless $H$ is parallel to $\\ell_2$.'],
    steps: [
      { h: 'Idea', d: 'A plane through $\\ell_1$ that is not parallel to $\\ell_2$ meets it, so $H_0$ must contain $\\ell_1$ and be parallel to $\\ell_2$.' },
      { h: '$H_0$', d: 'Normal $(1, 1, 1)\\times(1, 0, 1) = (1, 0, -1)$, through $O$: $H_0: x - z = 0$.' },
      { h: '(P)', d: 'Distance of $(0, 1, -1) \\in \\ell_2$: $\\dfrac{|0 + 1|}{\\sqrt2} = \\dfrac1{\\sqrt2}$.' },
      { h: '(Q), (R)', d: '$(0, 1, 2)$: $\\dfrac{2}{\\sqrt2} = \\sqrt2$. The origin lies on $H_0$: $0$.' },
      { h: '(S)', d: '$y = z$, $x = 1$, $x = z$ meet at $(1, 1, 1)$, at distance $\\sqrt3$.' },
      { h: 'Match', d: '(P)→(5), (Q)→(4), (R)→(3), (S)→(1).' }
    ]
  },
  {
    ...P1, id: 'jeeadv-2023-p1-q17', section: 'Section 4', questionNumber: 17,
    chapterId: 'c11-complex-numbers', difficulty: 3, answerType: 'mcq',
    prompt: 'Let $z$ be a complex number satisfying $|z|^3 + 2z^2 + 4\\bar z - 8 = 0$, where $\\bar z$ denotes the complex conjugate of $z$. Let the imaginary part of $z$ be nonzero.\n\n' + MATCH + '\n\nList-I: (P) $|z|^2$ is equal to; (Q) $|z - \\bar z|^2$ is equal to; (R) $|z|^2 + |z + \\bar z|^2$ is equal to; (S) $|z + 1|^2$ is equal to.\n\nList-II: (1) $12$; (2) $4$; (3) $8$; (4) $10$; (5) $7$.',
    mcqOptions: [
      '(P)→(1) (Q)→(3) (R)→(5) (S)→(4)',
      '(P)→(2) (Q)→(1) (R)→(3) (S)→(5)',
      '(P)→(2) (Q)→(4) (R)→(5) (S)→(1)',
      '(P)→(2) (Q)→(3) (R)→(5) (S)→(4)'
    ],
    answer: { correctIndex: 1 },
    hints: ['Put $z = x + iy$ and take the imaginary part first.'],
    steps: [
      { h: 'Idea', d: 'The imaginary part fixes $x$; the real part then fixes $|z|$.' },
      { h: 'Imaginary part', d: '$4xy - 4y = 0$ and $y \\ne 0$ give $x = 1$.' },
      { h: 'Real part', d: 'With $r = |z|$ and $y^2 = r^2 - 1$: $r^3 + 2(1 - y^2) + 4 - 8 = r^3 - 2r^2 = 0$, so $r = 2$ and $y^2 = 3$.' },
      { h: 'Values', d: '$|z|^2 = 4$; $|z - \\bar z|^2 = 4y^2 = 12$; $|z|^2 + |2x|^2 = 8$; $|z + 1|^2 = 4 + 3 = 7$.' },
      { h: 'Match', d: '(P)→(2), (Q)→(1), (R)→(3), (S)→(5).' }
    ]
  },

  // ── Paper 2 · Section 1 (single correct) ──
  {
    ...P2, id: 'jeeadv-2023-p2-q1', section: 'Section 1', questionNumber: 1,
    chapterId: 'c12-differential-equations', difficulty: 3, answerType: 'mcq',
    prompt: 'Let $f:[1, \\infty) \\to \\mathbb R$ be a differentiable function such that $f(1) = \\dfrac13$ and $3\\displaystyle\\int_1^x f(t)\\,dt = x\\,f(x) - \\frac{x^3}{3}$, $x \\in [1, \\infty)$. Let $e$ denote the base of the natural logarithm. Then the value of $f(e)$ is',
    mcqOptions: ['$\\dfrac{e^2 + 4}{3}$', '$\\dfrac{\\log_e 4 + e}{3}$', '$\\dfrac{4e^2}{3}$', '$\\dfrac{e^2 - 4}{3}$'],
    answer: { correctIndex: 2 },
    hints: ['Differentiate both sides.'],
    steps: [
      { h: 'Idea', d: 'Differentiating removes the integral and leaves a linear differential equation.' },
      { h: 'Differentiate', d: '$3f = f + xf\' - x^2$, i.e. $xf\' - 2f = x^2$.' },
      { h: 'Solve', d: 'Divide by $x^3$: $\\left(\\dfrac{f}{x^2}\\right)\' = \\dfrac1x$, so $\\dfrac{f}{x^2} = \\log_e x + C$ and $f(1) = \\frac13$ gives $C = \\frac13$.' },
      { h: 'Answer', d: '$f(e) = e^2\\left(1 + \\frac13\\right) = \\dfrac{4e^2}{3}$.' }
    ]
  },
  {
    ...P2, id: 'jeeadv-2023-p2-q2', section: 'Section 1', questionNumber: 2,
    chapterId: 'c12-probability', difficulty: 3, answerType: 'mcq',
    prompt: 'Consider an experiment of tossing a coin repeatedly until the outcomes of two consecutive tosses are same. If the probability of a random toss resulting in head is $\\dfrac13$, then the probability that the experiment stops with head is',
    mcqOptions: ['$\\dfrac13$', '$\\dfrac{5}{21}$', '$\\dfrac{4}{21}$', '$\\dfrac27$'],
    answer: { correctIndex: 1 },
    hints: ['Let $a$ (or $b$) be the chance of ending on $HH$ given the last toss was $H$ (or $T$).'],
    steps: [
      { h: 'Idea', d: 'Only the last toss matters, so two unknowns and two equations.' },
      { h: 'Equations', d: 'With $p = \\frac13$, $q = \\frac23$: $a = p + qb$ and $b = pa$.' },
      { h: 'Solve', d: '$a = \\dfrac{p}{1 - pq} = \\dfrac{1/3}{7/9} = \\dfrac37$ and $b = \\dfrac17$.' },
      { h: 'First toss', d: '$P = pa + qb = \\dfrac17 + \\dfrac{2}{21} = \\dfrac{5}{21}$.' }
    ]
  },
  {
    ...P2, id: 'jeeadv-2023-p2-q3', section: 'Section 1', questionNumber: 3,
    chapterId: 'c12-inverse-trigonometric', difficulty: 4, answerType: 'mcq',
    prompt: 'For any $y \\in \\mathbb R$, let $\\cot^{-1}(y) \\in (0, \\pi)$ and $\\tan^{-1}(y) \\in \\left(-\\dfrac\\pi2, \\dfrac\\pi2\\right)$. Then the sum of all the solutions of the equation $\\tan^{-1}\\left(\\dfrac{6y}{9 - y^2}\\right) + \\cot^{-1}\\left(\\dfrac{9 - y^2}{6y}\\right) = \\dfrac{2\\pi}{3}$ for $0 < |y| < 3$, is equal to',
    mcqOptions: ['$2\\sqrt3 - 3$', '$3 - 2\\sqrt3$', '$4\\sqrt3 - 6$', '$6 - 4\\sqrt3$'],
    answer: { correctIndex: 2 },
    hints: ['$\\cot^{-1}\\frac1A = \\tan^{-1}A$ when $A > 0$, but $\\pi + \\tan^{-1}A$ when $A < 0$.'],
    steps: [
      { h: 'Idea', d: 'Split by the sign of $y$; the $\\cot^{-1}$ branch changes.' },
      { h: '$0 < y < 3$', d: 'Here $A = \\frac{6y}{9 - y^2} > 0$, so the equation is $2\\tan^{-1}A = \\frac{2\\pi}3$: $A = \\sqrt3$, i.e. $y^2 + 2\\sqrt3y - 9 = 0$, giving $y = \\sqrt3$.' },
      { h: '$-3 < y < 0$', d: 'Now $A < 0$ and $\\cot^{-1}\\frac1A = \\pi + \\tan^{-1}A$: $2\\tan^{-1}A = -\\frac\\pi3$, so $A = -\\frac1{\\sqrt3}$, i.e. $y^2 - 6\\sqrt3y - 9 = 0$, giving $y = 3\\sqrt3 - 6$.' },
      { h: 'Sum', d: '$\\sqrt3 + 3\\sqrt3 - 6 = 4\\sqrt3 - 6$.' }
    ]
  },
  {
    ...P2, id: 'jeeadv-2023-p2-q4', section: 'Section 1', questionNumber: 4,
    chapterId: 'c12-vector-algebra', difficulty: 2, answerType: 'mcq',
    prompt: 'Let the position vectors of the points $P, Q, R$ and $S$ be $\\vec a = \\hat\\imath + 2\\hat\\jmath - 5\\hat k$, $\\vec b = 3\\hat\\imath + 6\\hat\\jmath + 3\\hat k$, $\\vec c = \\dfrac{17}{5}\\hat\\imath + \\dfrac{16}{5}\\hat\\jmath + 7\\hat k$ and $\\vec d = 2\\hat\\imath + \\hat\\jmath + \\hat k$, respectively. Then which of the following statements is true?',
    mcqOptions: [
      'The points $P, Q, R$ and $S$ are NOT coplanar',
      '$\\dfrac{\\vec b + 2\\vec d}{3}$ is the position vector of a point which divides $PR$ internally in the ratio $5 : 4$',
      '$\\dfrac{\\vec b + 2\\vec d}{3}$ is the position vector of a point which divides $PR$ externally in the ratio $5 : 4$',
      'The square of the magnitude of the vector $\\vec b \\times \\vec d$ is $95$'
    ],
    answer: { correctIndex: 1 },
    hints: ['Compute $\\frac{\\vec b + 2\\vec d}{3}$ and $\\frac{4\\vec a + 5\\vec c}{9}$.'],
    steps: [
      { h: 'Idea', d: 'Check each option by direct computation.' },
      { h: '(B)', d: '$\\frac{\\vec b + 2\\vec d}{3} = \\left(\\frac73, \\frac83, \\frac53\\right)$ and $\\frac{4\\vec a + 5\\vec c}{9} = \\frac{(21, 24, 15)}{9}$: the same point, dividing $PR$ internally $5 : 4$.' },
      { h: '(A)', d: '$[\\,\\vec b - \\vec a,\\ \\vec c - \\vec a,\\ \\vec d - \\vec a\\,] = 0$, so the points are coplanar (and (B) already puts a point of $QS$ on $PR$).' },
      { h: '(D)', d: '$\\vec b \\times \\vec d = (3, 3, -9)$, with squared length $99$, not $95$.' }
    ]
  },

  // ── Paper 2 · Section 3 (non-negative integer) ──
  {
    ...P2, id: 'jeeadv-2023-p2-q8', section: 'Section 3', questionNumber: 8,
    chapterId: 'c12-applications-derivatives', difficulty: 2, answerType: 'numeric',
    prompt: 'For $x \\in \\mathbb R$, let $\\tan^{-1}(x) \\in \\left(-\\dfrac\\pi2, \\dfrac\\pi2\\right)$. Then the minimum value of the function $f:\\mathbb R \\to \\mathbb R$ defined by $f(x) = \\displaystyle\\int_0^{x\\tan^{-1}x}\\frac{e^{(t - \\cos t)}}{1 + t^{2023}}\\,dt$ is ____.',
    answer: { value: 0 },
    inputHint: 'Enter the integer',
    hints: ['What sign is $x\\tan^{-1}x$?'],
    steps: [
      { h: 'Idea', d: 'The upper limit is never negative and the integrand is positive there.' },
      { h: 'Upper limit', d: '$x$ and $\\tan^{-1}x$ have the same sign, so $x\\tan^{-1}x \\ge 0$, with equality only at $x = 0$.' },
      { h: 'Integrand', d: 'For $t \\ge 0$, $e^{t - \\cos t} > 0$ and $1 + t^{2023} > 0$, so $f(x) \\ge 0$.' },
      { h: 'Answer', d: '$f(0) = 0$, so the minimum is $0$.' }
    ]
  },
  {
    ...P2, id: 'jeeadv-2023-p2-q9', section: 'Section 3', questionNumber: 9,
    chapterId: 'c12-differential-equations', difficulty: 3, answerType: 'numeric',
    prompt: 'For $x \\in \\mathbb R$, let $y(x)$ be a solution of the differential equation $(x^2 - 5)\\dfrac{dy}{dx} - 2xy = -2x(x^2 - 5)^2$ such that $y(2) = 7$. Then the maximum value of the function $y(x)$ is ____.',
    answer: { value: 16 },
    inputHint: 'Enter the integer',
    hints: ['Divide by $(x^2 - 5)^2$: the left side is $\\left(\\frac{y}{x^2 - 5}\\right)\'$.'],
    steps: [
      { h: 'Idea', d: 'The left side is an exact derivative after dividing by $(x^2 - 5)^2$.' },
      { h: 'Integrate', d: '$\\left(\\dfrac{y}{x^2 - 5}\\right)\' = -2x$, so $\\dfrac{y}{x^2 - 5} = -x^2 + C$.' },
      { h: 'Constant', d: '$x = 2$: $\\dfrac{7}{-1} = -4 + C$, so $C = -3$ and $y = -(x^2 - 5)(x^2 + 3)$.' },
      { h: 'Maximise', d: 'With $u = x^2 \\ge 0$: $y = -(u^2 - 2u - 15) = 16 - (u - 1)^2$, largest at $u = 1$: $16$.' }
    ]
  },
  {
    ...P2, id: 'jeeadv-2023-p2-q10', section: 'Section 3', questionNumber: 10,
    chapterId: 'c12-probability', difficulty: 3, answerType: 'numeric',
    prompt: 'Let $X$ be the set of all five digit numbers formed using $1, 2, 2, 2, 4, 4, 0$. For example, $22240$ is in $X$ while $02244$ and $44422$ are not in $X$. Suppose that each element of $X$ has an equal chance of being chosen. Let $p$ be the conditional probability that an element chosen at random is a multiple of $20$ given that it is a multiple of $5$. Then the value of $38p$ is equal to ____.',
    answer: { value: 31 },
    inputHint: 'Enter the integer',
    hints: ['A multiple of $5$ here must end in $0$.'],
    steps: [
      { h: 'Idea', d: 'With no $5$ available, "multiple of $5$" means "ends in $0$", and then "multiple of $20$" means the tens digit is even.' },
      { h: 'Ends in 0', d: 'The first four digits come from $\\{1, 2, 2, 2, 4, 4\\}$. With the $1$: $4$ positions $\\times$ $7$ strings of three from $\\{2,2,2,4,4\\}$ $= 28$. Without it: strings of four $2$s and $4$s with $2$ or $3$ twos: $6 + 4 = 10$. Total $38$.' },
      { h: 'Tens digit odd', d: 'Tens digit $1$: the other three digits form one of $7$ strings. So $38 - 7 = 31$ are multiples of $20$.' },
      { h: 'Answer', d: '$p = \\dfrac{31}{38}$ and $38p = 31$.' }
    ]
  },
  {
    ...P2, id: 'jeeadv-2023-p2-q11', section: 'Section 3', questionNumber: 11,
    chapterId: 'c11-complex-numbers', difficulty: 4, answerType: 'numeric',
    prompt: 'Let $A_1, A_2, A_3, \\ldots, A_8$ be the vertices of a regular octagon that lie on a circle of radius $2$. Let $P$ be a point on the circle and let $PA_i$ denote the distance between the points $P$ and $A_i$ for $i = 1, 2, \\ldots, 8$. If $P$ varies over the circle, then the maximum value of the product $PA_1\\cdot PA_2\\cdots PA_8$, is ____.',
    answer: { value: 512 },
    inputHint: 'Enter the integer',
    hints: ['Put the vertices at the roots of $z^8 = 2^8$.'],
    steps: [
      { h: 'Idea', d: 'The product of distances to the roots of $z^8 = 256$ is $|z^8 - 256|$.' },
      { h: 'Factor', d: 'With $A_k$ the roots of $z^8 - 256$: $\\prod|z - A_k| = |z^8 - 256|$.' },
      { h: 'Maximise', d: 'For $|z| = 2$, $|z^8| = 256$, so $|z^8 - 256| \\le 512$, with equality when $z^8 = -256$.' },
      { h: 'Answer', d: '$512$.' }
    ]
  },
  {
    ...P2, id: 'jeeadv-2023-p2-q12', section: 'Section 3', questionNumber: 12,
    chapterId: 'c12-determinants', difficulty: 3, answerType: 'numeric',
    prompt: 'Let $R = \\left\\{\\begin{pmatrix}a & 3 & b\\\\ c & 2 & d\\\\ 0 & 5 & 0\\end{pmatrix} : a, b, c, d \\in \\{0, 3, 5, 7, 11, 13, 17, 19\\}\\right\\}$. Then the number of invertible matrices in $R$ is ____.',
    answer: { value: 3780 },
    inputHint: 'Enter the integer',
    hints: ['Expand along the third row: $\\det = 5(bc - ad)$.'],
    steps: [
      { h: 'Idea', d: 'Count the singular matrices, where $ad = bc$, and subtract.' },
      { h: 'Determinant', d: 'Along row 3: $\\det = -5(ad - bc)$, so the matrix is singular exactly when $ad = bc$.' },
      { h: 'Products zero', d: '$15$ of the $64$ ordered pairs contain a $0$. Both products zero: $15 \\times 15 = 225$.' },
      { h: 'Products non-zero', d: 'The other entries are distinct primes, so $ad = bc \\ne 0$ needs $\\{a, d\\} = \\{b, c\\}$: $7$ cases with $a = d$, and $42 \\times 2 = 84$ with $a \\ne d$. That is $91$.' },
      { h: 'Answer', d: '$8^4 - 225 - 91 = 4096 - 316 = 3780$.' }
    ]
  },
  {
    ...P2, id: 'jeeadv-2023-p2-q13', section: 'Section 3', questionNumber: 13,
    chapterId: 'c11-conic-sections', difficulty: 4, answerType: 'numeric',
    prompt: 'Let $C_1$ be the circle of radius $1$ with center at the origin. Let $C_2$ be the circle of radius $r$ with center at the point $A = (4, 1)$, where $1 < r < 3$. Two distinct common tangents $PQ$ and $ST$ of $C_1$ and $C_2$ are drawn. The tangent $PQ$ touches $C_1$ at $P$ and $C_2$ at $Q$. The tangent $ST$ touches $C_1$ at $S$ and $C_2$ at $T$. Mid points of the line segments $PQ$ and $ST$ are joined to form a line which meets the $x$-axis at a point $B$. If $AB = \\sqrt5$, then the value of $r^2$ is ____.',
    answer: { value: 2 },
    inputHint: 'Enter $r^2$',
    hints: ['The midpoint of a common tangent segment has equal tangent lengths to both circles.'],
    steps: [
      { h: 'Idea', d: 'Each midpoint is equidistant (in tangent length) from both circles, so it lies on the radical axis.' },
      { h: 'Radical axis', d: '$x^2 + y^2 - 1 = (x - 4)^2 + (y - 1)^2 - r^2$ gives $8x + 2y = 18 - r^2$.' },
      { h: 'Point $B$', d: 'On $y = 0$: $B = \\left(\\dfrac{18 - r^2}{8}, 0\\right)$.' },
      { h: 'Use $AB$', d: '$(4 - x_B)^2 + 1 = 5$ gives $x_B = 2$ or $6$. $x_B = 6$ would need $r^2 < 0$, so $x_B = 2$ and $r^2 = 2$.' }
    ]
  },

  // ── Paper 2 · Section 4 (paragraphs, numerical value) ──
  {
    ...P2, id: 'jeeadv-2023-p2-q14', section: 'Section 4', questionNumber: 14,
    chapterId: 'c11-trig-functions', difficulty: 4, answerType: 'numeric',
    prompt: `${PARA_I}\n\nLet $a$ be the area of the triangle $ABC$. Then the value of $(64a)^2$ is ____.`,
    answer: { value: 1008, tol: 0.01, officialRange: [1007.99, 1008.01] },
    inputHint: 'Enter the value',
    hints: ['With $R = 1$ the sides are $2\\sin A$, $2\\sin B$, $2\\sin C$.'],
    steps: [
      { h: 'Idea', d: 'Express all angles through the smallest one, $C$; the AP condition then gives $\\sin2C$.' },
      { h: 'Angles', d: '$A = C + \\frac\\pi2$, $B = \\frac\\pi2 - 2C$, so $\\sin A = \\cos C$ and $\\sin B = \\cos2C$.' },
      { h: 'AP condition', d: '$2\\sin B = \\sin A + \\sin C$: $2(\\cos C - \\sin C)(\\cos C + \\sin C) = \\cos C + \\sin C$, so $\\cos C - \\sin C = \\frac12$ and $\\sin2C = \\frac34$, $\\cos2C = \\frac{\\sqrt7}{4}$.' },
      { h: 'Area', d: '$a = 2\\sin A\\sin B\\sin C = \\sin2C\\cos2C = \\dfrac{3\\sqrt7}{16}$.' },
      { h: 'Answer', d: '$(64a)^2 = (12\\sqrt7)^2 = 1008$.' }
    ]
  },
  {
    ...P2, id: 'jeeadv-2023-p2-q15', section: 'Section 4', questionNumber: 15,
    chapterId: 'c11-trig-functions', difficulty: 4, answerType: 'numeric',
    prompt: `${PARA_I}\n\nThen the inradius of the triangle $ABC$ is ____.`,
    answer: { value: 0.25, tol: 0.01, officialRange: [0.24, 0.26] },
    inputHint: 'Enter the inradius',
    hints: ['$r = \\dfrac{\\text{area}}{s}$; you need the perimeter.'],
    steps: [
      { h: 'Idea', d: 'Reuse the angles: area $\\frac{3\\sqrt7}{16}$ is known, so only the perimeter is needed.' },
      { h: 'Perimeter', d: '$2(\\sin A + \\sin B + \\sin C) = 2(\\cos C + \\sin C + \\cos2C)$. $(\\cos C + \\sin C)^2 = 1 + \\frac34$ gives $\\frac{\\sqrt7}{2}$, and $\\cos2C = \\frac{\\sqrt7}{4}$, so the perimeter is $\\frac{3\\sqrt7}{2}$.' },
      { h: 'Inradius', d: '$s = \\frac{3\\sqrt7}{4}$, so $r = \\dfrac{3\\sqrt7/16}{3\\sqrt7/4} = \\dfrac14 = 0.25$.' }
    ]
  },
  {
    ...P2, id: 'jeeadv-2023-p2-q16', section: 'Section 4', questionNumber: 16,
    chapterId: 'c12-probability', difficulty: 2, answerType: 'numeric',
    prompt: `${PARA_II}\n\nLet $p_i$ be the probability that a randomly chosen point has $i$ many friends, $i = 0, 1, 2, 3, 4$. Let $X$ be a random variable such that for $i = 0, 1, 2, 3, 4$, the probability $P(X = i) = p_i$. Then the value of $7E(X)$ is ____.`,
    answer: { value: 24, tol: 0.01, officialRange: [23.99, 24.01] },
    inputHint: 'Enter the value',
    hints: ['Corners have $2$ friends, other edge points $3$, interior points $4$.'],
    steps: [
      { h: 'Idea', d: 'Classify the $49$ grid points by position.' },
      { h: 'Count', d: '$4$ corners (2 friends), $4 \\times 5 = 20$ other edge points (3), $5 \\times 5 = 25$ interior points (4).' },
      { h: 'Mean', d: '$E(X) = \\dfrac{8 + 60 + 100}{49} = \\dfrac{168}{49} = \\dfrac{24}{7}$, so $7E(X) = 24$.' }
    ]
  },
  {
    ...P2, id: 'jeeadv-2023-p2-q17', section: 'Section 4', questionNumber: 17,
    chapterId: 'c11-probability', difficulty: 2, answerType: 'numeric',
    prompt: `${PARA_II}\n\nTwo distinct points are chosen randomly out of the points $A_1, A_2, \\ldots, A_{49}$. Let $p$ be the probability that they are friends. Then the value of $7p$ is ____.`,
    answer: { value: 0.5, tol: 0.01, officialRange: [0.49, 0.51] },
    inputHint: 'Enter the value',
    hints: ['A pair of friends is a unit segment of the grid.'],
    steps: [
      { h: 'Idea', d: 'Friend pairs are the unit edges of the grid.' },
      { h: 'Edges', d: '$7$ rows of $6$ horizontal edges and $7$ columns of $6$ vertical edges: $84$.' },
      { h: 'Answer', d: '$p = \\dfrac{84}{\\binom{49}{2}} = \\dfrac{84}{1176} = \\dfrac1{14}$, so $7p = 0.5$.' }
    ]
  }
]);
