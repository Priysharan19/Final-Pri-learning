// Pri Learning · NCERT Class 8 Chapters 3–13 — production source layer
// Source: user-supplied NCERT Mathematics Reprint 2024–25 chapter PDFs and
// the matching Answers.pdf. This module keeps source coverage, answer-key
// verification, topper notes, worked examples and four-level source-mastery
// generators together so every remaining Class 8 chapter follows one audited
// production contract.
//
// Numeric generated questions use the existing PracticeBase → InkAnswer path;
// this file deliberately does not create a parallel handwriting or marking stack.

import { ri, rc, mcq } from '../qhelpers.js';

const freeze = x => Object.freeze(x);
const q = (prompt, value, hints, steps, extra = {}) => ({
  prompt,
  answerType: 'numeric',
  answer: { value },
  hints,
  steps: steps.map(([h, d]) => ({ h, d })),
  ...extra
});
const qFrac = (prompt, n, d, hints, steps, extra = {}) => q(
  prompt, n / d, hints, steps,
  { answer: { value: n / d, simplestFraction: { n, d } }, inputHint: `e.g. ${n}/${d}`, ...extra }
);
const qMcq = (rng, prompt, correct, distractors, hints, steps) => {
  const m = mcq(rng, correct, distractors.map(([text, why]) => ({ text, why })));
  return {
    prompt,
    answerType: 'mcq',
    answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps },
    mcqOptions: m.options,
    hints,
    steps: steps.map(([h, d]) => ({ h, d }))
  };
};
const pick = (rng, xs) => xs[Math.floor(rng() * xs.length)];

