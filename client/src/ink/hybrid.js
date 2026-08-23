// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · native line geometry × Pri stroke recogniser
//
// The iPad experiments established an important boundary:
//   • native PencilKit geometry is good at deciding which strokes belong to a
//     REAL WRITING LINE;
//   • Vision is not reliable enough to decide which strokes belong to each
//     individual glyph, or what that glyph is;
//   • Pri's purpose-built stroke/CNN recogniser is much stronger once it is
//     handed one real line instead of being asked to discover the whole page.
//
// Therefore this module deliberately ignores native per-glyph ownership for
// ordinary maths. Native supplies only line membership (plus strong structural
// evidence when available). Pri then re-runs its complete segmentation,
// 142k-sample CNN ensemble, point-cloud templates, personal correction bank and
// maths decoder over the ORIGINAL Pencil strokes for that line.
//
// Safety invariants:
//   · a Vision glyph can be totally wrong and own the wrong strokes without
//     poisoning the Pri line re-read;
//   · every line-owned Pencil stroke must remain represented before a Pri line
//     is allowed to replace the native line;
//   · explicit student corrections are locked by deterministic stroke-owned ids;
//   · decisive native structural operators may reinforce, but never create, a
//     Pri glyph at a different location;
//   · complex native fraction/radical blocks remain native-owned until their
//     own structure-aware hybrid pass is implemented;
//   · question context is answer-blind and can only bias live ink candidates;
//   · disagreement lowers confidence; nothing here can produce release-grade
//     certainty by itself.
// ─────────────────────────────────────────────────────────────────────────────
import { classify, recognize } from './recognizer.js';

const STRUCTURAL = new Set(['+', '-', '=', '*', '/', '(', ')', '[', ']', '<', '>', '<=', '>=', '!=', '±', ':']);
const NEVER_SUPERSCRIPT = new Set([...STRUCTURAL, "'", '.', ',', '°', '%']);
const SIMPLE_MULTI = new Set(['pi', 'theta', '<=', '>=', '!=']);
const FAMILY = [
  new Set(['x', '*', 'k']),
  new Set(['n', 'h', 'u', 'v']),
  new Set(['1', 'l', 'I', '|', '/']),
  new Set(['0', 'o', 'O', 'Q']),
  new Set(['2', 'z', 'Z']),
  new Set(['3', '8']),
  new Set(['4', 'y']),
  new Set(['5', 's', 'S']),
  new Set(['6', 'b']),
  new Set(['9', 'g', 'q'])
];

const median = values => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

const box4 = b => {
  const x1 = Number.isFinite(b?.x1) ? b.x1 : (b?.x ?? 0);
  const y1 = Number.isFinite(b?.y1) ? b.y1 : (b?.y ?? 0);
  const w = Number.isFinite(b?.w) ? b.w : Math.max(0, (b?.x2 ?? x1) - x1);
  const h = Number.isFinite(b?.h) ? b.h : Math.max(0, (b?.y2 ?? y1) - y1);
  const x2 = Number.isFinite(b?.x2) ? b.x2 : x1 + w;
  const y2 = Number.isFinite(b?.y2) ? b.y2 : y1 + h;
  return { x1, y1, x2, y2, w: Math.max(w, 1e-6), h: Math.max(h, 1e-6), cx: (x1 + x2) / 2, cy: (y1 + y2) / 2 };
};

function strokeBox(strokes) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const stroke of strokes) {
    for (const p of stroke?.points || []) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      x1 = Math.min(x1, p.x); y1 = Math.min(y1, p.y);
      x2 = Math.max(x2, p.x); y2 = Math.max(y2, p.y);
    }
  }
  if (!Number.isFinite(x1)) return null;
  return box4({ x1, y1, x2, y2 });
}

const canonical = sym => ({ div: '/', pm: '±', deg: '°', percent: '%' }[sym] || sym);

function sameFamily(a, b) {
  if (a === b) return true;
  return FAMILY.some(set => set.has(a) && set.has(b));
}

function mergeAlternatives(primary, ...lists) {
  const best = new Map();
  for (const list of lists) {
    for (const alt of list || []) {
      const sym = canonical(alt?.sym);
      const conf = Number(alt?.conf) || 0;
      if (!sym || sym === primary) continue;
      best.set(sym, Math.max(best.get(sym) || 0, Math.min(0.95, conf)));
    }
  }
  return [...best.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([sym, conf]) => ({ sym, conf }));
}

function complexLine(line) {
  if ((line?.text || '').includes('sqrt(')) return true;
  return (line?.symbols || []).some(s => {
    const sym = canonical(s.sym || '');
    if (SIMPLE_MULTI.has(sym)) return false;
    return sym === 'sqrt' || (sym.length > 1 && /[()/]/.test(sym));
  });
}

