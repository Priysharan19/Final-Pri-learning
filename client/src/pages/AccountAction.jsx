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
