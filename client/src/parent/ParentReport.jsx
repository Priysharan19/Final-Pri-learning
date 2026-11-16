// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the parent weekly report, in the app — /parent-report
//
// The same report the parent is emailed each week, for the last complete week,
// and the place to choose who receives it. Everything shown is what the server
// computed from marked answers (server/platform/parentReport.js): below the
// evidence floor it says "not enough data yet" instead of a number, and time is
// shown as the lower bound it is. Premium and who may receive are the server's
// decisions; this page only shows its coded answers.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useState } from 'react';
import { useT } from '../i18n/index.js';
import { parentReportApi, percent } from './parentReportApi.js';
import './parent.css';

const ERROR_KEYS = {
  PARENT_REPORT_PREMIUM_REQUIRED: 'parent.premiumRequired',
  PARENT_REPORT_RECIPIENT_NOT_GUARDIAN: 'parent.notGuardian',
  PARENT_REPORT_RECIPIENT_IS_LEARNER: 'parent.isLearner',
  PARENT_REPORT_CONSENT_REQUIRED: 'parent.consentRequired',
  GUARDIAN_CONSENT_PENDING: 'parent.consentRequired',
  GUARDIAN_CONSENT_WITHDRAWN: 'parent.consentWithdrawn',
  PARENT_REPORT_EMAIL_INVALID: 'parent.emailInvalid',
  PARENT_REPORT_EMAIL_UNAVAILABLE: 'parent.emailUnavailable'
};
const errorKey = (code) => ERROR_KEYS[code] || 'parent.loadFailed';

function weekRange(weekStart, locale) {
  // Weeks are IST Monday–Sunday; show the dates as they fall in India.
  const fmt = (at) => new Date(at).toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
  return { from: fmt(weekStart), to: fmt(weekStart + 6 * 86400000) };
}

