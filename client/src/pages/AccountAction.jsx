import React, { useEffect, useState } from 'react';
import { cloud } from '../platform/cloudTransport.js';
import { useT, useTx } from '../i18n/index.js';

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
  const t = useT();
  const tx = useTx();
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
      setMessage(t('accountAction.emailVerified'));
    }).catch(error => {
      if (!alive) return;
      setState('error');
      setMessage(error?.code === 'TOKEN_INVALID'
        ? t('accountAction.verifyInvalid')
        : t('accountAction.verifyFailed'));
    });
    return () => { alive = false; };
  }, [action, token]);

  if (!action || !token) {
    return (
      <Shell>
        <h1 style={{ marginTop: 0 }}>{t('accountAction.linkUnavailable')}</h1>
        <Status kind="error">{t('accountAction.linkMissing')}</Status>
        <a className="btn primary" href="/">{t('accountAction.openApp')}</a>
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
          ? t('accountAction.guardianConfirmed')
          : t('accountAction.guardianWithdrawn'));
      } catch (error) {
        setState('error');
        setMessage(error?.code === 'TOKEN_INVALID'
          ? t('accountAction.guardianInvalid')
          : t('accountAction.guardianFailed'));
      }
    };
    return (
      <Shell>
        <h1 style={{ marginTop: 0 }}>{t('accountAction.guardianTitle')}</h1>
        {state !== 'done' && (
          <>
            <p className="muted" style={{ marginTop: 0 }}>
              {t('accountAction.guardianIntro')}
            </p>
            <p className="muted" style={{ fontSize: 12.5 }}>
              {tx('accountAction.guardianChangeLater', {
                privacy: <a href="/privacy" target="_blank" rel="noreferrer">{t('cloud.privacyNotice')}</a>
              })}
            </p>
          </>
        )}
        {state === 'working' && <Status>{t('accountAction.recording')}</Status>}
        {state === 'error' && <Status kind="error">{message}</Status>}
        {state === 'done'
          ? <><Status>{message}</Status><a className="btn primary" href="/">{t('accountAction.openApp')}</a></>
          : (
            <div className="row" style={{ gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
              <button className="btn primary" type="button" disabled={state === 'working'} onClick={() => answer('confirm')}>
                {t('accountAction.allowSync')}
              </button>
              <button className="btn" type="button" disabled={state === 'working'} onClick={() => answer('withdraw')}>
                {t('accountAction.keepOnDevice')}
              </button>
            </div>
          )}
      </Shell>
    );
  }

  if (action === 'verify-email') {
    return (
      <Shell>
        <h1 style={{ marginTop: 0 }}>{t('accountAction.verifyTitle')}</h1>
        {state === 'working' && <Status>{t('accountAction.checking')}</Status>}
        {state === 'done' && <><Status>{message}</Status><a className="btn primary" href="/">{t('accountAction.openApp')}</a></>}
        {state === 'error' && <><Status kind="error">{message}</Status><a className="btn" href="/">{t('accountAction.returnToApp')}</a></>}
      </Shell>
    );
  }

  const submit = async event => {
    event.preventDefault();
    setMessage('');
    if (password.length < 10) {
      setState('error');
      setMessage(t('accountAction.passwordTooShort'));
      return;
    }
    if (password !== confirm) {
      setState('error');
      setMessage(t('accountAction.passwordMismatch'));
      return;
    }
    setState('working');
    try {
      await cloud.resetPassword({ token, password });
      setPassword('');
      setConfirm('');
      setState('done');
      setMessage(t('accountAction.resetDone'));
    } catch (error) {
      setState('error');
      setMessage(error?.code === 'TOKEN_INVALID'
        ? t('accountAction.resetInvalid')
        : error?.code === 'WEAK_PASSWORD'
          ? t('accountAction.weakPassword')
          : t('accountAction.resetFailed'));
    }
  };

  return (
    <Shell>
      <h1 style={{ marginTop: 0 }}>{t('accountAction.resetTitle')}</h1>
      {state === 'done' ? (
        <>
          <Status>{message}</Status>
          <a className="btn primary" href="/">{t('accountAction.openApp')}</a>
        </>
      ) : (
        <form onSubmit={submit}>
          <p className="muted">{t('accountAction.resetHelp')}</p>
          <label className="field">
            <span>{t('settings.newPassword')}</span>
            <input type="password" autoComplete="new-password" value={password}
              onChange={event => setPassword(event.target.value)} minLength={10} maxLength={200} required />
          </label>
          <label className="field" style={{ marginTop: 12 }}>
            <span>{t('cloudSecurity.confirmNewPassword')}</span>
            <input type="password" autoComplete="new-password" value={confirm}
              onChange={event => setConfirm(event.target.value)} minLength={10} maxLength={200} required />
          </label>
          {message && <Status kind={state === 'error' ? 'error' : ''}>{message}</Status>}
          <button className="btn primary" type="submit" disabled={state === 'working'}>
            {state === 'working' ? t('accountAction.resetting') : t('accountAction.resetTitle')}
          </button>
        </form>
      )}
    </Shell>
  );
}
