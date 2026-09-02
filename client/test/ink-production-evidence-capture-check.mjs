import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  CONFIRM_CONF,
  CONFIRM_MARGIN,
  REAL_PENCIL_PROMPTS,
  assignedEvidenceSplit,
  buildCorpusFromPhysicalRun,
  buildPhysicalEvidenceRun,
  productionAuthorityOf
} from '../src/ink/productionEvidence.js';

const collector = fs.readFileSync(new URL('../../tools/ink-collect-v2/index.html', import.meta.url), 'utf8');
const practice = fs.readFileSync(new URL('../src/pages/Practice.jsx', import.meta.url), 'utf8');
const page = fs.readFileSync(new URL('../src/components/InkPhysicalEvidenceSession.jsx', import.meta.url), 'utf8');
const questionCard = fs.readFileSync(new URL('../src/components/QuestionCard.jsx', import.meta.url), 'utf8');

const promptBlock = collector.match(/const PROMPTS=\[(.*?)\]\.map\(\(\[text,want\]\)=>\(\{text,want\}\)\);/s)?.[1];
assert.ok(promptBlock, 'could not locate the audited collector PROMPTS array');
const collectorPairs = [...promptBlock.matchAll(/\['([^']*)','([^']*)'\]/g)]
  .map(([, shown, target]) => ({ shown, target }));
const protocolPairs = REAL_PENCIL_PROMPTS.map(({ shown, target }) => ({ shown, target }));

console.log('\nPRI INK PRODUCTION EVIDENCE CAPTURE CONTRACT\n');

assert.ok(protocolPairs.length >= 60, `expected substantive protocol, got ${protocolPairs.length}`);
assert.deepEqual(protocolPairs, collectorPairs, 'production evidence prompts must stay exactly aligned with the audited real-Pencil corpus collector');
assert.equal(new Set(REAL_PENCIL_PROMPTS.map(p => p.id)).size, REAL_PENCIL_PROMPTS.length, 'prompt ids must be unique');

// Same deterministic split algorithm used by the corpus collector. Find one id
// in every split instead of hard-coding an accidental bucket assumption.
const examples = {};
for (let i = 1; i < 10000 && Object.keys(examples).length < 4; i++) {
  const id = `P${String(i).padStart(4, '0')}`;
  const split = assignedEvidenceSplit(id);
  if (!examples[split]) examples[split] = id;
}
for (const split of ['train', 'validation', 'test', 'final-holdout']) assert.ok(examples[split], `missing generated ${split} writer`);
assert.ok(collector.includes("fnv1a32-v1:70/10/10/10"));

const safe = { text: 'x=3', lines: ['x=3'], minConf: 0.96, margin: 0.7, engine: 'pri-consensus:pri-foundation+native-rescue', researchOnly: false };
assert.deepEqual(productionAuthorityOf(safe, { nativeAvailable: true }).authority, 'auto');
assert.equal(productionAuthorityOf({ ...safe, minConf: CONFIRM_CONF - 0.01 }, { nativeAvailable: true }).authority, 'confirm');
assert.equal(productionAuthorityOf({ ...safe, margin: CONFIRM_MARGIN - 0.01 }, { nativeAvailable: true }).authority, 'confirm');
assert.equal(productionAuthorityOf({ ...safe, engine: 'pri-disagreement:pri-foundation|native-rescue' }, { nativeAvailable: true }).authority, 'confirm');
assert.equal(productionAuthorityOf({ ...safe, text: 'x==3', lines: ['x==3'] }, { nativeAvailable: true }).authority, 'confirm');
assert.equal(productionAuthorityOf({ ...safe, text: '', lines: [] }, { nativeAvailable: true }).authority, 'abstain');
assert.equal(productionAuthorityOf(safe, { nativeAvailable: false }).productionReady, false, 'browser fallback can never be release evidence');
assert.equal(productionAuthorityOf({ ...safe, engine: 'pri-foundation-debug' }, { nativeAvailable: true }).productionReady, false, 'debug engine can never be release evidence');
assert.equal(productionAuthorityOf({ ...safe, researchOnly: true }, { nativeAvailable: true }).productionReady, false, 'research-only engine can never be release evidence');
assert.ok(!/target|expected|answer/i.test(productionAuthorityOf.toString()), 'authority policy must not inspect ground truth or expected answers');

