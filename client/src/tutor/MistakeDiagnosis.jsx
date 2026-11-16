// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · "What went wrong?" (lazy chunk)
//
// Shows the diagnosis of work the deterministic engine has already judged:
// what the student did right, the first place it went wrong and why, and the
// single next step. The words may come from the Pri tutor (grounded and
// checked on the server) or, when the tutor cannot answer, from Pri's own
// checker; either way the mark above is the engine's and does not move.
//
// The request goes through the local backend (POST /practice/:id/tutor/diagnose),
// which adds the verified solution this panel never sees.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useId, useRef, useState } from 'react';
import { api } from '../api.js';
import { MathText } from '../lib/latex.jsx';
import { useT } from '../i18n/index.js';
import './TutorHelp.css';

export default function MistakeDiagnosis({ questionId, work, finalAnswer, locale, onUsed, onClose }) {
  const t = useT();
  const headingId = useId();
  const panelRef = useRef(null);
  const [state, setState] = useState({ phase: 'asking' });

  useEffect(() => {
    let live = true;
    api.post(`/practice/${questionId}/tutor/diagnose`, { work, finalAnswer, locale })
      .then(r => {
        if (!live) return;
        if (Number.isInteger(r?.tutorLevel)) onUsed?.(r.tutorLevel);
        setState(r?.diagnosis ? { phase: 'done', diagnosis: r.diagnosis, source: r.source } : { phase: 'empty' });
      })
      .catch(() => { if (live) setState({ phase: 'empty' }); });
    return () => { live = false; };
    // One diagnosis per opening of the panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { panelRef.current?.focus(); }, []);

  const d = state.diagnosis;
  return (
    <section className="tutor-panel tutor-diagnosis no-print" aria-labelledby={headingId} tabIndex={-1} ref={panelRef} data-tutor-diagnosis>
      <header className="tutor-head">
        <h3 id={headingId}>{t('tutor.diagnose.title')}</h3>
        <button type="button" className="btn btn-quiet btn-sm" onClick={onClose} aria-label={t('tutor.diagnose.close')}>✕</button>
      </header>
      <div aria-live="polite">
        {state.phase === 'asking' && <p className="tutor-thinking" role="status">{t('tutor.diagnose.asking')}</p>}
        {state.phase === 'empty' && <p>{t('tutor.diagnose.unavailable')}</p>}
        {state.phase === 'done' && d && (
          <div className={`tutor-note tutor-note-${state.source}`} data-tutor-source={state.source}>
            <span className="tutor-note-src">
              {state.source === 'tutor' ? t('tutor.diagnose.fromTutor') : t('tutor.diagnose.fromChecker')}
            </span>
            <dl className="tutor-diagnosis-parts">
              {d.didRight ? (<><dt>{t('tutor.diagnose.right')}</dt><dd><MathText text={d.didRight} /></dd></>) : null}
              <dt>{t('tutor.diagnose.wrong')}</dt><dd><MathText text={d.wentWrong} /></dd>
              {d.nextStep ? (<><dt>{t('tutor.diagnose.next')}</dt><dd><MathText text={d.nextStep} /></dd></>) : null}
            </dl>
            <small className="tutor-note-why">{t('tutor.diagnose.markNote')}</small>
          </div>
        )}
      </div>
    </section>
  );
}
