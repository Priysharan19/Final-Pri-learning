// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Prithagoras capacity overlay · Mathematics Standard (Years 11–12), part B
// Extra structural forms for: ms12-normal-exact, ms12-normal, ms12-bivariate-fit,
// ms12-nonright, ms12-network-flow, ms11-measure, ms11-formulas, ms11-relfreq.
// Every key is computed from the same numbers the prompt shows; none is a typed
// constant. Variants are engine-keyed like any generator; AI never sets a key.
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc, mcq, Frac, r1, r2, r3, moneyPlain, rad, NAMES } from '../qhelpers.js';

const cl = v => Math.round(v * 1e6) / 1e6;
const keep = (key, traps, tol = 0) =>
  (traps || []).filter(t => Number.isFinite(t.value) && Math.abs(t.value - key) > Math.max(tol, t.tol || 0, 1e-9));

function num(prompt, key, o) {
  const answer = { value: key };
  if (o.tol) answer.tol = o.tol;
  const q = { prompt, answerType: 'numeric', answer, traps: keep(key, o.traps, o.tol), hints: o.hints, steps: o.steps };
  if (o.suffix) q.answerSuffix = o.suffix;
  if (o.prefix) q.answerPrefix = o.prefix;
  return q;
}
function choice(rng, prompt, correct, distractors, hints, steps) {
  const m = mcq(rng, correct, distractors);
  return { prompt, answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options, hints, steps };
}
function fracQ(prompt, n, d, o) {
  const f = new Frac(n, d);
  const traps = (o.traps || []).filter(t => Number.isFinite(t.value) && Math.abs(t.value - f.value) > 1e-9);
  return {
    prompt, answerType: 'numeric', answer: { value: f.value, simplestFraction: { n: f.n, d: f.d } },
    inputHint: 'e.g. 3/5', traps, hints: o.hints, steps: o.steps
  };
}
const pick = (rng, lo, hi, not) => { let v; do { v = ri(rng, lo, hi); } while (v === not); return v; };

// ── Normal-distribution contexts ─────────────────────────────────────────────
const NC = [
  { sub: 'The times taken by Year 10 swimmers to complete a 50 m heat', u: 's', mu: [38, 70], sd: [2, 6] },
  { sub: 'The heights of netball players in a Sydney competition', u: 'cm', mu: [168, 184], sd: [3, 8] },
  { sub: 'The masses of bags of oranges from a Griffith packing shed', u: 'g', mu: [1000, 2000], sd: [10, 40] },
  { sub: 'The speeds of fast bowlers in a cricket season', u: 'km/h', mu: [125, 140], sd: [3, 6] },
  { sub: 'The lifetimes of a brand of phone battery', u: 'hours', mu: [400, 600], sd: [20, 40] }
];
const nctx = rng => { const c = rc(rng, NC); return { ...c, mu: ri(rng, c.mu[0], c.mu[1]), sd: ri(rng, c.sd[0], c.sd[1]) }; };
const dist = c => `${c.sub} are normally distributed with a mean of $${c.mu}$ ${c.u} and a standard deviation of $${c.sd}$ ${c.u}.`;
const plural = k => (k === 1 ? 'standard deviation' : 'standard deviations');

// ── Normal ranges for the 68–95–99.7 rule (hundredths of a percent) ───────────
const HALF = { 1: 3400, 2: 4750, 3: 4985 };           // between the mean and mean + kσ
const TAIL = { 1: 1600, 2: 250, 3: 15 };              // beyond mean ± kσ on one side
const RING = { 2: 1350, 3: 235 };                     // between (k−1)σ and kσ on one side
const OUT = { 1: 3200, 2: 500, 3: 30 };               // outside mean ± kσ (both sides)
const countOf = (N, hundredths) => N * hundredths / 10000;

const normalExact = [
  // Direct, in context: z-score of a value, or value from a z-score.
  {
    make: rng => {
      const c = nctx(rng), z = rc(rng, [-3, -2, -1, 1, 2, 3]), x = c.mu + z * c.sd;
      if (rng() < 0.5) {
        return num(`${dist(c)} What is the $z$-score of a value of $${x}$ ${c.u}?`, z, {
          prefix: 'z =',
          traps: [{ value: -z, why: z > 0 ? 'A value above the mean has a positive $z$-score.' : 'A value below the mean has a negative $z$-score.' }, { value: x - c.mu, why: `Divide the difference from the mean by the standard deviation, $${c.sd}$.` }],
          hints: ['$z = \\dfrac{x - \\mu}{\\sigma}$.', `$${x} - ${c.mu} = ${x - c.mu}$.`, `Divide by $${c.sd}$.`],
          steps: [{ h: 'Standardise', d: `$z = \\dfrac{${x} - ${c.mu}}{${c.sd}} = ${z}$` }]
        });
      }
      return num(`${dist(c)} A value has a $z$-score of $${z}$. What is the value, in ${c.u}?`, x, {
        traps: [{ value: z * c.sd, why: 'Add this to the mean: $x = \\mu + z\\sigma$.' }, { value: c.mu - z * c.sd, why: z > 0 ? 'A positive $z$-score is above the mean.' : 'A negative $z$-score is below the mean.' }],
        hints: ['$x = \\mu + z\\sigma$.', `$z\\sigma = ${z * c.sd}$.`, `Add $${c.mu}$.`],
        steps: [{ h: 'Un-standardise', d: `$x = ${c.mu} + (${z})(${c.sd}) = ${x}$ ${c.u}` }]
      });
    }
  },
  // Reverse: find the mean.
  {
    diffs: [1, 2, 3],
    make: rng => {
      const sd = ri(rng, 2, 8), mu = ri(rng, 40, 90), z = rc(rng, [-3, -2, -1, 1, 2, 3]), x = mu + z * sd;
      return num(`A normally distributed variable has a standard deviation of $${sd}$. A value of $${x}$ has a $z$-score of $${z}$. What is the mean?`, mu, {
        traps: [{ value: x + z * sd, why: `Go the other way: $\\mu = x - z\\sigma$.` }, { value: z * sd, why: 'Take this away from the value to reach the mean.' }],
        hints: ['Rearrange $z = \\dfrac{x - \\mu}{\\sigma}$ for $\\mu$.', `$\\mu = x - z\\sigma = ${x} - (${z})(${sd})$.`, 'Evaluate.'],
        steps: [{ h: 'Rearrange', d: `$\\mu = x - z\\sigma$` }, { h: 'Substitute', d: `$\\mu = ${x} - (${z})(${sd}) = ${mu}$` }]
      });
    }
  },
  // Reverse: find the standard deviation.
  {
    diffs: [2, 3, 4],
    make: rng => {
      const sd = ri(rng, 2, 9), mu = ri(rng, 40, 90), z = rc(rng, [-3, -2, -1, 1, 2, 3]), x = mu + z * sd;
      return num(`A normally distributed variable has a mean of $${mu}$. A value of $${x}$ has a $z$-score of $${z}$. What is the standard deviation?`, (x - mu) / z, {
        traps: [{ value: x - mu, why: `Divide by $z = ${z}$ as well: $\\sigma = \\dfrac{x - \\mu}{z}$.` }, { value: z * (x - mu), why: 'Divide the difference by $z$; do not multiply.' }],
        hints: ['Rearrange $z = \\dfrac{x - \\mu}{\\sigma}$ for $\\sigma$.', `$\\sigma = \\dfrac{x - \\mu}{z} = \\dfrac{${x} - ${mu}}{${z}}$.`, 'Evaluate; a standard deviation is positive.'],
        steps: [{ h: 'Rearrange', d: `$\\sigma = \\dfrac{x - \\mu}{z}$` }, { h: 'Substitute', d: `$\\sigma = \\dfrac{${x - mu}}{${z}} = ${(x - mu) / z}$` }]
      });
    }
  },
  // How many standard deviations above or below the mean.
  {
    diffs: [1, 2],
    make: rng => {
      const mu = ri(rng, 40, 90), sd = ri(rng, 2, 8), z = rc(rng, [-3, -2, -1, 1, 2, 3]), x = mu + z * sd;
      return num(`A normally distributed variable has mean $${mu}$ and standard deviation $${sd}$. How many standard deviations ${z > 0 ? 'above' : 'below'} the mean is a value of $${x}$?`, Math.abs(z), {
        traps: [{ value: Math.abs(x - mu), why: `That is the distance in the original units; divide by the standard deviation $${sd}$.` }],
        hints: ['Find the distance from the mean, then divide by $\\sigma$.', `$|${x} - ${mu}| = ${Math.abs(x - mu)}$.`, `Divide by $${sd}$.`],
        steps: [{ h: 'Distance', d: `$|${x} - ${mu}| = ${Math.abs(x - mu)}$` }, { h: 'In standard deviations', d: `$\\dfrac{${Math.abs(x - mu)}}{${sd}} = ${Math.abs(z)}$` }]
      });
    }
  },
  // Multiple choice: the meaning of a z-score.
  {
    diffs: [1, 2, 3],
    make: rng => {
      const mu = ri(rng, 40, 90), sd = ri(rng, 2, 8), z = rc(rng, [-3, -2, -1, 1, 2, 3]), x = mu + z * sd;
      const dir = z > 0 ? 'above' : 'below', other = z > 0 ? 'below' : 'above', k = Math.abs(z);
      return choice(rng,
        `Scores on a test are normally distributed with mean $${mu}$ and standard deviation $${sd}$. A student scores $${x}$. Which statement is correct?`,
        `The score is $${k}$ ${plural(k)} ${dir} the mean`,
        [{ text: `The score is $${k}$ ${plural(k)} ${other} the mean`, why: z > 0 ? 'The score is greater than the mean, so it lies above it.' : 'The score is less than the mean, so it lies below it.' },
          { text: `The score is $${Math.abs(x - mu)}$ ${plural(Math.abs(x - mu))} ${dir} the mean`, why: 'The difference in marks must be divided by the standard deviation to give a number of standard deviations.' },
          { text: `The score is $${sd}$ ${plural(sd)} ${dir} the mean`, why: 'The standard deviation is the size of one step; it is not the number of steps.' }],
        ['Compare the score with the mean, then count standard deviations.', `$${x} - ${mu} = ${x - mu}$ and one standard deviation is $${sd}$.`, `$z = ${z}$.`],
        [{ h: 'Standardise', d: `$z = \\dfrac{${x} - ${mu}}{${sd}} = ${z}$` }, { h: 'Interpret', d: `${k} ${plural(k)} ${dir} the mean` }]);
    }
  },
  // Counts using half-ranges and tails of the 68–95–99.7 rule.
  {
    diffs: [3, 4],
    make: (rng, diff) => {
      const mu = ri(rng, 40, 90), sd = ri(rng, 2, 8), N = rc(rng, [2000, 4000, 6000, 8000, 10000]);
      const k = rc(rng, [1, 2, 3]);
      let h, text, why, step;
      if (diff === 3) {
        if (rng() < 0.5) { h = HALF[k]; text = `between $${mu}$ and $${mu + k * sd}$`; step = `Between $\\mu$ and $\\mu + ${k}\\sigma$: ${h / 100}%`; why = 'The rule describes both sides of the mean; here only one side is wanted, so use half of the whole range.'; }
        else { h = TAIL[k]; text = `less than $${mu - k * sd}$`; step = `Below $\\mu - ${k}\\sigma$: ${h / 100}%`; why = 'Take the percentage outside the limits and share it between the two tails.'; }
      } else if (rng() < 0.5) {
        const kk = rc(rng, [2, 3]);
        h = RING[kk]; text = `between $${mu + (kk - 1) * sd}$ and $${mu + kk * sd}$`; step = `Between $\\mu + ${kk - 1}\\sigma$ and $\\mu + ${kk}\\sigma$: ${h / 100}%`; why = 'Subtract the smaller central percentage from the larger one, then halve it.';
      } else { h = OUT[k]; text = `outside the interval from $${mu - k * sd}$ to $${mu + k * sd}$`; step = `Outside $\\mu \\pm ${k}\\sigma$: ${h / 100}%`; why = 'The values outside the limits are what remain after the central percentage is removed.'; }
      const key = countOf(N, h);
      return num(`A normally distributed variable has mean $${mu}$ and standard deviation $${sd}$. In a sample of $${N}$ values, using the 68–95–99.7 rule, about how many are expected to be ${text}?`, key, {
        traps: [{ value: countOf(N, 10000 - h), why: 'Check which side of the limits the question asks about.' }, { value: countOf(N, h * 2), why }],
        hints: ['Write the limits as numbers of standard deviations from the mean.', 'Use the 68–95–99.7 rule and the symmetry of the curve.', `Take that percentage of $${N}$.`],
        steps: [{ h: 'Match the rule', d: step }, { h: 'Count', d: `${h / 100}% of $${N} = ${key}$` }]
      });
    }
  },
  // Reverse: standard deviation from a 68 / 95 / 99.7 interval.
  {
    diffs: [3, 4],
    make: rng => {
      const mu = ri(rng, 40, 90), sd = ri(rng, 2, 8), k = rc(rng, [1, 2, 3]), pct = { 1: '68', 2: '95', 3: '99.7' }[k];
      const lo = mu - k * sd, hi = mu + k * sd;
      return num(`About ${pct}% of the values of a normally distributed variable lie between $${lo}$ and $${hi}$. What is the standard deviation?`, sd, {
        traps: [{ value: (hi - lo) / 2, why: `This interval is $\\mu \\pm ${k}\\sigma$, so its width is $${2 * k}\\sigma$.` }, { value: hi - lo, why: 'That is the width of the whole interval, not one standard deviation.' }],
        hints: [`${pct}% corresponds to $\\mu \\pm ${k}\\sigma$.`, `The width is $${hi} - ${lo} = ${hi - lo}$, which is $${2 * k}\\sigma$.`, `Divide by $${2 * k}$.`],
        steps: [{ h: 'Match the rule', d: `${pct}% lies within $${k}$ ${plural(k)} of the mean` }, { h: 'Width', d: `$${hi} - ${lo} = ${hi - lo} = ${2 * k}\\sigma$` }, { h: 'Solve', d: `$\\sigma = ${sd}$` }]
      });
    }
  },
  // Two students, two tests: who did better relative to their cohort?
  {
    diffs: [3, 4],
    make: rng => {
      const ZS = [-1.5, -1, -0.5, 0.5, 1, 1.5, 2, 2.5];
      const sd1 = rc(rng, [4, 6, 8, 10]), sd2 = rc(rng, [4, 6, 8, 10]);
      const mu1 = ri(rng, 50, 80), mu2 = ri(rng, 50, 80);
      const z1 = rc(rng, ZS), z2 = rc(rng, ZS.filter(v => v !== z1));
      const x1 = mu1 + z1 * sd1, x2 = mu2 + z2 * sd2;
      const [n1, n2] = [rc(rng, NAMES.slice(0, 13)), rc(rng, NAMES.slice(13))];
      const best = z1 > z2 ? n1 : n2, worse = z1 > z2 ? n2 : n1;
      const rawHigher = x1 > x2 ? n1 : x2 > x1 ? n2 : null;
      return choice(rng,
        `${n1} scored $${x1}$ in Mathematics (class mean $${mu1}$, standard deviation $${sd1}$). ${n2} scored $${x2}$ in Science (class mean $${mu2}$, standard deviation $${sd2}$). Both sets of marks are normally distributed. Who performed better compared with their own class?`,
        best,
        [{ text: worse, why: rawHigher === worse ? 'A higher raw score does not decide it: compare the $z$-scores, which allow for each class’s mean and spread.' : 'Compare the $z$-scores; the higher $z$-score is the better result.' },
          { text: 'They performed equally well', why: 'Their $z$-scores are different, so one result is stronger relative to its class.' },
          { text: 'They cannot be compared because the tests are different', why: '$z$-scores put marks from different tests on the same scale, so they can be compared.' }],
        ['Convert both marks to $z$-scores.', `$z_1 = \\dfrac{${x1} - ${mu1}}{${sd1}} = ${cl(z1)}$.`, `$z_2 = \\dfrac{${x2} - ${mu2}}{${sd2}} = ${cl(z2)}$.`],
        [{ h: 'Standardise', d: `$z_1 = ${cl(z1)}, \\ z_2 = ${cl(z2)}$` }, { h: 'Compare', d: `The higher $z$-score belongs to ${best}.` }]);
    }
  }
];

