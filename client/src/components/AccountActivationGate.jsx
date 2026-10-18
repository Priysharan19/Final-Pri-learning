// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the activation gate
//
// Rendered by App.jsx in place of the shell — for every route, a deep link, a
// reload, the back button, an app opened offline — whenever the chosen local
// profile has not been shown, in this session, to belong to a live account the
// server lets in (platform/accountActivation.js). It is entirely outside the
// shell: no rail, no Practice behind a modal, nothing to tap around.
//
// Five states, each said plainly, each with its one way forward:
//   checking   the server is being asked
//   signin     no account, no session, another account's session, an unproven
//              contact: the one sign-in card, inline, for THIS profile
//   guardian   under 18 and the parent has not approved: a waiting screen that
//              asks (or re-asks) the parent and watches for the approval
//   blocked    a guardian withdrew, or the account is refused: nothing to press
//              but "check again" and "use another profile"
//   retry      the server could not be reached, or the first sync did not
//              finish: nothing is lost, try again
// ─────────────────────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { cloud } from '../platform/cloudTransport.js';
import { cloudAccountLink, cloudDeviceId, linkSignedInAccount, verifyCloudSession } from '../platform/cloudAccount.js';
import {
  ACTIVATION_BLOCKED_CODES, ACTIVATION_GUARDIAN_CODES, ACTIVATION_SIGN_IN_CODES, ensureAccountActivated
} from '../platform/accountActivation.js';
import { Logo } from '../App.jsx';
import { appleSignInOffered, AppleSignInButton } from '../pages/Login.jsx';
import { signInWithApple } from '../platform/native/appleSignIn.js';
import { tLater, useT } from '../i18n/index.js';
import { isNetworkFailure, signInErrorCopy } from './signInErrors.js';
import SignUpFlow from './SignUpFlow.jsx';
import './SignUpFlow.css';

const RESEND_SECONDS = 30;
const POLL_MS = 4000;

/** The sentence for a refusal code, from the catalogue. */
function reasonKey(code, cause) {
  switch (code) {
    case 'ACCOUNT_NOT_LINKED': return 'activation.notLinked';
    case 'SIGN_IN_REQUIRED': return 'activation.signInRequired';
    case 'ACCOUNT_MISMATCH': return 'activation.mismatch';
    case 'EMAIL_UNVERIFIED': return 'activation.emailUnverified';
    case 'GUARDIAN_CONSENT_PENDING': return 'activation.guardianPending';
    case 'GUARDIAN_CONSENT_WITHDRAWN': return 'activation.withdrawn';
    case 'AGE_DECLARATION_REQUIRED': return 'activation.ageUndeclared';
    case 'ACCOUNT_ACCESS_DENIED': return 'activation.accessDenied';
    case 'FIRST_SYNC_PENDING': return 'activation.syncPending';
    case 'CLOUD_UNAVAILABLE': return 'activation.cloudUnavailable';
    default: return isNetworkFailure(cause) ? 'activation.offline' : 'activation.serverUnavailable';
  }
}

