// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the landing's three plain pages
//
// How marking works, Syllabus and For teachers, signed out. Each sentence is a
// catalogue string that describes what the product does today; none is a
// promise of something unbuilt. "For teachers" stays this simple page until
// the teacher workspace's onboarding ships (landing.config.js).
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import PageLink from '../components/PageLink.jsx';
import { useT } from '../i18n/index.js';
import { EDITION } from '../platform/edition.js';
import { LandingShell } from './Landing.jsx';
import { LANDING_ROUTES } from './landing.config.js';

const au = EDITION === 'prithagoras';

/** Each page: its title key and its paragraph keys, in order. */
export const PUBLIC_PAGES = Object.freeze({
  marking: { title: 'landing.marking.title', body: ['landing.marking.p1', 'landing.marking.p2', 'landing.marking.p3', 'landing.marking.p4', 'landing.marking.p5'] },
  syllabus: { title: 'landing.syllabus.title', body: [au ? 'landing.syllabus.au' : 'landing.syllabus.in'] },
  teachers: { title: 'landing.teachers.title', body: ['landing.teachers.p1', 'landing.teachers.p2'] }
});

export default function PublicInfo({ page }) {
  const t = useT();
  const spec = PUBLIC_PAGES[page] || PUBLIC_PAGES.marking;
  return (
    <LandingShell title={t(spec.title)}>
      <main className="lp-main lp-info" id="main" data-landing-page={page}>
        <h1 className="lp-info-title">{t(spec.title)}</h1>
        {spec.body.map(key => <p key={key} className="lp-info-p">{t(key)}</p>)}
        <p className="lp-ctas">
          <PageLink to="/" className="lp-btn lp-btn-pri">{t('landing.create')}</PageLink>
          <PageLink to={LANDING_ROUTES.home} className="lp-btn lp-btn-sec">{t('landing.seeDemo')}</PageLink>
        </p>
      </main>
    </LandingShell>
  );
}
