#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTROL_FILE = path.join(ROOT, '.pri-os', 'mission-control.json');
const FLEET_FILE = path.join(ROOT, '.pri-os', 'fleet.json');

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

const control = readJson(CONTROL_FILE);
const fleet = readJson(FLEET_FILE);
const agents = new Set(fleet.agents.map(agent => agent.id));
const risks = new Set(Object.keys(fleet.risk_classes || {}));
const gateIds = new Set(Object.keys(fleet.gates || {}));

function validateControl() {
  const errors = [];
  if (control.version !== 1) errors.push('mission-control.version must be 1');
  if (control.ledger?.backend !== 'github_issues') errors.push('ledger.backend must be github_issues');
  if (!control.lease?.single_active_writer) errors.push('single_active_writer must remain true');
  if (!Number.isInteger(control.lease?.ttl_hours) || control.lease.ttl_hours <= 0) errors.push('lease.ttl_hours must be positive');
  if (!Number.isInteger(control.retry_policy?.max_identical_failure_attempts) || control.retry_policy.max_identical_failure_attempts < 1) errors.push('max_identical_failure_attempts must be positive');
  if (!Array.isArray(control.states) || !control.states.includes('ACTIVE') || !control.states.includes('DONE')) errors.push('required mission states missing');
  for (const state of control.states || []) {
    if (!Array.isArray(control.transitions?.[state])) errors.push(`missing transitions for ${state}`);
    for (const target of control.transitions?.[state] || []) {
      if (!control.states.includes(target)) errors.push(`${state}: unknown transition target ${target}`);
    }
  }
  return errors;
}

function requireRange(value, field) {
  if (!Number.isFinite(value) || value < control.priority.ranges.min || value > control.priority.ranges.max) {
    throw new Error(`${field} must be between ${control.priority.ranges.min} and ${control.priority.ranges.max}`);
  }
}

function scoreCandidate(candidate) {
  const fields = ['severity','student_impact','unblock_value','recurrence','strategic_value','diagnosis_confidence','effort','regression_risk'];
  for (const field of fields) requireRange(Number(candidate[field]), field);
  const categoryIndex = control.priority.preemption_order.indexOf(candidate.category || 'normal');
  if (categoryIndex < 0) throw new Error(`unknown category '${candidate.category}'`);
  let score = 0;
  for (const [field, weight] of Object.entries(control.priority.weights)) score += Number(candidate[field]) * weight;
  return {
    ...candidate,
    category_rank: categoryIndex,
    score
  };
}

function rank(candidates) {
  return candidates
    .map(scoreCandidate)
    .sort((a, b) =>
      a.category_rank - b.category_rank ||
      b.score - a.score ||
      String(a.id).localeCompare(String(b.id))
    );
}

function validateRecord(record) {
  const errors = [];
  const required = ['id','status','agent','branch','risk','base_sha','attempt','acceptance','required_gate_ids','updated_at'];
  for (const field of required) {
    if (record[field] === undefined || record[field] === null || record[field] === '') errors.push(`missing ${field}`);
  }
  if (!control.states.includes(record.status)) errors.push(`invalid status ${record.status}`);
  if (!agents.has(record.agent)) errors.push(`unknown agent ${record.agent}`);
  if (record.agent === 'director') errors.push('director cannot hold a write mission');
  if (!risks.has(record.risk)) errors.push(`invalid risk ${record.risk}`);
  if (!/^[0-9a-f]{7,40}$/i.test(String(record.base_sha || ''))) errors.push('base_sha must be a git SHA');
  if (!Number.isInteger(record.attempt) || record.attempt < 0) errors.push('attempt must be a non-negative integer');
  if (!Array.isArray(record.acceptance) || record.acceptance.length === 0) errors.push('acceptance must be a non-empty array');
  if (!Array.isArray(record.required_gate_ids) || record.required_gate_ids.length === 0) errors.push('required_gate_ids must be a non-empty array');
  for (const gateId of record.required_gate_ids || []) {
    if (!gateIds.has(gateId)) errors.push(`unknown gate ${gateId}`);
  }
  if (Number.isNaN(Date.parse(record.updated_at))) errors.push('updated_at must be ISO date-time');
  if (record.failure_fingerprint && !/^[0-9a-f]{64}$/i.test(record.failure_fingerprint)) errors.push('failure_fingerprint must be sha256');
  return errors;
}

function transition(record, next) {
  const errors = validateRecord(record);
  if (errors.length) throw new Error(`invalid record: ${errors.join('; ')}`);
  const allowed = control.transitions[record.status] || [];
  if (!allowed.includes(next)) throw new Error(`transition ${record.status} -> ${next} is not allowed`);
  return { ...record, status: next, updated_at: new Date().toISOString() };
}

