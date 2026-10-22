import React from 'react';
import PMark from './margin/PMark.jsx';

// The sign-in's brand: the one lock-up, the P′ mark with the "Pri Learning"
// wordmark in the C serif (PR1's PMark). Instrument build only; it replaces
// the sans wordmark there.
export default function SignInMark() {
  return <div className="c-signin-mark"><PMark size={40} wordmark /></div>;
}
