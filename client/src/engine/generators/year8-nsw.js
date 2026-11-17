// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Stage 4 generator for the NSW Mathematics K–10 (2022) outcome the
// Year 7–10 banks left without an approved form. Original to Pri; no NESA paper,
// question or marking guideline is used. Every answer is a whole number of degrees.
//
//   y8-geo-figures   MA4-GEO-C-01   Properties of geometrical figures
// ─────────────────────────────────────────────────────────────────────────────
import { ri, rc } from '../qhelpers.js';

export const year8Nsw = {
  'y8-geo-figures': (rng, diff) => {
    if (diff === 1) {
      const a = ri(rng, 30, 90), b = ri(rng, 20, 80);
      const c = 180 - a - b;
      return {
        prompt: `Two angles of a triangle are $${a}^\\circ$ and $${b}^\\circ$. Find the third angle, in degrees.`,
        answerType: 'numeric', answer: { value: c }, answerSuffix: '°',
        traps: [{ value: 360 - a - b, why: 'The angles of a triangle add to $180^\\circ$, not $360^\\circ$.' }],
        hints: ['The angle sum of a triangle is $180^\\circ$.', `$${a} + ${b} = ${a + b}$.`, `$180 - ${a + b}$.`],
        steps: [{ h: 'Angle sum', d: `$180 - ${a} - ${b} = ${c}$` }, { h: 'Answer', d: `The third angle is $${c}^\\circ$` }]
      };
    }
    if (diff === 2) {
      const p = ri(rng, 25, 70), q = ri(rng, 25, 70);
      return {
        prompt: `One side of a triangle is extended. The exterior angle formed is $${p + q}^\\circ$, and one of the two interior opposite angles is $${p}^\\circ$. Find the other interior opposite angle, in degrees.`,
        answerType: 'numeric', answer: { value: q }, answerSuffix: '°',
        traps: [{ value: 180 - (p + q) - p, why: 'An exterior angle equals the sum of the two interior opposite angles: subtract the known one from the exterior angle.' }].filter(t => t.value !== q),
        hints: ['The exterior angle of a triangle equals the sum of the two interior opposite angles.', `$${p + q} - ${p}$.`, 'Check: the three interior angles must still add to $180^\\circ$.'],
        steps: [{ h: 'Exterior angle theorem', d: `$${p + q} = ${p} + x$` }, { h: 'Solve', d: `$x = ${q}$, so the angle is $${q}^\\circ$` }]
      };
    }
    if (diff === 3) {
      const a = ri(rng, 40, 130);
      return {
        prompt: `Two parallel lines are cut by a transversal. Two co-interior (allied) angles lie between the lines on the same side of the transversal. One is $${a}^\\circ$. Find the other, in degrees.`,
        answerType: 'numeric', answer: { value: 180 - a }, answerSuffix: '°',
        traps: [{ value: a, why: 'Co-interior angles are supplementary (they add to $180^\\circ$); equal angles come from alternate or corresponding pairs.' }].filter(t => t.value !== 180 - a),
        hints: ['Co-interior angles between parallel lines add to $180^\\circ$.', `$180 - ${a}$.`, 'They are not equal unless each is $90^\\circ$.'],
        steps: [{ h: 'Co-interior angles', d: `$x + ${a} = 180$` }, { h: 'Solve', d: `$x = ${180 - a}$` }]
      };
    }
    const n = rc(rng, [5, 6, 8, 9, 10, 12]);
    const interior = (n - 2) * 180 / n;
    return {
      prompt: `What is the size of each interior angle of a regular polygon with $${n}$ sides, in degrees?`,
      answerType: 'numeric', answer: { value: interior }, answerSuffix: '°',
      traps: [{ value: 360 / n, why: `That is the exterior angle. Each interior angle is $180^\\circ$ minus it.` }],
      hints: ['The interior angles of an $n$-sided polygon add to $(n - 2)\\times 180^\\circ$.', `For $n = ${n}$ the sum is $${(n - 2) * 180}^\\circ$.`, `Divide by $${n}$.`],
      steps: [{ h: 'Angle sum', d: `$(${n} - 2)\\times 180 = ${(n - 2) * 180}$` }, { h: 'Share equally', d: `$${(n - 2) * 180}\\div ${n} = ${interior}$` }]
    };
  }
};
