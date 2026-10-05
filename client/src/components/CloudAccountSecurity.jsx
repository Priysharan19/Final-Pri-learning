import React, { useEffect, useMemo, useState } from 'react';
import { cloud } from '../platform/cloudTransport.js';
import { disconnectCloudAccount } from '../platform/cloudAccount.js';
import { requestIdentityToken, socialProviderConfig } from '../platform/socialSignIn.js';
import { tLater, useT } from '../i18n/index.js';
import { downloadJSON } from '../lib/files.js';
import { cloudErrorCopy } from '../platform/cloudErrorCopy.js';
import OtpInput, { OTP_LENGTH } from './OtpInput.jsx';

function when(value, t) {
  if (!value) return t('cloud.unknown');
  try { return new Date(value).toLocaleString(); } catch { return t('cloud.unknown'); }
}

export default function CloudAccountSecurity({ pid, account, onChanged, onDeleted }) {
  const t = useT();
  const [devices, setDevices] = useState([]);
  const [providers, setProviders] = useState([]);
  const [password, setPassword] = useState({ current: '', next: '', confirm: '' });
  const [deletePassword, setDeletePassword] = useState('');
  const [deletePhrase, setDeletePhrase] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  // The export asks the session to prove its credential again when the last
  // proof is older than the server's window (401 REAUTH_REQUIRED). What is
  // asked for depends on how the account signs in: its password, a code to
  // its own phone or email, or a fresh Apple/Google identity.
  const [reauth, setReauth] = useState(null);

  const hasPassword = providers.some(row => row.provider === 'password');
  const socialProviders = providers.filter(row => row.provider === 'google' || row.provider === 'apple');
  const canDeleteWithPassword = hasPassword && deletePhrase.trim() === 'DELETE' && deletePassword.length > 0;
  // An account made with Google or Apple has no password; deleting it takes a
  // fresh sign-in with that provider, run here exactly as the sign-in is.
  const [webProviders, setWebProviders] = useState({ google: null, apple: null });
  const reauthProviders = socialProviders.filter(row => webProviders[row.provider]);
  // Every passwordless account — made with a one-time code, or with Google or
  // Apple — can also prove itself with a fresh code sent to its own email
  // address or mobile number (POST /v1/account/otp/reauth-request; the server
  // picks the destination, the client never names it). This is what makes
  // in-app deletion reachable for every sign-in method (Apple 5.1.1(v), Play).
  const [codeChallenge, setCodeChallenge] = useState(null);
  const [code, setCode] = useState('');
  const [codeInvalid, setCodeInvalid] = useState(false);
  const canDeleteWithCode = !hasPassword && !!codeChallenge && code.length === OTP_LENGTH && deletePhrase.trim() === 'DELETE';

  useEffect(() => {
    let live = true;
    if (hasPassword || !socialProviders.length) return () => { live = false; };
    socialProviderConfig()
      .then(config => { if (live) setWebProviders(config); })
      .catch(() => {});
    return () => { live = false; };
  }, [hasPassword, socialProviders.length]);

  async function reload() {
    const [deviceResult, identityResult] = await Promise.all([cloud.devices(), cloud.identities()]);
    setDevices(Array.isArray(deviceResult?.devices) ? deviceResult.devices : []);
    setProviders(Array.isArray(identityResult?.providers) ? identityResult.providers : []);
  }

  useEffect(() => {
    let live = true;
    Promise.all([cloud.devices(), cloud.identities()])
      .then(([deviceResult, identityResult]) => {
        if (!live) return;
        setDevices(Array.isArray(deviceResult?.devices) ? deviceResult.devices : []);
        setProviders(Array.isArray(identityResult?.providers) ? identityResult.providers : []);
      })
      .catch(() => {});
    return () => { live = false; };
  }, [pid]);

  function start(action) {
    setBusy(action);
    setMessage('');
    setError('');
  }

  async function resendVerification() {
    start('verify');
    try {
      const result = await cloud.requestEmailVerification();
      setMessage(result?.alreadyVerified ? tLater('cloudSecurity.alreadyVerified') : tLater('cloudSecurity.verificationQueued'));
      await onChanged?.();
    } catch (err) { setError(err.message || tLater('cloudSecurity.verificationFailed')); }
    finally { setBusy(''); }
  }

  async function changePassword(e) {
    e.preventDefault();
    if (password.next !== password.confirm) {
      setError(tLater('cloudSecurity.passwordMismatch'));
      return;
    }
    start('password');
    try {
      await cloud.changePassword({ currentPassword: password.current, newPassword: password.next });
      setPassword({ current: '', next: '', confirm: '' });
      setMessage(tLater('cloudSecurity.passwordChanged'));
      await reload();
      await onChanged?.();
    } catch (err) { const copy = cloudErrorCopy(err); setError(copy ? tLater(copy.key, copy.vars) : (err.message || tLater('cloudSecurity.passwordChangeFailed'))); }
    finally { setBusy(''); }
  }

  async function revoke(session) {
    start(`revoke:${session.id}`);
    try {
      const result = await cloud.revokeDevice(session.id);
      if (result?.current) {
        await disconnectCloudAccount(pid);
        setMessage(tLater('cloudSecurity.currentRevoked'));
        await onDeleted?.({ cloudDeleted: false, sessionRevoked: true });
        return;
      }
      setMessage(result?.revoked ? tLater('cloudSecurity.revoked') : tLater('cloudSecurity.alreadyInactive'));
      await reload();
    } catch (err) { setError(err.message || tLater('cloudSecurity.revokeFailed')); }
    finally { setBusy(''); }
  }

  async function exportAccount() {
    start('export');
    try {
      const result = await cloud.exportAccount();
      const suffix = new Date().toISOString().slice(0, 10);
      await downloadJSON(result, `pri-learning-account-export-${suffix}.json`);
      setReauth(null);
      setMessage(tLater('cloudSecurity.exported'));
    } catch (err) {
      if (err?.code === 'REAUTH_REQUIRED') await askForProof(err.reauthMethods);
      else setError(err.message || tLater('cloudSecurity.exportFailed'));
    } finally { setBusy(''); }
  }

  /** Open the proof step for the export. A code account is sent its code now. */
  async function askForProof(methods) {
    const list = Array.isArray(methods) && methods.length ? methods : (hasPassword ? ['password'] : socialProviders.length ? socialProviders.map(row => row.provider) : ['otp']);
    const next = { methods: list, password: '', code: '', challenge: null, channel: null };
    if (list.includes('otp')) {
      try {
        const sent = await cloud.otpReauthRequest();
        next.challenge = sent?.challengeId || null;
        next.channel = sent?.channel || null;
      } catch (err) { setError(err.message || tLater('cloudSecurity.reauthCodeFailed')); }
    }
    setReauth(next);
  }

  async function proveAndExport(e) {
    e?.preventDefault?.();
    if (!reauth || busy) return;
    start('reauth');
    try {
      if (reauth.methods.includes('password')) await cloud.reauth({ password: reauth.password });
      else if (reauth.methods.includes('otp')) await cloud.reauth({ otpChallengeId: reauth.challenge, otpCode: reauth.code.replace(/\s+/g, '') });
      else throw Object.assign(new Error(tLater('cloudSecurity.reauthProviderOnly')), { code: 'SOCIAL_REAUTH_REQUIRED' });
      setReauth(null);
      setBusy('');
      await exportAccount();
    } catch (err) {
      const copy = cloudErrorCopy(err);
      setError(copy ? tLater(copy.key, copy.vars) : (err.message || tLater('cloudSecurity.reauthFailed')));
      setBusy('');
    }
  }

  async function proveWithProvider(provider) {
    if (!webProviders[provider] || busy) return;
    start('reauth');
    try {
      const token = await requestIdentityToken(provider, webProviders[provider]);
      await cloud.reauth({ provider, idToken: token.idToken, nonce: token.nonce });
      setReauth(null);
      setBusy('');
      await exportAccount();
    } catch (err) {
      setError(err?.code === 'SOCIAL_CANCELLED' ? tLater('cloud.socialCancelled')
        : err?.code === 'SOCIAL_POPUP_BLOCKED' ? tLater('cloud.socialPopupBlocked')
          : err?.code?.startsWith?.('SOCIAL_') ? tLater('cloud.socialFailed')
            : (err.message || tLater('cloudSecurity.reauthFailed')));
      setBusy('');
    }
  }

  // Every session of this account, on every device, this one included.
  async function signOutEverywhere() {
    if (busy) return;
    if (typeof window !== 'undefined' && typeof window.confirm === 'function' && !window.confirm(tLater('cloudSecurity.signOutEverywhereConfirm'))) return;
    start('logout-all');
    try {
      const result = await cloud.logoutAll();
      await disconnectCloudAccount(pid);
      setMessage(tLater('cloudSecurity.signedOutEverywhere', { count: Number(result?.revoked) || 0, n: Number(result?.revoked) || 0 }));
      await onDeleted?.({ cloudDeleted: false, sessionRevoked: true });
    } catch (err) { setError(err.message || tLater('cloudSecurity.signOutEverywhereFailed')); }
    finally { setBusy(''); }
  }

  // Straight from the click, so the provider window is not blocked.
  async function deleteWithProvider(provider) {
    if (hasPassword || deletePhrase.trim() !== 'DELETE' || !webProviders[provider] || busy) return;
    start('delete');
    try {
      const token = await requestIdentityToken(provider, webProviders[provider]);
      await cloud.deleteAccount({ provider, idToken: token.idToken, nonce: token.nonce });
      await disconnectCloudAccount(pid);
      setDeletePhrase('');
      setMessage(tLater('cloudSecurity.deleted'));
      await onDeleted?.({ cloudDeleted: true });
    } catch (err) {
      setError(err?.code === 'SOCIAL_CANCELLED' ? tLater('cloud.socialCancelled')
        : err?.code === 'SOCIAL_POPUP_BLOCKED' ? tLater('cloud.socialPopupBlocked')
          : err?.code?.startsWith?.('SOCIAL_') ? tLater('cloud.socialFailed')
            : (err.message || tLater('cloudSecurity.deleteFailed')));
    } finally { setBusy(''); }
  }

  async function requestDeleteCode() {
    if (hasPassword || busy) return;
    start('code');
    try {
      const sent = await cloud.otpReauthRequest();
      setCodeChallenge(sent?.challengeId || null);
      setCode('');
      setCodeInvalid(false);
      setMessage(tLater('cloudSecurity.codeSent'));
    } catch (err) { setError(err.message || tLater('cloudSecurity.deleteFailed')); }
    finally { setBusy(''); }
  }

  async function deleteWithCode() {
    if (!canDeleteWithCode || busy) return;
    start('delete');
    try {
      await cloud.deleteAccount({ otpChallengeId: codeChallenge, otpCode: code });
      setCode('');
      setCodeChallenge(null);
      setDeletePhrase('');
      setMessage(tLater('cloudSecurity.deleted'));
      await onDeleted?.({ cloudDeleted: true });
    } catch (err) {
      const wrongCode = err?.code === 'OTP_REAUTH_FAILED';
      setCodeInvalid(wrongCode);
      setCode('');
      setError(wrongCode ? tLater('cloudSecurity.codeInvalid') : (err.message || tLater('cloudSecurity.deleteFailed')));
    } finally { setBusy(''); }
  }

  async function deleteAccount(e) {
    e.preventDefault();
    if (!canDeleteWithPassword) return;
    start('delete');
    try {
      await cloud.deleteAccount({ password: deletePassword });
      await disconnectCloudAccount(pid);
      setDeletePassword('');
      setDeletePhrase('');
      setMessage(tLater('cloudSecurity.deleted'));
      await onDeleted?.({ cloudDeleted: true });
    } catch (err) { setError(err.message || tLater('cloudSecurity.deleteFailed')); }
    finally { setBusy(''); }
  }

  const providerLabel = useMemo(() => ({ password: t('cloudSecurity.providerPassword'), google: 'Google', apple: 'Apple' }), [t]);

  return (
    <div style={{ marginTop: 14 }}>
      {!account?.emailVerified && <div className="card" style={{ boxShadow: 'none', marginBottom: 14 }}>
        <div className="sc-label">{t('cloudSecurity.emailVerification')}</div>
        <div style={{ fontWeight: 650, marginTop: 4 }}>{t('cloudSecurity.verificationRequired')}</div>
        <p className="muted" style={{ fontSize: 13, margin: '6px 0 10px' }}>
          {t('cloudSecurity.verifyHelp')}
        </p>
        <button className="btn btn-ghost btn-sm" type="button" onClick={resendVerification} disabled={!!busy}>
          {busy === 'verify' ? t('cloud.requesting') : t('cloudSecurity.sendVerification')}
        </button>
      </div>}

      <div className="grid cols-2" style={{ gap: 14 }}>
        <div className="card" style={{ boxShadow: 'none' }}>
          <div className="sc-label">{t('cloudSecurity.signInMethods')}</div>
          <div style={{ fontWeight: 650, marginTop: 4 }}>{t('cloudSecurity.linkedProviders')}</div>
          <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
            {providers.length ? providers.map(row => (
              <div className="spread" key={row.provider} style={{ gap: 12 }}>
                <span>{providerLabel[row.provider] || row.provider}</span>
                <span className="muted" style={{ fontSize: 12 }}>{t('cloudSecurity.linkedAt', { when: when(row.linkedAt, t) })}</span>
              </div>
            )) : <div className="muted" style={{ fontSize: 13 }}>{t('cloudSecurity.providersUnavailable')}</div>}
          </div>
          {socialProviders.length === 0 && <p className="muted" style={{ fontSize: 12, margin: '10px 0 0' }}>
            {t('cloudSecurity.socialNote')}
          </p>}
        </div>

        <div className="card" style={{ boxShadow: 'none' }}>
          <div className="sc-label">{t('login.privacy')}</div>
          <div style={{ fontWeight: 650, marginTop: 4 }}>{t('cloudSecurity.exportTitle')}</div>
          <p className="muted" style={{ fontSize: 13, margin: '6px 0 10px' }}>
            {t('cloudSecurity.exportHelp')}
          </p>
          <button className="btn btn-ghost btn-sm" type="button" onClick={exportAccount} disabled={!!busy || !!reauth} data-testid="cloud-export">
            {busy === 'export' ? t('cloudSecurity.preparing') : t('cloudSecurity.exportButton')}
          </button>
          {reauth && <form onSubmit={proveAndExport} style={{ marginTop: 12 }} data-testid="cloud-export-reauth">
            <p className="muted" style={{ fontSize: 13, margin: '0 0 8px' }}>{t('cloudSecurity.reauthExportWhy')}</p>
            {reauth.methods.includes('password') && <div className="field" style={{ maxWidth: 320 }}>
              <label className="label" htmlFor="cloud-reauth-password">{t('cloudSecurity.confirmPassword')}</label>
              <input className="input" id="cloud-reauth-password" type="password" autoComplete="current-password" maxLength={200}
                value={reauth.password} onChange={e => setReauth(r => ({ ...r, password: e.target.value }))} required />
            </div>}
            {!reauth.methods.includes('password') && reauth.methods.includes('otp') && <div className="field" style={{ maxWidth: 320 }}>
              <label className="label" htmlFor="cloud-reauth-code">
                {t(reauth.channel === 'sms' ? 'cloudSecurity.reauthCodePhone' : 'cloudSecurity.reauthCodeEmail')}
              </label>
              <input className="input" id="cloud-reauth-code" inputMode="numeric" autoComplete="one-time-code" maxLength={8}
                value={reauth.code} onChange={e => setReauth(r => ({ ...r, code: e.target.value }))} required />
            </div>}
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              {(reauth.methods.includes('password') || reauth.methods.includes('otp')) && (
                <button className="btn btn-primary btn-sm" type="submit" disabled={!!busy || (reauth.methods.includes('password') ? !reauth.password : !reauth.code)}>
                  {busy === 'reauth' ? t('cloudSecurity.confirming') : t('cloudSecurity.confirmAndExport')}
                </button>
              )}
              {reauth.methods.filter(m => m === 'google' || m === 'apple').map(provider => (
                <button key={provider} className="btn btn-primary btn-sm" type="button" disabled={!!busy || !webProviders[provider]} onClick={() => proveWithProvider(provider)}>
                  {busy === 'reauth' ? t('cloudSecurity.confirming') : t('cloudSecurity.confirmWithProvider', { provider: providerLabel[provider] })}
                </button>
              ))}
              <button className="btn btn-quiet btn-sm" type="button" disabled={!!busy} onClick={() => setReauth(null)}>{t('common.cancel')}</button>
            </div>
          </form>}
        </div>
      </div>

      <div className="card" style={{ boxShadow: 'none', marginTop: 14 }}>
        <div className="sc-label">{t('cloudSecurity.activeDevices')}</div>
        <div style={{ fontWeight: 650, marginTop: 4 }}>{t('cloudSecurity.sessions')}</div>
        <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
          {devices.length ? devices.map(session => (
            <div className="spread" key={session.id} style={{ gap: 12, alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{session.current ? t('cloudSecurity.thisDevice') : session.deviceId || t('cloudSecurity.defaultDevice')}</div>
                <div className="muted" style={{ fontSize: 12 }}>{t('cloudSecurity.lastUsed', { lastUsed: when(session.lastSeenAt, t), expires: when(session.expiresAt, t) })}</div>
              </div>
              <button className="btn btn-quiet btn-sm" type="button" onClick={() => revoke(session)} disabled={!!busy}>
                {busy === `revoke:${session.id}` ? t('cloudSecurity.revoking') : session.current ? t('cloudSecurity.signOutDevice') : t('cloudSecurity.revoke')}
              </button>
            </div>
          )) : <div className="muted" style={{ fontSize: 13 }}>{t('cloudSecurity.noSessions')}</div>}
        </div>
        <p className="muted" style={{ fontSize: 12.5, margin: '12px 0 8px' }}>{t('cloudSecurity.newDeviceNote')}</p>
        <button className="btn btn-quiet btn-sm" type="button" onClick={signOutEverywhere} disabled={!!busy} data-testid="cloud-sign-out-everywhere">
          {busy === 'logout-all' ? t('cloudSecurity.signingOutEverywhere') : t('cloudSecurity.signOutEverywhere')}
        </button>
      </div>

      {hasPassword && <form className="card" style={{ boxShadow: 'none', marginTop: 14 }} onSubmit={changePassword}>
        <div className="sc-label">{t('login.password')}</div>
        <div style={{ fontWeight: 650, marginTop: 4 }}>{t('settings.changePasswordAction')}</div>
        <div className="grid cols-3" style={{ gap: 10, marginTop: 10 }}>
          <div className="field">
            <label className="label" htmlFor="cloud-current-password">{t('settings.currentPassword')}</label>
            <input className="input" id="cloud-current-password" type="password" autoComplete="current-password" maxLength={200} value={password.current} onChange={e => setPassword(v => ({ ...v, current: e.target.value }))} required />
          </div>
          <div className="field">
            <label className="label" htmlFor="cloud-new-password">{t('settings.newPassword')}</label>
            <input className="input" id="cloud-new-password" type="password" autoComplete="new-password" minLength={10} maxLength={200} value={password.next} onChange={e => setPassword(v => ({ ...v, next: e.target.value }))} required />
          </div>
          <div className="field">
            <label className="label" htmlFor="cloud-confirm-password">{t('cloudSecurity.confirmNewPassword')}</label>
            <input className="input" id="cloud-confirm-password" type="password" autoComplete="new-password" minLength={10} maxLength={200} value={password.confirm} onChange={e => setPassword(v => ({ ...v, confirm: e.target.value }))} required />
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" type="submit" disabled={!!busy} style={{ marginTop: 10 }}>
          {busy === 'password' ? t('cloudSecurity.changing') : t('settings.changePasswordAction')}
        </button>
      </form>}

      <form className="card" style={{ boxShadow: 'none', marginTop: 14, borderColor: 'var(--bad)' }} onSubmit={deleteAccount}>
        <div className="sc-label">{t('cloudSecurity.dangerZone')}</div>
        <div style={{ fontWeight: 650, marginTop: 4 }}>{t('cloudSecurity.deleteTitle')}</div>
        <p className="muted" style={{ fontSize: 13, margin: '6px 0 10px' }}>
          {t('cloudSecurity.deleteHelp')} {t('cloudSecurity.appleSubscriptionNote')}
        </p>
        {hasPassword ? <>
          <div className="grid cols-2" style={{ gap: 10 }}>
            <div className="field">
              <label className="label" htmlFor="cloud-delete-password">{t('cloudSecurity.confirmPassword')}</label>
              <input className="input" id="cloud-delete-password" type="password" autoComplete="current-password" maxLength={200} value={deletePassword} onChange={e => setDeletePassword(e.target.value)} required />
            </div>
            <div className="field">
              <label className="label" htmlFor="cloud-delete-phrase">{t('cloudSecurity.typeDelete')}</label>
              <input className="input" id="cloud-delete-phrase" autoComplete="off" value={deletePhrase} onChange={e => setDeletePhrase(e.target.value)} required />
            </div>
          </div>
          <button className="btn btn-quiet btn-sm" type="submit" disabled={!canDeleteWithPassword || !!busy} style={{ marginTop: 10 }}>
            {busy === 'delete' ? t('settings.deleting') : t('cloudSecurity.deleteButton')}
          </button>
        </> : <>
          <div className="field" style={{ maxWidth: 320 }}>
            <label className="label" htmlFor="cloud-delete-phrase">{t('cloudSecurity.typeDelete')}</label>
            <input className="input" id="cloud-delete-phrase" autoComplete="off" value={deletePhrase} onChange={e => setDeletePhrase(e.target.value)} />
          </div>
          {reauthProviders.length > 0 && <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            {reauthProviders.map(row => (
              <button key={row.provider} className="btn btn-quiet btn-sm" type="button" data-delete-provider={row.provider}
                disabled={deletePhrase.trim() !== 'DELETE' || !!busy} onClick={() => deleteWithProvider(row.provider)}>
                {busy === 'delete' ? t('settings.deleting') : t('cloudSecurity.deleteWithProvider', { provider: providerLabel[row.provider] })}
              </button>
            ))}
          </div>}
          <p className="muted" style={{ fontSize: 13, margin: '10px 0 8px' }}>
            {reauthProviders.length ? t('cloudSecurity.orWithCode') : t('cloudSecurity.codeDeleteHelp')}
          </p>
          {codeChallenge ? <>
            <p className="label" id="cloud-delete-code-label" style={{ margin: '0 0 6px' }}>{t('cloudSecurity.codeLabel')}</p>
            <OtpInput value={code} onChange={value => { setCode(value); setCodeInvalid(false); setError(''); }} autoFocus={false}
              disabled={!!busy} invalid={codeInvalid} idPrefix="cloud-delete-code" labelledBy="cloud-delete-code-label" />
            <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              <button className="btn btn-quiet btn-sm" type="button" data-testid="cloud-delete-with-code" disabled={!canDeleteWithCode || !!busy} onClick={deleteWithCode}>
                {busy === 'delete' ? t('settings.deleting') : t('cloudSecurity.deleteWithCode')}
              </button>
              <button className="btn btn-ghost btn-sm" type="button" disabled={!!busy} onClick={requestDeleteCode}>
                {busy === 'code' ? t('cloudSecurity.sendingCode') : t('cloudSecurity.sendCode')}
              </button>
            </div>
          </> : <button className="btn btn-ghost btn-sm" type="button" data-testid="cloud-delete-send-code" disabled={!!busy} onClick={requestDeleteCode}>
            {busy === 'code' ? t('cloudSecurity.sendingCode') : t('cloudSecurity.sendCode')}
          </button>}
        </>}
      </form>

      {message && <div role="status" style={{ marginTop: 12, color: 'var(--good)' }}>{message}</div>}
      {error && <div role="alert" style={{ marginTop: 12, color: 'var(--bad)' }}>{error}</div>}
    </div>
  );
}
