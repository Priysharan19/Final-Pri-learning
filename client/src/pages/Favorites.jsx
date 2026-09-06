import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { MathText } from '../lib/latex.jsx';
import { useT } from '../i18n/index.js';
import TermGloss from '../components/TermGloss.jsx';

export default function Favorites() {
  const [data, setData] = useState(null);
  const nav = useNavigate();
  const t = useT();

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
        <h1 style={{ marginBottom: 18 }}>{t('favorites.title')}</h1>
        <div className="locked-wrap" style={{ border: '1px dashed var(--hairline-strong)', borderRadius: 6 }}>
          <div className="locked-card">
            <div className="locked-icon" aria-hidden="true">☆</div>
            <div className="locked-title">{t('favorites.emptyTitle')}</div>
            <div className="locked-sub">{t('favorites.emptySub')}</div>
            <button className="btn btn-ghost" onClick={() => nav('/history')}>{t('favorites.openHistory')}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="spread" style={{ marginBottom: 18 }}>
        <h1>{t('favorites.title')}</h1>
        <span className="muted">{t('favorites.saved', { count: data.items.length, n: data.items.length })}</span>
      </div>
      <div className="card card-flush">
        {data.items.map(it => (
          <div className="hist-row" key={it.id}>
            <button className="hist-star on" title={t('favorites.remove')}
              aria-label={t('favorites.removeOn', { topic: it.subtopicName })} onClick={() => unstar(it.id)}>★</button>
            <div className="hist-main" style={{ cursor: 'default' }}>
              <div className="hist-top">
                <span className={`hist-verdict ${it.correct ? 'good' : 'bad'}`}>
                  {it.correct ? '✓' : '✗'}<span className="sr-only">{t(it.correct ? 'app.correct' : 'app.incorrect')}</span>
                </span>
                <span className="hist-name"><TermGloss text={it.subtopicName} /></span>
                <span className="tag">D{it.difficulty}</span>
                {it.mode !== 'practice' && <span className="tag">{it.mode}</span>}
              </div>
              <div className="hist-prompt"><MathText text={it.prompt} /></div>
            </div>
            <div className="hist-actions">
              {it.canRetry && <button className="btn btn-ghost btn-sm" onClick={() => retry(it.id, 'same')}>{t('favorites.retrySame')}</button>}
              {it.canRetry && <button className="btn btn-ghost btn-sm" onClick={() => retry(it.id, 'fresh')}>{t('favorites.retryVariant')}</button>}
              <button className="btn btn-quiet btn-sm" onClick={() => nav(`/practice?subtopic=${it.subtopic}`)}>{t('common.topic')}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
