#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · photo-of-working reader accuracy (real photos, server provider)
//
// Photos of paper working are read only by the server reader, and how well it
// reads a real photographed page has never been measured. This tool measures
// it and reports it. It sets NO floor: whether photo accuracy blocks a release
// is the owner's call (Director, 9 Nov 2026), and a number is never invented.
//
//   1. loads a real-photo set the owner keeps OUTSIDE the repository (pages
//      photographed with the writer's consent): <set>/manifest.json lists each
//      photo with the lines on the page and, where there is one, the final
//      answer (format below);
//   2. prepares each photo exactly as the app's Photo mode does —
//      client/src/ink/photoRaster.js preparePhoto, run in Chromium through
//      tools/acceptance/real-photo-support.mjs openStudio;
//   3. sends it to transcribeHandwriting(), the provider function the
//      /v1/handwriting route calls, with the server's key from the environment
//      (PRI_HANDWRITING_API_KEY, or OPENAI_API_KEY as a convenience);
//   4. scores, per page, the lines read against the lines on the page (exact
//      and character accuracy after the reader's normalisation), whether the
//      app would call the page unreadable (client/src/photo/transcript.js),
//      and whether the app's final-answer proposal
//      (client/src/photo/finalAnswer.js) equals the page's final answer;
//   5. writes handwriting/v17/photo-reader-eval/<date>.json, evidenceClass
//      "real-photo", with no student identity and no image in it.
//
// Without a set or a key it prints NOT MEASURED and exits 2 having recorded
// nothing. --dry-run runs the whole pipeline on a set with a FAKE provider
// (and, with --prepare raw, without Chromium) so the tool itself is tested;
// its output is labelled "synthetic-dry-run" and may not be written under
// handwriting/.
//
// manifest.json:
//   { "format": "pri-photo-eval-set", "version": 1,
//     "consent": "<who consented, to what, when — no names>",
//     "photos": [ { "file": "p001.jpg", "writer": "W01", "lines": ["2x + 3 = 11", "x = 4"],
//                   "answer": "4", "answerType": "numeric", "device": "phone camera" } ] }
//
// Usage:
//   node tools/ink-photo-reader-eval.mjs --set <dir> [--limit N] [--out <dir>]
//   node tools/ink-photo-reader-eval.mjs --set <dir> --dry-run [--prepare raw] [--out <dir>]
// Exit: 0 measured (or dry run complete) · 2 NOT MEASURED · 1 error or refused.
// ─────────────────────────────────────────────────────────────────────────────
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { editDistance, normalize, releaseShaFor } from './ink-cloud-reader-eval.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(HERE, '..');
export const DEFAULT_OUT_DIR = join(ROOT, 'handwriting/v17/photo-reader-eval');
export const DEFAULT_SET_DIR = join(process.env.HOME || '', 'Developer', 'pri-private-fixtures', 'photo-eval-set');
export const FORMAT = 'pri-photo-reader-eval';
export const SET_FORMAT = 'pri-photo-eval-set';
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.heic': 'image/heic', '.webp': 'image/webp' };

/** Problems with a set manifest; empty when it can be measured. */
export function manifestProblems(manifest, { exists = () => true } = {}) {
  const problems = [];
  if (manifest?.format !== SET_FORMAT || manifest?.version !== 1) problems.push(`manifest format must be ${SET_FORMAT} version 1`);
  if (!String(manifest?.consent || '').trim()) problems.push('manifest.consent must say who consented, to what and when (no names)');
  const photos = Array.isArray(manifest?.photos) ? manifest.photos : [];
  if (!photos.length) problems.push('manifest.photos is empty');
  const seen = new Set();
  photos.forEach((p, i) => {
    const at = `photos[${i}]`;
    const file = String(p?.file || '');
    if (!file || file.includes('..') || isAbsolute(file)) problems.push(`${at}.file must be a plain file name inside the set`);
    else if (!MIME[extname(file).toLowerCase()]) problems.push(`${at}.file ${file} is not a photo (${Object.keys(MIME).join(', ')})`);
    else if (!exists(file)) problems.push(`${at}.file ${file} is not in the set`);
    if (seen.has(file)) problems.push(`${at}.file ${file} is listed twice`);
    seen.add(file);
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(String(p?.writer || ''))) problems.push(`${at}.writer must be an anonymous code`);
    if (!Array.isArray(p?.lines) || !p.lines.length || !p.lines.every(l => typeof l === 'string' && l.trim())) problems.push(`${at}.lines must list what the page says, one string per line`);
    if (p?.answer !== undefined && p.answer !== null && typeof p.answer !== 'string') problems.push(`${at}.answer must be a string when given`);
  });
  return problems;
}

