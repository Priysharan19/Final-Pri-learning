// Contract check for the physical-study capture route (/practice?inkEvidence=1),
// re-based on the server reader.
//
// This file pins the pieces a browser cannot: the prompt protocol, the
// deterministic split, the answer-blind authority policy for a SERVER reading,
// the schema-2 evidence file and the source-level rules of the route. The
// route's behaviour inside the real InkAnswer (a stroke, a press of "Read my
// answer", a recorded sample with strokes and a finite server-read time, an
// export the physical scorer accepts) is proven by the browser flow
// client/test/tour-ink-evidence-capture.js.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  BUILD_KINDS,
  CONFIRM_CONF,
  CONFIRM_MARGIN,
  PHYSICAL_EVIDENCE_SCHEMA_VERSION,
  REAL_PENCIL_PROMPTS,
  SERVERS,
  SERVER_ENGINE_PREFIX,
  assignedEvidenceSplit,
  buildCorpusFromPhysicalRun,
  buildPhysicalEvidenceRun,
  nonProductionEngine,
  productionAuthorityOf
} from '../src/ink/productionEvidence.js';
import { CLOUD_ENGINE_PREFIX } from '../src/ink/cloudReader.js';

const collector = fs.readFileSync(new URL('../../tools/ink-collect-v2/index.html', import.meta.url), 'utf8');
const practice = fs.readFileSync(new URL('../src/pages/Practice.jsx', import.meta.url), 'utf8');
const page = fs.readFileSync(new URL('../src/components/InkPhysicalEvidenceSession.jsx', import.meta.url), 'utf8');
const inkAnswer = fs.readFileSync(new URL('../src/ink/InkAnswer.jsx', import.meta.url), 'utf8');
const questionCard = fs.readFileSync(new URL('../src/components/QuestionCard.jsx', import.meta.url), 'utf8');
const scorer = fs.readFileSync(new URL('./ink-physical-release-evidence.mjs', import.meta.url), 'utf8');

const promptBlock = collector.match(/const PROMPTS=\[(.*?)\]\.map\(\(\[text,want\]\)=>\(\{text,want\}\)\);/s)?.[1];
assert.ok(promptBlock, 'could not locate the audited collector PROMPTS array');
const collectorPairs = [...promptBlock.matchAll(/\['([^']*)','([^']*)'\]/g)]
  .map(([, shown, target]) => ({ shown, target }));
const protocolPairs = REAL_PENCIL_PROMPTS.map(({ shown, target }) => ({ shown, target }));

console.log('\nPRI INK PRODUCTION EVIDENCE CAPTURE CONTRACT (server reader)\n');

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

// ── authority: the card's confirmation boundary applied to a SERVER reading ──
// `productionReady: true` and a `cloud…` engine are what InkAnswer publishes
// for a reading the server made (cloudReader.js toReading → publish).
assert.equal(SERVER_ENGINE_PREFIX, CLOUD_ENGINE_PREFIX, 'the evidence module names the same engine prefix the reader returns');
const safe = { text: 'x=3', lines: ['x=3'], minConf: 0.96, margin: 0.96, confidenceFloor: 0.82, needsConfirmation: false, engine: 'cloud-gpt-example', productionReady: true, researchOnly: false, readMs: 1840 };
assert.deepEqual(productionAuthorityOf(safe, { nativeAvailable: true }), { authority: 'auto', productionReady: true, reason: 'safe-reading' });
assert.equal(productionAuthorityOf({ ...safe, needsConfirmation: true }, { nativeAvailable: true }).reason, 'server-doubt', 'the server\'s own doubt is a confirmation');
assert.equal(productionAuthorityOf({ ...safe, minConf: 0.81 }, { nativeAvailable: true }).reason, 'confidence', 'under the server\'s floor is a confirmation');
assert.equal(productionAuthorityOf({ ...safe, confidenceFloor: null, minConf: CONFIRM_CONF - 0.01 }, { nativeAvailable: true }).reason, 'confidence', 'with no server floor the card\'s CONFIRM_CONF applies');
assert.equal(productionAuthorityOf({ ...safe, confidenceFloor: null, minConf: CONFIRM_CONF }, { nativeAvailable: true }).authority, 'auto');
assert.equal(productionAuthorityOf({ ...safe, margin: CONFIRM_MARGIN - 0.01 }, { nativeAvailable: true }).reason, 'rival-margin');
assert.equal(productionAuthorityOf({ ...safe, text: 'x==3', lines: ['x==3'] }, { nativeAvailable: true }).reason, 'shape');
assert.equal(productionAuthorityOf({ ...safe, text: '', lines: [] }, { nativeAvailable: true }).authority, 'abstain');
assert.equal(productionAuthorityOf(safe, { nativeAvailable: false }).productionReady, false, 'browser fallback can never be release evidence');
assert.equal(productionAuthorityOf({ ...safe, productionReady: false }, { nativeAvailable: true }).productionReady, false, 'a reading the server did not make can never be release evidence');
assert.equal(productionAuthorityOf({ ...safe, researchOnly: true }, { nativeAvailable: true }).productionReady, false, 'research-only can never be release evidence');
for (const retired of ['pri-consensus:pri-foundation+native-rescue', 'native-rescue+line-stroke-fusion', 'pri-foundation', 'apple-vision-photo-v1', 'pri-js-v3', 'pri-foundation-debug']) {
  assert.equal(productionAuthorityOf({ ...safe, engine: retired }, { nativeAvailable: true }).productionReady, false, `retired reader ${retired} can never be release evidence`);
  assert.equal(nonProductionEngine(retired), true);
}
assert.equal(nonProductionEngine('cloud-gpt-example'), false);
assert.equal(nonProductionEngine(''), true, 'an unlabelled reading is not production evidence');
assert.ok(!/target|expected|answer/i.test(productionAuthorityOf.toString()), 'authority policy must not inspect ground truth or expected answers');

