// Pri Learning · NSW Notes · Stage 6 · Mathematics Advanced (Years 11 and 12)
//
// Original revision writing for Pri Learning; it is not an official NESA publication and quotes no
// syllabus text. Each topic is one complete object keyed by its focus-area id. Every worked example
// and every self-check answer is re-derived by the deterministic engine in
// client/test/nsw-notes-content-check.mjs. The engine has no derivative or integral verifier, so a
// calculus result is checked numerically: a derivative by a symmetric difference quotient with
// h = 0.0001, an integral by evaluating its antiderivative (and, for the polynomial, by Simpson's
// rule). en-AU spelling.
export default {
  'mav-11-01': {
    summary: 'A function gives exactly one output for each input. Working with functions means reading domain and range, composing and inverting functions, and understanding the quadratic well enough to sketch it and say how many roots it has.',
    prereqs: [],
    concepts: [
      { title: 'Domain, range and the vertical line test', body: 'The domain is every input the rule accepts and the range is every output it produces. A relation is a function when no vertical line meets its graph twice. For $f(x)=\\sqrt{x-2}+1$ the radicand must not be negative, so the domain is $x\\ge2$ and the range is $y\\ge1$.' },
      { title: 'Composite and inverse functions', body: 'In $f(g(x))$ the function $g$ acts first. The inverse $f^{-1}$ undoes $f$, so $f^{-1}(f(x))=x$. To find it, swap $x$ and $y$ and make $y$ the subject. Only a one-to-one function has an inverse, and its graph is the reflection of $y=f(x)$ in the line $y=x$.' },
      { title: 'The quadratic', body: 'Completing the square writes $ax^2+bx+c$ as $a(x-h)^2+k$, which gives the vertex $(h,k)$ at once. The discriminant $\\Delta=b^2-4ac$ counts the real roots: two when $\\Delta>0$, one when $\\Delta=0$, none when $\\Delta<0$.' }
    ],
    definitions: [
      { term: 'Function', meaning: 'A rule that assigns to each input in the domain exactly one output.' },
      { term: 'One-to-one function', meaning: 'A function in which different inputs always give different outputs, so a horizontal line meets its graph at most once.' },
      { term: 'Discriminant', meaning: 'The quantity $\\Delta=b^2-4ac$ under the square root in the quadratic formula.' }
    ],
    formulas: [
      { label: 'Composite function', tex: '(f\\circ g)(x)=f\\big(g(x)\\big)' },
      { label: 'Quadratic formula', tex: 'x=\\dfrac{-b\\pm\\sqrt{b^2-4ac}}{2a}' },
      { label: 'Vertex of a parabola', tex: 'x=-\\dfrac{b}{2a},\\qquad y=f\\!\\left(-\\dfrac{b}{2a}\\right)' }
    ],
    points: [
      { front: 'Is $f(g(x))$ always equal to $g(f(x))$?', back: 'No. Order matters: with $f(x)=2x-3$ and $g(x)=x^2$, $f(g(3))=15$ but $g(f(3))=9$.' },
      { front: 'How do you find $f^{-1}(x)$?', back: 'Write $y=f(x)$, swap $x$ and $y$, then solve for $y$.' },
      { front: 'What does $\\Delta=0$ tell you about a quadratic?', back: 'It has exactly one real root, so the vertex lies on the $x$-axis.' },
      { front: 'Where is the domain restricted?', back: 'Where a denominator would be zero, or where a square root or logarithm would have an invalid input.' }
    ],
    mistakes: [
      { wrong: '$f(g(x))$ means $f(x)\\times g(x)$.', right: 'It means substitute $g(x)$ into $f$. The two functions are chained, not multiplied.' },
      { wrong: '$f^{-1}(x)=\\dfrac{1}{f(x)}$.', right: 'The inverse function undoes $f$. The reciprocal $\\dfrac{1}{f(x)}$ is a different function.' },
      { wrong: 'The vertex of $y=(x-3)^2-4$ is $(-3,-4)$.', right: 'The bracket $(x-3)$ is zero at $x=3$, so the vertex is $(3,-4)$.' }
    ],
    examples: [
      {
        question: 'Let $f(x)=2x-3$ and $g(x)=x^2$. Find $f(g(3))$ and $g(f(3))$.',
        steps: ['For $f(g(3))$ work inside first: $g(3)=3^2=9$.', 'Then $f(9)=2(9)-3=15$.', 'For $g(f(3))$: $f(3)=2(3)-3=3$, then $g(3)=9$.'],
        answer: '$f(g(3))=15$ and $g(f(3))=9$',
        working: '\\begin{aligned}f(g(3))&=f(9)=2(9)-3=15\\\\g(f(3))&=g(3)=3^2=9\\end{aligned}',
        verify: { kind: 'values', pairs: [['2*3^2-3', '15'], ['(2*3-3)^2', '9']] }
      },
      {
        question: 'State the domain and range of $f(x)=\\sqrt{x-2}+1$, and find $f(11)$.',
        steps: ['The expression under the root must satisfy $x-2\\ge0$, so $x\\ge2$.', 'The square root is at least $0$, so $f(x)\\ge1$.', 'Substitute: $f(11)=\\sqrt{9}+1=4$.'],
        answer: 'Domain $x\\ge2$, range $y\\ge1$, and $f(11)=4$',
        working: '\\begin{aligned}x-2&\\ge0\\Rightarrow x\\ge2\\\\\\sqrt{x-2}&\\ge0\\Rightarrow f(x)\\ge1\\\\f(11)&=\\sqrt{11-2}+1=4\\end{aligned}',
        verify: { kind: 'value', expr: 'sqrt(11-2)+1', answer: '4' }
      },
      {
        question: 'Complete the square for $y=x^2-6x+5$, state the vertex and find the $x$-intercepts.',
        steps: ['Half of $-6$ is $-3$: $x^2-6x+5=(x-3)^2-9+5$.', 'So $y=(x-3)^2-4$ and the vertex is $(3,-4)$.', 'Set $y=0$: $(x-3)^2=4$, so $x-3=\\pm2$ and $x=1$ or $x=5$.'],
        answer: '$y=(x-3)^2-4$, vertex $(3,-4)$, intercepts $x=1$ and $x=5$',
        working: '\\begin{aligned}x^2-6x+5&=(x-3)^2-9+5\\\\&=(x-3)^2-4\\\\(x-3)^2&=4\\\\x&=3\\pm2=1\\text{ or }5\\end{aligned}',
        verify: { kind: 'roots', f: 'x^2-6*x+5', answers: ['1', '5'] }
      },
      {
        question: 'For what values of $k$ does $x^2+kx+9=0$ have exactly one real root?',
        steps: ['Here $a=1$, $b=k$, $c=9$, so $\\Delta=k^2-36$.', 'One real root needs $\\Delta=0$: $k^2=36$.', 'Hence $k=6$ or $k=-6$.'],
        answer: '$k=6$ or $k=-6$',
        working: '\\begin{aligned}\\Delta&=k^2-4(1)(9)\\\\&=k^2-36\\\\k^2-36&=0\\\\k&=\\pm6\\end{aligned}',
        verify: { kind: 'roots', f: 'k^2-36', var: 'k', answers: ['6', '-6'] }
      }
    ],
    examiners: [
      'The inner function is evaluated first and written out: $g(3)=9$ appears before $f(9)$.',
      'A domain restriction is justified by the condition that causes it, such as $x-2\\ge0$.',
      'When the discriminant is used, $a$, $b$ and $c$ are named and $\\Delta$ is substituted before it is set equal to zero.',
      'A completed square is checked by expanding it back to the original expression.'
    ],
    diagrams: [
      { title: 'The parabola $y=x^2-6x+5$', spec: { kind: 'function', xmin: -1, xmax: 7, ymin: -5, ymax: 12, curves: [{ expr: 'x^2-6*x+5', intercepts: true, label: 'y=x^2-6x+5' }], points: [{ x: 3, y: -4, label: '(3,\\,-4)' }] }, note: 'The vertex is $(3,-4)$ and the curve crosses the $x$-axis at $x=1$ and $x=5$, matching $y=(x-3)^2-4$.' },
      { title: 'The domain starts at $x=2$', spec: { kind: 'function', xmin: -1, xmax: 12, ymin: -2, ymax: 6, curves: [{ expr: 'sqrt(x-2)+1', label: 'y=\\sqrt{x-2}+1' }], points: [{ x: 2, y: 1, label: '(2,\\,1)' }, { x: 11, y: 4, label: '(11,\\,4)' }] }, note: 'The graph starts at $(2,1)$, so $x\\ge2$ and $y\\ge1$. At $x=11$ the value is $4$.' }
    ],
    check: [
      { question: 'If $f(x)=3x-4$, find $f^{-1}(x)$.', answer: '$f^{-1}(x)=\\dfrac{x+4}{3}$', verify: { kind: 'equivalent', a: '3*((x+4)/3)-4', b: 'x' } },
      { question: 'If $f(x)=x^2-3x$, find $f(-2)$.', answer: '$10$', verify: { kind: 'value', expr: '(-2)^2-3*(-2)', answer: '10' } }
    ]
  },

  'mav-11-03': {
    summary: 'Every transformation of a graph is a change to the equation: adding outside the function moves the graph up or down, changing the input moves or squeezes it sideways, and a negative sign reflects it. Reading $y=af(b(x-h))+k$ tells you the whole picture.',
    prereqs: ['mav-11-01'],
    concepts: [
      { title: 'Translations', body: 'Adding $k$ outside, $y=f(x)+k$, moves the graph $k$ up. Replacing $x$ by $x-h$ moves it $h$ to the right. The shift in the bracket goes the opposite way to the sign, so $y=(x-3)^2$ moves $y=x^2$ three units right.' },
      { title: 'Dilations', body: '$y=af(x)$ dilates vertically by a factor of $|a|$, a stretch when $|a|>1$ and a squeeze when $0<|a|<1$; points on the $x$-axis stay fixed. $y=f(bx)$ dilates horizontally by a factor of $\\tfrac{1}{|b|}$, a squeeze when $|b|>1$; points on the $y$-axis stay fixed.' },
      { title: 'Reflections', body: '$y=-f(x)$ reflects in the $x$-axis and $y=f(-x)$ reflects in the $y$-axis. $y=-(x+1)^2+4$ is $y=x^2$ reflected, then moved $1$ left and $4$ up.' },
      { title: 'Applying them to a point', body: 'To move a point $(x,y)$ on $y=f(x)$ to its image on $y=af(x-h)+k$, the new $x$ is $x+h$ and the new $y$ is $ay+k$. Do the stretch before the shift.' }
    ],
    definitions: [
      { term: 'Translation', meaning: 'A shift of the whole graph without changing its shape or size.' },
      { term: 'Dilation', meaning: 'A stretch or squeeze of the graph away from or towards an axis by a constant factor.' },
      { term: 'Reflection', meaning: 'A flip of the graph in an axis, which reverses its orientation.' }
    ],
    formulas: [
      { label: 'General transformation of $y=f(x)$', tex: 'y=a\\,f\\big(b(x-h)\\big)+k' },
      { label: 'Image of a point $(x,y)$', tex: '(x,\\,y)\\ \\longmapsto\\ \\left(\\dfrac{x}{b}+h,\\ ay+k\\right)' }
    ],
    points: [
      { front: 'Which way does $y=f(x+2)$ move the graph?', back: '$2$ units to the left. The sign inside the bracket is the opposite of the direction.' },
      { front: 'What does $y=-f(x)$ do?', back: 'Reflects the graph in the $x$-axis.' },
      { front: 'What does $y=f(2x)$ do to an $x$-intercept at $x=6$?', back: 'It moves it to $x=3$: horizontal distances halve.' },
      { front: 'What is the vertex of $y=a(x-h)^2+k$?', back: '$(h,k)$.' }
    ],
    mistakes: [
      { wrong: '$y=(x+3)^2$ is $y=x^2$ shifted $3$ to the right.', right: 'Setting $x+3=0$ gives $x=-3$, so the graph moves $3$ to the left.' },
      { wrong: '$y=f(2x)$ stretches the graph horizontally by a factor of $2$.', right: 'It squeezes it by a factor of $\\tfrac12$: each point is reached when $x$ is half as large.' },
      { wrong: 'Applying $+k$ before the vertical stretch $a$.', right: 'For $y=af(x)+k$ the stretch acts on $f(x)$ first, so $y=ay_0+k$, not $a(y_0+k)$.' }
    ],
    examples: [
      {
        question: 'The graph of $y=x^2$ is transformed to $y=2(x-3)^2-4$. Describe the transformation, state the vertex and find the $y$-intercept.',
        steps: ['Stretch vertically by a factor of $2$, then move $3$ right and $4$ down.', 'The vertex of $y=x^2$ at $(0,0)$ moves to $(3,-4)$.', 'At $x=0$: $y=2(0-3)^2-4=18-4=14$.'],
        answer: 'Vertex $(3,-4)$ and $y$-intercept $14$',
        working: '\\begin{aligned}\\text{vertex}&:(0,0)\\mapsto(3,-4)\\\\y(0)&=2(-3)^2-4\\\\&=18-4=14\\end{aligned}',
        verify: { kind: 'value', expr: '2*(0-3)^2-4', answer: '14' }
      },
      {
        question: 'The point $(2,5)$ lies on $y=f(x)$. Find its image on $y=2f(x-1)+3$.',
        steps: ['The shift of $1$ right changes the $x$-coordinate: $2+1=3$.', 'The new $y$-coordinate is $2\\times5+3=13$.', 'The image is $(3,13)$.'],
        answer: '$(3,13)$',
        working: '\\begin{aligned}x&:2\\mapsto2+1=3\\\\y&:5\\mapsto2(5)+3=13\\end{aligned}',
        verify: { kind: 'values', pairs: [['2+1', '3'], ['2*5+3', '13']] }
      },
      {
        question: 'Find the $x$-intercepts of $y=-(x+1)^2+4$.',
        steps: ['Set $y=0$: $(x+1)^2=4$.', 'Then $x+1=\\pm2$.', 'So $x=1$ or $x=-3$.'],
        answer: '$x=1$ and $x=-3$',
        working: '\\begin{aligned}-(x+1)^2+4&=0\\\\(x+1)^2&=4\\\\x+1&=\\pm2\\\\x&=1\\text{ or }-3\\end{aligned}',
        verify: { kind: 'roots', f: '-(x+1)^2+4', answers: ['1', '-3'] }
      }
    ],
    examiners: [
      'The order of the transformations is stated: stretch, then reflection, then translation.',
      'A shift inside a bracket is read against its sign, and the new vertex or key point is written as a coordinate pair.',
      'A transformed point has both coordinates tracked, $x$ and $y$ separately.',
      'A sketch labels the transformed intercepts and the vertex, not only the shape.'
    ],
    diagrams: [
      { title: 'Move and stretch the parabola', spec: { kind: 'transform', base: 'quadratic', show: ['a', 'h', 'k'], names: { a: 'a (vertical stretch)', h: 'h (shift right)', k: 'k (shift up)' }, initial: { a: 2, h: 3, k: -4 } }, note: 'With $a=2$, $h=3$, $k=-4$ the graph is $y=2(x-3)^2-4$, with vertex $(3,-4)$.' },
      { title: '$y=x^2$ and $y=2(x-3)^2-4$', spec: { kind: 'function', xmin: -2, xmax: 8, ymin: -6, ymax: 20, curves: [{ expr: 'x^2', tone: 'secondary', label: 'y=x^2' }, { expr: '2*(x-3)^2-4', intercepts: true, label: 'y=2(x-3)^2-4' }], points: [{ x: 3, y: -4, label: '(3,\\,-4)' }] }, note: 'The vertex $(0,0)$ moves to $(3,-4)$, and the $y$-intercept of the new curve is $14$.' }
    ],
    check: [
      { question: 'The point $(3,4)$ lies on $y=f(x)$. What is the $y$-coordinate of its image on $y=-f(x)+6$?', answer: '$2$', verify: { kind: 'value', expr: '-4+6', answer: '2' } },
      { question: 'For $y=(x-5)^2+1$, find $y$ when $x=7$.', answer: '$5$', verify: { kind: 'value', expr: '(7-5)^2+1', answer: '5' } }
    ]
  },

  'mav-11-04': {
    summary: 'Trigonometry in Year 11 widens from right-angled triangles to any triangle, and from degrees to radians. The sine rule, cosine rule and area formula solve triangles; radians turn arc length and sector area into short formulas.',
    prereqs: [],
    concepts: [
      { title: 'Radians', body: 'One radian is the angle at the centre of a circle that cuts off an arc equal to the radius. A half-turn is $\\pi$ radians, so $180^\\circ=\\pi$. Multiply degrees by $\\tfrac{\\pi}{180}$ to get radians: $150^\\circ=\\tfrac{5\\pi}{6}$.' },
      { title: 'Arcs and sectors', body: 'With $\\theta$ in radians, arc length is $l=r\\theta$ and sector area is $A=\\tfrac12r^2\\theta$. These formulas are only correct in radians.' },
      { title: 'Non-right-angled triangles', body: 'Use the sine rule when you know a side and its opposite angle. Use the cosine rule for two sides and the included angle, or for three sides. The area is $\\tfrac12ab\\sin C$. With the sine rule for an angle, a second triangle may fit: check whether $180^\\circ-\\theta$ also works.' },
      { title: 'Exact values', body: 'From the $30^\\circ$, $45^\\circ$ and $60^\\circ$ triangles: $\\sin30^\\circ=\\tfrac12$, $\\sin45^\\circ=\\tfrac{\\sqrt2}{2}$, $\\sin60^\\circ=\\tfrac{\\sqrt3}{2}$, and cosine reverses the list. On the unit circle the point at angle $\\theta$ is $(\\cos\\theta,\\sin\\theta)$, which extends the values to every quadrant.' }
    ],
    definitions: [
      { term: 'Radian', meaning: 'The angle subtended at the centre of a circle by an arc equal in length to the radius.' },
      { term: 'Included angle', meaning: 'The angle between two given sides of a triangle.' },
      { term: 'Reference angle', meaning: 'The acute angle between a terminal arm and the $x$-axis, used to find exact values in any quadrant.' }
    ],
    formulas: [
      { label: 'Degrees and radians', tex: '\\pi\\text{ rad}=180^\\circ' },
      { label: 'Arc length and sector area', tex: 'l=r\\theta,\\qquad A=\\tfrac12r^2\\theta' },
      { label: 'Sine rule', tex: '\\dfrac{a}{\\sin A}=\\dfrac{b}{\\sin B}=\\dfrac{c}{\\sin C}' },
      { label: 'Cosine rule', tex: 'c^2=a^2+b^2-2ab\\cos C' },
      { label: 'Area of a triangle', tex: 'A=\\tfrac12ab\\sin C' }
    ],
    points: [
      { front: 'Convert $150^\\circ$ to radians.', back: '$150\\times\\dfrac{\\pi}{180}=\\dfrac{5\\pi}{6}$.' },
      { front: 'When do you use the cosine rule?', back: 'For two sides and the included angle (to find the third side), or for all three sides (to find an angle).' },
      { front: 'What is $\\sin\\dfrac{\\pi}{6}$?', back: '$\\dfrac12$.' },
      { front: 'Why must $\\theta$ be in radians in $l=r\\theta$?', back: 'The formula follows from the definition of a radian: arc divided by radius.' }
    ],
    mistakes: [
      { wrong: 'Using $A=\\tfrac12r^2\\theta$ with $\\theta=60$ taken from degrees.', right: 'Convert first: $60^\\circ=\\tfrac{\\pi}{3}$, then $A=\\tfrac12r^2\\cdot\\tfrac{\\pi}{3}$.' },
      { wrong: 'Writing $c^2=a^2+b^2-2ab\\cos C$ as $c^2=(a^2+b^2-2ab)\\cos C$.', right: 'The cosine multiplies only the term $2ab$: evaluate $2ab\\cos C$ first, then subtract it from $a^2+b^2$.' },
      { wrong: 'Leaving a calculator in degree mode for a radian question.', right: 'Check the mode every time: $\\sin\\dfrac{\\pi}{6}=0.5$ only in radian mode.' }
    ],
    examples: [
      {
        question: 'A sector has radius $6$ cm and angle $\\dfrac{\\pi}{3}$. Find its arc length and area.',
        steps: ['Arc length: $l=r\\theta=6\\times\\dfrac{\\pi}{3}=2\\pi$.', 'Area: $A=\\tfrac12r^2\\theta=\\tfrac12\\times36\\times\\dfrac{\\pi}{3}=6\\pi$.', 'Numerically, $2\\pi\\approx6.28$ cm and $6\\pi\\approx18.85$ cm$^2$.'],
        answer: 'Arc length $2\\pi\\approx6.28$ cm; area $6\\pi\\approx18.85$ cm$^2$',
        working: '\\begin{aligned}l&=6\\times\\dfrac{\\pi}{3}=2\\pi\\\\A&=\\tfrac12(6)^2\\times\\dfrac{\\pi}{3}=6\\pi\\end{aligned}',
        verify: { kind: 'values', pairs: [['6*(pi/3)', '2*pi'], ['0.5*6^2*(pi/3)', '6*pi'], ['2*pi', '6.283185307'], ['6*pi', '18.849555922']] }
      },
      {
        question: 'In a triangle, $a=7$ cm, $b=9$ cm and the included angle is $C=60^\\circ$. Find the length of side $c$.',
        steps: ['Cosine rule: $c^2=a^2+b^2-2ab\\cos C$.', 'Substitute: $c^2=49+81-2(7)(9)\\cos60^\\circ=130-63=67$.', 'So $c=\\sqrt{67}\\approx8.19$ cm.'],
        answer: '$c=\\sqrt{67}\\approx8.19$ cm',
        working: '\\begin{aligned}c^2&=7^2+9^2-2(7)(9)\\cos60^\\circ\\\\&=49+81-63\\\\&=67\\\\c&=\\sqrt{67}\\approx8.19\\end{aligned}',
        verify: { kind: 'value', expr: 'sqrt(7^2+9^2-2*7*9*cos(pi/3))', answer: '8.185352772' }
      },
      {
        question: 'Find the area of a triangle with two sides $8$ cm and $11$ cm and included angle $30^\\circ$.',
        steps: ['Use $A=\\tfrac12ab\\sin C$.', 'Substitute: $A=\\tfrac12(8)(11)\\sin30^\\circ$.', 'Since $\\sin30^\\circ=\\tfrac12$, $A=44\\times\\tfrac12=22$ cm$^2$.'],
        answer: '$22$ cm$^2$',
        working: '\\begin{aligned}A&=\\tfrac12(8)(11)\\sin30^\\circ\\\\&=44\\times\\tfrac12\\\\&=22\\end{aligned}',
        verify: { kind: 'value', expr: '0.5*8*11*sin(pi/6)', answer: '22' }
      }
    ],
    examiners: [
      'The formula is quoted in its general form and then the values are substituted before any calculation.',
      'Angles in radian questions are exact multiples of $\\pi$ until the final line, and the answer has units.',
      'The mode of the calculator matches the question, and a rounded answer is not used in a later step.',
      'For the sine rule, the reasoning about the possible second angle $180^\\circ-\\theta$ is stated.'
    ],
    diagrams: [
      { title: 'The triangle $a=7$, $b=9$, $C=60^\\circ$', spec: { kind: 'triangle', a: 7, b: 9, C: 60 }, note: 'The third side is $\\sqrt{67}\\approx8.19$ cm, and the area is $\\tfrac12(7)(9)\\sin60^\\circ\\approx27.3$ cm$^2$.' },
      { title: 'The point at $150^\\circ$ on the unit circle', spec: { kind: 'unitCircleDrag', initial: 150 }, note: 'At $150^\\circ$ the point is $\\left(-\\tfrac{\\sqrt3}{2},\\tfrac12\\right)$, so $\\sin150^\\circ=\\tfrac12$ and $\\cos150^\\circ=-\\tfrac{\\sqrt3}{2}$.' }
    ],
    check: [
      { question: 'Express $150^\\circ$ in radians.', answer: '$\\dfrac{5\\pi}{6}$', verify: { kind: 'value', expr: '150*pi/180', answer: '5*pi/6' } },
      { question: 'In a triangle $a=10$, $A=30^\\circ$ and $B=45^\\circ$. Find $b$.', answer: '$b=10\\sqrt2\\approx14.14$', verify: { kind: 'value', expr: '10*sin(pi/4)/sin(pi/6)', answer: '10*sqrt(2)' } }
    ]
  },

  'mav-11-05': {
    summary: 'The sine, cosine and tangent are periodic functions with graphs you can transform, and identities such as $\\sin^2\\theta+\\cos^2\\theta=1$ let you simplify and solve. Equations are solved by finding the reference angle, then using the quadrant to list every solution in the given interval.',
    prereqs: ['mav-11-04'],
    concepts: [
      { title: 'Graphs of trigonometric functions', body: 'For $y=a\\sin(bx)+d$ the amplitude is $|a|$, the period is $\\dfrac{2\\pi}{b}$ and the midline is $y=d$. Tangent has period $\\dfrac{\\pi}{b}$ and vertical asymptotes. Replacing $x$ by $x-c$ shifts the graph $c$ to the right.' },
      { title: 'Identities', body: 'Two identities carry the course: $\\tan\\theta=\\dfrac{\\sin\\theta}{\\cos\\theta}$ and $\\sin^2\\theta+\\cos^2\\theta=1$. Rearranged, $1-\\cos^2\\theta=\\sin^2\\theta$. To prove an identity, work on one side only until it matches the other.' },
      { title: 'Solving equations', body: 'Isolate the trigonometric ratio, find the acute reference angle, then use the quadrant (sine positive in quadrants 1 and 2, cosine in 1 and 4, tangent in 1 and 3) to list all angles in the interval. When the equation is quadratic in $\\sin x$ or $\\cos x$, factorise first.' }
    ],
    definitions: [
      { term: 'Amplitude', meaning: 'Half the distance between the maximum and minimum of a sine or cosine graph.' },
      { term: 'Period', meaning: 'The length of one complete cycle of a periodic function.' },
      { term: 'Identity', meaning: 'An equation that is true for every value of the variable for which both sides are defined.' }
    ],
    formulas: [
      { label: 'Pythagorean identity', tex: '\\sin^2\\theta+\\cos^2\\theta=1' },
      { label: 'Tangent identity', tex: '\\tan\\theta=\\dfrac{\\sin\\theta}{\\cos\\theta}' },
      { label: 'Period of $\\sin bx$ and $\\tan bx$', tex: 'T_{\\sin}=\\dfrac{2\\pi}{b},\\qquad T_{\\tan}=\\dfrac{\\pi}{b}' }
    ],
    points: [
      { front: 'What is the amplitude of $y=3\\sin2x$?', back: '$3$. The period is $\\dfrac{2\\pi}{2}=\\pi$.' },
      { front: 'Solutions of $\\sin x=\\tfrac12$ for $0\\le x\\le2\\pi$?', back: '$x=\\dfrac{\\pi}{6}$ and $\\dfrac{5\\pi}{6}$.' },
      { front: 'If $\\sin\\theta=\\tfrac35$ and $\\theta$ is acute, what is $\\cos\\theta$?', back: '$\\tfrac45$, from $\\cos^2\\theta=1-\\tfrac{9}{25}$.' },
      { front: 'Why can you not divide both sides of an equation by $\\cos x$?', back: 'You could lose the solutions where $\\cos x=0$. Factorise instead.' }
    ],
    mistakes: [
      { wrong: 'Solving $2\\sin x=1$ and giving only $x=\\dfrac{\\pi}{6}$.', right: 'Sine is also positive in quadrant 2, so $x=\\dfrac{5\\pi}{6}$ is a second solution in $[0,2\\pi]$.' },
      { wrong: '$\\sin^2\\theta=\\sin\\theta^2$.', right: '$\\sin^2\\theta$ means $(\\sin\\theta)^2$. The squaring applies to the value of the sine.' },
      { wrong: 'Proving an identity by moving terms across the equals sign.', right: 'Start from one side and transform it step by step until it equals the other side.' }
    ],
    examples: [
      {
        question: 'Solve $2\\sin x=1$ for $0\\le x\\le2\\pi$.',
        steps: ['Isolate: $\\sin x=\\tfrac12$.', 'The reference angle is $\\dfrac{\\pi}{6}$.', 'Sine is positive in quadrants 1 and 2: $x=\\dfrac{\\pi}{6}$ and $x=\\pi-\\dfrac{\\pi}{6}=\\dfrac{5\\pi}{6}$.'],
        answer: '$x=\\dfrac{\\pi}{6}$ or $x=\\dfrac{5\\pi}{6}$',
        working: '\\begin{aligned}\\sin x&=\\tfrac12\\\\x&=\\dfrac{\\pi}{6},\\ \\pi-\\dfrac{\\pi}{6}\\\\&=\\dfrac{\\pi}{6},\\ \\dfrac{5\\pi}{6}\\end{aligned}',
        verify: { kind: 'roots', f: '2*sin(x)-1', answers: ['pi/6', '5*pi/6'] }
      },
      {
        question: 'Solve $2\\cos^2x-\\cos x-1=0$ for $0\\le x\\le2\\pi$.',
        steps: ['Factorise as a quadratic in $\\cos x$: $(2\\cos x+1)(\\cos x-1)=0$.', 'If $\\cos x=-\\tfrac12$, the reference angle is $\\tfrac{\\pi}{3}$ and cosine is negative in quadrants 2 and 3: $x=\\tfrac{2\\pi}{3},\\tfrac{4\\pi}{3}$.', 'If $\\cos x=1$, then $x=0$ or $x=2\\pi$.'],
        answer: '$x=0,\\ \\dfrac{2\\pi}{3},\\ \\dfrac{4\\pi}{3},\\ 2\\pi$',
        working: '\\begin{aligned}(2\\cos x+1)(\\cos x-1)&=0\\\\\\cos x=-\\tfrac12&\\Rightarrow x=\\tfrac{2\\pi}{3},\\tfrac{4\\pi}{3}\\\\\\cos x=1&\\Rightarrow x=0,\\ 2\\pi\\end{aligned}',
        verify: { kind: 'roots', f: '2*cos(x)^2-cos(x)-1', answers: ['0', '2*pi/3', '4*pi/3', '2*pi'] }
      },
      {
        question: 'Prove that $\\dfrac{1-\\cos^2\\theta}{\\sin\\theta}=\\sin\\theta$.',
        steps: ['From $\\sin^2\\theta+\\cos^2\\theta=1$, the numerator is $1-\\cos^2\\theta=\\sin^2\\theta$.', 'So the left side is $\\dfrac{\\sin^2\\theta}{\\sin\\theta}$.', 'Cancel $\\sin\\theta$ (it is non-zero where the expression is defined): this equals $\\sin\\theta$, the right side.'],
        answer: 'The left side simplifies to $\\sin\\theta$, as required',
        working: '\\begin{aligned}\\text{LHS}&=\\dfrac{1-\\cos^2\\theta}{\\sin\\theta}\\\\&=\\dfrac{\\sin^2\\theta}{\\sin\\theta}\\\\&=\\sin\\theta=\\text{RHS}\\end{aligned}',
        verify: { kind: 'equivalent', a: '(1-cos(x)^2)/sin(x)', b: 'sin(x)' }
      }
    ],
    examiners: [
      'The reference angle is stated, then each quadrant is named when the other solutions are found.',
      'Every solution in the interval is listed, including the endpoints $0$ and $2\\pi$ when they satisfy the equation.',
      'An identity is proved by working on one side only, with the identity used named at each step.',
      'A quadratic trigonometric equation is factorised, not divided through by a trigonometric function.'
    ],
    diagrams: [
      { title: 'The graph of $y=3\\sin2x$', spec: { kind: 'trig', fn: 'sin', a: 3, b: 2 }, note: 'The amplitude is $3$ and the period is $\\pi$, so the curve completes two cycles between $0$ and $2\\pi$.' },
      { title: 'Change the amplitude and shifts of $\\sin x$', spec: { kind: 'transform', base: 'sin', show: ['a', 'h', 'k'], initial: { a: 2, h: 0, k: 1 } }, note: 'With $a=2$ and $k=1$ the graph is $y=2\\sin x+1$: amplitude $2$, midline $y=1$.' }
    ],
    check: [
      { question: 'Solve $2\\cos x=\\sqrt3$ for $0\\le x\\le2\\pi$.', answer: '$x=\\dfrac{\\pi}{6}$ or $\\dfrac{11\\pi}{6}$', verify: { kind: 'roots', f: '2*cos(x)-sqrt(3)', answers: ['pi/6', '11*pi/6'] } },
      { question: 'If $\\sin\\theta=\\tfrac35$ and $\\theta$ is acute, find $\\cos\\theta$.', answer: '$\\tfrac45$', verify: { kind: 'value', expr: 'sqrt(1-(3/5)^2)', answer: '4/5' } }
    ]
  },

  'mav-11-06': {
    summary: 'The derivative is the gradient of a curve at a point, found as the limit of the gradient of a secant. Once the power rule is in hand, differentiation gives the gradient function, tangents and normals, and the rate at which one quantity changes with another.',
    prereqs: ['mav-11-01'],
    concepts: [
      { title: 'Gradient as a limit', body: 'The gradient of the secant through $(x,f(x))$ and $(x+h,f(x+h))$ is $\\dfrac{f(x+h)-f(x)}{h}$. As $h\\to0$ the secant becomes the tangent, and the limit is the derivative $f\'(x)$. This is differentiation from first principles.' },
      { title: 'The power rule', body: 'For $y=x^n$, $\\dfrac{dy}{dx}=nx^{n-1}$. Constants multiply through and a sum is differentiated term by term, so $y=4x^3-6x^2+5x-7$ has $y\'=12x^2-12x+5$. Write roots and reciprocals as powers first: $\\dfrac{1}{x^2}=x^{-2}$.' },
      { title: 'Tangents and normals', body: 'The tangent at $x=a$ passes through $(a,f(a))$ with gradient $f\'(a)$. The normal is perpendicular, so its gradient is $-\\dfrac{1}{f\'(a)}$. Use $y-y_1=m(x-x_1)$ for both. If $f\'(a)=0$ the tangent is horizontal and the normal is the vertical line $x=a$.' }
    ],
    definitions: [
      { term: 'Derivative', meaning: 'The function $f\'(x)$ giving the gradient of $y=f(x)$ at each point; the limit of the secant gradient as $h\\to0$.' },
      { term: 'Tangent', meaning: 'The line that touches a curve at a point and has the same gradient as the curve there.' },
      { term: 'Normal', meaning: 'The line through a point of a curve perpendicular to the tangent at that point.' }
    ],
    formulas: [
      { label: 'First principles', tex: 'f\'(x)=\\lim_{h\\to0}\\dfrac{f(x+h)-f(x)}{h}' },
      { label: 'Power rule', tex: '\\dfrac{d}{dx}\\big(ax^n\\big)=anx^{n-1}' },
      { label: 'Tangent and normal', tex: 'y-y_1=m(x-x_1),\\qquad m_{\\text{normal}}=-\\dfrac{1}{m_{\\text{tangent}}}' }
    ],
    points: [
      { front: 'Differentiate $x^5$.', back: '$5x^4$.' },
      { front: 'What does $f\'(2)=-3$ tell you?', back: 'The tangent at $x=2$ has gradient $-3$, so the curve is falling there.' },
      { front: 'The tangent has gradient $2$. What is the normal\'s gradient?', back: '$-\\tfrac12$.' },
      { front: 'Differentiate $\\dfrac{5}{x^2}$.', back: 'Write it as $5x^{-2}$, then $-10x^{-3}=-\\dfrac{10}{x^3}$.' }
    ],
    mistakes: [
      { wrong: 'Differentiating $\\dfrac{1}{x^2}$ as $\\dfrac{1}{2x}$.', right: 'Write $x^{-2}$ first: the derivative is $-2x^{-3}$.' },
      { wrong: 'The derivative of a constant like $7$ is $7$.', right: 'A constant does not change, so its derivative is $0$.' },
      { wrong: 'The normal has gradient $-m$.', right: 'The normal has gradient $-\\dfrac1m$, the negative reciprocal.' }
    ],
    examples: [
      {
        question: 'Differentiate $f(x)=x^2$ from first principles and find the gradient at $x=3$.',
        steps: ['$\\dfrac{f(x+h)-f(x)}{h}=\\dfrac{(x+h)^2-x^2}{h}=\\dfrac{2xh+h^2}{h}=2x+h$.', 'As $h\\to0$, this tends to $2x$, so $f\'(x)=2x$.', 'At $x=3$ the gradient is $6$.'],
        answer: '$f\'(x)=2x$ and the gradient at $x=3$ is $6$',
        working: '\\begin{aligned}\\dfrac{(x+h)^2-x^2}{h}&=\\dfrac{2xh+h^2}{h}\\\\&=2x+h\\to2x\\\\f\'(3)&=6\\end{aligned}',
        verify: { kind: 'values', pairs: [['((3+0.0001)^2-(3-0.0001)^2)/(2*0.0001)', '6'], ['2*3', '6']] }
      },
      {
        question: 'Differentiate $y=4x^3-6x^2+5x-7$ and find the gradient at $x=2$.',
        steps: ['Differentiate each term: $12x^2-12x+5$.', 'Substitute $x=2$: $12(4)-12(2)+5=48-24+5$.', 'The gradient is $29$.'],
        answer: '$\\dfrac{dy}{dx}=12x^2-12x+5$, and the gradient at $x=2$ is $29$',
        working: '\\begin{aligned}\\dfrac{dy}{dx}&=12x^2-12x+5\\\\\\left.\\dfrac{dy}{dx}\\right|_{x=2}&=48-24+5\\\\&=29\\end{aligned}',
        verify: { kind: 'value', expr: '((4*(2.0001)^3-6*(2.0001)^2+5*(2.0001)-7)-(4*(1.9999)^3-6*(1.9999)^2+5*(1.9999)-7))/0.0002', answer: '29' }
      },
      {
        question: 'Find the equation of the tangent to $y=x^2-4x+7$ at the point where $x=3$.',
        steps: ['At $x=3$, $y=9-12+7=4$, so the point is $(3,4)$.', 'The derivative is $\\dfrac{dy}{dx}=2x-4$, so the gradient is $2$.', 'Then $y-4=2(x-3)$, giving $y=2x-2$.'],
        answer: '$y=2x-2$',
        working: '\\begin{aligned}y(3)&=9-12+7=4\\\\m&=2(3)-4=2\\\\y-4&=2(x-3)\\\\y&=2x-2\\end{aligned}',
        verify: { kind: 'values', pairs: [['3^2-4*3+7', '4'], ['2*3-4', '2'], ['2*3-2', '4']] }
      }
    ],
    examiners: [
      'First-principles working shows the expanded numerator, the cancelled $h$, and the limit statement.',
      'The point of tangency is found by substitution into the curve, and the gradient by substitution into the derivative.',
      'The tangent equation is written in a final form such as $y=2x-2$, after the point-gradient form.',
      'Powers with negative or fractional indices are rewritten before differentiating.'
    ],
    diagrams: [
      { title: 'The secant becoming the tangent on $y=x^2$ at $x=1$', spec: { kind: 'secantToTangent', expr: 'x^2', x0: 1, xmin: -1, xmax: 4, ymin: -1, ymax: 10 }, note: 'The secant through $x=1$ and $x=2$ has gradient $3$; with $h=0.1$ it is $2.1$. The tangent at $x=1$ has gradient $2$.' },
      { title: 'The tangent $y=2x-2$ to $y=x^2-4x+7$', spec: { kind: 'function', xmin: -1, xmax: 6, ymin: -2, ymax: 20, curves: [{ expr: 'x^2-4*x+7', label: 'y=x^2-4x+7' }, { expr: '2*x-2', tone: 'secondary', label: 'y=2x-2' }], points: [{ x: 3, y: 4, label: '(3,\\,4)' }] }, note: 'The line touches the curve at $(3,4)$ and has gradient $2$.' }
    ],
    check: [
      { question: 'Find the gradient of $y=5x^2-x$ at $x=1$.', answer: '$9$', verify: { kind: 'value', expr: '((5*(1.0001)^2-1.0001)-(5*(0.9999)^2-0.9999))/0.0002', answer: '9' } },
      { question: 'Find the gradient of $y=x^3$ at $x=-2$.', answer: '$12$', verify: { kind: 'value', expr: '((-2+0.0001)^3-(-2-0.0001)^3)/0.0002', answer: '12' } }
    ]
  },

  'mav-11-07': {
    summary: 'Exponential functions model growth and decay, and logarithms are their inverses. The laws of indices become the laws of logarithms, which are the tool for solving any equation where the unknown is an index.',
    prereqs: ['mav-11-01'],
    concepts: [
      { title: 'Exponential functions', body: 'For $y=a^x$ with $a>0$ and $a\\neq1$, the graph passes through $(0,1)$ and has the $x$-axis as a horizontal asymptote. It rises when $a>1$ and falls when $0<a<1$. The number $e\\approx2.718$ is the base used for continuous growth, as in $P=P_0e^{kt}$.' },
      { title: 'Logarithms', body: '$\\log_ax=y$ means $a^y=x$. So $\\log_28=3$ because $2^3=8$. The graph of $y=\\log_ax$ is the reflection of $y=a^x$ in $y=x$, with the $y$-axis as its vertical asymptote and an $x$-intercept at $(1,0)$.' },
      { title: 'Logarithm laws', body: 'Logarithms of a product add, of a quotient subtract, and a power comes down as a multiplier. The argument of a logarithm must be positive, so an equation solved with logarithm laws needs every solution checked against the original.' },
      { title: 'Solving', body: 'To solve $3^x=20$ take logarithms of both sides: $x=\\dfrac{\\ln20}{\\ln3}$. For a logarithmic equation, combine the logarithms into one, rewrite in index form, solve, then reject any value that makes an argument negative or zero.' }
    ],
    definitions: [
      { term: 'Logarithm', meaning: 'The index to which a base must be raised to give a number: $\\log_ax=y$ means $a^y=x$.' },
      { term: 'Natural logarithm', meaning: 'The logarithm to base $e$, written $\\ln x$.' },
      { term: 'Horizontal asymptote', meaning: 'A horizontal line that a graph approaches but does not reach, such as $y=0$ for $y=2^x$.' }
    ],
    formulas: [
      { label: 'Product, quotient and power laws', tex: '\\log_axy=\\log_ax+\\log_ay,\\quad\\log_a\\dfrac{x}{y}=\\log_ax-\\log_ay,\\quad\\log_ax^n=n\\log_ax' },
      { label: 'Change of base', tex: '\\log_ax=\\dfrac{\\ln x}{\\ln a}' },
      { label: 'Inverse relationship', tex: 'a^{\\log_ax}=x,\\qquad\\log_a(a^x)=x' }
    ],
    points: [
      { front: 'Evaluate $\\log_5125$.', back: '$3$, because $5^3=125$.' },
      { front: 'What is $\\log_a1$?', back: '$0$ for every valid base, because $a^0=1$.' },
      { front: 'Where does $y=2^x$ cross the $y$-axis?', back: 'At $(0,1)$.' },
      { front: 'Can $\\log_2(-4)$ be evaluated?', back: 'No. The argument of a logarithm must be positive.' }
    ],
    mistakes: [
      { wrong: '$\\log(x+y)=\\log x+\\log y$.', right: 'The product law is $\\log(xy)=\\log x+\\log y$. There is no law for a logarithm of a sum.' },
      { wrong: 'Keeping both solutions of $x^2-2x-8=0$ when it came from $\\log_2x+\\log_2(x-2)=3$.', right: '$x=-2$ makes $\\log_2x$ undefined, so only $x=4$ is valid.' },
      { wrong: '$\\dfrac{\\log_a x}{\\log_a y}=\\log_a x-\\log_a y$.', right: '$\\dfrac{\\log_a x}{\\log_a y}$ is a quotient of logarithms and cannot be simplified. The quotient law is $\\log_a\\dfrac{x}{y}=\\log_ax-\\log_ay$.' }
    ],
    examples: [
      {
        question: 'Solve $3^x=20$, correct to two decimal places.',
        steps: ['Take natural logarithms of both sides: $x\\ln3=\\ln20$.', 'So $x=\\dfrac{\\ln20}{\\ln3}$.', 'Evaluate: $x\\approx2.73$.'],
        answer: '$x=\\dfrac{\\ln20}{\\ln3}\\approx2.73$',
        working: '\\begin{aligned}3^x&=20\\\\x\\ln3&=\\ln20\\\\x&=\\dfrac{\\ln20}{\\ln3}\\approx2.73\\end{aligned}',
        verify: { kind: 'roots', f: '3^x-20', answers: ['ln(20)/ln(3)'] }
      },
      {
        question: 'Solve $\\log_2x+\\log_2(x-2)=3$.',
        steps: ['Combine: $\\log_2\\big(x(x-2)\\big)=3$, so $x(x-2)=2^3=8$.', 'Then $x^2-2x-8=0$, so $(x-4)(x+2)=0$.', 'Test $x=-2$: $\\log_2(-2)$ is undefined, so reject it. Only $x=4$ is valid.'],
        answer: '$x=4$',
        working: '\\begin{aligned}\\log_2\\big(x(x-2)\\big)&=3\\\\x^2-2x&=8\\\\(x-4)(x+2)&=0\\\\x&=4\\ (x=-2\\text{ rejected})\\end{aligned}',
        verify: { kind: 'values', pairs: [['ln(4)/ln(2)+ln(4-2)/ln(2)', '3']] }
      },
      {
        question: 'A population is $P=500e^{0.04t}$ after $t$ years. When will it reach $1000$?',
        steps: ['Set $500e^{0.04t}=1000$, so $e^{0.04t}=2$.', 'Take natural logarithms: $0.04t=\\ln2$.', 'Hence $t=\\dfrac{\\ln2}{0.04}\\approx17.3$ years.'],
        answer: '$t=\\dfrac{\\ln2}{0.04}\\approx17.3$ years',
        working: '\\begin{aligned}500e^{0.04t}&=1000\\\\e^{0.04t}&=2\\\\0.04t&=\\ln2\\\\t&=\\dfrac{\\ln2}{0.04}\\approx17.3\\end{aligned}',
        verify: { kind: 'roots', f: '500*e^(0.04*t)-1000', var: 't', answers: ['ln(2)/0.04'] }
      }
    ],
    examiners: [
      'The logarithm law used is named, and the equation is reduced to one logarithm before converting to index form.',
      'Solutions to logarithmic equations are checked against the domain and the rejected value is stated.',
      'An exact answer such as $\\dfrac{\\ln20}{\\ln3}$ is given before its decimal approximation.',
      'In a growth problem, the units of $t$ are stated in the answer.'
    ],
    diagrams: [
      { title: '$y=2^x$ and its inverse $y=\\log_2x$', spec: { kind: 'function', xmin: -3, xmax: 6, ymin: -3, ymax: 6, curves: [{ expr: '2^x', label: 'y=2^x' }, { expr: 'ln(x)/ln(2)', label: 'y=\\log_2x' }, { expr: 'x', tone: 'secondary' }], asymptotes: [{ y: 0 }, { x: 0 }], points: [{ x: 1, y: 2, label: '(1,\\,2)' }, { x: 2, y: 1, label: '(2,\\,1)' }] }, note: 'The point $(1,2)$ on $y=2^x$ reflects in $y=x$ to $(2,1)$ on $y=\\log_2x$. The asymptotes are $y=0$ and $x=0$.' }
    ],
    check: [
      { question: 'Solve $2^{x+1}=32$.', answer: '$x=4$', verify: { kind: 'roots', f: '2^(x+1)-32', answers: ['4'] } },
      { question: 'Evaluate $\\log_5125$.', answer: '$3$', verify: { kind: 'value', expr: 'ln(125)/ln(5)', answer: '3' } }
    ]
  },

  'mav-11-09': {
    summary: 'Probability for combined events uses the addition rule, conditional probability and independence, often through tree diagrams. Data analysis summarises a set of values by its quartiles and spread, and uses the interquartile range to flag outliers.',
    prereqs: [],
    concepts: [
      { title: 'The addition rule', body: 'For any two events, $P(A\\cup B)=P(A)+P(B)-P(A\\cap B)$. The overlap is subtracted because it is counted in both $P(A)$ and $P(B)$. For mutually exclusive events $P(A\\cap B)=0$.' },
      { title: 'Conditional probability and independence', body: '$P(A\\mid B)=\\dfrac{P(A\\cap B)}{P(B)}$ is the probability of $A$ given that $B$ has happened. Events are independent exactly when $P(A\\cap B)=P(A)P(B)$, which is the same as $P(A\\mid B)=P(A)$.' },
      { title: 'Tree diagrams', body: 'Multiply along the branches for a path and add the paths that make the event. Without replacement, the second set of branches changes, because one item has gone.' },
      { title: 'Summarising data', body: 'Order the data, find the median and the lower and upper quartiles $Q_1$ and $Q_3$ (the medians of the lower and upper halves). The interquartile range is $\\text{IQR}=Q_3-Q_1$. A value is an outlier if it is below $Q_1-1.5\\times\\text{IQR}$ or above $Q_3+1.5\\times\\text{IQR}$.' }
    ],
    definitions: [
      { term: 'Mutually exclusive events', meaning: 'Events that cannot both happen, so $P(A\\cap B)=0$.' },
      { term: 'Independent events', meaning: 'Events where the outcome of one does not change the probability of the other.' },
      { term: 'Interquartile range', meaning: 'The spread of the middle half of the data, $Q_3-Q_1$.' }
    ],
    formulas: [
      { label: 'Addition rule', tex: 'P(A\\cup B)=P(A)+P(B)-P(A\\cap B)' },
      { label: 'Conditional probability', tex: 'P(A\\mid B)=\\dfrac{P(A\\cap B)}{P(B)}' },
      { label: 'Outlier fences', tex: 'Q_1-1.5\\,\\text{IQR}\\ \\ \\text{and}\\ \\ Q_3+1.5\\,\\text{IQR}' }
    ],
    points: [
      { front: 'If $A$ and $B$ are independent, what is $P(A\\cap B)$?', back: '$P(A)\\times P(B)$.' },
      { front: 'When do you add branch probabilities in a tree?', back: 'When several different paths all give the event, add the products of those paths.' },
      { front: 'What does $P(A\\mid B)$ mean?', back: 'The probability of $A$ given $B$ has occurred, so the sample space shrinks to $B$.' },
      { front: 'What is an outlier by the $1.5\\times\\text{IQR}$ rule?', back: 'A value more than $1.5$ IQRs below $Q_1$ or above $Q_3$.' }
    ],
    mistakes: [
      { wrong: 'Using $P(A\\cup B)=P(A)+P(B)$ when the events overlap.', right: 'Subtract $P(A\\cap B)$, or the overlap is counted twice.' },
      { wrong: 'Treating mutually exclusive as the same as independent.', right: 'Exclusive events with positive probabilities are dependent: if one happens the other cannot.' },
      { wrong: 'Using $\\tfrac{4}{10}$ for both draws without replacement.', right: 'After a red counter is removed, the second draw is from $9$ counters: $\\tfrac{3}{9}$ red.' }
    ],
    examples: [
      {
        question: 'Given $P(A)=0.5$, $P(B)=0.4$ and $P(A\\cap B)=0.2$, find $P(A\\cup B)$ and $P(A\\mid B)$, and decide whether $A$ and $B$ are independent.',
        steps: ['$P(A\\cup B)=0.5+0.4-0.2=0.7$.', '$P(A\\mid B)=\\dfrac{0.2}{0.4}=0.5$.', 'Since $P(A)P(B)=0.5\\times0.4=0.2=P(A\\cap B)$ (and $P(A\\mid B)=P(A)$), the events are independent.'],
        answer: '$P(A\\cup B)=0.7$, $P(A\\mid B)=0.5$, and $A$, $B$ are independent',
        working: '\\begin{aligned}P(A\\cup B)&=0.5+0.4-0.2=0.7\\\\P(A\\mid B)&=\\dfrac{0.2}{0.4}=0.5\\\\P(A)P(B)&=0.2=P(A\\cap B)\\end{aligned}',
        verify: { kind: 'values', pairs: [['0.5+0.4-0.2', '0.7'], ['0.2/0.4', '0.5'], ['0.5*0.4', '0.2']] }
      },
      {
        question: 'A bag holds $4$ red and $6$ blue counters. Two are drawn without replacement. Find the probability that both are red, and the probability that they are different colours.',
        steps: ['Both red: $\\tfrac{4}{10}\\times\\tfrac{3}{9}=\\tfrac{12}{90}=\\tfrac{2}{15}$.', 'Red then blue: $\\tfrac{4}{10}\\times\\tfrac{6}{9}=\\tfrac{24}{90}$; blue then red is also $\\tfrac{24}{90}$.', 'Add the two paths: $\\tfrac{48}{90}=\\tfrac{8}{15}$.'],
        answer: '$P(\\text{both red})=\\tfrac{2}{15}$ and $P(\\text{different colours})=\\tfrac{8}{15}$',
        working: '\\begin{aligned}P(RR)&=\\tfrac{4}{10}\\times\\tfrac{3}{9}=\\tfrac{2}{15}\\\\P(RB)+P(BR)&=2\\times\\tfrac{4}{10}\\times\\tfrac{6}{9}\\\\&=\\tfrac{48}{90}=\\tfrac{8}{15}\\end{aligned}',
        verify: { kind: 'values', pairs: [['4/10*3/9', '2/15'], ['2*(4/10)*(6/9)', '8/15']] }
      },
      {
        question: 'Test the data $4,\\,7,\\,8,\\,9,\\,10,\\,12,\\,13,\\,30$ for outliers using the $1.5\\times\\text{IQR}$ rule.',
        steps: ['The lower half is $4,7,8,9$, so $Q_1=\\tfrac{7+8}{2}=7.5$. The upper half is $10,12,13,30$, so $Q_3=\\tfrac{12+13}{2}=12.5$.', '$\\text{IQR}=12.5-7.5=5$, and $1.5\\times5=7.5$.', 'The upper fence is $12.5+7.5=20$. The value $30$ exceeds it, so $30$ is an outlier. The lower fence is $0$, so nothing is low.'],
        answer: '$Q_1=7.5$, $Q_3=12.5$, IQR $=5$; the value $30$ is an outlier',
        working: '\\begin{aligned}Q_1&=7.5,\\quad Q_3=12.5\\\\\\text{IQR}&=5\\\\\\text{upper fence}&=12.5+1.5(5)=20\\\\30&>20\\end{aligned}',
        verify: { kind: 'values', pairs: [['(7+8)/2', '7.5'], ['(12+13)/2', '12.5'], ['12.5+1.5*(12.5-7.5)', '20']] }
      }
    ],
    examiners: [
      'The rule is written before the numbers go in, and an independence claim is backed by comparing $P(A)P(B)$ with $P(A\\cap B)$.',
      'In a tree, the denominators are updated for no replacement and the paths added are listed.',
      'The quartiles are found from the halves of the ordered data, and the fences are calculated, not estimated by eye.',
      'The conclusion about an outlier is stated against the fence it crosses.'
    ],
    diagrams: [
      { title: 'Two counters, no replacement', spec: { kind: 'tree', branches: [{ label: 'R', p: [2, 5], children: [{ label: 'R', p: [1, 3] }, { label: 'B', p: [2, 3] }] }, { label: 'B', p: [3, 5], children: [{ label: 'R', p: [4, 9] }, { label: 'B', p: [5, 9] }] }] }, note: 'The path $RR$ has probability $\\tfrac{2}{5}\\times\\tfrac{1}{3}=\\tfrac{2}{15}$. The paths $RB$ and $BR$ add to $\\tfrac{8}{15}$.' },
      { title: 'The data set as a box plot', spec: { kind: 'boxPlot', data: [4, 7, 8, 9, 10, 12, 13, 30] }, note: 'The median is $9.5$, the quartiles are $7.5$ and $12.5$, and $30$ lies beyond the upper fence of $20$.' }
    ],
    check: [
      { question: '$A$ and $B$ are independent with $P(A)=0.3$ and $P(B)=0.5$. Find $P(A\\cup B)$.', answer: '$0.65$', verify: { kind: 'value', expr: '0.3+0.5-0.3*0.5', answer: '0.65' } },
      { question: 'A fair coin is tossed three times. Find the probability of at least one head.', answer: '$\\tfrac78$', verify: { kind: 'value', expr: '1-(1/2)^3', answer: '7/8' } }
    ]
  },

  'mav-12-01': {
    summary: 'Year 12 extends transformations to trigonometric, exponential and absolute-value graphs, and uses them to model real situations. A model is a function whose parameters are read from the context: the midline, amplitude and period of a tide, the asymptote of a cooling curve.',
    prereqs: ['mav-11-03', 'mav-11-07'],
    concepts: [
      { title: 'Combined transformations', body: 'Read $y=a\\,f(b(x-h))+k$ from the inside out: shift and squeeze horizontally, then stretch and reflect vertically, then shift vertically. For $y=2^{x-3}+1$, the horizontal asymptote moves from $y=0$ to $y=1$ and the point $(0,1)$ moves to $(3,2)$.' },
      { title: 'Absolute value graphs', body: '$y=|f(x)|$ reflects the part of the graph below the $x$-axis upwards. $y=f(|x|)$ keeps the right side and copies it onto the left. $|x-3|=5$ means the distance from $3$ is $5$, so $x=8$ or $x=-2$.' },
      { title: 'Periodic models', body: 'For $y=a\\sin(bt)+d$, the midline is $d$, the maximum is $d+|a|$, the minimum is $d-|a|$ and the period is $\\dfrac{2\\pi}{b}$. Match these to the context: a period of $12$ hours gives $b=\\dfrac{2\\pi}{12}=\\dfrac{\\pi}{6}$.' }
    ],
    definitions: [
      { term: 'Midline', meaning: 'The horizontal line halfway between the maximum and minimum of a sine or cosine graph.' },
      { term: 'Model', meaning: 'A function chosen so that its parameters describe a real situation, and tested against the data.' },
      { term: 'Absolute value', meaning: 'The distance of a number from zero: $|x|=x$ when $x\\ge0$ and $|x|=-x$ when $x<0$.' }
    ],
    formulas: [
      { label: 'Sinusoidal model', tex: 'y=a\\sin\\big(b(t-c)\\big)+d,\\qquad T=\\dfrac{2\\pi}{b}' },
      { label: 'Maximum and minimum', tex: 'y_{\\max}=d+|a|,\\qquad y_{\\min}=d-|a|' },
      { label: 'Absolute value equation', tex: '|u|=m\\ (m>0)\\ \\Longleftrightarrow\\ u=m\\ \\text{or}\\ u=-m' }
    ],
    points: [
      { front: 'What is the period of $y=\\sin\\left(\\dfrac{\\pi t}{6}\\right)$?', back: '$\\dfrac{2\\pi}{\\pi/6}=12$.' },
      { front: 'What does $y=|f(x)|$ do to a graph?', back: 'Reflects the parts below the $x$-axis in the $x$-axis, so no value is negative.' },
      { front: 'Asymptote of $y=2^{x-3}+1$?', back: '$y=1$.' },
      { front: 'Maximum of $y=4\\cos x+1$?', back: '$5$.' }
    ],
    mistakes: [
      { wrong: 'Solving $|x-3|=5$ as $x-3=5$ only.', right: 'Both $x-3=5$ and $x-3=-5$ are valid: $x=8$ or $x=-2$.' },
      { wrong: 'Using $b=12$ for a model with a period of $12$ hours.', right: 'The period is $\\dfrac{2\\pi}{b}$, so $b=\\dfrac{2\\pi}{12}=\\dfrac{\\pi}{6}$.' },
      { wrong: 'Treating the asymptote of $y=2^x+1$ as $y=0$.', right: 'The $+1$ lifts the asymptote to $y=1$.' }
    ],
    examples: [
      {
        question: 'The depth of water at a jetty is $d(t)=5+2\\sin\\left(\\dfrac{\\pi t}{6}\\right)$ metres, $t$ hours after midnight, $0\\le t\\le12$. State the period and the maximum and minimum depths, and find when the depth is first $6$ metres.',
        steps: ['Period: $\\dfrac{2\\pi}{\\pi/6}=12$ hours. Maximum $5+2=7$ m and minimum $5-2=3$ m.', 'Set $5+2\\sin\\left(\\dfrac{\\pi t}{6}\\right)=6$, so $\\sin\\left(\\dfrac{\\pi t}{6}\\right)=\\tfrac12$.', 'Then $\\dfrac{\\pi t}{6}=\\dfrac{\\pi}{6}$ or $\\dfrac{5\\pi}{6}$, so $t=1$ or $t=5$. The first time is $t=1$, one hour after midnight.'],
        answer: 'Period $12$ h, maximum $7$ m, minimum $3$ m; depth is $6$ m at $t=1$ and again at $t=5$',
        working: '\\begin{aligned}T&=\\dfrac{2\\pi}{\\pi/6}=12\\\\\\sin\\dfrac{\\pi t}{6}&=\\tfrac12\\\\\\dfrac{\\pi t}{6}&=\\dfrac{\\pi}{6},\\ \\dfrac{5\\pi}{6}\\\\t&=1,\\ 5\\end{aligned}',
        verify: { kind: 'roots', f: '5+2*sin(pi*t/6)-6', var: 't', answers: ['1', '5'] }
      },
      {
        question: 'The graph of $y=2^x$ is transformed to $y=2^{x-3}+1$. State the horizontal asymptote and the $y$-intercept.',
        steps: ['The shift of $3$ right and $1$ up moves the asymptote $y=0$ to $y=1$.', 'At $x=0$: $y=2^{-3}+1=\\tfrac18+1$.', 'So the $y$-intercept is $\\tfrac98$.'],
        answer: 'Asymptote $y=1$; $y$-intercept $\\tfrac98$',
        working: '\\begin{aligned}y&=2^{x-3}+1\\\\y(0)&=2^{-3}+1\\\\&=\\tfrac18+1=\\tfrac98\\end{aligned}',
        verify: { kind: 'value', expr: '2^(0-3)+1', answer: '9/8' }
      },
      {
        question: 'Solve $|x-3|=5$.',
        steps: ['The distance from $x$ to $3$ is $5$.', 'So $x-3=5$ or $x-3=-5$.', 'Hence $x=8$ or $x=-2$.'],
        answer: '$x=8$ or $x=-2$',
        working: '\\begin{aligned}|x-3|&=5\\\\x-3&=5\\text{ or }x-3=-5\\\\x&=8\\text{ or }-2\\end{aligned}',
        verify: { kind: 'roots', f: 'abs(x-3)-5', answers: ['8', '-2'] }
      }
    ],
    examiners: [
      'The parameters $a$, $b$ and $d$ are identified from the context before the equation is written.',
      'A modelling answer is returned to the context, with units and in a sentence ("the first time is one hour after midnight").',
      'Every solution in the stated interval is found, and the question\'s wording ("first") picks the right one.',
      'Both cases of an absolute value equation are written and each solution is checked.'
    ],
    diagrams: [
      { title: 'The tide $d(t)=5+2\\sin\\left(\\dfrac{\\pi t}{6}\\right)$', spec: { kind: 'function', xmin: 0, xmax: 12, ymin: 0, ymax: 8, curves: [{ expr: '5+2*sin(pi*x/6)', label: 'd(t)' }, { expr: '6', tone: 'secondary' }], asymptotes: [{ y: 5, label: 'midline' }], points: [{ x: 3, y: 7, label: '(3,\\,7)' }, { x: 9, y: 3, label: '(9,\\,3)' }, { x: 1, y: 6, label: '(1,\\,6)' }] }, note: 'The midline is $5$, the maximum $7$ is at $t=3$ and the minimum $3$ at $t=9$. The line $d=6$ meets the curve at $t=1$ and $t=5$.' },
      { title: 'Shift $y=2^x$ right and up', spec: { kind: 'transform', base: 'exponential', show: ['h', 'k'], initial: { h: 3, k: 1 } }, note: 'With $h=3$ and $k=1$ the graph is $y=2^{x-3}+1$, with asymptote $y=1$.' }
    ],
    check: [
      { question: 'Solve $|2x-1|=7$.', answer: '$x=4$ or $x=-3$', verify: { kind: 'roots', f: 'abs(2*x-1)-7', answers: ['4', '-3'] } },
      { question: 'What is the maximum value of $y=4\\cos x+1$?', answer: '$5$', verify: { kind: 'value', expr: '4*cos(0)+1', answer: '5' } }
    ]
  },

  'mav-12-03': {
    summary: 'Arithmetic sequences change by adding a constant and geometric sequences by multiplying by a constant. Each has a formula for the $n$th term and for the sum, and a geometric series with $|r|<1$ has a limiting sum.',
    prereqs: ['mav-11-07'],
    concepts: [
      { title: 'Arithmetic sequences', body: 'Consecutive terms differ by a common difference $d$. The $n$th term is $T_n=a+(n-1)d$ and the sum of the first $n$ terms is $S_n=\\dfrac n2\\big(2a+(n-1)d\\big)=\\dfrac n2(a+l)$ where $l$ is the last term.' },
      { title: 'Geometric sequences', body: 'Consecutive terms are multiplied by a common ratio $r$. The $n$th term is $T_n=ar^{n-1}$, and the sum is $S_n=\\dfrac{a(r^n-1)}{r-1}$ for $r\\neq1$. Use whichever form has a positive denominator.' },
      { title: 'Limiting sum', body: 'When $|r|<1$ the terms shrink and the sum approaches $S_\\infty=\\dfrac{a}{1-r}$. The series $12+6+3+\\cdots$ has $a=12$, $r=\\tfrac12$, so $S_\\infty=24$. If $|r|\\ge1$ there is no limiting sum.' },
      { title: 'Recognising the type', body: 'Test the pattern: a constant difference is arithmetic, a constant ratio is geometric. Applications such as the growth of a single deposit, depreciation and repeated percentage change are geometric, and regular savings are a geometric series; fixed increments are arithmetic.' }
    ],
    definitions: [
      { term: 'Sequence', meaning: 'An ordered list of numbers, $T_1,T_2,T_3,\\ldots$.' },
      { term: 'Series', meaning: 'The sum of the terms of a sequence.' },
      { term: 'Limiting sum', meaning: 'The value $S_\\infty$ that the partial sums of a geometric series approach when $|r|<1$.' }
    ],
    formulas: [
      { label: 'Arithmetic sequence', tex: 'T_n=a+(n-1)d,\\qquad S_n=\\dfrac n2\\big(2a+(n-1)d\\big)' },
      { label: 'Geometric sequence', tex: 'T_n=ar^{n-1},\\qquad S_n=\\dfrac{a(r^n-1)}{r-1}' },
      { label: 'Limiting sum', tex: 'S_\\infty=\\dfrac{a}{1-r},\\qquad |r|<1' }
    ],
    points: [
      { front: 'The $20$th term of $7,11,15,\\ldots$?', back: '$7+19\\times4=83$.' },
      { front: 'When does a limiting sum exist?', back: 'For a geometric series with $|r|<1$.' },
      { front: 'How do you find $r$?', back: 'Divide any term by the one before it: $r=\\dfrac{T_2}{T_1}$.' },
      { front: 'How do you find the number of terms in $5+8+\\cdots+101$?', back: 'Solve $5+(n-1)\\times3=101$, giving $n=33$.' }
    ],
    mistakes: [
      { wrong: 'Using $T_n=a+nd$.', right: 'The first term has no difference added, so $T_n=a+(n-1)d$.' },
      { wrong: 'Using $S_\\infty=\\dfrac{a}{1-r}$ when $r=2$.', right: 'The formula only applies when $|r|<1$. With $r=2$ the terms grow and the sum has no limit.' },
      { wrong: 'Writing $ar^n$ for the $n$th term.', right: 'The first term is $ar^0$, so the $n$th is $ar^{n-1}$.' }
    ],
    examples: [
      {
        question: 'For the sequence $7,\\,11,\\,15,\\,\\ldots$ find the $20$th term and the sum of the first $20$ terms.',
        steps: ['It is arithmetic with $a=7$ and $d=4$.', '$T_{20}=7+19\\times4=83$.', '$S_{20}=\\dfrac{20}{2}\\big(2\\times7+19\\times4\\big)=10\\times90=900$.'],
        answer: '$T_{20}=83$ and $S_{20}=900$',
        working: '\\begin{aligned}T_{20}&=7+19(4)=83\\\\S_{20}&=\\dfrac{20}{2}\\big(2(7)+19(4)\\big)\\\\&=10(90)=900\\end{aligned}',
        verify: { kind: 'values', pairs: [['7+19*4', '83'], ['20/2*(2*7+19*4)', '900']] }
      },
      {
        question: 'Find the sum of the first $8$ terms of $3+6+12+\\cdots$.',
        steps: ['It is geometric with $a=3$ and $r=2$.', 'Use $S_n=\\dfrac{a(r^n-1)}{r-1}$ with $n=8$.', '$S_8=\\dfrac{3(2^8-1)}{2-1}=3\\times255=765$.'],
        answer: '$765$',
        working: '\\begin{aligned}S_8&=\\dfrac{3\\left(2^8-1\\right)}{2-1}\\\\&=3(255)\\\\&=765\\end{aligned}',
        verify: { kind: 'value', expr: '3*(2^8-1)/(2-1)', answer: '765' }
      },
      {
        question: 'Find the limiting sum of $12+6+3+\\cdots$.',
        steps: ['It is geometric with $a=12$ and $r=\\tfrac{6}{12}=\\tfrac12$.', 'Since $|r|<1$, the limiting sum exists.', '$S_\\infty=\\dfrac{12}{1-\\tfrac12}=24$.'],
        answer: '$24$',
        working: '\\begin{aligned}r&=\\tfrac{6}{12}=\\tfrac12\\\\S_\\infty&=\\dfrac{12}{1-\\tfrac12}\\\\&=24\\end{aligned}',
        verify: { kind: 'value', expr: '12/(1-1/2)', answer: '24' }
      },
      {
        question: 'How many terms are in the arithmetic sequence $5,\\,8,\\,11,\\,\\ldots,\\,101$?',
        steps: ['Here $a=5$ and $d=3$.', 'Set $T_n=101$: $5+(n-1)\\times3=101$.', 'So $3(n-1)=96$, $n-1=32$ and $n=33$.'],
        answer: '$33$ terms',
        working: '\\begin{aligned}5+(n-1)(3)&=101\\\\3(n-1)&=96\\\\n&=33\\end{aligned}',
        verify: { kind: 'roots', f: '5+(n-1)*3-101', var: 'n', answers: ['33'] }
      }
    ],
    examiners: [
      'The type of sequence is justified by showing the constant difference or ratio.',
      'The formula is stated, $a$, $d$ or $r$ and $n$ are substituted, and the answer follows from the substitution.',
      'For a limiting sum, the condition $|r|<1$ is checked and written.',
      'The number of terms is a whole number, and the question\'s wording ("how many") is answered in a sentence.'
    ],
    diagrams: [
      { title: 'An arithmetic sequence: $7,11,15,\\ldots$', spec: { kind: 'sequence', type: 'arithmetic', first: 7, step: 4, n: 8 }, note: 'The terms rise by $4$ each step: $T_8=35$. Further along, $T_{20}=83$.' },
      { title: 'A geometric sequence with $r=\\tfrac12$', spec: { kind: 'sequence', type: 'geometric', first: 12, step: 0.5, n: 6 }, note: 'The terms are $12,6,3,1.5,0.75,0.375$. Their sum is $23.625$, which is approaching the limiting sum $24$.' }
    ],
    check: [
      { question: 'Find the sum of the first $15$ terms when $a=2$ and $d=3$.', answer: '$345$', verify: { kind: 'value', expr: '15/2*(2*2+14*3)', answer: '345' } },
      { question: 'A geometric sequence has $a=5$ and $r=3$. Find $T_4$.', answer: '$135$', verify: { kind: 'value', expr: '5*3^3', answer: '135' } }
    ]
  },

  'mav-12-04': {
    summary: 'Differential calculus in Year 12 handles composite, product and quotient functions with the chain, product and quotient rules, and adds the derivatives of exponential, logarithmic and trigonometric functions. The second derivative describes how the gradient itself is changing.',
    prereqs: ['mav-11-06'],
    concepts: [
      { title: 'The chain rule', body: 'For a function of a function, $y=f(u)$ with $u=g(x)$, $\\dfrac{dy}{dx}=\\dfrac{dy}{du}\\times\\dfrac{du}{dx}$. Differentiate the outer function, keep the inside unchanged, then multiply by the derivative of the inside.' },
      { title: 'The product and quotient rules', body: 'For $y=uv$, $y\'=u\'v+uv\'$. For $y=\\dfrac uv$, $y\'=\\dfrac{u\'v-uv\'}{v^2}$. Quote the rule, name $u$ and $v$, and write $u\'$ and $v\'$ before substituting.' },
      { title: 'Exponential, logarithmic and trigonometric derivatives', body: '$\\dfrac{d}{dx}e^{kx}=ke^{kx}$, $\\dfrac{d}{dx}\\ln x=\\dfrac1x$, $\\dfrac{d}{dx}\\sin kx=k\\cos kx$ and $\\dfrac{d}{dx}\\cos kx=-k\\sin kx$. With the chain rule, $\\dfrac{d}{dx}\\ln f(x)=\\dfrac{f\'(x)}{f(x)}$.' },
      { title: 'The second derivative', body: '$f\'\'(x)$ is the derivative of $f\'(x)$. Where $f\'\'>0$ the curve is concave up and where $f\'\'<0$ it is concave down; a change of concavity is a point of inflection.' }
    ],
    definitions: [
      { term: 'Composite function', meaning: 'A function formed by applying one function to the output of another, $f(g(x))$.' },
      { term: 'Second derivative', meaning: 'The derivative of the derivative, written $f\'\'(x)$ or $\\dfrac{d^2y}{dx^2}$.' },
      { term: 'Concave up', meaning: 'A curve that bends upwards, with gradient increasing; $f\'\'(x)>0$.' }
    ],
    formulas: [
      { label: 'Chain rule', tex: '\\dfrac{dy}{dx}=\\dfrac{dy}{du}\\cdot\\dfrac{du}{dx}' },
      { label: 'Product rule', tex: '\\dfrac{d}{dx}(uv)=u\'v+uv\'' },
      { label: 'Quotient rule', tex: '\\dfrac{d}{dx}\\left(\\dfrac uv\\right)=\\dfrac{u\'v-uv\'}{v^2}' },
      { label: 'Standard derivatives', tex: '\\dfrac{d}{dx}e^{kx}=ke^{kx},\\quad\\dfrac{d}{dx}\\ln x=\\dfrac1x,\\quad\\dfrac{d}{dx}\\sin kx=k\\cos kx' }
    ],
    points: [
      { front: 'Differentiate $e^{3x}$.', back: '$3e^{3x}$.' },
      { front: 'Differentiate $\\ln(5x-2)$.', back: '$\\dfrac{5}{5x-2}$.' },
      { front: 'Differentiate $(2x+1)^5$.', back: '$5(2x+1)^4\\times2=10(2x+1)^4$.' },
      { front: 'What does $f\'\'(x)<0$ tell you?', back: 'The curve is concave down at that point.' }
    ],
    mistakes: [
      { wrong: 'Differentiating $(3x^2+1)^4$ as $4(3x^2+1)^3$.', right: 'Multiply by the derivative of the inside, $6x$: $24x(3x^2+1)^3$.' },
      { wrong: '$(uv)\'=u\'v\'$.', right: 'The product rule has two terms: $u\'v+uv\'$.' },
      { wrong: 'Swapping the order in the quotient rule numerator.', right: 'The numerator is $u\'v-uv\'$. Reversing it flips the sign of the answer.' }
    ],
    examples: [
      {
        question: 'Differentiate $y=(3x^2+1)^4$ and find the gradient at $x=1$.',
        steps: ['Let $u=3x^2+1$, so $y=u^4$ and $\\dfrac{dy}{du}=4u^3$, $\\dfrac{du}{dx}=6x$.', 'Then $\\dfrac{dy}{dx}=4(3x^2+1)^3\\times6x=24x(3x^2+1)^3$.', 'At $x=1$: $24\\times1\\times4^3=1536$.'],
        answer: '$\\dfrac{dy}{dx}=24x(3x^2+1)^3$, gradient $1536$ at $x=1$',
        working: '\\begin{aligned}\\dfrac{dy}{dx}&=4(3x^2+1)^3\\cdot6x\\\\&=24x(3x^2+1)^3\\\\\\left.\\dfrac{dy}{dx}\\right|_{x=1}&=24(64)=1536\\end{aligned}',
        verify: { kind: 'value', expr: '((3*(1.0001)^2+1)^4-(3*(0.9999)^2+1)^4)/0.0002', answer: '1536' }
      },
      {
        question: 'Differentiate $y=x^2e^{3x}$ and find the gradient at $x=1$.',
        steps: ['Product rule with $u=x^2$ and $v=e^{3x}$: $u\'=2x$ and $v\'=3e^{3x}$.', '$\\dfrac{dy}{dx}=2xe^{3x}+3x^2e^{3x}=xe^{3x}(2+3x)$.', 'At $x=1$: $1\\times e^3\\times5=5e^3\\approx100.4$.'],
        answer: '$\\dfrac{dy}{dx}=xe^{3x}(3x+2)$, gradient $5e^3\\approx100.4$ at $x=1$',
        working: '\\begin{aligned}\\dfrac{dy}{dx}&=2xe^{3x}+x^2\\cdot3e^{3x}\\\\&=xe^{3x}(3x+2)\\\\\\left.\\dfrac{dy}{dx}\\right|_{x=1}&=5e^3\\end{aligned}',
        verify: { kind: 'value', expr: '((1.0001)^2*e^(3*1.0001)-(0.9999)^2*e^(3*0.9999))/0.0002', answer: '5*e^3' }
      },
      {
        question: 'Differentiate $y=\\dfrac{x}{x^2+1}$ and find the gradient at $x=2$.',
        steps: ['Quotient rule with $u=x$, $v=x^2+1$: $u\'=1$, $v\'=2x$.', '$\\dfrac{dy}{dx}=\\dfrac{1(x^2+1)-x(2x)}{(x^2+1)^2}=\\dfrac{1-x^2}{(x^2+1)^2}$.', 'At $x=2$: $\\dfrac{1-4}{25}=-\\dfrac{3}{25}$.'],
        answer: '$\\dfrac{dy}{dx}=\\dfrac{1-x^2}{(x^2+1)^2}$, gradient $-\\dfrac{3}{25}$ at $x=2$',
        working: '\\begin{aligned}\\dfrac{dy}{dx}&=\\dfrac{(x^2+1)-2x^2}{(x^2+1)^2}\\\\&=\\dfrac{1-x^2}{(x^2+1)^2}\\\\\\left.\\dfrac{dy}{dx}\\right|_{x=2}&=\\dfrac{-3}{25}\\end{aligned}',
        verify: { kind: 'value', expr: '((2.0001)/((2.0001)^2+1)-(1.9999)/((1.9999)^2+1))/0.0002', answer: '-3/25' }
      },
      {
        question: 'Differentiate $y=\\ln(5x-2)$ and find the gradient at $x=1$.',
        steps: ['Use $\\dfrac{d}{dx}\\ln f(x)=\\dfrac{f\'(x)}{f(x)}$ with $f(x)=5x-2$.', '$\\dfrac{dy}{dx}=\\dfrac{5}{5x-2}$.', 'At $x=1$ the gradient is $\\dfrac53$.'],
        answer: '$\\dfrac{dy}{dx}=\\dfrac{5}{5x-2}$, gradient $\\dfrac53$ at $x=1$',
        working: '\\begin{aligned}\\dfrac{dy}{dx}&=\\dfrac{5}{5x-2}\\\\\\left.\\dfrac{dy}{dx}\\right|_{x=1}&=\\dfrac{5}{3}\\end{aligned}',
        verify: { kind: 'value', expr: '(ln(5*1.0001-2)-ln(5*0.9999-2))/0.0002', answer: '5/3' }
      }
    ],
    examiners: [
      'The rule is named, and $u$, $v$, $u\'$ and $v\'$ are written before they are combined.',
      'A chain rule answer includes the derivative of the inside function, and the result is factorised where it helps.',
      'A gradient at a point is found by substituting into the derivative, not into the original function.',
      'The domain is respected: $\\ln(5x-2)$ needs $x>\\tfrac25$.'
    ],
    diagrams: [
      { title: 'The curve $y=\\dfrac{x}{x^2+1}$', spec: { kind: 'function', xmin: -6, xmax: 6, ymin: -1, ymax: 1, curves: [{ expr: 'x/(x^2+1)', label: 'y=\\dfrac{x}{x^2+1}' }], points: [{ x: 2, y: 0.4, label: '(2,\\,0.4)' }] }, note: 'At $x=2$ the curve is at $0.4$ and falling, with gradient $-\\tfrac{3}{25}=-0.12$.' },
      { title: 'The secant approaching the tangent of $y=e^x$ at $x=0$', spec: { kind: 'secantToTangent', expr: 'exp(x)', x0: 0, xmin: -2, xmax: 2, ymin: -1, ymax: 8 }, note: 'The gradient of $y=e^x$ at $x=0$ is $1$, equal to the height $e^0=1$.' }
    ],
    check: [
      { question: 'Find the gradient of $y=\\sin3x$ at $x=0$.', answer: '$3$', verify: { kind: 'value', expr: '(sin(3*0.0001)-sin(-3*0.0001))/0.0002', answer: '3' } },
      { question: 'Differentiate $y=x\\ln x$ and find the gradient at $x=e$.', answer: '$\\dfrac{dy}{dx}=\\ln x+1$, so the gradient is $2$', verify: { kind: 'value', expr: '((e+0.0001)*ln(e+0.0001)-(e-0.0001)*ln(e-0.0001))/0.0002', answer: '2' } }
    ]
  },

  'mav-12-05': {
    summary: 'Integration reverses differentiation and measures accumulated change. The definite integral gives the signed area between a curve and the $x$-axis, and when no antiderivative is available the trapezoidal rule gives an estimate.',
    prereqs: ['mav-12-04'],
    concepts: [
      { title: 'Antiderivatives', body: 'If $F\'(x)=f(x)$, then $\\int f(x)\\,dx=F(x)+C$. Raise the power by one and divide by the new power: $\\int x^n\\,dx=\\dfrac{x^{n+1}}{n+1}+C$ for $n\\neq-1$. For a linear inside, divide by its coefficient: $\\int e^{2x}\\,dx=\\tfrac12e^{2x}+C$.' },
      { title: 'The definite integral', body: '$\\int_a^bf(x)\\,dx=F(b)-F(a)$. The constant $C$ cancels. The result is a signed area: parts below the $x$-axis count as negative, so find area by splitting at the $x$-intercepts and taking each part positive.' },
      { title: 'Area between curves', body: 'If $f(x)\\ge g(x)$ on $[a,b]$, the area between them is $\\int_a^b\\big(f(x)-g(x)\\big)\\,dx$. Find the intersections first to get the limits.' },
      { title: 'The trapezoidal rule', body: 'Split $[a,b]$ into $n$ strips of width $h=\\dfrac{b-a}{n}$ and add the areas of the trapezoids. The estimate is an overestimate for a curve that is concave up and an underestimate for one that is concave down.' }
    ],
    definitions: [
      { term: 'Antiderivative', meaning: 'A function $F$ whose derivative is the given function $f$. All antiderivatives differ by a constant.' },
      { term: 'Definite integral', meaning: 'The number $F(b)-F(a)$, representing the signed area between $y=f(x)$ and the $x$-axis from $x=a$ to $x=b$.' },
      { term: 'Signed area', meaning: 'Area counted positive above the $x$-axis and negative below it.' }
    ],
    formulas: [
      { label: 'Standard integrals', tex: '\\int x^n\\,dx=\\dfrac{x^{n+1}}{n+1}+C,\\quad\\int e^{kx}\\,dx=\\dfrac{e^{kx}}{k}+C,\\quad\\int\\dfrac1x\\,dx=\\ln|x|+C' },
      { label: 'Fundamental theorem', tex: '\\int_a^bf(x)\\,dx=F(b)-F(a)' },
      { label: 'Trapezoidal rule', tex: '\\int_a^bf(x)\\,dx\\approx\\dfrac h2\\Big[y_0+2\\big(y_1+\\cdots+y_{n-1}\\big)+y_n\\Big],\\quad h=\\dfrac{b-a}{n}' }
    ],
    points: [
      { front: 'Integrate $6x^2$.', back: '$2x^3+C$.' },
      { front: 'Integrate $\\cos2x$.', back: '$\\tfrac12\\sin2x+C$.' },
      { front: 'Why does $C$ vanish in a definite integral?', back: 'It appears in both $F(b)$ and $F(a)$ and cancels in the subtraction.' },
      { front: 'What does a negative definite integral mean?', back: 'The region is mostly below the $x$-axis. Area itself is never negative.' }
    ],
    mistakes: [
      { wrong: 'Forgetting $+C$ in an indefinite integral.', right: 'Every indefinite integral ends with $+C$. It is not needed once limits are used.' },
      { wrong: 'Integrating $e^{2x}$ as $e^{2x}$.', right: 'Divide by the coefficient of $x$: $\\tfrac12e^{2x}+C$.' },
      { wrong: 'Using $\\int\\dfrac1x\\,dx=\\dfrac{x^0}{0}$.', right: 'The power rule fails for $n=-1$. The integral is $\\ln|x|+C$.' }
    ],
    examples: [
      {
        question: 'Evaluate $\\displaystyle\\int_1^3\\left(6x^2-4x+5\\right)dx$.',
        steps: ['Antiderivative: $F(x)=2x^3-2x^2+5x$.', '$F(3)=54-18+15=51$ and $F(1)=2-2+5=5$.', 'So the integral is $51-5=46$.'],
        answer: '$46$',
        working: '\\begin{aligned}\\int_1^3(6x^2-4x+5)\\,dx&=\\Big[2x^3-2x^2+5x\\Big]_1^3\\\\&=(54-18+15)-(2-2+5)\\\\&=51-5=46\\end{aligned}',
        verify: { kind: 'values', pairs: [['(2*3^3-2*3^2+5*3)-(2*1^3-2*1^2+5*1)', '46'], ['(3-1)/6*((6*1^2-4*1+5)+4*(6*2^2-4*2+5)+(6*3^2-4*3+5))', '46']] }
      },
      {
        question: 'Find the area under $y=e^{2x}$ from $x=0$ to $x=1$.',
        steps: ['An antiderivative of $e^{2x}$ is $\\tfrac12e^{2x}$.', 'Area $=\\tfrac12e^2-\\tfrac12e^0=\\tfrac12(e^2-1)$.', 'Numerically this is about $3.19$ square units.'],
        answer: '$\\tfrac12\\left(e^2-1\\right)\\approx3.19$ square units',
        working: '\\begin{aligned}\\int_0^1e^{2x}\\,dx&=\\Big[\\tfrac12e^{2x}\\Big]_0^1\\\\&=\\tfrac12e^2-\\tfrac12\\\\&=\\tfrac12(e^2-1)\\approx3.19\\end{aligned}',
        verify: { kind: 'values', pairs: [['(e^(2*1)-e^(2*0))/2', '(e^2-1)/2'], ['(e^2-1)/2', '3.194528049']] }
      },
      {
        question: 'Find the area enclosed by $y=x^2$ and $y=2x$.',
        steps: ['Intersections: $x^2=2x$, so $x=0$ or $x=2$.', 'On $[0,2]$ the line is above the parabola, so area $=\\int_0^2(2x-x^2)\\,dx$.', '$=\\Big[x^2-\\tfrac{x^3}{3}\\Big]_0^2=4-\\tfrac83=\\tfrac43$.'],
        answer: '$\\tfrac43$ square units',
        working: '\\begin{aligned}A&=\\int_0^2(2x-x^2)\\,dx\\\\&=\\Big[x^2-\\tfrac{x^3}{3}\\Big]_0^2\\\\&=4-\\tfrac83=\\tfrac43\\end{aligned}',
        verify: { kind: 'values', pairs: [['(2^2-2^3/3)-(0^2-0^3/3)', '4/3'], ['(2-0)/6*((2*0-0^2)+4*(2*1-1^2)+(2*2-2^2))', '4/3']] }
      },
      {
        question: 'Use the trapezoidal rule with $4$ strips to estimate $\\displaystyle\\int_0^4x^2\\,dx$.',
        steps: ['$h=\\dfrac{4-0}{4}=1$, and the function values at $x=0,1,2,3,4$ are $0,1,4,9,16$.', 'Estimate $=\\dfrac12\\big[0+2(1+4+9)+16\\big]=\\dfrac12(44)=22$.', 'The exact value is $\\dfrac{64}{3}\\approx21.33$, so the rule overestimates, as expected for a concave-up curve.'],
        answer: '$22$',
        working: '\\begin{aligned}h&=1\\\\\\int_0^4x^2\\,dx&\\approx\\dfrac12\\big[0+2(1+4+9)+16\\big]\\\\&=22\\end{aligned}',
        verify: { kind: 'value', expr: '1/2*(0+2*(1+4+9)+16)', answer: '22' }
      }
    ],
    examiners: [
      'The antiderivative is written in square brackets with limits, and both $F(b)$ and $F(a)$ are substituted.',
      'The intersection points are found first and used as the limits for an area between curves.',
      'The function values for the trapezoidal rule are tabulated before they are added.',
      'Area below the $x$-axis is dealt with by splitting the integral at the intercepts.'
    ],
    diagrams: [
      { title: 'The shaded area $\\displaystyle\\int_1^3(6x^2-4x+5)\\,dx$', spec: { kind: 'function', xmin: -1, xmax: 4, ymin: -2, ymax: 60, curves: [{ expr: '6*x^2-4*x+5', label: 'y=6x^2-4x+5', shade: { from: 1, to: 3 } }] }, note: 'The shaded region between $x=1$ and $x=3$ has area $46$ square units.' },
      { title: 'More rectangles under $y=x^2$ from $0$ to $4$', spec: { kind: 'riemannSlider', expr: 'x^2', a: 0, b: 4, initialN: 4 }, note: 'As the number of rectangles grows the total approaches the exact area $\\tfrac{64}{3}\\approx21.33$.' }
    ],
    check: [
      { question: 'Evaluate $\\displaystyle\\int_0^23x^2\\,dx$.', answer: '$8$', verify: { kind: 'value', expr: '2^3-0^3', answer: '8' } },
      { question: 'Evaluate $\\displaystyle\\int_1^e\\dfrac1x\\,dx$.', answer: '$1$', verify: { kind: 'value', expr: 'ln(e)-ln(1)', answer: '1' } }
    ]
  },

  'mav-12-06': {
    summary: 'Calculus applied: stationary points and concavity describe the shape of a curve, optimisation finds the greatest or least value of a quantity, and derivatives and integrals link displacement, velocity and acceleration.',
    prereqs: ['mav-12-04'],
    concepts: [
      { title: 'Stationary points and their nature', body: 'A stationary point has $f\'(x)=0$. At such a point, $f\'\'(x)<0$ gives a local maximum and $f\'\'(x)>0$ a local minimum. If $f\'\'=0$, test the sign of $f\'$ either side. A point of inflection is where $f\'\'$ changes sign.' },
      { title: 'Optimisation', body: 'Write the quantity to optimise as a function of one variable, using the constraint to remove the other. Differentiate, set the derivative to zero, test the nature, check the endpoints of the domain, and answer in the units of the question.' },
      { title: 'Motion in a straight line', body: 'Displacement $x(t)$, velocity $v=\\dfrac{dx}{dt}$ and acceleration $a=\\dfrac{dv}{dt}$. The particle is at rest when $v=0$. Going the other way, $v=\\int a\\,dt$ and $x=\\int v\\,dt$, with the constants found from given conditions.' }
    ],
    definitions: [
      { term: 'Stationary point', meaning: 'A point on a curve where the gradient is zero, $f\'(x)=0$.' },
      { term: 'Point of inflection', meaning: 'A point where the concavity of the curve changes, so $f\'\'$ changes sign.' },
      { term: 'Velocity', meaning: 'The rate of change of displacement with time; its sign gives the direction of motion.' }
    ],
    formulas: [
      { label: 'Second derivative test', tex: 'f\'(a)=0\\ \\text{and}\\ f\'\'(a)<0\\Rightarrow\\text{maximum};\\quad f\'\'(a)>0\\Rightarrow\\text{minimum}' },
      { label: 'Motion', tex: 'v=\\dfrac{dx}{dt},\\qquad a=\\dfrac{dv}{dt}=\\dfrac{d^2x}{dt^2}' }
    ],
    points: [
      { front: 'What does $f\'\'(a)>0$ at a stationary point mean?', back: 'The point is a local minimum.' },
      { front: 'What is true of a particle when $v=0$?', back: 'It is momentarily at rest, and it usually reverses direction.' },
      { front: 'Why check endpoints in an optimisation problem?', back: 'The greatest or least value on a closed interval may occur at an endpoint, not at a stationary point.' },
      { front: 'How do you find $x(t)$ from $v(t)$?', back: 'Integrate $v$ and use a known position to find the constant.' }
    ],
    mistakes: [
      { wrong: 'Assuming every stationary point is a maximum or a minimum.', right: 'It could be a horizontal point of inflection, such as $y=x^3$ at $x=0$. Test the sign of $f\'$ either side.' },
      { wrong: 'Stopping at $x=25$ in an optimisation problem.', right: 'Answer the question asked: the maximum area, in square metres, not the value of $x$.' },
      { wrong: 'Saying the particle has stopped for good when $v=0$.', right: '$v=0$ is an instant. Find $a$ and the sign of $v$ on both sides to see what happens.' }
    ],
    examples: [
      {
        question: 'Find and classify the stationary points of $y=x^3-6x^2+9x+1$.',
        steps: ['$y\'=3x^2-12x+9=3(x-1)(x-3)$, so $y\'=0$ at $x=1$ and $x=3$.', 'The $y$-values are $y(1)=5$ and $y(3)=1$.', '$y\'\'=6x-12$: $y\'\'(1)=-6<0$ so $(1,5)$ is a maximum; $y\'\'(3)=6>0$ so $(3,1)$ is a minimum.'],
        answer: 'Maximum at $(1,5)$ and minimum at $(3,1)$',
        working: '\\begin{aligned}y\'&=3x^2-12x+9=3(x-1)(x-3)\\\\y\'\'&=6x-12\\\\y\'\'(1)&=-6\\ (\\max),\\quad y\'\'(3)=6\\ (\\min)\\end{aligned}',
        verify: { kind: 'roots', f: '((x+0.0001)^3-6*(x+0.0001)^2+9*(x+0.0001)+1-((x-0.0001)^3-6*(x-0.0001)^2+9*(x-0.0001)+1))/0.0002', answers: ['1', '3'] }
      },
      {
        question: 'A farmer has $100$ m of fencing for three sides of a rectangular paddock; the fourth side is a wall. Find the greatest possible area.',
        steps: ['Let the two sides at right angles to the wall be $x$ m. The side along the wall is $100-2x$, so $A=x(100-2x)$.', '$A\'=100-4x=0$ gives $x=25$, and $A\'\'=-4<0$, so this is a maximum.', '$A=25\\times50=1250$ m$^2$.'],
        answer: '$1250$ m$^2$, with $x=25$ m',
        working: '\\begin{aligned}A&=x(100-2x)\\\\A\'&=100-4x=0\\Rightarrow x=25\\\\A\'\'&=-4<0\\\\A&=25(50)=1250\\end{aligned}',
        verify: { kind: 'roots', f: '((x+0.0001)*(100-2*(x+0.0001))-(x-0.0001)*(100-2*(x-0.0001)))/0.0002', answers: ['25'] }
      },
      {
        question: 'A particle moves with displacement $x=2t^3-9t^2+12t$ metres, $t\\ge0$ seconds. When is it at rest, and what is its acceleration then?',
        steps: ['$v=\\dfrac{dx}{dt}=6t^2-18t+12=6(t-1)(t-2)$, so $v=0$ at $t=1$ and $t=2$.', '$a=\\dfrac{dv}{dt}=12t-18$.', 'At $t=1$: $a=-6$ m/s$^2$. At $t=2$: $a=6$ m/s$^2$.'],
        answer: 'At rest at $t=1$ s ($a=-6$ m/s$^2$) and $t=2$ s ($a=6$ m/s$^2$)',
        working: '\\begin{aligned}v&=6t^2-18t+12=6(t-1)(t-2)\\\\a&=12t-18\\\\a(1)&=-6,\\quad a(2)=6\\end{aligned}',
        verify: { kind: 'roots', f: '((2*(t+0.0001)^3-9*(t+0.0001)^2+12*(t+0.0001))-(2*(t-0.0001)^3-9*(t-0.0001)^2+12*(t-0.0001)))/0.0002', var: 't', answers: ['1', '2'] }
      }
    ],
    examiners: [
      'The derivative is set to zero and the solutions are written, then the nature of each point is justified by $f\'\'$ or by a sign test.',
      'Stationary points are given as full coordinates, with the $y$-value found from the original function.',
      'An optimisation answer states the quantity, its value and its units, with a reason that it is a maximum or a minimum.',
      'In motion questions, velocity and acceleration are named and differentiated or integrated in the right direction.'
    ],
    diagrams: [
      { title: 'Stationary points of $y=x^3-6x^2+9x+1$', spec: { kind: 'function', xmin: -1, xmax: 4.5, ymin: -4, ymax: 10, curves: [{ expr: 'x^3-6*x^2+9*x+1', label: 'y=x^3-6x^2+9x+1' }], points: [{ x: 1, y: 5, label: '(1,\\,5)' }, { x: 3, y: 1, label: '(3,\\,1)' }] }, note: 'The maximum is $(1,5)$ and the minimum is $(3,1)$. The curve is concave down for $x<2$ and concave up for $x>2$.' },
      { title: 'The paddock area $A=x(100-2x)$', spec: { kind: 'function', xmin: 0, xmax: 50, ymin: 0, ymax: 1400, curves: [{ expr: 'x*(100-2*x)', label: 'A=x(100-2x)' }], points: [{ x: 25, y: 1250, label: '(25,\\,1250)' }] }, note: 'The greatest area is $1250$ m$^2$, at $x=25$ m.' }
    ],
    check: [
      { question: 'Find the $x$-coordinate of the stationary point of $y=x^2-8x+3$.', answer: '$x=4$', verify: { kind: 'roots', f: '((x+0.0001)^2-8*(x+0.0001)+3-((x-0.0001)^2-8*(x-0.0001)+3))/0.0002', answers: ['4'] } },
      { question: 'A particle has $x=t^2-6t$. Find its displacement when it is at rest ($v=2t-6=0$).', answer: '$-9$ m', verify: { kind: 'value', expr: '3^2-6*3', answer: '-9' } }
    ]
  },

  'mav-12-07': {
    summary: 'A random variable assigns a number to each outcome. A discrete random variable has a probability for each value, with a mean and a variance; a continuous one is described by a density whose total area is $1$. The normal distribution is standardised with the $z$-score.',
    prereqs: ['mav-11-09'],
    concepts: [
      { title: 'Discrete random variables', body: 'List each value $x$ with its probability $p(x)$; the probabilities add to $1$. The expected value is $E(X)=\\sum xp(x)$ and the variance is $\\text{Var}(X)=E(X^2)-\\big[E(X)\\big]^2$. The standard deviation is the square root of the variance.' },
      { title: 'Linear changes', body: 'For constants $a$ and $b$, $E(aX+b)=aE(X)+b$ and $\\text{Var}(aX+b)=a^2\\text{Var}(X)$. Adding $b$ shifts the mean but does not change the spread.' },
      { title: 'Continuous random variables', body: 'A probability density function $f(x)\\ge0$ has total area $1$, and $P(a\\le X\\le b)=\\int_a^bf(x)\\,dx$. A single value has probability $0$, so $P(X<a)=P(X\\le a)$.' },
      { title: 'The normal distribution', body: 'For $X\\sim N(\\mu,\\sigma^2)$ the $z$-score $z=\\dfrac{x-\\mu}{\\sigma}$ gives the number of standard deviations from the mean. About $68\\%$, $95\\%$ and $99.7\\%$ of values lie within $1$, $2$ and $3$ standard deviations of $\\mu$.' }
    ],
    definitions: [
      { term: 'Random variable', meaning: 'A variable whose value is the numerical outcome of a random process.' },
      { term: 'Expected value', meaning: 'The long-run average, $E(X)=\\sum xp(x)$ for a discrete random variable.' },
      { term: '$z$-score', meaning: 'The number of standard deviations a value lies above or below the mean: $z=\\dfrac{x-\\mu}{\\sigma}$.' }
    ],
    formulas: [
      { label: 'Mean and variance', tex: 'E(X)=\\sum xp(x),\\qquad\\text{Var}(X)=E(X^2)-\\big[E(X)\\big]^2' },
      { label: 'Linear change', tex: 'E(aX+b)=aE(X)+b,\\qquad\\text{Var}(aX+b)=a^2\\,\\text{Var}(X)' },
      { label: 'Standard score', tex: 'z=\\dfrac{x-\\mu}{\\sigma},\\qquad x=\\mu+z\\sigma' }
    ],
    points: [
      { front: 'What must $\\sum p(x)$ equal?', back: '$1$.' },
      { front: 'If $E(X)=4$, what is $E(3X-2)$?', back: '$3(4)-2=10$.' },
      { front: 'If $\\text{Var}(X)=5$, what is $\\text{Var}(2X+1)$?', back: '$2^2\\times5=20$. The $+1$ does not change the variance.' },
      { front: 'What does $z=-1.5$ mean?', back: 'The value is $1.5$ standard deviations below the mean.' }
    ],
    mistakes: [
      { wrong: 'Writing $\\text{Var}(2X+1)=2\\text{Var}(X)+1$.', right: 'Variance scales by the square of the multiplier and ignores the constant: $4\\text{Var}(X)$.' },
      { wrong: 'Computing $\\text{Var}(X)=E(X)^2-E(X^2)$.', right: 'The order is $E(X^2)-[E(X)]^2$, which is never negative.' },
      { wrong: 'Using $\\sigma^2$ in the $z$-score denominator.', right: 'Divide by the standard deviation $\\sigma$, not the variance.' }
    ],
    examples: [
      {
        question: 'A random variable $X$ has $P(X=1)=0.1$, $P(X=2)=0.3$, $P(X=3)=0.4$ and $P(X=4)=0.2$. Find $E(X)$, $\\text{Var}(X)$ and the standard deviation.',
        steps: ['$E(X)=1(0.1)+2(0.3)+3(0.4)+4(0.2)=2.7$.', '$E(X^2)=1(0.1)+4(0.3)+9(0.4)+16(0.2)=8.1$.', '$\\text{Var}(X)=8.1-2.7^2=0.81$, so the standard deviation is $\\sqrt{0.81}=0.9$.'],
        answer: '$E(X)=2.7$, $\\text{Var}(X)=0.81$, standard deviation $0.9$',
        working: '\\begin{aligned}E(X)&=0.1+0.6+1.2+0.8=2.7\\\\E(X^2)&=0.1+1.2+3.6+3.2=8.1\\\\\\text{Var}(X)&=8.1-2.7^2=0.81\\end{aligned}',
        verify: { kind: 'values', pairs: [['1*0.1+2*0.3+3*0.4+4*0.2', '2.7'], ['1*0.1+4*0.3+9*0.4+16*0.2-2.7^2', '0.81'], ['sqrt(0.81)', '0.9']] }
      },
      {
        question: 'The function $f(x)=kx$ for $0\\le x\\le3$ (and $0$ elsewhere) is a probability density function. Find $k$ and $P(X\\le2)$.',
        steps: ['The total area is $1$: $\\int_0^3kx\\,dx=k\\left[\\tfrac{x^2}{2}\\right]_0^3=\\tfrac{9k}{2}=1$, so $k=\\tfrac29$.', '$P(X\\le2)=\\int_0^2\\tfrac29x\\,dx=\\tfrac29\\times\\tfrac{4}{2}$.', 'So $P(X\\le2)=\\tfrac49$.'],
        answer: '$k=\\tfrac29$ and $P(X\\le2)=\\tfrac49$',
        working: '\\begin{aligned}\\int_0^3kx\\,dx&=\\tfrac{9k}{2}=1\\Rightarrow k=\\tfrac29\\\\P(X\\le2)&=\\tfrac29\\cdot\\tfrac{2^2}{2}=\\tfrac49\\end{aligned}',
        verify: { kind: 'values', pairs: [['(2/9)*3^2/2', '1'], ['(2/9)*2^2/2', '4/9']] }
      },
      {
        question: 'Test scores are normally distributed with mean $70$ and standard deviation $8$. Find the $z$-score of a score of $86$, and the score that has $z=-1.5$.',
        steps: ['$z=\\dfrac{86-70}{8}=2$.', 'Using $x=\\mu+z\\sigma$: $x=70+(-1.5)(8)=70-12$.', 'So the score is $58$. A score of $86$ is $2$ standard deviations above the mean.'],
        answer: '$z=2$ for a score of $86$; $z=-1.5$ is a score of $58$',
        working: '\\begin{aligned}z&=\\dfrac{86-70}{8}=2\\\\x&=70+(-1.5)(8)=58\\end{aligned}',
        verify: { kind: 'values', pairs: [['(86-70)/8', '2'], ['70+(-1.5)*8', '58']] }
      }
    ],
    examiners: [
      'The probabilities are shown to add to $1$ before $E(X)$ is calculated, and $E(X^2)$ is written separately.',
      'A probability density function is checked by integrating over its whole domain to give $1$.',
      'A normal probability question names the $z$-score, shows the substitution, and states which tail or interval is wanted.',
      'The answer is interpreted in context, with the value of the mean and the unit of $X$.'
    ],
    diagrams: [
      { title: 'Shade an area under the standard normal curve', spec: { kind: 'normalZ', initial: [-1, 1] }, note: 'The area between $z=-1$ and $z=1$ is about $68\\%$; between $z=-2$ and $z=2$ it is about $95\\%$.' },
      { title: 'Scores with mean $70$ and standard deviation $8$', spec: { kind: 'normal', mu: 70, sigma: 8, from: 54, to: 86, mode: 'x' }, note: 'The shaded scores from $54$ to $86$ are within $2$ standard deviations ($z=-2$ to $z=2$), about $95.4\\%$ of all scores.' }
    ],
    check: [
      { question: 'If $E(X)=4$, find $E(3X-2)$.', answer: '$10$', verify: { kind: 'value', expr: '3*4-2', answer: '10' } },
      { question: 'If $\\text{Var}(X)=5$, find $\\text{Var}(2X+1)$.', answer: '$20$', verify: { kind: 'value', expr: '2^2*5', answer: '20' } }
    ]
  },

  'mav-12-08': {
    summary: 'Financial mathematics applies sequences and series to money: compound interest, depreciation, regular investments (annuities) and loans with reducing balances. Each situation is a geometric sequence in disguise.',
    prereqs: ['mav-12-03'],
    concepts: [
      { title: 'Compound interest and depreciation', body: 'After $n$ periods at a rate $r$ per period, $A=P(1+r)^n$. Depreciation by a fixed percentage uses the same form with a minus: $S=V_0(1-r)^n$. Convert an annual rate to the period rate first: $6\\%$ per annum compounded monthly is $r=\\dfrac{0.06}{12}=0.005$.' },
      { title: 'Annuities', body: 'A regular deposit $M$ at the end of each period, earning $r$ per period, grows to $FV=M\\dfrac{(1+r)^n-1}{r}$. This is the sum of a geometric series where each deposit has earned interest for a different number of periods.' },
      { title: 'Loans with reducing balance', body: 'Each period the balance grows by interest and falls by the repayment: $A_n=P(1+r)^n-M\\dfrac{(1+r)^n-1}{r}$. The loan is repaid when $A_n=0$, which gives the repayment $M$ for a loan of $P$.' }
    ],
    definitions: [
      { term: 'Compounding period', meaning: 'The interval, such as a month or a quarter, after which interest is added to the balance.' },
      { term: 'Annuity', meaning: 'A series of equal payments made at regular intervals.' },
      { term: 'Reducing balance', meaning: 'A loan where interest is charged each period on the amount still owing.' }
    ],
    formulas: [
      { label: 'Compound interest', tex: 'A=P(1+r)^n' },
      { label: 'Depreciation', tex: 'S=V_0(1-r)^n' },
      { label: 'Future value of an annuity', tex: 'FV=M\\,\\dfrac{(1+r)^n-1}{r}' },
      { label: 'Loan repayment', tex: 'M=\\dfrac{Pr(1+r)^n}{(1+r)^n-1}' }
    ],
    points: [
      { front: 'What are $r$ and $n$ for $6\\%$ p.a. compounded monthly for $3$ years?', back: '$r=0.005$ and $n=36$.' },
      { front: 'How does depreciation differ from compound growth?', back: 'The factor is $(1-r)$, not $(1+r)$.' },
      { front: 'When is a loan repaid?', back: 'When the balance after the last repayment is $0$.' },
      { front: 'Why does compound interest exceed simple interest after more than one period?', back: 'Interest is earned on earlier interest, so growth is geometric, not linear.' }
    ],
    mistakes: [
      { wrong: 'Using $r=0.06$ and $n=3$ for $6\\%$ p.a. compounded monthly over $3$ years.', right: 'Match the period: $r=0.005$ and $n=36$.' },
      { wrong: 'Rounding the rate or the balance early.', right: 'Keep full calculator values and round only the final answer to the nearest cent.' },
      { wrong: 'Using the annuity formula for a single deposit.', right: 'A single lump sum is $P(1+r)^n$. The annuity formula is for regular equal payments.' }
    ],
    examples: [
      {
        question: '$\\$8000$ is invested at $6\\%$ per annum, compounded monthly, for $3$ years. Find the final value.',
        steps: ['Monthly rate $r=\\dfrac{0.06}{12}=0.005$ and $n=12\\times3=36$.', '$A=8000(1.005)^{36}$.', '$A\\approx\\$9573.44$.'],
        answer: '$\\$9573.44$',
        working: '\\begin{aligned}A&=8000(1+0.005)^{36}\\\\&=8000(1.196681\\ldots)\\\\&\\approx9573.44\\end{aligned}',
        verify: { kind: 'value', expr: '8000*(1+0.06/12)^(12*3)', answer: '9573.444198587' }
      },
      {
        question: 'A car worth $\\$35\\,000$ depreciates at $15\\%$ per year. Find its value after $4$ years.',
        steps: ['The yearly factor is $1-0.15=0.85$.', '$S=35000(0.85)^4$.', '$S\\approx\\$18\\,270.22$.'],
        answer: '$\\$18\\,270.22$',
        working: '\\begin{aligned}S&=35000(1-0.15)^4\\\\&=35000(0.52200625)\\\\&\\approx18270.22\\end{aligned}',
        verify: { kind: 'value', expr: '35000*0.85^4', answer: '18270.21875' }
      },
      {
        question: '$\\$500$ is deposited at the end of each quarter for $5$ years at $8\\%$ per annum compounded quarterly. Find the value of the investment at the end.',
        steps: ['Quarterly rate $r=\\dfrac{0.08}{4}=0.02$ and $n=4\\times5=20$.', '$FV=500\\times\\dfrac{1.02^{20}-1}{0.02}$.', '$FV\\approx\\$12\\,148.68$.'],
        answer: '$\\$12\\,148.68$',
        working: '\\begin{aligned}FV&=500\\times\\dfrac{(1.02)^{20}-1}{0.02}\\\\&=500(24.2974\\ldots)\\\\&\\approx12148.68\\end{aligned}',
        verify: { kind: 'value', expr: '500*((1.02)^20-1)/0.02', answer: '12148.684899459' }
      },
      {
        question: 'A loan of $\\$20\\,000$ is charged $6\\%$ per annum, compounded monthly, and repaid in equal monthly instalments over $5$ years. Find the monthly repayment.',
        steps: ['$r=0.005$ and $n=60$. The loan is repaid when $A_{60}=0$.', '$M=\\dfrac{20000(0.005)(1.005)^{60}}{(1.005)^{60}-1}$.', '$M\\approx\\$386.66$.'],
        answer: '$\\$386.66$ per month',
        working: '\\begin{aligned}M&=\\dfrac{Pr(1+r)^n}{(1+r)^n-1}\\\\&=\\dfrac{20000(0.005)(1.005)^{60}}{(1.005)^{60}-1}\\\\&\\approx386.66\\end{aligned}',
        verify: { kind: 'roots', f: '20000*1.005^60-M*(1.005^60-1)/0.005', var: 'M', answers: ['386.6560305886'] }
      }
    ],
    examiners: [
      'The period rate $r$ and the number of periods $n$ are written out before the formula is used.',
      'The formula is quoted, values are substituted, and only the final answer is rounded, to the nearest cent.',
      'The type of problem is named: a lump sum, a depreciation, an annuity or a loan.',
      'Money answers carry the dollar sign and two decimal places, and the context is restated in a sentence.'
    ],
    diagrams: [
      { title: '$\\$8000$ at $6\\%$ compounded monthly for $3$ years', spec: { kind: 'compound', principal: 8000, rate: 0.06, years: 3, perYear: 12 }, note: 'The balance reaches $\\$9573.44$. The dashed line is simple interest, which gives $\\$9440.00$.' },
      { title: 'Compare rates and compounding', spec: { kind: 'compoundExplorer', principal: 8000, initialRate: 6, initialYears: 3 }, note: 'Raise the rate or the number of compounding periods and compare the final balance with simple interest.' }
    ],
    check: [
      { question: 'Find the value of $\\$2000$ invested at $5\\%$ per annum, compounded yearly, after $4$ years.', answer: '$\\$2431.01$', verify: { kind: 'value', expr: '2000*1.05^4', answer: '2431.0125' } },
      { question: 'A machine worth $\\$12\\,000$ depreciates by $20\\%$ per year. Find its value after $2$ years.', answer: '$\\$7680$', verify: { kind: 'value', expr: '12000*0.8^2', answer: '7680' } }
    ]
  }
};