const normal = [
  // Percentage less than / greater than a value.
  {
    diffs: [3, 4],
    make: rng => {
      const c = nctx(rng), k = rc(rng, [1, 2, 3]);
      const above = rng() < 0.5, hiSide = rng() < 0.5;
      const lim = hiSide ? c.mu + k * c.sd : c.mu - k * c.sd;
      const tail = TAIL[k] / 100;
      const key = (hiSide === above) ? tail : cl(100 - tail);
      return num(`${dist(c)} Using the 68–95–99.7 rule, what percentage of values are ${above ? 'greater' : 'less'} than $${lim}$ ${c.u}?`, key, {
        suffix: '%',
        traps: [{ value: cl(100 - key), why: 'Check whether the question asks for the values above or below the limit.' }, { value: tail * 2, why: 'The tail percentage already refers to one side only.' }],
        hints: [`$${lim}$ is $${k}$ ${plural(k)} ${hiSide ? 'above' : 'below'} the mean.`, `The two tails beyond $\\mu \\pm ${k}\\sigma$ share ${cl(100 - (k === 1 ? 68 : k === 2 ? 95 : 99.7))}%.`, 'Use symmetry to get one tail, then decide which side is needed.'],
        steps: [{ h: 'One tail', d: `Beyond $${k}\\sigma$ on one side: $${tail}\\%$` }, { h: 'The side asked for', d: `$${key}\\%$` }]
      });
    }
  },
  // Counts in a large cohort.
  {
    diffs: [3, 4],
    make: rng => {
      const c = nctx(rng), k = rc(rng, [1, 2, 3]), N = rc(rng, [2000, 4000, 6000, 8000, 10000]);
      const key = countOf(N, TAIL[k]);
      return num(`${dist(c)} In a sample of $${N}$ such values, about how many are expected to be greater than $${c.mu + k * c.sd}$ ${c.u}? Use the 68–95–99.7 rule.`, key, {
        traps: [{ value: countOf(N, 10000 - TAIL[k]), why: 'This is the number below the limit; the question asks for those above it.' }, { value: countOf(N, TAIL[k] * 2), why: 'Only the upper tail is wanted, not both.' }],
        hints: [`$${c.mu + k * c.sd}$ is $${k}$ ${plural(k)} above the mean.`, `About ${TAIL[k] / 100}% lie above that.`, `${TAIL[k] / 100}% of $${N}$.`],
        steps: [{ h: 'Match the rule', d: `Above $\\mu + ${k}\\sigma$: ${TAIL[k] / 100}%` }, { h: 'Count', d: `${TAIL[k] / 100}% of $${N} = ${key}$` }]
      });
    }
  },
  // Is a value unusual (|z| > 2)?
  {
    diffs: [3, 4],
    make: rng => {
      const mu = rc(rng, [40, 50, 60, 70, 80, 100, 120]), sd = rc(rng, [4, 6, 8, 10, 12]);
      const z = rc(rng, [-3, -2.5, -1.5, -1, -0.5, 0.5, 1, 1.5, 2.5, 3]);
      const x = mu + z * sd, unusual = Math.abs(z) > 2;
      const ztxt = cl(z);
      return choice(rng,
        `A normally distributed variable has mean $${mu}$ and standard deviation $${sd}$. A value is called unusual if its $z$-score is more than $2$ in size. Is a value of $${x}$ unusual?`,
        unusual ? `Yes, because $z = ${ztxt}$` : `No, because $z = ${ztxt}$`,
        [{ text: unusual ? `No, because $z = ${ztxt}$` : `Yes, because $z = ${ztxt}$`, why: 'Compare the size of $z$ with $2$, ignoring the sign.' },
          { text: `${unusual ? 'No' : 'Yes'}, because $z = ${x - mu}$`, why: 'The $z$-score is the difference divided by the standard deviation.' },
          { text: `${unusual ? 'No' : 'Yes'}, because $z = ${cl(-z)}$`, why: 'The sign of $z$ shows which side of the mean the value is on.' }],
        ['Find the $z$-score.', `$z = \\dfrac{${x} - ${mu}}{${sd}}$.`, 'Is $|z| > 2$?'],
        [{ h: 'Standardise', d: `$z = \\dfrac{${x} - ${mu}}{${sd}} = ${ztxt}$` }, { h: 'Decide', d: `$|z| ${unusual ? '>' : '\\le'} 2$, so the value is ${unusual ? '' : 'not '}unusual` }]);
    }
  },
  // Mean or standard deviation from a symmetric interval.
  {
    diffs: [3, 4],
    make: rng => {
      const mu = ri(rng, 40, 120), sd = ri(rng, 2, 9), k = rc(rng, [1, 2, 3]), pct = { 1: '68', 2: '95', 3: '99.7' }[k];
      const lo = mu - k * sd, hi = mu + k * sd;
      const askMean = rng() < 0.5;
      const text = `About ${pct}% of the results on an aptitude test, which are normally distributed, lie between $${lo}$ and $${hi}$.`;
      return askMean
        ? num(`${text} What is the mean?`, mu, {
          traps: [{ value: hi - lo, why: 'The mean is the midpoint of the interval.' }, { value: (hi - lo) / 2, why: 'That is half the width, not the centre.' }],
          hints: ['A normal distribution is symmetric about its mean.', 'The mean is halfway between the limits.', `$\\dfrac{${lo} + ${hi}}{2}$.`],
          steps: [{ h: 'Midpoint', d: `$\\mu = \\dfrac{${lo} + ${hi}}{2} = ${mu}$` }]
        })
        : num(`${text} What is the standard deviation?`, sd, {
          traps: [{ value: (hi - lo) / 2, why: `The interval is $\\mu \\pm ${k}\\sigma$, so its half-width is $${k}\\sigma$.` }],
          hints: [`${pct}% matches $\\mu \\pm ${k}\\sigma$.`, `Half the width is $${(hi - lo) / 2} = ${k}\\sigma$.`, `Divide by $${k}$.`],
          steps: [{ h: 'Half-width', d: `$\\dfrac{${hi} - ${lo}}{2} = ${(hi - lo) / 2}$` }, { h: 'Divide', d: `$\\sigma = \\dfrac{${(hi - lo) / 2}}{${k}} = ${sd}$` }]
        });
    }
  },
  // A result of equal standing on a second test.
  {
    diffs: [4],
    make: rng => {
      const mu1 = ri(rng, 50, 80), sd1 = rc(rng, [4, 6, 8, 10]), mu2 = ri(rng, 50, 80), sd2 = rc(rng, [4, 6, 8, 10, 12]);
      const z = rc(rng, [-1.5, -1, -0.5, 0.5, 1, 1.5, 2, 2.5]);
      const x1 = mu1 + z * sd1, key = mu2 + z * sd2;
      return num(`A student scores $${x1}$ on a test with mean $${mu1}$ and standard deviation $${sd1}$. What score on a second test, with mean $${mu2}$ and standard deviation $${sd2}$, would be of equal standing (the same $z$-score)? Both are normally distributed.`, key, {
        traps: [{ value: x1, why: 'Equal standing means the same $z$-score, not the same mark.' }, { value: mu2 + (x1 - mu1), why: 'The second test has a different spread; multiply $z$ by its standard deviation.' }],
        hints: ['Find the $z$-score on the first test.', `$z = \\dfrac{${x1} - ${mu1}}{${sd1}} = ${cl(z)}$.`, `Then $x = ${mu2} + z \\times ${sd2}$.`],
        steps: [{ h: 'First test', d: `$z = \\dfrac{${x1} - ${mu1}}{${sd1}} = ${cl(z)}$` }, { h: 'Second test', d: `$x = ${mu2} + (${cl(z)})(${sd2}) = ${key}$` }]
      });
    }
  },
  // Multiple choice: which percentage lies within the limits.
  {
    diffs: [3],
    make: rng => {
      const mu = ri(rng, 40, 120), sd = ri(rng, 2, 9), k = rc(rng, [1, 2, 3]);
      const T = { 1: '68%', 2: '95%', 3: '99.7%' };
      return choice(rng,
        `A variable is normally distributed with mean $${mu}$ and standard deviation $${sd}$. Approximately what percentage of values lie between $${mu - k * sd}$ and $${mu + k * sd}$?`,
        T[k],
        Object.entries(T).filter(([kk]) => Number(kk) !== k).map(([, t]) => ({ text: t, why: 'Count how many standard deviations each limit is from the mean.' })).concat([{ text: '50%', why: 'The limits are on both sides of the mean, so more than half of the values are inside.' }]),
        ['Convert each limit to a number of standard deviations from the mean.', `Each limit is $${k}\\sigma$ from $${mu}$.`, '$\\pm1\\sigma$, $\\pm2\\sigma$ and $\\pm3\\sigma$ hold about 68%, 95% and 99.7%.'],
        [{ h: 'Distance', d: `$${mu + k * sd} - ${mu} = ${k * sd} = ${k}\\sigma$` }, { h: 'Rule', d: `$\\mu \\pm ${k}\\sigma$ holds about ${T[k]}` }]);
    }
  }
];

// ── Bivariate data: lines of best fit ────────────────────────────────────────
const BX = [
  { x: 'hours of revision per week', y: 'exam mark', one: 'extra hour of revision', yv: 'marks' },
  { x: 'weekly training sessions', y: 'goals scored in a season', one: 'extra training session', yv: 'goals' },
  { x: 'daily maximum temperature (°C)', y: 'bottles of water sold at a kiosk', one: 'extra degree', yv: 'bottles' },
  { x: 'advertising spend (thousands of dollars)', y: 'weekly sales (thousands of dollars)', one: 'extra thousand dollars of advertising', yv: 'thousand dollars' }
];
const BD = [
  { x: 'age of a car (years)', y: 'resale value (thousands of dollars)', a: [40, 60], b: [2, 4], xr: [2, 8] },
  { x: 'weekly hours of screen time', y: 'exam mark', a: [70, 95], b: [1, 3], xr: [3, 15] },
  { x: 'hours since a phone battery was fully charged', y: 'charge remaining (%)', a: [90, 100], b: [3, 8], xr: [1, 10] }
];
const bx = b => (b === 1 ? 'x' : `${b}x`);
const an = w => (/^[aeiou]/i.test(w) ? 'an' : 'a');
const lineTxt = (a, b) => `y = ${a} + ${bx(b)}`;

