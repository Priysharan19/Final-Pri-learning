import React, { useEffect, useMemo, useRef, useState } from 'react';
import PageLink from '../components/PageLink.jsx';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { useT } from '../i18n/index.js';
import { PROGRESS_THRESHOLDS, accuracyClaim } from '../engine/progressTruth.js';
import { prerequisitesOf, mapStrandOf } from '../engine/prerequisites.js';
import { IN_CHAPTER_BY_ID } from '../engine/curriculum-in.js';
import { practiceHref } from '../lib/practiceLinks.js';
import { chapterEvidence, colourFor, practiceTrack, scopeFor } from './chapters.js';
import { strandColumns, MAP_W, NODE_R } from './mapLayout.js';
import TermGloss from '../components/TermGloss.jsx';
import './map.css';

// The syllabus map (v1.1 instrument, design s6): the student's chapters as a
// free constellation (instrument/mapLayout.js — column by prerequisite depth,
// syllabus order within it, no randomness, no overlapping labels), joined by
// straight engraved hairlines along Pri's authored prerequisite edges
// (engine/prerequisites.js — Pri's map, not an NCERT one). A node's size and
// fill are mastery behind the evidence floor; its marks are the server-
// certified totals (GET /marks/by-chapter). The recommended chapter is the
// adaptive engine's own pick from /stats, shown only once there is history.
// Every node is a button, so the map is fully usable from the keyboard and by
// a screen reader; the drawing is the same information, not extra.

const STRAND_KEY = {
  number: 'inst.strand.number', algebra: 'inst.strand.algebra', geometry: 'inst.strand.geometry', trig: 'inst.strand.trig',
  coord: 'inst.strand.coord', calculus: 'inst.strand.calculus', data: 'inst.strand.data'
};
// The floating card's area at the top right, in map units (310px card, its
// 24px inset and a gap; the map is drawn about 1:1 on a desktop). Nodes are
// placed clear of it, so the card never covers one.
// The card is 310px wide, inset 24px, with an 18px gap kept clear; its height
// is measured. In map units this scales with the rendered map width, and the
// card floats only while that reserve is a modest share of the map.
const CARD_PX = { w: 310 + 24 + 18, pad: 24 + 18 };
const FLOAT_MAX_SHARE = 0.4;
// "Most lost marks are in …" is said of a dot point only once it has at least
// this many certified questions, so one slip is never called a pattern.
const LOST_DOTPOINT_MIN_QUESTIONS = 3;

const secureOf = node => node.evidence.accuracy == null ? 0 : node.evidence.mastery / 100;


// Whether the map may move: the reduced-motion preference (followed live), the
// map being on screen, and the tab being visible. Off-screen or hidden, every
// map animation pauses and the pulse dots are not rendered.
function useMapMotion(ref, ready) {
  const query = '(prefers-reduced-motion: reduce)';
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches);
  const [onScreen, setOnScreen] = useState(true);
  const [tabVisible, setTabVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden');
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return undefined;
    const change = () => setReduced(mq.matches);
    change();
    mq.addEventListener?.('change', change);
    return () => mq.removeEventListener?.('change', change);
  }, []);
  useEffect(() => {
    const change = () => setTabVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', change);
    return () => document.removeEventListener('visibilitychange', change);
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(entries => setOnScreen(entries.some(e => e.isIntersecting)));
    io.observe(el);
    return () => io.disconnect();
  }, [ready]);   // the graph mounts once the curriculum has loaded
  return { reduced, running: !reduced && onScreen && tabVisible };
}

// Arrival choreography (presentation only): how many prerequisite hops each
// chapter is from the one the map opens on, over the drawn edges in either
// direction. Edges draw outward from that chapter and nodes fade in by it.
const ARRIVE_MS = 760;
function hopsFrom(originId, nodes, edges) {
  const out = new Map([[originId, 0]]);
  const near = new Map(nodes.map(n => [n.row.id, []]));
  for (const e of edges) { near.get(e.from.row.id)?.push(e.to.row.id); near.get(e.to.row.id)?.push(e.from.row.id); }
  const queue = [originId];
  while (queue.length) {
    const id = queue.shift();
    for (const next of near.get(id) || []) if (!out.has(next)) { out.set(next, out.get(id) + 1); queue.push(next); }
  }
  return out;
}

