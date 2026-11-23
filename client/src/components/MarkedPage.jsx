// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the marked page
//
// The student's own page, ink or photo, is the centrepiece: wide on a wide screen with the detail panel beside it, full width on a
// phone with the panel beneath it. A small marker in the margin by each judged line (a real button: "Line 9, wrong") selects that line;
// so does a row of the compact line list, and the arrow keys move between lines. ONE panel shows the selected line: its state in
// words (Correct, Wrong, Not checked, Context), the engine's comment, how Pri read it, and the corrected line when the engine gives one.
// The first crossed line is selected to begin with, else the first line. A wrong line is underlined on the photo, never blocked out.
//
// Driven only by what the engine and the line interpreter established (the annotated-working model); it writes no judgement of its
// own and shows no mark but the server's. The line list is the screen-reader source, in line order; the markers repeat it.
// A state is always an icon and a word as well as a colour.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useId, useMemo, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { useT, useLanguage } from '../i18n/index.js';
import { commentFor } from '../engine/lineCommentary.js';
import { buildAnnotatedWorking } from './annotatedWorkingModel.js';
import { CardBody, ruleLabel } from './AnnotatedWorking.jsx';
import { Typeset } from './Typeset.jsx';
import { EngineComment } from './EngineComment.jsx';
import { dollarsBalanced, lineTex } from '../engine/commentTex.js';
import { strokePath } from './originalWorkModel.js';
import { STATE, STATE_WORD, boxesFromInk, boxesFromPhoto, buildMarkedPage, defaultLine, listOf, markerOf, stateOf } from './markedPageModel.js';
import { criteriaView } from './criteriaTableModel.js';
import { firstSentence } from './lineReportText.js';
import './MarkedPage.css';

const pointsOf = s => (Array.isArray(s) ? s : Array.isArray(s?.points) ? s.points : []);
const xy = p => (Array.isArray(p) ? { x: Number(p[0]), y: Number(p[1]) } : { x: Number(p?.x), y: Number(p?.y) });
const WIDE = '(min-width: 800px)';
const wide = () => typeof window !== 'undefined' && !!window.matchMedia?.(WIDE)?.matches;
const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

