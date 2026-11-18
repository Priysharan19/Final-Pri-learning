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
import { MathText } from '../lib/latex.jsx';
import Icon from './Icon.jsx';
import { useT } from '../i18n/index.js';
import { buildAnnotatedWorking } from './annotatedWorkingModel.js';
import { CardBody } from './AnnotatedWorking.jsx';
import { strokePath } from './originalWorkModel.js';
import { STATE, alignCards, boxesFromInk, boxesFromPhoto, buildMarkedPage, commentItems, listOf } from './markedPageModel.js';
import './MarkedPage.css';

const pointsOf = s => (Array.isArray(s) ? s : Array.isArray(s?.points) ? s.points : []);
const xy = p => (Array.isArray(p) ? { x: Number(p[0]), y: Number(p[1]) } : { x: Number(p?.x), y: Number(p?.y) });
const WIDE = '(min-width: 800px)';
const wide = () => typeof window !== 'undefined' && !!window.matchMedia?.(WIDE)?.matches;

function Header({ page, t }) {
  const { parts, mark } = page.header;
  return (
    <header className="mp-head">
      <p className="mp-sentence" data-mp-sentence role="status">{parts.map(p => t(p.key, p.vars)).join(' ')}</p>
      {mark && <p className="mp-mark" data-mp-mark={`${mark.awarded}/${mark.possible}`}>{t('mp.mark', { earned: mark.awarded, possible: mark.possible })}</p>}
    </header>
  );
}

/** The page: ink drawn through its own samples, or the photo, with one outline per judged line. */
function Sheet({ source, geometry, page, active, setActive, t }) {
  const view = geometry?.view || null;
  const outlines = page.aligned && geometry ? page.lines : [];
  return (
    <div className="mp-sheet" data-mp-sheet={source.kind}>
      {source.kind === 'photo' ? (
        <img className="mp-img" src={source.src} alt={t('mp.pageAlt.photo')} />
      ) : (
        <svg className="mp-ink" role="img" aria-label={t('mp.pageAlt.ink')}
          viewBox={view ? `${view.x} ${view.y} ${view.w} ${view.h}` : '0 0 1 1'} preserveAspectRatio="xMidYMin meet">
          {(source.strokes || []).map((s, i) => <path key={i} className="mp-stroke" d={strokePath(pointsOf(s).map(xy))} />)}
        </svg>
      )}
      {outlines.map(l => l.box && (
        <span key={l.n} className={`mp-box is-${l.status}${active === l.n ? ' is-active' : ''}${l.collapsed ? ' is-quiet' : ''}`} data-mp-box={l.n} data-mp-status={l.status}
          style={{ left: `${l.box.x * 100}%`, top: `${l.box.y * 100}%`, width: `${l.box.w * 100}%`, height: `${l.box.h * 100}%` }}
          aria-hidden="true" onMouseEnter={() => setActive(l.n)} onMouseLeave={() => setActive(null)} onClick={() => setActive(l.n)}>
          <span className="mp-tag"><Icon name={STATE[l.status].icon} size={12} />{l.n}</span>
        </span>
      ))}
    </div>
  );
}

/**
 * source: { kind: 'ink', strokes } or { kind: 'photo', src, lines } where `lines` are the judged
 * lines in order (each may carry the reader's normalised `box`). The geometry is worked out here.
 */
export default function MarkedPage({ input, source, texOf = s => s, markReady = true }) {
  const t = useT();
  const uid = useId();
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
  const [active, setActive] = useState(null);
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
  const on = n => ({ onMouseEnter: () => setActive(n), onMouseLeave: () => setActive(null), onFocus: () => setActive(n), onBlur: () => setActive(null), onClick: () => setActive(n) });

  return (
    <section className="mp" aria-labelledby={`${uid}-h`} data-marked-page data-mp-source={source.kind} data-mp-aligned={page.aligned ? 'true' : 'false'} data-mp-level={level ? 'true' : undefined}>
      <h3 className="sr-only" id={`${uid}-h`}>{t('mp.title')}</h3>
      <Header page={page} t={t} />
      <div className="mp-body">
        <figure className="mp-page" ref={sheetRef}>
          <Sheet source={source} geometry={geometry} page={page} active={active} setActive={setActive} t={t} />
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
                  <p className="mp-text">{t('mp.collapsed', { count: it.lines.length, list: listOf(it.lines) })}</p>
                </li>
              );
            }
            const { card, n, status } = it.line;
            const st = STATE[status] || STATE['not-verified'];
            return (
              <li key={it.id} className={`mp-card is-${status}${active === n ? ' is-active' : ''}`} data-mp-card={n} data-mp-status={status} tabIndex={0} style={pos} {...on(n)}>
                <p className="mp-state">
                  <Icon name={st.icon} size={14} />
                  <span>{t('mp.line', { n })}</span>
                  <b>{status === 'follows' ? t('aw.status.follows', { n: card.followsFrom }) : t(st.word)}</b>
                </p>
                {(status === 'first-error' || status === 'follows') && card.text && (
                  <p className="mp-expr" data-mp-expr><MathText text={`$${texOf(card.text)}$`} /></p>
                )}
                <div className="mp-text"><CardBody card={card} model={model} t={t} /></div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
