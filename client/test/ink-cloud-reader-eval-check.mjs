// ─────────────────────────────────────────────────────────────────────────────
// Pri Ink · cloud reader evaluation tool — regression check
//
// tools/ink-cloud-reader-eval.mjs is the only way the server reader's accuracy
// can ever be measured, so the tool itself must be proven before a key is ever
// spent on it. No network call is made here: the dry run uses a fake provider.
//
//   · without a key it says NOT MEASURED, exits 2 and records nothing;
//   · the PNG it sends is the production raster (cloudRaster.paintInk) and
//     passes the server's own validateImage();
//   · the scorer computes exact/char accuracy, per-writer worst, calibration
//     buckets and above-floor precision correctly on known rows;
//   · a dry run completes end to end through transcribeHandwriting(), is
//     labelled synthetic-dry-run, and is refused a home under handwriting/.
// ─────────────────────────────────────────────────────────────────────────────
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIDENCE_BUCKETS, FORMAT, encodePng, normalize, renderStrokesToPng, summarise } from '../../tools/ink-cloud-reader-eval.mjs';
import { validateImage } from '../../server/platform/handwritingProvider.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../..');
const TOOL = join(ROOT, 'tools/ink-cloud-reader-eval.mjs');
const EVIDENCE_DIR = join(ROOT, 'handwriting/v17/cloud-reader-eval');

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const cleanEnv = { ...process.env };
delete cleanEnv.PRI_HANDWRITING_API_KEY;
delete cleanEnv.OPENAI_API_KEY;
const run = (args, env = cleanEnv) => spawnSync(process.execPath, [TOOL, ...args], { encoding: 'utf8', env, cwd: ROOT });
const listEvidence = () => (existsSync(EVIDENCE_DIR) ? readdirSync(EVIDENCE_DIR).sort() : []);

// ── 1 · no key → NOT MEASURED, nothing written ───────────────────────────────
{
  const before = listEvidence();
  const r = run([]);
  ok(r.status === 2, `no key exits 2 (got ${r.status})`);
  ok(/NOT MEASURED: no provider key/.test(r.stdout), 'no key prints NOT MEASURED: no provider key');
  ok(JSON.stringify(listEvidence()) === JSON.stringify(before), 'no evidence file is written without a key');
}

// ── 2 · the raster is the production picture and a valid PNG ─────────────────
{
  const corpusDir = join(HERE, 'ink-corpus');
  const file = readdirSync(corpusDir).find(f => f.endsWith('.json'));
  const corpus = JSON.parse(readFileSync(join(corpusDir, file), 'utf8'));
  const sample = corpus.samples.find(s => s.strokes?.length);
  const png = await renderStrokesToPng(sample.strokes);
  ok(!!png && png.strokes === sample.strokes.length, 'every stroke of the sample is painted');
  const buf = Buffer.from(png.dataUrl.split(',')[1], 'base64');
  ok(buf.subarray(0, 8).toString('hex') === '89504e470d0a1a0a', 'PNG signature');
  ok(buf.readUInt32BE(16) === png.width && buf.readUInt32BE(20) === png.height, 'IHDR dimensions match the raster');
  ok(buf.subarray(12, 16).toString('ascii') === 'IHDR' && buf.subarray(buf.length - 8, buf.length - 4).toString('ascii') === 'IEND', 'IHDR first, IEND last');
  const v = validateImage(png.dataUrl);
  ok(v.mime === 'image/png' && v.bytes === png.bytes, 'the server accepts the data URL as a PNG within budget');
  // Something is actually drawn: a blank page would be all white.
  const tiny = encodePng(2, 2, new Uint8Array([255, 255, 255, 0, 0, 0, 255, 255, 255, 0, 0, 0]));
  ok(tiny.length > 40 && tiny.readUInt32BE(16) === 2, 'encoder handles a hand-built 2x2 image');
  ok(png.bytes > tiny.length * 4, 'the sample raster is not an empty page');
  ok(await renderStrokesToPng([]) === null, 'no strokes → no picture (nothing is sent)');
}