/** The specific reason a verified line is right, only where the engine has one; otherwise nothing (no filler sentence). */
function whyOf(card, t) {
  if (card.status === 'condition') return t('mp.why.condition');
  if (card.valueChain === 'given') return card.restated ? t('mp.why.restates') : t('mp.why.given');
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
  // Where it went wrong comes first (a sentence of its own), then the counts, each a separate fact.
  const lead = parts.filter(p => !p.count);
  const counts = parts.filter(p => p.count);
  return (
    <header className="mp-head">
      <p className="mp-sentence" data-mp-sentence role="status">
        {lead.length > 0 && <span data-mp-lead>{lead.map(p => t(p.key, p.vars)).join(' ')}</span>}
        {lead.length > 0 && counts.length > 0 && ' '}
        {counts.length > 0 && <span data-mp-counts>{counts.map(p => t(p.key, p.vars)).join(' ')}</span>}
      </p>
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
const boxStyle = b => ({ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` });
function Sheet({ source, geometry, page, selected, pick, onKey, markersRef, t, cleaned }) {
  const view = geometry?.view || null;
  const placed = page.aligned && geometry ? page.lines.filter(l => l.box) : [];
  // The reader's box on a photo is its own estimate of where a line is, not a measurement: it can sit a line's height off. So a photo
  // gets a small marker in the margin at the line's left edge and vertical centre, never a tight outline that would claim more than the reader knows.
  const approx = source.kind === 'photo';
  const markerWord = l => t(STATE_WORD[stateOf(l.status)]).toLowerCase();
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
      {/* Decoration, never over the ink's meaning: a thin underline under a wrong line, and an outline round the selected line of ink. */}
      {placed.map(l => (
        <React.Fragment key={`d${l.n}`}>
          {l.status === 'first-error' && <span className="mp-under" data-mp-under={l.n} aria-hidden="true" style={{ left: `${l.box.x * 100}%`, top: `${(l.box.y + l.box.h) * 100}%`, width: `${l.box.w * 100}%` }} />}
          {!approx && selected === l.n && <span className="mp-outline" aria-hidden="true" style={boxStyle(l.box)} />}
        </React.Fragment>
      ))}
      <div className="mp-markers" ref={markersRef} role="group" aria-label={t('mp.markers')} onKeyDown={onKey}>
        {placed.map(l => {
          const st = STATE[l.status] || STATE['not-verified'];
          const b = approx ? markerOf(l.box) : l.box;
          return (
            <button key={l.n} type="button" className={`mp-marker is-${l.status}${selected === l.n ? ' is-active' : ''}`} data-mp-box={l.n} data-mp-status={l.status}
              aria-label={t('mp.marker', { n: l.n, state: markerWord(l) })} aria-pressed={selected === l.n} tabIndex={selected === l.n ? 0 : -1}
              style={{ left: `${b.x * 100}%`, top: `${(b.y + b.h / 2) * 100}%` }} onClick={() => pick(l.n, true)}>
              <Icon name={st.icon} size={12} /><span aria-hidden="true">{l.n}</span>
            </button>
          );
        })}
      </div>
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
  const { language } = useLanguage();
  // The engine's own commentary from its structured facts (engine/lineCommentary.js): null keeps the engine's sentence as it was.
  const say = useMemo(() => Object.assign(card => commentFor(card, { language, ruleLabel: r => ruleLabel(r, t) }), { language }), [language, t]);
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
  // Only for a question type the author has approved, for its current scheme; otherwise nothing is drawn.
  const table = useMemo(() => (page && model ? criteriaView({ criteria, mark: page.header.mark, cards: model.cards, ...(approved ? { approved } : {}) }) : null), [criteria, page, model, approved]);
  // The selected line: the student's own choice, else the first cross, else the first line.
  const [chosen, setChosen] = useState(null);
  // How Pri read the page is on demand only (owner decision, 19 Nov 2026): one line at a time, or the whole page.
  const [shown, setShown] = useState(() => new Set());
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState(null);   // { line, text }
  const [cleaned, setCleaned] = useState(true);
  const detailRef = useRef(null);
  const listRef = useRef(null);
  const markersRef = useRef(null);

  if (!page) return null;
  const known = n => page.lines.some(l => l.n === n);
  const selected = chosen !== null && known(chosen) ? chosen : defaultLine(page);
  // Selecting by tapping a marker on a phone brings the panel, which sits below the photo, into view.
  const pick = (n, fromMarker = false) => {
    setChosen(n);
    if (fromMarker && !wide()) requestAnimationFrame(() => detailRef.current?.scrollIntoView?.({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' }));
  };
  // Arrow keys move between lines in either group (the markers on the page, the list), carrying focus with them.
  const onKey = group => e => {
    const ns = page.lines.map(l => l.n);
    const at = ns.indexOf(selected);
    let to = null;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') to = ns[Math.min(ns.length - 1, at + 1)];
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') to = ns[Math.max(0, at - 1)];
    else if (e.key === 'Home') to = ns[0];
    else if (e.key === 'End') to = ns[ns.length - 1];
    if (to === null || to === undefined) return;
    e.preventDefault();
    setChosen(to);
    group.current?.querySelector(`[data-mp-pick="${to}"], [data-mp-box="${to}"]`)?.focus();
  };
  const textOf = n => { const l = reading?.lines?.[n - 1]; return typeof l === 'string' ? l : String(l?.text ?? ''); };
  // The reader's own TeX for line n, when it has one for the line as shown.
  const latexOf = n => { const l = reading?.lines?.[n - 1]; return l && typeof l === 'object' && typeof l.latex === 'string' && l.latex ? l.latex : null; };
  const lineOpen = n => showAll || shown.has(n);
  const toggleLine = n => setShown(prev => { const next = new Set(prev); if (next.has(n)) next.delete(n); else next.add(n); return next; });
  // One line's reading, on demand, with Edit. A correction marks the page again (the caller's business).
  // `inline`: the reading is the panel's own "How Pri read this line" (a wrong line), so there is no second link to open it, only Edit.
  const readingOfLine = (n, inline = false) => {
    const open = inline || lineOpen(n);
    const text = textOf(n);
    const isEditing = editing?.line === n;
    return (
      <div className="mp-read" data-mp-read-line={n}>
        {!inline && <button type="button" className="mp-link" data-mp-see-line={n} aria-expanded={open} aria-controls={`${uid}-read-${n}`}
          onClick={() => toggleLine(n)}>{t('mp.seeLine')}</button>}
        <div id={`${uid}-read-${n}`} hidden={!open}>
          {open && (
            <>
              {inline && <p className="mp-fact-l">{t('mp.readAs')}</p>}
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

  // The one panel: the selected line, in words.
  const detail = () => {
    const it = page.lines.find(l => l.n === selected);
    if (!it) return null;
    const { card, n, status } = it;
    const st = STATE[status] || STATE['not-verified'];
    const state = stateOf(status);
    let comment = null;
    if (status === 'checked' || status === 'condition') {
      const said = say(card);
      const why = said ? said.text : whyOf(card, t);
      if (why) comment = <p className="mp-text" data-mp-why data-mp-said={said ? said.kind : undefined}>{said ? <EngineComment text={why} lang={language} /> : whyIsEngine(card) ? <EngineComment text={why} /> : why}</p>;
    } else if (status === 'first-error') {
      const saidCross = say(card);
      const sentence = firstSentence(card.diagnosis?.message || card.diagnosis?.title || card.note || '');
      comment = <p className="mp-text mp-sentence-1" data-mp-why-error>{saidCross ? <EngineComment text={saidCross.text} lang={language} /> : sentence ? (sentence.includes('$') && dollarsBalanced(sentence) ? <EngineComment text={sentence} /> : <Typeset text={sentence} texOf={texOf} />) : (n > 1 ? t('aw.body.firstError', { n: n - 1 }) : t('aw.body.firstErrorStart'))}</p>;
    } else if (status === 'unread') {
      comment = <><p className="mp-text" data-mp-unread={String(n)}>{t('mp.unread', { count: 1, list: String(n) })}</p><p className="mp-text mp-how" data-mp-unread-how>{t('mp.unreadHow')}</p></>;
    } else if (status === 'not-verified') {
      comment = <p className="mp-text">{t('mp.collapsed', { count: 1, list: String(n) })}</p>;
    } else {
      const body = <CardBody card={card} model={model} t={t} />;
      comment = <div className="mp-text">{body}</div>;
    }
    const inlineRead = status === 'first-error' && !!reading;
    const showRead = (status === 'first-error' && !reading) || status === 'follows';
    return (
      <div className="mp-detail" data-mp-detail={n} data-mp-status={status} ref={detailRef}>
        <p className="mp-state" data-mp-state={state}>
          <Icon name={st.icon} size={14} />
          <span className="mp-state-n">{t('mp.line', { n })}</span>
          <b>{t(STATE_WORD[state])}</b>
        </p>
        {comment}
        {showRead && card.text && (
          <div className="mp-fact" data-mp-fact="read">
            <p className="mp-fact-l">{t('mp.readAs')}</p>
            <p className="mp-expr" data-mp-expr><Typeset text={card.text} texOf={lineOf} tex={textOf(n).replace(/\s+/g, '') === String(card.text).replace(/\s+/g, '') ? latexOf(n) : null} /></p>
          </div>
        )}
        {inlineRead && readingOfLine(n, true)}
        {status === 'first-error' && card.corrected && (
          <div className="mp-fact" data-mp-fact="corrected">
            <p className="mp-fact-l">{t('mp.corrected')}</p>
            <p className="mp-expr" data-mp-corrected><Typeset text={card.corrected} texOf={lineOf} /></p>
          </div>
        )}
        {reading && status !== 'unread' && !inlineRead && readingOfLine(n)}
      </div>
    );
  };

  return (
    <section className="mp" aria-labelledby={`${uid}-h`} data-marked-page data-mp-source={source.kind} data-mp-aligned={page.aligned ? 'true' : 'false'} data-mp-selected={selected}>
      <h3 className="sr-only" id={`${uid}-h`}>{t('mp.title')}</h3>
      <Header page={page} t={t} hasTable={!!table} scoreShown={scoreShown} />
      {reading && (
        <p className="mp-read-all">
          <button type="button" className="mp-link" data-mp-see-page aria-expanded={showAll} onClick={() => setShowAll(v => !v)}>{t(showAll ? 'mp.hidePage' : 'mp.seePage')}</button>
        </p>
      )}
      <div className="mp-body">
        <figure className="mp-page">
          <Sheet source={source} geometry={geometry} page={page} selected={selected} pick={pick} onKey={onKey(markersRef)} markersRef={markersRef} t={t} cleaned={cleaned} />
          {source.kind === 'photo' && (
            <figcaption className="mp-photo-note">
              <button type="button" className="mp-link" data-mp-photo-toggle aria-pressed={!cleaned} onClick={() => setCleaned(v => !v)}>{t(cleaned ? 'mp.showOriginal' : 'mp.showCleaned')}</button>
              {cleaned && <span> {t('mp.cleanedNote')}</span>}
              {page.aligned && <span data-mp-approx-note> {t('mp.photoNote')}</span>}
            </figcaption>
          )}
        </figure>
        <div className="mp-panel">
          <div className="mp-live" aria-live="polite" aria-atomic="false">{detail()}</div>
          <ol className="mp-comments" ref={listRef} aria-label={t('mp.comments')} onKeyDown={onKey(listRef)}>
            {page.lines.map(l => {
              const st = STATE[l.status] || STATE['not-verified'];
              const word = t(STATE_WORD[stateOf(l.status)]);
              return (
                <li key={l.n} className={`mp-card is-${l.status}${selected === l.n ? ' is-active' : ''}`} data-mp-card={l.n} data-mp-status={l.status}>
                  <button type="button" className="mp-pick" data-mp-pick={l.n} aria-current={selected === l.n ? 'true' : undefined}
                    tabIndex={selected === l.n ? 0 : -1} onClick={() => pick(l.n)}>
                    <Icon name={st.icon} size={14} />
                    <span className="mp-row-n">{t('mp.line', { n: l.n })}</span>
                    <span className="mp-row-w">{word}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
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
