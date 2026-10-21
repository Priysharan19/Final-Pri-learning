import React, { useMemo } from 'react';
import { useT } from '../i18n/index.js';
import PriPlot from '../components/PriPlot.jsx';
import { plotSpecFromReading } from './studentPlot.js';

// The student's own equations, as Pri read them, drawn — display only. It
// shows nothing unless a line is `y = f(x)` (drawn as written) or verified
// linear in x and y at off-grid points (instrument/studentPlot.js), refuses
// costly operators, and says plainly that it is a drawing of the reading, not
// a mark.
export default function ReadingPlot({ lines }) {
  const t = useT();
  const spec = useMemo(() => plotSpecFromReading((lines || []).map(l => l?.text ?? l)), [lines]);
  const reduce = useMemo(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, []);
  if (!spec) return null;
  return (
    <figure className="in-reading-plot" data-reading-plot={spec.fns.length}>
      <figcaption>{t('inst.plotTitle')}</figcaption>
      <PriPlot spec={spec} reduceMotion={reduce} progress={1} />
      <p className="in-note">{t('inst.plotNote')}</p>
    </figure>
  );
}
