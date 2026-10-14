import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { cloud } from '../platform/cloudTransport.js';
import { linkSignedInAccount } from '../platform/cloudAccount.js';
import { ensureAccountActivated } from '../platform/accountActivation.js';
import SignUpFlow from './SignUpFlow.jsx';

/** Entirely outside the app's navigation shell; never mounts Practice behind a modal. */
export default function AccountActivationGate({ user, onReady, onSwitch }) {
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
    setIssue(err?.message || 'We could not complete your account setup.');
    if (code === 'ACCOUNT_NOT_LINKED' || code === 'SIGN_IN_REQUIRED' || code === 'ACCOUNT_MISMATCH') setStatus('signin');
    else if (code === 'GUARDIAN_CONSENT_PENDING') setStatus('guardian');
    else if (code === 'GUARDIAN_CONSENT_WITHDRAWN' || code === 'AGE_DECLARATION_REQUIRED') setStatus('blocked');
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
    return () => { generation.current++; };
  }, [check]);

  useEffect(() => {
    if (status !== 'guardian') return undefined;
    const poll = () => {
      // Do not remount the onboarding form; only leave once the server says yes.
      void cloud.guardianState().then(state => {
        if (state?.required === false || state?.state === 'given') void check();
        else if (state?.state === 'withdrawn') {
          setStatus('blocked');
          setIssue('Your parent or guardian has withdrawn permission.');
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
    } catch (err) { setError(err?.message || 'Could not contact your guardian. Please try again.'); }
    finally { setSending(false); }
  }

  return (
    <div className="auth-wrap" data-testid="account-activation-gate">
      <div className="auth-col" style={{ maxWidth: 540, padding: '24px 18px' }}>
        <div className="hero-kicker">PRI LEARNING · ACCOUNT SETUP</div>
        <h1 style={{ margin: '18px 0 6px', fontSize: 'clamp(1.6rem, 4vw, 2.2rem)' }}>One account. Ready to learn.</h1>
        <p className="muted" style={{ marginBottom: 20 }}>Finish account verification and sync before entering the app. Your saved work on this device will not be deleted.</p>
        {status === 'checking' && <p role="status" data-testid="activation-checking">Checking your account and syncing your profile…</p>}
        {status === 'signin' && (
          <>
            <p role="status">{issue || 'Sign in to connect this profile.'}</p>
            <SignUpFlow initialMode="signin" onCancel={onSwitch} onFinish={finishExisting} />
          </>
        )}
        {status === 'guardian' && (
          <div className="card" data-testid="activation-guardian">
            <h2>Waiting for parent or guardian approval</h2>
            <p>Approval is required before this account can use the main app. We'll automatically continue when your parent confirms.</p>
            <form onSubmit={sendGuardian} className="signup-form">
              <label className="label" htmlFor="activation-parent-name">Parent or guardian's name</label>
              <input className="input" id="activation-parent-name" value={guardianName} maxLength={80}
                onChange={e => setGuardianName(e.target.value)} required />
              <label className="label" htmlFor="activation-parent-email">Their email address</label>
              <input className="input" id="activation-parent-email" type="email" value={guardianEmail}
                onChange={e => setGuardianEmail(e.target.value)} maxLength={160} required />
              <button className="btn btn-primary" disabled={sending} type="submit">
                {sending ? 'Sending…' : requestSent ? 'Resend approval email' : 'Send approval email'}
              </button>
            </form>
            {requestSent && <p role="status">Request sent. Ask your parent to follow the link in their email. This screen checks automatically.</p>}
            {error && <p className="error-box" role="alert">{error}</p>}
            <button className="linklike" type="button" onClick={() => void check()}>Check approval now</button>
          </div>
        )}
        {status === 'blocked' && (
          <div className="card" role="alert">
            <h2>Account approval needs attention</h2>
            <p>{issue}</p>
            <p>For an incorrect age classification, contact support to request a secure correction. Changing a checkbox cannot override a guardian decision.</p>
            <button className="btn btn-ghost" type="button" onClick={() => void check()}>Check again</button>
          </div>
        )}
        {status === 'retry' && (
          <div className="card" role="alert">
            <h2>Setup is not complete</h2>
            <p>{issue}</p>
            <button className="btn btn-primary" type="button" onClick={() => void check()}>Retry account setup</button>
          </div>
        )}
        <div style={{ marginTop: 18 }}>
          <button type="button" className="linklike" onClick={onSwitch}>Use another profile</button>
        </div>
        <p className="muted" style={{ marginTop: 16, fontSize: 12 }}>
          <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a>
        </p>
      </div>
    </div>
  );
}
