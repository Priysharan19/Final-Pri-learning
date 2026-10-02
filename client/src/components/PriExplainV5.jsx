import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MathText } from '../lib/latex.jsx';
import { buildVisualTimeline, visualSummary } from '../explain/visualEngine.js';
import { visualCuePlan, visualCueState, visualProgressForCue } from '../explain/choreography.js';
import { adaptiveCheckpointKey, buildTeachingProfile, teachingTimingScale, whyThisStepKey } from '../explain/adaptiveTeaching.js';
import { narrationPlan, speechText } from '../explain/speech.js';
import { translateEnglish, useLanguage } from '../i18n/index.js';
import { useApp } from '../App.jsx';
import { localeOf } from '../lib/locale.js';
import { VisualBlock } from './PriExplainVisuals.jsx';
import './PriExplainV5.css';
import './PriExplainV7.css';
import './PriExplainV8.css';

const SOLUTION_EVENT = 'pri:worked-solution';
const ATTEMPT_EVENT = 'pri:attempt-feedback';
const SPEEDS = [0.8, 1, 1.2, 1.4];

function canSpeak() {
  return typeof window !== 'undefined'
    && 'speechSynthesis' in window
    && typeof SpeechSynthesisUtterance !== 'undefined';
}

function cancelSpeech() {
  if (canSpeak()) window.speechSynthesis.cancel();
}

