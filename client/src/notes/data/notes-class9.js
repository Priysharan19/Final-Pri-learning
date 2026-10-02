// i18n note: mathematics content, English by design.
export default {
  'c9-coordinate-geometry': {
    summary: 'Two perpendicular number lines turn the flat plane into a grid where every point has an exact address $(x, y)$. With addresses in hand, distances, shapes and layouts can be measured by arithmetic instead of a ruler.',
    prereqs: ['c8-graphs', 'c7-connecting-dots-current'],
    concepts: [
      { title: 'Two axes, one origin', body: 'The horizontal $x$-axis and vertical $y$-axis cross at the origin $O(0, 0)$. A point $(x, y)$ is reached by moving $x$ units sideways first, then $y$ units up or down.' },
      { title: 'Quadrants and signs', body: 'The axes split the plane into four quadrants, numbered anticlockwise from the top right. The signs are $(+,+)$ in I, $(-,+)$ in II, $(-,-)$ in III and $(+,-)$ in IV. A point on an axis lies in no quadrant.' },
      { title: 'Straight-line distances', body: 'If two points share a $y$-value, the distance between them is the difference of their $x$-values (taken positive). If they share an $x$-value, use the difference of the $y$-values.' },
      { title: 'Any two points', body: 'For general points, the horizontal and vertical gaps form the two shorter sides of a right triangle. The Baudhāyana–Pythagoras theorem then gives the slanted distance as the hypotenuse.' },
      { title: 'Modelling with coordinates', body: 'Place a real layout, such as a room or a field, on the grid with a convenient corner at the origin. Lengths, perimeters and whether a shape is a square or rectangle can then be checked by computing side lengths and diagonals.' }
    ],
    definitions: [
      { term: 'Ordered pair', meaning: 'A pair $(x, y)$ where order matters: $(2, 5)$ and $(5, 2)$ are different points.' },
      { term: 'Abscissa', meaning: 'The $x$-coordinate: the signed distance of a point from the $y$-axis.' },
      { term: 'Ordinate', meaning: 'The $y$-coordinate: the signed distance of a point from the $x$-axis.' },
      { term: 'Origin', meaning: 'The point $(0, 0)$ where the two axes meet.' },
      { term: 'Quadrant', meaning: 'One of the four regions into which the axes divide the plane.' }
    ],
    formulas: [
      { label: 'Horizontal distance', tex: 'd = |x_2 - x_1|', note: 'Points with the same $y$-coordinate.' },
      { label: 'Vertical distance', tex: 'd = |y_2 - y_1|', note: 'Points with the same $x$-coordinate.' },
      { label: 'Distance between two points', tex: 'd = \\sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}' },
      { label: 'Distance from the origin', tex: 'd = \\sqrt{x^2 + y^2}' }
    ],
    points: [
      { front: 'Which coordinate comes first?', back: 'Always $x$ first, then $y$.' },
      { front: 'Where does $(0, -4)$ lie?', back: 'On the $y$-axis, below the origin. Points on an axis belong to no quadrant.' },
      { front: 'Sign pattern in Quadrant III', back: 'Both coordinates negative: $(-,-)$.' },
      { front: 'Every point on the $x$-axis has...', back: '$y = 0$. Every point on the $y$-axis has $x = 0$.' },
      { front: 'Does the order of subtraction matter in the distance formula?', back: 'No. Each difference is squared, so $(x_2 - x_1)^2 = (x_1 - x_2)^2$.' },
      { front: 'Checking a square from coordinates', back: 'All four sides equal and both diagonals equal.' }
    ],
    mistakes: [
      { wrong: 'Plotting $(3, -2)$ by going 3 down and 2 right.', right: 'Move along $x$ first: 3 right, then 2 down.', misconception: 'variable-swapped' },
      { wrong: 'Distance from $(1, 2)$ to $(4, 6)$ is $3 + 4 = 7$.', right: 'Add the squares, then take the root: $\\sqrt{9 + 16} = 5$.' },
      { wrong: 'Distance from $(-3, 5)$ to $(4, 5)$ is $4 - 3 = 1$.', right: 'Subtract the coordinates with their signs: $4 - (-3) = 7$.', misconception: 'sign-flipped' },
      { wrong: 'Saying $(0, 5)$ is in Quadrant I.', right: 'It lies on the $y$-axis, so it is in no quadrant.' }
    ],
    examples: [
      { question: 'Find the distance between $A(1, 2)$ and $B(4, 6)$.', steps: ['Horizontal gap: $4 - 1 = 3$. Vertical gap: $6 - 2 = 4$.', '$AB = \\sqrt{3^2 + 4^2} = \\sqrt{25}$.'], answer: '$5$ units', verify: { kind: 'value', expr: 'sqrt((4-1)^2+(6-2)^2)', answer: '5' } },
      { question: 'Find the distance between $P(-3, 5)$ and $Q(4, 5)$.', steps: ['Both have $y = 5$, so the segment is horizontal.', 'Distance $= |4 - (-3)| = 7$.'], answer: '$7$ units', verify: { kind: 'value', expr: 'abs(4-(-3))', answer: '7' } }
    ]
  },

  'c9-linear-polynomials': {
    summary: 'A polynomial is a sum of terms made from whole-number powers of a variable. Linear polynomials, of the form $ax + b$ with $a \\ne 0$, describe anything that changes by the same amount at every step, and their graphs are straight lines.',
    prereqs: ['c8-linear-equations', 'c8-graphs'],
    concepts: [
      { title: 'Parts of a polynomial', body: 'In $5x^3 - 2x + 7$ the terms are $5x^3$, $-2x$ and $7$. The numbers in front are coefficients, $7$ is the constant term, and the highest power, $3$, is the degree.' },
      { title: 'Value of a polynomial', body: 'To find $p(a)$, replace every $x$ by $a$ and evaluate. A value of $x$ that makes $p(x) = 0$ is a zero of the polynomial.' },
      { title: 'Constant-rate change', body: 'If a quantity starts at $b$ and changes by $a$ each step, after $x$ steps it is $ax + b$. A positive $a$ means linear growth; a negative $a$ means linear decay.' },
      { title: 'Slope and intercept', body: 'On the graph of $y = ax + b$, $a$ is the slope (rise per unit run) and $b$ is where the line cuts the $y$-axis. In a table, equal steps in $x$ give equal steps in $y$.' },
      { title: 'Parallel lines', body: 'Lines with the same slope but different intercepts never meet: they are parallel.' }
    ],
    definitions: [
      { term: 'Polynomial in $x$', meaning: 'An expression whose terms are numbers times $x^n$ with $n$ a whole number (0, 1, 2, ...).' },
      { term: 'Degree', meaning: 'The highest power of the variable with a non-zero coefficient.' },
      { term: 'Linear polynomial', meaning: 'A polynomial of degree 1, written $ax + b$ with $a \\ne 0$.' },
      { term: 'Zero of a polynomial', meaning: 'A number $c$ with $p(c) = 0$.' },
      { term: 'Slope', meaning: 'The change in $y$ for each increase of 1 in $x$.' }
    ],
    formulas: [
      { label: 'General linear polynomial', tex: 'p(x) = ax + b,\\quad a \\ne 0' },
      { label: 'Zero of a linear polynomial', tex: 'x = -\\dfrac{b}{a}' },
      { label: 'Slope from two points', tex: 'a = \\dfrac{y_2 - y_1}{x_2 - x_1}' },
      { label: 'Line through the graph', tex: 'y = ax + b', note: '$a$ is the slope, $b$ the $y$-intercept.' }
    ],
    points: [
      { front: 'Is $\\sqrt{x} + 1$ a polynomial?', back: 'No: $\\sqrt{x} = x^{1/2}$ and the power must be a whole number.' },
      { front: 'Degree of a non-zero constant like $7$', back: 'Zero.' },
      { front: 'How many zeros does a linear polynomial have?', back: 'Exactly one: $x = -b/a$.' },
      { front: 'Spotting linear data in a table', back: 'Equal steps in $x$ give equal differences in $y$.' },
      { front: 'Negative slope means...', back: 'The quantity falls by a fixed amount each step (linear decay); the line goes down from left to right.' },
      { front: 'Two lines with equal slope', back: 'They are parallel (or the same line if the intercepts also match).' }
    ],
    mistakes: [
      { wrong: 'Zero of $3x - 12$ is $-4$.', right: '$3x - 12 = 0$ gives $3x = 12$, so $x = 4$.', misconception: 'sign-on-transfer' },
      { wrong: 'Degree of $4x^2 + 9x^5 - 1$ is 2 because $x^2$ comes first.', right: 'Degree is the highest power anywhere: 5.' },
      { wrong: 'Evaluating $-x^2$ at $x = -3$ as $9$.', right: 'Square first, then apply the minus: $-(-3)^2 = -9$.', misconception: 'negative-squared' },
      { wrong: 'Reading $b$ in $y = ax + b$ as the slope.', right: '$a$ is the slope; $b$ is the $y$-intercept.' }
    ],
    examples: [
      { question: 'Find the zero of $p(x) = 3x - 12$.', steps: ['Set $3x - 12 = 0$.', '$3x = 12$, so $x = 4$.'], answer: '$x = 4$', verify: { kind: 'roots', f: '3x-12', answers: ['4'] } },
      { question: 'A candle is 20 cm tall and burns 2 cm per hour. How tall is it after 6 hours?', steps: ['Height after $x$ hours: $h = 20 - 2x$.', 'At $x = 6$: $20 - 12 = 8$.'], answer: '$8$ cm', verify: { kind: 'value', expr: '20-2*6', answer: '8' } }
    ]
  },

  'c9-number-systems': {
    summary: 'Numbers sit inside one another: natural numbers inside whole numbers, inside integers, inside rationals, and all of these with the irrationals make up the real numbers. Every real number has a place on the number line, and its decimal tells you whether it is rational.',
    prereqs: ['c8-rational-numbers', 'c8-squares-roots'],
    concepts: [
      { title: 'The nested system', body: '$\\mathbb{N} \\subset \\mathbb{W} \\subset \\mathbb{Z} \\subset \\mathbb{Q} \\subset \\mathbb{R}$. The irrational numbers fill the gaps the rationals leave, and together rationals and irrationals form the reals.' },
      { title: 'Rational and irrational', body: 'A rational number can be written $p/q$ with integers $p, q$ and $q \\ne 0$. Numbers such as $\\sqrt{2}$, $\\sqrt{3}$ and $\\pi$ cannot be written this way; they are irrational.' },
      { title: 'Density', body: 'Between any two different rationals there is another one, for example their average. So there are infinitely many rationals between any two.' },
      { title: 'Decimal test', body: 'A rational number has a decimal that either stops (terminates) or repeats forever. An irrational number has a decimal that never stops and never settles into a repeating block.' },
      { title: 'Placing roots on the line', body: 'Build a right triangle with legs 1 and 1 on the number line; its hypotenuse is $\\sqrt{2}$. Swing an arc from 0 to mark it. Repeating with legs $\\sqrt{2}$ and 1 gives $\\sqrt{3}$, and so on.' }
    ],
    definitions: [
      { term: 'Rational number', meaning: 'A number expressible as $p/q$ with $p, q$ integers and $q \\ne 0$.' },
      { term: 'Irrational number', meaning: 'A real number that is not rational; its decimal is non-terminating and non-repeating.' },
      { term: 'Real number', meaning: 'Any rational or irrational number; every point on the number line.' },
      { term: 'Recurring decimal', meaning: 'A decimal in which a block of digits repeats forever, written with a bar, such as $0.\\overline{36}$.' }
    ],
    formulas: [
      { label: 'Pure recurring decimal', tex: '0.\\overline{ab} = \\dfrac{ab}{99}', note: 'One 9 for each repeating digit.' },
      { label: 'Terminating test', tex: '\\dfrac{p}{q}\\text{ terminates} \\iff q = 2^m 5^n', note: 'With the fraction in lowest terms.' },
      { label: 'Root rules', tex: '\\sqrt{ab} = \\sqrt{a}\\,\\sqrt{b},\\quad \\sqrt{\\dfrac{a}{b}} = \\dfrac{\\sqrt{a}}{\\sqrt{b}}', note: 'For $a, b > 0$.' },
      { label: 'Rationalising', tex: '\\dfrac{1}{\\sqrt{a} - \\sqrt{b}} = \\dfrac{\\sqrt{a} + \\sqrt{b}}{a - b}', note: 'For $a, b \\ge 0$ with $a \\ne b$.' }
    ],
    points: [
      { front: 'Is every integer rational?', back: 'Yes: $n = n/1$.' },
      { front: 'Is $\\sqrt{9}$ irrational?', back: 'No, $\\sqrt{9} = 3$. The square root of a natural number is irrational only when that number is not a perfect square.' },
      { front: 'Rational + irrational is...', back: 'Always irrational.' },
      { front: 'Irrational × irrational is...', back: 'Can be either: $\\sqrt{2} \\times \\sqrt{2} = 2$ is rational.' },
      { front: 'Does $7/40$ terminate?', back: 'Yes: $40 = 2^3 \\times 5$, so $7/40 = 0.175$.' },
      { front: 'A rational between $a$ and $b$', back: 'Their average $(a + b)/2$.' }
    ],
    mistakes: [
      { wrong: '$\\sqrt{9 + 16} = 3 + 4 = 7$.', right: 'Roots do not split over sums: $\\sqrt{25} = 5$.', misconception: 'function-of-sum' },
      { wrong: '$22/7$ is exactly $\\pi$.', right: '$22/7$ is a rational approximation; $\\pi$ is irrational.' },
      { wrong: '$0.\\overline{3} = 3/10$.', right: '$0.\\overline{3} = 3/9 = 1/3$; $3/10 = 0.3$ only.' },
      { wrong: 'Thinking $-5$ is not rational because it is negative.', right: '$-5 = -5/1$ is rational.' }
    ],
    examples: [
      { question: 'Write $0.\\overline{36}$ as a fraction in lowest terms.', steps: ['Let $x = 0.3636\\ldots$; then $100x = 36.3636\\ldots$', 'Subtract: $99x = 36$, so $x = 36/99 = 4/11$.'], answer: '$\\dfrac{4}{11}$', verify: { kind: 'value', expr: '36/99', answer: '4/11' } },
      { question: 'Rationalise the denominator of $\\dfrac{1}{\\sqrt{5} - \\sqrt{3}}$.', steps: ['Multiply top and bottom by $\\sqrt{5} + \\sqrt{3}$.', 'Denominator: $5 - 3 = 2$.'], answer: '$\\dfrac{\\sqrt{5} + \\sqrt{3}}{2}$', verify: { kind: 'value', expr: '1/(sqrt(5)-sqrt(3))', answer: '(sqrt(5)+sqrt(3))/2' } }
    ]
  },

  'c9-algebraic-identities': {
    summary: 'An identity is an equation that is true for every value of its variables. A handful of identities let you expand brackets quickly, factorise expressions and do mental arithmetic with large numbers.',
    prereqs: ['c8-algebraic-identities', 'c8-factorisation'],
    concepts: [
      { title: 'Identity versus equation', body: 'An equation like $2x = 6$ holds for one value. An identity like $(a + b)^2 = a^2 + 2ab + b^2$ holds for all values, which you can check by expanding or by area diagrams.' },
      { title: 'Square identities', body: 'Squaring a sum or difference always produces a middle term $\\pm 2ab$. Squaring a three-term sum produces all squares plus twice every pair product.' },
      { title: 'Cube identities', body: '$(a + b)^3$ and $(a - b)^3$ expand into four terms. The sum and difference of cubes factorise into a linear factor times a quadratic one.' },
      { title: 'Factorising', body: 'First take out common factors. Then look for a known pattern, or split the middle term of $x^2 + px + q$ using two numbers that add to $p$ and multiply to $q$.' },
      { title: 'Using identities for numbers', body: 'Rewrite awkward numbers around a round one: $103 \\times 97 = (100 + 3)(100 - 3) = 10000 - 9 = 9991$.' }
    ],
    definitions: [
      { term: 'Identity', meaning: 'An equality that holds for every value of the variables involved.' },
      { term: 'Factorisation', meaning: 'Writing an expression as a product of simpler expressions.' },
      { term: 'Splitting the middle term', meaning: 'Rewriting $x^2 + px + q$ as $x^2 + mx + nx + q$ where $m + n = p$ and $mn = q$, then grouping.' }
    ],
    formulas: [
      { label: 'Square of a sum', tex: '(a + b)^2 = a^2 + 2ab + b^2' },
      { label: 'Square of a difference', tex: '(a - b)^2 = a^2 - 2ab + b^2' },
      { label: 'Difference of squares', tex: 'a^2 - b^2 = (a + b)(a - b)' },
      { label: 'Product of two binomials', tex: '(x + a)(x + b) = x^2 + (a + b)x + ab' },
      { label: 'Square of a trinomial', tex: '(a + b + c)^2 = a^2 + b^2 + c^2 + 2ab + 2bc + 2ca' },
      { label: 'Cube of a sum', tex: '(a + b)^3 = a^3 + 3a^2b + 3ab^2 + b^3' },
      { label: 'Cube of a difference', tex: '(a - b)^3 = a^3 - 3a^2b + 3ab^2 - b^3' },
      { label: 'Sum and difference of cubes', tex: 'a^3 \\pm b^3 = (a \\pm b)(a^2 \\mp ab + b^2)' },
      { label: 'Three cubes', tex: 'a^3 + b^3 + c^3 - 3abc = (a + b + c)(a^2 + b^2 + c^2 - ab - bc - ca)', note: 'So if $a + b + c = 0$, then $a^3 + b^3 + c^3 = 3abc$.' }
    ],
    points: [
      { front: 'Is $(a + b)^2 = a^2 + b^2$?', back: 'No. The middle term $2ab$ is always there.' },
      { front: 'Quick way to compute $99^2$', back: '$(100 - 1)^2 = 10000 - 200 + 1 = 9801$.' },
      { front: 'First step in any factorisation', back: 'Take out the highest common factor.' },
      { front: 'Splitting $x^2 + 5x + 6$', back: 'Need two numbers with sum 5 and product 6: 2 and 3, giving $(x + 2)(x + 3)$.' },
      { front: 'If $a + b + c = 0$, then $a^3 + b^3 + c^3 = $?', back: '$3abc$.' },
      { front: 'Checking a factorisation', back: 'Expand your answer; it must give back the original expression.' }
    ],
    mistakes: [
      { wrong: '$(x + 3)^2 = x^2 + 9$.', right: '$(x + 3)^2 = x^2 + 6x + 9$.', misconception: 'power-of-sum' },
      { wrong: '$(x - 4)^2 = x^2 - 8x - 16$.', right: 'The last term is $(-4)^2 = +16$: $x^2 - 8x + 16$.', misconception: 'sign-flipped' },
      { wrong: '$-(a - b)^2 = -a^2 - 2ab + b^2$.', right: 'The minus applies to every term: $-a^2 + 2ab - b^2$.', misconception: 'distribute-sign' },
      { wrong: '$a^3 + b^3 = (a + b)^3$.', right: '$a^3 + b^3 = (a + b)(a^2 - ab + b^2)$.', misconception: 'power-of-sum' }
    ],
    examples: [
      { question: 'Factorise $x^2 + 5x + 6$.', steps: ['Find two numbers with sum 5 and product 6: 2 and 3.', '$x^2 + 2x + 3x + 6 = x(x + 2) + 3(x + 2)$.'], answer: '$(x + 2)(x + 3)$', verify: { kind: 'equivalent', a: 'x^2+5x+6', b: '(x+2)(x+3)' } },
      { question: 'Use an identity to find $103 \\times 97$.', steps: ['$103 \\times 97 = (100 + 3)(100 - 3)$.', '$= 100^2 - 3^2 = 10000 - 9$.'], answer: '$9991$', verify: { kind: 'value', expr: '103*97', answer: '9991' } }
    ]
  },

  'c9-circles': {
    summary: 'A circle is every point at one fixed distance from a centre. That single fact makes circles highly symmetric, and it leads to a chain of theorems about chords, arcs and the angles they make at the centre and on the circle.',
    prereqs: ['c8-quadrilaterals', 'c7-triangles-current'],
    concepts: [
      { title: 'Three points fix a circle', body: 'Any three points not on one line lie on exactly one circle. Its centre is where the perpendicular bisectors of the joining segments meet; this is the circumcircle of the triangle they form.' },
      { title: 'Chords and the centre', body: 'Equal chords subtend equal angles at the centre and lie at equal distances from it. The perpendicular from the centre to a chord bisects the chord, and the perpendicular bisector of any chord passes through the centre.' },
      { title: 'Angles on arcs', body: 'The angle an arc subtends at the centre is twice the angle it subtends at any point on the rest of the circle. So all angles in the same segment are equal, and the angle in a semicircle is $90^\\circ$.' },
      { title: 'Cyclic quadrilaterals', body: 'If all four vertices lie on a circle, each pair of opposite angles adds to $180^\\circ$. Conversely, if a pair of opposite angles is supplementary, the quadrilateral is cyclic.' },
      { title: 'Concyclic test', body: 'If a segment subtends equal angles at two points on the same side of it, the four points lie on one circle.' }
    ],
    definitions: [
      { term: 'Chord', meaning: 'A segment joining two points on a circle; the longest chord is a diameter.' },
      { term: 'Arc', meaning: 'A connected piece of the circle between two points; the shorter one is the minor arc.' },
      { term: 'Segment', meaning: 'The region between a chord and an arc.' },
      { term: 'Concyclic points', meaning: 'Points that all lie on a single circle.' },
      { term: 'Cyclic quadrilateral', meaning: 'A quadrilateral whose four vertices lie on one circle.' }
    ],
    formulas: [
      { label: 'Half-chord and radius', tex: 'r^2 = d^2 + \\left(\\tfrac{\\ell}{2}\\right)^2', note: '$d$ is the distance of the chord of length $\\ell$ from the centre.' },
      { label: 'Centre angle vs circle angle', tex: '\\angle AOB = 2\\,\\angle ACB', note: '$C$ on the major arc, $O$ the centre.' },
      { label: 'Angle in a semicircle', tex: '\\angle ACB = 90^\\circ' },
      { label: 'Cyclic quadrilateral', tex: '\\angle A + \\angle C = \\angle B + \\angle D = 180^\\circ' }
    ],
    points: [
      { front: 'How many circles pass through 3 collinear points?', back: 'None.' },
      { front: 'Perpendicular from centre to a chord', back: 'It bisects the chord.' },
      { front: 'Equal chords are...', back: 'Equidistant from the centre and subtend equal central angles.' },
      { front: 'Angle subtended by a diameter at the circle', back: '$90^\\circ$.' },
      { front: 'Exterior angle of a cyclic quadrilateral', back: 'Equals the interior opposite angle.' },
      { front: 'Nearer chord to the centre is...', back: 'Longer.' }
    ],
    mistakes: [
      { wrong: 'The angle at the circle is twice the angle at the centre.', right: 'It is the other way: the centre angle is double.' },
      { wrong: 'Adjacent angles of a cyclic quadrilateral add to $180^\\circ$.', right: 'Only opposite angles are supplementary.' },
      { wrong: 'Using the full chord length with the radius in Pythagoras.', right: 'Use half the chord: $r^2 = d^2 + (\\ell/2)^2$.' }
    ],
    examples: [
      { question: 'A chord lies 5 cm from the centre of a circle of radius 13 cm. Find its length.', steps: ['Half-chord $= \\sqrt{13^2 - 5^2} = \\sqrt{144} = 12$.', 'Full chord $= 2 \\times 12$.'], answer: '$24$ cm', verify: { kind: 'value', expr: '2*sqrt(13^2-5^2)', answer: '24' } },
      { question: 'In a cyclic quadrilateral $ABCD$, $\\angle A = 75^\\circ$. Find $\\angle C$.', steps: ['Opposite angles of a cyclic quadrilateral sum to $180^\\circ$.', '$\\angle C = 180^\\circ - 75^\\circ$.'], answer: '$105^\\circ$', verify: { kind: 'value', expr: '180-75', answer: '105' } }
    ]
  },

  'c9-perimeter-area': {
    summary: 'Perimeter measures the boundary of a shape and area measures the surface it covers. This chapter collects the formulas for straight-sided shapes and circles, adds Heron’s formula for any triangle, and uses cutting and rearranging to handle composite figures.',
    prereqs: ['c8-mensuration'],
    concepts: [
      { title: 'Working with $\\pi$', body: 'Keep answers in terms of $\\pi$ unless told otherwise. If an approximation such as $22/7$ or $3.14$ is stated, use exactly that one and say the answer is approximate.' },
      { title: 'Areas from base and height', body: 'A parallelogram has area base × height, and a triangle is half of that. The height must be perpendicular to the chosen base. Parallelograms on the same base and between the same parallels have equal heights, so equal areas; the same holds for two triangles.' },
      { title: 'Heron’s formula', body: 'When only the three sides are known, find the semi-perimeter $s$, then multiply $s$ by its three differences from the sides and take the square root.' },
      { title: 'Arcs, sectors and segments', body: 'A sector with angle $\\theta$ is the fraction $\\theta/360$ of the whole circle, for both arc length and area. A segment is a sector minus the triangle cut off by the chord.' },
      { title: 'Composite shapes', body: 'Split a figure into known pieces, or take a big shape and subtract the missing parts. A circular track is the difference of two circles.' }
    ],
    definitions: [
      { term: 'Perimeter', meaning: 'Total length of the boundary of a plane figure.' },
      { term: 'Semi-perimeter', meaning: 'Half the perimeter of a triangle: $s = (a + b + c)/2$.' },
      { term: 'Sector', meaning: 'The region between two radii and the arc joining them.' },
      { term: 'Segment of a circle', meaning: 'The region between a chord and its arc.' }
    ],
    formulas: [
      { label: 'Rectangle', tex: 'P = 2(l + b),\\quad A = lb' },
      { label: 'Parallelogram', tex: 'A = b \\times h' },
      { label: 'Triangle', tex: 'A = \\tfrac{1}{2}\\, b\\, h' },
      { label: 'Heron’s formula', tex: 'A = \\sqrt{s(s - a)(s - b)(s - c)},\\quad s = \\dfrac{a + b + c}{2}' },
      { label: 'Circle', tex: 'C = 2\\pi r,\\quad A = \\pi r^2' },
      { label: 'Arc length', tex: '\\ell = \\dfrac{\\theta}{360^\\circ} \\times 2\\pi r' },
      { label: 'Sector area', tex: 'A = \\dfrac{\\theta}{360^\\circ} \\times \\pi r^2' },
      { label: 'Circular track', tex: 'A = \\pi (R^2 - r^2)' }
    ],
    points: [
      { front: 'Perimeter of a sector', back: 'Arc length plus two radii: $\\ell + 2r$.' },
      { front: 'Equilateral triangle of side $a$', back: 'Area $= \\frac{\\sqrt{3}}{4}a^2$.' },
      { front: 'Segment area', back: 'Sector area minus the triangle area.' },
      { front: 'Triangle and parallelogram on the same base, same parallels', back: 'Triangle area is half the parallelogram’s.' },
      { front: 'Units of area', back: 'Always square units, e.g. cm².' },
      { front: 'Before using Heron', back: 'Check that each side is less than the sum of the other two.' }
    ],
    mistakes: [
      { wrong: 'Using the slanted side of a parallelogram as its height.', right: 'Height is the perpendicular distance between the parallel sides.' },
      { wrong: 'Heron with $s = a + b + c$.', right: '$s$ is half the perimeter.' },
      { wrong: 'Track area $= \\pi (R - r)^2$.', right: 'Subtract the areas: $\\pi R^2 - \\pi r^2 = \\pi(R^2 - r^2)$.', misconception: 'power-of-sum' },
      { wrong: 'Mixing diameter and radius in $\\pi r^2$.', right: 'Halve the diameter first.' }
    ],
    examples: [
      { question: 'Find the area of a triangle with sides 13 cm, 14 cm and 15 cm.', steps: ['$s = (13 + 14 + 15)/2 = 21$.', '$A = \\sqrt{21 \\times 8 \\times 7 \\times 6} = \\sqrt{7056}$.'], answer: '$84$ cm²', verify: { kind: 'value', expr: 'sqrt(21*(21-13)*(21-14)*(21-15))', answer: '84' } },
      { question: 'Find the area of a sector of radius 7 cm and angle $90^\\circ$, in terms of $\\pi$.', steps: ['Fraction of the circle: $90/360 = 1/4$.', 'Area $= \\frac{1}{4} \\times \\pi \\times 49$.'], answer: '$\\dfrac{49\\pi}{4}$ cm²', verify: { kind: 'value', expr: '(90/360)*pi*7^2', answer: '49*pi/4' } }
    ]
  },

  'c9-probability': {
    summary: 'Probability puts a number from 0 to 1 on how likely an event is. It can be estimated from experiments and data, or worked out exactly by counting equally likely outcomes.',
    prereqs: ['c8-data-handling'],
    concepts: [
      { title: 'The probability scale', body: 'An impossible event has probability 0, a certain event has probability 1, and everything else lies in between. An even chance is $1/2$.' },
      { title: 'Experimental probability', body: 'Repeat an experiment and divide the number of times the event happened by the number of trials. With more trials, this fraction tends to settle near the theoretical value.' },
      { title: 'Theoretical probability', body: 'When all outcomes are equally likely, the probability of an event is the number of favourable outcomes divided by the total number of outcomes.' },
      { title: 'Sample spaces and trees', body: 'List every possible outcome. For several stages, a tree diagram shows each stage as branches; the outcomes are the paths, and counting them gives the total.' },
      { title: 'Complement', body: 'The event “not $E$” happens exactly when $E$ does not, so $P(\\text{not } E) = 1 - P(E)$.' }
    ],
    definitions: [
      { term: 'Experiment', meaning: 'An action with uncertain result, such as rolling a die.' },
      { term: 'Outcome', meaning: 'One possible result of an experiment.' },
      { term: 'Sample space', meaning: 'The set of all possible outcomes.' },
      { term: 'Event', meaning: 'A collection of outcomes, such as “an even number”.' },
      { term: 'Equally likely', meaning: 'Outcomes that each have the same chance of occurring.' }
    ],
    formulas: [
      { label: 'Experimental probability', tex: 'P(E) \\approx \\dfrac{\\text{times } E \\text{ occurred}}{\\text{number of trials}}' },
      { label: 'Theoretical probability', tex: 'P(E) = \\dfrac{\\text{favourable outcomes}}{\\text{total outcomes}}' },
      { label: 'Range', tex: '0 \\le P(E) \\le 1' },
      { label: 'Complement', tex: 'P(\\text{not } E) = 1 - P(E)' }
    ],
    points: [
      { front: 'Can a probability be $1.2$ or $-0.1$?', back: 'Never. It always lies between 0 and 1.' },
      { front: 'Sample space for tossing two coins', back: 'HH, HT, TH, TT: four outcomes, not three.' },
      { front: 'Why do more trials help?', back: 'Experimental probability settles closer to the true value in the long run.' },
      { front: 'Prime numbers on a die', back: '2, 3 and 5: three of six faces.' },
      { front: '“At least one” problems', back: 'Often easiest as $1 - P(\\text{none})$.' },
      { front: 'Sum of probabilities of all outcomes', back: 'Exactly 1.' }
    ],
    mistakes: [
      { wrong: 'Two coins: outcomes are 2 heads, 1 head, 0 heads, so $P(\\text{1 head}) = 1/3$.', right: 'HT and TH are separate outcomes: $P = 2/4 = 1/2$.', misconception: 'probability-wrong-total' },
      { wrong: 'After five heads, a tail is “due”.', right: 'Each fair toss is independent; $P(\\text{tail})$ is still $1/2$.' },
      { wrong: 'Counting 1 as a prime when finding $P(\\text{prime})$ on a die.', right: '1 is not prime; the primes are 2, 3, 5.' }
    ],
    examples: [
      { question: 'A fair die is rolled. Find the probability of getting a prime number.', steps: ['Sample space: 1, 2, 3, 4, 5, 6 (6 outcomes).', 'Primes: 2, 3, 5 (3 outcomes). $P = 3/6$.'], answer: '$\\dfrac{1}{2}$', verify: { kind: 'value', expr: '3/6', answer: '1/2' } },
      { question: 'Two fair coins are tossed. Find the probability of at least one head.', steps: ['Outcomes: HH, HT, TH, TT.', 'Only TT has no head, so $P = 1 - 1/4$.'], answer: '$\\dfrac{3}{4}$', verify: { kind: 'value', expr: '1-1/4', answer: '3/4' } }
    ]
  },

  'c9-sequences-progressions': {
    summary: 'A sequence is an ordered list of numbers made by a rule. Adding the same amount each time gives an arithmetic progression; multiplying by the same amount gives a geometric progression. Knowing the rule lets you predict any term without listing them all.',
    prereqs: ['c9-linear-polynomials', 'c8-exponents'],
    concepts: [
      { title: 'Explicit and recursive rules', body: 'An explicit rule gives $a_n$ directly from $n$, like $a_n = 2n + 1$. A recursive rule builds each term from earlier ones, like $a_n = a_{n-1} + a_{n-2}$ for the Virahānka–Fibonacci numbers 1, 1, 2, 3, 5, 8, ...' },
      { title: 'Arithmetic progression', body: 'Each term is the previous one plus a fixed common difference $d$. The terms follow a linear pattern, so their graph is a set of points on a straight line.' },
      { title: 'Sum of an AP', body: 'Pair the first and last terms, the second and second-last, and so on: every pair has the same total. That gives $S_n = \\frac{n}{2}(\\text{first} + \\text{last})$.' },
      { title: 'Geometric progression', body: 'Each term is the previous one times a fixed common ratio $r$. With a positive first term, $r > 1$ makes the terms grow quickly and $0 < r < 1$ makes them shrink, as in fractal patterns where each stage is a fixed fraction of the last.' }
    ],
    definitions: [
      { term: 'Sequence', meaning: 'An ordered list $a_1, a_2, a_3, \\ldots$ of numbers.' },
      { term: 'Common difference', meaning: 'In an AP, $d = a_{n+1} - a_n$, the same for every $n$.' },
      { term: 'Common ratio', meaning: 'In a GP, $r = a_{n+1} / a_n$, the same for every $n$.' },
      { term: 'Recursive rule', meaning: 'A rule that defines each term using one or more earlier terms, plus starting values.' }
    ],
    formulas: [
      { label: 'nth term of an AP', tex: 'a_n = a + (n - 1)d' },
      { label: 'Sum of first n terms of an AP', tex: 'S_n = \\dfrac{n}{2}\\big[2a + (n - 1)d\\big] = \\dfrac{n}{2}(a + \\ell)' },
      { label: 'nth term of a GP', tex: 'a_n = a\\,r^{\\,n - 1}' },
      { label: 'Virahānka–Fibonacci rule', tex: 'F_n = F_{n-1} + F_{n-2},\\quad F_1 = F_2 = 1' }
    ],
    points: [
      { front: 'Testing for an AP', back: 'Differences between consecutive terms are all equal.' },
      { front: 'Testing for a GP', back: 'Ratios of consecutive terms are all equal.' },
      { front: 'Why $(n - 1)$ and not $n$?', back: 'The first term already counts; only $n - 1$ steps take you to term $n$.' },
      { front: 'Sum of the first $n$ natural numbers', back: '$\\frac{n(n + 1)}{2}$.' },
      { front: 'Can $d$ be negative?', back: 'Yes; the AP then decreases.' },
      { front: 'A recursive rule needs...', back: 'Starting value(s) as well as the rule.' }
    ],
    mistakes: [
      { wrong: '$a_{20} = 3 + 20 \\times 4$ for the AP 3, 7, 11, ...', right: 'Use $n - 1$: $a_{20} = 3 + 19 \\times 4 = 79$.', misconception: 'arithmetic-slip' },
      { wrong: 'Common difference of 10, 7, 4, ... is 3.', right: 'Subtract in order: $7 - 10 = -3$.', misconception: 'sign-flipped' },
      { wrong: 'nth term of a GP is $a r^n$.', right: 'It is $a r^{n-1}$.' },
      { wrong: 'Treating 2, 4, 8, 16 as an AP.', right: 'Differences change but ratios are all 2: it is a GP.' }
    ],
    examples: [
      { question: 'For the AP 3, 7, 11, ..., find the 20th term and the sum of the first 20 terms.', steps: ['$a = 3$, $d = 4$. $a_{20} = 3 + 19 \\times 4 = 79$.', '$S_{20} = \\frac{20}{2}(3 + 79) = 10 \\times 82$.'], answer: '$a_{20} = 79$, $S_{20} = 820$', verify: { kind: 'values', pairs: [['3+(20-1)*4', '79'], ['20/2*(2*3+(20-1)*4)', '820']] } },
      { question: 'Find the 6th term of the GP 2, 6, 18, ...', steps: ['$a = 2$, $r = 6/2 = 3$.', '$a_6 = 2 \\times 3^5 = 2 \\times 243$.'], answer: '$486$', verify: { kind: 'value', expr: '2*3^(6-1)', answer: '486' } }
    ]
  }
};
