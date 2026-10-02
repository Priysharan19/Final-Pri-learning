import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../App.jsx';
import { cloud, cloudAvailable } from '../platform/cloudTransport.js';
import {
  cloudAccountLink, disconnectCloudAccount, loginCloudAccount,
  refreshCloudEntitlement, registerCloudAccount, verifyCloudSession
} from '../platform/cloudAccount.js';
import { cloudSyncStatus, syncNow } from '../platform/syncWorker.js';
import { normalizeCommercialDisplay } from '../platform/entitlements.js';
import {
  finishNativeTransaction, getNativeProducts, nativeBillingStore,
  acceptEachTransaction, onNativeBillingUpdate, purchaseNativeProduct, restoreNativePurchases
} from '../platform/nativeBilling.js';
import GooglePlayBilling from './GooglePlayBilling.jsx';
import CloudAccountSecurity from './CloudAccountSecurity.jsx';
import { tLater, useT, useTx } from '../i18n/index.js';
import { priNative } from '../platform/native/index.js';

function when(value, t) {
  if (!value) return t('cloud.never');
  try { return new Date(value).toLocaleString(); } catch { return t('cloud.unknown'); }
}

function price(value, currency) {
  if (!value || !currency) return null;
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency', currency, maximumFractionDigits: 0
    }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
}

function pricingText(config, t) {
  if (!config) return t('cloud.pricingOffline');
  const monthly = price(config.monthly, config.currency);
  const annual = price(config.annual, config.currency);
  if (!monthly && !annual) return t('cloud.pricingUnset');
  const prices = monthly && annual
    ? t('cloud.priceBoth', { monthly, annual })
    : monthly ? t('cloud.priceMonthly', { price: monthly }) : t('cloud.priceAnnual', { price: annual });
  return config.trialDays
    ? t('cloud.pricingSummaryTrial', { prices, days: config.trialDays })
    : t('cloud.pricingSummary', { prices });
}

