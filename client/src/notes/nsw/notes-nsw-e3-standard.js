// Pri Learning · NSW Notes · Experience 3 layer (standard), see notes/e3.js. Original writing, en-AU.
// Every number below was computed (engine or SymPy), and every diagram uses the chapter's own numbers.
export default {
  // ── Year 11 ────────────────────────────────────────────────────────────────
  'mst-11-01': {
    objective: 'Substitute values into a formula, rearrange it to make another quantity the subject, and solve the linear equation that results, keeping the units throughout.',
    intuition: 'A formula is a machine: put numbers in and one number comes out. Changing the subject runs the machine backwards, so you undo its steps in reverse order, the way you unwrap a parcel. In $v=u+at$ the speed starts at $u$ and rises by $a$ every second, which is why its graph against time is a straight line with gradient $a$.',
    diagrams: [
      {
        title: 'Speed against time for different accelerations',
        spec: {
          kind: 'paramGraph', expr: '5+a*x', xmin: 0, xmax: 10, ymin: 0, ymax: 50, show: ['yIntercept'],
          params: [{ name: 'a', min: 0, max: 4, step: 0.5, initial: 2.5, label: 'acceleration a' }]
        },
        note: 'The line starts at $u=5$ m/s whatever the acceleration. With $a=2.5$ it reaches $25$ m/s at $t=8$ s, as in the worked example. Raise $a$ and the line gets steeper: the acceleration is the gradient.'
      }
    ]
  },
  'mst-11-02': {
    objective: 'Find the gradient and intercept of a linear relationship from a rule, a table or two points, explain what each means in context, and find where two linear models give the same value.',
    intuition: 'A straight line is what a constant rate looks like. Every extra kilometre in the taxi adds the same $\\$2.10$, so the fare climbs in equal steps, and the flagfall is where the line starts before any distance is travelled. Comparing two plans is asking where one line overtakes the other.',
    diagrams: [
      {
        title: 'Change the rate and the flagfall',
        spec: {
          kind: 'paramGraph', expr: 'm*x+c', xmin: 0, xmax: 20, ymin: 0, ymax: 100, show: ['yIntercept'],
          params: [
            { name: 'm', min: 0.5, max: 4, step: 0.1, initial: 2.1, label: 'rate m (dollars per km)' },
            { name: 'c', min: 0, max: 10, step: 0.1, initial: 4.2, label: 'flagfall c (dollars)' }
          ]
        },
        note: 'Start at $m=2.1$ and $c=4.2$: the line is the taxi fare $C=4.20+2.10d$, and at $d=12$ it reads $\\$29.40$. Moving $c$ slides the line up or down without changing its slope; moving $m$ turns it about its starting point.'
      }
    ]
  },
  'mst-11-03': {
    objective: 'Calculate gross pay from wages, overtime, commission and allowances, convert pay between periods, and find the income tax on a taxable income from a given tax table.',
    intuition: 'Pay is built from separate pieces, each worked out on its own and then added. Overtime is the ordinary hourly rate multiplied by a loading, so each overtime hour is worth more than an ordinary one. Income tax works in bands: only the dollars above a band\'s lower limit are taxed at that band\'s rate, so moving into a higher band never lowers your pay after tax.',
    diagrams: [
      {
        title: 'Gross pay as overtime hours increase',
        spec: {
          kind: 'paramGraph', expr: '1083+k*28.5*x', xmin: 0, xmax: 10, ymin: 0, ymax: 2000, show: ['yIntercept'],
          params: [{ name: 'k', min: 1, max: 2.5, step: 0.5, initial: 1.5, label: 'overtime loading k' }]
        },
        note: 'The line starts at $\\$1083$, Mia\'s pay for $38$ ordinary hours at $\\$28.50$. At time and a half ($k=1.5$) each overtime hour adds $\\$42.75$, so $6$ hours give $\\$1339.50$. Set $k=2$ for double time and the same $6$ hours give $\\$1425$.'
      }
    ]
  },
  'mst-11-04': {
    objective: 'Build a budget, calculate GST, discounts and percentage change from the correct base, and find simple interest on a principal over a given time.',
    intuition: 'Every calculation in this topic is a percentage of something, and most errors come from taking it of the wrong thing. GST is $10\\%$ of the price before tax, so the price you pay is $110\\%$ of it, and to go back you divide by $1.1$. Simple interest is paid only on the money first deposited, so it adds the same amount every year and its graph is a straight line.',
    diagrams: [
      {
        title: 'Simple interest grows in a straight line',
        spec: {
          kind: 'paramGraph', expr: '6000*r*x/100', xmin: 0, xmax: 6, ymin: 0, ymax: 3000,
          params: [{ name: 'r', min: 1, max: 8, step: 0.1, initial: 5.2, label: 'rate r (% p.a.)' }]
        },
        note: 'The line is $I=Prn$ for $P=\\$6000$. At $r=5.2\\%$ the interest after $2.5$ years ($30$ months) is $\\$780$, as in the worked example. Change the rate and the line pivots about the origin: no time, no interest.'
      }
    ]
  },
  'mst-11-05': {
    objective: 'Calculate the perimeter, area, surface area and volume of practical shapes and solids, convert between units of area, volume and capacity, and give each answer with its unit.',
    intuition: 'Volume counts how many unit cubes fit inside. For a prism or a cylinder you can count one layer, which is the base area, and multiply by the number of layers, which is the height. Area units are squares and volume units are cubes, which is why $1$ m is $100$ cm but $1\\text{ m}^2$ is $10\\,000\\text{ cm}^2$.',
    diagrams: [
      {
        title: 'Change the tank\'s radius and height',
        spec: { kind: 'solidExplorer', shape: 'cylinder', r: 0.5, h: 1.2 },
        note: 'Start with $r=0.5$ m and $h=1.2$ m: the volume is $0.3\\pi\\text{ m}^3$, about $942$ L. Double the height and the volume doubles; double the radius and it becomes four times as large, because the radius is squared.'
      }
    ]
  },
  'mst-11-06': {
    objective: 'Locate places by latitude and longitude, convert a longitude difference into a time difference, and find local times for travel across time zones.',
    intuition: 'The Earth turns through $360^\\circ$ in $24$ hours, so the Sun appears to move $15^\\circ$ of longitude every hour. A place further east sees noon sooner, so its clock is ahead. Time zones round this to whole or half hours so that neighbours share a clock, which is why you use the stated UTC offsets, not longitudes, when a question gives them.',
    diagrams: [
      {
        title: 'Standard time offsets from UTC',
        spec: {
          kind: 'numberLine', min: 7, max: 13, step: 1,
          points: [
            { value: 8, label: '\\text{Perth}' },
            { value: 10, label: '\\text{Sydney}' },
            { value: 12, label: '\\text{Auckland}' }
          ]
        },
        note: 'In standard time Perth is UTC+8, Sydney UTC+10 and Auckland UTC+12, each $2$ hours apart. When it is $8$ pm in Sydney it is $6$ pm in Perth and $10$ pm in Auckland.'
      }
    ],
    interactiveNone: 'This topic rests on one fixed rate, $15^\\circ$ of longitude per hour, and on offsets that each question states; there is no quantity to vary whose effect a slider would show more clearly than the two number lines.'
  },
  'mst-11-07': {
    objective: 'Find the shortest path between two vertices of a weighted network, find a minimum spanning tree and its total weight, and use vertex degrees to decide whether an Euler path or circuit exists.',
    intuition: 'A network keeps only what matters: places as vertices, connections as edges and costs as weights. A shortest path gets from one vertex to another; a minimum spanning tree connects every vertex as cheaply as possible, and it can use edges that no shortest path would. A trail that uses each edge once must leave every vertex it enters, which is why the degrees must be even except at its two ends.',
    diagrams: [
      {
        title: 'The minimum spanning tree',
        spec: {
          kind: 'network',
          nodes: [{ id: 'A', x: 0, y: 1 }, { id: 'B', x: 2, y: 2 }, { id: 'C', x: 2, y: 0 }, { id: 'D', x: 4, y: 2 }, { id: 'E', x: 4, y: 0 }, { id: 'F', x: 6, y: 1 }],
          edges: [
            { from: 'A', to: 'B', weight: 4 }, { from: 'A', to: 'C', weight: 2 }, { from: 'B', to: 'C', weight: 1 },
            { from: 'B', to: 'D', weight: 6 }, { from: 'C', to: 'D', weight: 8 }, { from: 'C', to: 'E', weight: 7 },
            { from: 'D', to: 'E', weight: 2 }, { from: 'D', to: 'F', weight: 6 }, { from: 'E', to: 'F', weight: 3 }
          ],
          path: ['A', 'C', 'B', 'D', 'E', 'F'],
          directed: false
        },
        note: 'Kruskal\'s method chooses $BC\\,(1)$, $AC\\,(2)$, $DE\\,(2)$, $EF\\,(3)$ and $BD\\,(6)$: five edges for six vertices, with total weight $14$. Here the tree happens to be a single chain $A,C,B,D,E,F$. The shortest route $A\\to C\\to E\\to F$ uses $CE$, an edge the tree leaves out.'
      }
    ],
    interactiveNone: 'Shortest paths and spanning trees come from step-by-step methods on one fixed network; nothing varies continuously, and the two highlighted diagrams show each result with its total.'
  },
  'mst-11-08': {
    objective: 'Calculate and interpret the mean, median, quartiles, interquartile range and standard deviation of a data set, identify outliers with the fence test, and compare data sets with box plots.',
    intuition: 'The mean is the balance point of the data: every value pulls on it in proportion to its distance, so one extreme value can drag it a long way. The median depends only on order, so the same extreme value barely moves it. That is why the median and IQR describe skewed data, or data with outliers, more honestly than the mean and standard deviation.',
    diagrams: [
      {
        title: 'Move the largest value',
        spec: { kind: 'dataExplorer', data: [3, 5, 6, 7, 8, 8, 9, 10, 12, 13, 14, 25], editable: [11], show: ['mean', 'median', 'iqr', 'sd'] },
        note: 'The data have mean $10$ and median $8.5$. Move the largest value from $25$ down to $15$: the mean falls to about $9.17$ and the standard deviation from $5.49$ to about $3.58$, but the median and the IQR of $6$ do not change.'
      }
    ]
  },

  // ── Year 12, Standard 1 ────────────────────────────────────────────────────
  'mst-12-s1-01': {
    objective: 'Recognise linear, quadratic, exponential and inverse variation models from their rules and graphs, and solve them to answer questions in context.',
    intuition: 'Each model describes a different way of changing. A quadratic rises and falls symmetrically, like a thrown ball. An exponential multiplies by the same factor every step, so it grows slowly at first and then very fast. Inverse variation keeps a product fixed: share a fixed job among more workers and each one takes less time.',
    diagrams: [
      {
        title: 'Bacteria doubling every $3$ hours',
        spec: {
          kind: 'function', xmin: 0, xmax: 13, ymin: 0, ymax: 4000,
          curves: [{ expr: '200*2^(x/3)', label: 'N=200\\times2^{t/3}' }],
          points: [{ x: 3, y: 400, label: '400' }, { x: 6, y: 800, label: '800' }, { x: 9, y: 1600, label: '1600' }, { x: 12, y: 3200, label: '3200' }]
        },
        note: 'The count doubles every $3$ hours: $400$, $800$, $1600$, then $3200$ at $t=12$. The jumps get bigger even though the growth factor stays at $2$.'
      },
      {
        title: 'Inverse variation $y=\\tfrac{k}{x}$',
        spec: {
          kind: 'paramGraph', expr: 'k/x', xmin: 0, xmax: 12, ymin: 0, ymax: 20, show: ['asymptotes'],
          params: [{ name: 'k', min: 6, max: 60, step: 6, initial: 36, label: 'k' }]
        },
        note: 'With $k=36$ the curve passes through $(3,12)$ and $(6,6)$: doubling $x$ halves $y$, and every point has $xy=36$. Change $k$ and the curve moves out or in, but it never touches either axis.'
      }
    ]
  },
  'mst-12-s1-02': {
    objective: 'Calculate the future value and present value of an investment with compound interest, matching the rate and the number of periods to the compounding, and use a table factor for regular contributions.',
    intuition: 'With compound interest the interest is added to the balance and then earns interest itself, so the balance is multiplied by the same factor every period. That is why the growth curve bends upward while simple interest stays a straight line. Present value runs the same multiplication backwards: divide by the growth factor to find what you need today.',
    diagrams: [
      {
        title: 'Rate, time and compounding',
        spec: { kind: 'compoundExplorer', principal: 5000, initialRate: 4, initialYears: 3 },
        note: 'Start at $\\$5000$, $4\\%$ p.a. and $3$ years, and choose quarterly compounding: the balance is $\\$5634.13$, as in the worked example. Compare yearly and monthly: more frequent compounding gives a little more, and a longer time widens the gap between compound and simple interest.'
      }
    ]
  },
  'mst-12-s1-03': {
    objective: 'Find the value of an asset under straight-line or declining-balance depreciation, and calculate loan repayments, the total repaid and the interest from a table or a reducing balance.',
    intuition: 'Straight-line depreciation takes the same dollar amount off every year, so the value falls along a straight line to zero. Declining balance takes the same percentage of what is left, so each year\'s loss is smaller than the one before and the value never quite reaches zero. A loan is an investment seen from the other side: interest is added to what you owe, and each repayment takes some of it away.',
    diagrams: [
      {
        title: 'Declining balance against straight line',
        spec: {
          kind: 'paramGraph', expr: '32000*(1-r/100)^x', xmin: 0, xmax: 6, ymin: 0, ymax: 35000,
          params: [{ name: 'r', min: 5, max: 30, step: 1, initial: 15, label: 'rate r (% p.a.)' }],
          fixed: [{ expr: '32000-4800*x', label: 'S=32000-4800n' }]
        },
        note: 'Both models start at $\\$32\\,000$ and lose $\\$4800$ in the first year. With $r=15\\%$ the curve is worth $\\$19\\,652$ after $3$ years, while the straight line is down to $\\$17\\,600$. Increase $r$ and the curve drops faster at the start, but it still flattens out.'
      }
    ]
  },
  'mst-12-s1-04': {
    objective: 'Use Pythagoras\' theorem and the sine, cosine and tangent ratios to find unknown sides and angles in right-angled triangles, including problems with angles of elevation and depression.',
    intuition: 'All right-angled triangles with the same acute angle are the same shape, only scaled. So the ratio of any two sides depends on the angle alone, not on the size of the triangle, and that ratio is what $\\sin$, $\\cos$ and $\\tan$ record. Knowing an angle and one side is then enough to scale up to the others.',
    diagrams: [
      {
        title: 'Change the triangle, watch the ratios',
        spec: { kind: 'triangleExplorer', mode: 'trigRatios', initial: { a: 20, b: 15 } },
        note: 'Start with legs $20$ and $15$ and hypotenuse $25$, as in the cable problem: $\\cos\\theta=0.8$ and $\\theta\\approx36.9^\\circ$. A larger triangle with the same angle gives the same $\\sin\\theta$, $\\cos\\theta$ and $\\tan\\theta$; only changing the angle changes them.'
      },
      {
        title: 'Angle of elevation to the top of a tower',
        spec: {
          kind: 'plane', xmin: -2, xmax: 24, ymin: -2, ymax: 17, axes: false, grid: false,
          points: [{ x: 0, y: 0, label: 'O', pos: 'sw' }, { x: 20, y: 0, label: 'F', pos: 'se' }, { x: 20, y: 14, label: 'T', pos: 'ne' }],
          segments: [
            { from: [0, 0], to: [20, 0], label: '20\\text{ m}' },
            { from: [20, 0], to: [20, 14], label: 'h' },
            { from: [0, 0], to: [20, 14], dashed: true }
          ],
          angles: [{ at: [0, 0], from: [20, 0], to: [20, 14], label: '35^\\circ' }, { at: [20, 0], from: [0, 0], to: [20, 14], right: true }]
        },
        note: 'The observer at $O$ stands $20$ m from the base $F$ and looks up at $35^\\circ$ from the horizontal. The height is the side opposite that angle and $20$ m is the adjacent side, so $h=20\\tan35^\\circ\\approx14.0$ m.'
      }
    ]
  },
  'mst-12-s1-05': {
    objective: 'Share a quantity in a given ratio, calculate and compare rates with their units, convert between rate units, and use map scales and fuel consumption in practical problems.',
    intuition: 'A ratio says how many equal parts each person gets, so the first job is always to find the size of one part. A rate is a gradient: litres per $100$ km is how steeply fuel use climbs with distance. Writing the units into every step shows you whether to multiply or divide.',
    diagrams: [
      {
        title: 'Fuel used at different consumption rates',
        spec: {
          kind: 'paramGraph', expr: 'k*x/100', xmin: 0, xmax: 800, ymin: 0, ymax: 100,
          params: [{ name: 'k', min: 4, max: 12, step: 0.1, initial: 7.8, label: 'litres per 100 km' }]
        },
        note: 'At $7.8$ L per $100$ km the line reaches $49.92$ L at $640$ km. A thirstier car has a steeper line; a car using $5$ L per $100$ km needs only $32$ L for the same trip.'
      }
    ]
  },
  'mst-12-s1-06': {
    objective: 'Describe the direction, strength and form of the relationship in a scatterplot, find and interpret the least-squares line and correlation coefficient, and judge whether a prediction is reliable.',
    intuition: 'The least-squares line makes the vertical misses from the points as small as possible overall, measured by the sum of their squares. Because the misses above and below balance, the line always passes through the mean point. Near the middle of the data every sensible line gives a similar prediction; far outside it a small change in gradient makes a large difference, which is why extrapolation is unreliable.',
    diagrams: [
      {
        title: 'Residuals from the least-squares line',
        spec: {
          kind: 'plane', xmin: 0, xmax: 6, ymin: 40, ymax: 70, equal: false,
          points: [{ x: 1, y: 46 }, { x: 2, y: 52 }, { x: 3, y: 55 }, { x: 4, y: 62 }, { x: 5, y: 65 }],
          segments: [
            { from: [1, 46], to: [1, 46.4], dashed: true }, { from: [2, 52], to: [2, 51.2], dashed: true },
            { from: [3, 55], to: [3, 56], dashed: true }, { from: [4, 62], to: [4, 60.8], dashed: true },
            { from: [5, 65], to: [5, 65.6], dashed: true }
          ],
          lines: [{ through: [[1, 46.4], [5, 65.6]], label: 'y=4.8x+41.6' }]
        },
        note: 'Each dashed segment is a residual, the vertical distance from a point to $y=4.8x+41.6$. Measured as data minus line they are $-0.4$, $0.8$, $-1$, $1.2$ and $-0.6$, and they add to $0$.'
      },
      {
        title: 'Lines through the mean point',
        spec: {
          kind: 'paramGraph', expr: 'm*(x-3)+56', xmin: 0, xmax: 11, ymin: 0, ymax: 130,
          params: [{ name: 'm', min: 2, max: 8, step: 0.2, initial: 4.8, label: 'gradient m' }],
          fixed: [{ expr: '4.8*x+41.6', label: 'y=4.8x+41.6' }]
        },
        note: 'Every line here passes through the mean point $(3,56)$, and at $m=4.8$ it is the least-squares line. Move $m$ and compare predictions: at $x=4.5$ they range only from $59$ to $68$, but at $x=10$ they range from $70$ to $112$. That spread is why the extrapolated $89.6$ is unreliable.'
      }
    ]
  },
  'mst-12-s1-07': {
    objective: 'Estimate probabilities from relative frequency, calculate probabilities of equally likely and multistage events with trees and the complement, and find expected numbers of outcomes.',
    intuition: 'Probability is the long-run share of trials in which an event happens. A few trials can give almost any result, but as the number grows the relative frequency settles near the true value. A tree records each stage in turn, and multiplying along a branch takes a fraction of a fraction.',
    diagrams: [
      {
        title: 'Relative frequency of a sum of $7$',
        spec: { kind: 'probabilitySim', experiment: 'twoDiceSum', event: [7], seed: 7 },
        note: 'Two fair dice give a sum of $7$ in $6$ of the $36$ outcomes, so $P=\\tfrac16\\approx0.167$. Add $10$ rolls at a time and the relative frequency jumps about; after $1000$ rolls it is usually close to $0.167$.'
      }
    ]
  },

  // ── Year 12, Standard 2 ────────────────────────────────────────────────────
  'mst-12-s2-01': {
    objective: 'Model a situation with a linear, quadratic or exponential rule, find a break-even point by solving simultaneous equations, and interpret the features of a graph in context.',
    intuition: 'Profit is revenue minus cost, so it starts below zero by the fixed cost and rises by the margin on each item sold. Break-even is where the profit line crosses zero, which is the same place the revenue and cost lines cross. Raising the price makes the profit line steeper, so fewer items are needed to break even.',
    diagrams: [
      {
        title: 'Profit and the break-even point',
        spec: {
          kind: 'paramGraph', expr: 'p*x-(1200+15*x)', xmin: 0, xmax: 100, ymin: -1500, ymax: 3500, show: ['roots', 'yIntercept'],
          params: [{ name: 'p', min: 30, max: 60, step: 1, initial: 40, label: 'price p (dollars per item)' }]
        },
        note: 'At a price of $\\$40$ the profit is $P=25n-1200$, which crosses zero at $n=48$, as in the worked example. At $\\$30$ each item earns only $\\$15$ above its cost, and break-even moves out to $n=80$.'
      }
    ]
  },
  'mst-12-s2-02': {
    objective: 'Calculate compound interest and present value with the rate and periods matched to the compounding, and track a reducing-balance loan one period at a time.',
    intuition: 'Compounding multiplies the balance by $1+r$ every period, so interest earns interest and the curve bends upward. A reducing-balance loan applies the same multiplication to what you owe and then subtracts a repayment. Early on most of each repayment covers the interest, so the balance falls slowly; as it shrinks, more of each repayment comes off the debt.'
  },
  'mst-12-s2-03': {
    objective: 'Find the future value and present value of an annuity, by adding the separately compounded payments or with the annuity formulas, matching the rate and number of periods to the payment interval.',
    intuition: 'An annuity is a set of separate compound-interest problems, one for each payment, added together. Each payment grows by the same factor for every extra period it stays invested, so the amounts form a geometric sequence, and the annuity formula is the sum of that sequence.',
    diagrams: [
      {
        title: 'Annuity payments as a geometric series',
        spec: { kind: 'sequenceExplorer', type: 'geometric', first: 1000, step: 1.04, n: 3 },
        note: 'Read the payments from the last one back: $1000$, $1040$ and $1081.60$, each $1.04$ times the one before. Their sum $S_3=3121.60$ is the future value. Increase $n$ to see the future value of more payments.'
      }
    ]
  },
  'mst-12-s2-04': {
    objective: 'Choose and apply the sine rule, the cosine rule or the area formula to find sides, angles and areas in non-right-angled triangles, including problems with bearings.',
    intuition: 'The cosine rule is Pythagoras with a correction for an angle that is not $90^\\circ$: when $C$ is larger than a right angle the third side is longer than Pythagoras predicts, and when it is smaller the side is shorter. The sine rule says a larger angle sits opposite a longer side, in exact proportion to the sine of the angle. The area formula is $\\tfrac12\\times\\text{base}\\times\\text{height}$ with the height written as $b\\sin C$.',
    diagrams: [
      {
        title: 'Change the angle between two sides',
        spec: { kind: 'triangleExplorer', mode: 'area', initial: { a: 8, b: 11, C: 50 } },
        note: 'With $a=8$, $b=11$ and $C=50^\\circ$ the area is $\\tfrac12\\times8\\times11\\sin50^\\circ\\approx33.71\\text{ cm}^2$. The area is largest when $C=90^\\circ$, at $44\\text{ cm}^2$, and shrinks towards $0$ as $C$ approaches $0^\\circ$ or $180^\\circ$.'
      }
    ]
  },
  'mst-12-s2-05': {
    objective: 'Share amounts in a ratio, use map scales, convert between rate units and compare unit rates to decide which option is better value.',
    intuition: 'Ratios, scales and rates are all multiplication by the right factor; the skill is choosing it. A ratio splits a total into equal shares. A scale says how many real units one map unit stands for. A rate is a gradient, and comparing two prices fairly means bringing both to the same unit, such as dollars per kilogram.',
    diagrams: [
      {
        title: 'Fuel cost of a trip',
        spec: {
          kind: 'paramGraph', expr: '0.075*p*x', xmin: 0, xmax: 800, ymin: 0, ymax: 160,
          params: [{ name: 'p', min: 1.5, max: 2.5, step: 0.05, initial: 1.95, label: 'petrol price (dollars per litre)' }]
        },
        note: 'At $7.5$ L per $100$ km and $\\$1.95$ a litre each kilometre costs about $14.6$ cents, so $640$ km costs $\\$93.60$. Raise the petrol price and the line steepens: the gradient is the cost per kilometre.'
      },
      {
        title: 'Comparing two packs by price per kilogram',
        spec: { kind: 'barChart', categories: ['500 g pack', '1.2 kg pack'], values: [8.4, 8], yLabel: 'dollars per kg' },
        note: 'The $500$ g pack costs $\\$4.20$, which is $\\$8.40$ per kg. The $1.2$ kg pack costs $\\$9.60$, which is $\\$8.00$ per kg, so the larger pack is the better value.'
      }
    ]
  },
  'mst-12-s2-06': {
    objective: 'Find the maximum flow through a network by finding the minimum cut, and use conservation of flow to complete the flows at each vertex.',
    intuition: 'Every unit that travels from the source to the sink must cross any cut that separates them, so no flow can exceed the capacity of any cut. The smallest cut is the bottleneck. A pipe system is only as good as its narrowest crossing, and widening a pipe that is not part of that crossing changes nothing.',
    diagrams: [
      {
        title: 'The capacity of every cut',
        spec: { kind: 'barChart', categories: ['S | ABT', 'SA | BT', 'SB | AT', 'SAB | T'], values: [16, 16, 18, 15], yLabel: 'cut capacity' },
        note: 'There are four ways to split the vertices with $S$ on one side and $T$ on the other. Their capacities are $16$, $16$, $18$ and $15$. In the cut with $S$ and $B$ together, $A\\to B$ points back towards the source side and is not counted. The smallest, $15$, is the maximum flow.'
      },
      {
        title: 'Widen one pipe and watch the bottleneck move',
        spec: {
          kind: 'paramGraph', expr: '(16+x+b-abs(x+b-16))/2', xmin: 0, xmax: 10, ymin: 0, ymax: 20, show: ['yIntercept'],
          params: [{ name: 'b', min: 5, max: 9, step: 1, initial: 8, label: 'capacity of B to T' }]
        },
        note: 'Across is the capacity of $A\\to T$, and the height is the maximum flow, the smaller of $16$ and $x+b$, where $b$ is the capacity of $B\\to T$. With $b=8$ and a capacity of $7$ the flow is $15$. Raise it past $8$ and the flow stops at $16$: the cut around $S$ has become the bottleneck.'
      }
    ]
  },
  'mst-12-s2-07': {
    objective: 'Draw an activity network, find earliest and latest times, identify the critical path and the minimum completion time, and calculate the float of each activity.',
    intuition: 'A project cannot finish before its longest chain of dependent jobs, however many jobs run side by side. That longest chain is the critical path. Every other activity has slack, called float, because its chain finishes early and waits for the critical one. Shortening a critical activity helps only until another path becomes the longest.',
    diagrams: [
      {
        title: 'Shorten activity $C$ and watch the finish time',
        spec: {
          kind: 'paramGraph', expr: '(13+x+d+abs(x-1-d))/2', xmin: 0, xmax: 10, ymin: 0, ymax: 18, show: ['yIntercept'],
          params: [{ name: 'd', min: 0, max: 6, step: 1, initial: 2, label: 'duration of D (days)' }]
        },
        note: 'Across is the duration of $C$, and the height is the minimum completion time: the longer of $A,C,E$ and $B,D,E$. With $D$ taking $2$ days, $C$ taking $5$ gives $11$ days. Shortening $C$ to $3$ gives $9$ days, and shortening it further gains nothing, because $B,D,E$ is now critical.'
      },
      {
        title: 'Float of each activity',
        spec: { kind: 'barChart', categories: ['A', 'B', 'C', 'D', 'E'], values: [0, 2, 0, 2, 0], yLabel: 'float (days)', horizontal: true },
        note: 'Activities $A$, $C$ and $E$ have zero float: they form the critical path. $B$ and $D$ each show $2$ days, but they share it, because they lie on the same path. Delaying $B$ by $2$ days uses up the float of $D$ as well.'
      }
    ]
  },
  'mst-12-s2-08': {
    objective: 'Describe a bivariate relationship from a scatterplot, calculate the least-squares line and the correlation coefficient, and use the line to make predictions while judging their reliability.',
    intuition: 'The least-squares line balances the points above it against the points below, which is why it always passes through the mean point $(\\bar x,\\bar y)$. Its gradient answers the practical question: how much does $y$ change, on average, for each extra unit of $x$? The further a prediction is from the mean point, the more a small error in that gradient matters.',
    diagrams: [
      {
        title: 'Lines through the mean point',
        spec: {
          kind: 'paramGraph', expr: 'm*(x-3)+62', xmin: 0, xmax: 10, ymin: 0, ymax: 130,
          params: [{ name: 'm', min: 2, max: 8, step: 0.1, initial: 4.9, label: 'gradient m' }],
          fixed: [{ expr: '4.9*x+47.3', label: 'y=4.9x+47.3' }]
        },
        note: 'All these lines pass through the mean point $(3,62)$, and at $m=4.9$ it is the least-squares line $y=4.9x+47.3$. At $x=3.5$ the predictions barely change as $m$ moves, but at $x=8$ they range from $72$ to $102$, which is why the prediction of $86.5$ marks is less reliable.'
      }
    ]
  },
  'mst-12-s2-09': {
    objective: 'Estimate a probability from relative frequency, compare it with the theoretical probability and expected numbers, and calculate multistage probabilities with trees and the complement.',
    intuition: 'Relative frequency is an experiment\'s estimate of a probability, and the theoretical probability is what that estimate should approach. In $200$ rolls the share of sixes can easily be $0.19$ instead of $\\tfrac16$; in many thousands of rolls it rarely strays far. For "at least one" questions the complement is quicker: one minus the chance of none.',
    diagrams: [
      {
        title: 'Sixes in the long run',
        spec: { kind: 'probabilitySim', experiment: 'die', event: [6], seed: 38 },
        note: 'The theoretical probability of a six is $\\tfrac16\\approx0.167$. After a few rolls the relative frequency can be far from it, as the $0.19$ from $200$ rolls in the worked example shows. Keep adding rolls and the bar settles near $0.167$.'
      }
    ]
  },
  'mst-12-s2-10': {
    objective: 'Use the mean and standard deviation of a normal distribution to calculate and interpret z-scores, apply the 68-95-99.7 rule, and compare values from different distributions.',
    intuition: 'A z-score measures a value in standard deviations from the mean, so it puts every normal distribution on the same ruler. Once the units are gone, all normal curves are the same curve, with the same share of the area within one, two or three standard deviations. That is what lets a mark in one test be compared fairly with a mark in another.'
  }
};
