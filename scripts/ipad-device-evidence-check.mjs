#!/usr/bin/env node
/**
 * Pri Learning — physical iPad evidence gate.
 *
 * This script does not manufacture device evidence. It validates result files
 * recorded after running the protocol in ios/device-evidence/README.md on a
 * physical iPad. With no corpus it reports NOT MEASURED; --strict turns that
 * into a failing release gate.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const strict = process.argv.includes('--strict');
const root = path.resolve('ios/device-evidence/results');

const REQUIRED_CASES = [
  'LAUNCH-001',
  'PENCIL-001',
  'PENCIL-002',
  'PENCIL-003',
  'INK-ALIGN-001',
  'INK-ROTATE-001',
  'OFFLINE-001',
  'LIFECYCLE-001',
  'PERSIST-001',
  'BACKUP-001',
  'EXAM-001',
  'SHARE-001'
];

const errors = [];
const warnings = [];

function fail(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readResult(file) {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`${file}: invalid JSON (${error.message})`);
    return null;
  }

  const label = path.basename(file);
  if (parsed.schemaVersion !== 1) fail(`${label}: schemaVersion must be 1`);
  if (parsed.physicalHardware !== true) fail(`${label}: physicalHardware must be true`);
  if (typeof parsed.testRunId !== 'string' || !parsed.testRunId.trim()) fail(`${label}: missing testRunId`);
  if (typeof parsed.recordedAt !== 'string' || Number.isNaN(Date.parse(parsed.recordedAt))) fail(`${label}: recordedAt must be an ISO timestamp`);
  if (typeof parsed.testerId !== 'string' || !parsed.testerId.trim()) fail(`${label}: testerId must be a non-empty anonymised identifier`);

  if (!isObject(parsed.build)) {
    fail(`${label}: missing build object`);
  } else {
    if (!/^[0-9a-f]{7,40}$/i.test(parsed.build.commit ?? '')) fail(`${label}: build.commit must be a Git commit SHA`);
    if (typeof parsed.build.appVersion !== 'string' || !parsed.build.appVersion.trim()) fail(`${label}: missing build.appVersion`);
  }

  if (!isObject(parsed.device)) {
    fail(`${label}: missing device object`);
  } else {
    for (const key of ['model', 'osVersion', 'pencil']) {
      if (typeof parsed.device[key] !== 'string' || !parsed.device[key].trim()) fail(`${label}: missing device.${key}`);
    }
    const hardwareText = `${parsed.device.model ?? ''} ${parsed.device.pencil ?? ''}`.toLowerCase();
    if (hardwareText.includes('simulator')) fail(`${label}: simulator evidence cannot be recorded as physical evidence`);
  }

  if (!Array.isArray(parsed.cases)) {
    fail(`${label}: cases must be an array`);
    return parsed;
  }

  const seen = new Set();
  for (const entry of parsed.cases) {
    if (!isObject(entry)) {
      fail(`${label}: each case must be an object`);
      continue;
    }
    const id = entry.id;
    if (typeof id !== 'string' || !id.trim()) {
      fail(`${label}: case with missing id`);
      continue;
    }
    if (seen.has(id)) fail(`${label}: duplicate case ${id}`);
    seen.add(id);
    if (!['pass', 'fail', 'blocked', 'not-run'].includes(entry.status)) {
      fail(`${label}: ${id} has invalid status ${JSON.stringify(entry.status)}`);
    }
    if (entry.status === 'fail' && (typeof entry.notes !== 'string' || !entry.notes.trim())) {
      fail(`${label}: failed case ${id} requires notes`);
    }
  }

  for (const id of REQUIRED_CASES) {
    if (!seen.has(id)) fail(`${label}: missing required case ${id}`);
  }

  const criticalFailures = parsed.cases.filter(entry => REQUIRED_CASES.includes(entry?.id) && entry?.status === 'fail');
  const incompleteCritical = parsed.cases.filter(entry => REQUIRED_CASES.includes(entry?.id) && ['blocked', 'not-run'].includes(entry?.status));
  if (criticalFailures.length) fail(`${label}: ${criticalFailures.length} critical case(s) failed`);
  if (incompleteCritical.length) warn(`${label}: ${incompleteCritical.length} critical case(s) are blocked/not-run`);

  return parsed;
}

let files = [];
if (fs.existsSync(root)) {
  files = fs.readdirSync(root)
    .filter(name => name.endsWith('.json') && !name.startsWith('.'))
    .map(name => path.join(root, name))
    .sort();
}

if (!files.length) {
  const message = 'IPAD DEVICE EVIDENCE — NOT MEASURED: no physical iPad result files recorded.';
  console.log(message);
  console.log('Run ios/device-evidence/README.md on physical hardware and save JSON results under ios/device-evidence/results/.');
  process.exit(strict ? 1 : 0);
}

const results = files.map(readResult).filter(Boolean);
const caseRows = results.flatMap(result => Array.isArray(result.cases) ? result.cases : []);
const passed = caseRows.filter(entry => entry.status === 'pass').length;
const failed = caseRows.filter(entry => entry.status === 'fail').length;
const incomplete = caseRows.filter(entry => ['blocked', 'not-run'].includes(entry.status)).length;
const devices = new Set(results.map(result => `${result.device?.model ?? '?'} / iPadOS ${result.device?.osVersion ?? '?'} / ${result.device?.pencil ?? '?'}`));

for (const warning of warnings) console.warn(`WARNING: ${warning}`);
for (const error of errors) console.error(`ERROR: ${error}`);

console.log(`IPAD DEVICE EVIDENCE — ${errors.length ? 'FAIL' : 'PASS'}: ${results.length} physical run(s), ${devices.size} device configuration(s), ${passed} passed, ${failed} failed, ${incomplete} blocked/not-run.`);
for (const device of devices) console.log(`  • ${device}`);

if (strict && incomplete) {
  console.error('ERROR: strict mode requires every required physical-device case to be completed.');
  process.exit(1);
}
process.exit(errors.length ? 1 : 0);
