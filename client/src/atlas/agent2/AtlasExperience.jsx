import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ATLAS_SUBJECTS, syntheticAtlas } from './graphModel.js';
import { chapterNavigationEvent } from './identity.js';
import './atlas.css';

const W = 1200;
const H = 740;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const EDGE_LABELS = {
  prerequisite: ['Prerequisites', 'Pri-authored skills needed for later chapters'],
  conceptual: ['Conceptual', 'Explained mathematical relationships; not prerequisites'],
  evidence: ['Learning evidence', 'Explicit paired-work records only; not causal evidence']
};
const SHAPE = {
  diamond: '0,-13 13,0 0,13 -13,0',
  triangle: '0,-15 14,12 -14,12',
  hexagon: '-12,-7 0,-14 12,-7 12,7 0,14 -12,7'
};
function IconShape({ shape, x, y, active }) {
  const shared = { fill: active ? 'currentColor' : '#10131a', stroke: 'currentColor', strokeWidth: 2.4 };
  if (shape === 'square') return <rect x={x - 11} y={y - 11} width="22" height="22" rx="3" {...shared} />;
  if (SHAPE[shape]) return <polygon points={SHAPE[shape]} transform={'translate(' + x + ' ' + y + ')'} {...shared} />;
  return <circle cx={x} cy={y} r="12" {...shared} />;
}
const fmt = value => Math.round(value * 100) / 100;
const CURRICULUM_NOTE = 'Chapter names/IDs are read from Pri curriculum. The map is a selected demonstration window, not a statement of complete CBSE syllabus coverage.';
// Camera framing uses the same immovable graph coordinates. Switching concepts
// changes the viewport, never rearranges nodes or confuses spatial memory.
function focusEdgesFor(data, id, layer) {
  const all = (data.layers[layer] || []).filter(e=>e.source===id||e.target===id);
  if(data.nodes.length<=40 || all.length<=5) return all;
  const byId = new Map(data.nodes.map(n=>[n.id,n]));
  const centre = byId.get(id);
  const score = e => {
    const n=byId.get(e.source===id?e.target:e.source);
    return (e.target===id?0:1e7) +
      Math.hypot((centre?.x||0)-(n?.x||0),(centre?.y||0)-(n?.y||0));
  };
  return [...all].sort((a,b)=>score(a)-score(b)).slice(0,5);
}
function frameConcept(data, id, layer, focus, selectiveEdges = null) {
  const visible = new Set([id]);
  if (focus) for (const e of selectiveEdges || data.layers[layer] || []) {
    if (e.source === id || e.target === id) { visible.add(e.source); visible.add(e.target); }
  } else data.nodes.forEach(n => visible.add(n.id));
  const nodes = data.nodes.filter(n => visible.has(n.id));
  if (!nodes.length) return { x: 0, y: 0, scale: 1 };
  const left = Math.min(...nodes.map(n => n.x - 45));
  const right = Math.max(...nodes.map(n => n.x + 270));
  const top = Math.min(...nodes.map(n => n.y - 55));
  const bottom = Math.max(...nodes.map(n => n.y + 75));
  const scale = clamp(Math.min(1.06, (W - 120) / Math.max(1, right-left),
    (H - 125) / Math.max(1, bottom-top)), 0.45, 1.06);
  return { x: W / 2 - (left + right) / 2 * scale,
    y: H / 2 - (top + bottom) / 2 * scale, scale };
}


