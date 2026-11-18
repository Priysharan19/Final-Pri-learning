// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · exam-style questions in practice (Extension 1 chapters)
//
// Beside a chapter's practice questions: the multi-part questions from the
// Prithagoras Extension 1 papers whose parts the guideline's mapping grid ties
// to this chapter's syllabus outcome, "Exam-style question from Paper 13,
// Question 11". Which exist and which are open to this account is the server's
// answer (paperAttempts.js /exam-style); pressing one sits just that question.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLink from '../components/PageLink.jsx';
import { BRAND } from '../brand/edition.js';
import { useApp } from '../App.jsx';
import { useT } from '../i18n/index.js';
import { ext1PapersFor } from '../pages/Ext1Papers.jsx';
import { examStyleFor, startSitting } from './paperApi.js';

export default function ExamStyleQuestions({ chapter }) {
  const { user } = useApp();
  const t = useT();
  const nav = useNavigate();
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState('');
  const [failed, setFailed] = useState(false);
  const eligible = ext1PapersFor(user);
  useEffect(() => {
    if (!eligible) return undefined;
    let live = true;
    examStyleFor(chapter).then(r => { if (live) setItems(Array.isArray(r?.questions) ? r.questions : []); }).catch(() => { if (live) setItems([]); });
    return () => { live = false; };
  }, [chapter, eligible]);
  if (!eligible || !items.length) return null;

  async function sit(item) {
    const key = `${item.paperId}:${item.question}`;
    setBusy(key); setFailed(false);
    try { const r = await startSitting(item.paperId, { question: item.question }); nav(`/papers/sit/${r.attempt.id}`); }
    catch { setFailed(true); } finally { setBusy(''); }
  }

  return (
    <section className="card" aria-labelledby="exam-style-h" data-exam-style={chapter} style={{ marginBottom: 16 }}>
      <h2 className="card-title" id="exam-style-h" style={{ textTransform: 'none', letterSpacing: 0 }}>{t('paper.examStyle.heading')}</h2>
      <p className="sub" style={{ marginBottom: 12 }}>{t('paper.examStyle.note', { brand: BRAND })}</p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12 }}>
        {items.map(item => {
          const key = `${item.paperId}:${item.question}`;
          return (
            <li key={key} data-exam-style-item={key} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
              <span>
                {t('paper.examStyle.item', { paper: item.title, n: item.question })}
                <span className="muted"> · {t('paper.examStyle.meta', { marks: item.marks })}</span>
              </span>
              {item.locked
                ? <span className="muted">{t('paper.examStyle.locked')} <PageLink to="/premium" state={{ from: 'exams' }}>{t('papers.ext1.seePremium')}</PageLink></span>
                : <button type="button" className="btn btn-ghost btn-sm" disabled={busy !== ''} onClick={() => sit(item)} data-exam-style-sit={key}>{t('paper.examStyle.sit')}</button>}
            </li>
          );
        })}
      </ul>
      {failed && <p className="muted" role="status">{t('papers.ext1.sitFailed')}</p>}
    </section>
  );
}
