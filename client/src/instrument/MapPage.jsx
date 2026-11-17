import React, { useEffect, useMemo, useRef, useState } from 'react';
import PageLink from '../components/PageLink.jsx';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { useT } from '../i18n/index.js';
import { PROGRESS_THRESHOLDS, accuracyClaim } from '../engine/progressTruth.js';
import { prerequisitesOf, mapStrandOf } from '../engine/prerequisites.js';
import { nswPrerequisitesOf } from '../engine/prerequisites-nsw.js';
import { IN_CHAPTER_BY_ID } from '../engine/curriculum-in.js';
import { practiceHref } from '../lib/practiceLinks.js';
import { chapterEvidence, colourFor, practiceTrack, scopeFor } from './chapters.js';
import { layered, layersOf, MAP_W } from './mapLayout.js';
import TermGloss from '../components/TermGloss.jsx';
import Working from './Working.jsx';
// map.css is part of the boot stylesheet (main.jsx), so a first visit offline
// needs no stylesheet fetched for this tab (#658).

// The syllabus map (v1.1 instrument, design s6): the student's chapters in
// prerequisite layers, left to right (instrument/mapLayout.js — a chapter's
// layer is how many chapters it builds on in a chain; its lane is its strand),
// joined by quiet straight hairlines along Pri's authored prerequisite links
// (engine/prerequisites.js for India, engine/prerequisites-nsw.js for NSW — Pri's
// own teaching maps, not an NCERT, CBSE or NESA publication). Hovering or
// focusing a chapter lights what it builds on and what builds on it. A node's
// size and fill are mastery behind the evidence floor; its marks are the
// server-certified totals (GET /marks/by-chapter). The recommended chapter is
// the adaptive engine's own pick from /stats, shown only once there is history.
// Every node is a button, in an ordered list grouped by layer, so the map is
// fully usable from the keyboard and by a screen reader; on a phone the same
// list is the map. The drawing is the same information, not extra.

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

const fillOf = node => 0.14 + (node.evidence.mastery / 100) * 0.86;
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

