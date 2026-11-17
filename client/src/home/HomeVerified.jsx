// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Home, "the verified page" §5 — beside the Next card
//
// The Next card itself stays the Index's (instrument/IndexPage.jsx): the one
// action home/recommendation.js picks. This file adds what the design puts
// beside it, each shown only when its evidence exists:
//
//   · the timed-papers trend, from Exam Desk results the server marked in
//     full — hidden with fewer than two papers;
//   · the latest marked work, with its server-certified marks;
//   · marks at stake, from hsc-forecast's figures with their disclaimer —
//     hidden until that engine supplies them (verifiedHome.homeForecast).
//
// No ambient motion; nothing here is estimated.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useMemo } from 'react';
import PageLink from '../components/PageLink.jsx';
import { useT } from '../i18n/index.js';
import './verifiedHome.css';
import { homeForecast, latestMarked, marksAtStake, nextMeta, papersTrend, sparkPath } from './verifiedHome.js';

/** "10 questions · 25 min left" — only the parts the action carries. */
export function NextMeta({ action }) {
  const t = useT();
  const m = nextMeta(action);
  const parts = [];
  if (m.questions) parts.push(t('home.vp.questions', { count: m.questions, n: m.questions }));
  if (m.minutes) parts.push(t('home.vp.minutes', { n: m.minutes }));
  if (m.minutesLeft) parts.push(t('home.vp.minutesLeft', { count: m.minutesLeft, n: m.minutesLeft }));
  if (!parts.length) return null;
  return <small className="vp-meta" data-home-next-meta>{parts.join(' · ')}</small>;
}

export function PapersTrend({ exams }) {
  const t = useT();
  const points = useMemo(() => papersTrend(exams), [exams]);
  const spark = useMemo(() => sparkPath(points), [points]);
  if (!points || !spark) return null;
  const series = points.map(p => p.pct).join(' → ');
  return (
    <PageLink to="/exams" className="vp-side" data-home-papers={points.length}>
      <span className="vp-side-k">{t('home.vp.papers')}</span>
      <span className="vp-spark-row">
        <svg width="92" height="32" viewBox="0 0 92 32" aria-hidden="true" focusable="false">
          <path d={spark.d} className="vp-spark" />
          <circle cx={spark.last[0]} cy={spark.last[1]} r="3" className="vp-spark-dot" />
        </svg>
        <span className="vp-spark-n" aria-hidden="true">{series}</span>
      </span>
      <span className="vp-sr">{t('home.vp.papersSay', { count: points.length, n: points.length, series })}</span>
    </PageLink>
  );
}

export function LatestMarked({ recent }) {
  const t = useT();
  const row = latestMarked(recent);
  if (!row) return null;
  return (
    <PageLink to="/review" className="vp-side" data-home-latest-marked={row.id}>
      <span className="vp-side-k">{t('home.vp.marked')}</span>
      <span className="vp-side-v"><span lang="en">{row.chapter}</span> · {t('home.vp.marks', { earned: row.earned, possible: row.possible })}</span>
    </PageLink>
  );
}

export function MarksAtStake({ action, forecast = homeForecast() }) {
  const t = useT();
  const stake = marksAtStake(action, forecast);
  if (!stake) return null;
  return (
    <div className="vp-side" data-home-marks-at-stake>
      <span className="vp-side-k">{t('home.vp.atStake')}</span>
      <span className="vp-side-v">{t('home.vp.atStakeRange', { lo: stake.lo, hi: stake.hi })}</span>
      <small className="vp-fine">{stake.disclaimer}</small>
    </div>
  );
}

/** The column beside the Next card. Renders nothing when it has nothing true to show. */
export default function HomeAside({ exams, recent, action, showMarked = true }) {
  const t = useT();
  const trend = papersTrend(exams);
  // The Resume card already shows the latest question's marks: not twice.
  const marked = showMarked ? latestMarked(recent) : null;
  const stake = marksAtStake(action, homeForecast());
  if (!trend && !marked && !stake) return null;
  return (
    <aside className="vp-aside" aria-label={t('home.vp.aside')} data-home-aside>
      <MarksAtStake action={action} />
      <PapersTrend exams={exams} />
      {showMarked && <LatestMarked recent={recent} />}
    </aside>
  );
}