function speakBeat(textFor, speed, language, region, onDone) {
  if (!canSpeak()) {
    onDone?.();
    return () => {};
  }
  // Narration follows the interface language: en-IN for an Indian English
  // reader (en-AU on the Australian branch), hi-IN for Hindi, degrading to
  // another voice of that language and then to English — see explain/speech.js.
  // When it has had to fall back to an English voice, it speaks the English
  // caption too: Hindi text read by an English voice is noise, not teaching.
  const choice = narrationPlan(window.speechSynthesis.getVoices?.() || [], language, { region });
  const text = speechText(textFor(choice.spoken), choice.spoken);
  if (!text) {
    onDone?.();
    return () => {};
  }

  cancelSpeech();
  const utterance = new SpeechSynthesisUtterance(text);
  // The tag is set even with no voice listed, so the platform can still
  // choose one for the language.
  utterance.lang = choice.lang;
  if (choice.voice) utterance.voice = choice.voice;
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

// Catalogue keys, resolved with t() at render so they follow the language.
const VISUAL_NAME_KEYS = {
  transform: 'explain.visual.transform', ink: 'explain.visual.ink', graph: 'explain.visual.graph',
  plot: 'explain.visual.plot', geometry: 'explain.visual.geometry', calculus: 'explain.visual.calculus',
  statistics: 'explain.visual.statistics', figure: 'explain.visual.figure', attempt: 'explain.visual.attempt',
  checkpoint: 'explain.visual.checkpoint', focus: 'explain.visual.focus',
};
const CONCEPT_KEYS = {
  algebra: 'explain.concept.algebra', calculus: 'explain.concept.calculus', graph: 'explain.concept.graph',
  geometry: 'explain.concept.geometry', statistics: 'explain.concept.statistics', figure: 'explain.concept.figure',
  diagnosis: 'explain.concept.diagnosis',
};

export default function PriExplainV5({ questionId, questionPrompt, questionFigure, studentContext = {}, onTrySimilar }) {
  const { t, language } = useLanguage();
  const app = useApp();
  const region = app?.user ? localeOf(app.user).split('-')[1] : undefined;
  const visualName = kind => (VISUAL_NAME_KEYS[kind] ? t(VISUAL_NAME_KEYS[kind]) : kind);
  // Pri's own captions carry a catalogue key and are shown and spoken in the
  // student's language; a heading or line that came from the verified solution
  // has none and is shown exactly as the engine wrote it.
  const headingIn = (scene, tr) => (scene?.headingKey ? tr(scene.headingKey, { n: scene.headingVars?.n ?? '' }) : scene?.heading || '');
  const lineIn = (scene, i, tr) => (scene?.lineKeys?.[i] ? tr(scene.lineKeys[i]) : scene?.lines?.[i] || '');
  const headingOf = scene => headingIn(scene, t);
  const lineOf = (scene, i) => lineIn(scene, i, t);
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
    // The storyboard validator re-derives any graph from these, so a plotted
    // curve can only be one the question or its verified solution states.
    solutionText: payload?.solution?.solutionText,
    solutionSteps: payload?.solution?.steps,
    subtopic: payload?.subtopic,
    chapterId: payload?.chapterId,
    wrongAttempt: payload?.wrongAttempt || wrongRef.current?.submission || null,
  }), [payload, questionPrompt, questionFigure]);

  const teaching = useMemo(() => buildTeachingProfile({ payload, studentContext, timeline }), [payload, studentContext, timeline]);
  const current = timeline[index] || null;
  const lineCount = current?.lines?.length || 0;
  const revealedLines = reduceMotion ? lineCount : Math.min(beat, lineCount);
  const sceneComplete = reduceMotion || beat >= lineCount;
  const visualCues = useMemo(() => visualCuePlan(current?.visuals || [], lineCount), [current, lineCount]);
  const hasAuthoredCheckpoint = Boolean(current?.visuals?.some(visual => visual.kind === 'checkpoint'));
  const adaptivePromptKey = adaptiveCheckpointKey(current, teaching, index);
  const adaptivePrompt = adaptivePromptKey ? t(adaptivePromptKey) : '';
  const hasAdaptiveCheckpoint = Boolean(adaptivePrompt) && !hasAuthoredCheckpoint;
  const checkpointPending = sceneComplete && (hasAuthoredCheckpoint || hasAdaptiveCheckpoint) && !checkpointPassed;
  const atEnd = timeline.length > 0 && index === timeline.length - 1;
  const atFinished = atEnd && sceneComplete && !checkpointPending;
  const visualKinds = useMemo(() => visualSummary(timeline), [timeline]);
  const timingScale = teachingTimingScale(teaching, index);
  const keyTeachingStep = index === teaching.importantSceneIndex;
  const whyStepKey = whyThisStepKey(current, teaching, index);
  const whyStep = whyStepKey ? t(whyStepKey) : '';

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
      timerRef.current = setTimeout(() => goScene(index + 1, false), holdDelay(current) * timingScale / speed);
    };

    if (voice && canSpeak()) {
      const lineIndex = Math.min(beat - 1, Math.max(0, lineCount - 1));
      const textFor = spoken => {
        const tr = spoken === language ? t : translateEnglish;
        return beat === 0 ? headingIn(current, tr) : lineIn(current, lineIndex, tr) || headingIn(current, tr);
      };
      setNarrating(true);
      speechCancelRef.current = speakBeat(textFor, speed * teaching.voiceRate, language, region, advanceAfterNarration);
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
        beatDelay(line, beat === 0, Boolean(current.visuals?.length)) * timingScale / speed,
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

    timerRef.current = setTimeout(() => goScene(index + 1, false), holdDelay(current) * timingScale / speed);
    return () => clearTimeout(timerRef.current);
  }, [open, playing, current, atEnd, checkpointPending, index, beat, lineCount, speed, reduceMotion, voice, timingScale, teaching.voiceRate, language, region]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const status = t(checkpointPending
    ? 'explain.status.yourTurn'
    : atFinished
      ? 'explain.status.complete'
      : playing
        ? narrating
          ? 'explain.status.narrating'
          : beat < lineCount ? 'explain.status.teaching' : 'explain.status.moving'
        : 'explain.status.paused');
  const modeLabel = t(teaching.labelKey);
  const focusLabel = teaching.focus?.labelKey ? t(teaching.focus.labelKey) : teaching.focus?.label;
  const focusMessage = teaching.focus?.messageKey ? t(teaching.focus.messageKey, { n: teaching.focus.messageVars?.n ?? '' }) : teaching.focus?.message;
  const activeLine = revealedLines > 0 ? revealedLines - 1 : -1;

  const close = () => {
    setOpen(false);
    pausePlayback();
    cancelSpeech();
    setTimeout(() => launchRef.current?.focus(), 0);
  };

  const trySimilar = () => {
    close();
    onTrySimilar?.();
  };

  return (
    <>
      <button ref={launchRef} className="pri-explain-launch no-print" type="button"
        onClick={() => { setOpen(true); setBeat(0); setCheckpointPassed(false); setPlaying(!reduceMotion); }} aria-haspopup="dialog">
        <span className="pri-explain-play" aria-hidden="true">▶</span>
        <span><b>{t('explain.launch')}</b><small>{t(visualKinds.length ? 'explain.launchVisual' : 'explain.launchAnimated', { mode: modeLabel })}</small></span>
      </button>

      {open && (
        <div className="pri-explain-backdrop no-print" role="presentation" onMouseDown={event => event.target === event.currentTarget && close()}>
          <section className="pri-explain-dialog" role="dialog" aria-modal="true" aria-label={t('explain.dialogLabel')} tabIndex={-1} ref={dialogRef}>
            <header className="pri-explain-head">
              <div>
                <div className="pri-explain-kicker">{t('explain.kicker')}</div>
                <h2>{t('explain.title')}</h2>
                {!!visualKinds.length && <div className="pri-explain-capabilities" aria-label={t('explain.capabilities')}>
                  {visualKinds.map(kind => <span key={kind}>{visualName(kind)}</span>)}
                </div>}
              </div>
              <button className="btn btn-quiet btn-sm" type="button" onClick={close} aria-label={t('explain.close')}>✕</button>
            </header>

            <div className="pri-explain-question">
              <span>{t('explain.question')}</span>
              <MathText text={questionPrompt || t('explain.workedSolution')} />
            </div>

            <div className="pri-explain-adaptive" data-mode={teaching.mode} aria-label={t('explain.planLabel', { label: modeLabel })}>
              <span>{modeLabel}</span>
              <div>
                <b>{t(teaching.reasonKey)}</b>
                <small>{t('explain.presentationOnly')}</small>
              </div>
              {teaching.focus && (
                <div className="pri-explain-adaptive-focus">
                  <strong>{t(teaching.focus.kind === 'misconception' ? 'explain.focusMisconception' : teaching.focus.kind === 'diagnosis' ? 'explain.focusDiagnosis' : 'explain.focusAttempt')} · <MathText text={focusLabel} /></strong>
                  {focusMessage && <p><MathText text={focusMessage} /></p>}
                  {teaching.focus.fix && <em><MathText text={teaching.focus.fix} /></em>}
                </div>
              )}
            </div>

            <div className="pri-explain-progress" aria-label={t('explain.stepOf', { n: index + 1, total: timeline.length })}>
              <div><span>{lineCount
                ? t('explain.stepOfBeat', { n: index + 1, total: timeline.length, beat: Math.min(revealedLines + 1, lineCount), beats: lineCount })
                : t('explain.stepOf', { n: index + 1, total: timeline.length })}</span><span>{status}</span></div>
              <i><b style={{ width: `${progress}%` }} /></i>
            </div>

            <div className="pri-explain-layout">
              <div className="pri-explain-stage" aria-live="polite">
                <article key={`${current.id}-${index}`} className={`pri-explain-scene active ${current.kind} ${keyTeachingStep ? 'key-teaching-step' : ''}`}>
                  <div className="pri-explain-step-label">
                    {current.kind === 'diagnosis' ? t('explain.replayDiagnosis') : t('explain.scene.step', { n: current.number })}
                    {current.concept && current.concept !== 'generic' && <em>{CONCEPT_KEYS[current.concept] ? t(CONCEPT_KEYS[current.concept]) : current.concept}</em>}
                    {keyTeachingStep && <span className="pri-explain-key-badge">{t('explain.keyStep')}</span>}
                  </div>
                  <h3><MathText text={headingOf(current)} /></h3>
                  {whyStep && <div className="pri-explain-why-step"><b>{t('explain.whyMatters')}</b>{whyStep}</div>}

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
                              {cueState === 'active' && visual.kind !== 'checkpoint' && <span className="pri-explain-now" aria-hidden="true">{t('explain.now')}</span>}
                              <VisualBlock visual={visual} progress={cueProgress} complete={sceneComplete} />
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="pri-explain-lines">
                      {playing && !checkpointPending && (
                        <div className={`pri-explain-teacher-cue ${narrating ? 'narrating' : ''}`} aria-hidden="true">
                          <i /><span>{t(narrating ? 'explain.teacherExplaining' : 'explain.teacherWorking')}</span>
                        </div>
                      )}
                      {(current.lines || []).slice(0, revealedLines).map((_, lineIndex) => (
                        <div key={`${current.id}-${lineIndex}`} className={`pri-explain-line ${lineIndex === activeLine ? 'current' : ''}`}>
                          <span className="pri-explain-line-number" aria-hidden="true">{lineIndex + 1}</span>
                          <MathText text={lineOf(current, lineIndex)} />
                        </div>
                      ))}
                      {!reduceMotion && revealedLines < lineCount && (
                        <div className="pri-explain-writing" aria-hidden="true"><i /><span>{t(voice && playing ? 'explain.listeningNext' : 'explain.preparingNext')}</span></div>
                      )}
                    </div>
                  </div>

                  {checkpointPending && hasAdaptiveCheckpoint && (
                    <div className="pri-v-checkpoint pri-explain-adaptive-retrieval" aria-label={t('explain.checkpointLabel')}>
                      <span>{t('explain.retrieval')}</span>
                      <strong>{adaptivePrompt}</strong>
                      <small>{t('explain.sayItOut')}</small>
                    </div>
                  )}
                </article>

                {atFinished && payload.solution?.answerText && (
                  <div className="pri-explain-final">
                    <span>{t('explain.finalAnswer')}</span>
                    <strong><MathText text={payload.solution.answerText} /></strong>
                    {teaching.shouldOfferFollowUp && onTrySimilar && (
                      <div className="pri-explain-followup">
                        <span>{t('explain.lockIn')}</span>
                        <button className="btn btn-primary btn-sm" type="button" onClick={trySimilar}>{t('explain.tryOne')}</button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <aside className="pri-explain-rail" aria-label={t('explain.timeline')}>
                <div className="pri-explain-rail-title">{t('explain.workedSolution')}</div>
                {timeline.map((scene, sceneIndex) => (
                  <button type="button" key={`nav-${scene.id}`}
                    className={`${sceneIndex === index ? 'on' : ''} ${sceneIndex < index ? 'done' : ''}`}
                    aria-current={sceneIndex === index ? 'step' : undefined}
                    onClick={() => { goScene(sceneIndex, true); setPlaying(false); }}>
                    <span>{sceneIndex < index ? '✓' : sceneIndex + 1}</span>
                    <div><b>{(() => {
                      const name = scene.kind === 'diagnosis' ? t('explain.yourAttempt') : headingOf(scene);
                      return sceneIndex === teaching.importantSceneIndex ? t('explain.railKeyed', { heading: name }) : name;
                    })()}</b><small>{scene.visuals?.map(visual => visualName(visual.kind === 'figure' ? visual.mode : visual.kind)).join(' · ') || t('explain.reasoning')}</small></div>
                  </button>
                ))}
              </aside>
            </div>

            <footer className="pri-explain-controls">
              <div>
                <button className="btn btn-ghost btn-sm" type="button" onClick={restart}>{t('explain.restart')}</button>
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => { pausePlayback(); stepBack(); }} disabled={index === 0 && beat === 0 && !checkpointPassed}>{t('explain.back')}</button>
                <button className="btn btn-primary btn-sm" type="button" onClick={() => {
                  if (atFinished) restart();
                  else if (playing) pausePlayback();
                  else setPlaying(true);
                }} disabled={reduceMotion || checkpointPending}>{t(checkpointPending ? 'explain.yourTurn' : reduceMotion ? 'explain.motionReduced' : playing ? 'explain.pause' : atFinished ? 'explain.replay' : 'explain.play')}</button>
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => { pausePlayback(); stepForward(); }} disabled={atFinished}>{t(checkpointPending ? 'explain.continue' : 'explain.next')}</button>
              </div>
              <div className="pri-explain-settings">
                <label>{t('explain.speed')}<select value={speed} onChange={event => setSpeed(Number(event.target.value))} aria-label={t('explain.speedLabel')} disabled={reduceMotion}>
                  {SPEEDS.map(value => <option key={value} value={value}>{value}×</option>)}
                </select></label>
                <label className="pri-explain-voice"><input type="checkbox" checked={voice} disabled={!canSpeak()} onChange={event => setVoice(event.target.checked)} />{t('explain.voiceSync')}</label>
              </div>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
