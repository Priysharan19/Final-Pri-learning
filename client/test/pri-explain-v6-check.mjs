import assert from 'node:assert/strict';
import {
  canMorphFigureSvg,
  equationTravelPlan,
  instrumentFigureSvg,
  interpolatePathData,
  morphFigureSvg,
} from '../src/explain/choreography.js';
import { buildVisualTimeline } from '../src/explain/visualEngine.js';

let checks = 0;
const check = (name, fn) => {
  try { fn(); checks += 1; }
  catch (err) { console.error(`FAIL ${name}: ${err.message}`); process.exitCode = 1; }
};

check('moves a reused changed term directly between verified token positions', () => {
  const plan = equationTravelPlan({
    before: [
      { text: 'a', changed: true },
      { text: '+', changed: false },
      { text: 'b', changed: true },
    ],
    after: [
      { text: 'b', changed: true },
      { text: '+', changed: false },
      { text: 'a', changed: true },
    ],
  });
  assert.equal(plan.travels.length, 2);
  assert.equal(plan.travels.find(item => item.text === 'a')?.from, 6);
  assert.equal(plan.travels.find(item => item.text === 'a')?.to, 94);
});

check('instruments only existing authored SVG primitives', () => {
  const svg = '<svg viewBox="0 0 10 10"><line x1="0" y1="5" x2="10" y2="5"/><path d="M 0 9 L 10 1"/><text x="1" y="1">x</text></svg>';
  const result = instrumentFigureSvg(svg, 'graph');
  assert.match(result, /pri-v-role-scaffold/);
  assert.match(result, /pri-v-role-structure/);
  assert.match(result, /pri-v-role-label/);
  assert.match(result, /d="M 0 9 L 10 1"/);
});

check('interpolates compatible authored path geometry', () => {
  assert.equal(interpolatePathData('M 0 0 L 10 10', 'M 0 0 L 20 20', 0.5), 'M 0 0 L 15 15');
});

check('refuses to fabricate a morph when path topology differs', () => {
  const a = '<svg><path d="M 0 0 L 10 10"/></svg>';
  const b = '<svg><path d="M 0 0 C 5 5 10 5 20 20"/></svg>';
  assert.equal(canMorphFigureSvg(a, b), false);
  assert.equal(morphFigureSvg(a, b, 0.25), a);
  assert.equal(morphFigureSvg(a, b, 0.75), b);
});

check('physically morphs compatible authored SVG path states', () => {
  const a = '<svg><path d="M 0 0 L 10 10"/></svg>';
  const b = '<svg><path d="M 0 0 L 20 20"/></svg>';
  assert.equal(canMorphFigureSvg(a, b), true);
  assert.match(morphFigureSvg(a, b, 0.5), /d="M 0 0 L 15 15"/);
});

check('carries an authored figure sequence through the verified visual timeline', () => {
  const first = '<svg viewBox="0 0 10 10"><path d="M 0 9 L 10 1"/></svg>';
  const second = '<svg viewBox="0 0 10 10"><path d="M 0 8 L 10 2"/></svg>';
  const timeline = buildVisualTimeline({
    steps: [{ h: 'Read the graph', d: 'Inspect the $x$-intercept.' }],
  }, {
    questionPrompt: 'Use the graph.',
    questionFigure: first,
    questionFigureSequence: [second],
  });
  const figure = timeline[0].visuals.find(visual => visual.kind === 'figure');
  assert.equal(figure.mode, 'graph');
  assert.deepEqual(figure.sequence, [first, second]);
});

if (!process.exitCode) console.log(`PRI EXPLAIN V6 SUITE PASSED — ${checks}/${checks} checks`);
