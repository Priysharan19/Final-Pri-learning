#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTROL_FILE = path.join(ROOT, '.pri-os', 'mission-control.json');
const FLEET_FILE = path.join(ROOT, '.pri-os', 'fleet.json');
const DERIVED_FILE = path.join(ROOT, '.pri-os', 'derived-artifacts.json');
const ACTIVE_STATES = new Set(['ACTIVE','IMPLEMENTING','TESTING','REVIEW','CI','REPAIR','MERGE_READY']);
const SERIAL_PATHS = [
  '.pri-os/', 'AGENTS.md', '.github/workflows/', 'package.json', 'package-lock.json',
  'client/package.json', 'client/package-lock.json', 'Dockerfile'
];
const SENSITIVE_CLASSES = [
  ['auth-session-profile', /(^|\/)(auth|session|profile)(\/|\.|-|$)|server\/platform\//i],
  ['migration-schema', /(^|\/)(migrations?|schema)(\/|\.|-|$)/i],
  ['math-marking', /^client\/src\/engine\//],
  ['handwriting-native', /^(client\/src\/ink\/|handwriting\/|ios\/)/]
];

function readJson(file) { return JSON.parse(readFileSync(file, 'utf8')); }
const control = readJson(CONTROL_FILE);
const fleet = readJson(FLEET_FILE);
const derived = readJson(DERIVED_FILE);
const agents = new Set(fleet.agents.map(agent => agent.id));
const risks = new Set(Object.keys(fleet.risk_classes || {}));
const gateIds = new Set(Object.keys(fleet.gates || {}));

function maxWriters() {
  const value = Number(control.lease?.max_writers);
  if (!Number.isInteger(value) || value < 1 || value > 2) return 1;
  return value;
}

function validateControl() {
  const errors = [];
  if (![1, 2].includes(control.version)) errors.push('mission-control.version must be 1 or 2');
  if (control.ledger?.backend !== 'github_issues') errors.push('ledger.backend must be github_issues');
  if (!control.ledger?.title_prefix) errors.push('ledger.title_prefix is required');
  if (!Number.isInteger(control.lease?.ttl_hours) || control.lease.ttl_hours <= 0) errors.push('lease.ttl_hours must be positive');
  if (control.version >= 2) {
    if (control.lease?.single_active_writer !== false) errors.push('version 2 requires bounded writer-pool semantics');
    if (!Number.isInteger(control.lease?.max_writers) || control.lease.max_writers < 1 || control.lease.max_writers > 2) errors.push('lease.max_writers must be 1..2');
    if (control.lease?.fallback_max_writers !== 1) errors.push('fallback_max_writers must remain 1');
  } else if (!control.lease?.single_active_writer) {
    errors.push('version 1 requires single_active_writer=true');
  }
  if (!Number.isInteger(control.retry_policy?.max_identical_failure_attempts) || control.retry_policy.max_identical_failure_attempts < 1) errors.push('max_identical_failure_attempts must be positive');
  if (!Array.isArray(control.states) || !control.states.includes('ACTIVE') || !control.states.includes('DONE')) errors.push('required mission states missing');
  for (const state of control.states || []) {
    if (!Array.isArray(control.transitions?.[state])) errors.push(`missing transitions for ${state}`);
    for (const target of control.transitions?.[state] || []) if (!control.states.includes(target)) errors.push(`${state}: unknown transition target ${target}`);
  }
  return errors;
}

function requireRange(value, field) {
  if (!Number.isFinite(value) || value < control.priority.ranges.min || value > control.priority.ranges.max) throw new Error(`${field} must be between ${control.priority.ranges.min} and ${control.priority.ranges.max}`);
}

function scoreCandidate(candidate) {
  const fields = ['severity','student_impact','unblock_value','recurrence','strategic_value','diagnosis_confidence','effort','regression_risk'];
  for (const field of fields) requireRange(Number(candidate[field]), field);
  const categoryIndex = control.priority.preemption_order.indexOf(candidate.category || 'normal');
  if (categoryIndex < 0) throw new Error(`unknown category '${candidate.category}'`);
  let score = 0;
  for (const [field, weight] of Object.entries(control.priority.weights)) score += Number(candidate[field]) * weight;
  return { ...candidate, category_rank: categoryIndex, score };
}

function rank(candidates) {
  return candidates.map(scoreCandidate).sort((a, b) => a.category_rank - b.category_rank || b.score - a.score || String(a.id).localeCompare(String(b.id)));
}

function validateRecord(record) {
  const errors = [];
  const required = ['id','status','agent','branch','risk','base_sha','attempt','acceptance','required_gate_ids','updated_at'];
  for (const field of required) if (record[field] === undefined || record[field] === null || record[field] === '') errors.push(`missing ${field}`);
  if (!control.states.includes(record.status)) errors.push(`invalid status ${record.status}`);
  if (!agents.has(record.agent)) errors.push(`unknown agent ${record.agent}`);
  if (record.agent === 'director') errors.push('director cannot hold a write mission');
  if (!risks.has(record.risk)) errors.push(`invalid risk ${record.risk}`);
  if (!/^[0-9a-f]{7,40}$/i.test(String(record.base_sha || ''))) errors.push('base_sha must be a git SHA');
  if (!Number.isInteger(record.attempt) || record.attempt < 0) errors.push('attempt must be a non-negative integer');
  if (!Array.isArray(record.acceptance) || record.acceptance.length === 0) errors.push('acceptance must be a non-empty array');
  if (!Array.isArray(record.required_gate_ids) || record.required_gate_ids.length === 0) errors.push('required_gate_ids must be a non-empty array');
  for (const gateId of record.required_gate_ids || []) if (!gateIds.has(gateId)) errors.push(`unknown gate ${gateId}`);
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
  const normalized = String(text).replace(/\r/g, '').replace(/\b\d+(?:\.\d+)?s\b/g, '<duration>').replace(/\b\d{4}-\d{2}-\d{2}T[\d:.+-]+Z?\b/g, '<timestamp>').replace(/[ \t]+/g, ' ').trim();
  return createHash('sha256').update(normalized).digest('hex');
}

function leaseStatus(record, now = Date.now()) {
  const errors = validateRecord(record);
  if (errors.length) return { valid: false, reason: `invalid record: ${errors.join('; ')}` };
  if (!ACTIVE_STATES.has(record.status)) return { valid: false, reason: `state ${record.status} does not hold the writer lease` };
  return freshness(record.updated_at, now);
}

function freshness(updatedAt, now = Date.now()) {
  const updated = Date.parse(updatedAt);
  const ageMs = now - updated;
  const ttlMs = Number(control.lease.ttl_hours) * 60 * 60 * 1000;
  const valid = Number.isFinite(updated) && Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= ttlMs;
  return { valid, age_minutes: Number.isFinite(ageMs) ? Math.max(0, Math.round(ageMs / 60000)) : null, ttl_minutes: control.lease.ttl_hours * 60, reason: valid ? 'lease active' : 'lease expired or invalid' };
}

function marker(body, key) {
  const match = String(body || '').match(new RegExp(`^${key}:\\s*(.+)$`, 'mi'));
  return match ? match[1].trim() : '';
}

function listMarker(value) {
  if (!value || value === 'none') return [];
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.map(String) : []; } catch {}
  return String(value).split(',').map(item => item.trim()).filter(Boolean);
}

function globRegex(pattern) {
  const escaped = String(pattern).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '§§').replace(/\*/g, '[^/]*').replace(/§§/g, '.*').replace(/\?/g, '[^/]');
  return new RegExp(`^${escaped}$`);
}

