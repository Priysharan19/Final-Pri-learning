// Pri Learning · NSW Notes · Stage 6 Mathematics Standard 2 (Year 12).
//
// Original revision writing for Pri Learning; it is not an official NESA publication and quotes no
// syllabus text. Each chapter is one complete object (summary to check), keyed by the topic id.
// Every worked-example and self-check answer is re-derived by the deterministic engine in
// client/test/nsw-notes-content-check.mjs, never by the author's say-so. en-AU spelling.
export default {
  'mst-12-s2-01': {
    summary: 'An algebraic relationship links two quantities by a rule you can write, graph and solve. The Year 12 work is modelling: choosing a linear, quadratic or exponential rule, reading it from a graph, and solving it to answer a question in context such as break-even or depreciation.',
    prereqs: [],
    concepts: [
      { title: 'Linear models and break-even', body: 'A linear model has a fixed part and a rate: $C=1200+15n$ is a fixed cost of $\\$1200$ plus $\\$15$ for each of $n$ items. Revenue $R=40n$ has no fixed part. The break-even point is where $R=C$, so you solve $40n=1200+15n$.' },
      { title: 'Simultaneous equations as a meeting point', body: 'Two relationships hold at the same time where their graphs cross. Set the expressions equal, solve for the shared variable, then substitute back to get the other one.' },
      { title: 'Quadratic models', body: 'A quadratic such as $h=20t-5t^2$ gives a parabola. It starts at $h=0$, rises to a maximum at the midpoint of its two roots, then returns to $h=0$. Roots are where the model equals zero.' },
      { title: 'Exponential models', body: 'In $V=V_0\\times b^t$ the value is multiplied by the same factor $b$ every period. A factor $b=0.8$ is a $20\\%$ fall each period (decay); $b=1.1$ is a $10\\%$ rise (growth).' }
    ],
    definitions: [
      { term: 'Break-even point', meaning: 'The number of items where revenue equals cost, so profit is zero. Below it there is a loss, above it a profit.' },
      { term: 'Exponential decay', meaning: 'A quantity that is multiplied by a constant factor between $0$ and $1$ each period, so it falls quickly at first and then more slowly.' },
      { term: 'Root', meaning: 'A value of the variable that makes the whole expression equal to zero. On a graph it is where the curve meets the horizontal axis.' }
    ],
    formulas: [
      { label: 'Profit', tex: 'P=R-C', note: 'Profit is revenue minus cost; break-even is $P=0$.' },
      { label: 'Exponential model', tex: 'V=V_0\\,b^{\\,t}', note: '$V_0$ is the starting value, $b$ the growth or decay factor per period, $t$ the number of periods.' },
      { label: 'Maximum of a parabola', tex: 't=\\dfrac{t_1+t_2}{2}', note: 'The turning point sits halfway between the two roots.' }
    ],
    points: [
      { front: 'How do you find a break-even point?', back: 'Set revenue equal to cost and solve: $R=C$.' },
      { front: 'What factor means a $15\\%$ fall each year?', back: '$b=0.85$, because $100\\%-15\\%=85\\%$.' },
      { front: 'Where is the maximum of a parabola with roots $0$ and $4$?', back: 'At $t=2$, halfway between the roots.' },
      { front: 'What do the fixed part and the rate mean in $C=1200+15n$?', back: '$\\$1200$ is paid whatever $n$ is; $\\$15$ is the extra cost of each item.' },
      { front: 'Below break-even, is it a profit or a loss?', back: 'A loss, because cost is above revenue.' }
    ],
    mistakes: [
      { wrong: 'Writing a $20\\%$ fall as $V=V_0\\times0.2^t$.', right: 'The factor is what is left: $100\\%-20\\%=80\\%$, so $V=V_0\\times0.8^t$.' },
      { wrong: 'Giving the break-even answer as a dollar amount only.', right: 'State the number of items, $n=48$, and if asked the revenue there, $\\$1920$.' },
      { wrong: 'Reading the maximum height from the roots, for example $4$.', right: 'The roots give the times. Substitute $t=2$ to get the height, $20$ metres.' }
    ],
    examples: [
      {
        question: 'A stall has costs $C=1200+15n$ and takes revenue $R=40n$ dollars for $n$ items. Find the break-even number of items and the profit when $80$ items are sold.',
        steps: ['Set $R=C$: $40n=1200+15n$.', 'Subtract $15n$: $25n=1200$, so $n=48$.', 'At $n=80$: $R=3200$ and $C=1200+1200=2400$.', 'Profit is $3200-2400=800$.'],
        answer: 'Break-even at $n=48$ items; profit $\\$800.00$ at $80$ items.',
        working: '\\begin{aligned}40n&=1200+15n\\\\25n&=1200\\\\n&=48\\\\P(80)&=40(80)-\\left(1200+15(80)\\right)\\\\&=3200-2400=800\\end{aligned}',
        verify: { kind: 'roots', f: '40*x-(1200+15*x)', answers: ['48'] }
      },
      {
        question: 'A car is worth $\\$30000$ and loses $20\\%$ of its value each year, so $V=30000\\times0.8^t$. Find its value after $3$ years.',
        steps: ['A $20\\%$ fall each year gives the factor $0.8$.', 'After $3$ years: $V=30000\\times0.8^3$.', '$0.8^3=0.512$.', '$30000\\times0.512=15360$.'],
        answer: '$\\$15360.00$',
        working: '\\begin{aligned}V&=30000\\times0.8^3\\\\&=30000\\times0.512\\\\&=15360\\end{aligned}',
        verify: { kind: 'value', expr: '30000*0.8^3', answer: '15360' }
      },
      {
        question: 'A ball is hit so that its height in metres after $t$ seconds is $h=20t-5t^2$. When does it land, and what is its greatest height?',
        steps: ['It lands when $h=0$: $20t-5t^2=5t(4-t)=0$.', 'The roots are $t=0$ and $t=4$, so it lands after $4$ seconds.', 'The maximum is halfway: $t=2$.', 'At $t=2$: $h=20(2)-5(4)=20$.'],
        answer: 'It lands after $4$ seconds; the greatest height is $20$ m.',
        working: '\\begin{aligned}20t-5t^2&=0\\\\5t(4-t)&=0\\\\t&=0\\ \\text{or}\\ t=4\\\\h(2)&=40-20=20\\end{aligned}',
        verify: { kind: 'roots', f: '20*x-5*x^2', answers: ['0', '4'] }
      }
    ],
    examiners: [
      'The model is written as an equation with the variables named and the units stated, before any solving.',
      'Both sides are set equal on a line of their own, then solved; the answer is put back into the context ("48 items").',
      'For decay the factor is $1-\\text{rate}$, and the working shows the power evaluated before multiplying.',
      'A maximum is found by substituting the halfway value, with the root working shown.'
    ],
    diagrams: [
      { title: 'Break-even at $48$ items', spec: { kind: 'function', xmin: 0, xmax: 80, ymin: 0, ymax: 4000, curves: [{ expr: '40*x', label: 'R=40n' }, { expr: '1200+15*x', label: 'C=1200+15n' }] }, note: 'The lines $R=40n$ and $C=1200+15n$ meet at $n=48$, where both equal $\\$1920$. To the right of that point revenue is above cost.' }
    ],
    check: [
      { question: 'Costs are $C=500+8n$ and revenue is $R=18n$. Find the break-even $n$.', answer: '$n=50$', verify: { kind: 'roots', f: '18*x-(500+8*x)', answers: ['50'] } },
      { question: 'A deposit grows by $2\\%$ a year, $V=5000\\times1.02^t$. Find $V$ after $2$ years in dollars.', answer: '$\\$5202.00$', verify: { kind: 'value', expr: '5000*1.02^2', answer: '5202' } }
    ]
  },

  'mst-12-s2-02': {
    summary: 'Compound interest adds interest to the balance each period, so interest earns interest. A loan on a reducing balance works the same way in reverse: interest is charged on what is still owed, then the repayment comes off.',
    prereqs: [],
    concepts: [
      { title: 'Simple and compound interest', body: 'Simple interest is paid only on the original amount: $I=Prn$. Compound interest is paid on the growing balance, so the balance is multiplied by $1+r$ every period.' },
      { title: 'Match the rate to the period', body: 'Divide the annual rate by the number of periods per year and multiply the years by the same number. $6\\%$ per year compounded monthly for $3$ years is $r=0.005$ and $n=36$.' },
      { title: 'Reducing-balance loans', body: 'Each period: interest is the rate times the opening balance, then add interest and subtract the repayment to get the closing balance. Early repayments mostly pay interest, so the balance falls slowly at first.' },
      { title: 'Present value', body: 'The amount you must invest now to reach a target is found by dividing by the growth factor: $PV=\\dfrac{FV}{(1+r)^n}$.' }
    ],
    definitions: [
      { term: 'Principal', meaning: 'The amount first invested or borrowed.' },
      { term: 'Compounding period', meaning: 'How often interest is added to the balance, for example monthly or quarterly.' },
      { term: 'Reducing-balance loan', meaning: 'A loan where interest is charged each period on the amount still owing, which falls as repayments are made.' }
    ],
    formulas: [
      { label: 'Simple interest', tex: 'I=Prn', note: '$r$ is the rate per period as a decimal and $n$ the number of periods.' },
      { label: 'Compound interest', tex: 'FV=PV\\,(1+r)^{n}', note: '$r$ is the rate per compounding period as a decimal; $n$ is the total number of periods.' },
      { label: 'Present value', tex: 'PV=\\dfrac{FV}{(1+r)^{n}}' }
    ],
    points: [
      { front: 'What are $r$ and $n$ for $6\\%$ p.a. compounded monthly for $3$ years?', back: '$r=\\dfrac{0.06}{12}=0.005$ and $n=3\\times12=36$.' },
      { front: 'How is interest found on a reducing-balance loan?', back: 'Rate per period times the balance at the start of that period.' },
      { front: 'Compound interest earned is what?', back: '$FV-PV$, the final amount minus the principal.' },
      { front: 'Why does compound interest beat simple interest?', back: 'Interest is added to the balance, so later interest is earned on interest as well.' },
      { front: 'How do you find the present value?', back: 'Divide the future value by $(1+r)^n$.' }
    ],
    mistakes: [
      { wrong: 'Using $r=0.06$ and $n=36$ for monthly compounding.', right: 'The rate and the periods must match: $r=0.005$ with $n=36$.' },
      { wrong: 'Giving the final balance as the interest earned.', right: 'Interest earned is $FV-PV$: $9573.44-8000=1573.44$.' },
      { wrong: 'Subtracting the repayment before adding the interest.', right: 'Interest is charged on the opening balance, then add it and subtract the repayment.' }
    ],
    examples: [
      {
        question: 'Find the value of $\\$8000$ invested at $6\\%$ p.a. compounded monthly for $3$ years, and the interest earned.',
        steps: ['Monthly rate: $r=0.06\\div12=0.005$.', 'Periods: $n=3\\times12=36$.', '$FV=8000\\times1.005^{36}=9573.44$.', 'Interest: $9573.44-8000=1573.44$.'],
        answer: '$\\$9573.44$, so the interest is $\\$1573.44$.',
        working: '\\begin{aligned}FV&=8000(1+0.005)^{36}\\\\&=8000\\times1.19668\\ldots\\\\&=9573.44\\\\I&=9573.44-8000=1573.44\\end{aligned}',
        verify: { kind: 'value', expr: '8000*1.005^36', answer: '9573.444198587318' }
      },
      {
        question: 'A $\\$20000$ loan at $6\\%$ p.a. is charged interest monthly and repaid at $\\$500$ a month. Find the balance after the first two repayments.',
        steps: ['Monthly rate $0.005$. Month 1 interest: $20000\\times0.005=100$.', 'Balance: $20000+100-500=19600$.', 'Month 2 interest: $19600\\times0.005=98$.', 'Balance: $19600+98-500=19198$.'],
        answer: '$\\$19198.00$',
        working: '\\begin{aligned}B_1&=20000+100-500=19600\\\\B_2&=19600+98-500=19198\\end{aligned}',
        verify: { kind: 'values', pairs: [['20000*0.005', '100'], ['19600*0.005', '98'], ['19600+98-500', '19198']] }
      },
      {
        question: 'How much must be invested now at $5\\%$ p.a. compounded yearly to have $\\$10000$ in $4$ years?',
        steps: ['The target is the future value: $FV=10000$, with $r=0.05$ and $n=4$.', '$PV=\\dfrac{10000}{1.05^{4}}$.', '$1.05^4=1.21550625$.', '$PV=8227.02$ to the nearest cent.'],
        answer: '$\\$8227.02$',
        working: '\\begin{aligned}PV&=\\dfrac{10000}{1.05^{4}}\\\\&=\\dfrac{10000}{1.21550625}\\\\&=8227.02\\end{aligned}',
        verify: { kind: 'value', expr: '10000/1.05^4', answer: '8227.024747918818' }
      }
    ],
    examiners: [
      'The rate per period and the number of periods are both written down and shown to match.',
      'The formula is stated, then substituted, before the calculator answer; money ends with two decimal places and the dollar sign.',
      'On a loan each row shows opening balance, interest, repayment and closing balance in that order.',
      'When asked for interest earned, the principal is subtracted from the final amount.'
    ],
    diagrams: [
      { title: '$\\$8000$ at $6\\%$ p.a. compounded monthly', spec: { kind: 'compound', principal: 8000, rate: 0.06, years: 3, perYear: 12 }, note: 'The solid curve ends at $\\$9573.44$ after $3$ years. The dashed line is simple interest, which ends lower at $\\$9440.00$.' },
      { title: 'Explore rate, time and compounding', spec: { kind: 'compoundExplorer', principal: 8000, initialRate: 6, initialYears: 3 } }
    ],
    check: [
      { question: 'Find the value of $\\$5000$ at $4\\%$ p.a. compounded yearly for $2$ years.', answer: '$\\$5408.00$', verify: { kind: 'value', expr: '5000*1.04^2', answer: '5408' } },
      { question: 'Find the simple interest on $\\$3000$ at $5\\%$ p.a. for $4$ years.', answer: '$\\$600.00$', verify: { kind: 'value', expr: '3000*0.05*4', answer: '600' } }
    ]
  },

  'mst-12-s2-03': {
    summary: 'An annuity is a series of equal payments made at regular intervals. Saving into one builds a future value; drawing from one, or repaying a loan with it, is worth a present value today. Both are found by treating each payment as its own compound-interest calculation and adding them.',
    prereqs: ['mst-12-s2-02'],
    concepts: [
      { title: 'Future value of an annuity', body: 'Each payment grows for the time it stays in the account. The last payment earns nothing, the one before earns one period, and so on. For $\\$1000$ paid at the end of each year for $3$ years at $4\\%$: $1000\\times1.04^2+1000\\times1.04+1000=3121.60$.' },
      { title: 'The annuity formula', body: 'Adding those growing payments is a geometric series, which gives a closed form. With payment $M$, rate $r$ per period and $n$ payments, the future value is $M\\times\\dfrac{(1+r)^n-1}{r}$.' },
      { title: 'Present value of an annuity', body: 'The present value is the single amount today that is worth the same as all the payments. It is $M\\times\\dfrac{1-(1+r)^{-n}}{r}$. It is the loan you could repay with those payments.' },
      { title: 'Match rate and period', body: 'Payments every quarter at $8\\%$ p.a. means $r=0.02$ and $n=4\\times$ years. Count the payments, then check $n$ against them.' }
    ],
    definitions: [
      { term: 'Annuity', meaning: 'A sequence of equal payments, made at equal time intervals, that earn or are charged compound interest.' },
      { term: 'Future value', meaning: 'The total of all the payments plus the interest they have earned, at the end of the term.' },
      { term: 'Present value', meaning: 'The amount that, invested today at the same rate, would grow to match the same cash flows; the loan the payments could repay.' }
    ],
    formulas: [
      { label: 'Future value of an annuity', tex: 'FV=M\\,\\dfrac{(1+r)^{n}-1}{r}', note: '$M$ is each payment, $r$ the rate per period as a decimal, $n$ the number of payments, paid at the end of each period.' },
      { label: 'Present value of an annuity', tex: 'PV=M\\,\\dfrac{1-(1+r)^{-n}}{r}' }
    ],
    points: [
      { front: 'What is $n$ for payments every quarter for $2$ years?', back: '$n=8$ payments, with $r$ the quarterly rate.' },
      { front: 'Which payment earns no interest in a future-value annuity?', back: 'The last one, paid at the end of the term.' },
      { front: 'FV or PV: how much will I have after saving for years?', back: 'Future value. Present value is for what the stream of payments is worth today.' },
      { front: 'Which is larger for the same annuity, $FV$ or $PV$?', back: '$FV$, because it is the same cash flows moved to a later date.' },
      { front: 'What is $r$ for $8\\%$ p.a. paid quarterly?', back: '$r=0.08\\div4=0.02$.' }
    ],
    mistakes: [
      { wrong: 'Using the annual rate with monthly payments.', right: 'Divide the rate by $12$ and count the monthly payments: $r=\\dfrac{0.06}{12}$.' },
      { wrong: 'Multiplying the payment by the number of payments, $1000\\times3=3000$, and calling it the future value.', right: 'That ignores interest. The $4\\%$ annuity is worth $\\$3121.60$.' },
      { wrong: 'Using the future-value formula for a loan question.', right: 'The loan that payments can repay is the present value.' }
    ],
    examples: [
      {
        question: 'Find the future value of $\\$1000$ paid at the end of each year for $3$ years into an account paying $4\\%$ p.a.',
        steps: ['Payment $1$ earns $2$ years: $1000\\times1.04^2=1081.60$.', 'Payment $2$ earns $1$ year: $1000\\times1.04=1040$.', 'Payment $3$ earns none: $1000$.', 'Add: $1081.60+1040+1000=3121.60$.'],
        answer: '$\\$3121.60$',
        working: '\\begin{aligned}FV&=1000\\times\\dfrac{1.04^{3}-1}{0.04}\\\\&=1000\\times3.1216\\\\&=3121.60\\end{aligned}',
        verify: { kind: 'value', expr: '1000*1.04^2+1000*1.04+1000', answer: '3121.6' }
      },
      {
        question: 'Find the present value of an annuity of $\\$2000$ a year for $5$ years at $5\\%$ p.a.',
        steps: ['$M=2000$, $r=0.05$, $n=5$.', '$PV=2000\\times\\dfrac{1-1.05^{-5}}{0.05}$.', '$1-1.05^{-5}=0.216474$ and $\\dfrac{0.216474}{0.05}\\approx4.329477$.', '$2000\\times4.329477\\approx8658.95$.'],
        answer: '$\\$8658.95$',
        working: '\\begin{aligned}PV&=2000\\times\\dfrac{1-1.05^{-5}}{0.05}\\\\&\\approx2000\\times4.329477\\\\&\\approx8658.95\\end{aligned}',
        verify: { kind: 'value', expr: '2000*(1-1.05^-5)/0.05', answer: '8658.953341261646' }
      },
      {
        question: 'Natalie saves $\\$500$ at the end of every quarter for $2$ years at $8\\%$ p.a. compounded quarterly. Find the future value.',
        steps: ['Quarterly rate: $r=0.08\\div4=0.02$.', 'Number of payments: $n=2\\times4=8$.', '$FV=500\\times\\dfrac{1.02^{8}-1}{0.02}$.', '$\\dfrac{1.02^8-1}{0.02}\\approx8.582969$, so $FV\\approx4291.48$.'],
        answer: '$\\$4291.48$',
        working: '\\begin{aligned}FV&=500\\times\\dfrac{1.02^{8}-1}{0.02}\\\\&\\approx500\\times8.582969\\\\&\\approx4291.48\\end{aligned}',
        verify: { kind: 'value', expr: '500*(1.02^8-1)/0.02', answer: '4291.484525056643' }
      }
    ],
    examiners: [
      'The values of $M$, $r$ and $n$ are listed before the formula is used, and $n$ counts the payments.',
      'The growth-factor term is evaluated on its own line so a rounding slip can be part-marked.',
      'A timeline or table of payments is used to explain why the last payment earns nothing.',
      'The final answer says whether it is a future value or a present value, with dollars and cents.'
    ],
    diagrams: [
      { title: 'Three yearly payments of $\\$1000$', spec: { kind: 'timeline', length: 3, events: [{ t: 1, amount: 1000 }, { t: 2, amount: 1000 }, { t: 3, amount: 1000 }] }, note: 'The payment at year $1$ earns interest for $2$ years, the payment at year $2$ for $1$ year, and the payment at year $3$ for none. At $4\\%$ p.a. they total $\\$3121.60$.' }
    ],
    check: [
      { question: 'Find the future value of $\\$100$ paid at the end of each year for $3$ years at $5\\%$ p.a.', answer: '$\\$315.25$', verify: { kind: 'value', expr: '100*(1.05^3-1)/0.05', answer: '315.25' } },
      { question: 'Find the present value of $\\$1000$ a year for $2$ years at $10\\%$ p.a.', answer: '$\\$1735.54$', verify: { kind: 'value', expr: '1000*(1-1.1^-2)/0.1', answer: '1735.5371900826453' } }
    ]
  },

  'mst-12-s2-04': {
    summary: 'Triangles without a right angle are solved with the sine rule, the cosine rule and the area formula. The skill is choosing the right rule from what is given: a side opposite a known angle, or two sides with the angle between them.',
    prereqs: [],
    concepts: [
      { title: 'Label first', body: 'Name each side by the angle opposite it: side $a$ is opposite angle $A$, $b$ opposite $B$, $c$ opposite $C$. Then pick the rule.' },
      { title: 'The sine rule', body: 'Use it when you know a side and its opposite angle, plus one more angle or side. Put the unknown on top: $\\dfrac{b}{\\sin B}=\\dfrac{a}{\\sin A}$, so $b=\\dfrac{a\\sin B}{\\sin A}$.' },
      { title: 'The cosine rule', body: 'Use it for two sides and the angle between them (to find the third side), or for all three sides (to find an angle). It is Pythagoras with a correction term: $c^2=a^2+b^2-2ab\\cos C$.' },
      { title: 'Area and bearings', body: 'With two sides and the angle between them, the area is $\\tfrac{1}{2}ab\\sin C$. Bearings are measured clockwise from north in three digits; draw a north line at each point, then use alternate and co-interior angles to fill in the triangle.' }
    ],
    definitions: [
      { term: 'Included angle', meaning: 'The angle between two given sides. The cosine rule and the area formula both need it.' },
      { term: 'Bearing', meaning: 'A direction measured clockwise from north, written with three digits, for example $065^\\circ$.' }
    ],
    formulas: [
      { label: 'Sine rule', tex: '\\dfrac{a}{\\sin A}=\\dfrac{b}{\\sin B}=\\dfrac{c}{\\sin C}' },
      { label: 'Cosine rule', tex: 'c^{2}=a^{2}+b^{2}-2ab\\cos C' },
      { label: 'Cosine rule for an angle', tex: '\\cos C=\\dfrac{a^{2}+b^{2}-c^{2}}{2ab}' },
      { label: 'Area of a triangle', tex: 'A=\\tfrac{1}{2}ab\\sin C' }
    ],
    points: [
      { front: 'Which rule: a side, its opposite angle, and another angle?', back: 'The sine rule.' },
      { front: 'Which rule: two sides and the angle between them?', back: 'The cosine rule for the third side, and $\\tfrac{1}{2}ab\\sin C$ for the area.' },
      { front: 'What does the cosine rule become when $C=90^\\circ$?', back: 'Pythagoras: $c^2=a^2+b^2$, because $\\cos90^\\circ=0$.' },
      { front: 'Which rule: all three sides and you want an angle?', back: 'The cosine rule, rearranged for $\\cos C$.' },
      { front: 'Calculator check before any trigonometry?', back: 'Make sure it is in degree mode.' }
    ],
    mistakes: [
      { wrong: 'Working out $2ab\\cos C$ first as $(a^2+b^2-2ab)\\cos C$.', right: 'Evaluate $a^2+b^2$ and $2ab\\cos C$ separately, subtract, then take the square root.' },
      { wrong: 'Using the area formula with an angle that is not between the two sides.', right: 'The angle must be the included angle between the two sides used.' },
      { wrong: 'Leaving the answer as $c^2=71.9$.', right: 'Take the square root to give the side: $c=8.48$ cm.' }
    ],
    examples: [
      {
        question: 'In triangle $ABC$, $a=10$ cm, $A=40^\\circ$ and $B=60^\\circ$. Find $b$ to $2$ decimal places.',
        steps: ['Side $a$ is opposite $A$, and $b$ is opposite $B$, so the sine rule applies.', '$\\dfrac{b}{\\sin60^\\circ}=\\dfrac{10}{\\sin40^\\circ}$.', '$b=\\dfrac{10\\sin60^\\circ}{\\sin40^\\circ}$.', '$b=13.47$ cm.'],
        answer: '$b=13.47$ cm',
        working: '\\begin{aligned}\\dfrac{b}{\\sin60^\\circ}&=\\dfrac{10}{\\sin40^\\circ}\\\\b&=\\dfrac{10\\sin60^\\circ}{\\sin40^\\circ}\\\\&=13.47\\end{aligned}',
        verify: { kind: 'value', expr: '10*sin(60*pi/180)/sin(40*pi/180)', answer: '13.472963553338607' }
      },
      {
        question: 'In triangle $ABC$, $a=8$ cm, $b=11$ cm and the angle between them is $C=50^\\circ$. Find $c$ to $2$ decimal places.',
        steps: ['Two sides and the included angle: use the cosine rule.', '$c^2=8^2+11^2-2(8)(11)\\cos50^\\circ$.', '$c^2=185-176\\cos50^\\circ=71.87$.', '$c=\\sqrt{71.87}=8.48$ cm.'],
        answer: '$c=8.48$ cm',
        working: '\\begin{aligned}c^{2}&=8^{2}+11^{2}-2(8)(11)\\cos50^\\circ\\\\&=185-176\\cos50^\\circ\\\\&=71.87\\\\c&=8.48\\end{aligned}',
        verify: { kind: 'value', expr: 'sqrt(8^2+11^2-2*8*11*cos(50*pi/180))', answer: '8.477581063910216' }
      },
      {
        question: 'Find the area of the same triangle, with sides $8$ cm and $11$ cm enclosing $50^\\circ$.',
        steps: ['Use $A=\\tfrac{1}{2}ab\\sin C$.', '$A=\\tfrac{1}{2}(8)(11)\\sin50^\\circ$.', '$A=44\\sin50^\\circ=33.71$.'],
        answer: '$33.71$ cm$^2$',
        working: '\\begin{aligned}A&=\\tfrac{1}{2}(8)(11)\\sin50^\\circ\\\\&=44\\sin50^\\circ\\\\&=33.71\\end{aligned}',
        verify: { kind: 'value', expr: '0.5*8*11*sin(50*pi/180)', answer: '33.70595549723503' }
      }
    ],
    examiners: [
      'The triangle is sketched and labelled, with each side matched to its opposite angle, before a rule is chosen.',
      'The rule is written in its general form, then substituted, so the method mark is secured even if the arithmetic slips.',
      'In the cosine rule the product $2ab\\cos C$ is calculated before it is subtracted, and the square root is taken at the end.',
      'The answer carries units (cm, m, cm$^2$) and the stated rounding; bearings are given with three digits.'
    ],
    diagrams: [
      { title: 'Two sides and the angle between them', spec: { kind: 'triangle', a: 8, b: 11, C: 50 }, note: 'With $a=8$, $b=11$ and $C=50^\\circ$ the cosine rule gives $c=8.48$ and the area is $33.71$ cm$^2$.' }
    ],
    check: [
      { question: 'Find the area of a triangle with sides $6$ cm and $9$ cm enclosing an angle of $30^\\circ$.', answer: '$13.5$ cm$^2$', verify: { kind: 'value', expr: '0.5*6*9*sin(30*pi/180)', answer: '13.5' } },
      { question: 'Use the cosine rule to find $c$ when $a=5$, $b=12$ and $C=90^\\circ$.', answer: '$c=13$', verify: { kind: 'value', expr: 'sqrt(5^2+12^2-2*5*12*cos(90*pi/180))', answer: '13' } }
    ]
  },

  'mst-12-s2-05': {
    summary: 'A ratio compares quantities of the same kind; a rate compares quantities of different kinds, such as kilometres to hours. Sharing in a ratio, reading a scale and converting between units are all multiplication or division by the right factor.',
    prereqs: [],
    concepts: [
      { title: 'Sharing in a ratio', body: 'Add the parts to get the total number of shares, divide the amount by it, then multiply by each part. To share $\\$2400$ in the ratio $3:5$: there are $8$ shares, each is $\\$300$, so the parts are $\\$900$ and $\\$1500$.' },
      { title: 'Scales', body: 'A scale of $1:50000$ means $1$ unit on the map is $50000$ of the same unit in real life. Multiply by $50000$, then convert: $100000$ cm is $1$ km.' },
      { title: 'Rates and units', body: 'A rate has two units, such as km/h, litres per $100$ km or dollars per kg. To convert km/h to m/s multiply by $1000$ and divide by $3600$.' },
      { title: 'Unit rates and comparison', body: 'To compare values, bring them to the same unit rate. The better buy is the one with the lower price per kilogram or per litre.' }
    ],
    definitions: [
      { term: 'Ratio', meaning: 'A comparison of quantities in the same units, written $a:b$.' },
      { term: 'Rate', meaning: 'A comparison of two quantities in different units, such as $80$ km/h.' },
      { term: 'Scale', meaning: 'The ratio of a length on a drawing or map to the real length.' }
    ],
    formulas: [
      { label: 'Share of a ratio', tex: '\\text{share}=\\dfrac{\\text{part}}{\\text{sum of parts}}\\times\\text{amount}' },
      { label: 'Speed', tex: 'v=\\dfrac{d}{t}', note: 'Distance over time; keep the units consistent, for example km and h.' },
      { label: 'km/h to m/s', tex: 'v_{\\text{m/s}}=\\dfrac{v_{\\text{km/h}}\\times1000}{3600}' }
    ],
    points: [
      { front: 'How many shares in the ratio $3:5$?', back: '$3+5=8$ shares.' },
      { front: 'Convert $90$ km/h to m/s.', back: '$90\\times1000\\div3600=25$ m/s.' },
      { front: 'A map scale is $1:50000$. What is $4$ cm on the map?', back: '$4\\times50000=200000$ cm, which is $2$ km.' },
      { front: 'How many cm are in $1$ km?', back: '$100000$ cm.' },
      { front: 'Fuel use of $7.5$ L per $100$ km: litres for $640$ km?', back: '$6.4\\times7.5=48$ L.' }
    ],
    mistakes: [
      { wrong: 'Dividing $\\$2400$ by $3$ and by $5$ to share it.', right: 'Divide by the total number of shares, $8$, then multiply by each part.' },
      { wrong: 'Converting $90$ km/h to m/s by multiplying by $3.6$.', right: 'Divide by $3.6$ to go from km/h to m/s: $90\\div3.6=25$.' },
      { wrong: 'Answering a scale question in centimetres.', right: 'Convert to the unit asked for, here kilometres.' }
    ],
    examples: [
      {
        question: 'Aisha and Ben share a $\\$2400$ prize in the ratio $3:5$. How much does Ben get?',
        steps: ['The total number of shares is $3+5=8$.', 'One share is $2400\\div8=300$.', 'Ben has $5$ shares: $5\\times300=1500$.', 'Check: $900+1500=2400$.'],
        answer: '$\\$1500.00$',
        working: '\\begin{aligned}\\text{Ben}&=\\dfrac{5}{8}\\times2400\\\\&=5\\times300\\\\&=1500\\end{aligned}',
        verify: { kind: 'value', expr: '5/8*2400', answer: '1500' }
      },
      {
        question: 'On a map with scale $1:50000$, two towns are $4$ cm apart. How far apart are they in kilometres?',
        steps: ['Real distance in cm: $4\\times50000=200000$.', 'Divide by $100000$ to convert to km.', '$200000\\div100000=2$.'],
        answer: '$2$ km',
        working: '\\begin{aligned}4\\times50000&=200000\\ \\text{cm}\\\\200000\\div100000&=2\\ \\text{km}\\end{aligned}',
        verify: { kind: 'value', expr: '4*50000/100000', answer: '2' }
      },
      {
        question: 'A car uses $7.5$ L per $100$ km. Petrol is $\\$1.95$ per litre. Find the fuel cost of a $640$ km trip.',
        steps: ['Litres needed: $640\\div100\\times7.5=48$.', 'Cost: $48\\times1.95=93.60$.'],
        answer: '$\\$93.60$',
        working: '\\begin{aligned}\\text{Litres}&=\\dfrac{640}{100}\\times7.5=48\\\\\\text{Cost}&=48\\times1.95=93.60\\end{aligned}',
        verify: { kind: 'value', expr: '640/100*7.5*1.95', answer: '93.6' }
      }
    ],
    examiners: [
      'The number of shares is added up first and written on the page; the answer is checked by adding the parts back to the total.',
      'Units are carried on every line, and converted once, at the point the question needs them.',
      'A rate is set up with the units visible, for example $\\text{L}/100\\text{ km}$, so a wrong-way division is easy to see.',
      'Money is given to two decimal places with the dollar sign.'
    ],
    diagrams: [
      { title: 'Splitting $\\$2400$ in the ratio $3:5$', spec: { kind: 'numberLine', min: 0, max: 2400, points: [{ value: 900, label: '900' }, { value: 2400, label: '2400' }] }, note: 'The point at $900$ splits the amount into $\\$900$ (three shares) and $\\$1500$ (five shares).' }
    ],
    check: [
      { question: 'Convert $72$ km/h to m/s.', answer: '$20$ m/s', verify: { kind: 'value', expr: '72*1000/3600', answer: '20' } },
      { question: 'Share $\\$150$ in the ratio $2:3$. How much is the larger share?', answer: '$\\$90.00$', verify: { kind: 'value', expr: '150*3/5', answer: '90' } }
    ]
  },

  'mst-12-s2-06': {
    summary: 'A flow network is a directed graph whose edges have capacities, the most that can pass along them. The maximum flow from the source to the sink equals the capacity of the minimum cut, which is the smallest total capacity that separates the two.',
    prereqs: [],
    concepts: [
      { title: 'Source, sink and capacity', body: 'Flow enters at the source $S$ and leaves at the sink $T$. Each edge has a capacity, and the flow on it can be anything from $0$ up to that capacity, in the direction of the arrow.' },
      { title: 'Conservation at a junction', body: 'At every vertex other than $S$ and $T$, the flow in equals the flow out. If $9$ units arrive at $A$ and $7$ leave towards $T$, the other $2$ must leave along another edge.' },
      { title: 'Cuts', body: 'A cut splits the vertices into a group with $S$ and a group with $T$. Its capacity is the sum of the capacities of the edges that go from the $S$ side to the $T$ side. Edges going back the other way are not counted.' },
      { title: 'Maximum flow equals minimum cut', body: 'Every cut is an upper bound on the flow. The smallest cut is the bottleneck, and the maximum flow equals it. Find it by listing every cut, or by finding a flow that fills a cut.' }
    ],
    definitions: [
      { term: 'Capacity', meaning: 'The greatest flow an edge can carry in its direction.' },
      { term: 'Cut', meaning: 'A line dividing the vertices into an $S$ side and a $T$ side. Its capacity is the total capacity of the edges directed across it from $S$ to $T$.' },
      { term: 'Minimum cut', meaning: 'The cut with the smallest capacity. It equals the maximum flow.' }
    ],
    formulas: [
      { label: 'Maximum-flow minimum-cut', tex: '\\max\\text{ flow}=\\min\\text{ cut capacity}' },
      { label: 'Conservation at a vertex', tex: '\\sum\\text{flow in}=\\sum\\text{flow out}' }
    ],
    points: [
      { front: 'What does the maximum flow equal?', back: 'The capacity of the minimum cut.' },
      { front: 'Is a backward edge counted in the capacity of a cut?', back: 'No. Only edges directed from the $S$ side to the $T$ side count.' },
      { front: 'Flow in is $12$ at a vertex; flows out are $5$ and $4$ and $x$. Find $x$.', back: '$x=12-5-4=3$.' },
      { front: 'What does $7/10$ on an edge mean?', back: 'The flow is $7$ and the capacity is $10$.' },
      { front: 'When is a flow maximal?', back: 'When its value equals the capacity of some cut, so no more can be added.' }
    ],
    mistakes: [
      { wrong: 'Taking the maximum flow as the capacity of the first cut found.', right: 'List every cut and take the smallest; a larger cut is only an upper bound.' },
      { wrong: 'Adding capacities of edges that cross the cut from the $T$ side back to the $S$ side.', right: 'Count only the edges that cross from the $S$ side to the $T$ side.' },
      { wrong: 'Letting a flow exceed an edge capacity because the junction has more flow coming in.', right: 'The flow on an edge never exceeds its capacity; the surplus has to go along another edge or the inflow is reduced.' }
    ],
    examples: [
      {
        question: 'A network has edges $S\\to A$ (capacity $10$), $S\\to B$ ($6$), $A\\to B$ ($3$), $A\\to T$ ($7$) and $B\\to T$ ($8$). Find the maximum flow.',
        steps: ['Cut $\\{S\\}$ separates $S$ from the rest: $10+6=16$.', 'Cut $\\{S,A\\}$: edges $S\\to B$, $A\\to B$, $A\\to T$ give $6+3+7=16$.', 'Cut $\\{S,B\\}$: edges $S\\to A$ and $B\\to T$ give $10+8=18$.', 'Cut $\\{S,A,B\\}$: edges into $T$ give $7+8=15$.', 'The minimum cut is $15$, so the maximum flow is $15$.'],
        answer: 'Maximum flow $=15$',
        working: '\\begin{aligned}\\{S\\}&:\\ 10+6=16\\\\\\{S,A\\}&:\\ 6+3+7=16\\\\\\{S,B\\}&:\\ 10+8=18\\\\\\{S,A,B\\}&:\\ 7+8=15\\end{aligned}',
        verify: { kind: 'values', pairs: [['10+6', '16'], ['6+3+7', '16'], ['10+8', '18'], ['7+8', '15']] }
      },
      {
        question: 'In the same network, $S\\to B$ carries its full $6$ units, $9$ units arrive at $A$ and $7$ leave along $A\\to T$. How much flows along $A\\to B$, and what is the flow into $T$ if $B\\to T$ is full?',
        steps: ['Flow in equals flow out at $A$: $9=7+x$, so $x=2$.', 'The inflow at $B$ is $6+2=8$, which equals the capacity of $B\\to T$.', 'Flow into $T$: $7+8=15$, matching the minimum cut.'],
        answer: '$2$ units along $A\\to B$; the flow into $T$ is $15$.',
        working: '\\begin{aligned}9&=7+x\\\\x&=2\\\\\\text{into }T&=7+8=15\\end{aligned}',
        verify: { kind: 'values', pairs: [['9-7', '2'], ['7+8', '15']] }
      }
    ],
    examiners: [
      'Cuts are listed systematically, each with the edges that cross it written out and their capacities added.',
      'Only edges directed from the source side to the sink side are counted, and this is stated.',
      'The answer says which cut is the minimum and that the maximum flow equals it.',
      'A flow diagram is checked by conservation at every junction, with the in and out totals shown.'
    ],
    diagrams: [
      { title: 'A flow of $15$ from $S$ to $T$', spec: { kind: 'network', directed: true, nodes: [{ id: 'S', x: 0, y: 1 }, { id: 'A', x: 2, y: 2 }, { id: 'B', x: 2, y: 0 }, { id: 'T', x: 4, y: 1 }], edges: [{ from: 'S', to: 'A', weight: 10, label: '9/10' }, { from: 'S', to: 'B', weight: 6, label: '6/6' }, { from: 'A', to: 'B', weight: 3, label: '2/3' }, { from: 'A', to: 'T', weight: 7, label: '7/7' }, { from: 'B', to: 'T', weight: 8, label: '8/8' }] }, note: 'Each label is flow/capacity. At $A$: $9$ in, $7+2$ out. At $B$: $6+2$ in, $8$ out. The edges into $T$ are full, which is the minimum cut of $7+8=15$.' }
    ],
    check: [
      { question: 'At a junction $12$ units flow in. Two edges carry $5$ and $4$ out. What flows out along the third edge?', answer: '$3$', verify: { kind: 'value', expr: '12-5-4', answer: '3' } },
      { question: 'A cut crosses edges of capacity $8$, $5$ and $6$ from the source side to the sink side. Find its capacity.', answer: '$19$', verify: { kind: 'value', expr: '8+5+6', answer: '19' } }
    ]
  },

  'mst-12-s2-07': {
    summary: 'A project is a set of activities with durations and an order they must follow. A critical path analysis finds the shortest time the whole project can take, the activities that cannot be delayed, and the float on the rest.',
    prereqs: ['mst-12-s2-06'],
    concepts: [
      { title: 'The activity network', body: 'Each activity is an edge from the event where it starts to the event where it ends, labelled with its duration. An activity cannot start until every activity leading into its start has finished.' },
      { title: 'Earliest start times', body: 'Work forward from the start. The earliest time at an event is the largest total along any route into it, because everything must be done first. In the example below the earliest finish is $11$ days.' },
      { title: 'The critical path', body: 'The critical path is the longest route from start to finish. Its length is the minimum completion time, and a delay to any critical activity delays the whole project.' },
      { title: 'Latest times and float', body: 'Work backward from the finish to get the latest time at each event. The float of an activity is the latest finish minus the earliest start minus its duration: how long it can be delayed without delaying the project. Critical activities have zero float.' }
    ],
    definitions: [
      { term: 'Critical path', meaning: 'The longest path through the network. Its total duration is the shortest possible time for the project.' },
      { term: 'Float', meaning: 'The time an activity can be delayed without delaying the project: latest finish minus earliest start minus duration.' },
      { term: 'Earliest start time', meaning: 'The soonest an activity can begin, given that all activities before it must be completed.' }
    ],
    formulas: [
      { label: 'Float of an activity', tex: '\\text{float}=\\text{LFT}-\\text{EST}-\\text{duration}', note: 'LFT is the latest finish time, EST the earliest start time.' },
      { label: 'Minimum completion time', tex: 'T=\\text{length of the longest path}' }
    ],
    points: [
      { front: 'What is the critical path?', back: 'The longest path through the activity network.' },
      { front: 'Float of a critical activity?', back: 'Zero.' },
      { front: 'Forward pass takes the largest or smallest value at a merging event?', back: 'The largest, because every incoming activity must be finished.' },
      { front: 'Backward pass takes the largest or smallest value at a splitting event?', back: 'The smallest, because every outgoing activity must still be able to start.' },
      { front: 'What does shortening a non-critical activity do to the project time?', back: 'Nothing. Only shortening a critical activity can reduce the minimum time.' }
    ],
    mistakes: [
      { wrong: 'Choosing the shortest route as the critical path.', right: 'The critical path is the longest route, because the slowest chain of tasks controls the finish.' },
      { wrong: 'Using the smaller value at a merging event on the forward pass.', right: 'Take the larger: an activity cannot start until all of the activities before it are finished.' },
      { wrong: 'Assuming that reducing any activity shortens the project.', right: 'Only the critical activities matter; once a second path becomes as long, both are critical.' }
    ],
    examples: [
      {
        question: 'A project has activities $A$ ($3$ days), $B$ ($4$), $C$ ($5$), $D$ ($2$) and $E$ ($3$). $C$ follows $A$, $D$ follows $B$, and $E$ follows both $C$ and $D$. Find the critical path and the minimum time.',
        steps: ['Path $A,C,E$: $3+5+3=11$.', 'Path $B,D,E$: $4+2+3=9$.', 'The longest is $A,C,E$.', 'The minimum completion time is $11$ days.'],
        answer: 'Critical path $A,C,E$; minimum time $11$ days.',
        working: '\\begin{aligned}A,C,E&:\\ 3+5+3=11\\\\B,D,E&:\\ 4+2+3=9\\end{aligned}',
        verify: { kind: 'values', pairs: [['3+5+3', '11'], ['4+2+3', '9']] }
      },
      {
        question: 'Using the same project, find the float of activity $D$.',
        steps: ['$D$ starts when $B$ finishes: earliest start $4$.', '$E$ must start by day $8$ (after $A$ and $C$), so the latest finish of $D$ is $8$.', 'Float $=8-4-2=2$ days.'],
        answer: '$2$ days',
        working: '\\begin{aligned}\\text{float}&=\\text{LFT}-\\text{EST}-\\text{duration}\\\\&=8-4-2\\\\&=2\\end{aligned}',
        verify: { kind: 'value', expr: '8-4-2', answer: '2' }
      },
      {
        question: 'Activity $C$ is shortened from $5$ days to $3$ days. What is the new minimum time?',
        steps: ['Path $A,C,E$ becomes $3+3+3=9$.', 'Path $B,D,E$ is still $4+2+3=9$.', 'Both paths are now $9$, so both are critical.', 'The minimum time drops from $11$ days to $9$ days, and not lower, because $B,D,E$ now controls it.'],
        answer: '$9$ days',
        working: '\\begin{aligned}A,C,E&:\\ 3+3+3=9\\\\B,D,E&:\\ 4+2+3=9\\end{aligned}',
        verify: { kind: 'values', pairs: [['3+3+3', '9'], ['4+2+3', '9']] }
      }
    ],
    examiners: [
      'Every path from start to finish is listed and its duration added, so the critical path is justified.',
      'The forward pass takes the larger value at a merge; the backward pass takes the smaller at a split; both are shown on the diagram.',
      'Float is found with the formula, with EST, LFT and duration each written out.',
      'When a duration is changed, the critical path is re-checked, since a second path can become critical.'
    ],
    diagrams: [
      { title: 'The critical path $A,C,E$', spec: { kind: 'network', directed: true, nodes: [{ id: '1', x: 0, y: 1 }, { id: '2', x: 2, y: 2 }, { id: '3', x: 2, y: 0 }, { id: '4', x: 4, y: 1 }, { id: '5', x: 6, y: 1 }], edges: [{ from: '1', to: '2', weight: 3, label: 'A\\,(3)' }, { from: '1', to: '3', weight: 4, label: 'B\\,(4)' }, { from: '2', to: '4', weight: 5, label: 'C\\,(5)' }, { from: '3', to: '4', weight: 2, label: 'D\\,(2)' }, { from: '4', to: '5', weight: 3, label: 'E\\,(3)' }], path: ['1', '2', '4', '5'] }, note: 'The highlighted route $A,C,E$ takes $3+5+3=11$ days. The route $B,D,E$ takes $9$ days, so $B$ and $D$ each have $2$ days of float.' }
    ],
    check: [
      { question: 'Two paths take $4+6+2$ days and $5+3+3$ days. What is the minimum completion time?', answer: '$12$ days', verify: { kind: 'values', pairs: [['4+6+2', '12'], ['5+3+3', '11']] } },
      { question: 'An activity has earliest start $5$, latest finish $11$ and duration $4$. Find its float.', answer: '$2$ days', verify: { kind: 'value', expr: '11-5-4', answer: '2' } }
    ]
  },

  'mst-12-s2-08': {
    summary: 'Bivariate data pairs two measurements for each individual. A scatterplot shows whether they are related, correlation measures how closely, and a line of best fit turns the relationship into a prediction.',
    prereqs: [],
    concepts: [
      { title: 'Reading a scatterplot', body: 'Describe the direction (positive: both rise together; negative: one rises as the other falls), the strength (how tightly the points follow a line) and the form (linear or curved). Put the explanatory variable on the horizontal axis.' },
      { title: 'Correlation coefficient', body: 'The coefficient $r$ lies between $-1$ and $1$. Its sign gives the direction and its size the strength: near $\\pm1$ is strong, near $0$ is weak or none. It measures only straight-line association.' },
      { title: 'Line of best fit', body: 'The least-squares line is $y=mx+c$ with $m=\\dfrac{S_{xy}}{S_{xx}}$ and $c=\\bar y-m\\bar x$. It passes through the mean point $(\\bar x,\\bar y)$. Here $S_{xx}=\\sum(x-\\bar x)^2$ and $S_{xy}=\\sum(x-\\bar x)(y-\\bar y)$.' },
      { title: 'Predicting', body: 'Interpolation uses a value inside the data range and is reasonably reliable. Extrapolation goes outside it, and the pattern may not continue, so it is much less reliable. Correlation does not show that one variable causes the other.' }
    ],
    definitions: [
      { term: 'Explanatory variable', meaning: 'The variable used to predict or explain; plotted on the horizontal axis. The other is the response variable.' },
      { term: 'Interpolation', meaning: 'Predicting a value within the range of the data, between measured values.' },
      { term: 'Extrapolation', meaning: 'Predicting a value outside the range of the data; less reliable.' }
    ],
    formulas: [
      { label: 'Gradient of the least-squares line', tex: 'm=\\dfrac{S_{xy}}{S_{xx}}' },
      { label: 'Intercept', tex: 'c=\\bar y-m\\,\\bar x', note: 'The line goes through $(\\bar x,\\bar y)$.' },
      { label: 'Correlation coefficient', tex: 'r=\\dfrac{S_{xy}}{\\sqrt{S_{xx}\\,S_{yy}}}' }
    ],
    points: [
      { front: 'What range can $r$ take?', back: 'From $-1$ to $1$.' },
      { front: 'Does a strong correlation prove causation?', back: 'No. Another factor may drive both, or the link may be a coincidence.' },
      { front: 'Interpolation or extrapolation: predicting beyond the data?', back: 'Extrapolation, which is less reliable.' },
      { front: 'What point does the least-squares line always pass through?', back: 'The mean point $(\\bar x,\\bar y)$.' },
      { front: 'What does the gradient of a line of best fit mean?', back: 'The predicted change in $y$ for each increase of $1$ in $x$, in the units of the data.' }
    ],
    mistakes: [
      { wrong: 'Saying $r=0.2$ is a strong correlation.', right: 'A value near $0$ is weak. Strong means close to $1$ or $-1$.' },
      { wrong: 'Stating that studying more hours causes higher marks, from $r$ alone.', right: 'Say the variables are associated; causation needs more than a correlation.' },
      { wrong: 'Interpreting the gradient without units.', right: 'Say what it is in context: about $4.9$ extra marks for each extra hour of study.' }
    ],
    examples: [
      {
        question: 'Five students record hours of study $x$ and test mark $y$: $(1,52)$, $(2,57)$, $(3,63)$, $(4,66)$, $(5,72)$. For these data $\\bar x=3$, $\\bar y=62$, $S_{xx}=10$ and $S_{xy}=49$. Find the line of best fit.',
        steps: ['Gradient: $m=\\dfrac{S_{xy}}{S_{xx}}=\\dfrac{49}{10}=4.9$.', 'Intercept: $c=\\bar y-m\\bar x=62-4.9\\times3=47.3$.', 'The line is $y=4.9x+47.3$.'],
        answer: '$y=4.9x+47.3$',
        working: '\\begin{aligned}m&=\\dfrac{49}{10}=4.9\\\\c&=62-4.9(3)=47.3\\\\y&=4.9x+47.3\\end{aligned}',
        verify: { kind: 'values', pairs: [['49/10', '4.9'], ['62-4.9*3', '47.3']] }
      },
      {
        question: 'Use $y=4.9x+47.3$ to predict the mark for $3.5$ hours and for $8$ hours. Which prediction is more reliable?',
        steps: ['At $x=3.5$: $y=4.9(3.5)+47.3=64.45$.', 'At $x=8$: $y=4.9(8)+47.3=86.5$.', '$3.5$ lies inside the data range $1$ to $5$, so it is interpolation.', '$8$ lies outside it, so it is extrapolation and less reliable.'],
        answer: '$64.45$ marks (reliable) and $86.5$ marks (less reliable).',
        working: '\\begin{aligned}y(3.5)&=4.9(3.5)+47.3=64.45\\\\y(8)&=4.9(8)+47.3=86.5\\end{aligned}',
        verify: { kind: 'values', pairs: [['4.9*3.5+47.3', '64.45'], ['4.9*8+47.3', '86.5']] }
      },
      {
        question: 'With $S_{xx}=10$, $S_{yy}=242$ and $S_{xy}=49$, find $r$ and describe the correlation.',
        steps: ['$r=\\dfrac{S_{xy}}{\\sqrt{S_{xx}S_{yy}}}=\\dfrac{49}{\\sqrt{10\\times242}}$.', '$\\sqrt{2420}=49.19$, so $r=0.996$.', 'This is a very strong positive linear correlation.'],
        answer: '$r=0.996$: strong positive correlation.',
        working: '\\begin{aligned}r&=\\dfrac{49}{\\sqrt{10\\times242}}\\\\&=\\dfrac{49}{49.19}\\\\&=0.996\\end{aligned}',
        verify: { kind: 'value', expr: '49/sqrt(10*242)', answer: '0.9960666445226335' }
      }
    ],
    examiners: [
      'A description of association names the direction, strength and form, in the context of the variables.',
      'The gradient is found from the formula with the sums shown, and the intercept from the mean point.',
      'Each prediction is labelled interpolation or extrapolation with a comment on reliability.',
      'Correlation is never claimed to prove cause; the answer says "associated with".'
    ],
    diagrams: [
      { title: 'Study hours and test mark', spec: { kind: 'scatter', points: [[1, 52], [2, 57], [3, 63], [4, 66], [5, 72]], line: { m: 4.9, c: 47.3 }, xLabel: 'Hours of study', yLabel: 'Test mark' }, note: 'The line $y=4.9x+47.3$ passes through the mean point $(3,62)$. Each extra hour is associated with about $4.9$ more marks.' }
    ],
    check: [
      { question: 'If $S_{xy}=30$ and $S_{xx}=12$, find the gradient of the least-squares line.', answer: '$2.5$', verify: { kind: 'value', expr: '30/12', answer: '2.5' } },
      { question: 'A line of best fit is $y=2.5x+10$. Predict $y$ when $x=8$.', answer: '$30$', verify: { kind: 'value', expr: '2.5*8+10', answer: '30' } }
    ]
  },

  'mst-12-s2-09': {
    summary: 'Probability measures how likely an event is on a scale from $0$ to $1$. Relative frequency estimates it from an experiment; theoretical probability calculates it from equally likely outcomes. Trees and the complement turn multi-stage questions into short calculations.',
    prereqs: [],
    concepts: [
      { title: 'Relative frequency', body: 'Relative frequency is the number of times an event occurred divided by the number of trials. It estimates the probability, and the estimate settles down as the number of trials grows. $38$ sixes in $200$ rolls is $\\dfrac{38}{200}=0.19$.' },
      { title: 'Theoretical probability', body: 'For equally likely outcomes, $P(A)=\\dfrac{n(A)}{n(S)}$. The expected number of times an event occurs in $N$ trials is $N\\times P(A)$, and the actual count will usually differ from it.' },
      { title: 'The complement', body: 'The probability that $A$ does not happen is $1-P(A)$. It is the shortcut for "at least one": $P(\\text{at least one})=1-P(\\text{none})$.' },
      { title: 'Multi-stage events and trees', body: 'Multiply along the branches for "and", add the end results for "or". Without replacement the second-stage probabilities change, because one item has been removed.' }
    ],
    definitions: [
      { term: 'Relative frequency', meaning: 'The fraction of trials in which an event occurred; an experimental estimate of its probability.' },
      { term: 'Complementary event', meaning: 'The event "not $A$". Its probability is $1-P(A)$.' },
      { term: 'Sample space', meaning: 'The set of all possible outcomes of an experiment.' }
    ],
    formulas: [
      { label: 'Relative frequency', tex: '\\text{relative frequency}=\\dfrac{\\text{frequency}}{\\text{number of trials}}' },
      { label: 'Probability and complement', tex: 'P(A)=\\dfrac{n(A)}{n(S)},\\qquad P(\\text{not }A)=1-P(A)' },
      { label: 'Expected frequency', tex: '\\text{expected}=N\\times P(A)' }
    ],
    points: [
      { front: 'What range does a probability take?', back: 'From $0$ (impossible) to $1$ (certain).' },
      { front: '$P(\\text{at least one})$ in terms of the complement?', back: '$1-P(\\text{none})$.' },
      { front: 'Do probabilities along a path in a tree add or multiply?', back: 'Multiply along a path; add the end results of different paths for "or".' },
      { front: 'What happens to the second-stage probabilities when sampling without replacement?', back: 'The denominator always falls by one, and the numerator falls only if the item taken was the type you want.' },
      { front: 'Why can relative frequency differ from theoretical probability?', back: 'Chance variation: fewer trials means a bigger difference. More trials usually brings them closer.' }
    ],
    mistakes: [
      { wrong: 'Using $\\tfrac{5}{8}\\times\\tfrac{5}{8}$ for two reds drawn without replacement.', right: 'After one red is removed there are $4$ red of $7$: $\\tfrac{5}{8}\\times\\tfrac{4}{7}$.' },
      { wrong: 'Adding probabilities along a branch.', right: 'Multiply along a branch for "and"; add only different paths for "or".' },
      { wrong: 'Expecting exactly $100$ sixes in $600$ rolls.', right: 'It is the expected number; the actual number varies.' }
    ],
    examples: [
      {
        question: 'A die is rolled $200$ times and a six appears $38$ times. Find the relative frequency of a six, and compare the number of sixes expected in $600$ rolls from this result with the theoretical expectation.',
        steps: ['Relative frequency: $\\dfrac{38}{200}=0.19$.', 'From the experiment: $600\\times0.19=114$.', 'Theoretical: $P(6)=\\tfrac{1}{6}$, so $600\\times\\tfrac{1}{6}=100$.', 'The experimental estimate is a little higher, which is chance variation.'],
        answer: 'Relative frequency $0.19$; $114$ sixes from the experiment against $100$ theoretical.',
        working: '\\begin{aligned}\\dfrac{38}{200}&=0.19\\\\600\\times0.19&=114\\\\600\\times\\tfrac{1}{6}&=100\\end{aligned}',
        verify: { kind: 'values', pairs: [['38/200', '0.19'], ['600*0.19', '114'], ['600/6', '100']] }
      },
      {
        question: 'A bag has $5$ red and $3$ blue marbles. Two are drawn without replacement. Find the probability that both are red.',
        steps: ['First red: $\\tfrac{5}{8}$.', 'One red is gone, so $4$ red remain among $7$: $\\tfrac{4}{7}$.', 'Multiply: $\\tfrac{5}{8}\\times\\tfrac{4}{7}=\\tfrac{20}{56}=\\tfrac{5}{14}$.'],
        answer: '$\\tfrac{5}{14}$',
        working: '\\begin{aligned}P(RR)&=\\tfrac{5}{8}\\times\\tfrac{4}{7}\\\\&=\\tfrac{20}{56}\\\\&=\\tfrac{5}{14}\\end{aligned}',
        verify: { kind: 'value', expr: '5/8*4/7', answer: '5/14' }
      },
      {
        question: 'Using the same bag, find the probability that at least one of the two marbles is blue.',
        steps: ['"At least one blue" is the complement of "no blue", which is both red.', '$P(\\text{both red})=\\tfrac{5}{14}$.', '$P(\\text{at least one blue})=1-\\tfrac{5}{14}=\\tfrac{9}{14}$.'],
        answer: '$\\tfrac{9}{14}$',
        working: '\\begin{aligned}P(\\text{at least one blue})&=1-P(RR)\\\\&=1-\\tfrac{5}{14}\\\\&=\\tfrac{9}{14}\\end{aligned}',
        verify: { kind: 'value', expr: '1-5/14', answer: '9/14' }
      }
    ],
    examiners: [
      'A probability is written as a fraction, decimal or percentage in simplest form, between $0$ and $1$.',
      'For "at least one" the complement is used and named, rather than adding several cases.',
      'A tree diagram has branches that sum to $1$ at each node and is adjusted for removal of an item.',
      'Expected values and relative frequencies are distinguished: one is a calculation, the other an observed result.'
    ],
    diagrams: [
      { title: 'Two marbles without replacement', spec: { kind: 'tree', branches: [{ label: 'R', p: [5, 8], children: [{ label: 'R', p: [4, 7] }, { label: 'B', p: [3, 7] }] }, { label: 'B', p: [3, 8], children: [{ label: 'R', p: [5, 7] }, { label: 'B', p: [2, 7] }] }] }, note: 'The path $R,R$ has probability $\\tfrac{5}{8}\\times\\tfrac{4}{7}=\\tfrac{5}{14}$. The other three paths sum to $\\tfrac{9}{14}$.' }
    ],
    check: [
      { question: 'A coin is tossed $150$ times and lands heads $45$ times. Find the relative frequency of heads.', answer: '$0.3$', verify: { kind: 'value', expr: '45/150', answer: '0.3' } },
      { question: 'From the bag of $5$ red and $3$ blue marbles, two are drawn without replacement. Find $P(\\text{both blue})$.', answer: '$\\tfrac{3}{28}$', verify: { kind: 'value', expr: '3/8*2/7', answer: '3/28' } }
    ]
  },

  'mst-12-s2-10': {
    summary: 'Many measurements, such as heights, follow a bell-shaped normal distribution centred on the mean. The z-score says how many standard deviations a value is from the mean, and the 68-95-99.7 rule gives the proportion of values within $1$, $2$ and $3$ standard deviations.',
    prereqs: ['mst-12-s2-09'],
    concepts: [
      { title: 'The normal curve', body: 'The curve is symmetric about the mean $\\mu$. Its spread is set by the standard deviation $\\sigma$, and the total area under it is $1$. The mean, median and mode are the same.' },
      { title: 'The 68-95-99.7 rule', body: 'About $68\\%$ of values lie within $1$ standard deviation of the mean, about $95\\%$ within $2$, and about $99.7\\%$ within $3$. By symmetry about $2.5\\%$ lie more than $2$ standard deviations above the mean.' },
      { title: 'z-scores', body: 'The z-score is $z=\\dfrac{x-\\mu}{\\sigma}$. A positive $z$ is above the mean and a negative $z$ below it. For heights with $\\mu=170$ and $\\sigma=6$, a height of $182$ cm has $z=\\dfrac{12}{6}=2$.' },
      { title: 'Comparing across distributions', body: 'A z-score converts any normal value to the same scale, so values from different distributions can be compared. The larger $z$ is further above its own mean. Reverse the formula to recover a value: $x=\\mu+z\\sigma$.' }
    ],
    definitions: [
      { term: 'Standard deviation', meaning: 'A measure of the typical distance of values from the mean. A larger standard deviation gives a wider, flatter curve.' },
      { term: 'z-score', meaning: 'The number of standard deviations a value is above (positive) or below (negative) the mean.' },
      { term: 'Normal distribution', meaning: 'A symmetric, bell-shaped distribution centred on its mean, where about $68\\%$, $95\\%$ and $99.7\\%$ of values lie within $1$, $2$ and $3$ standard deviations of it.' }
    ],
    formulas: [
      { label: 'z-score', tex: 'z=\\dfrac{x-\\mu}{\\sigma}' },
      { label: 'Value from a z-score', tex: 'x=\\mu+z\\sigma' },
      { label: 'Empirical rule', tex: 'P(|z|\\le1)\\approx0.68,\\quad P(|z|\\le2)\\approx0.95,\\quad P(|z|\\le3)\\approx0.997' }
    ],
    points: [
      { front: 'What percentage lies within $1$ standard deviation of the mean?', back: 'About $68\\%$.' },
      { front: 'What percentage lies within $2$ standard deviations of the mean?', back: 'About $95\\%$.' },
      { front: 'What percentage lies within $3$ standard deviations of the mean?', back: 'About $99.7\\%$.' },
      { front: 'What percentage is more than $2$ standard deviations above the mean?', back: 'About $2.5\\%$, half of the $5\\%$ outside $2$ standard deviations.' },
      { front: 'What does $z=-1.5$ tell you?', back: 'The value is $1.5$ standard deviations below the mean.' }
    ],
    mistakes: [
      { wrong: 'Saying $95\\%$ of values lie more than $2$ standard deviations from the mean.', right: 'About $95\\%$ lie within $2$ standard deviations; only about $5\\%$ lie outside.' },
      { wrong: 'Calculating $z=\\dfrac{\\mu-x}{\\sigma}$ and getting the sign wrong.', right: 'The value comes first: $z=\\dfrac{x-\\mu}{\\sigma}$, negative below the mean.' },
      { wrong: 'Using the $2.5\\%$ one-sided area as the answer for "outside $2$ standard deviations".', right: 'Outside on both sides is $5\\%$; $2.5\\%$ is one tail.' }
    ],
    examples: [
      {
        question: 'Adult heights are normally distributed with mean $170$ cm and standard deviation $6$ cm. Find the z-score of a person who is $182$ cm tall.',
        steps: ['Use $z=\\dfrac{x-\\mu}{\\sigma}$.', '$z=\\dfrac{182-170}{6}=\\dfrac{12}{6}=2$.', 'The height is $2$ standard deviations above the mean.'],
        answer: '$z=2$',
        working: '\\begin{aligned}z&=\\dfrac{182-170}{6}\\\\&=\\dfrac{12}{6}\\\\&=2\\end{aligned}',
        verify: { kind: 'value', expr: '(182-170)/6', answer: '2' }
      },
      {
        question: 'Using the same heights, what percentage of adults are taller than $182$ cm?',
        steps: ['$182$ is $2$ standard deviations above the mean.', 'About $95\\%$ lie within $2$ standard deviations, so about $5\\%$ lie outside.', 'By symmetry half of that $5\\%$ is above: $5\\%\\div2=2.5\\%$.'],
        answer: 'About $2.5\\%$',
        working: '\\begin{aligned}100\\%-95\\%&=5\\%\\\\5\\%\\div2&=2.5\\%\\end{aligned}',
        verify: { kind: 'value', expr: '(100-95)/2', answer: '2.5' }
      },
      {
        question: 'For the same heights find the height with a z-score of $-1.5$.',
        steps: ['Use $x=\\mu+z\\sigma$.', '$x=170+(-1.5)(6)$.', '$x=170-9=161$.'],
        answer: '$161$ cm',
        working: '\\begin{aligned}x&=170+(-1.5)(6)\\\\&=170-9\\\\&=161\\end{aligned}',
        verify: { kind: 'value', expr: '170+(-1.5)*6', answer: '161' }
      }
    ],
    examiners: [
      'The formula for the z-score is written with the value first and the mean second, and the sign of $z$ is interpreted.',
      'The rule is quoted exactly: about $68\\%$, $95\\%$, $99.7\\%$ within $1$, $2$, $3$ standard deviations.',
      'A sketch of the normal curve shows the mean and the shaded region before any percentage is stated.',
      'The answer is stated in the context of the question with units, for example "$161$ cm".'
    ],
    diagrams: [
      { title: 'Heights within $1$ standard deviation', spec: { kind: 'normal', mu: 170, sigma: 6, from: 164, to: 176, mode: 'x' }, note: 'The shaded area from $164$ cm to $176$ cm is one standard deviation either side of the mean $170$ cm: about $68\\%$ of adults.' },
      { title: 'Shade the area between two z-scores', spec: { kind: 'normalZ', initial: [-2, 2] } }
    ],
    check: [
      { question: 'Heights have mean $170$ cm and standard deviation $6$ cm. Find the z-score for $158$ cm.', answer: '$z=-2$', verify: { kind: 'value', expr: '(158-170)/6', answer: '-2' } },
      { question: 'A test has mean $50$ and standard deviation $4$. Find the mark with $z=1.5$.', answer: '$56$', verify: { kind: 'value', expr: '50+1.5*4', answer: '56' } }
    ]
  }
};
