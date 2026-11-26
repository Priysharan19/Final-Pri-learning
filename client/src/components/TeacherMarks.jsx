// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the teacher-marked page (Prithagoras edition)
//
// The student's page, untouched, with a separate marking layer over it and a right-hand margin beside it. Ticks and the cross are SVG strokes
// drawn at the end of the line the engine judged; a boxed mark stands in the margin on the line where the server awarded it; a few short
// handwritten words say what was right. The overlay never changes the page, and a tick that would sit on writing goes to the gutter.
// All of it is data from markedPageTeacher.js (the engine's classes and the server's marks); this file draws and positions, nothing more.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { alignCards } from './markedPageModel.js';
import { TEXT, detailFor, lineWord, figureLabel, listWords, markBoxLabel, markLabel, placeMarks, placePopover, stepMarkText, textHeight } from './markedPageTeacher.js';
import './MarkedPageTeacher.css';

const TICK_PATH = 'M3 13 C5.6 14.8 7.6 17.4 9.6 21 C13 13.6 17.6 7.2 23.6 2.6';
const CROSS_A = 'M4 4 C9 9.2 14.4 14.6 20.4 20.4';
const CROSS_B = 'M20.4 3.6 C14.6 9.6 9.4 14.8 3.8 20.6';

export function TickMark({ kind, index = 0 }) {
  return (
    <svg className={`mp-t-glyph is-${kind}`} viewBox="0 0 26 24" width="26" height="24" aria-hidden="true" focusable="false" style={{ '--i': Math.min(index, 12) }}>
      {kind === 'right'
        ? <path d={TICK_PATH} pathLength="1" />
        : kind === 'ai'
          // the AI tick: the same stroke, drawn dotted, so it can never be taken for an engine tick
          ? <path d={TICK_PATH} pathLength="1" />
          : kind === 'doubt'
            ? <circle cx="13" cy="12" r="8" />
            : <><path d={CROSS_A} pathLength="1" /><path d={CROSS_B} pathLength="1" className="b" /></>}
    </svg>
  );
}

const useSize = (ref, fallback) => {
  const [size, setSize] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const read = () => { const r = el.getBoundingClientRect(); if (r.width > 0 && r.height > 0) setSize(prev => (Math.abs(prev.w - r.width) < 0.5 && Math.abs(prev.h - r.height) < 0.5 ? prev : { w: r.width, h: r.height }));
    };
    read();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
};