function literalPrefix(pattern) { return String(pattern).split(/[*?]/, 1)[0]; }
function patternOverlap(a, b) {
  if (a === b) return true;
  const aWild = /[*?]/.test(a), bWild = /[*?]/.test(b);
  if (!aWild && !bWild) return false;
  if (aWild && !bWild) return globRegex(a).test(b);
  if (!aWild && bWild) return globRegex(b).test(a);
  const ap = literalPrefix(a), bp = literalPrefix(b);
  if (!ap || !bp) return true;
  return ap.startsWith(bp) || bp.startsWith(ap);
}

function derivedRoots(paths) {
  const ids = new Set();
  for (const artifact of derived.artifacts || []) for (const pattern of artifact.patterns || []) for (const file of paths) if (!/[*?]/.test(file) && globRegex(pattern).test(file)) ids.add(artifact.id);
  return [...ids].sort();
}

function serialPath(file) { return SERIAL_PATHS.some(prefix => file === prefix || file.startsWith(prefix)); }
function sensitiveClasses(paths) {
  const found = new Set();
  for (const file of paths) for (const [id, rx] of SENSITIVE_CLASSES) if (rx.test(file)) found.add(id);
  return [...found].sort();
}

function fleetGuard(agent, paths) {
  if (!paths.length) return { ok: false, reason: 'EMPTY_PATH_SET' };
  if (paths.some(file => /[*?]/.test(file))) return { ok: false, reason: 'AMBIGUOUS_GLOB_OWNERSHIP' };
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'pri-fleet.mjs'), 'simulate-guard', agent, ...paths], { cwd: ROOT, stdio: 'pipe' });
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: 'OWNERSHIP_DENY', detail: String(error.stderr || error.message).trim() };
  }
}

