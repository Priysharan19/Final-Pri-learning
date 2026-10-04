// Match Mode — race a rival through quick-fire questions. All local, no account.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { MathText } from '../lib/latex.jsx';
import { useApp } from '../App.jsx';
import { useT, useTx } from '../i18n/index.js';

// The rivals' names are what the backend stores in match history (the English
// name is the record), so the display name is looked up from the stored name.
const RIVAL_NAME_KEYS = {
  'Robo-Rookie': 'match.rivalRookie',
  'Captain Cosine': 'match.rivalPro',
  'The Integrator': 'match.rivalLegend'
};
const RIVALS = [
  { key: 'rookie', nameKey: 'match.rivalRookie', avatar: '🤖', blurbKey: 'match.blurbRookie', rating: 1420, tier: 'Apprentice' },
  { key: 'pro', nameKey: 'match.rivalPro', avatar: '🦾', blurbKey: 'match.blurbPro', rating: 2287, tier: 'Master' },
  { key: 'legend', nameKey: 'match.rivalLegend', avatar: '👾', blurbKey: 'match.blurbLegend', rating: 3016, tier: 'Grandmaster' }
];
// Strand values are what the backend filters on; the label is looked up.
const STRAND_LABEL_KEYS = {
  Algebra: 'match.strandAlgebra',
  Calculus: 'match.strandCalculus',
  'Statistics & Probability': 'match.strandStatistics'
};
const STRANDS = [null, ...Object.keys(STRAND_LABEL_KEYS)];
const tierFor = r => r == null ? null : r < 1400 ? 'Novice' : r < 1800 ? 'Apprentice' : r < 2200 ? 'Expert' : r < 2600 ? 'Master' : 'Grandmaster';
const TIER_COLOR = { Novice: 'var(--ink-3)', Apprentice: '#7f9c6a', Expert: '#6a89c0', Master: '#b58a3e', Grandmaster: '#c05a52' };
const TIER_KEYS = { Novice: 'match.tierNovice', Apprentice: 'match.tierApprentice', Expert: 'match.tierExpert', Master: 'match.tierMaster', Grandmaster: 'match.tierGrandmaster' };
const rivalName = (t, name) => (RIVAL_NAME_KEYS[name] ? t(RIVAL_NAME_KEYS[name]) : name);

