// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · History
// Every answered question, forever: filter it, bookmark it, replay your
// handwriting, and re-attempt any question — same numbers or fresh ones.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { MathText } from '../lib/latex.jsx';
import { formatDate, formatNumber } from '../lib/locale.js';
import { useApp } from '../App.jsx';
import { useT } from '../i18n/index.js';
import TermGloss from '../components/TermGloss.jsx';

const FILTERS = [
  ['all', 'history.filterAll'],
  ['wrong', 'history.filterWrong'],
  ['correct', 'history.filterCorrect'],
  ['bookmarked', 'history.filterBookmarked'],
  ['ink', 'history.filterInk']
];

const MODE_KEY = {
  practice: 'history.modePractice', review: 'history.modeReview', exam: 'history.modeExam',
  rush: 'history.modeRush', match: 'history.modeMatch', task: 'history.modeTask'
};

/** Render saved strokes as a scaled SVG — a faithful replay of the ink. */
function InkReplay({ strokes, height = 160, label }) {
  if (!strokes?.length) return null;
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const st of strokes) for (const pt of st.points || []) {
    x1 = Math.min(x1, pt.x); y1 = Math.min(y1, pt.y);
    x2 = Math.max(x2, pt.x); y2 = Math.max(y2, pt.y);
  }
  if (!isFinite(x1)) return null;
  const pad = 12;
  const vb = `${x1 - pad} ${y1 - pad} ${x2 - x1 + 2 * pad} ${y2 - y1 + 2 * pad}`;
  return (
    <div className="ink-replay">
      {label && <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{label}</div>}
      <svg viewBox={vb} style={{ width: '100%', height, display: 'block' }} preserveAspectRatio="xMidYMid meet">
        {strokes.map((st, i) => (
          <polyline key={i}
            points={(st.points || []).map(pt => `${pt.x},${pt.y}`).join(' ')}
            fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </svg>
    </div>
  );
}

export default function History() {
  const { toast, user } = useApp();
  const t = useT();
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(null);       // {id, detail}
  const nav = useNavigate();

  const load = useCallback(() => {
    api.post('/history/list', { filter, page }).then(setData).catch(() => setData({ items: [], total: 0 }));
  }, [filter, page]);
  useEffect(() => { load(); }, [load]);

  async function toggleBookmark(id) {
    try {
      const r = await api.post(`/history/${id}/bookmark`, {});
      setData(d => ({ ...d, items: d.items.map(x => x.id === id ? { ...x, bookmarked: r.bookmarked } : x) }));
    } catch { }
  }

  async function retry(id, variant) {
    try {
      const r = await api.post(`/history/${id}/retry`, { variant });
      nav('/practice', {
        state: {
          serve: {
            question: r.question,
            reason: 'retry',
            why: t(variant === 'same' ? 'history.whySame' : 'history.whyFresh')
          }
        }
      });
    } catch (e) { toast(<span>⚠️ {e.message}</span>); }
  }

  async function openDetail(id) {
    if (open?.id === id) { setOpen(null); return; }
    try {
      const detail = await api.get(`/history/${id}/detail`);
      setOpen({ id, detail });
    } catch { }
  }

  const pages = data ? Math.ceil(data.total / data.pageSize) : 0;

  return (
    <div className="grid" style={{ gap: 18 }}>
      <h1 className="sr-only">{t('history.title')}</h1>
      <div className="spread" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2>{t('history.heading')}</h2>
          <p className="sub" style={{ marginTop: 3 }}>{t('history.sub')}</p>
        </div>
        <span className="chip">{data ? t('common.questionsCounted', { count: data.total, n: formatNumber(data.total, user) }) : '…'}</span>
      </div>

      <div className="row" role="group" aria-label={t('history.filterGroup')} style={{ flexWrap: 'wrap', gap: 8 }}>
        {FILTERS.map(([k, key]) => (
          <button key={k} className={`pill-opt ${filter === k ? 'on' : ''}`} aria-pressed={filter === k}
            onClick={() => { setFilter(k); setPage(0); }}>{t(key)}</button>
        ))}
      </div>

      <div className="card" style={{ padding: 10 }}>
        {!data && <div className="skeleton" style={{ height: 300 }} />}
        {data && !data.items.length && (
          <p className="muted" style={{ padding: 14 }}>
            {t(filter === 'all' ? 'history.emptyAll' : 'history.emptyFiltered')}
          </p>
        )}
        {data && data.items.map(item => (
          <div key={item.id} className="hist-row">
            <button className={`hist-star ${item.bookmarked ? 'on' : ''}`} title={t(item.bookmarked ? 'history.removeBookmark' : 'history.addBookmark')}
              aria-label={t(item.bookmarked ? 'history.removeBookmarkOn' : 'history.addBookmarkOn', { topic: item.subtopicName })}
              aria-pressed={!!item.bookmarked}
              onClick={() => toggleBookmark(item.id)}>{item.bookmarked ? '★' : '☆'}</button>
            <button className="hist-main" onClick={() => openDetail(item.id)}>
              <div className="hist-top">
                <span className={`hist-verdict ${item.correct ? 'good' : item.correct === false ? 'bad' : ''}`}>
                  {item.correct ? '✔' : item.correct === false ? '✖' : '·'}
                  <span className="sr-only">{item.correct ? t('app.correct') : item.correct === false ? t('app.incorrect') : t('history.notMarked')}</span>
                </span>
                <span className="hist-name"><TermGloss text={item.subtopicName} /></span>
                <span className="tag">D{item.difficulty}</span>
                <span className="tag">{MODE_KEY[item.mode] ? t(MODE_KEY[item.mode]) : item.mode}</span>
                {item.viaInk && <span className="tag" title={t('history.viaInk')}>✍️<span className="sr-only">{t('history.viaInkSpoken')}</span></span>}
                {item.hasPhoto && <span className="tag" title={t('history.hasPhoto')}>📷<span className="sr-only">{t('history.hasPhotoSpoken')}</span></span>}
                <span className="muted" style={{ marginLeft: 'auto', fontSize: 12, whiteSpace: 'nowrap' }}>
                  {formatDate(item.answeredAt, user)}
                </span>
              </div>
              <div className="hist-prompt"><MathText text={item.prompt} /></div>
            </button>
            <div className="hist-actions">
              {item.canRetry && (
                <>
                  <button className="btn btn-ghost btn-sm" title={t('history.retrySameTitle')}
                    onClick={() => retry(item.id, 'same')}>{t('history.retrySame')}</button>
                  <button className="btn btn-ghost btn-sm" title={t('history.retryFreshTitle')}
                    onClick={() => retry(item.id, 'fresh')}>{t('history.retryFresh')}</button>
                </>
              )}
            </div>
            {open?.id === item.id && open.detail && (
              <div className="hist-detail">
                {item.answerGiven !== '' && <p style={{ marginBottom: 8 }}>{t('history.yourAnswerWas')} <b>{item.answerGiven}</b></p>}
                {open.detail.solution?.answerText !== undefined && (
                  <p style={{ marginBottom: 8 }}>{t('history.correctAnswerWas')} <b><MathText text={open.detail.solution.answerText} /></b></p>
                )}
                {open.detail.question?.figure && <div className="q-figure" dangerouslySetInnerHTML={{ __html: open.detail.question.figure }} />}
                {open.detail.solution?.steps && (
                  <div className="steps" style={{ marginTop: 4 }}>
                    {open.detail.solution.steps.map((st, i) => (
                      <div className="step" key={i}>
                        <span className="step-n">{i + 1}</span>
                        <div>
                          <div className="step-h"><MathText text={st.h} /></div>
                          <div className="step-d"><MathText text={st.d} /></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {open.detail.ink?.strokes?.length > 0 && <InkReplay strokes={open.detail.ink.strokes}
                  label={open.detail.ink.recognized ? t('history.readAs', { text: open.detail.ink.recognized }) : t('history.yourHandwriting')} />}
                {open.detail.ink?.scribble?.length > 0 && <InkReplay strokes={open.detail.ink.scribble} label={t('history.scribblePad')} height={120} />}
                {open.detail.ink?.photo && (
                  <div style={{ marginTop: 8 }}>
                    <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{t('history.attachedWorking')}</div>
                    <img src={open.detail.ink.photo} alt={t('history.paperWorking')} style={{ maxWidth: '100%', borderRadius: 10, border: '1px solid var(--hairline)' }} />
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {pages > 1 && (
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="btn btn-quiet btn-sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>{t('history.newer')}</button>
          <span className="muted">{t('history.pageOf', { page: page + 1, total: pages })}</span>
          <button className="btn btn-quiet btn-sm" disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)}>{t('history.older')}</button>
        </div>
      )}
    </div>
  );
}
