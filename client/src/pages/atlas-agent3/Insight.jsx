import React from 'react';
import { MathText } from '../../lib/latex.jsx';
import { authoredErrorMatches } from './model.js';

function miniaturePath(stroke) {
  return stroke.map((p, i) => (i ? ' L ' : 'M ') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
}

export default function AtlasInsight({ question, draft, state, onBackPaper, onNext, onAtlas }) {
  const sample = authoredErrorMatches(question, draft);
  const hasTypedWorking = Boolean(draft.working.trim());
  const hasFinal = Boolean(draft.answer.trim());
  const hasSketch = draft.strokes.length > 0;
  const confirmed = state.confirmedRevision === state.revision && Boolean(state.transcript.trim());

  return (
    <section className="pa3-insight" data-atlas-insight>
      <div className="pa3-insight-topline">
        <div className="pa3-breadcrumb">ATLAS <span>/</span> PAPER <span>/</span> INSIGHT <b>REVIEW</b></div>
        <button type="button" className="pa3-quiet-button" onClick={onBackPaper}>← Back to paper</button>
      </div>
      <header className="pa3-insight-hero">
        <div>
          <span className="pa3-overline">PRI / EXPLANATION STUDIO</span>
          <h1>Understand the next move.</h1>
          <p>See your original work beside a deliberately authored explanation.
            This review is simulated; it does not judge your answer.</p>
        </div>
        <div className="pa3-insight-seal"><span>DEMO</span><strong>{sample ? question.errorExample.sampleMarks : '—'}</strong>
          <small>{sample ? 'Sample-only marks' : 'Not assessed'}</small></div>
      </header>
      <div className="pa3-insight-callout" role="status" data-atlas-simulation>
        <strong>Illustrative feedback only</strong>
        <span>No grading service, mathematical verifier or AI tutor was used. The worked steps below are a fixed authored fixture.</span>
      </div>
      <div className="pa3-insight-columns">
        <article className="pa3-review-original">
          <div className="pa3-panel-heading"><span className="pa3-overline">01 / ORIGINAL</span><h2>Your submitted work</h2></div>
          <div className="pa3-original-paper">
            <MathText text={question.prompt} block className="pa3-small-prompt" />
            {hasTypedWorking && <pre data-atlas-original-working>{draft.working}</pre>}
            {hasSketch && (
              <div className="pa3-original-ink" aria-label="Your sketch, displayed without recognition">
                <svg viewBox="0 0 800 280" preserveAspectRatio="none" aria-hidden="true">
                  {draft.strokes.map((stroke, i) => <path key={i} d={miniaturePath(stroke)} />)}
                </svg>
                <small>Original strokes · not transcribed or marked</small>
              </div>
            )}
            {hasFinal && <div className="pa3-original-answer"><span>FINAL ANSWER AS ENTERED</span><strong>{draft.answer}</strong></div>}
            {!hasTypedWorking && !hasSketch && !hasFinal &&
              <p className="pa3-placeholder">No work was entered in this demonstration.</p>}
            {confirmed && <p className="pa3-manual-confirmation">Manually confirmed transcription: {state.transcript}</p>}
          </div>
          <div className="pa3-review-note"><strong>What the system knows</strong>
            <p>The prototype preserves and displays your entries. It has not checked their correctness or inferred a misconception.</p>
          </div>
        </article>
        <article className="pa3-reference">
          <div className="pa3-panel-heading"><span className="pa3-overline">02 / REFERENCE METHOD</span><h2>One sound approach</h2></div>
          <ol className="pa3-steps">
            {question.steps.map((step, i) => (
              <li key={step.label}>
                <span className="pa3-step-no">{String(i + 1).padStart(2, '0')}</span>
                <div className="pa3-step-body"><strong>{step.label}</strong>
                  <MathText text={step.math} block className="pa3-step-math" />
                  {step.nextMath && <div className="pa3-step-continuation"><span aria-hidden="true">↳</span><MathText text={step.nextMath} block /></div>}
                  <p>{step.why}</p></div>
              </li>
            ))}
          </ol>
          {sample ? (
            <div className="pa3-error-example" data-atlas-defined-error>
              <span className="pa3-overline">03 / FIXTURE-DEFINED MISTAKE</span>
              <h3>An intentional balancing slip</h3>
              <p>The preloaded <em>example</em> used <code>{question.errorExample.line}</code>.</p>
              <p>{question.errorExample.explanation}</p>
              <strong>{question.errorExample.sampleMarks} marks in the scripted example — not a grade for independent student work.</strong>
            </div>
          ) : (
            <div className="pa3-no-diagnosis" data-atlas-no-diagnosis>
              <span className="pa3-overline">03 / YOUR MATHEMATICAL FEEDBACK</span>
              <h3>Not determined by this prototype</h3>
              <p>No individual error, correctness verdict or mark is inferred from your answer.
                A real result would require the authorized marking and transcription pipeline.</p>
            </div>
          )}
        </article>
      </div>
      <div className="pa3-next-card">
        <div className="pa3-next-identity"><span className="pa3-overline">CONTINUE / PRACTISE INDEPENDENTLY</span>
          <h2>{state.questionIndex === 0 ? 'Transfer the principle.' : 'Return to the foundations.'}</h2>
          <p>{state.questionIndex === 0
            ? 'Use the balancing idea in a fresh linear equation, without revealing the solution first.'
            : 'Return to the earlier equation to strengthen the method.'}</p>
        </div>
        <div className="pa3-next-actions">
          <button type="button" className="pa3-button pa3-button-primary" onClick={onNext}
            data-atlas-next>Next question <span aria-hidden="true">↗</span></button>
          <button type="button" className="pa3-button pa3-button-secondary" onClick={onAtlas}
            data-atlas-return>Locate concept in Atlas <span aria-hidden="true">↗</span></button>
        </div>
      </div>
    </section>
  );
}