export default function Match() {
  const { user, celebrate, refreshUser } = useApp();
  const nav = useNavigate();
  const t = useT();
  const tx = useTx();
  const [phase, setPhase] = useState('lobby');
  const [rivalKey, setRivalKey] = useState('rookie');
  const [strand, setStrand] = useState(null);
  const [hist, setHist] = useState(null);
  const [game, setGame] = useState(null);
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState('');
  const [me, setMe] = useState(0);
  const [rival, setRival] = useState(0);
  const [flash, setFlash] = useState('');
  const [result, setResult] = useState(null);
  const [lastAnswer, setLastAnswer] = useState(null);
  const startRef = useRef(0);
  const rivalTimer = useRef(null);
  const inputRef = useRef(null);
  const busyRef = useRef(false);
  const stateRef = useRef({ me: 0, rival: 0, done: false });

  useEffect(() => { api.get('/match/history').then(setHist).catch(() => { }); }, [phase]);

  const myRating = useMemo(() => {
    if (!hist || !hist.played) return null;
    return 1200 + 60 * hist.wins - 22 * (hist.played - hist.wins);
  }, [hist]);

  async function start() {
    const r = await api.post('/match/start', { rival: rivalKey, strand });
    setGame(r); setIdx(0); setMe(0); setRival(0); setResult(null); setAnswer(''); setLastAnswer(null);
    stateRef.current = { me: 0, rival: 0, done: false };
    setPhase('racing');
    startRef.current = Date.now();
    clearInterval(rivalTimer.current);
    rivalTimer.current = setInterval(() => {
      if (stateRef.current.done) return;
      if (Math.random() < r.rival.accuracy) {
        stateRef.current.rival += 1;
        setRival(stateRef.current.rival);
        if (stateRef.current.rival >= r.total) finish(false);
      }
    }, r.rival.secPerQ * 1000);
    setTimeout(() => inputRef.current?.focus(), 80);
  }

  useEffect(() => () => clearInterval(rivalTimer.current), []);

  async function answerCurrent(given) {
    if (busyRef.current || stateRef.current.done) return;
    busyRef.current = true;
    const q = game.questions[idx];
    try {
      const r = await api.post('/rush/answer', { id: q.id, answer: String(given) });
      if (r.correct) {
        stateRef.current.me += 1;
        setMe(stateRef.current.me);
        setFlash('good'); setLastAnswer(null);
      } else {
        setFlash('bad'); setLastAnswer(r.answerText);
      }
      setTimeout(() => setFlash(''), 380);
      setAnswer('');
      if (stateRef.current.me >= game.total) { finish(true); return; }
      if (idx + 1 >= game.questions.length) { finish(stateRef.current.me > stateRef.current.rival); return; }
      setIdx(i => i + 1);
      setTimeout(() => inputRef.current?.focus(), 30);
    } finally { busyRef.current = false; }
  }

  async function finish(reachedFirst) {
    if (stateRef.current.done) return;
    stateRef.current.done = true;
    clearInterval(rivalTimer.current);
    const won = reachedFirst && stateRef.current.me >= stateRef.current.rival || stateRef.current.me > stateRef.current.rival;
    const r = await api.post('/match/finish', {
      won, playerScore: stateRef.current.me, rivalScore: stateRef.current.rival,
      rival: game.rival.name, ms: Date.now() - startRef.current
    });
    setResult({ ...r, won });
    celebrate(r);
    refreshUser();
    setPhase('done');
  }

  /* ── lobby ── */
  if (phase === 'lobby') {
    const board = [...RIVALS.map(r => ({ ...r, name: t(r.nameKey) })), { key: 'you', name: user.name, avatar: null, rating: myRating, tier: tierFor(myRating), you: true }]
      .sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
    return (
      <div>
        <div className="match-hero">
          <h1>{t('match.title')}</h1>
          <p>{t('match.subtitle')}</p>
        </div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', alignItems: 'start' }}>
          <div className="grid" style={{ gap: 14 }}>
            <div className="card card-flush">
              <div className="card-head"><span className="sc-label" style={{ margin: 0 }}>{t('match.yourRating')}</span></div>
              <div className="row" style={{ padding: '14px 16px' }}>
                <span className="lb-avatar">{user.avatar || initials(user.name)}</span>
                <span className="lb-name">{user.name}</span>
                <span className="lb-score">{myRating ?? '—'}</span>
              </div>
              {myRating != null && (
                <div style={{ padding: '0 16px 14px' }}>
                  <span className="lb-tag" style={{ color: TIER_COLOR[tierFor(myRating)], borderColor: TIER_COLOR[tierFor(myRating)] }}>{t(TIER_KEYS[tierFor(myRating)])}</span>
                  <span className="muted" style={{ marginLeft: 10 }}>{t('match.record', { wins: hist.wins, played: hist.played })}</span>
                </div>
              )}
            </div>

            <div className="card card-flush">
              <div className="card-head"><span className="sc-label" style={{ margin: 0 }}>{t('match.startMatch')}</span></div>
              <div style={{ padding: '14px 16px' }}>
                <div className="label" id="match-rival">{t('match.rival')}</div>
                <div className="grid" role="group" aria-labelledby="match-rival" style={{ gap: 8 }}>
                  {RIVALS.map(r => (
                    <button key={r.key} className={`gen-opt ${rivalKey === r.key ? 'on' : ''}`} style={{ textAlign: 'left', display: 'flex', gap: 10, alignItems: 'center' }}
                      onClick={() => setRivalKey(r.key)}>
                      <span style={{ fontSize: 20 }}>{r.avatar}</span>
                      <span style={{ flex: 1 }}>{t(r.nameKey)}<br /><small>{t(r.blurbKey)}</small></span>
                      <span className="muted">{r.rating}</span>
                    </button>
                  ))}
                </div>
                <div className="label" id="match-arena" style={{ marginTop: 14 }}>{t('match.arena')}</div>
                <div className="pill-select" role="group" aria-labelledby="match-arena">
                  {STRANDS.map(s => (
                    <button key={s || 'all'} className={`pill-opt ${strand === s ? 'on' : ''}`} onClick={() => setStrand(s)}>
                      {s === null ? t('match.strandAll') : t(STRAND_LABEL_KEYS[s])}
                    </button>
                  ))}
                </div>
                <button className="btn btn-primary btn-glow" style={{ width: '100%', marginTop: 16 }} onClick={start}>{t('match.play')}</button>
                <div className="row" style={{ marginTop: 10 }}>
                  <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => nav('/rush')}>{t('match.rapidFireSolo')}</button>
                </div>
              </div>
            </div>

            <div className="card card-flush">
              <div className="card-head"><span className="sc-label" style={{ margin: 0 }}>{t('match.recent')}</span></div>
              <div style={{ padding: '6px 16px 12px' }}>
                {hist?.recent?.length
                  ? hist.recent.map((m, i) => (
                    <div key={i} className="row" style={{ padding: '7px 0', borderBottom: i < hist.recent.length - 1 ? '1px solid var(--hairline)' : 'none', fontSize: 14 }}>
                      <span style={{ color: m.won ? 'var(--good)' : 'var(--bad)', width: 34 }}>{m.won ? t('match.win') : t('match.loss')}</span>
                      <span style={{ flex: 1 }} className="muted">{t('match.versus', { name: rivalName(t, m.rival) })}</span>
                      <span>{m.playerScore}–{m.rivalScore}</span>
                    </div>
                  ))
                  : <p className="muted" style={{ padding: '14px 0', textAlign: 'center' }}>{t('match.noMatches')}</p>}
              </div>
            </div>
          </div>

          <div className="card card-flush">
            <div className="card-head gold"><span style={{ color: 'var(--gold)' }}>♛</span> {t('match.leaderboard')}</div>
            {board.map((r, i) => (
              <div key={r.key} className="lb-row" style={r.you ? { background: 'var(--gold-soft)' } : {}}>
                <span className={`lb-rank ${i < 3 ? `r${i + 1}` : ''}`}>{i + 1}</span>
                <span className="lb-avatar">{r.avatar || initials(r.name)}</span>
                <span className="lb-name">{r.name}{r.you && <span className="muted"> {t('match.youTag')}</span>}</span>
                {r.tier && <span className="lb-tag" style={{ color: TIER_COLOR[r.tier], borderColor: TIER_COLOR[r.tier] }}>{t(TIER_KEYS[r.tier])}</span>}
                <span className="lb-score">{r.rating ?? '—'}</span>
              </div>
            ))}
            <div style={{ padding: '12px 16px' }} className="muted">
              {t('match.leaderboardNote')}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── result ── */
  if (phase === 'done') {
    return (
      <div className="card qcard" style={{ textAlign: 'center', padding: 40 }}>
        <h1 className="sr-only">{t('match.resultHeading')}</h1>
        <div style={{ fontSize: 46 }} aria-hidden="true">{result.won ? '♛' : '⚑'}</div>
        <h2 style={{ margin: '10px 0 4px' }}>{result.won ? t('match.youBeat', { name: rivalName(t, game.rival.name) }) : t('match.rivalWins', { name: rivalName(t, game.rival.name) })}</h2>
        <p className="sub">{result.won ? t('match.finalScoreWon', { me, rival }) : t('match.finalScoreLost', { me, rival })}</p>
        <p className="muted" style={{ marginTop: 8 }}>{t('match.career', { wins: t('match.winsCounted', { count: result.wins, n: result.wins }), matches: t('match.matchesCounted', { count: result.played, n: result.played }) })}</p>
        <div className="row" style={{ justifyContent: 'center', marginTop: 18 }}>
          <button className="btn btn-primary" onClick={() => setPhase('lobby')}>{t('match.rematch')}</button>
          <button className="btn btn-ghost" onClick={() => setPhase('lobby')}>{t('match.lobby')}</button>
        </div>
      </div>
    );
  }

  /* ── racing ── */
  const q = game.questions[idx];
  return (
    <div className="grid" style={{ gap: 16, maxWidth: 760, margin: '0 auto' }}>
      <h1 className="sr-only">{t('match.racingHeading', { name: rivalName(t, game.rival.name) })}</h1>
      <div className="card">
        <div className="race-track" role="status" aria-label={t('match.raceStatus', { me, name: rivalName(t, game.rival.name), rival, total: game.total })}>
          <div className="race-lane">
            <span className="race-face" aria-hidden="true">{user.avatar || '🙋'}</span>
            <div className="race-bar race-you" aria-hidden="true"><i style={{ width: `${(me / game.total) * 100}%` }} /></div>
            <span className="race-score" aria-hidden="true">{me}</span>
          </div>
          <div className="race-lane">
            <span className="race-face" aria-hidden="true">{game.rival.avatar}</span>
            <div className="race-bar race-rival" aria-hidden="true"><i style={{ width: `${(rival / game.total) * 100}%` }} /></div>
            <span className="race-score" aria-hidden="true">{rival}</span>
          </div>
        </div>
        <div className={`card ${flash === 'good' ? 'rush-flash-good' : flash === 'bad' ? 'rush-flash-bad' : ''}`} style={{ padding: 16 }}>
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
                onKeyDown={e => { if (e.key === 'Enter' && answer.trim()) answerCurrent(answer); }}
                autoCapitalize="none" autoCorrect="off" spellCheck={false} />
              <button className="btn btn-primary" disabled={!answer.trim()} onClick={() => answerCurrent(answer)}>{t('rush.go')}</button>
            </div>
          )}
          <div className="spread" style={{ marginTop: 12 }}>
            {lastAnswer ? <span className="muted">{tx('match.answerWas', { answer: <b><MathText text={lastAnswer} /></b> })}</span> : <span />}
            <button className="btn btn-quiet btn-sm" onClick={() => answerCurrent('__skip__')}>{t('rush.skip')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function initials(name = '') {
  return name.split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'PL';
}
