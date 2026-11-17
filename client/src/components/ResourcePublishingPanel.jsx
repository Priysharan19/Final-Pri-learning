// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the staff Library section (ADR-0002 plan F3)
//
// Inside the MFA-gated staff console (StaffOperationsPanel). Drafts, reviews and
// publishes library resources; shows the revision history; uploads a hosted PDF
// in parts (assetUpload.js). It is drawn only where the server has
// PRI_RESOURCE_PUBLISHING=on: with it off the list call answers 404 and this
// renders nothing. Nothing is asked for beyond the staff second factor.
//
// The server decides everything that matters (the two-person rule, the rights
// rules, the file checks, who may publish); this section shows the answers.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useState } from 'react';
import { cloud } from '../platform/cloudTransport.js';
import { useT } from '../i18n/index.js';
import { useMfaStepUp } from './StaffMfaGate.jsx';
import { fileProblems, uploadAsset } from '../library/assetUpload.js';

const EMPTY = {
  id: '', title: '', description: '', type: 'paper', subject: '', year: String(new Date().getFullYear()), course: 'nsw', edition: 'prithagoras',
  availability: 'external', url: '', source: '', attribution: '', rightsNote: '', rightsBasis: 'external-link-only', disclaimer: '', permissionReference: ''
};
const STATE_KEYS = {
  draft: 'staffLib.state.draft', in_review: 'staffLib.state.inReview', approved: 'staffLib.state.approved',
  published: 'staffLib.state.published', withdrawn: 'staffLib.state.withdrawn', superseded: 'staffLib.state.superseded'
};

// The i18n keys, written out so client/test/i18n-check.mjs can see each one.
const DID = {
  submit: 'staffLib.did.submit', approve: 'staffLib.did.approve', reject: 'staffLib.did.reject', publish: 'staffLib.did.publish', revise: 'staffLib.did.revise'
};
const BASIS = {
  'own-work': 'staffLib.basis.ownWork', licensed: 'staffLib.basis.licensed', 'public-domain': 'staffLib.basis.publicDomain', 'external-link-only': 'staffLib.basis.linkOnly'
};

const toBody = (f, assetSha256) => ({
  title: f.title.trim(), description: f.description.trim(), type: f.type, subject: f.subject.trim(), year: Number(f.year), tags: [],
  editions: [f.edition], course: f.course, certificationState: 'uploaded', availability: f.availability,
  ...(f.availability === 'external' ? { url: f.url.trim() } : {}), source: f.source.trim(), attribution: f.attribution.trim(),
  rightsNote: f.rightsNote.trim(), disclaimer: f.disclaimer.trim(), rightsBasis: f.rightsBasis,
  ...(f.permissionReference.trim() ? { permissionReference: f.permissionReference.trim() } : {}),
  ...(assetSha256 ? { assetSha256 } : {})
});