export default function MapPage() {
  const { user } = useApp();
  const t = useT();
  const [curriculum, setCurriculum] = useState(null);
  const [marks, setMarks] = useState({});
  const [month, setMonth] = useState(null);
  const [pick, setPick] = useState(null);
  const [hover, setHover] = useState(null);
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
  // The ids a chapter builds on: Pri's India map, or Pri's NSW map.
  const preIdsOf = id => (user?.course === 'in' ? prerequisitesOf(id).map(p => p.id) : nswPrerequisitesOf(id));
  // The card floats beside the drawing only while the drawing keeps enough width per layer.
  const layerTotal = useMemo(() => {
    const rows = scopeFor(curriculum, user)?.chapters || scopeFor(curriculum, user)?.subtopics || [];
    return rows.length ? Math.max(...layersOf(rows.map(r => ({ id: r.id })), preIdsOf).values()) + 1 : 1;
  }, [curriculum, user]);  // eslint-disable-line react-hooks/exhaustive-deps
  const floating = wrapW > 0 && CARD_PX.w * unit <= MAP_W * FLOAT_MAX_SHARE && layerTotal <= 4;
  // Rounded to 10 map units so a pixel of resize does not re-lay the map.
  const reserve = floating ? { w: Math.ceil((CARD_PX.w * unit) / 10) * 10, h: Math.ceil(((cardH + CARD_PX.pad) * unit) / 10) * 10 } : null;
  const layout = useMemo(() => {
    const scope = scopeFor(curriculum, user);
    const rows = scope?.chapters || scope?.subtopics || [];
    const nodes = rows.map((row, i) => ({
      row, index: i, colour: colourFor(i), strand: user?.course === 'in' ? (mapStrandOf(row.id) || 'algebra') : (row.strand || 'Mathematics'),
      evidence: chapterEvidence(row, accuracyClaim, PROGRESS_THRESHOLDS.chapterAccuracy),
      marks: marks[row.id] || null
    }));
    const strandName = n => n.strand;
    const preIds = preIdsOf;
    const placed = layered(
      nodes.map(n => ({ id: n.row.id, name: n.row.name, mastery: n.evidence.mastery, strand: strandName(n) })),
      preIds,
      reserve ? { width: MAP_W - reserve.w, card: reserve, top: 96 } : {}
    );
    const at = new Map(placed.nodes.map(p => [p.id, p]));
    nodes.forEach(n => Object.assign(n, { x: at.get(n.row.id).x, y: at.get(n.row.id).y, r: at.get(n.row.id).r, lines: at.get(n.row.id).lines, layer: at.get(n.row.id).layer }));
    const byId = new Map(nodes.map(node => [node.row.id, node]));
    const edges = [];
    const builds = new Map(nodes.map(n => [n.row.id, []]));
    const feeds = new Map(nodes.map(n => [n.row.id, []]));
    for (const node of nodes) for (const pid of preIds(node.row.id)) {
      const from = byId.get(pid);
      if (!from) continue;
      edges.push({ from, to: node, d: `M${from.x} ${from.y} L ${node.x} ${node.y}` });
      builds.get(node.row.id).push(pid);
      feeds.get(pid).push(node.row.id);
    }
    const started = nodes.filter(node => node.evidence.attempts > 0).length;
    // Only the chapters drawn on this map count toward the month's total.
    const monthly = month ? nodes.map(n => month[n.row.id]).filter(Boolean).reduce((a, m) => ({ earned: a.earned + (Number(m.earned) || 0), possible: a.possible + (Number(m.possible) || 0) }), { earned: 0, possible: 0 }) : null;
    const layerList = Array.from({ length: placed.layerCount }, (_, l) => nodes.filter(n => n.layer === l));
    return { nodes, edges, height: placed.height, width: placed.width, lanes: placed.lanes, layerList, builds, feeds, byId, started, monthly };
  }, [curriculum, marks, month, user, reserve?.w, reserve?.h]);  // eslint-disable-line react-hooks/exhaustive-deps

  const track = practiceTrack(user);
  const current = layout.byId.get(pick) || layout.byId.get(recommended) || layout.nodes[0] || null;
  const isRecommended = node => !!recommended && node.row.id === recommended;
  const pulse = motion.running;
  const yearName = user?.year ? t('common.classNumber', { n: user.year }) : null;
  const scopeName = user?.indiaTrack === 'jee-main' ? 'JEE Main'
    : user?.indiaTrack === 'jee-advanced' ? 'JEE Advanced' : yearName;
  // Priyabhata: "Class 12 mathematics". Prithagoras: the NSW course, "Year 12 Mathematics Advanced".
  const title = user?.course !== 'in' && user?.pathwayName && yearName
    ? t('inst.mapTitleCourse', { year: yearName, course: user.pathwayName })
    : scopeName ? t('inst.mapTitleScope', { scope: scopeName }) : t('inst.mapTitle');
  // A plain status line: never a bare number.
  const metaOf = node => {
    if (node.evidence.attempts === 0) return t('inst.mapMetaNew');
    const dps = Array.isArray(node.row.dotpoints) ? node.row.dotpoints : [];
    const practised = dps.filter(d => Number(d.attempts) > 0).length;
    return dps.length ? t('inst.mapMetaTopics', { n: practised, total: dps.length }) : t('inst.mapMetaAnswers', { count: node.evidence.attempts, n: node.evidence.attempts });
  };
  const H = layout.height;
  // Only a chapter the student points at or focuses lights its links; at rest the map is even.
  const litId = hover || pick || null;
  const litSet = new Set(litId ? [litId, ...(layout.builds.get(litId) || []), ...(layout.feeds.get(litId) || [])] : []);

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
  const nameOf = id => layout.byId.get(id)?.row.name || IN_CHAPTER_BY_ID[id]?.name || id;
  const preNames = node => (layout.builds.get(node.row.id) || []).map(nameOf);

  if (!curriculum) return <div className="skeleton" style={{ height: 520 }} aria-hidden="true"><Working pending={!curriculum} size={24} /></div>;

  const lost = current ? lostDotpoint(current) : null;
  const feeds = current ? preNames(current) : [];
  const firstPre = current ? layout.byId.get((layout.builds.get(current.row.id) || [])[0]) : null;
  const edgeLit = e => !!litId && (e.from.row.id === litId || e.to.row.id === litId);
  const nodeState = node => (!litId ? '' : node.row.id === litId ? ' is-on' : litSet.has(node.row.id) ? ' is-near' : ' is-dim');

  return (
    <div className="in-map" data-instrument-map>
      <div className={`in-map-graph-wrap${floating ? ' is-floating' : ''}`} ref={wrapRef}>
        <header className="in-map-head">
          <h1>{title}</h1>
          <p data-map-subline>
            {t('inst.mapStarted', { started: layout.started, total: layout.nodes.length })}
            {layout.monthly && layout.monthly.possible > 0 && <> · {t('inst.mapMonth', { earned: layout.monthly.earned, possible: layout.monthly.possible })}</>}
          </p>
        </header>
        <div className={`in-map-graph${motion.running ? '' : ' is-still'}`} ref={graphRef} data-lit={litId || undefined}
          onMouseLeave={() => setHover(null)}>
          <svg viewBox={`0 0 ${MAP_W} ${H}`} role="presentation" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
            {layout.lanes.map(lane => (
              <g key={lane.strand} className="in-map-lane">
                <line x1={0} x2={layout.width} y1={lane.top + 0.5} y2={lane.top + 0.5} />
                <text x={4} y={lane.top + 22} className="in-map-strand" lang="en">{STRAND_KEY[lane.strand] ? t(STRAND_KEY[lane.strand]) : lane.strand}</text>
              </g>
            ))}
            {layout.edges.map((e, i) => (
              <path key={i} className={`in-map-edge${edgeLit(e) ? ' is-lit' : ''}${isRecommended(e.to) ? ' is-toward' : ''}`} d={e.d} />
            ))}
            {pulse && layout.edges.filter(e => isRecommended(e.to)).map((e, i) => [0, 1].map(k => (
              <circle key={`${i}-${k}`} className="in-map-pulse" r={2.6} style={{ '--cc': `var(${e.to.colour})` }}>
                <animateMotion dur="2.4s" begin={`${-(k * 1.2 + i * 0.31)}s`} repeatCount="indefinite" path={e.d} />
              </circle>
            )))}
            {layout.nodes.map(node => (
              <g key={node.row.id} className={`in-map-node${nodeState(node)}${current?.row.id === node.row.id ? ' is-current' : ''}${isRecommended(node) ? ' is-next' : ''}`} style={{ '--cc': `var(${node.colour})` }} data-map-node={node.row.id}>
                <circle className="in-map-dot" cx={node.x} cy={node.y} r={node.r} style={{ fillOpacity: fillOf(node) }} />
                <circle className="in-map-ring" cx={node.x} cy={node.y} r={node.r + 6} />
                <text x={node.x} y={node.y + node.r + 22} className="in-map-name" textAnchor="middle" lang="en">
                  {node.lines.map((ln, k) => <tspan key={k} x={node.x} dy={k ? 16 : 0}>{ln}</tspan>)}
                </text>
                <text x={node.x} y={node.y + node.r + 22 + node.lines.length * 16 + 2} className="in-map-label" textAnchor="middle">{metaOf(node)}</text>
              </g>
            ))}
          </svg>
          <div className="in-map-layers">
            {layout.layerList.map((nodes, l) => (
              <section key={l} className="in-map-layer" aria-labelledby={`in-map-layer-${l}`}>
                <h2 id={`in-map-layer-${l}`} className="in-map-layer-h">{l === 0 ? t('inst.mapLayerFirst', { total: layout.layerList.length }) : t('inst.mapLayerN', { n: l + 1, total: layout.layerList.length })}</h2>
                <ol className="in-map-list" role="list">
                  {nodes.map(node => (
                    <li key={node.row.id} style={{ left: `${(node.x / MAP_W) * 100}%`, top: `${(node.y / H) * 100}%` }}>
                      <button type="button" className="in-map-hit" data-map-chapter={node.row.id}
                        aria-current={current?.row.id === node.row.id ? 'true' : undefined}
                        aria-describedby={current?.row.id === node.row.id ? 'in-map-card' : undefined}
                        aria-label={`${node.row.name} · ${metaOf(node)}${preNames(node).length ? ` · ${t('inst.mapBuildsOn', { names: preNames(node).join(', ') })}` : ''}${isRecommended(node) ? ` · ${t('inst.mapNext')}` : ''}`}
                        onClick={() => setPick(node.row.id)} onFocus={() => { setPick(node.row.id); setHover(null); }}
                        onMouseEnter={() => setHover(node.row.id)}>
                        {/* On a phone this is the map: the name, how far along it is, and what it builds on. */}
                        <span className="in-map-hit-name" aria-hidden="true">
                          <i className="in-map-hit-dot" style={{ '--cc': `var(${node.colour})`, '--f': fillOf(node) }} />
                          <span lang="en">{node.row.name}</span>
                          <em>{metaOf(node)}</em>
                          {preNames(node).length > 0 && <small lang="en">{t('inst.mapBuildsOn', { names: preNames(node).join(', ') })}</small>}
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
          <ul className="in-map-legend" aria-hidden="true">
            <li><i className="is-secure" />{t('inst.mapLegendSecure')}</li>
            <li><i className="is-building" />{t('inst.mapLegendBuilding')}</li>
            <li><i className="is-new" />{t('inst.mapLegendNew')}</li>
            <li>{t('inst.mapLegendSize')}</li>
          </ul>
        </div>

        {current && (
          <aside ref={cardRef} className="in-map-card" id="in-map-card" style={{ '--cc': `var(${current.colour})` }} data-map-card={current.row.id}>
            <small>{isRecommended(current) ? t('inst.mapNext') : t('inst.chapterN', { n: current.index + 1 })}</small>
            <h2 lang="en"><TermGloss text={current.row.name} /></h2>
            <p className="in-map-prose">
              {current.marks?.possible > 0
                ? <span data-map-marks={`${current.marks.earned}/${current.marks.possible}`}>{t('inst.mapCardMarks', { earned: current.marks.earned, possible: current.marks.possible })} </span>
                : <span data-map-marks="none" />}
              {current.evidence.attempts === 0 ? t('inst.mapCardNew')
                : current.evidence.accuracy == null ? t('inst.mapCardBuilding') : t('inst.mapCardSecure', { n: current.evidence.mastery })}
              {lost && <> {named('inst.mapCardLost', {}, 'dotpoint', lost.text)}</>}
              {feeds.length > 0 && <> {feeds.length === 1 && firstPre && firstPre.evidence.accuracy != null
                ? named('inst.mapCardFeedsSecure', { n: firstPre.evidence.mastery }, 'chapter', feeds.join(', '))
                : named('inst.mapCardFeeds', {}, 'chapter', feeds.join(', '))}</>}
            </p>
            <PageLink className="in-btn is-primary" to={practiceHref({ subtopic: current.row.id, track })} data-map-practise>{current.evidence.attempts === 0 ? t('inst.mapStart') : t('inst.practise')}</PageLink>
            {isRecommended(current) && <p className="in-note">{t('inst.mapNextWhy')}</p>}
          </aside>
        )}
      </div>
      <p className="in-note in-map-foot">{t('inst.mapSub')} {t('inst.mapProvenance')}</p>
    </div>
  );
}
