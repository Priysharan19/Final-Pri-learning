// Pri Learning · CBSE/NCERT Class X — graphical pairs of linear equations.
//
// These forms cover only the current graphical solution / consistency outcome.
// Algebraic substitution, elimination and contextual modelling remain on the
// established y10-simeq bank.
//
// Every form is answered FROM THE GRAPH. The prompt never states the case
// (intersecting, parallel, coincident) and never states the answer: an earlier
// version of D2–D4 did ("the lines are parallel — what does this mean?"), so
// the figure was decoration, every new figure was "new content" with a known
// answer, and one reveal could be farmed for marks. Now, at each level, the
// same prompt can be keyed to different answers and only the figure decides.
//
// One question, one figure: the prompt names the first line and the keyed
// option names what was read from the graph, so a prompt and its keyed answer
// together fix the figure, and every distractor is a fixed function of the
// two lines. Two copies that read the same and are keyed the same ARE the
// same question — which is what the server's repeat rule relies on.
import { rc, mcq } from '../qhelpers.js';

// D1: eight pairs, each meeting at a different lattice point.
const SYSTEMS = Object.freeze([
  { a: [1, 1], b: [-1, 5], point: [2, 3] },
  { a: [2, -1], b: [-1, 8], point: [3, 5] },
  { a: [-1, 4], b: [1, 0], point: [2, 2] },
  { a: [1, -2], b: [-2, 4], point: [2, 0] },
  { a: [2, 1], b: [-1, 4], point: [1, 3] },
  { a: [1, 2], b: [-2, -1], point: [-1, 1] },
  { a: [2, 3], b: [-1, -3], point: [-2, -1] },
  { a: [-1, 3], b: [1, -3], point: [3, 0] }
]);

const SLOPES = Object.freeze([-2, -1, 1, 2]);
const INTERCEPTS = Object.freeze([-3, -2, -1, 0, 1, 2, 3, 4]);
// D2: the slope of the second line when the pair meets — fixed by the first
// line's slope, so the first line and the meeting point fix the figure.
const PARTNER = Object.freeze({ 1: -2, '-1': 2, 2: -1, '-2': 1 });
const BLUE_NOTE = 'The grid lines are $1$ unit apart. If the two lines lie exactly on top of each other, the line is shown dashed in both colours.';
const SECOND = 'second line';

function lineLabel([m, c]) {
  const mx = m === 1 ? 'x' : m === -1 ? '-x' : `${m}x`;
  if (!c) return `y=${mx}`;
  return `y=${mx}${c > 0 ? '+' : ''}${c}`;
}

/** y = mx + c written as a general-form equation with a positive x-coefficient. */
function generalForm([m, c]) {
  const k = Math.abs(m) === 1 ? '' : String(Math.abs(m));
  return m > 0 ? `${k}x-y=${-c}` : `${k}x+y=${c}`;
}

const same = (p, q) => p[0] === q[0] && p[1] === q[1];
/** How a pair of lines stands: 'intersecting' | 'parallel' | 'coincident'. */
const caseOf = (p, q) => (p[0] !== q[0] ? 'intersecting' : p[1] === q[1] ? 'coincident' : 'parallel');
const rise = m => `${Math.abs(m)} unit${Math.abs(m) === 1 ? '' : 's'} ${m > 0 ? 'up' : 'down'}`;

// `labels` are the two legend texts: an equation, or a plain name when the
// student is to read that line from the grid. The unit grid is what makes that
// reading possible, so every figure carries it.
function figPair({ first, second, mark = null, labels = [lineLabel(first), lineLabel(second)] }) {
  const W = 340, H = 280, L = 28, R = 18, T = 18, B = 30;
  const xmin = -5, xmax = 7, ymin = -5, ymax = 8;
  const X = x => L + (x - xmin) / (xmax - xmin) * (W - L - R);
  const Y = y => H - B - (y - ymin) / (ymax - ymin) * (H - T - B);
  const n = v => Math.round(v * 10) / 10;
  let inner = '';
  for (let x = xmin; x <= xmax; x++) if (x) inner += `<line x1="${n(X(x))}" y1="${n(Y(ymin))}" x2="${n(X(x))}" y2="${n(Y(ymax))}" stroke-width="0.6" stroke-opacity="0.22"/>`;
  for (let y = ymin; y <= ymax; y++) if (y) inner += `<line x1="${n(X(xmin))}" y1="${n(Y(y))}" x2="${n(X(xmax))}" y2="${n(Y(y))}" stroke-width="0.6" stroke-opacity="0.22"/>`;
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
  // Mark the intersection visually but never print its coordinates: the student
  // must read those from the axes rather than receive the answer in the SVG.
  if (mark) inner += `<circle cx="${n(X(mark[0]))}" cy="${n(Y(mark[1]))}" r="4.5" fill="currentColor" stroke="none"/>`;
  inner += `<text x="${W-12}" y="${n(Y(0)+16)}" fill="currentColor" stroke="none" font-size="12">x</text>`;
  inner += `<text x="${n(X(0)+10)}" y="16" fill="currentColor" stroke="none" font-size="12">y</text>`;
  inner += `<text x="218" y="22" fill="#3987e5" stroke="none" font-size="11">${labels[0]}</text>`;
  inner += `<text x="218" y="37" fill="#f59e0b" stroke="none" font-size="11">${labels[1]}</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Graphs of a pair of linear equations" style="max-width:420px;width:100%;height:auto;display:block"><g fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">${inner}</g></svg>`;
}

