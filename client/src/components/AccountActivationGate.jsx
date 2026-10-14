import React, { useCallback, useEffect, useRef, useState } from 'react';
import { cloud } from '../platform/cloudTransport.js';
import { linkSignedInAccount } from '../platform/cloudAccount.js';
import { ensureAccountActivated } from '../platform/accountActivation.js';
import SignUpFlow from './SignUpFlow.jsx';
import { tLater, useT } from '../i18n/index.js';

/** Entirely outside the app's navigation shell; never mounts Practice behind a modal. */
export default function AccountActivationGate({ user, onReady, onSwitch }) {
  const t = useT();
  const [status, setStatus] = useState('checking');
  const [issue, setIssue] = useState('');
  const [error, setError] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianEmail, setGuardianEmail] = useState('');
  const [requestSent, setRequestSent] = useState(false);
  const [sending, setSending] = useState(false);
  const generation = useRef(0);
  const busy = useRef(false);

  const classify = useCallback((err) => {
    const code = err?.code || '';
    setIssue(err?.message || tLater('activation.error'));
    if (code === 'ACCOUNT_NOT_LINKED' || code === 'SIGN_IN_REQUIRED' || code === 'ACCOUNT_MISMATCH') setStatus('signin');
    else if (code === 'GUARDIAN_CONSENT_PENDING') setStatus('guardian');
    else if (code === 'GUARDIAN_CONSENT_WITHDRAWN' || code === 'AGE_DECLARATION_REQUIRED' || code === 'ACCOUNT_ACCESS_DENIED') setStatus('blocked');
    else setStatus('retry');
  }, []);

  const check = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    const nonce = ++generation.current;
    setStatus('checking');
    setError('');
    try {
      const result = await ensureAccountActivated(user.id);
      if (nonce === generation.current) onReady(result);
    } catch (err) {
      if (nonce === generation.current) classify(err);
    } finally { busy.current = false; }
  }, [user.id, onReady, classify]);

  useEffect(() => {
    void check();
    return () => { generation.current++; busy.current = false; };
  }, [check]);

  useEffect(() => {
    if (status !== 'guardian') return undefined;
    const poll = () => {
      // Do not remount the onboarding form; only leave once the server says yes.
      void cloud.guardianState().then(state => {
        if (state?.required === false || state?.state === 'given') void check();
        else if (state?.state === 'withdrawn') {
          setStatus('blocked');
          setIssue(tLater('activation.withdrawn'));
        }
      }).catch(() => {});
    };
    const timer = setInterval(poll, 4000);
    return () => clearInterval(timer);
  }, [status, check]);

  async function finishExisting({ account }) {
    if (!account?.id) throw new Error('Sign in to a verified account first.');
    await linkSignedInAccount(user.id, account);
    // Do not unlock on a local link alone. Consent and first sync are server-verified.
    const ready = await ensureAccountActivated(user.id, { expectedAccountId: account.id });
    onReady(ready);
  }

  async function sendGuardian(e) {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    setError('');
    try {
      const result = await cloud.guardianOtpRequest({
        guardianName: guardianName.trim(), channel: 'email', destination: guardianEmail.trim()
      });
      setRequestSent(true);
      if (result?.alreadyApproved) void check();
    } catch (err) { setError(err?.message || tLater('activation.guardianSendError')); }
    finally { setSending(false); }
  }

  return (
    <div className="auth-wrap" data-testid="account-activation-gate">
      <div className="auth-col" style={{ maxWidth: 540, padding: '24px 18px' }}>
        <div className="hero-kicker">{t('activation.kicker')}</div>
        <h1 style={{ margin: '18px 0 6px', fontSize: 'clamp(1.6rem, 4vw, 2.2rem)' }}>{t('activation.title')}</h1>
        <p className="muted" style={{ marginBottom: 20 }}>{t('activation.intro')}</p>
        {status === 'checking' && <p role="status" data-testid="activation-checking">{t('activation.checking')}</p>}
        {status === 'signin' && (
          <>
            <p role="status">{issue || t('activation.signinHint')}</p>
            <SignUpFlow initialMode="signin" reuseExistingProfile onCancel={onSwitch} onFinish={finishExisting} />
          </>
        )}
        {status === 'guardian' && (
          <div className="card" data-testid="activation-guardian">
            <h2>{t('activation.waiting')}</h2>
            <p>{t('activation.waitDetails')}</p>
            <form onSubmit={sendGuardian} className="signup-form">
              <label className="label" htmlFor="activation-parent-name">{t('signup.parentNameLabel')}</label>
              <input className="input" id="activation-parent-name" value={guardianName} maxLength={80}
                onChange={e => setGuardianName(e.target.value)} required />
              <label className="label" htmlFor="activation-parent-email">{t('signup.parentEmailLabel')}</label>
              <input className="input" id="activation-parent-email" type="email" value={guardianEmail}
                onChange={e => setGuardianEmail(e.target.value)} maxLength={160} required />
              <button className="btn btn-primary" disabled={sending} type="submit">
                {sending ? t('signup.sending') : requestSent ? t('activation.resend') : t('activation.send')}
              </button>
            </form>
            {requestSent && <p role="status">{t('activation.requestSent')}</p>}
            {error && <p className="error-box" role="alert">{error}</p>}
            <button className="linklike" type="button" onClick={() => void check()}>{t('activation.checkApproval')}</button>
          </div>
        )}
        {status === 'blocked' && (
          <div className="card" role="alert">
            <h2>{t('activation.needsAttention')}</h2>
            <p>{issue}</p>
            <p>{t('activation.ageCorrection')}</p>
            <button className="btn btn-ghost" type="button" onClick={() => void check()}>{t('activation.checkAgain')}</button>
          </div>
        )}
        {status === 'retry' && (
          <div className="card" role="alert">
            <h2>{t('activation.notComplete')}</h2>
            <p>{issue}</p>
            <button className="btn btn-primary" type="button" onClick={() => void check()}>{t('activation.retrySetup')}</button>
          </div>
        )}
        <div style={{ marginTop: 18 }}>
          <button type="button" className="linklike" onClick={onSwitch}>{t('activation.switchProfile')}</button>
        </div>
        <p className="muted" style={{ marginTop: 16, fontSize: 12 }}>
          <a href="/privacy">{t('activation.privacy')}</a> · <a href="/terms">{t('activation.terms')}</a>
        </p>
      </div>
    </div>
  );
}
