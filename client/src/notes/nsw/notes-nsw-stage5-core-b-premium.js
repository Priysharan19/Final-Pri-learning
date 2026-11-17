// Pri Learning · NSW Notes · Stage 5 · core band B · the premium layer.
//
// What sits beside notes-nsw-stage5-core-b.js for each topic, keyed by the same id:
//   examiners  what a marker looks for in a full-mark answer (short, specific)
//   diagrams   specs for diagrams/DiagramFromSpec, drawn from the SAME numbers as the text
//   working    one aligned display block per worked example, in the same order as `examples`
//   check      self-check questions; every answer is re-derived by the engine
// Original writing for Pri Learning; not an official NESA publication. en-AU spelling.
export default {
  'ma5-lin-c-01': {
    examiners: [
      'The substitution is written before it is evaluated: $\\dfrac{10-2}{5-1}$, not just $2$. Part marks depend on it.',
      'The $y$-change is on top and the order of the two points is the same in the numerator and the denominator.',
      'A distance is given as a positive length, and a midpoint as an ordered pair in brackets.'
    ],
    diagrams: [
      { title: 'Rise over run', spec: { kind: 'function', xmin: -1, xmax: 7, ymin: -2, ymax: 12, curves: [{ expr: '2*x', label: 'y=2x' }], points: [{ x: 1, y: 2, label: '(1,2)' }, { x: 5, y: 10, label: '(5,10)' }] }, note: 'From $(1,2)$ to $(5,10)$ the run is $4$ and the rise is $8$, so the gradient is $\\tfrac{8}{4}=2$.' }
    ],
    working: [
      '\\begin{aligned}m&=\\frac{y_2-y_1}{x_2-x_1}\\\\&=\\frac{10-2}{5-1}\\\\&=\\frac{8}{4}=2\\end{aligned}',
      '\\begin{aligned}d&=\\sqrt{(4-(-1))^2+(15-3)^2}\\\\&=\\sqrt{25+144}\\\\&=\\sqrt{169}=13\\end{aligned}',
      '\\begin{aligned}M&=\\left(\\frac{-2+6}{2},\\ \\frac{7+(-1)}{2}\\right)\\\\&=(2,3)\\end{aligned}'
    ],
    check: [
      { question: 'Find the gradient of the line through $(2,3)$ and $(6,11)$.', answer: '$2$', verify: { kind: 'value', expr: '(11-3)/(6-2)', answer: '2' } },
      { question: 'Find the distance between $(0,0)$ and $(8,15)$.', answer: '$17$', verify: { kind: 'value', expr: 'sqrt(8^2+15^2)', answer: '17' } },
      { question: 'Find the $x$-coordinate of the midpoint of $(-4,1)$ and $(10,5)$.', answer: '$3$', verify: { kind: 'value', expr: '(-4+10)/2', answer: '3' } }
    ]
  },

  'ma5-lin-c-02': {
    examiners: [
      'The gradient is stated first, then the point-gradient line is written before it is rearranged to $y=mx+b$.',
      'A perpendicular gradient is justified by the product of gradients being $-1$, not just by changing the sign.',
      'A simultaneous solution is checked in both original equations and written as a pair.'
    ],
    diagrams: [
      { title: 'Two lines, one point', spec: { kind: 'function', xmin: -1, xmax: 11, ymin: -2, ymax: 14, curves: [{ expr: '2*x+1', label: 'y=2x+1' }, { expr: '10-x', label: 'y=10-x' }], points: [{ x: 3, y: 7, label: '(3,7)' }] }, note: 'The lines $y=2x+1$ and $x+y=10$ cross at $(3,7)$, the solution of the pair.' }
    ],
    working: [
      '\\begin{aligned}y-5&=3(x-2)\\\\y-5&=3x-6\\\\y&=3x-1\\end{aligned}',
      '\\begin{aligned}m&=-\\tfrac{1}{2}\\\\y-1&=-\\tfrac{1}{2}(x-4)\\\\y&=-\\tfrac{1}{2}x+3\\end{aligned}',
      '\\begin{aligned}x+(2x+1)&=10\\\\3x&=9\\\\x&=3,\\quad y=2(3)+1=7\\end{aligned}'
    ],
    check: [
      { question: 'Find $y$ when $x=4$ on the line $y=3x-1$.', answer: '$11$', verify: { kind: 'value', expr: '3*4-1', answer: '11' } },
      { question: 'Find the gradient of a line perpendicular to $y=5x+2$.', answer: '$-\\tfrac{1}{5}$', verify: { kind: 'value', expr: '5*(-1/5)', answer: '-1' } },
      { question: 'Solve $y=x+2$ and $y=3x-4$. Give $x$.', answer: '$x=3$', verify: { kind: 'roots', f: 'x+2-(3*x-4)', answers: ['3'] } }
    ]
  },

  'ma5-mag-c-01': {
    examiners: [
      'The decimal part is between $1$ and $10$; an answer such as $12\\times10^3$ loses the mark for form.',
      'The sign of the index is checked against the size: a number below $1$ has a negative index.',
      'Rounding to significant figures shows the digit that decided it, and trailing zeros are kept when they are significant.'
    ],
    diagrams: [
      { title: 'The decimal part sits between 1 and 10', spec: { kind: 'numberLine', min: 0, max: 10, points: [{ value: 4.53, label: '4.53' }], intervals: [{ from: 1, to: 10, toOpen: true }] }, note: 'In $4.53\\times10^7$ the decimal part $4.53$ lies in the interval from $1$ up to, but not including, $10$.' }
    ],
    working: [
      '\\begin{aligned}45\\,300\\,000&=4.53\\times10\\,000\\,000\\\\&=4.53\\times10^7\\end{aligned}',
      '\\begin{aligned}(3\\times10^4)(2.5\\times10^{-2})&=(3\\times2.5)\\times10^{4+(-2)}\\\\&=7.5\\times10^2\\\\&=750\\end{aligned}',
      '\\begin{aligned}\\frac{10^{-3}}{2\\times10^{-6}}&=0.5\\times10^{-3-(-6)}\\\\&=0.5\\times10^3\\\\&=500\\end{aligned}'
    ],
    check: [
      { question: 'Write $0.00072$ in scientific notation.', answer: '$7.2\\times10^{-4}$', verify: { kind: 'value', expr: '7.2*10^(-4)', answer: '0.00072' } },
      { question: 'Calculate $(6\\times10^5)\\div(3\\times10^2)$.', answer: '$2\\times10^3$', verify: { kind: 'value', expr: '6*10^5/(3*10^2)', answer: '2000' } }
    ]
  },

  'ma5-nli-c-01': {
    examiners: [
      'The $x$-intercepts come from factorising and setting each factor to zero, and both are given.',
      'The axis of symmetry is found before the vertex, and the vertex has both coordinates.',
      'A sketch labels the intercepts and the vertex, and its shape agrees with the sign of $a$.'
    ],
    diagrams: [
      { title: 'A parabola and its key points', spec: { kind: 'function', xmin: -3, xmax: 7, ymin: -11, ymax: 12, curves: [{ expr: 'x^2-4*x-5', intercepts: true, label: 'y=x^2-4x-5' }], points: [{ x: 2, y: -9, label: '(2,-9)' }] }, note: 'The curve cuts the $x$-axis at $-1$ and $5$, is symmetrical about $x=2$, and has its vertex at $(2,-9)$.' },
      { title: 'Move the vertex', spec: { kind: 'transform', base: 'quadratic', initial: { h: 3, k: 1 }, show: ['a', 'h', 'k'] }, note: 'Set $h=3$ and $k=1$ to see $y=(x-3)^2+1$ with its vertex at $(3,1)$.' }
    ],
    working: [
      '\\begin{aligned}x^2-4x-5&=0\\\\(x-5)(x+1)&=0\\\\x&=5\\ \\text{or}\\ -1\\\\x_{\\text{axis}}&=\\tfrac{5+(-1)}{2}=2,\\quad y=2^2-4(2)-5=-9\\end{aligned}',
      '\\begin{aligned}y&=(x-3)^2+1\\\\\\text{vertex}&=(3,1)\\\\x=0:\\ y&=(-3)^2+1=10\\end{aligned}',
      '\\begin{aligned}x^2+2x-8&=0\\\\(x+4)(x-2)&=0\\\\x&=-4\\ \\text{or}\\ 2\\end{aligned}'
    ],
    check: [
      { question: 'Solve $x^2-9=0$.', answer: '$x=3$ or $x=-3$', verify: { kind: 'roots', f: 'x^2-9', answers: ['3', '-3'] } },
      { question: 'Find the $y$-intercept of $y=(x+2)^2-3$.', answer: '$1$', verify: { kind: 'value', expr: '(0+2)^2-3', answer: '1' } }
    ]
  },

  'ma5-nli-c-02': {
    examiners: [
      'A table of values is shown before the curve is drawn, and the curve is smooth, not joined by ruler.',
      'Asymptotes are drawn or named, and the curve is not allowed to cross or touch them.',
      'For decay, the factor is written as a decimal such as $0.8$, and the number of periods is the index.'
    ],
    diagrams: [
      { title: 'Doubling each step', spec: { kind: 'function', xmin: -3, xmax: 4, ymin: -2, ymax: 26, curves: [{ expr: '3*2^x', intercepts: true, label: 'y=3\\times2^x' }], points: [{ x: 0, y: 3, label: '(0,3)' }, { x: 3, y: 24, label: '(3,24)' }] }, note: 'The table $3,6,12,24$ for $x=0,1,2,3$ lies on the curve; the $x$-axis is its asymptote.' },
      { title: 'A hyperbola', spec: { kind: 'function', xmin: -8, xmax: 8, ymin: -8, ymax: 8, curves: [{ expr: '12/x', label: 'y=12/x' }], points: [{ x: 3, y: 4, label: '(3,4)' }, { x: -3, y: -4, label: '(-3,-4)' }] }, note: 'Every point on the curve has $xy=12$, for example $3\\times4$. The two branches never meet either axis.' }
    ],
    working: [
      '\\begin{aligned}x=0:\\ y&=3\\times2^0=3\\\\x=1:\\ y&=3\\times2^1=6\\\\x=2:\\ y&=3\\times2^2=12\\\\x=3:\\ y&=3\\times2^3=24\\end{aligned}',
      '\\begin{aligned}V&=1000\\times0.8^2\\\\&=1000\\times0.64\\\\&=640\\end{aligned}',
      '\\begin{aligned}(3,4):\\ 3^2+4^2&=25=5^2\\ \\text{(on)}\\\\(2,5):\\ 2^2+5^2&=29>25\\ \\text{(outside)}\\end{aligned}'
    ],
    check: [
      { question: 'Find $y$ when $x=4$ on $y=2^x$.', answer: '$16$', verify: { kind: 'value', expr: '2^4', answer: '16' } },
      { question: 'A quantity of $500$ grows by $10\\%$ each year. What is it after $2$ years?', answer: '$605$', verify: { kind: 'value', expr: '500*1.1^2', answer: '605' } },
      { question: 'For $y=\\dfrac{12}{x}$, find $y$ when $x=6$.', answer: '$2$', verify: { kind: 'value', expr: '12/6', answer: '2' } }
    ]
  },

  'ma5-pro-c-01': {
    examiners: [
      'Each set of branches is labelled with probabilities that add to $1$, and the tree is drawn before any multiplying.',
      'The words “with replacement” or “without replacement” decide the second-stage fractions, and the answer says which was used.',
      'In a Venn diagram the overlap is written first and the other regions are found by subtraction, so the total can be checked.'
    ],
    diagrams: [
      { title: 'Two draws without replacement', spec: { kind: 'tree', branches: [{ label: 'R', p: [3, 5], children: [{ label: 'R', p: [2, 4] }, { label: 'B', p: [2, 4] }] }, { label: 'B', p: [2, 5], children: [{ label: 'R', p: [3, 4] }, { label: 'B', p: [1, 4] }] }] }, note: 'The branch R then R has probability $\\tfrac{3}{5}\\times\\tfrac{2}{4}=\\tfrac{3}{10}$.' },
      { title: 'Netball and swimming', spec: { kind: 'venn', sets: 2, labels: ['Netball', 'Swim'], counts: { A: 13, B: 7, AB: 5, none: 5 }, universe: 30 }, note: 'Netball only is $18-5=13$ and swimming only is $12-5=7$. The $5$ outside both gives $P(\\text{neither})=\\tfrac{5}{30}=\\tfrac{1}{6}$.' }
    ],
    working: [
      '\\begin{aligned}P(RR)&=\\tfrac{3}{5}\\times\\tfrac{3}{5}\\\\&=\\tfrac{9}{25}\\end{aligned}',
      '\\begin{aligned}P(RR)&=\\tfrac{3}{5}\\times\\tfrac{2}{4}\\\\&=\\tfrac{6}{20}\\\\&=\\tfrac{3}{10}\\end{aligned}',
      '\\begin{aligned}n(\\text{netball or swim})&=18+12-5=25\\\\n(\\text{neither})&=30-25=5\\\\P(\\text{neither})&=\\tfrac{5}{30}=\\tfrac{1}{6}\\end{aligned}'
    ],
    check: [
      { question: 'A fair coin is tossed twice. Find $P(\\text{two heads})$.', answer: '$\\tfrac{1}{4}$', verify: { kind: 'value', expr: '1/2*1/2', answer: '1/4' } },
      { question: 'A bag holds $4$ green and $6$ yellow counters. Two are drawn without replacement. Find $P(\\text{both green})$.', answer: '$\\tfrac{2}{15}$', verify: { kind: 'value', expr: '4/10*3/9', answer: '2/15' } }
    ]
  },

  'ma5-trg-c-01': {
    examiners: [
      'The sides are labelled opposite, adjacent and hypotenuse from the stated angle before a ratio is chosen.',
      'The ratio is written first, then rearranged: $\\sin40^\\circ=\\dfrac{7}{h}$ becomes $h=\\dfrac{7}{\\sin40^\\circ}$.',
      'The calculator is in degree mode, and the answer is rounded only at the end, with its unit and the requested accuracy.'
    ],
    diagrams: [
      { title: 'A 6, 8, 10 triangle', spec: { kind: 'triangle', a: 6, b: 8, c: 10 }, note: 'With the right angle between the sides $6$ and $8$, the angle opposite $6$ has $\\tan\\theta=\\tfrac{6}{8}=0.75$, so $\\theta\\approx36.9^\\circ$.' }
    ],
    working: [
      '\\begin{aligned}\\sin30^\\circ&=\\frac{x}{10}\\\\x&=10\\sin30^\\circ\\\\&=5\\end{aligned}',
      '\\begin{aligned}\\tan\\theta&=\\frac{6}{8}=0.75\\\\\\theta&=\\tan^{-1}(0.75)\\\\&\\approx36.9^\\circ\\end{aligned}',
      '\\begin{aligned}\\sin40^\\circ&=\\frac{7}{h}\\\\h&=\\frac{7}{\\sin40^\\circ}\\\\&\\approx10.9\\end{aligned}'
    ],
    check: [
      { question: 'Find $\\cos60^\\circ$.', answer: '$0.5$', verify: { kind: 'value', expr: 'cos(60*pi/180)', answer: '0.5' } },
      { question: 'The adjacent side is $5$ and the angle is $45^\\circ$. Find the opposite side.', answer: '$5$', verify: { kind: 'value', expr: '5*tan(45*pi/180)', answer: '5' } }
    ]
  },

  'ma5-trg-c-02': {
    examiners: [
      'A labelled diagram shows the horizontal, the line of sight and the angle, with the angle placed at the observer.',
      'A bearing diagram has a north line at each starting point and the angle marked clockwise from it.',
      'Exact values such as $6\\sqrt3$ are given when the angle is $30^\\circ$, $45^\\circ$ or $60^\\circ$ and exact form is asked for.'
    ],
    diagrams: [
      { title: 'Looking up at a tower', spec: { kind: 'triangle', a: 40, b: 30, c: 50 }, note: 'The $40$ m along the ground and the $30$ m of height give $\\tan\\theta=\\tfrac{30}{40}$, an angle of elevation of about $37^\\circ$.' },
      { title: 'Exact values at 30 degrees', spec: { kind: 'unitCircle', deg: 30 }, note: 'At $30^\\circ$ the point on the circle is $\\left(\\tfrac{\\sqrt3}{2},\\tfrac{1}{2}\\right)$, so $\\cos30^\\circ=\\tfrac{\\sqrt3}{2}$ and $\\sin30^\\circ=\\tfrac{1}{2}$.' }
    ],
    working: [
      '\\begin{aligned}\\tan\\theta&=\\frac{30}{40}=0.75\\\\\\theta&=\\tan^{-1}(0.75)\\\\&\\approx37^\\circ\\end{aligned}',
      '\\begin{aligned}\\tan35^\\circ&=\\frac{h}{40}\\\\h&=40\\tan35^\\circ\\\\&\\approx28.0\\end{aligned}',
      '\\begin{aligned}\\text{south}&=12\\cos30^\\circ\\\\&=12\\times\\tfrac{\\sqrt3}{2}\\\\&=6\\sqrt3\\approx10.4\\end{aligned}'
    ],
    check: [
      { question: 'A ship sails $10$ km on a bearing of $090^\\circ$ and then $10$ km on $180^\\circ$. Find its distance from the start, in surd form.', answer: '$10\\sqrt2$', verify: { kind: 'value', expr: 'sqrt(10^2+10^2)', answer: '10*sqrt(2)' } },
      { question: 'A ramp rises $2$ m over a horizontal distance of $8$ m. Find $\\tan\\theta$ for its angle of slope.', answer: '$\\tfrac{1}{4}$', verify: { kind: 'value', expr: '2/8', answer: '1/4' } }
    ]
  },

  'ma5-vol-c-01': {
    examiners: [
      'The formula is written, the values are substituted, and the unit is cubic (cm$^3$, m$^3$) in the answer.',
      'The radius is used, not the diameter, and the perpendicular height is used for pyramids and cones.',
      'The exact answer in terms of $\\pi$ is kept until the last line, and rounded only as asked.'
    ],
    diagrams: [],
    working: [
      '\\begin{aligned}A&=\\tfrac{1}{2}\\times6\\times4=12\\\\V&=Ah=12\\times10\\\\&=120\\ \\text{cm}^3\\end{aligned}',
      '\\begin{aligned}V&=\\pi r^2h\\\\&=\\pi\\times3^2\\times10\\\\&=90\\pi\\approx282.7\\ \\text{cm}^3\\end{aligned}',
      '\\begin{aligned}V&=\\tfrac{1}{3}\\pi r^2h\\\\&=\\tfrac{1}{3}\\pi\\times5^2\\times12\\\\&=100\\pi\\approx314.2\\ \\text{cm}^3\\end{aligned}'
    ],
    check: [
      { question: 'Find the volume of a rectangular prism $5$ cm by $4$ cm by $3$ cm.', answer: '$60$ cm$^3$', verify: { kind: 'value', expr: '5*4*3', answer: '60' } },
      { question: 'Find the volume of a sphere of radius $3$ cm in terms of $\\pi$.', answer: '$36\\pi$ cm$^3$', verify: { kind: 'value', expr: '4/3*pi*3^3', answer: '36*pi' } }
    ]
  }
};
