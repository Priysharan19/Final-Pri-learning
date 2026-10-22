import React from 'react';
import PMark from './margin/PMark.jsx';

// The sign-in's brand: the one mark (PMark) over "Pri" in Instrument Serif and
// "Learning" in Cormorant SC. Instrument build only; replaces the sans
// wordmark there.
export default function SignInMark() {
  return (
    <div className="c-signin-mark">
      <PMark size={56} />
      <p className="c-signin-word" aria-label="Pri Learning"><span>Pri</span> <small>Learning</small></p>
    </div>
  );
}