const bivariate = [
  // What does the gradient mean?
  {
    make: rng => {
      const c = rc(rng, BX), a = ri(rng, 5, 40), b = ri(rng, 2, 9);
      return choice(rng,
        `A line of best fit for ${c.y} ($y$) against ${c.x} ($x$) is $${lineTxt(a, b)}$. Which statement correctly interprets the gradient?`,
        `The ${c.y} is predicted to increase by $${b}$ for each ${c.one}`,
        [{ text: `The ${c.y} is predicted to be $${b}$ when ${c.x} is zero`, why: 'That describes the intercept, not the gradient. The intercept here is the constant term.' },
          { text: `The ${c.y} is predicted to be $${b}$ times the ${c.x}`, why: 'The line also has a constant term, so $y$ is not simply a multiple of $x$.' },
          { text: `The ${c.y} is predicted to increase by $${a}$ for each ${c.one}`, why: 'The gradient is the coefficient of $x$, not the constant term.' }],
        ['The gradient is the coefficient of $x$.', `Here it is $${b}$.`, 'It is the change in $y$ for each 1-unit increase in $x$.'],
        [{ h: 'Gradient', d: `In $${lineTxt(a, b)}$ the gradient is $${b}$` }, { h: 'Interpret', d: `Each ${c.one} raises the prediction by ${b}` }]);
    }
  },
  // Predict at x = 0 (the intercept).
  {
    diffs: [1, 2],
    make: rng => {
      const c = rc(rng, BX), a = ri(rng, 5, 40), b = ri(rng, 2, 9);
      return num(`A line of best fit for ${c.y} ($y$) against ${c.x} ($x$) is $${lineTxt(a, b)}$. What value of $y$ does the line predict when $x = 0$?`, a, {
        traps: [{ value: b, why: 'Substitute $x = 0$: the term in $x$ becomes zero, leaving the constant.' }, { value: a + b, why: 'When $x = 0$ the term $bx$ is $0$, not $b$.' }],
        hints: ['Substitute $x = 0$.', `$${a} + ${b}(0)$.`, 'The term in $x$ disappears.'],
        steps: [{ h: 'Substitute', d: `$y = ${a} + ${b}(0) = ${a}$` }]
      });
    }
  },
  // Gradient or intercept from two points.
  {
    diffs: [2, 3, 4],
    make: rng => {
      const a = ri(rng, 5, 40), b = ri(rng, 2, 9);
      const x1 = ri(rng, 1, 5), x2 = x1 + ri(rng, 2, 6);
      const y1 = a + b * x1, y2 = a + b * x2;
      if (rng() < 0.5) {
        return num(`A line of best fit passes through $(${x1}, ${y1})$ and $(${x2}, ${y2})$. What is its gradient?`, b, {
          traps: [{ value: y2 - y1, why: `Divide the rise by the run: the run is $${x2} - ${x1} = ${x2 - x1}$.` }, { value: (x2 - x1) / (y2 - y1), why: 'Gradient is rise over run, not run over rise.' }],
          hints: ['Gradient = rise ÷ run.', `Rise $= ${y2} - ${y1} = ${y2 - y1}$, run $= ${x2} - ${x1} = ${x2 - x1}$.`, 'Divide.'],
          steps: [{ h: 'Gradient', d: `$m = \\dfrac{${y2} - ${y1}}{${x2} - ${x1}} = ${b}$` }]
        });
      }
      return num(`A line of best fit passes through $(${x1}, ${y1})$ and $(${x2}, ${y2})$. What is its $y$-intercept?`, a, {
        traps: [{ value: y1, why: `$${y1}$ is the value of $y$ at $x = ${x1}$, not at $x = 0$.` }, { value: y1 + b * x1, why: 'Go back from $x = ' + x1 + '$ to $x = 0$ by subtracting, not adding.' }],
        hints: ['Find the gradient first.', `$m = \\dfrac{${y2} - ${y1}}{${x2} - ${x1}} = ${b}$.`, `Intercept $= ${y1} - ${b}\\times ${x1}$.`],
        steps: [{ h: 'Gradient', d: `$m = ${b}$` }, { h: 'Intercept', d: `$c = ${y1} - ${b}(${x1}) = ${a}$` }]
      });
    }
  },
  // Residual = actual − predicted.
  {
    diffs: [2, 3, 4],
    make: rng => {
      const c = rc(rng, BX), a = ri(rng, 10, 40), b = ri(rng, 2, 9), x = ri(rng, 3, 12);
      const delta = pick(rng, -9, 9, 0), pred = a + b * x, actual = pred + delta;
      return num(`A line of best fit for ${c.y} ($y$) against ${c.x} ($x$) is $${lineTxt(a, b)}$. For $x = ${x}$ the actual value of $y$ was $${actual}$. Find the residual (actual value minus predicted value).`, delta, {
        traps: [{ value: -delta, why: 'Residual = actual − predicted, in that order.' }, { value: pred, why: 'This is the predicted value; the residual is the difference between actual and predicted.' }],
        hints: ['Predict $y$ at the given $x$.', `Predicted: $${a} + ${b}(${x}) = ${pred}$.`, `Residual $= ${actual} - ${pred}$.`],
        steps: [{ h: 'Predicted value', d: `$y = ${a} + ${b}(${x}) = ${pred}$` }, { h: 'Residual', d: `$${actual} - ${pred} = ${delta}$` }]
      });
    }
  },
  // Which prediction is reliable (interpolation vs extrapolation).
  {
    diffs: [3, 4],
    make: rng => {
      const c = rc(rng, BX), a = ri(rng, 5, 40), b = ri(rng, 2, 9);
      const lo = ri(rng, 12, 20), hi = lo + ri(rng, 10, 20);
      const inside = ri(rng, lo + 2, hi - 2), o1 = lo - ri(rng, 3, 8), o2 = hi + ri(rng, 5, 12), o3 = hi + ri(rng, 20, 40);
      const t = v => `$x = ${v}$`;
      return choice(rng,
        `A line of best fit $${lineTxt(a, b)}$ was fitted to data for ${c.x} ($x$) collected from $${lo}$ to $${hi}$. Which prediction is likely to be the most reliable?`,
        t(inside),
        [o1, o2, o3].map(v => ({ text: t(v), why: `$x = ${v}$ is outside the data range $${lo}$ to $${hi}$; predicting there is extrapolation, which is less reliable.` })),
        ['Reliable predictions use $x$ values inside the range of the data (interpolation).', `The data cover $${lo}$ to $${hi}$.`, 'Which option lies inside that range?'],
        [{ h: 'Data range', d: `$${lo} \\le x \\le ${hi}$` }, { h: 'Inside the range', d: `${t(inside)} is interpolation; the others are extrapolation` }]);
    }
  },
  // Negative gradient: predict, find x, or change.
  {
    make: rng => {
      const c = rc(rng, BD), a = ri(rng, c.a[0], c.a[1]), b = ri(rng, c.b[0], c.b[1]), x = ri(rng, c.xr[0], c.xr[1]);
      const line = `y = ${a} - ${bx(b)}`, kind = ri(rng, 0, 2), y = a - b * x;
      if (kind === 0) {
        return num(`A line of best fit for ${c.y} ($y$) against ${c.x} ($x$) is $${line}$. Use it to predict $y$ when $x = ${x}$.`, y, {
          traps: [{ value: a + b * x, why: 'The gradient is negative, so subtract $bx$.' }, { value: (a - b) * x, why: 'Multiply $x$ by the gradient only, then subtract from $' + a + '$.' }],
          hints: ['Substitute $x$ into the equation.', `$${b} \\times ${x} = ${b * x}$.`, `Take it away from $${a}$.`],
          steps: [{ h: 'Substitute', d: `$y = ${a} - ${b}(${x}) = ${y}$` }]
        });
      }
      if (kind === 1) {
        return num(`A line of best fit for ${c.y} ($y$) against ${c.x} ($x$) is $${line}$. For what value of $x$ does the line predict $y = ${y}$?`, x, {
          traps: [{ value: (a + y) / b, why: 'Subtract $y$ from $' + a + '$: $' + a + ' - ' + bx(b) + ' = ' + y + '$.' }, { value: y / b, why: 'Deal with the constant $' + a + '$ before dividing.' }],
          hints: ['Set $y$ equal to the value and solve for $x$.', `$${a} - ${bx(b)} = ${y}$.`, `$${bx(b)} = ${a - y}$.`],
          steps: [{ h: 'Solve', d: `$${a} - ${bx(b)} = ${y} \\Rightarrow ${bx(b)} = ${a - y} \\Rightarrow x = ${x}$` }]
        });
      }
      const dx = ri(rng, 2, 4);
      return num(`A line of best fit for ${c.y} ($y$) against ${c.x} ($x$) is $${line}$. By how much does the predicted $y$ change when $x$ increases by $${dx}$? Give a negative number for a decrease.`, -b * dx, {
        traps: [{ value: b * dx, why: 'The gradient is negative, so the predicted value decreases: the change is negative.' }, { value: -b, why: 'Multiply by the number of units $x$ increases by, $' + dx + '$.' }],
        hints: ['Change in $y$ = gradient × change in $x$.', `The gradient is $-${b}$.`, `$-${b} \\times ${dx}$.`],
        steps: [{ h: 'Use the gradient', d: `$\\Delta y = (-${b})(${dx}) = ${-b * dx}$` }]
      });
    }
  },
  // Words to equation.
  {
    diffs: [1, 2],
    make: rng => {
      const c = rc(rng, BX), a = ri(rng, 5, 40), b = ri(rng, 2, 9);
      return choice(rng,
        `A line of best fit predicts ${an(c.y)} ${c.y} of $${a}$ when ${c.x} is zero, and the prediction rises by $${b}$ for each ${c.one}. Which equation is the line of best fit, with ${c.x} as $x$ and ${c.y} as $y$?`,
        `$${lineTxt(a, b)}$`,
        [{ text: `$y = ${b} + ${bx(a)}$`, why: 'The value at $x = 0$ is the constant term and the rise per unit is the coefficient of $x$.' },
          { text: `$y = ${a + b}x$`, why: 'A line through the origin has no constant term; this line starts at ' + a + '.' },
          { text: `$y = ${a}${b}x$`, why: 'Write the equation as constant plus gradient times $x$.' }],
        ['The equation has the form $y = c + mx$.', `$c$ is the value at $x = 0$: $${a}$.`, `$m$ is the rise for each extra unit: $${b}$.`],
        [{ h: 'Intercept and gradient', d: `$c = ${a}$, $m = ${b}$` }, { h: 'Equation', d: `$${lineTxt(a, b)}$` }]);
    }
  }
];

// ── Network flow ─────────────────────────────────────────────────────────────
function maxflow(nodes, arcs, s, t) {
  const idx = Object.fromEntries(nodes.map((n, i) => [n, i]));
  const n = nodes.length;
  const c = Array.from({ length: n }, () => Array(n).fill(0));
  for (const [u, v, w] of arcs) c[idx[u]][idx[v]] += w;
  let f = 0;
  for (;;) {
    const prev = Array(n).fill(-1);
    prev[idx[s]] = idx[s];
    const q = [idx[s]];
    while (q.length) { const u = q.shift(); for (let v = 0; v < n; v++) if (prev[v] < 0 && c[u][v] > 0) { prev[v] = u; q.push(v); } }
    if (prev[idx[t]] < 0) return f;
    let add = Infinity;
    for (let v = idx[t]; v !== idx[s]; v = prev[v]) add = Math.min(add, c[prev[v]][v]);
    for (let v = idx[t]; v !== idx[s]; v = prev[v]) { c[prev[v]][v] -= add; c[v][prev[v]] += add; }
    f += add;
  }
}
const cutCap = (arcs, side) => arcs.reduce((n, [u, v, w]) => n + (side.includes(u) && !side.includes(v) ? w : 0), 0);
const cutArcs = (arcs, side) => arcs.filter(([u, v]) => side.includes(u) && !side.includes(v));
const setTxt = side => `$\\{${side.join(', ')}\\}$`;
const arcList = arcs => arcs.map(([u, v, w]) => `${u}→${v} ${w}`).join(', ');
function netFor(rng, big) {
  const cap = () => ri(rng, 3, 14);
  return big
    ? { nodes: ['S', 'A', 'B', 'C', 'T'], inner: ['A', 'B', 'C'], arcs: [['S', 'A', cap()], ['S', 'B', cap()], ['A', 'C', cap()], ['B', 'C', cap()], ['A', 'T', cap()], ['C', 'T', cap()], ['B', 'T', cap()]] }
    : { nodes: ['S', 'A', 'B', 'T'], inner: ['A', 'B'], arcs: [['S', 'A', cap()], ['S', 'B', cap()], ['A', 'T', cap()], ['B', 'T', cap()], ['A', 'B', cap()]] };
}
const PIPES = [
  { S: 'the dam', A: 'pumping station A', B: 'pumping station B', C: 'pumping station C', T: 'the treatment plant', unit: 'megalitres per hour' },
  { S: 'the depot', A: 'distribution centre A', B: 'distribution centre B', C: 'distribution centre C', T: 'the shopping centre', unit: 'pallets per day' },
  { S: 'the stadium', A: 'gate A', B: 'gate B', C: 'gate C', T: 'the train station', unit: 'hundreds of people per hour' }
];