// ── 3 · the scorer ───────────────────────────────────────────────────────────
{
  const rows = [
    { writer: 'A', want: '2x+5=17', got: '2x+5=17', confidence: 0.95, needsConfirmation: false },
    { writer: 'A', want: '7/8', got: '7/8', confidence: 0.86, needsConfirmation: false },
    { writer: 'A', want: 'n=48', got: 'pi=48', confidence: 0.9, needsConfirmation: false },   // confident and wrong
    { writer: 'A', want: '2z', got: '22', confidence: 0.55, needsConfirmation: true },
    { writer: 'B', want: 'x^2', got: 'x^2', confidence: 0.75, needsConfirmation: true },
    { writer: 'B', want: 'y=3', got: 'y=3', confidence: 0.3, needsConfirmation: true },
    { writer: 'B', want: 'ab', got: '', confidence: 0, needsConfirmation: true, error: 'HANDWRITING_TIMEOUT' }
  ];
  const s = summarise(rows, { confidenceFloor: 0.82 });
  ok(s.lines === 6 && s.providerErrors === 1, 'errored rows are counted separately, never as misreads');
  ok(s.exact === 4 && Math.abs(s.exactPct - 100 * 4 / 6) < 1e-9, `exact 4/6 (got ${s.exact}, ${s.exactPct})`);
  const chars = '2x+5=17'.length + 3 + 4 + 2 + 3 + 3;
  ok(s.chars === chars && s.charErrors === 2 + 1, `char errors counted by edit distance (got ${s.charErrors}/${s.chars})`);
  const a = s.writers.find(w => w.writer === 'A'), b = s.writers.find(w => w.writer === 'B');
  ok(a.exactPct === 50 && b.exactPct === 100 && s.worstWriterExactPct === 50, 'per-writer and worst-writer exact');
  ok(s.calibration.aboveFloor.n === 3 && s.calibration.aboveFloor.exact === 2, 'above-floor reads: 3, of which 2 right');
  ok(Math.abs(s.calibration.aboveFloor.precisionPct - 100 * 2 / 3) < 1e-9, 'above-floor precision is 66.7% (the confident wrong read counts against it)');
  ok(Math.abs(s.calibration.aboveFloor.coveragePct - 50) < 1e-9, 'coverage 3/6');
  ok(s.calibration.belowFloor.n === 3 && s.calibration.belowFloor.exact === 2, 'below-floor reads: 3, 2 right');
  ok(s.calibration.buckets.length === CONFIDENCE_BUCKETS.length, 'one row per confidence bucket');
  ok(s.calibration.buckets.reduce((n, bkt) => n + bkt.n, 0) === 6, 'every scored row lands in exactly one bucket');
  const top = s.calibration.buckets[s.calibration.buckets.length - 1];
  ok(top.n === 2 && top.exact === 1 && top.exactPct === 50, '[0.9, 1) bucket: 2 reads, 50% exact (1.0 is inside the top bucket)');
  ok(normalize(' 2 x − 5 ') === '2x-5', 'normalisation strips whitespace and unifies minus');
}

// ── 4 · dry run end to end ───────────────────────────────────────────────────
const tmp = mkdtempSync(join(tmpdir(), 'pri-cloud-eval-'));
try {
  const before = listEvidence();
  const r = run(['--dry-run', '--out', tmp, '--limit', '8', '--date', '2026-01-01']);
  ok(r.status === 0, `dry run exits 0 (got ${r.status})\n${r.stdout}\n${r.stderr}`);
  ok(/DRY RUN COMPLETE \(synthetic, not evidence\)/.test(r.stdout), 'dry run is labelled synthetic in its summary line');
  const out = join(tmp, '2026-01-01-dry-run.json');
  ok(existsSync(out), 'dry run writes <date>-dry-run.json to --out');
  const report = JSON.parse(readFileSync(out, 'utf8'));
  ok(report.format === FORMAT && report.evidenceClass === 'synthetic-dry-run', 'report is labelled synthetic-dry-run');
  ok(/FAKE/.test(report.provider.kind), 'report names the provider as FAKE');
  ok(report.corpus.samples === 8 && report.results.lines === 8 && report.results.providerErrors === 0, 'all 8 samples went through transcribeHandwriting()');
  ok(report.results.exact === 6, `fake provider pattern yields 6/8 exact (got ${report.results.exact})`);
  ok(report.misreads.length === 2 && report.misreads.every(m => m.got === `${m.want}9`), 'misreads recorded verbatim');
  ok(report.results.calibration.confidenceFloor === 0.82, 'calibration uses the provider default floor 0.82');
  ok(report.results.calibration.aboveFloor.precisionPct === 100, 'fake above-floor reads are all exact → precision 100%');
  ok(report.corpus.writers === 1 && report.notes.some(n => /too few for a product accuracy claim/.test(n)), 'one writer is flagged as too few');
  ok(report.corpus.split === 'train' && report.notes.some(n => /TRAIN split: diagnostic only/.test(n)), 'train split is flagged diagnostic only');
  ok(JSON.stringify(listEvidence()) === JSON.stringify(before), 'dry run wrote nothing under handwriting/v17/cloud-reader-eval');

  const refused = run(['--dry-run', '--out', EVIDENCE_DIR]);
  ok(refused.status === 1 && /REFUSED/.test(refused.stdout), 'dry run into handwriting/ is refused');
  ok(JSON.stringify(listEvidence()) === JSON.stringify(before), 'refused dry run wrote nothing');
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

if (failures.length) {
  console.log(`INK CLOUD READER EVAL TOOL: FAIL — ${pass}/${pass + failures.length} checks`);
  for (const f of failures) console.log(`  FAIL ${f}`);
  process.exit(1);
}
console.log(`INK CLOUD READER EVAL TOOL: PASS — ${pass}/${pass} checks`);
