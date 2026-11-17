// Pri Learning · Experience 3 layer for CBSE Class 10 notes (see notes/e3.js). Original writing.
// Every number below was computed (engine evalNumeric or by hand and re-checked), never recalled.
const R3 = Math.sqrt(3);

export default {
  'c10-real-numbers': {
    objective: 'Find the HCF and LCM of two numbers from their prime factorisations or by Euclid\'s algorithm, and prove that a number such as $\\sqrt{3}$ is irrational.',
    intuition: 'Primes are the atoms of the whole numbers: every number above $1$ is built from them in exactly one way. Once two numbers are written as products of primes, the HCF is the part they share and the LCM is the smallest number that contains both, so the exponents decide everything. Euclid\'s algorithm reaches the HCF without factorising at all. Any number that divides both $a$ and $b$ also divides the remainder when $a$ is divided by $b$, so the pair can keep shrinking without ever losing a common divisor.',
    check: [
      { question: 'Write $156$ as a product of primes.', answer: '$156=2^2\\times3\\times13$', verify: { kind: 'value', expr: '2^2*3*13', answer: '156' } },
      { question: 'The HCF of two numbers is $9$ and their LCM is $360$. One of the numbers is $45$. Find the other.', answer: '$\\tfrac{9\\times360}{45}=72$', verify: { kind: 'value', expr: '9*360/45', answer: '72' } },
      { question: 'Use Euclid\'s algorithm to find the HCF of $455$ and $42$.', answer: '$455=10\\times42+35$, $42=1\\times35+7$, $35=5\\times7$, so the HCF is $7$.', verify: { kind: 'values', pairs: [['455-10*42', '35'], ['42-1*35', '7'], ['35-5*7', '0']] } }
    ],
    diagrams: [
      {
        title: 'Euclid\'s algorithm as squares in a rectangle',
        spec: {
          kind: 'plane', xmin: -10, xmax: 260, ymin: -10, ymax: 210, axes: false, grid: false,
          polygons: [
            { points: [[0, 0], [198, 0], [198, 198], [0, 198]], label: '198' },
            { points: [[198, 0], [252, 0], [252, 54], [198, 54]], label: '54' },
            { points: [[198, 54], [252, 54], [252, 108], [198, 108]], label: '54' },
            { points: [[198, 108], [252, 108], [252, 162], [198, 162]], label: '54' },
            { points: [[198, 162], [234, 162], [234, 198], [198, 198]], label: '36' },
            { points: [[234, 162], [252, 162], [252, 180], [234, 180]], shade: true },
            { points: [[234, 180], [252, 180], [252, 198], [234, 198]], shade: true }
          ]
        },
        note: 'A $252$ by $198$ rectangle is cut into the largest squares that fit: one of side $198$, three of side $54$, one of side $36$, and the two shaded squares of side $18$. Each new side is a remainder in Euclid\'s algorithm: $252=1\\times198+54$, $198=3\\times54+36$, $54=1\\times36+18$, $36=2\\times18$. The squares of side $18$ fill what is left exactly, so $\\text{HCF}(252,198)=18$.'
      },
      {
        title: 'HCF and LCM from prime powers',
        spec: { kind: 'barChart', categories: ['2', '3', '5', '7'], values: [3, 2, 1, 0], yLabel: 'power in 360', dual: { values: [2, 1, 0, 1], label: 'power in 84' } },
        note: 'Here $360=2^3\\times3^2\\times5$ and $84=2^2\\times3\\times7$. The HCF takes the lower bar for each prime, $2^2\\times3=12$; the LCM takes the higher bar, $2^3\\times3^2\\times5\\times7=2520$. As a check, $12\\times2520=30240=360\\times84$.'
      }
    ],
    interactiveNone: 'Every idea in this chapter is about whole numbers and exact divisibility, so there is no continuous quantity to slide; the rectangle of squares and the prime-power chart show each argument whole.'
  },

  'c10-polynomials': {
    objective: 'Find the zeroes of a quadratic polynomial, read them from its graph, and use $\\alpha+\\beta=-\\tfrac{b}{a}$ and $\\alpha\\beta=\\tfrac{c}{a}$ to check them or to build a polynomial from given zeroes.',
    intuition: 'A zero is an input that makes the polynomial equal to $0$, so on the graph it is a place where the curve meets the $x$-axis. If a quadratic has zeroes $\\alpha$ and $\\beta$, it is a multiple of $(x-\\alpha)(x-\\beta)$, and multiplying out gives $x^2-(\\alpha+\\beta)x+\\alpha\\beta$. That is the whole reason the sum and the product of the zeroes appear in the coefficients. Changing only the constant term slides the parabola up or down: the two zeroes move towards each other, meet, and then vanish, while their sum stays fixed.',
    check: [
      { question: 'Find the zeroes of $x^2-7x+10$.', answer: '$x^2-7x+10=(x-2)(x-5)$, so the zeroes are $2$ and $5$.', verify: { kind: 'roots', f: 'x^2-7*x+10', answers: ['2', '5'] } },
      { question: 'Find a quadratic polynomial whose zeroes have sum $4$ and product $-21$, and find the zeroes.', answer: '$x^2-4x-21=(x-7)(x+3)$, with zeroes $7$ and $-3$.', verify: { kind: 'equivalent', a: '(x-7)*(x+3)', b: 'x^2-4*x-21' } },
      { question: 'If $\\alpha$ and $\\beta$ are the zeroes of $x^2-5x+3$, find $\\alpha^2+\\beta^2$ without finding the zeroes.', answer: '$\\alpha+\\beta=5$ and $\\alpha\\beta=3$, so $\\alpha^2+\\beta^2=(\\alpha+\\beta)^2-2\\alpha\\beta=25-6=19$.', verify: { kind: 'value', expr: '5^2-2*3', answer: '19' } }
    ],
    diagrams: [
      {
        title: 'Zeroes of $x^2+bx+c$ as the parabola moves',
        spec: {
          kind: 'paramGraph', expr: 'x^2+b*x+c',
          params: [{ name: 'b', min: -6, max: 6, step: 1, initial: -2 }, { name: 'c', min: -10, max: 6, step: 1, initial: -8 }],
          xmin: -6, xmax: 7, ymin: -12, ymax: 10, show: ['roots', 'vertex', 'yIntercept']
        },
        note: 'It starts at $x^2-2x-8$, with zeroes $-2$ and $4$: their sum is $2=-\\tfrac{b}{a}$ and their product is $-8=\\tfrac{c}{a}$. Raise $c$ and the zeroes close in on $x=1$; at $c=1$ they meet, since $x^2-2x+1=(x-1)^2$, and above that the parabola misses the axis. Change $b$ and the axis of symmetry $x=-\\tfrac{b}{2}$ moves, always halfway between the zeroes.'
      },
      {
        title: 'A cubic with three zeroes',
        spec: { kind: 'function', xmin: -4, xmax: 4, ymin: -6, ymax: 6, curves: [{ expr: 'x^3-4*x', label: 'y=x^3-4x', intercepts: true }] },
        note: 'Since $x^3-4x=x(x-2)(x+2)$, the curve crosses the $x$-axis at $-2$, $0$ and $2$. A polynomial of degree $3$ has at most three zeroes, and this one has all three.'
      }
    ]
  },

  'c10-pair-linear-equations': {
    objective: 'Solve a pair of linear equations by substitution or elimination, and decide from the ratios of the coefficients whether the pair has one solution, none or infinitely many.',
    intuition: 'Each linear equation in $x$ and $y$ is a straight line: the set of all points that satisfy it. A solution of the pair has to satisfy both, so it is a point on both lines, which is where they cross. Two lines in a plane either cross once, never cross because they are parallel, or lie on top of each other, and that is exactly why a pair has one solution, none, or infinitely many. Substitution and elimination find the crossing point by algebra, which is exact where a drawing is not.',
    check: [
      { question: 'Solve $2x+y=11$ and $x-y=1$.', answer: 'Adding gives $3x=12$, so $x=4$ and $y=3$.', verify: { kind: 'values', pairs: [['2*4+3', '11'], ['4-3', '1']] } },
      { question: 'For what value of $k$ does the pair $kx+3y=5$ and $2x+6y=7$ have no solution?', answer: '$k=1$. Then $\\tfrac{k}{2}=\\tfrac{3}{6}=\\tfrac12$ but $\\tfrac{5}{7}\\ne\\tfrac12$, so the lines are parallel.', verify: { kind: 'value', expr: '2*3/6', answer: '1' } },
      { question: 'A taxi charges a fixed amount plus a rate per kilometre. A $10$ km ride costs ₹105 and a $15$ km ride costs ₹155. Find the fixed charge and the rate.', answer: 'From $F+10r=105$ and $F+15r=155$, $5r=50$, so the rate is ₹10 per km and the fixed charge is ₹5.', verify: { kind: 'values', pairs: [['5+10*10', '105'], ['5+15*10', '155']] } }
    ],
    diagrams: [
      {
        title: 'One line fixed, one line you can move',
        spec: {
          kind: 'paramGraph', expr: 'm*x+c',
          params: [{ name: 'm', min: -3, max: 3, step: 0.5, initial: 1, label: 'slope' }, { name: 'c', min: -6, max: 16, step: 1, initial: -4, label: 'y-intercept' }],
          xmin: -2, xmax: 16, ymin: -6, ymax: 16, show: ['yIntercept'],
          fixed: [{ expr: '14-x', label: 'x+y=14' }]
        },
        note: 'The fixed line is $x+y=14$. The moving line starts as $y=x-4$, that is $x-y=4$, and the two meet at $(9,5)$, the solution of the first worked example. Set $m=-1$ and the lines are parallel, so the pair has no solution; with $m=-1$ and $c=14$ as well, the lines coincide and every point on them is a solution.'
      },
      {
        title: 'Pencils and pens',
        spec: {
          kind: 'function', xmin: -1, xmax: 11, ymin: -1, ymax: 11,
          curves: [{ expr: '(50-5*x)/7', label: '5x+7y=50' }, { expr: '(46-7*x)/5', label: '7x+5y=46' }],
          points: [{ x: 3, y: 5, label: '(3,5)' }]
        },
        note: 'Five pencils and seven pens for ₹50 gives $5x+7y=50$; seven pencils and five pens for ₹46 gives $7x+5y=46$. The lines meet at $(3,5)$: a pencil costs ₹3 and a pen ₹5, and indeed $15+35=50$ and $21+25=46$.'
      }
    ]
  },

  'c10-quadratic-equations': {
    objective: 'Solve a quadratic equation by factorisation or by the quadratic formula, and use the discriminant $b^2-4ac$ to say how many real roots it has before solving it.',
    intuition: 'The roots of $ax^2+bx+c=0$ are the places where the parabola $y=ax^2+bx+c$ meets the $x$-axis. The formula $x=\\tfrac{-b\\pm\\sqrt{b^2-4ac}}{2a}$ says the two roots sit symmetrically either side of the axis of symmetry $x=-\\tfrac{b}{2a}$, and the square root sets how far apart they are. So the discriminant measures the gap: positive gives two roots, zero squeezes them into one, and negative asks for the square root of a negative number, which means the parabola never reaches the axis.',
    check: [
      { question: 'Solve $x^2-x-12=0$.', answer: '$(x-4)(x+3)=0$, so $x=4$ or $x=-3$.', verify: { kind: 'roots', f: 'x^2-x-12', answers: ['4', '-3'] } },
      { question: 'Find the values of $k$ for which $x^2+kx+9=0$ has two equal roots.', answer: 'Equal roots need $k^2-36=0$, so $k=6$ or $k=-6$.', verify: { kind: 'roots', var: 'k', f: 'k^2-4*1*9', answers: ['6', '-6'] } },
      { question: 'The product of two consecutive positive integers is $306$. Find them.', answer: 'With $x(x+1)=306$, $x^2+x-306=0$ gives $x=17$ or $x=-18$. Only $17$ is positive, so the integers are $17$ and $18$.', verify: { kind: 'roots', f: 'x^2+x-306', answers: ['17', '-18'] } }
    ],
    diagrams: [
      {
        title: 'The discriminant as the parabola moves',
        spec: {
          kind: 'paramGraph', expr: 'a*x^2+b*x+c',
          params: [{ name: 'a', min: 0.5, max: 3, step: 0.5, initial: 1 }, { name: 'b', min: -6, max: 6, step: 1, initial: -4 }, { name: 'c', min: -4, max: 8, step: 1, initial: 1 }],
          xmin: -2, xmax: 6, ymin: -5, ymax: 8, show: ['roots', 'vertex']
        },
        note: 'It starts at $x^2-4x+1$, where $D=16-4=12$ and the roots are $2\\pm\\sqrt{3}$, about $0.27$ and $3.73$. Raise $c$ to $4$: now $D=16-16=0$ and the two roots merge at the vertex, $x=2$. Raise $c$ further and $D<0$: the parabola lifts clear of the axis and there are no real roots.'
      },
      {
        title: 'Two roots, one root, no real roots',
        spec: {
          kind: 'function', xmin: -1, xmax: 5, ymin: -2, ymax: 8,
          curves: [{ expr: 'x^2-4*x+3', label: 'D=4', intercepts: true }, { expr: 'x^2-4*x+4', label: 'D=0' }, { expr: 'x^2-4*x+6', label: 'D=-8' }]
        },
        note: 'All three have $a=1$ and $b=-4$, so they share the axis $x=2$. With $c=3$, $D=4$ and the roots are $1$ and $3$; with $c=4$, $D=0$ and the only root is $2$; with $c=6$, $D=-8$ and the curve stays above the axis.'
      }
    ]
  },

  'c10-arithmetic-progressions': {
    objective: 'Find any term of an arithmetic progression with $a_n=a+(n-1)d$, and the sum of its first $n$ terms with $S_n=\\tfrac{n}{2}\\left[2a+(n-1)d\\right]$.',
    intuition: 'An AP grows by the same step every time, so its terms plotted against their position lie on a straight line whose slope is $d$. Getting from the first term to term $n$ takes $n-1$ steps, not $n$, which is where the $n-1$ in the formula comes from. For the sum, write the terms forwards and then backwards underneath: every pair adds to the same amount, first plus last, so the sum is the number of terms times the average of the first and last terms.',
    check: [
      { question: 'Find the $11$th term of $5, 9, 13, \\ldots$', answer: '$a_{11}=5+10\\times4=45$', verify: { kind: 'value', expr: '5+10*4', answer: '45' } },
      { question: 'Which term of $7, 13, 19, \\ldots$ is $205$?', answer: '$7+6(n-1)=205$ gives $n-1=33$, so it is the $34$th term.', verify: { kind: 'value', expr: '(205-7)/6+1', answer: '34' } },
      { question: 'Find the sum of all two-digit multiples of $7$.', answer: 'They are $14, 21, \\ldots, 98$: $13$ terms, so the sum is $\\tfrac{13}{2}(14+98)=728$.', verify: { kind: 'values', pairs: [['(98-14)/7+1', '13'], ['13/2*(14+98)', '728']] } }
    ],
    diagrams: [
      {
        title: 'Terms and running sum of an AP',
        spec: { kind: 'sequenceExplorer', type: 'arithmetic', first: 3, step: 4, n: 20 },
        note: 'Starting at $3$ with $d=4$, each bar is $4$ taller than the one before, and the $20$th is $3+19\\times4=79$. The sum of all twenty is $\\tfrac{20}{2}(3+79)=820$, the first worked example. Make $d$ negative and the bars fall instead, so later terms pull the sum down.'
      },
      {
        title: 'Weekly savings',
        spec: { kind: 'sequence', type: 'arithmetic', first: 2, step: 5, n: 10 },
        note: 'Savings of ₹2, ₹7, ₹12 and so on go up by ₹5 a week. In week $10$ the saving is $2+9\\times5=47$ rupees, and over the ten weeks the total is $\\tfrac{10}{2}(2+47)=245$ rupees.'
      }
    ]
  },

  'c10-triangles': {
    objective: 'Use the Basic Proportionality Theorem and the AA, SSS and SAS criteria to prove triangles similar, and find unknown lengths and areas from equal ratios.',
    intuition: 'Similar triangles are one shape drawn at two sizes, like a photograph and its enlargement: every length is multiplied by the same scale factor and every angle stays the same. A line drawn parallel to one side of a triangle cuts off a smaller triangle with the same angles, so the small triangle is similar to the whole one, and that is why the other two sides are cut in the same ratio. Area is length times length, so areas scale by the square of the factor.',
    check: [
      { question: 'In $\\triangle PQR$, $ST\\parallel QR$ with $S$ on $PQ$ and $T$ on $PR$. If $PS=2$ cm, $SQ=3$ cm and $PT=3$ cm, find $TR$.', answer: '$\\tfrac{PS}{SQ}=\\tfrac{PT}{TR}$, so $TR=\\tfrac{3\\times3}{2}=4.5$ cm.', verify: { kind: 'value', expr: '3*3/2', answer: '4.5' } },
      { question: 'Two similar triangles have corresponding sides $4$ cm and $6$ cm. The smaller has area $48\\text{ cm}^2$. Find the area of the larger.', answer: '$48\\times\\left(\\tfrac{6}{4}\\right)^2=108\\text{ cm}^2$', verify: { kind: 'value', expr: '48*(6/4)^2', answer: '108' } },
      { question: 'The areas of two similar triangles are $81\\text{ cm}^2$ and $144\\text{ cm}^2$. A side of the smaller is $12$ cm. Find the corresponding side of the larger.', answer: 'The side ratio is $\\sqrt{\\tfrac{144}{81}}=\\tfrac{4}{3}$, so the side is $12\\times\\tfrac43=16$ cm.', verify: { kind: 'value', expr: '12*sqrt(144/81)', answer: '16' } }
    ],
    diagrams: [
      {
        title: 'A line parallel to one side',
        spec: {
          kind: 'plane', xmin: -1, xmax: 10, ymin: -1, ymax: 7, axes: false, grid: false,
          polygons: [{ points: [[3, 6], [0, 0], [9, 0]] }],
          segments: [{ from: [2, 4], to: [5, 4] }],
          points: [{ x: 3, y: 6, label: 'A', pos: 'n' }, { x: 0, y: 0, label: 'B', pos: 'sw' }, { x: 9, y: 0, label: 'C', pos: 'se' }, { x: 2, y: 4, label: 'D', pos: 'w' }, { x: 5, y: 4, label: 'E', pos: 'e' }]
        },
        note: 'Here $DE\\parallel BC$ and $D$ is one third of the way from $A$ to $B$. Then $E$ is one third of the way from $A$ to $C$, so $AD:DB=AE:EC=1:2$. The small triangle $ADE$ is similar to $ABC$ with scale factor $\\tfrac13$: $DE=3$ against $BC=9$.'
      },
      {
        title: 'Scale factor and area',
        spec: { kind: 'triangleExplorer', mode: 'similar', initial: { a: 3, b: 4, c: 5, k: 2 } },
        note: 'Two similar triangles with scale factor $k$. At $k=2$ every side has doubled but the area is $4$ times as large. In the worked example the sides are in the ratio $3:5$, so the areas are in the ratio $9:25$ and $45\\text{ cm}^2$ becomes $125\\text{ cm}^2$.'
      }
    ]
  },

  'c10-coordinate-geometry': {
    objective: 'Find the distance between two points, the midpoint of a segment and the point dividing it in a given ratio, and use these to test what shape a set of points makes.',
    intuition: 'Two points on the grid are the ends of the hypotenuse of a right triangle whose legs run along the grid lines: one leg is the change in $x$, the other the change in $y$. The distance formula is Pythagoras applied to that triangle. The section formula is a weighted average: the point that splits $AB$ in the ratio $m_1:m_2$ has travelled $\\tfrac{m_1}{m_1+m_2}$ of the way from $A$ to $B$, in $x$ and in $y$ alike.',
    check: [
      { question: 'Find the distance between $(-3,4)$ and $(5,-2)$.', answer: 'The legs are $8$ and $6$, so the distance is $\\sqrt{64+36}=10$ units.', verify: { kind: 'value', expr: 'sqrt((5+3)^2+(-2-4)^2)', answer: '10' } },
      { question: 'Find the midpoint of the segment joining $(-4,7)$ and $(6,-1)$.', answer: '$\\left(\\tfrac{-4+6}{2},\\tfrac{7-1}{2}\\right)=(1,3)$', verify: { kind: 'values', pairs: [['(-4+6)/2', '1'], ['(7-1)/2', '3']] } },
      { question: 'In what ratio does the point $(-1,6)$ divide the segment joining $(-3,10)$ and $(6,-8)$?', answer: 'Take the ratio as $k:1$. From the $x$-coordinates, $\\tfrac{6k-3}{k+1}=-1$, so $7k=2$ and $k=\\tfrac27$: the ratio is $2:7$. The $y$-coordinate checks: $\\tfrac{2\\times(-8)+7\\times10}{9}=6$.', verify: { kind: 'values', pairs: [['(2*6+7*(-3))/(2+7)', '-1'], ['(2*(-8)+7*10)/(2+7)', '6']] } }
    ],
    diagrams: [
      {
        title: 'Distance as a hypotenuse',
        spec: {
          kind: 'plane', xmin: -1, xmax: 12, ymin: -5, ymax: 5,
          points: [{ x: 2, y: 3, label: 'A(2,3)', pos: 'nw' }, { x: 10, y: -3, label: 'B(10,-3)', pos: 'se' }, { x: 10, y: 3, label: 'C', pos: 'ne' }],
          segments: [{ from: [2, 3], to: [10, -3], label: '10' }, { from: [2, 3], to: [10, 3], label: '8', dashed: true }, { from: [10, 3], to: [10, -3], label: '6', dashed: true }],
          angles: [{ at: [10, 3], from: [2, 3], to: [10, -3], right: true }]
        },
        note: 'From $A(2,3)$ to $B(10,-3)$ the horizontal leg is $10-2=8$ and the vertical leg is $6$, from $y=3$ down to $y=-3$. So $AB=\\sqrt{8^2+6^2}=\\sqrt{100}=10$, the first worked example.'
      },
      {
        title: 'The section formula as equal steps',
        spec: {
          kind: 'plane', xmin: -3, xmax: 6, ymin: -5, ymax: 9,
          segments: [{ from: [-1, 7], to: [4, -3] }],
          points: [
            { x: -1, y: 7, label: 'A(-1,7)', pos: 'w' }, { x: 0, y: 5 }, { x: 1, y: 3, label: 'P(1,3)', pos: 'e' }, { x: 2, y: 1 }, { x: 3, y: -1 },
            { x: 4, y: -3, label: 'B(4,-3)', pos: 'e' }
          ]
        },
        note: 'Cut $AB$ into five equal steps of $1$ across and $2$ down. $P$ is two steps from $A$ and three from $B$, so it divides $AB$ in the ratio $2:3$. The section formula agrees: $x=\\tfrac{2\\times4+3\\times(-1)}{5}=1$ and $y=\\tfrac{2\\times(-3)+3\\times7}{5}=3$.'
      },
      {
        title: 'Change in $x$, change in $y$, distance',
        spec: { kind: 'triangleExplorer', mode: 'pythagoras', initial: { a: 8, b: 6 } },
        note: 'The two legs are the change in $x$ and the change in $y$; the hypotenuse is the distance between the points. Legs $8$ and $6$ give $10$, as in the first worked example; legs $5$ and $12$ give $13$.'
      }
    ]
  },

  'c10-trigonometry': {
    objective: 'Find the six trigonometric ratios of an acute angle from a right triangle, use their values at $0^\\circ$, $30^\\circ$, $45^\\circ$, $60^\\circ$ and $90^\\circ$, and apply $\\sin^2A+\\cos^2A=1$ to evaluate expressions and prove identities.',
    intuition: 'Every right triangle with an acute angle of $35^\\circ$ has the same shape, whatever its size, because triangles with equal angles are similar. So the ratio of the side opposite that angle to the hypotenuse depends only on the angle, and it gets a name, $\\sin 35^\\circ$. The standard values come from two triangles you can draw exactly: half of an equilateral triangle gives $30^\\circ$ and $60^\\circ$, and half of a square gives $45^\\circ$. The identity $\\sin^2A+\\cos^2A=1$ is Pythagoras divided through by the square of the hypotenuse.',
    check: [
      { question: 'If $\\tan A=\\tfrac{5}{12}$ for an acute angle $A$, find $\\sin A$.', answer: 'Take opposite $5$ and adjacent $12$; the hypotenuse is $13$, so $\\sin A=\\tfrac{5}{13}$.', verify: { kind: 'value', expr: '5/sqrt(5^2+12^2)', answer: '5/13' } },
      { question: 'Evaluate $\\sin 60^\\circ\\cos 30^\\circ+\\sin 30^\\circ\\cos 60^\\circ$.', answer: '$\\tfrac{\\sqrt3}{2}\\times\\tfrac{\\sqrt3}{2}+\\tfrac12\\times\\tfrac12=\\tfrac34+\\tfrac14=1$', verify: { kind: 'value', expr: 'sin(pi/3)*cos(pi/6)+sin(pi/6)*cos(pi/3)', answer: '1' } },
      { question: 'Given $15\\cot A=8$, find $\\sin A$ and $\\sec A$.', answer: '$\\cot A=\\tfrac{8}{15}$: adjacent $8$, opposite $15$, hypotenuse $17$. So $\\sin A=\\tfrac{15}{17}$ and $\\sec A=\\tfrac{17}{8}$.', verify: { kind: 'values', pairs: [['15/sqrt(15^2+8^2)', '15/17'], ['sqrt(15^2+8^2)/8', '17/8']] } }
    ],
    diagrams: [
      {
        title: 'Reading the ratios of angle $A$',
        spec: { kind: 'triangle', a: 3, b: 4, c: 5 },
        note: 'The right angle is at $C$. For angle $A$ the opposite side is $3$, the adjacent side is $4$ and the hypotenuse is $5$, so $\\sin A=\\tfrac35$, $\\cos A=\\tfrac45$ and $\\tan A=\\tfrac34$, as in the first worked example. Check: $\\tfrac{9}{25}+\\tfrac{16}{25}=1$.'
      },
      {
        title: 'Half an equilateral triangle',
        spec: {
          kind: 'plane', xmin: -0.5, xmax: 2.5, ymin: -0.5, ymax: 2.5, axes: false, grid: false,
          polygons: [{ points: [[0, 0], [2, 0], [1, R3]] }],
          segments: [{ from: [1, R3], to: [1, 0], dashed: true, label: '\\sqrt{3}' }, { from: [0, 0], to: [1, 0], label: '1' }, { from: [0, 0], to: [1, R3], label: '2' }],
          angles: [{ at: [0, 0], from: [2, 0], to: [1, R3], label: 'auto' }, { at: [1, R3], from: [1, 0], to: [0, 0], label: 'auto' }, { at: [1, 0], from: [2, 0], to: [1, R3], right: true }]
        },
        note: 'An equilateral triangle of side $2$ cut down the middle. Each half has hypotenuse $2$, short side $1$ and height $\\sqrt{4-1}=\\sqrt3$, with $60^\\circ$ at the base and $30^\\circ$ at the top. Reading the sides: $\\sin30^\\circ=\\tfrac12$, $\\cos30^\\circ=\\tfrac{\\sqrt3}{2}$ and $\\tan60^\\circ=\\sqrt3$.'
      },
      {
        title: 'The ratios depend on the angle, not the size',
        spec: { kind: 'triangleExplorer', mode: 'trigRatios', initial: { angle: 30, hyp: 2 } },
        note: 'Change the size of the triangle and every side changes but none of the ratios do; change the angle and they all change. At $30^\\circ$ the readout shows $\\sin=0.5$, and at $45^\\circ$ the opposite and adjacent sides are equal, so $\\tan45^\\circ=1$.'
      }
    ]
  },

  'c10-trig-applications': {
    objective: 'Draw the right triangle hidden in a heights-and-distances problem and use $\\tan$, $\\sin$ or $\\cos$ at $30^\\circ$, $45^\\circ$ or $60^\\circ$ to find an unknown height or distance.',
    intuition: 'A tower cannot be measured with a tape, but the ground in front of it can, and so can the angle through which you raise your eyes to see the top. The tower, the ground and your line of sight make a right triangle, and $\\tan\\theta$ is height over ground distance, so one length and one angle fix everything else. An angle of depression from a height equals the angle of elevation from below, because the two horizontal lines are parallel. So every problem becomes one or two right triangles sharing a side.',
    check: [
      { question: 'A kite string $60$ m long makes an angle of $60^\\circ$ with the level ground. Assuming the string is straight, find the height of the kite.', answer: '$h=60\\sin60^\\circ=30\\sqrt3\\approx52.0$ m', verify: { kind: 'value', expr: '60*sin(pi/3)', answer: '30*sqrt(3)' } },
      { question: 'From the top of a $60$ m cliff the angle of depression of a boat is $30^\\circ$. How far is the boat from the foot of the cliff?', answer: '$d=\\tfrac{60}{\\tan30^\\circ}=60\\sqrt3\\approx103.9$ m', verify: { kind: 'value', expr: '60/tan(pi/6)', answer: '60*sqrt(3)' } },
      { question: 'The shadow of a tower is $40$ m longer when the sun\'s elevation is $30^\\circ$ than when it is $60^\\circ$. Find the height of the tower.', answer: '$h\\sqrt3-\\tfrac{h}{\\sqrt3}=40$ gives $\\tfrac{2h}{\\sqrt3}=40$, so $h=20\\sqrt3\\approx34.6$ m.', verify: { kind: 'value', expr: '40/(sqrt(3)-1/sqrt(3))', answer: '20*sqrt(3)' } }
    ],
    diagrams: [
      {
        title: 'One angle and one distance',
        spec: {
          kind: 'plane', xmin: -2, xmax: 34, ymin: -2, ymax: 20, axes: false, grid: false,
          segments: [{ from: [0, 0], to: [30, 0], label: '30\\text{ m}' }, { from: [30, 0], to: [30, 10 * R3], label: 'h' }, { from: [0, 0], to: [30, 10 * R3], dashed: true }],
          points: [{ x: 0, y: 0, label: 'O', pos: 'sw' }, { x: 30, y: 0, label: 'F', pos: 'se' }, { x: 30, y: 10 * R3, label: 'T', pos: 'ne' }],
          angles: [{ at: [0, 0], from: [30, 0], to: [30, 10 * R3], label: 'auto' }, { at: [30, 0], from: [0, 0], to: [30, 10 * R3], right: true }]
        },
        note: 'From $30$ m away the top of the tower is seen at $30^\\circ$. Height over ground distance is $\\tan30^\\circ$, so $h=30\\tan30^\\circ=\\tfrac{30}{\\sqrt3}=10\\sqrt3\\approx17.3$ m.'
      },
      {
        title: 'Two ships seen from a lighthouse',
        spec: {
          kind: 'plane', xmin: -10, xmax: 140, ymin: -10, ymax: 90, axes: false, grid: false,
          segments: [
            { from: [0, 0], to: [0, 75], label: '75\\text{ m}' }, { from: [0, 0], to: [75 * R3, 0] },
            { from: [0, 75], to: [75, 0], dashed: true }, { from: [0, 75], to: [75 * R3, 0], dashed: true }, { from: [0, 75], to: [135, 75], dashed: true }
          ],
          points: [{ x: 0, y: 75, label: 'T', pos: 'nw' }, { x: 0, y: 0, label: 'B', pos: 'sw' }, { x: 75, y: 0, label: 'P', pos: 's' }, { x: 75 * R3, y: 0, label: 'Q', pos: 's' }],
          angles: [{ at: [75, 0], from: [0, 0], to: [0, 75], label: 'auto' }, { at: [75 * R3, 0], from: [0, 0], to: [0, 75], label: 'auto' }]
        },
        note: 'The angles of depression from $T$ equal the angles of elevation at the ships, $45^\\circ$ at $P$ and $30^\\circ$ at $Q$. So $BP=75$ m and $BQ=75\\sqrt3\\approx129.9$ m, and the ships are $75(\\sqrt3-1)\\approx54.9$ m apart.'
      },
      {
        title: 'Height from distance and angle',
        spec: { kind: 'triangleExplorer', mode: 'trigRatios', initial: { angle: 30, adj: 30 } },
        note: 'Keep the ground distance at $30$ and raise the angle of elevation. The height is $30\\tan\\theta$: about $17.3$ at $30^\\circ$, exactly $30$ at $45^\\circ$, and about $52.0$ at $60^\\circ$. The height grows faster than the angle.'
      }
    ]
  },

  'c10-circles': {
    objective: 'Use the facts that a tangent is perpendicular to the radius at the point of contact and that the two tangents from an outside point are equal, to find lengths and angles and to prove results about circles.',
    intuition: 'Slide a straight line towards a circle: first it misses, then it touches at one point, then it cuts at two. At the moment of touching, the point of contact is the point of the line nearest the centre, and the shortest path from a point to a line is the perpendicular, so the radius meets the tangent at a right angle. From an outside point the two tangents make two right triangles with a shared hypotenuse and equal radii. Those triangles are congruent, so the two tangents are equal in length.',
    check: [
      { question: 'The tangent from a point $25$ cm from the centre of a circle has length $24$ cm. Find the radius.', answer: '$r=\\sqrt{25^2-24^2}=\\sqrt{49}=7$ cm', verify: { kind: 'value', expr: 'sqrt(25^2-24^2)', answer: '7' } },
      { question: 'Two tangents $PA$ and $PB$ to a circle with centre $O$ meet at an angle of $50^\\circ$. Find $\\angle AOB$.', answer: 'The angles at $A$ and $B$ are $90^\\circ$, so $\\angle AOB=180^\\circ-50^\\circ=130^\\circ$.', verify: { kind: 'value', expr: '360-90-90-50', answer: '130' } },
      { question: 'A quadrilateral $ABCD$ is drawn so that each side touches a circle. If $AB=6$ cm, $BC=7$ cm and $CD=4$ cm, find $AD$.', answer: 'Equal tangents from each vertex give $AB+CD=BC+AD$, so $AD=6+4-7=3$ cm.', verify: { kind: 'value', expr: '6+4-7', answer: '3' } }
    ],
    diagrams: [
      {
        title: 'Two tangents from an outside point',
        spec: {
          kind: 'plane', xmin: -4, xmax: 6, ymin: -4, ymax: 4, axes: false, grid: false,
          circles: [{ cx: 0, cy: 0, r: 3 }],
          segments: [
            { from: [0, 0], to: [1.8, 2.4], label: '3' }, { from: [0, 0], to: [1.8, -2.4], label: '3' },
            { from: [5, 0], to: [1.8, 2.4], label: '4' }, { from: [5, 0], to: [1.8, -2.4], label: '4' }, { from: [0, 0], to: [5, 0], dashed: true, label: '5' }
          ],
          points: [{ x: 0, y: 0, label: 'O', pos: 'w' }, { x: 5, y: 0, label: 'P', pos: 'e' }, { x: 1.8, y: 2.4, label: 'A', pos: 'n' }, { x: 1.8, y: -2.4, label: 'B', pos: 's' }],
          angles: [{ at: [1.8, 2.4], from: [0, 0], to: [5, 0], right: true }, { at: [1.8, -2.4], from: [0, 0], to: [5, 0], right: true }]
        },
        note: '$P$ is $5$ cm from the centre and the radius is $3$ cm. Each radius meets its tangent at a right angle, so $PA=\\sqrt{5^2-3^2}=4$ cm, and $PB=4$ cm too: the two tangents are equal.'
      },
      {
        title: 'The radius and the tangent stay at right angles',
        spec: { kind: 'circleExplorer', theorem: 'tangent', initial: { a: 40 } },
        note: 'Move the point of contact round the circle. The tangent turns with it, and the angle between the radius and the tangent reads $90^\\circ$ wherever the point goes.'
      }
    ]
  },

  'c10-areas-circles': {
    objective: 'Find the arc length, area and perimeter of a sector and the area of a segment, each as the fraction $\\tfrac{\\theta}{360^\\circ}$ of a whole circle with the triangle taken away where needed.',
    intuition: 'A sector is a slice cut from a round cake. If the slice has an angle of $60^\\circ$, it is $\\tfrac{60}{360}=\\tfrac16$ of a full turn, so it has $\\tfrac16$ of the area and its curved edge is $\\tfrac16$ of the circumference. A segment is what remains of the slice when the triangle between the two radii and the chord is cut away, so its area is the sector minus that triangle.',
    check: [
      { question: 'Find the length of the arc of a sector of radius $14$ cm and angle $45^\\circ$. Use $\\pi=\\tfrac{22}{7}$.', answer: '$\\tfrac{45}{360}\\times2\\times\\tfrac{22}{7}\\times14=11$ cm', verify: { kind: 'value', expr: '45/360*2*22/7*14', answer: '11' } },
      { question: 'Find the area of a sector of radius $6$ cm and angle $120^\\circ$, in terms of $\\pi$.', answer: '$\\tfrac{120}{360}\\times\\pi\\times36=12\\pi\\text{ cm}^2$', verify: { kind: 'value', expr: '120/360*pi*36', answer: '12*pi' } },
      { question: 'A chord of a circle of radius $21$ cm subtends $60^\\circ$ at the centre. Find the area of the minor segment, using $\\pi=\\tfrac{22}{7}$.', answer: 'Sector $231\\text{ cm}^2$, equilateral triangle $\\tfrac{\\sqrt3}{4}\\times441$, so the segment is $\\left(231-\\tfrac{441\\sqrt3}{4}\\right)\\text{ cm}^2\\approx40.0\\text{ cm}^2$.', verify: { kind: 'value', expr: '60/360*22/7*21^2-sqrt(3)/4*21^2', answer: '231-441*sqrt(3)/4' } }
    ],
    diagrams: [
      {
        title: 'A sector is a fraction of the circle',
        spec: {
          kind: 'plane', xmin: -24, xmax: 24, ymin: -24, ymax: 24, axes: false, grid: false,
          circles: [{ cx: 0, cy: 0, r: 21, dashed: true }],
          arcs: [{ cx: 0, cy: 0, r: 21, from: 0, to: 60 }],
          segments: [{ from: [0, 0], to: [21, 0], label: '21' }, { from: [0, 0], to: [10.5, 21 * R3 / 2] }],
          points: [{ x: 0, y: 0, label: 'O', pos: 'sw' }, { x: 21, y: 0, label: 'A', pos: 'e' }, { x: 10.5, y: 21 * R3 / 2, label: 'B', pos: 'ne' }],
          angles: [{ at: [0, 0], from: [21, 0], to: [10.5, 21 * R3 / 2], label: 'auto' }]
        },
        note: 'A sector of radius $21$ cm and angle $60^\\circ$ is $\\tfrac16$ of the circle. With $\\pi=\\tfrac{22}{7}$ its area is $\\tfrac16\\times\\tfrac{22}{7}\\times21^2=231\\text{ cm}^2$ and its arc is $\\tfrac16\\times2\\times\\tfrac{22}{7}\\times21=22$ cm long.'
      },
      {
        title: 'Segment equals sector minus triangle',
        spec: {
          kind: 'plane', xmin: -12, xmax: 12, ymin: -12, ymax: 12, axes: false, grid: false,
          circles: [{ cx: 0, cy: 0, r: 10, dashed: true }],
          arcs: [{ cx: 0, cy: 0, r: 10, from: 0, to: 90 }],
          polygons: [{ points: [[0, 0], [10, 0], [0, 10]], shade: true }],
          segments: [{ from: [0, 0], to: [10, 0], label: '10' }],
          points: [{ x: 0, y: 0, label: 'O', pos: 'sw' }, { x: 10, y: 0, label: 'A', pos: 'e' }, { x: 0, y: 10, label: 'B', pos: 'n' }],
          angles: [{ at: [0, 0], from: [10, 0], to: [0, 10], right: true }]
        },
        note: 'The chord $AB$ subtends $90^\\circ$ at the centre of a circle of radius $10$ cm. With $\\pi=3.14$ the quarter sector has area $\\tfrac14\\times3.14\\times100=78.5\\text{ cm}^2$, the shaded triangle has area $\\tfrac12\\times10\\times10=50\\text{ cm}^2$, and the segment between the chord and the arc is $78.5-50=28.5\\text{ cm}^2$.'
      },
      {
        title: 'Sector area against angle',
        spec: {
          kind: 'paramGraph', expr: 'pi*r^2*x/360',
          params: [{ name: 'r', min: 1, max: 10, step: 1, initial: 7, label: 'radius' }],
          xmin: -20, xmax: 380, ymin: -20, ymax: 330
        },
        note: 'The line gives the area of a sector of radius $r$ against its angle in degrees. At $r=7$ a $90^\\circ$ sector has area $\\tfrac14\\times49\\pi\\approx38.5$, and the full turn reaches $49\\pi\\approx153.9$. The graph is a straight line through the origin because area is proportional to the angle; doubling $r$ makes it four times as steep.'
      }
    ]
  },

  'c10-surface-volume': {
    objective: 'Find the surface area and volume of a solid made by joining or cutting cuboids, cylinders, cones, spheres and hemispheres, counting only the surfaces that remain exposed.',
    intuition: 'Volume is the space a solid fills, so when two solids are joined their volumes simply add, and when one is scooped out of another its volume is subtracted. Surface area is what paint would cover. Where a cone sits on a hemisphere, the circle they share is hidden inside the toy and gets no paint, so you add only the curved surfaces you can touch. When a solid is melted and recast, the volume stays the same while the shape changes.',
    check: [
      { question: 'A cone has radius $7$ cm and height $24$ cm. Find its slant height and curved surface area. Use $\\pi=\\tfrac{22}{7}$.', answer: '$l=\\sqrt{49+576}=25$ cm and the curved surface area is $\\tfrac{22}{7}\\times7\\times25=550\\text{ cm}^2$.', verify: { kind: 'values', pairs: [['sqrt(7^2+24^2)', '25'], ['22/7*7*25', '550']] } },
      { question: 'A metal sphere of radius $6$ cm is melted and recast into a cylinder of radius $4$ cm. Find the height of the cylinder.', answer: '$\\tfrac43\\pi\\times6^3=\\pi\\times4^2\\times h$ gives $288=16h$, so $h=18$ cm.', verify: { kind: 'value', expr: '(4/3*6^3)/(4^2)', answer: '18' } },
      { question: 'A capsule is a cylinder of radius $2$ mm and length $10$ mm with a hemisphere of radius $2$ mm on each end. Find its total surface area in terms of $\\pi$.', answer: 'Curved cylinder $2\\pi\\times2\\times10=40\\pi$ plus two hemispheres, together a sphere, $4\\pi\\times2^2=16\\pi$: in all $56\\pi\\text{ mm}^2$.', verify: { kind: 'value', expr: '2*pi*2*10+4*pi*2^2', answer: '56*pi' } }
    ],
    diagrams: [
      {
        title: 'The cone of the toy',
        spec: { kind: 'solid', shape: 'cone', r: 3.5, h: 12 },
        note: 'The cone in the first worked example has radius $3.5$ cm and height $15.5-3.5=12$ cm. Its slant height is $\\sqrt{3.5^2+12^2}=12.5$ cm, and that slant length, not the height $12$, goes into the curved surface area $\\pi rl$.'
      },
      {
        title: 'Radius, height and volume of a cylinder',
        spec: { kind: 'solidExplorer', shape: 'cylinder', r: 3, h: 10 },
        note: 'At $r=3$ and $h=10$ the volume is $\\pi\\times3^2\\times10=90\\pi$. Double the height and the volume doubles; double the radius and it becomes four times as large, because the radius is squared.'
      }
    ]
  },

  'c10-statistics': {
    objective: 'Find the mean, median and mode of grouped data, choosing the direct, assumed-mean or step-deviation method for the mean, and explain what each average tells you about the data.',
    intuition: 'Once data is grouped the individual values are lost, so each class is represented by its mid-point and the mean becomes a weighted average of the mid-points. The median is the middle value in order: the cumulative frequency shows which class contains it, and the formula assumes the values are spread evenly through that class. The mode sits in the tallest class, pulled towards whichever neighbour is taller. The three averages answer different questions, and one extreme value can move the mean a long way while the median hardly moves.',
    check: [
      { question: 'Classes $10$–$20$, $20$–$30$ and $30$–$40$ have frequencies $3$, $5$ and $2$. Find the mean.', answer: 'Mid-points $15$, $25$, $35$: $\\tfrac{45+125+70}{10}=24$', verify: { kind: 'value', expr: '(3*15+5*25+2*35)/10', answer: '24' } },
      { question: 'Classes $0$–$10$, $10$–$20$, $20$–$30$, $30$–$40$, $40$–$50$ have frequencies $4$, $6$, $10$, $5$, $5$. Find the median.', answer: '$n=30$, so look for the $15$th value. The cumulative frequencies are $4$, $10$, $20$, so the median class is $20$–$30$ and the median is $20+\\tfrac{15-10}{10}\\times10=25$.', verify: { kind: 'value', expr: '20+(15-10)/10*10', answer: '25' } },
      { question: 'For the same data, find the mode.', answer: 'The modal class is $20$–$30$ with $f_1=10$, $f_0=6$, $f_2=5$: mode $=20+\\tfrac{10-6}{20-6-5}\\times10=\\tfrac{220}{9}\\approx24.4$.', verify: { kind: 'value', expr: '20+(10-6)/(2*10-6-5)*10', answer: '220/9' } }
    ],
    diagrams: [
      {
        title: 'Grouped data from the worked example',
        spec: { kind: 'histogram', bins: { edges: [0, 10, 20, 30, 40, 50], counts: [5, 8, 15, 16, 6] } },
        note: 'Frequencies $5$, $8$, $15$, $16$ and $6$ give $n=50$. The mean is $\\tfrac{1350}{50}=27$. The $25$th value lies in $20$–$30$, giving a median of $28$. The tallest bar, $30$–$40$, holds the mode, $\\tfrac{340}{11}\\approx30.9$.'
      },
      {
        title: 'What one extreme value does to each average',
        spec: { kind: 'dataExplorer', data: [4, 6, 6, 7, 8, 9, 30], editable: [6], show: ['mean', 'median', 'mode'] },
        note: 'The data $4, 6, 6, 7, 8, 9, 30$ has mean $10$, median $7$ and mode $6$. Move the largest value from $30$ down to $16$: the mean falls to $8$, while the median and the mode do not move at all.'
      }
    ]
  },

  'c10-probability': {
    objective: 'List the equally likely outcomes of an experiment, count those favourable to an event, and find its probability as a fraction from $0$ to $1$, using $P(\\text{not } E)=1-P(E)$ when that is quicker.',
    intuition: 'Probability is a fair share: when all outcomes are equally likely, an event gets the fraction of them that it contains. The real skill is listing outcomes that truly are equally likely. With two dice the $11$ possible sums are not equally likely, but the $36$ ordered pairs are, so you count pairs, not sums. Repeat an experiment many times and the fraction of successes settles near this theoretical value, though a short run can wander well away from it.',
    check: [
      { question: 'A die is thrown once. Find the probability of getting a prime number.', answer: 'The primes are $2$, $3$ and $5$, so $P=\\tfrac36=\\tfrac12$.', verify: { kind: 'value', expr: '3/6', answer: '1/2' } },
      { question: 'A bag has $5$ red, $8$ white and $4$ green marbles. One is taken at random. Find the probability that it is not red.', answer: '$1-\\tfrac{5}{17}=\\tfrac{12}{17}$', verify: { kind: 'value', expr: '1-5/17', answer: '12/17' } },
      { question: 'Two dice are thrown. Find the probability that the product of the numbers is $6$.', answer: 'The pairs are $(1,6)$, $(6,1)$, $(2,3)$ and $(3,2)$, so $P=\\tfrac{4}{36}=\\tfrac19$.', verify: { kind: 'value', expr: '4/36', answer: '1/9' } }
    ],
    diagrams: [
      {
        title: 'Number of ways to get each sum with two dice',
        spec: { kind: 'barChart', categories: ['2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'], values: [1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1], yLabel: 'ordered pairs' },
        note: 'Of the $36$ equally likely ordered pairs, $5$ give a sum of $8$: $(2,6)$, $(3,5)$, $(4,4)$, $(5,3)$ and $(6,2)$. So $P(\\text{sum } 8)=\\tfrac{5}{36}$. A sum of $7$ is the most likely, with $6$ pairs; $2$ and $12$ have one pair each.'
      },
      {
        title: 'Throwing two dice many times',
        spec: { kind: 'probabilitySim', experiment: 'twoDiceSum', event: [8], seed: 10 },
        note: 'After $10$ throws the fraction of eights can be far from $\\tfrac{5}{36}\\approx0.14$; after $1000$ throws it sits close to it. The theoretical probability is what the long run settles towards, not a promise about any short run.'
      }
    ]
  }
};
