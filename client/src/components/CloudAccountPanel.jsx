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
  finishNativeTransaction, getNativeProducts, nativeBillingAvailable,
  onNativeBillingUpdate, purchaseNativeProduct, restoreNativePurchases
} from '../platform/nativeBilling.js';
import CloudAccountSecurity from './CloudAccountSecurity.jsx';

function when(value) {
  if (!value) return 'Never';
  try { return new Date(value).toLocaleString(); } catch { return 'Unknown'; }
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

function pricingText(config) {
  if (!config) return 'Storefront pricing is not available while the cloud service is offline.';
  const monthly = price(config.monthly, config.currency);
  const annual = price(config.annual, config.currency);
  const pieces = [];
  if (monthly) pieces.push(`${monthly}/month`);
  if (annual) pieces.push(`${annual}/year`);
  if (!pieces.length) return 'Public pricing has not been configured for this deployment yet. Store/provider pricing remains authoritative.';
  const trial = config.trialDays ? ` with a ${config.trialDays}-day trial when eligible` : '';
  return `${pieces.join(' or ')}${trial}. Display pricing is advisory; checkout/storefront pricing and server entitlements remain authoritative.`;
}

export default function CloudAccountPanel() {
  const { user } = useApp();
  const enabled = cloudAvailable();
  const nativeShell = typeof window !== 'undefined' && !!window.__PRI_NATIVE__;
  const nativeStoreKit = nativeBillingAvailable();
  const [link, setLink] = useState(null);
  const [status, setStatus] = useState(null);
  const [session, setSession] = useState(null);
  const [pricing, setPricing] = useState(null);
  const [webCheckout, setWebCheckout] = useState(false);
  const [appleBootstrap, setAppleBootstrap] = useState(null);
  const [appleProducts, setAppleProducts] = useState([]);
  const [appleStoreError, setAppleStoreError] = useState('');
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: user?.name || '', email: '', password: '' });
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const appleInFlight = useRef(new Set());

  const entitlement = link?.entitlement;
  const premium = !!entitlement?.active;
  const pending = status?.pending || 0;
  const canSync = enabled && !!link?.accountId && !!session?.connected;
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
      const verified = await verifyCloudSession(user.id).catch(err => ({ connected: false, reason: err.code || 'unavailable' }));
      setSession(verified);
      if (verified.connected) {
        const nextEntitlement = await refreshCloudEntitlement(user.id).catch(() => null);
        if (nextEntitlement) setLink(await cloudAccountLink(user.id));
      }
    } else setSession(saved?.accountId ? { connected: false, reason: enabled ? 'not-verified' : 'cloud-disabled' } : null);
  }

  useEffect(() => { reload().catch(() => {}); }, [user?.id, enabled]);

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
      setAppleStoreError(products.length ? '' : 'The configured Pri Learning subscription is not available in this App Store storefront.');
    })().catch(err => {
      if (!live) return;
      setAppleBootstrap(null);
      setAppleProducts([]);
      setAppleStoreError(err.message || 'App Store subscriptions are unavailable.');
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
      await finishNativeTransaction(transactionId);
      await refreshCloudEntitlement(user.id);
      await reload({ verify: false });
      if (!quiet) setMessage('App Store purchase verified. Premium status has been refreshed from the server.');
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
        setError(err.message || 'An App Store purchase is waiting for server verification.');
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
        await registerCloudAccount(user.id, { name: form.name || user.name, email: form.email, password: form.password });
        setMessage('Cloud account created and linked to this local profile. Your local profile still works offline.');
      } else {
        await loginCloudAccount(user.id, { email: form.email, password: form.password });
        setMessage('Cloud account connected.');
      }
      setForm(v => ({ ...v, password: '' }));
      await reload();
    } catch (err) { setError(err.message || 'Could not connect this account.'); }
    finally { setBusy(''); }
  }

  async function requestReset() {
    if (!enabled) return;
    if (!form.email.trim()) {
      setError('Enter your email first.');
      return;
    }
    setBusy('reset');
    setError('');
    setMessage('');
    try {
      await cloud.requestPasswordReset({ email: form.email });
      // The server deliberately gives the same response whether or not an account
      // exists, so the UI must preserve that enumeration-safe contract.
      setMessage('If a Pri Learning account exists for that email, a password-reset email has been queued.');
    } catch (err) { setError(err.message || 'Could not request password recovery.'); }
    finally { setBusy(''); }
  }

  async function doSync() {
    setBusy('sync');
    setError('');
    setMessage('');
    try {
      const result = await syncNow(user.id);
      setMessage(`Sync complete: ${result.pushedEvents || 0} learning event(s), ${result.pushedEntities || 0} record(s) pushed; ${result.pulledEvents || 0} event(s), ${result.pulledEntities || 0} record(s) received.`);
      await reload({ verify: false });
    } catch (err) { setError(err.message || 'Sync could not complete. Your local work is still safe on this device.'); }
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
      setError(err.message || 'Could not start subscription checkout.');
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
      setMessage('Subscription status restored from the payment provider.');
    } catch (err) { setError(err.message || 'Could not restore the web subscription.'); }
    finally { setBusy(''); }
  }

  async function startApplePurchase(product) {
    if (!canUseAppleBilling || !product?.id) return;
    setBusy(`apple-${product.id}`);
    setError('');
    setMessage('');
    try {
      const result = await purchaseNativeProduct(product.id, appleBootstrap.appAccountToken);
      if (result?.status === 'cancelled') {
        setMessage('App Store purchase cancelled. No subscription change was made.');
        return;
      }
      if (result?.status === 'pending') {
        setMessage('The App Store purchase is pending approval. Premium will activate only after Apple verifies the transaction and the server accepts it.');
        return;
      }
      if (result?.status !== 'verified') throw new Error('The App Store did not return a verified transaction.');
      await acceptAppleTransaction(result);
    } catch (err) { setError(err.message || 'Could not complete the App Store purchase.'); }
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
        setMessage('No current Pri Learning subscription was found for this App Store account.');
        return;
      }
      let accepted = 0;
      for (const transaction of transactions) {
        if (await acceptAppleTransaction(transaction, { quiet: true })) accepted++;
      }
      if (!accepted) throw new Error('No App Store transaction could be verified for this Pri Learning account.');
      setMessage(`Restored ${accepted} verified App Store subscription transaction${accepted === 1 ? '' : 's'} and refreshed Premium.`);
    } catch (err) { setError(err.message || 'Could not restore App Store purchases.'); }
    finally { setBusy(''); }
  }

  async function disconnect() {
    setBusy('disconnect');
    setError('');
    try {
      await disconnectCloudAccount(user.id);
      setLink(null); setStatus(null); setSession(null);
      setAppleBootstrap(null); setAppleProducts([]);
      setMessage('Cloud account disconnected from this local profile. Local learning data was not deleted.');
    } catch (err) { setError(err.message || 'Could not disconnect.'); }
    finally { setBusy(''); }
  }

  async function securityDisconnected({ cloudDeleted = false } = {}) {
    setLink(null);
    setStatus(null);
    setSession(null);
    setAppleBootstrap(null);
    setAppleProducts([]);
    setMessage(cloudDeleted
      ? 'Cloud account deleted. This device’s separate offline profile remains available.'
      : 'Cloud session ended. This device’s separate offline profile remains available.');
  }

  const stateLabel = useMemo(() => {
    if (!link?.accountId) return 'Not connected';
    if (!enabled) return 'Linked locally · cloud endpoint unavailable';
    if (!session?.connected) return 'Linked · sign-in required';
    return 'Connected';
  }, [link, enabled, session]);

  return (
    <section className="card" aria-labelledby="cloud-account-title" style={{ marginTop: 18 }}>
      <div className="spread" style={{ alignItems: 'flex-start', gap: 16 }}>
        <div>
          <div className="card-title" id="cloud-account-title" style={{ marginBottom: 4 }}>Account & cross-device sync</div>
          <p className="sub" style={{ margin: 0, maxWidth: 720 }}>
            Your local profile remains available offline. Connecting a Pri Learning account adds authenticated cross-device sync and server-authorised Premium entitlements; it does not replace the local profile or its encryption keys.
          </p>
        </div>
        <span className={`tag ${session?.connected ? 'tag-brand' : ''}`}>{stateLabel}</span>
      </div>

      {!enabled && <div style={{ marginTop: 14 }} className="muted">
        This build has no Pri cloud origin configured, so account and sync controls are disabled. Offline practice continues normally.
      </div>}

      {enabled && !link?.accountId && <form onSubmit={submit} style={{ marginTop: 16 }}>
        <div className="row" style={{ gap: 8, marginBottom: 12 }}>
          <button type="button" className={`btn btn-sm ${mode === 'login' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMode('login')}>Sign in</button>
          <button type="button" className={`btn btn-sm ${mode === 'register' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMode('register')}>Create account</button>
        </div>
        <div className="grid cols-2" style={{ gap: 12 }}>
          {mode === 'register' && <div className="field">
            <label className="label" htmlFor="cloud-name">Name</label>
            <input className="input" id="cloud-name" autoComplete="name" maxLength={80} value={form.name} onChange={e => setForm(v => ({ ...v, name: e.target.value }))} required />
          </div>}
          <div className="field">
            <label className="label" htmlFor="cloud-email">Email</label>
            <input className="input" id="cloud-email" type="email" autoComplete="email" maxLength={254} value={form.email} onChange={e => setForm(v => ({ ...v, email: e.target.value }))} required />
          </div>
          <div className="field">
            <label className="label" htmlFor="cloud-password">Password</label>
            <input className="input" id="cloud-password" type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} minLength={10} maxLength={200} value={form.password} onChange={e => setForm(v => ({ ...v, password: e.target.value }))} required />
          </div>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          <button className="btn btn-primary" type="submit" disabled={!!busy}>
            {busy === mode ? 'Connecting…' : mode === 'register' ? 'Create and connect account' : 'Connect account'}
          </button>
          {mode === 'login' && <button className="btn btn-quiet" type="button" onClick={requestReset} disabled={!!busy}>
            {busy === 'reset' ? 'Requesting…' : 'Forgot password?'}
          </button>}
        </div>
      </form>}

      {link?.accountId && <div className="grid cols-2" style={{ gap: 14, marginTop: 16 }}>
        <div className="card" style={{ boxShadow: 'none' }}>
          <div className="sc-label">Cloud identity</div>
          <div style={{ fontWeight: 680, marginTop: 4 }}>{liveAccount?.name || user.name}</div>
          <div className="muted" style={{ fontSize: 13 }}>{liveAccount?.email || 'Account details available after sign-in'}</div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            <span className="tag">{liveAccount?.role || link.role}</span>
            <span className="tag">{(liveAccount?.emailVerified ?? link.emailVerified) ? 'Email verified' : 'Email verification pending'}</span>
          </div>
        </div>
        <div className="card" style={{ boxShadow: 'none' }}>
          <div className="sc-label">Premium authority</div>
          <div style={{ fontWeight: 680, marginTop: 4 }}>{premium ? 'Premium active' : 'Free'}</div>
          <div className="muted" style={{ fontSize: 13 }}>
            {premium ? `${entitlement.status} · ${entitlement.provider}` : entitlement?.stale ? 'Paid cache expired; reconnect to refresh.' : 'No active paid entitlement.'}
          </div>
          {entitlement?.offlineUntil && <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Offline entitlement valid until {when(entitlement.offlineUntil)}</div>}

          {canUseWebBilling && <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            {!premium && pricing?.monthly && <button className="btn btn-sm btn-primary" type="button" disabled={!!busy} onClick={() => startWebCheckout('monthly')}>
              {busy === 'checkout-monthly' ? 'Opening…' : `Monthly ${price(pricing.monthly, pricing.currency)}`}
            </button>}
            {!premium && pricing?.annual && <button className="btn btn-sm btn-ghost" type="button" disabled={!!busy} onClick={() => startWebCheckout('annual')}>
              {busy === 'checkout-annual' ? 'Opening…' : `Annual ${price(pricing.annual, pricing.currency)}`}
            </button>}
            <button className="btn btn-sm btn-quiet" type="button" disabled={!!busy} onClick={restoreWebBilling}>
              {busy === 'restore-web' ? 'Restoring…' : 'Restore web subscription'}
            </button>
          </div>}

          {nativeShell && nativeStoreKit && <div style={{ marginTop: 12 }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
              App Store pricing below is loaded directly from StoreKit. Pri Learning unlocks Premium only after the server verifies Apple’s signed transaction.
            </div>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              {!premium && appleMonthly && <button className="btn btn-sm btn-primary" type="button" disabled={!canUseAppleBilling || !!busy} onClick={() => startApplePurchase(appleMonthly)}>
                {busy === `apple-${appleMonthly.id}` ? 'Purchasing…' : `Monthly ${appleMonthly.displayPrice}`}
              </button>}
              {!premium && appleAnnual && <button className="btn btn-sm btn-ghost" type="button" disabled={!canUseAppleBilling || !!busy} onClick={() => startApplePurchase(appleAnnual)}>
                {busy === `apple-${appleAnnual.id}` ? 'Purchasing…' : `Annual ${appleAnnual.displayPrice}`}
              </button>}
              <button className="btn btn-sm btn-quiet" type="button" disabled={!canUseAppleBilling || !!busy} onClick={restoreAppleBilling}>
                {busy === 'restore-apple' ? 'Restoring…' : 'Restore App Store purchases'}
              </button>
            </div>
            {appleStoreError && <div style={{ color: 'var(--bad)', fontSize: 12, marginTop: 7 }}>{appleStoreError}</div>}
          </div>}

          {nativeShell && !nativeStoreKit && <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            This native build does not include the StoreKit billing bridge. Web checkout is intentionally unavailable inside the iOS app.
          </div>}
        </div>
      </div>}

      {link?.accountId && <div className="card" style={{ boxShadow: 'none', marginTop: 14 }}>
        <div className="spread" style={{ gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div className="sc-label">Sync status</div>
            <div style={{ fontWeight: 650, marginTop: 3 }}>{pending ? `${pending} local change${pending === 1 ? '' : 's'} waiting` : 'Local outbox clear'}</div>
            <div className="muted" style={{ fontSize: 12 }}>Last successful sync: {when(status?.lastSyncAt)}</div>
            {status?.lastError && <div style={{ color: 'var(--bad)', fontSize: 12 }}>Last error: {status.lastError}</div>}
          </div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" type="button" onClick={doSync} disabled={!canSync || !!busy}>{busy === 'sync' ? 'Syncing…' : 'Sync now'}</button>
            <button className="btn btn-ghost" type="button" onClick={() => refreshCloudEntitlement(user.id).then(() => reload({ verify: false })).catch(err => setError(err.message))} disabled={!canSync || !!busy}>Refresh Premium</button>
            <button className="btn btn-quiet" type="button" onClick={disconnect} disabled={!!busy}>Disconnect</button>
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
          ? 'App Store prices are storefront-authoritative. Subscription state is server-authoritative and is also maintained by verified App Store Server Notifications.'
          : pricingText(pricing)}
      </div>

      {message && <div role="status" style={{ marginTop: 12, color: 'var(--good)' }}>{message}</div>}
      {error && <div role="alert" style={{ marginTop: 12, color: 'var(--bad)' }}>{error}</div>}
    </section>
  );
}