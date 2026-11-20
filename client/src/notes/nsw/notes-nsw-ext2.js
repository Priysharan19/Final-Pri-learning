// Pri Learning · NSW Notes · Year 12 · Mathematics Extension 2
//
// Original revision writing for the five focus areas of the NSW Mathematics
// Extension 2 Syllabus (2024): the nature of proof, further work with vectors,
// an introduction to complex numbers, further integration, and applications of
// calculus to mechanics. Written for Pri Learning; it is not an official NESA
// publication and quotes no syllabus text. Keyed by the lower-case outcome code
// of the focus area (a reference only). en-AU spelling. Every worked example's
// answer is re-derived by the deterministic engine in
// client/test/nsw-notes-bands-check.mjs.
export default {
  'me2-12-01': {
    summary: 'The nature of proof is the language and method of mathematical argument: statements and their negations, the converse and contrapositive, proof by contradiction, mathematical induction, and the standard inequalities. A proof is a chain of reasons with no gap.',
    prereqs: ['me1-12-01'],
    concepts: [
      { title: 'Statements, converse and contrapositive', body: 'The statement "if $P$ then $Q$" is equivalent to its contrapositive "if not $Q$ then not $P$". It is not equivalent to its converse "if $Q$ then $P$". To disprove a universal claim, one counterexample is enough.' },
      { title: 'Proof by contradiction', body: 'Assume the opposite of what you want to prove and reason until you reach something impossible, such as an integer that is both odd and even. Then the assumption was false. The classic case is the irrationality of $\\sqrt2$.' },
      { title: 'Induction and inequalities', body: 'Induction proves a statement for every integer $n\\ge n_0$: prove the base case, assume the statement for $n=k$, and show it holds for $n=k+1$. Inequalities are proved by showing a difference is non-negative, often from $(a-b)^2\\ge0$.' }
    ],
    definitions: [
      { term: 'Contrapositive', meaning: 'The statement "if not $Q$ then not $P$" formed from "if $P$ then $Q$". It is true exactly when the original is true.' },
      { term: 'Principle of mathematical induction', meaning: 'If a statement is true for $n=n_0$, and its truth for $n=k$ forces its truth for $n=k+1$ for every $k\\ge n_0$, then it is true for every integer $n\\ge n_0$.' }
    ],
    formulas: [
      { label: 'Square of a difference is non-negative', tex: 'a^2+b^2\\ge2ab\\quad\\text{since}\\quad(a-b)^2\\ge0' },
      { label: 'Arithmetic mean and geometric mean', tex: '\\frac{a+b}{2}\\ge\\sqrt{ab},\\qquad a,b\\ge0' },
      { label: 'Triangle inequality', tex: '|a+b|\\le|a|+|b|' }
    ],
    points: [
      { front: 'The negation of "all $x$ satisfy $P$"', back: '"Some $x$ does not satisfy $P$."' },
      { front: 'Is "if $n^2$ is even then $n$ is even" equivalent to "if $n$ is even then $n^2$ is even"?', back: 'No. The second is the converse. Both happen to be true here, but each needs its own proof.' },
      { front: 'What are the two parts of an induction proof?', back: 'The base case, and the inductive step from $n=k$ to $n=k+1$.' },
      { front: 'When does equality hold in the AM–GM inequality for two numbers?', back: 'Exactly when $a=b$.' },
      { front: 'What must the inductive step use?', back: 'The assumption for $n=k$. A step that never uses it has proved nothing by induction.' }
    ],
    mistakes: [
      { wrong: 'The formula works for $n=1,2,3$ and $4$, so it is proved.', right: 'Checking cases is evidence, not proof. The inductive step must be proved for a general $k$.' },
      { wrong: 'In the inductive step, assume the statement for $n=k+1$ and show it is true.', right: 'Assume it for $n=k$, and prove it for $n=k+1$. Assuming the target is circular.' },
      { wrong: 'To prove "if $P$ then $Q$", prove "if $Q$ then $P$".', right: 'That is the converse, a different statement. Prove "if $P$ then $Q$" directly, by contrapositive, or by contradiction.' }
    ],
    examples: [
      {
        question: 'Prove by induction that $1+3+5+\\cdots+(2n-1)=n^2$ for every integer $n\\ge1$.',
        steps: ['Base case $n=1$: the left side is $1$ and the right side is $1^2=1$.', 'Assume the statement for $n=k$: $1+3+\\cdots+(2k-1)=k^2$.', 'For $n=k+1$ add the next term $2k+1$ to both sides: $k^2+(2k+1)=(k+1)^2$, which is the statement for $n=k+1$.', 'By induction the statement is true for every integer $n\\ge1$.'],
        answer: 'The sum of the first $n$ odd numbers is $n^2$.',
        verify: { kind: 'values', pairs: [['7^2+(2*7+1)', '8^2'], ['sum(2*k-1,k,1,5)', '5^2'], ['sum(2*k-1,k,1,10)', '10^2']] }
      },
      {
        question: 'Prove that if $n^2$ is even, then the integer $n$ is even.',
        steps: ['Prove the contrapositive: if $n$ is odd, then $n^2$ is odd.', 'Let $n=2m+1$ for an integer $m$. Then $n^2=4m^2+4m+1=2(2m^2+2m)+1$.', 'This is odd, so the contrapositive is true, and so is the original statement.'],
        answer: 'If $n^2$ is even then $n$ is even.',
        verify: { kind: 'values', pairs: [['(2*3+1)^2', '4*3^2+4*3+1'], ['2*(2*3^2+2*3)+1', '49'], ['(2*3+1)^2', '49']] }
      },
      {
        question: 'Prove that $x+\\dfrac{1}{x}\\ge2$ for every real $x>0$.',
        steps: ['Form the difference: $x+\\dfrac1x-2=\\dfrac{x^2-2x+1}{x}$.', 'The numerator is $(x-1)^2$, so the difference is $\\dfrac{(x-1)^2}{x}$.', 'A square is non-negative and $x>0$, so the difference is non-negative. Equality holds only when $x=1$.'],
        answer: '$x+\\dfrac1x\\ge2$, with equality at $x=1$.',
        verify: { kind: 'values', pairs: [['4+1/4-2', '(4-1)^2/4'], ['(4-1)^2/4', '9/4'], ['1+1/1-2', '0']] }
      }
    ]
  },

  'me2-12-02': {
    summary: 'Further work with vectors extends the plane to three dimensions: components, the scalar product, angles and projections, the vector equation of a line, and the sphere. The same componentwise rules apply, and the new idea is that lines in space need not meet.',
    prereqs: ['me1-12-02'],
    concepts: [
      { title: 'Vectors in three dimensions', body: 'A vector is written $\\mathbf a=a_1\\mathbf i+a_2\\mathbf j+a_3\\mathbf k$. Add and scale componentwise, and the magnitude is $|\\mathbf a|=\\sqrt{a_1^2+a_2^2+a_3^2}$. The scalar product is $\\mathbf a\\cdot\\mathbf b=a_1b_1+a_2b_2+a_3b_3=|\\mathbf a||\\mathbf b|\\cos\\theta$, so it gives angles, and it is zero exactly when the vectors are perpendicular.' },
      { title: 'Lines in space', body: 'A line through the point with position vector $\\mathbf a$ in direction $\\mathbf b$ is $\\mathbf r=\\mathbf a+\\lambda\\mathbf b$. To test two lines, use a different parameter for each, equate the components and solve two of them, then check the third. If the third fails, the lines are skew: they are not parallel and never meet.' },
      { title: 'Projections and spheres', body: 'The scalar projection of $\\mathbf a$ on $\\mathbf b$ is $\\dfrac{\\mathbf a\\cdot\\mathbf b}{|\\mathbf b|}$. A sphere with centre $\\mathbf c$ and radius $R$ is the set of points with $|\\mathbf r-\\mathbf c|=R$, which in coordinates is $(x-c_1)^2+(y-c_2)^2+(z-c_3)^2=R^2$.' }
    ],
    definitions: [
      { term: 'Scalar product', meaning: 'For vectors $\\mathbf a$ and $\\mathbf b$, the number $\\mathbf a\\cdot\\mathbf b=|\\mathbf a||\\mathbf b|\\cos\\theta$, where $\\theta$ is the angle between them, equal to the sum of products of matching components.' },
      { term: 'Skew lines', meaning: 'Two lines in three dimensions that are neither parallel nor intersecting.' }
    ],
    formulas: [
      { label: 'Angle between vectors', tex: '\\cos\\theta=\\frac{\\mathbf a\\cdot\\mathbf b}{|\\mathbf a||\\mathbf b|}' },
      { label: 'Vector equation of a line', tex: '\\mathbf r=\\mathbf a+\\lambda\\mathbf b,\\quad\\lambda\\in\\mathbb R' },
      { label: 'Sphere', tex: '|\\mathbf r-\\mathbf c|=R\\iff(x-c_1)^2+(y-c_2)^2+(z-c_3)^2=R^2' }
    ],
    points: [
      { front: 'What does $\\mathbf a\\cdot\\mathbf b=0$ tell you?', back: 'The vectors are perpendicular, as long as neither is the zero vector.' },
      { front: 'Is $\\mathbf a\\cdot\\mathbf b$ a vector or a number?', back: 'A number (a scalar).' },
      { front: 'What are skew lines?', back: 'Lines in space that are not parallel and do not intersect.' },
      { front: 'Find $|\\mathbf a|$ for $\\mathbf a=(2,-1,2)$.', back: '$\\sqrt{4+1+4}=3$.' },
      { front: 'How do you find the centre and radius from $x^2+y^2+z^2+px+qy+rz+s=0$?', back: 'Complete the square in each variable, then read off $(x-c_1)^2+\\cdots=R^2$.' }
    ],
    mistakes: [
      { wrong: 'Two lines in space with different directions must meet.', right: 'They may be skew. Solve two components for the parameters, then test the third.' },
      { wrong: 'Using the same parameter $\\lambda$ for both lines when looking for an intersection.', right: 'The point can sit at different positions along each line, so use $\\lambda$ for one and $\\mu$ for the other.' },
      { wrong: 'A sphere $x^2+y^2+z^2-2x=8$ has radius $\\sqrt8$.', right: 'Complete the square: $(x-1)^2+y^2+z^2=9$, so the radius is $3$.' }
    ],
    examples: [
      {
        question: 'Find the angle between $\\mathbf a=(2,-1,2)$ and $\\mathbf b=(1,2,2)$.',
        steps: ['The scalar product is $2\\times1+(-1)\\times2+2\\times2=4$.', 'The magnitudes are $|\\mathbf a|=\\sqrt{4+1+4}=3$ and $|\\mathbf b|=\\sqrt{1+4+4}=3$.', 'So $\\cos\\theta=\\dfrac{4}{9}$ and $\\theta\\approx63.6^\\circ$.'],
        answer: '$\\cos\\theta=\\tfrac49$, so $\\theta\\approx63.6^\\circ$',
        verify: { kind: 'values', pairs: [['2*1+(-1)*2+2*2', '4'], ['sqrt(2^2+(-1)^2+2^2)', '3'], ['sqrt(1^2+2^2+2^2)', '3'], ['4/(3*3)', '4/9']] }
      },
      {
        question: 'Do the lines $\\mathbf r=(1,0,2)+\\lambda(1,2,-1)$ and $\\mathbf r=(0,1,3)+\\mu(1,1,-1)$ meet? If so, where?',
        steps: ['Equate components: $1+\\lambda=\\mu$, $2\\lambda=1+\\mu$ and $2-\\lambda=3-\\mu$.', 'Substitute $\\mu=1+\\lambda$ into the second: $2\\lambda=2+\\lambda$, so $\\lambda=2$ and $\\mu=3$.', 'Test the third: $2-2=0$ and $3-3=0$. It holds, so the lines meet.', 'The point is $(1+2,\\,0+4,\\,2-2)=(3,4,0)$.'],
        answer: 'They meet at $(3,4,0)$.',
        verify: { kind: 'values', pairs: [['1+2', '3'], ['2*2', '4'], ['2-2', '0'], ['0+3', '3'], ['1+3', '4'], ['3-3', '0'], ['2*2', '1+3']] }
      },
      {
        question: 'Find the centre and radius of the sphere $x^2+y^2+z^2-2x+4y-6z-11=0$.',
        steps: ['Complete the square: $(x-1)^2+(y+2)^2+(z-3)^2=11+1+4+9$.', 'The right side is $25$, so the centre is $(1,-2,3)$ and the radius is $5$.'],
        answer: 'Centre $(1,-2,3)$, radius $5$',
        verify: { kind: 'values', pairs: [['11+1+2^2+3^2', '25'], ['sqrt(11+1^2+2^2+3^2)', '5']] }
      }
    ]
  },

  'me2-12-03': {
    summary: 'Complex numbers extend the real numbers with $i$, where $i^2=-1$, so every quadratic has roots. A complex number is a point on the Argand diagram, described by its real and imaginary parts or by its modulus and argument.',
    prereqs: ['mav-11-04', 'me1-11-02'],
    concepts: [
      { title: 'Cartesian form and arithmetic', body: 'Write $z=a+bi$ with $a,b$ real. Add and subtract the real and imaginary parts separately, and multiply by expanding with $i^2=-1$. To divide, multiply top and bottom by the conjugate of the denominator.' },
      { title: 'Conjugate and modulus', body: 'The conjugate of $z=a+bi$ is $\\bar z=a-bi$, a reflection in the real axis. The modulus $|z|=\\sqrt{a^2+b^2}$ is the distance from the origin, and $z\\bar z=|z|^2$ is real.' },
      { title: 'Argument and polar form', body: 'The argument $\\arg z=\\theta$ is the angle from the positive real axis, taken in $(-\\pi,\\pi]$. Then $z=r(\\cos\\theta+i\\sin\\theta)$ with $r=|z|$. Taking the quadrant into account is essential: $\\tan\\theta=\\tfrac ba$ is not enough on its own.' }
    ],
    definitions: [
      { term: 'Imaginary unit', meaning: 'The number $i$ with $i^2=-1$. A complex number is $a+bi$ with $a$ the real part and $b$ the imaginary part.' },
      { term: 'Argand diagram', meaning: 'A plane on which $a+bi$ is plotted at the point $(a,b)$, with the real part on the horizontal axis and the imaginary part on the vertical axis.' }
    ],
    formulas: [
      { label: 'Modulus and conjugate', tex: '|a+bi|=\\sqrt{a^2+b^2},\\qquad z\\bar z=|z|^2' },
      { label: 'Polar form', tex: 'z=r(\\cos\\theta+i\\sin\\theta),\\quad r=|z|,\\ \\theta=\\arg z' },
      { label: 'Products in polar form', tex: '|z_1z_2|=|z_1||z_2|,\\qquad\\arg(z_1z_2)=\\arg z_1+\\arg z_2' }
    ],
    points: [
      { front: 'What are $i^2$, $i^3$ and $i^4$?', back: '$-1$, $-i$ and $1$.' },
      { front: 'The conjugate of $3-5i$', back: '$3+5i$.' },
      { front: 'The complex roots of a real quadratic come as what?', back: 'A conjugate pair, $p\\pm qi$.' },
      { front: 'What is $|z|$ for $z=3+4i$?', back: '$\\sqrt{9+16}=5$.' },
      { front: 'Which operation on the Argand diagram is $z\\mapsto\\bar z$?', back: 'A reflection in the real axis.' }
    ],
    mistakes: [
      { wrong: '$|z|^2=z^2$.', right: 'The identity is $|z|^2=z\\bar z$. For $z=3+4i$, $z^2=-7+24i$ but $|z|^2=25$.' },
      { wrong: '$\\arg(-1-i)=\\tfrac\\pi4$ because $\\tan^{-1}(1)=\\tfrac\\pi4$.', right: 'The point is in the third quadrant, so $\\arg(-1-i)=-\\tfrac{3\\pi}{4}$.' },
      { wrong: '$(a+bi)(c+di)=ac+bd\\,i$.', right: 'Expand fully: $(ac-bd)+(ad+bc)i$, since $i^2=-1$.' }
    ],
    examples: [
      {
        question: 'Calculate $(3+2i)(1-4i)$.',
        steps: ['Expand: $3-12i+2i-8i^2$.', 'Use $i^2=-1$: $3-10i+8$.', 'Collect: $11-10i$.'],
        answer: '$11-10i$',
        verify: { kind: 'values', pairs: [['3*1-2*(-4)', '11'], ['3*(-4)+2*1', '-10']] }
      },
      {
        question: 'Write $z=1+\\sqrt3\\,i$ in modulus-argument form.',
        steps: ['The modulus is $|z|=\\sqrt{1+3}=2$.', 'The point is in the first quadrant and $\\tan\\theta=\\sqrt3$, so $\\theta=\\tfrac\\pi3$.', 'So $z=2\\left(\\cos\\left(\\tfrac\\pi3\\right)+i\\sin\\left(\\tfrac\\pi3\\right)\\right)$.'],
        answer: '$z=2\\left(\\cos\\left(\\tfrac\\pi3\\right)+i\\sin\\left(\\tfrac\\pi3\\right)\\right)$',
        verify: { kind: 'values', pairs: [['sqrt(1^2+3)', '2'], ['atan(sqrt(3))', 'pi/3'], ['2*cos(pi/3)', '1'], ['2*sin(pi/3)', 'sqrt(3)']] }
      },
      {
        question: 'Solve $z^2-4z+13=0$ over the complex numbers.',
        steps: ['The discriminant is $(-4)^2-4\\times1\\times13=-36$.', 'Its square root over the complex numbers is $\\sqrt{-36}=6i$.', 'So $z=\\dfrac{4\\pm6i}{2}=2\\pm3i$, a conjugate pair.'],
        answer: '$z=2\\pm3i$',
        verify: { kind: 'values', pairs: [['4^2-4*1*13', '-36'], ['sqrt(36)', '6'], ['4/2', '2'], ['sqrt(36)/2', '3'], ['2^2-3^2-4*2+13', '0'], ['2*2*3-4*3', '0']] }
      }
    ]
  },

  'me2-12-04': {
    summary: 'Further integration adds three tools to substitution: integration by parts, partial fractions and reduction formulae, together with the inverse trigonometric standard forms. The skill is choosing which tool fits the integrand.',
    prereqs: ['mav-12-05', 'me1-12-04'],
    concepts: [
      { title: 'Integration by parts', body: 'Reverse the product rule: $\\int u\\,dv=uv-\\int v\\,du$. Choose $u$ to be the factor that gets simpler when differentiated, such as $x$ or $\\ln x$, and $dv$ the factor you can integrate, such as $e^x$.' },
      { title: 'Partial fractions and standard forms', body: 'Split a rational function with distinct linear factors into simple fractions, for example $\\dfrac{1}{(x-1)(x+2)}=\\dfrac13\\left(\\dfrac1{x-1}-\\dfrac1{x+2}\\right)$, and integrate each to a logarithm. A quadratic with no real roots is first written as $(x+b)^2+a^2$ by completing the square, and then gives $\\dfrac1a\\tan^{-1}\\dfrac{x+b}a$; square roots of $a^2-x^2$ lead to $\\sin^{-1}\\dfrac xa$.' },
      { title: 'Reduction formulae', body: 'A reduction formula writes $I_n$ in terms of an earlier member such as $I_{n-2}$, found by parts. Compute the smallest cases directly, then build up to the one you need, keeping the limits in each step.' }
    ],
    definitions: [
      { term: 'Reduction formula', meaning: 'A relation between $I_n$ and a term with a smaller index, used to evaluate an integral that depends on $n$ one step at a time.' },
      { term: 'Partial fractions', meaning: 'The expression of a rational function as a sum of simpler fractions with the factors of the denominator as their denominators.' }
    ],
    formulas: [
      { label: 'Integration by parts', tex: '\\int u\\,\\frac{dv}{dx}\\,dx=uv-\\int v\\,\\frac{du}{dx}\\,dx' },
      { label: 'Inverse trigonometric standard forms', tex: '\\int\\frac{dx}{x^2+a^2}=\\frac1a\\tan^{-1}\\frac xa+C,\\qquad\\int\\frac{dx}{\\sqrt{a^2-x^2}}=\\sin^{-1}\\frac xa+C' },
      { label: 'A reduction formula', tex: 'I_n=\\int_0^{\\pi/2}\\sin^nx\\,dx=\\frac{n-1}{n}I_{n-2},\\quad I_0=\\frac\\pi2,\\ I_1=1' }
    ],
    points: [
      { front: 'Which integral needs parts: $\\int xe^x\\,dx$ or $\\int xe^{x^2}\\,dx$?', back: '$\\int xe^x\\,dx$. The second is a substitution, $u=x^2$.' },
      { front: '$\\displaystyle\\int\\ln x\\,dx$', back: '$x\\ln x-x+C$, by parts with $u=\\ln x$, $dv=dx$.' },
      { front: 'What is $\\displaystyle\\int_0^{a}\\frac{dx}{x^2+a^2}$?', back: '$\\dfrac1a\\tan^{-1}1=\\dfrac{\\pi}{4a}$.' },
      { front: 'Before partial fractions, the numerator must have what relation to the denominator?', back: 'Lower degree. Divide first if it is not.' },
      { front: 'In a definite integral by parts, where do the limits go?', back: 'On the $uv$ term as well as the remaining integral.' }
    ],
    mistakes: [
      { wrong: '$\\displaystyle\\int\\frac{dx}{x^2+9}=\\ln(x^2+9)+C$.', right: 'The numerator is not the derivative of the denominator. The answer is $\\tfrac13\\tan^{-1}\\left(\\tfrac x3\\right)+C$.' },
      { wrong: 'In $\\int x e^x\\,dx$, taking $u=e^x$ and $dv=x\\,dx$.', right: 'That gives $\\tfrac12x^2e^x-\\int\\tfrac12x^2e^x\\,dx$, which is harder than the integral you started with. Take $u=x$ so that it differentiates to $1$.' },
      { wrong: 'Dropping the $uv$ term in a definite integral by parts.', right: 'Evaluate $\\left[uv\\right]$ between the limits and subtract the remaining integral.' }
    ],
    examples: [
      {
        question: 'Evaluate $\\displaystyle\\int_0^1xe^x\\,dx$.',
        steps: ['Let $u=x$ and $dv=e^x\\,dx$, so $du=dx$ and $v=e^x$.', 'Then $\\displaystyle\\int_0^1xe^x\\,dx=\\left[xe^x\\right]_0^1-\\int_0^1e^x\\,dx$.', '$=e-(e-1)=1$.'],
        answer: '$1$',
        verify: { kind: 'values', pairs: [['1*e^1-0*e^0', 'e'], ['e-(e^1-e^0)', '1']] }
      },
      {
        question: 'Evaluate $\\displaystyle\\int_2^3\\frac{dx}{(x-1)(x+2)}$.',
        steps: ['Split: $\\dfrac{1}{(x-1)(x+2)}=\\dfrac13\\left(\\dfrac1{x-1}-\\dfrac1{x+2}\\right)$. Check at $x=3$: $\\tfrac1{10}=\\tfrac13\\left(\\tfrac12-\\tfrac15\\right)$.', 'Integrate: $\\dfrac13\\left[\\ln(x-1)-\\ln(x+2)\\right]_2^3$.', '$=\\dfrac13\\bigl[(\\ln2-\\ln5)-(\\ln1-\\ln4)\\bigr]=\\dfrac13\\ln\\left(\\dfrac85\\right)$.'],
        answer: '$\\tfrac13\\ln\\left(\\tfrac85\\right)$',
        verify: { kind: 'values', pairs: [['(1/3)*(1/2-1/5)', '1/10'], ['(1/3)*(ln(2)-ln(5)-(ln(1)-ln(4)))', '(1/3)*ln(8/5)']] }
      },
      {
        question: 'Let $I_n=\\displaystyle\\int_0^{\\pi/2}\\sin^nx\\,dx$. Use $I_n=\\dfrac{n-1}{n}I_{n-2}$ to evaluate $I_4$.',
        steps: ['The starting value is $I_0=\\displaystyle\\int_0^{\\pi/2}1\\,dx=\\dfrac\\pi2$.', '$I_2=\\dfrac12I_0=\\dfrac\\pi4$.', '$I_4=\\dfrac34I_2=\\dfrac34\\times\\dfrac\\pi4=\\dfrac{3\\pi}{16}$.'],
        answer: '$\\dfrac{3\\pi}{16}$',
        verify: { kind: 'values', pairs: [['(1/2)*(pi/2)', 'pi/4'], ['(3/4)*(1/2)*(pi/2)', '3*pi/16']] }
      }
    ]
  },

  'me2-12-05': {
    summary: 'Applications of calculus to mechanics use acceleration written three ways to solve for motion: simple harmonic motion, and motion under a resistance that depends on speed, with a terminal velocity when the resistance balances the driving force.',
    prereqs: ['mav-12-06', 'me1-12-05'],
    concepts: [
      { title: 'Three forms of acceleration', body: 'Acceleration can be written $\\ddot x=\\dfrac{dv}{dt}=v\\dfrac{dv}{dx}=\\dfrac{d}{dx}\\left(\\tfrac12v^2\\right)$. Use $\\dfrac{dv}{dt}$ when time is the variable and $v\\dfrac{dv}{dx}$ when you want speed in terms of position.' },
      { title: 'Simple harmonic motion', body: 'If $\\ddot x=-n^2x$ then $x=a\\cos(nt+\\alpha)$, the period is $T=\\dfrac{2\\pi}{n}$ and $v^2=n^2(a^2-x^2)$. The speed is greatest at the centre, $x=0$, where it is $na$, and zero at the ends $x=\\pm a$.' },
      { title: 'Resisted motion and terminal velocity', body: 'For a body falling with resistance, take downward as positive: $\\ddot x=g-kv$ for resistance proportional to speed, or $g-kv^2$ for resistance proportional to speed squared. The terminal velocity is the speed at which the acceleration is zero.' }
    ],
    definitions: [
      { term: 'Terminal velocity', meaning: 'The limiting speed of a body moving under a resistance, found by setting the acceleration to zero. For $\\ddot x=g-kv$ it is $\\dfrac gk$; for $\\ddot x=g-kv^2$ it is $\\sqrt{\\dfrac gk}$.' },
      { term: 'Simple harmonic motion', meaning: 'Motion along a line with acceleration proportional to the displacement from a fixed point and directed towards it: $\\ddot x=-n^2x$.' }
    ],
    formulas: [
      { label: 'Simple harmonic motion', tex: '\\ddot x=-n^2x,\\qquad v^2=n^2(a^2-x^2),\\qquad T=\\frac{2\\pi}{n}' },
      { label: 'Falling with resistance $kv$ from rest', tex: '\\ddot x=g-kv\\ \\Rightarrow\\ v=\\frac gk\\left(1-e^{-kt}\\right)' },
      { label: 'Falling with resistance $kv^2$ from rest', tex: '\\ddot x=g-kv^2\\ \\Rightarrow\\ x=\\frac1{2k}\\ln\\frac{g}{g-kv^2}' }
    ],
    points: [
      { front: 'Where is the speed greatest in simple harmonic motion?', back: 'At the centre of motion, $x=0$, where $|v|=na$.' },
      { front: 'Where is the acceleration greatest in simple harmonic motion?', back: 'At the ends, $x=\\pm a$, where its size is $n^2a$.' },
      { front: 'For a body thrown upwards with resistance $kv$, what is $\\ddot x$ if up is positive?', back: '$\\ddot x=-g-kv$. Gravity and resistance both act downwards.' },
      { front: 'Why does the speed never reach the terminal velocity in a finite time?', back: 'The acceleration shrinks to zero as the speed approaches it, so the speed only approaches it.' },
      { front: 'Which form of acceleration helps when the answer is needed at a given position?', back: '$v\\dfrac{dv}{dx}$.' }
    ],
    mistakes: [
      { wrong: 'Terminal velocity means the body has stopped.', right: 'It is the constant speed at which the resistance balances the weight. The acceleration is zero, not the velocity.' },
      { wrong: 'Using $\\ddot x=g-kv^2$ for a body moving upwards with downward positive, left unchanged.', right: 'When $v<0$ the resistance still acts downwards, so write $\\ddot x=g+kv^2$ for the upward motion, or $\\ddot x=g-kv|v|$ for both directions. Choose the positive direction first and write the sign of every force from it.' },
      { wrong: 'The period of $\\ddot x=-9x$ is $\\tfrac{2\\pi}{9}$.', right: 'The coefficient is $n^2=9$, so $n=3$ and the period is $\\tfrac{2\\pi}{3}$.' }
    ],
    examples: [
      {
        question: 'A particle falls from rest with $\\ddot x=10-0.5v$. Find its speed at $t=2$ and its terminal velocity.',
        steps: ['Here $g=10$ and $k=0.5$, so the terminal velocity is $\\tfrac gk=20$.', 'The speed is $v=20\\left(1-e^{-0.5t}\\right)$.', 'At $t=2$: $v=20(1-e^{-1})\\approx12.6$.', 'Check by differentiating: $\\dfrac{dv}{dt}=10e^{-0.5t}=10-0.5v$.'],
        answer: '$v=20(1-e^{-1})\\approx12.6$; terminal velocity $20$',
        verify: { kind: 'values', pairs: [['10/0.5', '20'], ['(10/0.5)*(1-e^(-0.5*2))', '20*(1-e^(-1))'], ['10*e^(-0.5*2)', '10-0.5*20*(1-e^(-0.5*2))']] }
      },
      {
        question: 'A particle falls from rest with $\\ddot x=10-0.1v^2$. Find its terminal velocity, and its speed after it has fallen $10$ m.',
        steps: ['At terminal velocity $10-0.1v^2=0$, so $v^2=100$ and $v=10$.', 'Use $v\\dfrac{dv}{dx}=10-0.1v^2$ and integrate: $x=\\dfrac1{0.2}\\ln\\left(\\dfrac{10}{10-0.1v^2}\\right)$.', 'Set $x=10$: $\\ln\\left(\\dfrac{10}{10-0.1v^2}\\right)=2$, so $10-0.1v^2=10e^{-2}$.', 'Then $v^2=100(1-e^{-2})$ and $v=10\\sqrt{1-e^{-2}}\\approx9.3$.'],
        answer: 'Terminal velocity $10$; speed $10\\sqrt{1-e^{-2}}\\approx9.3$ after $10$ m',
        verify: { kind: 'values', pairs: [['sqrt(10/0.1)', '10'], ['sqrt(100*(1-e^(-2)))', '10*sqrt(1-e^(-2))'], ['(1/(2*0.1))*ln(10/(10-0.1*100*(1-e^(-2))))', '10']] }
      },
      {
        question: 'A particle moves with $x=4\\cos(3t)$. Show that its motion is simple harmonic and find its period, maximum speed and maximum acceleration.',
        steps: ['Differentiate twice: $\\dot x=-12\\sin(3t)$ and $\\ddot x=-36\\cos(3t)=-9x$, so $\\ddot x=-n^2x$ with $n=3$.', 'The period is $\\dfrac{2\\pi}{3}$.', 'The amplitude is $a=4$, so the maximum speed is $na=12$ and the maximum acceleration is $n^2a=36$.'],
        answer: 'Period $\\tfrac{2\\pi}{3}$; maximum speed $12$; maximum acceleration $36$',
        verify: { kind: 'values', pairs: [['-36*cos(3*0.5)+9*4*cos(3*0.5)', '0'], ['3*4', '12'], ['3^2*4', '36'], ['2*pi/3', '2*pi/3']] }
      }
    ]
  }
};
