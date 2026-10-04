import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useT } from '../i18n/index.js';
import { formatDate, formatWeekday } from '../lib/locale.js';
import { usePlan } from '../plan/usePlan.js';
import { nextSession } from '../plan/studyPlan.js';
import { SESSION_TYPE_KEYS, reasonText, sessionHref } from '../plan/copy.js';

// The "This week" card on Home: today's sessions, how far through them the
// student is, and the week's shape. It reads the plan through usePlan, the same
// hook the Plan page uses, so the two never disagree. It never outranks the
// command card above it: KALP-04's primary action decides what to do now; this
// card says how today fits the weeks ahead.
export default function PlanCard({ user, stats }) {
  const t = useT();
  const nav = useNavigate();
  const { plan, progress } = usePlan(user, { stats });
  if (!plan || !progress) return null;

  const next = nextSession(progress);
  const days = plan.weeks[0]?.days || [];
  const fraction = Math.round(progress.fraction * 100);
  const todayLabel = t('plan.todayHeading');
  const examIn = plan.summary.daysToExam;

  return (
    <article className="home-card plan-card" data-plan-card aria-labelledby="plan-card-title" style={{ maxWidth: 420 }}>
      <span className="sc-label" style={{ margin: 0 }}>{t('plan.thisWeek')}</span>
      <h3 id="plan-card-title" style={{ margin: '6px 0 4px', fontSize: 20 }}>
        {plan.today.rest ? t('plan.restDay') : plan.today.examDay ? t('plan.examDay') : todayLabel}
      </h3>
      {examIn != null && examIn >= 0 && (
        <p className="muted" style={{ margin: '0 0 8px', fontSize: 13 }}>{t('plan.examIn', { n: examIn, count: examIn })}</p>
      )}

      {plan.summary.empty ? (
        <p style={{ margin: '8px 0 12px', lineHeight: 1.45 }}>{t('plan.empty')}</p>
      ) : (
        <>
          <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 10px', display: 'grid', gap: 6 }}>
            {progress.sessions.map(s => (
              <li key={s.id} data-plan-session={s.type} style={{ display: 'flex', gap: 8, alignItems: 'baseline', textDecoration: s.done ? 'line-through' : 'none', opacity: s.done ? 0.65 : 1 }}>
                <span className="tag" style={{ flex: 'none' }}>{t(SESSION_TYPE_KEYS[s.type])}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 600 }}>{s.name || t('plan.type.mock')}</span>
                  <span className="muted" style={{ display: 'block', fontSize: 12.5 }}>{reasonText(t, s, v => formatDate(v, user))}</span>
                </span>
                <span className="muted" style={{ flex: 'none', fontSize: 13 }}>{t('plan.minutes', { n: s.minutes, count: s.minutes })}</span>
              </li>
            ))}
            {!progress.sessions.length && <li className="muted">{t('plan.noSessions')}</li>}
          </ul>
          {progress.total > 0 && (
            <>
              <div className="meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={fraction}
                aria-label={t('plan.todayProgress', progress)} style={{ margin: '0 0 6px' }}>
                <i style={{ width: `${fraction}%` }} />
              </div>
              <div className="muted" style={{ fontSize: 12.5 }}>{t('plan.todayProgress', progress)}</div>
            </>
          )}
        </>
      )}

      <div className="week-strip" aria-hidden="true" style={{ marginTop: 12 }}>
        {days.map(d => (
          <div key={d.date} className="plan-week-day" title={d.date}>
            <div className={`week-dot ${d.minutes > 0 && d.date < plan.today.date ? 'hit' : ''} ${d.date === plan.today.date ? 'today' : ''}`}
              style={{ fontSize: 10, opacity: d.rest ? 0.45 : 1 }}>
              {d.rest ? '·' : d.minutes}
            </div>
            <div className="week-lbl">{formatWeekday(Date.parse(`${d.date}T12:00:00Z`), user)}</div>
          </div>
        ))}
      </div>

      <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        {next
          ? <button className="btn btn-primary btn-sm" data-plan-start onClick={() => nav(sessionHref(next, user))}>{t('plan.startNamed', { name: next.name || t('plan.type.mock') })}</button>
          : progress.total > 0 && <span className="muted" style={{ fontSize: 13 }}>{t('plan.allDone')}</span>}
        <button className="btn btn-ghost btn-sm" data-plan-open onClick={() => nav('/plan')}>{t('plan.open')}</button>
      </div>
    </article>
  );
}
