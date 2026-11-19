// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · one line of a reading, set the way it reads
//
// Owner decision, 19 Nov 2026: the typed reading is not shown by default anywhere (it superseded the 18 Nov view of
// the page with its reading beside it). It is available on demand from the marked page, and this is how a line of it
// is set: words upright, maths typeset. The reading list and its confirmation are gone (ADR-0001 amendment).
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { MathText } from '../lib/latex.jsx';
import { prettyLine } from '../photo/transcript.js';
import { splitWordsAndMaths } from '../photo/typeset.js';

/** One line, set the way it reads: words upright, maths typeset. */
export function Typeset({ text, texOf, segments = null, tex = null }) {
  // The reader's own TeX for the line (validated, still describing the line as shown): set from it, through the same
  // MathText path, so what is drawn is what was written. It carries no words (the caller checks), so no language is set.
  if (tex) return <span className="rr-text"><span className="rr-maths" data-from-latex><MathText text={`$${tex}$`} /></span></span>;
  // The reader's own split (words versus maths) when it still restates the line; else the heuristic split.
  const runs = segments
    ? segments.map(p => ({ kind: p.kind === 'text' ? 'words' : 'maths', text: p.kind === 'text' ? p.value : prettyLine(p.value) }))
    : splitWordsAndMaths(prettyLine(text));
  return (
    <span className="rr-text">
      {runs.map((run, i) => (run.kind === 'words'
        ? <span key={i} className="rr-words" lang="en">{run.text} </span>
        : <span key={i} className="rr-maths"><MathText text={`$${texOf(run.text)}$`} /> </span>))}
    </span>
  );
}
