import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { cloud, cloudAvailable } from '../platform/cloudTransport.js';
import { onCloudSessionChange } from '../platform/cloudSession.js';
import {
  assignmentProgressSummary, assignmentQuestionTarget, assignmentSessionFromSubmission
} from '../platform/assignmentProgress.js';
import QuestionCard, { SR_ONLY } from '../components/QuestionCard.jsx';
import PriExplain from '../components/PriExplain.jsx';
import FreeCapNotice from '../components/FreeCapNotice.jsx';
import { clearInkDraft, clearPendingSubmission, pendingSubmissionQuestionId, readPendingSubmission } from '../components/practiceRecovery.js';
import { tLater, useT, useTx } from '../i18n/index.js';
import Icon from '../components/Icon.jsx';
import { isContentEmpty, servable, contentEmptySignal } from '../lib/contentServe.js';
import { practiceHref, practiceRequestFromQuery } from '../lib/practiceLinks.js';
import { queueTelemetry } from '../platform/telemetry.js';
import { consumeSessionReceipt } from './practiceSessionReceipt.js';
import { shouldReloadPracticeOnCloudSignIn } from './practiceCloudRecovery.js';

// Reuse the existing verified account flow; never create a parallel practice login.
const PracticeAccountRecovery = React.lazy(() => import('../components/CloudAccountPanel.jsx'));

const EMPTY_SESSION = Object.freeze({ answered: 0, correct: 0, xp: 0 });

// A device may change local profiles while this route remains mounted.
// Keep every in-memory question, photo, transcript and recovery ref scoped to
// its owning profile. A cloud session refresh for the SAME local profile must
// not remount the card or discard a Photo awaiting account recovery.
export default function Practice() {
  const { user } = useApp();
  return <ProfilePractice key={String(user?.id ?? 'no-profile')} />;
}

