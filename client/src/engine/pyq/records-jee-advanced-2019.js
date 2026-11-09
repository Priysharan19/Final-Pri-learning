// Pri Learning · JEE Advanced 2019 · Mathematics (Papers 1 and 2)
//
// For 2019 the Joint Admission Board published the question paper and the
// final answer key as separate documents, so each record cites the paper for
// its prompt and the key for its answer (pyqSources.js: jeeadv-2019-p1-*,
// jeeadv-2019-p2-*). The paper PDFs are page images; every prompt was read
// from the rendered page. Worked steps are Pri Learning's own.
//
// Pending (one-or-more-correct, no archive contract yet): Paper 1 Q5–Q12,
// Paper 2 Q1–Q8.
//
// Left out after cross-checking: Paper 2 Q11 (ordered pairs of independent
// events with 1 ≤ |B| < |A|). The official final key, an exhaustive count and
// Resonance's solution all give 422, but the owner's reference book (and
// Aakash's key) print 1523. The owner's rule is that a disagreement among the
// sources keeps a question out, so it is out and logged in the PR.

import { PYQ_PROVENANCE } from './pyqSources.js';

const P1 = Object.freeze({
  examId: 'jee-advanced', year: 2019, paper: '1',
  provenance: PYQ_PROVENANCE.OFFICIAL_PAPER_AND_KEY, pastPaper: true,
  promptSource: 'jeeadv-2019-p1-questions', answerSource: 'jeeadv-2019-p1-key'
});
const P2 = Object.freeze({
  examId: 'jee-advanced', year: 2019, paper: '2',
  provenance: PYQ_PROVENANCE.OFFICIAL_PAPER_AND_KEY, pastPaper: true,
  promptSource: 'jeeadv-2019-p2-questions', answerSource: 'jeeadv-2019-p2-key'
});

const PARA_TRIG = 'Let $f(x) = \\sin(\\pi\\cos x)$ and $g(x) = \\cos(2\\pi\\sin x)$ be two functions defined for $x > 0$. Define the following sets whose elements are written in the increasing order:\n\n$X = \\{x : f(x) = 0\\}$, $Y = \\{x : f\'(x) = 0\\}$, $Z = \\{x : g(x) = 0\\}$, $W = \\{x : g\'(x) = 0\\}$.\n\nList-I contains the sets $X, Y, Z$ and $W$. List-II contains some information regarding these sets.\n\nList-I: (I) $X$; (II) $Y$; (III) $Z$; (IV) $W$.\n\nList-II: (P) $\\supseteq\\left\\{\\frac\\pi2, \\frac{3\\pi}2, 4\\pi, 7\\pi\\right\\}$; (Q) an arithmetic progression; (R) NOT an arithmetic progression; (S) $\\supseteq\\left\\{\\frac\\pi6, \\frac{7\\pi}6, \\frac{13\\pi}6\\right\\}$; (T) $\\supseteq\\left\\{\\frac\\pi3, \\frac{2\\pi}3, \\pi\\right\\}$; (U) $\\supseteq\\left\\{\\frac\\pi6, \\frac{3\\pi}4\\right\\}$.';
const PARA_CIRCLES = 'Let the circles $C_1: x^2 + y^2 = 9$ and $C_2: (x - 3)^2 + (y - 4)^2 = 16$, intersect at the points $X$ and $Y$. Suppose that another circle $C_3: (x - h)^2 + (y - k)^2 = r^2$ satisfies the following conditions:\n(i) centre of $C_3$ is collinear with the centres of $C_1$ and $C_2$,\n(ii) $C_1$ and $C_2$ both lie inside $C_3$, and\n(iii) $C_3$ touches $C_1$ at $M$ and $C_2$ at $N$.\n\nLet the line through $X$ and $Y$ intersect $C_3$ at $Z$ and $W$, and let a common tangent of $C_1$ and $C_3$ be a tangent to the parabola $x^2 = 8\\alpha y$.\n\nList-I: (I) $2h + k$; (II) $\\dfrac{\\text{Length of } ZW}{\\text{Length of } XY}$; (III) $\\dfrac{\\text{Area of triangle } MZN}{\\text{Area of triangle } ZMW}$; (IV) $\\alpha$.\n\nList-II: (P) $6$; (Q) $\\sqrt6$; (R) $\\dfrac54$; (S) $\\dfrac{21}{5}$; (T) $2\\sqrt6$; (U) $\\dfrac{10}{3}$.';

