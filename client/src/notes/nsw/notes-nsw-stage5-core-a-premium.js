// Pri Learning · NSW Notes · Stage 5 core, band A · the premium layer.
//
// What sits beside notes-nsw-stage5-core-a.js for each topic, keyed by the same id:
//   examiners  what a marker looks for in a full-mark answer (short, specific)
//   diagrams   specs for diagrams/DiagramFromSpec, drawn from the SAME numbers as the text
//   working    one aligned display block per worked example, in the same order as `examples`
//   check      self-check questions; every answer is re-derived by the engine
// Original writing for Pri Learning; not an official NESA publication. en-AU spelling.
export default {
  'ma5-alg-c-01': {
    examiners: [
      'Every term in the first bracket is multiplied by every term in the second, and the four products are written before like terms are collected.',
      'A common factor is taken out first, and the answer is checked by expanding it again.',
      'A difference of two squares is shown with each term written as a square, for example $4x^2=(2x)^2$ and $25=5^2$.'
    ],
    diagrams: [
      { title: 'Factors show where a graph crosses the axis', spec: { kind: 'function', xmin: -1, xmax: 7, ymin: -3, ymax: 14, curves: [{ expr: 'x^2-7*x+12', intercepts: true, label: 'y=x^2-7x+12' }] }, note: 'The factorised form $(x-3)(x-4)$ is zero at $x=3$ and $x=4$, exactly where the curve meets the $x$-axis.' }
    ],
    working: [
      '\\begin{aligned}(x+3)(x-5)&=x^2-5x+3x-15\\\\&=x^2-2x-15\\end{aligned}',
      '\\begin{aligned}x^2-7x+12&=(x-3)(x-4)\\\\\\text{check: }(x-3)(x-4)&=x^2-4x-3x+12\\end{aligned}',
      '\\begin{aligned}4x^2-25&=(2x)^2-5^2\\\\&=(2x-5)(2x+5)\\end{aligned}'
    ],
    check: [
      { question: 'Expand $(x+4)^2$.', answer: '$x^2+8x+16$', verify: { kind: 'equivalent', a: '(x+4)^2', b: 'x^2+8*x+16' } },
      { question: 'Factorise $x^2+2x-8$.', answer: '$(x+4)(x-2)$', verify: { kind: 'equivalent', a: 'x^2+2*x-8', b: '(x+4)*(x-2)' } }
    ]
  },

  'ma5-are-c-01': {
    examiners: [
      'The fraction of the circle is written first, as $\\tfrac{\\theta}{360}$, before it is multiplied by the area or circumference.',
      'A closed cylinder includes both circular ends, and the working shows $2\\pi r^2$ and $2\\pi rh$ separately or as $2\\pi r(r+h)$.',
      'The answer carries square units, and any rounded decimal is given after the exact value in terms of $\\pi$.'
    ],
    diagrams: [],
    working: [
      '\\begin{aligned}A&=\\tfrac{72}{360}\\times\\pi\\times10^2\\\\&=\\tfrac15\\times100\\pi\\\\&=20\\pi\\approx62.8\\end{aligned}',
      '\\begin{aligned}SA&=2\\pi r(r+h)\\\\&=2\\pi\\times3\\times11\\\\&=66\\pi\\approx207.3\\end{aligned}',
      '\\begin{aligned}SA&=2\\times\\left(\\tfrac12\\times3\\times4\\right)+(3+4+5)\\times10\\\\&=12+120\\\\&=132\\end{aligned}'
    ],
    check: [
      { question: 'Find the exact arc length of a sector of radius $6\\text{ cm}$ and angle $60^\\circ$.', answer: '$2\\pi\\text{ cm}$', verify: { kind: 'value', expr: '60/360*2*pi*6', answer: '2*pi' } },
      { question: 'Find the surface area of a rectangular prism $5\\text{ cm}$ by $4\\text{ cm}$ by $3\\text{ cm}$.', answer: '$94\\text{ cm}^2$', verify: { kind: 'value', expr: '2*(5*4+5*3+4*3)', answer: '94' } }
    ]
  },

  'ma5-dat-c-01': {
    examiners: [
      'Both $\\sum fx$ and $\\sum f$ are written out as numbers before the division, not just the final mean.',
      'For grouped data the class midpoints are listed, and the answer is called an estimate.',
      'The median is located by position in the cumulative frequency, and the class or value holding it is named.'
    ],
    diagrams: [
      { title: 'Grouped data as a histogram', spec: { kind: 'histogram', bins: { edges: [0, 10, 20, 30, 40], counts: [4, 6, 10, 5] } }, note: 'The tallest bar is the modal class, $20$–$29$. The $25$ values sit in four classes with frequencies $4$, $6$, $10$ and $5$.' }
    ],
    working: [
      '\\begin{aligned}\\sum fx&=6+15+32+20=73\\\\\\sum f&=20\\\\\\bar{x}&=\\tfrac{73}{20}=3.65\\end{aligned}',
      '\\begin{aligned}\\sum fx&=18+87+245+172.5=522.5\\\\\\bar{x}&\\approx\\tfrac{522.5}{25}=20.9\\end{aligned}',
      '\\begin{aligned}\\text{total needed}&=75\\times6=450\\\\\\text{total so far}&=72\\times5=360\\\\\\text{sixth mark}&=450-360=90\\end{aligned}'
    ],
    check: [
      { question: 'The scores $1,2,3$ occur with frequencies $2,5,3$. Find the mean.', answer: '$2.1$', verify: { kind: 'value', expr: '(1*2+2*5+3*3)/(2+5+3)', answer: '2.1' } },
      { question: 'Estimate the mean of $10$ values: $5$ in the class $0$–$4$ and $5$ in the class $5$–$9$.', answer: '$4.5$', verify: { kind: 'value', expr: '(2*5+7*5)/10', answer: '4.5' } }
    ]
  },

  'ma5-dat-c-02': {
    examiners: [
      'The data is put in order first, and the median is left out of both halves when the number of values is odd.',
      'The fences are calculated and the outlier is compared against them, rather than being named by eye.',
      'A comparison states a centre and a spread for each set, uses the context, and says which is larger and by how much.'
    ],
    diagrams: [
      { title: 'A box plot with an outlier', spec: { kind: 'boxPlot', data: [12, 14, 15, 15, 16, 18, 19, 38] }, note: 'The median is $15.5$, the quartiles are $14.5$ and $18.5$, and the value $38$ lies far beyond the upper fence of $24.5$ and stretches the whisker.' }
    ],
    working: [
      '\\begin{aligned}Q_1&=\\tfrac{7+8}{2}=7.5\\\\\\text{median}&=\\tfrac{10+12}{2}=11\\\\Q_3&=\\tfrac{13+15}{2}=14\\\\\\text{IQR}&=14-7.5=6.5\\end{aligned}',
      '\\begin{aligned}\\text{IQR}&=18.5-14.5=4\\\\\\text{upper fence}&=18.5+1.5\\times4=24.5\\\\38&>24.5\\end{aligned}',
      '\\begin{aligned}\\text{mean with }38&=\\tfrac{147}{8}=18.375\\\\\\text{mean without}&=\\tfrac{109}{7}\\approx15.57\\end{aligned}'
    ],
    check: [
      { question: 'Find the interquartile range of $2,4,6,8,10,12,14$.', answer: '$8$', verify: { kind: 'values', pairs: [['12-4', '8']] } },
      { question: 'A data set has $Q_1=10$ and $Q_3=20$. Find the upper fence for outliers.', answer: '$35$', verify: { kind: 'value', expr: '20+1.5*(20-10)', answer: '35' } }
    ]
  },

  'ma5-equ-c-01': {
    examiners: [
      'The same operation is shown on both sides at each step, and the line after each step is written down.',
      'Brackets are expanded with every sign handled, and fractions are cleared by multiplying every term, not just one.',
      'The solution is checked by substituting into the original equation, and an inequality sign is reversed whenever a negative number is multiplied or divided.'
    ],
    diagrams: [
      { title: 'Solving as an intersection', spec: { kind: 'function', xmin: -2, xmax: 14, ymin: -14, ymax: 40, curves: [{ expr: '3*x-6', label: 'y=3(x-2)' }, { expr: '2*x+5', label: 'y=2x+5' }], points: [{ x: 11, y: 27, label: '(11, 27)' }] }, note: 'The two sides of $3(x-2)=2x+5$ are equal where the lines cross, at $x=11$, where both equal $27$.' }
    ],
    working: [
      '\\begin{aligned}3(x-2)&=2x+5\\\\3x-6&=2x+5\\\\x-6&=5\\\\x&=11\\end{aligned}',
      '\\begin{aligned}\\tfrac{x}{3}+\\tfrac{x-1}{2}&=7\\\\2x+3(x-1)&=42\\\\5x&=45\\\\x&=9\\end{aligned}',
      '\\begin{aligned}5-2x&>11\\\\-2x&>6\\\\x&<-3\\end{aligned}'
    ],
    check: [
      { question: 'Solve $4x-7=2x+9$.', answer: '$x=8$', verify: { kind: 'roots', f: '4*x-7-(2*x+9)', answers: ['8'] } },
      { question: 'Solve $2x+5\\le13$. State the largest whole number that works.', answer: '$x\\le4$; the largest whole number is $4$', verify: { kind: 'value', expr: '2*4+5', answer: '13' } }
    ]
  },

  'ma5-fin-c-01': {
    examiners: [
      'Normal-rate hours and overtime hours are calculated separately and then added, with the overtime multiplier shown.',
      'GST is removed by dividing by $1.1$, not by subtracting $10\\%$ of the GST-inclusive price.',
      'Percentage profit is stated against the cost price, and money is given to two decimal places with a dollar sign.'
    ],
    diagrams: [
      { title: 'Price including GST', spec: { kind: 'function', xmin: 0, xmax: 200, ymin: 0, ymax: 220, curves: [{ expr: '1.1*x', label: 'y=1.1x' }], points: [{ x: 150, y: 165, label: '(150, 165)' }] }, note: 'The GST-inclusive price is $1.1$ times the price before GST, so a $\\$150$ item costs $\\$165$ including GST.' }
    ],
    working: [
      '\\begin{aligned}\\text{normal}&=38\\times28=1064\\\\\\text{overtime}&=6\\times28\\times1.5=252\\\\\\text{gross}&=1064+252=1316\\end{aligned}',
      '\\begin{aligned}\\text{before GST}&=165\\div1.1=150\\\\\\text{GST}&=165-150=15\\end{aligned}',
      '\\begin{aligned}\\text{selling price}&=240\\times1.4\\times0.85=285.60\\\\\\text{profit}\\%&=\\tfrac{285.60-240}{240}\\times100=19\\end{aligned}'
    ],
    check: [
      { question: 'A price before GST is $\\$64$. Find the price including GST.', answer: '$\\$70.40$', verify: { kind: 'value', expr: '64*1.1', answer: '70.4' } },
      { question: 'Find the pay for $7.5$ hours at $\\$32.50$ per hour.', answer: '$\\$243.75$', verify: { kind: 'value', expr: '7.5*32.5', answer: '243.75' } }
    ]
  },

  'ma5-fin-c-02': {
    examiners: [
      'The formula is stated, then the values are substituted with the rate as a decimal, such as $r=0.05$.',
      'Compound interest is reported as $A-P$ where the question asks for interest, and as $A$ where it asks for the final value.',
      'Depreciation uses the multiplier $1-r$ raised to the number of years, and the answer is stated in dollars to the nearest cent.'
    ],
    diagrams: [
      { title: 'Compound growth against simple interest', spec: { kind: 'compound', principal: 8000, rate: 0.05, years: 3, perYear: 1 }, note: '$\\$8000$ at $5\\%$ a year grows to $\\$9261$ after $3$ years by compounding. Simple interest would reach only $\\$9200$.' }
    ],
    working: [
      '\\begin{aligned}I&=Prn\\\\&=5000\\times0.04\\times3\\\\&=600\\end{aligned}',
      '\\begin{aligned}A&=8000\\times1.05^3\\\\&=9261\\\\I&=9261-8000=1261\\end{aligned}',
      '\\begin{aligned}V&=30\\,000\\times0.85^3\\\\&=30\\,000\\times0.614125\\\\&=18\\,423.75\\end{aligned}'
    ],
    check: [
      { question: 'Find the value of $\\$2000$ after $2$ years at $6\\%$ per annum, compounded yearly.', answer: '$\\$2247.20$', verify: { kind: 'value', expr: '2000*1.06^2', answer: '2247.2' } },
      { question: 'For how many years must $\\$1500$ earn simple interest at $5\\%$ per annum to gain $\\$300$?', answer: '$4$ years', verify: { kind: 'value', expr: '1500*0.05*4', answer: '300' } }
    ]
  },

  'ma5-geo-c-01': {
    examiners: [
      'A congruence test is named in full (SSS, SAS, AAS or RHS) and the three matching parts are listed with the reason for each.',
      'Corresponding sides are matched before a ratio is taken, and the scale factor is stated.',
      'Every angle in a calculation has a reason written beside it, such as the interior angle sum of a polygon.'
    ],
    diagrams: [
      { title: 'A right-angled triangle with sides $6$, $8$, $10$', spec: { kind: 'triangle', a: 6, b: 8, c: 10 }, note: 'A similar triangle with shortest side $9$ has scale factor $1.5$, so its sides are $9$, $12$ and $15$.' },
      { title: 'A regular decagon', spec: { kind: 'polygon', n: 10, side: 1 }, note: 'Ten sides give $(10-2)\\times180^\\circ=1440^\\circ$ in total, so each interior angle is $144^\\circ$.' }
    ],
    working: [
      '\\begin{aligned}k&=\\tfrac{9}{6}=1.5\\\\8\\times1.5&=12\\\\10\\times1.5&=15\\end{aligned}',
      '\\begin{aligned}S&=(10-2)\\times180^\\circ=1440^\\circ\\\\\\text{each angle}&=\\tfrac{1440^\\circ}{10}=144^\\circ\\end{aligned}',
      '\\begin{aligned}\\tfrac{\\text{tree}}{1.8}&=\\tfrac{10}{2.4}\\\\\\text{tree}&=1.8\\times\\tfrac{10}{2.4}=7.5\\end{aligned}'
    ],
    check: [
      { question: 'Find each exterior angle of a regular hexagon.', answer: '$60^\\circ$', verify: { kind: 'value', expr: '360/6', answer: '60' } },
      { question: 'Two similar triangles have corresponding sides $4$ and $10$. A side of $6$ in the smaller triangle matches which side in the larger?', answer: '$15$', verify: { kind: 'value', expr: '6*10/4', answer: '15' } }
    ]
  },

  'ma5-ind-c-01': {
    examiners: [
      'The index law used is named, and a power of a bracket is applied to the coefficient and to every variable inside it.',
      'A negative index is converted to a reciprocal before evaluating, and the answer is given as a positive fraction.',
      'Scientific notation ends with a leading number from $1$ up to but not including $10$, and the power of ten is adjusted when the product leaves that range.'
    ],
    diagrams: [
      { title: 'Powers of $3$ running past zero', spec: { kind: 'sequence', type: 'geometric', first: 81, step: 1 / 3, n: 6 }, note: 'The terms $81,27,9,3,1,\\tfrac13$ are $3^4,3^3,3^2,3^1,3^0,3^{-1}$. Each step divides by $3$, so $3^0=1$ and $3^{-1}=\\tfrac13$.' }
    ],
    working: [
      '\\begin{aligned}\\frac{(3x^2)^3}{9x^4}&=\\frac{27x^6}{9x^4}\\\\&=3x^{6-4}\\\\&=3x^2\\end{aligned}',
      '\\begin{aligned}2^{-3}+\\left(\\tfrac12\\right)^{-2}&=\\tfrac18+2^2\\\\&=\\tfrac18+4\\\\&=\\tfrac{33}{8}\\end{aligned}',
      '\\begin{aligned}(3\\times10^5)(4\\times10^{-2})&=12\\times10^{3}\\\\&=1.2\\times10^{4}\\end{aligned}'
    ],
    check: [
      { question: 'Write $x^{-2}$ with a positive index.', answer: '$\\dfrac{1}{x^2}$', verify: { kind: 'equivalent', a: 'x^(-2)', b: '1/x^2' } },
      { question: 'Calculate $\\dfrac{6\\times10^8}{2\\times10^3}$.', answer: '$3\\times10^5$', verify: { kind: 'value', expr: '(6*10^8)/(2*10^3)', answer: '300000' } }
    ]
  }
};