const networkFlow = [
  // The capacity of a stated cut.
  {
    make: (rng, diff) => {
      const net = netFor(rng, diff >= 3);
      const side = ['S', ...net.inner.filter(() => rng() < 0.5)];
      const key = cutCap(net.arcs, side), used = cutArcs(net.arcs, side);
      return num(`A network has source $S$, sink $T$ and directed arcs with capacities ${arcList(net.arcs)}. Find the capacity of the cut with ${setTxt(side)} on the source side and all other vertices on the sink side.`, key, {
        traps: [{ value: net.arcs.reduce((n, [u, v, w]) => n + (side.includes(u) ? w : 0), 0), why: 'Only arcs going from the source side to the sink side count; arcs inside the source side are not part of the cut.' }].filter(t => t.value !== key),
        hints: ['A cut adds the capacities of arcs that go from the source side to the sink side.', `Source side: ${setTxt(side)}.`, 'List those arcs and add their capacities.'],
        steps: [{ h: 'Arcs crossing the cut', d: used.map(([u, v, w]) => `${u}→${v} (${w})`).join(', ') }, { h: 'Capacity', d: `$${used.map(a => a[2]).join(' + ')} = ${key}$` }]
      });
    }
  },
  // Conservation of flow at a vertex.
  {
    diffs: [1, 2, 3, 4],
    make: rng => {
      const node = rc(rng, ['A', 'B']), inn = ri(rng, 9, 24), out1 = ri(rng, 3, inn - 3), out2 = inn - out1;
      const ctx = rc(rng, PIPES);
      const asksIn = rng() < 0.4;
      const outDest = node === 'A' ? ['T', 'B'] : ['T', 'A'];
      const lbl = v => ctx[v];
      return asksIn
        ? num(`In a flow network, ${out1} units leave ${lbl(node)} towards ${lbl(outDest[0])} and ${out2} units leave it towards ${lbl(outDest[1])}. No flow is stored at ${lbl(node)}. How many units arrive at ${lbl(node)} from ${lbl('S')}?`, inn, {
          traps: [{ value: Math.abs(out1 - out2), why: 'Flow in equals the total flow out: add the two outflows.' }],
          hints: ['Flow in = flow out at any vertex other than the source and sink.', 'Add the flows that leave.', `$${out1} + ${out2}$.`],
          steps: [{ h: 'Conservation', d: `Flow in $=$ flow out $= ${out1} + ${out2} = ${inn}$` }]
        })
        : num(`In a flow network, ${inn} units arrive at ${lbl(node)} from ${lbl('S')}. ${out1} units leave towards ${lbl(outDest[0])}. No flow is stored at ${lbl(node)}. How many units leave towards ${lbl(outDest[1])}?`, out2, {
          traps: [{ value: inn + out1, why: 'Flow out must equal flow in, so subtract the flow already accounted for.' }],
          hints: ['Flow in = flow out at a vertex that is neither the source nor the sink.', `Total out must be $${inn}$.`, `$${inn} - ${out1}$.`],
          steps: [{ h: 'Conservation', d: `Flow in $= ${inn}$ = flow out` }, { h: 'Missing outflow', d: `$${inn} - ${out1} = ${out2}$` }]
        });
    }
  },
  // Multiple choice: which cut is the minimum cut?
  {
    make: rng => {
      let net, sets, caps, best;
      for (let tries = 0; tries < 500; tries++) {
        net = netFor(rng, false);
        sets = [['S'], ['S', 'A'], ['S', 'B'], ['S', 'A', 'B']];
        caps = sets.map(s => cutCap(net.arcs, s));
        const m = Math.min(...caps);
        if (caps.filter(c => c === m).length === 1) { best = caps.indexOf(m); break; }
      }
      if (best === undefined) throw new Error('network-flow: no unique minimum cut');
      return choice(rng,
        `A network has source $S$, sink $T$ and directed arcs with capacities ${arcList(net.arcs)}. A cut puts the listed vertices on the source side and the rest on the sink side. Which cut has the smallest capacity?`,
        `Source side ${setTxt(sets[best])}`,
        sets.filter((_, i) => i !== best).map(s => ({ text: `Source side ${setTxt(s)}`, why: `This cut has capacity $${cutCap(net.arcs, s)}$, which is larger than the smallest cut.` })),
        ['Work out the capacity of each cut.', 'Only arcs from the source side to the sink side count.', 'Choose the smallest total.'],
        [{ h: 'Capacities', d: sets.map((s, i) => `${setTxt(s)}: $${caps[i]}$`).join('; ') }, { h: 'Smallest', d: `${setTxt(sets[best])} with capacity $${caps[best]}$` }]);
    }
  },
  // Maximum flow in a context.
  {
    diffs: [3, 4],
    make: (rng, diff) => {
      const net = netFor(rng, diff >= 4), ctx = rc(rng, PIPES);
      const key = maxflow(net.nodes, net.arcs, 'S', 'T');
      const txt = net.arcs.map(([u, v, w]) => `${u}→${v} ${w}`).join(', ');
      const via = net.inner.map(v => ctx[v]).join(', ');
      return num(`Goods move from ${ctx.S} (S) to ${ctx.T} (T) through ${via}. The capacities, in ${ctx.unit}, are ${txt}. What is the greatest possible total flow from S to T, in ${ctx.unit}?`, key, {
        traps: [{ value: net.arcs.filter(a => a[0] === 'S').reduce((n, a) => n + a[2], 0), why: 'The flow is also limited by the arcs further along; the maximum flow equals the smallest cut.' }],
        hints: ['Maximum flow equals the capacity of the minimum cut.', 'Try cuts that separate S from T and take the smallest.', 'Check that a flow of that size can really be sent.'],
        steps: [{ h: 'Maximum flow', d: `By the max-flow min-cut theorem, the greatest flow equals the smallest cut capacity, $${key}$ ${ctx.unit}` }]
      });
    }
  },
  // Two separate routes: bottlenecks.
  {
    diffs: [1, 2],
    make: rng => {
      const c1 = ri(rng, 4, 14), c2 = pick(rng, 4, 14, c1), c3 = ri(rng, 4, 14), c4 = pick(rng, 4, 14, c3);
      const key = Math.min(c1, c2) + Math.min(c3, c4);
      return num(`The only routes from $S$ to $T$ in a network are $S\\to A\\to T$ and $S\\to B\\to T$. The capacities are $S\\to A$ ${c1}, $A\\to T$ ${c2}, $S\\to B$ ${c3} and $B\\to T$ ${c4}. What is the maximum flow from $S$ to $T$?`, key, {
        traps: [{ value: c1 + c3, why: 'Each route is limited by its smaller arc (its bottleneck).' }, { value: c2 + c4, why: 'Each route is limited by its smaller arc (its bottleneck).' }],
        hints: ['Each route can carry only as much as its smallest arc.', `Route 1: $\\min(${c1}, ${c2}) = ${Math.min(c1, c2)}$.`, 'Add the two routes.'],
        steps: [{ h: 'Route 1', d: `$\\min(${c1}, ${c2}) = ${Math.min(c1, c2)}$` }, { h: 'Route 2', d: `$\\min(${c3}, ${c4}) = ${Math.min(c3, c4)}$` }, { h: 'Total', d: `$${Math.min(c1, c2)} + ${Math.min(c3, c4)} = ${key}$` }]
      });
    }
  },
  // Missing capacity from the maximum flow.
  {
    diffs: [2, 3, 4],
    make: rng => {
      const c1 = ri(rng, 6, 14), x = ri(rng, 2, c1 - 1), c3 = ri(rng, 3, 14), c4 = ri(rng, 3, 14);
      const F = x + Math.min(c3, c4);
      return num(`The only routes from $S$ to $T$ are $S\\to A\\to T$ and $S\\to B\\to T$. The capacities are $S\\to A$ ${c1}, $S\\to B$ ${c3} and $B\\to T$ ${c4}. The capacity of $A\\to T$ is unknown, but the maximum flow from $S$ to $T$ is ${F}. What is the capacity of $A\\to T$? (It is less than ${c1}.)`, x, {
        traps: [{ value: F - c3, why: 'Route $S\\to B\\to T$ carries only its smaller arc, $\\min(' + c3 + ', ' + c4 + ')$.' }, { value: F, why: 'The maximum flow is the total of both routes; take away the flow carried by the other route.' }],
        hints: ['Find the flow carried by the route that is fully known.', `$\\min(${c3}, ${c4}) = ${Math.min(c3, c4)}$.`, 'The rest of the maximum flow goes along $S\\to A\\to T$.'],
        steps: [{ h: 'Known route', d: `$\\min(${c3}, ${c4}) = ${Math.min(c3, c4)}$` }, { h: 'Other route', d: `$${F} - ${Math.min(c3, c4)} = ${x}$, which is below ${c1}, so it is the capacity of $A\\to T$` }]
      });
    }
  },
  // Effect of upgrading one arc.
  {
    diffs: [3, 4],
    make: (rng, diff) => {
      let net, i, k, base, now;
      for (let t = 0; t < 400; t++) {
        net = netFor(rng, diff >= 4);
        i = ri(rng, 0, net.arcs.length - 1); k = ri(rng, 2, 5);
        base = maxflow(net.nodes, net.arcs, 'S', 'T');
        now = maxflow(net.nodes, net.arcs.map((a, j) => (j === i ? [a[0], a[1], a[2] + k] : a)), 'S', 'T');
        if (now > base) break;
      }
      if (!(now > base)) throw new Error('network-flow: upgrade never changes the flow');
      const [u, v] = net.arcs[i];
      return num(`A network has source $S$, sink $T$ and directed arcs with capacities ${arcList(net.arcs)}. The capacity of the arc $${u}\\to ${v}$ is increased by ${k}. What is the new maximum flow from $S$ to $T$?`, now, {
        traps: [{ value: base, why: 'The upgraded arc is part of a minimum cut, so the maximum flow changes.' }, { value: base + k, why: 'The maximum flow rises by less than the upgrade, because another cut becomes the smallest.' }],
        hints: ['Change the capacity, then find the smallest cut again.', 'Compare with the old minimum cut.', 'The new maximum flow is the smallest cut after the change.'],
        steps: [{ h: 'Before', d: `Maximum flow $${base}$` }, { h: 'After the upgrade', d: `Recalculate the minimum cut: $${now}$` }]
      });
    }
  }
];

// ── Non-right-angled trigonometry ────────────────────────────────────────────
const dg = r => r * 180 / Math.PI;
const bearing = b => `${String(b).padStart(3, '0')}°`;

const nonright = [
  // Sine rule for an angle (angle stated acute, so unambiguous).
  {
    diffs: [1, 2],
    make: rng => {
      const A = ri(rng, 30, 80), B = ri(rng, 25, 70), a = ri(rng, 8, 30);
      const b = r1(a * Math.sin(rad(B)) / Math.sin(rad(A)));
      const key = Math.round(dg(Math.asin(b * Math.sin(rad(A)) / a)));
      return num(`In triangle $ABC$, $a = ${a}$, $b = ${b}$ and $\\angle A = ${A}°$. The angle $\\angle B$ is acute. Find $\\angle B$ to the nearest degree.`, key, {
        tol: 0.51, suffix: '°', prefix: 'B =',
        traps: [{ value: Math.round(dg(Math.asin(a * Math.sin(rad(A)) / b))), why: 'Pair each side with its opposite angle: $\\dfrac{\\sin B}{b} = \\dfrac{\\sin A}{a}$.', tol: 0.51 }],
        hints: ['$\\dfrac{\\sin B}{b} = \\dfrac{\\sin A}{a}$.', `$\\sin B = \\dfrac{${b}\\sin ${A}°}{${a}}$.`, 'Use $\\sin^{-1}$ (acute angle).'],
        steps: [{ h: 'Sine rule', d: `$\\sin B = \\dfrac{${b}\\sin(${A}°)}{${a}} = ${r3(b * Math.sin(rad(A)) / a)}$` }, { h: 'Inverse sine', d: `$B \\approx ${key}°$` }]
      });
    }
  },
  // Two angles and a side from two shore stations.
  {
    diffs: [1, 2, 3, 4],
    make: rng => {
      const P = ri(rng, 40, 80), Q = ri(rng, 40, Math.min(80, 150 - P)), pq = ri(rng, 12, 60) * 10;
      const B = 180 - P - Q;
      const key = r1(pq * Math.sin(rad(Q)) / Math.sin(rad(B)));
      return num(`Two surveyors stand at points $P$ and $Q$ on the shore of Sydney Harbour, $${pq}$ m apart. They both sight a buoy $B$. The angles are $\\angle BPQ = ${P}°$ and $\\angle BQP = ${Q}°$. How far is the buoy from $P$, correct to 1 decimal place?`, key, {
        tol: 0.07, suffix: 'm',
        traps: [{ value: r1(pq * Math.sin(rad(P)) / Math.sin(rad(B))), why: 'The distance $PB$ is opposite $\\angle Q$, not $\\angle P$.', tol: 0.07 }, { value: r1(pq * Math.sin(rad(Q))), why: 'This is not a right-angled triangle; use the sine rule with the angle at the buoy.', tol: 0.07 }],
        hints: [`Find the angle at the buoy: $180° - ${P}° - ${Q}°$.`, `$\\angle B = ${B}°$.`, '$\\dfrac{PB}{\\sin Q} = \\dfrac{PQ}{\\sin B}$.'],
        steps: [{ h: 'Angle at the buoy', d: `$\\angle B = 180° - ${P}° - ${Q}° = ${B}°$` }, { h: 'Sine rule', d: `$PB = \\dfrac{${pq}\\sin(${Q}°)}{\\sin(${B}°)} \\approx ${key}$ m` }]
      });
    }
  },
  // Cosine rule with bearings.
  {
    diffs: [2, 3, 4],
    make: rng => {
      const p = ri(rng, 4, 15), q = ri(rng, 4, 15), b1 = ri(rng, 0, 71) * 5, ang = ri(rng, 6, 30) * 5;
      const b2 = (b1 + ang) % 360;
      let d = ((b2 - b1) + 360) % 360; if (d > 180) d = 360 - d;
      const key = r1(Math.sqrt(p * p + q * q - 2 * p * q * Math.cos(rad(d))));
      return num(`Two hikers leave the same lookout near Katoomba. One walks $${p}$ km on a bearing of $${bearing(b1)}$ and the other walks $${q}$ km on a bearing of $${bearing(b2)}$. How far apart are they, correct to 1 decimal place?`, key, {
        tol: 0.07, suffix: 'km',
        traps: [{ value: r1(Math.sqrt(p * p + q * q)), why: 'The paths do not meet at a right angle; use the cosine rule.', tol: 0.07 }, { value: r1(p + q), why: 'The hikers are not walking in a straight line; use the cosine rule with the angle between the bearings.', tol: 0.07 }],
        hints: ['Find the angle between the two bearings.', `Angle $= ${d}°$.`, '$c^2 = a^2 + b^2 - 2ab\\cos C$.'],
        steps: [{ h: 'Angle between paths', d: `$|${bearing(b2)} - ${bearing(b1)}|$ gives $${d}°$` }, { h: 'Cosine rule', d: `$d^2 = ${p}^2 + ${q}^2 - 2(${p})(${q})\\cos(${d}°)$, so $d \\approx ${key}$ km` }]
      });
    }
  },
  // Area given, find the included acute angle.
  {
    diffs: [3, 4],
    make: rng => {
      const a = ri(rng, 8, 20), b = ri(rng, 8, 20), C = ri(rng, 20, 80);
      const S = r1(0.5 * a * b * Math.sin(rad(C)));
      const key = Math.round(dg(Math.asin(2 * S / (a * b))));
      return num(`A triangular paddock has two sides of $${a}$ m and $${b}$ m and an area of $${S}$ m². The angle between those two sides is acute. Find that angle to the nearest degree.`, key, {
        tol: 0.51, suffix: '°',
        traps: [{ value: Math.round(dg(Math.asin(S / (a * b)))), why: 'Use $A = \\tfrac{1}{2}ab\\sin C$, so $\\sin C = \\dfrac{2A}{ab}$; do not forget the 2.', tol: 0.51 }],
        hints: ['$A = \\tfrac{1}{2}ab\\sin C$.', `$\\sin C = \\dfrac{2 \\times ${S}}{${a} \\times ${b}}$.`, 'Take $\\sin^{-1}$ (acute).'],
        steps: [{ h: 'Rearrange', d: `$\\sin C = \\dfrac{2(${S})}{(${a})(${b})} = ${r3(2 * S / (a * b))}$` }, { h: 'Inverse sine', d: `$C \\approx ${key}°$` }]
      });
    }
  },
  // Which rule first?
  {
    make: rng => {
      const kind = ri(rng, 0, 3);
      const ds = txt => ['Use the sine rule', 'Use the cosine rule', 'Use Pythagoras’ theorem', 'Use $\\sin\\theta = \\dfrac{\\text{opposite}}{\\text{hypotenuse}}$ in a right-angled triangle'].filter(t => t !== txt);
      const bad = (txt, why) => ds(txt).map(t => ({ text: t, why }));
      if (kind === 0) {
        const b = ri(rng, 6, 15), c = ri(rng, 6, 15), A = ri(rng, 30, 130);
        return choice(rng, `In triangle $ABC$ you know $b = ${b}$, $c = ${c}$ and the angle between them, $\\angle A = ${A}°$. You want side $a$. What is the best first step?`, 'Use the cosine rule',
          bad('Use the cosine rule', 'The known angle is between the two known sides (SAS) and the triangle is not right-angled, so the cosine rule is needed; the sine rule needs a side and its opposite angle.'),
          ['Name what you know: two sides and the angle between them.', 'Is there a known side opposite a known angle?', 'Two sides and the included angle call for one rule.'],
          [{ h: 'Pattern', d: 'Two sides and the included angle (SAS)' }, { h: 'Rule', d: 'Cosine rule: $a^2 = b^2 + c^2 - 2bc\\cos A$' }]);
      }
      if (kind === 1) {
        const A = ri(rng, 30, 80), B = ri(rng, 30, 80), a = ri(rng, 6, 25);
        return choice(rng, `In triangle $ABC$ you know $\\angle A = ${A}°$, $\\angle B = ${B}°$ and side $a = ${a}$. You want side $b$. What is the best first step?`, 'Use the sine rule',
          bad('Use the sine rule', 'You know a side and its opposite angle, with a second angle, so the sine rule applies; the cosine rule needs two sides and the angle between them or all three sides.'),
          ['Side $a$ is opposite $\\angle A$, and $b$ is opposite $\\angle B$.', 'You have a matching side–angle pair.', 'Which rule uses matching pairs?'],
          [{ h: 'Pattern', d: 'Matching side and angle pair $(a, A)$ and the angle $B$ opposite the wanted side' }, { h: 'Rule', d: 'Sine rule: $\\dfrac{a}{\\sin A} = \\dfrac{b}{\\sin B}$' }]);
      }
      if (kind === 2) {
        const a = ri(rng, 8, 14), b = ri(rng, 8, 14), c = ri(rng, Math.abs(a - b) + 2, a + b - 2);
        return choice(rng, `A triangle has sides $${a}$, $${b}$ and $${c}$ and no known angles. You want the largest angle. What is the best first step?`, 'Use the cosine rule',
          bad('Use the cosine rule', 'With three sides and no angle, there is no side–angle pair for the sine rule; the cosine rule links the sides to an angle.'),
          ['You know all three sides and no angle.', 'The sine rule needs a known angle.', 'Rearrange the cosine rule for an angle.'],
          [{ h: 'Pattern', d: 'Three sides (SSS)' }, { h: 'Rule', d: 'Cosine rule: $\\cos C = \\dfrac{a^2 + b^2 - c^2}{2ab}$' }]);
      }
      const a = ri(rng, 12, 30), b = ri(rng, 8, a - 2), A = ri(rng, 35, 80);
      return choice(rng, `In triangle $ABC$, $a = ${a}$, $b = ${b}$ and $\\angle A = ${A}°$. You want $\\angle B$. What is the best first step?`, 'Use the sine rule',
        bad('Use the sine rule', 'Side $a$ and $\\angle A$ are a matching pair and $b$ is known, so the sine rule gives $\\sin B$ directly.'),
        ['Side $a$ is opposite $\\angle A$.', 'You know the side $b$ opposite the wanted angle.', 'Use the pair of known values with the sine rule.'],
        [{ h: 'Pattern', d: 'Two sides and an angle opposite one of them' }, { h: 'Rule', d: 'Sine rule: $\\dfrac{\\sin B}{b} = \\dfrac{\\sin A}{a}$' }]);
    }
  },
  // Area of a triangle from three sides.
  {
    diffs: [3, 4],
    make: rng => {
      let a, b, c;
      do { a = ri(rng, 6, 16); b = ri(rng, 6, 16); c = ri(rng, 6, 16); } while (a + b <= c + 2 || a + c <= b + 2 || b + c <= a + 2);
      const s = (a + b + c) / 2, area = Math.sqrt(s * (s - a) * (s - b) * (s - c));
      const key = r1(area);
      const C = Math.acos((a * a + b * b - c * c) / (2 * a * b));
      return num(`A triangular sail has sides $${a}$ m, $${b}$ m and $${c}$ m. Find its area, correct to 1 decimal place. (Do not round until the final step.)`, key, {
        tol: 0.11, suffix: 'm²',
        traps: [{ value: r1(0.5 * a * b), why: 'The sail is not right-angled; find an angle with the cosine rule, then use $\\tfrac{1}{2}ab\\sin C$.', tol: 0.11 }],
        hints: ['Find one angle with the cosine rule.', `$\\cos C = \\dfrac{${a}^2 + ${b}^2 - ${c}^2}{2(${a})(${b})}$, so $C \\approx ${r1(dg(C))}°$.`, 'Then $A = \\tfrac{1}{2}ab\\sin C$.'],
        steps: [{ h: 'An angle', d: `$C = \\cos^{-1}\\left(\\dfrac{${a * a} + ${b * b} - ${c * c}}{${2 * a * b}}\\right) \\approx ${r1(dg(C))}°$` }, { h: 'Area', d: `$A = \\tfrac{1}{2}(${a})(${b})\\sin C \\approx ${key}$ m²` }]
      });
    }
  },
  // Two angles → third angle → side.
  {
    diffs: [1, 2],
    make: rng => {
      const A = ri(rng, 35, 80), B = ri(rng, 35, Math.min(80, 150 - A)), a = ri(rng, 8, 30);
      const C = 180 - A - B, key = r1(a * Math.sin(rad(C)) / Math.sin(rad(A)));
      return num(`In triangle $ABC$, $\\angle A = ${A}°$, $\\angle B = ${B}°$ and $a = ${a}$ m. Find side $c$, correct to 1 decimal place.`, key, {
        tol: 0.07, suffix: 'm',
        traps: [{ value: r1(a * Math.sin(rad(B)) / Math.sin(rad(A))), why: 'Side $c$ is opposite $\\angle C$; first find $\\angle C = 180° - A - B$.', tol: 0.07 }],
        hints: ['Find $\\angle C$ from the angle sum.', `$\\angle C = 180° - ${A}° - ${B}° = ${C}°$.`, '$\\dfrac{c}{\\sin C} = \\dfrac{a}{\\sin A}$.'],
        steps: [{ h: 'Third angle', d: `$C = 180° - ${A}° - ${B}° = ${C}°$` }, { h: 'Sine rule', d: `$c = \\dfrac{${a}\\sin(${C}°)}{\\sin(${A}°)} \\approx ${key}$ m` }]
      });
    }
  }
];

