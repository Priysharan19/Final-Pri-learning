// Where the time went on a timed paper (engine/examTime.js, plan F10).
//
// For each section, two rules: the share of the measured time spent there and
// the share of the paper's marks it carries, then the figures. It describes
// this one sitting and recommends nothing: no order to sit sections in, no
// target pace. The server sends the report to a Premium account only; a free
// account whose paper was timed sees one line saying what Premium adds.
import React from 'react';
import { useT } from '../i18n/index.js';
import PageLink from './PageLink.jsx';
import { PAYWALL_ROUTE } from '../paywall/route.js';

function clock(ms) {
  const total = Math.round((Number(ms) || 0) / 1000);
  const m = Math.floor(total / 60);
  return `${m}:${String(total % 60).padStart(2, '0')}`;
}

const pctText = v => (v === null || v === undefined ? '—' : `${v}%`);

function Rule({ value, kind, label }) {
  const width = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="section-time-rule" data-section-time-rule={kind} style={{ display: 'grid', gridTemplateColumns: '5.5em 1fr 3.5em', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
      <span className="muted">{label}</span>
      <span aria-hidden="true" style={{ height: 2, background: 'var(--line, currentColor)', position: 'relative', opacity: 0.35 }}>
        <span style={{ position: 'absolute', left: 0, top: -1, height: 4, width: `${width}%`, background: kind === 'time' ? 'var(--ink, currentColor)' : 'var(--accent, currentColor)', opacity: 1 }} />
      </span>
      <span style={{ textAlign: 'right' }}>{pctText(value)}</span>
    </div>
  );
}

export default function SectionTime({ report, offered }) {
  const t = useT();
  if (!report) {
    if (!offered) return null;
    return (
      <p className="muted" data-section-time-offer style={{ fontSize: 13 }}>
        {t('sectionTime.offer')} <PageLink to={PAYWALL_ROUTE} state={{ from: 'time-report' }}>{t('sectionTime.offerLink')}</PageLink>
      </p>
    );
  }
  return (
    <section className="card section-time" aria-labelledby="section-time-title" data-section-time>
      <h2 className="card-title" id="section-time-title">{t('sectionTime.title')}</h2>
      <p className="sub">{t('sectionTime.summary', { time: clock(report.totalMs), awarded: report.awarded, marks: report.marks })}</p>
      <div className="grid" style={{ gap: 14, marginTop: 10 }}>
        {report.sections.map(s => (
          <div key={s.id} data-section-time-row={s.id}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{s.label}</div>
            <Rule kind="time" value={s.timeShare} label={t('sectionTime.ruleTime')} />
            <Rule kind="marks" value={s.marksShare} label={t('sectionTime.ruleMarks')} />
            <p className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
              {t('sectionTime.line', { time: clock(s.ms), timeShare: pctText(s.timeShare), marks: s.marks, marksShare: pctText(s.marksShare), awarded: s.awarded, perMinute: s.marksPerMinute ?? '—', reached: s.reached, questions: s.questions })}
              {s.lastReached && s.lastReached.lost > 0 && <> {t('sectionTime.lastLost', { order: s.lastReached.order, lost: s.lastReached.lost, sectionLost: s.lost })}</>}
            </p>
          </div>
        ))}
      </div>
      <p className="muted" style={{ marginTop: 10, fontSize: 12 }}>{t('sectionTime.note')}</p>
    </section>
  );
}
