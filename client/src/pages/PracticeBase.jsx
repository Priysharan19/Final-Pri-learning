import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { cloud, cloudAvailable } from '../platform/cloudTransport.js';
import {
  assignmentProgressSummary, assignmentQuestionTarget, assignmentSessionFromSubmission
} from '../platform/assignmentProgress.js';
import QuestionCard, { SR_ONLY } from '../components/QuestionCard.jsx';
import PriExplain from '../components/PriExplain.jsx';

const EMPTY_SESSION = Object.freeze({ answered: 0, correct: 0, xp: 0 });

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
  const assignmentTargetReached = useRef(false);
  const assignmentSync = useRef(Promise.resolve());
  const [serve, setServe] = useState(null);
  const handedRef = useRef(location.state?.serve || null);   // a retry handed over from History
  const [error, setError] = useState('');
  const [session, setSession] = useState({ ...EMPTY_SESSION });
  const sessionRef = useRef({ ...EMPTY_SESSION });
  const loading = useRef(false);

  const replaceSession = useCallback((next) => {
    const value = { answered: next.answered || 0, correct: next.correct || 0, xp: next.xp || 0 };
    sessionRef.current = value;
    setSession(value);
  }, []);

  useEffect(() => {
    let live = true;
    assignmentSubmitted.current = false;
    assignmentTargetReached.current = false;
    assignmentSync.current = Promise.resolve();
    setAssignmentContext(null);
    setAssignmentError('');
    setServe(null);
    replaceSession(EMPTY_SESSION);
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

      const target = assignmentQuestionTarget(assignment.specification);
      const state = assignment.submission?.state || null;
      let restored = assignmentSessionFromSubmission(assignment.submission, target);
      let nextAssignment = assignment;

      if (state === 'submitted') {
        assignmentSubmitted.current = true;
        assignmentTargetReached.current = true;
      } else if (state === 'started') {
        assignmentTargetReached.current = restored.answered >= target;
      } else {
        // New and teacher-returned assignments begin a fresh revision attempt.
        // Teacher feedback remains attached to the assignment, while aggregate
        // completion counters restart intentionally for the new attempt.
        restored = { ...EMPTY_SESSION };
        const summary = assignmentProgressSummary(restored, target);
        await cloud.updateSubmission(assignmentClassId, assignmentId, { state: 'started', summary });
        if (!live) return;
        nextAssignment = {
          ...assignment,
          submission: {
            ...(assignment.submission || {}),
            state: 'started',
            summary,
            submittedAt: null,
            updatedAt: Date.now()
          }
        };
      }

      if (!live) return;
      replaceSession(restored);
      setAssignmentContext(nextAssignment);
    })().catch(err => {
      if (!live) return;
      setAssignmentError(err.message || 'This assignment could not be opened.');
    });
    return () => { live = false; };
  }, [assignmentMode, assignmentClassId, assignmentId, replaceSession]);

  const load = useCallback(async () => {
    if (loading.current) return;
    if (assignmentMode) {
      const contextMatches = assignmentContext &&
        String(assignmentContext.id) === String(assignmentId) &&
        String(assignmentContext.classId) === String(assignmentClassId);
      if (!contextMatches || assignmentTargetReached.current) return;
    }
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
  }, [subtopic, dotpoint, difficulty, taskId, track, assignmentMode, assignmentContext, assignmentClassId, assignmentId]);

  useEffect(() => {
    setServe(null);
    if (!assignmentMode) replaceSession(EMPTY_SESSION);
    load();
  }, [load, assignmentMode, replaceSession]);

  useEffect(() => {
    if (serve?.question?.subtopicName) document.title = `${serve.question.subtopicName} · Pri Learning`;
    return () => { document.title = 'Pri Learning'; };
  }, [serve]);

  const assignmentTarget = assignmentContext ? assignmentQuestionTarget(assignmentContext.specification) : 0;

  const syncAssignmentProgress = useCallback((nextSession) => {
    if (!assignmentMode || !assignmentContext || assignmentSubmitted.current) return Promise.resolve();
    const complete = nextSession.answered >= assignmentTarget;
    const summary = assignmentProgressSummary(nextSession, assignmentTarget);
    if (complete) {
      assignmentTargetReached.current = true;
      setServe(null);
    }

    // Recover the queue after a transient failure before appending the next
    // aggregate update. A failed early update must never poison every later
    // submission attempt in the session.
    assignmentSync.current = assignmentSync.current
      .catch(() => undefined)
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
    return assignmentSync.current;
  }, [assignmentMode, assignmentContext, assignmentClassId, assignmentId, assignmentTarget]);

  const onResolved = res => {
    const current = sessionRef.current;
    const next = {
      answered: current.answered + 1,
      correct: current.correct + (res.correct ? 1 : 0),
      xp: current.xp + (res.xp || 0)
    };
    replaceSession(next);
    syncAssignmentProgress(next);
  };

  const retryAssignmentSubmission = () => {
    if (!assignmentMode || !assignmentContext || assignmentSubmitted.current) return;
    syncAssignmentProgress(sessionRef.current);
  };

  const redo = async () => {
    if (assignmentTargetReached.current || !serve?.question) return;
    try {
      const r = await api.post(`/history/${serve.question.id}/retry`, { variant: 'same' });
      setServe(r);
    } catch { load(); setServe(null); }
  };

  const loadSimilar = useCallback(async () => {
    if (assignmentTargetReached.current) return;
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
  const assignmentCompleteLocally = !!assignmentContext && assignmentTargetReached.current;

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
            {assignmentSubmitted.current ? 'Submitted' : assignmentCompleteLocally ? 'Ready to submit' : 'Assignment'}
          </span>
        </div>
        {assignmentContext.submission?.feedback && <div className="notice" style={{ marginTop: 10 }}>
          <strong>Teacher feedback</strong>
          <div style={{ marginTop: 4 }}>{assignmentContext.submission.feedback.note || 'Your teacher returned this assignment for revision.'}</div>
        </div>}
        {assignmentError && <div className="notice error" role="alert" style={{ marginTop: 10 }}>{assignmentError}</div>}
        {assignmentSubmitted.current && <div className="notice success" role="status" style={{ marginTop: 10 }}>
          Assignment submitted. Your teacher must return it before more assignment work can be added.
        </div>}
        {assignmentCompleteLocally && !assignmentSubmitted.current && <div className="notice" role="status" style={{ marginTop: 10 }}>
          You reached the assignment target. No extra assignment questions will be generated while submission is pending.
          <div style={{ marginTop: 8 }}><button className="btn btn-primary btn-sm" onClick={retryAssignmentSubmission}>Retry submission</button></div>
        </div>}
      </div>}

      {error && (
        <div className="qpage">
          <p className="error-box">{error}</p>
          <button className="btn btn-primary" onClick={load}>Try again</button>
        </div>
      )}

      {!serve && !error && !assignmentCompleteLocally && (
        <div className="qpage">
          <div className="skeleton" style={{ height: 18, width: 180, marginBottom: 22 }} />
          <div className="skeleton" style={{ height: 54, marginBottom: 16 }} />
          <div className="skeleton" style={{ height: 240 }} />
        </div>
      )}

      {serve && !assignmentCompleteLocally && (
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
        {!assignmentCompleteLocally && <button className="ctx-next" title="Next question" aria-label="Next question" onClick={load}>›</button>}
      </div>
    </div>
  );
}
