// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the marked page
//
// The student's own page, ink or photo, with a quiet outline round every judged line and,
// beside it (below it on a phone), one short comment per line, level with that line.
// Hovering, focusing or tapping a comment lights its outline and the other way round.
// Lines Pri could not read as maths are ONE comment, not one each.
//
// Driven only by what the engine and the line interpreter established (the annotated-working
// model); it writes no judgement of its own and shows no mark but the server's. The comments
// list is the screen-reader source, in line order; the outlines are decoration.
// A state is always an icon and a word as well as a colour.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { useT } from '../i18n/index.js';
import { buildAnnotatedWorking } from './annotatedWorkingModel.js';
import { CardBody, ruleLabel } from './AnnotatedWorking.jsx';
import { Typeset } from './Typeset.jsx';
import { EngineComment } from './EngineComment.jsx';
import { dollarsBalanced, lineTex } from '../engine/commentTex.js';
import { strokePath } from './originalWorkModel.js';
import { STATE, alignCards, boxesFromInk, boxesFromPhoto, buildMarkedPage, commentItems, listOf, markerOf } from './markedPageModel.js';
import { criteriaView } from './criteriaTableModel.js';
import './MarkedPage.css';

const pointsOf = s => (Array.isArray(s) ? s : Array.isArray(s?.points) ? s.points : []);
const xy = p => (Array.isArray(p) ? { x: Number(p[0]), y: Number(p[1]) } : { x: Number(p?.x), y: Number(p?.y) });
const WIDE = '(min-width: 800px)';
const wide = () => typeof window !== 'undefined' && !!window.matchMedia?.(WIDE)?.matches;

/** The engine's one sentence about the first error: its first sentence only, so it is one clear line. */
const firstSentence = text => { const clean = String(text || '').replace(/\s+/g, ' ').trim(); const m = clean.match(/^.*?[.!?](?=\s+[A-Z]|$)/); const cut = (m ? m[0] : clean).trim(); return dollarsBalanced(cut) ? cut : clean; };
/** The specific reason a verified line is right, only where the engine has one; otherwise nothing (no filler sentence). */
function whyOf(card, t) {
  if (card.status === 'condition') return t('mp.why.condition');
  if (card.valueChain === 'given') return t('mp.why.given');
  if (card.valueChain === 'verified') return card.note || '';
  if (card.valueChain === 'arithmetic') return card.note || t('mp.why.arithmetic');
  if (card.start) return t('mp.why.start');
  if (card.same) return t('mp.why.same', { n: card.n - 1 });
  if (Array.isArray(card.rules) && card.rules.length) return card.rules.map(r => ruleLabel(r, t)).join(', ');
  // a valid step with no named rule is still the engine's own finding: it follows from the line before
  if ((card.unnamed || card.more) && card.n > 1) return t('mp.why.follows', { n: card.n - 1 });
  return '';
}
/** True when the reason whyOf() returns is the engine's own sentence (maths marked with `$…$`), not an interface string. */
const whyIsEngine = card => (card.valueChain === 'verified' || card.valueChain === 'arithmetic') && !!card.note;
function Header({ page, t, hasTable, scoreShown }) {
  const { parts, mark } = page.header;
  // The mark is the server's, said truthfully and in proportion: a right answer shows it prominently; a wrong final answer
  // never headlines "0 of 1" beside a page of correct lines. No partial mark is invented here (method marks are the
  // criteria table's, for author-approved schemes only).
  const full = mark && mark.awarded >= mark.possible;
  const finalWrong = mark && mark.awarded === 0 && !hasTable;
  return (
    <header className="mp-head">
      <p className="mp-sentence" data-mp-sentence role="status">{parts.map(p => t(p.key, p.vars)).join(' ')}</p>
      {/* The host's score card already shows the figure: it is not printed a second time, only what it does not say. */}
      {mark && scoreShown && finalWrong && <p className="mp-mark-quiet" data-mp-mark-note>{t('mp.mark.finalWrongNote')}</p>}
      {mark && !scoreShown && full && <p className="mp-mark" data-mp-mark={`${mark.awarded}/${mark.possible}`}>{t('mp.mark', { earned: mark.awarded, possible: mark.possible })}</p>}
      {mark && !scoreShown && !full && (
        <p className="mp-mark-quiet" data-mp-mark={`${mark.awarded}/${mark.possible}`}>
          {t(finalWrong ? 'mp.mark.finalWrong' : 'mp.mark.quiet', { earned: mark.awarded, possible: mark.possible, count: mark.possible })}
        </p>
      )}
    </header>
  );
}

