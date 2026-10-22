import React from 'react';
import { useT } from '../i18n/index.js';
import PMark from './margin/PMark.jsx';

// The sign-in's left half: C's own object at rest, the P′ bezel large on the
// desk, with the product's line under one engraved rule. Decorative
// (aria-hidden); no curves, no graph paper. Instrument build only.
export default function SignInPlot() {
  const t = useT();
  return (
    <div className="in-signin-plot c-signin-desk" aria-hidden="true">
      <div className="c-signin-object"><PMark size={320} engrave /></div>
      <p className="in-signin-line">{t('login.instrumentHeadline')}</p>
    </div>
  );
}