export default function ResourcePublishingPanel({ admin = false }) {
  const t = useT();
  const withMfa = useMfaStepUp();
  const [list, setList] = useState(null); // null: unknown; false: not available; { revisions, edition, storage }
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [problems, setProblems] = useState([]);
  const [progress, setProgress] = useState(null);

  const load = useCallback(async () => {
    try { setList(await cloud.resourceAdminList()); } catch (err) { setList(err?.status === 404 ? false : null); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const run = async (key, fn, doneKey) => {
    setBusy(key); setNotice(''); setProblems([]);
    try { await fn(); if (doneKey) setNotice(doneKey); await load(); }
    catch (err) {
      setNotice(err?.code === 'INDEPENDENT_REVIEW_REQUIRED' ? 'staffLib.needsOther' : 'staffLib.failed');
      setProblems(Array.isArray(err?.problems) ? err.problems : (err?.details?.problems || []));
    } finally { setBusy(''); }
  };

  if (!list) return null;
  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }));
  const hosted = form.availability === 'hosted';
  const latest = new Map();
  for (const r of list.revisions) if (!latest.has(r.resourceId) || latest.get(r.resourceId).revision < r.revision) latest.set(r.resourceId, r);

  const create = e => {
    e.preventDefault();
    return run('create', () => withMfa(() => cloud.resourceAdminDraft(form.id.trim(), toBody(form))).then(() => setForm(EMPTY)), 'staffLib.created');
  };
  const upload = (r, file) => run(`file:${r.resourceId}`, async () => {
    if (fileProblems(file).length) throw Object.assign(new Error('file'), { code: 'UPLOAD_LOCAL' });
    const done = await withMfa(() => uploadAsset(cloud, r.resourceId, r.revision, file, (n, total) => setProgress({ id: r.resourceId, n, total })));
    const current = await cloud.resourceAdminRead(r.resourceId, r.revision);
    await withMfa(() => cloud.resourceAdminEdit(r.resourceId, r.revision, { ...current.revision.body, availability: 'hosted', url: undefined, assetSha256: done.asset.sha256 }));
    setProgress(null);
  }, 'staffLib.uploaded');
  const step = (r, name, body) => run(`${name}:${r.resourceId}`, () => withMfa(() => cloud.resourceAdminStep(r.resourceId, r.revision, name, body)), DID[name]);

  return (
    <section className="card" aria-labelledby="staff-lib-title" style={{ marginTop: 18 }} data-staff-library>
      <h2 className="card-title" id="staff-lib-title" style={{ marginBottom: 4 }}>{t('staffLib.title')}</h2>
      <p className="sub" style={{ margin: 0, maxWidth: 780 }}>{t('staffLib.lead', { edition: list.edition })}</p>
      {!list.storage && <p className="muted">{t('staffLib.noStorage')}</p>}
      <div role="status" aria-live="polite">{notice && <p className="notice">{t(notice)}</p>}</div>
      {problems.length > 0 && <ul className="notice error" role="alert">{problems.map(p => <li key={p}>{p}</li>)}</ul>}

      <form onSubmit={create} className="card" style={{ padding: 14, marginTop: 14 }}>
        <strong>{t('staffLib.new')}</strong>
        <div className="grid-2" style={{ gap: 10, marginTop: 10 }}>
          <label className="field"><span>{t('staffLib.f.id')}</span><input required pattern="[a-z0-9][a-z0-9\-]{2,119}" value={form.id} onChange={set('id')} /></label>
          <label className="field"><span>{t('staffLib.f.title')}</span><input required maxLength={300} value={form.title} onChange={set('title')} /></label>
          <label className="field"><span>{t('staffLib.f.subject')}</span><input required maxLength={120} value={form.subject} onChange={set('subject')} /></label>
          <label className="field"><span>{t('staffLib.f.year')}</span><input required inputMode="numeric" pattern="[0-9]{4}" value={form.year} onChange={set('year')} /></label>
          <label className="field"><span>{t('staffLib.f.type')}</span>
            <select value={form.type} onChange={set('type')}><option value="paper">{t('library.type.paper')}</option><option value="solutions">{t('library.type.solutions')}</option><option value="notes">{t('library.type.notes')}</option></select></label>
          <label className="field"><span>{t('staffLib.f.course')}</span>
            <select value={form.course} onChange={set('course')}><option value="nsw">{t('library.course.nsw')}</option><option value="in">{t('library.course.in')}</option></select></label>
          <label className="field"><span>{t('staffLib.f.availability')}</span>
            <select value={form.availability} onChange={e => setForm(f => ({ ...f, availability: e.target.value, rightsBasis: e.target.value === 'hosted' ? 'own-work' : 'external-link-only' }))}>
              <option value="external">{t('staffLib.f.external')}</option>{list.storage && <option value="hosted">{t('staffLib.f.hosted')}</option>}</select></label>
          <label className="field"><span>{t('staffLib.f.basis')}</span>
            <select value={form.rightsBasis} onChange={set('rightsBasis')}>
              {Object.keys(BASIS).map(b => <option key={b} value={b}>{t(BASIS[b])}</option>)}</select></label>
        </div>
        {!hosted && <label className="field"><span>{t('staffLib.f.url')}</span><input type="url" required pattern="https://.*" value={form.url} onChange={set('url')} /></label>}
        <label className="field"><span>{t('staffLib.f.description')}</span><textarea required rows={3} maxLength={4000} value={form.description} onChange={set('description')} /></label>
        <div className="grid-2" style={{ gap: 10 }}>
          <label className="field"><span>{t('staffLib.f.source')}</span><input required maxLength={200} value={form.source} onChange={set('source')} /></label>
          <label className="field"><span>{t('staffLib.f.attribution')}</span><input required maxLength={600} value={form.attribution} onChange={set('attribution')} /></label>
          <label className="field"><span>{t('staffLib.f.rights')}</span><input required maxLength={1200} value={form.rightsNote} onChange={set('rightsNote')} /></label>
          <label className="field"><span>{t('staffLib.f.disclaimer')}</span><input required maxLength={2000} value={form.disclaimer} onChange={set('disclaimer')} /></label>
          {hosted && <label className="field"><span>{t('staffLib.f.permission')}</span><input maxLength={300} value={form.permissionReference} onChange={set('permissionReference')} /></label>}
        </div>
        <button className="btn btn-primary btn-sm" disabled={busy === 'create'}>{t('staffLib.create')}</button>
      </form>

      <h3 style={{ marginTop: 18 }}>{t('staffLib.revisions')}</h3>
      {!list.revisions.length && <p className="muted">{t('staffLib.none')}</p>}
      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
        {[...latest.values()].map(r => (
          <li className="card" key={r.resourceId} style={{ padding: 12 }} data-staff-resource={r.resourceId}>
            <div className="spread" style={{ gap: 12 }}>
              <div><strong>{r.title || r.resourceId}</strong><div className="muted">{r.resourceId} · {t('staffLib.revision', { n: r.revision })}</div></div>
              <span className="tag">{t(STATE_KEYS[r.state])}</span>
            </div>
            <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {r.state === 'draft' && <>
                <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => step(r, 'submit')}>{t('staffLib.submit')}</button>
                {list.storage && <label className="btn btn-ghost btn-sm">{t('staffLib.attach')}
                  <input type="file" accept="application/pdf" style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }} onChange={e => e.target.files?.[0] && upload(r, e.target.files[0])} /></label>}
              </>}
              {r.state === 'in_review' && <>
                <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => step(r, 'approve')}>{t('staffLib.approve')}</button>
                <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => step(r, 'reject', { reason: t('staffLib.sentBack') })}>{t('staffLib.reject')}</button>
              </>}
              {admin && r.state === 'approved' && <button type="button" className="btn btn-primary btn-sm" disabled={!!busy} onClick={() => step(r, 'publish')}>{t('staffLib.publish')}</button>}
              {admin && r.state === 'published' && <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy}
                onClick={() => run(`withdraw:${r.resourceId}`, () => withMfa(() => cloud.resourceAdminWithdraw(r.resourceId, t('staffLib.withdrawReason'))), 'staffLib.did.withdraw')}>{t('staffLib.withdraw')}</button>}
              {['published', 'superseded', 'withdrawn'].includes(r.state) && <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => step(r, 'revise')}>{t('staffLib.revise')}</button>}
            </div>
            {progress?.id === r.resourceId && <p className="muted" role="status">{t('staffLib.progress', { n: progress.n, total: progress.total })}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
