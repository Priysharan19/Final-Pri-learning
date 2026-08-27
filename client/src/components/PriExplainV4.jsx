import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MathText } from '../lib/latex.jsx';
import { buildVisualTimeline, compileStoryboard, visualSummary } from '../explain/visualEngine.js';
import { buildDirectorBranch } from '../explain/teachingDirector.js';
import { VisualBlock } from './PriExplainVisuals.jsx';
import './PriExplainV4.css';

const SOLUTION_EVENT = 'pri:worked-solution';
const ATTEMPT_EVENT = 'pri:attempt-feedback';
const SPEEDS = [0.8, 1, 1.2, 1.4];

const VISUAL_NAMES = {
  transform: 'Equation motion',
  focus: 'Math focus',
  checkpoint: 'Prediction checkpoint',
  ink: 'Ink replay',
  graph: 'Graph draw',
  geometry: 'Geometry build',
  calculus: 'Calculus region',
  statistics: 'Data visual',
  figure: 'Diagram build',
  attempt: 'Working replay',
};

const BRANCH_LABELS = {
  why: 'Why this step?',
  slower: 'Show it slower',
  notice: 'What should I notice?',
};

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
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function cancelSpeech() {
  if (canSpeak()) window.speechSynthesis.cancel();
}

function speak(scene, speed) {
  if (!canSpeak() || !scene) return;
  cancelSpeech();
  const spoken = scene.narration || [scene.heading, ...(scene.lines || [])].join('. ');
  const utterance = new SpeechSynthesisUtterance(speechText(spoken));
  utterance.lang = 'en-AU';
  utterance.rate = Math.max(0.75, Math.min(1.4, 0.96 * speed));
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

function visualName(visual) {
  const key = visual?.kind === 'figure' ? visual.mode : visual?.kind;
  return VISUAL_NAMES[key] || key || 'Reasoning';
}

function BranchPanel({ branch, onClose }) {
  if (!branch?.timeline?.length) return null;
  return (
    <section className="pri-explain-branch" aria-label={`${BRANCH_LABELS[branch.intent] || 'Extra explanation'} branch`}>
      <div className="pri-explain-branch-head">
        <div>
          <span>Pri Teaching Director</span>
          <b>{BRANCH_LABELS[branch.intent] || 'Explore this step'}</b>
        </div>
        <button type="button" className="btn btn-quiet btn-sm" onClick={onClose} aria-label="Close extra explanation">✕</button>
      </div>
      <div className="pri-explain-branch-scenes">
        {branch.timeline.map((scene, index) => (
          <article key={`${branch.intent}-${scene.id}-${index}`}>
            <div className="pri-explain-branch-label">Branch {index + 1} of {branch.timeline.length}</div>
            <h4><MathText text={scene.heading} /></h4>
            {!!scene.visuals?.length && (
              <div className="pri-explain-visuals">
                {scene.visuals.map((visual, visualIndex) => (
                  <VisualBlock key={`${scene.id}-${visual.kind}-${visualIndex}`} visual={visual} />
                ))}
              </div>
            )}
            <div className="pri-explain-lines">
              {(scene.lines || []).map((line, lineIndex) => (
                <div key={`${scene.id}-line-${lineIndex}`} className="pri-explain-line">
                  <MathText text={line} />
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function PriExplainV4({ questionId, questionPrompt, questionFigure }) {
  const [payload, setPayload] = useState(null);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [voice, setVoice] = useState(false);
  const [branch, setBranch] = useState(null);
  const timerRef = useRef(null);
  const dialogRef = useRef(null);
  const launchRef = useRef(null);
  const wrongRef = useRef(null);

  const context = useMemo(() => ({
    ...payload,
    questionPrompt,
    questionFigure,
    wrongAttempt: payload?.wrongAttempt || wrongRef.current?.submission || null,
  }), [payload, questionPrompt, questionFigure]);

  const timeline = useMemo(
    () => buildVisualTimeline(payload?.solution, context),
    [payload?.solution, context]
  );
  const current = timeline[index] || null;
  const atEnd = timeline.length > 0 && index === timeline.length - 1;
  const isCheckpoint = Boolean(current?.visuals?.some(visual => visual.kind === 'checkpoint'));
  const visualKinds = useMemo(() => visualSummary(timeline), [timeline]);

  const go = nextIndex => {
    if (!timeline.length) return;
    setBranch(null);
    setIndex(Math.max(0, Math.min(nextIndex, timeline.length - 1)));
  };

  const openBranch = intent => {
    if (!current || !payload?.solution) return;
    const storyboard = buildDirectorBranch(current, intent, payload.solution, context);
    if (!storyboard) return;
    const compiled = compileStoryboard(storyboard, payload.solution, context);
    if (!compiled.ok || !compiled.timeline.length) return;
    setPlaying(false);
    cancelSpeech();
    setBranch({ intent, timeline: compiled.timeline });
  };

  useEffect(() => {
    wrongRef.current = null;
    setPayload(null);
    setOpen(false);
    setIndex(0);
    setPlaying(false);
    setVoice(false);
    setBranch(null);
    cancelSpeech();
  }, [questionId]);

  useEffect(() => {
    const receiveAttempt = event => {
      const detail = event?.detail;
      if (String(detail?.questionId) !== String(questionId)) return;
      // Keep the first miss. A later retry must never rewrite the evidence the
      // director uses to explain where the original reasoning diverged.
      if (detail.correct === false && detail.submission && !wrongRef.current) {
        wrongRef.current = detail;
      }
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
      setBranch(null);
      setPlaying(false);
    };

    window.addEventListener(ATTEMPT_EVENT, receiveAttempt);
    window.addEventListener(SOLUTION_EVENT, receiveSolution);
    return () => {
      window.removeEventListener(ATTEMPT_EVENT, receiveAttempt);
      window.removeEventListener(SOLUTION_EVENT, receiveSolution);
    };
  }, [questionId]);

  useEffect(() => {
    clearTimeout(timerRef.current);
    if (!open || !playing || !current || branch) return undefined;
    // V4 checkpoints are genuine retrieval moments: autoplay stops before the
    // verified next line, and only an explicit reveal moves beyond the prompt.
    if (isCheckpoint || atEnd) {
      setPlaying(false);
      return undefined;
    }
    timerRef.current = setTimeout(() => go(index + 1), current.duration / speed);
    return () => clearTimeout(timerRef.current);
  }, [open, playing, current, isCheckpoint, atEnd, index, speed, branch]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || !voice || !current || branch) return undefined;
    speak(current, speed);
    return cancelSpeech;
  }, [open, voice, current, speed, branch]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = event => {
      if (event.key === 'Escape') {
        if (branch) { setBranch(null); return; }
        setOpen(false);
        setPlaying(false);
        cancelSpeech();
        setTimeout(() => launchRef.current?.focus(), 0);
      } else if (event.key === 'ArrowRight') {
        go(index + 1);
      } else if (event.key === 'ArrowLeft') {
        go(index - 1);
      } else if (event.key === ' ' && !['BUTTON', 'SELECT', 'INPUT'].includes(event.target?.tagName)) {
        event.preventDefault();
        if (!isCheckpoint) setPlaying(value => !value);
      }
    };
    window.addEventListener('keydown', onKey);
    setTimeout(() => dialogRef.current?.focus(), 0);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, index, branch, isCheckpoint]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => cancelSpeech(), []);

  if (!payload || !timeline.length) return null;

  const progress = ((index + 1) / timeline.length) * 100;
  const close = () => {
    setOpen(false);
    setPlaying(false);
    setBranch(null);
    cancelSpeech();
    setTimeout(() => launchRef.current?.focus(), 0);
  };

  const revealCheckpoint = () => {
    if (atEnd) return;
    go(index + 1);
    setPlaying(true);
  };

  return (
    <>
      <button
        ref={launchRef}
        className="pri-explain-launch no-print"
        type="button"
        onClick={() => { setOpen(true); setPlaying(true); }}
        aria-haspopup="dialog"
        aria-label="Watch explanation"
      >
        <span className="pri-explain-play" aria-hidden="true">▶</span>
        <span>
          <b>Watch explanation</b>
          <small>Personalised visual maths · your working · verified solution</small>
        </span>
      </button>

      {open && (
        <div className="pri-explain-backdrop no-print" role="presentation" onMouseDown={event => event.target === event.currentTarget && close()}>
          <section
            className="pri-explain-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Visual worked solution"
            tabIndex={-1}
            ref={dialogRef}
          >
            <header className="pri-explain-head">
              <div>
                <div className="pri-explain-kicker">Pri Explain · Teaching Director V4</div>
                <h2>See the maths change — and test yourself before it does</h2>
                {!!visualKinds.length && (
                  <div className="pri-explain-capabilities" aria-label="Visual explanation capabilities">
                    {visualKinds.map(kind => <span key={kind}>{VISUAL_NAMES[kind] || kind}</span>)}
                  </div>
                )}
              </div>
              <button className="btn btn-quiet btn-sm" type="button" onClick={close} aria-label="Close visual solution">✕</button>
            </header>

            <div className="pri-explain-question">
              <span>Question</span>
              <MathText text={questionPrompt || 'Worked solution'} />
            </div>

            <div className="pri-explain-progress" aria-label={`Step ${index + 1} of ${timeline.length}`}>
              <div>
                <span>Scene {index + 1} of {timeline.length}</span>
                <span>{isCheckpoint ? 'Prediction paused' : atEnd ? 'Final result' : playing ? 'Playing' : 'Paused'}</span>
              </div>
              <i><b style={{ width: `${progress}%` }} /></i>
            </div>

            <div className="pri-explain-layout">
              <div className="pri-explain-stage">
                {timeline.map((scene, sceneIndex) => {
                  if (sceneIndex > index) return null;
                  const active = sceneIndex === index;
                  const sceneCheckpoint = scene.visuals?.some(visual => visual.kind === 'checkpoint');
                  return (
                    <article key={scene.id} className={`pri-explain-scene ${active ? 'active' : 'past'} ${scene.kind} ${sceneCheckpoint ? 'checkpoint' : ''}`}>
                      <div className="pri-explain-step-label">
                        {scene.kind === 'diagnosis' ? 'Replay + diagnosis' : sceneCheckpoint ? 'Pause + predict' : `Step ${scene.number}`}
                        {scene.concept && scene.concept !== 'generic' && <em>{scene.concept}</em>}
                      </div>
                      <h3><MathText text={scene.heading} /></h3>

                      {active && !!scene.visuals?.length && (
                        <div className="pri-explain-visuals" key={`visual-${scene.id}-${index}`}>
                          {scene.visuals.map((visual, visualIndex) => (
                            <VisualBlock key={`${scene.id}-${visual.kind}-${visualIndex}`} visual={visual} />
                          ))}
                        </div>
                      )}

                      <div className="pri-explain-lines">
                        {(scene.lines || []).map((line, lineIndex) => (
                          <div key={`${scene.id}-${lineIndex}`} className="pri-explain-line" style={{ '--delay': `${lineIndex * 90}ms` }}>
                            <MathText text={line} />
                          </div>
                        ))}
                      </div>

                      {active && sceneCheckpoint && !atEnd && (
                        <div className="pri-explain-checkpoint-action">
                          <span>Commit to your prediction before Pri reveals the checked next step.</span>
                          <button className="btn btn-primary" type="button" onClick={revealCheckpoint}>Reveal next verified step ›</button>
                        </div>
                      )}

                      {active && !sceneCheckpoint && (
                        <div className="pri-explain-ask-row" aria-label="Explore this step">
                          <span>Ask Pri about this scene</span>
                          <div>
                            <button type="button" onClick={() => openBranch('why')}>Why this step?</button>
                            <button type="button" onClick={() => openBranch('slower')}>Show it slower</button>
                            <button type="button" onClick={() => openBranch('notice')}>What should I notice?</button>
                          </div>
                        </div>
                      )}

                      {active && <BranchPanel branch={branch} onClose={() => setBranch(null)} />}
                    </article>
                  );
                })}

                {atEnd && payload.solution?.answerText && (
                  <div className="pri-explain-final">
                    <span>Verified final answer</span>
                    <strong><MathText text={payload.solution.answerText} /></strong>
                  </div>
                )}
              </div>

              <aside className="pri-explain-rail" aria-label="Solution timeline">
                <div className="pri-explain-rail-title">Teaching timeline</div>
                {timeline.map((scene, sceneIndex) => (
                  <button
                    type="button"
                    key={`nav-${scene.id}`}
                    className={sceneIndex === index ? 'on' : ''}
                    onClick={() => { go(sceneIndex); setPlaying(false); }}
                  >
                    <span>{sceneIndex + 1}</span>
                    <div>
                      <b>{scene.kind === 'diagnosis' ? 'Your attempt' : scene.heading}</b>
                      <small>{scene.visuals?.map(visualName).join(' · ') || 'Reasoning'}</small>
                    </div>
                  </button>
                ))}
              </aside>
            </div>

            <footer className="pri-explain-controls">
              <div>
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => { go(0); setPlaying(true); }}>↺ Restart</button>
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => go(index - 1)} disabled={index === 0}>‹ Back</button>
                {isCheckpoint && !atEnd ? (
                  <button className="btn btn-primary btn-sm" type="button" onClick={revealCheckpoint}>Reveal next step</button>
                ) : (
                  <button className="btn btn-primary btn-sm" type="button" onClick={() => {
                    if (atEnd) { go(0); setPlaying(true); }
                    else setPlaying(value => !value);
                  }}>{playing ? 'Pause' : atEnd ? 'Replay' : 'Play'}</button>
                )}
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => go(index + 1)} disabled={atEnd}>Next ›</button>
              </div>
              <div className="pri-explain-settings">
                <label>
                  Speed
                  <select value={speed} onChange={event => setSpeed(Number(event.target.value))} aria-label="Explanation speed">
                    {SPEEDS.map(value => <option key={value} value={value}>{value}×</option>)}
                  </select>
                </label>
                <label className="pri-explain-voice">
                  <input type="checkbox" checked={voice} disabled={!canSpeak()} onChange={event => setVoice(event.target.checked)} />
                  Voice
                </label>
              </div>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
