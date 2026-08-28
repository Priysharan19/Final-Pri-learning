import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MathText } from '../lib/latex.jsx';
import { buildVisualTimeline, visualSummary } from '../explain/visualEngine.js';
import { visualCuePlan, visualCueState, visualProgressForCue } from '../explain/choreography.js';
import { VisualBlock } from './PriExplainVisuals.jsx';
import './PriExplainV5.css';
import './PriExplainV7.css';

const SOLUTION_EVENT = 'pri:worked-solution';
const ATTEMPT_EVENT = 'pri:attempt-feedback';
const SPEEDS = [0.8, 1, 1.2, 1.4];

function speechText(value) {
  return String(value || '')
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '$1 divided by $2')
    .replace(/\\sqrt\{([^{}]+)\}/g, 'square root of $1')
    .replace(/\\times/g, ' times ')
    .replace(/\\div/g, ' divided by ')
    .replace(/\\pm/g, ' plus or minus ')
    .replace(/\\leq?/g, ' less than or equal to ')
    .replace(/\\geq?/g, ' greater than or equal to ')
    .replace(/\\neq/g, ' not equal to ')
    .replace(/\\pi/g, ' pi ')
    .replace(/\\theta/g, ' theta ')
    .replace(/\^\{?([^}\s]+)\}?/g, ' to the power of $1 ')
    .replace(/[{}$]/g, '')
    .replace(/\\[a-zA-Z]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function canSpeak() {
  return typeof window !== 'undefined'
    && 'speechSynthesis' in window
    && typeof SpeechSynthesisUtterance !== 'undefined';
}

function cancelSpeech() {
  if (canSpeak()) window.speechSynthesis.cancel();
}

function speakBeat(value, speed, onDone) {
  const text = speechText(value);
  if (!text || !canSpeak()) {
    onDone?.();
    return () => {};
  }

  cancelSpeech();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-AU';
  utterance.rate = Math.max(0.75, Math.min(1.4, 0.96 * speed));
  utterance.pitch = 1;
  let active = true;
  const finish = () => {
    if (!active) return;
    active = false;
    onDone?.();
  };
  utterance.onend = finish;
  utterance.onerror = finish;
  window.speechSynthesis.speak(utterance);

  return () => {
    if (!active) return;
    active = false;
    utterance.onend = null;
    utterance.onerror = null;
    cancelSpeech();
  };
}

function beatDelay(line, first, hasVisuals) {
  const chars = speechText(line).length;
  return Math.max(900, Math.min(3400, 680 + chars * 27 + (first && hasVisuals ? 500 : 0)));
}

function holdDelay(scene) {
  if (scene?.visuals?.some(visual => visual.kind === 'ink')) return 1900;
  if (scene?.visuals?.length) return 1250;
  return 850;
}

function initialReduceMotion() {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
}

const VISUAL_NAMES = {
  transform: 'Equation motion', ink: 'Ink replay', graph: 'Graph draw', geometry: 'Geometry build',
  calculus: 'Calculus region', statistics: 'Data visual', figure: 'Diagram build', attempt: 'Working replay',
  checkpoint: 'Pause + predict', focus: 'Math focus',
};

export default function PriExplainV5({ questionId, questionPrompt, questionFigure }) {
  const [payload, setPayload] = useState(null);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [beat, setBeat] = useState(0);
  const [checkpointPassed, setCheckpointPassed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [voice, setVoice] = useState(false);
  const [narrating, setNarrating] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(initialReduceMotion);
  const timerRef = useRef(null);
  const speechCancelRef = useRef(null);
  const dialogRef = useRef(null);
  const launchRef = useRef(null);
  const wrongRef = useRef(null);

  const timeline = useMemo(() => buildVisualTimeline(payload?.solution, {
    ...payload,
    questionPrompt,
    questionFigure,
    wrongAttempt: payload?.wrongAttempt || wrongRef.current?.submission || null,
  }), [payload, questionPrompt, questionFigure]);

  const current = timeline[index] || null;
  const lineCount = current?.lines?.length || 0;
  const revealedLines = reduceMotion ? lineCount : Math.min(beat, lineCount);
  const sceneComplete = reduceMotion || beat >= lineCount;
  const visualCues = useMemo(() => visualCuePlan(current?.visuals || [], lineCount), [current, lineCount]);
  const hasCheckpoint = Boolean(current?.visuals?.some(visual => visual.kind === 'checkpoint'));
  const checkpointPending = sceneComplete && hasCheckpoint && !checkpointPassed;
  const atEnd = timeline.length > 0 && index === timeline.length - 1;
  const atFinished = atEnd && sceneComplete && !checkpointPending;
  const visualKinds = useMemo(() => visualSummary(timeline), [timeline]);

  const stopNarration = () => {
    speechCancelRef.current?.();
    speechCancelRef.current = null;
    setNarrating(false);
  };

  const goScene = (nextIndex, revealAll = false) => {
    if (!timeline.length) return;
    const bounded = Math.max(0, Math.min(nextIndex, timeline.length - 1));
    stopNarration();
    setIndex(bounded);
    setBeat(revealAll ? (timeline[bounded]?.lines?.length || 0) : 0);
    setCheckpointPassed(false);
  };

  const pausePlayback = () => {
    setPlaying(false);
    stopNarration();
  };

  const stepForward = () => {
    if (!current) return;
    if (beat < lineCount && !reduceMotion) {
      setBeat(value => Math.min(value + 1, lineCount));
      return;
    }
    if (checkpointPending) {
      if (atEnd) setCheckpointPassed(true);
      else goScene(index + 1, false);
      return;
    }
    if (!atEnd) goScene(index + 1, false);
  };

  const stepBack = () => {
    if (!current) return;
    if (checkpointPassed) {
      setCheckpointPassed(false);
      return;
    }
    if (beat > 0 && !reduceMotion) {
      setBeat(value => Math.max(0, value - 1));
      return;
    }
    if (index > 0) goScene(index - 1, true);
  };

  const restart = () => {
    goScene(0, false);
    setPlaying(!reduceMotion);
  };

  useEffect(() => {
    const query = typeof window !== 'undefined' ? window.matchMedia?.('(prefers-reduced-motion: reduce)') : null;
    if (!query) return undefined;
    const onChange = event => {
      setReduceMotion(Boolean(event.matches));
      if (event.matches) pausePlayback();
    };
    query.addEventListener?.('change', onChange);
    return () => query.removeEventListener?.('change', onChange);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    wrongRef.current = null;
    setPayload(null);
    setOpen(false);
    setIndex(0);
    setBeat(0);
    setCheckpointPassed(false);
    setPlaying(false);
    setVoice(false);
    stopNarration();
    cancelSpeech();
  }, [questionId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const receiveAttempt = event => {
      const detail = event?.detail;
      if (String(detail?.questionId) !== String(questionId)) return;
      if (detail.correct === false && detail.submission && !wrongRef.current) wrongRef.current = detail;
    };
    const receiveSolution = event => {
      const detail = event?.detail;
      if (!detail?.solution || String(detail.questionId) !== String(questionId)) return;
      const prior = wrongRef.current;
      setPayload({
        ...detail,
        wrongAttempt: prior?.submission || (detail.correct === false ? detail.submission : null),
        feedback: prior?.feedback || detail.feedback || '',
        diagnosis: prior?.diagnosis || detail.diagnosis || null,
        misconception: prior?.misconception || detail.misconception || null,
        hadWrongAttempt: Boolean(prior),
      });
      setIndex(0);
      setBeat(0);
      setCheckpointPassed(false);
      setPlaying(false);
      stopNarration();
    };
    window.addEventListener(ATTEMPT_EVENT, receiveAttempt);
    window.addEventListener(SOLUTION_EVENT, receiveSolution);
    return () => {
      window.removeEventListener(ATTEMPT_EVENT, receiveAttempt);
      window.removeEventListener(SOLUTION_EVENT, receiveSolution);
    };
  }, [questionId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    clearTimeout(timerRef.current);
    speechCancelRef.current?.();
    speechCancelRef.current = null;

    if (!open || !playing || !current || reduceMotion) {
      setNarrating(false);
      return undefined;
    }

    const advanceAfterNarration = () => {
      speechCancelRef.current = null;
      setNarrating(false);
      if (beat < lineCount) {
        setBeat(value => Math.min(value + 1, lineCount));
        return;
      }
      if (checkpointPending) {
        setPlaying(false);
        return;
      }
      if (atEnd) {
        setPlaying(false);
        return;
      }
      timerRef.current = setTimeout(() => goScene(index + 1, false), holdDelay(current) / speed);
    };

    if (voice && canSpeak()) {
      const source = beat === 0
        ? current.heading
        : current.lines?.[Math.min(beat - 1, Math.max(0, lineCount - 1))] || current.heading;
      setNarrating(true);
      speechCancelRef.current = speakBeat(source, speed, advanceAfterNarration);
      return () => {
        speechCancelRef.current?.();
        speechCancelRef.current = null;
      };
    }

    setNarrating(false);
    if (beat < lineCount) {
      const line = current.lines[beat] || '';
      timerRef.current = setTimeout(
        () => setBeat(value => Math.min(value + 1, lineCount)),
        beatDelay(line, beat === 0, Boolean(current.visuals?.length)) / speed,
      );
      return () => clearTimeout(timerRef.current);
    }

    if (checkpointPending) {
      setPlaying(false);
      return undefined;
    }

    if (atEnd) {
      setPlaying(false);
      return undefined;
    }

    timerRef.current = setTimeout(() => goScene(index + 1, false), holdDelay(current) / speed);
    return () => clearTimeout(timerRef.current);
  }, [open, playing, current, atEnd, checkpointPending, index, beat, lineCount, speed, reduceMotion, voice]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return undefined;
    const onKey = event => {
      if (event.key === 'Escape') {
        setOpen(false); pausePlayback(); cancelSpeech();
        setTimeout(() => launchRef.current?.focus(), 0);
      } else if (event.key === 'ArrowRight') {
        pausePlayback(); stepForward();
      } else if (event.key === 'ArrowLeft') {
        pausePlayback(); stepBack();
      } else if (event.key === ' ' && !['BUTTON', 'SELECT', 'INPUT'].includes(event.target?.tagName)) {
        event.preventDefault();
        if (checkpointPending) stepForward();
        else if (atFinished) restart();
        else if (playing) pausePlayback();
        else setPlaying(true);
      }
    };
    window.addEventListener('keydown', onKey);
    setTimeout(() => dialogRef.current?.focus(), 0);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, index, beat, lineCount, checkpointPending, checkpointPassed, atFinished, reduceMotion, playing]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    speechCancelRef.current?.();
    cancelSpeech();
  }, []);

  if (!payload || !timeline.length) return null;

  const sceneFraction = lineCount ? Math.min(1, revealedLines / lineCount) : 1;
  const progress = Math.min(100, ((index + sceneFraction) / timeline.length) * 100);
  const status = checkpointPending
    ? 'Your turn · predict before continuing'
    : atFinished
      ? 'Complete'
      : playing
        ? narrating
          ? 'Narrating this move'
          : beat < lineCount ? 'Teaching the next move' : 'Moving to the next step'
        : 'Paused';
  const activeLine = revealedLines > 0 ? revealedLines - 1 : -1;

  const close = () => {
    setOpen(false);
    pausePlayback();
    cancelSpeech();
    setTimeout(() => launchRef.current?.focus(), 0);
  };

  return (
    <>
      <button ref={launchRef} className="pri-explain-launch no-print" type="button"
        onClick={() => { setOpen(true); setBeat(0); setCheckpointPassed(false); setPlaying(!reduceMotion); }} aria-haspopup="dialog">
        <span className="pri-explain-play" aria-hidden="true">▶</span>
        <span><b>Watch explanation</b><small>{visualKinds.length ? 'Teacher-synchronised visual working' : 'Animated worked solution'}</small></span>
      </button>

      {open && (
        <div className="pri-explain-backdrop no-print" role="presentation" onMouseDown={event => event.target === event.currentTarget && close()}>
          <section className="pri-explain-dialog" role="dialog" aria-modal="true" aria-label="Animated worked solution" tabIndex={-1} ref={dialogRef}>
            <header className="pri-explain-head">
              <div>
                <div className="pri-explain-kicker">Pri Explain · Board Mode V4 · V7 teacher conductor</div>
                <h2>Watch the teacher explain, write and build each mathematical move in sync</h2>
                {!!visualKinds.length && <div className="pri-explain-capabilities" aria-label="Visual explanation capabilities">
                  {visualKinds.map(kind => <span key={kind}>{VISUAL_NAMES[kind] || kind}</span>)}
                </div>}
              </div>
              <button className="btn btn-quiet btn-sm" type="button" onClick={close} aria-label="Close visual solution">✕</button>
            </header>

            <div className="pri-explain-question">
              <span>Question</span>
              <MathText text={questionPrompt || 'Worked solution'} />
            </div>

            <div className="pri-explain-progress" aria-label={`Step ${index + 1} of ${timeline.length}`}>
              <div><span>Step {index + 1} of {timeline.length}{lineCount ? ` · beat ${Math.min(revealedLines + 1, lineCount)} of ${lineCount}` : ''}</span><span>{status}</span></div>
              <i><b style={{ width: `${progress}%` }} /></i>
            </div>

            <div className="pri-explain-layout">
              <div className="pri-explain-stage" aria-live="polite">
                <article key={`${current.id}-${index}`} className={`pri-explain-scene active ${current.kind}`}>
                  <div className="pri-explain-step-label">
                    {current.kind === 'diagnosis' ? 'Replay + diagnosis' : `Step ${current.number}`}
                    {current.concept && current.concept !== 'generic' && <em>{current.concept}</em>}
                  </div>
                  <h3><MathText text={current.heading} /></h3>

                  <div className="pri-explain-board">
                    {!!current.visuals?.length && (
                      <div className="pri-explain-visuals">
                        {current.visuals.map((visual, visualIndex) => {
                          const cue = visualCues[visualIndex];
                          const cueState = visualCueState(cue, revealedLines, reduceMotion);
                          const cueProgress = visualProgressForCue(cue, revealedLines, reduceMotion);
                          return (
                            <div
                              key={`${current.id}-${visual.kind}-${visualIndex}`}
                              className={`pri-explain-visual-beat ${cueState}`}
                              data-visual-kind={visual.kind === 'figure' ? visual.mode : visual.kind}
                            >
                              {cueState === 'active' && visual.kind !== 'checkpoint' && <span className="pri-explain-now" aria-hidden="true">now</span>}
                              <VisualBlock visual={visual} progress={cueProgress} complete={sceneComplete} />
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="pri-explain-lines">
                      {playing && !checkpointPending && (
                        <div className={`pri-explain-teacher-cue ${narrating ? 'narrating' : ''}`} aria-hidden="true">
                          <i /><span>{narrating ? 'teacher is explaining' : 'teacher is working'}</span>
                        </div>
                      )}
                      {(current.lines || []).slice(0, revealedLines).map((line, lineIndex) => (
                        <div key={`${current.id}-${lineIndex}`} className={`pri-explain-line ${lineIndex === activeLine ? 'current' : ''}`}>
                          <span className="pri-explain-line-number" aria-hidden="true">{lineIndex + 1}</span>
                          <MathText text={line} />
                        </div>
                      ))}
                      {!reduceMotion && revealedLines < lineCount && (
                        <div className="pri-explain-writing" aria-hidden="true"><i /><span>{voice && playing ? 'listening, then writing the next move…' : 'preparing the next move…'}</span></div>
                      )}
                    </div>
                  </div>
                </article>

                {atFinished && payload.solution?.answerText && (
                  <div className="pri-explain-final">
                    <span>Verified final answer</span>
                    <strong><MathText text={payload.solution.answerText} /></strong>
                  </div>
                )}
              </div>

              <aside className="pri-explain-rail" aria-label="Solution timeline">
                <div className="pri-explain-rail-title">Worked solution</div>
                {timeline.map((scene, sceneIndex) => (
                  <button type="button" key={`nav-${scene.id}`}
                    className={`${sceneIndex === index ? 'on' : ''} ${sceneIndex < index ? 'done' : ''}`}
                    aria-current={sceneIndex === index ? 'step' : undefined}
                    onClick={() => { goScene(sceneIndex, true); setPlaying(false); }}>
                    <span>{sceneIndex < index ? '✓' : sceneIndex + 1}</span>
                    <div><b>{scene.kind === 'diagnosis' ? 'Your attempt' : scene.heading}</b><small>{scene.visuals?.map(visual => VISUAL_NAMES[visual.kind === 'figure' ? visual.mode : visual.kind] || visual.kind).join(' · ') || 'Reasoning'}</small></div>
                  </button>
                ))}
              </aside>
            </div>

            <footer className="pri-explain-controls">
              <div>
                <button className="btn btn-ghost btn-sm" type="button" onClick={restart}>↺ Restart</button>
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => { pausePlayback(); stepBack(); }} disabled={index === 0 && beat === 0 && !checkpointPassed}>‹ Back</button>
                <button className="btn btn-primary btn-sm" type="button" onClick={() => {
                  if (atFinished) restart();
                  else if (playing) pausePlayback();
                  else setPlaying(true);
                }} disabled={reduceMotion || checkpointPending}>{checkpointPending ? 'Your turn' : reduceMotion ? 'Motion reduced' : playing ? 'Pause' : atFinished ? 'Replay' : 'Play'}</button>
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => { pausePlayback(); stepForward(); }} disabled={atFinished}>{checkpointPending ? 'Continue ›' : 'Next ›'}</button>
              </div>
              <div className="pri-explain-settings">
                <label>Speed<select value={speed} onChange={event => setSpeed(Number(event.target.value))} aria-label="Explanation speed" disabled={reduceMotion}>
                  {SPEEDS.map(value => <option key={value} value={value}>{value}×</option>)}
                </select></label>
                <label className="pri-explain-voice"><input type="checkbox" checked={voice} disabled={!canSpeak()} onChange={event => setVoice(event.target.checked)} />Voice sync</label>
              </div>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
