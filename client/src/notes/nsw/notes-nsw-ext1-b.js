// Pri Learning · NSW Notes · Mathematics Extension 1, Year 12 (second half)
//
// Original revision writing for the NSW Mathematics Extension 1 Syllabus (2024)
// focus areas of Year 12. Written for Pri Learning; it is not an official NESA
// publication and quotes no syllabus text. Each topic is keyed by the lower-case
// outcome code of its focus area (a reference only). en-AU spelling.
// Every worked example's answer is re-derived by the deterministic engine in
// client/test/nsw-notes-bands-check.mjs; where the engine cannot differentiate or
// integrate, the verify block checks the exact values the working produces.
export default {
  'me1-12-01': {
    summary: 'Mathematical induction proves a statement for every whole number from a starting value onwards. You show it is true at the start, then show that if it holds for one number it must hold for the next, and the chain reaches every number.',
    prereqs: ['mav-12-03', 'me1-11-05'],
    concepts: [
      { title: 'The four-part structure', body: 'State the claim $P(n)$. Prove the basis case (usually $n=1$). Assume $P(k)$ is true for some whole number $k$ at or past the start. Prove that $P(k+1)$ follows, then write a conclusion that names the principle.' },
      { title: 'Using the assumption', body: 'In the inductive step you must use the assumption. For a sum, write $S_{k+1}=S_k+T_{k+1}$ and replace $S_k$ by the assumed formula. For divisibility, write the new expression so that an assumed multiple appears inside it.' },
      { title: 'Three common families', body: 'Series results such as $1+2+\\cdots+n=\\tfrac{n(n+1)}{2}$; divisibility results such as $6$ divides $7^n-1$; and inequalities such as $2^n>n^2$ for $n\\ge5$, where the starting value is not $1$.' }
    ],
    definitions: [
      { term: 'Principle of mathematical induction', meaning: 'If $P(n_0)$ is true, and $P(k)$ true implies $P(k+1)$ true for every $k\\ge n_0$, then $P(n)$ is true for all whole numbers $n\\ge n_0$.' },
      { term: 'Inductive hypothesis', meaning: 'The assumption that $P(k)$ is true for one particular but arbitrary $k$. It is assumed, never proved, and is the only thing the inductive step may rely on besides algebra.' }
    ],
    formulas: [
      { label: 'Sum of squares (a standard induction result)', tex: '1^2+2^2+\\cdots+n^2=\\frac{n(n+1)(2n+1)}{6}' },
      { label: 'Shape of a series step', tex: 'S_{k+1}=S_k+T_{k+1}' }
    ],
    points: [
      { front: 'Why is the basis case needed?', back: 'The inductive step only says “if true for $k$, then true for $k+1$”. Without a true starting case, nothing is ever actually established.' },
      { front: 'What does the inductive step prove?', back: 'An implication: $P(k)\\Rightarrow P(k+1)$. It does not prove $P(k)$ itself.' },
      { front: 'How is a divisibility step usually arranged?', back: 'Split the $k+1$ expression into a multiple of the assumed expression plus a term that is clearly divisible, for example $7^{k+1}-1=7(7^k-1)+6$.' },
      { front: 'What must a final conclusion say?', back: 'That $P(n)$ is true for all integers $n\\ge n_0$ by the principle of mathematical induction, since the basis case holds and the step has been proved.' },
      { front: 'Where does an inequality proof often start?', back: 'Not at $1$. Test small values: $2^n>n^2$ fails at $n=2,3,4$ and holds for every $n\\ge5$, so the basis case is $n=5$.' }
    ],
    mistakes: [
      { wrong: 'Writing “assume $P(k)$ is true for all $k$” and then proving $P(k+1)$.', right: 'Assume it for one arbitrary $k$ only. Assuming it for all $k$ is the very statement being proved.' },
      { wrong: 'Checking $n=1$, $2$, $3$ and concluding the result is proved.', right: 'Any number of checked cases is evidence, not proof. The inductive step is what carries the result to every $n$.' },
      { wrong: 'Starting the step with $P(k+1)$ and working both sides until they match, without using the hypothesis.', right: 'Start from the left side of $P(k+1)$, bring in the assumed result for $k$, and simplify to the right side of $P(k+1)$.' }
    ],
    examples: [
      {
        question: 'Prove by induction that $1+3+5+\\cdots+(2n-1)=n^2$ for all integers $n\\ge1$.',
        steps: [
          'Basis case $n=1$: the left side is $1$ and the right side is $1^2=1$, so it is true.',
          'Assume it is true for $n=k$: $1+3+\\cdots+(2k-1)=k^2$.',
          'For $n=k+1$ the left side is $[1+3+\\cdots+(2k-1)]+(2k+1)=k^2+2k+1$.',
          'This equals $(k+1)^2$, the right side of $P(k+1)$.',
          'So $P(k)$ implies $P(k+1)$. By the principle of mathematical induction the result holds for all $n\\ge1$.'
        ],
        answer: 'Proved: the sum of the first $n$ odd numbers is $n^2$.',
        verify: { kind: 'values', pairs: [['sum(2*k-1,k,1,7)', '49'], ['7^2+2*8-1', '8^2'], ['sum(2*k-1,k,1,1)', '1']] }
      },
      {
        question: 'Prove by induction that $7^n-1$ is divisible by $6$ for all integers $n\\ge1$.',
        steps: [
          'Basis case $n=1$: $7^1-1=6$, which is divisible by $6$.',
          'Assume $7^k-1=6m$ for some integer $m$, so $7^k=6m+1$.',
          'Then $7^{k+1}-1=7\\times7^k-1=7(6m+1)-1=42m+6=6(7m+1)$.',
          'Since $7m+1$ is an integer, $7^{k+1}-1$ is divisible by $6$. By induction the result holds for all $n\\ge1$.'
        ],
        answer: 'Proved: $6$ divides $7^n-1$ for every $n\\ge1$.',
        verify: { kind: 'values', pairs: [['7^5-1', '6*2801'], ['7*(7^4-1)+6', '7^5-1'], ['7^1-1', '6']] }
      },
      {
        question: 'Prove by induction that $2^n>n^2$ for all integers $n\\ge5$.',
        steps: [
          'Basis case $n=5$: $2^5=32$ and $5^2=25$, and $32>25$.',
          'Assume $2^k>k^2$ for some $k\\ge5$.',
          'Then $2^{k+1}=2\\times2^k>2k^2$.',
          'For $k\\ge5$, $k^2-2k-1=(k-1)^2-2>0$, so $2k^2>(k+1)^2$.',
          'Hence $2^{k+1}>(k+1)^2$. By induction the result holds for all $n\\ge5$.'
        ],
        answer: 'Proved for every integer $n\\ge5$.',
        verify: { kind: 'values', pairs: [['2^5-5^2', '7'], ['2*5^2-(5+1)^2', '14'], ['(5-1)^2-2', '14']] }
      }
    ]
  },

  'me1-12-02': {
    summary: 'A vector has both size and direction. In two and three dimensions you add vectors by components, measure the angle between them with the dot product, and describe motion, including projectiles, by writing position as a vector that changes with time.',
    prereqs: ['mav-11-04', 'me1-11-03'],
    concepts: [
      { title: 'Components and operations', body: 'Write $\\mathbf{a}=a_1\\mathbf{i}+a_2\\mathbf{j}+a_3\\mathbf{k}$. Add and subtract component by component, and multiply by a scalar in every component. Two vectors are parallel when one is a scalar multiple of the other. The vector from $A$ to $B$ is $\\overrightarrow{AB}=\\mathbf{b}-\\mathbf{a}$.' },
      { title: 'The dot product', body: '$\\mathbf{a}\\cdot\\mathbf{b}=a_1b_1+a_2b_2+a_3b_3=|\\mathbf{a}||\\mathbf{b}|\\cos\\theta$, where $\\theta$ is the angle between the vectors placed tail to tail. It gives the angle, tests for perpendicular vectors (dot product zero), and gives projections.' },
      { title: 'Motion in vector form', body: 'Position is $\\mathbf{r}(t)$, velocity is $\\mathbf{v}=\\dot{\\mathbf{r}}$ and acceleration is $\\ddot{\\mathbf{r}}$. A projectile launched at speed $V$ at angle $\\theta$ above the horizontal, with gravity $g$ acting down, has $\\mathbf{r}(t)=Vt\\cos\\theta\\,\\mathbf{i}+\\left(Vt\\sin\\theta-\\tfrac12gt^2\\right)\\mathbf{j}$.' }
    ],
    definitions: [
      { term: 'Magnitude and unit vector', meaning: 'The magnitude of $\\mathbf{a}$ is $|\\mathbf{a}|=\\sqrt{a_1^2+a_2^2+a_3^2}$. A unit vector has magnitude $1$; dividing $\\mathbf{a}$ by $|\\mathbf{a}|$ gives the unit vector in its direction.' },
      { term: 'Scalar projection', meaning: 'The signed length of the shadow of $\\mathbf{a}$ on the direction of $\\mathbf{b}$: $\\dfrac{\\mathbf{a}\\cdot\\mathbf{b}}{|\\mathbf{b}|}$.' },
      { term: 'Position vector', meaning: 'The vector from a fixed origin $O$ to a point, so the point $(x,y)$ has position vector $x\\mathbf{i}+y\\mathbf{j}$.' }
    ],
    formulas: [
      { label: 'Dot product and the angle', tex: '\\cos\\theta=\\frac{\\mathbf{a}\\cdot\\mathbf{b}}{|\\mathbf{a}||\\mathbf{b}|}' },
      { label: 'Perpendicular vectors', tex: '\\mathbf{a}\\perp\\mathbf{b}\\iff\\mathbf{a}\\cdot\\mathbf{b}=0' },
      { label: 'Projectile position', tex: 'x=Vt\\cos\\theta,\\qquad y=Vt\\sin\\theta-\\tfrac12gt^2' }
    ],
    points: [
      { front: 'The magnitude of $3\\mathbf{i}+4\\mathbf{j}$', back: '$\\sqrt{9+16}=5$.' },
      { front: 'What does $\\mathbf{a}\\cdot\\mathbf{b}=0$ tell you?', back: 'The vectors are perpendicular (or one of them is the zero vector).' },
      { front: 'Is $\\mathbf{a}\\cdot\\mathbf{b}$ a vector or a number?', back: 'A number. The product of two vectors by the dot is a scalar.' },
      { front: 'What gives the vector from $A$ to $B$?', back: '“Head minus tail”: $\\overrightarrow{AB}=\\mathbf{b}-\\mathbf{a}$.' },
      { front: 'What is the horizontal velocity of a projectile?', back: 'Constant, $V\\cos\\theta$, because nothing acts horizontally. Only the vertical component changes.' }
    ],
    mistakes: [
      { wrong: 'Finding the angle between $\\mathbf{a}$ and $\\mathbf{b}$ by using $\\cos\\theta=\\mathbf{a}\\cdot\\mathbf{b}$ without dividing by the magnitudes.', right: 'The dot product equals $|\\mathbf{a}||\\mathbf{b}|\\cos\\theta$, so divide by both magnitudes first.' },
      { wrong: 'Writing $\\overrightarrow{AB}=\\mathbf{a}-\\mathbf{b}$.', right: 'The vector from $A$ to $B$ is the end point minus the start point: $\\mathbf{b}-\\mathbf{a}$.' },
      { wrong: 'Taking the dot product by multiplying the vectors as if they were numbers, $(2\\mathbf{i}+\\mathbf{j})(\\mathbf{i}+3\\mathbf{j})=2\\mathbf{i}+3\\mathbf{j}$.', right: 'Multiply matching components and add: $2\\times1+1\\times3=5$.' }
    ],
    examples: [
      {
        question: 'Let $\\mathbf{a}=2\\mathbf{i}-\\mathbf{j}+2\\mathbf{k}$ and $\\mathbf{b}=\\mathbf{i}+2\\mathbf{j}-2\\mathbf{k}$. Find $\\cos\\theta$, where $\\theta$ is the angle between them.',
        steps: [
          'Magnitudes: $|\\mathbf{a}|=\\sqrt{4+1+4}=3$ and $|\\mathbf{b}|=\\sqrt{1+4+4}=3$.',
          'Dot product: $\\mathbf{a}\\cdot\\mathbf{b}=2(1)+(-1)(2)+2(-2)=-4$.',
          'So $\\cos\\theta=\\dfrac{-4}{3\\times3}=-\\dfrac49$, and $\\theta\\approx116.4^\\circ$ (obtuse, as the dot product is negative).'
        ],
        answer: '$\\cos\\theta=-\\tfrac49$, so $\\theta\\approx116.4^\\circ$',
        verify: { kind: 'values', pairs: [['sqrt(2^2+(-1)^2+2^2)', '3'], ['sqrt(1^2+2^2+(-2)^2)', '3'], ['2*1+(-1)*2+2*(-2)', '-4'], ['(-4)/(3*3)', '-4/9']] }
      },
      {
        question: 'For what value of $k$ are $\\mathbf{a}=k\\mathbf{i}+3\\mathbf{j}$ and $\\mathbf{b}=6\\mathbf{i}-4\\mathbf{j}$ perpendicular?',
        steps: [
          'Perpendicular vectors have dot product zero.',
          '$\\mathbf{a}\\cdot\\mathbf{b}=6k+3(-4)=6k-12$.',
          'Set $6k-12=0$, so $k=2$.'
        ],
        answer: '$k=2$',
        verify: { kind: 'roots', f: '6*x-12', answers: ['2'] }
      },
      {
        question: 'A ball is launched from level ground at $20\\ \\text{m/s}$ at $30^\\circ$ above the horizontal. Take $g=10\\ \\text{m/s}^2$. Find the time of flight, the range and the maximum height.',
        steps: [
          'Position: $x=20\\cos30^\\circ\\,t=10\\sqrt3\\,t$ and $y=20\\sin30^\\circ\\,t-5t^2=10t-5t^2$.',
          'It lands when $y=0$: $5t(2-t)=0$, so $t=2$ s.',
          'Range: $x=10\\sqrt3\\times2=20\\sqrt3\\approx34.6$ m.',
          'The vertical velocity $10-10t$ is zero at $t=1$, so the maximum height is $10(1)-5(1)^2=5$ m.'
        ],
        answer: 'Time of flight $2$ s, range $20\\sqrt3\\approx34.6$ m, maximum height $5$ m',
        verify: { kind: 'values', pairs: [['20*cos(pi/6)*2', '20*sqrt(3)'], ['10*2-5*2^2', '0'], ['10*1-5*1^2', '5']] }
      }
    ]
  },

  'me1-12-03': {
    summary: 'The inverse trigonometric functions undo sine, cosine and tangent. Because the trigonometric functions repeat, each is restricted to one stretch where it is one-to-one, and the inverse returns a single angle from that stretch.',
    prereqs: ['me1-11-03', 'mav-11-04', 'mav-11-05'],
    concepts: [
      { title: 'Restricting to get an inverse', body: 'Sine is not one-to-one on all of $\\mathbb{R}$, so it is restricted to $\\left[-\\tfrac\\pi2,\\tfrac\\pi2\\right]$. Cosine is restricted to $[0,\\pi]$ and tangent to $\\left(-\\tfrac\\pi2,\\tfrac\\pi2\\right)$. The inverse of each restricted function is $\\sin^{-1}$, $\\cos^{-1}$, $\\tan^{-1}$.' },
      { title: 'Domain and range swap', body: 'The domain of the inverse is the range of the original, and its range is the restricted domain. So $y=\\sin^{-1}x$ has domain $[-1,1]$ and range $\\left[-\\tfrac\\pi2,\\tfrac\\pi2\\right]$, and its graph is the reflection of the restricted sine in $y=x$.' },
      { title: 'Compositions behave in two different ways', body: '$\\sin(\\sin^{-1}x)=x$ for every $x$ in $[-1,1]$. But $\\sin^{-1}(\\sin x)=x$ only when $x$ is in $\\left[-\\tfrac\\pi2,\\tfrac\\pi2\\right]$; outside that stretch the answer is the angle in the range with the same sine.' }
    ],
    definitions: [
      { term: 'Inverse sine', meaning: '$y=\\sin^{-1}x$ means $\\sin y=x$ with $-\\tfrac\\pi2\\le y\\le\\tfrac\\pi2$. It is also written $\\arcsin x$.' },
      { term: 'Inverse cosine and inverse tangent', meaning: '$y=\\cos^{-1}x$ means $\\cos y=x$ with $0\\le y\\le\\pi$. $y=\\tan^{-1}x$ means $\\tan y=x$ with $-\\tfrac\\pi2<y<\\tfrac\\pi2$, defined for every real $x$.' }
    ],
    formulas: [
      { label: 'Domains and ranges', tex: '\\sin^{-1}:[-1,1]\\to\\left[-\\tfrac\\pi2,\\tfrac\\pi2\\right],\\quad\\cos^{-1}:[-1,1]\\to[0,\\pi],\\quad\\tan^{-1}:\\mathbb{R}\\to\\left(-\\tfrac\\pi2,\\tfrac\\pi2\\right)' },
      { label: 'Complementary and odd identities', tex: '\\sin^{-1}x+\\cos^{-1}x=\\frac\\pi2,\\qquad\\sin^{-1}(-x)=-\\sin^{-1}x,\\qquad\\tan^{-1}(-x)=-\\tan^{-1}x' }
    ],
    points: [
      { front: 'The value of $\\cos^{-1}(-1)$', back: '$\\pi$. The range of inverse cosine is $[0,\\pi]$.' },
      { front: 'Is $\\sin^{-1}x$ the same as $\\dfrac1{\\sin x}$?', back: 'No. The $-1$ marks the inverse function, not a reciprocal. The reciprocal is $\\operatorname{cosec}x$.' },
      { front: 'Which inverse has horizontal asymptotes?', back: '$\\tan^{-1}x$, with $y\\to\\pm\\tfrac\\pi2$ as $x\\to\\pm\\infty$.' },
      { front: 'What is $\\cos(\\sin^{-1}x)$ for $|x|\\le1$?', back: '$\\sqrt{1-x^2}$, found from a right triangle with opposite side $x$ and hypotenuse $1$. It is never negative, because the angle is in the first or fourth quadrant.' },
      { front: 'Why is $\\sin^{-1}(\\sin\\pi)$ not $\\pi$?', back: '$\\pi$ is outside the range of $\\sin^{-1}$. $\\sin\\pi=0$, and $\\sin^{-1}0=0$.' }
    ],
    mistakes: [
      { wrong: '$\\sin^{-1}(\\sin\\tfrac{4\\pi}3)=\\tfrac{4\\pi}3$.', right: 'The answer must lie in $\\left[-\\tfrac\\pi2,\\tfrac\\pi2\\right]$. $\\sin\\tfrac{4\\pi}3=-\\tfrac{\\sqrt3}2$, so the result is $-\\tfrac\\pi3$.' },
      { wrong: '$\\cos^{-1}\\left(-\\tfrac12\\right)=-\\tfrac\\pi3$.', right: 'Inverse cosine is never negative. $\\cos^{-1}\\left(-\\tfrac12\\right)=\\tfrac{2\\pi}3$.' },
      { wrong: 'Writing a value such as $\\sin^{-1}2$ as an answer.', right: 'Two is outside the domain $[-1,1]$, so $\\sin^{-1}2$ does not exist.' }
    ],
    examples: [
      {
        question: 'Find the exact value of $\\cos^{-1}\\left(-\\dfrac{\\sqrt3}2\\right)$.',
        steps: [
          'The answer is the angle $y$ in $[0,\\pi]$ with $\\cos y=-\\tfrac{\\sqrt3}2$.',
          'The related acute angle is $\\tfrac\\pi6$ and cosine is negative in the second quadrant, so $y=\\pi-\\tfrac\\pi6=\\tfrac{5\\pi}6$.'
        ],
        answer: '$\\dfrac{5\\pi}6$',
        verify: { kind: 'value', expr: 'acos(-sqrt(3)/2)', answer: '5*pi/6' }
      },
      {
        question: 'Evaluate $\\sin^{-1}\\left(\\sin\\dfrac{4\\pi}3\\right)$.',
        steps: [
          'First, $\\sin\\tfrac{4\\pi}3=-\\sin\\tfrac\\pi3=-\\tfrac{\\sqrt3}2$.',
          'Now find the angle in $\\left[-\\tfrac\\pi2,\\tfrac\\pi2\\right]$ with that sine: $\\sin^{-1}\\left(-\\tfrac{\\sqrt3}2\\right)=-\\tfrac\\pi3$.'
        ],
        answer: '$-\\dfrac\\pi3$',
        verify: { kind: 'value', expr: 'asin(sin(4*pi/3))', answer: '-pi/3' }
      },
      {
        question: 'Find the exact value of $\\sin\\left(\\sin^{-1}\\tfrac35+\\cos^{-1}\\tfrac5{13}\\right)$.',
        steps: [
          'Let $\\alpha=\\sin^{-1}\\tfrac35$, so $\\sin\\alpha=\\tfrac35$ and $\\cos\\alpha=\\tfrac45$. Let $\\beta=\\cos^{-1}\\tfrac5{13}$, so $\\cos\\beta=\\tfrac5{13}$ and $\\sin\\beta=\\tfrac{12}{13}$.',
          'Both angles are acute, so every ratio is positive.',
          '$\\sin(\\alpha+\\beta)=\\sin\\alpha\\cos\\beta+\\cos\\alpha\\sin\\beta=\\tfrac35\\cdot\\tfrac5{13}+\\tfrac45\\cdot\\tfrac{12}{13}=\\tfrac{15+48}{65}=\\tfrac{63}{65}$.'
        ],
        answer: '$\\dfrac{63}{65}$',
        verify: { kind: 'value', expr: 'sin(asin(3/5)+acos(5/13))', answer: '63/65' }
      }
    ]
  },

  'me1-12-04': {
    summary: 'The inverse trigonometric functions have neat derivatives, and those derivatives run backwards to give integrals of $\\tfrac1{\\sqrt{a^2-x^2}}$ and $\\tfrac1{a^2+x^2}$. Substitution and trigonometric identities extend the integrals you can evaluate exactly.',
    prereqs: ['me1-12-03', 'mav-12-04', 'mav-12-05'],
    concepts: [
      { title: 'Differentiating inverse trigonometric functions', body: 'The three results below, with the chain rule, handle expressions such as $\\tan^{-1}(3x)$ or $\\sin^{-1}(x^2)$. The derivative of $\\sin^{-1}x$ is undefined at $x=\\pm1$, where the graph has a vertical tangent.' },
      { title: 'Integrals that return inverse trigonometric functions', body: 'Reading the derivatives backwards: $\\int\\tfrac{dx}{\\sqrt{a^2-x^2}}=\\sin^{-1}\\tfrac xa+C$ and $\\int\\tfrac{dx}{a^2+x^2}=\\tfrac1a\\tan^{-1}\\tfrac xa+C$. Recognise the form first, then match $a$.' },
      { title: 'Substitution and identities', body: 'In a substitution $u=g(x)$, change $dx$ and the limits together, then integrate in $u$. Even powers of sine and cosine use $\\sin^2x=\\tfrac{1-\\cos2x}2$ and $\\cos^2x=\\tfrac{1+\\cos2x}2$.' }
    ],
    definitions: [
      { term: 'Integration by substitution', meaning: 'Replacing an expression $u=g(x)$ so that $g\'(x)\\,dx$ becomes $du$, turning $\\int f(g(x))g\'(x)\\,dx$ into $\\int f(u)\\,du$.' },
      { term: 'Definite integral with a change of limits', meaning: 'When a substitution is used on $\\int_a^b$, the limits become $u(a)$ and $u(b)$, and the answer is found in $u$ without returning to $x$.' }
    ],
    formulas: [
      { label: 'Derivatives', tex: '\\frac{d}{dx}\\sin^{-1}x=\\frac1{\\sqrt{1-x^2}},\\quad\\frac{d}{dx}\\cos^{-1}x=-\\frac1{\\sqrt{1-x^2}},\\quad\\frac{d}{dx}\\tan^{-1}x=\\frac1{1+x^2}' },
      { label: 'Integrals (for $a>0$)', tex: '\\int\\frac{dx}{\\sqrt{a^2-x^2}}=\\sin^{-1}\\frac xa+C,\\qquad\\int\\frac{dx}{a^2+x^2}=\\frac1a\\tan^{-1}\\frac xa+C' },
      { label: 'Double-angle forms for squares', tex: '\\sin^2x=\\frac{1-\\cos2x}2,\\qquad\\cos^2x=\\frac{1+\\cos2x}2' }
    ],
    points: [
      { front: 'The derivative of $\\tan^{-1}(3x)$', back: '$\\dfrac3{1+9x^2}$, by the chain rule.' },
      { front: 'What does $\\int\\dfrac{dx}{x^2+16}$ equal?', back: '$\\tfrac14\\tan^{-1}\\tfrac x4+C$, with $a=4$.' },
      { front: 'How do $\\sin^{-1}x$ and $\\cos^{-1}x$ derivatives differ?', back: 'Only in sign, because $\\sin^{-1}x+\\cos^{-1}x$ is the constant $\\tfrac\\pi2$.' },
      { front: 'After a substitution in a definite integral, what must change?', back: 'The limits. Convert them to $u$-values, or return to $x$ before substituting the original limits, but not both.' },
      { front: 'What is $\\int\\sin^2x\\,dx$?', back: '$\\tfrac x2-\\tfrac{\\sin2x}4+C$, from $\\sin^2x=\\tfrac{1-\\cos2x}2$.' }
    ],
    mistakes: [
      { wrong: '$\\int\\dfrac{dx}{9+x^2}=\\tan^{-1}\\dfrac x3+C$.', right: 'The $\\tfrac1a$ is needed: $\\int\\tfrac{dx}{9+x^2}=\\tfrac13\\tan^{-1}\\tfrac x3+C$.' },
      { wrong: 'Substituting $u=x^2+1$ in $\\int_0^1x(x^2+1)^3dx$ but keeping the limits $0$ and $1$.', right: 'The limits must become $u(0)=1$ and $u(1)=2$, so the integral is $\\tfrac12\\int_1^2u^3du$.' },
      { wrong: 'Differentiating $\\sin^{-1}(2x)$ as $\\dfrac1{\\sqrt{1-4x^2}}$.', right: 'The chain rule adds a factor of $2$: the derivative is $\\dfrac2{\\sqrt{1-4x^2}}$.' }
    ],
    examples: [
      {
        question: 'Differentiate $y=\\tan^{-1}(3x)$ and find the gradient at $x=\\tfrac13$.',
        steps: [
          'Use $\\dfrac{d}{dx}\\tan^{-1}u=\\dfrac1{1+u^2}\\cdot\\dfrac{du}{dx}$ with $u=3x$.',
          '$\\dfrac{dy}{dx}=\\dfrac3{1+9x^2}$.',
          'At $x=\\tfrac13$: $\\dfrac3{1+1}=\\dfrac32$.'
        ],
        answer: '$\\dfrac{dy}{dx}=\\dfrac3{1+9x^2}$, and the gradient at $x=\\tfrac13$ is $\\tfrac32$',
        verify: { kind: 'values', pairs: [['3/(1+9*(1/3)^2)', '3/2'], ['(atan(3*(1/3+0.000001))-atan(3*(1/3-0.000001)))/0.000002', '3/2']] }
      },
      {
        question: 'Evaluate $\\displaystyle\\int_0^3\\frac{dx}{9+x^2}$.',
        steps: [
          'This is the form $\\int\\tfrac{dx}{a^2+x^2}$ with $a=3$.',
          'An antiderivative is $\\tfrac13\\tan^{-1}\\tfrac x3$.',
          'Evaluate: $\\tfrac13\\tan^{-1}(1)-\\tfrac13\\tan^{-1}(0)=\\tfrac13\\cdot\\tfrac\\pi4=\\tfrac\\pi{12}$.'
        ],
        answer: '$\\dfrac\\pi{12}$',
        verify: { kind: 'value', expr: '(1/3)*atan(3/3)-(1/3)*atan(0)', answer: 'pi/12' }
      },
      {
        question: 'Use the substitution $u=x^2+1$ to evaluate $\\displaystyle\\int_0^1x(x^2+1)^3\\,dx$.',
        steps: [
          '$u=x^2+1$ gives $du=2x\\,dx$, so $x\\,dx=\\tfrac12du$.',
          'The limits: $x=0$ gives $u=1$ and $x=1$ gives $u=2$.',
          'The integral becomes $\\tfrac12\\int_1^2u^3du=\\tfrac12\\left[\\tfrac{u^4}4\\right]_1^2=\\tfrac12\\cdot\\tfrac{16-1}4=\\tfrac{15}8$.'
        ],
        answer: '$\\dfrac{15}8$',
        verify: { kind: 'value', expr: '(1/2)*(2^4-1^4)/4', answer: '15/8' }
      }
    ]
  },

  'me1-12-05': {
    summary: 'Calculus describes how polynomials touch an axis, how a quantity such as temperature or population changes at a rate tied to its own size, how to measure the area between two curves, and the volume of a solid formed by spinning a region around an axis.',
    prereqs: ['me1-11-02', 'mav-12-06', 'me1-12-04'],
    concepts: [
      { title: 'Multiplicity of a zero', body: 'If $(x-a)^m$ is the highest power of $(x-a)$ dividing $P(x)$, then $a$ is a zero of multiplicity $m$. At a double zero the graph touches the axis and turns, since $P(a)=P\'(a)=0$. At a triple zero it flattens and crosses.' },
      { title: 'Areas and volumes by integration', body: 'The area between $y=f(x)$ above $y=g(x)$ from $a$ to $b$ is $\\int_a^b[f(x)-g(x)]\\,dx$. Rotating the region under $y=f(x)$ about the $x$-axis gives a solid of volume $\\pi\\int_a^b y^2\\,dx$, adding up thin discs.' },
      { title: 'Rates of change and differential equations', body: 'When a rate is proportional to a size or to a gap, $\\dfrac{dN}{dt}=k(N-P)$, the solution is $N=P+Ae^{kt}$. Newton’s law of cooling is the case where $P$ is the surrounding temperature, and $k<0$ for decay.' }
    ],
    definitions: [
      { term: 'Zero of multiplicity $m$', meaning: 'A value $a$ for which $(x-a)^m$ is a factor of $P(x)$ but $(x-a)^{m+1}$ is not.' },
      { term: 'Solid of revolution', meaning: 'The solid swept out when a plane region is rotated through a full turn about an axis.' },
      { term: 'Differential equation', meaning: 'An equation that relates a function to its derivatives, such as $\\dfrac{dN}{dt}=kN$. A solution is a function that satisfies it for all values in its domain.' }
    ],
    formulas: [
      { label: 'Area between two curves', tex: 'A=\\int_a^b\\left[f(x)-g(x)\\right]dx\\quad(f\\ge g)' },
      { label: 'Volume about the $x$-axis', tex: 'V=\\pi\\int_a^b y^2\\,dx' },
      { label: 'Growth or decay towards a limit', tex: '\\frac{dN}{dt}=k(N-P)\\ \\Rightarrow\\ N=P+Ae^{kt}' }
    ],
    points: [
      { front: 'What does a double zero look like on a graph?', back: 'The curve touches the axis at that point and turns back, without crossing.' },
      { front: 'How can you detect a double zero of $P$ at $x=a$ without factorising?', back: 'Check that $P(a)=0$ and $P\'(a)=0$ together.' },
      { front: 'Before integrating for area between two curves, what must be done?', back: 'Solve $f(x)=g(x)$ to find the limits, and decide which curve is on top over the interval.' },
      { front: 'Why is there a $\\pi$ in the volume formula?', back: 'Each thin slice is a disc of radius $y$ and area $\\pi y^2$, so the volume is $\\pi\\int y^2\\,dx$.' },
      { front: 'What must you do to a differential equation solution after finding the general form?', back: 'Use the given conditions to find the constants, such as $A$ and $k$, then answer in the context of the question.' }
    ],
    mistakes: [
      { wrong: 'Using $V=\\pi\\int_a^b y\\,dx$, and forgetting to square.', right: 'The radius of each disc is $y$, so it is the area $\\pi y^2$ that is integrated.' },
      { wrong: 'Computing area between curves as $\\int_a^b f(x)\\,dx-\\int_a^b g(x)\\,dx$ over limits where the curves cross.', right: 'Find the intersections first. Between crossing points, integrate (top minus bottom) so each piece is positive.' },
      { wrong: 'Solving $\\dfrac{dT}{dt}=-k(T-20)$ and writing $T=Ae^{-kt}$.', right: 'The constant $20$ is part of the solution: $T=20+Ae^{-kt}$. Check by differentiating.' }
    ],
    examples: [
      {
        question: 'Show that $x=2$ is a double zero of $P(x)=x^3-3x^2+4$ and factorise $P(x)$.',
        steps: [
          '$P(2)=8-12+4=0$, so $2$ is a zero.',
          '$P\'(x)=3x^2-6x$, and $P\'(2)=12-12=0$, so $2$ is a zero of multiplicity at least $2$.',
          'Divide: $P(x)=(x-2)^2(x+1)$. The zero $x=2$ has multiplicity $2$ and $x=-1$ is a simple zero.'
        ],
        answer: '$P(x)=(x-2)^2(x+1)$, with a double zero at $x=2$',
        verify: { kind: 'equivalent', a: 'x^3-3*x^2+4', b: '(x-2)^2*(x+1)' }
      },
      {
        question: 'The region under $y=\\sqrt x$ from $x=0$ to $x=4$ is rotated about the $x$-axis. Find the volume of the solid.',
        steps: [
          '$V=\\pi\\int_0^4y^2\\,dx=\\pi\\int_0^4x\\,dx$.',
          '$=\\pi\\left[\\tfrac{x^2}2\\right]_0^4=\\pi\\times8$.'
        ],
        answer: '$8\\pi$ cubic units',
        verify: { kind: 'value', expr: 'pi*4^2/2', answer: '8*pi' }
      },
      {
        question: 'A cup of tea at $90^\\circ\\text{C}$ cools in a room at $20^\\circ\\text{C}$ so that $\\dfrac{dT}{dt}=-k(T-20)$. After $5$ minutes it is $55^\\circ\\text{C}$. Find its temperature after $10$ minutes.',
        steps: [
          'The solution is $T=20+Ae^{-kt}$. At $t=0$, $90=20+A$, so $A=70$.',
          'At $t=5$: $55=20+70e^{-5k}$, so $e^{-5k}=\\tfrac12$ and $k=\\tfrac{\\ln2}5$.',
          'At $t=10$: $e^{-10k}=\\left(\\tfrac12\\right)^2=\\tfrac14$, so $T=20+70\\times\\tfrac14=37.5$.'
        ],
        answer: '$37.5^\\circ\\text{C}$',
        verify: { kind: 'value', expr: '20+70*exp(-(ln(2)/5)*10)', answer: '37.5' }
      }
    ]
  },

  'me1-12-06': {
    summary: 'A Bernoulli trial has two outcomes, and repeating independent trials gives the binomial distribution. The mean of a random sample varies from sample to sample in a predictable way: it centres on the population mean and becomes more tightly clustered as the sample grows.',
    prereqs: ['mav-12-07', 'me1-11-05', 'me1-11-04'],
    concepts: [
      { title: 'Bernoulli and binomial', body: 'A Bernoulli trial succeeds with probability $p$ (and fails with $q=1-p$). In $n$ independent trials, the number of successes $X$ is binomial: $P(X=r)=\\binom nr p^rq^{n-r}$, with mean $np$ and variance $npq$.' },
      { title: 'Solving binomial problems', body: '“At least one” is best found as $1-P(X=0)$. Check the trials are independent with a constant $p$ before using the model; sampling without replacement from a small population breaks this.' },
      { title: 'The distribution of the sample mean', body: 'For samples of size $n$ from a population with mean $\\mu$ and standard deviation $\\sigma$, the sample mean $\\bar X$ has mean $\\mu$ and standard deviation $\\dfrac\\sigma{\\sqrt n}$. For large $n$, the central limit theorem says $\\bar X$ is approximately normal, whatever the population shape.' }
    ],
    definitions: [
      { term: 'Bernoulli random variable', meaning: 'A variable that takes the value $1$ (success) with probability $p$ and $0$ (failure) with probability $1-p$. Its mean is $p$ and its variance is $p(1-p)$.' },
      { term: 'Binomial random variable', meaning: 'The count of successes in $n$ independent Bernoulli trials with the same $p$, written $X\\sim\\text{Bin}(n,p)$.' },
      { term: 'Sampling distribution of the mean', meaning: 'The distribution of $\\bar X$ over all possible samples of a fixed size $n$ from the population.' }
    ],
    formulas: [
      { label: 'Binomial probability', tex: 'P(X=r)=\\binom nr p^r(1-p)^{n-r}' },
      { label: 'Mean and variance of a binomial', tex: 'E(X)=np,\\qquad\\operatorname{Var}(X)=np(1-p)' },
      { label: 'Sample mean', tex: 'E(\\bar X)=\\mu,\\qquad\\operatorname{sd}(\\bar X)=\\frac\\sigma{\\sqrt n}' }
    ],
    points: [
      { front: 'The conditions for a binomial model', back: 'A fixed number $n$ of trials, two outcomes, independent trials, and the same $p$ every time.' },
      { front: 'How is the probability of “at least one success” found?', back: '$1-P(X=0)=1-(1-p)^n$.' },
      { front: 'The mean of $\\text{Bin}(20,0.3)$', back: '$np=6$.' },
      { front: 'What happens to $\\text{sd}(\\bar X)$ when $n$ is quadrupled?', back: 'It halves, because of the $\\sqrt n$ in the denominator.' },
      { front: 'What does the central limit theorem not claim?', back: 'That the individual population values are normal. It is the distribution of the sample mean that approaches normal as $n$ grows.' }
    ],
    mistakes: [
      { wrong: 'Computing $P(X=2)$ for $\\text{Bin}(5,0.4)$ as $0.4^2\\times0.6^3$.', right: 'The $\\binom52=10$ ways to arrange the two successes are missed: $10\\times0.4^2\\times0.6^3=0.3456$.' },
      { wrong: 'Using $\\sigma$ instead of $\\dfrac\\sigma{\\sqrt n}$ when finding a probability about a sample mean.', right: 'A sample mean has smaller spread than a single value. Standardise with $z=\\dfrac{\\bar x-\\mu}{\\sigma/\\sqrt n}$.' },
      { wrong: 'Treating $\\operatorname{Var}(X)=np$ for a binomial.', right: 'The variance is $np(1-p)$; the standard deviation is its square root.' }
    ],
    examples: [
      {
        question: 'Let $X\\sim\\text{Bin}(5,0.4)$. Find $P(X=2)$.',
        steps: [
          'Here $n=5$, $p=0.4$, $q=0.6$ and $r=2$.',
          '$P(X=2)=\\binom52(0.4)^2(0.6)^3=10\\times0.16\\times0.216=0.3456$.'
        ],
        answer: '$0.3456$',
        verify: { kind: 'value', expr: 'nCr(5,2)*0.4^2*0.6^3', answer: '0.3456' }
      },
      {
        question: 'A fair die is rolled $4$ times. Find the probability of at least one six.',
        steps: [
          'Let $X$ be the number of sixes, so $X\\sim\\text{Bin}\\left(4,\\tfrac16\\right)$.',
          '$P(X\\ge1)=1-P(X=0)=1-\\left(\\tfrac56\\right)^4=1-\\tfrac{625}{1296}=\\tfrac{671}{1296}\\approx0.518$.'
        ],
        answer: '$\\dfrac{671}{1296}\\approx0.518$',
        verify: { kind: 'value', expr: '1-(5/6)^4', answer: '671/1296' }
      },
      {
        question: 'A population has mean $50$ and standard deviation $12$. A random sample of $36$ is taken. Find the standard deviation of the sample mean and the approximate probability that $\\bar X>53$.',
        steps: [
          'The standard deviation of $\\bar X$ is $\\dfrac{12}{\\sqrt{36}}=2$.',
          'For $n=36$ the central limit theorem gives $\\bar X$ approximately normal with mean $50$ and standard deviation $2$.',
          '$z=\\dfrac{53-50}2=1.5$, and $P(Z>1.5)\\approx0.0668$.'
        ],
        answer: 'Standard deviation $2$; $P(\\bar X>53)\\approx0.0668$',
        verify: { kind: 'values', pairs: [['12/sqrt(36)', '2'], ['(53-50)/(12/sqrt(36))', '1.5']] }
      }
    ]
  }
};
