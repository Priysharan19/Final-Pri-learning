import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../App.jsx';
import { useT } from '../i18n/index.js';
import PageLink from '../components/PageLink.jsx';
import { cloudAvailable } from '../platform/cloudTransport.js';
import { cloudAccountLink, verifyCloudSession } from '../platform/cloudAccount.js';
import { ENTITLEMENTS, hasEntitlement } from '../platform/entitlements.js';
import { nativeBillingStore } from '../platform/nativeBilling.js';
import { FREE_MARKING_ALLOWANCE, FREE_NOTEBOOK_PREVIEW } from '../engine/practiceAllowance.js';
import { useStoreKitPurchase } from './useStoreKitPurchase.js';
import { planOffers, aboutPerMonth, yearlySavingPercent } from './pricing.js';

// The Premium screen. It says what the free plan includes and what Premium
// adds, shows the App Store's own prices, and lets the student subscribe or
// restore. No timers, no invented discounts, no pre-selected trial and no
// guilt: the close button is there from the first frame and works.
//
// Prices: the billed amount is StoreKit's `displayPrice`; the yearly plan's
// per-month figure is derived from StoreKit's numeric price and labelled
// "about"; a saving is shown only when it can be computed from both real
// prices (paywall/pricing.js). Premium itself only ever comes from the server's
// verification of the transaction (paywall/useStoreKitPurchase.js).

export const FREE_ROWS = Object.freeze([
  { key: 'paywall.free.practice' },
  { key: 'paywall.free.marking', vars: { n: FREE_MARKING_ALLOWANCE.scriptsPerDay, count: FREE_MARKING_ALLOWANCE.scriptsPerDay } },
  { key: 'paywall.free.notebook', vars: { n: FREE_NOTEBOOK_PREVIEW, count: FREE_NOTEBOOK_PREVIEW } }
]);
export const PREMIUM_ROWS = Object.freeze([
  { key: 'paywall.premium.marking' },
  { key: 'paywall.premium.mocks' },
  { key: 'paywall.premium.notebook' },
  { key: 'paywall.premium.parentReport' },
  { key: 'paywall.premium.targetPlan' }
]);
const CONTEXT_KEYS = Object.freeze({
  marking: 'paywall.from.marking', notebook: 'paywall.from.notebook', exams: 'paywall.from.exams', plan: 'paywall.from.plan'
});