const CIRCLES_SOLVED = [
  { h: 'The big circle', d: '$C_1$ (centre $O$, radius $3$) and $C_2$ (centre $(3,4)$, radius $4$) have centres $5$ apart. $C_3$ touches both from outside along the line of centres, so $MN$ is a diameter: $M = -\\frac35(3, 4)$, $N = (3,4) + \\frac45(3,4)$, $MN = 3 + 5 + 4 = 12$, $r = 6$, centre $\\left(\\frac95, \\frac{12}5\\right)$. So $2h + k = 6$.' },
  { h: 'The chords', d: 'The common chord $XY$ is $3x + 4y = 9$, at distance $\\frac95$ from $O$: $XY = 2\\sqrt{9 - \\frac{81}{25}} = \\frac{24}5$. It is $\\frac65$ from $C_3$\'s centre: $ZW = 2\\sqrt{36 - \\frac{36}{25}} = \\frac{24\\sqrt6}{5}$. Ratio $\\sqrt6$.' },
  { h: 'The areas', d: '$Z$ is $\\frac{12\\sqrt6}{5}$ from line $MN$, so $[MZN] = \\frac12\\cdot12\\cdot\\frac{12\\sqrt6}5$. $M$ is $\\frac{24}5$ from line $ZW$, so $[ZMW] = \\frac12\\cdot\\frac{24\\sqrt6}5\\cdot\\frac{24}5$. Ratio $\\frac54$.' },
  { h: 'The parabola', d: 'The common tangent at $M$ is $3x + 4y = -15$. Substituting into $x^2 = 8\\alpha y$: $x^2 + 6\\alpha x + 30\\alpha = 0$, tangent when $36\\alpha^2 = 120\\alpha$, so $\\alpha = \\frac{10}3$.' }
];

