// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Photo mode — the lines read from the student's page
//
// Every line the reader returned, in page order, each one editable where it
// stands. Nothing is hidden: a line left out of the answer stays on screen,
// struck through, with one control to bring it back. A line the reader was not
// sure of says so, as a doubt about the READING — it is never presented as a
// mistake in the student's mathematics, and it is never corrected for them.
//
// Controlled and without logic of its own: photo/transcript.js decides, the
// card owns the state and the draft.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useId, useState } from 'react';
import { useT } from '../i18n/index.js';
import { defaultExclusions, prettyLine } from '../photo/transcript.js';

// What a student types while correcting a line, in the marker's spelling.
// Same symbols, same meaning: ≥ and >= are one relation.
const plain = value => String(value ?? '')
  .replace(/⇔/g, '<=>').replace(/[⇒⟹]/g, '=>').replace(/[→⟶]/g, '->')
  .replace(/²/g, '^2').replace(/³/g, '^3');

export default function PhotoLines({ transcript, disabled = false, onEdit, onExclude, onIncludeAll }) {
  const t = useT();
  const uid = useId();
  // A line being typed in shows exactly what is stored; at rest it is drawn
  // with the proper signs. Switching while typing would move the caret.
  const [focused, setFocused] = useState(-1);
  const lines = transcript?.lines || [];
  if (!lines.length) return null;
  const leftOut = defaultExclusions(transcript);
  const anyCheck = lines.some(l => l.check && !l.edited && !l.excluded);
  return (
    <div className="photo-lines" data-photo-lines>
      <div className="sc-label" id={`${uid}-title`}>{t('photo.linesTitle')}</div>
      <p className="muted photo-lines-help">{t('photo.linesHelp')}</p>
      {leftOut > 0 && (
        <p className="photo-lines-note" role="status" data-photo-left-out={leftOut}>
          {t('photo.leftOutDefault', { count: leftOut, n: leftOut })}{' '}
          {!disabled && <button type="button" className="btn btn-ghost btn-sm" data-photo-include-all onClick={onIncludeAll}>{t('photo.includeAll')}</button>}
        </p>
      )}
      {transcript.undecided && <p className="photo-lines-note" role="status" data-photo-undecided>{t('photo.undecided')}</p>}
      <ol className="photo-lines-list" aria-labelledby={`${uid}-title`}>
        {lines.map((line, i) => {
          const noteId = `${uid}-note-${i}`;
          const asks = line.check && !line.edited && !line.excluded;
          return (
            <li key={i} className={`photo-line${line.excluded ? ' is-out' : ''}${asks ? ' is-check' : ''}`}
              data-photo-line={i} data-excluded={line.excluded ? 'true' : undefined}
              data-check={asks ? 'true' : undefined} data-edited={line.edited ? 'true' : undefined}>
              <span className="photo-line-n" aria-hidden="true">{i + 1}</span>
              <input className="input photo-line-text" data-photo-correct-transcript
                aria-label={t('photo.lineFieldLabel', { n: i + 1 })}
                aria-describedby={asks || line.edited || line.excluded ? noteId : undefined}
                value={focused === i ? line.text : prettyLine(line.text)}
                disabled={disabled || line.excluded}
                onFocus={() => setFocused(i)} onBlur={() => setFocused(f => (f === i ? -1 : f))}
                onChange={e => onEdit?.(i, plain(e.target.value))}
                autoCapitalize="none" autoCorrect="off" spellCheck={false} inputMode="text" />
              {!disabled && (
                <button type="button" className="btn btn-quiet btn-sm photo-line-toggle"
                  data-photo-line-toggle aria-pressed={line.excluded}
                  aria-label={t(line.excluded ? 'photo.lineIncludeLabel' : 'photo.lineExcludeLabel', { n: i + 1 })}
                  onClick={() => onExclude?.(i, !line.excluded)}>
                  {t(line.excluded ? 'photo.lineInclude' : 'photo.lineExclude')}
                </button>
              )}
              {(asks || line.edited || line.excluded) && (
                <span className="photo-line-note" id={noteId}>
                  {line.excluded ? t('photo.lineLeftOut')
                    : line.edited ? t('photo.lineEdited')
                      : line.doubt ? t('photo.lineCheckDoubt', { doubt: prettyLine(line.doubt) }) : t('photo.lineCheck')}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {anyCheck && <p className="muted photo-lines-help" data-photo-reading-doubt>{t('photo.lineCheckNote')}</p>}
    </div>
  );
}
