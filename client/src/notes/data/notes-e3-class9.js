// Pri Learning · Experience 3 layer for CBSE Class 9 notes (see notes/e3.js). Original writing.
export default {
  'c9-coordinate-geometry': {
    objective: 'Plot a point from its coordinates, name its quadrant from the signs, and find the distance between two points with the Baudhāyana–Pythagoras theorem.',
    intuition: 'Coordinates are an address: the first number says how far across, the second how far up. Once every point has an address, a distance is no longer measured with a ruler. Join two points, drop the horizontal and vertical gaps between them, and you have a right triangle whose hypotenuse is the distance you want.',
    check: [
      {
        question: 'In which quadrant is $(-4, 7)$, and how far is it from the $x$-axis?',
        answer: 'Quadrant II, because $x<0$ and $y>0$. Its distance from the $x$-axis is $|7| = 7$ units.',
        verify: { kind: 'value', expr: 'abs(7)', answer: '7' }
      },
      {
        question: 'Find the distance between $A(-2, 1)$ and $B(4, 9)$.',
        answer: 'The gaps are $6$ across and $8$ up, so $AB = \\sqrt{6^2 + 8^2} = 10$ units.',
        verify: { kind: 'value', expr: 'sqrt((4+2)^2+(9-1)^2)', answer: '10' }
      },
      {
        question: 'Show that $P(1, 1)$, $Q(5, 4)$ and $R(2, 8)$ form a right-angled isosceles triangle, and find its area.',
        answer: '$PQ = QR = 5$ and $PR = \\sqrt{50}$. Since $5^2 + 5^2 = 50$, the right angle is at $Q$, and the area is $\\tfrac12 \\times 5 \\times 5 = \\tfrac{25}{2}$ square units.',
        verify: { kind: 'values', pairs: [['sqrt((5-1)^2+(4-1)^2)', '5'], ['sqrt((2-5)^2+(8-4)^2)', '5'], ['(2-1)^2+(8-1)^2', '50'], ['5*5/2', '25/2']] }
      }
    ],
    diagrams: [
      {
        title: 'One point in each quadrant',
        spec: {
          kind: 'plane', xmin: -5, xmax: 5, ymin: -4, ymax: 4,
          points: [{ x: 3, y: 2, label: '(3,2)', pos: 'ne' }, { x: -3, y: 2, label: '(-3,2)', pos: 'nw' }, { x: -3, y: -2, label: '(-3,-2)', pos: 'sw' }, { x: 3, y: -2, label: '(3,-2)', pos: 'se' }]
        },
        note: 'The four points have the same two numbers, $3$ and $2$; only the signs change. $(3,2)$ is in Quadrant I, $(-3,2)$ in II, $(-3,-2)$ in III and $(3,-2)$ in IV. Each is the mirror image of its neighbour in an axis.'
      },
      {
        title: 'The distance from $A(1,2)$ to $B(4,6)$',
        spec: {
          kind: 'plane', xmin: -1, xmax: 6, ymin: -1, ymax: 7,
          points: [{ x: 1, y: 2, label: 'A(1,2)', pos: 'w' }, { x: 4, y: 6, label: 'B(4,6)', pos: 'ne' }, { x: 4, y: 2, label: 'C(4,2)', pos: 'se' }],
          segments: [{ from: [1, 2], to: [4, 6], label: '5' }, { from: [1, 2], to: [4, 2], label: '3', dashed: true }, { from: [4, 2], to: [4, 6], label: '4', dashed: true }],
          angles: [{ at: [4, 2], from: [1, 2], to: [4, 6], right: true }]
        },
        note: 'The horizontal gap $AC$ is $4-1=3$ and the vertical gap $CB$ is $6-2=4$. The right angle is at $C$, so $AB=\\sqrt{3^2+4^2}=5$, the first worked example.'
      },
      {
        title: 'Change the legs, watch the hypotenuse',
        spec: { kind: 'triangleExplorer', mode: 'pythagoras', initial: { a: 3, b: 4 } },
        note: 'The legs play the part of the horizontal and vertical gaps between two points. Start at $3$ and $4$: the hypotenuse is $5$. Try $6$ and $8$, the gaps in the second checkpoint question, and the hypotenuse is $10$.'
      }
    ]
  },

  'c9-linear-polynomials': {
    objective: 'Find the value and the zero of a linear polynomial $ax+b$, and read its slope and intercept from a table or a graph.',
    intuition: 'A linear polynomial describes something that changes by the same amount at every step: $a$ is the step and $b$ is where you start. That is why its graph is straight. Each move of $1$ to the right goes up (or down) by exactly $a$. The zero is the input where the running total reaches $0$, which is why it sits where the line crosses the $x$-axis.',
    check: [
      {
        question: 'Find the zero of $p(x) = 4x + 10$.',
        answer: '$4x + 10 = 0$ gives $x = -\\tfrac{5}{2}$.',
        verify: { kind: 'roots', f: '4*x+10', answers: ['-5/2'] }
      },
      {
        question: 'For $p(x) = 2x^2 - 3x + 1$, find $p(-2)$.',
        answer: '$p(-2) = 2 \\times 4 + 6 + 1 = 15$.',
        verify: { kind: 'value', expr: '2*(-2)^2-3*(-2)+1', answer: '15' }
      },
      {
        question: 'A line passes through $(1, 5)$ and $(4, -1)$. Write it as $y = ax + b$ and find the zero of $ax + b$.',
        answer: 'The slope is $\\tfrac{-1-5}{4-1} = -2$, and $5 = -2 + b$ gives $b = 7$. So $y = -2x + 7$, with zero $x = \\tfrac{7}{2}$.',
        verify: { kind: 'values', pairs: [['(-1-5)/(4-1)', '-2'], ['5+2*1', '7'], ['-2*(7/2)+7', '0']] }
      }
    ],
    diagrams: [
      {
        title: 'The candle that burns $2$ cm an hour',
        spec: {
          kind: 'function', xmin: -1, xmax: 12, ymin: -2, ymax: 22,
          curves: [{ expr: '20-2*x', intercepts: true, label: 'h=20-2t' }],
          points: [{ x: 6, y: 8, label: '(6,8)' }]
        },
        note: 'Here $x$ is the time $t$ in hours. The candle starts at $20$ cm, the $y$-intercept, and loses $2$ cm each hour, so the slope is $-2$. After $6$ hours it is $8$ cm tall. The zero, $t = 10$, is when the candle has burnt down.'
      },
      {
        title: 'Move the slope and the intercept',
        spec: {
          kind: 'paramGraph', expr: 'a*x+b', xmin: -6, xmax: 6, ymin: -8, ymax: 8,
          params: [{ name: 'a', min: -3, max: 3, step: 0.5, initial: 2, label: 'a (slope)' }, { name: 'b', min: -6, max: 6, step: 1, initial: -4, label: 'b (intercept)' }],
          show: ['roots', 'yIntercept']
        },
        note: 'At the start the line is $y = 2x - 4$: it crosses the $y$-axis at $-4$ and has its zero at $x = 2$. Change only $b$ and the line slides without turning. Change only $a$ and it turns about $(0, b)$. The zero always sits at $x = -\\tfrac{b}{a}$, and there is none when $a = 0$.'
      }
    ]
  },

  'c9-number-systems': {
    objective: 'Decide whether a number is rational or irrational from its form or its decimal, convert a recurring decimal to a fraction, and place numbers such as $\\sqrt{2}$ on the number line.',
    intuition: 'The rationals are everything you can reach by dividing one whole number by another. They are packed so tightly that between any two there is always another, yet they still leave gaps. The diagonal of a unit square has length $\\sqrt{2}$, a length you can draw exactly but no fraction equals. The decimals tell the two kinds apart: dividing $p$ by $q$ can leave only $q$ different remainders, so the digits must stop or repeat, while an irrational number never settles.',
    check: [
      {
        question: 'Write $0.\\overline{7}$ as a fraction.',
        answer: 'If $x = 0.777\\ldots$ then $10x - x = 7$, so $x = \\tfrac{7}{9}$.',
        verify: { kind: 'value', expr: '10*(7/9)-7/9', answer: '7' }
      },
      {
        question: 'Rationalise the denominator of $\\dfrac{2}{3 - \\sqrt{5}}$.',
        answer: 'Multiply above and below by $3 + \\sqrt{5}$: $\\dfrac{2(3+\\sqrt5)}{9-5} = \\dfrac{3+\\sqrt5}{2}$.',
        verify: { kind: 'value', expr: '2/(3-sqrt(5))', answer: '(3+sqrt(5))/2' }
      },
      {
        question: 'Write $0.1\\overline{6}$ as a fraction in lowest terms.',
        answer: 'Let $x = 0.1666\\ldots$. Then $100x = 16.666\\ldots$ and $10x = 1.666\\ldots$, so $90x = 15$ and $x = \\tfrac{1}{6}$.',
        verify: { kind: 'value', expr: '15/90', answer: '1/6' }
      }
    ],
    diagrams: [
      {
        title: 'The diagonal of a unit square',
        spec: { kind: 'triangle', a: 1, b: 1, C: 90 },
        note: 'Two legs of length $1$ at a right angle give a hypotenuse of $\\sqrt{1^2 + 1^2} = \\sqrt{2}$. Swing this hypotenuse down onto the number line from $0$ and it marks the point $\\sqrt{2}$ exactly.'
      },
      {
        title: 'Roots between the whole numbers',
        spec: {
          kind: 'numberLine', min: 0, max: 3, step: 0.5,
          points: [{ value: Math.SQRT2, label: '\\sqrt{2}' }, { value: Math.sqrt(3), label: '\\sqrt{3}' }, { value: 2, label: '\\sqrt{4}' }]
        },
        note: '$\\sqrt{2} \\approx 1.414$ and $\\sqrt{3} \\approx 1.732$ lie between $1$ and $2$; $\\sqrt{4}$ is exactly $2$. Only the square roots of perfect squares land on whole numbers.'
      },
      {
        title: 'Adding fractions in twelfths',
        spec: { kind: 'numberLineStepper', op: 'add', a: 1 / 3, b: 1 / 4, min: 0, max: 1, step: 1 / 12, fractions: 12 },
        note: 'With the line cut into twelfths, $\\tfrac13$ is $\\tfrac{4}{12}$ and the jump of $\\tfrac14$ is $3$ twelfths, so you land on $\\tfrac{7}{12}$. Cut the line finer and new fractions keep appearing between the marks: this is the density of the rationals.'
      }
    ]
  },

  'c9-algebraic-identities': {
    objective: 'Expand and factorise with the standard identities, check an identity by area or by substitution, and use one to calculate with large numbers.',
    intuition: 'Draw a square of side $a+b$ and cut it along the join: you get a square $a^2$, a square $b^2$ and two rectangles $ab$. That is all $(a+b)^2 = a^2 + 2ab + b^2$ says. The two rectangles are the middle term people forget, and they are why $(x+3)^2$ is not $x^2 + 9$. An identity is true for every value, so a single number that fails proves a claimed identity wrong.',
    check: [
      {
        question: 'Expand $(2x - 5)^2$.',
        answer: '$(2x)^2 - 2(2x)(5) + 5^2 = 4x^2 - 20x + 25$.',
        verify: { kind: 'equivalent', a: '(2*x-5)^2', b: '4*x^2-20*x+25' }
      },
      {
        question: 'Use an identity to find $999^2$.',
        answer: '$(1000 - 1)^2 = 1000000 - 2000 + 1 = 998001$.',
        verify: { kind: 'value', expr: '999^2', answer: '998001' }
      },
      {
        question: 'If $a + b = 7$ and $ab = 10$, find $a^2 + b^2$ and $a^3 + b^3$ without finding $a$ and $b$.',
        answer: '$a^2 + b^2 = (a+b)^2 - 2ab = 49 - 20 = 29$, and $a^3 + b^3 = (a+b)^3 - 3ab(a+b) = 343 - 210 = 133$.',
        verify: { kind: 'values', pairs: [['5^2+2^2', '29'], ['5^3+2^3', '133'], ['7^3-3*10*7', '133']] }
      }
    ],
    diagrams: [
      {
        title: 'The square of a sum, as area',
        spec: {
          kind: 'areaModel',
          rows: [{ size: 5, label: 'a' }, { size: 2, label: 'b' }],
          cols: [{ size: 5, label: 'a' }, { size: 2, label: 'b' }],
          cells: [['a^2', 'ab'], ['ab', 'b^2']]
        },
        note: 'The whole square has side $a+b$. Its four pieces are $a^2$, $b^2$ and two rectangles $ab$, so $(a+b)^2 = a^2 + 2ab + b^2$. With $a = 5$ and $b = 2$: $49 = 25 + 20 + 4$.'
      },
      {
        title: 'The product $(x+3)(x+2)$',
        spec: {
          kind: 'areaModel',
          rows: [{ size: 4, label: 'x' }, { size: 3, label: '3' }],
          cols: [{ size: 4, label: 'x' }, { size: 2, label: '2' }],
          cells: [['x^2', '2x'], ['3x', '6']]
        },
        note: 'The pieces are $x^2$, $2x$, $3x$ and $6$. The two rectangles combine to $5x$, so $(x+3)(x+2) = x^2 + 5x + 6$: the middle coefficient is $3 + 2$ and the constant is $3 \\times 2$.'
      },
      {
        title: 'The term that $x^2 + a^2$ leaves out',
        spec: {
          kind: 'paramGraph', expr: '(x+a)^2-(x^2+a^2)', xmin: -5, xmax: 5, ymin: -20, ymax: 20,
          params: [{ name: 'a', min: -4, max: 4, step: 1, initial: 3 }],
          show: ['roots']
        },
        note: 'The graph is the gap between $(x+a)^2$ and the wrong answer $x^2 + a^2$. It is the straight line $y = 2ax$, which is $0$ only at $x = 0$. With $a = 3$ the gap is $6x$: at $x = 2$ the wrong answer is short by $12$. Only $a = 0$ makes the gap vanish.'
      }
    ]
  },

  'c9-circles': {
    objective: 'Use the chord, angle and cyclic-quadrilateral theorems to find unknown lengths and angles in a circle, and explain each step by naming the theorem.',
    intuition: 'Every radius of a circle is the same length, and nearly every theorem in this chapter comes from that. Two radii and a chord make an isosceles triangle, so the perpendicular from the centre halves the chord. The same isosceles triangles, added up, show that the angle at the centre is twice the angle at the circle. Opposite angles of a cyclic quadrilateral stand on arcs that together make the whole circle, so their centre angles add to $360^\\circ$ and the angles themselves to $180^\\circ$.',
    check: [
      {
        question: 'An arc subtends $130^\\circ$ at the centre. What angle does it subtend at a point on the remaining part of the circle?',
        answer: 'Half the angle at the centre: $65^\\circ$.',
        verify: { kind: 'value', expr: '130/2', answer: '65' }
      },
      {
        question: 'A chord lies $8$ cm from the centre of a circle of radius $17$ cm. Find the length of the chord.',
        answer: 'Half the chord is $\\sqrt{17^2 - 8^2} = 15$ cm, so the chord is $30$ cm.',
        verify: { kind: 'value', expr: '2*sqrt(17^2-8^2)', answer: '30' }
      },
      {
        question: 'In a cyclic quadrilateral $ABCD$, $\\angle A = (2x + 10)^\\circ$ and $\\angle C = (3x - 5)^\\circ$. Find $x$ and both angles.',
        answer: 'Opposite angles add to $180^\\circ$: $5x + 5 = 180$, so $x = 35$, $\\angle A = 80^\\circ$ and $\\angle C = 100^\\circ$.',
        verify: { kind: 'values', pairs: [['(180-5)/5', '35'], ['2*35+10', '80'], ['3*35-5', '100']] }
      }
    ],
    diagrams: [
      {
        title: 'A chord $5$ cm from the centre',
        spec: {
          kind: 'plane', xmin: -15, xmax: 15, ymin: -15, ymax: 15, axes: false,
          circles: [{ cx: 0, cy: 0, r: 13 }],
          points: [{ x: 0, y: 0, label: 'O', pos: 'n' }, { x: -12, y: -5, label: 'A', pos: 'sw' }, { x: 12, y: -5, label: 'B', pos: 'se' }, { x: 0, y: -5, label: 'M', pos: 's' }],
          segments: [{ from: [-12, -5], to: [12, -5] }, { from: [0, 0], to: [0, -5], label: '5', dashed: true }, { from: [0, 0], to: [12, -5], label: '13' }],
          angles: [{ at: [0, -5], from: [0, 0], to: [12, -5], right: true }]
        },
        note: 'The radius $OB = 13$ and the distance $OM = 5$ make a right triangle, so $MB = \\sqrt{13^2 - 5^2} = 12$. The perpendicular from $O$ halves the chord, so $AB = 24$ cm, as in the first worked example.'
      },
      {
        title: 'Opposite angles of a cyclic quadrilateral',
        spec: { kind: 'circleTheorem', theorem: 'cyclic', params: { a: 20, b: 100, c: 200, d: 290 } },
        note: 'The angles are $\\angle A = 95^\\circ$, $\\angle B = 90^\\circ$, $\\angle C = 85^\\circ$ and $\\angle D = 90^\\circ$. Each opposite pair adds to $180^\\circ$; neighbouring angles need not.'
      },
      {
        title: 'Move the point round the circle',
        spec: { kind: 'circleExplorer', theorem: 'centre', initial: { a: 20, b: 140, r: 250 } },
        note: 'The arc $AB$ subtends $120^\\circ$ at the centre and $60^\\circ$ at $R$. Move $R$ anywhere on the major arc and the angle at $R$ stays $60^\\circ$: half the angle at the centre, every time.'
      }
    ]
  },

  'c9-perimeter-area': {
    objective: 'Find the perimeter and area of triangles, quadrilaterals, circles, sectors and composite shapes, using Heron’s formula when only the three sides of a triangle are known.',
    intuition: 'Area counts unit squares; perimeter measures the fence round them. The two are not tied together: a long thin rectangle and a square can have the same perimeter and very different areas. Most area formulas come from cutting and moving pieces. A parallelogram becomes a rectangle by sliding a triangle across, and a triangle is half a parallelogram, so only the base and the perpendicular height matter.',
    check: [
      {
        question: 'Find the area of a triangle with sides $7$ cm, $8$ cm and $9$ cm.',
        answer: '$s = 12$, so the area is $\\sqrt{12 \\times 5 \\times 4 \\times 3} = \\sqrt{720} = 12\\sqrt{5}\\text{ cm}^2$.',
        verify: { kind: 'value', expr: 'sqrt(12*(12-7)*(12-8)*(12-9))', answer: '12*sqrt(5)' }
      },
      {
        question: 'Find the area of a sector of radius $14$ cm and angle $45^\\circ$, in terms of $\\pi$.',
        answer: '$\\tfrac{45}{360} \\times \\pi \\times 14^2 = \\tfrac{49\\pi}{2}\\text{ cm}^2$.',
        verify: { kind: 'value', expr: '(45/360)*pi*14^2', answer: '49*pi/2' }
      },
      {
        question: 'A path $3.5$ m wide runs round a circular garden of radius $14$ m. Find the area of the path, using $\\pi \\approx \\tfrac{22}{7}$.',
        answer: 'The outer radius is $17.5$ m, so the path is $\\pi(17.5^2 - 14^2) = 110.25\\pi \\approx 346.5\\text{ m}^2$.',
        verify: { kind: 'values', pairs: [['17.5^2-14^2', '110.25'], ['(22/7)*(17.5^2-14^2)', '346.5']] }
      }
    ],
    diagrams: [
      {
        title: 'Two parallelograms on the same base',
        spec: {
          kind: 'plane', xmin: -4, xmax: 9, ymin: -1, ymax: 5,
          lines: [{ through: [[0, 0], [1, 0]] }, { through: [[0, 4], [1, 4]] }],
          polygons: [{ points: [[0, 0], [6, 0], [8, 4], [2, 4]], label: 'P', shade: true }, { points: [[0, 0], [6, 0], [3, 4], [-3, 4]], label: 'Q' }],
          segments: [{ from: [2, 0], to: [2, 4], label: '4', dashed: true }],
          points: [{ x: 0, y: 0, label: 'A', pos: 'sw' }, { x: 6, y: 0, label: 'B', pos: 'se' }]
        },
        note: 'Both parallelograms stand on $AB = 6$ and reach the same parallel line, so both have height $4$ and area $6 \\times 4 = 24$ square units, however far they lean.'
      },
      {
        title: 'Heron’s triangle: $13$, $14$, $15$',
        spec: { kind: 'triangle', a: 14, b: 13, c: 15 },
        note: 'Here $s = 21$, and $\\sqrt{21 \\times 8 \\times 7 \\times 6} = 84$. The height to the side of length $14$ is $\\tfrac{2 \\times 84}{14} = 12$, which you can check against the picture.'
      },
      {
        title: 'Same perimeter, different area',
        spec: {
          kind: 'paramGraph', expr: 'x*(p/2-x)', xmin: -2, xmax: 24, ymin: -20, ymax: 130,
          params: [{ name: 'p', min: 8, max: 44, step: 4, initial: 40, label: 'p (perimeter)' }],
          show: ['roots', 'vertex']
        },
        note: 'A rectangle of perimeter $p$ and length $x$ has width $\\tfrac{p}{2} - x$ and area $x\\left(\\tfrac{p}{2} - x\\right)$. With $p = 40$ the area is largest, $100$, at $x = 10$: the square. Long thin rectangles with the same $40$ of fence enclose almost nothing.'
      }
    ]
  },

  'c9-probability': {
    objective: 'Find the probability of an event by counting equally likely outcomes, estimate it from repeated trials, and use $P(\\text{not } E) = 1 - P(E)$.',
    intuition: 'A probability is a long-run fraction. Roll a fair die many times and about half the rolls show a prime, because three of the six equally likely faces are prime. A few trials can stray far from that fraction; many trials rarely do. Counting works only when the outcomes really are equally likely, which is why two coins have four outcomes (HH, HT, TH, TT) and not three.',
    check: [
      {
        question: 'A letter is chosen at random from the word PROBABILITY. Find the probability that it is a B.',
        answer: 'The word has $11$ letters and $2$ of them are B, so the probability is $\\tfrac{2}{11}$.',
        verify: { kind: 'value', expr: '2/11', answer: '2/11' }
      },
      {
        question: 'A coin is tossed $200$ times and shows heads $112$ times. Estimate $P(\\text{head})$, and use the estimate to predict the heads in $500$ tosses.',
        answer: '$\\tfrac{112}{200} = 0.56$, so about $0.56 \\times 500 = 280$ heads.',
        verify: { kind: 'values', pairs: [['112/200', '0.56'], ['0.56*500', '280']] }
      },
      {
        question: 'Two fair dice are rolled. Find the probability that the total is $8$.',
        answer: 'Of the $36$ equally likely pairs, $(2,6), (3,5), (4,4), (5,3), (6,2)$ give $8$, so the probability is $\\tfrac{5}{36}$.',
        verify: { kind: 'value', expr: '5/36', answer: '5/36' }
      }
    ],
    diagrams: [
      {
        title: 'Two coins, four outcomes',
        spec: {
          kind: 'tree',
          branches: [
            { label: 'H', p: [1, 2], children: [{ label: 'H', p: [1, 2] }, { label: 'T', p: [1, 2] }] },
            { label: 'T', p: [1, 2], children: [{ label: 'H', p: [1, 2] }, { label: 'T', p: [1, 2] }] }
          ]
        },
        note: 'Each path is one outcome, with probability $\\tfrac12 \\times \\tfrac12 = \\tfrac14$. Exactly one head happens on two paths, HT and TH, so $P(\\text{one head}) = \\tfrac12$, not $\\tfrac13$.'
      },
      {
        title: 'Roll a die until the fraction settles',
        spec: { kind: 'probabilitySim', experiment: 'die', event: [2, 3, 5], seed: 9 },
        note: 'The event is a prime: $2$, $3$ or $5$, with theoretical probability $\\tfrac36 = \\tfrac12$. After $10$ rolls the experimental fraction can be far from $\\tfrac12$; add $1000$ more and it stays close to it.'
      }
    ]
  },

  'c9-sequences-progressions': {
    objective: 'Find the rule of an arithmetic or geometric progression, use it to find any term, and find the sum of the first $n$ terms of an arithmetic progression.',
    intuition: 'An arithmetic progression climbs a staircase with equal steps, so after $n-1$ steps from the first term you have added $(n-1)d$. To add up the terms, write the list forwards and backwards: every pair adds to the same total, first plus last, and there are $\\tfrac{n}{2}$ such pairs. A geometric progression multiplies instead of adding, so it grows (or shrinks) by the same factor each time.',
    check: [
      {
        question: 'Find the $15$th term of the AP $7, 12, 17, \\ldots$',
        answer: '$a_{15} = 7 + 14 \\times 5 = 77$.',
        verify: { kind: 'value', expr: '7+(15-1)*5', answer: '77' }
      },
      {
        question: 'Find the sum of the first $30$ odd numbers.',
        answer: 'The AP $1, 3, 5, \\ldots$ has $30$th term $59$, so $S_{30} = \\tfrac{30}{2}(1 + 59) = 900$.',
        verify: { kind: 'values', pairs: [['1+(30-1)*2', '59'], ['30/2*(1+59)', '900']] }
      },
      {
        question: 'How many terms of the AP $5, 9, 13, \\ldots$ must be added to make $230$?',
        answer: '$S_n = \\tfrac{n}{2}\\left(10 + 4(n-1)\\right) = n(2n + 3)$. Then $2n^2 + 3n - 230 = 0$ gives $n = 10$; the other root is negative.',
        verify: { kind: 'roots', f: '2*x^2+3*x-230', answers: ['10', '-23/2'] }
      }
    ],
    diagrams: [
      {
        title: 'Steps of $4$ from $3$',
        spec: { kind: 'sequenceExplorer', type: 'arithmetic', first: 3, step: 4, n: 20 },
        note: 'The terms $3, 7, 11, \\ldots$ rise by $4$ each time, so the points lie on a line. With $n = 20$ the last term is $79$ and $S_{20} = 820$, as in the worked example. Change $d$ and watch the slope of the points change with it.'
      },
      {
        title: 'Multiplying by $3$',
        spec: { kind: 'sequence', type: 'geometric', first: 2, step: 3, n: 6 },
        note: 'The terms are $2, 6, 18, 54, 162, 486$. Each is $3$ times the one before, so the $6$th term is $2 \\times 3^5 = 486$. The gaps between terms grow too, unlike an AP.'
      }
    ]
  }
};
