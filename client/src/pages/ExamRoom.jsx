// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Exam room — one timed paper, answered question by question and
// marked in a single pass at the end.
// Everything the student writes lives in `answers`/`workings` until that pass,
// which makes this the screen with the most to lose to a thrown render: an
// hour's paper is React state and nothing else. So the paper is mirrored to the
// draft store as it is filled in, and picked back up — clock included — if the
// screen ever has to be rebuilt from scratch.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { MathText } from '../lib/latex.jsx';
import { useApp } from '../App.jsx';
import { clearDraft, queueDraft, readDraft, saveDraft } from '../components/drafts.js';
import Icon from '../components/Icon.jsx';
import { tLater, useT } from '../i18n/index.js';

export default function ExamRoom() {
  const { id } = useParams();
  const { celebrate, refreshUser } = useApp();
  const nav = useNavigate();
  const [exam, setExam] = useState(null);
  const [answers, setAnswers] = useState({});
  const [workings, setWorkings] = useState({});
  const [showWk, setShowWk] = useState({});
  const [cur, setCur] = useState(0);
  const [left, setLeft] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [resumed, setResumed] = useState(false);
  const [flagged, setFlagged] = useState({});
  const [confirming, setConfirming] = useState(false);
  const [saved, setSaved] = useState(null);       // null | 'saved' | 'failed'
  const [timeNote, setTimeNote] = useState('');   // spoken once at 10, 5 and 1 minute left
  const confirmRef = useRef(null);
  const t = useT();
  const startRef = useRef(Date.now());

  useEffect(() => {
    api.get(`/exams/${id}`).then(r => {
      if (r.exam.finishedAt && r.exam.detail) {
        // A submitted paper has nothing left to recover, and a draft that
        // outlived its submit would only resurrect it.
        clearDraft('exam', id);
        setExam(r.exam);
        setResult({ score: r.exam.score, total: r.exam.total, pct: Math.round(100 * r.exam.score / r.exam.total), detail: r.exam.detail });
        return;
      }
      const draft = readDraft('exam', id);
      if (draft) {
        setAnswers(draft.answers || {});
        setWorkings(draft.workings || {});
        setShowWk(Object.fromEntries(Object.keys(draft.workings || {}).map(k => [k, true])));
        setCur(Math.min(draft.cur || 0, r.exam.questions.length - 1));
        setFlagged(draft.flagged || {});
        startRef.current = draft.startedAt || Date.now();
        setResumed(true);
      }
      setExam(r.exam);
      // The clock is read off the paper's own start time, not restarted: a
      // crash is not extra time, and picking the paper up an hour later should
      // land exactly where it would have without the crash.
      const spent = Math.floor((Date.now() - startRef.current) / 1000);
      setLeft(Math.max(0, r.exam.durationMin * 60 - spent));
    }).catch(() => nav('/exams'));
  }, [id, nav]);

  useEffect(() => {
    if (left === null || result) return;
    if (left <= 0) { submit(); return; }
    // Time warnings are words, announced once, never colour alone.
    if (left === 600 || left === 300 || left === 60) setTimeNote(tLater('exam.timeLeftNote', { count: Math.round(left / 60), n: Math.round(left / 60) }));
    // Not `t`: that name is the translator, and shadowing it here made the
    // warning ticks throw and the paper never auto-submit (tour-exam-timer.js).
    const tickTimer = setTimeout(() => setLeft(l => l - 1), 1000);
    return () => clearTimeout(tickTimer);
  }, [left, result]); // eslint-disable-line

  const answeredCount = useMemo(() => {
    if (!exam) return 0;
    return exam.questions.filter(q => q.multipart
      ? q.parts.some(pt => { const v = answers[`${q.id}::${pt.key}`]; return v !== '' && v != null; })
      : (answers[q.id] !== '' && answers[q.id] != null)).length;
  }, [answers, exam]);

  // Mirror the paper as it is filled in. queueDraft coalesces, so a burst of
  // keystrokes is one write, and it flushes when the tab hides or goes away.
  useEffect(() => {
    if (!exam || result || exam.finishedAt) return;
    const data = { answers, workings, cur, flagged, startedAt: startRef.current };
    const meta = { label: exam.title, note: `${answeredCount} of ${exam.questions.length} answered`, path: `/exams/${id}` };
    queueDraft('exam', id, data, meta);
    // The status line reports the write it actually made, on this device only.
    const timer = setTimeout(() => setSaved(saveDraft('exam', id, data, meta) ? 'saved' : 'failed'), 500);
    return () => clearTimeout(timer);
  }, [answers, workings, cur, flagged, exam, result, id, answeredCount]);

  useEffect(() => {
    if (!confirming) return;
    confirmRef.current?.querySelector('button')?.focus();
    const onKey = e => { if (e.key === 'Escape') setConfirming(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [confirming]);

  async function submit() {
    if (busy || result) return;
    setConfirming(false);
    setBusy(true);
    try {
      const r = await api.post(`/exams/${id}/submit`, { answers, workings, ms: Date.now() - startRef.current });
      clearDraft('exam', id);
      setResult(r);
      celebrate(r);
      refreshUser();
    } finally { setBusy(false); }
  }

  if (!exam) {
    return (
      <div className="exam-page" aria-busy="true">
        <div className="exam-body"><div className="skeleton" style={{ height: 300 }} /></div>
      </div>
    );
  }

  // ── Results view ──────────────────────────────────────────────────────────
  if (result) {
    const pct = result.pct ?? Math.round(100 * result.score / result.total);
    return (
      <div className="exam-page">
        <header className="exam-head">
          <button type="button" className="icon-btn" onClick={() => nav('/exams')} aria-label={t('exam.backToExams')}><Icon name="back" /><span>{t('exam.exams')}</span></button>
          <div className="exam-head-title"><b>{exam.title}</b><span className="muted">{t('exam.marked')}</span></div>
        </header>
      <div className="exam-body">
        <h1 className="sr-only">{t('exam.markedTitle', { title: exam.title })}</h1>
        <div className="card" style={{ padding: 28 }}>
          <div className="card-title">{exam.title}</div>
          {/* The number is ink, never a traffic light; the sentence carries the meaning. */}
          <div className="hero-num exam-result-num">{pct}%</div>
          <p className="sub" style={{ marginTop: 6 }}>{t('exam.scoreLine', { score: result.score, total: result.total })} · {
            (pct >= 80 ? t('exam.verdictStrong') : pct >= 50 ? t('exam.verdictFair') : t('exam.verdictReview'))}</p>
          <div className="row" style={{ marginTop: 18, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => document.getElementById('exam-review')?.scrollIntoView({ block: 'start' })}>{t('exam.reviewMarks')}</button>
            <button className="btn btn-ghost" onClick={() => nav('/exams')}>{t('exam.newPaper')}</button>
          </div>
        </div>
        <h2 id="exam-review" className="home-section-title" style={{ marginTop: 12 }}>{t('exam.questionByQuestion')}</h2>

        {result.detail.map((d, i) => d.multipart ? (
          <div className="card" key={d.id}>
            <div className="q-meta">
              <span className="tag">{t('exam.qN', { n: i + 1 })}</span>
              <span className="tag">{d.title}</span>
              <span className="tag">{t('exam.structured')}</span>
              <span className="tag" style={{ color: d.awarded === d.marks ? 'var(--good)' : 'var(--correction)' }}>
                {t('exam.marksOf', { awarded: d.awarded, marks: d.marks })}
                <span className="sr-only"> — {d.awarded === d.marks ? t('exam.allEarned') : d.awarded > 0 ? t('exam.partlyEarned') : t('exam.noneEarned')}</span>
              </span>
            </div>
            <MathText block className="q-prompt" style={{ fontSize: 16 }} text={d.stem} />
            {d.figure && <div className="q-figure" dangerouslySetInnerHTML={{ __html: d.figure }} />}
            {d.parts.map(pt => (
              <div key={pt.key} style={{ margin: '12px 0 0', paddingTop: 10, borderTop: '1px solid var(--hairline)' }}>
                <div className="row" style={{ gap: 8, alignItems: 'baseline' }}>
                  <b>({pt.key})</b>
                  <span style={{ flex: 1 }}><MathText text={pt.prompt} /></span>
                  <span className="tag" style={{ color: pt.correct ? 'var(--good)' : 'var(--correction)' }}>
                    {t('exam.marksOf', { awarded: pt.awarded, marks: pt.marks })}<span className="sr-only"> — {pt.correct ? t('exam.partCorrect') : t('exam.partIncorrect')}</span>
                  </span>
                </div>
                <div className="row" style={{ flexWrap: 'wrap', gap: 16, fontSize: 14, marginTop: 4 }}>
                  <span>{t('exam.yours')} <b>{pt.answerType === 'mcq' ? (pt.given !== '' && pt.given != null ? 'ABCD'[Number(pt.given)] ?? '—' : '—') : (pt.given || '—')}</b></span>
                  <span>{t('exam.correctAnswer')} <b><MathText text={pt.answerText} /></b></span>
                </div>
                {!pt.correct && pt.steps && (
                  <details style={{ marginTop: 6 }}>
                    <summary style={{ cursor: 'pointer', color: 'var(--brand-1)', fontWeight: 600, fontSize: 13 }}>{t('exam.workedSolution')}</summary>
                    <div className="steps">
                      {pt.steps.map((s, j) => (
                        <div className="step" key={j}>
                          <span className="step-n">{j + 1}</span>
                          <div>
                            <div className="step-h"><MathText text={s.h} /></div>
                            <div className="step-d"><MathText text={s.d} /></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="card" key={d.id}>
            <div className="q-meta">
              <span className="tag">{t('exam.qN', { n: i + 1 })}</span>
              <span className="tag" lang="en">{d.subtopicName}</span>
              <span className="tag">{t('exam.difficultyTag', { n: d.difficulty })}</span>
              <span className="tag" style={{ color: d.correct ? 'var(--good)' : 'var(--correction)' }}>
                {t('exam.marksOf', { awarded: d.awarded, marks: d.marks })}
              </span>
            </div>
            <MathText block className="q-prompt" style={{ fontSize: 16 }} text={d.prompt} />
            {d.figure && <div className="q-figure" dangerouslySetInnerHTML={{ __html: d.figure }} />}
            {d.answerType === 'mcq' && d.mcqOptions && (
              <div className="muted" style={{ marginBottom: 8 }}>
                {t('exam.options')} {d.mcqOptions.map((o, j) => <span key={j} style={{ marginRight: 12 }}>{'ABCD'[j]}. <MathText text={o} /></span>)}
              </div>
            )}
            <div className="row" style={{ flexWrap: 'wrap', gap: 16, fontSize: 14 }}>
              <span>{t('exam.yours')} <b>{d.answerType === 'mcq' ? (d.given !== '' && d.given != null ? 'ABCD'[Number(d.given)] ?? '—' : '—') : (d.given || '—')}</b></span>
              <span>{t('exam.correctAnswer')} <b><MathText text={d.solution.answerText} /></b></span>
            </div>
            {d.partial && (
              <div className="verdict" style={{ marginTop: 8, background: 'var(--brand-soft)', border: '1px solid var(--brand-1)' }}>
                <span className="verdict-ico">◐</span>
                <div style={{ fontSize: 13.5 }}>{d.partial.note}</div>
              </div>
            )}
            {!d.correct && (
              <details style={{ marginTop: 10 }}>
                <summary style={{ cursor: 'pointer', color: 'var(--brand-1)', fontWeight: 600, fontSize: 14 }}>{t('exam.solutionAndCriteria')}</summary>
                {d.solution.criteria && (
                  <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13.5 }}>
                    {d.solution.criteria.map((c, j) => <li key={j}>{t('exam.oneMark')} <MathText text={c.text} /></li>)}
                  </ul>
                )}
                <div className="steps">
                  {d.solution.steps.map((s, j) => (
                    <div className="step" key={j}>
                      <span className="step-n">{j + 1}</span>
                      <div>
                        <div className="step-h"><MathText text={s.h} /></div>
                        <div className="step-d"><MathText text={s.d} /></div>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        ))}
      </div>
      </div>
    );
  }

  // ── Taking view ───────────────────────────────────────────────────────────
  const q = exam.questions[cur];
  const mins = Math.floor((left || 0) / 60), secs = (left || 0) % 60;
  const isAnswered = qq => qq.multipart
    ? qq.parts.some(pt => { const v = answers[`${qq.id}::${pt.key}`]; return v !== '' && v != null; })
    : (answers[qq.id] !== '' && answers[qq.id] != null);
  const unanswered = exam.questions.length - answeredCount;
  const flaggedCount = Object.values(flagged).filter(Boolean).length;
  const low = left !== null && left < 300;

  return (
    <div className="exam-page">
      <h1 className="sr-only">{exam.title}</h1>
      <header className="exam-head">
        <button type="button" className="icon-btn" onClick={() => nav('/exams')} aria-label={t('exam.leaveSaved')}><Icon name="back" /></button>
        <div className="exam-head-title">
          <b>{exam.title}</b>
          <span className="muted" style={{ fontSize: 12.5 }}>
            {t('exam.answeredCount', { answered: answeredCount, total: exam.questions.length })}
            {resumed && ` · ${t('exam.resumed')}`}
          </span>
        </div>
        <span className={`exam-timer ${low ? 'low' : ''}`} role="timer" aria-label={t('exam.timeLeft', { time: `${mins}:${String(secs).padStart(2, '0')}` })}>
          <Icon name="clock" />{mins}:{String(secs).padStart(2, '0')}
          {low && <span className="exam-timer-note">{t('exam.underFive')}</span>}
        </span>
        <button className="btn btn-ghost btn-sm" onClick={() => setConfirming(true)} disabled={busy}>
          {busy ? t('exam.marking') : t('exam.reviewSubmit')}
        </button>
      </header>
      <div className="sr-only" role="status" aria-live="assertive">{timeNote}</div>

      <div className="exam-body">
        <nav className="exam-nav" aria-label={t('exam.questions')}>
          {exam.questions.map((qq, i) => (
            <button key={qq.id}
              className={`exam-dot ${i === cur ? 'cur' : ''} ${isAnswered(qq) ? 'done' : ''} ${flagged[qq.id] ? 'flagged' : ''}`}
              aria-label={isAnswered(qq) ? (flagged[qq.id] ? t('exam.dotAnsweredFlagged', { n: i + 1 }) : t('exam.dotAnswered', { n: i + 1 })) : (flagged[qq.id] ? t('exam.dotOpenFlagged', { n: i + 1 }) : t('exam.dotOpen', { n: i + 1 }))}
              aria-current={i === cur ? 'true' : undefined}
              onClick={() => setCur(i)}>{i + 1}</button>
          ))}
        </nav>
        <div className="exam-legend" aria-hidden="true">
          <span><i className="done" />{t('exam.legendAnswered')}</span>
          <span><i />{t('exam.legendOpen')}</span>
          <span><Icon name="flag" size={13} />{t('exam.legendFlagged')}</span>
        </div>

        <section className="exam-paper" aria-labelledby="exam-q-title">
          <div className="exam-qhead q-meta">
            <b id="exam-q-title">{t('exam.questionOf', { n: cur + 1, total: exam.questions.length })}</b>
            <span>{q.multipart ? t('exam.marksN', { count: q.marks, n: q.marks }) : q.diffLabel}</span>
            <span lang="en">{q.subtopicName}</span>
            {q.multipart && <span>{t('exam.structuredParts', { last: q.parts[q.parts.length - 1].key })}</span>}
            {/* A question that was actually set in an exam says which one. Every
                other question in the paper is authored practice, and a student
                is entitled to tell them apart while they are sitting it. */}
            {q.pyq && <span title={q.pyqSource || ''}>{t('exam.pyqTag', { source: q.pyqSource || t('exam.pyq') })}</span>}
            <button type="button" className="icon-btn exam-flag" style={{ marginLeft: 'auto' }} aria-pressed={!!flagged[q.id]}
              onClick={() => setFlagged(f => ({ ...f, [q.id]: !f[q.id] }))}>
              <Icon name="flag" size={16} />{flagged[q.id] ? t('exam.flagged') : t('exam.flag')}
            </button>
          </div>
        {q.multipart ? (
          <>
            <MathText block className="q-prompt" text={q.stem} />
            {q.figure && <div className="q-figure" dangerouslySetInnerHTML={{ __html: q.figure }} />}
            {q.parts.map(pt => (
              <div key={pt.key} style={{ margin: '14px 0 0', paddingTop: 12, borderTop: '1px solid var(--hairline)' }}>
                <div className="row" style={{ gap: 8, alignItems: 'baseline', marginBottom: 8 }}>
                  <b style={{ fontSize: 16 }}>({pt.key})</b>
                  <span style={{ flex: 1 }}><MathText text={pt.prompt} /></span>
                  <span className="tag">{t('exam.marksN', { count: pt.marks, n: pt.marks })}</span>
                </div>
                {pt.answerType === 'mcq' ? (
                  <div className="mcq">
                    {pt.mcqOptions.map((opt, j) => (
                      <button key={j}
                        className={`mcq-opt ${answers[`${q.id}::${pt.key}`] === String(j) ? 'sel' : ''}`}
                        onClick={() => setAnswers(a => ({ ...a, [`${q.id}::${pt.key}`]: String(j) }))}>
                        <span className="mcq-key">{'ABCD'[j]}</span>
                        <MathText text={opt} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="answer-row">
                    {pt.answerPrefix && <span className="answer-prefix"><MathText text={pt.answerPrefix} /></span>}
                    <input className="input answer-input" inputMode="text" enterKeyHint="done" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder={pt.inputHint || t('exam.answerPlaceholder')}
                      aria-label={t('exam.answerPart', { key: pt.key })}
                      value={answers[`${q.id}::${pt.key}`] || ''}
                      onChange={e => setAnswers(a => ({ ...a, [`${q.id}::${pt.key}`]: e.target.value }))} />
                    {pt.answerSuffix && <span className="answer-suffix">{pt.answerSuffix}</span>}
                  </div>
                )}
              </div>
            ))}
          </>
        ) : (
        <>
        <MathText block className="q-prompt" text={q.prompt} />
        {q.figure && <div className="q-figure" dangerouslySetInnerHTML={{ __html: q.figure }} />}

        {q.answerType === 'mcq' ? (
          <div className="mcq">
            {q.mcqOptions.map((opt, i) => (
              <button key={i}
                className={`mcq-opt ${answers[q.id] === String(i) ? 'sel' : ''}`}
                onClick={() => setAnswers(a => ({ ...a, [q.id]: String(i) }))}>
                <span className="mcq-key">{'ABCD'[i]}</span>
                <MathText text={opt} />
              </button>
            ))}
          </div>
        ) : q.answerType === 'working' ? (
          <div>
            <textarea className="input working-input" rows={6}
              aria-label={t('exam.workingAria')}
              placeholder={q.inputHint || t('exam.workingPlaceholder')}
              value={answers[q.id] || ''}
              onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))} />
            <div className="muted" style={{ marginTop: 6, fontSize: 12.5 }}>{t('exam.fullWorkingNote')}</div>
          </div>
        ) : (
          <div className="answer-row">
            {q.answerPrefix && <span className="answer-prefix"><MathText text={q.answerPrefix} /></span>}
            <input className="input answer-input" inputMode="text" enterKeyHint="done" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder={q.inputHint || t('exam.answerPlaceholder')}
              aria-label={t('exam.answerQuestion', { n: cur + 1 })}
              value={answers[q.id] || ''}
              onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter' && cur < exam.questions.length - 1) setCur(c => c + 1); }} />
            {q.answerSuffix && <span className="answer-suffix">{q.answerSuffix}</span>}
          </div>
        )}

        {q.answerType !== 'mcq' && q.answerType !== 'working' && q.supportsSteps && (
          <div style={{ marginTop: 12 }}>
            <button className="btn btn-quiet btn-sm" onClick={() => setShowWk(w => ({ ...w, [q.id]: !w[q.id] }))}>
              {t('exam.showWorking')}
            </button>
            {showWk[q.id] && (
              <>
                <textarea className="input" style={{ marginTop: 8 }} rows={4}
                  aria-label={t('exam.partialAria')}
                  placeholder={t('exam.partialPlaceholder')}
                  value={workings[q.id] || ''}
                  onChange={e => setWorkings(w => ({ ...w, [q.id]: e.target.value }))} />
                <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>{t('exam.partialNote')}</div>
              </>
            )}
          </div>
        )}
        </>
        )}

          <div className="exam-foot">
            <span className="status-line" data-state={saved === 'failed' ? 'failed' : saved ? 'saved' : 'idle'} role="status">
              {saved && <span className="dot" aria-hidden="true" />}
              {saved === 'failed' ? t('exam.notSaved') : saved ? t('exam.saved') : ''}
            </span>
            <button className="btn btn-ghost" disabled={cur === 0} onClick={() => setCur(c => c - 1)}>{t('exam.previous')}</button>
            {cur < exam.questions.length - 1
              ? <button className="btn btn-primary" onClick={() => setCur(c => c + 1)}>{t('exam.next')}</button>
              : <button className="btn btn-primary" onClick={() => setConfirming(true)} disabled={busy}>{t('exam.reviewSubmit')}</button>}
          </div>
        </section>
        <p className="exam-rules">{t('exam.rules')}</p>
      </div>

      {confirming && (
        <>
          <button type="button" className="sheet-scrim" aria-label={t('exam.keepWorking')} onClick={() => setConfirming(false)} />
          <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="exam-confirm-title" ref={confirmRef}>
            <h2 id="exam-confirm-title">{t('exam.confirmTitle')}</h2>
            <p className="sub">{t('exam.confirmAnswered', { answered: answeredCount, total: exam.questions.length })}</p>
            {unanswered > 0 && <p className="sub" style={{ marginTop: 6 }}><b>{t('exam.confirmUnanswered', { count: unanswered, n: unanswered })}</b></p>}
            {flaggedCount > 0 && <p className="sub" style={{ marginTop: 6 }}>{t('exam.confirmFlagged', { count: flaggedCount, n: flaggedCount })}</p>}
            <p className="muted" style={{ marginTop: 10 }}>{t('exam.confirmFinal')}</p>
            <div className="sheet-actions">
              <button className="btn btn-ghost" onClick={() => setConfirming(false)}>{t('exam.keepWorking')}</button>
              <button className="btn btn-primary" onClick={submit} disabled={busy}>{t('exam.submitPaper')}</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
