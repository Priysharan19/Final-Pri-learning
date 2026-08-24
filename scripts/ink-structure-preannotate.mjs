#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const RAW_ROOT = process.argv[2] || 'client/test/ink-corpus';
const OUT_ROOT = process.argv[3] || 'client/test/ink-corpus-preannotated';
const WORDS = ['theta', 'sqrt', 'pi', '<=', '>=', '!='].sort((a, b) => b.length - a.length);
const SPECIAL_MULTI = new Set(['=', '+', 'x', 'X', 't', 'f', 'i', 'j', ':', '%', 'sqrt']);

function canonicalText(text = '') {
  return String(text).replaceAll('×', '*').replaceAll('÷', '/').replaceAll('−', '-')
    .replaceAll('′', "'").replaceAll('’', "'").replaceAll(' ', '');
}
function tokenize(text = '') {
  const s = canonicalText(text); const out = [];
  for (let i = 0; i < s.length;) {
    const hit = WORDS.find(w => s.startsWith(w, i));
    if (hit) { out.push(hit); i += hit.length; } else { out.push(s[i]); i++; }
  }
  return out;
}
function physicalText(text = '') {
  let t = canonicalText(text), old = null;
  while (old !== t) { old = t; t = t.replace(/\^\(([^()]*)\)/g, '$1'); }
  t = t.replace(/_([A-Za-z0-9])/g, '$1');
  old = null;
  while (old !== t) { old = t; t = t.replace(/sqrt\(([^()]*)\)/g, 'sqrt$1'); }
  const f = t.match(/^\(([^()]*)\)\/\(([^()]*)\)$/);
  if (f) t = `${f[1]}/${f[2]}`;
  return t;
}
function nextToken(s, i) {
  const hit = WORDS.find(w => s.startsWith(w, i));
  return hit ? [hit, i + hit.length] : [s[i], i + 1];
}

function describeTarget(target) {
  const s = canonicalText(target);
  const flatExpected = tokenize(physicalText(s));
  const descriptors = []; const relations = [];
  const emit = (token, parent = null, kind = null, context = 'root') => {
    const idx = descriptors.length; descriptors.push({ token, parent, kind, context }); return idx;
  };
  const addRightFor = indices => {
    for (let k = 0; k + 1 < indices.length; k++) relations.push({ from: indices[k], to: indices[k + 1], type: 'RIGHT' });
  };

  const whole = s.match(/^\(([^()]*)\)\/\(([^()]*)\)$/);
  if (whole) {
    const num = tokenize(whole[1]), den = tokenize(whole[2]);
    const nidx = num.map(t => emit(t, null, null, 'numerator'));
    const bar = emit('/', null, null, 'fraction-bar');
    const didx = den.map(t => emit(t, null, null, 'denominator'));
    addRightFor(nidx); addRightFor(didx);
    for (const i of nidx) relations.push({ from: bar, to: i, type: 'NUMERATOR' });
    for (const i of didx) relations.push({ from: bar, to: i, type: 'DENOMINATOR' });
    if (JSON.stringify(descriptors.map(d => d.token)) === JSON.stringify(flatExpected)) {
      return { descriptors, relations, mode: 'canonical-fraction' };
    }
  }

  descriptors.length = 0; relations.length = 0;
  function parseSeq(start, stopOnClose = false, parent = null, kind = null, context = 'root') {
    let i = start, base = null; const local = [];
    while (i < s.length) {
      if (stopOnClose && s[i] === ')') break;
      if (s.startsWith('sqrt(', i)) {
        const root = emit('sqrt', parent, kind, context); local.push(root); base = root; i += 5;
        const child = parseSeq(i, true, root, 'INSIDE_ROOT', `sqrt:${root}`); i = child.i;
        if (s[i] === ')') i++;
        addRightFor(child.indices);
        continue;
      }
      if (s[i] === '^' && base !== null && s[i + 1] === '(') {
        const child = parseSeq(i + 2, true, base, 'SUPERSCRIPT', `super:${base}`); i = child.i;
        if (s[i] === ')') i++;
        addRightFor(child.indices);
        continue;
      }
      if (s[i] === '_' && base !== null) {
        if (s[i + 1] === '(') {
          const child = parseSeq(i + 2, true, base, 'SUBSCRIPT', `sub:${base}`); i = child.i;
          if (s[i] === ')') i++;
          addRightFor(child.indices);
        } else {
          const [tok, j] = nextToken(s, i + 1); const idx = emit(tok, base, 'SUBSCRIPT', `sub:${base}`); i = j;
          relations.push({ from: base, to: idx, type: 'SUBSCRIPT' });
        }
        continue;
      }
      const [tok, j] = nextToken(s, i); const idx = emit(tok, parent, kind, context);
      local.push(idx); base = idx; i = j;
      if (parent !== null && kind) relations.push({ from: parent, to: idx, type: kind });
    }
    addRightFor(local);
    return { i, indices: local };
  }
  parseSeq(0, false, null, null, 'root');
  if (JSON.stringify(descriptors.map(d => d.token)) !== JSON.stringify(flatExpected)) {
    const ds = flatExpected.map((token, i) => ({ token, parent: null, kind: null, context: 'flat', index: i }));
    const rs = []; for (let i = 0; i + 1 < ds.length; i++) rs.push({ from: i, to: i + 1, type: 'RIGHT' });
    return { descriptors: ds, relations: rs, mode: 'flat-fallback' };
  }
  return { descriptors, relations, mode: 'canonical-structure' };
}

