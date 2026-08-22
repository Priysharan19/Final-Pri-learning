#!/usr/bin/env node
import fs from 'node:fs';
import process from 'node:process';
import { validateWriterSplit } from '../v12/writer_split_audit.js';

export const SPLITS = new Set(['train', 'validation', 'calibration', 'test', 'final-holdout']);
const CAPTURE_MODES = new Set(['pencil', 'finger', 'imported']);
const CONSENT = new Set(['training', 'validation', 'benchmark', 'local-debug']);

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function allowedConsent(record) {
  const raw = Array.isArray(record.consent_scope) ? record.consent_scope : [record.consent_scope];
  return raw.filter(Boolean);
}

export function validateRealManifest(records, { requirePencil = false } = {}) {
  const errors = [];
  const warnings = [];
  const sampleIds = new Set();
  const sessions = new Map();
  const inkHashes = new Map();
  const splitCounts = Object.fromEntries([...SPLITS].map(split => [split, 0]));
  const writerIds = new Set();

  if (!Array.isArray(records) || records.length === 0) {
    return { valid: false, errors: ['no real-writer samples supplied'], warnings, splitCounts, writers: 0 };
  }

  records.forEach((record, index) => {
    const at = `record ${index + 1}`;
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      errors.push(`${at}: must be an object`);
      return;
    }

    for (const field of ['sample_id', 'writer_id', 'session_id', 'split', 'collection_device', 'capture_mode', 'timestamp_bucket', 'expression_id', 'target']) {
      if (!nonEmpty(record[field])) errors.push(`${at}: missing ${field}`);
    }

    if (nonEmpty(record.sample_id)) {
      if (sampleIds.has(record.sample_id)) errors.push(`${at}: duplicate sample_id ${record.sample_id}`);
      sampleIds.add(record.sample_id);
    }

    if (nonEmpty(record.writer_id)) writerIds.add(record.writer_id);

    if (!SPLITS.has(record.split)) {
      errors.push(`${at}: invalid split ${JSON.stringify(record.split)}`);
    } else {
      splitCounts[record.split] += 1;
    }

    if (!CAPTURE_MODES.has(record.capture_mode)) {
      errors.push(`${at}: invalid capture_mode ${JSON.stringify(record.capture_mode)}`);
    }
    if (requirePencil && record.capture_mode !== 'pencil') {
      errors.push(`${at}: physical Apple Pencil benchmark requires capture_mode=pencil`);
    }

    const scopes = allowedConsent(record);
    if (!scopes.length) errors.push(`${at}: missing consent_scope`);
    for (const scope of scopes) {
      if (!CONSENT.has(scope)) errors.push(`${at}: unknown consent scope ${JSON.stringify(scope)}`);
    }
    const needsTraining = record.split === 'train';
    const needsBenchmark = ['validation', 'calibration', 'test', 'final-holdout'].includes(record.split);
    if (needsTraining && !scopes.includes('training')) errors.push(`${at}: train sample is not consented for training`);
    if (needsBenchmark && !scopes.includes('benchmark') && !scopes.includes('validation')) {
      errors.push(`${at}: ${record.split} sample is not consented for validation/benchmark use`);
    }

    if (nonEmpty(record.session_id) && SPLITS.has(record.split)) {
      const previous = sessions.get(record.session_id);
      if (previous && previous !== record.split) errors.push(`${at}: session leakage ${record.session_id}: ${previous} -> ${record.split}`);
      sessions.set(record.session_id, record.split);
    }

    if (nonEmpty(record.ink_hash)) {
      const previous = inkHashes.get(record.ink_hash);
      if (previous && previous !== record.sample_id) errors.push(`${at}: duplicate ink_hash also used by ${previous}`);
      inkHashes.set(record.ink_hash, record.sample_id);
    } else {
      warnings.push(`${at}: no ink_hash; exact duplicate-ink leakage cannot be checked`);
    }
  });

  try {
    const split = validateWriterSplit(records);
    if (!split.valid) errors.push(split.reason);
  } catch (error) {
    errors.push(`writer split audit failed: ${error.message}`);
  }

  for (const split of ['validation', 'calibration', 'test', 'final-holdout']) {
    if (splitCounts[split] === 0) warnings.push(`${split}: no samples recorded`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    samples: records.length,
    writers: writerIds.size,
    splitCounts
  };
}

function parseJsonl(text, file) {
  const records = [];
  text.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return;
    try {
      records.push(JSON.parse(line));
    } catch (error) {
      throw new Error(`${file}:${index + 1}: invalid JSON (${error.message})`);
    }
  });
  return records;
}

const launched = process.argv[1] && new URL(`file://${process.argv[1]}`).href === import.meta.url;
if (launched) {
  const args = process.argv.slice(2);
  const requirePencil = args.includes('--require-pencil');
  const file = args.find(arg => !arg.startsWith('--'));
  if (!file) {
    console.error('Usage: node handwriting/inknet/validate_real_manifest.mjs <manifest.jsonl> [--require-pencil]');
    process.exit(2);
  }

  let records;
  try {
    records = parseJsonl(fs.readFileSync(file, 'utf8'), file);
  } catch (error) {
    console.error(`REAL WRITER MANIFEST — FAIL: ${error.message}`);
    process.exit(1);
  }

  const result = validateRealManifest(records, { requirePencil });
  for (const warning of result.warnings) console.warn(`WARNING: ${warning}`);
  for (const error of result.errors) console.error(`ERROR: ${error}`);
  console.log(`REAL WRITER MANIFEST — ${result.valid ? 'PASS' : 'FAIL'}: ${result.samples} samples, ${result.writers} writers; ${Object.entries(result.splitCounts).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  process.exit(result.valid ? 0 : 1);
}
