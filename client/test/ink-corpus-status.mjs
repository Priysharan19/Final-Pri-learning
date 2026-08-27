// Pri Learning · real-Pencil corpus readiness report
// Routine tooling may count final-holdout registrations, but must never inspect
// its targets, strokes, token coverage, style statistics, or per-sample errors.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIR = join(HERE, 'ink-corpus');
const POLICY_PATH = resolve(HERE, '../../tools/ink-foundation/corpus_policy.json');
const POLICY = JSON.parse(readFileSync(POLICY_PATH, 'utf8'));
const SPLITS = ['train', 'validation', 'test', 'final-holdout'];

function any(text, markers) {
  const s = String(text || '');
  return markers.some(marker => s.includes(marker));
}
const critical = text => any(text, ['^(', 'sqrt(', '/', '<=', '>=', '!=', '=', '±']);
const canonicalWriter = value => String(value || '').trim().toUpperCase();

function sessionId(doc) {
  const legacy = doc?.session;
  return String(
    doc?.writer?.sessionId
    || doc?.sessionId
    || (legacy && typeof legacy === 'object' ? legacy.id : legacy)
    || ''
  ).trim();
}

function emptyRow(split) {
  return {
    split,
    writers: new Set(),
    sessions: new Set(),
    samples: split === 'final-holdout' ? null : 0,
    critical: split === 'final-holdout' ? null : 0,
    samplesByWriter: split === 'final-holdout' ? null : new Map(),
  };
}

export function buildCorpusStatus(corpusDir = DEFAULT_DIR) {
  const rows = Object.fromEntries(SPLITS.map(split => [split, emptyRow(split)]));
  let invalid = 0;
  const files = existsSync(corpusDir)
    ? readdirSync(corpusDir).filter(file => file.endsWith('.json')).sort()
    : [];

  for (const file of files) {
    let doc;
    try {
      doc = JSON.parse(readFileSync(join(corpusDir, file), 'utf8'));
    } catch {
      invalid++;
      continue;
    }
    if (doc?.format !== 'pri-ink-corpus') {
      invalid++;
      continue;
    }

    const split = String(doc.split || doc.writer?.split || '');
    const row = rows[split];
    if (!row) {
      invalid++;
      continue;
    }

    // The collector canonicalises participant codes to uppercase. Mirror that
    // here so P0042 and p0042 cannot inflate the independent-writer count.
    const writer = canonicalWriter(doc.writer?.id);
    const session = sessionId(doc);
    if (writer) row.writers.add(writer);
    if (session) row.sessions.add(session);

    // Evidence firewall: after registration metadata, final-holdout is opaque.
    // Do not iterate doc.samples and do not inspect targets or strokes.
    if (split === 'final-holdout') continue;

    for (const sample of doc.samples || []) {
      if (!sample?.target || !sample?.strokes?.length) continue;
      row.samples++;
      if (critical(sample.target)) row.critical++;
      if (writer) {
        row.samplesByWriter.set(writer, (row.samplesByWriter.get(writer) || 0) + 1);
      }
    }
  }

  const readiness = POLICY.readiness;
  const preferred = POLICY.campaign.preferredSamplesPerWriter;
  const trainMinSamples = readiness.trainWriterTarget * readiness.minSamplesPerTrainWriter;
  const validationTargetSamples = readiness.validationWriterTarget
    * readiness.preferredSamplesPerValidationWriter;

  const minTrainWriterSamples = rows.train.writers.size
    ? Math.min(...[...rows.train.writers].map(
      writer => rows.train.samplesByWriter.get(writer) || 0
    ))
    : 0;

  const targets = {
    train: {
      writers: readiness.trainWriterTarget,
      samples: trainMinSamples,
      minimumPerWriter: readiness.minSamplesPerTrainWriter,
    },
    validation: {
      writers: readiness.validationWriterTarget,
      samples: validationTargetSamples,
      preferredPerWriter: readiness.preferredSamplesPerValidationWriter,
    },
    test: {
      writers: readiness.evaluationMinWriters,
      samples: readiness.evaluationMinSamples,
    },
    'final-holdout': {
      writers: readiness.finalHoldoutWriterTarget,
      samples: null,
      preferredPerWriter: readiness.preferredSamplesPerFinalHoldoutWriter || preferred,
      opaque: true,
    },
  };

  const trainingReady = (
    rows.train.writers.size >= targets.train.writers
    && rows.train.samples >= targets.train.samples
    && minTrainWriterSamples >= targets.train.minimumPerWriter
    && rows.validation.writers.size >= targets.validation.writers
    && rows.validation.samples >= targets.validation.samples
  );
  const testReady = (
    rows.test.writers.size >= targets.test.writers
    && rows.test.samples >= targets.test.samples
  );
  const finalHoldoutRegistered = (
    rows['final-holdout'].writers.size >= targets['final-holdout'].writers
  );

  return {
    format: 'pri-ink-corpus-status',
    version: 2,
    releaseLane: POLICY.releaseLane,
    corpusDir,
    invalid,
    rows,
    targets,
    minTrainWriterSamples,
    pipeline: { trainingReady, testReady, finalHoldoutRegistered },
    finalHoldoutContentInspected: false,
  };
}

