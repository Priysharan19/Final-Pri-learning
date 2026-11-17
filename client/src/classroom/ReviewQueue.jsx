// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the teacher-mark review queue (teacher workspace, R4 surface)
//
// The marks the engine cannot award on a wrong written answer — method and
// follow-through, while examiner sign-off (#499) is pending — are the
// TEACHER'S judgement. This page shows the evidence and records a decision;
// it never suggests a mark and never shows a model's words:
//   · the student's work: for a handwritten answer the ORIGINAL page is the
//     work being judged (ReviewOriginal), with the engine's line verdicts beside
//     it and the typeset reading as the secondary "What Pri read"; for a typed
//     answer the line list is the work;
//   · each line's verdict as SHAPE + WORD (Checked / First break / Not
//     verified), the first break and its misconception's registry name;
//   · the criterion in plain words, marks possible, the engine's mark and the
//     cap; Award (1..cap) or Decline, an optional comment, then Save;
//   · the decision history (append-only on the server), with the ink version
//     each decision was made on.
// Every teacher number is labelled "Teacher mark" and drawn apart from the
// engine's mark.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useRef, useState } from 'react';
import { cloud } from '../platform/cloudTransport.js';
import { tLater, useT } from '../i18n/index.js';
import { MathText } from '../lib/latex.jsx';
import { CRITERION_HELP, CRITERION_WORD, LINE_WORD, inkShort, misconceptionName } from './classroomWords.js';

// SWAP POINT (original-ink lane, PR #1019): when client/src/components/OriginalWork.jsx
// exists, replace the next line with
//   import { MarkedOriginal } from '../components/OriginalWork.jsx';
const MarkedOriginal = null;

/** Each line verdict's shape, so the verdict never rests on colour. */
export function LineGlyph({ status, size = 16 }) {
  const s = size, c = s / 2, r = s / 2 - 1.5;
  if (status === 'ok') {
    return (
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden="true" data-line-glyph="ok">
        <circle cx={c} cy={c} r={r} className="rq-g-line" />
        <path d={`M${s * 0.3} ${s * 0.52} L${s * 0.45} ${s * 0.67} L${s * 0.72} ${s * 0.36}`} className="rq-g-line" />
      </svg>
    );
  }
  if (status === 'break') {
    return (
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden="true" data-line-glyph="break">
        <path d={`M${c} 1.5 L${s - 1.5} ${s - 1.5} L1.5 ${s - 1.5} Z`} className="rq-g-break" />
        <path d={`M${c} ${s * 0.4} V${s * 0.66}`} className="rq-g-break" />
        <circle cx={c} cy={s * 0.8} r={0.9} className="rq-g-dot" />
      </svg>
    );
  }
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden="true" data-line-glyph="unsure">
      <circle cx={c} cy={c} r={r} className="rq-g-line" strokeDasharray="2.2 2" />
      <path d={`M${s * 0.38} ${s * 0.38} Q${c} ${s * 0.18} ${s * 0.62} ${s * 0.38} Q${s * 0.64} ${s * 0.52} ${c} ${s * 0.58} V${s * 0.64}`} className="rq-g-line" />
      <circle cx={c} cy={s * 0.78} r={0.9} className="rq-g-ink" />
    </svg>
  );
}

const statusOf = (ev, i) => (Array.isArray(ev?.lineStatuses) ? ev.lineStatuses[i] : null) || 'unsure';