function Fact({ label, children }) {
  return (
    <div className="parent-fact">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Trend({ weeks, t }) {
  return (
    <ol className="parent-trend" aria-label={t('parent.trendLabel')}>
      {weeks.map(w => {
        const value = percent(w.accuracy);
        return (
          <li key={w.weekStart} data-week-accuracy={value ?? 'none'}>
            <span className="parent-trend-bar" aria-hidden="true">
              {value !== null && <i style={{ height: `${Math.max(4, value)}%` }} />}
            </span>
            <span className="parent-trend-value">{value !== null ? `${value}%` : '—'}</span>
          </li>
        );
      })}
    </ol>
  );
}

function TopicList({ topics, t, empty }) {
  if (!topics.length) return <p className="in-note">{empty}</p>;
  return (
    <ul className="parent-topics">
      {topics.map(topic => (
        // i18n-exempt-start: chapter names are NCERT syllabus titles, as printed
        <li key={topic.id}><span>{topic.name}</span> <b>{`${percent(topic.accuracy)}%`}</b></li>
        // i18n-exempt-end
      ))}
    </ul>
  );
}

function PlanStep({ step, t }) {
  if (step.kind === 'start-practising') return <li>{t('parent.planStart', { count: step.minimumAttempts, n: step.minimumAttempts })}</li>;
  if (step.kind === 'revisit-topic') return <li>{t('parent.planRevisit', { topic: step.name })}</li>;
  if (step.kind === 'fix-mistakes') return <li>{t('parent.planMistakes', { count: step.count, n: step.count })}</li>;
  if (step.kind === 'practise-days') return <li>{t('parent.planDays', { count: step.days, n: step.days })}</li>;
  return null;
}

export function Report({ report, t, locale }) {
  const p = report.practice;
  const a = report.accuracy;
  const range = weekRange(report.weekStart, locale);
  const direction = { up: 'parent.trendUp', down: 'parent.trendDown', steady: 'parent.trendSteady', 'not-enough-data': 'parent.trendNone' }[a.direction];
  return (
    <section className="parent-report" aria-labelledby="parent-week" data-parent-report={report.enoughData ? 'enough' : 'not-enough'}>
      <h2 id="parent-week">{t('parent.weekOf', range)}</h2>
      {!report.enoughData && (
        <p className="parent-honest" role="note">
          {p.questionsAttempted
            ? t('parent.notEnough', { count: p.questionsAttempted, n: p.questionsAttempted, min: report.minimumAttempts })
            : t('parent.nothingYet')}
        </p>
      )}
      <dl className="parent-facts">
        <Fact label={t('parent.attempted')}>{t('parent.attemptedValue', { count: p.questionsAttempted, n: p.questionsAttempted, right: p.questionsCorrect })}</Fact>
        <Fact label={t('parent.days')}>{t('parent.daysValue', { count: p.activeDays, n: p.activeDays })}</Fact>
        <Fact label={t('parent.time')}>
          {p.minutesAtLeast === null ? t('parent.timeNone') : t('parent.timeValue', { count: p.minutesAtLeast, n: p.minutesAtLeast })}
          {p.minutesAtLeast !== null && <span className="in-note parent-sub">{t('parent.timeNote')}</span>}
        </Fact>
        <Fact label={t('parent.accuracy')}>
          {a.thisWeek === null ? t('parent.notEnoughShort') : `${percent(a.thisWeek)}%`}
          <span className="in-note parent-sub">{t(direction)}</span>
        </Fact>
        <Fact label={t('parent.mistakesFixed')}>
          {report.enoughData ? t('parent.mistakesValue', { fixed: report.mistakes.fixed, open: report.mistakes.stillOpen }) : t('parent.notEnoughShort')}
        </Fact>
      </dl>
      <h3>{t('parent.trendHeading')}</h3>
      <Trend weeks={a.weeks} t={t} />
      {report.enoughData && (
        <div className="parent-columns">
          <div>
            <h3>{t('parent.strong')}</h3>
            <TopicList topics={report.topics.strong} t={t} empty={report.topics.measured ? t('parent.strongNone') : t('parent.topicsNone')} />
          </div>
          <div>
            <h3>{t('parent.weak')}</h3>
            <TopicList topics={report.topics.weak} t={t} empty={report.topics.measured ? t('parent.weakNone') : t('parent.topicsNone')} />
          </div>
        </div>
      )}
      <h3>{t('parent.plan')}</h3>
      <ul className="parent-plan">{report.plan.map((step, i) => <PlanStep key={i} step={step} t={t} />)}</ul>
      <p className="in-note">{t('parent.honestyNote')}</p>
    </section>
  );
}

function LinkPanel({ link, onChange, t }) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function send(event) {
    event.preventDefault();
    if (busy || !email.trim()) return;
    setBusy(true); setError('');
    try { onChange((await parentReportApi.link(email.trim())).link); setEmail(''); }
    catch (err) { setError(errorKey(err?.code)); }
    finally { setBusy(false); }
  }
  async function stop() {
    setBusy(true); setError('');
    try { onChange((await parentReportApi.stop()).link); }
    catch (err) { setError(errorKey(err?.code)); }
    finally { setBusy(false); }
  }

  const live = link.state === 'active' || link.state === 'pending';
  return (
    <section className="parent-link" aria-labelledby="parent-link-title">
      <h2 id="parent-link-title">{t('parent.emailHeading')}</h2>
      {link.state === 'active' && <p role="status">{t('parent.linkActive', { email: link.recipient })}</p>}
      {link.state === 'pending' && <p role="status">{t('parent.linkPending', { email: link.recipient })}</p>}
      {(link.state === 'none' || link.state === 'stopped') && <p>{t('parent.linkNone')}</p>}
      {live
        ? <button type="button" className="btn btn-ghost" disabled={busy} onClick={stop} data-testid="parent-link-stop">{t('parent.stop')}</button>
        : (
          <form onSubmit={send} className="parent-link-form">
            <label className="label" htmlFor="parent-email">{t('parent.emailLabel')}</label>
            <input id="parent-email" className="input" type="email" inputMode="email" autoComplete="off" maxLength={254}
              value={email} onChange={e => { setEmail(e.target.value); setError(''); }} />
            <p className="in-note">{t('parent.emailHint')}</p>
            <button type="submit" className="btn btn-primary" disabled={busy || !email.trim()} data-testid="parent-link-send">{t('parent.send')}</button>
          </form>
        )}
      {error && <div className="error-box" role="alert">{t(error)}</div>}
    </section>
  );
}

export default function ParentReport() {
  const t = useT();
  const locale = typeof document !== 'undefined' && document.documentElement.lang === 'hi' ? 'hi-IN' : 'en-IN';
  const [state, setState] = useState({ status: 'loading' });

  const load = useCallback(async () => {
    try {
      const data = await parentReportApi.read();
      setState({ status: 'ready', report: data.report, link: data.link });
    } catch (err) {
      setState({ status: 'error', code: err?.code || null });
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="parent-page">
      <h1>{t('parent.title')}</h1>
      <p className="in-note">{t('parent.lead')}</p>
      {state.status === 'loading' && <p role="status">{t('parent.loading')}</p>}
      {state.status === 'error' && <p className="parent-honest" role="alert" data-parent-error={state.code || 'unknown'}>{t(errorKey(state.code))}</p>}
      {state.status === 'ready' && (
        <>
          <Report report={state.report} t={t} locale={locale} />
          <LinkPanel link={state.link} t={t} onChange={link => setState(s => ({ ...s, link }))} />
        </>
      )}
    </div>
  );
}
