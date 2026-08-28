import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MathText } from '../lib/latex.jsx';
import { buildVisualTimeline, visualSummary } from '../explain/visualEngine.js';
import { VisualBlock } from './PriExplainVisuals.jsx';

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
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function cancelSpeech() {
  if (canSpeak()) window.speechSynthesis.cancel();
}

function speak(scene, speed) {
  if (!canSpeak() || !scene) return;
  cancelSpeech();
  const source = scene.narration || [scene.heading, ...(scene.lines || [])].join('. ');
  const utterance = new SpeechSynthesisUtterance(speechText(source));
  utterance.lang = 'en-AU';
  utterance.rate = Math.max(0.75, Math.min(1.4, 0.96 * speed));
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

function beatDelay(line, first, hasVisuals) {
  const chars = speechText(line).length;
  return Math.max(900, Math.min(3000, 680 + chars * 25 + (first && hasVisuals ? 480 : 0)));
}

function holdDelay(scene) {
  if (scene?.visuals?.some(visual => visual.kind === 'ink')) return 2100;
  if (scene?.visuals?.length) return 1450;
  return 950;
}

function initialReduceMotion() {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
}

const VISUAL_NAMES = {
  transform: 'Equation motion', ink: 'Ink replay', graph: 'Graph draw', geometry: 'Geometry build',
  calculus: 'Calculus region', statistics: 'Data visual', figure: 'Diagram build', attempt: 'Working replay',
  checkpoint: 'Pause + predict', focus: 'Math focus',
};

export default function PriExplain({ questionId, questionPrompt, questionFigure }) {
  const [payload, setPayload] = useState(null);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [beat, setBeat] = useState(0);
  const [checkpointPassed, setCheckpointPassed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [voice, setVoice] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(initialReduceMotion);
  const timerRef = useRef(null);
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
  const hasCheckpoint = Boolean(current?.visuals?.some(visual => visual.kind === 'checkpoint'));
  const checkpointPending = sceneComplete && hasCheckpoint && !checkpointPassed;
  const atEnd = timeline.length > 0 && index === timeline.length - 1;
  const atFinished = atEnd && sceneComplete && !checkpointPending;
  const visualKinds = useMemo(() => visualSummary(timeline), [timeline]);

  const goScene = (nextIndex, revealAll = false) => {
    if (!timeline.length) return;
    const bounded = Math.max(0, Math.min(nextIndex, timeline.length - 1));
    setIndex(bounded);
    setBeat(revealAll ? (timeline[bounded]?.lines?.length || 0) : 0);
    setCheckpointPassed(false);
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
      if (event.matches) setPlaying(false);
    };
    query.addEventListener?.('change', onChange);
    return () => query.removeEventListener?.('change', onChange);
  }, []);

  useEffect(() => {
    wrongRef.current = null;
    setPayload(null);
    setOpen(false);
    setIndex(0);
    setBeat(0);
    setCheckpointPassed(false);
    setPlaying(false);
    setVoice(false);
    cancelSpeech();
  }, [questionId]);

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
    if (!open || !playing || !current || reduceMotion) return undefined;

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
  }, [open, playing, current, atEnd, checkpointPending, index, beat, lineCount, speed, reduceMotion]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || !voice || !current) return undefined;
    speak(current, speed);
    return cancelSpeech;
  }, [open, voice, current, speed]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = event => {
      if (event.key === 'Escape') {
        setOpen(false); setPlaying(false); cancelSpeech();
        setTimeout(() => launchRef.current?.focus(), 0);
      } else if (event.key === 'ArrowRight') {
        setPlaying(false); stepForward();
      } else if (event.key === 'ArrowLeft') {
        setPlaying(false); stepBack();
      } else if (event.key === ' ' && !['BUTTON', 'SELECT', 'INPUT'].includes(event.target?.tagName)) {
        event.preventDefault();
        if (checkpointPending) stepForward();
        else if (atFinished) restart();
        else setPlaying(value => !value);
      }
    };
    window.addEventListener('keydown', onKey);
    setTimeout(() => dialogRef.current?.focus(), 0);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, index, beat, lineCount, checkpointPending, checkpointPassed, atFinished, reduceMotion]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => cancelSpeech(), []);

  if (!payload || !timeline.length) return null;

  const sceneFraction = lineCount ? Math.min(1, revealedLines / lineCount) : 1;
  const progress = Math.min(100, ((index + sceneFraction) / timeline.length) * 100);
  const status = checkpointPending
    ? 'Your turn · predict before continuing'
    : atFinished
      ? 'Complete'
      : playing
        ? (beat < lineCount ? 'Writing the next line' : 'Moving to the next step')
        : 'Paused';
  const close = () => {
    setOpen(false); setPlaying(false); cancelSpeech();
    setTimeout(() => launchRef.current?.focus(), 0);
  };

  return (
    <>
      <style>{STYLES}</style>
      <button ref={launchRef} className="pri-explain-launch no-print" type="button"
        onClick={() => { setOpen(true); setBeat(0); setCheckpointPassed(false); setPlaying(!reduceMotion); }} aria-haspopup="dialog">
        <span className="pri-explain-play" aria-hidden="true">▶</span>
        <span><b>Watch explanation</b><small>{visualKinds.length ? 'Animated teacher-style working' : 'Animated worked solution'}</small></span>
      </button>

      {open && (
        <div className="pri-explain-backdrop no-print" role="presentation" onMouseDown={event => event.target === event.currentTarget && close()}>
          <section className="pri-explain-dialog" role="dialog" aria-modal="true"
            aria-label="Animated worked solution" tabIndex={-1} ref={dialogRef}>
            <header className="pri-explain-head">
              <div>
                <div className="pri-explain-kicker">Pri Explain · Board Mode V4</div>
                <h2>Watch the solution unfold like a teacher is working it out</h2>
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
              <div><span>Step {index + 1} of {timeline.length}{lineCount ? ` · line ${Math.min(revealedLines + 1, lineCount)} of ${lineCount}` : ''}</span><span>{status}</span></div>
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
                  {!!current.visuals?.length && (
                    <div className="pri-explain-visuals" key={`visual-${current.id}-${index}`}>
                      {current.visuals.map((visual, visualIndex) => <VisualBlock key={`${current.id}-${visual.kind}-${visualIndex}`} visual={visual} />)}
                    </div>
                  )}
                  <div className="pri-explain-lines">
                    {(current.lines || []).slice(0, revealedLines).map((line, lineIndex) => (
                      <div key={`${current.id}-${lineIndex}`} className="pri-explain-line" style={{ '--delay': `${lineIndex * 45}ms` }}>
                        <span className="pri-explain-line-number" aria-hidden="true">{lineIndex + 1}</span>
                        <MathText text={line} />
                      </div>
                    ))}
                    {!reduceMotion && revealedLines < lineCount && (
                      <div className="pri-explain-writing" aria-hidden="true"><i /><span>working…</span></div>
                    )}
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
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => { setPlaying(false); stepBack(); }} disabled={index === 0 && beat === 0 && !checkpointPassed}>‹ Back</button>
                <button className="btn btn-primary btn-sm" type="button" onClick={() => {
                  if (atFinished) restart(); else setPlaying(value => !value);
                }} disabled={reduceMotion || checkpointPending}>{checkpointPending ? 'Your turn' : reduceMotion ? 'Motion reduced' : playing ? 'Pause' : atFinished ? 'Replay' : 'Play'}</button>
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => { setPlaying(false); stepForward(); }} disabled={atFinished}>{checkpointPending ? 'Continue ›' : 'Next ›'}</button>
              </div>
              <div className="pri-explain-settings">
                <label>Speed<select value={speed} onChange={event => setSpeed(Number(event.target.value))} aria-label="Explanation speed" disabled={reduceMotion}>
                  {SPEEDS.map(value => <option key={value} value={value}>{value}×</option>)}
                </select></label>
                <label className="pri-explain-voice"><input type="checkbox" checked={voice} disabled={!canSpeak()} onChange={event => setVoice(event.target.checked)} />Voice</label>
              </div>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}

