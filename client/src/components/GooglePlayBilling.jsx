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
import React, { useEffect, useRef, useState } from 'react';
import { cloud } from '../platform/cloudTransport.js';
import { refreshCloudEntitlement } from '../platform/cloudAccount.js';
import {
  getNativeProducts, onNativeBillingUpdate, purchaseGoogleSubscription, restoreNativePurchases, unfinishedNativeTransactions
} from '../platform/nativeBilling.js';

function matchPlan(products, plan) {
  if (!plan?.productId) return null;
  return products.find(p => p.id === plan.productId && (!plan.basePlanId || p.basePlanId === plan.basePlanId)) || null;
}

export default function GooglePlayBilling({ user, canSync, premium, onChanged }) {
  const [bootstrap, setBootstrap] = useState(null);
  const [plans, setPlans] = useState({ monthly: null, annual: null });
  const [storeError, setStoreError] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const inFlight = useRef(new Set());

  useEffect(() => {
    let live = true;
    if (!canSync) { setBootstrap(null); setPlans({ monthly: null, annual: null }); setStoreError(''); return () => { live = false; }; }
    (async () => {
      const result = await cloud.googleBillingBootstrap();
      const google = result?.google;
      const ids = [google?.products?.monthly?.productId, google?.products?.annual?.productId].filter(Boolean);
      if (!google?.obfuscatedAccountId || !ids.length) throw new Error('Google Play subscriptions are not configured for this account.');
      const products = await getNativeProducts(ids);
      if (!live) return;
      const found = { monthly: matchPlan(products, google.products.monthly), annual: matchPlan(products, google.products.annual) };
      setBootstrap(google);
      setPlans(found);
      setStoreError(found.monthly || found.annual ? '' : 'The Pri Learning subscription is not available in this Google Play country.');
      // A purchase from an earlier session the server never saw (the app was
      // killed, offline, or the sheet outlived the wait) is reported now, so
      // the server verifies and acknowledges it inside Play's three days.
      for (const t of await unfinishedNativeTransactions(ids).catch(() => [])) {
        if (live && t?.purchaseToken && (!t.state || t.state === 'purchased')) await submit(t.purchaseToken, { quiet: true }).catch(() => {});
      }
    })().catch(err => {
      if (!live) return;
      setBootstrap(null);
      setPlans({ monthly: null, annual: null });
      setStoreError(err.message || 'Google Play subscriptions are unavailable.');
    });
    return () => { live = false; };
  }, [canSync, user?.id]);

  /** The server is the authority: Google's answer about this token decides. */
  async function submit(purchaseToken, { quiet = false } = {}) {
    const token = String(purchaseToken || '');
    if (!token || inFlight.current.has(token)) return false;
    inFlight.current.add(token);
    try {
      const result = await cloud.submitGooglePurchase(token);
      if (result?.pending) {
        if (!quiet) setMessage('Google Play is still processing this payment. Premium unlocks once Google confirms it.');
        return false;
      }
      if (result?.superseded) return false;
      await refreshCloudEntitlement(user.id);
      await onChanged?.();
      if (!quiet) setMessage('Google Play purchase verified. Premium status has been refreshed from the server.');
      return true;
    } finally {
      inFlight.current.delete(token);
    }
  }

  // Purchases that finished after the sheet closed, renewals restored by Play,
  // and purchases from an earlier launch the server never saw.
  useEffect(() => {
    if (!canSync) return undefined;
    return onNativeBillingUpdate(detail => {
      if (!detail?.purchaseToken || (detail.state && detail.state !== 'purchased')) return;
      submit(detail.purchaseToken, { quiet: true }).catch(err => setError(err.message || 'A Google Play purchase is waiting for server verification.'));
    });
  }, [canSync, user?.id]);

  async function buy(plan) {
    if (!bootstrap || !plan) return;
    setBusy(`google-${plan.basePlanId}`); setError(''); setMessage('');
    try {
      const result = await purchaseGoogleSubscription({ productId: plan.id, basePlanId: plan.basePlanId, obfuscatedAccountId: bootstrap.obfuscatedAccountId });
      if (result?.status === 'cancelled') { setMessage('Google Play purchase cancelled. No subscription change was made.'); return; }
      if (result?.status === 'pending' || result?.state === 'pending') {
        setMessage('The Google Play payment is pending. Premium unlocks only after Google confirms it and the server verifies the purchase.');
        return;
      }
      if (!result?.purchaseToken) throw new Error('Google Play did not return a purchase.');
      await submit(result.purchaseToken);
    } catch (err) { setError(err.message || 'Could not complete the Google Play purchase.'); }
    finally { setBusy(''); }
  }

  async function restore() {
    if (!bootstrap) return;
    setBusy('restore-google'); setError(''); setMessage('');
    try {
      const ids = [bootstrap.products?.monthly?.productId, bootstrap.products?.annual?.productId].filter(Boolean);
      const transactions = await restoreNativePurchases(ids);
      const tokens = transactions.map(t => t.purchaseToken).filter(Boolean);
      if (!tokens.length) { setMessage('No Pri Learning subscription was found for this Google account.'); return; }
      await cloud.restoreBilling('google', { purchaseTokens: tokens });
      await refreshCloudEntitlement(user.id);
      await onChanged?.();
      setMessage('Google Play subscription restored and verified by the server.');
    } catch (err) { setError(err.message || 'Could not restore Google Play purchases.'); }
    finally { setBusy(''); }
  }

  const manageUrl = bootstrap?.packageName
    ? `https://play.google.com/store/account/subscriptions?package=${encodeURIComponent(bootstrap.packageName)}`
    : 'https://play.google.com/store/account/subscriptions';

  return (
    <div style={{ marginTop: 12 }} data-google-play-billing>
      <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
        Prices below come from Google Play. Pri Learning unlocks Premium only after the server verifies the purchase with Google.
      </div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        {!premium && plans.monthly && <button className="btn btn-sm btn-primary" type="button" disabled={!bootstrap || !!busy} onClick={() => buy(plans.monthly)}>
          {busy === `google-${plans.monthly.basePlanId}` ? 'Purchasing…' : `Monthly ${plans.monthly.displayPrice}`}
        </button>}
        {!premium && plans.annual && <button className="btn btn-sm btn-ghost" type="button" disabled={!bootstrap || !!busy} onClick={() => buy(plans.annual)}>
          {busy === `google-${plans.annual.basePlanId}` ? 'Purchasing…' : `Annual ${plans.annual.displayPrice}`}
        </button>}
        <button className="btn btn-sm btn-quiet" type="button" disabled={!bootstrap || !!busy} onClick={restore}>
          {busy === 'restore-google' ? 'Restoring…' : 'Restore Google Play purchases'}
        </button>
        <a className="btn btn-sm btn-quiet" href={manageUrl} target="_blank" rel="noreferrer">Manage in Google Play</a>
      </div>
      {storeError && <div style={{ color: 'var(--bad)', fontSize: 12, marginTop: 7 }}>{storeError}</div>}
      {error && <div style={{ color: 'var(--bad)', fontSize: 12, marginTop: 7 }} role="alert">{error}</div>}
      {message && <div className="muted" style={{ fontSize: 12, marginTop: 7 }} role="status">{message}</div>}
    </div>
  );
}
