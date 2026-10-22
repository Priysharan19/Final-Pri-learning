// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the App Store purchase and restore flow, shared
//
// Extracted unchanged from the account panel (components/CloudAccountPanel.jsx)
// so the Premium screen (paywall/Paywall.jsx) runs the same flow. Premium only
// ever comes from the server: StoreKit's local "verified" result is handed to
// the server, which verifies Apple's JWS and the account binding before it
// changes the entitlement snapshot; the transaction is finished only after
// that, and the device then re-reads the server's entitlement.
//
// The caller owns the busy/message/error state (the account panel shares it
// with its other flows) and passes the setters in.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';
import { cloud } from '../platform/cloudTransport.js';
import { refreshCloudEntitlement } from '../platform/cloudAccount.js';
import {
  finishNativeTransaction, getNativeProducts, acceptEachTransaction,
  onNativeBillingUpdate, purchaseNativeProduct, restoreNativePurchases
} from '../platform/nativeBilling.js';
import { tLater } from '../i18n/index.js';

const noop = () => {};

export function useStoreKitPurchase({
  user, canSync, nativeStoreKit, accountId = null,
  setBusy = noop, setMessage = noop, setError = noop, onAccepted = null
}) {
  const [appleBootstrap, setAppleBootstrap] = useState(null);
  const [appleProducts, setAppleProducts] = useState([]);
  const [appleStoreError, setAppleStoreError] = useState('');
  // True when this deployment or storefront sells no App Store subscription
  // (server billing not configured, or StoreKit returns none of its products).
  // That is a state, not a fault: the panel says Premium is not on sale yet
  // instead of showing an error and buttons that cannot work.
  const [appleNotOnSale, setAppleNotOnSale] = useState(false);
  const appleInFlight = useRef(new Set());
  const accepted = useRef(onAccepted);
  accepted.current = onAccepted;

  const canUseAppleBilling = canSync && nativeStoreKit && !!appleBootstrap?.appAccountToken;
  const appleMonthly = appleProducts.find(product => product.id === appleBootstrap?.products?.monthly) || null;
  const appleAnnual = appleProducts.find(product => product.id === appleBootstrap?.products?.annual) || null;

  // The server mints the opaque appAccountToken and decides which product ids
  // this deployment sells. StoreKit then supplies localized storefront names and
  // prices; no client constant is allowed to impersonate App Store pricing.
  useEffect(() => {
    let live = true;
    if (!canSync || !nativeStoreKit) {
      setAppleBootstrap(null);
      setAppleProducts([]);
      setAppleStoreError('');
      setAppleNotOnSale(false);
      return () => { live = false; };
    }
    (async () => {
      let result;
      try { result = await cloud.appleBillingBootstrap(); }
      catch (err) {
        if (err?.code === 'BILLING_PROVIDER_NOT_CONFIGURED') return { notOnSale: true };
        throw err;
      }
      const bootstrap = result?.apple;
      const productIds = [bootstrap?.products?.monthly, bootstrap?.products?.annual].filter(Boolean);
      if (!bootstrap?.appAccountToken || !productIds.length) return { notOnSale: true };
      const products = await getNativeProducts(productIds);
      return { bootstrap, products, notOnSale: !products.length };
    })().then(({ bootstrap = null, products = [], notOnSale }) => {
      if (!live) return;
      setAppleBootstrap(bootstrap);
      setAppleProducts(products);
      setAppleNotOnSale(notOnSale);
      setAppleStoreError('');
    }).catch(err => {
      if (!live) return;
      setAppleBootstrap(null);
      setAppleProducts([]);
      setAppleNotOnSale(false);
      setAppleStoreError(err.message || tLater('cloud.appleUnavailable'));
    });
    return () => { live = false; };
  }, [canSync, nativeStoreKit, accountId]);

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
      if (accepted.current) await accepted.current();
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
      const { accepted: count, lastError } = await acceptEachTransaction(transactions, transaction => acceptAppleTransaction(transaction, { quiet: true }));
      if (!count) throw lastError || new Error('No App Store transaction could be verified for this Pri Learning account.');
      setMessage(tLater('cloud.appleRestored', { count, n: count }));
    } catch (err) { setError(err.message || tLater('cloud.appleRestoreFailed')); }
    finally { setBusy(''); }
  }

  /** Forget the storefront state (sign-out, disconnect). */
  function resetAppleBilling() {
    setAppleBootstrap(null);
    setAppleProducts([]);
  }

  return {
    appleBootstrap, appleProducts, appleMonthly, appleAnnual, appleStoreError, appleNotOnSale,
    canUseAppleBilling, startApplePurchase, restoreAppleBilling, resetAppleBilling
  };
}
