// Pri Learning · Experience 3 layer for CBSE Class 8 notes (see notes/e3.js). Original writing.
// Every checkpoint answer carries a verify block the engine re-derives (client/test/notes-e3-check.mjs),
// and every diagram is drawn from the same numbers as the chapter's own examples where it can be.
export default {
  'c8-rational-numbers': {
    objective: 'Add, subtract, multiply and divide rational numbers, place them on a number line, and find as many rational numbers as you need between any two given ones.',
    intuition: 'A rational number is a point you can reach on the number line by cutting each unit into $q$ equal pieces and counting $p$ of them. Adding $\\tfrac58$ is a step of $\\tfrac58$ to the right; adding a negative number is a step to the left. Between any two such points there is a midpoint, and between that midpoint and either end there is another, so the cutting never runs out. That is why no rational number has a "next" one.',
    check: [
      { question: 'Find $-\\tfrac25+\\tfrac{7}{10}$ in lowest terms.', answer: '$\\tfrac{3}{10}$', verify: { kind: 'value', expr: '-2/5+7/10', answer: '3/10' } },
      { question: 'Find $\\tfrac34\\times\\left(-\\tfrac89\\right)$.', answer: '$-\\tfrac23$', verify: { kind: 'value', expr: '(3/4)*(-8/9)', answer: '-2/3' } },
      { question: 'Find the rational number exactly halfway between $-\\tfrac13$ and $\\tfrac12$.', answer: '$\\tfrac{1}{12}$', verify: { kind: 'value', expr: '(-1/3+1/2)/2', answer: '1/12' } }
    ],
    diagrams: [
      {
        title: 'Adding $\\tfrac58$ to $-\\tfrac34$ as a step along the line',
        spec: { kind: 'numberLineStepper', op: 'add', a: -0.75, b: 0.625, min: -1, max: 1, step: 0.125, fractions: 8 },
        note: 'In eighths, $-\\tfrac34$ is $-\\tfrac68$. A step of $\\tfrac58$ to the right lands on $-\\tfrac18$, so $-\\tfrac34+\\tfrac58=-\\tfrac18$. Change the numbers and watch a negative $b$ step to the left instead.'
      },
      {
        title: 'The midpoint of $\\tfrac14$ and $\\tfrac23$',
        spec: { kind: 'numberLine', min: 0, max: 1, step: 0.25, points: [{ value: 1 / 4, label: '\\tfrac14' }, { value: 11 / 24, label: '\\tfrac{11}{24}' }, { value: 2 / 3, label: '\\tfrac23' }] },
        note: 'In twenty-fourths the ends are $\\tfrac{6}{24}$ and $\\tfrac{16}{24}$. Their average is $\\tfrac{11}{24}$, which sits $\\tfrac{5}{24}$ from each end. Repeat the halving and you never run out of numbers in between.'
      }
    ]
  },

  'c8-linear-equations': {
    objective: 'Solve a linear equation in one variable, including ones with brackets, fractions and the variable on both sides, check the answer by substituting it back, and set up such an equation from a word problem.',
    intuition: 'An equation is a balance: whatever you do to one side you must do to the other, and it stays level. Each step removes one layer around the variable until it stands alone. You can also see the two sides as two straight lines, such as $y=3x-5$ and $y=x+7$; the solution is the $x$ where they meet, here $x=6$. If the lines are parallel they never meet, and the equation has no solution.',
    check: [
      { question: 'Solve $7x-4=3x+16$.', answer: '$x=5$', verify: { kind: 'roots', f: '7*x-4-(3*x+16)', answers: ['5'] } },
      { question: 'Solve $3(2x-1)=4(x+2)$.', answer: '$x=\\tfrac{11}{2}$', verify: { kind: 'roots', f: '3*(2*x-1)-4*(x+2)', answers: ['11/2'] } },
      { question: 'Riya is three times as old as her brother Arjun. In $5$ years she will be twice as old as he will be then. How old is Arjun now?', answer: '$5$ years (Riya is $15$)', verify: { kind: 'roots', f: '3*x+5-2*(x+5)', answers: ['5'] } }
    ],
    diagrams: [
      {
        title: 'Where $y=ax+b$ meets $y=x+7$',
        spec: { kind: 'paramGraph', expr: 'a*x+b', params: [{ name: 'a', min: -2, max: 5, step: 1, initial: 3 }, { name: 'b', min: -10, max: 10, step: 1, initial: -5 }], xmin: -2, xmax: 10, ymin: -10, ymax: 20, fixed: [{ expr: 'x+7', label: 'y=x+7' }] },
        note: 'With $a=3$ and $b=-5$ the line $y=3x-5$ crosses $y=x+7$ at $(6,13)$, so $x=6$ solves $3x-5=x+7$. Set $a=1$: the two lines are parallel and the equation has no solution.'
      },
      {
        title: 'The solution of $\\tfrac{x}{2}-\\tfrac{x-1}{3}=2$',
        spec: { kind: 'function', xmin: -2, xmax: 12, ymin: -1, ymax: 4, curves: [{ expr: 'x/2-(x-1)/3', label: 'y=\\tfrac{x}{2}-\\tfrac{x-1}{3}' }, { expr: '2', tone: 'secondary', label: 'y=2' }], points: [{ x: 10, y: 2, label: '(10,\\,2)' }] },
        note: 'The left side simplifies to $\\tfrac{x+2}{6}$, a straight line. It reaches the height $2$ at $x=10$, the same answer the algebra gives.'
      }
    ]
  },

  'c8-quadrilaterals': {
    objective: 'Find unknown angles in polygons and quadrilaterals using the angle sum $(n-2)\\times180^\\circ$ and the exterior angle sum $360^\\circ$, and use the side, angle and diagonal properties of parallelograms, rhombuses, rectangles, squares, kites and trapeziums.',
    intuition: 'A diagonal cuts any quadrilateral into two triangles, and each triangle holds $180^\\circ$, so the four angles add to $360^\\circ$. A polygon with $n$ sides cuts into $n-2$ triangles in the same way. For the exterior angles, walk once round the boundary: at each corner you turn by the exterior angle, and after a full lap you have turned exactly once, $360^\\circ$, whatever the number of sides.',
    check: [
      { question: 'Find the sum of the interior angles of a hexagon.', answer: '$720^\\circ$', verify: { kind: 'value', expr: '(6-2)*180', answer: '720' } },
      { question: 'Each interior angle of a regular polygon is $156^\\circ$. How many sides does it have?', answer: '$15$ (each exterior angle is $24^\\circ$)', verify: { kind: 'values', pairs: [['180-156', '24'], ['360/24', '15']] } },
      { question: 'In parallelogram $ABCD$, $\\angle A$ is twice $\\angle B$. Find both angles.', answer: '$\\angle A=120^\\circ$, $\\angle B=60^\\circ$', verify: { kind: 'roots', f: '2*x+x-180', answers: ['60'] } }
    ],
    diagrams: [
      {
        title: 'A trapezium split by a diagonal',
        spec: {
          kind: 'plane', xmin: -1, xmax: 9, ymin: -1, ymax: 4, axes: false, grid: true,
          polygons: [{ points: [[0, 0], [8, 0], [5, 3], [0, 3]], shade: true }],
          segments: [{ from: [8, 0], to: [0, 3], dashed: true }],
          points: [{ x: 0, y: 0, label: 'A', pos: 'sw' }, { x: 8, y: 0, label: 'B', pos: 'se' }, { x: 5, y: 3, label: 'C', pos: 'ne' }, { x: 0, y: 3, label: 'D', pos: 'nw' }],
          angles: [{ at: [0, 0], from: [8, 0], to: [0, 3], right: true }, { at: [8, 0], from: [5, 3], to: [0, 0], label: 'auto' }, { at: [5, 3], from: [0, 3], to: [8, 0], label: 'auto' }, { at: [0, 3], from: [0, 0], to: [5, 3], right: true }]
        },
        note: 'The angles are $90^\\circ$ at $A$, $45^\\circ$ at $B$, $135^\\circ$ at $C$ and $90^\\circ$ at $D$, which add to $360^\\circ$. The dashed diagonal $BD$ makes two triangles of $180^\\circ$ each. The angles at $B$ and $C$ lie between the parallel sides, so they add to $180^\\circ$.'
      },
      {
        title: 'The angles of a triangle always add to $180^\\circ$',
        spec: { kind: 'triangleExplorer', mode: 'angleSum', initial: { A: 60, B: 70 } },
        note: 'Reshape the triangle and read the three angles: they change, but their total stays $180^\\circ$. Two such triangles make a quadrilateral, which is why its angles total $360^\\circ$.'
      },
      {
        title: 'A regular polygon with $9$ sides',
        spec: { kind: 'polygon', n: 9, side: 2 },
        note: 'Each exterior angle is $\\tfrac{360^\\circ}{9}=40^\\circ$, so each interior angle is $180^\\circ-40^\\circ=140^\\circ$, and the nine interior angles add to $7\\times180^\\circ=1260^\\circ$.'
      }
    ]
  },

  'c8-data-handling': {
    objective: 'Draw and read pie charts and bar graphs, find a sector angle from a count and a count from a sector angle, and find the probability of an event when all outcomes are equally likely.',
    intuition: 'A pie chart shares out the $360^\\circ$ of a full turn in the same proportion as the data, so a group that is a quarter of the total gets a quarter turn, $90^\\circ$. Probability is the same idea for chance: if $7$ of $12$ equally likely balls are not blue, a draw lands on not blue $7$ times in $12$ in the long run. A few trials can wander far from that fraction; many trials settle close to it.',
    check: [
      { question: 'In a class of $40$ students, $14$ chose kho-kho as their favourite game. Find the central angle for kho-kho in a pie chart.', answer: '$126^\\circ$', verify: { kind: 'value', expr: '14/40*360', answer: '126' } },
      { question: 'A fair die is thrown once. Find the probability of getting a prime number.', answer: '$\\tfrac12$ (the primes are $2$, $3$ and $5$)', verify: { kind: 'value', expr: '3/6', answer: '1/2' } },
      { question: 'In a survey of $250$ families, the sector for families who cook with induction is $72^\\circ$. How many families is that?', answer: '$50$ families', verify: { kind: 'value', expr: '72/360*250', answer: '50' } }
    ],
    diagrams: [
      {
        title: 'How $360$ students come to school',
        spec: { kind: 'pieChart', categories: ['Walk', 'Cycle', 'Bus'], values: [120, 90, 150] },
        note: 'Walkers are $\\tfrac{120}{360}$ of the school, so their sector is $120^\\circ$. Cyclists get $90^\\circ$ and bus riders $150^\\circ$, and the three angles add to $360^\\circ$.'
      },
      {
        title: 'Drawing from a bag of $4$ red, $5$ blue and $3$ green balls',
        spec: { kind: 'probabilitySim', experiment: 'bag', bag: [{ label: 'Red', weight: 4 }, { label: 'Blue', weight: 5 }, { label: 'Green', weight: 3 }], event: ['Red', 'Green'], seed: 8 },
        note: 'The probability of not blue is $\\tfrac{7}{12}\\approx0.58$. Add $10$ draws and the relative frequency can be far from it; add $1000$ and it settles close to $0.58$.'
      }
    ]
  },

  'c8-squares-roots': {
    objective: 'Recognise perfect squares from their last digits and prime factors, find square roots by prime factorisation and by long division, and find the nearest perfect square to a number.',
    intuition: 'A square number is the number of tiles in a square array. To grow an $n$ by $n$ square into an $(n+1)$ by $(n+1)$ square you add a strip along two sides plus one corner tile, which is $2n+1$ tiles, an odd number. So the squares are sums of odd numbers: $1$, $1+3=4$, $1+3+5=9$. In prime factors, a square is one set of factors written twice, so every prime appears an even number of times.',
    check: [
      { question: 'Find $\\sqrt{2304}$ by prime factorisation.', answer: '$48$ (since $2304=2^8\\times3^2$)', verify: { kind: 'values', pairs: [['2^8*3^2', '2304'], ['2^4*3', '48']] } },
      { question: 'Find the smallest number by which $180$ must be multiplied to give a perfect square, and the square root of the product.', answer: 'Multiply by $5$; $\\sqrt{900}=30$', verify: { kind: 'values', pairs: [['2^2*3^2*5', '180'], ['sqrt(180*5)', '30']] } },
      { question: 'Find $1+3+5+\\dots+23$ without adding term by term.', answer: '$144$ (it is the sum of the first $12$ odd numbers, $12^2$)', verify: { kind: 'values', pairs: [['(23+1)/2', '12'], ['12^2', '144']] } }
    ],
    diagrams: [
      {
        title: 'Adding odd numbers builds squares',
        spec: { kind: 'sequenceExplorer', type: 'arithmetic', first: 1, step: 2, n: 7 },
        note: 'The first $7$ odd numbers are $1, 3, 5, \\dots, 13$, and their sum is $49=7^2$. Change $n$ and the sum is always $n^2$.'
      },
      {
        title: '$45^2$ as the area of a square of side $40+5$',
        spec: { kind: 'areaModel', rows: [{ size: 40, label: '40' }, { size: 5, label: '5' }], cols: [{ size: 40, label: '40' }, { size: 5, label: '5' }], cells: [['1600', '200'], ['200', '25']] },
        note: 'The four parts are $1600$, $200$, $200$ and $25$, so $45^2=2025$. This is why $\\sqrt{2025}=45$.'
      }
    ]
  },

  'c8-cubes-roots': {
    objective: 'Decide whether a number is a perfect cube by grouping its prime factors in threes, find the smallest number to multiply or divide by to make a perfect cube, and find cube roots of integers and fractions, including negative ones.',
    intuition: 'A cube number is the number of unit blocks in a solid cube: $3$ along each edge gives $3\\times3\\times3=27$. Double the edge and the count grows eight times, because each of the three directions doubles. In prime factors a cube is one set of factors written three times, so every prime appears a multiple of three times. A negative number times itself three times stays negative, so $-8$ has the cube root $-2$.',
    check: [
      { question: 'Find $\\sqrt[3]{9261}$.', answer: '$21$ (since $9261=3^3\\times7^3$)', verify: { kind: 'values', pairs: [['3^3*7^3', '9261'], ['3*7', '21']] } },
      { question: 'Find the smallest number by which $3000$ must be divided to give a perfect cube, and the cube root of the quotient.', answer: 'Divide by $3$; $\\sqrt[3]{1000}=10$', verify: { kind: 'values', pairs: [['2^3*3*5^3', '3000'], ['10^3', '3000/3']] } },
      { question: 'Find $\\sqrt[3]{-\\tfrac{512}{125}}$.', answer: '$-\\tfrac85$', verify: { kind: 'value', expr: '(-8/5)^3', answer: '-512/125' } }
    ],
    diagrams: [
      {
        title: 'A cube of side $3$ made of unit blocks',
        spec: { kind: 'solidExplorer', shape: 'rectPrism', l: 3, w: 3, h: 3 },
        note: 'With every edge $3$ the volume is $27$, a perfect cube. Make every edge $4$ and it is $64$; make every edge $6$ and it is $216$, eight times $27$. Change only one edge and the box is no longer a cube.'
      },
      {
        title: 'The graph of $y=x^3$',
        spec: { kind: 'function', xmin: -4, xmax: 4, ymin: -30, ymax: 30, curves: [{ expr: 'x^3', label: 'y=x^3' }], points: [{ x: 2, y: 8, label: '(2,\\,8)' }, { x: 3, y: 27, label: '(3,\\,27)' }, { x: -2, y: -8, label: '(-2,\\,-8)' }, { x: -3, y: -27, label: '(-3,\\,-27)' }] },
        note: 'The cube of $-3$ is $-27$ and the cube of $3$ is $27$: the sign is kept. Read the graph backwards and each height has exactly one cube root, so $\\sqrt[3]{-27}=-3$.'
      }
    ]
  },

  'c8-comparing-quantities': {
    objective: 'Calculate percentage increase and decrease, discounts, profit and loss and GST, and find the amount and compound interest on a sum for whole years, compounded yearly or half-yearly.',
    intuition: 'A percentage change is a multiplication: a $10\\%$ rise multiplies by $1.1$ and a $15\\%$ discount multiplies by $0.85$. Compound interest repeats the rise, and each year the $10\\%$ is taken of a bigger amount, because last year\'s interest has joined the principal. So ₹$5000$ becomes ₹$5500$ and then ₹$6050$, not ₹$6000$. The gap from simple interest is small at first and grows every year.',
    check: [
      { question: 'A school bag marked ₹$1500$ is sold at a $12\\%$ discount. What is the selling price?', answer: '₹$1320$', verify: { kind: 'value', expr: '1500*(1-12/100)', answer: '1320' } },
      { question: 'Find the compound interest on ₹$8000$ for $2$ years at $5\\%$ per year, compounded annually.', answer: '₹$820$ (the amount is ₹$8820$)', verify: { kind: 'values', pairs: [['8000*(1+5/100)^2', '8820'], ['8820-8000', '820']] } },
      { question: 'A scooter bought for ₹$60000$ loses $10\\%$ of its value each year. What is it worth after $2$ years?', answer: '₹$48600$', verify: { kind: 'value', expr: '60000*(1-10/100)^2', answer: '48600' } }
    ],
    diagrams: [
      {
        title: 'Compound interest on ₹$5000$',
        spec: { kind: 'compoundExplorer', principal: 5000, initialRate: 10, initialYears: 2 },
        note: 'At $10\\%$ for $2$ years the amount is ₹$6050$, so the interest is ₹$1050$, while simple interest gives ₹$1000$. Raise the time to $10$ years and the gap widens, or switch to half-yearly to see the effect of compounding more often.'
      },
      {
        title: 'Ten years at $10\\%$: compound against simple',
        spec: { kind: 'compound', principal: 5000, rate: 0.1, years: 10 },
        note: 'Simple interest (dashed) grows by the same ₹$500$ each year and reaches ₹$10000$. Compound interest curves upward and reaches about ₹$12968.71$, because every year\'s interest earns interest too.'
      }
    ]
  },

  'c8-algebraic-identities': {
    objective: 'Add, subtract and multiply algebraic expressions, and use the identities for $(a+b)^2$, $(a-b)^2$, $(a+b)(a-b)$ and $(x+a)(x+b)$ to expand products and to calculate quickly with numbers.',
    intuition: 'Multiplying two brackets is finding the area of a rectangle whose sides are split into parts: every part of one side meets every part of the other. A square of side $a+b$ splits into a square $a^2$, a square $b^2$ and two rectangles $ab$, so $(a+b)^2=a^2+2ab+b^2$, never just $a^2+b^2$. An identity is true for every value of the letters, which is why it can turn $103^2$ into $(100+3)^2$.',
    check: [
      { question: 'Expand $(3a+4b)^2$.', answer: '$9a^2+24ab+16b^2$', verify: { kind: 'equivalent', a: '(3*a+4*b)^2', b: '9*a^2+24*a*b+16*b^2' } },
      { question: 'Use an identity to find $98\\times102$.', answer: '$9996$ (it is $100^2-2^2$)', verify: { kind: 'values', pairs: [['98*102', '9996'], ['100^2-2^2', '9996']] } },
      { question: 'Simplify $(2x+5)(2x-5)-(2x-1)^2$.', answer: '$4x-26$', verify: { kind: 'equivalent', a: '(2*x+5)*(2*x-5)-(2*x-1)^2', b: '4*x-26' } }
    ],
    diagrams: [
      {
        title: '$(a+b)^2$ as the area of a square',
        spec: { kind: 'areaModel', rows: [{ size: 3, label: 'a' }, { size: 1, label: 'b' }], cols: [{ size: 3, label: 'a' }, { size: 1, label: 'b' }], cells: [['a^2', 'ab'], ['ab', 'b^2']] },
        note: 'The big square has side $a+b$. It is made of $a^2$, $b^2$ and two rectangles of area $ab$, so $(a+b)^2=a^2+2ab+b^2$. The two $ab$ pieces are the ones forgotten when someone writes $a^2+b^2$.'
      },
      {
        title: '$(x+a)^2-(x-a)^2$ against $y=8x$',
        spec: { kind: 'paramGraph', expr: '(x+a)^2-(x-a)^2', params: [{ name: 'a', min: 0, max: 4, step: 0.5, initial: 2 }], xmin: -2, xmax: 8, ymin: -20, ymax: 70, fixed: [{ expr: '8*x', label: 'y=8x' }] },
        note: 'With $a=2$ the curve lies exactly on $y=8x$ for every $x$: that is what an identity means. At $x=7$ both give $56$. Move $a$ and the graph stays a straight line through the origin, $y=4ax$.'
      }
    ]
  },

  'c8-mensuration': {
    objective: 'Find the area of a trapezium, a rhombus and a general quadrilateral, and the surface area and volume of a cuboid, a cube and a cylinder, converting between cubic units and litres.',
    intuition: 'A trapezium is a rectangle whose top and bottom disagree, so its area uses their average: $\\tfrac12(a+b)$ times the height. Surface area is the paper needed to wrap a solid, the sum of the areas of its faces. Volume is how many unit cubes fill it: one layer covers the base, and the height says how many layers. A cylinder works the same way with a circular base, so its volume is $\\pi r^2h$.',
    check: [
      { question: 'A rhombus has diagonals $16$ cm and $12$ cm. Find its area.', answer: '$96\\text{ cm}^2$', verify: { kind: 'value', expr: '16*12/2', answer: '96' } },
      { question: 'A cube has edge $5$ cm. Find its total surface area and its volume.', answer: '$150\\text{ cm}^2$; $125\\text{ cm}^3$', verify: { kind: 'values', pairs: [['6*5^2', '150'], ['5^3', '125']] } },
      { question: 'A cylindrical steel tumbler has radius $7$ cm and height $10$ cm. Using $\\pi=\\tfrac{22}{7}$, find its capacity in litres.', answer: '$1540\\text{ cm}^3$, which is $1.54$ litres', verify: { kind: 'values', pairs: [['22/7*7^2*10', '1540'], ['1540/1000', '1.54']] } }
    ],
    diagrams: [
      {
        title: 'A trapezium with parallel sides $12$ and $8$',
        spec: {
          kind: 'plane', xmin: -1, xmax: 13, ymin: -1, ymax: 6, axes: false, grid: true,
          polygons: [{ points: [[0, 0], [12, 0], [10, 5], [2, 5]], shade: true }],
          segments: [{ from: [0, 0], to: [12, 0], label: '12' }, { from: [2, 5], to: [10, 5], label: '8' }, { from: [2, 5], to: [2, 0], label: '5', dashed: true }],
          angles: [{ at: [2, 0], from: [12, 0], to: [2, 5], right: true }]
        },
        note: 'The parallel sides average $\\tfrac12(12+8)=10$, and the height is $5$, so the area is $10\\times5=50$ square units, as in the worked example.'
      },
      {
        title: 'A cuboid $5$ by $4$ by $6$',
        spec: { kind: 'solidExplorer', shape: 'rectPrism', l: 5, w: 4, h: 6 },
        note: 'The volume is $5\\times4\\times6=120$ cubic units and the total surface area is $2(20+24+30)=148$ square units. Double the height to $12$: the volume doubles to $240$, but the surface area becomes $256$, not double.'
      },
      {
        title: 'A cylindrical tank of radius $0.7$ m and height $2$ m',
        spec: { kind: 'solid', shape: 'cylinder', r: 0.7, h: 2 },
        note: 'With $\\pi=\\tfrac{22}{7}$ the volume is $\\tfrac{22}{7}\\times0.7^2\\times2=3.08\\text{ m}^3$. One cubic metre holds $1000$ litres, so the tank holds $3080$ litres.'
      }
    ]
  },

  'c8-exponents': {
    objective: 'Use the laws of exponents with integer powers, including zero and negative exponents, to simplify expressions, and write very large and very small numbers in standard form.',
    intuition: 'Going down the powers of $2$, each step divides by $2$: $8$, $4$, $2$, $1$, then $\\tfrac12$, $\\tfrac14$. Keep the pattern and the exponents go $3$, $2$, $1$, $0$, $-1$, $-2$, so $2^0=1$ and $2^{-2}=\\tfrac{1}{4}$. Nothing new is invented: a negative exponent counts divisions instead of multiplications. Standard form uses the same idea with $10$, so $0.000056$ is $5.6$ divided by $10$ five times, $5.6\\times10^{-5}$.',
    check: [
      { question: 'Find the value of $(-3)^{-2}$.', answer: '$\\tfrac19$', verify: { kind: 'value', expr: '(-3)^(-2)', answer: '1/9' } },
      { question: 'Simplify $\\dfrac{2^5\\times2^{-3}}{2^{-1}}$.', answer: '$2^3=8$', verify: { kind: 'value', expr: '2^5*2^(-3)/2^(-1)', answer: '8' } },
      { question: 'A red blood cell is about $0.000007$ m across. Write this in standard form.', answer: '$7\\times10^{-6}$ m', verify: { kind: 'value', expr: '7*10^(-6)', answer: '0.000007' } }
    ],
    diagrams: [
      {
        title: 'Halving down the powers of $2$',
        spec: { kind: 'sequence', type: 'geometric', first: 8, step: 0.5, n: 6 },
        note: 'The terms are $2^3=8$, $2^2=4$, $2^1=2$, $2^0=1$, $2^{-1}=\\tfrac12$ and $2^{-2}=\\tfrac14$. Each bar is half the one before, and the pattern carries straight on past $1$.'
      },
      {
        title: 'The graph of $y=a^x$',
        spec: { kind: 'paramGraph', expr: 'a^x', params: [{ name: 'a', min: 0.5, max: 4, step: 0.5, initial: 2 }], xmin: -4, xmax: 4, ymin: -1, ymax: 10, show: ['yIntercept'] },
        note: 'With $a=2$ the curve passes through $(3,8)$ and $\\left(-2,\\tfrac14\\right)$. For every base the curve crosses the $y$-axis at $1$, because $a^0=1$.'
      }
    ]
  },

  'c8-proportions': {
    objective: 'Decide whether two quantities are in direct proportion, inverse proportion or neither, and use a constant ratio or a constant product to find a missing value.',
    intuition: 'In direct proportion the ratio stays fixed: at ₹$30$ a notebook, twice as many notebooks cost twice as much, and the graph is a straight line through the origin. In inverse proportion the product stays fixed: a job needing $48$ worker-days takes $8$ days for $6$ workers and $4$ days for $12$. The first question is always what stays the same.',
    check: [
      { question: '$5$ kg of rice costs ₹$240$. What do $8$ kg cost at the same rate?', answer: '₹$384$', verify: { kind: 'value', expr: '240/5*8', answer: '384' } },
      { question: 'A car at $60$ km/h takes $4$ hours to drive from one town to another. How long does the same drive take at $80$ km/h?', answer: '$3$ hours', verify: { kind: 'value', expr: '60*4/80', answer: '3' } },
      { question: 'A hostel mess has food for $120$ students for $20$ days. If $30$ more students join, how long will the food last?', answer: '$16$ days', verify: { kind: 'value', expr: '120*20/(120+30)', answer: '16' } }
    ],
    diagrams: [
      {
        title: 'The cost of notebooks at ₹$30$ each',
        spec: { kind: 'function', xmin: 0, xmax: 24, ymin: 0, ymax: 800, curves: [{ expr: '30*x', label: 'y=30x' }], points: [{ x: 12, y: 360, label: '(12,\\,360)' }, { x: 20, y: 600, label: '(20,\\,600)' }] },
        note: 'Every point has $\\tfrac{y}{x}=30$: $12$ notebooks cost ₹$360$ and $20$ cost ₹$600$. A straight line through the origin is the picture of direct proportion.'
      },
      {
        title: 'Inverse proportion $y=\\tfrac{k}{x}$',
        spec: { kind: 'paramGraph', expr: 'k/x', params: [{ name: 'k', min: 12, max: 96, step: 12, initial: 48 }], xmin: -2, xmax: 16, ymin: -2, ymax: 30 },
        note: 'With $k=48$ the curve passes through $(6,8)$ and $(12,4)$: twice the workers, half the days. The product $xy$ stays $48$ all along the curve, and the curve never reaches either axis.'
      }
    ]
  },

  'c8-factorisation': {
    objective: 'Factorise expressions by taking out common factors, regrouping, using the standard identities and splitting the middle term, and divide one algebraic expression by another by factorising first.',
    intuition: 'Factorising runs multiplication backwards: given the area of a rectangle, find its two sides. For $x^2+7x+12$ you need two numbers whose product is $12$ and whose sum is $7$, which are $3$ and $4$, so the sides are $x+3$ and $x+4$. The graph tells the same story: $y=x^2-9x+20$ crosses the $x$-axis at $4$ and $5$, and its factors are $(x-4)(x-5)$.',
    check: [
      { question: 'Factorise $12x^2y-18xy^2$.', answer: '$6xy(2x-3y)$', verify: { kind: 'equivalent', a: '12*x^2*y-18*x*y^2', b: '6*x*y*(2*x-3*y)' } },
      { question: 'Factorise $x^2-x-42$.', answer: '$(x-7)(x+6)$', verify: { kind: 'equivalent', a: 'x^2-x-42', b: '(x-7)*(x+6)' } },
      { question: 'Factorise $4p^2-12p+9$.', answer: '$(2p-3)^2$', verify: { kind: 'equivalent', a: '4*p^2-12*p+9', b: '(2*p-3)^2' } }
    ],
    diagrams: [
      {
        title: '$x^2+7x+12$ as a rectangle',
        spec: { kind: 'areaModel', rows: [{ size: 5, label: 'x' }, { size: 3, label: '3' }], cols: [{ size: 5, label: 'x' }, { size: 4, label: '4' }], cells: [['x^2', '4x'], ['3x', '12']] },
        note: 'The four pieces $x^2$, $4x$, $3x$ and $12$ add to $x^2+7x+12$. The rectangle has sides $x+3$ and $x+4$, so $x^2+7x+12=(x+3)(x+4)$.'
      },
      {
        title: 'The zeros of $y=x^2+bx+c$',
        spec: { kind: 'paramGraph', expr: 'x^2+b*x+c', params: [{ name: 'b', min: -10, max: 10, step: 1, initial: -9 }, { name: 'c', min: -10, max: 25, step: 1, initial: 20 }], xmin: -2, xmax: 10, ymin: -6, ymax: 24, show: ['roots', 'yIntercept'] },
        note: 'With $b=-9$ and $c=20$ the curve crosses the $x$-axis at $4$ and $5$, so $x^2-9x+20=(x-4)(x-5)$. Set $c=18$: the crossings move to $3$ and $6$, and the factors become $(x-3)(x-6)$.'
      }
    ]
  },

  'c8-graphs': {
    objective: 'Plot points from coordinates, draw a linear graph from a table of values, and read a line graph such as a distance–time graph to find values, rates of change and periods of rest.',
    intuition: 'A graph is a table drawn as a picture: each pair of values becomes one point. When one quantity changes at a steady rate, the points line up in a straight line, and the steepness of the line is that rate. On a distance–time graph a steep part means fast, a gentle part means slow, and a flat part means the traveller has stopped.',
    check: [
      { question: 'An auto-rickshaw charges ₹$50$ plus ₹$12$ for each kilometre. Find the fare for an $8$ km ride.', answer: '₹$146$', verify: { kind: 'value', expr: '12*8+50', answer: '146' } },
      { question: 'Does the point $(3,11)$ lie on the line $y=2x+5$?', answer: 'Yes: when $x=3$, $y=2\\times3+5=11$.', verify: { kind: 'value', expr: '2*3+5', answer: '11' } },
      { question: 'A distance–time graph is a straight line from $(0,0)$ to $(4\\text{ h}, 60\\text{ km})$. Find the speed and the distance covered after $2.5$ hours.', answer: '$15$ km/h; $37.5$ km', verify: { kind: 'values', pairs: [['60/4', '15'], ['15*2.5', '37.5']] } }
    ],
    diagrams: [
      {
        title: 'A cyclist\'s distance–time graph',
        spec: {
          kind: 'plane', xmin: -0.5, xmax: 5, ymin: -5, ymax: 60, axes: true, grid: true, equal: false,
          segments: [{ from: [0, 0], to: [2, 30] }, { from: [2, 30], to: [3, 30] }, { from: [3, 30], to: [4, 50] }],
          points: [{ x: 2, y: 30, label: '(2,\\,30)', pos: 'nw' }, { x: 3, y: 30, label: '(3,\\,30)', pos: 'se' }, { x: 4, y: 50, label: '(4,\\,50)', pos: 'nw' }]
        },
        note: 'Time in hours runs across and distance in km runs up. From $0$ to $2$ h the cyclist covers $30$ km at $15$ km/h. From $2$ h to $3$ h the line is flat: a rest. From $3$ h to $4$ h the line is steeper, $20$ km in an hour, so $20$ km/h.'
      },
      {
        title: 'The line $y=mx+c$',
        spec: { kind: 'paramGraph', expr: 'm*x+c', params: [{ name: 'm', min: -3, max: 4, step: 0.5, initial: 2 }, { name: 'c', min: -5, max: 8, step: 1, initial: 3 }], xmin: -2, xmax: 8, ymin: -4, ymax: 20, show: ['yIntercept'] },
        note: 'With $m=2$ and $c=3$ the line passes through $(2,7)$ and $(6,15)$: $x$ goes up by $4$ while $y$ goes up by $8$, a rate of $2$. Change $c$ and the line slides up or down; change $m$ and it tilts.'
      }
    ]
  }
};