// Keep the study's thresholds locked to the real QuestionCard confirmation
// boundary instead of letting a benchmark quietly become more permissive.
assert.match(questionCard, /const CONFIRM_CONF = 0\.55/);
assert.match(questionCard, /const CONFIRM_MARGIN = 0\.15/);
assert.equal(CONFIRM_CONF, 0.55);
assert.equal(CONFIRM_MARGIN, 0.15);

const sample = {
  id: 'sample-001', shown: 'x²', target: 'x^(2)', recognized: 'x^(2)',
  authority: 'auto', authorityReason: 'safe-reading', pencil: true,
  recognitionMs: 120, engine: safe.engine, productionReady: true,
  researchOnly: false, critical: true,
  strokes: [{ points: [{ x: 1, y: 2, t: 0, p: 0.5, azimuth: 1, altitude: 1 }] }]
};
const meta = {
  writerId: examples.test, runId: 'RUN-TEST-001', recordedAt: '2026-09-02T10:00:00Z', startedAt: 1788343200000,
  buildCommit: '0123456789abcdef0123456789abcdef01234567', appVersion: '1.0 (1)',
  deviceModel: 'iPad Air 11-inch (M2)', osVersion: '18.6', pencil: 'Apple Pencil Pro'
};
const run = buildPhysicalEvidenceRun(meta, [sample]);
assert.equal(run.physicalHardware, true);
assert.equal(run.writer.split, 'test');
assert.equal(run.samples[0].recognized, 'x^(2)');
assert.equal(run.samples[0].authority, 'auto');
assert.equal(run.samples[0].strokes[0].points[0].p, 0.5);

const holdoutRun = buildPhysicalEvidenceRun({ ...meta, writerId: examples['final-holdout'], runId: 'RUN-HOLDOUT-001' }, [sample]);
assert.equal(holdoutRun.writer.split, 'final-holdout');
assert.equal(holdoutRun.writer.holdoutLocked, true);

const corpus = buildCorpusFromPhysicalRun(run);
assert.equal(corpus.format, 'pri-ink-corpus');
assert.equal(corpus.version, 2);
assert.equal(corpus.split, 'test');
assert.equal(corpus.splitAssignment.deterministic, true);
assert.equal(corpus.samples[0].target, 'x^(2)');
assert.ok(Array.isArray(corpus.samples[0].strokes));
assert.ok(!Object.hasOwn(corpus.samples[0], 'recognized'), 'model corpus must not store prediction as ground truth');
assert.ok(!Object.hasOwn(corpus.samples[0], 'authority'), 'model corpus must not store authority as ground truth');

assert.match(practice, /params\.get\('inkEvidence'\) === '1'/);
assert.match(practice, /React\.lazy\(\(\) => import\('\.\.\/components\/InkPhysicalEvidenceSession\.jsx'\)\)/);
assert.match(page, /nativeInkAvailable\(\)/);
assert.match(page, /productionAuthorityOf\(reading, \{ nativeAvailable \}\)/);
assert.match(page, /recognitionMs/);
assert.match(page, /strokes: cloneStrokes\(latest\.strokes\)/);
assert.match(page, /buildCorpusFromPhysicalRun/);
assert.match(page, /\.ink-syms,.ink-evidence-session \.ink-picker\{display:none!important\}/);
assert.ok(!/recognitionContext=\{?prompt|expectedAnswer|markScheme/.test(page), 'ground truth must never be passed into recognition context');

console.log(`PASS — ${REAL_PENCIL_PROMPTS.length} prompts, production authority, timing, raw PencilKit export and deterministic split contract verified\n`);
