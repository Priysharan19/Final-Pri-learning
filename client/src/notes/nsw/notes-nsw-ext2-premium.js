// Pri Learning · NSW Notes · Year 12 · Mathematics Extension 2 · the premium layer.
//
// What sits beside notes-nsw-ext2.js for each topic, keyed by the same id:
//   examiners  what a marker looks for in a full-mark answer (short, specific)
//   diagrams   specs for diagrams/DiagramFromSpec, drawn from the SAME numbers as the text
//   working    one aligned display block per worked example, in the same order as `examples`
//   check      self-check questions; every answer is re-derived by the engine
// Original writing for Pri Learning; not an official NESA publication. en-AU spelling.
export default {
  'me2-12-01': {
    examiners: [
      'An induction proof has all four parts, labelled: the base case, the assumption for $n=k$, the step to $n=k+1$ that uses the assumption, and a closing sentence.',
      'A proof by contradiction states the assumption at the start, reaches a clear contradiction, and says why the assumption must therefore be false.',
      'An inequality is proved by a difference or a square: the working shows an expression that is visibly non-negative, with the condition for equality stated.'
    ],
    diagrams: [
      { title: 'Why $x+\\tfrac1x\\ge2$', spec: { kind: 'function', xmin: 0, xmax: 5, ymin: 0, ymax: 6, curves: [{ expr: 'x+1/x', label: 'y=x+1/x' }], asymptotes: [{ x: 0 }], points: [{ x: 1, y: 2, label: '(1,2)' }] }, note: 'The curve $y=x+\\tfrac1x$ never drops below $2$ for $x>0$, and touches $2$ only at $x=1$, where $(x-1)^2=0$.' }
    ],
    working: [
      [
        { say: 'Basis case $n=1$:', tex: '1&=1^2' },
        { say: 'Assume $P(k)$:', tex: '1+3+\\cdots+(2k-1)&=k^2' },
        { say: 'Add the next term $2k+1$ to both sides:', tex: '1+3+\\cdots+(2k-1)+(2k+1)&=k^2+(2k+1)' },
        { tex: '&=(k+1)^2' }
      ],
      [
        { say: 'Prove the contrapositive: let $n$ be odd:', tex: 'n&=2m+1' },
        { say: 'Square:', tex: 'n^2&=4m^2+4m+1' },
        { tex: '&=2\\left(2m^2+2m\\right)+1,\\ \\text{which is odd}' }
      ],
      [
        { say: 'Form the difference over a common denominator:', tex: 'x+\\dfrac1x-2&=\\dfrac{x^2-2x+1}{x}' },
        { say: 'The numerator is a perfect square:', tex: '&=\\dfrac{(x-1)^2}{x}' },
        { tex: '&\\ge0' },
        { say: 'A square is non-negative and $x>0$, so:', tex: 'x+\\dfrac1x&\\ge2,\\quad\\text{with equality only when }x=1' }
      ]
    ],
    check: [
      { question: 'In proving that $7^n-1$ is divisible by $6$, test the case $n=3$: evaluate $\\dfrac{7^3-1}{6}$.', answer: '$57$', verify: { kind: 'value', expr: '(7^3-1)/6', answer: '57' } },
      { question: 'Find the geometric mean $\\sqrt{ab}$ of $4$ and $9$.', answer: '$6$', verify: { kind: 'value', expr: 'sqrt(4*9)', answer: '6' } },
      { question: 'Use the result of the first worked example to find $1+3+5+\\cdots+11$.', answer: '$36$', verify: { kind: 'value', expr: 'sum(2*k-1,k,1,6)', answer: '6^2' } }
    ]
  },

  'me2-12-02': {
    examiners: [
      'The scalar product is computed componentwise first, then used: the angle comes from $\\cos\\theta=\\dfrac{\\mathbf a\\cdot\\mathbf b}{|\\mathbf a||\\mathbf b|}$ with every magnitude shown.',
      'For an intersection, a separate parameter is used for each line, two components are solved, and the third is checked before the point is stated.',
      'A sphere equation is rewritten by completing the square in all three variables, and the radius is a square root of the constant.'
    ],
    diagrams: [
      { title: 'Two vectors and their sum', spec: { kind: 'vector', vectors: [{ label: '\\mathbf a', dx: 3, dy: 1 }, { label: '\\mathbf b', dx: 1, dy: 3 }] }, note: 'In the plane, $\\mathbf a=(3,1)$ and $\\mathbf b=(1,3)$ give $\\mathbf a+\\mathbf b=(4,4)$. Here $\\mathbf a\\cdot\\mathbf b=6$ and $|\\mathbf a|=|\\mathbf b|=\\sqrt{10}$, so $\\cos\\theta=\\tfrac{6}{10}$ and the angle between them is about $53.1^\\circ$. In space the same rules hold with a third component.' }
    ],
    working: [
      [
        { say: 'Scalar product:', tex: '\\mathbf a\\cdot\\mathbf b&=2(1)+(-1)(2)+2(2)=4' },
        { say: 'Magnitudes:', tex: '|\\mathbf a|=|\\mathbf b|&=\\sqrt{4+1+4}=3' },
        { say: 'Angle formula $\\cos\\theta=\\dfrac{\\mathbf a\\cdot\\mathbf b}{|\\mathbf a||\\mathbf b|}$:', tex: '\\cos\\theta&=\\dfrac{4}{3\\times3}=\\dfrac49' },
        { say: 'Angle:', tex: '\\theta&\\approx63.6^\\circ' }
      ],
      [
        { say: 'Equate the $x$-components:', tex: '1+\\lambda&=\\mu' },
        { say: 'Equate the $y$-components:', tex: '2\\lambda&=1+\\mu' },
        { say: 'Equate the $z$-components:', tex: '2-\\lambda&=3-\\mu' },
        { say: 'Substitute $\\mu=1+\\lambda$ into the second equation:', tex: '2\\lambda&=2+\\lambda' },
        { say: 'Solve:', tex: '\\lambda&=2,\\quad\\mu=3' },
        { say: 'Test the third equation:', tex: '2-2&=0=3-3' },
        { say: 'Point of intersection, from the first line with $\\lambda=2$:', tex: '\\mathbf r&=(1+2,\\ 0+4,\\ 2-2)=(3,4,0)' },
        { say: 'Check with the second line, $\\mu=3$:', tex: '\\mathbf r&=(0+3,\\ 1+3,\\ 3-3)=(3,4,0)' }
      ],
      [
        { say: 'Move the constant to the right:', tex: 'x^2+y^2+z^2-2x+4y-6z&=11' },
        { say: 'Complete the square in each variable:', tex: '(x-1)^2+(y+2)^2+(z-3)^2&=11+1+4+9' },
        { tex: '&=25' },
        { say: 'Compare with $(x-a)^2+(y-b)^2+(z-c)^2=R^2$:', tex: '\\text{centre}&=(1,-2,3)' },
        { say: 'Radius:', tex: 'R&=\\sqrt{25}=5' }
      ]
    ],
    check: [
      { question: 'Find $\\mathbf a\\cdot\\mathbf b$ for $\\mathbf a=(2,-3,1)$ and $\\mathbf b=(1,1,1)$. What does the result tell you?', answer: '$0$, so the vectors are perpendicular.', verify: { kind: 'value', expr: '2*1+(-3)*1+1*1', answer: '0' } },
      { question: 'Find the scalar projection of $\\mathbf a=(3,4,0)$ on $\\mathbf i=(1,0,0)$.', answer: '$3$', verify: { kind: 'value', expr: '(3*1+4*0+0*0)/sqrt(1^2+0^2+0^2)', answer: '3' } },
      { question: 'Find the radius of the sphere $(x-2)^2+(y+1)^2+(z-5)^2=49$.', answer: '$7$', verify: { kind: 'value', expr: 'sqrt(49)', answer: '7' } }
    ]
  },

  'me2-12-03': {
    examiners: [
      'The real and imaginary parts are collected on separate lines after every use of $i^2=-1$.',
      'An argument is checked against the quadrant of the point on the Argand diagram, not read directly from $\\tan^{-1}\\tfrac ba$.',
      'A quadratic with a negative discriminant has its roots written as a conjugate pair, and a root is substituted back to confirm it.'
    ],
    diagrams: [
      { title: 'Adding complex numbers on the Argand diagram', spec: { kind: 'vector', vectors: [{ label: 'z_1', dx: 3, dy: 1 }, { label: 'z_2', dx: 1, dy: 2 }] }, note: 'Plot $z_1=3+i$ and $z_2=1+2i$ as vectors. Placed tip to tail they give $z_1+z_2=4+3i$, with modulus $\\sqrt{16+9}=5$.' }
    ],
    working: [
      [
        { say: 'Expand:', tex: '(3+2i)(1-4i)&=3-12i+2i-8i^2' },
        { say: 'Use $i^2=-1$:', tex: '&=3-10i+8' },
        { say: 'Collect real and imaginary parts:', tex: '&=11-10i' }
      ],
      [
        { say: 'Modulus:', tex: '|z|&=\\sqrt{1^2+\\left(\\sqrt3\\right)^2}=2' },
        { say: 'Argument, from $\\tan\\theta=\\dfrac{\\sqrt3}{1}$:', tex: '\\tan\\theta&=\\sqrt3' },
        { say: 'The point is in the first quadrant:', tex: '\\theta&=\\dfrac\\pi3' },
        { say: 'Modulus-argument form:', tex: 'z&=2\\left(\\cos\\left(\\dfrac\\pi3\\right)+i\\sin\\left(\\dfrac\\pi3\\right)\\right)' }
      ],
      [
        { say: 'Quadratic formula:', tex: 'z&=\\dfrac{4\\pm\\sqrt{16-52}}{2}' },
        { say: 'Discriminant is $-36$, and $\\sqrt{-36}=6i$:', tex: '&=\\dfrac{4\\pm6i}{2}' },
        { say: 'Divide through by $2$:', tex: '&=2\\pm3i' }
      ]
    ],
    check: [
      { question: 'Write $\\dfrac{2+i}{1+i}$ in the form $a+bi$. Give the real part $a$.', answer: '$a=\\tfrac32$ (the number is $\\tfrac32-\\tfrac12i$)', verify: { kind: 'values', pairs: [['(2*1+1*1)/(1^2+1^2)', '3/2'], ['(1*1-2*1)/(1^2+1^2)', '-1/2']] } },
      { question: 'Find $|z|$ for $z=5-12i$.', answer: '$13$', verify: { kind: 'value', expr: 'sqrt(5^2+12^2)', answer: '13' } },
      { question: 'Find $\\arg(-1+i)$ in $(-\\pi,\\pi]$. Give it as a multiple of $\\pi$.', answer: '$\\tfrac{3\\pi}{4}$, in the second quadrant', verify: { kind: 'value', expr: 'pi-atan(1)', answer: '3*pi/4' } }
    ]
  },

  'me2-12-04': {
    examiners: [
      'The choice of $u$ and $dv$ is written down before parts is applied, and the limits are carried on the $uv$ term.',
      'A partial fraction decomposition is checked at one value of $x$, and each logarithm is combined at the end where possible.',
      'A reduction formula is applied with the starting value stated, and every step shows the index falling.'
    ],
    diagrams: [
      { title: 'Rectangles under $y=xe^x$', spec: { kind: 'riemannSlider', expr: 'x*e^x', a: 0, b: 1, initialN: 4 }, note: 'The exact area under $y=xe^x$ from $0$ to $1$ is $1$, the answer to the first worked example. Increase the number of rectangles and the total moves towards it.' }
    ],
    working: [
      [
        { say: 'Integrate by parts with $u=x$ and $dv=e^x\\,dx$:', tex: '\\int_0^1xe^x\\,dx&=\\left[xe^x\\right]_0^1-\\int_0^1e^x\\,dx' },
        { say: 'Evaluate each part:', tex: '&=e-(e-1)' },
        { tex: '&=1' }
      ],
      [
        { say: 'Partial fractions:', tex: '\\dfrac{1}{(x-1)(x+2)}&=\\dfrac13\\left(\\dfrac1{x-1}-\\dfrac1{x+2}\\right)' },
        { say: 'Integrate:', tex: '\\int_2^3\\dfrac{dx}{(x-1)(x+2)}&=\\dfrac13\\left[\\ln(x-1)-\\ln(x+2)\\right]_2^3' },
        { say: 'Substitute the limits:', tex: '&=\\dfrac13\\left[(\\ln2-\\ln5)-(\\ln1-\\ln4)\\right]' },
        { say: 'Combine the logarithms:', tex: '&=\\dfrac13\\left(\\ln\\left(\\dfrac25\\right)-\\ln\\left(\\dfrac14\\right)\\right)' },
        { tex: '&=\\dfrac13\\ln\\left(\\dfrac85\\right)' }
      ],
      [
        { say: 'Starting value:', tex: 'I_0&=\\int_0^{\\pi/2}1\\,dx=\\dfrac\\pi2' },
        { say: 'Apply $I_n=\\dfrac{n-1}{n}I_{n-2}$ with $n=2$:', tex: 'I_2&=\\dfrac12I_0=\\dfrac\\pi4' },
        { say: 'Apply it with $n=4$:', tex: 'I_4&=\\dfrac34I_2=\\dfrac34\\times\\dfrac\\pi4=\\dfrac{3\\pi}{16}' }
      ]
    ],
    check: [
      { question: 'Evaluate $\\displaystyle\\int_0^3\\frac{dx}{x^2+9}$.', answer: '$\\dfrac\\pi{12}$', verify: { kind: 'value', expr: '(1/3)*(atan(3/3)-atan(0))', answer: 'pi/12' } },
      { question: 'Evaluate $\\displaystyle\\int_1^e\\ln x\\,dx$.', answer: '$1$', verify: { kind: 'value', expr: '(e*ln(e)-e)-(1*ln(1)-1)', answer: '1' } },
      { question: 'Use $I_n=\\dfrac{n-1}{n}I_{n-2}$ with $I_1=1$ to find $I_3=\\displaystyle\\int_0^{\\pi/2}\\sin^3x\\,dx$.', answer: '$\\dfrac23$', verify: { kind: 'value', expr: '(2/3)*1', answer: '2/3' } }
    ]
  },

  'me2-12-05': {
    examiners: [
      'The positive direction is stated first and every force and the acceleration are written from it, with the sign of the resistance explained.',
      'The form of acceleration chosen is justified: $\\dfrac{dv}{dt}$ for a result in time, $v\\dfrac{dv}{dx}$ for a result in position.',
      'A final speed, period or terminal velocity is given with its units, and checked by substituting back into the equation of motion.'
    ],
    diagrams: [
      { title: 'Speed approaching terminal velocity', spec: { kind: 'function', xmin: 0, xmax: 12, ymin: 0, ymax: 24, curves: [{ expr: '20*(1-e^(-0.5*x))', label: 'v=20(1-e^{-0.5t})' }], asymptotes: [{ y: 20, label: 'v=20' }] }, note: 'This is the speed in the first worked example, $v=20(1-e^{-0.5t})$. It climbs towards the terminal velocity $20$ and never reaches it.' },
      { title: 'Displacement in simple harmonic motion', spec: { kind: 'function', xmin: 0, xmax: 4.2, ymin: -5, ymax: 5, curves: [{ expr: '4*cos(3*x)', label: 'x=4\\cos3t' }] }, note: 'The displacement $x=4\\cos3t$ swings between $-4$ and $4$. One full cycle takes $\\tfrac{2\\pi}{3}\\approx2.09$ units of time.' }
    ],
    working: [
      [
        { say: 'Terminal velocity, where $\\ddot x=0$:', tex: 'v_{\\text{terminal}}&=\\dfrac gk=\\dfrac{10}{0.5}=20' },
        { say: 'Speed for a fall from rest:', tex: 'v&=\\dfrac gk\\left(1-e^{-kt}\\right)=20\\left(1-e^{-0.5t}\\right)' },
        { say: 'Evaluate the speed when $t=2$:', tex: 'v(2)&=20\\left(1-e^{-0.5\\times2}\\right)=20\\left(1-e^{-1}\\right)' },
        { tex: '&\\approx12.6' }
      ],
      [
        { say: 'Terminal velocity, where $\\ddot x=0$:', tex: '10-0.1v^2&=0' },
        { say: 'Take the positive root:', tex: 'v&=\\sqrt{100}=10' },
        { say: 'Use $\\ddot x=v\\dfrac{dv}{dx}$:', tex: 'v\\dfrac{dv}{dx}&=10-0.1v^2' },
        { say: 'Integrate, with $v=0$ at $x=0$:', tex: 'x&=5\\ln\\left(\\dfrac{10}{10-0.1v^2}\\right)' },
        { say: 'Set $x=10$:', tex: '\\ln\\left(\\dfrac{10}{10-0.1v^2}\\right)&=2' },
        { say: 'Exponentiate:', tex: '10-0.1v^2&=10e^{-2}' },
        { say: 'Make $v^2$ the subject:', tex: 'v^2&=100\\left(1-e^{-2}\\right)' },
        { say: 'Take the positive root:', tex: 'v&=10\\sqrt{1-e^{-2}}' },
        { tex: '&\\approx9.3' }
      ],
      [
        { say: 'Differentiate:', tex: '\\dot x&=-12\\sin(3t)' },
        { say: 'Differentiate again and compare with $x=4\\cos(3t)$:', tex: '\\ddot x&=-36\\cos(3t)=-9x' },
        { say: 'This has the form $\\ddot x=-n^2x$, so the motion is simple harmonic with $n=3$:', tex: '\\ddot x&=-3^2x' },
        { say: 'Period:', tex: 'T&=\\dfrac{2\\pi}{n}=\\dfrac{2\\pi}{3}' },
        { say: 'Maximum speed, with amplitude $a=4$:', tex: 'v_{\\max}&=na=3\\times4=12' },
        { say: 'Maximum acceleration:', tex: '\\left|\\ddot x\\right|_{\\max}&=n^2a=9\\times4=36' }
      ]
    ],
    check: [
      { question: 'A body falls from rest with $\\ddot x=9.8-0.2v$. Find its terminal velocity.', answer: '$49$', verify: { kind: 'value', expr: '9.8/0.2', answer: '49' } },
      { question: 'A particle in simple harmonic motion has $n=2$ and amplitude $5$. Find its speed at $x=3$.', answer: '$8$', verify: { kind: 'value', expr: 'sqrt(2^2*(5^2-3^2))', answer: '8' } },
      { question: 'A particle moves with $\\ddot x=-16x$. Find its period.', answer: '$\\dfrac\\pi2$', verify: { kind: 'value', expr: '2*pi/sqrt(16)', answer: 'pi/2' } }
    ]
  }
};
