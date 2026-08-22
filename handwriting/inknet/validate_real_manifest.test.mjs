import assert from 'node:assert/strict';
import { validateRealManifest } from './validate_real_manifest.mjs';

const base = (overrides = {}) => ({
  sample_id: 's1',
  writer_id: 'w1',
  session_id: 'session-1',
  split: 'train',
  collection_device: 'iPad Air',
  capture_mode: 'pencil',
  timestamp_bucket: '2026-08',
  expression_id: 'expr-1',
  target: 'x^2+1',
  consent_scope: ['training', 'benchmark'],
  ink_hash: 'hash-1',
  ...overrides
});

const valid = [
  base(),
  base({ sample_id: 's2', writer_id: 'w2', session_id: 'session-2', split: 'validation', expression_id: 'expr-2', ink_hash: 'hash-2', consent_scope: ['benchmark'] }),
  base({ sample_id: 's3', writer_id: 'w3', session_id: 'session-3', split: 'calibration', expression_id: 'expr-3', ink_hash: 'hash-3', consent_scope: ['benchmark'] }),
  base({ sample_id: 's4', writer_id: 'w4', session_id: 'session-4', split: 'test', expression_id: 'expr-4', ink_hash: 'hash-4', consent_scope: ['benchmark'] }),
  base({ sample_id: 's5', writer_id: 'w5', session_id: 'session-5', split: 'final-holdout', expression_id: 'expr-5', ink_hash: 'hash-5', consent_scope: ['benchmark'] })
];

assert.equal(validateRealManifest(valid, { requirePencil: true }).valid, true, 'valid disjoint Pencil corpus should pass');

const writerLeak = structuredClone(valid);
writerLeak[1].writer_id = 'w1';
assert.equal(validateRealManifest(writerLeak).valid, false, 'writer overlap across splits must fail');

const sessionLeak = structuredClone(valid);
sessionLeak[1].session_id = 'session-1';
assert.equal(validateRealManifest(sessionLeak).valid, false, 'session overlap across splits must fail');

const duplicateInk = structuredClone(valid);
duplicateInk[1].ink_hash = 'hash-1';
assert.equal(validateRealManifest(duplicateInk).valid, false, 'duplicate ink under another sample id must fail');

const noTrainConsent = structuredClone(valid);
noTrainConsent[0].consent_scope = ['benchmark'];
assert.equal(validateRealManifest(noTrainConsent).valid, false, 'training sample without training consent must fail');

const fingerInPencilBenchmark = structuredClone(valid);
fingerInPencilBenchmark[4].capture_mode = 'finger';
assert.equal(validateRealManifest(fingerInPencilBenchmark, { requirePencil: true }).valid, false, 'real Pencil benchmark must reject finger samples');

console.log('REAL WRITER MANIFEST TESTS — PASS: 6/6');
