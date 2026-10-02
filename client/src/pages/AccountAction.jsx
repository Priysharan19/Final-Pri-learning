import React, { useEffect, useState } from 'react';
import { cloud } from '../platform/cloudTransport.js';
import { cloudErrorCopy } from '../platform/cloudErrorCopy.js';
import { tLater, useT, useTx } from '../i18n/index.js';

/**
 * Withdraw a guardian's consent with the bearer in their link. Resolves the
 * screen state and the catalogue key that explains it: 'done' when consent was
 * live and is now withdrawn, 'already' when there was nothing left to withdraw
 * (the server still answers ok, withdrawn: false — the link is spent either
 * way), 'error' for an invalid/expired link or a failure. Exported so the flow
 * is provable with a fake transport (client/test/account-action-guardian-withdraw-check.mjs).
 */
export async function performGuardianWithdraw(token, transport = cloud) {
  try {
    const result = await transport.guardianWithdraw(token);
    return result?.withdrawn === false
      ? { state: 'already', key: 'accountAction.withdrawAlready' }
      : { state: 'done', key: 'accountAction.withdrawDone' };
  } catch (error) {
    return { state: 'error', key: error?.code === 'TOKEN_INVALID' ? 'accountAction.withdrawInvalid' : 'accountAction.withdrawFailed' };
  }
}

function Shell({ children }) {
  return (
    <div className="auth-wrap">
      <div className="card" style={{ width: 'min(520px, calc(100% - 32px))', margin: 'auto', padding: 28 }}>
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
      setMessage(tLater('accountAction.emailVerified'));
    }).catch(error => {
      if (!alive) return;
      setState('error');
      setMessage(error?.code === 'TOKEN_INVALID'
        ? tLater('accountAction.verifyInvalid')
        : tLater('accountAction.verifyFailed'));
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

  // ── A guardian using the withdrawal link they were told to keep ───────────
  // Sent after confirmation, never expires, can only reduce permission. One
  // screen, one button: what withdrawing does is said before it is done, and
  // the outcome (withdrawn / nothing left to withdraw / link invalid) after.
  if (action === 'guardian-withdraw') {
    const withdraw = async () => {
      setState('working');
      setMessage('');
      const outcome = await performGuardianWithdraw(token);
      setState(outcome.state === 'error' ? 'error' : 'done');
      setMessage(tLater(outcome.key));
    };
    return (
      <Shell>
        <h1 style={{ marginTop: 0 }}>{t('accountAction.withdrawTitle')}</h1>
        {state !== 'done' && <p className="muted" style={{ marginTop: 0 }}>{t('accountAction.withdrawIntro')}</p>}
        {state === 'working' && <Status>{t('accountAction.recording')}</Status>}
        {state === 'error' && <Status kind="error">{message}</Status>}
        {state === 'done'
          ? <><Status>{message}</Status><a className="btn primary" href="/">{t('accountAction.openApp')}</a></>
          : (
            <div className="row" style={{ gap: 10, marginTop: 16 }}>
              <button className="btn primary" type="button" data-guardian-withdraw disabled={state === 'working'} onClick={withdraw}>
                {t('accountAction.withdrawButton')}
              </button>
            </div>
          )}
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
          ? tLater('accountAction.guardianConfirmed')
          : tLater('accountAction.guardianWithdrawn'));
      } catch (error) {
        setState('error');
        setMessage(error?.code === 'TOKEN_INVALID'
          ? tLater('accountAction.guardianInvalid')
          : tLater('accountAction.guardianFailed'));
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
      setMessage(tLater('accountAction.passwordTooShort'));
      return;
    }
    if (password !== confirm) {
      setState('error');
      setMessage(tLater('accountAction.passwordMismatch'));
      return;
    }
    setState('working');
    try {
      await cloud.resetPassword({ token, password });
      setPassword('');
      setConfirm('');
      setState('done');
      setMessage(tLater('accountAction.resetDone'));
    } catch (error) {
      setState('error');
      // WEAK_PASSWORD, PASSWORD_TOO_LONG and PASSWORD_TOO_COMMON each get their
      // own sentence (cloudErrorCopy); a reset link that is spent or expired its own.
      const copy = cloudErrorCopy(error);
      setMessage(error?.code === 'TOKEN_INVALID'
        ? tLater('accountAction.resetInvalid')
        : copy
          ? tLater(copy.key, copy.vars)
          : tLater('accountAction.resetFailed'));
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
