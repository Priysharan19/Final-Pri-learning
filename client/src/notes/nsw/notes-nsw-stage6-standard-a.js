// Pri Learning · NSW Notes · Stage 6 Mathematics Standard · Year 11 (all eight chapters) and
// Year 12 Standard 1 (the first seven chapters).
//
// Original revision writing for Pri Learning; it is not an official NESA publication and quotes no
// syllabus text. Each chapter is one complete object (the Stage 4 shape plus the premium layer:
// examiners, diagrams, aligned working, self-check). Every worked example and self-check answer is
// re-derived by the deterministic engine in client/test/nsw-notes-content-check.mjs. en-AU spelling.
export default {
  'mst-11-01': {
    summary: 'A formula is a rule that links quantities. You substitute values into it, rearrange it to make a different quantity the subject, and solve the linear equations that come out. Keep the units, because a correct number with the wrong unit loses the mark.',
    prereqs: ['ma4-equ-c-01'],
    concepts: [
      { title: 'Substitute, then evaluate', body: 'Write the formula, replace each letter with its value in brackets, then work it out. For $v=u+at$ with $u=5$, $a=2.5$ and $t=8$: $v=5+2.5\\times8=25$.' },
      { title: 'Change the subject', body: 'Do the same operation to both sides, undoing the last operation applied to the subject first. From $C=\\tfrac{5}{9}(F-32)$: multiply by $9$, divide by $5$, then add $32$ to get $F=\\tfrac{9C}{5}+32$.' },
      { title: 'Solve an equation with the unknown on both sides', body: 'Collect the unknown on one side and the numbers on the other. For $5x-3=2x+12$: $3x=15$, so $x=5$. Substitute back to check.' },
      { title: 'Keep the units with the numbers', body: 'Convert to one unit before you substitute. A speed in km/h and a time in minutes need one changed first, and the answer carries its unit.' }
    ],
    definitions: [
      { term: 'Subject of a formula', meaning: 'The letter on its own on one side, for example $F$ in $F=\\tfrac{9C}{5}+32$.' },
      { term: 'Substitution', meaning: 'Replacing the letters in a formula or expression with given values.' },
      { term: 'Inverse operation', meaning: 'The operation that undoes another: addition undoes subtraction, multiplication undoes division.' }
    ],
    formulas: [
      { label: 'Speed from rest or change', tex: 'v=u+at', note: '$v$ final speed, $u$ initial speed, $a$ acceleration, $t$ time.' },
      { label: 'Celsius and Fahrenheit', tex: 'F=\\dfrac{9C}{5}+32' },
      { label: 'Cylinder, rearranged for height', tex: 'V=\\pi r^2h\\ \\Rightarrow\\ h=\\dfrac{V}{\\pi r^2}' }
    ],
    points: [
      { front: 'First step when substituting a negative value', back: 'Put it in brackets, so $x^2$ at $x=-3$ is $(-3)^2=9$.' },
      { front: 'Change the subject of $A=\\tfrac{1}{2}bh$ to $h$', back: '$h=\\dfrac{2A}{b}$. Multiply both sides by $2$, then divide by $b$.' },
      { front: 'Solve $\\dfrac{x}{4}+3=8$', back: 'Subtract $3$ to get $\\tfrac{x}{4}=5$, then multiply by $4$: $x=20$.' },
      { front: 'How do you check a solution?', back: 'Substitute it into the original equation. Both sides must give the same number.' },
      { front: 'Convert $45$ minutes to hours', back: '$45\\div60=0.75$ hours.' }
    ],
    mistakes: [
      { wrong: 'From $C=\\tfrac{5}{9}(F-32)$ to $F=\\tfrac{9C}{5}-32$.', right: 'Undo the bracket last: $\\tfrac{9C}{5}=F-32$, so $F=\\tfrac{9C}{5}+32$.' },
      { wrong: 'Evaluating $5+2.5\\times8$ as $7.5\\times8=60$.', right: 'Multiply first: $2.5\\times8=20$, then $5+20=25$.' },
      { wrong: 'Doing an operation to only one side of the equation.', right: 'Whatever is done to one side is done to the whole of the other side.' }
    ],
    examples: [
      {
        question: 'A car starts at $u=5$ m/s and accelerates at $a=2.5$ m/s$^2$ for $t=8$ s. Use $v=u+at$ to find its final speed.',
        steps: ['Write the formula and substitute: $v=5+2.5\\times8$.', 'Multiply first: $2.5\\times8=20$.', 'Add: $v=25$, in metres per second.'],
        answer: '$25$ m/s',
        working: '\\begin{aligned}v&=u+at\\\\&=5+2.5\\times8\\\\&=5+20\\\\&=25\\text{ m/s}\\end{aligned}',
        verify: { kind: 'value', expr: '5+2.5*8', answer: '25' }
      },
      {
        question: 'Make $F$ the subject of $C=\\tfrac{5}{9}(F-32)$, then find $F$ when $C=30$.',
        steps: ['Multiply both sides by $9$: $9C=5(F-32)$.', 'Divide by $5$: $\\tfrac{9C}{5}=F-32$, so $F=\\tfrac{9C}{5}+32$.', 'Substitute $C=30$: $F=\\tfrac{9\\times30}{5}+32=54+32=86$.'],
        answer: '$F=\\tfrac{9C}{5}+32$, and $F=86$ when $C=30$',
        working: '\\begin{aligned}C&=\\tfrac{5}{9}(F-32)\\\\9C&=5(F-32)\\\\\\tfrac{9C}{5}&=F-32\\\\F&=\\tfrac{9C}{5}+32\\\\&=\\tfrac{9\\times30}{5}+32=86\\end{aligned}',
        verify: { kind: 'value', expr: '9*30/5+32', answer: '86' }
      }
    ],
    examiners: [
      'The formula is written first, then the substitution line, then the answer, so a slip can be part-marked.',
      'Each line of rearranging does one operation to both sides, and the equals signs are kept in a column.',
      'The answer carries its unit, for example $25$ m/s, and a solution is checked by substituting back.'
    ],
    diagrams: [
      { title: 'Celsius to Fahrenheit', spec: { kind: 'function', xmin: 0, xmax: 40, ymin: 0, ymax: 120, curves: [{ expr: '1.8*x+32', label: 'F=1.8C+32' }] }, note: 'The line is $F=\\tfrac{9C}{5}+32$. At $C=30$ it reads $F=86$, matching the worked example.' }
    ],
    check: [
      { question: 'Solve $5x-3=2x+12$.', answer: '$x=5$', verify: { kind: 'roots', f: '5*x-3-(2*x+12)', answers: ['5'] } },
      { question: 'Find $A=\\tfrac{1}{2}h(a+b)$ when $a=6$, $b=10$ and $h=4$.', answer: '$32$', verify: { kind: 'value', expr: '1/2*4*(6+10)', answer: '32' } }
    ]
  },

  'mst-11-02': {
    summary: 'A linear relationship has a constant rate of change, so its graph is a straight line $y=mx+c$. The gradient $m$ is the rate and $c$ is the starting value. Two lines meet where both rules give the same $y$, which is how you compare two plans.',
    prereqs: ['ma4-lin-c-01', 'mst-11-01'],
    concepts: [
      { title: 'Gradient is the rate', body: 'The gradient is rise over run: $m=\\tfrac{y_2-y_1}{x_2-x_1}$. In a taxi fare it is the cost per kilometre, in dollars per kilometre.' },
      { title: 'The intercept is the starting value', body: 'The $y$-intercept $c$ is the value when $x=0$, such as a flagfall or joining fee. A fare of $\\$4.20$ plus $\\$2.10$ per kilometre is $C=4.20+2.10d$.' },
      { title: 'Build the rule from information', body: 'Find $m$ from two points, then substitute one point into $y=mx+c$ to find $c$. Always test the rule on the other point.' },
      { title: 'Where two lines meet', body: 'Set the two rules equal and solve. The $x$ value is when the two options cost the same, and the $y$ value is what they both cost.' }
    ],
    definitions: [
      { term: 'Gradient', meaning: 'How steep a line is: the change in $y$ for each change of $1$ in $x$. It is negative when the line falls.' },
      { term: 'Intercept', meaning: 'The point where a line crosses an axis. The $y$-intercept is the value of $y$ when $x=0$.' },
      { term: 'Break-even point', meaning: 'The point where cost and income, or two costs, are equal.' }
    ],
    formulas: [
      { label: 'Gradient', tex: 'm=\\dfrac{y_2-y_1}{x_2-x_1}' },
      { label: 'Gradient-intercept form', tex: 'y=mx+c' },
      { label: 'Parallel lines', tex: 'm_1=m_2', note: 'Parallel lines have the same gradient.' }
    ],
    points: [
      { front: 'What does the gradient of a cost line mean?', back: 'The extra cost for each additional unit, for example dollars per kilometre.' },
      { front: 'Gradient through $(1,3)$ and $(5,11)$', back: '$\\dfrac{11-3}{5-1}=2$.' },
      { front: 'What does a negative gradient show?', back: 'The quantity falls as $x$ increases, for example fuel left in a tank.' },
      { front: 'How do you find where $y=20+9w$ meets $y=56+5w$?', back: 'Set them equal: $20+9w=56+5w$, so $w=9$.' },
      { front: 'Equation of a line with gradient $-2$ through $(0,7)$', back: '$y=-2x+7$.' }
    ],
    mistakes: [
      { wrong: 'Gradient as $\\tfrac{x_2-x_1}{y_2-y_1}$.', right: 'It is the rise over the run: the change in $y$ over the change in $x$.' },
      { wrong: 'Taking $c$ as the first $y$-value given in a table.', right: '$c$ is the value at $x=0$. If the table does not show $x=0$, find $c$ by substitution.' },
      { wrong: 'Reading off the break-even point with only the $x$ value.', right: 'State both: the number of units where the lines meet, and the common cost.' }
    ],
    examples: [
      {
        question: 'A taxi charges a flagfall of $\\$4.20$ plus $\\$2.10$ per kilometre. Write the rule and find the fare for $12$ km.',
        steps: ['The flagfall is the starting value $c=4.20$ and the rate is $m=2.10$.', 'The rule is $C=4.20+2.10d$.', 'For $d=12$: $C=4.20+2.10\\times12=4.20+25.20=29.40$.'],
        answer: '$C=4.20+2.10d$, and the fare is $\\$29.40$',
        working: '\\begin{aligned}C&=4.20+2.10d\\\\&=4.20+2.10\\times12\\\\&=4.20+25.20\\\\&=\\$29.40\\end{aligned}',
        verify: { kind: 'value', expr: '4.2+2.1*12', answer: '29.4' }
      },
      {
        question: 'Plan A costs $C=20+9w$ and Plan B costs $C=56+5w$, where $w$ is the number of weeks. When do the plans cost the same, and what is that cost?',
        steps: ['Set the rules equal: $20+9w=56+5w$.', 'Subtract $5w$ and $20$: $4w=36$, so $w=9$.', 'Cost at $9$ weeks: $20+9\\times9=101$.'],
        answer: '$9$ weeks, at a cost of $\\$101.00$ for each plan',
        working: '\\begin{aligned}20+9w&=56+5w\\\\4w&=36\\\\w&=9\\\\C&=20+9(9)=\\$101\\end{aligned}',
        verify: { kind: 'roots', f: '20+9*w-(56+5*w)', var: 'w', answers: ['9'] }
      }
    ],
    examiners: [
      'The gradient is shown as rise over run with the sign kept, and its meaning is stated in the context, such as dollars per week.',
      'To find $c$, a point is substituted into $y=mx+c$ and the working is shown, then the rule is tested on a second point.',
      'A break-even answer gives both the $x$ value and the common $y$ value, with units.'
    ],
    diagrams: [
      { title: 'Two plans meet at week 9', spec: { kind: 'function', xmin: 0, xmax: 14, ymin: 0, ymax: 160, curves: [{ expr: '20+9*x', label: 'A: C=20+9w' }, { expr: '56+5*x', label: 'B: C=56+5w' }] }, note: 'Plan A starts lower but climbs faster. The lines cross at $w=9$, where both cost $\\$101$.' }
    ],
    check: [
      { question: 'Find the gradient of the line through $(1,3)$ and $(5,11)$.', answer: '$2$', verify: { kind: 'value', expr: '(11-3)/(5-1)', answer: '2' } },
      { question: 'For $y=-2x+7$, find $y$ when $x=4$.', answer: '$-1$', verify: { kind: 'value', expr: '-2*4+7', answer: '-1' } }
    ]
  },

  'mst-11-03': {
    summary: 'Pay can be a wage, a salary, overtime, commission or an allowance. You convert between pay periods, add the parts that make gross pay, and then find the tax payable on a taxable income using the rates the question gives you.',
    prereqs: ['ma4-frc-c-01'],
    concepts: [
      { title: 'Convert between pay periods', body: 'There are $52$ weeks, $26$ fortnights and $12$ months in a year. An annual salary of $\\$78\\,000$ is $78\\,000\\div26=\\$3000$ per fortnight.' },
      { title: 'Overtime', body: 'Overtime is paid at a multiple of the ordinary hourly rate. Time and a half is $1.5\\times$ the rate and double time is $2\\times$. Find ordinary pay and overtime pay separately, then add.' },
      { title: 'Commission and allowances', body: 'Commission is a percentage of sales. An allowance is an extra amount for a condition of the job, such as tools or travel. Both add to gross pay.' },
      { title: 'Income tax is progressive', body: 'The first part of income is taxed at a low rate or not at all, and each higher band is taxed at a higher rate. Tax is the fixed amount for the band plus the rate on the income above its lower limit.' }
    ],
    definitions: [
      { term: 'Gross pay', meaning: 'Total pay before tax and other deductions.' },
      { term: 'Taxable income', meaning: 'Income that remains after allowable deductions. Tax is calculated on this amount.' },
      { term: 'Superannuation', meaning: 'Money an employer pays into a retirement fund for an employee, as a percentage of ordinary earnings, on top of wages.' }
    ],
    formulas: [
      { label: 'Overtime pay', tex: '\\text{pay}=\\text{ordinary hours}\\times r+\\text{overtime hours}\\times k\\,r', note: '$r$ is the hourly rate and $k$ is the overtime multiple, such as $1.5$ or $2$.' },
      { label: 'Commission', tex: '\\text{commission}=\\text{rate}\\times\\text{sales}' },
      { label: 'Tax in a band', tex: 'T=T_0+p\\,(I-L)', note: '$T_0$ is the tax at the start of the band, $p$ the rate on each extra dollar, $I$ the taxable income and $L$ the lower limit of the band.' }
    ],
    points: [
      { front: 'Fortnightly pay from an annual salary', back: 'Divide the annual salary by $26$.' },
      { front: 'Time and a half on $\\$28.50$ per hour', back: '$1.5\\times28.50=\\$42.75$ per hour.' },
      { front: 'Commission of $4\\%$ on $\\$52\\,500$ of sales', back: '$0.04\\times52\\,500=\\$2100$.' },
      { front: 'Does tax apply to the whole income at the top rate?', back: 'No. Only the income above the lower limit of a band is taxed at that band rate.' },
      { front: 'Weekly pay, $38$ hours at $\\$28.50$', back: '$38\\times28.50=\\$1083$.' }
    ],
    mistakes: [
      { wrong: 'Paying all $44$ hours at time and a half.', right: 'Only the overtime hours earn the higher rate. The ordinary hours are paid at the ordinary rate.' },
      { wrong: 'Tax on $\\$62\\,000$ as $30\\%$ of $62\\,000$.', right: 'Take $30\\%$ of the amount over $\\$45\\,000$ only, then add the fixed amount for that band.' },
      { wrong: 'Dividing an annual salary by $12$ to get a fortnightly amount.', right: 'There are $26$ fortnights in a year, so divide by $26$.' }
    ],
    examples: [
      {
        question: 'Mia is paid $\\$28.50$ an hour. In one week she works $38$ ordinary hours and $6$ hours of overtime at time and a half. Find her gross pay.',
        steps: ['Ordinary pay: $38\\times28.50=1083$.', 'Overtime rate: $1.5\\times28.50=42.75$, so overtime pay is $6\\times42.75=256.50$.', 'Gross pay: $1083+256.50=1339.50$.'],
        answer: '$\\$1339.50$',
        working: '\\begin{aligned}\\text{Ordinary}&=38\\times28.50=\\$1083.00\\\\\\text{Overtime}&=6\\times1.5\\times28.50=\\$256.50\\\\\\text{Gross}&=1083.00+256.50=\\$1339.50\\end{aligned}',
        verify: { kind: 'value', expr: '38*28.5+6*1.5*28.5', answer: '1339.5' }
      },
      {
        question: 'Tax on a taxable income of $\\$62\\,000$ is $\\$4288$ plus $30$ cents for each dollar over $\\$45\\,000$. Find the tax payable.',
        steps: ['Income over the lower limit: $62\\,000-45\\,000=17\\,000$.', 'Tax on that part: $0.30\\times17\\,000=5100$.', 'Add the fixed amount: $4288+5100=9388$.'],
        answer: '$\\$9388.00$',
        working: '\\begin{aligned}T&=4288+0.30\\times(62\\,000-45\\,000)\\\\&=4288+0.30\\times17\\,000\\\\&=4288+5100\\\\&=\\$9388.00\\end{aligned}',
        verify: { kind: 'value', expr: '4288+0.3*(62000-45000)', answer: '9388' }
      }
    ],
    examiners: [
      'Ordinary pay and overtime pay are calculated on separate lines, then added to give gross pay.',
      'For tax, the income over the lower limit is found first, then multiplied by the rate, then the fixed amount is added.',
      'Money answers are given to two decimal places with the dollar sign, and the pay period is named, such as per fortnight.'
    ],
    diagrams: [
      { title: 'Tax in the $30\\%$ band', spec: { kind: 'function', xmin: 45000, xmax: 80000, ymin: 0, ymax: 16000, curves: [{ expr: '4288+0.3*(x-45000)', label: 'T=4288+0.3(I-45000)' }] }, note: 'The tax rises by $30$ cents for each extra dollar of income. At $I=62\\,000$ the tax is $\\$9388$.' }
    ],
    check: [
      { question: 'Find the fortnightly pay for an annual salary of $\\$78\\,000$.', answer: '$\\$3000.00$', verify: { kind: 'value', expr: '78000/26', answer: '3000' } },
      { question: 'A salesperson earns $4\\%$ commission on sales of $\\$52\\,500$. Find the commission.', answer: '$\\$2100.00$', verify: { kind: 'value', expr: '0.04*52500', answer: '2100' } }
    ]
  },

  'mst-11-04': {
    summary: 'Managing money means planning a budget, working with percentages for GST and discounts, and finding simple interest. Each calculation is one percentage applied to the right base, so the first job is always to decide what amount the percentage is of.',
    prereqs: ['ma4-frc-c-01', 'mst-11-03'],
    concepts: [
      { title: 'A budget balances income against spending', body: 'List income, fixed costs such as rent and variable costs such as food. The balance is income minus expenses. A negative balance is a deficit and a positive balance is a surplus.' },
      { title: 'GST is $10\\%$ of the price before GST', body: 'Price including GST $=1.1\\times$ price before GST. To go backwards, divide by $1.1$. Do not take $10\\%$ off the GST-inclusive price.' },
      { title: 'Percentage change uses the original amount', body: 'A discount of $15\\%$ on $\\$80$ is a multiplier of $0.85$, giving $\\$68.00$. A percentage change is always measured against the original value.' },
      { title: 'Simple interest grows by the same amount each year', body: 'Interest is calculated on the original principal only, so the balance climbs in equal steps. $\\$6000$ at $5.2\\%$ p.a. earns $\\$312$ every year.' }
    ],
    definitions: [
      { term: 'GST', meaning: 'Goods and services tax: $10\\%$ added to the price of most goods and services in Australia.' },
      { term: 'Principal', meaning: 'The amount of money borrowed or invested at the start.' },
      { term: 'Simple interest', meaning: 'Interest calculated each period on the principal only, not on interest already earned.' }
    ],
    formulas: [
      { label: 'Simple interest', tex: 'I=Prn', note: '$P$ principal in dollars, $r$ the yearly rate as a decimal, $n$ the time in years.' },
      { label: 'Adding and removing GST', tex: 'P_{\\text{incl}}=1.1\\,P_{\\text{excl}},\\qquad P_{\\text{excl}}=\\dfrac{P_{\\text{incl}}}{1.1}' },
      { label: 'Percentage change', tex: '\\text{change}\\ \\%=\\dfrac{\\text{new}-\\text{original}}{\\text{original}}\\times100' }
    ],
    points: [
      { front: 'Convert $30$ months to years for $I=Prn$', back: '$30\\div12=2.5$ years.' },
      { front: 'Multiplier for a $15\\%$ discount', back: '$1-0.15=0.85$.' },
      { front: 'Multiplier for adding GST', back: '$1.10$.' },
      { front: 'Simple interest on $\\$2500$ at $4\\%$ p.a. for $3$ years', back: '$2500\\times0.04\\times3=\\$300$.' },
      { front: 'A surplus in a budget means', back: 'Income is greater than expenses.' }
    ],
    mistakes: [
      { wrong: 'GST on $\\$159.50$ is $10\\%$ of $159.50=\\$15.95$.', right: 'The $\\$159.50$ already includes GST. Divide by $1.1$ to get $\\$145.00$, so the GST is $\\$14.50$.' },
      { wrong: 'Using $n=30$ for $30$ months in $I=Prn$.', right: 'Time is in years when the rate is per year: $n=2.5$.' },
      { wrong: 'A $20\\%$ increase followed by a $20\\%$ decrease returns to the start.', right: 'The decrease is $20\\%$ of the larger amount, so the result is $0.96$ of the start.' }
    ],
    examples: [
      {
        question: 'A jacket costs $\\$159.50$ including GST. Find the price before GST and the amount of GST.',
        steps: ['Price including GST is $1.1$ times the price before GST.', 'Divide: $159.50\\div1.1=145.00$.', 'GST is the difference: $159.50-145.00=14.50$.'],
        answer: 'Price before GST $\\$145.00$, and GST $\\$14.50$',
        working: '\\begin{aligned}P_{\\text{excl}}&=\\dfrac{159.50}{1.1}=\\$145.00\\\\\\text{GST}&=159.50-145.00=\\$14.50\\end{aligned}',
        verify: { kind: 'values', pairs: [['159.5/1.1', '145'], ['159.5-159.5/1.1', '14.5']] }
      },
      {
        question: 'Find the simple interest on $\\$6000$ invested at $5.2\\%$ p.a. for $30$ months.',
        steps: ['Convert the time: $30$ months $=2.5$ years.', 'Write the rate as a decimal: $r=0.052$.', 'Substitute: $I=6000\\times0.052\\times2.5=780$.'],
        answer: '$\\$780.00$',
        working: '\\begin{aligned}I&=Prn\\\\&=6000\\times0.052\\times2.5\\\\&=\\$780.00\\end{aligned}',
        verify: { kind: 'value', expr: '6000*0.052*2.5', answer: '780' }
      }
    ],
    examiners: [
      'The base of each percentage is stated: GST is taken off a GST-inclusive price by dividing by $1.1$, not by subtracting $10\\%$.',
      'Time is converted into years before it is put into $I=Prn$, and the rate is written as a decimal.',
      'Money is given to two decimal places with the dollar sign, and a budget answer says whether it is a surplus or a deficit.'
    ],
    diagrams: [
      { title: 'The balance with simple interest rises in equal steps', spec: { kind: 'sequence', type: 'arithmetic', first: 6000, step: 312, n: 6 }, note: 'Each year adds $6000\\times0.052=\\$312$.' }
    ],
    check: [
      { question: 'A $\\$80$ pair of shoes has $15\\%$ off. Find the sale price.', answer: '$\\$68.00$', verify: { kind: 'value', expr: '80*0.85', answer: '68' } },
      { question: 'Find the simple interest on $\\$2500$ at $4\\%$ p.a. for $3$ years.', answer: '$\\$300.00$', verify: { kind: 'value', expr: '2500*0.04*3', answer: '300' } }
    ]
  },

  'mst-11-05': {
    summary: 'Measurement turns shapes and solids into numbers with units. You calculate perimeter, area, surface area and volume, convert between units, and read capacity in litres. Check the unit of every length before you substitute, and square or cube the conversion factor for area and volume.',
    prereqs: ['ma4-vol-c-01'],
    concepts: [
      { title: 'Volume of a prism or cylinder', body: 'Volume is the area of the base times the height. A rectangular prism is $V=lwh$ and a cylinder is $V=\\pi r^2h$.' },
      { title: 'Capacity from volume', body: '$1000\\text{ cm}^3=1$ L and $1\\text{ m}^3=1000$ L. A tank of radius $0.5$ m and height $1.2$ m holds $\\pi\\times0.5^2\\times1.2=0.3\\pi\\text{ m}^3\\approx942$ L.' },
      { title: 'Convert area and volume units', body: 'One square metre is $100\\times100=10\\,000\\text{ cm}^2$ and one hectare is $10\\,000\\text{ m}^2$. For volume the factor is cubed.' },
      { title: 'Break a composite figure into parts', body: 'Split an awkward shape into rectangles, triangles, trapeziums and circles, find each area and add or subtract, keeping a record of each part.' }
    ],
    definitions: [
      { term: 'Capacity', meaning: 'How much a container holds, measured in litres or millilitres.' },
      { term: 'Surface area', meaning: 'The total area of all the faces of a solid, in square units.' },
      { term: 'Hectare', meaning: 'A unit of land area: $1\\text{ ha}=10\\,000\\text{ m}^2$.' }
    ],
    formulas: [
      { label: 'Rectangular prism', tex: 'V=lwh' },
      { label: 'Cylinder', tex: 'V=\\pi r^2h,\\qquad A_{\\text{curved}}=2\\pi rh' },
      { label: 'Trapezium', tex: 'A=\\dfrac{1}{2}h\\,(a+b)' }
    ],
    points: [
      { front: 'Litres in $2500\\text{ cm}^3$', back: '$2500\\div1000=2.5$ L.' },
      { front: 'Square centimetres in $1\\text{ m}^2$', back: '$10\\,000$, because $100\\times100$.' },
      { front: 'Hectares to square metres', back: 'Multiply by $10\\,000$. So $2.4\\text{ ha}=24\\,000\\text{ m}^2$.' },
      { front: 'What does $r$ mean in $V=\\pi r^2h$?', back: 'The radius, which is half the diameter. Halve a given diameter first.' },
      { front: 'Area of a trapezium with parallel sides $8$ and $12$, height $5$', back: '$\\tfrac{1}{2}\\times5\\times(8+12)=50$.' }
    ],
    mistakes: [
      { wrong: 'Using the diameter in $V=\\pi r^2h$.', right: 'The formula needs the radius. A diameter of $1$ m gives $r=0.5$ m.' },
      { wrong: 'Converting $1\\text{ m}^2$ to $100\\text{ cm}^2$.', right: 'Both lengths are converted, so $1\\text{ m}^2=100\\times100=10\\,000\\text{ cm}^2$.' },
      { wrong: 'Leaving the answer as $0.3\\pi$ with no unit.', right: 'Give the unit, $0.3\\pi\\text{ m}^3$, and convert to litres if the question asks for capacity.' }
    ],
    examples: [
      {
        question: 'A cylindrical tank has a radius of $0.5$ m and a height of $1.2$ m. Find its capacity to the nearest litre.',
        steps: ['Volume: $V=\\pi r^2h=\\pi\\times0.5^2\\times1.2=0.3\\pi\\text{ m}^3$.', 'Evaluate: $0.3\\pi\\approx0.9425\\text{ m}^3$.', 'Convert: $1\\text{ m}^3=1000$ L, so the capacity is about $942$ L.'],
        answer: '$942$ L',
        working: '\\begin{aligned}V&=\\pi r^2h\\\\&=\\pi\\times0.5^2\\times1.2\\\\&=0.3\\pi\\approx0.9425\\text{ m}^3\\\\&=942\\text{ L}\\end{aligned}',
        verify: { kind: 'value', expr: 'pi*0.5^2*1.2*1000', answer: '942.47780' }
      },
      {
        question: 'A fish tank is $80$ cm long, $35$ cm wide and $40$ cm high. How many litres of water does it hold when it is filled to $90\\%$ of its height?',
        steps: ['Volume of the full tank: $80\\times35\\times40=112\\,000\\text{ cm}^3$.', 'Convert: $112\\,000\\div1000=112$ L.', 'Filled to $90\\%$: $0.9\\times112=100.8$ L.'],
        answer: '$100.8$ L',
        working: '\\begin{aligned}V&=80\\times35\\times40=112\\,000\\text{ cm}^3\\\\&=112\\text{ L}\\\\0.9\\times112&=100.8\\text{ L}\\end{aligned}',
        verify: { kind: 'value', expr: '80*35*40/1000*0.9', answer: '100.8' }
      }
    ],
    examiners: [
      'The formula is written, every length is in the same unit, and a diameter is halved to a radius before substitution.',
      'Unit conversions for area and volume use the squared or cubed factor, shown as a line of working.',
      'Capacity answers state litres, and the rounding instruction (for example nearest litre) is followed in the last line only.'
    ],
    diagrams: [
      { title: 'The tank as a cylinder', spec: { kind: 'solid', shape: 'cylinder', r: 0.5, h: 1.2 }, note: 'Radius $0.5$ m and height $1.2$ m give $V=0.3\\pi\\text{ m}^3\\approx942$ L.' },
      { title: 'The fish tank as a prism', spec: { kind: 'solid', shape: 'rectPrism', l: 80, w: 35, h: 40 }, note: 'The full tank is $80\\times35\\times40=112\\,000\\text{ cm}^3$, which is $112$ L.' }
    ],
    check: [
      { question: 'Convert $2.4$ ha to square metres.', answer: '$24\\,000\\text{ m}^2$', verify: { kind: 'value', expr: '2.4*10000', answer: '24000' } },
      { question: 'Find the area of a trapezium with parallel sides $8$ cm and $12$ cm, and height $5$ cm.', answer: '$50\\text{ cm}^2$', verify: { kind: 'value', expr: '1/2*5*(8+12)', answer: '50' } }
    ]
  },

  'mst-11-06': {
    summary: 'Time and location link the clock to the map. Places are located by latitude and longitude, the Earth turns $15^{\\circ}$ each hour, and travel times across time zones need the local time difference added or subtracted. Work in one time zone, then convert once at the end.',
    prereqs: ['mst-11-04'],
    concepts: [
      { title: 'Latitude and longitude', body: 'Latitude is angle north or south of the equator and longitude is angle east or west of the Prime Meridian. Sydney is about $34^{\\circ}$S, $151^{\\circ}$E.' },
      { title: 'Fifteen degrees is one hour', body: 'The Earth turns $360^{\\circ}$ in $24$ hours, so each $15^{\\circ}$ of longitude is $1$ hour of solar time. Places further east are ahead.' },
      { title: 'Time zones and UTC', body: 'Zone times are offsets from UTC. Eastern Australia (AEST) is UTC+10 and Western Australia is UTC+8, so Sydney is $2$ hours ahead of Perth in winter. Daylight saving shifts the eastern states by $1$ hour in summer.' },
      { title: 'Flight and travel itineraries', body: 'Add the travel time to the departure time in the departure zone, then subtract or add the time difference to give the local time at the destination.' }
    ],
    definitions: [
      { term: 'Meridian', meaning: 'A line of longitude, running from pole to pole.' },
      { term: 'UTC', meaning: 'Coordinated Universal Time, the reference that time zones are measured from.' },
      { term: 'Time difference', meaning: 'The number of hours between the local times of two places at the same moment.' }
    ],
    formulas: [
      { label: 'Time difference from longitude', tex: '\\Delta t\\ \\text{(hours)}=\\dfrac{\\Delta\\text{longitude}}{15}' },
      { label: 'Arrival in local time', tex: 't_{\\text{local}}=t_{\\text{depart}}+\\text{flight time}-\\text{time difference}', note: 'Here the time difference is how many hours the destination is behind the departure place, so it is subtracted. If the destination is ahead, add it instead.' }
    ],
    points: [
      { front: 'Degrees of longitude per hour', back: '$15^{\\circ}$, because $360\\div24=15$.' },
      { front: 'Is a place to the east ahead or behind?', back: 'Ahead. The sun reaches it first.' },
      { front: 'Sydney (UTC+10) at $8$ pm. Perth (UTC+8)?', back: '$6$ pm, since Perth is $2$ hours behind.' },
      { front: 'Time difference for $30^{\\circ}$E and $75^{\\circ}$W', back: 'Longitude difference $30+75=105^{\\circ}$, so $105\\div15=7$ hours.' },
      { front: 'Which hemisphere is $34^{\\circ}$S in?', back: 'The southern hemisphere, south of the equator.' }
    ],
    mistakes: [
      { wrong: 'Longitude difference of $151^{\\circ}$E and $116^{\\circ}$E as $151+116$.', right: 'Same side of the Prime Meridian, so subtract: $151-116=35^{\\circ}$.' },
      { wrong: 'Adding the time difference when travelling to a place that is behind.', right: 'A place behind has an earlier clock time, so subtract the difference.' },
      { wrong: 'Giving a time answer of $11.50$ when it means $11$ h $50$ min.', right: 'Write times as $11:50$ am. A decimal hour of $11.50$ is $11$ h $30$ min.' }
    ],
    examples: [
      {
        question: 'A flight leaves Sydney (UTC+10) at $9{:}15$ am and takes $4$ h $35$ min to reach Perth (UTC+8). Find the local arrival time in Perth.',
        steps: ['Arrival in Sydney time: $9{:}15+4{:}35=13{:}50$, which is $1{:}50$ pm.', 'Perth is $2$ hours behind Sydney, so subtract $2$ hours.', 'Local arrival time in Perth: $11{:}50$ am.'],
        answer: '$11{:}50$ am Perth time',
        working: '\\begin{aligned}\\text{Sydney time}&=9{:}15+4{:}35=1{:}50\\text{ pm}\\\\\\text{Perth time}&=1{:}50\\text{ pm}-2\\text{ h}\\\\&=11{:}50\\text{ am}\\end{aligned}',
        verify: { kind: 'value', expr: '9+15/60+4+35/60-2', answer: '11+50/60' }
      },
      {
        question: 'Sydney is at longitude $151^{\\circ}$E and Perth is at $116^{\\circ}$E. By how many minutes does solar time in Sydney lead Perth?',
        steps: ['Both are east, so subtract: $151-116=35^{\\circ}$.', 'Each $15^{\\circ}$ is $1$ hour, so $35\\div15=2.33$ hours.', 'In minutes: $\\tfrac{35}{15}\\times60=140$.'],
        answer: '$140$ minutes, which is $2$ h $20$ min',
        working: '\\begin{aligned}\\Delta\\text{longitude}&=151-116=35^{\\circ}\\\\\\Delta t&=\\dfrac{35}{15}\\text{ h}\\\\&=\\dfrac{35}{15}\\times60=140\\text{ min}\\end{aligned}',
        verify: { kind: 'value', expr: '(151-116)/15*60', answer: '140' }
      }
    ],
    examiners: [
      'The time difference is worked out first and its direction is stated: the destination is ahead or behind.',
      'Longitude differences are added when the places are on opposite sides of the Prime Meridian and subtracted when on the same side.',
      'Times are written in clock form, such as $11{:}50$ am, with the time zone named, and daylight saving is only applied if the question says so.'
    ],
    diagrams: [
      { title: 'Two cities by longitude', spec: { kind: 'numberLine', min: 110, max: 155, points: [{ value: 116, label: '\\text{Perth }116^{\\circ}\\text{E}' }, { value: 151, label: '\\text{Sydney }151^{\\circ}\\text{E}' }] }, note: 'The cities are $35^{\\circ}$ apart. At $15^{\\circ}$ an hour that is $2$ h $20$ min of solar time.' }
    ],
    check: [
      { question: 'It is $8$ pm in Sydney (UTC+10). What is the hour in Perth (UTC+8) on the $24$-hour clock?', answer: '$18{:}00$, which is $6$ pm', verify: { kind: 'value', expr: '20-2', answer: '18' } },
      { question: 'How many hours apart are $30^{\\circ}$E and $75^{\\circ}$W?', answer: '$7$ hours', verify: { kind: 'value', expr: '(30+75)/15', answer: '7' } }
    ]
  },

  'mst-11-07': {
    summary: 'A network is a set of vertices joined by weighted edges. You find the shortest path between two vertices, the minimum spanning tree that joins every vertex for the least total weight, and use degrees to decide whether a trail can cover every edge once.',
    prereqs: ['mst-11-04'],
    concepts: [
      { title: 'Shortest path', body: 'Start at the first vertex with distance $0$. Label each neighbour with the best total found so far, always extending from the unvisited vertex with the smallest label. In the network below, the shortest route $A$ to $F$ is $A\\to C\\to E\\to F$ with length $2+7+3=12$.' },
      { title: 'Trees and spanning trees', body: 'A tree is connected with no cycles, so $v$ vertices have exactly $v-1$ edges. A spanning tree reaches every vertex of a connected network.' },
      { title: 'Minimum spanning tree (Kruskal)', body: 'List the edges by weight. Add the smallest edge that does not close a cycle, and stop at $v-1$ edges. Here the edges $BC\\,(1)$, $AC\\,(2)$, $DE\\,(2)$, $EF\\,(3)$ and $BD\\,(6)$ give a total of $14$.' },
      { title: 'Degree and Euler paths', body: 'The degree of a vertex is the number of edges at it. A connected graph has an Euler circuit when every degree is even, and an Euler path when exactly two degrees are odd.' }
    ],
    definitions: [
      { term: 'Weighted edge', meaning: 'An edge with a number attached, such as a distance in kilometres or a cost in dollars.' },
      { term: 'Cycle', meaning: 'A path that starts and ends at the same vertex without repeating an edge.' },
      { term: 'Spanning tree', meaning: 'A tree that includes every vertex of the network.' }
    ],
    formulas: [
      { label: 'Edges in a tree', tex: 'e=v-1' },
      { label: 'Handshaking lemma', tex: '\\sum \\deg(v)=2e', note: 'The degrees add to twice the number of edges.' }
    ],
    points: [
      { front: 'How many edges in a tree with $9$ vertices?', back: '$9-1=8$.' },
      { front: 'Why reject an edge in Kruskal\'s method?', back: 'It would close a cycle, so it adds weight without reaching a new vertex.' },
      { front: 'Degrees $3,3,2,2,4$. How many edges?', back: '$14\\div2=7$.' },
      { front: 'A connected graph with exactly two odd vertices has', back: 'An Euler path, which starts at one odd vertex and ends at the other.' },
      { front: 'Is the shortest path always the one with the fewest edges?', back: 'No. A route of more edges can have the smaller total weight.' }
    ],
    mistakes: [
      { wrong: 'Choosing the path that begins with the smallest edge as the shortest path.', right: 'Compare the total weight of every route. A small first edge can lead to heavy edges later.' },
      { wrong: 'Adding $CD\\,(8)$ and $DF\\,(6)$ as well in the spanning tree.', right: 'A spanning tree on $6$ vertices stops at $5$ edges. A sixth edge would close a cycle.' },
      { wrong: 'Finding the shortest path length but not naming the route.', right: 'Give the route as a list of vertices and its total weight.' }
    ],
    examples: [
      {
        question: 'In the network shown, the edge weights are $AB=4$, $AC=2$, $BC=1$, $BD=6$, $CD=8$, $CE=7$, $DE=2$, $DF=6$ and $EF=3$. Find the shortest path from $A$ to $F$.',
        steps: ['Labels from $A$: $C=2$, $B=3$ (through $C$), $D=9$ (through $B$), $E=9$ (through $C$).', '$F$ from $E$ is $9+3=12$, from $D$ is $9+6=15$. The smaller is $12$.', 'Route: $A\\to C\\to E\\to F$.'],
        answer: '$A\\to C\\to E\\to F$, of length $12$',
        working: '\\begin{aligned}A\\to C\\to E\\to F&=2+7+3\\\\&=12\\\\A\\to C\\to B\\to D\\to E\\to F&=2+1+6+2+3=14\\end{aligned}',
        verify: { kind: 'values', pairs: [['2+7+3', '12'], ['2+1+6+2+3', '14']] }
      },
      {
        question: 'Use Kruskal\'s method to find the minimum spanning tree of the same network and its total weight.',
        steps: ['In order: $BC\\,1$, $AC\\,2$, $DE\\,2$, $EF\\,3$ are all accepted.', '$AB\\,4$ would close the cycle $ABC$, so it is rejected. $BD\\,6$ joins the two parts, so it is accepted. $DF\\,6$ would close the cycle $DEF$, so it is rejected.', 'That is $5$ edges for $6$ vertices, so stop. Total: $1+2+2+3+6=14$.'],
        answer: 'Edges $BC$, $AC$, $DE$, $EF$, $BD$, total weight $14$',
        working: '\\begin{aligned}\\text{Total}&=BC+AC+DE+EF+BD\\\\&=1+2+2+3+6\\\\&=14\\end{aligned}',
        verify: { kind: 'value', expr: '1+2+2+3+6', answer: '14' }
      }
    ],
    examiners: [
      'The shortest path is named as a list of vertices and its total weight is stated, with every competing route compared.',
      'In a minimum spanning tree each rejected edge is given a reason (it makes a cycle) and the accepted edges are counted as $v-1$.',
      'Degrees are written beside each vertex, and the Euler path or circuit conclusion quotes how many vertices have odd degree.'
    ],
    diagrams: [
      { title: 'Shortest route from $A$ to $F$', spec: { kind: 'network', nodes: [{ id: 'A', x: 0, y: 1 }, { id: 'B', x: 2, y: 2 }, { id: 'C', x: 2, y: 0 }, { id: 'D', x: 4, y: 2 }, { id: 'E', x: 4, y: 0 }, { id: 'F', x: 6, y: 1 }], edges: [{ from: 'A', to: 'B', weight: 4 }, { from: 'A', to: 'C', weight: 2 }, { from: 'B', to: 'C', weight: 1 }, { from: 'B', to: 'D', weight: 6 }, { from: 'C', to: 'D', weight: 8 }, { from: 'C', to: 'E', weight: 7 }, { from: 'D', to: 'E', weight: 2 }, { from: 'D', to: 'F', weight: 6 }, { from: 'E', to: 'F', weight: 3 }], path: ['A', 'C', 'E', 'F'], directed: false }, note: 'The highlighted route $A\\to C\\to E\\to F$ has length $2+7+3=12$.' }
    ],
    check: [
      { question: 'A graph has vertex degrees $3,3,2,2,4$. How many edges does it have?', answer: '$7$', verify: { kind: 'value', expr: '(3+3+2+2+4)/2', answer: '7' } },
      { question: 'How many edges does a tree with $9$ vertices have?', answer: '$8$', verify: { kind: 'value', expr: '9-1', answer: '8' } }
    ]
  },

  'mst-11-08': {
    summary: 'Data analysis summarises a set of numbers by its centre and its spread, and shows its shape. You find the mean, median, quartiles, interquartile range and standard deviation, test for outliers, and read a box plot or histogram to compare data sets honestly.',
    prereqs: ['ma4-dat-c-02'],
    concepts: [
      { title: 'Measures of centre', body: 'The mean is the sum divided by the count. The median is the middle value of the ordered data. An outlier drags the mean but barely moves the median.' },
      { title: 'Quartiles and the interquartile range', body: 'Split the ordered data into two halves at the median. $Q_1$ is the median of the lower half and $Q_3$ the median of the upper half. $\\text{IQR}=Q_3-Q_1$.' },
      { title: 'Outliers', body: 'A value is an outlier if it is below $Q_1-1.5\\times\\text{IQR}$ or above $Q_3+1.5\\times\\text{IQR}$. Test both fences before naming any value.' },
      { title: 'Standard deviation', body: 'Standard deviation $\\sigma$ measures how far values typically sit from the mean. Use the calculator\'s population value $\\sigma_n$ unless told otherwise, and quote it to the precision the question asks for.' }
    ],
    definitions: [
      { term: 'Interquartile range', meaning: 'The spread of the middle half of the data: $Q_3-Q_1$.' },
      { term: 'Outlier', meaning: 'A value that lies far from the rest of the data, outside the $1.5\\times\\text{IQR}$ fences.' },
      { term: 'Skewed distribution', meaning: 'A distribution with a longer tail on one side. A long tail to the right is positively skewed.' }
    ],
    formulas: [
      { label: 'Mean', tex: '\\bar{x}=\\dfrac{\\sum x}{n}' },
      { label: 'Interquartile range', tex: '\\text{IQR}=Q_3-Q_1' },
      { label: 'Outlier fences', tex: 'Q_1-1.5\\,\\text{IQR},\\qquad Q_3+1.5\\,\\text{IQR}' },
      { label: 'Standard deviation', tex: '\\sigma=\\sqrt{\\dfrac{\\sum(x-\\bar{x})^2}{n}}' }
    ],
    points: [
      { front: 'Median of $3,5,8,9$', back: 'Average of the middle two: $(5+8)\\div2=6.5$.' },
      { front: 'Which measure of centre resists outliers?', back: 'The median.' },
      { front: 'Range versus IQR', back: 'Range is maximum minus minimum. IQR is $Q_3-Q_1$ and ignores extreme values.' },
      { front: 'Mean of $4,8,9,15$', back: '$36\\div4=9$.' },
      { front: 'What does a larger standard deviation tell you?', back: 'The values are more spread out about the mean.' }
    ],
    mistakes: [
      { wrong: 'Calling any large value an outlier.', right: 'Calculate the fences. A value is an outlier only if it lies beyond one of them.' },
      { wrong: 'Taking the median of the whole set as $Q_1$.', right: '$Q_1$ is the median of the lower half only.' },
      { wrong: 'Saying one class is better because its mean is higher, ignoring spread.', right: 'Compare centre and spread together, with the measures named: for example median and IQR.' }
    ],
    examples: [
      {
        question: 'For the data $3,5,6,7,8,8,9,10,12,13,14,25$, find the mean and the population standard deviation.',
        steps: ['The sum is $120$ and $n=12$, so $\\bar{x}=10$.', 'The squared deviations are $49,25,16,9,4,4,1,0,4,9,16,225$, which add to $362$.', '$\\sigma=\\sqrt{362\\div12}\\approx5.49$.'],
        answer: 'Mean $10$, standard deviation $5.49$',
        working: '\\begin{aligned}\\bar{x}&=\\dfrac{120}{12}=10\\\\\\sum(x-\\bar{x})^2&=362\\\\\\sigma&=\\sqrt{\\dfrac{362}{12}}\\approx5.49\\end{aligned}',
        verify: { kind: 'values', pairs: [['(3+5+6+7+8+8+9+10+12+13+14+25)/12', '10'], ['sqrt(362/12)', '5.492419']] }
      },
      {
        question: 'For the same data, find $Q_1$, $Q_3$ and the IQR, then test whether $25$ is an outlier.',
        steps: ['Median is $(8+9)\\div2=8.5$. Lower half $3,5,6,7,8,8$ gives $Q_1=(6+7)\\div2=6.5$.', 'Upper half $9,10,12,13,14,25$ gives $Q_3=(12+13)\\div2=12.5$. $\\text{IQR}=6$.', 'Upper fence $12.5+1.5\\times6=21.5$. Since $25>21.5$, $25$ is an outlier.'],
        answer: '$Q_1=6.5$, $Q_3=12.5$, IQR $6$; $25$ is an outlier',
        working: '\\begin{aligned}Q_1&=\\tfrac{6+7}{2}=6.5,\\quad Q_3=\\tfrac{12+13}{2}=12.5\\\\\\text{IQR}&=12.5-6.5=6\\\\\\text{Upper fence}&=12.5+1.5\\times6=21.5\\\\25&>21.5\\end{aligned}',
        verify: { kind: 'values', pairs: [['(6+7)/2', '6.5'], ['(12+13)/2', '12.5'], ['12.5+1.5*(12.5-6.5)', '21.5']] }
      }
    ],
    examiners: [
      'The data is put in order before any quartile is found, and the halves are shown.',
      'An outlier claim is backed by a fence calculation, with both fences checked.',
      'A comparison uses a measure of centre and a measure of spread, named, and is written in the context of the question.'
    ],
    diagrams: [
      { title: 'Box plot of the data', spec: { kind: 'boxPlot', data: [3, 5, 6, 7, 8, 8, 9, 10, 12, 13, 14, 25] }, note: 'The five-number summary is $3$, $6.5$, $8.5$, $12.5$ and $25$. The whisker ends at $14$, the last value inside the fence of $21.5$; $25$ is plotted separately as an outlier.' }
    ],
    check: [
      { question: 'Find the mean of $4,8,9,15$.', answer: '$9$', verify: { kind: 'value', expr: '(4+8+9+15)/4', answer: '9' } },
      { question: '$Q_1=20$ and $Q_3=34$. Find the IQR and the upper outlier fence.', answer: 'IQR $14$; upper fence $55$', verify: { kind: 'values', pairs: [['34-20', '14'], ['34+1.5*(34-20)', '55']] } }
    ]
  },

  'mst-12-s1-01': {
    summary: 'Not every relationship is a straight line. Quadratics give parabolas, exponentials grow or decay by a constant factor, and inverse variation gives a hyperbola. You read these from rules and graphs, solve for when a value is reached, and say what each feature means in the context.',
    prereqs: ['mst-11-02'],
    concepts: [
      { title: 'Quadratic models', body: 'A quadratic $y=ax^2+bx+c$ makes a parabola. The $x$-intercepts are the roots, and the turning point lies halfway between them. A ball $h=-5t^2+20t$ lands when $h=0$, at $t=0$ and $t=4$.' },
      { title: 'Exponential growth and decay', body: 'In $y=a\\times b^x$, the starting value is $a$ and the factor per step is $b$. If $b>1$ it grows; if $0<b<1$ it decays. $N=200\\times2^{t/3}$ doubles every $3$ hours.' },
      { title: 'Inverse variation', body: 'In $y=\\tfrac{k}{x}$, doubling $x$ halves $y$. The product $xy$ is the constant $k$. If $y=12$ when $x=3$, then $k=36$.' },
      { title: 'Solve from a graph or by substitution', body: 'To find when a value is reached, set the rule equal to it. Check the answer is possible in the context, because a time cannot be negative.' }
    ],
    definitions: [
      { term: 'Parabola', meaning: 'The symmetric U-shaped or n-shaped curve of a quadratic.' },
      { term: 'Growth factor', meaning: 'The number $b$ in $y=a\\,b^x$ by which the quantity is multiplied each step.' },
      { term: 'Direct variation', meaning: '$y=kx$: the quantity doubles when $x$ doubles. Its graph is a line through the origin.' }
    ],
    formulas: [
      { label: 'Quadratic', tex: 'y=ax^2+bx+c' },
      { label: 'Exponential', tex: 'y=a\\,b^{x}' },
      { label: 'Inverse variation', tex: 'y=\\dfrac{k}{x}\\ \\Longleftrightarrow\\ xy=k' }
    ],
    points: [
      { front: 'Turning point of a parabola with roots $0$ and $4$', back: 'At $x=2$, halfway between the roots.' },
      { front: 'Growth factor for $6\\%$ growth', back: '$1.06$.' },
      { front: 'Roots of $x^2-3x-10=0$', back: '$x=5$ and $x=-2$.' },
      { front: 'If $y$ varies inversely with $x$ and $x$ is tripled', back: '$y$ becomes one third of its value.' },
      { front: 'Value of $a$ in $y=a\\,b^x$ at $x=0$', back: '$y=a$, because $b^0=1$.' }
    ],
    mistakes: [
      { wrong: 'Giving both roots of a time quadratic, including a negative time.', right: 'Reject any root that is impossible in the context, and say why.' },
      { wrong: 'Treating $200\\times2^{t/3}$ as $400^{t/3}$.', right: 'Only the $2$ is raised to the power. Evaluate the power first, then multiply by $200$.' },
      { wrong: 'Using $k=x+y$ for inverse variation.', right: 'The constant is the product $k=xy$.' }
    ],
    examples: [
      {
        question: 'A ball is thrown so that its height after $t$ seconds is $h=-5t^2+20t$ metres. When does it land, and what is its greatest height?',
        steps: ['Set $h=0$: $-5t(t-4)=0$, so $t=0$ or $t=4$. It lands after $4$ s.', 'The turning point is halfway: $t=2$.', 'Height at $t=2$: $h=-5(4)+20(2)=20$ metres.'],
        answer: 'Lands after $4$ s; greatest height $20$ m at $t=2$ s',
        working: '\\begin{aligned}-5t^2+20t&=0\\\\-5t(t-4)&=0\\\\t&=0\\ \\text{or}\\ 4\\\\h(2)&=-5(2)^2+20(2)=20\\text{ m}\\end{aligned}',
        verify: { kind: 'roots', f: '-5*t^2+20*t', var: 't', answers: ['0', '4'] }
      },
      {
        question: 'A culture starts with $200$ bacteria and doubles every $3$ hours: $N=200\\times2^{t/3}$. How many bacteria are there after $12$ hours?',
        steps: ['Substitute $t=12$: $N=200\\times2^{12/3}$.', 'The exponent is $12\\div3=4$, and $2^4=16$.', '$N=200\\times16=3200$.'],
        answer: '$3200$ bacteria',
        working: '\\begin{aligned}N&=200\\times2^{12/3}\\\\&=200\\times2^4\\\\&=200\\times16\\\\&=3200\\end{aligned}',
        verify: { kind: 'value', expr: '200*2^(12/3)', answer: '3200' }
      }
    ],
    examiners: [
      'A quadratic is solved by setting $y=0$ and factorising, and a root that is impossible in the context is rejected with a reason.',
      'An exponential substitution shows the exponent worked out on its own line before the multiplication.',
      'Features of a graph are named in context, for example "the ball is at its greatest height of $20$ m after $2$ s".'
    ],
    diagrams: [
      { title: 'The path of the ball', spec: { kind: 'function', xmin: -1, xmax: 5, ymin: -5, ymax: 25, curves: [{ expr: '-5*x^2+20*x', intercepts: true, label: 'h=-5t^2+20t' }] }, note: 'The parabola crosses the axis at $t=0$ and $t=4$, with its peak of $20$ m at $t=2$.' }
    ],
    check: [
      { question: 'Solve $x^2-3x-10=0$.', answer: '$x=5$ or $x=-2$', verify: { kind: 'roots', f: 'x^2-3*x-10', answers: ['5', '-2'] } },
      { question: 'A quantity of $50$ grows by $10\\%$ each step. Find its value after $2$ steps.', answer: '$60.5$', verify: { kind: 'value', expr: '50*1.1^2', answer: '60.5' } }
    ]
  },

  'mst-12-s1-02': {
    summary: 'An investment earns interest on interest when it is compounded. You find the future value with $A=P(1+r)^n$, work backwards to the present value, and use a table factor for regular contributions. Match the rate and the number of periods to the compounding frequency.',
    prereqs: ['mst-11-04'],
    concepts: [
      { title: 'Compound interest', body: 'Interest is added each period and then earns interest itself. $\\$5000$ at $4\\%$ p.a. compounded quarterly for $3$ years has $r=\\tfrac{0.04}{4}=0.01$ and $n=12$ periods, so $A=5000\\times1.01^{12}\\approx\\$5634.13$.' },
      { title: 'Match rate and periods', body: 'Divide the yearly rate by the number of periods per year and multiply the years by the same number. Monthly compounding for $2$ years is $n=24$ periods at $\\tfrac{r}{12}$.' },
      { title: 'Present value', body: 'To have $A$ in the future, invest $P=\\dfrac{A}{(1+r)^n}$ now. $\\$20\\,000$ in $5$ years at $5\\%$ p.a. needs about $\\$15\\,670.52$.' },
      { title: 'Regular contributions', body: 'An annuity is a series of equal payments. A table gives a future value factor for each rate and number of periods, and the future value is the contribution times the factor.' }
    ],
    definitions: [
      { term: 'Compounding period', meaning: 'How often interest is added: yearly, half-yearly, quarterly or monthly.' },
      { term: 'Future value', meaning: 'What an investment is worth at the end of its term.' },
      { term: 'Present value', meaning: 'The amount to invest now to reach a given future value.' }
    ],
    formulas: [
      { label: 'Compound interest', tex: 'A=P(1+r)^n', note: '$r$ is the rate per compounding period as a decimal and $n$ is the number of periods.' },
      { label: 'Interest earned', tex: 'I=A-P' },
      { label: 'Present value', tex: 'P=\\dfrac{A}{(1+r)^n}' },
      { label: 'Annuity from a table', tex: 'FV=\\text{contribution}\\times\\text{factor}' }
    ],
    points: [
      { front: 'Rate per period for $6\\%$ p.a. compounded monthly', back: '$\\dfrac{0.06}{12}=0.005$.' },
      { front: 'Number of periods for $2$ years compounded quarterly', back: '$2\\times4=8$.' },
      { front: 'How do you find interest earned?', back: 'Subtract the principal from the future value: $I=A-P$.' },
      { front: '$\\$1200$ at $6\\%$ p.a. compounded half-yearly for $1$ year', back: '$1200\\times1.03^2=\\$1273.08$.' },
      { front: 'Does compound interest beat simple interest over time?', back: 'Yes. It grows by an increasing amount each period, simple interest by a fixed amount.' }
    ],
    mistakes: [
      { wrong: 'Using $r=0.04$ and $n=12$ for quarterly compounding over $3$ years.', right: 'Use $r=0.01$ per quarter for $n=12$ quarters.' },
      { wrong: 'Giving $A$ as the interest earned.', right: '$A$ is the total. The interest is $A-P$.' },
      { wrong: 'Writing $1+0.04/4^{12}$.', right: 'Bracket the base: $\\left(1+\\tfrac{0.04}{4}\\right)^{12}$.' }
    ],
    examples: [
      {
        question: 'Find the future value and the interest earned when $\\$5000$ is invested at $4\\%$ p.a. compounded quarterly for $3$ years.',
        steps: ['Rate per quarter: $r=0.04\\div4=0.01$. Periods: $n=3\\times4=12$.', '$A=5000\\times(1.01)^{12}=5634.13$.', 'Interest: $5634.13-5000=634.13$.'],
        answer: 'Future value $\\$5634.13$, interest $\\$634.13$',
        working: '\\begin{aligned}A&=5000(1+0.01)^{12}\\\\&=\\$5634.13\\\\I&=5634.13-5000\\\\&=\\$634.13\\end{aligned}',
        verify: { kind: 'values', pairs: [['5000*(1+0.04/4)^(3*4)', '5634.12515'], ['5000*(1+0.04/4)^(3*4)-5000', '634.12515']] }
      },
      {
        question: 'How much should be invested now at $5\\%$ p.a. compounded annually to reach $\\$20\\,000$ in $5$ years?',
        steps: ['Rearrange $A=P(1+r)^n$ to $P=\\tfrac{A}{(1+r)^n}$.', 'Substitute: $P=\\tfrac{20\\,000}{1.05^5}$.', '$1.05^5=1.27628$, so $P=\\$15\\,670.52$.'],
        answer: '$\\$15\\,670.52$',
        working: '\\begin{aligned}P&=\\dfrac{A}{(1+r)^n}\\\\&=\\dfrac{20\\,000}{1.05^5}\\\\&=\\$15\\,670.52\\end{aligned}',
        verify: { kind: 'value', expr: '20000/1.05^5', answer: '15670.52333' }
      },
      {
        question: 'Anna deposits $\\$2000$ at the end of each year for $5$ years at $4\\%$ p.a. The future value factor from the table is $5.4163$. Find the future value.',
        steps: ['Future value $=$ contribution $\\times$ factor.', '$2000\\times5.4163=10\\,832.60$.', 'She deposits $5\\times2000=\\$10\\,000$, so the interest is $\\$832.60$.'],
        answer: '$\\$10\\,832.60$',
        working: '\\begin{aligned}FV&=2000\\times5.4163\\\\&=\\$10\\,832.60\\\\I&=10\\,832.60-10\\,000=\\$832.60\\end{aligned}',
        verify: { kind: 'values', pairs: [['2000*5.4163', '10832.6'], ['2000*5.4163-5*2000', '832.6']] }
      }
    ],
    examiners: [
      'The rate and the number of periods are both converted for the compounding frequency, and shown before the substitution.',
      'The formula, the substitution line and the answer to two decimal places with the dollar sign are all present.',
      'Interest earned is stated separately as $A-P$ when the question asks for it.'
    ],
    diagrams: [
      { title: 'Growth of $\\$5000$ at $4\\%$ compounded quarterly', spec: { kind: 'compound', principal: 5000, rate: 0.04, years: 3, perYear: 4 }, note: 'After $3$ years the balance is $\\$5634.13$, which is $\\$634.13$ in interest.' }
    ],
    check: [
      { question: 'Find the future value of $\\$1200$ at $6\\%$ p.a. compounded half-yearly for $1$ year.', answer: '$\\$1273.08$', verify: { kind: 'value', expr: '1200*(1+0.06/2)^(2*1)', answer: '1273.08' } },
      { question: 'Find the future value of $\\$2000$ at $5\\%$ p.a. compounded annually for $2$ years.', answer: '$\\$2205.00$', verify: { kind: 'value', expr: '2000*1.05^2', answer: '2205' } }
    ]
  },

  'mst-12-s1-03': {
    summary: 'Assets lose value, and loans cost money. Depreciation can be straight-line or declining-balance. A loan is repaid in instalments, and the total cost is the repayments minus the amount borrowed. A table factor or a month-by-month step gives the numbers.',
    prereqs: ['mst-12-s1-02'],
    concepts: [
      { title: 'Straight-line depreciation', body: 'The asset loses the same dollar amount each year: $S=V_0-Dn$. A $\\$24\\,000$ machine losing $\\$2500$ a year is worth $24\\,000-4\\times2500=\\$14\\,000$ after $4$ years.' },
      { title: 'Declining-balance depreciation', body: 'The asset loses the same percentage each year, so $S=V_0(1-r)^n$. A $\\$32\\,000$ car losing $15\\%$ a year is worth $32\\,000\\times0.85^3=\\$19\\,652$ after $3$ years.' },
      { title: 'Repayments from a table', body: 'A table gives the monthly repayment per $\\$1000$ borrowed. Multiply by the number of thousands. $\\$15\\,000$ at a factor of $20.28$ per $\\$1000$ is $15\\times20.28=\\$304.20$ a month.' },
      { title: 'Reducing balance, one month at a time', body: 'Interest is charged on the balance still owing. New balance $=$ old balance $\\times\\left(1+\\tfrac{r}{12}\\right)-$ repayment.' }
    ],
    definitions: [
      { term: 'Salvage value', meaning: 'What an asset is worth at the end of its useful life.' },
      { term: 'Reducing-balance loan', meaning: 'A loan where interest is charged each period on the amount still owing.' },
      { term: 'Total interest', meaning: 'Total of all repayments minus the amount borrowed.' }
    ],
    formulas: [
      { label: 'Straight-line depreciation', tex: 'S=V_0-Dn' },
      { label: 'Declining-balance depreciation', tex: 'S=V_0(1-r)^n' },
      { label: 'Repayment from a table', tex: '\\text{repayment}=\\dfrac{\\text{loan}}{1000}\\times\\text{factor}' },
      { label: 'Total interest', tex: '\\text{interest}=\\text{repayment}\\times\\text{number of payments}-\\text{loan}' }
    ],
    points: [
      { front: 'Declining-balance multiplier for $15\\%$ depreciation', back: '$1-0.15=0.85$.' },
      { front: 'Monthly rate for $8\\%$ p.a.', back: '$0.08\\div12=0.00667$ (use the fraction $\\tfrac{0.08}{12}$ in calculations).' },
      { front: 'A $5$-year monthly loan has how many payments?', back: '$5\\times12=60$.' },
      { front: '$\\$10\\,000$ at $10\\%$ declining balance for $2$ years', back: '$10\\,000\\times0.9^2=\\$8100$.' },
      { front: 'Which loses more in year one: straight-line or declining-balance at the same rate?', back: 'They lose the same in year one. Declining-balance then loses less each year.' }
    ],
    mistakes: [
      { wrong: 'Using $0.15$ as the multiplier for $15\\%$ depreciation.', right: 'The multiplier is $1-0.15=0.85$.' },
      { wrong: 'Calling the total repaid the cost of the loan.', right: 'The cost is the total repaid minus the amount borrowed.' },
      { wrong: 'Interest of $15\\,000\\times0.08$ for one month.', right: 'A month is $\\tfrac{1}{12}$ of a year: $15\\,000\\times\\tfrac{0.08}{12}=\\$100$.' }
    ],
    examples: [
      {
        question: 'A car costs $\\$32\\,000$ and depreciates at $15\\%$ p.a. by the declining-balance method. Find its value after $3$ years.',
        steps: ['Multiplier: $1-0.15=0.85$.', 'Substitute: $S=32\\,000\\times0.85^3$.', '$0.85^3=0.614125$, so $S=\\$19\\,652.00$.'],
        answer: '$\\$19\\,652.00$',
        working: '\\begin{aligned}S&=V_0(1-r)^n\\\\&=32\\,000\\times0.85^3\\\\&=\\$19\\,652.00\\end{aligned}',
        verify: { kind: 'value', expr: '32000*(1-0.15)^3', answer: '19652' }
      },
      {
        question: 'A $\\$15\\,000$ loan is repaid monthly over $5$ years. The table factor is $\\$20.28$ per $\\$1000$ per month. Find the monthly repayment, the total repaid and the interest.',
        steps: ['Repayment: $15\\times20.28=304.20$.', 'Number of payments: $5\\times12=60$, so the total is $60\\times304.20=18\\,252$.', 'Interest: $18\\,252-15\\,000=3252$.'],
        answer: 'Repayment $\\$304.20$, total $\\$18\\,252.00$, interest $\\$3252.00$',
        working: '\\begin{aligned}\\text{Repayment}&=15\\times20.28=\\$304.20\\\\\\text{Total}&=60\\times304.20=\\$18\\,252.00\\\\\\text{Interest}&=18\\,252-15\\,000=\\$3252.00\\end{aligned}',
        verify: { kind: 'values', pairs: [['15*20.28', '304.2'], ['60*15*20.28', '18252'], ['60*15*20.28-15000', '3252']] }
      },
      {
        question: 'A $\\$15\\,000$ loan at $8\\%$ p.a. is repaid by $\\$500$ a month on a reducing balance. Find the balance after the first month and after the second month.',
        steps: ['Month 1: interest is $15\\,000\\times\\tfrac{0.08}{12}=100$, so the balance is $15\\,000+100-500=14\\,600$.', 'Month 2: interest is $14\\,600\\times\\tfrac{0.08}{12}=97.33$.', 'Balance: $14\\,600+97.33-500=14\\,197.33$.'],
        answer: '$\\$14\\,600.00$ after month 1, $\\$14\\,197.33$ after month 2',
        working: '\\begin{aligned}B_1&=15\\,000\\left(1+\\tfrac{0.08}{12}\\right)-500=\\$14\\,600.00\\\\B_2&=14\\,600\\left(1+\\tfrac{0.08}{12}\\right)-500=\\$14\\,197.33\\end{aligned}',
        verify: { kind: 'values', pairs: [['15000*(1+0.08/12)-500', '14600'], ['(15000*(1+0.08/12)-500)*(1+0.08/12)-500', '14197.33333']] }
      }
    ],
    examiners: [
      'The depreciation method is named and the multiplier $1-r$ is written before it is raised to the power $n$.',
      'For a loan, the number of payments is found, the total repaid is calculated, and the interest is the total minus the loan.',
      'Each month of a reducing balance is laid out in its own line: interest, repayment, new balance.'
    ],
    diagrams: [
      { title: 'A car losing $15\\%$ a year', spec: { kind: 'function', xmin: 0, xmax: 6, ymin: 0, ymax: 35000, curves: [{ expr: '32000*0.85^x', label: 'S=32000(0.85)^n' }] }, note: 'The drop each year is smaller than the last. At $n=3$ the value is $\\$19\\,652$.' }
    ],
    check: [
      { question: 'A $\\$24\\,000$ machine loses $\\$2500$ a year in straight-line depreciation. Find its value after $4$ years.', answer: '$\\$14\\,000.00$', verify: { kind: 'value', expr: '24000-4*2500', answer: '14000' } },
      { question: 'An asset worth $\\$10\\,000$ depreciates at $10\\%$ p.a. declining balance. Find its value after $2$ years.', answer: '$\\$8100.00$', verify: { kind: 'value', expr: '10000*0.9^2', answer: '8100' } }
    ]
  },

  'mst-12-s1-04': {
    summary: 'In a right-angled triangle the sides are linked by Pythagoras\' theorem and by the trigonometric ratios of the angles. You find a missing side or angle, apply it to heights, ramps and bearings, and keep the calculator in degree mode.',
    prereqs: ['ma4-pyt-c-01'],
    concepts: [
      { title: 'Pythagoras\' theorem', body: 'In a right-angled triangle the square on the hypotenuse equals the sum of the squares on the other two sides: $c^2=a^2+b^2$. A cable of $25$ m reaching $20$ m along the ground has pole height $\\sqrt{25^2-20^2}=15$ m.' },
      { title: 'The three ratios', body: 'Label the sides from the angle $\\theta$: opposite, adjacent and hypotenuse. $\\sin\\theta=\\tfrac{\\text{opp}}{\\text{hyp}}$, $\\cos\\theta=\\tfrac{\\text{adj}}{\\text{hyp}}$, $\\tan\\theta=\\tfrac{\\text{opp}}{\\text{adj}}$.' },
      { title: 'Find an angle with the inverse ratio', body: 'If $\\cos\\theta=\\tfrac{20}{25}=0.8$, then $\\theta=\\cos^{-1}(0.8)\\approx36.9^{\\circ}$. Use the ratio that matches the two sides you know.' },
      { title: 'Angles of elevation and depression', body: 'Both are measured from the horizontal: elevation is upward, depression is downward. The two are equal as alternate angles between parallel lines.' }
    ],
    definitions: [
      { term: 'Hypotenuse', meaning: 'The longest side of a right-angled triangle, opposite the right angle.' },
      { term: 'Angle of elevation', meaning: 'The angle above the horizontal when looking up at an object.' },
      { term: 'Bearing', meaning: 'A direction measured clockwise from north, written as three digits, such as $045^{\\circ}$.' }
    ],
    formulas: [
      { label: 'Pythagoras', tex: 'c^2=a^2+b^2' },
      { label: 'Trigonometric ratios', tex: '\\sin\\theta=\\dfrac{o}{h},\\quad\\cos\\theta=\\dfrac{a}{h},\\quad\\tan\\theta=\\dfrac{o}{a}' }
    ],
    points: [
      { front: 'Hypotenuse for legs $5$ and $12$', back: '$\\sqrt{5^2+12^2}=13$.' },
      { front: 'Which ratio uses opposite and adjacent?', back: 'Tangent: $\\tan\\theta=\\tfrac{o}{a}$.' },
      { front: 'Angle of elevation is measured from', back: 'The horizontal, not the vertical.' },
      { front: 'Calculator mode for degree angles', back: 'Degree (DEG), not radian.' },
      { front: 'A bearing of $270^{\\circ}$ is which direction?', back: 'West.' }
    ],
    mistakes: [
      { wrong: 'Using $c=a+b$ for the hypotenuse.', right: 'Square the sides, add, then take the square root: $c=\\sqrt{a^2+b^2}$.' },
      { wrong: 'Labelling opposite and adjacent from the right angle.', right: 'Label them from the angle you are using, $\\theta$.' },
      { wrong: 'A calculator in radian mode gives $\\tan35=0.4738$.', right: 'In degree mode $\\tan35^{\\circ}=0.7002$. Check the mode first.' }
    ],
    examples: [
      {
        question: 'A $25$ m cable runs from the top of a vertical pole to a point on level ground $20$ m from its base. Find the pole\'s height, and the angle the cable makes with the ground, to the nearest degree.',
        steps: ['Pythagoras: $h=\\sqrt{25^2-20^2}=\\sqrt{225}=15$ m.', 'Adjacent $=20$ and hypotenuse $=25$, so use cosine: $\\cos\\theta=\\tfrac{20}{25}=0.8$.', '$\\theta=\\cos^{-1}(0.8)\\approx36.87^{\\circ}$, so $37^{\\circ}$ to the nearest degree.'],
        answer: 'Height $15$ m; angle $37^{\\circ}$',
        working: '\\begin{aligned}h&=\\sqrt{25^2-20^2}=\\sqrt{225}=15\\text{ m}\\\\\\cos\\theta&=\\dfrac{20}{25}=0.8\\\\\\theta&=\\cos^{-1}(0.8)\\approx37^{\\circ}\\end{aligned}',
        verify: { kind: 'values', pairs: [['sqrt(25^2-20^2)', '15'], ['acos(0.8)*180/pi', '36.86990']] }
      },
      {
        question: 'From a point $20$ m from the base of a tower, the angle of elevation of the top is $35^{\\circ}$. Find the height of the tower to one decimal place.',
        steps: ['The $20$ m is adjacent to the angle and the height is opposite, so use tangent.', '$\\tan35^{\\circ}=\\tfrac{h}{20}$, so $h=20\\tan35^{\\circ}$.', '$h\\approx14.0$ m.'],
        answer: '$14.0$ m',
        working: '\\begin{aligned}\\tan35^{\\circ}&=\\dfrac{h}{20}\\\\h&=20\\tan35^{\\circ}\\\\&\\approx14.0\\text{ m}\\end{aligned}',
        verify: { kind: 'value', expr: '20*tan(35*pi/180)', answer: '14.00415' }
      }
    ],
    examiners: [
      'The sides are labelled opposite, adjacent and hypotenuse from the given angle before a ratio is chosen.',
      'The ratio is written first, then rearranged, then evaluated, and the answer is given with its unit and rounding.',
      'The calculator is in degree mode, which a marker can see from a sensible answer.'
    ],
    diagrams: [
      { title: 'The cable and pole', spec: { kind: 'triangle', a: 20, b: 15, c: 25 }, note: 'Legs $20$ and $15$ with hypotenuse $25$. Here $\\cos\\theta=\\tfrac{20}{25}$ at the base, so $\\theta\\approx37^{\\circ}$.' }
    ],
    check: [
      { question: 'Find the hypotenuse of a right-angled triangle with legs $5$ and $12$.', answer: '$13$', verify: { kind: 'value', expr: 'sqrt(5^2+12^2)', answer: '13' } },
      { question: 'A $6$ m ladder makes an angle of $70^{\\circ}$ with the ground. How high up the wall does it reach, to two decimal places?', answer: '$5.64$ m', verify: { kind: 'value', expr: '6*sin(70*pi/180)', answer: '5.638156' } }
    ]
  },

  'mst-12-s1-05': {
    summary: 'A ratio compares quantities of the same kind, and a rate compares quantities of different kinds, such as kilometres per hour or litres per $100$ km. You share in a ratio, convert units, use scales and compare unit rates, writing every rate with its units.',
    prereqs: ['mst-11-04'],
    concepts: [
      { title: 'Sharing in a ratio', body: 'Add the parts, divide the total by that number to get one part, then multiply. To share $\\$9100$ in the ratio $2:5$: there are $7$ parts, one part is $\\$1300$, so the shares are $\\$2600$ and $\\$6500$.' },
      { title: 'Rates and unit rates', body: 'A rate is a comparison with different units. Divide to get the amount per one unit: $150$ km in $2.5$ h is $60$ km/h.' },
      { title: 'Convert rate units', body: 'To change km/h to m/s, multiply by $1000$ for metres and divide by $3600$ for seconds. So $90$ km/h is $25$ m/s.' },
      { title: 'Scale and fuel use', body: 'A scale of $1:250\\,000$ means $1$ cm on the map is $250\\,000$ cm, or $2.5$ km, on the ground. A fuel use of $7.8$ L per $100$ km over $640$ km is $6.4\\times7.8=49.92$ L.' }
    ],
    definitions: [
      { term: 'Ratio', meaning: 'A comparison of quantities in the same units, such as $3:4$.' },
      { term: 'Rate', meaning: 'A comparison of quantities in different units, such as $60$ km/h.' },
      { term: 'Unit rate', meaning: 'A rate written per one unit, such as dollars per kilogram.' }
    ],
    formulas: [
      { label: 'Share in a ratio', tex: '\\text{one part}=\\dfrac{\\text{total}}{\\text{sum of the ratio}}' },
      { label: 'Speed', tex: 'S=\\dfrac{D}{T}' },
      { label: 'Map scale', tex: '\\text{real length}=\\text{map length}\\times\\text{scale factor}' }
    ],
    points: [
      { front: 'Simplify $36:48$', back: '$3:4$, dividing both by $12$.' },
      { front: 'Convert $90$ km/h to m/s', back: '$90\\times1000\\div3600=25$ m/s.' },
      { front: '$3.2$ cm on a $1:250\\,000$ map', back: '$3.2\\times250\\,000=800\\,000$ cm, which is $8$ km.' },
      { front: 'Which is better value: $2$ kg for $\\$9$ or $5$ kg for $\\$21$?', back: '$\\$4.50$ per kg versus $\\$4.20$ per kg, so the $5$ kg bag.' },
      { front: 'Before sharing in a ratio, check', back: 'That both quantities are in the same unit.' }
    ],
    mistakes: [
      { wrong: 'Sharing $\\$9100$ in $2:5$ by dividing by $2$ and $5$.', right: 'Divide by the total number of parts, $2+5=7$.' },
      { wrong: 'Converting $90$ km/h to m/s by dividing by $1000$.', right: 'Multiply by $1000$ to get metres and divide by $3600$ for seconds.' },
      { wrong: 'Leaving a rate with no unit, such as writing $60$.', right: 'Write the unit with the rate: $60$ km/h.' }
    ],
    examples: [
      {
        question: 'A business makes a profit of $\\$9100$, shared between two partners in the ratio $2:5$. How much does each receive?',
        steps: ['Total parts: $2+5=7$.', 'One part: $9100\\div7=1300$.', 'Shares: $2\\times1300=2600$ and $5\\times1300=6500$.'],
        answer: '$\\$2600.00$ and $\\$6500.00$',
        working: '\\begin{aligned}\\text{One part}&=\\dfrac{9100}{7}=\\$1300\\\\\\text{Shares}&=2\\times1300=\\$2600\\\\&\\phantom{=}\\;5\\times1300=\\$6500\\end{aligned}',
        verify: { kind: 'values', pairs: [['9100/7*2', '2600'], ['9100/7*5', '6500']] }
      },
      {
        question: 'A car uses fuel at $7.8$ litres per $100$ km. How much fuel does it use on a $640$ km trip, and what does it cost at $\\$1.95$ per litre?',
        steps: ['Fuel: $\\tfrac{7.8}{100}\\times640=49.92$ L.', 'Cost: $49.92\\times1.95=97.344$.', 'To the nearest cent the cost is $\\$97.34$.'],
        answer: '$49.92$ L, costing $\\$97.34$',
        working: '\\begin{aligned}\\text{Fuel}&=\\dfrac{7.8}{100}\\times640=49.92\\text{ L}\\\\\\text{Cost}&=49.92\\times1.95\\approx\\$97.34\\end{aligned}',
        verify: { kind: 'values', pairs: [['7.8/100*640', '49.92'], ['49.92*1.95', '97.344']] }
      }
    ],
    examiners: [
      'In a sharing question the total parts are found first, then one part, then each share, and the shares are checked to add to the total.',
      'Rates are written with units on every line, and unit conversions are shown, such as multiplying by $1000$ and dividing by $3600$.',
      'A best-buy answer compares unit prices and names the cheaper per unit, not just the cheaper total.'
    ],
    diagrams: [
      { title: 'Fuel used against distance', spec: { kind: 'function', xmin: 0, xmax: 800, ymin: 0, ymax: 70, curves: [{ expr: '0.078*x', label: 'L=0.078d' }] }, note: 'The gradient $0.078$ L per km is the same rate as $7.8$ L per $100$ km. At $640$ km the use is $49.92$ L.' }
    ],
    check: [
      { question: 'A cyclist rides $150$ km in $2.5$ hours. What is the average speed in km/h?', answer: '$60$ km/h', verify: { kind: 'value', expr: '150/2.5', answer: '60' } },
      { question: 'A map has a scale of $1:250\\,000$. A distance on the map is $3.2$ cm. What is the real distance in kilometres?', answer: '$8$ km', verify: { kind: 'value', expr: '3.2*250000/100000', answer: '8' } }
    ]
  },

  'mst-12-s1-06': {
    summary: 'Bivariate data pairs two measurements for each person or object. A scatterplot shows direction, strength and form, a line of best fit predicts one variable from the other, and the correlation coefficient measures how closely the points follow a line. A strong link is not proof of cause.',
    prereqs: ['mst-11-08', 'mst-11-02'],
    concepts: [
      { title: 'Describe a scatterplot', body: 'Describe direction (positive or negative), strength (strong, moderate, weak) and form (linear or not), and name any outlier. State the variables in context.' },
      { title: 'The least-squares line', body: 'The line $y=mx+c$ that minimises the squared vertical distances to the points. For $(1,46)$, $(2,52)$, $(3,55)$, $(4,62)$, $(5,65)$ the calculator gives $y=4.8x+41.6$. It always passes through $(\\bar{x},\\bar{y})=(3,56)$.' },
      { title: 'Interpret the gradient and intercept', body: 'The gradient $4.8$ says: each extra hour of study is associated with about $4.8$ more marks. The intercept $41.6$ is the predicted mark at $0$ hours, which may be outside the data.' },
      { title: 'Interpolate, do not extrapolate', body: 'A prediction inside the range of the data is interpolation and is reasonably reliable. Outside the range it is extrapolation and may be unreliable.' }
    ],
    definitions: [
      { term: 'Correlation coefficient', meaning: 'The number $r$ between $-1$ and $1$ that measures the strength and direction of a linear relationship.' },
      { term: 'Independent variable', meaning: 'The variable used to predict, placed on the horizontal axis.' },
      { term: 'Extrapolation', meaning: 'Using the line to predict outside the range of the data collected.' }
    ],
    formulas: [
      { label: 'Least-squares line', tex: 'y=mx+c,\\qquad m=\\dfrac{\\sum(x-\\bar{x})(y-\\bar{y})}{\\sum(x-\\bar{x})^2},\\quad c=\\bar{y}-m\\bar{x}' },
      { label: 'Correlation coefficient', tex: 'r=\\dfrac{\\sum(x-\\bar{x})(y-\\bar{y})}{\\sqrt{\\sum(x-\\bar{x})^2\\,\\sum(y-\\bar{y})^2}}' }
    ],
    points: [
      { front: 'What does $r=0.99$ show?', back: 'A very strong positive linear relationship.' },
      { front: 'What does $r$ close to $0$ show?', back: 'Little or no linear relationship.' },
      { front: 'Does correlation prove cause?', back: 'No. A third factor may drive both, or the link may be coincidence.' },
      { front: 'Point the least-squares line always passes through', back: 'The mean point $(\\bar{x},\\bar{y})$.' },
      { front: 'Prediction at $x=10$ with data for $x$ from $1$ to $5$', back: 'Extrapolation, so it may be unreliable.' }
    ],
    mistakes: [
      { wrong: 'Saying studying more causes higher marks because $r$ is close to $1$.', right: 'Say the variables are strongly associated. Causation needs more evidence than a correlation.' },
      { wrong: 'Interpreting the gradient without units.', right: 'Say "about $4.8$ extra marks for each extra hour of study".' },
      { wrong: 'Trusting a prediction a long way outside the data.', right: 'Flag it as extrapolation and say it may be unreliable.' }
    ],
    examples: [
      {
        question: 'For the data $(1,46)$, $(2,52)$, $(3,55)$, $(4,62)$, $(5,65)$ the means are $\\bar{x}=3$ and $\\bar{y}=56$, with $\\sum(x-\\bar{x})(y-\\bar{y})=48$ and $\\sum(x-\\bar{x})^2=10$. Find the least-squares line.',
        steps: ['Gradient: $m=\\tfrac{48}{10}=4.8$.', 'Intercept: $c=56-4.8\\times3=41.6$.', 'The line is $y=4.8x+41.6$.'],
        answer: '$y=4.8x+41.6$',
        working: '\\begin{aligned}m&=\\dfrac{48}{10}=4.8\\\\c&=\\bar{y}-m\\bar{x}=56-4.8(3)\\\\&=41.6\\\\y&=4.8x+41.6\\end{aligned}',
        verify: { kind: 'values', pairs: [['48/10', '4.8'], ['56-4.8*3', '41.6']] }
      },
      {
        question: 'Use $y=4.8x+41.6$ to predict the mark for $4.5$ hours of study, and for $10$ hours. Comment on each.',
        steps: ['$x=4.5$: $y=4.8\\times4.5+41.6=63.2$. This is inside the data range from $1$ to $5$, so it is interpolation.', '$x=10$: $y=4.8\\times10+41.6=89.6$.', '$10$ hours is outside the range, so this is extrapolation and may be unreliable.'],
        answer: '$63.2$ (reliable); $89.6$ (extrapolation, unreliable)',
        working: '\\begin{aligned}y(4.5)&=4.8(4.5)+41.6=63.2\\\\y(10)&=4.8(10)+41.6=89.6\\end{aligned}',
        verify: { kind: 'values', pairs: [['4.8*4.5+41.6', '63.2'], ['4.8*10+41.6', '89.6']] }
      }
    ],
    examiners: [
      'The relationship is described by direction, strength and form, and an interpretation names the variables and units.',
      'A prediction is labelled interpolation or extrapolation, with a comment on its reliability.',
      'The word "cause" is not used for correlation. The answer says the variables are associated.'
    ],
    diagrams: [
      { title: 'Study time and test mark', spec: { kind: 'scatter', points: [[1, 46], [2, 52], [3, 55], [4, 62], [5, 65]], line: 'fit', xLabel: 'Hours of study', yLabel: 'Test mark' }, note: 'The least-squares line is $y=4.8x+41.6$ and passes through the mean point $(3,56)$. The correlation coefficient is $r\\approx0.99$.' }
    ],
    check: [
      { question: 'Use $y=3.2x+10$ to predict $y$ when $x=12$.', answer: '$48.4$', verify: { kind: 'value', expr: '3.2*12+10', answer: '48.4' } },
      { question: 'Using $y=4.8x+41.6$, find $y$ when $x=2.5$.', answer: '$53.6$', verify: { kind: 'value', expr: '4.8*2.5+41.6', answer: '53.6' } }
    ]
  },

  'mst-12-s1-07': {
    summary: 'Probability measures chance from $0$ to $1$. When outcomes are not equally likely you estimate it with relative frequency, and for equally likely outcomes you count. You multiply along branches of a tree for several stages, using the complement and expected numbers to answer in context.',
    prereqs: ['ma4-pro-c-01'],
    concepts: [
      { title: 'Relative frequency estimates probability', body: 'Relative frequency is the number of times an event happened divided by the number of trials: $\\tfrac{46}{200}=0.23$. It settles closer to the true probability as trials increase.' },
      { title: 'Expected number', body: 'Expected number $=$ probability $\\times$ number of trials. If $P=0.23$, then in $500$ spins you expect $0.23\\times500=115$. The actual number varies.' },
      { title: 'Complement and exclusive events', body: '$P(\\text{not }A)=1-P(A)$. If events cannot happen together, $P(A\\text{ or }B)=P(A)+P(B)$.' },
      { title: 'Multistage events on a tree', body: 'Multiply along the branches for "and", add the branch products for "or". Without replacement the second-stage probabilities change. A bag of $3$ red and $2$ blue gives $P(\\text{two red})=\\tfrac{3}{5}\\times\\tfrac{2}{4}=\\tfrac{3}{10}$.' }
    ],
    definitions: [
      { term: 'Relative frequency', meaning: 'The fraction of trials in which an event occurred.' },
      { term: 'Complementary event', meaning: 'The event that $A$ does not happen, with $P(\\text{not }A)=1-P(A)$.' },
      { term: 'Without replacement', meaning: 'Items drawn are not put back, so later probabilities depend on earlier draws.' }
    ],
    formulas: [
      { label: 'Probability of an event', tex: 'P(A)=\\dfrac{\\text{number of favourable outcomes}}{\\text{number of equally likely outcomes}}' },
      { label: 'Relative frequency', tex: '\\text{relative frequency}=\\dfrac{f}{n}' },
      { label: 'Complement and expected number', tex: 'P(\\text{not }A)=1-P(A),\\qquad E=n\\,P(A)' }
    ],
    points: [
      { front: 'Range of any probability', back: 'From $0$ (impossible) to $1$ (certain).' },
      { front: '$P(\\text{rain})=0.35$. $P(\\text{no rain})$', back: '$1-0.35=0.65$.' },
      { front: 'Two dice: probability the sum is $7$', back: '$6$ outcomes out of $36$, so $\\tfrac{1}{6}$.' },
      { front: 'Does a larger number of trials make relative frequency more reliable?', back: 'Yes. It tends to settle near the true probability.' },
      { front: 'On a tree, which operation is used along a path?', back: 'Multiplication.' }
    ],
    mistakes: [
      { wrong: 'Probability of two reds without replacement as $\\tfrac{3}{5}\\times\\tfrac{3}{5}$.', right: 'One red is gone, so the second probability is $\\tfrac{2}{4}$.' },
      { wrong: 'Adding branch probabilities along a single path.', right: 'Multiply along a path, then add the products of different paths.' },
      { wrong: 'Saying exactly $115$ reds will occur in $500$ spins.', right: 'It is the expected number. The actual count varies.' }
    ],
    examples: [
      {
        question: 'A spinner is spun $200$ times and lands on red $46$ times. Find the relative frequency of red, and the expected number of reds in $500$ spins.',
        steps: ['Relative frequency: $\\tfrac{46}{200}=0.23$.', 'Use it as the probability: $E=0.23\\times500$.', '$E=115$ reds.'],
        answer: 'Relative frequency $0.23$; expect about $115$ reds',
        working: '\\begin{aligned}\\text{Relative frequency}&=\\dfrac{46}{200}=0.23\\\\E&=0.23\\times500=115\\end{aligned}',
        verify: { kind: 'values', pairs: [['46/200', '0.23'], ['500*46/200', '115']] }
      },
      {
        question: 'A bag has $3$ red and $2$ blue marbles. Two are drawn without replacement. Find the probability that both are red and the probability that they are different colours.',
        steps: ['Both red: $\\tfrac{3}{5}\\times\\tfrac{2}{4}=\\tfrac{6}{20}=\\tfrac{3}{10}$.', 'Red then blue: $\\tfrac{3}{5}\\times\\tfrac{2}{4}=\\tfrac{3}{10}$. Blue then red: $\\tfrac{2}{5}\\times\\tfrac{3}{4}=\\tfrac{3}{10}$.', 'Different colours: $\\tfrac{3}{10}+\\tfrac{3}{10}=\\tfrac{3}{5}$.'],
        answer: '$P(\\text{both red})=\\tfrac{3}{10}$, $P(\\text{different})=\\tfrac{3}{5}$',
        working: '\\begin{aligned}P(RR)&=\\tfrac{3}{5}\\times\\tfrac{2}{4}=\\tfrac{3}{10}\\\\P(\\text{different})&=P(RB)+P(BR)\\\\&=\\tfrac{3}{5}\\times\\tfrac{2}{4}+\\tfrac{2}{5}\\times\\tfrac{3}{4}=\\tfrac{3}{5}\\end{aligned}',
        verify: { kind: 'values', pairs: [['3/5*2/4', '3/10'], ['3/5*2/4+2/5*3/4', '3/5']] }
      }
    ],
    examiners: [
      'Probabilities are written as fractions or decimals between $0$ and $1$, and branches from one point add to $1$.',
      'The second-stage probabilities on a tree are adjusted for what was removed, and each path product is shown.',
      'An expected number is described as an expectation, not a certainty, and is calculated as probability times trials.'
    ],
    diagrams: [
      { title: 'Two draws without replacement', spec: { kind: 'tree', branches: [{ label: 'R', p: [3, 5], children: [{ label: 'R', p: [2, 4] }, { label: 'B', p: [2, 4] }] }, { label: 'B', p: [2, 5], children: [{ label: 'R', p: [3, 4] }, { label: 'B', p: [1, 4] }] }] }, note: 'The four paths give $\\tfrac{3}{10}$, $\\tfrac{3}{10}$, $\\tfrac{3}{10}$ and $\\tfrac{1}{10}$, which add to $1$.' }
    ],
    check: [
      { question: 'The chance of rain is $0.35$. What is the chance of no rain?', answer: '$0.65$', verify: { kind: 'value', expr: '1-0.35', answer: '0.65' } },
      { question: 'Two fair dice are rolled. What is the probability that the sum is $7$?', answer: '$\\tfrac{1}{6}$', verify: { kind: 'value', expr: '6/36', answer: '1/6' } }
    ]
  }
};
