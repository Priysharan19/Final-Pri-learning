// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Year 8 generators
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, rs, nz, gcd, Frac, mcq, term, sgn, moneyPlain, r1, r2, r3, NAMES, ITEMS } from '../qhelpers.js';
import { figCircle } from '../figures.js';

export const year8 = {

  // ── Index notation & laws ────────────────────────────────────────────────
  'y8-indices': (rng, diff) => {
    if (diff === 1) {
      const b = ri(rng, 2, 9), p = ri(rng, 2, b === 2 ? 9 : b === 3 ? 6 : b <= 5 ? 5 : 4);
      const negBase = rng() < 0.35;
      const val = (negBase && p % 2 === 1 ? -1 : 1) * b ** p;
      const baseTex = negBase ? `(-${b})` : `${b}`;
      const factor = negBase ? `(-${b})` : `${b}`;
      return {
        prompt: `Evaluate $${baseTex}^{${p}}$.`,
        answerType: 'numeric', answer: { value: val },
        traps: [
          { value: b * p, why: `$${baseTex}^{${p}}$ means ${negBase ? `$-${b}$` : b} multiplied by itself ${p} times — not $${b} \\times ${p}$.` },
          { value: -val, why: negBase ? `An even number of negative factors gives a positive product, an odd number gives a negative one — here there are ${p}.` : 'A positive base raised to a whole-number power is always positive.' }
        ].filter(t => t.value !== val),
        hints: [
          `$${baseTex}^{${p}}$ means repeated multiplication.`,
          `Write it out: $${Array(p).fill(factor).join(' \\times ')}$.`,
          negBase ? `${p % 2 === 0 ? 'An even' : 'An odd'} number of negative factors, so the answer is ${p % 2 === 0 ? 'positive' : 'negative'}.` : `Build it up: $${b}^2 = ${b * b}$, then keep multiplying by ${b}.`
        ],
        steps: [
          { h: 'Expand the power', d: `$${baseTex}^{${p}} = ${Array(p).fill(factor).join(' \\times ')}$` },
          { h: 'Multiply', d: `$= ${val}$` }
        ]
      };
    }
    if (diff === 2) {
      const p = ri(rng, 2, 9), q = ri(rng, 2, 9);
      const div = rc(rng, [true, false]);
      const big = Math.max(p, q) + ri(rng, 1, 5);
      const [e1, e2] = div ? [big, Math.min(p, q)] : [p, q];
      const ansP = div ? e1 - e2 : e1 + e2;
      return {
        prompt: `Simplify $x^{${e1}} ${div ? '\\div' : '\\times'} x^{${e2}}$, giving your answer in index form.`,
        answerType: 'expression', answer: { expr: `x^${ansP}`, positiveOnly: true },
        inputHint: `e.g. x^${ansP + 1}`,
        traps: [{ expr: `x^${div ? e1 / e2 === Math.floor(e1 / e2) ? e1 / e2 : e1 * e2 : e1 * e2}`, why: div ? 'When dividing powers of the same base, *subtract* the indices.' : 'When multiplying powers of the same base, *add* the indices (don’t multiply them).' }],
        hints: [`Same base — so a single index law applies.`, div ? 'Dividing powers: subtract the indices.' : 'Multiplying powers: add the indices.', `$${e1} ${div ? '-' : '+'} ${e2} = ${ansP}$.`],
        steps: [
          { h: div ? 'Quotient law' : 'Product law', d: div ? `$x^{a} \\div x^{b} = x^{a-b}$` : `$x^{a} \\times x^{b} = x^{a+b}$` },
          { h: 'Apply it', d: `$x^{${e1} ${div ? '-' : '+'} ${e2}} = x^{${ansP}}$` }
        ]
      };
    }
    if (diff === 3) {
      const p = ri(rng, 2, 5), q = ri(rng, 2, 5), r = ri(rng, 1, 6);
      const ansP = p * q + r;
      return {
        prompt: `Simplify $(x^{${p}})^{${q}} \\times x^{${r}}$, giving your answer in index form.`,
        answerType: 'expression', answer: { expr: `x^${ansP}`, positiveOnly: true },
        inputHint: 'e.g. x^9',
        traps: [
          { expr: `x^${p + q + r}`, why: 'A power of a power *multiplies* the indices: $(x^a)^b = x^{ab}$.' },
          { expr: `x^${p * q * r}`, why: 'Only the bracket multiplies indices — the final $\\times x^{' + r + '}$ *adds* ' + r + '.' }
        ],
        hints: ['Deal with the bracket first.', `$(x^{${p}})^{${q}} = x^{${p * q}}$.`, `Then add the remaining index: $${p * q} + ${r}$.`],
        steps: [
          { h: 'Power of a power', d: `$(x^{${p}})^{${q}} = x^{${p} \\times ${q}} = x^{${p * q}}$` },
          { h: 'Product law', d: `$x^{${p * q}} \\times x^{${r}} = x^{${p * q} + ${r}} = x^{${ansP}}$` }
        ]
      };
    }
    const a = ri(rng, 2, 5), b = ri(rng, 2, 6), c = ri(rng, 2, 5), d = ri(rng, 1, 3);
    const coef = a * c, pow = b + d - (b + d); // combined simplify with zero index twist
    const e1 = b + d, e2 = b + d;
    return {
      prompt: `Simplify $\\dfrac{${a}x^{${b}} \\times ${c}x^{${d}}}{x^{${e1}}}$.`,
      answerType: 'numeric', answer: { value: coef },
      traps: [
        { value: 0, why: `$x^0 = 1$, not 0 — anything (except 0) to the power 0 is 1.` },
        { value: a * c * (b + d) / e1, why: 'Handle coefficients and indices separately: multiply the numbers, add then subtract the indices.' }
      ],
      hints: ['Multiply coefficients; add indices on top, then subtract the bottom index.', `Top: $${a * c}x^{${b + d}}$. Now subtract the index below.`, `$x^{${b + d} - ${e1}} = x^0$ — and what is $x^0$?`],
      steps: [
        { h: 'Multiply the numerator', d: `$${a}x^{${b}} \\times ${c}x^{${d}} = ${a * c}x^{${b + d}}$` },
        { h: 'Quotient law', d: `$\\dfrac{${a * c}x^{${b + d}}}{x^{${e1}}} = ${a * c}x^{${b + d} - ${e1}} = ${a * c}x^{0}$` },
        { h: 'Zero index', d: `$x^0 = 1$, so the answer is $${coef}$` }
      ]
    };
  },

  // ── Percentage change ────────────────────────────────────────────────────
  'y8-percentages': (rng, diff) => {
    if (diff === 1) {
      const base = rc(rng, [40, 60, 80, 120, 150, 200, 240]);
      const pct = rc(rng, [10, 15, 20, 25, 30, 50]);
      const inc = rc(rng, [true, false]);
      const ansV = inc ? base * (1 + pct / 100) : base * (1 - pct / 100);
      return {
        prompt: `${inc ? 'Increase' : 'Decrease'} $${base}$ by $${pct}\\%$.`,
        answerType: 'numeric', answer: { value: ansV },
        traps: [{ value: base * pct / 100, why: `That's just the ${pct}% itself — the question asks for the value *after* the ${inc ? 'increase' : 'decrease'}.` }],
        hints: [`First find ${pct}% of ${base}.`, `${pct}% of ${base} is ${base * pct / 100}.`, `${inc ? 'Add it to' : 'Subtract it from'} ${base}.`],
        steps: [
          { h: `Find ${pct}%`, d: `$${pct}\\% \\times ${base} = ${base * pct / 100}$` },
          { h: inc ? 'Add it on' : 'Take it off', d: `$${base} ${inc ? '+' : '-'} ${base * pct / 100} = ${ansV}$` },
          { h: 'Shortcut', d: `One step: $${base} \\times ${inc ? 1 + pct / 100 : 1 - pct / 100} = ${ansV}$` }
        ]
      };
    }
    if (diff === 2) {
      const item = rc(rng, ITEMS);
      const price = ri(rng, item.price[0] / 10, item.price[1] / 10) * 10;
      const pct = rc(rng, [10, 15, 20, 25, 30, 40]);
      const sale = price * (1 - pct / 100);
      return {
        prompt: `In a sale, ${item.name} priced at ${moneyPlain(price)} is discounted by $${pct}\\%$. What is the sale price?`,
        answerType: 'numeric', answer: { value: r2(sale) }, answerPrefix: '$',
        traps: [{ value: r2(price * pct / 100), why: `${moneyPlain(price * pct / 100)} is the discount amount — the sale price is what's left after taking it off.` }],
        hints: ['You can find the discount then subtract, or multiply by the remaining percentage.', `Paying after a ${pct}% discount means paying ${100 - pct}%.`, `$${price} \\times ${(100 - pct) / 100}$.`],
        steps: [
          { h: 'Remaining percentage', d: `$100\\% - ${pct}\\% = ${100 - pct}\\%$` },
          { h: 'Multiply', d: `$${price} \\times ${(100 - pct) / 100} = ${r2(sale)}$ → ${moneyPlain(sale)}` }
        ]
      };
    }
    if (diff === 3) {
      const cost = rc(rng, [50, 80, 120, 160, 200, 250]);
      const pct = rc(rng, [15, 20, 25, 30, 40, 60]);
      const profit = rc(rng, [true, false]);
      const sell = profit ? cost * (1 + pct / 100) : cost * (1 - pct / 100);
      return {
        prompt: `A retailer buys ${rc(rng, ITEMS).name} for ${moneyPlain(cost)} and sells it for ${moneyPlain(sell)}. Find the percentage ${profit ? 'profit' : 'loss'}.`,
        answerType: 'numeric', answer: { value: pct, percent: true }, answerSuffix: '%',
        traps: [{ value: r1(Math.abs(sell - cost) / sell * 100), why: 'Percentage profit or loss is measured against the *cost* price, not the selling price.' }],
        hints: [`Find the actual ${profit ? 'profit' : 'loss'} in dollars first.`, `${profit ? 'Profit' : 'Loss'} $= ${moneyPlain(Math.abs(sell - cost))}$. Now compare it with the cost.`, `$\\frac{${Math.abs(sell - cost)}}{${cost}} \\times 100$.`],
        steps: [
          { h: profit ? 'Profit' : 'Loss', d: `$${Math.abs(sell - cost).toFixed(2).replace(/\\.00$/, '')} = |${sell} - ${cost}|$ dollars` },
          { h: 'Divide by the cost price', d: `$\\dfrac{${Math.abs(sell - cost)}}{${cost}} = ${r3(Math.abs(sell - cost) / cost)}$` },
          { h: 'As a percentage', d: `$${r3(Math.abs(sell - cost) / cost)} \\times 100\\% = ${pct}\\%$` }
        ]
      };
    }
    const price = rc(rng, [60, 80, 90, 110, 140, 150]);
    const up = rc(rng, [20, 25, 50]);
    const down = rc(rng, [10, 20, 25]);
    const final = price * (1 + up / 100) * (1 - down / 100);
    return {
      prompt: `A concert ticket costs ${moneyPlain(price)}. The price rises by $${up}\\%$, then the new price is discounted by $${down}\\%$. What is the final price?`,
      answerType: 'numeric', answer: { value: r2(final) }, answerPrefix: '$',
      traps: [{ value: r2(price * (1 + (up - down) / 100)), why: `Percentage changes don’t simply cancel: the ${down}% comes off the *increased* price, so apply the multipliers one after another.` }],
      hints: ['Apply the two changes one at a time, in order.', `After the rise: $${price} \\times ${1 + up / 100}$.`, `Then multiply that by $${1 - down / 100}$.`],
      steps: [
        { h: 'After the rise', d: `$${price} \\times ${1 + up / 100} = ${r2(price * (1 + up / 100))}$` },
        { h: 'After the discount', d: `$${r2(price * (1 + up / 100))} \\times ${1 - down / 100} = ${r2(final)}$ → ${moneyPlain(final)}` },
        { h: 'Note', d: `Overall multiplier: $${1 + up / 100} \\times ${1 - down / 100} = ${r3((1 + up / 100) * (1 - down / 100))}$ — not $${1 + (up - down) / 100}$.` }
      ]
    };
  },

  // ── Algebraic techniques ─────────────────────────────────────────────────
  'y8-algebra': (rng, diff) => {
    if (diff === 1) {
      const a = ri(rng, 2, 6), b = nz(rng, -8, 8), k = nz(rng, 2, 5);
      return {
        prompt: `Expand and simplify $${k}(${a}x ${sgn(b)}) ${sgn(-b * k + nz(rng, -5, 5))}$.`.replace(/\s\s+/g, ' '),
        answerType: 'expression', answer: { expr: `${k * a}x + ${k * b + (-b * k + 0)}` },
        // regenerate deterministically below — simpler branch:
        regen: true
      };
    }
    if (diff === 2) {
      const g = ri(rng, 2, 6), p = ri(rng, 2, 5), q = nz(rng, -6, 6);
      const A = g * p, B = g * q;
      return {
        prompt: `Factorise $${A}x ${sgn(B)}$ fully.`,
        answerType: 'expression', answer: { expr: `${g}(${p}x + ${q})`, anyOf: [`${g}(${p}x ${sgn(q)})`] },
        inputHint: `e.g. ${g}(2x + 3)`,
        traps: [{ expr: `${g / (g % 2 === 0 ? 2 : 1) === g ? 2 : g / 2}(${A / 2}x + ${B / 2})`, why: 'A common factor was taken out, but not the *highest* one — check whether the bracket still has a common factor.' }],
        hints: ['Find the highest number that divides both terms.', `$\\text{HCF}(${A}, ${Math.abs(B)}) = ${g}$.`, `Write $${g}(\\; ? \\;x + \\;?\\;)$ and fill in the bracket.`],
        steps: [
          { h: 'Highest common factor', d: `$\\text{HCF}(${A}, ${Math.abs(B)}) = ${g}$` },
          { h: 'Divide each term by it', d: `$${A}x \\div ${g} = ${p}x$ and $${B} \\div ${g} = ${q}$` },
          { h: 'Write as a product', d: `$${g}(${p}x ${sgn(q)})$` },
          { h: 'Check by expanding', d: `$${g} \\times ${p}x = ${A}x$ ✓` }
        ]
      };
    }
    if (diff === 3) {
      const k = nz(rng, -5, -2), a = ri(rng, 2, 5), b = nz(rng, -7, 7), c = ri(rng, 2, 9);
      const xc = k * a, kk = k * b + c;
      return {
        prompt: `Expand and simplify $${c} ${k < 0 ? '-' : '+'} ${Math.abs(k)}(${a}x ${sgn(b)})$.`,
        answerType: 'expression', answer: { expr: `${xc}x + ${kk}` },
        inputHint: 'e.g. -6x + 11',
        traps: [{ expr: `${Math.abs(k) * a}x + ${c + Math.abs(k) * b}`, why: `The minus sign belongs to the ${Math.abs(k)} — it multiplies *both* terms in the bracket, flipping their signs.` }],
        hints: ['The number in front of the bracket (including its sign) multiplies every term inside.', `$${k} \\times ${a}x = ${k * a}x$ and $${k} \\times ${b < 0 ? `(${b})` : b} = ${k * b}$.`, 'Then combine with the constant at the front.'],
        steps: [
          { h: 'Expand (watch the sign)', d: `$${k}(${a}x ${sgn(b)}) = ${k * a}x ${sgn(k * b)}$` },
          { h: 'Combine constants', d: `$${c} ${sgn(k * b)} = ${kk}$` },
          { h: 'Result', d: `$${term(xc)} ${sgn(kk)}$` }
        ]
      };
    }
    const g = ri(rng, 2, 4), p = ri(rng, 2, 5), q = nz(rng, 2, 7);
    const A = g * p, B = g * q;
    return {
      prompt: `Factorise $${A}x^2 ${sgn(B)}x$ fully.`,
      answerType: 'expression', answer: { expr: `${g}x(${p}x + ${q})`, positiveOnly: true },
      inputHint: `e.g. ${g}x(2x + 5)`,
      traps: [
        { expr: `${g}(${p}x^2 + ${q}x)`, why: 'Both terms also share an $x$ — take it out along with the number.' },
        { expr: `x(${A}x + ${B})`, why: `Both terms also share the number ${g} — the highest common factor is ${g}x.` }
      ],
      hints: ['Both terms share a number *and* a power of x.', `$\\text{HCF} = ${g}x$.`, `$${A}x^2 \\div ${g}x = ${p}x$ and $${B}x \\div ${g}x = ${q}$.`],
      steps: [
        { h: 'Common factor', d: `$\\text{HCF}(${A}x^2, ${B}x) = ${g}x$` },
        { h: 'Divide each term', d: `$${A}x^2 \\div ${g}x = ${p}x$, $\\quad ${B}x \\div ${g}x = ${q}$` },
        { h: 'Write as a product', d: `$${g}x(${p}x ${sgn(q)})$` },
        { h: 'Check', d: `Expanding gives $${A}x^2 ${sgn(B)}x$ ✓` }
      ]
    };
  },

  // ── Equations with brackets & both sides ─────────────────────────────────
  'y8-equations': (rng, diff) => {
    if (diff === 1) {
      const x = ri(rng, -7, 12), a = rc(rng, [2, 3, 4, 5, 6]), b = nz(rng, -12, 12);
      const c = a * x + b;
      return {
        prompt: `Solve $${a}x ${sgn(b)} = ${c}$.`,
        answerType: 'numeric', answer: { value: x }, answerPrefix: 'x =',
        stepcheck: { kind: 'equation', variable: 'x', solutions: [x] },
        traps: [{ value: (c + b) / a, why: `Undo the ${sgn(b)} with its opposite first.` }],
        hints: ['Undo addition/subtraction first, then the multiplication.', `$${a}x = ${c - b}$.`, `Divide by ${a}.`],
        steps: [
          { h: `${b >= 0 ? 'Subtract' : 'Add'} ${Math.abs(b)}`, d: `$${a}x = ${c - b}$` },
          { h: `Divide by ${a}`, d: `$x = ${x}$` },
          { h: 'Check', d: `$${a}(${x}) ${sgn(b)} = ${c}$ ✓` }
        ]
      };
    }
    if (diff === 2) {
      const x = ri(rng, -6, 10), a = rc(rng, [2, 3, 4]), b = nz(rng, -6, 6), d = nz(rng, -9, 9);
      const c = a * (x + b) + d;
      return {
        prompt: `Solve $${a}(${x >= 0 || true ? `x ${sgn(b)}` : ''}) ${sgn(d)} = ${c}$.`,
        answerType: 'numeric', answer: { value: x }, answerPrefix: 'x =',
        stepcheck: { kind: 'equation', variable: 'x', solutions: [x] },
        traps: [{ value: (c - d - b) / a, why: `Expanding gives $${a}x ${sgn(a * b)}$ — the ${b < 0 ? '' : '+'}${b} inside the bracket is multiplied by ${a}.` }],
        hints: [`Move the ${sgn(d)} first, then deal with the bracket.`, `$${a}(x ${sgn(b)}) = ${c - d}$.`, `Divide by ${a}: $x ${sgn(b)} = ${(c - d) / a}$.`],
        steps: [
          { h: `${d >= 0 ? 'Subtract' : 'Add'} ${Math.abs(d)}`, d: `$${a}(x ${sgn(b)}) = ${c - d}$` },
          { h: `Divide by ${a}`, d: `$x ${sgn(b)} = ${(c - d) / a}$` },
          { h: 'Solve', d: `$x = ${x}$` },
          { h: 'Check', d: `$${a}(${x} ${sgn(b)}) ${sgn(d)} = ${c}$ ✓` }
        ]
      };
    }
    if (diff === 3) {
      const x = ri(rng, -6, 10);
      const a = rc(rng, [4, 5, 6, 7]), c = rc(rng, [2, 3]);
      const b = nz(rng, -10, 10);
      const d = (a - c) * x + b; // a x + b = c x + d  with solution x
      if (rng() < 0.3) {
        const sb = b >= 0 ? `+ ${b}` : `- ${-b}`;
        const sd = d >= 0 ? `+ ${d}` : `- ${-d}`;
        return {
          prompt: `Solve $${a}x ${sgn(b)} = ${c}x ${sgn(d)}$, showing **every line** of your working. Marks come from the reasoning, not just the answer.`,
          answerType: 'working',
          answer: {
            stepMeta: { kind: 'equation', variable: 'x', solutions: [x] },
            minLines: 2,
            canonicalWorking: `${a}x ${sb} = ${c}x ${sd}\n${a - c}x = ${d - b}\nx = ${x}`
          },
          inputHint: 'One line per step, ending with x = …',
          traps: [],
          hints: ['Gather the x terms on one side and the numbers on the other.', `Subtract $${c}x$ from both sides.`, `Finish with a line that says $x = …$`],
          steps: [
            { h: `Subtract ${c}x from both sides`, d: `$${a - c}x ${sgn(b)} = ${d}$` },
            { h: `${b >= 0 ? 'Subtract' : 'Add'} ${Math.abs(b)}`, d: `$${a - c}x = ${d - b}$` },
            { h: `Divide by ${a - c}`, d: `$x = ${x}$` }
          ]
        };
      }
      return {
        prompt: `Solve $${a}x ${sgn(b)} = ${c}x ${sgn(d)}$.`,
        answerType: 'numeric', answer: { value: x }, answerPrefix: 'x =',
        stepcheck: { kind: 'equation', variable: 'x', solutions: [x] },
        traps: [{ value: (d - b) / (a + c), why: `When $${c}x$ moves across the equals sign it becomes $-${c}x$: the x-coefficient is $${a} - ${c}$, not $${a} + ${c}$.` }],
        hints: ['Gather the x terms on one side and the numbers on the other.', `Subtract $${c}x$ from both sides: $${a - c}x ${sgn(b)} = ${d}$.`, `Now ${b >= 0 ? 'subtract' : 'add'} $${Math.abs(b)}$ and divide.`],
        steps: [
          { h: `Subtract ${c}x from both sides`, d: `$${a - c}x ${sgn(b)} = ${d}$` },
          { h: `${b >= 0 ? 'Subtract' : 'Add'} ${Math.abs(b)}`, d: `$${a - c}x = ${d - b}$` },
          { h: `Divide by ${a - c}`, d: `$x = ${x}$` },
          { h: 'Check', d: `LHS $= ${a * x + b}$, RHS $= ${c * x + d}$ ✓` }
        ]
      };
    }
    const x = ri(rng, 2, 12);
    const k = rc(rng, [2, 3]), a = ri(rng, 3, 9);
    const other = k * (x + a) - x - a - ri(rng, 1, 5); // ensure worded consistency below
    const years = k * (x + a) - (x + a) === (k - 1) * (x + a) ? a : a;
    const child = x, parentNow = k * x + ri(rng, 2, 6) * 0;
    const add = ri(rng, 3, 12);
    const parent = k * (child + add) - add;
    return {
      prompt: `${rc(rng, NAMES)} is $${child}$ years old. In $${add}$ years, their coach will be exactly $${k}$ times as old as them. How old is the coach **now**?`,
      answerType: 'numeric', answer: { value: parent },
      traps: [{ value: k * child, why: `“${k} times as old” happens in ${add} years — set up the equation at that future time, then come back to now.` }],
      hints: [`In ${add} years the player is ${child + add}.`, `So the coach will be $${k} \\times ${child + add} = ${k * (child + add)}$ then.`, `Subtract ${add} to come back to today.`],
      steps: [
        { h: `Age in ${add} years`, d: `Player: $${child} + ${add} = ${child + add}$` },
        { h: 'Coach at that time', d: `$${k} \\times ${child + add} = ${k * (child + add)}$` },
        { h: 'Coach now', d: `$${k * (child + add)} - ${add} = ${parent}$` },
        { h: 'Check', d: `In ${add} years: coach $${parent + add}$, player $${child + add}$ — ratio $${k}:1$ ✓` }
      ]
    };
  },

  // ── Linear relationships ─────────────────────────────────────────────────
  'y8-linear': (rng, diff) => {
    if (diff === 1) {
      const m = nz(rng, -4, 4), c = nz(rng, -8, 8), x = ri(rng, -4, 6);
      const y = m * x + c;
      return {
        prompt: `A line has equation $y = ${term(m)} ${sgn(c)}$. Find $y$ when $x = ${x}$.`,
        answerType: 'numeric', answer: { value: y }, answerPrefix: 'y =',
        traps: [{ value: m * x - c, why: `Watch the sign of the constant: it is ${sgn(c)}.` }],
        hints: ['Substitute the x-value into the rule.', `$y = ${m} \\times ${x < 0 ? `(${x})` : x} ${sgn(c)}$.`, `$${m} \\times ${x} = ${m * x}$.`],
        steps: [
          { h: 'Substitute', d: `$y = ${m} \\times ${x < 0 ? `(${x})` : x} ${sgn(c)}$` },
          { h: 'Evaluate', d: `$y = ${m * x} ${sgn(c)} = ${y}$` }
        ]
      };
    }
    if (diff === 2) {
      const x1 = ri(rng, -5, 4), y1 = ri(rng, -6, 6);
      const dx = nz(rng, 1, 5), m = nz(rng, -3, 3);
      const x2 = x1 + dx, y2 = y1 + m * dx;
      return {
        prompt: `Find the gradient of the line through $(${x1}, ${y1})$ and $(${x2}, ${y2})$.`,
        answerType: 'numeric', answer: { value: m }, answerPrefix: 'm =',
        traps: [
          { value: m === 0 ? 99 : 1 / m === Math.floor(1 / m) ? 1 / m : dx / (y2 - y1), why: 'Gradient is rise over run: $\\frac{y_2 - y_1}{x_2 - x_1}$ — it looks like the fraction is upside-down.', tol: 0.001 },
          { value: (y2 + y1) / (x2 + x1 === 0 ? 1 : x2 + x1), why: 'Use the *differences* of the coordinates, not their sums.', tol: 0.001 }
        ],
        hints: ['Gradient = rise ÷ run.', `Rise $= ${y2} - ${y1 < 0 ? `(${y1})` : y1}$, run $= ${x2} - ${x1 < 0 ? `(${x1})` : x1}$.`, `$m = \\frac{${y2 - y1}}{${x2 - x1}}$.`],
        steps: [
          { h: 'Rise and run', d: `Rise $= ${y2} - (${y1}) = ${y2 - y1}$, run $= ${x2} - (${x1}) = ${x2 - x1}$` },
          { h: 'Divide', d: `$m = \\dfrac{${y2 - y1}}{${x2 - x1}} = ${m}$` }
        ]
      };
    }
    if (diff === 3) {
      const m = nz(rng, -4, 4), c = nz(rng, -7, 7);
      const mm = mcq(rng, `gradient $${m}$, y-intercept $${c}$`, [
        { text: `gradient $${c}$, y-intercept $${m}$`, why: 'In $y = mx + c$ the gradient is the coefficient *of x* — the constant is where the line crosses the y-axis.' },
        { text: `gradient $${-m}$, y-intercept $${c}$` },
        { text: `gradient $${m}$, y-intercept $${-c}$` }
      ]);
      return {
        prompt: `For the line $y = ${term(m)} ${sgn(c)}$, identify the gradient and the y-intercept.`,
        answerType: 'mcq', answer: { correctIndex: mm.correctIndex, optionTraps: mm.optionTraps }, mcqOptions: mm.options,
        hints: ['Compare with $y = mx + c$.', 'm multiplies x; c stands alone.', `Here $m = ${m}$ and $c = ${c}$.`],
        steps: [
          { h: 'Match to y = mx + c', d: `$m = ${m}$ (slope), $c = ${c}$ (crossing point on the y-axis)` }
        ]
      };
    }
    const m = nz(rng, -4, 4), xInt = nz(rng, -6, 6);
    const c = -m * xInt;
    return {
      prompt: `Find the x-intercept of the line $y = ${term(m)} ${sgn(c)}$.`,
      answerType: 'point', answer: { x: xInt, y: 0 },
      inputHint: 'e.g. (4, 0)',
      traps: [{ why: 'The x-intercept is where the line crosses the x-axis, i.e. where $y = 0$.' }],
      hints: ['On the x-axis, the y-coordinate is 0.', `Set $y = 0$: $0 = ${term(m)} ${sgn(c)}$.`, `Solve: $x = ${xInt}$.`],
      steps: [
        { h: 'Set y = 0', d: `$0 = ${term(m)} ${sgn(c)}$` },
        { h: 'Solve for x', d: `$${term(-m)} = ${c}$, so $x = ${xInt}$` },
        { h: 'Write as a point', d: `$(${xInt}, 0)$` }
      ]
    };
  },

  // ── Circles ──────────────────────────────────────────────────────────────
  'y8-circles': (rng, diff) => {
    if (diff === 1) {
      const r = ri(rng, 3, 40);
      const useD = rc(rng, [true, false]);
      const C = 2 * Math.PI * r;
      return {
        prompt: `The circle shown has ${useD ? `diameter $${2 * r}$` : `radius $${r}$`} cm. Find its circumference, correct to 1 decimal place.`,
        figure: figCircle({ label: useD ? `d = ${2 * r} cm` : `r = ${r} cm`, diameter: useD }),
        answerType: 'numeric', answer: { value: r1(C), tol: 0.06 }, answerSuffix: 'cm',
        traps: [{ value: r1(Math.PI * (useD ? r : r * r)), why: useD ? 'With a diameter, use $C = \\pi d$ directly — halving first gives the radius, then you must double again.' : 'That mixes up the formulas — circumference is $2\\pi r$, area is $\\pi r^2$.', tol: 0.06 }],
        hints: ['Circumference: $C = 2\\pi r$ or $C = \\pi d$.', useD ? `$C = \\pi \\times ${2 * r}$.` : `$C = 2\\pi \\times ${r}$.`, `$\\approx ${r1(C)}$.`],
        steps: [
          { h: 'Formula', d: useD ? `$C = \\pi d$` : `$C = 2\\pi r$` },
          { h: 'Substitute', d: useD ? `$C = \\pi \\times ${2 * r} = ${r3(C)}\\ldots$` : `$C = 2\\pi \\times ${r} = ${r3(C)}\\ldots$` },
          { h: 'Round', d: `$C \\approx ${r1(C)}$ cm` }
        ]
      };
    }
    if (diff === 2) {
      const r = ri(rng, 3, 40);
      const useD = rc(rng, [true, false]);
      const A = Math.PI * r * r;
      return {
        prompt: `A circular pizza, shown below, has ${useD ? `diameter $${2 * r}$` : `radius $${r}$`} cm. Find its area, correct to 1 decimal place.`,
        figure: figCircle({ label: useD ? `d = ${2 * r} cm` : `r = ${r} cm`, diameter: useD }),
        answerType: 'numeric', answer: { value: r1(A), tol: 0.06 }, answerSuffix: 'cm²',
        traps: [
          useD ? { value: r1(Math.PI * 2 * r * 2 * r), why: 'Area uses the *radius* — halve the diameter before squaring.', tol: 0.1 } : { value: r1(2 * Math.PI * r), why: 'That’s the circumference — area is $\\pi r^2$.', tol: 0.06 },
          { value: r1(Math.PI * r * 2), why: '$r^2$ means $r \\times r$, not $r \\times 2$.', tol: 0.06 }
        ],
        hints: ['Area: $A = \\pi r^2$.', useD ? `The radius is half of ${2 * r}, i.e. ${r}.` : `Square the radius first: $${r}^2 = ${r * r}$.`, `$A = \\pi \\times ${r * r}$.`],
        steps: [
          ...(useD ? [{ h: 'Radius from diameter', d: `$r = ${2 * r} \\div 2 = ${r}$` }] : []),
          { h: 'Formula', d: `$A = \\pi r^2 = \\pi \\times ${r}^2$` },
          { h: 'Evaluate and round', d: `$A = ${r3(A)}\\ldots \\approx ${r1(A)}$ cm²` }
        ]
      };
    }
    if (diff === 3) {
      const r = ri(rng, 3, 40);
      const part = rc(rng, ['semicircle', 'quarter circle']);
      const arc = part === 'semicircle' ? Math.PI * r : Math.PI * r / 2;
      const straight = part === 'semicircle' ? 2 * r : 2 * r;
      const P = arc + straight;
      const edgeNote = part === 'semicircle' ? 'the straight diameter' : 'two straight radii';
      return {
        prompt: `Find the **perimeter** of a ${part} with radius $${r}$ cm, correct to 1 decimal place. (Don't forget ${edgeNote}.)`,
        answerType: 'numeric', answer: { value: r1(P), tol: 0.06 }, answerSuffix: 'cm',
        traps: [
          { value: r1(arc), why: `That’s only the curved part — the perimeter also includes ${edgeNote}.`, tol: 0.06 },
          { value: r1(arc + r), why: part === 'semicircle' ? 'The straight edge is the *diameter* ($2r$), not the radius.' : 'A quarter circle has *two* straight radii, not one.', tol: 0.06 }
        ],
        hints: [
          `A ${part}’s boundary = ${part === 'semicircle' ? 'half' : 'a quarter'} of the circumference + ${edgeNote}.`,
          `Curved part: $\\tfrac{1}{${part === 'semicircle' ? 2 : 4}} \\times 2\\pi \\times ${r} = ${r3(arc)}\\ldots$`,
          `Add the straight edges: $${straight}$.`
        ],
        steps: [
          { h: 'Curved edge', d: `$\\tfrac{1}{${part === 'semicircle' ? 2 : 4}} \\times 2\\pi \\times ${r} = ${r3(arc)}\\ldots$` },
          { h: 'Straight edges', d: `$${straight}$ cm` },
          { h: 'Total', d: `$${r3(arc)}\\ldots + ${straight} \\approx ${r1(P)}$ cm` }
        ]
      };
    }
    const r = ri(rng, 3, 40);
    const fromArea = rng() < 0.4;
    if (fromArea) {
      const A = r1(Math.PI * r * r);
      return {
        prompt: `A circular pond has area $${A}$ m². Find its radius, correct to 1 decimal place.`,
        answerType: 'numeric', answer: { value: r, tol: 0.06 }, answerSuffix: 'm',
        traps: [{ value: r1(A / Math.PI), why: 'Dividing by $\\pi$ gives $r^2$ — take the square root as well.', tol: 0.06 }],
        hints: ['Rearrange $A = \\pi r^2$.', `$r^2 = \\dfrac{${A}}{\\pi} = ${r3(A / Math.PI)}\\ldots$`, 'Now take the square root.'],
        steps: [
          { h: 'Rearrange the formula', d: `$r = \\sqrt{\\dfrac{A}{\\pi}}$` },
          { h: 'Substitute', d: `$r = \\sqrt{\\dfrac{${A}}{\\pi}} = \\sqrt{${r3(A / Math.PI)}\\ldots}$` },
          { h: 'Round', d: `$r \\approx ${r}$ m` }
        ]
      };
    }
    const C = r1(2 * Math.PI * r);
    return {
      prompt: `A circular running track has circumference $${C}$ m. Find its radius, correct to 1 decimal place.`,
      answerType: 'numeric', answer: { value: r, tol: 0.06 }, answerSuffix: 'm',
      traps: [{ value: r1(C / Math.PI), why: '$C = 2\\pi r$ — divide by $2\\pi$, not just $\\pi$ (or you’ll get the diameter).', tol: 0.06 }],
      hints: ['Rearrange $C = 2\\pi r$.', `$r = \\dfrac{C}{2\\pi}$.`, `$r = ${C} \\div ${r3(2 * Math.PI)}$.`],
      steps: [
        { h: 'Rearrange the formula', d: `$r = \\dfrac{C}{2\\pi}$` },
        { h: 'Substitute', d: `$r = \\dfrac{${C}}{2\\pi} = ${r3(C / (2 * Math.PI))}\\ldots$` },
        { h: 'Round', d: `$r \\approx ${r}$ m` }
      ]
    };
  },

  // ── Volume & capacity ────────────────────────────────────────────────────
  'y8-volume': (rng, diff) => {
    if (diff === 1) {
      const l = ri(rng, 3, 12), w = ri(rng, 2, 9), h = ri(rng, 2, 8);
      return {
        prompt: `Find the volume of a rectangular prism $${l}$ cm long, $${w}$ cm wide and $${h}$ cm high.`,
        answerType: 'numeric', answer: { value: l * w * h }, answerSuffix: 'cm³',
        traps: [{ value: 2 * (l * w + l * h + w * h), why: 'That’s the surface area — volume is length × width × height.' }],
        hints: ['Volume of a prism: area of the base × height.', `Base area: $${l} \\times ${w}$.`, `Multiply by the height ${h}.`],
        steps: [
          { h: 'Base area', d: `$${l} \\times ${w} = ${l * w}$ cm²` },
          { h: 'Multiply by height', d: `$${l * w} \\times ${h} = ${l * w * h}$ cm³` }
        ]
      };
    }
    if (diff === 2) {
      const b = ri(rng, 4, 12), ht = ri(rng, 3, 9) * 2 / 2, len = ri(rng, 5, 15);
      const ht2 = ri(rng, 2, 5) * 2;
      const V = b * ht2 / 2 * len;
      return {
        prompt: `A tent is a triangular prism. The triangular cross-section has base $${b}$ m and height $${ht2}$ m, and the tent is $${len}$ m long. Find its volume.`,
        answerType: 'numeric', answer: { value: V }, answerSuffix: 'm³',
        traps: [{ value: b * ht2 * len, why: 'The cross-section is a *triangle* — its area is ½ × base × height.' }],
        hints: ['Volume = area of the triangular cross-section × length.', `Triangle area: $\\frac{1}{2} \\times ${b} \\times ${ht2}$.`, `Multiply by ${len}.`],
        steps: [
          { h: 'Cross-section area', d: `$\\tfrac{1}{2} \\times ${b} \\times ${ht2} = ${b * ht2 / 2}$ m²` },
          { h: 'Multiply by length', d: `$${b * ht2 / 2} \\times ${len} = ${V}$ m³` }
        ]
      };
    }
    if (diff === 3) {
      const r = ri(rng, 2, 7), h = ri(rng, 5, 15);
      const V = Math.PI * r * r * h;
      return {
        prompt: `A cylindrical water tank has radius $${r}$ m and height $${h}$ m. Find its volume, correct to 1 decimal place.`,
        answerType: 'numeric', answer: { value: r1(V), tol: 0.06 }, answerSuffix: 'm³',
        traps: [{ value: r1(2 * Math.PI * r * h), why: 'That’s the curved surface area — the volume uses the circular base area $\\pi r^2$.', tol: 0.06 }],
        hints: ['Volume = base area × height, and the base is a circle.', `Base area: $\\pi \\times ${r}^2 = \\pi \\times ${r * r}$.`, `Multiply by ${h} and round.`],
        steps: [
          { h: 'Base area', d: `$\\pi r^2 = \\pi \\times ${r * r} = ${r3(Math.PI * r * r)}\\ldots$ m²` },
          { h: 'Multiply by height', d: `$\\times ${h} = ${r3(V)}\\ldots$` },
          { h: 'Round', d: `$V \\approx ${r1(V)}$ m³` }
        ]
      };
    }
    const l = ri(rng, 20, 60), w = ri(rng, 15, 40), h = ri(rng, 10, 30);
    const litres = l * w * h / 1000;
    return {
      prompt: `A fish tank measures $${l}$ cm × $${w}$ cm × $${h}$ cm. How many **litres** of water does it hold when full? (1 L = 1000 cm³)`,
      answerType: 'numeric', answer: { value: litres }, answerSuffix: 'L',
      traps: [{ value: l * w * h, why: 'That’s the volume in cm³ — divide by 1000 to convert to litres.' }],
      hints: ['Find the volume in cm³ first.', `$${l} \\times ${w} \\times ${h} = ${l * w * h}$ cm³.`, 'Divide by 1000 to convert to litres.'],
      steps: [
        { h: 'Volume in cm³', d: `$${l} \\times ${w} \\times ${h} = ${l * w * h}$ cm³` },
        { h: 'Convert to litres', d: `$${l * w * h} \\div 1000 = ${litres}$ L` }
      ]
    };
  },

  // ── Rates, speed & time ──────────────────────────────────────────────────
  'y8-rates': (rng, diff) => {
    if (diff === 1) {
      const t = ri(rng, 2, 6), v = ri(rng, 40, 110);
      const d = v * t;
      return {
        prompt: `A car travels $${d}$ km in $${t}$ hours. Find its average speed.`,
        answerType: 'numeric', answer: { value: v }, answerSuffix: 'km/h',
        traps: [{ value: d * t, why: 'Speed = distance ÷ time (multiplying gives a meaningless number here).' }],
        hints: ['Speed = distance ÷ time.', `$${d} \\div ${t}$.`, `That's ${v} km each hour.`],
        steps: [{ h: 'Apply s = d ÷ t', d: `$s = \\dfrac{${d}}{${t}} = ${v}$ km/h` }]
      };
    }
    if (diff === 2) {
      const v = ri(rng, 50, 100), t = rc(rng, [1.5, 2.5, 3.5, 0.5, 4.5]);
      const d = v * t;
      const findD = rc(rng, [true, false]);
      return findD ? {
        prompt: `A train travels at $${v}$ km/h for $${t}$ hours. How far does it go?`,
        answerType: 'numeric', answer: { value: d }, answerSuffix: 'km',
        traps: [{ value: v / t, why: 'Distance = speed × time.' }],
        hints: ['Distance = speed × time.', `$${v} \\times ${t}$.`, `${t} hours at ${v} km/h.`],
        steps: [{ h: 'Apply d = s × t', d: `$d = ${v} \\times ${t} = ${d}$ km` }]
      } : {
        prompt: `How long does it take to travel $${d}$ km at $${v}$ km/h? Give your answer in hours.`,
        answerType: 'numeric', answer: { value: t }, answerSuffix: 'hours',
        traps: [{ value: r2(v / d), why: 'Time = distance ÷ speed — check which number goes on top.' }],
        hints: ['Time = distance ÷ speed.', `$${d} \\div ${v}$.`, `Express the answer as a decimal number of hours.`],
        steps: [{ h: 'Apply t = d ÷ s', d: `$t = \\dfrac{${d}}{${v}} = ${t}$ hours` }]
      };
    }
    if (diff === 3) {
      const ms = ri(rng, 2, 35);
      const kmh = r1(ms * 3.6);
      const toKmh = rc(rng, [true, false]);
      return toKmh ? {
        prompt: `A sprinter runs at $${ms}$ m/s. Convert this speed to km/h.`,
        answerType: 'numeric', answer: { value: kmh, tol: 0.011 }, answerSuffix: 'km/h',
        traps: [{ value: r2(ms / 3.6), why: 'm/s → km/h multiplies by 3.6 (3600 seconds per hour, ÷1000 m per km).' }],
        hints: ['How many seconds in an hour? How many metres in a km?', `Per hour: $${ms} \\times 3600$ m.`, `Divide by 1000 for km: $\\times 3.6$ overall.`],
        steps: [
          { h: 'Metres per hour', d: `$${ms} \\times 3600 = ${ms * 3600}$ m/h` },
          { h: 'Convert to km', d: `$${ms * 3600} \\div 1000 = ${kmh}$ km/h` }
        ]
      } : {
        prompt: `A car travels at $${kmh}$ km/h. Convert this speed to m/s.`,
        answerType: 'numeric', answer: { value: ms, tol: 0.01 }, answerSuffix: 'm/s',
        traps: [{ value: r2(kmh * 3.6), why: 'km/h → m/s *divides* by 3.6.' }],
        hints: ['Convert km to m, and hours to seconds.', `$${kmh}$ km/h $= ${r1(kmh * 1000)}$ m per 3600 s.`, `Divide: $${r1(kmh * 1000)} \\div 3600$.`],
        steps: [
          { h: 'Metres per hour', d: `$${kmh} \\times 1000 = ${r1(kmh * 1000)}$ m/h` },
          { h: 'Per second', d: `$${r1(kmh * 1000)} \\div 3600 = ${ms}$ m/s` }
        ]
      };
    }
    const d1 = ri(rng, 3, 8) * 10, v1 = rc(rng, [40, 50, 60]), v2 = rc(rng, [80, 100, 120]);
    const d2 = ri(rng, 3, 8) * 10;
    const t1 = d1 / v1, t2 = d2 / v2;
    const avg = (d1 + d2) / (t1 + t2);
    return {
      prompt: `${rc(rng, NAMES)} cycles $${d1}$ km at $${v1}$ km/h, then rides an e-bike for $${d2}$ km at $${v2}$ km/h. Find the average speed for the whole trip, correct to 1 decimal place.`,
      answerType: 'numeric', answer: { value: r1(avg), tol: 0.06 }, answerSuffix: 'km/h',
      traps: [{ value: (v1 + v2) / 2, why: 'You can’t just average the two speeds — the legs take different amounts of time. Use total distance ÷ total time.' }],
      hints: ['Average speed = total distance ÷ total time.', `Leg times: $${d1}/${v1} = ${r2(t1)}$ h and $${d2}/${v2} = ${r2(t2)}$ h.`, `Total: $${d1 + d2}$ km in $${r2(t1 + t2)}$ h.`],
      steps: [
        { h: 'Time for each leg', d: `$t_1 = \\frac{${d1}}{${v1}} = ${r2(t1)}$ h, $\\quad t_2 = \\frac{${d2}}{${v2}} = ${r2(t2)}$ h` },
        { h: 'Totals', d: `distance $= ${d1 + d2}$ km, time $= ${r2(t1 + t2)}$ h` },
        { h: 'Average speed', d: `$\\dfrac{${d1 + d2}}{${r2(t1 + t2)}} \\approx ${r1(avg)}$ km/h` }
      ]
    };
  },

  // ── Probability ──────────────────────────────────────────────────────────
  'y8-probability': (rng, diff) => {
    if (diff === 1) {
      const red = ri(rng, 2, 6), blue = ri(rng, 2, 6), green = ri(rng, 1, 5);
      const total = red + blue + green;
      const f = new Frac(red, total);
      return {
        prompt: `A bag contains $${red}$ red, $${blue}$ blue and $${green}$ green marbles. One marble is drawn at random. Find $P(\\text{red})$ as a fraction in simplest form.`,
        answerType: 'numeric', answer: { value: f.value, simplestFraction: { n: f.n, d: f.d } },
        inputHint: 'e.g. 1/4',
        traps: [{ value: red / (blue + green), why: 'The denominator is the *total* number of marbles, including the red ones.' }],
        hints: ['P(event) = favourable outcomes ÷ total outcomes.', `Total marbles: $${red} + ${blue} + ${green} = ${total}$.`, `$P = \\frac{${red}}{${total}}$, then simplify.`],
        steps: [
          { h: 'Total outcomes', d: `$${red} + ${blue} + ${green} = ${total}$` },
          { h: 'Favourable outcomes', d: `$${red}$ red marbles` },
          { h: 'Probability', d: `$P(\\text{red}) = \\dfrac{${red}}{${total}} = ${f.latex()}$` }
        ]
      };
    }
    if (diff === 2) {
      const p = rc(rng, [[3, 10], [2, 5], [7, 20], [1, 4], [3, 8], [9, 20], [1, 3], [1, 5], [2, 7], [3, 7], [5, 12], [7, 12], [1, 8], [5, 8], [11, 20], [13, 20], [4, 15], [7, 15], [2, 9], [5, 9], [1, 6], [5, 6], [3, 16], [9, 16], [1, 2], [2, 3], [3, 4], [4, 5], [5, 11], [7, 18]]);
      const f = new Frac(p[0], p[1]);
      const comp = new Frac(p[1] - p[0], p[1]);
      const asDecimal = rng() < 0.45;
      return {
        prompt: `The probability that it rains tomorrow is $${f.latex()}$. Find the probability that it does **not** rain, ${asDecimal ? 'correct to 3 decimal places' : 'as a fraction in simplest form'}.`,
        answerType: 'numeric',
        answer: asDecimal ? { value: r3(comp.value), tol: 0.0006 } : { value: comp.value, simplestFraction: { n: comp.n, d: comp.d } },
        inputHint: asDecimal ? 'e.g. 0.7' : 'e.g. 7/10',
        traps: [{ value: f.value, why: 'That’s the probability it *does* rain — the complement is 1 minus that.' }],
        hints: ['“Rain” and “no rain” cover all possibilities.', 'Complement rule: $P(\\text{not } A) = 1 - P(A)$.', `$1 - ${f.latex()} = \\frac{${p[1]} - ${p[0]}}{${p[1]}}$.`],
        steps: [
          { h: 'Complement rule', d: `$P(\\text{no rain}) = 1 - P(\\text{rain})$` },
          { h: 'Subtract', d: `$1 - ${f.latex()} = ${comp.latex()}$` }
        ]
      };
    }
    if (diff === 3) {
      const p = rc(rng, [[1, 6], [1, 4], [3, 10], [2, 5], [1, 5], [1, 3], [2, 3], [3, 4], [1, 2], [5, 6], [3, 8], [1, 8], [7, 10], [2, 9], [4, 15]]);
      const trials = p[1] * ri(rng, 4, 20) * (p[1] <= 5 ? 2 : 1);
      const f = new Frac(p[0], p[1]);
      const expected = f.value * trials;
      return {
        prompt: `A spinner lands on gold with probability $${f.latex()}$. If it is spun $${trials}$ times, how many golds would you **expect**?`,
        answerType: 'numeric', answer: { value: expected },
        traps: [{ value: trials / p[0], why: `Expected count = probability × number of trials, i.e. $${f.latex()} \\times ${trials}$.` }],
        hints: ['Expected number = probability × trials.', `$${f.latex()} \\times ${trials}$.`, `Divide ${trials} by ${p[1]}, then multiply by ${p[0]}.`],
        steps: [
          { h: 'Expected count', d: `$E = ${f.latex()} \\times ${trials}$` },
          { h: 'Evaluate', d: `$= ${expected}$ golds` }
        ]
      };
    }
    const made = ri(rng, 11, 39), total = rc(rng, [40, 50, 60, 80]);
    const f = new Frac(made, total);
    const next = rc(rng, [200, 300, 400, 500]);
    const exp2 = Math.round(f.value * next);
    return {
      prompt: `In training, a netballer makes $${made}$ of her first $${total}$ shots. Using relative frequency as the probability, how many of her next $${next}$ shots would you expect her to make?`,
      answerType: 'numeric', answer: { value: exp2, tol: 0.6 },
      traps: [{ value: made, why: `${made} was out of ${total} shots — scale the rate up to ${next} shots.` }],
      hints: ['First estimate P(make) from the data.', `$P \\approx \\frac{${made}}{${total}}$.`, `Multiply by ${next} and round sensibly.`],
      steps: [
        { h: 'Relative frequency', d: `$P(\\text{make}) \\approx \\dfrac{${made}}{${total}} = ${r3(f.value)}$` },
        { h: 'Scale up', d: `$${r3(f.value)} \\times ${next} = ${r1(f.value * next)} \\approx ${exp2}$ shots` }
      ]
    };
  }
};

