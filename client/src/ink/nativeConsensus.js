import {
  isSetContext,
  repairSetNotationResult,
  setReadingCompatibility
} from './setNotation.js';
import {
  isTrigContext,
  repairTrigNotationResult,
  trigLineCompatibility,
  trigReadingCompatibility
} from './trigNotation.js';

// Pri Learning · native handwriting arbitration
// Pure, answer-blind evidence fusion. This module intentionally knows nothing
// about the expected answer or mark scheme, so it can be regression-tested in
// Node without mounting React or the native shell.
//
// Real-page Pencil evidence added one more rule: whole-page winner-takes-all is
// too coarse. One engine can read line 1 well and fail line 4 while another does
// the opposite; a geometry sketch can also become a fake text line. We therefore
// repair public-topic notation first, reject only high-confidence diagram-shaped
// non-equation regions, then seek consensus per physical line before falling
// back to a whole-page uncertain reading.

export const normalizedReadingText = r => String(r?.text || '').replace(/\s+/g, '').toLowerCase();
export const hasReading = r => !!r?.lines?.some(line => String(line?.text || '').trim());
const normalizedLineText = line => String(line?.text || '').replace(/\s+/g, '').toLowerCase();

function finiteOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function median(values, fallback = 0) {
  const clean = (values || []).filter(Number.isFinite).sort((a, b) => a - b);
  return clean.length ? clean[Math.floor(clean.length / 2)] : fallback;
}

function plausibleText(text) {
  const t = String(text || '').replace(/\s+/g, '').toLowerCase();
  if (!t || t.includes('?')) return false;
  let depth = 0;
  for (const ch of t) {
    if (ch === '(') depth++;
    else if (ch === ')') { depth--; if (depth < 0) return false; }
  }
  return depth === 0 && !/[+*/=<>^]$/.test(t);
}

function plausibleInkText(r) {
  return plausibleText(normalizedReadingText(r));
}

function contextualize(reading, ctx) {
  let out = reading;
  out = repairSetNotationResult(out, ctx);
  out = repairTrigNotationResult(out, ctx);
  return out;
}

function contextCompatibility(reading, ctx) {
  const set = setReadingCompatibility(reading, ctx);
  const trig = trigReadingCompatibility(reading, ctx);
  return {
    eligible: set.eligible && trig.eligible,
    bonus: finiteOr(set.bonus, 0) + finiteOr(trig.bonus, 0),
    reason: set.reason || trig.reason || null
  };
}

function intrinsicQuality(r) {
  if (!hasReading(r)) return -1;
  const conf = finiteOr(r.minConf, 0.45);
  const margin = finiteOr(r.margin, 0.10);
  return 0.74 * conf
    + 0.26 * Math.min(1, margin * 2.5)
    + (plausibleInkText(r) ? 0.08 : -0.20);
}

// Internal confidence scales are not interchangeable. JS V3 is useful as an
// independent vote, but its confidence was calibrated on templates/synthetic
// writers and must not dominate real Apple Pencil evidence. Native rescue uses
// the real line raster + Pencil geometry; Foundation remains data-limited.
function engineAdjustment(r) {
  const engine = String(r?.engine || '');
  const lines = Array.isArray(r?.lines) ? r.lines.length : 0;
  const chars = normalizedReadingText(r).length;
  if (engine.includes('native-rescue')) return 0.14;
  if (engine.includes('foundation')) return chars > 12 || lines > 1 ? 0.00 : 0.04;
  if (engine.includes('pri-js-v3')) return (chars > 12 || lines > 1) ? -0.32 : -0.20;
  return 0;
}

function choiceScore(r, ctx = null) {
  return intrinsicQuality(r) + engineAdjustment(r) + contextCompatibility(r, ctx).bonus;
}

function evidenceOf(r, ctx = null) {
  const compatibility = contextCompatibility(r, ctx);
  return {
    engine: r?.engine || 'unknown',
    text: String(r?.text || ''),
    minConf: finiteOr(r?.minConf, null),
    margin: finiteOr(r?.margin, null),
    failure: r?.failure || (!hasReading(r) ? 'no-reading' : null),
    contextCompatible: compatibility.eligible,
    contextReason: compatibility.reason,
    contextRepair: r?.trigContextRepair || r?.setContextRepair || null
  };
}