// Keep the study's thresholds locked to the real QuestionCard confirmation
// boundary instead of letting a benchmark quietly become more permissive.
assert.match(questionCard, /const CONFIRM_CONF = 0\.55/);
assert.match(questionCard, /const CONFIRM_MARGIN = 0\.15/);
assert.match(questionCard, /if \(ink\.needsConfirmation === true\) return \{ why: 'glyph'/, 'the card confirms on the server\'s own doubt');
assert.equal(CONFIRM_CONF, 0.55);
assert.equal(CONFIRM_MARGIN, 0.15);

// ── the evidence file: schema 2, server reader, the measured round trip ──────
const sample = {
  id: 'sample-001', shown: 'x²', target: 'x^(2)', recognized: 'x^(2)',
  authority: 'auto', authorityReason: 'safe-reading', pencil: true, reader: 'server',
  recognitionMs: 1840.25, engine: safe.engine, serverConfidence: 0.96, serverNeedsConfirmation: false,
  productionReady: true, researchOnly: false, critical: true,
  strokes: [{ points: [{ x: 1, y: 2, t: 0, p: 0.5, azimuth: 1, altitude: 1 }] }]
};
const meta = {
  writerId: examples.test, runId: 'RUN-TEST-001', recordedAt: '2026-11-02T10:00:00Z', startedAt: 1793613600000,
  buildCommit: '0123456789abcdef0123456789abcdef01234567', appVersion: '1.0 (3)', buildKind: 'development', server: 'staging',
  deviceModel: 'iPad Air 11-inch (M2)', osVersion: '26.1', pencil: 'Apple Pencil Pro'
};
const run = buildPhysicalEvidenceRun(meta, [sample]);
assert.equal(run.schemaVersion, PHYSICAL_EVIDENCE_SCHEMA_VERSION);
assert.equal(run.schemaVersion, 2);
assert.equal(run.physicalHardware, true);
assert.equal(run.reader, 'server');
assert.equal(run.writer.split, 'test');
assert.deepEqual(run.build, { commit: meta.buildCommit, appVersion: '1.0 (3)', kind: 'development', server: 'staging' });
assert.equal(run.collector.productionRecognition, 'server');
assert.equal(run.samples[0].recognized, 'x^(2)');
assert.equal(run.samples[0].authority, 'auto');
assert.equal(run.samples[0].reader, 'server');
assert.equal(run.samples[0].recognitionMs, 1840.25);
assert.equal(run.samples[0].strokes[0].points[0].p, 0.5);
assert.deepEqual(BUILD_KINDS, ['development', 'testflight']);
assert.deepEqual(SERVERS, ['staging', 'production']);
assert.equal(buildPhysicalEvidenceRun({ ...meta, buildKind: 'nonsense', server: 'nonsense' }, [sample]).build.kind, 'development', 'an unknown build kind is recorded as the default, never invented');
assert.equal(buildPhysicalEvidenceRun({ ...meta, buildKind: 'testflight', server: 'production' }, [sample]).build.server, 'production');
// The scorer accepts exactly this schema (the scorer's own check proves it bites).
assert.match(scorer, /export const PHYSICAL_EVIDENCE_SCHEMA_VERSION = 2;/);
assert.match(scorer, /serverReadP95Ms: 4000/);
assert.ok(!/recognitionP95Ms: 500/.test(scorer), 'the retired 500 ms on-device target is gone from the scorer');

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

// ── the route: the real InkAnswer, the real read, nothing of its own ─────────
assert.match(practice, /params\.get\('inkEvidence'\) === '1'/);
assert.match(practice, /React\.lazy\(\(\) => import\('\.\.\/components\/InkPhysicalEvidenceSession\.jsx'\)\)/);
assert.match(page, /nativeInkAvailable\(\)/);
assert.match(page, /productionAuthorityOf\(reading, \{ nativeAvailable \}\)/);
assert.match(page, /Number\.isFinite\(reading\?\.readMs\)/, 'the recorded time is the read InkAnswer measured');
assert.match(page, /reader: 'server'/);
assert.match(page, /strokes: cloneStrokes\(latest\.strokes\)/);
assert.match(page, /buildCorpusFromPhysicalRun/);
assert.match(page, /\.ink-syms,.ink-evidence-session \.ink-picker\{display:none!important\}/);
assert.ok(!/nativeInk\.(recognize|foundationRecognize)|performance\.now/.test(page), 'the route times no reader of its own and calls none');
assert.ok(!/recognitionContext=\{?prompt|expectedAnswer|markScheme/.test(page), 'ground truth must never be passed into recognition context');
// InkAnswer measures the one read it makes, around readWithCloud, and publishes it.
assert.match(inkAnswer, /const pressedAt = [\s\S]{0,400}readWithCloud\(strokes, \{ user: who, signal: controller\?\.signal, freshReadiness: true \}\)/, 'the timer starts at the press, around the one readWithCloud call');
assert.match(inkAnswer, /publish\(landed, now, \{ stale: nowSignature !== signature, readMs: sincePress\(\) \}\)/, 'a fresh server read is published with its round trip');
assert.match(inkAnswer, /readMs: Number\.isFinite\(readMs\) \? Math\.max\(0, readMs\) : null/, 'every other publish carries readMs null');
assert.equal((inkAnswer.match(/readMs: sincePress\(\)/g) || []).length, 1, 'only the landing of a fresh read is timed');

console.log(`PASS — ${REAL_PENCIL_PROMPTS.length} prompts, server-reader authority, measured round trip, schema-2 export, raw PencilKit export and deterministic split contract verified\n`);
