// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · native geometry × Pri stroke/CNN glyph fusion
//
// Native PencilKit/Vision is currently the strongest owner of 2-D page geometry:
// which strokes form a line, a superscript, a bracket/fraction block, etc.  The
// web Pri recogniser has the stronger purpose-built glyph classifier: a 142k
// sample CNN ensemble + point-cloud templates + the student's local correction
// bank.  Running them as mutually-exclusive fallbacks wastes both strengths.
//
// This module fuses them at the one place where their evidence is independent:
// a native ReadingSymbol already owns exact Pencil stroke indexes.  We classify
// those same strokes with Pri's stroke model, then combine the two votes.
//
// Safety invariants:
//   · explicit student overrides are untouchable;
//   · high-confidence geometry operators are not replaced by OCR/classifier noise;
//   · disagreement lowers confidence unless one source has materially stronger
//     independent evidence;
//   · complex native 2-D tokens (fractions/radicals) remain native-owned;
//   · no stroke can disappear here: ownership/boxes are never changed.
// ─────────────────────────────────────────────────────────────────────────────
import { classify } from './recognizer.js';

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

function fuseSymbol(native, js, override) {
  if (!js) return native;
  if (override || native.conf >= 0.995) return native;

  const oldSym = canonical(native.sym);
  const jsSym = canonical(js.sym);
  const oldConf = Number(native.conf) || 0;
  const jsConf = Number(js.conf) || 0;
  const nativeAlts = native.alts || [];
  const jsAlts = js.alts || [];

  if (!jsSym || jsSym === '?') return native;

  if (jsSym === oldSym) {
    return {
      ...native,
      sym: oldSym,
      conf: Math.min(0.98, Math.max(oldConf, jsConf, 0.58 * oldConf + 0.42 * jsConf + 0.08)),
      alts: mergeAlternatives(oldSym, nativeAlts, jsAlts)
    };
  }

  if (STRUCTURAL.has(oldSym) && oldConf >= 0.90 && !native.approx) {
    return {
      ...native,
      sym: oldSym,
      conf: Math.min(oldConf, jsConf >= 0.55 ? 0.80 : oldConf),
      alts: mergeAlternatives(oldSym, nativeAlts, [{ sym: jsSym, conf: Math.min(0.55, jsConf) }], jsAlts)
    };
  }

  const family = sameFamily(oldSym, jsSym);
  const nativeApprox = !!native.approx;
  const nativeAlreadyOffersJS = nativeAlts.some(a => canonical(a.sym) === jsSym);

  const replace =
    (oldSym === '?' && jsConf >= 0.34) ||
    (nativeApprox && jsConf >= 0.46) ||
    (oldConf < 0.55 && jsConf >= 0.50) ||
    (family && jsConf >= 0.62 && (oldConf < 0.84 || jsConf >= oldConf - 0.10)) ||
    (nativeAlreadyOffersJS && jsConf >= 0.68 && oldConf < 0.86) ||
    (jsConf >= 0.82 && jsConf >= oldConf + 0.08);

  if (replace) {
    return {
      ...native,
      sym: jsSym,
      // Identity changed, but native geometry still owns the same exact Pencil
      // cluster. Keep that ownership flag intact: a STUDENT correction of this
      // glyph is therefore safe local training evidence even though the current
      // automatic identity remains below release-grade certainty.
      conf: Math.min(0.90, Math.max(jsConf, 0.52 * jsConf + 0.28 * oldConf)),
      alts: mergeAlternatives(jsSym, [{ sym: oldSym, conf: Math.min(0.74, oldConf) }], nativeAlts, jsAlts),
      approx: native.approx
    };
  }

  if (jsConf >= 0.34) {
    return {
      ...native,
      sym: oldSym,
      conf: Math.min(oldConf, family ? 0.60 : 0.70),
      alts: mergeAlternatives(oldSym, nativeAlts, [{ sym: jsSym, conf: Math.min(0.67, jsConf) }], jsAlts),
      approx: native.approx
    };
  }
  return native;
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
    const rival = (s.alts || [])[0]?.conf || 0;
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

export function fuseNativeStrokeReading(reading, strokes, overrides = {}) {
  if (!reading?.lines?.length || !Array.isArray(strokes) || !strokes.length) return reading;

  const lines = reading.lines.map(line => {
    if (!line?.symbols?.length || complexLine(line)) return line;

    const dimensions = line.symbols
      .map(s => box4(s.box))
      .map(b => Math.max(b.w, b.h))
      .filter(v => Number.isFinite(v) && v > 2)
      .sort((a, b) => a - b);
    const medianH = Math.max(8, median(dimensions) || 20);

    const symbols = line.symbols.map(native => {
      const indexes = native.strokeIdxs || [];
      const members = indexes.map(i => strokes[i]).filter(Boolean);
      if (!members.length) return native;
      const b = strokeBox(members);
      if (!b) return native;
      let js = null;
      try {
        js = classify({ strokes: members, box: b, strokeIdxs: indexes }, medianH);
      } catch {
        return native;
      }
      return fuseSymbol(native, js, overrides[native.id]);
    });

    return { ...line, symbols, text: assembleSimple(symbols) || line.text };
  });

  return summarise(lines, reading);
}
