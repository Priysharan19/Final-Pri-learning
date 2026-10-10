import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../App.jsx';
import { cloud, cloudAvailable } from '../platform/cloudTransport.js';
import {
  cloudAccountLink, cloudDeviceId, disconnectCloudAccount, linkSignedInAccount,
  refreshCloudEntitlement, verifyCloudSession
} from '../platform/cloudAccount.js';
import { announceCloudSessionChange } from '../platform/cloudSession.js';
import { appleSignInAvailable, signInWithApple, takeAppleSignInIntent } from '../platform/native/appleSignIn.js';
import { AppleSignInButton } from '../pages/Login.jsx';
import { cloudSyncStatus, syncNow } from '../platform/syncWorker.js';
import { SYNC_EVENT, autoSyncStatus, noteManualSync } from '../platform/cloudSyncScheduler.js';
import { normalizeCommercialDisplay } from '../platform/entitlements.js';
import {
  finishNativeTransaction, getNativeProducts, nativeBillingStore,
  acceptEachTransaction, onNativeBillingUpdate, purchaseNativeProduct, restoreNativePurchases
} from '../platform/nativeBilling.js';
import GooglePlayBilling from './GooglePlayBilling.jsx';
import CloudAccountSecurity from './CloudAccountSecurity.jsx';
import { tLater, useT, useTx } from '../i18n/index.js';
import { priNative } from '../platform/native/index.js';
import { cloudErrorCopy } from '../platform/cloudErrorCopy.js';

// The one sign-in card (email code · configured providers · password), fetched
// only when this profile has no live session to show.
const SignInCard = React.lazy(() => import('./SignUpFlow.jsx'));

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
  // Unconfigured pricing is an operator fact, not something a student can act
  // on, so nothing is shown rather than a deployment note.
  if (!monthly && !annual) return null;
  const prices = monthly && annual
    ? t('cloud.priceBoth', { monthly, annual })
    : monthly ? t('cloud.priceMonthly', { price: monthly }) : t('cloud.priceAnnual', { price: annual });
  return config.trialDays
    ? t('cloud.pricingSummaryTrial', { prices, days: config.trialDays })
    : t('cloud.pricingSummary', { prices });
}

