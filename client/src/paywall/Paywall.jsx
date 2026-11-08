import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../App.jsx';
import { useT } from '../i18n/index.js';
import PageLink from '../components/PageLink.jsx';
import { cloudAvailable } from '../platform/cloudTransport.js';
import { cloudAccountLink, verifyCloudSession } from '../platform/cloudAccount.js';
import { ENTITLEMENTS, hasEntitlement } from '../platform/entitlements.js';
import { nativeBillingStore } from '../platform/nativeBilling.js';
import { useStoreKitPurchase } from './useStoreKitPurchase.js';
import { useGooglePlayPurchase } from './useGooglePlayPurchase.js';
import { planOffers, aboutPerMonth, yearlySavingPercent } from './pricing.js';
import { ARRIVAL_KEYS, FREE_ROWS, PREMIUM_ROWS } from './plans.js';

// The Premium screen (D22: "the compliant paywall ships").
//
// It says what the free plan includes and what Premium adds (plans.js — the
// same figures the server enforces), shows the store's own prices, and lets
// the student subscribe or restore in the store their device uses: StoreKit in
// the Apple app, Google Play Billing in the Android app. On the web there is
// nothing to buy (web purchase is out of V1); Premium bought in an app follows
// the account everywhere.
//
// Compliance (App Store Review Guideline 3.1.2, Google Play's subscription
// policy): each plan names its billed amount and its period as the store
// states them; the auto-renewal terms, where to cancel, Terms of use and the
// Privacy policy are on the screen; Restore is visible; the close button works
// from the first frame. No timers, no invented discounts, no pre-selected
// trial, no guilt. A per-month figure for the yearly plan is labelled "about"
// and a saving is stated only when both real prices give it (pricing.js).
//
// Premium itself only ever comes from the server's verification of the
// purchase (useStoreKitPurchase.js, useGooglePlayPurchase.js).
const APPLE_MANAGE_URL = 'https://apps.apple.com/account/subscriptions';

function PlanCard({ offer, cadence, featured, busy, disabled, onBuy, t }) {
  const about = cadence === 'annual' ? aboutPerMonth(offer) : null;
  return (
    <div className="card" data-paywall-plan={cadence} style={featured ? { border: '1px solid var(--accent)' } : undefined}>
      <div className="sc-label">{t(cadence === 'annual' ? 'paywall.yearly' : 'paywall.monthly')}</div>
      <div style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginTop: 'var(--space-2)' }} data-paywall-billed>
        {t(cadence === 'annual' ? 'paywall.perYear' : 'paywall.perMonth', { price: offer.displayPrice })}
      </div>
      {about && <div className="muted" data-paywall-about>{t('paywall.aboutPerMonth', { price: about })}</div>}
      <button type="button" className={featured ? 'btn btn-primary' : 'btn btn-ghost'} data-paywall-buy={cadence} style={{ marginTop: 'var(--space-3)' }}
        disabled={disabled} onClick={onBuy}>
        {busy ? t('cloud.purchasing') : t(cadence === 'annual' ? 'paywall.chooseYearly' : 'paywall.chooseMonthly')}
      </button>
    </div>
  );
}

