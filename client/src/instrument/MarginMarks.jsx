// ─────────────────────────────────────────────────────────────────────────────
// The Check sweep (motion signature 1). One ink hairline passes down the working
// once, and each line's mark stamps in as it reaches the line. It only shows
// marks the server has already committed (lineVerdicts): it never decides which
// line gets which verdict, and it is mounted only while the shell says it is
// marked (data-marked="yes", CSS), so it never runs on an unmarked surface.
// Reduced motion: no hairline; the marks fade in at once (CSS).
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { useT } from '../i18n/index.js';

export const SWEEP_MS = 900;

/** The marked span of the page, top of the first marked line to the foot of the last. */
export function sweepSpan(lines, lineVerdicts) {
  const marked = (lines || []).filter((l, i) => l?.box && ['ok', 'break', 'wrong'].includes(lineVerdicts?.[i]?.status));
  if (!marked.length) return null;
  const y0 = Math.min(...marked.map(l => l.box.y));
  const y1 = Math.max(...marked.map(l => l.box.y + l.box.h));
  return { y0, y1 };
}

/** Milliseconds after the sweep starts at which the hairline reaches this line's centre. */
export function stampDelay(span, box) {
  if (!span || !box || span.y1 <= span.y0) return 0;
  const f = ((box.y + box.h / 2) - span.y0) / (span.y1 - span.y0);
  return Math.round(Math.min(1, Math.max(0, f)) * SWEEP_MS);
}

export default function MarginMarks({ lines, lineVerdicts }) {
  const t = useT();
  const span = sweepSpan(lines, lineVerdicts);
  const [spoken, setSpoken] = useState(false);
  const reduce = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  useEffect(() => {
    if (!span) return undefined;
    // Announced once, when the sweep ends (at once under reduced motion), never per frame.
    const id = setTimeout(() => setSpoken(true), reduce ? 0 : SWEEP_MS + 100);
    return () => clearTimeout(id);
  }, [!!span, reduce]);
  if (!span) return null;
  const said = (lines || []).map((l, i) => {
    const s = lineVerdicts?.[i]?.status;
    if (!l?.box || !['ok', 'break', 'wrong'].includes(s)) return null;
    return t(s === 'ok' ? 'ink.lineOkSpoken' : 'ink.lineBreaksSpoken', { n: i + 1 });
  }).filter(Boolean).join(' ');
  return (
    <>
      <div className="in-sweep" aria-hidden="true"><i style={{ '--y0': `${span.y0}px`, '--y1': `${span.y1}px` }} /></div>
      <span className="sr-only" role="status" aria-live="polite" data-margin-marks>{spoken ? said : ''}</span>
    </>
  );
}