export function currentLinearPairGraphs(rng, diff) {
  if (diff === 1) {
    const s = rc(rng, SYSTEMS);
    const [x,y] = s.point;
    const correct = `(${x}, ${y})`;
    const swapped = x === y ? `(${x - 1}, ${y + 1})` : `(${y}, ${x})`;
    const m = mcq(rng, correct, [
      { text: swapped, why: x === y ? 'The solution is the exact intersection, not a nearby lattice point.' : 'Read coordinates in the order (x, y), not (y, x).' },
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

  const blue = [rc(rng, SLOPES), rc(rng, INTERCEPTS)];
  const [m1, c1] = blue;

  if (diff === 2) {
    // How many common points? The second line is unlabelled; the case is the
    // figure's alone. Read the meeting point when there is one.
    const roll = rng();
    const kind = roll < 0.6 ? 'intersecting' : roll < 0.8 ? 'parallel' : 'coincident';
    let orange, point = null;
    if (kind === 'intersecting') {
      const m2 = PARTNER[m1];
      const places = [];
      for (let x = -3; x <= 5; x++) {
        const y = m1 * x + c1, c2 = y - m2 * x;
        if (y >= -3 && y <= 7 && c2 >= -4 && c2 <= 7) places.push([x, y]);
      }
      point = rc(rng, places);
      orange = [m2, point[1] - m2 * point[0]];
    } else if (kind === 'parallel') {
      orange = [m1, c1 <= 1 ? c1 + 3 : c1 - 3];
    } else {
      orange = [m1, c1];
    }
    const NONE = 'No solution: the two lines never meet';
    const ALL = 'Infinitely many solutions: the two lines are the same line';
    const one = ([x, y]) => `Exactly one solution: $(${x}, ${y})$`;
    let correct, distractors, steps;
    if (kind === 'intersecting') {
      const [x, y] = point;
      correct = one(point);
      distractors = [
        { text: one(x === y ? [x + 1, y] : [y, x]), why: x === y ? 'Read the crossing point exactly: both lines pass through it.' : 'Read coordinates in the order (x, y), not (y, x).' },
        { text: NONE, why: 'The lines cross on the graph, and the crossing point satisfies both equations.' },
        { text: ALL, why: 'Two different lines are drawn; they share only the point where they cross.' }
      ];
      steps = [
        { h: 'Common points', d: `The two lines cross once, at $(${x}, ${y})$.` },
        { h: 'Number of solutions', d: `Exactly one solution: $x=${x}$, $y=${y}$.` }
      ];
    } else if (kind === 'parallel') {
      correct = NONE;
      distractors = [
        { text: one([0, orange[1]]), why: 'That is where the orange line crosses the y-axis. The blue line does not pass through it.' },
        { text: one([0, c1]), why: 'That is where the blue line crosses the y-axis. The orange line does not pass through it.' },
        { text: ALL, why: 'Two separate lines are drawn; they are not the same line.' }
      ];
      steps = [
        { h: 'Common points', d: `Both lines go ${rise(m1)} for every $1$ unit across, and they cross the y-axis at different points, so they are parallel and never meet.` },
        { h: 'Number of solutions', d: 'No point lies on both lines: no solution.' }
      ];
    } else {
      correct = ALL;
      distractors = [
        { text: NONE, why: 'The line is dashed in both colours: the second line lies on the first, so they share every point.' },
        { text: one([0, c1]), why: 'That point is common, but so is every other point of the line.' },
        { text: one([1, m1 + c1]), why: 'That point is common, but so is every other point of the line.' }
      ];
      steps = [
        { h: 'Common points', d: 'Only one line is visible, dashed in both colours: the second line lies exactly on the first.' },
        { h: 'Number of solutions', d: 'Every point of the line satisfies both equations: infinitely many solutions.' }
      ];
    }
    const m = mcq(rng, correct, distractors);
    return {
      prompt: `The line $${lineLabel(blue)}$ is drawn in blue and a second line is drawn in orange. ${BLUE_NOTE} Using the graph, how many solutions does this pair of linear equations have?`,
      figure: figPair({ first: blue, second: orange, mark: point, labels: [lineLabel(blue), SECOND] }),
      answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
      hints: ['A solution of the pair is a point that lies on both lines.', 'Look for where the orange line meets the blue line: once, never, or everywhere.', 'If they meet once, read that point from the grid, x-coordinate first.'],
      steps,
      dotpoint: 0,
      graphCase: kind
    };
  }

  if (diff === 3) {
    // Read the unlabelled line's equation from the grid, then decide. The two
    // equations offered are the true one and one misreading of it, each with
    // both conclusions, so neither the equation nor the conclusion can be
    // picked without the graph.
    const kind = rng() < 0.5 ? 'parallel' : 'intersecting';
    let orange;
    if (kind === 'parallel') {
      orange = [m1, rc(rng, [-4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6].filter(c => Math.abs(c - c1) >= 2))];
    } else {
      const options = [];
      for (const m2 of SLOPES) {
        if (m2 === m1) continue;
        for (let c2 = -4; c2 <= 6; c2++) {
          if (Math.abs(c2 - c1) < 2) continue;
          const x = (c2 - c1) / (m1 - m2), y = m1 * x + c1;
          if (x >= -4 && x <= 6 && y >= -4 && y <= 7) options.push([m2, c2]);
        }
      }
      orange = rc(rng, options);
    }
    // The misreading is fixed by the two lines: the intercept one square out,
    // or the slope with its sign turned.
    const misread = (orange[0] + orange[1]) % 2 === 0 ? [orange[0], orange[1] + 1] : [-orange[0], orange[1]];
    const INCONSISTENT = 'the pair is inconsistent (no solution)';
    const ONE = 'the pair is consistent with exactly one solution';
    const DEPENDENT = 'the pair is consistent with infinitely many solutions';
    const verdict = line => ({ intersecting: ONE, parallel: INCONSISTENT, coincident: DEPENDENT })[caseOf(blue, line)];
    const other = line => (verdict(line) === ONE ? INCONSISTENT : ONE);
    const say = (line, conclusion) => `The orange line is $${lineLabel(line)}$, so ${conclusion}.`;
    const misreadWhy = misread[0] === orange[0]
      ? `Read the orange line's y-intercept again: it crosses the y-axis at $${orange[1]}$.`
      : `Read the orange line's slope again: it goes ${rise(orange[0])} for every $1$ unit across.`;
    const m = mcq(rng, say(orange, verdict(orange)), [
      { text: say(orange, other(orange)), why: kind === 'parallel' ? 'Equal slopes and different y-intercepts: the lines are parallel and never meet.' : 'The slopes differ, so the lines cross exactly once.' },
      { text: say(misread, verdict(misread)), why: misreadWhy },
      { text: say(misread, other(misread)), why: misreadWhy }
    ]);
    return {
      prompt: `The line $${lineLabel(blue)}$ is drawn in blue and a second line is drawn in orange. The grid lines are $1$ unit apart. Read the orange line from the graph. Which statement is correct?`,
      figure: figPair({ first: blue, second: orange, labels: [lineLabel(blue), SECOND] }),
      answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
      hints: ['Find where the orange line crosses the y-axis, then how far it rises or falls for each $1$ unit across.', 'Write the orange line as $y=mx+c$ and compare its slope with the blue line\'s.', 'Equal slopes with different intercepts never meet; different slopes meet exactly once.'],
      steps: [
        { h: 'Read the slope', d: `The orange line goes ${rise(orange[0])} for every $1$ unit across: slope $${orange[0]}$.` },
        { h: 'Read the intercept', d: `It crosses the y-axis at $${orange[1]}$, so it is $${lineLabel(orange)}$.` },
        { h: 'Compare and classify', d: kind === 'parallel'
          ? `Both slopes are $${m1}$ and the intercepts differ, so the lines are parallel: no solution, the pair is inconsistent.`
          : `The slopes $${m1}$ and $${orange[0]}$ differ, so the lines cross once: exactly one solution, the pair is consistent.` }
      ],
      dotpoint: 0,
      graphCase: kind
    };
  }

  // D4: the first equation is given in general form, the second only as a
  // drawn line. The same two candidate equations and the same four statements
  // are offered whether the drawn line lies on the first or beside it, so the
  // coincident and parallel figures of one prompt differ in nothing but the
  // graph.
  const roll = rng();
  const kind = roll < 0.35 ? 'coincident' : roll < 0.7 ? 'parallel' : 'intersecting';
  const beside = [m1, c1 + 1];
  let orange, rival;
  if (kind === 'coincident') { orange = blue; rival = beside; }
  else if (kind === 'parallel') { orange = beside; rival = blue; }
  else {
    const options = [];
    for (const m2 of SLOPES) {
      if (m2 === m1) continue;
      for (let c2 = -4; c2 <= 6; c2++) {
        if (Math.abs(c2 - c1) < 2) continue;
        const x = (c2 - c1) / (m1 - m2), y = m1 * x + c1;
        if (x >= -4 && x <= 6 && y >= -4 && y <= 7) options.push([m2, c2]);
      }
    }
    orange = rc(rng, options);
    rival = [m1, orange[1]];
  }
  const VERDICT = {
    intersecting: 'consistent and independent: exactly one solution',
    parallel: 'inconsistent: no solution',
    coincident: 'consistent and dependent: infinitely many solutions'
  };
  const verdict = line => VERDICT[caseOf(blue, line)];
  const say = (line, conclusion) => `The second equation is $${lineLabel(line)}$; the pair is ${conclusion}.`;
  const readWhy = kind === 'intersecting'
    ? `Read the orange line's slope again: it goes ${rise(orange[0])} for every $1$ unit across.`
    : kind === 'coincident'
      ? 'Only one line is visible, dashed in both colours: the second line lies exactly on the first.'
      : 'Two separate lines are drawn, one square apart on the y-axis.';
  const m = mcq(rng, say(orange, verdict(orange)), [
    { text: say(orange, verdict(rival)), why: 'The equation is read correctly, but compare it with the first: ' + (kind === 'intersecting' ? 'different slopes cross exactly once.' : kind === 'coincident' ? 'the same line shares every point.' : 'equal slopes with different intercepts never meet.') },
    { text: say(rival, verdict(rival)), why: readWhy },
    { text: say(rival, verdict(orange)), why: readWhy }
  ]);
  return {
    prompt: `The first equation of a pair is $${generalForm(blue)}$; its graph is drawn in blue. The graph of the second equation is drawn in orange. ${BLUE_NOTE} Which statement is correct?`,
    figure: figPair({ first: blue, second: orange, labels: ['first equation', 'second equation'] }),
    answerType: 'mcq', answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps }, mcqOptions: m.options,
    hints: ['Rewrite the first equation as $y=mx+c$ so that its slope and y-intercept can be compared.', 'Read the orange line from the grid: where it crosses the y-axis, and how far it rises or falls for each $1$ unit across.', 'Same slope and same intercept: one line. Same slope, different intercepts: parallel. Different slopes: one crossing.'],
    steps: [
      { h: 'Rewrite the first equation', d: `$${generalForm(blue)}$ is $${lineLabel(blue)}$: slope $${m1}$, y-intercept $${c1}$.` },
      { h: 'Read the second line', d: kind === 'coincident'
        ? `Only one line is visible, dashed in both colours, so the second equation is also $${lineLabel(orange)}$.`
        : `The orange line goes ${rise(orange[0])} for every $1$ unit across and crosses the y-axis at $${orange[1]}$: $${lineLabel(orange)}$.` },
      { h: 'Compare and classify', d: kind === 'coincident'
        ? 'Same slope and same intercept: every point is common. Consistent and dependent, infinitely many solutions.'
        : kind === 'parallel'
          ? 'Same slope, different intercepts: the lines never meet. Inconsistent, no solution.'
          : `Slopes $${m1}$ and $${orange[0]}$ differ: the lines cross once. Consistent and independent, exactly one solution.` }
    ],
    dotpoint: 0,
    graphCase: kind
  };
}
