// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Year 7 generators
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, rs, nz, gcd, Frac, mcq, term, bin, sgn, money, moneyPlain, num, r1, r2, r3, NAMES, ITEMS } from '../qhelpers.js';
import { figStraightLineAngles, figAnglesAtPoint, figParallelLines, figRect, figLShape } from '../figures.js';

export const year7 = {

  // ── Integers & order of operations ────────────────────────────────────────
  'y7-integers': (rng, diff) => {
    if (diff === 1) {
      const a = ri(rng, -12, 12), b = nz(rng, -12, 12);
      const op = rc(rng, ['+', '−']);
      const ansV = op === '+' ? a + b : a - b;
      const bTex = b < 0 ? `(${b})` : `${b}`;
      return {
        prompt: `Evaluate $${a} ${op === '+' ? '+' : '-'} ${bTex}$.`,
        answerType: 'numeric', answer: { value: ansV },
        traps: [{ value: op === '+' ? a - b : a + b, why: `Careful with the sign of ${b} — ${op === '+' ? 'adding' : 'subtracting'} a negative flips the direction on the number line.` }],
        hints: ['Picture a number line: where do you start, and which way do you move?',
          b < 0 ? `${op === '+' ? 'Adding' : 'Subtracting'} a negative is the same as ${op === '+' ? 'subtracting' : 'adding'} its opposite.` : 'Move right for adding a positive, left for subtracting.',
          `Start at ${a} and move ${Math.abs(op === '+' ? b : -b)} ${(op === '+' ? b : -b) >= 0 ? 'right' : 'left'}.`],
        steps: [
          { h: 'Rewrite without double signs', d: `$${a} ${op === '+' ? '+' : '-'} ${bTex} = ${a} ${(op === '+' ? b : -b) >= 0 ? '+' : '-'} ${Math.abs(op === '+' ? b : -b)}$` },
          { h: 'Move along the number line', d: `Start at $${a}$, move $${Math.abs(op === '+' ? b : -b)}$ ${(op === '+' ? b : -b) >= 0 ? 'right' : 'left'}: $${ansV}$` }
        ]
      };
    }
    if (diff === 2) {
      const a = ri(rng, -9, 9), b = nz(rng, -6, 6), c = nz(rng, -6, 6);
      const ansV = a + b * c;
      return {
        prompt: `Evaluate $${a} + ${b < 0 ? `(${b})` : b} \\times ${c < 0 ? `(${c})` : c}$.`,
        answerType: 'numeric', answer: { value: ansV },
        traps: [{ value: (a + b) * c, why: 'Order of operations: multiplication happens before addition — don’t work left to right.' }],
        hints: ['Which operation must be done first?', 'Multiplication before addition (BIDMAS/BODMAS).', `First find $${b} \\times ${c}$, then add ${a}.`],
        steps: [
          { h: 'Multiply first', d: `$${b} \\times ${c} = ${b * c}$ (${(b < 0) !== (c < 0) ? 'negative × positive gives negative' : 'the signs match, so the product is positive'})` },
          { h: 'Then add', d: `$${a} + ${b * c < 0 ? `(${b * c})` : b * c} = ${ansV}$` }
        ]
      };
    }
    if (diff === 3) {
      const a = ri(rng, -8, 8), b = ri(rng, -8, 8), c = nz(rng, 2, 5), d = ri(rng, 2, 5);
      const ansV = (a - b) * c + d * d;
      return {
        prompt: `Evaluate $(${a} - ${b < 0 ? `(${b})` : b}) \\times ${c} + ${d}^2$.`,
        answerType: 'numeric', answer: { value: ansV },
        traps: [
          { value: (a - b) * c + 2 * d, why: `$${d}^2$ means $${d} \\times ${d}$, not $${d} \\times 2$.` },
          { value: (a - b) * (c + d * d), why: 'Only the bracket is multiplied by ' + c + ' — the square term is added afterwards.' }
        ],
        hints: ['Brackets first, then indices, then multiplication, then addition.', `Work out $${a} - ${b < 0 ? `(${b})` : b}$ and $${d}^2$ separately first.`, `The bracket gives $${a - b}$ and $${d}^2 = ${d * d}$.`],
        steps: [
          { h: 'Brackets', d: `$${a} - ${b < 0 ? `(${b})` : b} = ${a - b}$` },
          { h: 'Indices', d: `$${d}^2 = ${d * d}$` },
          { h: 'Multiply', d: `$${a - b} \\times ${c} = ${(a - b) * c}$` },
          { h: 'Add', d: `$${(a - b) * c} + ${d * d} = ${ansV}$` }
        ]
      };
    }
    const start = ri(rng, -8, 5), drop = ri(rng, 6, 15), rise = ri(rng, 3, 12), hours = ri(rng, 3, 6), perHour = nz(rng, -4, -2);
    const overnight = start - drop;
    const ansV = overnight + rise + hours * perHour;
    return {
      prompt: `At dusk the temperature in Thredbo is $${start}°$C. Overnight it falls by $${drop}°$C, then rises $${rise}°$C by mid-morning. During the afternoon it changes by $${perHour}°$C every hour for $${hours}$ hours. What is the final temperature in °C?`,
      answerType: 'numeric', answer: { value: ansV }, answerSuffix: '°C',
      traps: [{ value: overnight + rise + hours * Math.abs(perHour), why: `A change of $${perHour}°$C per hour is a *fall* — the afternoon total is $${hours} \\times (${perHour}) = ${hours * perHour}$.` }],
      hints: ['Track the temperature one change at a time.', `The afternoon change is $${hours} \\times (${perHour})$.`, `After the overnight fall you're at $${overnight}°$C; after the rise, $${overnight + rise}°$C.`],
      steps: [
        { h: 'Overnight fall', d: `$${start} - ${drop} = ${overnight}$°C` },
        { h: 'Morning rise', d: `$${overnight} + ${rise} = ${overnight + rise}$°C` },
        { h: 'Afternoon change', d: `$${hours} \\times (${perHour}) = ${hours * perHour}$°C` },
        { h: 'Final temperature', d: `$${overnight + rise} + (${hours * perHour}) = ${ansV}$°C` }
      ]
    };
  },

  // ── Fractions ─────────────────────────────────────────────────────────────
  'y7-fractions': (rng, diff) => {
    if (diff === 1) {
      const g = ri(rng, 2, 6);
      const f = new Frac(ri(rng, 1, 9), ri(rng, 2, 10));
      const n = f.n * g, d = f.d * g;
      return {
        prompt: `Simplify $\\dfrac{${n}}{${d}}$ fully.`,
        answerType: 'numeric', answer: { value: f.value, simplestFraction: { n: f.n, d: f.d } },
        inputHint: 'e.g. 2/3',
        hints: ['Find a number that divides into both the top and the bottom.', `Both ${n} and ${d} are divisible by ${g === gcd(n, d) ? g : gcd(n, d)}.`, `Divide numerator and denominator by ${gcd(n, d)}.`],
        steps: [
          { h: 'Find the highest common factor', d: `$\\text{HCF}(${n}, ${d}) = ${gcd(n, d)}$` },
          { h: 'Divide top and bottom', d: `$\\dfrac{${n} \\div ${gcd(n, d)}}{${d} \\div ${gcd(n, d)}} = ${f.latex()}$` }
        ]
      };
    }
    if (diff === 2) {
      const d1 = rc(rng, [3, 4, 5, 6]), d2 = rc(rng, [4, 5, 6, 8, 10].filter(x => x !== d1));
      const f1 = new Frac(ri(rng, 1, d1 - 1), d1), f2 = new Frac(ri(rng, 1, d2 - 1), d2);
      const plus = rc(rng, [true, false]);
      const res = plus ? f1.add(f2) : f1.sub(f2);
      const L = (f1.d * f2.d) / gcd(f1.d, f2.d);
      return {
        prompt: `Evaluate $${f1.latex()} ${plus ? '+' : '-'} ${f2.latex()}$, giving your answer as a fraction in simplest form.`,
        answerType: 'numeric', answer: { value: res.value, simplestFraction: { n: res.n, d: res.d } },
        inputHint: 'e.g. 7/12',
        traps: [{ value: (plus ? f1.n + f2.n : f1.n - f2.n) / (f1.d + f2.d), why: 'You can’t just add tops and bottoms — first rewrite both fractions with a common denominator.' }],
        hints: ['You need a common denominator before adding or subtracting.', `The lowest common denominator of ${f1.d} and ${f2.d} is ${L}.`, `$${f1.latex()} = \\dfrac{${f1.n * L / f1.d}}{${L}}$ and $${f2.latex()} = \\dfrac{${f2.n * L / f2.d}}{${L}}$.`],
        steps: [
          { h: 'Common denominator', d: `$\\text{LCD}(${f1.d}, ${f2.d}) = ${L}$` },
          { h: 'Convert both fractions', d: `$${f1.latex()} = \\dfrac{${f1.n * L / f1.d}}{${L}}, \\quad ${f2.latex()} = \\dfrac{${f2.n * L / f2.d}}{${L}}$` },
          { h: plus ? 'Add the numerators' : 'Subtract the numerators', d: `$\\dfrac{${f1.n * L / f1.d} ${plus ? '+' : '-'} ${f2.n * L / f2.d}}{${L}} = \\dfrac{${plus ? f1.n * L / f1.d + f2.n * L / f2.d : f1.n * L / f1.d - f2.n * L / f2.d}}{${L}}$` },
          { h: 'Simplify', d: `$= ${res.latex()}$` }
        ]
      };
    }
    if (diff === 3) {
      const a = new Frac(ri(rng, 1, 5), ri(rng, 2, 6));
      const w = ri(rng, 1, 2), f = new Frac(ri(rng, 1, 3), ri(rng, 2, 5));
      const b = new Frac(w * f.d + f.n, f.d);
      const divide = rc(rng, [true, false]);
      const res = divide ? a.div(b) : a.mul(b);
      return {
        prompt: `Evaluate $${a.latex()} ${divide ? '\\div' : '\\times'} ${b.mixedLatex()}$, giving your answer as a fraction in simplest form.`,
        answerType: 'numeric', answer: { value: res.value, simplestFraction: { n: res.n, d: res.d } },
        inputHint: 'e.g. 5/12',
        traps: divide ? [{ value: a.mul(b).value, why: 'To divide by a fraction, multiply by its reciprocal — it looks like the fraction wasn’t flipped.' }] : [],
        hints: ['Convert the mixed numeral to an improper fraction first.', `$${b.mixedLatex()} = ${b.latex()}$.`, divide ? `Dividing by $${b.latex()}$ is the same as multiplying by $\\dfrac{${b.d}}{${b.n}}$.` : 'Multiply the numerators together and the denominators together, then simplify.'],
        steps: [
          { h: 'Improper fraction', d: `$${b.mixedLatex()} = \\dfrac{${w} \\times ${f.d} + ${f.n}}{${f.d}} = ${b.latex()}$` },
          ...(divide ? [{ h: 'Flip and multiply', d: `$${a.latex()} \\div ${b.latex()} = ${a.latex()} \\times \\dfrac{${b.d}}{${b.n}}$` }] : []),
          { h: 'Multiply straight across', d: `$\\dfrac{${a.n} \\times ${divide ? b.d : b.n}}{${a.d} \\times ${divide ? b.n : b.d}} = \\dfrac{${a.n * (divide ? b.d : b.n)}}{${a.d * (divide ? b.n : b.d)}}$` },
          { h: 'Simplify', d: `$= ${res.latex()}$` }
        ]
      };
    }
    const total = rc(rng, [60, 80, 120, 90, 150]);
    const f1 = rc(rng, [new Frac(1, 4), new Frac(2, 5), new Frac(1, 3), new Frac(3, 10)]);
    const f2 = rc(rng, [new Frac(1, 2), new Frac(1, 3), new Frac(2, 3)]);
    const first = f1.mul(new Frac(total)).value;
    const rest = total - first;
    const second = f2.mul(new Frac(rest)).value;
    const left = rest - second;
    const name = rc(rng, NAMES);
    return {
      prompt: `${name} downloads $${total}$ songs. They listen to $${f1.latex()}$ of them on Monday, then $${f2.latex()}$ of the *remaining* songs on Tuesday. How many songs are still unplayed?`,
      answerType: 'numeric', answer: { value: left },
      traps: [{ value: total - first - f2.mul(new Frac(total)).value, why: `Tuesday's fraction applies to the *remaining* ${rest} songs, not the original ${total}.` }],
      hints: ['Handle Monday first, then apply Tuesday’s fraction to what is left.', `Monday: $${f1.latex()} \\times ${total} = ${first}$ songs.`, `That leaves ${rest}; Tuesday removes $${f2.latex()}$ of those.`],
      steps: [
        { h: 'Monday', d: `$${f1.latex()} \\times ${total} = ${first}$ songs played` },
        { h: 'Remaining after Monday', d: `$${total} - ${first} = ${rest}$` },
        { h: 'Tuesday', d: `$${f2.latex()} \\times ${rest} = ${second}$ songs played` },
        { h: 'Still unplayed', d: `$${rest} - ${second} = ${left}$` }
      ]
    };
  },

  // ── Decimals & percentages ───────────────────────────────────────────────
  'y7-decimals-perc': (rng, diff) => {
    if (diff === 1) {
      const f = rc(rng, [[1, 4, 0.25, '25\\%'], [3, 4, 0.75, '75\\%'], [1, 5, 0.2, '20\\%'], [2, 5, 0.4, '40\\%'], [3, 5, 0.6, '60\\%'], [7, 10, 0.7, '70\\%'], [1, 8, 0.125, '12.5\\%'], [3, 8, 0.375, '37.5\\%']]);
      const [n, d, dec] = f;
      const m = mcq(rng, `$${dec}$`, [
        { text: `$${r2(n / (d + n))}$`, why: 'That comes from dividing by the wrong total — a fraction means numerator ÷ denominator.' },
        { text: `$${d / 100}$` },
        { text: `$${r2(dec * 10) === dec ? dec + 0.05 : r2(dec * 10)}$`, why: 'Check the decimal point — dividing by ' + d + ' moves it further than that.' }
      ]);
      return {
        prompt: `Which decimal is equal to $\\dfrac{${n}}{${d}}$?`,
        answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
        hints: ['A fraction is a division: top ÷ bottom.', `Compute $${n} \\div ${d}$.`, `$${n} \\div ${d} = ${dec}$.`],
        steps: [{ h: 'Divide numerator by denominator', d: `$\\dfrac{${n}}{${d}} = ${n} \\div ${d} = ${dec}$` }]
      };
    }
    if (diff === 2) {
      const pct = rc(rng, [10, 15, 20, 25, 30, 35, 40, 45]);
      const amount = rc(rng, [60, 80, 90, 120, 140, 160, 180, 240]);
      const ansV = pct * amount / 100;
      return {
        prompt: `Find $${pct}\\%$ of ${moneyPlain(amount)}.`,
        answerType: 'numeric', answer: { value: ansV }, answerPrefix: '$',
        traps: [{ value: amount / pct, why: `“${pct}% of” means multiply by $\\frac{${pct}}{100}$, not divide by ${pct}.` }],
        hints: ['Convert the percentage to a decimal or fraction first.', `$${pct}\\% = ${pct / 100}$.`, `Multiply: $${pct / 100} \\times ${amount}$.`],
        steps: [
          { h: 'Percentage as a decimal', d: `$${pct}\\% = \\dfrac{${pct}}{100} = ${pct / 100}$` },
          { h: 'Multiply', d: `$${pct / 100} \\times ${amount} = ${ansV}$, so the answer is ${moneyPlain(ansV)}` }
        ]
      };
    }
    if (diff === 3) {
      const n = ri(rng, 3, 19), d = rc(rng, [40, 16, 32, 60, 80]);
      const pct = r1(100 * n / d);
      return {
        prompt: `In a spelling test, ${rc(rng, NAMES)} scored $${n}$ out of $${d}$. Express this as a percentage, rounded to 1 decimal place where needed.`,
        answerType: 'numeric', answer: { value: pct, tol: 0.06, percent: true }, answerSuffix: '%',
        traps: [{ value: r1(d / n), why: 'The score is the fraction score ÷ total — it looks like the division is upside-down.' }],
        hints: ['Write the score as a fraction of the total first.', `The fraction is $\\frac{${n}}{${d}}$; multiply by 100 to get a percentage.`, `$${n} \\div ${d} = ${r3(n / d)}$…`],
        steps: [
          { h: 'Score as a fraction', d: `$\\dfrac{${n}}{${d}}$` },
          { h: 'Multiply by 100%', d: `$\\dfrac{${n}}{${d}} \\times 100\\% = ${r3(100 * n / d)}\\%$` },
          { h: 'Round', d: `$\\approx ${pct}\\%$` }
        ]
      };
    }
    const pct = rc(rng, [20, 25, 30, 40, 60, 75]);
    const part = rc(rng, [18, 24, 27, 30, 36, 42, 45, 54, 60]);
    const whole = part * 100 / pct;
    return {
      prompt: `$${pct}\\%$ of the students at a chess club are in Year 7 — that's $${part}$ students. How many students are in the club altogether?`,
      answerType: 'numeric', answer: { value: whole },
      traps: [{ value: part * pct / 100, why: `${part} already *is* the ${pct}% — you need to scale up to the whole (100%), not take ${pct}% again.` }],
      hints: ['This is a reverse percentage: you know the part, you want the whole.', `${pct}% of the club is ${part}, so 1% of the club is $${part} \\div ${pct}$.`, `1% is ${part / pct}; multiply by 100.`],
      steps: [
        { h: 'Find 1%', d: `$${pct}\\% = ${part}$, so $1\\% = ${part} \\div ${pct} = ${part / pct}$` },
        { h: 'Scale to 100%', d: `$100\\% = ${part / pct} \\times 100 = ${whole}$ students` },
        { h: 'Check', d: `$${pct}\\%$ of $${whole}$ is $${part}$ ✓` }
      ]
    };
  },

  // ── Ratio & rates ─────────────────────────────────────────────────────────
  'y7-ratio': (rng, diff) => {
    if (diff === 1) {
      const g = ri(rng, 2, 8);
      let a = ri(rng, 2, 9), b = ri(rng, 2, 9);
      const dv = gcd(a, b); a /= dv; b /= dv;
      return {
        prompt: `Simplify the ratio $${a * g} : ${b * g}$.`,
        answerType: 'ratio', answer: { a, b, simplified: true }, inputHint: 'e.g. 2:3',
        hints: ['Divide both parts by the same number.', `Both parts are divisible by ${g}.`, `$${a * g} \\div ${g} : ${b * g} \\div ${g}$.`],
        steps: [
          { h: 'Highest common factor', d: `$\\text{HCF}(${a * g}, ${b * g}) = ${g * gcd(a, b)}$` },
          { h: 'Divide both parts', d: `$${a * g} : ${b * g} = ${a} : ${b}$` }
        ]
      };
    }
    if (diff === 2) {
      const a = ri(rng, 2, 5), b = ri(rng, 3, 7);
      const unit = ri(rng, 4, 15);
      const total = (a + b) * unit;
      const who = rc(rng, [0, 1]);
      const share = (who === 0 ? a : b) * unit;
      const [n1, n2] = rs(rng, NAMES).slice(0, 2);
      return {
        prompt: `${n1} and ${n2} split ${moneyPlain(total)} in the ratio $${a} : ${b}$. How much does ${who === 0 ? n1 : n2} receive?`,
        answerType: 'numeric', answer: { value: share }, answerPrefix: '$',
        traps: [
          { value: (who === 0 ? b : a) * unit, why: 'That’s the other person’s share — match each part of the ratio to the right person, in order.' },
          { value: total / 2, why: `A $${a}:${b}$ split isn’t an even split — the shares are different sizes.` }
        ],
        hints: [`How many equal parts is the money divided into altogether?`, `$${a} + ${b} = ${a + b}$ parts, so one part is $${total} \\div ${a + b}$.`, `One part is ${moneyPlain(unit)}; ${who === 0 ? n1 : n2} gets ${who === 0 ? a : b} parts.`],
        steps: [
          { h: 'Total parts', d: `$${a} + ${b} = ${a + b}$` },
          { h: 'Value of one part', d: `$${total} \\div ${a + b} = ${unit}$ → ${moneyPlain(unit)}` },
          { h: `${who === 0 ? n1 : n2}'s share`, d: `$${who === 0 ? a : b} \\times ${unit} = ${share}$ → ${moneyPlain(share)}` }
        ]
      };
    }
    if (diff === 3) {
      const a = ri(rng, 1, 3), b = a + ri(rng, 1, 3), c = b + ri(rng, 1, 4);
      const unit = ri(rng, 3, 9);
      const total = (a + b + c) * unit;
      const diffShare = (c - a) * unit;
      return {
        prompt: `Concrete is mixed from cement, sand and gravel in the ratio $${a} : ${b} : ${c}$ by mass. A batch has a total mass of $${total}$ kg. How many kilograms **more** gravel than cement does it contain?`,
        answerType: 'numeric', answer: { value: diffShare }, answerSuffix: 'kg',
        traps: [{ value: c * unit, why: 'That’s the total gravel — the question asks for the *difference* between gravel and cement.' }],
        hints: ['Find the mass of one part first.', `There are $${a}+${b}+${c} = ${a + b + c}$ parts in total.`, `One part is $${total} \\div ${a + b + c} = ${unit}$ kg; gravel has ${c - a} parts more than cement.`],
        steps: [
          { h: 'Total parts', d: `$${a} + ${b} + ${c} = ${a + b + c}$` },
          { h: 'One part', d: `$${total} \\div ${a + b + c} = ${unit}$ kg` },
          { h: 'Difference in parts', d: `Gravel − cement $= ${c} - ${a} = ${c - a}$ parts` },
          { h: 'Difference in mass', d: `$${c - a} \\times ${unit} = ${diffShare}$ kg` }
        ]
      };
    }
    const s1 = ri(rng, 250, 550), g1 = rc(rng, [250, 500]);
    const s2 = s1 + ri(rng, 40, 160), g2 = rc(rng, [375, 750]);
    const u1 = s1 / g1 * 100, u2 = s2 / g2 * 100;
    const better = u1 < u2 ? 1 : 2;
    const m = mcq(rng, `The ${better === 1 ? `${g1} g jar` : `${g2} g jar`} — it costs $${r2(Math.min(u1, u2))}$c per 100 g`, [
      { text: `The ${better === 1 ? `${g2} g jar` : `${g1} g jar`} — it costs $${r2(Math.max(u1, u2))}$c per 100 g`, why: 'That jar has the *higher* cost per 100 g — best buy means the lowest unit price.' },
      { text: 'They are the same value' },
      { text: `The ${s1 < s2 ? `${g1} g` : `${g2} g`} jar, because it has the lower price tag`, why: 'A lower sticker price isn’t automatically better value — compare cost per 100 g.' }
    ]);
    return {
      prompt: `A ${g1} g jar of peanut butter costs $${s1}$ cents, and a ${g2} g jar costs $${s2}$ cents. Which is the better buy?`,
      answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
      hints: ['Compare like with like — work out the cost of the same amount from each jar.', 'Find the cost per 100 g for each jar.', `Jar 1: $${s1} \\div ${g1 / 100}$c per 100 g. Jar 2: $${s2} \\div ${g2 / 100}$c per 100 g.`],
      steps: [
        { h: 'Unit price, jar 1', d: `$${s1} \\div ${g1 / 100} = ${r2(u1)}$c per 100 g` },
        { h: 'Unit price, jar 2', d: `$${s2} \\div ${g2 / 100} = ${r2(u2)}$c per 100 g` },
        { h: 'Compare', d: `$${r2(Math.min(u1, u2))} < ${r2(Math.max(u1, u2))}$, so the ${better === 1 ? g1 : g2} g jar is the better buy.` }
      ]
    };
  },

  // ── Introducing algebra ───────────────────────────────────────────────────
  'y7-algebra': (rng, diff) => {
    if (diff === 1) {
      const a = ri(rng, 2, 6), b = ri(rng, 2, 6), av = ri(rng, 2, 7), bv = ri(rng, 1, 6);
      const ansV = a * av + b * bv;
      return {
        prompt: `If $a = ${av}$ and $b = ${bv}$, evaluate $${a}a + ${b}b$.`,
        answerType: 'numeric', answer: { value: ansV },
        traps: [{ value: Number(`${a}${av}`) + Number(`${b}${bv}`), why: `$${a}a$ means $${a} \\times a$, not the digits written next to each other.` }],
        hints: [`$${a}a$ is shorthand for $${a} \\times a$.`, `Substitute: $${a} \\times ${av} + ${b} \\times ${bv}$.`, `That's $${a * av} + ${b * bv}$.`],
        steps: [
          { h: 'Substitute the values', d: `$${a}a + ${b}b = ${a} \\times ${av} + ${b} \\times ${bv}$` },
          { h: 'Multiply', d: `$= ${a * av} + ${b * bv}$` },
          { h: 'Add', d: `$= ${ansV}$` }
        ]
      };
    }
    if (diff === 2) {
      const a = ri(rng, 3, 8), b = nz(rng, -6, 6), c = nz(rng, -5, -1), d = nz(rng, -6, 9);
      const xc = a + c, k = b + d;
      return {
        prompt: `Simplify $${a}x ${sgn(b)} ${c < 0 ? '-' : '+'} ${Math.abs(c)}x ${sgn(d)}$ by collecting like terms.`,
        answerType: 'expression', answer: { expr: `${xc}x + ${k}` },
        inputHint: 'e.g. 4x + 7',
        traps: [{ expr: `${a + c + b + d}x`, why: 'Only like terms combine — the plain numbers can’t merge into the x terms.' }],
        hints: ['Group the x terms together and the plain numbers together.', `x terms: $${a}x$ and $${c}x$. Numbers: $${b}$ and $${d}$.`, `$${a}x ${sgn(c * 1).replace('+', '+')} ${c}x = ${xc}x$ and $${b} ${sgn(d)} = ${k}$.`],
        steps: [
          { h: 'Group like terms', d: `$(${a}x ${c < 0 ? '-' : '+'} ${Math.abs(c)}x) + (${b} ${sgn(d)})$` },
          { h: 'Combine x terms', d: `$${a}x ${c < 0 ? '-' : '+'} ${Math.abs(c)}x = ${term(xc)}$` },
          { h: 'Combine constants', d: `$${b} ${sgn(d)} = ${k}$` },
          { h: 'Result', d: `$${term(xc)} ${sgn(k)}$` }
        ]
      };
    }
    if (diff === 3) {
      const k = ri(rng, 2, 7), a = nz(rng, 2, 6), b = nz(rng, -8, 8);
      return {
        prompt: `Expand $${k}(${a}x ${sgn(b)})$.`,
        answerType: 'expression', answer: { expr: `${k * a}x + ${k * b}` },
        inputHint: 'e.g. 6x + 15',
        traps: [{ expr: `${k * a}x + ${b}`, why: `The ${k} multiplies *every* term inside the bracket — including ${b}.` }],
        hints: ['Multiply everything inside the bracket by the number outside.', `$${k} \\times ${a === 1 ? '' : a}x$ and $${k} \\times ${b}$.`, `$= ${k * a}x ${sgn(k * b)}$.`],
        steps: [
          { h: 'Multiply the first term', d: `$${k} \\times ${a === 1 ? 'x' : `${a}x`} = ${k * a}x$` },
          { h: 'Multiply the second term', d: `$${k} \\times ${b < 0 ? `(${b})` : b} = ${k * b}$` },
          { h: 'Result', d: `$${k * a}x ${sgn(k * b)}$` }
        ]
      };
    }
    const p = ri(rng, 2, 5), q = nz(rng, -6, 6), r = ri(rng, 2, 4), s = nz(rng, -6, 6);
    const xc = p + r, k = p * q + r * s;
    return {
      prompt: `Expand and simplify $${p}(${bin('x', q)}) + ${r}(${bin('x', s)})$.`,
      answerType: 'expression', answer: { expr: `${xc}x + ${k}` },
      inputHint: 'e.g. 7x - 2',
      traps: [{ expr: `${xc}x + ${q + s}`, why: 'When expanding, the constants get multiplied too: it’s ' + `$${p}\\times${q}$ and $${r}\\times${s}$, not $${q}+${s}$.` }],
      hints: ['Expand each bracket separately first.', `First bracket: $${p}x ${sgn(p * q)}$. Second: $${r}x ${sgn(r * s)}$.`, 'Now collect the x terms and the constants.'],
      steps: [
        { h: 'Expand the first bracket', d: `$${p}(${bin('x', q)}) = ${p}x ${sgn(p * q)}$` },
        { h: 'Expand the second bracket', d: `$${r}(${bin('x', s)}) = ${r}x ${sgn(r * s)}$` },
        { h: 'Collect like terms', d: `$${p}x + ${r}x = ${xc}x$ and $${p * q} ${sgn(r * s)} = ${k}$` },
        { h: 'Result', d: `$${term(xc)} ${sgn(k)}$` }
      ]
    };
  },

  // ── Linear equations ──────────────────────────────────────────────────────
  'y7-equations': (rng, diff) => {
    if (diff === 1) {
      const x = ri(rng, -9, 12);
      const mode = rc(rng, ['add', 'mul']);
      if (mode === 'add') {
        const a = nz(rng, -10, 10);
        return {
          prompt: `Solve $x ${sgn(a)} = ${x + a}$.`,
          answerType: 'numeric', answer: { value: x }, answerPrefix: 'x =',
          stepcheck: { kind: 'equation', variable: 'x', solutions: [x] },
          traps: [{ value: x + 2 * a, why: `To undo “${sgn(a)}”, do the *opposite* operation to both sides.` }],
          hints: [`What operation undoes “${sgn(a)}”?`, `${a >= 0 ? 'Subtract' : 'Add'} $${Math.abs(a)}$ from both sides.`, `$x = ${x + a} ${a >= 0 ? '-' : '+'} ${Math.abs(a)}$.`],
          steps: [
            { h: `${a >= 0 ? 'Subtract' : 'Add'} ${Math.abs(a)} on both sides`, d: `$x = ${x + a} ${a >= 0 ? '-' : '+'} ${Math.abs(a)} = ${x}$` },
            { h: 'Check', d: `$${x} ${sgn(a)} = ${x + a}$ ✓` }
          ]
        };
      }
      const a = rc(rng, [2, 3, 4, 5, 6]);
      return {
        prompt: `Solve $${a}x = ${a * x}$.`,
        answerType: 'numeric', answer: { value: x }, answerPrefix: 'x =',
        stepcheck: { kind: 'equation', variable: 'x', solutions: [x] },
        traps: [{ value: a * x - a, why: `$${a}x$ means $${a} \\times x$, so undo it by *dividing* both sides by ${a}.` }],
        hints: [`$${a}x$ means $${a} \\times x$.`, `Divide both sides by ${a}.`, `$x = ${a * x} \\div ${a}$.`],
        steps: [
          { h: `Divide both sides by ${a}`, d: `$x = \\dfrac{${a * x}}{${a}} = ${x}$` },
          { h: 'Check', d: `$${a} \\times ${x} = ${a * x}$ ✓` }
        ]
      };
    }
    if (diff === 2) {
      const x = ri(rng, -8, 12), a = rc(rng, [2, 3, 4, 5]), b = nz(rng, -10, 10);
      const c = a * x + b;
      return {
        prompt: `Solve $${a}x ${sgn(b)} = ${c}$.`,
        answerType: 'numeric', answer: { value: x }, answerPrefix: 'x =',
        stepcheck: { kind: 'equation', variable: 'x', solutions: [x] },
        traps: [
          { value: (c + b) / a, why: `First undo “${sgn(b)}” by doing the opposite: ${b >= 0 ? 'subtract' : 'add'} $${Math.abs(b)}$ on both sides.` },
          { value: (c - b) * a, why: `After getting $${a}x = ${c - b}$, *divide* by ${a} (don’t multiply).` }
        ],
        hints: ['Undo the operations in reverse order: the ± number first, then the ×.', `${b >= 0 ? 'Subtract' : 'Add'} $${Math.abs(b)}$ from both sides first.`, `That gives $${a}x = ${c - b}$; now divide by ${a}.`],
        steps: [
          { h: `${b >= 0 ? 'Subtract' : 'Add'} ${Math.abs(b)} on both sides`, d: `$${a}x = ${c} ${b >= 0 ? '-' : '+'} ${Math.abs(b)} = ${c - b}$` },
          { h: `Divide both sides by ${a}`, d: `$x = \\dfrac{${c - b}}{${a}} = ${x}$` },
          { h: 'Check', d: `$${a}(${x}) ${sgn(b)} = ${c}$ ✓` }
        ]
      };
    }
    if (diff === 3) {
      const x = ri(rng, -6, 10), a = rc(rng, [2, 3, 4]), b = nz(rng, -7, 7);
      const c = a * (x + b);
      return {
        prompt: `Solve $${a}(${bin('x', b)}) = ${c}$.`,
        answerType: 'numeric', answer: { value: x }, answerPrefix: 'x =',
        stepcheck: { kind: 'equation', variable: 'x', solutions: [x] },
        traps: [{ value: (c - b) / a, why: `If you expand first, the bracket gives $${a}x ${sgn(a * b)}$ — the ${b < 0 ? '' : '+'}${b} is multiplied by ${a} too.` }],
        hints: ['Either divide both sides by the number outside the bracket, or expand first.', `Dividing both sides by ${a} gives $${bin('x', b)} = ${c / a}$.`, `Now ${b >= 0 ? 'subtract' : 'add'} $${Math.abs(b)}$.`],
        steps: [
          { h: `Divide both sides by ${a}`, d: `$${bin('x', b)} = ${c / a}$` },
          { h: `${b >= 0 ? 'Subtract' : 'Add'} ${Math.abs(b)}`, d: `$x = ${c / a} ${b >= 0 ? '-' : '+'} ${Math.abs(b)} = ${x}$` },
          { h: 'Check', d: `$${a}(${x} ${sgn(b)}) = ${a} \\times ${x + b} = ${c}$ ✓` }
        ]
      };
    }
    const n = ri(rng, 5, 30);
    const mult = rc(rng, [3, 4, 5]), add = ri(rng, 4, 20);
    const resTot = mult * n + add;
    return {
      prompt: `${rc(rng, NAMES)} thinks of a number, multiplies it by $${mult}$, then adds $${add}$. The result is $${resTot}$. Let the number be $n$ — write an equation and solve it to find $n$.`,
      answerType: 'numeric', answer: { value: n }, answerPrefix: 'n =',
      stepcheck: { kind: 'equation', variable: 'n', solutions: [n] },
      traps: [{ value: (resTot + add) / mult, why: 'The + ' + add + ' happened last, so undo it *first*: subtract it from the result.' }],
      hints: [`Translate the story: “multiply by ${mult}, add ${add}, get ${resTot}”.`, `The equation is $${mult}n + ${add} = ${resTot}$.`, `Subtract ${add}, then divide by ${mult}.`],
      steps: [
        { h: 'Form the equation', d: `$${mult}n + ${add} = ${resTot}$` },
        { h: `Subtract ${add}`, d: `$${mult}n = ${resTot - add}$` },
        { h: `Divide by ${mult}`, d: `$n = ${n}$` },
        { h: 'Check', d: `$${mult} \\times ${n} + ${add} = ${resTot}$ ✓` }
      ]
    };
  },

  // ── Angle relationships ──────────────────────────────────────────────────
  'y7-angles': (rng, diff) => {
    if (diff === 1) {
      const comp = rc(rng, [true, false]);
      const total = comp ? 90 : 180;
      const a = ri(rng, 15, total - 15);
      return {
        prompt: `Two angles are ${comp ? 'complementary (they add to $90°$)' : 'supplementary (they add to $180°$)'}. One of them is $${a}°$. Find the other angle $\\theta$.`,
        figure: comp ? undefined : figStraightLineAngles({ known: a }),
        answerType: 'numeric', answer: { value: total - a }, answerSuffix: '°',
        traps: [{ value: (comp ? 180 : 90) - a > 0 ? (comp ? 180 : 90) - a : 360 - a, why: comp ? 'Complementary angles sum to 90°, not 180°.' : 'Supplementary angles sum to 180°, not 90° or 360°.' }],
        hints: [`${comp ? 'Complementary' : 'Supplementary'} means the two angles add to $${total}°$.`, `Set up: $${a}° + \\theta = ${total}°$.`, `Subtract: $\\theta = ${total}° - ${a}°$.`],
        steps: [
          { h: 'Use the angle sum', d: `$${a}° + \\theta = ${total}°$` },
          { h: 'Solve', d: `$\\theta = ${total}° - ${a}° = ${total - a}°$` }
        ]
      };
    }
    if (diff === 2) {
      const known = [ri(rng, 40, 120), ri(rng, 40, 120)];
      const third = 360 - known[0] - known[1] - ri(rng, 30, 80);
      const target = 360 - known[0] - known[1] - third;
      return {
        prompt: `Four angles meet at a point, as shown. Three of them are $${known[0]}°$, $${known[1]}°$ and $${third}°$. Find the fourth angle $\\theta$.`,
        figure: figAnglesAtPoint([known[0], known[1], third, '?']),
        answerType: 'numeric', answer: { value: target }, answerSuffix: '°', answerPrefix: 'θ =',
        traps: [{ value: 180 - Math.min(known[0] + known[1] + third, 179), why: 'Angles *at a point* make a full revolution: they add to 360°, not 180°.' }],
        hints: ['Angles at a point add to 360°.', `Add the three known angles first: $${known[0]} + ${known[1]} + ${third}$.`, `$\\theta = 360° - ${known[0] + known[1] + third}°$.`],
        steps: [
          { h: 'Sum of known angles', d: `$${known[0]}° + ${known[1]}° + ${third}° = ${known[0] + known[1] + third}°$` },
          { h: 'Angles at a point total 360°', d: `$\\theta = 360° - ${known[0] + known[1] + third}° = ${target}°$` }
        ]
      };
    }
    if (diff === 3) {
      const a = ri(rng, 50, 130);
      const kind = rc(rng, ['alternate', 'corresponding', 'co-interior']);
      const ansV = kind === 'co-interior' ? 180 - a : a;
      const m = mcq(rng, `$${ansV}°$`, [
        { text: `$${kind === 'co-interior' ? a : 180 - a}°$`, why: kind === 'co-interior' ? 'Co-interior angles are supplementary (add to 180°) — they’re only equal at 90°.' : `${kind[0].toUpperCase() + kind.slice(1)} angles on parallel lines are *equal*, not supplementary.` },
        { text: `$${Math.abs(90 - a)}°$` },
        { text: `$${360 - a}°$` }
      ]);
      return {
        prompt: `In the diagram, two parallel lines are cut by a transversal. The marked angle is $${a}°$, and $\\theta$ is its **${kind}** angle. What is $\\theta$?`,
        figure: figParallelLines({ given: `${a}°`, kind }),
        answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
        hints: [`Recall the parallel-line angle rules: alternate (Z), corresponding (F), co-interior (C).`, kind === 'co-interior' ? 'Co-interior angles add to 180°.' : `${kind[0].toUpperCase() + kind.slice(1)} angles are equal.`, kind === 'co-interior' ? `$\\theta = 180° - ${a}°$.` : `$\\theta = ${a}°$.`],
        steps: [
          { h: `${kind[0].toUpperCase() + kind.slice(1)} angles`, d: kind === 'co-interior' ? `Co-interior angles between parallel lines are supplementary: $\\theta + ${a}° = 180°$` : `${kind[0].toUpperCase() + kind.slice(1)} angles between parallel lines are equal: $\\theta = ${a}°$` },
          { h: 'Conclude', d: `$\\theta = ${ansV}°$` }
        ]
      };
    }
    const x = ri(rng, 15, 40);
    const a = ri(rng, 2, 4), b = ri(rng, 5, 30);
    const c = rc(rng, [1, 2]), d2 = a * x + b - c * x;
    return {
      prompt: `Two vertically opposite angles are $(${a}x ${sgn(b)})°$ and $(${c}x ${sgn(d2)})°$. Find $x$.`,
      answerType: 'numeric', answer: { value: x }, answerPrefix: 'x =',
      stepcheck: { kind: 'equation', variable: 'x', solutions: [x] },
      traps: [{ value: (180 - b - d2) / (a + c), why: 'Vertically opposite angles are *equal* — they don’t add to 180°.' }],
      hints: ['Vertically opposite angles are equal.', `Set the expressions equal: $${a}x ${sgn(b)} = ${c}x ${sgn(d2)}$.`, `Collect the x terms: $${a - c}x = ${d2 - b}$.`],
      steps: [
        { h: 'Vertically opposite ⇒ equal', d: `$${a}x ${sgn(b)} = ${c}x ${sgn(d2)}$` },
        { h: `Subtract ${c}x from both sides`, d: `$${a - c}x ${sgn(b)} = ${d2}$` },
        { h: 'Solve', d: `$${a - c}x = ${d2 - b}$, so $x = ${x}$` },
        { h: 'Check', d: `Both angles equal $${a * x + b}°$ ✓` }
      ]
    };
  },

  // ── Perimeter & area ──────────────────────────────────────────────────────
  'y7-area': (rng, diff) => {
    if (diff === 1) {
      const l = ri(rng, 4, 15), w = ri(rng, 3, l);
      const wantArea = rc(rng, [true, false]);
      const ansV = wantArea ? l * w : 2 * (l + w);
      return {
        prompt: `The rectangle shown is $${l}$ cm long and $${w}$ cm wide. Find its ${wantArea ? 'area' : 'perimeter'}.`,
        figure: figRect({ l: `${l} cm`, w: `${w} cm` }),
        answerType: 'numeric', answer: { value: ansV }, answerSuffix: wantArea ? 'cm²' : 'cm',
        traps: [{ value: wantArea ? 2 * (l + w) : l * w, why: wantArea ? 'That’s the perimeter — area is length × width.' : 'That’s the area — perimeter is the total distance around the outside.' }],
        hints: [wantArea ? 'Area of a rectangle = length × width.' : 'Perimeter = the total distance around the edge.', wantArea ? `$A = ${l} \\times ${w}$.` : `$P = 2(${l} + ${w})$.`, wantArea ? `$= ${ansV}$ cm².` : `$= 2 \\times ${l + w} = ${ansV}$ cm.`],
        steps: wantArea
          ? [{ h: 'Apply A = l × w', d: `$A = ${l} \\times ${w} = ${ansV}$ cm²` }]
          : [{ h: 'Apply P = 2(l + w)', d: `$P = 2(${l} + ${w}) = 2 \\times ${l + w} = ${ansV}$ cm` }]
      };
    }
    if (diff === 2) {
      const shape = rc(rng, ['triangle', 'parallelogram']);
      const b = ri(rng, 6, 18), h = ri(rng, 4, 14) * (shape === 'triangle' ? 2 : 1) / (shape === 'triangle' ? 2 : 1);
      const hh = shape === 'triangle' ? ri(rng, 2, 7) * 2 : ri(rng, 4, 14);
      const ansV = shape === 'triangle' ? b * hh / 2 : b * hh;
      return {
        prompt: `Find the area of a ${shape} with base $${b}$ cm and ${shape === 'triangle' ? 'perpendicular ' : ''}height $${hh}$ cm.`,
        answerType: 'numeric', answer: { value: ansV }, answerSuffix: 'cm²',
        traps: [{ value: shape === 'triangle' ? b * hh : b * hh / 2, why: shape === 'triangle' ? 'A triangle is *half* a rectangle: divide base × height by 2.' : 'A parallelogram is a full base × height — no halving (that’s for triangles).' }],
        hints: [shape === 'triangle' ? 'A triangle is half of a rectangle with the same base and height.' : 'A parallelogram has the same area as a rectangle with the same base and height.', `$A = ${shape === 'triangle' ? '\\frac{1}{2}' : ''} b h$.`, `$A = ${shape === 'triangle' ? `\\frac{1}{2} \\times ${b} \\times ${hh}` : `${b} \\times ${hh}`}$.`],
        steps: [
          { h: 'Choose the formula', d: shape === 'triangle' ? `$A = \\frac{1}{2}bh$` : `$A = bh$` },
          { h: 'Substitute', d: shape === 'triangle' ? `$A = \\frac{1}{2} \\times ${b} \\times ${hh} = ${ansV}$ cm²` : `$A = ${b} \\times ${hh} = ${ansV}$ cm²` }
        ]
      };
    }
    if (diff === 3) {
      const W = ri(rng, 10, 18), H = ri(rng, 8, 14), w = ri(rng, 3, W - 4), h = ri(rng, 3, H - 4);
      const ansV = W * H - w * h;
      return {
        prompt: `The L-shaped room shown is a $${W}$ m × $${H}$ m rectangle with a $${w}$ m × $${h}$ m rectangular corner missing. Find the floor area of the room.`,
        figure: figLShape({ W1: `${W} m`, H1: `${H} m`, w2: `${w} m`, h2: `${h} m` }),
        answerType: 'numeric', answer: { value: ansV }, answerSuffix: 'm²',
        traps: [{ value: W * H + w * h, why: 'The corner is *missing* — subtract it from the full rectangle, don’t add it.' }],
        hints: ['Think of the L-shape as a big rectangle with a bite taken out.', `Full rectangle: $${W} \\times ${H}$. Missing corner: $${w} \\times ${h}$.`, 'Subtract the missing area from the full area.'],
        steps: [
          { h: 'Full rectangle', d: `$${W} \\times ${H} = ${W * H}$ m²` },
          { h: 'Missing corner', d: `$${w} \\times ${h} = ${w * h}$ m²` },
          { h: 'Subtract', d: `$${W * H} - ${w * h} = ${ansV}$ m²` }
        ]
      };
    }
    const w = ri(rng, 4, 12);
    const area = w * ri(rng, w + 2, 20);
    const l = area / w;
    return {
      prompt: `A rectangular vegetable patch has area $${area}$ m² and width $${w}$ m. Fencing costs ${moneyPlain(ri(rng, 8, 15))} per metre — but first, find the **length** of the patch.`,
      answerType: 'numeric', answer: { value: l }, answerSuffix: 'm',
      traps: [{ value: area - w, why: 'Area = length × width, so divide the area by the width (don’t subtract).' }],
      hints: ['Area = length × width — you know two of the three.', `$${area} = l \\times ${w}$.`, `Divide both sides by ${w}.`],
      steps: [
        { h: 'Set up the equation', d: `$l \\times ${w} = ${area}$` },
        { h: 'Divide', d: `$l = ${area} \\div ${w} = ${l}$ m` }
      ]
    };
  },

  // ── Data & statistics ─────────────────────────────────────────────────────
  'y7-data': (rng, diff) => {
    if (diff === 1) {
      const base = ri(rng, 3, 12);
      const modeV = ri(rng, base, base + 8);
      let data = [modeV, modeV, ri(rng, base, base + 9), ri(rng, base, base + 9), ri(rng, base + 1, base + 10)];
      data = data.map((v, i) => (i > 1 && v === modeV ? v + 1 : v));
      data = rs(rng, data);
      const wantMode = rc(rng, [true, false]);
      const sorted = [...data].sort((a, b) => a - b);
      const range = sorted[4] - sorted[0];
      return {
        prompt: `Here are five quiz scores: $${data.join(',\\ ')}$. Find the **${wantMode ? 'mode' : 'range'}**.`,
        answerType: 'numeric', answer: { value: wantMode ? modeV : range },
        traps: [{ value: wantMode ? range : modeV, why: wantMode ? 'That’s the range — the mode is the most frequent value.' : 'That’s the mode — the range is highest minus lowest.' }],
        hints: [wantMode ? 'The mode is the value that appears most often.' : 'The range measures spread: highest − lowest.', `Sorted: $${sorted.join(', ')}$.`, wantMode ? `Which value appears twice?` : `$${sorted[4]} - ${sorted[0]}$.`],
        steps: [
          { h: 'Sort the data', d: `$${sorted.join(',\\ ')}$` },
          wantMode ? { h: 'Most frequent value', d: `$${modeV}$ appears twice — mode $= ${modeV}$` } : { h: 'Highest − lowest', d: `$${sorted[4]} - ${sorted[0]} = ${range}$` }
        ]
      };
    }
    if (diff === 2) {
      const n = rc(rng, [4, 5, 6]);
      const mean = ri(rng, 5, 15);
      let data = Array.from({ length: n - 1 }, () => ri(rng, mean - 4, mean + 4));
      const last = mean * n - data.reduce((s, v) => s + v, 0);
      if (last < 0 || last > mean + 12) return year7['y7-data'](rng, diff);
      data.push(last);
      data = rs(rng, data);
      return {
        prompt: `Find the mean of: $${data.join(',\\ ')}$.`,
        answerType: 'numeric', answer: { value: mean },
        traps: [{ value: data.reduce((s, v) => s + v, 0), why: `That's the total — divide by how many values there are (${n}).` }],
        hints: ['Mean = total ÷ number of values.', `Add them up first: what's the total?`, `Total is ${mean * n}; divide by ${n}.`],
        steps: [
          { h: 'Add the values', d: `$${data.join(' + ')} = ${mean * n}$` },
          { h: `Divide by ${n}`, d: `$${mean * n} \\div ${n} = ${mean}$` }
        ]
      };
    }
    if (diff === 3) {
      const n = 6;
      let data = Array.from({ length: n }, () => ri(rng, 2, 20)).sort((a, b) => a - b);
      if (data[2] === data[3]) data[3] += 1;
      const med = (data[2] + data[3]) / 2;
      const shown = rs(rng, data);
      return {
        prompt: `The daily screen-time (hours) of six students was: $${shown.join(',\\ ')}$. Find the **median**.`,
        answerType: 'numeric', answer: { value: med },
        traps: [
          { value: (shown[2] + shown[3]) / 2, why: 'Sort the data first — the median is the middle of the *ordered* list.' },
          { value: data[2], why: 'With an even number of values, the median is the average of the two middle values.' }
        ],
        hints: ['Put the values in order first.', `Ordered: $${data.join(', ')}$. With 6 values, the median sits between the 3rd and 4th.`, `Average $${data[2]}$ and $${data[3]}$.`],
        steps: [
          { h: 'Order the data', d: `$${data.join(',\\ ')}$` },
          { h: 'Locate the middle pair', d: `3rd and 4th values: $${data[2]}$ and $${data[3]}$` },
          { h: 'Average them', d: `$\\dfrac{${data[2]} + ${data[3]}}{2} = ${med}$` }
        ]
      };
    }
    const n = rc(rng, [4, 5]);
    const target = ri(rng, 12, 18);
    let scores = Array.from({ length: n - 1 }, () => ri(rng, target - 5, target + 4));
    const need = target * n - scores.reduce((s, v) => s + v, 0);
    if (need < 1 || need > target + 10) return year7['y7-data'](rng, diff);
    return {
      prompt: `After $${n - 1}$ rounds of a quiz, ${rc(rng, NAMES)}'s scores are $${scores.join(',\\ ')}$. What must they score in round $${n}$ so that their **mean** across all $${n}$ rounds is exactly $${target}$?`,
      answerType: 'numeric', answer: { value: need },
      traps: [{ value: target, why: `Scoring the mean itself won't lift the average enough — work out the total needed (${target} × ${n}) and subtract the points so far.` }],
      hints: [`If the mean of ${n} rounds is ${target}, what must the *total* be?`, `Total needed $= ${target} \\times ${n} = ${target * n}$.`, `Subtract the points so far: $${target * n} - ${scores.reduce((s, v) => s + v, 0)}$.`],
      steps: [
        { h: 'Total required', d: `$${target} \\times ${n} = ${target * n}$` },
        { h: 'Points so far', d: `$${scores.join(' + ')} = ${scores.reduce((s, v) => s + v, 0)}$` },
        { h: 'Round-' + n + ' score', d: `$${target * n} - ${scores.reduce((s, v) => s + v, 0)} = ${need}$` }
      ]
    };
  }
};