const generators = {
  'c8-quadrilaterals-ncert-mastery': (rng, diff) => {
    if (diff === 1) {
      const n = pick(rng, [3,4,5,6,8,9,10,12,15,18,20,24]);
      const a = 360 / n;
      return q(`A regular polygon has $${n}$ sides. Find each exterior angle.`, a,
        ['One exterior angle is one equal share of a full turn.', 'A full turn is $360^\\circ$.', `Compute $360\\div ${n}$.`],
        [['Full turn','$360^\\circ$'],['Equal exterior angles',`$360\\div ${n}$`],['Answer',`$${a}^\\circ$`]], { answerSuffix:'°' });
    }
    if (diff === 2) {
      const a = ri(rng, 45, 135), b = 180 - a;
      return q(`One angle of a parallelogram is $${a}^\\circ$. Find an adjacent angle.`, b,
        ['Adjacent angles in a parallelogram are supplementary.', 'Supplementary angles total $180^\\circ$.', `Compute $180-${a}$.`],
        [['Property','Adjacent parallelogram angles sum to $180^\\circ$'],['Subtract',`$180-${a}=${b}$`],['Answer',`$${b}^\\circ$`]], { answerSuffix:'°' });
    }
    if (diff === 3) {
      const x = ri(rng, 3, 15), k = ri(rng, 2, 7), c = ri(rng, 1, 12);
      const left = k*x + c, rightConst = left - (k+2)*x;
      return q(`Opposite sides of a parallelogram are $${k}x+${c}$ and $${k+2}x${rightConst>=0?'+':''}${rightConst}$. Find $x$.`, x,
        ['Opposite sides of a parallelogram are equal.', 'Set the two expressions equal.', 'Collect the $x$-terms on one side and constants on the other.'],
        [['Opposite sides',`$${k}x+${c}=${k+2}x${rightConst>=0?'+':''}${rightConst}$`],['Solve',`$2x=${c-rightConst}$`],['Answer',`$x=${x}$`]]);
    }
    const x = ri(rng, 20, 70), a = x + ri(rng, 5, 25), b = 180-a;
    const p = a - x, qv = b - 2*x;
    return q(`Adjacent angles of a parallelogram are $(x+${p})^\\circ$ and $(2x${qv>=0?'+':''}${qv})^\\circ$. Find $x$.`, x,
      ['Adjacent parallelogram angles sum to $180^\\circ$.', 'Add the two algebraic angle expressions.', 'Solve the resulting linear equation.'],
      [['Supplementary relation',`$(x+${p})+(2x${qv>=0?'+':''}${qv})=180$`],['Collect',`$3x+${p+qv}=180$`],['Answer',`$x=${x}$`]]);
  },

  'c8-data-handling-ncert-mastery': (rng, diff) => {
    if (diff === 1) {
      const a=ri(rng,20,80), b=ri(rng,20,80), c=ri(rng,20,80);
      const max=Math.max(a,b,c), labels=['A','B','C'], idx=[a,b,c].indexOf(max);
      return qMcq(rng, `A bar graph has category values A=$${a}$, B=$${b}$ and C=$${c}$. Which category has the greatest value?`, labels[idx],
        labels.filter((_,i)=>i!==idx).map(t=>[t,'Its bar is not the tallest.']).concat([['All equal','The three values are not all equal.']]),
        ['Compare the numerical heights represented by the bars.', 'The tallest bar represents the greatest value.', `The maximum of ${a}, ${b}, ${c} is ${max}.`],
        [['Read values',`A=${a}, B=${b}, C=${c}`],['Compare',`Maximum=${max}`],['Answer',labels[idx]]]);
    }
    if (diff === 2) {
      const total=pick(rng,[40,60,72,80,90,120]), part=pick(rng,[total/2,total/3,total/4,total/5].filter(Number.isInteger));
      const angle=part/total*360;
      return q(`A pie chart represents $${total}$ students. A category contains $${part}$ students. Find its central angle.`, angle,
        ['A full pie chart is $360^\\circ$.','Use category/total × 360°.',`Compute $${part}/${total}\\times360^\\circ$.`],
        [['Fraction',`$${part}/${total}$`],['Angle',`$\\frac{${part}}{${total}}\\times360=${angle}$`],['Answer',`$${angle}^\\circ$`]], {answerSuffix:'°'});
    }
    if (diff === 3) {
      const event=pick(rng,[['prime',[2,3,5]],['even',[2,4,6]],['greater than 4',[5,6]]]);
      const fav=event[1].length;
      const g=(a,b)=>{while(b){[a,b]=[b,a%b]}return a}; const d=g(fav,6);
      return qFrac(`A fair die is rolled once. Find the probability of getting a ${event[0]} number.`, fav/d, 6/d,
        ['Write the six equally likely die outcomes.',`Favourable outcomes: ${event[1].join(', ')}.`, 'Probability = favourable outcomes ÷ total outcomes.'],
        [['Sample space','$\\{1,2,3,4,5,6\\}$'],['Count',`${fav} favourable out of 6`],['Simplify',`$${fav}/6=${fav/d}/${6/d}$`]]);
    }
    const red=ri(rng,1,4), blue=ri(rng,1,4), green=ri(rng,1,4), total=red+blue+green;
    const nonBlue=red+green; const g=(a,b)=>{while(b){[a,b]=[b,a%b]}return a}; const d=g(nonBlue,total);
    return qFrac(`A spinner has $${red}$ equal red sectors, $${blue}$ equal blue sectors and $${green}$ equal green sectors. Find $P(\\text{not blue})$.`, nonBlue/d, total/d,
      ['All sectors are equally likely.', 'Not blue means red or green.', 'Add the non-blue sectors and divide by the total.'],
      [['Total sectors',`$${red}+${blue}+${green}=${total}$`],['Non-blue sectors',`$${red}+${green}=${nonBlue}$`],['Probability',`$${nonBlue}/${total}=${nonBlue/d}/${total/d}$`]]);
  },

  'c8-squares-roots-ncert-mastery': (rng, diff) => {
    if (diff === 1) {
      const n=pick(rng,[12,18,27,34,43,58,67,72,83,94]);
      const u=(n*n)%10;
      return q(`Without multiplying fully, find the units digit of $${n}^2$.`,u,
        ['Only the units digit of the base affects the units digit of the square.',`The units digit of ${n} is ${n%10}.`,`Square ${n%10} and keep only its units digit.`],
        [['Units digit',`${n%10}`],['Square',`$${n%10}^2=${(n%10)**2}$`],['Answer',`${u}`]]);
    }
    if (diff === 2) {
      const root=ri(rng,12,70), sq=root*root;
      return q(`Find $\\sqrt{${sq}}$.`,root,
        ['This is a perfect square.', 'Look for the natural number whose square equals the given number.',`Check nearby square values around ${root}.`],
        [['Recognise',`$${sq}=${root}^2$`],['Take square root',`$\\sqrt{${root}^2}=${root}$`],['Answer',`${root}`]]);
    }
    if (diff === 3) {
      const roots=pick(rng,[[15,225],[25,625],[35,1225],[45,2025],[65,4225],[75,5625]]);
      const val=roots[1]/100;
      return q(`Find $\\sqrt{${val.toFixed(2)}}$.`,roots[0]/10,
        ['Pair decimal digits from the decimal point.', 'Equivalently, write the decimal as an integer over 100.', `Use $\\sqrt{${roots[1]}/100}=\\sqrt{${roots[1]}}/10$.`],
        [['Convert',`$${val.toFixed(2)}=${roots[1]}/100$`],['Root numerator',`$\\sqrt{${roots[1]}}=${roots[0]}$`],['Answer',`$${roots[0]}/10=${roots[0]/10}$`]]);
    }
    const m=ri(rng,5,25), n=m*m+ri(rng,1,2*m), next=(m+1)*(m+1), add=next-n;
    return q(`What is the smallest natural number that must be added to $${n}$ to make it a perfect square?`,add,
      ['Locate the number between two consecutive perfect squares.',`$${m}^2=${m*m}$ and $${m+1}^2=${next}$.`,'The smallest addition reaches the next perfect square.'],
      [['Bracket',`$${m*m}<${n}<${next}$`],['Difference',`$${next}-${n}=${add}$`],['Answer',`${add}`]]);
  },

  'c8-cubes-roots-ncert-mastery': (rng, diff) => {
    if (diff === 1) {
      const n=ri(rng,20,99), u=(n**3)%10;
      return q(`Find the units digit of $${n}^3$ without calculating the whole cube.`,u,
        ['Only the units digit affects the units digit of a cube.',`The units digit of ${n} is ${n%10}.`,`Cube ${n%10} and keep the last digit.`],
        [['Units digit',`${n%10}`],['Cube',`$${n%10}^3=${(n%10)**3}$`],['Answer',`${u}`]]);
    }
    if (diff === 2) {
      const a=ri(rng,2,6), p=pick(rng,[2,3,5,7]), value=(a**3)*(p**2);
      return q(`Find the smallest natural number by which $${value}$ must be multiplied to become a perfect cube.`,p,
        ['In a perfect cube, each prime exponent is a multiple of 3.',`The number is built as $${a}^3\\times${p}^2$.`,'One more factor completes the missing triple.'],
        [['Factor structure',`$${value}=${a}^3\\times${p}^2$`],['Repair exponent',`$${p}^2\\times${p}=${p}^3$`],['Answer',`${p}`]]);
    }
    if (diff === 3) {
      const root=ri(rng,4,30), cube=root**3;
      return q(`Find $\\sqrt[3]{${cube}}$.`,root,
        ['The cube root reverses cubing.',`Look for a number whose cube is ${cube}.`,`Check $${root}^3$.`],
        [['Recognise',`$${cube}=${root}^3$`],['Cube root',`$\\sqrt[3]{${root}^3}=${root}$`],['Answer',`${root}`]]);
    }
    const side=ri(rng,3,15), volume=side**3;
    return q(`A cube has volume $${volume}\\text{ cm}^3$. Find its edge length.`,side,
      ['For a cube, volume = side³.',`So side = cube root of ${volume}.`,`Recognise ${volume} as a perfect cube.`],
      [['Formula',`$V=s^3$`],['Reverse',`$s=\\sqrt[3]{${volume}}$`],['Answer',`$s=${side}\\text{ cm}$`]], {answerSuffix:' cm'});
  },

  'c8-comparing-quantities-ncert-mastery': (rng, diff) => {
    if (diff === 1) {
      const mp=pick(rng,[400,500,800,1000,1200,1500]), pct=pick(rng,[10,15,20,25]), discount=mp*pct/100, sale=mp-discount;
      return q(`An article is marked at ₹${mp} and discounted by $${pct}\\%$. Find the sale price.`,sale,
        ['Discount is calculated on marked price.',`Find ${pct}% of ₹${mp}.`,'Subtract the discount from marked price.'],
        [['Discount',`₹${mp}\\times${pct}/100=₹${discount}`],['Sale price',`₹${mp}-₹${discount}=₹${sale}`],['Answer',`₹${sale}`]], {answerPrefix:'₹'});
    }
    if (diff === 2) {
      const price=pick(rng,[500,800,1200,1500,2000]), tax=pick(rng,[5,12,18]), amt=price*(100+tax)/100;
      return q(`The taxable price of an item is ₹${price}. GST is $${tax}\\%$. Find the final bill amount.`,amt,
        ['GST is added to the taxable price.',`Tax = ${tax}% of ₹${price}.`,'Bill = price + tax.'],
        [['GST',`₹${price}\\times${tax}/100=₹${price*tax/100}`],['Bill',`₹${price}+₹${price*tax/100}=₹${amt}`],['Answer',`₹${amt}`]], {answerPrefix:'₹'});
    }
    if (diff === 3) {
      const p=pick(rng,[2000,4000,5000,8000,10000]), r=pick(rng,[5,10,20]), years=2, amount=Number((p*(1+r/100)**years).toFixed(2)), ci=Number((amount-p).toFixed(2));
      return q(`₹${p} is invested at $${r}\\%$ p.a., compounded annually for 2 years. Find the compound interest.`,ci,
        ['Use repeated growth for two years.',`Amount = $P(1+r/100)^2$.`,'Compound interest = amount − principal.'],
        [['Amount',`₹${p}(1+${r}/100)^2=₹${amount}`],['Interest',`₹${amount}-₹${p}=₹${ci}`],['Answer',`₹${ci}`]], {answerPrefix:'₹'});
    }
    const final=pick(rng,[8100,9025,12100]), factors={8100:[10000,10],9025:[10000,5],12100:[10000,10]}, [p,r]=factors[final];
    return q(`An amount becomes ₹${final} after 2 years of annual compound change at $${r}\\%$. For this question the change is ${final<p?'depreciation':'growth'}. Find the initial amount.`,p,
      [`The two-year multiplier is $(1${final<p?'-':'+'}${r}/100)^2$.`,'Reverse a repeated percentage change by dividing by its total multiplier.','Check by applying the rate twice to your initial value.'],
      [['Multiplier',`$(1${final<p?'-':'+'}${r}/100)^2$`],['Reverse',`Initial=₹${final}\\div${(final/p).toFixed(4)}`],['Answer',`₹${p}`]], {answerPrefix:'₹'});
  },

  'c8-algebraic-identities-ncert-mastery': (rng, diff) => {
    if (diff === 1) {
      const a=ri(rng,2,9), b=ri(rng,2,9), c=a+b;
      return qMcq(rng, `Simplify $${a}x+${b}x$.`, `$${c}x`, [
        [`$${a*b}x^2$`,'That multiplies the terms instead of adding like coefficients.'],
        [`$${c}x^2$`,'Adding like terms does not change the exponent.'],
        [`$${a}x+${b}$`,'The second term still contains x.']
      ], ['The two terms are like terms.', 'Add only their coefficients.',`$${a}+${b}=${c}$.`],
      [['Like terms','Both have variable part $x$'],['Coefficients',`$${a}+${b}=${c}$`],['Answer',`$${c}x$`]]);
    }
    if (diff === 2) {
      const a=ri(rng,2,9), b=ri(rng,2,9), coef=a*b;
      return qMcq(rng, `Multiply $${a}x^2$ by $${b}x^3$.`, `$${coef}x^5`, [
        [`$${coef}x^6$`,'For the same base, exponents add; they do not multiply.'],
        [`$${a+b}x^5$`,'Coefficients multiply, not add.'],
        [`$${coef}x$`,'The powers of x must be combined.']
      ], ['Multiply numerical coefficients.', 'For the same base x, add exponents.',`$2+3=5$.`],
      [['Coefficients',`$${a}\\times${b}=${coef}$`],['Powers',`$x^2x^3=x^5$`],['Answer',`$${coef}x^5$`]]);
    }
    if (diff === 3) {
      const a=ri(rng,2,6), b=ri(rng,2,8), c=ri(rng,1,6);
      const mid=a*c+b, con=b*c;
      return qMcq(rng, `Expand $(x+${b})(${a}x+${c})$.`, `$${a}x^2+${mid}x+${con}`, [
        [`$${a}x^2+${b+c}x+${con}$`,'Both cross-products must be included.'],
        [`$${a}x^2+${con}$`,'The two cross-terms do not disappear.'],
        [`$${a+1}x^2+${con}$`,'The leading terms multiply to ax², not (a+1)x².']
      ], ['Every term in the first binomial multiplies every term in the second.', 'There are four raw products.', 'Combine the two x-terms at the end.'],
      [['Distribute x',`$${a}x^2+${c}x$`],['Distribute constant',`$${a*b}x+${con}$`],['Combine',`$${a}x^2+${mid}x+${con}$`]]);
    }
    const x=ri(rng,-4,5), a=ri(rng,2,5), b=ri(rng,1,6), value=(x+b)*(a*x-b);
    return q(`Evaluate $(x+${b})(${a}x-${b})$ at $x=${x}$.`,value,
      ['Substitute the value of x into both factors.', 'Evaluate each bracket before multiplying.', 'Check the signs carefully if x is negative.'],
      [['First factor',`$${x}+${b}=${x+b}$`],['Second factor',`$${a}(${x})-${b}=${a*x-b}$`],['Product',`${x+b}\\times${a*x-b}=${value}`]]);
  },

  'c8-mensuration-ncert-mastery': (rng, diff) => {
    if (diff === 1) {
      const a=ri(rng,8,20), b=ri(rng,8,24), h=ri(rng,4,12), area=(a+b)*h/2;
      return q(`A trapezium has parallel sides $${a}$ cm and $${b}$ cm and height $${h}$ cm. Find its area.`,area,
        ['Use the trapezium area formula.', 'Add the parallel sides first.', 'Multiply their average by the perpendicular height.'],
        [['Formula','$A=\\frac12h(a+b)$'],['Substitute',`$A=\\frac12(${h})(${a}+${b})$`],['Answer',`$A=${area}\\text{ cm}^2$`]], {answerSuffix:' cm²'});
    }
    if (diff === 2) {
      const l=ri(rng,5,15), b=ri(rng,4,12), h=ri(rng,3,10), tsa=2*(l*b+b*h+h*l);
      return q(`A cuboid is $${l}\\times${b}\\times${h}$ cm. Find its total surface area.`,tsa,
        ['A cuboid has three pairs of congruent rectangular faces.','Use $2(lb+bh+hl)$.','Substitute all three dimensions in the same unit.'],
        [['Formula','$TSA=2(lb+bh+hl)$'],['Substitute',`$2(${l*b}+${b*h}+${h*l})$`],['Answer',`$${tsa}\\text{ cm}^2$`]], {answerSuffix:' cm²'});
    }
    if (diff === 3) {
      const r=pick(rng,[3,7,14]), h=ri(rng,5,20), pi=r%7===0?22/7:3.14, v=Number((pi*r*r*h).toFixed(2));
      return q(`A right circular cylinder has radius $${r}$ cm and height $${h}$ cm. Using $\\pi=${pi===22/7?'22/7':'3.14'}$, find its volume.`,v,
        ['Cylinder volume = base area × height.','The circular base area is $\\pi r^2$.','Substitute radius, not diameter.'],
        [['Formula','$V=\\pi r^2h$'],['Substitute',`$${pi===22/7?'22/7':'3.14'}\\times${r}^2\\times${h}$`],['Answer',`$V=${v}\\text{ cm}^3$`]], {answerSuffix:' cm³'});
    }
    const d1=pick(rng,[8,10,12,14,16]), d2=pick(rng,[6,9,15,18,20]), area=d1*d2/2;
    return q(`A rhombus has diagonals $${d1}$ cm and $${d2}$ cm. Find its area.`,area,
      ['The diagonals of a rhombus give a direct area formula.', 'Area = half the product of the diagonals.', 'Multiply the diagonals, then halve.'],
      [['Formula','$A=\\frac12d_1d_2$'],['Substitute',`$A=\\frac12(${d1})(${d2})$`],['Answer',`$A=${area}\\text{ cm}^2$`]], {answerSuffix:' cm²'});
  },

  'c8-exponents-ncert-mastery': (rng, diff) => {
    if (diff === 1) {
      const a=pick(rng,[2,3,4,5]), m=ri(rng,1,4), den=a**m;
      return qFrac(`Evaluate $${a}^{-${m}}$.`,1,den,
        ['A negative exponent means reciprocal.','Keep the base positive here and move the power to the denominator.',`Compute $${a}^{${m}}$.`],
        [['Rule',`$a^{-m}=1/a^m$`],['Power',`$${a}^${m}=${den}$`],['Answer',`$1/${den}$`]]);
    }
    if (diff === 2) {
      const a=pick(rng,[2,3,5]), m=ri(rng,-4,5), n=ri(rng,-4,5), exp=m+n;
      return qMcq(rng, `Simplify $${a}^{${m}}\\times${a}^{${n}}$ in exponential form.`, `$${a}^{${exp}}`, [
        [`$${a}^{${m*n}}$`,'Same-base multiplication adds exponents.'],
        [`$${a*2}^{${exp}}$`,'The base is not added.'],
        [`$${a}^{${m-n}}$`,'Subtracting exponents belongs to division.']
      ], ['The bases are identical.', 'For multiplication with the same base, add exponents.',`$${m}+(${n})=${exp}$.`],
      [['Law','$a^ma^n=a^{m+n}$'],['Exponent',`$${m}+(${n})=${exp}$`],['Answer',`$${a}^{${exp}}$`]]);
    }
    if (diff === 3) {
      const coeff=pick(rng,[3.02,8.5,9.42,6.02]), exp=pick(rng,[-12,-9,10,15]), shifted=Number((coeff*10).toFixed(2));
      return qMcq(rng, `Which is the standard form of the quantity represented by coefficient $${coeff}$ and power $10^{${exp}}$?`, `$${coeff}\\times10^{${exp}}$`, [
        [`$${shifted}\\times10^{${exp-1}}$`,'This equals the same value but is not normalised because the coefficient is not between 1 and 10.'],
        [`$${coeff}\\times10^{${-exp}}$`,'Changing the exponent sign changes the magnitude.'],
        [`$${coeff/10}\\times10^{${exp}}$`,'The coefficient has been changed without compensating in the exponent.']
      ], ['Standard form is $a\\times10^n$ with $1\\le a<10$.',`The coefficient ${coeff} is already normalised.`,`Keep the stated exponent ${exp}.`],
      [['Coefficient',`${coeff} is between 1 and 10`],['Power',`$10^{${exp}}$`],['Answer',`$${coeff}\\times10^{${exp}}$`]]);
    }
    const a=pick(rng,[2.5,3.2,4.5]), b=pick(rng,[1.2,2.4,5.1]), e=ri(rng,4,7), prod=Number((a*b).toFixed(2)), value=Math.round(prod*10**(2*e));
    return q(`Compute $(${a}\\times10^{${e}})(${b}\\times10^{${e}})$ and give the numerical value.`,value,
      ['Multiply coefficients and powers of ten separately.','For powers of ten with the same base, add exponents.','If needed, renormalise the coefficient before evaluating.'],
      [['Coefficients',`$${a}\\times${b}=${prod}$`],['Powers',`$10^{${e}}\\times10^{${e}}=10^{${2*e}}$`],['Value',`${prod}\\times10^${2*e}=${value}`]]);
  },

  'c8-proportions-ncert-mastery': (rng, diff) => {
    if (diff === 1) {
      const unit=ri(rng,5,30), x1=ri(rng,2,8), x2=ri(rng,9,20), y2=unit*x2;
      return q(`$${x1}$ identical items cost ₹${unit*x1}. At the same rate, what do $${x2}$ items cost?`,y2,
        ['Cost is directly proportional to number of identical items.','Find the unit cost or use equal ratios.',`Unit cost = ₹${unit}.`],
        [['Unit rate',`₹${unit*x1}/${x1}=₹${unit}`],['Scale',`₹${unit}\\times${x2}`],['Answer',`₹${y2}`]], {answerPrefix:'₹'});
    }
    if (diff === 2) {
      const workers=pick(rng,[6,8,10,12]), days=pick(rng,[6,9,12,15]), w2=pick(rng,[workers*2,workers*3]), d2=workers*days/w2;
      return q(`$${workers}$ workers complete a fixed job in $${days}$ days. How many days will $${w2}$ equally efficient workers take?`,d2,
        ['For fixed work, more workers means fewer days.','Workers and days are inversely proportional.','Keep workers × days constant.'],
        [['Constant work',`$${workers}\\times${days}=${w2}\\times d$`],['Solve',`$d=${workers*days}/${w2}$`],['Answer',`$d=${d2}$ days`]], {answerSuffix:' days'});
    }
    if (diff === 3) {
      const speed1=pick(rng,[40,50,60]), time1=pick(rng,[4,5,6]), factor=pick(rng,[2,4]), speed2=speed1*factor, time2=Number((time1/factor).toFixed(2));
      return q(`A journey takes $${time1}$ hours at $${speed1}$ km/h. At $${speed2}$ km/h, how long would the same distance take?`,time2,
        ['The distance is fixed.','For fixed distance, speed and time are inversely proportional.','Use speed × time = constant distance.'],
        [['Distance',`$${speed1}\\times${time1}=${speed1*time1}$ km`],['New time',`$${speed1*time1}/${speed2}$`],['Answer',`$${time2}$ h`]], {answerSuffix:' h'});
    }
    return qMcq(rng,'Which situation is an inverse proportion when all other relevant conditions are fixed?','Number of workers and time to complete a fixed job',[
      ['Number of identical pens and total cost','At a fixed unit price, this is direct proportion.'],
      ['Litres of petrol and distance travelled at fixed mileage','This is direct proportion.'],
      ['Time elapsed and angle turned by a clock minute hand','This is direct proportion.']
    ],['Ask which pair has a constant product.','For a fixed job, adding equally efficient workers reduces time.','Workers × time remains constant.'],
    [['Direct cases','Cost/items and distance/fuel have constant ratios'],['Inverse case','Workers×time is constant for fixed work'],['Answer','Number of workers and completion time']]);
  },

  'c8-factorisation-ncert-mastery': (rng, diff) => {
    if (diff === 1) {
      const g=ri(rng,2,9), a=ri(rng,2,8), b=ri(rng,2,8);
      return qMcq(rng, `Factorise $${g*a}x+${g*b}$.`, `$${g}(${a}x+${b})`, [
        [`$${g*a}(x+${b})$`,'The common factor was taken inconsistently.'],
        [`$${g}x(${a}+${b})$`,'x is not a factor of the constant term.'],
        [`$(${g*a}x)(${g*b})$`,'This multiplies terms rather than factoring the sum.']
      ], ['Find the greatest common numerical factor.','Both terms contain the factor shown by the gcd.','Divide each term by that factor inside the bracket.'],
      [['Common factor',`${g}`],['Divide terms',`$${g*a}x/${g}=${a}x$, $${g*b}/${g}=${b}$`],['Answer',`$${g}(${a}x+${b})$`]]);
    }
    if (diff === 2) {
      const a=ri(rng,2,8), b=ri(rng,2,8);
      return qMcq(rng, `Factorise $x^2+${a+b}x+${a*b}$.`, `$(x+${a})(x+${b})`, [
        [`$(x+${a+b})(x+${a*b})$`,'The two numbers must add to the middle coefficient and multiply to the constant.'],
        [`$(x-${a})(x-${b})$`,'Those factors give a positive middle coefficient only if signs are handled incorrectly.'],
        [`$x(x+${a+b})+${a*b}$`,'This is not fully factorised.']
      ], ['Find two numbers whose sum is the x coefficient.','Their product must equal the constant term.',`${a}+${b}=${a+b} and ${a}×${b}=${a*b}.`],
      [['Pair',`${a}, ${b}`],['Check',`sum=${a+b}, product=${a*b}`],['Answer',`$(x+${a})(x+${b})$`]]);
    }
    if (diff === 3) {
      const g=ri(rng,2,7), a=ri(rng,2,6), b=ri(rng,1,5);
      return qMcq(rng, `Simplify $\\dfrac{${g*a}x^2+${g*b}x}{${g}x}$.`, `$${a}x+${b}`, [
        [`$${a}x^2+${b}x$`,'The denominator factor has not been cancelled.'],
        [`$${a+b}x$`,'The quotient terms are unlike and cannot be combined.'],
        [`$${a}x+${g*b}$`,'Both numerator terms must be divided by gx.']
      ], ['Factor the numerator or divide each term by the monomial.','Cancel only common multiplicative factors.',`$${g*a}x^2/(${g}x)=${a}x$ and $${g*b}x/(${g}x)=${b}$.`],
      [['Divide first term',`$${a}x$`],['Divide second term',`${b}`],['Answer',`$${a}x+${b}$`]]);
    }
    const a=ri(rng,2,9), b=ri(rng,2,9);
    return qMcq(rng, `Factorise $${a*a}x^2-${b*b}$.`, `$(${a}x-${b})(${a}x+${b})`, [
      [`$(${a}x-${b})^2$`,'That would produce a middle term.'],
      [`$(${a*a}x-${b})(${a}x+${b})$`,'The squared first term must be split as (ax)^2.'],
      [`$${a}x(${a}x-${b*b})$`,'The constant term has no factor x.']
    ], ['Recognise a difference of two squares.',`$${a*a}x^2=(${a}x)^2$ and $${b*b}=${b}^2$.`,'Use $A^2-B^2=(A-B)(A+B)$.'],
    [['Identify squares',`$(${a}x)^2-${b}^2$`],['Identity','$A^2-B^2=(A-B)(A+B)$'],['Answer',`$(${a}x-${b})(${a}x+${b})$`]]);
  },

  'c8-graphs-ncert-mastery': (rng, diff) => {
    if (diff === 1) {
      const x=ri(rng,1,8), y=ri(rng,1,10);
      return qMcq(rng, `A plotted point has coordinates $(${x},${y})$. Which statement is correct?`, `Move ${x} units along the x-axis and ${y} units along the y-axis`, [
        [`Move ${y} along x and ${x} along y`,'That swaps the coordinate order.'],
        ['Both coordinates are read only from the x-axis','The second coordinate is read from the y-axis.'],
        ['Coordinates do not depend on axis scales','The numerical coordinate depends on the stated scale.']
      ], ['Ordered pairs are written (x,y).','The first coordinate is horizontal; the second is vertical.','Read the axis scales before placing the point.'],
      [['Order','$(x,y)$'],['Axes','x horizontal, y vertical'],['Answer',`Move ${x} along x and ${y} along y`]]);
    }
    if (diff === 2) {
      const x1=ri(rng,1,5), y1=ri(rng,10,30), rise=ri(rng,2,8), y2=y1+rise;
      return q(`A line graph shows a value of $${y1}$ at time $${x1}$ and $${y2}$ one time-unit later. By how much did the value increase?`,rise,
        ['Read the two y-values from the graph data.','Change = later value − earlier value.',`Compute ${y2}−${y1}.`],
        [['Earlier',`${y1}`],['Later',`${y2}`],['Increase',`$${y2}-${y1}=${rise}$`]]);
    }
    if (diff === 3) {
      const d1=ri(rng,30,80), d2=d1+ri(rng,20,90);
      return qMcq(rng, `On a distance–time graph, distance is $${d1}$ km at 10 a.m. and remains $${d1}$ km at 10:30 a.m., then becomes $${d2}$ km at 11 a.m. What does the horizontal segment from 10 to 10:30 mean?`, 'The traveller stopped for 30 minutes', [
        ['The traveller moved at constant nonzero speed','A moving object would show changing distance.'],
        ['The traveller returned toward the start','That would make distance decrease.'],
        ['The graph has no physical meaning','A horizontal distance-time segment has a clear interpretation.']
      ], ['A horizontal segment means the y-value did not change.','Here y is distance from the start.','No distance change over time means zero speed.'],
      [['Read segment',`Distance stays ${d1} km`],['Rate','Change in distance is 0'],['Answer','Stopped for 30 minutes']]);
    }
    const unit=pick(rng,[20,30,50]), litres=ri(rng,5,20), cost=unit*litres;
    return q(`A quantity–cost graph represents petrol at ₹${unit} per litre. What cost corresponds to $${litres}$ litres?`,cost,
      ['Cost is the dependent variable and litres are the independent variable.','At a fixed price per litre the graph is a straight line through the origin.',`Use cost = ${unit}×litres.`],
      [['Relationship',`$C=${unit}L$`],['Substitute',`$C=${unit}\\times${litres}$`],['Answer',`₹${cost}`]], {answerPrefix:'₹'});
  }
};

