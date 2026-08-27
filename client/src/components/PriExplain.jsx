import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MathText } from '../lib/latex.jsx';

const EVENT_NAME = 'pri:worked-solution';
const SPEEDS = [0.8, 1, 1.2, 1.4];

function splitDetail(value) {
  return String(value || '')
    .split(/\n+/)
    .map(s => s.trim())
    .filter(Boolean);
}

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

function estimateDuration(scene) {
  const chars = `${scene.heading} ${scene.lines.join(' ')}`.length;
  return Math.max(3200, Math.min(9000, 2300 + chars * 24 + scene.lines.length * 420));
}

function buildTimeline(solution, context) {
  const scenes = [];

  if (context?.correct === false && context?.feedback && !context?.revealed) {
    scenes.push({
      kind: 'diagnosis',
      heading: 'First, fix the mistake',
      lines: splitDetail(context.feedback),
    });
  }

  for (const [index, step] of (solution?.steps || []).entries()) {
    scenes.push({
      kind: 'solution',
      heading: String(step?.h || `Step ${index + 1}`),
      lines: splitDetail(step?.d || ''),
    });
  }

  if (!scenes.length && solution?.answerText) {
    scenes.push({ kind: 'solution', heading: 'Work to the result', lines: [] });
  }

  return scenes.map((scene, index) => ({
    ...scene,
    id: `${scene.kind}-${index}`,
    number: index + 1,
    duration: estimateDuration(scene),
  }));
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
  const utterance = new SpeechSynthesisUtterance(
    speechText([scene.heading, ...scene.lines].join('. '))
  );
  utterance.lang = 'en-AU';
  utterance.rate = Math.max(0.75, Math.min(1.4, 0.96 * speed));
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

export default function PriExplain({ questionId, questionPrompt }) {
  const [payload, setPayload] = useState(null);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [voice, setVoice] = useState(false);
  const timerRef = useRef(null);
  const dialogRef = useRef(null);
  const launchRef = useRef(null);

  const timeline = useMemo(
    () => buildTimeline(payload?.solution, payload),
    [payload]
  );
  const current = timeline[index] || null;
  const atEnd = timeline.length > 0 && index === timeline.length - 1;

  const go = nextIndex => {
    if (!timeline.length) return;
    setIndex(Math.max(0, Math.min(nextIndex, timeline.length - 1)));
  };

  useEffect(() => {
    setPayload(null);
    setOpen(false);
    setIndex(0);
    setPlaying(false);
    setVoice(false);
    cancelSpeech();
  }, [questionId]);

  useEffect(() => {
    const receive = event => {
      const detail = event?.detail;
      if (!detail?.solution || String(detail.questionId) !== String(questionId)) return;
      setPayload(detail);
      setIndex(0);
      setPlaying(false);
    };
    window.addEventListener(EVENT_NAME, receive);
    return () => window.removeEventListener(EVENT_NAME, receive);
  }, [questionId]);

  useEffect(() => {
    clearTimeout(timerRef.current);
    if (!open || !playing || !current || atEnd) return undefined;
    timerRef.current = setTimeout(() => go(index + 1), current.duration / speed);
    return () => clearTimeout(timerRef.current);
  }, [open, playing, current, atEnd, index, speed]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || !voice || !current) return undefined;
    speak(current, speed);
    return cancelSpeech;
  }, [open, voice, current, speed]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = event => {
      if (event.key === 'Escape') {
        setOpen(false);
        setPlaying(false);
        cancelSpeech();
        setTimeout(() => launchRef.current?.focus(), 0);
      } else if (event.key === 'ArrowRight') {
        go(index + 1);
      } else if (event.key === 'ArrowLeft') {
        go(index - 1);
      } else if (event.key === ' ' && event.target?.tagName !== 'BUTTON' && event.target?.tagName !== 'SELECT') {
        event.preventDefault();
        setPlaying(v => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    setTimeout(() => dialogRef.current?.focus(), 0);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, index]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => cancelSpeech(), []);

  if (!payload || !timeline.length) return null;

  const progress = ((index + 1) / timeline.length) * 100;
  const close = () => {
    setOpen(false);
    setPlaying(false);
    cancelSpeech();
    setTimeout(() => launchRef.current?.focus(), 0);
  };

  return (
    <>
      <style>{STYLES}</style>
      <button
        ref={launchRef}
        className="pri-explain-launch no-print"
        type="button"
        onClick={() => { setOpen(true); setPlaying(true); }}
        aria-haspopup="dialog"
      >
        <span className="pri-explain-play" aria-hidden="true">▶</span>
        <span><b>Watch explanation</b><small>Animated worked solution</small></span>
      </button>

      {open && (
        <div className="pri-explain-backdrop no-print" role="presentation" onMouseDown={e => e.target === e.currentTarget && close()}>
          <section
            className="pri-explain-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Animated worked solution"
            tabIndex={-1}
            ref={dialogRef}
          >
            <header className="pri-explain-head">
              <div>
                <div className="pri-explain-kicker">Pri Explain</div>
                <h2>Animated worked solution</h2>
              </div>
              <button className="btn btn-quiet btn-sm" type="button" onClick={close} aria-label="Close animated solution">✕</button>
            </header>

            <div className="pri-explain-question">
              <span>Question</span>
              <MathText text={questionPrompt || 'Worked solution'} />
            </div>

            <div className="pri-explain-progress" aria-label={`Step ${index + 1} of ${timeline.length}`}>
              <div><span>Step {index + 1} of {timeline.length}</span><span>{atEnd ? 'Final step' : playing ? 'Playing' : 'Paused'}</span></div>
              <i><b style={{ width: `${progress}%` }} /></i>
            </div>

            <div className="pri-explain-layout">
              <main className="pri-explain-stage">
                {timeline.map((scene, sceneIndex) => {
                  if (sceneIndex > index) return null;
                  const active = sceneIndex === index;
                  return (
                    <article key={scene.id} className={`pri-explain-scene ${active ? 'active' : 'past'} ${scene.kind}`}>
                      <div className="pri-explain-step-label">{scene.kind === 'diagnosis' ? 'Your working' : `Step ${scene.number}`}</div>
                      <h3><MathText text={scene.heading} /></h3>
                      <div className="pri-explain-lines">
                        {scene.lines.map((line, lineIndex) => (
                          <div key={`${scene.id}-${lineIndex}`} className="pri-explain-line" style={{ '--delay': `${lineIndex * 90}ms` }}>
                            <MathText text={line} />
                          </div>
                        ))}
                      </div>
                    </article>
                  );
                })}

                {atEnd && payload.solution?.answerText && (
                  <div className="pri-explain-final">
                    <span>Final answer</span>
                    <strong><MathText text={payload.solution.answerText} /></strong>
                  </div>
                )}
              </main>

              <aside className="pri-explain-rail" aria-label="Solution steps">
                <div className="pri-explain-rail-title">Timeline</div>
                {timeline.map((scene, sceneIndex) => (
                  <button
                    type="button"
                    key={`nav-${scene.id}`}
                    className={sceneIndex === index ? 'on' : ''}
                    onClick={() => { go(sceneIndex); setPlaying(false); }}
                  >
                    <span>{sceneIndex + 1}</span>
                    <div>{scene.heading}</div>
                  </button>
                ))}
              </aside>
            </div>

            <footer className="pri-explain-controls">
              <div>
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => { go(0); setPlaying(true); }}>↺ Restart</button>
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => go(index - 1)} disabled={index === 0}>‹ Back</button>
                <button className="btn btn-primary btn-sm" type="button" onClick={() => setPlaying(v => !v)}>
                  {playing ? 'Pause' : atEnd ? 'Replay' : 'Play'}
                </button>
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => go(index + 1)} disabled={atEnd}>Next ›</button>
              </div>
              <div className="pri-explain-settings">
                <label>Speed
                  <select value={speed} onChange={e => setSpeed(Number(e.target.value))} aria-label="Explanation speed">
                    {SPEEDS.map(v => <option key={v} value={v}>{v}×</option>)}
                  </select>
                </label>
                <label className="pri-explain-voice">
                  <input type="checkbox" checked={voice} disabled={!canSpeak()} onChange={e => setVoice(e.target.checked)} />
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

const STYLES = `
.pri-explain-launch{position:fixed;right:28px;bottom:88px;z-index:72;display:flex;align-items:center;gap:10px;border:1px solid var(--gold-border);background:var(--surface);color:var(--ink);box-shadow:var(--shadow-sm);border-radius:8px;padding:10px 14px;font:inherit;cursor:pointer;animation:priExplainArrive .28s ease both}.pri-explain-launch:hover{background:var(--surface-2);transform:translateY(-1px)}.pri-explain-launch small{display:block;color:var(--ink-3);font-size:11px;margin-top:2px}.pri-explain-play{display:grid;place-items:center;width:32px;height:32px;border-radius:50%;background:var(--gold);color:#15130d;font-size:12px;padding-left:2px}.pri-explain-backdrop{position:fixed;inset:0;z-index:1100;display:grid;place-items:center;padding:14px;background:rgba(0,0,0,.72);backdrop-filter:blur(7px)}.pri-explain-dialog{width:min(1120px,100%);height:min(900px,94vh);overflow:hidden;background:var(--surface);color:var(--ink);border:1px solid var(--hairline-strong);box-shadow:0 26px 90px rgba(0,0,0,.55);border-radius:10px;display:grid;grid-template-rows:auto auto auto 1fr auto;outline:none}.pri-explain-head{display:flex;justify-content:space-between;align-items:flex-start;padding:18px 20px 10px}.pri-explain-head h2{font-size:23px;margin:2px 0 0}.pri-explain-kicker,.pri-explain-question>span,.pri-explain-final>span,.pri-explain-step-label{font-size:10.5px;text-transform:uppercase;letter-spacing:.12em;color:var(--ink-3);font-weight:700}.pri-explain-kicker{color:var(--gold-bright)}.pri-explain-question{margin:0 20px 12px;padding:12px 14px;border:1px solid var(--hairline);background:var(--surface-2);border-radius:6px;display:grid;gap:7px}.pri-explain-progress{padding:0 20px 12px}.pri-explain-progress>div{display:flex;justify-content:space-between;color:var(--ink-3);font-size:11px;margin-bottom:7px}.pri-explain-progress>i{display:block;height:5px;background:var(--surface-3);overflow:hidden;border-radius:9px}.pri-explain-progress>i>b{display:block;height:100%;background:var(--gold);transition:width .3s ease}.pri-explain-layout{min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 260px;border-top:1px solid var(--hairline);border-bottom:1px solid var(--hairline)}.pri-explain-stage{min-height:0;overflow:auto;padding:18px 20px}.pri-explain-scene{padding:16px 17px;margin-bottom:12px;border:1px solid var(--hairline);background:var(--surface-2);border-radius:7px;opacity:.58;transform:scale(.992);transition:.24s ease}.pri-explain-scene.active{opacity:1;transform:none;border-color:var(--gold-border);box-shadow:0 7px 24px rgba(0,0,0,.18)}.pri-explain-scene.diagnosis{border-left:3px solid var(--warn)}.pri-explain-scene h3{font-size:17px;margin:6px 0 11px}.pri-explain-lines{display:grid;gap:8px}.pri-explain-line{padding:10px 12px;border:1px solid var(--hairline-faint);background:var(--surface);border-radius:5px;animation:priExplainLine .35s ease both;animation-delay:var(--delay)}.pri-explain-final{padding:17px;border:1px solid var(--gold-border);background:var(--gold-soft);border-radius:7px;animation:priExplainFinal .35s ease both}.pri-explain-final strong{display:block;font-size:20px;margin-top:8px}.pri-explain-rail{min-height:0;overflow:auto;border-left:1px solid var(--hairline);background:var(--surface-2);padding:15px 12px}.pri-explain-rail-title{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--ink-3);margin:0 5px 10px}.pri-explain-rail button{width:100%;display:grid;grid-template-columns:26px 1fr;align-items:start;gap:8px;text-align:left;border:1px solid transparent;background:transparent;color:var(--ink-2);padding:9px 8px;border-radius:5px;cursor:pointer;font:inherit;font-size:12px;margin-bottom:4px}.pri-explain-rail button:hover,.pri-explain-rail button.on{background:var(--surface-3);color:var(--ink);border-color:var(--hairline)}.pri-explain-rail button>span{display:grid;place-items:center;width:22px;height:22px;border:1px solid var(--hairline);border-radius:50%;font-size:10px}.pri-explain-controls{padding:13px 20px 16px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}.pri-explain-controls>div{display:flex;gap:7px;align-items:center;flex-wrap:wrap}.pri-explain-settings label{display:flex;align-items:center;gap:6px;color:var(--ink-2);font-size:12px}.pri-explain-settings select{background:var(--surface-2);color:var(--ink);border:1px solid var(--hairline);border-radius:4px;padding:5px}.pri-explain-voice input{accent-color:var(--gold)}@keyframes priExplainArrive{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}@keyframes priExplainLine{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}@keyframes priExplainFinal{from{opacity:0;transform:scale(.98)}to{opacity:1;transform:none}}@media(max-width:820px){.pri-explain-launch{right:12px;bottom:82px}.pri-explain-dialog{height:96vh}.pri-explain-layout{grid-template-columns:1fr}.pri-explain-rail{display:none}.pri-explain-controls{align-items:flex-start}.pri-explain-stage{padding:14px}.pri-explain-head,.pri-explain-progress,.pri-explain-controls{padding-left:14px;padding-right:14px}.pri-explain-question{margin-left:14px;margin-right:14px}}@media(prefers-reduced-motion:reduce){.pri-explain-launch,.pri-explain-line,.pri-explain-final{animation:none}.pri-explain-scene,.pri-explain-progress>i>b{transition:none}}
`;