function normalizeMission(input) {
  return {
    id: String(input.id || ''), agent: String(input.agent || ''), branch: String(input.branch || ''), risk: String(input.risk || ''),
    status: String(input.status || 'ACTIVE'), updated_at: String(input.updated_at || ''), base_sha: String(input.base_sha || ''),
    paths: Array.isArray(input.paths) ? input.paths.map(String) : [], dependencies: Array.isArray(input.dependencies) ? input.dependencies.map(String) : []
  };
}

function canRunConcurrently(leftInput, rightInput) {
  const a = normalizeMission(leftInput), b = normalizeMission(rightInput);
  const deny = (reason, detail = null) => ({ decision: 'DENY', reason, detail, left: a.id, right: b.id });
  if (!a.id || !b.id || a.id === b.id) return deny('MISSION_ID_CONFLICT');
  if (!agents.has(a.agent) || !agents.has(b.agent) || a.agent === 'director' || b.agent === 'director') return deny('INVALID_AGENT');
  if (a.agent === b.agent) return deny('OWNER_NOT_DISTINCT');
  if (a.dependencies.includes(b.id) || b.dependencies.includes(a.id)) return deny('DEPENDENCY_EDGE');
  const ag = fleetGuard(a.agent, a.paths), bg = fleetGuard(b.agent, b.paths);
  if (!ag.ok) return deny(ag.reason, { mission: a.id, detail: ag.detail || null });
  if (!bg.ok) return deny(bg.reason, { mission: b.id, detail: bg.detail || null });
  if (a.paths.some(serialPath) || b.paths.some(serialPath)) return deny('SERIAL_GLOBAL_AUTHORITY');
  for (const ap of a.paths) for (const bp of b.paths) if (patternOverlap(ap, bp)) return deny('PATH_OVERLAP', { left_path: ap, right_path: bp });
  const ar = new Set(derivedRoots(a.paths)), br = new Set(derivedRoots(b.paths));
  for (const id of ar) if (br.has(id)) return deny('SHARED_DERIVED_ROOT', id);
  const ac = new Set(sensitiveClasses(a.paths)), bc = new Set(sensitiveClasses(b.paths));
  for (const id of ac) if (bc.has(id)) return deny('SHARED_SENSITIVE_AUTHORITY', id);
  return { decision: 'ALLOW', reason: 'DISJOINT', left: a.id, right: b.id, evidence: { left_agent: a.agent, right_agent: b.agent, left_paths: a.paths, right_paths: b.paths, left_derived_roots: [...ar], right_derived_roots: [...br] } };
}

function admit(candidateInput, activeInputs, now = Date.now()) {
  const candidate = normalizeMission(candidateInput);
  const cap = maxWriters();
  const validActive = [], stale = [];
  for (const raw of activeInputs || []) {
    const mission = normalizeMission(raw);
    const fresh = freshness(mission.updated_at, now);
    if (fresh.valid) validActive.push(mission); else stale.push(mission.id || '?');
  }
  if (validActive.length >= cap) return { decision: 'DENY', reason: 'WRITER_CAP', max_writers: cap, active_writers: validActive.map(item => item.id), stale_ignored: stale };
  for (const active of validActive) {
    const result = canRunConcurrently(candidate, active);
    if (result.decision !== 'ALLOW') return { ...result, max_writers: cap, active_writers: validActive.map(item => item.id), stale_ignored: stale };
  }
  return { decision: 'ALLOW', reason: validActive.length ? 'DISJOINT_WITH_ACTIVE_WRITERS' : 'FIRST_WRITER', max_writers: cap, active_writers: validActive.map(item => item.id), stale_ignored: stale };
}

