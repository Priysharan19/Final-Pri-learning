// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Getting started (Section 7.10)
//
// Three steps, in the order a student meets them: generate a question, write
// the answer, see the verdict. It is a quiet panel at the foot of Home, not a
// modal: nothing is covered, nothing is blocked, and a student who already
// knows can press Done or simply ignore it. It appears once per device for a
// profile with no attempts yet (a device setting, devicePrefs.js) and can be
// restarted from Settings → Help & Safety at any time.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { useT } from '../i18n/index.js';
import { useDevicePref } from './devicePrefs.js';
import './GettingStarted.css';

export const TUTORIAL_STEPS = Object.freeze([
  { id: 'generate', icon: 'practice', title: 'tutorial.step1Title', body: 'tutorial.step1Body' },
  { id: 'write', icon: 'pen', title: 'tutorial.step2Title', body: 'tutorial.step2Body' },
  { id: 'verdict', icon: 'check', title: 'tutorial.step3Title', body: 'tutorial.step3Body' }
]);

/**
 * @param show      whether Home wants it (a new profile, or a restart)
 * @param onStart   pressed on the last step: opens practice
 */
export default function GettingStarted({ show = false, focus = false, onStart }) {
  const t = useT();
  const [seen, setSeen] = useDevicePref('tutorialSeen');
  const [step, setStep] = useState(0);
  const headRef = useRef(null);
  const open = show && !seen;

  // The panel never takes focus on its own appearance: the page's first tab
  // stop stays the skip link, and the student lands where they were going. A
  // restart from Settings is an explicit request, so then — and only then —
  // the heading takes focus so a keyboard or reader user knows where they are.
  useEffect(() => { if (open) setStep(0); }, [open]);
  useEffect(() => { if (open && focus) headRef.current?.focus({ preventScroll: false }); }, [open, focus]);

  if (!open) return null;
  const current = TUTORIAL_STEPS[step];
  const last = step === TUTORIAL_STEPS.length - 1;
  const finish = () => { setSeen(true); };

  return (
    <section className="tutorial" aria-labelledby="tutorial-title" data-tutorial data-tutorial-step={current.id}>
      <div className="tutorial-head">
        <h2 className="tutorial-title" id="tutorial-title" tabIndex={-1} ref={headRef}>{t('tutorial.title')}</h2>
        <span className="tutorial-count" aria-hidden="true">{t('tutorial.stepOf', { n: step + 1, total: TUTORIAL_STEPS.length })}</span>
        <button type="button" className="icon-btn tutorial-close" aria-label={t('tutorial.skip')} title={t('tutorial.skip')} onClick={finish}><Icon name="close" size={16} /></button>
      </div>
      <ol className="tutorial-dots" aria-label={t('tutorial.title')}>
        {TUTORIAL_STEPS.map((s, i) => (
          <li key={s.id} className={`tutorial-dot${i === step ? ' is-on' : ''}${i < step ? ' is-done' : ''}`} aria-current={i === step ? 'step' : undefined}>
            <span className="tutorial-dot-n" aria-hidden="true">{i + 1}</span>
            <span className="sr-only">{t(s.title)}</span>
          </li>
        ))}
      </ol>
      <div className="tutorial-step" role="group" aria-live="polite" aria-label={t('tutorial.stepOf', { n: step + 1, total: TUTORIAL_STEPS.length })}>
        <span className="tutorial-ico" aria-hidden="true"><Icon name={current.icon} size={22} /></span>
        <div>
          <div className="tutorial-step-title">{t(current.title)}</div>
          <p className="tutorial-step-body">{t(current.body)}</p>
        </div>
      </div>
      <div className="tutorial-actions">
        {step > 0 && <button type="button" className="btn btn-quiet btn-sm" onClick={() => setStep(s => s - 1)}>{t('tutorial.back')}</button>}
        {!last && <button type="button" className="btn btn-ghost btn-sm" data-tutorial-next onClick={() => setStep(s => s + 1)}>{t('tutorial.next')}</button>}
        {last && (
          <>
            <button type="button" className="btn btn-ghost btn-sm" data-tutorial-done onClick={finish}>{t('tutorial.done')}</button>
            {onStart && <button type="button" className="btn btn-ghost btn-sm" data-tutorial-start onClick={() => { finish(); onStart(); }}>{t('tutorial.tryOne')}</button>}
          </>
        )}
      </div>
    </section>
  );
}
