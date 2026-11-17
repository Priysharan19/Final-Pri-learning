// Pri Learning · Experience 3 layer for CBSE Class 11 notes (see notes/e3.js). Original writing.
// Every number below is computed from the chapter's own examples; the checkpoint answers are
// re-derived by the engine in client/test/notes-e3-check.mjs.
export default {
  'c11-sets': {
    objective: 'Write a set in roster or set-builder form, decide membership and subset questions, combine sets by union, intersection and complement, and count a union of two or three sets without counting anything twice.',
    intuition: 'A set is a collection with a sharp rule for what belongs. Union pours two collections together; intersection keeps only what is in both. If you count a union by adding $n(A)$ and $n(B)$, every element of the overlap has been counted twice, once in each set, so you subtract $n(A\\cap B)$ once. A Venn diagram makes this visible: fill in the overlap first, and then every region is counted exactly once.',
    check: [
      { question: 'A set $A$ has $6$ elements. How many subsets does it have, and how many of them are proper subsets?', answer: '$2^6=64$ subsets, of which $63$ are proper (all except $A$ itself).', verify: { kind: 'values', pairs: [['2^6', '64'], ['2^6-1', '63']] } },
      { question: 'In a group of $60$ students, $35$ play cricket, $28$ play football and $12$ play both. How many play neither?', answer: '$n(C\\cup F)=35+28-12=51$, so $60-51=9$ play neither.', verify: { kind: 'value', expr: '60-(35+28-12)', answer: '9' } },
      { question: 'In a survey of $100$ people, $45$ read paper $A$, $40$ read $B$ and $30$ read $C$; $15$ read $A$ and $B$, $12$ read $A$ and $C$, $10$ read $B$ and $C$, and $5$ read all three. How many read at least one paper, and how many read exactly one?', answer: 'At least one: $45+40+30-15-12-10+5=83$. Exactly one: $A$ only $23$, $B$ only $20$, $C$ only $13$, so $56$.', verify: { kind: 'values', pairs: [['45+40+30-15-12-10+5', '83'], ['(45-15-12+5)+(40-15-10+5)+(30-12-10+5)', '56']] } }
    ],
    diagrams: [
      { title: 'Maths and Physics in a class of $40$', spec: { kind: 'venn', sets: 2, labels: ['M', 'P'], counts: { A: 15, AB: 10, B: 8, none: 7 }, universe: 40 }, note: 'Fill the overlap first: $10$ take both. Then Maths only is $25-10=15$ and Physics only is $18-10=8$. The union is $15+10+8=33$, the same as $25+18-10$, and $40-33=7$ take neither.' },
      { title: 'Three sets, filled from the centre outwards', spec: { kind: 'venn', sets: 3, labels: ['A', 'B', 'C'], counts: { A: 9, B: 8, C: 6, AB: 5, AC: 4, BC: 3, ABC: 2 } }, note: 'Here $n(A)=20$, $n(B)=18$, $n(C)=15$, $n(A\\cap B)=7$, $n(A\\cap C)=6$, $n(B\\cap C)=5$ and $2$ elements lie in all three. Put $2$ in the centre, then $7-2=5$, $6-2=4$ and $5-2=3$ in the pairwise regions. The seven regions add to $37=20+18+15-7-6-5+2$.' },
      { title: 'The interval $[-2,3)$ as a set of real numbers', spec: { kind: 'numberLine', min: -4, max: 6, step: 1, intervals: [{ from: -2, to: 3, toOpen: true }] }, note: 'The filled dot shows that $-2$ belongs to the set and the open dot that $3$ does not: $[-2,3)=\\{x\\in\\mathbb{R}:-2\\le x<3\\}$. Every real number in between belongs, not only the integers.' }
    ],
    interactiveNone: 'Sets are about membership and counting regions. A Venn diagram with every region filled in already shows each count. Nothing in the chapter varies continuously, so a slider would have nothing to teach.'
  },

  'c11-relations-functions': {
    objective: 'Form the Cartesian product of two sets, decide whether a relation is a function, and state the domain and range of a real function from its formula and from its graph.',
    intuition: 'A relation from $A$ to $B$ is any set of ordered pairs, which you can draw as arrows from $A$ to $B$. A function is a relation with one condition: every element of $A$ sends out exactly one arrow. On a graph that condition becomes the vertical line test, since a vertical line meets the graph of a function at most once. The domain is the shadow the graph casts on the $x$-axis and the range is its shadow on the $y$-axis.',
    check: [
      { question: 'If $n(A)=4$ and $n(B)=3$, how many elements does $A\\times B$ have, and how many relations are there from $A$ to $B$?', answer: '$n(A\\times B)=12$, and every subset of $A\\times B$ is a relation, so there are $2^{12}=4096$.', verify: { kind: 'values', pairs: [['4*3', '12'], ['2^12', '4096']] } },
      { question: 'Find the domain of $f(x)=\\dfrac{1}{x^2-5x+6}$.', answer: 'The denominator $(x-2)(x-3)$ is zero at $x=2$ and $x=3$, so the domain is $\\mathbb{R}\\setminus\\{2,3\\}$.', verify: { kind: 'roots', f: 'x^2-5*x+6', answers: ['2', '3'] } },
      { question: 'Find the range of $f(x)=x^2-4x+7$, $x\\in\\mathbb{R}$.', answer: '$f(x)=(x-2)^2+3\\ge3$, with equality at $x=2$, so the range is $[3,\\infty)$.', verify: { kind: 'equivalent', a: 'x^2-4*x+7', b: '(x-2)^2+3' } }
    ],
    diagrams: [
      { title: 'The six ordered pairs of $A\\times B$', spec: { kind: 'plane', xmin: -1, xmax: 4, ymin: -1, ymax: 3, points: [{ x: 1, y: 1, label: '(1,1)', pos: 'se' }, { x: 2, y: 1, label: '(2,1)', pos: 'se' }, { x: 3, y: 1, label: '(3,1)', pos: 'se' }, { x: 1, y: 2, label: '(1,2)', pos: 'ne' }, { x: 2, y: 2, label: '(2,2)', pos: 'ne' }, { x: 3, y: 2, label: '(3,2)', pos: 'ne' }] }, note: 'With $A=\\{1,2,3\\}$ along the $x$-axis and $B=\\{1,2\\}$ up the $y$-axis, $A\\times B$ is a $3$ by $2$ grid of points, so $n(A\\times B)=3\\times2=6$. A relation is any choice of these points, which gives $2^6=64$ relations.' },
      { title: 'How the range of a quadratic depends on its vertex', spec: { kind: 'paramGraph', expr: 'a*(x-h)^2+k', params: [{ name: 'a', min: -3, max: 3, step: 0.5, initial: 1 }, { name: 'h', min: -4, max: 4, step: 1, initial: -1 }, { name: 'k', min: -4, max: 6, step: 1, initial: 1 }], xmin: -6, xmax: 6, ymin: -6, ymax: 10, show: ['vertex'] }, note: 'It starts at $y=(x+1)^2+1=x^2+2x+2$ from the worked example: vertex $(-1,1)$ and range $[1,\\infty)$. Move $k$ and the bottom of the range moves with it. Make $a$ negative and the parabola turns over, so the range becomes $(-\\infty,k]$.' }
    ]
  },

  'c11-trig-functions': {
    objective: 'Convert between degrees and radians, find the trigonometric functions of any angle from the unit circle, use the compound and multiple angle identities, and write the general solution of a trigonometric equation.',
    intuition: 'Walk a point round a circle of radius $1$, starting from $(1,0)$. After turning through an angle $x$, its coordinates are $(\\cos x,\\sin x)$. That is the definition, and it works for every real $x$, not only acute angles. The signs in each quadrant are simply the signs of the coordinates there. A full turn of $2\\pi$ brings the point back to where it started, which is why sine and cosine repeat with period $2\\pi$ and why a trigonometric equation has infinitely many solutions.',
    check: [
      { question: 'Convert $135^\\circ$ to radians, and find the length of the arc it cuts off on a circle of radius $8$ cm.', answer: '$135^\\circ=\\tfrac{3\\pi}{4}$, so $l=r\\theta=8\\cdot\\tfrac{3\\pi}{4}=6\\pi$ cm.', verify: { kind: 'values', pairs: [['135*pi/180', '3*pi/4'], ['8*135*pi/180', '6*pi']] } },
      { question: 'Find the exact value of $\\sin15^\\circ$.', answer: '$\\sin(45^\\circ-30^\\circ)=\\tfrac{\\sqrt2}{2}\\cdot\\tfrac{\\sqrt3}{2}-\\tfrac{\\sqrt2}{2}\\cdot\\tfrac12=\\dfrac{\\sqrt6-\\sqrt2}{4}$.', verify: { kind: 'value', expr: 'sin(15*pi/180)', answer: '(sqrt(6)-sqrt(2))/4' } },
      { question: 'Find the general solution of $2\\cos^2x+3\\sin x=3$.', answer: 'Using $\\cos^2x=1-\\sin^2x$: $2\\sin^2x-3\\sin x+1=0$, so $\\sin x=1$ or $\\sin x=\\tfrac12$. Hence $x=2n\\pi+\\tfrac{\\pi}{2}$, $x=2n\\pi+\\tfrac{\\pi}{6}$ or $x=2n\\pi+\\tfrac{5\\pi}{6}$, $n\\in\\mathbb{Z}$.', verify: { kind: 'roots', f: '2*cos(x)^2+3*sin(x)-3', answers: ['pi/2', 'pi/6', '5*pi/6'] } }
    ],
    diagrams: [
      { title: 'The point at $120^\\circ$ on the unit circle', spec: { kind: 'unitCircleDrag', initial: 120 }, note: 'At $120^\\circ=\\tfrac{2\\pi}{3}$ the point is $\\left(-\\tfrac12,\\tfrac{\\sqrt3}{2}\\right)$, so $\\cos\\tfrac{2\\pi}{3}=-\\tfrac12$ and $\\sin\\tfrac{2\\pi}{3}=\\tfrac{\\sqrt3}{2}$. Drag the point into each quadrant and watch which coordinate changes sign.' },
      { title: 'Where $\\sin2x=\\sin x$ on $[0,2\\pi)$', spec: { kind: 'function', xmin: -0.5, xmax: 7, ymin: -1.5, ymax: 1.5, curves: [{ expr: 'sin(2*x)', label: 'y=\\sin2x' }, { expr: 'sin(x)', label: 'y=\\sin x' }], points: [{ x: 0, y: 0, label: '0' }, { x: 1.0472, y: 0.866, label: '\\tfrac{\\pi}{3}' }, { x: 3.1416, y: 0, label: '\\pi' }, { x: 5.236, y: -0.866, label: '\\tfrac{5\\pi}{3}' }] }, note: 'The curves cross at $x=0$, $\\tfrac{\\pi}{3}$, $\\pi$ and $\\tfrac{5\\pi}{3}$: the four solutions of $\\sin2x=\\sin x$ in $[0,2\\pi)$. Algebra gives the same four from $\\sin x\\,(2\\cos x-1)=0$.' },
      { title: 'Period and shift of $\\sin x$', spec: { kind: 'transform', base: 'sin', show: ['a', 'b', 'h'], initial: { a: 1, b: 2, h: 0, k: 0 } }, note: 'With $b=2$ the curve is $y=\\sin2x$: two full waves fit into $2\\pi$, so the period is $\\pi$. Moving $h$ slides the wave sideways without changing its period, so $\\sin\\left(x+\\tfrac{\\pi}{6}\\right)$ still has period $2\\pi$.' }
    ]
  },

  'c11-complex-numbers': {
    objective: 'Add, multiply and divide complex numbers, find the conjugate, modulus and principal argument, plot numbers on the Argand plane, write them in polar form, and solve a quadratic equation with a negative discriminant.',
    intuition: 'Treat $a+ib$ as the point $(a,b)$. Adding complex numbers is then adding arrows, the modulus is the distance from the origin, and the conjugate is the reflection in the real axis. Multiplication is the surprise: multiplying by $i$ turns every point through a right angle about the origin, which is why $i^2=-1$ is a half-turn. In general, multiplying by $w$ scales by $|w|$ and turns through $\\arg w$.',
    check: [
      { question: 'Write $(2+3i)(1-2i)$ in the form $a+ib$.', answer: '$2-4i+3i-6i^2=8-i$.', verify: { kind: 'values', pairs: [['2*1+3*2', '8'], ['2*(-2)+3*1', '-1']] } },
      { question: 'Find the modulus and principal argument of $z=1-i$.', answer: '$|z|=\\sqrt2$. The point $(1,-1)$ is in the fourth quadrant, so $\\arg z=-\\tfrac{\\pi}{4}$.', verify: { kind: 'values', pairs: [['sqrt(1^2+1^2)', 'sqrt(2)'], ['atan(-1)', '-pi/4']] } },
      { question: 'Solve $x^2-4x+13=0$.', answer: '$D=16-52=-36$, so $x=\\dfrac{4\\pm6i}{2}=2\\pm3i$.', verify: { kind: 'values', pairs: [['(-4)^2-4*13', '-36'], ['2+2', '4'], ['2^2+3^2', '13']] } }
    ],
    diagrams: [
      { title: '$z=-1-i$ and its conjugate', spec: { kind: 'argand', points: [{ re: -1, im: -1, label: 'z' }, { re: -1, im: 1, label: '\\bar z' }], modArg: true }, note: 'The point $z=-1-i$ is $\\sqrt2$ from the origin and lies in the third quadrant, so its principal argument is $-\\tfrac{3\\pi}{4}$, not $\\tfrac{\\pi}{4}$, although $\\tan^{-1}1=\\tfrac{\\pi}{4}$. Its conjugate $\\bar z=-1+i$ is its reflection in the real axis, with argument $\\tfrac{3\\pi}{4}$.' },
      { title: 'Multiplying by $-1+i$ scales and turns', spec: { kind: 'argandExplorer', mode: 'multiply', points: [{ re: 0, im: 2, label: 'z' }], multiply: { re: -1, im: 1 } }, note: 'The fixed $w=-1+i$ has modulus $\\sqrt2$ and argument $\\tfrac{3\\pi}{4}$. Starting from $z=2i$, multiplying by $w$ scales by $\\sqrt2$ and turns through $\\tfrac{3\\pi}{4}$, landing on $zw=-2-2i$ of modulus $2\\sqrt2$. The arguments add to $\\tfrac{\\pi}{2}+\\tfrac{3\\pi}{4}=\\tfrac{5\\pi}{4}$, which as a principal argument is $-\\tfrac{3\\pi}{4}$. Move $z$ and the product always sits $\\tfrac{3\\pi}{4}$ further round.' },
      { title: 'The cube roots of unity', spec: { kind: 'argand', points: [], roots: 3 }, note: 'The three roots $1$, $\\omega$ and $\\omega^2$ of $z^3=1$ lie on the unit circle at arguments $0$, $\\tfrac{2\\pi}{3}$ and $\\tfrac{4\\pi}{3}$. They form an equilateral triangle centred at the origin, so $1+\\omega+\\omega^2=0$.' }
    ]
  },

  'c11-linear-inequalities': {
    objective: 'Solve a linear inequality in one variable and show its solution on the number line, and draw the solution region of a system of linear inequalities in two variables.',
    intuition: 'Adding the same number to both sides of an inequality shifts both along the number line by the same amount, so their order is kept. Multiplying both sides by a negative number reflects both of them through $0$, and a reflection reverses order: $2<5$ but $-2>-5$. That is the whole reason the sign flips. In two variables, the line $ax+by=c$ cuts the plane into two half-planes, and the inequality picks one of them.',
    check: [
      { question: 'Solve $5-2x\\le11$ and write the answer as an interval.', answer: '$-2x\\le6$, and dividing by $-2$ reverses the sign: $x\\ge-3$, that is $[-3,\\infty)$.', verify: { kind: 'roots', f: '5-2*x-11', answers: ['-3'] } },
      { question: 'Find all integers $x$ with $-3<2x+1\\le9$.', answer: '$-4<2x\\le8$, so $-2<x\\le4$: the integers $-1,0,1,2,3,4$.', verify: { kind: 'values', pairs: [['2*(-2)+1', '-3'], ['2*4+1', '9']] } },
      { question: 'Solve $|3x-4|\\ge5$.', answer: '$3x-4\\ge5$ gives $x\\ge3$; $3x-4\\le-5$ gives $x\\le-\\tfrac13$. So $x\\le-\\tfrac13$ or $x\\ge3$.', verify: { kind: 'roots', f: 'abs(3*x-4)-5', answers: ['3', '-1/3'] } }
    ],
    diagrams: [
      { title: 'The solution of $|2x-3|<5$', spec: { kind: 'numberLine', min: -3, max: 6, step: 1, intervals: [{ from: -1, to: 4, fromOpen: true, toOpen: true }] }, note: '$|2x-3|<5$ means $-5<2x-3<5$, so $-1<x<4$. Both dots are open because the inequality is strict: $x=4$ gives $|5|=5$, which is not less than $5$.' },
      { title: 'Why the sign flips', spec: { kind: 'paramGraph', expr: 'a*x+b', params: [{ name: 'a', min: -4, max: 4, step: 1, initial: -2 }, { name: 'b', min: -10, max: 10, step: 1, initial: -8 }], xmin: -8, xmax: 8, ymin: -12, ymax: 12, show: ['roots'] }, note: 'It starts at $y=(3x-7)-(5x+1)=-2x-8$ from the worked example. The inequality $3x-7>5x+1$ asks where this line is above the $x$-axis: to the left of its root $x=-4$. Make $a$ positive and the line tilts the other way, so the solution switches to the right of the root.' },
      { title: 'A system of four inequalities', spec: { kind: 'region', constraints: [{ a: 1, b: 1, op: '<=', c: 6 }, { a: 2, b: 1, op: '>=', c: 4 }, { a: 1, b: 0, op: '>=', c: 0 }, { a: 0, b: 1, op: '>=', c: 0 }], xmin: -1, xmax: 7, ymin: -1, ymax: 7 }, note: 'The points satisfying $x+y\\le6$, $2x+y\\ge4$, $x\\ge0$ and $y\\ge0$ form the quadrilateral with vertices $(2,0)$, $(6,0)$, $(0,6)$ and $(0,4)$. The origin satisfies $x+y\\le6$ but not $2x+y\\ge4$, so it lies outside.' }
    ]
  },

  'c11-permutations-combinations': {
    objective: 'Count arrangements and selections with the multiplication principle, ${}^nP_r$ and ${}^nC_r$, including words with repeated letters and selections under a restriction.',
    intuition: 'Every formula here is the multiplication principle. To arrange $r$ of $n$ objects in a row there are $n$ choices for the first place, $n-1$ for the second, and so on, which is ${}^nP_r$. A selection ignores order, and each selection of $r$ objects can be put in order in $r(r-1)\\cdots2\\cdot1$ ways, so ${}^nC_r$ is ${}^nP_r$ divided by that number. Repeated letters work the same way: swapping two identical letters makes no new word, so you divide by the number of ways of arranging them.',
    check: [
      { question: 'How many three-digit numbers can be formed from the digits $1,2,3,4,5,6$ if no digit is repeated?', answer: '${}^6P_3=6\\cdot5\\cdot4=120$.', verify: { kind: 'value', expr: '6*5*4', answer: '120' } },
      { question: 'In how many ways can the letters of the word BANANA be arranged?', answer: 'Six different letters could be ordered in $720$ ways. Swapping the three A among themselves ($6$ ways) or the two N ($2$ ways) gives the same word, so there are $\\dfrac{720}{6\\times2}=60$ arrangements.', verify: { kind: 'value', expr: '6!/(3!*2!)', answer: '60' } },
      { question: 'A team of $5$ is chosen from $6$ boys and $4$ girls so that it has at least $2$ girls. In how many ways can this be done?', answer: 'Two, three or four girls: ${}^4C_2\\,{}^6C_3+{}^4C_3\\,{}^6C_2+{}^4C_4\\,{}^6C_1=120+60+6=186$.', verify: { kind: 'value', expr: '4C2*6C3+4C3*6C2+4C4*6C1', answer: '186' } }
    ],
    diagrams: [
      { title: 'The two counts in the committee example', spec: { kind: 'pascal', rows: 7, highlight: [[5, 2], [7, 1]], show: 'values' }, note: 'Choosing $2$ women from $5$ is ${}^5C_2=10$ and choosing $1$ man from $7$ is ${}^7C_1=7$. Each choice of women pairs with each choice of man, so the committee count is $10\\times7=70$. Each row reads the same from both ends because ${}^nC_r={}^nC_{n-r}$.' },
      { title: 'Row $n$ of Pascal\'s triangle as heads in $n$ tosses', spec: { kind: 'binomialExplorer', n: 6, p: 0.5 }, note: 'With $p=\\tfrac12$ each of the $2^n$ sequences of heads and tails is equally likely, and ${}^nC_k$ of them have exactly $k$ heads. For $n=6$ the tallest bar is at $k=3$, where $20$ of the $64$ sequences lie. Change $n$: the bars stay symmetric, because ${}^nC_k={}^nC_{n-k}$.' }
    ]
  },

  'c11-binomial-theorem': {
    objective: 'Expand $(a+b)^n$ for a positive integer $n$, write the general term $T_{r+1}$, and use it to find a given coefficient, the middle term or the term independent of $x$.',
    intuition: 'Write $(a+b)^n$ as $n$ brackets multiplied together. Each term of the expansion comes from choosing either $a$ or $b$ from every bracket. The product $a^{n-r}b^r$ appears once for each way of choosing which $r$ brackets give $b$, and there are ${}^nC_r$ such ways. That is the whole theorem: the coefficients count choices, which is why they are the numbers of Pascal\'s triangle.',
    check: [
      { question: 'Expand $(x+2)^4$.', answer: '$x^4+8x^3+24x^2+32x+16$.', verify: { kind: 'equivalent', a: '(x+2)^4', b: 'x^4+8*x^3+24*x^2+32*x+16' } },
      { question: 'Find the coefficient of $x^5$ in $(1-2x)^7$.', answer: '$T_6={}^7C_5(-2x)^5$, so the coefficient is $21\\times(-32)=-672$.', verify: { kind: 'value', expr: '7C5*(-2)^5', answer: '-672' } },
      { question: 'Find the term independent of $x$ in $\\left(2x-\\dfrac{1}{x^2}\\right)^9$.', answer: '$T_{r+1}={}^9C_r(2x)^{9-r}\\left(-\\tfrac{1}{x^2}\\right)^r$ has power $9-3r$, which is $0$ at $r=3$. So $T_4=-{}^9C_3\\cdot2^6=-5376$.', verify: { kind: 'value', expr: '9C3*2^6*(-1)^3', answer: '-5376' } }
    ],
    diagrams: [
      { title: 'Row $5$ gives the coefficients of $(a+b)^5$', spec: { kind: 'pascal', rows: 6, highlight: [[5, 3]], show: 'values' }, note: 'Row $5$ is $1,5,10,10,5,1$. In $(2+x)^5$ the $x^3$ term takes ${}^5C_3=10$ from this row and multiplies by $2^2$ for the two factors of $2$, giving the coefficient $40$.' },
      { title: '$(a+b)^2$ as an area', spec: { kind: 'areaModel', rows: [{ size: 3, label: 'a' }, { size: 2, label: 'b' }], cols: [{ size: 3, label: 'a' }, { size: 2, label: 'b' }], cells: [['a^2', 'ab'], ['ab', 'b^2']] }, note: 'A square of side $a+b$ splits into $a^2$, two rectangles $ab$ and $b^2$. The two rectangles are the coefficient $2={}^2C_1$: there are two ways to take one $a$ and one $b$.' },
      { title: 'The terms of $\\big((1-p)+p\\big)^n$', spec: { kind: 'binomialExplorer', n: 5, p: 0.3 }, note: 'Put $a=1-p$ and $b=p$. The bars are the terms ${}^nC_k\\,p^k(1-p)^{n-k}$ of $\\big((1-p)+p\\big)^n=1^n$, so they always add to $1$. With $n=5$ and $p=0.3$ the largest term is at $k=1$: $5\\times0.3\\times0.7^4\\approx0.360$.' }
    ]
  },

  'c11-sequences-series': {
    objective: 'Find the $n$th term and the sum of $n$ terms of an arithmetic or a geometric progression, find the sum to infinity of a geometric progression with $|r|<1$, and use arithmetic and geometric means.',
    intuition: 'An arithmetic progression climbs in equal steps, so its terms lie on a straight line, and the average of all the terms is the average of the first and the last: $S_n=\\tfrac{n}{2}(a+l)$. A geometric progression multiplies by the same ratio each time. When $|r|<1$ every term is a fixed fraction of the one before, and the terms shrink fast enough for the total to settle. In $8+4+2+1+\\cdots$ each new term covers exactly half of the gap still left to $16$.',
    check: [
      { question: 'The $5$th term of an AP is $17$ and the $12$th term is $38$. Find the first term and the common difference.', answer: '$7d=38-17=21$, so $d=3$ and $a=17-4\\cdot3=5$.', verify: { kind: 'values', pairs: [['5+4*3', '17'], ['5+11*3', '38']] } },
      { question: 'Find the sum of the first $20$ terms of $3+7+11+\\cdots$.', answer: '$S_{20}=\\tfrac{20}{2}\\left(2\\cdot3+19\\cdot4\\right)=10\\times82=820$.', verify: { kind: 'value', expr: '20/2*(2*3+19*4)', answer: '820' } },
      { question: 'Find the sum to infinity of $6-2+\\tfrac23-\\tfrac29+\\cdots$.', answer: '$a=6$ and $r=-\\tfrac13$, so $S_\\infty=\\dfrac{6}{1+\\frac13}=\\dfrac92$.', verify: { kind: 'value', expr: '6/(1+1/3)', answer: '9/2' } }
    ],
    diagrams: [
      { title: 'The AP $3,7,11,\\ldots$', spec: { kind: 'sequence', type: 'arithmetic', first: 3, step: 4, n: 8 }, note: 'The terms rise by $4$ each time, so their tops lie on a straight line. The eighth term is $a_8=3+7\\cdot4=31$.' },
      { title: 'Partial sums of $8+4+2+1+\\cdots$', spec: { kind: 'sequenceExplorer', type: 'geometric', first: 8, step: 0.5, n: 6 }, note: 'The six terms $8,4,2,1,\\tfrac12,\\tfrac14$ add to $15.75$, and every new term halves the gap to $S_\\infty=\\dfrac{8}{1-\\frac12}=16$. Set the ratio above $1$ and the partial sums no longer settle.' }
    ]
  },

  'c11-straight-lines': {
    objective: 'Find the slope of a line, write its equation in the form that suits the given data, decide whether two lines are parallel or perpendicular, and find the angle between two lines and the distance from a point to a line.',
    intuition: 'Slope is how much a line rises for each unit it runs: one step to the right, $m$ steps up. Every form of the equation says the same thing from different starting data: the slope from a fixed point to any point $(x,y)$ of the line is always $m$. The distance from a point to a line is measured along the perpendicular, because that is the shortest path, and that is why the formula divides by $\\sqrt{A^2+B^2}$, the length of the normal direction $(A,B)$.',
    check: [
      { question: 'Find the equation of the line through $(2,-1)$ and $(5,8)$.', answer: '$m=\\dfrac{8+1}{5-2}=3$, so $y+1=3(x-2)$, that is $y=3x-7$.', verify: { kind: 'values', pairs: [['(8+1)/(5-2)', '3'], ['3*2-7', '-1'], ['3*5-7', '8']] } },
      { question: 'Find the equation of the line through $(1,4)$ perpendicular to $2x-3y+6=0$.', answer: 'The given line has slope $\\tfrac23$, so the required slope is $-\\tfrac32$: $y-4=-\\tfrac32(x-1)$, that is $3x+2y-11=0$.', verify: { kind: 'values', pairs: [['3*1+2*4-11', '0'], ['(2/3)*(-3/2)', '-1']] } },
      { question: 'Find the distance between the parallel lines $3x+4y-12=0$ and $3x+4y+3=0$.', answer: '$d=\\dfrac{|-12-3|}{\\sqrt{3^2+4^2}}=\\dfrac{15}{5}=3$.', verify: { kind: 'value', expr: 'abs(-12-3)/sqrt(3^2+4^2)', answer: '3' } }
    ],
    diagrams: [
      { title: 'Slope, intercept and a perpendicular', spec: { kind: 'paramGraph', expr: 'm*x+c', params: [{ name: 'm', min: -4, max: 4, step: 0.5, initial: 2 }, { name: 'c', min: -6, max: 6, step: 1, initial: -1 }], xmin: -6, xmax: 6, ymin: -8, ymax: 8, show: ['yIntercept'], fixed: [{ expr: '-x/2+3', label: 'y=-\\tfrac12x+3' }] }, note: 'At $m=2$, $c=-1$ the line is $y=2x-1$: it crosses the $y$-axis at $-1$ and rises $2$ for every $1$ across. It is perpendicular to the fixed line because $2\\times\\left(-\\tfrac12\\right)=-1$. Change only $c$ and the line slides parallel to itself; change only $m$ and it turns about $(0,c)$.' },
      { title: 'The distance from $P(3,-2)$ to $3x-4y-7=0$', spec: { kind: 'plane', xmin: -2, xmax: 7, ymin: -4, ymax: 4, lines: [{ through: [[1, -1], [5, 2]], label: '3x-4y-7=0' }], points: [{ x: 3, y: -2, label: 'P', pos: 'se' }, { x: 1.8, y: -0.4, label: 'F', pos: 'nw' }], segments: [{ from: [3, -2], to: [1.8, -0.4], label: '2', dashed: true }], angles: [{ at: [1.8, -0.4], from: [5, 2], to: [3, -2], right: true }] }, note: 'The shortest path from $P(3,-2)$ to the line meets it at right angles, at the foot $F\\left(\\tfrac95,-\\tfrac25\\right)$. Its length is $\\dfrac{|9+8-7|}{\\sqrt{9+16}}=\\dfrac{10}{5}=2$, the answer to the worked example.' }
    ]
  },

  'c11-conic-sections': {
    objective: 'Write the standard equation of a circle, parabola, ellipse or hyperbola, and read off its centre or vertex, foci, directrix, eccentricity and latus rectum.',
    intuition: 'Every conic is a rule about distances. A circle is all points at a fixed distance from its centre. A parabola is all points as far from a focus as from a line, the directrix. An ellipse is all points whose distances to two foci add to a constant $2a$; a hyperbola, all points whose distances to two foci differ by $2a$. Squaring these distance statements produces the standard equations. The eccentricity measures how far a conic is from a circle: $e=0$ for a circle, $e<1$ for an ellipse, $e=1$ for a parabola and $e>1$ for a hyperbola.',
    check: [
      { question: 'Find the centre and radius of $x^2+y^2+8x-10y-8=0$.', answer: 'Here $g=4$, $f=-5$, $c=-8$: centre $(-4,5)$ and radius $\\sqrt{16+25+8}=7$.', verify: { kind: 'value', expr: 'sqrt(4^2+5^2+8)', answer: '7' } },
      { question: 'Find the focus, the directrix and the length of the latus rectum of $x^2=-16y$.', answer: '$4a=16$, so $a=4$ and the parabola opens downwards: focus $(0,-4)$, directrix $y=4$, latus rectum $16$.', verify: { kind: 'values', pairs: [['16/4', '4'], ['4*4', '16']] } },
      { question: 'Find the foci and the eccentricity of $\\dfrac{x^2}{9}-\\dfrac{y^2}{16}=1$.', answer: '$c^2=a^2+b^2=25$, so the foci are $(\\pm5,0)$ and $e=\\tfrac{c}{a}=\\tfrac53$.', verify: { kind: 'values', pairs: [['sqrt(9+16)', '5'], ['sqrt(9+16)/3', '5/3']] } }
    ],
    diagrams: [
      { title: 'The ellipse $\\dfrac{x^2}{25}+\\dfrac{y^2}{9}=1$ and its foci', spec: { kind: 'plane', xmin: -6, xmax: 6, ymin: -4, ymax: 4, param: [{ x: '5*cos(t)', y: '3*sin(t)', t: [0, 6.2832] }], points: [{ x: -4, y: 0, label: 'F_1', pos: 's' }, { x: 4, y: 0, label: 'F_2', pos: 's' }, { x: 0, y: 3, label: 'P', pos: 'n' }], segments: [{ from: [0, 3], to: [-4, 0], label: '5' }, { from: [0, 3], to: [4, 0], label: '5' }] }, note: 'Here $c^2=25-9=16$, so the foci are $(\\pm4,0)$. From $P(0,3)$ each focus is $5$ away, and $5+5=10=2a$. Every point of the ellipse gives the same total $10$.' },
      { title: 'The parabola $y^2=12x$: focus and directrix', spec: { kind: 'plane', xmin: -5, xmax: 8, ymin: -10, ymax: 10, param: [{ x: '3*t^2', y: '6*t', t: [-1.5, 1.5] }], lines: [{ through: [[-3, -1], [-3, 1]], label: 'x=-3' }], points: [{ x: 3, y: 0, label: 'S', pos: 'se' }, { x: 3, y: 6, label: 'P', pos: 'ne' }, { x: -3, y: 6, label: 'M', pos: 'w' }], segments: [{ from: [3, 6], to: [3, 0], label: '6' }, { from: [3, 6], to: [-3, 6], label: '6', dashed: true }] }, note: '$4a=12$ gives $a=3$: focus $S(3,0)$ and directrix $x=-3$. The point $P(3,6)$ is $6$ from the focus and $6$ from the directrix. $SP$ is half of the latus rectum, which runs from $(3,-6)$ to $(3,6)$ and has length $12$.' },
      { title: 'The hyperbola $\\dfrac{x^2}{9}-\\dfrac{y^2}{16}=1$', spec: { kind: 'plane', xmin: -8, xmax: 8, ymin: -8, ymax: 8, param: [{ x: '1.5*(t+1/t)', y: '2*(t-1/t)', t: [0.25, 4] }, { x: '-1.5*(t+1/t)', y: '2*(t-1/t)', t: [0.25, 4] }], lines: [{ through: [[0, 0], [3, 4]], label: 'y=\\tfrac43x' }, { through: [[0, 0], [3, -4]], label: 'y=-\\tfrac43x' }], points: [{ x: -5, y: 0, label: 'F_1', pos: 's' }, { x: 5, y: 0, label: 'F_2', pos: 's' }, { x: 6, y: 6.9282, label: 'P', pos: 'e' }], segments: [{ from: [6, 6.9282], to: [-5, 0], label: '13' }, { from: [6, 6.9282], to: [5, 0], label: '7' }] }, note: '$c^2=9+16=25$, so the foci are $(\\pm5,0)$. The point $P(6,4\\sqrt3)$ is $13$ from $F_1$ and $7$ from $F_2$; the difference $6$ is $2a$. Far from the centre the branches run close to the asymptotes $y=\\pm\\tfrac43x$.' },
      { title: 'Moving the focus of $x^2=4ay$', spec: { kind: 'paramGraph', expr: 'x^2/(4*a)', params: [{ name: 'a', min: 0.5, max: 4, step: 0.5, initial: 1 }], xmin: -6, xmax: 6, ymin: -1, ymax: 8, show: ['vertex'] }, note: 'This is the parabola $y^2=4ax$ turned on its side: focus $(0,a)$ and directrix $y=-a$. At $a=1$ the latus rectum runs from $(-2,1)$ to $(2,1)$, length $4$. Increase $a$ and the focus moves away from the vertex while the curve opens wider, since the latus rectum $4a$ grows with it.' }
    ]
  },

  'c11-3d-introduction': {
    objective: 'Locate a point in space by its coordinates and octant, and find the distance between two points and the point that divides a segment in a given ratio.',
    intuition: 'To reach $(2,3,6)$ from the origin, walk $2$ along the $x$-axis, $3$ parallel to the $y$-axis, then climb $6$ parallel to the $z$-axis. Those three walks are edges of a cuboid, and the straight path from the origin is its diagonal. Pythagoras twice gives the length: $\\sqrt{2^2+3^2}=\\sqrt{13}$ across the floor, then $\\sqrt{13+6^2}=7$ up through the box. Every formula in this chapter is the plane formula with a $z$ term added.',
    check: [
      { question: 'Give the signs of the coordinates in the octant containing $(-3,4,-5)$, and find its distance from the origin.', answer: 'The octant where $x<0$, $y>0$ and $z<0$. The distance is $\\sqrt{9+16+25}=\\sqrt{50}=5\\sqrt2$.', verify: { kind: 'value', expr: 'sqrt(3^2+4^2+5^2)', answer: '5*sqrt(2)' } },
      { question: 'For $A(1,-2,3)$ and $B(5,2,5)$, find the midpoint of $AB$ and the length $AB$.', answer: 'Midpoint $(3,0,4)$; $AB=\\sqrt{16+16+4}=6$.', verify: { kind: 'values', pairs: [['(1+5)/2', '3'], ['(-2+2)/2', '0'], ['(3+5)/2', '4'], ['sqrt(4^2+4^2+2^2)', '6']] } },
      { question: 'In what ratio does the $yz$-plane divide the segment joining $(-2,4,7)$ and $(3,-5,8)$?', answer: 'On the $yz$-plane $x=0$: $\\dfrac{3k-2}{k+1}=0$ gives $k=\\tfrac23$, so the ratio is $2:3$, internally.', verify: { kind: 'value', expr: '(2*3+3*(-2))/(2+3)', answer: '0' } }
    ],
    diagrams: [
      { title: 'The point $(2,3,6)$ as the far corner of a box', spec: { kind: 'space3d', points: [{ x: 2, y: 3, z: 6, label: 'P' }], vectors: [{ from: [0, 0, 0], to: [2, 3, 6], label: 'OP' }], box: true }, note: 'The box with edges $2$, $3$ and $6$ has $O$ and $P$ at opposite corners. Its floor diagonal is $\\sqrt{13}$, and $OP=\\sqrt{13+36}=7$.' },
      { title: 'The point dividing $AB$ in the ratio $2:1$', spec: { kind: 'space3d', points: [{ x: 2, y: 1, z: -3, label: 'A' }, { x: 5, y: -8, z: 3, label: 'B' }, { x: 4, y: -5, z: 1, label: 'P' }], vectors: [{ from: [2, 1, -3], to: [5, -8, 3] }] }, note: 'From $A(2,1,-3)$ to $B(5,-8,3)$ the coordinates change by $3$, $-9$ and $6$. The point $P$ two-thirds of the way along adds two-thirds of each change: $(2+2,\\ 1-6,\\ -3+4)=(4,-5,1)$.' }
    ],
    interactiveNone: 'The ideas here are read from a fixed drawing: octants, the distance formula and the section formula. The kit has no rotatable three-dimensional view, and moving a slider would not teach these formulas better than the two figures.'
  },

  'c11-limits-derivatives': {
    objective: 'Evaluate algebraic and trigonometric limits, find a derivative from first principles, and differentiate sums, products and quotients of polynomial and trigonometric functions.',
    intuition: 'A limit asks what value $f(x)$ approaches as $x$ gets close to $a$, without asking what happens at $a$ itself. The derivative is built on exactly this. The slope of a chord from $x$ to $x+h$ is an ordinary fraction. As $h$ shrinks, the chord turns and settles on the tangent, and the number its slope settles on is $f\'(x)$. You cannot simply put $h=0$, because the fraction becomes $\\tfrac00$; the limit is how you get round that.',
    check: [
      { question: 'Evaluate $\\displaystyle\\lim_{x\\to1}\\frac{x^3-1}{x-1}$.', answer: 'Using $\\displaystyle\\lim_{x\\to a}\\frac{x^n-a^n}{x-a}=na^{n-1}$ with $n=3$, $a=1$: the limit is $3$.', verify: { kind: 'value', expr: '3*1^2', answer: '3' } },
      { question: 'Evaluate $\\displaystyle\\lim_{x\\to0}\\frac{\\sin5x}{3x}$.', answer: '$\\dfrac{\\sin5x}{3x}=\\dfrac53\\cdot\\dfrac{\\sin5x}{5x}\\to\\dfrac53$.', verify: { kind: 'value', expr: 'sin(5*10^(-4))/(3*10^(-4))', answer: '5/3' } },
      { question: 'For $f(x)=\\dfrac{x+1}{x-1}$, find $f\'(x)$ and $f\'(3)$.', answer: 'By the quotient rule $f\'(x)=\\dfrac{(x-1)-(x+1)}{(x-1)^2}=-\\dfrac{2}{(x-1)^2}$, so $f\'(3)=-\\tfrac12$.', verify: { kind: 'value', expr: '((3.0001+1)/(3.0001-1)-(2.9999+1)/(2.9999-1))/0.0002', answer: '-1/2' } }
    ],
    diagrams: [
      { title: 'Chords of $y=x^2$ closing in on the tangent at $x=3$', spec: { kind: 'secantToTangent', expr: 'x^2', x0: 3, xmin: -1, xmax: 6, ymin: -2, ymax: 30 }, note: 'From $x=3$ to $x=4$ ($h=1$) the chord has slope $\\dfrac{16-9}{1}=7$. In general it is $\\dfrac{(3+h)^2-9}{h}=6+h$, so as $h\\to0$ the slope settles on $6$, the derivative of $x^2$ at $x=3$.' },
      { title: 'A limit where the function has a gap', spec: { kind: 'plane', xmin: -2, xmax: 7, ymin: -1, ymax: 11, curves: [{ expr: '(x^2-9)/(x-3)', domain: [-2, 2.9] }, { expr: '(x^2-9)/(x-3)', domain: [3.1, 7] }], circles: [{ cx: 3, cy: 6, r: 0.1 }], points: [], segments: [{ from: [3, 0], to: [3, 6], dashed: true }, { from: [0, 6], to: [3, 6], dashed: true }] }, note: 'For $x\\ne3$, $\\dfrac{x^2-9}{x-3}=x+3$, so the graph is the line $y=x+3$ with a gap at $x=3$, where the formula gives $\\tfrac00$. As $x\\to3$ from either side the height approaches $6$, so the limit is $6$ although $f(3)$ is not defined.' }
    ]
  },

  'c11-statistics': {
    objective: 'Measure the spread of a data set by its range, mean deviation, variance and standard deviation, for ungrouped and grouped data, and compare two series by their coefficients of variation.',
    intuition: 'Two classes can have the same average mark and still be very different: in one everyone scored close to $60$, in the other the marks are split between the $20$s and the $90$s. The mean cannot tell them apart; a measure of spread can. Standard deviation asks how far a typical value sits from the mean. Squaring the deviations stops positive and negative ones cancelling and gives large gaps more weight; the square root at the end brings the answer back to the units of the data.',
    check: [
      { question: 'Find the mean deviation about the median of $4, 7, 8, 9, 10, 12, 13, 17$.', answer: 'The median is $\\tfrac{9+10}{2}=9.5$. The absolute deviations add to $24$, so the mean deviation is $\\tfrac{24}{8}=3$.', verify: { kind: 'value', expr: '(abs(4-9.5)+abs(7-9.5)+abs(8-9.5)+abs(9-9.5)+abs(10-9.5)+abs(12-9.5)+abs(13-9.5)+abs(17-9.5))/8', answer: '3' } },
      { question: 'Find the variance and the standard deviation of $5, 9, 11, 13, 17$.', answer: 'The mean is $11$; the squared deviations are $36,4,0,4,36$, so $\\sigma^2=\\tfrac{80}{5}=16$ and $\\sigma=4$.', verify: { kind: 'values', pairs: [['(5+9+11+13+17)/5', '11'], ['(36+4+0+4+36)/5', '16']] } },
      { question: 'Series $X$ has mean $40$ and standard deviation $8$; series $Y$ has mean $50$ and standard deviation $9$. Which is more variable?', answer: '$\\text{CV}_X=\\tfrac{8}{40}\\times100=20$ and $\\text{CV}_Y=\\tfrac{9}{50}\\times100=18$, so $X$ is more variable although its standard deviation is smaller.', verify: { kind: 'values', pairs: [['8/40*100', '20'], ['9/50*100', '18']] } }
    ],
    diagrams: [
      { title: 'Same mean, different spread', spec: { kind: 'barChart', categories: ['2', '4', '6', '8', '10'], values: [1, 3, 6, 3, 1], label: 'A', dual: { values: [3, 2, 4, 2, 3], label: 'B' }, yLabel: 'Frequency' }, note: 'Both distributions have $N=14$ and mean $6$. In $A$ most values sit at $6$, and $\\sigma=2$. In $B$ more weight lies at $2$ and $10$, and $\\sigma=2\\sqrt2\\approx2.83$.' },
      { title: 'What moves when one value moves', spec: { kind: 'dataExplorer', data: [3, 7, 8, 10, 12], editable: [4], show: ['mean', 'median', 'sd'] }, note: 'These are the data of the mean deviation example: mean $8$, median $8$, $\\sigma=\\sqrt{9.2}\\approx3.03$. Drag the largest value up from $12$: the mean and the standard deviation grow with it, but the median stays at $8$.' }
    ]
  },

  'c11-probability': {
    objective: 'Write the sample space of an experiment, describe events as sets, and find probabilities with the complement and addition rules, including for events that overlap.',
    intuition: 'When the outcomes of an experiment are equally likely, $P(E)$ is the fraction of them that lie in $E$, so the rules of probability are the rules for counting sets, divided by $n(S)$. The addition rule is the counting rule for a union: outcomes in both $A$ and $B$ would otherwise be counted twice, so $P(A\\cap B)$ is subtracted once. The danger is assuming outcomes are equally likely when they are not: the sum of two dice is $7$ in six ways but $2$ in only one.',
    check: [
      { question: 'A card is drawn from a well-shuffled pack of $52$. Find the probability that it is a king or a heart.', answer: '$P=\\dfrac{4+13-1}{52}=\\dfrac{16}{52}=\\dfrac{4}{13}$, subtracting the king of hearts once.', verify: { kind: 'value', expr: '(4+13-1)/52', answer: '4/13' } },
      { question: 'Two dice are thrown. Find the probability that the sum is at least $10$.', answer: 'Sums $10$, $11$ and $12$ occur in $3$, $2$ and $1$ of the $36$ outcomes, so $P=\\tfrac{6}{36}=\\tfrac16$.', verify: { kind: 'value', expr: '(3+2+1)/36', answer: '1/6' } },
      { question: 'Given $P(A)=0.42$, $P(B)=0.48$ and $P(A\\cap B)=0.16$, find $P(\\text{not }A)$, $P(A\\cup B)$ and $P(A\\cap B\')$.', answer: '$P(\\text{not }A)=0.58$, $P(A\\cup B)=0.42+0.48-0.16=0.74$ and $P(A\\cap B\')=0.42-0.16=0.26$.', verify: { kind: 'values', pairs: [['1-0.42', '0.58'], ['0.42+0.48-0.16', '0.74'], ['0.42-0.16', '0.26']] } }
    ],
    diagrams: [
      { title: 'Sums of two dice: not equally likely', spec: { kind: 'probabilitySim', experiment: 'twoDiceSum', seed: 11 }, note: 'The eleven sums are not equally likely. Theory gives $P(7)=\\tfrac{6}{36}=\\tfrac16$ but $P(2)=P(12)=\\tfrac{1}{36}$. Add $1000$ throws and the bars settle close to that triangular shape.' },
      { title: 'The addition rule in a Venn diagram', spec: { kind: 'venn', sets: 2, labels: ['A', 'B'], counts: { A: 30, AB: 20, B: 20, none: 30 }, universe: 100 }, note: 'With $P(A)=0.5$, $P(B)=0.4$ and $P(A\\cap B)=0.2$, out of every $100$ outcomes $20$ lie in both, $30$ in $A$ only and $20$ in $B$ only. So $P(A\\cup B)=0.3+0.2+0.2=0.7$, and $30$ in $100$ lie in neither.' },
      { title: 'Exactly one of two independent events', spec: { kind: 'tree', branches: [{ label: 'A', p: [3, 10], children: [{ label: 'B', p: [2, 5] }, { label: '\\bar B', p: [3, 5] }] }, { label: '\\bar A', p: [7, 10], children: [{ label: 'B', p: [2, 5] }, { label: '\\bar B', p: [3, 5] }] }] }, note: 'With $P(A)=0.3$ and $P(B)=0.4$, exactly one event happens on the two middle paths: $0.3\\times0.6+0.7\\times0.4=0.18+0.28=0.46$.' }
    ]
  }
};