function issueMission(issue) {
  return normalizeMission({
    id: marker(issue.body, 'Pri-Mission-ID'), status: marker(issue.body, 'Pri-Mission-Status'), agent: marker(issue.body, 'Pri-Agent'), branch: marker(issue.body, 'Pri-Branch'),
    risk: marker(issue.body, 'Pri-Risk'), base_sha: marker(issue.body, 'Pri-Base-SHA'), updated_at: issue.updated_at,
    paths: listMarker(marker(issue.body, 'Pri-Paths')), dependencies: listMarker(marker(issue.body, 'Pri-Dependencies'))
  });
}

function validateLedger(issues, expected, now = Date.now()) {
  const errors = [];
  if (!Array.isArray(issues)) return { valid: false, errors: ['ledger snapshot must be an array'] };
  const managed = issues.filter(issue => !issue.pull_request && String(issue.title || '').startsWith(control.ledger.title_prefix) && marker(issue.body, 'Pri-Mission-ID'));
  const activeIssues = managed.filter(issue => ACTIVE_STATES.has(marker(issue.body, 'Pri-Mission-Status')));
  const cap = maxWriters();
  if (activeIssues.length < 1 || activeIssues.length > cap) return { valid: false, errors: [`expected 1..${cap} active writer leases, found ${activeIssues.length}`], managed_count: managed.length, active_count: activeIssues.length, max_writers: cap };
  const missions = activeIssues.map(issueMission);
  const ids = new Set(), branches = new Set();
  for (let i = 0; i < activeIssues.length; i++) {
    const issue = activeIssues[i], mission = missions[i], fresh = freshness(issue.updated_at, now);
    if (!fresh.valid) errors.push(`writer lease issue #${issue.number ?? '?'} is stale or has invalid updated_at (${issue.updated_at})`);
    if (!mission.id || ids.has(mission.id)) errors.push(`duplicate or missing mission id ${mission.id || '?'}`); else ids.add(mission.id);
    if (!mission.branch || branches.has(mission.branch)) errors.push(`duplicate or missing branch ${mission.branch || '?'}`); else branches.add(mission.branch);
    if (!agents.has(mission.agent) || mission.agent === 'director') errors.push(`invalid writer agent ${mission.agent || '?'}`);
    if (!risks.has(mission.risk)) errors.push(`invalid writer risk ${mission.risk || '?'}`);
    if (!/^[0-9a-f]{7,40}$/i.test(mission.base_sha)) errors.push(`invalid base SHA for ${mission.id || '?'}`);
    const attempt = marker(issue.body, 'Pri-Attempt');
    const failure = marker(issue.body, 'Pri-Failure-Fingerprint');
    if (!/^\d+$/.test(attempt)) errors.push(`Pri-Attempt must be non-negative for ${mission.id || '?'}`);
    if (failure && failure !== 'none' && !/^[0-9a-f]{64}$/i.test(failure)) errors.push(`invalid failure fingerprint for ${mission.id || '?'}`);
  }
  const target = missions.find(m => m.id === expected.mission);
  if (!target) errors.push('mission marker does not match any active writer');
  else {
    if (target.agent !== expected.agent) errors.push('agent marker does not match PR');
    if (target.branch !== expected.branch) errors.push('branch marker does not match PR');
    if (target.risk !== expected.risk) errors.push('risk marker does not match PR');
  }
  if (missions.length > 1) {
    for (const mission of missions) if (!mission.paths.length) errors.push(`Pri-Paths required for concurrent writer ${mission.id}`);
    for (let i = 0; i < missions.length; i++) for (let j = i + 1; j < missions.length; j++) {
      const result = canRunConcurrently(missions[i], missions[j]);
      if (result.decision !== 'ALLOW') errors.push(`concurrency denied ${missions[i].id}/${missions[j].id}: ${result.reason}`);
    }
  }
  return { valid: errors.length === 0, errors, issue_number: activeIssues.find(issue => marker(issue.body, 'Pri-Mission-ID') === expected.mission)?.number ?? null, managed_count: managed.length, active_count: activeIssues.length, max_writers: cap };
}

