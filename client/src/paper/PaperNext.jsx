// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · after a paper sitting: what to practise next, and the unseen re-test
//
// The paid half of the workflow (owner decision, 19 Nov 2026). Both calls are the
// server's (paperAttempts.js, Premium): a plan computed from this sitting's
// engine-marked parts, and a re-test of the same topics from papers never sat.
// Before and after are the engine's marks only, per topic, in plain words; no
// predicted mark, no band, no claim that anything was learned.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLink from '../components/PageLink.jsx';
import { useT } from '../i18n/index.js';
import { loadComparison, loadPlan, startRetest } from './paperApi.js';

const RETEST = 'ext1-retest';

export default function PaperNext({ attemptId, paperId }) {
  const t = useT();
  const nav = useNavigate();
  const retest = paperId === RETEST;
  const [state, setState] = useState({ status: 'loading' });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    (retest ? loadComparison(attemptId) : loadPlan(attemptId))
      .then(data => { if (live) setState({ status: 'ready', data }); })
      .catch(err => { if (live) setState({ status: err?.code === 'PREMIUM_REQUIRED' ? 'premium' : 'failed' }); });
    return () => { live = false; };
  }, [attemptId, retest]);

  async function makeRetest() {
    setBusy(true);
    try { const r = await startRetest(attemptId); nav(`/papers/sit/${r.attempt.id}`); }
    catch (err) { setState(s => ({ ...s, retestFailed: err?.code === 'PAPER_RETEST_EMPTY' ? 'empty' : 'failed' })); }
    finally { setBusy(false); }
  }

  if (state.status === 'loading') return <p className="muted" role="status">{t('paper.next.loading')}</p>;
  if (state.status === 'premium') return <p className="muted" data-paper-next="premium">{t('paper.next.premium')} <PageLink to="/premium" state={{ from: 'exams' }}>{t('papers.ext1.seePremium')}</PageLink></p>;
  if (state.status === 'failed') return <p className="muted" role="status">{t('paper.next.failed')}</p>;
  const d = state.data;
  if (retest) {
    return (
      <section className="pp-next" data-paper-next="comparison" aria-labelledby="pp-next-h">
        <h3 id="pp-next-h" className="pp-h3">{t('paper.next.compareTitle')}</h3>
        <ul>{d.outcomes.map(o => <li key={o.outcome} data-paper-compare={o.outcome}>{o.outcome}: {t('paper.next.compareLine', { b: o.before.awarded, ba: o.before.available, a: o.after.awarded, aa: o.after.available })}</li>)}</ul>
        {d.fallbacks.length > 0 && <p className="muted">{t('paper.next.fallbackNote', { n: d.fallbacks.length })}</p>}
        <p className="muted">{t('paper.next.compareNote')}</p>
      </section>
    );
  }
  return (
    <section className="pp-next" data-paper-next="plan" aria-labelledby="pp-next-h">
      <h3 id="pp-next-h" className="pp-h3">{t('paper.next.title')}</h3>
      {d.items.length === 0 ? <p className="muted">{t('paper.next.none')}</p> : (
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
          {d.items.map(i => (
            <li key={i.outcome} data-paper-plan-item={i.outcome}>
              <strong>{i.content || i.outcome}</strong>
              <span className="muted"> · {i.outcome} · {t('paper.next.lost', { lost: i.lost, available: i.available })}</span>
              {i.subtopics.length > 0
                ? <> <button type="button" className="btn btn-ghost btn-sm" onClick={() => nav(`/practice?subtopic=${encodeURIComponent(i.subtopics[0])}`)} data-paper-practise={i.subtopics[0]}>{t('paper.next.practise', { n: i.questions })}</button></>
                : <span className="muted"> {t('paper.next.noChapter')}</span>}
            </li>
          ))}
        </ul>
      )}
      <p className="muted">{t('paper.next.selfNote', { n: d.selfChecked })}</p>
      {d.items.length > 0 && <p><button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={makeRetest} data-paper-retest>{t('paper.next.retest')}</button>
        <span className="muted"> {t('paper.next.retestNote', { parts: d.retest.parts, marks: d.retest.marks })}</span></p>}
      {state.retestFailed && <p className="muted" role="status">{t(state.retestFailed === 'empty' ? 'paper.next.retestEmpty' : 'paper.next.failed')}</p>}
    </section>
  );
}