/** What is written beside a tick: its words, with every piece of maths set by the app's maths renderer (the plain text is the label and the width). */
export function Say({ mark, prose }) {
  const segs = mark && mark.explain && Array.isArray(mark.explain.segs) ? mark.explain.segs : null;
  if (!segs || !prose) return mark ? mark.phrase : null;
  return segs.map((g, i) => (g.t === 'tex' ? <React.Fragment key={i}>{prose(`$${g.v.replace(/\\frac/g, '\\tfrac')}$`)}</React.Fragment> : g.v));
}
const boxStyle = b => ({ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` });

const GUTTER_WIDE = 220;
const GUTTER_COMPACT = 76;
/**
 * The page with its marking layer. `children` is the page itself (the photo or the ink), drawn exactly as before.
 * The layer is a separate overlay of fixed size: the page's own height never depends on the view or on what the margin holds.
 */
export function TeacherSheet({ kind, view, page, marks, selected, pick, onKey, markersRef, trace, children, viewBoxStyle, math = null, prose = null }) {
  const pageRef = useRef(null);
  const sheetRef = useRef(null);
  const dim = useSize(pageRef, { w: 800, h: 1000 });
  const sheet = useSize(sheetRef, { w: 1000, h: 1000 });
  const zoomRef = useRef(null);
  const zoom = useSize(zoomRef, { w: 1000, h: 1000 });
  const [enlarged, setEnlarged] = useState(false);
  const uid = useId();
  const [open, setOpen] = useState(null);           // { n, via: 'hover' | 'focus' | 'tap' }
  const popRef = useRef(null);
  const [popH, setPopH] = useState(84);
  // a tap or press outside the marks closes a popover opened by tap
  useEffect(() => {
    if (!open) return undefined;
    const away = e => { if (!e.target.closest?.('[data-mp-box], [data-mp-pop]')) setOpen(null); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);
  useLayoutEffect(() => { if (open && popRef.current) { const h = popRef.current.getBoundingClientRect().height; if (h > 0 && Math.abs(h - popH) > 1) setPopH(h); } }, [open, popH, dim.w]);
  const marked = view !== 'original';
  // Every tick and cross carries its short phrase: straight after it when there is room, else in the margin with a leader. (A phone's margin is too narrow for words: the popover and the list carry them there.)
  const showWords = sheet.w >= 600;
  const words = useMemo(() => (showWords ? Object.fromEntries(marks.filter(m => m.phrase).map(m => [m.n, m.phrase])) : {}), [marks, showWords]);
  // a phrase with typeset maths is wider and taller than the same words in plain text
  const heavy = useMemo(() => new Set(marks.filter(m => m.explain && Array.isArray(m.explain.segs) && m.explain.segs.some(g => g.t === 'tex')).map(m => m.n)), [marks]);
  const important = useMemo(() => new Set(marks.filter(m => m.phrase).map(m => m.n)), [marks]);
  // The tick is as large as the writing allows: on a small page of many lines it shrinks so neighbours do not sit on each other.
  const pitch = useMemo(() => { const ys = page.lines.filter(l => l.box).map(l => (l.box.y + l.box.h / 2) * dim.h).sort((x, y) => x - y); const d = []; for (let i = 1; i < ys.length; i += 1) d.push(ys[i] - ys[i - 1]); d.sort((x, y) => x - y); return d.length ? d[Math.floor(d.length / 2)] : Infinity; }, [page, dim.h]);
  const tick = Number.isFinite(pitch) ? Math.round(Math.min(24, Math.max(sheet.w >= 600 ? 18 : 16, pitch * 0.9))) : 24;
  const reserve = tick >= 16 ? 12 : 0;
  // ticks are at least 18 px; a phone's narrow page keeps the smaller floor so a tick still stands at the end of its own line
  const place = (w, h) => placeMarks({ marks, obstacles: page.lines, words, reserve, width: w, height: h, size: tick, min: sheet.w >= 600 ? 18 : 16, heavy });
  // The margin is only as wide as it has to be: wide when some words cannot stand beside their tick, judged as if it were wide (so the choice cannot flip back and forth).
  const aspect = dim.h / dim.w;
  const needWide = useMemo(() => {
    if (sheet.w < 600) return false;
    const w = sheet.w - GUTTER_COMPACT - 2;   // judged as if the margin were narrow: the page keeps the width unless some words truly cannot stand on the paper
    return place(w, w * aspect).some(p => p.word === 'gutter' && important.has(p.n));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet.w, aspect, marks, page, words, tick, important]);
  const placements = useMemo(() => place(dim.w, dim.h),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [marks, page, words, dim.w, dim.h, tick]);
  const at = n => placements.find(p => p.n === n);
  const gutterWords = needWide ? marks.filter(m => at(m.n)?.word === 'gutter' && important.has(m.n)).map(m => ({ id: `p${m.n}`, n: m.n, kind: m.kind, text: m.phrase, y: at(m.n).y })) : [];
  const colW = GUTTER_WIDE - 100;
  const items = gutterWords.map(p => ({ id: p.id, y: p.y / dim.h, h: textHeight(p.text.length + 2, colW, 14, 1.15, 5) }));
  const tops = alignCards(items, dim.h, { gap: 4 }).map((t, i) => Math.max(0, Math.min(t.top, dim.h - items[i].h)));
  const paidMarks = marks.filter(m => m.paid && at(m.n));
  const markTops = alignCards(paidMarks.map(m => ({ id: m.n, y: at(m.n).y / dim.h, h: 24 })), dim.h, { gap: 4 });

  return (
    <>
    <div className={`mp-t-zoom${enlarged ? ' is-on' : ''}`} ref={zoomRef} data-mp-zoom={enlarged ? 'on' : 'off'} tabIndex={enlarged ? 0 : undefined} role={enlarged ? 'group' : undefined} aria-label={enlarged ? TEXT.enlargedLabel : undefined}>
    <div className="mp-sheet mp-t-sheet" data-mp-sheet={kind} data-mp-view={view} data-mp-size={needWide ? 'roomy' : 'compact'} ref={sheetRef}>
      <div className="mp-sheet-in" ref={pageRef} style={viewBoxStyle}>
        {children}
        {marked && (
          <div className="mp-t-over" data-mp-layer>
            {page.lines.filter(l => l.box && trace.has(l.n)).map(l => <span key={`t${l.n}`} className="mp-t-trace" data-mp-trace={l.n} aria-hidden="true" style={boxStyle(l.box)} />)}
            {marks.filter(m => m.kind === 'wrong' && m.box).map(m => (
              <span key={`u${m.n}`} className="mp-under" data-mp-under={m.n} aria-hidden="true" style={{ left: `${m.box.x * 100}%`, top: `${(m.box.y + m.box.h) * 100}%`, width: `${m.box.w * 100}%` }} />
            ))}
            {marks.map(m => { const p = at(m.n); return p && p.leader ? (
              <span key={`l${m.n}`} className={`mp-t-leader is-${m.kind}`} data-mp-leader={m.n} aria-hidden="true"
                style={{ left: `${(p.leader.x0 / dim.w) * 100}%`, top: `${(p.leader.y / dim.h) * 100}%`, width: `${((p.leader.x1 - p.leader.x0) / dim.w) * 100}%` }} />
            ) : null; })}
            {marks.map(m => { const p = at(m.n); return p && p.word && p.word !== 'gutter' ? (
              <span key={`w${m.n}`} className={`mp-t-say is-${m.kind}`} data-mp-say={m.n} data-mp-say-plain={p.word.text} aria-hidden="true"
                style={{ left: `${(p.word.x0 / dim.w) * 100}%`, top: `${(p.word.y / dim.h) * 100}%`, fontSize: `${p.word.font}px`, ...(p.word.wrap ? { width: `${((p.word.x1 - p.word.x0) / dim.w) * 100}%`, whiteSpace: 'normal', lineHeight: 1.05 } : {}) }}><Say mark={m} prose={prose} /></span>
            ) : null; })}
            <div className="mp-markers mp-t-markers" ref={markersRef} role="group" aria-label={TEXT.marksOnPage} onKeyDown={e => { if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(null); } else onKey(e); }}>
              {marks.map((m, i) => {
                const p = at(m.n);
                if (!p) return null;
                const onPage = p.where === 'page';
                const style = onPage ? { left: `${(p.x / dim.w) * 100}%`, top: `${(p.y / dim.h) * 100}%`, '--sz': `${p.size}px` } : { top: `${(p.y / dim.h) * 100}%`, '--sz': `${p.size}px` };
                return (
                  <button key={m.n} type="button" className={`mp-marker mp-t-tick is-${m.kind}${onPage ? '' : ' in-gutter'}${selected === m.n ? ' is-active' : ''}${p.num ? '' : ' is-small'}`}
                    data-mp-box={m.n} data-mp-status={m.kind === 'right' ? 'checked' : m.kind === 'ai' ? 'ai-checked' : m.kind === 'doubt' ? 'ai-doubt' : 'first-error'} data-mp-where={p.where} data-mp-placement={p.placement}
                    data-mp-class={m.cls || undefined} data-mp-phrase={m.phrase || undefined} aria-label={markLabel(m)} aria-pressed={selected === m.n} tabIndex={selected === m.n ? 0 : -1} aria-describedby={open?.n === m.n ? `${uid}-pop` : undefined}
                    style={style} onClick={() => { pick(m.n, false); setOpen(o => (o?.n === m.n && o.via === 'tap' ? null : { n: m.n, via: 'tap' })); }}
                    onMouseEnter={() => setOpen(o => (o?.via === 'tap' ? o : { n: m.n, via: 'hover' }))} onMouseLeave={() => setOpen(o => (o?.n === m.n && o.via === 'hover' ? null : o))}
                    onFocus={() => setOpen(o => (o?.n === m.n ? o : { n: m.n, via: 'focus' }))} onBlur={() => setOpen(o => (o?.n === m.n && o.via !== 'tap' ? null : o))}>
                    <TickMark kind={m.kind} index={i} />
                    <span className="mp-t-num" aria-hidden="true">{m.n}</span>
                  </button>
                );
              })}
            </div>
            {open && (() => {
              const m = marks.find(x => x.n === open.n); const l = page.lines.find(x => x.n === open.n); const p = m && at(m.n);
              if (!m || !l || !l.box || !p) return null;
              const d = detailFor(m, l.card);
              const line = { x0: l.box.x * dim.w, x1: (l.box.x + l.box.w) * dim.w, y0: l.box.y * dim.h, y1: (l.box.y + l.box.h) * dim.h };
              const pos = placePopover({ line, tick: { x: p.where === 'page' ? p.x : dim.w, y: p.y }, width: dim.w, height: dim.h, h: popH });
              return (
                <div id={`${uid}-pop`} ref={popRef} role="tooltip" className={`mp-t-pop is-${m.kind}`} data-mp-pop={m.n} data-mp-pop-side={pos.side} data-mp-pop-via={open.via}
                  style={{ left: pos.left, top: pos.top, width: pos.width }}>
                  <p className="mp-t-pop-h">{d.title}</p>
                  {d.lines.map((segs, i) => <p key={i} className="mp-t-pop-p">{segs.map((x, k) => <React.Fragment key={k}>{x.t === 'math' && math ? math(x.v) : x.t === 'prose' && prose ? prose(x.v) : x.v}</React.Fragment>)}</p>)}
                  {d.mark && <p className="mp-t-pop-m">{d.mark}</p>}
                </div>
              );
            })()}
          </div>
        )}
      </div>
      {!marked && <div className="mp-t-gutter" aria-hidden="true" />}
      {marked && (
        <div className="mp-t-gutter" data-mp-gutter>
          <span className="mp-t-rule" aria-hidden="true" />
          {paidMarks.map((m, i) => (
            <span key={`b${m.n}`} className={`mp-t-box${trace.has(m.n) ? ' is-traced' : ''}`} data-mp-markbox={m.n} data-mp-markbox-text={m.paid.text}
              role="img" aria-label={markBoxLabel(m)} style={{ top: markTops[i].top }}>{m.paid.text}</span>
          ))}
          {gutterWords.map((p, i) => (
            <button key={p.id} type="button" tabIndex={-1} aria-hidden="true" className={`mp-t-words is-${p.kind}`} data-mp-words={p.n} data-mp-say-plain={p.text}
              style={{ top: tops[i], maxHeight: items[i].h }} onClick={() => pick(p.n, true)}>
              <Say mark={marks.find(x => x.n === p.n)} prose={prose} />
            </button>
          ))}
        </div>
      )}
    </div>
    </div>
    {marked && zoom.w < 700 && (
      <button type="button" className="mp-link mp-t-enlarge" data-mp-enlarge aria-pressed={enlarged} onClick={() => setEnlarged(v => !v)}>{enlarged ? TEXT.fit : TEXT.enlarge}</button>
    )}
    </>
  );
}

/** Detailed feedback: the words for every mark, numbered as on the page, and the unread lines, which can be typed in (never a cross). */
export function MarkList({ prose = null, page, marks, lineOpen, toggleLine, readingOfLine, canType, setEditing, textOf, pick }) {
  const byN = new Map(marks.map(m => [m.n, m]));
  return (
    <ol className="mp-t-list" data-mp-list aria-label={TEXT.listLabel}>
      {page.lines.filter(l => byN.has(l.n) || l.status === 'unread' || l.card?.followsFromError).map(l => {
        const m = byN.get(l.n);
        if (!m && l.status !== 'unread') {
          // a line after the first cross that is a correct consequence of the wrong line above: labelled, never ticked, never crossed, no mark
          return (
            <li key={l.n} data-mp-list-n={l.n} data-mp-follows={l.n}>
              <span className="n">{l.n}</span>
              <span className="is-follows"><button type="button" className="mp-link" onClick={() => pick(l.n, true)}>{lineWord(l.card)}</button></span>
            </li>
          );
        }
        if (!m) {
          return (
            <li key={l.n} data-mp-list-n={l.n} data-mp-unread-item>
              <span className="n">{l.n}</span>
              <span className="mp-t-unread">{TEXT.unreadLine}{' '}
                {canType
                  ? <button type="button" className="mp-link" onClick={() => { if (!lineOpen(l.n)) toggleLine(l.n); setEditing({ line: l.n, text: textOf(l.n) }); }}>{TEXT.typeIt}</button>
                  : null}
                {lineOpen(l.n) && readingOfLine(l.n, true)}
              </span>
            </li>
          );
        }
        const w = listWords(m);
        return (
          <li key={l.n} data-mp-list-n={l.n}>
            <span className="n">{l.n}</span>
            <span className={`is-${m.kind}`}>
              <button type="button" className="mp-link" data-mp-plain={w.head} onClick={() => pick(l.n, true)}>{m.kind === 'right' ? <Say mark={m} prose={prose} /> : w.head}</button>
              {w.tail ? <span className="hand"> {w.tail}</span> : null}
              {w.corrected ? <span> {w.corrected}</span> : null}
              {w.mark ? <span> {w.mark}</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

const VIEWS = [['original', TEXT.original], ['marked', TEXT.markedView], ['detailed', TEXT.detailed]];
export function ViewToggle({ view, setView }) {
  const refs = useRef([]);
  const onKey = e => {
    const i = VIEWS.findIndex(([k]) => k === view);
    const to = e.key === 'ArrowRight' ? Math.min(2, i + 1) : e.key === 'ArrowLeft' ? Math.max(0, i - 1) : null;
    if (to === null) return;
    e.preventDefault(); setView(VIEWS[to][0]); refs.current[to]?.focus();
  };
  return (
    <div className="mp-t-views" role="radiogroup" aria-label={TEXT.views} data-mp-views onKeyDown={onKey}>
      {VIEWS.map(([k, label], i) => (
        <button key={k} type="button" role="radio" aria-checked={view === k} tabIndex={view === k ? 0 : -1} ref={el => { refs.current[i] = el; }}
          className={`mp-t-view${view === k ? ' is-on' : ''}`} data-mp-view-option={k} onClick={() => setView(k)}>{label}</button>
      ))}
    </div>
  );
}

/** The examiner's workspace: the server's marks, one row per real criterion, then the footer. Rows and the page trace each other. */
export function Assessment({ model, rowFocus, setRowFocus, tracedRows, examinerNote = null, children = null }) {
  if (!model) return null;
  const { mark, state, rows } = model;
  return (
    <details className="mp-t-assess" open data-mp-assess>
      <summary className="mp-t-caps">
        <span>{TEXT.assessment} <span aria-hidden="true">{'·'}</span> {TEXT.attempt} {String(model.attempt).padStart(2, '0')}</span>
        <span className="mp-t-state-note">{TEXT.marked}</span>
      </summary>
      {mark && (
        <div className="mp-t-score" data-mp-score>
          <p className="mp-t-figure" data-mp-figure={`${mark.awarded}/${mark.possible}`}><span aria-hidden="true">{mark.awarded} / {mark.possible}</span><span className="sr-only">{figureLabel(mark)}</span></p>
          <p className="mp-t-state" data-mp-state-word={state}>{TEXT[state]}</p>
        </div>
      )}
      {rows.length > 0 && (
        <>
          <h4 className="mp-t-caps mp-t-h">{TEXT.allocation}</h4>
          <ol className="mp-t-rows" data-mp-rows>
            {rows.map(r => (
              <li key={r.key}>
                <button type="button" className={`mp-t-row${rowFocus === r.key ? ' is-on' : ''}${tracedRows.has(r.key) ? ' is-traced' : ''}`} data-mp-row={r.key} data-awarded={r.awarded ? 'yes' : 'no'}
                  aria-pressed={rowFocus === r.key} onClick={() => setRowFocus(r.key)} onFocus={() => setRowFocus(r.key)} onKeyDown={e => { if (e.key === 'Escape') setRowFocus(null); }}>
                  <span className="mp-t-ord" aria-hidden="true">{String(r.i).padStart(2, '0')}</span>
                  <span className="mp-t-name">{r.name}</span>
                  <span className="mp-t-got">{r.awarded ? r.marks : 0}/{r.marks}</span>
                  <span className="mp-t-ev">{r.evidence}</span>
                </button>
              </li>
            ))}
          </ol>
        </>
      )}
      <p className="mp-t-foot" data-mp-foot>{model.footer}</p>
      {model.aiNote && <p className="mp-t-ainote" data-mp-ai-note>{model.aiNote}</p>}
      {examinerNote && <div className="mp-t-note" data-mp-examiner-note><h4 className="mp-t-caps mp-t-h">{TEXT.note}</h4><p>{examinerNote}</p></div>}
      {children}
    </details>
  );
}

/** Detailed feedback: one chip per real criterion; choosing one shows its name, its mark and the one sentence of why. */
export function StepChips({ rows, rowFocus, setRowFocus }) {
  if (!rows.length) return null;
  const cur = rows.find(r => r.key === rowFocus) || null;
  return (
    <div className="mp-t-steps" data-mp-steps>
      <p className="mp-t-caps mp-t-h" id="mp-t-steps-h">{TEXT.steps}</p>
      <div className="mp-t-chips" role="group" aria-labelledby="mp-t-steps-h">
        {rows.map(r => (
          <button key={r.key} type="button" className={`mp-t-chip${rowFocus === r.key ? ' is-on' : ''}`} data-mp-chip={r.key} aria-pressed={rowFocus === r.key}
            onClick={() => setRowFocus(rowFocus === r.key ? null : r.key)}>{TEXT.step} {r.i}</button>
        ))}
      </div>
      {cur && (
        <div className="mp-t-stepdetail" data-mp-stepdetail={cur.key} role="status">
          <p className="mp-t-name">{cur.name}</p>
          <p className="mp-t-ev">{stepMarkText(cur)} {cur.evidence}</p>
        </div>
      )}
    </div>
  );
}
