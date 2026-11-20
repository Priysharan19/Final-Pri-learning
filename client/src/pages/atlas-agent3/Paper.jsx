import React, { useRef, useState } from 'react';
import { MathText } from '../../lib/latex.jsx';
import { hasAnswer } from './model.js';

function pathOf(points) {
  if (!Array.isArray(points) || points.length < 2) return '';
  return points.map((p, i) => (i === 0 ? 'M ' : ' L ') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
}

function WritingSurface({ strokes, onChange, disabled }) {
  const drawing = useRef(null);
  const [live, setLive] = useState([]);
  const pointAt = event => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return [0, 0];
    return [
      Math.max(0, Math.min(800, ((event.clientX - bounds.left) / bounds.width) * 800)),
      Math.max(0, Math.min(280, ((event.clientY - bounds.top) / bounds.height) * 280))
    ];
  };
  const start = event => {
    if (disabled || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drawing.current = [pointAt(event)];
    setLive(drawing.current);
  };
  const move = event => {
    if (!drawing.current || disabled) return;
    const points = drawing.current;
    if (points.length >= 250) return;
    points.push(pointAt(event));
    setLive([...points]);
  };
  const finish = event => {
    if (!drawing.current) return;
    const points = drawing.current;
    drawing.current = null;
    setLive([]);
    if (points.length === 1) points.push([points[0][0] + 0.3, points[0][1] + 0.3]);
    onChange(strokes.concat([points]).slice(-48));
    try {
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch { /* pointer was already released */ }
  };

  return (
    <div className="pa3-sketch-wrap" data-atlas-sketch>
      <div className="pa3-sketch-head">
        <span>Writing surface <small>Pointer / touch demo, not handwriting recognition</small></span>
        <div className="pa3-sketch-tools">
          <button type="button" disabled={disabled || strokes.length === 0} onClick={() => onChange(strokes.slice(0, -1))}>Undo stroke</button>
          <button type="button" disabled={disabled || strokes.length === 0} onClick={() => onChange([])}>Clear</button>
        </div>
      </div>
      <svg className="pa3-sketch" viewBox="0 0 800 280" preserveAspectRatio="none"
        aria-hidden="true"
        onPointerDown={start} onPointerMove={move} onPointerUp={finish}
        onPointerCancel={finish} onLostPointerCapture={finish}
        data-drawn-strokes={strokes.length}>
        {strokes.map((stroke, i) => <path key={i} d={pathOf(stroke)} className="pa3-stroke" />)}
        {live.length > 1 && <path d={pathOf(live)} className="pa3-stroke pa3-stroke-live" />}
      </svg>
      <p className="pa3-footnote">Sketches are preserved in this tab only. This demonstration does not transcribe or grade them.
        For keyboard input, choose <strong>Type</strong>.</p>
    </div>
  );
}

function DemonstrationControl({ value, onChange, disabled }) {
  return (
    <label className="pa3-simulator">
      <span>Demonstrate a response state <small>Local fixture only</small></span>
      <select aria-label="Simulated response type" value={value} disabled={disabled}
        onChange={event => onChange(event.target.value)}>
        <option value="result">Simulated result</option>
        <option value="uncertain">Uncertain transcription</option>
        <option value="error">Technical error</option>
      </select>
    </label>
  );
}

function Assistance({ question, state, onStateChange }) {
  return (
    <aside className="pa3-assistance" aria-label="Contextual assistance">
      <div className="pa3-side-head"><span className="pa3-overline">ASSISTANCE / SCRIPTED</span>
        <span className="pa3-side-mark" aria-hidden="true">✳</span></div>
      <h3>A nudge, not an answer.</h3>
      <p>Pri asks you to make the next move. These are authored demonstration prompts, not AI responses.</p>
      {state.hintLevel > 0 && (
        <div className="pa3-hint" role="status" data-atlas-hint-level={state.hintLevel}>
          <span className="pa3-overline">HINT {state.hintLevel} OF 2</span>
          <MathText text={question.hints[state.hintLevel - 1]} block />
        </div>
      )}
      <button type="button" className="pa3-button pa3-button-secondary"
        disabled={state.hintLevel >= question.hints.length}
        onClick={() => onStateChange({ hintLevel: state.hintLevel + 1 })}>
        {state.hintLevel === 0 ? 'A small hint' : state.hintLevel < 2 ? 'One more hint' : 'All hints shown'}
        <span aria-hidden="true">↗</span>
      </button>
      <div className="pa3-guidance">
        <span className="pa3-overline">WHY THIS MATTERS</span>
        <p>Try to explain the operation in your own words before looking at an example solution.</p>
      </div>
    </aside>
  );
}

function StatusNotice({ state, onStateChange, storageAvailable }) {
  if (state.status === 'unsubmitted') return (
    <div className="pa3-status pa3-status-idle" role="status" data-atlas-state="unsubmitted">
      <span className="pa3-status-symbol" aria-hidden="true">◌</span>
      <div><strong>Work in progress</strong><p>Nothing has been checked. {storageAvailable ? "Your local demonstration draft is preserved in this tab." : "Browser storage is unavailable; this draft may be lost on refresh."}</p></div>
    </div>
  );
  if (state.status === 'pending') return (
    <div className="pa3-status pa3-status-pending" role="status" data-atlas-state="pending">
      <span className="pa3-status-symbol pa3-spin" aria-hidden="true">◌</span>
      <div><strong>Simulating a review…</strong><p>No network request is being sent and no mathematical checking is taking place.</p></div>
    </div>
  );
  if (state.status === 'uncertain-transcription') return (
    <div className="pa3-status pa3-status-uncertain" role="alert" data-atlas-state="uncertain-transcription">
      <span className="pa3-status-symbol" aria-hidden="true">?</span>
      <div className="pa3-status-body">
        <strong>Transcription uncertain — not a maths error</strong>
        <p>The demo is pretending a handwritten symbol could not be read. No handwriting recognition happened.
          Confirm a transcription yourself before opening the illustrative review.</p>
        <label htmlFor="pa3-transcription">Your confirmed transcription</label>
        <input id="pa3-transcription" value={state.transcript} maxLength={180}
          onChange={event => onStateChange({ transcript: event.target.value })}
          placeholder="Type what you intended to write" />
        <button type="button" className="pa3-button pa3-button-primary"
          disabled={!state.transcript.trim()}
          onClick={() => onStateChange({ status: 'simulated-result', view: 'insight', confirmedRevision: state.revision })}>
          Confirm transcription · see example review
        </button>
      </div>
    </div>
  );
  if (state.status === 'technical-error') return (
    <div className="pa3-status pa3-status-error" role="alert" data-atlas-state="technical-error">
      <span className="pa3-status-symbol" aria-hidden="true">!</span>
      <div className="pa3-status-body">
        <strong>Simulated technical failure</strong>
        <p>This is a scripted error state, not a wrong answer. Your draft has not been changed.</p>
        <button type="button" className="pa3-button pa3-button-secondary"
          onClick={() => onStateChange({ status: 'unsubmitted' })}>Return to draft and retry manually</button>
      </div>
    </div>
  );
  return (
    <div className="pa3-status pa3-status-success" role="status" data-atlas-state="simulated-result">
      <span className="pa3-status-symbol" aria-hidden="true">✓</span>
      <div><strong>Illustrative review prepared</strong>
        <p>No mathematics was evaluated. Open Insight to view a fixed worked example.</p>
        <button type="button" className="pa3-button pa3-button-secondary" onClick={() => onStateChange({ view: 'insight' })}>Open Insight →</button>
      </div>
    </div>
  );
}

export default function AtlasPaper({ question, draft, state, storageAvailable = true, onDraftChange, onStateChange, onSubmit, onAtlas, onLoadSample }) {
  const busy = state.status === 'pending';
  const ready = hasAnswer(draft);
  return (
    <section className={'pa3-paper-layout' + (state.focus ? ' pa3-is-focus' : '')} data-atlas-paper>
      <div className="pa3-paper-main">
        <div className="pa3-paper-toolbar">
          <div className="pa3-breadcrumb">ATLAS <span>/</span> ALGEBRA <span>/</span> PAPER <b>01—02</b></div>
          <div className="pa3-actions">
            <button type="button" className="pa3-quiet-button" onClick={() => onStateChange({ focus: !state.focus })}
              aria-pressed={state.focus} data-atlas-focus>{state.focus ? 'Exit focus' : 'Focus mode'} <span aria-hidden="true">⤢</span></button>
          </div>
        </div>
        <article className="pa3-sheet" aria-label="Practice paper">
          <header className="pa3-sheet-head">
            <div><span className="pa3-overline">PRI / EXAMINATION PAPER</span><h1>{question.title}</h1>
              <p>{question.chapter} <span>·</span> Concept study</p></div>
            <div className="pa3-marks"><strong>{question.marks}</strong><span>MARKS</span></div>
          </header>
          <div className="pa3-question">
            <div className="pa3-question-no">Q{String(state.questionIndex + 1).padStart(2, '0')}</div>
            <div><h2>Show the thinking.</h2>
              <MathText text={question.prompt} className="pa3-problem" block />
              <p className="pa3-question-note">{question.instructions}</p>
            </div>
          </div>
          <div className="pa3-response">
            <div className="pa3-response-head">
              <div><span className="pa3-overline">YOUR WORK</span><h3>Solution workspace</h3></div>
              <div className="pa3-switch" aria-label="Answer input mode">
                <button type="button" aria-pressed={state.inputMode === 'type'} onClick={() => onStateChange({ inputMode: 'type' })}>Type</button>
                <button type="button" aria-pressed={state.inputMode === 'write'} onClick={() => onStateChange({ inputMode: 'write' })}>Write</button>
              </div>
            </div>
            {state.inputMode === 'type' ? (
              <div className="pa3-type-area">
                <label htmlFor="pa3-working">Your working and reasoning</label>
                <textarea id="pa3-working" rows={6} placeholder={'Start with an equation…\nShow what changes on both sides.'}
                  value={draft.working} disabled={busy} maxLength={1800}
                  onChange={event => onDraftChange({ working: event.target.value })} />
              </div>
            ) : <WritingSurface strokes={draft.strokes}
              disabled={busy} onChange={strokes => onDraftChange({ strokes })} />}
            <div className="pa3-answer-row">
              <label htmlFor="pa3-final-answer">Final answer <span>Optional if your working already contains it</span></label>
              <input id="pa3-final-answer" value={draft.answer} maxLength={180} disabled={busy}
                onChange={event => onDraftChange({ answer: event.target.value })}
                placeholder="e.g. x = …" autoComplete="off" />
            </div>
            {question.errorExample && (
              <button type="button" className="pa3-example" disabled={busy} onClick={onLoadSample}>
                Load an explicitly incorrect sample <span>For the error-review demonstration only ↗</span>
              </button>
            )}
          </div>
          <div className="pa3-sheet-bottom">
            <div className="pa3-draft-label"><span className="pa3-live-dot" /> LOCAL DEMO · {ready ? 'DRAFT PRESENT' : 'NO ANSWER YET'}</div>
            <button type="button" className="pa3-button pa3-button-primary" disabled={!ready || busy} onClick={onSubmit}
              data-atlas-submit>{busy ? 'Simulating…' : 'Submit for simulated review'}<span aria-hidden="true">↗</span></button>
          </div>
        </article>
        <StatusNotice state={state} storageAvailable={storageAvailable} onStateChange={onStateChange} />
        {!state.focus && <DemonstrationControl value={state.outcome} disabled={busy}
          onChange={outcome => onStateChange({ outcome })} />}
      </div>
      {!state.focus && (
        <div className="pa3-paper-side">
          <div className="pa3-context"><div className="pa3-overline">CURRENT CONCEPT</div>
            <h3>{question.conceptId === 'c10-pair-linear-equations' ? 'Pairs of linear equations' : 'Linear equations'}</h3>
            <p>{question.conceptId === 'c10-pair-linear-equations'
              ? 'The intersection solves both linear equations simultaneously.'
              : 'Equality is preserved when the same operation is applied to both sides.'}</p>
            <div className="pa3-context-rule"><span>01</span><span>EXPAND</span><span>→</span><span>02</span><span>BALANCE</span></div>
            <button type="button" className="pa3-link-button" onClick={onAtlas}>Locate in Atlas <span aria-hidden="true">↗</span></button>
          </div>
          <Assistance question={question} state={state} onStateChange={onStateChange} />
          <div className="pa3-assistance-mobile">
            <button type="button" className="pa3-button pa3-button-secondary" aria-expanded={state.helpOpen}
              onClick={() => onStateChange({ helpOpen: !state.helpOpen })}>
              {state.helpOpen ? 'Hide scripted assistance' : 'Open scripted assistance'}</button>
            {state.helpOpen && <Assistance question={question} state={state} onStateChange={onStateChange} />}
          </div>
        </div>
      )}
    </section>
  );
}
