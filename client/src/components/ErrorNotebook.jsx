import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { MathText } from '../lib/latex.jsx';
import { formatDate } from '../lib/locale.js';
import { useApp } from '../App.jsx';
import { useT } from '../i18n/index.js';
import TermGloss from './TermGloss.jsx';

// The error notebook (§6.7): every wrong practice answer, filed under the
// misconception the marker named — or under its chapter when no designed trap
// or Step Check diagnosis fired — with a "retry a twin" button. A twin is the
// same generator at the same difficulty on the same dot point with a new
// seed, drawn by POST /notebook/:id/twin; the practice page receives it the
// same way a History retry is received.
export default function ErrorNotebook() {
  const { user, toast } = useApp();
  const t = useT();
  const nav = useNavigate();
  const [entries, setEntries] = useState(null);
  const [openKey, setOpenKey] = useState(null);

  useEffect(() => {
    let live = true;
    api.get('/notebook').then(r => { if (live) setEntries(r?.entries || []); }).catch(() => { if (live) setEntries([]); });
    return () => { live = false; };
  }, [user?.id]);

  async function twin(id) {
    try {
      const r = await api.post(`/notebook/${id}/twin`, {});
      nav('/practice', { state: { serve: { question: r.question, reason: 'retry', why: t(r.twin?.sameDotpoint ? 'notebook.whyTwin' : 'notebook.whyTwinLoose') } } });
    } catch (e) { toast(<span>⚠️ {e.message}</span>); }
  }

  if (!entries) return null;
  const label = g => (g.misconception
    ? (g.misconception.nameKey ? t(g.misconception.nameKey) : (g.misconception.label || t('notebook.unnamedSlip')))
    : t('notebook.noNamedSlip'));

  return (
    <section className="card" data-error-notebook aria-labelledby="notebook-title" style={{ padding: '14px 16px' }}>
      <div className="spread" style={{ alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <h2 id="notebook-title" style={{ margin: 0, fontSize: 17 }}>{t('notebook.title')}</h2>
        <span className="chip">{t('notebook.count', { n: entries.reduce((a, g) => a + g.count, 0), count: entries.reduce((a, g) => a + g.count, 0) })}</span>
      </div>
      <p className="muted" style={{ margin: '4px 0 10px', fontSize: 13, lineHeight: 1.45 }}>{t('notebook.how')}</p>
      {!entries.length && <p className="muted" style={{ margin: 0 }}>{t('notebook.empty')}</p>}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
        {entries.map(g => {
          const open = openKey === g.key;
          return (
            <li key={g.key} data-notebook-group={g.key} style={{ border: '1px solid var(--hairline)', borderRadius: 4 }}>
              <button type="button" className="hist-main" style={{ width: '100%', textAlign: 'left', padding: '10px 12px' }}
                aria-expanded={open} onClick={() => setOpenKey(open ? null : g.key)}>
                <div className="hist-top" style={{ gap: 8 }}>
                  <span style={{ fontWeight: 600 }}>{label(g)}</span>
                  <span className="tag" lang="en"><TermGloss text={g.chapterName} /></span>
                  <span className="muted" style={{ marginLeft: 'auto', fontSize: 12.5, whiteSpace: 'nowrap' }}>{t('notebook.times', { n: g.count, count: g.count })}</span>
                </div>
              </button>
              {open && (
                <ul style={{ listStyle: 'none', padding: '0 12px 10px', margin: 0, display: 'grid', gap: 8 }}>
                  {g.items.map(item => (
                    <li key={item.id} data-notebook-item={item.id} style={{ display: 'grid', gap: 4 }}>
                      <div className="hist-prompt"><MathText text={item.prompt} /></div>
                      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        {item.dotpointText && <span className="muted" lang="en" style={{ fontSize: 12.5 }}>{item.dotpointText}</span>}
                        <span className="tag">{`D${item.difficulty}`}</span>
                        <span className="muted" style={{ fontSize: 12 }}>{formatDate(item.answeredAt, user)}</span>
                        {item.canTwin && (
                          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} data-notebook-twin
                            title={t('notebook.twinTitle')} onClick={() => twin(item.id)}>{t('notebook.twin')}</button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
