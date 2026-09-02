import React, { useEffect, useMemo, useState } from 'react';
import { cloud, cloudAvailable } from '../platform/cloudTransport.js';

function parseJson(text, label) {
  let value;
  try { value = JSON.parse(text); }
  catch { throw new Error(`${label} must be valid JSON.`); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be a JSON object.`);
  return value;
}

function when(value) {
  if (!value) return '—';
  try { return new Date(value).toLocaleString(); } catch { return '—'; }
}

export default function StaffOperationsPanel() {
  const enabled = cloudAvailable();
  const [account, setAccount] = useState(null);
  const [revisions, setRevisions] = useState([]);
  const [health, setHealth] = useState(null);
  const [users, setUsers] = useState([]);
  const [audit, setAudit] = useState([]);
  const [draft, setDraft] = useState({
    contentKey: '', curriculumVersion: 'CBSE-2026-27',
    source: '{\n  "authority": "",\n  "reference": "",\n  "version": ""\n}',
    body: '{\n  "title": "",\n  "notes": [],\n  "workedExamples": [],\n  "questions": []\n}'
  });
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const role = account?.role;
  const staff = role === 'support' || role === 'admin';
  const admin = role === 'admin';
  const recentAudit = useMemo(() => audit.slice(0, 12), [audit]);

  async function reloadStaff() {
    if (!enabled) return;
    const me = await cloud.me();
    const nextAccount = me?.account || null;
    setAccount(nextAccount);
    if (!['support', 'admin'].includes(nextAccount?.role)) return;
    const rev = await cloud.contentRevisions();
    setRevisions(Array.isArray(rev?.revisions) ? rev.revisions : []);
    if (nextAccount.role === 'admin') {
      const [h, u, a] = await Promise.all([cloud.adminHealth(), cloud.adminUsers(), cloud.adminAudit()]);
      setHealth(h || null);
      setUsers(Array.isArray(u?.users) ? u.users : []);
      setAudit(Array.isArray(a?.entries) ? a.entries : []);
    }
  }

  useEffect(() => {
    let live = true;
    if (!enabled) return () => { live = false; };
    reloadStaff().catch(err => {
      if (!live || err?.status === 401 || err?.status === 403) return;
      setError(err.message || 'Staff operations could not be loaded.');
    });
    return () => { live = false; };
  }, [enabled]);

  async function createDraft(e) {
    e.preventDefault();
    setBusy('draft'); setError(''); setMessage('');
    try {
      const source = parseJson(draft.source, 'Source');
      const body = parseJson(draft.body, 'Content body');
      const result = await cloud.createContentDraft({
        contentKey: draft.contentKey.trim(),
        curriculumVersion: draft.curriculumVersion.trim(),
        source,
        body
      });
      setMessage(`Draft ${result?.revision?.contentKey || draft.contentKey} revision ${result?.revision?.revision || ''} created.`);
      setDraft(v => ({ ...v, contentKey: '' }));
      await reloadStaff();
    } catch (err) { setError(err.message || 'Could not create the content draft.'); }
    finally { setBusy(''); }
  }

  async function transition(revision, action) {
    setBusy(`${action}:${revision.id}`); setError(''); setMessage('');
    try {
      if (action === 'review') await cloud.submitContentReview(revision.id);
      else if (action === 'approve') await cloud.approveContent(revision.id);
      else if (action === 'publish') await cloud.publishContent(revision.id);
      setMessage(`Revision ${revision.revision} moved through ${action}.`);
      await reloadStaff();
    } catch (err) { setError(err.message || `Could not ${action} this revision.`); }
    finally { setBusy(''); }
  }

  async function changeRole(user, roleValue) {
    setBusy(`role:${user.id}`); setError(''); setMessage('');
    try {
      await cloud.updateUserRole(user.id, roleValue);
      setMessage(`${user.name || user.email} is now ${roleValue}.`);
      await reloadStaff();
    } catch (err) { setError(err.message || 'Could not change that account role.'); }
    finally { setBusy(''); }
  }

  if (!enabled || !staff) return null;

  return (
    <section className="card" aria-labelledby="staff-operations-title" style={{ marginTop: 18 }}>
      <div className="spread" style={{ alignItems: 'flex-start', gap: 16 }}>
        <div>
          <div className="card-title" id="staff-operations-title" style={{ marginBottom: 4 }}>Curriculum operations</div>
          <p className="sub" style={{ margin: 0, maxWidth: 780 }}>
            Staff content follows the server review workflow. Authors cannot approve their own revision, and only administrators can publish independently reviewed content.
          </p>
        </div>
        <span className="tag tag-brand">{admin ? 'Admin' : 'Support'}</span>
      </div>

      {error && <div className="notice error" role="alert" style={{ marginTop: 14 }}>{error}</div>}
      {message && <div className="notice success" role="status" style={{ marginTop: 14 }}>{message}</div>}

      <form onSubmit={createDraft} className="card" style={{ padding: 14, marginTop: 16 }}>
        <strong>Create curriculum revision</strong>
        <div className="grid-2" style={{ gap: 10, marginTop: 10 }}>
          <label className="field"><span>Content key</span><input required maxLength={200} value={draft.contentKey} onChange={e => setDraft(v => ({ ...v, contentKey: e.target.value }))} placeholder="cbse/class10/quadratics/lesson-1" /></label>
          <label className="field"><span>Curriculum version</span><input required maxLength={120} value={draft.curriculumVersion} onChange={e => setDraft(v => ({ ...v, curriculumVersion: e.target.value }))} /></label>
        </div>
        <label className="field"><span>Source evidence JSON</span><textarea rows={5} value={draft.source} onChange={e => setDraft(v => ({ ...v, source: e.target.value }))} /></label>
        <label className="field"><span>Content JSON</span><textarea rows={8} value={draft.body} onChange={e => setDraft(v => ({ ...v, body: e.target.value }))} /></label>
        <button className="btn btn-primary btn-sm" disabled={busy === 'draft'}>{busy === 'draft' ? 'Creating…' : 'Create draft'}</button>
      </form>

      <div style={{ marginTop: 16 }}>
        <strong>Recent revisions</strong>
        {!revisions.length && <p className="muted">No cloud revisions yet.</p>}
        <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
          {revisions.slice(0, 40).map(row => (
            <div className="card" key={row.id} style={{ padding: 12 }}>
              <div className="spread" style={{ gap: 12 }}>
                <div>
                  <strong>{row.contentKey}</strong>
                  <div className="muted">{row.curriculumVersion} · revision {row.revision} · {when(row.createdAt)}</div>
                </div>
                <span className="tag">{row.status}</span>
              </div>
              <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                {row.status === 'draft' && <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => transition(row, 'review')}>Submit for review</button>}
                {row.status === 'review' && <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => transition(row, 'approve')}>Approve independently</button>}
                {admin && row.status === 'approved' && <button type="button" className="btn btn-primary btn-sm" disabled={!!busy} onClick={() => transition(row, 'publish')}>Publish</button>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {admin && <>
        <div style={{ marginTop: 20 }}>
          <div className="card-title" style={{ marginBottom: 8 }}>Platform administration</div>
          {health && <div className="grid-2" style={{ gap: 10 }}>
            <div className="card" style={{ padding: 12 }}><strong>Accounts</strong><div>{health.accounts}</div><span className="muted">{health.activeSessions} active sessions</span></div>
            <div className="card" style={{ padding: 12 }}><strong>Operations</strong><div>{health.classes} classes · {health.publishedContent} published revisions</div><span className="muted">{health.openReports} open reports · {health.pendingDelivery} pending auth deliveries</span></div>
          </div>}
        </div>

        <div style={{ marginTop: 16 }}>
          <strong>Accounts and roles</strong>
          <div style={{ overflowX: 'auto', marginTop: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th align="left">Account</th><th align="left">Role</th><th align="left">Plan</th><th align="left">Change role</th></tr></thead>
              <tbody>{users.slice(0, 100).map(user => (
                <tr key={user.id}>
                  <td style={{ padding: '8px 6px' }}><strong>{user.name}</strong><div className="muted">{user.email}</div></td>
                  <td style={{ padding: '8px 6px' }}>{user.role}</td>
                  <td style={{ padding: '8px 6px' }}>{user.entitlement?.plan || 'free'} · {user.entitlement?.status || 'free'}</td>
                  <td style={{ padding: '8px 6px' }}>
                    <select value={user.role} disabled={busy === `role:${user.id}`} onChange={e => changeRole(user, e.target.value)} aria-label={`Role for ${user.name || user.email}`}>
                      <option value="student">student</option><option value="teacher">teacher</option><option value="support">support</option><option value="admin">admin</option>
                    </select>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <strong>Recent audit activity</strong>
          <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
            {recentAudit.map(entry => <div key={entry.id} className="muted"><code>{entry.action}</code> · {entry.targetKind}:{entry.targetId} · {when(entry.createdAt)}</div>)}
          </div>
        </div>
      </>}
    </section>
  );
}