/** The engine's verdict for each line of working, one row per line. */
function LineList({ evidence, primary }) {
  const t = useT();
  const lines = Array.isArray(evidence?.reading) ? evidence.reading : [];
  return (
    <ol className="rq-lines" data-review-lines>
      {lines.map((text, i) => {
        const status = statusOf(evidence, i);
        return (
          <li key={i} className={`rq-line rq-line-${status}`} data-line-status={status}>
            <span className="rq-n">{i + 1}</span>
            <span className="rq-verdict"><LineGlyph status={status} /> {t(LINE_WORD[status] || LINE_WORD.unsure)}</span>
            <span className={primary ? 'rq-reading' : 'rq-reading rq-secondary'} lang="en">
              {!primary && <span className="tw-label">{t('tw.review.whatPriRead')} </span>}
              <MathText text={String(text)} />
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The student's original work for a handwritten answer: the stored page with
 * the line verdicts drawn on it (MarkedOriginal, original-ink lane), or — until
 * stored pages are available here — a labelled place for it.
 */
export function ReviewOriginal({ item, classId }) {
  const t = useT();
  const ev = item.evidence || {};
  const original = ev.original && typeof ev.original === 'object' ? ev.original : null;
  const digest = original?.sha256 || ev.ink?.digest || null;
  const marks = (Array.isArray(ev.lineStatuses) ? ev.lineStatuses : []).map((status, i) => ({ line: i + 1, status, n: i + 1 }));
  return (
    <div className="rq-original" data-review-original={inkShort(digest) || 'none'}>
      {MarkedOriginal && original
        ? <MarkedOriginal originalId={original.id} classId={classId} studentId={item.student.id} sha256={original.sha256} marks={marks} />
        : <div className="rq-original-slot" role="note">{t('tw.review.originalPending', { page: inkShort(digest) || '—' })}</div>}
    </div>
  );
}

function historyLine(t, h) {
  const when = new Date(h.decidedAt).toLocaleString();
  return h.decision === 'award'
    ? t('tw.review.historyAward', { count: h.marks, n: h.marks, when })
    : t('tw.review.historyDecline', { when });
}

function Detail({ classId, item, onSaved, onClose }) {
  const t = useT();
  const ev = item.evidence || {};
  const handwritten = ev.inputMode === 'ink' || !!ev.original || !!ev.ink;
  const digest = ev.original?.sha256 || ev.ink?.digest || null;
  const current = item.teacherMark || null;
  const [decision, setDecision] = useState(current?.decision || '');
  const [marks, setMarks] = useState(current?.decision === 'award' ? current.marks : 1);
  const [comment, setComment] = useState(current?.comment || '');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState({ kind: '', text: '' });
  const [history, setHistory] = useState(null);
  const head = useRef(null);
  const cap = Math.max(1, Number(item.available) || 1);

  async function loadHistory() {
    try { setHistory((await cloud.classReviewHistory(classId, item.id))?.history || []); }
    catch { setHistory([]); }
  }
  useEffect(() => { head.current?.focus(); loadHistory(); }, [item.id]);

  async function save(e) {
    e.preventDefault();
    if (!decision) { setStatus({ kind: 'error', text: tLater('tw.review.chooseDecision') }); return; }
    const n = Math.round(Number(marks));
    if (decision === 'award' && !(n >= 1 && n <= cap)) { setStatus({ kind: 'error', text: tLater('tw.review.err.range', { cap }) }); return; }
    setBusy(true); setStatus({ kind: '', text: '' });
    try {
      const body = decision === 'award' ? { decision, marks: n } : { decision };
      if (comment.trim()) body.comment = comment.trim();
      const r = await cloud.classReviewDecide(classId, item.id, body);
      setStatus({ kind: 'success', text: tLater('tw.review.saved') });
      await loadHistory();
      onSaved?.(item.id, r?.mark || null);
    } catch (err) {
      const text = err?.code === 'TEACHER_MARK_OVER_CAP' ? tLater('tw.review.err.overCap', { cap }) : (err?.message || tLater('tw.review.err.saveFailed'));
      setStatus({ kind: 'error', text });
    } finally { setBusy(false); }
  }

  const q = item.question || {};
  const misconception = ev.misconception ? misconceptionName(t, ev.misconception) : null;
  return (
    <section className="tw-panel rq-detail" aria-labelledby="rq-detail-title" data-review-detail={item.id}>
      <div className="tw-row tw-spread">
        <div>
          <h4 className="tw-h" id="rq-detail-title" tabIndex={-1} ref={head}>{t('tw.review.itemTitle', { name: item.student?.name || '', q: q.order })}</h4>
          <div className="muted">{item.assignmentTitle}{q.outcomeCode ? ` · ${q.outcomeCode}` : ''}</div>
        </div>
        <button type="button" className="btn btn-quiet btn-sm" onClick={onClose}>{t('nav.close')}</button>
      </div>
      <p className="tw-note" data-review-authority>{t('tw.review.authority')}</p>

      {ev.prompt && <div className="rq-prompt" lang="en"><span className="tw-label">{t('tw.review.question')}</span> <MathText text={String(ev.prompt)} /></div>}

      {handwritten ? (
        <div className="rq-work rq-work-ink">
          <ReviewOriginal item={item} classId={classId} />
          <div>
            <h5 className="tw-h5">{t('tw.review.lineChecks')}</h5>
            <LineList evidence={ev} primary={false} />
          </div>
        </div>
      ) : (
        <div className="rq-work">
          <h5 className="tw-h5">{t('tw.review.typedWork')}</h5>
          <LineList evidence={ev} primary />
        </div>
      )}

      <dl className="rq-facts">
        <div><dt>{t('tw.line.break')}</dt><dd>{ev.firstBreak ? t('tw.review.breakOn', { n: ev.firstBreak }) : t('tw.review.noBreak')}{misconception ? ` · ${misconception}` : ''}</dd></div>
        <div><dt>{t('tw.review.criterion')}</dt><dd><b>{t(CRITERION_WORD[item.criterion] || CRITERION_WORD.method)}</b><span className="rq-help">{t(CRITERION_HELP[item.criterion] || CRITERION_HELP.method)}</span></dd></div>
        <div><dt>{t('tw.review.marksPossible')}</dt><dd>{item.marksPossible}</dd></div>
        <div><dt>{t('tw.results.engineMark')}</dt><dd data-engine-mark>{item.engineAwarded}</dd></div>
        <div><dt>{t('tw.review.cap')}</dt><dd>{t('tw.review.capValue', { count: cap, n: cap })}</dd></div>
        {handwritten && <div><dt>{t('tw.review.inkVersion')}</dt><dd className="tw-code" data-ink-version>{inkShort(digest) || t('tw.review.inkUnknown')}</dd></div>}
      </dl>

      <form className="rq-form" onSubmit={save} aria-labelledby="rq-form-title" data-review-form>
        <h5 className="tw-h5" id="rq-form-title"><span className="tw-teacher-tag">{t('tw.teacherMark')}</span> {t('tw.review.yourDecision')}</h5>
        {handjudged(t, handwritten, digest)}
        <fieldset className="tw-fieldset">
          <legend className="sr-only">{t('tw.review.yourDecision')}</legend>
          <label className="tw-radio"><input type="radio" name={`rq-${item.id}`} value="award" checked={decision === 'award'} onChange={() => setDecision('award')} data-review-decision="award" /> {t('tw.review.award')}</label>
          <label className="tw-radio"><input type="radio" name={`rq-${item.id}`} value="decline" checked={decision === 'decline'} onChange={() => setDecision('decline')} data-review-decision="decline" /> {t('tw.review.decline')}</label>
        </fieldset>
        {decision === 'award' && (
          <div className="rq-stepper">
            <label className="label" htmlFor={`rq-marks-${item.id}`}>{t('tw.review.marksToAward', { cap })}</label>
            <div className="tw-row">
              <button type="button" className="btn btn-ghost btn-sm" aria-label={t('tw.review.fewer')} disabled={marks <= 1} onClick={() => setMarks(m => Math.max(1, Number(m) - 1))}>−</button>
              <input className="input rq-marks" id={`rq-marks-${item.id}`} type="number" inputMode="numeric" min={1} max={cap} step={1} value={marks}
                onChange={e => setMarks(e.target.value === '' ? '' : Math.max(1, Math.min(cap, Math.round(Number(e.target.value)) || 1)))} />
              <button type="button" className="btn btn-ghost btn-sm" aria-label={t('tw.review.more')} disabled={marks >= cap} onClick={() => setMarks(m => Math.min(cap, Number(m) + 1))}>+</button>
            </div>
          </div>
        )}
        <div className="field">
          <label className="label" htmlFor={`rq-comment-${item.id}`}>{t('tw.review.comment')}</label>
          <textarea className="input" id={`rq-comment-${item.id}`} rows={2} maxLength={1000} value={comment} onChange={e => setComment(e.target.value)} />
        </div>
        <button className="btn btn-primary btn-sm" disabled={busy} data-review-save>{busy ? t('common.loading') : t('tw.review.save')}</button>
        <div aria-live="polite" role="status" data-review-status className={status.text ? `notice ${status.kind}` : ''} style={status.text ? { marginTop: 10 } : undefined}>{status.text}</div>
      </form>

      <section aria-labelledby="rq-history-title">
        <h5 className="tw-h5" id="rq-history-title">{t('tw.review.history')}</h5>
        {history === null ? <p className="muted">{t('common.loading')}</p> : !history.length ? <p className="muted">{t('tw.review.noHistory')}</p> : (
          <ol className="tw-plain" data-review-history>
            {history.map(h => (
              <li key={h.id}>
                <span className="tw-teacher-tag">{t('tw.teacherMark')}</span> {historyLine(t, h)} · {t('tw.review.byYou')}
                {h.inkDigest ? <span className="muted"> · {t('tw.review.onPage', { page: inkShort(h.inkDigest) })}</span> : null}
                {h.supersedes ? <span className="muted"> · {t('tw.review.replaces')}</span> : null}
                {h.comment ? <div className="muted">{h.comment}</div> : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </section>
  );
}

function handjudged(t, handwritten, digest) {
  if (!handwritten) return null;
  return <p className="tw-note" data-deciding-on>{t('tw.review.decidingOn', { page: inkShort(digest) || '—' })}</p>;
}

export default function ReviewQueue({ classId }) {
  const t = useT();
  const [filter, setFilter] = useState('open');
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(null);
  const [error, setError] = useState('');

  async function load(state = filter) {
    try {
      const r = await cloud.classReviewQueue(classId, state);
      setData(r || { items: [], counts: { open: 0, decided: 0 } });
      setError('');
    } catch (err) {
      setData({ items: [], counts: { open: 0, decided: 0 } });
      setError(err?.code === 'CLOUD_WEB_ONLY' ? tLater('tw.webOnly') : (err?.message || tLater('tw.review.loadFailed')));
    }
  }
  useEffect(() => { setOpen(null); setData(null); load(filter); }, [classId, filter]);

  const items = data?.items || [];
  return (
    <div className="rq" data-review-queue>
      <div className="tw-row tw-spread">
        <p className="tw-note">{t('tw.review.intro')}</p>
        <div className="seg" role="group" aria-label={t('tw.review.filterLabel')}>
          <button type="button" aria-pressed={filter === 'open'} onClick={() => setFilter('open')}>{t('tw.review.open', { n: data?.counts?.open ?? '…' })}</button>
          <button type="button" aria-pressed={filter === 'decided'} onClick={() => setFilter('decided')}>{t('tw.review.decided', { n: data?.counts?.decided ?? '…' })}</button>
        </div>
      </div>
      {error && <div className="notice error" role="alert">{error}</div>}
      {data === null ? <p className="muted">{t('common.loading')}</p> : !items.length ? <p className="muted">{filter === 'open' ? t('tw.review.emptyOpen') : t('tw.review.emptyDecided')}</p> : (
        <ul className="tw-list">
          {items.map(it => (
            <li key={it.id} className="tw-list-row" data-review-item={it.id}>
              <div>
                <strong>{t('tw.review.itemTitle', { name: it.student?.name || '', q: it.question?.order })}</strong>
                <div className="muted">
                  {it.assignmentTitle} · {t(CRITERION_WORD[it.criterion] || CRITERION_WORD.method)} · {t('tw.review.listMarks', { engine: it.engineAwarded, marks: it.marksPossible, cap: it.available })}
                  {it.teacherMark ? ` · ${t('tw.teacherMark')}: ${it.teacherMark.decision === 'award' ? t('tw.student.awarded', { count: it.teacherMark.marks, n: it.teacherMark.marks }) : t('tw.student.declined')}` : ''}
                </div>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" aria-expanded={open?.id === it.id} onClick={() => setOpen(open?.id === it.id ? null : it)} data-review-open={it.id}>{t('tw.review.openItem')}</button>
            </li>
          ))}
        </ul>
      )}
      {open && <Detail key={open.id} classId={classId} item={open} onClose={() => setOpen(null)}
        onSaved={(id, mark) => setData(d => d ? { ...d, items: d.items.map(i => (i.id === id ? { ...i, teacherMark: mark } : i)) } : d)} />}
    </div>
  );
}
