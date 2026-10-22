import React, { useEffect, useState } from 'react';
import AtlasPaper from './Paper.jsx';
import AtlasInsight from './Insight.jsx';
import {
  DEMO_KEY, QUESTIONS, authoredErrorMatches, currentDraft, currentQuestion,
  emptyDraft, initialDemoState, restoreDemo, storageEnvelope
} from './model.js';
import './paper-insight.css';

function readSession() {
  if (typeof window === 'undefined') return initialDemoState();
  try { return restoreDemo(window.sessionStorage.getItem(DEMO_KEY)); }
  catch { return initialDemoState(); }
}

export default function AtlasAgent3Demo({ onNavigate }) {
  const [session, setSession] = useState(readSession);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const question = currentQuestion(session);
  const draft = currentDraft(session);

  useEffect(() => {
    try { window.sessionStorage.setItem(DEMO_KEY, storageEnvelope(session)); setStorageAvailable(true); }
    catch { setStorageAvailable(false); }
  }, [session]);

  useEffect(() => {
    if (session.status !== 'pending') return undefined;
    const timeout = window.setTimeout(() => {
      setSession(current => {
        if (current.status !== 'pending') return current;
        if (current.outcome === 'uncertain') {
          return { ...current, status: 'uncertain-transcription', transcript: '', view: 'paper' };
        }
        if (current.outcome === 'error') {
          return { ...current, status: 'technical-error', view: 'paper' };
        }
        return { ...current, status: 'simulated-result', view: 'insight' };
      });
    }, 780);
    return () => window.clearTimeout(timeout);
  }, [session.status, session.outcome]);

  const patch = changes => setSession(current => ({ ...current, ...changes }));
  const patchDraft = changes => {
    setSession(current => {
      const questionId = currentQuestion(current).id;
      const before = current.drafts[questionId] || emptyDraft();
      return {
        ...current,
        drafts: { ...current.drafts, [questionId]: { ...before, ...changes } },
        status: 'unsubmitted',
        // Any edit invalidates the confirmation from the previous revision.
        transcript: '',
        revision: current.revision + 1,
        view: 'paper'
      };
    });
  };

  const startSample = () => {
    if (!question.errorExample) return;
    patchDraft({
      working: question.errorExample.working,
      answer: question.errorExample.answer,
      strokes: []
    });
  };

  const goAtlas = () => {
    if (typeof onNavigate === 'function') {
      onNavigate('atlas', { conceptId: question.conceptId, source: session.view });
      return;
    }
    patch({ view: 'atlas-handoff', focus: false });
  };
  const goNext = () => {
    setSession(current => ({
      ...current,
      questionIndex: (current.questionIndex + 1) % QUESTIONS.length,
      view: 'paper',
      inputMode: 'type',
      status: 'unsubmitted',
      outcome: 'result',
      hintLevel: 0,
      transcript: '',
      focus: false,
      helpOpen: false,
      revision: 0,
      confirmedRevision: 0
    }));
  };
  const reset = () => {
    try { window.sessionStorage.removeItem(DEMO_KEY); } catch { /* ignored */ }
    setSession(initialDemoState(session.profile));
  };
  const shownPaper = session.view === 'paper';
  const shownInsight = session.view === 'insight' && session.status === 'simulated-result';

  return (
    <div className="pa3-app" data-atlas-demo data-profile={session.profile} data-focus={String(session.focus)}>
      <header className="pa3-shellbar">
        <div className="pa3-brand"><span className="pa3-brand-glyph">P<span>·</span></span><div>
          <span className="pa3-brand-name">PRI ATLAS</span><span className="pa3-brand-sub">THE LEARNING INSTRUMENT</span>
        </div></div>
        <div className="pa3-shell-locations"><span>ALGEBRA</span><span className="pa3-shell-divider">/</span>
          <span className="pa3-location-current">{shownInsight ? 'INSIGHT' : shownPaper ? 'PAPER' : 'ATLAS HANDOFF'}</span>
        </div>
        <div className="pa3-shell-right"><span className="pa3-demo-flag">SYNTHETIC PROTOTYPE</span>
          <span className="pa3-signal"><span aria-hidden="true">●</span> LOCAL ONLY</span>
        </div>
      </header>
      <div className="pa3-body">
        <nav className="pa3-rail" aria-label="Atlas prototype navigation">
          <div className="pa3-rail-group"><span className="pa3-rail-caption">YOUR JOURNEY</span>
            <button type="button" className="pa3-nav-link" onClick={goAtlas}><span>◈</span> Atlas <small>↗</small></button>
            <button type="button" className={'pa3-nav-link' + (shownPaper ? ' pa3-nav-active' : '')}
              onClick={() => patch({ view: 'paper' })} aria-current={shownPaper ? 'page' : undefined}>
              <span>▤</span> Paper <small>02</small></button>
            <button type="button" className={'pa3-nav-link' + (shownInsight ? ' pa3-nav-active' : '')}
              onClick={() => patch({ view: 'insight' })}
              disabled={session.status !== 'simulated-result'}
              aria-current={shownInsight ? 'page' : undefined}><span>✳</span> Insight <small>03</small></button>
          </div>
          <div className="pa3-rail-bottom">
            <span className="pa3-rail-caption">SESSION CONTEXT</span>
            <label htmlFor="pa3-profile">Student fixture</label>
            <select id="pa3-profile" value={session.profile}
              onChange={event => setSession(initialDemoState(event.target.value))}>
              <option value="new">New student</option><option value="returning">Returning student</option>
            </select>
            <div className="pa3-profile-evidence">
              {session.profile === 'new' ? (
                <p><strong>No progress evidence</strong>Nothing about a new student's ability has been inferred.</p>
              ) : (
                <p><strong>Synthetic activity only</strong>4 invented practice visits; no verified mastery, performance or recommendation claim.</p>
              )}
            </div>
            <button type="button" className="pa3-reset" onClick={reset}>Reset this demonstration ↺</button>
          </div>
        </nav>
        <main className="pa3-content" id="pa3-main" tabIndex="-1">
          {shownPaper && <AtlasPaper question={question} state={session} draft={draft} storageAvailable={storageAvailable}
            onDraftChange={patchDraft} onStateChange={patch} onSubmit={() => patch({ status: 'pending' })}
            onAtlas={goAtlas} onLoadSample={startSample} />}
          {shownInsight && <AtlasInsight question={question} state={session} draft={draft}
            onBackPaper={() => patch({ view: 'paper' })}
            onNext={goNext} onAtlas={goAtlas} />}
          {session.view === 'atlas-handoff' && (
            <section className="pa3-handoff" data-atlas-handoff>
              <span className="pa3-overline">INTEGRATION BOUNDARY</span>
              <h1>Back to the knowledge network.</h1>
              <p>This standalone Agent 3 demo exposes a navigation callback for Agent 1's Command
                and Agent 2's Atlas/Laboratory. Those surfaces are not reproduced or certified here.</p>
              <div className="pa3-handoff-meta"><span>Concept ID</span><code>{question.conceptId}</code></div>
              <button type="button" className="pa3-button pa3-button-primary"
                onClick={() => patch({ view: 'paper' })}>Return to Paper ↗</button>
            </section>
          )}
        </main>
      </div>
      <footer className="pa3-global-foot"><span>PRI ATLAS · QUESTION EXPERIENCE PROTOTYPE</span>
        <span>HANDWRITING NOT RECOGNISED · ANSWERS NOT MARKED · NO DATA SENT</span></footer>
    </div>
  );
}

export { AtlasPaper, AtlasInsight, QUESTIONS, authoredErrorMatches };
