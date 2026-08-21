import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { MathText } from '../lib/latex.jsx';

export default function Favorites() {
  const [data, setData] = useState(null);
  const nav = useNavigate();

  const load = useCallback(() => {
    api.post('/history/list', { filter: 'bookmarked', pageSize: 100 }).then(setData).catch(() => setData({ items: [] }));
  }, []);
  useEffect(load, [load]);

  const unstar = async (id) => {
    await api.post(`/history/${id}/bookmark`, {});
    load();
  };
  const retry = async (id, variant) => {
    const r = await api.post(`/history/${id}/retry`, { variant });
    nav('/practice', { state: { serve: r } });
  };

  if (!data) return <div className="skeleton" style={{ height: 300 }} />;

  if (!data.items.length) {
    return (
      <div>
        <h1 style={{ marginBottom: 18 }}>Favorites</h1>
        <div className="locked-wrap" style={{ border: '1px dashed var(--hairline-strong)', borderRadius: 6 }}>
          <div className="locked-card">
            <div className="locked-icon" aria-hidden="true">☆</div>
            <div className="locked-title">No favorites yet</div>
            <div className="locked-sub">Star any question — from the question page or your history — and it lands here for quick revision.</div>
            <button className="btn btn-ghost" onClick={() => nav('/history')}>Open History</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="spread" style={{ marginBottom: 18 }}>
        <h1>Favorites</h1>
        <span className="muted">{data.items.length} saved question{data.items.length === 1 ? '' : 's'}</span>
      </div>
      <div className="card card-flush">
        {data.items.map(it => (
          <div className="hist-row" key={it.id}>
            <button className="hist-star on" title="Remove from favorites"
              aria-label={`Remove this ${it.subtopicName} question from favorites`} onClick={() => unstar(it.id)}>★</button>
            <div className="hist-main" style={{ cursor: 'default' }}>
              <div className="hist-top">
                <span className={`hist-verdict ${it.correct ? 'good' : 'bad'}`}>
                  {it.correct ? '✓' : '✗'}<span className="sr-only">{it.correct ? 'Correct' : 'Incorrect'}</span>
                </span>
                <span className="hist-name">{it.subtopicName}</span>
                <span className="tag">D{it.difficulty}</span>
                {it.mode !== 'practice' && <span className="tag">{it.mode}</span>}
              </div>
              <div className="hist-prompt"><MathText text={it.prompt} /></div>
            </div>
            <div className="hist-actions">
              {it.canRetry && <button className="btn btn-ghost btn-sm" onClick={() => retry(it.id, 'same')}>↻ Same</button>}
              {it.canRetry && <button className="btn btn-ghost btn-sm" onClick={() => retry(it.id, 'fresh')}>⇢ Variant</button>}
              <button className="btn btn-quiet btn-sm" onClick={() => nav(`/practice?subtopic=${it.subtopic}`)}>Topic</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
