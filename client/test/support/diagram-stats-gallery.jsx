// A page that draws every kind of the stats diagram pack, static and interactive,
// for client/test/diagram-pack-stats-browser-check.mjs. Test support only: it is not
// part of the app, and nothing in the app imports it.
import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/instrument/instrument.css';
import DiagramFromSpec from '../../src/diagrams/DiagramFromSpec.jsx';

const STATIC = [
  { kind: 'barChart', categories: ['Walk', 'Bus', 'Car', 'Bike'], values: [12, 8, 5, 3], yLabel: 'Students' },
  { kind: 'barChart', categories: ['Mon', 'Tue', 'Wed'], values: [3, 4, 6], dual: { values: [5, 2, 6], label: 'Week 2' }, label: 'Week 1' },
  { kind: 'barChart', categories: ['Mathematics', 'English', 'Science'], values: [24, 17, 9], horizontal: true },
  { kind: 'barChart', categories: ['Jan', 'Feb', 'Mar', 'Apr'], values: [-3, 2, 7, -1], yLabel: 'Temperature' },
  { kind: 'barChart', categories: Array.from({ length: 16 }, (_, i) => `Category ${i + 1}`), values: Array.from({ length: 16 }, (_, i) => (i * 7) % 11 + 1) },
  { kind: 'pieChart', categories: ['Rent', 'Food', 'Savings'], values: [1, 1, 2] },
  { kind: 'pieChart', categories: Array.from({ length: 12 }, (_, i) => `Item ${i + 1}`), values: [30, 1, 1, 1, 1, 1, 30, 1, 1, 1, 1, 1] },
  { kind: 'pascal', rows: 5, highlight: [[5, 2]] },
  { kind: 'pascal', rows: 12, highlight: [[12, 6]] },
  { kind: 'pascal', rows: 4, show: 'binomial', highlight: [[4, 2]] },
  { kind: 'binomial', n: 4, p: 0.5, highlight: [2] },
  { kind: 'binomial', n: 30, p: 0.3, highlight: { atLeast: 12 } }
];
const INTERACTIVE = [
  { kind: 'binomialExplorer', n: 10, p: 0.3, highlight: { atLeast: 8 } },
  { kind: 'probabilitySim', experiment: 'twoDiceSum', event: [7], seed: 3 },
  { kind: 'probabilitySim', experiment: 'die', seed: 1 },
  { kind: 'probabilitySim', experiment: 'spinner', sectors: [{ label: 'Red', weight: 1 }, { label: 'Blue', weight: 2 }, { label: 'Green', weight: 3 }], seed: 11 },
  { kind: 'dataExplorer', data: [2, 4, 4, 5, 7, 9, 10], editable: [6] }
];

function Gallery() {
  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '0 16px 48px', background: 'var(--in-base)', color: 'var(--in-tx)' }}>
      <h1>Stats pack</h1>
      <section aria-labelledby="g-static"><h2 id="g-static">Static</h2>{STATIC.map((spec, i) => <div key={i} data-case={`static-${i}`}><DiagramFromSpec spec={spec} /></div>)}</section>
      <section aria-labelledby="g-interactive"><h2 id="g-interactive">Interactive</h2>{INTERACTIVE.map((spec, i) => <div key={i} data-case={`interactive-${i}`}><DiagramFromSpec spec={spec} interactive /></div>)}</section>
    </main>
  );
}
document.documentElement.classList.add('ui-instrument');
createRoot(document.getElementById('root')).render(<Gallery />);