// ── Measurement ──────────────────────────────────────────────────────────────
const measure = [
  // km ↔ m
  {
    diffs: [1, 2],
    make: rng => {
      if (rng() < 0.5) {
        const h = ri(rng, 105, 999);
        return num(`A coastal walk near Wollongong is $${h / 100}$ km long. How long is it in metres?`, h * 10, {
          suffix: 'm', traps: [{ value: h / 10, why: '1 km = 1000 m, so multiply by 1000.' }, { value: h, why: '1 km = 1000 m, so multiply by 1000, not 100.' }],
          hints: ['1 km = 1000 m.', `Multiply $${h / 100}$ by $1000$.`, 'Move the decimal point three places right.'],
          steps: [{ h: 'Convert', d: `$${h / 100} \\times 1000 = ${h * 10}$ m` }]
        });
      }
      const m = ri(rng, 120, 9990);
      return num(`A ferry route across the harbour is $${m}$ m long. How long is it in kilometres?`, m / 1000, {
        suffix: 'km', traps: [{ value: m / 100, why: '1 km = 1000 m, so divide by 1000.' }, { value: m * 1000, why: 'Going from metres to kilometres makes the number smaller: divide.' }],
        hints: ['1 km = 1000 m.', `Divide $${m}$ by $1000$.`, 'Move the decimal point three places left.'],
        steps: [{ h: 'Convert', d: `$${m} \\div 1000 = ${m / 1000}$ km` }]
      });
    }
  },
  // mm ↔ cm
  {
    diffs: [1],
    make: rng => {
      if (rng() < 0.5) {
        const mm = ri(rng, 25, 950);
        return num(`A bolt is $${mm}$ mm long. Write its length in centimetres.`, mm / 10, {
          suffix: 'cm', traps: [{ value: mm * 10, why: '10 mm = 1 cm, so divide by 10.' }, { value: mm / 100, why: '10 mm = 1 cm, so divide by 10, not 100.' }],
          hints: ['10 mm = 1 cm.', `Divide $${mm}$ by $10$.`, 'Move the decimal point one place left.'],
          steps: [{ h: 'Convert', d: `$${mm} \\div 10 = ${mm / 10}$ cm` }]
        });
      }
      const t = ri(rng, 31, 990);
      return num(`A phone screen is $${t / 10}$ cm wide. Write its width in millimetres.`, t, {
        suffix: 'mm', traps: [{ value: t / 100, why: '1 cm = 10 mm, so multiply by 10.' }, { value: t * 10, why: '1 cm = 10 mm, so multiply by 10, not 100.' }],
        hints: ['1 cm = 10 mm.', `Multiply $${t / 10}$ by $10$.`, 'Move the decimal point one place right.'],
        steps: [{ h: 'Convert', d: `$${t / 10} \\times 10 = ${t}$ mm` }]
      });
    }
  },
  // Mass
  {
    diffs: [1, 2],
    make: rng => {
      const d = ri(rng, 0, 2);
      if (d === 0) {
        const g = ri(rng, 150, 9990);
        return num(`A parcel has a mass of $${g}$ g. What is its mass in kilograms?`, g / 1000, {
          suffix: 'kg', traps: [{ value: g / 100, why: '1 kg = 1000 g, so divide by 1000.' }, { value: g * 1000, why: 'Grams to kilograms makes the number smaller: divide.' }],
          hints: ['1 kg = 1000 g.', `Divide $${g}$ by $1000$.`, 'Move the decimal point three places left.'],
          steps: [{ h: 'Convert', d: `$${g} \\div 1000 = ${g / 1000}$ kg` }]
        });
      }
      if (d === 1) {
        const t = ri(rng, 105, 990);
        return num(`A truck carries $${t / 100}$ tonnes of gravel. How many kilograms is that?`, t * 10, {
          suffix: 'kg', traps: [{ value: t / 10, why: '1 tonne = 1000 kg, so multiply by 1000.' }, { value: t, why: '1 tonne = 1000 kg, so multiply by 1000, not 100.' }],
          hints: ['1 tonne = 1000 kg.', `Multiply $${t / 100}$ by $1000$.`, 'Move the decimal point three places right.'],
          steps: [{ h: 'Convert', d: `$${t / 100} \\times 1000 = ${t * 10}$ kg` }]
        });
      }
      const kg = ri(rng, 2, 9), g = ri(rng, 1, 99) * 10;
      return num(`A bag of flour has a mass of $${kg}$ kg $${g}$ g. What is its mass in grams?`, kg * 1000 + g, {
        suffix: 'g', traps: [{ value: kg * 100 + g, why: '1 kg = 1000 g.' }, { value: kg + g, why: 'Convert the kilograms to grams before adding.' }],
        hints: ['Convert the kilograms to grams.', `$${kg}$ kg $= ${kg * 1000}$ g.`, `Add the $${g}$ g.`],
        steps: [{ h: 'Convert and add', d: `$${kg} \\times 1000 + ${g} = ${kg * 1000 + g}$ g` }]
      });
    }
  },
  // Capacity
  {
    diffs: [1, 2],
    make: rng => {
      const d = ri(rng, 0, 2);
      if (d === 0) {
        const L = ri(rng, 12, 480) / 10;
        return num(`A drink bottle holds $${L}$ L. How many millilitres is that?`, Math.round(L * 1000), {
          suffix: 'mL', traps: [{ value: Math.round(L * 100), why: '1 L = 1000 mL.' }, { value: L / 1000, why: 'Litres to millilitres makes the number larger: multiply.' }],
          hints: ['1 L = 1000 mL.', `Multiply $${L}$ by $1000$.`, 'Move the decimal point three places right.'],
          steps: [{ h: 'Convert', d: `$${L} \\times 1000 = ${Math.round(L * 1000)}$ mL` }]
        });
      }
      if (d === 1) {
        const mL = ri(rng, 150, 9990);
        return num(`A pool chemical bottle holds $${mL}$ mL. How many litres is that?`, mL / 1000, {
          suffix: 'L', traps: [{ value: mL / 100, why: '1 L = 1000 mL, so divide by 1000.' }, { value: mL * 1000, why: 'Millilitres to litres makes the number smaller: divide.' }],
          hints: ['1 L = 1000 mL.', `Divide $${mL}$ by $1000$.`, 'Move the decimal point three places left.'],
          steps: [{ h: 'Convert', d: `$${mL} \\div 1000 = ${mL / 1000}$ L` }]
        });
      }
      const kl = ri(rng, 12, 95) / 10;
      return num(`A rainwater tank holds $${kl}$ kL. How many litres is that?`, Math.round(kl * 1000), {
        suffix: 'L', traps: [{ value: Math.round(kl * 100), why: '1 kL = 1000 L.' }, { value: kl / 1000, why: 'Kilolitres to litres makes the number larger: multiply.' }],
        hints: ['1 kL = 1000 L.', `Multiply $${kl}$ by $1000$.`, 'Move the decimal point three places right.'],
        steps: [{ h: 'Convert', d: `$${kl} \\times 1000 = ${Math.round(kl * 1000)}$ L` }]
      });
    }
  },
  // Which is the longest / shortest?
  {
    diffs: [1],
    make: rng => {
      const ks = new Set();
      while (ks.size < 4) ks.add(ri(rng, 30, 99));
      const vals = [...ks];
      const forms = [m => `${m / 10}\\text{ m}`, m => `${m * 10}\\text{ cm}`, m => `${m * 100}\\text{ mm}`];
      const order = [0, 1, 2, rc(rng, [0, 1, 2])];
      const items = vals.map((v, i) => ({ v, text: forms[order[i]](v) }));
      const longest = rng() < 0.5;
      const target = items.reduce((b, it) => (longest ? it.v > b.v : it.v < b.v) ? it : b, items[0]);
      return choice(rng, `Which of these lengths is the ${longest ? 'longest' : 'shortest'}?`,
        `$${target.text}$`,
        items.filter(i => i !== target).map(i => ({ text: `$${i.text}$`, why: 'Convert every length to the same unit before comparing; a bigger number does not always mean a longer length.' })),
        ['Convert all four lengths to metres.', '1 m = 100 cm = 1000 mm.', `Pick the ${longest ? 'largest' : 'smallest'}.`],
        [{ h: 'In metres', d: items.map(i => `$${i.text} = ${i.v / 10}$ m`).join('; ') }, { h: 'Choose', d: `${longest ? 'Longest' : 'Shortest'}: $${target.text}$` }]);
    }
  },
  // Composite area: rectangle with a triangular bed.
  {
    diffs: [2, 3],
    make: rng => {
      const l = ri(rng, 8, 20), w = ri(rng, 5, 12), h = ri(rng, 3, 8), key = l * w + w * h / 2;
      return num(`A courtyard is a rectangle $${l}$ m long and $${w}$ m wide. A triangular garden bed is attached to one of the $${w}$ m sides. The triangle has base $${w}$ m and perpendicular height $${h}$ m. Find the total area of the courtyard and bed.`, key, {
        suffix: 'm²', traps: [{ value: l * w + w * h, why: 'The area of a triangle is half base times height.' }, { value: l * w, why: 'Include the triangular bed as well.' }],
        hints: ['Split the shape into a rectangle and a triangle.', `Rectangle: $${l} \\times ${w} = ${l * w}$.`, `Triangle: $\\frac{1}{2} \\times ${w} \\times ${h}$.`],
        steps: [{ h: 'Rectangle', d: `$${l} \\times ${w} = ${l * w}$ m²` }, { h: 'Triangle', d: `$\\tfrac{1}{2}(${w})(${h}) = ${w * h / 2}$ m²` }, { h: 'Total', d: `$${l * w} + ${w * h / 2} = ${key}$ m²` }]
      });
    }
  },
  // Circle: area or circumference from a radius or diameter.
  {
    diffs: [2, 3],
    make: rng => {
      const r = ri(rng, 10, 250) / 10, useD = rng() < 0.5, area = rng() < 0.6;
      const given = useD ? `diameter $${r2(2 * r)}$ m` : `radius $${r}$ m`;
      const key = area ? r1(Math.PI * r * r) : r1(2 * Math.PI * r);
      return num(`A circular trampoline has a ${given}. Find its ${area ? 'area' : 'circumference'}, correct to 1 decimal place.`, key, {
        tol: 0.06, suffix: area ? 'm²' : 'm',
        traps: area
          ? [{ value: r1(Math.PI * (2 * r) * (2 * r)), why: 'Use the radius, which is half the diameter, in $A = \\pi r^2$.', tol: 0.06 }, { value: r1(2 * Math.PI * r), why: 'That is the circumference; area is $\\pi r^2$.', tol: 0.06 }]
          : [{ value: r1(Math.PI * r * r), why: 'That is the area; circumference is $2\\pi r$ or $\\pi d$.', tol: 0.06 }, { value: r1(Math.PI * r), why: 'Circumference is $\\pi d = 2\\pi r$.', tol: 0.06 }],
        hints: [useD ? 'Radius is half the diameter.' : 'The radius is given.', area ? '$A = \\pi r^2$.' : '$C = 2\\pi r$.', 'Use the $\\pi$ button and round at the end.'],
        steps: [{ h: 'Radius', d: `$r = ${r}$ m` }, { h: area ? 'Area' : 'Circumference', d: area ? `$A = \\pi(${r})^2 \\approx ${key}$ m²` : `$C = 2\\pi(${r}) \\approx ${key}$ m` }]
      });
    }
  },
  // Volume of a rectangular tank in litres.
  {
    diffs: [2, 3],
    make: rng => {
      const l = ri(rng, 40, 120), w = ri(rng, 25, 50), h = ri(rng, 25, 60), cm3 = l * w * h, key = r1(cm3 / 1000);
      return num(`A fish tank is $${l}$ cm long, $${w}$ cm wide and $${h}$ cm high. How many litres of water does it hold when full? (1 L = 1000 cm³.) Give your answer to 1 decimal place.`, key, {
        tol: 0.06, suffix: 'L', traps: [{ value: cm3, why: 'That is the volume in cm³; divide by 1000 to get litres.' }, { value: r1(cm3 / 100), why: '1 L = 1000 cm³, so divide by 1000.', tol: 0.06 }],
        hints: ['Volume = length × width × height.', `$${l} \\times ${w} \\times ${h} = ${cm3}$ cm³.`, 'Divide by 1000.'],
        steps: [{ h: 'Volume', d: `$${l} \\times ${w} \\times ${h} = ${cm3}$ cm³` }, { h: 'Litres', d: `$${cm3} \\div 1000 \\approx ${key}$ L` }]
      });
    }
  },
  // Paving cost from an area.
  {
    diffs: [2],
    make: rng => {
      const l = ri(rng, 6, 30), w10 = ri(rng, 8, 16), rate = ri(rng, 60, 140), key = r2(l * w10 * rate / 10);
      return num(`A path $${l}$ m long and $${w10 / 10}$ m wide is paved at $${rate}$ dollars per square metre. What is the total cost?`, key, {
        prefix: '$', traps: [{ value: l * rate, why: 'Find the area first: length × width.' }, { value: r2(l * w10 / 10 + rate), why: 'Multiply the area by the cost per square metre; do not add.' }],
        hints: ['Cost = area × rate.', `Area $= ${l} \\times ${w10 / 10} = ${r2(l * w10 / 10)}$ m².`, `Multiply by $${rate}$.`],
        steps: [{ h: 'Area', d: `$${l} \\times ${w10 / 10} = ${r2(l * w10 / 10)}$ m²` }, { h: 'Cost', d: `$${r2(l * w10 / 10)} \\times ${rate} = ${key}$ dollars` }]
      });
    }
  },
  // Upper or lower bound of a measurement.
  {
    diffs: [3],
    make: rng => {
      const u = rc(rng, [{ nm: 'centimetre', sym: 'cm', p: 1 }, { nm: 'millimetre', sym: 'mm', p: 1 }, { nm: 'metre', sym: 'm', p: 1 }, { nm: 'tenth of a gram', sym: 'g', p: 0.1 }, { nm: 'tenth of a second', sym: 's', p: 0.1 }]);
      const v = u.p === 1 ? ri(rng, 12, 96) : ri(rng, 25, 480) / 10, upper = rng() < 0.5;
      const key = cl(upper ? v + u.p / 2 : v - u.p / 2);
      return num(`A measurement is recorded as $${v}$ ${u.sym}, to the nearest ${u.nm}. What is the ${upper ? 'greatest (upper limit)' : 'smallest (lower limit)'} value it could actually have been?`, key, {
        suffix: u.sym, traps: [{ value: cl(upper ? v - u.p / 2 : v + u.p / 2), why: `The ${upper ? 'upper' : 'lower'} limit is half a unit ${upper ? 'above' : 'below'} the recorded value.` }, { value: cl(upper ? v + u.p : v - u.p), why: 'Go only half of the smallest unit from the recorded value.' }],
        hints: ['Rounded values are within half a unit.', `Half of $${u.p}$ ${u.sym} is $${cl(u.p / 2)}$ ${u.sym}.`, upper ? 'Add it to the recorded value.' : 'Subtract it from the recorded value.'],
        steps: [{ h: 'Half a unit', d: `$${cl(u.p / 2)}$ ${u.sym}` }, { h: upper ? 'Upper limit' : 'Lower limit', d: `$${v} ${upper ? '+' : '-'} ${cl(u.p / 2)} = ${key}$ ${u.sym}` }]
      });
    }
  },
  // Cylinder tank volume in litres.
  {
    diffs: [3],
    make: rng => {
      let r, h, exact;
      do { r = ri(rng, 5, 15) / 10; h = ri(rng, 8, 25) / 10; exact = Math.PI * r * r * h * 1000; } while (Math.abs(exact - Math.floor(exact) - 0.5) < 0.05);
      const key = Math.round(exact);
      return num(`A cylindrical rainwater tank has a radius of $${r}$ m and a height of $${h}$ m. How many litres does it hold when full, to the nearest whole number? (1 m³ = 1000 L; use the $\\pi$ button.)`, key, {
        tol: 0.51, suffix: 'L', traps: [{ value: r1(Math.PI * r * r * h), why: 'That is the volume in m³; multiply by 1000 for litres.', tol: 0.06 }, { value: Math.round(Math.PI * r * h * 1000), why: 'The volume of a cylinder is $\\pi r^2 h$: square the radius.', tol: 0.51 }],
        hints: ['$V = \\pi r^2 h$.', `$\\pi(${r})^2(${h}) \\approx ${r3(Math.PI * r * r * h)}$ m³.`, 'Multiply by 1000.'],
        steps: [{ h: 'Volume', d: `$V = \\pi(${r})^2(${h}) \\approx ${r3(Math.PI * r * r * h)}$ m³` }, { h: 'Litres', d: `$\\times 1000 \\approx ${key}$ L` }]
      });
    }
  },
  // Area unit conversions.
  {
    diffs: [2, 3],
    make: rng => {
      const k = ri(rng, 0, 2);
      if (k === 0) {
        const a = ri(rng, 12, 600) / 10;
        return num(`The area of a rug is $${a}$ m². What is its area in square centimetres?`, Math.round(a * 10000), {
          suffix: 'cm²', traps: [{ value: Math.round(a * 100), why: '1 m² = 100 cm × 100 cm = 10 000 cm².' }, { value: a * 10000 * 100, why: '1 m² = 10 000 cm²; do not multiply by 100 again.' }],
          hints: ['1 m = 100 cm, so 1 m² = 100 × 100 cm².', '1 m² = 10 000 cm².', `Multiply $${a}$ by $10\\,000$.`],
          steps: [{ h: 'Convert', d: `$${a} \\times 10\\,000 = ${Math.round(a * 10000)}$ cm²` }]
        });
      }
      if (k === 1) {
        const a = ri(rng, 15, 950) * 10;
        return num(`A tile has an area of $${a}$ cm². Write its area in square metres.`, a / 10000, {
          suffix: 'm²', traps: [{ value: a / 100, why: '1 m² = 10 000 cm²; divide by 10 000, not 100.' }, { value: a * 10000, why: 'Smaller units to larger: the number should get smaller.' }],
          hints: ['1 m² = 10 000 cm².', `Divide $${a}$ by $10\\,000$.`, 'Move the decimal point four places left.'],
          steps: [{ h: 'Convert', d: `$${a} \\div 10\\,000 = ${a / 10000}$ m²` }]
        });
      }
      const a = ri(rng, 15, 950) * 10;
      return num(`A stamp has an area of $${a}$ mm². What is its area in square centimetres?`, a / 100, {
        suffix: 'cm²', traps: [{ value: a / 10, why: '1 cm² = 10 mm × 10 mm = 100 mm²; divide by 100, not 10.' }, { value: a * 100, why: 'Square millimetres to square centimetres: the number gets smaller.' }],
        hints: ['1 cm = 10 mm, so 1 cm² = 100 mm².', `Divide $${a}$ by $100$.`, 'Move the decimal point two places left.'],
        steps: [{ h: 'Convert', d: `$${a} \\div 100 = ${a / 100}$ cm²` }]
      });
    }
  }
];