export default function AtlasExperience({
  graph = null, initialConceptId = 'c10-pair-linear-equations', onSelectConcept = null,
  onOpenLaboratory = null, onOpenPaper = null
}) {
  const data = useMemo(() => graph || syntheticAtlas(), [graph]);
  const [layer, setLayer] = useState('prerequisite');
  const [selected, setSelected] = useState(
    data.nodes.some(n => n.id === initialConceptId) ? initialConceptId : data.selectionDefault
  );
  const [focus, setFocus] = useState(true);
  const [isPanning, setIsPanning] = useState(false);
  const [view, setView] = useState(() => frameConcept(data,
    data.nodes.some(n => n.id === initialConceptId) ? initialConceptId : data.selectionDefault,
    'prerequisite', true, data.nodes.length > 40 ? focusEdgesFor(data,initialConceptId,'prerequisite') : null));
  const svg = useRef(null);
  const drag = useRef(null);
  const touchPoints = useRef(new Map());
  const pinch = useRef(null);
  const nodes = data.nodes;
  const current = nodes.find(n => n.id === selected) || nodes[0] || null;
  const allIncident = useMemo(() => (data.layers[layer] || [])
    .filter(e => e.source === selected || e.target === selected), [data, layer, selected]);
  // At very high density prefer prerequisites, then nearby directly connected
  // chapters. The complete link set stays in the inspector, not silently lost.
  const focusedEdges = useMemo(() => focusEdgesFor(data, selected, layer), [data, selected, layer]);
  const neighbours = useMemo(() => {
    const ids = new Set([selected]);
    for (const e of (focus ? focusedEdges : allIncident)) {
      ids.add(e.source); ids.add(e.target);
    }
    return ids;
  }, [allIncident,focusedEdges,focus,selected]);
  const edgesHere = allIncident;
  const edges = data.layers[layer] || [];
  const lookup = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);
  const toSvg = e => {
    const r = svg.current.getBoundingClientRect();
    return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
  };
  const select = useCallback(id => {
    setSelected(id);
    if (nodes.some(item => item.id === id)) setView(frameConcept(data, id, layer, focus, data.nodes.length > 40 ? focusEdgesFor(data, id, layer) : null));
    onSelectConcept?.(chapterNavigationEvent(id, 'atlas-agent2'));
  }, [data, nodes, layer, focus, focusedEdges, onSelectConcept]);
  const zoomAt = (factor, cursor = { x: W / 2, y: H / 2 }) => {
    setView(old => {
      const scale = clamp(old.scale * factor, 0.45, 2.4);
      const wx = (cursor.x - old.x) / old.scale;
      const wy = (cursor.y - old.y) / old.scale;
      return { x: cursor.x - wx * scale, y: cursor.y - wy * scale, scale };
    });
  };
  // React delegates wheel passively. Attach directly with passive:false so
  // zooming the atlas does not also scroll its containing page.
  useEffect(() => {
    const element = svg.current;
    if (!element) return undefined;
    const handleWheel = event => {
      event.preventDefault();
      zoomAt(Math.exp(-event.deltaY * 0.0012), toSvg(event));
    };
    element.addEventListener('wheel', handleWheel, { passive: false });
    return () => element.removeEventListener('wheel', handleWheel);
  }, []);
  const centre = () => {
    if (!current) return;
    setView(frameConcept(data, current.id, layer, focus, data.nodes.length > 40 ? focusEdgesFor(data,selected,layer) : null));
  };
  const panStart = e => {
    if (e.button !== 0 || e.target.closest?.('[data-graph-node]')) return;
    const point = toSvg(e);
    setIsPanning(true);
    touchPoints.current.set(e.pointerId, point);
    svg.current.setPointerCapture?.(e.pointerId);
    if (touchPoints.current.size === 2) {
      const [a, b] = [...touchPoints.current.values()];
      pinch.current = { midpoint: {x:(a.x+b.x)/2,y:(a.y+b.y)/2},
        distance: Math.hypot(b.x-a.x,b.y-a.y), start:view };
      drag.current = null;
    } else if (!pinch.current) drag.current = { pointerId: e.pointerId, point, start: view };
  };
  const panMove = e => {
    if (!touchPoints.current.has(e.pointerId)) return;
    const p = toSvg(e);
    touchPoints.current.set(e.pointerId, p);
    if (pinch.current && touchPoints.current.size === 2) {
      const [a, b] = [...touchPoints.current.values()];
      const middle = {x:(a.x+b.x)/2,y:(a.y+b.y)/2};
      const start = pinch.current.start;
      const factor = Math.hypot(b.x-a.x,b.y-a.y) / Math.max(1,pinch.current.distance);
      const scale = clamp(start.scale * factor,0.45,2.4);
      const wx = (pinch.current.midpoint.x-start.x)/start.scale;
      const wy = (pinch.current.midpoint.y-start.y)/start.scale;
      setView({ x: middle.x-wx*scale, y: middle.y-wy*scale, scale });
    } else if (drag.current?.pointerId === e.pointerId) {
      const { point, start } = drag.current;
      setView({ ...start, x: start.x+p.x-point.x, y: start.y+p.y-point.y });
    }
  };
  const panEnd = e => {
    touchPoints.current.delete(e.pointerId);
    if (touchPoints.current.size === 0) setIsPanning(false);
    if (svg.current.hasPointerCapture?.(e.pointerId)) svg.current.releasePointerCapture(e.pointerId);
    if (pinch.current) {
      pinch.current = null;
      const next = [...touchPoints.current.entries()][0];
      drag.current = next ? { pointerId: next[0], point: next[1], start: view } : null;
    } else if (drag.current?.pointerId === e.pointerId) drag.current = null;
  };
  const keyboardNode = (e, n, i) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(n.id); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const delta = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : -1;
      const next = nodes[(i + delta + nodes.length) % nodes.length];
      select(next.id);
      svg.current?.querySelector('[data-graph-node="' + next.id + '"]')?.focus();
    }
  };
  const openPaper = () => onOpenPaper?.({
    ...chapterNavigationEvent(selected, 'atlas-agent2'),
    provenance: 'prototype navigation request; no question assigned'
  });
  return (
    <section className="pa2-experience pa2-atlas" aria-label="Atlas syllabus exploration" data-atlas-agent2>
      <div className="pa2-overline">PRI ATLAS / 01 — KNOWLEDGE INSTRUMENT</div>
      <div className="pa2-titleline"><div><h1>Knowledge Atlas</h1>
        <p>Navigate the structure of mathematics. Every link has a reason.</p></div>
        <div className="pa2-tag">CBSE mathematics · selected chapters</div>
      </div>
      <div className="pa2-layout">
        <div className="pa2-pane">
          <div className="pa2-toolbar" role="group" aria-label="Connection layer">
            {Object.entries(EDGE_LABELS).map(([key, value]) => (
              <button type="button" key={key} className={layer === key ? 'is-active' : ''} aria-pressed={layer === key}
                onClick={() => { setLayer(key); setView(frameConcept(data, selected, key, focus, data.nodes.length > 40 ? focusEdgesFor(data,selected,key) : null)); }}>{value[0]}</button>
            ))}
          </div>
          <div className="pa2-explain"><span>{EDGE_LABELS[layer][1]}</span>
            <label><input type="checkbox" checked={focus} onChange={e => { setFocus(e.target.checked); setView(frameConcept(data, selected, layer, e.target.checked, data.nodes.length > 40 ? focusEdgesFor(data,selected,layer) : null)); }} /> Focus</label></div>
          {data.demo && <div className="pa2-demo" role="note">SYNTHETIC DEMONSTRATION — no real student record loaded.</div>}
          <div className="pa2-viewport">
            <svg ref={svg} viewBox={'0 0 ' + W + ' ' + H} className="pa2-graph"
              aria-label="Concept relationship graph. Drag empty space to pan, use zoom buttons or mouse wheel; select nodes with keyboard or pointer."
              role="group" onPointerDown={panStart} onPointerMove={panMove} onPointerUp={panEnd}
              onPointerCancel={panEnd}>
              <defs><pattern id="pa2-grid" width="36" height="36" patternUnits="userSpaceOnUse"><path d="M36 0 H0 V36" fill="none" stroke="#323842" strokeWidth="0.7" /></pattern></defs>
              <rect width={W} height={H} fill="url(#pa2-grid)" />
              <g className={'pa2-camera' + (isPanning ? ' is-dragging' : '')} transform={'translate(' + view.x + ' ' + view.y + ') scale(' + view.scale + ')'}>
                {edges.map((e, i) => {
                  const a = lookup.get(e.source), b = lookup.get(e.target);
                  if (!a || !b) return null;
                  const nearby = selected === e.source || selected === e.target;
                  if (focus && (!nearby || (nodes.length > 40 && !focusedEdges.includes(e)))) return null;
                  const dx = b.x - a.x, dy = b.y - a.y;
                  const curve = 'M ' + a.x + ' ' + a.y + ' Q ' + (a.x + b.x) / 2 + ' ' + ((a.y + b.y) / 2 - Math.min(50, Math.abs(dx) * 0.08) * (i % 2 ? -1 : 1)) + ' ' + b.x + ' ' + b.y;
                  return <path key={layer + '-' + e.source + '-' + e.target} d={curve}
                    stroke={layer === 'prerequisite' ? '#8d9eb8' : layer === 'conceptual' ? '#ccb48e' : '#83c3ba'}
                    strokeWidth={nearby ? 2.7 : 1.4} strokeDasharray={layer === 'prerequisite' ? undefined : layer === 'conceptual' ? '7 5' : '2 7'}
                    opacity={focus && !nearby ? 0.08 : nearby ? 0.95 : 0.48} fill="none" vectorEffect="non-scaling-stroke" />;
                })}
                {nodes.map((n, i) => {
                  const info = ATLAS_SUBJECTS[n.strand] || ATLAS_SUBJECTS.algebra;
                  const isOn = n.id === selected;
                  const showLabel = !focus || neighbours.has(n.id);
                  return <g key={n.id} data-graph-node={n.id} role="button" tabIndex={0}
                    aria-label={n.name + ', Class ' + n.grade + ', ' + n.evidence.state + ', select concept'}
                    aria-pressed={isOn} onClick={() => select(n.id)} onKeyDown={e => keyboardNode(e, n, i)}
                    className="pa2-node" style={{ color: info.colour, opacity: focus && !neighbours.has(n.id) ? nodes.length > 40 ? 0.07 : 0.2 : 1 }}>
                    <circle cx={n.x} cy={n.y} r="29" fill="transparent" />
                    {isOn && <circle cx={n.x} cy={n.y} r="23" fill="none" stroke="currentColor" strokeWidth="1.5" />}
                    <IconShape shape={info.shape} x={n.x} y={n.y} active={isOn} />
                    {showLabel && <text x={n.x + 25} y={n.y - 2} className="pa2-node-name">{n.lines?.[0] || n.name}</text>}
                    {showLabel && n.lines?.[1] && <text x={n.x + 25} y={n.y + 14} className="pa2-node-name">{n.lines[1]}</text>}
                    {showLabel && <text x={n.x + 25} y={n.y + (n.lines?.[1] ? 31 : 15)} className="pa2-node-meta">CLASS {n.grade} · {n.evidence.count ? n.evidence.count + ' observed' : 'no observed answers'}</text>}
                  </g>;
                })}
              </g>
            </svg>
            <div className="pa2-map-controls">
              <button type="button" onClick={() => zoomAt(1.3)} aria-label="Zoom in">+</button>
              <span aria-live="off">{Math.round(view.scale * 100)}%</span>
              <button type="button" onClick={() => zoomAt(1 / 1.3)} aria-label="Zoom out">−</button>
              <button type="button" onClick={centre}>Centre</button>
            </div>
          </div>
          {focus && nodes.length > 40 && allIncident.length > focusedEdges.length && <p className="pa2-explain">
            Showing {focusedEdges.length} directly connected links. {allIncident.length-focusedEdges.length} additional links appear in the inspector.
          </p>}
          <div className="pa2-legend">
            {Object.values(ATLAS_SUBJECTS).map(s => <span key={s.label}><i style={{ backgroundColor: s.colour }} /> {s.label}</span>)}
          </div>
          <div className="pa2-list-area"><h3>Accessible concept index</h3>
            <p>Equivalent selection and navigation without using the drawing.</p>
            <div className="pa2-concept-list">{nodes.map(n => <button key={n.id} type="button"
              aria-current={selected === n.id ? 'true' : undefined}
              onClick={() => select(n.id)}>{n.name} <small>Class {n.grade}</small></button>)}</div>
          </div>
        </div>
        <aside className="pa2-inspector" aria-live="polite">
          {current ? <>
            <div className="pa2-overline">CONCEPT INSPECTOR · CLASS {current.grade}</div>
            <h2>{current.name}</h2><p className="pa2-subtitle">{(ATLAS_SUBJECTS[current.strand] || ATLAS_SUBJECTS.algebra).label} · {current.id}</p>
            <div className="pa2-rule" />
            <h3>Curriculum identity</h3><p>Chapter metadata source: {current.chapterSource}</p><p>This is a Pri curriculum identity; prerequisites and links are Pri-authored, not CBSE-certified relationships.</p>
            <div className="pa2-rule" /><h3>Evidence state</h3>
            <strong className="pa2-state">{data.demo ? 'Synthetic demonstration only' : current.evidence.state}</strong>
            <p>{data.demo ? 'No real learner progress is shown.' : current.evidence.accuracy === null ?
              current.evidence.needed + ' more independent or supported learning-evidence answers before chapter accuracy may be shown.' :
              'Observed chapter accuracy: ' + current.evidence.accuracy + '%. This is not a mastery certification.'}</p>
            <div className="pa2-rule" />
            <h3>Prerequisites</h3>
            {current.prerequisites.length ? <ul className="pa2-prereqs">{current.prerequisites.map(p =>
              <li key={p.id}><span>{lookup.get(p.id)?.name || p.name}</span><small>{p.skill}</small>
                {lookup.has(p.id) && <button type="button" onClick={() => select(p.id)}>Explore</button>}</li>)}</ul> :
              <p>No prerequisite specified in Pri’s authored map.</p>}
            <div className="pa2-rule" />
            <h3>{EDGE_LABELS[layer][0]} in focus</h3>
            {edgesHere.length ? <ul className="pa2-prereqs">{edgesHere.map(e => <li key={e.source + e.target}>
              <span>{lookup.get(e.source)?.name} → {lookup.get(e.target)?.name}</span><small>{e.meaning}</small>
              <small>{e.provenance}</small></li>)}</ul> : <p>No qualifying link for this selected concept in this layer.</p>}
            <div className="pa2-rule" />
            <h3>Learning actions</h3>
            <p>Recommended practice: solve a curriculum question on {current.name}. Practice availability must be resolved by the host application.</p>
            <div className="pa2-actions">
              {current.id === 'c10-pair-linear-equations' && <button type="button" className="pa2-primary" disabled={!onOpenLaboratory} onClick={() => onOpenLaboratory?.(chapterNavigationEvent(current.id, 'atlas-agent2'))}>Open lines laboratory ↗</button>}
              <button type="button" disabled={!onOpenPaper} onClick={openPaper}>Continue to Paper ↗</button>
            </div>
            <p className="pa2-fineprint">{CURRICULUM_NOTE}</p>
          </> : <p>No concepts in the selected scope.</p>}
        </aside>
      </div>
      <p className="pa2-footnote">Positions are stable and independent of student status. Pan is pointer-controlled; zoom is pointer-anchored. Layer edges never imply verified causal prerequisites or official syllabus classification.</p>
    </section>
  );
}
