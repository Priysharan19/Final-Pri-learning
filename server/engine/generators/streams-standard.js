// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Mathematics Standard generators (MS — Years 11 & 12)
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, rs, nz, Frac, mcq, moneyPlain, r1, r2, r3, rad, NAMES } from '../qhelpers.js';
import { figNetwork } from '../figures.js';

// ── Tiny graph algorithms for MS-N ───────────────────────────────────────────
function dijkstra(n, edges, from, to) {
  const dist = Array(n).fill(Infinity);
  dist[from] = 0;
  const done = Array(n).fill(false);
  for (; ;) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!done[i] && (u === -1 || dist[i] < dist[u])) u = i;
    if (u === -1 || dist[u] === Infinity) break;
    done[u] = true;
    for (const [a, b, w] of edges) {
      if (a === u && dist[u] + w < dist[b]) dist[b] = dist[u] + w;
      if (b === u && dist[u] + w < dist[a]) dist[a] = dist[u] + w;
    }
  }
  return dist[to];
}
function mstWeight(n, edges) {
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = x => parent[x] === x ? x : (parent[x] = find(parent[x]));
  let total = 0;
  for (const [a, b, w] of [...edges].sort((p, q) => p[2] - q[2])) {
    if (find(a) !== find(b)) { parent[find(a)] = find(b); total += w; }
  }
  return total;
}
const TOPO5 = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [1, 4], [1, 3]];
const TOPO4 = [[0, 1], [1, 3], [0, 2], [2, 3], [1, 2]];