// D1 algebra branch had a placeholder — replace with a clean generator.
year8['y8-algebra'] = ((orig) => (rng, diff) => {
  if (diff !== 1) return orig(rng, diff);
  const k = ri(rng, 2, 6), a = ri(rng, 2, 6), b = nz(rng, -8, 8), c = nz(rng, -9, 9);
  const xc = k * a, kk = k * b + c;
  return {
    prompt: `Expand and simplify $${k}(${a}x ${sgn(b)}) ${sgn(c)}$.`,
    answerType: 'expression', answer: { expr: `${xc}x + ${kk}` },
    inputHint: 'e.g. 8x + 1',
    traps: [{ expr: `${xc}x + ${b + c}`, why: `The ${k} outside multiplies the ${b < 0 ? '' : '+'}${b} inside the bracket too.` }],
    hints: ['Expand the bracket first, then collect the constants.', `$${k}(${a}x ${sgn(b)}) = ${xc}x ${sgn(k * b)}$.`, `Combine $${k * b} ${sgn(c)}$.`],
    steps: [
      { h: 'Expand the bracket', d: `$${k}(${a}x ${sgn(b)}) = ${xc}x ${sgn(k * b)}$` },
      { h: 'Collect constants', d: `$${k * b} ${sgn(c)} = ${kk}$` },
      { h: 'Result', d: `$${term(xc)} ${sgn(kk)}$` }
    ]
  };
})(year8['y8-algebra']);
