// Pri Learning · one comment on a marked line, and the one quiet note about who wrote them.
//
// The comment is words about a line the engine has already judged. It is typeset (maths in $…$ through
// MathText), clamped to two lines with a "Show more", and labelled when the engine could not check the line.
// It never carries a tick, a cross or a mark: the card around it does, from the engine.
import React, { useState } from 'react';
import { MathText } from '../lib/latex.jsx';
import { useT } from '../i18n/index.js';
import { hasAiComments, isLongComment } from './lineCommentsModel.js';
import './LineComment.css';

export function LineComment({ c, n = null }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  if (!c?.text) return null;
  const long = isLongComment(c.text);
  return (
    <div className="lc" data-lc={c.source} data-lc-kind={c.kind} {...(n ? { 'data-lc-line': n } : {})}>
      <p className={`lc-text${open ? ' is-open' : ''}`} data-lc-text><MathText text={c.text} /></p>
      {long && <button type="button" className="lc-more" aria-expanded={open} onClick={e => { e.stopPropagation(); setOpen(o => !o); }}>{t(open ? 'mp.comment.less' : 'mp.comment.more')}</button>}
    </div>
  );
}

/** Once per page, only when a model wrote at least one comment. */
export function AiNote({ comments }) {
  const t = useT();
  return hasAiComments(comments) ? <p className="mp-ai-note" data-mp-ai-note>{t('mp.aiNote')}</p> : null;
}
