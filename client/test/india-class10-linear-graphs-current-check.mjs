// Pri Learning · Class X graphical pairs of linear equations: answered from the graph.
//
// D2–D4 of this generator once stated their own answer in the prompt ("the
// lines are parallel — what does this mean?") with a fixed key; only the figure
// varied, so every new figure was new content with a known answer. This suite
// holds the replacement to what it claims, with an oracle that never reads the
// generator's key: the two lines are measured back out of the SVG the student
// sees, and the keyed option must say what those two lines say.
//
//   · the keyed option is the one the drawn lines make true, at every level;
//   · the prompt alone never fixes the answer: at D2–D4 one prompt is keyed to
//     different answers under different figures;
//   · the figure never prints what is to be read from it;
//   · one question, one figure: a prompt and its keyed option fix the figure
//     and the option set, so two copies that read and key the same are the
//     same content (what the server's repeat rule compares).
import assert from 'node:assert/strict';
import { makeRng } from '../src/engine/qhelpers.js';
import { currentLinearPairGraphs } from '../src/engine/generators/india-class10-linear-graphs.js';
import { indiaClass10 } from '../src/engine/generators/india-class10.js';
import { bankOf } from '../src/engine/generators/index.js';
import { PUBLIC_QUESTION_FIELDS } from '../src/engine/publicQuestion.js';

assert.equal(bankOf('c10-linear-graphs'), 'india-class10', 'graphical pair forms must be reachable through the India Class 10 lazy bank');
assert.equal(indiaClass10['c10-linear-graphs'], currentLinearPairGraphs, 'the production Class 10 bank must expose the graphical pair generator');

// ── The oracle: the two lines as drawn ───────────────────────────────────────
// Geometry of figPair (viewBox 340×280, x ∈ [-5, 7], y ∈ [-5, 8]).
const W = 340, H = 280, L = 28, R = 18, T = 18, B = 30, XMIN = -5, XMAX = 7, YMIN = -5, YMAX = 8;
const yOf = px => YMIN + (H - B - px) / (H - T - B) * (YMAX - YMIN);
function drawnLine(svg, colour) {
  const tag = svg.match(new RegExp(`<line x1="([-\\d.]+)" y1="([-\\d.]+)" x2="([-\\d.]+)" y2="([-\\d.]+)" stroke="${colour}"`));
  assert.ok(tag, `the figure draws a ${colour} line`);
  const [x1, y1, x2, y2] = tag.slice(1).map(Number);
  assert.ok(Math.abs(x1 - L) < 0.11 && Math.abs(x2 - (W - R)) < 0.11, 'a line is drawn across the whole window');
  const a = yOf(y1), b = yOf(y2);
  const m = (b - a) / (XMAX - XMIN), c = a - m * XMIN;
  assert.ok(Math.abs(m - Math.round(m)) < 0.02 && Math.abs(c - Math.round(c)) < 0.05, `a drawn line has an integer slope and intercept (${m}, ${c})`);
  return [Math.round(m), Math.round(c)];
}
const label = ([m, c]) => `y=${m === 1 ? 'x' : m === -1 ? '-x' : `${m}x`}${c ? `${c > 0 ? '+' : ''}${c}` : ''}`;
const caseOf = (p, q) => (p[0] !== q[0] ? 'intersecting' : p[1] === q[1] ? 'coincident' : 'parallel');
const legend = svg => [...svg.matchAll(/font-size="11">([^<]*)</g)].map(m => m[1]);

