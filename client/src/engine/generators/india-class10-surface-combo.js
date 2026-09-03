// Pri Learning · CBSE/NCERT Class X — surface areas of combined solids.
//
// Every form uses only EXPOSED area: a face where two solids are joined is
// internal and must be removed before the new curved surface is added.
// π = 22/7 matches the established Class 10 mensuration bank.
import { ri, rc } from '../qhelpers.js';

const PI_N = 22, PI_D = 7;
const areaWithPi = factor => PI_N * factor / PI_D;
const RADII = [7, 14, 21];
const CONES = Object.freeze([
  { r: 7, h: 24, l: 25 },
  { r: 14, h: 48, l: 50 },
  { r: 21, h: 72, l: 75 }
]);

function schematic(kind, labels = []) {
  const text = (x, y, value) => `<text x="${x}" y="${y}" fill="currentColor" stroke="none" text-anchor="middle" font-size="11">${value}</text>`;
  let body = '';
  if (kind === 'cylinder-hemi') {
    body = '<path d="M90 92 Q160 26 230 92"/><line x1="90" y1="92" x2="90" y2="205"/><line x1="230" y1="92" x2="230" y2="205"/><path d="M90 205 Q160 229 230 205"/><path d="M90 92 Q160 112 230 92" stroke-dasharray="5 4"/>';
  } else if (kind === 'cone-hemi') {
    body = '<path d="M160 25 L88 108 L232 108 Z"/><path d="M88 108 Q160 210 232 108"/><path d="M88 108 Q160 128 232 108" stroke-dasharray="5 4"/>';
  } else if (kind === 'cube-hemi') {
    body = '<path d="M95 88 L210 88 L235 110 L120 110 Z"/><path d="M95 88 L95 200 L120 222 L120 110"/><path d="M120 110 L235 110 L235 222 L120 222 Z"/><path d="M119 99 Q177 35 234 99"/><path d="M119 99 Q177 116 234 99" stroke-dasharray="5 4"/>';
  } else {
    body = '<path d="M160 25 L90 103 L230 103 Z"/><line x1="90" y1="103" x2="90" y2="208"/><line x1="230" y1="103" x2="230" y2="208"/><path d="M90 208 Q160 232 230 208"/><path d="M90 103 Q160 123 230 103" stroke-dasharray="5 4"/>';
  }
  const renderedLabels = labels.map((value, i) => text(52 + i * 82, 246, value)).join('');
  return `<svg viewBox="0 0 320 260" role="img" aria-label="Schematic of a combined solid; joined face shown dashed" style="max-width:360px;width:100%;height:auto;display:block"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</g>${renderedLabels}${text(160, 258, 'dashed = joined internal face')}</svg>`;
}

function common(answer, kind, prompt, figure, traps, hints, steps) {
  return {
    prompt,
    figure,
    answerType: 'numeric', answer: { value: answer }, answerSuffix: 'cm²',
    traps: traps.filter(t => t.value !== answer),
    hints,
    steps,
    dotpoint: 0,
    surfaceKind: kind,
    piConvention: '22/7'
  };
}

