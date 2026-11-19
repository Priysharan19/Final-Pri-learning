// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the generated "Exam-style practice sets" (Prithagoras Exams page)
//
// Multi-part practice questions made by tools/build-multipart-papers.mjs, one answer
// box per part, each part marked on its final answer by the server's deterministic
// engine. Generated practice: not the owner's papers and not HSC or NESA papers.
// Free to every NSW Year 11-12 student on an Advanced or Extension pathway; the server
// decides what a sitting may do (paperAttempts.js), never this card.
// ─────────────────────────────────────────────────────────────────────────────
import { BRAND } from '../brand/edition.js';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useT } from '../i18n/index.js';
import { cloudRequest } from '../platform/cloudTransport.js';
import { startSitting } from './paperApi.js';

const ID = /^[a-z0-9-]{3,60}$/;

export default function PracticeSets() {
  const t = useT();
  const nav = useNavigate();
  const [list, setList] = useState(null);
  const [failed, setFailed] = useState(false);
  const [sitFailed, setSitFailed] = useState(false);
  const [busy, setBusy] = useState('');
  useEffect(() => {
    let live = true;
    cloudRequest('/v1/papers')
      .then(r => { if (live) setList(Array.isArray(r?.practiceSets) ? r.practiceSets : []); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, []);
  if (list && !list.length) return null;

  async function sit(set) {
    if (!ID.test(set.id)) return;
    setBusy(set.id); setSitFailed(false);
    try { const r = await startSitting(set.id); nav(`/papers/sit/${r.attempt.id}`); }
    catch { setSitFailed(true); } finally { setBusy(''); }
  }

  return (
    <section className="card" style={{ gridColumn: '1 / -1' }} data-practice-sets aria-labelledby="practice-sets-title">
      <h2 className="card-title" id="practice-sets-title">{t('papers.sets.heading')}</h2>
      <p className="sub" style={{ marginBottom: 14 }}>{t('papers.sets.note', { brand: BRAND })}</p>
      {!list && !failed && <p className="muted" role="status">{t('papers.sets.loading')}</p>}
      {failed && <p className="muted" role="status" data-practice-sets-unavailable>{t('papers.ext1.unavailable')}</p>}
      {sitFailed && <p className="muted" role="status">{t('papers.ext1.sitFailed')}</p>}
      {list && list.length > 0 && <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12 }}>
        {list.map(s => (
          <li key={s.id} className="stat-tile" data-practice-set={s.id}>
            <div className="sc-label">{s.title}</div>
            <div className="muted">{t('papers.sets.meta', { questions: s.questions, marks: s.marks, time: s.workingTime })}</div>
            <div style={{ marginTop: 10 }}>
              <button type="button" className="btn btn-primary btn-sm" disabled={busy !== ''} aria-label={t('papers.ext1.sitLabel', { title: s.title })}
                onClick={() => sit(s)} data-practice-set-sit={s.id}>{busy === s.id ? t('papers.ext1.sitting') : t('papers.sets.sit')}</button>
            </div>
          </li>
        ))}
      </ul>}
    </section>
  );
}