// ── Formulas ─────────────────────────────────────────────────────────────────
const LIN = [
  { sym: 'F', name: 'A taxi fare in Sydney', v: 'k', vdesc: 'the distance in kilometres', fixed: 'a flagfall of', per: 'per kilometre', unit: 'km', a: [3, 9], b: [2, 4], n: [4, 30] },
  { sym: 'H', name: 'The cost of hiring a kayak', v: 'h', vdesc: 'the number of hours', fixed: 'a booking fee of', per: 'per hour', unit: 'hours', a: [5, 20], b: [8, 18], n: [2, 8] },
  { sym: 'P', name: 'A monthly phone plan', v: 'g', vdesc: 'the gigabytes of data used above the allowance', fixed: 'a base fee of', per: 'per extra gigabyte', unit: 'GB', a: [20, 45], b: [3, 9], n: [1, 12] }
];
const REARR = [
  rng => { const l = ri(rng, 8, 30), w = ri(rng, 4, l - 1), P = 2 * l + 2 * w; return { f: 'P = 2l + 2w', p: `A rectangular netball court has perimeter $${P}$ m and width $${w}$ m. Using $P = 2l + 2w$, find the length $l$.`, key: l, tr: [{ value: P - w, why: 'Subtract $2w$, then divide by 2.' }, { value: P - 2 * w, why: 'After subtracting $2w$, divide by 2.' }], h: ['Substitute, then rearrange for $l$.', `$${P} = 2l + ${2 * w}$.`, `$2l = ${P - 2 * w}$.`], s: [{ h: 'Substitute', d: `$${P} = 2l + 2(${w})$` }, { h: 'Solve', d: `$l = \\dfrac{${P} - ${2 * w}}{2} = ${l}$` }] }; },
  rng => { const u = ri(rng, 0, 15), a = ri(rng, 2, 9), t = ri(rng, 2, 8), v = u + a * t; return { f: 'v = u + at', p: `Using $v = u + at$, a cyclist accelerating from $u = ${u}$ m/s reaches $v = ${v}$ m/s in $t = ${t}$ s. Find the acceleration $a$.`, key: a, tr: [{ value: v - u, why: 'Divide the change in speed by the time $t$.' }, { value: (v + u) / t, why: 'Subtract $u$ from $v$ first.' }], h: ['Rearrange for $a$.', '$a = \\dfrac{v - u}{t}$.', `$\\dfrac{${v} - ${u}}{${t}}$.`], s: [{ h: 'Rearrange', d: '$a = \\dfrac{v - u}{t}$' }, { h: 'Substitute', d: `$a = \\dfrac{${v} - ${u}}{${t}} = ${a}$` }] }; },
  rng => { const b = ri(rng, 4, 16), h = ri(rng, 3, 14), A = b * h / 2; return { f: 'A = bh/2', p: `A triangular sail has area $${A}$ m² and base $${b}$ m. Using $A = \\frac{1}{2}bh$, find the perpendicular height $h$.`, key: h, tr: [{ value: A / b, why: 'Multiply by 2 as well: $h = \\dfrac{2A}{b}$.' }, { value: 2 * A * b, why: 'Divide by $b$, do not multiply.' }], h: ['Rearrange $A = \\frac{1}{2}bh$ for $h$.', '$h = \\dfrac{2A}{b}$.', `$\\dfrac{2 \\times ${A}}{${b}}$.`], s: [{ h: 'Rearrange', d: '$h = \\dfrac{2A}{b}$' }, { h: 'Substitute', d: `$h = \\dfrac{2(${A})}{${b}} = ${h}$` }] }; },
  rng => { const v = ri(rng, 30, 110), t = ri(rng, 2, 9), d = v * t; return { f: 'd = vt', p: `A bus travels $${d}$ km at an average speed of $${v}$ km/h. Using $d = vt$, find the time $t$ in hours.`, key: t, tr: [{ value: d * v, why: 'Divide the distance by the speed.' }, { value: v / d, why: '$t = \\dfrac{d}{v}$, distance on top.' }], h: ['Rearrange $d = vt$ for $t$.', '$t = \\dfrac{d}{v}$.', `$\\dfrac{${d}}{${v}}$.`], s: [{ h: 'Rearrange', d: '$t = \\dfrac{d}{v}$' }, { h: 'Substitute', d: `$t = \\dfrac{${d}}{${v}} = ${t}$ hours` }] }; },
  rng => { const C = 5 * ri(rng, 0, 9), F = 9 * C / 5 + 32; return { f: 'F = 9C/5 + 32', p: `Using $F = \\frac{9}{5}C + 32$, find the temperature $C$ in degrees Celsius when $F = ${F}$.`, key: C, tr: [{ value: F - 32, why: 'After subtracting 32, multiply by $\\frac{5}{9}$.' }, { value: 5 * F / 9 - 32, why: 'Subtract 32 from $F$ first, then multiply by $\\frac{5}{9}$.' }], h: ['Subtract 32 first.', `$${F} - 32 = ${F - 32}$.`, 'Multiply by $\\frac{5}{9}$.'], s: [{ h: 'Subtract', d: `$${F} - 32 = ${F - 32}$` }, { h: 'Multiply', d: `$C = \\tfrac{5}{9}(${F - 32}) = ${C}$` }] }; },
  rng => { const h = 3 * ri(rng, 1, 5), A = ri(rng, 6, 40), V = A * h / 3; return { f: 'V = Ah/3', p: `A pyramid has volume $${V}$ cm³ and base area $${A}$ cm². Using $V = \\frac{1}{3}Ah$, find the height $h$.`, key: h, tr: [{ value: V / A, why: 'Multiply by 3 as well: $h = \\dfrac{3V}{A}$.' }, { value: V * A / 3, why: 'Divide by $A$, do not multiply.' }], h: ['Rearrange for $h$.', '$h = \\dfrac{3V}{A}$.', `$\\dfrac{3 \\times ${V}}{${A}}$.`], s: [{ h: 'Rearrange', d: '$h = \\dfrac{3V}{A}$' }, { h: 'Substitute', d: `$h = \\dfrac{3(${V})}{${A}} = ${h}$` }] }; }
];

