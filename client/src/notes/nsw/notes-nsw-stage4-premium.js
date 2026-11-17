// Pri Learning · NSW Notes · Stage 4 · the premium layer.
//
// What sits beside notes-nsw-stage4.js for each topic, keyed by the same id:
//   examiners  what a marker looks for in a full-mark answer (short, specific)
//   diagrams   specs for diagrams/DiagramFromSpec, drawn from the SAME numbers as the text
//   working    one aligned display block per worked example, in the same order as `examples`
//   check      self-check questions; every answer is re-derived by the engine
//              (client/test/nsw-notes-content-check.mjs), never by the author's say-so
// Original writing for Pri Learning; not an official NESA publication. en-AU spelling.
export default {
  'ma4-int-c-01': {
    examiners: [
      'Each change of sign is written out on its own line: $20-(-6)$ becomes $20+6$ before anything else is done.',
      'A negative number in a product sits in brackets: $3\\times(-4)$, never $3\\times-4$.',
      'The order of operations is followed and the line after each step is shown, so a slip can be found and part-marked.'
    ],
    diagrams: [
      { title: 'Adding on the number line', spec: { kind: 'numberLine', min: -8, max: 8, points: [{ value: -3, label: '-3' }, { value: 2, label: '2' }] }, note: 'Start at $-3$ and move $5$ to the right: you land on $2$, so $-3+5=2$.' }
    ],
    working: [
      '\\begin{aligned}20-(-6)+3\\times(-4)&=20+6-12\\\\&=26-12\\\\&=14\\end{aligned}',
      '\\begin{aligned}(-8)\\times5\\div(-4)&=-40\\div(-4)\\\\&=10\\end{aligned}'
    ],
    check: [
      { question: 'Evaluate $-7-(-3)$.', answer: '$-4$', verify: { kind: 'value', expr: '-7-(-3)', answer: '-4' } },
      { question: 'Evaluate $(-2)\\times6+5$.', answer: '$-7$', verify: { kind: 'value', expr: '(-2)*6+5', answer: '-7' } }
    ]
  },

  'ma4-frc-c-01': {
    examiners: [
      'Fractions are compared or combined only after they share a denominator, and that step is written down.',
      'A percentage change is divided by the original amount, not the new one.',
      'Money is given to two decimal places with the dollar sign, for example $\\$59.50$.'
    ],
    diagrams: [
      { title: 'One value, three names', spec: { kind: 'numberLine', min: 0, max: 1, points: [{ value: 0.25, label: '\\tfrac{1}{4}' }, { value: 0.5, label: '\\tfrac{1}{2}' }, { value: 0.75, label: '\\tfrac{3}{4}' }] }, note: 'Each mark is a fraction, a decimal and a percentage at once: $\\tfrac{3}{4}=0.75=75\\%$.' }
    ],
    working: [
      '\\begin{aligned}\\text{Sale price}&=85\\times(1-0.30)\\\\&=85\\times0.70\\\\&=59.50\\end{aligned}',
      '\\begin{aligned}\\tfrac{2}{3}+\\tfrac{3}{5}&=\\tfrac{10}{15}+\\tfrac{9}{15}\\\\&=\\tfrac{19}{15}\\end{aligned}'
    ],
    check: [
      { question: 'Find $35\\%$ of $120$.', answer: '$42$', verify: { kind: 'value', expr: '0.35*120', answer: '42' } },
      { question: 'Calculate $\\tfrac{1}{2}+\\tfrac{1}{3}$.', answer: '$\\tfrac{5}{6}$', verify: { kind: 'value', expr: '1/2+1/3', answer: '5/6' } }
    ]
  },

  'ma4-ind-c-01': {
    examiners: [
      'The index law used is named or shown: the indices are added for $a^m\\times a^n$ and subtracted for $a^m\\div a^n$, and only when the base is the same.',
      'A bracketed power is applied to every factor inside: $(2x^3)^2=2^2\\times(x^3)^2$, not $2x^6$.',
      'A negative base is bracketed when it is squared: $(-3)^2=9$ but $-3^2=-9$.'
    ],
    diagrams: [
      { title: 'Why $2^0=1$', spec: { kind: 'sequence', type: 'geometric', first: 1, step: 2, n: 7 }, note: 'The terms $1,2,4,8,16,32,64$ are $2^0,2^1,\\ldots,2^6$. Each step to the right multiplies by $2$; each step to the left divides by $2$.' }
    ],
    working: [
      '\\begin{aligned}3^4\\div3^2&=3^{4-2}\\\\&=3^2\\\\&=9\\end{aligned}',
      '\\begin{aligned}(2x^3)^2&=2^2\\times(x^3)^2\\\\&=4x^6\\end{aligned}'
    ],
    check: [
      { question: 'Simplify $x^5\\times x^3$.', answer: '$x^8$', verify: { kind: 'equivalent', a: 'x^5*x^3', b: 'x^8' } },
      { question: 'Evaluate $5^0+2^3$.', answer: '$9$', verify: { kind: 'value', expr: '5^0+2^3', answer: '9' } }
    ]
  },

  'ma4-alg-c-01': {
    examiners: [
      'Only like terms are collected: $3x$ and $2x$ combine, $3x$ and $2$ do not.',
      'Every term inside a bracket is multiplied, including its sign: $2(x-4)=2x-8$.',
      'A negative value is substituted inside brackets, so $a^2$ at $a=-4$ is $(-4)^2=16$.'
    ],
    diagrams: [
      { title: 'An expression as a graph', spec: { kind: 'function', xmin: -6, xmax: 6, ymin: -4, ymax: 40, curves: [{ expr: 'x^2-3*x', intercepts: true, label: 'y=x^2-3x' }] }, note: 'Reading the curve at $x=-4$ gives $y=28$, the value of $a^2-3a$ when $a=-4$.' }
    ],
    working: [
      '\\begin{aligned}3(x+2)+2(x-4)&=3x+6+2x-8\\\\&=5x-2\\end{aligned}',
      '\\begin{aligned}a^2-3a&=(-4)^2-3(-4)\\\\&=16+12\\\\&=28\\end{aligned}'
    ],
    check: [
      { question: 'Expand $2(x+5)$.', answer: '$2x+10$', verify: { kind: 'equivalent', a: '2*(x+5)', b: '2*x+10' } },
      { question: 'Evaluate $5-2n$ when $n=-3$.', answer: '$11$', verify: { kind: 'value', expr: '5-2*(-3)', answer: '11' } }
    ]
  },

  'ma4-equ-c-01': {
    examiners: [
      'The same operation is applied to both sides on every line, and the equals signs are kept in a column.',
      'The solution is checked by substituting back into the original equation: $4(7)-7=21$.',
      'The final line states the answer as $x=7$, not just $7$.'
    ],
    diagrams: [
      { title: 'Where the two sides meet', spec: { kind: 'function', xmin: -2, xmax: 10, ymin: -10, ymax: 30, curves: [{ expr: '4*x-7', label: 'y=4x-7' }, { expr: '21', label: 'y=21' }] }, note: 'The line $y=4x-7$ meets $y=21$ at $x=7$, which is the solution of $4x-7=21$.' }
    ],
    working: [
      '\\begin{aligned}4x-7&=21\\\\4x&=28\\\\x&=7\\end{aligned}',
      '\\begin{aligned}5x+3&=2x+18\\\\3x+3&=18\\\\3x&=15\\\\x&=5\\end{aligned}'
    ],
    check: [
      { question: 'Solve $3x+2=17$.', answer: '$x=5$', verify: { kind: 'roots', f: '3*x+2-17', answers: ['5'] } },
      { question: 'Solve $2x-5=x+4$.', answer: '$x=9$', verify: { kind: 'roots', f: '2*x-5-(x+4)', answers: ['9'] } }
    ]
  },

  'ma4-lin-c-01': {
    examiners: [
      'The gradient is written as rise over run with the sign kept, and a falling line has a negative gradient.',
      'To find $c$, a point on the line is substituted into $y=mx+c$ and the working is shown.',
      'A graph has labelled axes, a scale, at least three plotted points and a ruled line.'
    ],
    diagrams: [
      { title: 'The line $y=2x+5$', spec: { kind: 'function', xmin: -4, xmax: 8, ymin: -4, ymax: 20, curves: [{ expr: '2*x+5', intercepts: true, label: 'y=2x+5' }] }, note: 'At $x=6$ the line is at $y=17$, and at $y=17$ it is at $x=6$.' },
      { title: 'Change the gradient and the intercept', spec: { kind: 'transform', base: 'linear', show: ['a', 'k'], names: { a: 'm (gradient)', k: 'c (y-intercept)' }, initial: { a: 3, k: 0 } } }
    ],
    working: [
      '\\begin{aligned}m&=\\dfrac{12-3}{4-1}\\\\&=\\dfrac{9}{3}\\\\&=3\\end{aligned}',
      '\\begin{aligned}y&=2(6)+5=17\\\\17&=2x+5\\\\2x&=12\\\\x&=6\\end{aligned}'
    ],
    check: [
      { question: 'Find the gradient of the line through $(2,1)$ and $(6,9)$.', answer: '$2$', verify: { kind: 'value', expr: '(9-1)/(6-2)', answer: '2' } },
      { question: 'For $y=3x-4$, find $y$ when $x=5$.', answer: '$11$', verify: { kind: 'value', expr: '3*5-4', answer: '11' } }
    ]
  },

  'ma4-rat-c-01': {
    examiners: [
      'The total number of parts is found first: $4+5=9$.',
      'Every rate and every answer carries its units, for example km/h and km.',
      'The shares are added back to check they make the original total.'
    ],
    diagrams: [
      { title: 'A constant speed is a straight line', spec: { kind: 'function', xmin: 0, xmax: 5.5, ymin: 0, ymax: 420, curves: [{ expr: '76*x', intercepts: true, label: 'd=76t' }] }, note: 'The gradient, $76$ km/h, is the speed. After $5$ hours the car has gone $380$ km.' }
    ],
    working: [
      '\\begin{aligned}4+5&=9\\ \\text{parts}\\\\450\\div9&=50\\ \\text{per part}\\\\5\\times50&=250\\end{aligned}',
      '\\begin{aligned}\\text{speed}&=228\\div3=76\\ \\text{km/h}\\\\\\text{distance}&=76\\times5=380\\ \\text{km}\\end{aligned}'
    ],
    check: [
      { question: 'Share $\\$120$ in the ratio $1:3$. How much is the larger share?', answer: '$\\$90$', verify: { kind: 'value', expr: '120/4*3', answer: '90' } },
      { question: 'A cyclist rides $150$ km in $2.5$ hours. What is the average speed in km/h?', answer: '$60$ km/h', verify: { kind: 'value', expr: '150/2.5', answer: '60' } }
    ]
  },

  'ma4-len-c-01': {
    examiners: [
      'All lengths are in the same unit before they are used, and any conversion is shown.',
      'A perimeter is a length in cm or m, never in square units.',
      'Rounding happens once, at the end, and the number of decimal places asked for is stated.'
    ],
    diagrams: [
      { title: 'Perimeter of a regular hexagon', spec: { kind: 'polygon', n: 6, side: 2 }, note: 'Six equal sides of $2$ give a perimeter of $6\\times2=12$.' }
    ],
    working: [
      '\\begin{aligned}P&=2(l+w)\\\\&=2(12.5+8)\\\\&=2\\times20.5\\\\&=41\\end{aligned}',
      '\\begin{aligned}C&=2\\pi r\\\\&=2\\times\\pi\\times5\\\\&=10\\pi\\approx31.4\\end{aligned}'
    ],
    check: [
      { question: 'Find the perimeter of a rectangle $9$ cm long and $4$ cm wide.', answer: '$26$ cm', verify: { kind: 'value', expr: '2*(9+4)', answer: '26' } },
      { question: 'Find the circumference of a circle of radius $10$ cm, in terms of $\\pi$.', answer: '$20\\pi$ cm', verify: { kind: 'value', expr: '2*pi*10', answer: '20*pi' } }
    ]
  },

  'ma4-are-c-01': {
    examiners: [
      'The perpendicular height is used, not the slanted side.',
      'Area is written in square units, for example $\\text{cm}^2$.',
      'For a composite shape, each part is found separately and then added or subtracted, with that step written down.'
    ],
    diagrams: [
      { title: 'A triangle is half a rectangle', spec: { kind: 'triangle', a: 14, b: 9, C: 90, showArea: true }, note: 'The two sides at the right angle are the base and the height: $\\tfrac{1}{2}\\times14\\times9=63$.' }
    ],
    working: [
      '\\begin{aligned}A&=\\tfrac{1}{2}bh\\\\&=\\tfrac{1}{2}\\times14\\times9\\\\&=63\\end{aligned}',
      '\\begin{aligned}\\text{Lawn}&=10\\times6=60\\\\\\text{Path}&=3\\times2=6\\\\\\text{Grass}&=60-6=54\\end{aligned}'
    ],
    check: [
      { question: 'Find the area of a triangle with base $10$ cm and perpendicular height $7$ cm.', answer: '$35\\text{ cm}^2$', verify: { kind: 'value', expr: '1/2*10*7', answer: '35' } },
      { question: 'Find the area of a circle of radius $3$ cm, in terms of $\\pi$.', answer: '$9\\pi\\text{ cm}^2$', verify: { kind: 'value', expr: '3^2*pi', answer: '9*pi' } }
    ]
  },

  'ma4-vol-c-01': {
    examiners: [
      'The formula is stated, then the numbers are substituted, then the answer is given with cubic units.',
      'Capacity in litres is found by dividing cubic centimetres by $1000$, and that step is shown.',
      'For a prism, the cross-section is identified first: the volume is its area times the length.'
    ],
    working: [
      '\\begin{aligned}V&=60\\times30\\times40\\\\&=72\\,000\\ \\text{cm}^3\\\\&=72\\ \\text{L}\\end{aligned}',
      '\\begin{aligned}V&=Ah\\\\&=18\\times11\\\\&=198\\end{aligned}'
    ],
    check: [
      { question: 'Find the volume of a rectangular prism $5$ cm by $4$ cm by $3$ cm.', answer: '$60\\text{ cm}^3$', verify: { kind: 'value', expr: '5*4*3', answer: '60' } },
      { question: 'How many litres is $2500\\text{ cm}^3$?', answer: '$2.5$ L', verify: { kind: 'value', expr: '2500/1000', answer: '2.5' } }
    ]
  },

  'ma4-ang-c-01': {
    examiners: [
      'Every angle has a reason beside it, such as "angles on a straight line add to $180^\\circ$".',
      'Angles are named clearly, with three letters or a label on the diagram.',
      'The parallel-line relationships are kept apart: alternate and corresponding angles are equal, co-interior angles add to $180^\\circ$.'
    ],
    diagrams: [
      { title: 'Angles in a triangle', spec: { kind: 'triangle', a: 6, b: 6, c: 6 }, note: 'In an equilateral triangle each angle is $60^\\circ$, and $60^\\circ+60^\\circ+60^\\circ=180^\\circ$.' }
    ],
    working: [
      '\\begin{aligned}x+(2x+30)&=180\\\\3x+30&=180\\\\3x&=150\\\\x&=50\\end{aligned}',
      '\\begin{aligned}112+a&=180\\\\a&=68\\end{aligned}'
    ],
    check: [
      { question: 'Angles of $90^\\circ$, $120^\\circ$ and $x$ meet at a point. Find $x$.', answer: '$150^\\circ$', verify: { kind: 'value', expr: '360-90-120', answer: '150' } },
      { question: 'Two angles of a triangle are $50^\\circ$ and $65^\\circ$. Find the third.', answer: '$65^\\circ$', verify: { kind: 'value', expr: '180-50-65', answer: '65' } }
    ]
  },

  'ma4-pyt-c-01': {
    examiners: [
      'The hypotenuse is named first: it is opposite the right angle and is the longest side.',
      'The squares are added to find the hypotenuse and subtracted to find a shorter side.',
      'The answer is rounded at the end, given with units, and checked to be longer than each leg if it is a hypotenuse.'
    ],
    diagrams: [
      { title: 'A right-angled triangle with legs $9$ and $12$', spec: { kind: 'triangle', a: 9, b: 12, C: 90 }, note: 'The hypotenuse is $15$, because $9^2+12^2=81+144=225=15^2$.' }
    ],
    working: [
      '\\begin{aligned}h^2+1.4^2&=5^2\\\\h^2&=25-1.96=23.04\\\\h&=4.8\\end{aligned}',
      '\\begin{aligned}c^2&=9^2+12^2\\\\&=81+144=225\\\\c&=15\\end{aligned}'
    ],
    check: [
      { question: 'Find the hypotenuse of a right-angled triangle with legs $6$ cm and $8$ cm.', answer: '$10$ cm', verify: { kind: 'value', expr: 'sqrt(6^2+8^2)', answer: '10' } },
      { question: 'The hypotenuse is $13$ cm and one leg is $5$ cm. Find the other leg.', answer: '$12$ cm', verify: { kind: 'value', expr: 'sqrt(13^2-5^2)', answer: '12' } }
    ]
  },

  'ma4-pro-c-01': {
    examiners: [
      'A probability is between $0$ and $1$, and is written as a fraction, decimal or percentage as the question asks.',
      'The whole sample space is counted first: the $10$ marbles are the denominator.',
      'An experimental result is called an estimate and the number of trials is stated.'
    ],
    diagrams: [
      { title: 'The marbles in the bag', spec: { kind: 'table', rows: ['Marbles'], cols: ['Red', 'Blue', 'Green'], cells: [[5, 3, 2]] }, note: 'There are $10$ marbles and $3$ are blue, so $P(\\text{not blue})=\\tfrac{7}{10}$.' }
    ],
    working: [
      '\\begin{aligned}P(\\text{not blue})&=1-\\tfrac{3}{10}\\\\&=\\tfrac{7}{10}\\end{aligned}',
      '\\begin{aligned}P(\\text{yellow})&=\\tfrac{18}{60}\\\\&=0.3\\end{aligned}'
    ],
    check: [
      { question: 'A fair six-sided die is rolled. Find the probability of a prime number.', answer: '$\\tfrac{1}{2}$', verify: { kind: 'value', expr: '3/6', answer: '1/2' } },
      { question: 'The probability of rain is $0.35$. Find the probability that it does not rain.', answer: '$0.65$', verify: { kind: 'value', expr: '1-0.35', answer: '0.65' } }
    ]
  },

  'ma4-dat-c-02': {
    examiners: [
      'The data are put in order before the median is read.',
      'With an even number of values the median is the mean of the two middle values, and both are shown.',
      'The measure is named and its meaning is stated in the context of the data.'
    ],
    diagrams: [
      { title: 'The data $3, 6, 8, 9, 11, 14$ as a box plot', spec: { kind: 'boxPlot', data: [3, 6, 8, 9, 11, 14] }, note: 'The median is $8.5$, the quartiles are $6$ and $11$, and the range is $14-3=11$.' }
    ],
    working: [
      '\\begin{aligned}\\bar{x}&=\\dfrac{12+15+9+20+14}{5}\\\\&=\\dfrac{70}{5}\\\\&=14\\end{aligned}',
      '\\begin{aligned}&3,\\,6,\\,8,\\,9,\\,11,\\,14\\\\\\text{median}&=\\dfrac{8+9}{2}=8.5\\end{aligned}'
    ],
    check: [
      { question: 'Find the mean of $4, 8, 9, 11$.', answer: '$8$', verify: { kind: 'value', expr: '(4+8+9+11)/4', answer: '8' } },
      { question: 'Find the range of $7, 2, 15, 9$.', answer: '$13$', verify: { kind: 'value', expr: '15-2', answer: '13' } }
    ]
  }
};
