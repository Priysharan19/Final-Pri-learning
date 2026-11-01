// Regression check for the physical Apple Pencil evidence gate (server reader).
//
// Every fixture here is SYNTHETIC: it exists only to prove the scorer refuses
// what it must refuse and passes what it must pass. Nothing it writes is
// evidence and nothing lands under handwriting/.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(HERE, 'ink-physical-release-evidence.mjs');

function run(dir, extra = []) {
  return spawnSync(process.execPath, [SCRIPT, '--dir', dir, ...extra], {
    encoding: 'utf8',
    env: { ...process.env }
  });
}

function makeRun(writerIndex, { wrong = new Set(), latency = global => 900 + (global % 2500), engine = 'cloud-fixture-reader', sample = s => s, run = r => r } = {}) {
  const samples = [];
  for (let i = 0; i < 50; i++) {
    const global = writerIndex * 50 + i;
    const critical = global < 240;
    const target = critical ? `x^2=${global + 1}` : `x=${global + 1}`;
    samples.push(sample({
      id: `s${global}`,
      target,
      recognized: wrong.has(global) ? `${target}9` : target,
      authority: 'auto',
      pencil: true,
      reader: 'server',
      recognitionMs: latency(global),
      engine,
      productionReady: true,
      critical
    }, global));
  }
  return run({
    schemaVersion: 2,
    physicalHardware: true,
    reader: 'server',
    runId: `run-${writerIndex}`,
    recordedAt: '2026-11-02T00:00:00Z',
    build: { commit: '0123456789abcdef0123456789abcdef01234567', appVersion: 'test' },
    device: {
      model: writerIndex % 2 ? 'iPad Air test class' : 'iPad Pro test class',
      osVersion: 'test',
      pencil: 'Apple Pencil test fixture'
    },
    writer: { id: `P${String(writerIndex).padStart(4, '0')}`, split: 'test' },
    samples
  });
}

function writeCorpus(dir, options = {}) {
  fs.mkdirSync(dir, { recursive: true });
  for (let w = 0; w < 20; w++) {
    fs.writeFileSync(path.join(dir, `writer-${w}.json`), JSON.stringify(makeRun(w, options), null, 2));
  }
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pri-physical-evidence-'));
try {
  const empty = path.join(root, 'empty');
  fs.mkdirSync(empty);
  const emptyStrict = run(empty, ['--strict']);
  assert.notEqual(emptyStrict.status, 0, 'strict mode must fail with no physical evidence');
  assert.match(emptyStrict.stdout, /NOT MEASURED/);

  const passing = path.join(root, 'passing');
  writeCorpus(passing);
  const good = run(passing, ['--strict']);
  assert.equal(good.status, 0, `${good.stdout}\n${good.stderr}`);
  assert.match(good.stdout, /server reader · test/);
  assert.match(good.stdout, /writers: 20/);
  assert.match(good.stdout, /expressions: 1000/);
  assert.match(good.stdout, /server read p95: \d+\.\d ms/);
  assert.match(good.stdout, /PHYSICAL RELEASE EVIDENCE — PASS/);

  const unsafe = path.join(root, 'unsafe-auto');
  writeCorpus(unsafe, { wrong: new Set([0, 1]) });
  const bad = run(unsafe, ['--strict']);
  assert.notEqual(bad.status, 0, 'two wrong auto-marks in 1000 must fail the 99.9% precision floor');
  assert.match(bad.stdout, /auto-mark precision/i);

  // Mutation: the latency floor is real. A corpus whose 95th percentile server
  // read is above 4 000 ms fails strict mode and names the floor; the same
  // corpus with every read at 3 999 ms passes. (The retired 500 ms on-device
  // target is gone: a network reader at 900–3 400 ms passes above.)
  const slow = path.join(root, 'slow');
  writeCorpus(slow, { latency: global => (global % 10 === 0 ? 6500 : 1200) });
  const slowRun = run(slow, ['--strict']);
  assert.notEqual(slowRun.status, 0, 'a p95 server read above 4000 ms must fail strict mode');
  assert.match(slowRun.stdout, /server read p95 \d+\.\d ms > 4000 ms/);
  const edge = path.join(root, 'edge');
  writeCorpus(edge, { latency: () => 3999 });
  assert.equal(run(edge, ['--strict']).status, 0, 'a p95 of 3999 ms is inside the floor');

  // Retired readers are refused even in non-strict validation: their evidence
  // describes a reader no student reaches.
  const retired = path.join(root, 'retired');
  writeCorpus(retired, { engine: 'pri-consensus:pri-foundation+native-rescue' });
  const retiredRun = run(retired);
  assert.notEqual(retiredRun.status, 0, 'on-device consensus evidence must be refused');
  assert.match(retiredRun.stdout, /retired on-device reader/);
  const vision = path.join(root, 'vision');
  writeCorpus(vision, { engine: 'apple-vision-photo-v1' });
  assert.match(run(vision).stdout, /retired on-device reader/);
  const unlabelled = path.join(root, 'unlabelled');
  writeCorpus(unlabelled, { engine: 'something-else' });
  assert.match(run(unlabelled).stdout, /not a server-reader label/);

  // Schema version 1 (the on-device schema) is not accepted.
  const v1 = path.join(root, 'v1');
  writeCorpus(v1, { run: r => ({ ...r, schemaVersion: 1 }) });
  const v1Run = run(v1);
  assert.notEqual(v1Run.status, 0, 'schemaVersion 1 files are refused');
  assert.match(v1Run.stdout, /schemaVersion must be 2/);

  // A sample that forgot to say which reader it used is refused.
  const noReader = path.join(root, 'no-reader');
  writeCorpus(noReader, { sample: s => { const { reader, ...rest } = s; return rest; } });
  assert.match(run(noReader).stdout, /reader must be "server"/);

  const leaking = path.join(root, 'leaking');
  writeCorpus(leaking);
  const file = path.join(leaking, 'writer-19.json');
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  raw.writer.id = 'P0000';
  raw.writer.split = 'validation';
  fs.writeFileSync(file, JSON.stringify(raw, null, 2));
  const leak = run(leaking);
  assert.notEqual(leak.status, 0, 'writer leakage must fail even in non-strict validation mode');
  assert.match(leak.stdout, /leaks across splits/i);

  console.log('INK PHYSICAL RELEASE EVIDENCE VALIDATOR — PASS (server-reader schema 2, 4 s server-read p95 floor, retired readers refused)');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
