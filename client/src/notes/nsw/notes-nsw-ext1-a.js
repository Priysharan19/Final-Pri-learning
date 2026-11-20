// Pri Learning · NSW Notes · Mathematics Extension 1 · Year 11 (first band)
//
// Original revision writing for the five Year 11 Extension 1 focus areas covered
// here (functions, polynomials, trigonometry, counting, the binomial theorem).
// Written for Pri Learning; it is not an official NESA publication and quotes no
// syllabus text. Each topic is keyed by the lower-case outcome code of its focus
// area (a reference only). en-AU spelling. Angles are in radians in the engine.
export default {
  'me1-11-01': {
    summary: 'Further work with functions adds three tools to what you already know: inverse functions (undoing a function, which needs a restricted domain when the function is not one-to-one), parametric form (writing $x$ and $y$ each in terms of a third variable), and inequalities that involve a variable in the denominator.',
    prereqs: ['mav-11-01'],
    concepts: [
      { title: 'Inverse functions', body: 'A function has an inverse only if each output comes from exactly one input. Swap $x$ and $y$ and solve for $y$. The graph of $y=f^{-1}(x)$ is the graph of $y=f(x)$ reflected in the line $y=x$, so the domain of $f$ becomes the range of $f^{-1}$ and the range of $f$ becomes its domain.' },
      { title: 'Restricting a domain', body: 'A parabola fails the horizontal line test, so $f(x)=x^2+1$ has no inverse on all of $\\mathbb{R}$. Restrict it to $x\\ge 0$ and it becomes one-to-one, with inverse $f^{-1}(x)=\\sqrt{x-1}$ for $x\\ge 1$.' },
      { title: 'Parametric form and inequalities', body: 'A parametric curve gives $x=x(t)$ and $y=y(t)$; eliminating $t$ gives the Cartesian equation. For an inequality such as $\\tfrac{x+1}{x-2}>2$, never multiply by $x-2$ (its sign is unknown). Move everything to one side, combine into one fraction, then find where its sign changes: at the zeros of the numerator and denominator.' }
    ],
    definitions: [
      { term: 'One-to-one function', meaning: 'A function in which different inputs always give different outputs. Its graph passes the horizontal line test.' },
      { term: 'Inverse function', meaning: 'The function $f^{-1}$ that satisfies $f^{-1}(f(x))=x$ for every $x$ in the domain of $f$ and $f(f^{-1}(x))=x$ for every $x$ in the domain of $f^{-1}$.' }
    ],
    formulas: [
      { label: 'Inverse and composition', tex: 'f\\big(f^{-1}(x)\\big)=x,\\qquad f^{-1}\\big(f(x)\\big)=x' },
      { label: 'Finding an inverse', tex: 'y=f(x)\\;\\Longrightarrow\\;x=f(y)\\text{ solved for }y' }
    ],
    points: [
      { front: 'Where does the graph of $f$ meet the graph of $f^{-1}$?', back: 'Any point where $f$ crosses $y=x$ is on both graphs. For an increasing $f$ every meeting point is on $y=x$; a decreasing $f$ such as $-x^3$ can also meet its inverse off the line.' },
      { front: 'What becomes the domain of $f^{-1}$?', back: 'The range of $f$.' },
      { front: 'The inverse of $y=2x-6$', back: 'Swap: $x=2y-6$, so $y=\\tfrac{x+6}{2}$.' },
      { front: 'How do you eliminate the parameter from $x=2t+1$, $y=t^2-3$?', back: 'Solve $t=\\tfrac{x-1}{2}$ and substitute: $y=\\left(\\tfrac{x-1}{2}\\right)^2-3$.' },
      { front: 'Why is $\\tfrac{1}{x}>2$ not the same as $1>2x$?', back: 'Multiplying by $x$ reverses the inequality when $x<0$. Compare with $\\tfrac{1}{x}-2>0$ instead.' }
    ],
    mistakes: [
      { wrong: 'The inverse of $f(x)=x^2+1$ is $\\sqrt{x-1}$ with no mention of the domain.', right: 'State the restriction: $f$ on $x\\ge0$ has inverse $\\sqrt{x-1}$ for $x\\ge1$. Without it, $f$ is not one-to-one.' },
      { wrong: '$f^{-1}(x)=\\dfrac{1}{f(x)}$.', right: 'The inverse undoes the function; the reciprocal is a different thing. For $f(x)=2x$, $f^{-1}(x)=\\tfrac{x}{2}$ but $\\tfrac{1}{f(x)}=\\tfrac{1}{2x}$.' },
      { wrong: 'Solving $\\tfrac{x+1}{x-2}>2$ by multiplying both sides by $x-2$.', right: 'The sign of $x-2$ is not known. Write $\\tfrac{5-x}{x-2}>0$ and test the intervals.' }
    ],
    examples: [
      {
        question: 'The function $f(x)=x^2+1$ has domain $x\\ge0$. Find $f^{-1}(x)$, state its domain, and find $f^{-1}(10)$.',
        steps: ['Swap $x$ and $y$: $x=y^2+1$, so $y^2=x-1$.', 'The original domain $x\\ge0$ means the inverse takes non-negative values, so $y=\\sqrt{x-1}$. Its domain is the range of $f$, which is $x\\ge1$.', 'Evaluate: $f^{-1}(10)=\\sqrt{10-1}=3$. Check: $f(3)=10$.'],
        answer: '$f^{-1}(x)=\\sqrt{x-1}$ for $x\\ge1$, and $f^{-1}(10)=3$',
        verify: { kind: 'values', pairs: [['sqrt(10-1)', '3'], ['3^2+1', '10']] }
      },
      {
        question: 'A curve is given by $x=2t+1$ and $y=t^2-3$. Find its Cartesian equation and the point with $t=3$.',
        steps: ['From the first equation, $t=\\tfrac{x-1}{2}$.', 'Substitute: $y=\\left(\\tfrac{x-1}{2}\\right)^2-3$.', 'At $t=3$: $x=7$ and $y=9-3=6$. Check in the Cartesian form: $\\left(\\tfrac{7-1}{2}\\right)^2-3=6$.'],
        answer: '$y=\\left(\\tfrac{x-1}{2}\\right)^2-3$; the point is $(7,6)$',
        verify: { kind: 'values', pairs: [['((7-1)/2)^2-3', '6'], ['3^2-3', '6']] }
      },
      {
        question: 'Solve $\\dfrac{x+1}{x-2}>2$.',
        steps: ['Move the $2$ across and combine: $\\tfrac{x+1}{x-2}-2=\\tfrac{x+1-2(x-2)}{x-2}=\\tfrac{5-x}{x-2}$.', 'The fraction is zero at $x=5$ and undefined at $x=2$, so test $x<2$, $2<x<5$ and $x>5$.', 'Only $2<x<5$ gives a positive fraction. Check $x=3$: $\\tfrac{4}{1}=4>2$. At $x=5$ the two sides are equal, so $5$ is excluded.'],
        answer: '$2<x<5$',
        verify: { kind: 'values', pairs: [['(3+1)/(3-2)', '4'], ['(5+1)/(5-2)', '2']] }
      }
    ]
  },

  'me1-11-02': {
    summary: 'A polynomial is a sum of non-negative whole-number powers of $x$. The remainder and factor theorems let you test a divisor without long division, and the relationships between the zeroes and the coefficients give sums and products of zeroes without solving the equation.',
    prereqs: ['ma5-pol-p-01'],
    concepts: [
      { title: 'Division and the remainder theorem', body: 'Dividing $P(x)$ by $x-a$ gives $P(x)=(x-a)Q(x)+R$, where the remainder $R$ is a constant. Put $x=a$ and the bracket vanishes, so $R=P(a)$. For a divisor $ax-b$ the remainder is $P\\!\\left(\\tfrac{b}{a}\\right)$.' },
      { title: 'The factor theorem', body: '$x-a$ is a factor of $P(x)$ exactly when $P(a)=0$. Test the factors of the constant term, then divide to leave a lower-degree polynomial.' },
      { title: 'Sums and products of zeroes', body: 'If $\\alpha,\\beta,\\gamma$ are the zeroes of $ax^3+bx^2+cx+d$, expanding $a(x-\\alpha)(x-\\beta)(x-\\gamma)$ and comparing coefficients gives $\\alpha+\\beta+\\gamma=-\\tfrac{b}{a}$, $\\alpha\\beta+\\beta\\gamma+\\gamma\\alpha=\\tfrac{c}{a}$ and $\\alpha\\beta\\gamma=-\\tfrac{d}{a}$. Expressions such as $\\alpha^2+\\beta^2+\\gamma^2$ follow from these.' }
    ],
    definitions: [
      { term: 'Zero of a polynomial', meaning: 'A value $a$ with $P(a)=0$. It is the $x$-coordinate of an $x$-intercept of the graph.' },
      { term: 'Degree', meaning: 'The highest power of $x$ with a non-zero coefficient. A polynomial of degree $n$ has at most $n$ zeroes.' }
    ],
    formulas: [
      { label: 'Remainder and factor theorems', tex: 'P(x)=(x-a)Q(x)+P(a)' },
      { label: 'Zeroes of a quadratic', tex: '\\alpha+\\beta=-\\frac{b}{a},\\qquad \\alpha\\beta=\\frac{c}{a}' },
      { label: 'Zeroes of a cubic', tex: '\\alpha+\\beta+\\gamma=-\\frac{b}{a},\\quad \\alpha\\beta+\\beta\\gamma+\\gamma\\alpha=\\frac{c}{a},\\quad \\alpha\\beta\\gamma=-\\frac{d}{a}' }
    ],
    points: [
      { front: 'The remainder when $P(x)$ is divided by $x+3$', back: '$P(-3)$.' },
      { front: 'What does $P(2)=0$ tell you?', back: '$x-2$ is a factor of $P(x)$, and $x=2$ is a zero.' },
      { front: 'A polynomial of degree $4$ has how many real zeroes?', back: 'At most $4$. It may have fewer, because some zeroes can be repeated or non-real.' },
      { front: '$\\alpha^2+\\beta^2$ in terms of $\\alpha+\\beta$ and $\\alpha\\beta$', back: '$(\\alpha+\\beta)^2-2\\alpha\\beta$.' },
      { front: 'A double zero at $x=a$ shows on the graph as', back: 'The curve touching the $x$-axis at $a$ and turning back, rather than crossing.' }
    ],
    mistakes: [
      { wrong: 'The remainder when $P(x)$ is divided by $x-2$ is $P(-2)$.', right: 'The divisor $x-2$ is zero at $x=2$, so the remainder is $P(2)$. The sign flips between the divisor and the value.' },
      { wrong: 'For $2x^3-3x^2-8x+12$ the sum of the zeroes is $\\tfrac{3}{2}$ but the product of the zeroes is $\\tfrac{12}{2}=6$.', right: 'The product is $-\\tfrac{d}{a}=-6$. For a cubic the sign alternates: $-\\tfrac{b}{a}$, $+\\tfrac{c}{a}$, $-\\tfrac{d}{a}$.' }
    ],
    examples: [
      {
        question: 'Find the remainder when $P(x)=2x^3-5x^2+x+7$ is divided by $x-2$.',
        steps: ['By the remainder theorem the remainder is $P(2)$.', '$P(2)=2(8)-5(4)+2+7=16-20+2+7$.', 'Evaluate: $5$. Since this is not zero, $x-2$ is not a factor.'],
        answer: '$5$',
        verify: { kind: 'value', expr: '2*2^3-5*2^2+2+7', answer: '5' }
      },
      {
        question: 'Find $k$ if $x+1$ is a factor of $P(x)=x^3+kx^2-4x-2$.',
        steps: ['$x+1$ is a factor, so $P(-1)=0$.', '$P(-1)=-1+k+4-2=k+1$.', 'Set $k+1=0$, so $k=-1$. Check: $P(x)=x^3-x^2-4x-2$ and $P(-1)=-1-1+4-2=0$.'],
        answer: '$k=-1$',
        verify: { kind: 'value', expr: '(-1)^3+(-1)*(-1)^2-4*(-1)-2', answer: '0' }
      },
      {
        question: 'The zeroes of $2x^3-3x^2-8x+12$ are $\\alpha,\\beta,\\gamma$. Find $\\alpha^2+\\beta^2+\\gamma^2$.',
        steps: ['Read the coefficients: $\\alpha+\\beta+\\gamma=\\tfrac{3}{2}$ and $\\alpha\\beta+\\beta\\gamma+\\gamma\\alpha=\\tfrac{-8}{2}=-4$.', 'Use $\\alpha^2+\\beta^2+\\gamma^2=(\\alpha+\\beta+\\gamma)^2-2(\\alpha\\beta+\\beta\\gamma+\\gamma\\alpha)$.', 'Substitute: $\\tfrac{9}{4}+8=\\tfrac{41}{4}$. Check by factorising: $(x^2-4)(2x-3)$ has zeroes $2,-2,\\tfrac{3}{2}$ and $4+4+\\tfrac{9}{4}=\\tfrac{41}{4}$.'],
        answer: '$\\tfrac{41}{4}$',
        verify: { kind: 'values', pairs: [['(3/2)^2-2*(-4)', '41/4'], ['2^2+(-2)^2+(3/2)^2', '41/4']] }
      }
    ]
  },

  'me1-11-03': {
    summary: 'Further trigonometry extends right-triangle ratios into three dimensions, adds the compound-angle, double-angle and $t$-formulas, and uses them to solve trigonometric equations exactly. In calculus-ready work angles are in radians.',
    prereqs: ['ma5-trg-c-02'],
    concepts: [
      { title: 'Trigonometry in three dimensions', body: 'Draw the right triangle that lies inside the solid and label its sides. The angle between a line and a plane is the angle between the line and its shadow (projection) on the plane. In a rectangular box with edges $3,4,12$ the base diagonal is $5$ and the space diagonal is $13$.' },
      { title: 'Identities', body: 'The compound-angle formulas $\\sin(A\\pm B)$ and $\\cos(A\\pm B)$ give the double-angle formulas by setting $B=A$. With $t=\\tan\\tfrac{\\theta}{2}$ every ratio becomes a rational function of $t$, which turns many trigonometric equations into algebra.' },
      { title: 'Trigonometric equations', body: 'Rewrite so that one function of one angle remains (often $\\cos(2x)=1-2\\sin^2x$ turns an equation into a quadratic in $\\sin x$), solve for the ratio, then list every angle in the stated interval. Always check the interval before writing a solution.' }
    ],
    definitions: [
      { term: 'Angle between a line and a plane', meaning: 'The acute angle between the line and its projection onto the plane: the smallest angle the line makes with any line in the plane.' },
      { term: 'Identity', meaning: 'An equation true for every value of the variable for which both sides are defined, such as $\\sin^2x+\\cos^2x=1$.' }
    ],
    formulas: [
      { label: 'Compound angles', tex: '\\sin(A\\pm B)=\\sin A\\cos B\\pm\\cos A\\sin B,\\qquad \\cos(A\\pm B)=\\cos A\\cos B\\mp\\sin A\\sin B' },
      { label: 'Double angles', tex: '\\sin2A=2\\sin A\\cos A,\\qquad \\cos2A=\\cos^2A-\\sin^2A=2\\cos^2A-1=1-2\\sin^2A' },
      { label: 'The $t$-formulas, $t=\\tan\\tfrac{\\theta}{2}$', tex: '\\sin\\theta=\\frac{2t}{1+t^2},\\qquad \\cos\\theta=\\frac{1-t^2}{1+t^2},\\qquad \\tan\\theta=\\frac{2t}{1-t^2}' }
    ],
    points: [
      { front: 'The exact value of $\\sin75^\\circ$', back: '$\\sin(45^\\circ+30^\\circ)=\\tfrac{\\sqrt6+\\sqrt2}{4}$.' },
      { front: 'Why does $\\cos2A$ have three forms?', back: 'The Pythagorean identity lets you replace $\\sin^2A$ by $1-\\cos^2A$ or $\\cos^2A$ by $1-\\sin^2A$. Choose the one that leaves a single function.' },
      { front: 'The $t$-formula for $\\sin\\theta$ when $t=\\tfrac12$', back: '$\\tfrac{2\\times\\frac12}{1+\\frac14}=\\tfrac45$.' },
      { front: 'Solutions of $\\sin x=-1$ on $[0,2\\pi]$', back: 'Only $x=\\tfrac{3\\pi}{2}$.' },
      { front: 'What does $\\tan\\theta=\\tfrac{2t}{1-t^2}$ fail at?', back: 'At $t=\\pm1$, where $\\theta=\\pm\\tfrac{\\pi}{2}$ and $\\tan\\theta$ is undefined.' }
    ],
    mistakes: [
      { wrong: '$\\sin(A+B)=\\sin A+\\sin B$.', right: 'Sine does not distribute over addition. Use $\\sin A\\cos B+\\cos A\\sin B$: for $A=B=90^\\circ$ the first gives $2$, impossible for a sine.' },
      { wrong: 'Dividing $\\sin2x=\\sin x$ through by $\\sin x$ to solve it.', right: 'Dividing by $\\sin x$ loses the roots where $\\sin x=0$ (here $x=0$ and $x=\\pi$ are solutions). Move everything to one side and factorise instead.' },
      { wrong: 'Giving only $x=\\tfrac{\\pi}{6}$ for $\\sin x=\\tfrac12$ on $[0,2\\pi]$.', right: 'Sine is positive in two quadrants: $x=\\tfrac{\\pi}{6}$ and $x=\\tfrac{5\\pi}{6}$.' }
    ],
    examples: [
      {
        question: 'Find the exact value of $\\sin75^\\circ$.',
        steps: ['Write $75^\\circ=45^\\circ+30^\\circ$ and use $\\sin(A+B)=\\sin A\\cos B+\\cos A\\sin B$.', '$\\sin75^\\circ=\\tfrac{\\sqrt2}{2}\\cdot\\tfrac{\\sqrt3}{2}+\\tfrac{\\sqrt2}{2}\\cdot\\tfrac12=\\tfrac{\\sqrt6+\\sqrt2}{4}$.', 'This is about $0.966$, which is just under $1$, as expected for an angle near $90^\\circ$.'],
        answer: '$\\tfrac{\\sqrt6+\\sqrt2}{4}$',
        verify: { kind: 'value', expr: 'sin(5*pi/12)', answer: '(sqrt(6)+sqrt(2))/4' }
      },
      {
        question: 'Solve $\\cos(2x)=\\sin x$ for $0\\le x\\le2\\pi$.',
        steps: ['Replace $\\cos(2x)$ by $1-2\\sin^2x$: $1-2\\sin^2x=\\sin x$, so $2\\sin^2x+\\sin x-1=0$.', 'Factorise: $(2\\sin x-1)(\\sin x+1)=0$, so $\\sin x=\\tfrac12$ or $\\sin x=-1$.', '$\\sin x=\\tfrac12$ gives $x=\\tfrac{\\pi}{6},\\tfrac{5\\pi}{6}$; $\\sin x=-1$ gives $x=\\tfrac{3\\pi}{2}$.'],
        answer: '$x=\\tfrac{\\pi}{6},\\tfrac{5\\pi}{6},\\tfrac{3\\pi}{2}$',
        verify: { kind: 'roots', f: 'cos(2*x)-sin(x)', answers: ['pi/6', '5*pi/6', '3*pi/2'] }
      },
      {
        question: 'A rectangular box has edges $3$ m, $4$ m and $12$ m. Find the length of the space diagonal and the sine of the angle it makes with the base (the $3$ by $4$ face).',
        steps: ['The diagonal of the base is $\\sqrt{3^2+4^2}=5$ m.', 'The space diagonal is the hypotenuse of a right triangle with sides $5$ and $12$: $\\sqrt{5^2+12^2}=13$ m.', 'The angle $\\theta$ with the base is opposite the height $12$, so $\\sin\\theta=\\tfrac{12}{13}$ (and $\\tan\\theta=\\tfrac{12}{5}$, giving $\\theta\\approx67.4^\\circ$).'],
        answer: '$13$ m; $\\sin\\theta=\\tfrac{12}{13}$',
        verify: { kind: 'values', pairs: [['sqrt(3^2+4^2+12^2)', '13'], ['sin(atan(12/5))', '12/13']] }
      }
    ]
  },

  'me1-11-04': {
    summary: 'Counting problems ask how many arrangements or selections are possible. Decide whether order matters, whether items repeat, and whether there are restrictions, then build the count from the multiplication principle, permutations and combinations.',
    prereqs: ['ma5-pro-c-01'],
    concepts: [
      { title: 'The multiplication principle and permutations', body: 'If one task can be done in $m$ ways and a second in $n$ ways, both can be done in $mn$ ways. Arranging $r$ of $n$ different objects in order gives $n(n-1)\\cdots(n-r+1)={}^nP_r$. Arranging all $n$ gives $n!$. If some objects are identical, divide by the factorial of each group of identical objects: the letters of BANANA can be arranged in $\\tfrac{6!}{3!\\,2!}=60$ ways.' },
      { title: 'Combinations', body: 'When order does not matter, each selection of $r$ objects corresponds to $r!$ ordered arrangements, so ${}^nC_r=\\tfrac{{}^nP_r}{r!}=\\tfrac{n!}{r!(n-r)!}$. Choosing $r$ to take is the same as choosing $n-r$ to leave, so ${}^nC_r={}^nC_{n-r}$.' },
      { title: 'Restrictions and complements', body: 'Handle a restriction by gluing: if two people must sit together, treat them as one object and multiply by the ways they can swap. Handle an "at least" condition by subtracting the unwanted count from the total. For arrangements round a circle, fix one object to remove the rotations: $(n-1)!$.' }
    ],
    definitions: [
      { term: 'Permutation', meaning: 'An arrangement of objects in a definite order. ${}^nP_r$ counts the ordered arrangements of $r$ objects chosen from $n$ different objects.' },
      { term: 'Combination', meaning: 'A selection of objects in which the order does not matter. ${}^nC_r$ counts the selections of $r$ objects from $n$ different objects.' }
    ],
    formulas: [
      { label: 'Permutations', tex: '{}^nP_r=\\frac{n!}{(n-r)!}' },
      { label: 'Combinations', tex: '{}^nC_r=\\frac{n!}{r!\\,(n-r)!}={}^nC_{n-r}' },
      { label: 'Identical objects and circles', tex: '\\frac{n!}{a!\\,b!\\cdots},\\qquad (n-1)!\\ \\text{round a circle}' }
    ],
    points: [
      { front: 'The test for permutation versus combination', back: 'Would swapping two chosen objects give a different outcome? If yes, order matters: a permutation. If no: a combination.' },
      { front: 'What is $0!$?', back: '$1$. It makes ${}^nC_0={}^nC_n=1$ work.' },
      { front: 'Ways to arrange $5$ people in a row', back: '$5!=120$.' },
      { front: 'Ways to choose a team of $3$ from $10$ people', back: '${}^{10}C_3=120$.' },
      { front: 'How is "at least one" counted quickly?', back: 'Total outcomes minus the outcomes with none.' }
    ],
    mistakes: [
      { wrong: 'Choosing a committee of $3$ from $10$ as ${}^{10}P_3=720$.', right: 'A committee has no order: ${}^{10}C_3=120$. Dividing by $3!=6$ removes the repeated orderings.' },
      { wrong: 'Five people in a row with two of them together: $2\\times5!$.', right: 'Glue the pair, so there are $4$ objects: $4!$ arrangements times $2$ orders inside the pair, which is $48$.' }
    ],
    examples: [
      {
        question: 'How many different arrangements are there of the letters of BANANA?',
        steps: ['There are $6$ letters, with $A$ three times and $N$ twice (and one $B$).', 'Divide $6!$ by the repeats: $\\tfrac{6!}{3!\\,2!}$.', '$\\tfrac{720}{6\\times2}=60$.'],
        answer: '$60$',
        verify: { kind: 'value', expr: '6!/(3!*2!)', answer: '60' }
      },
      {
        question: 'A committee of $5$ is chosen from $7$ men and $5$ women. It must have $3$ men and $2$ women. How many committees are possible?',
        steps: ['Choose the men: ${}^7C_3=35$.', 'Choose the women: ${}^5C_2=10$.', 'Each choice of men pairs with each choice of women, so multiply: $35\\times10=350$.'],
        answer: '$350$',
        verify: { kind: 'values', pairs: [['ncr(7,3)', '35'], ['ncr(5,2)', '10'], ['ncr(7,3)*ncr(5,2)', '350']] }
      },
      {
        question: 'Five people stand in a row. Alex and Bo must stand next to each other. How many arrangements are there?',
        steps: ['Treat Alex and Bo as one block. With the other three people there are $4$ objects, which arrange in $4!=24$ ways.', 'Inside the block Alex and Bo can swap: $2$ ways.', 'Multiply: $24\\times2=48$. As a check, $5!=120$ arrangements in total, and $120-48=72$ have them apart.'],
        answer: '$48$',
        verify: { kind: 'values', pairs: [['2*4!', '48'], ['5!-48', '72']] }
      }
    ]
  },

  'me1-11-05': {
    summary: 'The binomial theorem expands $(a+b)^n$ for any whole number $n$ without multiplying out. The coefficients are the combinations ${}^nC_k$, which also form Pascal\'s triangle, and the general term lets you pick out one coefficient directly.',
    prereqs: ['me1-11-04'],
    concepts: [
      { title: 'Where the coefficients come from', body: 'Expanding $(a+b)^n$ means choosing, from each of the $n$ brackets, either $a$ or $b$. The term $a^{n-k}b^k$ arises by choosing $b$ from $k$ of the brackets, which can be done in ${}^nC_k$ ways. So ${}^nC_k$ is the coefficient of $a^{n-k}b^k$.' },
      { title: 'The general term', body: 'The term in $b^k$ is $T_{k+1}={}^nC_k\\,a^{n-k}b^k$. To find a particular coefficient, write the power of $x$ in $T_{k+1}$ in terms of $k$, solve for $k$, and evaluate. Any constants inside $a$ or $b$ are raised to their powers too.' },
      { title: 'Pascal\'s triangle and uses', body: 'Each entry of Pascal\'s triangle is the sum of the two above it, because ${}^nC_k={}^{n-1}C_{k-1}+{}^{n-1}C_k$. Setting $a=b=1$ gives ${}^nC_0+{}^nC_1+\\cdots+{}^nC_n=2^n$. Putting a small number in for $b$ approximates powers such as $(1.02)^5$.' }
    ],
    definitions: [
      { term: 'Binomial coefficient', meaning: 'The number ${}^nC_k=\\binom{n}{k}=\\tfrac{n!}{k!(n-k)!}$, the coefficient of $a^{n-k}b^k$ in $(a+b)^n$.' },
      { term: 'Term independent of $x$', meaning: 'The term in which the power of $x$ is $0$, so that no $x$ remains.' }
    ],
    formulas: [
      { label: 'The binomial theorem', tex: '(a+b)^n=\\sum_{k=0}^{n}\\binom{n}{k}a^{n-k}b^{k}' },
      { label: 'The general term', tex: 'T_{k+1}=\\binom{n}{k}a^{n-k}b^{k}' },
      { label: 'Pascal\'s rule', tex: '\\binom{n}{k}=\\binom{n-1}{k-1}+\\binom{n-1}{k}' }
    ],
    points: [
      { front: 'How many terms are in $(a+b)^n$?', back: '$n+1$.' },
      { front: 'The row of Pascal\'s triangle for $n=5$', back: '$1,\\ 5,\\ 10,\\ 10,\\ 5,\\ 1$.' },
      { front: 'The sum of the coefficients of $(1+x)^n$', back: '$2^n$, found by setting $x=1$.' },
      { front: 'The coefficient of $x^3$ in $(1+x)^{10}$', back: '$\\binom{10}{3}=120$.' },
      { front: 'The coefficients of $(a-b)^n$ alternate in sign', back: 'Because $(-b)^k$ is negative for odd $k$.' }
    ],
    mistakes: [
      { wrong: 'The coefficient of $x^3$ in $(2x+1)^5$ is $\\binom{5}{3}=10$.', right: 'The $2$ is raised to the power too: $\\binom{5}{3}\\,2^3=10\\times8=80$.' },
      { wrong: 'Using $k$ as the exponent of $x$ in $\\left(x^2+\\tfrac1x\\right)^6$.', right: '$k$ counts the choices of the second term. The power of $x$ is $2(6-k)-k=12-3k$.' }
    ],
    examples: [
      {
        question: 'Find the coefficient of $x^3$ in the expansion of $(2x+1)^5$.',
        steps: ['The general term is $T_{k+1}=\\binom5k(2x)^{k}(1)^{5-k}$ with the power of $x$ equal to $k$.', 'For $x^3$ take $k=3$: $\\binom53\\,2^3=10\\times8$.', 'The coefficient is $80$.'],
        answer: '$80$',
        verify: { kind: 'value', expr: 'ncr(5,3)*2^3', answer: '80' }
      },
      {
        question: 'Find the term independent of $x$ in the expansion of $\\left(x^2+\\dfrac1x\\right)^6$.',
        steps: ['$T_{k+1}=\\binom6k(x^2)^{6-k}\\left(\\tfrac1x\\right)^k=\\binom6k x^{12-3k}$.', 'No $x$ remains when $12-3k=0$, so $k=4$.', 'The term is $\\binom64=15$.'],
        answer: '$15$',
        verify: { kind: 'values', pairs: [['ncr(6,4)', '15'], ['12-3*4', '0']] }
      },
      {
        question: 'Use the first three terms of $(1+0.02)^5$ to approximate $1.02^5$.',
        steps: ['$(1+x)^5=1+5x+10x^2+\\cdots$ with $x=0.02$.', '$1+5(0.02)+10(0.02)^2=1+0.1+0.004$.', 'The approximation is $1.104$. The next term is $10x^3=0.00008$, so the error is under $0.0001$.'],
        answer: '$1.104$',
        verify: { kind: 'values', pairs: [['1+5*0.02+10*0.02^2', '1.104'], ['10*0.02^3', '0.00008']] }
      }
    ]
  }
};