const formulas = [
  // A linear formula in context: substitute or solve.
  {
    diffs: [1, 2],
    make: (rng, diff) => {
      const c = rc(rng, LIN), a = ri(rng, c.a[0], c.a[1]), b = ri(rng, c.b[0], c.b[1]), n = ri(rng, c.n[0], c.n[1]), C = a + b * n;
      const intro = `${c.name} is given by $${c.sym} = ${a} + ${b}${c.v}$ dollars, where $${c.v}$ is ${c.vdesc}.`;
      if (diff === 2 && rng() < 0.5) {
        return num(`${intro} For what value of $${c.v}$ is the cost ${moneyPlain(C)}?`, n, {
          answerPrefix: `${c.v} =`, prefix: `${c.v} =`,
          traps: [{ value: C / b, why: `Take off the fixed part, $${a}$, before dividing by $${b}$.` }, { value: C - a, why: `Divide by $${b}$ as well.` }],
          hints: ['Substitute the cost and solve for the variable.', `$${C} = ${a} + ${b}${c.v}$.`, `$${b}${c.v} = ${C - a}$.`],
          steps: [{ h: 'Set up', d: `$${a} + ${b}${c.v} = ${C}$` }, { h: 'Solve', d: `$${b}${c.v} = ${C - a}$, so $${c.v} = ${n}$` }]
        });
      }
      return num(`${intro} Find $${c.sym}$ when $${c.v} = ${n}$.`, C, {
        prefix: '$', traps: [{ value: (a + b) * n, why: 'Multiply first, then add the fixed amount.' }, { value: b * n, why: `Include the fixed amount of $${a}$.` }],
        hints: ['Substitute the value into the formula.', `$${b} \\times ${n} = ${b * n}$.`, `Add $${a}$.`],
        steps: [{ h: 'Substitute', d: `$${c.sym} = ${a} + ${b}(${n}) = ${C}$` }]
      });
    }
  },
  // Temperature conversion.
  {
    diffs: [1, 2, 3],
    make: (rng, diff) => {
      if (diff === 1) {
        const C = 5 * ri(rng, 0, 9), F = 9 * C / 5 + 32;
        return num(`Water temperature in Fahrenheit is given by $F = \\frac{9}{5}C + 32$. Find $F$ when $C = ${C}$.`, F, {
          traps: [{ value: 9 * C / 5, why: 'Add 32 after multiplying.' }, { value: 9 * (C + 32) / 5, why: 'Only $\\frac{9}{5}C$ is multiplied; add 32 afterwards.' }],
          hints: ['Substitute $C$.', `$\\frac{9}{5} \\times ${C} = ${9 * C / 5}$.`, 'Add 32.'],
          steps: [{ h: 'Substitute', d: `$F = \\tfrac{9}{5}(${C}) + 32 = ${F}$` }]
        });
      }
      if (diff === 2) {
        const C = 5 * ri(rng, 0, 9), F = 9 * C / 5 + 32;
        return num(`The formula $F = \\frac{9}{5}C + 32$ converts degrees Celsius to degrees Fahrenheit. Find $C$ when $F = ${F}$.`, C, {
          traps: [{ value: 5 * F / 9, why: 'Subtract 32 from $F$ before multiplying by $\\frac{5}{9}$.' }, { value: F - 32, why: 'Multiply by $\\frac{5}{9}$ as well.' }],
          hints: ['Subtract 32 first.', `$${F} - 32 = ${F - 32}$.`, 'Multiply by $\\frac{5}{9}$.'],
          steps: [{ h: 'Subtract 32', d: `$${F} - 32 = ${F - 32}$` }, { h: 'Multiply', d: `$C = \\tfrac{5}{9}(${F - 32}) = ${C}$` }]
        });
      }
      const F = ri(rng, 50, 104), C = (F - 32) * 5 / 9;
      return num(`A thermometer reads $${F}$°F. Using $C = \\frac{5}{9}(F - 32)$, find the temperature in degrees Celsius, correct to 1 decimal place.`, r1(C), {
        tol: 0.06, suffix: '°C', traps: [{ value: r1(5 * F / 9 - 32), why: 'Subtract 32 before multiplying: the bracket applies to $F - 32$.', tol: 0.06 }],
        hints: ['Evaluate the bracket first.', `$${F} - 32 = ${F - 32}$.`, 'Multiply by $\\frac{5}{9}$ and round.'],
        steps: [{ h: 'Bracket', d: `$${F} - 32 = ${F - 32}$` }, { h: 'Multiply', d: `$C = \\tfrac{5}{9}(${F - 32}) \\approx ${r1(C)}$` }]
      });
    }
  },
  // Change the subject, then evaluate.
  {
    diffs: [2, 3, 4],
    make: rng => {
      const q = rc(rng, REARR)(rng);
      return num(q.p, q.key, { traps: q.tr, hints: q.h, steps: q.s });
    }
  },
  // Non-linear substitution.
  {
    diffs: [3, 4],
    make: rng => {
      const k = ri(rng, 0, 3);
      if (k === 0) {
        const m = ri(rng, 48, 110), h = ri(rng, 150, 200) / 100, key = r1(m / (h * h));
        return num(`The body mass index is $BMI = \\dfrac{m}{h^2}$, where $m$ is mass in kg and $h$ is height in metres. Find the BMI of a person of mass $${m}$ kg and height $${h}$ m, correct to 1 decimal place.`, key, {
          tol: 0.06, traps: [{ value: r1(m / (2 * h)), why: 'Square the height: $h^2$, not $2h$.', tol: 0.06 }, { value: r1(m / h), why: 'Divide by $h^2$, not just $h$.', tol: 0.06 }],
          hints: ['Square the height first.', `$${h}^2 = ${r3(h * h)}$.`, `Divide $${m}$ by it.`],
          steps: [{ h: 'Height squared', d: `$${h}^2 = ${r3(h * h)}$` }, { h: 'Divide', d: `$BMI = \\dfrac{${m}}{${r3(h * h)}} \\approx ${key}$` }]
        });
      }
      if (k === 1) {
        const m = ri(rng, 2, 90), v = ri(rng, 3, 30), key = m * v * v / 2;
        return num(`The kinetic energy of a moving object is $E = \\frac{1}{2}mv^2$, where $m$ is mass in kg and $v$ is speed in m/s. Find $E$ in joules for $m = ${m}$ and $v = ${v}$.`, key, {
          traps: [{ value: (m * v) ** 2 / 2, why: 'Only $v$ is squared, not $mv$.' }, { value: m * v / 2, why: 'Square the speed: $v^2$.' }],
          hints: ['Square $v$ first.', `$${v}^2 = ${v * v}$.`, `Multiply by $${m}$ and halve.`],
          steps: [{ h: 'Square', d: `$${v}^2 = ${v * v}$` }, { h: 'Evaluate', d: `$E = \\tfrac{1}{2}(${m})(${v * v}) = ${key}$ J` }]
        });
      }
      if (k === 2) {
        const u = ri(rng, 2, 15), a = ri(rng, 2, 9), t = ri(rng, 2, 10), key = u * t + a * t * t / 2;
        return num(`The distance travelled is $s = ut + \\frac{1}{2}at^2$. Find $s$ when $u = ${u}$, $a = ${a}$ and $t = ${t}$.`, key, {
          traps: [{ value: (u * t + a * t) ** 2 / 2, why: 'Only $t$ is squared in the second term.' }, { value: u * t + a * t / 2, why: 'The time is squared: $t^2$.' }],
          hints: ['Work out each term separately.', `$ut = ${u * t}$ and $\\frac{1}{2}at^2 = ${a * t * t / 2}$.`, 'Add them.'],
          steps: [{ h: 'First term', d: `$ut = ${u * t}$` }, { h: 'Second term', d: `$\\tfrac{1}{2}(${a})(${t})^2 = ${a * t * t / 2}$` }, { h: 'Add', d: `$s = ${key}$` }]
        });
      }
      const r = ri(rng, 2, 12), h = ri(rng, 3, 20), key = r1(2 * Math.PI * r * (r + h));
      return num(`The total surface area of a closed cylinder is $A = 2\\pi r(r + h)$. Find $A$ for $r = ${r}$ cm and $h = ${h}$ cm, correct to 1 decimal place.`, key, {
        tol: 0.06, suffix: 'cm²', traps: [{ value: r1(2 * Math.PI * r + h), why: 'The bracket $(r + h)$ multiplies $2\\pi r$.', tol: 0.06 }, { value: r1(2 * Math.PI * r * h), why: 'Add $r$ to $h$ inside the bracket.', tol: 0.06 }],
        hints: ['Evaluate the bracket first.', `$${r} + ${h} = ${r + h}$.`, `$2\\pi \\times ${r} \\times ${r + h}$.`],
        steps: [{ h: 'Bracket', d: `$${r} + ${h} = ${r + h}$` }, { h: 'Evaluate', d: `$A = 2\\pi(${r})(${r + h}) \\approx ${key}$ cm²` }]
      });
    }
  },
  // Inverse with rounding.
  {
    diffs: [4],
    make: rng => {
      const k = ri(rng, 0, 2);
      if (k === 0) {
        const C = ri(rng, 40, 900) / 10, key = r1(C / (2 * Math.PI));
        return num(`The circumference of a circle is $C = 2\\pi r$. A circular oval track has circumference $${C}$ m. Find its radius, correct to 1 decimal place.`, key, {
          tol: 0.06, suffix: 'm', traps: [{ value: r1(C / Math.PI), why: 'Divide by $2\\pi$ to get the radius (dividing by $\\pi$ gives the diameter).', tol: 0.06 }, { value: r1(C * 2 * Math.PI), why: 'Divide by $2\\pi$; do not multiply.', tol: 0.06 }],
          hints: ['Rearrange for $r$.', '$r = \\dfrac{C}{2\\pi}$.', `$\\dfrac{${C}}{2\\pi}$.`],
          steps: [{ h: 'Rearrange', d: '$r = \\dfrac{C}{2\\pi}$' }, { h: 'Evaluate', d: `$r = \\dfrac{${C}}{2\\pi} \\approx ${key}$ m` }]
        });
      }
      if (k === 1) {
        const r = ri(rng, 2, 9), V = ri(rng, 100, 1500), key = r1(V / (Math.PI * r * r));
        return num(`The volume of a cylinder is $V = \\pi r^2 h$. A cylinder of radius $${r}$ cm has volume $${V}$ cm³. Find its height, correct to 1 decimal place.`, key, {
          tol: 0.06, suffix: 'cm', traps: [{ value: r1(V / (Math.PI * r)), why: 'The radius is squared: divide by $\\pi r^2$.', tol: 0.06 }],
          hints: ['Rearrange for $h$.', '$h = \\dfrac{V}{\\pi r^2}$.', `$\\dfrac{${V}}{\\pi \\times ${r * r}}$.`],
          steps: [{ h: 'Rearrange', d: '$h = \\dfrac{V}{\\pi r^2}$' }, { h: 'Evaluate', d: `$h = \\dfrac{${V}}{\\pi(${r})^2} \\approx ${key}$ cm` }]
        });
      }
      const B = ri(rng, 180, 330) / 10, h = ri(rng, 150, 200) / 100, key = r1(B * h * h);
      return num(`The body mass index is $BMI = \\dfrac{m}{h^2}$. A person of height $${h}$ m has a BMI of $${B}$. Find their mass $m$ in kilograms, correct to 1 decimal place.`, key, {
        tol: 0.06, suffix: 'kg', traps: [{ value: r1(B * h), why: 'Multiply by $h^2$, not $h$.', tol: 0.06 }, { value: r1(B / (h * h)), why: 'Multiply both sides by $h^2$ to get $m$.', tol: 0.06 }],
        hints: ['Rearrange for $m$.', '$m = BMI \\times h^2$.', `$${B} \\times ${r3(h * h)}$.`],
        steps: [{ h: 'Rearrange', d: '$m = BMI \\times h^2$' }, { h: 'Evaluate', d: `$m = ${B} \\times ${r3(h * h)} \\approx ${key}$ kg` }]
      });
    }
  },
  // Find the error in a substitution.
  {
    diffs: [1, 2, 3, 4],
    make: rng => {
      let a, b, n, vals;
      do { a = ri(rng, 20, 70); b = ri(rng, 40, 150); n = ri(rng, 3, 9); vals = [a * n, (a + b) * n, a + b + n]; } while (new Set(vals).size < 3 || vals.includes(a * n + b));
      const kind = ri(rng, 0, 2), wrong = vals[kind];
      const T = ['They forgot to add the fixed charge', 'They added the fixed charge before multiplying by the hours', 'They added the three numbers instead of multiplying'];
      return choice(rng,
        `For the formula $C = ${a}n + ${b}$, a student works out $C$ for $n = ${n}$ and gets $${wrong}$. What mistake did the student make?`,
        T[kind],
        T.filter((_, i) => i !== kind).concat(['They made no mistake']).map(t => ({ text: t, why: `Check the working: the correct value is $${a}(${n}) + ${b} = ${a * n + b}$, and the student's number does not come from that mistake.` })),
        ['Work out the correct value first.', `$${a}(${n}) + ${b} = ${a * n + b}$.`, 'Which mistake gives the student’s answer?'],
        [{ h: 'Correct value', d: `$${a}(${n}) + ${b} = ${a * n + b}$` }, { h: 'Match the mistake', d: `${T[kind]} gives $${wrong}$` }]);
    }
  },
  // Describe in words, then evaluate.
  {
    diffs: [1, 2],
    make: rng => {
      const c = rc(rng, [
        { w: 'A pool cleaner charges a call-out fee of', pw: 'plus', per: 'per hour', u: 'hours' },
        { w: 'A function venue charges a room fee of', pw: 'plus', per: 'per guest', u: 'guests' },
        { w: 'A surf school charges a registration fee of', pw: 'plus', per: 'per lesson', u: 'lessons' }
      ]);
      const a = ri(rng, 20, 90), b = ri(rng, 8, 45), n = ri(rng, 3, 14), C = a + b * n;
      return num(`${c.w} ${moneyPlain(a)} ${c.pw} ${moneyPlain(b)} ${c.per}. What is the total cost for ${n} ${c.u}?`, C, {
        prefix: '$', traps: [{ value: (a + b) * n, why: 'The fixed fee is charged once, not for each one.' }, { value: b * n, why: 'Include the fixed fee.' }],
        hints: ['Write the cost as fixed fee + rate × number.', `$${a} + ${b} \\times ${n}$.`, 'Multiply first.'],
        steps: [{ h: 'Formula', d: `$C = ${a} + ${b}n$` }, { h: 'Substitute', d: `$C = ${a} + ${b}(${n}) = ${C}$` }]
      });
    }
  },
  // Build the formula from two values, then predict.
  {
    diffs: [3, 4],
    make: rng => {
      const a = ri(rng, 2, 15), b = ri(rng, 5, 60), n1 = ri(rng, 1, 4), n2 = n1 + ri(rng, 2, 5), n3 = n2 + ri(rng, 2, 8);
      const c1 = a * n1 + b, c2 = a * n2 + b, key = a * n3 + b;
      return num(`A formula has the form $C = an + b$. When $n = ${n1}$, $C = ${c1}$, and when $n = ${n2}$, $C = ${c2}$. Find $C$ when $n = ${n3}$.`, key, {
        traps: [{ value: c2 + (n3 - n2), why: 'Find the gradient $a$ from the two values, then change $C$ by $a$ for each step in $n$.' }].filter(t => t.value !== key),
        hints: ['Find $a$ from the two pairs of values.', `$a = \\dfrac{${c2} - ${c1}}{${n2} - ${n1}} = ${a}$.`, `Then $b = ${c1} - ${a}(${n1}) = ${b}$.`],
        steps: [{ h: 'Gradient', d: `$a = \\dfrac{${c2} - ${c1}}{${n2} - ${n1}} = ${a}$` }, { h: 'Constant', d: `$b = ${c1} - ${a}(${n1}) = ${b}$` }, { h: 'Predict', d: `$C = ${a}(${n3}) + ${b} = ${key}$` }]
      });
    }
  }
];

