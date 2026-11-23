// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the syllabus map, what to work on, and exam readiness
//
// Built to the approved "verified page" designs (Syllabus / SyllabusPhone,
// Readiness / ReadinessPhone; verified-page spec §2 and §4), for both editions
// (engine/syllabusBoard.js):
//   · the MAP — each focus area (Prithagoras) of the student's course as a
//     point on a 2.5D canvas, in columns of prerequisite depth along Pri's own
//     teaching links (engine/nswFocusLinks.js). Priority areas rise on a stem
//     with the marks at stake. It is drawn on a plain 2D canvas (no WebGL), and
//     only where Pri has drawn the links; otherwise the list is the view;
//   · the LIST — the same areas as a listbox, grouped by year, moved through
//     with the arrow keys: the equal, keyboard and screen-reader view;
//   · the AREA — its outcomes, each with its code, Pri's own plain-language
//     description (the dot points Pri practises there — never NESA's wording)
//     and its evidence state, as a shape and a word;
//   · WHAT TO WORK ON — Learn / Consolidate / Retain / Extend, the reason in
//     plain words, the marks at stake as a range, questions and time;
//   · EXAM READINESS — the student's own timed, server-marked papers: raw
//     results, conditions and sections; no predicted mark, band or ATAR.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { tLater, useT } from '../i18n/index.js';
import TermGloss from '../components/TermGloss.jsx';
import { dotpointById } from '../engine/curriculum.js';
import { nswExamBlueprint } from '../engine/nswExams.js';
import { indiaExamBlueprint } from '../engine/indiaExams.js';
import { NSW_BOARD_COURSES, NSW_DOTPOINT_OUTCOMES } from '../engine/nswBoardCatalogue.js';
import { NSW_FOCUS_LINKS } from '../engine/nswFocusLinks.js';
import {
  NODE_STATES, boardPriorities, forecastAreas, groupState, indiaAreas, indiaBoardGroups, nswAreas, nswBoardGroups,
  paperReadiness, syllabusBoard, tallyOf
} from '../engine/syllabusBoard.js';
import { practiceHref } from '../lib/practiceLinks.js';
import { offering, pathwayOffered } from '../platform/edition.js';
import { formatDate } from '../lib/locale.js';
import { defaultCourse } from '../platform/edition.js';

// hsc-forecast (PR #1003) when it is in this build; until then the glob is empty
// and the board falls back to Pri's blueprint, labelled as such.
const FORECAST = import.meta.glob('../engine/hsc/hscPriorities.js');

// Explicit maps (not template keys) so the catalogue check sees every string.
export const STATE_WORD = {
  'not-started': 'board.state.notStarted', seen: 'board.state.seen', assisted: 'board.state.assisted',
  thin: 'board.state.thin', recheck: 'board.state.recheck', independent: 'board.state.independent', retained: 'board.state.retained'
};
const STATE_HELP = {
  'not-started': 'board.stateHelp.notStarted', seen: 'board.stateHelp.seen', assisted: 'board.stateHelp.assisted',
  thin: 'board.stateHelp.thin', recheck: 'board.stateHelp.recheck', independent: 'board.stateHelp.independent', retained: 'board.stateHelp.retained'
};
const ACTION_WORD = { learn: 'board.action.learn', consolidate: 'board.action.consolidate', retain: 'board.action.retain', extend: 'board.action.extend' };
const WHY = {
  slipped: 'board.why.slipped', learnSome: 'board.why.learnSome', learnNone: 'board.why.learnNone',
  consolidate: 'board.why.consolidate', retain: 'board.why.retain', extend: 'board.why.extend', learnPart: 'board.why.learnPart'
};
const TREND_WORD = { up: 'board.ready.trendUp', down: 'board.ready.trendDown', level: 'board.ready.trendLevel' };

/** The NSW courses a student is on, the one to show first first. */
export function nswCoursesFor(user) {
  const y = Number(user?.year);
  const pw = user?.pathway;
  const all = y <= 8 ? ['k10-stage4'] : y <= 10 ? ['k10-stage5']
    : pw === 'standard' ? ['standard-2', 'standard-1'] : pw === 'ext1' ? ['extension-1', 'advanced']
      : pw === 'ext2' ? ['extension-2', 'extension-1'] : ['advanced'];
  // Owner decision, 19 Nov 2026: only the courses the edition offers are shown (Prithagoras: Advanced and
  // Extension 1). A student still on a hidden course sees Advanced until they choose (components/OfferedCourse.jsx).
  if (!offering()) return all;
  const shown = all.filter(c => !c.startsWith('k10') && pathwayOffered(c.startsWith('standard') ? 'standard' : c === 'extension-1' ? 'ext1' : c === 'extension-2' ? 'ext2' : 'advanced'));
  return shown.length ? shown : ['advanced'];
}

