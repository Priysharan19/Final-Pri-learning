// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · an English label with its NCERT Hindi beside it.
//
// The English is rendered exactly as it was — one unbroken string, not spliced
// around — and the Hindi terms follow it. Nothing is replaced and nothing is
// hidden behind an interaction: the paper this student will sit shows both
// languages at once with English authoritative, and the closest thing an app
// can do to that is show both at once.
//
// WHY THE HINDI GOES AT THE END and not inline against each word. Inline gives
// "Coordinate · निर्देशांक Geometry · ज्यामिति", which is accurate and unreadable,
// and it breaks the English phrase into pieces. Trailing gives "Coordinate
// Geometry · निर्देशांक, ज्यामिति", where the English still reads as the phrase
// it is. That is also the stronger guarantee: the English is not merely
// present, it is untouched, and the contract suite asserts exactly that.
//
// No tap, no hover, no tooltip. A tap-to-reveal on an iPad is a tap a student
// has to make on every chapter name, and a hover title is invisible to touch
// entirely. The terms are one or two words; showing them costs a line nobody
// has to work for.
//
// When the bridge is off, or the glossary chunk has not arrived, or the label
// mentions no term this app can source from an NCERT page, the output is the
// plain string the caller passed in. There is no state in which turning the
// bridge on removes something a reader could see before.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { useApp } from '../App.jsx';
import { termsIn, useGlossary } from '../i18n/glossary.js';

/**
 * `text` is the English label the app was already showing. Callers pass the
 * same string they would have rendered bare, so deleting this component
 * anywhere leaves the screen correct — just without the bridge.
 */
export default function TermGloss({ text }) {
  const { user } = useApp();
  const glossary = useGlossary(user?.mathsGloss === true);
  const label = String(text ?? '');
  if (!glossary || !label) return <>{label}</>;

  const terms = termsIn(label);
  if (!terms.length) return <>{label}</>;

  return (
    <>
      {label}
      {/* lang is not decoration: it picks the Devanagari face, and it tells a
          screen reader to switch voice rather than spell the letters out. */}
      <span className="gloss-hi" lang="hi"> · {terms.map(t => t.hi).join(', ')}</span>
    </>
  );
}
