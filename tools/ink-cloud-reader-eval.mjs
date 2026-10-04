#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Pri Ink · cloud reader accuracy evaluation (real-human ink, server provider)
//
// The server-side handwriting reader (server/platform/handwritingProvider.js)
// has never had its accuracy measured. This tool measures it honestly:
//
//   1. loads the committed real-ink corpus (client/test/ink-corpus/*.json), the
//      same loader rules as inkcheck-real.mjs (writer isolation, split choice);
//   2. draws every sample with the PRODUCTION painter (client/src/ink/cloudRaster.js
//      paintInk/rasterizeInk) onto a software canvas and encodes a PNG — the
//      exact picture a student's device would send;
//   3. sends each PNG to transcribeHandwriting() — the exact provider function
//      the /v1/handwriting route calls — with the server's key from the
//      environment (PRI_HANDWRITING_API_KEY, or OPENAI_API_KEY as a convenience);
//   4. scores exact-line and character accuracy, and calibration: accuracy per
//      confidence bucket and precision among reads at/above the provider's
//      confidence floor (default 0.82) — the reads the server would NOT send
//      back for confirmation;
//   5. writes handwriting/v17/cloud-reader-eval/<date>.json labelled
//      evidenceClass "real-human" with the true writer count.
//
// Without a key it exits 2 with "NOT MEASURED: no provider key". It never
// fabricates a number. --dry-run exercises the whole pipeline against a FAKE
// provider so the tool itself is regression-tested; its output is labelled
// "synthetic-dry-run" and is refused a home under handwriting/.
//
// Usage:
//   node tools/ink-cloud-reader-eval.mjs                       # real provider, test split (fallback as inkcheck-real)
//   node tools/ink-cloud-reader-eval.mjs --split train --limit 10
//   node tools/ink-cloud-reader-eval.mjs --dry-run --out /tmp/eval
// Exit: 0 measured (or dry-run complete) · 2 NOT MEASURED · 1 error/refused.
// ─────────────────────────────────────────────────────────────────────────────
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { deflateSync } from 'node:zlib';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(HERE, '..');
export const DEFAULT_CORPUS_DIR = join(ROOT, 'client/test/ink-corpus');
export const DEFAULT_OUT_DIR = join(ROOT, 'handwriting/v17/cloud-reader-eval');
export const FORMAT = 'pri-cloud-reader-eval';
const VALID_SPLITS = new Set(['train', 'validation', 'test', 'final-holdout']);

// ── software canvas: enough 2D context for cloudRaster.paintInk ──────────────
function parseColor(style) {
  const m = String(style || '#000000').match(/^#([0-9a-f]{6})$/i);
  const n = m ? parseInt(m[1], 16) : 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

class SoftwareContext {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.data = new Uint8Array(width * height * 3);
    this.fillStyle = '#000000';
    this.strokeStyle = '#000000';
    this.lineWidth = 1;
    this.lineCap = 'butt';
    this.lineJoin = 'miter';
    this.path = [];
    this.arcs = [];
  }
  set(x, y, rgb) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 3;
    this.data[i] = rgb[0]; this.data[i + 1] = rgb[1]; this.data[i + 2] = rgb[2];
  }
  disc(cx, cy, r, rgb) {
    const r2 = r * r;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        if (dx * dx + dy * dy <= r2) this.set(x, y, rgb);
      }
    }
  }
  fillRect(x, y, w, h) {
    const rgb = parseColor(this.fillStyle);
    for (let yy = Math.max(0, y | 0); yy < Math.min(this.height, y + h); yy++) {
      for (let xx = Math.max(0, x | 0); xx < Math.min(this.width, x + w); xx++) this.set(xx, yy, rgb);
    }
  }
  beginPath() { this.path = []; this.arcs = []; }
  moveTo(x, y) { this.path.push([[x, y]]); }
  lineTo(x, y) { if (!this.path.length) this.path.push([]); this.path[this.path.length - 1].push([x, y]); }
  arc(x, y, r) { this.arcs.push([x, y, r]); }
  stroke() {
    const rgb = parseColor(this.strokeStyle);
    const r = Math.max(0.5, this.lineWidth / 2);
    for (const sub of this.path) {
      if (sub.length === 1) { this.disc(sub[0][0], sub[0][1], r, rgb); continue; }
      for (let i = 1; i < sub.length; i++) {
        const [x0, y0] = sub[i - 1], [x1, y1] = sub[i];
        const len = Math.hypot(x1 - x0, y1 - y0);
        const steps = Math.max(1, Math.ceil(len / 0.5));
        for (let s = 0; s <= steps; s++) this.disc(x0 + (x1 - x0) * s / steps, y0 + (y1 - y0) * s / steps, r, rgb);
      }
    }
  }
  fill() {
    const rgb = parseColor(this.fillStyle);
    for (const [x, y, r] of this.arcs) this.disc(x, y, r, rgb);
  }
}