function ProfilePractice() {
  const { user } = useApp();
  const t = useT();
  const tx = useTx();
  const navigate = useNavigate();
  // A natural stopping point: the session that carries today's count across
  // the student's own daily goal says so, once, and offers a way to finish.
  const [sessionDone, setSessionDone] = useState(null);
  const sessionDoneShown = useRef(false);
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const subtopic = params.get('subtopic');
  const dotpoint = params.get('dotpoint');
  const difficulty = params.get('difficulty');
  const track = params.get('track');
  const taskId = params.get('task');
  // "Past papers only": the PYQ filter Indian students ask for by name. It is a
  // filter, not a preference — when the archive has no past-paper question for
  // the chapter the request is refused with a reason rather than quietly
  // serving an authored one, so the label on the card is always true.
  const pyqOnly = params.get('pyq') === '1';
  const assignmentClassId = params.get('classId');
  const assignmentId = params.get('assignment');
  const assignmentMode = !!assignmentClassId && !!assignmentId;
  const [assignmentContext, setAssignmentContext] = useState(null);
  const [assignmentError, setAssignmentError] = useState('');
  const assignmentSubmitted = useRef(false);
  const assignmentTargetReached = useRef(false);
  const assignmentSync = useRef(Promise.resolve());
  const [serve, setServe] = useState(null);
  const currentQuestionRef = useRef(null);
  const handedRef = useRef(location.state?.serve || null);   // a retry handed over from History
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [accountRecoveryOpen, setAccountRecoveryOpen] = useState(false);
  const [pyqAlternatives, setPyqAlternatives] = useState([]);
  // A named difficulty with no authored form: the refusal's own detail — the
  // level asked for and the levels that exist — so the student can choose.
  const [difficultyGap, setDifficultyGap] = useState(null);
  const [capped, setCapped] = useState(null);
  const [session, setSession] = useState({ ...EMPTY_SESSION });
  const sessionRef = useRef({ ...EMPTY_SESSION });
  const seenSessionAttempts = useRef(new Set());
  const loading = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  // An empty path is a deliberate state, not an error to retry: it is shown
  // once, with a way out, and reported as a low-cardinality signal.
  // Read through a ref so the request callbacks below do not change identity
  // (and re-request) when the language or profile label changes.
  const emptyContext = useRef({});
  emptyContext.current = { t, track: track || user.indiaTrack || null, grade: user.year };
  const noteEmpty = useCallback((code) => {
    const { track: tr, grade } = emptyContext.current;
    const signal = contentEmptySignal({ code, track: tr, grade });
    try { queueTelemetry(signal.type, signal.options); } catch { /* best effort */ }
    try { console.warn('[pri-content] practice path served no question', signal.options.metadata); } catch { /* no console */ }
  }, []);

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
      setAssignmentError(tLater('assignment.needsCloud'));
      return () => { live = false; };
    }

    (async () => {
      const result = await cloud.assignmentDetails(assignmentClassId, assignmentId);
      if (!live) return;
      const assignment = result?.assignment;
      if (!assignment) throw new Error(t('assignment.notFound'));

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
      setAssignmentError(err.message || tLater('assignment.couldNotOpen'));
    });
    return () => { live = false; };
  }, [assignmentMode, assignmentClassId, assignmentId, replaceSession]);

  useEffect(() => { currentQuestionRef.current = serve?.question?.id || null; }, [serve]);

  const load = useCallback(async (options = null) => {
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
    setErrorCode('');
    setPyqAlternatives([]);
    setDifficultyGap(null);
    setCapped(null);
    try {
      // Reload/restart resumes unfinished work. Pressing the explicit Next
      // control is different: the student chose to skip, so record a safe
      // discard before serving a fresh question. A resolved row returns 409
      // here and is already safe to move past.
      // Leaving a question that cannot be marked (an offline draft) for one
      // that can is different again: the draft is given up only once a
      // markable question has actually arrived, never on the way to asking.
      const replacing = options?.replaceUnmarkable === true && !assignmentMode ? currentQuestionRef.current : null;
      if (options?.fresh === true && currentQuestionRef.current && !assignmentMode && !replacing) {
        const leaving = currentQuestionRef.current;
        // A submission still being marked is not abandoned by moving on: the
        // card finishes it, and the discard below waits for it in the backend.
        try { await api.post(`/practice/${leaving}/discard`, {}); }
        catch (e) { if (e?.status !== 409) throw e; }
        if (!readPendingSubmission(leaving)) clearInkDraft(leaving);
      }
      const assignmentSpec = assignmentContext?.specification || {};
      const assignmentSubtopic = assignmentSpec.subtopic ? String(assignmentSpec.subtopic) : null;
      const assignmentTrack = assignmentSpec.track ? String(assignmentSpec.track) : null;
      const assignmentDifficulty = Number.isFinite(Number(assignmentSpec.difficulty)) ? Number(assignmentSpec.difficulty) : null;
      // A level the student chose after a DIFFICULTY_UNAVAILABLE refusal is in
      // the URL; it stands in for the level a task or assignment named.
      const chosenLevel = difficulty != null && difficulty !== '' && Number.isFinite(Number(difficulty)) ? Number(difficulty) : null;
      const body = taskId ? { taskId, ...(chosenLevel != null ? { difficulty: chosenLevel } : {}) }
        : assignmentMode && assignmentSubtopic ? {
            mode: 'topic', subtopic: assignmentSubtopic,
            track: assignmentTrack || undefined,
            difficulty: chosenLevel ?? assignmentDifficulty ?? undefined
          }
          : assignmentMode ? {
              mode: 'smart', track: assignmentTrack || undefined,
              difficulty: chosenLevel ?? assignmentDifficulty ?? undefined
            }
          : practiceRequestFromQuery(params);
      // Real local practice resumes the exact unresolved question after reload,
      // background termination or a duplicate Next request. Cloud assignments
      // manage their own session contract and are intentionally left alone.
      if (!assignmentMode || taskId) body.resume = options?.fresh !== true;
      // A submission the app was killed in the middle of comes back first, so
      // its card can replay it and show the one verdict it produced (§09).
      const pendingQuestionId = body.resume === true ? pendingSubmissionQuestionId() : null;
      if (pendingQuestionId) body.pendingQuestionId = pendingQuestionId;
      const r = await api.post('/practice/next', body);
      if (!alive.current) return; // A former profile cannot restore this question.
      // Not served back means there is nothing left to recover (skipped, or
      // gone); a record that can never replay must not be sent forever.
      if (pendingQuestionId && r?.question?.id !== pendingQuestionId) clearPendingSubmission(pendingQuestionId);
      if (replacing) {
        const state = servable(r) ? r.question.checkState : 'draft';
        if (state === 'draft' || state === 'legacy') {
          // Still no markable question. The one just made is empty and is put
          // aside; the question the student was working on stays as it was.
          if (r?.question?.id && r.question.id !== replacing) {
            await api.post(`/practice/${r.question.id}/discard`, {}).catch(() => undefined);
          }
          return 'still-unmarkable';
        }
        try { await api.post(`/practice/${replacing}/discard`, {}); }
        catch (e) { if (e?.status !== 409) throw e; }
        if (!readPendingSubmission(replacing)) clearInkDraft(replacing);
        setServe(r);
        return 'replaced';
      }
      if (!servable(r)) throw Object.assign(new Error(emptyContext.current.t('practice.emptyTitle')), { code: 'CONTENT_EMPTY' });
      setServe(r);
    } catch (e) {
      if (!alive.current) return;
      // Asking for a markable question failed: nothing was replaced, and the
      // card says so beside the work that is still on it.
      if (options?.replaceUnmarkable === true && currentQuestionRef.current) return 'still-unmarkable';
      // A free-tier refusal is not a fault: it is the end of today's free
      // questions, and it is explained rather than shown as an error string.
      if (e?.code === 'FREE_CAP_REACHED' || e?.code === 'FREE_EXAM_CAP_REACHED') setCapped(e);
      else {
        if (isContentEmpty(e?.code)) noteEmpty(e.code);
        setError(e.message); setErrorCode(e?.status === 401 ? 'AUTH_REQUIRED' : (e?.code || ''));
        setPyqAlternatives(e?.code === 'INDIA_PYQ_UNAVAILABLE' && Array.isArray(e?.detail?.alternatives) ? e.detail.alternatives : []);
        if (e?.code === 'DIFFICULTY_UNAVAILABLE') {
          // Nothing was served, and nothing is shown in its place but the choice.
          setServe(null);
          setDifficultyGap({
            requested: Number(e?.detail?.difficultyRequested) || null,
            available: (Array.isArray(e?.detail?.available) ? e.detail.available : []).map(a => Number(a?.difficulty)).filter(d => Number.isInteger(d) && d >= 1 && d <= 4),
            dotpoint: e?.detail?.dotpoint != null
          });
        }
      }
    }
    finally { loading.current = false; }
  }, [subtopic, dotpoint, difficulty, taskId, track, pyqOnly, assignmentMode, assignmentContext, assignmentClassId, assignmentId, noteEmpty]);

  // After the existing account panel verifies the SAME local profile, retry
  // the untouched topic/dotpoint/difficulty request. An event from a different
  // student must never open this student's question or recover their work.
  useEffect(() => onCloudSessionChange(event => {
    if (event?.detail?.connected !== true ||
        String(event.detail.localProfileId) !== String(user?.id)) return;
    setAccountRecoveryOpen(false);
    // Signing in while a student is writing must not re-issue a question or
    // replace the mounted Ink canvas with another question ID. InkAnswer has
    // its own same-profile session listener which retries recognition after
    // the verified cloud-account transition. Only an empty Practice surface
    // needs initial question issuance after sign-in.
    if (shouldReloadPracticeOnCloudSignIn(event, user?.id, currentQuestionRef.current)) void load();
  }), [load, user?.id]);

  const setPyqOnly = useCallback((on) => {
    const next = new URLSearchParams(params);
    if (on) next.set('pyq', '1'); else next.delete('pyq');
    setParams(next);
  }, [params, setParams]);

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
        setAssignmentError(tLater('practice.assignmentSyncFailed', { reason: err.message || tLater('practice.cloudUnavailable') }));
      });
    return assignmentSync.current;
  }, [assignmentMode, assignmentContext, assignmentClassId, assignmentId, assignmentTarget, t]);

  const onResolved = res => {
    // A network acknowledgement from a removed account's card cannot change
    // this student's session or send an assignment summary under a new login.
    if (!alive.current || !consumeSessionReceipt(res, seenSessionAttempts.current)) return;
    const goal = Math.max(1, Number(user.dailyGoal) || 10);
    const before = Math.max(0, Number(user.today?.questions) || 0);
    if (!assignmentMode && !sessionDoneShown.current && before < goal && before + 1 >= goal) {
      sessionDoneShown.current = true;
      setSessionDone({ goal });
    }
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
    setErrorCode('');
    setCapped(null);
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
      if (!servable(r)) throw Object.assign(new Error(emptyContext.current.t('practice.emptyTitle')), { code: 'CONTENT_EMPTY' });
      setServe(r);
    } catch (e) {
      if (isContentEmpty(e?.code)) noteEmpty(e.code);
      setError(e.message); setErrorCode(e?.code || '');
    }
    finally { loading.current = false; }
  }, [serve, track, noteEmpty]);

  const course = (user.courseLabel || 'Mathematics').replace(/^(?:Year|Class) \d+\s*·\s*/, '');
  const metaLine = `${t(user.course === 'in' ? 'common.classNumber' : 'common.yearNumber', { n: serve?.question?.year ?? user.year })} · ${serve?.question?.indiaTrack ? (user.indiaTrackName || course) : course}`;
  const heading = assignmentContext?.title
    || serve?.question?.subtopicName
    || t(taskId ? 'practice.taskPractice' : subtopic ? 'practice.topicPractice' : 'practice.smartPractice');
  const assignmentCompleteLocally = !!assignmentContext && assignmentTargetReached.current;

  const exitBar = (
    <button type="button" className="icon-btn ws-exit" onClick={() => navigate('/')} aria-label={t('practice.leave')}>
      <Icon name="back" /><span>{t('nav.home')}</span>
    </button>
  );

  if (assignmentMode && assignmentError && !assignmentContext) {
    return (
      <div className="ws-page">
        <header className="ws-bar">{exitBar}</header>
        <div className="ws-notices">
          <h1 style={SR_ONLY}>{t('assignment.title')}</h1>
          <p className="error-box">{assignmentError}</p>
          <div><button className="btn btn-ghost" onClick={() => setParams({})}>{t('assignment.leave')}</button></div>
        </div>
      </div>
    );
  }

  return (
    <div className="ws-page">
      {/* the question itself is the page's visual title; this names it for a reader */}
      <h1 style={SR_ONLY}>{t('practice.heading', { name: heading })}</h1>

      <header className="ws-bar no-print">
        {exitBar}
        <div className="ws-bar-title">
          <span className="ctx-pill-name">
            {heading}
            {dotpoint != null && <span className="muted">{t('practice.dotpointMeta', { n: Number(dotpoint) + 1 })}</span>}
          </span>
          <span className="ctx-pill-meta">
            {metaLine}
            {session.answered > 0 && t('practice.sessionScore', { correct: session.correct, answered: session.answered, xp: session.xp })}
            {serve?.nextUp?.name && (
              <span data-next-up={serve.nextUp.subtopic}>
                {tx('practice.nextUp', { name: <span lang="en">{serve.nextUp.name}</span> })}
              </span>
            )}
          </span>
        </div>
        <div className="ws-bar-end">
          {user.course === 'in' && !assignmentMode && !taskId && (
            <button type="button" className="icon-btn ws-filter" aria-pressed={pyqOnly}
              title={t('practice.pyqOnlyTitle')} onClick={() => setPyqOnly(!pyqOnly)}>
              {t(pyqOnly ? 'practice.pyqOnlyLabelOn' : 'practice.pyqOnlyLabel')}
            </button>
          )}
          {(subtopic || taskId || difficulty || pyqOnly || assignmentMode) && (
            <button className="icon-btn ws-clear" title={t(assignmentMode ? 'assignment.leaveShort' : 'practice.clearFilters')}
              onClick={() => setParams({})}><Icon name="close" /><span>{t(assignmentMode ? 'assignment.leaveShort' : 'practice.clearShort')}</span></button>
          )}
          {!assignmentCompleteLocally && (
            <button className="ctx-next" title={t('practice.nextQuestion')} aria-label={t('practice.nextQuestion')} onClick={() => load({ fresh: true })}>
              <span className="ctx-next-label">{t('practice.next')}</span><Icon name="next" />
            </button>
          )}
        </div>
      </header>

      <div className="ws-notices">
        {assignmentContext && <div className="card ws-assignment">
          <div className="spread" style={{ gap: 12, alignItems: 'flex-start' }}>
            <div>
              <strong>{assignmentContext.title}</strong>
              <div className="muted">{assignmentContext.className} · {t('assignment.completed', { done: session.answered, total: assignmentTarget })}</div>
              {assignmentContext.specification?.instructions && <p style={{ margin: '8px 0 0' }}>{String(assignmentContext.specification.instructions)}</p>}
            </div>
            <span className={`tag ${assignmentSubmitted.current ? 'tag-brand' : ''}`}>
              {t(assignmentSubmitted.current ? 'assignment.submitted' : assignmentCompleteLocally ? 'assignment.readyToSubmit' : 'assignment.tag')}
            </span>
          </div>
          {assignmentContext.submission?.feedback && <div className="notice" style={{ marginTop: 10 }}>
            <strong>{t('assignment.teacherFeedback')}</strong>
            <div style={{ marginTop: 4 }}>{assignmentContext.submission.feedback.note || t('assignment.returnedForRevision')}</div>
          </div>}
          {assignmentError && <div className="notice error" role="alert" style={{ marginTop: 10 }}>{assignmentError}</div>}
          {assignmentSubmitted.current && <div className="notice success" role="status" style={{ marginTop: 10 }}>
            {t('assignment.submittedNote')}
          </div>}
          {assignmentCompleteLocally && !assignmentSubmitted.current && <div className="notice" role="status" style={{ marginTop: 10 }}>
            {t('assignment.targetReached')}
            <div style={{ marginTop: 8 }}><button className="btn btn-primary btn-sm" onClick={retryAssignmentSubmission}>{t('assignment.retrySubmission')}</button></div>
          </div>}
        </div>}

        {/* PYQ filter. Indian students work through past papers as the central
            study ritual, so the filter stays one tap away in the bar; on, every
            question served is a real question from a published paper, and a
            chapter the archive cannot serve says so. */}
        {/* On a phone the bar's filter and clear controls are hidden (theme.css
            ≤760px) and this row stands in for them, so it must appear in every
            case the bar's clear button would: a task, an assignment or a
            non-India student with a subtopic filter must still be able to
            clear or leave without going back to Home. The PYQ toggle stays
            India-only. */}
        {((user.course === 'in' && !assignmentMode && !taskId) || subtopic || taskId || difficulty || pyqOnly || assignmentMode) && (
          <div className="row ws-filter-inline" style={{ gap: 8 }}>
            {user.course === 'in' && !assignmentMode && !taskId && (
              <button type="button" className="icon-btn ws-filter" aria-pressed={pyqOnly}
                title={t('practice.pyqOnlyTitle')} onClick={() => setPyqOnly(!pyqOnly)}>
                {t(pyqOnly ? 'practice.pyqOnlyLabelOn' : 'practice.pyqOnlyLabel')}
              </button>
            )}
            {(subtopic || taskId || difficulty || pyqOnly || assignmentMode) && (
              <button type="button" className="icon-btn" data-testid="ws-filter-inline-clear" title={t(assignmentMode ? 'assignment.leaveShort' : 'practice.clearFilters')} onClick={() => setParams({})}><Icon name="close" />{t(assignmentMode ? 'assignment.leaveShort' : 'practice.clearShort')}</button>
            )}
          </div>
        )}
        {pyqOnly && <p className="muted">{t('practice.pyqOnlyNote')}</p>}

        {capped && <FreeCapNotice gate={capped} onRetry={load} />}

        {/* No question exists for this exact selection: an empty state with a way
            forward, not a failure. */}
        {error && !capped && isContentEmpty(errorCode) && (
          <div className="notice" role="status">
            <strong>{t('practice.emptyTitle')}</strong>
            <p className="muted" style={{ margin: '4px 0 10px' }}>{t('practice.emptyBody')}</p>
            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              <Link className="btn btn-primary btn-sm" to="/">{t('practice.emptyChooseTopic')}</Link>
              {(subtopic || dotpoint != null) && !taskId && !assignmentMode && (
                <button className="btn btn-quiet btn-sm" onClick={() => setParams(new URLSearchParams())}>{t('practice.emptySmart')}</button>
              )}
            </div>
          </div>
        )}

        {/* The level asked for has no questions for this selection. Nothing is
            served in its place: the page names the level, lists the levels that
            do exist, and waits for the student to choose one (issue #408). */}
        {error && !capped && errorCode === 'DIFFICULTY_UNAVAILABLE' && difficultyGap && (
          <div className="notice" role="status" data-difficulty-unavailable
            data-difficulty-requested={difficultyGap.requested || ''}>
            <strong>{t(difficultyGap.dotpoint ? 'practice.levelUnavailableDotpoint' : 'practice.levelUnavailableTopic', {
              requested: difficultyGap.requested ? `D${difficultyGap.requested} · ${t(`difficulty.${difficultyGap.requested}`)}` : ''
            })}</strong>
            <p className="muted" style={{ margin: '4px 0 10px' }}>
              {t(difficultyGap.available.length ? 'practice.levelUnavailableChoose' : 'practice.levelUnavailableNone')}
            </p>
            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              {difficultyGap.available.map(d => (
                <button key={d} type="button" className="btn btn-primary btn-sm" data-difficulty-choice={d}
                  onClick={() => { const next = new URLSearchParams(params); next.set('difficulty', String(d)); setParams(next); }}>
                  {t('practice.levelPractiseAt', { level: `D${d} · ${t(`difficulty.${d}`)}` })}
                </button>
              ))}
              {difficulty != null && !taskId && !assignmentMode && (
                <button type="button" className="btn btn-quiet btn-sm" data-difficulty-choice="adaptive"
                  onClick={() => { const next = new URLSearchParams(params); next.delete('difficulty'); setParams(next); }}>
                  {t('practice.levelLetPriChoose')}
                </button>
              )}
              <Link className="btn btn-quiet btn-sm" to="/">{t('practice.emptyChooseTopic')}</Link>
            </div>
          </div>
        )}

        {error && !capped && errorCode !== 'DIFFICULTY_UNAVAILABLE' && !isContentEmpty(errorCode) && (
          <div className="verdict verdict-technical" role="alert" data-practice-error={errorCode || 'error'}>
            <span className="verdict-ico"><Icon name="alert" /></span>
            <div>
              <div className="verdict-title">{errorCode === 'INDIA_PYQ_UNAVAILABLE' ? t('practice.pyqEmptyTitle') : t('practice.couldNotLoad')}</div>
              <div className="verdict-body">{error}</div>
              {errorCode === 'INDIA_PYQ_UNAVAILABLE' && pyqAlternatives.length > 0 && (
                // The nearest chapters whose archive does hold past papers. Each is
                // a past-papers-only link, so the filter's claim stays true.
                <div data-pyq-alternatives style={{ marginTop: 10 }}>
                  <p className="muted" style={{ margin: '0 0 8px' }}>{t('practice.pyqNearestTitle')}</p>
                  <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                    {pyqAlternatives.map(alt => (
                      <Link key={alt.subtopic} className="btn btn-ghost btn-sm"
                        to={practiceHref({ subtopic: alt.subtopic, track: track || null, pyq: true })}>
                        {t('practice.pyqNearestCta', { name: alt.name })}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {errorCode === 'AUTH_REQUIRED' && cloudAvailable() && (
                <div data-practice-auth-recovery style={{ marginTop: 10 }}>
                  <button type="button" className="btn btn-primary btn-sm"
                    data-testid="practice-sign-in" aria-expanded={accountRecoveryOpen}
                    onClick={() => setAccountRecoveryOpen(open => !open)}>
                    {t('login.cloudSignIn')}
                  </button>
                  {accountRecoveryOpen && (
                    <React.Suspense fallback={<p role="status">{t('cloud.stateChecking')}</p>}>
                      <PracticeAccountRecovery />
                    </React.Suspense>
                  )}
                </div>
              )}
              <div style={{ marginTop: 10 }}>
                {errorCode === 'INDIA_PYQ_UNAVAILABLE'
                  ? <button className={`btn ${pyqAlternatives.length ? 'btn-quiet' : 'btn-primary'} btn-sm`} onClick={() => setPyqOnly(false)}>{t('practice.pyqFilterOff')}</button>
                  : <button className="btn btn-primary btn-sm" onClick={load}>{t('common.tryAgain')}</button>}
              </div>
            </div>
          </div>
        )}

        {serve && serve.repeat && !assignmentCompleteLocally && (
          <div className="notice" role="note">{t('practice.repeatNote')}</div>
        )}

        {serve?.question?.pyq && !assignmentCompleteLocally && (
          <div className="notice" role="note">
            <strong>{t('practice.pyqBadge')}</strong> · {serve.question.pyqSource}
            {serve.question.pyqArchive?.citations?.length > 0 && (
              <div className="muted" style={{ marginTop: 4 }}>
                {t('practice.pyqTranscribedFrom')} {serve.question.pyqArchive.citations.map((c, i) => (
                  <React.Fragment key={c.id}>
                    {i > 0 && ' · '}
                    <a href={c.archivedAt || c.url} target="_blank" rel="noreferrer noopener">{c.title}</a>
                  </React.Fragment>
                ))}. {serve.question.pyqArchive.stepsAuthorship}
              </div>
            )}
          </div>
        )}

        {sessionDone && (
          <section className="session-done" aria-labelledby="session-done-title">
            <h2 id="session-done-title">{t('practice.goalReachedTitle', { count: sessionDone.goal, n: sessionDone.goal })}</h2>
            <p>{t('practice.goalReachedBody', { correct: session.correct, answered: session.answered })}</p>
            <div className="session-done-actions">
              <button className="btn btn-primary" onClick={() => navigate('/')}>{t('practice.doneForToday')}</button>
              <button className="btn btn-ghost" onClick={() => setSessionDone(null)}>{t('practice.keepGoing')}</button>
            </div>
          </section>
        )}
      </div>

      {!serve && !error && !capped && !assignmentCompleteLocally && (
        <div className="qpage ws ws-single" aria-busy="true">
          <div className="ws-context">
            <div className="skeleton" style={{ height: 14, width: 180, marginBottom: 22 }} />
            <div className="skeleton" style={{ height: 22, marginBottom: 10 }} />
            <div className="skeleton" style={{ height: 22, width: '70%' }} />
          </div>
          <p className="muted" role="status" style={{ textAlign: 'center' }}>{t('practice.loading')}</p>
        </div>
      )}

      {serve && !assignmentCompleteLocally && (
        <>
          <QuestionCard
            key={`${user.id}:${serve.question.id}`}
            question={serve.question}
            reason={serve.reason}
            reasonTag={serve.reasonTag || null}
            why={serve.why}
            onResolved={onResolved}
            onNext={() => load({ fresh: true })}
            onReplace={assignmentMode ? null : () => load({ fresh: true, replaceUnmarkable: true })}
            onRedo={redo}
          />
          <PriExplain
            key={`explain-${user.id}:${serve.question.id}`}
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
    </div>
  );
}
