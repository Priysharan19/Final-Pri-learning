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

// The syllabus map (v1.1 instrument): the student's chapters as a graph laid
// out by strand (rows) and syllabus order (columns), joined by Pri's authored
// prerequisite edges (engine/prerequisites.js — Pri's map, not an NCERT one).
// A node's fill is mastery behind the evidence floor; its marks are the
// server-certified totals (GET /marks/by-chapter). The recommended chapter is
// the adaptive engine's own pick from /stats, shown only once there is history.
// Every node is a button, so the map is fully usable from the keyboard and by
// a screen reader; the drawing is the same information, not extra.

const W = 1000;
const ROW_H = 88;
const LEFT = 190;
const STRAND_KEY = {
  number: 'inst.strand.number', algebra: 'inst.strand.algebra', geometry: 'inst.strand.geometry', trig: 'inst.strand.trig',
  coord: 'inst.strand.coord', calculus: 'inst.strand.calculus', data: 'inst.strand.data'
};   // the foundations column and the strand labels sit left of this

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
      const top = s?.recommendation || s?.priorities?.[0] || null;
      setRecommended(hasHistory && top ? String(top.subtopic || top.id || '') : null);
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
    const n = Math.max(1, nodes.length);
    nodes.forEach(node => {
      node.x = LEFT + 70 + (node.index * (W - LEFT - 110)) / Math.max(1, n - 1);
      node.y = 46 + used.indexOf(node.strand) * ROW_H;
    });
    const perRow = {};
    foundations.forEach(f => {
      const k = perRow[f.strand] = (perRow[f.strand] || 0) + 1;
      f.x = LEFT - 40 - (k - 1) * 30;
      f.y = 46 + used.indexOf(f.strand) * ROW_H + ((k % 2) ? -10 : 10);
    });
    const byId = new Map(nodes.map(node => [node.row.id, node]));
    const foundationById = new Map(foundations.map(f => [f.id, f]));
    const edges = [];
    for (const node of nodes) {
      for (const pre of prerequisitesOf(node.row.id)) {
        const from = byId.get(pre.id) || foundationById.get(pre.id);
        if (from) edges.push({ from, to: node, skill: pre.skill, earlier: !byId.has(pre.id) });
      }
    }
    const rows = used.map((id, i) => ({ id, y: 46 + i * ROW_H }));
    return { nodes, edges, foundations, rows, height: 46 * 2 + Math.max(0, used.length - 1) * ROW_H, byId, foundationById };
  }, [curriculum, marks, user]);

  const track = practiceTrack(user);
  const current = layout.byId.get(pick) || layout.byId.get(recommended) || layout.nodes[0] || null;
  const isRecommended = node => !!recommended && node.row.id === recommended;

  if (!curriculum) return <div className="skeleton" style={{ height: 520 }} aria-hidden="true" />;

  return (
    <div className="in-map" data-instrument-map>
      <header className="in-map-head">
        <h1>{t('inst.mapTitle')}</h1>
        <p>{t('inst.mapSub')}</p>
      </header>
      <div className="in-map-body">
        <div className="in-map-graph">
          <svg viewBox={`0 0 ${W} ${layout.height}`} role="presentation" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
            {layout.rows.map(r => (
              <g key={r.id}>
                <line className="in-map-row" x1={LEFT} x2={W - 10} y1={r.y} y2={r.y} />
                <text className="in-map-strand" x={8} y={r.y + 4}>{STRAND_KEY[r.id] ? t(STRAND_KEY[r.id]) : ''}</text>
              </g>
            ))}
            <text className="in-map-strand is-col" x={LEFT - 40} y={18} textAnchor="middle">{t('inst.mapEarlier')}</text>
            {layout.edges.map((e, i) => (
              <path key={i} className={`in-map-edge${isRecommended(e.to) ? ' is-toward' : ''}${e.earlier ? ' is-earlier' : ''}`}
                d={`M${e.from.x} ${e.from.y} C ${(e.from.x + e.to.x) / 2} ${e.from.y}, ${(e.from.x + e.to.x) / 2} ${e.to.y}, ${e.to.x} ${e.to.y}`}
                style={{ '--cc': `var(${e.to.colour})` }} />
            ))}
            {layout.foundations.map(f => (
              <g key={f.id} className="in-map-foundation"><circle cx={f.x} cy={f.y} r={6} /></g>
            ))}
            {layout.nodes.map(node => {
              const r = 12 + Math.min(12, (node.marks?.earned || 0) / 2);
              return (
                <g key={node.row.id} className={`in-map-node${current?.row.id === node.row.id ? ' is-on' : ''}${isRecommended(node) ? ' is-next' : ''}`} style={{ '--cc': `var(${node.colour})` }}>
                  {isRecommended(node) && <circle className="in-map-next" cx={node.x} cy={node.y} r={r + 9} />}
                  <circle className="in-map-dot" cx={node.x} cy={node.y} r={r} style={{ fillOpacity: 0.28 + (node.evidence.mastery / 100) * 0.72 }} />
                  <circle className="in-map-ring" cx={node.x} cy={node.y} r={r + 4} />
                  <text x={node.x} y={node.y + r + 18} textAnchor="middle" className="in-map-label">{String(node.index + 1).padStart(2, '0')}</text>
                </g>
              );
            })}
          </svg>
          <ol className="in-map-list">
            {layout.nodes.map(node => (
              <li key={node.row.id} style={{ left: `${(node.x / W) * 100}%`, top: `${(node.y / layout.height) * 100}%` }}>
                <button type="button" className="in-map-hit" data-map-chapter={node.row.id}
                  aria-pressed={current?.row.id === node.row.id}
                  aria-label={`${node.row.name}${isRecommended(node) ? ` · ${t('inst.mapNext')}` : ''}`}
                  onClick={() => setPick(node.row.id)} onFocus={() => setPick(node.row.id)} onMouseEnter={() => setPick(node.row.id)} />
              </li>
            ))}
          </ol>
        </div>

        {current && (
          <aside className="in-map-card" style={{ '--cc': `var(${current.colour})` }} aria-live="polite" data-map-card={current.row.id}>
            <small>{isRecommended(current) ? t('inst.mapNext') : t('inst.chapterN', { n: current.index + 1 })}</small>
            <h2>{current.row.name}</h2>
            <dl className="in-map-facts">
              <div><dt>{t('inst.mapMarks')}</dt><dd>{current.marks ? `${current.marks.earned} / ${current.marks.possible}` : '—'}</dd></div>
              <div><dt>{t('inst.kpiAnswered')}</dt><dd>{current.evidence.attempts}</dd></div>
              <div><dt>{t('inst.kpiAccuracy')}</dt><dd>{current.evidence.accuracy == null ? '—' : `${current.evidence.accuracy}%`}</dd></div>
            </dl>
            {prerequisitesOf(current.row.id).length > 0 && (
              <div className="in-map-pre">
                <span>{t('inst.mapBuildsOn')}</span>
                <ul>{prerequisitesOf(current.row.id).map(p => <li key={p.id}>{layout.byId.get(p.id)?.row.name || layout.foundationById.get(p.id)?.name || p.id} <em>· {p.skill}</em></li>)}</ul>
              </div>
            )}
            <Link className="in-btn is-primary" to={practiceHref({ subtopic: current.row.id, track })} data-map-practise>{t('inst.practise')}</Link>
            {isRecommended(current) && <p className="in-note" style={{ marginTop: 10 }}>{t('inst.mapNextWhy')}</p>}
          </aside>
        )}
      </div>
      <p className="in-note in-map-foot">{t('inst.mapProvenance')}</p>
    </div>
  );
}