const SEEDS = 400;
const cases = { 1: new Set(), 2: new Set(), 3: new Set(), 4: new Set() };
const byPrompt = { 1: new Map(), 2: new Map(), 3: new Map(), 4: new Map() };
const byQuestion = new Map();
let checked = 0;
for (let seed = 1; seed <= SEEDS; seed++) {
  for (let diff = 1; diff <= 4; diff++) {
    const q = currentLinearPairGraphs(makeRng(seed * 3011 + diff), diff);
    const at = `D${diff} seed ${seed}`;
    assert.equal(q.answerType, 'mcq', `${at} must have a bounded graphical answer`);
    assert.equal(q.dotpoint, 0, `${at} must stay on the graphical solution/consistency outcome`);
    assert.ok(Array.isArray(q.mcqOptions) && q.mcqOptions.length === 4 && new Set(q.mcqOptions).size === 4, `${at} needs four distinct choices`);
    assert.match(q.figure || '', /^<svg[\s\S]*Graphs of a pair of linear equations/, `${at} must render the actual line pair`);
    assert.ok(Array.isArray(q.steps) && q.steps.length === (diff === 2 ? 2 : 3), `${at} carries the steps its marks are counted from`);
    assert.deepEqual(Object.keys(q).filter(key => !PUBLIC_QUESTION_FIELDS.includes(key)).sort(), ['answer', 'graphCase', 'steps'], `${at} holds nothing unexpected outside the public fields`);

    const blue = drawnLine(q.figure, '#3987e5'), orange = drawnLine(q.figure, '#f59e0b');
    const kind = caseOf(blue, orange);
    const correct = String(q.mcqOptions[q.answer.correctIndex]);
    assert.equal(q.graphCase, kind, `${at}: the case recorded is the case drawn`);
    cases[diff].add(kind);

    // The meeting point of the drawn lines, when there is exactly one.
    const meet = kind === 'intersecting' ? (() => { const x = (orange[1] - blue[1]) / (blue[0] - orange[0]); return [x, blue[0] * x + blue[1]]; })() : null;
    if (diff === 1 || diff === 2) {
      if (kind === 'intersecting') {
        assert.ok(Number.isInteger(meet[0]) && Number.isInteger(meet[1]), `${at}: the lines meet on a grid point`);
        assert.ok(correct.includes(`(${meet[0]}, ${meet[1]})`), `${at}: the keyed option names the point where the drawn lines meet (${meet}) — got ${correct}`);
        assert.ok(!q.figure.includes(`(${meet[0]}, ${meet[1]})`) && !q.prompt.includes(`(${meet[0]}, ${meet[1]})`), `${at}: neither the graph nor the prompt prints the point`);
      }
      if (diff === 2) {
        assert.match(correct, { intersecting: /^Exactly one solution/, parallel: /^No solution/, coincident: /^Infinitely many solutions/ }[kind], `${at}: the keyed count is the drawn lines' (${kind}) — got ${correct}`);
      } else assert.equal(kind, 'intersecting');
    } else {
      assert.ok(correct.includes(`$${label(orange)}$`), `${at}: the keyed option names the orange line as drawn (${label(orange)}) — got ${correct}`);
      const verdict = { intersecting: /exactly one solution/, parallel: /no solution/, coincident: /infinitely many solutions/ }[kind];
      assert.match(correct, verdict, `${at}: the keyed classification is the drawn lines' (${kind}) — got ${correct}`);
      // Two options name each candidate equation and two carry each
      // conclusion, so neither can be chosen without the graph.
      const equations = q.mcqOptions.map(o => o.match(/\$([^$]+)\$/)[1]);
      const conclusions = q.mcqOptions.map(o => o.replace(/\$[^$]+\$/, ''));
      assert.deepEqual([...new Set(equations)].map(e => equations.filter(x => x === e).length), [2, 2], `${at}: each candidate equation is offered twice`);
      assert.deepEqual([...new Set(conclusions)].map(c => conclusions.filter(x => x === c).length), [2, 2], `${at}: each conclusion is offered twice`);
    }
    if (diff >= 2) {
      assert.ok(!legend(q.figure).some(text => text === label(orange)) || kind === 'coincident', `${at}: the graph does not label the line the student must read`);
      assert.ok(!legend(q.figure).includes(label(orange)) || diff !== 4, `${at}: at D4 neither line is labelled with its equation`);
      assert.ok(!/parallel|coincid|intersect|inconsistent|dependent|no solution|one solution|never meet|same line/i.test(q.prompt), `${at}: the prompt does not state the case or the answer — ${q.prompt}`);
      assert.ok(!q.hints.some(hint => hint.includes(label(orange)) && kind !== 'coincident'), `${at}: no hint hands over the reading`);
    }
    assert.ok(!q.prompt.includes(correct), `${at}: the prompt does not contain the keyed option`);

    const answers = byPrompt[diff].get(q.prompt) || byPrompt[diff].set(q.prompt, new Set()).get(q.prompt);
    answers.add(correct);
    const key = `${q.prompt}||${correct}`;
    const shown = JSON.stringify([q.figure, [...q.mcqOptions].sort()]);
    if (byQuestion.has(key)) assert.equal(byQuestion.get(key), shown, `${at}: one prompt with one keyed answer is one figure and one option set`);
    else byQuestion.set(key, shown);
    checked += 1;
  }
}

assert.deepEqual([...cases[1]], ['intersecting']);
assert.deepEqual([...cases[2]].sort(), ['coincident', 'intersecting', 'parallel'], 'D2 draws every case');
assert.deepEqual([...cases[3]].sort(), ['intersecting', 'parallel'], 'D3 draws both of its cases');
assert.deepEqual([...cases[4]].sort(), ['coincident', 'intersecting', 'parallel'], 'D4 draws every case');
// The prompt alone does not fix the answer: at D2–D4 most prompts seen more
// than once were keyed to more than one answer, the figure deciding.
const open = {};
for (const diff of [2, 3, 4]) {
  const several = [...byPrompt[diff].values()].filter(answers => answers.size > 1).length;
  open[diff] = `${several}/${byPrompt[diff].size}`;
  assert.ok(several >= byPrompt[diff].size / 2, `D${diff}: one prompt is keyed to different answers under different figures (${open[diff]} prompts)`);
}
// D1: eight figures, eight different solutions — the answer names the figure.
assert.equal(byPrompt[1].size, 1);
assert.equal([...byPrompt[1].values()][0].size, 8, 'D1 has eight pairs meeting at eight different points');

console.log(`PASS — current Class 10 Pair of Linear Equations: ${checked} forms over ${SEEDS} seeds are answered from the drawn lines (oracle: the SVG), the prompt never fixes the answer (prompts keyed to several answers: D2 ${open[2]}, D3 ${open[3]}, D4 ${open[4]}), and one prompt with one keyed answer is one figure (${byQuestion.size} questions).`);
