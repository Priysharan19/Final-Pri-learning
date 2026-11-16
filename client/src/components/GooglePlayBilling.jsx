// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Google Play subscriptions inside the Android app (CP-08)
//
// Shown only when the shell's billing store is "google-play". Prices come from
// Google Play itself; the server says which product/base plans this deployment
// sells and issues the opaque obfuscatedAccountId. Google's purchase sheet is
// never the authority: every purchase token goes to the server, which
// re-fetches the purchase from Google, checks it was made for this account and
// only then changes Premium (server/platform/googleBilling.js).
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { useT } from '../i18n/index.js';
import { useGooglePlayPurchase } from '../paywall/useGooglePlayPurchase.js';

export default function GooglePlayBilling({ user, canSync, premium, onChanged }) {
  const t = useT();
  // One flow for the account panel and the Premium screen (paywall/).
  const { bootstrap, plans, storeError, busy, message, error, buy, restore, manageUrl } = useGooglePlayPurchase({ user, canSync, onChanged });

  return (
    <div style={{ marginTop: 12 }} data-google-play-billing>
      <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
        {t('cloud.googleAuthorityNote')}
      </div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        {!premium && plans.monthly && <button className="btn btn-sm btn-primary" type="button" disabled={!bootstrap || !!busy} onClick={() => buy(plans.monthly)}>
          {busy === `google-${plans.monthly.basePlanId}` ? t('cloud.purchasing') : t('cloud.monthlyPrice', { price: plans.monthly.displayPrice })}
        </button>}
        {!premium && plans.annual && <button className="btn btn-sm btn-ghost" type="button" disabled={!bootstrap || !!busy} onClick={() => buy(plans.annual)}>
          {busy === `google-${plans.annual.basePlanId}` ? t('cloud.purchasing') : t('cloud.annualPrice', { price: plans.annual.displayPrice })}
        </button>}
        <button className="btn btn-sm btn-quiet" type="button" disabled={!bootstrap || !!busy} onClick={restore}>
          {busy === 'restore-google' ? t('cloud.restoring') : t('cloud.restoreGoogle')}
        </button>
        <a className="btn btn-sm btn-quiet" href={manageUrl} target="_blank" rel="noreferrer">{t('cloud.manageGoogle')}</a>
      </div>
      {storeError && <div style={{ color: 'var(--bad)', fontSize: 12, marginTop: 7 }}>{storeError}</div>}
      {error && <div style={{ color: 'var(--bad)', fontSize: 12, marginTop: 7 }} role="alert">{error}</div>}
      {message && <div className="muted" style={{ fontSize: 12, marginTop: 7 }} role="status">{message}</div>}
    </div>
  );
}
