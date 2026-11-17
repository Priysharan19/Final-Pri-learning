// A page that draws every kind in the diagram pack "space", static and interactive, for
// client/test/diagram-pack-space-browser-check.mjs. Test support only: nothing in the app imports it.
import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/instrument/instrument.css';
import DiagramFromSpec from '../../src/diagrams/DiagramFromSpec.jsx';

const STATIC = [
  { kind: 'argand', points: [{ re: -1, im: 1 }, { re: 3, im: 4, label: 'w' }], modArg: true },
  { kind: 'argand', points: [{ re: 1, im: 1 }], multiply: { re: 1, im: -1 }, modArg: true },
  { kind: 'argand', roots: 6 },
  { kind: 'matrix2d', m: [[2, 1], [1, 3]] }, { kind: 'matrix2d', m: [[0, 1], [1, 0]] },
  { kind: 'space3d', points: [{ x: 2, y: 3, z: 4, label: 'P' }], vectors: [{ to: [1, 2, 2], label: '\\mathbf{v}' }] },
  { kind: 'space3d', planes: [{ n: [2, 1, 2], d: 6, label: '\\Pi' }], lines: [{ point: [1, 0, 0], dir: [0, 1, 1], label: 'L' }] },
  { kind: 'space3d', points: [{ x: 3, y: 4, z: 2, label: 'Q' }], box: true }
];
const INTERACTIVE = [
  { kind: 'argandExplorer', mode: 'polar', points: [{ re: 1, im: 1 }] },
  { kind: 'argandExplorer', mode: 'multiply', points: [{ re: 1, im: 1 }], multiply: { re: 0, im: 1 } },
  { kind: 'argandExplorer', mode: 'roots', roots: 3 },
  { kind: 'vectorExplorer', a: [3, 1], b: [1, 2], mode: 'sum' },
  { kind: 'vectorExplorer', a: [3, 1], b: [1, 2], mode: 'dot' },
  { kind: 'matrixTransform', m: [[2, 1], [1, 3]] },
  { kind: 'solidExplorer', shape: 'cone', r: 3, h: 4 },
  { kind: 'solidExplorer', shape: 'hemisphere', r: 3 }
];

function Gallery() {
  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '0 16px 48px', background: 'var(--in-base)', color: 'var(--in-tx)' }}>
      <h1>Diagram pack: space</h1>
      <section aria-labelledby="g-static"><h2 id="g-static">Static</h2>{STATIC.map((spec, i) => <div key={i} data-case={`static-${i}`}><DiagramFromSpec spec={spec} /></div>)}</section>
      <section aria-labelledby="g-interactive"><h2 id="g-interactive">Interactive</h2>{INTERACTIVE.map((spec, i) => <div key={i} data-case={`interactive-${i}`}><DiagramFromSpec spec={spec} interactive /></div>)}</section>
    </main>
  );
}
document.documentElement.classList.add('ui-instrument');
createRoot(document.getElementById('root')).render(<Gallery />);
