// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the worked steps after a guest's wrong answer (ADR-0003)
//
// The server decides everything here: it releases the first step with the first
// wrong verdict, the next steps one request at a time, and the answer only as the
// step after the last (which closes the question, so no retry follows it). This
// module holds what the server has released so far and draws it with the same
// `.steps` markup and typesetting the signed-in solution uses (QuestionCard.jsx).
// It marks nothing and holds no key.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MathText } from '../lib/latex.jsx';
import { stepsGuest } from './guestTrial.js';

/** What the server has released for one question: { steps, total, retry, moreForms, answer } or null before a first wrong verdict. */
export function useWorked() {
  const [worked, setWorked] = useState(null);
  const [asking, setAsking] = useState(false);
  const [trouble, setTrouble] = useState(null);
  const flying = useRef(false);

  const clear = useCallback(() => { setWorked(null); setTrouble(null); }, []);
  /** A first wrong verdict that released the first step and left the question open for one more try. */
  const open = useCallback(out => setWorked({ steps: out.step ? [out.step] : [], total: out.total || 0, retry: out.retry === true, endsNext: out.endsNext === true, moreForms: out.moreForms === true, answer: null }), []);
  /** A verdict that closed the question: the answer is known, so no retry remains; steps already shown stay. */
  const close = useCallback(out => setWorked(prev => ({ steps: prev?.steps || [], total: prev?.total || 0, retry: false, moreForms: out.moreForms === true || prev?.moreForms === true, answer: out.answer ?? prev?.answer ?? null })), []);
  /** The next step, or (after the last) the answer. Resolves the server's reply, or null when it could not be had. */
  const more = useCallback(async sealed => {
    if (flying.current || !worked) return null;
    flying.current = true; setAsking(true); setTrouble(null);
    try {
      const out = await stepsGuest({ sealed, step: worked.steps.length + 1 });
      setWorked(prev => {
        if (!prev) return prev;
        const steps = out.step && prev.steps.length < out.shown ? [...prev.steps, out.step] : prev.steps;
        // A step that states the answer is the answer: it closes the question, as the answer after the last step does.
        return { ...prev, steps, total: out.total ?? prev.total, endsNext: out.endsNext === true, ...(out.resolved ? { retry: false, answer: out.answer ?? prev.answer } : {}) };
      });
      return out;
    } catch (error) { setTrouble(error.reason || 'offline'); return null; }
    finally { flying.current = false; setAsking(false); }
  }, [worked]);
  return { worked, asking, trouble, open, close, more, clear };
}

/** True while the server still has a step, or the answer, to release after those shown. */
export const hasMore = worked => !!worked && worked.total > 0 && (worked.steps.length < worked.total || worked.answer == null);
/** True when the next press would release the answer, not a step. */
export const nextIsAnswer = worked => !!worked && worked.steps.length >= worked.total && worked.answer == null;

/** The steps released so far. Focus moves to each newly revealed step, so it is read once, by the screen reader's own focus announcement. */
export function WorkedSteps({ steps, heading, label, idPrefix = 'gt', headingTag: H = 'h2', className = '' }) {
  const last = useRef(null);
  const seen = useRef(0);
  useEffect(() => {
    if (steps.length > seen.current) last.current?.focus({ preventScroll: false });
    seen.current = steps.length;
  }, [steps.length]);
  if (!steps.length) return null;
  return (
    <section className={`gt-worked ${className}`.trim()} aria-labelledby={`${idPrefix}-worked-h`} data-guest-steps={steps.length}>
      <H id={`${idPrefix}-worked-h`} className="gt-worked-k">{heading}</H>
      <ol className="steps gt-steps">
        {steps.map((s, i) => (
          <li className="step" key={i} tabIndex={-1} ref={i === steps.length - 1 ? last : null} data-guest-step={i + 1}>
            <span className="step-n" aria-hidden="true">{i + 1}</span>
            <div>
              <span className="sr-only">{label(i + 1)}</span>
              <div className="step-h" lang="en"><MathText text={s.h} /></div>
              <div className="step-d" lang="en"><MathText text={s.d} /></div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

const TROUBLE_KEY = { steps: 'guest.stepsUnavailable', expired: 'guest.expired', fast: 'guest.tooFast', 'marking-busy': 'guest.busy' };

/**
 * What a visitor can do with the working: try the question again (once, until the answer is shown) and read the next step.
 * `phase` is 'worked' (a first wrong answer, the retry still open) or 'closed' (the question has its verdict).
 */
export function WorkedControls({ worked, phase, retrying, asking, trouble, onRetry, onMore, t, prefix }) {
  const more = hasMore(worked);
  const toAnswer = nextIsAnswer(worked);
  const link = prefix === 'gp' ? 'gp-link' : 'btn btn-ghost';
  const ends = toAnswer || worked.endsNext === true;
  return (
    <div className={`${prefix}-worked-controls`} data-guest-worked-controls>
      <div className={`${prefix}-actions`}>
        {phase === 'worked' && !retrying && worked.retry && (
          <button type="button" className="btn btn-primary" data-guest-retry onClick={onRetry} disabled={asking}>{t('guest.tryAgain')}</button>
        )}
        {more && (
          <button type="button" className={link} data-guest-more={toAnswer ? 'answer' : 'step'} onClick={onMore} disabled={asking} aria-describedby={ends && phase === 'worked' ? `${prefix}-answer-note` : undefined}>
            {toAnswer ? t('guest.showAnswer') : t('guest.showNextStep')}
          </button>
        )}
      </div>
      {phase === 'worked' && worked.retry && (
        <p className={`${prefix}-quiet`} id={`${prefix}-answer-note`} data-guest-retry-note>{retrying ? t('guest.retryOpen') : t('guest.retryNote')}{ends ? ` ${t(toAnswer ? 'guest.showAnswerNote' : 'guest.nextEndsNote')}` : ''}</p>
      )}
      {trouble && <p className={`${prefix}-problem`} role="alert" data-guest-problem>{t(TROUBLE_KEY[trouble] || 'guest.offline')}</p>}
    </div>
  );
}
