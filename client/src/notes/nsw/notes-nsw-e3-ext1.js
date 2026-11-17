// Pri Learning · NSW Notes · Experience 3 layer (ext1), see notes/e3.js. Original writing, en-AU.
// Mathematics Extension 1, Years 11 and 12. Every number in a note below is computed (engine or exact arithmetic),
// and each diagram uses the numbers of the chapter's own examples.
export default {
  'me1-11-01': {
    objective: 'Find the inverse of a function on a suitable domain, convert a parametric curve to Cartesian form, and solve inequalities with the unknown in a denominator.',
    intuition: 'An inverse function runs the machine backwards, which is only possible if no two inputs share an output; otherwise the reverse machine would not know which input to give back. Swapping $x$ and $y$ in the equation is the same as reflecting the graph in $y=x$. A parametric curve tracks a moving point with $t$ as the clock, and eliminating $t$ leaves the path without the timing. A fraction can change sign only where its numerator or its denominator is zero, so those values cut the number line into intervals you can test one at a time.',
    diagrams: [
      {
        title: 'Solving $\\tfrac{x+1}{x-2}>k$ from the graph',
        spec: {
          kind: 'paramGraph', expr: '(x+1)/(x-2)-k',
          params: [{ name: 'k', min: -3, max: 5, step: 1, initial: 2 }],
          xmin: -6, xmax: 12, ymin: -8, ymax: 8, show: ['roots', 'asymptotes']
        },
        note: 'This is $y=\\tfrac{x+1}{x-2}-k$. At $k=2$ it crosses the $x$-axis at $x=5$, has its vertical asymptote at $x=2$, and is positive only between them, so $\\tfrac{x+1}{x-2}>2$ exactly when $2<x<5$. Change $k$: the zero moves (to $x=3.5$ at $k=3$, to $x=-1$ at $k=0$) but the asymptote stays at $x=2$, and the answer is always read from those two critical values.'
      }
    ]
  },
  'me1-11-02': {
    objective: 'Use the remainder and factor theorems to divide and factorise polynomials, and use the sums and products of the zeroes to evaluate symmetric expressions without solving.',
    intuition: 'Write $P(x)=(x-a)Q(x)+R$ and put $x=a$: the bracket wipes out everything except the remainder. That is the whole remainder theorem, and it says the remainder is the height of the graph at $x=a$. So $x-a$ is a factor exactly when the graph passes through $(a,0)$. Multiplying out $a(x-\\alpha)(x-\\beta)(x-\\gamma)$ shows that every coefficient is built from the zeroes, which is why their sums and products can be read off without finding the zeroes themselves.',
    diagrams: [
      {
        title: 'The remainder on division by $x+1$ is the height at $x=-1$',
        spec: {
          kind: 'paramGraph', expr: 'x^3+k*x^2-4*x-2',
          params: [{ name: 'k', min: -3, max: 3, step: 1, initial: -1 }],
          xmin: -4, xmax: 4, ymin: -15, ymax: 15, show: ['roots']
        },
        note: 'For $P(x)=x^3+kx^2-4x-2$ the height at $x=-1$ is $P(-1)=k+1$, the remainder on dividing by $x+1$. Only at $k=-1$ does the curve pass through $(-1,0)$, so only then is $x+1$ a factor: $P(x)=(x+1)(x^2-2x-2)$, and the other zeroes are $1\\pm\\sqrt3$, about $2.73$ and $-0.73$.'
      }
    ]
  },
  'me1-11-03': {
    objective: 'Solve three-dimensional problems with right-angled triangles, use the compound-angle, double-angle and $t$-formulas to find exact values and prove identities, and solve trigonometric equations in a given interval.',
    intuition: 'Every three-dimensional problem is solved in a flat triangle; the skill is finding the right triangle inside the solid and drawing it on its own. The compound-angle formulas come from turning a point on the unit circle through $A$ and then through $B$, and the rest follow from them: put $B=A$ for the double angles, and write each ratio in terms of $t=\\tan\\tfrac\\theta2$ to turn an equation into algebra. Before solving an equation, reduce it to one ratio of one angle; only then do a single reference angle and the symmetry of the circle give every solution.',
    diagrams: [
      {
        title: 'Two waves that add to one',
        spec: {
          kind: 'paramGraph', expr: 'a*sin(x)+b*cos(x)',
          params: [
            { name: 'a', min: -5, max: 5, step: 1, initial: 3 },
            { name: 'b', min: -5, max: 5, step: 1, initial: 4 }
          ],
          xmin: -1, xmax: 7, ymin: -8, ymax: 8, show: ['turning']
        },
        note: 'With $a=3$ and $b=4$ the sum $3\\sin x+4\\cos x$ is a single sine wave of amplitude $\\sqrt{3^2+4^2}=5$, with its maximum $5$ at $x\\approx0.64$, where $\\tan x=\\tfrac34$. The compound-angle formula explains it: $R\\sin(x+\\alpha)=R\\cos\\alpha\\sin x+R\\sin\\alpha\\cos x$, so $R\\cos\\alpha=3$ and $R\\sin\\alpha=4$ give $R=5$. Change $a$ and $b$ and the amplitude is always $\\sqrt{a^2+b^2}$.'
      }
    ]
  },
  'me1-11-04': {
    objective: 'Count arrangements and selections with the multiplication principle, ${}^nP_r$ and ${}^nC_r$, including identical objects, restrictions, complements and arrangements in a circle.',
    intuition: 'Every count starts from the multiplication principle: make the choices one at a time and multiply the number of options at each step, which is the same as counting the ends of a tree. A permutation counts ordered results, so ABC and CBA are different. A combination ignores order; each group of $3$ objects can be put in order in $3\\times2\\times1=6$ ways, so dividing the ordered count by $6$ counts the groups. When some objects are identical, swapping them creates nothing new, so you divide by the number of such swaps.',
    diagrams: [
      {
        title: 'Arranging the letters A, B and C',
        spec: {
          kind: 'tree',
          branches: [
            { label: 'A', p: [1, 3], children: [{ label: 'B', p: [1, 2], children: [{ label: 'C', p: [1, 1] }] }, { label: 'C', p: [1, 2], children: [{ label: 'B', p: [1, 1] }] }] },
            { label: 'B', p: [1, 3], children: [{ label: 'A', p: [1, 2], children: [{ label: 'C', p: [1, 1] }] }, { label: 'C', p: [1, 2], children: [{ label: 'A', p: [1, 1] }] }] },
            { label: 'C', p: [1, 3], children: [{ label: 'A', p: [1, 2], children: [{ label: 'B', p: [1, 1] }] }, { label: 'B', p: [1, 2], children: [{ label: 'A', p: [1, 1] }] }] }
          ]
        },
        note: 'Three choices for the first letter, then two, then one: the tree has $3\\times2\\times1=6$ ends, one for each of ABC, ACB, BAC, BCA, CAB and CBA. Each end has probability $\\tfrac13\\times\\tfrac12\\times1=\\tfrac16$ when the order is random.'
      },
      {
        title: 'The committee count in Pascal\'s triangle',
        spec: { kind: 'pascal', rows: 8, highlight: [[7, 3], [5, 2]], show: 'values' },
        note: 'A committee of $3$ men from $7$ and $2$ women from $5$ uses ${}^7C_3=35$ and ${}^5C_2=10$, so there are $35\\times10=350$ committees. Each row reads the same from both ends because ${}^nC_r={}^nC_{n-r}$: choosing $3$ men to take is choosing $4$ to leave out.'
      }
    ],
    interactiveNone: 'Counting here is exact reasoning about discrete choices. No quantity varies smoothly, so a slider would only replay the tree and Pascal\'s triangle without showing anything they do not.'
  },
  'me1-11-05': {
    objective: 'Expand $(a+b)^n$ with the binomial theorem, find a given coefficient or the term independent of $x$ from the general term, and use Pascal\'s triangle and ${}^nC_k={}^{n-1}C_{k-1}+{}^{n-1}C_k$.',
    intuition: 'Multiplying out $(a+b)^5$ means picking $a$ or $b$ from each of the five brackets and multiplying the picks. Every way of picking $b$ exactly twice gives $a^3b^2$, and there are ${}^5C_2=10$ such ways, so the coefficient of $a^3b^2$ is $10$. Pascal\'s triangle builds the same numbers by adding: a choice of $k$ brackets either includes the last bracket or it does not, which splits ${}^nC_k$ into the two numbers above it.',
    diagrams: [
      {
        title: 'Row $5$ of Pascal\'s triangle',
        spec: { kind: 'pascal', rows: 6, highlight: [[5, 2], [4, 1], [4, 2]], show: 'values' },
        note: 'Row $5$ reads $1,5,10,10,5,1$, the coefficients of $(a+b)^5$. The highlighted ${}^5C_2=10$ is the sum of the two entries above it, ${}^4C_1=4$ and ${}^4C_2=6$.'
      },
      {
        title: 'The binomial coefficients as probabilities',
        spec: { kind: 'binomialExplorer', n: 5, p: 0.5 },
        note: 'With $p=\\tfrac12$ every sequence of five trials is equally likely, so each probability is a row-$5$ coefficient over $2^5=32$: $\\tfrac1{32},\\tfrac5{32},\\tfrac{10}{32},\\tfrac{10}{32},\\tfrac5{32},\\tfrac1{32}$. Change $n$ and the bars follow another row of Pascal\'s triangle; change $p$ and the terms of $(q+p)^n$ are weighted by powers of $p$ and $q$, so the symmetry is lost.'
      }
    ]
  },
  'me1-12-01': {
    objective: 'Prove that a statement holds for every integer from a starting value onwards by mathematical induction, for series, divisibility and inequality results.',
    intuition: 'Picture an endless row of dominoes. If the first one falls, and every domino that falls knocks over the next, then all of them fall, without anyone watching each one. Induction proves exactly those two facts: the basis case is the first domino, and the inductive step shows that $P(k)$ being true forces $P(k+1)$ to be true. The step is a conditional, so you assume $P(k)$ only to see what follows from it; you are not assuming the result you want to prove.',
    diagrams: [
      {
        title: 'Odd numbers build squares',
        spec: {
          kind: 'plane', xmin: -1, xmax: 5, ymin: -1, ymax: 5, axes: false, grid: true,
          polygons: [
            { points: [[0, 0], [1, 0], [1, 1], [0, 1]], shade: true },
            { points: [[1, 0], [2, 0], [2, 2], [0, 2], [0, 1], [1, 1]], shade: false },
            { points: [[2, 0], [3, 0], [3, 3], [0, 3], [0, 2], [2, 2]], shade: true },
            { points: [[3, 0], [4, 0], [4, 4], [0, 4], [0, 3], [3, 3]], shade: false }
          ],
          points: [
            { x: 0.5, y: 0.5, label: '1' },
            { x: 1.5, y: 1.5, label: '3' },
            { x: 2.5, y: 2.5, label: '5' },
            { x: 3.5, y: 3.5, label: '7' }
          ]
        },
        note: 'The odd numbers $1,3,5,7$ are L-shaped layers. The layer $2k+1$ wraps a $k$ by $k$ square into a $k+1$ by $k+1$ square, because $k^2+(2k+1)=(k+1)^2$. That one fact is the inductive step: if the first $k$ odd numbers add to $k^2$, adding the next one gives $(k+1)^2$.'
      },
      {
        title: 'Checking cases is not a proof',
        spec: { kind: 'sequenceExplorer', type: 'arithmetic', first: 1, step: 2, n: 4 },
        note: 'The terms are the odd numbers $1,3,5,7,\\ldots$ and the partial sums are $1,4,9,16,\\ldots$ Raise $n$ and $S_n$ is always the perfect square $n^2$. Cases like these suggest the formula; only the inductive proof shows it holds for every $n$.'
      }
    ]
  },
  'me1-12-02': {
    objective: 'Add, subtract and scale vectors in component form, use the dot product to find angles and projections and to test for perpendicular vectors, and model projectile motion with position vectors.',
    intuition: 'A vector is an instruction to move: this far, in this direction. Adding vectors means following one instruction and then the other, which is why components simply add. The dot product measures how much two vectors point the same way: it equals $|\\mathbf{a}||\\mathbf{b}|$ when they are parallel, zero when they are at right angles, and is negative when they point apart. A projectile is two motions that ignore each other, steady speed sideways and constant acceleration downwards, and the position vector puts them back together.',
    diagrams: [
      {
        title: 'When the dot product is zero',
        spec: { kind: 'vectorExplorer', a: [2, 3], b: [3, -2], mode: 'dot' },
        note: 'With $\\mathbf{a}=2\\mathbf{i}+3\\mathbf{j}$ and $\\mathbf{b}=3\\mathbf{i}-2\\mathbf{j}$, which is half of $6\\mathbf{i}-4\\mathbf{j}$ and points the same way, the dot product is $2\\times3+3\\times(-2)=0$, so the vectors are perpendicular; this is $k=2$ in the example. Move $\\mathbf{a}$: the dot product is positive while the angle between the vectors is acute and negative once it is obtuse.'
      }
    ]
  },
  'me1-12-03': {
    objective: 'State the domain and range of $\\sin^{-1}x$, $\\cos^{-1}x$ and $\\tan^{-1}x$, sketch their graphs, and evaluate exact values and compositions such as $\\sin^{-1}(\\sin x)$.',
    intuition: 'Ask which angle has sine $\\tfrac12$ and there are infinitely many answers: $\\tfrac\\pi6$, $\\tfrac{5\\pi}6$, and each of those plus any multiple of $2\\pi$. A function must give one answer, so $\\sin^{-1}$ agrees in advance to answer only from $\\left[-\\tfrac\\pi2,\\tfrac\\pi2\\right]$, the stretch where sine takes every value from $-1$ to $1$ exactly once. Cosine needs a different stretch, $[0,\\pi]$, because it repeats values on $\\left[-\\tfrac\\pi2,\\tfrac\\pi2\\right]$. Most errors with these functions come from forgetting which stretch the answer must lie in.',
    diagrams: [
      {
        title: 'Which angle does $\\sin^{-1}$ return?',
        spec: { kind: 'unitCircleDrag', initial: 240 },
        note: 'At $240^\\circ$, which is $\\tfrac{4\\pi}3$, the sine is $-\\tfrac{\\sqrt3}2\\approx-0.866$. Drag the point to $300^\\circ$, the same as $-60^\\circ$, and the sine is the same. Of all the angles with this sine, only $-\\tfrac\\pi3$ lies in $\\left[-\\tfrac\\pi2,\\tfrac\\pi2\\right]$, so $\\sin^{-1}\\left(\\sin\\tfrac{4\\pi}3\\right)=-\\tfrac\\pi3$.'
      }
    ]
  },
  'me1-12-04': {
    objective: 'Differentiate inverse trigonometric functions, integrate expressions that give $\\sin^{-1}$ and $\\tan^{-1}$, and evaluate integrals by substitution and with the identities for $\\sin^2x$ and $\\cos^2x$.',
    intuition: 'If $y=\\sin^{-1}x$ then $\\sin y=x$, and differentiating that with the chain rule gives $\\cos y\\,\\tfrac{dy}{dx}=1$; a right-angled triangle with opposite side $x$ and hypotenuse $1$ shows $\\cos y=\\sqrt{1-x^2}$. So each inverse trigonometric derivative is a statement about a triangle. Substitution is the chain rule read backwards: when an integrand contains a function and its derivative, as $x(x^2+1)^3$ contains $x^2+1$ and $2x$, renaming the inner function leaves a power you can integrate.',
    diagrams: [
      {
        title: 'Rectangles under $y=\\tfrac1{9+x^2}$',
        spec: { kind: 'riemannSlider', expr: '1/(9+x^2)', a: 0, b: 3, initialN: 4 },
        note: 'The area under $y=\\tfrac1{9+x^2}$ from $0$ to $3$ is $\\tfrac13\\tan^{-1}1=\\tfrac\\pi{12}\\approx0.2618$. Add rectangles and their total closes in on that value, the same number the antiderivative gives in one line.'
      }
    ]
  },
  'me1-12-05': {
    objective: 'Use multiplicity to describe how a polynomial meets the $x$-axis, find areas between curves and volumes of solids of revolution, and solve and apply $\\tfrac{dN}{dt}=k(N-P)$.',
    intuition: 'A solid of revolution is a stack of coins: slice it at right angles to the axis, and each slice is a disc of radius $y$ and thickness $dx$, with volume $\\pi y^2\\,dx$. Adding the coins is the integral, which is why $y$ is squared. Newton\'s law of cooling says the gap to room temperature, not the temperature itself, shrinks at a rate proportional to its size. So the gap decays exponentially, halving in equal times, while the temperature only ever approaches that of the room.',
    diagrams: [
      {
        title: 'Every cup ends at room temperature',
        spec: { kind: 'slopeFieldExplorer', dydx: '(20-y)*ln(2)/5', xmin: 0, xmax: 30, ymin: 0, ymax: 100, through: [[0, 90]] },
        note: 'Each dash has gradient $k(20-T)$ with $k=\\tfrac{\\ln2}{5}$: steep far above $20$, flat at $20$. Start the tea at $90^\\circ\\text{C}$ and the curve passes $55^\\circ\\text{C}$ at $t=5$ and $37.5^\\circ\\text{C}$ at $t=10$. Move the starting point, even below room temperature, and every curve still approaches $T=20$.'
      }
    ]
  },
  'me1-12-06': {
    objective: 'Recognise a binomial situation, find binomial probabilities with their mean and variance, and use the distribution of the sample mean, with standard deviation $\\tfrac{\\sigma}{\\sqrt n}$, to find approximate probabilities.',
    intuition: 'Each sequence of $n$ trials with exactly $r$ successes has probability $p^rq^{n-r}$, and there are ${}^nC_r$ such sequences, which is the whole binomial formula. A sample mean averages out chance: a high value in one place tends to be offset by a low one elsewhere, so the means of samples of size $n$ cluster around $\\mu$ with spread $\\tfrac{\\sigma}{\\sqrt n}$. Quadrupling the sample size only halves that spread, which is why precision is expensive.',
    diagrams: [
      {
        title: 'The shape of $\\text{Bin}(n,p)$',
        spec: { kind: 'binomialExplorer', n: 5, p: 0.4, highlight: [2] },
        note: 'For $X\\sim\\text{Bin}(5,0.4)$ the tallest bar is $P(X=2)=0.3456$, with $E(X)=np=2$ and $\\operatorname{Var}(X)=np(1-p)=1.2$. Raise $n$ and the bars spread out, and their outline looks more and more like a normal curve centred on $np$.'
      }
    ]
  }
};
