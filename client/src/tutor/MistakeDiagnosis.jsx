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
import AiLabel from './AiLabel.jsx';
import { useT, useLanguage } from '../i18n/index.js';
import { EngineComment } from '../components/EngineComment.jsx';
import { lineReportFacts } from '../components/lineReportText.js';
import './TutorHelp.css';

export default function MistakeDiagnosis({ questionId, work, finalAnswer, locale, onUsed, onClose, lineInput = null }) {
  const t = useT();
  const { language } = useLanguage();
  // The line report is the engine's own word on each line. When it has a tick or a cross, this panel says what it says (correct up to
  // line N; the first error on line M and why) instead of a general sentence that can disagree with the ticks beside it.
  const report = React.useMemo(() => {
    const r = lineReportFacts(lineInput, { language, t });
    // With no cross, the report can only say the checked lines are right and the final answer is not: only when the final answer is wrong.
    return r && (r.first || finalAnswer === 'wrong') ? r : null;
  }, [lineInput, language, t, finalAnswer]);
  const headingId = useId();
  const panelRef = useRef(null);
  const [state, setState] = useState({ phase: 'asking' });

  useEffect(() => {
    let live = true;
    api.post(`/practice/${questionId}/tutor/diagnose`, { work, finalAnswer, locale })
      .then(r => {
        if (!live) return;
        if (Number.isInteger(r?.tutorLevel)) onUsed?.(r.tutorLevel);
        setState(r?.distress ? { phase: 'safety', message: r.message } : r?.diagnosis ? { phase: 'done', diagnosis: r.diagnosis, source: r.source } : { phase: 'empty' });
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
        {state.phase === 'safety' && <div className="tutor-note tutor-note-safety" role="status" data-tutor-source="safety"><MathText text={state.message} /></div>}
        {state.phase === 'done' && d && (
          <div className={`tutor-note tutor-note-${state.source}`} data-tutor-source={state.source}>
            <span className="tutor-note-src">
              {state.source === 'tutor' ? null : t('tutor.diagnose.fromChecker')}
            </span>
            {state.source === 'tutor' && <AiLabel labelKey={'tutor.diagnose.fromTutor'} />}
            <dl className="tutor-diagnosis-parts">
              {report ? (
                <>
                  <dt>{t(report.first ? 'tutor.diagnose.wrong' : 'tutor.diagnose.report')}</dt>
                  <dd data-diagnose-report>
                    {report.upTo ? <span data-diagnose-upto>{t('tutor.diagnose.upTo', { n: report.upTo })} </span> : null}
                    {report.first
                      ? <span data-diagnose-first>{t('tutor.diagnose.first', { n: report.first.n })}{report.first.comment ? <> <EngineComment text={report.first.comment} lang={language} /></> : null}</span>
                      : <span data-diagnose-final>{t('tutor.diagnose.finalNotCorrect')}</span>}
                  </dd>
                  {state.source === 'tutor' && d.wentWrong ? (<><dt>{t('tutor.diagnose.explain')}</dt><dd><MathText text={d.wentWrong} /></dd></>) : null}
                </>
              ) : (
                <>
                  {d.didRight ? (<><dt>{t('tutor.diagnose.right')}</dt><dd><MathText text={d.didRight} /></dd></>) : null}
                  <dt>{t('tutor.diagnose.wrong')}</dt><dd><MathText text={d.wentWrong} /></dd>
                </>
              )}
              {d.nextStep ? (<><dt>{t('tutor.diagnose.next')}</dt><dd><MathText text={d.nextStep} /></dd></>) : null}
            </dl>
            <small className="tutor-note-why">{t('tutor.diagnose.markNote')}</small>
          </div>
        )}
      </div>
    </section>
  );
}
