// The calm page a link to something this edition does not offer lands on (owner decision, 19 Nov 2026:
// Prithagoras offers Years 11 and 12, Advanced and Extension 1). Its own file, importing nothing of the
// app's data layer, so a page that only needs this (the NSW notes) does not pull the whole curriculum in.
import React from 'react';
import { useT } from '../i18n/index.js';
import PageLink from './PageLink.jsx';

export function NotOffered() {
  const t = useT();
  return (
    <div className="card" role="status" data-not-offered style={{ maxWidth: 560, margin: '48px auto' }}>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>{t('offer.notYet.title')}</h1>
      <p className="muted">{t('offer.notYet.body')}</p>
      <p style={{ marginTop: 16 }}><PageLink to="/" className="btn btn-primary">{t('offer.notYet.home')}</PageLink></p>
    </div>
  );
}
