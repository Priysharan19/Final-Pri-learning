import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { MathText } from '../lib/latex.jsx';
import { formatDate } from '../lib/locale.js';
import { useApp } from '../App.jsx';
import { useT } from '../i18n/index.js';
import TermGloss from './TermGloss.jsx';

// The error notebook. The server files a wrong answer only under a slip its
// deterministic marker recognised (server/platform/practice.js GET
// /practice/notebook); a wrong answer it recognised nothing in is not filed,
// and nothing here invents one. "Try a twin" asks the server for a new
// question of the same kind on the same dot point, which the practice page
// receives the way a History retry is received.
export default function ErrorNotebook() {
  const { user, toast } = useApp();
  const t = useT();
  const nav = useNavigate();
  const [book, setBook] = useState(null);
  const [openKey, setOpenKey] = useState(null);

  useEffect(() => {
    let live = true;
    api.get('/notebook').then(r => { if (live) setBook(r || { entries: [] }); }).catch(() => { if (live) setBook({ entries: [], available: false, reason: 'offline' }); });
    return () => { live = false; };
  }, [user?.id]);

  async function twin(id) {
    try {
      const r = await api.post(`/notebook/${id}/twin`, {});
      nav('/practice', { state: { serve: { question: r.question, reason: 'retry', why: t(r.twin?.sameDotpoint ? 'notebook.whyTwin' : 'notebook.whyTwinLoose') } } });
    } catch { toast(<span>{t('notebook.twinFailed')}</span>); }
  }

  if (!book) return null;
  const entries = book.entries || [];
  const label = g => (g.misconception?.nameKey ? t(g.misconception.nameKey) : (g.misconception?.label || t('notebook.unnamedSlip')));

  return (
    <section className="card notebook" data-error-notebook aria-labelledby="notebook-title">
      <h2 id="notebook-title" className="notebook-title">{t('notebook.title')}</h2>
      <p className="muted notebook-how">{t('notebook.how')}</p>
      {book.available === false && <p className="muted notebook-empty">{t(book.reason === 'sign-in' ? 'notebook.signIn' : 'notebook.offline')}</p>}
      {book.available !== false && !entries.length && <p className="muted notebook-empty">{t('notebook.empty')}</p>}
      {entries.length > 0 && (
        <ul className="notebook-groups">
          {entries.map(g => {
            const open = openKey === g.key;
            return (
              <li key={g.key} data-notebook-group={g.key} className="notebook-group">
                <button type="button" className="notebook-head" aria-expanded={open} onClick={() => setOpenKey(open ? null : g.key)}>
                  <span className="notebook-slip">{label(g)}</span>
                  {g.chapterNames?.[0] && <span className="muted notebook-chapter" lang="en"><TermGloss text={g.chapterNames[0]} /></span>}
                  <span className="muted notebook-count">{t('notebook.times', { n: g.count, count: g.count })}</span>
                </button>
                {open && (
                  <ul className="notebook-items">
                    {g.items.map(item => (
                      <li key={item.id} data-notebook-item={item.id} className="notebook-item">
                        {item.prompt && <div className="notebook-prompt" lang="en"><MathText text={item.prompt} /></div>}
                        <div className="notebook-meta">
                          {item.dotpointText && <span className="muted" lang="en">{item.dotpointText}</span>}
                          <span className="muted">{formatDate(item.answeredAt, user)}</span>
                          {item.canTwin && (
                            <button type="button" className="btn btn-ghost btn-sm" data-notebook-twin title={t('notebook.twinTitle')} onClick={() => twin(item.id)}>{t('notebook.twin')}</button>
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
      )}
    </section>
  );
}
