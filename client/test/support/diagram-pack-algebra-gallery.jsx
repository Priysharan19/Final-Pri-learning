// The algebra diagram pack, static and interactive, for its browser check
// (client/test/diagram-pack-algebra-browser-check.mjs). Test support only.
import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/instrument/instrument.css';
import DiagramFromSpec from '../../src/diagrams/DiagramFromSpec.jsx';

const QUAD = { expr: 'a*x^2+b*x+c', params: [{ name: 'a', min: -3, max: 3, step: 1, initial: 1 }, { name: 'b', min: -6, max: 6, step: 1, initial: -5 }, { name: 'c', min: -6, max: 6, step: 1, initial: 6 }], xmin: -2, xmax: 6, ymin: -3, ymax: 8, show: ['roots', 'vertex', 'yIntercept'] };
const LP = { constraints: [{ a: 1, b: 2, op: '<=', c: 8 }, { a: 3, b: 1, op: '<', c: 10 }, { a: 1, b: 0, op: '>=', c: 0 }, { a: 0, b: 1, op: '>=', c: 0 }], xmin: -1, xmax: 5, ymin: -1, ymax: 5, objective: { a: 1, b: 1, goal: 'max' } };
const STATIC = [
  { kind: 'paramFunction', ...QUAD },
  { kind: 'paramFunction', expr: 'a/(x-h)+k', params: [{ name: 'a', min: -3, max: 3, step: 0.5, initial: 2 }, { name: 'h', min: -3, max: 3, step: 0.5, initial: 1 }, { name: 'k', min: -3, max: 3, step: 0.5, initial: -1 }], xmin: -4, xmax: 5, ymin: -5, ymax: 5, show: ['roots', 'yIntercept', 'asymptotes'] },
  { kind: 'slopeField', dydx: 'x*y', xmin: -3, xmax: 3, ymin: -3, ymax: 3, through: [[0, 1], [0, -1]] },
  { kind: 'region', ...LP },
  { kind: 'numberLineJumps', op: 'add', a: '1/4', b: '3/4', min: 0, max: 2, fractions: 4 }
];
const INTERACTIVE = [
  { kind: 'paramGraph', ...QUAD },
  { kind: 'sequenceExplorer', type: 'geometric', first: 3, step: 0.5, n: 8 },
  { kind: 'slopeFieldExplorer', dydx: 'y', xmin: -2, xmax: 2, ymin: -1, ymax: 5, through: [[0, 1]] },
  { kind: 'lpExplorer', ...LP },
  { kind: 'numberLineStepper', op: 'add', a: 3, b: 4, min: -2, max: 10 }
];

function Gallery() {
  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '0 16px 48px', background: 'var(--in-base)', color: 'var(--in-tx)' }}>
      <h1>Algebra pack</h1>
      <section aria-labelledby="g-static"><h2 id="g-static">Static</h2>{STATIC.map((spec, i) => <div key={i} data-case={`static-${i}`}><DiagramFromSpec spec={spec} /></div>)}</section>
      <section aria-labelledby="g-interactive"><h2 id="g-interactive">Interactive</h2>{INTERACTIVE.map((spec, i) => <div key={i} data-case={`interactive-${i}`}><DiagramFromSpec spec={spec} interactive /></div>)}</section>
    </main>
  );
}
document.documentElement.classList.add('ui-instrument');
createRoot(document.getElementById('root')).render(<Gallery />);
