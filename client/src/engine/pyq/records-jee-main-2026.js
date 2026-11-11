// Pri Learning · JEE (Main) 2026 · Session 2 · 2 April 2026 Shift 1 · Mathematics
//
// Provenance rung: OFFICIAL_PAPER_PLUS_SEPARATE_KEY (pyqSources.js). NTA does
// not publish one document carrying a question and its answer. It publishes the
// CBT question paper (each question printed with its NTA Question Id and option
// ids) and, separately, the final answer key on which the result was compiled
// (Question Id → correct option id, or the numerical answer). Each record below
// was read from the rendered page of the paper and joined to the key by NTA's
// Question Id; both files are pinned by sha256 in pyqSources.js. The schema
// refuses a record whose keyed option id is not the option at correctIndex.
//
// The prompt and options are NTA's. The worked steps are Pri Learning's own, and
// each keyed answer was re-derived independently before it was recorded.

import { PYQ_PROVENANCE } from './pyqSources.js';

const S = Object.freeze({
  examId: 'jee-main', year: 2026, session: '2', paper: '1 (B.E./B.Tech)', shift: '2 April 2026 Shift 1',
  section: 'Mathematics',
  provenance: PYQ_PROVENANCE.OFFICIAL_PAPER_PLUS_SEPARATE_KEY, pastPaper: true,
  promptSource: 'jeemain-2026-s2-0402-s1-paper', answerSource: 'jeemain-2026-s2-final-key'
});

/** MCQ: option ids as printed on the paper; the keyed id comes from NTA's final key. */
const mcq = (n, qid, optIds, keyedOptionId, rest) => ({
  ...S, id: `jeemain-2026-s2-0402-s1-q${n}`, questionNumber: n, authorityQuestionId: qid,
  answerType: 'mcq', authorityOptionIds: optIds, keyedOptionId,
  answer: { correctIndex: optIds.indexOf(keyedOptionId) }, ...rest
});
const num = (n, qid, value, rest) => ({
  ...S, id: `jeemain-2026-s2-0402-s1-q${n}`, questionNumber: n, authorityQuestionId: qid,
  answerType: 'numeric', answer: { value }, ...rest
});
const ids = (...xs) => xs.map(String);

