// Pri Learning · NSW Notes · Stage 5 core, band A (Years 9 and 10)
//
// Original revision writing for the NSW Mathematics K–10 Syllabus (2022) Stage 5
// core focus areas: algebraic techniques, area and surface area, data analysis,
// equations, financial mathematics, geometrical figures and indices. Written for
// Pri Learning; it is not an official NESA publication and quotes no syllabus
// text. Each topic is keyed by the lower-case outcome code of its focus area (a
// reference only). en-AU spelling. Every worked example's answer is re-derived by
// the deterministic engine in client/test/nsw-notes-bands-check.mjs.
export default {
  'ma5-alg-c-01': {
    summary: 'Algebraic techniques at Stage 5 are about moving between two forms of the same expression: the expanded form, a sum of terms, and the factorised form, a product. Expanding binomials and factorising common factors, differences of two squares and simple quadratic trinomials is the working toolkit for the equations that follow.',
    prereqs: ['ma4-alg-c-01', 'ma4-ind-c-01'],
    concepts: [
      { title: 'Expanding a product of binomials', body: 'Each term in the first bracket multiplies each term in the second: $(x+3)(x-5)=x^2-5x+3x-15=x^2-2x-15$. Collect like terms last.' },
      { title: 'Factorising is expanding in reverse', body: 'Take out any common factor first, then look for a pattern. For $x^2+bx+c$, find two numbers with product $c$ and sum $b$: $x^2-7x+12=(x-3)(x-4)$ because $-3\\times-4=12$ and $-3+(-4)=-7$.' },
      { title: 'Two special patterns', body: 'A perfect square expands as $(a+b)^2=a^2+2ab+b^2$, and a difference of two squares factorises as $a^2-b^2=(a-b)(a+b)$. So $4x^2-25=(2x-5)(2x+5)$.' }
    ],
    definitions: [
      { term: 'Binomial', meaning: 'An expression with two terms, such as $x+3$ or $2a-5b$.' },
      { term: 'Factorise', meaning: 'Write an expression as a product of simpler expressions, so that expanding the product gives the original back.' }
    ],
    formulas: [
      { label: 'Perfect squares', tex: '(a+b)^2=a^2+2ab+b^2,\\qquad (a-b)^2=a^2-2ab+b^2' },
      { label: 'Difference of two squares', tex: 'a^2-b^2=(a-b)(a+b)' },
      { label: 'Monic trinomial', tex: 'x^2+(p+q)x+pq=(x+p)(x+q)' }
    ],
    points: [
      { front: 'Expand $(x+4)^2$', back: '$x^2+8x+16$. The middle term is twice the product, $2\\times x\\times4$.' },
      { front: 'The first step in any factorising question', back: 'Look for a common factor: $6x^2+9x=3x(2x+3)$.' },
      { front: 'Is $x^2+25$ a difference of two squares?', back: 'No. The sign is a plus, so it does not factorise over the real numbers in this way.' },
      { front: 'How can you check a factorisation?', back: 'Expand your answer. If you get the original expression back, the factorising is right.' }
    ],
    mistakes: [
      { wrong: '$(x+4)^2=x^2+16$.', right: 'The bracket multiplies by itself: $(x+4)(x+4)=x^2+8x+16$. Squaring does not skip the middle term.' },
      { wrong: '$x^2-9x+20=(x-4)(x+5)$ because $4\\times5=20$.', right: 'The numbers must also sum to $-9$, so both are negative: $(x-4)(x-5)$.' }
    ],
    examples: [
      {
        question: 'Expand and simplify $(x+3)(x-5)$.',
        steps: ['Multiply every term in the first bracket by every term in the second: $x\\times x$, $x\\times(-5)$, $3\\times x$, $3\\times(-5)$.', 'That gives $x^2-5x+3x-15$.', 'Collect like terms: $x^2-2x-15$.'],
        answer: '$x^2-2x-15$',
        verify: { kind: 'equivalent', a: '(x+3)*(x-5)', b: 'x^2-2*x-15' }
      },
      {
        question: 'Factorise $x^2-7x+12$.',
        steps: ['Look for two numbers with product $12$ and sum $-7$.', 'The numbers $-3$ and $-4$ work.', 'So $x^2-7x+12=(x-3)(x-4)$.'],
        answer: '$(x-3)(x-4)$',
        verify: { kind: 'equivalent', a: 'x^2-7*x+12', b: '(x-3)*(x-4)' }
      },
      {
        question: 'Factorise $4x^2-25$.',
        steps: ['Write both terms as squares: $4x^2=(2x)^2$ and $25=5^2$.', 'Use $a^2-b^2=(a-b)(a+b)$ with $a=2x$ and $b=5$.', 'So $4x^2-25=(2x-5)(2x+5)$.'],
        answer: '$(2x-5)(2x+5)$',
        verify: { kind: 'equivalent', a: '4*x^2-25', b: '(2*x-5)*(2*x+5)' }
      }
    ]
  },

  'ma5-are-c-01': {
    summary: 'Area and surface area at Stage 5 extend the plane shapes of Stage 4 to parts of a circle, composite figures and the outsides of solids. The key move is the same each time: split the shape into pieces whose area you can find, then add the pieces.',
    prereqs: ['ma4-are-c-01', 'ma4-pyt-c-01'],
    concepts: [
      { title: 'A sector is a fraction of a circle', body: 'A sector with angle $\\theta$ is $\\tfrac{\\theta}{360}$ of the whole circle, so both its area and its arc length use that fraction: area $=\\tfrac{\\theta}{360}\\pi r^2$ and arc length $=\\tfrac{\\theta}{360}\\times2\\pi r$.' },
      { title: 'Surface area is the sum of the faces', body: 'Imagine unfolding the solid into a net. The surface area is the area of the net: the faces of a prism, or the two circles and the curved rectangle of a cylinder.' },
      { title: 'Composite shapes', body: 'Split the figure into rectangles, triangles and circle parts. Add the areas of pieces that are part of the shape and subtract any piece that is cut out.' }
    ],
    definitions: [
      { term: 'Surface area', meaning: 'The total area of all the faces of a solid, measured in square units.' },
      { term: 'Sector', meaning: 'The region of a circle between two radii and the arc they cut off.' }
    ],
    formulas: [
      { label: 'Sector area and arc length', tex: 'A=\\frac{\\theta}{360}\\pi r^2,\\qquad \\ell=\\frac{\\theta}{360}\\times2\\pi r' },
      { label: 'Closed cylinder', tex: 'SA=2\\pi r^2+2\\pi rh=2\\pi r(r+h)' },
      { label: 'Right prism', tex: 'SA=2\\times(\\text{area of base})+(\\text{perimeter of base})\\times(\\text{length})' }
    ],
    points: [
      { front: 'The curved surface of a cylinder unrolls into', back: 'A rectangle of width $2\\pi r$ and height $h$, so its area is $2\\pi rh$.' },
      { front: 'What is a quarter circle of radius $r$?', back: 'A sector with $\\theta=90^\\circ$, so its area is $\\tfrac{1}{4}\\pi r^2$.' },
      { front: 'An exact answer', back: 'Leave $\\pi$ in it, such as $66\\pi\\text{ cm}^2$. Round only at the end, and state the rounding.' },
      { front: 'The units of surface area', back: 'Square units: $\\text{cm}^2$, $\\text{m}^2$. A length in $\\text{cm}$ and an area in $\\text{cm}^2$ are different things.' }
    ],
    mistakes: [
      { wrong: 'The surface area of a closed cylinder is $2\\pi rh$.', right: 'That is only the curved surface. A closed cylinder also has two circular ends, $2\\pi r^2$.' },
      { wrong: 'Using the slant height of a triangle face as the length of the prism.', right: 'The length of a prism is the distance between its two identical ends. The faces are rectangles of that length times each edge of the base.' }
    ],
    examples: [
      {
        question: 'Find the exact area of a sector of radius $10\\text{ cm}$ and angle $72^\\circ$.',
        steps: ['The sector is $\\tfrac{72}{360}=\\tfrac{1}{5}$ of a circle.', 'The circle has area $\\pi\\times10^2=100\\pi$.', 'So the sector has area $\\tfrac{1}{5}\\times100\\pi=20\\pi\\approx62.8\\text{ cm}^2$.'],
        answer: '$20\\pi\\text{ cm}^2\\approx62.8\\text{ cm}^2$',
        verify: { kind: 'value', expr: '72/360*pi*10^2', answer: '20*pi' }
      },
      {
        question: 'A closed cylinder has radius $3\\text{ cm}$ and height $8\\text{ cm}$. Find its surface area.',
        steps: ['Use $SA=2\\pi r(r+h)$ with $r=3$ and $h=8$.', 'Then $SA=2\\pi\\times3\\times(3+8)=66\\pi$.', 'As a decimal, $66\\pi\\approx207.3\\text{ cm}^2$.'],
        answer: '$66\\pi\\approx207.3\\text{ cm}^2$',
        verify: { kind: 'value', expr: '2*pi*3*(3+8)', answer: '66*pi' }
      },
      {
        question: 'A triangular prism has a right-angled triangle for its ends, with sides $3\\text{ cm}$, $4\\text{ cm}$ and $5\\text{ cm}$, and its length is $10\\text{ cm}$. Find its surface area.',
        steps: ['Each triangular end has area $\\tfrac{1}{2}\\times3\\times4=6$, so the two ends have area $12$.', 'The three rectangles have total area (perimeter of base) $\\times$ length: $(3+4+5)\\times10=120$.', 'The surface area is $12+120=132\\text{ cm}^2$.'],
        answer: '$132\\text{ cm}^2$',
        verify: { kind: 'value', expr: '2*(1/2*3*4)+(3+4+5)*10', answer: '132' }
      }
    ]
  },

  'ma5-dat-c-01': {
    summary: 'Data analysis at Stage 5 begins with summarising a data set by its centre and spread, including when the data arrives as a frequency table or in grouped classes. You find a mean, a median and a modal class from the table itself, and read the shape of the data from a histogram.',
    prereqs: ['ma4-dat-c-02'],
    concepts: [
      { title: 'A frequency table holds the whole data set', body: 'A score $x$ with frequency $f$ stands for $f$ copies of $x$. The total of the data is $\\sum fx$, the number of values is $\\sum f$, and the mean is $\\dfrac{\\sum fx}{\\sum f}$.' },
      { title: 'Grouped data uses class centres', body: 'When values are sorted into classes, the individual values are lost. Use the midpoint of each class as its stand-in. The mean found this way is an estimate, because the true values within each class are unknown.' },
      { title: 'The median comes from the cumulative frequency', body: 'With $n$ values the median is the middle one, in position $\\tfrac{n+1}{2}$. Add up the frequencies from the lowest class until you pass that position; that class holds the median.' }
    ],
    definitions: [
      { term: 'Frequency', meaning: 'The number of times a value, or a value in a class, occurs in the data.' },
      { term: 'Modal class', meaning: 'The class with the highest frequency in a grouped data set.' }
    ],
    formulas: [
      { label: 'Mean from a frequency table', tex: '\\bar{x}=\\frac{\\sum fx}{\\sum f}' },
      { label: 'Estimated mean from grouped data', tex: '\\bar{x}\\approx\\frac{\\sum f\\times(\\text{class midpoint})}{\\sum f}' }
    ],
    points: [
      { front: 'Midpoint of the class $20$–$29$', back: '$24.5$, the average of the lowest and highest values in the class.' },
      { front: 'Is the grouped mean exact?', back: 'No. It is an estimate, because each value is treated as sitting at the class midpoint.' },
      { front: 'Which measure is least affected by one extreme value?', back: 'The median.' },
      { front: 'The mean needed to reach a target', back: 'Find the total needed ($\\text{target mean}\\times n$) and subtract the total so far.' }
    ],
    mistakes: [
      { wrong: 'The mean of the scores $2,3,4,5$ with frequencies $3,5,8,4$ is $(2+3+4+5)\\div4=3.5$.', right: 'The frequencies are weights. Use $\\sum fx\\div\\sum f=73\\div20=3.65$.' },
      { wrong: 'The median of a frequency table is the middle frequency.', right: 'The median is the middle data value, found by position in the cumulative frequency, not the middle of the frequency column.' }
    ],
    examples: [
      {
        question: 'Scores of $2,3,4,5$ occurred with frequencies $3,5,8,4$. Find the mean and the median.',
        steps: ['$\\sum f=3+5+8+4=20$ and $\\sum fx=6+15+32+20=73$.', 'The mean is $73\\div20=3.65$.', 'With $20$ values, the median is the average of the 10th and 11th. The cumulative frequencies are $3,8,16,20$, so both are $4$ and the median is $4$.'],
        answer: 'Mean $3.65$, median $4$',
        verify: { kind: 'values', pairs: [['(2*3+3*5+4*8+5*4)/(3+5+8+4)', '3.65'], ['(4+4)/2', '4']] }
      },
      {
        question: 'Estimate the mean of $25$ values grouped as $0$–$9$ (frequency $4$), $10$–$19$ ($6$), $20$–$29$ ($10$) and $30$–$39$ ($5$).',
        steps: ['The midpoints are $4.5$, $14.5$, $24.5$ and $34.5$.', 'Then $\\sum fx=4(4.5)+6(14.5)+10(24.5)+5(34.5)=18+87+245+172.5=522.5$.', 'The estimated mean is $522.5\\div25=20.9$. The modal class is $20$–$29$.'],
        answer: '$20.9$',
        verify: { kind: 'value', expr: '(4*4.5+6*14.5+10*24.5+5*34.5)/25', answer: '20.9' }
      },
      {
        question: 'Five test marks have a mean of $72$. What mark on a sixth test brings the mean to $75$?',
        steps: ['For a mean of $75$ over six tests the total must be $75\\times6=450$.', 'The first five tests total $72\\times5=360$.', 'The sixth mark is $450-360=90$.'],
        answer: '$90$',
        verify: { kind: 'value', expr: '75*6-72*5', answer: '90' }
      }
    ]
  },

  'ma5-dat-c-02': {
    summary: 'Data analysis B is about spread and comparison. Quartiles split an ordered data set into four equal-sized groups, the interquartile range measures the spread of the middle half, and a box plot shows five numbers at once. A fence rule flags outliers, and the median and interquartile range are the measures to trust when outliers are present.',
    prereqs: ['ma5-dat-c-01'],
    concepts: [
      { title: 'Quartiles and the five-number summary', body: 'Order the data. The median splits it into two halves; the lower quartile $Q_1$ is the median of the lower half and the upper quartile $Q_3$ is the median of the upper half. The minimum, $Q_1$, median, $Q_3$ and maximum make the five-number summary.' },
      { title: 'Range and interquartile range', body: 'The range $=\\text{maximum}-\\text{minimum}$ uses the two extremes and is pulled by any outlier. The interquartile range $\\text{IQR}=Q_3-Q_1$ measures only the middle $50\\%$ and is more stable.' },
      { title: 'Outliers and comparing sets', body: 'A common rule treats a value as an outlier when it is more than $1.5\\times\\text{IQR}$ below $Q_1$ or above $Q_3$. When comparing two data sets, compare a centre (median) and a spread (IQR), and say what the difference means in context.' }
    ],
    definitions: [
      { term: 'Interquartile range', meaning: 'The upper quartile minus the lower quartile, $Q_3-Q_1$: the spread of the middle half of the data.' },
      { term: 'Outlier', meaning: 'A value that lies well away from the rest of the data. A fence rule gives a consistent test, but the cause should still be considered.' }
    ],
    formulas: [
      { label: 'Interquartile range', tex: '\\text{IQR}=Q_3-Q_1' },
      { label: 'Outlier fences', tex: '\\text{lower fence}=Q_1-1.5\\times\\text{IQR},\\qquad \\text{upper fence}=Q_3+1.5\\times\\text{IQR}' }
    ],
    points: [
      { front: 'What fraction of the data lies between $Q_1$ and $Q_3$?', back: 'About one half.' },
      { front: 'With an odd number of values, is the median in either half?', back: 'No. Leave the median out of both halves before finding $Q_1$ and $Q_3$.' },
      { front: 'The whiskers of a box plot run to', back: 'The minimum and the maximum, unless outliers are shown separately.' },
      { front: 'Which spread measure should you quote when there is an outlier?', back: 'The IQR, because the range is dominated by the outlier.' }
    ],
    mistakes: [
      { wrong: 'The IQR is the maximum minus the minimum.', right: 'That is the range. The IQR is $Q_3-Q_1$.' },
      { wrong: 'Two box plots have the same median, so the two data sets are the same.', right: 'Centres can match while spreads differ. Compare the IQR and the range as well, and describe the difference in context.' }
    ],
    examples: [
      {
        question: 'Find the five-number summary and the interquartile range of $4,7,8,10,12,13,15,21$.',
        steps: ['There are $8$ values. The lower half is $4,7,8,10$ and the upper half is $12,13,15,21$.', 'Then $Q_1=\\tfrac{7+8}{2}=7.5$, the median is $\\tfrac{10+12}{2}=11$ and $Q_3=\\tfrac{13+15}{2}=14$.', 'The IQR is $14-7.5=6.5$. The minimum and maximum are $4$ and $21$.'],
        answer: '$4,\\ 7.5,\\ 11,\\ 14,\\ 21$; $\\text{IQR}=6.5$',
        verify: { kind: 'values', pairs: [['(7+8)/2', '7.5'], ['(10+12)/2', '11'], ['(13+15)/2', '14'], ['14-7.5', '6.5']] }
      },
      {
        question: 'For the data $12,14,15,15,16,18,19,38$, test whether $38$ is an outlier using the $1.5\\times\\text{IQR}$ rule.',
        steps: ['The lower half is $12,14,15,15$ and the upper half is $16,18,19,38$, so $Q_1=14.5$ and $Q_3=18.5$.', 'The IQR is $18.5-14.5=4$, so the upper fence is $18.5+1.5\\times4=24.5$.', 'Since $38>24.5$, the value $38$ is an outlier.'],
        answer: '$38$ is an outlier (upper fence $24.5$)',
        verify: { kind: 'values', pairs: [['(15+15)/2', '15'], ['18.5-14.5', '4'], ['18.5+1.5*4', '24.5']] }
      },
      {
        question: 'For the data in the last example, find the mean with the outlier and without it, and say which measure is more affected.',
        steps: ['The eight values total $147$, so the mean is $\\tfrac{147}{8}=18.375$.', 'Without $38$, the seven values total $109$ and the mean is $\\tfrac{109}{7}\\approx15.57$.', 'The mean falls by about $2.8$ when the outlier is removed, while the median moves only from $15.5$ to $15$. The mean is more affected.'],
        answer: 'Mean $18.375$ with, $\\approx15.57$ without; the mean is more affected',
        verify: { kind: 'values', pairs: [['12+14+15+15+16+18+19+38', '147'], ['147/8', '18.375'], ['(15+16)/2', '15.5']] }
      }
    ]
  },

  'ma5-equ-c-01': {
    summary: 'Equations A extends linear equations to those with brackets, unknowns on both sides and algebraic fractions, and to linear inequalities. The method never changes: do the same thing to both sides to undo operations in reverse order until the unknown stands alone, and check the answer by substituting.',
    prereqs: ['ma4-equ-c-01', 'ma4-alg-c-01'],
    concepts: [
      { title: 'Balance and inverse operations', body: 'An equation is a balance. Whatever you do to one side you do to the other. Undo the last operation applied to the unknown first: to solve $3(x-2)=2x+5$, expand, collect the $x$ terms on one side, then isolate $x$.' },
      { title: 'Clearing fractions', body: 'Multiply every term by a common denominator. In $\\tfrac{x}{3}+\\tfrac{x-1}{2}=7$ multiply by $6$ to get $2x+3(x-1)=42$, with no fractions left.' },
      { title: 'Inequalities', body: 'Solve them as equations, with one change: multiplying or dividing both sides by a negative number reverses the inequality sign. So $5-2x>11$ gives $-2x>6$ and then $x<-3$.' }
    ],
    definitions: [
      { term: 'Solution', meaning: 'A value of the unknown that makes the equation true. Substitute it back to check.' },
      { term: 'Inequality', meaning: 'A statement comparing two expressions with $<$, $>$, $\\le$ or $\\ge$. Its solution is usually a whole interval of values.' }
    ],
    formulas: [
      { label: 'Equal operations', tex: 'a=b\\ \\Rightarrow\\ a+c=b+c,\\qquad ac=bc\\ (c\\neq0)' },
      { label: 'Reversing an inequality', tex: 'a<b\\ \\Rightarrow\\ -a>-b' }
    ],
    points: [
      { front: 'The first step when there is a bracket', back: 'Expand it, taking care with a negative sign in front: $-2(x-3)=-2x+6$.' },
      { front: 'How do you check a solution?', back: 'Substitute it into the original equation and confirm both sides are equal.' },
      { front: 'When must an inequality sign be reversed?', back: 'When you multiply or divide both sides by a negative number.' },
      { front: 'How do you change the subject of a formula?', back: 'Treat the other letters as numbers and undo operations in reverse: from $v=u+at$ you get $t=\\dfrac{v-u}{a}$.' }
    ],
    mistakes: [
      { wrong: '$3(x-2)=3x-2$.', right: 'The $3$ multiplies both terms: $3x-6$.' },
      { wrong: 'From $-2x>6$ the answer is $x>-3$.', right: 'Dividing by $-2$ reverses the sign, so $x<-3$.' }
    ],
    examples: [
      {
        question: 'Solve $3(x-2)=2x+5$.',
        steps: ['Expand the bracket: $3x-6=2x+5$.', 'Subtract $2x$ from both sides: $x-6=5$.', 'Add $6$: $x=11$. Check: $3(9)=27$ and $2(11)+5=27$.'],
        answer: '$x=11$',
        verify: { kind: 'roots', f: '3*(x-2)-(2*x+5)', answers: ['11'] }
      },
      {
        question: 'Solve $\\dfrac{x}{3}+\\dfrac{x-1}{2}=7$.',
        steps: ['Multiply every term by $6$: $2x+3(x-1)=42$.', 'Expand: $2x+3x-3=42$, so $5x=45$.', 'Then $x=9$. Check: $\\tfrac{9}{3}+\\tfrac{8}{2}=3+4=7$.'],
        answer: '$x=9$',
        verify: { kind: 'roots', f: 'x/3+(x-1)/2-7', answers: ['9'] }
      },
      {
        question: 'Solve $5-2x>11$.',
        steps: ['Subtract $5$ from both sides: $-2x>6$.', 'Divide by $-2$ and reverse the sign: $x<-3$.', 'Test the boundary: at $x=-3$, $5-2(-3)=11$, so $x=-3$ itself makes both sides equal and is not included.'],
        answer: '$x<-3$',
        verify: { kind: 'value', expr: '5-2*(-3)', answer: '11' }
      }
    ]
  },

  'ma5-fin-c-01': {
    summary: 'Financial mathematics A covers earning and spending in Australia: wages with overtime, commission, the 10% goods and services tax (GST), and the percentage arithmetic of markups, discounts and profit. All of it is percentage change applied to dollars.',
    prereqs: ['ma4-frc-c-01', 'ma4-rat-c-01'],
    concepts: [
      { title: 'Earning: wages and overtime', body: 'Pay is rate times hours. Overtime is paid at a multiple of the normal rate, such as time-and-a-half ($\\times1.5$) or double time ($\\times2$). Commission is a percentage of the sales made, often paid on top of a base amount.' },
      { title: 'GST is a 10% addition', body: 'In Australia GST is $10\\%$ of the price before GST. The price including GST is $1.1$ times the price excluding GST, so to go backwards you divide by $1.1$, not take off $10\\%$.' },
      { title: 'Multipliers for percentage change', body: 'Increasing by $p\\%$ multiplies by $1+\\tfrac{p}{100}$ and decreasing multiplies by $1-\\tfrac{p}{100}$. Chained changes multiply: a markup of $40\\%$ then a discount of $15\\%$ multiplies by $1.4\\times0.85$.' }
    ],
    definitions: [
      { term: 'GST', meaning: 'The goods and services tax, a tax of $10\\%$ of the price before tax on most goods and services sold in Australia.' },
      { term: 'Markup', meaning: 'The amount a seller adds to the cost price to reach the selling price, often given as a percentage of the cost.' }
    ],
    formulas: [
      { label: 'Price with and without GST', tex: '\\text{price incl. GST}=1.1\\times\\text{price excl. GST}' },
      { label: 'Percentage change with a multiplier', tex: '\\text{new}=\\text{old}\\times\\left(1\\pm\\frac{p}{100}\\right)' },
      { label: 'Profit as a percentage of cost', tex: '\\text{profit}\\%=\\frac{\\text{selling price}-\\text{cost}}{\\text{cost}}\\times100\\%' }
    ],
    points: [
      { front: 'Time-and-a-half on $\\$28$ per hour', back: '$28\\times1.5=\\$42$ per hour.' },
      { front: 'The GST in a GST-inclusive price of $\\$165$', back: '$\\tfrac{1}{11}$ of the price: $165\\div11=\\$15$, so the price before GST is $\\$150$.' },
      { front: 'A discount of $15\\%$ multiplies the price by', back: '$0.85$.' },
      { front: 'Profit or loss is measured against', back: 'The cost price, not the selling price.' }
    ],
    mistakes: [
      { wrong: 'A GST-inclusive price of $\\$165$ has GST of $10\\%\\times165=\\$16.50$.', right: 'The $10\\%$ was of the price before GST. Divide by $1.1$: $165\\div1.1=\\$150$, so GST is $\\$15$.' },
      { wrong: 'A $40\\%$ markup followed by a $40\\%$ discount returns the cost price.', right: '$1.4\\times0.6=0.84$. The two percentages apply to different amounts, so the final price is $16\\%$ below cost.' }
    ],
    examples: [
      {
        question: 'Mia earns $\\$28$ an hour for a $38$-hour week and is paid time-and-a-half for $6$ hours of overtime. Find her gross pay.',
        steps: ['Normal pay: $38\\times28=1064$.', 'Overtime rate: $28\\times1.5=42$ per hour, so $6$ hours pay $252$.', 'Gross pay is $1064+252=\\$1316$.'],
        answer: '$\\$1316$',
        verify: { kind: 'value', expr: '28*38+6*28*1.5', answer: '1316' }
      },
      {
        question: 'A GST-inclusive price is $\\$165$. Find the price before GST and the GST paid.',
        steps: ['The price with GST is $1.1$ times the price without, so divide: $165\\div1.1=150$.', 'The price before GST is $\\$150$.', 'The GST is $165-150=\\$15$, which is $10\\%$ of $150$.'],
        answer: '$\\$150$ before GST; GST $\\$15$',
        verify: { kind: 'values', pairs: [['165/1.1', '150'], ['165-150', '15']] }
      },
      {
        question: 'A shop buys a jacket for $\\$240$, marks it up by $40\\%$, then sells it at a $15\\%$ discount. Find the selling price and the profit as a percentage of cost.',
        steps: ['Marked price: $240\\times1.4=336$.', 'Selling price: $336\\times0.85=285.60$.', 'Profit is $285.60-240=45.60$, so the profit percentage is $\\tfrac{45.60}{240}\\times100=19\\%$.'],
        answer: '$\\$285.60$; profit $19\\%$ of cost',
        verify: { kind: 'values', pairs: [['240*1.4*0.85', '285.6'], ['(285.6-240)/240*100', '19']] }
      }
    ]
  },

  'ma5-fin-c-02': {
    summary: 'Financial mathematics B is about money growing and shrinking over time. Simple interest grows by the same amount each year, compound interest grows by a fixed percentage of the current balance, and depreciation is compound change downwards. The compound and depreciation formulas are the same one with a different multiplier.',
    prereqs: ['ma5-fin-c-01'],
    concepts: [
      { title: 'Simple interest', body: 'Interest is earned on the original amount only, so the same dollar amount is added every year: $I=Prn$, with the rate $r$ written as a decimal. $\\$5000$ at $4\\%$ a year for $3$ years earns $5000\\times0.04\\times3=\\$600$.' },
      { title: 'Compound interest', body: 'Interest is added to the balance, and the next period earns interest on the new, larger balance. After $n$ periods $A=P(1+r)^n$. The growth is exponential, and over long periods it overtakes simple interest.' },
      { title: 'Depreciation', body: 'An asset that loses value by a fixed percentage each year follows $V=P(1-r)^n$ (declining-balance depreciation). The value falls by a smaller dollar amount each year but never reaches zero.' }
    ],
    definitions: [
      { term: 'Principal', meaning: 'The amount of money first invested or borrowed, before any interest is added.' },
      { term: 'Compounding period', meaning: 'How often interest is added to the balance: yearly, quarterly or monthly. The rate per period is the annual rate divided by the number of periods in a year.' }
    ],
    formulas: [
      { label: 'Simple interest', tex: 'I=Prn,\\qquad A=P(1+rn)' },
      { label: 'Compound interest', tex: 'A=P(1+r)^n,\\qquad I=A-P' },
      { label: 'Declining-balance depreciation', tex: 'V=P(1-r)^n' }
    ],
    points: [
      { front: 'The multiplier for $5\\%$ growth', back: '$1.05$. For $15\\%$ depreciation it is $0.85$.' },
      { front: 'Compound interest is $A-P$, not', back: 'The balance $A$ itself. Subtract the principal to get the interest earned.' },
      { front: 'Interest compounded quarterly at $8\\%$ per year', back: 'The rate per quarter is $2\\%$ and the number of periods is four times the years.' },
      { front: 'Compare the two methods', back: 'In the first year simple and compound interest agree. Afterwards compound interest pulls ahead.' }
    ],
    mistakes: [
      { wrong: '$\\$8000$ at $5\\%$ for $3$ years compounds to $8000\\times1.05\\times3$.', right: 'The exponent applies to the multiplier: $8000\\times1.05^3$. Multiplying by $3$ gives simple interest.' },
      { wrong: 'A car losing $15\\%$ a year is worth $30\\,000\\times(1-0.15\\times3)$ after $3$ years.', right: 'Each year takes $15\\%$ of the current value, so $30\\,000\\times0.85^3$. The straight-line version is a different model.' }
    ],
    examples: [
      {
        question: 'Find the simple interest earned when $\\$5000$ is invested at $4\\%$ per annum for $3$ years.',
        steps: ['Use $I=Prn$ with $P=5000$, $r=0.04$, $n=3$.', '$I=5000\\times0.04\\times3=600$.'],
        answer: '$\\$600$',
        verify: { kind: 'value', expr: '5000*0.04*3', answer: '600' }
      },
      {
        question: 'Find the value of $\\$8000$ invested for $3$ years at $5\\%$ per annum compounded yearly, and the interest earned.',
        steps: ['Use $A=P(1+r)^n$ with $P=8000$, $r=0.05$, $n=3$.', '$A=8000\\times1.05^3=8000\\times1.157625=9261$.', 'The interest is $9261-8000=\\$1261$.'],
        answer: '$A=\\$9261$; interest $\\$1261$',
        verify: { kind: 'values', pairs: [['8000*1.05^3', '9261'], ['9261-8000', '1261']] }
      },
      {
        question: 'A car worth $\\$30\\,000$ depreciates by $15\\%$ per year (declining balance). Find its value after $3$ years.',
        steps: ['Each year the value is multiplied by $1-0.15=0.85$.', 'After $3$ years $V=30\\,000\\times0.85^3$.', '$0.85^3=0.614125$, so $V=\\$18\\,423.75$.'],
        answer: '$\\$18\\,423.75$',
        verify: { kind: 'value', expr: '30000*0.85^3', answer: '18423.75' }
      }
    ]
  },

  'ma5-geo-c-01': {
    summary: 'Properties of geometrical figures A is about reasoning from facts: when two triangles are congruent or similar, what that lets you conclude, and how the angle sum of a polygon follows from the angle sum of a triangle. Each conclusion needs a reason, which is the habit that carries into formal proof.',
    prereqs: ['ma4-geo-c-01', 'ma4-ang-c-01', 'ma4-rat-c-01'],
    concepts: [
      { title: 'Congruent triangles', body: 'Two triangles are congruent when one fits exactly on the other. Four tests are enough: SSS (three sides), SAS (two sides and the angle between them), AAS (two angles and a side) and RHS (a right angle, the hypotenuse and one other side). Matching corresponding parts are then equal.' },
      { title: 'Similar triangles and scale factor', body: 'Similar triangles have equal angles and sides in the same ratio. If one triangle is $k$ times the other, every length is multiplied by $k$ and every area by $k^2$. A $6,8,10$ triangle and a $9,12,15$ triangle have $k=1.5$.' },
      { title: 'Angle sums in polygons', body: 'A polygon with $n$ sides splits into $n-2$ triangles from one vertex, so its interior angles sum to $(n-2)\\times180^\\circ$. The exterior angles of any convex polygon sum to $360^\\circ$.' }
    ],
    definitions: [
      { term: 'Congruent', meaning: 'Identical in shape and size: equal corresponding sides and equal corresponding angles. One figure can be moved onto the other by sliding, turning or flipping.' },
      { term: 'Similar', meaning: 'The same shape but not necessarily the same size: corresponding angles are equal and corresponding sides are in the same ratio.' }
    ],
    formulas: [
      { label: 'Scale factor', tex: 'k=\\frac{\\text{length in image}}{\\text{matching length in original}},\\qquad \\text{area ratio}=k^2' },
      { label: 'Interior angle sum', tex: 'S=(n-2)\\times180^\\circ' }
    ],
    points: [
      { front: 'Is AAA a test for congruent triangles?', back: 'No. Equal angles give similar triangles, which can be different sizes.' },
      { front: 'Each interior angle of a regular $n$-gon', back: '$\\dfrac{(n-2)\\times180^\\circ}{n}$.' },
      { front: 'If the scale factor is $3$, by what factor does the area grow?', back: '$9$, since $3^2=9$.' },
      { front: 'Why must matching sides be matched carefully?', back: 'The ratio is only meaningful for corresponding sides: shortest with shortest, longest with longest.' }
    ],
    mistakes: [
      { wrong: 'Two triangles with all three angles equal must be congruent.', right: 'They are similar. Congruence needs a side as well, for example AAS.' },
      { wrong: 'A scale factor of $2$ makes the area $2$ times larger.', right: 'Area scales by $k^2=4$.' }
    ],
    examples: [
      {
        question: 'Triangle $ABC$ has sides $6,8,10$. A similar triangle $DEF$ has shortest side $9$. Find its other sides.',
        steps: ['The scale factor is $\\tfrac{9}{6}=1.5$.', 'The middle side is $8\\times1.5=12$.', 'The longest side is $10\\times1.5=15$.'],
        answer: '$12$ and $15$',
        verify: { kind: 'values', pairs: [['9/6', '1.5'], ['8*1.5', '12'], ['10*1.5', '15']] }
      },
      {
        question: 'Find the sum of the interior angles of a decagon, and each interior angle of a regular decagon.',
        steps: ['A decagon has $n=10$ sides.', 'The sum is $(10-2)\\times180^\\circ=1440^\\circ$.', 'A regular decagon has equal angles, so each is $1440^\\circ\\div10=144^\\circ$.'],
        answer: '$1440^\\circ$; each angle $144^\\circ$',
        verify: { kind: 'values', pairs: [['(10-2)*180', '1440'], ['1440/10', '144']] }
      },
      {
        question: 'A person $1.8\\text{ m}$ tall casts a shadow $2.4\\text{ m}$ long. At the same time a tree casts a shadow $10\\text{ m}$ long. How tall is the tree?',
        steps: ['The sun makes the same angle with the ground, so the two right triangles are similar.', 'The scale factor from person to tree is $\\tfrac{10}{2.4}$.', 'The height is $1.8\\times\\tfrac{10}{2.4}=7.5\\text{ m}$.'],
        answer: '$7.5\\text{ m}$',
        verify: { kind: 'value', expr: '1.8*10/2.4', answer: '7.5' }
      }
    ]
  },

  'ma5-ind-c-01': {
    summary: 'Indices A extends the index laws to negative and zero indices and applies them to algebraic terms and to scientific notation. A negative index means a reciprocal, a zero index gives one, and the same laws hold throughout, which is why they can be trusted when simplifying.',
    prereqs: ['ma4-ind-c-01', 'ma4-alg-c-01'],
    concepts: [
      { title: 'Zero and negative indices', body: 'Continue the pattern of dividing by the base: $27,9,3,1,\\tfrac13,\\ldots$ is $3^3,3^2,3^1,3^0,3^{-1},\\ldots$. So $a^0=1$ and $a^{-n}=\\dfrac{1}{a^n}$. A negative index does not make the number negative.' },
      { title: 'The index laws with algebra', body: 'For a common base, $a^m\\times a^n=a^{m+n}$, $a^m\\div a^n=a^{m-n}$ and $(a^m)^n=a^{mn}$. A power applies to every factor in a bracket, so $(3x^2)^3=27x^6$.' },
      { title: 'Scientific notation', body: 'A number is written as $a\\times10^k$ with $1\\le a<10$. Multiply the leading numbers and add the powers of ten, then adjust if the leading number leaves the range: $(3\\times10^5)(4\\times10^{-2})=12\\times10^3=1.2\\times10^4$.' }
    ],
    definitions: [
      { term: 'Index (exponent)', meaning: 'The small raised number that says how many times the base is used as a factor, or, if negative, how many times it is divided by.' },
      { term: 'Scientific notation', meaning: 'A way of writing a number as $a\\times10^k$ with $1\\le a<10$ and $k$ an integer.' }
    ],
    formulas: [
      { label: 'Index laws', tex: 'a^m a^n=a^{m+n},\\qquad \\frac{a^m}{a^n}=a^{m-n},\\qquad (a^m)^n=a^{mn}' },
      { label: 'Zero and negative indices', tex: 'a^0=1,\\qquad a^{-n}=\\frac{1}{a^n}\\quad(a\\neq0)' }
    ],
    points: [
      { front: 'Evaluate $2^{-3}$', back: '$\\tfrac{1}{2^3}=\\tfrac18$.' },
      { front: 'Evaluate $\\left(\\tfrac12\\right)^{-2}$', back: '$2^2=4$. A negative index flips the fraction.' },
      { front: 'The index law for $x^5\\div x^8$', back: '$x^{5-8}=x^{-3}=\\dfrac{1}{x^3}$.' },
      { front: 'A number below $1$ in scientific notation', back: 'Uses a negative power of ten: $0.0042=4.2\\times10^{-3}$.' }
    ],
    mistakes: [
      { wrong: '$3^{-2}=-9$.', right: 'A negative index means the reciprocal: $3^{-2}=\\tfrac19$.' },
      { wrong: '$2x^3\\times3x^2=6x^6$.', right: 'Multiply the coefficients and add the indices: $6x^{3+2}=6x^5$.' }
    ],
    examples: [
      {
        question: 'Simplify $\\dfrac{(3x^2)^3}{9x^4}$.',
        steps: ['Apply the power to every factor: $(3x^2)^3=27x^6$.', 'Divide the coefficients, $27\\div9=3$, and subtract the indices: $x^{6-4}=x^2$.', 'The result is $3x^2$.'],
        answer: '$3x^2$',
        verify: { kind: 'equivalent', a: '(3*x^2)^3/(9*x^4)', b: '3*x^2' }
      },
      {
        question: 'Evaluate $2^{-3}+\\left(\\tfrac12\\right)^{-2}$.',
        steps: ['$2^{-3}=\\tfrac{1}{2^3}=\\tfrac18$.', '$\\left(\\tfrac12\\right)^{-2}=2^2=4$.', 'The sum is $\\tfrac18+4=\\tfrac{33}{8}$.'],
        answer: '$\\tfrac{33}{8}$',
        verify: { kind: 'value', expr: '2^(-3)+(1/2)^(-2)', answer: '33/8' }
      },
      {
        question: 'Calculate $(3\\times10^5)(4\\times10^{-2})$ and give the answer in scientific notation.',
        steps: ['Multiply the leading numbers: $3\\times4=12$. Add the powers: $10^{5+(-2)}=10^3$.', 'So the product is $12\\times10^3$, and $12$ is outside the range $1\\le a<10$.', 'Rewrite: $12\\times10^3=1.2\\times10^4$, or $12\\,000$.'],
        answer: '$1.2\\times10^4$',
        verify: { kind: 'value', expr: '3*10^5*4*10^(-2)', answer: '12000' }
      }
    ]
  }
};
