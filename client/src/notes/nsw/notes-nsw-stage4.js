// Pri Learning · NSW Notes · Stage 4 (Years 7 and 8)
//
// Original revision writing for the NSW Mathematics K–10 Syllabus (2022) focus
// areas. Written for Pri Learning; it is not an official NESA publication and
// quotes no syllabus text. Each topic is keyed by the lower-case NESA outcome
// code of its focus area (the code is a reference only). en-AU spelling.
// The shape is the India notes' shape (notes/notesIndex.js); every worked
// example's answer is re-derived by the deterministic engine in
// client/test/nsw-notes-content-check.mjs.
export default {
  'ma4-int-c-01': {
    summary: 'Computation with integers is about whole numbers that can be negative: adding, subtracting, multiplying and dividing them, and using the order of operations so that a calculation means one thing only.',
    prereqs: [],
    concepts: [
      { title: 'The number line', body: 'Integers sit on a number line. Moving right adds, moving left subtracts. $-3 + 5 = 2$ because you start at $-3$ and move $5$ to the right.' },
      { title: 'Signs when multiplying and dividing', body: 'Two numbers with the same sign give a positive answer; different signs give a negative answer. So $(-4)\\times(-3) = 12$ and $(-12)\\div 3 = -4$.' },
      { title: 'Order of operations', body: 'Brackets first, then indices, then multiplication and division from left to right, then addition and subtraction from left to right.' }
    ],
    definitions: [
      { term: 'Integer', meaning: 'A whole number, positive, negative or zero: $\\ldots,-2,-1,0,1,2,\\ldots$' },
      { term: 'Absolute value', meaning: 'The distance of a number from zero, written $|x|$. For example $|-7| = 7$.' }
    ],
    formulas: [
      { label: 'Subtracting a negative', tex: 'a-(-b)=a+b' },
      { label: 'Signs in a product', tex: '(-a)\\times(-b)=ab,\\qquad (-a)\\times b=-ab' }
    ],
    points: [
      { front: 'What is $5-(-2)$?', back: '$7$. Subtracting a negative is the same as adding the positive.' },
      { front: 'The sign of $(-3)\\times(-5)$', back: 'Positive: $15$.' },
      { front: 'Which is done first in $2+3\\times 4$?', back: 'The multiplication: $3\\times4=12$, so the answer is $14$.' },
      { front: 'What is $-6^2$ compared with $(-6)^2$?', back: '$-6^2 = -36$ but $(-6)^2 = 36$.' }
    ],
    mistakes: [
      { wrong: '$2+3\\times4 = 20$ (working left to right).', right: 'Multiplication comes before addition: $2+12=14$.' },
      { wrong: '$-5-3 = -2$.', right: 'Both moves go left: $-5-3=-8$.' }
    ],
    examples: [
      {
        question: 'Evaluate $20-(-6)+3\\times(-4)$.',
        steps: ['Subtracting $-6$ means adding $6$: $20+6=26$.', 'The product: $3\\times(-4)=-12$.', 'Combine: $26-12=14$.'],
        answer: '$14$',
        verify: { kind: 'value', expr: '20-(-6)+3*(-4)', answer: '14' }
      },
      {
        question: 'Evaluate $(-8)\\times 5 \\div (-4)$.',
        steps: ['Work left to right: $(-8)\\times5=-40$.', 'Then $-40\\div(-4)=10$.'],
        answer: '$10$',
        verify: { kind: 'value', expr: '(-8)*5/(-4)', answer: '10' }
      }
    ]
  },

  'ma4-frc-c-01': {
    summary: 'Fractions, decimals and percentages are three ways of writing parts of a whole. Moving between them, comparing them and finding a percentage of an amount are everyday skills in shopping, sport and science.',
    prereqs: ['ma4-int-c-01'],
    concepts: [
      { title: 'One idea, three forms', body: '$\\tfrac{3}{4} = 0.75 = 75\\%$. To go from a fraction to a decimal, divide the top by the bottom; to go from a decimal to a percentage, multiply by $100$.' },
      { title: 'Adding and subtracting fractions', body: 'Use a common denominator, then add or subtract the numerators: $\\tfrac{1}{3}+\\tfrac{1}{4}=\\tfrac{4}{12}+\\tfrac{3}{12}=\\tfrac{7}{12}$.' },
      { title: 'Percentage of an amount', body: 'Write the percentage as a decimal and multiply: $15\\%$ of $80$ is $0.15\\times80=12$.' }
    ],
    definitions: [
      { term: 'Percentage', meaning: 'A number out of $100$. The symbol $\\%$ means “per hundred”.' },
      { term: 'Equivalent fractions', meaning: 'Fractions that name the same amount, such as $\\tfrac{2}{3}$ and $\\tfrac{8}{12}$.' }
    ],
    formulas: [
      { label: 'Percentage of an amount', tex: '\\frac{p}{100}\\times A' },
      { label: 'Percentage change', tex: '\\text{change}=\\frac{\\text{new}-\\text{old}}{\\text{old}}\\times100\\%' }
    ],
    points: [
      { front: '$\\tfrac{1}{8}$ as a decimal', back: '$0.125$.' },
      { front: '$40\\%$ as a fraction in simplest form', back: '$\\tfrac{2}{5}$.' },
      { front: 'A common denominator for $\\tfrac{1}{6}$ and $\\tfrac{3}{8}$', back: '$24$ (the lowest common multiple of $6$ and $8$).' },
      { front: 'Increase $60$ by $10\\%$', back: '$60\\times1.1=66$.' }
    ],
    mistakes: [
      { wrong: '$\\tfrac{1}{3}+\\tfrac{1}{4}=\\tfrac{2}{7}$.', right: 'You cannot add denominators. Use $12$ as the common denominator: $\\tfrac{7}{12}$.' },
      { wrong: 'A $20\\%$ discount followed by a $20\\%$ increase returns the original price.', right: '$0.8\\times1.2=0.96$, so the price is $4\\%$ lower.' }
    ],
    examples: [
      {
        question: 'A jacket costs $\\$85$. It is reduced by $30\\%$. What is the sale price?',
        steps: ['Keeping $70\\%$ of the price: $0.7\\times85$.', '$0.7\\times85 = 59.5$.'],
        answer: '$\\$59.50$',
        verify: { kind: 'value', expr: '0.7*85', answer: '59.5' }
      },
      {
        question: 'Calculate $\\tfrac{2}{3}+\\tfrac{3}{5}$.',
        steps: ['A common denominator is $15$.', '$\\tfrac{10}{15}+\\tfrac{9}{15}=\\tfrac{19}{15}$.', 'As a mixed number: $1\\tfrac{4}{15}$.'],
        answer: '$\\tfrac{19}{15}$',
        verify: { kind: 'value', expr: '2/3+3/5', answer: '19/15' }
      }
    ]
  },

  'ma4-ind-c-01': {
    summary: 'Indices are a short way to write repeated multiplication. The index laws let you simplify products, quotients and powers of the same base without writing everything out.',
    prereqs: ['ma4-int-c-01'],
    concepts: [
      { title: 'Base and index', body: 'In $5^3$ the base is $5$ and the index is $3$: $5^3 = 5\\times5\\times5 = 125$.' },
      { title: 'Multiplying and dividing powers', body: 'With the same base, add the indices when multiplying and subtract when dividing: $a^m\\times a^n = a^{m+n}$ and $a^m\\div a^n = a^{m-n}$.' },
      { title: 'Power of a power, and the zero index', body: '$(a^m)^n = a^{mn}$, and any non-zero number to the power $0$ is $1$.' }
    ],
    definitions: [
      { term: 'Index (power, exponent)', meaning: 'The small raised number that says how many times the base is multiplied by itself.' },
      { term: 'Square number', meaning: 'A number that is a whole number to the power $2$: $1,4,9,16,\\ldots$' }
    ],
    formulas: [
      { label: 'Index laws', tex: 'a^m a^n=a^{m+n},\\quad \\frac{a^m}{a^n}=a^{m-n},\\quad (a^m)^n=a^{mn},\\quad a^0=1' }
    ],
    points: [
      { front: '$2^5$', back: '$32$.' },
      { front: '$x^3\\times x^4$', back: '$x^7$.' },
      { front: '$(x^2)^3$', back: '$x^6$.' },
      { front: '$7^0$', back: '$1$.' }
    ],
    mistakes: [
      { wrong: '$2^3 = 6$.', right: '$2^3 = 2\\times2\\times2 = 8$, not $2\\times3$.' },
      { wrong: '$x^2\\times x^3 = x^6$.', right: 'Add the indices: $x^{2+3}=x^5$.' }
    ],
    examples: [
      {
        question: 'Evaluate $3^4\\div 3^2$.',
        steps: ['Same base, subtract indices: $3^{4-2}=3^2$.', '$3^2=9$.'],
        answer: '$9$',
        verify: { kind: 'value', expr: '3^4/3^2', answer: '9' }
      },
      {
        question: 'Simplify $(2x^3)^2$.',
        steps: ['Square both the $2$ and the $x^3$: $2^2\\times (x^3)^2$.', '$=4x^6$.'],
        answer: '$4x^6$',
        verify: { kind: 'equivalent', a: '(2x^3)^2', b: '4x^6' }
      }
    ]
  },

  'ma4-alg-c-01': {
    summary: 'Algebraic techniques let you use letters for numbers: simplifying expressions, expanding brackets, factorising and substituting values. They are the grammar of the rest of mathematics.',
    prereqs: ['ma4-int-c-01', 'ma4-ind-c-01'],
    concepts: [
      { title: 'Like terms', body: 'Only like terms can be added or subtracted: $3x+5x=8x$, but $3x+5y$ cannot be simplified.' },
      { title: 'Expanding brackets', body: 'Multiply every term inside by the term outside: $4(x-3)=4x-12$.' },
      { title: 'Substitution', body: 'Replace each letter by its value, using brackets for negatives: if $x=-2$ then $3x^2=3\\times(-2)^2=12$.' }
    ],
    definitions: [
      { term: 'Term', meaning: 'A number, a letter, or a product of them, such as $7$, $x$ or $-5ab$.' },
      { term: 'Factorise', meaning: 'Write an expression as a product, for example $6x+9=3(2x+3)$.' }
    ],
    formulas: [
      { label: 'Distributive law', tex: 'a(b+c)=ab+ac' },
      { label: 'Common factor', tex: 'ab+ac=a(b+c)' }
    ],
    points: [
      { front: 'Simplify $2a+3a-a$', back: '$4a$.' },
      { front: 'Expand $-2(x-5)$', back: '$-2x+10$.' },
      { front: 'Factorise $10x+15$', back: '$5(2x+3)$.' },
      { front: 'Value of $2x+1$ when $x=-3$', back: '$-5$.' }
    ],
    mistakes: [
      { wrong: '$3(x+4)=3x+4$.', right: 'Multiply both terms: $3x+12$.' },
      { wrong: '$-(x-2)=-x-2$.', right: 'The minus changes both signs: $-x+2$.' }
    ],
    examples: [
      {
        question: 'Expand and simplify $3(x+2)+2(x-4)$.',
        steps: ['Expand: $3x+6+2x-8$.', 'Collect like terms: $5x-2$.'],
        answer: '$5x-2$',
        verify: { kind: 'equivalent', a: '3(x+2)+2(x-4)', b: '5x-2' }
      },
      {
        question: 'Find the value of $a^2-3a$ when $a=-4$.',
        steps: ['$(-4)^2=16$.', '$-3\\times(-4)=12$.', '$16+12=28$.'],
        answer: '$28$',
        verify: { kind: 'value', expr: '(-4)^2-3*(-4)', answer: '28' }
      }
    ]
  },

  'ma4-equ-c-01': {
    summary: 'An equation says two expressions are equal. Solving it means finding the value of the unknown that makes it true, by doing the same operation to both sides.',
    prereqs: ['ma4-alg-c-01'],
    concepts: [
      { title: 'Balance', body: 'Whatever you do to one side you must do to the other. To solve $x+7=12$, subtract $7$ from both sides to get $x=5$.' },
      { title: 'Two-step equations', body: 'Undo addition or subtraction first, then multiplication or division: $3x-4=11$ becomes $3x=15$, so $x=5$.' },
      { title: 'Unknowns on both sides', body: 'Collect the unknowns on one side: $5x+2=2x+14$ gives $3x=12$, so $x=4$.' }
    ],
    definitions: [
      { term: 'Solution', meaning: 'A value of the unknown that makes the equation true.' },
      { term: 'Inverse operation', meaning: 'The operation that undoes another: subtraction undoes addition, division undoes multiplication.' }
    ],
    formulas: [
      { label: 'Solving $ax+b=c$', tex: 'x=\\frac{c-b}{a}' }
    ],
    points: [
      { front: 'Solve $x-9=4$', back: '$x=13$.' },
      { front: 'Solve $\\tfrac{x}{3}=8$', back: '$x=24$.' },
      { front: 'How can you check a solution?', back: 'Substitute it back into the original equation.' },
      { front: 'Solve $2x+6=0$', back: '$x=-3$.' }
    ],
    mistakes: [
      { wrong: 'Solving $3x=12$ by subtracting $3$.', right: 'Divide both sides by $3$: $x=4$.' },
      { wrong: 'Changing only one side of the equation.', right: 'Apply every step to both sides so the balance is kept.' }
    ],
    examples: [
      {
        question: 'Solve $4x-7=21$.',
        steps: ['Add $7$ to both sides: $4x=28$.', 'Divide both sides by $4$: $x=7$.'],
        answer: '$x=7$',
        verify: { kind: 'roots', f: '4x-7-21', answers: ['7'] }
      },
      {
        question: 'Solve $5x+3=2x+18$.',
        steps: ['Subtract $2x$ from both sides: $3x+3=18$.', 'Subtract $3$: $3x=15$.', 'Divide by $3$: $x=5$.'],
        answer: '$x=5$',
        verify: { kind: 'roots', f: '5x+3-(2x+18)', answers: ['5'] }
      }
    ]
  },

  'ma4-lin-c-01': {
    summary: 'A linear relationship has a constant rate of change, so its graph is a straight line. You can describe it with a table, a rule or a graph, and move between the three.',
    prereqs: ['ma4-equ-c-01'],
    concepts: [
      { title: 'Rules from tables', body: 'If $y$ goes up by $3$ each time $x$ goes up by $1$, the rule has the form $y=3x+c$. Use one point to find $c$.' },
      { title: 'Gradient and intercept', body: 'In $y=mx+c$, $m$ is the gradient (steepness) and $c$ is the $y$-intercept, where the line crosses the $y$-axis.' },
      { title: 'Plotting a line', body: 'Find at least two points from the rule, plot them on the number plane and join them with a straight line.' }
    ],
    definitions: [
      { term: 'Gradient', meaning: 'How much $y$ changes for each increase of $1$ in $x$.' },
      { term: 'Intercept', meaning: 'The point where a graph crosses an axis.' }
    ],
    formulas: [
      { label: 'Straight line', tex: 'y=mx+c' },
      { label: 'Gradient from two points', tex: 'm=\\frac{y_2-y_1}{x_2-x_1}' }
    ],
    points: [
      { front: 'The gradient of $y=4x-1$', back: '$4$.' },
      { front: 'The $y$-intercept of $y=4x-1$', back: '$-1$, the point $(0,-1)$.' },
      { front: 'The gradient of a horizontal line', back: '$0$.' },
      { front: 'Is $(2,7)$ on $y=3x+1$?', back: 'Yes: $3\\times2+1=7$.' }
    ],
    mistakes: [
      { wrong: 'Reading the gradient of $y=5-2x$ as $5$.', right: 'The coefficient of $x$ is $-2$, so the gradient is $-2$.' },
      { wrong: 'Joining plotted points with a curve.', right: 'A linear relationship always gives a straight line.' }
    ],
    examples: [
      {
        question: 'Find the gradient of the line through $(1,3)$ and $(4,12)$.',
        steps: ['Change in $y$: $12-3=9$.', 'Change in $x$: $4-1=3$.', '$m=\\tfrac{9}{3}=3$.'],
        answer: '$3$',
        verify: { kind: 'value', expr: '(12-3)/(4-1)', answer: '3' }
      },
      {
        question: 'For $y=2x+5$, find $y$ when $x=6$, and find $x$ when $y=17$.',
        steps: ['When $x=6$: $y=2\\times6+5=17$.', 'When $y=17$: $2x+5=17$ so $x=6$. (The same point, $(6,17)$.)'],
        answer: '$y=17$ when $x=6$; $x=6$ when $y=17$',
        verify: { kind: 'values', pairs: [['2*6+5', '17']] }
      }
    ]
  },

  'ma4-rat-c-01': {
    summary: 'Ratios compare quantities of the same kind, and rates compare quantities of different kinds, such as distance and time. Both are solved by working with equal parts and unit amounts.',
    prereqs: ['ma4-frc-c-01'],
    concepts: [
      { title: 'Simplifying a ratio', body: 'Divide every part by a common factor: $12:18 = 2:3$.' },
      { title: 'Sharing in a ratio', body: 'Add the parts to find the total number of shares, find the value of one share, then multiply.' },
      { title: 'Rates and the unit rate', body: 'A rate such as $240\\text{ km in }3\\text{ hours}$ becomes a unit rate by dividing: $80\\text{ km/h}$.' }
    ],
    definitions: [
      { term: 'Ratio', meaning: 'A comparison of two or more quantities of the same kind, written $a:b$.' },
      { term: 'Rate', meaning: 'A comparison of quantities with different units, such as $\\$/\\text{kg}$ or $\\text{km/h}$.' }
    ],
    formulas: [
      { label: 'Speed', tex: '\\text{speed}=\\frac{\\text{distance}}{\\text{time}}' },
      { label: 'One share', tex: '\\text{one share}=\\frac{\\text{total}}{\\text{sum of the ratio parts}}' }
    ],
    points: [
      { front: 'Simplify $15:25$', back: '$3:5$.' },
      { front: 'Share $\\$60$ in the ratio $1:2$', back: '$\\$20$ and $\\$40$.' },
      { front: '$150$ km in $2$ hours is what speed?', back: '$75$ km/h.' },
      { front: 'Convert $2.5$ hours to minutes', back: '$150$ minutes.' }
    ],
    mistakes: [
      { wrong: 'Sharing $\\$60$ in the ratio $1:2$ as $\\$30$ and $\\$60$.', right: 'There are $3$ shares in total, so one share is $\\$20$: $\\$20$ and $\\$40$.' },
      { wrong: 'Writing the ratio of $30$ minutes to $2$ hours as $30:2$.', right: 'Use the same unit: $30:120=1:4$.' }
    ],
    examples: [
      {
        question: 'Share $\\$450$ between Mia and Noah in the ratio $4:5$. How much does Noah receive?',
        steps: ['Total shares: $4+5=9$.', 'One share: $450\\div9=50$.', 'Noah has $5$ shares: $5\\times50=250$.'],
        answer: '$\\$250$',
        verify: { kind: 'value', expr: '450/9*5', answer: '250' }
      },
      {
        question: 'A car travels $228$ km in $3$ hours. At the same speed, how far does it travel in $5$ hours?',
        steps: ['Speed: $228\\div3=76$ km/h.', 'Distance: $76\\times5=380$ km.'],
        answer: '$380$ km',
        verify: { kind: 'value', expr: '228/3*5', answer: '380' }
      }
    ]
  },

  'ma4-len-c-01': {
    summary: 'Length is about measuring distance: choosing the right unit, converting between units, and finding perimeters and the circumference of a circle.',
    prereqs: ['ma4-frc-c-01'],
    concepts: [
      { title: 'Metric units', body: '$10\\text{ mm}=1\\text{ cm}$, $100\\text{ cm}=1\\text{ m}$, $1000\\text{ m}=1\\text{ km}$. Multiply to go to a smaller unit and divide to go to a larger one.' },
      { title: 'Perimeter', body: 'The perimeter is the total distance around the outside of a shape. For a rectangle it is $2(l+w)$.' },
      { title: 'Circumference', body: 'The distance around a circle is $C=2\\pi r=\\pi d$. Using the calculator value of $\\pi$ keeps the answer accurate until the final rounding.' }
    ],
    definitions: [
      { term: 'Perimeter', meaning: 'The total length of the boundary of a shape.' },
      { term: 'Circumference', meaning: 'The perimeter of a circle.' }
    ],
    formulas: [
      { label: 'Rectangle perimeter', tex: 'P=2(l+w)' },
      { label: 'Circumference', tex: 'C=2\\pi r' }
    ],
    points: [
      { front: 'How many millimetres in $3.2$ cm?', back: '$32$ mm.' },
      { front: 'Perimeter of a $7$ m by $4$ m rectangle', back: '$22$ m.' },
      { front: 'The diameter in terms of the radius', back: '$d=2r$.' },
      { front: 'How many metres in $0.75$ km?', back: '$750$ m.' }
    ],
    mistakes: [
      { wrong: 'Adding lengths in different units, such as $2\\text{ m}+50\\text{ cm}=52$.', right: 'Convert first: $200\\text{ cm}+50\\text{ cm}=250\\text{ cm}$.' },
      { wrong: 'Using the diameter in $C=2\\pi r$.', right: 'In $2\\pi r$ the number must be the radius. With the diameter use $C=\\pi d$.' }
    ],
    examples: [
      {
        question: 'A rectangular garden is $12.5$ m long and $8$ m wide. What length of fencing goes all the way round?',
        steps: ['Perimeter $=2(l+w)$.', '$2\\times(12.5+8)=2\\times20.5=41$.'],
        answer: '$41$ m',
        verify: { kind: 'value', expr: '2*(12.5+8)', answer: '41' }
      },
      {
        question: 'Find the circumference of a circle of radius $5$ cm, to one decimal place.',
        steps: ['$C=2\\pi r=2\\times\\pi\\times5=10\\pi$.', '$10\\pi\\approx31.4159$, so $31.4$ cm.'],
        answer: '$31.4$ cm',
        verify: { kind: 'value', expr: '10*pi', answer: '31.4159265' }
      }
    ]
  },

  'ma4-are-c-01': {
    summary: 'Area measures the surface inside a shape in square units. Each common shape has a formula, and a composite shape can be split into pieces whose areas are added or subtracted.',
    prereqs: ['ma4-len-c-01'],
    concepts: [
      { title: 'Square units', body: 'Area is counted in squares: $\\text{cm}^2$, $\\text{m}^2$, $\\text{km}^2$. Because $1\\text{ m}=100\\text{ cm}$, $1\\text{ m}^2=10\\,000\\text{ cm}^2$.' },
      { title: 'Triangles and parallelograms', body: 'A triangle is half of a parallelogram with the same base and height: $A=\\tfrac{1}{2}bh$.' },
      { title: 'Composite shapes', body: 'Split the shape into rectangles and triangles, find each area and add them; or find a large rectangle and subtract the missing part.' }
    ],
    definitions: [
      { term: 'Perpendicular height', meaning: 'The height measured at right angles to the base, not along a slanted side.' },
      { term: 'Composite shape', meaning: 'A shape made by joining simpler shapes.' }
    ],
    formulas: [
      { label: 'Rectangle', tex: 'A=lw' },
      { label: 'Triangle', tex: 'A=\\tfrac{1}{2}bh' },
      { label: 'Circle', tex: 'A=\\pi r^2' }
    ],
    points: [
      { front: 'Area of a $9$ cm by $4$ cm rectangle', back: '$36\\text{ cm}^2$.' },
      { front: 'Area of a triangle with base $10$ and height $6$', back: '$30$ square units.' },
      { front: 'Area of a parallelogram', back: 'Base times perpendicular height.' },
      { front: '$1\\text{ m}^2$ in $\\text{cm}^2$', back: '$10\\,000$.' }
    ],
    mistakes: [
      { wrong: 'Using the slanted side as the height of a triangle.', right: 'Use the perpendicular height.' },
      { wrong: 'Forgetting the $\\tfrac{1}{2}$ in the area of a triangle.', right: 'A triangle is half of a rectangle on the same base and height.' }
    ],
    examples: [
      {
        question: 'A triangle has base $14$ cm and perpendicular height $9$ cm. Find its area.',
        steps: ['$A=\\tfrac{1}{2}bh$.', '$A=\\tfrac{1}{2}\\times14\\times9=63$.'],
        answer: '$63\\text{ cm}^2$',
        verify: { kind: 'value', expr: '0.5*14*9', answer: '63' }
      },
      {
        question: 'A $10$ m by $6$ m rectangular lawn has a $3$ m by $2$ m rectangular path cut out of it. Find the area of grass.',
        steps: ['Lawn: $10\\times6=60$.', 'Path: $3\\times2=6$.', 'Grass: $60-6=54$.'],
        answer: '$54\\text{ m}^2$',
        verify: { kind: 'value', expr: '10*6-3*2', answer: '54' }
      }
    ]
  },

  'ma4-vol-c-01': {
    summary: 'Volume measures the space inside a three-dimensional object in cubic units. Prisms are handled by multiplying the area of the base by the height, and capacity links volume to litres.',
    prereqs: ['ma4-are-c-01'],
    concepts: [
      { title: 'Rectangular prisms', body: 'For a box, $V=lwh$. The units are cubic: $\\text{cm}^3$, $\\text{m}^3$.' },
      { title: 'Any prism', body: 'A prism has the same cross-section all the way along, so $V=Ah$, where $A$ is the area of the cross-section.' },
      { title: 'Volume and capacity', body: '$1\\text{ cm}^3=1\\text{ mL}$ and $1000\\text{ cm}^3=1\\text{ L}$. So $1\\text{ m}^3=1000\\text{ L}$.' }
    ],
    definitions: [
      { term: 'Volume', meaning: 'The amount of space an object takes up.' },
      { term: 'Capacity', meaning: 'The amount a container can hold, usually in millilitres or litres.' }
    ],
    formulas: [
      { label: 'Rectangular prism', tex: 'V=lwh' },
      { label: 'Any prism', tex: 'V=Ah' }
    ],
    points: [
      { front: 'Volume of a $2$ by $3$ by $5$ box', back: '$30$ cubic units.' },
      { front: '$2500$ mL in litres', back: '$2.5$ L.' },
      { front: 'How many $\\text{cm}^3$ in $1$ L?', back: '$1000$.' },
      { front: 'The base area of a prism with $V=60$ and height $4$', back: '$15$.' }
    ],
    mistakes: [
      { wrong: 'Giving a volume in square units.', right: 'Volume is in cubic units, such as $\\text{cm}^3$.' },
      { wrong: 'Thinking $1\\text{ m}^3 = 100\\text{ L}$.', right: '$1\\text{ m}^3 = 1000\\text{ L}$.' }
    ],
    examples: [
      {
        question: 'A fish tank is $60$ cm long, $30$ cm wide and $40$ cm high. How many litres does it hold when full?',
        steps: ['$V=60\\times30\\times40=72\\,000\\text{ cm}^3$.', 'Divide by $1000$ to convert to litres: $72$.'],
        answer: '$72$ L',
        verify: { kind: 'value', expr: '60*30*40/1000', answer: '72' }
      },
      {
        question: 'A triangular prism has a cross-sectional area of $18\\text{ cm}^2$ and is $11$ cm long. Find its volume.',
        steps: ['$V=Ah=18\\times11$.', '$=198$.'],
        answer: '$198\\text{ cm}^3$',
        verify: { kind: 'value', expr: '18*11', answer: '198' }
      }
    ]
  },

  'ma4-ang-c-01': {
    summary: 'Angle relationships let you find unknown angles without measuring: angles at a point, on a straight line, vertically opposite, and with parallel lines.',
    prereqs: [],
    concepts: [
      { title: 'Angles at a point and on a line', body: 'Angles around a point add to $360^\\circ$. Angles on a straight line add to $180^\\circ$ (supplementary).' },
      { title: 'Vertically opposite angles', body: 'When two straight lines cross, the angles opposite each other are equal.' },
      { title: 'Parallel lines', body: 'A transversal across parallel lines makes equal corresponding angles, equal alternate angles and co-interior angles that add to $180^\\circ$.' }
    ],
    definitions: [
      { term: 'Complementary angles', meaning: 'Two angles that add to $90^\\circ$.' },
      { term: 'Transversal', meaning: 'A line that crosses two or more other lines.' }
    ],
    formulas: [
      { label: 'Straight line', tex: 'a+b=180^\\circ' },
      { label: 'Around a point', tex: 'a+b+c+\\cdots=360^\\circ' }
    ],
    points: [
      { front: 'The angle supplementary to $65^\\circ$', back: '$115^\\circ$.' },
      { front: 'The angle complementary to $65^\\circ$', back: '$25^\\circ$.' },
      { front: 'Alternate angles on parallel lines are', back: 'Equal.' },
      { front: 'Co-interior angles on parallel lines add to', back: '$180^\\circ$.' }
    ],
    mistakes: [
      { wrong: 'Saying co-interior angles are equal.', right: 'Co-interior angles add to $180^\\circ$; alternate and corresponding angles are equal.' },
      { wrong: 'Using $90^\\circ$ for angles on a straight line.', right: 'Angles on a straight line add to $180^\\circ$.' }
    ],
    examples: [
      {
        question: 'Two angles on a straight line are $x$ and $2x+30^\\circ$. Find $x$.',
        steps: ['Angles on a line add to $180^\\circ$: $x+2x+30=180$.', '$3x=150$, so $x=50$.'],
        answer: '$x=50^\\circ$',
        verify: { kind: 'roots', f: 'x+2x+30-180', answers: ['50'] }
      },
      {
        question: 'Two parallel lines are cut by a transversal. One co-interior angle is $112^\\circ$. Find the other.',
        steps: ['Co-interior angles add to $180^\\circ$.', '$180-112=68$.'],
        answer: '$68^\\circ$',
        verify: { kind: 'value', expr: '180-112', answer: '68' }
      }
    ]
  },

  'ma4-pyt-c-01': {
    summary: 'Pythagoras’ theorem links the three sides of a right-angled triangle. It lets you find a missing side, and test whether a triangle has a right angle.',
    prereqs: ['ma4-ind-c-01'],
    concepts: [
      { title: 'The theorem', body: 'In a right-angled triangle the square of the hypotenuse equals the sum of the squares of the other two sides: $c^2=a^2+b^2$.' },
      { title: 'Finding a shorter side', body: 'Rearrange to $a^2=c^2-b^2$, then take the square root.' },
      { title: 'The converse', body: 'If the three sides satisfy $c^2=a^2+b^2$, the triangle has a right angle opposite the longest side.' }
    ],
    definitions: [
      { term: 'Hypotenuse', meaning: 'The longest side of a right-angled triangle, opposite the right angle.' },
      { term: 'Pythagorean triad', meaning: 'Three whole numbers that satisfy the theorem, such as $3,4,5$ or $5,12,13$.' }
    ],
    formulas: [
      { label: 'Pythagoras’ theorem', tex: 'c^2=a^2+b^2' }
    ],
    points: [
      { front: 'The hypotenuse of a triangle with shorter sides $6$ and $8$', back: '$10$.' },
      { front: 'Is $5,12,13$ a right-angled triangle?', back: 'Yes: $25+144=169$.' },
      { front: 'Which side is $c$?', back: 'The hypotenuse, the longest side.' },
      { front: 'The diagonal of a $5$ by $12$ rectangle', back: '$13$.' }
    ],
    mistakes: [
      { wrong: 'Adding the sides instead of their squares: $c=a+b$.', right: 'Add the squares: $c^2=a^2+b^2$.' },
      { wrong: 'Using the theorem to find a shorter side as $a^2=c^2+b^2$.', right: 'Subtract: $a^2=c^2-b^2$.' }
    ],
    examples: [
      {
        question: 'A ladder $5$ m long leans against a wall with its foot $1.4$ m from the wall. How high up the wall does it reach, to one decimal place?',
        steps: ['The ladder is the hypotenuse: $h^2=5^2-1.4^2$.', '$h^2=25-1.96=23.04$.', '$h=\\sqrt{23.04}=4.8$.'],
        answer: '$4.8$ m',
        verify: { kind: 'value', expr: 'sqrt(5^2-1.4^2)', answer: '4.8' }
      },
      {
        question: 'Find the hypotenuse of a right-angled triangle with shorter sides $9$ cm and $12$ cm.',
        steps: ['$c^2=9^2+12^2=81+144=225$.', '$c=15$.'],
        answer: '$15$ cm',
        verify: { kind: 'value', expr: 'sqrt(9^2+12^2)', answer: '15' }
      }
    ]
  },

  'ma4-pro-c-01': {
    summary: 'Probability measures how likely an event is, from $0$ (impossible) to $1$ (certain). In experiments with equally likely outcomes it is the number of favourable outcomes divided by the total.',
    prereqs: ['ma4-frc-c-01'],
    concepts: [
      { title: 'Equally likely outcomes', body: '$P(\\text{event})=\\tfrac{\\text{favourable outcomes}}{\\text{total outcomes}}$. The chance of rolling an even number on a fair die is $\\tfrac{3}{6}=\\tfrac{1}{2}$.' },
      { title: 'Complementary events', body: 'The probability that an event does not happen is $1-P(\\text{event})$.' },
      { title: 'Experimental probability', body: 'When outcomes are not equally likely, use relative frequency from trials: $\\tfrac{\\text{times it happened}}{\\text{number of trials}}$.' }
    ],
    definitions: [
      { term: 'Sample space', meaning: 'The list of all possible outcomes.' },
      { term: 'Relative frequency', meaning: 'The fraction of trials in which an outcome occurred.' }
    ],
    formulas: [
      { label: 'Probability', tex: 'P(A)=\\frac{n(A)}{n(S)}' },
      { label: 'Complement', tex: 'P(\\text{not }A)=1-P(A)' }
    ],
    points: [
      { front: 'The probability of an impossible event', back: '$0$.' },
      { front: 'Probabilities always lie between', back: '$0$ and $1$ inclusive.' },
      { front: 'The chance of a $5$ on a fair die', back: '$\\tfrac{1}{6}$.' },
      { front: 'If $P(\\text{rain})=0.3$, then $P(\\text{no rain})$ is', back: '$0.7$.' }
    ],
    mistakes: [
      { wrong: 'A coin that has landed heads three times is more likely to land tails.', right: 'Each toss is independent: the chance is still $\\tfrac{1}{2}$.' },
      { wrong: 'Giving a probability of $1.4$.', right: 'A probability can never be more than $1$.' }
    ],
    examples: [
      {
        question: 'A bag holds $5$ red, $3$ blue and $2$ green marbles. One is drawn at random. Find the probability it is not blue.',
        steps: ['Total marbles: $5+3+2=10$.', '$P(\\text{blue})=\\tfrac{3}{10}$.', '$P(\\text{not blue})=1-\\tfrac{3}{10}=\\tfrac{7}{10}$.'],
        answer: '$\\tfrac{7}{10}$',
        verify: { kind: 'value', expr: '1-3/10', answer: '7/10' }
      },
      {
        question: 'A spinner landed on yellow $18$ times in $60$ spins. What is the experimental probability of yellow?',
        steps: ['Relative frequency $=\\tfrac{18}{60}$.', 'Simplify: $\\tfrac{3}{10}=0.3$.'],
        answer: '$0.3$',
        verify: { kind: 'value', expr: '18/60', answer: '0.3' }
      }
    ]
  },

  'ma4-dat-c-02': {
    summary: 'Data analysis summarises a set of numbers with measures of centre (mean, median, mode) and spread (range), so that data sets can be described and compared.',
    prereqs: ['ma4-frc-c-01'],
    concepts: [
      { title: 'Mean, median and mode', body: 'The mean is the sum divided by the number of values; the median is the middle value when ordered; the mode is the most frequent value.' },
      { title: 'Range', body: 'The range is the highest value minus the lowest value. It tells you how spread out the data are.' },
      { title: 'Choosing a measure', body: 'An extreme value pulls the mean towards it, so the median often describes a typical value better when the data has an outlier.' }
    ],
    definitions: [
      { term: 'Outlier', meaning: 'A value that is much larger or smaller than the rest of the data.' },
      { term: 'Mean', meaning: 'The sum of all the values divided by how many there are.' }
    ],
    formulas: [
      { label: 'Mean', tex: '\\bar{x}=\\frac{\\sum x}{n}' },
      { label: 'Range', tex: '\\text{range}=\\text{highest}-\\text{lowest}' }
    ],
    points: [
      { front: 'The median of $3,5,8,9,12$', back: '$8$.' },
      { front: 'The median of an even number of values', back: 'The mean of the two middle values.' },
      { front: 'The mode of $2,4,4,7,9$', back: '$4$.' },
      { front: 'The range of $2,4,4,7,9$', back: '$7$.' }
    ],
    mistakes: [
      { wrong: 'Finding the median without ordering the data.', right: 'Order the values from smallest to largest first.' },
      { wrong: 'Dividing the sum by the number of different values.', right: 'Divide by the total number of values, counting repeats.' }
    ],
    examples: [
      {
        question: 'Find the mean of $12, 15, 9, 20, 14$.',
        steps: ['Sum: $12+15+9+20+14=70$.', 'There are $5$ values: $70\\div5=14$.'],
        answer: '$14$',
        verify: { kind: 'value', expr: '(12+15+9+20+14)/5', answer: '14' }
      },
      {
        question: 'Find the median of $6, 11, 3, 8, 14, 9$.',
        steps: ['Order: $3,6,8,9,11,14$.', 'The two middle values are $8$ and $9$.', 'Median $=\\tfrac{8+9}{2}=8.5$.'],
        answer: '$8.5$',
        verify: { kind: 'value', expr: '(8+9)/2', answer: '8.5' }
      }
    ]
  }
};
