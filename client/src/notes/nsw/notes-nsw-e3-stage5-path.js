// Pri Learning · NSW Notes · Experience 3 layer (stage5-path), see notes/e3.js. Original writing, en-AU.
// The Stage 5 path focus areas (Years 9–10, the topics that lead into Advanced and Extension 1).
// Every number in a note was computed with the engine (client/src/engine/expr.js) or the kit's model.
export default {
  'ma5-alg-p-01': {
    objective: 'Factorise a quadratic expression completely: take out the common factor, then use a product–sum pair, grouping or a special form such as $a^2-b^2$.',
    intuition: 'Expanding $(x+3)(x+4)$ fills a rectangle with four pieces: $x^2$, $3x$, $4x$ and $12$. Factorising runs the picture backwards: given the total area $x^2+7x+12$, find the two side lengths. The constant $12$ is the corner piece, so the two numbers must multiply to $12$, and the two strips $3x$ and $4x$ add to the middle term, so the same numbers must add to $7$.',
    diagrams: [
      {
        title: 'The rectangle behind $(x+3)(x+4)$',
        spec: {
          kind: 'areaModel',
          rows: [{ size: 5, label: 'x' }, { size: 3, label: '3' }],
          cols: [{ size: 5, label: 'x' }, { size: 4, label: '4' }],
          cells: [['x^2', '4x'], ['3x', '12']]
        },
        note: 'The four pieces add to $x^2+4x+3x+12=x^2+7x+12$. The corner $12$ is $3\\times4$ and the two strips give $3x+4x=7x$: product $12$, sum $7$.'
      },
      {
        title: 'Which middle terms factorise?',
        spec: {
          kind: 'paramGraph',
          expr: 'x^2+b*x+12',
          params: [{ name: 'b', min: 0, max: 13, step: 1, initial: 7, label: 'middle coefficient $b$' }],
          xmin: -14, xmax: 4, ymin: -32, ymax: 16,
          show: ['roots', 'yIntercept']
        },
        note: 'Every curve crosses the $y$-axis at $12$. The roots are whole numbers only at $b=7$ (roots $-3$ and $-4$), $b=8$ ($-2$ and $-6$) and $b=13$ ($-1$ and $-12$): the sums of the factor pairs $3\\times4$, $2\\times6$ and $1\\times12$. For $b=0$ to $6$ there are no roots at all, and other values give roots that are not whole numbers.'
      }
    ]
  },

  'ma5-alg-p-02': {
    objective: 'Simplify, add, subtract, multiply and divide algebraic fractions by factorising first and cancelling only common factors.',
    intuition: 'An algebraic fraction is a family of number fractions, one for each value of $x$, so every rule from number fractions still holds. Cancelling works because $\\tfrac{x+3}{x+3}=1$ for every $x$ where it is defined. A term that is added, such as the $x^2$ in $x^2+3x$, is not a factor, so it cannot be cancelled on its own.',
    diagrams: [
      {
        title: 'Cancelling a factor leaves the same curve',
        spec: {
          kind: 'paramGraph',
          expr: '(x^2-a^2)/(x^2+a*x)',
          params: [{ name: 'a', min: 1, max: 5, step: 1, initial: 3, label: '$a$' }],
          xmin: -8, xmax: 8, ymin: -4, ymax: 6,
          show: ['asymptotes']
        },
        note: 'Since $\\dfrac{x^2-a^2}{x^2+a x}=\\dfrac{(x-a)(x+a)}{x(x+a)}$, the curve is $y=\\dfrac{x-a}{x}$ for every $a$, with asymptotes $x=0$ and $y=1$. The cancelled factor $x+a$ still matters at one point: the original fraction is undefined at $x=-a$, where the simplified one would give $y=2$. For $a=3$ that missing point is $(-3,2)$.'
      }
    ]
  },

  'ma5-are-p-01': {
    objective: 'Find the surface area of cones, spheres, hemispheres and composite solids, using the slant height of a cone and counting only the faces that are exposed.',
    intuition: 'Surface area is the paint needed to cover a solid. Cut a cone along a slant line and unroll it: the curved surface lies flat as a sector of a circle whose radius is the slant height $l$, which is why $l$ appears in $\\pi r l$ and the vertical height does not. A sphere\'s area, $4\\pi r^2$, is exactly four of its own great circles. When two solids are glued together, the joined faces are covered, so neither is painted.',
    diagrams: [
      {
        title: 'A cone with radius $5$ and height $12$',
        spec: { kind: 'solid', shape: 'cone', r: 5, h: 12 },
        note: 'The dashed lines are the radius $5$ cm and the vertical height $12$ cm. Neither is the slant edge; the slant height runs from the apex down the side to the rim.'
      },
      {
        title: 'The slant height by Pythagoras',
        spec: { kind: 'triangle', a: 5, b: 12, C: 90 },
        note: 'Slice the cone through its apex. The radius $5$ and the height $12$ are the two shorter sides of a right-angled triangle, so the slant height is $l=\\sqrt{5^2+12^2}=13$ cm. Then the total area is $\\pi\\times5^2+\\pi\\times5\\times13=25\\pi+65\\pi=90\\pi\\text{ cm}^2$.'
      },
      {
        title: 'Change the cone and watch the area',
        spec: { kind: 'solidExplorer', shape: 'cone', r: 5, h: 12 },
        note: 'Start at $r=5$, $h=12$: the surface area is $90\\pi\\approx282.7\\text{ cm}^2$. Make the cone taller with the same radius: only the curved part $\\pi r l$ grows, because the base $\\pi r^2$ depends on $r$ alone.'
      }
    ]
  },

  'ma5-cir-p-01': {
    objective: 'Find unknown angles in a circle using the angle at the centre, angles on the same arc, the angle in a semicircle, cyclic quadrilaterals and tangents, and give the theorem as the reason.',
    intuition: 'Draw radii to every point on the circle and each triangle formed is isosceles, because radii are equal. That one fact explains the theorems: the angle at the centre is twice the angle at the circumference because each half of the figure is an isosceles triangle whose outside angle is twice its base angle. Every other result here follows from it. A diameter makes a centre angle of $180^\\circ$, so the angle in a semicircle is $90^\\circ$.',
    diagrams: [
      {
        title: 'Move the point on the circumference',
        spec: { kind: 'circleExplorer', theorem: 'centre', initial: { a: 20, b: 140, r: 250 } },
        note: 'The arc runs from $20^\\circ$ to $140^\\circ$, so the angle at the centre is $120^\\circ$ and the angle at the circumference is $60^\\circ$. Move the point anywhere on the major arc: the $60^\\circ$ does not change, so every angle on that arc is equal, and the centre angle is always twice it.'
      },
      {
        title: 'Opposite angles of a cyclic quadrilateral',
        spec: { kind: 'circleExplorer', theorem: 'cyclic', initial: { a: 20, b: 114, c: 190, d: 270 } },
        note: 'This quadrilateral has $\\angle A=78^\\circ$, $\\angle B=95^\\circ$, $\\angle C=102^\\circ$ and $\\angle D=85^\\circ$, as in the worked example. Move a vertex: the angles change, but $\\angle A+\\angle C$ and $\\angle B+\\angle D$ stay at $180^\\circ$.'
      }
    ]
  },

  'ma5-dat-p-01': {
    objective: 'Calculate and interpret the standard deviation, and compare two data sets using a measure of centre and a measure of spread.',
    intuition: 'The standard deviation answers one question: how far is a typical value from the mean? If every value equalled the mean it would be $0$; the more the values scatter, the larger it gets. Because it is built from the mean and from squared distances, one extreme value pulls it a long way, while the median and the interquartile range, which only depend on the middle of the ordered list, hardly move.',
    diagrams: [
      {
        title: 'Move one value and watch the measures',
        spec: { kind: 'dataExplorer', data: [2, 4, 4, 4, 5, 5, 7, 9], editable: [7], show: ['mean', 'median', 'sd', 'iqr'] },
        note: 'At the start the mean is $5$, the median is $4.5$ and the standard deviation is $2$. Drag the largest value from $9$ to $17$: the mean rises to $6$ and the standard deviation more than doubles to about $4.36$, but the median stays at $4.5$ and the interquartile range does not change.'
      }
    ]
  },

  'ma5-equ-p-01': {
    objective: 'Solve a quadratic equation by writing it equal to zero, factorising and using the null factor law, and reject solutions that do not fit a problem.',
    intuition: 'The null factor law works only because the right-hand side is zero: if a product of two numbers is zero, one of them must be zero, but a product equal to $6$ tells you nothing about either factor alone. On a graph, the solutions of $(x-p)(x-q)=0$ are where the parabola $y=(x-p)(x-q)$ meets the $x$-axis, and those crossings are exactly $x=p$ and $x=q$.',
    diagrams: [
      {
        title: 'The roots are read from the factors',
        spec: {
          kind: 'paramGraph',
          expr: '(x-p)*(x-q)',
          params: [
            { name: 'p', min: -4, max: 9, step: 1, initial: 7, label: '$p$' },
            { name: 'q', min: -4, max: 9, step: 1, initial: -2, label: '$q$' }
          ],
          xmin: -5, xmax: 10, ymin: -24, ymax: 20,
          show: ['roots', 'yIntercept']
        },
        note: 'At $p=7$, $q=-2$ the curve is $y=(x-7)(x+2)=x^2-5x-14$, crossing the axis at $x=7$ and $x=-2$, the solutions of the first worked example. Move either slider: the crossing moves with it, and the $y$-intercept is always $pq$. Set $p=q$ and the two roots become one.'
      },
      {
        title: 'The rectangle in the word problem',
        spec: {
          kind: 'areaModel',
          rows: [{ size: 5, label: 'x' }],
          cols: [{ size: 5, label: 'x' }, { size: 3, label: '3' }],
          cells: [['x^2', '3x']]
        },
        note: 'Width $x$ and length $x+3$ give area $x^2+3x=40$, so $x^2+3x-40=0$ and $(x+8)(x-5)=0$. The root $x=-8$ is rejected because a width cannot be negative, leaving a width of $5$ cm.'
      }
    ]
  },

  'ma5-equ-p-02': {
    objective: 'Solve any quadratic equation exactly by completing the square or the quadratic formula, and use the discriminant to state the number of real solutions before solving.',
    intuition: 'Completing the square is a picture: $x^2+6x$ is a square of side $x$ with two strips of $3x$, and it is one small $3\\times3$ square short of the full square $(x+3)^2$. Adding that missing $9$ turns the equation into a square equal to a number, which square roots undo. The quadratic formula is the same steps done once with letters, and $b^2-4ac$ is the number left under the root, so its sign decides how many square roots there are.',
    diagrams: [
      {
        title: 'The missing corner in $x^2+6x$',
        spec: {
          kind: 'areaModel',
          rows: [{ size: 5, label: 'x' }, { size: 3, label: '3' }],
          cols: [{ size: 5, label: 'x' }, { size: 3, label: '3' }],
          cells: [['x^2', '3x'], ['3x', '9']]
        },
        note: 'The pieces $x^2+3x+3x$ are $x^2+6x$; the corner $9$ completes the square $(x+3)^2$. So $x^2+6x+2=0$ becomes $(x+3)^2=7$, and $x=-3\\pm\\sqrt{7}$.'
      },
      {
        title: 'Change $a$, $b$ and $c$',
        spec: {
          kind: 'paramGraph',
          expr: 'a*x^2+b*x+c',
          params: [
            { name: 'a', min: 0.5, max: 3, step: 0.5, initial: 2, label: '$a$' },
            { name: 'b', min: -6, max: 6, step: 1, initial: -5, label: '$b$' },
            { name: 'c', min: -6, max: 6, step: 1, initial: -1, label: '$c$' }
          ],
          xmin: -4, xmax: 5, ymin: -8, ymax: 10,
          show: ['roots', 'vertex']
        },
        note: 'The start is $y=2x^2-5x-1$, with $\\Delta=25+8=33>0$: two roots, $x=\\tfrac{5\\pm\\sqrt{33}}{4}$, about $2.69$ and $-0.19$, and the vertex at $(1.25,-4.125)$. Raise $c$ and the vertex rises; once $\\Delta=b^2-4ac$ is negative the curve no longer reaches the axis. At $a=3$, $b=-2$, $c=5$ you see the third worked example: $\\Delta=-56$ and no crossing.'
      }
    ]
  },

  'ma5-fnc-p-01': {
    objective: 'Use function notation, state a domain and range, and recognise and sketch hyperbolas, circles centred at the origin and exponential curves from their equations.',
    intuition: 'A function gives each input one output, never two. A circle fails that test, since $x=3$ meets $x^2+y^2=25$ at both $y=4$ and $y=-4$, so the circle is a relation but not a function. Each family has a feature that comes straight from its equation: $y=\\tfrac{k}{x}$ can never use $x=0$, and $y=a^x$ is $1$ at $x=0$ for every base, because $a^0=1$.',
    diagrams: [
      {
        title: 'The circle $x^2+y^2=25$',
        spec: {
          kind: 'plane',
          xmin: -6, xmax: 6, ymin: -6, ymax: 6,
          circles: [{ cx: 0, cy: 0, r: 5, label: 'x^2+y^2=25' }],
          points: [{ x: 3, y: 4, label: '(3,4)', pos: 'ne' }, { x: 3, y: -4, label: '(3,-4)', pos: 'se' }, { x: 0, y: 0, label: 'O', pos: 'sw' }],
          segments: [{ from: [0, 0], to: [3, 4], label: '5' }, { from: [3, 4], to: [3, -4], dashed: true }]
        },
        note: 'Every point is $5$ from the origin, which is what $x^2+y^2=25$ says. The dashed line $x=3$ meets the circle twice, at $(3,4)$ and $(3,-4)$: one input with two outputs, so the circle is not a function.'
      },
      {
        title: 'Every exponential passes through $(0,1)$',
        spec: {
          kind: 'paramGraph',
          expr: 'a^x',
          params: [{ name: 'a', min: 0.2, max: 4, step: 0.1, initial: 2, label: 'base $a$' }],
          xmin: -4, xmax: 4, ymin: -1, ymax: 10,
          show: ['yIntercept']
        },
        note: 'At $a=2$ the curve passes through $(0,1)$ and $(3,8)$. Change the base: the curve pivots about $(0,1)$, climbs for $a>1$, falls for $0<a<1$, and stays above the $x$-axis, so the range is $y>0$. At $a=1$ it is the flat line $y=1$.'
      }
    ]
  },

  'ma5-geo-p-01': {
    objective: 'Prove that two triangles are similar, find unknown sides with the scale factor, and use $k^2$ and $k^3$ for areas and volumes.',
    intuition: 'Similar figures are enlargements of each other, like a photo printed at two sizes. Equal angles fix the shape and the scale factor fixes the size, so once two angles match, every pair of corresponding sides is in the same ratio. An area has two dimensions, each multiplied by $k$, so it grows by $k^2$; a volume has three, so it grows by $k^3$.',
    diagrams: [
      {
        title: 'A pole and a tree in the same sunlight',
        spec: {
          kind: 'plane',
          xmin: -1, xmax: 19, ymin: -1, ymax: 9, axes: false,
          polygons: [{ points: [[0, 0], [0, 2], [3, 0]], shade: true }, { points: [[6, 0], [6, 8], [18, 0]], shade: true }],
          segments: [
            { from: [0, 0], to: [0, 2], label: '2' }, { from: [0, 0], to: [3, 0], label: '3' },
            { from: [6, 0], to: [6, 8], label: 'h' }, { from: [6, 0], to: [18, 0], label: '12' }
          ],
          angles: [{ at: [3, 0], from: [0, 0], to: [0, 2], label: 'auto' }, { at: [18, 0], from: [6, 0], to: [6, 8], label: 'auto' }]
        },
        note: 'The sun\'s rays meet the ground at the same angle, about $33.7^\\circ$, and both objects stand at right angles to the ground, so the triangles are similar (AA). The scale factor is $\\tfrac{12}{3}=4$, so the tree is $h=4\\times2=8$ m.'
      },
      {
        title: 'Scale a triangle and compare areas',
        spec: { kind: 'triangleExplorer', mode: 'similar', initial: { a: 3, b: 4, c: 5, k: 3 } },
        note: 'The $3$, $4$, $5$ triangle has area $6$. At scale factor $k=3$ the sides become $9$, $12$ and $15$ and the area becomes $54$, which is $3^2=9$ times as much. Move $k$: the side ratio is $k$, the area ratio is always $k^2$.'
      }
    ]
  },

  'ma5-geo-p-02': {
    objective: 'Prove two triangles congruent with SSS, SAS, AAS or RHS, then use the matching sides and angles to prove a further result.',
    intuition: 'Each congruence test lists just enough information to build exactly one triangle. Given three sides, or two sides and the angle between them, there is only one way to draw it, so any two triangles with that information must be copies. Two sides and an angle that is not between them is not a test, because that information can sometimes be met by two different triangles.',
    interactiveNone: 'A congruence proof is a chain of stated reasons about one fixed figure; moving a vertex changes the figure but does not teach which facts prove the triangles identical.',
    diagrams: [
      {
        title: 'The diagonal of a parallelogram',
        spec: {
          kind: 'plane',
          xmin: -1, xmax: 12, ymin: -1, ymax: 6, axes: false,
          points: [{ x: 0, y: 0, label: 'A', pos: 'sw' }, { x: 8, y: 0, label: 'B', pos: 'se' }, { x: 11, y: 5, label: 'C', pos: 'ne' }, { x: 3, y: 5, label: 'D', pos: 'nw' }],
          segments: [
            { from: [0, 0], to: [8, 0], ticks: 1 }, { from: [3, 5], to: [11, 5], ticks: 1 },
            { from: [0, 0], to: [3, 5], ticks: 2 }, { from: [8, 0], to: [11, 5], ticks: 2 },
            { from: [0, 0], to: [11, 5] }, { from: [3, 5], to: [3, 0], dashed: true, label: '5' }
          ],
          angles: [{ at: [3, 0], from: [0, 0], to: [3, 5], right: true }]
        },
        note: 'Opposite sides of a parallelogram are equal ($AB=DC$, one tick; $AD=BC$, two ticks) and $AC$ is common to both triangles, so $\\triangle ABC\\equiv\\triangle CDA$ (SSS). With $AB=8$ and height $5$ the parallelogram has area $40$, so each triangle has area $20\\text{ cm}^2$.'
      }
    ]
  },

  'ma5-ind-p-01': {
    objective: 'Evaluate and simplify expressions with negative and fractional indices by rewriting them as reciprocals and roots and applying the index laws.',
    intuition: 'Negative and fractional indices are not new rules; they are the only meanings that keep the old laws true. Going down the powers of $2$, each step divides by $2$: $8$, $4$, $2$, $1$, then $\\tfrac12$, $\\tfrac14$, $\\tfrac18$, so $2^0=1$ and $2^{-3}=\\tfrac18$. And since $9^{1/2}\\times9^{1/2}=9^1=9$, the number $9^{1/2}$ must be $3$, the square root.',
    diagrams: [
      {
        title: 'Powers of $2$ continued below zero',
        spec: {
          kind: 'function',
          xmin: -4, xmax: 4, ymin: -1, ymax: 9,
          curves: [{ expr: '2^x', label: 'y=2^x' }],
          points: [{ x: -3, y: 0.125, label: '(-3,\\tfrac18)' }, { x: -1, y: 0.5, label: '(-1,\\tfrac12)' }, { x: 0, y: 1, label: '(0,1)' }, { x: 3, y: 8, label: '(3,8)' }]
        },
        note: 'Each step of $1$ to the left halves the height: $2^0=1$, $2^{-1}=\\tfrac12$, $2^{-3}=\\tfrac18$. The curve never reaches $0$, because a negative index gives a reciprocal, never a negative number.'
      },
      {
        title: 'The curve $y=x^n$ for different indices',
        spec: {
          kind: 'paramGraph',
          expr: 'x^n',
          params: [{ name: 'n', min: -2, max: 3, step: 0.5, initial: 0.5, label: 'index $n$' }],
          xmin: -1, xmax: 6, ymin: -1, ymax: 6
        },
        note: 'At $n=\\tfrac12$ the curve is $y=\\sqrt{x}$ and passes through $(4,2)$. Every curve passes through $(1,1)$ because $1^n=1$. At $n=-1$ it is $y=\\tfrac1x$, through $(2,\\tfrac12)$; at $n=2$ it is the parabola, through $(2,4)$.'
      }
    ]
  },

  'ma5-ind-p-02': {
    objective: 'Simplify surds, add, subtract, multiply and divide them, and rationalise a denominator, including one of the form $a+\\sqrt{b}$.',
    intuition: 'A surd is an exact length. The diagonal of a unit square is exactly $\\sqrt2$; writing $1.414$ would already be wrong in the fourth decimal place. Surds behave like algebra: $\\sqrt2$ is a single quantity, so $3\\sqrt2+5\\sqrt2=8\\sqrt2$ just as $3x+5x=8x$. Rationalising with the conjugate works because $(a+\\sqrt b)(a-\\sqrt b)$ is a difference of two squares, and squaring removes the root.',
    diagrams: [
      {
        title: 'Surd lengths from right-angled triangles',
        spec: { kind: 'triangleExplorer', mode: 'pythagoras', initial: { a: 1, b: 1 } },
        note: 'Legs $1$ and $1$ give a hypotenuse of $\\sqrt2$. Change the legs: $1$ and $2$ give $\\sqrt5$, and $2$ and $2$ give $\\sqrt8=2\\sqrt2$, twice the first triangle because every side has doubled.'
      }
    ]
  },

  'ma5-lin-p-01': {
    objective: 'Decide whether two lines are parallel or perpendicular from their gradients, find the equation of a line through a point, and find where two lines meet.',
    intuition: 'Turn a line through a quarter turn and its rise and run swap places, and one of them changes sign. A line that goes $1$ across and $2$ up becomes one that goes $2$ across and $1$ down, so a gradient of $2$ becomes $-\\tfrac12$. That is why perpendicular gradients are negative reciprocals and multiply to $-1$. Parallel lines climb at the same rate, so their gradients are equal.',
    diagrams: [
      {
        title: 'Perpendicular lines through $(0,3)$',
        spec: {
          kind: 'plane',
          xmin: -3, xmax: 7, ymin: -2, ymax: 8,
          lines: [{ through: [[0, 3], [1, 5]], label: 'y=2x+3' }, { through: [[0, 3], [4, 1]], label: 'y=-\\tfrac12x+3' }],
          points: [{ x: 0, y: 3, label: '(0,3)', pos: 'nw' }, { x: 4, y: 1, label: '(4,1)', pos: 'ne' }],
          angles: [{ at: [0, 3], from: [1, 5], to: [4, 1], right: true }]
        },
        note: 'The line through $(4,1)$ perpendicular to $y=2x+3$ has gradient $-\\tfrac12$, and its equation is $y=-\\tfrac12x+3$. The two lines happen to meet on the $y$-axis at $(0,3)$, and $2\\times\\left(-\\tfrac12\\right)=-1$.'
      },
      {
        title: 'Turn a line about $(4,1)$',
        spec: {
          kind: 'paramGraph',
          expr: 'm*(x-4)+1',
          params: [{ name: 'm', min: -3, max: 3, step: 0.5, initial: 1, label: 'gradient $m$' }],
          xmin: -3, xmax: 8, ymin: -2, ymax: 12,
          fixed: [{ expr: '2*x+3', label: 'y=2x+3' }]
        },
        note: 'Every line here is $y-1=m(x-4)$, so it passes through $(4,1)$. At $m=2$ it is parallel to $y=2x+3$ and never meets it. At $m=-\\tfrac12$ it is perpendicular. At every other gradient the two lines cross at exactly one point.'
      }
    ]
  },

  'ma5-log-p-01': {
    objective: 'Convert between logarithmic and index form, evaluate and simplify logarithms with the log laws, and solve $a^x=b$ using logarithms.',
    intuition: 'A logarithm is an index looked up backwards: $\\log_2 8$ asks which power of $2$ gives $8$, and the answer is $3$. Because multiplying powers adds their indices, the log of a product is the sum of the logs; that is the only reason the log laws exist. The curve $y=\\log_b x$ is $y=b^x$ reflected in $y=x$, since the two undo each other.',
    diagrams: [
      {
        title: 'Solving $3^x=20$ on a graph',
        spec: {
          kind: 'function',
          xmin: -2, xmax: 4, ymin: -2, ymax: 30,
          curves: [{ expr: '3^x', label: 'y=3^x' }, { expr: '20', label: 'y=20' }],
          points: [{ x: 2.727, y: 20, label: 'x\\approx2.727' }, { x: 2, y: 9, label: '(2,9)' }, { x: 3, y: 27, label: '(3,27)' }]
        },
        note: 'Since $3^2=9$ and $3^3=27$, the solution of $3^x=20$ lies between $2$ and $3$. Logarithms give it exactly: $x=\\dfrac{\\log 20}{\\log 3}\\approx2.727$, where the curve meets the line $y=20$.'
      },
      {
        title: 'Change the base of $y=\\log_b x$',
        spec: {
          kind: 'paramGraph',
          expr: 'ln(x)/ln(b)',
          params: [{ name: 'b', min: 1.5, max: 10, step: 0.5, initial: 2, label: 'base $b$' }],
          xmin: -1, xmax: 11, ymin: -4, ymax: 5,
          show: ['roots']
        },
        note: 'The curve $y=\\log_b x=\\dfrac{\\ln x}{\\ln b}$ crosses the $x$-axis at $x=1$ for every base, since $\\log_b 1=0$, and passes through $(b,1)$, since $\\log_b b=1$. At $b=2$ it passes through $(8,3)$. It exists only for $x>0$.'
      }
    ]
  },

  'ma5-net-p-01': {
    objective: 'Find the degrees and number of edges of a network, decide whether a path uses every edge once, and find a minimum spanning tree and a shortest path.',
    intuition: 'Every edge has two ends, so adding all the degrees counts each edge twice; that is the whole reason the degree sum is $2E$. A path through every edge must leave each vertex as often as it arrives, which pairs up the edge ends at every vertex except where it starts and finishes. So only those two vertices can have odd degree. A spanning tree reaches every vertex with no cycle, because a cycle always contains an edge that could be removed.',
    interactiveNone: 'These skills are counting and comparing on one fixed network; there is no quantity whose movement teaches more than the two highlighted networks with their weights.',
    diagrams: [
      {
        title: 'A minimum spanning tree for the five towns',
        spec: {
          kind: 'network',
          nodes: [{ id: 'A', x: 0, y: 1 }, { id: 'B', x: 1, y: 2 }, { id: 'C', x: 1, y: 0 }, { id: 'D', x: 3, y: 2 }, { id: 'E', x: 3, y: 0 }],
          edges: [
            { from: 'A', to: 'B', weight: 4 }, { from: 'A', to: 'C', weight: 3 }, { from: 'B', to: 'C', weight: 2 }, { from: 'B', to: 'D', weight: 5 },
            { from: 'C', to: 'D', weight: 6 }, { from: 'C', to: 'E', weight: 7 }, { from: 'D', to: 'E', weight: 4 }
          ],
          path: ['A', 'C', 'B', 'D', 'E']
        },
        note: 'Take the lightest edges first: $BC=2$, $AC=3$, then $AB=4$ is skipped because it would close the cycle $ABC$, then $DE=4$ and $BD=5$. The highlighted tree has $5-1=4$ edges and total length $2+3+4+5=14$ km.'
      },
      {
        title: 'The shortest route from $A$ to $E$',
        spec: {
          kind: 'network',
          nodes: [{ id: 'A', x: 0, y: 1 }, { id: 'B', x: 1, y: 2 }, { id: 'C', x: 1, y: 0 }, { id: 'D', x: 3, y: 2 }, { id: 'E', x: 3, y: 0 }],
          edges: [
            { from: 'A', to: 'B', weight: 4 }, { from: 'A', to: 'C', weight: 3 }, { from: 'B', to: 'C', weight: 2 }, { from: 'B', to: 'D', weight: 5 },
            { from: 'C', to: 'D', weight: 6 }, { from: 'C', to: 'E', weight: 7 }, { from: 'D', to: 'E', weight: 4 }
          ],
          path: ['A', 'C', 'E']
        },
        note: 'The route $A\\to C\\to E$ is $3+7=10$ km. The others are longer: $A\\to B\\to D\\to E$ and $A\\to C\\to D\\to E$ are both $13$ km. The minimum spanning tree does not give the shortest route: along the tree, $A$ to $E$ is $14$ km.'
      }
    ]
  },

  'ma5-nli-p-01': {
    objective: 'Recognise, sketch and use circles with any centre, exponential curves $y=a\\times b^x$, hyperbolas and cubics, including finding where two graphs meet.',
    intuition: 'Each equation is a description of its graph. The circle equation $(x-h)^2+(y-k)^2=r^2$ is Pythagoras, saying the distance from $(h,k)$ is $r$. In $y=a\\times b^x$ the number $a$ is the starting value and $b$ is what each step multiplies by, the way a balance grows by a fixed percentage. Where two graphs meet, both equations are true at once, so solving them together gives the crossing points.',
    diagrams: [
      {
        title: 'The circle $(x-2)^2+(y+1)^2=25$',
        spec: {
          kind: 'plane',
          xmin: -4, xmax: 8, ymin: -7, ymax: 5,
          circles: [{ cx: 2, cy: -1, r: 5 }],
          points: [{ x: 2, y: -1, label: '(2,-1)', pos: 's' }, { x: 5, y: 3, label: '(5,3)', pos: 'ne' }],
          segments: [{ from: [2, -1], to: [5, 3], label: '5' }]
        },
        note: 'The centre is $(2,-1)$, not $(-2,1)$: the signs in the equation are the opposite of the coordinates. The point $(5,3)$ is $3$ across and $4$ up from the centre, a distance of $\\sqrt{3^2+4^2}=5$, so it lies on the circle.'
      },
      {
        title: 'The two numbers in $y=a\\times b^x$',
        spec: {
          kind: 'paramGraph',
          expr: 'a*b^x',
          params: [
            { name: 'a', min: 1, max: 10, step: 1, initial: 5, label: 'starting value $a$' },
            { name: 'b', min: 0.5, max: 3, step: 0.1, initial: 2, label: 'growth factor $b$' }
          ],
          xmin: -3, xmax: 5, ymin: -5, ymax: 60,
          show: ['yIntercept']
        },
        note: 'At $a=5$, $b=2$ the curve passes through $(0,5)$ and $(3,40)$, as in the worked example. Moving $a$ moves the $y$-intercept, which is always $a$. Moving $b$ changes the steepness; below $b=1$ the curve falls towards the $x$-axis instead.'
      }
    ]
  },

  'ma5-pol-p-01': {
    objective: 'Add, multiply and divide polynomials, and use the remainder and factor theorems to factorise a cubic and find its roots.',
    intuition: 'Dividing $P(x)$ by $x-a$ leaves $P(x)=(x-a)Q(x)+R$. Put $x=a$ and the first term vanishes, so $R=P(a)$: the remainder is just the height of the graph at $x=a$. If that height is $0$, the graph crosses the axis there and $x-a$ divides exactly. That is the factor theorem, and it replaces guessing with a short list of values to test.',
    diagrams: [
      {
        title: 'The remainder is a height on the graph',
        spec: {
          kind: 'function',
          xmin: -3, xmax: 2, ymin: -6, ymax: 16,
          curves: [{ expr: '2*x^3+x^2-4*x+3', label: 'y=P(x)' }],
          points: [{ x: -2, y: -1, label: '(-2,-1)' }, { x: 0, y: 3, label: '(0,3)' }]
        },
        note: 'For $P(x)=2x^3+x^2-4x+3$, the point at $x=-2$ is $(-2,-1)$, so dividing by $x+2$ leaves remainder $-1$. Since that height is not $0$, $x+2$ is not a factor.'
      },
      {
        title: 'Find $k$ so that $x-2$ is a factor',
        spec: {
          kind: 'paramGraph',
          expr: 'x^3+k*x^2-3*x+2',
          params: [{ name: 'k', min: -3, max: 2, step: 0.5, initial: 1, label: '$k$' }],
          xmin: -4, xmax: 4, ymin: -10, ymax: 12,
          show: ['roots']
        },
        note: 'Here $P(2)=8+4k-6+2=4k+4$. Move $k$ until the curve passes through $(2,0)$: that happens only at $k=-1$. Then $P(x)=(x-2)(x^2+x-1)$, and the other roots are $\\tfrac{-1\\pm\\sqrt5}{2}$, about $0.62$ and $-1.62$.'
      }
    ]
  },

  'ma5-pro-p-01': {
    objective: 'Find probabilities of dependent and independent events using trees, Venn diagrams and two-way tables, and find a conditional probability.',
    intuition: 'Drawing without replacement changes the bag, so the second draw has different chances from the first; that is what dependent means. A condition such as "given they play netball" throws away everyone outside that group, so the probability is a fraction of that smaller group, not of everyone. Multiplying along a tree branch is the same idea: of the cases where the first event happened, what fraction then has the second.',
    diagrams: [
      {
        title: 'Draw from the bag many times',
        spec: { kind: 'probabilitySim', experiment: 'bag', bag: [{ label: 'R', weight: 5 }, { label: 'B', weight: 3 }], event: ['R'], seed: 7 },
        note: 'Each trial draws one marble from $5$ red and $3$ blue and puts it back. After a few trials the fraction of reds jumps about; after $1000$ it settles near $\\tfrac58=0.625$, the first branch of the tree. Without replacement the second draw would use $7$ marbles, so it would no longer have these chances.'
      }
    ]
  },

  'ma5-rat-p-01': {
    objective: 'Recognise direct and inverse variation, find the constant of variation from one pair of values, and use it to predict others.',
    intuition: 'Direct variation means one quantity is always the same multiple of another, like cost and the number of identical items bought. Inverse variation means the product stays fixed, like the speed and time for one trip: double the speed and the time halves. In both cases one known pair fixes the constant, and the constant fixes everything else.',
    diagrams: [
      {
        title: 'Direct variation with the square: $y=3x^2$',
        spec: {
          kind: 'function',
          xmin: -1, xmax: 6, ymin: -10, ymax: 85,
          curves: [{ expr: '3*x^2', label: 'y=3x^2' }],
          points: [{ x: 2, y: 12, label: '(2,12)' }, { x: 5, y: 75, label: '(5,75)' }]
        },
        note: 'From $y=12$ at $x=2$, $k=\\tfrac{12}{2^2}=3$. Then at $x=5$, $y=3\\times25=75$. Multiplying $x$ by $2.5$ multiplied $y$ by $2.5^2=6.25$.'
      },
      {
        title: 'Inverse variation: change the constant',
        spec: {
          kind: 'paramGraph',
          expr: 'k/x',
          params: [{ name: 'k', min: 6, max: 60, step: 6, initial: 24, label: 'constant $k$' }],
          xmin: -1, xmax: 16, ymin: -1, ymax: 14,
          show: ['asymptotes']
        },
        note: 'At $k=24$ the curve passes through $(4,6)$ and $(8,3)$: doubling $x$ halves $y$. At $k=60$ it passes through $(6,10)$ and $(15,4)$: $6$ workers take $10$ days and $15$ workers take $4$, since workers times days is always $60$.'
      }
    ]
  },

  'ma5-rat-p-02': {
    objective: 'Find an average rate of change as the gradient of a chord, estimate an instantaneous rate from shrinking intervals, and interpret rates with their units.',
    intuition: 'An average rate pretends the change happened steadily: it is the gradient of the straight chord between two points on the curve. On a curve the true rate keeps changing, so the chord over a long interval mixes slow and fast parts. Shrink the interval and the chord hugs the curve more and more closely, and its gradient settles towards the rate at that single point.',
    diagrams: [
      {
        title: 'Average growth of the bacteria',
        spec: {
          kind: 'function',
          xmin: -1, xmax: 4, ymin: -150, ymax: 1000, xLabel: 't', yLabel: 'N',
          curves: [{ expr: '100*2^x', label: 'N=100\\times2^t' }, { expr: '300*x-100', label: '\\text{chord}' }],
          points: [{ x: 1, y: 200, label: '(1,200)' }, { x: 3, y: 800, label: '(3,800)' }]
        },
        note: 'The chord joins $(1,200)$ to $(3,800)$, so its gradient is $\\tfrac{800-200}{3-1}=300$ cells per hour. The curve lies below the chord between them: growth is slower than $300$ per hour near $t=1$ and faster near $t=3$.'
      }
    ]
  },

  'ma5-trg-p-01': {
    objective: 'Find unknown sides and angles in any triangle with the sine rule and the cosine rule, and find its area with $\\tfrac12ab\\sin C$.',
    intuition: 'Drop a perpendicular from one vertex and any triangle splits into two right-angled triangles. That height is $b\\sin C$ from one side and $c\\sin B$ from the other, which is the sine rule, and half the base times that height is $\\tfrac12ab\\sin C$. The cosine rule is Pythagoras corrected for the angle: the $-2ab\\cos C$ term shrinks $c$ when $C$ is acute, lengthens it when $C$ is obtuse, and is $0$ at $90^\\circ$.',
    diagrams: [
      {
        title: 'Two sides and the angle between them',
        spec: { kind: 'triangle', a: 7, b: 9, C: 60 },
        note: 'With $a=7$, $b=9$ and $C=60^\\circ$ the cosine rule gives $c^2=49+81-63=67$, so $c=\\sqrt{67}\\approx8.19$. The figure is drawn to scale, so the third side measures this length.'
      },
      {
        title: 'Area from two sides and an angle',
        spec: { kind: 'triangleExplorer', mode: 'area', initial: { a: 7, b: 9, C: 60 } },
        note: 'At $a=7$, $b=9$, $C=60^\\circ$ the area is $\\tfrac12\\times7\\times9\\times\\sin60^\\circ\\approx27.28$. Open the angle towards $90^\\circ$ and the area grows to its largest, $31.5$; keep opening it and the area falls again, because $\\sin C$ falls.'
      }
    ]
  },

  'ma5-trg-p-02': {
    objective: 'Find trigonometric ratios of any angle from the unit circle, using the quadrant for the sign and the reference angle for the size, and solve simple equations for $0^\\circ\\le\\theta\\le360^\\circ$.',
    intuition: 'On the unit circle, $\\cos\\theta$ and $\\sin\\theta$ are just the coordinates of the point you reach, so the signs come for free: to the left of the $y$-axis the cosine is negative, below the $x$-axis the sine is negative. Points that are mirror images in an axis share the same reference angle, so their ratios have the same size. That is also why $\\sin\\theta=k$ usually has two answers in one turn: one point and its mirror image have the same height.',
    diagrams: [
      {
        title: 'Two angles with the same sine',
        spec: {
          kind: 'function',
          xmin: -30, xmax: 390, ymin: -1.5, ymax: 1.5, xTicks: [0, 90, 180, 270, 360],
          curves: [{ expr: 'sin(x*pi/180)', label: 'y=\\sin\\theta' }, { expr: 'sqrt(3)/2', label: 'y=\\tfrac{\\sqrt3}{2}' }],
          points: [{ x: 60, y: 0.866, label: '60^\\circ' }, { x: 120, y: 0.866, label: '120^\\circ' }]
        },
        note: 'The horizontal axis is $\\theta$ in degrees. The line $y=\\tfrac{\\sqrt3}{2}$ meets the sine curve twice between $0^\\circ$ and $360^\\circ$, at $60^\\circ$ and at $180^\\circ-60^\\circ=120^\\circ$, the two solutions of $2\\sin\\theta=\\sqrt3$. From $180^\\circ$ to $360^\\circ$ the sine is negative, so there are no more.'
      }
    ]
  },

  'ma5-vol-p-01': {
    objective: 'Find the volume of pyramids, cones, spheres and hemispheres, and of composite solids made by adding or removing these.',
    intuition: 'A cone fits inside the cylinder with the same base and height, and three cones of water exactly fill that cylinder; a pyramid stands to its prism in the same way. Narrowing to a point loses two thirds of the space. A sphere\'s volume depends only on its radius, because every sphere is an enlargement of every other, so the volume scales as $r^3$.',
    diagrams: [
      {
        title: 'A cone with radius $3$ and height $4$',
        spec: { kind: 'solid', shape: 'cone', r: 3, h: 4 },
        note: 'The cylinder with the same base and height holds $\\pi\\times3^2\\times4=36\\pi$. The cone holds one third of that, $12\\pi\\approx37.7\\text{ cm}^3$.'
      },
      {
        title: 'A square pyramid',
        spec: { kind: 'solid', shape: 'pyramid', l: 6, w: 6, h: 5 },
        note: 'The base is $6\\times6=36\\text{ m}^2$ and the perpendicular height is $5$ m, the dashed line from the apex. The volume is $\\tfrac13\\times36\\times5=60\\text{ m}^3$.'
      },
      {
        title: 'Resize the cone',
        spec: { kind: 'solidExplorer', shape: 'cone', r: 3, h: 4 },
        note: 'Start at $r=3$, $h=4$: $V=12\\pi$. Double the height and the volume doubles to $24\\pi$; double the radius instead and it is four times as large, $48\\pi$, because the radius is squared.'
      }
    ]
  }
};
