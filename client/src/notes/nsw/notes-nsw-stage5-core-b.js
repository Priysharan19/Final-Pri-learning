// Pri Learning · NSW Notes · Stage 5 (Years 9 and 10) · core band B
//
// Original revision writing for the NSW Mathematics K–10 Syllabus (2022) focus
// areas: linear relationships, numbers of any magnitude, non-linear
// relationships, probability, trigonometry and volume. Written for Pri
// Learning; it is not an official NESA publication and quotes no syllabus text.
// Each topic is keyed by the lower-case outcome code of its focus area (the
// code is a reference only). en-AU spelling. Trigonometry uses degrees. Every
// worked example's answer is re-derived by the deterministic engine in
// client/test/nsw-notes-bands-check.mjs.
export default {
  'ma5-lin-c-01': {
    summary: 'A straight line is described by how steep it is and where it sits. Gradient measures steepness; the distance and midpoint formulas turn two points on a number plane into a length and a centre.',
    prereqs: ['ma4-lin-c-01', 'ma4-pyt-c-01'],
    concepts: [
      { title: 'Gradient as rise over run', body: 'Between two points the gradient is the vertical change divided by the horizontal change. A line that climbs to the right has a positive gradient, one that falls has a negative gradient, a horizontal line has gradient $0$ and a vertical line has no gradient.' },
      { title: 'Distance is Pythagoras’ theorem', body: 'Join two points and draw a right-angled triangle whose legs are the horizontal and vertical changes. The distance is the hypotenuse, so it is $\\sqrt{(\\Delta x)^2+(\\Delta y)^2}$.' },
      { title: 'Midpoint is an average', body: 'The midpoint of a segment has the average of the two $x$-values as its $x$-coordinate and the average of the two $y$-values as its $y$-coordinate.' }
    ],
    definitions: [
      { term: 'Gradient', meaning: 'The measure of steepness of a line, $m=\\dfrac{\\text{rise}}{\\text{run}}$, the same between any two points on a straight line.' },
      { term: 'Midpoint', meaning: 'The point on a line segment that is equally far from both endpoints.' }
    ],
    formulas: [
      { label: 'Gradient', tex: 'm=\\frac{y_2-y_1}{x_2-x_1}' },
      { label: 'Distance', tex: 'd=\\sqrt{(x_2-x_1)^2+(y_2-y_1)^2}' },
      { label: 'Midpoint', tex: 'M=\\left(\\frac{x_1+x_2}{2},\\ \\frac{y_1+y_2}{2}\\right)' }
    ],
    points: [
      { front: 'The gradient through $(0,1)$ and $(2,7)$', back: '$\\dfrac{7-1}{2-0}=3$.' },
      { front: 'What does a negative gradient tell you?', back: 'The line falls as you move to the right.' },
      { front: 'The gradient of a horizontal line', back: '$0$, because the rise is $0$.' },
      { front: 'The midpoint of $(2,4)$ and $(8,10)$', back: '$(5,7)$.' }
    ],
    mistakes: [
      { wrong: 'Gradient $=\\dfrac{x_2-x_1}{y_2-y_1}$ (run over rise).', right: 'The $y$-change goes on top: $m=\\dfrac{y_2-y_1}{x_2-x_1}$.' },
      { wrong: 'Between $(1,2)$ and $(4,6)$ the distance is $3+4=7$.', right: 'Square, add, then take the root: $\\sqrt{3^2+4^2}=5$.' }
    ],
    examples: [
      {
        question: 'Find the gradient of the line through $(1,2)$ and $(5,10)$.',
        steps: ['The rise is $10-2=8$ and the run is $5-1=4$.', '$m=\\dfrac{8}{4}=2$.'],
        answer: '$m=2$',
        verify: { kind: 'value', expr: '(10-2)/(5-1)', answer: '2' }
      },
      {
        question: 'Find the distance between $(-1,3)$ and $(4,15)$.',
        steps: ['The horizontal change is $4-(-1)=5$ and the vertical change is $15-3=12$.', '$d=\\sqrt{5^2+12^2}=\\sqrt{169}$.', '$\\sqrt{169}=13$.'],
        answer: '$13$ units',
        verify: { kind: 'value', expr: 'sqrt(5^2+12^2)', answer: '13' }
      },
      {
        question: 'Find the midpoint of the segment joining $(-2,7)$ and $(6,-1)$.',
        steps: ['The $x$-coordinate is $\\dfrac{-2+6}{2}=2$.', 'The $y$-coordinate is $\\dfrac{7+(-1)}{2}=3$.'],
        answer: '$(2,3)$',
        verify: { kind: 'values', pairs: [['(-2+6)/2', '2'], ['(7+(-1))/2', '3']] }
      }
    ]
  },

  'ma5-lin-c-02': {
    summary: 'Once the gradient is known, a line has an equation. Two lines can be parallel, perpendicular or crossing, and the point where two lines cross is the solution of a pair of simultaneous equations.',
    prereqs: ['ma5-lin-c-01', 'ma4-equ-c-01'],
    concepts: [
      { title: 'The equation of a line', body: 'A line with gradient $m$ and $y$-intercept $b$ has equation $y=mx+b$. If you know the gradient and one point $(x_1,y_1)$, write $y-y_1=m(x-x_1)$ and tidy it.' },
      { title: 'Parallel and perpendicular lines', body: 'Parallel lines have equal gradients. Perpendicular lines have gradients whose product is $-1$, so a line of gradient $2$ is perpendicular to one of gradient $-\\tfrac{1}{2}$.' },
      { title: 'Where two lines meet', body: 'The crossing point lies on both lines, so its coordinates satisfy both equations. Eliminate one variable by substitution or by adding and subtracting the equations; the graph shows the same point.' }
    ],
    definitions: [
      { term: 'Gradient-intercept form', meaning: 'The equation $y=mx+b$, where $m$ is the gradient and $b$ is the $y$-intercept.' },
      { term: 'Simultaneous equations', meaning: 'Two or more equations that must hold at the same time. For two lines the solution is their point of intersection.' }
    ],
    formulas: [
      { label: 'Point–gradient form', tex: 'y-y_1=m(x-x_1)' },
      { label: 'Parallel and perpendicular', tex: 'm_1=m_2\\ \\text{(parallel)},\\qquad m_1m_2=-1\\ \\text{(perpendicular)}' }
    ],
    points: [
      { front: 'The gradient and intercept of $y=-3x+5$', back: 'Gradient $-3$, $y$-intercept $5$.' },
      { front: 'The gradient of a line parallel to $y=4x-1$', back: '$4$.' },
      { front: 'The gradient of a line perpendicular to a line of gradient $\\tfrac{2}{3}$', back: '$-\\tfrac{3}{2}$: flip the fraction and change the sign.' },
      { front: 'How can you check a solution of two simultaneous equations?', back: 'Substitute both values into each original equation; both must hold.' }
    ],
    mistakes: [
      { wrong: 'A line perpendicular to gradient $3$ has gradient $-3$.', right: 'The product must be $-1$, so the gradient is $-\\tfrac{1}{3}$.' },
      { wrong: 'After finding $x=3$ the solution is complete.', right: 'Substitute back to find $y$ and give the point $(3,7)$; an intersection has two coordinates.' }
    ],
    examples: [
      {
        question: 'Find the equation of the line through $(2,5)$ with gradient $3$.',
        steps: ['Use $y-5=3(x-2)$.', 'Expand: $y-5=3x-6$.', 'So $y=3x-1$.'],
        answer: '$y=3x-1$',
        verify: { kind: 'values', pairs: [['3*2-1', '5']] }
      },
      {
        question: 'Find the equation of the line through $(4,1)$ perpendicular to $y=2x+1$.',
        steps: ['The given gradient is $2$, so the perpendicular gradient is $-\\tfrac{1}{2}$.', '$y-1=-\\tfrac{1}{2}(x-4)$.', 'So $y=-\\tfrac{1}{2}x+3$.'],
        answer: '$y=-\\tfrac{1}{2}x+3$',
        verify: { kind: 'values', pairs: [['-1/2*4+3', '1'], ['2*(-1/2)', '-1']] }
      },
      {
        question: 'Solve $y=2x+1$ and $x+y=10$ simultaneously.',
        steps: ['Substitute $y=2x+1$ into $x+y=10$: $x+2x+1=10$.', 'So $3x=9$ and $x=3$.', 'Then $y=2(3)+1=7$.'],
        answer: '$x=3,\\ y=7$',
        verify: { kind: 'values', pairs: [['2*3+1', '7'], ['3+7', '10']] }
      }
    ]
  },

  'ma5-mag-c-01': {
    summary: 'Scientific notation writes very large and very small numbers compactly, and significant figures say how much of a measurement can be trusted. Together they let you calculate with sizes from atoms to galaxies.',
    prereqs: ['ma4-ind-c-01', 'ma5-ind-c-01'],
    concepts: [
      { title: 'Scientific notation', body: 'A number is written as $a\\times10^n$ with $1\\le a<10$ and $n$ a whole number. Large numbers have positive $n$; numbers below $1$ have negative $n$. So $45\\,300\\,000=4.53\\times10^7$ and $0.0064=6.4\\times10^{-3}$.' },
      { title: 'Calculating in scientific notation', body: 'To multiply, multiply the decimal parts and add the indices; to divide, divide the decimal parts and subtract the indices. Then adjust so the decimal part is between $1$ and $10$.' },
      { title: 'Significant figures', body: 'Significant figures start at the first non-zero digit. To round, look at the digit after the last one you keep: $5$ or more rounds up. So $0.0070382$ is $0.00704$ to $3$ significant figures.' }
    ],
    definitions: [
      { term: 'Scientific notation', meaning: 'A number written as $a\\times10^n$, where $1\\le a<10$ and $n$ is an integer.' },
      { term: 'Significant figures', meaning: 'The digits of a number that carry its precision, counted from the first non-zero digit.' }
    ],
    formulas: [
      { label: 'Products and quotients', tex: '(a\\times10^m)(b\\times10^n)=ab\\times10^{m+n},\\qquad \\frac{a\\times10^m}{b\\times10^n}=\\frac{a}{b}\\times10^{m-n}' }
    ],
    points: [
      { front: '$3\\,600\\,000$ in scientific notation', back: '$3.6\\times10^6$.' },
      { front: '$0.00052$ in scientific notation', back: '$5.2\\times10^{-4}$.' },
      { front: 'Is $12\\times10^3$ in scientific notation?', back: 'No: $12$ is not below $10$. It is $1.2\\times10^4$.' },
      { front: 'Significant figures in $0.00406$', back: 'Three: $4$, $0$ and $6$. The leading zeros do not count.' }
    ],
    mistakes: [
      { wrong: '$0.0064=6.4\\times10^{3}$.', right: 'Moving the decimal point right makes the index negative: $6.4\\times10^{-3}$.' },
      { wrong: '$(4\\times10^3)(5\\times10^2)=20\\times10^5$ and that is final.', right: 'The product is $20\\times10^5$, which is $2\\times10^6$ once the decimal part is brought back below $10$.' }
    ],
    examples: [
      {
        question: 'Write $45\\,300\\,000$ in scientific notation.',
        steps: ['Place the decimal point after the first non-zero digit: $4.53$.', 'It moved $7$ places, so the index is $7$.'],
        answer: '$4.53\\times10^7$',
        verify: { kind: 'value', expr: '4.53*10^7', answer: '45300000' }
      },
      {
        question: 'Calculate $(3\\times10^4)\\times(2.5\\times10^{-2})$.',
        steps: ['Multiply the decimal parts: $3\\times2.5=7.5$.', 'Add the indices: $4+(-2)=2$.', 'The result $7.5\\times10^2$ is already in scientific notation.'],
        answer: '$7.5\\times10^2=750$',
        verify: { kind: 'value', expr: '3*10^4*2.5*10^(-2)', answer: '750' }
      },
      {
        question: 'A bacterium is $2\\times10^{-6}$ m long. How many, placed end to end, fit in $1$ mm ($10^{-3}$ m)?',
        steps: ['Divide the lengths: $\\dfrac{10^{-3}}{2\\times10^{-6}}$.', '$\\dfrac{1}{2}\\times10^{-3-(-6)}=0.5\\times10^{3}$.', '$0.5\\times10^3=500$.'],
        answer: '$500$ bacteria',
        verify: { kind: 'value', expr: '10^(-3)/(2*10^(-6))', answer: '500' }
      }
    ]
  },

  'ma5-nli-c-01': {
    summary: 'A quadratic relationship makes a parabola. Its equation shows where it crosses the axes, where it turns and which way it opens, and shifting or stretching the equation moves or reshapes the curve in predictable ways.',
    prereqs: ['ma5-alg-c-01', 'ma5-lin-c-01'],
    concepts: [
      { title: 'The shape and its axis', body: 'The graph of $y=ax^2+bx+c$ is a parabola. It opens up if $a>0$ and down if $a<0$, and it is symmetrical about a vertical axis through its turning point (the vertex).' },
      { title: 'Intercepts and the vertex', body: 'Put $x=0$ for the $y$-intercept, which is $c$. Put $y=0$ and factorise for the $x$-intercepts. The axis of symmetry lies halfway between the $x$-intercepts, and the vertex lies on it.' },
      { title: 'Shifting and stretching', body: 'For $y=a(x-h)^2+k$ the vertex is $(h,k)$. Changing $h$ slides the curve sideways, changing $k$ slides it up or down, and a larger $|a|$ makes it narrower.' }
    ],
    definitions: [
      { term: 'Parabola', meaning: 'The symmetrical U-shaped curve that is the graph of a quadratic relationship.' },
      { term: 'Vertex', meaning: 'The turning point of a parabola: its lowest point if it opens up, its highest if it opens down.' }
    ],
    formulas: [
      { label: 'Axis of symmetry', tex: 'x=-\\frac{b}{2a}' },
      { label: 'Turning-point form', tex: 'y=a(x-h)^2+k,\\quad \\text{vertex }(h,k)' }
    ],
    points: [
      { front: 'The $y$-intercept of $y=x^2-4x-5$', back: '$-5$, the constant term.' },
      { front: 'Does $y=-2x^2+3$ open up or down?', back: 'Down, because $a=-2$ is negative.' },
      { front: 'The vertex of $y=(x-3)^2+1$', back: '$(3,1)$.' },
      { front: 'Where is the axis of symmetry if the $x$-intercepts are $-1$ and $5$?', back: 'At $x=2$, halfway between them.' }
    ],
    mistakes: [
      { wrong: 'The vertex of $y=(x-3)^2+1$ is $(-3,1)$.', right: 'The bracket $x-3$ is zero at $x=3$, so the vertex is $(3,1)$.' },
      { wrong: 'A parabola crosses the $x$-axis exactly twice.', right: 'It can cross twice, touch once or miss the axis entirely, depending on the vertex and the direction it opens.' }
    ],
    examples: [
      {
        question: 'For $y=x^2-4x-5$ find the $x$-intercepts, the axis of symmetry and the vertex.',
        steps: ['Factorise: $x^2-4x-5=(x-5)(x+1)$, so the $x$-intercepts are $5$ and $-1$.', 'The axis is halfway between them: $x=\\dfrac{5+(-1)}{2}=2$.', 'At $x=2$: $y=4-8-5=-9$, so the vertex is $(2,-9)$.'],
        answer: '$x=5,\\ -1$; axis $x=2$; vertex $(2,-9)$',
        verify: { kind: 'roots', f: 'x^2-4*x-5', answers: ['5', '-1'] }
      },
      {
        question: 'Describe $y=(x-3)^2+1$ and find where it meets the $y$-axis.',
        steps: ['It is $y=x^2$ moved $3$ to the right and $1$ up, so the vertex is $(3,1)$ and it opens up.', 'At $x=0$: $y=(0-3)^2+1=10$.'],
        answer: 'Vertex $(3,1)$, $y$-intercept $10$',
        verify: { kind: 'value', expr: '(0-3)^2+1', answer: '10' }
      },
      {
        question: 'Solve $x^2+2x-8=0$.',
        steps: ['Look for two numbers with product $-8$ and sum $2$: $4$ and $-2$.', 'So $(x+4)(x-2)=0$.', 'Therefore $x=-4$ or $x=2$.'],
        answer: '$x=-4$ or $x=2$',
        verify: { kind: 'roots', f: 'x^2+2*x-8', answers: ['-4', '2'] }
      }
    ]
  },

  'ma5-nli-c-02': {
    summary: 'Not every curve is a parabola. Exponential relationships grow or decay by a constant factor, hyperbolas describe quantities that trade off, and circles are all points a fixed distance from a centre.',
    prereqs: ['ma5-nli-c-01', 'ma5-ind-c-01'],
    concepts: [
      { title: 'Exponential growth and decay', body: 'In $y=a\\,b^x$ the value is multiplied by $b$ each time $x$ increases by $1$. If $b>1$ it grows; if $0<b<1$ it decays. It never reaches $0$, so the $x$-axis is an asymptote.' },
      { title: 'Hyperbolas', body: 'The graph of $y=\\dfrac{k}{x}$ has two branches and cannot touch either axis. Doubling $x$ halves $y$, which is why it models quantities such as time and speed over a fixed distance.' },
      { title: 'Circles', body: 'A circle with centre at the origin and radius $r$ satisfies $x^2+y^2=r^2$. A point is on the circle if its coordinates make the equation true, inside if the left side is smaller and outside if it is larger.' }
    ],
    definitions: [
      { term: 'Asymptote', meaning: 'A line that a curve gets closer and closer to without ever reaching it.' },
      { term: 'Exponential relationship', meaning: 'A relationship in which the variable is in the index, such as $y=3\\times2^x$, so equal steps in $x$ multiply $y$ by the same factor.' }
    ],
    formulas: [
      { label: 'Exponential', tex: 'y=a\\,b^x' },
      { label: 'Hyperbola', tex: 'y=\\frac{k}{x},\\quad xy=k' },
      { label: 'Circle, centre the origin', tex: 'x^2+y^2=r^2' }
    ],
    points: [
      { front: 'The $y$-intercept of $y=3\\times2^x$', back: '$3$, because $2^0=1$.' },
      { front: 'A value falls $20\\%$ each year. What is the factor $b$?', back: '$0.8$.' },
      { front: 'The asymptotes of $y=\\dfrac{12}{x}$', back: 'The two axes, $x=0$ and $y=0$.' },
      { front: 'The radius of $x^2+y^2=49$', back: '$7$.' }
    ],
    mistakes: [
      { wrong: 'A $20\\%$ yearly fall from $\\$1000$ gives $\\$600$ after two years ($2\\times20\\%$ off).', right: 'Multiply by $0.8$ twice: $1000\\times0.8^2=640$. The drop each year is a percentage of the new value.' },
      { wrong: 'The circle $x^2+y^2=25$ has radius $25$.', right: 'The right side is $r^2$, so $r=5$.' }
    ],
    examples: [
      {
        question: 'Complete a table of values for $y=3\\times2^x$ for $x=0,1,2,3$.',
        steps: ['At $x=0$: $3\\times1=3$.', 'Each step multiplies by $2$: $6$, then $12$, then $24$.'],
        answer: '$3,\\ 6,\\ 12,\\ 24$',
        verify: { kind: 'values', pairs: [['3*2^0', '3'], ['3*2^1', '6'], ['3*2^2', '12'], ['3*2^3', '24']] }
      },
      {
        question: 'A machine worth $\\$1000$ loses $20\\%$ of its value each year. What is it worth after $2$ years?',
        steps: ['The factor is $1-0.2=0.8$.', '$V=1000\\times0.8^2$.', '$1000\\times0.64=640$.'],
        answer: '$\\$640$',
        verify: { kind: 'value', expr: '1000*0.8^2', answer: '640' }
      },
      {
        question: 'Is $(3,4)$ on, inside or outside the circle $x^2+y^2=25$? What about $(2,5)$?',
        steps: ['For $(3,4)$: $3^2+4^2=25$, equal to $r^2$, so it is on the circle.', 'For $(2,5)$: $2^2+5^2=29$, larger than $25$, so it is outside.'],
        answer: '$(3,4)$ is on the circle; $(2,5)$ is outside it',
        verify: { kind: 'values', pairs: [['3^2+4^2', '25'], ['2^2+5^2', '29']] }
      }
    ]
  },

  'ma5-pro-c-01': {
    summary: 'Probability measures how likely an event is, from $0$ (impossible) to $1$ (certain). With more than one stage, tree diagrams and Venn diagrams keep the outcomes organised, and the effect of putting items back or not is the key distinction.',
    prereqs: ['ma4-pro-c-01', 'ma4-frc-c-01'],
    concepts: [
      { title: 'Multiplying along a branch', body: 'For a two-stage event, the probability of a particular pair of outcomes is the product of the probabilities along its branch of the tree. Add the products of the branches that make up the event you want.' },
      { title: 'With or without replacement', body: 'If an item is put back, the second stage has the same probabilities as the first (the stages are independent). If it is not put back, the numbers in the second stage change.' },
      { title: 'Complements and Venn diagrams', body: 'The probability that an event does not happen is $1-P(A)$. In a Venn diagram, the overlap is counted once, so the number in $A$ or $B$ is $n(A)+n(B)-n(A\\text{ and }B)$.' }
    ],
    definitions: [
      { term: 'Independent events', meaning: 'Events where the outcome of one does not change the probability of the other.' },
      { term: 'Complementary event', meaning: 'The event “not $A$”, with $P(\\text{not }A)=1-P(A)$.' }
    ],
    formulas: [
      { label: 'Probability of an event', tex: 'P(A)=\\frac{\\text{number of favourable outcomes}}{\\text{total number of outcomes}}' },
      { label: 'Complement and union', tex: 'P(\\text{not }A)=1-P(A),\\qquad n(A\\cup B)=n(A)+n(B)-n(A\\cap B)' }
    ],
    points: [
      { front: 'The probabilities on all branches leaving one point of a tree add to what?', back: '$1$.' },
      { front: 'When do you multiply probabilities?', back: 'Along a branch, for “and then”.' },
      { front: 'When do you add probabilities?', back: 'Across different branches that make up the event, for “or”.' },
      { front: '$P(\\text{rain})=0.3$. What is $P(\\text{no rain})$?', back: '$0.7$.' }
    ],
    mistakes: [
      { wrong: 'Drawing two counters without replacement uses the same probabilities both times.', right: 'After the first draw there are fewer counters, so the second fraction changes: $\\tfrac{3}{5}\\times\\tfrac{2}{4}$.' },
      { wrong: 'In a Venn diagram, writing $18$ in the netball-only region when $18$ students play netball and $5$ also swim.', right: 'The overlap is part of the $18$. Netball only is $18-5=13$.' }
    ],
    examples: [
      {
        question: 'A bag has $3$ red and $2$ blue counters. Two are drawn with replacement. Find $P(\\text{both red})$.',
        steps: ['Each draw has $P(\\text{red})=\\tfrac{3}{5}$.', 'Multiply along the branch: $\\tfrac{3}{5}\\times\\tfrac{3}{5}$.', '$=\\tfrac{9}{25}$.'],
        answer: '$\\tfrac{9}{25}$',
        verify: { kind: 'value', expr: '3/5*3/5', answer: '9/25' }
      },
      {
        question: 'The same bag, but the first counter is not replaced. Find $P(\\text{both red})$.',
        steps: ['First draw: $P(\\text{red})=\\tfrac{3}{5}$.', 'Now $2$ red remain among $4$ counters: $P(\\text{red})=\\tfrac{2}{4}$.', '$\\tfrac{3}{5}\\times\\tfrac{2}{4}=\\tfrac{6}{20}=\\tfrac{3}{10}$.'],
        answer: '$\\tfrac{3}{10}$',
        verify: { kind: 'value', expr: '3/5*2/4', answer: '3/10' }
      },
      {
        question: 'Of $30$ students, $18$ play netball, $12$ swim and $5$ do both. Find the probability that a student chosen at random does neither.',
        steps: ['Netball or swimming: $18+12-5=25$ students.', 'Neither: $30-25=5$ students.', '$P(\\text{neither})=\\tfrac{5}{30}=\\tfrac{1}{6}$.'],
        answer: '$\\tfrac{1}{6}$',
        verify: { kind: 'values', pairs: [['30-(18+12-5)', '5'], ['5/30', '1/6']] }
      }
    ]
  },

  'ma5-trg-c-01': {
    summary: 'In a right-angled triangle the ratios of the sides depend only on the angles. Sine, cosine and tangent let you find an unknown side from one side and an angle, or an unknown angle from two sides.',
    prereqs: ['ma4-pyt-c-01', 'ma4-ang-c-01'],
    concepts: [
      { title: 'Naming the sides', body: 'Relative to the angle $\\theta$ you are using, the hypotenuse is opposite the right angle, the opposite side faces $\\theta$ and the adjacent side touches $\\theta$ (without being the hypotenuse). Label them before choosing a ratio.' },
      { title: 'The three ratios', body: '$\\sin\\theta=\\dfrac{\\text{opp}}{\\text{hyp}}$, $\\cos\\theta=\\dfrac{\\text{adj}}{\\text{hyp}}$, $\\tan\\theta=\\dfrac{\\text{opp}}{\\text{adj}}$. Choose the one that contains the two sides you are working with.' },
      { title: 'Finding an angle', body: 'To find an angle from a ratio, use the inverse function: if $\\tan\\theta=0.75$ then $\\theta=\\tan^{-1}(0.75)\\approx36.9^\\circ$. Make sure the calculator is in degree mode.' }
    ],
    definitions: [
      { term: 'Hypotenuse', meaning: 'The longest side of a right-angled triangle, opposite the right angle.' },
      { term: 'Trigonometric ratio', meaning: 'The ratio of two sides of a right-angled triangle, fixed by one of its acute angles: sine, cosine or tangent.' }
    ],
    formulas: [
      { label: 'The three ratios', tex: '\\sin\\theta=\\frac{o}{h},\\qquad \\cos\\theta=\\frac{a}{h},\\qquad \\tan\\theta=\\frac{o}{a}' }
    ],
    points: [
      { front: 'A way to remember the ratios', back: 'SOH CAH TOA: sine is opposite over hypotenuse, cosine adjacent over hypotenuse, tangent opposite over adjacent.' },
      { front: '$\\sin30^\\circ$', back: '$0.5$.' },
      { front: 'When do you use the inverse function?', back: 'When the angle is the unknown and two sides are known.' },
      { front: 'Which ratio uses the two legs only?', back: 'Tangent: opposite over adjacent.' }
    ],
    mistakes: [
      { wrong: 'Calculator set to radians, so $\\sin30$ gives $-0.988$.', right: 'Set the calculator to degrees: $\\sin30^\\circ=0.5$.' },
      { wrong: 'Using $\\sin\\theta=\\dfrac{\\text{adj}}{\\text{hyp}}$ because the side was nearest.', right: 'Label the sides from the angle first; adjacent over hypotenuse is cosine.' }
    ],
    examples: [
      {
        question: 'A right-angled triangle has hypotenuse $10$ cm and an angle of $30^\\circ$. Find the side opposite the angle.',
        steps: ['The opposite and hypotenuse are involved, so use sine.', '$\\sin30^\\circ=\\dfrac{x}{10}$.', '$x=10\\sin30^\\circ=10\\times0.5=5$.'],
        answer: '$5$ cm',
        verify: { kind: 'value', expr: '10*sin(30*pi/180)', answer: '5' }
      },
      {
        question: 'In a right-angled triangle the side opposite $\\theta$ is $6$ and the adjacent side is $8$. Find $\\theta$ to the nearest tenth of a degree.',
        steps: ['Opposite and adjacent give tangent: $\\tan\\theta=\\dfrac{6}{8}=0.75$.', '$\\theta=\\tan^{-1}(0.75)$.', '$\\theta\\approx36.9^\\circ$.'],
        answer: '$\\theta\\approx36.9^\\circ$',
        verify: { kind: 'value', expr: 'atan(6/8)*180/pi', answer: '36.86989764584402' }
      },
      {
        question: 'The side opposite a $40^\\circ$ angle is $7$ m. Find the hypotenuse to $1$ decimal place.',
        steps: ['Opposite and hypotenuse give sine: $\\sin40^\\circ=\\dfrac{7}{h}$.', 'Rearrange: $h=\\dfrac{7}{\\sin40^\\circ}$.', '$h\\approx10.9$.'],
        answer: '$\\approx10.9$ m',
        verify: { kind: 'value', expr: '7/sin(40*pi/180)', answer: '10.890066788022887' }
      }
    ]
  },

  'ma5-trg-c-02': {
    summary: 'Right-angled trigonometry turns real situations into triangles: looking up at a flagpole, looking down from a cliff, or travelling on a bearing. A clear diagram with the angle in the right place is most of the work.',
    prereqs: ['ma5-trg-c-01'],
    concepts: [
      { title: 'Angles of elevation and depression', body: 'Both are measured from the horizontal. The angle of elevation looks up from the observer to the object; the angle of depression looks down. The angle of depression from the top equals the angle of elevation from the bottom, because they are alternate angles.' },
      { title: 'Bearings', body: 'A bearing is an angle measured clockwise from north, written with three digits, such as $060^\\circ$. Draw a north line at the start of each leg and mark the angle clockwise from it.' },
      { title: 'Exact values', body: 'For $30^\\circ$, $45^\\circ$ and $60^\\circ$ the ratios are exact: $\\sin30^\\circ=\\tfrac{1}{2}$, $\\sin45^\\circ=\\tfrac{\\sqrt2}{2}$, $\\sin60^\\circ=\\tfrac{\\sqrt3}{2}$, with $\\cos$ reversed and $\\tan45^\\circ=1$.' }
    ],
    definitions: [
      { term: 'Angle of elevation', meaning: 'The angle between the horizontal and the line of sight to an object above the observer.' },
      { term: 'Bearing', meaning: 'The direction of travel, given as an angle measured clockwise from north using three digits.' }
    ],
    formulas: [
      { label: 'Components of a bearing $\\theta$ over a distance $d$', tex: '\\text{east}=d\\sin\\theta,\\qquad \\text{north}=d\\cos\\theta' }
    ],
    points: [
      { front: 'The bearing of east', back: '$090^\\circ$.' },
      { front: 'The bearing of south-west', back: '$225^\\circ$.' },
      { front: 'The back bearing of $060^\\circ$', back: '$240^\\circ$: add $180^\\circ$ (subtract it if the result passes $360^\\circ$).' },
      { front: '$\\cos60^\\circ$', back: '$\\tfrac{1}{2}$.' }
    ],
    mistakes: [
      { wrong: 'Measuring an angle of elevation from the vertical.', right: 'Elevation and depression are measured from the horizontal.' },
      { wrong: 'Writing a bearing as $60^\\circ$ or measuring it anticlockwise.', right: 'Write three digits, $060^\\circ$, and measure clockwise from north.' }
    ],
    examples: [
      {
        question: 'Standing $40$ m from the base of a tower, you see its top $30$ m above eye level. Find the angle of elevation to the nearest degree.',
        steps: ['The opposite side is $30$ and the adjacent side is $40$.', '$\\tan\\theta=\\dfrac{30}{40}=0.75$.', '$\\theta=\\tan^{-1}(0.75)\\approx37^\\circ$.'],
        answer: '$\\approx37^\\circ$',
        verify: { kind: 'value', expr: 'atan(30/40)*180/pi', answer: '36.86989764584402' }
      },
      {
        question: 'From $40$ m from the base, the angle of elevation of the top of a different tower is $35^\\circ$. Find its height above eye level.',
        steps: ['Opposite is unknown and adjacent is $40$, so use tangent.', '$h=40\\tan35^\\circ$.', '$h\\approx28.0$ m.'],
        answer: '$\\approx28.0$ m',
        verify: { kind: 'value', expr: '40*tan(35*pi/180)', answer: '28.008301528388387' }
      },
      {
        question: 'A boat sails $12$ km on a bearing of $150^\\circ$. How far south of its starting point is it?',
        steps: ['A bearing of $150^\\circ$ is $30^\\circ$ east of south, since $180-150=30$.', 'The southward distance is the side adjacent to $30^\\circ$.', '$12\\cos30^\\circ=12\\times\\tfrac{\\sqrt3}{2}=6\\sqrt3\\approx10.4$ km.'],
        answer: '$6\\sqrt3\\approx10.4$ km south',
        verify: { kind: 'value', expr: '12*cos(30*pi/180)', answer: '6*sqrt(3)' }
      }
    ]
  },

  'ma5-vol-c-01': {
    summary: 'Volume measures the space inside a solid. Prisms and cylinders share one rule, pyramids and cones take a third of the matching prism or cylinder, and a sphere has its own formula.',
    prereqs: ['ma4-vol-c-01', 'ma5-are-c-01'],
    concepts: [
      { title: 'Prisms and cylinders', body: 'Any prism or cylinder has the same cross-section along its whole length, so volume is the area of that cross-section times the length (or height): $V=Ah$. For a cylinder $A=\\pi r^2$.' },
      { title: 'Pyramids and cones', body: 'A pyramid or cone takes up exactly one third of the prism or cylinder with the same base and height: $V=\\tfrac{1}{3}Ah$. The height is the perpendicular height, not the slant length.' },
      { title: 'Spheres and units', body: 'A sphere of radius $r$ has volume $\\tfrac{4}{3}\\pi r^3$. Volumes are in cubic units, and $1\\,000$ cm$^3$ is $1$ litre, so convert before reporting capacity.' }
    ],
    definitions: [
      { term: 'Cross-section', meaning: 'The face you see when a solid is cut straight through; in a prism it is the same all along its length.' },
      { term: 'Perpendicular height', meaning: 'The height measured at right angles to the base, used in volume formulas for pyramids and cones.' }
    ],
    formulas: [
      { label: 'Prism or cylinder', tex: 'V=Ah,\\qquad V=\\pi r^2h' },
      { label: 'Pyramid or cone', tex: 'V=\\tfrac{1}{3}Ah,\\qquad V=\\tfrac{1}{3}\\pi r^2h' },
      { label: 'Sphere', tex: 'V=\\tfrac{4}{3}\\pi r^3' }
    ],
    points: [
      { front: 'The volume of a cube with edge $4$ cm', back: '$64$ cm$^3$.' },
      { front: 'How many millilitres are in $1$ cm$^3$?', back: '$1$ mL, so $1$ L is $1\\,000$ cm$^3$.' },
      { front: 'A cone and a cylinder share base and height. How do their volumes compare?', back: 'The cone is one third of the cylinder.' },
      { front: 'Why use perpendicular height in a cone?', back: 'The slant side is longer and slants over the edge; volume depends on the vertical height only.' }
    ],
    mistakes: [
      { wrong: 'Using the slant height in $\\tfrac{1}{3}\\pi r^2h$.', right: 'Use the perpendicular height; find it with Pythagoras’ theorem if only the slant height is given.' },
      { wrong: 'Using the diameter as $r$ in $\\pi r^2h$.', right: 'The radius is half the diameter. A diameter of $6$ cm means $r=3$ cm.' }
    ],
    examples: [
      {
        question: 'A triangular prism has a right-angled triangle cross-section with base $6$ cm and height $4$ cm, and is $10$ cm long. Find its volume.',
        steps: ['The cross-section area is $\\tfrac{1}{2}\\times6\\times4=12$ cm$^2$.', '$V=Ah=12\\times10=120$.'],
        answer: '$120$ cm$^3$',
        verify: { kind: 'value', expr: '1/2*6*4*10', answer: '120' }
      },
      {
        question: 'A cylinder has radius $3$ cm and height $10$ cm. Find its volume in cm$^3$ to $1$ decimal place, and in litres.',
        steps: ['$V=\\pi r^2h=\\pi\\times3^2\\times10=90\\pi$.', '$90\\pi\\approx282.7$ cm$^3$.', 'Dividing by $1\\,000$ gives about $0.283$ litres.'],
        answer: '$90\\pi\\approx282.7$ cm$^3\\approx0.283$ L',
        verify: { kind: 'value', expr: 'pi*3^2*10', answer: '282.7433388230814' }
      },
      {
        question: 'A cone has radius $5$ cm and perpendicular height $12$ cm. Find its volume in terms of $\\pi$ and to $1$ decimal place.',
        steps: ['$V=\\tfrac{1}{3}\\pi r^2h=\\tfrac{1}{3}\\pi\\times25\\times12$.', '$\\tfrac{1}{3}\\times25\\times12=100$, so $V=100\\pi$.', '$100\\pi\\approx314.2$ cm$^3$.'],
        answer: '$100\\pi\\approx314.2$ cm$^3$',
        verify: { kind: 'value', expr: '1/3*pi*5^2*12', answer: '100*pi' }
      }
    ]
  }
};
