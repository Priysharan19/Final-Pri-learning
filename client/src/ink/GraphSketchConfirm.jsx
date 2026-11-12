// Pri Learning · the student confirms what was read from their sketched graph
// before Check, as a line reading is confirmed. Nothing is judged from the
// proposal itself: onConfirm receives confirmGraphFeatures(proposal, edits).
import { useState } from 'react';
import { confirmGraphFeatures, parseLines, parsePoints, parseValues, showValues } from './graphSketch.js';
import { useT } from '../i18n/index.js';

const pointText = ps => ps.map(p => `(${showValues([p.x])}, ${showValues([p.y])})`).join(', ');
const lineText = ls => ls.map(l => `${l.axis} = ${showValues([l.value])}`).join(', ');
const valueText = vs => (vs.length ? showValues(vs) : '');

export const GRAPH_ROWS = [
  { key: 'interceptsX', label: 'graph.xIntercepts', get: p => p.intercepts.x, show: valueText, parse: parseValues, hint: 'graph.hintValues' },
  { key: 'interceptsY', label: 'graph.yIntercepts', get: p => p.intercepts.y, show: valueText, parse: parseValues, hint: 'graph.hintValues' },
  { key: 'turning', label: 'graph.turning', get: p => p.turning, show: pointText, parse: parsePoints, hint: 'graph.hintPoints' },
  { key: 'asymptotes', label: 'graph.asymptotes', get: p => p.asymptotes, show: lineText, parse: parseLines, hint: 'graph.hintLines' }
];

export default function GraphSketchConfirm({ proposal, onConfirm, onRedraw, confirmed = false }) {
  const t = useT();
  const [edits, setEdits] = useState({});
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState('');
  const [problem, setProblem] = useState('');
  if (!proposal) return null;
  const value = row => edits[row.key] ?? row.get(proposal);
  const save = row => {
    const v = row.parse(draft);
    if (v === null) { setProblem(row.hint); return; }
    setEdits(e => ({ ...e, [row.key]: v })); setEditing(null); setProblem('');
  };
  return (
    <section className="graph-confirm" data-graph-confirm aria-label={t('graph.confirmAria')}>
      <p>{t('graph.confirmIntro')}</p>
      {proposal.reasons.length > 0 && <ul data-graph-reasons>{proposal.reasons.map(r => <li key={r}>{r}</li>)}</ul>}
      <dl>
        {GRAPH_ROWS.map(row => (
          <div key={row.key} data-graph-row={row.key}>
            <dt>{t(row.label)}</dt>
            {editing === row.key ? (
              <dd>
                <input aria-label={t(row.label)} value={draft} onChange={e => setDraft(e.target.value)} />
                <button type="button" className="btn btn-quiet btn-sm" onClick={() => save(row)}>{t('graph.save')}</button>
                {problem && <span role="alert">{t(problem)}</span>}
              </dd>
            ) : (
              <dd>
                {row.show(value(row)) || t('graph.none')}
                <button type="button" className="btn btn-quiet btn-sm" disabled={confirmed}
                  onClick={() => { setEditing(row.key); setProblem(''); setDraft(row.show(value(row))); }}>{t('graph.edit')}</button>
              </dd>
            )}
          </div>
        ))}
      </dl>
      {confirmed
        ? <p role="status" data-graph-confirmed>{t('graph.confirmed')}</p>
        : <button type="button" className="btn btn-sm" data-graph-confirm-accept disabled={editing !== null} onClick={() => onConfirm?.(confirmGraphFeatures(proposal, edits))}>{t('graph.accept')}</button>}
      {onRedraw && !confirmed && <button type="button" className="btn btn-quiet btn-sm" onClick={onRedraw}>{t('graph.redraw')}</button>}
    </section>
  );
}