/** A topic's sentence: how many points are shown on their own, then only the states it holds. */
export function groupSummary(tally, t) {
  const parts = [t('board.sum.own', { own: tally.independent + tally.retained, total: tally.total })];
  if (tally.retained) parts.push(t('board.sum.held', { n: tally.retained }));
  if (tally.assisted) parts.push(t('board.sum.help', { n: tally.assisted }));
  if (tally.recheck) parts.push(t('board.sum.recheck', { n: tally.recheck }));
  if (tally.thin) parts.push(t('board.sum.thin', { n: tally.thin }));
  if (tally.seen) parts.push(t('board.sum.seen', { n: tally.seen }));
  if (tally['not-started']) parts.push(t('board.sum.none', { n: tally['not-started'] }));
  return parts.join(' · ');
}

// ── Glyphs: a distinct shape per state (circles, as the approved design) ─────

/** Each state's glyph as SVG. Never colour alone: every shape differs. */
export function StateGlyph({ state, size = 16 }) {
  const c = size / 2, r = size * 0.375;
  const ring = <circle cx={c} cy={c} r={r} className="sb-g-line" />;
  let body = ring;
  if (state === 'not-started') body = ring;
  else if (state === 'seen') body = <>{ring}<circle cx={c} cy={c} r={size * 0.125} className="sb-g-solid" /></>;
  else if (state === 'assisted') body = <>{ring}<path d={`M${c} ${c - r}a${r} ${r} 0 0 0 0 ${2 * r}z`} className="sb-g-solid" /></>;
  else if (state === 'thin') body = <circle cx={c} cy={c} r={r} className="sb-g-line" strokeDasharray="2.5 2.5" />;
  else if (state === 'recheck') body = <>{ring}<path d={`M${c} ${c}L${c} ${c - r}A${r} ${r} 0 1 0 ${c + r} ${c}Z`} className="sb-g-solid" /></>;
  else if (state === 'independent') body = <circle cx={c} cy={c} r={r} className="sb-g-solid" />;
  else if (state === 'retained') body = <><circle cx={c} cy={c} r={size * 0.29} className="sb-g-solid" /><circle cx={c} cy={c} r={size * 0.45} className="sb-g-line" strokeWidth="1.2" /></>;
  return <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" data-glyph={state} style={{ flex: 'none' }}>{body}</svg>;
}

/** The same shapes on a canvas. */
function drawGlyph(ctx, x, y, r, state, col, bg) {
  const T = Math.PI * 2;
  ctx.lineWidth = 1.6; ctx.strokeStyle = col; ctx.fillStyle = bg;
  ctx.setLineDash(state === 'thin' ? [3, 3] : []);
  ctx.beginPath(); ctx.arc(x, y, r, 0, T); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = col;
  if (state === 'seen') { ctx.beginPath(); ctx.arc(x, y, r * 0.33, 0, T); ctx.fill(); }
  if (state === 'assisted') { ctx.beginPath(); ctx.moveTo(x, y - r); ctx.arc(x, y, r, -Math.PI / 2, Math.PI / 2, true); ctx.closePath(); ctx.fill(); }
  if (state === 'recheck') { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - r); ctx.arc(x, y, r, -Math.PI / 2, 0, true); ctx.closePath(); ctx.fill(); }
  if (state === 'independent' || state === 'retained') { ctx.beginPath(); ctx.arc(x, y, state === 'retained' ? r * 0.78 : r, 0, T); ctx.fill(); }
  if (state === 'retained') { ctx.beginPath(); ctx.arc(x, y, r + 3.5, 0, T); ctx.stroke(); }
}

// ── The 2.5D map (canvas; no WebGL) ──────────────────────────────────────────

function cssVar(el, name, fallback) {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  return v || fallback;
}

/**
 * Areas laid out by Pri's links: columns of prerequisite depth, a slight tilt
 * for depth, curved links from what an area builds on. Raised areas ease up
 * (about 0.22 of the distance a frame) and the loop stops once settled;
 * reduced motion places them at once.
 */