function normalizedFingerprint(text) {
  const normalized = String(text)
    .replace(/\r/g, '')
    .replace(/\b\d+(?:\.\d+)?s\b/g, '<duration>')
    .replace(/\b\d{4}-\d{2}-\d{2}T[\d:.+-]+Z?\b/g, '<timestamp>')
    .replace(/[ \t]+/g, ' ')
    .trim();
  return createHash('sha256').update(normalized).digest('hex');
}

function leaseStatus(record, now = Date.now()) {
  const errors = validateRecord(record);
  if (errors.length) return { valid: false, reason: `invalid record: ${errors.join('; ')}` };
  if (!['ACTIVE','IMPLEMENTING','TESTING','REVIEW','CI','REPAIR','MERGE_READY'].includes(record.status)) {
    return { valid: false, reason: `state ${record.status} does not hold the writer lease` };
  }
  const ageMs = now - Date.parse(record.updated_at);
  const ttlMs = control.lease.ttl_hours * 60 * 60 * 1000;
  return {
    valid: ageMs >= 0 && ageMs <= ttlMs,
    age_minutes: Math.max(0, Math.round(ageMs / 60000)),
    ttl_minutes: control.lease.ttl_hours * 60,
    reason: ageMs > ttlMs ? 'lease expired' : 'lease active'
  };
}

function template(id, agent, risk, baseSha) {
  if (!id) throw new Error('template requires mission id');
  if (!agents.has(agent) || agent === 'director') throw new Error(`invalid write agent '${agent}'`);
  if (!risks.has(risk)) throw new Error(`invalid risk '${risk}'`);
  if (!/^[0-9a-f]{7,40}$/i.test(baseSha || '')) throw new Error('template requires base SHA');
  return {
    id,
    status: 'TRIAGED',
    agent,
    branch: `agent/mission/${agent}/${id}`,
    risk,
    base_sha: baseSha,
    attempt: 0,
    failure_fingerprint: null,
    acceptance: ['Replace with explicit, testable acceptance condition'],
    required_gate_ids: fleet.agents.find(item => item.id === agent).gate_ids,
    evidence: [],
    blockers: [],
    residual_risk: [],
    updated_at: new Date().toISOString()
  };
}

function usage() {
  console.log(`Pri Learning Mission Control\n\nCommands:\n  validate\n  rank <candidates.json>\n  validate-record <mission.json>\n  transition <mission.json> <next-state> [--write]\n  fingerprint <text-file>\n  lease-status <mission.json>\n  template <id> <agent> <risk> <base-sha>`);
}

const [command = 'validate', ...args] = process.argv.slice(2);

if (command === 'validate') {
  const errors = validateControl();
  if (errors.length) {
    for (const error of errors) console.error(`ERROR: ${error}`);
    process.exit(1);
  }
  console.log(`PASS: mission control has ${control.states.length} states, ${control.lease.ttl_hours}h leases and retry ceiling ${control.retry_policy.max_identical_failure_attempts}.`);
} else if (command === 'rank') {
  const file = args[0];
  if (!file) throw new Error('rank requires candidates.json');
  const candidates = readJson(path.resolve(file));
  if (!Array.isArray(candidates) || candidates.length === 0) throw new Error('candidate file must contain a non-empty array');
  console.log(JSON.stringify(rank(candidates), null, 2));
} else if (command === 'validate-record') {
  const record = readJson(path.resolve(args[0]));
  const errors = validateRecord(record);
  if (errors.length) {
    for (const error of errors) console.error(`ERROR: ${error}`);
    process.exit(1);
  }
  console.log(`PASS: mission ${record.id} (${record.status}, ${record.agent}, ${record.risk})`);
} else if (command === 'transition') {
  const file = path.resolve(args[0]);
  const next = args[1];
  if (!next) throw new Error('transition requires a target state');
  const updated = transition(readJson(file), next);
  if (args.includes('--write')) {
    writeFileSync(file, `${JSON.stringify(updated, null, 2)}\n`);
    console.log(`PASS: wrote ${updated.status} to ${file}`);
  } else {
    console.log(JSON.stringify(updated, null, 2));
  }
} else if (command === 'fingerprint') {
  const file = args[0];
  if (!file) throw new Error('fingerprint requires a text file');
  console.log(normalizedFingerprint(readFileSync(path.resolve(file), 'utf8')));
} else if (command === 'lease-status') {
  const record = readJson(path.resolve(args[0]));
  const result = leaseStatus(record);
  console.log(JSON.stringify(result, null, 2));
  if (!result.valid) process.exitCode = 1;
} else if (command === 'template') {
  console.log(JSON.stringify(template(args[0], args[1], args[2], args[3]), null, 2));
} else {
  usage();
  process.exitCode = 2;
}
