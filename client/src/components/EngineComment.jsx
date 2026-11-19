// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · one comment from the marking engines, with its maths typeset
//
// The engines write English sentences about a line ("Worked out, each side comes to $\frac{64}{3}$.") and mark
// the maths inside with `$…$`. This sets the sentence as prose and the marked maths as typeset maths. The
// sentence is English whatever the interface language is, so its own element says so (the Hindi interface
// must never show English text without `lang="en"`). A comment with no `$` is shown exactly as written, and
// so is one whose dollars do not pair up: nothing is ever half typeset.
//
// Only engine comments belong here. Translated interface strings are never passed through it.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { MathText } from '../lib/latex.jsx';
import { dollarsBalanced } from '../engine/commentTex.js';

export function EngineComment({ text, className }) {
  const s = String(text ?? '');
  const maths = s.includes('$') && dollarsBalanced(s);
  return <span lang="en" className={className} data-engine-comment>{maths ? <MathText text={s} /> : s}</span>;
}

export default EngineComment;