export const NCERT_CLASS8_3_13_GENERATORS = freeze(generators);

const RAW_CHAPTERS = {
  "c8-quadrilaterals": {
    "id": "c8-quadrilaterals",
    "title": "Understanding Quadrilaterals",
    "pages": 16,
    "exercises": ["3.1","3.2","3.3","3.4"],
    "dotpoints": [
      "Classify polygons and use the 360° exterior-angle sum of a polygon, including regular polygons",
      "Use and justify the defining properties of trapeziums, kites and parallelograms, including side, angle and diagonal relationships",
      "Apply the properties of parallelograms, rhombuses, rectangles and squares to determine unknown angles, sides and classifications"
    ],
    "sourceMap": [
      {"pages":"1–2","section":"3.1 Introduction · Exercise 3.1","coverage":"Plane curves; simple/closed curves; convex and concave polygons; regular versus irregular polygons; classification questions."},
      {"pages":"3–4","section":"3.2 Exterior angles · Exercise 3.2","coverage":"One complete turn gives exterior-angle sum 360°; regular polygon exterior/interior angles; number of sides from an angle; possibility tests."},
      {"pages":"4–11","section":"3.3 Kinds of quadrilaterals · Exercise 3.3","coverage":"Trapezium, isosceles trapezium, kite and parallelogram; opposite/adjacent elements; equal opposite sides/angles; adjacent supplementary angles; diagonals bisect."},
      {"pages":"12–15","section":"3.4 Special parallelograms · Exercise 3.4","coverage":"Rhombus, rectangle and square as nested special parallelograms; diagonal and angle properties; classification reasoning."},
      {"pages":"16","section":"What Have We Discussed?","coverage":"Chapter summary audited against the source."}
    ],
    "notes": [
      {"title":"Exterior angles are a turning invariant","level":"Topper theorem control","points":["Walking once around any convex polygon produces one full turn, so the sum of one exterior angle at each vertex is 360°.","For a regular n-gon, each exterior angle is 360°/n and each interior angle is 180°−360°/n.","A proposed regular-polygon exterior angle must divide 360° exactly if the number of sides is to be a whole number.","The minimum regular-polygon interior angle is 60° (equilateral triangle); the maximum exterior angle is therefore 120°."],"formula":"Regular n-gon: exterior = 360°/n, interior = 180° − 360°/n.","edge":"Topper check: if you are given an interior angle, convert to its exterior supplement first; divisibility by 360° then decides whether the regular polygon can exist."},
      {"title":"Parallelogram properties form a dependency chain","level":"Proof-aware geometry","points":["Opposite sides are parallel by definition.","From parallel-line angle facts and a diagonal, opposite sides are equal and opposite angles are equal.","Adjacent angles are supplementary.","Diagonals bisect each other, but they are not generally equal or perpendicular."],"edge":"Do not import rectangle/rhombus properties into a general parallelogram. Equal diagonals point toward a rectangle; perpendicular diagonals point toward a rhombus."},
      {"title":"Special quadrilaterals are nested, not disconnected","level":"Classification mastery","points":["Every square is simultaneously a rectangle, rhombus, parallelogram and quadrilateral.","A rectangle is a parallelogram with four right angles; its diagonals are equal and bisect each other.","A rhombus is a parallelogram with all sides equal; its diagonals are perpendicular and bisect opposite angles.","A kite has two distinct pairs of adjacent equal sides; do not assume both pairs of opposite sides are parallel."],"edge":"Topper habit: answer 'must be', 'can be' and 'cannot be' questions by starting from definitions, then adding only properties guaranteed by the stated class."},
      {"title":"Unknown-angle questions are usually one theorem deep","level":"Exam speed","points":["At a parallelogram vertex, adjacent angles total 180° and opposite angles are equal.","For a regular polygon, exterior + interior = 180°.","For a trapezium, co-interior angles along a transversal of the parallel sides total 180°.","When several properties are visible, pick the shortest invariant instead of angle-chasing every line."],"edge":"Write the governing relation before substituting numbers. This makes method marks explicit and catches wrong-property errors early."}
    ],
    "examples": [
      {"title":"Regular polygon from an interior angle","prompt":"A regular polygon has each interior angle 165°. How many sides does it have?","steps":["Exterior angle = 180° − 165° = 15°.","The exterior angles make one full turn of 360°.","Number of sides = 360° ÷ 15° = 24."],"answer":"24 sides","topper":"The divisibility test happens automatically after converting interior to exterior."},
      {"title":"Parallelogram angle structure","prompt":"One angle of a parallelogram is 68°. Find the other three angles.","steps":["Opposite angles are equal, so the opposite angle is 68°.","Adjacent angles are supplementary: 180° − 68° = 112°.","The remaining opposite angle is also 112°."],"answer":"68°, 112°, 68°, 112°","topper":"Do not add all four angles from scratch; the parallelogram properties reduce the work to one subtraction."}
    ],
    "exerciseMethods": {"3.1":"Classify each figure by checking openness, self-intersection, line-segment boundary and convexity in that order.","3.2":"Use exterior-angle sum 360°, regular-polygon equality and interior/exterior supplements.","3.3":"Use parallelogram/trapezium/kite side, angle and diagonal properties; justify each relation.","3.4":"Classify special parallelograms by definitions and guaranteed diagonal/angle properties."},
    "answerAudit": [
      {"exercise":"3.1","sourceQuestionCount":2,"attachedAnswers":"1. (a) 1, 2, 5, 6, 7 (b) 1, 2, 5, 6, 7 (c) 1, 2 (d) 2 (e) 1 2. A polygon with equal sides and equal angles. (i) Equilateral triangle (ii) Square (iii) Regular hexagon","status":"confirmed","note":"Attached answer-key entry checked against the corresponding source exercise and method."},
      {"exercise":"3.2","sourceQuestionCount":6,"attachedAnswers":"1. (a) 360° – 250° = 110° (b) 360° – 310° = 50° 2. (i) 360/9° = 40° (ii) 360/15° = 24° 3. 360/24 = 15 sides 4. Number of sides = 24 5. (a) No; 22 is not a divisor of 360 (b) No; exterior angle 158° is not a divisor of 360°. 6. (a) 60° (b) 120°.","status":"confirmed","note":"Attached answer-key entry checked against the corresponding source exercise and method."},
      {"exercise":"3.3","sourceQuestionCount":12,"attachedAnswers":"1. BC; ∠DAB; OA; 180°. 2. (i) x=80°, y=100°, z=80° (ii) 130°,130°,130° (iii) 90°,60°,60° (iv) 100°,80°,80° (v) y=112°, x=z=28°. 3. Can be but need not be; then two 'No' cases justified by parallelogram properties. 4. Kite. 5. 108°,72°. 6. Each right angle. 7. 110°,40°,30°. 8. (i) x=6,y=9 (ii) x=3,y=13. 9. 50°. 10. NM∥KL, hence trapezium. 11. 60°. 12. ∠P=50°, ∠S=90°.","status":"confirmed","note":"Attached answer-key entry checked against the corresponding source exercise and method."},
      {"exercise":"3.4","sourceQuestionCount":6,"attachedAnswers":"1. (b),(c),(f),(g),(h) true; others false. 2. (a) Rhombus, square (b) Square, rectangle. 3. Square is a quadrilateral, parallelogram, rhombus and rectangle for the stated defining reasons. 4. (i) Parallelogram, rhombus, square, rectangle (ii) Rhombus, square (iii) Square, rectangle. 5. Both diagonals lie in its interior. 6. AD∥BC and AB∥DC; O is midpoint of AC.","status":"confirmed","note":"Attached answer-key entry checked against the corresponding source exercise and method."}
    ],
    "chapterNumber":3,"generatorId":"c8-quadrilaterals-ncert-mastery","covers":[{"gen":"c8-quadrilaterals-ncert-mastery","dp":[0],"diff":[1]},{"gen":"c8-quadrilaterals-ncert-mastery","dp":[1],"diff":[2]},{"gen":"c8-quadrilaterals-ncert-mastery","dp":[2],"diff":[3,4]}],"questionBank":{"generatorFamilies":1,"authoredCells":4,"productDotpoints":3,"sourceExerciseQuestions":26}
  },
  "c8-data-handling": {
    "id":"c8-data-handling","title":"Data Handling","pages":14,"exercises":["4.1","4.2"],
    "dotpoints":["Interpret and choose appropriate pictographs, bar graphs and double bar graphs for comparing data","Read and construct pie charts by converting frequencies or percentages into central angles","List equally likely outcomes and calculate probabilities of simple events and complements"],
    "sourceMap":[{"pages":"1–3","section":"4.1 Looking for Information","coverage":"Pictographs, bar graphs and double bar graphs; reading scales, comparing categories and choosing a suitable representation."},{"pages":"3–8","section":"4.2 Circle Graph or Pie Chart · Exercise 4.1","coverage":"Whole-part interpretation; fractions of a circle; central-angle conversion; construction from percentages/frequencies; worked family-expenditure and bakery examples."},{"pages":"9–13","section":"4.3 Chance and Probability · Exercise 4.2","coverage":"Random experiments, outcomes, equally likely outcomes, sample-space language, event counting and probability as favourable outcomes over total equally likely outcomes."},{"pages":"14","section":"Chapter close","coverage":"Source ending page audited."}],
    "notes":[{"title":"The graph type must match the question","level":"Data judgement","points":["Use a pictograph for small, visually simple counts when a symbol scale is clear.","Use a bar graph for category comparison and a double bar graph when two comparable data sets share the same categories.","Use a pie chart when the question is about parts of one whole.","Changing bar order does not change the data values, but scale, labels and category identity must remain unambiguous."],"edge":"Topper move: before calculating anything, state what the whole is and what each axis/sector represents."},{"title":"Pie charts are proportional reasoning in disguise","level":"Exact construction","points":["A full circle is 360° and represents the total.","Sector angle = part/whole × 360°.","For percentages, 1% corresponds to 3.6°.","After constructing sectors, their angles must total exactly 360°."],"formula":"Sector angle = (category frequency / total frequency) × 360°.","edge":"If several sector angles are awkward, simplify the fraction before multiplying by 360°."},{"title":"Probability begins with the sample space","level":"Topper probability","points":["A random experiment has outcomes that cannot be controlled in advance.","For equally likely outcomes, P(E)=number of favourable outcomes/total number of outcomes.","The complement satisfies P(not E)=1−P(E).","Probabilities lie between 0 and 1 inclusive."],"edge":"Never count favourable outcomes before writing or mentally fixing the complete sample space."},{"title":"Two-step experiments need ordered outcomes","level":"Sample-space discipline","points":["For two coin tosses, HT and TH are different ordered outcomes.","A product-style sample space prevents missing cases.","For a die, prime outcomes are 2,3,5; 'not prime' includes 1 as well as composites.","Complement questions are often faster than direct counting."],"edge":"Topper habit: check that all listed outcomes are mutually exclusive and collectively exhaustive."}],
    "examples":[{"title":"Pie-chart angle from frequency","prompt":"Out of 72 students, 40 speak Hindi. Find the Hindi sector angle.","steps":["The whole class is 72 students and corresponds to 360°.","Hindi fraction = 40/72 = 5/9.","Sector angle = (5/9)×360° = 200°."],"answer":"200°","topper":"Reduce 40/72 before multiplying; 360÷9=40 makes the arithmetic immediate."},{"title":"Probability of a die event","prompt":"A fair die is rolled. Find the probability of getting a prime number.","steps":["Sample space: {1,2,3,4,5,6}, so there are 6 equally likely outcomes.","Prime outcomes are {2,3,5}, giving 3 favourable outcomes.","P(prime)=3/6=1/2."],"answer":"1/2","topper":"Remember that 1 is neither prime nor composite."}],
    "exerciseMethods":{"4.1":"Read the chart scale/whole first; convert parts to frequencies, percentages or sector angles and verify totals.","4.2":"Write the sample space, identify favourable outcomes, form favourable/total and simplify; use complements when shorter."},
    "answerAudit":[{"exercise":"4.1","sourceQuestionCount":5,"attachedAnswers":"Q1: 200; Light music; Classical 100, Semi-classical 200, Light 400, Folk 300. Q2: Winter; Winter 150°, Rainy 120°, Summer 90°; pie chart as shown in the official key. Q3 and Q5 are graphical constructions in the key. Q4: Hindi; 30 marks; Yes.","status":"confirmed","note":"The answer key includes diagram-only pie-chart responses for construction items; those were checked against the source totals and sector data."},{"exercise":"4.2","sourceQuestionCount":6,"attachedAnswers":"1. Outcomes A,B,C,D; and HT,HH,TH,TT. 2. Die event sets: primes 2,3,5; non-primes 1,4,6; 6; and 1,2,3,4,5. 3. 1/5, 1/13, 4/7. 4. 1/10, 1/2, 2/5, 9/10. 5. 3/5 and 4/5. 6. 1/2,1/2,1/6,5/6.","status":"confirmed","note":"Attached answer-key entry checked against the corresponding source exercise and method."}],
    "chapterNumber":4,"generatorId":"c8-data-handling-ncert-mastery","covers":[{"gen":"c8-data-handling-ncert-mastery","dp":[0],"diff":[1]},{"gen":"c8-data-handling-ncert-mastery","dp":[1],"diff":[2]},{"gen":"c8-data-handling-ncert-mastery","dp":[2],"diff":[3,4]}],"questionBank":{"generatorFamilies":1,"authoredCells":4,"productDotpoints":3,"sourceExerciseQuestions":11}
  },
  "c8-squares-roots": {
    "id":"c8-squares-roots","title":"Squares and Square Roots","pages":20,"exercises":["5.1","5.2","5.3","5.4"],
    "dotpoints":["Recognise and exploit properties and patterns of perfect squares, including units digits, odd-number sums and Pythagorean patterns","Find square roots of perfect squares using prime factorisation and the long-division method","Find square roots of decimals and solve application problems by choosing the smallest suitable perfect square"],
    "sourceMap":[{"pages":"1–8","section":"5.1–5.3 Squares, properties and patterns · Exercise 5.1","coverage":"Perfect squares; impossible unit digits; parity and trailing-zero patterns; triangular-number and odd-number patterns; counts between consecutive squares."},{"pages":"9–10","section":"5.4 Finding squares · Exercise 5.2","coverage":"Algebraic shortcuts, nearby-base squaring and Pythagorean triplets."},{"pages":"10–14","section":"5.5 Square roots · Exercise 5.3","coverage":"Meaning of square root; repeated subtraction; prime-factorisation pairing; smallest multiplier/divisor to create perfect squares."},{"pages":"15–19","section":"5.5.4–5.6 Division method and decimals · Exercise 5.4","coverage":"Long-division square-root algorithm; decimal pairing; applications involving dimensions and equal arrangements."},{"pages":"20","section":"Chapter close","coverage":"End page audited."}],
    "notes":[{"title":"Units digits give fast impossibility tests, not full proofs","level":"Pattern control","points":["A perfect square can end only in 0,1,4,5,6 or 9.","Ending in 2,3,7 or 8 proves a number is not a perfect square.","The converse is false: ending in an allowed digit does not guarantee a square.","Squares of even numbers are even; squares of odd numbers are odd."],"edge":"Use the units-digit test to eliminate candidates instantly, then use factorisation or root methods for confirmation."},{"title":"The gap between consecutive squares is structured","level":"Number sense","points":["(n+1)²−n²=2n+1.","Therefore there are exactly 2n non-square integers strictly between n² and (n+1)².","The sum of the first n odd numbers is n².","These identities explain several NCERT pattern questions without brute force."],"formula":"1+3+5+⋯+(2n−1)=n².","edge":"Topper habit: convert pattern questions to identities before expanding large numbers."},{"title":"Prime factorisation makes perfect-square structure visible","level":"Exact root method","points":["In a perfect square, every prime exponent is even.","Pair equal prime factors; one factor from each pair contributes to the square root.","To make a number a perfect square, supply exactly the primes with odd exponents.","For a smallest divisor, remove the primes whose exponents are odd."],"edge":"Do not multiply by a whole repeated pair; only repair the parity of each prime exponent."},{"title":"Long division is a place-value algorithm","level":"Large and decimal roots","points":["Group digits in pairs from the decimal point outward.","Choose each root digit so the trial product does not exceed the current dividend.","Bring down the next pair and double the root obtained so far to build the next trial divisor.","For decimals, append pairs of zeros when more decimal places are needed."],"edge":"The digit-pairing rule is the reason square roots change place value one digit for every two digits in the number."}],
    "examples":[{"title":"Smallest multiplier for a perfect square","prompt":"What is the smallest number by which 180 must be multiplied to become a perfect square?","steps":["Prime factorise: 180=2²×3²×5.","The exponents of 2 and 3 are already even; the exponent of 5 is odd.","Multiply by 5 to obtain 2²×3²×5²=(30)²."],"answer":"5","topper":"Repair only odd prime exponents."},{"title":"Square root of a decimal","prompt":"Find √12.25.","steps":["Write 12.25 and group digits in pairs: 12 | 25.","The largest square ≤12 is 9, so the first root digit is 3; remainder 3.","Double 3 to get 6_. Choose 5 because 65×5=325, matching the brought-down 325.","Therefore √12.25=3.5."],"answer":"3.5","topper":"Digit pairing makes the decimal point in the root automatic."}],
    "exerciseMethods":{"5.1":"Use units-digit/parity/trailing-zero tests and square-number identities before calculating.","5.2":"Use efficient squaring identities and Pythagorean-triplet structure.","5.3":"Prime-factorise, pair equal factors and repair odd exponents for least multiplier/divisor questions.","5.4":"Use long division for roots, including decimals; translate area/arrangement contexts into a square-root calculation."},
    "answerAudit":[{"exercise":"5.1","sourceQuestionCount":9,"attachedAnswers":"Official key checked: Q1 units digits 1,4,1,9,6,9,4,0,6,5; Q2 endings 7,3,8,2,0,2,0,0; Q3 (i),(iii); Q4 10000200001 and 100000020000001; Q5 1020304030201 and 101010101²; Q6 20,6,42,43; Q7 25,100,144; Q8 odd-number sums through 13 and through 21; Q9 24,50,198.","status":"confirmed","note":"Attached answer-key entry checked against the corresponding source exercise and method."},{"exercise":"5.2","sourceQuestionCount":2,"attachedAnswers":"1. 1024,1225,7396,8649,5041,2116. 2. Pythagorean triples: 6,8,10; 14,48,50; 16,63,65; 18,80,82.","status":"confirmed","note":"Attached answer-key entry checked against the corresponding source exercise and method."},{"exercise":"5.3","sourceQuestionCount":10,"attachedAnswers":"Q1 possible unit digits 1/9, 4/6, 1/9, 5; Q2 (i),(ii),(iii); Q3 10,13; Q4 27,20,42,64,88,98,77,96,23,90; Q5 least multiplier/result pairs 7/42,5/30,7/84,3/78,2/54,3/48; Q6 least divisor/root pairs 7/6,13/15,11/6,5/23,7/20,5/18; Q7 49; Q8 45×45; Q9 900; Q10 3600.","status":"confirmed","note":"Attached answer-key entry checked against the corresponding source exercise and method."},{"exercise":"5.4","sourceQuestionCount":9,"attachedAnswers":"Q1 roots 48,67,59,23,57,37,76,89,24,32,56,30; Q2 1,2,2,3,3; Q3 1.6,2.7,7.2,6.5,5.6; Q4 2/20,53/44,1/57,41/28,31/63; Q5 4/23,14/42,4/16,24/43,149/81; Q6 21 m; Q7 10 cm and 12 cm; Q8 24 plants; Q9 16 children.","status":"confirmed","note":"Attached answer-key entry checked against the corresponding source exercise and method."}],
    "chapterNumber":5,"generatorId":"c8-squares-roots-ncert-mastery","covers":[{"gen":"c8-squares-roots-ncert-mastery","dp":[0],"diff":[1]},{"gen":"c8-squares-roots-ncert-mastery","dp":[1],"diff":[2]},{"gen":"c8-squares-roots-ncert-mastery","dp":[2],"diff":[3,4]}],"questionBank":{"generatorFamilies":1,"authoredCells":4,"productDotpoints":3,"sourceExerciseQuestions":30}
  },
  "c8-cubes-roots": {
    "id":"c8-cubes-roots","title":"Cubes and Cube Roots","pages":8,"exercises":["6.1","6.2"],
    "dotpoints":["Recognise perfect cubes and use cube patterns, units digits and prime-factor triplets","Determine the smallest multiplier or divisor needed to make a number a perfect cube","Find cube roots by prime factorisation and solve cube-based applications"],
    "sourceMap":[{"pages":"1–3","section":"6.1–6.2 Cubes and patterns","coverage":"Hardy–Ramanujan number 1729; perfect cubes; parity and units-digit behaviour; consecutive odd-number cube patterns; cube differences."},{"pages":"3–6","section":"Prime factors and perfect-cube adjustment · Exercise 6.1","coverage":"Prime factors occur in groups of three; identify perfect cubes; smallest multiplier/divisor for perfect cubes."},{"pages":"6–7","section":"6.3 Cube roots · Exercise 6.2","coverage":"Cube root as inverse of cubing; prime-factorisation method; application questions."},{"pages":"8","section":"Chapter close","coverage":"Source ending page audited."}],
    "notes":[{"title":"Perfect cubes are controlled by exponents modulo 3","level":"Prime-factor mastery","points":["A positive integer is a perfect cube exactly when every exponent in its prime factorisation is a multiple of 3.","Group equal prime factors in triples; one factor from each triple enters the cube root.","For the smallest multiplier, add the minimum missing copies needed to complete each triple.","For the smallest divisor, remove the incomplete remainder copies."],"edge":"Think in exponent remainders mod 3: remainder 1 needs two copies; remainder 2 needs one copy."},{"title":"Cube units digits are reversible","level":"Fast root recognition","points":["The last digit of a cube is uniquely determined by the last digit of the base.","Cubes ending 1,8,7,4,5,6,3,2,9,0 come from bases ending 1,2,3,4,5,6,7,8,9,0 respectively.","Unlike squares, this map is one-to-one on units digits.","This helps identify the units digit of a cube root quickly."],"edge":"Use the last digit to determine the root's last digit, then use magnitude or factorisation to determine the remaining digits."},{"title":"Cube roots scale in threes","level":"Magnitude sense","points":["If side length is multiplied by k, cube volume is multiplied by k³.","A cube of side 2 needs 8 unit cubes; side 3 needs 27 unit cubes.","Cube root reverses this scaling.","Perfect-cube recognition can often be done by bracketing between consecutive cubes."],"edge":"When an answer asks for a length from a volume, check units: cube root of cm³ is cm."},{"title":"1729 is a pattern example, not a memorisation trick","level":"Mathematical culture","points":["1729=12³+1³=10³+9³.","The chapter uses it to motivate looking for structure in cubes.","Pattern recognition should lead to verification: expand both representations and check equality.","The deeper habit is to test numerical claims rather than accept them because they look famous."],"edge":"Topper habit: when a pattern is stated, verify at least one nontrivial case algebraically or numerically."}],
    "examples":[{"title":"Smallest multiplier to make a cube","prompt":"Find the smallest number by which 72 must be multiplied to become a perfect cube.","steps":["72=2³×3².","The exponent of 2 is already a multiple of 3; the exponent of 3 is 2.","Multiply by one more 3: 72×3=2³×3³=6³."],"answer":"3","topper":"Use exponent remainders modulo 3."},{"title":"Cube root by prime factorisation","prompt":"Find ∛13824.","steps":["13824=2⁹×3³.","Group factors into triples: (2³)³×3³.","Take one factor from each triple group: 2³×3=8×3=24.","Check: 24³=13824."],"answer":"24","topper":"You can work with exponents directly once the prime factorisation is known."}],
    "exerciseMethods":{"6.1":"Prime-factorise and group exponents in triples; use parity/units-digit patterns only as quick filters.","6.2":"Reverse perfect cubes with prime-factor triples; in applications convert volume or counts into a cube-root statement."},
    "answerAudit":[{"exercise":"6.1","sourceQuestionCount":4,"attachedAnswers":"1. (ii),(iv). 2. 3,2,3,5,10. 3. 3,2,5,3,11. 4. 20 cuboids.","status":"confirmed","note":"Attached answer-key entry checked against the corresponding source exercise and method."},{"exercise":"6.2","sourceQuestionCount":2,"attachedAnswers":"1. 4,8,22,30,25,24,48,36,56. 2. False, True, False, False, False, False, True.","status":"confirmed","note":"Attached answer-key entry checked against the corresponding source exercise and method."}],
    "chapterNumber":6,"generatorId":"c8-cubes-roots-ncert-mastery","covers":[{"gen":"c8-cubes-roots-ncert-mastery","dp":[0],"diff":[1]},{"gen":"c8-cubes-roots-ncert-mastery","dp":[1],"diff":[2]},{"gen":"c8-cubes-roots-ncert-mastery","dp":[2],"diff":[3,4]}],"questionBank":{"generatorFamilies":1,"authoredCells":4,"productDotpoints":3,"sourceExerciseQuestions":6}
  },
  "c8-comparing-quantities": {
    "id":"c8-comparing-quantities","title":"Comparing Quantities","pages":14,"exercises":["7.1","7.2","7.3"],
    "dotpoints":["Use ratios and percentages to solve comparison, discount and reverse-percentage problems","Calculate sales tax/GST and estimate percentage changes using the correct base quantity","Calculate compound interest and compound growth/depreciation over repeated time periods"],
    "sourceMap":[{"pages":"1–3","section":"7.1 Ratios and percentages · Exercise 7.1","coverage":"Ratio-to-percentage conversion, finding a whole from a percentage, percentage of distance and population contexts."},{"pages":"4–5","section":"7.2 Discounts and estimation","coverage":"Marked price, sale price, discount amount/percentage, reverse discount and estimation strategies."},{"pages":"5–7","section":"7.3 Sales tax/VAT/GST · Exercise 7.2","coverage":"Tax on selling price, bill amount, GST context and percentage additions."},{"pages":"7–12","section":"7.4–7.6 Compound interest · Exercise 7.3","coverage":"Repeated percentage growth, amount versus interest, compound-interest formula, half-yearly/quarterly adaptation and depreciation/application problems."},{"pages":"13–14","section":"Chapter close","coverage":"Remaining discussion/summary pages audited."}],
    "notes":[{"title":"Percentages always have a base","level":"Topper percentage control","points":["Percentage = part/base ×100%.","Discount percentage uses marked price as the base, not sale price.","Tax percentage is applied to the taxable selling price and then added to form the bill amount.","Reverse-percentage questions require dividing by the remaining or growth factor, not subtracting the percentage from the final value."],"edge":"Before every percentage calculation, write the base quantity in words."},{"title":"Discount and tax are opposite-direction multipliers","level":"Commercial arithmetic","points":["A discount of d% multiplies marked price by (1−d/100).","A tax of t% multiplies taxable price by (1+t/100).","Successive percentage changes multiply; they do not generally add.","A 20% decrease followed by a 20% increase does not return to the original value."],"formula":"Sale price = MP(1−d/100); bill = taxable price(1+t/100).","edge":"Use multiplier form for reverse questions; it is shorter and less error-prone than reconstructing 100 parts every time."},{"title":"Compound interest is repeated growth","level":"Growth-factor mastery","points":["Simple interest adds the same amount each period; compound interest applies the rate to the updated amount.","For annual compounding, A=P(1+r/100)^n.","Compound interest itself is A−P.","For half-yearly compounding, halve the annual rate and double the number of periods."],"formula":"A=P(1+r/100)^n; CI=A−P.","edge":"Always distinguish amount from interest; many errors stop one line early at A."},{"title":"Estimation is controlled approximation","level":"Mental maths","points":["Round the base to a convenient nearby value, then split the percentage into easy pieces such as 10%+5%.","State that the result is approximate.","Use estimation to check whether an exact calculator-style result is plausible.","For exam work, exact arithmetic is still required when the question asks for an exact value."],"edge":"A fast estimate is a powerful final-answer sanity check, especially in tax and compound-growth problems."}],
    "examples":[{"title":"Reverse discount","prompt":"An item sells for ₹5,225 after a 5% discount. Find its marked price.","steps":["After a 5% discount, the sale price is 95% of marked price.","0.95×MP=5225.","MP=5225/0.95=5500."],"answer":"₹5,500","topper":"Reverse percentages divide by the multiplier 0.95."},{"title":"Compound interest","prompt":"₹8,000 is invested at 10% p.a. compounded annually for 2 years. Find the amount and compound interest.","steps":["Growth factor each year =1.10.","Amount A=8000(1.10)²=8000×1.21=9680.","Compound interest=9680−8000=1680."],"answer":"Amount ₹9,680; CI ₹1,680","topper":"Work with the growth factor, then subtract principal only at the end."}],
    "exerciseMethods":{"7.1":"Identify the correct base, convert ratio/fraction to percent and use unitary or multiplier reasoning for reverse questions.","7.2":"Apply discount/tax to the stated base and distinguish price before tax from final bill amount.","7.3":"Use repeated growth factors; adapt rate and number of periods for the stated compounding frequency."},
    "answerAudit":[{"exercise":"7.1","sourceQuestionCount":6,"attachedAnswers":"1. 1:2, 1:2000, 1:10. 2. 75%, 66 2/3%. 3. 28% students. 4. 25 matches. 5. ₹2400. 6. 10%; cricket 30 lakh, football 15 lakh, other games 5 lakh.","status":"confirmed","note":"Attached answer-key entry checked against the corresponding source exercise and method."},{"exercise":"7.2","sourceQuestionCount":5,"attachedAnswers":"₹2,835; ₹14,560; ₹2,000; ₹5,000; ₹1,050.","status":"confirmed","note":"Attached answer-key entry checked against the corresponding source exercise and method."},{"exercise":"7.3","sourceQuestionCount":3,"attachedAnswers":"1. About 48,980; 59,535. 2. 5,31,616 approximately. 3. ₹38,640.","status":"confirmed","note":"Attached answer-key entry checked against the corresponding source exercise and method."}],
    "chapterNumber":7,"generatorId":"c8-comparing-quantities-ncert-mastery","covers":[{"gen":"c8-comparing-quantities-ncert-mastery","dp":[0],"diff":[1]},{"gen":"c8-comparing-quantities-ncert-mastery","dp":[1],"diff":[2]},{"gen":"c8-comparing-quantities-ncert-mastery","dp":[2],"diff":[3,4]}],"questionBank":{"generatorFamilies":1,"authoredCells":4,"productDotpoints":3,"sourceExerciseQuestions":14}
  },
  "c8-algebraic-identities": {
    "id":"c8-algebraic-identities","title":"Algebraic Expressions and Identities","pages":10,"exercises":["8.1","8.2","8.3","8.4"],
    "dotpoints":["Add and subtract algebraic expressions by identifying like terms and controlling signs","Multiply monomials and multiply a monomial by a polynomial using coefficients, exponent laws and distributivity","Multiply polynomials term-by-term, combine like terms and simplify/evaluate the resulting expressions"],
    "sourceMap":[{"pages":"1–2","section":"8.1 Addition and subtraction · Exercise 8.1","coverage":"Like terms, alignment, additive inverses and sign control in polynomial addition/subtraction."},{"pages":"2–5","section":"8.2–8.3 Multiplication introduction and monomials · Exercise 8.2","coverage":"Area/product contexts; monomial×monomial and multiple-monomial products; coefficient multiplication and exponent laws."},{"pages":"6–8","section":"8.4 Monomial by polynomial · Exercise 8.3","coverage":"Distributive multiplication of monomial by binomial/trinomial; simplification and evaluation."},{"pages":"8–10","section":"8.5 Polynomial by polynomial · Exercise 8.4 · summary","coverage":"Binomial×binomial and binomial×trinomial term-by-term multiplication, collection of like terms and chapter summary."}],
    "notes":[{"title":"Like terms are a structural test, not a visual guess","level":"Algebra precision","points":["Terms are like only when their variable parts, including exponents, are identical.","Coefficients may differ and are the only parts added or subtracted.","xz and zx are the same variable product because multiplication is commutative.","When subtracting an expression, every term in the subtracted expression changes sign."],"edge":"Before combining, mentally strip coefficients and compare the remaining variable factors."},{"title":"Monomial multiplication separates coefficients and powers","level":"Exponent control","points":["Multiply numerical coefficients with their signs.","For the same base, add exponents: x^a×x^b=x^(a+b).","Different variables remain as separate factors.","The product of monomials is another monomial."],"edge":"Keep coefficient arithmetic and exponent arithmetic as two separate passes."},{"title":"Distributivity means every term multiplies every required term","level":"Expansion mastery","points":["For m(A+B+C), multiply m into all three terms.","For a binomial times a binomial, expect four raw products before like terms combine.","For a binomial times a trinomial, expect six raw products before simplification.","Missing one cross-product is the dominant expansion error."],"edge":"Use a small multiplication grid when expressions are long; it makes omission impossible."},{"title":"The uploaded 2024–25 chapter stops at polynomial multiplication","level":"Source fidelity","points":["Although the chapter title includes 'Identities', this uploaded excerpt's substantive sections cover expression arithmetic and multiplication through Section 8.5.","Pri Learning's source layer therefore does not invent identity sections that are absent from the supplied file.","The production chapter still teaches all algebraic content actually present in Exercises 8.1–8.4.","Future editions can add a separate identity layer only when present in the supplied source."],"edge":"Source fidelity outranks assumptions based on a chapter title."}],
    "examples":[{"title":"Subtracting an algebraic expression","prompt":"Subtract 5x²−4y²+6y−3 from 7x²−4xy+8y²+5x−3y.","steps":["Write the first expression, then add the additive inverse of the second.","Change every sign in the subtracted expression: −5x²+4y²−6y+3.","Combine like terms: (7−5)x²=2x², 8y²+4y²=12y², −3y−6y=−9y; carry −4xy and +5x.","Result: 2x²−4xy+12y²+5x−9y+3."],"answer":"2x²−4xy+12y²+5x−9y+3","topper":"The sign change happens to every term before any like-term combination."},{"title":"Binomial multiplication","prompt":"Expand (x−4)(2x+3).","steps":["Distribute x: x(2x+3)=2x²+3x.","Distribute −4: −4(2x+3)=−8x−12.","Combine like x-terms: 3x−8x=−5x.","Result: 2x²−5x−12."],"answer":"2x²−5x−12","topper":"Four raw products reduce to three terms because the middle two are like terms."}],
    "exerciseMethods":{"8.1":"Align like terms and treat subtraction as addition of the entire additive inverse.","8.2":"Multiply coefficients, then combine powers of identical variables.","8.3":"Distribute the monomial to every polynomial term before collecting like terms.","8.4":"Use full term-by-term multiplication; then combine like terms and evaluate only after simplification."},
    "answerAudit":[{"exercise":"8.1","sourceQuestionCount":2,"attachedAnswers":"Q1: 0; ab+bc+ac; −p²q²+4pq+9; 2(l²+m²+n²+lm+mn+nl). Q2: 8a−2ab+2b−15; 2xy−7yz+5zx+10xyz; p²q−7pq²+8pq−18q+5p+28.","status":"confirmed","note":"Attached answer-key entry checked against the corresponding source exercise and method."},{"exercise":"8.2","sourceQuestionCount":5,"attachedAnswers":"Q1 28p, −28p², −28p²q, −12p⁴, 0. Q2 pq; 50mn; 100x²y²; 12x³; 12mn²p. Q3 multiplication table as printed. Q4 105a⁷,64pqr,4x⁴y⁴,6abc. Q5 x²y²z²,−a⁶,1024/y⁶,36a²b²c²,−m³n²p.","status":"confirmed","note":"Attached answer-key entry checked against the corresponding source exercise and method."},{"exercise":"8.3","sourceQuestionCount":5,"attachedAnswers":"Official key checked for all five groups: monomial×polynomial products; completed table; chained products; simplification/evaluation; addition/subtraction of expanded expressions.","status":"confirmed","note":"Attached answer-key entry checked against the corresponding source exercise and method."},{"exercise":"8.4","sourceQuestionCount":3,"attachedAnswers":"Q1 six binomial products including 8x²+14x−15 and 3y²−28y+32. Q2 four polynomial products. Q3 eight simplifications including x³+5x²−5x, 4ac, x³+y³ and a²+b²−c²+2ab.","status":"confirmed","note":"Attached answer-key entry checked against the corresponding source exercise and method."}],
    "chapterNumber":8,"generatorId":"c8-algebraic-identities-ncert-mastery","covers":[{"gen":"c8-algebraic-identities-ncert-mastery","dp":[0],"diff":[1]},{"gen":"c8-algebraic-identities-ncert-mastery","dp":[1],"diff":[2]},{"gen":"c8-algebraic-identities-ncert-mastery","dp":[2],"diff":[3,4]}],"questionBank":{"generatorFamilies":1,"authoredCells":4,"productDotpoints":3,"sourceExerciseQuestions":15}
  },
  "c8-mensuration": {
    "id":"c8-mensuration","title":"Mensuration","pages":18,"exercises":["9.1","9.2","9.3"],
    "dotpoints":["Find areas of trapeziums, rhombuses, quadrilaterals and polygons by decomposition","Find total/lateral/curved surface areas of cuboids, cubes and right circular cylinders","Find volumes and capacities of cuboids, cubes and cylinders and solve unit-conversion applications"],
    "sourceMap":[{"pages":"1–4","section":"9.1–9.2 Area of a polygon · Exercise 9.1","coverage":"Polygon decomposition; trapezium and rhombus formulas; quadrilateral area from a diagonal and perpendiculars; practical field/frame problems."},{"pages":"4–12","section":"9.3–9.4 Solid shapes and surface area · Exercise 9.2","coverage":"Faces/nets; right circular cylinder; TSA/LSA/CSA of cuboid, cube and cylinder; practical painting/packing problems."},{"pages":"13–17","section":"9.5–9.6 Volume and capacity · Exercise 9.3","coverage":"Volume of cuboid/cube/cylinder; capacity conversions and rate/time applications."},{"pages":"18","section":"What Have We Discussed?","coverage":"Formula summary and conceptual distinctions audited."}],
    "notes":[{"title":"Decomposition turns unfamiliar polygons into familiar areas","level":"Geometry modelling","points":["Choose diagonals/perpendiculars that split the polygon into triangles, rectangles or trapeziums.","Area is additive across non-overlapping pieces.","For a trapezium, area=½h(a+b), where a and b are parallel sides.","For a rhombus, area=½d1d2."],"edge":"A good decomposition minimises unknown lengths; choose the diagonal for which perpendicular heights are given."},{"title":"Surface area and volume answer different questions","level":"Dimensional reasoning","points":["Surface area measures covering and uses square units.","Volume measures occupied space and uses cubic units.","Cuboid TSA=2(lb+bh+hl); LSA=2h(l+b).","Cylinder CSA=2πrh and TSA=2πr(h+r)."],"edge":"Check the physical verb: paint/wrap/cover → area; fill/hold/capacity → volume."},{"title":"Volume formulas are base area × height","level":"Unifying structure","points":["Cuboid volume=lbh.","Cube volume=a³.","Cylinder volume=πr²h.","This common structure helps derive rather than memorise formulas."],"formula":"Volume = area of base × perpendicular height.","edge":"Radius, not diameter, belongs in πr²h."},{"title":"Capacity demands disciplined unit conversion","level":"Application mastery","points":["1 cm³=1 mL and 1000 cm³=1 L.","1 m³=1000 L.","Convert all lengths to one unit before applying a volume formula.","Convert the final cubic unit to litres only after the geometry is complete."],"edge":"Length conversion factors cube in volume: 1 m=100 cm implies 1 m³=1,000,000 cm³."}],
    "examples":[{"title":"Area of a trapezium","prompt":"A trapezium has parallel sides 20 m and b m, height 15 m, and area 480 m². Find b.","steps":["Use A=½h(a+b).","480=½×15×(20+b).","Multiply by 2 and divide by 15: 64=20+b.","Therefore b=44 m."],"answer":"44 m","topper":"Solve the formula algebraically before substituting if several lengths are unknown."},{"title":"Cylinder capacity","prompt":"A cylinder has radius 7 cm and height 20 cm. Find its volume using π=22/7.","steps":["Base area=πr²=(22/7)×49=154 cm².","Volume=base area×height=154×20=3080 cm³.","Since 1000 cm³=1 L, capacity=3.08 L."],"answer":"3080 cm³ = 3.08 L","topper":"Keep geometric units until the final capacity conversion."}],
    "exerciseMethods":{"9.1":"Draw/identify a useful decomposition, calculate each standard piece and add; keep units squared.","9.2":"Decide whether curved/lateral or total surface is exposed before choosing a formula.","9.3":"Use base-area×height, then convert cubic units to capacity units only at the end."},
    "answerAudit":[{"exercise":"9.1","sourceQuestionCount":11,"attachedAnswers":"0.88 m²; 7 cm; 660 m²; 252 m²; 45 cm²; 24 cm² and 6 cm; ₹810; 140 m; 119 m²; 337.5 m² by both requested decompositions; frame sections 80,96,80,96 cm².","status":"confirmed","note":"Attached answer-key entry checked against the corresponding source exercise and method."},{"exercise":"9.2","sourceQuestionCount":10,"attachedAnswers":"Q1 graphical label; then 144 m; 10 cm; 11 m²; 5 cans; comparison of cylinder/cube with same height and larger cube lateral area; 440 m²; 322 cm; 1980 m²; 704 cm².","status":"confirmed","note":"Attached answer-key entry checked against the corresponding source exercise and method."},{"exercise":"9.3","sourceQuestionCount":8,"attachedAnswers":"1. Volume; Surface area; Volume. 2. Cylinder B has greater volume and surface area. 3. 5 cm. 4. 450. 5. 1 m. 6. 49500 L. 7. 4 times and 8 times. 8. 30 hours.","status":"confirmed","note":"Attached answer-key entry checked against the corresponding source exercise and method."}],
    "chapterNumber":9,"generatorId":"c8-mensuration-ncert-mastery","covers":[{"gen":"c8-mensuration-ncert-mastery","dp":[0],"diff":[1,4]},{"gen":"c8-mensuration-ncert-mastery","dp":[1],"diff":[2]},{"gen":"c8-mensuration-ncert-mastery","dp":[2],"diff":[3]}],"questionBank":{"generatorFamilies":1,"authoredCells":4,"productDotpoints":3,"sourceExerciseQuestions":29}
  },
  "c8-exponents": {
    "id":"c8-exponents","title":"Exponents and Powers","pages":8,"exercises":["10.1","10.2"],
    "dotpoints":["Interpret negative integer exponents and simplify expressions using the laws of exponents","Write very small and very large numbers in standard scientific notation","Compare and calculate with quantities in standard form while tracking powers of ten"],
    "sourceMap":[{"pages":"1–2","section":"10.1–10.2 Negative exponents","coverage":"Pattern extension from positive powers to zero and negative exponents; reciprocal meaning; decimal expanded form using negative powers of ten."},{"pages":"3–5","section":"10.3 Laws of exponents · Exercise 10.1","coverage":"Product, quotient, power-of-a-power, product/quotient powers and zero exponent for integer exponents; simplification examples."},{"pages":"6–8","section":"10.4 Standard form · Exercise 10.2","coverage":"Scientific notation for very small/large quantities; converting both ways; comparisons and contextual scale."}],
    "notes":[{"title":"A negative exponent is a reciprocal instruction","level":"Exponent meaning","points":["For nonzero a, a^(−m)=1/a^m.","The minus sign belongs to the exponent; it does not make the base negative.","a^0=1 for nonzero a.","This definition preserves the ordinary exponent laws across all integer exponents."],"edge":"Rewrite negative powers as reciprocals only when it makes the next step clearer; often combining exponents first is faster."},{"title":"Exponent laws are structure-preserving shortcuts","level":"Law selection","points":["Same base multiplication: add exponents.","Same base division: subtract exponents.","Power of a power: multiply exponents.","Same exponent across a product or quotient can be factored onto the whole product/quotient."],"edge":"Never add exponents when the bases differ unless a valid common-base rewrite has been made first."},{"title":"Scientific notation normalises magnitude","level":"Standard form","points":["Standard form is a×10^n with 1≤|a|<10.","Moving the decimal left gives a positive exponent; moving it right gives a negative exponent.","The exponent records the number of places moved.","Normalise after multiplying or dividing if the coefficient leaves the [1,10) range."],"edge":"A coefficient like 31.8×10^9 is not yet standard form; rewrite as 3.18×10^10."},{"title":"Compare powers of ten before coefficients","level":"Scale reasoning","points":["For positive standard-form numbers, the larger exponent usually decides the larger number immediately.","Only when exponents are equal do coefficients decide.","In products, add powers of ten; in quotients, subtract them.","Keep units attached when comparing physical quantities."],"edge":"Magnitude errors of a factor of ten usually come from forgetting to renormalise the coefficient."}],
    "examples":[{"title":"Simplify with negative exponents","prompt":"Simplify (−4)^5×(−4)^−10.","steps":["The base is the same, so add exponents: 5+(−10)=−5.","Thus the expression is (−4)^−5.","Use the reciprocal definition: 1/(−4)^5=−1/1024."],"answer":"−1/1024","topper":"Combine same-base powers before expanding numbers."},{"title":"Write in standard form","prompt":"Write 0.000000837 in standard form.","steps":["Move the decimal 7 places right to obtain 8.37.","Moving right corresponds to a negative power of ten.","Therefore 0.000000837=8.37×10^−7."],"answer":"8.37×10^−7","topper":"Count places from the original decimal point to the new one immediately after the first nonzero digit."}],
    "exerciseMethods":{"10.1":"Choose the exponent law that matches the structure, combine powers symbolically, then evaluate only if required.","10.2":"Move the decimal to make a coefficient between 1 and 10, record the movement as a power of ten and renormalise after operations."},
    "answerAudit":[{"exercise":"10.1","sourceQuestionCount":7,"attachedAnswers":"Key checked: Q1 1/9,1/16,32; Q2 reciprocal/exponential forms; Q3 5,1/2,29,1,81/16; Q4 250,1/60; Q5 m=2; Q6 −1 and 512/125; Q7 the two printed simplified forms.","status":"confirmed","note":"Attached answer-key entry checked against the corresponding source exercise and method."},{"exercise":"10.2","sourceQuestionCount":4,"attachedAnswers":"Q1 8.5×10^−12, 9.42×10^−12, 6.02×10^15, 8.37×10^−9, 3.186×10^10. Q2 decimal expansions 0.00000302,45000,0.00000003,1000100000,5800000000000,3614920. Q3 1×10^−6,1.6×10^−19,5×10^−7,1.275×10^−5,7×10^−2. Q4 1.0008×10².","status":"confirmed","note":"Attached answer-key entry checked against the corresponding source exercise and method."}],
    "chapterNumber":10,"generatorId":"c8-exponents-ncert-mastery","covers":[{"gen":"c8-exponents-ncert-mastery","dp":[0],"diff":[1,2]},{"gen":"c8-exponents-ncert-mastery","dp":[1],"diff":[3]},{"gen":"c8-exponents-ncert-mastery","dp":[2],"diff":[4]}],"questionBank":{"generatorFamilies":1,"authoredCells":4,"productDotpoints":3,"sourceExerciseQuestions":11}
  },
  "c8-proportions": {
    "id":"c8-proportions","title":"Direct and Inverse Proportions","pages":16,"exercises":["11.1","11.2"],
    "dotpoints":["Recognise direct proportion by a constant ratio and solve direct-proportion tables and applications","Recognise inverse proportion by a constant product and solve inverse-proportion tables and applications","Model time, work, speed and sharing situations by first deciding whether the relationship is direct, inverse or neither"],
    "sourceMap":[{"pages":"1–8","section":"11.1–11.2 Direct proportion · Exercise 11.1","coverage":"Constant-ratio criterion; tables; clock angle, cost, shadow, mass/sheet and map-scale applications; warning that two quantities increasing together need not be proportional."},{"pages":"9–13","section":"11.3 Inverse proportion · Exercise 11.2","coverage":"Constant-product criterion; workers/time, speed/time, winners/prize, machines/output and similar inverse contexts."},{"pages":"14–16","section":"Chapter close","coverage":"Remaining exercises/discussion and ending pages audited."}],
    "notes":[{"title":"Direct proportion means a constant ratio, not merely 'both increase'","level":"Model selection","points":["x and y are directly proportional when y/x is constant, equivalently y=kx.","Doubling x then doubles y; multiplying x by any factor multiplies y by the same factor.","Human height and age may both increase without a constant ratio, so they are not automatically directly proportional.","Cross-multiplication is a consequence of equal ratios, not the definition."],"edge":"Before solving, test the invariant: ratio constant for direct proportion."},{"title":"Inverse proportion means a constant product","level":"Model selection","points":["x and y are inversely proportional when xy=k.","If x doubles, y halves so the product remains unchanged.","For fixed work, workers×time is constant under equal productivity.","For fixed distance, speed×time is constant."],"edge":"The phrase 'more–less' suggests inverse proportion but does not prove it; confirm the product invariant."},{"title":"Unitary method and proportion equations are the same logic","level":"Method flexibility","points":["Unitary method finds the value for one unit and scales.","Ratio equations compare two known/unknown states directly.","Choose the method that produces the clearest arithmetic.","Keep units consistent before setting equal ratios or products."],"edge":"A correct proportion with inconsistent units can still produce a numerically wrong answer."},{"title":"Classification is the highest-value step","level":"Topper workflow","points":["Ask what is held fixed: total work, total distance, unit price, recipe ratio, etc.","Predict direction: should the unknown increase or decrease?","Choose constant ratio, constant product, or neither.","After calculation, compare the result with the prediction."],"edge":"A direction sanity check catches the classic mistake of treating inverse proportion as direct."}],
    "examples":[{"title":"Direct proportion","prompt":"5 m of cloth costs ₹210. What is the cost of 13 m?","steps":["Cost per metre is constant, so cost is directly proportional to length.","₹210/5=₹42 per metre.","For 13 m: 13×42=₹546."],"answer":"₹546","topper":"The constant of proportionality is the unit rate ₹42/m."},{"title":"Inverse proportion","prompt":"12 workers finish a job in 15 days. How long would 20 equally efficient workers take?","steps":["For fixed work, workers×days is constant.","12×15=20×d.","d=180/20=9 days."],"answer":"9 days","topper":"More workers must mean fewer days; the direction check confirms the inverse model."}],
    "exerciseMethods":{"11.1":"Verify a constant ratio, set equal ratios or use a unit rate, and check that the unknown changes in the same direction.","11.2":"Verify a constant product, equate products for the two situations, and check that the unknown changes in the opposite direction."},
    "answerAudit":[{"exercise":"11.1","sourceQuestionCount":10,"attachedAnswers":"1 No. 2 pigment/base table 1/8,4/32,7/56,12/96,20/160. 3 24 parts. 4 700 bottles. 5 10^−4 cm; 2 cm. 6 21 m. 7 2.25×10^7 and 5.4×10^6 crystals. 8 4 cm. 9 6 m; 8 m 75 cm. 10 168 km.","status":"confirmed","note":"Attached answer-key entry checked against the corresponding source exercise and method."},{"exercise":"11.2","sourceQuestionCount":11,"attachedAnswers":"1 (i),(iv),(v). 2 winner table 4→25000,5→20000,8→12500,10→10000,20→5000; inverse. 3 angle table 8→45°,10→36°,12→30°; yes;24°;9. 4 6. 5 4. 6 3 days. 7 15 boxes. 8 49 machines. 9 11½ hours. 10 6 days;6 persons. 11 40 minutes.","status":"confirmed","note":"Attached answer-key entry checked against the corresponding source exercise and method."}],
    "chapterNumber":11,"generatorId":"c8-proportions-ncert-mastery","covers":[{"gen":"c8-proportions-ncert-mastery","dp":[0],"diff":[1]},{"gen":"c8-proportions-ncert-mastery","dp":[1],"diff":[2]},{"gen":"c8-proportions-ncert-mastery","dp":[2],"diff":[3,4]}],"questionBank":{"generatorFamilies":1,"authoredCells":4,"productDotpoints":3,"sourceExerciseQuestions":21}
  },
  "c8-factorisation": {
    "id":"c8-factorisation","title":"Factorisation","pages":12,"exercises":["12.1","12.2","12.3"],
    "dotpoints":["Factorise algebraic expressions by taking common factors and by regrouping terms","Factorise using standard algebraic identities and recognise factor patterns such as x²+(a+b)x+ab","Divide algebraic expressions by monomials and factorised polynomials, simplifying only after valid cancellation"],
    "sourceMap":[{"pages":"1–4","section":"12.1–12.2.2 Common factors and regrouping · Exercise 12.1","coverage":"Factors/irreducible factors; factorisation as reverse distributivity; HCF extraction and regrouping."},{"pages":"5–7","section":"12.2.3–12.2.4 Identity/pattern factorisation · Exercise 12.2","coverage":"Difference of squares and square identities; four-term patterns; factors of x²+(a+b)x+ab."},{"pages":"8–11","section":"12.3–12.4 Division · Exercise 12.3","coverage":"Monomial division, polynomial by monomial, polynomial by factorised expression and cancellation after factorisation."},{"pages":"11–12","section":"What Have We Discussed? · Notes","coverage":"Chapter summary and blank notes page audited."}],
    "notes":[{"title":"Factorisation is reverse distributivity","level":"Structural algebra","points":["Expansion turns products into sums; factorisation reconstructs a product.","Always look for a common numerical/variable factor before trying a more elaborate pattern.","The greatest useful common factor usually gives the cleanest factorisation.","A factor form is valuable because zeros, cancellation and structure become visible."],"edge":"Expand your final factors mentally or on paper to verify the original expression exactly."},{"title":"Regrouping manufactures a common binomial","level":"Pattern recognition","points":["When no factor is common to every term, pair terms strategically.","Factor each pair; successful grouping produces the same binomial factor in both groups.","Reorder terms if needed—addition permits regrouping without changing the expression.","Then factor the repeated binomial."],"edge":"If the two grouped binomials differ only by a sign, factor −1 from one group."},{"title":"Identities are factor templates","level":"Fast factorisation","points":["a²−b²=(a−b)(a+b).","a²±2ab+b²=(a±b)².","For x²+(a+b)x+ab, seek two numbers whose sum is the x coefficient and product is the constant.","Recognise the template before expanding anything."],"edge":"Check both sum and product; matching only one condition gives a false factorisation."},{"title":"Cancellation happens between factors, not terms","level":"Division safety","points":["Factor numerator and denominator first where possible.","A common factor multiplying the entire numerator and denominator may cancel.","You cannot cancel a term across addition or subtraction.","After division, expand only if the requested answer format requires it."],"edge":"The expression (x+2)/x does not allow cancelling the x inside x+2."}],
    "examples":[{"title":"Factorise by regrouping","prompt":"Factorise 6xy−4y+6−9x.","steps":["Group as (6xy−4y)+(−9x+6).","Factor each group: 2y(3x−2)−3(3x−2).","The common binomial is (3x−2).","Factor it: (3x−2)(2y−3)."],"answer":"(3x−2)(2y−3)","topper":"Reordering the last two terms exposes the shared binomial."},{"title":"Difference of squares","prompt":"Factorise 49x²−36.","steps":["Recognise 49x²=(7x)² and 36=6².","Use a²−b²=(a−b)(a+b).","Therefore 49x²−36=(7x−6)(7x+6)."],"answer":"(7x−6)(7x+6)","topper":"Pattern recognition avoids unnecessary middle-term methods."}],
    "exerciseMethods":{"12.1":"Take the greatest common factor first; if none exists across all terms, regroup to create a repeated binomial.","12.2":"Match difference-of-squares/perfect-square/general quadratic factor patterns and verify by expansion.","12.3":"Factor before division, cancel only whole common factors and state the simplified quotient."},
    "answerAudit":[{"exercise":"12.1","sourceQuestionCount":3,"attachedAnswers":"Q1 common factors 12,2y,14pq,1,6ab,4x,10,x²y². Q2 ten factorisations beginning 7(x−6),6(p−2q),7a(a+2)… Q3 five regrouping factorisations including (x+8)(x+y), (3x+1)(5y−2), (a+b)(x−y), (5p+3)(3q+5), (z−7)(1−xy).","status":"confirmed","note":"Attached answer-key entry checked against the corresponding source exercise and method."},{"exercise":"12.2","sourceQuestionCount":5,"attachedAnswers":"All attached identity/pattern factorisations checked: perfect-square forms in Q1; difference-of-squares products in Q2; common-factor/regrouping forms Q3; higher differences of powers Q4; quadratic factor pairs Q5.","status":"confirmed","note":"Attached answer-key entry checked against the corresponding source exercise and method."},{"exercise":"12.3","sourceQuestionCount":5,"attachedAnswers":"All attached algebraic division results checked, including monomial quotients, polynomial-by-monomial quotients and factorised cancellations through the seven parts of Q5.","status":"confirmed","note":"Attached answer-key entry checked against the corresponding source exercise and method."}],
    "chapterNumber":12,"generatorId":"c8-factorisation-ncert-mastery","covers":[{"gen":"c8-factorisation-ncert-mastery","dp":[0],"diff":[1]},{"gen":"c8-factorisation-ncert-mastery","dp":[1],"diff":[2,4]},{"gen":"c8-factorisation-ncert-mastery","dp":[2],"diff":[3]}],"questionBank":{"generatorFamilies":1,"authoredCells":4,"productDotpoints":3,"sourceExerciseQuestions":13}
  },
  "c8-graphs": {
    "id":"c8-graphs","title":"Introduction to Graphs","pages":14,"exercises":["13.1","13.2"],
    "dotpoints":["Read and interpret line graphs, including scales, trends, intersections and interpolation between plotted observations","Plot ordered pairs and draw graphs from tabulated relationships using correctly labelled axes and scales","Interpret contextual graphs such as distance–time and quantity–cost graphs, identifying independent/dependent variables, stops and changing rates"],
    "sourceMap":[{"pages":"1–7","section":"13.1 Line graphs · Exercise 13.1","coverage":"Line graphs from tables; axes/scales; temperature, sports performance, travel, plant growth and forecast-vs-actual interpretation; graph construction."},{"pages":"8–12","section":"13.2 Some Applications · Exercise 13.2","coverage":"Independent/dependent variables; quantity-cost and distance-time style relationships; plotting and reading practical linear relationships."},{"pages":"13–14","section":"What Have We Discussed? · Notes","coverage":"Chapter summary and final notes page audited."}],
    "notes":[{"title":"Read axes and scale before reading points","level":"Graph literacy","points":["The x-axis usually carries the independent/input variable; the y-axis usually carries the dependent/output variable.","A grid square has no meaning until its scale is identified.","Read coordinates by projecting to both axes.","When two lines intersect, both quantities have the same plotted value at that x-coordinate."],"edge":"Most graph-reading errors are scale errors, not arithmetic errors."},{"title":"Slope describes rate of change qualitatively","level":"Trend reasoning","points":["An upward segment means the y-value increases as x increases; a downward segment means it decreases.","A horizontal segment means no change in y over that interval.","On a distance–time graph, a steeper segment represents greater speed.","A horizontal distance–time segment represents a stop."],"edge":"Do not call a line 'faster' because it is higher; speed is related to steepness, not vertical position."},{"title":"Interpolation is an estimate between known observations","level":"Evidence-aware reading","points":["A joined line can suggest an intermediate value between recorded points.","If the underlying quantity changes continuously, interpolation can be meaningful.","The graph does not prove an unmeasured value; it provides a visual estimate.","State approximation when the point is not explicitly recorded."],"edge":"Distinguish a plotted measurement from a value inferred between measurements."},{"title":"A graph is a model of a relationship","level":"Context mastery","points":["Quantity purchased can be independent while cost is dependent when unit price is fixed.","Different contexts may produce straight lines, horizontal intervals or changing slopes.","Plotting a table requires a sensible scale that uses the grid efficiently.","Labels, units and a consistent scale are part of the mathematical answer."],"edge":"A graph without labelled axes and units is incomplete even if the points are correct."}],
    "examples":[{"title":"Distance–time interpretation","prompt":"A car is 200 km from its start at both 11 a.m. and 12 noon. What does the horizontal graph segment mean?","steps":["At 11 a.m. the distance is 200 km.","At 12 noon the distance is still 200 km.","Distance did not change for one hour, so the car was stationary during that interval."],"answer":"The car stopped from 11 a.m. to 12 noon.","topper":"Horizontal means zero rate of change in the plotted dependent variable."},{"title":"Quantity–cost graph","prompt":"Petrol costs ₹50 per litre. Give two points on the cost-versus-litres graph and describe the relationship.","steps":["Let x be litres and y be cost, so y=50x.","For x=10, y=500, giving (10,500).","For x=20, y=1000, giving (20,1000).","The graph is a straight line through the origin because cost is directly proportional to litres."],"answer":"Example points (10,500), (20,1000); straight line y=50x.","topper":"State the variables and units before plotting."}],
    "exerciseMethods":{"13.1":"Identify axis labels/scales, read exact plotted points, compare trends/intersections and mark interpolated readings as estimates.","13.2":"Choose independent/dependent variables, convert the table/context into ordered pairs, plot with a consistent scale and interpret slope/horizontal segments in context."},
    "answerAudit":[{"exercise":"13.1","sourceQuestionCount":7,"attachedAnswers":"Q1 36.5°C; 12 noon; 1 p.m. and 2 p.m.; 36.5°C at 1:30 p.m.; rising 9–10,10–11,2–3. Q2 ₹4 crore,₹8 crore,₹7 crore,≈₹8.5 crore,difference ₹4 crore,2005. Q3 plant readings 7/9 cm and 7/10 cm; growth 2 cm,3 cm; weeks as key. Q4 Tue,Fri,Sun;35°C;15°C;Thu. Q5 is graph construction from supplied tables. Q6 scale 4 units=1 hour; 3½ hours;22 km; stop 10–10:30; fastest 8–9. Q7 only (iii) impossible.","status":"confirmed","note":"The source includes graph-drawing item Q5; correctness is governed by the source table/axes rather than a single textual key value."},{"exercise":"13.2","sourceQuestionCount":2,"attachedAnswers":"1. (b) 20 km and 7:30 a.m.; (c) Yes, ₹200, ₹3500. 2. (i) Yes (ii) No.","status":"confirmed","note":"Attached answer-key entry checked against the corresponding source exercise and method."}],
    "chapterNumber":13,"generatorId":"c8-graphs-ncert-mastery","covers":[{"gen":"c8-graphs-ncert-mastery","dp":[0],"diff":[2]},{"gen":"c8-graphs-ncert-mastery","dp":[1],"diff":[1]},{"gen":"c8-graphs-ncert-mastery","dp":[2],"diff":[3,4]}],"questionBank":{"generatorFamilies":1,"authoredCells":4,"productDotpoints":3,"sourceExerciseQuestions":9}
  }
};

