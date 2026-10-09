// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Type mode — the final answer and the working that earns marks
//
// Two labelled places: the Final answer, and — whenever the engine can verify
// working for this question — the Working. A question that carries method
// marks shows its working area without being asked; a one-mark question keeps
// it behind one labelled control. The component is controlled and holds no
// marking logic: the parent owns the text, the drafts and the submission.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useId } from 'react';
import { MathText } from '../lib/latex.jsx';
import { useT } from '../i18n/index.js';
import Icon from './Icon.jsx';
import { workingAreaMode } from './typedAnswerGuide.js';

export default function TypedAnswerFields({
  question, totalMarks = 1, answer, working, onAnswer, onWorking, onSubmit,
  previewTex = null, resolved = false, inputRef = null,
  showWorking = false, onToggleWorking, guidance = null, onMoveToWorking, offerWorking = true
}) {
  const t = useT();
  const uid = useId();
  const answerId = `${uid}-final`, workingId = `${uid}-working`, noteId = `${uid}-note`, hintId = `${uid}-hint`;
  const area = resolved || !offerWorking ? 'none' : workingAreaMode(question, totalMarks);
  const workingField = (
    <textarea
      id={workingId} className="input" style={{ marginTop: 8 }} data-typed-working
      aria-label={area === 'toggle' ? t('verdict.workingPartialAria') : undefined}
      aria-describedby={area === 'open' ? hintId : undefined}
      placeholder={area === 'open' ? t('verdict.workingAreaPlaceholder') : t('verdict.workingPartialPlaceholder')}
      value={working} onChange={e => onWorking(e.target.value)}
      rows={area === 'open' ? 5 : undefined}
      autoCapitalize="none" autoCorrect="off" spellCheck={false}
    />
  );
  return (
    <>
      <label className="sc-label" style={{ display: 'block' }} htmlFor={answerId} data-final-answer-label>{t('verdict.finalAnswer')}</label>
      <div className="answer-row">
        {question.answerPrefix && <span className="answer-prefix"><MathText text={question.answerPrefix} /></span>}
        <input
          id={answerId} ref={inputRef} className="answer-input" data-final-answer
          aria-label={question.answerSuffix ? t('verdict.answerAriaWithUnit', { unit: question.answerSuffix }) : t('verdict.answerAria')}
          aria-describedby={guidance ? noteId : undefined}
          aria-invalid={guidance ? 'true' : undefined}
          placeholder={question.inputHint || t('verdict.answerPlaceholder')}
          value={answer} disabled={resolved}
          onChange={e => onAnswer(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onSubmit?.(); }}
          autoCapitalize="none" autoCorrect="off" spellCheck={false}
          // Answers are expressions as often as numbers (x², 3/4, √2), so a
          // numeric keypad would block them: keep the full keyboard and label
          // its Enter key as the submit action.
          inputMode="text" enterKeyHint="go"
        />
        {question.answerSuffix && <span className="answer-suffix">{question.answerSuffix}</span>}
      </div>
      {previewTex && !resolved && (
        <div className="typed-preview" data-typed-preview>{t('verdict.readsAs')}&nbsp; <MathText text={`$${previewTex}$`} /></div>
      )}
      {guidance && !resolved && (
        <div id={noteId} role="status" data-final-answer-guidance style={{ marginTop: 8, fontSize: 13.5 }}>
          <b>{t(guidance.titleKey)}</b> {t(guidance.bodyKey)}
          {guidance.workingKey && <> {t(guidance.workingKey)}</>}
          {guidance.canMoveToWorking && onMoveToWorking && (
            <div style={{ marginTop: 8 }}>
              <button type="button" className="btn btn-ghost btn-sm" data-move-to-working onClick={onMoveToWorking}>
                {t('verdict.moveToWorking')}
              </button>
            </div>
          )}
        </div>
      )}
      {area === 'open' && (
        <div style={{ marginTop: 18 }} data-working-area="open">
          <label className="sc-label" style={{ display: 'block', marginBottom: 6 }} htmlFor={workingId}>{t('verdict.workingLabel')}</label>
          <div id={hintId} className="muted" style={{ fontSize: 13.5 }}>{t('verdict.workingMethodMarks', { marks: totalMarks })}</div>
          {workingField}
        </div>
      )}
      {area === 'toggle' && (
        <div style={{ marginTop: 14 }} data-working-area="toggle">
          <button type="button" className="btn-disclose" aria-expanded={showWorking} aria-controls={workingId} onClick={onToggleWorking}>
            <Icon name="chevronDown" size={16} />{t('verdict.showWorkingToggle')}
          </button>
          {showWorking && workingField}
        </div>
      )}
    </>
  );
}
