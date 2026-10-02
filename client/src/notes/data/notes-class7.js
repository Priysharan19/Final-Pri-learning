// i18n note: mathematics content, English by design.
export default {
  'c7-large-numbers-current': {
    summary: 'Big numbers become easy to handle once you can read them, round them sensibly and compare them by asking ‘how many times bigger?’. In India we group digits as thousands, lakhs and crores; the international system groups them as thousands, millions and billions.',
    prereqs: [],
    concepts: [
      { title: 'Two ways of grouping digits', body: 'In the Indian system the first comma comes after three digits from the right, and then after every two: $3,45,67,890$ is three crore forty-five lakh sixty-seven thousand eight hundred ninety. The international system puts a comma after every three digits, so the same number is written $34,567,890$: thirty-four million five hundred sixty-seven thousand eight hundred ninety.' },
      { title: 'Matching the two systems', body: '$1$ lakh $= 100$ thousand, $10$ lakh $= 1$ million, and $1$ crore $= 10$ million. So $1$ billion $= 100$ crore.' },
      { title: 'Rounding to a useful level', body: 'Round to the place that matters for the question. To round to the nearest lakh, look at the ten-thousands digit: if it is $5$ or more, round up; otherwise round down.' },
      { title: 'Comparing by multiplying', body: 'To feel how big a number is, ask how many times one quantity fits into another. A crore is $100$ times a lakh, and a lakh is $100$ times a thousand.' },
      { title: 'Regrouping to multiply quickly', body: 'Break numbers into friendly factors: $25 \\times 48 = 25 \\times 4 \\times 12 = 100 \\times 12 = 1200$.' }
    ],
    definitions: [
      { term: 'Lakh', meaning: 'One hundred thousand, written $1,00,000$.' },
      { term: 'Crore', meaning: 'One hundred lakh, written $1,00,00,000$ (ten million).' },
      { term: 'Million', meaning: 'One thousand thousand, $1,000,000$, which equals $10$ lakh.' },
      { term: 'Rounding', meaning: 'Replacing a number by a nearby simpler one, such as the nearest thousand or lakh.' }
    ],
    formulas: [
      { label: 'Indian units', tex: '1\\text{ lakh}=10^5,\\quad 1\\text{ crore}=10^7' },
      { label: 'Linking the systems', tex: '10\\text{ lakh}=1\\text{ million},\\quad 1\\text{ crore}=10\\text{ million}' }
    ],
    points: [
      { front: 'How many zeros in a crore?', back: 'Seven: $1,00,00,000$.' },
      { front: 'How many lakhs make a million?', back: 'Ten.' },
      { front: 'Rounding rule', back: 'Look at the digit just to the right of the place you are rounding to: $5$ or more rounds up, $4$ or less rounds down.' },
      { front: 'A crore compared with a lakh', back: 'A crore is $100$ times as large as a lakh.' },
      { front: 'Quick trick for $\\times 25$', back: 'Pair the $25$ with a $4$ to make $100$.' },
      { front: 'Commas in the Indian system', back: 'Three digits from the right first, then groups of two.' }
    ],
    mistakes: [
      { wrong: 'Writing ten lakh as $10,00,0000$.', right: 'Ten lakh is $10,00,000$: three digits, then pairs.' },
      { wrong: '$1$ crore $= 1$ million.', right: '$1$ crore $= 10$ million; $1$ million is only $10$ lakh.' },
      { wrong: 'Rounding $3,46,000$ to the nearest lakh gives $4,00,000$ because $6$ is big.', right: 'Look at the ten-thousands digit, which is $4$, so it rounds down to $3,00,000$.' }
    ],
    examples: [
      {
        question: 'How many times bigger is $2$ crore than $40$ thousand?',
        steps: ['$2$ crore $= 2,00,00,000$.', '$40$ thousand $= 40,000$.', 'Divide: $20000000 \\div 40000 = 500$.'],
        answer: '$500$ times',
        verify: { kind: 'value', expr: '20000000/40000', answer: '500' }
      },
      {
        question: 'Work out $125 \\times 64$ by regrouping.',
        steps: ['Split $64 = 8 \\times 8$.', '$125 \\times 8 = 1000$.', 'So $1000 \\times 8 = 8000$.'],
        answer: '$8000$',
        verify: { kind: 'value', expr: '125*64', answer: '8000' }
      }
    ]
  },

  'c7-arithmetic-expressions-current': {
    summary: 'An arithmetic expression is a calculation written with numbers and operation signs. Splitting it into terms, using brackets carefully and knowing how a minus sign affects a bracket lets you find its value without mistakes.',
    prereqs: [],
    concepts: [
      { title: 'Terms', body: 'Terms are the parts of an expression that are added. In $30 - 4 \\times 5$, think of it as $30 + (-4 \\times 5)$: the terms are $30$ and $-20$, so the value is $10$.' },
      { title: 'Brackets first', body: 'Anything inside brackets is worked out first. Brackets let you say exactly which calculation you mean: $(6+2)\\times 3 = 24$ but $6 + 2 \\times 3 = 12$.' },
      { title: 'Removing a bracket after a minus', body: 'A minus sign in front of a bracket changes the sign of every term inside: $20 - (8 - 3) = 20 - 8 + 3 = 15$.' },
      { title: 'Swapping and grouping', body: 'Addition and multiplication can be done in any order and grouping (commutative and associative). Subtraction and division cannot.' },
      { title: 'Distributing', body: 'Multiplying a sum by a number multiplies each part: $7 \\times 98 = 7 \\times (100 - 2) = 700 - 14 = 686$.' }
    ],
    definitions: [
      { term: 'Expression', meaning: 'A combination of numbers and operations that has a value.' },
      { term: 'Term', meaning: 'A part of an expression joined to the rest by $+$ (with any minus sign belonging to the term).' },
      { term: 'Distributive property', meaning: 'Multiplication spreads over addition or subtraction: $a(b+c)=ab+ac$.' }
    ],
    formulas: [
      { label: 'Minus before a bracket', tex: 'a-(b+c)=a-b-c,\\quad a-(b-c)=a-b+c' },
      { label: 'Distributive property', tex: 'a\\times(b+c)=a\\times b+a\\times c' },
      { label: 'Commutative and associative', tex: 'a+b=b+a,\\quad (a\\times b)\\times c=a\\times(b\\times c)' }
    ],
    points: [
      { front: 'Order of work', back: 'Brackets, then multiplication and division, then addition and subtraction.' },
      { front: 'What is a term?', back: 'A piece of the expression that gets added; a minus sign stays with its term.' },
      { front: '$-(b-c)$ becomes', back: '$-b+c$: both signs flip.' },
      { front: 'Is $a-b=b-a$?', back: 'No, unless $a=b$. Subtraction is not commutative.' },
      { front: 'Mental trick for $9 \\times 47$', back: '$10 \\times 47 - 47 = 470 - 47 = 423$.' }
    ],
    mistakes: [
      { wrong: '$15 - (6 + 4) = 15 - 6 + 4 = 13$.', right: 'The minus applies to both terms: $15 - 6 - 4 = 5$.', misconception: 'distribute-sign' },
      { wrong: '$5 + 3 \\times 4 = 32$.', right: 'Multiply first: $5 + 12 = 17$.' },
      { wrong: '$4 \\times (10 + 3) = 40 + 3$.', right: 'Multiply both parts: $40 + 12 = 52$.', misconception: 'distribute-partial' }
    ],
    examples: [
      {
        question: 'Find the value of $50 - (18 - 7) + 3 \\times 4$.',
        steps: ['Bracket: $18 - 7 = 11$.', 'Multiplication: $3 \\times 4 = 12$.', 'Now $50 - 11 + 12 = 51$.'],
        answer: '$51$',
        verify: { kind: 'value', expr: '50-(18-7)+3*4', answer: '51' }
      },
      {
        question: 'Use the distributive property to find $13 \\times 99$.',
        steps: ['Write $99 = 100 - 1$.', '$13 \\times 100 - 13 \\times 1 = 1300 - 13$.', '$= 1287$.'],
        answer: '$1287$',
        verify: { kind: 'value', expr: '13*99', answer: '1287' }
      }
    ]
  },

  'c7-decimals-current': {
    summary: 'Decimals extend place value to the right of the units place. Each place is one-tenth of the place to its left, giving tenths, hundredths and thousandths. Knowing the place values lets you compare decimals and add or subtract them by lining up the points.',
    prereqs: [],
    concepts: [
      { title: 'Places after the point', body: 'In $4.375$ the $3$ is $3$ tenths, the $7$ is $7$ hundredths and the $5$ is $5$ thousandths. So $4.375 = 4 + \\frac{3}{10} + \\frac{7}{100} + \\frac{5}{1000}$.' },
      { title: 'Each place is ten times the next', body: 'One unit is $10$ tenths, one tenth is $10$ hundredths, and one hundredth is $10$ thousandths.' },
      { title: 'Comparing decimals', body: 'Compare whole-number parts first, then tenths, then hundredths, and so on. $0.5 > 0.45$ because $5$ tenths beat $4$ tenths. Extra zeros at the end do not change a decimal: $0.5 = 0.50$.' },
      { title: 'Adding and subtracting', body: 'Line up the decimal points so that tenths sit under tenths. Fill empty places with zeros, then add or subtract as usual.' }
    ],
    definitions: [
      { term: 'Tenth', meaning: 'One part when a unit is split into $10$ equal parts: $0.1 = \\frac{1}{10}$.' },
      { term: 'Hundredth', meaning: '$0.01 = \\frac{1}{100}$.' },
      { term: 'Thousandth', meaning: '$0.001 = \\frac{1}{1000}$.' },
      { term: 'Decimal point', meaning: 'The dot separating the whole-number part from the parts smaller than one.' }
    ],
    formulas: [
      { label: 'Decimal place values', tex: '0.1=\\frac{1}{10},\\quad 0.01=\\frac{1}{100},\\quad 0.001=\\frac{1}{1000}' },
      { label: 'Expanded form', tex: '2.46=2+\\frac{4}{10}+\\frac{6}{100}' }
    ],
    points: [
      { front: 'Is $0.7$ or $0.65$ larger?', back: '$0.7$, since it has $7$ tenths against $6$ tenths.' },
      { front: 'Trailing zeros', back: '$3.40 = 3.4$; zeros at the end after the point change nothing.' },
      { front: 'How many hundredths in $1$?', back: '$100$.' },
      { front: 'Rule for adding decimals', back: 'Line up the points, pad with zeros, then add.' },
      { front: '$1\\text{ cm}$ in metres', back: '$0.01\\text{ m}$, since $100\\text{ cm} = 1\\text{ m}$.' }
    ],
    mistakes: [
      { wrong: '$0.25 > 0.3$ because $25 > 3$.', right: 'Compare tenths: $2$ tenths is less than $3$ tenths, so $0.25 < 0.3$.' },
      { wrong: '$3.5 + 1.25 = 1.60$ (lining up the right ends).', right: 'Line up the points: $3.50 + 1.25 = 4.75$.' },
      { wrong: '$0.07$ means $7$ tenths.', right: 'The $7$ is in the hundredths place: $0.07 = \\frac{7}{100}$.' }
    ],
    examples: [
      {
        question: 'Riya buys a pen for ₹$12.75$ and a notebook for ₹$28.5$. She pays with ₹$50$. How much change does she get?',
        steps: ['Total cost: $12.75 + 28.50 = 41.25$.', 'Change: $50.00 - 41.25 = 8.75$.'],
        answer: '₹$8.75$',
        verify: { kind: 'value', expr: '50-(12.75+28.5)', answer: '8.75' }
      },
      {
        question: 'Write $5 + \\frac{3}{10} + \\frac{8}{1000}$ as a decimal.',
        steps: ['$5$ units, $3$ tenths, $0$ hundredths, $8$ thousandths.', 'So the number is $5.308$.'],
        answer: '$5.308$',
        verify: { kind: 'value', expr: '5+3/10+8/1000', answer: '5.308' }
      }
    ]
  },

  'c7-letter-numbers-current': {
    summary: 'A letter can stand for a number that changes or is not yet known. With letter-numbers we can write general rules, turn word descriptions into short expressions, tidy expressions by collecting like terms, and find their value once the letters are given numbers.',
    prereqs: ['c7-arithmetic-expressions-current'],
    concepts: [
      { title: 'Letters as numbers', body: 'If a pencil costs ₹$p$, then $5$ pencils cost ₹$5p$. The letter lets one expression work for every possible price.' },
      { title: 'From words to expressions', body: '‘$4$ more than a number $n$’ is $n + 4$; ‘twice a number, minus $3$’ is $2n - 3$; ‘$x$ shared among $6$’ is $\\frac{x}{6}$.' },
      { title: 'Like terms', body: 'Terms with exactly the same letter part can be combined: $3a + 5a = 8a$. Unlike terms such as $3a$ and $5b$ stay separate.' },
      { title: 'Substitution', body: 'To evaluate, replace each letter by its value and calculate. For $2n - 3$ with $n = 7$: $2 \\times 7 - 3 = 11$.' }
    ],
    definitions: [
      { term: 'Letter-number (variable)', meaning: 'A letter that stands for a number which may vary.' },
      { term: 'Coefficient', meaning: 'The number multiplying the letter in a term, like $5$ in $5p$.' },
      { term: 'Like terms', meaning: 'Terms with the same letters raised to the same powers.' },
      { term: 'Formula', meaning: 'An expression giving one quantity in terms of others, such as perimeter of a square $= 4s$.' }
    ],
    formulas: [
      { label: 'Combining like terms', tex: 'ax+bx=(a+b)x' },
      { label: 'Perimeter of a square', tex: 'P=4s' },
      { label: 'Perimeter of a rectangle', tex: 'P=2(l+b)' }
    ],
    points: [
      { front: '$5p$ means', back: '$5 \\times p$.' },
      { front: '‘$3$ less than $y$’', back: '$y - 3$, not $3 - y$.' },
      { front: 'Can $2a + 3b$ be simplified?', back: 'No: $a$ and $b$ are unlike terms.' },
      { front: '$x$ on its own has coefficient', back: '$1$.' },
      { front: 'Evaluating', back: 'Substitute the value for the letter, then follow the usual order of operations.' }
    ],
    mistakes: [
      { wrong: '$3a + 4b = 7ab$.', right: 'Unlike terms cannot be added; leave it as $3a + 4b$.', misconception: 'combined-unlike-terms' },
      { wrong: 'If $n = 4$ then $3n = 34$.', right: '$3n$ means $3 \\times n = 12$.', misconception: 'juxtaposition-as-digits' },
      { wrong: '$2(x + 5) = 2x + 5$.', right: 'Multiply both terms: $2x + 10$.', misconception: 'distribute-partial' }
    ],
    examples: [
      {
        question: 'Simplify $4m + 7 - m + 2m - 3$.',
        steps: ['Collect the $m$ terms: $4m - m + 2m = 5m$.', 'Collect the numbers: $7 - 3 = 4$.', 'Result: $5m + 4$.'],
        answer: '$5m + 4$',
        verify: { kind: 'equivalent', a: '4m+7-m+2m-3', b: '5m+4' }
      },
      {
        question: 'A rectangle has length $l = 12$ cm and breadth $b = 7$ cm. Use $P = 2(l+b)$ to find its perimeter.',
        steps: ['Substitute: $P = 2(12 + 7)$.', '$= 2 \\times 19 = 38$.'],
        answer: '$38$ cm',
        verify: { kind: 'value', expr: '2*(12+7)', answer: '38' }
      }
    ]
  },

  'c7-parallel-intersecting-lines-current': {
    summary: 'When two lines cross they make pairs of angles with fixed relationships. When a third line (a transversal) cuts two parallel lines, eight angles appear, and many of them are equal or add up to $180^\\circ$. These facts let you find unknown angles and test whether lines are parallel.',
    prereqs: [],
    concepts: [
      { title: 'Linear pair', body: 'Two angles side by side on a straight line add up to $180^\\circ$.' },
      { title: 'Vertically opposite angles', body: 'When two lines cross, the angles facing each other across the crossing point are equal.' },
      { title: 'Transversal across parallel lines', body: 'Corresponding angles (same position at each crossing) are equal, and alternate angles (on opposite sides of the transversal, between the lines) are equal.' },
      { title: 'Same-side interior angles', body: 'Two angles between the parallel lines on the same side of the transversal add up to $180^\\circ$.' },
      { title: 'Testing for parallel lines', body: 'The rules also work backwards: if corresponding angles are equal, or alternate angles are equal, or same-side interior angles add to $180^\\circ$, then the lines are parallel.' }
    ],
    definitions: [
      { term: 'Parallel lines', meaning: 'Lines in a plane that never meet, however far they are extended.' },
      { term: 'Transversal', meaning: 'A line that crosses two or more other lines at different points.' },
      { term: 'Corresponding angles', meaning: 'Angles in matching positions at the two crossing points.' },
      { term: 'Alternate angles', meaning: 'Angles between the two lines, on opposite sides of the transversal.' }
    ],
    formulas: [
      { label: 'Linear pair', tex: '\\angle 1+\\angle 2=180^\\circ' },
      { label: 'Parallel lines with a transversal', tex: '\\text{corresponding equal},\\ \\text{alternate equal},\\ \\text{co-interior sum }180^\\circ' }
    ],
    points: [
      { front: 'Vertically opposite angles are', back: 'Equal.' },
      { front: 'A linear pair adds to', back: '$180^\\circ$.' },
      { front: 'Alternate angles look like', back: 'A letter Z shape between the parallel lines.' },
      { front: 'Corresponding angles look like', back: 'A letter F shape.' },
      { front: 'Same-side interior angles', back: 'Add to $180^\\circ$ when the lines are parallel (a C or U shape).' },
      { front: 'If alternate angles are unequal', back: 'The two lines are not parallel.' }
    ],
    mistakes: [
      { wrong: 'Same-side interior angles are equal.', right: 'They add up to $180^\\circ$; they are equal only if both are $90^\\circ$.' },
      { wrong: 'Corresponding angles are always equal.', right: 'Only when the two lines cut by the transversal are parallel.' },
      { wrong: 'Vertically opposite angles add up to $180^\\circ$.', right: 'They are equal; it is neighbouring angles that make $180^\\circ$.' }
    ],
    examples: [
      {
        question: 'Two parallel lines are cut by a transversal. One interior angle is $65^\\circ$. Find the interior angle on the same side of the transversal.',
        steps: ['Same-side interior angles add to $180^\\circ$.', '$180^\\circ - 65^\\circ = 115^\\circ$.'],
        answer: '$115^\\circ$',
        verify: { kind: 'value', expr: '180-65', answer: '115' }
      },
      {
        question: 'Two lines cross. One angle is $3x$ and its neighbour on the straight line is $x + 40$ (in degrees). Find $x$.',
        steps: ['They form a linear pair: $3x + x + 40 = 180$.', '$4x = 140$, so $x = 35$.'],
        answer: '$x = 35$',
        verify: { kind: 'roots', f: '3x+x+40-180', answers: ['35'] }
      }
    ]
  },

  'c7-number-play-current': {
    summary: 'Number puzzles hide simple rules. Odd and even numbers combine in predictable ways, magic squares rely on equal row and column sums, the Virahanka–Fibonacci sequence grows by adding the last two terms, and in cryptarithms careful reasoning reveals which digit each letter hides.',
    prereqs: [],
    concepts: [
      { title: 'Parity of sums', body: 'Even + even is even, odd + odd is even, and even + odd is odd. So a sum is odd exactly when it has an odd number of odd terms.' },
      { title: 'Parity of products', body: 'A product is odd only if every factor is odd. One even factor makes the whole product even.' },
      { title: 'Magic squares', body: 'In a $3 \\times 3$ magic square using $1$ to $9$, the nine numbers add to $45$, so each of the three rows adds to $15$, and the centre must be $5$.' },
      { title: 'Virahanka–Fibonacci numbers', body: 'Start $1, 2$ and keep adding the last two: $1, 2, 3, 5, 8, 13, 21, \\dots$ They count the ways to make a rhythm of a given length from short ($1$) and long ($2$) beats.' },
      { title: 'Cryptarithms', body: 'Each letter stands for one digit, different letters for different digits. Use carries and parity: in a sum of two numbers, the carry into the next column is at most $1$.' }
    ],
    definitions: [
      { term: 'Parity', meaning: 'Whether a whole number is even or odd.' },
      { term: 'Magic square', meaning: 'A grid of numbers in which every row, column and both diagonals have the same sum.' },
      { term: 'Magic sum', meaning: 'That common sum; for $1$ to $9$ in a $3 \\times 3$ square it is $15$.' },
      { term: 'Cryptarithm', meaning: 'An arithmetic puzzle where letters replace digits.' }
    ],
    formulas: [
      { label: 'Virahanka–Fibonacci rule', tex: 'V_n=V_{n-1}+V_{n-2}' },
      { label: 'Even and odd numbers', tex: '\\text{even}=2k,\\quad \\text{odd}=2k+1' }
    ],
    points: [
      { front: 'odd + odd', back: 'Even.' },
      { front: 'odd $\\times$ odd', back: 'Odd.' },
      { front: 'even $\\times$ anything', back: 'Even.' },
      { front: 'Centre of a $1$ to $9$ magic square', back: '$5$.' },
      { front: 'Next term after $13, 21$', back: '$34$.' },
      { front: 'Sum of five odd numbers', back: 'Odd, since there is an odd count of odd numbers.' }
    ],
    mistakes: [
      { wrong: 'The sum of two odd numbers is odd.', right: 'It is even: for example $3 + 5 = 8$.' },
      { wrong: 'The next Virahanka number after $8, 13$ is $18$.', right: 'Add the last two: $8 + 13 = 21$.' },
      { wrong: 'In a cryptarithm, two letters may stand for the same digit.', right: 'Different letters stand for different digits.' }
    ],
    examples: [
      {
        question: 'A $3 \\times 3$ magic square uses $1$ to $9$. One row is $8, 1, 6$. What is the magic sum, and what number goes in the centre?',
        steps: ['Row sum: $8 + 1 + 6 = 15$, which also equals $45 \\div 3$.', 'The centre of such a square is always $\\frac{15}{3} = 5$.'],
        answer: 'Magic sum $15$, centre $5$',
        verify: { kind: 'values', pairs: [['8+1+6', '15'], ['45/3/3', '5']] }
      },
      {
        question: 'Find the $8$th term of $1, 2, 3, 5, 8, \\dots$',
        steps: ['Keep adding the last two terms.', '$6$th: $5 + 8 = 13$; $7$th: $8 + 13 = 21$; $8$th: $13 + 21 = 34$.'],
        answer: '$34$',
        verify: { kind: 'value', expr: '13+21', answer: '34' }
      }
    ]
  },

  'c7-triangles-current': {
    summary: 'A triangle is made by three intersecting lines. Its three angles always add up to $180^\\circ$, and its sides must obey the triangle inequality. Triangles are named by their angles or sides, and can be drawn once you know enough measurements.',
    prereqs: ['c7-parallel-intersecting-lines-current'],
    concepts: [
      { title: 'Angle sum', body: 'Draw a line through one vertex parallel to the opposite side; alternate angles show the three angles fit together on a straight line, so they add to $180^\\circ$.' },
      { title: 'Triangle inequality', body: 'Any two sides together must be longer than the third. Lengths $3, 4, 8$ fail because $3 + 4 < 8$. It is enough to check that the two shorter sides add to more than the longest.' },
      { title: 'Naming by angles', body: 'Acute: all angles less than $90^\\circ$. Right: one angle $90^\\circ$. Obtuse: one angle more than $90^\\circ$.' },
      { title: 'Naming by sides', body: 'Equilateral: all sides equal (each angle $60^\\circ$). Isosceles: two sides equal, and the angles opposite them are equal. Scalene: no sides equal.' },
      { title: 'Altitudes and constructions', body: 'An altitude is the perpendicular from a vertex to the opposite side (extended if needed). A triangle can be drawn uniquely from three sides, two sides and the angle between them, or two angles and a side.' }
    ],
    definitions: [
      { term: 'Altitude', meaning: 'The perpendicular segment from a vertex to the line containing the opposite side.' },
      { term: 'Isosceles triangle', meaning: 'A triangle with at least two equal sides.' },
      { term: 'Scalene triangle', meaning: 'A triangle with all three sides different.' },
      { term: 'Exterior angle', meaning: 'The angle between one side and the extension of a neighbouring side; it equals the sum of the two opposite interior angles.' }
    ],
    formulas: [
      { label: 'Angle sum', tex: '\\angle A+\\angle B+\\angle C=180^\\circ' },
      { label: 'Triangle inequality', tex: 'a+b>c,\\quad b+c>a,\\quad c+a>b' },
      { label: 'Exterior angle', tex: '\\text{exterior angle}=\\text{sum of the two opposite interior angles}' }
    ],
    points: [
      { front: 'Can a triangle have two right angles?', back: 'No: the two would already total $180^\\circ$.' },
      { front: 'Each angle of an equilateral triangle', back: '$60^\\circ$.' },
      { front: 'Quick triangle-inequality check', back: 'Do the two shorter sides add to more than the longest?' },
      { front: 'Where does the altitude of an obtuse triangle fall?', back: 'The altitudes from the two acute-angled vertices fall outside the triangle, meeting the extended opposite side.' },
      { front: 'Is $5, 5, 10$ a triangle?', back: 'No: $5 + 5 = 10$ is not greater than $10$.' }
    ],
    mistakes: [
      { wrong: '$4, 5, 9$ can form a triangle since $4 + 5 = 9$.', right: 'The sum must be strictly greater; equal sums give a flat line.' },
      { wrong: 'Knowing all three angles fixes a triangle’s size.', right: 'Angles fix only the shape; triangles of many sizes have the same angles.' },
      { wrong: 'In an isosceles triangle the unequal angle is always the biggest.', right: 'It can be smaller: $70^\\circ, 70^\\circ, 40^\\circ$ is isosceles.' }
    ],
    examples: [
      {
        question: 'Two angles of a triangle are $65^\\circ$ and $48^\\circ$. Find the third, and say what kind of triangle it is.',
        steps: ['Third angle $= 180^\\circ - (65^\\circ + 48^\\circ)$.', '$= 180^\\circ - 113^\\circ = 67^\\circ$.', 'All angles are below $90^\\circ$, so it is acute.'],
        answer: '$67^\\circ$; an acute triangle',
        verify: { kind: 'value', expr: '180-(65+48)', answer: '67' }
      },
      {
        question: 'Two sides of a triangle are $6$ cm and $9$ cm. Between which values must the third side lie?',
        steps: ['It must be more than $9 - 6 = 3$.', 'It must be less than $9 + 6 = 15$.'],
        answer: 'Between $3$ cm and $15$ cm',
        verify: { kind: 'values', pairs: [['9-6', '3'], ['9+6', '15']] }
      }
    ]
  },

  'c7-fractions-current': {
    summary: 'Multiplying fractions means taking a fraction of an amount: multiply numerators and multiply denominators, cancelling common factors to keep numbers small. Dividing by a fraction is the same as multiplying by its reciprocal.',
    prereqs: [],
    concepts: [
      { title: 'Fraction of a fraction', body: '$\\frac{2}{3}$ of $\\frac{3}{4}$ means $\\frac{2}{3} \\times \\frac{3}{4} = \\frac{6}{12} = \\frac{1}{2}$.' },
      { title: 'Cancel before multiplying', body: 'Divide any numerator and any denominator by a common factor first: in $\\frac{4}{9} \\times \\frac{3}{8}$ cancel $4$ with $8$ and $3$ with $9$ to get $\\frac{1}{3} \\times \\frac{1}{2} = \\frac{1}{6}$.' },
      { title: 'Bigger or smaller?', body: 'Multiplying a positive number by a number between $0$ and $1$ makes it smaller; multiplying by a number greater than $1$ makes it larger.' },
      { title: 'Dividing with reciprocals', body: 'To divide by $\\frac{c}{d}$, multiply by $\\frac{d}{c}$. Asking ‘how many halves in $3$?’ gives $3 \\div \\frac{1}{2} = 3 \\times 2 = 6$.' }
    ],
    definitions: [
      { term: 'Reciprocal', meaning: 'The number you multiply by to get $1$; the reciprocal of $\\frac{a}{b}$ is $\\frac{b}{a}$.' },
      { term: 'Proper fraction', meaning: 'A fraction less than $1$, with numerator smaller than denominator.' },
      { term: 'Lowest terms', meaning: 'A fraction whose numerator and denominator have no common factor except $1$.' }
    ],
    formulas: [
      { label: 'Multiplying fractions', tex: '\\frac{a}{b}\\times\\frac{c}{d}=\\frac{ac}{bd}' },
      { label: 'Dividing fractions', tex: '\\frac{a}{b}\\div\\frac{c}{d}=\\frac{a}{b}\\times\\frac{d}{c}' }
    ],
    points: [
      { front: '‘of’ means', back: 'Multiply.' },
      { front: 'Reciprocal of $5$', back: '$\\frac{1}{5}$.' },
      { front: 'Dividing by $\\frac{1}{4}$', back: 'Same as multiplying by $4$, so the answer gets bigger.' },
      { front: 'Mixed numbers', back: 'Turn them into improper fractions before multiplying or dividing.' },
      { front: '$\\frac{3}{5} \\times 20$', back: '$12$.' }
    ],
    mistakes: [
      { wrong: '$\\frac{2}{3} \\div \\frac{4}{5} = \\frac{3}{2} \\times \\frac{4}{5}$.', right: 'Flip the divisor, not the first fraction: $\\frac{2}{3} \\times \\frac{5}{4} = \\frac{5}{6}$.', misconception: 'reciprocal-flip' },
      { wrong: 'Multiplying always makes a number bigger.', right: '$12 \\times \\frac{1}{3} = 4$, which is smaller.' },
      { wrong: '$1\\frac{1}{2} \\times 2\\frac{1}{3} = 2\\frac{1}{6}$ (multiplying parts separately).', right: 'Use improper fractions: $\\frac{3}{2} \\times \\frac{7}{3} = \\frac{7}{2} = 3\\frac{1}{2}$.' }
    ],
    examples: [
      {
        question: 'A ribbon is $\\frac{9}{10}$ m long. Meena uses $\\frac{2}{3}$ of it. How much does she use?',
        steps: ['$\\frac{2}{3} \\times \\frac{9}{10}$.', 'Cancel $3$ with $9$ and $2$ with $10$: $\\frac{1}{1} \\times \\frac{3}{5}$.'],
        answer: '$\\frac{3}{5}$ m',
        verify: { kind: 'value', expr: '(2/3)*(9/10)', answer: '3/5' }
      },
      {
        question: 'How many pieces of length $\\frac{3}{4}$ m can be cut from $6$ m of rope?',
        steps: ['$6 \\div \\frac{3}{4} = 6 \\times \\frac{4}{3}$.', '$= \\frac{24}{3} = 8$.'],
        answer: '$8$ pieces',
        verify: { kind: 'value', expr: '6/(3/4)', answer: '8' }
      }
    ]
  },

  'c7-geometric-twins-current': {
    summary: 'Figures that match exactly in shape and size are congruent. For triangles we do not need to check all six parts; certain sets of three matching measurements (SSS, SAS, ASA, AAS, RHS) are enough. Once triangles are known to be congruent, their other matching parts are equal too.',
    prereqs: ['c7-triangles-current'],
    concepts: [
      { title: 'Congruence', body: 'Two figures are congruent if one can be placed exactly on the other, possibly after turning or flipping it. Write $\\triangle ABC \\cong \\triangle PQR$ with matching vertices in the same order.' },
      { title: 'Side conditions', body: 'SSS: all three sides match. SAS: two sides and the angle between them match.' },
      { title: 'Angle conditions', body: 'ASA: two angles and the side between them match. AAS: two angles and a side not between them match (the third angles agree anyway). RHS: in right triangles, the hypotenuse and one other side match.' },
      { title: 'What is not enough', body: 'AAA only fixes shape, not size. SSA (two sides and an angle not between them) can give two different triangles.' },
      { title: 'Using congruence', body: 'After proving two triangles congruent, every pair of corresponding sides and angles is equal, which helps find unknown lengths and angles.' }
    ],
    definitions: [
      { term: 'Congruent', meaning: 'Same shape and same size.' },
      { term: 'Corresponding parts', meaning: 'Sides or angles that land on each other when the figures are matched.' },
      { term: 'Hypotenuse', meaning: 'The side opposite the right angle in a right triangle; the longest side.' }
    ],
    formulas: [
      { label: 'Valid congruence tests', tex: '\\text{SSS},\\ \\text{SAS},\\ \\text{ASA},\\ \\text{AAS},\\ \\text{RHS}' },
      { label: 'Notation', tex: '\\triangle ABC\\cong\\triangle PQR\\Rightarrow AB=PQ,\\ \\angle B=\\angle Q' }
    ],
    points: [
      { front: 'Is AAA a congruence test?', back: 'No; it gives same shape but possibly different size.' },
      { front: 'Is SSA a congruence test?', back: 'No; it can produce two different triangles.' },
      { front: 'In SAS the angle must be', back: 'Between the two given sides.' },
      { front: 'RHS applies only to', back: 'Right-angled triangles.' },
      { front: 'Order in $\\triangle ABC \\cong \\triangle XYZ$', back: '$A$ matches $X$, $B$ matches $Y$, $C$ matches $Z$.' }
    ],
    mistakes: [
      { wrong: 'Two triangles with equal angles are congruent.', right: 'Equal angles give the same shape only; sizes can differ.' },
      { wrong: 'From $\\triangle ABC \\cong \\triangle PQR$, $AB = QR$.', right: 'Match in order: $AB = PQ$.', misconception: 'sides-mismatched' },
      { wrong: 'Two sides and any angle prove congruence.', right: 'The angle must be the included one (SAS), unless it is a right angle with the hypotenuse given (RHS).' }
    ],
    examples: [
      {
        question: '$\\triangle ABC \\cong \\triangle DEF$. If $\\angle A = 50^\\circ$ and $\\angle B = 70^\\circ$, find $\\angle F$.',
        steps: ['$\\angle F$ corresponds to $\\angle C$.', '$\\angle C = 180^\\circ - (50^\\circ + 70^\\circ) = 60^\\circ$.'],
        answer: '$60^\\circ$',
        verify: { kind: 'value', expr: '180-(50+70)', answer: '60' }
      },
      {
        question: 'In isosceles $\\triangle PQR$, $PQ = PR$ and $\\angle Q = 72^\\circ$. Find $\\angle P$.',
        steps: ['Equal sides give equal opposite angles: $\\angle R = 72^\\circ$.', '$\\angle P = 180^\\circ - 2 \\times 72^\\circ = 36^\\circ$.'],
        answer: '$36^\\circ$',
        verify: { kind: 'value', expr: '180-2*72', answer: '36' }
      }
    ]
  },

  'c7-integer-operations-current': {
    summary: 'Multiplying and dividing integers follows simple sign rules: same signs give a positive answer and different signs give a negative answer. The usual properties of multiplication still hold, which helps in evaluating longer expressions.',
    prereqs: ['c7-arithmetic-expressions-current'],
    concepts: [
      { title: 'Why negative times positive is negative', body: '$3 \\times (-4)$ is three lots of $-4$: $-4 - 4 - 4 = -12$.' },
      { title: 'Why negative times negative is positive', body: 'Look at the pattern $-3 \\times 2 = -6$, $-3 \\times 1 = -3$, $-3 \\times 0 = 0$: each step adds $3$, so $-3 \\times (-1) = 3$.' },
      { title: 'Division follows the same signs', body: 'Since division undoes multiplication, $(-12) \\div 3 = -4$ and $(-12) \\div (-3) = 4$. Division by $0$ is not defined.' },
      { title: 'Properties still work', body: 'Integer multiplication is commutative and associative, and distributes over addition: $(-5) \\times 103 = (-5)(100) + (-5)(3) = -515$.' },
      { title: 'Counting negatives', body: 'A product of non-zero integers is negative when it has an odd number of negative factors, and positive when it has an even number.' }
    ],
    definitions: [
      { term: 'Integer', meaning: 'A whole number or its negative: $\\dots, -2, -1, 0, 1, 2, \\dots$' },
      { term: 'Additive inverse', meaning: 'The number that adds to give $0$; for $7$ it is $-7$.' },
      { term: 'Multiplicative identity', meaning: '$1$, because $a \\times 1 = a$.' }
    ],
    formulas: [
      { label: 'Sign rules', tex: '(+)(+)=+,\\ (-)(-)=+,\\ (+)(-)=-,\\ (-)(+)=-' },
      { label: 'Distributive property', tex: 'a(b+c)=ab+ac' }
    ],
    points: [
      { front: '$(-6) \\times (-7)$', back: '$42$.' },
      { front: '$(-36) \\div 4$', back: '$-9$.' },
      { front: 'Sign of $(-1)^{5}$', back: 'Negative: five negative factors.' },
      { front: 'Anything times $0$', back: '$0$.' },
      { front: 'Is $(-8) \\div 2 = 2 \\div (-8)$?', back: 'No; division is not commutative.' }
    ],
    mistakes: [
      { wrong: '$(-4) \\times (-5) = -20$.', right: 'Same signs give a positive product: $20$.', misconception: 'sign-flipped' },
      { wrong: '$-3^2 = 9$.', right: 'The square applies only to $3$: $-3^2 = -9$, while $(-3)^2 = 9$.', misconception: 'negative-squared' },
      { wrong: '$(-2)(-3)(-4) = 24$.', right: 'Three negatives give a negative: $-24$.' }
    ],
    examples: [
      {
        question: 'Evaluate $(-8) \\times 3 + (-24) \\div (-6) - 5$.',
        steps: ['$(-8) \\times 3 = -24$.', '$(-24) \\div (-6) = 4$.', '$-24 + 4 - 5 = -25$.'],
        answer: '$-25$',
        verify: { kind: 'value', expr: '(-8)*3+(-24)/(-6)-5', answer: '-25' }
      },
      {
        question: 'A diver goes down $4$ m every minute. Where is she after $7$ minutes, measured from the surface?',
        steps: ['Each minute is a change of $-4$ m.', '$7 \\times (-4) = -28$.'],
        answer: '$-28$ m (28 m below the surface)',
        verify: { kind: 'value', expr: '7*(-4)', answer: '-28' }
      }
    ]
  },

  'c7-common-ground-current': {
    summary: 'Numbers often share factors and multiples. The highest common factor (HCF) is the largest number dividing them all; the lowest common multiple (LCM) is the smallest number they all divide. Prime factorisation finds both quickly, and real problems tell you which one you need.',
    prereqs: [],
    concepts: [
      { title: 'Common factors and HCF', body: 'Factors of $12$: $1, 2, 3, 4, 6, 12$. Factors of $18$: $1, 2, 3, 6, 9, 18$. Common ones: $1, 2, 3, 6$, so the HCF is $6$.' },
      { title: 'Common multiples and LCM', body: 'Multiples of $4$: $4, 8, 12, 16, \\dots$; of $6$: $6, 12, 18, \\dots$ The first shared one, $12$, is the LCM.' },
      { title: 'Using prime factors', body: 'Write each number as a product of primes. HCF: take each shared prime with the smaller power. LCM: take every prime that appears with the larger power.' },
      { title: 'Which one to use?', body: 'Splitting things into the largest equal groups or tiles with no leftover calls for the HCF. Finding when repeating events next happen together calls for the LCM.' }
    ],
    definitions: [
      { term: 'Factor', meaning: 'A number that divides another exactly.' },
      { term: 'Multiple', meaning: 'A number obtained by multiplying by a whole number.' },
      { term: 'Prime number', meaning: 'A number greater than $1$ whose only factors are $1$ and itself.' },
      { term: 'Co-prime numbers', meaning: 'Numbers whose HCF is $1$, like $8$ and $15$.' }
    ],
    formulas: [
      { label: 'HCF and LCM of two numbers', tex: '\\text{HCF}(a,b)\\times\\text{LCM}(a,b)=a\\times b' }
    ],
    points: [
      { front: 'HCF of co-prime numbers', back: '$1$.' },
      { front: 'LCM of co-prime numbers', back: 'Their product.' },
      { front: 'Bells ringing together again', back: 'Use the LCM.' },
      { front: 'Largest square tile for a floor', back: 'Use the HCF of the floor’s length and breadth.' },
      { front: 'The HCF always divides', back: 'The LCM.' }
    ],
    mistakes: [
      { wrong: 'The LCM of $6$ and $8$ is $48$.', right: '$48$ is a common multiple, but the lowest is $24$.' },
      { wrong: 'HCF means the highest number in the list of common multiples.', right: 'HCF comes from common factors; multiples go on for ever.' },
      { wrong: 'For HCF with primes, take the higher powers.', right: 'Higher powers give the LCM; the HCF uses the lower powers of shared primes.' }
    ],
    examples: [
      {
        question: 'Find the HCF and LCM of $36$ and $60$.',
        steps: ['$36 = 2^2 \\times 3^2$ and $60 = 2^2 \\times 3 \\times 5$.', 'HCF $= 2^2 \\times 3 = 12$.', 'LCM $= 2^2 \\times 3^2 \\times 5 = 180$.', 'Check: $12 \\times 180 = 2160 = 36 \\times 60$.'],
        answer: 'HCF $12$, LCM $180$',
        verify: { kind: 'values', pairs: [['2^2*3', '12'], ['2^2*3^2*5', '180'], ['36*60/12', '180']] }
      },
      {
        question: 'Two buses leave a stop together, one every $15$ minutes and one every $20$ minutes. After how many minutes do they next leave together?',
        steps: ['We need the LCM of $15$ and $20$.', '$15 = 3 \\times 5$, $20 = 2^2 \\times 5$.', 'LCM $= 2^2 \\times 3 \\times 5 = 60$.'],
        answer: '$60$ minutes',
        verify: { kind: 'value', expr: '2^2*3*5', answer: '60' }
      }
    ]
  },

  'c7-decimal-operations-current': {
    summary: 'Multiplying and dividing decimals uses place value. Multiply as whole numbers and then place the point; to divide, scale both numbers by a power of ten so you divide by a whole number. Multiplying or dividing by $10, 100, 1000$ simply shifts digits, which makes metric conversions easy.',
    prereqs: ['c7-decimals-current'],
    concepts: [
      { title: 'Shifting by powers of ten', body: 'Multiplying by $10$ moves every digit one place to the left: $3.47 \\times 10 = 34.7$. Dividing by $100$ moves digits two places right: $3.47 \\div 100 = 0.0347$.' },
      { title: 'Multiplying decimals', body: 'Ignore the points, multiply, then give the answer as many decimal places as the two numbers have together: $0.3 \\times 0.12 = 0.036$ ($1 + 2 = 3$ places).' },
      { title: 'Dividing decimals', body: 'Multiply both numbers by the same power of ten to make the divisor whole: $4.8 \\div 0.06 = 480 \\div 6 = 80$.' },
      { title: 'Metric conversions', body: '$1$ km $= 1000$ m, $1$ m $= 100$ cm, $1$ kg $= 1000$ g, $1$ L $= 1000$ mL. Convert by multiplying or dividing by these powers of ten.' }
    ],
    definitions: [
      { term: 'Decimal places', meaning: 'The number of digits after the decimal point.' },
      { term: 'Power of ten', meaning: 'Numbers like $10, 100, 1000$, made by multiplying $10$ by itself.' },
      { term: 'Divisor', meaning: 'The number you divide by.' }
    ],
    formulas: [
      { label: 'Scaling a division', tex: 'a\\div b=(a\\times 10^n)\\div(b\\times 10^n)' },
      { label: 'Metric units', tex: '1\\text{ km}=1000\\text{ m},\\quad 1\\text{ kg}=1000\\text{ g}' }
    ],
    points: [
      { front: '$0.5 \\times 0.5$', back: '$0.25$.' },
      { front: '$2.5 \\div 0.5$', back: '$5$.' },
      { front: '$750$ g in kg', back: '$0.75$ kg.' },
      { front: 'Multiplying by $0.1$', back: 'Is the same as dividing by $10$.' },
      { front: 'Dividing a positive number by a decimal between $0$ and $1$', back: 'Gives an answer larger than the number you started with.' }
    ],
    mistakes: [
      { wrong: '$0.2 \\times 0.3 = 0.6$.', right: 'Two decimal places in total: $0.06$.' },
      { wrong: '$1.2 \\div 0.4 = 0.3$.', right: 'Scale up: $12 \\div 4 = 3$.' },
      { wrong: '$2.5$ km $= 250$ m.', right: 'Multiply by $1000$: $2500$ m.' }
    ],
    examples: [
      {
        question: 'Rice costs ₹$48.5$ per kg. What do $3.2$ kg cost?',
        steps: ['$485 \\times 32 = 15520$.', 'Total decimal places: $1 + 1 = 2$, giving $155.20$.'],
        answer: '₹$155.20$',
        verify: { kind: 'value', expr: '48.5*3.2', answer: '155.2' }
      },
      {
        question: 'A $7.2$ m rod is cut into pieces of $0.45$ m. How many pieces are there?',
        steps: ['Multiply both by $100$: $720 \\div 45$.', '$720 \\div 45 = 16$.'],
        answer: '$16$ pieces',
        verify: { kind: 'value', expr: '7.2/0.45', answer: '16' }
      }
    ]
  },

  'c7-connecting-dots-current': {
    summary: 'Statistics starts with a question whose answer varies, so we collect data. We summarise data with a typical value (mean, median or mode) and describe how spread out it is with the range. Choosing the right summary matters, especially when one value is unusually large or small.',
    prereqs: [],
    concepts: [
      { title: 'Statistical questions', body: '‘How tall am I?’ has one answer. ‘How tall are students in my class?’ expects many different answers, so it is a statistical question.' },
      { title: 'Mean', body: 'Add all values and divide by how many there are. It shares the total out equally.' },
      { title: 'Median', body: 'Arrange the values in order and take the middle one; with an even count, take the mean of the two middle values.' },
      { title: 'Mode', body: 'The value that appears most often. A data set can have more than one mode.' },
      { title: 'Effect of unusual values', body: 'One very large value pulls the mean up a lot but hardly changes the median, so the median often describes ‘typical’ better.' },
      { title: 'Range', body: 'Highest value minus lowest value; a bigger range means the data are more spread out.' }
    ],
    definitions: [
      { term: 'Data', meaning: 'Facts or numbers collected to answer a question.' },
      { term: 'Mean (average)', meaning: 'Sum of the values divided by the number of values.' },
      { term: 'Median', meaning: 'The middle value of ordered data.' },
      { term: 'Mode', meaning: 'The most frequent value.' },
      { term: 'Range', meaning: 'Largest value minus smallest value.' }
    ],
    formulas: [
      { label: 'Mean', tex: '\\text{mean}=\\frac{\\text{sum of values}}{\\text{number of values}}' },
      { label: 'Range', tex: '\\text{range}=\\text{highest}-\\text{lowest}' }
    ],
    points: [
      { front: 'Before finding the median', back: 'Put the data in order.' },
      { front: 'Median of $4$ values', back: 'Mean of the 2nd and 3rd ordered values.' },
      { front: 'Which is affected more by an extreme value?', back: 'The mean.' },
      { front: 'Can the mean be a value not in the data?', back: 'Yes, for example the mean of $1$ and $2$ is $1.5$.' },
      { front: 'Range measures', back: 'Spread, not the typical value.' }
    ],
    mistakes: [
      { wrong: 'The median of $7, 2, 9$ is $2$ (the middle one as written).', right: 'Order first: $2, 7, 9$, so the median is $7$.' },
      { wrong: 'Range of $3, 8, 15$ is $15$.', right: 'Range $= 15 - 3 = 12$.' },
      { wrong: 'Mean of $4, 6, 11$ is $(4 + 6 + 11) \\div 2$.', right: 'Divide by the count, $3$: the mean is $7$.' }
    ],
    examples: [
      {
        question: 'Runs scored in six matches: $12, 45, 30, 12, 51, 36$. Find the mean, median, mode and range.',
        steps: ['Sum $= 186$; mean $= 186 \\div 6 = 31$.', 'Ordered: $12, 12, 30, 36, 45, 51$; median $= \\frac{30 + 36}{2} = 33$.', 'Mode $= 12$ (appears twice).', 'Range $= 51 - 12 = 39$.'],
        answer: 'Mean $31$, median $33$, mode $12$, range $39$',
        verify: { kind: 'values', pairs: [['(12+45+30+12+51+36)/6', '31'], ['(30+36)/2', '33'], ['51-12', '39']] }
      },
      {
        question: 'Pocket money of five friends (in ₹): $40, 50, 50, 60, 300$. Compare the mean and median.',
        steps: ['Mean $= \\frac{500}{5} = 100$.', 'Median is the middle value, $50$.', 'The ₹$300$ pulls the mean up; the median better shows what most get.'],
        answer: 'Mean ₹$100$, median ₹$50$',
        verify: { kind: 'values', pairs: [['(40+50+50+60+300)/5', '100'], ['50', '50']] }
      }
    ]
  },

  'c7-constructions-tilings-current': {
    summary: 'With only a ruler and compass you can bisect a segment, bisect an angle and build angles such as $60^\\circ$, $90^\\circ$, $30^\\circ$ and $45^\\circ$. Tilings cover a region with shapes leaving no gaps and no overlaps, and clever colouring arguments can prove some regions impossible to tile.',
    prereqs: ['c7-triangles-current'],
    concepts: [
      { title: 'Perpendicular bisector', body: 'Draw equal arcs from both ends of a segment, above and below. The line through the two crossing points cuts the segment in half at $90^\\circ$. Every point on it is the same distance from both ends.' },
      { title: 'Angle bisector', body: 'From the vertex, mark equal distances on both arms; from those marks draw equal arcs that cross. The line from the vertex through the crossing splits the angle into two equal halves.' },
      { title: 'Standard angles', body: 'An equilateral triangle gives $60^\\circ$; bisecting gives $30^\\circ$. A perpendicular gives $90^\\circ$; bisecting gives $45^\\circ$. $60^\\circ + 60^\\circ = 120^\\circ$.' },
      { title: 'Tilings', body: 'A tiling covers a flat region with no gaps and no overlaps. Around each meeting point the angles must add to $360^\\circ$; that is why equilateral triangles, squares and regular hexagons tile.' },
      { title: 'Colouring arguments', body: 'Colour an $8 \\times 8$ board like a chessboard. Each domino covers one black and one white square. Remove two opposite corners (same colour) and you leave $32$ of one colour and $30$ of the other, so dominoes cannot tile it.' }
    ],
    definitions: [
      { term: 'Bisect', meaning: 'Cut into two equal parts.' },
      { term: 'Perpendicular bisector', meaning: 'The line that cuts a segment in half at right angles.' },
      { term: 'Tiling (tessellation)', meaning: 'A covering of a region by shapes with no gaps or overlaps.' },
      { term: 'Invariant', meaning: 'A quantity that stays the same no matter how pieces are placed, used to prove something is impossible.' }
    ],
    formulas: [
      { label: 'Angles around a tiling point', tex: '\\text{sum of angles at a vertex}=360^\\circ' },
      { label: 'Interior angle of a regular hexagon', tex: '120^\\circ,\\quad 3\\times120^\\circ=360^\\circ' }
    ],
    points: [
      { front: 'Points on a perpendicular bisector', back: 'Are equally far from both ends of the segment.' },
      { front: 'How to get $30^\\circ$', back: 'Construct $60^\\circ$ and bisect it.' },
      { front: 'How to get $45^\\circ$', back: 'Construct $90^\\circ$ and bisect it.' },
      { front: 'Do regular pentagons tile?', back: 'No: $108^\\circ$ does not divide $360^\\circ$ exactly.' },
      { front: 'What does a domino always cover on a chessboard?', back: 'One black and one white square.' }
    ],
    mistakes: [
      { wrong: 'Arcs for a perpendicular bisector can use any two different radii.', right: 'Use the same radius from both ends, more than half the segment.' },
      { wrong: 'Any regular polygon can tile the plane.', right: 'Only triangles, squares and hexagons among regular polygons do.' },
      { wrong: 'A board with $62$ squares can always be tiled by $31$ dominoes.', right: 'Having an even count is not enough; the black and white counts must also be equal.' }
    ],
    examples: [
      {
        question: 'A regular octagon has interior angles of $135^\\circ$. If two octagons meet at a point, what angle is left to fill, and which shape fills it?',
        steps: ['Two octagons use $2 \\times 135^\\circ = 270^\\circ$.', 'Left over: $360^\\circ - 270^\\circ = 90^\\circ$.', 'A square fills a $90^\\circ$ gap.'],
        answer: '$90^\\circ$, filled by a square',
        verify: { kind: 'value', expr: '360-2*135', answer: '90' }
      },
      {
        question: 'An $8 \\times 8$ chessboard loses two opposite corners. How many black and white squares remain if both corners were white?',
        steps: ['The board has $32$ white and $32$ black squares.', 'Removing two white squares leaves $30$ white and $32$ black.', 'Each domino covers one of each colour, so tiling is impossible.'],
        answer: '$30$ white, $32$ black; it cannot be tiled by dominoes',
        verify: { kind: 'values', pairs: [['64/2-2', '30'], ['64/2', '32']] }
      }
    ]
  },

  'c7-finding-unknown-current': {
    summary: 'An equation says two expressions are equal. Like a balanced scale, it stays balanced if you do the same thing to both sides. Using inverse operations step by step, we find the value of the unknown, and we can build equations from word problems and patterns.',
    prereqs: ['c7-letter-numbers-current'],
    concepts: [
      { title: 'The balance idea', body: 'In $x + 5 = 12$, both sides weigh the same. Taking $5$ from both sides keeps the balance and leaves $x = 7$.' },
      { title: 'Inverse operations', body: 'Undo addition with subtraction and multiplication with division. To solve $4x = 28$, divide both sides by $4$: $x = 7$.' },
      { title: 'Two-step equations', body: 'Undo in reverse order: for $3x - 4 = 17$, first add $4$ ($3x = 21$), then divide by $3$ ($x = 7$).' },
      { title: 'Unknowns on both sides', body: 'Move letter terms to one side and numbers to the other by doing the same to both sides: $5x + 2 = 3x + 10$ gives $2x = 8$, so $x = 4$.' },
      { title: 'Checking', body: 'Put your answer back into the original equation; both sides should give the same number.' }
    ],
    definitions: [
      { term: 'Equation', meaning: 'A statement that two expressions are equal, such as $2x + 1 = 9$.' },
      { term: 'Solution', meaning: 'The value of the unknown that makes the equation true.' },
      { term: 'Inverse operation', meaning: 'An operation that undoes another, like subtraction for addition.' }
    ],
    formulas: [
      { label: 'Solving $ax + b = c$', tex: 'ax+b=c\\ \\Rightarrow\\ x=\\frac{c-b}{a}' },
      { label: 'Golden rule', tex: '\\text{same operation on both sides keeps the equality}' }
    ],
    points: [
      { front: 'First step for $x - 9 = 4$', back: 'Add $9$ to both sides: $x = 13$.' },
      { front: 'Solve $\\frac{x}{5} = 6$', back: 'Multiply both sides by $5$: $x = 30$.' },
      { front: 'Order of undoing in $2x + 3 = 15$', back: 'Subtract $3$ first, then divide by $2$.' },
      { front: 'How to check a solution', back: 'Substitute it into both sides of the original equation.' },
      { front: '‘A number doubled plus $7$ is $31$’', back: '$2n + 7 = 31$, so $n = 12$.' }
    ],
    mistakes: [
      { wrong: '$x + 6 = 10$ so $x = 16$.', right: 'Undo $+6$ by subtracting: $x = 4$.', misconception: 'wrong-inverse-operation' },
      { wrong: 'From $3x = 12$, subtracting $3$ gives $x = 9$.', right: '$3x$ means $3 \\times x$, so divide: $x = 4$.', misconception: 'wrong-inverse-operation' },
      { wrong: 'From $2x + 5 = 11$, writing $2x = 11 + 5$.', right: 'Subtract $5$ from both sides: $2x = 6$, so $x = 3$.', misconception: 'sign-on-transfer' }
    ],
    examples: [
      {
        question: 'Solve $7x - 9 = 4x + 15$.',
        steps: ['Subtract $4x$ from both sides: $3x - 9 = 15$.', 'Add $9$: $3x = 24$.', 'Divide by $3$: $x = 8$.', 'Check: $7(8) - 9 = 47$ and $4(8) + 15 = 47$.'],
        answer: '$x = 8$',
        verify: { kind: 'roots', f: '7x-9-(4x+15)', answers: ['8'] }
      },
      {
        question: 'Asha is $3$ times as old as her brother. Together their ages add up to $32$. How old is her brother?',
        steps: ['Let the brother be $b$ years; Asha is $3b$.', '$b + 3b = 32$, so $4b = 32$.', '$b = 8$.'],
        answer: '$8$ years',
        verify: { kind: 'roots', f: 'b+3b-32', var: 'b', answers: ['8'] }
      }
    ]
  }
};
