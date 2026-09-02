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

function makeRun(writerIndex, { wrong = new Set() } = {}) {
  const samples = [];
  for (let i = 0; i < 50; i++) {
    const global = writerIndex * 50 + i;
    const critical = global < 240;
    const target = critical ? `x^2=${global + 1}` : `x=${global + 1}`;
    samples.push({
      id: `s${global}`,
      target,
      recognized: wrong.has(global) ? `${target}9` : target,
      authority: 'auto',
      pencil: true,
      recognitionMs: 120 + (global % 250),
      engine: 'pri-consensus:fixture-a+fixture-b',
      productionReady: true,
      critical
    });
  }
  return {
    schemaVersion: 1,
    physicalHardware: true,
    runId: `run-${writerIndex}`,
    recordedAt: '2026-09-02T00:00:00Z',
    build: { commit: '0123456789abcdef0123456789abcdef01234567', appVersion: 'test' },
    device: {
      model: writerIndex % 2 ? 'iPad Air test class' : 'iPad Pro test class',
      osVersion: 'test',
      pencil: 'Apple Pencil test fixture'
    },
    writer: { id: `P${String(writerIndex).padStart(4, '0')}`, split: 'test' },
    samples
  };
}

function writeCorpus(dir, wrong = new Set()) {
  fs.mkdirSync(dir, { recursive: true });
  for (let w = 0; w < 20; w++) {
    fs.writeFileSync(path.join(dir, `writer-${w}.json`), JSON.stringify(makeRun(w, { wrong }), null, 2));
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
  assert.match(good.stdout, /writers: 20/);
  assert.match(good.stdout, /expressions: 1000/);
  assert.match(good.stdout, /PHYSICAL RELEASE EVIDENCE — PASS/);

  const unsafe = path.join(root, 'unsafe-auto');
  writeCorpus(unsafe, new Set([0, 1]));
  const bad = run(unsafe, ['--strict']);
  assert.notEqual(bad.status, 0, 'two wrong auto-marks in 1000 must fail the 99.9% precision floor');
  assert.match(bad.stdout, /auto-mark precision/i);

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

  console.log('INK PHYSICAL RELEASE EVIDENCE VALIDATOR — PASS');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