function boxOf(line) {
  const b = line?.box;
  if (!b || typeof b !== 'object') return null;
  const x1 = finiteOr(b.x1, finiteOr(b.x, NaN));
  const y1 = finiteOr(b.y1, finiteOr(b.y, NaN));
  const w = finiteOr(b.w, Number.isFinite(b.x2) && Number.isFinite(x1) ? b.x2 - x1 : NaN);
  const h = finiteOr(b.h, Number.isFinite(b.y2) && Number.isFinite(y1) ? b.y2 - y1 : NaN);
  if (![x1, y1, w, h].every(Number.isFinite) || w < 0 || h <= 0) return null;
  return {
    x1, y1, w, h,
    x2: finiteOr(b.x2, x1 + w),
    y2: finiteOr(b.y2, y1 + h),
    cx: x1 + w / 2,
    cy: y1 + h / 2
  };
}

function lineConfidence(line, reading) {
  const symbols = Array.isArray(line?.symbols) ? line.symbols : [];
  const values = symbols.map(s => Number(s?.conf)).filter(Number.isFinite);
  return values.length ? Math.min(...values) : finiteOr(reading?.minConf, 0.45);
}

function lineMargin(line, reading) {
  const symbols = Array.isArray(line?.symbols) ? line.symbols : [];
  const values = [];
  for (const s of symbols) {
    const conf = finiteOr(Number(s?.conf), 0);
    const rival = Math.max(0, ...(s?.alts || []).filter(a => a?.sym !== s?.sym).map(a => finiteOr(Number(a?.conf), 0)));
    values.push(Math.max(0, conf - rival));
  }
  return values.length ? Math.min(...values) : finiteOr(reading?.margin, 0.10);
}

function lineScore(item, ctx) {
  const conf = lineConfidence(item.line, item.reading);
  const margin = lineMargin(item.line, item.reading);
  return 0.68 * conf
    + 0.20 * Math.min(1, margin * 2.5)
    + (plausibleText(item.line?.text) ? 0.06 : -0.18)
    + 0.42 * engineAdjustment(item.reading)
    + trigLineCompatibility(item.line?.text, ctx);
}

function likelyDiagramLine(line, siblings, ctx) {
  // This is intentionally narrow. The production failure was a triangle with
  // edge labels being decoded as "π/60 11" between two trig equations. We only
  // reject a line when its physical region is much taller than normal writing,
  // it has multiple numeric labels, and it lacks an equation/function body.
  if (!isTrigContext(ctx) || (siblings || []).length < 3) return false;
  const box = boxOf(line);
  if (!box) return false;
  const peerHeights = (siblings || []).map(boxOf).filter(Boolean).map(b => b.h);
  const typical = median(peerHeights.filter(h => h > 0 && h <= 1.35 * median(peerHeights, h)), median(peerHeights, 0));
  if (!(typical > 0) || box.h < 1.65 * typical) return false;

  const text = normalizedLineText(line);
  const numericGroups = text.match(/\d+/g) || [];
  const hasRelation = /(?:=|<=|>=|!=)/.test(text);
  const hasTrigFunction = /(?:sin|cos|tan|sec|csc|cot)/.test(text);
  const labelOnly = text
    .replace(/(?:theta|π|pi)/g, '')
    .replace(/[0-9./,°\-]/g, '')
    .length === 0;
  return !hasRelation && !hasTrigFunction && numericGroups.length >= 2 && labelOnly;
}

function cleanLines(reading, sourceIndex, ctx) {
  const lines = Array.isArray(reading?.lines) ? reading.lines : [];
  const kept = [];
  const dropped = [];
  lines.forEach((line, lineIndex) => {
    const item = { line, lineIndex, sourceIndex, reading, box: boxOf(line) };
    if (likelyDiagramLine(line, lines, ctx)) dropped.push(item);
    else if (String(line?.text || '').trim()) kept.push(item);
  });
  return { kept, dropped };
}

