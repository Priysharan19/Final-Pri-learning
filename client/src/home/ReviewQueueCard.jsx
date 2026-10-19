import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useT } from '../i18n/index.js';
import TermGloss from '../components/TermGloss.jsx';

// Dot points due for review. GET /reviews carries a `dotpoints` block that the
// server derives from this account's own server-marked attempts
// (engine/reviewQueue.js); signed out or offline it is null and this card
// renders nothing. It is a support card: it never holds the page's primary
// action, and says plainly that recall is an estimate.
export default function ReviewQueueCard({ user, limit = 4 }) {
  const t = useT();
  const nav = useNavigate();
  const [queue, setQueue] = useState(null);
  useEffect(() => {
    let live = true;
    api.get('/reviews').then(r => { if (live) setQueue(r?.dotpoints || null); }).catch(() => { if (live) setQueue(null); });
    return () => { live = false; };
  }, [user?.id]);
  if (!queue || !queue.due?.length) return null;
  const n = queue.dueCount || queue.due.length;
  return (
    <article className="home-card review-queue" data-review-queue-card aria-labelledby="review-queue-title">
      <span className="sc-label">{t('review.dueTodayKicker')}</span>
      <h3 id="review-queue-title" className="review-queue-title">{t('review.dueToday', { n, count: n })}</h3>
      <p className="muted review-queue-why">{t('review.dueTodayWhy')}</p>
      <ul className="review-queue-list">
        {queue.due.slice(0, limit).map(r => (
          <li key={r.id} data-review-dotpoint={r.id} className="review-queue-row">
            <span className="review-queue-name">
              <span lang="en"><TermGloss text={r.chapterName || r.subtopic} /></span>
              {r.text && <span className="muted review-queue-text" lang="en">{r.text}</span>}
              <span className="muted review-queue-recall">
                {t('review.recall', { percent: Math.round(r.recall * 100) })}
                {r.overdueDays >= 1 ? ` · ${t('review.overdue', { n: Math.round(r.overdueDays), count: Math.round(r.overdueDays) })}` : ''}
              </span>
            </span>
            <button type="button" className="btn btn-ghost btn-sm" data-review-go onClick={() => nav(r.href)}>{t('review.practise')}</button>
          </li>
        ))}
      </ul>
    </article>
  );
}
