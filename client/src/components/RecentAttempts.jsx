// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · "Your recent attempts" beside a Practice question
//
// The last five attempts at the current topic, read from the same list Scripts
// shows (POST /history/list, filtered to the topic), each with the two things
// Scripts offers: open the marked attempt there, and try the question again
// (same numbers or fresh ones, through the one retry path in historyRetry.js).
// Closed until asked for, signed-in accounts only, below the question so it
// never moves the question or the Submit bar.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { useT } from '../i18n/index.js';
import { formatDate } from '../lib/locale.js';
import MarkStrip from '../instrument/MarkStrip.jsx';
import { retryServe } from '../pages/historyRetry.js';

export const RECENT_COUNT = 5;

export default function RecentAttempts({ subtopic, onServe }) {
  const { user, toast } = useApp();
  const t = useT();
  const nav = useNavigate();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(null);     // null = not asked / loading
  const [failed, setFailed] = useState(false);
  const asked = useRef(null);

  useEffect(() => {
    if (!open || asked.current === subtopic) return undefined;
    asked.current = subtopic;
    let live = true;
    setRows(null); setFailed(false);
    api.post('/history/list', { filter: 'all', sort: 'newest', subtopic, page: 0, pageSize: RECENT_COUNT })
      .then(r => { if (live) setRows((r?.items || []).slice(0, RECENT_COUNT)); })
      .catch(() => { if (live) { setFailed(true); asked.current = null; } });
    return () => { live = false; };
  }, [open, subtopic]);

  if (!user?.cloudLinked || !subtopic || subtopic === 'custom') return null;

  async function again(id, variant) {
    try { onServe(await retryServe(id, variant, t)); } catch (e) { toast(<span>{e.message}</span>); }
  }

  return (
    <section className="q-recent" data-recent-attempts aria-label={t('recent.title')}>
      <button type="button" className="btn btn-quiet btn-sm q-recent-toggle" data-tour="history"
        aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(o => !o)}>
        {t('recent.title')}
      </button>
      <div id={panelId} hidden={!open}>
        {open && failed && <p className="muted" role="status">{t('recent.failed')}</p>}
        {open && !failed && rows === null && <p className="muted" role="status">{t('common.loading')}</p>}
        {open && rows && rows.length === 0 && <p className="muted" data-recent-empty>{t('recent.empty')}</p>}
        {open && rows && rows.length > 0 && (
          <ul className="q-recent-list">
            {rows.map(item => {
              const when = formatDate(item.answeredAt, user);
              const result = item.correct ? t('app.correct') : item.correct === false ? t('app.incorrect') : t('history.notMarked');
              return (
              <li key={item.id} className="q-recent-row" data-recent-id={item.id}>
                <time className="muted" dateTime={item.answeredAt}>{formatDate(item.answeredAt, user)}</time>
                <span className="q-recent-result">
                  {!item.repeat && Number.isInteger(item.marksPossible) && <MarkStrip earned={item.marksEarned} possible={item.marksPossible} />}
                  <span className={`hist-verdict ${item.correct ? 'good' : item.correct === false ? 'bad' : ''}`}>
                    {item.correct ? t('app.correct') : item.correct === false ? t('app.incorrect') : t('history.notMarked')}
                  </span>
                </span>
                <span className="q-recent-actions">
                  <button type="button" className="btn btn-ghost btn-sm" data-recent-open aria-label={t('recent.openLabel', { date: when, result })}
                    onClick={() => nav(`/history?subtopic=${encodeURIComponent(subtopic)}&open=${encodeURIComponent(item.id)}`)}>{t('recent.open')}</button>
                  {item.canRetry && (
                    <button type="button" className="btn btn-ghost btn-sm" data-recent-same aria-label={t('recent.tryAgainLabel', { date: when, result })} title={t('history.retrySameTitle')}
                      onClick={() => again(item.id, 'same')}>{t('recent.tryAgain')}</button>
                  )}
                </span>
              </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