function clusterPhysicalLines(readings, ctx) {
  const cleaned = readings.map((reading, sourceIndex) => cleanLines(reading, sourceIndex, ctx));
  const items = cleaned.flatMap(row => row.kept);
  const diagramDropped = cleaned.reduce((sum, row) => sum + row.dropped.length, 0);
  if (!items.length) return { clusters: [], diagramDropped };

  const withBox = items.filter(item => item.box);
  const useGeometry = withBox.length >= Math.ceil(items.length * 0.6);
  if (!useGeometry) {
    const maxLines = Math.max(...cleaned.map(row => row.kept.length));
    const clusters = [];
    for (let i = 0; i < maxLines; i++) {
      const members = cleaned.map(row => row.kept[i]).filter(Boolean);
      if (members.length) clusters.push({ items: members, order: i });
    }
    return { clusters, diagramDropped };
  }

  const globalH = Math.max(6, median(withBox.map(item => item.box.h), 20));
  const sorted = [...withBox].sort((a, b) => a.box.cy - b.box.cy || a.box.x1 - b.box.x1);
  const clusters = [];

  for (const item of sorted) {
    let best = null;
    for (const cluster of clusters) {
      if (cluster.items.some(existing => existing.sourceIndex === item.sourceIndex)) continue;
      const centres = cluster.items.map(existing => existing.box?.cy).filter(Number.isFinite);
      const heights = cluster.items.map(existing => existing.box?.h).filter(Number.isFinite);
      const cy = median(centres, item.box.cy);
      const h = median(heights, globalH);
      const dy = Math.abs(item.box.cy - cy);
      const tolerance = Math.max(0.72 * globalH, 0.62 * Math.max(h, item.box.h));
      if (dy <= tolerance && (!best || dy < best.dy)) best = { cluster, dy };
    }
    if (best) best.cluster.items.push(item);
    else clusters.push({ items: [item] });
  }

  // Readers that omitted boxes are aligned only after geometry has established
  // the physical rows. This prevents one box-less reader from creating the row
  // structure for everyone else.
  const noBox = items.filter(item => !item.box);
  for (const item of noBox) {
    const target = clusters[item.lineIndex] || null;
    if (target && !target.items.some(existing => existing.sourceIndex === item.sourceIndex)) target.items.push(item);
    else clusters.push({ items: [item], order: item.lineIndex });
  }

  clusters.forEach(cluster => {
    const centres = cluster.items.map(item => item.box?.cy).filter(Number.isFinite);
    cluster.order = centres.length ? median(centres, 0) : finiteOr(cluster.order, 0);
  });
  clusters.sort((a, b) => a.order - b.order);
  return { clusters, diagramDropped };
}

function chooseLine(cluster, ctx) {
  const groups = new Map();
  for (const item of cluster.items) {
    const key = normalizedLineText(item.line);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  const ordered = [...groups.values()].sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length;
    return Math.max(...b.map(item => lineScore(item, ctx))) - Math.max(...a.map(item => lineScore(item, ctx)));
  });
  if (!ordered.length) return null;
  const winner = ordered[0];
  const chosen = [...winner].sort((a, b) => lineScore(b, ctx) - lineScore(a, ctx))[0];
  return { chosen, agreed: winner.length >= 2, voters: winner.length };
}

function summariseFused(base, lines, unresolved) {
  const symbols = lines.flatMap(line => line.symbols || []);
  let minConf = finiteOr(base?.minConf, 0.45);
  let margin = finiteOr(base?.margin, 0.10);
  let weakest = base?.weakest || null;
  if (symbols.length) {
    minConf = 1;
    margin = 1;
    weakest = null;
    symbols.forEach((s, index) => {
      const conf = finiteOr(Number(s?.conf), 0);
      const rival = Math.max(0, ...(s?.alts || []).filter(a => a?.sym !== s?.sym).map(a => finiteOr(Number(a?.conf), 0)));
      const gap = Math.max(0, conf - rival);
      minConf = Math.min(minConf, conf);
      margin = Math.min(margin, gap);
      if (!weakest || conf < weakest.conf) weakest = { id: s?.id ?? null, index, sym: s?.sym, conf, alts: s?.alts || [] };
    });
  }
  if (unresolved > 0) {
    minConf = Math.min(minConf, 0.54);
    margin = Math.min(margin, 0.08);
  }
  return { minConf, margin, weakest, symbols };
}