export default function CloudAccountPanel() {
  const { user, refreshUser } = useApp();
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
  const [autoSync, setAutoSync] = useState(() => autoSyncStatus(user?.id || null));
  const [session, setSession] = useState(null);
  const [pricing, setPricing] = useState(null);
  const [webCheckout, setWebCheckout] = useState(false);
  const [appleBootstrap, setAppleBootstrap] = useState(null);
  const [appleProducts, setAppleProducts] = useState([]);
  const [appleStoreError, setAppleStoreError] = useState('');
  // The age declaration a NEW account made with the native Apple sheet owes
  // (the sign-in card asks its own; this is only the shell's Apple road).
  const [form, setForm] = useState({
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
  // Sign in with Apple is offered only when the native shell advertises the
  // identity capability (never on plain web). `appleStep` is 'consent' while
  // the server is waiting for the age/guardian declaration a new account needs.
  const appleIdentity = appleSignInAvailable();
  const [appleStep, setAppleStep] = useState(null);
  const [appleLinked, setAppleLinked] = useState(null);
  const [linkLoaded, setLinkLoaded] = useState(false);
  const appleIntentTaken = useRef(false);

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
    setLinkLoaded(true);
  }

  useEffect(() => {
    reload().catch(() => setSession(prev => prev || { connected: false, reason: 'unavailable' }));
  }, [user?.id, enabled]);

  // Automatic syncs happen outside this panel; each one re-reads the status
  // line so "last sync" and the outbox count are what just happened.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onSync = () => {
      setAutoSync(autoSyncStatus(user?.id || null));
      reload({ verify: false }).catch(() => {});
    };
    window.addEventListener(SYNC_EVENT, onSync);
    return () => window.removeEventListener(SYNC_EVENT, onSync);
  }, [user?.id]);

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

  // Which providers the signed-in account already has, so "Link Apple ID" is
  // not offered for one that is linked. The list is the server's; a failure
  // to read it leaves the button out rather than guessing.
  useEffect(() => {
    if (!appleIdentity || !session?.connected) { setAppleLinked(null); return undefined; }
    let live = true;
    cloud.identities()
      .then(result => { if (live) setAppleLinked((result?.providers || []).some(row => row.provider === 'apple')); })
      .catch(() => { if (live) setAppleLinked(null); });
    return () => { live = false; };
  }, [appleIdentity, session?.connected, link?.accountId]);

  function appleFailureText(err) {
    switch (err?.code) {
      case 'IDENTITY_LINK_REQUIRED': return tLater('cloud.appleLinkRequired');
      case 'OIDC_EMAIL_REQUIRED': return tLater('cloud.appleEmailRequired');
      case 'OIDC_PROVIDER_NOT_CONFIGURED': return tLater('cloud.appleNotConfigured');
      case 'IDENTITY_EMAIL_MISMATCH': return tLater('cloud.appleEmailMismatch');
      case 'IDENTITY_ALREADY_LINKED': return tLater('cloud.appleAlreadyLinked');
      case 'GUARDIAN_EMAIL_SAME_AS_STUDENT': return tLater('cloudError.guardianEmailSameAsStudent');
      case 'CONSENT_DECLARATION_REQUIRED': case 'AGE_DECLARATION_REQUIRED': return tLater('cloudError.consentDeclarationRequired');
      case 'IDENTITY_NOT_REGISTERED': return tLater('cloud.appleSignInFailed');
      case 'CRYPTO_UNAVAILABLE': case 'IDENTITY_UNSUPPORTED': return tLater('cloud.appleUnavailableHere');
      default: return err?.message || tLater('cloud.appleSignInFailed');
    }
  }

  /** The declaration the register form already collects, in the register route's shape. */
  const appleDeclaration = () => ({ year: user?.year, isAdult: form.isAdult, guardianName: form.guardianName, guardianEmail: form.guardianEmail });

  /**
   * Sign in with Apple. The server issues the nonce, the shell runs the sheet,
   * the server verifies the token and sets the session; this panel then records
   * the link exactly as a password sign-in does (verifyCloudSession stores only
   * opaque ids) and announces the session to the rest of the app.
   */
  async function startAppleSignIn({ declaration = null } = {}) {
    if (!enabled || !appleIdentity || busy) return;
    setBusy('apple-sign-in');
    setError('');
    setMessage('');
    try {
      const deviceId = await cloudDeviceId();
      const outcome = await signInWithApple({ mode: 'sign-in', deviceId, declaration });
      if (outcome.status === 'cancelled') { setMessage(tLater('cloud.appleSignInCancelled')); return; }
      if (outcome.status === 'consent-required') {
        // A new account: the same age/guardian step as password sign-up, then
        // the sheet once more (the nonce was spent; Apple only re-confirms).
        setAppleStep('consent');
        setMessage(tLater('cloud.appleConsentNeeded'));
        return;
      }
      const verified = await verifyCloudSession(user.id);
      if (!verified.connected) throw Object.assign(new Error(''), { code: 'CLOUD_SESSION_UNVERIFIED' });
      announceCloudSessionChange({
        localProfileId: String(user.id), connected: true,
        accountId: String(verified.link?.accountId || ''), role: String(verified.link?.role || 'student')
      });
      await refreshCloudEntitlement(user.id).catch(() => {});
      setAppleStep(null);
      setMessage(outcome.guardianConsentRequired ? tLater('cloud.guardianPending', { safe: tLater('cloud.guardianPendingSafe') }) : tLater(outcome.created ? 'cloud.created' : 'cloud.connected'));
      await reload();
    } catch (err) {
      setError(err?.code === 'CLOUD_SESSION_UNVERIFIED' ? tLater('cloud.connectFailed') : appleFailureText(err));
    } finally { setBusy(''); }
  }

  /** Link Apple to the account that is signed in (the server requires the verified emails to match). */
  async function linkApple() {
    if (!canSync || !appleIdentity || busy) return;
    setBusy('apple-link');
    setError('');
    setMessage('');
    try {
      const outcome = await signInWithApple({ mode: 'link' });
      if (outcome.status === 'cancelled') { setMessage(tLater('cloud.appleSignInCancelled')); return; }
      setAppleLinked(true);
      setMessage(tLater('cloud.appleLinked'));
      await reload({ verify: false });
    } catch (err) { setError(appleFailureText(err)); }
    finally { setBusy(''); }
  }

  // The landing screen's Sign in with Apple button brings the person here with
  // the intent remembered; open the sheet once the profile's link is known to
  // be empty, and only once.
  useEffect(() => {
    if (!linkLoaded || appleIntentTaken.current || !enabled || !appleIdentity || link?.accountId) return;
    appleIntentTaken.current = true;
    if (takeAppleSignInIntent()) void startAppleSignIn();
  }, [linkLoaded, enabled, appleIdentity, link?.accountId]);

  /**
   * The sign-in card signed in (a code, a provider or the account's password).
   * The session cookie is device-wide; this records which local profile it
   * belongs to, exactly as every other sign-in on this panel does, and tells
   * the rest of the app. A profile already linked to a different account is
   * refused (cloudAccount.js) and the session that cannot be used here is
   * ended rather than left signed in beside the wrong profile.
   */
  async function cardSignedIn({ account }) {
    setError('');
    setMessage('');
    try {
      await linkSignedInAccount(user.id, account);
    } catch (err) {
      if (err?.code === 'CLOUD_LINK_CONFLICT') await cloud.logout().catch(() => {});
      throw err;
    }
    setMessage(tLater('cloud.connected'));
    await refreshUser?.().catch(() => {});
    await reload();
  }

  async function doSync() {
    setBusy('sync');
    setError('');
    setMessage('');
    try {
      const result = await syncNow(user.id);
      noteManualSync(result);
      setAutoSync(autoSyncStatus(user.id));
      setMessage(tLater('cloud.syncComplete', {
        pushedEvents: result.pushedEvents || 0, pushedEntities: result.pushedEntities || 0,
        pulledEvents: result.pulledEvents || 0, pulledEntities: result.pulledEntities || 0
      }));
      await reload({ verify: false });
    } catch (err) {
      // CP-11: below the server's minimum shell build. Say what to do; the
      // outbox keeps every change on this device until the app is updated.
      const copy = err?.code === 'CLIENT_UPGRADE_REQUIRED' ? null : cloudErrorCopy(err);
      setError(err?.code === 'CLIENT_UPGRADE_REQUIRED' ? tLater('cloud.upgradeRequired') : copy ? tLater(copy.key, copy.vars) : (err.message || tLater('cloud.syncFailed')));
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
  const needsSignIn = enabled && (!link?.accountId || session?.reason === 'signed-out');

  // ── The plain facts a student reads ────────────────────────────────────────
  // Each line says only what this device can show to be true right now.
  const accountLine = (() => {
    if (!link?.accountId) return t('cloud.factSignedOut');
    if (session?.connected) return liveAccount?.email ? t('cloud.factSignedInAs', { email: liveAccount.email }) : t('cloud.factSignedIn');
    if (session?.reason === 'signed-out') return t('cloud.factSignedOutAgain');
    if (session?.reason === 'offline') return t('cloud.stateOffline');
    if (!session || session.reason === 'not-verified') return t('cloud.stateChecking');
    return t('cloud.stateUnavailable');
  })();
  const studyLine = user?.course === 'in'
    ? `${t('common.classNumber', { n: user.year })} · ${user.indiaTrack === 'jee-main' ? 'JEE Main' : user.indiaTrack === 'jee-advanced' ? 'JEE Advanced' : user.indiaTrack === 'olympiad' ? t('login.olympiadTrack') : 'CBSE'}`
    : `${t('common.yearNumber', { n: user?.year })} · ${String(user?.course || '').toUpperCase()}`;
  // "Progress synced" is a claim, so it is made only when every part of it
  // holds: a live session, a sync that has actually completed, nothing left in
  // the outbox, and no error from the last attempt. Anything less says what is
  // true instead.
  const synced = canSync && !!status?.lastSyncAt && pending === 0 && !status?.lastError;
  const progressLine = !link?.accountId ? null
    : synced ? t('cloud.factSynced')
      : pending > 0 ? t('cloud.factPending', { count: pending, n: pending })
        : status?.lastError ? t('cloud.factSyncProblem')
          : !canSync ? t('cloud.factSyncWaiting')
            : t('cloud.factNotSyncedYet');
  const planLine = premium ? t('cloud.factPremium') : t('cloud.factFree');
  const staffRole = ['teacher', 'support', 'admin'].includes(liveAccount?.role || link?.role) ? (liveAccount?.role || link?.role) : null;

  return (
    <section className="card" aria-labelledby="cloud-account-title" style={{ marginTop: 18 }}>
      <div className="spread" style={{ alignItems: 'flex-start', gap: 16 }}>
        <div>
          <div className="card-title" id="cloud-account-title" style={{ marginBottom: 4 }}>{t('cloud.title')}</div>
          <p className="sub" style={{ margin: 0, maxWidth: 720 }}>
            {t('cloud.intro')}
          </p>
        </div>
        <span className={`tag ${session?.connected ? 'tag-brand' : ''}`} data-cloud-state>{stateLabel}</span>
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

      {/* Not signed in (or signed out by the server): the one sign-in card, in
          place. A profile whose session ended signs in again here and keeps
          everything on this device exactly as it was. */}
      {needsSignIn && appleStep !== 'consent' && (
        <div style={{ marginTop: 16 }} data-cloud-sign-in>
          {link?.accountId && <p role="status" style={{ margin: '0 0 10px' }}>{t('cloud.factSignedOutAgain')}</p>}
          <React.Suspense fallback={<p role="status" className="muted">{t('cloud.stateChecking')}</p>}>
            <SignInCard variant="inline" initialName={user?.name || ''} knownYear={user?.year ?? null}
              allowCreate={!link?.accountId} onFinish={cardSignedIn} />
          </React.Suspense>
        </div>
      )}

      {needsSignIn && appleStep === 'consent' && (
        <div style={{ marginTop: 16 }}>
          <div role="status" style={{ marginBottom: 12 }}>
            <div className="sc-label">{t('cloud.appleConsentTitle')}</div>
            <p className="muted" style={{ fontSize: 13, marginTop: 4, maxWidth: 560 }}>{t('cloud.appleConsentSub')}</p>
          </div>
          <div style={{ paddingTop: 12, borderTop: '1px solid var(--hairline)' }}>
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
        </div>
      )}

      {needsSignIn && appleIdentity && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line, rgba(128,128,128,.22))' }}>
          {/* The declaration travels with the request only once the server has
              asked for it (CONSENT_DECLARATION_REQUIRED, a new account); a
              sign-in sends none. */}
          <AppleSignInButton
            label={t(appleStep === 'consent' ? 'cloud.continueWithApple' : 'login.signInWithApple')}
            busy={busy === 'apple-sign-in'}
            disabled={!!busy || (appleStep === 'consent' && !agreed)}
            onClick={() => startAppleSignIn({ declaration: appleStep === 'consent' ? appleDeclaration() : null })} />
          <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
            {t(appleStep === 'consent' ? 'cloud.appleConsentRetryNote' : 'cloud.appleNote')}
          </p>
          {appleStep === 'consent' && (
            <button type="button" className="linklike" disabled={!!busy} onClick={() => { setAppleStep(null); setMessage(''); }}>
              {t('cloud.appleConsentBack')}
            </button>
          )}
        </div>
      )}

      {/* Signed in: the four things a student wants to know, in plain words. */}
      {link?.accountId && (
        <div style={{ marginTop: 14 }} data-cloud-facts>
          <div className="set-row" data-cloud-fact="account">
            <span className="set-k">{t('cloud.factAccount')}</span>
            <span className="set-v">{accountLine}</span>
          </div>
          <div className="set-row" data-cloud-fact="study">
            <span className="set-k">{t('cloud.factStudy')}</span>
            <span className="set-v">{studyLine}</span>
          </div>
          <div className="set-row" data-cloud-fact="progress" data-cloud-synced={synced ? 'yes' : 'no'}>
            <span className="set-k">{t('cloud.factProgress')}</span>
            <span className="set-v" role="status">{progressLine}</span>
          </div>
          <div className="set-row" data-cloud-fact="plan">
            <span className="set-k">{t('cloud.factPlan')}</span>
            <span className="set-v">{planLine}</span>
          </div>
          {staffRole && (
            <div className="set-row" data-cloud-fact="role">
              <span className="set-k">{t('cloud.factRole')}</span>
              <span className="set-v">{staffRole}</span>
            </div>
          )}
          {status?.lastError === 'CLIENT_UPGRADE_REQUIRED'
            && <div role="status" data-cloud-upgrade style={{ color: 'var(--bad)', fontSize: 12, marginTop: 8 }}>{t('cloud.upgradeRequired')}</div>}
          {status?.lastError === 'SYNC_QUOTA_EXCEEDED'
            && <div role="status" style={{ color: 'var(--bad)', fontSize: 12, marginTop: 8 }}>{t('cloudError.syncQuota')}</div>}
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <button className="btn btn-quiet" type="button" data-cloud-sign-out onClick={disconnect} disabled={!!busy}>{t('cloud.disconnect')}</button>
          </div>
          {appleIdentity && canSync && appleLinked === false && (
            <div style={{ marginTop: 12 }}>
              <AppleSignInButton label={t('cloud.linkApple')} busy={busy === 'apple-link'} disabled={!!busy} onClick={linkApple}
                style={{ width: 'auto', minHeight: 36, fontSize: 13 }} />
              <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>{t('cloud.linkAppleNote')}</p>
            </div>
          )}
        </div>
      )}

      {link?.accountId && (
        <div className="card" style={{ boxShadow: 'none', marginTop: 14 }} data-cloud-plan>
          <div className="sc-label">{t('cloud.factPlan')}</div>
          <div style={{ fontWeight: 680, marginTop: 4 }}>{premium ? t('cloud.premiumActive') : t('cloud.free')}</div>
          <div className="muted" style={{ fontSize: 13 }}>
            {premium ? `${entitlement.status} · ${entitlement.provider}` : entitlement?.stale ? t('cloud.cacheExpired') : t('cloud.noEntitlement')}
          </div>

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
      )}

      {session?.connected && liveAccount && <CloudAccountSecurity
        pid={user.id}
        account={liveAccount}
        onChanged={() => reload()}
        onDeleted={securityDisconnected}
      />}

      {/* How this device keeps and sends work: true, and of interest to few.
          Kept out of the way of the four lines above. */}
      {link?.accountId && (
        <details className="card cloud-advanced" style={{ boxShadow: 'none', marginTop: 14 }} data-cloud-advanced>
          <summary className="sc-label" style={{ cursor: 'pointer' }}>{t('cloud.advancedTitle')}</summary>
          <p className="muted" style={{ fontSize: 12.5, margin: '10px 0 0', maxWidth: 640 }}>{t('cloud.advancedIntro')}</p>
          <div className="spread" style={{ gap: 12, flexWrap: 'wrap', marginTop: 10 }}>
            <div>
              <div style={{ fontWeight: 650, marginTop: 3 }}>{pending ? t('cloud.pendingChanges', { count: pending, n: pending }) : t('cloud.outboxClear')}</div>
              <div className="muted" style={{ fontSize: 12 }}>{t('cloud.lastSync', { when: when(status?.lastSyncAt, t) })}</div>
              <div className="muted" style={{ fontSize: 12 }} data-cloud-auto-sync>
                {autoSync?.lastAutoSyncAt
                  ? t('cloud.autoSyncLast', { when: when(autoSync.lastAutoSyncAt, t) })
                  : autoSync?.paused ? t('cloud.autoSyncPaused') : t('cloud.autoSyncOn')}
              </div>
              {entitlement?.offlineUntil && <div className="muted" style={{ fontSize: 12 }}>{t('cloud.offlineUntil', { when: when(entitlement.offlineUntil, t) })}</div>}
              {status?.lastError && !['CLIENT_UPGRADE_REQUIRED', 'SYNC_QUOTA_EXCEEDED'].includes(status.lastError)
                && <div style={{ color: 'var(--bad)', fontSize: 12 }}>{t('cloud.lastError', { error: status.lastError })}</div>}
            </div>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-ghost" type="button" onClick={doSync} disabled={!canSync || !!busy}>{busy === 'sync' ? t('cloud.syncing') : t('cloud.syncNow')}</button>
              <button className="btn btn-ghost" type="button" onClick={() => refreshCloudEntitlement(user.id).then(() => reload({ verify: false })).catch(err => setError(err.message))} disabled={!canSync || !!busy}>{t('cloud.refreshPremium')}</button>
            </div>
          </div>
        </details>
      )}

      {(() => {
        const note = nativeStoreKit && appleProducts.length
          ? t('cloud.appleAuthorityNote')
          : pricingText(pricing, t);
        return note ? <div className="muted" style={{ marginTop: 14, fontSize: 12.5 }}>{note}</div> : null;
      })()}

      {message && <div role="status" style={{ marginTop: 12, color: 'var(--good)' }}>{message}</div>}
      {error && <div role="alert" style={{ marginTop: 12, color: 'var(--bad)' }}>{error}</div>}
    </section>
  );
}