export const streamsStandard = {

  // ── MS-F1 · Earning & managing money ─────────────────────────────────────
  'ms11-earning': (rng, diff) => {
    if (diff === 1) {
      const rate = rc(rng, [24.5, 26, 28.75, 31.2, 22.4]);
      const hrs = ri(rng, 12, 38);
      return {
        prompt: `${rc(rng, NAMES)} works $${hrs}$ hours at ${moneyPlain(rate)} per hour. Calculate their pay for the week.`,
        answerType: 'numeric', answer: { value: r2(rate * hrs), tol: 0.02 }, answerPrefix: '$',
        traps: [{ value: r2(rate + hrs), why: 'Pay = hours × hourly rate.' }],
        hints: ['Multiply hours by the hourly rate.', `$${hrs} \\times ${rate}$.`, 'Round to the nearest cent.'],
        steps: [{ h: 'Multiply', d: `$${hrs} \\times ${rate} = ${r2(rate * hrs)}$ → ${moneyPlain(rate * hrs)}` }]
      };
    }
    if (diff === 2) {
      const rate = rc(rng, [22, 24, 25.5, 28]);
      const normal = ri(rng, 30, 38), ot = ri(rng, 2, 8);
      const pay = normal * rate + ot * rate * 1.5;
      return {
        prompt: `An award pays ${moneyPlain(rate)}/hour for the first $${normal}$ hours and **time-and-a-half** after that. Calculate the pay for a $${normal + ot}$-hour week.`,
        answerType: 'numeric', answer: { value: r2(pay), tol: 0.02 }, answerPrefix: '$',
        traps: [
          { value: r2((normal + ot) * rate), why: `The last ${ot} hours are overtime at 1.5 × the rate.`, tol: 0.02 },
          { value: r2((normal + ot) * rate * 1.5), why: 'Only the overtime hours attract the 1.5 loading.', tol: 0.02 }
        ],
        hints: ['Split the week into normal and overtime hours.', `Normal: $${normal} \\times ${rate}$. Overtime: $${ot} \\times ${rate} \\times 1.5$.`, 'Add the two amounts.'],
        steps: [
          { h: 'Normal pay', d: `$${normal} \\times ${rate} = ${r2(normal * rate)}$` },
          { h: 'Overtime pay', d: `$${ot} \\times ${rate} \\times 1.5 = ${r2(ot * rate * 1.5)}$` },
          { h: 'Total', d: `${moneyPlain(r2(pay))}` }
        ]
      };
    }
    if (diff === 3) {
      const retainer = rc(rng, [350, 400, 450, 500]);
      const pct = rc(rng, [2, 2.5, 3, 4]);
      const sales = ri(rng, 15, 60) * 1000;
      const pay = retainer + sales * pct / 100;
      return {
        prompt: `A salesperson earns a retainer of ${moneyPlain(retainer)} per week plus $${pct}\\%$ commission on sales. Find their pay in a week with ${moneyPlain(sales)} of sales.`,
        answerType: 'numeric', answer: { value: r2(pay), tol: 0.02 }, answerPrefix: '$',
        traps: [{ value: r2(sales * pct / 100), why: 'Don’t forget the fixed retainer on top of commission.', tol: 0.02 }],
        hints: ['Pay = retainer + commission.', `Commission: $${pct}\\% \\times ${sales}$.`, `Add ${moneyPlain(retainer)}.`],
        steps: [
          { h: 'Commission', d: `$${pct / 100} \\times ${sales} = ${r2(sales * pct / 100)}$` },
          { h: 'Add the retainer', d: `$${retainer} + ${r2(sales * pct / 100)} = ${r2(pay)}$ → ${moneyPlain(r2(pay))}` }
        ]
      };
    }
    const income = ri(rng, 50, 110) * 1000;
    const base = 5092, threshold = 45000, rate = 32.5;
    const tax = base + (income - threshold) * rate / 100;
    return {
      prompt: `Using this simplified tax table — “${moneyPlain(base)} plus $${rate}$c for each \\$1 over ${moneyPlain(threshold)}” — calculate the income tax payable on a taxable income of ${moneyPlain(income)}.`,
      answerType: 'numeric', answer: { value: r2(tax), tol: 0.51 }, answerPrefix: '$',
      traps: [
        { value: r2(income * rate / 100), why: `The ${rate}% only applies to income *over* ${moneyPlain(threshold)}, plus the fixed ${moneyPlain(base)}.`, tol: 0.51 },
        { value: r2((income - threshold) * rate / 100), why: `Add the base amount ${moneyPlain(base)} to the marginal part.`, tol: 0.51 }
      ],
      hints: [`Find the amount over ${moneyPlain(threshold)} first.`, `$${income} - ${threshold} = ${income - threshold}$; multiply by ${rate}c per dollar.`, `Then add ${moneyPlain(base)}.`],
      steps: [
        { h: 'Excess over the threshold', d: `$${income} - ${threshold} = ${income - threshold}$` },
        { h: 'Marginal tax', d: `$${income - threshold} \\times ${rate / 100} = ${r2((income - threshold) * rate / 100)}$` },
        { h: 'Add the base', d: `$${base} + ${r2((income - threshold) * rate / 100)} = ${r2(tax)}$ → ${moneyPlain(r2(tax))}` }
      ]
    };
  },

  // ── MS-A1 · Formulae & equations ─────────────────────────────────────────
  'ms11-formulas': (rng, diff) => {
    if (diff === 1) {
      const a = ri(rng, 30, 80), b = ri(rng, 40, 120), n = ri(rng, 2, 9);
      return {
        prompt: `A plumber charges using the formula $C = ${a}n + ${b}$, where $n$ is the number of hours. Find the charge $C$ for a $${n}$-hour job.`,
        answerType: 'numeric', answer: { value: a * n + b }, answerPrefix: '$',
        traps: [{ value: a * n, why: `Don't forget the call-out fee of ${moneyPlain(b)}.` }],
        hints: ['Substitute n into the formula.', `$C = ${a} \\times ${n} + ${b}$.`, 'Multiply first, then add.'],
        steps: [{ h: 'Substitute', d: `$C = ${a}(${n}) + ${b} = ${a * n + b}$ → ${moneyPlain(a * n + b)}` }]
      };
    }
    if (diff === 2) {
      const a = ri(rng, 25, 60), b = ri(rng, 50, 140), n = ri(rng, 3, 9);
      const C = a * n + b;
      return {
        prompt: `Using $C = ${a}n + ${b}$, find the number of hours $n$ for which the charge is ${moneyPlain(C)}.`,
        answerType: 'numeric', answer: { value: n }, answerPrefix: 'n =',
        stepcheck: { kind: 'equation', variable: 'n', solutions: [n] },
        traps: [{ value: r2(C / a), why: `Subtract the fixed ${moneyPlain(b)} before dividing by ${a}.` }],
        hints: ['Substitute C and solve the equation.', `$${C} = ${a}n + ${b}$; subtract ${b}.`, `Divide by ${a}.`],
        steps: [
          { h: 'Set up', d: `$${a}n + ${b} = ${C}$` },
          { h: `Subtract ${b}`, d: `$${a}n = ${C - b}$` },
          { h: `Divide by ${a}`, d: `$n = ${n}$` }
        ]
      };
    }
    if (diff === 3) {
      const N = ri(rng, 2, 5), H = rc(rng, [2, 3, 4]);
      const M = rc(rng, [55, 60, 70, 75, 85, 90]);
      const bac = (10 * N - 7.5 * H) / (6.8 * M);
      return {
        prompt: `The formula $BAC = \\dfrac{10N - 7.5H}{6.8M}$ estimates blood alcohol content for males, where $N$ = standard drinks, $H$ = hours drinking, $M$ = mass (kg). Estimate $BAC$ for $N = ${N}$, $H = ${H}$, $M = ${M}$, correct to 3 decimal places.`,
        answerType: 'numeric', answer: { value: r3(bac), tol: 0.0011 },
        traps: [{ value: r3((10 * N - 7.5 * H) / 6.8 * M), why: 'The whole of 6.8M is in the denominator — divide by (6.8 × M).', tol: 0.01 }],
        hints: ['Evaluate the numerator first.', `Top: $10(${N}) - 7.5(${H}) = ${r2(10 * N - 7.5 * H)}$.`, `Divide by $6.8 \\times ${M} = ${r2(6.8 * M)}$.`],
        steps: [
          { h: 'Numerator', d: `$10(${N}) - 7.5(${H}) = ${r2(10 * N - 7.5 * H)}$` },
          { h: 'Denominator', d: `$6.8 \\times ${M} = ${r2(6.8 * M)}$` },
          { h: 'Divide', d: `$BAC = ${r3(bac)}$` }
        ]
      };
    }
    const age = ri(rng, 3, 11), adult = rc(rng, [30, 40, 45, 50, 60]);
    const dose = age * adult / (age + 12);
    return {
      prompt: `Young's formula for a child's medicine dose is $D = \\dfrac{yA}{y + 12}$, where $y$ is the child's age and $A$ the adult dose. Find the dose for a $${age}$-year-old when the adult dose is $${adult}$ mL, correct to 1 decimal place.`,
      answerType: 'numeric', answer: { value: r1(dose), tol: 0.06 }, answerSuffix: 'mL',
      traps: [{ value: r1(age * adult / age + 12), why: 'The denominator is the whole of (y + 12) — bracket it before dividing.', tol: 0.06 }],
      hints: ['Substitute carefully with brackets.', `$D = \\frac{${age} \\times ${adult}}{${age} + 12}$.`, `Denominator: ${age + 12}.`],
      steps: [
        { h: 'Substitute', d: `$D = \\dfrac{${age} \\times ${adult}}{${age} + 12} = \\dfrac{${age * adult}}{${age + 12}}$` },
        { h: 'Divide', d: `$D \\approx ${r1(dose)}$ mL` }
      ]
    };
  },

  // ── MS-M1 · Applications of measurement ──────────────────────────────────
  'ms11-measure': (rng, diff) => {
    if (diff === 1) {
      const m = ri(rng, 2, 9), cm = ri(rng, 10, 90);
      const total = m + cm / 100;
      return {
        prompt: `A hallway is $${m}$ m $${cm}$ cm long. Write this length in metres.`,
        answerType: 'numeric', answer: { value: total }, answerSuffix: 'm',
        traps: [{ value: m + cm, why: '100 cm = 1 m, so divide the centimetres by 100.' }],
        hints: ['Convert the centimetres to metres.', `$${cm}$ cm $= ${cm / 100}$ m.`, `Add to ${m} m.`],
        steps: [{ h: 'Convert and add', d: `$${m} + \\dfrac{${cm}}{100} = ${total}$ m` }]
      };
    }
    if (diff === 2) {
      const a = ri(rng, 6, 14), b = ri(rng, 8, 18), h = ri(rng, 4, 9);
      const area = (a + b) / 2 * h;
      return {
        prompt: `A backyard is a trapezium with parallel sides $${a}$ m and $${b}$ m, and perpendicular height $${h}$ m. Find its area using $A = \\frac{h}{2}(a + b)$.`,
        answerType: 'numeric', answer: { value: area }, answerSuffix: 'm²',
        traps: [{ value: a * b * h / 2, why: 'Add the parallel sides first: $\\frac{h}{2}(a+b)$.' }],
        hints: ['Add the parallel sides first.', `$${a} + ${b} = ${a + b}$.`, `Multiply by $\\frac{${h}}{2}$.`],
        steps: [
          { h: 'Sum of parallel sides', d: `$${a} + ${b} = ${a + b}$` },
          { h: 'Apply the formula', d: `$A = \\dfrac{${h}}{2} \\times ${a + b} = ${area}$ m²` }
        ]
      };
    }
    if (diff === 3) {
      const meas = rc(rng, [24, 36, 48, 62, 78]);
      const prec = rc(rng, [1, 0.1]);
      const absErr = prec / 2;
      const pctErr = absErr / meas * 100;
      return {
        prompt: `A length is measured as $${prec === 1 ? meas : meas / 10}$ ${prec === 1 ? 'cm, to the nearest centimetre' : 'cm, to the nearest millimetre'}. Find the **percentage error**, correct to 2 decimal places. (Absolute error = half the precision.)`,
        answerType: 'numeric', answer: { value: r2(absErr / (prec === 1 ? meas : meas / 10) * 100), tol: 0.011 }, answerSuffix: '%',
        traps: [{ value: r2(prec / (prec === 1 ? meas : meas / 10) * 100), why: 'The absolute error is HALF the smallest unit of measurement.', tol: 0.011 }],
        hints: ['Absolute error = half the precision.', `Absolute error $= ${absErr}$ ${prec === 1 ? 'cm' : 'cm'}.`, 'Percentage error = absolute error ÷ measurement × 100.'],
        steps: [
          { h: 'Absolute error', d: `$\\dfrac{${prec}}{2} = ${absErr}$ cm` },
          { h: 'Percentage error', d: `$\\dfrac{${absErr}}{${prec === 1 ? meas : meas / 10}} \\times 100 \\approx ${r2(absErr / (prec === 1 ? meas : meas / 10) * 100)}\\%$` }
        ]
      };
    }
    const l = ri(rng, 15, 40) / 10, w = ri(rng, 10, 30) / 10, d = rc(rng, [0.2, 0.25, 0.3]);
    const litres = l * w * d * 1000;
    return {
      prompt: `A garden bed $${l}$ m long and $${w}$ m wide is filled with soil to a depth of $${d}$ m. How many **litres** of soil is that? (1 m³ = 1000 L)`,
      answerType: 'numeric', answer: { value: r1(litres), tol: 0.6 }, answerSuffix: 'L',
      traps: [{ value: r2(l * w * d), why: 'That’s the volume in m³ — multiply by 1000 for litres.', tol: 0.01 }],
      hints: ['Volume first, in m³.', `$${l} \\times ${w} \\times ${d} = ${r3(l * w * d)}$ m³.`, 'Then × 1000.'],
      steps: [
        { h: 'Volume', d: `$${l} \\times ${w} \\times ${d} = ${r3(l * w * d)}$ m³` },
        { h: 'Convert', d: `$${r3(l * w * d)} \\times 1000 = ${r1(litres)}$ L` }
      ]
    };
  },

  // ── MS-M2 · Energy & running costs ───────────────────────────────────────
  'ms11-energy': (rng, diff) => {
    if (diff === 1) {
      const watts = rc(rng, [800, 1200, 1500, 2000, 2400]);
      const hrs = ri(rng, 2, 8);
      const kwh = watts / 1000 * hrs;
      return {
        prompt: `A $${watts}$ W heater runs for $${hrs}$ hours. How much energy does it use, in kilowatt-hours (kWh)?`,
        answerType: 'numeric', answer: { value: r2(kwh), tol: 0.011 }, answerSuffix: 'kWh',
        traps: [{ value: watts * hrs, why: 'Convert watts to kilowatts (÷1000) before multiplying by hours.' }],
        hints: ['kWh = kilowatts × hours.', `$${watts}$ W $= ${watts / 1000}$ kW.`, `Multiply by ${hrs}.`],
        steps: [
          { h: 'Convert to kW', d: `$${watts} \\div 1000 = ${watts / 1000}$ kW` },
          { h: 'Multiply by time', d: `$${watts / 1000} \\times ${hrs} = ${r2(kwh)}$ kWh` }
        ]
      };
    }
    if (diff === 2) {
      const kwh = ri(rng, 4, 18);
      const centsRate = rc(rng, [28, 30, 32, 35]);
      const cost = kwh * centsRate / 100;
      return {
        prompt: `Electricity costs $${centsRate}$ c/kWh. Find the cost of using $${kwh}$ kWh, in dollars.`,
        answerType: 'numeric', answer: { value: r2(cost), tol: 0.011 }, answerPrefix: '$',
        traps: [{ value: kwh * centsRate, why: 'That’s in cents — divide by 100 for dollars.' }],
        hints: ['Multiply energy by the rate.', `$${kwh} \\times ${centsRate}$ cents.`, 'Convert cents to dollars.'],
        steps: [
          { h: 'Cost in cents', d: `$${kwh} \\times ${centsRate} = ${kwh * centsRate}$c` },
          { h: 'In dollars', d: `${moneyPlain(r2(cost))}` }
        ]
      };
    }
    if (diff === 3) {
      const per100 = rc(rng, [5.8, 6.4, 7.2, 8.5, 9.6]);
      const dist = ri(rng, 250, 900);
      const litres = per100 * dist / 100;
      return {
        prompt: `A car uses fuel at $${per100}$ L/100 km. How many litres does it use on a $${dist}$ km trip?`,
        answerType: 'numeric', answer: { value: r1(litres), tol: 0.06 }, answerSuffix: 'L',
        traps: [{ value: r1(per100 * dist), why: 'The rate is per 100 km — divide the distance by 100 first.', tol: 0.5 }],
        hints: ['How many lots of 100 km is the trip?', `$${dist} \\div 100 = ${dist / 100}$.`, `Multiply by ${per100} L.`],
        steps: [
          { h: 'Hundreds of km', d: `$${dist} \\div 100 = ${dist / 100}$` },
          { h: 'Fuel used', d: `$${per100} \\times ${dist / 100} = ${r1(litres)}$ L` }
        ]
      };
    }
    const oldW = rc(rng, [2400, 2000]), newW = rc(rng, [800, 600]);
    const hrs = ri(rng, 3, 6), rate = 0.32;
    const saving = (oldW - newW) / 1000 * hrs * 365 * rate;
    return {
      prompt: `Replacing a $${oldW}$ W appliance with a $${newW}$ W one (used $${hrs}$ h/day, electricity at \\$0.32/kWh) saves how much per **year**, to the nearest dollar?`,
      answerType: 'numeric', answer: { value: Math.round(saving), tol: 1.01 }, answerPrefix: '$',
      traps: [{ value: r2((oldW - newW) / 1000 * hrs * rate), why: 'That’s the saving per *day* — multiply by 365 for a year.', tol: 0.02 }],
      hints: ['Find the daily energy saving in kWh first.', `Daily: $${(oldW - newW) / 1000} \\times ${hrs} = ${r2((oldW - newW) / 1000 * hrs)}$ kWh.`, 'Then × 365 days × $0.32.'],
      steps: [
        { h: 'Power saved', d: `$${oldW} - ${newW} = ${oldW - newW}$ W $= ${(oldW - newW) / 1000}$ kW` },
        { h: 'Daily saving', d: `$${(oldW - newW) / 1000} \\times ${hrs} \\times 0.32 = ${r2((oldW - newW) / 1000 * hrs * rate)}$` },
        { h: 'Yearly', d: `$\\times 365 \\approx ${moneyPlain(Math.round(saving))}$` }
      ]
    };
  },

  // ── MS-S1 · Data ─────────────────────────────────────────────────────────
  'ms11-data': (rng, diff) => {
    if (diff === 1) {
      const n = 5;
      const mean = ri(rng, 6, 20);
      let data = Array.from({ length: n - 1 }, () => ri(rng, mean - 5, mean + 5));
      const last = mean * n - data.reduce((s, v) => s + v, 0);
      if (last < 0 || last > mean + 15) return streamsStandard['ms11-data'](rng, diff);
      data.push(last);
      data = rs(rng, data);
      return {
        prompt: `Find the mean of: $${data.join(',\\ ')}$.`,
        answerType: 'numeric', answer: { value: mean },
        traps: [{ value: data.reduce((s, v) => s + v, 0), why: `Divide the total by ${n}.` }],
        hints: ['Mean = total ÷ count.', `Total: ${mean * n}.`, `Divide by ${n}.`],
        steps: [
          { h: 'Total', d: `$${data.join(' + ')} = ${mean * n}$` },
          { h: 'Divide', d: `$${mean * n} \\div ${n} = ${mean}$` }
        ]
      };
    }
    if (diff === 2) {
      const vals = [0, 1, 2, 3];
      const freqs = [ri(rng, 2, 6), ri(rng, 4, 9), ri(rng, 3, 8), ri(rng, 1, 5)];
      const totalF = freqs.reduce((s, v) => s + v, 0);
      // median position
      const pos = (totalF + 1) / 2;
      let cum = 0, median = 0;
      for (let i = 0; i < 4; i++) { cum += freqs[i]; if (cum >= pos) { median = vals[i]; break; } }
      const modeIdx = freqs.indexOf(Math.max(...freqs));
      const which = rc(rng, ['median', 'mode']);
      return {
        prompt: `A survey of cars per household: value $0$ (frequency $${freqs[0]}$), $1$ (${'$' + freqs[1] + '$'}), $2$ (${'$' + freqs[2] + '$'}), $3$ (${'$' + freqs[3] + '$'}). Find the **${which}**.`,
        answerType: 'numeric', answer: { value: which === 'median' ? median : vals[modeIdx] },
        traps: [{ value: which === 'median' ? vals[modeIdx] : median, why: which === 'median' ? 'That’s the mode — the median is the middle of all ' + totalF + ' responses.' : 'That’s the median — the mode is the most frequent value.' }],
        hints: [which === 'median' ? `There are ${totalF} data values — find the middle one using cumulative frequency.` : 'The mode has the highest frequency.', which === 'median' ? `The middle position is ${(totalF + 1) / 2}.` : `The biggest frequency is ${Math.max(...freqs)}.`, `Answer: ${which === 'median' ? median : vals[modeIdx]}.`],
        steps: which === 'median'
          ? [{ h: 'Total responses', d: `$${totalF}$` }, { h: 'Middle position', d: `$\\frac{${totalF} + 1}{2} = ${(totalF + 1) / 2}$` }, { h: 'Cumulative count reaches it at', d: `value $${median}$` }]
          : [{ h: 'Highest frequency', d: `$${Math.max(...freqs)}$, at value $${vals[modeIdx]}$` }]
      };
    }
    if (diff === 3) {
      const base = ri(rng, 10, 30);
      const data = [base, base + 2, base + 3, base + 5, base + 6, base + 8];
      const withOut = [...data, base + ri(rng, 25, 40)];
      const m1 = data.reduce((s, v) => s + v, 0) / data.length;
      const m2 = withOut.reduce((s, v) => s + v, 0) / withOut.length;
      return {
        prompt: `Six house prices (in \\$10\\,000s) are $${data.join(', ')}$. A seventh sale of $${withOut[6]}$ is added. By how much does the **mean** increase, correct to 2 decimal places?`,
        answerType: 'numeric', answer: { value: r2(m2 - m1), tol: 0.011 },
        traps: [{ value: r2(withOut[6] - m1), why: 'Compare the two means, not the outlier with the old mean.', tol: 0.011 }],
        hints: ['Compute the mean before and after.', `Before: $${r2(m1)}$.`, `After: $${r2(m2)}$; subtract.`],
        steps: [
          { h: 'Mean before', d: `$${data.reduce((s, v) => s + v, 0)} \\div 6 = ${r2(m1)}$` },
          { h: 'Mean after', d: `$${withOut.reduce((s, v) => s + v, 0)} \\div 7 = ${r2(m2)}$` },
          { h: 'Increase', d: `$${r2(m2 - m1)}$` }
        ]
      };
    }
    const m = mcq(rng, 'The median — it is not dragged by the extreme value', [
      { text: 'The mean — it uses every data value', why: 'Using every value is exactly why the mean gets dragged toward the outlier.' },
      { text: 'The mode — it is always in the middle', why: 'The mode is the most frequent value — it can sit anywhere.' },
      { text: 'The range — it measures the centre' }
    ]);
    return {
      prompt: `A suburb's house prices include one extreme mansion. Which measure of centre best represents a **typical** price, and why?`,
      answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
      hints: ['Think about which measures an outlier can drag.', 'The mean moves toward extreme values; the median resists.', 'Median.'],
      steps: [{ h: 'Outliers and centre', d: 'Extreme values pull the mean but barely move the median — so the median best represents a typical price.' }]
    };
  },

  // ── MS-S1 · Relative frequency & probability ─────────────────────────────
  'ms11-relfreq': (rng, diff) => {
    if (diff === 1) {
      const good = ri(rng, 3, 9), bad = ri(rng, 2, 6);
      const f = new Frac(good, good + bad);
      return {
        prompt: `A box has $${good}$ working batteries and $${bad}$ flat ones. One is chosen at random. Find $P(\\text{working})$ as a fraction in simplest form.`,
        answerType: 'numeric', answer: { value: f.value, simplestFraction: { n: f.n, d: f.d } },
        inputHint: 'e.g. 3/5',
        traps: [{ value: good / bad, why: 'The denominator is the total number of batteries.' }],
        hints: ['P = favourable ÷ total.', `Total: ${good + bad}.`, `$\\frac{${good}}{${good + bad}}$, simplified.`],
        steps: [{ h: 'Probability', d: `$\\dfrac{${good}}{${good + bad}} = ${f.latex()}$` }]
      };
    }
    if (diff === 2) {
      const made = ri(rng, 30, 90), total = rc(rng, [100, 120, 150, 200]);
      return {
        prompt: `A basketballer made $${made}$ of her last $${total}$ free throws. Using relative frequency, estimate $P(\\text{make})$ as a decimal.`,
        answerType: 'numeric', answer: { value: r3(made / total), tol: 0.002 },
        traps: [{ value: made, why: 'Relative frequency = count ÷ total trials.' }],
        hints: ['Relative frequency = successes ÷ trials.', `$${made} \\div ${total}$.`, 'Give it as a decimal.'],
        steps: [{ h: 'Relative frequency', d: `$\\dfrac{${made}}{${total}} = ${r3(made / total)}$` }]
      };
    }
    if (diff === 3) {
      const p = rc(rng, [[1, 5], [3, 10], [1, 4], [2, 5]]);
      const f = new Frac(p[0], p[1]);
      const n = p[1] * ri(rng, 8, 15);
      return {
        prompt: `The probability a customer pays cash is $${f.latex()}$. Out of $${n}$ customers, how many would you **expect** to pay cash?`,
        answerType: 'numeric', answer: { value: f.value * n },
        traps: [{ value: n / p[0], why: `Expected number = probability × number of trials.` }],
        hints: ['Expected = P × n.', `$${f.latex()} \\times ${n}$.`, `= ${f.value * n}.`],
        steps: [{ h: 'Expected number', d: `$${f.latex()} \\times ${n} = ${f.value * n}$` }]
      };
    }
    const aYes = ri(rng, 12, 30), aNo = ri(rng, 8, 20), bYes = ri(rng, 10, 25), bNo = ri(rng, 6, 18);
    const f = new Frac(aYes, aYes + bYes);
    return {
      prompt: `A two-way table: Adults — $${aYes}$ exercise, $${aNo}$ don't; Teens — $${bYes}$ exercise, $${bNo}$ don't. Given a person **exercises**, find the probability they are an adult (simplest-form fraction).`,
      answerType: 'numeric', answer: { value: f.value, simplestFraction: { n: f.n, d: f.d } },
      inputHint: 'e.g. 3/5',
      traps: [{ value: aYes / (aYes + aNo + bYes + bNo), why: '“Given that they exercise” restricts the total to the exercisers column.' }],
      hints: ['The condition narrows the world to exercisers.', `Exercisers: $${aYes} + ${bYes} = ${aYes + bYes}$.`, `Adults among them: ${aYes}.`],
      steps: [
        { h: 'Restrict to the condition', d: `Exercisers: $${aYes + bYes}$` },
        { h: 'Conditional probability', d: `$\\dfrac{${aYes}}{${aYes + bYes}} = ${f.latex()}$` }
      ]
    };
  },

  // ── MS-F4 · Investments & loans ──────────────────────────────────────────
  'ms12-loans': (rng, diff) => {
    if (diff === 1) {
      const P = ri(rng, 4, 20) * 1000;
      const rr = rc(rng, [3, 4, 5, 6]);
      const n = ri(rng, 2, 6);
      const A = P * (1 + rr / 100) ** n;
      return {
        prompt: `${moneyPlain(P)} is invested at $${rr}\\%$ p.a. compounding annually for $${n}$ years. Find the final value, to the nearest cent.`,
        answerType: 'numeric', answer: { value: r2(A), tol: 0.02 }, answerPrefix: '$',
        traps: [{ value: r2(P * (1 + rr * n / 100)), why: 'Compound interest multiplies by (1 + r) each year.', tol: 0.02 }],
        hints: ['$FV = P(1+r)^n$.', `$${P}(${1 + rr / 100})^{${n}}$.`, 'Round to the nearest cent.'],
        steps: [{ h: 'Apply the formula', d: `$${P}(${1 + rr / 100})^{${n}} = ${r2(A)}$ → ${moneyPlain(r2(A))}` }]
      };
    }
    if (diff === 2) {
      const L = rc(rng, [300000, 400000, 500000]);
      const monthly = rc(rng, [0.4, 0.5]);
      const repay = rc(rng, [2200, 2600, 3000]);
      const interest = L * monthly / 100;
      const owing = L + interest - repay;
      return {
        prompt: `A ${moneyPlain(L)} home loan charges $${monthly}\\%$ interest per **month**. Repayments are ${moneyPlain(repay)} per month. Complete the first row of the loan table: how much is **owing after one repayment**, to the nearest cent?`,
        answerType: 'numeric', answer: { value: r2(owing), tol: 0.02 }, answerPrefix: '$',
        traps: [
          { value: r2(L - repay), why: 'Interest is added *before* the repayment comes off.', tol: 0.02 },
          { value: r2(interest), why: 'That’s just the month’s interest — the question asks for the balance owing.', tol: 0.02 }
        ],
        hints: ['Each month: add interest, then subtract the repayment.', `Interest: $${monthly}\\% \\times ${L} = ${r2(interest)}$.`, `$${L} + ${r2(interest)} - ${repay}$.`],
        steps: [
          { h: 'Interest for the month', d: `$${L} \\times ${monthly / 100} = ${r2(interest)}$` },
          { h: 'Balance owing', d: `$${L} + ${r2(interest)} - ${repay} = ${r2(owing)}$` }
        ]
      };
    }
    if (diff === 3) {
      const L = rc(rng, [20000, 30000, 40000]);
      const m = rc(rng, [0.6, 0.75, 1]);
      const repay = rc(rng, [800, 1000, 1200]);
      const b1 = L * (1 + m / 100) - repay;
      const b2 = b1 * (1 + m / 100) - repay;
      const interestPaid = b2 - L + 2 * repay;
      return {
        prompt: `A ${moneyPlain(L)} car loan charges $${m}\\%$ per month, with ${moneyPlain(repay)} monthly repayments. How much **interest** has been charged in total over the first two months, to the nearest cent?`,
        answerType: 'numeric', answer: { value: r2(interestPaid), tol: 0.03 }, answerPrefix: '$',
        traps: [{ value: r2(2 * L * m / 100), why: 'The second month’s interest is charged on the *reduced* balance, not the original loan.', tol: 0.03 }],
        hints: ['Track the balance month by month.', `Month 1 interest: $${r2(L * m / 100)}$; balance $${r2(b1)}$.`, `Month 2 interest: $${r2(b1 * m / 100)}$; add the two interest amounts.`],
        steps: [
          { h: 'Month 1', d: `interest $${r2(L * m / 100)}$; owing $${r2(b1)}$` },
          { h: 'Month 2', d: `interest $${r2(b1 * m / 100)}$; owing $${r2(b2)}$` },
          { h: 'Total interest', d: `$${r2(L * m / 100)} + ${r2(b1 * m / 100)} = ${r2(interestPaid)}$` }
        ]
      };
    }
    const P = rc(rng, [10000, 15000, 20000]);
    const flat = rc(rng, [8, 9]);
    const comp = rc(rng, [6, 7]);
    const yrs = 3;
    const flatTotal = P * flat / 100 * yrs;
    const compTotal = P * (1 + comp / 100) ** yrs - P;
    return {
      prompt: `Two $${yrs}$-year options for borrowing ${moneyPlain(P)}: Loan A charges **flat-rate** interest of $${flat}\\%$ p.a. on the full principal; Loan B charges $${comp}\\%$ p.a. **compounding** annually. How much more interest does the dearer loan cost, to the nearest cent?`,
      answerType: 'numeric', answer: { value: r2(Math.abs(flatTotal - compTotal)), tol: 0.03 }, answerPrefix: '$',
      traps: [{ value: r2(flatTotal), why: 'That’s Loan A’s interest — the question asks for the *difference* between the two.', tol: 0.03 }],
      hints: ['Work out each loan’s total interest.', `A: $${P} \\times ${flat / 100} \\times ${yrs} = ${r2(flatTotal)}$.`, `B: $${P}(${1 + comp / 100})^{${yrs}} - ${P} = ${r2(compTotal)}$.`],
      steps: [
        { h: 'Flat-rate interest', d: `$${r2(flatTotal)}$` },
        { h: 'Compound interest', d: `$${r2(compTotal)}$` },
        { h: 'Difference', d: `$${r2(Math.abs(flatTotal - compTotal))}$` }
      ]
    };
  },

  // ── MS-F5 · Annuities ────────────────────────────────────────────────────
  'ms12-annuity': (rng, diff) => {
    const factors = { 4: { 3: 3.1216, 5: 3.153 }, 5: { 3: 3.1525 } };
    if (diff === 1) {
      const a = rc(rng, [1000, 2000, 5000]);
      const rr = rc(rng, [4, 5, 6]);
      const n = rc(rng, [3, 4]);
      const factor = ((1 + rr / 100) ** n - 1) / (rr / 100);
      return {
        prompt: `An annuity table gives a future-value factor of $${r3(factor)}$ for $${n}$ yearly contributions at $${rr}\\%$ p.a. Find the future value of ${moneyPlain(a)} contributed each year, to the nearest cent.`,
        answerType: 'numeric', answer: { value: r2(a * factor), tol: 0.51 }, answerPrefix: '$',
        traps: [{ value: a * n, why: 'The factor already includes the compounding — multiply the contribution by the factor.', tol: 0.02 }],
        hints: ['FV = contribution × factor.', `$${a} \\times ${r3(factor)}$.`, 'Round to the nearest cent.'],
        steps: [{ h: 'Multiply by the table factor', d: `$${a} \\times ${r3(factor)} = ${r2(a * r3(factor))}$` }]
      };
    }
    if (diff === 2) {
      const a = rc(rng, [1200, 1500, 2400]);
      const rr = rc(rng, [4, 5, 6, 8]);
      const g = 1 + rr / 100;
      const fv = a * (g * g + g + 1);
      return {
        prompt: `${moneyPlain(a)} is deposited at the **end** of each year for 3 years at $${rr}\\%$ p.a. compound. Find the future value at the end of year 3, to the nearest cent.`,
        answerType: 'numeric', answer: { value: r2(fv), tol: 0.02 }, answerPrefix: '$',
        traps: [{ value: r2(a * (g ** 3 + g ** 2 + g)), why: 'End-of-year deposits: the final deposit earns no interest — powers are 2, 1, 0.', tol: 0.02 }],
        hints: ['Track each deposit separately.', `Deposit 1 compounds 2 years, deposit 2 one year, deposit 3 none.`, `$${a}(${g}^2 + ${g} + 1)$.`],
        steps: [
          { h: 'Each deposit grows', d: `$${a}(${g})^2 + ${a}(${g}) + ${a}$` },
          { h: 'Total', d: `$${r2(fv)}$` }
        ]
      };
    }
    if (diff === 3) {
      const target = rc(rng, [20000, 30000, 50000]);
      const rr = rc(rng, [4, 5]);
      const n = rc(rng, [5, 6]);
      const factor = ((1 + rr / 100) ** n - 1) / (rr / 100);
      const contrib = target / factor;
      return {
        prompt: `Using the future-value factor $${r3(factor)}$ (for $${n}$ years at $${rr}\\%$), what yearly contribution grows to ${moneyPlain(target)}? Answer to the nearest cent.`,
        answerType: 'numeric', answer: { value: r2(contrib), tol: 0.51 }, answerPrefix: '$',
        traps: [{ value: r2(target / n), why: 'Divide by the annuity factor, not the number of years — interest does part of the work.', tol: 0.51 }],
        hints: ['Contribution = target ÷ factor.', `$${target} \\div ${r3(factor)}$.`, 'The factor accounts for all the compounding.'],
        steps: [{ h: 'Divide by the factor', d: `$\\dfrac{${target}}{${r3(factor)}} = ${r2(target / r3(factor))}$` }]
      };
    }
    const payout = rc(rng, [5000, 8000, 10000]);
    const rr = rc(rng, [4, 5, 6]);
    const n = 3;
    const g = 1 + rr / 100;
    const pv = payout / g + payout / g ** 2 + payout / g ** 3;
    return {
      prompt: `An annuity pays ${moneyPlain(payout)} at the end of each year for $${n}$ years, with money valued at $${rr}\\%$ p.a. Find its **present value** (the lump sum equivalent today), to the nearest cent.`,
      answerType: 'numeric', answer: { value: r2(pv), tol: 0.03 }, answerPrefix: '$',
      traps: [{ value: payout * n, why: `Future payments are worth *less* today — discount each by $(1.0${rr})^t$.`, tol: 0.02 }],
      hints: ['Discount each payment back to today.', `Year t payment is worth $\\frac{${payout}}{${g}^t}$ now.`, 'Add the three discounted values.'],
      steps: [
        { h: 'Discount each payout', d: `$\\dfrac{${payout}}{${g}} + \\dfrac{${payout}}{${g}^2} + \\dfrac{${payout}}{${g}^3}$` },
        { h: 'Evaluate', d: `$${r2(payout / g)} + ${r2(payout / g ** 2)} + ${r2(payout / g ** 3)} = ${r2(pv)}$` }
      ]
    };
  },

  // ── MS-N2/N3 · Networks ──────────────────────────────────────────────────
  'ms12-networks': (rng, diff) => {
    const nodes5 = ['A', 'B', 'C', 'D', 'E'];
    const nodes4 = ['A', 'B', 'C', 'D'];
    if (diff === 1) {
      const edges = TOPO5.map(([a, b]) => [a, b, ri(rng, 2, 9)]);
      const deg = edges.filter(([a, b]) => a === 1 || b === 1).length;
      return {
        prompt: `For the network shown, state the **degree** of vertex $B$ (the number of edges meeting it).`,
        figure: figNetwork({ nodes: nodes5, edges }),
        answerType: 'numeric', answer: { value: deg },
        traps: [{ value: edges.length, why: 'Count only the edges that touch B, not every edge in the network.' }],
        hints: ['Degree counts the edges at that vertex.', 'Trace each edge that touches B.', `B has ${deg} edges.`],
        steps: [{ h: 'Count edges at B', d: `${deg} edges meet vertex B, so deg(B) = ${deg}` }]
      };
    }
    if (diff === 2) {
      const edges = TOPO4.map(([a, b]) => [a, b, ri(rng, 2, 9)]);
      const best = dijkstra(4, edges, 0, 3);
      return {
        prompt: `The network shows travel times in minutes. Find the length of the **shortest path** from $A$ to $D$.`,
        figure: figNetwork({ nodes: nodes4, edges }),
        answerType: 'numeric', answer: { value: best }, answerSuffix: 'min',
        traps: [{ value: edges.filter(([a, b]) => (a === 0 && b === 1) || (a === 1 && b === 3)).reduce((s, e) => s + e[2], 0) || best + 2, why: 'Compare every route — the obvious one isn’t always shortest.' }].filter(t => t.value !== best),
        hints: ['List every route from A to D.', 'Add the weights along each route.', 'Take the smallest total.'],
        steps: [
          { h: 'Compare routes', d: 'Add the weights along each possible path from A to D' },
          { h: 'Shortest', d: `$${best}$ minutes` }
        ]
      };
    }
    if (diff === 3) {
      const edges = TOPO5.map(([a, b]) => [a, b, ri(rng, 2, 9)]);
      const best = dijkstra(5, edges, 0, 3);
      return {
        prompt: `The network shows cable lengths in metres between junctions. Find the **shortest path** from $A$ to $D$.`,
        figure: figNetwork({ nodes: nodes5, edges }),
        answerType: 'numeric', answer: { value: best }, answerSuffix: 'm',
        traps: [],
        hints: ['Work outward from A, recording the best distance to each junction.', 'Routes may pass through B, E or C.', 'Take the minimum total.'],
        steps: [
          { h: 'Systematic comparison (Dijkstra)', d: 'Grow the set of settled vertices, always taking the nearest unsettled one' },
          { h: 'Shortest A → D', d: `$${best}$ m` }
        ]
      };
    }
    const edges = TOPO5.map(([a, b]) => [a, b, ri(rng, 2, 9)]);
    const total = mstWeight(5, edges);
    return {
      prompt: `The network shows the cost (in \\$100s) of connecting five towns with fibre. Find the total cost of the **minimum spanning tree** — the cheapest way to connect all towns.`,
      figure: figNetwork({ nodes: nodes5, edges }),
      answerType: 'numeric', answer: { value: total },
      traps: [{ value: edges.reduce((s, e) => s + e[2], 0), why: 'A spanning tree uses only enough edges to connect every town (4 edges for 5 towns) — not all of them.' }],
      hints: ['Pick the cheapest edges that never make a loop.', 'A spanning tree for 5 towns uses exactly 4 edges.', 'Keep taking the cheapest non-loop edge (Kruskal).'],
      steps: [
        { h: "Kruskal's idea", d: 'Sort edges by weight; take each unless it closes a loop' },
        { h: 'Minimum total', d: `$${total}$ (× \\$100)` }
      ]
    };
  },

  // ── MS-S5 · Normal distribution ──────────────────────────────────────────
  'ms12-normal': (rng, diff) => {
    const mu = rc(rng, [60, 65, 70, 100]);
    const sd = rc(rng, [5, 8, 10]);
    if (diff === 1) {
      const z = rc(rng, [-2, -1.5, -1, 0.5, 1, 1.5, 2]);
      const x = mu + z * sd;
      return {
        prompt: `Scores are normally distributed with mean $${mu}$ and standard deviation $${sd}$. Find the $z$-score of a result of $${x}$.`,
        answerType: 'numeric', answer: { value: z, tol: 0.011 }, answerPrefix: 'z =',
        traps: [{ value: x - mu, why: `Divide the deviation by σ = ${sd}.`, tol: 0.011 }],
        hints: ['$z = \\frac{x - \\mu}{\\sigma}$.', `$\\frac{${x} - ${mu}}{${sd}}$.`, `= ${z}.`],
        steps: [{ h: 'Standardise', d: `$z = \\dfrac{${x} - ${mu}}{${sd}} = ${z}$` }]
      };
    }
    if (diff === 2) {
      const pick = rc(rng, [
        { lo: mu - sd, hi: mu + sd, pct: 68 },
        { lo: mu - 2 * sd, hi: mu + 2 * sd, pct: 95 },
        { lo: mu, hi: mu + 2 * sd, pct: 47.5 },
        { lo: mu - sd, hi: mu, pct: 34 }
      ]);
      return {
        prompt: `Heights are normal with mean $${mu}$ and sd $${sd}$. Using the 68–95–99.7 rule, what **percentage** lies between $${pick.lo}$ and $${pick.hi}$?`,
        answerType: 'numeric', answer: { value: pick.pct, tol: 0.11 }, answerSuffix: '%',
        traps: [{ value: pick.pct === 68 ? 95 : 68, why: '±1σ ↔ 68%, ±2σ ↔ 95% — check how many σ each bound is from the mean.', tol: 0.11 }].filter(t => Math.abs(t.value - pick.pct) > 1),
        hints: ['Convert the bounds to numbers of σ from the mean.', `${pick.lo} is ${(pick.lo - mu) / sd}σ; ${pick.hi} is ${(pick.hi - mu) / sd}σ.`, 'Use symmetry of the bell curve.'],
        steps: [
          { h: 'Bounds in σ', d: `$${(pick.lo - mu) / sd}\\sigma$ to $${(pick.hi - mu) / sd}\\sigma$` },
          { h: 'Empirical rule', d: `$${pick.pct}\\%$` }
        ]
      };
    }
    if (diff === 3) {
      const s1 = mu + rc(rng, [1, 1.5]) * sd, s2 = mu + rc(rng, [0.5, 0.8]) * sd;
      const m = mcq(rng, `The first result — its z-score of $${r2((s1 - mu) / sd)}$ is higher`, [
        { text: `The second result — it is closer to the mean`, why: 'Closer to the mean means a *less* impressive result — higher z wins.' },
        { text: 'They are equally good because both are above the mean' },
        { text: 'Impossible to compare without the raw totals' }
      ]);
      return {
        prompt: `Two test results: $${s1}$ (on a test with mean $${mu}$, sd $${sd}$) and $${s2}$ (same test). Which is the **better** result relative to the cohort?`,
        answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
        hints: ['Convert both to z-scores.', `$z_1 = ${r2((s1 - mu) / sd)}$, $z_2 = ${r2((s2 - mu) / sd)}$.`, 'The larger z-score is the stronger result.'],
        steps: [
          { h: 'Standardise both', d: `$z_1 = ${r2((s1 - mu) / sd)}, \\ z_2 = ${r2((s2 - mu) / sd)}$` },
          { h: 'Compare', d: 'Higher z-score → further above the cohort → better result' }
        ]
      };
    }
    const z = rc(rng, [-1.5, -1, 1, 1.5, 2]);
    return {
      prompt: `Results are normal with mean $${mu}$ and sd $${sd}$. What raw score has a $z$-score of $${z}$?`,
      answerType: 'numeric', answer: { value: mu + z * sd },
      traps: [{ value: mu - z * sd, why: `A ${z > 0 ? 'positive' : 'negative'} z sits ${z > 0 ? 'above' : 'below'} the mean: $x = \\mu + z\\sigma$.` }],
      hints: ['Rearrange $z = \\frac{x-\\mu}{\\sigma}$.', `$x = \\mu + z\\sigma$.`, `$${mu} + (${z})(${sd})$.`],
      steps: [{ h: 'Un-standardise', d: `$x = ${mu} + (${z})(${sd}) = ${mu + z * sd}$` }]
    };
  },

  // ── MS-S4 · Bivariate data ───────────────────────────────────────────────
  'ms12-bivariate': (rng, diff) => {
    const a = ri(rng, 5, 30), b = rc(rng, [1.5, 2, 2.5, 3, 4]);
    if (diff === 1) {
      const down = rc(rng, [true, false]);
      const m = mcq(rng, down ? 'Negative — as one variable increases, the other decreases' : 'Positive — the variables increase together', [
        { text: down ? 'Positive — the variables increase together' : 'Negative — as one increases, the other decreases', why: 'Check the slope direction of the cloud of points.' },
        { text: 'Zero — the points form a perfect line' },
        { text: 'Cannot tell from a scatterplot' }
      ]);
      return {
        prompt: `A scatterplot of ${down ? 'hours of TV watched vs exam mark shows marks falling as TV hours rise' : 'hours of study vs exam mark shows marks rising with study time'}. What type of **correlation** is this?`,
        answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
        hints: ['Correlation describes the direction of the trend.', down ? 'One goes up, the other goes down.' : 'Both rise together.', down ? 'Negative.' : 'Positive.'],
        steps: [{ h: 'Direction of association', d: down ? 'Rising x with falling y → negative correlation' : 'Rising together → positive correlation' }]
      };
    }
    if (diff === 2) {
      const x = ri(rng, 3, 12);
      return {
        prompt: `A line of best fit for plant growth is $h = ${a} + ${b}w$, where $w$ is weeks and $h$ height in cm. **Predict** the height after $${x}$ weeks.`,
        answerType: 'numeric', answer: { value: r1(a + b * x), tol: 0.06 }, answerSuffix: 'cm',
        traps: [{ value: r1(a * x + b), why: `${b} multiplies the weeks; ${a} is the starting height.`, tol: 0.06 }],
        hints: ['Substitute w into the equation.', `$h = ${a} + ${b} \\times ${x}$.`, 'Evaluate.'],
        steps: [{ h: 'Substitute', d: `$h = ${a} + ${b}(${x}) = ${r1(a + b * x)}$ cm` }]
      };
    }
    if (diff === 3) {
      return {
        prompt: `For the fitted line $h = ${a} + ${b}w$ (height in cm after $w$ weeks), by how many cm does the model say the plant grows **each week**?`,
        answerType: 'numeric', answer: { value: b }, answerSuffix: 'cm/week',
        traps: [{ value: a, why: `${a} is the intercept (height at week 0) — the weekly growth is the *gradient*.` }],
        hints: ['Which number is the gradient?', 'The coefficient of w.', `${b}.`],
        steps: [{ h: 'Interpret the gradient', d: `Each extra week adds $${b}$ cm — that's the slope of the line.` }]
      };
    }
    const m = mcq(rng, 'Extrapolation — predicting far outside the measured data range is unreliable', [
      { text: 'Interpolation — predicting inside the data range is invalid', why: 'Interpolation (inside the range) is the *safe* kind of prediction.' },
      { text: 'The prediction is fine because the line extends forever' },
      { text: 'Correlation proves causation, so the estimate is exact' }
    ]);
    return {
      prompt: `A line of best fit was built from plants measured for 1–10 weeks. A student uses it to predict height at week 60. What's the statistical problem with this?`,
      answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
      hints: ['Where does week 60 sit relative to the data?', 'Far outside the measured range.', 'That’s extrapolation.'],
      steps: [{ h: 'Extrapolation risk', d: 'Outside the observed range the linear pattern may not continue — predictions there are unreliable.' }]
    };
  },

  // ── MS-M6 · Non-right-angled trigonometry ────────────────────────────────
  'ms12-nonright': (rng, diff) => {
    if (diff === 1) {
      const A = ri(rng, 35, 75), B = ri(rng, 30, 165 - A - 20);
      const aa = ri(rng, 8, 30);
      const bb = aa * Math.sin(rad(B)) / Math.sin(rad(A));
      return {
        prompt: `In triangle $ABC$, $\\angle A = ${A}°$, $\\angle B = ${B}°$ and side $a = ${aa}$ m. Use the sine rule to find side $b$, correct to 1 decimal place.`,
        answerType: 'numeric', answer: { value: r1(bb), tol: 0.07 }, answerSuffix: 'm',
        traps: [{ value: r1(aa * Math.sin(rad(A)) / Math.sin(rad(B))), why: 'Pair each side with its own opposite angle.', tol: 0.07 }],
        hints: ['$\\frac{a}{\\sin A} = \\frac{b}{\\sin B}$.', `$b = \\frac{${aa}\\sin ${B}°}{\\sin ${A}°}$.`, 'Evaluate and round.'],
        steps: [{ h: 'Sine rule', d: `$b = \\dfrac{${aa}\\sin(${B}°)}{\\sin(${A}°)} \\approx ${r1(bb)}$ m` }]
      };
    }
    if (diff === 2) {
      const b = ri(rng, 6, 15), c = ri(rng, 6, 15), A = ri(rng, 40, 120);
      const a2 = b * b + c * c - 2 * b * c * Math.cos(rad(A));
      return {
        prompt: `Two sides of a paddock are $${b}$ m and $${c}$ m, with an included angle of $${A}°$. Use the cosine rule to find the third side, correct to 1 decimal place.`,
        answerType: 'numeric', answer: { value: r1(Math.sqrt(a2)), tol: 0.07 }, answerSuffix: 'm',
        traps: [{ value: r1(Math.sqrt(b * b + c * c)), why: 'The paddock isn’t right-angled — include the $-2bc\\cos A$ term.', tol: 0.07 }],
        hints: ['$a^2 = b^2 + c^2 - 2bc\\cos A$.', `$a^2 = ${b * b} + ${c * c} - ${2 * b * c}\\cos(${A}°) = ${r2(a2)}$.`, 'Square root at the end.'],
        steps: [
          { h: 'Cosine rule', d: `$a^2 = ${r2(a2)}$` },
          { h: 'Square root', d: `$a \\approx ${r1(Math.sqrt(a2))}$ m` }
        ]
      };
    }
    if (diff === 3) {
      const a = ri(rng, 6, 14), b = ri(rng, 6, 14), C = ri(rng, 30, 140);
      const area = 0.5 * a * b * Math.sin(rad(C));
      return {
        prompt: `A triangular sail has sides $${a}$ m and $${b}$ m with an included angle of $${C}°$. Find its area, correct to 1 decimal place.`,
        answerType: 'numeric', answer: { value: r1(area), tol: 0.07 }, answerSuffix: 'm²',
        traps: [{ value: r1(0.5 * a * b), why: 'Include $\\sin C$: $A = \\frac{1}{2}ab\\sin C$.', tol: 0.07 }],
        hints: ['$A = \\frac{1}{2}ab\\sin C$.', `$\\frac{1}{2}(${a})(${b})\\sin(${C}°)$.`, 'Round to 1 dp.'],
        steps: [{ h: 'Area formula', d: `$A = \\tfrac{1}{2}(${a})(${b})\\sin(${C}°) \\approx ${r1(area)}$ m²` }]
      };
    }
    const a = ri(rng, 7, 14), b = ri(rng, 7, 14);
    const c = ri(rng, Math.abs(a - b) + 2, a + b - 2);
    const cosA = (b * b + c * c - a * a) / (2 * b * c);
    const A = Math.acos(cosA) * 180 / Math.PI;
    return {
      prompt: `A triangle has sides $a = ${a}$, $b = ${b}$ and $c = ${c}$. Find the angle $A$ opposite side $a$, to the nearest degree.`,
      answerType: 'numeric', answer: { value: Math.round(A), tol: 0.51 }, answerSuffix: '°', answerPrefix: 'A =',
      traps: [{ value: Math.round(Math.acos((a * a + c * c - b * b) / (2 * a * c)) * 180 / Math.PI), why: 'Angle A is opposite side a — put $a^2$ alone on the subtracted side.', tol: 0.51 }].filter(t => Math.abs(t.value - Math.round(A)) > 1),
      hints: ['Rearranged cosine rule: $\\cos A = \\frac{b^2 + c^2 - a^2}{2bc}$.', `$\\cos A = ${r3(cosA)}$.`, 'Apply $\\cos^{-1}$.'],
      steps: [
        { h: 'Rearranged cosine rule', d: `$\\cos A = \\dfrac{${b * b} + ${c * c} - ${a * a}}{${2 * b * c}} = ${r3(cosA)}$` },
        { h: 'Inverse cos', d: `$A \\approx ${Math.round(A)}°$` }
      ]
    };
  }
};