export function MapCanvas({ areas, links, selected, onSelect, raised, label, axis = ['', ''], phone = false }) {
  const ref = useRef(null);
  const lift = useRef(new Map());
  const hits = useRef([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [reduce, setReduce] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return undefined;
    const on = () => setReduce(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const cv = ref.current;
    if (!cv || !size.w || !size.h) return undefined;
    let raf = 0;
    const draw = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1), w = size.w, h = size.h;
      const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
      if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
      const ctx = cv.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      const ink = cssVar(cv, '--ink', '#1c1b18'), ink2 = cssVar(cv, '--ink-2', '#48463f'), ink3 = cssVar(cv, '--ink-3', '#6b675e');
      const accent = cssVar(cv, '--accent', '#1b1a17'), bg = cssVar(cv, '--surface', '#ffffff'), hair = cssVar(cv, '--hairline-strong', 'rgba(0,0,0,.18)');
      const font = cssVar(cv, '--font', 'sans-serif'), mono = cssVar(cv, '--font-mono', 'monospace');
      // The canvas's own CSS colour is the selection light (the edition's, under the Aurora skin):
      // the selection ring and the selected area's links only. Text and stems stay ink.
      const lit = getComputedStyle(cv).color || accent;
      const cols = Math.max(...areas.map(a => a.col)) + 1, rows = Math.max(...areas.map(a => a.row)) + 1;
      const padX = phone ? 34 : 80, padY = phone ? 40 : 64, R = phone ? 7 : 9;
      let moving = false;
      const rowGap = ((h - 2 * padY) / Math.max(1, rows - 1)) * 0.9;
      const pos = new Map(areas.map(a => {
        const gx = padX + (cols > 1 ? a.col / (cols - 1) : 0.5) * (w - 2 * padX);
        const gy = (a.row - (rows - 1) / 2) * ((h - 2 * padY) / Math.max(1, rows - 1)) * 0.9;
        // A raised point rises only into the space its row leaves clear: a row holds the point
        // (2R) and its name below it (12 px + 14 px a line), so it never meets the name above.
        const nameH = R + 12 + (rows > 8 ? 2 : 3) * 14;
        const target = raised.has(a.id) ? Math.max(0, Math.min(phone ? 24 : 38, rowGap - nameH - R - 4)) : 0;
        let v = lift.current.get(a.id) || 0;
        if (reduce) v = target; else { v += (target - v) * 0.22; if (Math.abs(target - v) < 0.3) v = target; else moving = true; }
        lift.current.set(a.id, v);
        const base = h / 2 + gy;
        return [a.id, { x: gx, base, y: base - v, lift: v }];
      }));
      // Floor: a hairline per depth column.
      ctx.strokeStyle = hair; ctx.lineWidth = 1; ctx.globalAlpha = 0.5;
      for (let k = 0; k < cols; k++) { const x = padX + (cols > 1 ? k / (cols - 1) : 0.5) * (w - 2 * padX); ctx.beginPath(); ctx.moveTo(x, padY * 0.5); ctx.lineTo(x, h - padY * 0.5); ctx.stroke(); }
      ctx.globalAlpha = 1;
      // Links, from what an area builds on; the selected area's are lit.
      for (const [from, to] of links) {
        const a = pos.get(from), b = pos.get(to);
        if (!a || !b) continue;
        const on = selected === from || selected === to;
        ctx.strokeStyle = on ? lit : ink3; ctx.globalAlpha = on ? 0.95 : 0.4; ctx.lineWidth = on ? 1.8 : 1.1;
        const mx = (a.x + b.x) / 2;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.bezierCurveTo(mx, a.y, mx, b.y, b.x, b.y); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      // Stems under raised areas.
      for (const [, p] of pos) {
        if (p.lift <= 1) continue;
        ctx.strokeStyle = ink2; ctx.globalAlpha = 0.7; ctx.setLineDash([2, 3]);
        ctx.beginPath(); ctx.moveTo(p.x, p.base); ctx.lineTo(p.x, p.y); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = ink3; ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.ellipse(p.x, p.base, 7, 2.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      }
      hits.current = [];
      const colW = (w - 2 * padX) / Math.max(1, cols - 1) - 14;
      for (const a of areas) {
        const p = pos.get(a.id), sel = selected === a.id;
        if (sel) { ctx.strokeStyle = lit; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, R + 9, 0, Math.PI * 2); ctx.stroke(); }
        drawGlyph(ctx, p.x, p.y, R, a.state, a.state === 'independent' || a.state === 'retained' ? accent : ink2, bg);
        ctx.font = `500 ${phone ? 10 : 12}px ${font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        if (!phone || sel || p.lift > 1) {
          const lines = []; let cur = '';
          for (const word of a.name.split(' ')) { const next = cur ? `${cur} ${word}` : word; if (ctx.measureText(next).width > colW && cur) { lines.push(cur); cur = word; } else cur = next; }
          if (cur) lines.push(cur);
          ctx.fillStyle = sel ? ink : ink2;
          lines.slice(0, rows > 8 ? 2 : 3).forEach((ln, k) => ctx.fillText(ln, Math.max(colW / 2, Math.min(w - colW / 2, p.x)), p.y + R + 12 + k * 14));
        }
        const stake = raised.get(a.id);
        if (p.lift > 1 && stake) {
          ctx.font = `500 11px ${mono}`; ctx.fillStyle = ink;
          // Beside the raised point, not above it, so it never runs into the row above;
          // on the left when the right edge is too close.
          const tw = ctx.measureText(stake).width, gap = R + (sel ? 14 : 0) + 10;   // clear of the selection ring
          // The side with room: no other point in the way on this row, and inside the canvas.
          const clear = dir => p.x + dir * (gap + tw) > 4 && p.x + dir * (gap + tw) < w - 4
            // A raised neighbour may put its own label towards this one: leave room for both.
            && ![...pos.values()].some(q => q !== p && Math.abs(q.y - p.y) < 22 && (q.x - p.x) * dir > 0
              && Math.abs(q.x - p.x) < (q.lift > 1 ? 2 : 1) * (gap + tw) + R + 12);
          const side = clear(1) ? 1 : clear(-1) ? -1 : 0;
          if (side) { ctx.textAlign = side > 0 ? 'left' : 'right'; ctx.fillText(stake, p.x + side * gap, p.y); }
          else { ctx.fillText(stake, Math.max(tw / 2 + 4, Math.min(w - tw / 2 - 4, p.x)), p.y - gap - 4); }
          ctx.textAlign = 'center';
        }
        hits.current.push([p.x, p.y, a.id]);
      }
      // Depth, in words, along the floor.
      if (!phone) {
        ctx.font = `500 11px ${font}`; ctx.fillStyle = ink3; ctx.textAlign = 'left';
        ctx.fillText(axis[0], padX - 10, h - 16);
        ctx.textAlign = 'right'; ctx.fillText(axis[1], w - padX + 10, h - 16);
      }
      if (moving) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [areas, links, selected, raised, size, phone, reduce, axis]);

  const pick = e => {
    const r = e.currentTarget.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    let best = null, bd = 30 * 30;
    for (const [hx, hy, id] of hits.current) { const d = (hx - x) ** 2 + (hy - y) ** 2; if (d < bd) { bd = d; best = id; } }
    if (best) onSelect(best);
  };
  // Taller for a map with more rows, so its labels keep their room.
  const rowCount = areas.length ? Math.max(...areas.map(a => a.row)) + 1 : 1;
  const height = phone ? Math.max(360, rowCount * 44 + 80) : Math.max(440, rowCount * (rowCount > 8 ? 84 : 72) + 128);
  // Picking a point with the pointer is an enhancement of the picture: the keyboard and screen-reader view is the
  // list (the Map/List switch above is a tab stop), which does everything the picture does. The pointer listener is
  // attached here, not as a React onClick, so the canvas is a labelled image and not a half-interactive control.
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    canvas.addEventListener('click', pick);
    return () => canvas.removeEventListener('click', pick);
  });
  return <canvas ref={ref} className="sb-canvas" role="img" aria-label={label} style={{ height, minHeight: height, maxHeight: 'none' }} data-board-map data-rows={rowCount} />;
}

// ── The list: the same areas, a listbox moved with the arrow keys ────────────

export function AreaList({ sections, selected, onSelect, label }) {
  const t = useT();
  const flat = sections.flatMap(s => s.areas);
  const at = flat.findIndex(a => a.id === selected);
  const key = e => {
    const k = e.key;
    let i;
    if (k === 'ArrowDown' || k === 'ArrowRight') i = Math.min(flat.length - 1, at + 1);
    else if (k === 'ArrowUp' || k === 'ArrowLeft') i = Math.max(0, at - 1);
    else if (k === 'Home') i = 0;
    else if (k === 'End') i = flat.length - 1;
    else return;
    e.preventDefault();
    if (flat[i]) onSelect(flat[i].id);
  };
  return (
    <div role="listbox" tabIndex={0} aria-label={label} aria-activedescendant={at >= 0 ? `sb-opt-${selected}` : flat[0] ? `sb-opt-${flat[0].id}` : undefined} onKeyDown={key} className="sb-listbox" data-board-list>
      {sections.map(s => (
        <div role="group" aria-label={s.label} key={s.label}>
          <div className="sb-list-head" aria-hidden="true">{s.label}</div>
          {s.areas.map(a => (
            <div key={a.id} id={`sb-opt-${a.id}`} role="option" aria-selected={a.id === selected} className={a.id === selected ? 'sb-opt on' : 'sb-opt'}
              onClick={() => onSelect(a.id)} data-area={a.id} data-state={a.state}>
              <StateGlyph state={a.state} />
              <span lang="en"><TermGloss text={a.name} /></span>
              <span className="sb-opt-state">{t(STATE_WORD[a.state])}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── One area: its outcomes, their states, and practice ───────────────────────

/** Pri's own plain-language description of an NSW outcome: the dot points Pri practises at it. */
export function nswOutcomeDescription(code) {
  return Object.entries(NSW_DOTPOINT_OUTCOMES).filter(([, codes]) => codes.includes(code))
    .map(([id]) => dotpointById(id)?.text).filter(Boolean);
}

// Where "Practise this" goes when the area is not one of the ranked priorities:
// the weakest outcome with practice, never one already held after a gap.
const PRACTISE_ORDER = ['recheck', 'assisted', 'thin', 'seen', 'not-started', 'independent'];

/** Where an area's "Practise this" goes: the card's own target when it is a priority, so the button does what the card says. */
export function practiseTarget(area, priority = null) {
  return priority?.practise
    || [...area.nodes].filter(n => n.practise && PRACTISE_ORDER.includes(n.state))
      .sort((a, b) => PRACTISE_ORDER.indexOf(a.state) - PRACTISE_ORDER.indexOf(b.state))[0]?.practise || null;
}

export function AreaDetail({ area, india, track, priority = null }) {
  const t = useT();
  const nav = useNavigate();
  const target = practiseTarget(area, priority);
  return (
    <div className="sb-area" data-board-area={area.id}>
      <span className="sb-label">{area.year ? t('common.yearNumber', { n: area.year }) : area.stage ? t('board.stage', { n: area.stage }) : ''}{!india && ` · ${area.nodes.map(n => n.code).join(', ')}`}</span>
      <h3 className="sb-area-title" lang="en"><TermGloss text={area.name} /></h3>
      <span className="sb-area-state"><StateGlyph state={area.state} /> {t(STATE_WORD[area.state])}</span>
      <p className="sb-label" data-group-summary>{groupSummary(tallyOf(area.nodes), t)}</p>
      <p className="sb-label sb-area-help">{t(STATE_HELP[area.state])}</p>
      <ul className="sb-outcomes" aria-label={t(india ? 'board.outcomesIndia' : 'board.outcomes')}>
        {area.nodes.map(n => {
          const desc = india ? [] : nswOutcomeDescription(n.code);
          const ev = n.evidence;
          return (
            <li key={n.id} data-node={n.id} data-state={n.state}>
              <StateGlyph state={n.state} />
              <div>
                <div className="sb-outcome-head">
                  {india ? <span lang="en"><TermGloss text={n.label} /></span> : <span className="sb-code">{n.code}</span>}
                  <span className="sb-label">{t(STATE_WORD[n.state])}</span>
                </div>
                {!india && (desc.length
                  ? <div className="sb-label" lang="en">{t('board.priPractises')} {desc.join('; ')}</div>
                  : <div className="sb-label">{t('board.noPriDescription')}</div>)}
                <div className="sb-label sb-mono">{ev
                  ? t('board.ev.line', { answered: ev.answered, own: ev.independentRight, date: formatDate(ev.lastAt, defaultCourse()) })
                  : t('board.ev.none')}{n.breadth && n.breadth.total > 1 && ev ? ` · ${t('board.ev.kindsLine', { shown: n.breadth.shown, n: n.breadth.total })}` : ''}</div>
              </div>
            </li>
          );
        })}
      </ul>
      {!india && area.contentGroups?.length > 0 && <p className="sb-label"><span>{t('board.contentGroups')}:</span> <span lang="en">{area.contentGroups.join(' · ')}</span></p>}
      {target
        ? <button className="btn btn-primary btn-sm sb-practise" data-board-practise onClick={() => nav(practiceHref({ subtopic: target.subtopic, dotpoint: target.dotpoint, track: india ? track : null }))}>{t('board.practiseThis')}</button>
        : <p className="sb-label">{t('board.noPractice')}</p>}
    </div>
  );
}

// ── What to work on ──────────────────────────────────────────────────────────

const stakeText = (t, s) => (s.low === s.high ? t('board.prio.stakeOneShort', { n: s.high }) : `${s.low}–${s.high}`);

export function PrioritiesView({ priorities, onSelect, source, disclaimer = '', paperName = '' }) {
  const t = useT();
  const { items, stake, paperMarks } = priorities;
  return (
    <section aria-labelledby="sb-prio" className="sb-prio" data-board-priorities data-weights={source}>
      <div className="sb-prio-head"><h2 id="sb-prio" className="sb-h2">{t('board.prio.title')}</h2>
        {stake && paperMarks != null && <span className="sb-label" data-board-stake={`${stake.low}-${stake.high}`}>{stake.high === 0
          ? t('board.prio.stakeNone', { paper: paperName, total: paperMarks })
          : t('board.prio.stakeTotal', { range: stakeText(t, stake), total: paperMarks, paper: paperName })}</span>}
      </div>
      {!items.length ? <p className="sb-label">{t('board.prio.none')}</p> : (
        <ol className="sb-cards">
          {items.map(item => (
            <li key={item.id}>
              <button type="button" className={`sb-card k-${item.action}`} onClick={() => onSelect?.(item.id)} data-priority={item.id} data-action={item.action}>
                <span className="sb-kind">{t(ACTION_WORD[item.action])}</span>
                <span className="sb-card-name" lang="en"><TermGloss text={item.name} /></span>
                <span className="sb-card-why">{t(WHY[item.why.key], item.why)}</span>
                {item.stake && item.stake.high > 0 && <span className="sb-mono sb-card-stake">{t('board.prio.atStake', { range: stakeText(t, item.stake) })}</span>}
                <span className="sb-mono sb-label">{t('board.prio.size', { count: item.questions, n: item.questions, min: item.minutes })}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
      <p className="sb-label sb-note" data-board-source={source}>
        {source === 'forecast' ? <>{t('board.prio.sourceForecast')}{disclaimer && <> <span lang="en">{disclaimer}</span></>}</>
          : source === 'blueprint-nsw' ? t('board.prio.sourceNsw')
            : source === 'blueprint-in' ? t('board.prio.sourceIndia') : t('board.prio.noWeights')}
      </p>
    </section>
  );
}

// ── Exam readiness ───────────────────────────────────────────────────────────

const shortDate = at => formatDate(at, defaultCourse());

export function ReadinessView({ readiness, edition = 'nsw', courseName = '', onSit }) {
  const t = useT();
  const ready = readiness.status === 'ready';
  const papers = ready ? readiness.papers : [];
  const firstNo = ready ? readiness.count - papers.length + 1 : 1;
  const [pick, setPick] = useState(papers.length - 1);
  const P = papers[Math.max(0, Math.min(pick, papers.length - 1))] || null;
  const prev = P ? papers[papers.indexOf(P) - 1] : null;
  const oneTotal = papers.length > 0 && papers.every(p => p.total === papers[0].total);
  // The chart: only when every paper shown is out of the same total, on that paper's own scale.
  const chart = useMemo(() => {
    if (!ready || !oneTotal) return null;
    const total = papers[0].total, step = total >= 50 ? 10 : 5;
    const lo = Math.max(0, Math.floor((Math.min(...papers.map(p => p.score)) - step) / step) * step);
    const X = i => (papers.length === 1 ? 300 : 60 + i * (480 / (papers.length - 1)));
    const Y = v => 210 - ((v - lo) / Math.max(1, total - lo)) * 190;
    const grid = []; for (let v = lo; v <= total; v += step) grid.push(v);
    return { grid, X, Y, total, line: papers.map((p, i) => `${i ? 'L' : 'M'}${X(i)} ${Y(p.score)}`).join('') };
  }, [ready, oneTotal, papers]);
  const nameOf = i => t('board.ready.paperN', { n: firstNo + i });
  const why = edition === 'in' ? t('board.ready.whyIn') : t('board.ready.whyNsw');
  return (
    <section aria-labelledby="sb-ready" className="sb-ready" data-board-readiness={readiness.status}>
      <div className="sb-ready-main">
        <h2 id="sb-ready" className="sb-h1">{t('board.ready.title')}</h2>
        <p className="sb-sub">{courseName ? t('board.ready.subCourse', { course: courseName }) : t('board.ready.sub')}</p>
        {!ready ? (
          <p className="sb-lede">{t('board.ready.sit')} <span className="sb-label">{t('board.ready.count', { count: readiness.count, n: readiness.count, needed: readiness.needed })}</span></p>
        ) : (
          <>
            <p className="sr-only" data-ready-line>{t('board.ready.last', { count: papers.length, n: papers.length, list: papers.map(p => `${p.score}/${p.total}`).join(', ') })}</p>
            {chart && (
              <svg className="sb-chart" viewBox="0 0 560 232" role="img" aria-label={t('board.ready.chartLabel', { count: papers.length, n: papers.length, list: papers.map(p => p.score).join(', '), total: chart.total })}>
                {chart.grid.map(v => <g key={v}><path d={`M40 ${chart.Y(v)}H540`} className="sb-grid" /><text x="30" y={chart.Y(v) + 4} textAnchor="end" className="sb-axis">{v}</text></g>)}
                <path d={chart.line} className="sb-line" />
                {papers.map((p, i) => (
                  <g key={p.id}>
                    <circle cx={chart.X(i)} cy={chart.Y(p.score)} r={i === papers.indexOf(P) ? 7 : 6} className={i === papers.indexOf(P) ? 'sb-pt on' : 'sb-pt'} />
                    <text x={chart.X(i)} y={chart.Y(p.score) - 16} textAnchor="middle" className="sb-pt-v">{p.score}</text>
                    <text x={chart.X(i)} y="228" textAnchor="middle" className="sb-axis">{nameOf(i)}, {shortDate(p.finishedAt)}</text>
                  </g>
                ))}
              </svg>
            )}
            <div role="group" aria-label={t('board.ready.choose')} className="sb-paper-btns">
              {papers.map((p, i) => <button key={p.id} type="button" className="sb-seg" aria-pressed={p === P} onClick={() => setPick(i)} data-paper={p.id}>{nameOf(i)}</button>)}
            </div>
            <p data-ready-trend={readiness.trend} className="sb-label">{t(TREND_WORD[readiness.trend])} {t('board.ready.spread', { low: `${readiness.spread.low.score}/${readiness.spread.low.total}`, high: `${readiness.spread.high.score}/${readiness.spread.high.total}` })}
              {!readiness.sameConditions && ` ${t('board.ready.mixed')}`}</p>
          </>
        )}
        <div className="sb-honest" data-board-honesty>
          <span className="sb-honest-title">{t(edition === 'in' ? 'board.ready.whyTitleIn' : 'board.ready.whyTitleNsw')}</span>
          <span>{why}</span>
        </div>
      </div>
      <aside className="sb-ready-side" aria-live="polite">
        {P && (
          <div className="sb-paper" data-paper-detail={P.id}>
            <span className="sb-label">{nameOf(papers.indexOf(P))}, {shortDate(P.finishedAt)} · <span lang="en">{P.title}</span></span>
            <div className="sb-score"><span className="sb-mono sb-big">{P.score}</span> <span>{t('board.ready.outOf', { total: P.total })}</span>
              {prev && prev.total === P.total && <span className="sb-mono sb-delta">{t('board.ready.delta', { d: `${P.score - prev.score >= 0 ? '+' : '−'}${Math.abs(P.score - prev.score)}`, paper: nameOf(papers.indexOf(prev)) })}</span>}
            </div>
            <span className="sb-label">{t('board.ready.conditions', {
              list: [t('board.ready.timed'), P.minutes ? t('board.ready.minutes', { n: P.minutes }) : null, P.readingMin ? t('board.ready.reading', { n: P.readingMin }) : null, t(P.full ? 'board.ready.full' : 'board.ready.part')].filter(Boolean).join(' · ')
            })}</span>
            {P.sections
              ? P.sections.map(s => (
                <div key={s.id} className="sb-section" data-section={s.id}>
                  <div className="spread"><span lang="en">{s.label || t('board.ready.section', { id: s.id })}</span><span className="sb-mono">{s.awarded} / {s.marks}</span></div>
                  <div className="sb-bar"><i style={{ width: `${(s.awarded / s.marks) * 100}%` }} /></div>
                </div>
              ))
              : <span className="sb-label">{t('board.ready.noSections')}</span>}
          </div>
        )}
        <button type="button" className="btn btn-primary sb-sit" onClick={onSit}>{t(ready ? 'board.ready.sitNext' : 'board.ready.sitFirst')}</button>
      </aside>
    </section>
  );
}

// ── The page section ─────────────────────────────────────────────────────────

/** The map, list, area and priorities for a computed board. */
export function BoardView({ board, priorities, links = null, india, track, courseLabel, phone = false, initialSelected = null, source, disclaimer, paperName }) {
  const t = useT();
  const areas = useMemo(() => board.groups.map(g => ({ ...g, state: groupState(g.nodes) })), [board]);
  const hasMap = !!links;
  const [view, setView] = useState(hasMap ? 'map' : 'list');
  const [raise, setRaise] = useState(true);
  const [sel, setSel] = useState(initialSelected || priorities.items[0]?.id || areas[0]?.id || null);
  const area = areas.find(a => a.id === sel) || areas[0];
  const axis = useMemo(() => [t('board.mapStart'), t('board.mapEnd')], [t]);
  const placed = useMemo(() => (links ? areas.filter(a => links.layout[a.id]).map(a => ({ id: a.id, name: a.name, state: a.state, col: links.layout[a.id][0], row: links.layout[a.id][1] })) : []), [areas, links]);
  const raised = useMemo(() => new Map(raise ? priorities.items.map(i => [i.id, i.stake && i.stake.high > 0 ? t('board.prio.marksShort', { range: stakeText(t, i.stake) }) : '']) : []), [raise, priorities, t]);
  const sections = useMemo(() => {
    const years = [...new Set(areas.map(a => a.year).filter(Boolean))];
    if (!years.length) return [{ label: india ? t('board.chapters') : t('board.areas'), areas }];
    return years.map(y => ({ label: t('common.yearNumber', { n: y }), areas: areas.filter(a => a.year === y) }));
  }, [areas, india, t]);
  return (
    <section className="sb" data-syllabus-board aria-labelledby="sb-title">
      <header className="sb-head">
        <h2 id="sb-title" className="sb-h2">{t('board.title')}</h2>
        <span className="sb-label" data-board-course lang="en">{courseLabel}</span>
        <div className="sb-tools">
          {hasMap && (
            <div role="group" aria-label={t('board.view')} className="sb-toggle">
              <button type="button" className="sb-seg" aria-pressed={view === 'map'} onClick={() => setView('map')}>{t('board.viewMap')}</button>
              <button type="button" className="sb-seg" aria-pressed={view === 'list'} onClick={() => setView('list')}>{t('board.viewList')}</button>
            </div>
          )}
          {hasMap && view === 'map' && <button type="button" className="sb-seg" aria-pressed={raise} onClick={() => setRaise(!raise)}>{t(raise ? 'board.raised' : 'board.raise')}</button>}
        </div>
      </header>
      <div className="sb-body">
        <div className="sb-main">
          {view === 'map' && hasMap ? (
            <>
              <MapCanvas areas={placed} links={links.links} selected={area?.id} onSelect={setSel} raised={raised} phone={phone} axis={axis}
                label={t('board.mapLabel', { count: placed.length, n: placed.length, name: area?.name || '', state: area ? t(STATE_WORD[area.state]) : '' })} />
              <ul className="sb-legend" aria-label={t('board.legend')}>
                {NODE_STATES.map(s => <li key={s} data-legend={s}><StateGlyph state={s} size={14} /> {t(STATE_WORD[s])}</li>)}
              </ul>
              <p className="sb-label">{t('board.mapHint')} {t('board.linksNote')}</p>
            </>
          ) : (
            <>
              <AreaList sections={sections} selected={area?.id} onSelect={setSel} label={t(india ? 'board.chapters' : 'board.areas')} />
              <ul className="sb-legend" aria-label={t('board.legend')}>
                {NODE_STATES.map(s => <li key={s} data-legend={s}><StateGlyph state={s} size={14} /> {t(STATE_WORD[s])}</li>)}
              </ul>
            </>
          )}
          <p className="sr-only" aria-live="polite">{area ? `${area.name}: ${t(STATE_WORD[area.state])}` : ''}</p>
        </div>
        <aside className="sb-aside">
          {area && <AreaDetail area={area} india={india} track={track} priority={priorities.items.find(i => i.id === area.id) || null} />}
          <PrioritiesView priorities={priorities} onSelect={setSel} source={source} disclaimer={disclaimer} paperName={paperName} />
          <p className="sb-label">{t('board.statesNote')}{!india && ` ${t('board.nswWording')}`}</p>
        </aside>
      </div>
    </section>
  );
}

function usePhone() {
  const q = '(max-width: 760px)';
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(q).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(q);
    if (!mq) return undefined;
    const on = () => setPhone(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return phone;
}

/**
 * The section for the signed-in student's own course.
 * @param {{ user: object, india: boolean, trackName?: string }} props
 */
export default function SyllabusBoard({ user, india, trackName = '' }) {
  const t = useT();
  const nav = useNavigate();
  const phone = usePhone();
  const [data, setData] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [error, setError] = useState('');
  const courses = useMemo(() => (india ? [] : nswCoursesFor(user)), [india, user]);
  const [courseKey, setCourseKey] = useState(courses[0] || null);

  useEffect(() => {
    let live = true;
    api.get('/progress/board').then(d => live && setData(d)).catch(err => live && setError(err.message || tLater('progress.couldNotLoad')));
    const load = Object.values(FORECAST)[0];
    if (!india && load) load().then(m => live && setForecast(m)).catch(() => {});
    return () => { live = false; };
  }, [india]);

  const view = useMemo(() => {
    if (!data) return null;
    const now = Date.now();
    if (india) {
      const board = syllabusBoard(indiaBoardGroups(data.chapters), data.attempts, { now });
      const blueprint = data.track === 'cbse' ? indiaExamBlueprint({ track: 'cbse', grade: user.year }) : null;
      const areas = indiaAreas(board, blueprint);
      return {
        board, priorities: boardPriorities(board, areas), readiness: paperReadiness(data.papers), label: trackName,
        source: areas.paperMarks != null ? 'blueprint-in' : 'none', paperName: blueprint?.label || '', links: null
      };
    }
    const course = NSW_BOARD_COURSES[courseKey];
    const board = syllabusBoard(nswBoardGroups(course), data.attempts, { located: NSW_DOTPOINT_OUTCOMES, now });
    const fromForecast = forecastAreas(board, forecast, courseKey);
    const blueprint = course?.blueprint ? nswExamBlueprint(course.blueprint) : null;
    const areas = fromForecast || nswAreas(board, blueprint);
    const label = course?.firstHsc
      ? t('board.courseLabel', { name: course.name, version: course.version, year: course.firstHsc })
      : t('board.courseLabelPlain', { name: course?.name || '', version: course?.version || '' });
    return {
      board, priorities: boardPriorities(board, areas), readiness: paperReadiness(data.papers, { course: courseKey }), label,
      source: fromForecast ? 'forecast' : areas.paperMarks != null ? 'blueprint-nsw' : 'none', disclaimer: fromForecast?.disclaimer || '',
      paperName: fromForecast ? t('board.prio.hscPaper', { name: course.name }) : blueprint ? t('board.prio.nswPaper', { name: course.name }) : '',
      links: NSW_FOCUS_LINKS[courseKey] || null, courseName: course?.name || ''
    };
  }, [data, forecast, india, courseKey, user.year, trackName, t]);

  if (error) return <div className="card" role="alert">{error}</div>;
  if (!view) return <div className="skeleton" style={{ height: 240 }} />;
  return (
    <div className="sb-wrap" data-board-edition={india ? 'in' : 'nsw'}>
      {courses.length > 1 && (
        <label className="sb-course">
          <span className="sb-label">{t('board.course')}</span>{' '}
          <select value={courseKey} onChange={e => setCourseKey(e.target.value)} data-board-select>
            {courses.map(k => <option key={k} value={k} lang="en">{NSW_BOARD_COURSES[k].name}</option>)}
          </select>
        </label>
      )}
      <BoardView key={courseKey || 'in'} board={view.board} priorities={view.priorities} links={view.links} india={india} track={data.track}
        courseLabel={view.label} phone={phone} source={view.source} disclaimer={view.disclaimer} paperName={view.paperName} />
      <ReadinessView key={courseKey || 'in'} readiness={view.readiness} edition={india ? 'in' : 'nsw'} courseName={view.courseName || trackName} onSit={() => nav('/exams')} />
    </div>
  );
}
