// Pri Learning · NSW Notes · Stage 5 Path · band B · the premium layer.
//
// What sits beside notes-nsw-stage5-path-b.js for each topic, keyed by the same id:
//   examiners  what a marker looks for in a full-mark answer (short, specific)
//   diagrams   specs for diagrams/DiagramFromSpec, drawn from the SAME numbers as the text
//   working    one aligned display block per worked example, in the same order as `examples`
//   check      self-check questions; every answer is re-derived by the engine
//              (client/test/nsw-notes-bands-check.mjs), never by the author's say-so
// Trigonometric values are checked in degrees by converting to radians.
// Original writing for Pri Learning; not an official NESA publication. en-AU spelling.
export default {
  'ma5-net-p-01': {
    examiners: [
      'Degrees are added and the total is halved, with the reason given: each edge has two ends.',
      'A claim that a path through every edge exists is backed by counting the vertices of odd degree, and the start and finish are named.',
      'A minimum spanning tree lists the edges in the order chosen, names any edge rejected for closing a cycle, and checks that the edge count is one less than the vertex count.'
    ],
    diagrams: [],
    working: [
      '\\begin{aligned}\\sum\\deg(v)&=3+3+2+2+4=14\\\\E&=14\\div2=7\\end{aligned}',
      '\\begin{aligned}\\text{Tree}&=BC+AC+DE+BD\\\\&=2+3+4+5\\\\&=14\\end{aligned}',
      '\\begin{aligned}A\\to C\\to E&=3+7=10\\\\A\\to B\\to D\\to E&=4+5+4=13\\\\A\\to C\\to D\\to E&=3+6+4=13\\end{aligned}'
    ],
    check: [
      { question: 'A network has degrees $4,4,3,3,2,2$. How many edges does it have?', answer: '$9$', verify: { kind: 'value', expr: '(4+4+3+3+2+2)/2', answer: '9' } },
      { question: 'A tree has $12$ vertices. How many edges does it have?', answer: '$11$', verify: { kind: 'value', expr: '12-1', answer: '11' } }
    ]
  },

  'ma5-nli-p-01': {
    examiners: [
      'The centre of a circle is read from the brackets with the signs reversed, and the radius is the square root of the right side.',
      'A point is tested by substituting both coordinates and comparing the result with $r^2$, with the comparison written out.',
      'An exponential curve is fixed by substituting the known point to find $a$, and the answer is checked against a second value.'
    ],
    diagrams: [
      { title: 'The curve $y=5\\times2^x$', spec: { kind: 'function', xmin: -2, xmax: 5, ymin: -20, ymax: 180, curves: [{ expr: '5*2^x', label: 'y=5\\times2^x' }], points: [{ x: 0, y: 5, label: '(0,\\,5)' }, { x: 3, y: 40, label: '(3,\\,40)' }, { x: 5, y: 160, label: '(5,\\,160)' }] }, note: 'The curve cuts the $y$-axis at $5$ and passes through $(3,40)$, which fixes $a=5$. Each step to the right doubles $y$.' }
    ],
    working: [
      '\\begin{aligned}(5-2)^2+(3+1)^2&=3^2+4^2\\\\&=9+16\\\\&=25=r^2\\end{aligned}',
      '\\begin{aligned}40&=a\\times2^3\\Rightarrow a=5\\\\y(5)&=5\\times2^5=160\\end{aligned}',
      '\\begin{aligned}\\frac{12}{x}&=x+1\\\\x^2+x-12&=0\\\\(x+4)(x-3)&=0\\end{aligned}'
    ],
    check: [
      { question: 'Find the radius of the circle $x^2+y^2=81$.', answer: '$9$', verify: { kind: 'value', expr: 'sqrt(81)', answer: '9' } },
      { question: 'For $y=3\\times2^x$, find $y$ when $x=4$.', answer: '$48$', verify: { kind: 'value', expr: '3*2^4', answer: '48' } },
      { question: 'Find the $x$-values where $y=\\dfrac{6}{x}$ meets $y=x-1$.', answer: '$x=3$ and $x=-2$', verify: { kind: 'roots', f: 'x^2-x-6', answers: ['3', '-2'] } }
    ]
  },

  'ma5-pol-p-01': {
    examiners: [
      'A candidate root is tested by substitution and the working shows $P(a)=0$ before the factor $x-a$ is claimed.',
      'The quotient is found by division or by matching coefficients, and the product is expanded again to check it.',
      'The sign is handled correctly: a root at $x=-2$ gives the factor $x+2$, and a remainder on dividing by $x+2$ uses $P(-2)$.'
    ],
    diagrams: [
      { title: 'The roots of $x^3-2x^2-5x+6$', spec: { kind: 'function', xmin: -2.5, xmax: 4, ymin: -12, ymax: 20, curves: [{ expr: 'x^3-2*x^2-5*x+6', intercepts: true, label: 'y=x^3-2x^2-5x+6' }] }, note: 'The curve crosses the $x$-axis at $-2$, $1$ and $3$, matching the factors $(x+2)$, $(x-1)$ and $(x-3)$.' }
    ],
    working: [
      '\\begin{aligned}P(1)&=1-2-5+6=0\\\\P(x)&=(x-1)(x^2-x-6)\\\\&=(x-1)(x-3)(x+2)\\end{aligned}',
      '\\begin{aligned}P(-2)&=2(-8)+4+8+3\\\\&=-1\\end{aligned}',
      '\\begin{aligned}P(2)&=8+4k-6+2=0\\\\4k&=-4\\\\k&=-1\\end{aligned}'
    ],
    check: [
      { question: 'Find $P(3)$ when $P(x)=x^3-4x^2+x+6$. Is $x-3$ a factor?', answer: '$P(3)=0$, so yes', verify: { kind: 'value', expr: '3^3-4*3^2+3+6', answer: '0' } },
      { question: 'Factorise $x^3-7x+6$ given that $x=1$ is a root.', answer: '$(x-1)(x-2)(x+3)$', verify: { kind: 'equivalent', a: 'x^3-7*x+6', b: '(x-1)*(x-2)*(x+3)' } }
    ]
  },

  'ma5-pro-p-01': {
    examiners: [
      'The second probability reflects what remains after the first draw: denominators drop by one when nothing is replaced.',
      'A tree labels every branch, multiplies along paths, and each set of branches is seen to add to $1$.',
      'A conditional probability divides by the number or probability of the given event, with the sample space named.'
    ],
    diagrams: [
      { title: 'Two marbles without replacement', spec: { kind: 'tree', branches: [{ label: 'R', p: [5, 8], children: [{ label: 'R', p: [4, 7] }, { label: 'B', p: [3, 7] }] }, { label: 'B', p: [3, 8], children: [{ label: 'R', p: [5, 7] }, { label: 'B', p: [2, 7] }] }] }, note: 'The second branches change because a marble has been removed. $P(RR)=\\tfrac{5}{8}\\times\\tfrac47=\\tfrac{5}{14}$.' },
      { title: 'Netball and swimming', spec: { kind: 'venn', sets: 2, labels: ['N', 'S'], counts: { A: 12, AB: 6, B: 10, none: 12 }, universe: 40 }, note: 'There are $18$ netballers ($12+6$) and $6$ of them swim, so $P(\\text{swim}\\mid\\text{netball})=\\tfrac{6}{18}$.' }
    ],
    working: [
      '\\begin{aligned}P(RR)&=\\tfrac58\\times\\tfrac47=\\tfrac{5}{14}\\\\P(\\text{one each})&=\\tfrac58\\times\\tfrac37+\\tfrac38\\times\\tfrac57\\\\&=\\tfrac{30}{56}=\\tfrac{15}{28}\\end{aligned}',
      '\\begin{aligned}P(S\\mid N)&=\\frac{n(S\\text{ and }N)}{n(N)}\\\\&=\\tfrac{6}{18}=\\tfrac13\\end{aligned}',
      '\\begin{aligned}P(A\\text{ and }B)&=0.4\\times0.5=0.2\\\\P(A\\text{ or }B)&=0.4+0.5-0.2=0.7\\end{aligned}'
    ],
    check: [
      { question: 'Two cards are drawn without replacement from a standard $52$ card pack. Find $P(\\text{both aces})$.', answer: '$\\tfrac{1}{221}$', verify: { kind: 'value', expr: '4/52*3/51', answer: '1/221' } },
      { question: 'Given $P(A)=0.5$ and $P(A\\text{ and }B)=0.2$, find $P(B\\mid A)$.', answer: '$0.4$', verify: { kind: 'value', expr: '0.2/0.5', answer: '0.4' } }
    ]
  },

  'ma5-rat-p-01': {
    examiners: [
      'The form of the relationship is written first ($y=kx^2$ or $y=\\dfrac{k}{x}$), then $k$ is found from the known pair and stated.',
      'The constant is found with the correct power: when $y$ varies as $x^2$, divide by the square.',
      'The answer is checked for direction: direct variation increases together, inverse variation moves in opposite directions.'
    ],
    diagrams: [
      { title: 'Inverse variation $y=\\dfrac{24}{x}$', spec: { kind: 'function', xmin: 0, xmax: 12, ymin: 0, ymax: 14, curves: [{ expr: '24/x', label: 'y=24/x' }], points: [{ x: 4, y: 6, label: '(4,\\,6)' }, { x: 8, y: 3, label: '(8,\\,3)' }] }, note: 'Doubling $x$ from $4$ to $8$ halves $y$ from $6$ to $3$. The product $xy=24$ is the same at both points.' }
    ],
    working: [
      '\\begin{aligned}12&=k\\times2^2\\Rightarrow k=3\\\\y&=3\\times5^2=75\\end{aligned}',
      '\\begin{aligned}6&=\\frac{k}{4}\\Rightarrow k=24\\\\y&=\\frac{24}{8}=3\\end{aligned}',
      '\\begin{aligned}6\\times10&=60\\\\15d&=60\\\\d&=4\\end{aligned}'
    ],
    check: [
      { question: '$y$ varies directly as $x$ and $y=21$ when $x=7$. Find $y$ when $x=10$.', answer: '$30$', verify: { kind: 'value', expr: '21/7*10', answer: '30' } },
      { question: '$y$ varies inversely as $x$ and $y=5$ when $x=6$. Find $y$ when $x=15$.', answer: '$2$', verify: { kind: 'value', expr: '5*6/15', answer: '2' } }
    ]
  },

  'ma5-rat-p-02': {
    examiners: [
      'The average rate subtracts in the same order on top and bottom and includes units, such as cells per hour.',
      'An estimate of the rate at a point uses at least two shrinking intervals and says what number they approach.',
      'A rate is distinguished from a value: the gradient of the tangent is the rate, and the height of the curve is the quantity.'
    ],
    diagrams: [
      { title: 'A secant and a tangent on $y=x^2$', spec: { kind: 'secantToTangent', expr: 'x^2', x0: 1, h: 2, xmin: -1, xmax: 4, ymin: -1, ymax: 10 }, note: 'The secant from $x=1$ to $x=3$ has gradient $4$, the average rate. The tangent at $x=1$ has gradient $2$, the rate at that point.' }
    ],
    working: [
      '\\begin{aligned}\\frac{f(3)-f(1)}{3-1}&=\\frac{9-1}{2}\\\\&=4\\end{aligned}',
      '\\begin{aligned}\\frac{1.1^2-1}{0.1}&=2.1\\\\\\frac{1.01^2-1}{0.01}&=2.01\\\\&\\to2\\end{aligned}',
      '\\begin{aligned}\\frac{N(3)-N(1)}{3-1}&=\\frac{800-200}{2}\\\\&=300\\ \\text{cells per hour}\\end{aligned}'
    ],
    check: [
      { question: 'Find the average rate of change of $y=x^2+1$ from $x=2$ to $x=4$.', answer: '$6$', verify: { kind: 'value', expr: '((4^2+1)-(2^2+1))/(4-2)', answer: '6' } },
      { question: 'Convert $54\\ \\text{km/h}$ to metres per second.', answer: '$15\\ \\text{m/s}$', verify: { kind: 'value', expr: '54*1000/3600', answer: '15' } }
    ]
  },

  'ma5-trg-p-01': {
    examiners: [
      'The rule is named and its formula written before any numbers are substituted.',
      'The cosine rule is evaluated in order: the squares and the product first, then the subtraction, then the square root last.',
      'The angle used in the area formula lies between the two sides used, and the calculator is in degree mode.'
    ],
    diagrams: [
      { title: 'A triangle with sides $7$, $5$ and $8$', spec: { kind: 'triangle', a: 7, b: 5, c: 8 }, note: 'The angle opposite the side of length $7$ is $60^\\circ$, as the cosine rule gives: $\\cos A=\\tfrac{40}{80}=\\tfrac12$.' }
    ],
    working: [
      '\\begin{aligned}c^2&=7^2+9^2-2(7)(9)\\cos60^\\circ\\\\&=130-63=67\\\\c&=\\sqrt{67}\\end{aligned}',
      '\\begin{aligned}\\frac{b}{\\sin45^\\circ}&=\\frac{10}{\\sin30^\\circ}\\\\b&=10\\sqrt2\\end{aligned}',
      '\\begin{aligned}\\cos A&=\\frac{5^2+8^2-7^2}{2(5)(8)}\\\\&=\\tfrac12\\\\A&=60^\\circ\\end{aligned}'
    ],
    check: [
      { question: 'Find the area of a triangle with sides $8$ and $11$ and an included angle of $30^\\circ$.', answer: '$22$ square units', verify: { kind: 'value', expr: '0.5*8*11*sin(30*pi/180)', answer: '22' } },
      { question: 'In a triangle $a=6$, $b=6$ and $C=60^\\circ$. Find $c$.', answer: '$6$', verify: { kind: 'value', expr: 'sqrt(6^2+6^2-2*6*6*cos(60*pi/180))', answer: '6' } }
    ]
  },

  'ma5-trg-p-02': {
    examiners: [
      'The quadrant is stated and the sign of the ratio justified before the reference angle is used.',
      'Every solution in the stated range is listed: a sine equation gives two angles between $0^\\circ$ and $360^\\circ$.',
      'When an identity is used to find a ratio, the sign is chosen from the quadrant rather than left as a plus or minus.'
    ],
    diagrams: [
      { title: 'The point at $150^\\circ$', spec: { kind: 'unitCircleDrag', initial: 150, deg: 150 }, note: 'At $150^\\circ$ the point is $(-\\tfrac{\\sqrt3}{2},\\ \\tfrac12)$: sine is positive, cosine negative, and the reference angle is $30^\\circ$.' }
    ],
    working: [
      '\\begin{aligned}\\sin150^\\circ&=\\sin30^\\circ=\\tfrac12\\\\\\cos240^\\circ&=-\\cos60^\\circ=-\\tfrac12\\end{aligned}',
      '\\begin{aligned}\\sin\\theta&=\\tfrac{\\sqrt3}{2}\\\\\\theta&=60^\\circ\\ \\text{or}\\ 180^\\circ-60^\\circ=120^\\circ\\end{aligned}',
      '\\begin{aligned}\\cos^2\\theta&=1-\\tfrac{9}{25}=\\tfrac{16}{25}\\\\\\cos\\theta&=-\\tfrac45\\\\\\tan\\theta&=-\\tfrac34\\end{aligned}'
    ],
    check: [
      { question: 'Find the exact value of $\\sin210^\\circ$.', answer: '$-\\tfrac12$', verify: { kind: 'value', expr: 'sin(210*pi/180)', answer: '-1/2' } },
      { question: 'Given $\\cos\\theta=\\tfrac{5}{13}$ with $\\theta$ acute, find $\\sin\\theta$.', answer: '$\\tfrac{12}{13}$', verify: { kind: 'value', expr: 'sqrt(1-(5/13)^2)', answer: '12/13' } }
    ]
  },

  'ma5-vol-p-01': {
    examiners: [
      'The formula is written before substitution and the perpendicular height is used, not the slant height.',
      'Exact answers keep $\\pi$ until the end, with a rounded decimal after, and the unit is cubic.',
      'A composite solid is split into named pieces, each with its own line of working, and the pieces are then added or subtracted.'
    ],
    diagrams: [],
    working: [
      '\\begin{aligned}V&=\\tfrac13\\pi r^2h\\\\&=\\tfrac13\\pi(3)^2(4)\\\\&=12\\pi\\end{aligned}',
      '\\begin{aligned}V&=\\tfrac13Ah\\\\&=\\tfrac13(36)(5)\\\\&=60\\end{aligned}',
      '\\begin{aligned}V&=\\pi(2)^2(5)+\\tfrac23\\pi(2)^3\\\\&=20\\pi+\\tfrac{16}{3}\\pi\\\\&=\\tfrac{76}{3}\\pi\\end{aligned}'
    ],
    check: [
      { question: 'Find the exact volume of a sphere of radius $6$.', answer: '$288\\pi$', verify: { kind: 'value', expr: '4/3*pi*6^3', answer: '288*pi' } },
      { question: 'A cone has radius $5$ and perpendicular height $12$. Find its exact volume.', answer: '$100\\pi$', verify: { kind: 'value', expr: '1/3*pi*5^2*12', answer: '100*pi' } }
    ]
  }
};
