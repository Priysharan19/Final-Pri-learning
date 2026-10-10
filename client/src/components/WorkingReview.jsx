// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the marked working, line by line
//
// Renders the server's per-line review (engine/workingReview.js) of exactly the
// lines that were submitted — typed, written or photographed, the same object
// and the same panel. It decides nothing: every tick, cross and mark here is
// the review's, and where the review says "not checked" so does this.
//
//   ✓  verified            →  follows from the earlier slip (right for your value)
//   ✗  the first mistake   ?  a reading to confirm          ·  not checked
//
// Nothing is claimed that the review does not state: "every line verified" is
// said only when the review is `certified`. A review that is not of the lines
// the card says were submitted (`lines`) is not drawn at all.
//
// WorkingHint is the same idea before anything is marked: the first line of the
// student's own working that is not true of the line before it, found on the
// device from the lines alone (engine/lineAudit.js). It holds no key and never
// states the value the line should have had.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useMemo } from 'react';
import { useT } from '../i18n/index.js';
import { prettyLine } from '../photo/transcript.js';
import { workingHint } from '../engine/lineAudit.js';
import { promptLetters } from '../engine/workingReview.js';
import './WorkingReview.css';

const MARK = Object.freeze({ verified: '✓', 'follows-through': '→', 'first-mistake': '✗', 'later-mistake': '✗', 'after-mistake': '·', confirm: '?', 'not-checked': '·' });
const TONE = Object.freeze({ verified: 'ok', 'follows-through': 'carried', 'first-mistake': 'break', 'later-mistake': 'break', 'after-mistake': 'note', confirm: 'confirm', 'not-checked': 'note' });
// Said aloud before each line, so the mark is never colour or a glyph alone.
const SPOKEN = Object.freeze({
  verified: 'review.check.verified', 'follows-through': 'review.check.followsThrough', 'first-mistake': 'review.check.firstMistake',
  'later-mistake': 'review.check.laterMistake', 'after-mistake': 'review.check.afterMistake', confirm: 'review.check.confirm', 'not-checked': 'review.check.notChecked'
});
const clean = v => String(v ?? '').trim();

/** Is this review a review of exactly these submitted lines? (Blank lines keep their place in both.) */
export function reviewIsOf(review, lines) {
  if (!review || !Array.isArray(review.lines)) return false;
  if (!Array.isArray(lines)) return true;                 // nothing to compare against: the server's own snapshot stands
  const written = lines.map(clean).filter(Boolean);
  const reviewed = review.lines.filter(l => l.read === 'submitted').map(l => clean(l.text));
  return written.length === reviewed.length && written.every((text, i) => text === reviewed[i]);
}

/**
 * `lineNumber(index)` maps a submitted line's index to the number the student
 * sees beside it (the photographed page counts lines that were left out).
 */