function pointNum(p, name, alt = null) {
  const v = p?.[name]; if (Number.isFinite(v)) return Number(v);
  if (alt && Number.isFinite(p?.[alt])) return Number(p[alt]);
  return null;
}
function strokeGeom(stroke, index) {
  const pts = Array.isArray(stroke?.points) ? stroke.points : [];
  const xs = pts.map(p => pointNum(p, 'x')).filter(Number.isFinite);
  const ys = pts.map(p => pointNum(p, 'y')).filter(Number.isFinite);
  if (!xs.length) return { index, x1: 0, x2: 0, y1: 0, y2: 0, cx: 0, cy: 0, w: 0, h: 0, n: 0, t0: null, t1: null };
  const x1 = Math.min(...xs), x2 = Math.max(...xs), y1 = Math.min(...ys), y2 = Math.max(...ys);
  const ts = pts.map(p => pointNum(p, 't')).filter(Number.isFinite);
  return { index, x1, x2, y1, y2, cx: (x1 + x2) / 2, cy: (y1 + y2) / 2, w: Math.max(.001, x2 - x1), h: Math.max(.001, y2 - y1), n: pts.length, t0: ts.length ? Math.min(...ts) : null, t1: ts.length ? Math.max(...ts) : null };
}
function overlap(a1, a2, b1, b2) {
  const inter = Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));
  return inter / Math.max(.001, Math.min(a2 - a1, b2 - b1));
}
function median(xs) {
  const a = xs.filter(Number.isFinite).sort((x, y) => x - y); if (!a.length) return 1; return a[Math.floor(a.length / 2)];
}
function affinity(a, b, scale) {
  const dx = Math.abs(a.cx - b.cx) / scale, dy = Math.abs(a.cy - b.cy) / scale;
  const xo = overlap(a.x1, a.x2, b.x1, b.x2), yo = overlap(a.y1, a.y2, b.y1, b.y2);
  const d = Math.hypot(dx, dy);
  let score = 1.8 * Math.max(xo, yo) + 0.8 * Math.min(xo, yo) - 1.4 * d;
  if (a.t1 !== null && b.t0 !== null) score -= Math.min(1.5, Math.max(0, b.t0 - a.t1) * 2.0);
  return score;
}
function countScore(token, k) {
  const preferred = token === '=' || token === '+' || token === 'x' || token === 'X' || token === 't' || token === 'f' || token === 'i' || token === 'j' || token === ':' ? 2 : token === '%' ? 3 : 1;
  if (k === preferred) return 2.2;
  if (k === 1) return SPECIAL_MULTI.has(token) ? 0.3 : 1.6;
  if (k === 2) return SPECIAL_MULTI.has(token) ? 1.1 : -0.5;
  return -1.4 * (k - preferred) * (k - preferred) - 0.8;
}
function shapeScore(token, seg, scale) {
  const x1 = Math.min(...seg.map(s => s.x1)), x2 = Math.max(...seg.map(s => s.x2));
  const y1 = Math.min(...seg.map(s => s.y1)), y2 = Math.max(...seg.map(s => s.y2));
  const w = Math.max(.001, x2 - x1), h = Math.max(.001, y2 - y1); let score = 0;
  if (token === '-' || token === '=') score += Math.max(-1.5, Math.min(1.5, Math.log((w + .01) / (h + .01))));
  if (token === '=' && seg.length === 2) score += 1.2 * overlap(seg[0].x1, seg[0].x2, seg[1].x1, seg[1].x2);
  if (token === '+' && seg.length === 2) {
    const a = seg[0], b = seg[1];
    const cross = (a.x1 <= b.cx && b.cx <= a.x2 && b.y1 <= a.cy && a.cy <= b.y2) ||
      (b.x1 <= a.cx && a.cx <= b.x2 && a.y1 <= b.cy && b.cy <= a.y2);
    if (cross) score += 1.2;
  }
  if ((token === '.' || token === "'") && Math.max(w, h) < 0.25 * scale) score += 0.8;
  return score;
}
function candidateScore(token, geoms, start, k, scale) {
  const seg = geoms.slice(start, start + k); if (seg.length !== k) return -Infinity;
  let score = countScore(token, k) + shapeScore(token, seg, scale);
  for (let i = 0; i < seg.length; i++) for (let j = i + 1; j < seg.length; j++) score += 0.55 * affinity(seg[i], seg[j], scale);
  return score;
}
function boundaryScore(left, right, scale) {
  if (!left || !right) return 0;
  const d = Math.hypot(left.cx - right.cx, left.cy - right.cy) / scale;
  const xo = overlap(left.x1, left.x2, right.x1, right.x2), yo = overlap(left.y1, left.y2, right.y1, right.y2);
  let s = 0.5 * Math.min(1.5, d) - 0.35 * Math.max(xo, yo);
  if (left.t1 !== null && right.t0 !== null) s += Math.min(0.8, Math.max(0, right.t0 - left.t1));
  return s;
}
function partition(tokens, strokes) {
  const n = strokes.length, m = tokens.length; if (!m || n < m) return null;
  const geoms = strokes.map(strokeGeom); const scale = Math.max(1, median(geoms.map(g => Math.max(g.w, g.h))));
  const states = Array.from({ length: m + 1 }, () => Array.from({ length: n + 1 }, () => []));
  states[0][0] = [{ score: 0, sizes: [] }];
  const push = (arr, c) => { arr.push(c); arr.sort((a, b) => b.score - a.score); if (arr.length > 2) arr.length = 2; };
  for (let ti = 0; ti < m; ti++) for (let used = 0; used <= n; used++) for (const state of states[ti][used]) {
    const remainTokens = m - ti - 1; const maxK = Math.min(4, n - used - remainTokens);
    for (let k = 1; k <= maxK; k++) {
      let score = state.score + candidateScore(tokens[ti], geoms, used, k, scale);
      if (used > 0) score += boundaryScore(geoms[used - 1], geoms[used], scale);
      push(states[ti + 1][used + k], { score, sizes: [...state.sizes, k] });
    }
  }
  const best = states[m][n]?.[0]; if (!best) return null; const second = states[m][n]?.[1];
  const margin = second ? best.score - second.score : 4;
  const confidence = Math.max(0.05, Math.min(0.995, 1 / (1 + Math.exp(-(margin - 0.5)))));
  return { sizes: best.sizes, score: best.score, margin, confidence };
}
function structureForSample(sample) {
  const target = canonicalText(sample?.target || ''); const strokes = Array.isArray(sample?.strokes) ? sample.strokes : [];
  const parsed = describeTarget(target), tokens = parsed.descriptors.map(d => d.token), part = partition(tokens, strokes);
  if (!target || !strokes.length || !part) return { structure: null, reason: `cannot align ${strokes.length} strokes to ${tokens.length} physical tokens` };
  const groups = []; let cursor = 0;
  for (let i = 0; i < tokens.length; i++) {
    const k = part.sizes[i]; groups.push({ id: `g${i}`, symbol: tokens[i], strokes: Array.from({ length: k }, (_, j) => cursor + j) }); cursor += k;
  }
  const relations = parsed.relations.map(r => ({ from: `g${r.from}`, to: `g${r.to}`, type: r.type }));
  return {
    structure: {
      groups, relations,
      preannotation: {
        status: 'machine-draft', algorithm: 'pri-ink-target-geometry-v1',
        confidence: Number(part.confidence.toFixed(4)), scoreMargin: Number(part.margin.toFixed(4)),
        parserMode: parsed.mode, reviewRequired: true
      }
    }, reason: null
  };
}
async function jsonFiles(root) {
  const out = [];
  async function walk(p) {
    let ents; try { ents = await fs.readdir(p, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const q = path.join(p, e.name); if (e.isDirectory()) await walk(q); else if (e.isFile() && e.name.endsWith('.json')) out.push(q);
    }
  }
  await walk(root); return out.sort();
}
async function main() {
  const files = await jsonFiles(RAW_ROOT);
  if (!files.length) { console.error(`no JSON files under ${RAW_ROOT}`); process.exit(2); }
  await fs.mkdir(OUT_ROOT, { recursive: true });
  let docs = 0, samples = 0, drafted = 0, failed = 0; const lows = [];
  for (const file of files) {
    let doc; try { doc = JSON.parse(await fs.readFile(file, 'utf8')); } catch { continue; }
    if (doc?.format !== 'pri-ink-corpus' || !Array.isArray(doc.samples)) continue;
    docs++; const out = structuredClone(doc);
    out.structuralPreannotation = {
      format: 'pri-ink-structural-preannotation', version: 1, algorithm: 'pri-ink-target-geometry-v1',
      generatedAt: new Date().toISOString(), reviewRequired: true, source: path.relative('.', file)
    };
    out.samples = out.samples.map((sample, idx) => {
      samples++; const r = structureForSample(sample); const copy = structuredClone(sample);
      if (r.structure) {
        copy.structure = r.structure; drafted++;
        if (r.structure.preannotation.confidence < 0.8) lows.push({ file: path.basename(file), sample: idx + 1, target: sample.target, confidence: r.structure.preannotation.confidence });
      } else {
        delete copy.structure; copy.structuralPreannotationError = r.reason; failed++;
        lows.push({ file: path.basename(file), sample: idx + 1, target: sample.target, confidence: 0, reason: r.reason });
      }
      return copy;
    });
    const outName = path.basename(file, '.json') + '-preannotated-v4.json';
    await fs.writeFile(path.join(OUT_ROOT, outName), JSON.stringify(out, null, 2) + '\n');
  }
  console.log('\nPri Ink V4 machine preannotation');
  console.log(`documents: ${docs}`); console.log(`samples: ${samples} · drafted=${drafted} · unresolved=${failed}`); console.log(`output: ${OUT_ROOT}`);
  if (lows.length) {
    console.log(`\nReview first (${lows.length} low-confidence/unresolved):`);
    for (const x of lows.sort((a, b) => a.confidence - b.confidence).slice(0, 20)) console.log(`  ${x.file} #${x.sample}  conf=${x.confidence.toFixed(3)}  ${x.target}${x.reason ? '  ' + x.reason : ''}`);
  } else console.log('\nAll samples received a draft. Human review is still required before V4 training.');
  console.log('\nNext: npm run ink:annotate, load the *-preannotated-v4.json file, review/correct, then Save annotated JSON into client/test/ink-corpus-structural/.');
}
main().catch(err => { console.error(err?.stack || String(err)); process.exit(1); });
