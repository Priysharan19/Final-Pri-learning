import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { MathText } from '../lib/latex.jsx';
import { useApp } from '../App.jsx';
import { useT, useTx } from '../i18n/index.js';

export default function Rush() {
  const { celebrate, refreshUser } = useApp();
  const t = useT();
  const tx = useTx();
  const [phase, setPhase] = useState('lobby'); // lobby | running | done
  const [questions, setQuestions] = useState([]);
  const [idx, setIdx] = useState(0);
  const [left, setLeft] = useState(90);
  const [answer, setAnswer] = useState('');
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [attempted, setAttempted] = useState(0);
  const [flash, setFlash] = useState('');
  const [summary, setSummary] = useState(null);
  const [lastAnswer, setLastAnswer] = useState(null);
  const inputRef = useRef(null);
  const busyRef = useRef(false);

  useEffect(() => {
    if (phase !== 'running') return;
    if (left <= 0) { finish(); return; }
    const timer = setTimeout(() => setLeft(l => l - 1), 1000);
    return () => clearTimeout(timer);
  }, [phase, left]); // eslint-disable-line

  async function start() {
    const r = await api.post('/rush/start', {});
    setQuestions(r.questions); setLeft(r.seconds);
    setIdx(0); setCombo(0); setBestCombo(0); setCorrect(0); setAttempted(0); setSummary(null); setLastAnswer(null);
    setPhase('running');
    setTimeout(() => inputRef.current?.focus(), 80);
  }

  async function answerCurrent(given) {
    if (busyRef.current) return;
    busyRef.current = true;
    const q = questions[idx];
    try {
      const r = await api.post('/rush/answer', { id: q.id, answer: String(given) });
      setAttempted(a => a + 1);
      if (r.correct) {
        setCorrect(c => c + 1);
        setCombo(c => { const n = c + 1; setBestCombo(b => Math.max(b, n)); return n; });
        setFlash('good');
        setLastAnswer(null);
      } else {
        setCombo(0);
        setFlash('bad');
        setLastAnswer(r.answerText);
      }
      setTimeout(() => setFlash(''), 380);
      setAnswer('');
      setIdx(i => i + 1);
      setTimeout(() => inputRef.current?.focus(), 30);
    } finally { busyRef.current = false; }
    if (idx + 1 >= questions.length) finish();
  }

  async function finish() {
    if (phase !== 'running') return;
    setPhase('done');
    const r = await api.post('/rush/finish', { correct, total: attempted, bestCombo });
    setSummary(r);
    celebrate(r);
    refreshUser();
  }

  if (phase === 'lobby') {
    return (
      <div className="card qcard" style={{ textAlign: 'center', padding: 40 }}>
        <h1 className="sr-only">{t('nav.rush')}</h1>
        <div style={{ fontSize: 46 }} aria-hidden="true">⚡</div>
        <h2 style={{ margin: '10px 0 6px' }}>{t('rush.lobbyTitle')}</h2>
        <p className="sub" style={{ maxWidth: 460, margin: '0 auto 20px' }}>
          {t('rush.lobbyIntro')}
        </p>
        <button className="btn btn-primary btn-lg" onClick={start}>{t('rush.start')}</button>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="card qcard" style={{ textAlign: 'center', padding: 40 }}>
        <h1 className="sr-only">{t('rush.finishedHeading')}</h1>
        <div className="card-title">{t('rush.timeUp')}</div>
        <div className="hero-num">{correct}</div>
        <p className="sub" style={{ marginTop: 4 }}>{tx('rush.resultLine', { combo: <b className="rush-combo">×{bestCombo}</b> })}</p>
        {summary && (
          <p className="sub" style={{ marginTop: 10 }}>
            {summary.best > correct ? tx('rush.personalBest', { best: <b>{summary.best}</b> }) : t('rush.newBest')}
            {' '}{t('rush.xpGained', { xp: correct * 6 })}
          </p>
        )}
        <div className="row" style={{ justifyContent: 'center', marginTop: 18 }}>
          <button className="btn btn-primary" onClick={start}>{t('rush.goAgain')}</button>
        </div>
      </div>
    );
  }

  const q = questions[idx];
  if (!q) { finish(); return null; }

  return (
    <div className="grid" style={{ gap: 16, maxWidth: 680, margin: '0 auto' }}>
      <h1 className="sr-only">{t('rush.inPlayHeading')}</h1>
      <div className="spread">
        <span className={`rush-timer ${left <= 10 ? 'delta-down' : ''}`} role="timer" aria-label={t('rush.secondsLeft', { count: left, n: left })}>{t('rush.secondsShort', { n: left })}</span>
        <div className="row">
          <span className="chip">✔ <b>{correct}</b></span>
          <span className="chip">{tx('rush.comboChip', { combo: <b className="rush-combo">×{combo}</b> })}</span>
        </div>
      </div>
      <div className="goalbar" aria-hidden="true"><i style={{ width: `${(left / 90) * 100}%` }} /></div>

      <div className={`card ${flash === 'good' ? 'rush-flash-good' : flash === 'bad' ? 'rush-flash-bad' : ''}`}>
        <div className="q-meta">
          <span className="tag" lang="en">{q.subtopicName}</span>
          <span className="tag">{t('rush.questionNumber', { n: idx + 1 })}</span>
        </div>
        <MathText block className="q-prompt" text={q.prompt} />
          {q.figure && <div className="q-figure" dangerouslySetInnerHTML={{ __html: q.figure }} />}
        {q.answerType === 'mcq' ? (
          <div className="mcq">
            {q.mcqOptions.map((opt, i) => (
              <button key={i} className="mcq-opt" onClick={() => answerCurrent(i)}>
                <span className="mcq-key">{'ABCD'[i]}</span>
                <MathText text={opt} />
              </button>
            ))}
          </div>
        ) : (
          <div className="answer-row">
            {q.answerPrefix && <span className="answer-prefix"><MathText text={q.answerPrefix} /></span>}
            <input ref={inputRef} className="input answer-input" value={answer} aria-label={t('verdict.yourAnswer')} placeholder={q.inputHint || t('rush.answerPlaceholder')}
              onChange={e => setAnswer(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && answer.trim()) answerCurrent(answer); }} />
            <button className="btn btn-primary" disabled={!answer.trim()} onClick={() => answerCurrent(answer)}>{t('rush.go')}</button>
          </div>
        )}
        <div className="spread" style={{ marginTop: 14 }}>
          {lastAnswer
            ? <span className="muted">{tx('rush.lastWas', { answer: <b><MathText text={lastAnswer} /></b> })}</span>
            : <span />}
          <button className="btn btn-quiet btn-sm" onClick={() => answerCurrent('__skip__')}>{t('rush.skip')}</button>
        </div>
      </div>
    </div>
  );
}
