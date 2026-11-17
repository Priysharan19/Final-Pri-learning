// Pri Learning · NSW Notes · Experience 3 layer (stage5-core), see notes/e3.js. Original writing, en-AU.
// Every number in a note or a spec below was computed, not recalled; the specs use the chapter's own numbers.
export default {
  'ma5-alg-c-01': {
    objective: 'Expand a product of two binomials and factorise a quadratic expression by a common factor, a difference of two squares or a pair of numbers with the right product and sum.',
    intuition: 'A product such as $(x+3)(x+2)$ is the area of a rectangle with sides $x+3$ and $x+2$. Cut the rectangle into four pieces and the expanded form is just the four areas added up: $x^2+2x+3x+6$. Factorising runs the picture backwards: given the pieces, find the two side lengths. On a graph, a factor $x-3$ is zero exactly when $x=3$, so the factors tell you where the curve meets the $x$-axis.',
    diagrams: [
      {
        title: 'Expanding $(x+3)(x+2)$ as an area',
        spec: { kind: 'areaModel', rows: [{ size: 5, label: 'x' }, { size: 3, label: '3' }], cols: [{ size: 5, label: 'x' }, { size: 2, label: '2' }], cells: [['x^2', '2x'], ['3x', '6']] },
        note: 'The four pieces are $x^2$, $3x$, $2x$ and $6$. The two middle pieces are like terms, so $(x+3)(x+2)=x^2+5x+6$: the $5$ is $3+2$ and the $6$ is $3\\times2$.'
      },
      {
        title: 'Move the factors, watch the crossings',
        spec: { kind: 'paramGraph', expr: '(x-p)*(x-q)', params: [{ name: 'p', min: -3, max: 5, step: 1, initial: 3 }, { name: 'q', min: -3, max: 5, step: 1, initial: 4 }], xmin: -4, xmax: 6, ymin: -17, ymax: 20, show: ['roots', 'yIntercept'] },
        note: 'With $p=3$ and $q=4$ the curve is $y=(x-3)(x-4)=x^2-7x+12$ and it crosses the $x$-axis at $3$ and $4$. Each slider moves one crossing. The $y$-intercept is always $p\\times q$, the constant term of the expansion.'
      }
    ]
  },

  'ma5-are-c-01': {
    objective: 'Find the area and arc length of a sector, the area of a composite figure and the surface area of a prism or cylinder from its net.',
    intuition: 'A sector is a slice of a circle, so it gets the same fraction of everything the circle has: a $72^\\circ$ sector is $\\tfrac{72}{360}=\\tfrac15$ of the circle, so it has a fifth of the area and a fifth of the circumference. Surface area is easiest to see by unfolding the solid flat. A cylinder unrolls into two circles and a rectangle, and the rectangle is as long as the circle is round.',
    diagrams: [
      {
        title: 'A sector of radius $10$ and angle $72^\\circ$',
        spec: {
          kind: 'plane', xmin: -2, xmax: 12, ymin: -2, ymax: 12, axes: false, grid: false,
          points: [{ x: 0, y: 0, label: 'O', pos: 'sw' }],
          segments: [{ from: [0, 0], to: [10, 0], label: '10' }, { from: [0, 0], to: [3.0902, 9.5106], label: '10' }],
          arcs: [{ cx: 0, cy: 0, r: 10, from: 0, to: 72 }],
          angles: [{ at: [0, 0], from: [10, 0], to: [3.0902, 9.5106], label: 'auto' }]
        },
        note: 'The angle at the centre is $72^\\circ$, one fifth of a full turn. So the area is $\\tfrac15\\times\\pi\\times10^2=20\\pi\\approx62.8\\text{ cm}^2$ and the curved edge is $\\tfrac15\\times20\\pi=4\\pi\\approx12.6\\text{ cm}$.'
      },
      {
        title: 'The net of a cylinder of radius $3$ and height $8$',
        spec: {
          kind: 'plane', xmin: -2, xmax: 21, ymin: -7, ymax: 15, axes: false, grid: false,
          polygons: [{ points: [[0, 0], [18.85, 0], [18.85, 8], [0, 8]], label: '\\text{curved surface}', shade: true }],
          segments: [{ from: [0, 0], to: [0, 8], label: '8' }, { from: [0, 0], to: [18.85, 0], label: '2\\pi\\times3=6\\pi' }],
          circles: [{ cx: 3, cy: 11, r: 3, label: 'r=3' }, { cx: 15.85, cy: -3, r: 3, label: 'r=3' }]
        },
        note: 'The rectangle is $6\\pi$ long, the distance around the circle, and $8$ high, so its area is $48\\pi$. The two circles add $9\\pi$ each, so the surface area is $48\\pi+18\\pi=66\\pi\\approx207.3\\text{ cm}^2$.'
      },
      {
        title: 'Change the cylinder, watch the surface area',
        spec: { kind: 'solidExplorer', shape: 'cylinder', dims: { r: 3, h: 8 } },
        note: 'At $r=3$ and $h=8$ the surface area is $2\\pi\\times3^2+2\\pi\\times3\\times8=66\\pi\\approx207.3$. Double the height and only the curved part doubles; double the radius and the two circles grow four times.'
      }
    ]
  },

  'ma5-dat-c-01': {
    objective: 'Find the mean, median and mode of data given in a frequency table, estimate the mean of grouped data from class centres, and read the modal class from a histogram.',
    intuition: 'A frequency table is a shorthand list: a score of $4$ with frequency $8$ is eight $4$s written once. So the mean still means total divided by count, and $\\sum fx$ is the total of the whole list. With grouped data the actual values have been thrown away, so each class is replaced by its centre, and the mean becomes an estimate.',
    diagrams: [
      {
        title: 'The frequency table as a column graph',
        spec: { kind: 'barChart', categories: ['2', '3', '4', '5'], values: [3, 5, 8, 4], yLabel: 'Frequency' },
        note: 'There are $3+5+8+4=20$ scores with total $2\\times3+3\\times5+4\\times8+5\\times4=73$, so the mean is $\\tfrac{73}{20}=3.65$. The $10$th and $11$th scores are both $4$, so the median is $4$, and the tallest column makes $4$ the mode as well.'
      },
      {
        title: 'One new mark and the mean',
        spec: { kind: 'dataExplorer', data: [65, 70, 72, 75, 78, 90], editable: [5], show: ['mean', 'median'] },
        note: 'The first five marks total $360$, a mean of $72$. With a sixth mark of $90$ the total is $450$ and the mean is $\\tfrac{450}{6}=75$. Move the sixth mark: every extra mark adds $\\tfrac16$ of a mark to the mean, while the median, $73.5$, barely moves.'
      }
    ]
  },

  'ma5-dat-c-02': {
    objective: 'Find the five-number summary and interquartile range of a data set, draw its box plot, test for outliers, and compare two data sets by centre and spread.',
    intuition: 'The median and the quartiles are positions in the ordered list, not sums, so one extreme value cannot drag them far: a giant last value is still just the last value. The mean adds every value in, so an outlier pulls it straight towards itself. That is why the median and the interquartile range are the honest summary when a data set has an outlier.',
    diagrams: [
      {
        title: 'Drag the outlier',
        spec: { kind: 'dataExplorer', data: [12, 14, 15, 15, 16, 18, 19, 38], editable: [7], show: ['mean', 'median', 'iqr'] },
        note: 'With $38$ in the set the mean is $18.375$ but the median is $15.5$ and the interquartile range is $18.5-14.5=4$. Drag $38$ down to $19$: the mean falls a long way while the median and the interquartile range stay where they are.'
      }
    ]
  },

  'ma5-equ-c-01': {
    objective: 'Solve linear equations with brackets, unknowns on both sides or algebraic fractions, solve a linear inequality, and show the solution of an inequality on a number line.',
    intuition: 'An equation is a balance: as long as you do the same thing to both sides it stays level, so you can strip away the operations around $x$ one at a time. An inequality is a balance that is tipped, and most moves keep it tipped the same way. Multiplying by a negative number is different because it reflects every number through $0$, so the larger number becomes the smaller one and the sign has to turn round.',
    diagrams: [
      {
        title: 'The solution of $5-2x>11$',
        spec: { kind: 'numberLine', min: -8, max: 2, step: 1, points: [{ value: -3, open: true, label: '-3' }], intervals: [{ from: null, to: -3, toOpen: true }] },
        note: 'Every number to the left of $-3$ works and $-3$ itself does not, so the circle at $-3$ is open. Check one value: $x=-4$ gives $5-2\\times(-4)=13$, which is greater than $11$.'
      },
      {
        title: 'Multiplying by a negative number flips the order',
        spec: { kind: 'numberLineStepper', op: 'multiply', a: 3, b: -2, min: -8, max: 8, step: 1 },
        note: 'Here $3\\times(-2)$ lands at $-6$, on the far side of $0$. Now try $2\\times(-2)=-4$. Since $2<3$ but $-4>-6$, multiplying both sides by a negative number reverses their order, which is why $-2x>6$ becomes $x<-3$.'
      }
    ]
  },

  'ma5-fin-c-01': {
    objective: 'Calculate wages with overtime and commission, add or remove GST, and apply a chain of percentage increases and decreases using multipliers.',
    intuition: 'Every percentage change is a multiplication. Adding $10\\%$ GST multiplies by $1.1$, so undoing it means dividing by $1.1$; taking $10\\%$ off the new price removes too much, because that $10\\%$ is of a larger amount. Two changes in a row multiply their multipliers, which is why a $40\\%$ markup and then a $40\\%$ discount leave you below where you started.',
    diagrams: [
      {
        title: 'Mia’s pay in two parts',
        spec: { kind: 'barChart', categories: ['Normal hours', 'Overtime'], values: [1064, 252], yLabel: 'Pay (dollars)' },
        note: 'The $38$ normal hours earn $38\\times\\$28=\\$1064$. The $6$ overtime hours earn $6\\times1.5\\times\\$28=\\$252$. Together that is $\\$1316$.'
      },
      {
        title: 'A markup then a discount',
        spec: {
          kind: 'paramGraph', expr: 'x*(1+m/100)*(1-d/100)',
          params: [{ name: 'm', min: 0, max: 60, step: 5, initial: 40, label: 'markup (\\%)' }, { name: 'd', min: 0, max: 50, step: 5, initial: 15, label: 'discount (\\%)' }],
          xmin: 0, xmax: 300, ymin: 0, ymax: 500, fixed: [{ expr: 'x', label: 'y=x' }]
        },
        note: 'With a $40\\%$ markup and a $15\\%$ discount the line is $y=1.19x$: a $\\$240$ jacket sells for $\\$285.60$, a profit of $19\\%$. Set both sliders to $40$ and the line drops below $y=x$, because $1.4\\times0.6=0.84$.'
      }
    ]
  },

  'ma5-fin-c-02': {
    objective: 'Calculate simple interest, compound interest and declining-balance depreciation, and explain why compound growth overtakes simple interest.',
    intuition: 'Simple interest pays on the original amount, so the balance climbs by the same number of dollars every year and draws a straight line. Compound interest pays on the balance as it stands, so each year’s interest is a little bigger than the last and the graph curves upwards. Depreciation is the same process run downwards: a fixed percentage of a shrinking value is a shrinking amount, so the value falls ever more slowly and never reaches zero.',
    diagrams: [
      {
        title: 'Rate, time and the gap over simple interest',
        spec: { kind: 'compoundExplorer', principal: 8000, initialRate: 5, initialYears: 3 },
        note: 'At $5\\%$ for $3$ years, $\\$8000$ compounds to $\\$9261$ against $\\$9200$ with simple interest, a gap of only $\\$61$. Push the years further and watch the gap widen each year.'
      },
      {
        title: 'A car losing $15\\%$ a year',
        spec: { kind: 'function', xmin: 0, xmax: 10, ymin: 0, ymax: 32000, curves: [{ expr: '30000*0.85^x', label: 'V=30\\,000\\times0.85^n' }], points: [{ x: 0, y: 30000, label: '(0,\\ 30\\,000)' }, { x: 3, y: 18423.75, label: '(3,\\ 18\\,423.75)' }] },
        note: 'After $3$ years the car is worth $30\\,000\\times0.85^3=\\$18\\,423.75$. The first year takes $\\$4500$ but later years take less, and after $10$ years it is still worth about $\\$5906$.'
      }
    ]
  },

  'ma5-geo-c-01': {
    objective: 'Decide whether two triangles are congruent or similar and give the test, find unknown sides from a scale factor, and find the interior and exterior angle sums of a polygon.',
    intuition: 'Similar triangles are the same shape at a different size, like a photo and its enlargement. Every length is multiplied by the same scale factor $k$, so ratios of sides inside one triangle do not change, and that is why a shadow can measure a tree. Area is length times length, so it is multiplied by $k$ twice: a scale factor of $2$ makes four copies of the area, not two.',
    diagrams: [
      {
        title: 'Scale a triangle, compare the areas',
        spec: { kind: 'triangleExplorer', mode: 'similar', initial: { a: 6, b: 8, c: 10, k: 1.5 } },
        note: 'At $k=1.5$ the $6,8,10$ triangle becomes $9,12,15$ and its area goes from $24$ to $54$, which is $1.5^2=2.25$ times as much. Set $k=2$: the sides double and the area is multiplied by $4$.'
      }
    ]
  },

  'ma5-ind-c-01': {
    objective: 'Simplify expressions with the index laws, including zero and negative indices, and calculate with numbers in scientific notation.',
    intuition: 'Going down a list of powers of $3$, each step divides by $3$. Keep dividing past $3^1=3$ and the next term is $1$, then $\\tfrac13$, then $\\tfrac19$, so $3^0=1$ and $3^{-1}=\\tfrac13$ are the only values that keep the pattern. A negative index means divide, not make negative. The index laws are counting: $a^3\\times a^2$ is five $a$s multiplied together.',
    diagrams: [
      {
        title: 'Every base passes through $(0,1)$',
        spec: { kind: 'paramGraph', expr: 'b^x', params: [{ name: 'b', min: 0.5, max: 3, step: 0.5, initial: 3 }], xmin: -3, xmax: 3, ymin: -1, ymax: 28, show: ['yIntercept'] },
        note: 'For $y=3^x$ the curve passes through $(0,1)$, at $x=3$ it reaches $27$ and at $x=-1$ it is $\\tfrac13$, above the axis. Change the base: the curve always crosses at $(0,1)$, because any non-zero base to the power $0$ is $1$.'
      }
    ]
  },

  'ma5-lin-c-01': {
    objective: 'Find the gradient of a line from two points or its graph, and find the distance between and midpoint of two points on the number plane.',
    intuition: 'Gradient is how much the line goes up for every one step to the right, so it is the rise divided by the run between any two points on it. The run and the rise are the two shorter sides of a right-angled triangle drawn under the segment, and the segment itself is the hypotenuse, so the distance formula is Pythagoras’ theorem. The midpoint is halfway along each direction separately, which is an average.',
    diagrams: [
      {
        title: 'Distance as a hypotenuse',
        spec: {
          kind: 'plane', xmin: -3, xmax: 7, ymin: -1, ymax: 17,
          points: [{ x: -1, y: 3, label: '(-1,3)', pos: 'w' }, { x: 4, y: 15, label: '(4,15)', pos: 'ne' }, { x: 4, y: 3, pos: 'se' }],
          segments: [{ from: [-1, 3], to: [4, 3], label: '5' }, { from: [4, 3], to: [4, 15], label: '12' }, { from: [-1, 3], to: [4, 15], label: '13' }],
          angles: [{ at: [4, 3], from: [-1, 3], to: [4, 15], right: true }]
        },
        note: 'The run from $x=-1$ to $x=4$ is $5$ and the rise from $y=3$ to $y=15$ is $12$. The distance is $\\sqrt{5^2+12^2}=\\sqrt{169}=13$, and the gradient is $\\tfrac{12}{5}$.'
      },
      {
        title: 'Turn a line about the point $(1,2)$',
        spec: { kind: 'paramGraph', expr: 'm*(x-1)+2', params: [{ name: 'm', min: -3, max: 3, step: 0.5, initial: 2 }], xmin: -1, xmax: 7, ymin: -2, ymax: 12, show: ['yIntercept'] },
        note: 'At $m=2$ the line rises $2$ for every $1$ across and passes through $(5,10)$, as in the worked example. Make $m$ negative and the line falls to the right; at $m=0$ it is horizontal.'
      }
    ]
  },

  'ma5-lin-c-02': {
    objective: 'Write the equation of a line from its gradient and a point, decide whether two lines are parallel or perpendicular, and solve a pair of linear equations by algebra and by graph.',
    intuition: 'The equation $y=mx+b$ is a recipe: start at height $b$ on the $y$-axis and climb $m$ for every step across. Two lines with the same $m$ climb at the same rate and never meet. Turning a line through a right angle swaps its rise and run and changes one sign, so the new gradient is the negative reciprocal. Where two lines cross, one point is on both, so it satisfies both equations at once.',
    diagrams: [
      {
        title: 'Steer a line against $y=2x+1$',
        spec: { kind: 'paramGraph', expr: 'm*x+b', params: [{ name: 'm', min: -3, max: 3, step: 0.5, initial: -0.5 }, { name: 'b', min: -3, max: 6, step: 1, initial: 3 }], xmin: -2, xmax: 8, ymin: -4, ymax: 12, show: ['yIntercept'], fixed: [{ expr: '2*x+1', label: 'y=2x+1' }] },
        note: 'With $m=-\\tfrac12$ and $b=3$ the line is perpendicular to $y=2x+1$, because $2\\times\\left(-\\tfrac12\\right)=-1$. Set $m=2$ and the two lines run parallel for every value of $b$.'
      },
      {
        title: 'The perpendicular through $(4,1)$',
        spec: {
          kind: 'plane', xmin: -2, xmax: 7, ymin: -2, ymax: 8,
          lines: [{ through: [[0, 1], [2, 5]], label: 'y=2x+1' }, { through: [[0, 3], [4, 1]], label: 'y=-\\tfrac12x+3' }],
          points: [{ x: 4, y: 1, label: '(4,1)', pos: 'se' }, { x: 0.8, y: 2.6, label: '(0.8,2.6)', pos: 'w' }],
          angles: [{ at: [0.8, 2.6], from: [1.8, 4.6], to: [2.8, 1.6], right: true }]
        },
        note: 'The line $y=-\\tfrac12x+3$ passes through $(4,1)$ and meets $y=2x+1$ at a right angle at $(0.8,2.6)$. Solving $2x+1=-\\tfrac12x+3$ gives $x=0.8$.'
      }
    ]
  },

  'ma5-mag-c-01': {
    objective: 'Write very large and very small numbers in scientific notation, calculate with them, and round a measurement to a given number of significant figures.',
    intuition: 'Scientific notation separates a number into two questions: what are its digits, and how big is it. The decimal part between $1$ and $10$ holds the digits; the power of ten counts how many places the decimal point has moved. Each step down the powers of ten divides by $10$, so $10^{-3}$ is a thousandth, a small positive number, not a negative one.',
    diagrams: [
      {
        title: 'Powers of ten from $10^3$ down to $10^{-3}$',
        spec: { kind: 'sequence', type: 'geometric', first: 1000, step: 0.1, n: 7 },
        note: 'The terms $1000,100,10,1,0.1,0.01,0.001$ are $10^3$ down to $10^{-3}$. Each is a tenth of the one before, and every one is positive: a negative power makes a number small, not negative.'
      }
    ],
    interactiveNone: 'Scientific notation and significant figures are place-value rules. Moving a slider would only redisplay a number; the conversions and the rounding are clearer worked on the page digit by digit.'
  },

  'ma5-nli-c-01': {
    objective: 'Sketch a parabola from its equation by finding its intercepts, axis of symmetry and vertex, and describe how $a$, $h$ and $k$ in $y=a(x-h)^2+k$ move and reshape it.',
    intuition: 'A parabola is symmetrical, so its two $x$-intercepts are mirror images and the axis of symmetry sits exactly halfway between them. The vertex lies on that axis, so once the intercepts are known the vertex is one substitution away. In $y=a(x-h)^2+k$ the squared bracket is never negative, so its smallest value, $0$, happens at $x=h$, and that is where the curve turns.'
  },

  'ma5-nli-c-02': {
    objective: 'Recognise and sketch exponential, hyperbolic and circular graphs from their equations, and use them to model growth, decay and inverse relationships.',
    intuition: 'An exponential multiplies by the same factor at every step, so equal steps across give equal ratios up, not equal differences; that is why it curves away so fast. Multiplying by a positive number can never reach $0$, so the $x$-axis is an asymptote. A hyperbola $y=\\tfrac{k}{x}$ keeps the product $xy$ fixed. A circle is every point at one distance from the centre, which is Pythagoras’ theorem written as $x^2+y^2=r^2$.',
    diagrams: [
      {
        title: 'Start value and growth factor',
        spec: { kind: 'paramGraph', expr: 'a*b^x', params: [{ name: 'a', min: 1, max: 5, step: 1, initial: 3 }, { name: 'b', min: 0.5, max: 3, step: 0.5, initial: 2 }], xmin: -3, xmax: 4, ymin: -2, ymax: 26, show: ['yIntercept', 'asymptotes'] },
        note: 'For $y=3\\times2^x$ the curve starts at $(0,3)$ and doubles each step: $3,6,12,24$. The slider $a$ moves the $y$-intercept; the slider $b$ sets the factor. Take $b=0.5$ and the same curve decays towards the asymptote $y=0$ instead.'
      },
      {
        title: 'On, inside or outside $x^2+y^2=25$',
        spec: {
          kind: 'plane', xmin: -7, xmax: 7, ymin: -7, ymax: 7,
          circles: [{ cx: 0, cy: 0, r: 5 }],
          points: [{ x: 3, y: 4, label: '(3,4)', pos: 'e' }, { x: 2, y: 5, label: '(2,5)', pos: 'n' }],
          segments: [{ from: [0, 0], to: [3, 4], label: '5', dashed: true }]
        },
        note: 'The point $(3,4)$ is $\\sqrt{3^2+4^2}=5$ from the centre, so it is on the circle. The point $(2,5)$ is $\\sqrt{29}\\approx5.39$ from the centre, so it is just outside.'
      }
    ]
  },

  'ma5-pro-c-01': {
    objective: 'Find probabilities of two-stage events with and without replacement using a tree diagram, and use complements and Venn diagrams for events with an overlap.',
    intuition: 'A probability tells you the fraction of times an event happens over many repeats. On a tree, taking one branch and then another is a fraction of a fraction, which is why you multiply along the branches. If the first counter is kept out of the bag, the bag the second draw comes from is different, so the second set of branches must change.',
    diagrams: [
      {
        title: 'Draw from the bag, many times',
        spec: { kind: 'probabilitySim', experiment: 'bag', bag: [{ label: 'R', weight: 3 }, { label: 'B', weight: 2 }], event: ['R'], seed: 5 },
        note: 'The bag holds $3$ red and $2$ blue counters, put back after each draw, so $P(\\text{red})=\\tfrac35=0.6$. After $10$ draws the proportion of reds can be well away from $0.6$; after $1000$ it settles close to it.'
      }
    ]
  },

  'ma5-trg-c-01': {
    objective: 'Label the sides of a right-angled triangle from a given angle, and use sine, cosine or tangent to find an unknown side or angle.',
    intuition: 'All right-angled triangles with a $30^\\circ$ angle are the same shape, enlargements of one another, so the ratio of any two of their sides is the same in every one of them. The sine, cosine and tangent of $30^\\circ$ are just those fixed ratios, stored in the calculator. Knowing one side and the ratio is then enough to find another side.',
    diagrams: [
      {
        title: 'Change the angle, read the ratios',
        spec: { kind: 'triangleExplorer', mode: 'trigRatios', initial: { angle: 30, hyp: 10 } },
        note: 'With a hypotenuse of $10$ and an angle of $30^\\circ$ the opposite side is $5$, so $\\sin30^\\circ=\\tfrac{5}{10}=0.5$. Change the hypotenuse and every side scales, but the ratios stay put; only changing the angle changes them.'
      }
    ]
  },

  'ma5-trg-c-02': {
    objective: 'Solve problems with angles of elevation and depression and with bearings by drawing the right-angled triangle, and use the exact ratios of $30^\\circ$, $45^\\circ$ and $60^\\circ$.',
    intuition: 'Every elevation, depression or bearing question hides a right-angled triangle. Elevation and depression are measured from the horizontal, so the horizontal is one side of that triangle. A bearing is measured clockwise from north, so draw the north line first, then the path, then drop a perpendicular to make the triangle.',
    diagrams: [
      {
        title: 'Sailing $12$ km on a bearing of $150^\\circ$',
        spec: {
          kind: 'plane', xmin: -4, xmax: 10, ymin: -13, ymax: 8, axes: false, grid: false,
          points: [{ x: 0, y: 0, label: 'O', pos: 'w' }, { x: 0, y: 6, label: 'N', pos: 'n' }, { x: 6, y: -10.392, pos: 'e' }],
          segments: [
            { from: [0, 0], to: [0, 6], arrow: true },
            { from: [0, 0], to: [6, -10.392], label: '12' },
            { from: [0, 0], to: [0, -10.392], label: '6\\sqrt3', dashed: true },
            { from: [0, -10.392], to: [6, -10.392], label: '6', dashed: true }
          ],
          angles: [{ at: [0, 0], from: [0, 5], to: [6, -10.392], label: 'auto' }, { at: [0, -10.392], from: [0, 0], to: [6, -10.392], right: true }]
        },
        note: 'The path makes $180^\\circ-150^\\circ=30^\\circ$ with south, so the distance south is $12\\cos30^\\circ=6\\sqrt3\\approx10.4$ km and the distance east is $12\\sin30^\\circ=6$ km.'
      },
      {
        title: 'Elevation from $40$ m away',
        spec: { kind: 'triangleExplorer', mode: 'trigRatios', initial: { angle: 35, adj: 40 } },
        note: 'With the observer $40$ m from the base and an angle of elevation of $35^\\circ$, the height is $40\\tan35^\\circ\\approx28.0$ m. Raise the angle and the height grows faster and faster.'
      }
    ]
  },

  'ma5-vol-c-01': {
    objective: 'Find the volume of prisms, cylinders, pyramids, cones and spheres, and convert between cubic units and litres.',
    intuition: 'A prism or cylinder is a stack of identical slices, so its volume is one slice times the height. A cone with the same base and height tapers to a point, and it holds exactly one third of the cylinder; three cones of water fill the cylinder. The height in each formula is the perpendicular height, because that is how tall the stack of slices is.',
    diagrams: [
      {
        title: 'A cylinder of radius $5$ and height $12$',
        spec: { kind: 'solid', shape: 'cylinder', r: 5, h: 12 },
        note: 'Its volume is $\\pi\\times5^2\\times12=300\\pi\\approx942.5\\text{ cm}^3$.'
      },
      {
        title: 'The cone with the same base and height',
        spec: { kind: 'solid', shape: 'cone', r: 5, h: 12 },
        note: 'The cone holds $\\tfrac13\\times300\\pi=100\\pi\\approx314.2\\text{ cm}^3$, one third of the cylinder beside it. The $12$ is the perpendicular height down the centre, not the slanted side.'
      },
      {
        title: 'Change the cone, watch the volume',
        spec: { kind: 'solidExplorer', shape: 'cone', dims: { r: 5, h: 12 } },
        note: 'At $r=5$ and $h=12$ the volume is $100\\pi\\approx314.2$. Doubling the height doubles the volume, but doubling the radius multiplies it by $4$, because the radius is squared.'
      }
    ]
  }
};
