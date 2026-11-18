// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · render a structured paper's text blocks
//
// The blocks are the converter's (tools/papers/latex.mjs): paragraphs with
// $inline maths$, display maths, lists and figure references. Maths goes
// through the one KaTeX component the rest of the app uses, so it is spoken,
// sized and themed like every other formula.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { MathText } from '../lib/latex.jsx';
import { useT } from '../i18n/index.js';
import { figureUrl } from './paperApi.js';

/** One diagram of the paper, fetched with the session and shown on a white sheet (diagrams are black on white). */
export function PaperFigure({ attemptId, name }) {
  const t = useT();
  const [src, setSrc] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    figureUrl(attemptId, name).then(url => { if (live) setSrc(url); }).catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [attemptId, name]);
  if (failed) return <p className="muted pp-figure-missing" role="status">{t('paper.figureFailed')}</p>;
  return (
    <figure className="pp-figure" data-paper-figure={name}>
      {src ? <img src={src} alt={t('paper.figureAlt')} /> : <span className="pp-figure-wait" role="status">{t('paper.figureLoading')}</span>}
    </figure>
  );
}

export default function Blocks({ blocks = [], attemptId = null, inline = false }) {
  return (
    <>
      {blocks.map((b, i) => {
        if (b.k === 'math') return <div key={i} className="pp-display"><MathText text={b.t} display /></div>;
        if (b.k === 'list') {
          const List = b.ordered ? 'ol' : 'ul';
          return <List key={i} className="pp-list">{b.items.map((item, j) => <li key={j}><MathText text={item} /></li>)}</List>;
        }
        if (b.k === 'fig') return attemptId ? <PaperFigure key={i} attemptId={attemptId} name={b.name} /> : null;
        return inline
          ? <span key={i}><MathText text={b.t} /> </span>
          : <p key={i} className="pp-p">{b.t.split('\n').map((line, j) => <React.Fragment key={j}>{j ? <br /> : null}<MathText text={line} /></React.Fragment>)}</p>;
      })}
    </>
  );
}