// ── Relative frequency and probability ───────────────────────────────────────
const COLOURS = ['red', 'blue', 'green', 'yellow'];
const TWO = [
  { r: ['Year 11', 'Year 12'], c: ['catch the train to school', 'do not catch the train'], who: 'students' },
  { r: ['surfers', 'swimmers'], c: ['wear a rash vest', 'do not wear a rash vest'], who: 'beachgoers' },
  { r: ['members', 'non-members'], c: ['use the pool', 'do not use the pool'], who: 'visitors' }
];
function twoWay(rng) {
  const t = rc(rng, TWO), a = ri(rng, 8, 35), b = ri(rng, 8, 35), c = ri(rng, 8, 35), d = ri(rng, 8, 35);
  return { t, a, b, c, d, N: a + b + c + d, text: `In a survey, ${t.t0 ?? ''}` };
}
const twoWayText = g => `A survey of $${g.N}$ ${g.t.who} found: ${g.t.r[0]} who ${g.t.c[0]}, $${g.a}$; ${g.t.r[0]} who ${g.t.c[1]}, $${g.b}$; ${g.t.r[1]} who ${g.t.c[0]}, $${g.c}$; ${g.t.r[1]} who ${g.t.c[1]}, $${g.d}$.`;

const relfreq = [
  // Complement or union of colours.
  {
    diffs: [1, 3, 4],
    make: rng => {
      const k = ri(rng, 3, 4), n = Array.from({ length: k }, () => ri(rng, 2, 12)), T = n.reduce((s, v) => s + v, 0);
      const idx = ri(rng, 0, k - 1), notEvent = rng() < 0.5;
      const bag = n.map((v, i) => `$${v}$ ${COLOURS[i]}`).join(', ');
      const key = notEvent ? T - n[idx] : n[idx] + n[(idx + 1) % k];
      const evText = notEvent ? `not ${COLOURS[idx]}` : `${COLOURS[idx]} or ${COLOURS[(idx + 1) % k]}`;
      return fracQ(`A bag holds ${bag} marbles. One marble is chosen at random. Find the probability that it is ${evText}, as a fraction in simplest form.`, key, T, {
        traps: [{ value: n[idx] / T, why: notEvent ? `That is $P(\\text{${COLOURS[idx]}})$; for "not" take every other marble.` : 'Add the marbles of both colours.' }],
        hints: [`Total marbles: $${T}$.`, notEvent ? `Not ${COLOURS[idx]}: $${T} - ${n[idx]} = ${key}$.` : `${COLOURS[idx]} or ${COLOURS[(idx + 1) % k]}: $${n[idx]} + ${n[(idx + 1) % k]} = ${key}$.`, `$\\dfrac{${key}}{${T}}$, simplified.`],
        steps: [{ h: 'Total', d: `$${n.join(' + ')} = ${T}$` }, { h: 'Probability', d: `$\\dfrac{${key}}{${T}} = ${new Frac(key, T).latex()}$` }]
      });
    }
  },
  // Relative frequency as a percentage.
  {
    diffs: [1, 3],
    make: rng => {
      const tot = rc(rng, [20, 25, 40, 50, 100, 125, 200, 250, 500]), made = ri(rng, 5, tot - 3), key = made * 100 / tot;
      return num(`A netball goaler scored $${made}$ goals from $${tot}$ shots this season. Use relative frequency to estimate the probability that her next shot scores, as a percentage.`, key, {
        suffix: '%', tol: 0.0051, traps: [{ value: made / tot, why: 'Multiply by 100 to give a percentage.', tol: 0.0051 }, { value: made, why: 'Relative frequency = successes ÷ total shots.' }],
        hints: ['Relative frequency = successes ÷ trials.', `$\\dfrac{${made}}{${tot}}$.`, 'Multiply by 100 for a percentage.'],
        steps: [{ h: 'Relative frequency', d: `$\\dfrac{${made}}{${tot}} = ${made / tot}$` }, { h: 'Percentage', d: `$${made / tot} \\times 100 = ${key}\\%$` }]
      });
    }
  },
  // Independent events: the gambler's fallacy.
  {
    diffs: [1, 3, 4],
    make: rng => {
      const kind = ri(rng, 0, 2), n = ri(rng, 3, 9);
      const [what, p] = kind === 0 ? [`A fair coin has landed heads on each of its last ${n} tosses. What is the probability that the next toss is heads?`, ['\\frac{1}{2}', 2]]
        : kind === 1 ? [`A fair six-sided die has landed on 6 on each of the last ${n} rolls. What is the probability that the next roll is a 6?`, ['\\frac{1}{6}', 6]]
          : (() => { const s = ri(rng, 5, 12); return [`A spinner with ${s} equal sections has landed on the same section ${n} spins in a row. What is the probability that it lands on that section again?`, [`\\frac{1}{${s}}`, s]]; })();
      return choice(rng, what, `$${p[0]}$ — each trial is independent`,
        [{ text: `Greater than $${p[0]}$, because it is “due”`, why: 'Past trials do not change the chance of the next one; they are independent.' },
          { text: `Less than $${p[0]}$, because the streak must end`, why: 'Past trials do not change the chance of the next one; they are independent.' },
          { text: `$\\left(${p[0]}\\right)^{${n + 1}}$`, why: 'That is the chance of the whole run together, not of one more trial.' }],
        ['Are the trials independent?', 'What happened before does not change the next trial.', 'Use the probability of a single trial.'],
        [{ h: 'Independence', d: 'Each trial is unaffected by the earlier ones' }, { h: 'Probability', d: `$P = ${p[0]}$` }]);
    }
  },
  // Expected number from a percentage.
  {
    diffs: [3],
    make: rng => {
      const p = 5 * ri(rng, 1, 19), n = 20 * ri(rng, 1, 20), key = p * n / 100;
      return num(`The chance of rain on a March day in Sydney is $${p}\\%$. How many rainy days would you expect over $${n}$ such days?`, key, {
        traps: [{ value: p * n, why: 'Convert the percentage to a fraction of $100$ first.' }, { value: n / p, why: 'Expected number = probability × number of trials.' }],
        hints: ['Expected number = probability × number of trials.', `$${p}\\% = ${p / 100}$.`, `$${p / 100} \\times ${n}$.`],
        steps: [{ h: 'Expected number', d: `$\\dfrac{${p}}{100} \\times ${n} = ${key}$` }]
      });
    }
  },
  // Relative frequency from a tally.
  {
    diffs: [1, 3, 4],
    make: rng => {
      const k = 4, n = Array.from({ length: k }, () => ri(rng, 5, 40)), T = n.reduce((s, v) => s + v, 0);
      const i = ri(rng, 0, 3), j = (i + ri(rng, 1, 3)) % 4;
      const two = rng() < 0.5, key = two ? n[i] + n[j] : n[i];
      const tally = n.map((v, q) => `${COLOURS[q]} $${v}$`).join(', ');
      return fracQ(`A spinner was spun $${T}$ times and landed on: ${tally}. Use relative frequency to estimate the probability that the next spin lands on ${two ? `${COLOURS[i]} or ${COLOURS[j]}` : COLOURS[i]}, as a fraction in simplest form.`, key, T, {
        traps: [{ value: key / (T - key), why: 'The denominator is the total number of spins.' }],
        hints: ['Relative frequency = favourable count ÷ total spins.', two ? `$${n[i]} + ${n[j]} = ${key}$ out of $${T}$.` : `$${key}$ out of $${T}$.`, 'Simplify.'],
        steps: [{ h: 'Relative frequency', d: `$\\dfrac{${key}}{${T}} = ${new Frac(key, T).latex()}$` }]
      });
    }
  },
  // Successes from a relative frequency.
  {
    diffs: [3],
    make: rng => {
      const f = rc(rng, [[2, 5], [3, 8], [7, 20], [1, 6], [5, 12], [3, 4], [4, 9]]), N = f[1] * ri(rng, 5, 30), key = f[0] * N / f[1];
      return num(`A goal shooter’s relative frequency of scoring was $\\dfrac{${f[0]}}{${f[1]}}$ after $${N}$ attempts. How many goals did she score?`, key, {
        traps: [{ value: N / f[0], why: 'Multiply the relative frequency by the number of attempts.' }],
        hints: ['Goals = relative frequency × attempts.', `$\\dfrac{${f[0]}}{${f[1]}} \\times ${N}$.`, `$${N} \\div ${f[1]} = ${N / f[1]}$, then multiply by $${f[0]}$.`],
        steps: [{ h: 'Goals', d: `$\\dfrac{${f[0]}}{${f[1]}} \\times ${N} = ${key}$` }]
      });
    }
  },
  // Two-way table with varied events.
  {
    diffs: [4],
    make: rng => {
      const g = twoWay(rng), kind = ri(rng, 0, 3);
      const [r0, r1n] = g.t.r, [c0, c1] = g.t.c;
      let key, ev, trap, why;
      if (kind === 0) { key = g.c; ev = `one of the ${r1n} who ${c0}`; trap = (g.c + g.d) / g.N; why = 'Use the single cell for this group, out of everyone surveyed.'; }
      else if (kind === 1) { key = g.a + g.b; ev = `one of the ${r0}`; trap = g.a / g.N; why = 'Add both cells in the row.'; }
      else if (kind === 2) { key = g.b + g.d; ev = `someone who does ${c1.replace(/^do not/, 'not')}`.replace('does not', 'does not'); trap = g.d / g.N; why = 'Add both cells in the column.'; }
      else { key = g.a + g.b + g.d; ev = `one of the ${r0}, or someone who ${c1} (or both)`; trap = (g.a + g.b + g.b + g.d) / g.N; why = 'The ' + g.b + ' who are in both groups are counted twice; count them once.'; }
      return fracQ(`${twoWayText(g)} One person is chosen at random, each equally likely. Find the probability that the person is ${ev}, as a fraction in simplest form.`, key, g.N, {
        traps: [{ value: trap, why }],
        hints: [`Everyone is equally likely, so $P = \\dfrac{\\text{people in the event}}{${g.N}}$.`, 'Count the cells that make up the event, without counting any twice.', `That gives $${key}$ people out of $${g.N}$, then simplify.`],
        steps: [{ h: 'Total', d: `$${g.a} + ${g.b} + ${g.c} + ${g.d} = ${g.N}$` }, { h: 'Probability', d: `$\\dfrac{${key}}{${g.N}} = ${new Frac(key, g.N).latex()}$` }]
      });
    }
  },
  // Scale a sample to a population.
  {
    diffs: [4],
    make: rng => {
      const g = twoWay(rng), cell = rc(rng, [['a', 0], ['c', 2]]);
      const count = g[cell[0]], M = g.N * ri(rng, 5, 30), key = M / g.N * count;
      const who = g.t.r[cell[1] === 0 ? 0 : 1], what = g.t.c[0];
      return num(`${twoWayText(g)} Assume the survey represents a larger group of $${M}$ ${g.t.who}. Estimate how many of them are ${who} who ${what}.`, key, {
        traps: [{ value: count, why: 'Scale up: the sample is only part of the larger group.' }, { value: M * count, why: 'Multiply the relative frequency $\\dfrac{' + count + '}{' + g.N + '}$ by the group size.' }],
        hints: ['Find the relative frequency from the survey.', `$\\dfrac{${count}}{${g.N}}$ of the survey.`, `Multiply by $${M}$.`],
        steps: [{ h: 'Relative frequency', d: `$\\dfrac{${count}}{${g.N}}$` }, { h: 'Estimate', d: `$\\dfrac{${count}}{${g.N}} \\times ${M} = ${key}$` }]
      });
    }
  }
];

export const forms = {
  'ms12-normal-exact': normalExact,
  'ms12-normal': normal,
  'ms12-bivariate-fit': bivariate,
  'ms12-network-flow': networkFlow,
  'ms12-nonright': nonright,
  'ms11-measure': measure,
  'ms11-formulas': formulas,
  'ms11-relfreq': relfreq
};
