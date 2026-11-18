// Pri Learning · NSW Notes · Mathematics Extension 1 · Year 11 (first band) · the premium layer.
//
// What sits beside notes-nsw-ext1-a.js for each topic, keyed by the same id:
//   examiners  what a marker looks for in a full-mark answer
//   diagrams   specs for diagrams/DiagramFromSpec, drawn from the SAME numbers as the text
//   working    one aligned display block per worked example, in the same order as `examples`
//   check      self-check questions; every answer is re-derived by the engine
// Original writing for Pri Learning; not an official NESA publication. en-AU spelling.
export default {
  'me1-11-01': {
    examiners: [
      'The domain restriction is stated whenever an inverse is found from a many-to-one function, and the domain of the inverse is given as the range of the original.',
      'An inverse is checked by substituting a value into both functions: $f(3)=10$ and $f^{-1}(10)=3$.',
      'A rational inequality is solved by combining into one fraction and testing intervals, not by multiplying by a denominator of unknown sign. Excluded values (here $x=2$ and $x=5$) are marked open.'
    ],
    diagrams: [
      { title: 'A function and its inverse', spec: { kind: 'function', xmin: 0, xmax: 6, ymin: 0, ymax: 6, curves: [{ expr: 'x^2+1', label: 'y=x^2+1' }, { expr: 'sqrt(x-1)', label: 'y=\\sqrt{x-1}' }, { expr: 'x', label: 'y=x' }] }, note: 'The two curves are mirror images in $y=x$. The point $(2,5)$ on $f$ corresponds to $(5,2)$ on $f^{-1}$.' },
      { title: 'Where the curve is above $y=2$', spec: { kind: 'function', xmin: -3, xmax: 9, ymin: -6, ymax: 10, curves: [{ expr: '(x+1)/(x-2)', label: 'y=\\dfrac{x+1}{x-2}' }, { expr: '2', label: 'y=2' }], asymptotes: [{ x: 2 }] }, note: 'The branch lies above the line $y=2$ only between the asymptote $x=2$ and the crossing at $x=5$, so $\\tfrac{x+1}{x-2}>2$ for $2<x<5$.' }
    ],
    working: [
      [
        { say: 'Swap $x$ and $y$:', tex: 'x&=y^2+1' },
        { say: 'Make $y^2$ the subject:', tex: 'y^2&=x-1' },
        { say: 'Take the non-negative root, since $x\\ge0$ originally; the domain is the range of $f$:', tex: 'y&=\\sqrt{x-1},\\quad x\\ge1' },
        { say: 'Evaluate:', tex: 'f^{-1}(10)&=\\sqrt{10-1}=3' }
      ],
      [
        { say: 'Make $t$ the subject:', tex: 't&=\\dfrac{x-1}{2}' },
        { say: 'Substitute into $y$:', tex: 'y&=\\left(\\dfrac{x-1}{2}\\right)^2-3' },
        { say: 'Substitute $t=3$ into both equations:', tex: '(x,y)&=\\left(2(3)+1,\\ 3^2-3\\right)' },
        { tex: '&=(7,6)' }
      ],
      [
        { say: 'Subtract $2$ and combine:', tex: '\\dfrac{x+1}{x-2}-2&=\\dfrac{x+1-2(x-2)}{x-2}' },
        { tex: '&=\\dfrac{5-x}{x-2}' },
        { say: 'Need this positive; sign changes at $x=2$ and $x=5$:', tex: '\\dfrac{5-x}{x-2}&>0' },
        { say: 'Positive only between them ($x=5$ excluded):', tex: '2&<x<5' }
      ]
    ],
    check: [
      { question: 'Find $f^{-1}(x)$ for $f(x)=3x-6$, and evaluate $f^{-1}(9)$.', answer: '$f^{-1}(x)=\\tfrac{x+6}{3}$ and $f^{-1}(9)=5$', verify: { kind: 'values', pairs: [['(9+6)/3', '5'], ['3*5-6', '9']] } },
      { question: 'A curve has $x=t+2$ and $y=2t$. Find $y$ when $x=5$.', answer: '$6$', verify: { kind: 'value', expr: '2*(5-2)', answer: '6' } }
    ]
  },

  'me1-11-02': {
    examiners: [
      'The theorem is named and the substitution is shown on its own line: $P(2)=2(8)-5(4)+2+7$.',
      'A factor is justified by $P(a)=0$, not by a statement that it "works".',
      'For sums and products of zeroes the signs follow $-\\tfrac{b}{a}$, $+\\tfrac{c}{a}$, $-\\tfrac{d}{a}$, and the identity used for an expression such as $\\alpha^2+\\beta^2+\\gamma^2$ is written before substitution.'
    ],
    diagrams: [
      { title: 'A cubic and its zeroes', spec: { kind: 'function', xmin: -3, xmax: 3.5, ymin: -20, ymax: 30, curves: [{ expr: '2*x^3-3*x^2-8*x+12', intercepts: true, label: 'y=2x^3-3x^2-8x+12' }] }, note: 'The graph crosses the $x$-axis at $-2$, $\\tfrac32$ and $2$, the zeroes of $(x^2-4)(2x-3)$. Their sum is $\\tfrac32$, matching $-\\tfrac{b}{a}$.' }
    ],
    working: [
      [
        { say: 'Remainder theorem:', tex: 'P(2)&=2(2)^3-5(2)^2+2+7' },
        { tex: '&=16-20+2+7' },
        { tex: '&=5' }
      ],
      [
        { say: 'Factor theorem, $P(-1)=0$:', tex: 'P(-1)&=(-1)^3+k(-1)^2-4(-1)-2' },
        { tex: '&=k+1' },
        { say: 'Set to zero:', tex: 'k+1&=0' },
        { say: 'Solve:', tex: 'k&=-1' }
      ],
      [
        { say: 'Sum of zeroes:', tex: '\\alpha+\\beta+\\gamma&=-\\dfrac{-3}{2}=\\dfrac32' },
        { say: 'Sum of pairs:', tex: '\\alpha\\beta+\\beta\\gamma+\\gamma\\alpha&=\\dfrac{-8}{2}=-4' },
        { say: 'Square the sum:', tex: '\\alpha^2+\\beta^2+\\gamma^2&=(\\alpha+\\beta+\\gamma)^2-2(\\alpha\\beta+\\beta\\gamma+\\gamma\\alpha)' },
        { tex: '&=\\left(\\dfrac32\\right)^2-2(-4)' },
        { tex: '&=\\dfrac{41}{4}' }
      ]
    ],
    check: [
      { question: 'Find the remainder when $x^3-2x+5$ is divided by $x+2$.', answer: '$1$', verify: { kind: 'value', expr: '(-2)^3-2*(-2)+5', answer: '1' } },
      { question: 'For $x^2-5x+6=0$ with zeroes $\\alpha,\\beta$, find $\\alpha^2+\\beta^2$.', answer: '$13$', verify: { kind: 'values', pairs: [['5^2-2*6', '13'], ['2^2+3^2', '13']] } }
    ]
  },

  'me1-11-03': {
    examiners: [
      'The compound-angle or double-angle formula is quoted before it is applied, and exact values are left in surd form, not rounded.',
      'An equation that mixes $2x$ and $x$ is rewritten in a single angle and a single function before it is factorised; no factor containing the unknown is cancelled.',
      'Every solution in the stated interval is listed (both quadrants), and in a solid, the right-angled triangle used is named, for example the triangle with sides $5$ and $12$.'
    ],
    diagrams: [
      { title: 'The triangle inside the box', spec: { kind: 'triangle', a: 5, b: 12, c: 13 }, note: 'The base diagonal $5$ and the height $12$ are the legs; the space diagonal $13$ is the hypotenuse. The angle with the base has $\\sin\\theta=\\tfrac{12}{13}$.' },
      { title: 'Seventy-five degrees', spec: { kind: 'unitCircle', deg: 75 }, note: 'At $75^\\circ$ the point is close to the top of the circle: $\\sin75^\\circ=\\tfrac{\\sqrt6+\\sqrt2}{4}\\approx0.966$.' }
    ],
    working: [
      [
        { say: 'Write $75^\\circ=45^\\circ+30^\\circ$:', tex: '\\sin75^\\circ&=\\sin(45^\\circ+30^\\circ)' },
        { tex: '&=\\sin45^\\circ\\cos30^\\circ+\\cos45^\\circ\\sin30^\\circ' },
        { tex: '&=\\dfrac{\\sqrt2}{2}\\cdot\\dfrac{\\sqrt3}{2}+\\dfrac{\\sqrt2}{2}\\cdot\\dfrac12' },
        { tex: '&=\\dfrac{\\sqrt6+\\sqrt2}{4}' }
      ],
      [
        { say: 'Use $\\cos(2x)=1-2\\sin^2x$:', tex: '1-2\\sin^2x&=\\sin x' },
        { say: 'Rearrange:', tex: '2\\sin^2x+\\sin x-1&=0' },
        { say: 'Factorise:', tex: '(2\\sin x-1)(\\sin x+1)&=0' },
        { say: 'Set each factor to zero:', tex: '\\sin x&=\\dfrac12,\\quad\\sin x=-1' },
        { say: 'Solutions for $0\\le x\\le2\\pi$:', tex: 'x&=\\dfrac{\\pi}{6},\\ \\dfrac{5\\pi}{6},\\ \\dfrac{3\\pi}{2}' }
      ],
      [
        { say: 'Diagonal of the base:', tex: 'd_{\\text{base}}&=\\sqrt{3^2+4^2}=5' },
        { say: 'Space diagonal:', tex: 'd&=\\sqrt{5^2+12^2}=13' },
        { say: 'Angle with the base is opposite the height $12$:', tex: '\\sin\\theta&=\\dfrac{12}{13}' }
      ]
    ],
    check: [
      { question: 'If $t=\\tan\\tfrac{\\theta}{2}=\\tfrac12$, find $\\sin\\theta$ using the $t$-formula.', answer: '$\\tfrac45$', verify: { kind: 'value', expr: '2*(1/2)/(1+(1/2)^2)', answer: '4/5' } },
      { question: 'If $\\sin\\theta=\\tfrac35$, find $\\cos2\\theta$.', answer: '$\\tfrac{7}{25}$', verify: { kind: 'value', expr: '1-2*(3/5)^2', answer: '7/25' } },
      { question: 'Use $\\sin2A=2\\sin A\\cos A$ to find $\\sin\\tfrac{2\\pi}{3}$ from $A=\\tfrac{\\pi}{3}$.', answer: '$\\tfrac{\\sqrt3}{2}$', verify: { kind: 'values', pairs: [['sin(2*pi/3)', 'sqrt(3)/2'], ['2*sin(pi/3)*cos(pi/3)', 'sqrt(3)/2']] } }
    ]
  },

  'me1-11-04': {
    examiners: [
      'The reason for the method is stated in a few words: "order matters, so a permutation" or "order does not matter, so a combination".',
      'Independent choices are multiplied, and the product is shown, for example ${}^7C_3\\times{}^5C_2=35\\times10$.',
      'A restriction is handled by a stated method (glue the pair, or total minus unwanted), and the answer is checked for plausibility against the unrestricted total.'
    ],
    diagrams: [],
    working: [
      [
        { say: 'Repeated letters ($A$ three times, $N$ twice):', tex: '\\dfrac{6!}{3!\\,2!}&=\\dfrac{720}{6\\times2}' },
        { tex: '&=60' }
      ],
      [
        { say: 'Choose the men:', tex: '{}^7C_3&=35' },
        { say: 'Choose the women:', tex: '{}^5C_2&=10' },
        { say: 'Multiply the choices:', tex: '35\\times10&=350' }
      ],
      [
        { say: 'Alex and Bo as one block ($4$ objects), and the pair can swap:', tex: '4!\\times2&=24\\times2' },
        { tex: '&=48' }
      ]
    ],
    check: [
      { question: 'In how many ways can a president and a secretary be chosen from $8$ people (one person cannot hold both)?', answer: '$56$', verify: { kind: 'value', expr: 'npr(8,2)', answer: '56' } },
      { question: 'How many different groups of $4$ can be chosen from $9$ people?', answer: '$126$', verify: { kind: 'value', expr: 'ncr(9,4)', answer: '126' } }
    ]
  },

  'me1-11-05': {
    examiners: [
      'The general term is written with its exponents before a value of $k$ is chosen, and constants inside the brackets are raised to the power.',
      'The power of $x$ is found as a function of $k$ and set equal to the wanted power; the solved value of $k$ is a whole number between $0$ and $n$, or the term does not exist.',
      'An approximation states which terms were used and bounds the size of the next term.'
    ],
    diagrams: [
      { title: 'The coefficients of $(a+b)^5$', spec: { kind: 'histogram', bins: { edges: [0, 1, 2, 3, 4, 5, 6], counts: [1, 5, 10, 10, 5, 1] } }, note: 'The bars are $\\binom50,\\ldots,\\binom55=1,5,10,10,5,1$, one row of Pascal\'s triangle. They sum to $2^5=32$.' }
    ],
    working: [
      [
        { say: 'Term in $x^3$ ($k=3$):', tex: 'T_{4}&=\\binom53(2x)^3(1)^2' },
        { tex: '&=10\\times8x^3' },
        { tex: '&=80x^3' }
      ],
      [
        { say: 'Power of $x$ in each term:', tex: 'T_{k+1}&=\\binom6k x^{2(6-k)-k}' },
        { tex: '&=\\binom6k x^{12-3k}' },
        { say: 'No $x$ remains:', tex: '12-3k&=0' },
        { say: 'Solve:', tex: 'k&=4' },
        { say: 'The term:', tex: '\\binom64&=15' }
      ],
      [
        { say: 'First three terms with $x=0.02$:', tex: '1.02^5&\\approx1+5(0.02)+10(0.02)^2' },
        { tex: '&=1.104' }
      ]
    ],
    check: [
      { question: 'Find the coefficient of $x^2$ in $(1+3x)^4$.', answer: '$54$', verify: { kind: 'value', expr: 'ncr(4,2)*3^2', answer: '54' } },
      { question: 'What is the sum of the coefficients of $(1+x)^7$?', answer: '$128$', verify: { kind: 'values', pairs: [['2^7', '128'], ['ncr(7,0)+ncr(7,1)+ncr(7,2)+ncr(7,3)+ncr(7,4)+ncr(7,5)+ncr(7,6)+ncr(7,7)', '128']] } }
    ]
  }
};
