import React from 'react';
import { useT } from '../i18n/index.js';
import './margin/states.css';

// The empty first plot: a ruled graph with nothing on it yet, and the plain
// promise of what goes there. No fake points, no sample curve.
export default function EmptyPlot() {
  const t = useT();
  // Rules edge to edge: 10 columns by 5 rows, axes on the left and bottom.
  const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const ys = [1, 2, 3, 4];
  return (
    <figure className="c-empty-plot" data-empty-plot>
      <svg viewBox="0 0 320 160" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
        {xs.map(i => <line key={`x${i}`} className="c-ep-rule" x1={i * 32} y1="0" x2={i * 32} y2="160" />)}
        {ys.map(i => <line key={`y${i}`} className="c-ep-rule" x1="0" y1={i * 32} x2="320" y2={i * 32} />)}
        <line className="c-ep-axis" x1="0" y1="128" x2="320" y2="128" />
        <line className="c-ep-axis" x1="32" y1="0" x2="32" y2="160" />
      </svg>
      <figcaption>{t('inst.emptyPlot')}</figcaption>
    </figure>
  );
}