function assembleSimple(symbols) {
  const ordered = [...symbols].sort((a, b) => box4(a.box).x1 - box4(b.box).x1);
  if (!ordered.length) return '';

  const extents = ordered
    .map(s => box4(s.box))
    .filter(b => b.h > 1)
    .map(b => b.h);
  const glyphH = Math.max(8, median(extents) || 20);
  const substantial = ordered.filter(s => box4(s.box).h >= 0.35 * glyphH);
  const tops = substantial.map(s => box4(s.box).y1);
  const bottoms = substantial.map(s => box4(s.box).y2);
  const top = median(tops);
  const bodyHeight = Math.max(1, median(bottoms) - top || glyphH);

  const raised = s => {
    const sym = canonical(s.sym);
    if (NEVER_SUPERSCRIPT.has(sym)) return false;
    const b = box4(s.box);
    return substantial.length >= 2
      && b.cy < top + 0.35 * bodyHeight
      && b.y2 < top + 0.72 * bodyHeight
      && b.h < 0.82 * bodyHeight;
  };

  let out = '';
  let power = false;
  for (const symbol of ordered) {
    const isPower = raised(symbol);
    if (isPower && !power) { out += '^('; power = true; }
    if (!isPower && power) { out += ')'; power = false; }
    out += canonical(symbol.sym);
  }
  if (power) out += ')';
  return out;
}

function summarise(lines, reading) {
  const all = lines.flatMap(l => l.symbols || []);
  let minConf = 1, margin = 1, weakest = null;
  all.forEach((s, index) => {
    const conf = Number(s.conf) || 0;
    let rival = 0;
    for (const alt of s.alts || []) {
      if (canonical(alt.sym) === canonical(s.sym)) continue;
      rival = Math.max(rival, Number(alt.conf) || 0);
    }
    minConf = Math.min(minConf, conf);
    margin = Math.min(margin, Math.max(0, Math.min(1, conf - rival)));
    if (!weakest || conf < weakest.conf) {
      weakest = { id: s.id, index, sym: s.sym, conf, alts: s.alts || [] };
    }
  });
  return {
    ...reading,
    lines,
    text: lines.map(l => l.text).join('\n'),
    minConf: all.length ? minConf : 1,
    margin: all.length ? margin : 1,
    weakest
  };
}

function lineIndexes(line, strokeCount) {
  const set = new Set();
  const add = i => {
    if (Number.isInteger(i) && i >= 0 && i < strokeCount) set.add(i);
  };
  for (const i of line?.strokeIdxs || []) add(i);
  for (const s of line?.symbols || []) for (const i of s.strokeIdxs || []) add(i);
  return [...set].sort((a, b) => a - b);
}

const strokeKey = indexes => [...new Set(indexes || [])].sort((a, b) => a - b).join('_');
const stableId = (lineIndex, indexes, fallback) => `h${lineIndex}_${strokeKey(indexes) || fallback}`;

function overlapRatio(a, b) {
  const A = new Set(a || []), B = new Set(b || []);
  if (!A.size || !B.size) return 0;
  let hit = 0;
  for (const i of A) if (B.has(i)) hit++;
  return hit / Math.max(A.size, B.size);
}

function boxIoU(a0, b0) {
  const a = box4(a0), b = box4(b0);
  const iw = Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1));
  const ih = Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
  const inter = iw * ih;
  const union = a.w * a.h + b.w * b.h - inter;
  return union > 0 ? inter / union : 0;
}

function strongestNativeStructure(jsSymbol, nativeLine) {
  let best = null;
  for (const n of nativeLine?.symbols || []) {
    const sym = canonical(n.sym || '');
    if (!STRUCTURAL.has(sym) || Number(n.conf) < 0.90 || n.approx) continue;
    const ownership = overlapRatio(jsSymbol.strokeIdxs, n.strokeIdxs);
    const spatial = boxIoU(jsSymbol.box, n.box);
    const score = Math.max(ownership, spatial);
    if (score < 0.58) continue;
    if (!best || score > best.score) best = { native: n, sym, score };
  }
  return best;
}

function remapJsSymbol(symbol, localToGlobal, lineIndex, ordinal, nativeLine, overrides) {
  const globalIndexes = [...new Set((symbol.strokeIdxs || [])
    .map(i => localToGlobal[i])
    .filter(i => Number.isInteger(i)))].sort((a, b) => a - b);
  const id = stableId(lineIndex, globalIndexes, ordinal);
  const out = {
    ...symbol,
    id,
    sym: canonical(symbol.sym),
    conf: Math.min(0.97, Number(symbol.conf) || 0),
    alts: (symbol.alts || []).map(a => ({ ...a, sym: canonical(a.sym) })),
    strokeIdxs: globalIndexes,
    approx: false
  };

  const structural = strongestNativeStructure(out, nativeLine);
  if (structural && structural.sym !== out.sym) {
    out.alts = mergeAlternatives(out.sym, out.alts, [{ sym: structural.sym, conf: Math.min(0.82, structural.native.conf) }]);
    if (out.conf < 0.68 || (STRUCTURAL.has(out.sym) && structural.native.conf >= 0.96)) {
      const previous = out.sym;
      out.sym = structural.sym;
      out.conf = Math.min(0.92, Math.max(out.conf, 0.72 * structural.native.conf));
      out.alts = mergeAlternatives(out.sym, [{ sym: previous, conf: Math.min(0.72, Number(symbol.conf) || 0) }], out.alts);
    }
  }

  if (Object.prototype.hasOwnProperty.call(overrides, id)) {
    out.sym = overrides[id];
    out.conf = 1;
    out.approx = false;
  }
  return out;
}

