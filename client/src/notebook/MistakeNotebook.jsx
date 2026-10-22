import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { MathText } from '../lib/latex.jsx';
import { formatDate } from '../lib/locale.js';
import { useApp } from '../App.jsx';
import { useT } from '../i18n/index.js';
import TermGloss from '../components/TermGloss.jsx';
import PageLink from '../components/PageLink.jsx';
import { normalizeNotebook, notebookSections, premiumLine, firstErrorLine } from './notebookView.js';
import { readMistakeInk } from './inkStore.js';
import { PAYWALL_ROUTE } from '../paywall/route.js';

// The mistake notebook. Everything on it is the server's: which wrong answers
// are filed, the examiner's first broken line and note, whether a later retry
// fixed the mistake, and when it is next due for review
// (engine/mistakeNotebook.js, GET /v1/practice/notebook). The only thing this
// device adds is the student's own ink, kept locally when the answer was
// marked wrong (notebook/inkStore.js) — the server stores no pictures.
//
// The free plan is sent the newest few mistakes and only a COUNT of the rest;
// the screen says that count plainly and links to Premium. Nothing is blurred,
// because nothing else was sent.

/** The student's own strokes, drawn small. Display only. */
export function InkSnapshot({ ink, label }) {
  if (!ink?.strokes?.length) return null;
  const pad = 4;
  return (
    <svg className="mistake-ink" role="img" aria-label={label} data-mistake-ink
      viewBox={`${-pad} ${-pad} ${ink.w + pad * 2} ${ink.h + pad * 2}`}
      style={{ width: '100%', maxWidth: Math.min(ink.w + pad * 2, 320), maxHeight: 160, display: 'block', background: 'var(--paper)', border: '1px solid var(--hairline)', borderRadius: 'var(--radius)' }}>
      {ink.strokes.map((pts, i) => (
        pts.length === 1
          ? <circle key={i} cx={pts[0][0]} cy={pts[0][1]} r={1.2} fill="var(--ink)" />
          : <polyline key={i} points={pts.map(p => p.join(',')).join(' ')} fill="none" stroke="var(--ink)" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}

function NotebookEntry({ item, user, t, onTwin, busy }) {
  const [ink, setInk] = useState(null);
  useEffect(() => {
    let live = true;
    readMistakeInk(user?.id, item.id).then(row => { if (live) setInk(row); });
    return () => { live = false; };
  }, [user?.id, item.id]);
  const fe = firstErrorLine(item);
  return (
    <li data-notebook-item={item.id} data-notebook-due={item.review.due ? '' : undefined} data-notebook-fixed={item.fixed ? '' : undefined} className="notebook-item" style={{ paddingBottom: 'var(--space-3)' }}>
      {item.prompt && <div className="notebook-prompt" lang="en"><MathText text={item.prompt} /></div>}
      {ink
        ? <InkSnapshot ink={ink} label={t('notebook.yourInk')} />
        : null}
      {fe && (
        <div className="notebook-first-error" data-notebook-first-error>
          <span className="sc-label">{fe.line ? t('notebook.firstErrorLine', { n: fe.line }) : t('notebook.firstError')}</span>{' '}
          <span lang="en"><MathText text={fe.text} /></span>
          {fe.note && <div className="muted" style={{ fontSize: 'var(--text-sm)' }}>{fe.note}</div>}
        </div>
      )}
      <div className="notebook-meta row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
        {item.marksPossible > 0 && <span className="chip">{t('notebook.marks', { earned: item.marksEarned, possible: item.marksPossible })}</span>}
        {item.fixed
          ? <span className="chip" data-notebook-state="fixed">{t('notebook.fixed')}</span>
          : item.review.due
            ? <span className="chip" data-notebook-state="due">{t('notebook.dueNow')}</span>
            : item.review.dueAt ? <span className="muted">{t('notebook.dueOn', { when: formatDate(item.review.dueAt, user) })}</span> : null}
        {item.dotpointText && <span className="muted" lang="en">{item.dotpointText}</span>}
        <span className="muted">{formatDate(item.answeredAt, user)}</span>
        {item.canTwin && !item.fixed && (
          <button type="button" className="btn btn-ghost btn-sm" data-notebook-twin disabled={busy} title={t('notebook.twinTitle')} onClick={() => onTwin(item.id)}>{t('notebook.twin')}</button>
        )}
      </div>
    </li>
  );
}

// `heading` is the title's level: h1 when the notebook is the page (NotebookPage).
export default function MistakeNotebook({ heading = 'h2' }) {
  const Heading = heading === 'h1' ? 'h1' : 'h2';
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
      if (Number(e?.status) === 402) nav(PAYWALL_ROUTE, { state: { from: 'notebook' } });
      else toast(<span>{t('notebook.twinFailed')}</span>);
    } finally { setBusy(false); }
  }

  if (!book) return null;
  const sections = notebookSections(book);
  const more = premiumLine(book);
  const label = g => (g.misconception?.nameKey ? t(g.misconception.nameKey) : (g.misconception?.label || t('notebook.unnamedSlip')));

  return (
    <section className="card notebook" data-error-notebook data-mistake-notebook aria-labelledby="notebook-title">
      <Heading id="notebook-title" className="notebook-title">{t('notebook.title')}</Heading>
      <p className="muted notebook-how">{t('notebook.how')}</p>
      {book.available === false && <p className="muted notebook-empty">{t(book.reason === 'sign-in' ? 'notebook.signIn' : 'notebook.offline')}</p>}
      {book.available !== false && book.dueCount > 0 && (
        <p className="notebook-due" data-notebook-due-count={book.dueCount}><b>{t('notebook.dueCount', { n: book.dueCount, count: book.dueCount })}</b></p>
      )}
      {book.available !== false && !sections.length && !more && <p className="muted notebook-empty">{t('notebook.empty')}</p>}
      {sections.length > 0 && (
        <ul className="notebook-groups">
          {sections.map(topic => (
            <li key={topic.subtopic} data-notebook-topic={topic.subtopic} className="notebook-group">
              <div className="sc-label" style={{ paddingTop: 'var(--space-3)' }} lang="en">
                {topic.chapterName ? <TermGloss text={topic.chapterName} /> : topic.subtopic}
              </div>
              <ul className="notebook-items">
                {topic.groups.map(g => {
                  const open = openKey === g.key || (openKey === null && g.due > 0);
                  return (
                    <li key={g.key} data-notebook-group={g.key}>
                      <button type="button" className="notebook-head" aria-expanded={open} onClick={() => setOpenKey(open ? '' : g.key)}>
                        <span className="notebook-slip">{label(g)}</span>
                        {g.due > 0 && <span className="chip">{t('notebook.dueCount', { n: g.due, count: g.due })}</span>}
                        <span className="muted notebook-count">{t('notebook.times', { n: g.count, count: g.count })}</span>
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
      {more && (
        <p className="muted" data-notebook-premium-line style={{ marginTop: 'var(--space-3)' }}>
          {t(more.key, more.vars)}{' '}
          <PageLink to={PAYWALL_ROUTE} state={{ from: 'notebook' }}>{t('notebook.seeFull')}</PageLink>
        </p>
      )}
    </section>
  );
}
