#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { REAL_PENCIL_PROMPTS } from '../client/src/ink/productionEvidence.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLAN_PATH = path.join(ROOT, 'handwriting/v12/PHYSICAL_STUDY_PLAN.json');
const EVIDENCE_DIR = path.join(ROOT, 'handwriting/v12/evidence/physical');
const splitArg = process.argv.indexOf('--split');
const split = splitArg >= 0 ? process.argv[splitArg + 1] : 'test';
const validSplits = new Set(['train', 'validation', 'test', 'final-holdout']);
if (!validSplits.has(split)) throw new Error(`invalid --split ${split}`);

const plan = JSON.parse(fs.readFileSync(PLAN_PATH, 'utf8'));
const planned = plan.participants.filter(p => p.split === split);
const plannedIds = new Set(planned.map(p => p.writerId));
const files = fs.existsSync(EVIDENCE_DIR)
  ? fs.readdirSync(EVIDENCE_DIR).filter(name => name.endsWith('.json')).sort()
  : [];

const runs = [];
const invalid = [];
for (const name of files) {
  try {
    const value = JSON.parse(fs.readFileSync(path.join(EVIDENCE_DIR, name), 'utf8'));
    if (value?.schemaVersion !== 1 || value?.physicalHardware !== true || !value?.writer?.id) continue;
    runs.push({ name, value });
  } catch (error) {
    invalid.push(`${name}: ${error.message}`);
  }
}

const selected = runs.filter(({ value }) => value.writer?.split === split);
const writers = new Map();
const devices = new Set();
let expressions = 0;
let auto = 0;
let confirm = 0;
let abstain = 0;
for (const { name, value } of selected) {
  const id = String(value.writer.id).toUpperCase();
  if (!writers.has(id)) writers.set(id, []);
  writers.get(id).push(name);
  if (value.device?.model) devices.add(String(value.device.model));
  for (const sample of Array.isArray(value.samples) ? value.samples : []) {
    expressions += 1;
    if (sample.authority === 'auto') auto += 1;
    else if (sample.authority === 'confirm') confirm += 1;
    else if (sample.authority === 'abstain') abstain += 1;
  }
}

const missing = planned.filter(p => !writers.has(p.writerId));
const unexpected = [...writers.keys()].filter(id => !plannedIds.has(id));
const capacity = planned.length * REAL_PENCIL_PROMPTS.length;
const completion = capacity ? (100 * expressions / capacity) : 0;

console.log(`Pri Ink physical study status — ${split}`);
console.log(`planned writers: ${planned.length}`);
console.log(`collected writers: ${writers.size}`);
console.log(`expressions: ${expressions}/${capacity} (${completion.toFixed(1)}% of planned capacity)`);
console.log(`authority: auto ${auto}, confirm ${confirm}, abstain ${abstain}`);
console.log(`physical iPad model classes observed: ${devices.size}${devices.size ? ` (${[...devices].join(' | ')})` : ''}`);
if (missing.length) console.log(`missing writers: ${missing.map(p => `${p.writerId}[${p.deviceSlot}]`).join(', ')}`);
if (unexpected.length) console.log(`WARNING unplanned writer ids: ${unexpected.join(', ')}`);
if (invalid.length) console.log(`WARNING invalid JSON: ${invalid.join(' ; ')}`);

if (!selected.length) {
  console.log('\nNOT MEASURED — no physical production evidence exists for this split yet.');
  console.log('Collect on a physical iPad at /practice?inkEvidence=1 and export the release-evidence JSON.');
} else {
  console.log('\nRun the authoritative scorer for accuracy, safe-auto precision and latency:');
  console.log(`node client/test/ink-physical-release-evidence.mjs --strict --split ${split}`);
}
