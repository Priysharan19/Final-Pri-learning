// Pri Learning · Experience 3 layer for CBSE Class 7 notes (see notes/e3.js). Original writing.
// Ganita Prakash Grade 7, Parts I and II: the fifteen `*-current` chapters of IN_CURRICULUM.
// Every number below was computed with the engine (client/src/engine/expr.js), not typed from memory.
export default {
  // ── Part I ────────────────────────────────────────────────────────────────
  'c7-large-numbers-current': {
    objective: 'Read and write large numbers in the Indian and the international systems, round them to a useful place, and compare two quantities by finding how many times one fits into the other.',
    intuition: 'Every place is worth ten of the place to its right, in both systems. The only difference is where the commas go: the Indian system names every second place after a thousand (lakh, crore), the international system every third (million, billion). So $1{,}00{,}00{,}000$ and $10{,}000{,}000$ are the same number, one crore or ten million, written with different commas. To feel how big a number is, divide: a crore is $100$ lakh, and a lakh is $100$ thousand.',
    diagrams: [
      {
        title: 'Ten lakh is a million, and ten of those make a crore',
        spec: { kind: 'numberLineStepper', op: 'multiply', a: 10, b: 10, min: 0, max: 100, step: 10 },
        note: 'The line counts in lakh. Each jump is $10$ lakh, which is $1$ million. Ten jumps land on $100$ lakh, which is $1$ crore, so $1$ crore $=10$ million.'
      },
      {
        title: 'Rounding $3{,}46{,}000$ to the nearest lakh',
        spec: { kind: 'numberLine', min: 3, max: 4, step: 0.1, points: [{ value: 3.46, label: '3{,}46{,}000' }] },
        note: 'The line runs from $3$ lakh to $4$ lakh in steps of $10{,}000$. The point $3.46$ lakh is short of the halfway mark $3.5$ lakh, because $46{,}000$ is less than $50{,}000$. So it rounds down to $3{,}00{,}000$.'
      }
    ],
    check: [
      {
        question: 'Write $4{,}07{,}30{,}500$ in words in the Indian system, then write it with international commas.',
        answer: 'Four crore seven lakh thirty thousand five hundred; $40{,}730{,}500$.',
        verify: { kind: 'value', expr: '4*10^7+7*10^5+3*10^4+5*10^2', answer: '40730500' }
      },
      {
        question: 'Round $7{,}68{,}45{,}210$ to the nearest lakh.',
        answer: 'The ten-thousands digit is $4$, so round down: $7{,}68{,}00{,}000$.',
        verify: { kind: 'value', expr: 'floor(76845210/10^5+0.5)*10^5', answer: '76800000' }
      },
      {
        question: 'A city has $1$ crore $20$ lakh people. A cricket stadium seats $60{,}000$. How many full stadiums would the whole city fill?',
        answer: '$1{,}20{,}00{,}000 \\div 60{,}000 = 200$ stadiums.',
        verify: { kind: 'value', expr: '(10^7+20*10^5)/60000', answer: '200' }
      }
    ]
  },

  'c7-arithmetic-expressions-current': {
    objective: 'Find the value of an arithmetic expression by splitting it into terms, working brackets first, handling a minus sign in front of a bracket, and using the distributive property to calculate quickly.',
    intuition: 'Read an expression as a list of terms to be added, where each minus sign belongs to the term after it: $30-4\\times5$ has the terms $30$ and $-20$. A bracket turns a whole calculation into one term. A minus sign in front of a bracket takes away everything inside, so if the bracket itself takes something away, that part comes back: $20-(8-3)=20-8+3$.',
    diagrams: [
      {
        title: 'Taking away $8-3$ from $20$',
        spec: { kind: 'numberLine', min: 0, max: 22, step: 2, points: [{ value: 20, label: '20' }, { value: 12, label: '12' }, { value: 15, label: '15' }] },
        note: 'Start at $20$. Taking away $8$ lands on $12$, but only $8-3=5$ was meant to be taken away, so $3$ comes back and you finish at $15$. That is why $20-(8-3)=20-8+3=15$.'
      },
      {
        title: 'The bracket as one jump',
        spec: { kind: 'numberLineStepper', op: 'subtract', a: 20, b: 5, min: 0, max: 20, step: 1 },
        note: 'Work the bracket first and $20-(8-3)$ is one jump of $5$ back from $20$. It lands on $15$, the same place as going back $8$ and forward $3$.'
      },
      {
        title: '$23\\times14$ as four rectangles',
        spec: { kind: 'areaModel', rows: [{ size: 20, label: '20' }, { size: 3, label: '3' }], cols: [{ size: 10, label: '10' }, { size: 4, label: '4' }], cells: [['200', '80'], ['30', '12']] },
        note: 'Split $23$ into $20+3$ and $14$ into $10+4$. The four parts are $200$, $80$, $30$ and $12$, and together they make $23\\times14=322$.'
      }
    ],
    check: [
      {
        question: 'Find the value of $45-(12-5)+2\\times6$.',
        answer: '$45-7+12=50$.',
        verify: { kind: 'value', expr: '45-(12-5)+2*6', answer: '50' }
      },
      {
        question: 'Use the distributive property to find $8\\times97$.',
        answer: '$8\\times(100-3)=800-24=776$.',
        verify: { kind: 'value', expr: '8*(100-3)', answer: '776' }
      },
      {
        question: 'Ravi has ₹$500$. He buys $3$ notebooks at ₹$45$ each and one pen for ₹$20$. Write one expression for the money left, then find it.',
        answer: '$500-(3\\times45+20)=500-155$, so ₹$345$ is left.',
        verify: { kind: 'value', expr: '500-(3*45+20)', answer: '345' }
      }
    ]
  },

  'c7-decimals-current': {
    objective: 'Say what each digit after the decimal point is worth, compare decimals place by place, and add or subtract decimals by lining up the points.',
    intuition: 'Cut one whole into $10$ equal strips: each strip is a tenth. Cut one strip into $10$ again: each small piece is a hundredth. So $0.3$ is three strips, while $0.25$ is two strips and five small pieces, which is less. The number of digits after the point does not tell you which decimal is bigger; the place of the first digit that differs does.',
    diagrams: [
      {
        title: '$0.3$ and $0.25$ of the same whole',
        spec: { kind: 'fractionBar', bars: [{ parts: 10, shaded: 3, label: '0.3' }, { parts: 20, shaded: 5, label: '0.25' }] },
        note: 'Both bars are the same whole. The first shades $3$ tenths. The second is cut into $20$ parts of $5$ hundredths each and shades $5$ of them: $25$ hundredths, which is $2$ tenths and $5$ hundredths. The first shaded part is longer, so $0.3>0.25$.'
      },
      {
        title: '$0.507$ and $0.57$ between $0.5$ and $0.6$',
        spec: { kind: 'numberLine', min: 0.5, max: 0.6, step: 0.01, points: [{ value: 0.507, label: '0.507' }, { value: 0.57, label: '0.57' }] },
        note: 'The line is cut into hundredths. $0.507$ sits just past $0.50$, before the first mark; $0.57$ sits at the seventh mark. So $0.507<0.57$, even though $507$ is bigger than $57$.'
      },
      {
        title: 'Adding $3.5$ and $1.25$',
        spec: { kind: 'numberLineStepper', op: 'add', a: 3.5, b: 1.25, min: 0, max: 6, step: 0.25 },
        note: 'Start at $3.5$ and jump forward $1.25$, one whole and one quarter. You land on $4.75$, not on $1.60$: tenths must be added to tenths, so the points are lined up.'
      }
    ],
    check: [
      {
        question: 'Which is greater, $0.6$ or $0.58$? By how much?',
        answer: '$0.6$ is greater, since $6$ tenths beat $5$ tenths. The difference is $0.60-0.58=0.02$.',
        verify: { kind: 'value', expr: '0.6-0.58', answer: '0.02' }
      },
      {
        question: 'Write $7+\\tfrac{4}{10}+\\tfrac{9}{1000}$ as a decimal.',
        answer: '$7.409$. There are no hundredths, so that place holds a $0$.',
        verify: { kind: 'value', expr: '7+4/10+9/1000', answer: '7.409' }
      },
      {
        question: 'Anita runs $2.75$ km on Monday and $3.4$ km on Tuesday. How much farther must she run to complete $10$ km?',
        answer: '$2.75+3.40=6.15$, and $10-6.15=3.85$ km.',
        verify: { kind: 'value', expr: '10-(2.75+3.4)', answer: '3.85' }
      }
    ]
  },

  'c7-letter-numbers-current': {
    objective: 'Write an expression with letter-numbers for a pattern or a word description, collect like terms to simplify it, and find its value when the letters are given numbers.',
    intuition: 'Make a row of squares from matchsticks. The first square needs $4$ sticks, and every square after it needs only $3$ more, because it shares a side. So $n$ squares need $3n+1$ sticks. The letter $n$ holds the place of any number of squares, and one short expression replaces a whole table of answers.',
    diagrams: [
      {
        title: 'Matchsticks for $n$ squares in a row',
        spec: { kind: 'sequenceExplorer', type: 'arithmetic', first: 4, step: 3, n: 8 },
        note: 'The bars are the stick counts $4, 7, 10, 13, \\dots$ for $1, 2, 3, 4, \\dots$ squares. Each bar is $3$ taller than the one before, which is the $3n$ in $3n+1$. The eighth bar is $3\\times8+1=25$.'
      },
      {
        title: '$2(x+5)$ as a rectangle',
        spec: { kind: 'areaModel', rows: [{ size: 2, label: '2' }], cols: [{ size: 4, label: 'x' }, { size: 5, label: '5' }], cells: [['2x', '10']] },
        note: 'A rectangle $2$ high and $x+5$ long has two parts, $2x$ and $10$. So $2(x+5)=2x+10$: the $2$ multiplies the $5$ as well as the $x$.'
      }
    ],
    check: [
      {
        question: 'Simplify $5p+3-2p+4$.',
        answer: '$3p+7$.',
        verify: { kind: 'equivalent', a: '5*p+3-2*p+4', b: '3*p+7' }
      },
      {
        question: 'A pencil costs ₹$k$ and an eraser costs ₹$12$. Write the cost of $4$ pencils and $2$ erasers, then find it when $k=8$.',
        answer: '₹$(4k+24)$; when $k=8$ it is $32+24=56$, so ₹$56$.',
        verify: { kind: 'value', expr: '4*8+2*12', answer: '56' }
      },
      {
        question: 'Triangles made from matchsticks in a row, sharing sides, need $2n+1$ sticks for $n$ triangles. How many sticks make $20$ triangles, and how many triangles use $61$ sticks?',
        answer: '$2\\times20+1=41$ sticks; $2n+1=61$ gives $n=30$ triangles.',
        verify: { kind: 'values', pairs: [['2*20+1', '41'], ['(61-1)/2', '30']] }
      }
    ]
  },

  'c7-parallel-intersecting-lines-current': {
    objective: 'Find unknown angles where two lines cross or where a transversal cuts parallel lines, and decide whether two lines are parallel from the angles a transversal makes with them.',
    intuition: 'Where two lines cross, the angles along one straight line make $180^\\circ$, so knowing one angle gives all four. Now slide that crossing along the transversal until it sits on the second line. If the two lines are parallel it fits exactly, so the same four angles appear again. That is why corresponding angles are equal, and the other facts follow from it.',
    interactiveNone: 'Turning the transversal would help, but the diagram kit draws parallel lines as a fixed figure; three figures at different transversal angles show the same equalities instead.',
    diagrams: [
      {
        title: 'Corresponding angles at $65^\\circ$',
        spec: { kind: 'parallelLines', angle: 65, mark: 'corresponding', values: true },
        note: 'The transversal meets both parallel lines at $65^\\circ$. The two marked angles are in the same position at each crossing, so both are $65^\\circ$.'
      },
      {
        title: 'Same-side interior angles',
        spec: { kind: 'parallelLines', angle: 65, mark: 'coInterior', values: true },
        note: 'The marked angles lie between the parallel lines on the same side of the transversal. They are $65^\\circ$ and $115^\\circ$, which add to $180^\\circ$. They are not equal.'
      },
      {
        title: 'Alternate angles at $110^\\circ$',
        spec: { kind: 'parallelLines', angle: 110, mark: 'alternate', values: true },
        note: 'Turn the transversal to $110^\\circ$. The marked angles are between the lines on opposite sides of the transversal, and they are still equal to each other.'
      }
    ],
    check: [
      {
        question: 'Two lines cross and one of the four angles is $38^\\circ$. Find the other three.',
        answer: 'The vertically opposite angle is $38^\\circ$; the two angles beside it are $180^\\circ-38^\\circ=142^\\circ$ each.',
        verify: { kind: 'value', expr: '180-38', answer: '142' }
      },
      {
        question: 'A transversal cuts two parallel lines. Two alternate angles are $(2x+10)^\\circ$ and $70^\\circ$. Find $x$.',
        answer: 'Alternate angles are equal, so $2x+10=70$ and $x=30$.',
        verify: { kind: 'roots', f: '2*x+10-70', answers: ['30'] }
      },
      {
        question: 'A transversal makes same-side interior angles of $108^\\circ$ and $74^\\circ$ with two lines. Are the lines parallel?',
        answer: 'No. $108^\\circ+74^\\circ=182^\\circ$, not $180^\\circ$, so the lines are not parallel.',
        verify: { kind: 'value', expr: '108+74', answer: '182' }
      }
    ]
  },

  'c7-number-play-current': {
    objective: 'Decide whether a sum or product is odd or even without working it out, complete a magic square, continue the Virahanka–Fibonacci numbers, and use the digit sum to test divisibility by $9$.',
    intuition: 'Think of an even number as counters in pairs, and an odd number as pairs with one counter left over. Put two odd numbers together and the two leftovers make a new pair, so the sum is even. So you only need to count the leftovers: a sum is odd exactly when it has an odd number of odd terms. For products, one even factor is enough to make the answer even, because any number of lots of pairs is still pairs.',
    diagrams: [
      {
        title: 'A magic square with rows and columns totalled',
        spec: { kind: 'table', rows: ['Row 1', 'Row 2', 'Row 3'], cols: ['Column 1', 'Column 2', 'Column 3'], cells: [[8, 1, 6], [3, 5, 7], [4, 9, 2]] },
        note: 'Every row and every column totals $15$, and all nine numbers total $45$. Three equal rows share $45$, so each must be $15$. The centre is $5$.'
      },
      {
        title: 'Adding odd numbers one at a time',
        spec: { kind: 'sequenceExplorer', type: 'arithmetic', first: 1, step: 2, n: 8 },
        note: 'The terms are the odd numbers $1, 3, 5, 7, \\dots$. Their running totals are $1, 4, 9, 16, 25, \\dots$: odd after one, three or five terms, even after two, four or six. An odd number of odd terms gives an odd sum.'
      }
    ],
    check: [
      {
        question: 'Without adding, is $37+58+91+46+13$ odd or even? Then add to check.',
        answer: 'Three of the terms ($37$, $91$, $13$) are odd, an odd count, so the sum is odd. It is $245$.',
        verify: { kind: 'value', expr: '37+58+91+46+13', answer: '245' }
      },
      {
        question: 'The Virahanka–Fibonacci numbers reach $21, 34$. Write the next three.',
        answer: '$55, 89, 144$.',
        verify: { kind: 'values', pairs: [['21+34', '55'], ['34+55', '89'], ['55+89', '144']] }
      },
      {
        question: 'Find the digit $d$ that makes $73d4$ divisible by $9$.',
        answer: 'The digit sum is $14+d$, which must be a multiple of $9$, so $d=4$. Check: $7344\\div9=816$.',
        verify: { kind: 'value', expr: '7344/9', answer: '816' }
      }
    ]
  },

  'c7-triangles-current': {
    objective: 'Find a missing angle of a triangle from the angle sum or an exterior angle, decide whether three lengths can make a triangle, and name a triangle by its sides and its angles.',
    intuition: 'Tear the three corners off a paper triangle and place them side by side: they always fit together into a straight line, so the angles add to $180^\\circ$. For the sides, picture two sticks hinged to the ends of a third. If the two together are shorter than the third, their free ends can never meet, so no triangle forms.',
    diagrams: [
      {
        title: 'The angle sum stays $180^\\circ$',
        spec: { kind: 'triangleExplorer', mode: 'angleSum', initial: { A: 65, B: 48 } },
        note: 'Start with angles $65^\\circ$ and $48^\\circ$: the third is $67^\\circ$. Change the triangle and watch the readout. The three angles change, but their total is always $180^\\circ$.'
      },
      {
        title: 'Sides $4$, $5$ and $8$',
        spec: { kind: 'triangle', a: 4, b: 5, c: 8 },
        note: 'Here $4+5=9$ is only just more than $8$, so the triangle is very flat: the angle opposite the side $8$ is about $125^\\circ$, an obtuse triangle. With $c=9$ the two short sides would lie flat along the long one.'
      }
    ],
    check: [
      {
        question: 'Two angles of a triangle are $72^\\circ$ and $39^\\circ$. Find the third angle and name the triangle by its angles.',
        answer: '$180^\\circ-72^\\circ-39^\\circ=69^\\circ$. All three angles are less than $90^\\circ$, so it is acute.',
        verify: { kind: 'value', expr: '180-72-39', answer: '69' }
      },
      {
        question: 'Can sticks of $5$ cm, $6$ cm and $12$ cm make a triangle?',
        answer: 'No. The two shorter sticks give $5+6=11$, which is less than $12$.',
        verify: { kind: 'value', expr: '5+6', answer: '11' }
      },
      {
        question: 'In $\\triangle ABC$ the exterior angle at $C$ is $128^\\circ$ and $\\angle A=57^\\circ$. Find $\\angle B$.',
        answer: 'The exterior angle equals the two opposite interior angles together, so $\\angle B=128^\\circ-57^\\circ=71^\\circ$.',
        verify: { kind: 'value', expr: '128-57', answer: '71' }
      }
    ]
  },

  'c7-fractions-current': {
    objective: 'Multiply a fraction by a whole number or by another fraction, divide by a fraction using its reciprocal, and say before calculating whether the answer will be larger or smaller.',
    intuition: '$\\tfrac{2}{3}\\times\\tfrac{3}{4}$ means two-thirds of three-quarters. Shade $\\tfrac{3}{4}$ of a bar, then take two of every three shaded pieces: half the bar is left shaded. Dividing asks how many pieces fit. $6\\div\\tfrac{3}{4}$ counts how many $\\tfrac{3}{4}$ m lengths fit into $6$ m; each metre holds $\\tfrac{4}{3}$ of a piece, which is why you multiply by the reciprocal.',
    diagrams: [
      {
        title: '$\\tfrac{2}{3}$ of $\\tfrac{3}{4}$',
        spec: { kind: 'fractionBar', bars: [{ parts: 4, shaded: 3, label: '\\tfrac{3}{4}' }, { parts: 12, shaded: 6, label: '\\tfrac{2}{3}\\text{ of }\\tfrac{3}{4}' }, { parts: 2, shaded: 1, label: '\\tfrac{1}{2}' }] },
        note: 'The first bar shades $\\tfrac{3}{4}$. Cut each quarter into $3$ and keep $2$ of every $3$: that is $6$ twelfths. The last bar shows $\\tfrac{6}{12}=\\tfrac{1}{2}$, the same length.'
      },
      {
        title: 'How many $\\tfrac{3}{4}$ m pieces in $6$ m',
        spec: { kind: 'numberLineStepper', op: 'multiply', a: 8, b: 0.75, min: 0, max: 6, step: 0.25, fractions: 4 },
        note: 'Each jump is $\\tfrac{3}{4}$ m. Eight jumps land exactly on $6$, so $6\\div\\tfrac{3}{4}=6\\times\\tfrac{4}{3}=8$.'
      }
    ],
    check: [
      {
        question: 'Find $\\tfrac{5}{6}\\times\\tfrac{3}{10}$, cancelling first.',
        answer: 'Cancel $5$ with $10$ and $3$ with $6$: $\\tfrac{1}{2}\\times\\tfrac{1}{2}=\\tfrac{1}{4}$.',
        verify: { kind: 'value', expr: '(5/6)*(3/10)', answer: '1/4' }
      },
      {
        question: 'Without calculating, is $45\\times\\tfrac{7}{8}$ more or less than $45$? Then find it.',
        answer: 'Less, because $\\tfrac{7}{8}$ is less than $1$. It is $\\tfrac{315}{8}=39\\tfrac{3}{8}$.',
        verify: { kind: 'value', expr: '45*7/8', answer: '315/8' }
      },
      {
        question: 'A jug holds $6$ L of lassi. How many glasses of $\\tfrac{2}{5}$ L can be filled from it?',
        answer: '$6\\div\\tfrac{2}{5}=6\\times\\tfrac{5}{2}=15$ glasses.',
        verify: { kind: 'value', expr: '6/(2/5)', answer: '15' }
      }
    ]
  },

  // ── Part II ───────────────────────────────────────────────────────────────
  'c7-geometric-twins-current': {
    objective: 'Decide whether two triangles are congruent using SSS, SAS, ASA, AAS or RHS, write the matching vertices in the same order, and use congruence to find unknown sides and angles.',
    intuition: 'Two figures are congruent when one could be cut out and laid exactly on the other, perhaps after turning it over. You do not need all six measurements to know this. Given three sides, there is only one triangle you can build with them, so two triangles with the same three sides must match everywhere. Equal angles alone are not enough: a photograph and its enlargement have the same angles but different sizes.',
    diagrams: [
      {
        title: 'A triangle and its mirror image in the $y$-axis',
        spec: {
          kind: 'plane', xmin: -5, xmax: 5, ymin: -1, ymax: 5,
          points: [
            { x: 1, y: 1, label: 'A', pos: 's' }, { x: 4, y: 1, label: 'B', pos: 'se' }, { x: 2, y: 4, label: 'C', pos: 'ne' },
            { x: -1, y: 1, label: "A'", pos: 's' }, { x: -4, y: 1, label: "B'", pos: 'sw' }, { x: -2, y: 4, label: "C'", pos: 'nw' }
          ],
          polygons: [{ points: [[1, 1], [4, 1], [2, 4]], shade: true }, { points: [[-1, 1], [-4, 1], [-2, 4]], shade: true }]
        },
        note: 'Reflecting in the $y$-axis changes the sign of each $x$-coordinate: $C(2,4)$ goes to $C\'(-2,4)$. Every side keeps its length, for example $AB=A\'B\'=3$, so $\\triangle ABC\\cong\\triangle A\'B\'C\'$, even though one is flipped.'
      },
      {
        title: 'Same angles, different size',
        spec: { kind: 'triangleExplorer', mode: 'similar', initial: { a: 3, b: 4, c: 5, k: 1 } },
        note: 'At scale factor $k=1$ the two triangles are twins. Move $k$ to $2$: the angles stay exactly the same, but the sides $3, 4, 5$ become $6, 8, 10$. Matching angles alone (AAA) do not prove congruence.'
      }
    ],
    check: [
      {
        question: '$\\triangle PQR\\cong\\triangle XYZ$, with $PQ=7$ cm, $\\angle Q=64^\\circ$ and $\\angle R=46^\\circ$. Find $XY$ and $\\angle X$.',
        answer: '$XY=PQ=7$ cm, and $\\angle X=\\angle P=180^\\circ-64^\\circ-46^\\circ=70^\\circ$.',
        verify: { kind: 'value', expr: '180-64-46', answer: '70' }
      },
      {
        question: 'In $\\triangle ABC$ and $\\triangle DEF$, $AB=DE=6$ cm, $\\angle A=\\angle D=50^\\circ$ and $\\angle B=\\angle E=60^\\circ$. Which condition proves them congruent, and what is $\\angle F$?',
        answer: 'ASA: two angles and the side between them match. $\\angle F=\\angle C=180^\\circ-50^\\circ-60^\\circ=70^\\circ$.',
        verify: { kind: 'value', expr: '180-50-60', answer: '70' }
      },
      {
        question: 'The point $(5,-2)$ is reflected in the $y$-axis. Find its image and the distance between the point and its image.',
        answer: 'The image is $(-5,-2)$. Both points are on the line $y=-2$, so the distance is $5+5=10$.',
        verify: { kind: 'value', expr: '5+5', answer: '10' }
      }
    ]
  },

  'c7-integer-operations-current': {
    objective: 'Multiply and divide integers using the sign rules, explain why a negative times a negative is positive, and evaluate expressions with several integers.',
    intuition: '$3\\times(-4)$ means three steps of $-4$ on the number line, so you end at $-12$. For a negative times a negative, follow a pattern: $(-3)\\times2=-6$, $(-3)\\times1=-3$, $(-3)\\times0=0$. Each time the second number drops by $1$, the answer goes up by $3$. Continuing, $(-3)\\times(-1)=3$ and $(-3)\\times(-2)=6$. Division undoes multiplication, so it follows the same sign rules.',
    diagrams: [
      {
        title: 'Three steps of $-4$',
        spec: { kind: 'numberLineStepper', op: 'multiply', a: 3, b: -4, min: -14, max: 2, step: 1 },
        note: 'Each jump goes $4$ to the left. After three jumps you are at $-12$, so $3\\times(-4)=-12$.'
      },
      {
        title: 'The pattern $(-3)\\times2,\\ (-3)\\times1,\\ \\dots,\\ (-3)\\times(-2)$',
        spec: { kind: 'sequence', type: 'arithmetic', first: -6, step: 3, n: 5 },
        note: 'The five values are $-6, -3, 0, 3, 6$, for the multipliers $2, 1, 0, -1, -2$. Each goes up by $3$, so the pattern forces $(-3)\\times(-1)=3$ and $(-3)\\times(-2)=6$.'
      }
    ],
    check: [
      {
        question: 'Find $(-7)\\times(-6)$ and $(-56)\\div8$.',
        answer: '$42$ (same signs) and $-7$ (different signs).',
        verify: { kind: 'values', pairs: [['(-7)*(-6)', '42'], ['(-56)/8', '-7']] }
      },
      {
        question: 'Find $(-2)\\times(-3)\\times(-5)\\times4$.',
        answer: 'Three negative factors, an odd count, so the answer is negative: $-120$.',
        verify: { kind: 'value', expr: '(-2)*(-3)*(-5)*4', answer: '-120' }
      },
      {
        question: 'In Leh the temperature is $5^\\circ$C at sunset and falls by $3^\\circ$C every hour. What is it $6$ hours later?',
        answer: '$5+6\\times(-3)=5-18=-13^\\circ$C.',
        verify: { kind: 'value', expr: '5+6*(-3)', answer: '-13' }
      }
    ]
  },

  'c7-common-ground-current': {
    objective: 'Find the HCF and LCM of two or three numbers by listing or by prime factors, and decide which of the two a word problem needs.',
    intuition: 'The HCF is about cutting things up: it is the biggest size of equal pieces that fits into each number exactly, like the largest square tile that covers a $12$ by $18$ floor without cutting. The LCM is about things lining up again: hops of $4$ and hops of $6$ along a line first land on the same number at $12$. If the question splits things into equal groups, think HCF; if it waits for repeats to meet, think LCM.',
    diagrams: [
      {
        title: 'Hops of $4$ and hops of $6$',
        spec: { kind: 'numberLineStepper', op: 'multiply', a: 3, b: 4, min: 0, max: 24, step: 1 },
        note: 'Three hops of $4$ land on $12$. Hops of $6$ land on $6$ and then $12$. The first number both reach is $12$, so the LCM of $4$ and $6$ is $12$; the next shared landing is $24$.'
      },
      {
        title: 'Tiling a $12$ by $18$ floor with the largest squares',
        spec: { kind: 'areaModel', rows: [{ size: 6, label: '6' }, { size: 6, label: '6' }], cols: [{ size: 6, label: '6' }, { size: 6, label: '6' }, { size: 6, label: '6' }], cells: [['36', '36', '36'], ['36', '36', '36']] },
        note: 'The HCF of $12$ and $18$ is $6$, so $6$ by $6$ tiles fit with nothing left over: $2$ rows of $3$, six tiles of area $36$, which is $216=12\\times18$.'
      }
    ],
    check: [
      {
        question: 'Find the HCF and LCM of $24$ and $36$, and check that their product equals $24\\times36$.',
        answer: '$24=2^3\\times3$ and $36=2^2\\times3^2$, so the HCF is $2^2\\times3=12$ and the LCM is $2^3\\times3^2=72$. Check: $12\\times72=864=24\\times36$.',
        verify: { kind: 'values', pairs: [['12*72', '24*36'], ['24*36/12', '72']] }
      },
      {
        question: 'For Diwali, $48$ red diyas and $60$ yellow diyas are set out in rows. Every row has the same number of diyas and only one colour. What is the largest possible row, and how many rows are there?',
        answer: 'The HCF of $48$ and $60$ is $12$, so $12$ diyas a row: $4$ red rows and $5$ yellow rows, $9$ rows in all.',
        verify: { kind: 'values', pairs: [['48/12', '4'], ['60/12', '5']] }
      },
      {
        question: 'Two temple bells ring every $12$ minutes and every $18$ minutes. They ring together at 9:00. When do they next ring together?',
        answer: 'The LCM of $12$ and $18$ is $36$, so at 9:36.',
        verify: { kind: 'values', pairs: [['36/12', '3'], ['36/18', '2']] }
      }
    ]
  },

  'c7-decimal-operations-current': {
    objective: 'Multiply and divide decimals, placing the point by place value, multiply or divide by $10$, $100$ or $1000$ by shifting digits, and convert between metric units.',
    intuition: 'Draw a square of side $1$ and cut it into $100$ small squares. Shade $0.3$ of the width and $0.2$ of the height: the overlap is $6$ small squares out of $100$, so $0.3\\times0.2=0.06$. That is why tenths times tenths give hundredths, and why multiplying by a number less than $1$ gives less. Dividing asks how many times one number fits into another, and multiplying both by $100$ does not change that count.',
    diagrams: [
      {
        title: '$0.3\\times0.2$ inside one whole square',
        spec: { kind: 'areaModel', rows: [{ size: 2, label: '0.2' }, { size: 8, label: '0.8' }], cols: [{ size: 3, label: '0.3' }, { size: 7, label: '0.7' }], cells: [['0.06', '0.14'], ['0.24', '0.56']] },
        note: 'The whole square has area $1$. The corner piece is $0.3$ by $0.2$, with area $0.06$. The four pieces $0.06+0.14+0.24+0.56$ make $1$.'
      },
      {
        title: 'How many $0.4$ in $1.2$',
        spec: { kind: 'numberLineStepper', op: 'multiply', a: 3, b: 0.4, min: 0, max: 1.5, step: 0.1 },
        note: 'Three jumps of $0.4$ reach $1.2$, so $1.2\\div0.4=3$, not $0.3$. Multiplying both by $10$ gives $12\\div4=3$, the same count.'
      }
    ],
    check: [
      {
        question: 'Find $2.4\\times0.3$.',
        answer: '$24\\times3=72$, and the factors have $1+1=2$ decimal places, so $0.72$.',
        verify: { kind: 'value', expr: '2.4*0.3', answer: '0.72' }
      },
      {
        question: 'Find $6.3\\div0.09$.',
        answer: 'Multiply both by $100$: $630\\div9=70$.',
        verify: { kind: 'value', expr: '6.3/0.09', answer: '70' }
      },
      {
        question: 'Mango juice costs ₹$64$ per litre. What do $750$ mL cost?',
        answer: '$750$ mL is $0.75$ L, and $0.75\\times64=48$, so ₹$48$.',
        verify: { kind: 'value', expr: '0.75*64', answer: '48' }
      }
    ]
  },

  'c7-connecting-dots-current': {
    objective: 'Find the mean, median, mode and range of a set of data, and decide which typical value describes the data best when one value is unusually large or small.',
    intuition: 'The mean shares out the total: pour all the runs into one pile and give each match an equal share. The median is the middle value once everything is lined up in order. One huge score adds a lot to the pile, so it drags the mean up, but it only moves to the end of the line, so the median hardly changes. The range says how far apart the smallest and largest values are.',
    diagrams: [
      {
        title: 'Runs in six matches, one score you can move',
        spec: { kind: 'dataExplorer', data: [12, 45, 30, 12, 51, 36], editable: [4], show: ['mean', 'median', 'mode', 'range'] },
        note: 'At the start the mean is $186\\div6=31$, the median is $\\tfrac{30+36}{2}=33$, the mode is $12$ and the range is $51-12=39$. Push the $51$ up to $151$: the mean jumps to about $47.7$, while the median stays $33$.'
      },
      {
        title: 'Pocket money of five friends',
        spec: { kind: 'barChart', categories: ['Asha', 'Bilal', 'Chitra', 'Dev', 'Esha'], values: [40, 50, 50, 60, 300], yLabel: 'Rupees' },
        note: 'The total is ₹$500$, so the mean is ₹$100$, more than four of the five friends get. The median is ₹$50$, which describes a typical friend better.'
      }
    ],
    check: [
      {
        question: 'A bowler takes $2, 0, 3, 1, 3, 4, 1$ wickets in seven matches. Find the mean, the median, the mode and the range.',
        answer: 'Mean $14\\div7=2$. In order $0, 1, 1, 2, 3, 3, 4$, so the median is $2$. The modes are $1$ and $3$. The range is $4-0=4$.',
        verify: { kind: 'values', pairs: [['(2+0+3+1+3+4+1)/7', '2'], ['4-0', '4']] }
      },
      {
        question: 'The mean of four numbers is $15$. Three of them are $12$, $18$ and $10$. Find the fourth.',
        answer: 'The total is $4\\times15=60$, so the fourth is $60-40=20$.',
        verify: { kind: 'value', expr: '4*15-(12+18+10)', answer: '20' }
      },
      {
        question: 'Five students are $138, 141, 143, 146, 152$ cm tall. A sixth student of $180$ cm joins. Find the mean and median before and after.',
        answer: 'Before: mean $720\\div5=144$, median $143$. After: mean $900\\div6=150$, median $\\tfrac{143+146}{2}=144.5$. The mean moved $6$ cm, the median only $1.5$ cm.',
        verify: { kind: 'values', pairs: [['(138+141+143+146+152)/5', '144'], ['(138+141+143+146+152+180)/6', '150'], ['(143+146)/2', '144.5']] }
      }
    ]
  },

  'c7-constructions-tilings-current': {
    objective: 'Construct a perpendicular bisector, an angle bisector and angles of $60^\\circ$, $30^\\circ$, $90^\\circ$ and $45^\\circ$ with ruler and compass, and decide whether regular polygons can fit together around a point without gaps.',
    intuition: 'A compass marks every point at one fixed distance. Where an arc from $A$ crosses an arc of the same radius from $B$, the crossing is equally far from $A$ and from $B$; two such crossings fix the perpendicular bisector. In a tiling, the corners meeting at a point must fill a full turn, exactly $360^\\circ$: a little short leaves a gap, a little over makes tiles overlap.',
    diagrams: [
      {
        title: 'The perpendicular bisector of $AB$',
        spec: {
          kind: 'plane', xmin: -5, xmax: 5, ymin: -5, ymax: 5, axes: false,
          points: [
            { x: -3, y: 0, label: 'A', pos: 'w' }, { x: 3, y: 0, label: 'B', pos: 'e' },
            { x: 0, y: 4, label: 'P', pos: 'n' }, { x: 0, y: -4, label: 'Q', pos: 's' }, { x: 0, y: 0, label: 'M', pos: 'se' }
          ],
          segments: [
            { from: [-3, 0], to: [3, 0] },
            { from: [-3, 0], to: [0, 4], dashed: true, label: '5' }, { from: [3, 0], to: [0, 4], dashed: true, label: '5' }
          ],
          lines: [{ through: [[0, 4], [0, -4]] }],
          arcs: [
            { cx: -3, cy: 0, r: 5, from: 40, to: 66 }, { cx: -3, cy: 0, r: 5, from: -66, to: -40 },
            { cx: 3, cy: 0, r: 5, from: 114, to: 140 }, { cx: 3, cy: 0, r: 5, from: 220, to: 246 }
          ],
          angles: [{ at: [0, 0], from: [3, 0], to: [0, 4], right: true }]
        },
        note: 'Arcs of radius $5$ from $A$ and from $B$ cross at $P$ and $Q$, so $PA=PB=5$. The line $PQ$ meets $AB$ at $M$ at a right angle, with $AM=MB=3$: it cuts $AB$ in half.'
      },
      {
        title: 'One corner of a regular hexagon',
        spec: { kind: 'polygon', n: 6, side: 1 },
        note: 'Each interior angle of a regular hexagon is $120^\\circ$. Three hexagons meeting at a point give $3\\times120^\\circ=360^\\circ$, a full turn, which is why honeycombs and many floor tiles use hexagons.'
      },
      {
        title: 'Filling a full turn with $120^\\circ$ corners',
        spec: { kind: 'numberLineStepper', op: 'multiply', a: 120, b: 3, min: 0, max: 360, step: 30 },
        note: 'Each jump is one hexagon corner of $120^\\circ$. Three jumps land exactly on $360^\\circ$. Regular pentagon corners are $108^\\circ$: three give $324^\\circ$, short of $360^\\circ$, and four give $432^\\circ$, too many. So regular pentagons alone cannot tile.'
      }
    ],
    check: [
      {
        question: 'At one corner of a tiling there is a regular hexagon and two squares. What angle is left, and which regular polygon fills it?',
        answer: '$360^\\circ-120^\\circ-2\\times90^\\circ=60^\\circ$, the corner of an equilateral triangle.',
        verify: { kind: 'value', expr: '360-120-2*90', answer: '60' }
      },
      {
        question: 'An angle of $84^\\circ$ is bisected, and then one of the halves is bisected again. How big is each of the smallest angles?',
        answer: '$84^\\circ\\div2=42^\\circ$, then $42^\\circ\\div2=21^\\circ$.',
        verify: { kind: 'value', expr: '84/4', answer: '21' }
      },
      {
        question: 'The segment $PQ$ is $9$ cm long. Its perpendicular bisector meets it at $M$, and a point $X$ on the bisector is $6$ cm from $P$. Find $PM$ and $XQ$.',
        answer: '$PM=9\\div2=4.5$ cm. Every point on the perpendicular bisector is equally far from $P$ and $Q$, so $XQ=6$ cm.',
        verify: { kind: 'value', expr: '9/2', answer: '4.5' }
      }
    ]
  },

  'c7-finding-unknown-current': {
    objective: 'Solve equations in one unknown, including those with the unknown on both sides, by doing the same thing to both sides; check the answer; and write an equation from a word problem.',
    intuition: 'An equation is a balance: both sides weigh the same, and it stays balanced as long as you do the same thing to both sides. To find $x$ in $3x+4=19$, think of how the left side was built: take $x$, multiply by $3$, then add $4$. Undo those steps in reverse order: take away $4$ to get $15$, then divide by $3$ to get $x=5$.',
    diagrams: [
      {
        title: '$3x+4=19$ as a strip',
        spec: { kind: 'areaModel', rows: [{ size: 2, label: '\\text{total }19' }], cols: [{ size: 5, label: 'x' }, { size: 5, label: 'x' }, { size: 5, label: 'x' }, { size: 4, label: '4' }], cells: [['x', 'x', 'x', '4']] },
        note: 'The whole strip is $19$ long: three equal pieces $x$ and a piece $4$. Remove the $4$ and $15$ is left for three equal pieces, so each is $x=5$.'
      },
      {
        title: 'Building $3x+4$ forwards when $x=5$',
        spec: { kind: 'numberLineStepper', op: 'multiply', a: 3, b: 5, min: 0, max: 20, step: 1 },
        note: 'Three jumps of $5$ reach $15$, which is $3x$. Adding $4$ more reaches $19$. Solving runs the same path backwards: from $19$ go back $4$ to $15$, then split $15$ into three equal jumps of $5$.'
      }
    ],
    check: [
      {
        question: 'Solve $4x+9=37$.',
        answer: 'Take $9$ from both sides: $4x=28$. Divide by $4$: $x=7$. Check: $28+9=37$.',
        verify: { kind: 'roots', f: '4*x+9-37', answers: ['7'] }
      },
      {
        question: 'Solve $6x-5=2x+19$.',
        answer: 'Take $2x$ from both sides: $4x-5=19$. Add $5$: $4x=24$, so $x=6$. Check: both sides are $31$.',
        verify: { kind: 'roots', f: '6*x-5-(2*x+19)', answers: ['6'] }
      },
      {
        question: 'Priya buys $3$ kites at the same price and a reel of thread for ₹$45$. She pays ₹$120$ in all. Write an equation and find the price of one kite.',
        answer: '$3x+45=120$, so $3x=75$ and $x=25$. One kite costs ₹$25$.',
        verify: { kind: 'roots', f: '3*x+45-120', answers: ['25'] }
      }
    ]
  }
};
