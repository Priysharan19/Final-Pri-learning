// Pri Learning · real-Pencil corpus readiness report
// Aggregate counts only. It deliberately does not print final-holdout examples
// or errors, so checking collection progress does not spend release evidence.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = join(HERE, 'ink-corpus');
const SPLITS = ['train', 'validation', 'test', 'final-holdout'];
const rows = Object.fromEntries(SPLITS.map(s => [s, { writers: new Set(), sessions: new Set(), samples: 0, critical: 0 }]));
let invalid = 0;

const critical = text => any(text, ['^(', 'sqrt(', '/', '<=', '>=', '!=', '=', '±']);
function any(text, markers) { const s = String(text || ''); return markers.some(m => s.includes(m)); }

const files = existsSync(DIR) ? readdirSync(DIR).filter(f => f.endsWith('.json')).sort() : [];
for (const file of files) {
  let doc;
  try { doc = JSON.parse(readFileSync(join(DIR, file), 'utf8')); }
  catch { invalid++; continue; }
  const split = String(doc.split || doc.writer?.split || '');
  if (!rows[split]) { invalid++; continue; }
  const writer = String(doc.writer?.id || '').trim();
  const session = String(doc.writer?.sessionId || doc.session?.id || '').trim();
  if (writer) rows[split].writers.add(writer);
  if (session) rows[split].sessions.add(session);
  for (const sample of doc.samples || []) {
    if (!sample?.target || !sample?.strokes?.length) continue;
    rows[split].samples++;
    if (critical(sample.target)) rows[split].critical++;
  }
}

const target = {
  train: { writers: 40, samples: 2000 },
  validation: { writers: 10, samples: 500 },
  test: { writers: 20, samples: 1000 },
  'final-holdout': { writers: 20, samples: 1000 },
};
const pct = (a, b) => Math.min(100, Math.round(100 * a / Math.max(1, b)));
const bar = n => `${'█'.repeat(Math.floor(n / 5))}${'·'.repeat(20 - Math.floor(n / 5))}`;

console.log('\nPri Ink · real-Pencil corpus readiness\n');
for (const split of SPLITS) {
  const r = rows[split], t = target[split];
  const writerPct = pct(r.writers.size, t.writers);
  const samplePct = pct(r.samples, t.samples);
  const ready = r.writers.size >= t.writers && r.samples >= t.samples;
  console.log(`${split.padEnd(13)} ${ready ? 'READY' : 'collecting'}`);
  console.log(`  writers      ${String(r.writers.size).padStart(4)}/${t.writers}  ${bar(writerPct)} ${writerPct}%`);
  console.log(`  expressions  ${String(r.samples).padStart(4)}/${t.samples} ${bar(samplePct)} ${samplePct}%`);
  console.log(`  sessions     ${r.sessions.size}   critical-structure expressions ${r.critical}`);
}

const trainingReady = rows.train.writers.size >= target.train.writers && rows.train.samples >= target.train.samples
  && rows.validation.writers.size >= target.validation.writers && rows.validation.samples >= target.validation.samples;
const testReady = rows.test.writers.size >= target.test.writers && rows.test.samples >= target.test.samples;
const releaseEvidenceReady = rows['final-holdout'].writers.size >= target['final-holdout'].writers
  && rows['final-holdout'].samples >= target['final-holdout'].samples;

console.log('\nPipeline');
console.log(`  real-writer fine-tuning   ${trainingReady ? 'READY' : 'NOT READY'}`);
console.log(`  frozen test evaluation    ${testReady ? 'READY' : 'NOT READY'}`);
console.log(`  final release evaluation  ${releaseEvidenceReady ? 'READY' : 'NOT READY'}`);
if (invalid) console.log(`\n  WARNING: ${invalid} corpus file(s) could not be counted; run npm run test:ink:corpus:strict.`);
console.log('\nCounts are collection readiness, not accuracy. A release still has to pass the locked model-quality gates.\n');
