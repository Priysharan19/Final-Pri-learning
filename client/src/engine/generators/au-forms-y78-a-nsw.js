// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Prithagoras capacity overlay · Year 7 slot A
// Extra structural forms for y7-decimals-perc, y7-fractions, y7-algebra,
// y7-area, y7-equations and y7-angles. Every key is computed from the numbers
// shown in the prompt; see au-forms-apply.js for how variants are mixed in.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, rs, nz, gcd, Frac, mcq, term, sgn, moneyPlain, r1, r2, NAMES } from '../qhelpers.js';

const SHOP = ['a surfboard leash', 'a cricket bat', 'netball shoes', 'a school backpack', 'a footy boot bag', 'a bike helmet', 'a beach umbrella', 'a camping stove'];
const PLACES = ['Bondi', 'Parramatta', 'Newcastle', 'Wollongong', 'Penrith', 'Manly', 'Dubbo', 'Coffs Harbour'];
const pl = (v, one, many) => (v === 1 ? one : many);   // singular when the number shown is exactly 1
const art = w => (/^[AEIOU]/.test(w) ? 'An ' : 'A ') + w;
// A whole number then a fraction ("8 1/2", "8\\frac{1}{2}"): a mixed number, not an improper fraction.
const MIXED_FORM = '^[+-]?\\d+(\\s+\\d+\\s*/\\s*\\d+|\\s*\\\\d?frac\\s*\\{\\d+\\}\\s*\\{\\d+\\})$';
const SPORTS = ['netball', 'cricket', 'AFL', 'soccer', 'basketball', 'touch football'];
const pm = k => (k < 0 ? '-' : '+');            // sign glyph
const lin = (a, b, v = 'x') => `${term(a, v)} ${pm(b)} ${Math.abs(b)}`;   // a x ± b
const fracMixedOrLatex = f => (f.d === 1 ? String(f.n) : f.mixedLatex());

