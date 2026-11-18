// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · after a page is read: the page, and what Pri read, once
//
// Owner decision of 18 Nov 2026: the student's own handwriting is primary and
// the typeset reading is secondary. After a photo is read, ONE view shows the
// page large and the reading beside it as a compact list — words upright,
// maths typeset. Nothing is an input until the student asks: tapping a line
// opens it for changing or removing. Only a line the reader doubted (low
// confidence, or not well-formed) is marked, named in a plain sentence, and
// must be settled before the page can be marked.
//
// The list is the screen-reader source (an ordered list of buttons, each named
// by its line). Controlled and without logic of its own: photo/transcript.js
// decides, the card owns the state, the draft and the confirmation gate.
// Pressing "Mark my working" (in the card's footer) is the student's
// confirmation of exactly this reading.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useId, useState } from 'react';
import { MathText } from '../lib/latex.jsx';
import { defaultExclusions, prettyLine, segmentsFor } from '../photo/transcript.js';
import { splitWordsAndMaths } from '../photo/typeset.js';
import { PhotoPreview } from './PhotoFrame.jsx';

const plain = value => String(value ?? '')
  .replace(/⇔/g, '<=>').replace(/[⇒⟹]/g, '=>').replace(/[→⟶]/g, '->')
  .replace(/²/g, '^2').replace(/³/g, '^3');

const MARK_GLYPH = { ok: '✓', ecf: '✓', break: '✗', also: '✗' };
const MARK_KEY = { break: 'verdict.mistakeIsHere', also: 'verdict.alsoWrong', ecf: 'verdict.carriedForward' };

