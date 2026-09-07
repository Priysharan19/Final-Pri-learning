#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · handwriting architecture benchmark · runner
//
// Scores every candidate on one corpus, through one contract, with one
// rasteriser and one normaliser. It does not manufacture handwriting: with no
// corpus it reports NOT MEASURED and exits, the same discipline as
// client/test/ink-physical-release-evidence.mjs.
//
// This runner spends real money. Three guards:
//   · --dry-run (the default) calls nothing and prints the projected bill.
//   · --live is required to make a paid call at all.
//   · --limit caps the sample count; the full corpus needs --all.
//
// Usage:
//   node tools/handwriting-bench/run.mjs                    # what it would cost
//   node tools/handwriting-bench/run.mjs --live --limit 20  # a real 20-sample run
//   node tools/handwriting-bench/run.mjs --live --all --split test
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

import { candidates, missingKeys, isReady, priMark, visionTranscribe } from './adapters/index.mjs';
import { rasterOf } from './raster.mjs';
import { scoreRecognition } from './metrics/recognition.mjs';
import { scoreMarking, interMarkerAgreement } from './metrics/marking.mjs';
import { loadMarkingCorpus, CORPUS_FLOORS } from './corpus/marking-corpus.mjs';
import { aud, MATHPIX, USD_TO_AUD, CHECKED } from './cost.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const INK_CORPUS = join(ROOT, 'client/test/ink-corpus');
const MARKING_CORPUS = join(HERE, 'corpus/items');
const OUT_DIR = join(HERE, 'results');