function template(id, agent, risk, baseSha) {
  if (!id) throw new Error('template requires mission id');
  if (!agents.has(agent) || agent === 'director') throw new Error(`invalid write agent '${agent}'`);
  if (!risks.has(risk)) throw new Error(`invalid risk '${risk}'`);
  if (!/^[0-9a-f]{7,40}$/i.test(baseSha || '')) throw new Error('template requires base SHA');
  return { id, status: 'TRIAGED', agent, branch: `agent/mission/${agent}/${id}`, risk, base_sha: baseSha, attempt: 0, failure_fingerprint: null, paths: [], dependencies: [], acceptance: ['Replace with explicit, testable acceptance condition'], required_gate_ids: fleet.agents.find(item => item.id === agent).gate_ids, evidence: [], blockers: [], residual_risk: [], updated_at: new Date().toISOString() };
}

function usage() { console.log('Pri Learning Mission Control\n\nCommands:\n  validate\n  rank <candidates.json>\n  validate-record <mission.json>\n  validate-ledger <issues.json> <agent> <mission> <branch> <risk>\n  transition <mission.json> <next-state> [--write]\n  fingerprint <text-file>\n  lease-status <mission.json>\n  template <id> <agent> <risk> <base-sha>\n  can-run-concurrently <left.json> <right.json>\n  admit <candidate.json> <active.json>'); }

const [command = 'validate', ...args] = process.argv.slice(2);
if (command === 'validate') {
  const errors = validateControl();
  if (errors.length) { for (const error of errors) console.error(`ERROR: ${error}`); process.exit(1); }
  console.log(`PASS: mission control has ${control.states.length} states, ${control.lease.ttl_hours}h leases, writer cap ${maxWriters()} and retry ceiling ${control.retry_policy.max_identical_failure_attempts}.`);
} else if (command === 'rank') {
  const candidates = readJson(path.resolve(args[0]));
  if (!Array.isArray(candidates) || !candidates.length) throw new Error('candidate file must contain a non-empty array');
  console.log(JSON.stringify(rank(candidates), null, 2));
} else if (command === 'validate-record') {
  const record = readJson(path.resolve(args[0])); const errors = validateRecord(record);
  if (errors.length) { for (const error of errors) console.error(`ERROR: ${error}`); process.exit(1); }
  console.log(`PASS: mission ${record.id} (${record.status}, ${record.agent}, ${record.risk})`);
} else if (command === 'validate-ledger') {
  if (!args[0] || !args[1] || !args[2] || !args[3] || !args[4]) throw new Error('validate-ledger requires issues.json agent mission branch risk');
  const result = validateLedger(readJson(path.resolve(args[0])), { agent: args[1], mission: args[2], branch: args[3], risk: args[4] });
  console.log(JSON.stringify(result, null, 2)); if (!result.valid) process.exitCode = 1;
} else if (command === 'transition') {
  const file = path.resolve(args[0]); const next = args[1]; if (!next) throw new Error('transition requires a target state');
  const updated = transition(readJson(file), next); if (args.includes('--write')) { writeFileSync(file, `${JSON.stringify(updated, null, 2)}\n`); console.log(`PASS: wrote ${updated.status} to ${file}`); } else console.log(JSON.stringify(updated, null, 2));
} else if (command === 'fingerprint') {
  if (!args[0]) throw new Error('fingerprint requires a text file'); console.log(normalizedFingerprint(readFileSync(path.resolve(args[0]), 'utf8')));
} else if (command === 'lease-status') {
  const result = leaseStatus(readJson(path.resolve(args[0]))); console.log(JSON.stringify(result, null, 2)); if (!result.valid) process.exitCode = 1;
} else if (command === 'template') {
  console.log(JSON.stringify(template(args[0], args[1], args[2], args[3]), null, 2));
} else if (command === 'can-run-concurrently') {
  const result = canRunConcurrently(readJson(path.resolve(args[0])), readJson(path.resolve(args[1]))); console.log(JSON.stringify(result, null, 2)); if (result.decision !== 'ALLOW') process.exitCode = 1;
} else if (command === 'admit') {
  const active = readJson(path.resolve(args[1])); if (!Array.isArray(active)) throw new Error('active.json must be an array');
  const result = admit(readJson(path.resolve(args[0])), active); console.log(JSON.stringify(result, null, 2)); if (result.decision !== 'ALLOW') process.exitCode = 1;
} else { usage(); process.exitCode = 2; }
