import React from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../i18n/index.js';
import { useToday } from './useToday.js';

// A support card on Home: how many items are in today's set, and the way in.
export default function TodayCard({ user }) {
  const t = useT();
  const state = useToday(user);
  const set = state?.set;
  if (!set || !set.items.length) return null;
  return (
    <article className="home-card" data-today-card aria-labelledby="today-card-title">
      <span className="sc-label">{t('today.kicker')}</span>
      <h3 id="today-card-title" className="review-queue-title">{t('today.size', { n: set.items.length, count: set.items.length, minutes: set.minutes })}</h3>
      <p className="muted">{t('today.cardWhy')}</p>
      <Link className="btn btn-ghost btn-sm" to="/today" data-today-open>{t('today.open')}</Link>
    </article>
  );
}
