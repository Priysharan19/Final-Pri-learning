import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { cloud, cloudAvailable } from '../platform/cloudTransport.js';
import QuestionCard, { SR_ONLY } from '../components/QuestionCard.jsx';
import PriExplain from '../components/PriExplain.jsx';

export default function Practice() {
  const { user } = useApp();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const subtopic = params.get('subtopic');
  const dotpoint = params.get('dotpoint');
  const difficulty = params.get('difficulty');
  const track = params.get('track');
  const taskId = params.get('task');
  const assignmentClassId = params.get('classId');
  const assignmentId = params.get('assignment');
  const assignmentMode = !!assignmentClassId && !!assignmentId;
  const [assignmentContext, setAssignmentContext] = useState(null);
  const [assignmentError, setAssignmentError] = useState('');
  const assignmentSubmitted = useRef(false);
  const assignmentSync = useRef(Promise.resolve());
  const [serve, setServe] = useState(null);
  const handedRef = useRef(location.state?.serve || null);   // a retry handed over from History
  const [error, setError] = useState('');
  const [session, setSession] = useState({ answered: 0, correct: 0, xp: 0 });
  const loading = useRef(false);

  useEffect(() => {
    let live = true;
    assignmentSubmitted.current = false;
    assignmentSync.current = Promise.resolve();
    setAssignmentContext(null);
    setAssignmentError('');
    if (!assignmentMode) return () => { live = false; };
    if (!cloudAvailable()) {
      setAssignmentError('This classroom assignment needs the Pri Learning cloud connection to verify membership and load its specification. Your normal offline practice is still available.');
      return () => { live = false; };
    }

    (async () => {
      const result = await cloud.assignmentDetails(assignmentClassId, assignmentId);
      if (!live) return;
      const assignment = result?.assignment;
      if (!assignment) throw new Error('Assignment not found.');
      setAssignmentContext(assignment);
      assignmentSubmitted.current = assignment.submission?.state === 'submitted';
      if (!assignmentSubmitted.current && assignment.submission?.state !== 'started') {
        await cloud.updateSubmission(assignmentClassId, assignmentId, {
          state: 'started',
          summary: {
            kind: 'practice', questionsAnswered: 0, correct: 0, xp: 0,
            startedFromAppAt: Date.now()
          }
        });
      }
    })().catch(err => {
      if (!live) return;
      setAssignmentError(err.message || 'This assignment could not be opened.');
    });
    return () => { live = false; };
  }, [assignmentMode, assignmentClassId, assignmentId]);

  const load = useCallback(async () => {
    if (loading.current) return;
    if (assignmentMode && !assignmentContext) return;
    if (handedRef.current) {
      const handed = handedRef.current;
      handedRef.current = null;
      setServe(handed);
      return;
    }
    loading.current = true;
    setError('');
    try {
      const assignmentSpec = assignmentContext?.specification || {};
      const assignmentSubtopic = assignmentSpec.subtopic ? String(assignmentSpec.subtopic) : null;
      const assignmentTrack = assignmentSpec.track ? String(assignmentSpec.track) : null;
      const assignmentDifficulty = Number.isFinite(Number(assignmentSpec.difficulty)) ? Number(assignmentSpec.difficulty) : null;
      const body = taskId ? { taskId }
        : assignmentMode && assignmentSubtopic ? {
            mode: 'topic', subtopic: assignmentSubtopic,
            track: assignmentTrack || undefined,
            difficulty: assignmentDifficulty ?? undefined
          }
          : assignmentMode ? {
              mode: 'smart', track: assignmentTrack || undefined,
              difficulty: assignmentDifficulty ?? undefined
            }
          : subtopic ? { mode: 'topic', subtopic, track: track || undefined, dotpoint: dotpoint != null ? Number(dotpoint) : undefined, difficulty: difficulty != null ? Number(difficulty) : undefined }
            : { mode: 'smart', track: track || undefined, difficulty: difficulty != null ? Number(difficulty) : undefined };
      const r = await api.post('/practice/next', body);
      setServe(r);
    } catch (e) { setError(e.message); }
    finally { loading.current = false; }
  }, [subtopic, dotpoint, difficulty, taskId, track, assignmentMode, assignmentContext]);

  useEffect(() => { setServe(null); setSession({ answered: 0, correct: 0, xp: 0 }); load(); }, [load]);

  useEffect(() => {
    if (serve?.question?.subtopicName) document.title = `${serve.question.subtopicName} · Pri Learning`;
    return () => { document.title = 'Pri Learning'; };
  }, [serve]);

  const assignmentTarget = assignmentContext
    ? Math.max(1, Math.min(50, Number(assignmentContext.specification?.questionCount) || 10))
    : 0;

  const syncAssignmentProgress = useCallback((nextSession) => {
    if (!assignmentMode || !assignmentContext || assignmentSubmitted.current) return;
    const complete = nextSession.answered >= assignmentTarget;
    const summary = {
      kind: 'practice',
      questionsAnswered: nextSession.answered,
      correct: nextSession.correct,
      xp: nextSession.xp,
      targetQuestions: assignmentTarget,
      lastUpdatedAt: Date.now(),
      ...(complete ? { completedAt: Date.now() } : {})
    };

    // Preserve answer order at the cloud boundary. This prevents a slower
    // "started" update from racing a later "submitted" update and trying to
    // reopen a finished submission. Only aggregate progress is transmitted.
    assignmentSync.current = assignmentSync.current
      .then(() => cloud.updateSubmission(assignmentClassId, assignmentId, {
        state: complete ? 'submitted' : 'started', summary
      }))
      .then(() => {
        if (complete) {
          assignmentSubmitted.current = true;
          setAssignmentContext(current => current ? {
            ...current,
            submission: { ...(current.submission || {}), state: 'submitted', summary, submittedAt: Date.now() }
          } : current);
        }
        setAssignmentError('');
      })
      .catch(err => {
        setAssignmentError(`Your maths work is safe on this device, but assignment progress could not sync: ${err.message || 'cloud unavailable'}`);
      });
  }, [assignmentMode, assignmentContext, assignmentClassId, assignmentId, assignmentTarget]);

  const onResolved = res => {
    setSession(current => {
      const next = {
        answered: current.answered + 1,
        correct: current.correct + (res.correct ? 1 : 0),
        xp: current.xp + (res.xp || 0)
      };
      syncAssignmentProgress(next);
      return next;
    });
  };

  const redo = async () => {
    if (!serve?.question) return;
    try {
      const r = await api.post(`/history/${serve.question.id}/retry`, { variant: 'same' });
      setServe(r);
    } catch { load(); setServe(null); }
  };

  const loadSimilar = useCallback(async () => {
    const q = serve?.question;
    if (!q?.subtopic || q.subtopic === 'custom') return;
    if (loading.current) return;
    loading.current = true;
    setError('');
    // Clear the resolved question before generation starts. Otherwise closing
    // Pri Explain briefly exposes the stale evaluation card while the fresh
    // transfer question is being created, which makes the hand-off feel like
    // nothing happened and can invite a duplicate tap.
    setServe(null);
    try {
      const r = await api.post('/practice/next', {
        mode: 'topic',
        subtopic: q.subtopic,
        track: q.indiaTrack || track || undefined,
        difficulty: q.difficulty,
      });
      setServe(r);
    } catch (e) { setError(e.message); }
    finally { loading.current = false; }
  }, [serve, track]);

  const course = (user.courseLabel || 'Mathematics').replace(/^(?:Year|Class) \d+\s*·\s*/, '');
  const metaLine = `${user.course === 'in' ? 'Class' : 'Year'} ${serve?.question?.year ?? user.year} · ${serve?.question?.indiaTrack ? (user.indiaTrackName || course) : course}`;
  const heading = assignmentContext?.title
    || serve?.question?.subtopicName
    || (taskId ? 'Task practice' : subtopic ? 'Topic practice' : 'Smart practice');

  if (assignmentMode && assignmentError && !assignmentContext) {
    return (
      <div className="qpage">
        <h1 style={SR_ONLY}>Classroom assignment</h1>
        <p className="error-box">{assignmentError}</p>
        <button className="btn btn-ghost" onClick={() => setParams({})}>Leave assignment and open normal Practice</button>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', paddingBottom: 70 }}>
      {/* the question itself is the page's visual title; this names it for a reader */}
      <h1 style={SR_ONLY}>Practice · {heading}</h1>

      {assignmentContext && <div className="card" style={{ marginBottom: 14, padding: 14 }}>
        <div className="spread" style={{ gap: 12, alignItems: 'flex-start' }}>
          <div>
            <strong>{assignmentContext.title}</strong>
            <div className="muted">{assignmentContext.className} · {session.answered}/{assignmentTarget} questions completed</div>
            {assignmentContext.specification?.instructions && <p style={{ margin: '8px 0 0' }}>{String(assignmentContext.specification.instructions)}</p>}
          </div>
          <span className={`tag ${assignmentSubmitted.current ? 'tag-brand' : ''}`}>
            {assignmentSubmitted.current ? 'Submitted' : 'Assignment'}
          </span>
        </div>
        {assignmentError && <div className="notice error" role="alert" style={{ marginTop: 10 }}>{assignmentError}</div>}
        {assignmentSubmitted.current && <div className="notice success" role="status" style={{ marginTop: 10 }}>Assignment target reached and aggregate completion has been submitted to your teacher.</div>}
      </div>}

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
            questionFigure={serve.question.figure}
            studentContext={{
              year: serve.question.year ?? user.year,
              course: user.course,
              pathway: user.pathway,
              indiaTrack: serve.question.indiaTrack || user.indiaTrack,
              difficulty: serve.question.difficulty,
              subtopic: serve.question.subtopicName,
              dotpoint: serve.question.dotpointText,
              reason: serve.reason,
              session,
            }}
            onTrySimilar={serve.question.subtopic && serve.question.subtopic !== 'custom' ? loadSimilar : undefined}
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
          {(subtopic || taskId || difficulty || assignmentMode) && (
            <button className="btn btn-quiet btn-sm" title={assignmentMode ? 'Leave assignment' : 'Clear filters — back to smart practice'}
              aria-label={assignmentMode ? 'Leave assignment' : 'Clear filters — back to smart practice'} onClick={() => setParams({})}>✕</button>
          )}
        </div>
        <button className="ctx-next" title="Next question" aria-label="Next question" onClick={load}>›</button>
      </div>
    </div>
  );
}