export function currentSurfaceAreaCombination(rng, diff) {
  if (diff === 1) {
    const r = rc(rng, RADII), h = ri(rng, 6, 24);
    const curvedCylinder = areaWithPi(2 * r * h);
    const bottom = areaWithPi(r * r);
    const curvedHemi = areaWithPi(2 * r * r);
    const answer = curvedCylinder + bottom + curvedHemi;
    return common(
      answer,
      'cylinder-hemisphere',
      `A solid is a cylinder of radius $${r}$ cm and height $${h}$ cm with a hemisphere of the same radius fixed on top. Find the total exposed surface area. Take $\\pi=\\dfrac{22}{7}$.`,
      schematic('cylinder-hemi', [`r=${r}`, `h=${h}`]),
      [
        { value: curvedCylinder + 2 * bottom + curvedHemi, why: 'The top circular face of the cylinder is covered by the hemisphere, so it is internal and must not be counted.' },
        { value: curvedCylinder + bottom + areaWithPi(4 * r * r), why: 'Only a hemisphere is exposed, so use curved area $2\\pi r^2$, not the full sphere area $4\\pi r^2$.' }
      ],
      [
        'Count only surfaces that can be touched from outside.',
        'The joined circular face between the cylinder and hemisphere is hidden.',
        'Exposed area $=2\\pi rh+\\pi r^2+2\\pi r^2$.'
      ],
      [
        { h: 'Cylinder curved surface', d: `$2\\pi rh=2\\times\\dfrac{22}{7}\\times${r}\\times${h}=${curvedCylinder}$ cm²` },
        { h: 'Visible cylinder base', d: `$\\pi r^2=${bottom}$ cm²` },
        { h: 'Hemisphere curved surface', d: `$2\\pi r^2=${curvedHemi}$ cm²` },
        { h: 'Add exposed pieces only', d: `$${curvedCylinder}+${bottom}+${curvedHemi}=${answer}$ cm²` }
      ]
    );
  }

  if (diff === 2) {
    const { r, h, l } = rc(rng, CONES);
    const coneCurved = areaWithPi(r * l);
    const hemiCurved = areaWithPi(2 * r * r);
    const answer = coneCurved + hemiCurved;
    return common(
      answer,
      'cone-hemisphere',
      `A cone of radius $${r}$ cm and height $${h}$ cm is joined along its circular base to a hemisphere of radius $${r}$ cm. Find the exposed surface area. Take $\\pi=\\dfrac{22}{7}$.`,
      schematic('cone-hemi', [`r=${r}`, `h=${h}`, `l=${l}`]),
      [
        { value: answer + 2 * areaWithPi(r * r), why: 'The two circular bases are the same joined interface; neither is exposed, so adding both double-counts hidden area.' },
        { value: areaWithPi(r * h) + hemiCurved, why: 'Cone curved area uses slant height $l$, not vertical height $h$.' }
      ],
      [
        `First find the cone slant height: $l=\\sqrt{${r}^2+${h}^2}=${l}$ cm.`,
        'The common circular base is internal.',
        'Exposed area $=\\pi rl+2\\pi r^2$.'
      ],
      [
        { h: 'Slant height', d: `$l=\\sqrt{${r * r}+${h * h}}=${l}$ cm` },
        { h: 'Cone curved surface', d: `$\\pi rl=${coneCurved}$ cm²` },
        { h: 'Hemisphere curved surface', d: `$2\\pi r^2=${hemiCurved}$ cm²` },
        { h: 'Total exposed area', d: `$${coneCurved}+${hemiCurved}=${answer}$ cm²` }
      ]
    );
  }

  if (diff === 3) {
    const side = rc(rng, [14, 28, 42]);
    const r = side / 2;
    const cubeArea = 6 * side * side;
    const coveredCircle = areaWithPi(r * r);
    const hemiCurved = areaWithPi(2 * r * r);
    const answer = cubeArea - coveredCircle + hemiCurved;
    return common(
      answer,
      'cube-hemisphere',
      `A hemisphere of radius $${r}$ cm is fixed centrally on the top face of a cube of side $${side}$ cm. Find the total exposed surface area. Take $\\pi=\\dfrac{22}{7}$.`,
      schematic('cube-hemi', [`a=${side}`, `r=${r}`]),
      [
        { value: cubeArea + hemiCurved, why: 'The circular part of the cube top covered by the hemisphere is no longer exposed and must be subtracted.' },
        { value: cubeArea - coveredCircle + areaWithPi(3 * r * r), why: 'A hemisphere contributes curved surface $2\\pi r^2$; its flat circular base is the hidden joined face.' }
      ],
      [
        'Start with the full surface area of the cube.',
        'Subtract the circular patch hidden under the hemisphere.',
        'Then add only the curved surface of the hemisphere.'
      ],
      [
        { h: 'Cube surface area', d: `$6a^2=6(${side})^2=${cubeArea}$ cm²` },
        { h: 'Remove hidden circle', d: `$${cubeArea}-\\pi(${r})^2=${cubeArea}-${coveredCircle}$` },
        { h: 'Add hemisphere curve', d: `$2\\pi r^2=${hemiCurved}$ cm²` },
        { h: 'Total exposed area', d: `$${cubeArea}-${coveredCircle}+${hemiCurved}=${answer}$ cm²` }
      ]
    );
  }

  const { r, h: coneH, l } = rc(rng, CONES.slice(0, 2));
  const cylH = ri(rng, 8, 24);
  const cylCurved = areaWithPi(2 * r * cylH);
  const bottom = areaWithPi(r * r);
  const coneCurved = areaWithPi(r * l);
  const answer = cylCurved + bottom + coneCurved;
  return common(
    answer,
    'cylinder-cone',
    `A cone of radius $${r}$ cm and height $${coneH}$ cm is fixed on a cylinder of the same radius and height $${cylH}$ cm. Find the total exposed surface area. Take $\\pi=\\dfrac{22}{7}$.`,
    schematic('cylinder-cone', [`r=${r}`, `cyl h=${cylH}`, `cone l=${l}`]),
    [
      { value: answer + 2 * bottom, why: 'The circular face where cone and cylinder meet is internal. Counting both joined bases adds hidden area twice.' },
      { value: cylCurved + bottom + areaWithPi(r * coneH), why: 'Cone curved area is $\\pi rl$ and therefore uses slant height, not vertical height.' }
    ],
    [
      `The cone slant height is $l=\\sqrt{${r}^2+${coneH}^2}=${l}$ cm.`,
      'Do not count the circular join between the cone and cylinder.',
      'Exposed area $=2\\pi rH+\\pi r^2+\\pi rl$.'
    ],
    [
      { h: 'Cylinder curved surface', d: `$2\\pi rH=${cylCurved}$ cm²` },
      { h: 'Visible bottom base', d: `$\\pi r^2=${bottom}$ cm²` },
      { h: 'Cone curved surface', d: `$\\pi rl=${coneCurved}$ cm²` },
      { h: 'Total exposed area', d: `$${cylCurved}+${bottom}+${coneCurved}=${answer}$ cm²` }
    ]
  );
}
