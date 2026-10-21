import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { useT } from '../i18n/index.js';
import { PROGRESS_THRESHOLDS, accuracyClaim } from '../engine/progressTruth.js';
import { prerequisitesOf, mapStrandOf, MAP_STRANDS } from '../engine/prerequisites.js';
import { IN_CHAPTER_BY_ID } from '../engine/curriculum-in.js';
import { practiceHref } from '../lib/practiceLinks.js';
import { chapterEvidence, colourFor, practiceTrack, scopeFor } from './chapters.js';
import TermGloss from '../components/TermGloss.jsx';

// The syllabus map (v1.1 instrument): the student's chapters as a graph laid
// out by strand (rows) and syllabus order (columns), joined by Pri's authored
// prerequisite edges (engine/prerequisites.js — Pri's map, not an NCERT one).
// A node's fill is mastery behind the evidence floor; its marks are the
// server-certified totals (GET /marks/by-chapter). The recommended chapter is
// the adaptive engine's own pick from /stats, shown only once there is history.
// Every node is a button, so the map is fully usable from the keyboard and by
// a screen reader; the drawing is the same information, not extra.

const W = 1000;
const LEFT = 190;      // the foundations column and the strand labels sit left of this
const TOP = 56;
const LINE_H = 140;    // one line of chapters: the largest node, its ring and two label lines
const PER_LINE = 5;    // more chapters than this in a strand wrap to a further line
const STRAND_KEY = {
  number: 'inst.strand.number', algebra: 'inst.strand.algebra', geometry: 'inst.strand.geometry', trig: 'inst.strand.trig',
  coord: 'inst.strand.coord', calculus: 'inst.strand.calculus', data: 'inst.strand.data'
};

// A node's radius and fill follow how secure the chapter is (mastery behind the
// evidence floor, 0 until the floor is met), as the approved map draws them.
const radiusOf = node => 10 + (node.evidence.mastery / 100) * 18;
const fillOf = node => 0.14 + (node.evidence.mastery / 100) * 0.86;
const secureOf = node => node.evidence.accuracy == null ? 0 : node.evidence.mastery / 100;

// A faint fixed field of points behind the drawing (deterministic, decorative).
const STARS = Array.from({ length: 90 }, (_, i) => ({ x: (Math.sin(i * 91.7) * 0.5 + 0.5), y: (Math.cos(i * 37.3) * 0.5 + 0.5), d: (i % 9) * 0.37 }));