export default function AccountActivationGate({ user, onReady, onSwitch }) {
  const t = useT();
  const [status, setStatus] = useState('checking');
  const [code, setCode] = useState('');
  const [reason, setReason] = useState('');
  const [link, setLink] = useState(undefined);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [channels, setChannels] = useState({ email: true, sms: false });
  const [guardianName, setGuardianName] = useState('');
  const [guardianChannel, setGuardianChannel] = useState('email');
  const [guardianDestination, setGuardianDestination] = useState('');
  const [requestSent, setRequestSent] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState('');
  const generation = useRef(0);
  const checking = useRef(false);
  const headingRef = useRef(null);
  const appleOffered = appleSignInOffered();

  const classify = useCallback((err) => {
    const next = err?.code || 'SESSION_UNAVAILABLE';
    setCode(next);
    setReason(tLater(reasonKey(next, err?.cause)));
    if (ACTIVATION_SIGN_IN_CODES.includes(next)) setStatus('signin');
    else if (ACTIVATION_GUARDIAN_CODES.includes(next)) setStatus('guardian');
    else if (ACTIVATION_BLOCKED_CODES.includes(next)) setStatus('blocked');
    else setStatus('retry');
  }, []);

  /** Ask the server. One check at a time; a stale answer never lands. */
  const check = useCallback(async () => {
    if (checking.current) return;
    checking.current = true;
    const nonce = ++generation.current;
    setStatus('checking');
    setError('');
    try {
      const ready = await ensureAccountActivated(user.id);
      if (nonce === generation.current) onReady(ready);
    } catch (err) {
      if (nonce === generation.current) classify(err);
    } finally { if (nonce === generation.current) checking.current = false; }
  }, [user.id, onReady, classify]);

  useEffect(() => {
    void check();
    cloudAccountLink(user.id).then(setLink).catch(() => setLink(null));
    cloud.otpChannels().then(result => {
      if (result?.channels) setChannels({ email: result.channels.email !== false, sms: result.channels.sms === true });
    }).catch(() => {});
    return () => { generation.current++; checking.current = false; };
  }, [check, user.id]);

  // Each new state names itself to a screen reader.
  // The checking heading takes focus too, so the button just pressed (which
  // unmounts) never drops focus to the page body.
  useEffect(() => { headingRef.current?.focus({ preventScroll: true }); }, [status]);

  // Back online: the retry screen tries again by itself.
  useEffect(() => {
    if (status !== 'retry') return undefined;
    const again = () => void check();
    window.addEventListener('online', again);
    return () => window.removeEventListener('online', again);
  }, [status, check]);

  // Waiting for a parent: watch the server's statement and move on when it
  // says given — or stop when a guardian withdrew. Never a local flag.
  useEffect(() => {
    if (status !== 'guardian') return undefined;
    let live = true;
    const poll = () => {
      // Not while the tab is hidden: the return to the foreground is noticed
      // by the next tick, and a hidden tab should not keep the server busy.
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      void cloud.guardianState().then(state => {
        if (!live) return;
        if (state?.state === 'given' || state?.required === false) void check();
        else if (state?.state === 'withdrawn') classify({ code: 'GUARDIAN_CONSENT_WITHDRAWN' });
      }).catch(() => {});
    };
    const timer = setInterval(poll, POLL_MS);
    return () => { live = false; clearInterval(timer); };
  }, [status, check, classify]);

  useEffect(() => {
    if (resendAt <= now) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [resendAt, now]);

  /** The card signed in: link THIS profile to that account, then ask the server again. */
  async function finishSignIn({ account }) {
    if (!account?.id) throw Object.assign(new Error('no account'), { code: 'SIGN_IN_REQUIRED' });
    try {
      await linkSignedInAccount(user.id, account);
    } catch (err) {
      // The account that signed in is not this profile's. Its session cannot
      // be used here, so it is ended rather than left signed in beside work
      // that belongs to another account.
      if (err?.code === 'CLOUD_LINK_CONFLICT') await cloud.logout().catch(() => {});
      throw err;
    }
    setLink(await cloudAccountLink(user.id).catch(() => null));
    // Not unlocked on the link alone: the server's statement, then the first sync.
    const ready = await ensureAccountActivated(user.id, { expectedAccountId: account.id });
    onReady(ready);
  }

  /** Sign in with Apple through the native shell, for THIS profile. */
  async function appleSignIn() {
    if (busy) return;
    setBusy('apple'); setError(''); setNotice('');
    try {
      const deviceId = await cloudDeviceId();
      const outcome = await signInWithApple({ mode: 'sign-in', deviceId });
      if (outcome.status === 'cancelled') { setNotice(tLater('cloud.appleSignInCancelled')); return; }
      if (outcome.status === 'consent-required') { setNotice(tLater('activation.appleNeedsEmail')); return; }
      const verified = await verifyCloudSession(user.id);
      if (!verified.connected || !verified.account?.id) throw Object.assign(new Error('unverified'), { code: 'SIGN_IN_REQUIRED' });
      await finishSignIn({ account: verified.account });
    } catch (err) {
      const copy = signInErrorCopy(err);
      setError(tLater(copy.key, copy.vars));
    } finally { setBusy(''); }
  }

  async function sendGuardian(e) {
    e.preventDefault();
    if (busy) return;
    if (!guardianName.trim()) { setError(tLater('signup.parentNameRequired')); return; }
    setBusy('guardian'); setError(''); setNotice('');
    try {
      const sent = await cloud.guardianOtpRequest({ guardianName: guardianName.trim(), channel: guardianChannel, destination: guardianDestination.trim() });
      if (sent?.alreadyApproved) { void check(); return; }
      setRequestSent(true);
      setResendAt(Date.now() + (Number(sent?.resendAfterMs) || RESEND_SECONDS * 1000));
      setNow(Date.now());
      setNotice(tLater(guardianChannel === 'sms' ? 'activation.requestSentPhone' : 'activation.requestSentEmail', { name: guardianName.trim() }));
    } catch (err) {
      if (err?.code === 'GUARDIAN_CONSENT_WITHDRAWN') { classify({ code: 'GUARDIAN_CONSENT_WITHDRAWN' }); return; }
      if (err?.code === 'GUARDIAN_CONSENT_NOT_REQUIRED') { void check(); return; }
      const copy = signInErrorCopy(err);
      setError(tLater(copy.key, copy.vars));
    } finally { setBusy(''); }
  }

  const waitSeconds = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const parentPage = `${typeof window !== 'undefined' ? window.location.origin : ''}/guardian/consent`;
  const guardianSms = guardianChannel === 'sms';
  const heading = (key) => <h1 className="signup-title" tabIndex={-1} ref={headingRef} id="activation-title">{t(key)}</h1>;

  return (
    <div className="auth-wrap" data-testid="account-activation-gate" data-activation-status={status} data-activation-code={code || undefined}>
      <div className="auth-col fade-in">
        <Logo large />
        <div className="activation-gate">
          <div className="hero-kicker">{t('activation.kicker')}</div>

          {status === 'checking' && (
            <div className="card" aria-busy="true">
              {heading('activation.checkingTitle')}
              <p className="activation-status" role="status" data-testid="activation-checking">{t('activation.checking', { name: user.name })}</p>
            </div>
          )}

          {status === 'signin' && (
            <div className="card" data-testid="activation-signin">
              {heading('activation.signInTitle')}
              <p className="activation-status" role="status">{reason}</p>
              <p className="activation-status">{t('activation.signInFor', { name: user.name })}</p>
              <SignUpFlow variant="inline" initialName={user.name || ''} knownYear={user.year ?? null} knownTrack={user.indiaTrack || null}
                allowCreate={link !== undefined && !link?.accountId} onFinish={finishSignIn} />
              {appleOffered && (
                <div style={{ marginTop: 14 }}>
                  <AppleSignInButton onClick={appleSignIn} disabled={!!busy} busy={busy === 'apple'} />
                </div>
              )}
            </div>
          )}

          {status === 'guardian' && (
            <div className="card" data-testid="activation-guardian">
              {heading('activation.waiting')}
              <p className="activation-status" role="status" data-testid="activation-guardian-waiting">{t('activation.waitDetails')}</p>
              <form className="signup-form" noValidate onSubmit={sendGuardian}>
                <label className="label" htmlFor="activation-parent-name">{t('signup.parentNameLabel')}</label>
                <input className="input" id="activation-parent-name" value={guardianName} maxLength={80} autoComplete="off"
                  onChange={e => { setGuardianName(e.target.value); setError(''); }} />
                {channels.sms && (
                  <div className="signup-segment signup-channel" role="radiogroup" aria-label={t('signup.parentChannelLabel')}>
                    <button type="button" role="radio" aria-checked={!guardianSms} className={`signup-seg${!guardianSms ? ' is-selected' : ''}`}
                      onClick={() => { setGuardianChannel('email'); setGuardianDestination(''); }} data-testid="activation-parent-email">{t('signup.channelEmail')}</button>
                    <button type="button" role="radio" aria-checked={guardianSms} className={`signup-seg${guardianSms ? ' is-selected' : ''}`}
                      onClick={() => { setGuardianChannel('sms'); setGuardianDestination(''); }} data-testid="activation-parent-sms">{t('signup.channelPhone')}</button>
                  </div>
                )}
                <label className="label" htmlFor="activation-parent-destination">{guardianSms ? t('signup.parentPhoneLabel') : t('signup.parentEmailLabel')}</label>
                <div className={guardianSms ? 'signup-phone' : ''}>
                  {guardianSms && <span className="signup-cc" aria-hidden="true">+91</span>}
                  <input className="input" id="activation-parent-destination" value={guardianDestination}
                    type={guardianSms ? 'tel' : 'email'} inputMode={guardianSms ? 'tel' : 'email'} autoComplete="off" autoCapitalize="none" maxLength={guardianSms ? 16 : 254}
                    onChange={e => { setGuardianDestination(e.target.value); setError(''); }} />
                </div>
                <button className="btn btn-primary btn-lg signup-next" type="submit" data-testid="activation-parent-send"
                  disabled={!!busy || !guardianDestination.trim() || waitSeconds > 0}>
                  {busy === 'guardian' ? t('signup.sending') : waitSeconds > 0 ? t('signup.resendIn', { n: waitSeconds }) : requestSent ? t('activation.resend') : t('activation.send')}
                </button>
              </form>
              <p className="signup-wait-page"><span>{t('signup.waitPageLabel')}</span> <strong>{parentPage}</strong></p>
              <div className="activation-actions">
                <button className="linklike" type="button" data-testid="activation-check-approval" onClick={() => void check()}>{t('activation.checkApproval')}</button>
              </div>
            </div>
          )}

          {status === 'blocked' && (
            <div className="card" data-testid="activation-blocked">
              {heading('activation.needsAttention')}
              <p className="activation-status" role="status">{reason}</p>
              <p className="activation-status">{t('activation.ageCorrection')}</p>
              <div className="activation-actions">
                <button className="btn btn-ghost" type="button" data-testid="activation-check-again" onClick={() => void check()}>{t('activation.checkAgain')}</button>
              </div>
            </div>
          )}

          {status === 'retry' && (
            <div className="card" data-testid="activation-retry">
              {heading('activation.notComplete')}
              <p className="activation-status" role="status">{reason}</p>
              <p className="activation-status">{t('activation.workSafe')}</p>
              <div className="activation-actions">
                <button className="btn btn-primary" type="button" data-testid="activation-retry-button" onClick={() => void check()}>{t('activation.retrySetup')}</button>
              </div>
            </div>
          )}

          {notice && <p className="signup-hint signup-notice-line" role="status" data-testid="activation-notice">{notice}</p>}
          {error && <div className="error-box signup-error" role="alert" data-testid="activation-error">{error}</div>}

          <div className="activation-actions">
            <button type="button" className="linklike" data-testid="activation-switch-profile" onClick={onSwitch}>{t('activation.switchProfile')}</button>
          </div>
          <p className="muted activation-foot">
            <Link to="/privacy">{t('login.privacy')}</Link> · <Link to="/terms">{t('login.terms')}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