export default function Paywall() {
  const { user } = useApp();
  const t = useT();
  const nav = useNavigate();
  const location = useLocation();
  const from = location.state?.from;
  const enabled = cloudAvailable();
  const store = nativeBillingStore();
  const apple = store === 'app-store';
  const google = store === 'google-play';
  const [link, setLink] = useState(null);
  const [session, setSession] = useState(null);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!user?.id) return;
    const saved = await cloudAccountLink(user.id).catch(() => null);
    setLink(saved);
    if (enabled && saved?.accountId) setSession(await verifyCloudSession(user.id).catch(() => ({ connected: false })));
    else setSession({ connected: false });
  }, [user?.id, enabled]);
  useEffect(() => { reload(); }, [reload]);

  const canSync = enabled && !!link?.accountId && !!session?.connected;
  const premium = hasEntitlement(link?.entitlement, ENTITLEMENTS.UNLIMITED_PRACTICE);
  const storeKit = useStoreKitPurchase({
    user, canSync, nativeStoreKit: apple, accountId: link?.accountId || null,
    setBusy, setMessage, setError, onAccepted: reload
  });
  const play = useGooglePlayPurchase({ user, canSync: canSync && google, onChanged: reload });

  const offers = apple
    ? planOffers(storeKit.appleProducts, storeKit.appleBootstrap?.products)
    : google ? planOffers([play.plans.monthly, play.plans.annual].filter(Boolean), play.bootstrap?.products) : { annual: null, monthly: null };
  const saving = yearlySavingPercent(offers.annual, offers.monthly);
  const busyNow = apple ? busy : play.busy;
  const notOnSale = apple ? storeKit.appleNotOnSale : google ? !!play.storeError && !play.bootstrap : false;
  const storeError = apple ? storeKit.appleStoreError : google ? play.storeError : '';
  const canBuy = apple ? storeKit.canUseAppleBilling : google ? !!play.bootstrap : false;
  const buy = cadence => {
    const offer = offers[cadence];
    if (!offer) return;
    if (apple) storeKit.startApplePurchase(offer.product);
    else if (google) play.buy(offer.product);
  };
  const buyingKey = cadence => (apple ? `apple-${offers[cadence]?.id}` : `google-${offers[cadence]?.basePlanId}`);
  const restore = () => (apple ? storeKit.restoreAppleBilling() : play.restore());
  const restoring = busyNow === (apple ? 'restore-apple' : 'restore-google');
  const shownMessage = apple ? message : play.message;
  const shownError = apple ? error : play.error;

  const close = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) nav(-1);
    else nav('/');
  };

  return (
    <div className="qpage" data-paywall data-paywall-store={store || 'web'}>
      <section className="card" aria-labelledby="paywall-title" style={{ maxWidth: 640 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
          <h1 id="paywall-title" style={{ margin: 0, fontSize: 'var(--text-lg)' }}>{t('paywall.title')}</h1>
          <button type="button" className="btn btn-quiet btn-sm" data-paywall-close onClick={close}>{t('paywall.close')}</button>
        </div>
        {ARRIVAL_KEYS[from] && <p className="muted" data-paywall-context={from}>{t(ARRIVAL_KEYS[from])}</p>}

        <div className="grid cols-2" style={{ gap: 'var(--space-3)', marginTop: 'var(--space-3)' }} data-paywall-compare>
          <div data-paywall-free>
            <h2 className="sc-label" style={{ margin: 0 }}>{t('paywall.freeTitle')}</h2>
            <ul style={{ margin: 'var(--space-2) 0 0', paddingLeft: 'var(--space-5)', lineHeight: 1.5 }}>
              {FREE_ROWS.map(r => <li key={r.key}>{t(r.key, r.vars)}</li>)}
            </ul>
          </div>
          <div data-paywall-premium-rows>
            <h2 className="sc-label" style={{ margin: 0 }}>{t('paywall.premiumTitle')}</h2>
            <ul style={{ margin: 'var(--space-2) 0 0', paddingLeft: 'var(--space-5)', lineHeight: 1.5 }}>
              {PREMIUM_ROWS.map(r => <li key={r.key}>{t(r.key, r.vars)}</li>)}
            </ul>
          </div>
        </div>

        {premium && (
          <p data-paywall-premium style={{ marginTop: 'var(--space-4)' }}>
            <b>{t('paywall.alreadyPremium')}</b>{' '}
            {apple && <a href={APPLE_MANAGE_URL} target="_blank" rel="noreferrer" data-paywall-manage>{t('paywall.manage')}</a>}
            {google && <a href={play.manageUrl} target="_blank" rel="noreferrer" data-paywall-manage>{t('paywall.manage')}</a>}
          </p>
        )}

        {!premium && (apple || google) && (
          <div style={{ marginTop: 'var(--space-4)' }} data-paywall-plans>
            {!canSync && (
              <p className="muted" data-paywall-sign-in>
                {t('paywall.signInFirst')}{' '}
                <PageLink to="/settings#cloud-account-title">{t('paywall.openAccount')}</PageLink>
              </p>
            )}
            {canSync && notOnSale && <p className="muted" data-paywall-not-on-sale>{t('paywall.notOnSale')}</p>}
            {canSync && !notOnSale && (offers.annual || offers.monthly) && (
              <>
                <div className="grid" style={{ gap: 'var(--space-3)' }}>
                  {offers.annual && <PlanCard offer={offers.annual} cadence="annual" featured t={t}
                    busy={busyNow === buyingKey('annual')} disabled={!canBuy || !!busyNow} onBuy={() => buy('annual')} />}
                  {offers.monthly && <PlanCard offer={offers.monthly} cadence="monthly" featured={!offers.annual} t={t}
                    busy={busyNow === buyingKey('monthly')} disabled={!canBuy || !!busyNow} onBuy={() => buy('monthly')} />}
                </div>
                {saving && <p className="muted" data-paywall-saving>{t('paywall.saving', { n: saving })}</p>}
                <p className="muted" style={{ fontSize: 'var(--text-xs)' }}>{t('paywall.authority')}</p>
              </>
            )}
            {canSync && !notOnSale && storeError && <p style={{ color: 'var(--bad)' }}>{storeError}</p>}
          </div>
        )}

        {!premium && !apple && !google && (
          <p style={{ marginTop: 'var(--space-4)' }} data-paywall-in-app>{t('paywall.inAppOnly')}</p>
        )}

        {(apple || google) && (
          <div className="row" style={{ marginTop: 'var(--space-3)', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-quiet" data-paywall-restore disabled={!canBuy || !!busyNow} onClick={restore}>
              {restoring ? t('cloud.restoring') : t('paywall.restore')}
            </button>
            {google && !premium && <a className="btn btn-quiet" href={play.manageUrl} target="_blank" rel="noreferrer">{t('paywall.manage')}</a>}
          </div>
        )}
        {shownMessage && <p role="status">{shownMessage}</p>}
        {shownError && <p role="alert" style={{ color: 'var(--bad)' }}>{shownError}</p>}

        {(apple || google) && (
          <p className="muted" data-paywall-disclosure style={{ fontSize: 'var(--text-xs)', lineHeight: 1.5, marginTop: 'var(--space-4)' }}>
            {t(apple ? 'paywall.disclosureApple' : 'paywall.disclosureGoogle')}
          </p>
        )}
        <p className="muted" style={{ fontSize: 'var(--text-xs)' }} data-paywall-legal>
          <PageLink to="/terms">{t('paywall.terms')}</PageLink>{' · '}<PageLink to="/privacy">{t('paywall.privacy')}</PageLink>{' · '}<PageLink to="/refund-policy">{t('paywall.refunds')}</PageLink>
        </p>
      </section>
    </div>
  );
}