// Long chapter names wrap onto two lines under the node.
function wrapName(name, max = 24) {
  const words = String(name).split(/\s+/);
  const lines = [''];
  for (const w of words) {
    const cur = lines[lines.length - 1];
    if (cur && (cur + ' ' + w).length > max && lines.length < 2) lines.push(w);
    else lines[lines.length - 1] = cur ? `${cur} ${w}` : w;
  }
  if (lines[1] && lines[1].length > max + 2) lines[1] = lines[1].slice(0, max).trimEnd() + '…';
  return lines;
}

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function MapPage() {
  const { user } = useApp();
  const t = useT();
  const [curriculum, setCurriculum] = useState(null);
  const [marks, setMarks] = useState({});
  const [pick, setPick] = useState(null);
  const [recommended, setRecommended] = useState(null);

  useEffect(() => {
    let live = true;
    api.get('/curriculum').then(c => live && setCurriculum(c)).catch(() => live && setCurriculum({}));
    api.get('/marks/by-chapter').then(r => live && setMarks(r?.chapters || {})).catch(() => { });
    api.get('/stats').then(s => {
      if (!live) return;
      const hasHistory = Number(s?.totals?.attempts) > 0;
      // Only the engine's own pick is called a recommendation.
      const top = s?.recommendation || null;
      setRecommended(hasHistory && top?.subtopic ? String(top.subtopic) : null);
    }).catch(() => { });
    return () => { live = false; };
  }, []);

  const layout = useMemo(() => {
    const scope = scopeFor(curriculum, user);
    const rows = scope?.chapters || scope?.subtopics || [];
    const strands = MAP_STRANDS.map(s => s.id);
    const nodes = rows.map((row, i) => {
      const strand = mapStrandOf(row.id) || 'algebra';
      return {
        row, index: i, colour: colourFor(i), strand,
        evidence: chapterEvidence(row, accuracyClaim, PROGRESS_THRESHOLDS.chapterAccuracy),
        marks: marks[row.id] || null
      };
    });
    // Foundations: chapters from earlier classes this syllabus builds on, one
    // level back, drawn faint in the left column so the dependencies show.
    const inScope = new Set(nodes.map(node => node.row.id));
    const foundations = [];
    const seenFoundation = new Set();
    for (const node of nodes) for (const pre of prerequisitesOf(node.row.id)) {
      if (inScope.has(pre.id) || seenFoundation.has(pre.id)) continue;
      seenFoundation.add(pre.id);
      const ch = IN_CHAPTER_BY_ID[pre.id];
      foundations.push({ id: pre.id, name: ch?.name || pre.id, strand: mapStrandOf(pre.id) || node.strand });
    }
    const used = strands.filter(s => nodes.some(n => n.strand === s) || foundations.some(f => f.strand === s));
    // Each strand is a band; its chapters sit along it in syllabus order, spread
    // across the width, wrapping to a further line past PER_LINE.
    const bands = [];
    let y = TOP;
    for (const id of used) {
      const members = nodes.filter(node => node.strand === id);
      const lines = Math.max(1, Math.ceil(members.length / PER_LINE));
      members.forEach((node, k) => {
        const line = Math.floor(k / PER_LINE);
        const inLine = Math.min(PER_LINE, members.length - line * PER_LINE);
        const slot = (W - LEFT - 40) / inLine;
        node.x = LEFT + 40 + slot * (k % PER_LINE) + slot / 2 - (inLine === 1 ? slot / 2 - 60 : 0);
        node.y = y + line * LINE_H;
      });
      bands.push({ id, y });
      y += lines * LINE_H;
    }
    const bandY = new Map(bands.map(b => [b.id, b.y]));
    const perRow = {};
    foundations.forEach(f => {
      const k = perRow[f.strand] = (perRow[f.strand] || 0) + 1;
      // Packed three to a line between the labels and the first chapter.
      const col = (k - 1) % 3; const line = Math.floor((k - 1) / 3);
      f.x = LEFT - 20 - col * 20;
      f.y = bandY.get(f.strand) - 14 + line * 14;
    });
    const byId = new Map(nodes.map(node => [node.row.id, node]));
    const foundationById = new Map(foundations.map(f => [f.id, f]));
    const edges = [];
    for (const node of nodes) {
      for (const pre of prerequisitesOf(node.row.id)) {
        const from = byId.get(pre.id) || foundationById.get(pre.id);
        if (!from) continue;
        // Straight between bands; along a band the link arcs above the chapters between.
        const d = from.y === node.y
          ? `M${from.x} ${from.y} Q ${(from.x + node.x) / 2} ${from.y - 26 - Math.abs(node.x - from.x) * 0.08}, ${node.x} ${node.y}`
          : `M${from.x} ${from.y} L ${node.x} ${node.y}`;
        const earlier = !byId.has(pre.id);
        edges.push({ from, to: node, skill: pre.skill, earlier, d, opacity: 0.16 + 0.55 * Math.min(earlier ? 0 : secureOf(from), secureOf(node)) });
      }
    }
    const started = nodes.filter(node => node.evidence.attempts > 0).length;
    const certified = Object.values(marks).reduce((a, m) => ({ earned: a.earned + (Number(m?.earned) || 0), possible: a.possible + (Number(m?.possible) || 0) }), { earned: 0, possible: 0 });
    return { nodes, edges, foundations, rows: bands, height: y - LINE_H + 128, byId, foundationById, started, certified };
  }, [curriculum, marks, user]);

  const track = practiceTrack(user);
  const current = layout.byId.get(pick) || layout.byId.get(recommended) || layout.nodes[0] || null;
  const isRecommended = node => !!recommended && node.row.id === recommended;
  const pulse = !reducedMotion();
  const scopeName = user?.indiaTrack === 'jee-main' ? 'JEE Main'
    : user?.indiaTrack === 'jee-advanced' ? 'JEE Advanced'
      : user?.year ? t('common.classNumber', { n: user.year }) : null;
  const percentOf = node => node.evidence.accuracy == null ? '—' : `${node.evidence.mastery}%`;

  if (!curriculum) return <div className="skeleton" style={{ height: 520 }} aria-hidden="true" />;

  return (
    <div className="in-map" data-instrument-map>
      <header className="in-map-head">
        <h1>{scopeName ? t('inst.mapTitleScope', { scope: scopeName }) : t('inst.mapTitle')}</h1>
        <p>
          {t('inst.mapStarted', { started: layout.started, total: layout.nodes.length })}
          {layout.certified.possible > 0 && <> · {t('inst.mapCertified', { earned: layout.certified.earned, possible: layout.certified.possible })}</>}
        </p>
      </header>
      <div className="in-map-body">
        <div className="in-map-graph">
          <svg viewBox={`0 0 ${W} ${layout.height}`} role="presentation" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
            <defs>
              {layout.edges.map((e, i) => (
                <linearGradient key={i} id={`in-map-g${i}`} gradientUnits="userSpaceOnUse" x1={e.from.x} y1={e.from.y} x2={e.to.x} y2={e.to.y}>
                  <stop offset="0" stopColor={`var(${e.earlier ? e.to.colour : e.from.colour})`} />
                  <stop offset="1" stopColor={`var(${e.to.colour})`} />
                </linearGradient>
              ))}
            </defs>
            <g className="in-map-stars">
              {STARS.map((st, i) => <rect key={i} x={st.x * W} y={st.y * layout.height} width={1.3} height={1.3} style={{ animationDelay: `${-st.d}s` }} />)}
            </g>
            {layout.rows.map(r => (
              <g key={r.id}>
                <text className="in-map-strand" x={8} y={r.y + 4}>{STRAND_KEY[r.id] ? t(STRAND_KEY[r.id]) : ''}</text>
              </g>
            ))}
            <text className="in-map-strand is-col" x={LEFT - 40} y={16} textAnchor="middle">{t('inst.mapEarlier')}</text>
            {layout.edges.map((e, i) => (
              <path key={i} className={`in-map-edge${isRecommended(e.to) ? ' is-toward' : ''}${e.earlier ? ' is-earlier' : ''}`}
                d={e.d} style={{ stroke: `url(#in-map-g${i})`, strokeOpacity: e.opacity }} />
            ))}
            {pulse && layout.edges.filter(e => isRecommended(e.to)).map((e, i) => [0, 1].map(k => (
              <circle key={`${i}-${k}`} className="in-map-pulse" r={2.6} style={{ '--cc': `var(${e.to.colour})` }}>
                <animateMotion dur="2.4s" begin={`${-(k * 1.2 + i * 0.31)}s`} repeatCount="indefinite" path={e.d} />
              </circle>
            )))}
            {layout.foundations.map(f => (
              <g key={f.id} className="in-map-foundation"><circle cx={f.x} cy={f.y} r={5} /></g>
            ))}
            {layout.nodes.map(node => {
              const r = radiusOf(node);
              const name = wrapName(node.row.name);
              return (
                <g key={node.row.id} className={`in-map-node${current?.row.id === node.row.id ? ' is-on' : ''}${isRecommended(node) ? ' is-next' : ''}`} style={{ '--cc': `var(${node.colour})` }}>
                  <circle className="in-map-dot" cx={node.x} cy={node.y} r={r} style={{ fillOpacity: fillOf(node) }} />
                  <circle className="in-map-ring" cx={node.x} cy={node.y} r={r + 7} />
                  <text x={node.x} y={node.y + r + 7 + 16} textAnchor="middle" className="in-map-name" lang="en">
                    {name.map((ln, k) => <tspan key={k} x={node.x} dy={k ? 16 : 0}>{ln}</tspan>)}
                  </text>
                  <text x={node.x} y={node.y + r + 7 + 16 + name.length * 16} textAnchor="middle" className="in-map-label">
                    {`${String(node.index + 1).padStart(2, '0')} · ${percentOf(node)}`}
                  </text>
                </g>
              );
            })}
          </svg>
          <ol className="in-map-list" aria-label={t('inst.mapTitle')}>
            {layout.nodes.map(node => (
              <li key={node.row.id} style={{ left: `${(node.x / W) * 100}%`, top: `${(node.y / layout.height) * 100}%` }}>
                <button type="button" className="in-map-hit" data-map-chapter={node.row.id}
                  aria-current={current?.row.id === node.row.id ? 'true' : undefined}
                  aria-describedby={current?.row.id === node.row.id ? 'in-map-card' : undefined}
                  aria-label={`${STRAND_KEY[node.strand] ? t(STRAND_KEY[node.strand]) + ' · ' : ''}${node.row.name}${isRecommended(node) ? ` · ${t('inst.mapNext')}` : ''}`}
                  onClick={() => setPick(node.row.id)} onFocus={() => setPick(node.row.id)}
                  onMouseEnter={e => { if (window.matchMedia?.('(hover: hover)').matches && e.currentTarget.getBoundingClientRect().width < 60) setPick(node.row.id); }}>
                  {/* The phone list shows the bare name for space; the card carries the gloss. */}
                  <span className="in-map-hit-name" aria-hidden="true">
                    <i className="in-map-hit-dot" style={{ '--cc': `var(${node.colour})`, '--f': fillOf(node) }} />
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
            <li>{t('inst.mapLegendSize')}</li>
          </ul>
        </div>

        {current && (
          <aside className="in-map-card" id="in-map-card" style={{ '--cc': `var(${current.colour})` }} data-map-card={current.row.id}>
            <small>{isRecommended(current) ? t('inst.mapNext') : t('inst.chapterN', { n: current.index + 1 })}</small>
            <h2 lang="en"><TermGloss text={current.row.name} /></h2>
            <p className="in-map-prose">{current.evidence.attempts === 0 ? t('inst.mapCardNew')
              : current.evidence.accuracy == null ? t('inst.mapCardBuilding') : t('inst.mapCardSecure', { n: current.evidence.mastery })}</p>
            <dl className="in-map-facts">
              <div><dt>{t('inst.mapMarks')}</dt><dd>{current.marks ? `${current.marks.earned} / ${current.marks.possible}` : '—'}</dd></div>
              <div><dt>{t('inst.kpiAnswered')}</dt><dd>{current.evidence.attempts}</dd></div>
              <div><dt>{t('inst.kpiAccuracy')}</dt><dd>{current.evidence.accuracy == null ? '—' : `${current.evidence.accuracy}%`}</dd></div>
            </dl>
            {prerequisitesOf(current.row.id).length > 0 && (
              <div className="in-map-pre">
                <span>{t('inst.mapBuildsOn')}</span>
                <ul>{prerequisitesOf(current.row.id).map(p => <li key={p.id} lang="en"><TermGloss text={layout.byId.get(p.id)?.row.name || layout.foundationById.get(p.id)?.name || p.id} /> <em>· {p.skill}</em></li>)}</ul>
              </div>
            )}
            <Link className="in-btn is-primary" to={practiceHref({ subtopic: current.row.id, track })} data-map-practise>{t('inst.practise')}</Link>
            {isRecommended(current) && <p className="in-note" style={{ marginTop: 10 }}>{t('inst.mapNextWhy')}</p>}
          </aside>
        )}
      </div>
      <p className="in-note in-map-foot">{t('inst.mapSub')} {t('inst.mapProvenance')}</p>
    </div>
  );
}
