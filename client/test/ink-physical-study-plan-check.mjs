#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  REAL_PENCIL_PROMPTS,
  assignedEvidenceSplit,
  criticalEvidenceTarget
} from '../src/ink/productionEvidence.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLAN_PATH = path.resolve(HERE, '../../handwriting/v12/PHYSICAL_STUDY_PLAN.json');
const plan = JSON.parse(fs.readFileSync(PLAN_PATH, 'utf8'));
const fail = message => { throw new Error(message); };

if (plan.schemaVersion !== 1) fail('study plan schemaVersion must be 1');
if (!Array.isArray(plan.participants) || !plan.participants.length) fail('study plan has no participants');

const seen = new Set();
const counts = { train: 0, validation: 0, test: 0, 'final-holdout': 0 };
const testSlots = new Map();
for (const participant of plan.participants) {
  const id = String(participant.writerId || '').toUpperCase();
  if (!/^P\d{4}$/.test(id)) fail(`invalid anonymous writer code: ${id || '<empty>'}`);
  if (seen.has(id)) fail(`duplicate writer code: ${id}`);
  seen.add(id);
  if (!(participant.split in counts)) fail(`invalid split for ${id}: ${participant.split}`);
  const assigned = assignedEvidenceSplit(id);
  if (assigned !== participant.split) fail(`${id} assigned to ${assigned}, plan says ${participant.split}`);
  counts[participant.split] += 1;
  if (!['A', 'B'].includes(participant.deviceSlot)) fail(`${id} requires deviceSlot A or B`);
  if (participant.split === 'test') {
    testSlots.set(participant.deviceSlot, (testSlots.get(participant.deviceSlot) || 0) + 1);
  }
  if (participant.split === 'final-holdout' && participant.inspection !== 'locked-until-release') {
    fail(`${id} final holdout must remain locked-until-release`);
  }
}

const minimums = plan.minimums || {};
const required = {
  train: Number(minimums.trainWriters || 12),
  validation: Number(minimums.validationWriters || 6),
  test: Number(minimums.testWriters || 24),
  'final-holdout': Number(minimums.finalHoldoutWriters || 6)
};
for (const [split, floor] of Object.entries(required)) {
  if (counts[split] < floor) fail(`${split}: ${counts[split]} writers < planned floor ${floor}`);
}
if (testSlots.size < Number(minimums.testDeviceSlots || 2)) fail('test plan does not cover two device slots');
for (const [slot, count] of testSlots) {
  if (count < 10) fail(`test device slot ${slot} has only ${count} writers; keep meaningful hardware balance`);
}

const prompts = REAL_PENCIL_PROMPTS.length;
const criticalPrompts = REAL_PENCIL_PROMPTS.filter(p => criticalEvidenceTarget(p.target)).length;
const projectedTestExpressions = counts.test * prompts;
const projectedCritical = counts.test * criticalPrompts;
if (projectedTestExpressions < 1400) fail(`test capacity ${projectedTestExpressions} is too close to the 1000-expression floor`);
if (projectedCritical < 200) fail(`critical-structure capacity ${projectedCritical} < 200`);

console.log('PASS — Pri Ink physical study plan');
console.log(`writers: train ${counts.train}, validation ${counts.validation}, test ${counts.test}, final-holdout ${counts['final-holdout']}`);
console.log(`prompt protocol: ${prompts} prompts/writer (${criticalPrompts} critical)`);
console.log(`test capacity: ${projectedTestExpressions} expressions, ${projectedCritical} critical expressions`);
console.log(`test device slots: ${[...testSlots.entries()].map(([slot, count]) => `${slot}=${count}`).join(', ')}`);