function readWholeNativeLine(line, lineIndex, strokes, overrides, ctx) {
  const indexes = lineIndexes(line, strokes.length);
  if (!indexes.length) return null;
  const members = indexes.map(i => strokes[i]).filter(Boolean);
  if (!members.length) return null;

  let result;
  try {
    // Context here is deliberately answer-blind: notation visible in the
    // question can break x/h/n-style near-ties, but it cannot supply an answer.
    result = recognize(members, {}, ctx || null);
  } catch {
    return null;
  }
  if (!result?.lines?.length) return null;

  const raw = result.lines.flatMap(l => l.symbols || []);
  if (!raw.length) return null;
  const symbols = raw
    .map((s, i) => remapJsSymbol(s, indexes, lineIndex, i, line, overrides))
    .filter(s => s.strokeIdxs.length);
  if (!symbols.length) return null;

  const covered = new Set(symbols.flatMap(s => s.strokeIdxs));
  const coverage = indexes.filter(i => covered.has(i)).length / indexes.length;
  if (coverage < 0.88) return null;

  const text = assembleSimple(symbols);
  if (!text) return null;

  const weakest = Math.min(...symbols.map(s => Number(s.conf) || 0));
  return {
    ...line,
    text,
    symbols,
    strokeIdxs: indexes,
    unread: false,
    hybridCoverage: coverage,
    hybridConfidence: Math.min(0.95, weakest)
  };
}

function fallbackOwnedGlyphFusion(line, strokes, overrides, lineIndex) {
  if (!line?.symbols?.length) return line;
  const dimensions = line.symbols
    .map(s => box4(s.box))
    .map(b => Math.max(b.w, b.h))
    .filter(v => Number.isFinite(v) && v > 2)
    .sort((a, b) => a - b);
  const medianH = Math.max(8, median(dimensions) || 20);

  const symbols = line.symbols.map((native, ordinal) => {
    const indexes = (native.strokeIdxs || []).filter(i => Number.isInteger(i) && strokes[i]);
    const members = indexes.map(i => strokes[i]);
    if (!members.length) return native;
    const b = strokeBox(members);
    if (!b) return native;
    let js = null;
    try { js = classify({ strokes: members, box: b, strokeIdxs: indexes }, medianH); }
    catch { return native; }
    if (!js?.sym) return native;

    const id = stableId(lineIndex, indexes, ordinal);
    const oldSym = canonical(native.sym);
    const jsSym = canonical(js.sym);
    const oldConf = Number(native.conf) || 0;
    const jsConf = Number(js.conf) || 0;
    let sym = oldSym;
    let conf = oldConf;
    let alts = mergeAlternatives(oldSym, native.alts, js.alts, [{ sym: jsSym, conf: jsConf }]);

    if (jsSym === oldSym) conf = Math.min(0.95, Math.max(oldConf, jsConf));
    else if (!STRUCTURAL.has(oldSym) && (native.approx || oldConf < 0.58 || (sameFamily(oldSym, jsSym) && jsConf >= 0.65))) {
      sym = jsSym;
      conf = Math.min(0.82, Math.max(jsConf, 0.5 * jsConf + 0.25 * oldConf));
      alts = mergeAlternatives(sym, [{ sym: oldSym, conf: Math.min(0.70, oldConf) }], native.alts, js.alts);
    } else if (jsConf >= 0.34) {
      conf = Math.min(oldConf, 0.62);
    }

    if (Object.prototype.hasOwnProperty.call(overrides, id)) { sym = overrides[id]; conf = 1; }
    return { ...native, id, sym, conf, alts, strokeIdxs: indexes };
  });
  return { ...line, symbols, text: assembleSimple(symbols) || line.text };
}

/**
 * Fuse a native reading with Pri's purpose-built line recogniser.
 * Native contributes real-line membership; Pri re-segments/classifies the
 * original line strokes. Per-glyph Vision ownership is ignored for ordinary
 * maths because the iPad evidence proved it is not a trustworthy boundary.
 */
export function fuseNativeStrokeReading(reading, strokes, overrides = {}, ctx = null) {
  if (!reading?.lines?.length || !Array.isArray(strokes) || !strokes.length) return reading;

  const lines = reading.lines.map((line, lineIndex) => {
    if (complexLine(line)) return fallbackOwnedGlyphFusion(line, strokes, overrides, lineIndex);
    return readWholeNativeLine(line, lineIndex, strokes, overrides, ctx)
      || fallbackOwnedGlyphFusion(line, strokes, overrides, lineIndex);
  });

  return summarise(lines, reading);
}
