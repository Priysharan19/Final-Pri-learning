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
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
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
import SchemeTable from './SchemeTable.jsx';
import { firstSentence } from './lineReportText.js';
import { typesetProse } from './typesetProse.js';
import { EDITION } from '../platform/edition.js';
import './MarkedPage.css';

const pointsOf = s => (Array.isArray(s) ? s : Array.isArray(s?.points) ? s.points : []);
const xy = p => (Array.isArray(p) ? { x: Number(p[0]), y: Number(p[1]) } : { x: Number(p?.x), y: Number(p?.y) });
const WIDE = '(min-width: 800px)';
const wide = () => typeof window !== 'undefined' && !!window.matchMedia?.(WIDE)?.matches;
const VIEW_KEY = 'pri.markedPage.view';
const readView = () => { try { const v = localStorage.getItem(VIEW_KEY); return v === 'original' || v === 'detailed' ? v : 'marked'; } catch { return 'marked'; } };
/** The teacher-marked layer is its own chunk, fetched when a Prithagoras page is marked: the India edition never loads it. */
function useTeacherLayer(on) {
  const [state, setState] = useState({ mod: null, failed: false });
  useEffect(() => {
    if (!on) return undefined;
    let live = true;
    import('./teacherLayer.js').then(mod => { if (live) setState({ mod, failed: false }); }).catch(() => { if (live) setState({ mod: null, failed: true }); });
    return () => { live = false; };
  }, [on]);
  return state;
}
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
function Header({ page, t, hasTable, scoreShown, teacher = false }) {
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
        {!teacher && lead.length > 0 && counts.length > 0 && ' '}
        {!teacher && counts.length > 0 && <span data-mp-counts>{counts.map(p => t(p.key, p.vars)).join(' ')}</span>}
      </p>
      {/* The host's score card already shows the figure: it is not printed a second time, only what it does not say. */}
      {!teacher && mark && scoreShown && finalWrong && <p className="mp-mark-quiet" data-mp-mark-note>{t('mp.mark.finalWrongNote')}</p>}
      {!teacher && mark && !scoreShown && full && <p className="mp-mark" data-mp-mark={`${mark.awarded}/${mark.possible}`}>{t('mp.mark', { earned: mark.awarded, possible: mark.possible })}</p>}
      {!teacher && mark && !scoreShown && !full && (
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
/** The student's page exactly as it was: the photo, or the ink drawn through its own samples. Never re-typeset, cropped or rearranged. */
function PageArt({ source, view, t, cleaned }) {
  return source.kind === 'photo' ? (
    <img className="mp-img" src={source.src} alt={t('mp.pageAlt.photo')} data-mp-photo={cleaned ? 'cleaned' : 'original'} style={cleaned ? { filter: CLEAN_FILTER } : undefined} />
  ) : (
    <svg className="mp-ink" role="img" aria-label={t('mp.pageAlt.ink')}
      viewBox={view ? `${view.x} ${view.y} ${view.w} ${view.h}` : '0 0 1 1'} preserveAspectRatio="xMinYMin meet"
      style={view ? { aspectRatio: `${view.w} / ${view.h}` } : undefined}>
      {(source.strokes || []).map((s, i) => <path key={i} className="mp-stroke" d={strokePath(pointsOf(s).map(xy))} />)}
    </svg>
  );
}
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
      <PageArt source={source} view={view} t={t} cleaned={cleaned} />
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
export default function MarkedPage({ teacherMarks = EDITION === 'prithagoras', examinerNote = null, input, source, texOf = s => s, markReady = true, scoreShown = false, criteria = null, stepMarks = false, approved, reading = null, onCorrect = null, howRead = '' }) {
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
  const [cleaned, setCleaned] = useState(!teacherMarks);   // the teacher-marked page opens on the photograph exactly as it was taken
  const [view, setViewState] = useState(readView);
  const setView = v => { setViewState(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* the choice is only a convenience */ } };
  const [rowFocus, setRowFocus] = useState(null);
  const { mod: T, failed: layerFailed } = useTeacherLayer(teacherMarks);
  const tm = !!T;   // the marking layer, once its chunk has arrived
  const marks = useMemo(() => (T && page ? T.buildTeacherMarks({ page, table }) : []), [T, page, table]);
  const assessment = useMemo(() => (T && page ? T.buildAssessment({ page, table, attempt: model?.attempt ?? null }) : null), [T, page, table, model]);
  const detailRef = useRef(null);
  const listRef = useRef(null);
  const markersRef = useRef(null);

  if (!page) return null;
  const known = n => page.lines.some(l => l.n === n);
  // Rubric traceability: a focused criterion lights the lines that earned it; the selected line lights the criteria it earned.
  const rows = assessment ? assessment.rows : [];
  const trace = new Set(rowFocus ? (rows.find(r => r.key === rowFocus)?.lines || []) : []);
  const tracedRows = new Set(chosen === null ? [] : rows.filter(r => r.lines.includes(chosen)).map(r => r.key));
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
  const lineOpen = n => shown.has(n);
  // With the whole-page list open, that list carries the readings; the panel's own are not marked a second time.
  const readAttr = n => (showAll ? {} : { 'data-mp-reading': n });
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
                ? <p className="mp-expr" {...readAttr(n)} data-text={text} aria-label={t('mp.readingOf', { n })}><Typeset text={text} texOf={lineOf} tex={latexOf(n)} /></p>
                : <p className="mp-text" {...readAttr(n)}>{t('mp.readingBlank')}</p>}
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

  // The one panel: the selected line, in words. No box round it, no list of rows beside it: the markers on the page are the navigation.
  const lines = page.lines;
  const selIndex = lines.findIndex(l => l.n === selected);
  const step = d => { const to = lines[selIndex + d]; if (to) pick(to.n); };
  const textOfLine = n => String(lines.find(l => l.n === n)?.card?.text ?? '');
  const field = (key, label, body, extra = '') => (
    <div className={`mp-fact ${extra}`} data-mp-fact={key}><p className="mp-fact-l">{label}</p>{body}</div>
  );
  const detail = () => {
    const it = lines[selIndex];
    if (!it) return null;
    const { card, n, status } = it;
    const st = STATE[status] || STATE['not-verified'];
    const state = stateOf(status);
    const facts = card.facts || {};
    // The engine's own specific comment where it gave one; else the sentence built from its structured facts.
    let comment = null;
    if (status === 'checked' || status === 'condition') {
      const said = say(card);
      const why = card.comment || (said ? said.text : whyOf(card, t));
      if (why) comment = <p className="mp-text" data-mp-why data-mp-said={said && !card.comment ? said.kind : undefined}>{card.comment || said || whyIsEngine(card) ? <EngineComment text={card.comment ? typesetProse(why) : why} lang={card.comment ? 'en' : language} /> : why}</p>;
    } else if (status === 'first-error') {
      // The engine's own `comment` on a crossed line is its whole plain message (what changed, why, the corrected line, the check): the
      // panel shows each of those under its own heading below, so with them present the lead is only where the working stops being equal.
      const detailed = !!(facts.whatChanged || facts.whyWrong);
      const saidCross = detailed ? null : say(card);
      const sentence = detailed ? '' : firstSentence(card.diagnosis?.message || card.diagnosis?.title || card.note || '');
      const text = detailed ? '' : card.comment ? typesetProse(card.comment) : (saidCross ? saidCross.text : '');
      const leadFrom = facts.fromLine && facts.fromLine < n ? facts.fromLine : n - 1;
      comment = <p className="mp-text mp-sentence-1" data-mp-why-error>{text ? <EngineComment text={text} lang={language} /> : sentence ? (sentence.includes('$') && dollarsBalanced(sentence) ? <EngineComment text={sentence} /> : <Typeset text={sentence} texOf={texOf} />) : (n > 1 ? t('aw.body.firstError', { n: leadFrom }) : t('aw.body.firstErrorStart'))}</p>;
    } else if (status === 'unread') {
      comment = <><p className="mp-text" data-mp-unread={String(n)}>{t('mp.unread', { count: 1, list: String(n) })}</p><p className="mp-text mp-how" data-mp-unread-how>{t('mp.unreadHow')}</p></>;
    } else if (status === 'not-verified') {
      comment = <p className="mp-text">{card.comment ? <EngineComment text={typesetProse(card.comment)} /> : t('mp.collapsed', { count: 1, list: String(n) })}</p>;
    } else {
      comment = <div className="mp-text">{card.comment ? <p><EngineComment text={typesetProse(card.comment)} /></p> : <CardBody card={card} model={model} t={t} />}</div>;
    }
    const wrong = status === 'first-error';
    const inlineRead = wrong && !!reading;
    const showRead = (wrong && !reading) || status === 'follows';
    const from = wrong ? (facts.fromLine && facts.fromLine < n ? facts.fromLine : n > 1 ? n - 1 : null) : null;
    const fromText = from ? textOfLine(from) : '';
    return (
      <div className="mp-detail" data-mp-detail={n} data-mp-status={status} ref={detailRef}>
        <div className="mp-stepper" data-mp-stepper>
          <span className="mp-step-of" data-mp-step-of>{t('mp.stepOf', { n, total: lines.length })}</span>
          <span className="mp-step-btns">
            <button type="button" className="mp-link" data-mp-step="prev" disabled={selIndex <= 0} onClick={() => step(-1)}>{t('mp.prev')}</button>
            <button type="button" className="mp-link" data-mp-step="next" disabled={selIndex >= lines.length - 1} onClick={() => step(1)}>{t('mp.next')}</button>
          </span>
        </div>
        <p className="mp-state" data-mp-state={state}>
          {!(tm && status === 'condition') && <Icon name={st.icon} size={16} />}
          <b>{(tm && T.lineWord(card)) || t(STATE_WORD[state])}</b>
          <span className="mp-state-n">{t('mp.line', { n })}</span>
        </p>
        {wrong && fromText && field('from', t('mp.from', { n: from }), <p className="mp-expr mp-prev" data-mp-from><Typeset text={fromText} texOf={lineOf} /></p>)}
        {inlineRead && readingOfLine(n, true)}
        {showRead && card.text && field('read', t('mp.readAs'), <p className="mp-expr" data-mp-expr><Typeset text={card.text} texOf={lineOf} tex={textOf(n).replace(/\s+/g, '') === String(card.text).replace(/\s+/g, '') ? latexOf(n) : null} /></p>)}
        {!(tm && T.lineWord(card) === T.TEXT.heading) && comment}
        {wrong && facts.whatChanged && field('whatChanged', t('mp.whatChanged'), <p className="mp-text"><EngineComment text={typesetProse(facts.whatChanged)} lang="en" /></p>)}
        {wrong && facts.whyWrong && field('whyWrong', t('mp.whyWrong'), <p className="mp-text"><EngineComment text={typesetProse(facts.whyWrong)} lang="en" /></p>)}
        {wrong && card.corrected && field('corrected', t('mp.corrected'), <p className="mp-expr mp-fix" data-mp-corrected><Typeset text={card.corrected} texOf={lineOf} /></p>, 'is-fix')}
        {wrong && facts.check && field('check', t('mp.quickCheck'), <p className="mp-text"><EngineComment text={typesetProse(facts.check)} lang="en" /></p>)}
        {wrong && facts.kept && <p className="mp-text mp-kept" data-mp-kept><EngineComment text={typesetProse(facts.kept)} lang="en" /></p>}
        {reading && status !== 'unread' && !inlineRead && readingOfLine(n)}
      </div>
    );
  };

  return (
    <section className={`mp${tm ? ' mp-t-root' : ''}`} aria-labelledby={`${uid}-h`} data-marked-page data-mp-source={source.kind} data-mp-aligned={page.aligned ? 'true' : 'false'} data-mp-selected={selected}>
      <h3 className="sr-only" id={`${uid}-h`}>{t('mp.title')}</h3>
      <Header page={page} t={t} hasTable={!!table || stepMarks} scoreShown={scoreShown} teacher={tm} />
      {tm && (
        <div className="mp-t-bar">
          <p className="mp-t-tally" data-mp-tally>{T.tallyOf(page)}</p>
          <T.ViewToggle view={view} setView={setView} />
        </div>
      )}
      <div className="mp-body" data-mp-body-view={tm ? view : undefined}>
        <figure className="mp-page">
          {tm
            ? <T.TeacherSheet kind={source.kind} view={view} page={page} marks={marks} selected={selected} pick={pick} onKey={onKey(markersRef)} markersRef={markersRef} trace={trace}
                viewBoxStyle={geometry?.view ? { '--mp-ar': geometry.view.w / geometry.view.h } : undefined}
                math={s => <Typeset text={s} texOf={lineOf} />} prose={s => <EngineComment text={typesetProse(s)} lang="en" />}><PageArt source={source} view={geometry?.view || null} t={t} cleaned={cleaned} /></T.TeacherSheet>
            : teacherMarks && !layerFailed
              ? <div className="mp-sheet" data-mp-sheet={source.kind}><div className="mp-sheet-in"><PageArt source={source} view={geometry?.view || null} t={t} cleaned={cleaned} /></div></div>
              : <Sheet source={source} geometry={geometry} page={page} selected={selected} pick={pick} onKey={onKey(markersRef)} markersRef={markersRef} t={t} cleaned={cleaned} />}
          {tm && view === 'detailed' && <T.MarkList page={page} marks={marks} lineOpen={lineOpen} toggleLine={toggleLine} readingOfLine={readingOfLine} canType={!!onCorrect} setEditing={setEditing} textOf={textOf} pick={pick} />}
          {/* Everything about how the page was read is one quiet disclosure under the photo. */}
          <details className="mp-about" data-mp-about>
            <summary>{t('mp.about')}</summary>
            <div className="mp-about-in">
              {source.kind === 'photo' && (
                <p className="mp-photo-note">
                  <button type="button" className="mp-link" data-mp-photo-toggle aria-pressed={!cleaned} onClick={() => setCleaned(v => !v)}>{t(cleaned ? 'mp.showOriginal' : 'mp.showCleaned')}</button>
                  {cleaned && <span> {t('mp.cleanedNote')}</span>}
                  {page.aligned && <span data-mp-approx-note> {t('mp.photoNote')}</span>}
                </p>
              )}
              {howRead && <p className="mp-photo-note" data-mp-how>{howRead}</p>}
              {reading && (
                <p className="mp-read-all">
                  <button type="button" className="mp-link" data-mp-see-page aria-expanded={showAll} onClick={() => setShowAll(v => !v)}>{t(showAll ? 'mp.hidePage' : 'mp.seePage')}</button>
                </p>
              )}
              {reading && showAll && (
                <ol className="mp-all" data-mp-all>
                  {lines.filter(l => l.status !== 'unread').map(l => {
                    const text = textOf(l.n);
                    return <li key={l.n}><span className="mp-all-n">{t('mp.line', { n: l.n })}</span>{text.trim() ? <span className="mp-expr" data-mp-reading={l.n} data-text={text}><Typeset text={text} texOf={lineOf} tex={latexOf(l.n)} /></span> : <span data-mp-reading={l.n}>{t('mp.readingBlank')}</span>}</li>;
                  })}
                </ol>
              )}
            </div>
          </details>
        </figure>
        <div className="mp-panel" hidden={tm && view === 'original'}>
          {tm && <T.Assessment model={assessment} rowFocus={rowFocus} setRowFocus={setRowFocus} tracedRows={tracedRows} examinerNote={examinerNote} />}
          {tm && view === 'detailed' && <T.StepChips rows={rows} rowFocus={rowFocus} setRowFocus={setRowFocus} />}
          <div className="mp-live" aria-live="polite" aria-atomic="false" hidden={tm && view !== 'detailed'}>{detail()}</div>
          {/* The screen-reader list of every line, in order; sighted navigation is the markers and the stepper. */}
          <ol className="mp-comments sr-only" ref={listRef} aria-label={t('mp.comments')} onKeyDown={onKey(listRef)}>
            {lines.map(l => (
              <li key={l.n} className={`mp-card is-${l.status}${selected === l.n ? ' is-active' : ''}`} data-mp-card={l.n} data-mp-status={l.status}>
                <button type="button" className="mp-pick" data-mp-pick={l.n} aria-current={selected === l.n ? 'true' : undefined} tabIndex={-1} onClick={() => pick(l.n)}>
                  <Icon name={(STATE[l.status] || STATE['not-verified']).icon} size={14} />
                  <span className="mp-row-n">{t('mp.line', { n: l.n })}</span>
                  <span className="mp-row-w">{t(STATE_WORD[stateOf(l.status)])}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>
      {table && <SchemeTable view={table} />}
    </section>
  );
}