export default function WorkingReview({ review, lines = null, lineNumber = null }) {
  const t = useT();
  if (!review || review.version !== 1 || !reviewIsOf(review, lines)) return null;
  const written = review.lines.filter(l => l.read === 'submitted');
  if (!written.length) return null;
  const numberOf = l => (typeof lineNumber === 'function' ? lineNumber(l.n) : l.n + 1);
  const first = review.firstMistake;
  const marks = review.marks;
  const where = first ? t(first.position === 'last' ? 'review.whereLast' : 'review.whereLine', { n: numberOf(first) }) : '';
  return (
    <section className="working-review" data-working-review data-certified={review.certified ? 'true' : 'false'}
      data-matches-question={review.matchesQuestion === false ? 'false' : undefined} aria-label={t('review.title')}>
      <div className="sc-label">{t('review.title')}</div>
      {review.matchesQuestion === false && (
        <p className="wr-notice" role="note" data-review-unmatched>{t('review.unmatched')}</p>
      )}
      <ol className="wr-lines">
        {written.map(l => {
          const tone = TONE[l.check] || 'note';
          const isFirst = l.check === 'first-mistake';
          return (
            <li key={l.index} className={`wr-line wr-${tone}`} data-review-line={l.index} data-check={l.check}
              data-first-mistake={isFirst ? 'true' : undefined}>
              <span className="wr-mark" aria-hidden="true">{MARK[l.check] || '·'}</span>
              <span className="wr-n" aria-hidden="true">{numberOf(l)}</span>
              <span className="wr-body">
                <span className="sr-only">{t('review.lineSpoken', { n: numberOf(l) })} {t(SPOKEN[l.check] || 'review.check.notChecked')}. </span>
                <span className="wr-text">{prettyLine(l.text)}</span>
                {isFirst && <b className="wr-flag" data-first-mistake-flag>{t('review.firstMistakeHere')}</b>}
                {l.check === 'later-mistake' && <b className="wr-flag">{t('review.anotherMistake')}</b>}
                {l.reason && <span className="wr-reason">{l.reason}</span>}
              </span>
              {l.mark > 0 && <span className="wr-credit" data-review-mark={l.mark}>{t('review.markEarned', { count: l.mark, n: l.mark })}</span>}
            </li>
          );
        })}
      </ol>

      {first && (
        <div className="wr-card" role="note" data-first-mistake-card data-error-class={first.cls}
          aria-label={t('review.firstMistakeSpoken', { where, what: first.what })}>
          <div className="wr-card-label">{t('review.whatWentWrong')} · {where}</div>
          <div className="wr-card-title">{first.what}</div>
          {first.correction && <div className="wr-card-body" data-review-correction>{first.correction}</div>}
        </div>
      )}
      {review.answerCorrect && first && <p className="wr-notice" role="note" data-review-right-answer-wrong-working>{t('review.rightAnswerWrongWorking')}</p>}
      {review.certified && <p className="wr-notice wr-good" data-review-certified>{t('review.certified', { count: written.length, n: written.length })}</p>}
      {!review.certified && !first && review.counts?.verified > 0 && (review.counts.notChecked + review.counts.confirm) > 0 && (
        <p className="wr-notice" data-review-partial>{t('review.partlyChecked', { ok: review.counts.verified, total: written.length })}</p>
      )}

      {review.didWell?.length > 0 && (
        <div className="wr-block" data-review-did-well>
          <div className="wr-card-label">{t('review.didWell')}</div>
          <ul>{review.didWell.map((line, i) => <li key={i}>{line}</li>)}</ul>
        </div>
      )}
      {review.improve && (
        <div className="wr-block" data-review-improve>
          <div className="wr-card-label">{t('review.improve')}</div>
          <p>{review.improve}</p>
        </div>
      )}
      {marks && Number.isInteger(marks.earned) && Number.isInteger(marks.possible) && (
        <p className="wr-marks" data-review-marks={`${marks.earned}/${marks.possible}`}>
          {marks.method > 0
            ? t('review.marksMethod', { earned: marks.earned, total: marks.possible, method: marks.method })
            : !review.answerCorrect && marks.possible === 1
              ? t('review.marksSingle')
              : t('review.marksPlain', { earned: marks.earned, total: marks.possible })}
        </p>
      )}
      <p className="wr-foot muted">{t(review.checkedAgainst === 'lines-only' ? 'review.basisLines' : 'review.basisQuestion')}</p>
    </section>
  );
}

/**
 * Before submission. `lines` are the lines as they would be submitted;
 * `prompt` is the public question (only its letters are read).
 */
export function WorkingHint({ lines, prompt = '', lineNumber = null }) {
  const t = useT();
  // Keyed on the text, not the array: the card builds a new array each render.
  const text = (Array.isArray(lines) ? lines : []).map(l => String(l ?? '').replace(/\n/g, ' ')).join('\n');
  const hint = useMemo(() => {
    if (!text.trim()) return null;
    try { return workingHint(text.split('\n'), { vocabulary: [...promptLetters(prompt)] }); } catch { return null; }
  }, [text, prompt]);
  if (!hint) return null;
  const n = typeof lineNumber === 'function' ? lineNumber(hint.index) : hint.index + 1;
  return (
    <p className="wr-hint" role="status" data-working-hint={hint.kind} data-hint-line={hint.index}>
      <b>{t(hint.kind === 'confirm' ? 'review.hintConfirm' : 'review.hintRecheck', { n })}</b>{' '}
      {hint.text}{' '}
      <span className="muted">{t('review.hintFoot')}</span>
    </p>
  );
}
