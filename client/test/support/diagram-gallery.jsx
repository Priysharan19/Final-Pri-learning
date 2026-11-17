// A page that draws every diagram kind, static and interactive, for the browser
// check (client/test/diagram-kit-browser-check.mjs). Test support only: it is not
// part of the app, and nothing in the app imports it.
import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/instrument/instrument.css';
import DiagramFromSpec from '../../src/diagrams/DiagramFromSpec.jsx';

const STATIC = [
  { kind: 'function', xmin: -4, xmax: 6, ymin: -6, ymax: 8, curves: [{ type: 'quadratic', a: 1, h: 1, k: -4, intercepts: true, label: 'y=(x-1)^2-4' }] },
  { kind: 'function', xmin: -4, xmax: 4, ymin: -4, ymax: 4, curves: [{ type: 'reciprocal', a: 1, label: 'y=\\frac{1}{x}' }], asymptotes: [{ x: 0, label: 'x=0' }, { y: 0, label: 'y=0' }] },
  { kind: 'function', xmin: -1, xmax: 4, ymin: -1, ymax: 10, curves: [{ expr: 'x^2', shade: { from: 0, to: 3 } }] },
  { kind: 'trig', fn: 'sin', a: 2 }, { kind: 'trig', fn: 'tan' },
  { kind: 'unitCircle', deg: 135, showTan: true },
  { kind: 'triangle', a: 3, b: 4, c: 5, showArea: true }, { kind: 'triangle', a: 5, b: 7, C: 60 }, { kind: 'polygon', n: 6, side: 2 },
  { kind: 'circleTheorem', theorem: 'centre' }, { kind: 'circleTheorem', theorem: 'segment' }, { kind: 'circleTheorem', theorem: 'semicircle' },
  { kind: 'circleTheorem', theorem: 'cyclic' }, { kind: 'circleTheorem', theorem: 'tangent' },
  { kind: 'numberLine', min: -5, max: 5, intervals: [{ from: -2, to: null, fromOpen: true }], points: [{ value: 3, open: true, label: 'x=3' }] },
  { kind: 'tree', branches: [{ label: 'R', p: [2, 5], children: [{ label: 'R', p: [1, 4] }, { label: 'B', p: [3, 4] }] }, { label: 'B', p: [3, 5], children: [{ label: 'R', p: [2, 4] }, { label: 'B', p: [2, 4] }] }] },
  { kind: 'venn', sets: 2, counts: { A: 12, B: 7, AB: 5, none: 6 }, labels: ['A', 'B'] },
  { kind: 'venn', sets: 3, counts: { A: 3, B: 2, C: 4, AB: 1, AC: 2, BC: 1, ABC: 1, none: 5 } },
  { kind: 'table', rows: ['Girls', 'Boys'], cols: ['Walk', 'Bus'], cells: [[12, 8], [9, 11]] },
  { kind: 'histogram', data: [1, 2, 2, 3, 3, 3, 4, 4, 5, 6, 6, 7], start: 0, width: 2 }, { kind: 'boxPlot', data: [2, 4, 4, 5, 7, 9, 10] },
  { kind: 'normal', mu: 70, sigma: 5, from: 65, to: 80, mode: 'x' },
  { kind: 'vector', vectors: [{ dx: 3, dy: 1, label: '\\mathbf{a}' }, { dx: 1, dy: 3, label: '\\mathbf{b}' }] },
  { kind: 'sequence', first: 2, step: 3, n: 6 }, { kind: 'sequence', type: 'geometric', first: 3, step: 2, n: 6 },
  { kind: 'compound', principal: 1000, rate: 0.05, years: 10 },
  { kind: 'timeline', events: [{ t: 0, amount: -500 }, { t: 1, amount: 200 }, { t: 2, amount: 200 }, { t: 3, amount: 200 }] },
  { kind: 'network', nodes: [{ id: 'A', x: 0, y: 0 }, { id: 'B', x: 4, y: 2 }, { id: 'C', x: 4, y: -2 }, { id: 'D', x: 8, y: 0 }], edges: [{ from: 'A', to: 'B', weight: 5 }, { from: 'A', to: 'C', weight: 3 }, { from: 'B', to: 'D', weight: 4 }, { from: 'C', to: 'D', weight: 6 }], path: ['A', 'B', 'D'] },
  { kind: 'scatter', points: [[1, 2], [2, 3], [3, 5], [4, 4], [5, 6]], line: 'fit', xLabel: 'x', yLabel: 'y' },
  { kind: 'solid', shape: 'rectPrism', l: 4, w: 3, h: 5 }, { kind: 'solid', shape: 'cylinder', r: 2, h: 5 }, { kind: 'solid', shape: 'cone', r: 2, h: 5 },
  { kind: 'solid', shape: 'sphere', r: 2 }, { kind: 'solid', shape: 'pyramid', l: 4, w: 3, h: 5 },
  { kind: 'secantTangent', expr: 'x^2', x0: 1, h: 1 }, { kind: 'riemann', expr: 'x^2', a: 0, b: 3, n: 6, mode: 'left' }
];
const INTERACTIVE = [
  { kind: 'transform', base: 'quadratic' }, { kind: 'transform', base: 'linear', show: ['a', 'k'], names: { a: 'm (gradient)', k: 'c (y-intercept)' } },
  { kind: 'unitCircleDrag', initial: 30 }, { kind: 'secantToTangent', expr: 'x^2', x0: 1 }, { kind: 'riemannSlider', expr: 'x^2', a: 0, b: 3 },
  { kind: 'normalZ' }, { kind: 'compoundExplorer', principal: 1000 }
];

function Gallery() {
  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '0 16px 48px', background: 'var(--in-base)', color: 'var(--in-tx)' }}>
      <h1>Diagram kit</h1>
      <section aria-labelledby="g-static"><h2 id="g-static">Static</h2>{STATIC.map((spec, i) => <div key={i} data-case={`static-${i}`}><DiagramFromSpec spec={spec} /></div>)}</section>
      <section aria-labelledby="g-interactive"><h2 id="g-interactive">Interactive</h2>{INTERACTIVE.map((spec, i) => <div key={i} data-case={`interactive-${i}`}><DiagramFromSpec spec={spec} interactive /></div>)}</section>
    </main>
  );
}
document.documentElement.classList.add('ui-instrument');
createRoot(document.getElementById('root')).render(<Gallery />);