export default function Paywall() {
  const { user } = useApp();
  const t = useT();
  const nav = useNavigate();
  const location = useLocation();
  const from = location.state?.from;
  const enabled = cloudAvailable();
  const nativeStoreKit = nativeBillingStore() === 'app-store';
  const [link, setLink] = useState(null);
  const [session, setSession] = useState(null);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!user?.id) return;
    const saved = await cloudAccountLink(user.id).catch(() => null);
    setLink(saved);
    if (enabled && saved?.accountId) {
      setSession(await verifyCloudSession(user.id).catch(() => ({ connected: false })));
    } else setSession({ connected: false });
  }, [user?.id, enabled]);
  useEffect(() => { reload(); }, [reload]);

  const canSync = enabled && !!link?.accountId && !!session?.connected;
  const premium = hasEntitlement(link?.entitlement, ENTITLEMENTS.UNLIMITED_MARKING);
  const store = useStoreKitPurchase({
    user, canSync, nativeStoreKit, accountId: link?.accountId || null,
    setBusy, setMessage, setError, onAccepted: async () => { await reload(); }
  });
  const offers = planOffers(store.appleProducts, store.appleBootstrap?.products);
  const about = aboutPerMonth(offers.annual);
  const saving = yearlySavingPercent(offers.annual, offers.monthly);

  const close = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) nav(-1);
    else nav('/');
  };

  return (
    <div className="qpage" data-paywall>
      <section className="card" aria-labelledby="paywall-title" style={{ maxWidth: 640, position: 'relative' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
          <h1 id="paywall-title" style={{ margin: 0, fontSize: 'var(--text-lg)' }}>{t('paywall.title')}</h1>
          <button type="button" className="btn btn-quiet btn-sm" data-paywall-close onClick={close}>{t('paywall.close')}</button>
        </div>
        {CONTEXT_KEYS[from] && <p className="muted" data-paywall-context={from}>{t(CONTEXT_KEYS[from], { n: FREE_MARKING_ALLOWANCE.scriptsPerDay, count: FREE_MARKING_ALLOWANCE.scriptsPerDay })}</p>}

        <div className="grid cols-2" style={{ gap: 'var(--space-3)', marginTop: 'var(--space-3)' }} data-paywall-compare>
          <div>
            <div className="sc-label">{t('paywall.freeTitle')}</div>
            <ul style={{ margin: 'var(--space-2) 0 0', paddingLeft: 'var(--space-5)', lineHeight: 1.5 }}>
              {FREE_ROWS.map(r => <li key={r.key}>{t(r.key, r.vars)}</li>)}
            </ul>
          </div>
          <div>
            <div className="sc-label">{t('paywall.premiumTitle')}</div>
            <ul style={{ margin: 'var(--space-2) 0 0', paddingLeft: 'var(--space-5)', lineHeight: 1.5 }}>
              {PREMIUM_ROWS.map(r => <li key={r.key}>{t(r.key)}</li>)}
            </ul>
          </div>
        </div>

        {premium && <p data-paywall-premium style={{ marginTop: 'var(--space-4)' }}><b>{t('paywall.alreadyPremium')}</b></p>}

        {!premium && nativeStoreKit && (
          <div style={{ marginTop: 'var(--space-4)' }} data-paywall-plans>
            {!canSync && (
              <p className="muted">
                {t('paywall.signInFirst')}{' '}
                <PageLink to="/settings#cloud-account-title">{t('paywall.openAccount')}</PageLink>
              </p>
            )}
            {canSync && store.appleNotOnSale && <p className="muted">{t('cloud.appleNotOnSale')}</p>}
            {canSync && !store.appleNotOnSale && (
              <div className="grid" style={{ gap: 'var(--space-3)' }}>
                {offers.annual && (
                  <div className="card" data-paywall-plan="annual" style={{ border: '1px solid var(--accent)' }}>
                    <span className="chip">{t('paywall.recommended')}</span>
                    <div style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginTop: 'var(--space-2)' }} data-paywall-billed>
                      {t('paywall.perYear', { price: offers.annual.displayPrice })}
                    </div>
                    {about && <div className="muted" data-paywall-about>{t('paywall.aboutPerMonth', { price: about })}</div>}
                    {saving && <div className="muted" data-paywall-saving>{t('paywall.saving', { n: saving })}</div>}
                    <button type="button" className="btn btn-primary" data-paywall-buy="annual" style={{ marginTop: 'var(--space-3)' }}
                      disabled={!store.canUseAppleBilling || !!busy} onClick={() => store.startApplePurchase(offers.annual.product)}>
                      {busy === `apple-${offers.annual.id}` ? t('cloud.purchasing') : t('paywall.chooseYearly')}
                    </button>
                  </div>
                )}
                {offers.monthly && (
                  <div className="card" data-paywall-plan="monthly">
                    <div style={{ fontWeight: 600 }} data-paywall-billed>{t('paywall.perMonth', { price: offers.monthly.displayPrice })}</div>
                    <button type="button" className="btn btn-ghost" data-paywall-buy="monthly" style={{ marginTop: 'var(--space-3)' }}
                      disabled={!store.canUseAppleBilling || !!busy} onClick={() => store.startApplePurchase(offers.monthly.product)}>
                      {busy === `apple-${offers.monthly.id}` ? t('cloud.purchasing') : t('paywall.chooseMonthly')}
                    </button>
                  </div>
                )}
              </div>
            )}
            {store.appleStoreError && <p style={{ color: 'var(--bad)' }}>{store.appleStoreError}</p>}
          </div>
        )}

        {!premium && !nativeStoreKit && (
          <p style={{ marginTop: 'var(--space-4)' }} data-paywall-elsewhere>
            {t('paywall.chooseInAccount')}{' '}
            <PageLink className="btn btn-primary btn-sm" to="/settings#cloud-account-title">{t('paywall.openAccount')}</PageLink>
          </p>
        )}

        {nativeStoreKit && (
          <div className="row" style={{ marginTop: 'var(--space-3)', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-quiet" data-paywall-restore disabled={!store.canUseAppleBilling || !!busy} onClick={store.restoreAppleBilling}>
              {busy === 'restore-apple' ? t('cloud.restoring') : t('paywall.restore')}
            </button>
          </div>
        )}
        {message && <p role="status">{message}</p>}
        {error && <p role="alert" style={{ color: 'var(--bad)' }}>{error}</p>}

        <p className="muted" data-paywall-disclosure style={{ fontSize: 'var(--text-xs)', lineHeight: 1.5, marginTop: 'var(--space-4)' }}>
          {t(nativeStoreKit ? 'paywall.disclosureApple' : 'paywall.disclosure')}
        </p>
        <p className="muted" style={{ fontSize: 'var(--text-xs)' }}>
          <PageLink to="/terms">{t('paywall.terms')}</PageLink>{' · '}<PageLink to="/privacy">{t('paywall.privacy')}</PageLink>
        </p>
      </section>
    </div>
  );
}