/**
 * Score one page. Lines are matched in order (a reader that drops or adds a
 * line is wrong for every line it shifts, which is what a student would meet).
 */
export function scorePage(photo, transcription, proposal) {
  const want = photo.lines.map(normalize);
  const got = (Array.isArray(transcription?.lines) ? transcription.lines : []).map(l => normalize(l?.text));
  const pairs = want.map((w, i) => ({ want: w, got: got[i] ?? '' }));
  const exactLines = pairs.filter(p => p.want === p.got).length;
  const chars = want.join('').length;
  const charErrors = pairs.reduce((n, p) => n + editDistance(p.want, p.got), 0) + got.slice(want.length).join('').length;
  const answer = photo.answer == null ? null : normalize(photo.answer);
  const proposed = proposal?.status === 'proposed' ? normalize(proposal.answer) : null;
  return {
    lines: want.length,
    linesRead: got.length,
    exactLines,
    pageExact: exactLines === want.length && got.length === want.length,
    chars,
    charErrors,
    answer,
    proposed,
    answerRight: answer === null ? null : proposed === answer,
    confidence: Number(transcription?.confidence) || 0,
    needsConfirmation: transcription?.needsConfirmation === true
  };
}

/** rows: [{ writer, unreadable, score?, error? }] */
export function summarise(rows) {
  const read = rows.filter(r => !r.error);
  const scored = read.filter(r => !r.unreadable);
  const sum = key => scored.reduce((n, r) => n + r.score[key], 0);
  const lines = sum('lines');
  const chars = sum('chars');
  const withAnswer = scored.filter(r => r.score.answer !== null);
  const writers = new Set(rows.map(r => r.writer));
  return {
    photos: rows.length,
    writers: writers.size,
    providerErrors: rows.length - read.length,
    unreadable: read.length - scored.length,
    unreadablePct: read.length ? 100 * (read.length - scored.length) / read.length : null,
    pagesExact: scored.filter(r => r.score.pageExact).length,
    pagesExactPct: scored.length ? 100 * scored.filter(r => r.score.pageExact).length / scored.length : null,
    lines,
    exactLines: sum('exactLines'),
    exactLinePct: lines ? 100 * sum('exactLines') / lines : null,
    charPct: chars ? 100 * (1 - sum('charErrors') / chars) : null,
    answers: withAnswer.length,
    answersRight: withAnswer.filter(r => r.score.answerRight).length,
    answerPct: withAnswer.length ? 100 * withAnswer.filter(r => r.score.answerRight).length / withAnswer.length : null,
    needsConfirmation: scored.filter(r => r.score.needsConfirmation).length
  };
}

/** A fake provider for --dry-run: deterministic, reads nothing. */
export function fakeFetchFor(photo, index) {
  return async (_url, init) => {
    const body = JSON.parse(init.body);
    const image = body?.input?.[1]?.content?.find(p => p.type === 'input_image')?.image_url;
    if (!/^data:image\//.test(String(image))) return { ok: false, status: 400, json: async () => ({}) };
    const confidence = [0.95, 0.6, 0.88, 0.1][index % 4];
    const lines = index % 4 === 3
      ? [{ text: '[illegible]', latex: '', confidence }]
      : photo.lines.map((text, i) => ({ text: index % 4 === 1 && i === 0 ? `${text}9` : text, latex: '', confidence }));
    return { ok: true, status: 200, json: async () => ({ output_text: JSON.stringify({ lines, confidence, needs_confirmation: confidence < 0.82 }) }) };
  };
}

function argAfter(argv, name, fallback = null) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
}

