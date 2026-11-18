import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLink from '../components/PageLink.jsx';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { useT } from '../i18n/index.js';
import TermGloss from '../components/TermGloss.jsx';
import { isEntitlementGate } from '../local/entitlementGate.js';
import { PAYWALL_ROUTE } from '../paywall/route.js';
import { unassisted } from '../today/todaySet.js';
import { useToday } from '../today/useToday.js';
import TrialNotice from '../components/TrialNotice.jsx';

// Today: a short mixed set of retests of recent mistakes (a fresh instance,
// unassisted) and reviews of dot points due on the spaced ladder, interleaved
// across chapters. Built by today/todaySet.js from what the server derived.
export default function Today() {
  const { user, toast } = useApp();
  const t = useT();
  const nav = useNavigate();
  const state = useToday(user);
  const [busy, setBusy] = useState(false);

  async function go(item) {
    if (item.kind === 'review') { nav(item.href || `/practice?subtopic=${encodeURIComponent(item.subtopic)}`); return; }
    setBusy(true);
    try {
      const r = await api.post(`/notebook/${item.attemptId}/twin`, {});
      nav('/practice', { state: { serve: { question: unassisted(r.question), reason: 'retry', why: t('today.whyRetest') } } });
    } catch (e) {
      if (isEntitlementGate(e)) nav(PAYWALL_ROUTE, { state: { from: 'practice' } });
      else toast(<span>{t('today.retestFailed')}</span>);
    } finally { setBusy(false); }
  }

  const set = state?.set;
  return (
    <div className="today-page" data-today-page style={{ maxWidth: 720 }}>
      <h1 style={{ marginBottom: 6 }}>{t('today.title')}</h1>
      <p className="muted" style={{ margin: '0 0 18px', lineHeight: 1.5 }}>{t('today.how')}</p>
      <TrialNotice />
      {state && state.available === false && <p className="muted" data-today-state="unavailable">{t('today.unavailable')}</p>}
      {set && !set.items.length && <p className="muted" data-today-state="empty">{t('today.empty')}</p>}
      {set && set.items.length > 0 && (
        <>
          <p data-today-minutes={set.minutes}><b>{t('today.size', { n: set.items.length, count: set.items.length, minutes: set.minutes })}</b>
            {set.held > 0 && <span className="muted"> · {t('today.held', { n: set.held, count: set.held })}</span>}</p>
          <ol className="today-list" style={{ listStyle: 'none', padding: 0, margin: '12px 0' }}>
            {set.items.map(item => (
              <li key={item.id} data-today-item={item.kind} className="row" style={{ gap: 12, alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid var(--line, #ddd)' }}>
                <span>
                  <span className="sc-label">{t(item.kind === 'retest' ? 'today.kindRetest' : 'today.kindReview')}</span>{' '}
                  <span lang="en"><TermGloss text={item.chapterName || item.subtopic} /></span>
                  <span className="muted" style={{ display: 'block' }}>{t(item.kind === 'retest' ? 'today.whyRetest' : 'today.whyReview')}</span>
                </span>
                <button type="button" className="btn btn-ghost btn-sm" data-today-go disabled={busy} onClick={() => go(item)}>{t(item.kind === 'retest' ? 'today.startRetest' : 'today.startReview')}</button>
              </li>
            ))}
          </ol>
        </>
      )}
      <p style={{ marginTop: 16 }}><PageLink to="/error-log" className="btn btn-ghost btn-sm" data-today-errorlog>{t('today.errorLogLink')}</PageLink></p>
    </div>
  );
}