const pct = (a, b) => Math.min(100, Math.round(100 * a / Math.max(1, b)));
const bar = n => `${'█'.repeat(Math.floor(n / 5))}${'·'.repeat(20 - Math.floor(n / 5))}`;

export function renderCorpusStatus(report) {
  const out = [];
  out.push('', `Pri Ink ${report.releaseLane} · real-Pencil corpus readiness`, '');

  for (const split of SPLITS) {
    const row = report.rows[split];
    const target = report.targets[split];
    if (split === 'final-holdout') {
      const writerPct = pct(row.writers.size, target.writers);
      const registered = row.writers.size >= target.writers;
      out.push(`${split.padEnd(13)} ${registered ? 'REGISTERED' : 'collecting (opaque)'}`);
      out.push(`  writers      ${String(row.writers.size).padStart(4)}/${target.writers}  ${bar(writerPct)} ${writerPct}%`);
      out.push('  expressions  opaque — routine status does not read final-holdout samples');
      out.push(`  sessions     ${row.sessions.size}   targets/strokes/style not inspected`);
      continue;
    }

    const writerPct = pct(row.writers.size, target.writers);
    const samplePct = pct(row.samples, target.samples);
    let ready = row.writers.size >= target.writers && row.samples >= target.samples;
    if (split === 'train') ready = ready && report.minTrainWriterSamples >= target.minimumPerWriter;
    out.push(`${split.padEnd(13)} ${ready ? 'READY' : 'collecting'}`);
    out.push(`  writers      ${String(row.writers.size).padStart(4)}/${target.writers}  ${bar(writerPct)} ${writerPct}%`);
    out.push(`  expressions  ${String(row.samples).padStart(4)}/${target.samples} ${bar(samplePct)} ${samplePct}%`);
    if (split === 'train') {
      out.push(`  minimum/writer ${report.minTrainWriterSamples}/${target.minimumPerWriter}   sessions ${row.sessions.size}   critical ${row.critical}`);
    } else {
      out.push(`  sessions     ${row.sessions.size}   critical-structure expressions ${row.critical}`);
    }
  }

  out.push('', 'Pipeline');
  out.push(`  real-writer fine-tuning   ${report.pipeline.trainingReady ? 'READY' : 'NOT READY'}`);
  out.push(`  frozen test evaluation    ${report.pipeline.testReady ? 'READY' : 'NOT READY'}`);
  out.push(`  final-holdout registry    ${report.pipeline.finalHoldoutRegistered ? 'REGISTERED' : 'NOT YET'} (content stays locked)`);
  if (report.invalid) {
    out.push('', `  WARNING: ${report.invalid} corpus file(s) could not be counted; run npm run test:ink:corpus:strict.`);
  }
  out.push('', 'Counts are collection readiness, not handwriting accuracy. Final-holdout remains opaque until an explicitly unlocked frozen-release evaluation.', '');
  return out.join('\n');
}

function cliCorpusDir() {
  const index = process.argv.indexOf('--corpus');
  return index >= 0 && process.argv[index + 1] ? resolve(process.argv[index + 1]) : DEFAULT_DIR;
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isCli) {
  console.log(renderCorpusStatus(buildCorpusStatus(cliCorpusDir())));
}
