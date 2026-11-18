// Pri Learning · NSW Notes · Stage 5 Path (Years 9 and 10), first band
//
// Original revision writing for the Path (5.2 and 5.3) focus areas of the NSW
// Mathematics K–10 Syllabus (2022): algebra, equations, indices, logarithms,
// functions, linear relationships, circle geometry, congruence and similarity,
// surface area and data analysis. Written for Pri Learning; it is not an
// official NESA publication and quotes no syllabus text. Each topic is keyed by
// the lower-case outcome code of its focus area (a reference only). en-AU
// spelling. Every worked example's answer is re-derived by the deterministic
// engine in client/test/nsw-notes-bands-check.mjs.
export default {
  'ma5-alg-p-01': {
    summary: 'Factorising a quadratic expression writes it as a product of brackets. It reverses expanding, and it is the first step in solving quadratic equations, simplifying algebraic fractions and finding where a parabola meets the axes.',
    prereqs: ['ma5-alg-c-01', 'ma4-alg-c-01'],
    concepts: [
      { title: 'Take out the common factor first', body: 'Before any other method, remove the highest common factor: $12x^2-27=3(4x^2-9)$. The bracket that is left is smaller and easier to factorise.' },
      { title: 'Trinomials with a leading coefficient of 1', body: 'To factorise $x^2+bx+c$ find two numbers with product $c$ and sum $b$. For $x^2+7x+12$ the numbers are $3$ and $4$, so $x^2+7x+12=(x+3)(x+4)$.' },
      { title: 'Other leading coefficients and special forms', body: 'For $ax^2+bx+c$ look for two numbers with product $ac$ and sum $b$, split the middle term, then group in pairs. A difference of two squares, $a^2-b^2$, always factorises as $(a-b)(a+b)$.' }
    ],
    definitions: [
      { term: 'Quadratic trinomial', meaning: 'An expression of the form $ax^2+bx+c$ with $a\\ne0$.' },
      { term: 'Difference of two squares', meaning: 'An expression of the form $a^2-b^2$, where both terms are perfect squares and the sign between them is a minus.' }
    ],
    formulas: [
      { label: 'Monic trinomial', tex: 'x^2+(p+q)x+pq=(x+p)(x+q)' },
      { label: 'Difference of two squares', tex: 'a^2-b^2=(a-b)(a+b)' },
      { label: 'Perfect squares', tex: 'a^2\\pm2ab+b^2=(a\\pm b)^2' }
    ],
    points: [
      { front: 'Factorise $x^2-5x+6$.', back: '$(x-2)(x-3)$. The numbers multiply to $6$ and add to $-5$.' },
      { front: 'Factorise $x^2-49$.', back: '$(x-7)(x+7)$, a difference of two squares.' },
      { front: 'How can an answer be checked?', back: 'Expand the brackets. You must return to the original expression.' },
      { front: 'When the constant term is negative, what do the two numbers look like?', back: 'They have opposite signs, because their product is negative.' }
    ],
    mistakes: [
      { wrong: '$4x^2-36=(2x-6)(2x+6)$ and stop.', right: 'This is correct but incomplete. Take out the common factor first: $4(x^2-9)=4(x-3)(x+3)$.' },
      { wrong: '$x^2+9=(x+3)(x-3)$.', right: 'Expanding gives $x^2-9$. A sum of two squares does not factorise over the real numbers.' }
    ],
    examples: [
      {
        question: 'Factorise $x^2+7x+12$.',
        steps: ['Find two numbers with product $12$ and sum $7$: they are $3$ and $4$.', 'Write the brackets: $(x+3)(x+4)$.', 'Check by expanding: $x^2+4x+3x+12=x^2+7x+12$.'],
        answer: '$(x+3)(x+4)$',
        verify: { kind: 'equivalent', a: 'x^2+7*x+12', b: '(x+3)*(x+4)' }
      },
      {
        question: 'Factorise $2x^2+7x+3$.',
        steps: ['Multiply $a$ and $c$: $2\\times3=6$. The numbers with product $6$ and sum $7$ are $1$ and $6$.', 'Split the middle term: $2x^2+x+6x+3$.', 'Group in pairs: $x(2x+1)+3(2x+1)=(2x+1)(x+3)$.'],
        answer: '$(2x+1)(x+3)$',
        verify: { kind: 'equivalent', a: '2*x^2+7*x+3', b: '(2*x+1)*(x+3)' }
      },
      {
        question: 'Factorise $12x^2-27$ completely.',
        steps: ['The common factor is $3$: $3(4x^2-9)$.', 'The bracket is a difference of two squares, $(2x)^2-3^2$.', 'So $3(2x-3)(2x+3)$.'],
        answer: '$3(2x-3)(2x+3)$',
        verify: { kind: 'equivalent', a: '12*x^2-27', b: '3*(2*x-3)*(2*x+3)' }
      }
    ]
  },

  'ma5-alg-p-02': {
    summary: 'An algebraic fraction has algebra in the numerator, the denominator or both. The skills are the same as for number fractions, but factorising comes first, because only factors can be cancelled.',
    prereqs: ['ma5-alg-p-01', 'ma4-frc-c-01'],
    concepts: [
      { title: 'Simplify by cancelling common factors', body: 'Factorise the numerator and the denominator, then cancel factors that appear in both. $\\dfrac{x^2-9}{x^2+3x}=\\dfrac{(x-3)(x+3)}{x(x+3)}=\\dfrac{x-3}{x}$.' },
      { title: 'Add and subtract over a common denominator', body: 'Find the lowest common denominator, rewrite each fraction over it, then combine the numerators. Keep the denominator in factorised form until the end.' },
      { title: 'Multiply and divide', body: 'To multiply, factorise everything and cancel across the whole product. To divide, multiply by the reciprocal of the second fraction.' }
    ],
    definitions: [
      { term: 'Algebraic fraction', meaning: 'A fraction whose numerator or denominator contains a variable. It is undefined for any value that makes the denominator zero.' },
      { term: 'Lowest common denominator', meaning: 'The simplest expression that every denominator divides into exactly.' }
    ],
    formulas: [
      { label: 'Adding fractions', tex: '\\frac{a}{b}+\\frac{c}{d}=\\frac{ad+bc}{bd}' },
      { label: 'Dividing fractions', tex: '\\frac{a}{b}\\div\\frac{c}{d}=\\frac{a}{b}\\times\\frac{d}{c}=\\frac{ad}{bc}' }
    ],
    points: [
      { front: 'Which values of $x$ are excluded from $\\dfrac{1}{x-2}$?', back: '$x=2$, because it makes the denominator zero.' },
      { front: 'Simplify $\\dfrac{6x}{9x^2}$.', back: '$\\dfrac{2}{3x}$. Divide the top and bottom by $3x$.' },
      { front: 'What may be cancelled?', back: 'Only factors that multiply the whole numerator and the whole denominator. Never terms that are added or subtracted.' },
      { front: 'The first step in simplifying a fraction with quadratics', back: 'Factorise the numerator and the denominator.' }
    ],
    mistakes: [
      { wrong: '$\\dfrac{x+3}{3}=x+1$.', right: 'The $3$ in the numerator is a term, not a factor. The fraction cannot be simplified further.' },
      { wrong: '$\\dfrac{1}{a}+\\dfrac{1}{b}=\\dfrac{1}{a+b}$.', right: 'Use a common denominator: $\\dfrac{b}{ab}+\\dfrac{a}{ab}=\\dfrac{a+b}{ab}$.' }
    ],
    examples: [
      {
        question: 'Simplify $\\dfrac{x^2-9}{x^2+3x}$.',
        steps: ['Factorise the numerator: $(x-3)(x+3)$.', 'Factorise the denominator: $x(x+3)$.', 'Cancel the common factor $x+3$ to leave $\\dfrac{x-3}{x}$.'],
        answer: '$\\dfrac{x-3}{x}$',
        verify: { kind: 'equivalent', a: '(x^2-9)/(x^2+3*x)', b: '(x-3)/x' }
      },
      {
        question: 'Write $\\dfrac{1}{x+1}+\\dfrac{2}{x-1}$ as a single fraction.',
        steps: ['The common denominator is $(x+1)(x-1)$.', 'Rewrite: $\\dfrac{(x-1)+2(x+1)}{(x+1)(x-1)}$.', 'Collect the numerator: $x-1+2x+2=3x+1$.'],
        answer: '$\\dfrac{3x+1}{(x+1)(x-1)}$',
        verify: { kind: 'equivalent', a: '1/(x+1)+2/(x-1)', b: '(3*x+1)/((x+1)*(x-1))' }
      },
      {
        question: 'Simplify $\\dfrac{x^2-4}{x+5}\\div\\dfrac{x+2}{3x+15}$.',
        steps: ['Multiply by the reciprocal: $\\dfrac{x^2-4}{x+5}\\times\\dfrac{3x+15}{x+2}$.', 'Factorise: $\\dfrac{(x-2)(x+2)}{x+5}\\times\\dfrac{3(x+5)}{x+2}$.', 'Cancel $x+2$ and $x+5$ to leave $3(x-2)$.'],
        answer: '$3(x-2)$',
        verify: { kind: 'equivalent', a: '((x^2-4)/(x+5))/((x+2)/(3*x+15))', b: '3*(x-2)' }
      }
    ]
  },

  'ma5-are-p-01': {
    summary: 'Surface area is the total area of the outside of a solid. Cones, spheres and solids built from several shapes need a formula for each curved part, and care about which faces are actually exposed.',
    prereqs: ['ma5-are-c-01', 'ma4-pyt-c-01'],
    concepts: [
      { title: 'Cones and the slant height', body: 'The curved surface of a cone is a sector of a circle. Its area uses the slant height $l$, not the vertical height $h$. By Pythagoras, $l=\\sqrt{r^2+h^2}$.' },
      { title: 'Spheres and hemispheres', body: 'A sphere of radius $r$ has surface area $4\\pi r^2$. A solid hemisphere has half of that curved surface, $2\\pi r^2$, plus its flat circular face $\\pi r^2$.' },
      { title: 'Composite solids', body: 'Add the area of every surface that can be touched from outside. A face where two solids are joined is hidden, so it is left out of both.' }
    ],
    definitions: [
      { term: 'Slant height', meaning: 'The distance along the curved surface of a cone from the apex to the edge of its base.' },
      { term: 'Surface area', meaning: 'The total area of all the faces and curved surfaces of a solid, measured in square units.' }
    ],
    formulas: [
      { label: 'Sphere', tex: 'A=4\\pi r^2' },
      { label: 'Closed cone', tex: 'A=\\pi r^2+\\pi r l,\\qquad l=\\sqrt{r^2+h^2}' },
      { label: 'Closed cylinder', tex: 'A=2\\pi r^2+2\\pi r h' }
    ],
    points: [
      { front: 'The curved surface area of a cone', back: '$\\pi r l$, where $l$ is the slant height.' },
      { front: 'Surface area of a sphere of radius $1$', back: '$4\\pi$.' },
      { front: 'Units of surface area', back: 'Square units, such as $\\text{cm}^2$ or $\\text{m}^2$.' },
      { front: 'A cone has $r=5$ and $h=12$. What is $l$?', back: '$13$, since $\\sqrt{25+144}=13$.' }
    ],
    mistakes: [
      { wrong: 'Using the vertical height in $\\pi r l$.', right: 'The formula needs the slant height. Find it first with $l=\\sqrt{r^2+h^2}$.' },
      { wrong: 'Adding the full circle where a hemisphere sits on a cylinder.', right: 'That circle is joined and hidden. Leave it out of both solids.' }
    ],
    examples: [
      {
        question: 'Find the total surface area of a closed cone with radius $5$ cm and vertical height $12$ cm, in terms of $\\pi$.',
        steps: ['The slant height is $l=\\sqrt{5^2+12^2}=13$.', 'The base is $\\pi\\times5^2=25\\pi$ and the curved surface is $\\pi\\times5\\times13=65\\pi$.', 'The total is $25\\pi+65\\pi=90\\pi$.'],
        answer: '$90\\pi\\text{ cm}^2$',
        verify: { kind: 'value', expr: 'pi*5^2+pi*5*sqrt(5^2+12^2)', answer: '90*pi' }
      },
      {
        question: 'Find the surface area of a sphere of radius $3$ m, correct to one decimal place.',
        steps: ['Use $A=4\\pi r^2$ with $r=3$: $4\\pi\\times9=36\\pi$.', 'Evaluate: $36\\pi\\approx113.1$.'],
        answer: '$36\\pi\\approx113.1\\text{ m}^2$',
        verify: { kind: 'value', expr: '4*pi*3^2', answer: '113.0973355' }
      },
      {
        question: 'A model has a cylinder of radius $3$ cm and height $10$ cm with a hemisphere on top. Find the total outside surface area, including the base, in terms of $\\pi$.',
        steps: ['Base: $\\pi\\times3^2=9\\pi$. Side of the cylinder: $2\\pi\\times3\\times10=60\\pi$.', 'Curved surface of the hemisphere: $2\\pi\\times3^2=18\\pi$. The joining circle is hidden.', 'Total: $9\\pi+60\\pi+18\\pi=87\\pi$.'],
        answer: '$87\\pi\\text{ cm}^2$',
        verify: { kind: 'value', expr: 'pi*3^2+2*pi*3*10+2*pi*3^2', answer: '87*pi' }
      }
    ]
  },

  'ma5-cir-p-01': {
    summary: 'Circle geometry gives exact relationships between angles, chords and tangents. Each relationship is a theorem, so it can be used as a reason in a numerical problem or a proof.',
    prereqs: ['ma5-geo-c-01', 'ma4-ang-c-01'],
    concepts: [
      { title: 'Angles standing on the same arc', body: 'The angle at the centre is twice the angle at the circumference on the same arc. Angles at the circumference on the same arc are equal, and an angle in a semicircle is $90^\\circ$.' },
      { title: 'Cyclic quadrilaterals', body: 'When all four vertices of a quadrilateral lie on a circle, opposite angles add to $180^\\circ$. Each exterior angle equals the interior opposite angle.' },
      { title: 'Tangents', body: 'A tangent touches a circle at one point and is perpendicular to the radius at that point. Two tangents drawn from the same external point are equal in length.' }
    ],
    definitions: [
      { term: 'Cyclic quadrilateral', meaning: 'A quadrilateral whose four vertices all lie on one circle.' },
      { term: 'Tangent', meaning: 'A line that touches a circle at exactly one point, called the point of contact.' }
    ],
    formulas: [
      { label: 'Angle at the centre', tex: '\\text{angle at the centre}=2\\times\\text{angle at the circumference}' },
      { label: 'Cyclic quadrilateral', tex: '\\angle A+\\angle C=180^\\circ,\\qquad \\angle B+\\angle D=180^\\circ' }
    ],
    points: [
      { front: 'An angle in a semicircle', back: '$90^\\circ$, because the diameter is an arc with centre angle $180^\\circ$.' },
      { front: 'The radius and the tangent at the point of contact', back: 'They meet at $90^\\circ$.' },
      { front: 'Which angles of a cyclic quadrilateral add to $180^\\circ$?', back: 'Opposite angles, not adjacent ones.' },
      { front: 'Why are two tangents from one point equal?', back: 'The two right-angled triangles share the hypotenuse and have equal radii, so they are congruent by RHS.' }
    ],
    mistakes: [
      { wrong: 'The angle at the centre is twice the angle at the circumference, whichever arc each stands on.', right: 'Both angles must stand on the same arc. The theorem is false if they stand on different arcs.' },
      { wrong: 'Adjacent angles of a cyclic quadrilateral add to $180^\\circ$.', right: 'Only opposite angles do: $A+C=180^\\circ$ and $B+D=180^\\circ$.' }
    ],
    examples: [
      {
        question: 'The angle at the centre of a circle standing on an arc is $120^\\circ$. What is the angle at the circumference standing on the same arc?',
        steps: ['The angle at the centre is twice the angle at the circumference.', 'So the angle at the circumference is $120^\\circ\\div2=60^\\circ$.'],
        answer: '$60^\\circ$',
        verify: { kind: 'value', expr: '120/2', answer: '60' }
      },
      {
        question: 'In cyclic quadrilateral $ABCD$, $\\angle A=78^\\circ$ and $\\angle B=95^\\circ$. Find $\\angle C$ and $\\angle D$.',
        steps: ['Opposite angles are supplementary, so $\\angle C=180^\\circ-78^\\circ=102^\\circ$.', 'Similarly $\\angle D=180^\\circ-95^\\circ=85^\\circ$.', 'Check: the four angles sum to $78+95+102+85=360^\\circ$.'],
        answer: '$\\angle C=102^\\circ,\\ \\angle D=85^\\circ$',
        verify: { kind: 'values', pairs: [['180-78', '102'], ['180-95', '85'], ['78+95+102+85', '360']] }
      },
      {
        question: 'Centre $O$, and $PT$ is a tangent at $T$. If $\\angle TOP=50^\\circ$, find $\\angle OPT$.',
        steps: ['The radius $OT$ is perpendicular to the tangent, so $\\angle OTP=90^\\circ$.', 'The angles of triangle $OTP$ add to $180^\\circ$.', '$\\angle OPT=180^\\circ-90^\\circ-50^\\circ=40^\\circ$.'],
        answer: '$40^\\circ$',
        verify: { kind: 'value', expr: '180-90-50', answer: '40' }
      }
    ]
  },

  'ma5-dat-p-01': {
    summary: 'Two data sets can have the same centre and still behave very differently. The standard deviation measures typical distance from the mean, and together with the interquartile range it lets two distributions be compared fairly.',
    prereqs: ['ma5-dat-c-01', 'ma5-dat-c-02'],
    concepts: [
      { title: 'Spread about the mean', body: 'Each value is a distance, or deviation, from the mean. The deviations add to zero, so they are squared first, averaged, and the square root is taken. The result is the standard deviation.' },
      { title: 'Comparing two data sets', body: 'Compare the centre (mean or median) and the spread (standard deviation or interquartile range) in the context. A smaller spread means the values are more consistent.' },
      { title: 'Resistant measures', body: 'An extreme value pulls the mean and the standard deviation a long way. The median and the interquartile range barely move, so they describe skewed data better.' }
    ],
    definitions: [
      { term: 'Standard deviation', meaning: 'A measure of spread: the square root of the mean of the squared deviations from the mean. It has the same units as the data.' },
      { term: 'Interquartile range', meaning: 'The spread of the middle half of the data, $Q_3-Q_1$.' }
    ],
    formulas: [
      { label: 'Standard deviation of $n$ values', tex: '\\sigma=\\sqrt{\\dfrac{\\sum (x-\\bar{x})^2}{n}}' },
      { label: 'Interquartile range', tex: '\\text{IQR}=Q_3-Q_1' }
    ],
    points: [
      { front: 'What does a larger standard deviation tell you?', back: 'The values are more spread out about the mean.' },
      { front: 'Can a standard deviation be negative?', back: 'No. It is a square root, so it is zero or positive. It is zero only when every value is equal.' },
      { front: 'Which two measures are not affected much by an outlier?', back: 'The median and the interquartile range.' },
      { front: 'A calculator shows two standard deviations. Which one is $\\sigma$?', back: 'The population standard deviation, which divides by $n$. The sample version divides by $n-1$.' }
    ],
    mistakes: [
      { wrong: 'The standard deviation is the average distance below the mean, so the deviations are added and divided by $n$.', right: 'The deviations from the mean add to zero. Square each one first, then average, then take the square root.' },
      { wrong: 'Team A has the larger standard deviation, so Team A has the higher scores.', right: 'Standard deviation measures spread, not size. Compare the means for the level of scores.' }
    ],
    examples: [
      {
        question: 'Find the mean and the standard deviation of $2,4,4,4,5,5,7,9$.',
        steps: ['The mean is $\\bar{x}=\\dfrac{40}{8}=5$.', 'The squared deviations are $9,1,1,1,0,0,4,16$, which sum to $32$.', 'The standard deviation is $\\sqrt{32\\div8}=\\sqrt{4}=2$.'],
        answer: '$\\bar{x}=5,\\ \\sigma=2$',
        verify: { kind: 'values', pairs: [['(2+4+4+4+5+5+7+9)/8', '5'], ['sqrt(((2-5)^2+(4-5)^2+(4-5)^2+(4-5)^2+(5-5)^2+(5-5)^2+(7-5)^2+(9-5)^2)/8)', '2']] }
      },
      {
        question: 'Team A scored $10,12,14,16,18$ and Team B scored $13,14,14,14,15$. Both have mean $14$. Compare their standard deviations.',
        steps: ['Team A: squared deviations $16,4,0,4,16$ sum to $40$, so $\\sigma=\\sqrt{40\\div5}=\\sqrt{8}\\approx2.83$.', 'Team B: squared deviations $1,0,0,0,1$ sum to $2$, so $\\sigma=\\sqrt{2\\div5}\\approx0.63$.', 'Team B is far more consistent, although the two teams have the same mean.'],
        answer: '$\\sigma_A=\\sqrt{8}\\approx2.83$ and $\\sigma_B=\\sqrt{0.4}\\approx0.63$; Team B has the smaller standard deviation, so it is more consistent',
        verify: { kind: 'values', pairs: [['sqrt((16+4+0+4+16)/5)', '2*sqrt(2)'], ['sqrt((1+0+0+0+1)/5)', 'sqrt(2/5)']] }
      },
      {
        question: 'Find the interquartile range of $4,7,9,10,12,15,18$.',
        steps: ['The median is $10$, the middle of the seven values.', 'The lower half is $4,7,9$ so $Q_1=7$. The upper half is $12,15,18$ so $Q_3=15$.', '$\\text{IQR}=15-7=8$.'],
        answer: '$8$',
        verify: { kind: 'value', expr: '15-7', answer: '8' }
      }
    ]
  },

  'ma5-equ-p-01': {
    summary: 'A quadratic equation can have two solutions, one or none. When it factorises, the null factor law turns it into two simple equations, and the graph shows the solutions as the places the parabola crosses the horizontal axis.',
    prereqs: ['ma5-alg-p-01', 'ma5-equ-c-01'],
    concepts: [
      { title: 'Write it equal to zero first', body: 'Move every term to one side so the equation reads $ax^2+bx+c=0$. Only then can the null factor law be used.' },
      { title: 'The null factor law', body: 'If two numbers multiply to zero, at least one of them is zero. So $(x-7)(x+2)=0$ gives $x=7$ or $x=-2$.' },
      { title: 'Solutions in context', body: 'In a word problem a solution must make sense. A length cannot be negative, so reject any root that does not fit and say why.' }
    ],
    definitions: [
      { term: 'Quadratic equation', meaning: 'An equation that can be written as $ax^2+bx+c=0$ with $a\\ne0$.' },
      { term: 'Root', meaning: 'A value of the variable that makes the equation true. On the graph of $y=ax^2+bx+c$ it is an $x$-intercept.' }
    ],
    formulas: [
      { label: 'Null factor law', tex: 'pq=0\\ \\Longrightarrow\\ p=0\\ \\text{or}\\ q=0' },
      { label: 'Standard form', tex: 'ax^2+bx+c=0' }
    ],
    points: [
      { front: 'Solve $x(x-4)=0$.', back: '$x=0$ or $x=4$.' },
      { front: 'Why can you not divide both sides of $x^2=5x$ by $x$?', back: 'It loses the solution $x=0$. Write $x^2-5x=0$ and factorise.' },
      { front: 'How many real solutions can a quadratic equation have?', back: 'Two, one or none.' },
      { front: 'How can you check a solution?', back: 'Substitute it back into the original equation, not the factorised one.' }
    ],
    mistakes: [
      { wrong: '$x(x+3)=40$ so $x=40$ or $x+3=40$.', right: 'The null factor law needs a product equal to zero. Write $x^2+3x-40=0$ first.' },
      { wrong: '$x^2=5x$ so $x=5$.', right: 'Divide by $x$ and you lose a root. $x(x-5)=0$ gives $x=0$ or $x=5$.' }
    ],
    examples: [
      {
        question: 'Solve $x^2-5x-14=0$.',
        steps: ['Two numbers with product $-14$ and sum $-5$ are $-7$ and $2$.', 'Factorise: $(x-7)(x+2)=0$.', 'So $x=7$ or $x=-2$.'],
        answer: '$x=7$ or $x=-2$',
        verify: { kind: 'roots', f: 'x^2-5*x-14', answers: ['7', '-2'] }
      },
      {
        question: 'Solve $2x^2=3x+9$.',
        steps: ['Rearrange to equal zero: $2x^2-3x-9=0$.', 'Factorise: $(2x+3)(x-3)=0$.', 'So $x=-\\tfrac{3}{2}$ or $x=3$.'],
        answer: '$x=-\\tfrac{3}{2}$ or $x=3$',
        verify: { kind: 'roots', f: '2*x^2-3*x-9', answers: ['-3/2', '3'] }
      },
      {
        question: 'The length of a rectangle is $3$ cm more than its width, and its area is $40\\text{ cm}^2$. Find the width.',
        steps: ['Let the width be $x$. Then $x(x+3)=40$, so $x^2+3x-40=0$.', 'Factorise: $(x+8)(x-5)=0$, so $x=-8$ or $x=5$.', 'A width cannot be negative, so the width is $5$ cm and the length is $8$ cm.'],
        answer: 'The width is $5$ cm.',
        verify: { kind: 'roots', f: 'x^2+3*x-40', answers: ['5', '-8'] }
      }
    ]
  },

  'ma5-equ-p-02': {
    summary: 'Not every quadratic equation factorises neatly. Completing the square and the quadratic formula solve any quadratic equation exactly, and the discriminant tells you how many real solutions to expect before you start.',
    prereqs: ['ma5-equ-p-01', 'ma5-nli-c-02'],
    concepts: [
      { title: 'Completing the square', body: 'Rewrite $x^2+bx$ as $\\left(x+\\tfrac{b}{2}\\right)^2-\\tfrac{b^2}{4}$. The equation then becomes a square equal to a number, which is solved by taking square roots, remembering both signs.' },
      { title: 'The quadratic formula', body: 'For $ax^2+bx+c=0$ the solutions are $x=\\dfrac{-b\\pm\\sqrt{b^2-4ac}}{2a}$. It is completing the square done once, in general.' },
      { title: 'The discriminant', body: 'The expression under the root, $\\Delta=b^2-4ac$, decides the number of real solutions: two if it is positive, one if it is zero, none if it is negative.' }
    ],
    definitions: [
      { term: 'Discriminant', meaning: 'The quantity $\\Delta=b^2-4ac$ for $ax^2+bx+c=0$.' },
      { term: 'Completing the square', meaning: 'Rewriting a quadratic expression as a perfect square plus or minus a constant.' }
    ],
    formulas: [
      { label: 'Quadratic formula', tex: 'x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}' },
      { label: 'Completing the square', tex: 'x^2+bx=\\left(x+\\frac{b}{2}\\right)^2-\\frac{b^2}{4}' },
      { label: 'Discriminant', tex: '\\Delta=b^2-4ac' }
    ],
    points: [
      { front: 'When $\\Delta=0$, how many solutions?', back: 'One repeated solution. The parabola touches the axis.' },
      { front: 'When $\\Delta<0$, how many real solutions?', back: 'None. The parabola does not meet the axis.' },
      { front: 'The first step before using the formula', back: 'Write the equation as $ax^2+bx+c=0$ and read off $a$, $b$ and $c$ with their signs.' },
      { front: 'Why is an answer like $-3\\pm\\sqrt{7}$ useful?', back: 'It is exact. Round only at the end, if the question asks for it.' }
    ],
    mistakes: [
      { wrong: '$x=-b\\pm\\dfrac{\\sqrt{b^2-4ac}}{2a}$.', right: 'The fraction bar covers the whole numerator and the denominator $2a$ divides both parts.' },
      { wrong: 'For $2x^2=5x+1$ take $b=5$ and $c=1$.', right: 'Rearrange to $2x^2-5x-1=0$ first. Then $b=-5$ and $c=-1$.' }
    ],
    examples: [
      {
        question: 'Solve $x^2+6x+2=0$ by completing the square.',
        steps: ['Move the constant: $x^2+6x=-2$.', 'Add $\\left(\\tfrac{6}{2}\\right)^2=9$ to both sides: $(x+3)^2=7$.', 'Take roots: $x+3=\\pm\\sqrt{7}$, so $x=-3\\pm\\sqrt{7}$.'],
        answer: '$x=-3+\\sqrt{7}$ or $x=-3-\\sqrt{7}$',
        verify: { kind: 'roots', f: 'x^2+6*x+2', answers: ['-3+sqrt(7)', '-3-sqrt(7)'] }
      },
      {
        question: 'Solve $2x^2-5x-1=0$ using the quadratic formula.',
        steps: ['Here $a=2$, $b=-5$ and $c=-1$.', 'The discriminant is $\\Delta=(-5)^2-4(2)(-1)=25+8=33$.', 'So $x=\\dfrac{5\\pm\\sqrt{33}}{4}$, which is about $2.69$ or $-0.19$.'],
        answer: '$x=\\dfrac{5\\pm\\sqrt{33}}{4}$',
        verify: { kind: 'roots', f: '2*x^2-5*x-1', answers: ['(5+sqrt(33))/4', '(5-sqrt(33))/4'] }
      },
      {
        question: 'How many real solutions does $3x^2-2x+5=0$ have?',
        steps: ['Here $a=3$, $b=-2$ and $c=5$.', '$\\Delta=(-2)^2-4(3)(5)=4-60=-56$.', 'The discriminant is negative, so there are no real solutions.'],
        answer: 'None, because $\\Delta=-56<0$.',
        verify: { kind: 'value', expr: '(-2)^2-4*3*5', answer: '-56' }
      }
    ]
  },

  'ma5-fnc-p-01': {
    summary: 'A function gives exactly one output for each input. Function notation makes substitution precise, and the graphs of hyperbolas, circles and exponentials show how different families behave and where they are undefined.',
    prereqs: ['ma5-nli-c-01', 'ma5-lin-c-01'],
    concepts: [
      { title: 'Function notation', body: 'The symbol $f(x)$ means the output of $f$ for input $x$. If $f(x)=3x^2-2x+1$ then $f(-2)=3(4)+4+1=17$. Replace every $x$, keeping brackets.' },
      { title: 'Domain and range', body: 'The domain is every input the function accepts and the range is every output it produces. The vertical line test checks that an input never has two outputs.' },
      { title: 'Other graph families', body: 'A hyperbola $y=\\tfrac{k}{x}$ has asymptotes on both axes. A circle with centre the origin is $x^2+y^2=r^2$. An exponential $y=a^x$ is always positive and passes through $(0,1)$.' }
    ],
    definitions: [
      { term: 'Function', meaning: 'A rule that gives exactly one output for each allowed input.' },
      { term: 'Asymptote', meaning: 'A line that a curve approaches more and more closely but never touches.' }
    ],
    formulas: [
      { label: 'Hyperbola', tex: 'y=\\frac{k}{x},\\quad x\\ne0' },
      { label: 'Circle, centre the origin', tex: 'x^2+y^2=r^2' },
      { label: 'Exponential', tex: 'y=a^x\\quad(a>0,\\ a\\ne1)' }
    ],
    points: [
      { front: 'Is $x^2+y^2=25$ a function of $x$?', back: 'No. The input $x=3$ gives both $y=4$ and $y=-4$.' },
      { front: 'What input is excluded from $y=\\tfrac{6}{x}$?', back: '$x=0$, because division by zero is undefined.' },
      { front: 'The range of $y=2^x$', back: 'All positive numbers, $y>0$.' },
      { front: 'What does $f(a+1)$ mean?', back: 'Put $a+1$ into every position of $x$ in the rule for $f$.' }
    ],
    mistakes: [
      { wrong: 'If $f(x)=x^2$ then $f(x+2)=x^2+2$.', right: 'Substitute $x+2$ for $x$: $f(x+2)=(x+2)^2=x^2+4x+4$.' },
      { wrong: 'The graph of $y=\\tfrac{6}{x}$ crosses the axes far away.', right: 'It never meets either axis. The axes are its asymptotes.' }
    ],
    examples: [
      {
        question: 'If $f(x)=3x^2-2x+1$, find $f(-2)$.',
        steps: ['Replace $x$ with $(-2)$: $3(-2)^2-2(-2)+1$.', 'Evaluate: $12+4+1=17$.'],
        answer: '$17$',
        verify: { kind: 'value', expr: '3*(-2)^2-2*(-2)+1', answer: '17' }
      },
      {
        question: 'For $f(x)=\\tfrac{6}{x}$, find $f(3)$ and solve $f(x)=-4$.',
        steps: ['$f(3)=\\tfrac{6}{3}=2$.', 'Solve $\\tfrac{6}{x}=-4$: multiply by $x$ to get $6=-4x$.', 'So $x=-\\tfrac{3}{2}$.'],
        answer: '$f(3)=2$ and $x=-\\tfrac{3}{2}$',
        verify: { kind: 'roots', f: '6/x+4', answers: ['-3/2'] }
      },
      {
        question: 'Show that $(3,4)$ lies on the circle $x^2+y^2=25$ and find the other value of $y$ when $x=3$.',
        steps: ['Substitute: $3^2+4^2=9+16=25$, so the point lies on the circle.', 'When $x=3$, $y^2=25-9=16$.', 'So $y=4$ or $y=-4$.'],
        answer: '$(3,4)$ lies on the circle since $3^2+4^2=25$; $y=4$ or $y=-4$, so the other value of $y$ is $-4$',
        verify: { kind: 'roots', f: 'y^2-16', answers: ['4', '-4'], var: 'y' }
      }
    ]
  },

  'ma5-geo-p-02': {
    summary: 'Two figures are congruent when one fits exactly on the other. Four tests prove triangles congruent, and once they are, every pair of corresponding sides and angles is equal. That is how geometric facts are proved.',
    prereqs: ['ma5-geo-c-01', 'ma4-geo-c-01'],
    concepts: [
      { title: 'The four congruence tests', body: 'Triangles are congruent if three pairs of sides are equal (SSS), two pairs of sides and the included angle (SAS), two angles and a corresponding side (AAS), or, for right-angled triangles, the hypotenuse and one other side (RHS).' },
      { title: 'Corresponding parts', body: 'Name congruent triangles with the vertices in matching order. Then $\\triangle ABC\\equiv\\triangle PQR$ tells you that $A$ matches $P$, $B$ matches $Q$ and $C$ matches $R$.' },
      { title: 'Writing a proof', body: 'Give each statement with its reason, state the test, then use the congruence to reach the conclusion. A fact is only established when its reason is stated.' }
    ],
    definitions: [
      { term: 'Congruent figures', meaning: 'Figures with the same shape and size, so that one can be moved to fit exactly on the other.' },
      { term: 'Included angle', meaning: 'The angle between two given sides.' }
    ],
    formulas: [
      { label: 'Congruence notation', tex: '\\triangle ABC\\equiv\\triangle PQR\\quad(\\text{SSS, SAS, AAS or RHS})' },
      { label: 'Isosceles triangle', tex: 'AB=AC\\ \\Longrightarrow\\ \\angle B=\\angle C' }
    ],
    points: [
      { front: 'Why is SSA not a congruence test?', back: 'Two sides and a non-included angle can fit two different triangles.' },
      { front: 'Why is AAA not a congruence test?', back: 'Equal angles give the same shape but any size. The triangles are similar, not necessarily congruent.' },
      { front: 'What does RHS stand for?', back: 'Right angle, hypotenuse, side: a test for right-angled triangles only.' },
      { front: 'Once triangles are congruent, what follows?', back: 'All corresponding sides and angles are equal. State this as the reason: corresponding parts of congruent triangles.' }
    ],
    mistakes: [
      { wrong: 'Triangles with the same three angles are congruent by AAA.', right: 'They are similar. At least one pair of equal sides is needed for congruence.' },
      { wrong: 'Two sides and any angle are enough to prove congruence.', right: 'The angle must lie between the two sides (SAS). Otherwise it is the ambiguous SSA case.' }
    ],
    examples: [
      {
        question: 'Triangle $ABC$ is congruent to triangle $PQR$, with $\\angle A=62^\\circ$ and $\\angle B=48^\\circ$. Find $\\angle R$.',
        steps: ['$A$ matches $P$ and $B$ matches $Q$, so $C$ matches $R$ and $\\angle R=\\angle C$.', '$\\angle C=180^\\circ-62^\\circ-48^\\circ=70^\\circ$.'],
        answer: '$\\angle R=70^\\circ$',
        verify: { kind: 'value', expr: '180-62-48', answer: '70' }
      },
      {
        question: '$ABCD$ is a parallelogram with $AB=8$ cm and perpendicular height $5$ cm. Prove that the diagonal $AC$ divides it into two equal triangles and find the area of each.',
        steps: ['In triangles $ABC$ and $CDA$: $AB=CD$ and $BC=DA$ (opposite sides), and $AC$ is common, so they are congruent by SSS.', 'Congruent triangles have equal area, so each is half of the parallelogram.', 'Parallelogram: $8\\times5=40$. Each triangle: $\\tfrac{1}{2}\\times8\\times5=20$ square centimetres.'],
        answer: 'Each triangle has area $20\\text{ cm}^2$.',
        verify: { kind: 'values', pairs: [['8*5', '40'], ['1/2*8*5', '20']] }
      },
      {
        question: 'In triangle $ABC$, $AB=AC$ and $\\angle A=40^\\circ$. Prove that $\\angle B=\\angle C$ and find them.',
        steps: ['Let $M$ be the midpoint of $BC$. Then $AB=AC$, $BM=CM$ and $AM$ is common, so $\\triangle ABM\\equiv\\triangle ACM$ by SSS.', 'Hence $\\angle B=\\angle C$ (corresponding angles).', 'So $\\angle B=\\angle C=(180^\\circ-40^\\circ)\\div2=70^\\circ$.'],
        answer: '$\\angle B=\\angle C=70^\\circ$',
        verify: { kind: 'value', expr: '(180-40)/2', answer: '70' }
      }
    ]
  },

  'ma5-geo-p-01': {
    summary: 'Similar figures have the same shape but different sizes. Matching angles and a constant ratio of corresponding sides let you find lengths that cannot be measured directly, and the scale factor links lengths, areas and volumes.',
    prereqs: ['ma5-geo-c-01'],
    concepts: [
      { title: 'Tests for similar triangles', body: 'Two triangles are similar if two pairs of angles are equal (AA), or the three pairs of sides are in the same ratio, or two pairs of sides are in the same ratio with the included angles equal.' },
      { title: 'Scale factor', body: 'If a figure is enlarged by scale factor $k$, every length is multiplied by $k$. Corresponding sides are the ones opposite equal angles.' },
      { title: 'Areas and volumes', body: 'Areas scale by $k^2$ and volumes by $k^3$. Doubling every length multiplies the area by $4$ and the volume by $8$.' }
    ],
    definitions: [
      { term: 'Similar figures', meaning: 'Figures with equal corresponding angles and corresponding sides in the same ratio.' },
      { term: 'Scale factor', meaning: 'The number by which every length of one figure is multiplied to give the corresponding length of a similar figure.' }
    ],
    formulas: [
      { label: 'Corresponding sides', tex: '\\frac{A\'B\'}{AB}=\\frac{B\'C\'}{BC}=\\frac{A\'C\'}{AC}=k' },
      { label: 'Area and volume ratios', tex: '\\frac{A_2}{A_1}=k^2,\\qquad \\frac{V_2}{V_1}=k^3' }
    ],
    points: [
      { front: 'Triangles with sides $3,4,5$ and $9,12,15$', back: 'They are similar with scale factor $3$.' },
      { front: 'If the scale factor is $k=2$, the area scales by', back: '$k^2=4$.' },
      { front: 'Which sides correspond?', back: 'Those opposite equal angles, or those in the same position in the matched vertex order.' },
      { front: 'The shadow method', back: 'The sun makes the same angle at the same time, so the pole and tree triangles are similar.' }
    ],
    mistakes: [
      { wrong: 'A scale factor of $3$ multiplies the area by $3$.', right: 'Area is two-dimensional: it scales by $3^2=9$.' },
      { wrong: 'Setting up the ratio with sides that do not correspond.', right: 'Label equal angles first, then pair the sides opposite them.' }
    ],
    examples: [
      {
        question: 'A triangle with sides $3$ cm, $4$ cm and $5$ cm is similar to a triangle whose shortest side is $9$ cm. Find its other sides.',
        steps: ['The scale factor is $9\\div3=3$.', 'The other sides are $4\\times3=12$ and $5\\times3=15$.'],
        answer: '$12$ cm and $15$ cm',
        verify: { kind: 'values', pairs: [['9/3*4', '12'], ['9/3*5', '15']] }
      },
      {
        question: 'A $2$ m pole casts a $3$ m shadow. At the same time a tree casts a $12$ m shadow. How tall is the tree?',
        steps: ['The two right-angled triangles share the angle of the sun, so they are similar.', 'The scale factor from pole shadow to tree shadow is $12\\div3=4$.', 'Height of the tree: $2\\times4=8$ m.'],
        answer: '$8$ m',
        verify: { kind: 'value', expr: '2/3*12', answer: '8' }
      },
      {
        question: 'Two similar triangles have scale factor $3$. The smaller has area $12\\text{ cm}^2$. Find the area of the larger.',
        steps: ['Areas scale by $k^2=3^2=9$.', '$12\\times9=108$.'],
        answer: '$108\\text{ cm}^2$',
        verify: { kind: 'value', expr: '12*3^2', answer: '108' }
      }
    ]
  },

  'ma5-ind-p-01': {
    summary: 'Negative and fractional indices extend the index laws to reciprocals and roots. They let one notation describe $\\tfrac{1}{x^3}$, $\\sqrt{x}$ and $\\sqrt[3]{x^2}$ and allow all of them to be simplified by the same laws.',
    prereqs: ['ma5-ind-c-01', 'ma4-ind-c-01'],
    concepts: [
      { title: 'Negative indices mean reciprocals', body: 'A negative index does not make the number negative. It takes the reciprocal: $2^{-3}=\\tfrac{1}{2^3}=\\tfrac{1}{8}$.' },
      { title: 'Fractional indices mean roots', body: 'The index $\\tfrac{1}{n}$ means the $n$th root, so $27^{1/3}=3$. For $\\tfrac{m}{n}$ take the root and then the power: $8^{2/3}=(\\sqrt[3]{8})^2=4$.' },
      { title: 'The same laws still apply', body: 'Add indices when multiplying and subtract when dividing the same base. Write every root and reciprocal as an index first, then simplify with the laws.' }
    ],
    definitions: [
      { term: 'Reciprocal', meaning: 'The reciprocal of $a$ is $\\tfrac{1}{a}$. A number times its reciprocal is $1$.' },
      { term: 'Rational index', meaning: 'An index that is a fraction, $\\tfrac{m}{n}$, combining an $n$th root with a power $m$.' }
    ],
    formulas: [
      { label: 'Negative index', tex: 'a^{-n}=\\frac{1}{a^{n}}' },
      { label: 'Fractional index', tex: 'a^{1/n}=\\sqrt[n]{a}' },
      { label: 'Rational index', tex: 'a^{m/n}=\\left(\\sqrt[n]{a}\\right)^{m}=\\sqrt[n]{a^{m}}' }
    ],
    points: [
      { front: '$5^{-2}$', back: '$\\tfrac{1}{25}$.' },
      { front: '$16^{1/2}$ and $16^{1/4}$', back: '$4$ and $2$.' },
      { front: 'A shortcut for $a^{m/n}$ with numbers', back: 'Take the root first so the numbers stay small: $27^{2/3}=3^2=9$.' },
      { front: '$\\left(\\tfrac{2}{3}\\right)^{-1}$', back: '$\\tfrac{3}{2}$. A negative index flips the fraction.' }
    ],
    mistakes: [
      { wrong: '$2^{-3}=-8$.', right: 'The negative sign in the index gives a reciprocal: $2^{-3}=\\tfrac{1}{8}$.' },
      { wrong: '$8^{1/3}=\\tfrac{8}{3}$.', right: 'The index $\\tfrac{1}{3}$ is a cube root, not division: $8^{1/3}=2$.' }
    ],
    examples: [
      {
        question: 'Evaluate $8^{2/3}$.',
        steps: ['Take the cube root first: $\\sqrt[3]{8}=2$.', 'Then square it: $2^2=4$.'],
        answer: '$4$',
        verify: { kind: 'value', expr: '8^(2/3)', answer: '4' }
      },
      {
        question: 'Evaluate $\\left(\\tfrac{9}{4}\\right)^{-1/2}$.',
        steps: ['The negative index flips the fraction: $\\left(\\tfrac{4}{9}\\right)^{1/2}$.', 'The index $\\tfrac{1}{2}$ is a square root: $\\sqrt{\\tfrac{4}{9}}=\\tfrac{2}{3}$.'],
        answer: '$\\tfrac{2}{3}$',
        verify: { kind: 'value', expr: '(9/4)^(-1/2)', answer: '2/3' }
      },
      {
        question: 'Write $\\dfrac{1}{\\sqrt[3]{x^2}}$ using a single index.',
        steps: ['A cube root is the index $\\tfrac{1}{3}$, so $\\sqrt[3]{x^2}=x^{2/3}$.', 'A reciprocal makes the index negative: $\\dfrac{1}{x^{2/3}}=x^{-2/3}$.'],
        answer: '$x^{-2/3}$',
        verify: { kind: 'equivalent', a: '1/x^(2/3)', b: 'x^(-2/3)' }
      }
    ]
  },

  'ma5-ind-p-02': {
    summary: 'A surd is an irrational root such as $\\sqrt{2}$ that is left unevaluated so the answer stays exact. Surds are simplified by pulling out square factors, combined like algebraic terms, and rationalised so no root remains in a denominator.',
    prereqs: ['ma5-ind-p-01', 'ma5-ind-c-01'],
    concepts: [
      { title: 'Simplify by taking out square factors', body: 'Write the number under the root as a perfect square times another number, then split the root: $\\sqrt{72}=\\sqrt{36\\times2}=6\\sqrt{2}$. A surd is simplest when the number under the root has no square factor.' },
      { title: 'Add, subtract, multiply and divide', body: 'Only like surds add or subtract, in the way $3\\sqrt{2}+5\\sqrt{2}=8\\sqrt{2}$. Multiplication and division work on the numbers under the roots: $\\sqrt{a}\\times\\sqrt{b}=\\sqrt{ab}$ and $\\sqrt{a}\\div\\sqrt{b}=\\sqrt{\\tfrac{a}{b}}$.' },
      { title: 'Rationalise the denominator', body: 'Multiply top and bottom by a suitable surd so the denominator is rational. For $\\tfrac{1}{\\sqrt{3}}$ multiply by $\\tfrac{\\sqrt{3}}{\\sqrt{3}}$. For $\\tfrac{1}{a+\\sqrt{b}}$ use the conjugate $a-\\sqrt{b}$, since $(a+\\sqrt{b})(a-\\sqrt{b})=a^2-b$. A root is the index $\\tfrac{1}{2}$, so $\\sqrt{x}=x^{1/2}$.' }
    ],
    definitions: [
      { term: 'Surd', meaning: 'An irrational number written as a root that cannot be simplified to a rational number, such as $\\sqrt{2}$ or $\\sqrt{7}$. The number $\\sqrt{16}=4$ is not a surd.' },
      { term: 'Conjugate', meaning: 'For $a+\\sqrt{b}$ the conjugate is $a-\\sqrt{b}$. Their product $a^2-b$ is rational.' }
    ],
    formulas: [
      { label: 'Product and quotient', tex: '\\sqrt{a}\\times\\sqrt{b}=\\sqrt{ab},\\qquad \\frac{\\sqrt{a}}{\\sqrt{b}}=\\sqrt{\\frac{a}{b}}\\quad(a,b>0)' },
      { label: 'Rationalising', tex: '\\frac{1}{\\sqrt{a}}=\\frac{\\sqrt{a}}{a},\\qquad (a+\\sqrt{b})(a-\\sqrt{b})=a^{2}-b' }
    ],
    points: [
      { front: 'Simplify $\\sqrt{50}$.', back: '$\\sqrt{25\\times2}=5\\sqrt{2}$.' },
      { front: '$\\sqrt{3}\\times\\sqrt{3}$', back: '$3$. A surd times itself is the number under the root.' },
      { front: 'Rationalise $\\dfrac{6}{\\sqrt{3}}$.', back: '$\\dfrac{6\\sqrt{3}}{3}=2\\sqrt{3}$.' },
      { front: 'Write $\\sqrt{5}$ as an index.', back: '$5^{1/2}$, so $\\sqrt{5}\\times\\sqrt{5}=5^{1/2+1/2}=5$.' }
    ],
    mistakes: [
      { wrong: '$\\sqrt{9+16}=\\sqrt{9}+\\sqrt{16}=7$.', right: 'A root does not split over addition. $\\sqrt{9+16}=\\sqrt{25}=5$, not $7$.' },
      { wrong: '$\\sqrt{2}+\\sqrt{3}=\\sqrt{5}$.', right: 'Unlike surds cannot be combined. Numerically $1.414+1.732\\approx3.146$, but $\\sqrt{5}\\approx2.236$.' }
    ],
    examples: [
      {
        question: 'Simplify $\\sqrt{72}$.',
        steps: ['The largest square factor of $72$ is $36$: $72=36\\times2$.', 'Split the root: $\\sqrt{36}\\times\\sqrt{2}=6\\sqrt{2}$.'],
        answer: '$6\\sqrt{2}$',
        verify: { kind: 'equivalent', a: 'sqrt(72)', b: '6*sqrt(2)' }
      },
      {
        question: 'Simplify $3\\sqrt{2}+\\sqrt{50}-\\sqrt{8}$.',
        steps: ['Simplify each surd: $\\sqrt{50}=5\\sqrt{2}$ and $\\sqrt{8}=2\\sqrt{2}$.', 'All three terms are now multiples of $\\sqrt{2}$: $3\\sqrt{2}+5\\sqrt{2}-2\\sqrt{2}$.', 'Combine the coefficients: $(3+5-2)\\sqrt{2}=6\\sqrt{2}$.'],
        answer: '$6\\sqrt{2}$',
        verify: { kind: 'equivalent', a: '3*sqrt(2)+sqrt(50)-sqrt(8)', b: '6*sqrt(2)' }
      },
      {
        question: 'Rationalise the denominator of $\\dfrac{4}{3-\\sqrt{5}}$.',
        steps: ['Multiply top and bottom by the conjugate $3+\\sqrt{5}$.', 'The denominator is $(3-\\sqrt{5})(3+\\sqrt{5})=9-5=4$.', 'So the fraction is $\\dfrac{4(3+\\sqrt{5})}{4}=3+\\sqrt{5}$.'],
        answer: '$3+\\sqrt{5}$',
        verify: { kind: 'equivalent', a: '4/(3-sqrt(5))', b: '3+sqrt(5)' }
      }
    ]
  },

  'ma5-lin-p-01': {
    summary: 'The gradient of a line decides whether it is parallel or perpendicular to another. Combined with a point it fixes a unique line, and solving two equations together finds where two lines cross.',
    prereqs: ['ma5-lin-c-02', 'ma5-lin-c-01'],
    concepts: [
      { title: 'Parallel and perpendicular lines', body: 'Parallel lines have equal gradients. Perpendicular lines have gradients whose product is $-1$, so one is the negative reciprocal of the other: $2$ and $-\\tfrac{1}{2}$.' },
      { title: 'The line through a point', body: 'Given a gradient $m$ and a point $(x_1,y_1)$, the line is $y-y_1=m(x-x_1)$. Rearrange into $y=mx+c$ or general form if asked.' },
      { title: 'Point of intersection', body: 'Where two lines cross, both equations hold. Solve them simultaneously by substitution or elimination to find the single point $(x,y)$.' }
    ],
    definitions: [
      { term: 'Perpendicular lines', meaning: 'Lines that meet at a right angle. Their gradients multiply to $-1$, unless one line is vertical.' },
      { term: 'Point of intersection', meaning: 'The point whose coordinates satisfy the equations of both lines.' }
    ],
    formulas: [
      { label: 'Perpendicular gradients', tex: 'm_1m_2=-1,\\qquad m_2=-\\frac{1}{m_1}' },
      { label: 'Point-gradient form', tex: 'y-y_1=m(x-x_1)' }
    ],
    points: [
      { front: 'The gradient perpendicular to $y=-3x+1$', back: '$\\tfrac{1}{3}$.' },
      { front: 'The gradient of $3x-4y=8$', back: '$\\tfrac{3}{4}$. Rearrange to $y=\\tfrac{3}{4}x-2$ and read the coefficient of $x$.' },
      { front: 'Parallel lines never meet, so what happens when you solve their equations together?', back: 'There is no solution. The equations are inconsistent.' },
      { front: 'How can an intersection point be checked?', back: 'Substitute it into both original equations.' }
    ],
    mistakes: [
      { wrong: 'The gradient perpendicular to $2$ is $\\tfrac{1}{2}$.', right: 'The sign must change as well as the fraction flipping: $-\\tfrac{1}{2}$.' },
      { wrong: 'The gradient of $3x-4y=8$ is $3$.', right: 'Rearrange first: $y=\\tfrac{3}{4}x-2$, so the gradient is $\\tfrac{3}{4}$.' }
    ],
    examples: [
      {
        question: 'Find the equation of the line perpendicular to $y=2x+3$ that passes through $(4,1)$.',
        steps: ['The gradient of the new line is $-\\tfrac{1}{2}$.', 'Use $y-1=-\\tfrac{1}{2}(x-4)$, which gives $y=-\\tfrac{1}{2}x+3$.', 'Check: at $x=4$, $y=-2+3=1$.'],
        answer: '$y=-\\tfrac{1}{2}x+3$',
        verify: { kind: 'values', pairs: [['2*(-1/2)', '-1'], ['-1/2*4+3', '1']] }
      },
      {
        question: 'Find where $y=2x+3$ meets $x+y=9$.',
        steps: ['Substitute: $x+(2x+3)=9$, so $3x=6$ and $x=2$.', 'Then $y=2(2)+3=7$.', 'Check in the second equation: $2+7=9$.'],
        answer: '$(2,7)$',
        verify: { kind: 'values', pairs: [['2*2+3', '7'], ['2+7', '9']] }
      },
      {
        question: 'Show that $3x-4y=8$ and $4x+3y=7$ are perpendicular.',
        steps: ['The first line is $y=\\tfrac{3}{4}x-2$, with gradient $\\tfrac{3}{4}$.', 'The second is $y=-\\tfrac{4}{3}x+\\tfrac{7}{3}$, with gradient $-\\tfrac{4}{3}$.', 'The product is $\\tfrac{3}{4}\\times\\left(-\\tfrac{4}{3}\\right)=-1$.'],
        answer: 'The gradients multiply to $-1$, so the lines are perpendicular.',
        verify: { kind: 'value', expr: '3/4*(-4/3)', answer: '-1' }
      }
    ]
  },

  'ma5-log-p-01': {
    summary: 'A logarithm answers the question: what power of the base gives this number? It is the inverse of an exponential, and its laws turn multiplication into addition. That makes it the tool for solving equations with the unknown in the index.',
    prereqs: ['ma5-ind-p-01', 'ma5-ind-c-01'],
    concepts: [
      { title: 'Logarithms undo powers', body: '$\\log_2 32=5$ means $2^5=32$. The logarithm is the index. It exists only for a positive number and a positive base other than $1$.' },
      { title: 'The logarithm laws', body: 'They mirror the index laws: products become sums, quotients become differences, and a power comes down as a multiplier. $\\log_6 4+\\log_6 9=\\log_6 36=2$.' },
      { title: 'Solving with a calculator', body: 'To solve $a^x=b$ when $b$ is not a neat power of $a$, take logarithms of both sides: $x=\\dfrac{\\log b}{\\log a}$ with any consistent base.' }
    ],
    definitions: [
      { term: 'Logarithm', meaning: 'The logarithm of $x$ to base $a$ is the index $y$ such that $a^y=x$. It is written $\\log_a x=y$.' },
      { term: 'Base', meaning: 'The number $a$ in $\\log_a x$. The most common bases are $10$ and $2$.' }
    ],
    formulas: [
      { label: 'Definition', tex: '\\log_a x=y\\iff a^{y}=x' },
      { label: 'Laws', tex: '\\log_a(xy)=\\log_a x+\\log_a y,\\quad \\log_a\\frac{x}{y}=\\log_a x-\\log_a y,\\quad \\log_a x^{n}=n\\log_a x' },
      { label: 'Special values', tex: '\\log_a 1=0,\\qquad \\log_a a=1' }
    ],
    points: [
      { front: '$\\log_{10}1000$', back: '$3$, because $10^3=1000$.' },
      { front: '$\\log_a 1$ for any base', back: '$0$, because $a^0=1$.' },
      { front: 'Can you take $\\log_2(-4)$?', back: 'No. A positive base never gives a negative or zero result, so the logarithm is undefined.' },
      { front: 'Rewrite $3\\log_5 2$ as one logarithm', back: '$\\log_5 8$.' }
    ],
    mistakes: [
      { wrong: '$\\log(x+y)=\\log x+\\log y$.', right: 'The law is for a product: $\\log x+\\log y=\\log(xy)$. There is no rule for $\\log(x+y)$.' },
      { wrong: '$\\log_3 18-\\log_3 2=\\log_3 16$.', right: 'A difference of logarithms is the logarithm of a quotient: $\\log_3\\dfrac{18}{2}=\\log_3 9=2$.' }
    ],
    examples: [
      {
        question: 'Evaluate $\\log_2 32$.',
        steps: ['Ask what power of $2$ gives $32$.', '$2^5=32$, so $\\log_2 32=5$.'],
        answer: '$5$',
        verify: { kind: 'value', expr: 'ln(32)/ln(2)', answer: '5' }
      },
      {
        question: 'Evaluate $\\log_6 4+\\log_6 9$.',
        steps: ['Combine using the product law: $\\log_6(4\\times9)=\\log_6 36$.', '$6^2=36$, so the value is $2$.'],
        answer: '$2$',
        verify: { kind: 'value', expr: 'ln(4)/ln(6)+ln(9)/ln(6)', answer: '2' }
      },
      {
        question: 'Solve $3^x=20$, correct to three decimal places.',
        steps: ['Take logarithms of both sides: $x\\log 3=\\log 20$.', 'So $x=\\dfrac{\\log 20}{\\log 3}$.', 'Use a calculator: $x\\approx2.727$.'],
        answer: '$x\\approx2.727$',
        verify: { kind: 'roots', f: '3^x-20', answers: ['ln(20)/ln(3)'] }
      }
    ]
  }
};