/** One line, set the way it reads: words upright, maths typeset. */
export function Typeset({ text, texOf, segments = null }) {
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

export default function ReadingReview({
  t, photo, transcript, marks = null, disabled = false, texOf = s => s,
  toConfirm = 0, firstToCheck = -1, confirmFocusRef = null,
  onEdit, onExclude, onKeep, onIncludeAll, onReplace, onRemove, children
}) {
  const uid = useId();
  const [open, setOpen] = useState(null);
  const lines = transcript?.lines || [];
  if (!lines.length) return null;
  const leftOut = defaultExclusions(transcript);
  const asksAt = i => { const l = lines[i]; return !!(l.check && !l.edited && !l.confirmed && !l.excluded); };
  const countText = toConfirm
    ? (toConfirm === 1 && firstToCheck >= 0 ? t('verdict.confirmCheckOne', { n: firstToCheck + 1 }) : t('verdict.confirmCheckMany', { count: toConfirm }))
    : '';
  return (
    <section className="reading-review" data-photo-lines data-reading-review aria-labelledby={`${uid}-title`}>
      {photo && (
        <div className="rr-page">
          <PhotoPreview t={t} src={photo} canRotate={false} canChange={!disabled}
            removeLabel={t('verdict.removePhoto')} busy={false} onReplace={onReplace} onRemove={onRemove} />
        </div>
      )}
      <div className="rr-read">
        <h3 className="sc-label" id={`${uid}-title`}>{t('photo.review.title')}</h3>
        {countText && <p className="rr-count" role="status" data-confirm-count>{countText}</p>}
        <ol className="rr-lines" aria-labelledby={`${uid}-title`}>
          {lines.map((line, i) => {
            const asks = asksAt(i);
            const editing = open === i && !disabled;
            const mark = Array.isArray(marks) && marks[i] && MARK_GLYPH[marks[i].kind] ? marks[i] : null;
            const note = line.excluded ? t('photo.lineLeftOut')
              : line.edited ? t('photo.lineEdited')
                : asks ? (line.doubt ? t('photo.lineCheckDoubt', { doubt: prettyLine(line.doubt) }) : t('photo.lineCheck')) : null;
            return (
              <li key={i} className={`rr-line${line.excluded ? ' is-out' : ''}${asks ? ' is-check' : ''}${mark ? ` is-marked pm-${mark.kind}` : ''}`}
                data-photo-line={i} data-excluded={line.excluded ? 'true' : undefined}
                data-check={asks ? 'true' : undefined} data-edited={line.edited ? 'true' : undefined}
                data-photo-mark={mark ? mark.kind : undefined}
                data-confirm-line={asks ? i : undefined} data-unsure={asks ? 'true' : undefined}
                tabIndex={asks && i === firstToCheck ? -1 : undefined} ref={asks && i === firstToCheck ? confirmFocusRef : undefined}>
                <span className="rr-n" aria-hidden="true">{i + 1}</span>
                {editing ? (
                  <div className="rr-edit">
                    <input className="input rr-input" data-photo-correct-transcript autoFocus
                      aria-label={t('photo.lineFieldLabel', { n: i + 1 })}
                      value={prettyLine(line.text)} disabled={line.excluded}
                      onChange={e => {
                        const el = e.target;
                        const caret = prettyLine(plain(el.value.slice(0, el.selectionStart ?? el.value.length))).length;
                        onEdit?.(i, plain(el.value));
                        requestAnimationFrame(() => { try { if (document.activeElement === el) el.setSelectionRange(caret, caret); } catch { /* not a field any more */ } });
                      }}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); setOpen(null); } }}
                      autoCapitalize="none" autoCorrect="off" spellCheck={false} inputMode="text" />
                    <button type="button" className="btn btn-quiet btn-sm" data-photo-line-toggle aria-pressed={!!line.excluded}
                      aria-label={t(line.excluded ? 'photo.lineIncludeLabel' : 'photo.lineExcludeLabel', { n: i + 1 })}
                      onClick={() => onExclude?.(i, !line.excluded)}>
                      {t(line.excluded ? 'photo.lineInclude' : 'photo.review.remove')}
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" data-photo-line-done onClick={() => setOpen(null)}>{t('photo.review.done')}</button>
                  </div>
                ) : (
                  <button type="button" className="rr-open" data-photo-line-open data-photo-line-text={prettyLine(line.text)} disabled={disabled}
                    aria-label={t('photo.review.lineLabel', { n: i + 1, text: prettyLine(line.text) })}
                    aria-describedby={note ? `${uid}-note-${i}` : undefined}
                    onClick={() => setOpen(i)}>
                    <Typeset text={line.text} texOf={texOf} segments={segmentsFor(line)} />
                  </button>
                )}
                {line.excluded && !editing && !disabled && (
                  <button type="button" className="btn btn-quiet btn-sm rr-back" data-photo-line-toggle aria-pressed="true"
                    aria-label={t('photo.lineIncludeLabel', { n: i + 1 })} onClick={() => onExclude?.(i, false)}>{t('photo.lineInclude')}</button>
                )}
                {note && <span className={`rr-note${asks ? ' is-doubt' : ''}`} id={`${uid}-note-${i}`}>{note}</span>}
                {asks && !disabled && (
                  <span className="rr-ask" role="group" aria-label={t('verdict.confirmWhich', { n: i + 1 })}>
                    <button type="button" className="btn btn-quiet btn-sm" data-confirm-keep={i} onClick={() => onKeep?.(i)}>{t('verdict.confirmThatsIt')}</button>
                    <button type="button" className="btn btn-quiet btn-sm" data-confirm-edit onClick={() => setOpen(i)}>{t('verdict.confirmEdit')}</button>
                  </span>
                )}
                {mark && (
                  <span className={`rr-mark photo-line-mark pm-${mark.kind}`}>
                    <span aria-hidden="true">{MARK_GLYPH[mark.kind]}</span>
                    {MARK_KEY[mark.kind] && <b>{t(MARK_KEY[mark.kind])}</b>}
                    {mark.note && <span className="photo-line-mark-note">{mark.note}</span>}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
        {leftOut > 0 && (
          <p className="rr-quiet" role="status" data-photo-left-out={leftOut}>
            {t('photo.leftOutDefault', { count: leftOut, n: leftOut })}{' '}
            {!disabled && <button type="button" className="btn btn-quiet btn-sm" data-photo-include-all onClick={onIncludeAll}>{t('photo.includeAll')}</button>}
          </p>
        )}
        {lines.some((l, i) => asksAt(i)) && <p className="rr-quiet" data-photo-reading-doubt>{t('photo.lineCheckNote')}</p>}
        {transcript.undecided && <p className="rr-quiet" role="status" data-photo-undecided>{t('photo.undecided')}</p>}
        {!disabled && <p className="rr-quiet muted">{t('photo.review.hint')}</p>}
        {children}
      </div>
    </section>
  );
}