const argv = process.argv.slice(2);
const has = flag => argv.includes(flag);
const argAfter = (flag, fallback) => {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const LIVE = has('--live');
const ALL = has('--all');
const SPLIT = argAfter('--split', 'test');
const LIMIT = ALL ? Infinity : Number(argAfter('--limit', 20));
const WITH_ANTHROPIC = has('--with-anthropic');

const pct = v => (v === null || v === undefined ? '     —' : `${(v * 100).toFixed(1)}%`.padStart(6));
const usd = v => (v === null || v === undefined ? '—' : `$${v.toFixed(5)}`);
const ms = v => (v === null || v === undefined ? '—' : `${Math.round(v)}ms`);

// ── Corpora ──────────────────────────────────────────────────────────────────

function loadInkCorpus(split) {
  if (!existsSync(INK_CORPUS)) return { samples: [], writers: 0 };
  const samples = [];
  const writers = new Set();
  for (const file of readdirSync(INK_CORPUS).filter(f => f.endsWith('.json'))) {
    let parsed;
    try { parsed = JSON.parse(readFileSync(join(INK_CORPUS, file), 'utf8')); } catch { continue; }
    if (parsed?.format !== 'pri-ink-corpus') continue;
    if (split && parsed.split !== split) continue;
    writers.add(parsed.writer?.id);
    for (const [i, sample] of (parsed.samples || []).entries()) {
      samples.push({ id: `${parsed.writer?.id}-${i}`, writerId: parsed.writer?.id, target: sample.target, strokes: sample.strokes });
    }
  }
  return { samples, writers: writers.size };
}

// ── The honest gate ──────────────────────────────────────────────────────────

function reportCorpusState(ink, marking) {
  console.log('CORPUS');
  console.log(`  recognition (client/test/ink-corpus, split "${SPLIT}"): ${ink.samples.length} expressions from ${ink.writers} writer(s)`);
  if (marking.stats.present) {
    console.log(`  marking     (${MARKING_CORPUS}): ${marking.stats.items} solutions from ${marking.stats.writers} writer(s)`);
    console.log(`               ${marking.stats.markableByPriEngine} carry Pri question meta (Architecture B scorable), ` +
      `${marking.stats.strokeItems} strokes, ${marking.stats.photoItems} photos`);
    if (marking.stats.rejected) console.log(`               ${marking.stats.rejected} item(s) rejected by the validator`);
  } else {
    console.log(`  marking     (${MARKING_CORPUS}): ABSENT`);
  }

  const blockers = [];
  if (ink.writers < CORPUS_FLOORS.writers) blockers.push(`recognition corpus has ${ink.writers} writer(s), the study needs ${CORPUS_FLOORS.writers}`);
  if (marking.stats.items === undefined || marking.stats.items < CORPUS_FLOORS.solutions) {
    blockers.push(`marking corpus has ${marking.stats.items || 0} double-marked solution(s), the study needs ${CORPUS_FLOORS.solutions}`);
  }
  if (marking.errors.length) blockers.push(`${marking.errors.length} corpus validation error(s)`);
  return blockers;
}

// ── Run ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Pri Learning · handwriting architecture benchmark');
  console.log(`prices read ${CHECKED} · USD→AUD ${USD_TO_AUD.rate} as of ${USD_TO_AUD.asOf}\n`);

  const ink = loadInkCorpus(SPLIT);
  const marking = loadMarkingCorpus(MARKING_CORPUS, { split: SPLIT });
  const blockers = reportCorpusState(ink, marking);

  const chosen = candidates({ includeAnthropic: WITH_ANTHROPIC });
  const absent = missingKeys(chosen);
  const runnable = chosen.filter(c => isReady(c, chosen));

  console.log('\nCANDIDATES');
  for (const candidate of chosen) {
    const ready = isReady(candidate, chosen);
    const why = candidate.legs?.length ? `needs both legs: ${candidate.legs.join(' + ')}` : `needs ${(candidate.envKeys || []).join(', ')}`;
    console.log(`  ${ready ? '✓' : '·'} ${candidate.id}${ready ? '' : `  (${why})`}`);
  }
  if (absent.length) console.log(`\n  ${absent.length} key(s) not set: ${absent.join(', ')}`);

  const samples = ink.samples.slice(0, Number.isFinite(LIMIT) ? LIMIT : undefined);
  const projected = projectCost(runnable, samples.length, marking.items.length);
  console.log('\nPROJECTED SPEND for this invocation');
  console.log(`  ${samples.length} recognition sample(s) × ${runnable.filter(c => c.kind === 'recognition').length} candidate(s)`);
  console.log(`  ≈ US$${projected.usd.toFixed(2)} / A$${aud(projected.usd).toFixed(2)}  (token-priced candidates are floor estimates until a real run reports usage)`);
  console.log(`  plus Mathpix one-time key activation US$${MATHPIX.oneTimeKeyActivation} if this is a first run`);

  if (blockers.length) {
    console.log('\nNOT MEASURED — the corpus cannot support an architecture claim:');
    for (const blocker of blockers) console.log(`  · ${blocker}`);
    console.log('\nSee tools/handwriting-bench/corpus/SPEC.md for the capture and double-marking protocol.');
    console.log('The harness itself is ready: it will score every candidate the moment the corpus exists.');
  }
  if (marking.errors.length) {
    console.log('\nCORPUS VALIDATION ERRORS');
    for (const error of marking.errors.slice(0, 20)) console.log(`  · ${error}`);
  }

  if (!LIVE) {
    console.log('\nDRY RUN — nothing was called and nothing was spent. Add --live to run for real.');
    // pri-local costs nothing and needs no key, so it is always worth showing.
    if (samples.length) await runOffline(samples);
    return;
  }
  if (!runnable.length) {
    console.log('\nNo candidate has its keys set. Nothing to run.');
    process.exit(1);
  }

  console.log(`\nRUNNING ${runnable.length} candidate(s) over ${samples.length} sample(s)…`);
  const results = await runRecognition(runnable, samples);
  const report = { generatedAt: new Date().toISOString(), split: SPLIT, samples: samples.length, writers: ink.writers, blockers, recognition: {}, marking: {} };

  console.log('\nRECOGNITION');
  console.log('  candidate                                    exact   chars  worst   p95      cost/read');
  for (const [id, rows] of results) {
    const score = scoreRecognition(rows);
    report.recognition[id] = score;
    console.log(`  ${id.padEnd(42)} ${pct(score.exactExpression)} ${pct(score.characterAccuracy)} ${pct(score.worstWriterExact)}  ${String(ms(score.latencyMs?.p95)).padStart(7)}  ${usd(score.costUsd?.mean)}`);
  }

  if (marking.items.length) {
    const ceiling = interMarkerAgreement(marking.items);
    if (ceiling) {
      console.log(`\nHUMAN CEILING — the two markers agreed exactly on ${pct(ceiling.exactAgreement)} of ${ceiling.n} solutions`);
      console.log('  No candidate can be shown to beat this. A candidate inside this band is not measurably worse than a human.');
    }
    console.log('\nMARKING (false-wrong first — the brief\'s priority)');
    console.log('  candidate                                  false-wrong  false-correct  exact  within-1   ECF   alt-method');
    for (const [id, rows] of await runMarking(runnable, marking.items)) {
      const score = scoreMarking(rows);
      report.marking[id] = score;
      console.log(`  ${id.padEnd(40)} ${pct(score.falseWrongRate)}       ${pct(score.falseCorrectRate)}   ${pct(score.exactMarkAgreement)} ${pct(score.withinOneMark)} ${pct(score.errorCarriedForward)} ${pct(score.alternativeMethodAccepted)}`);
    }
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const path = join(OUT_DIR, `bench-${Date.now()}.json`);
  writeFileSync(path, JSON.stringify(report, null, 2));
  console.log(`\nreport → ${path}`);
}

/** The offline reference, which always runs: it is free and needs no key. */
async function runOffline(samples) {
  const local = candidates().find(c => c.id === 'pri-local');
  const rows = [];
  for (const sample of samples) rows.push({ item: sample, reading: await local.run(sample) });
  const score = scoreRecognition(rows);
  console.log(`\nOFFLINE REFERENCE — pri-local over ${rows.length} sample(s) from ${score.writers} writer(s)`);
  console.log(`  exact expression ${pct(score.exactExpression)} · characters ${pct(score.characterAccuracy)} · worst writer ${pct(score.worstWriterExact)} · p95 ${ms(score.latencyMs?.p95)}`);
  const weak = Object.entries(score.byStructure).sort((a, b) => a[1].exact - b[1].exact).slice(0, 5);
  if (weak.length) {
    console.log('  weakest structures: ' + weak.map(([name, s]) => `${name} ${(s.exact * 100).toFixed(0)}% (n=${s.n})`).join(', '));
  }
  console.log('  This is one corpus, and the study needs 30 writers — it is a baseline, not evidence.');
}

async function runRecognition(list, samples) {
  const prepared = samples.map(sample => ({ ...sample, raster: safeRaster(sample.strokes) }));
  const out = new Map();
  const parts = new Map();

  for (const candidate of list.filter(c => c.kind === 'recognition' && !c.legs)) {
    const rows = [];
    for (const sample of prepared) {
      const result = await candidate.run(sample);
      rows.push({ item: sample, reading: result });
      if (!parts.has(sample.id)) parts.set(sample.id, {});
      parts.get(sample.id)[candidate.id] = result;
    }
    out.set(candidate.id, rows);
  }
  // Hybrids reuse their legs' already-paid-for readings; nothing is called twice.
  for (const candidate of list.filter(c => c.legs)) {
    const rows = prepared.map(sample => ({ item: sample, reading: candidate.run(sample, { parts: parts.get(sample.id) || {} }) }));
    out.set(candidate.id, rows);
  }
  return out;
}

async function runMarking(list, items) {
  const prepared = items.map(item => ({ ...item, raster: item.strokes ? safeRaster(item.strokes) : null }));
  const out = new Map();

  // Architecture A: the model marks the page directly.
  for (const candidate of list.filter(c => c.kind === 'marking')) {
    const rows = [];
    for (const item of prepared) {
      rows.push({ item, marking: await candidate.run(item, { extractJson: visionTranscribe.extractJson }) });
    }
    out.set(candidate.id, rows);
  }
  // Architecture B: every recogniser's transcription through Pri's own marker.
  for (const candidate of list.filter(c => c.kind === 'recognition' && !c.legs)) {
    const rows = [];
    for (const item of prepared) {
      if (!item.meta) continue;
      const read = await candidate.run(item);
      rows.push({ item, marking: priMark.run(item, read) });
    }
    if (rows.length) out.set(`${candidate.id} → pri-marker`, rows);
  }
  return out;
}

function safeRaster(strokes) {
  try { return rasterOf(strokes); } catch { return null; }
}

/**
 * A floor, and labelled as one. Mathpix is per-request so its number is exact;
 * the token-priced candidates cannot be known before a run reports usage, so
 * they are costed at a deliberately conservative 1,500 in / 400 out and the
 * report says so rather than presenting it as measured.
 */
function projectCost(list, recognitionSamples, markingItems) {
  let usd = 0;
  for (const candidate of list) {
    if (candidate.id?.startsWith('mathpix')) usd += recognitionSamples * MATHPIX.imagePerRequest;
    else if (candidate.id?.startsWith('vision-transcribe')) usd += recognitionSamples * 0.005;
    else if (candidate.id?.startsWith('vision-mark')) usd += markingItems * 0.01;
  }
  return { usd };
}

main().catch(error => { console.error(`\nFAIL — ${error?.stack || error}`); process.exit(1); });
