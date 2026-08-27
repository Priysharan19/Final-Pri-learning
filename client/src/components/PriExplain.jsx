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
  const utterance = new SpeechSynthesisUtterance(speechText([scene.heading, ...(scene.lines || [])].join('. ')));
  utterance.lang = 'en-AU';
  utterance.rate = Math.max(0.75, Math.min(1.4, 0.96 * speed));
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

const VISUAL_NAMES = {
  transform: 'Equation motion', ink: 'Ink replay', graph: 'Graph draw', geometry: 'Geometry build',
  calculus: 'Calculus region', statistics: 'Data visual', figure: 'Diagram build', attempt: 'Working replay'
};

export default function PriExplain({ questionId, questionPrompt, questionFigure }) {
  const [payload, setPayload] = useState(null);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [voice, setVoice] = useState(false);
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
  const atEnd = timeline.length > 0 && index === timeline.length - 1;
  const visualKinds = useMemo(() => visualSummary(timeline), [timeline]);

  const go = nextIndex => {
    if (!timeline.length) return;
    setIndex(Math.max(0, Math.min(nextIndex, timeline.length - 1)));
  };

  useEffect(() => {
    wrongRef.current = null;
    setPayload(null);
    setOpen(false);
    setIndex(0);
    setPlaying(false);
    setVoice(false);
    cancelSpeech();
  }, [questionId]);

  useEffect(() => {
    const receiveAttempt = event => {
      const detail = event?.detail;
      if (String(detail?.questionId) !== String(questionId)) return;
      // The first miss is the pedagogically useful evidence. Later retries can
      // be consequences of that misconception, so never overwrite the original.
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
    if (!open || !playing || !current) return undefined;
    if (atEnd) { setPlaying(false); return undefined; }
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
        setOpen(false); setPlaying(false); cancelSpeech();
        setTimeout(() => launchRef.current?.focus(), 0);
      } else if (event.key === 'ArrowRight') go(index + 1);
      else if (event.key === 'ArrowLeft') go(index - 1);
      else if (event.key === ' ' && !['BUTTON', 'SELECT', 'INPUT'].includes(event.target?.tagName)) {
        event.preventDefault(); setPlaying(v => !v);
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
    setOpen(false); setPlaying(false); cancelSpeech();
    setTimeout(() => launchRef.current?.focus(), 0);
  };

  return (
    <>
      <style>{STYLES}</style>
      <button ref={launchRef} className="pri-explain-launch no-print" type="button"
        onClick={() => { setOpen(true); setPlaying(true); }} aria-haspopup="dialog">
        <span className="pri-explain-play" aria-hidden="true">▶</span>
        <span><b>Watch explanation</b><small>{visualKinds.length ? 'Visual maths · your working · verified solution' : 'Animated worked solution'}</small></span>
      </button>

      {open && (
        <div className="pri-explain-backdrop no-print" role="presentation" onMouseDown={e => e.target === e.currentTarget && close()}>
          <section className="pri-explain-dialog" role="dialog" aria-modal="true"
            aria-label="Visual worked solution" tabIndex={-1} ref={dialogRef}>
            <header className="pri-explain-head">
              <div>
                <div className="pri-explain-kicker">Pri Explain · Visual Engine V2</div>
                <h2>See the maths change, not just the answer</h2>
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
              <div><span>Scene {index + 1} of {timeline.length}</span><span>{atEnd ? 'Final result' : playing ? 'Playing' : 'Paused'}</span></div>
              <i><b style={{ width: `${progress}%` }} /></i>
            </div>

            <div className="pri-explain-layout">
              <div className="pri-explain-stage">
                {timeline.map((scene, sceneIndex) => {
                  if (sceneIndex > index) return null;
                  const active = sceneIndex === index;
                  return (
                    <article key={scene.id} className={`pri-explain-scene ${active ? 'active' : 'past'} ${scene.kind}`}>
                      <div className="pri-explain-step-label">
                        {scene.kind === 'diagnosis' ? 'Replay + diagnosis' : `Step ${scene.number}`}
                        {scene.concept && scene.concept !== 'generic' && <em>{scene.concept}</em>}
                      </div>
                      <h3><MathText text={scene.heading} /></h3>
                      {active && !!scene.visuals?.length && (
                        <div className="pri-explain-visuals" key={`visual-${scene.id}-${index}`}>
                          {scene.visuals.map((visual, visualIndex) => <VisualBlock key={`${scene.id}-${visual.kind}-${visualIndex}`} visual={visual} />)}
                        </div>
                      )}
                      <div className="pri-explain-lines">
                        {(scene.lines || []).map((line, lineIndex) => (
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
                    <span>Verified final answer</span>
                    <strong><MathText text={payload.solution.answerText} /></strong>
                  </div>
                )}
              </div>

              <aside className="pri-explain-rail" aria-label="Solution timeline">
                <div className="pri-explain-rail-title">Visual timeline</div>
                {timeline.map((scene, sceneIndex) => (
                  <button type="button" key={`nav-${scene.id}`} className={sceneIndex === index ? 'on' : ''}
                    onClick={() => { go(sceneIndex); setPlaying(false); }}>
                    <span>{sceneIndex + 1}</span>
                    <div><b>{scene.kind === 'diagnosis' ? 'Your attempt' : scene.heading}</b><small>{scene.visuals?.map(v => VISUAL_NAMES[v.kind === 'figure' ? v.mode : v.kind] || v.kind).join(' · ') || 'Reasoning'}</small></div>
                  </button>
                ))}
              </aside>
            </div>

            <footer className="pri-explain-controls">
              <div>
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => { go(0); setPlaying(true); }}>↺ Restart</button>
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => go(index - 1)} disabled={index === 0}>‹ Back</button>
                <button className="btn btn-primary btn-sm" type="button" onClick={() => {
                  if (atEnd) { go(0); setPlaying(true); } else setPlaying(v => !v);
                }}>{playing ? 'Pause' : atEnd ? 'Replay' : 'Play'}</button>
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => go(index + 1)} disabled={atEnd}>Next ›</button>
              </div>
              <div className="pri-explain-settings">
                <label>Speed<select value={speed} onChange={e => setSpeed(Number(e.target.value))} aria-label="Explanation speed">
                  {SPEEDS.map(v => <option key={v} value={v}>{v}×</option>)}
                </select></label>
                <label className="pri-explain-voice"><input type="checkbox" checked={voice} disabled={!canSpeak()} onChange={e => setVoice(e.target.checked)} />Voice</label>
              </div>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}

const STYLES = `
.pri-explain-launch{position:fixed;right:28px;bottom:88px;z-index:72;display:flex;align-items:center;gap:10px;border:1px solid var(--gold-border);background:var(--surface);color:var(--ink);box-shadow:var(--shadow-sm);border-radius:8px;padding:10px 14px;font:inherit;cursor:pointer;animation:priExplainArrive .28s ease both}.pri-explain-launch:hover{background:var(--surface-2);transform:translateY(-1px)}.pri-explain-launch small{display:block;color:var(--ink-3);font-size:11px;margin-top:2px}.pri-explain-play{display:grid;place-items:center;width:32px;height:32px;border-radius:50%;background:var(--gold);color:#15130d;font-size:12px;padding-left:2px}.pri-explain-backdrop{position:fixed;inset:0;z-index:1100;display:grid;place-items:center;padding:14px;background:rgba(0,0,0,.74);backdrop-filter:blur(8px)}.pri-explain-dialog{width:min(1180px,100%);height:min(930px,95vh);overflow:hidden;background:var(--surface);color:var(--ink);border:1px solid var(--hairline-strong);box-shadow:0 26px 90px rgba(0,0,0,.6);border-radius:10px;display:grid;grid-template-rows:auto auto auto 1fr auto;outline:none}.pri-explain-head{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;padding:18px 20px 10px}.pri-explain-head h2{font-size:23px;margin:2px 0 0}.pri-explain-kicker,.pri-explain-question>span,.pri-explain-final>span,.pri-explain-step-label{font-size:10.5px;text-transform:uppercase;letter-spacing:.12em;color:var(--ink-3);font-weight:700}.pri-explain-kicker{color:var(--gold-bright)}.pri-explain-capabilities{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.pri-explain-capabilities span{font-size:10px;border:1px solid var(--hairline);background:var(--surface-2);color:var(--ink-2);padding:3px 6px;border-radius:20px}.pri-explain-question{margin:0 20px 12px;padding:11px 14px;border:1px solid var(--hairline);background:var(--surface-2);border-radius:6px;display:grid;gap:6px}.pri-explain-progress{padding:0 20px 12px}.pri-explain-progress>div{display:flex;justify-content:space-between;color:var(--ink-3);font-size:11px;margin-bottom:7px}.pri-explain-progress>i{display:block;height:5px;background:var(--surface-3);overflow:hidden;border-radius:9px}.pri-explain-progress>i>b{display:block;height:100%;background:var(--gold);transition:width .3s ease}.pri-explain-layout{min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 270px;border-top:1px solid var(--hairline);border-bottom:1px solid var(--hairline)}.pri-explain-stage{min-height:0;overflow:auto;padding:18px 20px}.pri-explain-scene{padding:16px 17px;margin-bottom:12px;border:1px solid var(--hairline);background:var(--surface-2);border-radius:7px;opacity:.48;transform:scale(.994);transition:.24s ease}.pri-explain-scene.active{opacity:1;transform:none;border-color:var(--gold-border);box-shadow:0 7px 24px rgba(0,0,0,.18)}.pri-explain-scene.diagnosis{border-left:3px solid var(--warn)}.pri-explain-step-label{display:flex;justify-content:space-between;align-items:center;gap:8px}.pri-explain-step-label em{font-style:normal;color:var(--gold);letter-spacing:.08em}.pri-explain-scene h3{font-size:17px;margin:6px 0 11px}.pri-explain-lines{display:grid;gap:8px}.pri-explain-line{padding:10px 12px;border:1px solid var(--hairline-faint);background:var(--surface);border-radius:5px;animation:priExplainLine .35s ease both;animation-delay:var(--delay)}.pri-explain-visuals{display:grid;gap:12px;margin:11px 0 14px}.pri-explain-final{padding:17px;border:1px solid var(--gold-border);background:var(--gold-soft);border-radius:7px;animation:priExplainFinal .35s ease both}.pri-explain-final strong{display:block;font-size:20px;margin-top:8px}.pri-explain-rail{min-height:0;overflow:auto;border-left:1px solid var(--hairline);background:var(--surface-2);padding:15px 12px}.pri-explain-rail-title{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--ink-3);margin:0 5px 10px}.pri-explain-rail button{width:100%;display:grid;grid-template-columns:26px 1fr;align-items:start;gap:8px;text-align:left;border:1px solid transparent;background:transparent;color:var(--ink-2);padding:9px 8px;border-radius:5px;cursor:pointer;font:inherit;font-size:12px;margin-bottom:4px}.pri-explain-rail button:hover,.pri-explain-rail button.on{background:var(--surface-3);color:var(--ink);border-color:var(--hairline)}.pri-explain-rail button>span{display:grid;place-items:center;width:22px;height:22px;border:1px solid var(--hairline);border-radius:50%;font-size:10px}.pri-explain-rail button b{display:block;font-weight:600}.pri-explain-rail button small{display:block;color:var(--ink-3);font-size:10px;margin-top:3px}.pri-explain-controls{padding:13px 20px 16px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}.pri-explain-controls>div{display:flex;gap:7px;align-items:center;flex-wrap:wrap}.pri-explain-settings label{display:flex;align-items:center;gap:6px;color:var(--ink-2);font-size:12px}.pri-explain-settings select{background:var(--surface-2);color:var(--ink);border:1px solid var(--hairline);border-radius:4px;padding:5px}.pri-explain-voice input{accent-color:var(--gold)}
.pri-v-transform{position:relative;padding:16px;border:1px solid var(--gold-border);background:linear-gradient(180deg,var(--gold-soft),transparent);border-radius:7px;overflow:hidden}.pri-v-transform-math{font-size:20px;text-align:center;padding:7px 4px}.pri-v-transform-math.before{animation:priVBefore .5s ease both}.pri-v-transform-math.after{animation:priVAfter .55s .18s ease both}.pri-v-tokenstrip{display:flex;justify-content:center;align-items:center;gap:3px;flex-wrap:wrap;min-height:29px;margin:3px 0}.pri-v-tokenstrip span{font-family:var(--font-mono);font-size:11px;padding:4px 5px;border-radius:4px;transition:.25s ease}.pri-v-tokenstrip span.same{color:var(--ink-3)}.pri-v-tokenstrip span.changed{color:var(--gold-bright);background:var(--gold-soft);border:1px solid var(--gold-border);animation:priVTerm .5s ease both}.pri-v-transform-arrow{display:grid;place-items:center;position:relative;height:45px;color:var(--gold)}.pri-v-transform-arrow i{position:absolute;width:1px;height:32px;background:var(--gold);animation:priVArrow .42s ease both}.pri-v-transform-arrow span{position:absolute;right:calc(50% + 14px);font-size:10px;text-transform:uppercase;letter-spacing:.09em;color:var(--ink-3);white-space:nowrap}.pri-v-transform-arrow b{font-size:17px;transform:translateY(13px)}
.pri-v-caption{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:9px;font-size:10px;text-transform:uppercase;letter-spacing:.09em;color:var(--ink-3)}.pri-v-caption b{font-weight:500;color:var(--gold)}.pri-v-ink,.pri-v-figure,.pri-v-attempt{padding:14px;border:1px solid var(--hairline);background:var(--surface);border-radius:7px}.pri-v-ink svg{display:block;width:100%;height:min(250px,32vh);background:radial-gradient(circle at 20% 20%,var(--surface-2),var(--surface));border-radius:5px;overflow:visible}.pri-v-ink path{fill:none;stroke:var(--ink);stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1;stroke-dashoffset:1;animation:priInkDraw .72s linear forwards;animation-delay:var(--stroke-delay)}.pri-v-ink path.scribble{stroke:var(--warn);stroke-width:1.8}.pri-v-recognized{margin-top:9px;display:grid;grid-template-columns:auto 1fr;gap:9px;align-items:center;font-size:12px}.pri-v-recognized>span,.pri-v-attempt>span{font-size:10px;text-transform:uppercase;letter-spacing:.09em;color:var(--ink-3)}.pri-v-attempt{display:grid;gap:8px;border-left:3px solid var(--warn)}.pri-v-figure-inner{display:grid;place-items:center;min-height:180px;overflow:hidden}.pri-v-figure-inner svg{max-height:310px;max-width:100%}.pri-v-figure-inner svg path,.pri-v-figure-inner svg line,.pri-v-figure-inner svg polyline,.pri-v-figure-inner svg circle,.pri-v-figure-inner svg rect,.pri-v-figure-inner svg polygon{transform-origin:center;transform-box:fill-box}.pri-v-figure-inner svg path,.pri-v-figure-inner svg line,.pri-v-figure-inner svg polyline{stroke-dasharray:1400;stroke-dashoffset:1400;animation:priFigDraw 1.25s ease forwards}.pri-v-figure-inner svg line:nth-of-type(n+2),.pri-v-figure-inner svg path:nth-of-type(n+2){animation-delay:.12s}.pri-v-figure-inner svg circle{opacity:0;animation:priFigPoint .35s .65s ease forwards}.pri-v-figure-inner svg text{opacity:0;animation:priFigText .35s .8s ease forwards}.pri-v-figure.calculus .pri-v-figure-inner svg polygon,.pri-v-figure.calculus .pri-v-figure-inner svg path[fill]:not([fill="none"]){fill-opacity:0;animation:priFigArea .8s .7s ease forwards}.pri-v-figure.geometry .pri-v-figure-inner svg polygon{animation:priGeoPop .5s .45s ease both}
@keyframes priExplainArrive{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}@keyframes priExplainLine{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}@keyframes priExplainFinal{from{opacity:0;transform:scale(.98)}to{opacity:1;transform:none}}@keyframes priVBefore{from{opacity:0;transform:translateY(-7px)}to{opacity:.72;transform:none}}@keyframes priVAfter{from{opacity:0;transform:translateY(12px) scale(.97)}to{opacity:1;transform:none}}@keyframes priVTerm{0%{transform:translateY(-8px);opacity:.2}65%{transform:translateY(2px)}100%{transform:none;opacity:1}}@keyframes priVArrow{from{height:0;opacity:.2}to{height:32px;opacity:1}}@keyframes priInkDraw{to{stroke-dashoffset:0}}@keyframes priFigDraw{to{stroke-dashoffset:0}}@keyframes priFigPoint{from{opacity:0;transform:scale(.3)}to{opacity:1;transform:scale(1)}}@keyframes priFigText{to{opacity:1}}@keyframes priFigArea{to{fill-opacity:.22}}@keyframes priGeoPop{from{opacity:.2;transform:scale(.95)}to{opacity:1;transform:none}}
@media(max-width:820px){.pri-explain-launch{right:12px;bottom:82px}.pri-explain-dialog{height:97vh}.pri-explain-layout{grid-template-columns:1fr}.pri-explain-rail{display:none}.pri-explain-controls{align-items:flex-start}.pri-explain-stage{padding:14px}.pri-explain-head,.pri-explain-progress,.pri-explain-controls{padding-left:14px;padding-right:14px}.pri-explain-question{margin-left:14px;margin-right:14px}.pri-v-transform-math{font-size:17px}.pri-v-caption{align-items:flex-start;flex-direction:column;gap:2px}}
@media(prefers-reduced-motion:reduce){.pri-explain-launch,.pri-explain-line,.pri-explain-final,.pri-v-transform-math,.pri-v-tokenstrip span.changed,.pri-v-transform-arrow i,.pri-v-ink path,.pri-v-figure-inner svg path,.pri-v-figure-inner svg line,.pri-v-figure-inner svg polyline,.pri-v-figure-inner svg circle,.pri-v-figure-inner svg text,.pri-v-figure-inner svg polygon{animation:none!important;transition:none!important;stroke-dashoffset:0!important;opacity:1!important;transform:none!important}.pri-v-figure.calculus .pri-v-figure-inner svg polygon,.pri-v-figure.calculus .pri-v-figure-inner svg path[fill]:not([fill="none"]){fill-opacity:.22!important}}
`;
