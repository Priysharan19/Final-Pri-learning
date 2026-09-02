import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../App.jsx';
import { cloud, cloudAvailable } from '../platform/cloudTransport.js';
import {
  cloudAccountLink, disconnectCloudAccount, loginCloudAccount,
  refreshCloudEntitlement, registerCloudAccount, verifyCloudSession
} from '../platform/cloudAccount.js';
import { cloudSyncStatus, syncNow } from '../platform/syncWorker.js';
import { normalizeCommercialDisplay } from '../platform/entitlements.js';

function when(value) {
  if (!value) return 'Never';
  try { return new Date(value).toLocaleString(); } catch { return 'Unknown'; }
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

function pricingText(config) {
  if (!config) return 'Storefront pricing is not available while the cloud service is offline.';
  const monthly = price(config.monthly, config.currency);
  const annual = price(config.annual, config.currency);
  const pieces = [];
  if (monthly) pieces.push(`${monthly}/month`);
  if (annual) pieces.push(`${annual}/year`);
  if (!pieces.length) return 'Public pricing has not been configured for this deployment yet. Store/provider pricing remains authoritative.';
  const trial = config.trialDays ? ` with a ${config.trialDays}-day trial` : '';
  return `${pieces.join(' or ')}${trial}. Display pricing is advisory; checkout/storefront pricing and server entitlements remain authoritative.`;
}

export default function CloudAccountPanel() {
  const { user } = useApp();
  const enabled = cloudAvailable();
  const [link, setLink] = useState(null);
  const [status, setStatus] = useState(null);
  const [session, setSession] = useState(null);
  const [pricing, setPricing] = useState(null);
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: user?.name || '', email: '', password: '' });
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function reload({ verify = true } = {}) {
    if (!user?.id) return;
    const [saved, sync] = await Promise.all([
      cloudAccountLink(user.id), cloudSyncStatus(user.id)
    ]);
    setLink(saved);
    setStatus(sync);
    if (enabled && verify && saved?.accountId) {
      const verified = await verifyCloudSession(user.id).catch(err => ({ connected: false, reason: err.code || 'unavailable' }));
      setSession(verified);
      if (verified.connected) {
        const entitlement = await refreshCloudEntitlement(user.id).catch(() => null);
        if (entitlement) setLink(await cloudAccountLink(user.id));
      }
    } else setSession(saved?.accountId ? { connected: false, reason: enabled ? 'not-verified' : 'cloud-disabled' } : null);
  }

  useEffect(() => { reload().catch(() => {}); }, [user?.id, enabled]);
  useEffect(() => {
    let live = true;
    if (!enabled) { setPricing(null); return () => { live = false; }; }
    cloud.billingConfig()
      .then(result => { if (live) setPricing(normalizeCommercialDisplay(result?.display)); })
      .catch(() => { if (live) setPricing(null); });
    return () => { live = false; };
  }, [enabled]);

  const entitlement = link?.entitlement;
  const premium = !!entitlement?.active;
  const pending = status?.pending || 0;
  const canSync = enabled && !!link?.accountId && !!session?.connected;
  const liveAccount = session?.connected ? session.account : null;

  async function submit(e) {
    e.preventDefault();
    if (!enabled) return;
    setBusy(mode);
    setError('');
    setMessage('');
    try {
      if (mode === 'register') {
        await registerCloudAccount(user.id, { name: form.name || user.name, email: form.email, password: form.password });
        setMessage('Cloud account created and linked to this local profile. Your local profile still works offline.');
      } else {
        await loginCloudAccount(user.id, { email: form.email, password: form.password });
        setMessage('Cloud account connected.');
      }
      setForm(v => ({ ...v, password: '' }));
      await reload();
    } catch (err) { setError(err.message || 'Could not connect this account.'); }
    finally { setBusy(''); }
  }

  async function doSync() {
    setBusy('sync');
    setError('');
    setMessage('');
    try {
      const result = await syncNow(user.id);
      setMessage(`Sync complete: ${result.pushedEvents || 0} learning event(s), ${result.pushedEntities || 0} record(s) pushed; ${result.pulledEvents || 0} event(s), ${result.pulledEntities || 0} record(s) received.`);
      await reload({ verify: false });
    } catch (err) { setError(err.message || 'Sync could not complete. Your local work is still safe on this device.'); }
    finally { setBusy(''); }
  }

  async function disconnect() {
    setBusy('disconnect');
    setError('');
    try {
      await disconnectCloudAccount(user.id);
      setLink(null); setStatus(null); setSession(null);
      setMessage('Cloud account disconnected from this local profile. Local learning data was not deleted.');
    } catch (err) { setError(err.message || 'Could not disconnect.'); }
    finally { setBusy(''); }
  }

  const stateLabel = useMemo(() => {
    if (!link?.accountId) return 'Not connected';
    if (!enabled) return 'Linked locally · cloud endpoint unavailable';
    if (!session?.connected) return 'Linked · sign-in required';
    return 'Connected';
  }, [link, enabled, session]);

  return (
    <section className="card" aria-labelledby="cloud-account-title" style={{ marginTop: 18 }}>
      <div className="spread" style={{ alignItems: 'flex-start', gap: 16 }}>
        <div>
          <div className="card-title" id="cloud-account-title" style={{ marginBottom: 4 }}>Account & cross-device sync</div>
          <p className="sub" style={{ margin: 0, maxWidth: 720 }}>
            Your local profile remains available offline. Connecting a Pri Learning account adds authenticated cross-device sync and server-authorised Premium entitlements; it does not replace the local profile or its encryption keys.
          </p>
        </div>
        <span className={`tag ${session?.connected ? 'tag-brand' : ''}`}>{stateLabel}</span>
      </div>

      {!enabled && <div style={{ marginTop: 14 }} className="muted">
        This build has no Pri cloud origin configured, so account and sync controls are disabled. Offline practice continues normally.
      </div>}

      {enabled && !link?.accountId && <form onSubmit={submit} style={{ marginTop: 16 }}>
        <div className="row" style={{ gap: 8, marginBottom: 12 }}>
          <button type="button" className={`btn btn-sm ${mode === 'login' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMode('login')}>Sign in</button>
          <button type="button" className={`btn btn-sm ${mode === 'register' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMode('register')}>Create account</button>
        </div>
        <div className="grid cols-2" style={{ gap: 12 }}>
          {mode === 'register' && <div className="field">
            <label className="label" htmlFor="cloud-name">Name</label>
            <input className="input" id="cloud-name" autoComplete="name" maxLength={80} value={form.name} onChange={e => setForm(v => ({ ...v, name: e.target.value }))} required />
          </div>}
          <div className="field">
            <label className="label" htmlFor="cloud-email">Email</label>
            <input className="input" id="cloud-email" type="email" autoComplete="email" maxLength={254} value={form.email} onChange={e => setForm(v => ({ ...v, email: e.target.value }))} required />
          </div>
          <div className="field">
            <label className="label" htmlFor="cloud-password">Password</label>
            <input className="input" id="cloud-password" type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} minLength={10} maxLength={200} value={form.password} onChange={e => setForm(v => ({ ...v, password: e.target.value }))} required />
          </div>
        </div>
        <button className="btn btn-primary" type="submit" disabled={!!busy} style={{ marginTop: 8 }}>
          {busy ? 'Connecting…' : mode === 'register' ? 'Create and connect account' : 'Connect account'}
        </button>
      </form>}

      {link?.accountId && <div className="grid cols-2" style={{ gap: 14, marginTop: 16 }}>
        <div className="card" style={{ boxShadow: 'none' }}>
          <div className="sc-label">Cloud identity</div>
          <div style={{ fontWeight: 680, marginTop: 4 }}>{liveAccount?.name || user.name}</div>
          <div className="muted" style={{ fontSize: 13 }}>{liveAccount?.email || 'Account details available after sign-in'}</div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            <span className="tag">{liveAccount?.role || link.role}</span>
            <span className="tag">{(liveAccount?.emailVerified ?? link.emailVerified) ? 'Email verified' : 'Email verification pending'}</span>
          </div>
        </div>
        <div className="card" style={{ boxShadow: 'none' }}>
          <div className="sc-label">Premium authority</div>
          <div style={{ fontWeight: 680, marginTop: 4 }}>{premium ? 'Premium active' : 'Free'}</div>
          <div className="muted" style={{ fontSize: 13 }}>
            {premium ? `${entitlement.status} · ${entitlement.provider}` : entitlement?.stale ? 'Paid cache expired; reconnect to refresh.' : 'No active paid entitlement.'}
          </div>
          {entitlement?.offlineUntil && <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Offline entitlement valid until {when(entitlement.offlineUntil)}</div>}
        </div>
      </div>}

      {link?.accountId && <div className="card" style={{ boxShadow: 'none', marginTop: 14 }}>
        <div className="spread" style={{ gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div className="sc-label">Sync status</div>
            <div style={{ fontWeight: 650, marginTop: 3 }}>{pending ? `${pending} local change${pending === 1 ? '' : 's'} waiting` : 'Local outbox clear'}</div>
            <div className="muted" style={{ fontSize: 12 }}>Last successful sync: {when(status?.lastSyncAt)}</div>
            {status?.lastError && <div style={{ color: 'var(--bad)', fontSize: 12 }}>Last error: {status.lastError}</div>}
          </div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={doSync} disabled={!canSync || !!busy}>{busy === 'sync' ? 'Syncing…' : 'Sync now'}</button>
            <button className="btn btn-ghost" onClick={() => refreshCloudEntitlement(user.id).then(() => reload({ verify: false })).catch(err => setError(err.message))} disabled={!canSync || !!busy}>Refresh Premium</button>
            <button className="btn btn-quiet" onClick={disconnect} disabled={!!busy}>Disconnect</button>
          </div>
        </div>
      </div>}

      <div className="muted" style={{ marginTop: 14, fontSize: 12.5 }}>
        {pricingText(pricing)}
      </div>

      {message && <div role="status" style={{ marginTop: 12, color: 'var(--good)' }}>{message}</div>}
      {error && <div role="alert" style={{ marginTop: 12, color: 'var(--bad)' }}>{error}</div>}
    </section>
  );
}