export const NCERT_CLASS8_CHAPTERS_3_13 = freeze(Object.fromEntries(
  Object.entries(RAW_CHAPTERS).map(([id, chapter]) => [id, freeze({
    ...chapter,
    dotpoints: freeze(chapter.dotpoints),
    sourceMap: freeze(chapter.sourceMap.map(freeze)),
    notes: freeze(chapter.notes.map(note => freeze({ ...note, points: freeze(note.points) }))),
    examples: freeze(chapter.examples.map(example => freeze({ ...example, steps: freeze(example.steps) }))),
    answerAudit: freeze(chapter.answerAudit.map(freeze)),
    covers: freeze(chapter.covers.map(c => freeze({ ...c, dp: freeze(c.dp), diff: freeze(c.diff) }))),
    questionBank: freeze(chapter.questionBank)
  })])
));

export const NCERT_CLASS8_3_13_IDS = freeze(Object.keys(NCERT_CLASS8_CHAPTERS_3_13));
export const NCERT_CLASS8_3_13_GENERATOR_IDS = freeze(
  NCERT_CLASS8_3_13_IDS.map(id => NCERT_CLASS8_CHAPTERS_3_13[id].generatorId)
);
export const NCERT_CLASS8_3_13_DOTPOINTS_BY_ID = freeze(Object.fromEntries(
  NCERT_CLASS8_3_13_IDS.map(id => [id, NCERT_CLASS8_CHAPTERS_3_13[id].dotpoints])
));
export const NCERT_CLASS8_3_13_COVERS_BY_ID = freeze(Object.fromEntries(
  NCERT_CLASS8_3_13_IDS.map(id => [id, NCERT_CLASS8_CHAPTERS_3_13[id].covers])
));