// ── minimal PNG encoder (RGB8, no filter) ────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}
export function encodePng(width, height, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0;
    Buffer.from(rgb.buffer, rgb.byteOffset + y * width * 3, width * 3).copy(raw, y * (width * 3 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

export function softwareCanvas(width, height) {
  const ctx = new SoftwareContext(width, height);
  return {
    width, height,
    getContext: () => ctx,
    toDataURL: () => `data:image/png;base64,${encodePng(width, height, ctx.data).toString('base64')}`
  };
}

/** The PNG the production cloud path would send for these strokes. */
export async function renderStrokesToPng(strokes) {
  const { rasterizeInk } = await import(pathToFileURL(join(ROOT, 'client/src/ink/cloudRaster.js')).href);
  return rasterizeInk(strokes, { createCanvas: softwareCanvas });
}

// ── corpus (same rules as inkcheck-real.mjs) ─────────────────────────────────
export function loadCorpus({ corpusDir = DEFAULT_CORPUS_DIR, requestedSplit = null } = {}) {
  if (requestedSplit && !VALID_SPLITS.has(requestedSplit)) throw new Error(`unknown split ${requestedSplit}`);
  if (!existsSync(corpusDir)) return { corpora: [], split: requestedSplit, writers: 0 };
  const all = readdirSync(corpusDir).filter(f => f.endsWith('.json')).sort().map(f => {
    const raw = JSON.parse(readFileSync(join(corpusDir, f), 'utf8'));
    if (raw.format !== 'pri-ink-corpus') throw new Error(`${f} is not a pri-ink-corpus file`);
    return { file: f, ...raw };
  });
  const writerSplits = new Map();
  for (const c of all) {
    const id = String(c.writer?.id || '').trim();
    if (!id) throw new Error(`${c.file}: missing writer.id`);
    const split = Number(c.version || 1) >= 2 ? String(c.split || c.writer?.split || '') : 'legacy-unverified';
    const set = writerSplits.get(id) || new Set();
    set.add(split); writerSplits.set(id, set);
  }
  for (const [id, splits] of writerSplits) if (splits.size > 1) throw new Error(`writer ${id} appears in multiple splits`);
  const v2 = all.filter(c => Number(c.version || 1) >= 2);
  let split = requestedSplit;
  if (!split && v2.length) {
    const available = new Set(v2.map(c => c.split));
    if (available.has('test')) split = 'test';
    else if (available.has('validation')) split = 'validation';
    else if (available.has('train')) split = 'train';
  }
  if (split === 'final-holdout') {
    const unlocked = all.filter(c => c.split === 'final-holdout' && c.holdoutLocked !== true);
    if (unlocked.length) throw new Error('final-holdout contains unlocked files');
  }
  const corpora = split ? all.filter(c => c.split === split) : all.filter(c => Number(c.version || 1) < 2);
  return { corpora, split: split || 'legacy-unverified', writers: new Set(corpora.map(c => String(c.writer?.id))).size };
}

// ── scoring ──────────────────────────────────────────────────────────────────
export const normalize = v => String(v ?? '').normalize('NFKC').replace(/[−–—]/g, '-').replace(/\s+/g, '');
export function editDistance(a, b) {
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

export const CONFIDENCE_BUCKETS = Object.freeze([
  [0, 0.5], [0.5, 0.6], [0.6, 0.7], [0.7, 0.82], [0.82, 0.9], [0.9, 1.0000001]
]);

/** rows: [{ writer, want, got, confidence, needsConfirmation, error? }] */
export function summarise(rows, { confidenceFloor }) {
  const scored = rows.filter(r => !r.error);
  const lines = scored.length;
  const exact = scored.filter(r => r.got === r.want).length;
  const chars = scored.reduce((s, r) => s + r.want.length, 0);
  const errs = scored.reduce((s, r) => s + editDistance(r.want, r.got), 0);
  const perWriter = new Map();
  for (const r of scored) {
    const w = perWriter.get(r.writer) || { writer: r.writer, lines: 0, exact: 0 };
    w.lines++; if (r.got === r.want) w.exact++;
    perWriter.set(r.writer, w);
  }
  const writers = [...perWriter.values()].map(w => ({ ...w, exactPct: w.lines ? 100 * w.exact / w.lines : 0 }));
  const buckets = CONFIDENCE_BUCKETS.map(([lo, hi]) => {
    const inBucket = scored.filter(r => r.confidence >= lo && r.confidence < hi);
    const ok = inBucket.filter(r => r.got === r.want).length;
    return { range: `[${lo}, ${hi >= 1 ? 1 : hi})`, n: inBucket.length, exact: ok, exactPct: inBucket.length ? 100 * ok / inBucket.length : null };
  });
  const safe = scored.filter(r => !r.needsConfirmation && r.confidence >= confidenceFloor);
  const safeExact = safe.filter(r => r.got === r.want).length;
  const unsafe = scored.filter(r => r.needsConfirmation || r.confidence < confidenceFloor);
  return {
    lines,
    exact,
    exactPct: lines ? 100 * exact / lines : null,
    chars,
    charErrors: errs,
    charPct: chars ? 100 * (1 - errs / chars) : null,
    providerErrors: rows.length - lines,
    writers,
    worstWriterExactPct: writers.length ? Math.min(...writers.map(w => w.exactPct)) : null,
    calibration: {
      confidenceFloor,
      buckets,
      // Reads the server would hand to the marker without confirmation.
      aboveFloor: { n: safe.length, exact: safeExact, precisionPct: safe.length ? 100 * safeExact / safe.length : null, coveragePct: lines ? 100 * safe.length / lines : null },
      belowFloor: { n: unsafe.length, exact: unsafe.filter(r => r.got === r.want).length }
    }
  };
}

// ── fake provider for --dry-run (pipeline test only; reads nothing) ──────────
export function fakeFetchFor(sample, index) {
  return async (_url, init) => {
    const body = JSON.parse(init.body);
    const image = body?.input?.[1]?.content?.find(p => p.type === 'input_image')?.image_url;
    if (!/^data:image\/png;base64,/.test(String(image))) return { ok: false, status: 400, json: async () => ({}) };
    // Deterministic pattern so the scorer sees exact reads, misreads and every
    // confidence bucket. This is NOT a reading of the ink.
    const want = String(sample.target);
    const misread = index % 4 === 1;
    const confidence = [0.97, 0.55, 0.86, 0.74, 0.91, 0.66][index % 6];
    const lines = [{ text: misread ? `${want}9` : want, latex: null, confidence }];
    return {
      ok: true, status: 200,
      json: async () => ({ output_text: JSON.stringify({ lines, confidence, needs_confirmation: confidence < 0.82 }) })
    };
  };
}

// ── main ─────────────────────────────────────────────────────────────────────
function argAfter(argv, name, fallback = null) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  const dryRun = argv.includes('--dry-run');
  const requestedSplit = argAfter(argv, '--split');
  const limit = Number(argAfter(argv, '--limit', '0')) || 0;
  const corpusDir = resolve(argAfter(argv, '--corpus', DEFAULT_CORPUS_DIR));
  const date = argAfter(argv, '--date', new Date().toISOString().slice(0, 10));
  // A dry run with no --out lands in a private directory of its own (mkdtemp:
  // unpredictable name, mode 0700) rather than a fixed name in the shared tmp dir.
  let outDir = argAfter(argv, '--out', null);
  if (!outDir) outDir = dryRun ? mkdtempSync(join(tmpdir(), 'pri-cloud-reader-eval-dry-run-')) : DEFAULT_OUT_DIR;
  outDir = resolve(outDir);

  if (dryRun) {
    const rel = relative(join(ROOT, 'handwriting'), outDir);
    if (!rel.startsWith('..') && !isAbsolute(rel)) {
      console.log('REFUSED: a dry run uses a fake provider; its output may not be written under handwriting/ where real evidence lives.');
      return 1;
    }
  }

  const providerEnv = { ...env };
  if (!String(providerEnv.PRI_HANDWRITING_API_KEY || '').trim() && String(providerEnv.OPENAI_API_KEY || '').trim()) {
    providerEnv.PRI_HANDWRITING_API_KEY = providerEnv.OPENAI_API_KEY;
  }
  if (dryRun) providerEnv.PRI_HANDWRITING_API_KEY = 'dry-run-fake-key-never-sent';
  if (!String(providerEnv.PRI_HANDWRITING_API_KEY || '').trim()) {
    console.log('CLOUD READER EVAL — NOT MEASURED: no provider key');
    console.log('Set PRI_HANDWRITING_API_KEY (server environment only; never commit it) and rerun. No number was recorded.');
    return 2;
  }

  const provider = await import(pathToFileURL(join(ROOT, 'server/platform/handwritingProvider.js')).href);
  const config = provider.providerConfig(providerEnv);
  const status = provider.providerStaticStatus(providerEnv);
  if (!dryRun && !status.configValid) {
    console.log(`CLOUD READER EVAL — NOT MEASURED: provider configuration invalid (${status.problems.join(', ')})`);
    return 2;
  }

  const { corpora, split, writers } = loadCorpus({ corpusDir, requestedSplit });
  const samples = [];
  for (const c of corpora) {
    for (const [i, s] of (c.samples || []).entries()) {
      if (!s?.strokes?.length || !normalize(s.target)) continue;
      samples.push({ writer: String(c.writer?.id || 'unknown'), file: c.file, index: i, target: s.target, pen: s.pen === true, strokes: s.strokes });
    }
  }
  const chosen = limit > 0 ? samples.slice(0, limit) : samples;
  if (!chosen.length) {
    console.log(`CLOUD READER EVAL — NOT MEASURED: no ${split} samples in ${corpusDir}`);
    return 2;
  }

  console.log(`\nCloud reader eval · ${dryRun ? 'DRY RUN (fake provider)' : `${status.provider || 'custom'} ${config.primaryModel}`} · ${split} split · ${writers} writer(s) · ${chosen.length} sample(s)`);
  if (!dryRun) console.log(`  ${chosen.length} paid provider request(s) will be made (plus fallback escalations below the ${config.confidenceFloor} floor).`);

  const rows = [];
  const started = Date.now();
  let pngBytes = 0;
  for (const [i, s] of chosen.entries()) {
    const png = await renderStrokesToPng(s.strokes);
    if (!png) { rows.push({ writer: s.writer, want: normalize(s.target), got: '', confidence: 0, needsConfirmation: true, error: 'raster refused (over byte budget or empty)' }); continue; }
    pngBytes += png.bytes;
    try {
      const result = await provider.transcribeHandwriting(png.dataUrl, {
        env: providerEnv,
        fetchImpl: dryRun ? fakeFetchFor(s, i) : globalThis.fetch
      });
      rows.push({
        writer: s.writer, file: s.file, index: s.index,
        want: normalize(s.target), got: normalize(result.text),
        confidence: Number(result.confidence) || 0,
        needsConfirmation: result.needsConfirmation === true,
        escalated: result.escalated === true,
        engine: result.engine, latencyMs: result.latencyMs,
        width: png.width, height: png.height, bytes: png.bytes
      });
    } catch (err) {
      rows.push({ writer: s.writer, file: s.file, index: s.index, want: normalize(s.target), got: '', confidence: 0, needsConfirmation: true, error: `${err?.code || 'ERROR'}: ${err?.message || err}` });
    }
  }

  const summary = summarise(rows, { confidenceFloor: config.confidenceFloor });
  const misreads = rows.filter(r => !r.error && r.got !== r.want).slice(0, 25).map(r => ({ writer: r.writer, want: r.want, got: r.got, confidence: r.confidence, needsConfirmation: r.needsConfirmation }));
  const errors = rows.filter(r => r.error).slice(0, 25).map(r => ({ writer: r.writer, want: r.want, error: r.error }));

  const report = {
    format: FORMAT,
    version: 1,
    evidenceClass: dryRun ? 'synthetic-dry-run' : 'real-human',
    measuredAt: new Date().toISOString(),
    provider: dryRun
      ? { kind: 'FAKE — pipeline test only; these numbers say nothing about any reader' }
      : { kind: status.provider, endpointHost: status.endpointHost, primaryModel: config.primaryModel, fallbackModel: config.fallbackModel, confidenceFloor: config.confidenceFloor },
    corpus: { dir: relative(ROOT, corpusDir), split, writers, files: corpora.map(c => c.file), samples: chosen.length, pencilOnly: chosen.every(s => s.pen), limit: limit || null },
    raster: { painter: 'client/src/ink/cloudRaster.js paintInk via rasterizeInk', meanPngBytes: chosen.length ? Math.round(pngBytes / chosen.length) : 0 },
    results: summary,
    misreads,
    errors,
    durationMs: Date.now() - started,
    notes: [
      `${writers} writer(s) ${writers < 8 ? 'is too few for a product accuracy claim (Gate C: >= 20 writer-disjoint test writers, >= 1,000 expressions)' : ''}`.trim(),
      split === 'train' ? 'TRAIN split: diagnostic only; must not be quoted as generalisation accuracy.' : null,
      'Images are drawn from stroke coordinates only; no question, answer or profile left the machine.',
      'The cloud reader proposes text; the deterministic marker decides. This measures the proposal, not marking.'
    ].filter(Boolean)
  };

  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `${date}${dryRun ? '-dry-run' : ''}.json`);
  writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');

  const pct = v => (v === null || v === undefined ? 'n/a' : `${Number(v).toFixed(1)}%`);
  console.log(`\n  exact lines ${summary.exact}/${summary.lines} (${pct(summary.exactPct)})   chars ${pct(summary.charPct)}   provider errors ${summary.providerErrors}`);
  console.log(`  worst writer ${pct(summary.worstWriterExactPct)}   writers ${writers}`);
  console.log(`  at/above ${config.confidenceFloor} floor: ${summary.calibration.aboveFloor.n} reads, precision ${pct(summary.calibration.aboveFloor.precisionPct)}, coverage ${pct(summary.calibration.aboveFloor.coveragePct)}`);
  console.log('  calibration:');
  for (const b of summary.calibration.buckets) console.log(`    ${b.range.padEnd(14)} n=${String(b.n).padStart(3)}  exact ${pct(b.exactPct)}`);
  if (misreads.length) { console.log('  misreads:'); for (const m of misreads.slice(0, 10)) console.log(`    ${m.writer} want "${m.want}" got "${m.got}" conf ${m.confidence}`); }
  if (errors.length) { console.log('  errors:'); for (const e of errors.slice(0, 10)) console.log(`    ${e.writer} ${e.error}`); }
  console.log(`\nCLOUD READER EVAL — ${dryRun ? 'DRY RUN COMPLETE (synthetic, not evidence)' : `MEASURED (real-human, ${writers} writer(s), ${split} split)`} → ${relative(ROOT, outPath) || outPath}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().then(code => process.exit(code), err => { console.error(err?.stack || err); process.exit(1); });
}