export default function CloudAccountPanel() {
  const { user } = useApp();
  const t = useT();
  const tx = useTx();
  const enabled = cloudAvailable();
  const nativeShell = priNative.isNativeShell();
  // The shell's store selects the purchase flow (StoreKit or Google Play); the
  // server alone decides Premium either way.
  const nativeStore = nativeBillingStore();
  const nativeStoreKit = nativeStore === 'app-store';
  const googlePlay = nativeStore === 'google-play';
  const [link, setLink] = useState(null);
  const [status, setStatus] = useState(null);
  const [session, setSession] = useState(null);
  const [pricing, setPricing] = useState(null);
  const [webCheckout, setWebCheckout] = useState(false);
  const [appleBootstrap, setAppleBootstrap] = useState(null);
  const [appleProducts, setAppleProducts] = useState([]);
  const [appleStoreError, setAppleStoreError] = useState('');
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({
    name: user?.name || '', email: '', password: '',
    // Declared, not inferred. The class a student picked already implies a
    // child, and the server treats silence as one — this asks so the student
    // knows it was asked, and so an adult can say so.
    isAdult: false, guardianName: '', guardianEmail: ''
  });
  const [agreed, setAgreed] = useState(false);
  // Where this account stands with its guardian. Shown to the student so a
  // pending account reads as "waiting for a parent" rather than as a fault.
  const [guardian, setGuardian] = useState(null);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const appleInFlight = useRef(new Set());

  const entitlement = link?.entitlement;
  const premium = !!entitlement?.active;
  const pending = status?.pending || 0;
  const canSync = enabled && !!link?.accountId && !!session?.connected;

  useEffect(() => {
    if (!enabled || !link?.accountId) { setGuardian(null); return; }
    let live = true;
    cloud.guardianState()
      .then(state => { if (live) setGuardian(state); })
      .catch(() => { if (live) setGuardian(null); });
    return () => { live = false; };
  }, [enabled, link?.accountId]);
  const canUseWebBilling = canSync && webCheckout && !nativeShell;
  const canUseAppleBilling = canSync && nativeStoreKit && !!appleBootstrap?.appAccountToken;
  const liveAccount = session?.connected ? session.account : null;
  const appleMonthly = appleProducts.find(product => product.id === appleBootstrap?.products?.monthly) || null;
  const appleAnnual = appleProducts.find(product => product.id === appleBootstrap?.products?.annual) || null;

  async function reload({ verify = true } = {}) {
    if (!user?.id) return;
    const [saved, sync] = await Promise.all([
      cloudAccountLink(user.id), cloudSyncStatus(user.id)
    ]);
    setLink(saved);
    setStatus(sync);
    if (enabled && verify && saved?.accountId) {
      // No HTTP status means the server was not reached (offline, timeout);
      // a status other than 401 means it answered but cannot serve right now.
      const verified = await verifyCloudSession(user.id).catch(err => ({ connected: false, reason: err?.status ? 'unavailable' : 'offline' }));
      setSession(verified);
      if (verified.connected) {
        const nextEntitlement = await refreshCloudEntitlement(user.id).catch(() => null);
        if (nextEntitlement) setLink(await cloudAccountLink(user.id));
      }
    } else if (!saved?.accountId) setSession(null);
    // A reload without re-verifying (after Sync, a purchase or a refresh) keeps
    // the session it already verified; it must not drop a connected account
    // back to "sign in" (CP-05 review).
    else setSession(prev => (prev?.connected ? prev : { connected: false, reason: enabled ? 'not-verified' : 'cloud-disabled' }));
  }

  useEffect(() => {
    reload().catch(() => setSession(prev => prev || { connected: false, reason: 'unavailable' }));
  }, [user?.id, enabled]);

  useEffect(() => {
    let live = true;
    if (!enabled) {
      setPricing(null);
      setWebCheckout(false);
      return () => { live = false; };
    }
    cloud.billingConfig()
      .then(result => {
        if (!live) return;
        setPricing(normalizeCommercialDisplay(result?.display));
        setWebCheckout(result?.webCheckout?.configured === true);
      })
      .catch(() => {
        if (!live) return;
        setPricing(null);
        setWebCheckout(false);
      });
    return () => { live = false; };
  }, [enabled]);

  // The server mints the opaque appAccountToken and decides which product ids
  // this deployment sells. StoreKit then supplies localized storefront names and
  // prices; no client constant is allowed to impersonate App Store pricing.
  useEffect(() => {
    let live = true;
    if (!canSync || !nativeStoreKit) {
      setAppleBootstrap(null);
      setAppleProducts([]);
      setAppleStoreError('');
      return () => { live = false; };
    }
    (async () => {
      const result = await cloud.appleBillingBootstrap();
      const bootstrap = result?.apple;
      const productIds = [bootstrap?.products?.monthly, bootstrap?.products?.annual].filter(Boolean);
      if (!bootstrap?.appAccountToken || !productIds.length) throw new Error('App Store subscriptions are not configured for this account.');
      const products = await getNativeProducts(productIds);
      if (!live) return;
      setAppleBootstrap(bootstrap);
      setAppleProducts(products);
      setAppleStoreError(products.length ? '' : tLater('cloud.storefrontMissing'));
    })().catch(err => {
      if (!live) return;
      setAppleBootstrap(null);
      setAppleProducts([]);
      setAppleStoreError(err.message || tLater('cloud.appleUnavailable'));
    });
    return () => { live = false; };
  }, [canSync, nativeStoreKit, link?.accountId]);

  async function acceptAppleTransaction(transaction, { quiet = false } = {}) {
    const transactionId = String(transaction?.transactionId || '');
    const signedTransaction = String(transaction?.signedTransaction || '');
    if (!transactionId || !signedTransaction || appleInFlight.current.has(transactionId)) return false;
    appleInFlight.current.add(transactionId);
    try {
      // This call is the Premium authority. StoreKit's local .verified result is
      // not enough: the server independently verifies Apple's JWS and account
      // binding before it changes the entitlement snapshot.
      await cloud.submitAppleTransaction(signedTransaction);
      // Finish only after server acceptance. If this step itself fails, StoreKit
      // redelivers the unfinished transaction and the server call is idempotent.
      try {
        await finishNativeTransaction(transactionId);
      } catch (err) {
        // The same transaction can be delivered twice (Transaction.updates and
        // the unfinished sweep). If an earlier delivery already finished it,
        // the server has accepted it and there is nothing left to do.
        if (err?.detail?.providerCode !== 'STOREKIT_TRANSACTION_NOT_PENDING') throw err;
      }
      await refreshCloudEntitlement(user.id);
      await reload({ verify: false });
      if (!quiet) setMessage(tLater('cloud.appleVerified'));
      return true;
    } finally {
      appleInFlight.current.delete(transactionId);
    }
  }

  // StoreKit redelivers any unfinished transaction here, including one from an
  // earlier launch whose server request failed. That turns the native queue into
  // recovery rather than a second source of entitlement truth.
  useEffect(() => {
    if (!canSync || !nativeStoreKit) return undefined;
    return onNativeBillingUpdate(detail => {
      acceptAppleTransaction(detail, { quiet: true }).catch(err => {
        setError(err.message || tLater('cloud.applePendingVerification'));
      });
    });
  }, [canSync, nativeStoreKit, user?.id]);

  async function submit(e) {
    e.preventDefault();
    if (!enabled) return;
    setBusy(mode);
    setError('');
    setMessage('');
    try {
      if (mode === 'register') {
        await registerCloudAccount(user.id, {
          name: form.name || user.name, email: form.email, password: form.password,
          year: user?.year, isAdult: form.isAdult,
          guardianName: form.guardianName, guardianEmail: form.guardianEmail
        });
        setMessage(tLater('cloud.created'));
      } else {
        await loginCloudAccount(user.id, { email: form.email, password: form.password });
        setMessage(tLater('cloud.connected'));
      }
      setForm(v => ({ ...v, password: '' }));
      await reload();
    } catch (err) { setError(err.message || tLater('cloud.connectFailed')); }
    finally { setBusy(''); }
  }

  async function requestReset() {
    if (!enabled) return;
    if (!form.email.trim()) {
      setError(tLater('cloud.enterEmailFirst'));
      return;
    }
    setBusy('reset');
    setError('');
    setMessage('');
    try {
      await cloud.requestPasswordReset({ email: form.email });
      // The server deliberately gives the same response whether or not an account
      // exists, so the UI must preserve that enumeration-safe contract.
      setMessage(tLater('cloud.resetQueued'));
    } catch (err) { setError(err.message || tLater('cloud.resetFailed')); }
    finally { setBusy(''); }
  }

  async function doSync() {
    setBusy('sync');
    setError('');
    setMessage('');
    try {
      const result = await syncNow(user.id);
      setMessage(tLater('cloud.syncComplete', {
        pushedEvents: result.pushedEvents || 0, pushedEntities: result.pushedEntities || 0,
        pulledEvents: result.pulledEvents || 0, pulledEntities: result.pulledEntities || 0
      }));
      await reload({ verify: false });
    } catch (err) {
      // CP-11: below the server's minimum shell build. Say what to do; the
      // outbox keeps every change on this device until the app is updated.
      setError(err?.code === 'CLIENT_UPGRADE_REQUIRED' ? tLater('cloud.upgradeRequired') : (err.message || tLater('cloud.syncFailed')));
      await reload({ verify: false }).catch(() => {});
    }
    finally { setBusy(''); }
  }

  async function startWebCheckout(cadence) {
    if (!canUseWebBilling) return;
    setBusy(`checkout-${cadence}`);
    setError('');
    setMessage('');
    try {
      const result = await cloud.createWebBillingCheckout(cadence);
      const checkout = result?.checkout;
      let destination;
      try {
        destination = new URL(String(checkout?.checkoutUrl || ''));
        if (destination.protocol !== 'https:' || destination.hostname !== 'rzp.io') throw new Error('invalid hosted checkout');
      } catch {
        throw new Error('The payment provider returned an invalid checkout address.');
      }
      // The hosted provider page performs payment authorisation. Returning from
      // it does not itself unlock Premium; the verified server webhook/restore is
      // the only entitlement authority.
      window.location.assign(destination.toString());
    } catch (err) {
      setError(err.message || tLater('cloud.checkoutFailed'));
      setBusy('');
    }
  }

  async function restoreWebBilling() {
    if (!canUseWebBilling) return;
    setBusy('restore-web');
    setError('');
    setMessage('');
    try {
      await cloud.restoreBilling('web', {});
      await refreshCloudEntitlement(user.id);
      await reload({ verify: false });
      setMessage(tLater('cloud.webRestored'));
    } catch (err) { setError(err.message || tLater('cloud.webRestoreFailed')); }
    finally { setBusy(''); }
  }

  /**
   * Cancel a website subscription.
   *
   * The refund policy has promised this control since it was written; the
   * server route and the transport call both existed and nothing in the app
   * ever reached them, so the document was describing a button that was not
   * there. Cancelling takes effect at the end of the period already paid for,
   * which is what the policy says and what the server does.
   */
  async function cancelWebSubscription() {
    if (!canUseWebBilling) return;
    // Ending a subscription is not something to do on a mis-tap.
    if (!window.confirm(t('cloud.cancelConfirm'))) return;
    setBusy('cancel-web');
    setError('');
    setMessage('');
    try {
      await cloud.cancelWebBilling();
      await refreshCloudEntitlement(user.id);
      await reload({ verify: false });
      setMessage(tLater('cloud.cancelled'));
    } catch (err) {
      setError(err?.code === 'BILLING_SUBSCRIPTION_NOT_CANCELLABLE'
        ? tLater('cloud.nothingToCancel')
        : err.message || tLater('cloud.cancelFailed'));
    } finally { setBusy(''); }
  }

  async function startApplePurchase(product) {
    if (!canUseAppleBilling || !product?.id) return;
    setBusy(`apple-${product.id}`);
    setError('');
    setMessage('');
    try {
      const result = await purchaseNativeProduct(product.id, appleBootstrap.appAccountToken);
      if (result?.status === 'cancelled') {
        setMessage(tLater('cloud.appleCancelled'));
        return;
      }
      if (result?.status === 'pending') {
        setMessage(tLater('cloud.applePending'));
        return;
      }
      if (result?.status !== 'verified') throw new Error('The App Store did not return a verified transaction.');
      await acceptAppleTransaction(result);
    } catch (err) { setError(err.message || tLater('cloud.applePurchaseFailed')); }
    finally { setBusy(''); }
  }

  async function restoreAppleBilling() {
    if (!canUseAppleBilling) return;
    setBusy('restore-apple');
    setError('');
    setMessage('');
    try {
      const productIds = [appleBootstrap?.products?.monthly, appleBootstrap?.products?.annual].filter(Boolean);
      const transactions = await restoreNativePurchases(productIds);
      if (!transactions.length) {
        setMessage(tLater('cloud.appleNoneFound'));
        return;
      }
      // A transaction bound to another Pri account on this Apple ID is refused
      // by the server and must not stop this account's own from restoring.
      const { accepted, lastError } = await acceptEachTransaction(transactions, transaction => acceptAppleTransaction(transaction, { quiet: true }));
      if (!accepted) throw lastError || new Error('No App Store transaction could be verified for this Pri Learning account.');
      setMessage(tLater('cloud.appleRestored', { count: accepted, n: accepted }));
    } catch (err) { setError(err.message || tLater('cloud.appleRestoreFailed')); }
    finally { setBusy(''); }
  }

  async function disconnect() {
    setBusy('disconnect');
    setError('');
    try {
      await disconnectCloudAccount(user.id);
      setLink(null); setStatus(null); setSession(null);
      setAppleBootstrap(null); setAppleProducts([]);
      setMessage(tLater('cloud.disconnected'));
    } catch (err) { setError(err.message || tLater('cloud.disconnectFailed')); }
    finally { setBusy(''); }
  }

  async function securityDisconnected({ cloudDeleted = false } = {}) {
    setLink(null);
    setStatus(null);
    setSession(null);
    setAppleBootstrap(null);
    setAppleProducts([]);
    setMessage(cloudDeleted
      ? tLater('cloud.deletedOffline')
      : tLater('cloud.sessionEnded'));
  }

  const stateLabel = useMemo(() => {
    if (!link?.accountId) return t('cloud.stateNotConnected');
    if (!enabled) return t('cloud.stateLinkedLocal');
    // Only the server saying "signed out" (401) means sign in again; an
    // unreachable server is offline, and the student's work is safe locally.
    if (!session || session.reason === 'not-verified') return t('cloud.stateChecking');
    if (!session.connected) {
      if (session.reason === 'signed-out') return t('cloud.stateSignInRequired');
      if (session.reason === 'offline') return t('cloud.stateOffline');
      return t('cloud.stateUnavailable');
    }
    return t('cloud.stateConnected');
  }, [link, enabled, session, t]);
  const cloudOffline = !!(enabled && link?.accountId && session && !session.connected && session.reason === 'offline');

  return (
    <section className="card" aria-labelledby="cloud-account-title" style={{ marginTop: 18 }}>
      <div className="spread" style={{ alignItems: 'flex-start', gap: 16 }}>
        <div>
          <div className="card-title" id="cloud-account-title" style={{ marginBottom: 4 }}>{t('cloud.title')}</div>
          <p className="sub" style={{ margin: 0, maxWidth: 720 }}>
            {t('cloud.intro')}
          </p>
        </div>
        <span className={`tag ${session?.connected ? 'tag-brand' : ''}`}>{stateLabel}</span>
      </div>

      {!enabled && <div style={{ marginTop: 14 }} className="muted">
        {t('cloud.disabled')}
      </div>}

      {guardian?.required && guardian.state !== 'given' && (
        <div role="status" style={{ marginTop: 14, padding: '10px 12px', border: '1px solid var(--warn)', borderRadius: 10, fontSize: 13 }}>
          {guardian.state === 'pending'
            ? (guardian.guardianEmail
              ? tx('cloud.guardianPendingAt', { email: <b>{guardian.guardianEmail}</b>, safe: <b>{t('cloud.guardianPendingSafe')}</b> })
              : tx('cloud.guardianPending', { safe: <b>{t('cloud.guardianPendingSafe')}</b> }))
            : t('cloud.guardianDeclined')}
        </div>
      )}
      {guardian?.required && guardian.state === 'given' && (
        <p className="muted" style={{ marginTop: 12, fontSize: 12.5 }}>
          {tx('cloud.guardianGiven', { privacy: <a href="/privacy" target="_blank" rel="noreferrer">{t('cloud.privacyNotice')}</a> })}
        </p>
      )}
      {cloudOffline && (
        <div role="status" className="muted" data-cloud-offline style={{ marginTop: 12, fontSize: 13 }}>
          {t('cloud.offlineNote')}
        </div>
      )}
      {enabled && !link?.accountId && <form onSubmit={submit} style={{ marginTop: 16 }}>
        <div className="row" style={{ gap: 8, marginBottom: 12 }}>
          <button type="button" className={`btn btn-sm ${mode === 'login' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMode('login')}>{t('cloud.signIn')}</button>
          <button type="button" className={`btn btn-sm ${mode === 'register' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMode('register')}>{t('cloud.createAccount')}</button>
        </div>
        <div className="grid cols-2" style={{ gap: 12 }}>
          {mode === 'register' && <div className="field">
            <label className="label" htmlFor="cloud-name">{t('cloud.yourName')}</label>
            <input className="input" id="cloud-name" autoComplete="name" maxLength={80} value={form.name} onChange={e => setForm(v => ({ ...v, name: e.target.value }))} required />
          </div>}
          <div className="field">
            <label className="label" htmlFor="cloud-email">{t('cloud.yourEmail')}</label>
            <input className="input" id="cloud-email" type="email" autoComplete="email" maxLength={254} value={form.email} onChange={e => setForm(v => ({ ...v, email: e.target.value }))} required />
          </div>
          <div className="field">
            <label className="label" htmlFor="cloud-password">{t('login.password')}</label>
            <input className="input" id="cloud-password" type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} minLength={10} maxLength={200} value={form.password} onChange={e => setForm(v => ({ ...v, password: e.target.value }))} required />
          </div>
        </div>
        {mode === 'register' && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line, rgba(128,128,128,.22))' }}>
            {/* Asked before the account exists, not after. Under the DPDP Act a
                child is anyone under 18, so this is nearly every student here,
                and the server will not sync a child's account until a guardian
                confirms. Saying so up front is the difference between a gate a
                student understands and one that looks like a fault. */}
            <label className="row" style={{ gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.isAdult} onChange={e => setForm(v => ({ ...v, isAdult: e.target.checked }))} />
              <span>{t('cloud.isAdult')}</span>
            </label>

            {!form.isAdult && (
              <div style={{ marginTop: 10 }}>
                <p className="muted" style={{ fontSize: 12.5, marginTop: 0, maxWidth: 520 }}>
                  {tx('cloud.under18', { keepsWorking: <b>{t('cloud.under18KeepsWorking')}</b> })}
                </p>
                <div className="grid cols-2" style={{ gap: 12 }}>
                  <div className="field">
                    <label className="label" htmlFor="cloud-guardian-name">{t('cloud.guardianName')}</label>
                    <input className="input" id="cloud-guardian-name" maxLength={80} value={form.guardianName}
                      onChange={e => setForm(v => ({ ...v, guardianName: e.target.value }))} required />
                  </div>
                  <div className="field">
                    <label className="label" htmlFor="cloud-guardian-email">{t('cloud.guardianEmail')}</label>
                    <input className="input" id="cloud-guardian-email" type="email" maxLength={160} value={form.guardianEmail}
                      onChange={e => setForm(v => ({ ...v, guardianEmail: e.target.value }))} required />
                  </div>
                </div>
              </div>
            )}

            {/* The notice has to be reachable at the point consent is asked for,
                not only from a screen the student saw before signing up. */}
            <label className="row" style={{ gap: 8, alignItems: 'flex-start', marginTop: 12, cursor: 'pointer' }}>
              <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} required />
              <span style={{ fontSize: 13 }}>
                {tx('cloud.consent', {
                  privacy: <a href="/privacy" target="_blank" rel="noreferrer">{t('cloud.privacyNotice')}</a>,
                  terms: <a href="/terms" target="_blank" rel="noreferrer">{t('cloud.terms')}</a>
                })}
              </span>
            </label>
          </div>
        )}

        <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          <button className="btn btn-primary" type="submit" disabled={!!busy || (mode === 'register' && !agreed)}>
            {busy === mode ? t('cloud.connecting') : mode === 'register' ? t('cloud.createAndConnect') : t('cloud.connectAccount')}
          </button>
          {mode === 'login' && <button className="btn btn-quiet" type="button" onClick={requestReset} disabled={!!busy}>
            {busy === 'reset' ? t('cloud.requesting') : t('cloud.forgotPassword')}
          </button>}
        </div>
      </form>}

      {link?.accountId && <div className="grid cols-2" style={{ gap: 14, marginTop: 16 }}>
        <div className="card" style={{ boxShadow: 'none' }}>
          <div className="sc-label">{t('cloud.identity')}</div>
          <div style={{ fontWeight: 680, marginTop: 4 }}>{liveAccount?.name || user.name}</div>
          <div className="muted" style={{ fontSize: 13 }}>{liveAccount?.email || t('cloud.detailsAfterSignIn')}</div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            <span className="tag">{liveAccount?.role || link.role}</span>
            <span className="tag">{(liveAccount?.emailVerified ?? link.emailVerified) ? t('cloud.emailVerified') : t('cloud.emailPending')}</span>
          </div>
        </div>
        <div className="card" style={{ boxShadow: 'none' }}>
          <div className="sc-label">{t('cloud.premiumAuthority')}</div>
          <div style={{ fontWeight: 680, marginTop: 4 }}>{premium ? t('cloud.premiumActive') : t('cloud.free')}</div>
          <div className="muted" style={{ fontSize: 13 }}>
            {premium ? `${entitlement.status} · ${entitlement.provider}` : entitlement?.stale ? t('cloud.cacheExpired') : t('cloud.noEntitlement')}
          </div>
          {entitlement?.offlineUntil && <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{t('cloud.offlineUntil', { when: when(entitlement.offlineUntil, t) })}</div>}

          {canUseWebBilling && <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            {!premium && pricing?.monthly && <button className="btn btn-sm btn-primary" type="button" disabled={!!busy} onClick={() => startWebCheckout('monthly')}>
              {busy === 'checkout-monthly' ? t('cloud.opening') : t('cloud.monthlyPrice', { price: price(pricing.monthly, pricing.currency) })}
            </button>}
            {!premium && pricing?.annual && <button className="btn btn-sm btn-ghost" type="button" disabled={!!busy} onClick={() => startWebCheckout('annual')}>
              {busy === 'checkout-annual' ? t('cloud.opening') : t('cloud.annualPrice', { price: price(pricing.annual, pricing.currency) })}
            </button>}
            <button className="btn btn-sm btn-quiet" type="button" disabled={!!busy} onClick={restoreWebBilling}>
              {busy === 'restore-web' ? t('cloud.restoring') : t('cloud.restoreWeb')}
            </button>
            {premium && entitlement?.provider === 'web' && (
              <button className="btn btn-sm btn-quiet" type="button" disabled={!!busy} onClick={cancelWebSubscription}>
                {busy === 'cancel-web' ? t('cloud.cancelling') : t('cloud.cancelSubscription')}
              </button>
            )}
          </div>}

          {nativeShell && nativeStoreKit && <div style={{ marginTop: 12 }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
              {t('cloud.storeKitNote')}
            </div>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              {!premium && appleMonthly && <button className="btn btn-sm btn-primary" type="button" disabled={!canUseAppleBilling || !!busy} onClick={() => startApplePurchase(appleMonthly)}>
                {busy === `apple-${appleMonthly.id}` ? t('cloud.purchasing') : t('cloud.monthlyPrice', { price: appleMonthly.displayPrice })}
              </button>}
              {!premium && appleAnnual && <button className="btn btn-sm btn-ghost" type="button" disabled={!canUseAppleBilling || !!busy} onClick={() => startApplePurchase(appleAnnual)}>
                {busy === `apple-${appleAnnual.id}` ? t('cloud.purchasing') : t('cloud.annualPrice', { price: appleAnnual.displayPrice })}
              </button>}
              <button className="btn btn-sm btn-quiet" type="button" disabled={!canUseAppleBilling || !!busy} onClick={restoreAppleBilling}>
                {busy === 'restore-apple' ? t('cloud.restoring') : t('cloud.restoreApple')}
              </button>
            </div>
            {appleStoreError && <div style={{ color: 'var(--bad)', fontSize: 12, marginTop: 7 }}>{appleStoreError}</div>}
          </div>}

          {nativeShell && googlePlay && <GooglePlayBilling user={user} canSync={canSync} premium={premium}
            onChanged={() => reload({ verify: false })} />}

          {nativeShell && !nativeStore && <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            {t('cloud.noStoreBilling')}
          </div>}
        </div>
      </div>}

      {link?.accountId && <div className="card" style={{ boxShadow: 'none', marginTop: 14 }}>
        <div className="spread" style={{ gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div className="sc-label">{t('cloud.syncStatus')}</div>
            <div style={{ fontWeight: 650, marginTop: 3 }}>{pending ? t('cloud.pendingChanges', { count: pending, n: pending }) : t('cloud.outboxClear')}</div>
            <div className="muted" style={{ fontSize: 12 }}>{t('cloud.lastSync', { when: when(status?.lastSyncAt, t) })}</div>
            {status?.lastError === 'CLIENT_UPGRADE_REQUIRED'
              ? <div role="status" data-cloud-upgrade style={{ color: 'var(--bad)', fontSize: 12 }}>{t('cloud.upgradeRequired')}</div>
              : status?.lastError && <div style={{ color: 'var(--bad)', fontSize: 12 }}>{t('cloud.lastError', { error: status.lastError })}</div>}
          </div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" type="button" onClick={doSync} disabled={!canSync || !!busy}>{busy === 'sync' ? t('cloud.syncing') : t('cloud.syncNow')}</button>
            <button className="btn btn-ghost" type="button" onClick={() => refreshCloudEntitlement(user.id).then(() => reload({ verify: false })).catch(err => setError(err.message))} disabled={!canSync || !!busy}>{t('cloud.refreshPremium')}</button>
            <button className="btn btn-quiet" type="button" onClick={disconnect} disabled={!!busy}>{t('cloud.disconnect')}</button>
          </div>
        </div>
      </div>}

      {session?.connected && liveAccount && <CloudAccountSecurity
        pid={user.id}
        account={liveAccount}
        onChanged={() => reload()}
        onDeleted={securityDisconnected}
      />}

      <div className="muted" style={{ marginTop: 14, fontSize: 12.5 }}>
        {nativeStoreKit && appleProducts.length
          ? t('cloud.appleAuthorityNote')
          : pricingText(pricing, t)}
      </div>

      {message && <div role="status" style={{ marginTop: 12, color: 'var(--good)' }}>{message}</div>}
      {error && <div role="alert" style={{ marginTop: 12, color: 'var(--bad)' }}>{error}</div>}
    </section>
  );
}