export default function MapPage() {
  const { user } = useApp();
  const t = useT();
  const [curriculum, setCurriculum] = useState(null);
  const [marks, setMarks] = useState({});
  const [month, setMonth] = useState(null);
  const [pick, setPick] = useState(null);
  const [recommended, setRecommended] = useState(null);
  const graphRef = useRef(null);
  const wrapRef = useRef(null);
  const cardRef = useRef(null);
  const [wrapW, setWrapW] = useState(0);
  const [cardH, setCardH] = useState(320);
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => {
      setWrapW(Math.round(wrap.clientWidth));
      if (cardRef.current) setCardH(Math.round(cardRef.current.offsetHeight));
    });
    ro.observe(wrap);
    if (cardRef.current) ro.observe(cardRef.current);
    return () => ro.disconnect();
  }, [!!curriculum]);
  const motion = useMapMotion(graphRef, !!curriculum);

  useEffect(() => {
    let live = true;
    api.get('/curriculum').then(c => live && setCurriculum(c)).catch(() => live && setCurriculum({}));
    api.get('/marks/by-chapter').then(r => {
      if (!live) return;
      setMarks(r?.chapters || {});
      // This month's certified marks, for the title line.
      if (r?.monthStart) api.get(`/marks/by-chapter?since=${r.monthStart}`).then(m => live && setMonth(m?.chapters || {})).catch(() => { });
    }).catch(() => { });
    api.get('/stats').then(s => {
      if (!live) return;
      const hasHistory = Number(s?.totals?.attempts) > 0;
      // Only the engine's own pick is called a recommendation.
      const top = s?.recommendation || null;
      setRecommended(hasHistory && top?.subtopic ? String(top.subtopic) : null);
    }).catch(() => { });
    return () => { live = false; };
  }, []);

  const unit = wrapW > 0 ? MAP_W / wrapW : 1;
  const floating = wrapW > 0 && CARD_PX.w * unit <= MAP_W * FLOAT_MAX_SHARE;
  // Rounded to 10 map units so a pixel of resize does not re-lay the map.
  const reserve = floating ? { w: Math.ceil((CARD_PX.w * unit) / 10) * 10, h: Math.ceil(((cardH + CARD_PX.pad) * unit) / 10) * 10 } : null;
  const layout = useMemo(() => {
    const scope = scopeFor(curriculum, user);
    const rows = scope?.chapters || scope?.subtopics || [];
    const nodes = rows.map((row, i) => ({
      row, index: i, colour: colourFor(i), strand: mapStrandOf(row.id) || 'algebra',
      evidence: chapterEvidence(row, accuracyClaim, PROGRESS_THRESHOLDS.chapterAccuracy),
      marks: marks[row.id] || null
    }));
    const placed = strandColumns(
      nodes.map(n => ({ id: n.row.id, name: n.row.name, strand: n.strand })),
      reserve ? { card: reserve } : {}
    );
    const at = new Map(placed.nodes.map(p => [p.id, p]));
    nodes.forEach(n => Object.assign(n, { x: at.get(n.row.id).x, y: at.get(n.row.id).y, r: at.get(n.row.id).r, lines: at.get(n.row.id).lines }));
    const byId = new Map(nodes.map(node => [node.row.id, node]));
    const edges = [];
    for (const node of nodes) for (const pre of prerequisitesOf(node.row.id)) {
      const from = byId.get(pre.id);
      if (!from) continue;
      edges.push({ from, to: node, skill: pre.skill, d: `M${from.x} ${from.y} L ${node.x} ${node.y}`, opacity: 0.16 + 0.55 * Math.min(secureOf(from), secureOf(node)) });
    }
    // The syllabus sequence, drawn as one hairline route through every chapter
    // in the scope's own order (the rows as the curriculum lists them).
    const route = nodes.slice(1).map((node, i) => ({ from: nodes[i], to: node, d: `M${nodes[i].x} ${nodes[i].y} L ${node.x} ${node.y}` }));
    const started = nodes.filter(node => node.evidence.attempts > 0).length;
    // Only the chapters drawn on this map count toward the month's total.
    const monthly = month ? nodes.map(n => month[n.row.id]).filter(Boolean).reduce((a, m) => ({ earned: a.earned + (Number(m.earned) || 0), possible: a.possible + (Number(m.possible) || 0) }), { earned: 0, possible: 0 }) : null;
    return { nodes, edges, route, columns: placed.columns, height: placed.height, byId, started, monthly };
  }, [curriculum, marks, month, user, reserve?.w, reserve?.h]);  // eslint-disable-line react-hooks/exhaustive-deps

  const track = practiceTrack(user);
  const current = layout.byId.get(pick) || layout.byId.get(recommended) || layout.nodes[0] || null;
  const isRecommended = node => !!recommended && node.row.id === recommended;
  const pulse = motion.running;  // the next route flows once the map has arrived (see below)
  const scopeName = user?.indiaTrack === 'jee-main' ? 'JEE Main'
    : user?.indiaTrack === 'jee-advanced' ? 'JEE Advanced'
      : user?.year ? t('common.classNumber', { n: user.year }) : null;
  const percentOf = node => node.evidence.accuracy == null ? '—' : `${node.evidence.mastery}%`;
  const H = layout.height;

  // The map arrives once, from the chapter it opens on; later picks only move
  // the inspector. Hops are fixed at arrival so a re-layout never replays it.
  const [origin, setOrigin] = useState(null);
  const [arrived, setArrived] = useState(false);
  const opening = current && curriculum ? current.row.id : null;
  useEffect(() => { if (!origin && opening) setOrigin(opening); }, [origin, opening]);
  useEffect(() => {
    if (!origin || arrived) return undefined;
    const id = setTimeout(() => setArrived(true), motion.reduced ? 0 : ARRIVE_MS);
    return () => clearTimeout(id);
  }, [origin, arrived, motion.reduced]);
  const hops = useMemo(() => (origin ? hopsFrom(origin, layout.nodes, layout.edges) : new Map()), [layout, origin]);
  const hopOf = id => Math.min(4, hops.has(id) ? hops.get(id) : 3);
  // An edge is drawn from its end nearer the origin, so the lines grow outward.
  const outward = e => (hopOf(e.to.row.id) < hopOf(e.from.row.id) ? `M${e.to.x} ${e.to.y} L ${e.from.x} ${e.from.y}` : e.d);

  // The card's prose: fixed sentences over the chapter's own figures.
  const lostDotpoint = node => {
    const dps = Object.values(node?.marks?.dotpoints || {})
      .filter(d => d.text && Number(d.questions) >= LOST_DOTPOINT_MIN_QUESTIONS && d.possible - d.earned >= 1)
      .sort((a, b) => (b.possible - b.earned) - (a.possible - a.earned) || String(a.text).localeCompare(String(b.text)));
    return dps[0] || null;
  };
  const named = (key, vars, slot, text) => {
    const [pre, post = ''] = t(key, { ...vars, [slot]: '\u0000' }).split('\u0000');
    return <>{pre}<span lang="en"><TermGloss text={text} /></span>{post}</>;
  };
  const preNames = node => prerequisitesOf(node.row.id).map(p => layout.byId.get(p.id)?.row.name || IN_CHAPTER_BY_ID[p.id]?.name || p.id);

  if (!curriculum) return <div className="skeleton" style={{ height: 520 }} aria-hidden="true" />;

  const lost = current ? lostDotpoint(current) : null;
  const feeds = current ? preNames(current) : [];

  return (
    <div className="in-map" data-instrument-map>
      <div className={`in-map-graph-wrap${floating ? ' is-floating' : ''}`} ref={wrapRef}>
        <header className="in-map-head">
          <h1>{scopeName ? t('inst.mapTitleScope', { scope: scopeName }) : t('inst.mapTitle')}</h1>
          <p data-map-subline>
            {t('inst.mapStarted', { started: layout.started, total: layout.nodes.length })}
            {layout.monthly && layout.monthly.possible > 0 && <> · {t('inst.mapMonth', { earned: layout.monthly.earned, possible: layout.monthly.possible })}</>}
          </p>
        </header>
        <div className={`in-map-graph${motion.running ? '' : ' is-still'}${arrived ? ' is-arrived' : ' is-arriving'}`} ref={graphRef} data-map-arrived={arrived ? 'true' : 'false'}>
          <svg viewBox={`0 0 ${MAP_W} ${H}`} role="presentation" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
            {layout.columns.map(c => STRAND_KEY[c.strand] && <text key={c.strand} className="in-map-strand" x={c.x - NODE_R} y={c.headY}>{t(STRAND_KEY[c.strand])}</text>)}
            {layout.route.map((e, i) => (
              <path key={`r${i}`} className={`in-map-route${isRecommended(e.to) && !layout.edges.some(x => isRecommended(x.to)) ? ' is-toward' : ''}`} pathLength="1"
                d={e.d} style={{ '--hop': Math.min(hopOf(e.from.row.id), hopOf(e.to.row.id)) }} />
            ))}
            {layout.edges.map((e, i) => (
              <path key={i} className={`in-map-edge${isRecommended(e.to) ? ' is-toward' : ''}`} pathLength="1"
                d={outward(e)} style={{ strokeOpacity: isRecommended(e.to) ? undefined : 0.45 + 0.55 * e.opacity, '--hop': Math.min(hopOf(e.from.row.id), hopOf(e.to.row.id)) }} />
            ))}
            {pulse && arrived && layout.edges.filter(e => isRecommended(e.to)).map((e, i) => [0, 1].map(k => (
              <circle key={`${i}-${k}`} className="in-map-pulse" r={2.6} style={{ '--cc': `var(${e.to.colour})` }}>
                <animateMotion dur="2.4s" begin={`${-(k * 1.2 + i * 0.31)}s`} repeatCount="indefinite" path={e.d} />
              </circle>
            )))}
            {layout.nodes.map(node => (
              <g key={node.row.id} className={`in-map-node${current?.row.id === node.row.id ? ' is-on' : ''}${isRecommended(node) ? ' is-next' : ''}`} style={{ '--cc': `var(${node.colour})`, '--hop': hopOf(node.row.id) }} data-map-node={node.row.id}>
                {/* C's sub-dial: a hairline ring whose teal arc is the floored
                    mastery (dashed when not started), an ink dot at the centre. */}
                <circle className={`in-map-ring${node.evidence.attempts === 0 ? ' is-new' : ''}`} cx={node.x} cy={node.y} r={node.r} />
                {node.evidence.accuracy != null && node.evidence.mastery > 0 && (
                  <circle className="in-map-arc" cx={node.x} cy={node.y} r={node.r} pathLength="100"
                    strokeDasharray={`${node.evidence.mastery} 100`} transform={`rotate(-90 ${node.x} ${node.y})`} />
                )}
                <circle className="in-map-dot" cx={node.x} cy={node.y} r={2.5} />
                <text x={node.x + node.r + 14} y={node.y + 3} className="in-map-name" lang="en">
                  {node.lines.map((ln, k) => <tspan key={k} x={node.x + node.r + 14} dy={k ? 17 : 0}>{ln}</tspan>)}
                </text>
                <text x={node.x + node.r + 14} y={node.y + 3 + (node.lines.length - 1) * 17 + 17} className="in-map-label">
                  {`${String(node.index + 1).padStart(2, '0')} · ${percentOf(node)}`}
                </text>
              </g>
            ))}
          </svg>
          <ol className="in-map-list" aria-label={t('inst.mapTitle')}>
            {layout.nodes.map(node => (
              <li key={node.row.id} style={{ left: `${(node.x / MAP_W) * 100}%`, top: `${(node.y / H) * 100}%` }}>
                <button type="button" className={`in-map-hit${isRecommended(node) ? ' is-next' : ''}`} data-map-chapter={node.row.id}
                  aria-current={current?.row.id === node.row.id ? 'true' : undefined}
                  aria-describedby={current?.row.id === node.row.id ? 'in-map-card' : undefined}
                  aria-label={`${STRAND_KEY[node.strand] ? t(STRAND_KEY[node.strand]) + ' · ' : ''}${node.row.name}${isRecommended(node) ? ` · ${t('inst.mapNext')}` : ''}`}
                  onClick={() => setPick(node.row.id)} onFocus={() => setPick(node.row.id)}
                  onMouseEnter={e => { if (window.matchMedia?.('(hover: hover)').matches && e.currentTarget.getBoundingClientRect().width < 60) setPick(node.row.id); }}>
                  {/* The phone list shows the bare name for space; the card carries the gloss. */}
                  <span className="in-map-hit-name" aria-hidden="true">
                    <svg className="in-map-hit-dial" viewBox="0 0 20 20" width="20" height="20">
                      <circle className={`in-map-ring${node.evidence.attempts === 0 ? ' is-new' : ''}`} cx="10" cy="10" r="8" />
                      {node.evidence.accuracy != null && node.evidence.mastery > 0 && <circle className="in-map-arc" cx="10" cy="10" r="8" pathLength="100" strokeDasharray={`${node.evidence.mastery} 100`} transform="rotate(-90 10 10)" />}
                      <circle className="in-map-dot" cx="10" cy="10" r="1.8" />
                    </svg>
                    <b>{String(node.index + 1).padStart(2, '0')}</b><span lang="en">{node.row.name}</span>
                    <em>{percentOf(node)}</em>
                    {STRAND_KEY[node.strand] && <small>{t(STRAND_KEY[node.strand])}</small>}
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <ul className="in-map-legend" aria-hidden="true">
            <li><i className="is-secure" />{t('inst.mapLegendSecure')}</li>
            <li><i className="is-building" />{t('inst.mapLegendBuilding')}</li>
            <li><i className="is-new" />{t('inst.mapLegendNew')}</li>
            <li>{t('inst.mapLegendArc')}</li>
          </ul>
        </div>

        {current && (
          <aside ref={cardRef} className="in-map-card" id="in-map-card" style={{ '--cc': `var(${current.colour})` }} data-map-card={current.row.id}>
            <div className="in-map-card-in" key={current.row.id}>
            <small>{isRecommended(current) ? t('inst.mapNext') : t('inst.chapterN', { n: current.index + 1 })}</small>
            <h2 lang="en"><TermGloss text={current.row.name} /></h2>
            <p className="in-map-prose">
              {current.marks?.possible > 0
                ? <span data-map-marks={`${current.marks.earned}/${current.marks.possible}`}>{t('inst.mapCardMarks', { earned: current.marks.earned, possible: current.marks.possible })} </span>
                : <span data-map-marks="none" />}
              {current.evidence.attempts === 0 ? t('inst.mapCardNew')
                : current.evidence.accuracy == null ? t('inst.mapCardBuilding') : t('inst.mapCardSecure', { n: current.evidence.mastery })}
              {lost && <> {named('inst.mapCardLost', {}, 'dotpoint', lost.text)}</>}
            </p>
            {feeds.length > 0 && (
              <div className="in-map-pre" data-map-builds-on>
                <span>{t('inst.mapBuildsOn')}</span>
                <ul>{prerequisitesOf(current.row.id).map((p, k) => {
                  const pre = layout.byId.get(p.id);
                  return <li key={p.id} lang="en"><TermGloss text={feeds[k]} />{pre && pre.evidence.accuracy != null && <em>{`${pre.evidence.mastery}%`}</em>}</li>;
                })}</ul>
              </div>
            )}
            <PageLink className="c-btn c-btn-primary" to={practiceHref({ subtopic: current.row.id, track })} data-map-practise>{current.evidence.attempts === 0 ? t('inst.mapStart') : t('inst.practise')}</PageLink>
            {isRecommended(current) && <p className="in-note">{t('inst.mapNextWhy')}</p>}
            </div>
          </aside>
        )}
      </div>
      <p className="in-note in-map-foot">{t('inst.mapSub')} {t('inst.mapProvenance')}</p>
    </div>
  );
}