const STYLES = `
.pri-explain-launch{position:fixed;right:28px;bottom:88px;z-index:72;display:flex;align-items:center;gap:10px;border:1px solid var(--gold-border);background:var(--surface);color:var(--ink);box-shadow:var(--shadow-sm);border-radius:10px;padding:10px 14px;font:inherit;cursor:pointer;animation:priExplainArrive .28s ease both}.pri-explain-launch:hover{background:var(--surface-2);transform:translateY(-1px)}.pri-explain-launch small{display:block;color:var(--ink-3);font-size:11px;margin-top:2px}.pri-explain-play{display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:var(--gold);color:#15130d;font-size:12px;padding-left:2px}.pri-explain-backdrop{position:fixed;inset:0;z-index:1100;display:grid;place-items:center;padding:14px;background:rgba(0,0,0,.76);backdrop-filter:blur(9px)}.pri-explain-dialog{width:min(1160px,100%);height:min(900px,95vh);overflow:hidden;background:var(--surface);color:var(--ink);border:1px solid var(--hairline-strong);box-shadow:0 26px 90px rgba(0,0,0,.6);border-radius:12px;display:grid;grid-template-rows:auto auto auto 1fr auto;outline:none}.pri-explain-head{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;padding:18px 20px 10px}.pri-explain-head h2{font-size:22px;line-height:1.18;margin:3px 0 0;max-width:720px}.pri-explain-kicker,.pri-explain-question>span,.pri-explain-final>span,.pri-explain-step-label{font-size:10.5px;text-transform:uppercase;letter-spacing:.12em;color:var(--ink-3);font-weight:700}.pri-explain-kicker{color:var(--gold-bright)}.pri-explain-capabilities{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.pri-explain-capabilities span{font-size:10px;border:1px solid var(--hairline);background:var(--surface-2);color:var(--ink-2);padding:3px 7px;border-radius:20px}.pri-explain-question{margin:0 20px 12px;padding:10px 13px;border:1px solid var(--hairline);background:var(--surface-2);border-radius:7px;display:grid;gap:5px}.pri-explain-progress{padding:0 20px 12px}.pri-explain-progress>div{display:flex;justify-content:space-between;gap:12px;color:var(--ink-3);font-size:11px;margin-bottom:7px}.pri-explain-progress>i{display:block;height:5px;background:var(--surface-3);overflow:hidden;border-radius:9px}.pri-explain-progress>i>b{display:block;height:100%;background:var(--gold);transition:width .25s ease}.pri-explain-layout{min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 268px;border-top:1px solid var(--hairline);border-bottom:1px solid var(--hairline)}.pri-explain-stage{min-height:0;overflow:auto;padding:24px 26px;background:linear-gradient(180deg,var(--surface),var(--surface-2))}.pri-explain-scene{min-height:360px;padding:22px 24px;border:1px solid var(--hairline);background:var(--surface);border-radius:10px;box-shadow:0 8px 32px rgba(0,0,0,.12);animation:priBoardScene .3s ease both}.pri-explain-scene.diagnosis{border-left:3px solid var(--warn)}.pri-explain-step-label{display:flex;justify-content:space-between;align-items:center;gap:8px}.pri-explain-step-label em{font-style:normal;color:var(--gold);letter-spacing:.08em}.pri-explain-scene h3{font-size:19px;line-height:1.3;margin:8px 0 14px}.pri-explain-lines{display:grid;gap:0;margin-top:8px}.pri-explain-line{position:relative;display:grid;grid-template-columns:28px minmax(0,1fr);align-items:start;gap:9px;padding:11px 4px 12px 0;border-bottom:1px solid var(--hairline-faint);font-size:15px;line-height:1.55;animation:priBoardWrite .5s cubic-bezier(.2,.7,.2,1) both;animation-delay:var(--delay)}.pri-explain-line-number{display:grid;place-items:center;width:23px;height:23px;margin-top:1px;border:1px solid var(--hairline);border-radius:50%;color:var(--ink-3);font:700 10px/1 var(--font-mono)}.pri-explain-writing{height:38px;display:flex;align-items:center;gap:8px;color:var(--ink-3);font-size:11px}.pri-explain-writing i{display:block;width:34px;height:2px;background:var(--gold);transform-origin:left;animation:priWritingPulse 1s ease-in-out infinite}.pri-explain-visuals{display:grid;gap:12px;margin:12px 0 15px}.pri-explain-final{margin-top:14px;padding:17px 19px;border:1px solid var(--gold-border);background:var(--gold-soft);border-radius:9px;animation:priExplainFinal .35s ease both}.pri-explain-final strong{display:block;font-size:21px;margin-top:7px}.pri-explain-rail{min-height:0;overflow:auto;border-left:1px solid var(--hairline);background:var(--surface-2);padding:15px 12px}.pri-explain-rail-title{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--ink-3);margin:0 5px 10px}.pri-explain-rail button{width:100%;display:grid;grid-template-columns:28px 1fr;align-items:start;gap:8px;text-align:left;border:1px solid transparent;background:transparent;color:var(--ink-2);padding:10px 8px;border-radius:7px;cursor:pointer;font:inherit;font-size:12px;margin-bottom:4px}.pri-explain-rail button:hover,.pri-explain-rail button.on{background:var(--surface-3);color:var(--ink);border-color:var(--hairline)}.pri-explain-rail button.on{border-color:var(--gold-border)}.pri-explain-rail button>span{display:grid;place-items:center;width:23px;height:23px;border:1px solid var(--hairline);border-radius:50%;font-size:10px}.pri-explain-rail button.done>span{border-color:var(--gold-border);color:var(--gold-bright)}.pri-explain-rail button b{display:block;font-weight:600;line-height:1.3}.pri-explain-rail button small{display:block;color:var(--ink-3);font-size:10px;line-height:1.25;margin-top:3px}.pri-explain-controls{padding:13px 20px 16px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}.pri-explain-controls>div{display:flex;gap:7px;align-items:center;flex-wrap:wrap}.pri-explain-settings label{display:flex;align-items:center;gap:6px;color:var(--ink-2);font-size:12px}.pri-explain-settings select{background:var(--surface-2);color:var(--ink);border:1px solid var(--hairline);border-radius:5px;padding:5px}.pri-explain-voice input{accent-color:var(--gold)}
.pri-v-transform{position:relative;padding:17px;border:1px solid var(--gold-border);background:linear-gradient(180deg,var(--gold-soft),transparent);border-radius:9px;overflow:hidden}.pri-v-transform-math{font-size:21px;text-align:center;padding:8px 4px}.pri-v-transform-math.before{animation:priVBefore .5s ease both}.pri-v-transform-math.after{animation:priVAfter .62s .2s cubic-bezier(.2,.8,.2,1) both}.pri-v-tokenstrip{display:flex;justify-content:center;align-items:center;gap:3px;flex-wrap:wrap;min-height:29px;margin:3px 0}.pri-v-tokenstrip span{font-family:var(--font-mono);font-size:11px;padding:4px 5px;border-radius:4px;transition:.25s ease}.pri-v-tokenstrip span.same{color:var(--ink-3)}.pri-v-tokenstrip span.changed{color:var(--gold-bright);background:var(--gold-soft);border:1px solid var(--gold-border);animation:priVTerm .5s ease both}.pri-v-transform-arrow{display:grid;place-items:center;position:relative;height:45px;color:var(--gold)}.pri-v-transform-arrow i{position:absolute;width:1px;height:32px;background:var(--gold);animation:priVArrow .42s ease both}.pri-v-transform-arrow span{position:absolute;right:calc(50% + 14px);font-size:10px;text-transform:uppercase;letter-spacing:.09em;color:var(--ink-3);white-space:nowrap}.pri-v-transform-arrow b{font-size:17px;transform:translateY(13px)}
.pri-v-caption{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:9px;font-size:10px;text-transform:uppercase;letter-spacing:.09em;color:var(--ink-3)}.pri-v-caption b{font-weight:500;color:var(--gold)}.pri-v-ink,.pri-v-figure,.pri-v-attempt{padding:14px;border:1px solid var(--hairline);background:var(--surface);border-radius:8px}.pri-v-ink svg{display:block;width:100%;height:min(250px,32vh);background:radial-gradient(circle at 20% 20%,var(--surface-2),var(--surface));border-radius:6px;overflow:visible}.pri-v-ink path{fill:none;stroke:var(--ink);stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1;stroke-dashoffset:1;animation:priInkDraw .72s linear forwards;animation-delay:var(--stroke-delay)}.pri-v-ink path.scribble{stroke:var(--warn);stroke-width:1.8}.pri-v-recognized{margin-top:9px;display:grid;grid-template-columns:auto 1fr;gap:9px;align-items:center;font-size:12px}.pri-v-recognized>span,.pri-v-attempt>span{font-size:10px;text-transform:uppercase;letter-spacing:.09em;color:var(--ink-3)}.pri-v-attempt{display:grid;gap:8px;border-left:3px solid var(--warn)}.pri-v-figure-inner{display:grid;place-items:center;min-height:180px;overflow:hidden}.pri-v-figure-inner svg{max-height:310px;max-width:100%}.pri-v-figure-inner svg path,.pri-v-figure-inner svg line,.pri-v-figure-inner svg polyline,.pri-v-figure-inner svg circle,.pri-v-figure-inner svg rect,.pri-v-figure-inner svg polygon{transform-origin:center;transform-box:fill-box}.pri-v-figure-inner svg path,.pri-v-figure-inner svg line,.pri-v-figure-inner svg polyline{stroke-dasharray:1400;stroke-dashoffset:1400;animation:priFigDraw 1.25s ease forwards}.pri-v-figure-inner svg line:nth-of-type(n+2),.pri-v-figure-inner svg path:nth-of-type(n+2){animation-delay:.12s}.pri-v-figure-inner svg circle{opacity:0;animation:priFigPoint .35s .65s ease forwards}.pri-v-figure-inner svg text{opacity:0;animation:priFigText .35s .8s ease forwards}.pri-v-figure.calculus .pri-v-figure-inner svg polygon,.pri-v-figure.calculus .pri-v-figure-inner svg path[fill]:not([fill="none"]){fill-opacity:0;animation:priFigArea .8s .7s ease forwards}.pri-v-figure.geometry .pri-v-figure-inner svg polygon{animation:priGeoPop .5s .45s ease both}
@keyframes priExplainArrive{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}@keyframes priBoardScene{from{opacity:0;transform:translateY(8px) scale(.995)}to{opacity:1;transform:none}}@keyframes priBoardWrite{from{opacity:.25;clip-path:inset(0 100% 0 0);transform:translateY(3px)}to{opacity:1;clip-path:inset(0 0 0 0);transform:none}}@keyframes priWritingPulse{0%,100%{transform:scaleX(.35);opacity:.35}50%{transform:scaleX(1);opacity:1}}@keyframes priExplainFinal{from{opacity:0;transform:scale(.98)}to{opacity:1;transform:none}}@keyframes priVBefore{from{opacity:0;transform:translateY(-7px)}to{opacity:.68;transform:none}}@keyframes priVAfter{from{opacity:0;transform:translateY(12px) scale(.97)}to{opacity:1;transform:none}}@keyframes priVTerm{0%{transform:translateY(-8px);opacity:.2}65%{transform:translateY(2px)}100%{transform:none;opacity:1}}@keyframes priVArrow{from{height:0;opacity:.2}to{height:32px;opacity:1}}@keyframes priInkDraw{to{stroke-dashoffset:0}}@keyframes priFigDraw{to{stroke-dashoffset:0}}@keyframes priFigPoint{from{opacity:0;transform:scale(.3)}to{opacity:1;transform:scale(1)}}@keyframes priFigText{to{opacity:1}}@keyframes priFigArea{to{fill-opacity:.22}}@keyframes priGeoPop{from{opacity:.2;transform:scale(.95)}to{opacity:1;transform:none}}
@media(max-width:820px){.pri-explain-launch{right:12px;bottom:82px}.pri-explain-dialog{height:97vh}.pri-explain-layout{grid-template-columns:1fr}.pri-explain-rail{display:none}.pri-explain-controls{align-items:flex-start}.pri-explain-stage{padding:14px}.pri-explain-scene{min-height:300px;padding:18px 16px}.pri-explain-head,.pri-explain-progress,.pri-explain-controls{padding-left:14px;padding-right:14px}.pri-explain-question{margin-left:14px;margin-right:14px}.pri-v-transform-math{font-size:17px}.pri-v-caption{align-items:flex-start;flex-direction:column;gap:2px}}
@media(prefers-reduced-motion:reduce){.pri-explain-launch,.pri-explain-scene,.pri-explain-line,.pri-explain-writing i,.pri-explain-final,.pri-v-transform-math,.pri-v-tokenstrip span.changed,.pri-v-transform-arrow i,.pri-v-ink path,.pri-v-figure-inner svg path,.pri-v-figure-inner svg line,.pri-v-figure-inner svg polyline,.pri-v-figure-inner svg circle,.pri-v-figure-inner svg text,.pri-v-figure-inner svg polygon{animation:none!important;transition:none!important;clip-path:none!important;stroke-dashoffset:0!important;opacity:1!important;transform:none!important}.pri-v-figure.calculus .pri-v-figure-inner svg polygon,.pri-v-figure.calculus .pri-v-figure-inner svg path[fill]:not([fill="none"]){fill-opacity:.22!important}}
`;
