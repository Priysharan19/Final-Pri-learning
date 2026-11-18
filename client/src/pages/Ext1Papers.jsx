// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Extension 1 practice papers (Prithagoras Exams page)
//
// The owner's own HSC-format Mathematics Extension 1 papers, as PDFs to print.
// The server decides everything (server/platform/papers.js): which papers
// exist, which are unlocked for this account (Premium, or the free sample) and
// whether a download is allowed. This card only shows that and asks.
// It is offered to a Year 11–12 profile on the NSW Extension 1 pathway.
// Nothing here marks anything. A printed paper is marked by the student or their
// teacher with the marking guidelines; a paper sat in the app ("Sit this paper
// in the app", client/src/paper/) is marked by the server's deterministic engine
// where it can be, and checked by the student against the sample answer where it
// cannot.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLink from '../components/PageLink.jsx';
import Working from '../instrument/Working.jsx';
import { useT } from '../i18n/index.js';
import { cloudDownload, cloudRequest } from '../platform/cloudTransport.js';
import { saveBinaryFile } from '../lib/files.js';
import { startSitting } from '../paper/paperApi.js';

const ID = /^[a-z0-9-]{3,60}$/;

/** Year 11–12 on the NSW Extension 1 pathway: the only profile these papers are for. */
export function ext1PapersFor(user) {
  return !!user && user.course === 'nsw' && user.pathway === 'ext1' && Number(user.year) >= 11;
}

const fileName = (title, kind) => `Prithagoras-Ext1-${title.replace(/[^A-Za-z0-9]+/g, '-')}${kind === 'guidelines' ? '-Marking-Guidelines' : ''}.pdf`;

export default function Ext1Papers() {
  const t = useT();
  const nav = useNavigate();
  const [list, setList] = useState(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState('');
  // The message is kept as a key (and its values), said at render: a language change re-says it.
  const [message, setMessage] = useState(null);
  useEffect(() => {
    let live = true;
    cloudRequest('/v1/papers')
      .then(r => { if (live) setList(Array.isArray(r?.papers) ? r : { papers: [] }); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, []);

  async function download(paper, kind) {
    if (!ID.test(paper.id)) return;
    const key = `${paper.id}:${kind}`;
    setBusy(key);
    setMessage(null);
    try {
      const bytes = await cloudDownload(`/v1/papers/${paper.id}/${kind}`);
      await saveBinaryFile(bytes, fileName(paper.title, kind), 'application/pdf');
      setMessage({ key: 'papers.ext1.saved', vars: { title: paper.title } });
    } catch (err) {
      if (err?.code === 'PREMIUM_REQUIRED') setList(l => (l ? { ...l, papers: l.papers.map(p => (p.id === paper.id ? { ...p, locked: true } : p)) } : l));
      setMessage({ key: err?.code === 'CLOUD_WEB_ONLY' ? 'papers.ext1.webOnly' : 'papers.ext1.failed' });
    } finally { setBusy(''); }
  }

  // Sit the paper in the app: the server issues (or resumes) the sitting, then the page opens it.
  async function sit(paper) {
    if (!ID.test(paper.id)) return;
    const key = `${paper.id}:sit`;
    setBusy(key);
    setMessage(null);
    try {
      const r = await startSitting(paper.id);
      nav(`/papers/sit/${r.attempt.id}`);
    } catch (err) {
      if (err?.code === 'PREMIUM_REQUIRED') setList(l => (l ? { ...l, papers: l.papers.map(p => (p.id === paper.id ? { ...p, locked: true } : p)) } : l));
      setMessage({ key: 'papers.ext1.sitFailed' });
    } finally { setBusy(''); }
  }

  return (
    <section className="card" style={{ gridColumn: '1 / -1' }} data-ext1-papers aria-labelledby="ext1-papers-title">
      <h2 className="card-title" id="ext1-papers-title">{t('papers.ext1.heading')}</h2>
      <p className="sub" style={{ marginBottom: 14 }} data-ext1-papers-note>{t('papers.ext1.note')}</p>
      {!list && !failed && <p className="muted" role="status"><Working pending size={24} /><span>{t('papers.ext1.loading')}</span></p>}
      {failed && <p className="muted" data-ext1-papers-unavailable>{t('papers.ext1.unavailable')}</p>}
      {list && list.papers.length > 0 && <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12 }}>
        {list.papers.map(p => (
          <li key={p.id} className="stat-tile" data-ext1-paper={p.id} data-locked={p.locked ? 'yes' : 'no'}>
            <div className="sc-label">{p.title}{p.sample ? ` · ${t('papers.ext1.sample')}` : ''}</div>
            <div className="muted">{t('papers.ext1.meta', { marks: p.marks, time: p.workingTime, pages: p.pages })}</div>
            {p.locked
              ? <p className="muted" style={{ marginTop: 8 }} data-premium-gate="ext1-papers">
                {t('papers.ext1.locked')} <PageLink to="/premium" state={{ from: 'exams' }}>{t('papers.ext1.seePremium')}</PageLink>
              </p>
              : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                {p.inApp && <button type="button" className="btn btn-primary btn-sm" disabled={busy !== ''} aria-label={t('papers.ext1.sitLabel', { title: p.title })}
                  onClick={() => sit(p)} data-ext1-sit={p.id}>
                  {busy === `${p.id}:sit` ? t('papers.ext1.sitting') : t('papers.ext1.sit')}
                </button>}
                <button type="button" className={`btn ${p.inApp ? 'btn-ghost' : 'btn-primary'} btn-sm`} disabled={busy !== ''} aria-label={t('papers.ext1.paperLabel', { title: p.title })}
                  onClick={() => download(p, 'paper')} data-ext1-download={`${p.id}:paper`}>
                  {busy === `${p.id}:paper` ? t('papers.ext1.saving') : t('papers.ext1.paper')}
                </button>
                {p.hasGuidelines
                  ? <button type="button" className="btn btn-ghost btn-sm" disabled={busy !== ''} aria-label={t('papers.ext1.guidelinesLabel', { title: p.title })}
                    onClick={() => download(p, 'guidelines')} data-ext1-download={`${p.id}:guidelines`}>
                    {busy === `${p.id}:guidelines` ? t('papers.ext1.saving') : t('papers.ext1.guidelines')}
                  </button>
                  : <span className="muted" data-ext1-no-guidelines>{t('papers.ext1.noGuidelines')}</span>}
              </div>}
          </li>
        ))}
      </ul>}
      <p className="muted" role="status" aria-live="polite" style={{ marginTop: 10 }} data-ext1-papers-status>{message ? t(message.key, message.vars) : ''}</p>
    </section>
  );
}
