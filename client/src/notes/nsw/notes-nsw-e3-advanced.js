// Pri Learning · NSW Notes · Experience 3 layer (advanced), see notes/e3.js. Original writing, en-AU.
// Mathematics Advanced, Years 11 and 12. Every number in a note below is computed (engine or exact arithmetic),
// and each diagram uses the numbers of the chapter's own examples.
export default {
  'mav-11-01': {
    objective: 'Find the domain and range of a function, form composite and inverse functions, and use the vertex and the discriminant of a quadratic to sketch it and say how many roots it has.',
    intuition: 'Think of a function as a machine: each input goes in and exactly one output comes out. The domain is every input the machine accepts, so $\\sqrt{x-2}$ refuses anything below $2$, and the range is every output it can produce. A composite $f(g(x))$ feeds the output of one machine into the next, so the order matters. For a quadratic, the vertex sits on the axis of symmetry halfway between the roots, and the discriminant $b^2-4ac$ tells you before any working whether the parabola crosses the $x$-axis twice, touches it once, or misses it.',
    diagrams: [
      {
        title: 'How $k$ decides the roots of $x^2+kx+9=0$',
        spec: {
          kind: 'paramGraph', expr: 'x^2+k*x+9',
          params: [{ name: 'k', min: -10, max: 10, step: 1, initial: 6 }],
          xmin: -10, xmax: 10, ymin: -18, ymax: 20, show: ['roots', 'vertex']
        },
        note: 'At $k=6$ the parabola $y=x^2+6x+9$ touches the $x$-axis only at $x=-3$, because $b^2-4ac=36-36=0$. Move $k$ beyond $6$ (or below $-6$) and the vertex drops under the axis, giving two roots; at $k=10$ they are $x=-1$ and $x=-9$. For $k$ between $-6$ and $6$ the parabola lifts clear of the axis and there are no real roots.'
      }
    ]
  },
  'mav-11-03': {
    objective: 'Describe how $y=af(b(x-h))+k$ is obtained from $y=f(x)$, and find the image of any point, intercept or vertex under those changes.',
    intuition: 'A transformation does to the graph what the equation does to the numbers. Changes outside the function act on the $y$-values, so they behave as you expect: adding $k$ lifts every point by $k$, and multiplying by $a$ stretches every height by the factor $a$. Changes inside act on $x$ before the function sees it, so they work backwards: replacing $x$ by $x-3$ means the old picture now happens $3$ units later, which is a shift to the right. Track one point, such as the vertex, and the whole graph follows it.'
  },
  'mav-11-04': {
    objective: 'Convert between degrees and radians, find arc lengths and sector areas, and solve any triangle with the sine rule, the cosine rule and the area formula $\\tfrac12ab\\sin C$.',
    intuition: 'A radian measures an angle by how far you travel around the circle: walk one radius along the edge and you have turned one radian, so a full turn is $2\\pi$ radians. That is why arc length is simply $l=r\\theta$; the angle already counts radii. The cosine rule is Pythagoras with a correction term, $-2ab\\cos C$, which is zero when $C=90^\\circ$ and grows as the angle opens. The sine rule says each side is in proportion to the sine of the angle opposite it, so the largest angle always faces the longest side.'
  },
  'mav-11-05': {
    objective: 'Sketch transformed trigonometric graphs, prove identities using $\\sin^2\\theta+\\cos^2\\theta=1$, and find every solution of a trigonometric equation in a given interval.',
    intuition: 'On the unit circle the point at angle $\\theta$ is $(\\cos\\theta,\\sin\\theta)$, so Pythagoras inside the circle gives $\\sin^2\\theta+\\cos^2\\theta=1$ at once. As the point keeps turning it retraces its path every $2\\pi$, which is why the graphs repeat and why an equation such as $2\\sin x=1$ has more than one answer. The calculator gives one angle; the symmetry of the circle gives the others in the same interval.'
  },
  'mav-11-06': {
    objective: 'Find the derivative of a polynomial from first principles and with the power rule, and use it to find gradients, tangents and normals.',
    intuition: 'A straight line has one gradient, rise over run, but a curve keeps changing direction. Join two points on the curve with a secant and slide the second point towards the first: the secant swings and settles on one line, the tangent, and its gradient is the derivative. For $y=x^2$ the secant from $x$ to $x+h$ has gradient $\\tfrac{(x+h)^2-x^2}{h}=2x+h$, and as $h$ shrinks to $0$ that becomes $2x$.'
  },
  'mav-11-07': {
    objective: 'Sketch exponential and logarithmic graphs, use the logarithm laws to simplify expressions, and solve equations in which the unknown is an index.',
    intuition: 'An exponential grows by the same factor in every equal step: $2^x$ doubles each time $x$ goes up by $1$. A logarithm asks the reverse question, which index gives this number, so $\\log_28=3$ because $2^3=8$. Multiplying powers adds their indices, so the logarithm turns multiplication into addition, and every log law is an index law read backwards. On a graph, $y=\\log_2x$ is $y=2^x$ reflected in the line $y=x$.',
    diagrams: [
      {
        title: 'The family $y=b^x$',
        spec: {
          kind: 'paramGraph', expr: 'b^x',
          params: [{ name: 'b', min: 0.25, max: 4, step: 0.25, initial: 2 }],
          xmin: -4, xmax: 4, ymin: -1, ymax: 8, show: ['yIntercept', 'asymptotes']
        },
        note: 'Every curve $y=b^x$ passes through $(0,1)$, because $b^0=1$, and stays above its asymptote $y=0$. For $b>1$ it rises, for $0<b<1$ it falls, and at $b=1$ it is the flat line $y=1$. With $b=2$ it passes through $(1,2)$ and $(2,4)$; with $b=0.5$ it is the same curve reflected in the $y$-axis.'
      }
    ]
  },
  'mav-11-09': {
    objective: 'Find probabilities of combined events with the addition rule, conditional probability and tree diagrams, decide whether two events are independent, and use the interquartile range to identify outliers.',
    intuition: 'Conditional probability shrinks the sample space: once you know $B$ has happened, only the outcomes inside $B$ are still possible, so $P(A\\mid B)$ is the share of $B$ that is also $A$. Two events are independent when knowing one leaves that share unchanged, $P(A\\mid B)=P(A)$. Along a branch of a tree you multiply, because each step happens given the ones before it; across branches you add, because they are separate outcomes. In data, the median and quartiles depend on the order of the values, not their size, so one extreme value barely moves them while it can drag the mean a long way.',
    diagrams: [
      {
        title: 'What an outlier does to the mean and the median',
        spec: { kind: 'dataExplorer', data: [4, 7, 8, 9, 10, 12, 13, 30], editable: [7], show: ['mean', 'median', 'iqr'] },
        note: 'With the largest value at $30$ the mean is $11.625$, but the median is $9.5$ and the IQR is $5$. Drag $30$ down to $14$: the mean falls by $2$ to $9.625$, while the median and the IQR do not move. Any value above $Q_3+1.5\\times\\text{IQR}=20$ is an outlier.'
      }
    ]
  },
  'mav-12-01': {
    objective: 'Apply combined transformations to trigonometric, exponential and absolute-value graphs, and build a model whose amplitude, period, midline or asymptote is read from a real situation.',
    intuition: 'A model is a graph you already know, moved and stretched until it fits the facts. For a tide, the midline is the average depth, the amplitude is how far the water rises above that average, and the period is the time from one high tide to the next; each is one number in $y=a\\sin(b(t-c))+d$. An absolute value $|u|$ is a distance from zero, so $|x-3|=5$ asks for the points $5$ units from $3$, which are $x=8$ and $x=-2$.'
  },
  'mav-12-03': {
    objective: 'Find any term and the sum of an arithmetic or geometric sequence, find the limiting sum of a geometric series with $|r|<1$, and decide which kind a sequence is.',
    intuition: 'An arithmetic sequence climbs in equal steps, so its terms lie on a straight line, and pairing the first term with the last, the second with the second-last and so on gives pairs with equal sums; that is the sum formula. A geometric sequence grows or shrinks by the same factor each time. When the factor lies between $-1$ and $1$ the terms shrink so fast that the sum settles: $12+6+3+\\cdots$ creeps up on $24$, each new term covering half of the gap that remains.',
    diagrams: [
      {
        title: 'Partial sums of $12+6+3+\\cdots$',
        spec: { kind: 'sequenceExplorer', type: 'geometric', first: 12, step: 0.5, n: 6 },
        note: 'With $a=12$ and $r=\\tfrac12$ the partial sums are $12$, $18$, $21$, $22.5$, $23.25$, $23.625$. Raise $n$ and $S_n$ keeps approaching $S_\\infty=\\tfrac{12}{1-\\frac12}=24$ without reaching it, because the gap to $24$ halves with every term.'
      }
    ]
  },
  'mav-12-04': {
    objective: 'Differentiate composite, product and quotient functions and exponential, logarithmic and trigonometric functions, and use the second derivative to describe how a gradient is changing.',
    intuition: 'The chain rule is about rates passing through a link: if $u$ changes $3$ times as fast as $x$, and $y$ changes $2$ times as fast as $u$, then $y$ changes $6$ times as fast as $x$. The product rule comes from a rectangle with sides $u$ and $v$: when both sides grow a little, the area gains a strip $u\'v$ along one side and $uv\'$ along the other. And $e^x$ is the one exponential whose gradient at every point equals its height, which is why it is the natural base.'
  },
  'mav-12-05': {
    objective: 'Find antiderivatives, evaluate definite integrals to find areas under and between curves, and estimate an integral with the trapezoidal rule.',
    intuition: 'Cut the region under a curve into thin strips. Each strip is nearly a rectangle of height $f(x)$, and the total of the strips approaches the area as they get thinner. The fundamental theorem says this total can be found without adding any strips: if $F\'(x)=f(x)$, the area from $a$ to $b$ is $F(b)-F(a)$. Area below the $x$-axis counts as negative, which is why a region that crosses the axis is split where it crosses.'
  },
  'mav-12-06': {
    objective: 'Find and classify stationary points, sketch a curve from its derivatives, solve optimisation problems, and move between displacement, velocity and acceleration.',
    intuition: 'At the top of a hill or the bottom of a valley the tangent is flat, so the greatest and least values of a smooth quantity are found where its derivative is zero. The second derivative says which: a curve bending downwards ($f\'\'<0$) has a maximum there, and one bending upwards has a minimum. In motion the same ideas have physical names: velocity is the gradient of displacement, so a particle is at rest exactly when its velocity is zero.',
    diagrams: [
      {
        title: 'The best paddock for any length of fencing',
        spec: {
          kind: 'paramGraph', expr: 'x*(L-2*x)',
          params: [{ name: 'L', min: 40, max: 120, step: 10, initial: 100, label: 'L (metres of fencing)' }],
          xmin: -5, xmax: 65, ymin: -200, ymax: 2000, show: ['turning', 'roots']
        },
        note: 'With $L=100$ m of fencing the area $A=x(100-2x)$ is greatest at $x=25$, where $A=1250\\text{ m}^2$. Change $L$ and the best width is always $x=\\tfrac{L}{4}$, because $\\tfrac{dA}{dx}=L-4x$ is zero there: $L=40$ gives $200\\text{ m}^2$ at $x=10$, and $L=120$ gives $1800\\text{ m}^2$ at $x=30$.'
      }
    ]
  },
  'mav-12-07': {
    objective: 'Find the mean and variance of a discrete random variable, use a probability density function to find probabilities, and use $z$-scores to answer questions about a normal distribution.',
    intuition: 'The mean of a random variable is its balance point: hang each value on a ruler with a weight equal to its probability, and $E(X)$ is where the ruler balances. The variance measures how far the weight sits from that point, using squared distances. A continuous variable spreads its probability over an interval, so any single value has probability zero and every probability is an area under the density. Every normal curve is the standard one moved and stretched, so the $z$-score $\\tfrac{x-\\mu}{\\sigma}$ turns any normal question into one about the standard curve.'
  },
  'mav-12-08': {
    objective: 'Calculate compound interest and depreciation, and find the future value of an annuity and the repayment on a reducing-balance loan.',
    intuition: 'Compound interest multiplies the balance by the same factor $1+r$ each period, so the balances form a geometric sequence. An annuity is a stack of such sequences: the first deposit grows for the most periods and the last for none, and adding them all is a geometric series, which is where the formula for $FV$ comes from. A loan runs the same way in reverse: the repayment is the amount that brings the balance owing to exactly zero at the end of the term.'
  }
};