function lineConsensus(readings, ctx) {
  if (readings.length < 2) return null;
  const { clusters, diagramDropped } = clusterPhysicalLines(readings, ctx);
  if (clusters.length < 2) return null;

  const selected = [];
  let agreed = 0;
  let unresolved = 0;
  for (const cluster of clusters) {
    const result = chooseLine(cluster, ctx);
    if (!result) continue;
    selected.push(result.chosen.line);
    if (result.agreed) agreed++;
    else unresolved++;
  }
  if (!selected.length) return null;
  const contextRepair = readings.some(r => r?.trigContextRepair || r?.setContextRepair);
  if (agreed === 0 && diagramDropped === 0 && !contextRepair) return null;

  const base = [...readings].sort((a, b) => choiceScore(b, ctx) - choiceScore(a, ctx))[0];
  const summary = summariseFused(base, selected, unresolved);
  const engines = readings.map(r => r?.engine || 'unknown').join('|');
  return {
    ...base,
    ...summary,
    lines: selected,
    text: selected.map(line => line.text).join('\n'),
    disagreement: unresolved > 0,
    diagramLinesIgnored: diagramDropped,
    lineConsensus: { agreedLines: agreed, unresolvedLines: unresolved, physicalLines: selected.length },
    engine: unresolved > 0
      ? `pri-line-disagreement:${engines}`
      : `pri-line-consensus:${engines}`
  };
}

export function chooseNativeConsensus(candidates, ctx = null) {
  const attempted = (candidates || []).filter(Boolean).map(reading => contextualize(reading, ctx));
  const allLive = attempted.filter(hasReading);
  if (!allLive.length) return null;
  const compatible = allLive.filter(r => contextCompatibility(r, ctx).eligible);
  const hasTopicContext = isSetContext(ctx) || isTrigContext(ctx);
  const live = hasTopicContext && compatible.length ? compatible : allLive;

  const groups = new Map();
  for (const reading of live) {
    const key = normalizedReadingText(reading);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(reading);
  }

  const orderedGroups = [...groups.values()].sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length;
    return Math.max(...b.map(r => choiceScore(r, ctx))) - Math.max(...a.map(r => choiceScore(r, ctx)));
  });
  const consensus = orderedGroups[0];

  if (consensus.length >= 2) {
    const chosen = [...consensus].sort((a, b) => choiceScore(b, ctx) - choiceScore(a, ctx))[0];
    const engines = consensus.map(r => r.engine || 'unknown').join('+');
    return {
      ...chosen,
      disagreement: false,
      candidateReadings: attempted.map(r => evidenceOf(r, ctx)),
      engine: `pri-consensus:${engines}`
    };
  }

  const fused = lineConsensus(live, ctx);
  if (fused) {
    return {
      ...fused,
      candidateReadings: attempted.map(r => evidenceOf(r, ctx))
    };
  }

  // No two independent readers agree. We may still display the best evidence,
  // but we deliberately destroy auto-mark certainty. QuestionCard's existing
  // doubt gate will require the student to confirm/correct the reading first.
  const chosen = [...live].sort((a, b) => choiceScore(b, ctx) - choiceScore(a, ctx))[0];
  const engines = attempted.map(r => r.engine || 'unknown').join('|');
  return {
    ...chosen,
    minConf: Math.min(finiteOr(chosen.minConf, 0.54), 0.54),
    margin: Math.min(finiteOr(chosen.margin, 0.08), 0.08),
    disagreement: true,
    candidateReadings: attempted.map(r => evidenceOf(r, ctx)),
    engine: `pri-disagreement:${engines}->${chosen.engine || 'unknown'}`
  };
}
