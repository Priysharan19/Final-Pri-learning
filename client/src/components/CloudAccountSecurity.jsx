import React, { useEffect, useMemo, useState } from 'react';
import { cloud } from '../platform/cloudTransport.js';
import { disconnectCloudAccount } from '../platform/cloudAccount.js';

function when(value) {
  if (!value) return 'Unknown';
  try { return new Date(value).toLocaleString(); } catch { return 'Unknown'; }
}

function downloadJson(filename, value) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(href), 0);
}

export default function CloudAccountSecurity({ pid, account, onChanged, onDeleted }) {
  const [devices, setDevices] = useState([]);
  const [providers, setProviders] = useState([]);
  const [password, setPassword] = useState({ current: '', next: '', confirm: '' });
  const [deletePassword, setDeletePassword] = useState('');
  const [deletePhrase, setDeletePhrase] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const hasPassword = providers.some(row => row.provider === 'password');
  const socialProviders = providers.filter(row => row.provider === 'google' || row.provider === 'apple');
  const canDeleteWithPassword = hasPassword && deletePhrase.trim() === 'DELETE' && deletePassword.length > 0;

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
      setMessage(result?.alreadyVerified ? 'This email is already verified.' : 'A fresh verification email has been queued. Older unused verification links were invalidated.');
      await onChanged?.();
    } catch (err) { setError(err.message || 'Could not request a verification email.'); }
    finally { setBusy(''); }
  }

  async function changePassword(e) {
    e.preventDefault();
    if (password.next !== password.confirm) {
      setError('New passwords do not match.');
      return;
    }
    start('password');
    try {
      await cloud.changePassword({ currentPassword: password.current, newPassword: password.next });
      setPassword({ current: '', next: '', confirm: '' });
      setMessage('Password changed. This device received a fresh session and every other signed-in session was revoked.');
      await reload();
      await onChanged?.();
    } catch (err) { setError(err.message || 'Password could not be changed.'); }
    finally { setBusy(''); }
  }

  async function revoke(session) {
    start(`revoke:${session.id}`);
    try {
      const result = await cloud.revokeDevice(session.id);
      if (result?.current) {
        await disconnectCloudAccount(pid);
        setMessage('This device session was revoked. Local learning data remains on this device.');
        await onDeleted?.({ cloudDeleted: false, sessionRevoked: true });
        return;
      }
      setMessage(result?.revoked ? 'Device session revoked.' : 'That session was already inactive.');
      await reload();
    } catch (err) { setError(err.message || 'Could not revoke that device session.'); }
    finally { setBusy(''); }
  }

  async function exportAccount() {
    start('export');
    try {
      const result = await cloud.exportAccount();
      const suffix = new Date().toISOString().slice(0, 10);
      downloadJson(`pri-learning-account-export-${suffix}.json`, result);
      setMessage('Cloud account export created on this device.');
    } catch (err) { setError(err.message || 'Could not export this account.'); }
    finally { setBusy(''); }
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
      setMessage('Cloud account deleted. Your separate offline profile on this device was not deleted.');
      await onDeleted?.({ cloudDeleted: true });
    } catch (err) { setError(err.message || 'Cloud account could not be deleted.'); }
    finally { setBusy(''); }
  }

  const providerLabel = useMemo(() => ({ password: 'Email + password', google: 'Google', apple: 'Apple' }), []);

  return (
    <div style={{ marginTop: 14 }}>
      {!account?.emailVerified && <div className="card" style={{ boxShadow: 'none', marginBottom: 14 }}>
        <div className="sc-label">Email verification</div>
        <div style={{ fontWeight: 650, marginTop: 4 }}>Verification is still required</div>
        <p className="muted" style={{ fontSize: 13, margin: '6px 0 10px' }}>
          Verify the account email before relying on recovery and other identity-sensitive features.
        </p>
        <button className="btn btn-ghost btn-sm" type="button" onClick={resendVerification} disabled={!!busy}>
          {busy === 'verify' ? 'Requesting…' : 'Send a fresh verification email'}
        </button>
      </div>}

      <div className="grid cols-2" style={{ gap: 14 }}>
        <div className="card" style={{ boxShadow: 'none' }}>
          <div className="sc-label">Sign-in methods</div>
          <div style={{ fontWeight: 650, marginTop: 4 }}>Linked providers</div>
          <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
            {providers.length ? providers.map(row => (
              <div className="spread" key={row.provider} style={{ gap: 12 }}>
                <span>{providerLabel[row.provider] || row.provider}</span>
                <span className="muted" style={{ fontSize: 12 }}>Linked {when(row.linkedAt)}</span>
              </div>
            )) : <div className="muted" style={{ fontSize: 13 }}>Provider status unavailable.</div>}
          </div>
          {socialProviders.length === 0 && <p className="muted" style={{ fontSize: 12, margin: '10px 0 0' }}>
            Google/Apple linking requires a fresh provider token from the production identity UI. Pri Learning never accepts a typed provider subject or unverified email as a substitute.
          </p>}
        </div>

        <div className="card" style={{ boxShadow: 'none' }}>
          <div className="sc-label">Privacy</div>
          <div style={{ fontWeight: 650, marginTop: 4 }}>Export cloud account data</div>
          <p className="muted" style={{ fontSize: 13, margin: '6px 0 10px' }}>
            Export the account record, replicated learning events/entities and class memberships held by the Pri cloud service.
          </p>
          <button className="btn btn-ghost btn-sm" type="button" onClick={exportAccount} disabled={!!busy}>
            {busy === 'export' ? 'Preparing…' : 'Export cloud data'}
          </button>
        </div>
      </div>

      <div className="card" style={{ boxShadow: 'none', marginTop: 14 }}>
        <div className="sc-label">Active devices</div>
        <div style={{ fontWeight: 650, marginTop: 4 }}>Signed-in sessions</div>
        <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
          {devices.length ? devices.map(session => (
            <div className="spread" key={session.id} style={{ gap: 12, alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{session.current ? 'This device' : session.deviceId || 'Pri Learning device'}</div>
                <div className="muted" style={{ fontSize: 12 }}>Last used {when(session.lastSeenAt)} · expires {when(session.expiresAt)}</div>
              </div>
              <button className="btn btn-quiet btn-sm" type="button" onClick={() => revoke(session)} disabled={!!busy}>
                {busy === `revoke:${session.id}` ? 'Revoking…' : session.current ? 'Sign out this device' : 'Revoke'}
              </button>
            </div>
          )) : <div className="muted" style={{ fontSize: 13 }}>No active sessions were returned.</div>}
        </div>
      </div>

      {hasPassword && <form className="card" style={{ boxShadow: 'none', marginTop: 14 }} onSubmit={changePassword}>
        <div className="sc-label">Password</div>
        <div style={{ fontWeight: 650, marginTop: 4 }}>Change password</div>
        <div className="grid cols-3" style={{ gap: 10, marginTop: 10 }}>
          <div className="field">
            <label className="label" htmlFor="cloud-current-password">Current password</label>
            <input className="input" id="cloud-current-password" type="password" autoComplete="current-password" maxLength={200} value={password.current} onChange={e => setPassword(v => ({ ...v, current: e.target.value }))} required />
          </div>
          <div className="field">
            <label className="label" htmlFor="cloud-new-password">New password</label>
            <input className="input" id="cloud-new-password" type="password" autoComplete="new-password" minLength={10} maxLength={200} value={password.next} onChange={e => setPassword(v => ({ ...v, next: e.target.value }))} required />
          </div>
          <div className="field">
            <label className="label" htmlFor="cloud-confirm-password">Confirm new password</label>
            <input className="input" id="cloud-confirm-password" type="password" autoComplete="new-password" minLength={10} maxLength={200} value={password.confirm} onChange={e => setPassword(v => ({ ...v, confirm: e.target.value }))} required />
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" type="submit" disabled={!!busy} style={{ marginTop: 10 }}>
          {busy === 'password' ? 'Changing…' : 'Change password'}
        </button>
      </form>}

      <form className="card" style={{ boxShadow: 'none', marginTop: 14, borderColor: 'var(--bad)' }} onSubmit={deleteAccount}>
        <div className="sc-label">Danger zone</div>
        <div style={{ fontWeight: 650, marginTop: 4 }}>Delete cloud account</div>
        <p className="muted" style={{ fontSize: 13, margin: '6px 0 10px' }}>
          This permanently deletes first-party cloud account data and revokes cloud sessions. It does not silently erase the separate offline profile stored on this device.
        </p>
        {hasPassword ? <>
          <div className="grid cols-2" style={{ gap: 10 }}>
            <div className="field">
              <label className="label" htmlFor="cloud-delete-password">Confirm password</label>
              <input className="input" id="cloud-delete-password" type="password" autoComplete="current-password" maxLength={200} value={deletePassword} onChange={e => setDeletePassword(e.target.value)} required />
            </div>
            <div className="field">
              <label className="label" htmlFor="cloud-delete-phrase">Type DELETE</label>
              <input className="input" id="cloud-delete-phrase" autoComplete="off" value={deletePhrase} onChange={e => setDeletePhrase(e.target.value)} required />
            </div>
          </div>
          <button className="btn btn-quiet btn-sm" type="submit" disabled={!canDeleteWithPassword || !!busy} style={{ marginTop: 10 }}>
            {busy === 'delete' ? 'Deleting…' : 'Permanently delete cloud account'}
          </button>
        </> : <div className="muted" style={{ fontSize: 13 }}>
          This account requires fresh {socialProviders.map(row => providerLabel[row.provider]).join(' or ') || 'identity-provider'} confirmation before deletion. The server refuses session-only deletion; complete provider reauthentication through the production Google/Apple identity surface when that surface is configured.
        </div>}
      </form>

      {message && <div role="status" style={{ marginTop: 12, color: 'var(--good)' }}>{message}</div>}
      {error && <div role="alert" style={{ marginTop: 12, color: 'var(--bad)' }}>{error}</div>}
    </div>
  );
}
