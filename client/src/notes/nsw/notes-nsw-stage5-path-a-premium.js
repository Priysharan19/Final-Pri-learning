// Pri Learning · NSW Notes · Stage 5 Path, first band · the premium layer.
//
// What sits beside notes-nsw-stage5-path-a.js for each topic, keyed by the same id:
//   examiners  what a marker looks for in a full-mark answer (short, specific)
//   diagrams   specs for diagrams/DiagramFromSpec, drawn from the SAME numbers as the text
//   working    one aligned display block per worked example, in the same order as `examples`
//   check      self-check questions; every answer is re-derived by the engine
//              (client/test/nsw-notes-bands-check.mjs), never by the author's say-so
// Original writing for Pri Learning; not an official NESA publication. en-AU spelling.
export default {
  'ma5-alg-p-01': {
    examiners: [
      'The common factor is removed first, and the answer is factorised completely: $4x^2-36$ ends as $4(x-3)(x+3)$, not $(2x-6)(2x+6)$.',
      'For $ax^2+bx+c$ the split of the middle term is shown, so the grouping step can be followed and part-marked.',
      'The answer is checked by expanding, and the signs inside each bracket match the signs of the roots.'
    ],
    diagrams: [
      { title: 'Factors and intercepts', spec: { kind: 'function', xmin: -6, xmax: 1, ymin: -2, ymax: 14, curves: [{ expr: 'x^2+7*x+12', intercepts: true, label: 'y=x^2+7x+12' }] }, note: 'The curve $y=(x+3)(x+4)$ crosses the $x$-axis at $-4$ and $-3$, and the $y$-axis at $12$. Each bracket gives one intercept.' }
    ],
    working: [
      '\\begin{aligned}x^2+7x+12&=x^2+3x+4x+12\\\\&=(x+3)(x+4)\\end{aligned}',
      '\\begin{aligned}2x^2+7x+3&=2x^2+x+6x+3\\\\&=x(2x+1)+3(2x+1)\\\\&=(2x+1)(x+3)\\end{aligned}',
      '\\begin{aligned}12x^2-27&=3(4x^2-9)\\\\&=3(2x-3)(2x+3)\\end{aligned}'
    ],
    check: [
      { question: 'Factorise $x^2-5x+6$.', answer: '$(x-2)(x-3)$', verify: { kind: 'equivalent', a: 'x^2-5*x+6', b: '(x-2)*(x-3)' } },
      { question: 'Factorise $3x^2+10x+8$.', answer: '$(3x+4)(x+2)$', verify: { kind: 'equivalent', a: '3*x^2+10*x+8', b: '(3*x+4)*(x+2)' } }
    ]
  },

  'ma5-alg-p-02': {
    examiners: [
      'Numerator and denominator are factorised before anything is cancelled, and the cancelled factor is clearly a factor of the whole expression.',
      'Values that make a denominator zero are stated when the question asks for the domain or a restriction.',
      'A sum of fractions is written over one common denominator in a single step, with the numerator expanded and collected correctly.'
    ],
    diagrams: [
      { title: 'A simplified fraction as a graph', spec: { kind: 'function', xmin: -8, xmax: 8, ymin: -4, ymax: 6, curves: [{ expr: '(x-3)/x', label: 'y=(x-3)/x' }], asymptotes: [{ x: 0 }, { y: 1 }] }, note: 'The simplified $\\dfrac{x-3}{x}$ has asymptotes $x=0$ and $y=1$. The original fraction has this graph with a single hole at $x=-3$, where its value would be $2$.' }
    ],
    working: [
      '\\begin{aligned}\\frac{x^2-9}{x^2+3x}&=\\frac{(x-3)(x+3)}{x(x+3)}\\\\&=\\frac{x-3}{x}\\end{aligned}',
      '\\begin{aligned}\\frac{1}{x+1}+\\frac{2}{x-1}&=\\frac{(x-1)+2(x+1)}{(x+1)(x-1)}\\\\&=\\frac{3x+1}{(x+1)(x-1)}\\end{aligned}',
      '\\begin{aligned}\\frac{x^2-4}{x+5}\\div\\frac{x+2}{3x+15}&=\\frac{(x-2)(x+2)}{x+5}\\times\\frac{3(x+5)}{x+2}\\\\&=3(x-2)\\end{aligned}'
    ],
    check: [
      { question: 'Simplify $\\dfrac{x^2+5x+6}{x+2}$.', answer: '$x+3$', verify: { kind: 'equivalent', a: '(x^2+5*x+6)/(x+2)', b: 'x+3' } },
      { question: 'Write $\\dfrac{3}{x}+\\dfrac{2}{x+1}$ as one fraction.', answer: '$\\dfrac{5x+3}{x(x+1)}$', verify: { kind: 'equivalent', a: '3/x+2/(x+1)', b: '(5*x+3)/(x*(x+1))' } }
    ]
  },

  'ma5-are-p-01': {
    examiners: [
      'The slant height is found by Pythagoras and shown before it is used in $\\pi r l$.',
      'Only exposed surfaces are added for a composite solid, and the joined face is explicitly left out.',
      'The answer is stated in square units, exact in terms of $\\pi$ when asked, or rounded as instructed.'
    ],
    diagrams: [],
    working: [
      '\\begin{aligned}l&=\\sqrt{5^2+12^2}=13\\\\A&=\\pi(5)^2+\\pi(5)(13)\\\\&=25\\pi+65\\pi\\\\&=90\\pi\\end{aligned}',
      '\\begin{aligned}A&=4\\pi r^2\\\\&=4\\pi(3)^2\\\\&=36\\pi\\approx113.1\\end{aligned}',
      '\\begin{aligned}A&=\\pi(3)^2+2\\pi(3)(10)+2\\pi(3)^2\\\\&=9\\pi+60\\pi+18\\pi\\\\&=87\\pi\\end{aligned}'
    ],
    check: [
      { question: 'Find the surface area of a sphere of radius $5$ cm, in terms of $\\pi$.', answer: '$100\\pi\\text{ cm}^2$', verify: { kind: 'value', expr: '4*pi*5^2', answer: '100*pi' } },
      { question: 'A closed cone has radius $6$ cm and height $8$ cm. Find its total surface area in terms of $\\pi$.', answer: '$96\\pi\\text{ cm}^2$', verify: { kind: 'value', expr: 'pi*6^2+pi*6*sqrt(6^2+8^2)', answer: '96*pi' } }
    ]
  },

  'ma5-cir-p-01': {
    examiners: [
      'Each angle statement is followed by its reason, written as a theorem: angle at the centre is twice the angle at the circumference, or opposite angles of a cyclic quadrilateral are supplementary.',
      'The arc that both angles stand on is named, so it is clear the theorem applies.',
      'A tangent problem states that the radius meets the tangent at $90^\\circ$ before the triangle angle sum is used.'
    ],
    diagrams: [
      { title: 'Angle at the centre', spec: { kind: 'circleTheorem', theorem: 'centre', params: { a: 20, b: 140, r: 250 } }, note: 'The angle at the centre standing on the arc $AB$ is $120^\\circ$ and the angle at the circumference on the same arc is $60^\\circ$.' },
      { title: 'Radius and tangent', spec: { kind: 'circleTheorem', theorem: 'tangent', params: { a: 40 } }, note: 'The tangent meets the radius at the point of contact at $90^\\circ$. Triangle $OTP$ therefore has a right angle at $T$.' }
    ],
    working: [
      '\\begin{aligned}\\angle\\text{circumference}&=\\tfrac{1}{2}\\times\\angle\\text{centre}\\\\&=\\tfrac{1}{2}\\times120^\\circ\\\\&=60^\\circ\\end{aligned}',
      '\\begin{aligned}\\angle C&=180^\\circ-78^\\circ=102^\\circ\\\\\\angle D&=180^\\circ-95^\\circ=85^\\circ\\end{aligned}',
      '\\begin{aligned}\\angle OPT&=180^\\circ-\\angle OTP-\\angle TOP\\\\&=180^\\circ-90^\\circ-50^\\circ\\\\&=40^\\circ\\end{aligned}'
    ],
    check: [
      { question: 'An angle in a semicircle is $90^\\circ$. If the diameter is $AB$ and $\\angle BAC=35^\\circ$, find $\\angle ABC$.', answer: '$55^\\circ$', verify: { kind: 'value', expr: '180-90-35', answer: '55' } },
      { question: 'The angle at the circumference is $37^\\circ$. What is the angle at the centre on the same arc?', answer: '$74^\\circ$', verify: { kind: 'value', expr: '2*37', answer: '74' } }
    ]
  },

  'ma5-dat-p-01': {
    examiners: [
      'The mean is found first, then each deviation is squared and the squares are summed before dividing and taking the square root.',
      'A comparison names both the centre and the spread, and it is written in the context: the data set with the smaller standard deviation is more consistent.',
      'A conclusion is not drawn from the standard deviation alone about how high the values are. The means are compared for that.'
    ],
    diagrams: [
      { title: 'A box plot of seven values', spec: { kind: 'boxPlot', data: [4, 7, 9, 10, 12, 15, 18] }, note: 'The median is $10$, the quartiles are $7$ and $15$, so the middle half of the data spans $8$ units: $\\text{IQR}=8$.' }
    ],
    working: [
      '\\begin{aligned}\\bar{x}&=\\tfrac{40}{8}=5\\\\\\sum(x-\\bar{x})^2&=9+1+1+1+0+0+4+16=32\\\\\\sigma&=\\sqrt{\\tfrac{32}{8}}=2\\end{aligned}',
      '\\begin{aligned}\\sigma_A&=\\sqrt{\\tfrac{16+4+0+4+16}{5}}=\\sqrt{8}\\approx2.83\\\\\\sigma_B&=\\sqrt{\\tfrac{1+0+0+0+1}{5}}=\\sqrt{0.4}\\approx0.63\\end{aligned}',
      '\\begin{aligned}\\text{IQR}&=Q_3-Q_1\\\\&=15-7\\\\&=8\\end{aligned}'
    ],
    check: [
      { question: 'Find the standard deviation of $1,1,5,5$.', answer: '$2$', verify: { kind: 'value', expr: 'sqrt(((1-3)^2+(1-3)^2+(5-3)^2+(5-3)^2)/4)', answer: '2' } },
      { question: 'Find the interquartile range of $2,5,6,8,9,11$.', answer: '$4$', verify: { kind: 'value', expr: '9-5', answer: '4' } }
    ]
  },

  'ma5-equ-p-01': {
    examiners: [
      'The equation is rearranged to equal zero before it is factorised, and the null factor step is written out.',
      'Every solution is stated, and any solution that does not fit the context is rejected with a reason: a width cannot be negative.',
      'A solution is verified in the original equation, not only in the factorised form.'
    ],
    diagrams: [
      { title: 'Roots as intercepts', spec: { kind: 'function', xmin: -5, xmax: 10, ymin: -24, ymax: 20, curves: [{ expr: 'x^2-5*x-14', intercepts: true, label: 'y=x^2-5x-14' }] }, note: 'Solving $x^2-5x-14=0$ asks where the curve meets the $x$-axis. It does so at $x=-2$ and $x=7$.' }
    ],
    working: [
      '\\begin{aligned}x^2-5x-14&=0\\\\(x-7)(x+2)&=0\\\\x=7\\ \\text{or}\\ x&=-2\\end{aligned}',
      '\\begin{aligned}2x^2-3x-9&=0\\\\(2x+3)(x-3)&=0\\\\x=-\\tfrac{3}{2}\\ \\text{or}\\ x&=3\\end{aligned}',
      '\\begin{aligned}x(x+3)&=40\\\\x^2+3x-40&=0\\\\(x+8)(x-5)&=0\\\\x&=5\\ (x>0)\\end{aligned}'
    ],
    check: [
      { question: 'Solve $x^2+2x-15=0$.', answer: '$x=-5$ or $x=3$', verify: { kind: 'roots', f: 'x^2+2*x-15', answers: ['-5', '3'] } },
      { question: 'Solve $3x^2-12x=0$.', answer: '$x=0$ or $x=4$', verify: { kind: 'roots', f: '3*x^2-12*x', answers: ['0', '4'] } }
    ]
  },

  'ma5-equ-p-02': {
    examiners: [
      'The equation is written in the form $ax^2+bx+c=0$ and $a$, $b$ and $c$ are stated with their signs before the formula is used.',
      'The discriminant is calculated on its own line, then substituted, so an arithmetic slip is easy to locate.',
      'Exact answers are left as surds unless the question asks for a rounded value, and the number of decimal places requested is respected.'
    ],
    diagrams: [
      { title: 'Two irrational roots', spec: { kind: 'function', xmin: -2, xmax: 4, ymin: -6, ymax: 10, curves: [{ expr: '2*x^2-5*x-1', intercepts: true, label: 'y=2x^2-5x-1' }] }, note: 'Here $\\Delta=33>0$, so the parabola crosses the axis twice, near $x=-0.19$ and $x=2.69$.' }
    ],
    working: [
      '\\begin{aligned}x^2+6x&=-2\\\\(x+3)^2&=7\\\\x&=-3\\pm\\sqrt{7}\\end{aligned}',
      '\\begin{aligned}\\Delta&=(-5)^2-4(2)(-1)=33\\\\x&=\\frac{5\\pm\\sqrt{33}}{4}\\end{aligned}',
      '\\begin{aligned}\\Delta&=(-2)^2-4(3)(5)\\\\&=4-60\\\\&=-56<0\\end{aligned}'
    ],
    check: [
      { question: 'Solve $x^2-4x+1=0$ exactly.', answer: '$x=2\\pm\\sqrt{3}$', verify: { kind: 'roots', f: 'x^2-4*x+1', answers: ['2+sqrt(3)', '2-sqrt(3)'] } },
      { question: 'Find the discriminant of $x^2-6x+9=0$.', answer: '$0$, so there is one repeated solution.', verify: { kind: 'value', expr: '(-6)^2-4*1*9', answer: '0' } }
    ]
  },

  'ma5-fnc-p-01': {
    examiners: [
      'Substitution into $f(x)$ uses brackets around negative inputs, and the whole input replaces every $x$.',
      'A solution to $f(x)=k$ is found by solving the equation, not by guessing from a graph.',
      'The reason a relation fails to be a function is given with a specific input that has two outputs.'
    ],
    diagrams: [
      { title: 'The hyperbola $y=6/x$', spec: { kind: 'function', xmin: -8, xmax: 8, ymin: -8, ymax: 8, curves: [{ expr: '6/x', label: 'y=6/x' }], asymptotes: [{ x: 0 }, { y: 0 }], points: [{ x: 3, y: 2, label: '(3,2)' }, { x: -1.5, y: -4, label: '(-1.5,-4)' }] }, note: 'The marked points are $f(3)=2$ and the solution of $f(x)=-4$ at $x=-\\tfrac{3}{2}$. Both axes are asymptotes.' }
    ],
    working: [
      '\\begin{aligned}f(-2)&=3(-2)^2-2(-2)+1\\\\&=12+4+1\\\\&=17\\end{aligned}',
      '\\begin{aligned}f(3)&=\\tfrac{6}{3}=2\\\\\\tfrac{6}{x}&=-4\\\\x&=-\\tfrac{3}{2}\\end{aligned}',
      '\\begin{aligned}3^2+y^2&=25\\\\y^2&=16\\\\y&=\\pm4\\end{aligned}'
    ],
    check: [
      { question: 'If $f(x)=x^2-4$, find $f(-3)$.', answer: '$5$', verify: { kind: 'value', expr: '(-3)^2-4', answer: '5' } },
      { question: 'If $f(x)=2^x$, find $f(5)-f(3)$.', answer: '$24$', verify: { kind: 'value', expr: '2^5-2^3', answer: '24' } }
    ]
  },

  'ma5-geo-p-02': {
    examiners: [
      'The congruence test is named with the matching vertices written in order, for example $\\triangle ABM\\equiv\\triangle ACM$ (SSS).',
      'Every statement in a proof carries its reason, and the final line says which corresponding parts are equal because the triangles are congruent.',
      'A test is not used if its conditions are not met: SSA and AAA are never accepted as reasons.'
    ],
    diagrams: [
      { title: 'An isosceles triangle', spec: { kind: 'triangle', a: 5, b: 5, C: 40 }, note: 'With two equal sides and an apex of $40^\\circ$ the base angles are each $(180^\\circ-40^\\circ)\\div2=70^\\circ$.' }
    ],
    working: [
      '\\begin{aligned}\\angle C&=180^\\circ-62^\\circ-48^\\circ\\\\&=70^\\circ\\\\\\angle R&=\\angle C=70^\\circ\\end{aligned}',
      '\\begin{aligned}\\text{Parallelogram}&=8\\times5=40\\\\\\text{Each triangle}&=\\tfrac{1}{2}\\times8\\times5=20\\end{aligned}',
      '\\begin{aligned}\\angle B&=\\angle C\\\\&=\\frac{180^\\circ-40^\\circ}{2}\\\\&=70^\\circ\\end{aligned}'
    ],
    check: [
      { question: 'Triangles $ABC$ and $DEF$ are congruent with $\\angle A=\\angle D=50^\\circ$ and $\\angle B=\\angle E=60^\\circ$. Find $\\angle F$.', answer: '$70^\\circ$', verify: { kind: 'value', expr: '180-50-60', answer: '70' } },
      { question: 'An isosceles triangle has a base angle of $55^\\circ$. Find the apex angle.', answer: '$70^\\circ$', verify: { kind: 'value', expr: '180-2*55', answer: '70' } }
    ]
  },

  'ma5-geo-p-01': {
    examiners: [
      'The reason for similarity is stated (equal angles, or sides in the same ratio) before any ratio is used.',
      'Corresponding sides are matched by position, and the scale factor is written as a fraction showing which figure is on top.',
      'Area and volume questions use $k^2$ and $k^3$, not $k$, and the units are squared or cubed.'
    ],
    diagrams: [
      { title: 'The 3, 4, 5 triangle', spec: { kind: 'triangle', a: 3, b: 4, c: 5 }, note: 'Enlarging by scale factor $3$ gives sides $9$, $12$ and $15$, the same shape with equal angles.' }
    ],
    working: [
      '\\begin{aligned}k&=\\tfrac{9}{3}=3\\\\4\\times3&=12\\\\5\\times3&=15\\end{aligned}',
      '\\begin{aligned}k&=\\tfrac{12}{3}=4\\\\\\text{height}&=2\\times4=8\\ \\text{m}\\end{aligned}',
      '\\begin{aligned}\\text{Area}&=12\\times k^2\\\\&=12\\times3^2\\\\&=108\\end{aligned}'
    ],
    check: [
      { question: 'Triangles with sides $4,6,8$ and $10,15,x$ are similar. Find $x$.', answer: '$20$', verify: { kind: 'value', expr: '10/4*8', answer: '20' } },
      { question: 'Two similar figures have scale factor $4$. A region of area $5\\text{ cm}^2$ in the smaller becomes what area in the larger?', answer: '$80\\text{ cm}^2$', verify: { kind: 'value', expr: '5*4^2', answer: '80' } }
    ]
  },

  'ma5-ind-p-01': {
    examiners: [
      'Roots and reciprocals are rewritten as indices before the laws are applied, and each rewrite is a separate line.',
      'For $a^{m/n}$ with numbers, the root is taken first, so the intermediate values stay whole.',
      'A negative index is not confused with a negative number: $2^{-3}$ is positive.'
    ],
    diagrams: [
      { title: 'The curve $y=x^{1/2}$', spec: { kind: 'function', xmin: 0, xmax: 10, ymin: 0, ymax: 4, curves: [{ expr: 'x^(1/2)', label: 'y=x^{1/2}' }], points: [{ x: 1, y: 1, label: '(1,1)' }, { x: 4, y: 2, label: '(4,2)' }, { x: 9, y: 3, label: '(9,3)' }] }, note: 'The index $\\tfrac{1}{2}$ is a square root, so $4^{1/2}=2$ and $9^{1/2}=3$.' }
    ],
    working: [
      '\\begin{aligned}8^{2/3}&=\\left(\\sqrt[3]{8}\\right)^2\\\\&=2^2\\\\&=4\\end{aligned}',
      '\\begin{aligned}\\left(\\tfrac{9}{4}\\right)^{-1/2}&=\\left(\\tfrac{4}{9}\\right)^{1/2}\\\\&=\\tfrac{2}{3}\\end{aligned}',
      '\\begin{aligned}\\frac{1}{\\sqrt[3]{x^2}}&=\\frac{1}{x^{2/3}}\\\\&=x^{-2/3}\\end{aligned}'
    ],
    check: [
      { question: 'Evaluate $16^{3/4}$.', answer: '$8$', verify: { kind: 'value', expr: '16^(3/4)', answer: '8' } },
      { question: 'Evaluate $5^{-2}$.', answer: '$\\tfrac{1}{25}$', verify: { kind: 'value', expr: '5^(-2)', answer: '1/25' } }
    ]
  },

  'ma5-ind-p-02': {
    examiners: [
      'The largest square factor is found and shown, for example $72=36\\times2$, so the surd is fully simplified and not left as $2\\sqrt{18}$.',
      'Surds are simplified first and only like surds are then added or subtracted. Unlike surds are never merged.',
      'To rationalise a binomial denominator the conjugate is used on both numerator and denominator, and the difference of squares is shown.'
    ],
    diagrams: [
      { title: 'A right triangle with legs 1 and 1', spec: { kind: 'triangle', a: 1, b: 1, C: 90 }, note: 'By Pythagoras the hypotenuse is $\\sqrt{1^2+1^2}=\\sqrt{2}$. No fraction or terminating decimal equals it, so it is left as a surd.' },
      { title: 'Surds on the number line', spec: { kind: 'numberLine', min: 0, max: 3, points: [{ value: 1.4142, label: '\\sqrt{2}' }, { value: 1.7321, label: '\\sqrt{3}' }, { value: 2.2361, label: '\\sqrt{5}' }] }, note: 'The surds sit between whole numbers: $\\sqrt{2}\\approx1.414$, $\\sqrt{3}\\approx1.732$ and $\\sqrt{5}\\approx2.236$.' }
    ],
    working: [
      '\\begin{aligned}\\sqrt{72}&=\\sqrt{36\\times2}\\\\&=\\sqrt{36}\\times\\sqrt{2}\\\\&=6\\sqrt{2}\\end{aligned}',
      '\\begin{aligned}3\\sqrt{2}+\\sqrt{50}-\\sqrt{8}&=3\\sqrt{2}+5\\sqrt{2}-2\\sqrt{2}\\\\&=6\\sqrt{2}\\end{aligned}',
      '\\begin{aligned}\\frac{4}{3-\\sqrt{5}}&=\\frac{4(3+\\sqrt{5})}{(3-\\sqrt{5})(3+\\sqrt{5})}\\\\&=\\frac{4(3+\\sqrt{5})}{4}\\\\&=3+\\sqrt{5}\\end{aligned}'
    ],
    check: [
      { question: 'Simplify $\\sqrt{48}$.', answer: '$4\\sqrt{3}$', verify: { kind: 'equivalent', a: 'sqrt(48)', b: '4*sqrt(3)' } },
      { question: 'Expand and simplify $(\\sqrt{5}+2)(\\sqrt{5}-2)$.', answer: '$1$', verify: { kind: 'value', expr: '(sqrt(5)+2)*(sqrt(5)-2)', answer: '1' } }
    ]
  },

  'ma5-lin-p-01': {
    examiners: [
      'Each line is rearranged into $y=mx+c$ before its gradient is read off, so a general form such as $3x-4y=8$ is not misread.',
      'The perpendicular gradient is shown as a negative reciprocal, with the product $-1$ as a check.',
      'A point of intersection is checked in both equations, and a pair of parallel lines is reported as having no intersection.'
    ],
    diagrams: [
      { title: 'Two lines meeting', spec: { kind: 'function', xmin: -3, xmax: 8, ymin: -2, ymax: 12, curves: [{ expr: '2*x+3', label: 'y=2x+3' }, { expr: '9-x', label: 'x+y=9' }], points: [{ x: 2, y: 7, label: '(2,7)' }] }, note: 'The lines $y=2x+3$ and $x+y=9$ cross at $(2,7)$, where both equations are true.' }
    ],
    working: [
      '\\begin{aligned}m&=-\\tfrac{1}{2}\\\\y-1&=-\\tfrac{1}{2}(x-4)\\\\y&=-\\tfrac{1}{2}x+3\\end{aligned}',
      '\\begin{aligned}x+(2x+3)&=9\\\\3x&=6\\\\x&=2,\\ y=7\\end{aligned}',
      '\\begin{aligned}m_1m_2&=\\tfrac{3}{4}\\times\\left(-\\tfrac{4}{3}\\right)\\\\&=-1\\end{aligned}'
    ],
    check: [
      { question: 'A line has gradient $-3$. What is the gradient of a line perpendicular to it?', answer: '$\\tfrac{1}{3}$', verify: { kind: 'value', expr: '-1/(-3)', answer: '1/3' } },
      { question: 'Find the $x$-coordinate where $y=x+1$ meets $y=3x-5$.', answer: '$x=3$', verify: { kind: 'roots', f: '(x+1)-(3*x-5)', answers: ['3'] } }
    ]
  },

  'ma5-log-p-01': {
    examiners: [
      'A logarithm is converted to index form when needed: $\\log_2 32=5$ is justified by $2^5=32$.',
      'Each law used is shown on its own line, and a sum of logarithms is combined into one logarithm of a product before evaluating.',
      'A calculator answer is rounded only at the end, to the number of decimal places requested, with the exact form shown first.'
    ],
    diagrams: [
      { title: 'A logarithm is the inverse of a power', spec: { kind: 'function', xmin: -3, xmax: 8, ymin: -3, ymax: 8, curves: [{ expr: '2^x', label: 'y=2^x' }, { expr: 'ln(x)/ln(2)', label: 'y=\\log_2 x' }, { expr: 'x', label: 'y=x', tone: 'secondary' }], points: [{ x: 3, y: 8, label: '(3,8)' }, { x: 8, y: 3, label: '(8,3)' }] }, note: 'The point $(3,8)$ on $y=2^x$ becomes $(8,3)$ on $y=\\log_2 x$. The two curves are reflections in the line $y=x$, so $\\log_2 8=3$.' }
    ],
    working: [
      '\\begin{aligned}\\log_2 32&=y\\\\2^y&=32=2^5\\\\y&=5\\end{aligned}',
      '\\begin{aligned}\\log_6 4+\\log_6 9&=\\log_6(4\\times9)\\\\&=\\log_6 36\\\\&=2\\end{aligned}',
      '\\begin{aligned}3^x&=20\\\\x\\log 3&=\\log 20\\\\x&=\\frac{\\log 20}{\\log 3}\\approx2.727\\end{aligned}'
    ],
    check: [
      { question: 'Evaluate $\\log_{10}1000$.', answer: '$3$', verify: { kind: 'value', expr: 'ln(1000)/ln(10)', answer: '3' } },
      { question: 'Evaluate $\\log_5 25+\\log_5 5$.', answer: '$3$', verify: { kind: 'value', expr: 'ln(25)/ln(5)+ln(5)/ln(5)', answer: '3' } }
    ]
  }
};
