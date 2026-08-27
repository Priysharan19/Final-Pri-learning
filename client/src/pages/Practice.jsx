import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import QuestionCard, { SR_ONLY } from '../components/QuestionCard.jsx';
import PriExplain from '../components/PriExplain.jsx';

export default function Practice() {
  const { user } = useApp();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const subtopic = params.get('subtopic');
  const dotpoint = params.get('dotpoint');
  const difficulty = params.get('difficulty');
  const taskId = params.get('task');
  const [serve, setServe] = useState(null);
  const handedRef = useRef(location.state?.serve || null);   // a retry handed over from History
  const [error, setError] = useState('');
  const [session, setSession] = useState({ answered: 0, correct: 0, xp: 0 });
  const loading = useRef(false);

  const load = useCallback(async () => {
    if (loading.current) return;
    if (handedRef.current) {
      const handed = handedRef.current;
      handedRef.current = null;
      setServe(handed);
      return;
    }
    loading.current = true;
    setError('');
    try {
      const body = taskId ? { taskId }
        : subtopic ? { mode: 'topic', subtopic, dotpoint: dotpoint != null ? Number(dotpoint) : undefined, difficulty: difficulty != null ? Number(difficulty) : undefined }
          : { mode: 'smart', difficulty: difficulty != null ? Number(difficulty) : undefined };
      const r = await api.post('/practice/next', body);
      setServe(r);
    } catch (e) { setError(e.message); }
    finally { loading.current = false; }
  }, [subtopic, dotpoint, difficulty, taskId]);

  useEffect(() => { setServe(null); setSession({ answered: 0, correct: 0, xp: 0 }); load(); }, [load]);

  useEffect(() => {
    if (serve?.question?.subtopicName) document.title = `${serve.question.subtopicName} · Pri Learning`;
    return () => { document.title = 'Pri Learning'; };
  }, [serve]);

  const onResolved = res => {
    setSession(s => ({ answered: s.answered + 1, correct: s.correct + (res.correct ? 1 : 0), xp: s.xp + (res.xp || 0) }));
  };

  const redo = async () => {
    if (!serve?.question) return;
    try {
      const r = await api.post(`/history/${serve.question.id}/retry`, { variant: 'same' });
      setServe(r);
    } catch { load(); setServe(null); }
  };

  const course = (user.courseLabel || 'Mathematics').replace(/^Year \d+\s*·\s*/, '');
  const metaLine = `Year ${serve?.question?.year ?? user.year} · ${course}`;
  const heading = serve?.question?.subtopicName
    || (taskId ? 'Task practice' : subtopic ? 'Topic practice' : 'Smart practice');

  return (
    <div style={{ position: 'relative', paddingBottom: 70 }}>
      {/* the question itself is the page's visual title; this names it for a reader */}
      <h1 style={SR_ONLY}>Practice · {heading}</h1>

      {error && (
        <div className="qpage">
          <p className="error-box">{error}</p>
          <button className="btn btn-primary" onClick={load}>Try again</button>
        </div>
      )}

      {!serve && !error && (
        <div className="qpage">
          <div className="skeleton" style={{ height: 18, width: 180, marginBottom: 22 }} />
          <div className="skeleton" style={{ height: 54, marginBottom: 16 }} />
          <div className="skeleton" style={{ height: 240 }} />
        </div>
      )}

      {serve && (
        <>
          <QuestionCard
            key={serve.question.id}
            question={serve.question}
            reason={serve.reason}
            why={serve.why}
            onResolved={onResolved}
            onNext={load}
            onRedo={redo}
          />
          <PriExplain
            key={`explain-${serve.question.id}`}
            questionId={serve.question.id}
            questionPrompt={serve.question.prompt}
          />
        </>
      )}

      {/* bottom context pill */}
      <div className="ctx-pill no-print">
        <div className="ctx-pill-info">
          <span className="genbar-toggle" style={{ padding: 0, cursor: 'default' }} aria-hidden="true">⌃</span>
          <div>
            <div className="ctx-pill-meta">
              {metaLine}
              {session.answered > 0 && <> · session {session.correct}/{session.answered} · +{session.xp} XP</>}
            </div>
            <div className="ctx-pill-name">
              {heading}
              {dotpoint != null && <span className="muted"> · dot point {Number(dotpoint) + 1}</span>}
            </div>
          </div>
          {(subtopic || taskId || difficulty) && (
            <button className="btn btn-quiet btn-sm" title="Clear filters — back to smart practice"
              aria-label="Clear filters — back to smart practice" onClick={() => setParams({})}>✕</button>
          )}
        </div>
        <button className="ctx-next" title="Next question" aria-label="Next question" onClick={load}>›</button>
      </div>
    </div>
  );
}
