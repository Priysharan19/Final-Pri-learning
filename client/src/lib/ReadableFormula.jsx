// A formula a keyboard user can reach and have read (notes, worked examples).
//
// The formula is drawn by MathText (the one escaped KaTeX sink), focusable, with a role="math" wrapper
// whose name is the spoken maths. "Read formula" shows that spoken form and announces it through a
// polite live region, so it can be heard again or checked by eye.
import { useMemo, useState } from 'react';
import { MathText, useMathLocale } from './latex.jsx';
import { speakMath } from './mathSpeech.js';

export function ReadableFormula({ tex, className = '', label = 'Formula', readLabel = 'Read formula', hideLabel = 'Hide reading' }) {
  const locale = useMathLocale();
  const [shown, setShown] = useState(false);
  const spoken = useMemo(() => speakMath(tex, locale), [tex, locale]);
  return (
    <div className={`pri-readable ${className}`.trim()}>
      <MathText block focusable text={`$${tex}$`} />
      <button type="button" className="pri-readable-btn" aria-expanded={shown} aria-label={`${readLabel}: ${label}`} onClick={() => setShown(v => !v)}>{shown ? hideLabel : readLabel}</button>
      <p className="pri-readable-text" role="status" aria-live="polite">{shown ? spoken : ''}</p>
    </div>
  );
}
