// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Stage 5 generators (Year 9) for NSW Mathematics K–10 (2022)
// outcomes the Year 7–10 banks left without an approved form. Original to Pri;
// no NESA paper, question or marking guideline is used. Every answer is a whole
// number (areas and volumes are the coefficient of π, asked for "in terms of π").
//
//   y9-nonlinear-a     MA5-NLI-C-01   Non-linear relationships A
//   y9-variation       MA5-RAT-P-01   Variation and rates of change A
//   y9-rate-change     MA5-RAT-P-02   Variation and rates of change B
//   y9-surface-solids  MA5-ARE-P-01   Area and surface area B
//   y9-volume-solids   MA5-VOL-P-01   Volume B
//   y9-data-inquiry    MA5-DAT-P-01   Data analysis C
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, nz } from '../qhelpers.js';

const TRIPLES = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [6, 8, 10]];

export const year9Nsw = {
  // ── Non-linear relationships A ─────────────────────────────────────────────
  'y9-nonlinear-a': (rng, diff) => {
    if (diff === 1) {
      const a = ri(rng, 1, 5), c = nz(rng, -9, 9), x = ri(rng, -4, 5);
      const y = a * x * x + c;
      return {
        prompt: `A parabola has the rule $y = ${a === 1 ? '' : a}x^2 ${c >= 0 ? '+' : '-'} ${Math.abs(c)}$. Find the value of $y$ when $x = ${x}$.`,
        answerType: 'numeric', answer: { value: y },
        traps: [{ value: (a * x) ** 2 + c, why: 'Square $x$ first, then multiply by $a$: only $x$ is squared.' }].filter(t => t.value !== y),
        hints: ['Substitute $x$, square it first, then multiply.', `$${x}^2 = ${x * x}$.`, `$${a}\\times ${x * x} ${c >= 0 ? '+' : '-'} ${Math.abs(c)}$.`],
        steps: [{ h: 'Substitute', d: `$y = ${a}(${x})^2 ${c >= 0 ? '+' : '-'} ${Math.abs(c)} = ${a * x * x} ${c >= 0 ? '+' : '-'} ${Math.abs(c)} = ${y}$` }]
      };
    }
    if (diff === 2) {
      const h = nz(rng, -6, 6), k = nz(rng, -9, 9);
      return {
        prompt: `What is the minimum value of $y$ for the parabola $y = (x ${h >= 0 ? '-' : '+'} ${Math.abs(h)})^2 ${k >= 0 ? '+' : '-'} ${Math.abs(k)}$?`,
        answerType: 'numeric', answer: { value: k },
        traps: [{ value: h, why: 'The turning point is $(h, k)$; the minimum value of $y$ is $k$, the number added outside the bracket.' }].filter(t => t.value !== k),
        hints: ['A square is never negative, so its smallest value is $0$.', `The bracket is $0$ when $x = ${h}$.`, 'Then $y$ equals the number added.'],
        steps: [{ h: 'Smallest square', d: `$(x ${h >= 0 ? '-' : '+'} ${Math.abs(h)})^2 \\ge 0$, with equality at $x = ${h}$` }, { h: 'Minimum', d: `$y_{\\min} = ${k}$` }]
      };
    }
    if (diff === 3) {
      const m = ri(rng, 2, 9), a = ri(rng, 1, 5);
      return {
        prompt: `Solve $${a === 1 ? '' : a}x^2 = ${a * m * m}$ for the positive value of $x$.`,
        answerType: 'numeric', answer: { value: m },
        traps: [{ value: m * m, why: 'Take the square root after dividing: $x = \\sqrt{x^2}$.' }],
        hints: [`Divide both sides by $${a}$.`, `$x^2 = ${m * m}$.`, 'Take the positive square root.'],
        steps: [{ h: 'Isolate $x^2$', d: `$x^2 = \\dfrac{${a * m * m}}{${a}} = ${m * m}$` }, { h: 'Square root', d: `$x = ${m}$` }]
      };
    }
    const k = ri(rng, 2, 8) * 6, x1 = rc(rng, [2, 3, 6]), x2 = rc(rng, [1, 4, 12]);
    const y1 = k / x1;
    return {
      prompt: `A hyperbola has the rule $y = \\dfrac{k}{x}$ and passes through the point $(${x1}, ${y1})$. Find $y$ when $x = ${x2}$.`,
      answerType: 'numeric', answer: { value: k / x2 },
      traps: [{ value: y1 * x2, why: 'Find $k$ first ($k = xy$), then divide it by the new $x$.' }].filter(t => t.value !== k / x2),
      hints: ['Use the point to find $k$: $k = xy$.', `$k = ${x1}\\times ${y1} = ${k}$.`, `$y = \\dfrac{${k}}{${x2}}$.`],
      steps: [{ h: 'Find k', d: `$k = ${x1}\\times ${y1} = ${k}$` }, { h: 'Evaluate', d: `$y = \\dfrac{${k}}{${x2}} = ${k / x2}$` }]
    };
  },

  // ── Variation ──────────────────────────────────────────────────────────────
  'y9-variation': (rng, diff) => {
    const k = ri(rng, 2, 9);
    if (diff === 1) {
      const x = ri(rng, 2, 9);
      return {
        prompt: `$y$ varies directly with $x$. When $x = ${x}$, $y = ${k * x}$. Find the constant of variation $k$ in $y = kx$.`,
        answerType: 'numeric', answer: { value: k },
        traps: [{ value: x / (k * x), why: '$k = \\dfrac{y}{x}$, not $\\dfrac{x}{y}$.' }].filter(t => Number.isInteger(t.value) && t.value !== k),
        hints: ['In $y = kx$ the constant is $k = \\dfrac{y}{x}$.', `$\\dfrac{${k * x}}{${x}}$.`, 'Check that $y = kx$ gives the original pair.'],
        steps: [{ h: 'Rearrange', d: `$k = \\dfrac{y}{x} = \\dfrac{${k * x}}{${x}} = ${k}$` }]
      };
    }
    if (diff === 2) {
      const x1 = ri(rng, 2, 6), x2 = x1 + ri(rng, 2, 6);
      return {
        prompt: `$y$ varies directly with $x$. When $x = ${x1}$, $y = ${k * x1}$. Find $y$ when $x = ${x2}$.`,
        answerType: 'numeric', answer: { value: k * x2 },
        traps: [{ value: k * x1 + (x2 - x1), why: 'Direct variation is multiplicative: find $k$, then multiply by the new $x$.' }],
        hints: [`First find $k = \\dfrac{${k * x1}}{${x1}} = ${k}$.`, `$y = ${k}x$.`, `$${k}\\times ${x2}$.`],
        steps: [{ h: 'Find k', d: `$k = ${k}$` }, { h: 'Use it', d: `$y = ${k}\\times ${x2} = ${k * x2}$` }]
      };
    }
    if (diff === 3) {
      const x1 = ri(rng, 2, 6), x2 = rc(rng, [1, 2, 3, 4, 6]);
      const c = x1 * x2 * ri(rng, 2, 6);
      const y1 = c / x1;
      return {
        prompt: `$y$ varies inversely with $x$. When $x = ${x1}$, $y = ${y1}$. Find $y$ when $x = ${x2}$.`,
        answerType: 'numeric', answer: { value: c / x2 },
        traps: [{ value: y1 * x2, why: 'Inverse variation: $xy$ stays constant, so $y = \\dfrac{k}{x}$ gets larger when $x$ gets smaller.' }].filter(t => t.value !== c / x2),
        hints: ['Inverse variation: $y = \\dfrac{k}{x}$, so $k = xy$.', `$k = ${x1}\\times ${y1} = ${c}$.`, `$y = \\dfrac{${c}}{${x2}}$.`],
        steps: [{ h: 'Find k', d: `$k = ${x1}\\times ${y1} = ${c}$` }, { h: 'Use it', d: `$y = \\dfrac{${c}}{${x2}} = ${c / x2}$` }]
      };
    }
    const x1 = ri(rng, 2, 4), x2 = x1 + ri(rng, 1, 3);
    return {
      prompt: `$y$ varies directly with the square of $x$. When $x = ${x1}$, $y = ${k * x1 * x1}$. Find $y$ when $x = ${x2}$.`,
      answerType: 'numeric', answer: { value: k * x2 * x2 },
      traps: [{ value: k * x1 * x1 * x2 / x1, why: 'Here $y = kx^2$: square the new $x$ before multiplying by $k$.' }].filter(t => t.value !== k * x2 * x2),
      hints: ['Write $y = kx^2$.', `$k = \\dfrac{${k * x1 * x1}}{${x1 * x1}} = ${k}$.`, `$y = ${k}\\times ${x2}^2$.`],
      steps: [{ h: 'Find k', d: `$k = \\dfrac{${k * x1 * x1}}{${x1}^2} = ${k}$` }, { h: 'Use it', d: `$y = ${k}\\times ${x2 * x2} = ${k * x2 * x2}$` }]
    };
  },

  // ── Rates of change ────────────────────────────────────────────────────────
  'y9-rate-change': (rng, diff) => {
    if (diff === 1) {
      const t = ri(rng, 2, 6), r = ri(rng, 3, 12), d0 = ri(rng, 5, 30);
      return {
        prompt: `A cyclist is $${d0}$ km from home at 1 pm and $${d0 + r * t}$ km from home ${t} hours later. What is the average rate of change of distance, in kilometres per hour?`,
        answerType: 'numeric', answer: { value: r }, answerSuffix: 'km/h',
        traps: [{ value: (d0 + r * t) / t, why: 'Use the change in distance ($${r * t}$ km), not the final distance.' }].filter(x => x.value !== r),
        hints: ['Average rate of change $=\\dfrac{\\text{change in distance}}{\\text{change in time}}$.', `Change in distance: $${d0 + r * t} - ${d0}$.`, `Divide by $${t}$ hours.`],
        steps: [{ h: 'Rate', d: `$\\dfrac{${d0 + r * t} - ${d0}}{${t}} = \\dfrac{${r * t}}{${t}} = ${r}$ km/h` }]
      };
    }
    if (diff === 2) {
      const a = ri(rng, 1, 5), b = a + ri(rng, 2, 5);
      return {
        prompt: `Find the average rate of change of $y = x^2$ between $x = ${a}$ and $x = ${b}$.`,
        answerType: 'numeric', answer: { value: a + b },
        traps: [{ value: b * b - a * a, why: 'That is the change in $y$; divide by the change in $x$, $b - a$.' }],
        hints: ['Average rate $=\\dfrac{y_2 - y_1}{x_2 - x_1}$.', `$y$ goes from $${a * a}$ to $${b * b}$.`, `$\\dfrac{${b * b - a * a}}{${b - a}}$.`],
        steps: [{ h: 'Change in y', d: `$${b * b} - ${a * a} = ${b * b - a * a}$` }, { h: 'Divide by the change in x', d: `$\\dfrac{${b * b - a * a}}{${b - a}} = ${a + b}$` }]
      };
    }
    if (diff === 3) {
      const ra = ri(rng, 40, 90), rb = ra - ri(rng, 5, 30);
      return {
        prompt: `Car A travels at a constant $${ra}$ km/h and car B at a constant $${rb}$ km/h. How many kilometres further does car A travel than car B in 3 hours?`,
        answerType: 'numeric', answer: { value: 3 * (ra - rb) }, answerSuffix: 'km',
        traps: [{ value: ra - rb, why: 'The gap grows each hour: multiply the difference in rates by the 3 hours.' }],
        hints: ['Distance $=$ rate $\\times$ time for each car.', `Difference in rates: $${ra} - ${rb} = ${ra - rb}$ km/h.`, 'Multiply by 3 hours.'],
        steps: [{ h: 'Difference in rates', d: `$${ra} - ${rb} = ${ra - rb}$ km/h` }, { h: 'Over 3 hours', d: `$${ra - rb}\\times 3 = ${3 * (ra - rb)}$ km` }]
      };
    }
    const r = ri(rng, 4, 12), r2 = r + ri(rng, 2, 6), t1 = ri(rng, 2, 5), t2 = ri(rng, 2, 5);
    return {
      prompt: `A tank is filled at $${r}$ litres per minute for $${t1}$ minutes, then at $${r2}$ litres per minute for a further $${t2}$ minutes. How many litres are in the tank, if it started empty?`,
      answerType: 'numeric', answer: { value: r * t1 + r2 * t2 }, answerSuffix: 'L',
      traps: [{ value: (r + r2) * (t1 + t2), why: 'Each rate applies only for its own time: add rate $\\times$ time for each stage.' }].filter(x => x.value !== r * t1 + r2 * t2),
      hints: ['Amount $=$ rate $\\times$ time, for each stage.', `Stage 1: $${r}\\times ${t1} = ${r * t1}$.`, `Stage 2: $${r2}\\times ${t2} = ${r2 * t2}$.`],
      steps: [{ h: 'Two stages', d: `$${r}\\times ${t1} + ${r2}\\times ${t2} = ${r * t1} + ${r2 * t2} = ${r * t1 + r2 * t2}$` }]
    };
  },

  // ── Surface area of solids (coefficient of π) ──────────────────────────────
  'y9-surface-solids': (rng, diff) => {
    if (diff === 1) {
      const r = ri(rng, 2, 12);
      return {
        prompt: `A sphere has radius $${r}$ cm. Its surface area is $k\\pi$ cm². Find $k$.`,
        answerType: 'numeric', answer: { value: 4 * r * r },
        traps: [{ value: 2 * r * r, why: 'The surface area of a sphere is $4\\pi r^2$, four times the area of a great circle.' }],
        hints: ['$A = 4\\pi r^2$.', `$r^2 = ${r * r}$.`, `$4\\times ${r * r}$.`],
        steps: [{ h: 'Formula', d: `$A = 4\\pi r^2 = 4\\pi(${r})^2 = ${4 * r * r}\\pi$` }]
      };
    }
    if (diff === 2 || diff === 4) {
      const [a, , c] = rc(rng, TRIPLES), m = ri(rng, 1, 3);
      const r = a * m, l = c * m;
      const curved = diff === 2;
      return {
        prompt: `A cone has base radius $${r}$ cm and slant height $${l}$ cm. Its ${curved ? 'curved surface area' : 'total surface area (including the base)'} is $k\\pi$ cm². Find $k$.`,
        answerType: 'numeric', answer: { value: curved ? r * l : r * r + r * l },
        traps: [{ value: curved ? r * r : r * l, why: curved ? 'The curved surface of a cone is $\\pi r l$ (radius times slant height).' : 'The total surface area adds the base, $\\pi r^2$, to the curved surface, $\\pi r l$.' }],
        hints: [curved ? '$A = \\pi r l$.' : '$A = \\pi r^2 + \\pi r l$.', `$r = ${r}$ and $l = ${l}$.`, curved ? `$${r}\\times ${l}$.` : `$${r * r} + ${r * l}$.`],
        steps: [{ h: 'Formula', d: curved ? `$A = \\pi r l = \\pi(${r})(${l}) = ${r * l}\\pi$` : `$A = \\pi r^2 + \\pi r l = ${r * r}\\pi + ${r * l}\\pi = ${r * r + r * l}\\pi$` }]
      };
    }
    const s = ri(rng, 4, 14), l = ri(rng, 3, 15);
    return {
      prompt: `A square pyramid has a base of side $${s}$ cm and each of its four triangular faces has slant height $${l}$ cm. Find its total surface area, in cm².`,
      answerType: 'numeric', answer: { value: s * s + 2 * s * l }, answerSuffix: 'cm²',
      traps: [{ value: s * s + s * l, why: 'There are four triangular faces, each $\\frac12 s l$, so together $2sl$.' }],
      hints: ['Base plus four triangles.', `Each triangle: $\\tfrac12\\times ${s}\\times ${l} = ${s * l / 2}$.`, `Total: $${s * s} + 4\\times ${s * l / 2}$.`],
      steps: [{ h: 'Base', d: `$${s}^2 = ${s * s}$` }, { h: 'Four triangles', d: `$4\\times\\tfrac12\\times ${s}\\times ${l} = ${2 * s * l}$` }, { h: 'Total', d: `$${s * s} + ${2 * s * l} = ${s * s + 2 * s * l}$ cm²` }]
    };
  },

  // ── Volume of solids (coefficient of π, or whole cubic units) ──────────────
  'y9-volume-solids': (rng, diff) => {
    if (diff === 1 || diff === 4) {
      const r = 3 * ri(rng, 1, 5);
      const hemi = diff === 4;
      const thing = hemi ? rc(rng, ['solid hemisphere', 'hemispherical dome', 'hemispherical bowl (solid)']) : rc(rng, ['sphere', 'solid ball', 'steel ball']);
      return {
        prompt: `A ${thing} has radius $${r}$ cm. Its volume is $k\\pi$ cm³. Find $k$.`,
        answerType: 'numeric', answer: { value: (hemi ? 2 : 4) * r ** 3 / 3 },
        traps: [{ value: hemi ? 4 * r ** 3 / 3 : 2 * r ** 3 / 3, why: hemi ? 'A hemisphere is half a sphere: $\\tfrac23\\pi r^3$.' : 'A sphere has volume $\\tfrac43\\pi r^3$.' }],
        hints: [hemi ? '$V = \\tfrac23\\pi r^3$.' : '$V = \\tfrac43\\pi r^3$.', `$r^3 = ${r ** 3}$.`, `Multiply by ${hemi ? '$\\tfrac23$' : '$\\tfrac43$'}.`],
        steps: [{ h: 'Formula', d: `$V = ${hemi ? '\\tfrac23' : '\\tfrac43'}\\pi(${r})^3 = ${(hemi ? 2 : 4) * r ** 3 / 3}\\pi$` }]
      };
    }
    if (diff === 2) {
      const r = ri(rng, 2, 9), h = 3 * ri(rng, 1, 5);
      return {
        prompt: `A cone has base radius $${r}$ cm and perpendicular height $${h}$ cm. Its volume is $k\\pi$ cm³. Find $k$.`,
        answerType: 'numeric', answer: { value: r * r * h / 3 },
        traps: [{ value: r * r * h, why: 'A cone is one third of the cylinder with the same base and height.' }],
        hints: ['$V = \\tfrac13\\pi r^2 h$.', `$r^2 h = ${r * r * h}$.`, 'Divide by 3.'],
        steps: [{ h: 'Formula', d: `$V = \\tfrac13\\pi(${r})^2(${h}) = ${r * r * h / 3}\\pi$` }]
      };
    }
    const s = ri(rng, 3, 12), h = 3 * ri(rng, 1, 6);
    return {
      prompt: `A square pyramid has a base of side $${s}$ cm and a perpendicular height of $${h}$ cm. Find its volume, in cm³.`,
      answerType: 'numeric', answer: { value: s * s * h / 3 }, answerSuffix: 'cm³',
      traps: [{ value: s * s * h, why: 'A pyramid is one third of the prism with the same base and height.' }],
      hints: ['$V = \\tfrac13\\times\\text{base area}\\times\\text{height}$.', `Base area $= ${s * s}$.`, `$${s * s}\\times ${h}\\div 3$.`],
      steps: [{ h: 'Formula', d: `$V = \\tfrac13\\times ${s * s}\\times ${h} = ${s * s * h / 3}$ cm³` }]
    };
  },

  // ── Data analysis C ────────────────────────────────────────────────────────
  'y9-data-inquiry': (rng, diff) => {
    if (diff === 1) {
      for (let tries = 0; tries < 4000; tries++) {
        const xs = [ri(rng, 1, 3), ri(rng, 4, 6), ri(rng, 7, 9), ri(rng, 10, 12)].sort((a, b) => a - b);
        const fs = [ri(rng, 1, 6), ri(rng, 1, 6), ri(rng, 1, 6), ri(rng, 1, 6)];
        const n = fs.reduce((s, v) => s + v, 0), sum = xs.reduce((s, x, i) => s + x * fs[i], 0);
        if (new Set(xs).size === 4 && sum % n === 0) {
          return {
            prompt: `A frequency table shows the score $x$ and its frequency $f$: ${xs.map((x, i) => `$x = ${x}$, $f = ${fs[i]}$`).join('; ')}. Find the mean score.`,
            answerType: 'numeric', answer: { value: sum / n },
            traps: [{ value: xs.reduce((s, v) => s + v, 0) / 4, why: 'Weight each score by its frequency: the mean is $\\dfrac{\\sum fx}{\\sum f}$.' }].filter(t => t.value !== sum / n),
            hints: ['Mean $=\\dfrac{\\sum fx}{\\sum f}$.', `$\\sum f = ${n}$.`, `$\\sum fx = ${sum}$.`],
            steps: [{ h: 'Sum of fx', d: `$${xs.map((x, i) => `${x}\\times${fs[i]}`).join(' + ')} = ${sum}$` }, { h: 'Divide by the frequency total', d: `$${sum}\\div ${n} = ${sum / n}$` }]
          };
        }
      }
      throw new Error('y9-data-inquiry: no whole-mean table found');
    }
    if (diff === 2) {
      const q1 = ri(rng, 10, 30), iqr = ri(rng, 6, 25), med = q1 + ri(rng, 3, iqr - 3), mn = q1 - ri(rng, 3, 9), mx = q1 + iqr + ri(rng, 3, 15);
      return {
        prompt: `A five-number summary is: minimum $${mn}$, lower quartile $${q1}$, median $${med}$, upper quartile $${q1 + iqr}$, maximum $${mx}$. Find the interquartile range.`,
        answerType: 'numeric', answer: { value: iqr },
        traps: [{ value: mx - mn, why: 'That is the range. The interquartile range is $Q_3 - Q_1$.' }],
        hints: ['$\\text{IQR} = Q_3 - Q_1$.', `$Q_3 = ${q1 + iqr}$ and $Q_1 = ${q1}$.`, 'Ignore the minimum, median and maximum.'],
        steps: [{ h: 'IQR', d: `$${q1 + iqr} - ${q1} = ${iqr}$` }]
      };
    }
    if (diff === 3) {
      const xs = Array.from({ length: 11 }, () => ri(rng, 3, 60)).sort((a, b) => a - b);
      return {
        prompt: `Eleven values in order are ${xs.join(', ')}. Find the interquartile range (use the median of the lower five values and of the upper five values as $Q_1$ and $Q_3$).`,
        answerType: 'numeric', answer: { value: xs[8] - xs[2] },
        traps: [{ value: xs[10] - xs[0], why: 'That is the range. The interquartile range is $Q_3 - Q_1$.' }].filter(t => t.value !== xs[8] - xs[2]),
        hints: ['The median is the 6th value; it is left out of both halves.', `$Q_1$ is the 3rd value, $${xs[2]}$.`, `$Q_3$ is the 9th value, $${xs[8]}$.`],
        steps: [{ h: 'Quartiles', d: `$Q_1 = ${xs[2]}$, $Q_3 = ${xs[8]}$` }, { h: 'IQR', d: `$${xs[8]} - ${xs[2]} = ${xs[8] - xs[2]}$` }]
      };
    }
    const m = ri(rng, 10, 40), newMean = m + ri(rng, 1, 5), n = 5;
    const v = (n + 1) * newMean - n * m;
    return {
      prompt: `The mean of $${n}$ values is $${m}$. A sixth value of $${v}$ is added. What is the mean of the six values?`,
      answerType: 'numeric', answer: { value: newMean },
      traps: [{ value: (m + v) / 2, why: 'The original mean stands for five values, so its total is $5\\times ${m}$, not one value.' }].filter(t => t.value !== newMean && Number.isFinite(t.value)),
      hints: [`The original total is $${n}\\times ${m} = ${n * m}$.`, `The new total is $${n * m} + ${v}$.`, 'Divide by 6.'],
      steps: [{ h: 'New total', d: `$${n}\\times ${m} + ${v} = ${n * m + v}$` }, { h: 'New mean', d: `$${n * m + v}\\div 6 = ${newMean}$` }]
    };
  }
};