export const JEE_ADVANCED_2019_RECORDS = Object.freeze([
  // ── Paper 1 · Section 1 (single correct) ──
  {
    ...P1, id: 'jeeadv-2019-p1-q1', section: 'Section 1', questionNumber: 1,
    chapterId: 'c11-complex-numbers', difficulty: 4, answerType: 'mcq',
    prompt: 'Let $S$ be the set of all complex numbers $z$ satisfying $|z - 2 + i| \\ge \\sqrt5$. If the complex number $z_0$ is such that $\\dfrac{1}{|z_0 - 1|}$ is the maximum of the set $\\left\\{\\dfrac{1}{|z - 1|} : z \\in S\\right\\}$, then the principal argument of $\\dfrac{4 - z_0 - \\bar z_0}{z_0 - \\bar z_0 + 2i}$ is',
    mcqOptions: ['$-\\dfrac\\pi2$', '$\\dfrac\\pi4$', '$\\dfrac\\pi2$', '$\\dfrac{3\\pi}4$'],
    answer: { correctIndex: 0 },
    hints: ['$S$ is the outside of a circle; the point $1$ lies inside it.'],
    steps: [
      { h: 'Idea', d: 'Maximising $\\frac1{|z - 1|}$ means finding the point of $S$ nearest to $1$; you only need the signs of its coordinates.' },
      { h: 'The nearest point', d: '$S$ is the region outside the circle with centre $2 - i$ and radius $\\sqrt5$. The point $1$ is inside (distance $\\sqrt2$), so $z_0 = x + iy$ is on the circle, on the ray from $2 - i$ through $1$: $x < 1$ and $y > -1$.' },
      { h: 'Simplify', d: '$\\dfrac{4 - z_0 - \\bar z_0}{z_0 - \\bar z_0 + 2i} = \\dfrac{2(2 - x)}{2i(y + 1)} = -i\\,\\dfrac{2 - x}{y + 1}$.' },
      { h: 'Argument', d: '$\\frac{2 - x}{y + 1} > 0$, so the number is on the negative imaginary axis: argument $-\\frac\\pi2$.' }
    ]
  },
  {
    ...P1, id: 'jeeadv-2019-p1-q2', section: 'Section 1', questionNumber: 2,
    chapterId: 'c12-matrices', difficulty: 4, answerType: 'mcq',
    prompt: 'Let\n\n$M = \\begin{bmatrix}\\sin^4\\theta & -1 - \\sin^2\\theta\\\\ 1 + \\cos^2\\theta & \\cos^4\\theta\\end{bmatrix} = \\alpha I + \\beta M^{-1},$\n\nwhere $\\alpha = \\alpha(\\theta)$ and $\\beta = \\beta(\\theta)$ are real numbers, and $I$ is the $2 \\times 2$ identity matrix. If $\\alpha^*$ is the minimum of the set $\\{\\alpha(\\theta) : \\theta \\in [0, 2\\pi)\\}$ and $\\beta^*$ is the minimum of the set $\\{\\beta(\\theta) : \\theta \\in [0, 2\\pi)\\}$, then the value of $\\alpha^* + \\beta^*$ is',
    mcqOptions: ['$-\\dfrac{37}{16}$', '$-\\dfrac{31}{16}$', '$-\\dfrac{29}{16}$', '$-\\dfrac{17}{16}$'],
    answer: { correctIndex: 2 },
    hints: ['Cayley–Hamilton: $M^2 - (\\operatorname{tr}M)M + (\\det M)I = 0$.'],
    steps: [
      { h: 'Idea', d: 'Cayley–Hamilton gives $M = (\\operatorname{tr}M)I - (\\det M)M^{-1}$, so $\\alpha = \\operatorname{tr}M$ and $\\beta = -\\det M$.' },
      { h: 'Trace and determinant', d: 'With $t = \\sin^2\\theta\\cos^2\\theta \\in \\left[0, \\frac14\\right]$: $\\operatorname{tr}M = \\sin^4\\theta + \\cos^4\\theta = 1 - 2t$, and $\\det M = t^2 + (1 + \\sin^2\\theta)(1 + \\cos^2\\theta) = t^2 + t + 2$.' },
      { h: 'Minima', d: '$\\alpha = 1 - 2t \\ge \\frac12$; $\\beta = -(t^2 + t + 2) \\ge -\\frac{37}{16}$; both minima occur at $t = \\frac14$.' },
      { h: 'Answer', d: '$\\frac12 - \\frac{37}{16} = -\\dfrac{29}{16}$.' }
    ]
  },
  {
    ...P1, id: 'jeeadv-2019-p1-q3', section: 'Section 1', questionNumber: 3,
    chapterId: 'c11-conic-sections', difficulty: 3, answerType: 'mcq',
    prompt: 'A line $y = mx + 1$ intersects the circle $(x - 3)^2 + (y + 2)^2 = 25$ at the points $P$ and $Q$. If the midpoint of the line segment $PQ$ has $x$-coordinate $-\\dfrac35$, then which one of the following options is correct?',
    mcqOptions: ['$-3 \\le m < -1$', '$2 \\le m < 4$', '$4 \\le m < 6$', '$6 \\le m < 8$'],
    answer: { correctIndex: 1 },
    hints: ['The midpoint\'s $x$-coordinate is half the sum of the roots of the substituted quadratic.'],
    steps: [
      { h: 'Idea', d: 'Substitute the line into the circle and use the sum of roots.' },
      { h: 'Quadratic', d: '$(x - 3)^2 + (mx + 3)^2 = 25$ gives $(1 + m^2)x^2 + 6(m - 1)x - 7 = 0$.' },
      { h: 'Midpoint', d: '$\\dfrac{x_1 + x_2}{2} = -\\dfrac{3(m - 1)}{1 + m^2} = -\\dfrac35$, so $m^2 - 5m + 6 = 0$: $m = 2$ or $3$.' },
      { h: 'Answer', d: 'Both lie in $2 \\le m < 4$.' }
    ]
  },
  {
    ...P1, id: 'jeeadv-2019-p1-q4', section: 'Section 1', questionNumber: 4,
    chapterId: 'c12-applications-integrals', difficulty: 3, answerType: 'mcq',
    prompt: 'The area of the region $\\{(x, y) : xy \\le 8,\\ 1 \\le y \\le x^2\\}$ is',
    mcqOptions: ['$16\\log_e 2 - \\dfrac{14}{3}$', '$8\\log_e 2 - \\dfrac{14}{3}$', '$16\\log_e 2 - 6$', '$8\\log_e 2 - \\dfrac73$'],
    answer: { correctIndex: 0 },
    hints: ['The bounded region is in $x > 0$; slice it horizontally.'],
    steps: [
      { h: 'Idea', d: 'For $x < 0$ the condition $xy \\le 8$ always holds, so that part is unbounded; the finite area the question asks for is the part with $x > 0$, between $y = x^2$ and $xy = 8$.' },
      { h: 'Where the curves meet', d: '$x\\cdot x^2 = 8$ gives $x = 2$, $y = 4$.' },
      { h: 'Slice in $y$', d: 'For $1 \\le y \\le 4$: $\\sqrt y \\le x \\le \\frac8y$. Area $= \\displaystyle\\int_1^4\\left(\\frac8y - \\sqrt y\\right)dy$.' },
      { h: 'Answer', d: '$8\\log_e 4 - \\frac23(8 - 1) = 16\\log_e 2 - \\dfrac{14}{3}$.' }
    ]
  },

  // ── Paper 1 · Section 3 (numerical value) ──
  {
    ...P1, id: 'jeeadv-2019-p1-q13', section: 'Section 3', questionNumber: 13,
    chapterId: 'c11-complex-numbers', difficulty: 3, answerType: 'numeric',
    prompt: 'Let $\\omega \\ne 1$ be a cube root of unity. Then the minimum of the set\n\n$\\left\\{|a + b\\omega + c\\omega^2|^2 : a, b, c \\text{ distinct non-zero integers}\\right\\}$\n\nequals ____.',
    answer: { value: 3 },
    inputHint: 'Enter the value',
    hints: ['$|a + b\\omega + c\\omega^2|^2 = \\frac12\\left[(a - b)^2 + (b - c)^2 + (c - a)^2\\right]$.'],
    steps: [
      { h: 'Idea', d: 'Write the modulus squared as half a sum of squared differences, then make the differences as small as distinct integers allow.' },
      { h: 'Expand', d: 'Using $\\bar\\omega = \\omega^2$ and $\\omega + \\omega^2 = -1$: $|a + b\\omega + c\\omega^2|^2 = a^2 + b^2 + c^2 - ab - bc - ca$.' },
      { h: 'Rewrite', d: 'That equals $\\frac12\\left[(a - b)^2 + (b - c)^2 + (c - a)^2\\right]$.' },
      { h: 'Minimise', d: 'Distinct integers have differences of at least $1, 1, 2$ in some order, giving $\\frac12(1 + 1 + 4) = 3$, attained at $a, b, c = 1, 2, 3$.' }
    ]
  },
  {
    ...P1, id: 'jeeadv-2019-p1-q14', section: 'Section 3', questionNumber: 14,
    chapterId: 'c11-sequences-series', difficulty: 3, answerType: 'numeric',
    prompt: 'Let $AP(a; d)$ denote the set of all the terms of an infinite arithmetic progression with first term $a$ and common difference $d > 0$. If\n\n$AP(1; 3) \\cap AP(2; 5) \\cap AP(3; 7) = AP(a; d)$\n\nthen $a + d$ equals ____.',
    answer: { value: 157 },
    inputHint: 'Enter the value',
    hints: ['Find the smallest number that is $1 \\bmod 3$, $2 \\bmod 5$ and $3 \\bmod 7$.'],
    steps: [
      { h: 'Idea', d: 'The common terms form an AP whose difference is $\\operatorname{lcm}(3, 5, 7) = 105$, starting at the first common term.' },
      { h: 'First common term', d: 'We need $x \\equiv 1 \\pmod 3$, $x \\equiv 2 \\pmod 5$, $x \\equiv 3 \\pmod 7$, with $x \\ge 3$. Checking $3, 10, 17, 24, \\ldots$ (the third AP) gives $52$: $52 = 1 + 3\\cdot17 = 2 + 5\\cdot10$.' },
      { h: 'Answer', d: '$a = 52$, $d = 105$, so $a + d = 157$.' }
    ]
  },
  {
    ...P1, id: 'jeeadv-2019-p1-q15', section: 'Section 3', questionNumber: 15,
    chapterId: 'c12-probability', difficulty: 3, answerType: 'numeric',
    prompt: 'Let $S$ be the sample space of all $3 \\times 3$ matrices with entries from the set $\\{0, 1\\}$. Let the events $E_1$ and $E_2$ be given by\n\n$E_1 = \\{A \\in S : \\det A = 0\\}$ and $E_2 = \\{A \\in S : \\text{sum of entries of } A \\text{ is } 7\\}$.\n\nIf a matrix is chosen at random from $S$, then the conditional probability $P(E_1 \\mid E_2)$ equals ____.',
    answer: { value: 0.5 },
    inputHint: 'Enter the probability',
    hints: ['A matrix in $E_2$ has exactly two zeros.'],
    steps: [
      { h: 'Idea', d: 'Count where the two zeros sit.' },
      { h: 'Size of $E_2$', d: 'Seven $1$s and two $0$s: $\\binom92 = 36$ matrices.' },
      { h: 'Singular ones', d: 'If both zeros are in one row, the other two rows are both $(1, 1, 1)$: singular. The same holds for one column. That is $9 + 9 = 18$ matrices.' },
      { h: 'The rest', d: 'With the zeros in different rows and columns the matrix is a permuted copy of $\\begin{bmatrix}0&1&1\\\\1&0&1\\\\1&1&1\\end{bmatrix}$, whose determinant is $1$.' },
      { h: 'Answer', d: '$P(E_1 \\mid E_2) = \\frac{18}{36} = 0.5$.' }
    ]
  },
  {
    ...P1, id: 'jeeadv-2019-p1-q16', section: 'Section 3', questionNumber: 16,
    chapterId: 'c11-straight-lines', difficulty: 3, answerType: 'numeric',
    prompt: 'Let the point $B$ be the reflection of the point $A(2, 3)$ with respect to the line $8x - 6y - 23 = 0$. Let $\\Gamma_A$ and $\\Gamma_B$ be circles of radii $2$ and $1$ with centres $A$ and $B$ respectively. Let $T$ be a common tangent to the circles $\\Gamma_A$ and $\\Gamma_B$ such that both the circles are on the same side of $T$. If $C$ is the point of intersection of $T$ and the line passing through $A$ and $B$, then the length of the line segment $AC$ is ____.',
    answer: { value: 10 },
    inputHint: 'Enter the length',
    hints: ['A direct common tangent meets the line of centres at the external centre of similitude.'],
    steps: [
      { h: 'Idea', d: '$C$ divides $AB$ externally in the ratio of the radii, $2 : 1$.' },
      { h: 'Reflect $A$', d: '$8(2) - 6(3) - 23 = -25$, so $B = (2, 3) - 2\\cdot\\frac{-25}{100}(8, -6) = (6, 0)$ and $AB = 5$.' },
      { h: 'Similar triangles', d: 'The radii to the tangent points are parallel, so $\\dfrac{CA}{CB} = \\dfrac21$ with $C$ beyond $B$: $CA = 2(CA - 5)$.' },
      { h: 'Answer', d: '$AC = 10$.' }
    ]
  },
  {
    ...P1, id: 'jeeadv-2019-p1-q17', section: 'Section 3', questionNumber: 17,
    chapterId: 'c12-integrals', difficulty: 3, answerType: 'numeric',
    prompt: 'If\n\n$I = \\dfrac2\\pi\\displaystyle\\int_{-\\pi/4}^{\\pi/4}\\frac{dx}{(1 + e^{\\sin x})(2 - \\cos2x)}$\n\nthen $27I^2$ equals ____.',
    answer: { value: 4 },
    inputHint: 'Enter the value',
    hints: ['Add the integral to itself with $x \\to -x$.'],
    steps: [
      { h: 'Idea', d: 'Under $x \\to -x$, $\\frac{1}{1 + e^{\\sin x}}$ becomes $\\frac{e^{\\sin x}}{1 + e^{\\sin x}}$; the two add to $1$.' },
      { h: 'Symmetrise', d: '$I = \\dfrac2\\pi\\cdot\\dfrac12\\displaystyle\\int_{-\\pi/4}^{\\pi/4}\\frac{dx}{2 - \\cos2x} = \\frac2\\pi\\int_0^{\\pi/4}\\frac{dx}{1 + 2\\sin^2x}$.' },
      { h: 'Substitute', d: 'Divide by $\\cos^2x$ and put $t = \\tan x$: $\\displaystyle\\int_0^1\\frac{dt}{1 + 3t^2} = \\frac{1}{\\sqrt3}\\cdot\\frac\\pi3$.' },
      { h: 'Answer', d: '$I = \\dfrac{2}{3\\sqrt3}$, so $27I^2 = 27\\cdot\\dfrac{4}{27} = 4$.' }
    ]
  },
  {
    ...P1, id: 'jeeadv-2019-p1-q18', section: 'Section 3', questionNumber: 18,
    chapterId: 'c12-vector-algebra', difficulty: 2, answerType: 'numeric',
    prompt: 'Three lines are given by\n\n$\\vec r = \\lambda\\hat\\imath$, $\\lambda \\in \\mathbb R$,\n$\\vec r = \\mu(\\hat\\imath + \\hat\\jmath)$, $\\mu \\in \\mathbb R$ and\n$\\vec r = v(\\hat\\imath + \\hat\\jmath + \\hat k)$, $v \\in \\mathbb R$.\n\nLet the lines cut the plane $x + y + z = 1$ at the points $A, B$ and $C$ respectively. If the area of the triangle $ABC$ is $\\Delta$ then the value of $(6\\Delta)^2$ equals ____.',
    answer: { value: 0.75 },
    inputHint: 'Enter the value',
    hints: ['Find $A$, $B$, $C$, then use half the cross product.'],
    steps: [
      { h: 'Idea', d: 'Three points, then the cross-product area formula.' },
      { h: 'Points', d: '$A = (1, 0, 0)$, $B = \\left(\\frac12, \\frac12, 0\\right)$, $C = \\left(\\frac13, \\frac13, \\frac13\\right)$.' },
      { h: 'Cross product', d: '$\\overrightarrow{AB}\\times\\overrightarrow{AC} = \\left(-\\frac12, \\frac12, 0\\right)\\times\\left(-\\frac23, \\frac13, \\frac13\\right) = \\left(\\frac16, \\frac16, \\frac16\\right)$, of length $\\frac{\\sqrt3}{6}$.' },
      { h: 'Answer', d: '$\\Delta = \\frac{\\sqrt3}{12}$, so $(6\\Delta)^2 = \\frac34 = 0.75$.' }
    ]
  },

  // ── Paper 2 · Section 2 (numerical value) ──
  {
    ...P2, id: 'jeeadv-2019-p2-q9', section: 'Section 2', questionNumber: 9,
    chapterId: 'c11-binomial-theorem', difficulty: 4, answerType: 'numeric',
    prompt: 'Suppose\n\n$\\det\\begin{bmatrix}\\displaystyle\\sum_{k=0}^{n}k & \\displaystyle\\sum_{k=0}^{n}{}^nC_k\\,k^2\\\\ \\displaystyle\\sum_{k=0}^{n}{}^nC_k\\,k & \\displaystyle\\sum_{k=0}^{n}{}^nC_k\\,3^k\\end{bmatrix} = 0$\n\nholds for some positive integer $n$. Then $\\displaystyle\\sum_{k=0}^{n}\\frac{{}^nC_k}{k + 1}$ equals ____.',
    answer: { value: 6.2 },
    inputHint: 'Enter the value',
    hints: ['Each entry has a closed form; the determinant then fixes $n$.'],
    steps: [
      { h: 'Idea', d: 'Evaluate the four standard binomial sums, solve for $n$, then use $\\sum\\frac{{}^nC_k}{k + 1} = \\frac{2^{n+1} - 1}{n + 1}$.' },
      { h: 'Entries', d: '$\\sum k = \\frac{n(n + 1)}2$, $\\sum{}^nC_k k = n2^{n-1}$, $\\sum{}^nC_k k^2 = n(n + 1)2^{n-2}$, $\\sum{}^nC_k3^k = 4^n$.' },
      { h: 'Determinant', d: '$\\frac{n(n + 1)}2 4^n - n(n + 1)2^{n-2}\\cdot n2^{n-1} = n(n + 1)4^n\\left(\\frac12 - \\frac n8\\right) = 0$ gives $n = 4$.' },
      { h: 'Answer', d: '$\\displaystyle\\sum_{k=0}^4\\frac{{}^4C_k}{k + 1} = \\frac{2^5 - 1}{5} = 6.2$.' }
    ]
  },
  {
    ...P2, id: 'jeeadv-2019-p2-q10', section: 'Section 2', questionNumber: 10,
    chapterId: 'c11-permutations-combinations', difficulty: 3, answerType: 'numeric',
    prompt: 'Five persons $A, B, C, D$ and $E$ are seated in a circular arrangement. If each of them is given a hat of one of the three colours red, blue and green, then the number of ways of distributing the hats such that the persons seated in adjacent seats get different coloured hats is ____.',
    answer: { value: 30 },
    inputHint: 'Enter the number of ways',
    hints: ['With $5$ people and $3$ colours, some colour is used exactly once.'],
    steps: [
      { h: 'Idea', d: 'Adjacent hats differ around a $5$-cycle, so no colour can appear $3$ times; the counts must be $2, 2, 1$.' },
      { h: 'Single colour', d: 'Choose the colour used once ($3$ ways) and its wearer ($5$ ways).' },
      { h: 'The rest', d: 'The other four people form a path; it must alternate between the two remaining colours, and there are $2$ ways to start.' },
      { h: 'Answer', d: '$3 \\times 5 \\times 2 = 30$.' }
    ]
  },
  {
    ...P2, id: 'jeeadv-2019-p2-q12', section: 'Section 2', questionNumber: 12,
    chapterId: 'c12-inverse-trigonometric', difficulty: 4, answerType: 'numeric',
    prompt: 'The value of\n\n$\\sec^{-1}\\left(\\dfrac14\\displaystyle\\sum_{k=0}^{10}\\sec\\left(\\frac{7\\pi}{12} + \\frac{k\\pi}2\\right)\\sec\\left(\\frac{7\\pi}{12} + \\frac{(k + 1)\\pi}2\\right)\\right)$\n\nin the interval $\\left[-\\dfrac\\pi4, \\dfrac{3\\pi}4\\right]$ equals ____.',
    answer: { value: 0 },
    inputHint: 'Enter the value',
    hints: ['Consecutive angles differ by $\\frac\\pi2$, so each product is $-\\sec\\theta\\csc\\theta$ up to sign.'],
    steps: [
      { h: 'Idea', d: 'Each term is $\\pm\\frac{2}{\\sin2\\theta}$ and the signs settle into a pattern.' },
      { h: 'One term', d: 'With $\\theta_k = \\frac{7\\pi}{12} + \\frac{k\\pi}2$: $\\sec\\theta_k\\sec\\left(\\theta_k + \\frac\\pi2\\right) = -\\dfrac{1}{\\cos\\theta_k\\sin\\theta_k} = -\\dfrac{2}{\\sin2\\theta_k}$.' },
      { h: 'Values', d: '$\\sin2\\theta_k = \\sin\\left(\\frac{7\\pi}6 + k\\pi\\right) = (-1)^{k+1}\\frac12$, so each term is $(-1)^k\\cdot4$.' },
      { h: 'Sum', d: 'Eleven terms alternating $4, -4, \\ldots, 4$ sum to $4$, so the argument is $\\frac14\\cdot4 = 1$.' },
      { h: 'Answer', d: '$\\sec^{-1}1 = 0$, which lies in the given interval.' }
    ]
  },
  {
    ...P2, id: 'jeeadv-2019-p2-q13', section: 'Section 2', questionNumber: 13,
    chapterId: 'c12-integrals', difficulty: 3, answerType: 'numeric',
    prompt: 'The value of the integral\n\n$\\displaystyle\\int_0^{\\pi/2}\\frac{3\\sqrt{\\cos\\theta}}{\\left(\\sqrt{\\cos\\theta} + \\sqrt{\\sin\\theta}\\right)^5}\\,d\\theta$\n\nequals ____.',
    answer: { value: 0.5 },
    inputHint: 'Enter the value',
    hints: ['Divide top and bottom by $(\\cos\\theta)^{5/2}$ and put $t = \\sqrt{\\tan\\theta}$.'],
    steps: [
      { h: 'Idea', d: 'Dividing by $\\cos^{5/2}\\theta$ leaves $\\sec^2\\theta$ and a function of $\\tan\\theta$.' },
      { h: 'Rewrite', d: 'The integrand is $\\dfrac{3\\sec^2\\theta}{\\left(1 + \\sqrt{\\tan\\theta}\\right)^5}$.' },
      { h: 'Substitute', d: 'With $t = \\sqrt{\\tan\\theta}$, $\\sec^2\\theta\\,d\\theta = 2t\\,dt$: $\\displaystyle\\int_0^\\infty\\frac{6t\\,dt}{(1 + t)^5}$.' },
      { h: 'Integrate', d: 'Write $6t = 6(1 + t) - 6$: $6\\left(\\frac13 - \\frac14\\right) = \\frac12$.' }
    ]
  },
  {
    ...P2, id: 'jeeadv-2019-p2-q14', section: 'Section 2', questionNumber: 14,
    chapterId: 'c12-vector-algebra', difficulty: 3, answerType: 'numeric',
    prompt: 'Let $\\vec a = 2\\hat\\imath + \\hat\\jmath - \\hat k$ and $\\vec b = \\hat\\imath + 2\\hat\\jmath + \\hat k$ be two vectors. Consider a vector $\\vec c = \\alpha\\vec a + \\beta\\vec b$, $\\alpha, \\beta \\in \\mathbb R$. If the projection of $\\vec c$ on the vector $(\\vec a + \\vec b)$ is $3\\sqrt2$, then the minimum value of $\\left(\\vec c - (\\vec a \\times \\vec b)\\right)\\cdot\\vec c$ equals ____.',
    answer: { value: 18 },
    inputHint: 'Enter the value',
    hints: ['$\\vec c$ lies in the plane of $\\vec a, \\vec b$, so $(\\vec a \\times \\vec b)\\cdot\\vec c = 0$.'],
    steps: [
      { h: 'Idea', d: 'The expression is just $|\\vec c|^2$; minimise it under the projection condition.' },
      { h: 'Projection', d: '$\\vec a + \\vec b = (3, 3, 0)$ and $\\vec c = (2\\alpha + \\beta, \\alpha + 2\\beta, \\beta - \\alpha)$: $\\dfrac{9(\\alpha + \\beta)}{3\\sqrt2} = 3\\sqrt2$ gives $\\alpha + \\beta = 2$.' },
      { h: 'Length', d: '$|\\vec c|^2 = 6(\\alpha^2 + \\beta^2 + \\alpha\\beta) = 6\\left((\\alpha + \\beta)^2 - \\alpha\\beta\\right) = 6(4 - \\alpha\\beta)$.' },
      { h: 'Minimise', d: 'With $\\alpha + \\beta = 2$, $\\alpha\\beta \\le 1$, so the minimum is $6\\cdot3 = 18$.' }
    ]
  },

  // ── Paper 2 · Section 3 (list-match, single correct) ──
  {
    ...P2, id: 'jeeadv-2019-p2-q15', section: 'Section 3', questionNumber: 15,
    chapterId: 'c11-trig-functions', difficulty: 4, answerType: 'mcq',
    prompt: `${PARA_TRIG}\n\nWhich of the following is the only CORRECT combination?\n\n(Question 15 of the paper; it shares this paragraph with Question 16.)`,
    mcqOptions: ['(I), (P), (R)', '(II), (Q), (T)', '(I), (Q), (U)', '(II), (R), (S)'],
    answer: { correctIndex: 1 },
    hints: ['$f = 0$ needs $\\cos x \\in \\{-1, 0, 1\\}$; $f\' = 0$ also allows $\\cos x = \\pm\\frac12$.'],
    steps: [
      { h: 'Set $X$', d: '$\\sin(\\pi\\cos x) = 0 \\iff \\cos x \\in \\{-1, 0, 1\\} \\iff x = \\frac{k\\pi}2$: an AP containing $\\frac\\pi2, \\frac{3\\pi}2, 4\\pi, 7\\pi$.' },
      { h: 'Set $Y$', d: '$f\'(x) = -\\pi\\sin x\\cos(\\pi\\cos x) = 0 \\iff \\sin x = 0$ or $\\cos x = \\pm\\frac12$, i.e. $x = \\frac{k\\pi}{3}$: an AP containing $\\frac\\pi3, \\frac{2\\pi}3, \\pi$.' },
      { h: 'Check the options', d: '(A) says $X$ is not an AP; (C) needs $\\frac\\pi6 \\in X$; (D) says $Y$ is not an AP. Only (B) — $Y$ is an AP and contains $\\frac\\pi3, \\frac{2\\pi}3, \\pi$ — is correct.' }
    ]
  },
  {
    ...P2, id: 'jeeadv-2019-p2-q16', section: 'Section 3', questionNumber: 16,
    chapterId: 'c11-trig-functions', difficulty: 4, answerType: 'mcq',
    prompt: `${PARA_TRIG}\n\nWhich of the following is the only CORRECT combination?\n\n(Question 16 of the paper; it shares this paragraph with Question 15.)`,
    mcqOptions: ['(III), (R), (U)', '(IV), (P), (R), (S)', '(III), (P), (Q), (U)', '(IV), (Q), (T)'],
    answer: { correctIndex: 1 },
    hints: ['$g = 0$ needs $\\sin x = \\pm\\frac14$ or $\\pm\\frac34$; $g\' = 0$ needs $\\sin x \\in \\{0, \\pm\\frac12, \\pm1\\}$.'],
    steps: [
      { h: 'Set $Z$', d: '$\\cos(2\\pi\\sin x) = 0 \\iff \\sin x \\in \\left\\{\\pm\\frac14, \\pm\\frac34\\right\\}$: not an AP, and $\\frac\\pi6 \\notin Z$.' },
      { h: 'Set $W$', d: '$g\'(x) = -2\\pi\\cos x\\sin(2\\pi\\sin x) = 0 \\iff \\sin x \\in \\left\\{0, \\pm\\frac12, \\pm1\\right\\}$, so $W = \\left\\{\\frac\\pi6, \\frac\\pi2, \\frac{5\\pi}6, \\pi, \\ldots\\right\\}$.' },
      { h: 'Properties of $W$', d: 'Gaps $\\frac\\pi3, \\frac\\pi3, \\frac\\pi6, \\ldots$ are unequal: not an AP. It contains $\\frac\\pi2, \\frac{3\\pi}2, 4\\pi, 7\\pi$ and $\\frac\\pi6, \\frac{7\\pi}6, \\frac{13\\pi}6$.' },
      { h: 'Answer', d: '(IV), (P), (R), (S).' }
    ]
  },
  {
    ...P2, id: 'jeeadv-2019-p2-q17', section: 'Section 3', questionNumber: 17,
    chapterId: 'c11-conic-sections', difficulty: 4, answerType: 'mcq',
    prompt: `${PARA_CIRCLES}\n\nWhich of the following is the only CORRECT combination?`,
    mcqOptions: ['(I), (S)', '(I), (U)', '(II), (Q)', '(II), (T)'],
    answer: { correctIndex: 2 },
    hints: ['$C_3$ has the line of centres as a diameter $MN$.'],
    steps: [
      { h: 'Idea', d: 'Work out all four List-I values, then pick the matching option.' },
      ...CIRCLES_SOLVED,
      { h: 'Answer', d: '(I) $= 6$, (II) $= \\sqrt6$: the only correct pairing offered is (II), (Q).' }
    ]
  },
  {
    ...P2, id: 'jeeadv-2019-p2-q18', section: 'Section 3', questionNumber: 18,
    chapterId: 'c11-conic-sections', difficulty: 4, answerType: 'mcq',
    prompt: `${PARA_CIRCLES}\n\nWhich of the following is the only INCORRECT combination?`,
    mcqOptions: ['(I), (P)', '(IV), (U)', '(III), (R)', '(IV), (S)'],
    answer: { correctIndex: 3 },
    hints: ['Compute $2h + k$, the area ratio and $\\alpha$.'],
    steps: [
      { h: 'Idea', d: 'Work out all four List-I values; the incorrect pair is the one that does not match.' },
      ...CIRCLES_SOLVED,
      { h: 'Answer', d: '(I) $= 6$, (III) $= \\frac54$, (IV) $= \\frac{10}3$. So (IV), (S) is the incorrect combination.' }
    ]
  }
]);
