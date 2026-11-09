// Pri Learning · the student confirms what was read from their sketched graph
// before Check, as a line reading is confirmed. Nothing is marked from the
// proposal itself: onConfirm receives confirmGraphFeatures(proposal, edits).
import { useState } from 'react';
import { confirmGraphFeatures, parseValues, showValues } from './graphSketch.js';

const ROWS = [
  ['interceptsX', 'x-intercepts', p => p.intercepts.x],
  ['interceptsY', 'y-intercepts', p => p.intercepts.y]
];

export default function GraphSketchConfirm({ proposal, onConfirm, onRedraw }) {
  const [edits, setEdits] = useState({});
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState('');
  const [problem, setProblem] = useState('');
  if (!proposal) return null;
  const save = key => {
    const v = parseValues(draft);
    if (v === null) { setProblem('Write numbers separated by commas, for example −2, 3'); return; }
    setEdits(e => ({ ...e, [key]: v })); setEditing(null); setProblem('');
  };
  return (
    <section className="graph-confirm" data-graph-confirm aria-label="What we read from your graph">
      <p>Check what we read from your graph. Fix anything that is wrong before Check.</p>
      {proposal.reasons.length > 0 && <ul data-graph-reasons>{proposal.reasons.map(r => <li key={r}>{r}</li>)}</ul>}
      <dl>
        {ROWS.map(([key, label, get]) => (
          <div key={key} data-graph-row={key}>
            <dt>{label}</dt>
            {editing === key ? (
              <dd>
                <input aria-label={label} value={draft} onChange={e => setDraft(e.target.value)} />
                <button type="button" onClick={() => save(key)}>Save</button>
                {problem && <span role="alert">{problem}</span>}
              </dd>
            ) : (
              <dd>
                {showValues(edits[key] ?? get(proposal))}
                <button type="button" onClick={() => { setEditing(key); setDraft(showValues(edits[key] ?? get(proposal)).replace(/^none$/, '')); }}>Edit</button>
              </dd>
            )}
          </div>
        ))}
        <div data-graph-row="turning"><dt>turning points</dt><dd>{proposal.turning.length ? proposal.turning.map(t => `${t.kind} (${showValues([t.x])}, ${showValues([t.y])})`).join('; ') : 'none'}</dd></div>
        <div data-graph-row="asymptotes"><dt>asymptotes</dt><dd>{proposal.asymptotes.length ? proposal.asymptotes.map(a => `${a.axis} = ${showValues([a.value])}`).join('; ') : 'none'}</dd></div>
      </dl>
      <button type="button" data-graph-confirm-accept disabled={editing !== null} onClick={() => onConfirm?.(confirmGraphFeatures(proposal, edits))}>These are right</button>
      {onRedraw && <button type="button" onClick={onRedraw}>Redraw</button>}
    </section>
  );
}
