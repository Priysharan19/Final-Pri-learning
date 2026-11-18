// Pri Learning · NSW Notes · Stage 5 Path (Years 9 and 10, the 5.2 and 5.3 extension content) · band B.
//
// Original revision writing for the NSW Mathematics K–10 Syllabus (2022) focus
// areas. Written for Pri Learning; it is not an official NESA publication and
// quotes no syllabus text. Each topic is keyed by the lower-case outcome code of
// its focus area (a reference only). en-AU spelling. Same shape as
// notes-nsw-stage4.js; every worked example's answer is re-derived by the
// deterministic engine in client/test/nsw-notes-bands-check.mjs.
// Trigonometric values are checked in degrees by converting to radians (the engine works in radians).
export default {
  'ma5-net-p-01': {
    summary: 'A network is a set of points joined by lines, used to model roads, pipes, friendships and circuits. Counting degrees, finding a path that uses every edge, connecting everything as cheaply as possible and finding the shortest route are the core skills.',
    prereqs: [],
    concepts: [
      { title: 'Vertices, edges and degree', body: 'A network is drawn with dots (vertices) and lines (edges). The degree of a vertex is the number of edge ends that meet there. Adding the degrees counts every edge twice, once at each end, so the total of the degrees is $2$ times the number of edges.' },
      { title: 'Travelling along every edge', body: 'A path that uses every edge exactly once can exist only if the network is connected and has either $0$ or $2$ vertices of odd degree. With $2$ odd vertices the path must start at one and finish at the other; with $0$ it can start anywhere and returns to its start.' },
      { title: 'Trees, spanning trees and shortest paths', body: 'A tree is a connected network with no cycle, so $V$ vertices need exactly $V-1$ edges. A minimum spanning tree joins every vertex with the least total weight: add the lightest remaining edge that does not close a cycle. The shortest path between two vertices is found by comparing the total weights of the routes.' }
    ],
    definitions: [
      { term: 'Connected network', meaning: 'A network in which there is a route along edges from any vertex to any other.' },
      { term: 'Weighted network', meaning: 'A network whose edges carry numbers, such as distance, time or cost.' }
    ],
    formulas: [
      { label: 'Sum of degrees', tex: '\\sum \\deg(v)=2E' },
      { label: 'Edges in a tree on $V$ vertices', tex: 'E=V-1' }
    ],
    points: [
      { front: 'A network has degrees $3,3,2,2,4$. How many edges?', back: '$(3+3+2+2+4)\\div2=7$.' },
      { front: 'Can the degrees $3,3,3,2$ occur?', back: 'No. The total is $11$, which is odd, but it must equal $2E$. The number of odd vertices is always even.' },
      { front: 'A spanning tree of a network with $6$ vertices has how many edges?', back: '$5$.' },
      { front: 'What happens if a lightest edge would close a cycle?', back: 'Skip it. Take the lightest edge that joins two parts not yet connected.' }
    ],
    mistakes: [
      { wrong: 'The network with degrees $2,3,3,4,4$ has $16$ edges, the total of the degrees.', right: 'Each edge is counted at both of its ends, so divide by $2$: $16\\div2=8$ edges.' },
      { wrong: 'The shortest path always uses the fewest edges.', right: 'The shortest path has the smallest total weight. A route of three light edges can beat a single heavy edge.' }
    ],
    examples: [
      {
        question: 'A network has five vertices with degrees $3,3,2,2,4$. How many edges does it have, and does it have a path that uses every edge exactly once?',
        steps: ['Add the degrees: $3+3+2+2+4=14$.', 'Each edge contributes $2$ to the total, so $E=14\\div2=7$.', 'Exactly two vertices have odd degree (the two of degree $3$), so a path using every edge once exists, provided the network is connected. It runs from one degree-$3$ vertex to the other.'],
        answer: '$7$ edges; exactly two vertices have odd degree (the two of degree $3$), so a path using every edge exactly once exists provided the network is connected',
        verify: { kind: 'value', expr: '(3+3+2+2+4)/2', answer: '7' }
      },
      {
        question: 'Five towns $A,B,C,D,E$ are joined by roads with lengths (km) $AB=4$, $AC=3$, $BC=2$, $BD=5$, $CD=6$, $CE=7$, $DE=4$. Find the total length of a minimum spanning tree.',
        steps: ['Order the edges: $BC=2$, $AC=3$, $AB=4$, $DE=4$, $BD=5$, $CD=6$, $CE=7$.', 'Take $BC$ and $AC$. The edge $AB$ would close the cycle $A,B,C$, so skip it.', 'Take $DE=4$, then $BD=5$, which joins $\\{A,B,C\\}$ to $\\{D,E\\}$. Four edges now connect five vertices.', 'Total: $2+3+4+5=14$.'],
        answer: '$14$ km',
        verify: { kind: 'value', expr: '2+3+4+5', answer: '14' }
      },
      {
        question: 'In the same network, find the shortest route from $A$ to $E$.',
        steps: ['$A\\to C\\to E$ has length $3+7=10$.', 'The other routes are longer: $A\\to B\\to D\\to E$ is $4+5+4=13$ and $A\\to C\\to D\\to E$ is $3+6+4=13$.', 'The smallest total is $10$.'],
        answer: '$A\\to C\\to E$, $10$ km',
        verify: { kind: 'values', pairs: [['3+7', '10'], ['4+5+4', '13'], ['3+6+4', '13']] }
      }
    ]
  },

  'ma5-nli-p-01': {
    summary: 'Beyond lines and parabolas there are circles, exponential curves, hyperbolas and cubics. Each has a recognisable equation, a typical shape and a few key features that let you sketch it and solve problems about it.',
    prereqs: ['ma5-nli-c-02'],
    concepts: [
      { title: 'Circles', body: 'The points at distance $r$ from the centre $(h,k)$ satisfy $(x-h)^2+(y-k)^2=r^2$. A point lies on the circle when its coordinates make the equation true, inside when the left side is smaller than $r^2$ and outside when it is larger.' },
      { title: 'Exponential curves', body: 'In $y=a\\times b^x$ the value at $x=0$ is $a$, and each step of $1$ in $x$ multiplies $y$ by $b$. For $b>1$ the curve climbs ever more steeply; for $0<b<1$ it falls towards the $x$-axis, which it never reaches.' },
      { title: 'Hyperbolas and cubics', body: 'The graph of $y=\\dfrac{k}{x}$ has two branches and the axes as asymptotes; it is undefined at $x=0$. The cubic $y=ax^3$ passes through the origin and is steeper than a parabola for large $|x|$. Adding or subtracting a number in $y=f(x)+d$ or $y=f(x-h)$ slides the curve up or across.' }
    ],
    definitions: [
      { term: 'Asymptote', meaning: 'A line that a curve gets closer and closer to without ever touching it, such as the $x$-axis for $y=2^x$.' },
      { term: 'Radius', meaning: 'The fixed distance from the centre of a circle to every point on it. In $x^2+y^2=r^2$ it is $r$, the positive square root of the right side.' }
    ],
    formulas: [
      { label: 'Circle with centre $(h,k)$', tex: '(x-h)^2+(y-k)^2=r^2' },
      { label: 'Exponential curve', tex: 'y=a\\times b^{x}' },
      { label: 'Hyperbola', tex: 'y=\\frac{k}{x}' }
    ],
    points: [
      { front: 'Radius of $x^2+y^2=49$', back: '$7$.' },
      { front: 'The $y$-intercept of $y=5\\times2^x$', back: '$5$, because $2^0=1$.' },
      { front: 'Asymptotes of $y=\\dfrac{12}{x}$', back: 'The $x$-axis ($y=0$) and the $y$-axis ($x=0$).' },
      { front: 'What does $y=2^x-3$ do to the asymptote?', back: 'It moves it down to $y=-3$.' }
    ],
    mistakes: [
      { wrong: 'The circle $(x-2)^2+(y+1)^2=25$ has centre $(-2,1)$.', right: 'The signs flip: $(x-2)$ means $h=2$ and $(y+1)$ means $k=-1$, so the centre is $(2,-1)$.' },
      { wrong: 'The graph of $y=2^x$ crosses the $x$-axis near $x=-5$.', right: '$2^x$ is always positive. It gets very close to the axis for large negative $x$ but never reaches it.' }
    ],
    examples: [
      {
        question: 'Does the point $(5,3)$ lie on the circle $(x-2)^2+(y+1)^2=25$?',
        steps: ['Substitute: $(5-2)^2+(3+1)^2=3^2+4^2$.', '$9+16=25$, which equals $r^2$, so the point lies on the circle.'],
        answer: 'Yes: the left side is $25$',
        verify: { kind: 'value', expr: '(5-2)^2+(3+1)^2', answer: '25' }
      },
      {
        question: 'The curve $y=a\\times2^x$ passes through $(3,40)$. Find $a$ and the value of $y$ when $x=5$.',
        steps: ['Substitute: $40=a\\times2^3=8a$, so $a=5$.', 'The curve is $y=5\\times2^x$, and at $x=5$: $5\\times32=160$.'],
        answer: '$a=5$, and $y=160$ at $x=5$',
        verify: { kind: 'values', pairs: [['5*2^3', '40'], ['5*2^5', '160']] }
      },
      {
        question: 'Find where the hyperbola $y=\\dfrac{12}{x}$ meets the line $y=x+1$ in the first quadrant.',
        steps: ['Set them equal: $\\dfrac{12}{x}=x+1$, so $12=x^2+x$.', 'Rearrange: $x^2+x-12=0$, which factorises as $(x+4)(x-3)=0$.', 'In the first quadrant $x=3$, and $y=3+1=4$.'],
        answer: '$(3,4)$',
        verify: { kind: 'roots', f: 'x^2+x-12', answers: ['3', '-4'] }
      }
    ]
  },

  'ma5-pol-p-01': {
    summary: 'A polynomial is a sum of whole-number powers of $x$. Adding, multiplying and dividing them, and using the remainder and factor theorems, lets you factorise a cubic and find where its graph meets the axis without guessing.',
    prereqs: ['ma5-alg-p-01'],
    concepts: [
      { title: 'Degree and arithmetic', body: 'The degree is the highest power of $x$. Adding two polynomials gives a polynomial of at most the larger degree; multiplying adds the degrees, so a linear times a quadratic is a cubic. Collect like powers after expanding.' },
      { title: 'The remainder theorem', body: 'When $P(x)$ is divided by $x-a$, the remainder is the number $P(a)$. You can find the remainder by substituting, with no long division at all.' },
      { title: 'The factor theorem', body: 'If $P(a)=0$ then $x-a$ is a factor of $P(x)$, and conversely. To factorise a monic cubic (leading coefficient $1$), test the factors of the constant term until one gives $0$, divide it out, then factorise the quadratic that remains.' }
    ],
    definitions: [
      { term: 'Polynomial', meaning: 'An expression such as $2x^3-x+7$ built from numbers multiplied by whole-number powers of $x$, added or subtracted.' },
      { term: 'Root of a polynomial', meaning: 'A value $a$ for which $P(a)=0$. On the graph it is an $x$-intercept.' }
    ],
    formulas: [
      { label: 'Remainder theorem', tex: 'P(x)\\div(x-a)\\ \\text{has remainder}\\ P(a)' },
      { label: 'Division identity', tex: 'P(x)=(x-a)\\,Q(x)+R' }
    ],
    points: [
      { front: 'The degree of $(x+1)(x^2-3)$', back: '$3$.' },
      { front: 'Remainder when $P(x)$ is divided by $x+2$', back: '$P(-2)$. Write $x+2$ as $x-(-2)$.' },
      { front: 'Which values are worth testing as roots of $x^3-2x^2-5x+6$?', back: 'The factors of the constant $6$: $\\pm1,\\pm2,\\pm3,\\pm6$.' },
      { front: 'A cubic has at most how many roots?', back: 'Three.' }
    ],
    mistakes: [
      { wrong: 'The remainder when $P(x)$ is divided by $x+2$ is $P(2)$.', right: 'The divisor is $x-(-2)$, so the remainder is $P(-2)$.' },
      { wrong: 'Since $P(3)=0$, the factor is $x+3$.', right: 'A root at $x=3$ gives the factor $x-3$. The sign changes.' }
    ],
    examples: [
      {
        question: 'Factorise $P(x)=x^3-2x^2-5x+6$ fully.',
        steps: ['Test $x=1$: $1-2-5+6=0$, so $x-1$ is a factor.', 'Divide: $x^3-2x^2-5x+6=(x-1)(x^2-x-6)$.', 'Factorise the quadratic: $x^2-x-6=(x-3)(x+2)$.', 'So $P(x)=(x-1)(x-3)(x+2)$, with roots $1$, $3$ and $-2$.'],
        answer: '$(x-1)(x-3)(x+2)$',
        verify: { kind: 'equivalent', a: 'x^3-2*x^2-5*x+6', b: '(x-1)*(x-3)*(x+2)' }
      },
      {
        question: 'Find the remainder when $P(x)=2x^3+x^2-4x+3$ is divided by $x+2$.',
        steps: ['The remainder is $P(-2)$.', '$P(-2)=2(-8)+4+8+3=-16+15$.', 'So the remainder is $-1$.'],
        answer: '$-1$',
        verify: { kind: 'value', expr: '2*(-2)^3+(-2)^2-4*(-2)+3', answer: '-1' }
      },
      {
        question: '$x-2$ is a factor of $P(x)=x^3+kx^2-3x+2$. Find $k$.',
        steps: ['The factor theorem gives $P(2)=0$.', '$8+4k-6+2=0$, so $4k+4=0$ and $k=-1$.', 'Check: $P(2)=8-4-6+2=0$.'],
        answer: '$k=-1$',
        verify: { kind: 'value', expr: '2^3+(-1)*2^2-3*2+2', answer: '0' }
      }
    ]
  },

  'ma5-pro-p-01': {
    summary: 'When one event changes the chances of the next, outcomes are dependent. Tree diagrams, Venn diagrams and the multiplication rule handle draws without replacement, overlapping groups and the question of how likely one thing is, given another.',
    prereqs: ['ma5-pro-c-01'],
    concepts: [
      { title: 'Independent and dependent events', body: 'Two events are independent when one happening does not change the probability of the other, so $P(A\\text{ and }B)=P(A)\\times P(B)$. Drawing without replacement makes events dependent: the second probability uses the new, smaller collection.' },
      { title: 'Trees for dependent events', body: 'Multiply along the branches to find the probability of a path, and add the paths that give the outcome you want. Each set of branches from a point adds to $1$, and the paths together add to $1$.' },
      { title: 'Conditional probability', body: '$P(B\\mid A)$ is the probability of $B$ given that $A$ has happened. The information about $A$ shrinks the sample space to $A$ alone, so $P(B\\mid A)=\\dfrac{P(A\\text{ and }B)}{P(A)}$.' }
    ],
    definitions: [
      { term: 'Conditional probability', meaning: 'The probability of an event when another event is known to have happened, written $P(B\\mid A)$ and read as the probability of $B$ given $A$.' },
      { term: 'Without replacement', meaning: 'Items drawn are not put back, so the contents change and later probabilities depend on earlier draws.' }
    ],
    formulas: [
      { label: 'Multiplication rule', tex: 'P(A\\text{ and }B)=P(A)\\times P(B\\mid A)' },
      { label: 'Conditional probability', tex: 'P(B\\mid A)=\\frac{P(A\\text{ and }B)}{P(A)}' },
      { label: 'Addition rule', tex: 'P(A\\text{ or }B)=P(A)+P(B)-P(A\\text{ and }B)' }
    ],
    points: [
      { front: 'A bag has $5$ red and $3$ blue marbles. $P(\\text{red first})$?', back: '$\\tfrac{5}{8}$.' },
      { front: 'After a red is not replaced, $P(\\text{red second})$?', back: '$\\tfrac{4}{7}$: four reds remain among seven marbles.' },
      { front: 'If $A$ and $B$ are independent, what is $P(B\\mid A)$?', back: '$P(B)$. Knowing $A$ changes nothing.' },
      { front: 'Why subtract $P(A\\text{ and }B)$ in the addition rule?', back: 'Outcomes in both events are counted once in $P(A)$ and again in $P(B)$.' }
    ],
    mistakes: [
      { wrong: 'Two cards drawn without replacement: $P(\\text{both aces})=\\tfrac{4}{52}\\times\\tfrac{4}{52}$.', right: 'After one ace is removed, $3$ aces remain among $51$ cards: $\\tfrac{4}{52}\\times\\tfrac{3}{51}$.' },
      { wrong: '$P(B\\mid A)$ and $P(A\\mid B)$ are the same.', right: 'They have different denominators: $P(A)$ in the first and $P(B)$ in the second. Always divide by the probability of the event that is given.' }
    ],
    examples: [
      {
        question: 'A bag holds $5$ red and $3$ blue marbles. Two are drawn without replacement. Find $P(\\text{both red})$ and $P(\\text{one of each colour})$.',
        steps: ['$P(RR)=\\tfrac{5}{8}\\times\\tfrac{4}{7}=\\tfrac{20}{56}=\\tfrac{5}{14}$.', 'One of each is red then blue, or blue then red: $\\tfrac{5}{8}\\times\\tfrac{3}{7}+\\tfrac{3}{8}\\times\\tfrac{5}{7}$.', '$=\\tfrac{15}{56}+\\tfrac{15}{56}=\\tfrac{30}{56}=\\tfrac{15}{28}$.'],
        answer: '$P(RR)=\\tfrac{5}{14}$ and $P(\\text{one of each})=\\tfrac{15}{28}$',
        verify: { kind: 'values', pairs: [['5/8*4/7', '5/14'], ['5/8*3/7+3/8*5/7', '15/28']] }
      },
      {
        question: 'Of $40$ students, $18$ play netball, $16$ swim and $6$ do both. Find the probability that a student swims, given that they play netball.',
        steps: ['Given netball, the sample space is the $18$ netballers.', '$6$ of them also swim.', '$P(\\text{swim}\\mid\\text{netball})=\\tfrac{6}{18}=\\tfrac{1}{3}$.'],
        answer: '$\\tfrac{1}{3}$',
        verify: { kind: 'value', expr: '6/18', answer: '1/3' }
      },
      {
        question: 'Events $A$ and $B$ are independent with $P(A)=0.4$ and $P(B)=0.5$. Find $P(A\\text{ and }B)$ and $P(A\\text{ or }B)$.',
        steps: ['Independent events multiply: $P(A\\text{ and }B)=0.4\\times0.5=0.2$.', 'Addition rule: $P(A\\text{ or }B)=0.4+0.5-0.2=0.7$.'],
        answer: '$0.2$ and $0.7$',
        verify: { kind: 'values', pairs: [['0.4*0.5', '0.2'], ['0.4+0.5-0.2', '0.7']] }
      }
    ]
  },

  'ma5-rat-p-01': {
    summary: 'In a variation relationship two quantities are tied by a constant. Direct variation keeps their ratio fixed, inverse variation keeps their product fixed, and in both cases one pair of values finds the constant that predicts the rest.',
    prereqs: ['ma5-lin-c-01'],
    concepts: [
      { title: 'Direct variation', body: '$y$ varies directly as $x$ when $y=kx$, so doubling $x$ doubles $y$ and the graph is a straight line through the origin. It also covers powers: $y=kx^2$ means $y$ varies directly as the square of $x$.' },
      { title: 'Inverse variation', body: '$y$ varies inversely as $x$ when $y=\\dfrac{k}{x}$, so $xy=k$. Doubling $x$ halves $y$. The graph is a hyperbola. More workers on a job means fewer days: workers times days stays constant.' },
      { title: 'The method', body: 'Write the form, substitute the known pair to find $k$, then use the completed formula. Always state $k$ and check the answer makes sense: a direct relationship should grow together, an inverse one should move in opposite directions.' }
    ],
    definitions: [
      { term: 'Constant of variation', meaning: 'The fixed number $k$ in $y=kx$ or $y=\\dfrac{k}{x}$ that links the two quantities.' },
      { term: 'Proportional', meaning: 'Two quantities are proportional when one is a constant multiple of the other, which is direct variation.' }
    ],
    formulas: [
      { label: 'Direct variation', tex: 'y=kx\\qquad\\text{or}\\qquad y=kx^2' },
      { label: 'Inverse variation', tex: 'y=\\frac{k}{x}\\quad\\Longleftrightarrow\\quad xy=k' }
    ],
    points: [
      { front: '$y$ varies directly as $x$ and $y=15$ when $x=3$. Find $k$.', back: '$k=15\\div3=5$.' },
      { front: 'What does the graph of direct variation look like?', back: 'A straight line through the origin with gradient $k$.' },
      { front: '$y$ varies inversely as $x$. What happens to $y$ when $x$ is tripled?', back: '$y$ is divided by $3$.' },
      { front: 'What is constant in inverse variation?', back: 'The product $xy$.' }
    ],
    mistakes: [
      { wrong: '$y$ varies directly as $x^2$, and $y=12$ at $x=2$, so $k=12\\div2=6$.', right: 'The relation is $y=kx^2$, so $12=k\\times4$ and $k=3$. Divide by the squared value.' },
      { wrong: '$6$ workers take $10$ days, so $15$ workers take $25$ days.', right: 'More workers means fewer days. The job is $60$ worker-days, so $15$ workers take $60\\div15=4$ days.' }
    ],
    examples: [
      {
        question: '$y$ varies directly as the square of $x$, and $y=12$ when $x=2$. Find $y$ when $x=5$.',
        steps: ['Write $y=kx^2$. Substitute: $12=k\\times2^2$, so $k=3$.', 'Then $y=3x^2$, and at $x=5$: $y=3\\times25=75$.'],
        answer: '$75$',
        verify: { kind: 'values', pairs: [['3*2^2', '12'], ['3*5^2', '75']] }
      },
      {
        question: '$y$ varies inversely as $x$, with $y=6$ when $x=4$. Find $y$ when $x=8$.',
        steps: ['Write $y=\\dfrac{k}{x}$. Substitute: $6=\\dfrac{k}{4}$, so $k=24$.', 'At $x=8$: $y=\\dfrac{24}{8}=3$. Doubling $x$ halved $y$, as it should.'],
        answer: '$3$',
        verify: { kind: 'values', pairs: [['24/4', '6'], ['24/8', '3']] }
      },
      {
        question: 'Six workers take $10$ days to complete a job. How long would $15$ workers take, working at the same rate?',
        steps: ['Days are inversely proportional to workers, so workers times days is constant: $6\\times10=60$.', '$15\\times d=60$, so $d=4$.'],
        answer: '$4$ days',
        verify: { kind: 'value', expr: '6*10/15', answer: '4' }
      }
    ]
  },

  'ma5-rat-p-02': {
    summary: 'A rate says how fast one quantity changes with another. On a straight line the rate is constant, but on a curve it changes, so you find an average rate over an interval and estimate the rate at a single point by shrinking the interval.',
    prereqs: ['ma5-rat-p-01', 'ma5-nli-c-01'],
    concepts: [
      { title: 'Average rate of change', body: 'Between $x=a$ and $x=b$ the average rate of change of $y=f(x)$ is $\\dfrac{f(b)-f(a)}{b-a}$. It is the gradient of the chord (secant) joining the two points on the graph.' },
      { title: 'The rate at a point', body: 'To estimate the rate at one point, take intervals that start at that point and get smaller and smaller. The average rates settle towards a number, which is the gradient of the tangent there.' },
      { title: 'Units and meaning', body: 'A rate carries units of $y$ per unit of $x$, such as metres per second or dollars per month. Convert before comparing: $72\\ \\text{km/h}=72\\times1000\\div3600=20\\ \\text{m/s}$. A negative rate means the quantity is falling.' }
    ],
    definitions: [
      { term: 'Secant', meaning: 'A line through two points of a curve. Its gradient is the average rate of change between the points.' },
      { term: 'Tangent', meaning: 'A line that touches a curve at one point and has the same direction as the curve there. Its gradient is the rate of change at that point.' }
    ],
    formulas: [
      { label: 'Average rate of change on $[a,b]$', tex: '\\frac{f(b)-f(a)}{b-a}' },
      { label: 'Converting km/h to m/s', tex: '\\text{m/s}=\\text{km/h}\\times\\frac{1000}{3600}' }
    ],
    points: [
      { front: 'Average rate of change of $y=x^2$ from $x=1$ to $x=3$', back: '$\\dfrac{9-1}{3-1}=4$.' },
      { front: 'What does a steeper tangent mean?', back: 'The quantity is changing faster at that point.' },
      { front: 'What does a horizontal tangent mean?', back: 'The rate of change at that point is $0$: the quantity is momentarily not changing.' },
      { front: 'Does a longer interval give the rate at a point?', back: 'No. It gives an average. Use shrinking intervals to approach the rate at a point.' }
    ],
    mistakes: [
      { wrong: 'The rate of change at $x=2$ of $y=x^2$ is $y(2)=4$.', right: 'The value of $y$ is not a rate. The tangent gradient at $x=2$ is $4$ only by coincidence; at $x=1$ the value is $1$ but the rate is $2$.' },
      { wrong: 'Average rate $=\\dfrac{f(a)-f(b)}{b-a}$.', right: 'Subtract in the same order on top and bottom: $\\dfrac{f(b)-f(a)}{b-a}$. Otherwise the sign is wrong.' }
    ],
    examples: [
      {
        question: 'Find the average rate of change of $y=x^2$ between $x=1$ and $x=3$.',
        steps: ['$f(1)=1$ and $f(3)=9$.', '$\\dfrac{9-1}{3-1}=\\dfrac{8}{2}=4$.'],
        answer: '$4$',
        verify: { kind: 'value', expr: '(3^2-1^2)/(3-1)', answer: '4' }
      },
      {
        question: 'Estimate the gradient of $y=x^2$ at $x=1$ using the intervals $[1,1.1]$ and $[1,1.01]$.',
        steps: ['On $[1,1.1]$: $\\dfrac{1.21-1}{0.1}=2.1$.', 'On $[1,1.01]$: $\\dfrac{1.0201-1}{0.01}=2.01$.', 'The averages are approaching $2$, so the gradient at $x=1$ is about $2$.'],
        answer: 'About $2$',
        verify: { kind: 'values', pairs: [['(1.1^2-1)/0.1', '2.1'], ['(1.01^2-1)/0.01', '2.01']] }
      },
      {
        question: 'A culture of bacteria has $N=100\\times2^t$ cells after $t$ hours. Find the average rate of growth between $t=1$ and $t=3$.',
        steps: ['$N(1)=200$ and $N(3)=800$.', '$\\dfrac{800-200}{3-1}=300$ cells per hour.'],
        answer: '$300$ cells per hour',
        verify: { kind: 'value', expr: '(100*2^3-100*2^1)/(3-1)', answer: '300' }
      }
    ]
  },

  'ma5-trg-p-01': {
    summary: 'The sine rule, the cosine rule and the area formula extend trigonometry from right-angled triangles to any triangle. Choosing the right rule for the information you are given is the main skill.',
    prereqs: ['ma5-trg-c-01'],
    concepts: [
      { title: 'The sine rule', body: 'In a triangle with sides $a,b,c$ opposite angles $A,B,C$, the ratio of a side to the sine of its opposite angle is the same for all three. Use it when you know a side and its opposite angle plus one more side or angle.' },
      { title: 'The cosine rule', body: 'It is Pythagoras with a correction term: $c^2=a^2+b^2-2ab\\cos C$. Use it for two sides and the angle between them, or for all three sides to find an angle. When $C=90^\\circ$ the correction is $0$.' },
      { title: 'Area from two sides and the angle between them', body: 'The area is half the product of two sides and the sine of the angle between them: $\\tfrac12ab\\sin C$. No height is needed.' }
    ],
    definitions: [
      { term: 'Included angle', meaning: 'The angle between two given sides of a triangle. The area formula and the cosine rule for a side both need it.' },
      { term: 'Ambiguous case', meaning: 'Given two sides and an angle not between them, there can be two possible triangles, because an angle and its supplement have the same sine.' }
    ],
    formulas: [
      { label: 'Sine rule', tex: '\\frac{a}{\\sin A}=\\frac{b}{\\sin B}=\\frac{c}{\\sin C}' },
      { label: 'Cosine rule', tex: 'c^2=a^2+b^2-2ab\\cos C\\qquad\\cos C=\\frac{a^2+b^2-c^2}{2ab}' },
      { label: 'Area of a triangle', tex: 'A=\\tfrac12ab\\sin C' }
    ],
    points: [
      { front: 'Given two sides and the included angle, which rule finds the third side?', back: 'The cosine rule.' },
      { front: 'Given two angles and a side, which rule?', back: 'The sine rule. The third angle comes from the angle sum, $180^\\circ$.' },
      { front: 'Given three sides, how do you find an angle?', back: 'Rearrange the cosine rule for $\\cos C$, then use the inverse cosine.' },
      { front: 'Is the sine rule enough for the largest angle when it might be obtuse?', back: 'No. Sine cannot tell $\\theta$ from $180^\\circ-\\theta$; the cosine rule can.' }
    ],
    mistakes: [
      { wrong: 'With $a=7$, $b=9$ and $C=60^\\circ$: $c^2=(7+9)^2-2\\times7\\times9\\cos60^\\circ$.', right: 'Square $a$ and $b$ separately: $c^2=49+81-2\\times7\\times9\\times\\cos60^\\circ=130-63=67$.' },
      { wrong: 'Area $=\\tfrac12ac\\sin C$, using $a$ and $c$ with the angle $C$.', right: 'The angle must lie between the two sides used. Pair $a$ and $b$ with $C$, or $a$ and $c$ with $B$.' }
    ],
    examples: [
      {
        question: 'In a triangle, $a=7$, $b=9$ and the angle between them is $C=60^\\circ$. Find $c$.',
        steps: ['Cosine rule: $c^2=7^2+9^2-2\\times7\\times9\\times\\cos60^\\circ$.', '$c^2=49+81-126\\times\\tfrac12=130-63=67$.', '$c=\\sqrt{67}\\approx8.19$.'],
        answer: '$c=\\sqrt{67}\\approx8.19$',
        verify: { kind: 'value', expr: 'sqrt(7^2+9^2-2*7*9*cos(60*pi/180))', answer: 'sqrt(67)' }
      },
      {
        question: 'In a triangle $A=30^\\circ$, $B=45^\\circ$ and $a=10$. Find $b$.',
        steps: ['Sine rule: $\\dfrac{b}{\\sin45^\\circ}=\\dfrac{10}{\\sin30^\\circ}$.', '$b=\\dfrac{10\\sin45^\\circ}{\\sin30^\\circ}=\\dfrac{10\\times\\frac{\\sqrt2}{2}}{\\frac12}=10\\sqrt2$.', '$b\\approx14.14$.'],
        answer: '$b=10\\sqrt2\\approx14.14$',
        verify: { kind: 'value', expr: '10*sin(45*pi/180)/sin(30*pi/180)', answer: '10*sqrt(2)' }
      },
      {
        question: 'A triangle has sides $a=7$, $b=5$ and $c=8$. Find the angle $A$ opposite the side of length $7$.',
        steps: ['Rearrange the cosine rule: $\\cos A=\\dfrac{b^2+c^2-a^2}{2bc}=\\dfrac{25+64-49}{80}$.', '$\\cos A=\\dfrac{40}{80}=\\tfrac12$.', '$A=\\cos^{-1}\\left(\\tfrac12\\right)=60^\\circ$.'],
        answer: '$A=60^\\circ$',
        verify: { kind: 'value', expr: 'arccos((5^2+8^2-7^2)/(2*5*8))*180/pi', answer: '60' }
      }
    ]
  },

  'ma5-trg-p-02': {
    summary: 'Trigonometric ratios are defined for every angle by reading coordinates off the unit circle. That gives the sign in each quadrant, exact values by reference angles, the graph of sine, and the identities that link sine, cosine and tangent.',
    prereqs: ['ma5-trg-p-01', 'ma5-trg-c-02'],
    concepts: [
      { title: 'The unit circle', body: 'Turn an angle $\\theta$ anticlockwise from the positive $x$-axis on a circle of radius $1$. The point reached is $(\\cos\\theta,\\sin\\theta)$, and $\\tan\\theta=\\dfrac{\\sin\\theta}{\\cos\\theta}$. This works for any angle, including obtuse and reflex angles.' },
      { title: 'Quadrants and reference angles', body: 'Sine is positive in the first and second quadrants, cosine in the first and fourth, tangent in the first and third. The size of each ratio comes from the acute reference angle: $\\sin150^\\circ=\\sin30^\\circ$ and $\\cos240^\\circ=-\\cos60^\\circ$. Note $\\sin(180^\\circ-\\theta)=\\sin\\theta$.' },
      { title: 'Identities and equations', body: 'Because the point lies on the unit circle, $\\sin^2\\theta+\\cos^2\\theta=1$. Given one ratio you can find the others, with the sign taken from the quadrant. A simple equation such as $\\sin\\theta=k$ has a solution in each quadrant where sine has the right sign, so list all solutions between $0^\\circ$ and $360^\\circ$.' }
    ],
    definitions: [
      { term: 'Reference angle', meaning: 'The acute angle between the terminal arm and the $x$-axis. It decides the size of the ratio; the quadrant decides the sign.' },
      { term: 'Identity', meaning: 'An equation true for every value of the variable, such as $\\sin^2\\theta+\\cos^2\\theta=1$.' }
    ],
    formulas: [
      { label: 'Coordinates on the unit circle', tex: '(x,y)=(\\cos\\theta,\\ \\sin\\theta)' },
      { label: 'Pythagorean identity', tex: '\\sin^2\\theta+\\cos^2\\theta=1' },
      { label: 'Tangent', tex: '\\tan\\theta=\\frac{\\sin\\theta}{\\cos\\theta}' }
    ],
    points: [
      { front: '$\\sin30^\\circ,\\ \\cos60^\\circ$', back: 'Both are $\\tfrac12$.' },
      { front: '$\\sin\\theta=\\tfrac35$ with $\\theta$ acute. Find $\\cos\\theta$.', back: '$\\sqrt{1-\\tfrac{9}{25}}=\\tfrac45$.' },
      { front: 'The sign of $\\cos\\theta$ in the second quadrant', back: 'Negative, because the $x$-coordinate is to the left of the origin.' },
      { front: 'Two angles in $0^\\circ$ to $360^\\circ$ with the same sine', back: '$\\theta$ and $180^\\circ-\\theta$.' }
    ],
    mistakes: [
      { wrong: '$\\sin\\theta=\\tfrac12$ means $\\theta=30^\\circ$ only.', right: 'Sine is also positive in the second quadrant: $\\theta=30^\\circ$ or $150^\\circ$ between $0^\\circ$ and $360^\\circ$.' },
      { wrong: '$\\cos150^\\circ=\\cos30^\\circ=\\tfrac{\\sqrt3}{2}$.', right: 'The reference angle is $30^\\circ$, but cosine is negative in the second quadrant: $\\cos150^\\circ=-\\tfrac{\\sqrt3}{2}$.' }
    ],
    examples: [
      {
        question: 'Find the exact values of $\\sin150^\\circ$ and $\\cos240^\\circ$.',
        steps: ['$150^\\circ$ is in the second quadrant with reference angle $30^\\circ$. Sine is positive there, so $\\sin150^\\circ=\\sin30^\\circ=\\tfrac12$.', '$240^\\circ$ is in the third quadrant with reference angle $60^\\circ$. Cosine is negative there, so $\\cos240^\\circ=-\\cos60^\\circ=-\\tfrac12$.'],
        answer: '$\\tfrac12$ and $-\\tfrac12$',
        verify: { kind: 'values', pairs: [['sin(150*pi/180)', '1/2'], ['cos(240*pi/180)', '-1/2']] }
      },
      {
        question: 'Solve $2\\sin\\theta=\\sqrt3$ for $0^\\circ\\le\\theta\\le360^\\circ$.',
        steps: ['$\\sin\\theta=\\tfrac{\\sqrt3}{2}$, which has reference angle $60^\\circ$.', 'Sine is positive in the first and second quadrants: $\\theta=60^\\circ$ or $\\theta=180^\\circ-60^\\circ=120^\\circ$.'],
        answer: '$\\theta=60^\\circ$ or $120^\\circ$',
        verify: { kind: 'values', pairs: [['2*sin(60*pi/180)', 'sqrt(3)'], ['2*sin(120*pi/180)', 'sqrt(3)']] }
      },
      {
        question: 'Given $\\sin\\theta=\\tfrac35$ with $\\theta$ obtuse, find $\\cos\\theta$ and $\\tan\\theta$.',
        steps: ['$\\cos^2\\theta=1-\\tfrac{9}{25}=\\tfrac{16}{25}$, so $\\cos\\theta=\\pm\\tfrac45$.', 'An obtuse angle is in the second quadrant, where cosine is negative: $\\cos\\theta=-\\tfrac45$.', '$\\tan\\theta=\\dfrac{3/5}{-4/5}=-\\tfrac34$.'],
        answer: '$\\cos\\theta=-\\tfrac45$ and $\\tan\\theta=-\\tfrac34$',
        verify: { kind: 'values', pairs: [['(3/5)^2+(4/5)^2', '1'], ['(3/5)/(-4/5)', '-3/4']] }
      }
    ]
  },

  'ma5-vol-p-01': {
    summary: 'Pyramids, cones and spheres have volumes that come from the same idea: a pointed solid holds one third of the prism or cylinder with the same base and height, and a sphere depends only on its radius. Composite solids are built by adding or subtracting these.',
    prereqs: ['ma5-vol-c-01'],
    concepts: [
      { title: 'Pyramids and cones', body: 'A pyramid or cone has one third of the volume of the prism or cylinder with the same base and the same perpendicular height. For a cone, $V=\\tfrac13\\pi r^2h$; for a pyramid, $V=\\tfrac13Ah$ with $A$ the base area.' },
      { title: 'Spheres and hemispheres', body: 'A sphere of radius $r$ has volume $\\tfrac43\\pi r^3$ and surface area $4\\pi r^2$. A hemisphere is half a sphere, so its volume is $\\tfrac23\\pi r^3$.' },
      { title: 'Composite solids', body: 'Split the solid into pieces whose volumes you know, find each, then add them, or subtract if a piece is removed. Keep all lengths in the same unit before you start, and give volume in cubic units.' }
    ],
    definitions: [
      { term: 'Perpendicular height', meaning: 'The height measured at right angles to the base, not along a sloping face or edge.' },
      { term: 'Capacity', meaning: 'The volume a container holds. One cubic centimetre holds one millilitre, and $1000\\ \\text{cm}^3$ is one litre.' }
    ],
    formulas: [
      { label: 'Pyramid', tex: 'V=\\tfrac13\\,A\\,h' },
      { label: 'Cone', tex: 'V=\\tfrac13\\pi r^2h' },
      { label: 'Sphere', tex: 'V=\\tfrac43\\pi r^3' }
    ],
    points: [
      { front: 'A cone and a cylinder share a base and height. Volume ratio?', back: 'The cone is $\\tfrac13$ of the cylinder.' },
      { front: 'Volume of a hemisphere of radius $r$', back: '$\\tfrac23\\pi r^3$.' },
      { front: 'What happens to the volume of a sphere if its radius doubles?', back: 'It is multiplied by $2^3=8$.' },
      { front: 'Convert $2500\\ \\text{cm}^3$ to litres', back: '$2.5$ litres.' }
    ],
    mistakes: [
      { wrong: 'Using the slant height of a cone in $\\tfrac13\\pi r^2h$.', right: 'The formula needs the perpendicular height. If the slant height $s$ is given, find $h=\\sqrt{s^2-r^2}$ first.' },
      { wrong: 'Volume of a sphere of radius $6$: $\\tfrac43\\pi\\times6\\times3=24\\pi$ (cubing as multiplying by $3$).', right: 'Cube the radius: $6^3=216$, so $V=\\tfrac43\\pi\\times216=288\\pi$.' }
    ],
    examples: [
      {
        question: 'Find the exact volume of a cone with radius $3$ cm and perpendicular height $4$ cm.',
        steps: ['$V=\\tfrac13\\pi r^2h=\\tfrac13\\pi\\times9\\times4$.', '$V=12\\pi\\ \\text{cm}^3\\approx37.7\\ \\text{cm}^3$.'],
        answer: '$12\\pi\\ \\text{cm}^3$',
        verify: { kind: 'value', expr: '1/3*pi*3^2*4', answer: '12*pi' }
      },
      {
        question: 'A square pyramid has a base of side $6$ m and perpendicular height $5$ m. Find its volume.',
        steps: ['The base area is $6\\times6=36\\ \\text{m}^2$.', '$V=\\tfrac13\\times36\\times5=60\\ \\text{m}^3$.'],
        answer: '$60\\ \\text{m}^3$',
        verify: { kind: 'value', expr: '1/3*6^2*5', answer: '60' }
      },
      {
        question: 'A silo is a cylinder of radius $2$ m and height $5$ m, topped by a hemisphere of radius $2$ m. Find its volume in exact form.',
        steps: ['Cylinder: $\\pi r^2h=\\pi\\times4\\times5=20\\pi$.', 'Hemisphere: $\\tfrac23\\pi r^3=\\tfrac23\\pi\\times8=\\tfrac{16}{3}\\pi$.', 'Total: $20\\pi+\\tfrac{16}{3}\\pi=\\tfrac{76}{3}\\pi\\ \\text{m}^3\\approx79.6\\ \\text{m}^3$.'],
        answer: '$\\tfrac{76}{3}\\pi\\ \\text{m}^3$',
        verify: { kind: 'value', expr: 'pi*2^2*5+2/3*pi*2^3', answer: '76*pi/3' }
      }
    ]
  }
};
