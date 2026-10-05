import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useT } from '../i18n/index.js';
import TermGloss from '../components/TermGloss.jsx';

// "Due today", per dot point (§6.3). Reads GET /reviews, whose `dotpoints`
// block is derived by engine/reviewQueue.js from the same rating and FSRS rows
// the planner reads, so this card, the Plan page and the chapter review list
// can never disagree about what is due. Renders nothing until something is
// due: a card that says "nothing to review" on day one is noise.
export function useReviewQueue(refreshKey = null) {
  const [queue, setQueue] = useState(null);
  useEffect(() => {
    let live = true;
    api.get('/reviews').then(r => { if (live) setQueue(r?.dotpoints || { due: [], upcoming: [], dueCount: 0, counted: 0 }); })
      .catch(() => { if (live) setQueue({ due: [], upcoming: [], dueCount: 0, counted: 0 }); });
    return () => { live = false; };
  }, [refreshKey]);
  return queue;
}

export function ReviewQueueList({ items, user, limit = 5, onGo }) {
  const t = useT();
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'grid', gap: 8 }}>
      {items.slice(0, limit).map(r => (
        <li key={r.id} data-review-dotpoint={r.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontWeight: 600 }} lang="en"><TermGloss text={r.chapterName || r.subtopic} /></span>
            {r.text && <span className="muted" lang="en" style={{ display: 'block', fontSize: 12.5, lineHeight: 1.4 }}>{r.text}</span>}
            <span className="muted" style={{ display: 'block', fontSize: 12 }}>
              {t('review.recall', { percent: Math.round(r.recall * 100) })}
              {r.overdueDays >= 1 ? ` · ${t('review.overdue', { n: Math.round(r.overdueDays), count: Math.round(r.overdueDays) })}` : ''}
            </span>
          </span>
          <button className="btn btn-ghost btn-sm" style={{ flex: 'none' }} data-review-go onClick={() => onGo(r.href)}>{t('review.practise')}</button>
        </li>
      ))}
    </ul>
  );
}

export default function ReviewQueueCard({ user }) {
  const t = useT();
  const nav = useNavigate();
  const queue = useReviewQueue(user?.id);
  if (!queue || !queue.due.length) return null;
  const n = queue.dueCount;
  return (
    <article className="home-card review-queue-card" data-review-queue-card aria-labelledby="review-queue-title" style={{ maxWidth: 420 }}>
      <span className="sc-label" style={{ margin: 0 }}>{t('review.dueTodayKicker')}</span>
      <h3 id="review-queue-title" style={{ margin: '6px 0 2px', fontSize: 20 }}>{t('review.dueToday', { n, count: n })}</h3>
      <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.45 }}>{t('review.dueTodayWhy')}</p>
      <ReviewQueueList items={queue.due} user={user} onGo={href => nav(href)} />
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        <button className="btn btn-primary btn-sm" data-review-start onClick={() => nav(queue.due[0].href)}>{t('review.startWeakest')}</button>
        <button className="btn btn-quiet btn-sm" onClick={() => nav('/plan')}>{t('review.seePlan')}</button>
      </div>
    </article>
  );
}