export const forms = {
  // ───────────────────────────── decimals & percentages ─────────────────────
  'y7-decimals-perc': [
    { // percentage discount → sale price
      make: rng => {
        const price = ri(rng, 8, 80) * 5, d = rc(rng, [10, 15, 20, 25, 30, 40, 60, 75]);
        const saving = price * d / 100, sale = price - saving;
        const item = rc(rng, SHOP);
        return {
          prompt: `The regular price of ${item} at a store in ${rc(rng, PLACES)} is ${moneyPlain(price)}. This week it is on sale for $${d}\\%$ off. What is the sale price?`,
          answerType: 'numeric', answer: { value: sale }, answerPrefix: '$',
          traps: [{ value: saving, why: `$${d}\\%$ of the price is the *saving*; the sale price is what is left after taking it off.` }],
          hints: [`First find $${d}\\%$ of ${moneyPlain(price)}.`, `$${d}\\% \\times ${price} = ${saving}$ is the discount.`, 'Subtract the discount from the original price.'],
          steps: [
            { h: 'Find the discount', d: `$${d}\\% \\times ${price} = ${saving}$` },
            { h: 'Subtract from the price', d: `$${price} - ${saving} = ${sale}$, so the sale price is ${moneyPlain(sale)}` }
          ]
        };
      }
    },
    { // reverse: sale price and % off → original price
      make: rng => {
        const d = rc(rng, [10, 20, 25, 40, 50]);
        const kUnit = 100 - d;
        const orig = ri(rng, 4, 60) * 20, sale = orig * kUnit / 100;
        return {
          prompt: `After a $${d}\\%$ discount, a pair of runners costs ${moneyPlain(sale)}. What was the original price?`,
          answerType: 'numeric', answer: { value: orig }, answerPrefix: '$',
          traps: [{ value: sale * (100 + d) / 100, why: `The sale price is $${kUnit}\\%$ of the original, so divide by $${kUnit / 100}$; adding $${d}\\%$ back on to the sale price does not undo the discount.` }],
          hints: ['The sale price is a percentage of the original, not the whole.', `Paying $${kUnit}\\%$ of the original means $${kUnit}\\% = ${sale}$.`, `1% is $${sale} \\div ${kUnit}$; multiply by 100.`],
          steps: [
            { h: 'What percentage was paid?', d: `$100\\% - ${d}\\% = ${kUnit}\\%$` },
            { h: 'Find 1%', d: `$${sale} \\div ${kUnit} = ${sale / kUnit}$` },
            { h: 'Scale to 100%', d: `$${sale / kUnit} \\times 100 = ${orig}$, so it was ${moneyPlain(orig)}` }
          ]
        };
      }
    },
    { // percentage increase
      make: rng => {
        const p = rc(rng, [5, 10, 12, 15, 20, 25, 30, 40, 50, 60]);
        const base = ri(rng, 2, 40) * (100 / gcd(100, p));  // keeps the new value whole
        const added = base * p / 100, now = base + added;
        const sport = rc(rng, SPORTS);
        return {
          prompt: `${art(sport)} club had $${base}$ members last year and $${now}$ this year. By what percentage did its membership increase?`,
          answerType: 'numeric', answer: { value: p, percent: true }, answerSuffix: '%',
          traps: [{ value: r1(100 * added / now), why: 'Percentage change is measured against the **original** (last year’s) number, not the new one.' }],
          hints: ['Find the increase first.', `Increase $= ${now} - ${base} = ${added}$.`, `Divide the increase by the original, $${added} \\div ${base}$, then multiply by 100.`],
          steps: [
            { h: 'Increase', d: `$${now} - ${base} = ${added}$` },
            { h: 'Compare with the original', d: `$\\dfrac{${added}}{${base}} \\times 100\\% = ${p}\\%$` }
          ]
        };
      }
    },
    { // order fractions / decimals / percentages
      make: rng => {
        const pool = rs(rng, Array.from({ length: 19 }, (_, i) => (i + 1) * 5)).slice(0, 4);  // percent values, all distinct
        const low = rc(rng, [true, false]);
        const render = p => {
          const kind = rc(rng, ['pct', 'dec', 'frac']);
          if (kind === 'pct') return `$${p}\\%$`;
          if (kind === 'dec') return `$${p / 100}$`;
          const g = gcd(p, 100);
          return `$\\dfrac{${p / g}}{${100 / g}}$`;
        };
        const sorted = [...pool].sort((a, b) => a - b);
        const keyV = low ? sorted[0] : sorted[3];
        const texts = new Map(pool.map(p => [p, render(p)]));
        const dist = pool.filter(p => p !== keyV).map(p => ({ text: texts.get(p), why: `That is ${p}% as a percentage, which is ${low ? 'bigger' : 'smaller'} than the value asked for — convert every option to percentages before comparing.` }));
        const m = mcq(rng, texts.get(keyV), dist);
        const dup = new Set(m.options).size !== m.options.length;
        if (dup) return null;
        return {
          prompt: `Which of these is the ${low ? 'smallest' : 'largest'} amount?`,
          answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
          hints: ['Write every option in the same form (percentages work well).', 'A decimal like $0.35$ is $35\\%$; a fraction is the top divided by the bottom.', `Pick the ${low ? 'smallest' : 'largest'} percentage.`],
          steps: [
            { h: 'Convert each to a percentage', d: pool.map(p => `${texts.get(p)} $= ${p}\\%$`).join(',\\ ') },
            { h: `Choose the ${low ? 'smallest' : 'largest'}`, d: `${texts.get(keyV)} $= ${keyV}\\%$` }
          ]
        };
      }
    },
    { // GST
      make: rng => {
        const price = ri(rng, 12, 950);
        if (price === 100) return null;
        const gst = r2(price / 10), total = r2(price + gst);
        const what = rc(rng, ['a pair of school shoes', 'a tennis racquet', 'a dinner at a restaurant', 'a pair of headphones', 'a kayak paddle']);
        return {
          prompt: `The price of ${what} is ${moneyPlain(price)} before GST. In Australia GST is $10\\%$ of the price and is added on top. What is the total price including GST?`,
          answerType: 'numeric', answer: { value: total }, answerPrefix: '$',
          traps: [{ value: price + 10, why: 'GST is $10\\%$ of the price (so it depends on the price), not a flat \\$10 added on.' }],
          hints: ['GST is $10\\%$ of the price before GST.', `$10\\%$ of ${price} is $${price} \\div 10 = ${gst}$.`, 'Add the GST to the price.'],
          steps: [
            { h: 'Find the GST', d: `$10\\% \\times ${price} = ${gst}$` },
            { h: 'Add it on', d: `$${price} + ${gst} = ${total}$, so the total is ${moneyPlain(total)}` }
          ]
        };
      }
    },
    { // decimal × decimal in a price-per-kilogram context
      make: rng => {
        const A = ri(rng, 25, 129), W = ri(rng, 12, 48);          // tenths
        const rate = A / 10, kg = W / 10, cost = r2(A * W / 100);
        if (Math.abs(r2(rate + kg) - cost) < 0.005) return null;
        const [food, verb] = rc(rng, [['mangoes', 'cost'], ['prawns', 'cost'], ['lamb cutlets', 'cost'], ['cherries', 'cost'], ['cheddar cheese', 'costs'], ['mince', 'costs']]);
        return {
          prompt: `${food[0].toUpperCase() + food.slice(1)} ${verb} ${moneyPlain(rate)} per kilogram at the market. Find the cost of $${kg}$ kg, in dollars.`,
          answerType: 'numeric', answer: { value: cost }, answerPrefix: '$',
          traps: [{ value: r2(rate + kg), why: 'The cost is the price per kilogram **times** the number of kilograms, not the sum.' }],
          hints: ['Cost = price per kilogram × number of kilograms.', `Compute $${rate} \\times ${kg}$.`, `Ignore the decimal points: $${A} \\times ${W} = ${A * W}$, then place the decimal point (two places in total).`],
          steps: [
            { h: 'Set up the product', d: `$${rate} \\times ${kg}$` },
            { h: 'Multiply without decimals', d: `$${A} \\times ${W} = ${A * W}$` },
            { h: 'Place the decimal point (2 decimal places)', d: `$= ${cost}$, so the cost is ${moneyPlain(cost)}` }
          ]
        };
      }
    },
    { // sharing a decimal amount
      make: rng => {
        const n = ri(rng, 3, 9), cents = ri(rng, 105, 1450);
        const each = cents / 100, total = r2(each * n);
        const name = rc(rng, NAMES);
        return {
          prompt: `${name} and friends spend ${moneyPlain(total)} on a ${rc(rng, PLACES)} beach picnic and share the cost equally between $${n}$ people. How much does each person pay?`,
          answerType: 'numeric', answer: { value: each }, answerPrefix: '$',
          traps: [{ value: r2(total * n), why: 'Sharing means **dividing** the total by the number of people.' }],
          hints: ['Equal sharing is division.', `Divide ${moneyPlain(total)} by $${n}$.`, `Check by multiplying back: $${n} \\times ${each}$.`],
          steps: [
            { h: 'Divide the total', d: `$${total} \\div ${n} = ${each}$` },
            { h: 'Check', d: `$${n} \\times ${each} = ${total}$ ✓` }
          ]
        };
      }
    },
    { // decimal ↔ percent by place value (word problem on a quiz)
      make: rng => {
        const n = ri(rng, 11, 98) * 2, tot = rc(rng, [50, 100, 200, 250, 400]);
        const v = n * 100 / tot;
        if (n >= tot) return null;
        const g = gcd(n, tot);
        return {
          prompt: `${art(rc(rng, SPORTS))} team won $${n}$ of its $${tot}$ matches over several seasons. What percentage of the matches did it win?`,
          answerType: 'numeric', answer: { value: v, percent: true }, answerSuffix: '%',
          traps: [{ value: r1(tot * 100 / n), why: 'Win percentage is wins ÷ matches, not matches ÷ wins.' }],
          hints: ['Write wins as a fraction of all matches.', `The fraction is $\\dfrac{${n}}{${tot}}$.`, 'Multiply by $100\\%$.'],
          steps: [
            { h: 'Fraction won', d: `$\\dfrac{${n}}{${tot}} = \\dfrac{${n / g}}{${tot / g}}$` },
            { h: 'As a percentage', d: `$\\dfrac{${n}}{${tot}} \\times 100\\% = ${v}\\%$` }
          ]
        };
      }
    }
  ].map(v => retry(v)),

  // ───────────────────────────── fractions ───────────────────────────────────
  'y7-fractions': [
    { // equivalent fractions, missing numerator or denominator
      make: rng => {
        const d = ri(rng, 3, 12), n = ri(rng, 1, d - 1), f = new Frac(n, d), k = ri(rng, 2, 12);
        const toD = rng() < 0.5;
        const N2 = f.n * k, D2 = f.d * k;
        return toD
          ? {
            prompt: `Find the missing number: $\\dfrac{${f.n}}{${f.d}} = \\dfrac{${N2}}{\\square}$`,
            answerType: 'numeric', answer: { value: D2 }, inputHint: 'a whole number',
            traps: [{ value: f.d + (N2 - f.n), why: 'Equivalent fractions are made by **multiplying** top and bottom by the same number, not by adding.' }],
            hints: ['Work out what the numerator was multiplied by.', `$${f.n} \\times ${k} = ${N2}$.`, `Do the same to the denominator: $${f.d} \\times ${k}$.`],
            steps: [{ h: 'Find the multiplier', d: `$${N2} \\div ${f.n} = ${k}$` }, { h: 'Apply to the denominator', d: `$${f.d} \\times ${k} = ${D2}$` }]
          }
          : {
            prompt: `Find the missing number: $\\dfrac{${f.n}}{${f.d}} = \\dfrac{\\square}{${D2}}$`,
            answerType: 'numeric', answer: { value: N2 }, inputHint: 'a whole number',
            traps: [{ value: f.n + (D2 - f.d), why: 'Equivalent fractions are made by **multiplying** top and bottom by the same number, not by adding.' }],
            hints: ['Work out what the denominator was multiplied by.', `$${f.d} \\times ${k} = ${D2}$.`, `Do the same to the numerator: $${f.n} \\times ${k}$.`],
            steps: [{ h: 'Find the multiplier', d: `$${D2} \\div ${f.d} = ${k}$` }, { h: 'Apply to the numerator', d: `$${f.n} \\times ${k} = ${N2}$` }]
          };
      }
    },
    { // fraction of a quantity
      make: rng => {
        const d = ri(rng, 3, 12), n = ri(rng, 2, d - 1);
        if (gcd(n, d) !== 1) return null;
        const k = ri(rng, 3, 60), total = d * k, part = n * k;
        const ctx = rc(rng, [`${art(rc(rng, SPORTS))} season has $${total}$ players registered. $${new Frac(n, d).latex()}$ of them are under 12. How many players are under 12?`,
          `A walking track near ${rc(rng, PLACES)} is $${total}$ metres long. Ruby has walked $${new Frac(n, d).latex()}$ of it. How many metres has she walked?`]);
        return {
          prompt: ctx,
          answerType: 'numeric', answer: { value: part },
          traps: [{ value: k, why: `$\\frac{1}{${d}}$ of the amount is only one share; you need ${n} of the ${d} equal shares.` }],
          hints: [`Divide by the denominator, ${d}, to get one equal share.`, `$${total} \\div ${d} = ${k}$ is one share.`, `Multiply by the numerator, ${n}.`],
          steps: [{ h: 'One share', d: `$${total} \\div ${d} = ${k}$` }, { h: `${n} shares`, d: `$${k} \\times ${n} = ${part}$` }]
        };
      }
    },
    { // reverse: part is given, find the whole
      make: rng => {
        const d = ri(rng, 3, 10), n = ri(rng, 2, d - 1);
        if (gcd(n, d) !== 1) return null;
        const k = ri(rng, 2, 40), total = d * k, part = n * k;
        return {
          prompt: `$${new Frac(n, d).latex()}$ of the seats in a stadium are filled. That is $${part}$ people. How many people can the stadium hold?`,
          answerType: 'numeric', answer: { value: total },
          traps: [{ value: part * n / d, why: `${part} people is already the ${n} shares; work back to the whole by finding one share, then taking all ${d} shares.` }],
          hints: [`${n} equal shares make ${part} people.`, `One share is $${part} \\div ${n} = ${k}$.`, `The whole is ${d} shares.`],
          steps: [{ h: 'One share', d: `$${part} \\div ${n} = ${k}$` }, { h: `All ${d} shares`, d: `$${k} \\times ${d} = ${total}$` }]
        };
      }
    },
    { // mixed → improper
      make: rng => {
        const w = ri(rng, 1, 12), d = ri(rng, 2, 12), r = ri(rng, 1, d - 1);
        if (gcd(r, d) !== 1) return null;
        const imp = w * d + r;
        return {
          prompt: `Write $${w}\\dfrac{${r}}{${d}}$ as an improper fraction.`,
          answerType: 'numeric', answer: { value: imp / d, simplestFraction: { n: imp, d }, forbid: MIXED_FORM, forbidWhy: 'That is still a mixed number. Write one fraction with the whole number absorbed, such as 17/5.' }, inputHint: 'e.g. 17/5',
          traps: [{ value: (w + r) / d, why: `The whole number ${w} is worth $${w} \\times ${d}$ parts of size $\\frac{1}{${d}}$, not ${w} parts.` }],
          hints: [`Each whole is ${d} parts of size $\\frac{1}{${d}}$.`, `$${w} \\times ${d} = ${w * d}$ parts, then add the ${r} extra.`, `$${w * d} + ${r} = ${imp}$ parts altogether.`],
          steps: [{ h: 'Convert the whole number', d: `$${w} \\times ${d} = ${w * d}$` }, { h: 'Add the fraction part', d: `$${w * d} + ${r} = ${imp}$, so $\\dfrac{${imp}}{${d}}$` }]
        };
      }
    },
    { // which is greatest
      make: rng => {
        const fr = [];
        let guard = 60;
        while (fr.length < 4 && guard--) {
          const d = rc(rng, [3, 4, 5, 6, 7, 8, 9, 10, 12]), n = ri(rng, 1, d - 1);
          const f = new Frac(n, d);
          if (!fr.some(g => g.n * f.d === f.n * g.d)) fr.push(f);
        }
        if (fr.length < 4) return null;
        const big = fr.reduce((a, b) => (a.n * b.d >= b.n * a.d ? a : b));
        const m = mcq(rng, `$${big.latex()}$`, fr.filter(f => f !== big).map(f => ({ text: `$${f.latex()}$`, why: 'Compare fractions using a common denominator (or by converting to decimals); a bigger denominator or numerator alone does not decide it.' })));
        return {
          prompt: 'Which of these fractions is the greatest?',
          answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
          hints: ['Rewrite all the fractions so they can be compared fairly.', 'Use decimals ($\\text{numerator} \\div \\text{denominator}$) or a common denominator.', 'Pick the largest value.'],
          steps: [{ h: 'Convert to decimals', d: fr.map(f => `$${f.latex()} = ${r2(f.value)}$`).join(',\\ ') + ' (to 2 d.p.)' }, { h: 'Largest', d: `$${big.latex()}$` }]
        };
      }
    },
    { // fraction of a pizza left over
      make: rng => {
        const d1 = rc(rng, [3, 4, 5, 6, 8]), d2 = rc(rng, [3, 4, 5, 6, 8, 10, 12]);
        const f1 = new Frac(ri(rng, 1, d1 - 1), d1), f2 = new Frac(ri(rng, 1, d2 - 1), d2);
        const eaten = f1.add(f2), left = new Frac(1).sub(eaten);
        if (eaten.value >= 0.95 || left.value <= 0 || f1.d === f2.d || eaten.value === left.value) return null;
        const a = rc(rng, NAMES), b = rc(rng, NAMES.filter(x => x !== a));
        return {
          prompt: `${a} eats $${f1.latex()}$ of a family pizza and ${b} eats $${f2.latex()}$ of the same pizza. What fraction of the pizza is left? Give your answer in simplest form.`,
          answerType: 'numeric', answer: { value: left.value, simplestFraction: { n: left.n, d: left.d } }, inputHint: 'e.g. 5/12',
          traps: [{ value: eaten.value, why: 'That is the fraction that has been **eaten**; the question asks what is left over.' }],
          hints: ['Find how much was eaten altogether, then take it from the whole pizza (1).', `Add $${f1.latex()} + ${f2.latex()}$ using a common denominator.`, `Eaten $= ${eaten.latex()}$; left $= 1 - ${eaten.latex()}$.`],
          steps: [{ h: 'Total eaten', d: `$${f1.latex()} + ${f2.latex()} = ${eaten.latex()}$` }, { h: 'Subtract from 1', d: `$1 - ${eaten.latex()} = ${left.latex()}$` }]
        };
      }
    },
    { // how many pieces of a given fractional length
      make: rng => {
        const d = rc(rng, [2, 3, 4, 5, 6, 8, 10]), n = ri(rng, 1, d - 1);
        if (gcd(n, d) !== 1) return null;
        const p = ri(rng, 3, 30), L = new Frac(p * n, d);
        const kind = rc(rng, ['rope', 'ribbon', 'plank']);
        return {
          prompt: `A ${kind} is $${fracMixedOrLatex(L)}$ ${pl(L.value, 'metre', 'metres')} long. It is cut into pieces that are each $${new Frac(n, d).latex()}$ of a metre. How many pieces are there?`,
          answerType: 'numeric', answer: { value: p },
          traps: [{ value: L.mul(new Frac(n, d)).value, why: 'Cutting into equal pieces is **division** (how many pieces fit), not multiplication.' }],
          hints: ['How many times does one piece fit into the whole length?', `Calculate $${L.latex()} \\div ${new Frac(n, d).latex()}$.`, 'Dividing by a fraction is multiplying by its reciprocal.'],
          steps: [{ h: 'Set up the division', d: `$${L.latex()} \\div ${new Frac(n, d).latex()}$` }, { h: 'Multiply by the reciprocal', d: `$${L.latex()} \\times \\dfrac{${d}}{${n}} = ${p}$` }]
        };
      }
    },
    { // fraction of a fraction
      make: rng => {
        const a = new Frac(ri(rng, 1, 8), ri(rng, 2, 9)), b = new Frac(ri(rng, 1, 9), ri(rng, 2, 10));
        if (a.value >= 1 || b.value >= 1) return null;
        const res = a.mul(b);
        if (res.d === 1) return null;
        return {
          prompt: `A paddock is $${a.latex()}$ planted with wheat, and $${b.latex()}$ of the wheat area is harvested before the storm. What fraction of the whole paddock has been harvested? Give your answer in simplest form.`,
          answerType: 'numeric', answer: { value: res.value, simplestFraction: { n: res.n, d: res.d } }, inputHint: 'e.g. 3/10',
          traps: [{ value: a.add(b).value, why: '“of” a fraction means **multiply**; the two fractions are not added.' }],
          hints: ['“A fraction of a fraction” is a multiplication.', `Multiply $${a.latex()} \\times ${b.latex()}$.`, 'Multiply the tops, multiply the bottoms, then simplify.'],
          steps: [{ h: 'Multiply', d: `$${a.latex()} \\times ${b.latex()} = \\dfrac{${a.n * b.n}}{${a.d * b.d}}$` }, { h: 'Simplify', d: `$= ${res.latex()}$` }]
        };
      }
    }
  ].map(v => retry(v)),

  // ───────────────────────────── algebra ─────────────────────────────────────
  'y7-algebra': [
    { // substitute into a quadratic-style expression
      make: rng => {
        const p = ri(rng, 2, 6), q = nz(rng, -9, 9), r = nz(rng, -12, 12), x = ri(rng, 2, 9);
        const val = p * x * x + q * x + r;
        const expr = `${term(p, 'x', 2)} ${pm(q)} ${term(Math.abs(q), 'x')} ${pm(r)} ${Math.abs(r)}`;
        return {
          prompt: `Evaluate $${expr}$ when $x = ${x}$.`,
          answerType: 'numeric', answer: { value: val },
          traps: [{ value: (p * x) * (p * x) + q * x + r, why: `$${term(p, 'x', 2)}$ means $${p} \\times x^2$: square $x$ first, then multiply by ${p}.` }],
          hints: ['Replace every $x$ with the number, keeping the signs.', `Powers come before multiplying: $x^2 = ${x * x}$.`, `$${p} \\times ${x * x} ${pm(q)} ${Math.abs(q)} \\times ${x} ${pm(r)} ${Math.abs(r)}$.`],
          steps: [
            { h: 'Substitute', d: `$${p} \\times ${x}^2 ${pm(q)} ${Math.abs(q)} \\times ${x} ${pm(r)} ${Math.abs(r)}$` },
            { h: 'Square first, then multiply', d: `$${p * x * x} ${pm(q * x)} ${Math.abs(q * x)} ${pm(r)} ${Math.abs(r)}$` },
            { h: 'Add and subtract', d: `$= ${val}$` }
          ]
        };
      }
    },
    { // expand a single bracket
      make: rng => {
        const a = ri(rng, 2, 9), b = ri(rng, 1, 7), c = nz(rng, -9, 9);
        return {
          prompt: `Expand and simplify $${a}(${lin(b, c)})$.`,
          answerType: 'expression', answer: { expr: lin(a * b, a * c) }, inputHint: 'e.g. 6x + 15',
          traps: [{ expr: lin(a * b, c), why: `The ${a} outside multiplies **every** term inside the bracket, including the ${c < 0 ? 'negative ' : ''}number.` }],
          hints: ['Multiply the number outside by each term inside the bracket.', `$${a} \\times ${term(b, 'x')}$ and $${a} \\times ${c < 0 ? `(${c})` : c}$.`, 'Write the two results together with the correct sign.'],
          steps: [{ h: 'Multiply each term', d: `$${a}(${lin(b, c)}) = ${term(a * b, 'x')} ${pm(a * c)} ${Math.abs(a * c)}$` }]
        };
      }
    },
    { // two brackets, then collect
      make: rng => {
        const a = ri(rng, 2, 6), b = nz(rng, -6, 6), c = ri(rng, 2, 6), d = nz(rng, -6, 6);
        const x1 = a + c, k = a * b + c * d;
        if (k === 0 || k === b + d) return null;
        return {
          prompt: `Expand and simplify $${a}(${lin(1, b)}) + ${c}(${lin(1, d)})$.`,
          answerType: 'expression', answer: { expr: lin(x1, k) }, inputHint: 'e.g. 5x + 7',
          traps: [{ expr: lin(x1, b + d), why: 'Each bracket must be multiplied out first: the number outside multiplies the constant inside as well.' }],
          hints: ['Expand each bracket separately.', `First bracket: $${term(a, 'x')} ${pm(a * b)} ${Math.abs(a * b)}$; second: $${term(c, 'x')} ${pm(c * d)} ${Math.abs(c * d)}$.`, 'Collect the $x$ terms and the numbers.'],
          steps: [
            { h: 'Expand both brackets', d: `$${term(a, 'x')} ${pm(a * b)} ${Math.abs(a * b)} + ${term(c, 'x')} ${pm(c * d)} ${Math.abs(c * d)}$` },
            { h: 'Collect like terms', d: `$${lin(x1, k)}$` }
          ]
        };
      }
    },
    { // factorising as MCQ
      make: rng => {
        const g = ri(rng, 2, 9), a = ri(rng, 2, 7), b = nz(rng, -9, 9);
        if (gcd(a, Math.abs(b)) !== 1) return null;
        const key = `$${g}(${lin(a, b)})$`;
        const m = mcq(rng, key, [
          { text: `$${g}(${lin(a, g * b)})$`, why: 'After taking out the common factor, divide **every** term by it, including the number.' },
          { text: `$${g * a}(${lin(1, b)})$`, why: 'That multiplies out to a different expression; check by expanding your answer.' },
          { text: `$${g}(${lin(a, -b)})$`, why: 'Check the sign inside the bracket by expanding.' }
        ]);
        return {
          prompt: `Which is the fully factorised form of $${lin(g * a, g * b)}$?`,
          answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
          hints: ['Find the highest common factor of the two terms.', `Both $${g * a}$ and $${Math.abs(g * b)}$ share the factor ${g}.`, 'Divide each term by it and put the results in the bracket; expand to check.'],
          steps: [{ h: 'Highest common factor', d: `$\\text{HCF}(${g * a}, ${Math.abs(g * b)}) = ${g}$` }, { h: 'Factorise', d: `$${lin(g * a, g * b)} = ${g}(${lin(a, b)})$` }]
        };
      }
    },
    { // word rule → expression
      make: rng => {
        const fee = ri(rng, 3, 15), rate = ri(rng, 2, 9);
        if (fee === rate) return null;
        const t =rc(rng, [['A Sydney taxi charges a flag fall of', 'per kilometre. Write an expression for the cost, in dollars, of a trip of $n$ km.'], ['A surf school charges a registration fee of', 'per lesson. Write an expression for the total cost, in dollars, of $n$ lessons.']]);
        return {
          prompt: `${t[0]} ${moneyPlain(fee)} plus ${moneyPlain(rate)} ${t[1]}`,
          answerType: 'expression', answer: { expr: `${rate}n + ${fee}` }, inputHint: 'e.g. 3n + 5',
          traps: [{ expr: `${fee}n + ${rate}`, why: 'The one-off fee is a fixed amount; only the per-unit rate is multiplied by $n$.' }],
          hints: ['One part of the cost changes with $n$; the other part is fixed.', `The changing part is $${rate} \\times n$.`, `Add the fixed ${moneyPlain(fee)}.`],
          steps: [{ h: 'Changing part', d: `$${rate} \\times n = ${rate}n$` }, { h: 'Add the fixed fee', d: `$C = ${rate}n + ${fee}$` }]
        };
      }
    },
    { // use the rule to find a value
      make: rng => {
        const fee = ri(rng, 3, 15), rate = ri(rng, 2, 9), n = ri(rng, 4, 40);
        const C = rate * n + fee;
        return {
          prompt: `A hire company at ${rc(rng, PLACES)} uses the rule $C = ${rate}n + ${fee}$ for the cost $C$ (in dollars) of hiring a bike for $n$ hours. Find the cost of hiring a bike for $${n}$ hours.`,
          answerType: 'numeric', answer: { value: C }, answerPrefix: '$',
          traps: [{ value: (rate + fee) * n, why: 'Only the $' + rate + 'n$ part is multiplied by $n$; the ' + fee + ' is added once.' }],
          hints: ['Substitute the number of hours for $n$.', `$C = ${rate} \\times ${n} + ${fee}$.`, 'Multiply first, then add.'],
          steps: [{ h: 'Substitute', d: `$C = ${rate} \\times ${n} + ${fee}$` }, { h: 'Evaluate', d: `$= ${rate * n} + ${fee} = ${C}$` }]
        };
      }
    },
    { // equivalent expression MCQ
      make: rng => {
        const a = ri(rng, 2, 6), b = nz(rng, -7, 7), c = ri(rng, 1, 5);
        const xc = a + c, k = a * b;
        if (k === 0) return null;
        const m = mcq(rng, `$${lin(xc, k)}$`, [
          { text: `$${lin(xc, b)}$`, why: `Multiply the ${a} through the bracket: it multiplies the ${b < 0 ? 'negative ' : ''}number too.` },
          { text: `$${lin(a * c, k)}$`, why: 'Terms $ax$ and $cx$ add their coefficients; they do not multiply.' },
          { text: `$${lin(xc, -k)}$`, why: 'Check the sign of the constant after multiplying.' }
        ]);
        return {
          prompt: `Which expression is equivalent to $${a}(${lin(1, b)}) + ${term(c, 'x')}$?`,
          answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
          hints: ['Expand the bracket first.', `$${a}(${lin(1, b)}) = ${lin(a, k)}$.`, `Add the ${term(c, 'x')} to the $x$ terms.`],
          steps: [{ h: 'Expand', d: `$${a}(${lin(1, b)}) = ${lin(a, k)}$` }, { h: 'Collect like terms', d: `$${lin(a, k)} + ${term(c, 'x')} = ${lin(xc, k)}$` }]
        };
      }
    }
  ].map(v => retry(v)),

  // ───────────────────────────── equations ───────────────────────────────────
  'y7-equations': [
    { // unknown on both sides
      make: rng => {
        const x = ri(rng, -6, 15), c = ri(rng, 1, 6), a = c + ri(rng, 1, 6), b = nz(rng, -12, 12);
        const d = a * x + b - c * x;
        if (d === 0 || x === 0) return null;   // no '+ 0' term and no trivial zero solution
        const rhs = c === 1 ? `x ${sgn(d)}` : `${c}x ${sgn(d)}`;
        return {
          prompt: `Solve $${a}x ${sgn(b)} = ${rhs}$.`,
          answerType: 'numeric', answer: { value: x }, answerPrefix: 'x =',
          stepcheck: { kind: 'equation', variable: 'x', solutions: [x] },
          traps: [{ value: (d + b) / (a - c), why: 'Collect the $x$ terms on one side by subtracting the smaller one from **both** sides, then deal with the numbers.' }],
          hints: ['Get all the $x$ terms on one side.', `Subtract ${term(c, 'x')} from both sides: $${term(a - c, 'x')} ${sgn(b)} = ${d}$.`, 'Then undo the number and divide.'],
          steps: [
            { h: `Subtract ${term(c, 'x')} from both sides`, d: `$${term(a - c, 'x')} ${sgn(b)} = ${d}$` },
            { h: 'Move the number', d: `$${term(a - c, 'x')} = ${d - b}$` },
            { h: 'Divide', d: `$x = ${x}$` },
            { h: 'Check', d: `Left: $${a * x + b}$, right: $${c * x + d}$ ✓` }
          ]
        };
      }
    },
    { // fraction equation x/a + b = c
      make: rng => {
        const a = ri(rng, 2, 9), x = a * ri(rng, -5, 12), b = nz(rng, -15, 15), c = x / a + b;
        if (c - b - a === x || x === 0) return null;
        return {
          prompt: `Solve $\\dfrac{x}{${a}} ${sgn(b)} = ${c}$.`,
          answerType: 'numeric', answer: { value: x }, answerPrefix: 'x =',
          stepcheck: { kind: 'equation', variable: 'x', solutions: [x] },
          traps: [{ value: c - b - a, why: `$\\frac{x}{${a}}$ means $x \\div ${a}$; undo it by **multiplying** both sides by ${a}.` }],
          hints: ['Undo the ± number first, then the division.', `$\\dfrac{x}{${a}} = ${c - b}$.`, `Multiply both sides by ${a}.`],
          steps: [{ h: 'Undo the number', d: `$\\dfrac{x}{${a}} = ${c} ${b >= 0 ? '-' : '+'} ${Math.abs(b)} = ${c - b}$` }, { h: `Multiply by ${a}`, d: `$x = ${c - b} \\times ${a} = ${x}$` }, { h: 'Check', d: `$${x} \\div ${a} ${sgn(b)} = ${c}$ ✓` }]
        };
      }
    },
    { // tickets plus booking fee
      make: rng => {
        const n = ri(rng, 2, 18), t = ri(rng, 5, 45), f = ri(rng, 2, 12), T = n * t + f;
        const ev = rc(rng, ['an AFL match', 'a netball final', 'a cricket T20 game', 'a concert at the Sydney Opera House']);
        return {
          prompt: `Tickets to ${ev} cost ${moneyPlain(t)} each, plus a ${moneyPlain(f)} booking fee for the whole order. A family pays ${moneyPlain(T)} in total. Using $n$ for the number of tickets, form an equation and solve it to find $n$.`,
          answerType: 'numeric', answer: { value: n }, answerPrefix: 'n =',
          stepcheck: { kind: 'equation', variable: 'n', solutions: [n] },
          traps: [{ value: (T + f) / t, why: 'The booking fee is added once at the end of the order, so subtract it from the total before dividing by the ticket price.' }],
          hints: ['Write the total cost as a rule involving $n$.', `$${t}n + ${f} = ${T}$.`, `Subtract ${f}, then divide by ${t}.`],
          steps: [{ h: 'Form the equation', d: `$${t}n + ${f} = ${T}$` }, { h: `Subtract ${f}`, d: `$${t}n = ${T - f}$` }, { h: `Divide by ${t}`, d: `$n = ${n}$` }, { h: 'Check', d: `$${t} \\times ${n} + ${f} = ${T}$ ✓` }]
        };
      }
    },
    { // MCQ: which value is the solution
      make: rng => {
        const x = ri(rng, -8, 14), a = ri(rng, 2, 7), b = nz(rng, -12, 12), c = a * x + b;
        const m = mcq(rng, `$x = ${x}$`, [
          { text: `$x = ${c - b}$`, why: `You subtracted ${b >= 0 ? b : `(${b})`} but forgot to divide by ${a}.` },
          { text: `$x = ${(c + b) / a}$`, why: `Do the opposite of “${sgn(b)}”: ${b >= 0 ? 'subtract' : 'add'} ${Math.abs(b)}, not the other way round.` },
          { text: `$x = ${-x}$`, why: 'Substitute it back into the equation to check the sign.' },
          { text: `$x = ${x + 1}$` },
          { text: `$x = ${x - 2}$` },
          { text: `$x = ${x + 3}$` }
        ].filter(o => !/\.\d/.test(o.text)));
        return {
          prompt: `Which value of $x$ makes the equation $${a}x ${sgn(b)} = ${c}$ true?`,
          answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
          hints: ['Solve the equation, or substitute each option to test it.', `${b >= 0 ? 'Subtract' : 'Add'} ${Math.abs(b)} from both sides: $${a}x = ${c - b}$.`, `Divide by ${a}.`],
          steps: [{ h: 'Solve', d: `$${a}x = ${c - b}$, so $x = ${x}$` }, { h: 'Check', d: `$${a}(${x}) ${sgn(b)} = ${c}$ ✓` }]
        };
      }
    },
    { // perimeter equation
      make: rng => {
        const x = ri(rng, 2, 25), a = ri(rng, 1, 9), w = ri(rng, 2, 20);
        const P = 2 * (x + a + w);
        return {
          prompt: `A rectangular netball practice court has length $(x + ${a})$ metres and width $${w}$ metres. Its perimeter is $${P}$ metres. Find $x$.`,
          answerType: 'numeric', answer: { value: x }, answerPrefix: 'x =',
          stepcheck: { kind: 'equation', variable: 'x', solutions: [x] },
          traps: [{ value: P - a - w, why: 'Perimeter counts **two** lengths and **two** widths: $2(\\text{length} + \\text{width})$.' }],
          hints: ['Perimeter $= 2 \\times (\\text{length} + \\text{width})$.', `$2(x + ${a} + ${w}) = ${P}$.`, 'Divide both sides by 2 first.'],
          steps: [{ h: 'Set up', d: `$2(x + ${a} + ${w}) = ${P}$` }, { h: 'Divide by 2', d: `$x + ${a + w} = ${P / 2}$` }, { h: 'Solve', d: `$x = ${P / 2} - ${a + w} = ${x}$` }]
        };
      }
    },
    { // consecutive numbers
      make: rng => {
        const step = rc(rng, [1, 2]), k = rc(rng, [3, 4, 5]), n = ri(rng, 3, 60) * (step === 2 ? 1 : 1);
        const start = step === 2 ? 2 * n + rc(rng, [0, 1]) : n;
        const parity = start % 2 === 0 ? 'even' : 'odd';
        const nums = Array.from({ length: k }, (_, i) => start + i * step);
        const S = nums.reduce((s, v) => s + v, 0);
        const word = step === 1 ? 'consecutive whole numbers' : `consecutive ${parity} numbers`;
        return {
          prompt: `The sum of ${k} ${word} is $${S}$. Let the smallest be $n$ and solve an equation to find $n$.`,
          answerType: 'numeric', answer: { value: start }, answerPrefix: 'n =',
          stepcheck: { kind: 'equation', variable: 'n', solutions: [start] },
          traps: [{ value: S / k, why: 'That is the **middle** value (the mean); the question asks for the smallest number.' }],
          hints: [`The numbers are $n$, then each ${step === 1 ? 'one more' : 'two more'} than the last.`, `$${nums.map((_, i) => (i === 0 ? 'n' : `(n + ${i * step})`)).join(' + ')} = ${S}$.`, 'Collect the $n$ terms and solve.'],
          steps: [{ h: 'Write the sum', d: `$${k}n + ${nums.reduce((s, v) => s + v - start, 0)} = ${S}$` }, { h: 'Solve', d: `$${k}n = ${S - nums.reduce((s, v) => s + v - start, 0)}$, so $n = ${start}$` }]
        };
      }
    },
    { // equation from a number puzzle with a bracket
      make: rng => {
        const n = ri(rng, 3, 40), a = ri(rng, 2, 6), b = ri(rng, 2, 15), T = a * (n + b);
        return {
          prompt: `${rc(rng, NAMES)} thinks of a number, adds $${b}$, then multiplies the result by $${a}$ to get $${T}$. What was the number?`,
          answerType: 'numeric', answer: { value: n },
          stepcheck: { kind: 'equation', variable: 'n', solutions: [n] },
          traps: [{ value: T / a + b, why: 'The addition happened **first** (inside the bracket), so after dividing by ' + a + ' you must subtract ' + b + '.' }],
          hints: ['Let the number be $n$ and write the equation.', `$${a}(n + ${b}) = ${T}$.`, `Divide by ${a}, then subtract ${b}.`],
          steps: [{ h: 'Equation', d: `$${a}(n + ${b}) = ${T}$` }, { h: `Divide by ${a}`, d: `$n + ${b} = ${T / a}$` }, { h: `Subtract ${b}`, d: `$n = ${n}$` }]
        };
      }
    }
  ].map(v => retry(v)),

  // ───────────────────────────── angles ──────────────────────────────────────
  'y7-angles': [
    { // angle sum of a triangle
      make: rng => {
        const a = ri(rng, 25, 90), b = ri(rng, 20, 150 - a);
        const c = 180 - a - b;
        return {
          prompt: `Two angles of a triangle are $${a}°$ and $${b}°$. Find the third angle.`,
          answerType: 'numeric', answer: { value: c }, answerSuffix: '°',
          traps: [{ value: 360 - a - b, why: 'The angles in a **triangle** add to $180°$; $360°$ is for a quadrilateral.' }],
          hints: ['The angles in a triangle add to $180°$.', `$${a}° + ${b}° = ${a + b}°$.`, `Subtract from $180°$.`],
          steps: [{ h: 'Add the known angles', d: `$${a}° + ${b}° = ${a + b}°$` }, { h: 'Subtract from 180°', d: `$180° - ${a + b}° = ${c}°$` }]
        };
      }
    },
    { // quadrilateral angle sum
      make: rng => {
        const a = ri(rng, 60, 120), b = ri(rng, 60, 120), c = ri(rng, 40, 110), d = 360 - a - b - c;
        return {
          prompt: `Three angles of a quadrilateral are $${a}°$, $${b}°$ and $${c}°$. Find the fourth angle.`,
          answerType: 'numeric', answer: { value: d }, answerSuffix: '°',
          traps: [{ value: 180 - a - b - c > 0 ? 180 - a - b - c : 360 - a - b, why: 'The angles in a **quadrilateral** add to $360°$, not $180°$.' }],
          hints: ['The angles in a quadrilateral add to $360°$.', `$${a} + ${b} + ${c} = ${a + b + c}$.`, 'Subtract from $360°$.'],
          steps: [{ h: 'Add the known angles', d: `$${a}° + ${b}° + ${c}° = ${a + b + c}°$` }, { h: 'Subtract from 360°', d: `$360° - ${a + b + c}° = ${d}°$` }]
        };
      }
    },
    { // isosceles: apex given, base angle asked
      make: rng => {
        const base = ri(rng, 20, 80), apex = 180 - 2 * base;
        if (rng() < 0.5) {
          return {
            prompt: `An isosceles triangle has two equal base angles of $${base}°$ each. Find the apex angle between the two equal sides.`,
            answerType: 'numeric', answer: { value: apex }, answerSuffix: '°',
            traps: [{ value: 180 - base, why: 'The apex angle is what is left after taking **both** base angles from $180°$, not just one.' }],
            hints: ['The angles in a triangle add to $180°$.', `The two base angles make $${base}° + ${base}° = ${2 * base}°$.`, 'Subtract from $180°$.'],
            steps: [{ h: 'Both base angles', d: `$2 \\times ${base}° = ${2 * base}°$` }, { h: 'Apex angle', d: `$180° - ${2 * base}° = ${apex}°$` }]
          };
        }
        return {
          prompt: `An isosceles triangle has an apex angle of $${apex}°$ between its two equal sides. Find the size of each base angle.`,
          answerType: 'numeric', answer: { value: base }, answerSuffix: '°',
          traps: [{ value: 180 - apex, why: 'That is the sum of the **two** base angles; they are equal, so each is half of it.' }],
          hints: ['The two base angles of an isosceles triangle are equal.', `The two base angles together make $180° - ${apex}° = ${180 - apex}°$.`, 'Halve it.'],
          steps: [{ h: 'Base angles together', d: `$180° - ${apex}° = ${180 - apex}°$` }, { h: 'Each base angle', d: `$${180 - apex}° \\div 2 = ${base}°$` }]
        };
      }
    },
    { // exterior angle of a triangle
      make: rng => {
        const a = ri(rng, 25, 80), b = ri(rng, 30, 90), e = a + b;
        if (e === 90 || e >= 175) return null;
        return {
          prompt: `Two interior angles of a triangle are $${a}°$ and $${b}°$. One side is extended to form an exterior angle at the third vertex. Find the exterior angle.`,
          answerType: 'numeric', answer: { value: e }, answerSuffix: '°',
          traps: [{ value: 180 - a - b, why: 'That is the third **interior** angle; the exterior angle is supplementary to it (it adds to $180°$ with it).' }],
          hints: ['An exterior angle equals the sum of the two opposite interior angles.', `Or find the third interior angle, $180° - ${a + b}°$, then subtract from $180°$.`, `$${a}° + ${b}°$.`],
          steps: [{ h: 'Exterior angle rule', d: `Exterior $= ${a}° + ${b}° = ${e}°$` }, { h: 'Check', d: `Third interior $= ${180 - e}°$, and $${180 - e}° + ${e}° = 180°$ ✓` }]
        };
      }
    },
    { // straight line with algebra
      make: rng => {
        const x = ri(rng, 8, 30), a = ri(rng, 2, 5), c = ri(rng, 1, 4), b = ri(rng, 2, 40);
        const d = 180 - (a + c) * x - b;
        if (d <= 0 || b + a * x >= 175) return null;
        if (d + c * x >= 175) return null;
        return {
          prompt: `Two angles on a straight line are $(${a}x ${sgn(b)})°$ and $(${c === 1 ? 'x' : `${c}x`} ${sgn(d)})°$. Find $x$.`,
          answerType: 'numeric', answer: { value: x }, answerPrefix: 'x =',
          stepcheck: { kind: 'equation', variable: 'x', solutions: [x] },
          traps: [{ value: (90 - b - d) / (a + c), why: 'Angles on a **straight line** add to $180°$, not $90°$.' }],
          hints: ['Angles on a straight line add to $180°$.', `$(${a}x ${sgn(b)}) + (${term(c, 'x')} ${sgn(d)}) = 180$.`, `Collect: $${a + c}x ${sgn(b + d)} = 180$.`],
          steps: [{ h: 'Sum to 180°', d: `$${term(a + c, 'x')} ${sgn(b + d)} = 180$` }, { h: 'Solve', d: `$${term(a + c, 'x')} = ${180 - b - d}$, so $x = ${x}$` }, { h: 'Check', d: `Angles are $${a * x + b}°$ and $${c * x + d}°$, which add to $180°$ ✓` }]
        };
      }
    },
    { // co-interior angles with algebra
      make: rng => {
        const x = ri(rng, 8, 30), a = ri(rng, 2, 5), c = ri(rng, 1, 4), b = ri(rng, 2, 30);
        const d = 180 - (a + c) * x - b;
        if (d <= 0 || b + a * x >= 175 || d + c * x >= 175) return null;
        if (a === c || (d - b) / (a - c) === x) return null;
        return {
          prompt: `Two parallel lines are cut by a transversal. The co-interior angles are $(${a}x ${sgn(b)})°$ and $(${term(c, 'x')} ${sgn(d)})°$. Find $x$.`,
          answerType: 'numeric', answer: { value: x }, answerPrefix: 'x =',
          stepcheck: { kind: 'equation', variable: 'x', solutions: [x] },
          traps: [{ value: (d - b) / (a - c === 0 ? 1 : a - c), why: 'Co-interior angles are **supplementary** (they add to $180°$); they are not equal.' }],
          hints: ['Co-interior (C-shaped) angles between parallel lines add to $180°$.', `$(${a}x ${sgn(b)}) + (${term(c, 'x')} ${sgn(d)}) = 180$.`, 'Collect like terms and solve.'],
          steps: [{ h: 'Add to 180°', d: `$${term(a + c, 'x')} ${sgn(b + d)} = 180$` }, { h: 'Solve', d: `$${term(a + c, 'x')} = ${180 - b - d}$, so $x = ${x}$` }]
        };
      }
    },
    { // complementary with algebra
      make: rng => {
        const x = ri(rng, 6, 20), a = ri(rng, 2, 5), b = ri(rng, 1, 25), c = ri(rng, 1, 3);
        const d = 90 - (a + c) * x - b;
        if (d <= 0) return null;
        return {
          prompt: `Two complementary angles are $(${a}x ${sgn(b)})°$ and $(${term(c, 'x')} ${sgn(d)})°$. Find $x$.`,
          answerType: 'numeric', answer: { value: x }, answerPrefix: 'x =',
          stepcheck: { kind: 'equation', variable: 'x', solutions: [x] },
          traps: [{ value: (180 - b - d) / (a + c), why: 'Complementary angles add to $90°$ (supplementary angles add to $180°$).' }],
          hints: ['Complementary angles add to $90°$.', `$(${a}x ${sgn(b)}) + (${term(c, 'x')} ${sgn(d)}) = 90$.`, 'Collect like terms and solve.'],
          steps: [{ h: 'Add to 90°', d: `$${term(a + c, 'x')} ${sgn(b + d)} = 90$` }, { h: 'Solve', d: `$${term(a + c, 'x')} = ${90 - b - d}$, so $x = ${x}$` }]
        };
      }
    }
  ].map(v => retry(v)),

  // ───────────────────────────── perimeter & area ────────────────────────────
  'y7-area': [
    { // perimeter → missing side
      make: rng => {
        const l = ri(rng, 6, 60), w = ri(rng, 3, l - 1), P = 2 * (l + w);
        return {
          prompt: `A rectangular oval-practice pitch has a perimeter of $${P}$ m and a length of $${l}$ m. Find its width.`,
          answerType: 'numeric', answer: { value: w }, answerSuffix: 'm',
          traps: [{ value: P - l, why: 'The perimeter includes **two** lengths and **two** widths, so halve it before subtracting the length.' }],
          hints: ['Perimeter $= 2(\\text{length} + \\text{width})$.', `Half the perimeter is $${P / 2}$ m, which is length + width.`, `Width $= ${P / 2} - ${l}$.`],
          steps: [{ h: 'Half the perimeter', d: `$${P} \\div 2 = ${P / 2}$` }, { h: 'Subtract the length', d: `$${P / 2} - ${l} = ${w}$ m` }]
        };
      }
    },
    { // flooring cost
      make: rng => {
        const l = ri(rng, 4, 30), w = ri(rng, 3, 25), rate = ri(rng, 12, 85);
        const A = l * w, cost = A * rate;
        if (A === 2 * (l + w)) return null;
        return {
          prompt: `A rectangular room in a Newcastle house is $${l}$ m long and $${w}$ m wide. New carpet costs ${moneyPlain(rate)} per square metre. How much will it cost to carpet the whole floor?`,
          answerType: 'numeric', answer: { value: cost }, answerPrefix: '$',
          traps: [{ value: 2 * (l + w) * rate, why: 'Carpet covers the floor surface, so use **area**, not perimeter.' }],
          hints: ['Find the floor area first.', `$${l} \\times ${w} = ${A}$ m².`, `Multiply the area by ${moneyPlain(rate)} per m².`],
          steps: [{ h: 'Floor area', d: `$${l} \\times ${w} = ${A}$ m²` }, { h: 'Cost', d: `$${A} \\times ${rate} = ${cost}$, so ${moneyPlain(cost)}` }]
        };
      }
    },
    { // triangle: find the height
      make: rng => {
        const b = ri(rng, 4, 40), h = ri(rng, 3, 35);
        if ((b * h) % 2) return null;
        const A = b * h / 2;
        return {
          prompt: `A triangular sail has an area of $${A}$ m² and a base of $${b}$ m. Find its perpendicular height.`,
          answerType: 'numeric', answer: { value: h }, answerSuffix: 'm',
          traps: [{ value: A / b, why: 'A triangle’s area is **half** of base × height, so double the area before dividing by the base.' }],
          hints: ['$A = \\frac{1}{2}bh$.', `$${A} = \\frac{1}{2} \\times ${b} \\times h$.`, `Double the area, then divide by ${b}.`],
          steps: [{ h: 'Double the area', d: `$2 \\times ${A} = ${2 * A}$` }, { h: 'Divide by the base', d: `$h = ${2 * A} \\div ${b} = ${h}$ m` }]
        };
      }
    },
    { // shaded area: rectangle with a square hole
      make: rng => {
        const W = ri(rng, 10, 60), H = ri(rng, 8, 40), s = ri(rng, 2, Math.min(W, H) - 3);
        const A = W * H - s * s;
        if (s === 4) return null;
        return {
          prompt: `A rectangular lawn is $${W}$ m by $${H}$ m. A square garden bed with sides of $${s}$ m is dug out of the lawn. Find the area of lawn that is left.`,
          answerType: 'numeric', answer: { value: A }, answerSuffix: 'm²',
          traps: [{ value: W * H - 4 * s, why: 'The bed is a square, so its area is $s \\times s$, not its perimeter.' }],
          hints: ['Lawn left = whole lawn − bed.', `Lawn: $${W} \\times ${H}$. Bed: $${s} \\times ${s}$.`, 'Subtract.'],
          steps: [{ h: 'Whole lawn', d: `$${W} \\times ${H} = ${W * H}$ m²` }, { h: 'Bed', d: `$${s} \\times ${s} = ${s * s}$ m²` }, { h: 'Left over', d: `$${W * H} - ${s * s} = ${A}$ m²` }]
        };
      }
    },
    { // scaling a square
      make: rng => {
        const s = ri(rng, 3, 40), k = rc(rng, [2, 3, 4, 5]);
        const A = (k * s) * (k * s);
        return {
          prompt: `A square courtyard has sides of $${s}$ m. A new courtyard has sides $${k}$ times as long. Find the area of the new courtyard.`,
          answerType: 'numeric', answer: { value: A }, answerSuffix: 'm²',
          traps: [{ value: k * s * s, why: `When every side is ${k} times as long, the area is multiplied by $${k} \\times ${k}$, not just ${k}.` }],
          hints: ['Find the new side length first.', `New side $= ${k} \\times ${s} = ${k * s}$ m.`, 'Area of a square = side × side.'],
          steps: [{ h: 'New side', d: `$${k} \\times ${s} = ${k * s}$ m` }, { h: 'Area', d: `$${k * s} \\times ${k * s} = ${A}$ m²` }]
        };
      }
    },
    { // tiles
      make: rng => {
        const t = rc(rng, [20, 25, 50]), per = (100 / t) ** 2;
        const l = ri(rng, 2, 12), w = ri(rng, 2, 10);
        const n = l * w * per;
        return {
          prompt: `A bathroom floor measures $${l}$ m by $${w}$ m. It is covered with square tiles that are $${t}$ cm on each side. How many tiles are needed? (Ignore gaps and waste.)`,
          answerType: 'numeric', answer: { value: n },
          traps: [{ value: l * w * (100 / t), why: 'Tiles cover an area, so count tiles in **both** directions: $(100 \\div t)^2$ tiles fit in each square metre.' }],
          hints: ['Count how many tiles fit along each side of one square metre.', `$100 \\div ${t} = ${100 / t}$ tiles along a metre, so ${per} tiles per m².`, `Floor area is $${l * w}$ m².`],
          steps: [{ h: 'Tiles per square metre', d: `$(100 \\div ${t})^2 = ${100 / t}^2 = ${per}$` }, { h: 'Floor area', d: `$${l} \\times ${w} = ${l * w}$ m²` }, { h: 'Total tiles', d: `$${l * w} \\times ${per} = ${n}$` }]
        };
      }
    },
    { // two rectangles joined (L-shape described in words)
      make: rng => {
        const l1 = ri(rng, 6, 40), w1 = ri(rng, 4, 25), l2 = ri(rng, 3, 30), w2 = ri(rng, 2, 20);
        const A = l1 * w1 + l2 * w2;
        return {
          prompt: `A school courtyard is made of two rectangles joined together without overlapping: one is $${l1}$ m by $${w1}$ m and the other is $${l2}$ m by $${w2}$ m. What is the total area of the courtyard?`,
          answerType: 'numeric', answer: { value: A }, answerSuffix: 'm²',
          traps: [{ value: (l1 + l2) * (w1 + w2), why: 'Joining the two rectangles does not make one big rectangle with the added sides; find each area and add.' }],
          hints: ['Find the area of each rectangle separately.', `$${l1} \\times ${w1}$ and $${l2} \\times ${w2}$.`, 'Add the two areas.'],
          steps: [{ h: 'First rectangle', d: `$${l1} \\times ${w1} = ${l1 * w1}$ m²` }, { h: 'Second rectangle', d: `$${l2} \\times ${w2} = ${l2 * w2}$ m²` }, { h: 'Total', d: `$${l1 * w1} + ${l2 * w2} = ${A}$ m²` }]
        };
      }
    },
    { // parallelogram area from base and height with reverse
      make: rng => {
        const b = ri(rng, 4, 40), h = ri(rng, 3, 30), A = b * h;
        return {
          prompt: `A parallelogram-shaped paving stone has an area of $${A}$ cm² and a base of $${b}$ cm. Find its perpendicular height.`,
          answerType: 'numeric', answer: { value: h }, answerSuffix: 'cm',
          traps: [{ value: 2 * A / b, why: 'A parallelogram’s area is base × height with **no halving**; only triangles use $\\frac{1}{2}$.' }],
          hints: ['$A = b \\times h$.', `$${A} = ${b} \\times h$.`, `Divide the area by ${b}.`],
          steps: [{ h: 'Rearrange', d: `$h = A \\div b$` }, { h: 'Divide', d: `$h = ${A} \\div ${b} = ${h}$ cm` }]
        };
      }
    }
  ].map(v => retry(v))
};

// A variant may decline a draw (returns null) when its random numbers would be
// degenerate; re-draw from the same rng stream until it produces a question.
function retry(v) {
  return {
    ...v,
    make: (rng, diff) => {
      for (let i = 0; i < 200; i++) {
        const q = v.make(rng, diff);
        if (q) return q;
      }
      throw new Error('au-forms-y78-a: variant could not draw a valid question');
    }
  };
}