export function ncertClass8Chapter(chapterId) {
  return NCERT_CLASS8_CHAPTERS_3_13[String(chapterId || '')] || null;
}

export const NCERT_CLASS8_3_13_RELEASE_AUDIT = freeze({
  chapterCount: 11,
  firstChapter: 3,
  lastChapter: 13,
  sourcePages: NCERT_CLASS8_3_13_IDS.reduce((sum, id) => sum + NCERT_CLASS8_CHAPTERS_3_13[id].pages, 0),
  exerciseCount: NCERT_CLASS8_3_13_IDS.reduce((sum, id) => sum + NCERT_CLASS8_CHAPTERS_3_13[id].exercises.length, 0),
  sourceExerciseQuestions: NCERT_CLASS8_3_13_IDS.reduce((sum, id) => sum + NCERT_CLASS8_CHAPTERS_3_13[id].questionBank.sourceExerciseQuestions, 0),
  authoredCells: NCERT_CLASS8_3_13_IDS.length * 4,
  answerStatus: 'Every attached exercise answer entry has been checked against the corresponding uploaded source exercise; graph/drawing-only answers are audited by their source data and construction requirements.',
  handwriting: 'All numeric generated forms use the existing production InkAnswer handwriting recognition, confidence, grading, retries and Pri Explain path.'
});