export const JEE_MAIN_2026_RECORDS = Object.freeze([
  mcq(1, '6911211', ids(6911211, 6911212, 6911213, 6911214), '6911213', {
    chapterId: 'c11-complex-numbers', difficulty: 3,
    prompt: 'Let $\\alpha, \\alpha + 2$, $\\alpha \\in \\mathbf{Z}$, be the roots of the quadratic equation $x(x+2) + (x+1)(x+3) + (x+2)(x+4) + \\ldots + (x+n-1)(x+n+1) = 4n$ for some $n \\in \\mathbf{N}$. Then $n + \\alpha$ is equal to',
    mcqOptions: ['$0$', '$1$', '$2$', '$3$'],
    steps: [
      { h: 'Sum the terms', d: 'With $k = 0, \\ldots, n-1$: $\\sum (x+k)(x+k+2) = nx^2 + n(n+1)x + \\sum (k^2 + 2k)$, and $\\sum (k^2 + 2k) = \\dfrac{(n-1)n(2n-1)}{6} + n(n-1)$.' },
      { h: 'Divide by $n$', d: '$x^2 + (n+1)x + \\dfrac{(n-1)(2n-1)}{6} + (n-1) - 4 = 0$.' },
      { h: 'Roots differ by 2', d: 'So the discriminant is $4$: $(n+1)^2 - 4\\left[\\dfrac{(n-1)(2n-1)}{6} + n - 5\\right] = 4$, which simplifies to $n^2 = 49$, so $n = 7$.' },
      { h: 'Find $\\alpha$', d: 'Sum of roots $2\\alpha + 2 = -(n+1) = -8$, so $\\alpha = -5$ and $n + \\alpha = 2$.' }
    ]
  }),
  mcq(2, '6911212', ids(6911215, 6911216, 6911217, 6911218), '6911218', {
    chapterId: 'c11-complex-numbers', difficulty: 3,
    prompt: 'Let $x$ and $y$ be real numbers such that $50\\left(\\dfrac{2x}{1+3i} - \\dfrac{y}{1-2i}\\right) = 31 + 17i$, $i = \\sqrt{-1}$. Then the value of $10(x - 3y)$ is',
    mcqOptions: ['$20$', '$31$', '$35$', '$75$'],
    steps: [
      { h: 'Rationalise', d: '$\\dfrac{2x}{1+3i} = \\dfrac{x(1-3i)}{5}$ and $\\dfrac{y}{1-2i} = \\dfrac{y(1+2i)}{5}$.' },
      { h: 'Compare parts', d: '$10\\big[(x - y) + i(-3x - 2y)\\big] = 31 + 17i$, so $x - y = 3.1$ and $-3x - 2y = 1.7$.' },
      { h: 'Solve', d: '$y = -2.2$, $x = 0.9$, so $10(x - 3y) = 10(0.9 + 6.6) = 75$.' }
    ]
  }),
  mcq(3, '6911213', ids(6911219, 69112110, 69112111, 69112112), '69112110', {
    chapterId: 'c12-determinants', difficulty: 3,
    prompt: 'Let $\\alpha, \\beta \\in \\mathbf{R}$ be such that the system of linear equations $x + 2y + z = 5$, $2x + y + \\alpha z = 5$, $8x + 4y + \\beta z = 18$ has no solution. Then $\\dfrac{\\beta}{\\alpha}$ is equal to',
    mcqOptions: ['$-4$', '$4$', '$8$', '$-8$'],
    steps: [
      { h: 'No solution needs a zero determinant', d: '$\\begin{vmatrix}1&2&1\\\\2&1&\\alpha\\\\8&4&\\beta\\end{vmatrix} = (\\beta - 4\\alpha) - 2(2\\beta - 8\\alpha) + (8 - 8) = 12\\alpha - 3\\beta$.' },
      { h: 'Set it to zero', d: '$12\\alpha = 3\\beta$, so $\\beta = 4\\alpha$ and $\\dfrac{\\beta}{\\alpha} = 4$.' }
    ]
  }),
  mcq(4, '6911214', ids(69112113, 69112114, 69112115, 69112116), '69112114', {
    chapterId: 'c12-matrices', difficulty: 3,
    prompt: 'Let $A = \\begin{bmatrix}1&2\\\\1&\\alpha\\end{bmatrix}$ and $B = \\begin{bmatrix}3&3\\\\\\beta&2\\end{bmatrix}$. If $A^2 - 4A + I = O$ and $B^2 - 5B - 6I = O$, then among the two statements (S1): $[(B-A)(B+A)]^{T} = \\begin{bmatrix}13&15\\\\7&10\\end{bmatrix}$ and (S2): $\\det(\\operatorname{adj}(A+B)) = -5$,',
    mcqOptions: ['only (S1) is correct', 'only (S2) is correct', 'both (S1) and (S2) are correct', 'both (S1) and (S2) are wrong'],
    steps: [
      { h: 'Cayley–Hamilton fixes the unknowns', d: 'A $2\\times2$ matrix satisfies $M^2 - (\\operatorname{tr} M)M + (\\det M)I = O$. For $A$: trace $1 + \\alpha = 4$, so $\\alpha = 3$ (and $\\det A = 1$). For $B$: $\\det B = 6 - 3\\beta = -6$, so $\\beta = 4$.' },
      { h: '(S1)', d: '$B - A = \\begin{bmatrix}2&1\\\\3&-1\\end{bmatrix}$, $B + A = \\begin{bmatrix}4&5\\\\5&5\\end{bmatrix}$, product $\\begin{bmatrix}13&15\\\\7&10\\end{bmatrix}$, whose transpose is $\\begin{bmatrix}13&7\\\\15&10\\end{bmatrix}$. (S1) is wrong.' },
      { h: '(S2)', d: '$\\det(A + B) = 20 - 25 = -5$, and for a $2\\times2$ matrix $\\det(\\operatorname{adj} M) = \\det M$. (S2) is correct.' }
    ]
  }),
  mcq(5, '6911215', ids(69112117, 69112118, 69112119, 69112120), '69112118', {
    chapterId: 'c11-sequences-series', difficulty: 3,
    prompt: 'Let $A$ be the set of first $101$ terms of an A.P., whose first term is $1$ and the common difference is $5$ and let $B$ be the set of first $71$ terms of an A.P., whose first term is $9$ and the common difference is $7$. Then the number of elements in $A \\cap B$, which are divisible by $3$, is',
    mcqOptions: ['$4$', '$5$', '$6$', '$7$'],
    steps: [
      { h: 'The two sets', d: '$A = \\{1, 6, \\ldots, 501\\}$ ($\\equiv 1 \\bmod 5$) and $B = \\{9, 16, \\ldots, 499\\}$ ($\\equiv 2 \\bmod 7$).' },
      { h: 'Common terms', d: 'Both conditions give $x \\equiv 16 \\pmod{35}$: $16 + 35t \\le 499$, so $t = 0, 1, \\ldots, 13$.' },
      { h: 'Divisible by 3', d: '$16 + 35t \\equiv 1 + 2t \\pmod 3$, zero when $t \\equiv 1 \\pmod 3$: $t = 1, 4, 7, 10, 13$. That is $5$ elements.' }
    ]
  }),
  mcq(6, '6911216', ids(69112121, 69112122, 69112123, 69112124), '69112123', {
    chapterId: 'c11-permutations-combinations', difficulty: 3,
    prompt: 'The number of seven-digit numbers, that can be formed by using the digits $1, 2, 3, 5$ and $7$ such that each digit is used at least once, is',
    mcqOptions: ['$15400$', '$17800$', '$16800$', '$29400$'],
    steps: [
      { h: 'Two extra places', d: 'All five digits appear once; the two remaining places either repeat one digit twice more or two digits once more each.' },
      { h: 'One digit three times', d: '$5 \\times \\dfrac{7!}{3!} = 5 \\times 840 = 4200$.' },
      { h: 'Two digits twice', d: '$\\binom{5}{2} \\times \\dfrac{7!}{2!\\,2!} = 10 \\times 1260 = 12600$.' },
      { h: 'Total', d: '$4200 + 12600 = 16800$.' }
    ]
  }),
  mcq(7, '6911217', ids(69112125, 69112126, 69112127, 69112128), '69112126', {
    chapterId: 'c11-permutations-combinations', difficulty: 3,
    prompt: 'The number of elements in the set $S = \\left\\{(r, k) : k \\in \\mathbf{Z} \\text{ and } {}^{36}C_{r+1} = \\dfrac{6\\left({}^{35}C_{r}\\right)}{k^2 - 3}\\right\\}$, is',
    mcqOptions: ['$2$', '$4$', '$8$', '$16$'],
    steps: [
      { h: 'Rewrite the left side', d: '${}^{36}C_{r+1} = \\dfrac{36}{r+1}\\,{}^{35}C_{r}$, so $\\dfrac{36}{r+1} = \\dfrac{6}{k^2 - 3}$, i.e. $r + 1 = 6(k^2 - 3)$.' },
      { h: 'Allowed values', d: '$0 \\le r \\le 35$, so $1 \\le r + 1 \\le 36$ and $k^2 - 3 \\in \\{1, \\ldots, 6\\}$: $k^2 \\in \\{4, \\ldots, 9\\}$.' },
      { h: 'Perfect squares', d: '$k^2 = 4$ gives $r = 5$, $k = \\pm 2$; $k^2 = 9$ gives $r = 35$, $k = \\pm 3$. So $S$ has $4$ elements.' }
    ]
  }),
  mcq(8, '6911218', ids(69112129, 69112130, 69112131, 69112132), '69112131', {
    chapterId: 'c11-statistics', difficulty: 3,
    prompt: 'If the mean of the data with classes $5$–$10$, $10$–$15$, $15$–$20$, $20$–$25$, $25$–$30$, $30$–$35$ and frequencies $2$, $k$, $28$, $54$, $k+1$, $5$ respectively is $21$, then $k$ is one of the roots of the equation',
    mcqOptions: ['$2x^2 - 23x - 10 = 0$', '$4x^2 - 35x + 24 = 0$', '$2x^2 - 19x - 10 = 0$', '$2x^2 - 35x + 98 = 0$'],
    steps: [
      { h: 'Totals', d: 'Mid-points $7.5, 12.5, \\ldots, 32.5$. $\\sum f = 90 + 2k$ and $\\sum fx = 1910 + 40k$.' },
      { h: 'Mean is 21', d: '$1910 + 40k = 21(90 + 2k) = 1890 + 42k$, so $k = 10$.' },
      { h: 'Test the options', d: '$2(10)^2 - 19(10) - 10 = 0$, so $k$ is a root of $2x^2 - 19x - 10 = 0$.' }
    ]
  }),
  mcq(9, '6911219', ids(69112133, 69112134, 69112135, 69112136), '69112135', {
    chapterId: 'c11-straight-lines', difficulty: 3,
    prompt: 'Let the mid points of the sides of a triangle $ABC$ be $\\left(\\dfrac{5}{2}, 7\\right)$, $\\left(\\dfrac{5}{2}, 3\\right)$ and $(4, 5)$. If its incentre is $(h, k)$, then $3h + k$ is equal to',
    mcqOptions: ['$11$', '$12$', '$13$', '$14$'],
    steps: [
      { h: 'Recover the vertices', d: 'Each vertex is the sum of two mid-points minus the third: $(1, 5)$, $(4, 9)$ and $(4, 1)$.' },
      { h: 'Side lengths', d: 'Opposite $(1,5)$: $8$; opposite $(4,9)$: $5$; opposite $(4,1)$: $5$.' },
      { h: 'Incentre', d: '$h = \\dfrac{8(1) + 5(4) + 5(4)}{18} = \\dfrac{8}{3}$, $k = \\dfrac{8(5) + 5(9) + 5(1)}{18} = 5$, so $3h + k = 13$.' }
    ]
  }),
  mcq(10, '69112110', ids(69112137, 69112138, 69112139, 69112140), '69112140', {
    chapterId: 'c11-conic-sections', difficulty: 3,
    prompt: 'Let an ellipse $\\dfrac{x^2}{a^2} + \\dfrac{y^2}{b^2} = 1$, $a < b$, pass through the point $(4, 3)$ and have eccentricity $\\dfrac{\\sqrt{5}}{3}$. Then the length of its latus rectum is',
    mcqOptions: ['$\\dfrac{4\\sqrt{5}}{3}$', '$2\\sqrt{5}$', '$\\dfrac{7\\sqrt{5}}{3}$', '$\\dfrac{8\\sqrt{5}}{3}$'],
    steps: [
      { h: 'Major axis along $y$', d: 'With $a < b$: $e^2 = 1 - \\dfrac{a^2}{b^2} = \\dfrac{5}{9}$, so $a^2 = \\dfrac{4}{9}b^2$.' },
      { h: 'Use the point', d: '$\\dfrac{16}{a^2} + \\dfrac{9}{b^2} = \\dfrac{36}{b^2} + \\dfrac{9}{b^2} = 1$, so $b^2 = 45$, $a^2 = 20$.' },
      { h: 'Latus rectum', d: '$\\dfrac{2a^2}{b} = \\dfrac{40}{3\\sqrt{5}} = \\dfrac{8\\sqrt{5}}{3}$.' }
    ]
  }),
  mcq(11, '69112111', ids(69112141, 69112142, 69112143, 69112144), '69112141', {
    chapterId: 'c11-trig-functions', difficulty: 3,
    prompt: 'If $\\sin\\left(\\dfrac{\\pi}{18}\\right)\\sin\\left(\\dfrac{5\\pi}{18}\\right)\\sin\\left(\\dfrac{7\\pi}{18}\\right) = K$, then the value of $\\sin\\left(\\dfrac{10K\\pi}{3}\\right)$ is',
    mcqOptions: ['$\\dfrac{\\sqrt{3}+1}{2\\sqrt{2}}$', '$\\dfrac{\\sqrt{3}-1}{\\sqrt{2}}$', '$\\dfrac{\\sqrt{3}}{2}$', '$\\dfrac{1}{2}$'],
    steps: [
      { h: 'Triple-product identity', d: '$\\sin\\theta\\,\\sin(60^{\\circ} - \\theta)\\,\\sin(60^{\\circ} + \\theta) = \\dfrac{\\sin 3\\theta}{4}$. With $\\theta = 10^{\\circ}$: $K = \\dfrac{\\sin 30^{\\circ}}{4} = \\dfrac{1}{8}$.' },
      { h: 'Evaluate', d: '$\\dfrac{10K\\pi}{3} = \\dfrac{5\\pi}{12} = 75^{\\circ}$, and $\\sin 75^{\\circ} = \\dfrac{\\sqrt{3}+1}{2\\sqrt{2}}$.' }
    ]
  }),
  mcq(12, '69112112', ids(69112145, 69112146, 69112147, 69112148), '69112148', {
    chapterId: 'c11-trig-functions', difficulty: 3,
    prompt: 'Let $S = \\{x \\in [-\\pi, \\pi] : \\sin x(\\sin x + \\cos x) = a,\\ a \\in \\mathbf{Z}\\}$. Then $n(S)$ is equal to',
    mcqOptions: ['$3$', '$6$', '$7$', '$9$'],
    steps: [
      { h: 'Range of the left side', d: '$\\sin^2 x + \\sin x\\cos x = \\dfrac{1}{2} + \\dfrac{\\sin 2x - \\cos 2x}{2}$, which lies in $\\left[\\dfrac{1-\\sqrt{2}}{2}, \\dfrac{1+\\sqrt{2}}{2}\\right]$. So $a = 0$ or $1$.' },
      { h: '$a = 0$', d: '$\\sin x = 0$ ($x = -\\pi, 0, \\pi$) or $\\tan x = -1$ ($x = -\\tfrac{\\pi}{4}, \\tfrac{3\\pi}{4}$): $5$ values.' },
      { h: '$a = 1$', d: '$\\sin 2x - \\cos 2x = 1$, i.e. $\\sin(2x - \\tfrac{\\pi}{4}) = \\tfrac{1}{\\sqrt{2}}$: $x = \\tfrac{\\pi}{4}, -\\tfrac{3\\pi}{4}, \\tfrac{\\pi}{2}, -\\tfrac{\\pi}{2}$: $4$ values.' },
      { h: 'Total', d: '$5 + 4 = 9$.' }
    ]
  }),
  mcq(13, '69112113', ids(69112149, 69112150, 69112151, 69112152), '69112151', {
    chapterId: 'c12-3d-geometry', difficulty: 3,
    prompt: 'If the point of intersection of the lines $\\dfrac{x+1}{3} = \\dfrac{y+a}{5} = \\dfrac{z+b+1}{7}$ and $\\dfrac{x-2}{1} = \\dfrac{y-b}{4} = \\dfrac{z-2a}{7}$ lies on $xy$-plane, then the value of $a + b$ is',
    mcqOptions: ['$2$', '$5$', '$7$', '$9$'],
    steps: [
      { h: 'General points', d: '$(3t - 1, 5t - a, 7t - b - 1)$ and $(s + 2, 4s + b, 7s + 2a)$.' },
      { h: 'Equate, with $z = 0$', d: '$s = 3t - 3$; $7t - b - 1 = 0$ and $7s + 2a = 0$; $5t - a = 4s + b$.' },
      { h: 'Solve', d: 'These give $a = 13 - 14t$ and $a = \\dfrac{21 - 21t}{2}$, so $t = \\dfrac{5}{7}$, $a = 3$, $b = 4$ and $a + b = 7$.' }
    ]
  }),
  mcq(14, '69112114', ids(69112153, 69112154, 69112155, 69112156), '69112155', {
    chapterId: 'c12-vector-algebra', difficulty: 3,
    prompt: 'If $\\vec{a}$ and $\\vec{b}$ are two vectors such that $|\\vec{a}| = 2$ and $|\\vec{b}| = 3$, then the maximum value of $3\\left|3\\vec{a} + 2\\vec{b}\\right| + 4\\left|3\\vec{a} - 2\\vec{b}\\right|$ is',
    mcqOptions: ['$30$', '$36$', '$60$', '$72$'],
    steps: [
      { h: 'The two lengths', d: 'With $c = \\vec{a}\\cdot\\vec{b}$: $|3\\vec{a} \\pm 2\\vec{b}|^2 = 72 \\pm 12c$, and the squares add to $144$.' },
      { h: 'Cauchy–Schwarz', d: '$3u + 4v \\le \\sqrt{3^2 + 4^2}\\sqrt{u^2 + v^2} = 5 \\times 12 = 60$.' },
      { h: 'Attained', d: 'Equality needs $u : v = 3 : 4$, i.e. $c = -1.68$, which lies in $[-6, 6]$. The maximum is $60$.' }
    ]
  }),
  mcq(15, '69112115', ids(69112157, 69112158, 69112159, 69112160), '69112159', {
    chapterId: 'c12-3d-geometry', difficulty: 3,
    prompt: 'Let a line $L$ passing through the point $(1, 1, 1)$ be perpendicular to both the vectors $2\\hat{i} + 2\\hat{j} + \\hat{k}$ and $\\hat{i} + 2\\hat{j} + 2\\hat{k}$. If $P(a, b, c)$ is the foot of perpendicular from the origin on the line $L$, then the value of $34(a + b + c)$ is',
    mcqOptions: ['$50$', '$80$', '$100$', '$120$'],
    steps: [
      { h: 'Direction', d: '$(2, 2, 1) \\times (1, 2, 2) = (2, -3, 2)$.' },
      { h: 'Foot from the origin', d: '$(1, 1, 1) + t(2, -3, 2)$ with $t = -\\dfrac{(1,1,1)\\cdot(2,-3,2)}{17} = -\\dfrac{1}{17}$, giving $P = \\left(\\dfrac{15}{17}, \\dfrac{20}{17}, \\dfrac{15}{17}\\right)$.' },
      { h: 'Evaluate', d: '$34 \\times \\dfrac{50}{17} = 100$.' }
    ]
  }),
  mcq(16, '69112116', ids(69112161, 69112162, 69112163, 69112164), '69112162', {
    chapterId: 'c11-limits-derivatives', difficulty: 3,
    prompt: 'If $\\displaystyle\\lim_{x \\to 2} \\dfrac{\\sin(x^3 - 5x^2 + ax + b)}{(\\sqrt{x-1} - 1)\\log_e(x-1)} = m$, then $a + b + m$ is equal to',
    mcqOptions: ['$5$', '$6$', '$8$', '$10$'],
    steps: [
      { h: 'Size of the denominator', d: 'Near $x = 2$: $\\sqrt{x-1} - 1 \\approx \\dfrac{x-2}{2}$ and $\\log_e(x-1) \\approx x - 2$, so the denominator $\\approx \\dfrac{(x-2)^2}{2}$.' },
      { h: 'A finite limit', d: 'With $g(x) = x^3 - 5x^2 + ax + b$ we need $g(2) = 0$ and $g\'(2) = 0$: $2a + b = 12$ and $a = 8$, so $b = -4$.' },
      { h: 'The limit', d: '$g(x) \\approx \\dfrac{g\'\'(2)}{2}(x-2)^2 = (x-2)^2$, so $m = \\dfrac{1}{1/2} = 2$ and $a + b + m = 6$.' }
    ]
  }),
  mcq(17, '69112117', ids(69112165, 69112166, 69112167, 69112168), '69112167', {
    chapterId: 'c12-differential-equations', difficulty: 3,
    prompt: 'If the curve $y = f(x)$ passes through the point $(1, e)$ and satisfies the differential equation $dy = y(2 + \\log_e x)\\,dx$, $x > 0$, then $f(e)$ is equal to',
    mcqOptions: ['$e^{e}$', '$e^{e^2}$', '$e^{2e}$', '$e^{2^e}$'],
    steps: [
      { h: 'Separate', d: '$\\dfrac{dy}{y} = (2 + \\ln x)\\,dx$, so $\\ln y = 2x + x\\ln x - x + C = x + x\\ln x + C$.' },
      { h: 'Use $(1, e)$', d: '$1 = 1 + 0 + C$, so $C = 0$.' },
      { h: 'At $x = e$', d: '$\\ln y = e + e = 2e$, so $f(e) = e^{2e}$.' }
    ]
  }),
  mcq(18, '69112118', ids(69112169, 69112170, 69112171, 69112172), '69112171', {
    chapterId: 'c12-applications-derivatives', difficulty: 3,
    prompt: 'The number of critical points of the function $f(x) = \\begin{cases} \\left|\\dfrac{\\sin x}{x}\\right|, & x \\ne 0 \\\\ 1, & x = 0 \\end{cases}$ in the interval $(-2\\pi, 2\\pi)$ is equal to',
    mcqOptions: ['$1$', '$3$', '$5$', '$7$'],
    steps: [
      { h: 'Where the derivative is zero', d: 'Away from the zeros of $\\sin x$, $f\'(x) = 0$ when $x\\cos x - \\sin x = 0$, i.e. $\\tan x = x$: $x = 0$ (where $f$ is smooth with $f\'(0) = 0$) and one root in each of $(\\pi, \\tfrac{3\\pi}{2})$ and $(-\\tfrac{3\\pi}{2}, -\\pi)$.' },
      { h: 'Where it does not exist', d: 'At $x = \\pm\\pi$ the modulus makes a corner, so $f\'$ does not exist there.' },
      { h: 'Count', d: '$3 + 2 = 5$ critical points.' }
    ]
  }),
  mcq(19, '69112119', ids(69112173, 69112174, 69112175, 69112176), '69112174', {
    chapterId: 'c12-integrals', difficulty: 3,
    prompt: 'Let $[\\cdot]$ denote the greatest integer function. Then the value of $\\displaystyle\\int_0^3 \\left(\\dfrac{e^x + e^{-x}}{[x]!}\\right) dx$ is',
    mcqOptions: ['$e^2 + e^3 - \\dfrac{1}{e^2} - \\dfrac{1}{e^3}$', '$\\dfrac{1}{2}\\left(e^2 + e^3 - \\dfrac{1}{e^2} - \\dfrac{1}{e^3}\\right)$', '$e^2 + e^3 - \\dfrac{1}{2e^2} - \\dfrac{1}{2e^3}$', '$\\dfrac{1}{2}(e^2 + e^3) - \\dfrac{1}{e^2} - \\dfrac{1}{e^3}$'],
    steps: [
      { h: 'Split at the integers', d: 'With $F(x) = e^x - e^{-x}$: the integral is $[F]_0^1 + [F]_1^2 + \\dfrac{1}{2}[F]_2^3$ (dividing by $0!$, $1!$, $2!$).' },
      { h: 'Combine', d: '$F(2) - F(0) + \\dfrac{1}{2}\\big(F(3) - F(2)\\big) = \\dfrac{1}{2}\\big(F(2) + F(3)\\big)$, since $F(0) = 0$.' },
      { h: 'Answer', d: '$\\dfrac{1}{2}\\left(e^2 + e^3 - \\dfrac{1}{e^2} - \\dfrac{1}{e^3}\\right)$.' }
    ]
  }),
  mcq(20, '69112120', ids(69112177, 69112178, 69112179, 69112180), '69112180', {
    chapterId: 'c12-differential-equations', difficulty: 3,
    prompt: 'Let $y = y(x)$ be the solution curve of the differential equation $(1 + \\sin x)\\dfrac{dy}{dx} + (y + 1)\\cos x = 0$, $y(0) = 0$. If the curve $y = y(x)$ passes through the point $\\left(\\alpha, -\\dfrac{1}{2}\\right)$, then a value of $\\alpha$ is',
    mcqOptions: ['$\\dfrac{\\pi}{6}$', '$\\dfrac{\\pi}{4}$', '$\\dfrac{\\pi}{3}$', '$\\dfrac{\\pi}{2}$'],
    steps: [
      { h: 'Separate', d: '$\\dfrac{dy}{y+1} = -\\dfrac{\\cos x}{1 + \\sin x}dx$, so $(y + 1)(1 + \\sin x) = C$, and $y(0) = 0$ gives $C = 1$.' },
      { h: 'Use the point', d: '$\\dfrac{1}{2}(1 + \\sin\\alpha) = 1$, so $\\sin\\alpha = 1$ and $\\alpha = \\dfrac{\\pi}{2}$.' }
    ]
  }),
  num(21, '69112121', 4, {
    chapterId: 'c11-relations-functions', difficulty: 3,
    prompt: 'If the domain of the function $f(x) = \\sqrt{\\log_{(0.6)}\\left(\\left|\\dfrac{2x-5}{x^2-4}\\right|\\right)}$ is $(-\\infty, a] \\cup \\{b\\} \\cup [c, d) \\cup (e, \\infty)$, then the value of $a + b + c + d + e$ is',
    steps: [
      { h: 'Condition', d: 'The logarithm to base $0.6$ is $\\ge 0$ when $0 < \\left|\\dfrac{2x-5}{x^2-4}\\right| \\le 1$, with $x \\ne \\pm 2, \\tfrac{5}{2}$.' },
      { h: 'Square both sides', d: '$(2x-5)^2 \\le (x^2-4)^2$ factorises to $(x-1)^2(x^2 + 2x - 9) \\ge 0$: true for $x \\le -1-\\sqrt{10}$, $x = 1$, or $x \\ge -1+\\sqrt{10}$.' },
      { h: 'Read off', d: 'Domain $(-\\infty, -1-\\sqrt{10}] \\cup \\{1\\} \\cup [-1+\\sqrt{10}, \\tfrac{5}{2}) \\cup (\\tfrac{5}{2}, \\infty)$, so the sum is $-2 + 1 + 5 = 4$.' }
    ]
  }),
  num(22, '69112122', 91, {
    chapterId: 'c11-sequences-series', difficulty: 3,
    prompt: 'If $\\displaystyle\\sum_{k=1}^{n} a_k = 6n^3$, then $\\displaystyle\\sum_{k=1}^{6} \\left(\\dfrac{a_{k+1} - a_k}{36}\\right)^2$ is equal to',
    steps: [
      { h: 'The terms', d: '$a_k = 6k^3 - 6(k-1)^3 = 6(3k^2 - 3k + 1)$.' },
      { h: 'Differences', d: '$a_{k+1} - a_k = 6\\big(3(2k+1) - 3\\big) = 36k$, so each bracket is $k$.' },
      { h: 'Sum', d: '$1^2 + 2^2 + \\cdots + 6^2 = 91$.' }
    ]
  }),
  num(23, '69112123', 81, {
    chapterId: 'c11-probability', difficulty: 3,
    prompt: 'Let $a, b, c \\in \\{1, 2, 3, 4\\}$. If the probability, that $ax^2 + 2\\sqrt{2}bx + c > 0$ for all $x \\in \\mathbf{R}$, is $\\dfrac{m}{n}$, $\\gcd(m, n) = 1$, then $m + n$ is equal to',
    steps: [
      { h: 'Condition', d: 'With $a > 0$ the quadratic stays positive when its discriminant is negative: $8b^2 - 4ac < 0$, i.e. $ac > 2b^2$.' },
      { h: 'Count', d: '$b = 1$: $ac > 2$, which is $16 - 3 = 13$ pairs. $b = 2$: $ac > 8$, which is $4$ pairs $(3,3),(3,4),(4,3),(4,4)$. $b \\ge 3$: none. Total $17$ of $64$.' },
      { h: 'Answer', d: '$\\dfrac{17}{64}$, so $m + n = 81$.' }
    ]
  }),
  num(24, '69112124', 8, {
    chapterId: 'c11-conic-sections', difficulty: 3,
    prompt: 'Let a circle $C$ have its centre in the first quadrant, intersect the coordinate axes at exactly three points and cut off equal intercepts from the coordinate axes. If the length of the chord of $C$ on the line $x + y = 1$ is $\\sqrt{14}$, then the square of the radius of $C$ is',
    steps: [
      { h: 'Shape of the circle', d: 'Three points on the axes with equal intercepts means it passes through the origin: $x^2 + y^2 - 2hx - 2hy = 0$, centre $(h, h)$, $r^2 = 2h^2$.' },
      { h: 'Chord length', d: 'Distance from the centre to $x + y = 1$ is $\\dfrac{|2h - 1|}{\\sqrt{2}}$, and $r^2 - d^2 = \\left(\\dfrac{\\sqrt{14}}{2}\\right)^2 = \\dfrac{7}{2}$.' },
      { h: 'Solve', d: '$2h^2 - \\dfrac{(2h-1)^2}{2} = \\dfrac{7}{2}$ gives $4h - 1 = 7$, so $h = 2$ and $r^2 = 8$.' }
    ]
  }),
  num(25, '69112125', 192, {
    chapterId: 'c12-integrals', difficulty: 3,
    prompt: 'If $\\alpha = \\displaystyle\\int_0^{2\\sqrt{3}} \\log_2(x^2 + 4)\\,dx + \\int_2^4 \\sqrt{2^x - 4}\\,dx$, then $\\alpha^2$ is equal to',
    steps: [
      { h: 'Inverse functions', d: '$f(x) = \\log_2(x^2 + 4)$ maps $[0, 2\\sqrt{3}]$ onto $[2, 4]$, and its inverse is $f^{-1}(y) = \\sqrt{2^y - 4}$.' },
      { h: 'Area identity', d: '$\\int_a^b f + \\int_{f(a)}^{f(b)} f^{-1} = b f(b) - a f(a) = 2\\sqrt{3}(4) - 0 = 8\\sqrt{3}$.' },
      { h: 'Square', d: '$\\alpha^2 = 192$.' }
    ]
  })
]);
