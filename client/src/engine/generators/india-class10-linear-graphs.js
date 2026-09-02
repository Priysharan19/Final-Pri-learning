// Pri Learning · CBSE/NCERT Class X — graphical pairs of linear equations.
//
// These forms cover only the current graphical solution / consistency outcome.
// Algebraic substitution, elimination and contextual modelling remain on the
// established y10-simeq bank.
import { rc, mcq } from '../qhelpers.js';

const SYSTEMS = Object.freeze([
  { a: [1, 1], b: [-1, 5], point: [2, 3] },
  { a: [2, -1], b: [-1, 5], point: [2, 3] },
  { a: [-1, 4], b: [1, 0], point: [2, 2] },
  { a: [1, -2], b: [-2, 4], point: [2, 0] },
  { a: [2, 1], b: [-1, 4], point: [1, 3] }
]);

function lineLabel([m, c]) {
  const mx = m === 1 ? 'x' : m === -1 ? '-x' : `${m}x`;
  if (!c) return `y=${mx}`;
  return `y=${mx}${c > 0 ? '+' : ''}${c}`;
}

function figPair({ first, second, mark = null }) {
  const W = 340, H = 280, L = 28, R = 18, T = 18, B = 30;
  const xmin = -5, xmax = 7, ymin = -5, ymax = 8;
  const X = x => L + (x - xmin) / (xmax - xmin) * (W - L - R);
  const Y = y => H - B - (y - ymin) / (ymax - ymin) * (H - T - B);
  const n = v => Math.round(v * 10) / 10;
  let inner = '';
  inner += `<line x1="${n(X(xmin))}" y1="${n(Y(0))}" x2="${n(X(xmax))}" y2="${n(Y(0))}"/>`;
  inner += `<line x1="${n(X(0))}" y1="${n(Y(ymin))}" x2="${n(X(0))}" y2="${n(Y(ymax))}"/>`;
  for (let x = -4; x <= 6; x += 2) {
    if (!x) continue;
    inner += `<line x1="${n(X(x))}" y1="${n(Y(0)-4)}" x2="${n(X(x))}" y2="${n(Y(0)+4)}"/>`;
    inner += `<text x="${n(X(x))}" y="${n(Y(0)+17)}" fill="currentColor" stroke="none" text-anchor="middle" font-size="10">${x}</text>`;
  }
  for (let y = -4; y <= 8; y += 2) {
    if (!y) continue;
    inner += `<line x1="${n(X(0)-4)}" y1="${n(Y(y))}" x2="${n(X(0)+4)}" y2="${n(Y(y))}"/>`;
    inner += `<text x="${n(X(0)-10)}" y="${n(Y(y)+4)}" fill="currentColor" stroke="none" text-anchor="middle" font-size="10">${y}</text>`;
  }
  const draw = ([m,c], colour, dash = '') => {
    const y1 = m * xmin + c, y2 = m * xmax + c;
    return `<line x1="${n(X(xmin))}" y1="${n(Y(y1))}" x2="${n(X(xmax))}" y2="${n(Y(y2))}" stroke="${colour}" stroke-width="2.2"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
  };
  inner += draw(first, '#3987e5');
  inner += draw(second, '#f59e0b', first[0] === second[0] && first[1] === second[1] ? '7 4' : '');
  if (mark) {
    inner += `<circle cx="${n(X(mark[0]))}" cy="${n(Y(mark[1]))}" r="4.5" fill="currentColor" stroke="none"/>`;
    inner += `<text x="${n(X(mark[0])+28)}" y="${n(Y(mark[1])-8)}" fill="currentColor" stroke="none" text-anchor="middle" font-size="11">(${mark[0]}, ${mark[1]})</text>`;
  }
  inner += `<text x="${W-12}" y="${n(Y(0)+16)}" fill="currentColor" stroke="none" font-size="12">x</text>`;
  inner += `<text x="${n(X(0)+10)}" y="16" fill="currentColor" stroke="none" font-size="12">y</text>`;
  inner += `<text x="218" y="22" fill="#3987e5" stroke="none" font-size="11">${lineLabel(first)}</text>`;
  inner += `<text x="218" y="37" fill="#f59e0b" stroke="none" font-size="11">${lineLabel(second)}</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Graphs of a pair of linear equations" style="max-width:420px;width:100%;height:auto;display:block"><g fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">${inner}</g></svg>`;
}

export function currentLinearPairGraphs(rng, diff) {
  if (diff === 1) {
    const s = rc(rng, SYSTEMS);
    const [x,y] = s.point;
    const correct = `(${x}, ${y})`;
    const m = mcq(rng, correct, [
      { text: `(${y}, ${x})`, why: 'Read coordinates in the order (x, y), not (y, x).' },
      { text: `(${x+1}, ${y})`, why: 'The solution is the exact point where both lines meet.' },
      { text: `(${x}, ${y+1})`, why: 'The solution must lie on both lines simultaneously.' }
    ]);
    return {
      prompt: 'The two linear equations are graphed. What is the solution of the pair?',
      figure: figPair({ first: s.a, second: s.b, mark: s.point }),
      answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
      hints: ['The graphical solution is the common point of the two lines.', 'Read its x-coordinate first and y-coordinate second.', `The lines meet at $(${x},${y})$.`],
      steps: [
        { h: 'Locate the intersection', d: 'Find the point that lies on both graphed equations.' },
        { h: 'Read the coordinates', d: `$x=${x}$ and $y=${y}$` },
        { h: 'Solution', d: `$(${x},${y})$` }
      ],
      dotpoint: 0,
      graphCase: 'intersecting'
    };
  }

  if (diff === 2) {
    const s = rc(rng, SYSTEMS);
    const correct = 'Consistent and independent: exactly one solution';
    const m = mcq(rng, correct, [
      { text: 'Inconsistent: no solution', why: 'Two distinct intersecting lines share one point, so a solution exists.' },
      { text: 'Consistent and dependent: infinitely many solutions', why: 'Infinitely many solutions occur when the two equations represent the same line.' },
      { text: 'The graph is insufficient to decide', why: 'The intersection pattern directly determines the number and nature of solutions.' }
    ]);
    return {
      prompt: 'The graphs of a pair of linear equations intersect at one point. How should the pair be classified?',
      figure: figPair({ first: s.a, second: s.b, mark: s.point }),
      answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
      hints: ['Count the common points of the two lines.', 'One common point means one ordered-pair solution.', 'A pair with at least one solution is consistent; one solution makes it independent.'],
      steps: [
        { h: 'Read the graph', d: 'The two distinct lines intersect once.' },
        { h: 'Number of solutions', d: 'Exactly one.' },
        { h: 'Classification', d: 'Consistent and independent.' }
      ],
      dotpoint: 0,
      graphCase: 'intersecting'
    };
  }

  if (diff === 3) {
    const m0 = rc(rng, [-2,-1,1,2]);
    const c1 = rc(rng, [-2,0,1,3]);
    const c2 = c1 + rc(rng, [2,3,-2,-3]);
    const correct = 'Inconsistent: no solution';
    const m = mcq(rng, correct, [
      { text: 'Consistent and independent: exactly one solution', why: 'Parallel distinct lines never meet, so there is no common ordered pair.' },
      { text: 'Consistent and dependent: infinitely many solutions', why: 'Coincident lines have infinitely many solutions; these are distinct parallel lines.' },
      { text: 'Two solutions', why: 'Two straight lines cannot intersect in two distinct points unless they are the same line, in which case every point is common.' }
    ]);
    return {
      prompt: 'The two graphed equations form distinct parallel lines. What does this mean for the pair of linear equations?',
      figure: figPair({ first: [m0,c1], second: [m0,c2] }),
      answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
      hints: ['Parallel distinct lines have no point in common.', 'A graphical solution must lie on both lines.', 'No common point means no solution, so the pair is inconsistent.'],
      steps: [
        { h: 'Read the graph', d: 'The lines are parallel and distinct.' },
        { h: 'Common points', d: 'There are none.' },
        { h: 'Classification', d: 'No solution: inconsistent pair.' }
      ],
      dotpoint: 0,
      graphCase: 'parallel'
    };
  }

  const m0 = rc(rng, [-2,-1,1,2]);
  const c = rc(rng, [-2,0,1,3]);
  const correct = 'Consistent and dependent: infinitely many solutions';
  const m = mcq(rng, correct, [
    { text: 'Inconsistent: no solution', why: 'The equations draw the same line, so every point on it satisfies both.' },
    { text: 'Consistent and independent: exactly one solution', why: 'One solution occurs for two distinct intersecting lines, not coincident lines.' },
    { text: 'Exactly two solutions', why: 'Coincident straight lines share every point, not merely two points.' }
  ]);
  return {
    prompt: 'The two equations produce the same line on the graph. How should the pair be classified?',
    figure: figPair({ first: [m0,c], second: [m0,c] }),
    answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
    hints: ['If both equations describe the same line, every point on that line satisfies both.', 'That gives infinitely many common ordered pairs.', 'A pair with infinitely many solutions is consistent and dependent.'],
    steps: [
      { h: 'Read the graph', d: 'Both equations coincide as one line.' },
      { h: 'Common points', d: 'Every point on the line is common.' },
      { h: 'Classification', d: 'Infinitely many solutions: consistent and dependent.' }
    ],
    dotpoint: 0,
    graphCase: 'coincident'
  };
}