/** The page: ink drawn through its own samples, or the photo, with one outline per judged line. */
// Display only, deterministic: a gentle lift of the paper white and an even-out of soft shadow. The stored original is never altered.
const CLEAN_FILTER = 'brightness(1.08) contrast(1.06) saturate(0.85)';
/** The inline position of an outline: the box itself for ink, the left-edge marker for a photo. */
const approxMarker = (box, approx) => {
  const b = approx ? markerOf(box) : box;
  return { left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` };
};
function Sheet({ source, geometry, page, active, setActive, t, cleaned }) {
  const view = geometry?.view || null;
  const outlines = page.aligned && geometry ? page.lines : [];
  // The reader's box on a photo is its own estimate of where a line is, not a measurement: it can sit a line's height off. So a photo
  // gets a marker at the line's left edge and vertical centre, never a tight outline that would claim more than the reader knows.
  const approx = source.kind === 'photo';
  return (
    <div className="mp-sheet" data-mp-sheet={source.kind}>
     <div className="mp-sheet-in" style={view ? { '--mp-ar': view.w / view.h } : undefined}>
      {source.kind === 'photo' ? (
        <img className="mp-img" src={source.src} alt={t('mp.pageAlt.photo')} data-mp-photo={cleaned ? 'cleaned' : 'original'} style={cleaned ? { filter: CLEAN_FILTER } : undefined} />
      ) : (
        <svg className="mp-ink" role="img" aria-label={t('mp.pageAlt.ink')}
          viewBox={view ? `${view.x} ${view.y} ${view.w} ${view.h}` : '0 0 1 1'} preserveAspectRatio="xMinYMin meet"
          style={view ? { aspectRatio: `${view.w} / ${view.h}` } : undefined}>
          {(source.strokes || []).map((s, i) => <path key={i} className="mp-stroke" d={strokePath(pointsOf(s).map(xy))} />)}
        </svg>
      )}
      {outlines.map(l => l.box && (
        <span key={l.n} className={`mp-box is-${l.status}${active === l.n ? ' is-active' : ''}${l.collapsed ? ' is-quiet' : ''}${approx ? ' is-approx' : ''}`} data-mp-box={l.n} data-mp-status={l.status}
          style={approxMarker(l.box, approx)}
          aria-hidden="true" onMouseEnter={() => setActive(l.n)} onMouseLeave={() => setActive(null)} onClick={() => setActive(l.n)}>
          <span className="mp-tag"><Icon name={STATE[l.status].icon} size={12} />{l.n}</span>
        </span>
      ))}
     </div>
    </div>
  );
}

/**
 * source: { kind: 'ink', strokes } or { kind: 'photo', src, lines } where `lines` are the judged
 * lines in order (each may carry the reader's normalised `box`). The geometry is worked out here.
 */
export default function MarkedPage({ input, source, texOf = s => s, markReady = true, scoreShown = false, criteria = null, approved, reading = null, onCorrect = null }) {
  const t = useT();
  const uid = useId();
  // A read line is shown as maths: stacked fractions and proper powers where it parses, else the reader's own text via texOf.
  // (The reader's TeX never reaches the client: the transcript keeps `text` only.)
  const lineOf = s => lineTex(s) ?? texOf(s);
  const model = useMemo(() => { try { return input ? buildAnnotatedWorking(input) : null; } catch { return null; } }, [input]);
  const geometry = useMemo(() => {
    try {
      return source.kind === 'ink'
        ? boxesFromInk(source.strokes, (input?.lines || []).map(l => ({ text: typeof l === 'string' ? l : l?.text })))
        : boxesFromPhoto(source.lines);
    } catch { return null; }
  }, [source, input]);
  const page = useMemo(() => buildMarkedPage({ model, boxes: geometry?.boxes || null, markReady }), [model, geometry, markReady]);
  const items = useMemo(() => commentItems(page), [page]);
  // Only for a question type the author has approved, for its current scheme; otherwise nothing is drawn.
  const table = useMemo(() => (page && model ? criteriaView({ criteria, mark: page.header.mark, cards: model.cards, ...(approved ? { approved } : {}) }) : null), [criteria, page, model, approved]);
  const [active, setActive] = useState(null);
  // How Pri read the page is on demand only (owner decision, 19 Nov 2026): one line at a time, or the whole page.
  const [shown, setShown] = useState(() => new Set());
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState(null);   // { line, text }
  const [cleaned, setCleaned] = useState(true);
  const sheetRef = useRef(null);
  const colRef = useRef(null);
  const [tops, setTops] = useState(null);

  // Level with the line, on a wide screen and only when the lines have boxes.
  useLayoutEffect(() => {
    const sheet = sheetRef.current, col = colRef.current;
    if (!sheet || !col || !page?.aligned || !wide() || items.some(i => i.y === null)) { setTops(null); return undefined; }
    const measure = () => {
      const H = sheet.getBoundingClientRect().height;
      const heights = [...col.querySelectorAll('[data-mp-card]')].map(el => el.offsetHeight);
      if (!H || heights.length !== items.length) return;
      const placed = alignCards(items.map((it, i) => ({ id: it.id, y: it.y, h: heights[i] })), H);
      const bottom = Math.max(...placed.map((p, i) => p.top + heights[i]));
      setTops(prev => (prev && prev.H === H && prev.bottom === bottom && prev.list.every((p, i) => p.top === placed[i].top) ? prev : { H, bottom, list: placed }));
    };
    measure();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    ro?.observe(sheet); ro?.observe(col);
    window.addEventListener('resize', measure);
    return () => { ro?.disconnect(); window.removeEventListener('resize', measure); };
  }, [page, items]);

  if (!page) return null;
  const level = !!tops;
  const textOf = n => { const l = reading?.lines?.[n - 1]; return typeof l === 'string' ? l : String(l?.text ?? ''); };
  // The reader's own TeX for line n, when it has one for the line as shown.
  const latexOf = n => { const l = reading?.lines?.[n - 1]; return l && typeof l === 'object' && typeof l.latex === 'string' && l.latex ? l.latex : null; };
  const lineOpen = n => showAll || shown.has(n);
  const toggleLine = n => setShown(prev => { const next = new Set(prev); if (next.has(n)) next.delete(n); else next.add(n); return next; });
  // One line's reading, on demand, with Edit. A correction marks the page again (the caller's business).
  const readingOfLine = n => {
    const open = lineOpen(n);
    const text = textOf(n);
    const isEditing = editing?.line === n;
    return (
      <div className="mp-read" data-mp-read-line={n}>
        <button type="button" className="mp-link" data-mp-see-line={n} aria-expanded={open} aria-controls={`${uid}-read-${n}`}
          onClick={() => toggleLine(n)}>{t('mp.seeLine')}</button>
        <div id={`${uid}-read-${n}`} hidden={!open}>
          {open && (
            <>
              {text.trim()
                ? <p className="mp-expr" data-mp-reading={n} data-text={text} aria-label={t('mp.readingOf', { n })}><Typeset text={text} texOf={lineOf} tex={latexOf(n)} /></p>
                : <p className="mp-text" data-mp-reading={n}>{t('mp.readingBlank')}</p>}
              {onCorrect && !isEditing && (
                <button type="button" className="mp-link" data-mp-edit-line={n} onClick={() => setEditing({ line: n, text })}>{t('mp.edit')}</button>
              )}
              {onCorrect && isEditing && (
                <form className="mp-edit" onSubmit={e => { e.preventDefault(); const clean = String(editing.text || '').trim(); if (clean) { setEditing(null); onCorrect(n - 1, clean); } }}>
                  <input autoFocus value={editing.text} aria-label={t('mp.editLabel', { n })} data-mp-edit-input={n}
                    inputMode="text" autoCapitalize="off" autoCorrect="off" spellCheck={false} maxLength={400}
                    onChange={e => setEditing({ line: n, text: e.target.value })} />
                  <button type="submit" className="btn btn-primary btn-sm" data-mp-mark-again>{t('mp.markAgain')}</button>
                  <button type="button" className="btn btn-quiet btn-sm" onClick={() => setEditing(null)}>{t('common.cancel')}</button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    );
  };
  const on = n => ({ onMouseEnter: () => setActive(n), onMouseLeave: () => setActive(null), onFocus: () => setActive(n), onBlur: () => setActive(null), onClick: () => { setActive(n); if (!wide()) sheetRef.current?.querySelector(`[data-mp-box="${n}"]`)?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }); } });

  return (
    <section className="mp" aria-labelledby={`${uid}-h`} data-marked-page data-mp-source={source.kind} data-mp-aligned={page.aligned ? 'true' : 'false'} data-mp-level={level ? 'true' : undefined}>
      <h3 className="sr-only" id={`${uid}-h`}>{t('mp.title')}</h3>
      <Header page={page} t={t} hasTable={!!table} scoreShown={scoreShown} />
      {reading && (
        <p className="mp-read-all">
          <button type="button" className="mp-link" data-mp-see-page aria-expanded={showAll} onClick={() => setShowAll(v => !v)}>{t(showAll ? 'mp.hidePage' : 'mp.seePage')}</button>
        </p>
      )}
      <div className="mp-body">
        <figure className="mp-page" ref={sheetRef}>
          <Sheet source={source} geometry={geometry} page={page} active={active} setActive={setActive} t={t} cleaned={cleaned} />
          {source.kind === 'photo' && (
            <figcaption className="mp-photo-note">
              <button type="button" className="mp-link" data-mp-photo-toggle aria-pressed={!cleaned} onClick={() => setCleaned(v => !v)}>{t(cleaned ? 'mp.showOriginal' : 'mp.showCleaned')}</button>
              {cleaned && <span> {t('mp.cleanedNote')}</span>}
              {page.aligned && <span data-mp-approx-note> {t('mp.photoNote')}</span>}
            </figcaption>
          )}
        </figure>
        <ol className="mp-comments" ref={colRef} aria-label={t('mp.comments')} style={level ? { minHeight: tops.bottom } : undefined}>
          {items.map((it, i) => {
            const top = level ? tops.list[i].top : undefined;
            const pos = level ? { position: 'absolute', top, left: 0, right: 0 } : undefined;
            if (it.kind === 'collapsed') {
              return (
                <li key={it.id} className={`mp-card is-quiet${it.lines.includes(active) ? ' is-active' : ''}`} data-mp-card="collapsed" data-mp-lines={it.lines.join(',')} tabIndex={0} style={pos}
                  {...on(it.lines[0])}>
                  <p className="mp-state"><Icon name="uncertain" size={14} /><span>{t('aw.status.notVerified')}</span></p>
                  {it.lines.length > it.unread.length && <p className="mp-text">{t('mp.collapsed', { count: it.lines.length - it.unread.length, list: listOf(it.lines.filter(n => !it.unread.includes(n))) })}</p>}
                  {it.unread.length > 0 && (
                    <>
                      <p className="mp-text" data-mp-unread={it.unread.join(',')}>{t('mp.unread', { count: it.unread.length, list: listOf(it.unread) })}</p>
                      <p className="mp-text mp-how" data-mp-unread-how>{t('mp.unreadHow')}</p>
                    </>
                  )}
                  {reading && it.unread.map(n => <React.Fragment key={n}>{readingOfLine(n)}</React.Fragment>)}
                </li>
              );
            }
            const { card, n, status } = it.line;
            const st = STATE[status] || STATE['not-verified'];
            // A verified line is ONE compact row: tick, "Line n", and the engine's own reason where it has one
            // (a named rule, the question, a stated condition, the line before). No specific reason: just tick and number.
            if (status === 'checked' || status === 'condition') {
              const why = whyOf(card, t);
              return (
                <li key={it.id} className={`mp-card mp-row is-${status}${reading ? ' has-read' : ''}${active === n ? ' is-active' : ''}`} data-mp-card={n} data-mp-status={status} tabIndex={0} style={pos} {...on(n)}>
                  <Icon name={st.icon} size={14} />
                  <span className="mp-row-n">{t('mp.line', { n })}</span>
                  {why && <span className="mp-row-why" data-mp-why>{whyIsEngine(card) ? <EngineComment text={why} /> : why}</span>}
                  <span className="sr-only">{t(st.word)}</span>
                  {reading && readingOfLine(n)}
                </li>
              );
            }
            const sentence = status === 'first-error' ? firstSentence(card.diagnosis?.message || card.diagnosis?.title || card.note || '') : '';
            return (
              <li key={it.id} className={`mp-card is-${status}${active === n ? ' is-active' : ''}`} data-mp-card={n} data-mp-status={status} tabIndex={0} style={pos} {...on(n)}>
                <p className="mp-state">
                  <Icon name={st.icon} size={14} />
                  <span>{t('mp.line', { n })}</span>
                  <b>{status === 'follows' ? t('aw.status.follows', { n: card.followsFrom }) : t(st.word)}</b>
                </p>
                {(status === 'first-error' || status === 'follows') && card.text && (
                  <p className="mp-expr" data-mp-expr><Typeset text={card.text} texOf={lineOf} tex={textOf(n).replace(/\s+/g, '') === String(card.text).replace(/\s+/g, '') ? latexOf(n) : null} /></p>
                )}
                {status === 'first-error'
                  ? <p className="mp-text mp-sentence-1" data-mp-why-error>{sentence ? (sentence.includes('$') && dollarsBalanced(sentence) ? <EngineComment text={sentence} /> : <Typeset text={sentence} texOf={texOf} />) : (n > 1 ? t('aw.body.firstError', { n: n - 1 }) : t('aw.body.firstErrorStart'))}</p>
                  : <div className="mp-text"><CardBody card={card} model={model} t={t} /></div>}
                {reading && status !== 'unread' && readingOfLine(n)}
              </li>
            );
          })}
        </ol>
      </div>
      {table && (
        <div className="mp-criteria" data-mp-criteria={table.typeId}>
          <table className="mp-table">
            <caption>{t('mp.criteria.caption')}</caption>
            <thead><tr><th scope="col">{t('mp.criteria.criterion')}</th><th scope="col">{t('mp.criteria.result')}</th></tr></thead>
            <tbody>
              {table.rows.map(r => (
                <tr key={r.key} data-mp-criterion={r.key} data-awarded={r.awarded ? 'yes' : 'no'}>
                  <td><span>{r.text}</span>{r.reason ? <span className="mp-why">{r.reason}</span> : null}</td>
                  <td>
                    <Icon name={r.awarded ? 'check' : 'uncertain'} size={14} />
                    <span>{r.awarded ? t('mp.criteria.awarded', { marks: r.marks, count: r.marks }) : t('mp.criteria.notAwarded', { marks: r.marks, count: r.marks })}</span>
                    {r.lines.length > 0 && <span className="mp-why">{t('mp.criteria.onLines', { count: r.lines.length, list: listOf(r.lines) })}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><th scope="row">{t('mp.criteria.total')}</th><td>{t('mp.mark', { earned: table.earned, possible: table.possible })}</td></tr></tfoot>
          </table>
          <p className="mp-label" data-mp-approval-label>{t('mp.criteria.label')}</p>
        </div>
      )}
    </section>
  );
}
