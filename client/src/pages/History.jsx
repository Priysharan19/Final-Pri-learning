// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · History
// Every answered question, forever: filter it, bookmark it, replay your
// handwriting, and re-attempt any question — same numbers or fresh ones.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { MathText } from '../lib/latex.jsx';
import { useApp } from '../App.jsx';

const FILTERS = [
  ['all', 'All'],
  ['wrong', '✖ Incorrect'],
  ['correct', '✔ Correct'],
  ['bookmarked', '★ Bookmarked'],
  ['ink', '✍️ With ink']
];

const MODE_LABEL = { practice: 'Practice', review: 'Review', exam: 'Exam', rush: 'Rush', match: 'Match', task: 'Task' };

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
  const { toast } = useApp();
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
            why: variant === 'same'
              ? 'Same question, same numbers — beat it this time.'
              : 'Same skill, fresh numbers — prove it wasn’t luck.'
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
      <div className="spread" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2>Your question history</h2>
          <p className="sub" style={{ marginTop: 3 }}>Every question you've answered stays on this iPad — retry any of them, with the same numbers or new ones.</p>
        </div>
        <span className="chip">{data ? `${data.total.toLocaleString()} question${data.total === 1 ? '' : 's'}` : '…'}</span>
      </div>

      <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
        {FILTERS.map(([k, label]) => (
          <button key={k} className={`pill-opt ${filter === k ? 'on' : ''}`} onClick={() => { setFilter(k); setPage(0); }}>{label}</button>
        ))}
      </div>

      <div className="card" style={{ padding: 10 }}>
        {!data && <div className="skeleton" style={{ height: 300 }} />}
        {data && !data.items.length && (
          <p className="muted" style={{ padding: 14 }}>
            {filter === 'all' ? 'Nothing here yet — answer some questions and they’ll appear immediately.' : 'Nothing matches this filter yet.'}
          </p>
        )}
        {data && data.items.map(item => (
          <div key={item.id} className="hist-row">
            <button className={`hist-star ${item.bookmarked ? 'on' : ''}`} title={item.bookmarked ? 'Remove bookmark' : 'Bookmark this question'}
              onClick={() => toggleBookmark(item.id)}>{item.bookmarked ? '★' : '☆'}</button>
            <button className="hist-main" onClick={() => openDetail(item.id)}>
              <div className="hist-top">
                <span className={`hist-verdict ${item.correct ? 'good' : item.correct === false ? 'bad' : ''}`}>
                  {item.correct ? '✔' : item.correct === false ? '✖' : '·'}
                </span>
                <span className="hist-name">{item.subtopicName}</span>
                <span className="tag">D{item.difficulty}</span>
                <span className="tag">{MODE_LABEL[item.mode] || item.mode}</span>
                {item.viaInk && <span className="tag" title="Answered by handwriting">✍️</span>}
                {item.hasPhoto && <span className="tag" title="Paper working photo attached">📷</span>}
                <span className="muted" style={{ marginLeft: 'auto', fontSize: 12, whiteSpace: 'nowrap' }}>
                  {new Date(item.answeredAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                </span>
              </div>
              <div className="hist-prompt"><MathText text={item.prompt} /></div>
            </button>
            <div className="hist-actions">
              {item.canRetry && (
                <>
                  <button className="btn btn-ghost btn-sm" title="Regenerate this exact question — identical numbers"
                    onClick={() => retry(item.id, 'same')}>↻ Same</button>
                  <button className="btn btn-ghost btn-sm" title="Same skill, new random numbers"
                    onClick={() => retry(item.id, 'fresh')}>✦ Fresh</button>
                </>
              )}
            </div>
            {open?.id === item.id && open.detail && (
              <div className="hist-detail">
                {item.answerGiven !== '' && <p style={{ marginBottom: 8 }}>Your answer: <b>{item.answerGiven}</b></p>}
                {open.detail.solution?.answerText !== undefined && (
                  <p style={{ marginBottom: 8 }}>Correct answer: <b><MathText text={open.detail.solution.answerText} /></b></p>
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
                {open.detail.ink?.strokes?.length > 0 && <InkReplay strokes={open.detail.ink.strokes} label={`Your handwriting${open.detail.ink.recognized ? ` — read as “${open.detail.ink.recognized}”` : ''}`} />}
                {open.detail.ink?.scribble?.length > 0 && <InkReplay strokes={open.detail.ink.scribble} label="Scribble pad" height={120} />}
                {open.detail.ink?.photo && (
                  <div style={{ marginTop: 8 }}>
                    <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Attached paper working</div>
                    <img src={open.detail.ink.photo} alt="Paper working" style={{ maxWidth: '100%', borderRadius: 10, border: '1px solid var(--hairline)' }} />
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {pages > 1 && (
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="btn btn-quiet btn-sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Newer</button>
          <span className="muted">page {page + 1} of {pages}</span>
          <button className="btn btn-quiet btn-sm" disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)}>Older →</button>
        </div>
      )}
    </div>
  );
}
