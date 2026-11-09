import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { MathText } from '../lib/latex.jsx';
import { formatDate } from '../lib/locale.js';
import { useApp } from '../App.jsx';
import { useT } from '../i18n/index.js';
import TermGloss from './TermGloss.jsx';
import { isEntitlementGate } from '../local/entitlementGate.js';
import { PAYWALL_ROUTE } from '../paywall/route.js';
import { normalizeNotebook, notebookSections, slipLabel } from '../notebook/notebookView.js';

// The mistake notebook. Everything on it is the server's (engine/
// mistakeNotebook.js, GET /practice/notebook): which wrong answers are filed,
// the first broken line and the examiner's note the deterministic step check
// reported, whether a later twin fixed the mistake, and when it is next due
// for review. A slip the marker recognised is named; a wrong answer it named
// nothing in is filed under its topic, and nothing here invents a slip for it.
// "Try a twin" asks the server for a new question of the same kind on the same
// dot point, which the practice page receives the way a History retry is.
// The notebook is the same on every plan.
function NotebookEntry({ item, user, t, onTwin, busy }) {
  const fe = item.firstError;
  return (
    <li data-notebook-item={item.id} data-notebook-due={item.review.due ? '' : undefined} data-notebook-fixed={item.fixed ? '' : undefined} className="notebook-item">
      {item.prompt && <div className="notebook-prompt" lang="en"><MathText text={item.prompt} /></div>}
      {fe && (
        <div className="notebook-first-error" data-notebook-first-error>
          <span className="sc-label">{fe.line ? t('notebook.firstErrorLine', { n: fe.line }) : t('notebook.firstError')}</span>{' '}
          <span lang="en"><MathText text={fe.text} /></span>
          {fe.note && <div className="muted" lang="en">{fe.note}</div>}
        </div>
      )}
      <div className="notebook-meta">
        {item.marksPossible > 0 && <span className="muted">{t('notebook.marks', { earned: item.marksEarned, possible: item.marksPossible })}</span>}
        {item.fixed
          ? <span className="chip" data-notebook-state="fixed">{t('notebook.fixed')}</span>
          : item.review.due
            ? <span className="chip" data-notebook-state="due">{t('notebook.dueNow')}</span>
            : item.review.dueAt ? <span className="muted" data-notebook-state="scheduled">{t('notebook.dueOn', { when: formatDate(item.review.dueAt, user) })}</span> : null}
        {item.dotpointText && <span className="muted" lang="en">{item.dotpointText}</span>}
        <span className="muted">{formatDate(item.answeredAt, user)}</span>
        {item.canTwin && !item.fixed && (
          <button type="button" className="btn btn-ghost btn-sm" data-notebook-twin disabled={busy} title={t('notebook.twinTitle')} onClick={() => onTwin(item.id)}>{t('notebook.twin')}</button>
        )}
      </div>
    </li>
  );
}

export default function ErrorNotebook() {
  const { user, toast } = useApp();
  const t = useT();
  const nav = useNavigate();
  const [book, setBook] = useState(null);
  const [openKey, setOpenKey] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    api.get('/notebook')
      .then(r => { if (live) setBook(normalizeNotebook(r)); })
      .catch(() => { if (live) setBook(normalizeNotebook({ available: false, reason: 'offline' })); });
    return () => { live = false; };
  }, [user?.id]);

  async function twin(id) {
    setBusy(true);
    try {
      const r = await api.post(`/notebook/${id}/twin`, {});
      nav('/practice', { state: { serve: { question: r.question, reason: 'retry', why: t(r.twin?.sameDotpoint ? 'notebook.whyTwin' : 'notebook.whyTwinLoose') } } });
    } catch (e) {
      // A twin is a question of the free day (D19), and JEE Advanced's own
      // questions are Premium: the one Premium screen explains either.
      if (isEntitlementGate(e)) nav(PAYWALL_ROUTE, { state: { from: e.capability === 'jee-advanced-content' ? 'jee-advanced' : 'practice' } });
      else toast(<span>{t('notebook.twinFailed')}</span>);
    } finally { setBusy(false); }
  }

  if (!book) return null;
  const sections = notebookSections(book);

  return (
    <section className="card notebook" data-error-notebook data-mistake-notebook aria-labelledby="notebook-title">
      <h2 id="notebook-title" className="notebook-title">{t('notebook.title')}</h2>
      <p className="muted notebook-how">{t('notebook.how')}</p>
      {book.available === false && <p className="muted notebook-empty">{t(book.reason === 'sign-in' ? 'notebook.signIn' : 'notebook.offline')}</p>}
      {book.available !== false && book.dueCount > 0 && (
        <p className="notebook-due" data-notebook-due-count={book.dueCount}><b>{t('notebook.dueCount', { n: book.dueCount, count: book.dueCount })}</b></p>
      )}
      {book.available !== false && !sections.length && <p className="muted notebook-empty">{t('notebook.empty')}</p>}
      {sections.length > 0 && (
        <ul className="notebook-groups">
          {sections.map(topic => (
            <li key={topic.subtopic} data-notebook-topic={topic.subtopic} className="notebook-group">
              <div className="sc-label notebook-chapter" lang="en">{topic.chapterName ? <TermGloss text={topic.chapterName} /> : topic.subtopic}</div>
              <ul className="notebook-items">
                {topic.groups.map(g => {
                  const open = openKey === g.key || (openKey === null && g.due > 0);
                  return (
                    <li key={g.key} data-notebook-group={g.key}>
                      <button type="button" className="notebook-head" aria-expanded={open} onClick={() => setOpenKey(open ? '' : g.key)}>
                        <span className="notebook-slip">{slipLabel(g, t)}</span>
                        {g.due > 0 && <span className="chip">{t('notebook.dueCount', { n: g.due, count: g.due })}</span>}
                        <span className="muted notebook-count">{t('notebook.times', { n: g.items.length, count: g.items.length })}</span>
                      </button>
                      {open && (
                        <ul className="notebook-items">
                          {g.items.map(item => <NotebookEntry key={item.id} item={item} user={user} t={t} onTwin={twin} busy={busy} />)}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
