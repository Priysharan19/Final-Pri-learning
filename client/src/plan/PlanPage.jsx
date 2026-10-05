import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../App.jsx';
import { useT } from '../i18n/index.js';
import { formatDate, formatWeekday } from '../lib/locale.js';
import { usePlan } from './usePlan.js';
import { PLAN_LIMITS } from './studyPlan.js';
import { SESSION_TYPE_KEYS, reasonText, sessionHref } from './copy.js';
import { useReviewQueue, ReviewQueueList } from '../home/ReviewQueueCard.jsx';

// The Plan page: every week of the plan as a list of days, each day's sessions
// with the reason each was chosen, and the three settings that shape it. Days
// are rows rather than a seven-column grid so the page reads at phone width
// without a horizontal scroll; weeks are tabs across the top.
const WEEKLY_PRESETS = [60, 90, 120, 150, 210, 300, 420];
const HOURS = Array.from({ length: 18 }, (_, i) => i + 5);
const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

export default function PlanPage() {
  const { user } = useApp();
  const t = useT();
  const nav = useNavigate();
  const { plan, progress, settings, update, loading } = usePlan(user);
  const queue = useReviewQueue(user?.id);
  const [week, setWeek] = useState(0);
  const [saved, setSaved] = useState(false);

  const change = patch => { update(patch); setSaved(true); setTimeout(() => setSaved(false), 1800); };
  const weekdayLabel = n => formatWeekday(Date.UTC(2024, 0, 7 + n, 12), user, 'long');
  const current = plan?.weeks[Math.min(week, (plan?.weeks.length || 1) - 1)] || null;
  const done = new Set((progress?.sessions || []).filter(s => s.done).map(s => s.id));

  return (
    <div className="plan-page" style={{ maxWidth: 980 }}>
      <h1 style={{ marginBottom: 6 }}>{t('plan.title')}</h1>
      <p className="muted" style={{ margin: '0 0 18px', maxWidth: 680, lineHeight: 1.5 }}>{t('plan.how')}</p>

      {plan && (
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
          <span className="chip">{t('plan.dailyBudget', { n: plan.summary.dailyBudget, count: plan.summary.dailyBudget })}</span>
          {plan.summary.daysToExam != null && <span className="chip">{t('plan.examIn', { n: plan.summary.daysToExam, count: plan.summary.daysToExam })}</span>}
          {plan.summary.carriedReviews > 0 && <span className="chip">{t('plan.carried', { n: plan.summary.carriedReviews, count: plan.summary.carriedReviews })}</span>}
        </div>
      )}

      {plan && (
        <div role="tablist" aria-label={t('nav.plan')} className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {plan.weeks.map(w => (
            <button key={w.id} role="tab" aria-selected={w.index === week} data-plan-week={w.index}
              className={`btn btn-sm ${w.index === week ? 'btn-primary' : 'btn-quiet'}`} onClick={() => setWeek(w.index)}>
              {t('plan.weekLabel', { n: w.index + 1 })}
              <small className="muted" style={{ display: 'block', fontSize: 11 }}>{t('plan.weekMinutes', { n: w.minutes, count: w.minutes })}</small>
            </button>
          ))}
        </div>
      )}

      {loading && !plan && <div className="muted">…</div>}

      {current && (
        <section className="card" aria-label={t('plan.weekRange', { start: formatDate(Date.parse(`${current.start}T12:00:00Z`), user), end: formatDate(Date.parse(`${current.end}T12:00:00Z`), user) })} style={{ padding: 0, overflow: 'hidden' }}>
          {current.days.map(d => (
            <div key={d.date} data-plan-day={d.date} style={{ display: 'flex', gap: 14, padding: '12px 16px', borderBottom: '1px solid var(--hairline)', background: d.date === plan.today.date ? 'var(--brand-soft)' : 'transparent', flexWrap: 'wrap' }}>
              <div style={{ flex: '0 0 92px' }}>
                <div style={{ fontWeight: 700 }}>{formatWeekday(Date.parse(`${d.date}T12:00:00Z`), user, 'short')}</div>
                <div className="muted" style={{ fontSize: 12.5 }}>{formatDate(Date.parse(`${d.date}T12:00:00Z`), user)}</div>
                {d.minutes > 0 && <div className="muted" style={{ fontSize: 12.5 }}>{t('plan.minutes', { n: d.minutes, count: d.minutes })}</div>}
              </div>
              <div style={{ flex: '1 1 240px', minWidth: 0, display: 'grid', gap: 8 }}>
                {d.examDay && <span className="tag tag-brand">{t('plan.examDay')}</span>}
                {d.afterExam && <span className="muted">{t('plan.afterExam')}</span>}
                {d.rest && <span className="muted">{t('plan.restDay')}</span>}
                {!d.rest && !d.examDay && !d.afterExam && !d.sessions.length && <span className="muted">{t('plan.noSessions')}</span>}
                {d.sessions.map(s => (
                  <div key={s.id} data-plan-session={s.type} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', opacity: done.has(s.id) ? 0.6 : 1 }}>
                    <span className="tag" style={{ flex: 'none' }}>{t(SESSION_TYPE_KEYS[s.type])}</span>
                    <span style={{ flex: '1 1 160px', minWidth: 0 }}>
                      <span style={{ fontWeight: 600, textDecoration: done.has(s.id) ? 'line-through' : 'none' }}>{s.name || t('plan.type.mock')}</span>
                      <span className="muted" style={{ display: 'block', fontSize: 12.5 }}>{reasonText(t, s, v => formatDate(Date.parse(`${v}T12:00:00Z`), user))}</span>
                    </span>
                    <span className="muted" style={{ flex: 'none', fontSize: 13 }}>{t('plan.minutes', { n: s.minutes, count: s.minutes })}</span>
                    {d.date === plan.today.date && !done.has(s.id) && (
                      <button className="btn btn-ghost btn-sm" onClick={() => nav(sessionHref(s, user))}>{t('plan.start')}</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {plan?.summary.empty && <p className="muted" style={{ marginTop: 12 }}>{t('plan.empty')}</p>}

      {queue && queue.counted > 0 && (
        <section className="card" style={{ marginTop: 18 }} aria-labelledby="plan-review-title" data-plan-review-queue>
          <h2 id="plan-review-title" style={{ marginBottom: 4 }}>{queue.due.length ? t('review.dueToday', { n: queue.dueCount, count: queue.dueCount }) : t('review.nothingDue')}</h2>
          <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.45 }}>{t('review.dueTodayWhy')}</p>
          {queue.due.length > 0 && <ReviewQueueList items={queue.due} user={user} limit={12} onGo={href => nav(href)} />}
          {queue.upcoming.length > 0 && (
            <>
              <h3 style={{ fontSize: 14, margin: '14px 0 0' }}>{t('review.upcoming')}</h3>
              <ReviewQueueList items={queue.upcoming} user={user} limit={6} onGo={href => nav(href)} />
            </>
          )}
        </section>
      )}

      <section className="card" style={{ marginTop: 18 }} aria-labelledby="plan-settings-title">
        <h2 id="plan-settings-title" style={{ marginBottom: 8 }}>{t('plan.settings')}</h2>
        <div className="set-row">
          <label className="set-k" htmlFor="plan-weekly">{t('plan.weeklyMinutes')}</label>
          <span className="set-v">
            <select id="plan-weekly" className="input" style={{ minHeight: 44 }} value={settings.weeklyMinutes}
              onChange={e => change({ weeklyMinutes: Number(e.target.value) })}>
              {[...new Set([...WEEKLY_PRESETS, settings.weeklyMinutes])].sort((a, b) => a - b).map(m => (
                <option key={m} value={m}>{t('plan.minutes', { n: m, count: m })}</option>
              ))}
            </select>
          </span>
        </div>
        <div className="set-row">
          <label className="set-k" htmlFor="plan-exam">{t('plan.examDate')}</label>
          <span className="set-v row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <input id="plan-exam" className="input" type="date" style={{ minHeight: 44 }} value={settings.examDate || ''}
              min={plan?.generatedFor || undefined}
              max={plan ? `${Number(plan.generatedFor.slice(0, 4)) + 2}-12-31` : undefined}
              onChange={e => change({ examDate: e.target.value || null })} />
            {settings.examDate && <button className="btn btn-quiet btn-sm" onClick={() => change({ examDate: null })}>{t('plan.clearExam')}</button>}
          </span>
        </div>
        {!settings.examDate && <p className="muted" style={{ fontSize: 12.5, margin: '4px 0 0' }}>{t('plan.examDateNone')}</p>}
        <div className="set-row">
          <label className="set-k" htmlFor="plan-rest">{t('plan.restDayLabel')}</label>
          <span className="set-v">
            <select id="plan-rest" className="input" style={{ minHeight: 44 }} value={settings.restDay == null ? '' : settings.restDay}
              onChange={e => change({ restDay: e.target.value === '' ? null : Number(e.target.value) })}>
              <option value="">{t('plan.restNone')}</option>
              {WEEKDAYS.map(n => <option key={n} value={n}>{weekdayLabel(n)}</option>)}
            </select>
          </span>
        </div>
        <div className="set-row">
          <label className="set-k" htmlFor="plan-hour">{t('plan.sessionHour')}</label>
          <span className="set-v">
            <select id="plan-hour" className="input" style={{ minHeight: 44 }} value={settings.sessionHour}
              onChange={e => change({ sessionHour: Number(e.target.value) })}>
              {HOURS.map(h => <option key={h} value={h}>{t('plan.hourLabel', { hour: String(h).padStart(2, '0') })}</option>)}
            </select>
          </span>
        </div>
        <p className="muted" style={{ fontSize: 12.5, margin: '8px 0 0' }} role="status">
          {saved ? t('plan.saved') : t('plan.dailyBudget', { n: plan?.summary.dailyBudget ?? PLAN_LIMITS.minSession, count: plan?.summary.dailyBudget ?? PLAN_LIMITS.minSession })}
        </p>
      </section>
    </div>
  );
}