export async function main(argv = process.argv.slice(2), env = process.env, { log = console.log } = {}) {
  const dryRun = argv.includes('--dry-run');
  const prepareMode = argAfter(argv, '--prepare', 'app');
  const limit = Number(argAfter(argv, '--limit', '0')) || 0;
  const setDir = resolve(argAfter(argv, '--set', env.PRI_PHOTO_EVAL_SET || DEFAULT_SET_DIR));
  const date = argAfter(argv, '--date', new Date().toISOString().slice(0, 10));
  let outDir = argAfter(argv, '--out', null);
  if (!outDir) outDir = dryRun ? mkdtempSync(join(tmpdir(), 'pri-photo-reader-eval-dry-run-')) : DEFAULT_OUT_DIR;
  outDir = resolve(outDir);

  if (prepareMode !== 'app' && !(dryRun && prepareMode === 'raw')) {
    log('REFUSED: only a dry run may skip the app\'s photo preparation (--prepare raw); a measurement uses what the app sends.');
    return 1;
  }
  if (dryRun) {
    const rel = relative(join(ROOT, 'handwriting'), outDir);
    if (!rel.startsWith('..') && !isAbsolute(rel)) {
      log('REFUSED: a dry run uses a fake provider; its output may not be written under handwriting/ where real evidence lives.');
      return 1;
    }
  } else {
    const inRepo = relative(ROOT, setDir);
    if (!inRepo.startsWith('..') && !isAbsolute(inRepo)) {
      log('REFUSED: a real-photo set holds student pages and is kept outside the repository.');
      return 1;
    }
  }

  const manifestPath = join(setDir, 'manifest.json');
  if (!existsSync(manifestPath)) {
    log(`PHOTO READER EVAL — NOT MEASURED: no real-photo set at ${setDir} (manifest.json missing). No number was recorded.`);
    return 2;
  }
  let manifest;
  try { manifest = JSON.parse(readFileSync(manifestPath, 'utf8')); }
  catch { log(`PHOTO READER EVAL — REFUSED: ${manifestPath} is not JSON`); return 1; }
  const problems = manifestProblems(manifest, { exists: file => existsSync(join(setDir, file)) });
  if (problems.length) { log(`PHOTO READER EVAL — REFUSED: the set's manifest has problems:\n  · ${problems.join('\n  · ')}`); return 1; }

  const providerEnv = { ...env };
  if (!String(providerEnv.PRI_HANDWRITING_API_KEY || '').trim() && String(providerEnv.OPENAI_API_KEY || '').trim()) {
    providerEnv.PRI_HANDWRITING_API_KEY = providerEnv.OPENAI_API_KEY;
  }
  if (dryRun) providerEnv.PRI_HANDWRITING_API_KEY = 'dry-run-fake-key-never-sent';
  if (!String(providerEnv.PRI_HANDWRITING_API_KEY || '').trim()) {
    log('PHOTO READER EVAL — NOT MEASURED: no provider key. Set PRI_HANDWRITING_API_KEY (server environment only; never commit it). No number was recorded.');
    return 2;
  }
  const provider = await import(pathToFileURL(join(ROOT, 'server/platform/handwritingProvider.js')).href);
  const config = provider.providerConfig(providerEnv);
  const status = provider.providerStaticStatus(providerEnv);
  if (!dryRun && !status.configValid) {
    log(`PHOTO READER EVAL — NOT MEASURED: provider configuration invalid (${status.problems.join(', ')})`);
    return 2;
  }
  const { unreadablePage, buildTranscript, includedLines } = await import(pathToFileURL(join(ROOT, 'client/src/photo/transcript.js')).href);
  const { proposeFinalAnswer } = await import(pathToFileURL(join(ROOT, 'client/src/photo/finalAnswer.js')).href);

  let studio = null;
  if (prepareMode === 'app') {
    const { openStudio } = await import(pathToFileURL(join(ROOT, 'tools/acceptance/real-photo-support.mjs')).href);
    studio = await openStudio();
  }
  const photos = limit > 0 ? manifest.photos.slice(0, limit) : manifest.photos;
  log(`\nPhoto reader eval · ${dryRun ? 'DRY RUN (fake provider)' : `${status.provider || 'custom'} ${config.primaryModel}`} · ${photos.length} photo(s) · ${new Set(photos.map(p => p.writer)).size} writer(s)`);
  if (!dryRun) log(`  ${photos.length} paid provider request(s) will be made (plus fallback escalations below the ${config.confidenceFloor} floor).`);

  const rows = [];
  const started = Date.now();
  try {
    for (const [i, photo] of photos.entries()) {
      const bytes = readFileSync(join(setDir, photo.file));
      const original = `data:${MIME[extname(photo.file).toLowerCase()]};base64,${bytes.toString('base64')}`;
      const prepared = studio ? await studio.preparePhoto(original) : { dataUrl: original, width: null, height: null, bytes: bytes.length };
      if (!prepared?.dataUrl) { rows.push({ writer: photo.writer, file: photo.file, error: 'the app could not prepare this photo (it would say so and not send it)' }); continue; }
      try {
        const transcription = await provider.transcribeHandwriting(prepared.dataUrl, { env: providerEnv, fetchImpl: dryRun ? fakeFetchFor(photo, i) : globalThis.fetch });
        const unreadable = unreadablePage(transcription);
        const question = { answerType: photo.answerType || 'numeric' };
        const proposal = unreadable ? null : proposeFinalAnswer(includedLines(buildTranscript(transcription, question)), question);
        rows.push({ writer: photo.writer, file: photo.file, unreadable, score: unreadable ? null : scorePage(photo, transcription, proposal),
          engine: transcription.engine ?? null, latencyMs: transcription.latencyMs ?? null, sentBytes: prepared.bytes ?? null });
      } catch (error) {
        rows.push({ writer: photo.writer, file: photo.file, error: `${error?.code || 'ERROR'}: ${error?.message || error}` });
      }
    }
  } finally { await studio?.close?.(); }

  const summary = summarise(rows);
  const report = {
    format: FORMAT,
    version: 1,
    evidenceClass: dryRun ? 'synthetic-dry-run' : 'real-photo',
    measuredAt: new Date().toISOString(),
    releaseSha: releaseShaFor(env),
    floor: null,
    floorNote: 'No floor: whether photo-reading accuracy blocks a release is the owner\'s decision.',
    provider: dryRun
      ? { kind: 'FAKE — pipeline test only; these numbers say nothing about any reader' }
      : { kind: status.provider, endpointHost: status.endpointHost, primaryModel: config.primaryModel, fallbackModel: config.fallbackModel, confidenceFloor: config.confidenceFloor },
    set: { consent: manifest.consent, photos: photos.length, writers: summary.writers, limit: limit || null },
    preparation: prepareMode === 'app' ? 'client/src/ink/photoRaster.js preparePhoto in Chromium (what the app sends)' : 'raw file (dry run only)',
    results: summary,
    rows: rows.map(r => ({ writer: r.writer, file: r.file, unreadable: r.unreadable ?? null, error: r.error ?? null, engine: r.engine ?? null, latencyMs: r.latencyMs ?? null, score: r.score ?? null })),
    durationMs: Date.now() - started,
    notes: [
      summary.writers < 8 ? `${summary.writers} writer(s) is too few for a product accuracy claim.` : null,
      'The reader proposes text; the student confirms it and the deterministic marker decides. This measures the proposal, not marking.'
    ].filter(Boolean)
  };
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `${date}${dryRun ? '-dry-run' : ''}.json`);
  writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');
  const pct = v => (v === null || v === undefined ? 'n/a' : `${Number(v).toFixed(1)}%`);
  log(`  pages read exactly ${summary.pagesExact}/${summary.photos - summary.providerErrors - summary.unreadable} (${pct(summary.pagesExactPct)}) · lines ${summary.exactLines}/${summary.lines} (${pct(summary.exactLinePct)}) · chars ${pct(summary.charPct)}`);
  log(`  final answer proposed correctly ${summary.answersRight}/${summary.answers} (${pct(summary.answerPct)}) · unreadable ${summary.unreadable} · provider errors ${summary.providerErrors}`);
  log(`  ${dryRun ? 'DRY RUN — not evidence' : 'REAL PHOTOS — no floor applied; the owner decides whether this blocks'} · ${outPath}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(await main());
}
