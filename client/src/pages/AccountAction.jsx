import React, { useEffect, useState } from 'react';
import { cloud } from '../platform/cloudTransport.js';

function Shell({ children }) {
  return (
    <div className="auth-wrap">
      <div className="card" style={{ width: 'min(520px, calc(100vw - 32px))', margin: 'auto', padding: 28 }}>
        <div className="logo logo-lg" aria-label="Pri Learning">
          <span className="logo-bb">P</span><span className="logo-name">ri Learning<span className="logo-dot">.</span></span>
        </div>
        <div style={{ marginTop: 24 }}>{children}</div>
      </div>
    </div>
  );
}

function Status({ kind = '', children }) {
  return <p role="status" className={kind === 'error' ? 'error-text' : 'muted'}>{children}</p>;
}

export default function AccountAction({ actionData }) {
  const action = actionData?.action || null;
  const token = actionData?.token || '';
  const [state, setState] = useState(action === 'verify-email' ? 'working' : 'ready');
  const [message, setMessage] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  useEffect(() => {
    if (action !== 'verify-email' || !token) return;
    let alive = true;
    setState('working');
    void cloud.verifyEmail({ token }).then(() => {
      if (!alive) return;
      setState('done');
      setMessage('Your Pri Learning email is verified.');
    }).catch(error => {
      if (!alive) return;
      setState('error');
      setMessage(error?.code === 'TOKEN_INVALID'
        ? 'This verification link is invalid or has expired.'
        : 'Pri Learning could not verify this email right now.');
    });
    return () => { alive = false; };
  }, [action, token]);

  if (!action || !token) {
    return (
      <Shell>
        <h1 style={{ marginTop: 0 }}>Link unavailable</h1>
        <Status kind="error">This account link is missing, invalid, or has already been removed from the address bar.</Status>
        <a className="btn primary" href="/">Open Pri Learning</a>
      </Shell>
    );
  }

  // ── A guardian answering the email ────────────────────────────────────────
  // They have no account and no session; the token in their link is the whole
  // authority. Both choices live on one screen because a parent who wants to
  // say no should not have to find a second link to do it — withdrawal has to
  // be as easy as consent was to give.
  if (action === 'guardian-consent') {
    const answer = async (choice) => {
      setState('working');
      setMessage('');
      try {
        if (choice === 'confirm') await cloud.guardianConfirm(token);
        else await cloud.guardianWithdraw(token);
        setState('done');
        setMessage(choice === 'confirm'
          ? 'Thank you. Their progress can now sync between their devices and be backed up.'
          : 'Noted. Nothing of theirs will sync, and their work stays on their own device.');
      } catch (error) {
        setState('error');
        setMessage(error?.code === 'TOKEN_INVALID'
          ? 'This link is invalid or has expired. Ask them to create the account again and a new link will be sent.'
          : 'Pri Learning could not record that right now. Please try the link again in a moment.');
      }
    };
    return (
      <Shell>
        <h1 style={{ marginTop: 0 }}>Confirm your child’s account</h1>
        {state !== 'done' && (
          <>
            <p className="muted" style={{ marginTop: 0 }}>
              Pri Learning is a maths app. Everything in it — the questions, the marking and the
              handwriting — already works on their device without an account. Confirming lets their
              progress sync between devices and be backed up. If you would rather it did not, say no
              and nothing of theirs will leave their device.
            </p>
            <p className="muted" style={{ fontSize: 12.5 }}>
              You can change this later from this same link. The{' '}
              <a href="/privacy" target="_blank" rel="noreferrer">privacy notice</a> sets out exactly what an
              account sends.
            </p>
          </>
        )}
        {state === 'working' && <Status>Recording your answer…</Status>}
        {state === 'error' && <Status kind="error">{message}</Status>}
        {state === 'done'
          ? <><Status>{message}</Status><a className="btn primary" href="/">Open Pri Learning</a></>
          : (
            <div className="row" style={{ gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
              <button className="btn primary" type="button" disabled={state === 'working'} onClick={() => answer('confirm')}>
                Yes, allow syncing
              </button>
              <button className="btn" type="button" disabled={state === 'working'} onClick={() => answer('withdraw')}>
                No, keep it on their device
              </button>
            </div>
          )}
      </Shell>
    );
  }

  if (action === 'verify-email') {
    return (
      <Shell>
        <h1 style={{ marginTop: 0 }}>Verify email</h1>
        {state === 'working' && <Status>Checking your secure verification link…</Status>}
        {state === 'done' && <><Status>{message}</Status><a className="btn primary" href="/">Open Pri Learning</a></>}
        {state === 'error' && <><Status kind="error">{message}</Status><a className="btn" href="/">Return to Pri Learning</a></>}
      </Shell>
    );
  }

  const submit = async event => {
    event.preventDefault();
    setMessage('');
    if (password.length < 10) {
      setState('error');
      setMessage('Use a new password of at least 10 characters.');
      return;
    }
    if (password !== confirm) {
      setState('error');
      setMessage('The two password entries do not match.');
      return;
    }
    setState('working');
    try {
      await cloud.resetPassword({ token, password });
      setPassword('');
      setConfirm('');
      setState('done');
      setMessage('Your password has been reset. Sign in again on your devices with the new password.');
    } catch (error) {
      setState('error');
      setMessage(error?.code === 'TOKEN_INVALID'
        ? 'This reset link is invalid or has expired.'
        : error?.code === 'WEAK_PASSWORD'
          ? 'Use a stronger password of at least 10 characters.'
          : 'Pri Learning could not reset the password right now.');
    }
  };

  return (
    <Shell>
      <h1 style={{ marginTop: 0 }}>Reset password</h1>
      {state === 'done' ? (
        <>
          <Status>{message}</Status>
          <a className="btn primary" href="/">Open Pri Learning</a>
        </>
      ) : (
        <form onSubmit={submit}>
          <p className="muted">Choose a new cloud-account password. Resetting it signs out existing cloud sessions.</p>
          <label className="field">
            <span>New password</span>
            <input type="password" autoComplete="new-password" value={password}
              onChange={event => setPassword(event.target.value)} minLength={10} maxLength={200} required />
          </label>
          <label className="field" style={{ marginTop: 12 }}>
            <span>Confirm new password</span>
            <input type="password" autoComplete="new-password" value={confirm}
              onChange={event => setConfirm(event.target.value)} minLength={10} maxLength={200} required />
          </label>
          {message && <Status kind={state === 'error' ? 'error' : ''}>{message}</Status>}
          <button className="btn primary" type="submit" disabled={state === 'working'}>
            {state === 'working' ? 'Resetting…' : 'Reset password'}
          </button>
        </form>
      )}
    </Shell>
  );
}
