// Pri Learning · NSW Notes · Mathematics Extension 1, Year 12 (second half) · the premium layer.
//
// What sits beside notes-nsw-ext1-b.js for each topic, keyed by the same id:
//   examiners  what a marker looks for in a full-mark answer (short, specific)
//   diagrams   specs for diagrams/DiagramFromSpec, drawn from the SAME numbers as the text
//   working    one aligned display block per worked example, in the same order as `examples`
//   check      self-check questions; every answer is re-derived by the engine
// Original writing for Pri Learning; not an official NESA publication. en-AU spelling.
export default {
  'me1-12-01': {
    examiners: [
      'All four parts are present and labelled: basis case, assumption written as “assume true for $n=k$”, the step to $n=k+1$, and a closing sentence naming mathematical induction.',
      'The assumed result is visibly used in the step, with the line that replaces the sum or power by the assumption.',
      'The step ends on the exact statement $P(k+1)$, written out, rather than on a bare “which is what we wanted”.',
      'For an inequality the basis case is the correct starting value, and the reason the step inequality holds (here $k\\ge5$) is stated.'
    ],
    diagrams: [],
    working: [
      [
        { say: 'Basis case $n=1$:', tex: '\\text{LHS}&=1=1^2' },
        { say: 'Add the next term $2k+1$ to the assumption $P(k)$:', tex: '\\text{LHS of }P(k+1)&=\\left[1+3+\\cdots+(2k-1)\\right]+(2k+1)' },
        { tex: '&=k^2+2k+1' },
        { tex: '&=(k+1)^2' }
      ],
      [
        { say: 'Basis case $n=1$:', tex: '7^1-1&=6' },
        { say: 'Assume $7^k=6m+1$ and write $7^{k+1}$ in terms of $7^k$:', tex: '7^{k+1}-1&=7\\cdot7^k-1' },
        { tex: '&=7(6m+1)-1' },
        { tex: '&=42m+6=6(7m+1)' }
      ],
      [
        { say: 'Basis case $n=5$:', tex: '2^5&=32>25' },
        { say: 'Use the assumption $2^k>k^2$:', tex: '2^{k+1}&=2\\cdot2^k>2k^2' },
        { say: 'Show $2k^2>(k+1)^2$ for $k\\ge5$:', tex: '2k^2-(k+1)^2&=k^2-2k-1=(k-1)^2-2>0' },
        { say: 'Combine the two inequalities:', tex: '\\therefore\\ 2^{k+1}&>(k+1)^2' }
      ]
    ],
    check: [
      { question: 'In an induction proof of $1+2+\\cdots+n=\\tfrac{n(n+1)}2$, show that $\\tfrac{k(k+1)}2+(k+1)=\\tfrac{(k+1)(k+2)}2$.', answer: 'Factor out $(k+1)$: $(k+1)\\left(\\tfrac k2+1\\right)=\\tfrac{(k+1)(k+2)}2$.', verify: { kind: 'equivalent', a: 'k*(k+1)/2+(k+1)', b: '(k+1)*(k+2)/2' } },
      { question: 'Use the sum of squares formula to check the basis idea at $n=4$: find $1^2+2^2+3^2+4^2$.', answer: '$30$, and $\\tfrac{4\\cdot5\\cdot9}6=30$', verify: { kind: 'values', pairs: [['sum(k^2,k,1,4)', '30'], ['4*5*9/6', '30']] } },
      { question: 'What is the basis case value for $3^n-1$ being even?', answer: 'For $n=1$, $3^1-1=2$, which is even.', verify: { kind: 'value', expr: '3^1-1', answer: '2' } }
    ]
  },

  'me1-12-02': {
    examiners: [
      'Vector arithmetic is shown component by component, and a dot product is written as a sum of products before it is evaluated.',
      'The angle is found from $\\cos\\theta=\\tfrac{\\mathbf{a}\\cdot\\mathbf{b}}{|\\mathbf{a}||\\mathbf{b}|}$, and the sign of the dot product is checked against whether the angle should be acute or obtuse.',
      'Vectors are distinguished from numbers: bold or an arrow above the letter, and $\\overrightarrow{AB}$ for a displacement.',
      'In a projectile question the horizontal and vertical components are treated separately, the value of $g$ is stated, and the answer carries units.'
    ],
    diagrams: [
      { title: 'Adding two vectors', spec: { kind: 'vector', vectors: [{ label: '\\mathbf{a}', dx: 3, dy: 1 }, { label: '\\mathbf{b}', dx: 1, dy: 2 }], resultant: true }, note: 'Placing $\\mathbf{b}$ at the tip of $\\mathbf{a}=(3,1)$ gives the resultant $\\mathbf{a}+\\mathbf{b}=(4,3)$, whose magnitude is $\\sqrt{16+9}=5$.' },
      { title: 'The path of the projectile', spec: { kind: 'function', xmin: -2, xmax: 40, ymin: -2, ymax: 8, curves: [{ expr: 'x/sqrt(3)-x^2/60', intercepts: true, label: 'y=\\dfrac{x}{\\sqrt3}-\\dfrac{x^2}{60}' }] }, note: 'The ball launched at $20$ m/s and $30^\\circ$ travels along this parabola. It lands at $x=20\\sqrt3\\approx34.6$ m and peaks at $5$ m.' }
    ],
    working: [
      [
        { say: 'Magnitude of $\\mathbf{a}$:', tex: '|\\mathbf{a}|&=\\sqrt{4+1+4}=3' },
        { say: 'Magnitude of $\\mathbf{b}$:', tex: '|\\mathbf{b}|&=\\sqrt{1+4+4}=3' },
        { say: 'Dot product:', tex: '\\mathbf{a}\\cdot\\mathbf{b}&=2(1)+(-1)(2)+2(-2)=-4' },
        { say: 'Angle formula $\\cos\\theta=\\dfrac{\\mathbf{a}\\cdot\\mathbf{b}}{|\\mathbf{a}||\\mathbf{b}|}$:', tex: '\\cos\\theta&=\\dfrac{-4}{3\\times3}=-\\dfrac49' },
        { say: 'Angle, obtuse because the dot product is negative:', tex: '\\theta&\\approx116.4^\\circ' }
      ],
      [
        { say: 'Perpendicular vectors have dot product zero:', tex: '\\mathbf{a}\\cdot\\mathbf{b}&=6k+3(-4)=6k-12=0' },
        { say: 'Solve for $k$:', tex: 'k&=2' }
      ],
      [
        { say: 'Horizontal position:', tex: 'x&=20\\cos30^\\circ\\,t=10\\sqrt3\\,t' },
        { say: 'Vertical position:', tex: 'y&=20\\sin30^\\circ\\,t-5t^2=10t-5t^2' },
        { say: 'It lands when $y=0$:', tex: '10t-5t^2&=5t(2-t)=0' },
        { say: 'Time of flight:', tex: 't&=2' },
        { say: 'Range, using $t=2$:', tex: 'x&=10\\sqrt3\\times2=20\\sqrt3' },
        { tex: '&\\approx34.6' },
        { say: 'At the top the vertical velocity is zero:', tex: '10-10t&=0' },
        { say: 'Time at maximum height:', tex: 't&=1' },
        { say: 'Maximum height:', tex: 'y_{\\max}&=10(1)-5(1)^2=5' }
      ]
    ],
    check: [
      { question: 'Find $|3\\mathbf{i}-4\\mathbf{j}+12\\mathbf{k}|$.', answer: '$13$', verify: { kind: 'value', expr: 'sqrt(3^2+(-4)^2+12^2)', answer: '13' } },
      { question: 'Find $\\mathbf{a}\\cdot\\mathbf{b}$ for $\\mathbf{a}=2\\mathbf{i}-3\\mathbf{j}$ and $\\mathbf{b}=5\\mathbf{i}+4\\mathbf{j}$.', answer: '$-2$', verify: { kind: 'value', expr: '2*5+(-3)*4', answer: '-2' } },
      { question: 'A point $A$ has position vector $(1,2)$ and $B$ has $(4,6)$. Find $\\left|\\overrightarrow{AB}\\right|$.', answer: '$5$, since $\\overrightarrow{AB}=(3,4)$', verify: { kind: 'value', expr: 'sqrt((4-1)^2+(6-2)^2)', answer: '5' } }
    ]
  },

  'me1-12-03': {
    examiners: [
      'The range of the inverse function is stated or used: a value such as $\\sin^{-1}\\left(\\sin\\tfrac{4\\pi}3\\right)$ is brought into $\\left[-\\tfrac\\pi2,\\tfrac\\pi2\\right]$ and the reason is written.',
      'Exact answers are in terms of $\\pi$ rather than rounded decimals, unless the question asks for a decimal.',
      'A compound expression is solved with a labelled right-angled triangle or with $\\alpha$ and $\\beta$ defined, and the sign of each ratio is justified.',
      'Graphs show the end points, for example $\\left(1,\\tfrac\\pi2\\right)$ and $\\left(-1,-\\tfrac\\pi2\\right)$ for $\\sin^{-1}x$, and the horizontal asymptotes for $\\tan^{-1}x$.'
    ],
    diagrams: [
      { title: 'The graph of $y=\\sin^{-1}x$', spec: { kind: 'function', xmin: -1.6, xmax: 1.6, ymin: -2, ymax: 2, curves: [{ expr: 'asin(x)', label: 'y=\\sin^{-1}x' }], points: [{ x: 1, y: 1.5708, label: '\\left(1,\\tfrac{\\pi}{2}\\right)' }, { x: -1, y: -1.5708, label: '\\left(-1,-\\tfrac{\\pi}{2}\\right)' }] }, note: 'The domain is $[-1,1]$ and the range is $\\left[-\\tfrac\\pi2,\\tfrac\\pi2\\right]$. The curve is odd: it is unchanged by a half-turn about the origin.' },
      { title: 'The graph of $y=\\cos^{-1}x$', spec: { kind: 'function', xmin: -1.6, xmax: 1.6, ymin: -0.5, ymax: 3.6, curves: [{ expr: 'acos(x)', label: 'y=\\cos^{-1}x' }], points: [{ x: -1, y: 3.14159, label: '(-1,\\pi)' }, { x: 1, y: 0, label: '(1,0)' }, { x: 0, y: 1.5708, label: '\\left(0,\\tfrac{\\pi}{2}\\right)' }] }, note: 'The range is $[0,\\pi]$, and the curve passes through $\\left(0,\\tfrac\\pi2\\right)$ because $\\sin^{-1}x+\\cos^{-1}x=\\tfrac\\pi2$.' }
    ],
    working: [
      [
        { say: 'Let $y=\\cos^{-1}\\left(-\\dfrac{\\sqrt3}{2}\\right)$, with $y$ in $[0,\\pi]$:', tex: '\\cos y&=-\\dfrac{\\sqrt3}{2},\\quad0\\le y\\le\\pi' },
        { say: 'Cosine is negative in the second quadrant and the related acute angle is $\\dfrac\\pi6$:', tex: 'y&=\\pi-\\dfrac\\pi6=\\dfrac{5\\pi}{6}' }
      ],
      [
        { say: 'Evaluate the inner sine:', tex: '\\sin\\left(\\dfrac{4\\pi}{3}\\right)&=-\\sin\\left(\\dfrac\\pi3\\right)=-\\dfrac{\\sqrt3}{2}' },
        { say: 'Find the angle in $\\left[-\\dfrac\\pi2,\\dfrac\\pi2\\right]$ with that sine:', tex: '\\sin^{-1}\\left(-\\dfrac{\\sqrt3}{2}\\right)&=-\\dfrac\\pi3' }
      ],
      [
        { say: 'Let $\\alpha=\\sin^{-1}\\left(\\dfrac35\\right)$, an acute angle:', tex: '\\sin\\alpha&=\\dfrac35,\\quad\\cos\\alpha=\\dfrac45' },
        { say: 'Let $\\beta=\\cos^{-1}\\left(\\dfrac5{13}\\right)$, an acute angle:', tex: '\\cos\\beta&=\\dfrac5{13},\\quad\\sin\\beta=\\dfrac{12}{13}' },
        { say: 'Compound angle formula:', tex: '\\sin(\\alpha+\\beta)&=\\sin\\alpha\\cos\\beta+\\cos\\alpha\\sin\\beta' },
        { say: 'Substitute the ratios:', tex: '&=\\dfrac35\\cdot\\dfrac5{13}+\\dfrac45\\cdot\\dfrac{12}{13}' },
        { tex: '&=\\dfrac{15}{65}+\\dfrac{48}{65}=\\dfrac{63}{65}' }
      ]
    ],
    check: [
      { question: 'Find the exact value of $\\tan^{-1}(1)$.', answer: '$\\dfrac\\pi4$', verify: { kind: 'value', expr: 'atan(1)', answer: 'pi/4' } },
      { question: 'Find the exact value of $\\sin^{-1}\\left(-\\tfrac12\\right)$.', answer: '$-\\dfrac\\pi6$', verify: { kind: 'value', expr: 'asin(-1/2)', answer: '-pi/6' } },
      { question: 'Find the exact value of $\\cos\\left(\\sin^{-1}\\tfrac{5}{13}\\right)$.', answer: '$\\dfrac{12}{13}$', verify: { kind: 'value', expr: 'cos(asin(5/13))', answer: '12/13' } }
    ]
  },

  'me1-12-04': {
    examiners: [
      'The chain rule factor is present: $\\tfrac{d}{dx}\\tan^{-1}(3x)$ includes the factor $3$ from the inner function.',
      'The integrand is matched to a standard form with $a$ identified, and the $\\tfrac1a$ is written for the tangent form.',
      'In a substitution, $dx$ is replaced, the limits are converted to $u$-values, and the final answer is exact.',
      'Even powers of sine or cosine are rewritten with a double-angle identity before integrating.'
    ],
    diagrams: [
      { title: 'A function and its derivative', spec: { kind: 'function', xmin: -6, xmax: 6, ymin: -2, ymax: 2, curves: [{ expr: 'atan(x)', label: 'y=\\tan^{-1}x' }, { expr: '1/(1+x^2)', label: 'y=\\dfrac{1}{1+x^2}' }], asymptotes: [{ y: 1.5708, label: 'y=\\tfrac{\\pi}{2}' }, { y: -1.5708, label: 'y=-\\tfrac{\\pi}{2}' }] }, note: 'The derivative $\\tfrac1{1+x^2}$ equals $1$ at $x=0$, which is the steepest gradient of $\\tan^{-1}x$, and it shrinks to $0$ as the curve flattens towards its asymptotes.' }
    ],
    working: [
      [
        { say: 'Function:', tex: 'y&=\\tan^{-1}(3x)' },
        { say: 'Differentiate, using $\\dfrac{d}{dx}\\tan^{-1}u=\\dfrac1{1+u^2}\\cdot\\dfrac{du}{dx}$ with $u=3x$:', tex: '\\dfrac{dy}{dx}&=\\dfrac{3}{1+(3x)^2}=\\dfrac{3}{1+9x^2}' },
        { say: 'Gradient at $x=\\dfrac13$:', tex: '\\left.\\dfrac{dy}{dx}\\right|_{x=\\dfrac13}&=\\dfrac{3}{1+9\\left(\\dfrac13\\right)^2}=\\dfrac32' }
      ],
      [
        { say: 'Standard form $\\int\\dfrac{dx}{a^2+x^2}$ with $a=3$:', tex: '\\int_0^3\\dfrac{dx}{9+x^2}&=\\left[\\dfrac13\\tan^{-1}\\left(\\dfrac x3\\right)\\right]_0^3' },
        { say: 'Substitute the limits:', tex: '&=\\dfrac13\\cdot\\dfrac\\pi4-0=\\dfrac{\\pi}{12}' }
      ],
      [
        { say: 'Substitute $u=x^2+1$:', tex: 'du&=2x\\,dx' },
        { say: 'Change the limits:', tex: 'u&=1\\text{ when }x=0,\\quad u=2\\text{ when }x=1' },
        { say: 'Rewrite in terms of $u$, using $x\\,dx=\\dfrac12du$:', tex: '\\int_0^1x(x^2+1)^3\\,dx&=\\dfrac12\\int_1^2u^3\\,du' },
        { say: 'Integrate:', tex: '&=\\dfrac12\\left[\\dfrac{u^4}{4}\\right]_1^2' },
        { tex: '&=\\dfrac12\\cdot\\dfrac{16-1}{4}=\\dfrac{15}{8}' }
      ]
    ],
    check: [
      { question: 'Evaluate $\\displaystyle\\int_0^{\\pi/2}\\sin^2x\\,dx$.', answer: '$\\dfrac\\pi4$', verify: { kind: 'value', expr: '(pi/2)/2-(sin(pi)/4-0)', answer: 'pi/4' } },
      { question: 'Evaluate $\\displaystyle\\int_0^2\\frac{dx}{\\sqrt{4-x^2}}$.', answer: '$\\dfrac\\pi2$', verify: { kind: 'value', expr: 'asin(2/2)-asin(0)', answer: 'pi/2' } },
      { question: 'Find the gradient of $y=\\sin^{-1}(2x)$ at $x=0$.', answer: '$2$, since $\\tfrac{dy}{dx}=\\tfrac2{\\sqrt{1-4x^2}}$', verify: { kind: 'value', expr: '2/sqrt(1-4*0^2)', answer: '2' } }
    ]
  },

  'me1-12-05': {
    examiners: [
      'A double zero is justified with both $P(a)=0$ and $P\'(a)=0$, or by showing the squared factor.',
      'For an area between curves the intersection points are found and shown first, and the integrand is written as top minus bottom.',
      'A volume uses $\\pi\\int y^2\\,dx$ with the limits stated, and the answer is exact with “cubic units” or the stated units.',
      'A differential equation is solved in the context given: constants are found from the conditions, and the answer is interpreted with units.'
    ],
    diagrams: [
      { title: 'The area between a line and a parabola', spec: { kind: 'function', xmin: -2, xmax: 3, ymin: -1, ymax: 6, curves: [{ expr: 'x+2', label: 'y=x+2' }, { expr: 'x^2', label: 'y=x^2' }], points: [{ x: -1, y: 1 }, { x: 2, y: 4, label: '(2,4)' }] }, note: 'The curves meet where $x+2=x^2$, at $x=-1$ and $x=2$. Between them the line is above the parabola, and the enclosed area is $\\tfrac92$.' },
      { title: 'Tea cooling towards room temperature', spec: { kind: 'function', xmin: 0, xmax: 30, ymin: 0, ymax: 100, curves: [{ expr: '20+70*exp(-ln(2)/5*x)', label: 'T=20+70e^{-kt}' }], asymptotes: [{ y: 20, label: 'T=20' }], points: [{ x: 0, y: 90, label: '(0,90)' }, { x: 5, y: 55, label: '(5,55)' }, { x: 10, y: 37.5, label: '(10,37.5)' }] }, note: 'Every $5$ minutes the gap above $20^\\circ\\text{C}$ halves: $70$, $35$, then $17.5$, giving $90$, $55$, $37.5$.' }
    ],
    working: [
      [
        { say: 'Test $x=2$:', tex: 'P(2)&=8-12+4=0' },
        { say: 'Differentiate:', tex: 'P\'(x)&=3x^2-6x' },
        { say: 'The derivative is also zero at $x=2$, so the zero has multiplicity at least $2$:', tex: 'P\'(2)&=3(4)-6(2)=12-12=0' },
        { say: 'Divide $P(x)$ by $(x-2)^2$:', tex: 'P(x)&=(x-2)^2(x+1)' },
        { say: 'The zeros, listed with multiplicity:', tex: 'x&=2,\\ 2,\\ -1' }
      ],
      [
        { say: 'Volume of revolution about the $x$-axis, with $y^2=x$:', tex: 'V&=\\pi\\int_0^4y^2\\,dx=\\pi\\int_0^4x\\,dx' },
        { say: 'Integrate:', tex: '&=\\pi\\left[\\dfrac{x^2}{2}\\right]_0^4=8\\pi' }
      ],
      [
        { say: 'General solution:', tex: 'T&=20+Ae^{-kt}' },
        { say: 'At $t=0$ the temperature is $90$:', tex: 'T(0)&=20+A=90' },
        { say: 'Solve for $A$:', tex: 'A&=70' },
        { say: 'At $t=5$ the temperature is $55$:', tex: 'T(5)&=20+70e^{-5k}=55' },
        { say: 'Solve for $e^{-5k}$:', tex: 'e^{-5k}&=\\dfrac12' },
        { say: 'Now find the value when $t=10$:', tex: 'e^{-10k}&=\\left(e^{-5k}\\right)^2=\\left(\\dfrac12\\right)^2=\\dfrac14' },
        { say: 'Temperature after $10$ minutes:', tex: 'T(10)&=20+70\\cdot\\dfrac14=37.5' }
      ]
    ],
    check: [
      { question: 'Find the area enclosed between $y=x$ and $y=x^2$ for $0\\le x\\le1$.', answer: '$\\dfrac16$', verify: { kind: 'value', expr: '1^2/2-1^3/3', answer: '1/6' } },
      { question: 'The region under $y=x$ from $x=0$ to $x=3$ is rotated about the $x$-axis. Find the volume.', answer: '$9\\pi$ cubic units', verify: { kind: 'value', expr: 'pi*3^3/3', answer: '9*pi' } },
      { question: 'Find the area between $y=x+2$ and $y=x^2$, given their intersections at $x=-1$ and $x=2$.', answer: '$\\dfrac92$', verify: { kind: 'value', expr: '(2^2/2+2*2-2^3/3)-((-1)^2/2+2*(-1)-(-1)^3/3)', answer: '9/2' } }
    ]
  },

  'me1-12-06': {
    examiners: [
      'The model is named with its parameters, $X\\sim\\text{Bin}(n,p)$, and the reason it applies (independent trials, constant $p$) is stated.',
      'The binomial coefficient is included in every point probability.',
      '“At least” questions use the complement, and the working shows $1-P(X=0)$.',
      'For a sample mean the standard deviation is divided by $\\sqrt n$, the normal approximation is justified by a large $n$, and a $z$-score is written before the probability.'
    ],
    diagrams: [
      { title: 'The distribution of $X\\sim\\text{Bin}(5,0.4)$', spec: { kind: 'histogram', bins: { edges: [-0.5, 0.5, 1.5, 2.5, 3.5, 4.5, 5.5], counts: [243, 810, 1080, 720, 240, 32] } }, note: 'Out of $3125$ repeats of five trials, the expected counts for $0$ to $5$ successes are $243$, $810$, $1080$, $720$, $240$, $32$. The tallest bar is $\\tfrac{1080}{3125}=0.3456$, the probability of exactly two.' },
      { title: 'The sample mean is clustered more tightly', spec: { kind: 'normal', mu: 50, sigma: 2, from: 1.5, to: 4, mode: 'z' }, note: 'The mean of $36$ values is approximately normal with mean $50$ and standard deviation $2$. The shaded tail beyond $x=53$ ($z=1.5$) has area about $0.0668$.' }
    ],
    working: [
      [
        { say: 'Binomial probability with $n=5$, $p=0.4$, $q=0.6$, $r=2$:', tex: 'P(X=2)&=\\dbinom52(0.4)^2(0.6)^3' },
        { tex: '&=10\\times0.16\\times0.216' },
        { tex: '&=0.3456' }
      ],
      [
        { say: 'Let $X$ be the number of sixes:', tex: 'X&\\sim\\text{Bin}\\left(4,\\dfrac16\\right)' },
        { say: 'Use the complement:', tex: 'P(X\\ge1)&=1-P(X=0)' },
        { say: 'Probability of no sixes in four rolls:', tex: '&=1-\\left(\\dfrac56\\right)^4=1-\\dfrac{625}{1296}' },
        { tex: '&=\\dfrac{671}{1296}' },
        { tex: '&\\approx0.518' }
      ],
      [
        { say: 'Standard deviation of the sample mean:', tex: '\\text{sd}(\\bar X)&=\\dfrac{12}{\\sqrt{36}}=2' },
        { say: 'Central limit theorem: $\\bar X$ is approximately normal, so standardise:', tex: 'z&=\\dfrac{53-50}{2}=1.5' },
        { say: 'Probability:', tex: 'P(\\bar X>53)&=P(Z>1.5)' },
        { tex: '&\\approx0.0668' }
      ]
    ],
    check: [
      { question: 'A fair coin is tossed $3$ times. Find the probability of exactly two heads.', answer: '$\\dfrac38$', verify: { kind: 'value', expr: 'nCr(3,2)*(1/2)^3', answer: '3/8' } },
      { question: 'Find the mean of $X\\sim\\text{Bin}(20,0.3)$ and its variance.', answer: 'Mean $6$, variance $4.2$', verify: { kind: 'values', pairs: [['20*0.3', '6'], ['20*0.3*0.7', '4.2']] } },
      { question: 'Samples of size $25$ are taken from a population with standard deviation $10$. Find the standard deviation of the sample mean.', answer: '$2$', verify: { kind: 'value', expr: '10/sqrt(25)', answer: '2' } }
    ]
  }
};
