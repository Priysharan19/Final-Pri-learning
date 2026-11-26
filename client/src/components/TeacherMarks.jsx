// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the teacher-marked page (Prithagoras edition)
//
// The student's page, untouched, with a separate marking layer over it and a right-hand margin beside it. Ticks and the cross are SVG strokes
// drawn at the end of the line the engine judged; a boxed mark stands in the margin on the line where the server awarded it; a few short
// handwritten words say what was right. The overlay never changes the page, and a tick that would sit on writing goes to the gutter.
// All of it is data from markedPageTeacher.js (the engine's classes and the server's marks); this file draws and positions, nothing more.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { alignCards } from './markedPageModel.js';
import { TEXT, figureLabel, markBoxLabel, markLabel, placeMarks, stepMarkText, textHeight } from './markedPageTeacher.js';
import './MarkedPageTeacher.css';

const TICK_PATH = 'M3 13 C5.6 14.8 7.6 17.4 9.6 21 C13 13.6 17.6 7.2 23.6 2.6';
const CROSS_A = 'M4 4 C9 9.2 14.4 14.6 20.4 20.4';
const CROSS_B = 'M20.4 3.6 C14.6 9.6 9.4 14.8 3.8 20.6';

export function TickMark({ kind, index = 0 }) {
  return (
    <svg className={`mp-t-glyph is-${kind}`} viewBox="0 0 26 24" width="26" height="24" aria-hidden="true" focusable="false" style={{ '--i': Math.min(index, 12) }}>
      {kind === 'right'
        ? <path d={TICK_PATH} pathLength="1" />
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

const boxStyle = b => ({ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` });

/**
 * The page with its marking layer. `children` is the page itself (the photo or the ink), drawn exactly as before.
 */
export function TeacherSheet({ kind, view, page, marks, selected, pick, onKey, markersRef, trace, children, viewBoxStyle }) {
  const pageRef = useRef(null);
  const sheetRef = useRef(null);
  const dim = useSize(pageRef, { w: 800, h: 1000 });
  const sheet = useSize(sheetRef, { w: 1000, h: 1000 });
  const marked = view !== 'original';
  const roomy = sheet.w >= 600;
  // The tick is as large as the writing allows: on a small page of many lines it shrinks so neighbours do not sit on each other.
  const pitch = useMemo(() => { const ys = page.lines.filter(l => l.box).map(l => (l.box.y + l.box.h / 2) * dim.h).sort((x, y) => x - y); const d = []; for (let i = 1; i < ys.length; i += 1) d.push(ys[i] - ys[i - 1]); d.sort((x, y) => x - y); return d.length ? d[Math.floor(d.length / 2)] : Infinity; }, [page, dim.h]);
  const tick = Number.isFinite(pitch) ? Math.round(Math.min(24, Math.max(14, pitch * 0.9))) : 24;
  const placements = useMemo(() => placeMarks({ marks, obstacles: page.lines, width: dim.w, height: dim.h, size: tick }), [marks, page, dim.w, dim.h, tick]);
  const at = n => placements.find(p => p.n === n);
  // the words in the gutter: only where there is room for them (a phone reads them in the list below the page)
  const gw = 230;
  // Marked mode is a teacher's marks, not a commentary: words only at a cross and beside a mark the server paid. The list in Detailed feedback has the rest.
  const phrases = useMemo(() => (roomy ? marks.filter(m => m.phrase && (m.kind === 'wrong' || m.paid)).map(m => ({ id: `p${m.n}`, from: m.n, to: m.n, kind: m.kind, text: m.phrase, y: (placements.find(p => p.n === m.n) || {}).y ?? null })) : []), [roomy, marks, placements]);
  const colW = gw - 34 - 64;
  const items = phrases.map(p => ({ id: p.id, y: p.y == null ? 0 : p.y / dim.h, h: textHeight(p.text.length + 4, colW, 17) }));
  const tops = alignCards(items, dim.h, { gap: 6 });
  const bottom = Math.max(0, ...tops.map((t, i) => t.top + items[i].h));
  const paidMarks = marks.filter(m => m.paid && at(m.n));
  const markTops = alignCards(paidMarks.map(m => ({ id: m.n, y: at(m.n).y / dim.h, h: 24 })), dim.h, { gap: 4 });

  return (
    <div className="mp-sheet mp-t-sheet" data-mp-sheet={kind} data-mp-view={view} data-mp-size={roomy ? 'roomy' : 'compact'} data-mp-tick={tick < 18 ? 'small' : 'full'} style={{ '--mp-tick': `${tick}px` }} ref={sheetRef}>
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
            <div className="mp-markers mp-t-markers" ref={markersRef} role="group" aria-label={TEXT.marksOnPage} onKeyDown={onKey}>
              {marks.map((m, i) => {
                const p = at(m.n);
                if (!p) return null;
                const onPage = p.where === 'page';
                const style = onPage ? { left: `${(p.x / dim.w) * 100}%`, top: `${(p.y / dim.h) * 100}%` } : { top: `${(p.y / dim.h) * 100}%` };
                return (
                  <button key={m.n} type="button" className={`mp-marker mp-t-tick is-${m.kind}${onPage ? '' : ' in-gutter'}${selected === m.n ? ' is-active' : ''}`}
                    data-mp-box={m.n} data-mp-status={m.kind === 'right' ? 'checked' : 'first-error'} data-mp-where={p.where} data-mp-placement={p.placement}
                    data-mp-class={m.cls || undefined} aria-label={markLabel(m)} aria-pressed={selected === m.n} tabIndex={selected === m.n ? 0 : -1}
                    style={style} onClick={() => pick(m.n, true)}>
                    <TickMark kind={m.kind} index={i} />
                    <span className="mp-t-num" aria-hidden="true">{m.n}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {marked && (
        <div className="mp-t-gutter" data-mp-gutter style={{ minHeight: bottom }} aria-hidden="false">
          <span className="mp-t-rule" aria-hidden="true" />
          {paidMarks.map((m, i) => (
            <span key={`b${m.n}`} className={`mp-t-box${trace.has(m.n) ? ' is-traced' : ''}`} data-mp-markbox={m.n} data-mp-markbox-text={m.paid.text}
              role="img" aria-label={markBoxLabel(m)} style={{ top: markTops[i].top }}>{m.paid.text}</span>
          ))}
          {phrases.map((p, i) => (
            <button key={p.id} type="button" tabIndex={-1} aria-hidden="true" className={`mp-t-words is-${p.kind}`} data-mp-words={p.from} data-mp-words-to={p.to}
              style={{ top: tops[i].top, maxHeight: items[i].h }} onClick={() => pick(p.from, true)}>
              {p.text}
            </button>
          ))}
        </div>
      )}
    </div>
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
